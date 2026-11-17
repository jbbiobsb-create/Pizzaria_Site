/* Kome no Japão: guarda o jogo no celular pra abrir sem internet. Mude VERSAO a cada atualização. */
const VERSAO = 'kome-2.32';
const ARQUIVOS = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "engine/pixxel.css", "game/game.css", "engine/audio.js", "engine/core.js", "engine/assets.js", "engine/fx.js", "engine/nature.js", "engine/pix.js", "engine/rig.js", "engine/shiba.js", "engine/terrain.js", "engine/ui.js", "game/bagger.js", "game/colheitadeira.js", "game/data.js", "game/game-ui.js", "game/game-world.js", "game/patio-arte.js", "game/eventos-arte.js", "game/game.js", "game/home.js", "game/infinite.js", "game/goals.js", "game/islands.js", "game/industry.js", "game/belts.js", "game/content.js", "game/cutscenes.js", "game/dev.js", "game/machines-mid.js", "game/machines-mine.js", "game/tools-hand.js", "engine/sim.js", "engine/board.js", "game/items.js", "game/topo.js", "game/fabrica-arte.js", "game/fabrica.js", "game/tbm.js", "game/trembala.js", "game/foguete.js", "game/fuji.js", "game/portal.js", "game/tatuzao.js", "game/oficina-arte.js", "game/oficina.js", "game/komeoh.js", "game/scenery.js", "game/islands-ui.js", "game/cookie-arte.js", "game/cookie-ui.js"];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(e.request, cp)).catch(() => {}); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
