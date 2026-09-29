// Painel da equipe: pedidos em tempo real, loja, cardápio e cupons
import { supabase } from '../js/supabase.js';
import { qs, qsa, esc, brl, toast, STATUS, PAGAMENTOS, dataHoraBR, horaBR, whatsappLink, DIAS, DIAS_ORDEM, mascaraTelefone } from '../js/util.js';
import { icone, hidratarIcones } from '../js/icons.js';

hidratarIcones();

const $login = qs('#login'), $app = qs('#app');
let pedidos = []; let config = null; let somLigado = localStorage.getItem('adm_som') !== '0'; let vistos = new Set(); let canal = null; let timerPoll = null;

// ------------------------------------------------------------------ auth
supabase.auth.onAuthStateChange((_e, sessao) => { if (sessao) entrar(sessao); else sair(); });
const { data: { session } } = await supabase.auth.getSession();
if (session) entrar(session); else sair();

qs('[data-login]').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target; const erro = qs('[data-erro]', f); erro.hidden = true;
  const { error } = await supabase.auth.signInWithPassword({ email: f.email.value.trim(), password: f.senha.value });
  if (error) { erro.textContent = 'E-mail ou senha incorretos.'; erro.hidden = false; }
});
qs('[data-sair]').addEventListener('click', () => supabase.auth.signOut());

function sair() { $login.hidden = false; $app.hidden = true; if (canal) { supabase.removeChannel(canal); canal = null; } clearInterval(timerPoll); }
async function entrar(sessao) {
  // só quem está na tabela "equipe" usa o painel (o banco também bloqueia pelas políticas RLS)
  const { data: ok } = await supabase.rpc('is_equipe');
  if (!ok) {
    await supabase.auth.signOut();
    const erro = qs('[data-login] [data-erro]'); erro.textContent = 'Este usuário não tem acesso ao painel.'; erro.hidden = false;
    return;
  }
  $login.hidden = true; $app.hidden = false;
  qs('[data-usuario]').textContent = sessao.user.email;
  await carregarConfig();
  await carregarLojasFiltro();
  await carregarPedidos(true);
  assinar();
  timerPoll = setInterval(() => carregarPedidos(), 30000);
}

// ------------------------------------------------------------------ abas
qsa('[data-aba]').forEach((b) => b.addEventListener('click', () => {
  qsa('[data-aba]').forEach((x) => x.classList.toggle('ativo', x === b));
  qsa('[data-secao]').forEach((s) => (s.hidden = s.dataset.secao !== b.dataset.aba));
  if (b.dataset.aba === 'cardapio') carregarCardapio();
  if (b.dataset.aba === 'cupons') carregarCupons();
  if (b.dataset.aba === 'loja') preencherLoja();
  if (b.dataset.aba === 'fidelidade') preencherFidelidade();
}));
qs('[data-som]').addEventListener('click', () => { somLigado = !somLigado; localStorage.setItem('adm_som', somLigado ? '1' : '0'); atualizarSom(); if (somLigado) tocar(); });
function atualizarSom() { qs('[data-som]').innerHTML = somLigado ? `${icone('sino')} Som ligado` : `${icone('sino-off')} Som desligado`; }
atualizarSom();
function tocar() { if (!somLigado) return; try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.15; o.start(); o.frequency.setValueAtTime(1175, ctx.currentTime + 0.18); o.stop(ctx.currentTime + 0.4); } catch {} }

// ------------------------------------------------------------------ config
async function carregarConfig() {
  const { data, error } = await supabase.from('config').select('*').eq('id', 1).single();
  if (error) { toast('Erro ao carregar config', 'erro'); return; }
  config = data;
  const chk = qs('[data-forcar-fechada]'); chk.checked = !config.forcar_fechada;
  qs('[data-forcar-txt]').textContent = config.forcar_fechada ? 'Loja FECHADA (manual)' : 'Loja aberta (segue horário)';
}
qs('[data-forcar-fechada]').addEventListener('change', async (ev) => {
  const fechar = !ev.target.checked;
  const { error } = await supabase.from('config').update({ forcar_fechada: fechar }).eq('id', 1);
  if (error) toast('Erro ao salvar', 'erro'); else { toast(fechar ? 'Loja fechada para novos pedidos' : 'Loja reaberta'); await carregarConfig(); }
});

