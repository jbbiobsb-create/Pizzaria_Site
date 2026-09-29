-- 0008_push.sql — Web Push de status do pedido (assinatura presa ao UUID do pedido)
-- Fluxo: pedido.html → push_assinar(uuid, subscription) → trigger AFTER UPDATE OF status → pg_net → Edge Function push-enviar
-- (chaves VAPID no Vault, lidas por integracao_segredos(); autenticação da função pelo header x-internal-key = SAIPOS_INTERNAL_KEY).

create table if not exists public.push_assinaturas (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,          -- {endpoint, expirationTime, keys:{p256dh, auth}}
  criado_em timestamptz not null default now(),
  ultimo_envio timestamptz,
  ultimo_erro text
);
create index if not exists push_assinaturas_pedido_idx on public.push_assinaturas (pedido_id);
alter table public.push_assinaturas enable row level security;
drop policy if exists "push_assinaturas: equipe" on public.push_assinaturas;
create policy "push_assinaturas: equipe" on public.push_assinaturas for select to authenticated using (public.is_equipe());

-- anon: prova de posse pelo UUID; upsert por endpoint; máx. 3 aparelhos por pedido
create or replace function public.push_assinar(p_pedido uuid, p_subscription jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pd public.pedidos; ep text := p_subscription->>'endpoint'; n int;
begin
  select * into pd from public.pedidos where id = p_pedido;
  if pd.id is null then return jsonb_build_object('ok', false, 'motivo', 'Pedido não encontrado.'); end if;
  if pd.status in ('entregue','cancelado') then return jsonb_build_object('ok', false, 'motivo', 'Pedido já finalizado.'); end if;
  if ep is null or ep !~ '^https://' or length(ep) > 2000
     or coalesce(p_subscription->'keys'->>'p256dh', '') = '' or coalesce(p_subscription->'keys'->>'auth', '') = ''
     or length(p_subscription::text) > 4000 then
    return jsonb_build_object('ok', false, 'motivo', 'Assinatura inválida.');
  end if;
  delete from public.push_assinaturas where criado_em < now() - interval '7 days';   -- limpeza preguiçosa
  select count(*) into n from public.push_assinaturas where pedido_id = p_pedido and endpoint <> ep;
  if n >= 3 then return jsonb_build_object('ok', false, 'motivo', 'Limite de aparelhos para este pedido.'); end if;
  insert into public.push_assinaturas (pedido_id, endpoint, subscription)
    values (p_pedido, ep, p_subscription)
    on conflict (endpoint) do update set pedido_id = excluded.pedido_id, subscription = excluded.subscription, criado_em = now(), ultimo_erro = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.push_cancelar(p_endpoint text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_assinaturas where endpoint = p_endpoint;   -- o endpoint é segredo do aparelho
  return jsonb_build_object('ok', true);
end $$;

-- mesmo padrão de saipos_disparar: Vault + pg_net + x-internal-key; nunca derruba o update do pedido
create or replace function public.push_disparar(p_pedido uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare url text; chave text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'SUPABASE_FUNCTIONS_URL';
  select decrypted_secret into chave from vault.decrypted_secrets where name = 'SAIPOS_INTERNAL_KEY';
  if url is null or chave is null then return; end if;
  perform net.http_post(
    url := url || '/push-enviar',
    body := jsonb_build_object('pedido_id', p_pedido, 'status', p_status),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-key', chave),
    timeout_milliseconds := 15000);
exception when others then
  raise warning 'push_disparar: %', sqlerrm;
end $$;

create or replace function public.tg_pedidos_push_disparar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- só dispara se alguém assinou este pedido (evita um http_post por pedido sem assinante)
  if new.status in ('confirmado','preparando','no_forno','saiu_entrega','pronto_retirada','entregue','cancelado')
     and exists (select 1 from public.push_assinaturas where pedido_id = new.id) then
    perform public.push_disparar(new.id, new.status);
  end if;
  return null;
end $$;
drop trigger if exists pedidos_push_disparar on public.pedidos;
create trigger pedidos_push_disparar after update of status on public.pedidos
  for each row when (old.status is distinct from new.status) execute function public.tg_pedidos_push_disparar();

revoke all on function public.push_assinar(uuid, jsonb) from public;
revoke all on function public.push_cancelar(text) from public;
revoke all on function public.push_disparar(uuid, text) from public, anon, authenticated;
revoke all on function public.tg_pedidos_push_disparar() from public, anon, authenticated;
grant execute on function public.push_assinar(uuid, jsonb) to anon, authenticated;
grant execute on function public.push_cancelar(text) to anon, authenticated;
