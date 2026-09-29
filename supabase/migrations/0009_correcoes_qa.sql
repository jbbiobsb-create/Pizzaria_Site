-- 0009_correcoes_qa.sql — correções da verificação de segurança e do QA de API/mobile
--   S1  fidelidade_criar_pin: só pedido ENTREGUE e pago (≤ 30 dias); antissequestro de saldo; auditoria (clientes.pin_origem_pedido)
--   S2  ip_requisicao: cf-connecting-ip → último x-forwarded-for → x-real-ip (o primeiro elemento é forjável)
--   S3  bloqueio de PIN escalonado: 15 min × 2^(tentativas−5), teto ~32 h; contador só zera no acerto
--   S4  pedido cancelado não volta para outro status (tg_pedidos_status)
--   S5  push_assinar: só endpoints https de hosts de push conhecidos e JSON < 4 KB
--   S6  fidelidade_resumo (sem PIN): sem pedidos_90d/proximo
--   S7  higiene: anon/authenticated não executam net.http_*
--   Q6  criar_pedido: erros de cashback voltam como {ok:false, erro, cashback:true} (sem raise)
--   Q8  PINs proibidos alinhados com o front (js/fidelidade.js pinValido)
--   Q13 status_loja security definer (config perdeu a leitura pública na 0006)

-- ---------------------------------------------------------------
-- S2) IP real do cliente
-- ---------------------------------------------------------------
create or replace function public.ip_requisicao() returns text
language plpgsql stable set search_path = public as $$
declare h json; xff text; ip text;
begin
  h := current_setting('request.headers', true)::json;
  if h is null then return null; end if;
  ip := nullif(trim(coalesce(h->>'cf-connecting-ip', '')), '');
  if ip is null then
    xff := coalesce(h->>'x-forwarded-for', '');
    if xff <> '' then
      -- o ÚLTIMO elemento foi acrescentado pelo proxy de confiança; os anteriores vêm do cliente
      ip := nullif(trim((string_to_array(xff, ','))[array_length(string_to_array(xff, ','), 1)]), '');
    end if;
  end if;
  if ip is null then ip := nullif(trim(coalesce(h->>'x-real-ip', '')), ''); end if;
  return left(ip, 64);
exception when others then
  return null;