// lojas: ativa, entrega, retirada e código Saipos
async function carregarLojasAdmin() {
  const { data, error } = await supabase.from('lojas').select('*').order('ordem');
  if (error) { toast('Erro ao carregar lojas', 'erro'); return; }
  qs('[data-lojas-admin]').innerHTML = `<table><thead><tr><th>Loja</th><th>Ativa</th><th>Entrega</th><th>Retirada</th><th>Código Saipos</th><th></th></tr></thead><tbody>${data.map((l) => `<tr data-loja-id="${l.id}">
    <td><b>${esc(l.nome)}</b><br><small class="muted">${esc([l.endereco?.rua, l.endereco?.numero].filter(Boolean).join(', '))}</small></td>
    <td><input type="checkbox" data-campo="ativo" ${l.ativo ? 'checked' : ''}></td>
    <td><input type="checkbox" data-campo="aceita_entrega" ${l.aceita_entrega ? 'checked' : ''}></td>
    <td><input type="checkbox" data-campo="aceita_retirada" ${l.aceita_retirada ? 'checked' : ''}></td>
    <td><input data-campo="saipos_cod_store" value="${esc(l.saipos_cod_store || '')}" placeholder="padrão" style="min-width:220px"></td>
    <td><button class="btn btn-sm" data-salvar-loja>Salvar</button></td></tr>`).join('')}</tbody></table>`;
  qsa('[data-salvar-loja]').forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr'); const v = (c) => qs(`[data-campo="${c}"]`, tr);
    const { error: e } = await supabase.from('lojas').update({
      ativo: v('ativo').checked, aceita_entrega: v('aceita_entrega').checked, aceita_retirada: v('aceita_retirada').checked,
      saipos_cod_store: v('saipos_cod_store').value.trim() || null,
    }).eq('id', Number(tr.dataset.lojaId));
    toast(e ? 'Erro: ' + e.message : 'Loja salva', e ? 'erro' : undefined);
    localStorage.removeItem('ses_cardapio_cache');
  }));
}

function preencherLoja() {
  carregarLojasAdmin();
  const f = qs('[data-form-loja]'); if (!config) return;
  for (const k of ['nome', 'telefone', 'whatsapp', 'instagram', 'tempo_entrega_min', 'tempo_entrega_max', 'tempo_retirada_min', 'tempo_retirada_max', 'raio_entrega_km', 'taxa_padrao', 'pedido_minimo', 'chave_pix', 'pix_nome', 'sobre_massa', 'aviso_preparo']) if (f.elements[k]) f.elements[k].value = config[k] ?? '';
  f.elements.aceita_entrega.checked = !!config.aceita_entrega; f.elements.aceita_retirada.checked = !!config.aceita_retirada;
  for (const p of ['pix', 'cartao_entrega', 'dinheiro']) f.elements['pg_' + p].checked = (config.pagamentos || []).includes(p);
  qs('[data-horarios]').innerHTML = DIAS_ORDEM.map((d) => `<label>${DIAS[d]}<div class="dupla"><input type="time" name="h_${d}_ini" value="${config.horario?.[d]?.[0] || ''}"><input type="time" name="h_${d}_fim" value="${config.horario?.[d]?.[1] || ''}"></div></label>`).join('');
  renderFaixas(config.faixas_taxa || []);
}
function renderFaixas(lista) {
  qs('[data-faixas]').innerHTML = lista.map((fx, i) => `<div>até <input type="number" step="0.1" data-fx-km="${i}" value="${fx.ate_km}"> km → R$ <input type="number" step="0.01" data-fx-taxa="${i}" value="${fx.taxa}"> <button type="button" class="btn btn-sm btn-ghost" data-fx-rm="${i}">×</button></div>`).join('');
  qsa('[data-fx-rm]').forEach((b) => b.addEventListener('click', () => { const l = lerFaixas(); l.splice(Number(b.dataset.fxRm), 1); renderFaixas(l); }));
}
function lerFaixas() { return qsa('[data-fx-km]').map((i, n) => ({ ate_km: Number(i.value), taxa: Number(qs(`[data-fx-taxa="${n}"]`).value) })).filter((f) => f.ate_km > 0).sort((a, b) => a.ate_km - b.ate_km); }
qs('[data-add-faixa]').addEventListener('click', () => renderFaixas([...lerFaixas(), { ate_km: 0, taxa: 0 }]));
qs('[data-form-loja]').addEventListener('submit', async (ev) => {
  ev.preventDefault(); const f = ev.target;
  const horario = {};
  for (const d of DIAS_ORDEM) { const a = f.elements['h_' + d + '_ini'].value, b = f.elements['h_' + d + '_fim'].value; if (a && b) horario[d] = [a, b]; }
  const upd = {
    nome: f.elements.nome.value, telefone: f.elements.telefone.value, whatsapp: f.elements.whatsapp.value.replace(/\D/g, ''), instagram: f.elements.instagram.value.replace('@', ''),
    horario, aceita_entrega: f.elements.aceita_entrega.checked, aceita_retirada: f.elements.aceita_retirada.checked,
    tempo_entrega_min: +f.elements.tempo_entrega_min.value, tempo_entrega_max: +f.elements.tempo_entrega_max.value, tempo_retirada_min: +f.elements.tempo_retirada_min.value, tempo_retirada_max: +f.elements.tempo_retirada_max.value,
    raio_entrega_km: +f.elements.raio_entrega_km.value, taxa_padrao: +f.elements.taxa_padrao.value, pedido_minimo: +f.elements.pedido_minimo.value, faixas_taxa: lerFaixas(),
    pagamentos: ['pix', 'cartao_entrega', 'dinheiro'].filter((p) => f.elements['pg_' + p].checked),
    chave_pix: f.elements.chave_pix.value.trim() || null, pix_nome: f.elements.pix_nome.value.trim() || null,
    sobre_massa: f.elements.sobre_massa.value, aviso_preparo: f.elements.aviso_preparo.value, atualizado_em: new Date().toISOString(),
  };
  const { error } = await supabase.from('config').update(upd).eq('id', 1);
  if (error) { toast('Erro: ' + error.message, 'erro'); return; }
  toast('Configurações salvas'); qs('[data-ok]').hidden = false; setTimeout(() => (qs('[data-ok]').hidden = true), 2500); await carregarConfig();
});

