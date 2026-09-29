-- Três lojas: entrega sai da loja mais próxima que alcança o endereço; na retirada o cliente escolhe a loja.
-- Horário, taxas por km, raio e tempos continuam na tabela config (iguais para as três por enquanto).
-- Cada loja pode ter seu próprio código no canal Saipos (saipos_cod_store); vazio = usa o SAIPOS_COD_STORE do Vault.

create table public.lojas (
  id serial primary key,
  slug text not null unique,
  nome text not null,
  endereco jsonb not null,           -- {rua, numero, complemento, bairro, cidade, uf, cep}
  lat double precision not null,
  lng double precision not null,
  aceita_entrega boolean not null default true,
  aceita_retirada boolean not null default true,
  ativo boolean not null default true,
  principal boolean not null default false,   -- usada quando não dá para localizar o endereço
  saipos_cod_store text,
  ordem int not null default 0
);
create unique index lojas_uma_principal on public.lojas (principal) where principal;
alter table public.lojas enable row level security;
create policy "lojas: equipe" on public.lojas for all to authenticated using (public.is_equipe()) with check (public.is_equipe());
-- o site lê as lojas pela função cardapio() (sem expor o código Saipos)

insert into public.lojas (slug, nome, endereco, lat, lng, principal, ordem)
select 'vicente-pires', 'Vicente Pires', c.endereco, c.lat, c.lng, true, 1 from public.config c where c.id = 1;
insert into public.lojas (slug, nome, endereco, lat, lng, ordem) values
  ('asa-sul', 'Asa Sul', '{"rua":"CLS 105 Bloco B","numero":"","complemento":"","bairro":"Asa Sul","cidade":"Brasília","uf":"DF","cep":"70344-520"}', -15.8113569, -47.8975066, 2),
  ('sig', 'SIG', '{"rua":"SIG Quadra 8","numero":"Lotes 2265/2275","complemento":"","bairro":"Zona Industrial","cidade":"Brasília","uf":"DF","cep":"70610-480"}', -15.7953, -47.9167, 3);

alter table public.pedidos add column loja_id int references public.lojas(id);
create index pedidos_loja_idx on public.pedidos (loja_id, criado_em desc);
update public.pedidos set loja_id = (select id from public.lojas where principal) where loja_id is null;

-- loja que entrega mais perto do ponto (a verificação do raio fica com quem chama)
create or replace function public.loja_entrega(p_lat double precision, p_lng double precision)
returns table (id int, slug text, nome text, km double precision)
language sql stable set search_path = public as $$
  select l.id, l.slug, l.nome, public.distancia_km(l.lat, l.lng, p_lat, p_lng) as km
  from public.lojas l
  where l.ativo and l.aceita_entrega and p_lat is not null and p_lng is not null
  order by km limit 1;
$$;

-- taxa de entrega: distância até a loja mais próxima
create or replace function public.calcular_entrega(p_lat double precision, p_lng double precision) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.config; l record; taxa numeric; lp public.lojas;
begin
  select * into c from public.config where id = 1;
  select * into lp from public.lojas where lojas.principal;
  if p_lat is null or p_lng is null then
    return jsonb_build_object('ok', true, 'distancia_km', null, 'taxa', c.taxa_padrao, 'a_confirmar', true,
      'loja', jsonb_build_object('slug', lp.slug, 'nome', lp.nome));
  end if;
  select * into l from public.loja_entrega(p_lat, p_lng);
  if l.id is null then return jsonb_build_object('ok', false, 'motivo', 'sem_loja'); end if;
  taxa := public.taxa_por_distancia(l.km);
  if taxa is null then
    return jsonb_build_object('ok', false, 'distancia_km', round(l.km::numeric, 1), 'motivo', 'fora_da_area', 'raio_km', c.raio_entrega_km);
  end if;
  return jsonb_build_object('ok', true, 'distancia_km', round(l.km::numeric, 1), 'taxa', taxa, 'a_confirmar', false,
    'loja', jsonb_build_object('slug', l.slug, 'nome', l.nome));
