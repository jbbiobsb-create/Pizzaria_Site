// Componentes compartilhados: header (com a pill de endereço), subheader, tab bar, barra "Fechar pedido", footer,
// bottom sheets (entrega/retirada, upsell) com puxador, arraste para fechar e rodapé fixo.
import * as cart from './cart.js';
import { carregarCardapio, buscarCep, geocodificar, calcularEntrega } from './api.js';
import { brl, esc, qs, qsa, mascaraCep, resumoHorario, whatsappLink, toast, lerLS, gravarLS, faixaMin, debounce, track } from './util.js';
import { LS } from './config.js';
import { icone, hidratarIcones } from './icons.js';
import { iniciarPWA } from './pwa.js';

// Ícones: ver js/icons.js
export { icone, hidratarIcones };

let CFG = null;
let CFG_PRE = null; // config do cache local: pinta subheader/faixa antes da rede (sem salto de layout)
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
  return [e.rua, e.numero].filter(Boolean).join(', ') + (e.complemento ? ' - ' + e.complemento : '') + (e.bairro ? ` · ${e.bairro}` : '');
}

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------
let COM_SACOLA = true;
export function montarLayout({ pagina = '', subheader = true, sacola = true } = {}) {
  const cache = lerLS(LS.cardapio)?.dados;
  const c = cache?.config || {};
  if (cache?.config && cache.aberta != null) CFG_PRE = { ...cache.config, aberta: cache.aberta, lojas: cache.lojas || [] };
  const nome = c.nome || "Sesconetto's Pizzeria";
  PAGINA = pagina; COM_SACOLA = sacola;
  document.body.classList.add('com-tabbar');
  document.body.classList.toggle('tem-sub', !!subheader); // espaço do subheader fixo (o HTML já traz a classe: sem salto)
  document.body.dataset.pagina = pagina;
  const header = `
  <header class="header">
    <div class="container">
      <a href="index.html" class="logo"><picture><source type="image/webp" srcset="img/logo-96.webp"><img src="img/logo.jpg" alt="${esc(nome)}" width="40" height="40" decoding="async"></picture><span>${esc(nome)}</span></a>
      <nav class="nav">
        <a href="cardapio.html" class="${pagina === 'cardapio' ? 'ativo' : ''}">Cardápio</a>
        <a href="cardapio.html#combos" class="${pagina === 'combos' ? 'ativo' : ''}">Combos</a>
        <a href="index.html#sobre">Nossa massa</a>
        <a href="pedido.html" class="${pagina === 'pedido' ? 'ativo' : ''}">Meu pedido</a>
      </nav>
      ${subheader ? `<button type="button" class="pill-end" data-abrir-entrega>${icone('pin')}<span data-endereco-txt>Informar endereço</span>${icone('chevron-baixo', 'chevron')}</button>` : ''}
      <div class="header-right">
        <a href="cardapio.html" class="btn btn-sm btn-pedir">Pedir agora</a>
        <a href="checkout.html" class="btn-carrinho" aria-label="Sua sacola">${icone('sacola')}<span class="txt">Sacola</span><span class="badge" data-badge></span></a>
      </div>
    </div>
  </header>
  ${subheader ? `<div class="subheader"><div class="container">
      <div class="seg" data-seg>
        <button type="button" data-tipo="entrega" aria-pressed="false">Entrega</button>
        <button type="button" data-tipo="retirada" aria-pressed="false"><span class="longo">Retirar na loja</span><span class="curto">Retirada</span></button>
      </div>
      <div class="status-loja" data-status-loja role="status"><i aria-hidden="true"></i><span>…</span></div>
  </div></div><div data-faixa-fechada></div>` : ''}`;
  const aba = (href, id, ic, rot, extra = '') => `<a href="${href}" class="${pagina === id ? 'ativo' : ''}" ${pagina === id ? 'aria-current="page"' : ''}>${icone(ic)}${rot}${extra}</a>`;
  const tabbar = `
  <nav class="tabbar" aria-label="Navegação principal">
    ${aba('index.html', 'home', 'casa', 'Início')}
    ${aba('cardapio.html', 'cardapio', 'pizza', 'Cardápio')}
    ${aba('checkout.html', 'checkout', 'sacola', 'Sacola', '<span class="badge" data-badge></span>')}
    ${aba('conta.html', 'conta', 'usuario', 'Conta')}
  </nav>`;
  document.body.insertAdjacentHTML('afterbegin', header);
  const skip = qs('.skip-link'); if (skip) document.body.prepend(skip);
  document.body.insertAdjacentHTML('beforeend', tabbar + barraSacolaHTML() + modalEntregaHTML());
  hidratarIcones();
  atualizarBadge();
  atualizarSacola();
  cart.onChange(() => { atualizarBadge(true); atualizarSacola(); });
  window.addEventListener('ses:entrega', atualizarSubheader);
  qsa('[data-abrir-entrega]').forEach((b) => b.addEventListener('click', () => abrirModalEntrega()));
  qsa('[data-seg] button').forEach((b) => b.addEventListener('click', () => abrirModalEntrega(b.dataset.tipo)));
  atualizarSubheader();
  config().then(atualizarSubheader).catch(() => {});
  observarFixos();
  iniciarPWA(); // service worker, banner "Instalar app" e push (js/pwa.js)
}

