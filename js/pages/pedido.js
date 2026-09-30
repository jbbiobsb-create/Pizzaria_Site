import { montarLayout, montarFooter, config } from '../ui.js';
import { consultarPedido, pedidosPorTelefone, fidelidadeCriarPin } from '../api.js';
import { qs, qsa, esc, brl, param, toast, lerLS, mascaraTelefone, STATUS, FLUXO_ENTREGA, FLUXO_RETIRADA, rotuloPagamento, dataHoraBR, horaBR, whatsappLink, soDigitos, telefoneDiscavel, faixaMin, track } from '../util.js';
import { LS } from '../config.js';
import { icone } from '../icons.js';
import { repetirItens, mensagemRepetir } from '../repetir.js';
import { NOME_CLUBE, cfgFidelidade, programaAtivo, validadeDias, seloNivel, telefoneMascarado, pinValido, ligarCampoPin, salvarTelefone, abrirRegulamento } from '../fidelidade.js';

montarLayout({ pagina: 'pedido', subheader: false });
montarFooter();

const raiz = qs('[data-raiz]');
const id = param('id');
const novo = param('novo') === '1';
let timer; let ultimaAtualizacao = 0; let timerRelogio; let chaveRender = '';
let CFG = {};
config().then((c) => { CFG = c; }).catch(() => {});

if (id) carregar(id); else montarBusca();
// voltou para a aba/app: atualiza na hora (o celular pausa os timers em segundo plano)
document.addEventListener('visibilitychange', () => { if (id && document.visibilityState === 'visible') carregar(id); });

async function carregar(pid) {
  try {
    const p = await consultarPedido(pid);
    if (!p) { raiz.innerHTML = '<div class="painel"><p class="aviso erro">Pedido não encontrado.</p><p style="margin-top:10px"><a href="pedido.html" class="link-acao">Buscar pelo celular</a></p></div>'; return; }
    ultimaAtualizacao = Date.now();
    // cliente digitando o PIN: não redesenha agora (perderia foco e teclado); a próxima atualização redesenha
    const hist = Object.fromEntries((p.status_historico || []).map((h) => [h.status, h.em]));
    const et = eta(p, hist);
    const chave = JSON.stringify(p) + '|' + (et ? et.atrasado : '') + '|' + !!qs('[data-form-pin]');
    if (document.activeElement && document.activeElement.closest('[data-form-pin]')) { /* mantém o DOM */ }
    else if (chave !== chaveRender || !raiz.querySelector('.painel')) { chaveRender = chave; render(p); }
    clearTimeout(timer);
    if (!['entregue', 'cancelado'].includes(p.status)) timer = setTimeout(() => carregar(pid), ['saiu_entrega', 'pronto_retirada'].includes(p.status) ? 10000 : 15000);
  } catch (e) {
    console.error(e);
    raiz.innerHTML = '<div class="painel"><p class="aviso erro">Não conseguimos carregar o pedido. <a href="">Tentar de novo</a></p></div>';
  }
}

