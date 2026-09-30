-- Pedido travado na Saipos: nova tentativa automática (pg_cron, a cada minuto) + dados para o rastreio.
--   * erro no envio: tenta de novo até 3 vezes (saipos_tentativas conta cada tentativa na Edge Function)
--   * "enviando" parado há 3 min (chamada pg_net perdida): dispara de novo
--   Só pedidos das últimas 2 horas e não cancelados. O painel mostra o alerta do que continuar travado.
-- Rastreio: consultar_pedido passa a devolver lat/lng da loja (público no cardápio também), para estimar
-- a chegada a partir do horário em que o pedido saiu da loja.

create extension if not exists pg_cron;

create or replace function public.saipos_reprocessar() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  -- erro: limpar saipos_status faz o trigger marcar "enviando" e disparar o envio de novo
  for r in select id from pedidos
    where saipos_status = 'erro' and coalesce(saipos_tentativas, 0) < 3
      and status <> 'cancelado' and criado_em > now() - interval '2 hours'
  loop
    update pedidos set saipos_status = null where id = r.id; n := n + 1;
  end loop;
  -- enviando sem resposta: a Edge Function ignora o que já foi enviado, então repetir é seguro
  for r in select id from pedidos
    where saipos_status = 'enviando' and atualizado_em < now() - interval '3 minutes'
      and status <> 'cancelado' and criado_em > now() - interval '2 hours'
  loop
    update pedidos set atualizado_em = now() where id = r.id;  -- espaça a próxima tentativa
    perform saipos_disparar(r.id); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.saipos_reprocessar() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'saipos-reprocessar';
select cron.schedule('saipos-reprocessar', '* * * * *', 'select public.saipos_reprocessar()');

-- loja com coordenadas na consulta pública do pedido
do $do$
declare def text := pg_get_functiondef('public.consultar_pedido(uuid)'::regprocedure);
begin
  if position('''endereco'', l.endereco) from public.lojas l' in def) = 0 then raise exception 'trecho da loja não encontrado'; end if;
  execute replace(def, '''endereco'', l.endereco) from public.lojas l', '''endereco'', l.endereco, ''lat'', l.lat, ''lng'', l.lng) from public.lojas l');
end $do$;