// ------------------------------------------------------------------ pedidos
const COLUNAS = { novos: ['recebido'], andamento: ['confirmado', 'preparando', 'no_forno'], saida: ['saiu_entrega', 'pronto_retirada'], finalizados: ['entregue', 'cancelado'] };
const PROXIMO = { recebido: 'confirmado', confirmado: 'preparando', preparando: 'no_forno', no_forno: null, saiu_entrega: 'entregue', pronto_retirada: 'entregue' };

async function carregarPedidos(primeira = false) {
  const desde = new Date(); desde.setHours(0, 0, 0, 0); desde.setDate(desde.getDate() - 1);
  const { data, error } = await supabase.from('pedidos').select('*, pedido_itens(*), lojas(nome, slug)').gte('criado_em', desde.toISOString()).order('criado_em', { ascending: false }).limit(200);
  if (error) { toast('Erro ao carregar pedidos', 'erro'); return; }
  const novos = data.filter((p) => p.status === 'recebido' && !vistos.has(p.id));
  if (!primeira && novos.length) { tocar(); toast(`${novos.length} novo(s) pedido(s)!`); }
  data.forEach((p) => vistos.add(p.id));
  pedidos = data; renderKanban();
  qs('[data-ultima]').textContent = new Date().toLocaleTimeString('pt-BR');
}
qs('[data-recarregar]').addEventListener('click', () => carregarPedidos());
qs('[data-agendados]').addEventListener('change', renderKanban);
// lojas no filtro (cada funcionário pode deixar só a loja dele)
async function carregarLojasFiltro() {
  const { data } = await supabase.from('lojas').select('slug, nome').eq('ativo', true).order('ordem');
  const sel = qs('[data-filtro-loja]'); const salvo = localStorage.getItem('ses_admin_loja') || '';
  sel.innerHTML = '<option value="">todas</option>' + (data || []).map((l) => `<option value="${esc(l.slug)}">${esc(l.nome)}</option>`).join('');
  sel.value = salvo;
  sel.onchange = () => { localStorage.setItem('ses_admin_loja', sel.value); renderKanban(); };
}

