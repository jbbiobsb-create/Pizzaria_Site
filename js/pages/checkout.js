import { montarLayout, montarFooter, config, lojaPorSlug, enderecoLoja, hidratarIcones } from '../ui.js';
import { validarCupom, criarPedido, fidelidadeResumo, fidelidadeSaldo } from '../api.js';
import * as cart from '../cart.js';
import { qs, qsa, esc, brl, toast, lerLS, gravarLS, mascaraTelefone, soDigitos, debounce, PAGAMENTOS, dataHoraBR } from '../util.js';
import { LS } from '../config.js';
import { icone } from '../icons.js';
import { resumoItens } from '../repetir.js';
import { cfgFidelidade, programaAtivo, nivelBase, calcularPrevisto, calcularUso, minResgate, maxPctPedido, validadeDias, ligarCampoPin, abrirRegulamento, abrirEsqueciPin, salvarTelefone } from '../fidelidade.js';

montarLayout({ pagina: 'checkout', subheader: false });
montarFooter();
// a barra fixa só existe na coluna única; o body ganha o espaço dela
const ajustarBarra = () => document.body.classList.toggle('tem-barra', matchMedia('(max-width: 900px)').matches);
ajustarBarra(); window.addEventListener('resize', ajustarBarra);

const form = qs('#form-checkout');
const sessao = lerLS('ses_checkout', { quando: 'agora', agendado: null, cupom: null });
let CFG; let desconto = 0; let pagamento = null; let total = 0; let enviando = false;
let sub = 0; let taxa = 0;

// Clube Sesconetto's (cashback): resumo do celular (sem saldo), saldo (com PIN) e o que o cliente decidiu usar
const fid = { resumo: null, saldo: null, usar: false, valor: 0, pin: '', telefone: '', consultando: false, erro: '' };

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
  if (fid.usar && !fid.saldo) return 'Confirme o PIN do cashback (ou desligue "usar cashback")';
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

// totais (subtotal − cupom − cashback usado + taxa) e a linha "você ganha R$ X de cashback"
function recalcular() {
  const usado = fid.usar && fid.saldo ? fid.valor : 0;
  total = sub - desconto - usado + taxa;
  qs('[data-total]').textContent = brl(total);
  const lc = qs('[data-linha-cashback]'); lc.hidden = !(usado > 0);
  qs('[data-cashback-usado]').textContent = '− ' + brl(usado);
  const lg = qs('[data-linha-ganho]');
  const F = cfgFidelidade(CFG);
  if (programaAtivo(CFG)) {
    const pct = fid.resumo?.pct ?? nivelBase(F).pct;
    const ganho = calcularPrevisto(F, pct, sub - desconto - usado);
    lg.hidden = !(ganho > 0);
    lg.innerHTML = `${icone('presente')} <span>Você ${usado > 0 ? 'ainda ' : ''}ganha <b>${brl(ganho)}</b> de cashback quando este pedido for entregue</span>`;
  } else lg.hidden = true;
  atualizarBarra();
}

// ---------------------------------------------------------------
// Bloco "Cashback" (aparece quando o celular está completo)
// ---------------------------------------------------------------
const consultarResumo = debounce(async () => {
  if (!programaAtivo(CFG)) return;
  const tel = soDigitos(form.elements.telefone.value);
  if (tel.length < 10) { fid.resumo = null; fid.telefone = ''; limparSaldo(); renderCashback(); return; }
  if (tel === fid.telefone && fid.resumo) return;
  fid.telefone = tel; limparSaldo(); fid.consultando = true; renderCashback();
  try { fid.resumo = await fidelidadeResumo(tel); }
  catch { fid.resumo = null; }
  finally { fid.consultando = false; if (fid.telefone === tel) { renderCashback(); recalcular(); } }
}, 450);
form.elements.telefone.addEventListener('input', consultarResumo);
form.elements.telefone.addEventListener('blur', consultarResumo);

function limparSaldo() { fid.saldo = null; fid.usar = false; fid.valor = 0; fid.pin = ''; fid.erro = ''; }

