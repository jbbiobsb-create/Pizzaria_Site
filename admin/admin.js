// Painel da equipe: pedidos em tempo real, loja, cardápio e cupons
import { supabase } from '../js/supabase.js';
import { qs, qsa, esc, brl, toast, STATUS, PAGAMENTOS, dataHoraBR, horaBR, whatsappLink, DIAS, DIAS_ORDEM, mascaraTelefone } from '../js/util.js';

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
  $login.hidden = true; $app.hidden = false;
  qs('[data-usuario]').textContent = sessao.user.email;
  await carregarConfig();
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
}));
qs('[data-som]').addEventListener('click', () => { somLigado = !somLigado; localStorage.setItem('adm_som', somLigado ? '1' : '0'); atualizarSom(); if (somLigado) tocar(); });
function atualizarSom() { qs('[data-som]').textContent = somLigado ? '🔔 Som ligado' : '🔕 Som desligado'; }
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

function preencherLoja() {
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
  const { data, error } = await supabase.from('pedidos').select('*, pedido_itens(*)').gte('criado_em', desde.toISOString()).order('criado_em', { ascending: false }).limit(200);
  if (error) { toast('Erro ao carregar pedidos', 'erro'); return; }
  const novos = data.filter((p) => p.status === 'recebido' && !vistos.has(p.id));
  if (!primeira && novos.length) { tocar(); toast(`🍕 ${novos.length} novo(s) pedido(s)!`); }
  data.forEach((p) => vistos.add(p.id));
  pedidos = data; renderKanban();
  qs('[data-ultima]').textContent = new Date().toLocaleTimeString('pt-BR');
}
qs('[data-recarregar]').addEventListener('click', () => carregarPedidos());
qs('[data-agendados]').addEventListener('change', renderKanban);

