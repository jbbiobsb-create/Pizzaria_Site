-- Integração com o PDV Saipos (API de Pedidos)
-- Quando o pedido está pago (ou é pago na entrega), o banco chama a Edge Function "saipos-enviar",
-- que manda o pedido para a Saipos. A Saipos devolve as mudanças de status pela Edge Function "saipos-webhook".
-- Credenciais ficam no Vault (SAIPOS_ID_PARTNER, SAIPOS_SECRET, SAIPOS_COD_STORE, SAIPOS_BASE_URL,
-- SAIPOS_WEBHOOK_KEY, SAIPOS_INTERNAL_KEY, SUPABASE_FUNCTIONS_URL).

create extension if not exists pg_net;

-- ---------------------------------------------------------------
-- Pagamento e envio para a Saipos
-- ---------------------------------------------------------------
alter table public.pedidos
  add column pagamento_status text not null default 'pendente'
    check (pagamento_status in ('pendente','pago','na_entrega','estornado')),
  add column pago_em timestamptz,
  add column saipos_status text check (saipos_status in ('enviando','enviado','erro')),
  add column saipos_sale_number text,
  add column saipos_enviado_em timestamptz,
  add column saipos_erro text,
  add column saipos_tentativas int not null default 0;

-- avisos recebidos da Saipos (para conferência)
create table public.saipos_eventos (
  id bigint generated always as identity primary key,
  recebido_em timestamptz not null default now(),
  evento text,
  pedido_id uuid,
  payload jsonb,
  resultado text
);
alter table public.saipos_eventos enable row level security;
create policy "saipos_eventos: equipe" on public.saipos_eventos for select to authenticated using (true);

-- ---------------------------------------------------------------
-- Regras automáticas
-- ---------------------------------------------------------------
-- antes de gravar: situação do pagamento e marcação de envio
create or replace function public.tg_pedidos_saipos() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.pagamento_status := case when new.pagamento in ('cartao_entrega','dinheiro') then 'na_entrega' else 'pendente' end;
  end if;
  if new.pagamento_status = 'pago' and new.pago_em is null then new.pago_em := now(); end if;
  -- pronto para o PDV e ainda não enviado (ou equipe pediu reenvio limpando saipos_status)
  if new.saipos_status is null and new.pagamento_status in ('pago','na_entrega') and new.status <> 'cancelado' then
    new.saipos_status := 'enviando';
    new.saipos_erro := null;
  end if;
  return new;
end $$;
create trigger pedidos_saipos before insert or update on public.pedidos
  for each row execute function public.tg_pedidos_saipos();

-- chama a Edge Function de envio (assíncrono, não trava o pedido)
create or replace function public.saipos_disparar(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare url text; chave text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'SUPABASE_FUNCTIONS_URL';
  select decrypted_secret into chave from vault.decrypted_secrets where name = 'SAIPOS_INTERNAL_KEY';
  if url is null or chave is null then
    update public.pedidos set saipos_status = 'erro', saipos_erro = 'Integração Saipos não configurada no Vault.' where id = p_pedido;
    return;
  end if;
  perform net.http_post(
    url := url || '/saipos-enviar',
    body := jsonb_build_object('pedido_id', p_pedido),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-key', chave),
    timeout_milliseconds := 30000);
exception when others then
  -- nunca impedir o pedido por falha na integração
  raise warning 'saipos_disparar: %', sqlerrm;
end $$;
revoke all on function public.saipos_disparar(uuid) from public, anon, authenticated;

create or replace function public.tg_pedidos_saipos_disparar() returns trigger
language plpgsql as $$
begin
  if new.saipos_status = 'enviando' and (tg_op = 'INSERT' or old.saipos_status is distinct from 'enviando') then
    perform public.saipos_disparar(new.id);
  end if;
  return null;
end $$;
create trigger pedidos_saipos_disparar after insert or update on public.pedidos
  for each row execute function public.tg_pedidos_saipos_disparar();

-- segredos para as Edge Functions (só service_role)
create or replace function public.integracao_segredos() returns jsonb
language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}')
  from vault.decrypted_secrets where name like 'SAIPOS\_%' or name like 'MP\_%';
$$;
revoke all on function public.integracao_segredos() from public, anon, authenticated;
grant execute on function public.integracao_segredos() to service_role;

-- ---------------------------------------------------------------
-- Consulta pública do pedido sem dados internos da integração
-- ---------------------------------------------------------------
create or replace function public.consultar_pedido(p_id uuid) returns jsonb
language sql security definer set search_path = public stable as $$
  select (to_jsonb(pd) - 'cliente_email' - 'saipos_status' - 'saipos_sale_number' - 'saipos_enviado_em' - 'saipos_erro' - 'saipos_tentativas')
    || jsonb_build_object(
      'itens', (select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]') from public.pedido_itens i where i.pedido_id = pd.id),
      'pix', case when pd.pagamento = 'pix' then (select jsonb_build_object('chave', c.chave_pix, 'nome', c.pix_nome) from public.config c where c.id = 1) else null end,
      'whatsapp', (select c.whatsapp from public.config c where c.id = 1))
  from public.pedidos pd where pd.id = p_id;
$$;

alter function public.tg_pedidos_saipos() set search_path = public;
alter function public.tg_pedidos_saipos_disparar() set search_path = public;