function assinar() {
  canal = supabase.channel('pedidos-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => carregarPedidos()).subscribe();
}

function renderKanban() {
  const hoje = new Date().toDateString();
  const mostrarAg = qs('[data-agendados]').checked;
  for (const [col, sts] of Object.entries(COLUNAS)) {
    const loja = qs('[data-filtro-loja]').value;
    let lista = pedidos.filter((p) => sts.includes(p.status) && (!loja || p.lojas?.slug === loja));
    if (col === 'finalizados') lista = lista.filter((p) => new Date(p.atualizado_em).toDateString() === hoje);
    if (!mostrarAg && col !== 'novos') lista = lista.filter((p) => !p.agendado_para || new Date(p.agendado_para).toDateString() === hoje || col === 'finalizados');
    if (col !== 'finalizados') lista = lista.sort((a, b) => new Date(a.agendado_para || a.criado_em) - new Date(b.agendado_para || b.criado_em));
    const el = qs(`[data-col="${col}"]`);
    qs('[data-cnt]', el).textContent = lista.length || '';
    qs('.cards', el).innerHTML = lista.map(cardPedido).join('') || '<p class="small muted center" style="padding:20px 0">nenhum</p>';
  }
  qs('[data-badge-novos]').textContent = pedidos.filter((p) => p.status === 'recebido').length || '';
  document.title = (pedidos.filter((p) => p.status === 'recebido').length ? '● ' : '') + "Painel — Sesconetto's";
  qsa('[data-abrir]').forEach((c) => c.addEventListener('click', (ev) => { if (ev.target.closest('button')) return; abrirDetalhe(c.dataset.abrir); }));
  qsa('[data-st]').forEach((b) => b.addEventListener('click', () => mudarStatus(b.dataset.id, b.dataset.st)));
}

function cardPedido(p) {
  const prox = proximoStatus(p);
  const itens = (p.pedido_itens || []).map((i) => `${i.quantidade}× ${i.nome}`).join(' · ');
  const ag = p.agendado_para ? `<span>${icone('calendario')} ${dataHoraBR(p.agendado_para)}</span>` : '';
  return `<div class="pedido-card ${p.status === 'recebido' ? 'novo' : ''} ${p.agendado_para ? 'agendado' : ''}" data-abrir="${p.id}">
    <div class="cab"><span>#${p.numero} ${esc(p.cliente_nome)}</span><small>${horaBR(p.criado_em)}</small></div>
    <div class="itens">${esc(itens)}</div>
    <div class="meta"><span>${p.tipo_entrega === 'entrega' ? icone('moto') + ' Entrega' : icone('loja') + ' Retirada'}</span><span>${PAGAMENTOS[p.pagamento]?.rotulo.split(' ')[0] || p.pagamento}</span><span><b>${brl(p.total)}</b></span>${ag}</div>
    ${p.lojas ? `<div class="small muted">${icone('loja')} Loja ${esc(p.lojas.nome)}</div>` : ''}
    ${etiquetasIntegracao(p)}${etiquetaCashback(p)}
    <div class="acoes">
      ${p.pagamento_status === 'pendente' && p.status !== 'cancelado' ? `<button class="btn btn-outline" data-pago="${p.id}">${icone('check')} Pix recebido</button>` : ''}
      ${prox ? `<button class="btn" data-st="${prox}" data-id="${p.id}">${icone(STATUS[prox].icone)} ${STATUS[prox].rotulo}</button>` : ''}
      ${['entregue', 'cancelado'].includes(p.status) ? '' : `<button class="btn btn-ghost" data-st="cancelado" data-id="${p.id}">Cancelar</button>`}
    </div></div>`;
}
// situação do pagamento e do envio ao PDV Saipos
function etiquetasIntegracao(p) {
  const pg = { pendente: ['aguardando pagamento', 'alerta'], pago: ['pago', 'ok'], na_entrega: ['cobrar na entrega', ''], estornado: ['estornado', 'alerta'] }[p.pagamento_status] || [p.pagamento_status, ''];
  const sp = { enviando: ['Saipos: enviando…', ''], enviado: [`Saipos ✓${p.saipos_sale_number ? ' nº ' + p.saipos_sale_number : ''}`, 'ok'], erro: ['Saipos: erro', 'alerta'] }[p.saipos_status];
  return `<div class="etiquetas"><span class="tag ${pg[1]}">${esc(pg[0])}</span>${sp ? `<span class="tag ${sp[1]}">${esc(sp[0])}</span>` : ''}</div>`;
}
// cashback usado no pedido (o total já vem líquido) — etiqueta no card
function etiquetaCashback(p) {
  return Number(p.cashback_usado) > 0 ? `<div class="etiquetas"><span class="tag ok">cashback − ${brl(p.cashback_usado)}</span></div>` : '';
}
async function confirmarPagamento(id) {
  if (!confirm('Confirma que o Pix deste pedido caiu na conta? Ele será enviado ao PDV Saipos.')) return;
  const { error } = await supabase.from('pedidos').update({ pagamento_status: 'pago' }).eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'erro'); return; }
  toast('Pagamento confirmado — enviando à Saipos');
  await carregarPedidos();
  if (qs('#modal-pedido').classList.contains('aberto')) abrirDetalhe(id);
}
async function reenviarSaipos(id) {
  const { error } = await supabase.from('pedidos').update({ saipos_status: null }).eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'erro'); return; }
  toast('Reenviando à Saipos…');
  setTimeout(async () => { await carregarPedidos(); if (qs('#modal-pedido').classList.contains('aberto')) abrirDetalhe(id); }, 3000);
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-pago],[data-reenviar]'); if (!b) return;
  ev.stopPropagation();
  if (b.dataset.pago) confirmarPagamento(b.dataset.pago); else reenviarSaipos(b.dataset.reenviar);
}, true);

function proximoStatus(p) {
  if (p.status === 'no_forno') return p.tipo_entrega === 'entrega' ? 'saiu_entrega' : 'pronto_retirada';
  return PROXIMO[p.status] ?? null;
}
async function mudarStatus(id, status) {
  if (status === 'cancelado' && !confirm('Cancelar este pedido?')) return;
  const { error } = await supabase.from('pedidos').update({ status }).eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'erro'); return; }
  toast(`Pedido → ${STATUS[status].rotulo}`);
  await carregarPedidos();
  if (qs('#modal-pedido').classList.contains('aberto')) abrirDetalhe(id);
}

