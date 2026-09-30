/* Service worker da Sesconetto's Pizzeria (site estático, sem build).
 *
 * Mude VERSAO a cada publicação: o navegador vê o arquivo diferente, instala o novo SW em
 * segundo plano e a página mostra o toast "Nova versão disponível — Atualizar" (js/pwa.js).
 * Nada de skipWaiting automático: a troca acontece quando o cliente toca em "Atualizar".
 *
 * Estratégias:
 *  - Navegação (HTML), CSS, JS e manifest: network-first, cache como reserva; sem rede → /offline.
 *  - Imagens e fontes locais: stale-while-revalidate.
 *  - esm.sh (supabase-js): stale-while-revalidate em cache próprio (URLs versionadas,
 *    mas a versão maior "@2" pode avançar; SWR mantém o offline funcionando e atualiza em segundo plano).
 *  - Supabase, ViaCEP, Nominatim, Google Maps e /admin: NUNCA passam pelo cache (o SW nem intercepta).
 */
const VERSAO = '2026-09-30-1';
const CACHE_APP = 'app-' + VERSAO;
const CACHE_MIDIA = 'midia-v1';   // imagens e fontes (sobrevive à troca de versão)
const CACHE_CDN = 'cdn-v1';       // esm.sh (supabase-js)

// Páginas pelo caminho limpo (Vercel cleanUrls); localmente o arquivo .html é tentado como reserva.
const PAGINAS = ['/', '/cardapio', '/produto', '/carrinho', '/checkout', '/pedido', '/conta', '/offline'];
const ARQUIVOS = [
  '/css/style.css', '/manifest.webmanifest',
  '/js/pre.js', '/js/config.js', '/js/util.js', '/js/icons.js', '/js/supabase.js', '/js/api.js', '/js/cart.js', '/js/cards.js', '/js/repetir.js', '/js/ui.js', '/js/pwa.js',
  '/js/pages/home.js', '/js/pages/cardapio.js', '/js/pages/produto.js', '/js/pages/carrinho.js', '/js/pages/checkout.js', '/js/pages/pedido.js', '/js/pages/conta.js', '/js/pages/offline.js',
];
const MIDIA_INICIAL = ['/fonts/instrument-sans-var.woff2', '/fonts/young-serif.woff2', '/img/logo.jpg', '/img/icons/icon-192.png', '/img/icons/icon-512.png', '/img/icons/badge-96.png', '/img/icons/apple-touch-icon.png', '/img/icons/favicon-32.png'];

// Hosts/caminhos que o SW deixa passar direto (dados, geolocalização, mapa, painel da equipe)
const NAO_INTERCEPTAR = [/supabase\.(co|in)/, /viacep\.com\.br/, /nominatim\.openstreetmap\.org/, /maps\.google/, /google\.com\/maps/, /^\/admin(\/|$)/];
const CDN = [/^https:\/\/esm\.sh\//];

// ------------------------------------------------------------------ utilidades
// Chave de cache de uma página: sem ".html", sem query/hash ("/index" e "/index.html" viram "/")
function chavePagina(url) {
  let p = url.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}
// Resposta sem a marca "redirected" (uma navegação não pode receber resposta redirecionada do cache)
async function limpar(res) {
  if (!res.redirected) return res;
  const corpo = await res.blob();
  return new Response(corpo, { status: res.status, statusText: res.statusText, headers: res.headers });
}
async function guardarPagina(cache, chave, res) {
  if (res && res.ok) await cache.put(chave, await limpar(res.clone()));
}
// Busca uma página pelo caminho limpo; sem servidor com cleanUrls (teste local) cai no ".html"
async function buscarPagina(chave) {
  const candidatos = chave === '/' ? ['/', '/index.html'] : [chave, chave + '.html'];
  let ultimo = null;
  for (const c of candidatos) {
    try {
      const r = await fetch(new Request(c, { cache: 'no-cache', redirect: 'follow' }));
      if (r.ok) return r;
      ultimo = r;
    } catch (e) { ultimo = null; }
  }
  return ultimo;
}

// ------------------------------------------------------------------ ciclo de vida
self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const app = await caches.open(CACHE_APP);
    await Promise.all(PAGINAS.map(async (p) => { try { await guardarPagina(app, p, await buscarPagina(p)); } catch {} }));
    await Promise.all(ARQUIVOS.map(async (a) => {
      try { const r = await fetch(new Request(a, { cache: 'no-cache' })); if (r.ok) await app.put(a, r); } catch {}
    }));
    const midia = await caches.open(CACHE_MIDIA);
    await Promise.all(MIDIA_INICIAL.map(async (m) => { try { const r = await fetch(m); if (r.ok) await midia.put(m, r); } catch {} }));
    // sem skipWaiting aqui: a página avisa o cliente e ele decide (mensagem SKIP_WAITING)
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter((k) => k.startsWith('app-') && k !== CACHE_APP).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.disable(); } catch {} }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (ev) => {
  const d = ev.data;
  const tipo = typeof d === 'string' ? d : d && d.tipo;
  if (tipo === 'SKIP_WAITING') self.skipWaiting();
  else if (tipo === 'VERSAO') ev.source && ev.source.postMessage({ tipo: 'VERSAO', versao: VERSAO });
});

