import { montarLayout, montarFooter, abrirModalEntrega, config, lojaPorSlug, enderecoLoja } from '../ui.js';
import { validarCupom } from '../api.js';
import * as cart from '../cart.js';
import { qs, qsa, esc, brl, toast, lerLS, gravarLS, DIAS } from '../util.js';
import { icone } from '../icons.js';
import { ultimoPedidoLocal, itensDoUltimoPedido, repetirItens, mensagemRepetir } from '../repetir.js';
import { cfgFidelidade, programaAtivo, nivelBase, calcularPrevisto } from '../fidelidade.js';

montarLayout({ pagina: 'carrinho' });
montarFooter();

const sessao = lerLS('ses_checkout', { quando: 'agora', agendado: null, cupom: null });
let CFG = null;
let totalAtual = 0;

function salvarSessao() { gravarLS('ses_checkout', sessao); }

function renderItens() {
  const el = qs('[data-itens]');
  const itens = cart.itens();
  const vazio = !itens.length;
  // sacola vazia: sem painéis de entrega/resumo, só o convite para o cardápio (e "pedir de novo")
  qs('[data-painel-entrega]').hidden = vazio;
  qs('[data-painel-resumo]').hidden = vazio;
  qs('[data-limpar]').hidden = vazio;
  qs('[data-barra-continuar]').hidden = vazio;
  document.body.classList.toggle('tem-barra', !vazio && matchMedia('(max-width: 900px)').matches);
  if (vazio) {
    const u = ultimoPedidoLocal();
    el.innerHTML = `<div class="vazio"><div class="ic">${icone('sacola')}</div><h2>Sua sacola está vazia</h2><p class="muted">Que tal uma napolitana saindo do forno?</p>
      <div class="acoes"><a class="btn btn-lg" href="cardapio.html">Ver cardápio</a>${u ? `<button type="button" class="btn btn-outline btn-lg" data-repetir>${icone('repetir')} Pedir de novo · #${esc(u.numero)}</button>` : ''}</div></div>`;
    qs('[data-repetir]', el)?.addEventListener('click', async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      try { const uu = await itensDoUltimoPedido(); const r = await repetirItens(uu?.itens || []); const m = mensagemRepetir(r); toast(m.msg, m.tipo, 3500); }
      catch { toast('Não deu para repetir agora.', 'erro'); }
      finally { b.disabled = false; }
    });
    return;
  }
  el.innerHTML = itens.map((i) => `
    <div class="item-carrinho">
      ${i.imagem ? `<img src="${esc(i.imagem)}" alt="">` : `<div class="ph">${icone('pizza')}</div>`}
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

function renderEntrega() {
  const e = cart.entrega();
  qsa('[data-tipo-entrega] button').forEach((b) => b.classList.toggle('ativo', !!e && b.dataset.tipo === e.tipo));
  const r = qs('[data-resumo-entrega]');
  if (!e) r.innerHTML = 'Escolha entrega ou retirada para calcular a taxa.';
  else if (e.tipo === 'retirada') { const l = lojaPorSlug(CFG, e.loja); r.innerHTML = `<b>Retirada na loja ${esc(l?.nome || '')}</b> · ${esc(enderecoLoja(l))} <button type="button" class="btn btn-ghost btn-sm" data-trocar>${icone('lapis')} trocar</button>`; }
  else r.innerHTML = `<b>Entrega em:</b> ${esc(e.endereco.rua)}, ${esc(e.endereco.numero)}${e.endereco.complemento ? ' - ' + esc(e.endereco.complemento) : ''} — ${esc(e.endereco.bairro)}<br>Taxa <b>${brl(e.taxa)}</b>${e.a_confirmar ? ' (a confirmar)' : e.distancia_km ? ` · ${e.distancia_km} km` : ''}${e.loja_nome ? ` · sai da loja ${esc(e.loja_nome)}` : ''} <button type="button" class="btn btn-ghost btn-sm" data-trocar>${icone('lapis')} trocar</button>`;
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
  renderBarra();
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
      if (r.ok) { desconto = Number(r.desconto); msg.innerHTML = `${icone('check')} ${esc(r.codigo)}: ${esc(r.descricao || 'desconto aplicado')} · você economiza <b>${brl(desconto)}</b>`; msg.className = 'small'; msg.style.color = 'var(--verde-ok)'; }
      else { msg.textContent = r.motivo; msg.style.color = 'var(--erro)'; sessao.cupom = null; salvarSessao(); }
    } catch { }
  }
  qs('[data-subtotal]').textContent = brl(sub);
  qs('[data-linha-desconto]').hidden = !desconto;
  qs('[data-desconto]').textContent = '− ' + brl(desconto);
  qs('[data-taxa]').textContent = taxa === null ? 'escolha entrega/retirada' : taxa === 0 ? 'grátis' : brl(taxa) + (e?.a_confirmar ? '*' : '');
  totalAtual = sub - desconto + (taxa || 0);
  qs('[data-total]').textContent = brl(totalAtual);
  const min = Number(CFG?.pedido_minimo || 0);
  qs('[data-aviso-minimo]').textContent = min && sub < min ? `Pedido mínimo: ${brl(min)}` : (e?.a_confirmar ? '* Taxa estimada; a pizzaria confirma pelo WhatsApp.' : '');
  // Clube: prévia com o % do nível de entrada (o checkout refina pelo nível real do celular)
  const cb = qs('[data-cashback-sacola]');
  const F = cfgFidelidade(CFG);
  const ganho = programaAtivo(CFG) ? calcularPrevisto(F, nivelBase(F).pct, sub - desconto) : 0;
  cb.hidden = !(ganho > 0);
  // texto num único <span>: a linha é flex e o <b> solto virava uma 3ª coluna
  if (ganho > 0) cb.innerHTML = `${icone('presente')} <span>Este pedido dá pelo menos <b>${brl(ganho)}</b> de cashback (${esc(nivelBase(F).pct)}% · até ${esc(Math.max(...(F.niveis || []).map((n) => Number(n.pct) || 0), nivelBase(F).pct))}% para quem pede mais)</span>`;
  renderBarra();
}

// barra fixa: "Continuar · R$ X" ou "Escolher entrega ou retirada"
function renderBarra() {
  const e = cart.entrega();
  const b = qs('[data-continuar-barra]');
  qs('[data-total-barra]').textContent = brl(totalAtual);
  b.textContent = e ? 'Continuar' : 'Escolher entrega ou retirada';
  qs('[data-barra-continuar] .total').hidden = !e;
}

function continuar() {
  if (!cart.itens().length) return;
  if (!cart.entrega()) { abrirModalEntrega(); return; }
  if (sessao.quando === 'agendar' && !sessao.agendado) { toast('Escolha o dia e a hora do agendamento', 'erro'); qs('[data-agendar]').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  if (!CFG?.aberta && sessao.quando === 'agora') { toast('Estamos fechados agora. Agende seu pedido.', 'erro'); return; }
  const min = Number(CFG?.pedido_minimo || 0);
  if (min && cart.subtotal() < min) { toast(`Pedido mínimo: ${brl(min)}`, 'erro'); return; }
  location.href = 'checkout.html';
}

function tudo() { renderItens(); renderEntrega(); renderTotais(); }

qs('[data-limpar]').addEventListener('click', () => { if (confirm('Limpar todos os itens da sacola?')) cart.limpar(); });
qsa('[data-tipo-entrega] button').forEach((b) => b.addEventListener('click', () => abrirModalEntrega(b.dataset.tipo)));
qsa('[data-quando]').forEach((b) => b.addEventListener('click', () => { if (b.disabled) return; sessao.quando = b.dataset.quando; if (sessao.quando === 'agora') sessao.agendado = null; salvarSessao(); renderQuando(); }));
qs('[data-cupom-btn]').addEventListener('click', () => { sessao.cupom = qs('[data-cupom-input]').value.trim().toUpperCase() || null; salvarSessao(); renderTotais(); });
qs('[data-cupom-input]').value = sessao.cupom || '';
qs('[data-continuar]').addEventListener('click', continuar);
qs('[data-continuar-barra]').addEventListener('click', continuar);

cart.onChange(tudo);
window.addEventListener('ses:entrega', tudo);
window.addEventListener('resize', () => document.body.classList.toggle('tem-barra', cart.itens().length > 0 && matchMedia('(max-width: 900px)').matches));
config().then((c) => { CFG = c; tudo(); }).catch(() => tudo());
tudo();