function abrirDetalhe(id) {
  const p = pedidos.find((x) => x.id === id); if (!p) return;
  const e = p.endereco || {};
  const wa = whatsappLink(p.cliente_telefone, `Olá ${p.cliente_nome}! Aqui é da Sesconetto's. Sobre seu pedido #${p.numero}: `);
  const fluxo = p.tipo_entrega === 'entrega' ? ['recebido', 'confirmado', 'preparando', 'no_forno', 'saiu_entrega', 'entregue'] : ['recebido', 'confirmado', 'preparando', 'no_forno', 'pronto_retirada', 'entregue'];
  qs('[data-detalhe]').innerHTML = `<div class="detalhe">
    <h2>Pedido #${p.numero} <span class="tag">${esc(STATUS[p.status]?.rotulo)}</span></h2>
    <p class="small muted">${dataHoraBR(p.criado_em)} · ${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}${p.lojas ? ` · <b>Loja ${esc(p.lojas.nome)}</b>` : ''}${p.agendado_para ? ` · <b>agendado para ${dataHoraBR(p.agendado_para)}</b>` : ''}</p>
    <div class="status-btns" style="margin:10px 0">${fluxo.map((s) => `<button class="btn btn-sm ${p.status === s ? '' : 'btn-outline'}" data-st="${s}" data-id="${p.id}">${icone(STATUS[s].icone)} ${STATUS[s].rotulo}</button>`).join('')}<button class="btn btn-sm btn-ghost" data-st="cancelado" data-id="${p.id}">${icone('x')} Cancelar</button></div>
    <div class="grid">
      <div class="bloco"><b>Cliente</b><br>${esc(p.cliente_nome)}<br>${mascaraTelefone(p.cliente_telefone)}<br><a class="btn btn-sm btn-wa no-print" style="margin-top:6px" target="_blank" href="${wa}">WhatsApp</a></div>
      <div class="bloco"><b>${p.tipo_entrega === 'entrega' ? 'Endereço' : 'Retirada na loja'}</b><br>${p.tipo_entrega === 'entrega' ? `${esc(e.rua)}, ${esc(e.numero)}${e.complemento ? ' - ' + esc(e.complemento) : ''}<br>${esc(e.bairro)} — ${esc(e.cidade)}/${esc(e.uf)}${e.referencia ? '<br>Ref.: ' + esc(e.referencia) : ''}${e.distancia_km ? `<br><small>${e.distancia_km} km${e.aprox ? ' (aprox.)' : ''}</small>` : ''}` : 'Cliente vem buscar'}</div>
    </div>
    <table><tbody>${(p.pedido_itens || []).map((i) => `<tr><td><b>${i.quantidade}×</b></td><td>${esc(i.nome)}${i.detalhes?.escolhas?.length ? '<br><small>' + i.detalhes.escolhas.map((x) => esc(x.nome)).join(', ') + '</small>' : ''}${i.detalhes?.observacao ? `<br><small>${icone('alerta')} ${esc(i.detalhes.observacao)}</small>` : ''}</td><td style="text-align:right">${brl(i.subtotal)}</td></tr>`).join('')}</tbody></table>
    <div class="totais"><div><span>Subtotal</span><span>${brl(p.subtotal)}</span></div>${Number(p.desconto) ? `<div class="desconto"><span>Desconto ${esc(p.cupom_codigo || '')}</span><span>− ${brl(p.desconto)}</span></div>` : ''}${Number(p.cashback_usado) ? `<div class="desconto"><span>Cashback usado</span><span>− ${brl(p.cashback_usado)}</span></div>` : ''}<div><span>Taxa${p.taxa_a_confirmar ? ' (a confirmar!)' : ''}</span><span>${brl(p.taxa_entrega)}</span></div><div class="total"><span>Total</span><span>${brl(p.total)}</span></div></div>
    ${p.fidelidade_pct ? `<p class="small muted" style="margin-top:4px">Clube: nível ${esc(p.fidelidade_nivel || '')} (${Number(p.fidelidade_pct)}%) · ${p.cashback_ganho != null ? `cashback creditado ${brl(p.cashback_ganho)}` : `cashback previsto ${brl(Math.floor(Math.max(p.subtotal - p.desconto - (p.cashback_usado || 0), 0) * p.fidelidade_pct) / 100)} (ao entregar)`}</p>` : ''}
    <p style="margin-top:8px"><b>Pagamento:</b> ${esc(PAGAMENTOS[p.pagamento]?.rotulo || p.pagamento)}${p.troco_para ? ` · troco para ${brl(p.troco_para)} (levar ${brl(p.troco_para - p.total)})` : ''}</p>
    ${etiquetasIntegracao(p)}
    ${p.saipos_erro ? `<p class="aviso aviso-ic" style="margin-top:8px">${icone('alerta')}<span>${esc(p.saipos_erro)}</span></p>` : ''}
    <div class="acoes no-print" style="margin-top:8px">
      ${p.pagamento_status === 'pendente' && p.status !== 'cancelado' ? `<button class="btn btn-sm" data-pago="${p.id}">${icone('check')} Pix recebido</button>` : ''}
      ${p.saipos_status === 'erro' ? `<button class="btn btn-sm btn-outline" data-reenviar="${p.id}">${icone('seta-dir')} Reenviar à Saipos</button>` : ''}
    </div>
    ${p.observacoes ? `<p class="aviso aviso-ic" style="margin-top:8px">${icone('nota')}<span>${esc(p.observacoes)}</span></p>` : ''}
    <p class="small muted" style="margin-top:10px">${(p.status_historico || []).map((h) => `${STATUS[h.status]?.rotulo || h.status} ${horaBR(h.em)}`).join(' → ')}</p>
    <div class="acoes no-print"><button class="btn btn-outline" data-imprimir>${icone('impressora')} Imprimir</button></div>
  </div>`;
  qsa('#modal-pedido [data-st]').forEach((b) => b.addEventListener('click', () => mudarStatus(b.dataset.id, b.dataset.st)));
  qs('#modal-pedido').classList.add('aberto');
}
document.addEventListener('click', (ev) => { if (ev.target.matches('[data-fechar]') || ev.target.classList.contains('modal-bg')) qs('#modal-pedido').classList.remove('aberto'); });
document.addEventListener('click', (ev) => { if (ev.target.closest('[data-imprimir]')) window.print(); });