// distância da loja até o cliente (km em linha reta): a gravada no pedido, senão pelas coordenadas
function kmAteCliente(p) {
  const e = p.endereco || {}; const l = p.loja || {};
  if (Number(e.distancia_km) > 0) return Number(e.distancia_km);
  if (e.lat == null || l.lat == null) return null;
  const r = (x) => x * Math.PI / 180; const dLat = r(e.lat - l.lat); const dLng = r(e.lng - l.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(l.lat)) * Math.cos(r(e.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
// depois que a Saipos avisa que saiu: chegada = horário de saída + trajeto (ruas ~1,35× a reta, moto ~25 km/h, +4 min para estacionar/subir)
function etaSaida(p, saiu) {
  const km = kmAteCliente(p);
  const ida = km ? Math.round(4 + km * 1.35 * 2.4) : 12;
  const ini = new Date(new Date(saiu).getTime() + Math.max(6, ida - 3) * 60000);
  const fim = new Date(new Date(saiu).getTime() + (Math.max(6, ida - 3) + 10) * 60000);
  return { ini, fim, atrasado: Date.now() > fim.getTime(), saiu: new Date(saiu), km };
}

// ETA em horário: base = agendamento, senão confirmação, senão criação; janela = tempo_min..tempo_max
function eta(p, hist) {
  if (p.status === 'saiu_entrega' && hist.saiu_entrega) return etaSaida(p, hist.saiu_entrega);
  const base = p.agendado_para ? new Date(p.agendado_para) : new Date(hist.confirmado || p.criado_em);
  if (isNaN(base) || !p.tempo_max) return null;
  const ini = new Date(base.getTime() + Number(p.tempo_min || 0) * 60000);
  const fim = new Date(base.getTime() + Number(p.tempo_max) * 60000);
  return { ini, fim, atrasado: Date.now() > fim.getTime() };
}

function render(p) {
  const st = STATUS[p.status] || STATUS.recebido;
  const entrega = p.tipo_entrega === 'entrega';
  const fluxo = entrega ? FLUXO_ENTREGA : FLUXO_RETIRADA;
  const idx = p.status === 'cancelado' ? -1 : fluxo.indexOf(p.status);
  const hist = Object.fromEntries((p.status_historico || []).map((h) => [h.status, h.em]));
  const wa = whatsappLink(p.whatsapp, `Olá! Sou ${p.cliente_nome}, pedido #${p.numero} pelo site.`);
  const tel = telefoneDiscavel(CFG.telefone, p.whatsapp); // telefone da loja com DDI 55; cai no WhatsApp se não houver
  const e = p.endereco || {};
  const andamento = idx >= 0 && idx < fluxo.length - 1;
  const et = andamento ? eta(p, hist) : null;
  document.title = `Pedido #${p.numero} · Sesconetto's Pizzeria`;
  // a página se redesenha a cada atualização: guarda o que o cliente já digitou no "criar PIN"
  const fp = qs('[data-form-pin]');
  const pinDigitado = fp ? [fp.elements.pin.value, fp.elements.conf.value, fp.elements.aceite.checked ? 'on' : ''] : [];

  let etaHTML = '';
  if (et?.saiu) {
    // rastreio em tempo real: a Saipos avisou a saída; a previsão passa a contar do horário real de saída
    etaHTML = et.atrasado
      ? `<div class="eta"><small>Saiu da loja às ${horaBR(et.saiu)}</small><b>Deve chegar a qualquer momento</b><small>O entregador está a caminho. Qualquer dúvida, fale com a gente abaixo.</small></div>`
      : `<div class="eta"><small>Saiu da loja às ${horaBR(et.saiu)}</small><b>Chega entre ${horaBR(et.ini)} e ${horaBR(et.fim)}</b><small>${et.km ? `Cerca de ${String(Math.max(1, Math.round(et.km * 1.35 * 10) / 10)).replace('.', ',')} km até você · ` : ''}deixe o celular por perto</small></div>`;
  } else if (!entrega && p.status === 'pronto_retirada' && hist.pronto_retirada) {
    etaHTML = `<div class="eta"><small>Pronta desde ${horaBR(hist.pronto_retirada)}</small><b>Pode vir buscar</b><small>${p.loja?.nome ? `Na loja ${esc(p.loja.nome)}. ` : ''}Chame no WhatsApp quando estiver chegando.</small></div>`;
  } else if (et) {
    const verbo = entrega ? 'Chega' : 'Fica pronta';
    etaHTML = et.atrasado
      ? `<div class="eta"><small>Está demorando mais que o previsto</small><b>Deve ${entrega ? 'chegar' : 'ficar pronta'} a qualquer momento</b><small>Qualquer dúvida, fale com a gente abaixo.</small></div>`
      : `<div class="eta"><small>${entrega ? 'Previsão de entrega' : 'Previsão para retirada'}</small><b>${verbo} entre ${horaBR(et.ini)} e ${horaBR(et.fim)}</b><small>${p.agendado_para ? `Agendado para ${dataHoraBR(p.agendado_para)}` : `${faixaMin(p.tempo_min, p.tempo_max)} depois de ${hist.confirmado ? 'confirmar' : 'confirmarmos'}`}</small></div>`;
  }

  // Pix pendente: é a primeira coisa que o cliente precisa ver (chave copiável + valor + comprovante)
  const pixPendente = p.pagamento === 'pix' && p.status !== 'cancelado' && p.pagamento_status !== 'pago';
  const waPix = whatsappLink(p.whatsapp, `Olá! Pedido #${p.numero}, paguei ${brl(p.total)} no Pix. Segue o comprovante.`);
  const pixHTML = pixPendente ? `<div class="painel pix-topo" data-pix-topo>
      <h2>Falta só o Pix: ${brl(p.total)}</h2>
      ${p.pix?.chave ? `<div class="pix-box">Chave Pix${p.pix.nome ? ` (${esc(p.pix.nome)})` : ''}:<code data-pix>${esc(p.pix.chave)}</code>
        <div class="acoes-pix"><button type="button" class="btn" data-copiar>${icone('pix')} Copiar chave Pix</button><a class="btn btn-wa" href="${waPix}" target="_blank" rel="noopener">${icone('wa')} Enviar comprovante no WhatsApp</a></div>
        <p class="small muted" style="margin-top:8px">Confirmamos em poucos minutos e a pizza vai pro forno.</p></div>`
      : `<p class="aviso">A pizzaria vai enviar a chave Pix pelo WhatsApp para confirmar o pagamento de <b>${brl(p.total)}</b>.</p><div class="acoes-pix" style="margin-top:10px"><a class="btn btn-wa" href="${waPix}" target="_blank" rel="noopener">${icone('wa')} Falar no WhatsApp</a></div>`}
    </div>` : '';

  raiz.innerHTML = `
    ${novo ? `<div class="aviso ok aviso-ic" style="margin-bottom:14px">${icone('brilho')}<span><b>Pedido #${esc(p.numero)} enviado.</b> Esta página atualiza sozinha. Guarde o link. <button type="button" class="link-acao" data-salvar-link style="text-decoration:underline;font-weight:600;padding:0 4px">${icone('compartilhar')} Guardar link do pedido</button></span></div>` : ''}
    ${pixHTML}
    <div class="painel" role="status" aria-live="polite">
      <div class="status-grande">
        <div class="ic">${icone(st.icone)}</div>
        <h2>${esc(st.rotulo)}</h2>
        <p class="muted">${esc(st.msg)}</p>
        ${etaHTML}
      </div>
      <p class="center small muted">Pedido <b>#${p.numero}</b> · ${dataHoraBR(p.criado_em)} · ${entrega ? 'Entrega' : 'Retirada na loja'}${p.loja?.nome ? ` · loja ${esc(p.loja.nome)}` : ''}</p>
      <div class="acoes-pedido">
        <a class="btn btn-wa" href="${wa}" target="_blank" rel="noopener">${icone('wa')} WhatsApp</a>
        <a class="btn btn-ligar" href="tel:+${esc(tel)}">${icone('telefone')} Ligar</a>
      </div>
      <!-- botão "Avisar quando sair pra entrega" (push): js/pwa.js monta aqui ao ouvir o evento ses:pedido -->
      <div data-push data-pedido-id="${esc(p.id)}" data-pedido-status="${esc(p.status)}" data-tipo-entrega="${esc(p.tipo_entrega)}"></div>
      ${p.status !== 'cancelado' ? `<div class="timeline">${fluxo.map((s, i) => `
        <div class="passo ${i < idx ? 'feito' : i === idx ? 'atual' : ''}" ${i === idx ? 'aria-current="step"' : ''}>
          <div class="bola">${icone(i < idx ? 'check' : STATUS[s].icone)}</div>
          <div><b>${esc(STATUS[s].rotulo)}</b>${hist[s] ? `<small>${horaBR(hist[s])}</small>` : i === idx + 1 && et && !et.atrasado ? `<small>previsto até ${horaBR(et.fim)}</small>` : ''}</div>
        </div>`).join('')}</div>` : ''}
      ${andamento ? `<p class="atualizado"><i></i>Atualizado há <span data-ha>0 s</span> · a página atualiza sozinha</p>` : ''}
    </div>

    <!-- Clube Sesconetto's: cashback previsto/creditado e criação do PIN (renderFidelidade) -->
    <div data-fidelidade></div>

    <div class="painel">
      <h2>Itens</h2>
      ${(p.itens || []).map((i) => `<div class="item-carrinho" style="grid-template-columns:1fr auto;padding:8px 0"><div><b>${i.quantidade}× ${esc(i.nome)}</b>${i.detalhes?.sabores?.length ? `<small>${i.detalhes.sabores.map((x) => esc(x.nome)).join(' / ')}</small>` : ''}${i.detalhes?.escolhas?.length ? `<small>${i.detalhes.escolhas.map((x) => esc(x.nome)).join(', ')}</small>` : ''}${i.detalhes?.observacao ? `<small>Obs.: ${esc(i.detalhes.observacao)}</small>` : ''}</div><span class="p strong">${brl(i.subtotal)}</span></div>`).join('')}
      <div class="totais">
        <div><span>Subtotal</span><span>${brl(p.subtotal)}</span></div>
        ${Number(p.desconto) > 0 ? `<div class="desconto"><span>Desconto${p.cupom_codigo ? ' (' + esc(p.cupom_codigo) + ')' : ''}</span><span>− ${brl(p.desconto)}</span></div>` : ''}
        ${Number(p.cashback_usado) > 0 ? `<div class="cashback"><span>Cashback usado</span><span>− ${brl(p.cashback_usado)}</span></div>` : ''}
        <div><span>Taxa de entrega</span><span>${Number(p.taxa_entrega) ? brl(p.taxa_entrega) + (p.taxa_a_confirmar ? ' (a confirmar)' : '') : 'grátis'}</span></div>
        <div class="total"><span>Total</span><span>${brl(p.total)}</span></div>
      </div>
      <h3>${entrega ? 'Endereço de entrega' : 'Retirada'}</h3>
      <p class="small">${entrega ? `${esc(e.rua)}, ${esc(e.numero)}${e.complemento ? ' - ' + esc(e.complemento) : ''} · ${esc(e.bairro)}, ${esc(e.cidade)}/${esc(e.uf)}${e.referencia ? '<br>Ref.: ' + esc(e.referencia) : ''}` : `Na loja ${esc(p.loja?.nome || '')}${p.loja?.endereco ? ' · ' + esc([p.loja.endereco.rua, p.loja.endereco.numero].filter(Boolean).join(', ')) : ''}. Chame no WhatsApp quando estiver chegando.`}${entrega && p.loja ? `<br><span class="muted">Sai da loja ${esc(p.loja.nome)}</span>` : ''}</p>
      <h3>Pagamento</h3>
      <p class="small">${esc(rotuloPagamento(p.pagamento, p.tipo_entrega))}${p.troco_para ? ` · troco para ${brl(p.troco_para)}` : ''}${p.pagamento === 'pix' && p.pagamento_status === 'pago' ? ' · Pix confirmado' : ''}</p>
      ${p.observacoes ? `<h3>Observações</h3><p class="small">${esc(p.observacoes)}</p>` : ''}
      <div style="display:grid;gap:8px;margin-top:16px">
        ${['entregue', 'cancelado'].includes(p.status) && p.itens?.length ? `<button type="button" class="btn" data-repetir>${icone('repetir')} Pedir de novo</button><a class="btn btn-outline" href="cardapio.html">Ver cardápio</a>` : `<a class="btn btn-outline" href="cardapio.html">Fazer outro pedido</a>`}
        ${p.loja?.nome ? `<p class="small muted center">Feita hoje por Sesconetto's ${esc(p.loja.nome)}.</p>` : ''}
      </div>
    </div>`;
  if (statusAnterior && statusAnterior !== p.status) { try { navigator.vibrate?.([30, 40, 30]); } catch {} }
  statusAnterior = p.status;
  renderFidelidade(p, pinDigitado);
  qs('[data-copiar]')?.addEventListener('click', async () => { track('pix_copiado', { numero: p.numero }); try { await navigator.clipboard.writeText(p.pix.chave); toast('Chave Pix copiada'); } catch { toast('Selecione e copie a chave', 'erro'); } });
  qs('[data-salvar-link]')?.addEventListener('click', async () => {
    const url = location.href.replace(/[?&]novo=1/, '');
    try {
      if (navigator.share) await navigator.share({ title: `Pedido #${p.numero} · Sesconetto's`, url });
      else { await navigator.clipboard.writeText(url); toast('Link copiado'); }
    } catch { try { await navigator.clipboard.writeText(url); toast('Link copiado'); } catch { toast('Copie o endereço desta página', 'erro'); } }
  });
  qs('[data-repetir]')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget; b.disabled = true;
    try { const r = await repetirItens(p.itens); const m = mensagemRepetir(r); if (r.adicionados) { location.href = 'checkout.html?repetir=1'; return; } toast(m.msg, m.tipo, 3500); }
    catch { toast('Não deu para repetir agora.', 'erro'); }
    finally { b.disabled = false; }
  });
  // "atualizado há X s"
  clearInterval(timerRelogio);
  const ha = qs('[data-ha]');
  if (ha) timerRelogio = setInterval(() => { ha.textContent = Math.max(0, Math.round((Date.now() - ultimaAtualizacao) / 1000)) + ' s'; }, 1000);
  window.dispatchEvent(new CustomEvent('ses:pedido', { detail: p }));
}

