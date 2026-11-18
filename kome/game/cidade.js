/* Kome no Japão — cidade.js  (camada 4 · spec docs/design/cidade.md, APROVADA · portado do protótipo demos/cidade-proto.js)
   A CIDADE: a comida da fábrica vira vizinhos felizes. Tela própria (canvas 960×540 por cima do jogo, igual à Fábrica).
   - Despensa: a fábrica manda D.CITY.share dos onigiris/mochis que vende pra cá (fabrica.js sell() → G.City.take). Despensa cheia
     = a doca vende normal: nada se perde. Abre quando a fábrica vende o 1º mochi.
   - Pedidos (3 vagas, sem prazo) → Entregar → kei-truck do Kome → ¥ (ORDER_PAY × valor do produto na doca) + corações.
   - Amizade sobe → escolha 1 de 2 prédios pra um terreno → obra → prédio na rua (lojas compram o que sobra; afeto +♥; Sentô
     acelera pedidos; casa/templo trazem morador). Cada nível = +1 grão no Arroz do Coração (patio.js heart: +1% renda).
   - Festival da estação: os corações enchem; VOCÊ começa quando quiser (noite, lanternas, bon-odori); depois a estação vira.
   - Permanente: mora em S.stats.city (fica entre viagens). Roda por G.Sim (tela aberta ou fechada); offline: obras terminam e
     lojas vendem o que sobra. FAST/longo: nada espera câmera; G.City.sim.act() é o jogador guloso (tools/longo.js).
   - Lado da Vila: game-world.js drawCidade desenha as casas e prédios depois da rua do comércio (G.City.view()).
   Números: D.CITY (data.js). Ganchos: G.City (open, close, isOpen, on, take, view, sim, state). Demo: ?dev&cidade=demo */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, C = E.PAL, D = E.Draw, N = E.Nature || {}, A = E.Assets;
  const CFG = G.Data.CITY;
  const W = 960, H = 540, INK = '#3B2818';
  const ITEM_IDS = Object.keys(CFG.ITEMS);
  const RES = CFG.RES, RESBY = {}; RES.forEach(r => { RESBY[r.id] = r; });
  const BUILD = CFG.BUILD, SEASONS = CFG.SEASONS;
  const NL = CFG.LOTS + CFG.LOTS2;

  /* ---- mundo (rua 3/4 que rola de lado) ---- */
  const BASE = 262, ROAD0 = 276, ROAD1 = 338, FRONT = 350, BOT = 452;
  const LOT_X0 = 470, LOT_W = 168, SC = 2;
  const PRACA = { x0: 1060, x1: 1460, cx: 1270 };
  const DEPOT = { x: 300, y: ROAD1 - 12 };

  /* ======================================================================
     Estado: P() = o que vai pro save (S.stats.city) · R = só da tela
     ====================================================================== */
  let api = {};
  const GS = () => G.S;
  function fresh() {
    return { on: 0, stock: { onigiri: 0, mochi: 0, mochid: 0 }, rate: { onigiri: 0, mochi: 0, mochid: 0 }, seen: {}, acc: {}, qa: {}, rt: 0,
      hearts: 0, fest: 0, festOn: 0, season: 0, festDone: 0, delivered: 0, yen: 0, grains: 0, blk2: 0, t: 0,
      ppl: [], lots: [], ord: [null, null, null], gap: [2, 8, 16], pend: [], q: [] };
  }
  function P() {
    const s = GS().stats; let c = s.city;
    if (!c || typeof c !== 'object') c = s.city = fresh();
    if (!c.__ok) { const f = fresh(); for (const k in f) if (c[k] === undefined || c[k] === null && f[k] !== null) c[k] = f[k]; for (const k of ITEM_IDS) { c.stock[k] = +c.stock[k] || 0; c.rate[k] = +c.rate[k] || 0; } Object.defineProperty(c, '__ok', { value: 1, enumerable: false }); }
    return c;
  }
  const R = { camX: 90, camT: null, sel: -1, choice: null, hint: 1, t: 0, toast: null, banner: null, news: [], heartPulse: 0, focoOpen: false };
  let people = [], lots = [];
  const kome = { x: DEPOT.x, y: DEPOT.y, face: 1, state: 'park', job: null, wait: 0 };
  const ps = E.Particles(900), fl = E.Floaters(120);

  const world = () => LOT_X0 + nOpen() * LOT_W + 330;
  const nOpen = () => CFG.LOTS + (P().blk2 ? CFG.LOTS2 : 0);
  function rebuild() {
    const c = P();
    while (c.lots.length < NL) c.lots.push({ b: null, obra: 0, ob: null, by: null, tot: 0 });
    lots = c.lots.map((rec, i) => ({ i, rec, x: LOT_X0 + i * LOT_W, pop: 0, bounce: 0, shopT: Math.random() * CFG.SHOP_EVERY }));
    people = c.ppl.filter(r => RESBY[r.id]).map(r => mkPerson(r));
  }
  function mkPerson(rec) {
    const L = lots[rec.lot] || lots[0];
    const p = { rec, def: RESBY[rec.id], x: L.x + U.rnd(-30, 30), y: U.rnd(ROAD0 + 12, ROAD1 - 10), tx: 0, ty: 0, face: 1, mode: 'idle', timer: U.rnd(0.5, 3),
      pose: 'sit', jump: 0, chat: null, chatT: 0, glow: 0, slot: 0, moving: false };
    p.tx = p.x; p.ty = p.y; return p;
  }
  const byId = id => people.find(p => p.rec.id === id);
  const resOn = i => people.find(p => p.rec.lot === i);

  /* ---- valores: o produto vale o que a doca pagaria por ele (G.Fab.itemV), escala com o jogo ---- */
  const val = t => (G.Fab && G.Fab.itemV ? G.Fab.itemV(t) * (P().qa[t] || 1) : 0);
  const cap = t => Math.max(CFG.ITEMS[t].capMin, Math.round(P().rate[t] * CFG.CAP_SEC));
  const has = t => P().rate[t] > 1e-4 || P().stock[t] >= CFG.ITEMS[t].qMin;
  function pay(v) { const s = GS(); if (!s || !(v > 0)) return; s.money += v; s.earned += v; s.dayEarn = (s.dayEarn || 0) + v; s.ipsAcc = (s.ipsAcc || 0) + v; P().yen += v; }
  const quiet = () => !isOpen() || (api.fast && api.fast());

  /* ======================================================================
     Som, avisos (desenhados no canvas da Cidade)
     ====================================================================== */
  const sfxLast = {};
  function sfx(name, o) {
    if (quiet() || (GS() && GS().opts && GS().opts.mute) || !E.Sfx || !E.Sfx.has || !E.Sfx.has(name)) return;
    const now = performance.now(); if (sfxLast[name] && now - sfxLast[name] < 90) return; sfxLast[name] = now;
    try { E.Sfx.play(name, o); } catch (e) { /* sem áudio */ }
  }
  const toast = (t, tone) => { if (!quiet()) R.toast = { t, tone: tone || '', life: 3.2 }; };
  const banner = (t, sub) => { if (!quiet()) R.banner = { t, sub: sub || '', life: 3.6 }; };
  const news = (k, txt) => { R.news.push([k, txt]); if (R.news.length > 40) R.news.shift(); };

  /* ======================================================================
     Regras
     ====================================================================== */
  const built = id => lots.some(l => l.rec.b === id);
  const heartBonus = item => lots.filter(l => l.rec.b && BUILD[l.rec.b].heart === item).length;
  const lvNeed = lv => { const T = CFG.HEART_LV; return lv <= T.length ? T[lv - 1] : T[T.length - 1] + CFG.HEART_STEP * (lv - T.length); };
  const orderOf = p => P().ord.findIndex(o => o && o.id === p.rec.id);
  const busyP = p => orderOf(p) >= 0 || P().q.some(o => o.id === p.rec.id);

  // a fábrica vendeu um produto: a fatia da Vila vem pra despensa (true = não vende na doca)
  function take(t, q) {
    if (!CFG.ITEMS[t]) return false;
    const c = P();
    if (!c.on) { if (t === CFG.unlock || t === 'mochid') unlock(); return false; }
    c.seen[t] = (c.seen[t] || 0) + 1;
    c.acc[t] = (c.acc[t] || 0) + CFG.share;
    if (c.acc[t] < 1) return false;
    if (c.stock[t] + 1 > cap(t)) { c.acc[t] = 1; return false; }   // despensa cheia: vende na doca
    c.acc[t] -= 1; c.stock[t] += 1;
    c.qa[t] = (c.qa[t] || 1) + ((q || 1) - (c.qa[t] || 1)) * 0.05;   // Selo de Qualidade da fábrica: a despensa guarda a média
    return true;
  }
  function unlock() {
    const c = P(); if (c.on) return;
    c.on = 1; c.t = 0;
    c.ppl = RES.filter(r => r.lot >= 0).map(r => ({ id: r.id, lot: r.lot, lv: 1, h: 0, last: 0 }));
    c.lots = []; for (let i = 0; i < NL; i++) c.lots.push({ b: null, obra: 0, ob: null, by: null, tot: 0 });
    for (const k in CFG.start) c.stock[k] = CFG.start[k];
    rebuild();
    news('novo', 'Cidade abriu');
    if (api.banner) api.banner();
  }
  function newOrder(slot) {
    const c = P();
    const free = people.filter(p => !busyP(p));
    if (!free.length) return false;
    free.sort((a, b) => (a.rec.last || 0) - (b.rec.last || 0));   // quem pediu há mais tempo tem preferência (ninguém fica esquecido)
    let p = free[Math.floor(Math.random() * Math.min(3, free.length))];
    const avail = ITEM_IDS.filter(has); if (!avail.length) return false;
    let item = Math.random() < CFG.FAV_CHANCE && has(p.def.fav) ? p.def.fav : avail[Math.floor(Math.random() * avail.length)];
    let qty = Math.max(CFG.ITEMS[item].qMin, Math.round(c.rate[item] * U.lerp(CFG.ORDER_SEC[0], CFG.ORDER_SEC[1], Math.random())));
    if (!c.delivered && !c.ord.some(Boolean)) { p = byId('taro') || p; item = 'onigiri'; qty = Math.min(24, Math.max(6, Math.floor(c.stock.onigiri * 0.6))); }   // 1º pedido sai na hora (presente da abertura)
    c.ord[slot] = { id: p.rec.id, item, qty, hearts: (item === p.def.fav ? 2 : 1) + heartBonus(item) };
    p.rec.last = c.t; p.jump = 1;
    sfx('pop', { pitch: 1.3, vol: 0.4 });
    return true;
  }
  const canDeliver = i => { const o = P().ord[i]; return !!o && P().stock[o.item] >= o.qty; };
  const orderPay = o => o.qty * val(o.item) * CFG.ORDER_PAY;
  function deliver(i) {
    const c = P(), o = c.ord[i]; if (!o) return false;
    if (c.stock[o.item] < o.qty) { toast('Falta ' + (o.qty - Math.floor(c.stock[o.item])) + ' ' + CFG.ITEMS[o.item].plural + ' na despensa', 'bad'); sfx('error'); return false; }
    c.stock[o.item] -= o.qty;
    c.ord[i] = null; c.gap[i] = CFG.ORDER_GAP * (built('sento') ? CFG.SENTO_GAP : 1);
    R.sel = -1; R.hint = 0;
    if (quiet()) arrive(o); else { c.q.push(o); sfx('buy', { vol: 0.5 }); sfx('whoosh', { vol: 0.3 }); }
    return true;
  }
  function arrive(o) {                      // o kei-truck chegou no morador (tela fechada: na hora)
    const c = P(), p = byId(o.id);
    const qi = c.q.indexOf(o); if (qi >= 0) c.q.splice(qi, 1);
    const v = orderPay(o); pay(v);
    c.delivered++;
    if (!p) return;
    const h = o.hearts * (c.festOn > 0 ? CFG.FEST_HEART : 1);
    if (!quiet()) {
      p.mode = 'happy'; p.timer = 1.6; p.jump = 1; p.glow = 1; p.face = kome.x < p.x ? -1 : 1;
      fl.add(p.x, p.y - 64, '+¥' + U.fmt(v), { size: 18, c: C.goldL, life: 1.3 });
      ps.burst(p.x, p.y - 30, 10, { c: [C.red, C.redL, C.sakura], shape: 'star', speed: [60, 180], life: 0.8 });
      sfx('kaching', { vol: 0.5 }); sfx('chirin', { vol: 0.4 }); if (Math.random() < 0.5) sfx('yip', { vol: 0.35 });
      chat(p, ['Valeu, Kome!', 'Itadakimasu!', 'Perfeito!', 'Que cheiro bom!'][Math.floor(Math.random() * 4)], 1.8);
      for (let k = 0; k < h; k++) hearts.push({ wx: p.x, wy: p.y - 40, t: -k * 0.12 });
    }
    addHearts(p, h);
  }
  function addHearts(p, h) {
    const c = P();
    c.hearts += h;
    if (!(c.festOn > 0)) c.fest = Math.min(CFG.FEST_NEED, c.fest + h * (built('templo') ? CFG.TEMPLO_FEST : 1));
    p.rec.h += h;
    while (p.rec.h >= lvNeed(p.rec.lv)) { p.rec.h -= lvNeed(p.rec.lv); p.rec.lv++; levelUp(p); }
  }
  function freeLots() { const c = P(), n = nOpen(), out = []; for (let i = 0; i < n; i++) { const r = c.lots[i]; if (!r.b && !r.obra && !resOn(i)) out.push(lots[i]); } return out; }
  function freeLot(near) { const L = freeLots(); if (!L.length) return null; L.sort((a, b) => Math.abs(a.x - near) - Math.abs(b.x - near)); return L[0]; }
  function buildOpts(p) {
    const opts = [], c = P();
    const add = id => { if (opts.length < 2 && BUILD[id] && !built(id) && !opts.includes(id) && !c.lots.some(l => l.ob === id) && !(BUILD[id].mora && c.ppl.some(q => q.id === BUILD[id].mora))) opts.push(id); };
    p.def.build.forEach(add); Object.keys(BUILD).forEach(add);
    return freeLot(lots[p.rec.lot].x) ? opts : [];
  }
  const obraOn = () => P().lots.some(l => l.obra > 0);   // um carpinteiro só: uma obra de cada vez
  const canBuildMore = () => !!freeLots().length && Object.keys(BUILD).some(id => !built(id) && !(BUILD[id].mora && P().ppl.some(q => q.id === BUILD[id].mora)));
  function levelUp(p) {
    const c = P();
    c.grains++;
    news('marco', p.def.nome + ' amizade ' + p.rec.lv);
    if (api.recompute) api.recompute();                     // Arroz do Coração: +1 grão
    const ticket = canBuildMore() && c.pend.length < 3;
    if (ticket) c.pend.push({ id: p.rec.id, lv: p.rec.lv });
    if (!ticket || obraOn()) banner(p.def.nome + ': amizade nível ' + p.rec.lv + '!', '+1 grão no Arroz do Coração (renda +1%)' + (ticket ? ' · prédio novo quando a obra atual terminar' : ''));
  }
  // próximo cartão de construção (quando o carpinteiro está livre); pula pedido que não tem mais o que construir
  function nextChoice() {
    const c = P(); if (obraOn()) return null;
    while (c.pend.length) { const pe = c.pend.shift(), p = byId(pe.id); if (!p) continue; const opts = buildOpts(p); if (opts.length) return { id: pe.id, lv: pe.lv, opts }; }
    return null;
  }
  function choose(id) {
    const ch = R.choice; R.choice = null; if (!ch) return;
    const p = byId(ch.id); if (!id || !p || !BUILD[id]) return;
    const L = freeLot(lots[p.rec.lot].x); if (!L) return;
    const c = P(), n = c.lots.filter(l => l.b || l.obra).length;
    const sec = U.lerp(CFG.BUILD_SEC[0], CFG.BUILD_SEC[1], Math.min(1, n / 10));
    Object.assign(L.rec, { obra: sec, tot: sec, ob: id, by: p.rec.id });
    if (!quiet()) { R.camT = U.clamp(L.x - W / 2, 0, world() - W); sfx('stomp', { vol: 0.4 }); sfx('buy', { vol: 0.4 }); toast('Obra começou: ' + BUILD[id].nome + ' fica pronta em ' + U.fmtTime(sec), 'gold'); }
    news('obra', BUILD[id].nome);
  }
  function finishBuild(L) {
    const r = L.rec, id = r.ob, B = BUILD[id]; if (!B) { r.obra = 0; r.ob = null; return; }
    r.b = id; r.obra = 0; r.ob = null; L.pop = 1;
    const by = RESBY[r.by];
    news('casa', B.nome);
    if (!quiet()) {
      ps.burst(L.x, BASE - 50, 28, { c: [C.gold, C.goldL, C.sakura, C.cream], shape: 'star', speed: [80, 260], life: 1.0 });
      ps.puff(L.x, BASE - 6, 14, 12, { c: C.sand });
      sfx('fanfare'); sfx('chirin');
      banner(B.nome + (by ? ' — presente da amizade com ' + by.nome : '') + '!', B.fx);
    } else if (api.toast) api.toast('Cidade: ' + B.nome + ' ficou pronta!', B.fx);
    const c = P();
    if (B.mora && RESBY[B.mora] && !c.ppl.some(q => q.id === B.mora)) {
      const rec = { id: B.mora, lot: L.i, lv: 1, h: 0, last: c.t }; c.ppl.push(rec);
      const p = mkPerson(rec); people.push(p); p.x = L.x; p.y = BASE + 14; p.jump = 1;
      chat(p, 'Oi, vizinhos! Me mudei!', 3);
      news('novo', 'morador ' + RESBY[B.mora].nome);
      toast(RESBY[B.mora].nome + ' se mudou pra rua! (' + RESBY[B.mora].job + ')', 'gold');
    }
    if (!c.blk2 && !freeLots().length) {   // a rua lotou: abre o 2º quarteirão
      c.blk2 = 1; news('novo', 'quarteirão novo');
      if (!quiet()) banner('Quarteirão novo!', 'a rua cresceu: mais ' + CFG.LOTS2 + ' terrenos pros prédios da amizade');
    }
  }
  function startFest() {
    const c = P(); if (c.fest < CFG.FEST_NEED || c.festOn > 0) return false;
    c.festOn = CFG.FEST_SEC; c.fest = 0;
    const se = SEASONS[c.season];
    news('dourado', 'festival ' + se.fest);
    if (!quiet()) {
      banner('Festival ' + se.fest + '!', se.sub + ' · pedidos valem corações em dobro');
      sfx('fanfare'); sfx('levelup');
      people.forEach((p, k) => { p.mode = 'dance'; p.slot = k; });
      R.camT = U.clamp(PRACA.cx - W / 2, 0, world() - W);
    }
    return true;
  }
  function endFest() {
    const c = P();
    c.festDone++; c.season = (c.season + 1) % 4;
    const se = SEASONS[c.season];
    people.forEach(p => { if (p.mode === 'dance') { p.mode = 'idle'; p.timer = U.rnd(0.5, 2); } });
    toast('Chegou o ' + se.nome + '! Próximo festival: ' + se.fest, 'gold');
    news('ilha', 'estação ' + se.nome);
  }

  /* ======================================================================
     Passo por tempo (G.Sim): roda com a tela aberta ou fechada
     ====================================================================== */
  function logic(dt) {
    const c = P();
    c.t += dt;
    // ritmo do que chega na despensa (média de ~1 min, guardada no save: pedidos e teto já valem na volta)
    c.rt += dt;
    if (c.rt >= 10) { for (const k of ITEM_IDS) { const r = ((c.seen[k] || 0) * CFG.share) / c.rt; c.rate[k] += (r - c.rate[k]) * (c.rate[k] ? 0.18 : 1); c.seen[k] = 0; } c.rt = 0; }
    for (const L of lots) {
      const r = L.rec;
      if (r.obra) { r.obra -= dt; if (!quiet() && Math.random() < dt * 3) ps.puff(L.x + U.rnd(-50, 50), BASE - U.rnd(0, 40), 3, 6, { c: C.sand }); if (r.obra <= 0) finishBuild(L); continue; }
      const B = r.b && BUILD[r.b]; if (!B || !B.loja) continue;
      L.shopT += dt;
      if (L.shopT >= CFG.SHOP_EVERY) { L.shopT -= CFG.SHOP_EVERY; shopBuy(L, B); }
    }
    for (let i = 0; i < 3; i++) if (!c.ord[i]) { c.gap[i] -= dt; if (c.gap[i] <= 0 && !newOrder(i)) c.gap[i] = 3; }
    if (c.festOn > 0) { c.festOn -= dt; if (c.festOn <= 0) { c.festOn = 0; endFest(); } }
  }
  // loja compra só o excedente (acima da linha), nunca o que está guardado pra pedido: até metade do que chega em SHOP_EVERY
  function shopBuy(L, B) {
    const c = P();
    const k = B.loja.slice().sort((a, b) => c.stock[b] / cap(b) - c.stock[a] / cap(a))[0];
    const over = c.stock[k] - cap(k) * CFG.SHOP_LINE; if (over < 1) return 0;
    const n = Math.min(Math.floor(over), Math.max(1, Math.ceil(c.rate[k] * CFG.SHOP_EVERY * 0.5)));
    c.stock[k] -= n; const v = n * val(k) * CFG.SHOP_PAY; pay(v); L.bounce = 1;
    if (!quiet()) fl.add(L.x + U.rnd(-20, 20), BASE - 70, '+¥' + U.fmt(v), { size: 15, c: C.goldL, life: 0.8 });
    return v;
  }
  let saveT = 0, chipT = 0, chipEl = null;
  function tick(dt) {
    if (!GS()) return;
    const c = P();
    chipTick(dt);
    if (!c.on) return;
    if (lots.length !== NL || people.length !== c.ppl.length) rebuild();
    if (quiet() && c.q.length) for (const o of c.q.slice()) arrive(o);   // tela fechada: o que estava no caminhão chega na hora
    let left = Math.min(dt, 1);
    while (left > 1e-6) { const st = Math.min(left, 1 / 20); logic(st); if (!quiet()) { for (const p of people) personTick(p, st); komeTick(st); } left -= st; }
    if ((saveT -= dt) <= 0) saveT = 2;
  }
  function offline(sec) {            // tempo fora: obras terminam, lojas vendem o que sobra, festival acaba. Pedidos esperam
    const c = P(); if (!c.on || !(sec > 0)) return null;
    if (lots.length !== NL) rebuild();
    const s0 = c.yen; let built0 = c.lots.filter(l => l.b).length;
    for (const o of c.q.slice()) arrive(o);
    for (const L of lots) {
      const r = L.rec;
      if (r.obra) { r.obra -= sec; if (r.obra <= 0) finishBuild(L); }
      const B = r.b && BUILD[r.b];
      if (B && B.loja) for (let n = Math.min(4000, Math.floor(sec / CFG.SHOP_EVERY)); n > 0; n--) if (!shopBuy(L, B)) break;
    }
    if (c.festOn > 0) { c.festOn -= sec; if (c.festOn <= 0) { c.festOn = 0; endFest(); } }
    for (let i = 0; i < 3; i++) if (!c.ord[i]) c.gap[i] = Math.min(c.gap[i], 1);
    return { yen: c.yen - s0, built: c.lots.filter(l => l.b).length - built0 };
  }

  /* ---- chip "Cidade" no topo (com a dica do que está pronto) ---- */
  function chipTick(dt) {
    if ((chipT -= dt) > 0) return; chipT = 0.4;
    if (!G.HUD || !G.HUD.chip || !G.HUD.ready) return;
    const c = P();
    if (!chipEl) { chipEl = G.HUD.chip({ id: 'cidade', icon: 'house', label: 'Cidade', order: 21, tone: '#FFE6D2', show: false, onClick: () => open() }); if (!chipEl) return; }
    if (!c.on) { chipEl.set({ show: false }); return; }
    const ready = c.ord.filter((o, i) => o && canDeliver(i)).length, fest = c.fest >= CFG.FEST_NEED && !(c.festOn > 0), pend = c.pend.length && !obraOn();
    const hint = pend ? 'amizade nova!' : fest ? 'festival pronto!' : ready ? ready + (ready > 1 ? ' entregas prontas' : ' entrega pronta') : '';
    chipEl.set({ show: true, hint: c.delivered ? hint : 'nova! toque', prio: c.delivered ? (hint ? 1 : 0) : 2, tip: '♥ ' + U.fmt(c.hearts) + ' · ' + people.length + ' moradores · Arroz do Coração +' + c.grains + '%', act: 'Abrir' });
  }

  /* ======================================================================
     Gente andando (só com a tela aberta)
     ====================================================================== */
  function chat(p, s, dur) { p.chat = s; p.chatT = dur || 2.6; }
  const IDLE = ['sit', 'wag', 'sniff', 'wave', 'think', 'stretch', 'scratch', 'yawn'];
  function personTick(p, dt) {
    p.jump = Math.max(0, p.jump - dt * 2.5); p.glow = Math.max(0, p.glow - dt * 0.8); p.chatT -= dt;
    const home = lots[p.rec.lot] || lots[0], WD = world();
    if (P().festOn > 0 && p.mode !== 'happy' && p.mode !== 'run') {
      if (p.mode !== 'dance') { p.mode = 'dance'; p.slot = people.indexOf(p); }
      const n = people.length, a = (p.slot / n) * Math.PI * 2 + R.t * 0.35;
      p.tx = PRACA.cx + Math.cos(a) * 120; p.ty = FRONT + 50 + Math.sin(a) * 30;
    } else if (p.mode === 'dance') { p.mode = 'idle'; p.timer = U.rnd(0.5, 2); }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    const spd = p.mode === 'run' ? 120 : p.mode === 'dance' ? 90 : 46;
    if (d > 2) { p.x += dx / d * Math.min(d, spd * dt); p.y += dy / d * Math.min(d, spd * dt); if (Math.abs(dx) > 1) p.face = dx > 0 ? 1 : -1; p.moving = true; }
    else p.moving = false;
    if (p.mode === 'dance') { if (!p.moving) p.face = Math.sin(R.t * 2 + p.slot) > 0 ? 1 : -1; return; }
    p.timer -= dt;
    if (p.mode === 'happy') { if (p.timer <= 0) { p.mode = 'idle'; p.timer = U.rnd(1, 3); } return; }
    if (p.mode === 'run') { if (!p.moving) { p.mode = 'idle'; p.timer = 1; } return; }
    if (p.timer <= 0 && !p.moving) {
      const r = Math.random();
      if (r < 0.55) { p.tx = U.clamp(home.x + U.rnd(-260, 260), 360, WD - 40); p.ty = U.rnd(ROAD0 + 8, ROAD1 - 6); p.mode = 'walk'; p.timer = U.rnd(3, 7); }
      else if (r < 0.75) { p.tx = home.x + U.rnd(-14, 14); p.ty = BASE + 14; p.mode = 'walk'; p.timer = U.rnd(3, 6); }
      else { p.pose = IDLE[Math.floor(Math.random() * IDLE.length)]; p.mode = 'idle'; p.timer = U.rnd(2, 5); }
    }
  }
  function komeTick(dt) {
    const K = kome, q = P().q;
    if (!K.job && q.length) { K.job = q[0]; K.state = 'go'; }
    if (K.job && q.indexOf(K.job) < 0) { K.job = null; K.state = 'back'; }
    let tx = DEPOT.x, ty = DEPOT.y;
    const p = K.job && byId(K.job.id);
    if (K.job && !p) { arrive(K.job); K.job = null; return; }
    if (p) { tx = p.x - (p.x > K.x ? 56 : -56); ty = Math.max(ROAD0 + 18, Math.min(ROAD1 - 12, p.y)); }
    if (K.state === 'drop') {
      K.wait -= dt;
      if (K.wait <= 0) { const j = K.job; K.job = null; arrive(j); K.state = q.length ? 'go' : 'back'; }
      return;
    }
    if (K.state === 'park') return;
    const dx = tx - K.x, dy = ty - K.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 2) K.face = dx > 0 ? 1 : -1;
    const v = 300 * dt;
    if (d <= v + 0.5) {
      K.x = tx; K.y = ty;
      if (K.job) { K.state = 'drop'; K.wait = 0.7; if (p.mode !== 'dance') { p.mode = 'run'; p.tx = K.x + (p.x > K.x ? 34 : -34); p.ty = K.y + 4; } sfx('thud', { vol: 0.3 }); }
      else { K.state = 'park'; K.face = 1; }
    } else { K.x += dx / d * v; K.y += dy / d * v; }
  }
  const hearts = [];   // corações voando até o contador do topo

  /* ======================================================================
     Tela (overlay com stage próprio, igual à Fábrica)
     ====================================================================== */
  const root = document.createElement('div'); root.className = 'k-city';
  document.body.appendChild(root);
  const css = document.createElement('style');
  css.textContent = '.k-city{position:fixed;inset:0;z-index:55;background:#2a1a10;display:none}.k-city.k-city-open{display:block}';
  document.head.appendChild(css);
  const stage = E.Stage({ parent: root, width: W, height: H, bg: '#2a1a10' });
  const g = stage.g;
  const input = E.Input(stage);

  /* sprites pequenos (ícones de item/coração, mesmos do protótipo) */
  const XP = { Q: C.mochi, q: C.mochiD };
  const sp = (name, t) => E.spriteText('cid-' + name, t, { pal: XP });
  const ICON = {
    onigiri: sp('onigiri', `
      ...A...
      ..AAA..
      .AAAAA.
      AAANAAa
      AANNNaa`),
    mochi: sp('mochi', `
      .QQQQ.
      QQWQQQ
      QQQQQq
      .qqqq.`),
    mochid: sp('mochid', `
      .YYYY.
      YYWYYY
      YYYYYy
      .yyyy.`),
    heart: sp('heart', `
      .RR.RR.
      RRRRRRR
      RRRRRRr
      .RRRRr.
      ..Rrr..
      ...r...`),
    yen: sp('yen', `
      .YYYY.
      YYyyYY
      YyYYyY
      YYyyYY
      .YYYY.`),
    flower: sp('flower', `
      ..P..
      .PYP.
      PPYPP
      .PPP.`),
    sun: sp('sun', `
      ..Y..
      .YYY.
      YYYYY
      .YYY.
      ..Y..`),
    leaf: sp('leaf', `
      ..O..
      .OOO.
      OOOOO
      .oOo.
      ..o..`),
    snow: sp('snow', `
      ..W..
      W.W.W
      .WWW.
      W.W.W
      ..W..`),
  };
  const SEASON_ICON = ['flower', 'sun', 'leaf', 'snow'];
  function blit(cv, x, y, s) {     // x = centro, y = base
    if (!cv) return;
    const w = cv.width * s, h = cv.height * s;
    g.imageSmoothingEnabled = false;
    g.drawImage(cv, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
  }
  const txt = (s, x, y, o) => D.text(g, s, x, y, o);
  const T = (size, col, align) => ({ size, col: col || INK, sw: 0, align: align || 'center', weight: 900 });
  const TS = (size, col, align) => ({ size, col: col || C.cream, sw: 4, align: align || 'center', weight: 900 });
  function artFrame(id, tag, t) {
    const a = A && A.get(id); if (!a) return 0;
    const an = a.anims[tag] || a.anims.dia || a.anims.parado || a.anims[Object.keys(a.anims)[0]];
    if (!an) return 0;
    const n = an.to - an.from + 1; return an.from + (n > 1 ? Math.floor(t * 7.5) % n : 0);
  }
  const night = () => { const f = P().festOn; return f > 0 ? Math.min(1, (CFG.FEST_SEC - f) / 2.5, f / 2.5) : 0; };
  function drawArt(id, x, y, s, t, o) {
    const a = A && A.get(id); if (!a) return;
    let tag = night() > 0.5 ? 'noite' : 'dia';
    if (id === 'cid_sento' && tag === 'dia') tag = 'fumaca';
    if (!a.anims.dia) tag = (o && o.anim) || 'parado';
    A.draw(g, id, artFrame(id, tag, t), x, y, Object.assign({ scale: s }, o || {}));
  }

  /* ---- cenário ---- */
  const clouds = N.clouds ? N.clouds(4, { n: 6 }) : null;
  const birds = N.birds ? N.birds(3, { n: 5, y: 0.12 }) : null;
  const ff = N.fireflies ? N.fireflies({ x0: PRACA.x0, x1: PRACA.x1, y0: 330, y1: 440, n: 16 }) : null;
  const tod = () => U.lerp(0.42, 0.86, night());
  const season = () => SEASONS[P().season] || SEASONS[0];
  function drawSky(t) {
    if (N.sky) N.sky(g, W, H, { tod: tod(), t, stars: true }); else { g.fillStyle = '#9FD3F0'; g.fillRect(0, 0, W, H); }
    if (N.celestial) N.celestial(g, W, 216, { tod: tod(), t, r: 16 });
    if (clouds) clouds.draw(g, W, 300, R.camX * 0.15);
    if (N.fuji) { g.save(); g.translate(-R.camX * 0.08, 0); N.fuji(g, 760, 216, 0.85, { tod: tod(), t, snow: true }); g.restore(); }
    if (birds && night() < 0.5) birds.draw(g, W, 300, R.camX * 0.2);
  }
  function drawGroundBack(t) {
    const se = season(), c = P();
    if (N.hills) N.hills(g, world() + 400, 222, R.camX, { col: c.season === 3 ? '#C9D3D8' : '#7E9C6A', amp: 22, parallax: 0.45, seed: 3, haze: 0.45, tod: tod(), trees: 0.5, bottom: 266 });
    g.fillStyle = INK; g.fillRect(R.camX - 10, 212, W + 20, 2);
    g.fillStyle = se.grass; g.fillRect(R.camX - 10, 214, W + 20, BASE - 214);
    g.fillStyle = 'rgba(255,250,230,.18)'; g.fillRect(R.camX - 10, 214, W + 20, 3);
    if (N.tree) for (let i = -1; i <= nOpen(); i++) {
      const x = LOT_X0 + i * LOT_W + LOT_W / 2;
      if (x < R.camX - 80 || x > R.camX + W + 80) continue;
      N.tree(g, x, 226, { kind: i % 3 === 0 ? se.tree : (c.season === 3 ? 'pine' : 'round'), s: 0.55, seed: i * 7 + 2, t });
    }
  }
  function drawStreet() {
    const x0 = R.camX - 10, w = W + 20, se = season();
    g.fillStyle = INK; g.fillRect(x0, BASE - 1, w, 2);
    g.fillStyle = C.stoneL; g.fillRect(x0, BASE, w, ROAD0 - BASE);
    g.fillStyle = C.stone; for (let x = Math.floor(x0 / 28) * 28; x < x0 + w; x += 28) g.fillRect(x, BASE, 1, ROAD0 - BASE);
    g.fillStyle = INK; g.fillRect(x0, ROAD0, w, 2);
    g.fillStyle = '#C9A877'; g.fillRect(x0, ROAD0 + 2, w, ROAD1 - ROAD0 - 2);
    g.fillStyle = '#B8966A'; g.fillRect(x0, ROAD1 - 10, w, 8);
    g.fillStyle = 'rgba(255,250,230,.25)'; g.fillRect(x0, ROAD0 + 2, w, 3);
    const RR = E.RNG(5), WD = world();
    for (let i = 0; i < 400; i++) {
      const x = RR() * WD, y = ROAD0 + 8 + RR() * (ROAD1 - ROAD0 - 16), c2 = RR() < 0.5;
      if (x < x0 || x > x0 + w) continue;
      g.fillStyle = c2 ? '#B08C5E' : '#DCC096'; g.fillRect(Math.round(x), Math.round(y), 4, 2);
    }
    g.fillStyle = INK; g.fillRect(x0, ROAD1, w, 2);
    g.fillStyle = C.stoneL; g.fillRect(x0, ROAD1 + 2, w, FRONT - ROAD1 - 2);
    g.fillStyle = C.stoneD; g.fillRect(x0, FRONT - 3, w, 3);
    g.fillStyle = se.grass; g.fillRect(x0, FRONT, w, BOT - FRONT);
    g.fillStyle = 'rgba(0,0,0,.06)'; for (let y = FRONT + 8; y < BOT; y += 12) g.fillRect(x0, y, w, 1);
    g.fillStyle = INK; D.rrect(g, PRACA.x0 - 3, FRONT + 6, PRACA.x1 - PRACA.x0 + 6, BOT - FRONT, 14); g.fill();
    g.fillStyle = C.sand; D.rrect(g, PRACA.x0, FRONT + 9, PRACA.x1 - PRACA.x0, BOT - FRONT, 12); g.fill();
    g.fillStyle = 'rgba(160,120,70,.25)';
    for (let y = FRONT + 22; y < BOT; y += 18) for (let x = PRACA.x0 + ((y / 18) % 2) * 16; x < PRACA.x1 - 10; x += 32) g.fillRect(x, y, 28, 2);
    g.fillStyle = INK; g.fillRect(-10, 146, 392, 2);
    g.fillStyle = '#B9B2A2'; g.fillRect(-10, 148, 392, BASE - 148);
  }
  let drawList = [];
  const put = (y, fn) => drawList.push({ y, fn });
  function lotDrawables(t) {
    const n0 = nOpen();
    for (const L of lots) {
      if (L.x < R.camX - 120 || L.x > R.camX + W + 120) continue;
      const r = L.rec;
      if (L.i >= n0) {   // 2º quarteirão ainda fechado: cerquinha e placa
        if (L.i === n0) put(BASE - 0.5, () => { if (N.fence) N.fence(g, L.x - 70, L.x + LOT_W * CFG.LOTS2, BASE + 2, { kind: 'bamboo' }); D.sign(g, L.x - 70, BASE - 70, 200, 40, 'EM BREVE', { col: C.cream, ink: C.red }); txt('abre quando a rua lotar', L.x + 30, BASE - 82, TS(14)); });
        continue;
      }
      put(BASE - 0.5, () => {
        if (r.obra) {
          const k = 1 - r.obra / (r.tot || 1), st = k < 0.4 ? 1 : k < 0.8 ? 2 : 3;
          if (N.house) N.house(g, L.x, BASE, { stage: st, s: 0.95, t });
          E.drawShiba(g, L.x + 46, BASE + 2, 'dig', t * 1.6, { pal: 'cha', scale: 0.8, face: -1 });
          txt('obra ' + U.fmtTime(Math.ceil(r.obra)), L.x, BASE - 98, TS(15));
          return;
        }
        const res = resOn(L.i), id = r.b ? BUILD[r.b].art : res ? res.def.art : null;
        if (!id) { if (N.house) N.house(g, L.x, BASE, { stage: 0, s: 0.9, t, sign: 'TERRENO' }); return; }
        const pop = L.pop > 0 ? 1 + Math.sin(L.pop * Math.PI) * 0.12 : 1, bo = L.bounce * 2;
        g.save(); g.translate(L.x, BASE); g.scale(1 / pop + (pop - 1) * 0.5, pop + bo * 0.01); g.translate(-L.x, -BASE);
        D.shadow(g, L.x, BASE + 1, 78, 5, 0.18);
        drawArt(id, L.x, BASE + 1, id === 'cid_templo' ? 1.5 : SC, t);
        g.restore();
        const B = r.b && BUILD[r.b];
        if (B && B.loja && B.loja.length === 1) blit(ICON[B.loja[0]], L.x + 62, BASE - 4, 2);
        if (res && res.rec.lv > 1 && !r.b && N.flower) for (let f = 0; f < Math.min(4, res.rec.lv - 1); f++) N.flower(g, L.x - 60 + f * 10, BASE + 4, { kind: ['tulip', 'daisy', 'ajisai', 'tanpopo'][f], seed: f + L.i, t, s: 0.8 });
      });
    }
  }
  function propDrawables(t) {
    const lit = night() > 0.5, se = season(), c = P(), n0 = nOpen(), WD = world();
    for (let i = 0; i <= n0; i++) {
      const x = LOT_X0 - LOT_W / 2 + i * LOT_W; if (x < R.camX - 60 || x > R.camX + W + 60) continue;
      put(BASE + 2, () => { drawArt('poste_de_luz', x, BASE + 4, 1.5, t); if (lit && N.glow) N.glow(g, x + 6, BASE - 88, 40, '#FFD98A', 0.8); });
    }
    put(BASE + 4, () => drawArt('cid_correio', LOT_X0 + 2 * LOT_W - 40, BASE + 6, 1.5, t));
    put(BASE + 3, () => { drawArt('prop_barril', lots[4].x + 70, BASE + 4, 1.5, t); drawArt('prop_caixote', lots[4].x - 72, BASE + 4, 1.5, t); });
    put(BASE - 1, () => A && A.draw(g, 'gato_laranja', artFrame('gato_laranja', 'dormir', t * 0.4), lots[0].x + 30, BASE - 82, { scale: 0.8 }));
    put(FRONT + 46, () => drawArt('prop_venda', 560, FRONT + 46, 1.5, t));
    put(FRONT + 40, () => drawArt('cid_banco', 860, FRONT + 40, 1.5, t));
    put(FRONT + 70, () => drawArt('cid_banco', PRACA.x0 + 70, FRONT + 70, 1.5, t));
    if (N.tree) {
      put(FRONT + 64, () => N.tree(g, PRACA.x1 + 70, FRONT + 64, { kind: se.tree, s: 1.15, seed: 9, t }));
      put(FRONT + 30, () => N.tree(g, 700, FRONT + 30, { kind: c.season === 3 ? 'pine' : 'round', s: 0.8, seed: 4, t }));
      put(FRONT + 80, () => N.tree(g, 1720, FRONT + 80, { kind: se.tree, s: 1.0, seed: 12, t }));
      if (c.blk2) put(FRONT + 72, () => N.tree(g, 2600, FRONT + 72, { kind: se.tree, s: 1.05, seed: 17, t }));
    }
    if (N.lantern) { put(FRONT + 60, () => N.lantern(g, PRACA.x0 + 20, FRONT + 60, 1, { t, lit })); put(FRONT + 80, () => N.lantern(g, PRACA.x1 - 18, FRONT + 80, 1, { t, lit })); }
    if (N.torii) put(FRONT + 64, () => N.torii(g, 1880, FRONT + 64, 0.9, { t }));
    const RR = E.RNG(21);
    for (let x = 380; x < WD; x += 46 + Math.floor(RR() * 40)) {
      const k = RR(), y = FRONT + 8 + RR() * 10, sd = Math.floor(RR() * 99);
      if (x > PRACA.x0 - 20 && x < PRACA.x1 + 130) continue;
      if (x < R.camX - 60 || x > R.camX + W + 60) continue;
      if (k < 0.35) { if (N.bush) put(y, () => N.bush(g, x, y, { kind: c.season === 0 && sd % 2 ? 'azalea' : 'bush', s: 0.7, seed: sd, t })); }
      else if (k < 0.7) { if (N.flower) put(y, () => { const kinds = [['tulip', 'tanpopo'], ['ajisai', 'daisy'], ['higanbana', 'daisy'], ['daisy', 'daisy']][c.season]; for (let f = 0; f < 3; f++) N.flower(g, x + f * 9, y + (f % 2) * 4, { kind: kinds[f % 2], seed: sd + f, t, s: 0.9 }); }); }
      else if (k < 0.85) { if (N.rock) put(y, () => N.rock(g, x, y, { w: 18, h: 11, seed: sd, moss: true })); }
      else if (N.grassTuft) put(y, () => N.grassTuft(g, x, y, { seed: sd, t, s: 1.1 }));
    }
    if (N.fence) put(FRONT + 2, () => { N.fence(g, 380, PRACA.x0 - 20, FRONT + 4, { kind: 'bamboo' }); N.fence(g, PRACA.x1 + 20, WD, FRONT + 4, { kind: 'bamboo' }); });
    put(BASE - 2, () => {   // fábrica KOME PACK no canto da rua: é dela que vem a despensa
      D.shadow(g, 190, BASE - 4, 170, 6, 0.2);
      if (A) A.draw(g, 'fabrica_kome_pack', artFrame('fabrica_kome_pack', 'dia', t), 190, BASE - 4, { scale: 1.5 });
      const lx = U.clamp(R.camX + 120, 250, 300); txt('Fábrica KOME PACK', lx, 136, TS(16));
      txt(Math.round(CFG.share * 100) + '% vem pra despensa', lx, 156, TS(14, C.goldL));
    });
    if (night() > 0) {   // festival: barraquinhas, bandeiras, torre do taiko, turistas tanuki
      if (N.stall) { put(FRONT + 30, () => N.stall(g, PRACA.x0 + 70, FRONT + 30, { t, lit: true, col: C.red })); put(FRONT + 30, () => N.stall(g, PRACA.x1 - 70, FRONT + 30, { t, lit: true, col: C.bowl })); }
      if (N.nobori) put(FRONT + 20, () => { N.nobori(g, PRACA.x0 + 40, FRONT + 20, { t, col: C.red }); N.nobori(g, PRACA.x1 - 30, FRONT + 20, { t, col: C.ora }); });
      put(FRONT + 56, () => yagura(PRACA.cx, FRONT + 56, t));
      if (A) { put(FRONT + 60, () => A.draw(g, 'tanuki', artFrame('tanuki', 'feliz', t), PRACA.x0 + 34, FRONT + 84, { scale: 1 })); put(FRONT + 86, () => A.draw(g, 'tanuki', artFrame('tanuki', 'comer', t + 0.3), PRACA.x1 - 34, FRONT + 86, { scale: 1, flip: true })); }
    }
  }
  function yagura(x, y, t) {        // torre do taiko do bon-odori (vetor chunky, contorno Kome)
    const box = (a, b, w, h, c1, c2) => { g.fillStyle = INK; g.fillRect(a - 2, b - 2, w + 4, h + 4); g.fillStyle = c1; g.fillRect(a, b, w, h); if (c2) { g.fillStyle = c2; g.fillRect(a, b + h - 3, w, 3); } };
    D.shadow(g, x, y + 2, 60, 6, 0.25);
    for (const dx of [-40, 34]) box(x + dx, y - 70, 6, 70, C.wood, C.woodD);
    box(x - 50, y - 78, 100, 12, C.woodL, C.woodD);
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? C.cream : C.red; g.fillRect(x - 48 + i * 9.6, y - 66, 9.6, 14); }
    g.fillStyle = INK; g.fillRect(x - 48, y - 52, 96, 2);
    g.fillStyle = INK; g.beginPath(); g.moveTo(x - 60, y - 112); g.lineTo(x + 60, y - 112); g.lineTo(x + 48, y - 128); g.lineTo(x - 48, y - 128); g.closePath(); g.fill();
    g.fillStyle = C.redD; g.fillRect(x - 56, y - 116, 112, 4); g.fillStyle = C.red; g.fillRect(x - 46, y - 126, 92, 10);
    for (const dx of [-44, 38]) box(x + dx, y - 112, 6, 34, C.wood);
    const hit = Math.sin(t * 9) > 0.6;
    g.fillStyle = INK; g.beginPath(); g.ellipse(x + 14, y - 92, 13, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.rust; g.beginPath(); g.ellipse(x + 14, y - 92, 11, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.cream; g.beginPath(); g.ellipse(x + 10, y - 92, 5, 7, 0, 0, Math.PI * 2); g.fill();
    E.drawShiba(g, x - 12, y - 79, hit ? 'slash' : 'windup', t, { pal: (GS().look && GS().look.pal) || 'kome', scale: 0.7, shadow: false });
    if (hit && Math.random() < 0.15) { ps.burst(x + 12, y - 96, 3, { c: C.goldL, shape: 'star', speed: [40, 90], life: 0.4 }); sfx('thud', { vol: 0.15, pitch: 0.7 }); }
    if (N.chochin) for (let i = 0; i < 5; i++) N.chochin(g, x - 44 + i * 22, y - 110, { t, lit: true, s: 0.8, seed: i });
  }
  function streetLanterns(t) {       // varal de lanternas atravessando a rua no festival
    if (night() <= 0 || !N.chochin) return;
    for (let i = 0; i < nOpen(); i++) {
      const xa = LOT_X0 - LOT_W / 2 + i * LOT_W + 6, xb = xa + LOT_W;
      if (xb < R.camX || xa > R.camX + W) continue;
      g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath();
      for (let k = 0; k <= 12; k++) { const u = k / 12, x = U.lerp(xa, xb, u), y = BASE - 86 + Math.sin(u * Math.PI) * 18; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      for (let k = 1; k < 6; k++) { const u = k / 6, x = U.lerp(xa, xb, u), y = BASE - 86 + Math.sin(u * Math.PI) * 18; N.chochin(g, x, y, { t, lit: true, s: 0.75, seed: i * 6 + k, col: (i + k) % 3 ? C.red : C.ora }); }
    }
  }
  function personDrawables(t) {
    const c = P();
    for (const p of people) {
      if (p.x < R.camX - 60 || p.x > R.camX + W + 60) continue;
      put(p.y, () => {
        const jy = -Math.sin(p.jump * Math.PI) * 10;
        let pose = p.pose;
        if (p.mode === 'dance') pose = p.moving ? 'walk' : (p.slot % 2 ? 'dance' : 'dance2');
        else if (p.mode === 'happy') pose = 'cheer';
        else if (p.mode === 'run') pose = 'run';
        else if (p.moving) pose = 'walk';
        else if (orderOf(p) >= 0 && p.mode === 'idle') pose = 'wave';
        if (p.glow > 0 && N.glow) N.glow(g, p.x, p.y - 20, 34, '#FFE68A', p.glow);
        const so = R.sel >= 0 && c.ord[R.sel]; if (so && so.id === p.rec.id) { g.strokeStyle = C.gold; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x, p.y + 1, 22, 7, 0, 0, Math.PI * 2); g.stroke(); }
        E.drawShiba(g, p.x, p.y + jy, pose, t + p.rec.lot, { pal: p.def.pal, hat: p.def.hat, scale: 1.1, face: p.face });
      });
    }
    put(kome.y + 6, () => {
      const moving = kome.state === 'go' || kome.state === 'back', bob = moving ? Math.sin(R.t * 30) * 0.8 : 0;
      D.shadow(g, kome.x, kome.y + 6, 44, 5, 0.25);
      if (A) A.draw(g, 'cid_keitruck', artFrame('cid_keitruck', moving ? 'andar' : 'parado', t), kome.x, kome.y + 6 + bob, { scale: 1.5, flip: kome.face < 0 });
      E.drawShibaHead(g, kome.x + kome.face * 14, kome.y - 34 + bob, t, { scale: 0.75, expr: kome.job ? 'happy' : 'normal', pal: (GS().look && GS().look.pal) || 'kome', face: kome.face });
      const n = c.q.length;
      for (let i = 0; i < Math.min(3, n); i++) {
        const bx = kome.x - kome.face * (20 + i * 12), by = kome.y - 20 + bob;
        g.fillStyle = INK; g.fillRect(bx - 7, by - 9, 14, 12); g.fillStyle = C.sack; g.fillRect(bx - 5, by - 7, 10, 8); g.fillStyle = C.red; g.fillRect(bx - 1, by - 7, 2, 8);
      }
      const jp = kome.state === 'drop' && kome.job && byId(kome.job.id);
      if (jp) { const k = 1 - kome.wait / 0.7; blit(ICON[kome.job.item], U.lerp(kome.x, jp.x, k), U.lerp(kome.y - 24, jp.y - 34, k) - Math.sin(k * Math.PI) * 26, 3); }
    });
  }
  function bubble(x, y, w, h, fill) {
    g.fillStyle = INK; D.rrect(g, x - w / 2 - 2, y - h - 2, w + 4, h + 4, 9); g.fill();
    g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.lineTo(x, y + 9); g.closePath(); g.fill();
    g.fillStyle = fill || C.cream; D.rrect(g, x - w / 2, y - h, w, h, 7); g.fill();
    g.beginPath(); g.moveTo(x - 5, y - 1); g.lineTo(x + 5, y - 1); g.lineTo(x, y + 5); g.closePath(); g.fill();
  }
  function drawBubbles(t) {
    const c = P();
    for (const p of people) {
      if (p.x < R.camX - 80 || p.x > R.camX + W + 80) continue;
      const oi = orderOf(p), by = p.y - 50 - Math.sin(p.jump * Math.PI) * 10;
      if (oi >= 0 && p.mode !== 'dance') {
        const o = c.ord[oi], ok = c.stock[o.item] >= o.qty, sel = R.sel === oi, bob = Math.sin(t * 3 + p.rec.lot) * 2;
        bubble(p.x, by + bob, 86, 36, sel ? C.goldL : ok ? '#E9F5D2' : C.cream);
        blit(ICON[o.item], p.x - 24, by + bob - 9, 3);
        txt('×' + U.fmt(o.qty), p.x + 12, by + bob - 18, T(16, INK));
        if (o.hearts > 1) blit(ICON.heart, p.x + 38, by + bob - 26, 2);
      } else if (p.chatT > 0 && p.chat) {
        g.font = '900 14px system-ui, sans-serif';
        const w = Math.min(260, g.measureText(p.chat).width + 20);
        bubble(p.x, by, w, 26, C.cream);
        txt(p.chat, p.x, by - 13, T(14, INK));
      }
    }
  }

  /* ---- HUD em canvas (botões imediatos, como a Fábrica) ---- */
  let btns = [], pressBtn = null;
  const hit = (x, y, w, h, fn) => btns.push({ x, y, w, h, fn });
  function card(x, y, w, h, fill) {
    g.fillStyle = INK; D.rrect(g, x - 2, y - 2, w + 4, h + 6, 10); g.fill();
    g.fillStyle = fill || C.cream; D.rrect(g, x, y, w, h, 8); g.fill();
  }
  function button(x, y, w, h, label, fn, o) {
    o = o || {};
    const pressed = pressBtn && pressBtn.x === x && pressBtn.y === y, dy = pressed ? 2 : 0;
    g.fillStyle = INK; D.rrect(g, x - 2, y - 2, w + 4, h + 6, 9); g.fill();
    g.fillStyle = o.on ? C.gold : o.off ? '#E8DCC0' : (o.fill || C.cream); D.rrect(g, x, y + dy, w, h, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; D.rrect(g, x + 3, y + 2 + dy, w - 6, 4, 2); g.fill();
    const col = o.off ? '#7a6a56' : INK;
    if (o.sub) { txt(label, x + w / 2, y + h / 2 - 8 + dy, T(o.size || 15, col)); txt(o.sub, x + w / 2, y + h / 2 + 10 + dy, T(o.subSize || 13, o.off ? '#7a6a56' : '#6B4A2E')); }
    else txt(label, x + w / 2, y + h / 2 + 1 + dy, T(o.size || 15, col));
    if (fn) hit(x, y, w, h, fn);
  }
  function bar(x, y, w, h, k, col, bg) {
    g.fillStyle = INK; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = bg || C.riceS; g.fillRect(x, y, w, h);
    g.fillStyle = col; g.fillRect(x, y, Math.round(w * U.clamp(k, 0, 1)), h);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, Math.round(w * U.clamp(k, 0, 1)), 2);
  }
  function drawTopBar() {
    const c = P();
    g.fillStyle = INK; g.fillRect(0, 0, W, 54);
    g.fillStyle = '#4A3020'; g.fillRect(0, 0, W, 51);
    g.fillStyle = C.gold; g.fillRect(0, 51, W, 3);
    button(8, 6, 120, 38, '← Montanha', close, { fill: '#F6B6B0', size: 16 });
    card(140, 6, 140, 38);
    blit(ICON.yen, 158, 35, 3);
    txt(U.fmt(Math.floor(GS().money)), 176, 26, T(18, INK, 'left'));
    card(292, 6, 340, 38, '#FFF3D6');
    txt('Despensa', 302, 26, T(14, '#8A6A4A', 'left'));
    ITEM_IDS.forEach((k, i) => {
      const x = 384 + i * 82, v = c.stock[k], cp = cap(k);
      blit(ICON[k], x + 10, 33, 3);
      txt(U.fmt(Math.floor(v)), x + 26, 19, T(15, INK, 'left'));
      bar(x + 26, 30, 50, 7, v / cp, v >= cp ? C.ora : C.grass);
    });
    R.heartPulse = Math.max(0, R.heartPulse - 0.04);
    card(644, 6, 112, 38);
    blit(ICON.heart, 664, 36 + R.heartPulse * 2, 3 + R.heartPulse);
    txt(U.fmt(c.hearts), 682, 26, T(18, C.redD, 'left'));
    const se = season();
    card(768, 6, 184, 38, '#FFF3D6');
    blit(ICON[SEASON_ICON[c.season]], 786, 36, 3);
    txt(se.nome, 804, 18, T(15, INK, 'left'));
    txt('Coração +' + c.grains + '% renda', 804, 35, T(13, '#8A6A4A', 'left'));
  }
  function drawOrders(t) {
    const c = P();
    g.fillStyle = INK; g.fillRect(0, BOT, W, H - BOT);
    g.fillStyle = '#5A3A22'; g.fillRect(0, BOT + 3, W, H - BOT);
    for (let x = 0; x < W; x += 40) { g.fillStyle = '#4E3220'; g.fillRect(x, BOT + 3, 2, H - BOT); }
    for (let i = 0; i < 3; i++) {
      const x = 8 + i * 236, y = BOT + 8, w = 226, h = 74, o = c.ord[i];
      if (!o) {
        card(x, y, w, h, '#E8DCC0');
        txt('novo pedido em ' + Math.max(1, Math.ceil(c.gap[i])) + ' s', x + w / 2, y + h / 2, T(15, '#7a6a56'));
        continue;
      }
      const p = byId(o.id); if (!p) { c.ord[i] = null; continue; }
      const sel = R.sel === i, ok = c.stock[o.item] >= o.qty;
      card(x, y, w, h, sel ? '#FFF1BF' : C.cream);
      hit(x, y, w - 90, h, () => { R.sel = R.sel === i ? -1 : i; R.camT = U.clamp(p.x - W / 2, 0, world() - W); p.jump = 1; sfx('click'); });
      g.fillStyle = INK; D.rrect(g, x + 6, y + 6, 58, 62, 8); g.fill();
      g.fillStyle = sel ? C.goldL : '#F6E4C4'; D.rrect(g, x + 8, y + 8, 54, 58, 6); g.fill();
      g.save(); D.rrect(g, x + 8, y + 8, 54, 58, 6); g.clip();
      E.drawShibaHead(g, x + 35, y + 40, t + i, { scale: 1.25, expr: ok ? 'happy' : 'normal', pal: p.def.pal, hat: p.def.hat });
      g.restore();
      txt(p.def.nome, x + 70, y + 17, T(15, INK, 'left'));
      blit(ICON[o.item], x + 82, y + 46, 3);
      txt('×' + U.fmt(o.qty), x + 96, y + 38, T(17, INK, 'left'));
      for (let k = 0; k < Math.min(4, o.hearts); k++) blit(ICON.heart, x + 78 + k * 16, y + 70, 2);
      const have = Math.min(o.qty, Math.floor(c.stock[o.item]));
      if (ok) button(x + w - 84, y + 14, 76, 46, 'Entregar', () => deliver(i), { on: true, size: 15, sub: '+¥' + U.fmt(orderPay(o)), subSize: 13 });
      else {
        button(x + w - 84, y + 14, 76, 46, U.fmt(have) + '/' + U.fmt(o.qty), () => { R.sel = i; toast('A fábrica tá fazendo: faltam ' + U.fmt(o.qty - have) + ' ' + CFG.ITEMS[o.item].plural + ' na despensa'); sfx('click'); }, { off: true, size: 15, sub: 'fazendo…', subSize: 13 });
        bar(x + w - 80, y + 64, 68, 5, have / o.qty, C.grass);
      }
    }
    const x = 716, y = BOT + 8, w = 236, h = 74, se = season(), full = c.fest >= CFG.FEST_NEED;
    card(x, y, w, h, full ? '#FFE9B0' : '#FFF3D6');
    blit(ICON[SEASON_ICON[c.season]], x + 22, y + 32, 4);
    if (c.festOn > 0) {
      txt('Festival ' + se.fest, x + 44, y + 18, T(16, C.redD, 'left'));
      txt('corações ×2 nos pedidos', x + 44, y + 38, T(13, '#6B4A2E', 'left'));
      bar(x + 44, y + 54, w - 56, 8, c.festOn / CFG.FEST_SEC, C.red);
    } else if (full) {
      button(x + 44, y + 10, w - 54, 54, 'Começar o ' + se.fest + '!', startFest, { on: true, size: 16, sub: 'quando você quiser', subSize: 13 });
    } else {
      txt('Festival ' + se.fest, x + 44, y + 18, T(16, INK, 'left'));
      txt(Math.floor(c.fest) + ' de ' + CFG.FEST_NEED + ' corações', x + 44, y + 37, T(13, '#6B4A2E', 'left'));
      bar(x + 44, y + 52, w - 56, 10, c.fest / CFG.FEST_NEED, C.sakuraD);
    }
  }
  function drawChoice(t) {
    const ch = R.choice; if (!ch) return;
    const p = byId(ch.id); if (!p) { R.choice = null; return; }
    g.fillStyle = 'rgba(42,26,16,.55)'; g.fillRect(0, 0, W, H);
    const opts = ch.opts, w = opts.length ? 640 : 520, h = opts.length ? 340 : 170, x = (W - w) / 2, y = opts.length ? 84 : 170;
    card(x, y, w, h, '#FFF3D6');
    g.fillStyle = INK; D.rrect(g, x + 16, y + 14, 72, 72, 10); g.fill();
    g.fillStyle = C.goldL; D.rrect(g, x + 18, y + 16, 68, 68, 8); g.fill();
    g.save(); D.rrect(g, x + 18, y + 16, 68, 68, 8); g.clip();
    E.drawShibaHead(g, x + 52, y + 54, t, { scale: 1.6, expr: 'love', pal: p.def.pal, hat: p.def.hat }); g.restore();
    txt(p.def.nome + ': amizade nível ' + ch.lv + '!', x + 100, y + 34, T(21, INK, 'left'));
    txt('+1 grão no Arroz do Coração (renda +1%)', x + 100, y + 58, T(14, C.redD, 'left'));
    if (!opts.length) {
      txt(freeLots().length ? 'Todos os prédios já estão na rua!' : 'Sem terreno livre: a casa ganhou flores.', x + 100, y + 80, T(14, '#6B4A2E', 'left'));
      button(x + w / 2 - 70, y + h - 54, 140, 40, 'Oba!', () => { R.choice = null; sfx('click'); }, { on: true, size: 16 });
      hit(0, 0, W, H, () => {});
      return;
    }
    txt('"Kome, dá pra gente construir uma coisa na rua?"', x + 100, y + 79, T(14, '#6B4A2E', 'left'));
    opts.forEach((id, i) => {
      const B = BUILD[id], bx = x + 20 + i * 306, by = y + 104, bw = 294, bh = 220;
      card(bx, by, bw, bh, C.cream);
      g.fillStyle = '#CFE8F2'; g.fillRect(bx + 10, by + 10, bw - 20, 108);
      g.fillStyle = season().grass; g.fillRect(bx + 10, by + 100, bw - 20, 18);
      drawArt(B.art, bx + bw / 2, by + 112, B.art === 'cid_templo' ? 1.1 : 1.6, t);
      txt(B.nome, bx + bw / 2, by + 138, T(18));
      txt(B.fx, bx + bw / 2, by + 160, T(13, '#6B4A2E'));
      button(bx + 40, by + 176, bw - 80, 36, 'Construir', () => { choose(id); sfx('click'); }, { on: true, size: 16 });
    });
    hit(0, 0, W, H, () => {});      // modal: engole o resto
  }
  function drawHeartsFly(dt) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]; h.t += dt;
      if (h.t < 0) continue;
      const k = Math.min(1, h.t / 0.8), sx = h.wx - R.camX, sy = h.wy;
      blit(ICON.heart, U.lerp(sx, 664, k * k), U.lerp(sy, 26, k) - Math.sin(k * Math.PI) * 60 + 8, 3);
      if (k >= 1) { hearts.splice(i, 1); R.heartPulse = 1; sfx('pop', { pitch: 1.6, vol: 0.3 }); }
    }
  }
  function drawHint(t) {
    if (!R.hint || R.choice) return;
    const i = P().ord.findIndex((o, k) => o && canDeliver(k)); if (i < 0) return;
    const x = 8 + i * 236 + 226 - 46, y = BOT - 6 + Math.sin(t * 6) * 4;
    g.fillStyle = INK; g.beginPath(); g.moveTo(x - 10, y - 14); g.lineTo(x + 10, y - 14); g.lineTo(x, y); g.closePath(); g.fill();
    g.fillStyle = C.gold; g.beginPath(); g.moveTo(x - 7, y - 12); g.lineTo(x + 7, y - 12); g.lineTo(x, y - 3); g.closePath(); g.fill();
    g.fillStyle = 'rgba(42,26,16,.85)'; D.rrect(g, x - 170, y - 48, 196, 28, 8); g.fill();
    txt('a despensa tem! toque Entregar', x - 72, y - 34, T(14, C.cream));
  }
  function drawEdges(t) {
    const a = 0.6 + Math.sin(t * 4) * 0.25;
    g.globalAlpha = a;
    if (R.camX > 10) txt('◀', 18, 290, TS(24));
    if (R.camX < world() - W - 10) txt('▶', W - 18, 290, TS(24));
    g.globalAlpha = 1;
  }
  function drawNotes(dt) {
    if (R.banner) {
      const b = R.banner; b.life -= dt;
      const a = Math.min(1, b.life * 2, (3.6 - b.life) * 4);
      g.globalAlpha = Math.max(0, a);
      g.font = '900 22px system-ui, sans-serif'; const w = Math.max(360, Math.min(900, g.measureText(b.t).width + 60));
      card(W / 2 - w / 2, 82, w, b.sub ? 70 : 48, '#FFE9B0');
      txt(b.t, W / 2, 106, T(22, INK)); if (b.sub) txt(b.sub, W / 2, 132, T(14, '#6B4A2E'));
      g.globalAlpha = 1;
      if (b.life <= 0) R.banner = null;
    }
    if (R.toast) {
      const o = R.toast; o.life -= dt;
      g.globalAlpha = Math.max(0, Math.min(1, o.life * 2));
      g.font = '900 15px system-ui, sans-serif'; const w = Math.min(920, g.measureText(o.t).width + 36);
      card(W / 2 - w / 2, BOT - 50, w, 34, o.tone === 'bad' ? '#F6C8C0' : o.tone === 'gold' ? '#FFE9B0' : C.cream);
      txt(o.t, W / 2, BOT - 33, T(15, INK));
      g.globalAlpha = 1;
      if (o.life <= 0) R.toast = null;
    }
  }

  /* ---- entrada: arrastar passeia pela rua, toque seleciona ---- */
  let drag = null;
  input.on('down', (x, y) => {
    if (!isOpen()) return;
    const b = btns.slice().reverse().find(b => x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 3 && y <= b.y + b.h + 6);
    drag = { x, y, cam: R.camX, moved: false, b };
    if (b && b.w < W) pressBtn = { x: b.x, y: b.y };
  });
  input.on('move', (x, y) => {
    if (!drag || !isOpen()) return;
    if (Math.abs(x - drag.x) > 8) drag.moved = true;
    if (drag.moved && !R.choice && drag.y > 54 && drag.y < BOT) { R.camX = U.clamp(drag.cam - (x - drag.x), 0, world() - W); R.camT = null; }
  });
  input.on('up', (x, y) => {
    const d = drag; drag = null; pressBtn = null;
    if (!d || !isOpen()) return;
    if (d.b && (!d.moved || d.b.w < W)) { if (!d.moved) d.b.fn(); return; }
    if (d.moved || y < 54 || y >= BOT) return;
    const wx = x + R.camX;
    const p = people.slice().sort((a, b) => b.y - a.y).find(p => Math.abs(p.x - wx) < 24 && y > p.y - 70 && y < p.y + 8);
    if (p) {
      const oi = orderOf(p);
      p.jump = 1; sfx('yip', { vol: 0.4 });
      if (oi >= 0) R.sel = oi; else chat(p, p.def.fala[Math.floor(Math.random() * p.def.fala.length)], 2.6);
      toast(p.def.nome + ' · ' + p.def.job + ' · ama ' + CFG.ITEMS[p.def.fav].nome + ' · amizade nv ' + p.rec.lv + ' (' + p.rec.h + '/' + lvNeed(p.rec.lv) + ' ♥)');
      return;
    }
    if (wx < 360 && y < BASE + 10) { if (G.Fab && G.Fab.on && G.Fab.on()) { close(); G.Fab.open(); } return; }
    const L = lots.find(l => Math.abs(l.x - wx) < 76 && y < BASE + 6 && y > BASE - 110);
    if (L && L.i < nOpen()) {
      const r = L.rec, res = resOn(L.i);
      if (r.b) toast(BUILD[r.b].nome + ': ' + BUILD[r.b].fx);
      else if (r.obra) toast('Obra: ' + BUILD[r.ob].nome + ' fica pronta em ' + U.fmtTime(Math.ceil(r.obra)));
      else if (res) toast('Casa de ' + res.def.nome);
      else toast('Terreno livre: abre quando um morador sobe de amizade');
      L.bounce = 1; sfx('click');
    }
  });
  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { if (R.choice && !R.choice.opts.length) R.choice = null; else if (!R.choice) close(); }
    if (e.key === 'ArrowLeft' || e.key === 'a') R.camT = U.clamp(R.camX - 300, 0, world() - W);
    if (e.key === 'ArrowRight' || e.key === 'd') R.camT = U.clamp(R.camX + 300, 0, world() - W);
  });

  /* ---- quadro ---- */
  let lastT = 0, raf = 0;
  function frame() {
    if (!isOpen()) { raf = 0; return; }
    const now = performance.now() / 1000, dt = Math.min(0.05, lastT ? now - lastT : 0.016); lastT = now;
    R.t += dt;
    const c = P();
    if (!R.choice && c.pend.length && !obraOn()) { R.choice = nextChoice(); if (R.choice) sfx('levelup'); }
    if (R.camT !== null) { R.camX += (R.camT - R.camX) * Math.min(1, dt * 4); if (Math.abs(R.camT - R.camX) < 1) R.camT = null; }
    R.camX = U.clamp(R.camX, 0, world() - W);
    ps.update(dt); fl.update(dt);
    if (clouds) clouds.update(dt); if (birds) birds.update(dt); if (ff) ff.update(dt);
    const vx0 = R.camX, vx1 = R.camX + W;
    if (c.season === 0 && N.sakuraPetals) N.sakuraPetals(ps, { x0: vx0, x1: vx1, y0: 60, y1: 440 }, dt, 3);
    if (c.season === 2 && Math.random() < dt * 3) ps.add({ x: U.rnd(vx0, vx1), y: 60, vx: U.rnd(-20, 20), vy: 20, g: 12, life: 6, shape: 'leaf', w: 6, c: [C.ora, C.red, C.gold][Math.floor(Math.random() * 3)], sway: 2, vr: 2, fade: 0.3 });
    if (c.season === 3 && Math.random() < dt * 14) ps.add({ x: U.rnd(vx0, vx1), y: 56, vx: U.rnd(-10, 10), vy: 30, g: 4, life: 9, shape: 'dot', w: U.rnd(2, 4), c: C.white, sway: 1.5, fade: 0.2 });
    if (c.festOn > 0 && Math.random() < dt * 1.1) firework();
    if (Math.random() < dt * 0.22) {   // conversa à toa (um morador por vez)
      const vis = people.filter(p => p.x > R.camX + 40 && p.x < R.camX + W - 40 && p.chatT <= 0 && p.mode !== 'dance');
      if (vis.length) { const p = vis[Math.floor(Math.random() * vis.length)]; chat(p, p.def.fala[Math.floor(Math.random() * p.def.fala.length)], 3); }
    }
    render(dt);
    raf = requestAnimationFrame(frame);
  }
  function firework() {
    const x = R.camX + U.rnd(120, W - 120), y = U.rnd(70, 140);
    const cols = [[C.gold, C.goldL], [C.sakura, C.red], [C.waterL, C.cream], [C.grassL, C.goldL]][Math.floor(Math.random() * 4)];
    ps.burst(x, y, 34, { c: cols, shape: 'spark', speed: [70, 190], life: [0.7, 1.3], g: 50, drag: 1.2 });
    if (ps.sparkle) ps.sparkle(x, y, 6, { c: C.cream, r: 30 });
    sfx('boom', { vol: 0.25, pitch: U.rnd(0.8, 1.2) });
  }
  function render(dt) {
    const t = performance.now() / 1000;
    btns = []; drawList = [];
    g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    drawSky(t);
    g.save(); g.translate(-Math.round(R.camX), 0);
    drawGroundBack(t); drawStreet();
    lotDrawables(t); propDrawables(t); personDrawables(t);
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) d.fn();
    streetLanterns(t);
    ps.draw(g);
    g.restore();
    if (N.grade) N.grade(g, W, BOT, { tod: tod(), horizon: 216, strength: 0.8 });
    if (ff && night() > 0.5) { g.save(); g.translate(-Math.round(R.camX), 0); ff.draw(g, night()); g.restore(); }
    g.save(); g.translate(-Math.round(R.camX), 0); drawBubbles(t); fl.draw(g); g.restore();
    drawEdges(t); drawTopBar(); drawOrders(t); drawHint(t); drawHeartsFly(dt); drawNotes(dt); drawChoice(t);
  }

  /* ---- abrir / fechar ---- */
  function isOpen() { return root.classList.contains('k-city-open'); }
  function open() {
    if (!GS() || !P().on || (api.fast && api.fast())) return false;
    if (lots.length !== NL) rebuild();
    for (const p of people) { const L = lots[p.rec.lot] || lots[0]; p.x = L.x + U.rnd(-40, 40); p.y = U.rnd(ROAD0 + 12, ROAD1 - 10); p.tx = p.x; p.ty = p.y; p.mode = 'idle'; }
    kome.x = DEPOT.x; kome.y = DEPOT.y; kome.state = 'park'; kome.job = null;
    root.classList.add('k-city-open'); stage.resize(); lastT = 0;
    const o = P().ord.find(Boolean), op = o && byId(o.id);
    R.camX = U.clamp(op ? op.x - W / 2 : 90, 0, world() - W); R.camT = null;
    if (!raf) raf = requestAnimationFrame(frame);
    sfx('whoosh');
    return true;
  }
  function close() {
    if (!isOpen()) return;
    root.classList.remove('k-city-open'); drag = null; R.sel = -1;
    if (R.choice) { P().pend.unshift({ id: R.choice.id, lv: R.choice.lv }); R.choice = null; }   // escolha fica guardada pra próxima vez
    for (const o of P().q.slice()) arrive(o);
    kome.job = null; hearts.length = 0;
    if (api.save) api.save();
  }

  /* ---- jogador guloso (tools/longo.js, modo acelerado): entrega o que dá, começa o festival, escolhe a 1ª obra ---- */
  const sim = {
    act() {
      const c = P(); R.news.length = 0; if (!c.on) return [];
      for (let i = 0; i < 3; i++) if (canDeliver(i)) deliver(i);
      if (c.fest >= CFG.FEST_NEED) startFest();
      const ch = nextChoice(); if (ch) { R.choice = ch; choose(ch.opts[0]); }
      return R.news.splice(0);
    },
    news: () => R.news.splice(0),
  };

  G.City = {
    init(a) {
      api = a || {};
      P(); if (P().on) rebuild();
      if (G.Sim) G.Sim.add('cidade', { tick, offline });
      // tempo fora: o game.js calcula antes de a Cidade se registrar (igual à Fábrica), então ela anda aqui
      const aw = GS().away;
      if (/[?&]cidade=(\w+)/.test(location.search) && /[?&]dev\b/.test(location.search)) setTimeout(() => G.City.demo(RegExp.$1), 1200);
      if (aw && aw.sec > 5 && P().on) { const r = offline(aw.sec); if (aw.res) aw.res.cidade = r; if (r && (r.yen > 0 || r.built > 0) && api.toast) api.toast('Enquanto você estava fora', 'Cidade: as lojas venderam ¥' + U.fmt(r.yen) + (r.built ? ' · ' + r.built + ' obra(s) terminaram' : '')); }
    },
    // toque na Vila (game.js): na rua da Cidade (torii até o último lote) entra nela
    tapVila(wx) { const X = G.World && G.World.X; if (!X || !X.cid0 || !GS() || !P().on || wx < X.cid0 - 330 || wx > X.cid1 + 40) return false; return open(); },
    take, open, close, isOpen, on: () => !!(GS() && P().on), unlock,
    grains: () => (GS() && GS().stats.city && GS().stats.city.grains) | 0,
    // o que a Vila (game-world.js) desenha: arte de cada lote aberto, obra (0..1) e quem mora
    view() {
      const c = GS() && GS().stats.city; if (!c || !c.on) return null;
      if (lots.length !== NL) rebuild();
      const out = [], n = nOpen();
      for (let i = 0; i < n; i++) { const r = c.lots[i], res = resOn(i); out.push({ art: r.b ? BUILD[r.b].art : res ? res.def.art : null, obra: r.obra ? 1 - r.obra / (r.tot || 1) : 0, pal: res ? res.def.pal : null, b: r.b, lv: res ? res.rec.lv : 0 }); }
      return { lots: out, fest: c.festOn > 0, season: c.season, ready: c.ord.some((o, i) => o && canDeliver(i)) };
    },
    sim,
    // demo (?dev&cidade=demo e tools/sweep.js): rua já andando — 3 prédios prontos, 1 obra, pedidos, despensa cheia
    demo(cena) {
      const c = P(); if (!c.on) unlock();
      ['kiku', 'yuki', 'momo'].forEach(id => { G.City.levelUp(id); G.City.choose(); G.City.step(3000); });
      G.City.levelUp('taro'); G.City.choose();
      for (const k of ITEM_IDS) { c.rate[k] = k === 'mochid' ? 0.01 : k === 'mochi' ? 0.1 : 0.2; c.stock[k] = cap(k) * 0.8; }
      c.ord = [null, null, null]; c.gap = [0, 0, 0]; G.City.step(1); c.hearts += 40; c.fest = cena === 'festa' ? CFG.FEST_NEED : 90;
      if (cena === 'festa') { open(); startFest(); } else if (cena === 'escolha') { G.City.levelUp('hana'); c.lots.forEach(l => { if (l.obra) l.obra = 0.01; }); G.City.step(0.1); open(); } else open();
      return G.City.state;
    },
    deliver, startFest, choose: id => { if (!R.choice) R.choice = nextChoice(); if (R.choice) choose(id || R.choice.opts[0]); },
    levelUp(id) { const p = byId(id); if (p) addHearts(p, lvNeed(p.rec.lv) - p.rec.h); },
    step(sec) { let l = sec; while (l > 1e-6) { const st = Math.min(l, 1 / 20); logic(st); l -= st; } return G.City.state; },
    get state() {
      const c = GS() && GS().stats.city; if (!c) return null;
      return { on: !!c.on, t: Math.round(c.t), yen: Math.round(c.yen), hearts: c.hearts, grains: c.grains, fest: Math.floor(c.fest), season: (SEASONS[c.season] || {}).nome, delivered: c.delivered,
        stock: Object.fromEntries(ITEM_IDS.map(k => [k, Math.floor(c.stock[k] || 0)])), rate: Object.fromEntries(ITEM_IDS.map(k => [k, +(c.rate[k] || 0).toFixed(3)])),
        orders: c.ord.map(o => o && { quem: o.id, item: o.item, qty: o.qty, hearts: o.hearts }), people: c.ppl.map(p => p.id + ':' + p.lv), lots: (c.lots || []).map(l => l.b || (l.obra ? 'obra' : '-')).join(' '), blk2: !!c.blk2, pend: c.pend.length };
    },
  };
})();