function renderCashback() {
  const painel = qs('[data-painel-cashback]'); const el = qs('[data-cashback]');
  const F = cfgFidelidade(CFG);
  if (!programaAtivo(CFG) || (!fid.resumo && !fid.consultando)) { painel.hidden = true; return; }
  painel.hidden = false;
  if (fid.consultando && !fid.resumo) { el.innerHTML = `<div class="skeleton" style="min-height:72px"></div>`; return; }
  const r = fid.resumo;
  if (r.ativo === false) { painel.hidden = true; return; }
  const pct = r.pct ?? nivelBase(F).pct; const nivel = r.nivel || nivelBase(F).nome;
  const base = sub - desconto;
  const rodape = `<div class="rodape">Creditado quando o pedido é entregue · vale ${validadeDias(F)} dias · <button type="button" data-regulamento>Regulamento</button></div>`;

  if (!r.tem_pin) {
    // sem PIN (ou sem conta): só a prévia do ganho
    const ganho = calcularPrevisto(F, pct, base);
    el.innerHTML = `<div class="cb-bloco">
      <div class="linha">${icone('presente')}<span><b>Você vai ganhar ${brl(ganho)} de cashback</b> (${esc(pct)}% · nível ${esc(nivel)}) quando este pedido for entregue.${r.tem_conta ? ' Você já tem saldo acumulando: crie seu PIN na página do pedido para ver e usar.' : ' Sem cadastro: o cashback fica guardado no seu celular.'}</span></div>
      ${rodape}</div>`;
  } else {
    // tem PIN: toggle "usar" + PIN + saldo
    const uso = fid.saldo ? calcularUso(F, fid.saldo.saldo, base) : null;
    el.innerHTML = `<div class="cb-bloco">
      <div class="linha">${icone('moeda')}<span><b>Você tem cashback neste celular.</b> Quer usar neste pedido? Dá para pagar até ${esc(maxPctPedido(F))}% dos produtos (mínimo ${brl(minResgate(F))} de saldo).</span></div>
      <label class="switch-linha"><span>Usar meu cashback</span><span class="switch"><input type="checkbox" data-cb-usar ${fid.usar ? 'checked' : ''}><i></i></span></label>
      <div data-cb-pin ${fid.usar ? '' : 'hidden'}>
        ${fid.saldo ? `
          <div class="usar-ok"><span>Saldo <b>${brl(fid.saldo.saldo)}</b></span><span>${uso.valor > 0 ? `você usa <b>${brl(uso.valor)}</b>` : uso.abaixoMinimo ? `faltam ${brl(uso.faltam)} para usar` : 'nada a usar'}</span></div>
          ${uso.valor > 0 && uso.valor < Number(fid.saldo.saldo) ? `<div class="rodape">${uso.valor >= uso.teto - 0.001 ? `Máximo de ${esc(maxPctPedido(F))}% dos produtos por pedido; o resto continua no seu saldo.` : ''}</div>` : ''}
          ${uso.abaixoMinimo ? `<div class="rodape">Saldo abaixo do mínimo de ${brl(minResgate(F))}. Continue pedindo: este pedido rende mais cashback.</div>` : ''}`
        : `
          <div class="pin-linha">
            <div class="campo"><label for="ck-pin">PIN do Clube (4 dígitos)</label><input id="ck-pin" name="pin_cashback" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="••••" value="${esc(fid.pin)}"></div>
            <button type="button" class="btn" data-cb-confirmar>Confirmar</button>
          </div>
          <div class="aviso erro" data-cb-erro ${fid.erro ? '' : 'hidden'}>${esc(fid.erro)}</div>
          <div class="rodape"><button type="button" data-esqueci>Esqueci meu PIN</button></div>`}
      </div>
      ${rodape}</div>`;
    const chk = qs('[data-cb-usar]', el);
    chk.addEventListener('change', () => {
      fid.usar = chk.checked; fid.erro = '';
      if (!fid.usar) { fid.valor = 0; }
      else if (fid.saldo) { fid.valor = calcularUso(F, fid.saldo.saldo, base).valor; }
      renderCashback(); recalcular();
      if (fid.usar && !fid.saldo) setTimeout(() => qs('#ck-pin')?.focus({ preventScroll: true }), 50);
    });
    const pin = qs('#ck-pin', el);
    if (pin) {
      ligarCampoPin(pin);
      pin.addEventListener('input', () => { fid.pin = pin.value; });
      pin.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); qs('[data-cb-confirmar]', el)?.click(); } });
      qs('[data-cb-confirmar]', el).addEventListener('click', confirmarPin);
      qs('[data-esqueci]', el).addEventListener('click', () => abrirEsqueciPin(F, CFG.whatsapp, fid.telefone));
    }
  }
  qs('[data-regulamento]', el)?.addEventListener('click', () => abrirRegulamento(F));
  hidratarIcones(painel);
}