// Altura REAL das barras fixas (checkout cresce com a linha "falta…") e do banner de instalação → --barra-h / --banner-h
// no body. Toasts, banner e o padding do body usam essas variáveis, então nada fica coberto.
let roFixos = null;
function observarFixos() {
  if (roFixos || !('ResizeObserver' in window)) return;
  const altura = (el) => (el ? Math.ceil(el.getBoundingClientRect().height) : 0);
  const medir = () => {
    const barra = qsa('.barra-fixa').find((el) => altura(el) > 0);
    if (barra) document.body.style.setProperty('--barra-h', altura(barra) + 'px'); else document.body.style.removeProperty('--barra-h');
    const banner = qs('.banner-instalar');
    if (altura(banner) > 0) document.body.style.setProperty('--banner-h', altura(banner) + 'px'); else document.body.style.removeProperty('--banner-h');
  };
  roFixos = new ResizeObserver(medir);
  const ligar = () => qsa('.barra-fixa, .banner-instalar').forEach((el) => roFixos.observe(el));
  ligar(); medir();
  new MutationObserver(() => { ligar(); medir(); }).observe(document.body, { childList: true });
  window.addEventListener('resize', medir);
}

export function montarFooter() {
  config().then((c) => {
    const lojas = (c.lojas || []).map((l) => `<p><b>${esc(l.nome)}</b> · ${esc(enderecoLoja(l))}</p>`).join('');
    const nomes = (c.lojas || []).map((l) => l.nome);
    const html = `
    <footer class="footer">
      <div class="container">
        <div>
          <h2 class="footer-titulo">${esc(c.nome)}</h2>
          <p>${esc(c.slogan || '')} · desde ${c.fundacao || 2022}</p>
          <div style="margin-top:8px">${lojas}</div>
          <p>${esc(resumoHorario(c.horario))}</p>
        </div>
        <div>
          <h2 class="footer-titulo">Pedidos</h2>
          <a href="cardapio.html">Cardápio</a>
          <a href="cardapio.html#combos">Combos</a>
          <a href="pedido.html">Acompanhar pedido</a>
          <a href="checkout.html">Minha sacola</a>
          <a href="conta.html">Minha conta</a>
        </div>
        <div>
          <h2 class="footer-titulo">Fale com a gente</h2>
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

let nBadge = -1;
function atualizarBadge(animar = false) {
  const n = cart.quantidadeTotal();
  const cresceu = nBadge >= 0 && n > nBadge; nBadge = n;
  qsa('[data-badge]').forEach((b) => {
    b.textContent = n ? n : '';
    if (animar && cresceu) { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
  });
}

// barra "1 item · R$ X · Fechar pedido" acima da tab bar (cardápio, home, conta…)
function barraSacolaHTML() {
  return `
  <div class="barra-fixa barra-sacola so-mobile" data-barra-sacola hidden role="region" aria-label="Resumo da sacola">
    <div class="container">
      <a class="btn-sacola" href="checkout.html" data-fechar-pedido>
        <span class="txt"><span class="n" data-sacola-n>0</span><span data-sacola-rotulo>Fechar pedido</span></span>
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
    qs('.btn-sacola', el).setAttribute('aria-label', `Fechar pedido: ${n} ${n === 1 ? 'item' : 'itens'}, ${brl(cart.subtotal())}`);
  }
}

// horário de hoje [abre, fecha] (chaves dom..sab)
const CHAVES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
export function horarioHoje(c) {
  const k = CHAVES_DIA[new Date().getDay()];
  return c?.horario?.[k] || null;
}
// minutos até fechar (null se fechado/sem horário)
function minutosParaFechar(c) {
  const h = horarioHoje(c); if (!h) return null;
  const [hf, mf] = h[1].split(':').map(Number);
  const agora = new Date(); const fim = new Date(); fim.setHours(hf, mf, 0, 0);
  return Math.round((fim - agora) / 60000);
}
// próxima abertura ("18:00" de hoje ou o próximo dia com horário)
export function proximaAbertura(c) {
  const h = horarioHoje(c);
  return h ? h[0] : (c?.horario?.seg?.[0] || '18:00');
}

export function atualizarSubheader() {
  const e = cart.entrega();
  qsa('[data-seg] button').forEach((b) => { const on = !!e && b.dataset.tipo === e.tipo; b.classList.toggle('ativo', on); b.setAttribute('aria-pressed', String(on)); });
  const txt = qs('[data-endereco-txt]');
  if (txt) {
    // o pill é um status (não uma pergunta): endereço + taxa, ou loja de retirada
    if (!e) txt.textContent = 'Informar endereço';
    else if (e.tipo === 'retirada') txt.textContent = `Buscar em ${e.loja_nome || lojaPorSlug(CFG, e.loja)?.nome || 'loja'} · sem taxa`;
    else txt.textContent = `${e.endereco.rua}, ${e.endereco.numero}${e.taxa != null ? ` · ${brl(e.taxa)}` : ''}`;
  }
  const st = qs('[data-status-loja]');
  const C = CFG || CFG_PRE;
  if (st && C) {
    const abre = proximaAbertura(C);
    const hoje = horarioHoje(C);
    st.classList.toggle('aberta', !!C.aberta);
    st.classList.toggle('fechada', !C.aberta);
    st.querySelector('span').textContent = C.aberta ? (hoje ? `Aberto · fecha ${hoje[1]}` : 'Aberto') : 'Fechado';
    st.title = C.aberta ? (hoje ? `Aberto agora · fecha às ${hoje[1]}` : 'Aberto agora') : 'Fechado · abre às ' + abre;
    const faixa = qs('[data-faixa-fechada]');
    if (faixa) {
      const min = C.aberta ? minutosParaFechar(C) : null;
      // uma linha só (a faixa é fixa, 40px): o detalhe está no hero e no ticket da home
      if (!C.aberta) faixa.innerHTML = `<div class="faixa-fechada"><div class="container">${icone('relogio')}<span>Fechado agora · abre às ${esc(abre)}</span><a href="cardapio.html">Agendar para hoje</a></div></div>`;
      // urgência só quando é real: menos de 60 min para fechar
      else if (min != null && min > 0 && min < 60 && hoje) faixa.innerHTML = `<div class="faixa-fechada faixa-fechando"><div class="container">${icone('relogio')}<span>Fechamos às ${esc(hoje[1])} · pedidos até ${esc(horaMenos(hoje[1], 30))}</span><a href="cardapio.html">Pedir agora</a></div></div>`;
      else faixa.innerHTML = '';
      // o CSS reserva a altura da faixa (--faixa-h) por esta classe; js/pre.js já a marca antes do 1º paint quando há cache
      document.documentElement.classList.toggle('tem-faixa', !!faixa.firstChild);
    }
  }
}
function horaMenos(hhmm, min) {
  const [h, m] = hhmm.split(':').map(Number); const t = h * 60 + m - min;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// ------------------------------------------------------------------
// Modal genérico (bottom sheet no mobile, central no desktop)
// ------------------------------------------------------------------
let ultimoFoco = null;
// tudo fora do sheet fica inerte (leitor de tela e Tab não saem do diálogo); desfeito ao fechar o último sheet
function inerteFundo(ligar) {
  qsa('body > :not(.modal-bg):not(#toast):not(.toast):not(script)').forEach((el) => {
    if (ligar) { if (!el.inert) { el.inert = true; el.dataset.inerte = '1'; } }
    else if (el.dataset.inerte) { el.inert = false; delete el.dataset.inerte; }
  });
}
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
export function abrirModal(id) {
  const m = qs('#' + id); if (!m) return;
  ultimoFoco = document.activeElement;
  m.classList.add('aberto');
  document.body.style.overflow = 'hidden';
  document.body.classList.add('modal-aberto');
  inerteFundo(true);
  const corpo = qs('.modal-corpo', m); if (corpo) corpo.scrollTop = 0;
  const sheet = qs('.modal', m); if (sheet) sheet.style.transform = '';
  // foco inicial: título do sheet (leitores de tela anunciam) sem abrir teclado
  const h = qs('h2', m); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
}
export function fecharModal(id) {
  const m = qs('#' + id); if (!m) return;
  m.classList.remove('aberto');
  m.style.removeProperty('--teclado');
  if (!qs('.modal-bg.aberto')) { document.body.style.overflow = ''; document.body.classList.remove('modal-aberto'); inerteFundo(false); }
  if (ultimoFoco && typeof ultimoFoco.focus === 'function') { try { ultimoFoco.focus({ preventScroll: true }); } catch {} }
  ultimoFoco = null;
}
// Tab preso dentro do sheet aberto (o fundo já é inert; isto evita o foco ir para a barra do navegador)
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Tab') return;
  const m = qs('.modal-bg.aberto'); if (!m) return;
  const f = qsa(FOCAVEIS, m).filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (!f.length) { ev.preventDefault(); return; }
  const primeiro = f[0], ultimo = f[f.length - 1];
  if (ev.shiftKey && (document.activeElement === primeiro || !m.contains(document.activeElement))) { ev.preventDefault(); ultimo.focus(); }
  else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
});
// teclado aberto (iOS não encolhe o viewport): o sheet sobe o equivalente ao teclado para o rodapé continuar visível
if (window.visualViewport) {
  const ajustar = () => {
    const m = qs('.modal-bg.aberto'); if (!m) return;
    const vv = window.visualViewport;
    const dif = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    if (dif > 60) m.style.setProperty('--teclado', dif + 'px'); else m.style.removeProperty('--teclado');
  };
  window.visualViewport.addEventListener('resize', ajustar);
  window.visualViewport.addEventListener('scroll', ajustar);
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
    sheet.classList.add('arrastando'); bg.classList.add('arrastando');
    try { alca.setPointerCapture(e.pointerId); } catch {}
  });
  alca.addEventListener('pointermove', (e) => {
    if (!ativo) return; dy = e.clientY - y0;
    // para cima: atrito (resiste em vez de parede); para baixo: 1:1 e o fundo clareia junto
    const vis = dy < 0 ? -Math.pow(-dy, .65) : dy;
    sheet.style.transform = `translateY(${vis}px)`;
    bg.style.opacity = dy > 0 ? String(Math.max(.25, 1 - dy / Math.max(240, sheet.offsetHeight))) : '';
  });
  const soltar = () => {
    if (!ativo) return; ativo = false;
    const v = dy / Math.max(1, performance.now() - t0);
    // tirar "arrastando" e a transformação inline no mesmo tick: a transição parte de onde o dedo soltou (sem piscar)
    sheet.classList.remove('arrastando'); bg.classList.remove('arrastando');
    sheet.style.transform = ''; bg.style.opacity = '';
    if (dy > 100 || v > 0.4) fecharModal(bg.id);
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

// cria (uma vez) um sheet dinâmico com a estrutura padrão e devolve o elemento.
// Usado por js/fidelidade.js (regulamento, esqueci o PIN, trocar PIN). Abrir com abrirModal(id).
export function criarSheet(id, opts) {
  let el = qs('#' + id);
  if (el) return el;
  document.body.insertAdjacentHTML('beforeend', sheetHTML(id, opts));
  el = qs('#' + id);
  habilitarArraste(el);
  return el;
}

// ------------------------------------------------------------------
// Entrega / retirada: UM componente, usado inline na tela "Fechar pedido" e dentro do sheet
// (pill do subheader, "trocar"). Estado: cart.entrega(); último endereço lembrado em LS.enderecoLembrado.
// ------------------------------------------------------------------
function enderecoLembrado() { return lerLS(LS.enderecoLembrado, null); }
function resumoEndereco(end) { return `${end.rua}, ${end.numero}${end.complemento ? ' - ' + end.complemento : ''}`; }
// distância aproximada em km (só para sugerir a loja de retirada)
function dist(l, e) { const r = Math.PI / 180, x = (e.lng - l.lng) * r * Math.cos(((e.lat + l.lat) / 2) * r), y = (e.lat - l.lat) * r; return Math.hypot(x, y) * 6371; }
// loja sugerida para retirada: a já escolhida, senão a mais perto do endereço lembrado, senão a principal
export function lojaSugerida(c, atual) {
  const lojas = (c?.lojas || []).filter((l) => l.aceita_retirada);
  let slug = atual?.tipo === 'retirada' ? atual.loja : null;
  const end = atual?.endereco || enderecoLembrado();
  if (!slug && end?.lat) slug = [...lojas].sort((a, b) => dist(a, end) - dist(b, end))[0]?.slug;
  return lojaPorSlug({ lojas }, slug);
}

let seqEntrega = 0;
export function entregaHTML(idp = 'ent') {
  return `
  <div class="entrega" data-entrega>
    <div class="escolha-entrega" data-tipo-entrega role="radiogroup" aria-label="Como você recebe">
      <button type="button" role="radio" aria-checked="false" data-tipo="entrega"><div class="ic">${icone('moto')}</div><div><b>Entrega</b><small data-sub-entrega>chega em 40 a 60 min</small></div></button>
      <button type="button" role="radio" aria-checked="false" data-tipo="retirada"><div class="ic">${icone('loja')}</div><div><b>Retirar na loja</b><small data-sub-retirada>pronta em 30 a 50 min · sem taxa</small></div></button>
    </div>
    <div data-bloco-entrega hidden>
      <div class="endereco-lembrado" data-endereco-lembrado hidden></div>
      <div class="form-entrega" data-form-entrega hidden>
        <p class="small muted" style="margin:10px 0 8px">Onde entregamos?</p>
        <div class="campo"><label for="${idp}-cep">CEP <span class="muted">opcional, preenche rua e bairro</span></label><input id="${idp}-cep" name="cep" inputmode="numeric" placeholder="70000-000" autocomplete="postal-code"></div>
        <div class="campo"><label for="${idp}-rua">Rua ou quadra</label><input id="${idp}-rua" name="rua" placeholder="Rua, quadra, chácara" autocomplete="street-address"><span class="erro-msg" data-erro-campo="rua" hidden>Falta a rua ou quadra</span></div>
        <div class="linha-campos">
          <div class="campo"><label for="${idp}-numero">Número</label><input id="${idp}-numero" name="numero" placeholder="Ex.: 12" autocomplete="off"><span class="erro-msg" data-erro-campo="numero" hidden>Falta o número</span></div>
          <div class="campo"><label for="${idp}-compl">Complemento</label><input id="${idp}-compl" name="complemento" placeholder="Apto, bloco, casa"></div>
        </div>
        <div class="campo"><label for="${idp}-bairro">Bairro</label><input id="${idp}-bairro" name="bairro" placeholder="Bairro"><span class="erro-msg" data-erro-campo="bairro" hidden>Falta o bairro</span></div>
        <details class="detalhe" data-ref>
          <summary>${icone('mais')} Ponto de referência</summary>
          <div class="campo"><label for="${idp}-ref">Ponto de referência</label><input id="${idp}-ref" name="referencia" placeholder="Ex.: portão verde, ao lado da padaria"></div>
        </details>
        <details class="detalhe" data-cidade>
          <summary>${icone('mais')} Não é em Brasília/DF?</summary>
          <div class="linha-campos cidade-uf">
            <div class="campo"><label for="${idp}-cidade">Cidade</label><input id="${idp}-cidade" name="cidade" value="Brasília"></div>
            <div class="campo"><label for="${idp}-uf">UF</label><input id="${idp}-uf" name="uf" value="DF" maxlength="2"></div>
          </div>
        </details>
        <div class="aviso erro" data-erro role="alert" hidden></div>
        <div class="acoes-entrega"><button type="button" class="btn btn-block" data-salvar>Ver taxa e continuar</button></div>
      </div>
      <div class="resumo-entrega" data-resumo role="status" hidden></div>
    </div>
    <div data-bloco-retirada hidden>
      <p class="small muted" style="margin:10px 0 8px">Em qual loja você busca?</p>
      <div class="lojas-retirada" data-lojas-retirada role="radiogroup" aria-label="Loja para retirada"></div>
      <div class="resumo-entrega" data-resumo-retirada role="status" hidden></div>
    </div>
  </div>`;
}

// monta o componente dentro de `raiz` (que já contém entregaHTML()). opts: {tipo, aoSalvar(e), noSheet}
export function montarEntrega(raiz, opts = {}) {
  // "Entrega" já vem aberta (é o canal mais comum): o cliente só toca em "Retirar na loja" se quiser
  const S = { tipo: opts.tipo || cart.entrega()?.tipo || 'entrega', calculando: false, ultimaChave: '' };
  const $ = (sel) => qs(sel, raiz);
  const form = $('[data-form-entrega]');
  const idp = (qs('[name="cep"]', form)?.id || 'ent-cep').replace(/-cep$/, '');
  // não é um <form> (pode estar dentro do #form-checkout): campos acessados por name
  const campo = (k) => qs(`[name="${k}"]`, form);
  form.elements = new Proxy({}, { get: (_, k) => campo(k) });
  const chips = qsa('[data-tipo-entrega] button', raiz);
  const salvo = () => cart.entrega();

  // ---- estado visual ----
  function pintar() {
    const e = salvo();
    chips.forEach((b) => { const on = b.dataset.tipo === S.tipo; b.classList.toggle('ativo', on); b.setAttribute('aria-checked', String(on)); });
    $('[data-bloco-entrega]').hidden = S.tipo !== 'entrega';
    $('[data-bloco-retirada]').hidden = S.tipo !== 'retirada';
    if (S.tipo === 'entrega') pintarEntrega(e);
    if (S.tipo === 'retirada') pintarRetirada(e);
  }
  function pintarEntrega(e) {
    const lembrado = $('[data-endereco-lembrado]'); const resumo = $('[data-resumo]');
    const emUso = e?.tipo === 'entrega' && e.endereco;
    const lemb = !emUso ? enderecoLembrado() : null;
    if (emUso) {
      // já escolhido: resumo com taxa e "trocar" (0 toques)
      form.hidden = true; lembrado.hidden = true; resumo.hidden = false;
      resumo.innerHTML = `<b>${esc(resumoEndereco(e.endereco))}</b> · ${esc(e.endereco.bairro || '')}<br><span class="taxa-linha">Taxa <b>${brl(e.taxa)}</b>${e.a_confirmar ? ' <span class="muted">(a confirmar pela pizzaria)</span>' : e.distancia_km ? ` · ${e.distancia_km} km` : ''}${e.loja_nome ? ` · sai da loja ${esc(e.loja_nome)}` : ''}${CFG ? ` · chega em ${faixaMin(CFG.tempo_entrega_min, CFG.tempo_entrega_max)} depois de confirmar` : ''}</span> <button type="button" class="btn btn-ghost btn-sm" data-trocar-endereco>${icone('lapis')} trocar</button>`;
      qs('[data-trocar-endereco]', resumo).addEventListener('click', () => { abrirForm(e.endereco); });
    } else if (lemb && lemb.rua) {
      // endereço lembrado do último pedido: "Usar este" em 1 toque
      form.hidden = true; resumo.hidden = true; lembrado.hidden = false;
      lembrado.innerHTML = `<div><b>${esc(resumoEndereco(lemb))}</b><small>${esc(lemb.bairro || '')}${lemb.taxa != null ? ` · taxa ${brl(lemb.taxa)}` : ''}${lemb.loja_nome ? ` · sai da loja ${esc(lemb.loja_nome)}` : ''}</small></div><div class="acoes"><button type="button" class="btn btn-sm" data-usar-endereco>Usar este</button><button type="button" class="btn btn-sm btn-ghost" data-outro-endereco>Outro endereço</button></div>`;
      qs('[data-usar-endereco]', lembrado).addEventListener('click', () => usarLembrado(lemb));
      qs('[data-outro-endereco]', lembrado).addEventListener('click', () => abrirForm(null));
    } else abrirForm(null);
  }
  function abrirForm(end) {
    form.hidden = false; $('[data-endereco-lembrado]').hidden = true; $('[data-resumo]').hidden = true;
    $('[data-erro]').hidden = true; qsa('[data-erro-campo]', form).forEach((x) => (x.hidden = true));
    const base = end || enderecoLembrado() || {};
    for (const k of ['cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'referencia']) if (form.elements[k]) form.elements[k].value = base[k] ?? (k === 'cidade' ? 'Brasília' : k === 'uf' ? 'DF' : '');
    if (base.referencia) $('[data-ref]').open = true;
    if (base.cidade && base.cidade !== 'Brasília') $('[data-cidade]').open = true;
    S.ultimaChave = end ? chaveForm() : '';
    if (!opts.noFoco) setTimeout(() => { try { form.elements.rua.focus({ preventScroll: true }); } catch {} }, 30);
  }
  async function usarLembrado(lemb) {
    const c = await config();
    cart.salvarEntrega({ tipo: 'entrega', endereco: lemb, taxa: Number(lemb.taxa || 0), a_confirmar: !!lemb.a_confirmar, distancia_km: lemb.distancia_km, loja: lemb.loja, loja_nome: lemb.loja_nome });
    pintar(); opts.aoSalvar?.(cart.entrega());
    // recalcula a taxa em segundo plano (pode ter mudado desde o último pedido)
    if (lemb.lat && lemb.lng) {
      try {
        const calc = await calcularEntrega(lemb.lat, lemb.lng);
        if (calc?.ok) { cart.salvarEntrega({ ...cart.entrega(), taxa: Number(calc.taxa), distancia_km: calc.distancia_km, loja: calc.loja?.slug, loja_nome: calc.loja?.nome }); pintar(); }
      } catch {}
    }
    void c;
  }
  function pintarRetirada(e) {
    const lista = $('[data-lojas-retirada]'); const resumo = $('[data-resumo-retirada]');
    config().then((c) => {
      const lojas = (c.lojas || []).filter((l) => l.aceita_retirada);
      const atual = e?.tipo === 'retirada' ? lojaPorSlug({ lojas }, e.loja) : lojaSugerida(c, e);
      const perto = !!(e?.endereco?.lat || enderecoLembrado()?.lat);
      lista.innerHTML = lojas.map((l) => `<button type="button" role="radio" aria-checked="${l.slug === atual?.slug}" class="opcao ${l.slug === atual?.slug ? 'ativo' : ''}" data-loja="${esc(l.slug)}"><b>${icone('loja')} ${esc(l.nome)}</b><small>${esc(enderecoLoja(l))}${l.slug === atual?.slug && perto ? ' · a mais perto de você' : l.principal && l.slug === atual?.slug ? ' · loja principal' : ''}</small></button>`).join('');
      qsa('[data-loja]', lista).forEach((b) => b.addEventListener('click', () => escolherLoja(lojaPorSlug({ lojas }, b.dataset.loja))));
      resumo.hidden = false;
      resumo.innerHTML = `Fica pronta em <b>${faixaMin(c.tempo_retirada_min, c.tempo_retirada_max)}</b> · sem taxa<br><span class="muted">${esc(resumoHorario(c.horario))}</span>`;
    });
  }
  function escolherLoja(l) {
    if (!l) return;
    cart.salvarEntrega({ tipo: 'retirada', taxa: 0, loja: l.slug, loja_nome: l.nome });
    qsa('[data-loja]', raiz).forEach((b) => { const on = b.dataset.loja === l.slug; b.classList.toggle('ativo', on); b.setAttribute('aria-checked', String(on)); });
    track('endereco_ok', { tipo: 'retirada', loja: l.slug });
    opts.aoSalvar?.(cart.entrega());
  }

  // ---- chips ----
  chips.forEach((b) => b.addEventListener('click', async () => {
    S.tipo = b.dataset.tipo;
    if (S.tipo === 'retirada') {
      // 1 toque: a loja sugerida já fica escolhida (dá para trocar na lista)
      const c = await config(); const l = lojaSugerida(c, salvo());
      if (l && salvo()?.tipo !== 'retirada') cart.salvarEntrega({ tipo: 'retirada', taxa: 0, loja: l.slug, loja_nome: l.nome });
      pintar(); if (l) { track('endereco_ok', { tipo: 'retirada', loja: l.slug, sugerida: true }); opts.aoSalvar?.(cart.entrega()); }
      return;
    }
    // entrega: se o que está salvo é retirada, volta para o endereço lembrado (ou o formulário)
    if (salvo()?.tipo === 'retirada') cart.limparEntrega();
    pintar();
  }));

  // ---- formulário ----
  const cep = form.elements.cep;
  cep.addEventListener('input', async () => {
    cep.value = mascaraCep(cep.value);
    if (cep.value.length === 9) {
      const d = await buscarCep(cep.value);
      if (d) { if (d.rua) form.elements.rua.value = d.rua; if (d.bairro) form.elements.bairro.value = d.bairro; if (d.cidade) form.elements.cidade.value = d.cidade; if (d.uf) form.elements.uf.value = d.uf; form.elements.numero.focus(); }
    }
  });
  const chaveForm = () => ['rua', 'numero', 'bairro', 'cidade', 'uf', 'cep'].map((k) => form.elements[k].value.trim()).join('|');
  function validar(mostrar = true) {
    const end = Object.fromEntries(['cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'referencia'].map((k) => [k, form.elements[k].value.trim()]));
    let ok = true;
    for (const k of ['rua', 'numero', 'bairro']) {
      const falta = !end[k]; const el = qs(`[data-erro-campo="${k}"]`, form);
      if (el && mostrar) {
        el.hidden = !falta; if (!el.id) el.id = `${idp}-erro-${k}`;
        const inp = form.elements[k]; if (falta) { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', el.id); } else { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); }
      }
      if (falta) ok = false;
    }
    if (!end.cidade) { end.cidade = 'Brasília'; }
    return ok ? end : null;
  }
  async function calcular(end, foco = true) {
    if (S.calculando) return; S.calculando = true;
    const erro = $('[data-erro]'); const btn = $('[data-salvar]');
    erro.hidden = true; btn.disabled = true; btn.textContent = 'Calculando a taxa…';
    try {
      const geo = await geocodificar(end);
      let calc;
      if (geo) { end.lat = geo.lat; end.lng = geo.lng; end.aprox = !!geo.aprox; calc = await calcularEntrega(geo.lat, geo.lng); if (geo.aprox) calc.a_confirmar = true; }
      else { calc = await calcularEntrega(null, null); }
      if (!calc.ok && calc.motivo === 'sem_loja') { erro.textContent = 'Hoje nenhuma loja está entregando. Dá para retirar na loja ou falar com a gente no WhatsApp.'; erro.hidden = false; return; }
      if (!calc.ok) {
        const c = await config(); const l = lojaSugerida(c, null);
        erro.innerHTML = `Esse endereço fica a <b>${calc.distancia_km} km</b> da loja mais perto, entregamos até ${calc.raio_km} km. Dá para <b>retirar na loja${l ? ' ' + esc(l.nome) : ''}</b> ou combinar pelo WhatsApp.`;
        erro.hidden = false; return;
      }
      end.distancia_km = calc.distancia_km;
      const e = { tipo: 'entrega', endereco: end, taxa: Number(calc.taxa), a_confirmar: !!calc.a_confirmar, distancia_km: calc.distancia_km, loja: calc.loja?.slug, loja_nome: calc.loja?.nome };
      cart.salvarEntrega(e);
      gravarLS(LS.enderecoLembrado, { ...end, taxa: e.taxa, a_confirmar: e.a_confirmar, distancia_km: e.distancia_km, loja: e.loja, loja_nome: e.loja_nome });
      S.ultimaChave = chaveForm();
      track('endereco_ok', { tipo: 'entrega', taxa: e.taxa, km: e.distancia_km });
      pintar();
      opts.aoSalvar?.(e);
    } catch (err) {
      erro.textContent = 'Não conseguimos calcular a taxa agora. Tente de novo em instantes, o pedido continua salvo.'; erro.hidden = false;
    } finally { S.calculando = false; btn.disabled = false; btn.textContent = 'Ver taxa e continuar'; if (!erro.hidden && foco) erro.scrollIntoView({ block: 'nearest' }); }
  }
  const enviar = () => { const end = validar(true); if (!end) { qs('[aria-invalid="true"]', form)?.focus(); return; } calcular(end); };
  ['rua', 'numero', 'bairro'].forEach((k) => form.elements[k].addEventListener('input', () => { if (form.elements[k].value.trim()) { form.elements[k].removeAttribute('aria-invalid'); const el = qs(`[data-erro-campo="${k}"]`, form); if (el) el.hidden = true; } }));
  $('[data-salvar]').addEventListener('click', enviar);
  form.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') { ev.preventDefault(); enviar(); } });
  // taxa calculada sozinha quando rua, número e bairro estão preenchidos (sem toque extra)
  const auto = debounce(() => { if (form.hidden) return; const end = validar(false); if (!end) return; const k = chaveForm(); if (k === S.ultimaChave) return; S.ultimaChave = k; calcular(end, false); }, 700);
  ['rua', 'numero', 'bairro'].forEach((k) => { form.elements[k].addEventListener('input', auto); form.elements[k].addEventListener('change', auto); });

  config().then((c) => {
    $('[data-sub-entrega]').textContent = `chega em ${faixaMin(c.tempo_entrega_min, c.tempo_entrega_max)}${c.raio_entrega_km ? ` · até ${Number(c.raio_entrega_km)} km das lojas` : ''}`;
    $('[data-sub-retirada]').textContent = `pronta em ${faixaMin(c.tempo_retirada_min, c.tempo_retirada_max)} · sem taxa`;
    chips[0].disabled = c.aceita_entrega === false; chips[1].disabled = c.aceita_retirada === false;
    if (c.aceita_entrega === false && S.tipo === 'entrega' && !cart.entrega()) S.tipo = 'retirada';
    pintar();
  }).catch(pintar);
  pintar();
  return { pintar, setTipo(t) { S.tipo = t; pintar(); } };
}

// ---- sheet (host do componente): pill do subheader, "trocar", páginas fora do fechamento ----
function modalEntregaHTML() {
  return sheetHTML('modal-entrega', {
    titulo: 'Como você recebe?',
    corpo: entregaHTML('sh'),
    rodape: `<a class="link-secundario" href="cardapio.html" data-fechar data-ver-cardapio>Ver o cardápio primeiro</a>`,
  });
}
let compSheet = null;
export function abrirModalEntrega(tipo) {
  const m = qs('#modal-entrega'); if (!m) return;
  if (!compSheet) compSheet = montarEntrega(qs('[data-entrega]', m), { noFoco: true, aoSalvar: () => { toast(cart.entrega()?.tipo === 'retirada' ? `Retirada na loja ${cart.entrega().loja_nome}` : 'Endereço salvo'); fecharModal('modal-entrega'); } });
  compSheet.setTipo(tipo || cart.entrega()?.tipo || 'entrega');
  const ver = qs('[data-ver-cardapio]', m); if (ver) ver.hidden = PAGINA === 'cardapio' || PAGINA === 'checkout';
  abrirModal('modal-entrega');
}
function ligarSheets() {
  const m = qs('#modal-entrega'); if (!m || m._ligado) return; m._ligado = true;
  habilitarArraste(m);
}
document.addEventListener('DOMContentLoaded', ligarSheets);
setTimeout(ligarSheets, 0);

// garante que há entrega escolhida antes de seguir; retorna true se ok
export function exigirEntrega() {
  if (cart.entrega()) return true;
  abrirModalEntrega();
  return false;
}

// ------------------------------------------------------------------
// "Completa com": 3 sugestões (bebida mais pedida, doce, molho) com "+" de 1 toque. Sem sheet.
// ------------------------------------------------------------------
export async function sugestoesCompleta(itens) {
  const d = await carregarCardapio();
  const na = new Set(itens.map((i) => i.slug).filter(Boolean));
  const temDoce = itens.some((i) => i.tipo === 'pizza' && (i.sabores || []).some((s) => d.saboresPorSlug[s]?.tipo === 'doce')) || itens.some((i) => d.produtosPorSlug[i.slug]?.categoria === 'sobremesas');
  const disp = (p) => p.disponivel && !na.has(p.slug) && !(Array.isArray(p.passos) && p.passos.length);
  const bebida = d.produtos.filter((p) => p.categoria === 'bebidas' && disp(p)).sort((a, b) => (b.tags?.includes('mais-pedida') ? 1 : 0) - (a.tags?.includes('mais-pedida') ? 1 : 0) || a.ordem - b.ordem)[0];
  const doce = temDoce ? null : d.produtos.filter((p) => p.categoria === 'sobremesas' && disp(p)).sort((a, b) => (b.tags?.includes('mais-pedida') ? 1 : 0) - (a.tags?.includes('mais-pedida') ? 1 : 0) || a.ordem - b.ordem)[0];
  const molho = d.produtos.filter((p) => p.categoria === 'molhos' && disp(p)).sort((a, b) => (b.tags?.includes('mais-pedida') ? 1 : 0) - (a.tags?.includes('mais-pedida') ? 1 : 0) || a.ordem - b.ordem)[0];
  return [bebida, doce, molho].filter(Boolean).slice(0, 3);
}

export function tagHTML(t) {
  const nomes = { 'mais-pedida': 'Mais pedida', novidade: 'Novidade', vegetariana: 'Vegetariana', vegana: 'Vegana', esgotado: 'Esgotado' };
  return `<span class="tag ${esc(t)}">${nomes[t] || esc(t)}</span>`;
}

// skeleton com a forma dos cards (usado enquanto o cardápio carrega)
// pizza = true: geometria do card de sabor (chips de tamanho embaixo), para o conteúdo real não empurrar a página
export function skeletonCards(n = 6, pizza = false) {
  const chips = pizza ? '<div class="c"><span class="skeleton"></span><span class="skeleton"></span></div>' : '';
  return Array.from({ length: n }, () => `<div class="skeleton-card${pizza ? ' skeleton-card--pizza' : ''}" aria-hidden="true"><div class="l"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span>${pizza ? '' : '<span class="skeleton"></span>'}</div><div class="f skeleton"></div>${chips}</div>`).join('');
}
