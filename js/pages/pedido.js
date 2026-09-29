import { montarLayout, montarFooter, config } from '../ui.js';
import { consultarPedido, pedidosPorTelefone } from '../api.js';
import { qs, qsa, esc, brl, param, toast, lerLS, mascaraTelefone, STATUS, FLUXO_ENTREGA, FLUXO_RETIRADA, PAGAMENTOS, dataHoraBR, horaBR, whatsappLink } from '../util.js';
import { LS } from '../config.js';
import { icone } from '../icons.js';

montarLayout({ pagina: 'pedido', subheader: false });
montarFooter();

const raiz = qs('[data-raiz]');
const id = param('id');
const novo = param('novo') === '1';
let timer;

if (id) carregar(id); else montarBusca();

async function carregar(pid) {
  try {
    const p = await consultarPedido(pid);
    if (!p) { raiz.innerHTML = '<div class="painel"><p class="aviso erro">Pedido não encontrado.</p><p style="margin-top:10px"><a href="pedido.html">Buscar pelo celular</a></p></div>'; return; }
    render(p);
    clearTimeout(timer);
    if (!['entregue', 'cancelado'].includes(p.status)) timer = setTimeout(() => carregar(pid), 15000);
  } catch (e) {
    console.error(e);
    raiz.innerHTML = '<div class="painel"><p class="aviso erro">Não conseguimos carregar o pedido. <a href="">Tentar de novo</a></p></div>';
  }
}

