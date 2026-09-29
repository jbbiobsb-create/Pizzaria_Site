-- 0007_fidelidade.sql — Clube Sesconetto's: programa de fidelidade / cashback
-- Identidade do cliente = celular (só dígitos). Saldo = soma do "restante" dos créditos não vencidos
-- menos o débito pendente (estorno de pedido cancelado depois de creditado). Sem pg_cron: vencimento preguiçoso.
-- Regras (parâmetros em config.fidelidade, editáveis no painel):
--   níveis Bronze 5% (0–2 pedidos entregues em 90 dias), Prata 7% (3–5), Ouro 10% (6+);
--   base do cashback = subtotal − cupom − cashback usado (taxa de entrega fora), truncado no centavo;
--   crédito só quando status = 'entregue' e pagamento_status in ('pago','na_entrega');
--   validade 90 dias por crédito, consumo FIFO; mínimo para usar R$ 10; máximo 50% dos produtos por pedido;
--   cupom cumulativo; sem bônus de boas-vindas; PIN de 4 dígitos criado pelo link do pedido.

-- ---------------------------------------------------------------
-- 1) Config (exposta pelo cardapio() automaticamente: to_jsonb(config) - 'chave_pix')
-- ---------------------------------------------------------------
alter table public.config add column if not exists fidelidade jsonb not null default
  '{"ativo": true, "validade_dias": 90, "max_pct_pedido": 50, "min_resgate": 10,
    "niveis": [{"nome":"Bronze","min_pedidos_90d":0,"pct":5},
               {"nome":"Prata","min_pedidos_90d":3,"pct":7},
               {"nome":"Ouro","min_pedidos_90d":6,"pct":10}]}'::jsonb;

-- ---------------------------------------------------------------
-- 2) Tabelas
-- ---------------------------------------------------------------
create table if not exists public.clientes (
  telefone text primary key check (telefone ~ '^\d{10,11}$'),
  nome text,
  pin_hash text,                          -- extensions.crypt(pin, extensions.gen_salt('bf', 8)); null = ainda sem PIN
  pin_tentativas int not null default 0,
  pin_bloqueado_ate timestamptz,
  pin_criado_em timestamptz,
  debito_pendente numeric(10,2) not null default 0 check (debito_pendente >= 0), -- saldo "negativo": estorno sem saldo, abatido no próximo crédito
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.fidelidade_movimentos (
  id bigint generated always as identity primary key,
  telefone text not null references public.clientes(telefone) on delete cascade,
  tipo text not null check (tipo in ('credito','debito','estorno_credito','estorno_debito','expirado','ajuste')),
  valor numeric(10,2) not null,           -- + entra, - sai
  restante numeric(10,2) not null default 0 check (restante >= 0),  -- só em créditos: quanto ainda pode ser usado
  expira_em timestamptz,                  -- só em créditos
  pedido_id uuid references public.pedidos(id) on delete set null,
  descricao text,
  autor uuid,                             -- equipe (auth.uid()) em ajustes manuais
  criado_em timestamptz not null default now()
);
create index if not exists fidelidade_mov_tel_idx on public.fidelidade_movimentos (telefone, criado_em desc);
create index if not exists fidelidade_mov_saldo_idx on public.fidelidade_movimentos (telefone, expira_em, id) where restante > 0;
create index if not exists fidelidade_mov_pedido_idx on public.fidelidade_movimentos (pedido_id) where pedido_id is not null;

-- tentativas erradas de PIN por IP (rate limit complementar ao bloqueio por celular)
create table if not exists public.fidelidade_tentativas (
  id bigint generated always as identity primary key,
  ip text, telefone text, em timestamptz not null default now()
);
create index if not exists fidelidade_tentativas_ip_idx on public.fidelidade_tentativas (ip, em desc);

alter table public.clientes enable row level security;
alter table public.fidelidade_movimentos enable row level security;
alter table public.fidelidade_tentativas enable row level security;   -- sem política: só funções security definer
drop policy if exists "clientes: equipe" on public.clientes;
create policy "clientes: equipe" on public.clientes for all to authenticated using (public.is_equipe()) with check (public.is_equipe());
drop policy if exists "fidelidade_movimentos: equipe" on public.fidelidade_movimentos;
create policy "fidelidade_movimentos: equipe" on public.fidelidade_movimentos for all to authenticated using (public.is_equipe()) with check (public.is_equipe());
-- reset de PIN pelo painel = update direto:
--   update clientes set pin_hash = null, pin_tentativas = 0, pin_bloqueado_ate = null where telefone = '...'

-- ---------------------------------------------------------------
-- 3) Colunas em pedidos
-- ---------------------------------------------------------------
alter table public.pedidos
  add column if not exists cashback_usado numeric(10,2) not null default 0,
  add column if not exists cashback_ganho numeric(10,2),        -- null até creditar (0 = processado sem crédito)
  add column if not exists fidelidade_nivel text,               -- nível do celular no momento do pedido
  add column if not exists fidelidade_pct numeric(5,2);         -- % daquele nível no momento do pedido (congelado)
