import { montarLayout, montarFooter, config } from '../ui.js';
import { consultarPedido, pedidosPorTelefone } from '../api.js';
import { qs, qsa, esc, brl, param, toast, lerLS, mascaraTelefone, STATUS, FLUXO_ENTREGA, FLUXO_RETIRADA, PAGAMENTOS, dataHoraBR, horaBR, whatsappLink, soDigitos } from '../util.js';
import { LS } from '../config.js';
import { icone } from '../icons.js';
import { repetirItens, mensagemRepetir } from '../repetir.js';

montarLayout({ pagina: 'pedido', subheader: false });
montarFooter();

const raiz = qs('[data-raiz]');
const id = param('id');
const novo = param('novo') === '1';
let timer; let ultimaAtualizacao = 0; let timerRelogio;
let CFG = {};
config().then((c) => { CFG = c; }).catch(() => {});

if (id) carregar(id); else montarBusca();

async function carregar(pid) {
  try {
    const p = await consultarPedido(pid);
    if (!p) { raiz.innerHTML = '<div class="painel"><p class="aviso erro">Pedido não encontrado.</p><p style="margin-top:10px"><a href="pedido.html" class="link-acao">Buscar pelo celular</a></p></div>'; return; }
    ultimaAtualizacao = Date.now();
    render(p);
    clearTimeout(timer);
    if (!['entregue', 'cancelado'].includes(p.status)) timer = setTimeout(() => carregar(pid), 15000);
  } catch (e) {
    console.error(e);
    raiz.innerHTML = '<div class="painel"><p class="aviso erro">Não conseguimos carregar o pedido. <a href="">Tentar de novo</a></p></div>';
  }
}

