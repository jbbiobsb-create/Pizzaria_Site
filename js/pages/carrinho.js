import { montarLayout, montarFooter, abrirModalEntrega, config, lojaPorSlug, enderecoLoja } from '../ui.js';
import { validarCupom } from '../api.js';
import * as cart from '../cart.js';
import { qs, qsa, esc, brl, toast, lerLS, gravarLS, DIAS } from '../util.js';
import { LS } from '../config.js';
import { icone } from '../icons.js';

montarLayout({ pagina: 'carrinho' });
montarFooter();

const sessao = lerLS('ses_checkout', { quando: 'agora', agendado: null, cupom: null });
let CFG = null;

function salvarSessao() { gravarLS('ses_checkout', sessao); }

function renderItens() {
  const el = qs('[data-itens]');
  const itens = cart.itens();
  if (!itens.length) {
    el.innerHTML = `<div class="vazio"><div class="ic">${icone('sacola')}</div><h3>Seu pedido está vazio</h3><p class="muted">Que tal uma napolitana saindo do forno?</p><a class="btn" href="cardapio.html" style="margin-top:14px">Ver cardápio</a></div>`;
    qs('[data-continuar]').disabled = true;
    return;
  }
  el.innerHTML = itens.map((i) => `
    <div class="item-carrinho">
      ${i.imagem ? `<img src="${esc(i.imagem)}" alt="">` : `<div class="ph">${icone('pizza')}</div>`}
      <div>
        <b>${esc(i.nome)}</b>
        ${i.descricao ? `<small>${esc(i.descricao)}</small>` : ''}
        ${i.observacao ? `<small>Obs.: ${esc(i.observacao)}</small>` : ''}
        <div class="qtd qtd-sm" style="margin-top:6px"><button data-q="${i.uid}" data-d="-1">−</button><span>${i.quantidade}</span><button data-q="${i.uid}" data-d="1">+</button></div>
      </div>
      <div class="acoes"><span class="p">${brl(i.preco * i.quantidade)}</span><button class="remover" data-rm="${i.uid}">remover</button></div>
    </div>`).join('');
  qsa('[data-q]', el).forEach((b) => b.addEventListener('click', () => cart.alterarQtd(b.dataset.q, Number(b.dataset.d))));
  qsa('[data-rm]', el).forEach((b) => b.addEventListener('click', () => cart.remover(b.dataset.rm)));
  qs('[data-continuar]').disabled = false;
}

function renderEntrega() {
  const e = cart.entrega();
  qsa('[data-tipo-entrega] button').forEach((b) => b.classList.toggle('ativo', !!e && b.dataset.tipo === e.tipo));
  const r = qs('[data-resumo-entrega]');
  if (!e) r.innerHTML = 'Escolha entrega ou retirada para calcular a taxa.';
  else if (e.tipo === 'retirada') { const l = lojaPorSlug(CFG, e.loja); r.innerHTML = `<b>Retirada na loja ${esc(l?.nome || '')}</b> · ${esc(enderecoLoja(l))}. <button class="btn btn-ghost btn-sm" data-trocar>trocar</button>`; }
  else r.innerHTML = `<b>Entrega em:</b> ${esc(e.endereco.rua)}, ${esc(e.endereco.numero)}${e.endereco.complemento ? ' - ' + esc(e.endereco.complemento) : ''} — ${esc(e.endereco.bairro)}<br>Taxa <b>${brl(e.taxa)}</b>${e.a_confirmar ? ' (a confirmar)' : e.distancia_km ? ` · ${e.distancia_km} km` : ''}${e.loja_nome ? ` · sai da loja ${esc(e.loja_nome)}` : ''} <button class="btn btn-ghost btn-sm" data-trocar>trocar</button>`;
  qsa('[data-trocar]', r).forEach((b) => b.addEventListener('click', () => abrirModalEntrega(e?.tipo)));
  if (CFG) {
    qs('[data-tempo-entrega]').textContent = `${CFG.tempo_entrega_min}–${CFG.tempo_entrega_max} min`;
    qs('[data-tempo-retirada]').textContent = `${CFG.tempo_retirada_min}–${CFG.tempo_retirada_max} min · sem taxa`;
    qs('[data-quando-agora-txt]').textContent = CFG.aberta ? `Fica pronto em ${e?.tipo === 'retirada' ? CFG.tempo_retirada_min + '–' + CFG.tempo_retirada_max : CFG.tempo_entrega_min + '–' + CFG.tempo_entrega_max} min` : 'Estamos fechados agora — agende para mais tarde';
    const agora = qs('[data-quando="agora"]');
    agora.disabled = !CFG.aberta;
    if (!CFG.aberta && sessao.quando === 'agora') { sessao.quando = 'agendar'; salvarSessao(); }
  }
  renderQuando();
}

function renderQuando() {
  qsa('[data-quando]').forEach((b) => b.classList.toggle('ativo', b.dataset.quando === sessao.quando));
  const bloco = qs('[data-agendar]');
  bloco.hidden = sessao.quando !== 'agendar';
  if (sessao.quando === 'agendar' && CFG) montarAgenda();
}

