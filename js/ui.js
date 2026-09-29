// Componentes compartilhados: header, subheader, tab bar, barra "Ver sacola", footer,
// bottom sheets (entrega/retirada, upsell) com puxador, arraste para fechar e rodapé fixo.
import * as cart from './cart.js';
import { carregarCardapio, buscarCep, geocodificar, calcularEntrega } from './api.js';
import { brl, esc, qs, qsa, mascaraCep, resumoHorario, whatsappLink, toast, lerLS, gravarLS } from './util.js';
import { LS } from './config.js';
import { icone, hidratarIcones } from './icons.js';
import { iniciarPWA } from './pwa.js';

// Ícones: ver js/icons.js
export { icone, hidratarIcones };

let CFG = null;
let PAGINA = '';

export async function config() {
  if (CFG) return CFG;
  const d = await carregarCardapio();
  CFG = d.config; CFG.aberta = d.aberta; CFG.lojas = d.lojas || [];
  return CFG;
}

// loja pelo slug (ou a principal)
export function lojaPorSlug(c, slug) {
  const ls = c?.lojas || [];
  return ls.find((l) => l.slug === slug) || ls.find((l) => l.principal) || ls[0] || null;
}
export function enderecoLoja(l) {
  const e = l?.endereco || {};
  return [e.rua, e.numero].filter(Boolean).join(', ') + (e.complemento ? ' - ' + e.complemento : '') + ` — ${e.bairro || ''}`;
}

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------
let COM_SACOLA = true;
export function montarLayout({ pagina = '', subheader = true, sacola = true } = {}) {
  const c = lerLS(LS.cardapio)?.dados?.config || {};
  const nome = c.nome || "Sesconetto's Pizzeria";
  PAGINA = pagina; COM_SACOLA = sacola;
  document.body.classList.add('com-tabbar');
  document.body.dataset.pagina = pagina;
  const header = `
  <header class="header">
    <div class="container">
      <a href="index.html" class="logo"><img src="img/logo.jpg" alt="${esc(nome)}"><span>${esc(nome)}<small>Napolitana · Brasília</small></span></a>
      <nav class="nav">
        <a href="cardapio.html" class="${pagina === 'cardapio' ? 'ativo' : ''}">Cardápio</a>
        <a href="cardapio.html#combos" class="${pagina === 'combos' ? 'ativo' : ''}">Combos</a>
        <a href="index.html#sobre">Nossa massa</a>
        <a href="pedido.html" class="${pagina === 'pedido' ? 'ativo' : ''}">Acompanhar pedido</a>
      </nav>
      <div class="header-right">
        <a href="cardapio.html" class="btn btn-sm btn-pedir">Pedir agora</a>
        <a href="carrinho.html" class="btn-carrinho" aria-label="Sua sacola">${icone('sacola')}<span class="txt">Sacola</span><span class="badge" data-badge></span></a>
      </div>
    </div>
  </header>
  ${subheader ? `<div class="subheader"><div class="container">
      <div class="seg" data-seg>
        <button type="button" data-tipo="entrega">Entrega</button>
        <button type="button" data-tipo="retirada"><span class="longo">Retirar na loja</span><span class="curto">Retirada</span></button>
      </div>
      <button type="button" class="pill-end" data-abrir-entrega>${icone('pin')}<span data-endereco-txt>Onde você está?</span></button>
      <div class="status-loja" data-status-loja><i></i><span>…</span></div>
  </div></div><div data-faixa-fechada></div>` : ''}`;
  const aba = (href, id, ic, rot, extra = '') => `<a href="${href}" class="${pagina === id ? 'ativo' : ''}" ${pagina === id ? 'aria-current="page"' : ''}>${icone(ic)}${rot}${extra}</a>`;
  const tabbar = `
  <nav class="tabbar" aria-label="Navegação principal">
    ${aba('index.html', 'home', 'casa', 'Início')}
    ${aba('cardapio.html', 'cardapio', 'pizza', 'Cardápio')}
    ${aba('carrinho.html', 'carrinho', 'sacola', 'Sacola', '<span class="badge" data-badge></span>')}
    ${aba('conta.html', 'conta', 'usuario', 'Conta')}
  </nav>`;
  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', tabbar + barraSacolaHTML() + modalEntregaHTML() + modalUpsellHTML());
  hidratarIcones();
  atualizarBadge();
  atualizarSacola();
  cart.onChange(() => { atualizarBadge(true); atualizarSacola(); });
  window.addEventListener('ses:entrega', atualizarSubheader);
  qsa('[data-abrir-entrega]').forEach((b) => b.addEventListener('click', () => abrirModalEntrega()));
  qsa('[data-seg] button').forEach((b) => b.addEventListener('click', () => abrirModalEntrega(b.dataset.tipo)));
  atualizarSubheader();
  config().then(atualizarSubheader).catch(() => {});
  iniciarPWA(); // service worker, banner "Instalar app" e push (js/pwa.js)
}