// ------------------------------------------------------------------ cardápio
async function carregarCardapio() {
  const [{ data: tamanhos }, { data: sabores }, { data: precos }, { data: produtos }] = await Promise.all([
    supabase.from('tamanhos').select('*').order('ordem'), supabase.from('sabores').select('*').order('ordem'),
    supabase.from('sabor_precos').select('*'), supabase.from('produtos').select('*').order('ordem')]);
  const mapa = {}; (precos || []).forEach((p) => (mapa[`${p.sabor_id}-${p.tamanho_id}`] = p.preco));
  qs('[data-sabores]').innerHTML = `<table><thead><tr><th>Disp.</th><th>Sabor</th>${tamanhos.map((t) => `<th>${t.nome}</th>`).join('')}<th></th></tr></thead><tbody>${sabores.map((s) => `<tr data-sabor="${s.id}">
    <td><input type="checkbox" data-disp ${s.disponivel ? 'checked' : ''}></td>
    <td><b>${esc(s.nome)}</b><br><small class="muted">${esc(s.tipo)}${s.tags?.length ? ' · ' + s.tags.join(', ') : ''}${s.codigo_saipos ? ' · Saipos ' + esc(s.codigo_saipos) : ''}</small><br><textarea data-desc rows="2" style="width:100%;min-width:240px;font-size:.8rem;margin-top:4px;border:1px solid var(--linha);border-radius:6px;padding:4px 6px">${esc(s.descricao || '')}</textarea></td>
    ${tamanhos.map((t) => `<td>${(t.grupo === 'calzone') === (s.tipo === 'calzone') ? `<input type="number" step="0.01" data-tam="${t.id}" value="${mapa[`${s.id}-${t.id}`] ?? ''}" placeholder="—">` : '<span class="muted">—</span>'}</td>`).join('')}
    <td><button class="btn" data-salvar-sabor>Salvar</button></td></tr>`).join('')}</tbody></table>`;
  qsa('[data-salvar-sabor]').forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr'); const id = Number(tr.dataset.sabor);
    const { error } = await supabase.from('sabores').update({ disponivel: qs('[data-disp]', tr).checked, descricao: qs('[data-desc]', tr).value.trim() }).eq('id', id);
    if (error) { toast('Erro: ' + error.message, 'erro'); return; }
    for (const inp of qsa('[data-tam]', tr)) {
      const tid = Number(inp.dataset.tam);
      if (inp.value === '') await supabase.from('sabor_precos').delete().match({ sabor_id: id, tamanho_id: tid });
      else await supabase.from('sabor_precos').upsert({ sabor_id: id, tamanho_id: tid, preco: Number(inp.value) });
    }
    toast('Sabor salvo');
  }));
  qsa('[data-sabores] [data-disp]').forEach((c) => c.addEventListener('change', async () => {
    const tr = c.closest('tr'); const { error } = await supabase.from('sabores').update({ disponivel: c.checked }).eq('id', Number(tr.dataset.sabor));
    toast(error ? 'Erro' : (c.checked ? 'Disponível' : 'Esgotado'), error ? 'erro' : 'ok');
  }));
  qs('[data-produtos]').innerHTML = `<table><thead><tr><th>Disp.</th><th>Produto</th><th>Preço</th><th></th></tr></thead><tbody>${produtos.map((p) => `<tr data-produto="${p.id}">
    <td><input type="checkbox" data-disp ${p.disponivel ? 'checked' : ''}></td><td><b>${esc(p.nome)}</b><br><small class="muted">${esc(p.tipo)}${p.codigo_saipos ? ' · Saipos ' + esc(p.codigo_saipos) : ''}</small><br><textarea data-desc rows="2" style="width:100%;min-width:240px;font-size:.8rem;margin-top:4px;border:1px solid var(--linha);border-radius:6px;padding:4px 6px">${esc(p.descricao || '')}</textarea></td>
    <td><input type="number" step="0.01" data-preco value="${p.preco}"></td><td><button class="btn" data-salvar-produto>Salvar</button></td></tr>`).join('')}</tbody></table>`;
  qsa('[data-salvar-produto]').forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr');
    const { error } = await supabase.from('produtos').update({ disponivel: qs('[data-disp]', tr).checked, preco: Number(qs('[data-preco]', tr).value), descricao: qs('[data-desc]', tr).value.trim() }).eq('id', Number(tr.dataset.produto));
    toast(error ? 'Erro: ' + error.message : 'Produto salvo', error ? 'erro' : 'ok');
  }));
  qsa('[data-produtos] [data-disp]').forEach((c) => c.addEventListener('change', async () => {
    const tr = c.closest('tr'); const { error } = await supabase.from('produtos').update({ disponivel: c.checked }).eq('id', Number(tr.dataset.produto));
    toast(error ? 'Erro' : (c.checked ? 'Disponível' : 'Esgotado'), error ? 'erro' : 'ok');
  }));
}

