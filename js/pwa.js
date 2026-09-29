// PWA: registro do service worker, aviso de nova versão, banner "Instalar app" (Android / iOS)
// e assinatura de push para avisos de status do pedido. Importado por js/ui.js (montarLayout).
import { LS, VAPID_PUBLIC_KEY } from './config.js';
import { qs, esc, toast, lerLS, gravarLS } from './util.js';
import { icone } from './icons.js';
import { assinarPush } from './api.js';

const DIAS_DISPENSA = 14;
const FINALIZADOS = ['entregue', 'cancelado'];

// ------------------------------------------------------------------ detecção
export const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export function instalado() {
  return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
}
const emAdmin = () => /^\/admin(\/|$)/.test(location.pathname);

// ------------------------------------------------------------------ início (chamado por montarLayout)
let iniciado = false;
export function iniciarPWA() {
  if (iniciado) return; iniciado = true;
  registrarSW();
  contarVisita();
  if (instalado()) document.documentElement.classList.add('standalone');
  window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); promptInstalacao = ev; mostrarBannerSePuder(); });
  window.addEventListener('appinstalled', () => { promptInstalacao = null; esconderBanner(); toast("App instalado! Procure o ícone da Sesconetto's na tela de início."); });
  if (isIOS && !instalado()) setTimeout(mostrarBannerSePuder, 1500);
  window.addEventListener('ses:pedido', (ev) => montarBotaoPush(ev.detail));
}

function contarVisita() {
  try {
    if (sessionStorage.getItem('ses_visita_contada')) return;
    sessionStorage.setItem('ses_visita_contada', '1');
    gravarLS(LS.visitas, (Number(lerLS(LS.visitas, 0)) || 0) + 1);
  } catch {}
}

// ------------------------------------------------------------------ service worker + atualização
let registro = null; let pediuAtualizar = false;
function registrarSW() {
  if (!('serviceWorker' in navigator) || emAdmin()) return;
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
    registro = reg;
    // já havia um SW novo esperando (a página foi aberta depois da instalação silenciosa)
    if (reg.waiting && navigator.serviceWorker.controller) avisarNovaVersao(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing; if (!novo) return;
      novo.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller) avisarNovaVersao(novo);
      });
    });
    // confere se há versão nova ao voltar para a aba (útil em app instalado, que fica dias aberto)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch((e) => console.warn('SW não registrado:', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pediuAtualizar) { pediuAtualizar = false; location.reload(); }
  });
  navigator.serviceWorker.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (d.tipo === 'PUSH_RENOVAR' && d.subscription) renovarAssinaturas(d.subscription);
  });
}

// toast fixo com botão "Atualizar" (não recarrega sozinho: pode haver um checkout em andamento)
function avisarNovaVersao(sw) {
  if (qs('#toast-atualizar')) return;
  const el = document.createElement('div');
  el.id = 'toast-atualizar'; el.className = 'toast toast-acao show'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>Nova versão disponível</span><button type="button" class="btn btn-sm btn-light" data-atualizar>Atualizar</button><button type="button" class="fechar" aria-label="Depois">${icone('x')}</button>`;
  document.body.appendChild(el);
  qs('[data-atualizar]', el).addEventListener('click', () => {
    pediuAtualizar = true; el.remove();
    sw.postMessage('SKIP_WAITING');
    // se por algum motivo o controllerchange não vier, recarrega mesmo assim
    setTimeout(() => { if (pediuAtualizar) location.reload(); }, 4000);
  });
  qs('.fechar', el).addEventListener('click', () => el.remove());
}

// ------------------------------------------------------------------ banner de instalação
let promptInstalacao = null;
function podeMostrarBanner() {
  if (instalado() || emAdmin()) return false;
  if (!promptInstalacao && !isIOS) return false;            // desktop/Firefox sem prompt: nada a oferecer
  const disp = Number(lerLS(LS.instalarDispensado, 0)) || 0;
  if (disp && Date.now() - disp < DIAS_DISPENSA * 86400000) return false;
  const visitas = Number(lerLS(LS.visitas, 0)) || 0;
  return visitas >= 2 || !!lerLS(LS.ultimoPedido);           // 2ª visita ou já fez um pedido
}
function mostrarBannerSePuder() { if (podeMostrarBanner()) mostrarBanner(); }

function mostrarBanner() {
  if (qs('[data-banner-instalar]')) return;
  const html = `
  <div class="banner-instalar" data-banner-instalar role="region" aria-label="Instalar o app">
    <img src="/img/icons/icon-192.png" alt="" width="48" height="48">
    <div class="txt"><b>Instale o app</b><small>${isIOS ? 'Acompanhe o pedido e receba avisos.' : 'Abre na hora e avisa quando o pedido sair.'}</small></div>
    <button type="button" class="btn btn-sm" data-instalar>${isIOS ? 'Como instalar' : 'Instalar'}</button>
    <button type="button" class="fechar" data-dispensar aria-label="Agora não">${icone('x')}</button>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const el = qs('[data-banner-instalar]');
  requestAnimationFrame(() => el.classList.add('show'));
  qs('[data-dispensar]', el).addEventListener('click', () => { gravarLS(LS.instalarDispensado, Date.now()); esconderBanner(); });
  qs('[data-instalar]', el).addEventListener('click', instalar);
}
function esconderBanner() {
  const el = qs('[data-banner-instalar]'); if (!el) return;
  el.classList.remove('show'); setTimeout(() => el.remove(), 250);
}

