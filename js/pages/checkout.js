// Tela única "Fechar pedido": itens editáveis → como recebe (inline) → quem recebe → como paga → confirmar.
// Substitui carrinho.html + checkout.html. Tudo que é opcional fica recolhido (e-mail, observações, cupom, agendar, troco).
import { montarLayout, montarFooter, config, lojaPorSlug, enderecoLoja, hidratarIcones, entregaHTML, montarEntrega, sugestoesCompleta, proximaAbertura } from '../ui.js';
import { validarCupom, criarPedido, fidelidadeResumo, fidelidadeSaldo } from '../api.js';
import * as cart from '../cart.js';
import { ativarAddRapido, atualizarSteppers, nomeCurto } from '../cards.js';
import { qs, qsa, esc, brl, toast, lerLS, gravarLS, mascaraTelefone, soDigitos, debounce, PAGAMENTOS, rotuloPagamento, dataHoraBR, DIAS, faixaMin, track } from '../util.js';
import { LS } from '../config.js';
import { icone } from '../icons.js';
import { resumoItens, ultimoPedidoLocal, itensDoUltimoPedido, repetirItens, mensagemRepetir } from '../repetir.js';
import { cfgFidelidade, programaAtivo, nivelBase, calcularPrevisto, calcularUso, minResgate, maxPctPedido, validadeDias, ligarCampoPin, abrirRegulamento, abrirEsqueciPin, salvarTelefone } from '../fidelidade.js';

montarLayout({ pagina: 'checkout', subheader: false });
montarFooter();
ativarAddRapido();

const form = qs('#form-checkout');
const sessao = lerLS('ses_checkout', { quando: 'agora', agendado: null, cupom: null });
function salvarSessao() { gravarLS('ses_checkout', sessao); }
let CFG = null; let desconto = 0; let pagamento = null; let total = 0; let enviando = false;
let sub = 0; let taxa = 0; let cupomInfo = null;

// Clube Sesconetto's (cashback): resumo do celular (sem saldo), saldo (com PIN) e o que o cliente decidiu usar
const fid = { resumo: null, saldo: null, usar: false, valor: 0, pin: '', telefone: '', consultando: false, erro: '' };

// dados lembrados do último pedido: nome, celular, e-mail e pagamento
const cli = lerLS(LS.cliente, {});
if (cli.nome) form.elements.nome.value = cli.nome;
if (cli.telefone) form.elements.telefone.value = mascaraTelefone(cli.telefone);
if (cli.email) { form.elements.email.value = cli.email; qs('[data-email-detalhe]').open = true; }
form.elements.telefone.addEventListener('input', (e) => (e.target.value = mascaraTelefone(e.target.value)));

const vazio = () => !cart.itens().length;
const ajustarBarra = () => document.body.classList.toggle('tem-barra', !vazio() && matchMedia('(max-width: 900px)').matches);
window.addEventListener('resize', ajustarBarra);

track('abrir_fechar_pedido', { itens: cart.quantidadeTotal(), valor: cart.subtotal() });