end $$;
-- lojas só é legível pela equipe; o site lê via funções (sem o código Saipos)
alter function public.loja_entrega(double precision, double precision) security definer;

-- criar_pedido_base calcula a taxa pela distância até a loja mais próxima (antes: até o endereço da config)
do $do$
declare def text := pg_get_functiondef('public.criar_pedido_base(jsonb)'::regprocedure);
begin
  if position('km := public.distancia_km(c.lat, c.lng, lat, lng);' in def) = 0 then raise exception 'trecho de distância não encontrado'; end if;
  execute replace(def, 'km := public.distancia_km(c.lat, c.lng, lat, lng);', 'km := (select le.km from public.loja_entrega(lat, lng) le);');
end $do$;

-- criar_pedido: define a loja do pedido (entrega = mais próxima; retirada = escolhida pelo cliente)
do $do$
declare def text := pg_get_functiondef('public.criar_pedido(jsonb)'::regprocedure);
begin
  if position('update pedidos set origem_ip = ip where id = (resultado->>''id'')::uuid;' in def) = 0 then raise exception 'trecho do update não encontrado'; end if;
  def := replace(def, 'agendado timestamptz; resultado jsonb; total numeric; troco numeric;',
    'agendado timestamptz; resultado jsonb; total numeric; troco numeric; v_loja int;');
  def := replace(def, 'update pedidos set origem_ip = ip where id = (resultado->>''id'')::uuid;',
$r$if p->>'tipo_entrega' = 'retirada' then
    select id into v_loja from lojas where ativo and aceita_retirada and slug = coalesce(nullif(p->>'loja', ''), (select slug from lojas where principal));
    if v_loja is null then raise exception 'Escolha uma loja válida para retirada.'; end if;
  else
    select le.id into v_loja from loja_entrega(nullif(p->'endereco'->>'lat', '')::double precision, nullif(p->'endereco'->>'lng', '')::double precision) le;
    v_loja := coalesce(v_loja, (select id from lojas where principal));
  end if;
  update pedidos set origem_ip = ip, loja_id = v_loja where id = (resultado->>'id')::uuid;
  resultado := public.consultar_pedido((resultado->>'id')::uuid);$r$);
  execute def;
end $do$;

-- consulta pública: inclui a loja do pedido
create or replace function public.consultar_pedido(p_id uuid) returns jsonb
language sql security definer set search_path = public stable as $$
  select (to_jsonb(pd) - 'cliente_email' - 'origem_ip' - 'saipos_status' - 'saipos_sale_number' - 'saipos_enviado_em' - 'saipos_erro' - 'saipos_tentativas')
    || jsonb_build_object(
      'itens', (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]') from public.pedido_itens i where i.pedido_id = pd.id),
      'loja', (select jsonb_build_object('slug', l.slug, 'nome', l.nome, 'endereco', l.endereco) from public.lojas l where l.id = pd.loja_id),
      'pix', case when pd.pagamento = 'pix' then (select jsonb_build_object('chave', c.chave_pix, 'nome', c.pix_nome) from public.config c where c.id = 1) else null end,
      'whatsapp', (select c.whatsapp from public.config c where c.id = 1))
  from public.pedidos pd where pd.id = p_id;
$$;

-- cardápio: inclui as lojas (sem o código Saipos)
do $do$
declare def text := pg_get_functiondef('public.cardapio()'::regprocedure);
begin
  if position('''aberta'', public.loja_aberta(),' in def) = 0 then raise exception 'trecho do cardápio não encontrado'; end if;
  execute replace(def, '''aberta'', public.loja_aberta(),',
    '''aberta'', public.loja_aberta(),
    ''lojas'', (select coalesce(jsonb_agg(jsonb_build_object(''slug'', l.slug, ''nome'', l.nome, ''endereco'', l.endereco, ''lat'', l.lat, ''lng'', l.lng,
        ''aceita_entrega'', l.aceita_entrega, ''aceita_retirada'', l.aceita_retirada, ''principal'', l.principal) order by l.ordem), ''[]'') from public.lojas l where l.ativo),');
end $do$;

alter function public.cardapio() security definer;