end $$;
revoke all on function public.ip_requisicao() from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Q8) PINs proibidos (mesma lista de js/fidelidade.js)
-- ---------------------------------------------------------------
create or replace function public.fidelidade_pin_valido(p_pin text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(p_pin, '') ~ '^\d{4}$' and p_pin !~ '^(\d)\1{3}$'
     and p_pin not in ('1234','4321','0123','3210','2580','0852','1212','6969');
$$;
revoke all on function public.fidelidade_pin_valido(text) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- S3) verificação de PIN com bloqueio escalonado
--   erro nº 5 → 15 min, nº 6 → 30 min, nº 7 → 1 h … teto de 32 h; tentativas só zeram no acerto.
-- ---------------------------------------------------------------
create or replace function public.fidelidade_verificar_pin(p_telefone text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cl public.clientes; v_ip text := public.ip_requisicao(); t int; dur interval; ate timestamptz; txt text;
begin
  if coalesce(p_pin, '') !~ '^\d{4}$' then return jsonb_build_object('ok', false, 'motivo', 'O PIN tem 4 dígitos.'); end if;
  if v_ip is not null and (select count(*) from public.fidelidade_tentativas where ip = v_ip and em > now() - interval '15 minutes') >= 30 then
    return jsonb_build_object('ok', false, 'bloqueado', true, 'motivo', 'Muitas tentativas. Aguarde 15 minutos.');
  end if;
  select * into cl from public.clientes where telefone = p_telefone for update;   -- lock: serializa uso de saldo do mesmo celular
  if cl.telefone is null or cl.pin_hash is null then
    return jsonb_build_object('ok', false, 'sem_pin', true, 'motivo', 'Este celular ainda não tem PIN. Crie pelo link de um pedido seu já entregue.');
  end if;
  if cl.pin_bloqueado_ate is not null and cl.pin_bloqueado_ate > now() then
    return jsonb_build_object('ok', false, 'bloqueado', true, 'ate', cl.pin_bloqueado_ate,
      'motivo', 'PIN bloqueado por tentativas erradas. Tente de novo ' ||
        case when cl.pin_bloqueado_ate < now() + interval '20 hours' then 'às ' || to_char(cl.pin_bloqueado_ate at time zone 'America/Sao_Paulo', 'HH24:MI')
             else 'em ' || to_char(cl.pin_bloqueado_ate at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') end || '.');
  end if;
  if cl.pin_hash = extensions.crypt(p_pin, cl.pin_hash) then
    update public.clientes set pin_tentativas = 0, pin_bloqueado_ate = null, atualizado_em = now() where telefone = p_telefone;
    return jsonb_build_object('ok', true);
  end if;
  t := cl.pin_tentativas + 1;
  insert into public.fidelidade_tentativas (ip, telefone) values (v_ip, p_telefone);
  if t >= 5 then
    dur := least(interval '15 minutes' * power(2, least(t - 5, 8)), interval '32 hours');
    ate := now() + dur;
  end if;
  update public.clientes set pin_tentativas = t, pin_bloqueado_ate = ate, atualizado_em = now() where telefone = p_telefone;
  delete from public.fidelidade_tentativas where em < now() - interval '1 day';   -- limpeza preguiçosa
  if t >= 5 then
    txt := case when dur < interval '1 hour' then (extract(epoch from dur) / 60)::int || ' minutos'
                else round(extract(epoch from dur) / 3600)::int || ' hora(s)' end;
    return jsonb_build_object('ok', false, 'bloqueado', true, 'ate', ate,
      'motivo', 'PIN bloqueado por ' || txt || '. Se esqueceu, fale com a gente no WhatsApp.');
  end if;
  return jsonb_build_object('ok', false, 'bloqueado', false, 'motivo', 'PIN incorreto. Restam ' || (5 - t) || ' tentativa(s).');
end $$;
revoke all on function public.fidelidade_verificar_pin(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- S1) criar PIN: só com pedido entregue e pago; antissequestro; auditoria
-- ---------------------------------------------------------------
alter table public.clientes add column if not exists pin_origem_pedido uuid references public.pedidos(id) on delete set null;

create or replace function public.fidelidade_criar_pin(p_pedido uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pd public.pedidos; cl public.clientes; saldo_previo numeric; outros_entregues int;
begin
  select * into pd from public.pedidos where id = p_pedido;
  if pd.id is null then return jsonb_build_object('ok', false, 'motivo', 'Pedido não encontrado.'); end if;
  if pd.status <> 'entregue' or pd.pagamento_status not in ('pago','na_entrega') then
    return jsonb_build_object('ok', false, 'aguardar_entrega', true, 'motivo', 'Você cria o PIN depois que o pedido for entregue e pago.');
  end if;
  if pd.criado_em < now() - interval '30 days' then
    return jsonb_build_object('ok', false, 'motivo', 'Use o link de um pedido entregue nos últimos 30 dias.');
  end if;
  if not public.fidelidade_pin_valido(p_pin) then return jsonb_build_object('ok', false, 'motivo', 'Escolha um PIN de 4 dígitos que não seja sequência nem repetição.'); end if;
  insert into public.clientes (telefone, nome) values (pd.cliente_telefone, pd.cliente_nome) on conflict (telefone) do nothing;
  select * into cl from public.clientes where telefone = pd.cliente_telefone for update;
  if cl.pin_hash is not null then return jsonb_build_object('ok', false, 'ja_tem_pin', true, 'motivo', 'Este celular já tem PIN. Se esqueceu, fale com a gente pelo WhatsApp.'); end if;
  -- antissequestro: celular com saldo anterior a este pedido e nenhum outro pedido entregue → só pelo atendimento
  perform public.fidelidade_expirar(pd.cliente_telefone);
  saldo_previo := public.fidelidade_saldo_interno(pd.cliente_telefone)
    - coalesce((select sum(restante) from public.fidelidade_movimentos where pedido_id = pd.id and restante > 0 and expira_em > now()), 0);
  select count(*) into outros_entregues from public.pedidos where cliente_telefone = pd.cliente_telefone and status = 'entregue' and id <> pd.id;
  if saldo_previo > 0 and outros_entregues = 0 then
    return jsonb_build_object('ok', false, 'contato', true,
      'motivo', 'Este celular já tem cashback de antes deste pedido. Para proteger o saldo, fale com a gente no WhatsApp para criar o PIN.');
  end if;
  update public.clientes set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), nome = coalesce(nome, pd.cliente_nome),
    pin_tentativas = 0, pin_bloqueado_ate = null, pin_criado_em = now(), pin_origem_pedido = pd.id, atualizado_em = now()
   where telefone = pd.cliente_telefone;
  return jsonb_build_object('ok', true, 'telefone', pd.cliente_telefone);
end $$;
revoke all on function public.fidelidade_criar_pin(uuid, text) from public;
grant execute on function public.fidelidade_criar_pin(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- S6) resumo sem PIN: só o que o checkout usa (ativo, tem_conta, tem_pin, nivel, pct e regras)
-- ---------------------------------------------------------------
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
    'nivel', niv->>'nome', 'pct', niv->'pct',
    'max_pct_pedido', f->'max_pct_pedido', 'min_resgate', f->'min_resgate', 'validade_dias', f->'validade_dias', 'niveis', f->'niveis');
end $$;

-- ---------------------------------------------------------------
-- S4) pedido cancelado não pode ser reaberto
-- ---------------------------------------------------------------
create or replace function public.tg_pedidos_status() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.status = 'cancelado' and new.status is distinct from 'cancelado' then
    raise exception 'Pedido cancelado não pode ser reaberto.';
  end if;
  new.atualizado_em := now();
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_historico := coalesce(new.status_historico, '[]'::jsonb)
      || jsonb_build_object('status', new.status, 'em', now());
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------
-- S5) push_assinar: só https em hosts de push conhecidos; JSON < 4 KB
-- ---------------------------------------------------------------
create or replace function public.push_assinar(p_pedido uuid, p_subscription jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pd public.pedidos; ep text := p_subscription->>'endpoint'; host text; n int;
begin
  select * into pd from public.pedidos where id = p_pedido;
  if pd.id is null then return jsonb_build_object('ok', false, 'motivo', 'Pedido não encontrado.'); end if;
  if pd.status in ('entregue','cancelado') then return jsonb_build_object('ok', false, 'motivo', 'Pedido já finalizado.'); end if;
  if jsonb_typeof(p_subscription) <> 'object' or length(p_subscription::text) >= 4096 then
    return jsonb_build_object('ok', false, 'motivo', 'Assinatura inválida.');
  end if;
  host := lower(substring(coalesce(ep, '') from '^https://([a-z0-9.-]+)(?:[/:?#]|$)'));
  if ep is null or length(ep) > 2000 or host is null
     or not (host = 'fcm.googleapis.com' or host = 'web.push.apple.com' or host like '%.push.apple.com'
             or host like '%.push.services.mozilla.com' or host like '%.notify.windows.com')
     or coalesce(p_subscription->'keys'->>'p256dh', '') = '' or coalesce(p_subscription->'keys'->>'auth', '') = '' then
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
revoke all on function public.push_assinar(uuid, jsonb) from public;
grant execute on function public.push_assinar(uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------
-- S7) higiene: net.http_post/http_get para anon/authenticated
--   NÃO aplicável neste projeto: as funções do pg_net (e o schema net) pertencem a supabase_admin e o grant é
--   "=X/supabase_admin" (PUBLIC); o role postgres não é dono nem superusuário, então o REVOKE é ignorado.
--   Exposição real: nenhuma — o schema net não é exposto pelo PostgREST, logo anon/authenticated não alcançam
--   net.http_* pela API. push_disparar/saipos_disparar são security definer (dono postgres) e continuam funcionando.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- Q13) status_loja lê config sem política pública
-- ---------------------------------------------------------------
alter function public.status_loja() security definer;
revoke all on function public.status_loja() from public;
grant execute on function public.status_loja() to anon, authenticated;