const chaves = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
function montarAgenda() {
  const dia = qs('[data-ag-dia]'); const hora = qs('[data-ag-hora]');
  const hoje = new Date();
  if (dia.options.length) { renderHoras(); return; }
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoje); d.setDate(hoje.getDate() + i);
    const k = chaves[d.getDay()];
    if (!CFG.horario?.[k]) continue;
    const opt = document.createElement('option');
    opt.value = d.toISOString().slice(0, 10);
    opt.textContent = (i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DIAS[k]) + ` (${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')})`;
    dia.appendChild(opt);
  }
  dia.addEventListener('change', renderHoras);
  hora.addEventListener('change', () => { sessao.agendado = `${dia.value}T${hora.value}:00`; salvarSessao(); });
  renderHoras();
  function renderHoras() {
    hora.innerHTML = '';
    const d = new Date(dia.value + 'T12:00:00');
    const k = chaves[d.getDay()];
    const [ini, fim] = CFG.horario[k];
    const minAntec = new Date(Date.now() + 40 * 60000);
    let [h, m] = ini.split(':').map(Number); const [hf, mf] = fim.split(':').map(Number);
    // primeiro slot: abertura + tempo de preparo
    m += 30;
    while (h * 60 + m <= hf * 60 + mf) {
      const slot = new Date(`${dia.value}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      if (slot > minAntec) { const o = document.createElement('option'); o.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; o.textContent = o.value; hora.appendChild(o); }
      m += 15; if (m >= 60) { m -= 60; h++; }
    }
    if (!hora.options.length) { const o = document.createElement('option'); o.value = ''; o.textContent = 'Sem horários neste dia'; hora.appendChild(o); sessao.agendado = null; }
    else sessao.agendado = `${dia.value}T${hora.value}:00`;
    salvarSessao();
  }
}

async function renderTotais() {
  const sub = cart.subtotal();
  const e = cart.entrega();
  const taxa = e ? (e.tipo === 'entrega' ? Number(e.taxa || 0) : 0) : null;
  let desconto = 0;
  const msg = qs('[data-cupom-msg]');
  if (sessao.cupom) {
    try {
      const r = await validarCupom(sessao.cupom, sub);
      if (r.ok) { desconto = Number(r.desconto); msg.innerHTML = `${icone('check')} ${esc(r.codigo)}: ${esc(r.descricao || 'desconto aplicado')} (−${brl(desconto)})`; msg.className = 'small'; msg.style.color = 'var(--verde-ok)'; }
      else { msg.textContent = r.motivo; msg.style.color = 'var(--erro)'; sessao.cupom = null; salvarSessao(); }
    } catch { }
  }
  qs('[data-subtotal]').textContent = brl(sub);
  qs('[data-linha-desconto]').hidden = !desconto;
  qs('[data-desconto]').textContent = '− ' + brl(desconto);
  qs('[data-taxa]').textContent = taxa === null ? 'escolha entrega/retirada' : taxa === 0 ? 'grátis' : brl(taxa) + (e?.a_confirmar ? '*' : '');
  qs('[data-total]').textContent = brl(sub - desconto + (taxa || 0));
  const min = Number(CFG?.pedido_minimo || 0);
  qs('[data-aviso-minimo]').textContent = min && sub < min ? `Pedido mínimo: ${brl(min)}` : (e?.a_confirmar ? '* Taxa estimada; a pizzaria confirma pelo WhatsApp.' : '');
}

function tudo() { renderItens(); renderEntrega(); renderTotais(); }

qs('[data-limpar]').addEventListener('click', () => { if (confirm('Limpar todos os itens do pedido?')) cart.limpar(); });
qsa('[data-tipo-entrega] button').forEach((b) => b.addEventListener('click', () => abrirModalEntrega(b.dataset.tipo)));
qsa('[data-quando]').forEach((b) => b.addEventListener('click', () => { if (b.disabled) return; sessao.quando = b.dataset.quando; if (sessao.quando === 'agora') sessao.agendado = null; salvarSessao(); renderQuando(); }));
qs('[data-cupom-btn]').addEventListener('click', () => { sessao.cupom = qs('[data-cupom-input]').value.trim().toUpperCase() || null; salvarSessao(); renderTotais(); });
qs('[data-cupom-input]').value = sessao.cupom || '';
qs('[data-continuar]').addEventListener('click', () => {
  if (!cart.itens().length) return;
  if (!cart.entrega()) { abrirModalEntrega(); toast('Escolha entrega ou retirada primeiro', 'erro'); return; }
  if (sessao.quando === 'agendar' && !sessao.agendado) { toast('Escolha o dia e a hora do agendamento', 'erro'); return; }
  if (!CFG?.aberta && sessao.quando === 'agora') { toast('Estamos fechados agora. Agende seu pedido.', 'erro'); return; }
  const min = Number(CFG?.pedido_minimo || 0);
  if (min && cart.subtotal() < min) { toast(`Pedido mínimo: ${brl(min)}`, 'erro'); return; }
  location.href = 'checkout.html';
});

cart.onChange(tudo);
window.addEventListener('ses:entrega', tudo);
config().then((c) => { CFG = c; tudo(); }).catch(() => tudo());
tudo();
