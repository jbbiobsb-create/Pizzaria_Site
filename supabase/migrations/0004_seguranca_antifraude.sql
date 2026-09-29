-- Segurança e antifraude
-- 1) Painel só para quem está na tabela "equipe" (antes: qualquer usuário logado, e o cadastro público estava aberto).
-- 2) criar_pedido com limites contra trote/spam, validação de combos, cupom por cliente e troco.
-- 3) Busca por telefone não devolve mais o link do pedido (evita descobrir endereço de terceiros pelo celular).

-- ---------------------------------------------------------------
-- 1) Equipe
-- ---------------------------------------------------------------
create table if not exists public.equipe (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  criado_em timestamptz not null default now()
);
alter table public.equipe enable row level security;

create or replace function public.is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe where user_id = auth.uid());
$$;
revoke all on function public.is_equipe() from public, anon;
grant execute on function public.is_equipe() to authenticated;

create policy "equipe: ver a si mesmo" on public.equipe for select to authenticated using (user_id = auth.uid() or public.is_equipe());

-- dono da loja
insert into public.equipe (user_id, nome)
select id, 'Dono' from auth.users where email = 'jbbiobsb@gmail.com'
on conflict do nothing;

-- troca as políticas "authenticated = equipe" por "está na tabela equipe"
do $$
declare t text;
begin
  foreach t in array array['config','categorias','tamanhos','sabores','sabor_precos','produtos','cupons','pedidos','pedido_itens'] loop
    execute format('drop policy if exists %I on public.%I', t || ': equipe', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_equipe()) with check (public.is_equipe())', t || ': equipe', t);
  end loop;
end $$;
drop policy if exists "saipos_eventos: equipe" on public.saipos_eventos;
create policy "saipos_eventos: equipe" on public.saipos_eventos for select to authenticated using (public.is_equipe());

-- ---------------------------------------------------------------
-- 2) Pedidos: antifraude
-- ---------------------------------------------------------------
alter table public.pedidos add column if not exists origem_ip text;
create index if not exists pedidos_ip_idx on public.pedidos (origem_ip, criado_em desc);
alter table public.cupons add column if not exists uso_por_cliente int default 1;  -- null = ilimitado