// Android/Chrome: dispara o prompt nativo. iOS: mostra o passo a passo (não existe prompt).
export async function instalar() {
  if (promptInstalacao) {
    const p = promptInstalacao; promptInstalacao = null;
    try {
      p.prompt();
      const { outcome } = await p.userChoice;           // 'accepted' | 'dismissed'
      if (outcome !== 'accepted') gravarLS(LS.instalarDispensado, Date.now());
    } catch { toast('Não deu para abrir a instalação agora.', 'erro'); }
    esconderBanner();                                    // aceitou: appinstalled confirma; recusou: some por 14 dias
    return;
  }
  if (isIOS) { abrirSheetIOS(); return; }
  toast('Use o menu do navegador e escolha "Instalar app" ou "Adicionar à tela de início".', 'ok', 5000);
}

function abrirSheetIOS(motivo = '') {
  let m = qs('#modal-instalar-ios');
  if (!m) {
    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-bg" id="modal-instalar-ios" role="dialog" aria-modal="true" aria-labelledby="modal-instalar-ios-titulo">
      <div class="modal sheet">
        <div class="modal-cabeca">
          <div class="alca" aria-hidden="true"></div>
          <button type="button" class="fechar" data-fechar aria-label="Fechar">${icone('x')}</button>
          <h2 id="modal-instalar-ios-titulo">Adicionar à Tela de Início</h2>
          <p class="muted small" data-motivo-ios></p>
        </div>
        <div class="modal-corpo">
          <ol class="passos-ios">
            <li><span class="n">1</span><div>Toque em <b>Compartilhar</b> <span class="ios-ic">${icone('compartilhar')}</span> na barra do Safari</div></li>
            <li><span class="n">2</span><div>Role e toque em <b>Adicionar à Tela de Início</b> <span class="ios-ic">${icone('mais')}</span></div></li>
            <li><span class="n">3</span><div>Confirme em <b>Adicionar</b>. O ícone da Sesconetto's aparece na sua tela.</div></li>
          </ol>
          <p class="small muted">Depois de instalado, o app abre sem a barra do navegador e pode avisar quando o pedido sair para entrega.</p>
        </div>
        <div class="modal-rodape"><div class="acoes"><button type="button" class="btn btn-lg" data-fechar>Entendi</button></div></div>
      </div>
    </div>`);
    m = qs('#modal-instalar-ios');
  }
  qs('[data-motivo-ios]', m).textContent = motivo || 'No iPhone a instalação é feita pelo Safari, em três toques:';
  m.classList.add('aberto');
  document.body.style.overflow = 'hidden'; document.body.classList.add('modal-aberto');
  const h = qs('h2', m); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
}

// ------------------------------------------------------------------ push
export function podePush() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
  if (isIOS && !instalado()) return true;                    // dá para oferecer: mostra a dica de instalar
  return 'PushManager' in window;
}
export function pushAtivo(pedidoId) { return (lerLS(LS.pushPedidos, []) || []).includes(pedidoId); }
function lembrarPush(pedidoId) {
  const lista = (lerLS(LS.pushPedidos, []) || []).filter((x) => x !== pedidoId);
  gravarLS(LS.pushPedidos, [...lista, pedidoId].slice(-10));
}

function b64UrlParaUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s); return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Chamar dentro de um gesto do usuário (clique). Retorna: 'ok' | 'ios-instalar' | 'sem-suporte' | 'denied' | 'default'
export async function assinarPushDoPedido(pedidoId) {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return 'sem-suporte';
  if (isIOS && !instalado()) { abrirSheetIOS('Para receber avisos do pedido, primeiro instale o app na tela de início:'); return 'ios-instalar'; }
  if (!('PushManager' in window)) return 'sem-suporte';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm;
  const reg = await navigator.serviceWorker.ready;
  const chave = b64UrlParaUint8(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !mesmaChave(sub, chave)) { try { await sub.unsubscribe(); } catch {} sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
  await assinarPush(pedidoId, sub.toJSON());
  lembrarPush(pedidoId);
  return 'ok';
}
function mesmaChave(sub, chave) {
  const atual = sub.options && sub.options.applicationServerKey;
  if (!atual) return true;
  const a = new Uint8Array(atual); if (a.length !== chave.length) return false;
  return a.every((b, i) => b === chave[i]);
}
// endpoint trocou (pushsubscriptionchange): reenvia para os pedidos ainda lembrados
async function renovarAssinaturas(subscription) {
  for (const id of lerLS(LS.pushPedidos, []) || []) { try { await assinarPush(id, subscription); } catch {} }
}

// ------------------------------------------------------------------ botão na página do pedido
// Container em pedido.js: <div data-push data-pedido-id data-pedido-status data-tipo-entrega>
export function montarBotaoPush(pedido) {
  const box = qs('[data-push]'); if (!box) return;
  const id = box.dataset.pedidoId || (pedido && pedido.id);
  const status = box.dataset.pedidoStatus || (pedido && pedido.status);
  const retirada = (box.dataset.tipoEntrega || (pedido && pedido.tipo_entrega)) === 'retirada';
  box.innerHTML = '';
  if (!id || FINALIZADOS.includes(status) || !podePush()) return;
  const rotulo = retirada ? 'Avisar quando estiver pronto' : 'Avisar quando sair para entrega';
  const pintar = (estado, msg = '') => {
    if (estado === 'ativo') box.innerHTML = `<div class="push-box ativo">${icone('check-circulo')}<span><b>Avisos ligados</b><small>Você recebe uma notificação a cada etapa do pedido.</small></span></div>`;
    else if (estado === 'negado') box.innerHTML = `<div class="push-box negado">${icone('sino-off')}<span><b>Avisos bloqueados no navegador</b><small>Para receber, libere as notificações deste site nas configurações.</small></span></div>`;
    else box.innerHTML = `<button type="button" class="btn btn-outline btn-push" data-ativar-push>${icone('sino')} ${esc(rotulo)}</button>${msg ? `<p class="small muted center" style="margin-top:6px">${esc(msg)}</p>` : ''}`;
  };
  if (pushAtivo(id)) { pintar('ativo'); return; }
  if (Notification.permission === 'denied') { pintar('negado'); return; }
  pintar('botao');
  qs('[data-ativar-push]', box).addEventListener('click', async (ev) => {
    const b = ev.currentTarget; b.disabled = true;
    try {
      const r = await assinarPushDoPedido(id);
      if (r === 'ok') { pintar('ativo'); toast(retirada ? 'Vamos avisar quando estiver pronto!' : 'Vamos avisar quando sair para entrega!'); }
      else if (r === 'denied') pintar('negado');
      else if (r === 'sem-suporte') { pintar('botao', 'Este navegador não recebe notificações.'); qs('[data-ativar-push]', box).disabled = true; }
      else if (r === 'ios-instalar') { b.disabled = false; }
      else { b.disabled = false; toast('Sem permissão para avisar. Tente de novo quando quiser.', 'erro'); }
    } catch (e) {
      console.warn('push:', e);
      b.disabled = false;
      toast('Não conseguimos ligar os avisos agora. Você pode acompanhar por aqui.', 'erro', 4000);
    }
  });
}