-- ---------------------------------------------------------------
-- Q6) criar_pedido: todo erro de cashback volta como {ok:false, erro, cashback:true}
--     (saldo abaixo do mínimo, saldo insuficiente na hora de debitar…), sem exceção,
--     para o front resetar o bloco do cashback e o contador de PIN persistir.
-- ---------------------------------------------------------------
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
      if not (v_ver->>'ok')::boolean then return jsonb_build_object('ok', false, 'erro', v_ver->>'motivo', 'pin', v_ver, 'cashback', true); end if;
      perform public.fidelidade_expirar(telefone);
      v_saldo := public.fidelidade_saldo_interno(telefone);
      if v_saldo < coalesce((v_fid->>'min_resgate')::numeric, 0) then
        return jsonb_build_object('ok', false, 'cashback', true, 'erro',
          'Saldo de cashback (R$ ' || to_char(greatest(v_saldo, 0), 'FM999G990D00') || ') abaixo do mínimo para usar (R$ ' || to_char((v_fid->>'min_resgate')::numeric, 'FM999G990D00') || ').');
      end if;
      p := p || jsonb_build_object('_cashback_saldo', v_saldo);
    end if;
  end if;

  -- bloco próprio: um erro de cashback desfaz o INSERT e volta como {ok:false} em vez de exceção
  begin
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
  exception when others then
    if sqlerrm ilike '%cashback%' then return jsonb_build_object('ok', false, 'erro', sqlerrm, 'cashback', true); end if;
    raise;
  end;

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
revoke all on function public.criar_pedido(jsonb) from public;
grant execute on function public.criar_pedido(jsonb) to anon, authenticated;