-- IP de quem chamou (PostgREST repassa os headers da requisição)
create or replace function public.ip_requisicao() returns text
language sql stable as $$
  select nullif(trim(split_part(coalesce(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip', ''), ',', 1)), '');
$$;
revoke all on function public.ip_requisicao() from public, anon, authenticated;

-- a lógica de preço/entrega continua na função original, agora interna
alter function public.criar_pedido(jsonb) rename to criar_pedido_base;
revoke all on function public.criar_pedido_base(jsonb) from public, anon, authenticated;

create or replace function public.criar_pedido(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  telefone text := so_digitos(p->'cliente'->>'telefone');
  ip text := public.ip_requisicao();
  it jsonb; prod public.produtos; passo jsonb; esc jsonb;
  escolhas text[]; permitidas text[]; qtd int;
  cupom text; cp public.cupons; usados int;
  agendado timestamptz; resultado jsonb; total numeric; troco numeric;
begin
  -- tamanhos de campo
  if length(coalesce(p->'cliente'->>'nome', '')) > 80 then raise exception 'Nome muito longo.'; end if;
  if length(telefone) not between 10 and 11 or left(telefone, 2) < '11' then raise exception 'Informe um celular válido com DDD.'; end if;
  if length(coalesce(p->'cliente'->>'email', '')) > 120 then raise exception 'E-mail muito longo.'; end if;
  if length(coalesce(p->>'observacoes', '')) > 500 then raise exception 'Observações muito longas (máx. 500 caracteres).'; end if;
  if length(coalesce(p->>'endereco', '')) > 1500 then raise exception 'Endereço inválido.'; end if;
  if jsonb_array_length(coalesce(p->'itens', '[]')) > 30 then raise exception 'Pedido com itens demais. Fale com a gente pelo WhatsApp.'; end if;
  agendado := nullif(p->>'agendado_para', '')::timestamptz;
  if agendado is not null and agendado > now() + interval '7 days' then raise exception 'Agendamento só até 7 dias.'; end if;

  -- limites contra trote/spam
  if (select count(*) from pedidos where cliente_telefone = telefone and criado_em > now() - interval '15 minutes') >= 3 then
    raise exception 'Muitos pedidos seguidos deste celular. Aguarde alguns minutos ou fale com a gente pelo WhatsApp.';
  end if;
  if ip is not null and (select count(*) from pedidos where origem_ip = ip and criado_em > now() - interval '15 minutes') >= 5 then
    raise exception 'Muitos pedidos seguidos. Aguarde alguns minutos ou fale com a gente pelo WhatsApp.';
  end if;
  if (select count(*) from pedidos where cliente_telefone = telefone and pagamento_status = 'pendente'
        and status <> 'cancelado' and criado_em > now() - interval '3 hours') >= 2 then
    raise exception 'Você já tem pedidos aguardando pagamento. Conclua o pagamento ou fale com a gente.';
  end if;

  -- combos: escolhas precisam estar entre as opções de cada passo (senão dá para pegar qualquer produto de graça)
  for it in select * from jsonb_array_elements(coalesce(p->'itens', '[]')) loop
    if length(coalesce(it->>'observacao', '')) > 200 then raise exception 'Observação do item muito longa (máx. 200).'; end if;
    continue when it->>'tipo' <> 'produto';
    select * into prod from produtos where slug = it->>'slug';
    continue when prod is null;  -- criar_pedido_base trata produto inválido
    escolhas := array(select jsonb_array_elements_text(coalesce(it->'escolhas', '[]')));
    permitidas := '{}';
    for passo in select * from jsonb_array_elements(coalesce(prod.passos, '[]')) loop
      qtd := (select count(*) from unnest(escolhas) e where e = any (array(select jsonb_array_elements_text(coalesce(passo->'opcoes', '[]')))));
      if qtd < coalesce((passo->>'min')::int, 0) or qtd > coalesce((passo->>'max')::int, 99) then
        raise exception 'Escolha inválida no combo %.', prod.nome;
      end if;
      permitidas := permitidas || array(select jsonb_array_elements_text(coalesce(passo->'opcoes', '[]')));
    end loop;
    if exists (select 1 from unnest(escolhas) e where not (e = any (permitidas))) then
      raise exception 'Escolha inválida no combo %.', prod.nome;
    end if;
  end loop;

  -- cupom: limite de uso por cliente (ex.: BEMVINDO10 só no primeiro pedido)
  cupom := nullif(trim(coalesce(p->>'cupom', '')), '');
  if cupom is not null then
    select * into cp from cupons where upper(codigo) = upper(cupom) and ativo;
    if cp.id is not null and cp.uso_por_cliente is not null then  -- (cp is not null exige todos os campos preenchidos)
      select count(*) into usados from pedidos
        where cliente_telefone = telefone and upper(cupom_codigo) = upper(cp.codigo) and status <> 'cancelado';
      if usados >= cp.uso_por_cliente then raise exception 'Este cupom já foi usado neste celular.'; end if;
    end if;
  end if;

  resultado := public.criar_pedido_base(p);

  -- troco coerente com o total (recalculado no servidor)
  total := (resultado->>'total')::numeric;
  troco := (resultado->>'troco_para')::numeric;
  if troco is not null and (troco < total or troco > total + 500) then
    raise exception 'Troco para R$ % não confere com o total de R$ %.', to_char(troco, 'FM999G990D00'), to_char(total, 'FM999G990D00');
  end if;

  update pedidos set origem_ip = ip where id = (resultado->>'id')::uuid;
  return resultado;
end $$;
revoke all on function public.criar_pedido(jsonb) from public;
grant execute on function public.criar_pedido(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------
-- 3) Consultas públicas sem dados pessoais de terceiros
-- ---------------------------------------------------------------
-- busca por celular: só status e resumo, sem o id (o id é a "chave" que abre nome/endereço)
create or replace function public.pedidos_por_telefone(p_telefone text) returns jsonb
language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'numero', pd.numero, 'status', pd.status, 'total', pd.total,
      'tipo_entrega', pd.tipo_entrega, 'criado_em', pd.criado_em,
      'resumo', (select string_agg(i.quantidade || 'x ' || i.nome, ', ') from public.pedido_itens i where i.pedido_id = pd.id))
    order by pd.criado_em desc), '[]')
  from (select * from public.pedidos where cliente_telefone = so_digitos(p_telefone) and criado_em > now() - interval '2 days' order by criado_em desc limit 5) pd;
$$;

-- consulta pelo link: também sem IP e dados internos
create or replace function public.consultar_pedido(p_id uuid) returns jsonb
language sql security definer set search_path = public stable as $$
  select (to_jsonb(pd) - 'cliente_email' - 'origem_ip' - 'saipos_status' - 'saipos_sale_number' - 'saipos_enviado_em' - 'saipos_erro' - 'saipos_tentativas')
    || jsonb_build_object(
      'itens', (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]') from public.pedido_itens i where i.pedido_id = pd.id),
      'pix', case when pd.pagamento = 'pix' then (select jsonb_build_object('chave', c.chave_pix, 'nome', c.pix_nome) from public.config c where c.id = 1) else null end,
      'whatsapp', (select c.whatsapp from public.config c where c.id = 1))
  from public.pedidos pd where pd.id = p_id;
$$;

-- search_path fixo nas funções (alerta do Supabase)
alter function public.tg_pedidos_status() set search_path = public;
alter function public.so_digitos(text) set search_path = public;
alter function public.distancia_km(double precision, double precision, double precision, double precision) set search_path = public;
alter function public.taxa_por_distancia(double precision) set search_path = public;
alter function public.cardapio() set search_path = public;
alter function public.status_loja() set search_path = public;
alter function public.calcular_entrega(double precision, double precision) set search_path = public;
alter function public.validar_cupom(text, numeric) set search_path = public;
alter function public.loja_aberta() set search_path = public;
alter function public.ip_requisicao() set search_path = public;