// ETA em horário: base = agendamento, senão confirmação, senão criação; janela = tempo_min..tempo_max
function eta(p, hist) {
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
  const tel = CFG.telefone || p.whatsapp; // telefone da loja (config); cai no WhatsApp se não houver
  const e = p.endereco || {};
  const andamento = idx >= 0 && idx < fluxo.length - 1;
  const et = andamento ? eta(p, hist) : null;
  document.title = `Pedido #${p.numero} — Sesconetto's Pizzeria`;

  let etaHTML = '';
  if (et) {
    const verbo = entrega ? (p.status === 'saiu_entrega' ? 'Chega' : 'Chega') : 'Fica pronto';
    etaHTML = et.atrasado
      ? `<div class="eta"><small>Está demorando mais que o previsto</small><b>Deve ${entrega ? 'chegar' : 'ficar pronto'} a qualquer momento</b><small>Qualquer dúvida, fale com a gente abaixo.</small></div>`
      : `<div class="eta"><small>${entrega ? 'Previsão de entrega' : 'Previsão para retirada'}</small><b>${verbo} entre ${horaBR(et.ini)} e ${horaBR(et.fim)}</b><small>${p.agendado_para ? `Agendado para ${dataHoraBR(p.agendado_para)}` : `${p.tempo_min}–${p.tempo_max} min ${hist.confirmado ? 'após a confirmação' : 'após confirmarmos'}`}</small></div>`;
  }

  raiz.innerHTML = `
    ${novo ? `<div class="aviso ok aviso-ic" style="margin-bottom:14px">${icone('brilho')}<span><b>Pedido enviado!</b> Acompanhe por aqui: a página atualiza sozinha. <button type="button" class="link-acao" data-salvar-link style="text-decoration:underline;font-weight:600;padding:0 4px">${icone('compartilhar')} Salvar link</button></span></div>` : ''}
    <div class="painel">
      <div class="status-grande">
        <div class="ic">${icone(st.icone)}</div>
        <h2>${esc(st.rotulo)}</h2>
        <p class="muted">${esc(st.msg)}</p>
        ${etaHTML}
      </div>
      <p class="center small muted">Pedido <b>#${p.numero}</b> · ${dataHoraBR(p.criado_em)} · ${entrega ? 'Entrega' : 'Retirada na loja'}${p.loja?.nome ? ` · loja ${esc(p.loja.nome)}` : ''}</p>
      <div class="acoes-pedido">
        <a class="btn btn-wa" href="${wa}" target="_blank" rel="noopener">${icone('wa')} WhatsApp</a>
        <a class="btn btn-ligar" href="tel:+${esc(soDigitos(tel))}">${icone('telefone')} Ligar</a>
      </div>
      <!-- ponto de extensão: botão "Avisar quando sair pra entrega" (push) é montado aqui por js/push.js -->
      <div data-push data-pedido-id="${esc(p.id)}" data-pedido-status="${esc(p.status)}" data-tipo-entrega="${esc(p.tipo_entrega)}"></div>
      ${p.status !== 'cancelado' ? `<div class="timeline">${fluxo.map((s, i) => `
        <div class="passo ${i < idx ? 'feito' : i === idx ? 'atual' : ''}" ${i === idx ? 'aria-current="step"' : ''}>
          <div class="bola">${icone(i < idx ? 'check' : STATUS[s].icone)}</div>
          <div><b>${esc(STATUS[s].rotulo)}</b>${hist[s] ? `<small>${horaBR(hist[s])}</small>` : i === idx + 1 && et && !et.atrasado ? `<small>previsto até ${horaBR(et.fim)}</small>` : ''}</div>
        </div>`).join('')}</div>` : ''}
      ${andamento ? `<p class="atualizado"><i></i>Atualizado há <span data-ha>0 s</span> · a página atualiza sozinha</p>` : ''}
    </div>

    ${p.pagamento === 'pix' && p.status !== 'cancelado' ? `<div class="painel"><h2>Pagamento por Pix</h2>
      ${p.pix?.chave ? `<div class="pix-box">Chave Pix ${p.pix.nome ? `(${esc(p.pix.nome)})` : ''}:<code data-pix>${esc(p.pix.chave)}</code>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn btn-sm" data-copiar>Copiar chave</button><span class="small muted">Valor: <b>${brl(p.total)}</b></span></div>
        <p class="small muted" style="margin-top:8px">Depois de pagar, envie o comprovante pelo WhatsApp para agilizar a confirmação.</p></div>`
      : `<p class="aviso">A pizzaria vai enviar a chave Pix pelo WhatsApp para confirmar o pagamento de <b>${brl(p.total)}</b>.</p>`}</div>` : ''}

    <div class="painel">
      <h2>Itens</h2>
      ${(p.itens || []).map((i) => `<div class="item-carrinho" style="grid-template-columns:1fr auto;padding:8px 0"><div><b>${i.quantidade}× ${esc(i.nome)}</b>${i.detalhes?.sabores?.length ? `<small>${i.detalhes.sabores.map((x) => esc(x.nome)).join(' / ')}</small>` : ''}${i.detalhes?.escolhas?.length ? `<small>${i.detalhes.escolhas.map((x) => esc(x.nome)).join(', ')}</small>` : ''}${i.detalhes?.observacao ? `<small>Obs.: ${esc(i.detalhes.observacao)}</small>` : ''}</div><span class="p strong">${brl(i.subtotal)}</span></div>`).join('')}
      <div class="totais">
        <div><span>Subtotal</span><span>${brl(p.subtotal)}</span></div>
        ${Number(p.desconto) > 0 ? `<div class="desconto"><span>Desconto${p.cupom_codigo ? ' (' + esc(p.cupom_codigo) + ')' : ''}</span><span>− ${brl(p.desconto)}</span></div>` : ''}
        <div><span>Taxa de entrega</span><span>${Number(p.taxa_entrega) ? brl(p.taxa_entrega) + (p.taxa_a_confirmar ? ' (a confirmar)' : '') : 'grátis'}</span></div>
        <div class="total"><span>Total</span><span>${brl(p.total)}</span></div>
      </div>
      <h3>${entrega ? 'Endereço de entrega' : 'Retirada'}</h3>
      <p class="small">${entrega ? `${esc(e.rua)}, ${esc(e.numero)}${e.complemento ? ' - ' + esc(e.complemento) : ''} — ${esc(e.bairro)}, ${esc(e.cidade)}/${esc(e.uf)}${e.referencia ? '<br>Ref.: ' + esc(e.referencia) : ''}` : `Na loja ${esc(p.loja?.nome || '')}${p.loja?.endereco ? ' (' + esc([p.loja.endereco.rua, p.loja.endereco.numero].filter(Boolean).join(', ')) + ')' : ''}. Avise no WhatsApp quando estiver chegando.`}${entrega && p.loja ? `<br><span class="muted">Sai da loja ${esc(p.loja.nome)}</span>` : ''}</p>
      <h3>Pagamento</h3>
      <p class="small">${esc(PAGAMENTOS[p.pagamento]?.rotulo || p.pagamento)}${p.troco_para ? ` · troco para ${brl(p.troco_para)}` : ''}</p>
      ${p.observacoes ? `<h3>Observações</h3><p class="small">${esc(p.observacoes)}</p>` : ''}
      <div style="display:grid;gap:8px;margin-top:16px">
        ${['entregue', 'cancelado'].includes(p.status) && p.itens?.length ? `<button type="button" class="btn" data-repetir>${icone('repetir')} Pedir de novo</button><a class="btn btn-outline" href="cardapio.html">Ver cardápio</a>` : `<a class="btn btn-outline" href="cardapio.html">Fazer outro pedido</a>`}
      </div>
    </div>`;
  qs('[data-copiar]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(p.pix.chave); toast('Chave Pix copiada!'); } catch { toast('Selecione e copie a chave', 'erro'); } });
  qs('[data-salvar-link]')?.addEventListener('click', async () => {
    const url = location.href.replace(/[?&]novo=1/, '');
    try {
      if (navigator.share) await navigator.share({ title: `Pedido #${p.numero} — Sesconetto's`, url });
      else { await navigator.clipboard.writeText(url); toast('Link copiado!'); }
    } catch { try { await navigator.clipboard.writeText(url); toast('Link copiado!'); } catch { toast('Copie o endereço desta página', 'erro'); } }
  });
  qs('[data-repetir]')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget; b.disabled = true;
    try { const r = await repetirItens(p.itens); const m = mensagemRepetir(r); toast(m.msg, m.tipo, 3500); if (r.adicionados) setTimeout(() => (location.href = 'carrinho.html'), 700); }
    catch { toast('Não deu para repetir agora.', 'erro'); }
    finally { b.disabled = false; }
  });
  // "atualizado há X s"
  clearInterval(timerRelogio);
  const ha = qs('[data-ha]');
  if (ha) timerRelogio = setInterval(() => { ha.textContent = Math.max(0, Math.round((Date.now() - ultimaAtualizacao) / 1000)) + ' s'; }, 1000);
  window.dispatchEvent(new CustomEvent('ses:pedido', { detail: p }));
}