// ------------------------------------------------------------------ cupons
async function carregarCupons() {
  const { data } = await supabase.from('cupons').select('*').order('id', { ascending: false });
  qs('[data-cupons]').innerHTML = `<table><thead><tr><th>Ativo</th><th>Código</th><th>Desconto</th><th>Mínimo</th><th>Usos</th><th>Validade</th><th></th></tr></thead><tbody>${(data || []).map((c) => `<tr data-cupom="${c.id}">
    <td><input type="checkbox" data-ativo ${c.ativo ? 'checked' : ''}></td><td><b>${esc(c.codigo)}</b><br><small class="muted">${esc(c.descricao || '')}</small></td>
    <td>${c.tipo === 'percentual' ? c.valor + '%' : brl(c.valor)}</td><td>${brl(c.minimo)}</td><td>${c.usos}${c.uso_max ? '/' + c.uso_max : ''}</td><td>${c.validade ? new Date(c.validade).toLocaleDateString('pt-BR') : '—'}</td>
    <td><button class="btn btn-ghost" data-excluir>excluir</button></td></tr>`).join('')}</tbody></table>`;
  qsa('[data-cupons] [data-ativo]').forEach((c) => c.addEventListener('change', async () => { await supabase.from('cupons').update({ ativo: c.checked }).eq('id', Number(c.closest('tr').dataset.cupom)); toast('Cupom atualizado'); }));
  qsa('[data-cupons] [data-excluir]').forEach((b) => b.addEventListener('click', async () => { if (!confirm('Excluir cupom?')) return; await supabase.from('cupons').delete().eq('id', Number(b.closest('tr').dataset.cupom)); carregarCupons(); }));
}
qs('[data-form-cupom]').addEventListener('submit', async (ev) => {
  ev.preventDefault(); const f = ev.target;
  const { error } = await supabase.from('cupons').insert({ codigo: f.codigo.value.trim().toUpperCase(), tipo: f.tipo.value, valor: Number(f.valor.value), minimo: Number(f.minimo.value || 0), uso_max: f.uso_max.value ? Number(f.uso_max.value) : null, validade: f.validade.value ? new Date(f.validade.value + 'T23:59:59').toISOString() : null, descricao: f.descricao.value.trim() || null, ativo: true });
  if (error) { toast('Erro: ' + error.message, 'erro'); return; }
  f.reset(); toast('Cupom criado'); carregarCupons();
});

// ------------------------------------------------------------------ fidelidade (Clube Sesconetto's)
const FID_PADRAO = { ativo: true, validade_dias: 90, min_resgate: 10, max_pct_pedido: 50, niveis: [{ nome: 'Bronze', min_pedidos_90d: 0, pct: 5 }, { nome: 'Prata', min_pedidos_90d: 3, pct: 7 }, { nome: 'Ouro', min_pedidos_90d: 6, pct: 10 }] };
function preencherFidelidade() {
  if (!config) return;
  const fid = { ...FID_PADRAO, ...(config.fidelidade || {}) };
  const f = qs('[data-form-fidelidade]');
  f.elements.ativo.checked = !!fid.ativo;
  f.elements.validade_dias.value = fid.validade_dias; f.elements.min_resgate.value = fid.min_resgate; f.elements.max_pct_pedido.value = fid.max_pct_pedido;
  qs('[data-niveis]').innerHTML = (fid.niveis || []).map((n, i) => `<div class="linha-campos tres" data-nivel="${i}">
    <div class="campo"><label>Nome</label><input data-n-nome value="${esc(n.nome)}"></div>
    <div class="campo"><label>A partir de (pedidos em 90 dias)</label><input data-n-min type="number" min="0" value="${n.min_pedidos_90d}"></div>
    <div class="campo"><label>Cashback (%)</label><input data-n-pct type="number" step="0.5" min="0" max="100" value="${n.pct}"></div></div>`).join('');
  qs('[data-cliente-fid]').innerHTML = '';
}
qs('[data-form-fidelidade]').addEventListener('submit', async (ev) => {
  ev.preventDefault(); const f = ev.target;
  const niveis = qsa('[data-nivel]').map((d) => ({ nome: qs('[data-n-nome]', d).value.trim(), min_pedidos_90d: Number(qs('[data-n-min]', d).value), pct: Number(qs('[data-n-pct]', d).value) }))
    .filter((n) => n.nome).sort((a, b) => a.min_pedidos_90d - b.min_pedidos_90d);
  if (!niveis.length || niveis[0].min_pedidos_90d !== 0) { toast('O primeiro nível precisa começar em 0 pedidos', 'erro'); return; }
  const fidelidade = { ...(config.fidelidade || {}), ativo: f.elements.ativo.checked, validade_dias: Number(f.elements.validade_dias.value), min_resgate: Number(f.elements.min_resgate.value), max_pct_pedido: Number(f.elements.max_pct_pedido.value), niveis };
  const { error } = await supabase.from('config').update({ fidelidade, atualizado_em: new Date().toISOString() }).eq('id', 1);
  if (error) { toast('Erro: ' + error.message, 'erro'); return; }
  toast('Fidelidade salva'); qs('[data-ok-fid]').hidden = false; setTimeout(() => (qs('[data-ok-fid]').hidden = true), 2500);
  localStorage.removeItem('ses_cardapio_cache'); await carregarConfig();
});