function assinar() {
  canal = supabase.channel('pedidos-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => carregarPedidos()).subscribe();
}

function renderKanban() {
  const hoje = new Date().toDateString();
  const mostrarAg = qs('[data-agendados]').checked;
  for (const [col, sts] of Object.entries(COLUNAS)) {
    let lista = pedidos.filter((p) => sts.includes(p.status));
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
  const ag = p.agendado_para ? `<span>📅 ${dataHoraBR(p.agendado_para)}</span>` : '';
  return `<div class="pedido-card ${p.status === 'recebido' ? 'novo' : ''} ${p.agendado_para ? 'agendado' : ''}" data-abrir="${p.id}">
    <div class="cab"><span>#${p.numero} ${esc(p.cliente_nome)}</span><small>${horaBR(p.criado_em)}</small></div>
    <div class="itens">${esc(itens)}</div>
    <div class="meta"><span>${p.tipo_entrega === 'entrega' ? '🛵 Entrega' : '🏪 Retirada'}</span><span>${PAGAMENTOS[p.pagamento]?.rotulo.split(' ')[0] || p.pagamento}</span><span><b>${brl(p.total)}</b></span>${ag}</div>
    <div class="acoes">
      ${prox ? `<button class="btn" data-st="${prox}" data-id="${p.id}">${STATUS[prox].icone} ${STATUS[prox].rotulo}</button>` : ''}
      ${['entregue', 'cancelado'].includes(p.status) ? '' : `<button class="btn btn-ghost" data-st="cancelado" data-id="${p.id}">Cancelar</button>`}
    </div></div>`;
}
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
    <p class="small muted">${dataHoraBR(p.criado_em)} · ${p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}${p.agendado_para ? ` · <b>agendado para ${dataHoraBR(p.agendado_para)}</b>` : ''}</p>
    <div class="status-btns" style="margin:10px 0">${fluxo.map((s) => `<button class="btn btn-sm ${p.status === s ? '' : 'btn-outline'}" data-st="${s}" data-id="${p.id}">${STATUS[s].icone} ${STATUS[s].rotulo}</button>`).join('')}<button class="btn btn-sm btn-ghost" data-st="cancelado" data-id="${p.id}">✖ Cancelar</button></div>
    <div class="grid">
      <div class="bloco"><b>Cliente</b><br>${esc(p.cliente_nome)}<br>${mascaraTelefone(p.cliente_telefone)}<br><a class="btn btn-sm btn-wa no-print" style="margin-top:6px" target="_blank" href="${wa}">WhatsApp</a></div>
      <div class="bloco"><b>${p.tipo_entrega === 'entrega' ? 'Endereço' : 'Retirada na loja'}</b><br>${p.tipo_entrega === 'entrega' ? `${esc(e.rua)}, ${esc(e.numero)}${e.complemento ? ' - ' + esc(e.complemento) : ''}<br>${esc(e.bairro)} — ${esc(e.cidade)}/${esc(e.uf)}${e.referencia ? '<br>Ref.: ' + esc(e.referencia) : ''}${e.distancia_km ? `<br><small>${e.distancia_km} km${e.aprox ? ' (aprox.)' : ''}</small>` : ''}` : 'Cliente vem buscar'}</div>
    </div>
    <table><tbody>${(p.pedido_itens || []).map((i) => `<tr><td><b>${i.quantidade}×</b></td><td>${esc(i.nome)}${i.detalhes?.escolhas?.length ? '<br><small>' + i.detalhes.escolhas.map((x) => esc(x.nome)).join(', ') + '</small>' : ''}${i.detalhes?.observacao ? `<br><small>⚠ ${esc(i.detalhes.observacao)}</small>` : ''}</td><td style="text-align:right">${brl(i.subtotal)}</td></tr>`).join('')}</tbody></table>
    <div class="totais"><div><span>Subtotal</span><span>${brl(p.subtotal)}</span></div>${Number(p.desconto) ? `<div class="desconto"><span>Desconto ${esc(p.cupom_codigo || '')}</span><span>− ${brl(p.desconto)}</span></div>` : ''}<div><span>Taxa${p.taxa_a_confirmar ? ' (a confirmar!)' : ''}</span><span>${brl(p.taxa_entrega)}</span></div><div class="total"><span>Total</span><span>${brl(p.total)}</span></div></div>
    <p style="margin-top:8px"><b>Pagamento:</b> ${esc(PAGAMENTOS[p.pagamento]?.rotulo || p.pagamento)}${p.troco_para ? ` · troco para ${brl(p.troco_para)} (levar ${brl(p.troco_para - p.total)})` : ''}</p>
    ${p.observacoes ? `<p class="aviso" style="margin-top:8px">📝 ${esc(p.observacoes)}</p>` : ''}
    <p class="small muted" style="margin-top:10px">${(p.status_historico || []).map((h) => `${STATUS[h.status]?.rotulo || h.status} ${horaBR(h.em)}`).join(' → ')}</p>
    <div class="acoes no-print"><button class="btn btn-outline" onclick="window.print()">🖨 Imprimir</button></div>
  </div>`;
  qsa('#modal-pedido [data-st]').forEach((b) => b.addEventListener('click', () => mudarStatus(b.dataset.id, b.dataset.st)));
  qs('#modal-pedido').classList.add('aberto');
}
document.addEventListener('click', (ev) => { if (ev.target.matches('[data-fechar]') || ev.target.classList.contains('modal-bg')) qs('#modal-pedido').classList.remove('aberto'); });

// ------------------------------------------------------------------ cardápio
async function carregarCardapio() {
  const [{ data: tamanhos }, { data: sabores }, { data: precos }, { data: produtos }] = await Promise.all([
    supabase.from('tamanhos').select('*').order('ordem'), supabase.from('sabores').select('*').order('ordem'),
    supabase.from('sabor_precos').select('*'), supabase.from('produtos').select('*').order('ordem')]);
  const mapa = {}; (precos || []).forEach((p) => (mapa[`${p.sabor_id}-${p.tamanho_id}`] = p.preco));
  qs('[data-sabores]').innerHTML = `<table><thead><tr><th>Disp.</th><th>Sabor</th>${tamanhos.map((t) => `<th>${t.nome}</th>`).join('')}<th></th></tr></thead><tbody>${sabores.map((s) => `<tr data-sabor="${s.id}">
    <td><input type="checkbox" data-disp ${s.disponivel ? 'checked' : ''}></td>
    <td><b>${esc(s.nome)}</b><br><small class="muted">${esc(s.tipo)}${s.tags?.length ? ' · ' + s.tags.join(', ') : ''}</small></td>
    ${tamanhos.map((t) => `<td><input type="number" step="0.01" data-tam="${t.id}" value="${mapa[`${s.id}-${t.id}`] ?? ''}" placeholder="—"></td>`).join('')}
    <td><button class="btn" data-salvar-sabor>Salvar</button></td></tr>`).join('')}</tbody></table>`;
  qsa('[data-salvar-sabor]').forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr'); const id = Number(tr.dataset.sabor);
    const { error } = await supabase.from('sabores').update({ disponivel: qs('[data-disp]', tr).checked }).eq('id', id);
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
    <td><input type="checkbox" data-disp ${p.disponivel ? 'checked' : ''}></td><td><b>${esc(p.nome)}</b><br><small class="muted">${esc(p.tipo)}</small></td>
    <td><input type="number" step="0.01" data-preco value="${p.preco}"></td><td><button class="btn" data-salvar-produto>Salvar</button></td></tr>`).join('')}</tbody></table>`;
  qsa('[data-salvar-produto]').forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr');
    const { error } = await supabase.from('produtos').update({ disponivel: qs('[data-disp]', tr).checked, preco: Number(qs('[data-preco]', tr).value) }).eq('id', Number(tr.dataset.produto));
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