// ---------------------------------------------------------------
// 1. Itens (editáveis) + sacola vazia
// ---------------------------------------------------------------
function renderItens() {
  const el = qs('[data-itens]');
  const itens = cart.itens();
  const v = !itens.length;
  ['[data-painel-entrega]', '[data-painel-cliente]', '[data-painel-pagamento]', '[data-painel-opcionais]', '[data-painel-resumo]', '[data-barra-confirmar]'].forEach((s) => (qs(s).hidden = v));
  qs('[data-limpar]').hidden = v; qs('[data-mais-itens]').hidden = v;
  qs('.titulo-pagina').hidden = v;
  if (v) qs('[data-completa]').hidden = true;
  ajustarBarra();
  if (v) {
    const u = ultimoPedidoLocal();
    const fechada = CFG && !CFG.aberta;
    el.innerHTML = `<div class="vazio"><div class="ic">${icone('sacola')}</div><h2>Ainda sem pizza por aqui.</h2>
      <p class="muted">${fechada ? `Abrimos às ${esc(proximaAbertura(CFG))}. Monte o pedido e agende que a gente assa na hora.` : `As mais pedidas saem do forno em ${CFG ? Number(CFG.tempo_entrega_min) : 40} minutos.`}</p>
      <div class="acoes"><a class="btn btn-lg" href="cardapio.html#mais-pedidas">${fechada ? 'Ver cardápio e agendar' : 'Ver as mais pedidas'}</a>${u ? `<button type="button" class="btn btn-outline btn-lg" data-repetir>${icone('repetir')} Repetir o pedido #${esc(u.numero)}${u.total ? ` · ${brl(u.total)}` : ''}</button>` : ''}</div></div>`;
    qs('[data-repetir]', el)?.addEventListener('click', async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      try { const uu = await itensDoUltimoPedido(); const r = await repetirItens(uu?.itens || []); const m = mensagemRepetir(r); toast(m.msg, m.tipo, 3500); }
      catch { toast('Não deu para repetir agora. Tente pelo cardápio.', 'erro'); }
      finally { b.disabled = false; }
    });
    return;
  }
  el.innerHTML = itens.map((i) => `
    <div class="item-carrinho">
      ${i.imagem ? `<img src="${esc(i.imagem)}" alt="" width="56" height="56">` : `<div class="ph">${icone(i.tipo === 'pizza' ? 'pizza' : 'bebida')}</div>`}
      <div>
        <b>${esc(i.nome)}</b>
        ${i.descricao ? `<small>${esc(i.descricao)}</small>` : ''}
        ${i.observacao ? `<small>Obs.: ${esc(i.observacao)}</small>` : ''}
        <div class="qtd qtd-sm"><button type="button" data-q="${i.uid}" data-d="-1" aria-label="Diminuir quantidade">${icone('menos')}</button><span aria-live="polite">${i.quantidade}</span><button type="button" data-q="${i.uid}" data-d="1" aria-label="Aumentar quantidade">${icone('mais')}</button></div>
      </div>
      <div class="acoes"><span class="p">${brl(i.preco * i.quantidade)}</span><button type="button" class="remover" data-rm="${i.uid}" aria-label="Remover ${esc(i.nome)}">${icone('lixeira')}</button></div>
    </div>`).join('');
  qsa('[data-q]', el).forEach((b) => b.addEventListener('click', () => cart.alterarQtd(b.dataset.q, Number(b.dataset.d))));
  qsa('[data-rm]', el).forEach((b) => b.addEventListener('click', () => { cart.remover(b.dataset.rm); toast('Item removido'); }));
}
qs('[data-limpar]').addEventListener('click', () => { if (confirm('Esvaziar a sacola?')) cart.limpar(); });

// ---------------------------------------------------------------
// 2. Como recebe (componente inline) + quando (agora / agendar)
// ---------------------------------------------------------------
qs('[data-entrega-inline]').innerHTML = entregaHTML('ck');
const entrega = montarEntrega(qs('[data-entrega-inline] [data-entrega]'), { aoSalvar: () => { renderQuando(); renderTotais(); } });

