import { montarLayout, montarFooter, config, lojaPorSlug, enderecoLoja } from '../ui.js';
import { validarCupom, criarPedido } from '../api.js';
import * as cart from '../cart.js';
import { qs, qsa, esc, brl, toast, lerLS, gravarLS, mascaraTelefone, PAGAMENTOS, dataHoraBR } from '../util.js';
import { LS } from '../config.js';
import { icone } from '../icons.js';
import { resumoItens } from '../repetir.js';

montarLayout({ pagina: 'checkout', subheader: false });
montarFooter();
// a barra fixa só existe na coluna única; o body ganha o espaço dela
const ajustarBarra = () => document.body.classList.toggle('tem-barra', matchMedia('(max-width: 900px)').matches);
ajustarBarra(); window.addEventListener('resize', ajustarBarra);

const form = qs('#form-checkout');
const sessao = lerLS('ses_checkout', { quando: 'agora', agendado: null, cupom: null });
let CFG; let desconto = 0; let pagamento = null; let total = 0; let enviando = false;

const redirecionando = !cart.itens().length || !cart.entrega();
if (redirecionando) location.replace('carrinho.html');

// dados salvos do cliente
const cli = lerLS(LS.cliente, {});
if (cli.nome) form.elements.nome.value = cli.nome;
if (cli.telefone) form.elements.telefone.value = mascaraTelefone(cli.telefone);
if (cli.email) form.elements.email.value = cli.email;
form.elements.telefone.addEventListener('input', (e) => (e.target.value = mascaraTelefone(e.target.value)));

// o que ainda falta para poder confirmar (primeira pendência, em ordem de tela)
function pendencia() {
  const f = form.elements;
  if (f.nome.value.trim().length < 2) return 'Falta informar seu nome';
  if (f.telefone.value.replace(/\D/g, '').length < 10) return 'Falta um celular válido com DDD';
  if (!pagamento) return 'Falta escolher o pagamento';
  if (!f.aceite.checked) return 'Falta confirmar os dados';
  return '';
}
function atualizarBarra() {
  const p = pendencia();
  const b = qs('[data-confirmar-barra]'); const falta = qs('[data-falta]');
  b.disabled = !!p || enviando;
  falta.textContent = p; falta.hidden = !p;
  qs('[data-total-barra]').textContent = total ? brl(total) : '—';
}
form.addEventListener('input', atualizarBarra);
form.addEventListener('change', atualizarBarra);
qs('[data-confirmar-barra]').addEventListener('click', () => form.requestSubmit());

(async () => {
  if (redirecionando) return;
  CFG = await config();
  const e = cart.entrega();
  qs('[data-titulo-entrega]').textContent = e.tipo === 'entrega' ? 'Entrega' : 'Retirada na loja';
  qs('[data-resumo-entrega]').innerHTML = e.tipo === 'entrega'
    ? `${esc(e.endereco.rua)}, ${esc(e.endereco.numero)}${e.endereco.complemento ? ' - ' + esc(e.endereco.complemento) : ''}<br>${esc(e.endereco.bairro)} — ${esc(e.endereco.cidade)}/${esc(e.endereco.uf)}${e.endereco.referencia ? '<br>Ref.: ' + esc(e.endereco.referencia) : ''}<br><a href="carrinho.html" class="link-acao small">${icone('lapis')} alterar</a>`
    : `<b>Loja ${esc(lojaPorSlug(CFG, e.loja)?.nome || '')}</b><br>${esc(enderecoLoja(lojaPorSlug(CFG, e.loja)))}<br><a href="carrinho.html" class="link-acao small">${icone('lapis')} alterar</a>`;

  // pagamentos disponíveis
  const lista = qs('[data-pagamentos]');
  lista.innerHTML = (CFG.pagamentos || []).map((p) => PAGAMENTOS[p] ? `<button type="button" class="opcao" data-pg="${p}"><b>${icone(PAGAMENTOS[p].icone)} ${PAGAMENTOS[p].rotulo}</b><small>${PAGAMENTOS[p].desc}</small></button>` : '').join('');
  qsa('[data-pg]', lista).forEach((b) => b.addEventListener('click', () => {
    pagamento = b.dataset.pg;
    qsa('[data-pg]', lista).forEach((x) => x.classList.toggle('ativo', x === b));
    qs('[data-troco]').hidden = pagamento !== 'dinheiro';
    qs('[data-aviso-pix]').hidden = pagamento !== 'pix';
    atualizarBarra();
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
  total = sub - desconto + taxa;
  qs('[data-total]').textContent = brl(total);
  qs('[data-quando]').innerHTML = sessao.quando === 'agendar' && sessao.agendado ? `${icone('calendario')} Agendado para ${dataHoraBR(sessao.agendado)}` : `${icone('relogio')} O mais rápido possível (${e.tipo === 'entrega' ? CFG.tempo_entrega_min + '–' + CFG.tempo_entrega_max : CFG.tempo_retirada_min + '–' + CFG.tempo_retirada_max} min após confirmar)`;
  atualizarBarra();
})();

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (enviando) return;
  const erro = qs('[data-erro]'); erro.hidden = true;
  const f = form.elements;
  const falhas = [];
  if (f.nome.value.trim().length < 2) falhas.push('Informe seu nome.');
  if (f.telefone.value.replace(/\D/g, '').length < 10) falhas.push('Informe um celular válido com DDD.');
  if (!pagamento) falhas.push('Escolha a forma de pagamento.');
  if (!f.aceite.checked) falhas.push('Confirme que os dados estão corretos.');
  if (falhas.length) { erro.innerHTML = falhas.join('<br>'); erro.hidden = false; erro.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast(falhas[0], 'erro'); return; }

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
  const btns = [qs('[data-confirmar]'), qs('[data-confirmar-barra]')];
  enviando = true; btns.forEach((b) => { b.disabled = true; b.textContent = 'Enviando pedido…'; });
  try {
    const itens = cart.itens();
    const pedido = await criarPedido(payload);
    gravarLS(LS.cliente, { nome: payload.cliente.nome, telefone: payload.cliente.telefone, email: payload.cliente.email, pagamento });
    // guarda os itens para o "Pedir de novo" (formato da sacola; revalidado contra o cardápio ao repetir)
    gravarLS(LS.ultimoPedido, { id: pedido.id, numero: pedido.numero, em: Date.now(), total: Number(pedido.total ?? total), itens, resumo: resumoItens(itens) });
    cart.limpar();
    localStorage.removeItem('ses_checkout');
    location.href = `pedido.html?id=${pedido.id}&novo=1`;
  } catch (err) {
    erro.textContent = err.message || 'Não foi possível enviar o pedido. Tente de novo.';
    erro.hidden = false; erro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(erro.textContent, 'erro');
    enviando = false; btns.forEach((b) => { b.disabled = false; b.textContent = 'Confirmar pedido'; });
    atualizarBarra();
  }
});
