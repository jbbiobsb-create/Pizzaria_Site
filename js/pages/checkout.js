import { montarLayout, montarFooter, config, lojaPorSlug, enderecoLoja } from '../ui.js';
import { validarCupom, criarPedido } from '../api.js';
import * as cart from '../cart.js';
import { qs, qsa, esc, brl, toast, lerLS, gravarLS, mascaraTelefone, PAGAMENTOS, dataHoraBR } from '../util.js';
import { LS } from '../config.js';
import { icone } from '../icons.js';

montarLayout({ pagina: 'carrinho', subheader: false });
montarFooter();

const form = qs('#form-checkout');
const sessao = lerLS('ses_checkout', { quando: 'agora', agendado: null, cupom: null });
let CFG; let desconto = 0; let pagamento = null;

if (!cart.itens().length || !cart.entrega()) { location.replace('carrinho.html'); }

// dados salvos do cliente
const cli = lerLS(LS.cliente, {});
if (cli.nome) form.elements.nome.value = cli.nome;
if (cli.telefone) form.elements.telefone.value = mascaraTelefone(cli.telefone);
if (cli.email) form.elements.email.value = cli.email;
form.elements.telefone.addEventListener('input', (e) => (e.target.value = mascaraTelefone(e.target.value)));

(async () => {
  CFG = await config();
  const e = cart.entrega();
  qs('[data-titulo-entrega]').textContent = e.tipo === 'entrega' ? 'Entrega' : 'Retirada na loja';
  qs('[data-resumo-entrega]').innerHTML = e.tipo === 'entrega'
    ? `${esc(e.endereco.rua)}, ${esc(e.endereco.numero)}${e.endereco.complemento ? ' - ' + esc(e.endereco.complemento) : ''}<br>${esc(e.endereco.bairro)} — ${esc(e.endereco.cidade)}/${esc(e.endereco.uf)}${e.endereco.referencia ? '<br>Ref.: ' + esc(e.endereco.referencia) : ''}<br><a href="carrinho.html" class="small">alterar</a>`
    : `<b>Loja ${esc(lojaPorSlug(CFG, e.loja)?.nome || '')}</b><br>${esc(enderecoLoja(lojaPorSlug(CFG, e.loja)))}<br><a href="carrinho.html" class="small">alterar</a>`;

  // pagamentos disponíveis
  const lista = qs('[data-pagamentos]');
  lista.innerHTML = (CFG.pagamentos || []).map((p) => PAGAMENTOS[p] ? `<button type="button" class="opcao" data-pg="${p}"><b>${icone(PAGAMENTOS[p].icone)} ${PAGAMENTOS[p].rotulo}</b><small>${PAGAMENTOS[p].desc}</small></button>` : '').join('');
  qsa('[data-pg]', lista).forEach((b) => b.addEventListener('click', () => {
    pagamento = b.dataset.pg;
    qsa('[data-pg]', lista).forEach((x) => x.classList.toggle('ativo', x === b));
    qs('[data-troco]').hidden = pagamento !== 'dinheiro';
    qs('[data-aviso-pix]').hidden = pagamento !== 'pix';
  }));
  qs(`[data-pg="${cli.pagamento}"]`)?.click();

  // resumo
  qs('[data-itens]').innerHTML = cart.itens().map((i) => `
    <div class="item-carrinho" style="grid-template-columns:1fr auto;padding:8px 0">
      <div><b>${i.quantidade}× ${esc(i.nome)}</b>${i.descricao ? `<small>${esc(i.descricao)}</small>` : ''}${i.observacao ? `<small>Obs.: ${esc(i.observacao)}</small>` : ''}</div>
      <span class="p strong">${brl(i.preco * i.quantidade)}</span>
    </div>`).join('');
  const sub = cart.subtotal();
  if (sessao.cupom) { try { const r = await validarCupom(sessao.cupom, sub); if (r.ok) { desconto = Number(r.desconto); qs('[data-linha-desconto]').hidden = false; qs('[data-cupom-nome]').textContent = r.codigo; qs('[data-desconto]').textContent = '− ' + brl(desconto); } else sessao.cupom = null; } catch {} }
  const taxa = e.tipo === 'entrega' ? Number(e.taxa || 0) : 0;
  qs('[data-subtotal]').textContent = brl(sub);
  qs('[data-taxa]').textContent = taxa ? brl(taxa) + (e.a_confirmar ? ' (a confirmar)' : '') : 'grátis';
  qs('[data-total]').textContent = brl(sub - desconto + taxa);
  qs('[data-quando]').innerHTML = sessao.quando === 'agendar' && sessao.agendado ? `${icone('calendario')} Agendado para ${dataHoraBR(sessao.agendado)}` : `${icone('relogio')} O mais rápido possível (${e.tipo === 'entrega' ? CFG.tempo_entrega_min + '–' + CFG.tempo_entrega_max : CFG.tempo_retirada_min + '–' + CFG.tempo_retirada_max} min após confirmar)`;
})();

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erro = qs('[data-erro]'); erro.hidden = true;
  const f = form.elements;
  const falhas = [];
  if (f.nome.value.trim().length < 2) falhas.push('Informe seu nome.');
  if (f.telefone.value.replace(/\D/g, '').length < 10) falhas.push('Informe um celular válido com DDD.');
  if (!pagamento) falhas.push('Escolha a forma de pagamento.');
  if (!f.aceite.checked) falhas.push('Confirme que os dados estão corretos.');
  if (falhas.length) { erro.innerHTML = falhas.join('<br>'); erro.hidden = false; erro.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

  const e = cart.entrega();
  const payload = {
    cliente: { nome: f.nome.value.trim(), telefone: f.telefone.value, email: f.email.value.trim() || null },
    tipo_entrega: e.tipo,
    endereco: e.tipo === 'entrega' ? e.endereco : null,
    loja: e.tipo === 'retirada' ? e.loja : null,  // na entrega o servidor escolhe a loja mais próxima
    agendado_para: sessao.quando === 'agendar' && sessao.agendado ? new Date(sessao.agendado).toISOString() : null,
    observacoes: f.observacoes.value.trim() || null,
    pagamento,
    troco_para: pagamento === 'dinheiro' && f.troco_para.value ? Number(String(f.troco_para.value).replace(',', '.')) : null,
    cupom: sessao.cupom || null,
    itens: cart.paraPedido(),
  };
  const btn = qs('[data-confirmar]'); btn.disabled = true; btn.textContent = 'Enviando pedido…';
  try {
    const pedido = await criarPedido(payload);
    gravarLS(LS.cliente, { nome: payload.cliente.nome, telefone: payload.cliente.telefone, email: payload.cliente.email, pagamento });
    gravarLS(LS.ultimoPedido, { id: pedido.id, numero: pedido.numero, em: Date.now() });
    cart.limpar();
    localStorage.removeItem('ses_checkout');
    location.href = `pedido.html?id=${pedido.id}&novo=1`;
  } catch (err) {
    erro.textContent = err.message || 'Não foi possível enviar o pedido. Tente de novo.';
    erro.hidden = false; erro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btn.disabled = false; btn.textContent = 'Confirmar pedido';
  }
});