const TIPO_MOV = { credito: 'Cashback ganho', debito: 'Usado em pedido', estorno_credito: 'Estorno (pedido cancelado)', estorno_debito: 'Devolução (pedido cancelado)', expirado: 'Vencido', ajuste: 'Ajuste da equipe' };
let clienteFid = null;
async function buscarClienteFid(telefone) {
  const { data, error } = await supabase.rpc('fidelidade_cliente', { p_telefone: telefone });
  if (error) { toast('Erro: ' + error.message, 'erro'); return; }
  clienteFid = data; renderClienteFid();
}
function renderClienteFid() {
  const c = clienteFid; if (!c) return;
  const bloq = c.pin_bloqueado_ate ? ` · <b style="color:var(--erro)">bloqueado até ${horaBR(c.pin_bloqueado_ate)}</b>` : '';
  qs('[data-cliente-fid]').innerHTML = `<div class="detalhe">
    <h3>${esc(c.nome || 'Sem nome')} · ${mascaraTelefone(c.telefone)}</h3>
    <div class="grid">
      <div class="bloco"><b>Saldo</b><br><span style="font-size:1.4rem">${brl(c.saldo)}</span>${Number(c.debito_pendente) ? `<br><small class="muted">débito pendente ${brl(c.debito_pendente)} (abatido no próximo crédito)</small>` : ''}</div>
      <div class="bloco"><b>Nível</b><br>${esc(c.nivel || '—')} (${Number(c.pct)}%) · ${c.pedidos_90d} pedido(s) em 90 dias${c.proximo ? `<br><small class="muted">faltam ${c.proximo.faltam} para ${esc(c.proximo.nome)} (${c.proximo.pct}%)</small>` : ''}</div>
      <div class="bloco"><b>PIN</b><br>${c.tem_pin ? `criado em ${dataHoraBR(c.pin_criado_em)}${bloq}` : 'ainda não criou'}${c.tem_pin ? `<br><button class="btn btn-sm btn-outline" data-reset-pin style="margin-top:6px">Resetar PIN</button>` : ''}</div>
    </div>
    <form data-form-ajuste class="linha-campos tres" style="margin:10px 0">
      <div class="campo"><label>Ajustar saldo (R$, negativo debita)</label><input name="valor" type="number" step="0.01" required></div>
      <div class="campo"><label>Motivo (obrigatório)</label><input name="motivo" required placeholder="ex.: cortesia pelo atraso"></div>
      <div class="campo" style="align-self:flex-end"><button class="btn btn-sm" type="submit">Ajustar</button></div>
    </form>
    <table><thead><tr><th>Quando</th><th>Tipo</th><th>Valor</th><th>Restante</th><th>Vence</th><th>Descrição</th></tr></thead><tbody>${(c.movimentos || []).map((m) => `<tr>
      <td>${dataHoraBR(m.criado_em)}</td><td>${esc(TIPO_MOV[m.tipo] || m.tipo)}${m.pedido_numero ? ` #${m.pedido_numero}` : ''}</td>
      <td style="color:${Number(m.valor) < 0 ? 'var(--erro)' : 'var(--verde-ok)'}">${Number(m.valor) < 0 ? '−' : '+'} ${brl(Math.abs(m.valor))}</td>
      <td>${Number(m.restante) > 0 ? brl(m.restante) : '—'}</td><td>${m.expira_em && Number(m.restante) > 0 ? new Date(m.expira_em).toLocaleDateString('pt-BR') : '—'}</td><td class="small">${esc(m.descricao || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">sem movimentos</td></tr>'}</tbody></table>
  </div>`;
  qs('[data-form-ajuste]').addEventListener('submit', async (ev) => {
    ev.preventDefault(); const f = ev.target; const valor = Number(f.valor.value);
    if (!valor || !confirm(`${valor > 0 ? 'Creditar' : 'Debitar'} ${brl(Math.abs(valor))} para ${mascaraTelefone(c.telefone)}?`)) return;
    const { data, error } = await supabase.rpc('fidelidade_ajustar', { p_telefone: c.telefone, p_valor: valor, p_descricao: f.motivo.value.trim() });
    if (error) { toast('Erro: ' + error.message.replace(/^.*?exception:\s*/i, ''), 'erro'); return; }
    toast(`Saldo ajustado: ${brl(data.saldo)}`); buscarClienteFid(c.telefone);
  });
  qs('[data-reset-pin]')?.addEventListener('click', async () => {
    if (!confirm('Apagar o PIN deste cliente? Ele vai criar um novo pelo link de um pedido recente.')) return;
    const { error } = await supabase.from('clientes').update({ pin_hash: null, pin_tentativas: 0, pin_bloqueado_ate: null, atualizado_em: new Date().toISOString() }).eq('telefone', c.telefone);
    if (error) { toast('Erro: ' + error.message, 'erro'); return; }
    toast('PIN resetado'); buscarClienteFid(c.telefone);
  });
}
qs('[data-form-busca-cliente]').addEventListener('submit', (ev) => { ev.preventDefault(); buscarClienteFid(ev.target.telefone.value.replace(/\D/g, '')); });