function render(p) {
  const st = STATUS[p.status] || STATUS.recebido;
  const fluxo = p.tipo_entrega === 'entrega' ? FLUXO_ENTREGA : FLUXO_RETIRADA;
  const idx = p.status === 'cancelado' ? -1 : fluxo.indexOf(p.status);
  const hist = Object.fromEntries((p.status_historico || []).map((h) => [h.status, h.em]));
  const wa = whatsappLink(p.whatsapp, `Olá! Sou ${p.cliente_nome}, pedido #${p.numero} pelo site.`);
  const e = p.endereco || {};
  document.title = `Pedido #${p.numero} — Sesconetto's Pizzeria`;

  raiz.innerHTML = `
    ${novo ? `<div class="aviso ok aviso-ic" style="margin-bottom:14px">${icone('brilho')}<span><b>Pedido enviado!</b> Salve esta página ou use seu celular para acompanhar. Você também pode receber atualizações pelo WhatsApp.</span></div>` : ''}
    <div class="painel">
      <div class="status-grande">
        <div class="ic">${icone(st.icone)}</div>
        <h2>${esc(st.rotulo)}</h2>
        <p class="muted">${esc(st.msg)}</p>
        ${idx >= 0 && idx < fluxo.length - 1 ? `<p class="small" style="margin-top:8px">Previsão: <b>${p.tempo_min}–${p.tempo_max} min</b> ${p.agendado_para ? `· agendado para <b>${dataHoraBR(p.agendado_para)}</b>` : 'após a confirmação'}</p>` : ''}
      </div>
      <p class="center small muted">Pedido <b>#${p.numero}</b> · ${dataHoraBR(p.criado_em)} · ${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada na loja'}</p>
      ${p.status !== 'cancelado' ? `<div class="timeline">${fluxo.map((s, i) => `
        <div class="passo ${i < idx ? 'feito' : i === idx ? 'atual' : ''}">
          <div class="bola">${icone(i < idx ? 'check' : STATUS[s].icone)}</div>
          <div><b>${esc(STATUS[s].rotulo)}</b>${hist[s] ? `<small>${horaBR(hist[s])}</small>` : ''}</div>
        </div>`).join('')}</div>` : ''}
      <a class="btn btn-wa btn-block" href="${wa}" target="_blank" rel="noopener">Falar com a pizzaria no WhatsApp</a>
    </div>

    ${p.pagamento === 'pix' && p.status !== 'cancelado' ? `<div class="painel"><h2>Pagamento por Pix</h2>
      ${p.pix?.chave ? `<div class="pix-box">Chave Pix ${p.pix.nome ? `(${esc(p.pix.nome)})` : ''}:<code data-pix>${esc(p.pix.chave)}</code>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm" data-copiar>Copiar chave</button><span class="small muted" style="align-self:center">Valor: <b>${brl(p.total)}</b></span></div>
        <p class="small muted" style="margin-top:8px">Depois de pagar, envie o comprovante pelo WhatsApp para agilizar a confirmação.</p></div>`
      : `<p class="aviso">A pizzaria vai enviar a chave Pix pelo WhatsApp para confirmar o pagamento de <b>${brl(p.total)}</b>.</p>`}</div>` : ''}

    <div class="painel">
      <h2>Itens</h2>
      ${(p.itens || []).map((i) => `<div class="item-carrinho" style="grid-template-columns:1fr auto;padding:8px 0"><div><b>${i.quantidade}× ${esc(i.nome)}</b>${i.detalhes?.escolhas?.length ? `<small>${i.detalhes.escolhas.map((x) => esc(x.nome)).join(', ')}</small>` : ''}${i.detalhes?.observacao ? `<small>Obs.: ${esc(i.detalhes.observacao)}</small>` : ''}</div><span class="p strong">${brl(i.subtotal)}</span></div>`).join('')}
      <div class="totais">
        <div><span>Subtotal</span><span>${brl(p.subtotal)}</span></div>
        ${Number(p.desconto) > 0 ? `<div class="desconto"><span>Desconto${p.cupom_codigo ? ' (' + esc(p.cupom_codigo) + ')' : ''}</span><span>− ${brl(p.desconto)}</span></div>` : ''}
        <div><span>Taxa de entrega</span><span>${Number(p.taxa_entrega) ? brl(p.taxa_entrega) + (p.taxa_a_confirmar ? ' (a confirmar)' : '') : 'grátis'}</span></div>
        <div class="total"><span>Total</span><span>${brl(p.total)}</span></div>
      </div>
      <h3>${p.tipo_entrega === 'entrega' ? 'Endereço de entrega' : 'Retirada'}</h3>
      <p class="small">${p.tipo_entrega === 'entrega' ? `${esc(e.rua)}, ${esc(e.numero)}${e.complemento ? ' - ' + esc(e.complemento) : ''} — ${esc(e.bairro)}, ${esc(e.cidade)}/${esc(e.uf)}${e.referencia ? '<br>Ref.: ' + esc(e.referencia) : ''}` : 'Na loja em Vicente Pires. Avise no WhatsApp quando estiver chegando.'}</p>
      <h3>Pagamento</h3>
      <p class="small">${esc(PAGAMENTOS[p.pagamento]?.rotulo || p.pagamento)}${p.troco_para ? ` · troco para ${brl(p.troco_para)}` : ''}</p>
      ${p.observacoes ? `<h3>Observações</h3><p class="small">${esc(p.observacoes)}</p>` : ''}
      <p style="margin-top:16px"><a class="btn btn-outline" href="cardapio.html">Fazer outro pedido</a></p>
    </div>`;
  qs('[data-copiar]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(p.pix.chave); toast('Chave Pix copiada!'); } catch { toast('Selecione e copie a chave', 'erro'); } });
}

function montarBusca() {
  const cli = lerLS(LS.cliente, {});
  const ultimo = lerLS(LS.ultimoPedido);
  raiz.innerHTML = `
    <div class="painel">
      <h2>Acompanhar pedido</h2>
      <p class="muted small" style="margin-bottom:12px">Digite o celular usado no pedido.</p>
      ${ultimo ? `<p class="aviso ok" style="margin-bottom:12px">Seu último pedido: <a href="pedido.html?id=${esc(ultimo.id)}"><b>#${esc(ultimo.numero)}</b> · ver status ${icone('chevron-dir')}</a></p>` : ''}
      <form data-busca class="cupom"><input inputmode="tel" placeholder="(61) 99999-9999" value="${esc(cli.telefone ? mascaraTelefone(cli.telefone) : '')}" required><button class="btn">Buscar</button></form>
      <div class="lista-pedidos" data-lista style="margin-top:14px"></div>
    </div>`;
  const form = qs('[data-busca]'); const inp = form.querySelector('input');
  inp.addEventListener('input', () => (inp.value = mascaraTelefone(inp.value)));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const lista = qs('[data-lista]'); lista.innerHTML = '<p class="muted small">Buscando…</p>';
    try {
      const ps = await pedidosPorTelefone(inp.value);
      // sem link: o id do pedido só fica com quem fez o pedido (evita ver endereço de terceiros pelo celular)
      lista.innerHTML = ps.length ? ps.map((p) => `<div class="item"><b>#${esc(p.numero)} · ${esc(STATUS[p.status]?.rotulo || p.status)}</b><small>${dataHoraBR(p.criado_em)} · ${brl(p.total)} · ${esc(p.resumo || '')}</small></div>`).join('')
        + '<p class="muted small" style="margin-top:8px">Para ver os detalhes, abra o link do pedido neste aparelho ou fale com a gente pelo WhatsApp.</p>'
        : '<p class="muted small">Nenhum pedido nos últimos 2 dias com esse celular.</p>';
    } catch { lista.innerHTML = '<p class="aviso erro">Não foi possível buscar agora.</p>'; }
  });
  if (inp.value) form.requestSubmit();
}