export function montarFooter() {
  config().then((c) => {
    const lojas = (c.lojas || []).map((l) => `<p><b>${esc(l.nome)}</b> · ${esc(enderecoLoja(l))}</p>`).join('');
    const nomes = (c.lojas || []).map((l) => l.nome);
    const html = `
    <div class="xadrez"></div>
    <footer class="footer">
      <div class="container">
        <div>
          <h4>${esc(c.nome)}</h4>
          <p>${esc(c.slogan || '')} · desde ${c.fundacao || 2022}</p>
          <div style="margin-top:8px">${lojas}</div>
          <p>${esc(resumoHorario(c.horario))}</p>
        </div>
        <div>
          <h4>Pedidos</h4>
          <a href="cardapio.html">Cardápio</a>
          <a href="cardapio.html#combos">Combos</a>
          <a href="pedido.html">Acompanhar pedido</a>
          <a href="carrinho.html">Minha sacola</a>
          <a href="conta.html">Minha conta</a>
        </div>
        <div>
          <h4>Fale com a gente</h4>
          <a href="${whatsappLink(c.whatsapp, 'Olá! Vim pelo site da ' + c.nome + '.')}" target="_blank" rel="noopener">WhatsApp ${esc(c.telefone || '')}</a>
          <a href="https://instagram.com/${esc(c.instagram || '')}" target="_blank" rel="noopener">Instagram @${esc(c.instagram || '')}</a>
          <a href="admin/index.html" class="muted small">Área da equipe</a>
        </div>
        <div class="legal">Entregamos em Brasília a partir da loja mais próxima${nomes.length ? ' (' + esc(nomes.join(', ')) + ')' : ''}, conforme a área de entrega e o horário de funcionamento. Cobramos taxa de entrega calculada pela distância. Nossos produtos contêm glúten e podem conter leite, ovos e traços de castanhas. Imagens ilustrativas. Bebidas alcoólicas: venda proibida para menores de 18 anos.</div>
      </div>
    </footer>
    <a class="wa-flutuante" href="${whatsappLink(c.whatsapp, 'Olá! Quero fazer um pedido na ' + c.nome + '.')}" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">${icone('wa')}</a>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }).catch(() => {});
}

function atualizarBadge(animar = false) {
  const n = cart.quantidadeTotal();
  qsa('[data-badge]').forEach((b) => {
    b.textContent = n ? n : '';
    if (animar && n) { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
  });
}

// barra "Ver sacola · N itens · R$ X" acima da tab bar (cardápio, home, conta…)
function barraSacolaHTML() {
  return `
  <div class="barra-fixa barra-sacola so-mobile" data-barra-sacola hidden role="region" aria-label="Resumo da sacola">
    <div class="container">
      <a class="btn-sacola" href="carrinho.html">
        <span class="txt"><span class="n" data-sacola-n>0</span><span>Ver sacola</span></span>
        <span class="val" data-sacola-total>R$ 0,00</span>
      </a>
    </div>
  </div>`;
}
const PAGINAS_SEM_SACOLA = ['carrinho', 'checkout'];
export function atualizarSacola() {
  const el = qs('[data-barra-sacola]'); if (!el) return;
  const n = cart.quantidadeTotal();
  const mostrar = COM_SACOLA && n > 0 && !PAGINAS_SEM_SACOLA.includes(PAGINA) && !document.body.classList.contains('tem-barra');
  el.hidden = !mostrar;
  document.body.classList.toggle('tem-sacola', mostrar);
  if (mostrar) {
    qs('[data-sacola-n]', el).textContent = n;
    qs('[data-sacola-total]', el).textContent = brl(cart.subtotal());
    qs('.btn-sacola', el).setAttribute('aria-label', `Ver sacola: ${n} ${n === 1 ? 'item' : 'itens'}, ${brl(cart.subtotal())}`);
  }
}

export function atualizarSubheader() {
  const e = cart.entrega();
  qsa('[data-seg] button').forEach((b) => b.classList.toggle('ativo', !!e && b.dataset.tipo === e.tipo));
  const txt = qs('[data-endereco-txt]');
  if (txt) {
    if (!e) txt.textContent = 'Onde você está?';
    else if (e.tipo === 'retirada') txt.textContent = 'Retirar na loja ' + (e.loja_nome || lojaPorSlug(CFG, e.loja)?.nome || '');
    else txt.textContent = `${e.endereco.rua}, ${e.endereco.numero}`;
  }
  const st = qs('[data-status-loja]');
  if (st && CFG) {
    const abre = CFG.horario?.seg?.[0] || '18:00';
    st.classList.toggle('aberta', !!CFG.aberta);
    st.classList.toggle('fechada', !CFG.aberta);
    st.querySelector('span').textContent = CFG.aberta ? 'Aberto' : 'Fechado';
    st.title = CFG.aberta ? 'Aberto agora' : 'Fechado · abre às ' + abre;
    st.setAttribute('aria-label', st.title);
    const faixa = qs('[data-faixa-fechada]');
    if (faixa) faixa.innerHTML = CFG.aberta ? '' : `<div class="faixa-fechada"><div class="container">${icone('relogio')}<span>Fechado agora · abre às ${esc(abre)}</span><a href="carrinho.html">Agendar pedido</a></div></div>`;
  }
}

// ------------------------------------------------------------------
// Modal genérico (bottom sheet no mobile, central no desktop)
// ------------------------------------------------------------------
let ultimoFoco = null;
export function abrirModal(id) {
  const m = qs('#' + id); if (!m) return;
  ultimoFoco = document.activeElement;
  m.classList.add('aberto');
  document.body.style.overflow = 'hidden';
  document.body.classList.add('modal-aberto');
  const corpo = qs('.modal-corpo', m); if (corpo) corpo.scrollTop = 0;
  const sheet = qs('.modal', m); if (sheet) sheet.style.transform = '';
  // foco inicial: título do sheet (leitores de tela anunciam) sem abrir teclado
  const h = qs('h2', m); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
}
export function fecharModal(id) {
  const m = qs('#' + id); if (!m) return;
  m.classList.remove('aberto');
  if (!qs('.modal-bg.aberto')) { document.body.style.overflow = ''; document.body.classList.remove('modal-aberto'); }
  if (ultimoFoco && typeof ultimoFoco.focus === 'function') { try { ultimoFoco.focus({ preventScroll: true }); } catch {} }
  ultimoFoco = null;
}
document.addEventListener('click', (ev) => {
  const bg = ev.target.closest('.modal-bg');
  if (ev.target.closest('[data-fechar]') || (bg && ev.target === bg)) { fecharModal(bg.id); }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  const aberto = qs('.modal-bg.aberto'); if (aberto) { ev.preventDefault(); fecharModal(aberto.id); }
});

// arrastar o sheet para baixo fecha (só quando o corpo está no topo); limiares: 100 px ou > 0,5 px/ms
function habilitarArraste(bg) {
  const sheet = qs('.modal', bg); const alca = qs('.modal-cabeca', bg); if (!sheet || !alca) return;
  let y0 = 0, t0 = 0, dy = 0, ativo = false;
  alca.addEventListener('pointerdown', (e) => {
    if (matchMedia('(min-width: 640px)').matches || e.target.closest('button')) return;
    ativo = true; y0 = e.clientY; t0 = performance.now(); dy = 0;
    sheet.classList.add('arrastando');
    try { alca.setPointerCapture(e.pointerId); } catch {}
  });
  alca.addEventListener('pointermove', (e) => {
    if (!ativo) return; dy = Math.max(0, e.clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const soltar = () => {
    if (!ativo) return; ativo = false;
    const v = dy / Math.max(1, performance.now() - t0);
    sheet.classList.remove('arrastando');
    if (dy > 100 || v > 0.5) { sheet.style.transform = ''; fecharModal(bg.id); }
    else { sheet.style.transition = 'transform .18s ease-out'; sheet.style.transform = ''; setTimeout(() => (sheet.style.transition = ''), 200); }
    dy = 0;
  };
  alca.addEventListener('pointerup', soltar);
  alca.addEventListener('pointercancel', soltar);
}
// estrutura padrão de um sheet: cabeça (puxador, fechar, título), corpo rolável e rodapé fixo
function sheetHTML(id, { titulo, sub = '', corpo, rodape = '' }) {
  return `
  <div class="modal-bg" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}-titulo">
    <div class="modal sheet">
      <div class="modal-cabeca">
        <div class="alca" aria-hidden="true"></div>
        <button type="button" class="fechar" data-fechar aria-label="Fechar">${icone('x')}</button>
        <h2 id="${id}-titulo">${titulo}</h2>
        ${sub ? `<p class="muted small">${sub}</p>` : ''}
      </div>
      <div class="modal-corpo">${corpo}</div>
      ${rodape ? `<div class="modal-rodape">${rodape}</div>` : ''}
    </div>
  </div>`;
}

// ------------------------------------------------------------------
// Modal entrega / retirada
// ------------------------------------------------------------------
function modalEntregaHTML() {
  return sheetHTML('modal-entrega', {
    titulo: 'Como você quer receber?',
    sub: 'Precisamos disso para calcular a taxa e o tempo do seu pedido.',
    corpo: `
      <div class="escolha-entrega">
        <button type="button" data-tipo="entrega"><div class="ic">${icone('moto')}</div><div><b>Entrega</b><small>Receba em casa</small></div></button>
        <button type="button" data-tipo="retirada"><div class="ic">${icone('loja')}</div><div><b>Retirar na loja</b><small>Peça antes e só passe para buscar</small></div></button>
      </div>
      <form id="form-entrega" novalidate>
        <div class="linha-campos">
          <div class="campo"><label for="ent-cep">CEP</label><input id="ent-cep" name="cep" inputmode="numeric" placeholder="00000-000" autocomplete="postal-code"></div>
          <div class="campo"><label for="ent-numero">Número *</label><input id="ent-numero" name="numero" placeholder="Ex.: 12" autocomplete="off"></div>
        </div>
        <div class="campo"><label for="ent-rua">Rua / Quadra *</label><input id="ent-rua" name="rua" placeholder="Rua, quadra, chácara…" autocomplete="street-address"></div>
        <div class="linha-campos">
          <div class="campo"><label for="ent-compl">Complemento</label><input id="ent-compl" name="complemento" placeholder="Apto, bloco, casa…"></div>
          <div class="campo"><label for="ent-bairro">Bairro *</label><input id="ent-bairro" name="bairro" placeholder="Bairro"></div>
        </div>
        <div class="linha-campos cidade-uf">
          <div class="campo"><label for="ent-cidade">Cidade *</label><input id="ent-cidade" name="cidade" value="Brasília"></div>
          <div class="campo"><label for="ent-uf">UF</label><input id="ent-uf" name="uf" value="DF" maxlength="2"></div>
        </div>
        <details class="detalhe" data-ref>
          <summary>${icone('mais')} Ponto de referência</summary>
          <div class="campo"><label for="ent-ref">Ponto de referência</label><input id="ent-ref" name="referencia" placeholder="Ex.: portão verde, ao lado da padaria"></div>
        </details>
        <div class="aviso erro" data-erro hidden></div>
        <div class="resumo-entrega" data-resumo hidden></div>
        <button type="submit" class="sr" tabindex="-1" aria-hidden="true"></button>
      </form>
      <div id="bloco-retirada" hidden>
        <p class="small muted" style="margin-bottom:8px">Escolha a loja onde vai buscar:</p>
        <div class="lojas-retirada" data-lojas-retirada></div>
        <div class="resumo-entrega" data-resumo-retirada></div>
      </div>`,
    rodape: `
      <div class="acoes" data-acoes-entrega><button class="btn btn-lg" type="submit" form="form-entrega" data-salvar>Calcular taxa e salvar</button></div>
      <div class="acoes" data-acoes-retirada hidden><button class="btn btn-lg" type="button" data-salvar-retirada>Vou retirar na loja</button></div>
      <a class="link-secundario" href="cardapio.html" data-fechar data-ver-cardapio>Ver o cardápio primeiro</a>`,
  });
}

let tipoModal = 'entrega';
let lojaRetirada = null;
// distância aproximada em km (só para sugerir a loja de retirada)
function dist(l, e) { const r = Math.PI / 180, x = (e.lng - l.lng) * r * Math.cos(((e.lat + l.lat) / 2) * r), y = (e.lat - l.lat) * r; return Math.hypot(x, y) * 6371; }
export function abrirModalEntrega(tipo) {
  const m = qs('#modal-entrega');
  const atual = cart.entrega();
  tipoModal = tipo || atual?.tipo || 'entrega';
  qsa('.escolha-entrega button', m).forEach((b) => {
    b.classList.toggle('ativo', b.dataset.tipo === tipoModal);
    b.onclick = () => { tipoModal = b.dataset.tipo; abrirModalEntrega(tipoModal); };
  });
  const form = qs('#form-entrega', m); const ret = qs('#bloco-retirada', m);
  form.hidden = tipoModal !== 'entrega'; ret.hidden = tipoModal !== 'retirada';
  qs('[data-acoes-entrega]', m).hidden = tipoModal !== 'entrega'; qs('[data-acoes-retirada]', m).hidden = tipoModal !== 'retirada';
  qs('[data-erro]', form).hidden = true; qs('[data-resumo]', form).hidden = true;
  // "ver o cardápio primeiro" só faz sentido fora do cardápio
  const ver = qs('[data-ver-cardapio]', m); if (ver) ver.hidden = PAGINA === 'cardapio' || PAGINA === 'carrinho';
  if (atual?.tipo === 'entrega' && atual.endereco) {
    for (const [k, v] of Object.entries(atual.endereco)) if (form.elements[k]) form.elements[k].value = v ?? '';
    if (atual.endereco.referencia) qs('[data-ref]', form).open = true;
  }
  config().then((c) => {
    // loja sugerida: a já escolhida, senão a mais perto do endereço salvo, senão a principal
    const lojas = (c.lojas || []).filter((l) => l.aceita_retirada);
    let escolhida = atual?.tipo === 'retirada' ? atual.loja : null;
    if (!escolhida && atual?.endereco?.lat) escolhida = [...lojas].sort((a, b) => dist(a, atual.endereco) - dist(b, atual.endereco))[0]?.slug;
    lojaRetirada = lojaPorSlug({ lojas }, escolhida)?.slug;
    const lista = qs('[data-lojas-retirada]', ret);
    const pintar = () => {
      lista.innerHTML = lojas.map((l) => `<button type="button" class="opcao ${l.slug === lojaRetirada ? 'ativo' : ''}" data-loja="${esc(l.slug)}"><b>${icone('loja')} ${esc(l.nome)}</b><small>${esc(enderecoLoja(l))}</small></button>`).join('');
      qsa('[data-loja]', lista).forEach((b) => b.addEventListener('click', () => { lojaRetirada = b.dataset.loja; pintar(); }));
    };
    pintar();
    qs('[data-resumo-retirada]', ret).innerHTML = `<span class="muted">${esc(resumoHorario(c.horario))}</span><br>Fica pronto em <b>${c.tempo_retirada_min}–${c.tempo_retirada_max} min</b> · sem taxa`;
    qsa('.escolha-entrega button', m)[0].disabled = c.aceita_entrega === false;
    qsa('.escolha-entrega button', m)[1].disabled = c.aceita_retirada === false;
  });
  abrirModal('modal-entrega');
}

function ligarFormEntrega() {
  const m = qs('#modal-entrega'); if (!m || m._ligado) return; m._ligado = true;
  habilitarArraste(m);
  habilitarArraste(qs('#modal-upsell'));
  const form = qs('#form-entrega', m);
  const cep = form.elements.cep;
  cep.addEventListener('input', async () => {
    cep.value = mascaraCep(cep.value);
    if (cep.value.length === 9) {
      const d = await buscarCep(cep.value);
      if (d) { if (d.rua) form.elements.rua.value = d.rua; if (d.bairro) form.elements.bairro.value = d.bairro; form.elements.cidade.value = d.cidade; form.elements.uf.value = d.uf; form.elements.numero.focus(); }
    }
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = qs('[data-erro]', form); const resumo = qs('[data-resumo]', form); const btn = qs('[data-salvar]', m);
    erro.hidden = true; resumo.hidden = true;
    const end = Object.fromEntries(['cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'referencia'].map((k) => [k, form.elements[k].value.trim()]));
    if (!end.rua || !end.numero || !end.bairro || !end.cidade) { erro.textContent = 'Preencha rua, número, bairro e cidade.'; erro.hidden = false; erro.scrollIntoView({ block: 'nearest' }); return; }
    btn.disabled = true; btn.textContent = 'Calculando…';
    try {
      const geo = await geocodificar(end);
      let calc;
      if (geo) { end.lat = geo.lat; end.lng = geo.lng; end.aprox = !!geo.aprox; calc = await calcularEntrega(geo.lat, geo.lng); if (geo.aprox) calc.a_confirmar = true; }
      else { calc = await calcularEntrega(null, null); }
      if (!calc.ok && calc.motivo === 'sem_loja') { erro.textContent = 'No momento nenhuma loja está fazendo entregas. Você pode retirar na loja ou falar com a gente pelo WhatsApp.'; erro.hidden = false; erro.scrollIntoView({ block: 'nearest' }); return; }
      if (!calc.ok) {
        erro.innerHTML = `Esse endereço fica a <b>${calc.distancia_km} km</b> da loja mais próxima, fora da nossa área de entrega (até ${calc.raio_km} km). Você pode <b>retirar na loja</b> ou falar com a gente pelo WhatsApp.`;
        erro.hidden = false; erro.scrollIntoView({ block: 'nearest' }); return;
      }
      const c = await config();
      end.distancia_km = calc.distancia_km;
      cart.salvarEntrega({ tipo: 'entrega', endereco: end, taxa: Number(calc.taxa), a_confirmar: !!calc.a_confirmar, distancia_km: calc.distancia_km, loja: calc.loja?.slug, loja_nome: calc.loja?.nome });
      resumo.innerHTML = `Taxa de entrega: <b>${brl(calc.taxa)}</b>${calc.a_confirmar ? ' <span class="muted">(a confirmar pela pizzaria)</span>' : ` · ${calc.distancia_km} km`}${calc.loja ? `<br>Sai da loja <b>${esc(calc.loja.nome)}</b>` : ''}<br>Chega em <b>${c.tempo_entrega_min}–${c.tempo_entrega_max} min</b> depois de confirmado.`;
      resumo.hidden = false; resumo.scrollIntoView({ block: 'nearest' });
      toast('Endereço salvo!');
      setTimeout(() => fecharModal('modal-entrega'), 900);
    } catch (e) {
      erro.textContent = 'Não conseguimos calcular agora. Tente de novo em instantes.'; erro.hidden = false;
    } finally { btn.disabled = false; btn.textContent = 'Calcular taxa e salvar'; }
  });
  qs('[data-salvar-retirada]', m).addEventListener('click', () => {
    const l = lojaPorSlug(CFG, lojaRetirada);
    cart.salvarEntrega({ tipo: 'retirada', taxa: 0, loja: l?.slug, loja_nome: l?.nome });
    toast(l ? `Retirada na loja ${l.nome}` : 'Retirada na loja selecionada');
    fecharModal('modal-entrega');
  });
}
document.addEventListener('DOMContentLoaded', ligarFormEntrega);
setTimeout(ligarFormEntrega, 0);

// ------------------------------------------------------------------
// Upsell ("Quer completar?")
// ------------------------------------------------------------------
function modalUpsellHTML() {
  return sheetHTML('modal-upsell', {
    titulo: 'Adicionado! Quer completar?',
    sub: 'Uma bebida gelada ou um docinho pra fechar.',
    corpo: `<div class="upsell-lista" data-upsell></div>`,
    rodape: `<div class="acoes">
        <a class="btn btn-outline" href="cardapio.html">Continuar pedindo</a>
        <a class="btn" href="carrinho.html">Ver sacola</a>
      </div>`,
  });
}

export async function abrirUpsell(excluirSlug) {
  const d = await carregarCardapio();
  const bebidas = d.produtos.filter((p) => p.categoria === 'bebidas' && p.disponivel && p.slug !== excluirSlug).slice(0, 4);
  const molhos = d.produtos.filter((p) => p.categoria === 'molhos' && p.disponivel && p.slug !== excluirSlug);
  const doces = d.sabores.filter((s) => s.tipo === 'doce' && s.disponivel).slice(0, 2);
  const lista = qs('[data-upsell]');
  lista.innerHTML = [...molhos, ...bebidas].map((p) => `
    <div class="upsell-item">
      ${p.imagem_url ? `<img src="${esc(p.imagem_url)}" alt="">` : `<div class="ph">${icone('bebida')}</div>`}
      <b>${esc(p.nome)}</b><span class="p">${brl(p.preco)}</span>
      <button class="btn btn-sm" data-add="${esc(p.slug)}">Adicionar</button>
    </div>`).join('') + doces.map((s) => `
    <div class="upsell-item">
      ${s.imagem_url ? `<img src="${esc(s.imagem_url)}" alt="">` : `<div class="ph">${icone('doce')}</div>`}
      <b>${esc(s.nome.split(' (')[0])} (doce)</b><span class="p">a partir de ${brl(s.precoMin)}</span>
      <a class="btn btn-sm btn-outline" href="produto.html?sabor=${esc(s.slug)}">Escolher</a>
    </div>`).join('');
  qsa('[data-add]', lista).forEach((b) => b.addEventListener('click', () => {
    const p = d.produtosPorSlug[b.dataset.add];
    cart.adicionar({ tipo: 'produto', slug: p.slug, nome: p.nome, imagem: p.imagem_url, preco: Number(p.preco), quantidade: 1 });
    b.innerHTML = `${icone('check')} Adicionado`; b.disabled = true;
    toast(`${p.nome} adicionado`);
  }));
  abrirModal('modal-upsell');
}

// garante que há entrega escolhida antes de seguir; retorna true se ok
export function exigirEntrega() {
  if (cart.entrega()) return true;
  abrirModalEntrega();
  return false;
}

export function tagHTML(t) {
  const nomes = { 'mais-pedida': 'Mais pedida', novidade: 'Novidade', vegetariana: 'Vegetariana', vegana: 'Vegana', esgotado: 'Esgotado' };
  return `<span class="tag ${esc(t)}">${nomes[t] || esc(t)}</span>`;
}

// skeleton com a forma dos cards (usado enquanto o cardápio carrega)
export function skeletonCards(n = 6) {
  return Array.from({ length: n }, () => `<div class="skeleton-card" aria-hidden="true"><div class="l"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div><div class="f skeleton"></div></div>`).join('');
}