// ------------------------------------------------------------------ fetch
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mesmaOrigem = url.origin === self.location.origin;
  const alvo = mesmaOrigem ? url.pathname : url.href;
  if (NAO_INTERCEPTAR.some((r) => r.test(alvo))) return;               // dados/painel: direto na rede

  if (!mesmaOrigem) {
    if (CDN.some((r) => r.test(url.href))) ev.respondWith(staleWhileRevalidate(req, CACHE_CDN));
    return;                                                             // outros domínios: não intercepta
  }
  if (req.mode === 'navigate') { ev.respondWith(paginaNetworkFirst(req)); return; }
  if (/\.(css|m?js|webmanifest|json)$/.test(url.pathname)) { ev.respondWith(arquivoNetworkFirst(req)); return; }
  if (/\.(png|jpe?g|webp|gif|svg|ico|avif|woff2?|ttf)$/.test(url.pathname)) { ev.respondWith(staleWhileRevalidate(req, CACHE_MIDIA)); }
});

async function paginaNetworkFirst(req) {
  const cache = await caches.open(CACHE_APP);
  const chave = chavePagina(new URL(req.url));
  try {
    const res = await fetch(req);
    if (res.ok) guardarPagina(cache, chave, res.clone()).catch(() => {});
    return res;
  } catch {
    const hit = await cache.match(chave);
    if (hit) return hit;
    return (await cache.match('/offline')) || new Response('<h1>Sem internet</h1>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function arquivoNetworkFirst(req) {
  const cache = await caches.open(CACHE_APP);
  try {
    const res = await fetch(new Request(req, { cache: 'no-cache' }));
    if (res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(req, nome) {
  const cache = await caches.open(nome);
  const hit = await cache.match(req);
  const rede = fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => hit);
  return hit || rede;
}

// ------------------------------------------------------------------ Web Push
self.addEventListener('push', (ev) => {
  let d = {};
  try { d = ev.data ? ev.data.json() : {}; } catch { d = { body: ev.data ? ev.data.text() : '' }; }
  if (!d || typeof d !== 'object') d = {};
  const url = (d.data && d.data.url) || d.url || '/pedido';
  const tag = d.tag || (d.pedido ? 'pedido-' + d.pedido : 'pedido-' + (url.match(/id=([\w-]+)/) || [])[1] || 'sesconettos');
  const opcoes = {
    body: d.body || 'Seu pedido tem novidade. Toque para acompanhar.',
    icon: d.icon || '/img/icons/icon-192.png',
    badge: d.badge || '/img/icons/badge-96.png',
    tag, renotify: true, lang: 'pt-BR', vibrate: [80, 40, 80],
    data: { url },
  };
  ev.waitUntil(self.registration.showNotification(d.title || "Sesconetto's Pizzeria", opcoes));
});

self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  // só abre URLs do próprio site (um payload malicioso não leva o cliente para outro domínio)
  let url = new URL((ev.notification.data && ev.notification.data.url) || '/pedido', self.location.origin);
  if (url.origin !== self.location.origin) url = new URL('/pedido', self.location.origin);
  url = url.href;
  ev.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mesma = janelas.find((w) => w.url.split('#')[0] === url) || janelas.find((w) => w.url.includes('/pedido')) || janelas[0];
    if (mesma) {
      try { await mesma.focus(); } catch {}
      if (mesma.url.split('#')[0] !== url && 'navigate' in mesma) { try { await mesma.navigate(url); } catch {} }
      return;
    }
    await self.clients.openWindow(url);
  })());
});

// O navegador trocou o endpoint: reassina e pede às páginas abertas que reenviem ao servidor
self.addEventListener('pushsubscriptionchange', (ev) => {
  ev.waitUntil((async () => {
    try {
      const opts = (ev.oldSubscription && ev.oldSubscription.options) || (ev.newSubscription && ev.newSubscription.options);
      const nova = ev.newSubscription || (opts ? await self.registration.pushManager.subscribe(opts) : null);
      if (!nova) return;
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      janelas.forEach((w) => w.postMessage({ tipo: 'PUSH_RENOVAR', subscription: nova.toJSON(), endpointAntigo: ev.oldSubscription && ev.oldSubscription.endpoint }));
    } catch {}
  })());
});