async function confirmarPin() {
  const F = cfgFidelidade(CFG);
  const erro = qs('[data-cb-erro]'); const btn = qs('[data-cb-confirmar]');
  if (!/^\d{4}$/.test(fid.pin)) { fid.erro = 'O PIN tem 4 dígitos.'; erro.textContent = fid.erro; erro.hidden = false; return; }
  btn.disabled = true; btn.textContent = 'Conferindo…';
  try {
    const r = await fidelidadeSaldo(fid.telefone, fid.pin);
    if (!r.ok) {
      fid.erro = r.motivo || 'PIN incorreto.'; fid.pin = '';
      renderCashback(); qs('#ck-pin')?.focus({ preventScroll: true });
      return;
    }
    fid.saldo = r; fid.erro = '';
    const uso = calcularUso(F, r.saldo, sub - desconto);
    fid.valor = uso.valor;
    salvarTelefone(fid.telefone);
    renderCashback(); recalcular();
    if (uso.valor > 0) toast(`Cashback aplicado: − ${brl(uso.valor)}`);
  } catch (e) {
    fid.erro = e.message || 'Não foi possível consultar agora.'; renderCashback();
  } finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = 'Confirmar'; } }
}

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
  sub = cart.subtotal();
  if (sessao.cupom) { try { const r = await validarCupom(sessao.cupom, sub); if (r.ok) { desconto = Number(r.desconto); qs('[data-linha-desconto]').hidden = false; qs('[data-cupom-nome]').textContent = r.codigo; qs('[data-desconto]').textContent = '− ' + brl(desconto); } else sessao.cupom = null; } catch {} }
  taxa = e.tipo === 'entrega' ? Number(e.taxa || 0) : 0;
  qs('[data-subtotal]').textContent = brl(sub);
  qs('[data-taxa]').textContent = taxa ? brl(taxa) + (e.a_confirmar ? ' (a confirmar)' : '') : 'grátis';
  qs('[data-quando]').innerHTML = sessao.quando === 'agendar' && sessao.agendado ? `${icone('calendario')} Agendado para ${dataHoraBR(sessao.agendado)}` : `${icone('relogio')} O mais rápido possível (${e.tipo === 'entrega' ? CFG.tempo_entrega_min + '–' + CFG.tempo_entrega_max : CFG.tempo_retirada_min + '–' + CFG.tempo_retirada_max} min após confirmar)`;
  recalcular();
  // celular já salvo: consulta o Clube de cara
  consultarResumo();
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
  if (fid.usar && !fid.saldo) falhas.push('Confirme o PIN do cashback ou desligue "Usar meu cashback".');
  if (!f.aceite.checked) falhas.push('Confirme que os dados estão corretos.');
  if (falhas.length) { erro.innerHTML = falhas.join('<br>'); erro.hidden = false; erro.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast(falhas[0], 'erro'); return; }

  const e = cart.entrega();
  const usarCashback = !!(fid.usar && fid.saldo && fid.valor > 0);
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
    // Clube: o servidor valida o PIN, calcula o teto e debita; o valor exato volta em cashback_usado
    usar_cashback: usarCashback,
    pin: usarCashback ? fid.pin : null,
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
    enviando = false; btns.forEach((b) => { b.disabled = false; b.textContent = 'Confirmar pedido'; });
    if (err.cashback && usarCashback) {
      // PIN recusado / saldo mudou: mostra no bloco do cashback e pede o PIN de novo, sem perder o formulário
      fid.saldo = null; fid.valor = 0; fid.pin = ''; fid.erro = err.message;
      renderCashback(); recalcular();
      qs('[data-painel-cashback]').scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast(err.message, 'erro');
      return;
    }
    erro.textContent = err.message || 'Não foi possível enviar o pedido. Tente de novo.';
    erro.hidden = false; erro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(erro.textContent, 'erro');
    atualizarBarra();
  }
});
