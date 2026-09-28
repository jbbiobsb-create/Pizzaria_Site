-- Sesconetto's Pizzeria — esquema inicial
-- Catálogo público (leitura anônima), pedidos via funções (RPC) e painel para usuários autenticados.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Configuração da loja (linha única)
-- ---------------------------------------------------------------
create table public.config (
  id int primary key default 1 check (id = 1),
  nome text not null,
  nome_completo text,
  slogan text,
  telefone text,
  whatsapp text,               -- só dígitos, com DDI: 5561...
  instagram text,
  endereco jsonb,              -- {rua, numero, complemento, bairro, cidade, uf, cep}
  lat double precision,
  lng double precision,
  horario jsonb,               -- {"seg":["18:00","23:30"], ...}
  forcar_fechada boolean not null default false,
  aceita_entrega boolean not null default true,
  aceita_retirada boolean not null default true,
  tempo_entrega_min int default 40,
  tempo_entrega_max int default 60,
  tempo_retirada_min int default 30,
  tempo_retirada_max int default 50,
  pedido_minimo numeric(10,2) not null default 0,
  faixas_taxa jsonb,           -- [{"ate_km":1,"taxa":7.9}, ...] ordenado
  taxa_padrao numeric(10,2) not null default 9.90,
  raio_entrega_km numeric(6,2) not null default 8,
  pagamentos text[] not null default '{pix,cartao_entrega,dinheiro}',
  chave_pix text,
  pix_nome text,
  sobre_massa text,
  aviso_preparo text,
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------
create table public.categorias (
  id serial primary key,
  slug text not null unique,
  nome text not null,
  tipo text not null default 'simples' check (tipo in ('pizza','simples')),
  icone text,
  ordem int not null default 0,
  ativo boolean not null default true
);

create table public.tamanhos (
  id serial primary key,
  slug text not null unique,
  nome text not null,
  fatias int not null,
  max_sabores int not null default 1,
  ordem int not null default 0,
  ativo boolean not null default true
);

create table public.sabores (
  id serial primary key,
  slug text not null unique,
  nome text not null,
  descricao text,
  tipo text not null default 'salgada' check (tipo in ('salgada','doce')),
  imagem_url text,
  tags text[] not null default '{}',
  disponivel boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create table public.sabor_precos (
  sabor_id int not null references public.sabores(id) on delete cascade,
  tamanho_id int not null references public.tamanhos(id) on delete cascade,
  preco numeric(10,2) not null,
  primary key (sabor_id, tamanho_id)
);

create table public.produtos (
  id serial primary key,
  slug text not null unique,
  categoria_id int not null references public.categorias(id),
  tipo text not null default 'simples' check (tipo in ('simples','combo')),
  nome text not null,
  descricao text,
  preco numeric(10,2) not null default 0,
  imagem_url text,
  tags text[] not null default '{}',
  passos jsonb not null default '[]',   -- combos: [{titulo, tipo:'produto', min, max, opcoes:[slug]}]
  disponivel boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create table public.cupons (
  id serial primary key,
  codigo text not null unique,
  descricao text,
  tipo text not null check (tipo in ('percentual','valor')),
  valor numeric(10,2) not null,
  minimo numeric(10,2) not null default 0,
  uso_max int,
  usos int not null default 0,
  validade timestamptz,
  ativo boolean not null default true
);

-- ---------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  status text not null default 'recebido'
    check (status in ('recebido','confirmado','preparando','no_forno','saiu_entrega','pronto_retirada','entregue','cancelado')),
  status_historico jsonb not null default '[]',
  cliente_nome text not null,
  cliente_telefone text not null,          -- só dígitos
  cliente_email text,
  tipo_entrega text not null check (tipo_entrega in ('entrega','retirada')),
  endereco jsonb,                          -- {cep, rua, numero, complemento, bairro, cidade, uf, referencia, lat, lng, distancia_km}
  agendado_para timestamptz,
  observacoes text,
  pagamento text not null check (pagamento in ('pix','cartao_entrega','dinheiro')),
  troco_para numeric(10,2),
  cupom_codigo text,
  subtotal numeric(10,2) not null,
  desconto numeric(10,2) not null default 0,
  taxa_entrega numeric(10,2) not null default 0,
  taxa_a_confirmar boolean not null default false,
  total numeric(10,2) not null,
  tempo_min int,
  tempo_max int,
  origem text not null default 'site',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pedidos_telefone_idx on public.pedidos (cliente_telefone, criado_em desc);
create index pedidos_status_idx on public.pedidos (status, criado_em desc);

create table public.pedido_itens (
  id serial primary key,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  tipo text not null check (tipo in ('pizza','produto')),
  nome text not null,                     -- ex.: "Pizza Grande — Florença / Roma"
  detalhes jsonb not null default '{}',   -- {tamanho, sabores:[{slug,nome}], escolhas:[{slug,nome}], observacao}
  quantidade int not null check (quantidade > 0),
  preco_unitario numeric(10,2) not null,
  subtotal numeric(10,2) not null
);
create index pedido_itens_pedido_idx on public.pedido_itens (pedido_id);

-- histórico automático de status
create or replace function public.tg_pedidos_status() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_historico := coalesce(new.status_historico, '[]'::jsonb)
      || jsonb_build_object('status', new.status, 'em', now());
  end if;
  return new;
end $$;
create trigger pedidos_status before insert or update on public.pedidos
  for each row execute function public.tg_pedidos_status();

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table public.config enable row level security;
alter table public.categorias enable row level security;
alter table public.tamanhos enable row level security;
alter table public.sabores enable row level security;
alter table public.sabor_precos enable row level security;
alter table public.produtos enable row level security;
alter table public.cupons enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;

-- leitura pública do catálogo
create policy "config: leitura publica" on public.config for select to anon, authenticated using (true);
create policy "categorias: leitura publica" on public.categorias for select to anon, authenticated using (true);
create policy "tamanhos: leitura publica" on public.tamanhos for select to anon, authenticated using (true);
create policy "sabores: leitura publica" on public.sabores for select to anon, authenticated using (true);
create policy "sabor_precos: leitura publica" on public.sabor_precos for select to anon, authenticated using (true);
create policy "produtos: leitura publica" on public.produtos for select to anon, authenticated using (true);

-- painel (usuário autenticado = equipe da pizzaria) faz tudo
create policy "config: equipe" on public.config for all to authenticated using (true) with check (true);
create policy "categorias: equipe" on public.categorias for all to authenticated using (true) with check (true);
create policy "tamanhos: equipe" on public.tamanhos for all to authenticated using (true) with check (true);
create policy "sabores: equipe" on public.sabores for all to authenticated using (true) with check (true);
create policy "sabor_precos: equipe" on public.sabor_precos for all to authenticated using (true) with check (true);
create policy "produtos: equipe" on public.produtos for all to authenticated using (true) with check (true);
create policy "cupons: equipe" on public.cupons for all to authenticated using (true) with check (true);
create policy "pedidos: equipe" on public.pedidos for all to authenticated using (true) with check (true);
create policy "pedido_itens: equipe" on public.pedido_itens for all to authenticated using (true) with check (true);

-- realtime para o painel
alter publication supabase_realtime add table public.pedidos;

-- ---------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------
create or replace function public.so_digitos(t text) returns text
language sql immutable as $$ select regexp_replace(coalesce(t,''), '\D', '', 'g') $$;

create or replace function public.distancia_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- taxa de entrega pela distância (faixas na config)
create or replace function public.taxa_por_distancia(km double precision) returns numeric
language plpgsql stable as $$
declare c public.config; f jsonb;
begin
  select * into c from public.config where id = 1;
  if km is null then return c.taxa_padrao; end if;
  if km > c.raio_entrega_km then return null; end if;   -- fora da área
  for f in select * from jsonb_array_elements(coalesce(c.faixas_taxa, '[]'::jsonb)) loop
    if km <= (f->>'ate_km')::numeric then return (f->>'taxa')::numeric; end if;
  end loop;
  return c.taxa_padrao;
end $$;

-- está aberta agora? (horário de Brasília)
create or replace function public.loja_aberta() returns boolean
language plpgsql stable as $$
declare c public.config; dia text; faixa jsonb; agora time; ini time; fim time;
begin
  select * into c from public.config where id = 1;
  if c is null or c.forcar_fechada then return false; end if;
  dia := (array['dom','seg','ter','qua','qui','sex','sab'])[extract(dow from (now() at time zone 'America/Sao_Paulo'))::int + 1];
  faixa := c.horario -> dia;
  if faixa is null then return false; end if;
  agora := (now() at time zone 'America/Sao_Paulo')::time;
  ini := (faixa->>0)::time; fim := (faixa->>1)::time;
  if fim < ini then return agora >= ini or agora <= fim; end if;
  return agora >= ini and agora <= fim;
end $$;

-- status público da loja (usado na home)
create or replace function public.status_loja() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'aberta', public.loja_aberta(),
    'forcar_fechada', c.forcar_fechada,
    'horario', c.horario,
    'aceita_entrega', c.aceita_entrega,
    'aceita_retirada', c.aceita_retirada,
    'tempo_entrega', array[c.tempo_entrega_min, c.tempo_entrega_max],
    'tempo_retirada', array[c.tempo_retirada_min, c.tempo_retirada_max]
  ) from public.config c where c.id = 1;
$$;

-- cardápio completo em um JSON
create or replace function public.cardapio() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'config', (select to_jsonb(c) - 'chave_pix' from public.config c where id = 1),
    'aberta', public.loja_aberta(),
    'tamanhos', (select coalesce(jsonb_agg(to_jsonb(t) order by t.ordem), '[]') from public.tamanhos t where t.ativo),
    'categorias', (select coalesce(jsonb_agg(to_jsonb(c) order by c.ordem), '[]') from public.categorias c where c.ativo),
    'sabores', (select coalesce(jsonb_agg(
        (to_jsonb(s) || jsonb_build_object('precos',
          (select coalesce(jsonb_object_agg(t.slug, sp.preco), '{}')
             from public.sabor_precos sp join public.tamanhos t on t.id = sp.tamanho_id
            where sp.sabor_id = s.id and t.ativo)))
        order by s.ordem, s.nome), '[]') from public.sabores s),
    'produtos', (select coalesce(jsonb_agg(
        (to_jsonb(p) || jsonb_build_object('categoria', c.slug)) order by p.ordem, p.nome), '[]')
        from public.produtos p join public.categorias c on c.id = p.categoria_id where c.ativo)
  );
$$;

-- calcula taxa para um ponto (cliente chama antes do checkout)
create or replace function public.calcular_entrega(p_lat double precision, p_lng double precision) returns jsonb
language plpgsql stable as $$
declare c public.config; km double precision; taxa numeric;
begin
  select * into c from public.config where id = 1;
  if p_lat is null or p_lng is null then
    return jsonb_build_object('ok', true, 'distancia_km', null, 'taxa', c.taxa_padrao, 'a_confirmar', true);
  end if;
  km := public.distancia_km(c.lat, c.lng, p_lat, p_lng);
  taxa := public.taxa_por_distancia(km);
  if taxa is null then
    return jsonb_build_object('ok', false, 'distancia_km', round(km::numeric, 1), 'motivo', 'fora_da_area', 'raio_km', c.raio_entrega_km);
  end if;
  return jsonb_build_object('ok', true, 'distancia_km', round(km::numeric, 1), 'taxa', taxa, 'a_confirmar', false);
end $$;

-- valida cupom
create or replace function public.validar_cupom(p_codigo text, p_subtotal numeric) returns jsonb
language plpgsql stable as $$
declare cp public.cupons; d numeric;
begin
  select * into cp from public.cupons where upper(codigo) = upper(trim(p_codigo)) and ativo;
  if cp is null then return jsonb_build_object('ok', false, 'motivo', 'Cupom não encontrado.'); end if;
  if cp.validade is not null and cp.validade < now() then return jsonb_build_object('ok', false, 'motivo', 'Cupom vencido.'); end if;
  if cp.uso_max is not null and cp.usos >= cp.uso_max then return jsonb_build_object('ok', false, 'motivo', 'Cupom esgotado.'); end if;
  if p_subtotal < cp.minimo then return jsonb_build_object('ok', false, 'motivo', 'Pedido mínimo para este cupom: R$ ' || to_char(cp.minimo, 'FM999G990D00')); end if;
  d := case when cp.tipo = 'percentual' then round(p_subtotal * cp.valor / 100, 2) else cp.valor end;
  d := least(d, p_subtotal);
  return jsonb_build_object('ok', true, 'codigo', cp.codigo, 'desconto', d, 'descricao', cp.descricao);
end $$;

-- ---------------------------------------------------------------
-- Criar pedido (preços recalculados no servidor)
-- ---------------------------------------------------------------
create or replace function public.criar_pedido(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.config;
  it jsonb; s jsonb; esc jsonb;
  tam public.tamanhos; sab public.sabores; prod public.produtos; opc public.produtos;
  preco numeric; maior numeric; qtd int;
  subtotal numeric := 0; desconto numeric := 0; taxa numeric := 0; a_confirmar boolean := false;
  km double precision; lat double precision; lng double precision;
  tipo_entrega text; pagamento text; telefone text; nome text; agendado timestamptz;
  cupom jsonb; cupom_codigo text;
  ped public.pedidos;
  itens_calc jsonb := '[]';
  nomes text; slugs_sab jsonb; escolhas jsonb;
  tmin int; tmax int;
begin
  select * into c from public.config where id = 1;

  nome := trim(coalesce(p->'cliente'->>'nome', ''));
  telefone := so_digitos(p->'cliente'->>'telefone');
  if length(nome) < 2 then raise exception 'Informe seu nome.'; end if;
  if length(telefone) < 10 then raise exception 'Informe um celular válido com DDD.'; end if;

  tipo_entrega := p->>'tipo_entrega';
  if tipo_entrega not in ('entrega','retirada') then raise exception 'Escolha entrega ou retirada.'; end if;
  if tipo_entrega = 'entrega' and not c.aceita_entrega then raise exception 'No momento não estamos entregando.'; end if;
  if tipo_entrega = 'retirada' and not c.aceita_retirada then raise exception 'No momento não estamos aceitando retirada.'; end if;

  pagamento := p->>'pagamento';
  if pagamento is null or not (pagamento = any (c.pagamentos)) then raise exception 'Forma de pagamento inválida.'; end if;

  agendado := nullif(p->>'agendado_para', '')::timestamptz;
  if agendado is null and not public.loja_aberta() then
    raise exception 'Estamos fechados agora. Você pode agendar seu pedido para quando abrirmos.';
  end if;
  if agendado is not null and agendado < now() + interval '30 minutes' then
    raise exception 'O agendamento precisa ser com pelo menos 30 minutos de antecedência.';
  end if;

  if jsonb_array_length(coalesce(p->'itens', '[]')) = 0 then raise exception 'Seu pedido está vazio.'; end if;

  -- itens
  for it in select * from jsonb_array_elements(p->'itens') loop
    qtd := greatest(1, least(20, coalesce((it->>'quantidade')::int, 1)));
    if it->>'tipo' = 'pizza' then
      select * into tam from public.tamanhos where slug = it->>'tamanho' and ativo;
      if tam is null then raise exception 'Tamanho inválido.'; end if;
      slugs_sab := coalesce(it->'sabores', '[]');
      if jsonb_array_length(slugs_sab) < 1 or jsonb_array_length(slugs_sab) > tam.max_sabores then
        raise exception 'A pizza % aceita até % sabor(es).', tam.nome, tam.max_sabores;
      end if;
      maior := 0; nomes := ''; escolhas := '[]';
      for s in select * from jsonb_array_elements(slugs_sab) loop
        select * into sab from public.sabores where slug = (s #>> '{}') and disponivel;
        if sab is null then raise exception 'Sabor indisponível: %', (s #>> '{}'); end if;
        select sp.preco into preco from public.sabor_precos sp where sp.sabor_id = sab.id and sp.tamanho_id = tam.id;
        if preco is null then raise exception 'O sabor % não está disponível no tamanho %.', sab.nome, tam.nome; end if;
        maior := greatest(maior, preco);
        nomes := nomes || case when nomes = '' then '' else ' / ' end || sab.nome;
        escolhas := escolhas || jsonb_build_object('slug', sab.slug, 'nome', sab.nome);
      end loop;
      itens_calc := itens_calc || jsonb_build_object(
        'tipo', 'pizza',
        'nome', 'Pizza ' || tam.nome || ' (' || tam.fatias || ' fatias) — ' || nomes,
        'detalhes', jsonb_build_object('tamanho', tam.slug, 'tamanho_nome', tam.nome, 'sabores', escolhas, 'observacao', it->>'observacao'),
        'quantidade', qtd, 'preco_unitario', maior, 'subtotal', maior * qtd);
      subtotal := subtotal + maior * qtd;
    elsif it->>'tipo' = 'produto' then
      select * into prod from public.produtos where slug = it->>'slug' and disponivel;
      if prod is null then raise exception 'Produto indisponível: %', it->>'slug'; end if;
      preco := prod.preco; escolhas := '[]';
      for esc in select * from jsonb_array_elements(coalesce(it->'escolhas', '[]')) loop
        select * into opc from public.produtos where slug = (esc #>> '{}');
        if opc is null then raise exception 'Opção inválida no combo.'; end if;
        escolhas := escolhas || jsonb_build_object('slug', opc.slug, 'nome', opc.nome);
      end loop;
      itens_calc := itens_calc || jsonb_build_object(
        'tipo', 'produto',
        'nome', prod.nome,
        'detalhes', jsonb_build_object('slug', prod.slug, 'escolhas', escolhas, 'observacao', it->>'observacao'),
        'quantidade', qtd, 'preco_unitario', preco, 'subtotal', preco * qtd);
      subtotal := subtotal + preco * qtd;
    else
      raise exception 'Item inválido.';
    end if;
  end loop;

  if subtotal < c.pedido_minimo then
    raise exception 'Pedido mínimo: R$ %', to_char(c.pedido_minimo, 'FM999G990D00');
  end if;

  -- entrega
  if tipo_entrega = 'entrega' then
    if coalesce(p->'endereco'->>'rua', '') = '' or coalesce(p->'endereco'->>'numero', '') = '' then
      raise exception 'Informe o endereço de entrega com número.';
    end if;
    lat := nullif(p->'endereco'->>'lat', '')::double precision;
    lng := nullif(p->'endereco'->>'lng', '')::double precision;
    if lat is not null and lng is not null then
      km := public.distancia_km(c.lat, c.lng, lat, lng);
      taxa := public.taxa_por_distancia(km);
      if taxa is null then raise exception 'Endereço fora da nossa área de entrega (até % km).', c.raio_entrega_km; end if;
    else
      taxa := c.taxa_padrao; a_confirmar := true;
    end if;
    tmin := c.tempo_entrega_min; tmax := c.tempo_entrega_max;
  else
    tmin := c.tempo_retirada_min; tmax := c.tempo_retirada_max;
  end if;

  -- cupom
  cupom_codigo := nullif(trim(coalesce(p->>'cupom', '')), '');
  if cupom_codigo is not null then
    cupom := public.validar_cupom(cupom_codigo, subtotal);
    if not (cupom->>'ok')::boolean then raise exception '%', cupom->>'motivo'; end if;
    desconto := (cupom->>'desconto')::numeric;
    cupom_codigo := cupom->>'codigo';
    update public.cupons set usos = usos + 1 where codigo = cupom_codigo;
  end if;

  insert into public.pedidos (cliente_nome, cliente_telefone, cliente_email, tipo_entrega, endereco, agendado_para,
      observacoes, pagamento, troco_para, cupom_codigo, subtotal, desconto, taxa_entrega, taxa_a_confirmar, total, tempo_min, tempo_max)
  values (nome, telefone, nullif(trim(coalesce(p->'cliente'->>'email','')), ''), tipo_entrega,
      case when tipo_entrega = 'entrega' then (p->'endereco') || jsonb_build_object('distancia_km', case when km is null then null else round(km::numeric, 1) end) else null end,
      agendado, nullif(trim(coalesce(p->>'observacoes','')), ''), pagamento,
      case when pagamento = 'dinheiro' then nullif(p->>'troco_para','')::numeric else null end,
      cupom_codigo, subtotal, desconto, taxa, a_confirmar, subtotal - desconto + taxa, tmin, tmax)
  returning * into ped;

  insert into public.pedido_itens (pedido_id, tipo, nome, detalhes, quantidade, preco_unitario, subtotal)
  select ped.id, i->>'tipo', i->>'nome', i->'detalhes', (i->>'quantidade')::int, (i->>'preco_unitario')::numeric, (i->>'subtotal')::numeric
  from jsonb_array_elements(itens_calc) i;

  return public.consultar_pedido(ped.id);
end $$;

-- ---------------------------------------------------------------
-- Consultar pedido (o UUID é o segredo do link)
-- ---------------------------------------------------------------
create or replace function public.consultar_pedido(p_id uuid) returns jsonb
language sql security definer set search_path = public stable as $$
  select (to_jsonb(pd) - 'cliente_email')
    || jsonb_build_object(
      'itens', (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]') from public.pedido_itens i where i.pedido_id = pd.id),
      'pix', case when pd.pagamento = 'pix' then (select jsonb_build_object('chave', c.chave_pix, 'nome', c.pix_nome) from public.config c where c.id = 1) else null end,
      'whatsapp', (select c.whatsapp from public.config c where c.id = 1))
  from public.pedidos pd where pd.id = p_id;
$$;

-- pedidos recentes de um telefone (últimos 30 dias)
create or replace function public.pedidos_por_telefone(p_telefone text) returns jsonb
language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', pd.id, 'numero', pd.numero, 'status', pd.status, 'total', pd.total,
      'tipo_entrega', pd.tipo_entrega, 'criado_em', pd.criado_em,
      'resumo', (select string_agg(i.quantidade || 'x ' || i.nome, ', ') from public.pedido_itens i where i.pedido_id = pd.id))
    order by pd.criado_em desc), '[]')
  from (select * from public.pedidos where cliente_telefone = so_digitos(p_telefone) and criado_em > now() - interval '30 days' order by criado_em desc limit 10) pd;
$$;

-- permissões das funções para o site (anon)
revoke all on function public.criar_pedido(jsonb) from public;
grant execute on function public.criar_pedido(jsonb) to anon, authenticated;
grant execute on function public.consultar_pedido(uuid) to anon, authenticated;
grant execute on function public.pedidos_por_telefone(text) to anon, authenticated;
grant execute on function public.cardapio() to anon, authenticated;
grant execute on function public.status_loja() to anon, authenticated;
grant execute on function public.calcular_entrega(double precision, double precision) to anon, authenticated;
grant execute on function public.validar_cupom(text, numeric) to anon, authenticated;
grant execute on function public.loja_aberta() to anon, authenticated;