create index if not exists pedidos_entregues_tel_idx on public.pedidos (cliente_telefone, criado_em desc) where status = 'entregue';

-- ---------------------------------------------------------------
-- 4) Funções internas (sem grant para anon)
-- ---------------------------------------------------------------
-- vence créditos do celular (preguiçoso)
create or replace function public.fidelidade_expirar(p_telefone text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id, restante from public.fidelidade_movimentos
            where telefone = p_telefone and restante > 0 and expira_em <= now() for update loop
    insert into public.fidelidade_movimentos (telefone, tipo, valor, restante, descricao)
      values (p_telefone, 'expirado', -r.restante, 0, 'Cashback vencido');
    update public.fidelidade_movimentos set restante = 0 where id = r.id;
  end loop;
end $$;

-- saldo líquido = créditos válidos − débito pendente (pode ser negativo)
create or replace function public.fidelidade_saldo_interno(p_telefone text) returns numeric
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(restante) from public.fidelidade_movimentos
                     where telefone = p_telefone and restante > 0 and expira_em > now()), 0)
          - coalesce((select debito_pendente from public.clientes where telefone = p_telefone), 0))::numeric(10,2);
$$;

-- nível pelo nº de pedidos entregues nos últimos 90 dias
create or replace function public.fidelidade_nivel(p_telefone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f jsonb; n int; niv jsonb; atual jsonb; prox jsonb;
begin
  select fidelidade into f from public.config where id = 1;
  select count(*) into n from public.pedidos
   where cliente_telefone = p_telefone and status = 'entregue' and criado_em > now() - interval '90 days';
  for niv in select value from jsonb_array_elements(coalesce(f->'niveis', '[]')) order by (value->>'min_pedidos_90d')::int loop
    if n >= coalesce((niv->>'min_pedidos_90d')::int, 0) then atual := niv;
    elsif prox is null then prox := niv; end if;
  end loop;
  return jsonb_build_object(
    'nome', atual->>'nome', 'pct', coalesce((atual->>'pct')::numeric, 0), 'pedidos_90d', n,
    'proximo', case when prox is null then null else jsonb_build_object('nome', prox->>'nome', 'pct', (prox->>'pct')::numeric,
                 'faltam', greatest((prox->>'min_pedidos_90d')::int - n, 0)) end);
end $$;

-- crédito (credito | estorno_debito | ajuste positivo). Abate primeiro o débito pendente do celular.
create or replace function public.fidelidade_creditar(p_telefone text, p_valor numeric, p_tipo text, p_pedido uuid, p_descricao text, p_autor uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare dias int; v numeric := trunc(p_valor, 2); mid bigint; dev numeric; abate numeric := 0;
begin
  if v <= 0 then return null; end if;
  select coalesce((fidelidade->>'validade_dias')::int, 90) into dias from public.config where id = 1;
  insert into public.clientes (telefone) values (p_telefone) on conflict (telefone) do nothing;
  select debito_pendente into dev from public.clientes where telefone = p_telefone for update;
  if dev > 0 then
    abate := least(dev, v);
    update public.clientes set debito_pendente = debito_pendente - abate, atualizado_em = now() where telefone = p_telefone;
  end if;
  insert into public.fidelidade_movimentos (telefone, tipo, valor, restante, expira_em, pedido_id, descricao, autor)
    values (p_telefone, p_tipo, v, v - abate, now() + make_interval(days => dias), p_pedido,
            p_descricao || case when abate > 0 then ' (R$ ' || to_char(abate, 'FM999G990D00') || ' abatidos de estorno anterior)' else '' end, p_autor)
    returning id into mid;
  return mid;
end $$;

-- débito FIFO (debito | ajuste negativo): consome "restante" dos créditos que vencem primeiro
create or replace function public.fidelidade_debitar(p_telefone text, p_valor numeric, p_tipo text, p_pedido uuid, p_descricao text, p_autor uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare falta numeric := round(p_valor, 2); r record; usa numeric;
begin
  if falta <= 0 then return; end if;
  perform public.fidelidade_expirar(p_telefone);
  if coalesce((select debito_pendente from public.clientes where telefone = p_telefone), 0) > 0 then
    raise exception 'Saldo de cashback insuficiente.';
  end if;
  for r in select id, restante from public.fidelidade_movimentos
            where telefone = p_telefone and restante > 0 and expira_em > now()
            order by expira_em, id for update loop
    exit when falta <= 0;
    usa := least(r.restante, falta);
    update public.fidelidade_movimentos set restante = restante - usa where id = r.id;
    falta := falta - usa;
  end loop;
  if falta > 0 then raise exception 'Saldo de cashback insuficiente.'; end if;
  insert into public.fidelidade_movimentos (telefone, tipo, valor, restante, pedido_id, descricao, autor)
    values (p_telefone, p_tipo, -round(p_valor, 2), 0, p_pedido, p_descricao, p_autor);
end $$;

-- verificação de PIN com bloqueio (5 erros → 15 min) e limite por IP (30 erros/15 min).
-- Retorna jsonb (não lança) para o contador persistir mesmo quando o chamador devolve erro.
create or replace function public.fidelidade_verificar_pin(p_telefone text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cl public.clientes; v_ip text := public.ip_requisicao(); t int;
begin
  if coalesce(p_pin, '') !~ '^\d{4}$' then return jsonb_build_object('ok', false, 'motivo', 'O PIN tem 4 dígitos.'); end if;
  if v_ip is not null and (select count(*) from public.fidelidade_tentativas where ip = v_ip and em > now() - interval '15 minutes') >= 30 then
    return jsonb_build_object('ok', false, 'bloqueado', true, 'motivo', 'Muitas tentativas. Aguarde 15 minutos.');
  end if;
  select * into cl from public.clientes where telefone = p_telefone for update;   -- lock: serializa uso de saldo do mesmo celular
  if cl.telefone is null or cl.pin_hash is null then
    return jsonb_build_object('ok', false, 'sem_pin', true, 'motivo', 'Este celular ainda não tem PIN. Crie pelo link de um pedido seu.');
  end if;
  if cl.pin_bloqueado_ate is not null and cl.pin_bloqueado_ate > now() then
    return jsonb_build_object('ok', false, 'bloqueado', true, 'ate', cl.pin_bloqueado_ate,
      'motivo', 'PIN bloqueado por tentativas erradas. Tente de novo às ' || to_char(cl.pin_bloqueado_ate at time zone 'America/Sao_Paulo', 'HH24:MI') || '.');
  end if;
  if cl.pin_hash = extensions.crypt(p_pin, cl.pin_hash) then
    update public.clientes set pin_tentativas = 0, pin_bloqueado_ate = null where telefone = p_telefone;
    return jsonb_build_object('ok', true);
  end if;
  t := cl.pin_tentativas + 1;
  insert into public.fidelidade_tentativas (ip, telefone) values (v_ip, p_telefone);
  update public.clientes set pin_tentativas = case when t >= 5 then 0 else t end,
    pin_bloqueado_ate = case when t >= 5 then now() + interval '15 minutes' else null end, atualizado_em = now()
   where telefone = p_telefone;
  delete from public.fidelidade_tentativas where em < now() - interval '1 day';   -- limpeza preguiçosa
  return jsonb_build_object('ok', false, 'bloqueado', t >= 5, 'motivo',
    case when t >= 5 then 'PIN bloqueado por 15 minutos. Se esqueceu, fale com a gente no WhatsApp.' else 'PIN incorreto. Restam ' || (5 - t) || ' tentativa(s).' end);
end $$;

-- 4 dígitos, sem repetição (1111) nem sequência óbvia
create or replace function public.fidelidade_pin_valido(p_pin text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(p_pin, '') ~ '^\d{4}$' and p_pin !~ '^(\d)\1{3}$' and p_pin not in ('1234','4321','0123','3210');
$$;

-- ---------------------------------------------------------------
-- 5) RPCs públicas (anon)
-- ---------------------------------------------------------------
-- SEM PIN: nada de saldo (só o que o checkout precisa para oferecer o programa)
create or replace function public.fidelidade_resumo(p_telefone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tel text := so_digitos(p_telefone); f jsonb; cl public.clientes; niv jsonb;
begin
  select fidelidade into f from public.config where id = 1;
  if not coalesce((f->>'ativo')::boolean, false) then return jsonb_build_object('ativo', false); end if;
  if length(tel) not between 10 and 11 then return jsonb_build_object('ativo', true, 'tem_conta', false, 'tem_pin', false,
    'max_pct_pedido', f->'max_pct_pedido', 'min_resgate', f->'min_resgate', 'validade_dias', f->'validade_dias', 'niveis', f->'niveis'); end if;
  select * into cl from public.clientes where telefone = tel;
  niv := public.fidelidade_nivel(tel);
  return jsonb_build_object('ativo', true, 'tem_conta', cl.telefone is not null, 'tem_pin', cl.pin_hash is not null,
    'nivel', niv->>'nome', 'pct', niv->'pct', 'pedidos_90d', niv->'pedidos_90d', 'proximo', niv->'proximo',
    'max_pct_pedido', f->'max_pct_pedido', 'min_resgate', f->'min_resgate', 'validade_dias', f->'validade_dias', 'niveis', f->'niveis');
end $$;

-- COM PIN: saldo, movimentos e vencimento. Volatile (grava tentativas erradas).
create or replace function public.fidelidade_saldo(p_telefone text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tel text := so_digitos(p_telefone); f jsonb; ver jsonb; niv jsonb; saldo numeric; venc record;
begin
  select fidelidade into f from public.config where id = 1;
  if not coalesce((f->>'ativo')::boolean, false) then return jsonb_build_object('ok', false, 'motivo', 'Programa de fidelidade indisponível.'); end if;
  ver := public.fidelidade_verificar_pin(tel, p_pin);
  if not (ver->>'ok')::boolean then return ver; end if;
  perform public.fidelidade_expirar(tel);
  saldo := public.fidelidade_saldo_interno(tel);
  niv := public.fidelidade_nivel(tel);
  select restante, expira_em into venc from public.fidelidade_movimentos
   where telefone = tel and restante > 0 and expira_em > now() order by expira_em limit 1;
  return jsonb_build_object('ok', true, 'saldo', saldo, 'nivel', niv->>'nome', 'pct', niv->'pct',
    'pedidos_90d', niv->'pedidos_90d', 'proximo', niv->'proximo',
    'min_resgate', f->'min_resgate', 'max_pct_pedido', f->'max_pct_pedido', 'validade_dias', f->'validade_dias',
    'pode_usar', saldo >= coalesce((f->>'min_resgate')::numeric, 0),
    'proximo_vencimento', case when venc.expira_em is null then null else jsonb_build_object('valor', venc.restante, 'em', venc.expira_em) end,
    'movimentos', (select coalesce(jsonb_agg(jsonb_build_object('tipo', m.tipo, 'valor', m.valor, 'restante', m.restante,
        'expira_em', m.expira_em, 'descricao', m.descricao, 'criado_em', m.criado_em, 'pedido_numero', pd.numero) order by m.id desc), '[]')
      from (select * from public.fidelidade_movimentos where telefone = tel order by id desc limit 20) m
      left join public.pedidos pd on pd.id = m.pedido_id));
end $$;

-- criar PIN provando posse do link do pedido (UUID, pedido dos últimos 30 dias, não cancelado); só se o celular ainda não tem PIN
create or replace function public.fidelidade_criar_pin(p_pedido uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pd public.pedidos; cl public.clientes;
begin
  select * into pd from public.pedidos where id = p_pedido;
  if pd.id is null then return jsonb_build_object('ok', false, 'motivo', 'Pedido não encontrado.'); end if;
  if pd.status = 'cancelado' or pd.criado_em < now() - interval '30 days' then
    return jsonb_build_object('ok', false, 'motivo', 'Use o link de um pedido recente (até 30 dias) que não tenha sido cancelado.');
  end if;
  if not public.fidelidade_pin_valido(p_pin) then return jsonb_build_object('ok', false, 'motivo', 'Escolha um PIN de 4 dígitos que não seja sequência nem repetição.'); end if;
  insert into public.clientes (telefone, nome) values (pd.cliente_telefone, pd.cliente_nome) on conflict (telefone) do nothing;
  select * into cl from public.clientes where telefone = pd.cliente_telefone for update;
  if cl.pin_hash is not null then return jsonb_build_object('ok', false, 'ja_tem_pin', true, 'motivo', 'Este celular já tem PIN. Se esqueceu, fale com a gente pelo WhatsApp.'); end if;
  update public.clientes set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), nome = coalesce(nome, pd.cliente_nome),
    pin_tentativas = 0, pin_bloqueado_ate = null, pin_criado_em = now(), atualizado_em = now() where telefone = pd.cliente_telefone;
  return jsonb_build_object('ok', true, 'telefone', pd.cliente_telefone);
end $$;

create or replace function public.fidelidade_trocar_pin(p_telefone text, p_pin_atual text, p_pin_novo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tel text := so_digitos(p_telefone); ver jsonb;
begin
  if not public.fidelidade_pin_valido(p_pin_novo) then return jsonb_build_object('ok', false, 'motivo', 'Escolha um PIN de 4 dígitos que não seja sequência nem repetição.'); end if;
  ver := public.fidelidade_verificar_pin(tel, p_pin_atual);
  if not (ver->>'ok')::boolean then return ver; end if;
  update public.clientes set pin_hash = extensions.crypt(p_pin_novo, extensions.gen_salt('bf', 8)), atualizado_em = now() where telefone = tel;
  return jsonb_build_object('ok', true);
end $$;

-- equipe: ajuste manual (+ crédito com validade / − débito FIFO), com motivo e autor
create or replace function public.fidelidade_ajustar(p_telefone text, p_valor numeric, p_descricao text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tel text := so_digitos(p_telefone);
begin
  if not public.is_equipe() then raise exception 'Sem permissão.'; end if;
  if length(tel) not between 10 and 11 then raise exception 'Celular inválido.'; end if;
  if coalesce(trim(p_descricao), '') = '' then raise exception 'Informe o motivo do ajuste.'; end if;
  if p_valor > 0 then perform public.fidelidade_creditar(tel, p_valor, 'ajuste', null, p_descricao, auth.uid());
  elsif p_valor < 0 then perform public.fidelidade_debitar(tel, -p_valor, 'ajuste', null, p_descricao, auth.uid());
  end if;
  return jsonb_build_object('ok', true, 'saldo', public.fidelidade_saldo_interno(tel));
end $$;

-- equipe: ficha do cliente para o painel (saldo, nível, PIN, últimos movimentos)
create or replace function public.fidelidade_cliente(p_telefone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tel text := so_digitos(p_telefone); cl public.clientes; niv jsonb;
begin
  if not public.is_equipe() then raise exception 'Sem permissão.'; end if;
  perform public.fidelidade_expirar(tel);
  select * into cl from public.clientes where telefone = tel;
  niv := public.fidelidade_nivel(tel);
  return jsonb_build_object('telefone', tel, 'tem_conta', cl.telefone is not null,
    'nome', coalesce(cl.nome, (select cliente_nome from public.pedidos where cliente_telefone = tel order by criado_em desc limit 1)),
    'tem_pin', cl.pin_hash is not null, 'pin_criado_em', cl.pin_criado_em, 'pin_tentativas', cl.pin_tentativas,
    'pin_bloqueado_ate', case when cl.pin_bloqueado_ate > now() then cl.pin_bloqueado_ate end,
    'saldo', public.fidelidade_saldo_interno(tel), 'debito_pendente', coalesce(cl.debito_pendente, 0),
    'nivel', niv->>'nome', 'pct', niv->'pct', 'pedidos_90d', niv->'pedidos_90d', 'proximo', niv->'proximo',
    'movimentos', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'valor', m.valor, 'restante', m.restante,
        'expira_em', m.expira_em, 'descricao', m.descricao, 'criado_em', m.criado_em, 'pedido_numero', pd.numero) order by m.id desc), '[]')
      from (select * from public.fidelidade_movimentos where telefone = tel order by id desc limit 50) m
      left join public.pedidos pd on pd.id = m.pedido_id));
end $$;

-- ---------------------------------------------------------------
-- 6) criar_pedido_base: total = subtotal - desconto - cashback + taxa; grava cashback_usado/nivel/pct
--    (mesmo padrão de 0004/0005: replace sobre a definição viva; cada trecho é único na função)
-- ---------------------------------------------------------------
do $do$
declare def text := pg_get_functiondef('public.criar_pedido_base(jsonb)'::regprocedure);
begin
  if position('v_cashback' in def) > 0 then raise notice 'criar_pedido_base já tem cashback'; return; end if;
  if position('tmin int; tmax int;' in def) = 0
     or position('  insert into public.pedidos (cliente_nome,' in def) = 0
     or position('taxa_a_confirmar, total, tempo_min, tempo_max)' in def) = 0
     or position('a_confirmar, subtotal - desconto + taxa, tmin, tmax)' in def) = 0 then
    raise exception 'criar_pedido_base: trecho esperado não encontrado — revisar migração';
  end if;
  def := replace(def, 'tmin int; tmax int;', 'tmin int; tmax int; v_cashback numeric := 0; v_nivel text; v_pct numeric;');
  def := replace(def, '  insert into public.pedidos (cliente_nome,',
$r$  -- cashback (só o wrapper criar_pedido passa _cashback_saldo; anon não chama esta função)
  v_cashback := least(coalesce(nullif(p->>'_cashback_saldo', '')::numeric, 0),
                      trunc((subtotal - desconto) * coalesce((c.fidelidade->>'max_pct_pedido')::numeric, 0) / 100, 2),
                      subtotal - desconto);
  v_cashback := greatest(trunc(v_cashback, 2), 0);
  v_nivel := nullif(p->>'_fidelidade_nivel', ''); v_pct := nullif(p->>'_fidelidade_pct', '')::numeric;
  insert into public.pedidos (cliente_nome,$r$);
  def := replace(def, 'taxa_a_confirmar, total, tempo_min, tempo_max)',
                      'taxa_a_confirmar, total, tempo_min, tempo_max, cashback_usado, fidelidade_nivel, fidelidade_pct)');
  def := replace(def, 'a_confirmar, subtotal - desconto + taxa, tmin, tmax)',
                      'a_confirmar, subtotal - desconto - v_cashback + taxa, tmin, tmax, v_cashback, v_nivel, v_pct)');
  execute def;
end $do$;

-- 6b) criar_pedido (wrapper antifraude de 0004 + patch 0005) + fidelidade.
-- Payload novo: usar_cashback (bool) e pin (text). PIN errado → retorna {ok:false, erro, pin:{...}} SEM raise,
-- para o incremento de tentativas persistir (o front deve checar data.erro). Saldo abaixo do mínimo → raise (nada gravado).
create or replace function public.criar_pedido(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  telefone text := so_digitos(p->'cliente'->>'telefone');
  ip text := public.ip_requisicao();
  it jsonb; prod public.produtos; passo jsonb; esc jsonb;
  escolhas text[]; permitidas text[]; qtd int;
  cupom text; cp public.cupons; usados int;
  agendado timestamptz; resultado jsonb; total numeric; troco numeric; v_loja int;
  v_fid jsonb; v_niv jsonb; v_ver jsonb; v_saldo numeric; v_cb numeric;
begin
  if length(coalesce(p->'cliente'->>'nome', '')) > 80 then raise exception 'Nome muito longo.'; end if;
  if length(telefone) not between 10 and 11 or left(telefone, 2) < '11' then raise exception 'Informe um celular válido com DDD.'; end if;
  if length(coalesce(p->'cliente'->>'email', '')) > 120 then raise exception 'E-mail muito longo.'; end if;
  if length(coalesce(p->>'observacoes', '')) > 500 then raise exception 'Observações muito longas (máx. 500 caracteres).'; end if;
  if length(coalesce(p->>'endereco', '')) > 1500 then raise exception 'Endereço inválido.'; end if;
  if jsonb_array_length(coalesce(p->'itens', '[]')) > 30 then raise exception 'Pedido com itens demais. Fale com a gente pelo WhatsApp.'; end if;
  agendado := nullif(p->>'agendado_para', '')::timestamptz;
  if agendado is not null and agendado > now() + interval '7 days' then raise exception 'Agendamento só até 7 dias.'; end if;

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

  for it in select * from jsonb_array_elements(coalesce(p->'itens', '[]')) loop
    if length(coalesce(it->>'observacao', '')) > 200 then raise exception 'Observação do item muito longa (máx. 200).'; end if;
    continue when it->>'tipo' <> 'produto';
    select * into prod from produtos where slug = it->>'slug';
    continue when prod is null;
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

  cupom := nullif(trim(coalesce(p->>'cupom', '')), '');
  if cupom is not null then
    select * into cp from cupons where upper(codigo) = upper(cupom) and ativo;
    if cp.id is not null and cp.uso_por_cliente is not null then
      select count(*) into usados from pedidos
        where cliente_telefone = telefone and upper(cupom_codigo) = upper(cp.codigo) and status <> 'cancelado';
      if usados >= cp.uso_por_cliente then raise exception 'Este cupom já foi usado neste celular.'; end if;
    end if;
  end if;

  -- ===== fidelidade / cashback =====
  p := p - '_cashback_saldo' - '_fidelidade_nivel' - '_fidelidade_pct';   -- anon não injeta chaves internas
  select fidelidade into v_fid from config where id = 1;
  if coalesce((v_fid->>'ativo')::boolean, false) then
    v_niv := public.fidelidade_nivel(telefone);
    p := p || jsonb_build_object('_fidelidade_nivel', v_niv->>'nome', '_fidelidade_pct', v_niv->'pct');
    if coalesce((p->>'usar_cashback')::boolean, false) then
      v_ver := public.fidelidade_verificar_pin(telefone, coalesce(p->>'pin', ''));
      -- PIN errado: devolve erro SEM raise, para o contador de tentativas persistir (o front checa data.erro)
      if not (v_ver->>'ok')::boolean then return jsonb_build_object('ok', false, 'erro', v_ver->>'motivo', 'pin', v_ver); end if;
      perform public.fidelidade_expirar(telefone);
      v_saldo := public.fidelidade_saldo_interno(telefone);
      if v_saldo < coalesce((v_fid->>'min_resgate')::numeric, 0) then
        raise exception 'Saldo de cashback (R$ %) abaixo do mínimo para usar (R$ %).', to_char(greatest(v_saldo, 0), 'FM999G990D00'), to_char((v_fid->>'min_resgate')::numeric, 'FM999G990D00');
      end if;
      p := p || jsonb_build_object('_cashback_saldo', v_saldo);
    end if;
  end if;

  resultado := public.criar_pedido_base(p);

  total := (resultado->>'total')::numeric;        -- já com cashback descontado
  troco := (resultado->>'troco_para')::numeric;
  if troco is not null and (troco < total or troco > total + 500) then
    raise exception 'Troco para R$ % não confere com o total de R$ %.', to_char(troco, 'FM999G990D00'), to_char(total, 'FM999G990D00');
  end if;

  -- débito FIFO do cashback usado (mesma transação do INSERT: se falhar, o pedido não existe)
  v_cb := coalesce((resultado->>'cashback_usado')::numeric, 0);
  if v_cb > 0 then
    perform public.fidelidade_debitar(telefone, v_cb, 'debito', (resultado->>'id')::uuid, 'Usado no pedido #' || (resultado->>'numero'));
  end if;

  if p->>'tipo_entrega' = 'retirada' then
    select id into v_loja from lojas where ativo and aceita_retirada and slug = coalesce(nullif(p->>'loja', ''), (select slug from lojas where principal));
    if v_loja is null then raise exception 'Escolha uma loja válida para retirada.'; end if;
  else
    select le.id into v_loja from loja_entrega(nullif(p->'endereco'->>'lat', '')::double precision, nullif(p->'endereco'->>'lng', '')::double precision) le;
    v_loja := coalesce(v_loja, (select id from lojas where principal));
  end if;
  update pedidos set origem_ip = ip, loja_id = v_loja where id = (resultado->>'id')::uuid;
  resultado := public.consultar_pedido((resultado->>'id')::uuid);
  return resultado;
end $$;

-- ---------------------------------------------------------------
-- 7) Crédito e estornos (trigger BEFORE UPDATE em pedidos)
-- ---------------------------------------------------------------
create or replace function public.tg_pedidos_fidelidade() returns trigger
language plpgsql security definer set search_path = public as $$
declare base numeric; cred record; falta numeric; r record; usa numeric;
begin
  -- 7a) crédito: virou 'entregue' (ou ficou pago depois de entregue), pagamento ok, ainda não creditado
  if new.status = 'entregue' and new.pagamento_status in ('pago','na_entrega') and new.cashback_ganho is null
     and (old.status is distinct from new.status or old.pagamento_status is distinct from new.pagamento_status) then
    base := greatest(new.subtotal - new.desconto - new.cashback_usado, 0);
    if coalesce(new.fidelidade_pct, 0) > 0 then
      new.cashback_ganho := trunc(base * new.fidelidade_pct / 100, 2);   -- trunca no centavo
      if new.cashback_ganho > 0 then
        perform public.fidelidade_creditar(new.cliente_telefone, new.cashback_ganho, 'credito', new.id,
          'Cashback ' || rtrim(rtrim(new.fidelidade_pct::text, '0'), '.') || '% do pedido #' || new.numero);
      end if;
    else
      new.cashback_ganho := 0;    -- programa inativo no pedido: marca como processado
    end if;
  end if;

  -- 7b) cancelamento
  if new.status = 'cancelado' and old.status is distinct from 'cancelado' then
    -- estorno do crédito ganho (pedido cancelado depois de entregue): zera o crédito; se já foi gasto,
    -- debita de outros créditos (FIFO) e o que faltar vira débito pendente (saldo negativo)
    if coalesce(new.cashback_ganho, 0) > 0
       and not exists (select 1 from public.fidelidade_movimentos where pedido_id = new.id and tipo = 'estorno_credito') then
      falta := new.cashback_ganho;
      select id, restante into cred from public.fidelidade_movimentos
       where pedido_id = new.id and tipo = 'credito' order by id limit 1 for update;
      if cred.id is not null and cred.restante > 0 then
        usa := least(cred.restante, falta);
        update public.fidelidade_movimentos set restante = restante - usa where id = cred.id;
        falta := falta - usa;
      end if;
      for r in select id, restante from public.fidelidade_movimentos
                where telefone = new.cliente_telefone and restante > 0 and expira_em > now() order by expira_em, id for update loop
        exit when falta <= 0;
        usa := least(r.restante, falta);
        update public.fidelidade_movimentos set restante = restante - usa where id = r.id;
        falta := falta - usa;
      end loop;
      if falta > 0 then
        insert into public.clientes (telefone) values (new.cliente_telefone) on conflict (telefone) do nothing;
        update public.clientes set debito_pendente = debito_pendente + falta, atualizado_em = now() where telefone = new.cliente_telefone;
      end if;
      insert into public.fidelidade_movimentos (telefone, tipo, valor, restante, pedido_id, descricao)
        values (new.cliente_telefone, 'estorno_credito', -new.cashback_ganho, 0, new.id, 'Estorno: pedido #' || new.numero || ' cancelado');
    end if;
    -- devolução do cashback usado: novo crédito com nova validade (uma vez só)
    if new.cashback_usado > 0 and not exists (select 1 from public.fidelidade_movimentos where pedido_id = new.id and tipo = 'estorno_debito') then
      perform public.fidelidade_creditar(new.cliente_telefone, new.cashback_usado, 'estorno_debito', new.id,
        'Devolução: pedido #' || new.numero || ' cancelado');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists pedidos_fidelidade on public.pedidos;
create trigger pedidos_fidelidade before update of status, pagamento_status on public.pedidos
  for each row execute function public.tg_pedidos_fidelidade();

-- ---------------------------------------------------------------
-- 8) consultar_pedido: + fidelidade_ativa, cashback_previsto, tem_pin (cashback_usado/ganho, nivel, pct vêm do to_jsonb)
-- ---------------------------------------------------------------
create or replace function public.consultar_pedido(p_id uuid) returns jsonb
language sql security definer set search_path = public stable as $$
  select (to_jsonb(pd) - 'cliente_email' - 'origem_ip' - 'saipos_status' - 'saipos_sale_number' - 'saipos_enviado_em' - 'saipos_erro' - 'saipos_tentativas')
    || jsonb_build_object(
      'itens', (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]') from public.pedido_itens i where i.pedido_id = pd.id),
      'loja', (select jsonb_build_object('slug', l.slug, 'nome', l.nome, 'endereco', l.endereco) from public.lojas l where l.id = pd.loja_id),
      'pix', case when pd.pagamento = 'pix' then (select jsonb_build_object('chave', c.chave_pix, 'nome', c.pix_nome) from public.config c where c.id = 1) else null end,
      'whatsapp', (select c.whatsapp from public.config c where c.id = 1),
      'fidelidade_ativa', (select coalesce((c.fidelidade->>'ativo')::boolean, false) from public.config c where c.id = 1),
      'cashback_previsto', case when pd.cashback_ganho is null and pd.status <> 'cancelado' and coalesce(pd.fidelidade_pct, 0) > 0
          then trunc(greatest(pd.subtotal - pd.desconto - pd.cashback_usado, 0) * pd.fidelidade_pct / 100, 2) else null end,
      'tem_pin', exists (select 1 from public.clientes cl where cl.telefone = pd.cliente_telefone and cl.pin_hash is not null))
  from public.pedidos pd where pd.id = p_id;
$$;

-- ---------------------------------------------------------------
-- 9) Grants
-- ---------------------------------------------------------------
revoke all on function public.fidelidade_expirar(text) from public, anon, authenticated;
revoke all on function public.fidelidade_saldo_interno(text) from public, anon, authenticated;
revoke all on function public.fidelidade_nivel(text) from public, anon, authenticated;
revoke all on function public.fidelidade_creditar(text, numeric, text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.fidelidade_debitar(text, numeric, text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.fidelidade_verificar_pin(text, text) from public, anon, authenticated;
revoke all on function public.fidelidade_pin_valido(text) from public, anon, authenticated;
revoke all on function public.tg_pedidos_fidelidade() from public, anon, authenticated;
revoke all on function public.fidelidade_resumo(text) from public;
revoke all on function public.fidelidade_saldo(text, text) from public;
revoke all on function public.fidelidade_criar_pin(uuid, text) from public;
revoke all on function public.fidelidade_trocar_pin(text, text, text) from public;
revoke all on function public.fidelidade_ajustar(text, numeric, text) from public, anon;
revoke all on function public.fidelidade_cliente(text) from public, anon;
revoke all on function public.criar_pedido(jsonb) from public;
revoke all on function public.consultar_pedido(uuid) from public;
grant execute on function public.fidelidade_resumo(text) to anon, authenticated;
grant execute on function public.fidelidade_saldo(text, text) to anon, authenticated;
grant execute on function public.fidelidade_criar_pin(uuid, text) to anon, authenticated;
grant execute on function public.fidelidade_trocar_pin(text, text, text) to anon, authenticated;
grant execute on function public.fidelidade_ajustar(text, numeric, text) to authenticated;
grant execute on function public.fidelidade_cliente(text) to authenticated;
grant execute on function public.criar_pedido(jsonb) to anon, authenticated;
grant execute on function public.consultar_pedido(uuid) to anon, authenticated;