// ---------------------------------------------------------------
// Clube Sesconetto's na página do pedido
//   - cashback previsto (antes de entregar) ou creditado (entregue) + "Ver meu saldo"
//   - sem PIN: card "Crie seu PIN" (prova de posse = o link deste pedido)
// ---------------------------------------------------------------
let pinCriado = false; let statusAnterior = '';
function renderFidelidade(p, pinDigitado = []) {
  const el = qs('[data-fidelidade]'); if (!el) return;
  const F = cfgFidelidade(CFG);
  const ativo = p.fidelidade_ativa ?? programaAtivo(CFG);
  if (!ativo || p.status === 'cancelado') { el.innerHTML = ''; return; }
  const ganho = Number(p.cashback_ganho || 0); const previsto = Number(p.cashback_previsto || 0);
  const entregue = p.status === 'entregue';
  const dias = validadeDias(F);
  const temPin = !!p.tem_pin || pinCriado;
  const tel = p.cliente_telefone || '';
  const linkConta = `conta.html${tel ? `?tel=${esc(soDigitos(tel))}` : ''}`;
  const selo = p.fidelidade_nivel ? seloNivel(p.fidelidade_nivel, p.fidelidade_pct) : '';

  let banner = '';
  if (entregue && ganho > 0) {
    banner = `<div class="cb-pedido creditado">${icone('presente')}<div><b>${brl(ganho)} de cashback creditados.</b><small>Válido por ${dias} dias para usar no site. ${selo}</small>${temPin ? `<a class="btn btn-sm" href="${linkConta}" data-ver-saldo>${icone('moeda')} Ver meu saldo</a>` : ''}</div></div>`;
  } else if (!entregue && previsto > 0) {
    banner = `<div class="cb-pedido previsto">${icone('presente')}<div><b>Você ganha ${brl(previsto)} de cashback quando o pedido for entregue.</b><small>Vale ${dias} dias para usar no site. ${selo}</small></div></div>`;
  } else if (entregue && ganho === 0 && Number(p.cashback_usado) > 0) {
    banner = `<div class="cb-pedido previsto">${icone('moeda')}<div><b>Você usou ${brl(p.cashback_usado)} de cashback neste pedido.</b></div></div>`;
  }

  let pinHTML = '';
  if (!temPin && !entregue) {
    // o servidor só aceita criar o PIN com pedido entregue e pago (prova de posse real)
    pinHTML = `<div class="cb-pedido previsto" style="background:var(--creme);border-color:var(--linha);color:var(--texto-2)">${icone('cadeado')}<div><b style="color:var(--texto)">Depois que o pedido for entregue você cria seu PIN aqui.</b><small>Com o PIN você vê o saldo do celular ${esc(telefoneMascarado(tel))} e usa o cashback nos próximos pedidos.</small></div></div>`;
  } else if (!temPin) {
    pinHTML = `
      <form class="criar-pin" data-form-pin novalidate>
        <h3>${icone('cadeado')} Crie seu PIN para usar o cashback</h3>
        <p>Seu cashback já acumula no celular ${esc(telefoneMascarado(tel))}. Escolha 4 dígitos que só você saiba (evite 1234 ou o fim do celular) para ver o saldo e usar nos próximos pedidos.</p>
        <div class="linha-campos">
          <div class="campo"><label for="pin-1">PIN</label><input id="pin-1" name="pin" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••" value="${esc(pinDigitado[0] || '')}"></div>
          <div class="campo"><label for="pin-2">Confirmar PIN</label><input id="pin-2" name="conf" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••" value="${esc(pinDigitado[1] || '')}"></div>
        </div>
        <label class="check" style="padding-top:0"><input type="checkbox" name="aceite" ${pinDigitado[2] === 'on' ? 'checked' : ''}> Li e aceito o regulamento do ${esc(NOME_CLUBE)}.</label>
        <div class="aviso erro" role="alert" data-pin-erro hidden style="margin-bottom:10px"></div>
        <button type="submit" class="btn btn-block" data-criar-pin>${icone('cadeado')} Criar PIN</button>
      </form>`;
  } else if (!banner || !(entregue && ganho > 0)) {
    pinHTML = `<div class="cb-pedido previsto" style="background:var(--creme);border-color:var(--linha);color:var(--texto-2)">${icone('cadeado')}<div><b style="color:var(--texto)">Seu cashback fica guardado no celular ${esc(telefoneMascarado(tel))}.</b><a class="btn btn-sm btn-outline" href="${linkConta}" data-ver-saldo>${icone('moeda')} Ver meu saldo</a></div></div>`;
  }
  if (!banner && !pinHTML) { el.innerHTML = ''; return; }

  el.innerHTML = `<div class="painel">
    <h2 style="display:flex;align-items:center;gap:8px;font-size:1.15rem">${icone('presente')} ${esc(NOME_CLUBE)}</h2>
    ${banner}${pinHTML}
    <p class="small muted" style="margin-top:12px">Pediu, ganhou: parte do que você paga volta para a próxima pizza. <button type="button" class="link-acao" data-regulamento style="text-decoration:underline;font-weight:600;padding:0 4px">Como funciona</button></p>
  </div>`;
  qs('[data-regulamento]', el).addEventListener('click', () => abrirRegulamento(F));
  qsa('[data-ver-saldo]', el).forEach((a) => a.addEventListener('click', () => salvarTelefone(tel)));

  const form = qs('[data-form-pin]', el);
  if (!form) return;
  ['pin', 'conf'].forEach((k) => ligarCampoPin(form.elements[k]));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = form.elements; const erro = qs('[data-pin-erro]', form); const btn = qs('[data-criar-pin]', form);
    erro.hidden = true;
    if (!pinValido(f.pin.value)) { erro.textContent = 'Escolha um PIN de 4 dígitos que não seja sequência nem repetição.'; erro.hidden = false; f.pin.focus(); return; }
    if (f.pin.value !== f.conf.value) { erro.textContent = 'Os dois PINs não conferem.'; erro.hidden = false; f.conf.focus(); return; }
    if (!f.aceite.checked) { erro.textContent = 'Marque que leu e aceita o regulamento.'; erro.hidden = false; return; }
    btn.disabled = true; btn.textContent = 'Criando…';
    try {
      const r = await fidelidadeCriarPin(p.id, f.pin.value);
      if (!r.ok) {
        erro.textContent = r.motivo || 'Não foi possível criar o PIN.';
        // saldo anterior sem outro pedido entregue: só pelo atendimento (antissequestro)
        if (r.contato && p.whatsapp) erro.innerHTML += ` <a href="${whatsappLink(p.whatsapp, `Olá! Quero criar meu PIN do ${NOME_CLUBE} (pedido #${p.numero}, celular ${telefoneMascarado(tel)}).`)}" target="_blank" rel="noopener" style="font-weight:700;text-decoration:underline">Falar no WhatsApp</a>`;
        erro.hidden = false; return;
      }
      pinCriado = true; salvarTelefone(r.telefone || tel);
      toast('PIN criado. Você entrou no Clube.');
      form.outerHTML = `<div class="cb-pedido creditado">${icone('check-circulo')}<div><b>PIN criado. Você entrou no ${esc(NOME_CLUBE)}.</b><small>Seu saldo aparece em "Minha conta" com o celular ${esc(telefoneMascarado(tel))} e o PIN.</small><a class="btn btn-sm" href="${linkConta}">${icone('moeda')} Ver meu saldo</a></div></div>`;
    } catch (e) { erro.textContent = e.message || 'Não foi possível criar o PIN agora.'; erro.hidden = false; }
    finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = `${icone('cadeado')} Criar PIN`; } }
  });
}