const chaves = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
let agendaMontada = false;
function montarAgenda() {
  const dia = qs('[data-ag-dia]'); const hora = qs('[data-ag-hora]');
  if (agendaMontada) { renderHoras(); return; }
  agendaMontada = true;
  const hoje = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoje); d.setDate(hoje.getDate() + i);
    const k = chaves[d.getDay()];
    if (!CFG.horario?.[k]) continue;
    const opt = document.createElement('option');
    opt.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    opt.textContent = (i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DIAS[k]) + ` (${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')})`;
    dia.appendChild(opt);
  }
  dia.addEventListener('change', renderHoras);
  hora.addEventListener('change', () => { sessao.agendado = hora.value ? `${dia.value}T${hora.value}:00` : null; salvarSessao(); renderQuando(); });
  renderHoras();
  function renderHoras() {
    hora.innerHTML = '';
    const d = new Date(dia.value + 'T12:00:00');
    const k = chaves[d.getDay()];
    const [ini, fim] = CFG.horario[k];
    const minAntec = new Date(Date.now() + 40 * 60000);
    let [h, m] = ini.split(':').map(Number); const [hf, mf] = fim.split(':').map(Number);
    m += 30; // primeiro slot: abertura + tempo de preparo
    while (h * 60 + m <= hf * 60 + mf) {
      const slot = new Date(`${dia.value}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      if (slot > minAntec) { const o = document.createElement('option'); o.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; o.textContent = o.value; hora.appendChild(o); }
      m += 15; if (m >= 60) { m -= 60; h++; }
    }
    if (!hora.options.length) { const o = document.createElement('option'); o.value = ''; o.textContent = 'Sem horários neste dia'; hora.appendChild(o); sessao.agendado = null; }
    else sessao.agendado = `${dia.value}T${hora.value}:00`;
    salvarSessao(); renderQuando();
  }
}
const detAgendar = qs('[data-agendar-detalhe]');
detAgendar.addEventListener('toggle', () => {
  if (detAgendar.open) { sessao.quando = 'agendar'; if (CFG) montarAgenda(); }
  else if (CFG?.aberta) { sessao.quando = 'agora'; sessao.agendado = null; }
  salvarSessao(); renderQuando();
});
qs('[data-agendar-cancelar]').addEventListener('click', () => { if (!CFG?.aberta) return; detAgendar.open = false; });

function renderQuando() {
  if (!CFG) return;
  const e = cart.entrega();
  const txt = qs('[data-quando-txt]'); const resumo = qs('[data-quando]');
  const tempo = e?.tipo === 'retirada' ? faixaMin(CFG.tempo_retirada_min, CFG.tempo_retirada_max) : faixaMin(CFG.tempo_entrega_min, CFG.tempo_entrega_max);
  if (!CFG.aberta) {
    // loja fechada: agendamento inline obrigatório (sem beco)
    if (sessao.quando !== 'agendar') { sessao.quando = 'agendar'; salvarSessao(); }
    if (!detAgendar.open) detAgendar.open = true; // o evento "toggle" monta a agenda
    qs('[data-agendar-cancelar]').hidden = true;
    txt.innerHTML = `${icone('relogio')} <b>Ainda não abrimos, o forno acende às ${esc(proximaAbertura(CFG))}.</b> Escolha o horário e a gente assa na hora.`;
    qs('[data-agendar-titulo]').textContent = 'Para quando?';
  } else {
    qs('[data-agendar-cancelar]').hidden = false;
    txt.innerHTML = sessao.quando === 'agendar' && sessao.agendado
      ? `${icone('calendario')} <b>Agendado para ${esc(dataHoraBR(sessao.agendado))}</b>`
      : `${icone('relogio')} <b>O mais rápido possível</b> · ${e?.tipo === 'retirada' ? 'sai do forno' : 'chega'} em ${esc(tempo)}`;
  }
  resumo.innerHTML = sessao.quando === 'agendar' && sessao.agendado ? `${icone('calendario')} Agendado para ${esc(dataHoraBR(sessao.agendado))}` : `${icone('relogio')} ${e?.tipo === 'retirada' ? 'Sai do forno' : 'Chega'} em ${esc(tempo)} depois de confirmar`;
  atualizarBarra();
}

// ---------------------------------------------------------------
// 3. Pagamento (3 opções grandes; a última escolha vem pré-marcada)
// ---------------------------------------------------------------
function renderPagamentos() {
  const lista = qs('[data-pagamentos]');
  const e = cart.entrega();
  lista.innerHTML = (CFG.pagamentos || []).map((p) => PAGAMENTOS[p] ? `<button type="button" class="opcao ${pagamento === p ? 'ativo' : ''}" data-pg="${p}"><b>${icone(PAGAMENTOS[p].icone)} ${esc(rotuloPagamento(p, e?.tipo))}</b><small>${esc(PAGAMENTOS[p].desc)}</small></button>` : '').join('');
  qsa('[data-pg]', lista).forEach((b) => b.addEventListener('click', () => escolherPagamento(b.dataset.pg)));
}
function escolherPagamento(p) {
  pagamento = p;
  qsa('[data-pg]').forEach((x) => x.classList.toggle('ativo', x.dataset.pg === p));
  qs('[data-troco]').hidden = p !== 'dinheiro';
  qs('[data-aviso-pix]').hidden = p !== 'pix';
  track('pagamento_escolhido', { pagamento: p });
  atualizarBarra();
}

// ---------------------------------------------------------------
// 4. Totais, cupom, pendências e barra fixa
// ---------------------------------------------------------------
async function aplicarCupom(codigo) {
  const msg = qs('[data-cupom-msg]');
  sessao.cupom = codigo || null; salvarSessao();
  desconto = 0; cupomInfo = null; msg.textContent = '';
  if (sessao.cupom) {
    try {
      const r = await validarCupom(sessao.cupom, cart.subtotal());
      if (r.ok) { desconto = Number(r.desconto); cupomInfo = r; msg.innerHTML = `${icone('check')} ${esc(r.codigo)}: ${esc(r.descricao || 'desconto aplicado')} · você economiza <b>${brl(desconto)}</b>`; msg.style.color = 'var(--verde-ok)'; }
      else { msg.textContent = /expir|venc/i.test(r.motivo || '') ? 'Esse cupom venceu.' : 'Esse cupom não vale hoje. O pedido segue sem desconto.'; msg.style.color = 'var(--erro)'; sessao.cupom = null; salvarSessao(); }
    } catch { msg.textContent = 'Não deu para conferir o cupom agora.'; msg.style.color = 'var(--erro)'; }
  }
  recalcular();
}
qs('[data-cupom-btn]').addEventListener('click', () => aplicarCupom(qs('[data-cupom-input]').value.trim().toUpperCase()));
qs('[data-cupom-input]').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); qs('[data-cupom-btn]').click(); } });
if (sessao.cupom) { qs('[data-cupom-input]').value = sessao.cupom; qs('[data-cupom-detalhe]').open = true; }

function renderTotais() {
  const e = cart.entrega();
  sub = cart.subtotal();
  taxa = e?.tipo === 'entrega' ? Number(e.taxa || 0) : 0;
  qs('[data-subtotal]').textContent = brl(sub);
  qs('[data-linha-desconto]').hidden = !desconto;
  qs('[data-cupom-nome]').textContent = cupomInfo?.codigo || sessao.cupom || '';
  qs('[data-desconto]').textContent = '− ' + brl(desconto);
  qs('[data-taxa]').textContent = !e ? 'a calcular' : taxa === 0 ? 'grátis' : brl(taxa) + (e.a_confirmar ? '*' : '');
  const min = Number(CFG?.pedido_minimo || 0);
  qs('[data-aviso-minimo]').textContent = min && sub < min ? `Pedido mínimo para entrega: ${brl(min)}. Faltam ${brl(min - sub)}, uma bebida resolve.` : (e?.a_confirmar ? '* Taxa estimada; a pizzaria confirma pelo WhatsApp.' : '');
  if (CFG) renderPagamentos();
  recalcular();
}

// totais (subtotal − cupom − cashback usado + taxa) e a linha "não perca R$ X de volta"
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
    lg.innerHTML = `${icone('presente')} <span>Não perca <b>${brl(ganho)} de volta</b> neste pedido: entra no seu celular quando a pizza chegar.</span>`;
  } else lg.hidden = true;
  atualizarBarra();
}

// o que ainda falta para poder confirmar (primeira pendência, na ordem da tela)
function pendencia() {
  const f = form.elements; const e = cart.entrega();
  if (vazio()) return 'Sua sacola está vazia';
  if (!e) return qs('#form-checkout [data-tipo-entrega] .ativo')?.dataset.tipo === 'retirada' ? 'Escolha a loja' : 'Falta o endereço';
  if (e.tipo === 'entrega' && !e.endereco) return 'Falta o endereço';
  if (e.tipo === 'retirada' && !e.loja) return 'Escolha a loja';
  if (CFG && !CFG.aberta && !sessao.agendado) return 'Escolha o horário';
  if (sessao.quando === 'agendar' && !sessao.agendado) return 'Escolha o dia e a hora';
  const min = Number(CFG?.pedido_minimo || 0);
  if (min && sub < min) return `Pedido mínimo: ${brl(min)}`;
  if (f.nome.value.trim().length < 2) return 'Falta seu nome';
  if (soDigitos(f.telefone.value).length < 10) return 'Falta o celular';
  if (!pagamento) return 'Escolha como paga';
  if (fid.usar && !fid.saldo) return 'Confirme o PIN do cashback (ou desligue "usar cashback")';
  return '';
}
function atualizarBarra() {
  const p = pendencia();
  const b = qs('[data-confirmar-barra]'); const falta = qs('[data-falta]');
  b.disabled = !!p || enviando;
  qs('[data-confirmar]').disabled = !!p || enviando;
  falta.textContent = p || 'Ao confirmar, você aceita o horário e a área de entrega.';
  falta.classList.toggle('pronto', !p);
  qs('[data-total-barra]').textContent = brl(total);
}
form.addEventListener('input', atualizarBarra);
form.addEventListener('change', atualizarBarra);
qs('[data-confirmar-barra]').addEventListener('click', () => form.requestSubmit());

// ---------------------------------------------------------------
// "Completa com": bebida mais pedida, doce, molho (1 toque cada, sem sheet)
// ---------------------------------------------------------------
let completaMontada = false;
async function renderCompleta() {
  if (completaMontada || vazio()) return;
  completaMontada = true;
  try {
    const lista = await sugestoesCompleta(cart.itens());
    const el = qs('[data-completa]');
    if (!lista.length) { el.hidden = true; return; }
    qs('[data-completa-lista]').innerHTML = lista.map((p) => `
      <div class="completa-item">
        ${p.imagem_url ? `<img src="${esc(p.imagem_url)}" alt="" loading="lazy" width="48" height="48">` : `<div class="ph">${icone(p.categoria === 'sobremesas' ? 'sobremesa' : p.categoria === 'molhos' ? 'molho' : 'bebida')}</div>`}
        <div class="txt"><b>${esc(nomeCurto(p.nome))}</b><span class="p">${brl(p.preco)}</span></div>
        <span data-rapido="${esc(p.slug)}"><button type="button" class="add" data-add-rapido="${esc(p.slug)}" aria-label="Adicionar ${esc(p.nome)}">${icone('mais')}</button></span>
      </div>`).join('');
    el.hidden = false;
    atualizarSteppers(el);
  } catch { completaMontada = false; }
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
  if (vazio() || !programaAtivo(CFG) || (!fid.resumo && !fid.consultando)) { painel.hidden = true; return; }
  painel.hidden = false;
  if (fid.consultando && !fid.resumo) { el.innerHTML = `<div class="skeleton" style="min-height:72px"></div>`; return; }
  const r = fid.resumo;
  if (r.ativo === false) { painel.hidden = true; return; }
  const pct = r.pct ?? nivelBase(F).pct; const nivel = r.nivel || nivelBase(F).nome;
  const base = sub - desconto;
  const rodape = `<div class="rodape">Creditado quando o pedido é entregue · vale ${validadeDias(F)} dias · <button type="button" data-regulamento>Regulamento</button></div>`;

  if (!r.tem_pin) {
    const ganho = calcularPrevisto(F, pct, base);
    el.innerHTML = `<div class="cb-bloco">
      <div class="linha">${icone('presente')}<span><b>Não perca ${brl(ganho)} de volta neste pedido</b> (${esc(pct)}% · nível ${esc(nivel)}): entra no seu celular quando a pizza chegar.${r.tem_conta ? ' Você já tem saldo acumulando: crie seu PIN na página do pedido para ver e usar.' : ' Sem cadastro: o cashback fica guardado no seu celular.'}</span></div>
      ${rodape}</div>`;
  } else {
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

// ---------------------------------------------------------------
// Confirmar
// ---------------------------------------------------------------
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (enviando) return;
  const erro = qs('[data-erro]'); erro.hidden = true;
  const f = form.elements; const e = cart.entrega();
  const falhas = [];
  if (vazio()) falhas.push('Sua sacola está vazia.');
  if (!e) falhas.push('Escolha entrega ou retirada.');
  if (CFG && !CFG.aberta && !sessao.agendado) falhas.push(`Fechamos por hoje. Agende para a partir das ${proximaAbertura(CFG)} e a gente assa na hora.`);
  if (f.nome.value.trim().length < 2) falhas.push('Falta seu nome. Como devemos te chamar?');
  if (soDigitos(f.telefone.value).length < 10) falhas.push('Confere o celular? Precisa do DDD, ex.: (61) 99999-9999.');
  if (!pagamento) falhas.push('Escolha como você paga.');
  if (fid.usar && !fid.saldo) falhas.push('Confirme o PIN do cashback ou desligue "Usar meu cashback".');
  if (falhas.length) { erro.innerHTML = falhas.map(esc).join('<br>'); erro.hidden = false; erro.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast(falhas[0], 'erro'); return; }

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
  track('confirmar', { tipo: e.tipo, pagamento, itens: payload.itens.length, total, agendado: !!payload.agendado_para });
  try {
    const itens = cart.itens();
    const pedido = await criarPedido(payload);
    track('pedido_ok', { numero: pedido.numero, total: Number(pedido.total ?? total) });
    gravarLS(LS.cliente, { nome: payload.cliente.nome, telefone: payload.cliente.telefone, email: payload.cliente.email, pagamento });
    // guarda os itens para o "Pedir de novo" (formato da sacola; revalidado contra o cardápio ao repetir)
    gravarLS(LS.ultimoPedido, {
      id: pedido.id, numero: pedido.numero, em: Date.now(), total: Number(pedido.total ?? total), itens, resumo: resumoItens(itens),
      tipo_entrega: e.tipo, endereco_txt: e.tipo === 'entrega' ? `${e.endereco.rua}, ${e.endereco.numero}` : (e.loja_nome || lojaPorSlug(CFG, e.loja)?.nome || ''), pagamento,
    });
    cart.limpar();
    localStorage.removeItem('ses_checkout');
    location.href = `pedido.html?id=${pedido.id}&novo=1`;
  } catch (err) {
    enviando = false; btns.forEach((b) => { b.disabled = false; b.textContent = 'Confirmar pedido'; });
    if ((err.cashback || err.pin || /cashback|\bPIN\b/i.test(err.message || '')) && fid.usar) {
      fid.saldo = null; fid.valor = 0; fid.pin = ''; fid.erro = err.message;
      renderCashback(); recalcular();
      qs('[data-painel-cashback]').scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast(err.message, 'erro');
      return;
    }
    const m = err.message || '';
    erro.textContent = /15 min|muitos pedidos|limite|aguard/i.test(m) ? 'Já recebemos pedidos deste celular há pouco. Espera uns minutos ou fala com a gente no WhatsApp.'
      : /fechad/i.test(m) ? `Fechamos por hoje. Agende para a partir das ${proximaAbertura(CFG)} e a gente assa na hora.`
      : (m && !/failed to fetch|network|load/i.test(m) ? m : 'Não deu para enviar o pedido agora. Tente de novo em alguns segundos. Se continuar, manda no WhatsApp que a gente anota.');
    erro.hidden = false; erro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(erro.textContent, 'erro');
    atualizarBarra();
  }
});

// ---------------------------------------------------------------
// início
// ---------------------------------------------------------------
function tudo() { renderItens(); renderQuando(); renderTotais(); renderCashback(); renderCompleta(); }
cart.onChange(tudo);
window.addEventListener('ses:entrega', () => { renderQuando(); renderTotais(); });
tudo();
config().then((c) => {
  CFG = c;
  if (!c.aberta && sessao.quando !== 'agendar') { sessao.quando = 'agendar'; salvarSessao(); }
  if (sessao.quando === 'agendar') { detAgendar.open = true; montarAgenda(); }
  renderPagamentos();
  if (cli.pagamento && (c.pagamentos || []).includes(cli.pagamento)) escolherPagamento(cli.pagamento);
  if (sessao.cupom) aplicarCupom(sessao.cupom);
  tudo();
  consultarResumo(); // celular já salvo: consulta o Clube de cara
}).catch(() => tudo());
