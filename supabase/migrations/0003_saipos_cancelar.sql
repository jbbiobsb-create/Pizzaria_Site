-- Cancelar no site também cancela no PDV Saipos (POST /cancel-order).
-- A Saipos não avisa pelo webhook cancelamentos feitos pela API, então o site é a origem desse status.

drop function if exists public.saipos_disparar(uuid);
create or replace function public.saipos_disparar(p_pedido uuid, p_acao text default 'enviar') returns void
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
    body := jsonb_build_object('pedido_id', p_pedido, 'acao', p_acao),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-key', chave),
    timeout_milliseconds := 30000);
exception when others then
  raise warning 'saipos_disparar: %', sqlerrm;
end $$;
revoke all on function public.saipos_disparar(uuid, text) from public, anon, authenticated;

create or replace function public.tg_pedidos_saipos_disparar() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.saipos_status = 'enviando' and (tg_op = 'INSERT' or old.saipos_status is distinct from 'enviando') then
    perform public.saipos_disparar(new.id, 'enviar');
  elsif tg_op = 'UPDATE' and new.status = 'cancelado' and old.status <> 'cancelado' and new.saipos_status = 'enviado' then
    perform public.saipos_disparar(new.id, 'cancelar');
  end if;
  return null;
end $$;

-- token da Saipos reaproveitado entre chamadas (cada login novo invalida o anterior)
create table public.integracao_tokens (
  nome text primary key,
  token text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.integracao_tokens enable row level security;  -- sem políticas: só service_role