function montarBusca() {
  const cli = lerLS(LS.cliente, {});
  const ultimo = lerLS(LS.ultimoPedido);
  raiz.innerHTML = `
    <div class="painel">
      <h2>Ver meu pedido</h2>
      ${ultimo ? `<a class="repetir" href="pedido.html?id=${esc(ultimo.id)}" style="margin:12px 0 16px"><div class="txt"><div class="ic">${icone('relogio')}</div><div style="min-width:0"><b>Último pedido #${esc(ultimo.numero)}</b><small>${esc(ultimo.resumo || 'Ver status e linha do tempo')}</small></div></div><span class="btn btn-sm">Ver status</span></a>` : ''}
      <p class="muted small" style="margin-bottom:12px">Digite o celular usado no pedido.</p>
      <form data-busca class="form-busca-tel"><input type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(61) 99999-9999" aria-label="Celular usado no pedido" value="${esc(cli.telefone ? mascaraTelefone(cli.telefone) : '')}" required><button class="btn">Ver meu pedido</button></form>
      <div class="lista-pedidos" data-lista style="margin-top:14px"></div>
    </div>`;
  const form = qs('[data-busca]'); const inp = form.querySelector('input');
  inp.addEventListener('input', () => (inp.value = mascaraTelefone(inp.value)));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const lista = qs('[data-lista]'); lista.innerHTML = '<p class="muted small">Buscando…</p>';
    try {
      const [ps, c] = await Promise.all([pedidosPorTelefone(inp.value), config().catch(() => ({}))]);
      // sem link: o id do pedido só fica com quem fez o pedido (evita ver endereço de terceiros pelo celular)
      lista.innerHTML = ps.length ? ps.map((p) => `<div class="item"><div><b>#${esc(p.numero)} · ${esc(STATUS[p.status]?.rotulo || p.status)}</b><small>${dataHoraBR(p.criado_em)} · ${brl(p.total)} · ${esc(p.resumo || '')}</small></div>
          <a class="btn btn-sm btn-wa" href="${whatsappLink(c.whatsapp, `Olá! Quero saber do pedido #${p.numero} (celular ${inp.value}).`)}" target="_blank" rel="noopener" aria-label="Perguntar sobre o pedido ${esc(p.numero)} no WhatsApp">${icone('wa')} WhatsApp</a></div>`).join('')
        + '<p class="muted small" style="margin-top:10px">Por segurança, os detalhes só abrem no aparelho que fez o pedido. Precisa do link? Peça pelo WhatsApp.</p>'
        : '<p class="muted small">Não achamos esse pedido. Procure pelo celular usado no pedido.</p>';
    } catch { lista.innerHTML = '<p class="aviso erro">Não foi possível buscar agora.</p>'; }
  });
  if (inp.value) form.requestSubmit();
}