function montarBusca() {
  const cli = lerLS(LS.cliente, {});
  const ultimo = lerLS(LS.ultimoPedido);
  raiz.innerHTML = `
    <div class="painel">
      <h2>Acompanhar pedido</h2>
      ${ultimo ? `<a class="repetir" href="pedido.html?id=${esc(ultimo.id)}" style="margin:12px 0 16px"><div class="txt"><div class="ic">${icone('relogio')}</div><div style="min-width:0"><b>Último pedido #${esc(ultimo.numero)}</b><small>${esc(ultimo.resumo || 'Ver status e linha do tempo')}</small></div></div><span class="btn btn-sm">Ver status</span></a>` : ''}
      <p class="muted small" style="margin-bottom:12px">Digite o celular usado no pedido.</p>
      <form data-busca class="form-busca-tel"><input type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(61) 99999-9999" aria-label="Celular usado no pedido" value="${esc(cli.telefone ? mascaraTelefone(cli.telefone) : '')}" required><button class="btn">Buscar</button></form>
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
        : '<p class="muted small">Nenhum pedido nos últimos 2 dias com esse celular.</p>';
    } catch { lista.innerHTML = '<p class="aviso erro">Não foi possível buscar agora.</p>'; }
  });
  if (inp.value) form.requestSubmit();
}
