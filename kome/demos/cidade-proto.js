/* Kome no Japão · protótipo jogável da CIDADE (docs/design/cidade.md, camada 4)
   Página solta (demos/cidade.html). Não está ligada ao jogo: a produção vem de uma fábrica simulada (canto esquerdo da rua).
   Loop: a fábrica enche a Despensa → moradores pedem (balão + cartão embaixo) → "Entregar" manda o kei-truck do Kome →
   corações → amizade sobe → você escolhe 1 de 2 construções pra um terreno → obra → prédio novo na rua. Corações também
   enchem o Festival da estação: quando enche, VOCÊ escolhe a hora de começar (noite, lanternas, bon-odori, fogos).
   Arte: casas/lojas/kei-truck/props por receita (conteudo/estrutura-cid_*.js) · céu, árvores, barracas, obra: E.Nature ·
   moradores: E.drawShiba. Números todos no bloco CFG logo abaixo (no jogo vão pra game/data.js como D.CITY).
   Console: __cidade.step(seg) · deliver(i) · fest() · levelUp(id) · state · money(v) */
(function () {
  'use strict';
  const E = Pixxel, U = E.U, C = E.PAL, D = E.Draw, N = E.Nature, A = E.Assets;
  const W = 960, H = 540, INK = '#3B2818';
  const Q = new URLSearchParams(location.search);
  const stage = E.Stage({ width: W, height: H, bg: '#2a1a10' });
  const g = stage.g;
  const UI = E.UI; UI.mount(stage);
  const input = E.Input(stage);
  const ps = E.Particles(1400), fl = E.Floaters(160);

  /* ======================================================================
     CFG — números da ficha (no jogo: D.CITY em game/data.js). Tempos do protótipo são ~1/6 dos do jogo (ver spec).
     ====================================================================== */
  const CFG = {
    V: 10,                                   // ¥ de 1 saco cru (escala)
    ITEMS: {
      onigiri: { nome: 'onigiri', plural: 'onigiris', val: 4, cap: 220 },
      mochi:   { nome: 'mochi', plural: 'mochis', val: 10, cap: 80 },
      bento:   { nome: 'bentô', plural: 'bentôs', val: 40, cap: 26 },
    },
    FOCO: {                                  // o que a fábrica faz (itens/s). Mudar o foco = a decisão de rota
      equi:    { nome: 'Equilibrado', r: { onigiri: 1.2, mochi: 0.40, bento: 0.12 } },
      onigiri: { nome: 'Mais onigiri', r: { onigiri: 2.4, mochi: 0.18, bento: 0.05 } },
      mochi:   { nome: 'Mais mochi', r: { onigiri: 0.6, mochi: 0.80, bento: 0.05 } },
      bento:   { nome: 'Mais bentô', r: { onigiri: 0.6, mochi: 0.18, bento: 0.26 } },
    },
    ORDER_SEC: [35, 65],                     // pedido = N segundos da produção "equilibrada" daquele item
    ORDER_PAY: 2,                            // pedido paga 2× o valor de venda
    ORDER_GAP: 7,                            // s até o próximo pedido chegar numa vaga vazia (sentô: metade)
    FAV_CHANCE: 0.6,                         // chance do pedido ser do prato favorito (vale ♥♥)
    HEART_LV: [3, 4, 5, 6, 7, 8],            // corações pra cada nível de amizade
    BUILD_SEC: 6,                            // obra
    FEST_NEED: 14,                           // corações pra encher o festival
    FEST_SEC: 32,                            // duração do festival
    FEST_HEART: 2,                           // pedidos valem ×2 corações durante o festival
    SHOP_EVERY: 1.6,                         // loja compra 1 item a cada N s, só do que passa de 55% da despensa
    SHOP_LINE: 0.55, SHOP_PAY: 1.5,
    TRUCK_SPEED: 300,
  };
  const ITEM_IDS = ['onigiri', 'mochi', 'bento'];

  /* moradores: nome, cara (paleta do shiba), gosto, frase. Os 2 últimos se mudam por construção */
  const RES = [
    { id: 'kiku',   nome: 'Vó Kiku',   pal: 'goma',   hat: false, fav: 'mochi',   lot: 0, art: 'cid_casa_kiku',
      job: 'aposentada, rainha do karaokê', fala: ['No meu tempo o mochi era batido na mão!', 'Kome, tá comendo direito?', 'Hoje tem karaokê, hein.'], build: ['chaya', 'mochiya'] },
    { id: 'taro',   nome: 'Taro',      pal: 'aka',    hat: true,  fav: 'onigiri', lot: 1, art: 'cid_casa_taro',
      job: 'entregador de bicicleta', fala: ['Pedalei 40 km hoje. Fome.', 'Onigiri é combustível.', 'Corrida até a praça?'], build: ['onigiriya', 'sento'] },
    { id: 'hana',   nome: 'Hana',      pal: 'sakura', hat: false, fav: 'bento',   lot: 3, art: 'cid_casa_hana',
      job: 'florista, planeja piqueniques', fala: ['As cerejeiras vão abrir!', 'Piquenique sem bentô não existe.', 'Trouxe flores pra rua.'], build: ['casa_kuro', 'chaya'] },
    { id: 'genji',  nome: 'Sr. Genji', pal: 'sumi',   hat: true,  fav: 'bento',   lot: 4, art: 'cid_casa_genji',
      job: 'pescador (o peixe sempre cresce na história)', fala: ['Pesquei um atum DESTE tamanho.', 'Bentô bom é bentô pesado.', 'O mar tá calmo hoje.'], build: ['bentoya', 'templo'] },
    { id: 'yuki',   nome: 'Yuki',      pal: 'yuki',   hat: false, fav: 'onigiri', lot: 6, art: 'cid_casa_yuki',
      job: 'streamer, joga até as 4 da manhã', fala: ['Live de 12 horas, preciso de onigiri.', 'GG, Kome.', 'Bati meu recorde de speedrun!'], build: ['fliperama', 'konbini'] },
    { id: 'momo',   nome: 'Momo',      pal: 'momo',   hat: false, fav: 'mochi',   lot: 7, art: 'cid_casa_momo',
      job: 'confeiteira perfeccionista', fala: ['Esse mochi tá 2% fora do ponto.', 'Sonho com uma loja só minha.', 'Doce é ciência.'], build: ['mochiya', 'casa_kuro'] },
    { id: 'kuro',   nome: 'Kuro',      pal: 'kuro',   hat: false, fav: 'onigiri', lot: -1, art: 'cid_casa_kuro',
      job: 'músico de rua', fala: ['Compus uma música pro onigiri.', 'Toco na praça no festival!', 'A rua tem ritmo.'], build: ['fliperama', 'sento'] },
    { id: 'matcha', nome: 'Monge Matcha', pal: 'matcha', hat: true, fav: 'bento', lot: -1, art: 'cid_templo',
      job: 'monge do templo, ri de tudo', fala: ['Paz, Kome. E bentô.', 'O sino toca no festival.', 'Respira... e come.'], build: ['templo', 'bentoya'] },
  ];
  /* construções que a amizade abre (1 de 2 por nível) */
  const BUILD = {
    onigiriya: { nome: 'Onigiri-ya', art: 'lojinha_onigiri', loja: ['onigiri'], fx: 'compra onigiri que sobra: ¥ fixo' },
    mochiya:   { nome: 'Mochiya', art: 'loja_mochiya', loja: ['mochi'], fx: 'compra mochi que sobra: ¥ fixo' },
    bentoya:   { nome: 'Bentô-ya', art: 'cid_bentoya', loja: ['bento'], fx: 'compra bentô que sobra: ¥ fixo' },
    konbini:   { nome: 'Konbini', art: 'loja_konbini', loja: ITEM_IDS, fx: 'compra um pouco de tudo que sobra' },
    chaya:     { nome: 'Casa de Chá', art: 'cid_chaya', heart: 'mochi', fx: 'pedidos de mochi: +1 coração' },
    fliperama: { nome: 'Fliperama', art: 'cid_fliperama', heart: 'onigiri', fx: 'pedidos de onigiri: +1 coração' },
    sento:     { nome: 'Sentô', art: 'cid_sento', fx: 'pedidos novos chegam 2× mais rápido' },
    casa_kuro: { nome: 'Casa nova', art: 'cid_casa_kuro', mora: 'kuro', fx: 'Kuro, músico de rua, se muda' },
    templo:    { nome: 'Templo', art: 'cid_templo', mora: 'matcha', fx: 'Monge Matcha se muda · festival enche 50% mais rápido' },
  };
  const SEASONS = [
    { nome: 'Primavera', fest: 'Hanami', tree: 'sakura', grass: '#8FAE62', sub: 'piquenique debaixo das cerejeiras' },
    { nome: 'Verão', fest: 'Hanabi', tree: 'round', grass: '#7F9E5C', sub: 'fogos de artifício na praça' },
    { nome: 'Outono', fest: 'Tsukimi', tree: 'maple', grass: '#B39A5A', sub: 'lua cheia e colheita' },
    { nome: 'Inverno', fest: 'Shōgatsu', tree: 'pine', grass: '#DCE4E8', sub: 'ano-novo com mochitsuki' },
  ];

  /* ======================================================================
     Mundo (rua 3/4 que rola de lado, como a Vila do jogo)
     ====================================================================== */
  const WORLD = 2150, BASE = 262, ROAD0 = 276, ROAD1 = 338, FRONT = 350, BOT = 452;
  const LOT_X0 = 470, LOT_W = 168, NLOT = 10, SC = 2;
  const PRACA = { x0: 1060, x1: 1460, cx: 1270 };
  const lots = [];
  for (let i = 0; i < NLOT; i++) lots.push({ i, x: LOT_X0 + i * LOT_W, b: null, res: null, obra: 0, pop: 0, bounce: 0, shopT: 0 });
  const DEPOT = { x: 300, y: ROAD1 - 12 };

  /* ======================================================================
     Estado
     ====================================================================== */
  const rng = E.RNG(11);
  const S = {
    money: 0, t: 0, speed: 1, muted: false, fast: false,
    foco: 'equi', stock: { onigiri: 40, mochi: 14, bento: 4 }, made: { onigiri: 0, mochi: 0, bento: 0 },
    hearts: 0, fest: 0, festOn: 0, season: 0, festDone: 0,
    orders: [null, null, null], gap: [1.5, 3.5, 6], sel: -1,
    choice: null, overAcc: 0, overT: 0, camX: 90, camT: null, hint: 1, delivered: 0, firstDeliver: -1,
    log: [],
  };
  const people = [];
  function addPerson(def, lot) {
    const L = lots[lot];
    const p = { def, lot, x: L.x + U.rnd(-30, 30), y: U.rnd(ROAD0 + 12, ROAD1 - 10), tx: 0, ty: 0, face: 1, mode: 'idle', timer: U.rnd(0.5, 3),
      pose: 'sit', hearts: 0, lv: 1, jump: 0, chat: null, chatT: 0, glow: 0, hb: 0 };
    p.tx = p.x; p.ty = p.y;
    L.res = p; people.push(p);
    return p;
  }
  RES.forEach(r => { if (r.lot >= 0) addPerson(r, r.lot); });
  const kome = { x: DEPOT.x, y: DEPOT.y, face: 1, state: 'park', q: [], job: null, t: 0, wait: 0 };

  /* ======================================================================
     Sprites pequenos (ícones de item/coração, mesmos da Fábrica)
     ====================================================================== */
  const XP = { Q: C.mochi, q: C.mochiD };
  const sp = (name, txt) => E.spriteText('cid-' + name, txt, { pal: XP });
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
    bento: sp('bento', `
      RRRRRRRR
      RAAAGOOR
      RAAAGOOR
      rrrrrrrr`),
    heart: sp('heart', `
      .RR.RR.
      RRRRRRR
      RRRRRRr
      .RRRRr.
      ..Rrr..
      ...r...`),
    heartE: sp('hearte', `
      .aa.aa.
      aaaaaaa
      aaaaaaa
      .aaaaa.
      ..aaa..
      ...a...`),
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
  function blit(cv, x, y, s, o) {     // x = centro, y = base
    const w = cv.width * s, h = cv.height * s;
    g.imageSmoothingEnabled = false;
    const a = g.globalAlpha; if (o && o.alpha !== undefined) g.globalAlpha = a * o.alpha;
    g.drawImage(cv, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
    g.globalAlpha = a;
  }
  const txt = (s, x, y, o) => D.text(g, s, x, y, o);
  const T = (size, col, align, extra) => Object.assign({ size, col: col || INK, sw: 0, align: align || 'center', weight: 900 }, extra || {});
  const TS = (size, col, align) => ({ size, col: col || C.cream, sw: 4, align: align || 'center', weight: 900 });

  // quadro de uma arte por receita: dia/noite/fumaça, animada
  function artFrame(id, tag, t) {
    const a = A.get(id); if (!a) return 0;
    const an = a.anims[tag] || a.anims.dia || a.anims.parado || a.anims[Object.keys(a.anims)[0]];
    if (!an) return 0;
    const n = an.to - an.from + 1; return an.from + (n > 1 ? Math.floor(t * 7.5) % n : 0);
  }
  const night = () => S.festOn > 0 ? Math.min(1, (CFG.FEST_SEC - S.festOn) / 2.5, S.festOn / 2.5) : 0;
  function drawArt(id, x, y, s, t, o) {
    const a = A.get(id); if (!a) return;
    let tag = night() > 0.5 ? 'noite' : 'dia';
    if (id === 'cid_sento' && tag === 'dia') tag = 'fumaca';
    if (!a.anims.dia) tag = (o && o.anim) || 'parado';
    A.draw(g, id, artFrame(id, tag, t), x, y, Object.assign({ scale: s }, o || {}));
  }

  /* ======================================================================
     Som
     ====================================================================== */
  const sfxLast = {};
  function sfx(name, o) {
    if (S.muted || S.fast || !E.Sfx || !E.Sfx.has || !E.Sfx.has(name)) return;
    const now = performance.now(); if (sfxLast[name] && now - sfxLast[name] < 90) return; sfxLast[name] = now;
    try { E.Sfx.play(name, o); } catch (e) { /* sem áudio */ }
  }
  const toast = (t, o) => { if (!S.fast) try { UI.toast(t, o); } catch (e) { /* */ } };
  const banner = (t, sub) => { if (!S.fast) try { UI.banner(t, sub, { level: 3 }); } catch (e) { /* */ } };
  const logEv = (tipo, txt) => S.log.push([Math.round(S.t), tipo, txt]);

  /* ======================================================================
     Regras
     ====================================================================== */
  const built = id => lots.some(l => l.b === id);
  const heartBonus = item => lots.filter(l => l.b && BUILD[l.b].heart === item).length;
  const lvNeed = p => CFG.HEART_LV[Math.min(CFG.HEART_LV.length - 1, p.lv - 1)];
  const orderOf = p => S.orders.findIndex(o => o && o.p === p);
  function newOrder(slot) {
    const free = people.filter(p => orderOf(p) < 0 && !(kome.job && kome.job.p === p) && !kome.q.some(j => j.p === p));
    if (!free.length) return false;
    // quem pediu há mais tempo tem preferência (ninguém fica esquecido)
    free.sort((a, b) => (a.lastOrder || 0) - (b.lastOrder || 0));
    const p = free[Math.floor(rng() * Math.min(3, free.length))];
    const item = rng() < CFG.FAV_CHANCE ? p.def.fav : ITEM_IDS[Math.floor(rng() * 3)];
    const sec = U.lerp(CFG.ORDER_SEC[0], CFG.ORDER_SEC[1], rng());
    const qty = Math.max(2, Math.round(CFG.FOCO.equi.r[item] * sec));
    const hearts = (item === p.def.fav ? 2 : 1) + heartBonus(item);
    S.orders[slot] = { p, item, qty, hearts, pay: qty * CFG.ITEMS[item].val * CFG.V * CFG.ORDER_PAY, born: S.t };
    p.lastOrder = S.t; p.jump = 1;
    if (!S.fast) { sfx('pop', { pitch: 1.3, vol: 0.4 }); }
    return true;
  }
  function canDeliver(i) { const o = S.orders[i]; return !!o && S.stock[o.item] >= o.qty; }
  function deliver(i) {
    const o = S.orders[i]; if (!o) return false;
    if (S.stock[o.item] < o.qty) { toast('Falta ' + (o.qty - Math.floor(S.stock[o.item])) + ' ' + CFG.ITEMS[o.item].plural + ' na despensa', { tone: 'bad' }); sfx('error'); return false; }
    S.stock[o.item] -= o.qty;
    S.orders[i] = null; S.gap[i] = CFG.ORDER_GAP * (built('sento') ? 0.5 : 1);
    kome.q.push(o); S.sel = -1; S.hint = 0;
    sfx('buy', { vol: 0.5 }); sfx('whoosh', { vol: 0.3 });
    return true;
  }
  function arrive(o) {                      // o kei-truck chegou no morador
    const p = o.p;
    let h = o.hearts * (S.festOn > 0 ? CFG.FEST_HEART : 1);
    S.money += o.pay; S.delivered++; if (S.firstDeliver < 0) S.firstDeliver = S.t;
    logEv('pedido', p.def.nome + ' ' + o.qty + ' ' + o.item);
    p.mode = 'happy'; p.timer = 1.6; p.jump = 1; p.glow = 1; p.face = kome.x < p.x ? -1 : 1;
    if (!S.fast) {
      fl.add(p.x, p.y - 64, '+¥' + U.fmt(o.pay), { size: 16, c: C.goldL, life: 1.3 });
      ps.burst(p.x, p.y - 30, 10, { c: [C.red, C.redL, C.sakura], shape: 'star', speed: [60, 180], life: 0.8 });
      sfx('kaching', { vol: 0.5 }); sfx('chirin', { vol: 0.4 }); if (rng() < 0.5) sfx('yip', { vol: 0.35 });
      chat(p, ['Valeu, Kome!', 'Itadakimasu!', 'Perfeito!', 'Que cheiro bom!'][Math.floor(rng() * 4)], 1.8);
    }
    for (let k = 0; k < h; k++) flyHeart(p, k * 0.12);
    addHearts(p, h);
  }
  function addHearts(p, h) {
    S.hearts += h;
    S.fest = Math.min(CFG.FEST_NEED, S.fest + h * (built('templo') ? 1.5 : 1) * (S.festOn > 0 ? 0 : 1));
    p.hearts += h;
    while (p.hearts >= lvNeed(p)) { p.hearts -= lvNeed(p); p.lv++; levelUp(p); }
  }
  function freeLot(near) {
    const L = lots.filter(l => !l.b && !l.res && !l.obra);
    if (!L.length) return null;
    L.sort((a, b) => Math.abs(a.x - near) - Math.abs(b.x - near));
    return L[0];
  }
  const pending = [];
  function levelUp(p) {
    logEv('amizade', p.def.nome + ' nv ' + p.lv);
    const opts = [];
    const add = id => { if (opts.length < 2 && !built(id) && !opts.includes(id) && !lots.some(l => l.obraB === id) && !(BUILD[id].mora && people.some(q => q.def.id === BUILD[id].mora))) opts.push(id); };
    p.def.build.forEach(add);
    Object.keys(BUILD).forEach(add);
    const lot = freeLot(lots[p.lot].x);
    pending.push({ p, opts: lot ? opts : [], lv: p.lv });
  }
  function choose(id) {
    const c = S.choice; if (!c) return;
    S.choice = null;
    if (!id) return;
    const L = freeLot(lots[c.p.lot].x); if (!L) return;
    L.obra = CFG.BUILD_SEC; L.obraB = id; L.by = c.p;
    S.camT = U.clamp(L.x - W / 2, 0, WORLD - W);
    sfx('stomp', { vol: 0.4 }); sfx('buy', { vol: 0.4 });
    logEv('obra', BUILD[id].nome);
  }
  function finishBuild(L) {
    const id = L.obraB; L.b = id; L.obra = 0; L.obraB = null; L.pop = 1;
    const B = BUILD[id];
    logEv('casa', B.nome);
    if (!S.fast) {
      ps.burst(L.x, BASE - 50, 28, { c: [C.gold, C.goldL, C.sakura, C.cream], shape: 'star', speed: [80, 260], life: 1.0 });
      ps.puff(L.x, BASE - 6, 14, 12, { c: C.sand });
      sfx('fanfare'); sfx('chirin');
      banner(B.nome + (L.by ? ' — presente da amizade com ' + L.by.def.nome : '') + '!', B.fx);
    }
    if (B.mora) {
      const def = RES.find(r => r.id === B.mora);
      const p = addPerson(def, L.i); p.x = L.x; p.y = BASE + 14; p.jump = 1;
      chat(p, 'Oi, vizinhos! Me mudei!', 3);
      logEv('morador', def.nome);
      if (!S.fast) toast(def.nome + ' se mudou pra rua! (' + def.job + ')', { tone: 'gold' });
    }
  }
  function startFest() {
    if (S.fest < CFG.FEST_NEED || S.festOn > 0) return;
    S.festOn = CFG.FEST_SEC; S.fest = 0;
    const se = SEASONS[S.season];
    logEv('festival', se.fest);
    banner('Festival ' + se.fest + '!', se.sub + ' · pedidos valem corações em dobro');
    sfx('fanfare'); sfx('levelup');
    people.forEach((p, k) => { p.mode = 'toFest'; p.slot = k; });
    S.camT = U.clamp(PRACA.cx - W / 2, 0, WORLD - W);
  }
  function endFest() {
    S.festDone++;
    S.season = (S.season + 1) % 4;
    const se = SEASONS[S.season];
    people.forEach(p => { p.mode = 'idle'; p.timer = U.rnd(0.5, 2); });
    toast('Chegou o ' + se.nome + '! Próximo festival: ' + se.fest, { tone: 'gold' });
    logEv('estacao', se.nome);
  }

  /* ======================================================================
     Gente andando
     ====================================================================== */
  function chat(p, s, dur) { p.chat = s; p.chatT = dur || 2.6; }
  const IDLE = ['sit', 'wag', 'sniff', 'wave', 'think', 'stretch', 'scratch', 'yawn'];
  function personTick(p, dt) {
    p.jump = Math.max(0, p.jump - dt * 2.5); p.glow = Math.max(0, p.glow - dt * 0.8); p.chatT -= dt;
    p.hb = Math.max(0, p.hb - dt);
    const home = lots[p.lot];
    if (p.mode === 'toFest' || p.mode === 'dance') {
      const n = people.length, a = (p.slot / n) * Math.PI * 2 + S.t * 0.35;
      p.tx = PRACA.cx + Math.cos(a) * 120; p.ty = FRONT + 50 + Math.sin(a) * 30;
      p.mode = 'dance';
    }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    const spd = p.mode === 'run' ? 120 : p.mode === 'dance' ? 90 : 46;
    if (d > 2) { p.x += dx / d * Math.min(d, spd * dt); p.y += dy / d * Math.min(d, spd * dt); if (Math.abs(dx) > 1) p.face = dx > 0 ? 1 : -1; p.moving = true; }
    else p.moving = false;
    if (p.mode === 'dance') { if (!p.moving) p.face = Math.sin(S.t * 2 + p.slot) > 0 ? 1 : -1; return; }
    p.timer -= dt;
    if (p.mode === 'happy') { if (p.timer <= 0) { p.mode = 'idle'; p.timer = U.rnd(1, 3); } return; }
    if (p.mode === 'run') { if (!p.moving) { p.mode = 'idle'; p.timer = 1; } return; }
    if (p.timer <= 0 && !p.moving) {
      const r = rng();
      if (r < 0.55) { p.tx = U.clamp(home.x + U.rnd(-260, 260), 360, WORLD - 40); p.ty = U.rnd(ROAD0 + 8, ROAD1 - 6); p.mode = 'walk'; p.timer = U.rnd(3, 7); }
      else if (r < 0.75) { p.tx = home.x + U.rnd(-14, 14); p.ty = BASE + 14; p.mode = 'walk'; p.timer = U.rnd(3, 6); }
      else { p.pose = IDLE[Math.floor(rng() * IDLE.length)]; p.mode = 'idle'; p.timer = U.rnd(2, 5); }
    }
  }
  function komeTick(dt) {
    const K = kome;
    if (!K.job && K.q.length) { K.job = K.q.shift(); K.state = 'go'; }
    let tx = DEPOT.x, ty = DEPOT.y;
    if (K.job) { const p = K.job.p; tx = p.x - (p.x > K.x ? 56 : -56); ty = Math.max(ROAD0 + 18, Math.min(ROAD1 - 12, p.y)); }
    if (K.state === 'drop') {
      K.wait -= dt;
      if (K.wait <= 0) { arrive(K.job); K.job = null; K.state = K.q.length ? 'go' : 'back'; }
      return;
    }
    if (K.state === 'park') return;
    const dx = tx - K.x, dy = ty - K.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 2) K.face = dx > 0 ? 1 : -1;
    const v = CFG.TRUCK_SPEED * dt;
    if (d <= v + 0.5) {
      K.x = tx; K.y = ty;
      if (K.job) { K.state = 'drop'; K.wait = 0.7; const p = K.job.p; if (p.mode !== 'dance') { p.mode = 'run'; p.tx = K.x + (p.x > K.x ? 34 : -34); p.ty = K.y + 4; } sfx('thud', { vol: 0.3 }); }
      else { K.state = 'park'; K.face = 1; }
    } else { K.x += dx / d * v; K.y += dy / d * v; }
  }

  /* corações voando até o contador do topo (HUD) */
  const hearts = [];
  function flyHeart(p, delay) { if (!S.fast) hearts.push({ wx: p.x, wy: p.y - 40, t: -delay }); }

  /* ======================================================================
     Simulação
     ====================================================================== */
  function sim(dt) {
    S.t += dt;
    // fábrica → despensa (o que não cabe é vendido na hora: nada se perde)
    const r = CFG.FOCO[S.foco].r;
    for (const k of ITEM_IDS) {
      const add = r[k] * dt; S.made[k] += add; S.stock[k] += add;
      const cap = CFG.ITEMS[k].cap;
      if (S.stock[k] > cap) { const over = S.stock[k] - cap; S.stock[k] = cap; const v = over * CFG.ITEMS[k].val * CFG.V; S.money += v; S.overAcc += v; }
    }
    S.overT += dt;
    if (S.overT > 1.2) { if (S.overAcc > 0 && !S.fast) fl.add(160 + U.rnd(-30, 30), 120, '+¥' + U.fmt(S.overAcc), { size: 13, c: C.cream, life: 0.9 }); S.overAcc = 0; S.overT = 0; }
    // lojas compram só o excedente (acima da linha), nunca o que está guardado pra pedido
    for (const L of lots) {
      if (L.pop) L.pop = Math.max(0, L.pop - dt * 1.2);
      L.bounce = Math.max(0, L.bounce - dt * 3);
      if (L.obra) { L.obra -= dt; if (!S.fast && Math.random() < dt * 3) ps.puff(L.x + U.rnd(-50, 50), BASE - U.rnd(0, 40), 3, 6, { c: C.sand }); if (L.obra <= 0) finishBuild(L); continue; }
      const B = L.b && BUILD[L.b]; if (!B || !B.loja) continue;
      L.shopT += dt;
      if (L.shopT >= CFG.SHOP_EVERY) {
        L.shopT = 0;
        const k = B.loja.slice().sort((a, b) => S.stock[b] / CFG.ITEMS[b].cap - S.stock[a] / CFG.ITEMS[a].cap)[0];
        if (S.stock[k] > CFG.ITEMS[k].cap * CFG.SHOP_LINE) {
          S.stock[k] -= 1; const v = CFG.ITEMS[k].val * CFG.V * CFG.SHOP_PAY; S.money += v; L.bounce = 1;
          if (!S.fast) fl.add(L.x + U.rnd(-20, 20), BASE - 70, '+¥' + U.fmt(v), { size: 12, c: C.goldL, life: 0.8 });
        }
      }
    }
    // pedidos
    for (let i = 0; i < 3; i++) if (!S.orders[i]) { S.gap[i] -= dt; if (S.gap[i] <= 0 && !newOrder(i)) S.gap[i] = 1; }
    // festival
    if (S.festOn > 0) {
      S.festOn -= dt;
      if (!S.fast && Math.random() < dt * 1.1) firework();
      if (S.festOn <= 0) { S.festOn = 0; endFest(); }
    }
    for (const p of people) personTick(p, dt);
    komeTick(dt);
    // conversa à toa (um morador por vez, de vez em quando)
    if (!S.fast && Math.random() < dt * 0.22) {
      const vis = people.filter(p => p.x > S.camX + 40 && p.x < S.camX + W - 40 && p.chatT <= 0 && p.mode !== 'dance');
      if (vis.length) { const p = vis[Math.floor(rng() * vis.length)]; chat(p, p.def.fala[Math.floor(rng() * p.def.fala.length)], 3); }
    }
    if (!S.choice && pending.length && !S.fast) { const c = pending.shift(); if (c.opts.length) { S.choice = c; sfx('levelup'); } else banner(c.p.def.nome + ': amizade nível ' + c.lv + '!', '+1 grão no Arroz do Coração (renda +1%)'); }
    else if (S.fast && pending.length) { const c = pending.shift(); if (c.opts.length) { S.choice = c; choose(c.opts[0]); } }
  }
  function firework() {
    const x = S.camX + U.rnd(120, W - 120), y = U.rnd(70, 140);
    const cols = [[C.gold, C.goldL], [C.sakura, C.red], [C.waterL, C.cream], [C.grassL, C.goldL]][Math.floor(Math.random() * 4)];
    ps.burst(x, y, 34, { c: cols, shape: 'spark', speed: [70, 190], life: [0.7, 1.3], g: 50, drag: 1.2 });
    ps.sparkle(x, y, 6, { c: C.cream, r: 30 });
    sfx('boom', { vol: 0.25, pitch: U.rnd(0.8, 1.2) }); sfx('chirin', { vol: 0.15, pitch: 1.6 });
  }

  /* ======================================================================
     Cenário
     ====================================================================== */
  const clouds = N.clouds ? N.clouds(4, { n: 6 }) : null;
  const birds = N.birds ? N.birds(3, { n: 5, y: 0.12 }) : null;
  const ff = N.fireflies ? N.fireflies({ x0: PRACA.x0, x1: PRACA.x1, y0: 330, y1: 440, n: 16 }) : null;
  function tod() { return U.lerp(0.42, 0.86, night()); }

  function drawSky(t) {
    N.sky(g, W, H, { tod: tod(), t, stars: true });
    if (N.celestial) N.celestial(g, W, 216, { tod: tod(), t, r: 16 });
    if (clouds) clouds.draw(g, W, 300, S.camX * 0.15);
    g.save(); g.translate(-S.camX * 0.08, 0);
    N.fuji(g, 760, 216, 0.85, { tod: tod(), t, snow: true });
    g.restore();
    if (birds && night() < 0.5) birds.draw(g, W, 300, S.camX * 0.2);
  }
  function drawGroundBack(t) {
    const se = SEASONS[S.season];
    // morros com casinhas distantes
    if (N.hills) N.hills(g, WORLD + 400, 222, S.camX, { col: S.season === 3 ? '#C9D3D8' : '#7E9C6A', amp: 22, parallax: 0.45, seed: 3, haze: 0.45, tod: tod(), trees: 0.5, bottom: 266 });
    // quintal atrás das casas
    g.fillStyle = INK; g.fillRect(S.camX - 10, 212, W + 20, 2);
    g.fillStyle = se.grass; g.fillRect(S.camX - 10, 214, W + 20, BASE - 214);
    g.fillStyle = 'rgba(255,250,230,.18)'; g.fillRect(S.camX - 10, 214, W + 20, 3);
    // árvores de fundo entre os lotes (mudam com a estação)
    for (let i = -1; i <= NLOT; i++) {
      const x = LOT_X0 + i * LOT_W + LOT_W / 2;
      if (x < S.camX - 80 || x > S.camX + W + 80) continue;
      N.tree(g, x, 226, { kind: i % 3 === 0 ? se.tree : (S.season === 3 ? 'pine' : 'round'), s: 0.55, seed: i * 7 + 2, t });
    }
  }
  function drawStreet(t) {
    const x0 = S.camX - 10, w = W + 20;
    // calçada de trás
    g.fillStyle = INK; g.fillRect(x0, BASE - 1, w, 2);
    g.fillStyle = C.stoneL; g.fillRect(x0, BASE, w, ROAD0 - BASE);
    g.fillStyle = C.stone; for (let x = Math.floor(x0 / 28) * 28; x < x0 + w; x += 28) g.fillRect(x, BASE, 1, ROAD0 - BASE);
    // rua de terra batida com pedras
    g.fillStyle = INK; g.fillRect(x0, ROAD0, w, 2);
    g.fillStyle = '#C9A877'; g.fillRect(x0, ROAD0 + 2, w, ROAD1 - ROAD0 - 2);
    g.fillStyle = '#B8966A'; g.fillRect(x0, ROAD1 - 10, w, 8);
    g.fillStyle = 'rgba(255,250,230,.25)'; g.fillRect(x0, ROAD0 + 2, w, 3);
    const R = E.RNG(5);
    for (let i = 0; i < 260; i++) {
      const x = R() * WORLD, y = ROAD0 + 8 + R() * (ROAD1 - ROAD0 - 16);
      if (x < x0 || x > x0 + w) continue;
      g.fillStyle = R() < 0.5 ? '#B08C5E' : '#DCC096'; g.fillRect(Math.round(x), Math.round(y), 4, 2);
    }
    // calçada da frente
    g.fillStyle = INK; g.fillRect(x0, ROAD1, w, 2);
    g.fillStyle = C.stoneL; g.fillRect(x0, ROAD1 + 2, w, FRONT - ROAD1 - 2);
    g.fillStyle = C.stoneD; g.fillRect(x0, FRONT - 3, w, 3);
    // frente: grama + praça de pedra
    const se = SEASONS[S.season];
    g.fillStyle = se.grass; g.fillRect(x0, FRONT, w, BOT - FRONT);
    g.fillStyle = 'rgba(0,0,0,.06)'; for (let y = FRONT + 8; y < BOT; y += 12) g.fillRect(x0, y, w, 1);
    // praça
    g.fillStyle = INK; D.rrect(g, PRACA.x0 - 3, FRONT + 6, PRACA.x1 - PRACA.x0 + 6, BOT - FRONT, 14); g.fill();
    g.fillStyle = C.sand; D.rrect(g, PRACA.x0, FRONT + 9, PRACA.x1 - PRACA.x0, BOT - FRONT, 12); g.fill();
    g.fillStyle = 'rgba(160,120,70,.25)';
    for (let y = FRONT + 22; y < BOT; y += 18) for (let x = PRACA.x0 + ((y / 18) % 2) * 16; x < PRACA.x1 - 10; x += 32) g.fillRect(x, y, 28, 2);
    // fábrica: pátio de concreto
    g.fillStyle = INK; g.fillRect(-10, 146, 392, 2);
    g.fillStyle = '#B9B2A2'; g.fillRect(-10, 148, 392, BASE - 148);
  }

  /* drawables com profundidade (y = pé) */
  let drawList = [];
  const put = (y, fn) => drawList.push({ y, fn });

  function lotDrawables(t) {
    for (const L of lots) {
      if (L.x < S.camX - 120 || L.x > S.camX + W + 120) continue;
      put(BASE - 0.5, () => {
        if (L.obra) {
          const k = 1 - L.obra / CFG.BUILD_SEC, st = k < 0.4 ? 1 : k < 0.8 ? 2 : 3;
          N.house(g, L.x, BASE, { stage: st, s: 0.95, t });
          // shiba da obra martelando
          E.drawShiba(g, L.x + 46, BASE + 2, 'dig', t * 1.6, { pal: 'cha', scale: 0.8, face: -1 });
          txt('obra ' + Math.ceil(L.obra) + 's', L.x, BASE - 98, TS(13));
          return;
        }
        const id = L.b ? BUILD[L.b].art : L.res ? L.res.def.art : null;
        if (!id) {
          N.house(g, L.x, BASE, { stage: 0, s: 0.9, t, sign: 'TERRENO' });
          return;
        }
        const pop = L.pop > 0 ? 1 + Math.sin(L.pop * Math.PI) * 0.12 : 1, bo = L.bounce * 2;
        g.save(); g.translate(L.x, BASE); g.scale(1 / pop + (pop - 1) * 0.5, pop + bo * 0.01); g.translate(-L.x, -BASE);
        D.shadow(g, L.x, BASE + 1, 78, 5, 0.18);
        drawArt(id, L.x, BASE + 1, id === 'cid_templo' ? 1.5 : SC, t);
        g.restore();
        // placa da loja com o item que ela compra
        const B = L.b && BUILD[L.b];
        if (B && B.loja) {
          const k = B.loja.length === 1 ? B.loja[0] : null;
          if (k) blit(ICON[k], L.x + 62, BASE - 4, 2);
        }
        if (L.res && L.res.lv > 1 && !L.b) {   // casa de quem tem amizade alta ganha flores na frente
          for (let f = 0; f < Math.min(4, L.res.lv - 1); f++) N.flower && N.flower(g, L.x - 60 + f * 10, BASE + 4, { kind: ['tulip', 'daisy', 'ajisai', 'tanpopo'][f], seed: f + L.i, t, s: 0.8 });
        }
      });
    }
  }
  function propDrawables(t) {
    const lit = night() > 0.5;
    // postes de luz na calçada de trás
    for (let i = 0; i <= NLOT; i++) {
      const x = LOT_X0 - LOT_W / 2 + i * LOT_W;
      put(BASE + 2, () => { drawArt('poste_de_luz', x, BASE + 4, 1.5, t); if (lit && N.glow) N.glow(g, x + 6, BASE - 88, 40, '#FFD98A', 0.8); });
    }
    put(BASE + 4, () => drawArt('cid_correio', LOT_X0 + 2 * LOT_W - 40, BASE + 6, 1.5, t));
    put(BASE + 3, () => { drawArt('prop_barril', lots[4].x + 70, BASE + 4, 1.5, t); drawArt('prop_caixote', lots[4].x - 72, BASE + 4, 1.5, t); });
    // gato dormindo no telhado da Vó Kiku
    put(BASE - 1, () => A.draw(g, 'gato_laranja', artFrame('gato_laranja', 'dormir', t * 0.4), lots[0].x + 30, BASE - 82, { scale: 0.8 }));
    // frente: máquina de venda, bancos, árvore da estação, lanternas de pedra
    put(FRONT + 46, () => drawArt('prop_venda', 560, FRONT + 46, 1.5, t));
    put(FRONT + 40, () => drawArt('cid_banco', 860, FRONT + 40, 1.5, t));
    put(FRONT + 70, () => drawArt('cid_banco', PRACA.x0 + 70, FRONT + 70, 1.5, t));
    const se = SEASONS[S.season];
    put(FRONT + 64, () => N.tree(g, PRACA.x1 + 70, FRONT + 64, { kind: se.tree, s: 1.15, seed: 9, t }));
    put(FRONT + 30, () => N.tree(g, 700, FRONT + 30, { kind: S.season === 3 ? 'pine' : 'round', s: 0.8, seed: 4, t }));
    put(FRONT + 80, () => N.tree(g, 1720, FRONT + 80, { kind: se.tree, s: 1.0, seed: 12, t }));
    put(FRONT + 60, () => N.lantern && N.lantern(g, PRACA.x0 + 20, FRONT + 60, 1, { t, lit }));
    put(FRONT + 80, () => N.lantern && N.lantern(g, PRACA.x1 - 18, FRONT + 80, 1, { t, lit }));
    put(FRONT + 64, () => N.torii && N.torii(g, 1880, FRONT + 64, 0.9, { t }));
    // canteiros da frente (moita, flor, pedra, capim): a frente nunca fica vazia
    const RR = E.RNG(21);
    for (let x = 380; x < WORLD; x += 46 + Math.floor(RR() * 40)) {
      const k = RR(), y = FRONT + 8 + RR() * 10, sd = Math.floor(RR() * 99);
      if (x > PRACA.x0 - 20 && x < PRACA.x1 + 130) continue;
      if (x < S.camX - 60 || x > S.camX + W + 60) continue;
      if (k < 0.35) put(y, () => N.bush(g, x, y, { kind: S.season === 0 && sd % 2 ? 'azalea' : 'bush', s: 0.7, seed: sd, t }));
      else if (k < 0.7) put(y, () => { const kinds = [['tulip', 'tanpopo'], ['ajisai', 'daisy'], ['higanbana', 'daisy'], ['daisy', 'daisy']][S.season]; for (let f = 0; f < 3; f++) N.flower(g, x + f * 9, y + (f % 2) * 4, { kind: kinds[f % 2], seed: sd + f, t, s: 0.9 }); });
      else if (k < 0.85) put(y, () => N.rock(g, x, y, { w: 18, h: 11, seed: sd, moss: true }));
      else put(y, () => N.grassTuft(g, x, y, { seed: sd, t, s: 1.1 }));
    }
    // fileira de trás da frente: cerquinha de bambu
    put(FRONT + 2, () => { N.fence && N.fence(g, 380, PRACA.x0 - 20, FRONT + 4, { kind: 'bamboo' }); N.fence && N.fence(g, PRACA.x1 + 20, WORLD, FRONT + 4, { kind: 'bamboo' }); });
    // fábrica KOME PACK + despensa
    put(BASE - 2, () => {
      D.shadow(g, 190, BASE - 4, 170, 6, 0.2);
      A.draw(g, 'fabrica_kome_pack', artFrame('fabrica_kome_pack', 'dia', t), 190, BASE - 4, { scale: 1.5 });
      const lx = U.clamp(S.camX + 110, 250, 300); txt('Fábrica KOME PACK', lx, 138, TS(14));
      txt('toque pra mudar o foco', lx, 154, TS(12, C.goldL));
    });
    // festival: barraquinhas, bandeiras, torre do taiko, lanternas na rua
    const fo = night();
    if (fo > 0) {
      const se2 = SEASONS[S.season];
      put(FRONT + 30, () => N.stall(g, PRACA.x0 + 70, FRONT + 30, { t, lit: true, col: C.red }));
      put(FRONT + 30, () => N.stall(g, PRACA.x1 - 70, FRONT + 30, { t, lit: true, col: C.bowl }));
      
      put(FRONT + 20, () => { N.nobori && N.nobori(g, PRACA.x0 + 40, FRONT + 20, { t, col: C.red }); N.nobori && N.nobori(g, PRACA.x1 - 30, FRONT + 20, { t, col: C.ora }); });
      put(FRONT + 56, () => yagura(PRACA.cx, FRONT + 56, t));
      // turistas tanuki
      put(FRONT + 60, () => A.draw(g, 'tanuki', artFrame('tanuki', 'feliz', t), PRACA.x0 + 34, FRONT + 84, { scale: 1 }));
      put(FRONT + 86, () => A.draw(g, 'tanuki', artFrame('tanuki', 'comer', t + 0.3), PRACA.x1 - 34, FRONT + 86, { scale: 1, flip: true }));
      void se2;
    }
  }
  function yagura(x, y, t) {        // torre do taiko do bon-odori (vetor chunky, contorno Kome)
    const box = (a, b, w, h, c1, c2) => { g.fillStyle = INK; g.fillRect(a - 2, b - 2, w + 4, h + 4); g.fillStyle = c1; g.fillRect(a, b, w, h); if (c2) { g.fillStyle = c2; g.fillRect(a, b + h - 3, w, 3); } };
    D.shadow(g, x, y + 2, 60, 6, 0.25);
    for (const dx of [-40, 34]) box(x + dx, y - 70, 6, 70, C.wood, C.woodD);
    box(x - 50, y - 78, 100, 12, C.woodL, C.woodD);
    // pano listrado vermelho e branco
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? C.cream : C.red; g.fillRect(x - 48 + i * 9.6, y - 66, 9.6, 14); }
    g.fillStyle = INK; g.fillRect(x - 48, y - 52, 96, 2);
    // telhadinho
    g.fillStyle = INK; g.beginPath(); g.moveTo(x - 60, y - 112); g.lineTo(x + 60, y - 112); g.lineTo(x + 48, y - 128); g.lineTo(x - 48, y - 128); g.closePath(); g.fill();
    g.fillStyle = C.redD; g.fillRect(x - 56, y - 116, 112, 4); g.fillStyle = C.red; g.fillRect(x - 46, y - 126, 92, 10);
    for (const dx of [-44, 38]) box(x + dx, y - 112, 6, 34, C.wood);
    // taiko e o Kome batendo
    const hit = Math.sin(t * 9) > 0.6;
    g.fillStyle = INK; g.beginPath(); g.ellipse(x + 14, y - 92, 13, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.rust; g.beginPath(); g.ellipse(x + 14, y - 92, 11, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.cream; g.beginPath(); g.ellipse(x + 10, y - 92, 5, 7, 0, 0, Math.PI * 2); g.fill();
    E.drawShiba(g, x - 12, y - 79, hit ? 'slash' : 'windup', t, { pal: 'kome', scale: 0.7, shadow: false });
    if (hit && Math.random() < 0.15) { ps.burst(x + 12, y - 96, 3, { c: C.goldL, shape: 'star', speed: [40, 90], life: 0.4 }); sfx('thud', { vol: 0.15, pitch: 0.7 }); }
    // chochins pendurados
    if (N.chochin) for (let i = 0; i < 5; i++) N.chochin(g, x - 44 + i * 22, y - 110, { t, lit: true, s: 0.8, seed: i });
  }
  function streetLanterns(t) {       // varal de lanternas atravessando a rua no festival
    if (night() <= 0 || !N.chochin) return;
    for (let i = 0; i < NLOT; i++) {
      const xa = LOT_X0 - LOT_W / 2 + i * LOT_W + 6, xb = xa + LOT_W;
      if (xb < S.camX || xa > S.camX + W) continue;
      g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath();
      for (let k = 0; k <= 12; k++) { const u = k / 12, x = U.lerp(xa, xb, u), y = BASE - 86 + Math.sin(u * Math.PI) * 18; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      for (let k = 1; k < 6; k++) { const u = k / 6, x = U.lerp(xa, xb, u), y = BASE - 86 + Math.sin(u * Math.PI) * 18; N.chochin(g, x, y, { t, lit: true, s: 0.75, seed: i * 6 + k, col: (i + k) % 3 ? C.red : C.ora }); }
    }
  }
  function personDrawables(t) {
    for (const p of people) {
      if (p.x < S.camX - 60 || p.x > S.camX + W + 60) continue;
      put(p.y, () => {
        const jy = -Math.sin(p.jump * Math.PI) * 10;
        let pose = p.pose;
        if (p.mode === 'dance') pose = p.moving ? 'walk' : (p.slot % 2 ? 'dance' : 'dance2');
        else if (p.mode === 'happy') pose = 'cheer';
        else if (p.mode === 'run') pose = 'run';
        else if (p.moving) pose = 'walk';
        else if (orderOf(p) >= 0 && p.mode === 'idle') pose = 'wave';
        if (p.glow > 0 && N.glow) N.glow(g, p.x, p.y - 20, 34, '#FFE68A', p.glow);
        const selP = S.sel >= 0 && S.orders[S.sel] && S.orders[S.sel].p === p;
        if (selP) { g.strokeStyle = C.gold; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x, p.y + 1, 22, 7, 0, 0, Math.PI * 2); g.stroke(); }
        E.drawShiba(g, p.x, p.y + jy, pose, t + p.lot, { pal: p.def.pal, hat: p.def.hat, scale: 1.1, face: p.face });
      });
    }
    put(kome.y + 6, () => {
      const moving = kome.state === 'go' || kome.state === 'back';
      D.shadow(g, kome.x, kome.y + 6, 44, 5, 0.25);
      const bob = moving ? Math.sin(S.t * 30) * 0.8 : 0;
      A.draw(g, 'cid_keitruck', artFrame('cid_keitruck', moving ? 'andar' : 'parado', t), kome.x, kome.y + 6 + bob, { scale: 1.5, flip: kome.face < 0 });
      // Kome no volante
      E.drawShibaHead(g, kome.x + kome.face * 14, kome.y - 34 + bob, t, { scale: 0.75, expr: kome.job ? 'happy' : 'normal', pal: 'kome', face: kome.face });
      // caixas na caçamba
      const n = (kome.job ? 1 : 0) + kome.q.length;
      for (let i = 0; i < Math.min(3, n); i++) {
        const bx = kome.x - kome.face * (20 + i * 12), by = kome.y - 20 + bob;
        g.fillStyle = INK; g.fillRect(bx - 7, by - 9, 14, 12); g.fillStyle = C.sack; g.fillRect(bx - 5, by - 7, 10, 8); g.fillStyle = C.red; g.fillRect(bx - 1, by - 7, 2, 8);
      }
      if (kome.state === 'drop') { const k = 1 - kome.wait / 0.7; const p = kome.job.p; const bx = U.lerp(kome.x, p.x, k), by = U.lerp(kome.y - 24, p.y - 34, k) - Math.sin(k * Math.PI) * 26; blit(ICON[kome.job.item], bx, by, 3); }
    });
  }
  // balões (pedido / conversa) desenhados por cima de tudo, ainda em coordenadas do mundo
  function bubble(x, y, w, h, fill) {
    g.fillStyle = INK; D.rrect(g, x - w / 2 - 2, y - h - 2, w + 4, h + 4, 9); g.fill();
    g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.lineTo(x, y + 9); g.closePath(); g.fill();
    g.fillStyle = fill || C.cream; D.rrect(g, x - w / 2, y - h, w, h, 7); g.fill();
    g.beginPath(); g.moveTo(x - 5, y - 1); g.lineTo(x + 5, y - 1); g.lineTo(x, y + 5); g.closePath(); g.fill();
  }
  function drawBubbles(t) {
    for (const p of people) {
      if (p.x < S.camX - 80 || p.x > S.camX + W + 80) continue;
      const oi = orderOf(p), by = p.y - 50 - Math.sin(p.jump * Math.PI) * 10;
      if (oi >= 0 && p.mode !== 'dance') {
        const o = S.orders[oi], ok = S.stock[o.item] >= o.qty, sel = S.sel === oi;
        const bob = Math.sin(t * 3 + p.lot) * 2;
        bubble(p.x, by + bob, 76, 34, sel ? C.goldL : ok ? '#E9F5D2' : C.cream);
        blit(ICON[o.item], p.x - 20, by + bob - 9, 3);
        txt('×' + o.qty, p.x + 14, by + bob - 17, T(15, INK));
        if (o.hearts > 1) blit(ICON.heart, p.x + 34, by + bob - 24, 2);
      } else if (p.chatT > 0 && p.chat) {
        g.font = '900 13px system-ui, sans-serif';
        const w = Math.min(230, g.measureText(p.chat).width + 18);
        bubble(p.x, by, w, 24, C.cream);
        txt(p.chat, p.x, by - 12, T(13, INK));
      }
    }
  }

  /* ======================================================================
     HUD em canvas (botões imediatos, como a Fábrica)
     ====================================================================== */
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
    const col = o.off ? '#8a7a66' : INK;
    if (o.sub) { txt(label, x + w / 2, y + h / 2 - 7 + dy, T(o.size || 14, col)); txt(o.sub, x + w / 2, y + h / 2 + 9 + dy, T(o.subSize || 12, o.off ? '#8a7a66' : '#6B4A2E')); }
    else txt(label, x + w / 2, y + h / 2 + 1 + dy, T(o.size || 14, col));
    if (fn) hit(x, y, w, h, fn);
  }
  function bar(x, y, w, h, k, col, bg) {
    g.fillStyle = INK; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = bg || C.riceS; g.fillRect(x, y, w, h);
    g.fillStyle = col; g.fillRect(x, y, Math.round(w * U.clamp(k, 0, 1)), h);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, Math.round(w * U.clamp(k, 0, 1)), 2);
  }
  let heartPulse = 0;
  function drawTopBar(t) {
    g.fillStyle = INK; g.fillRect(0, 0, W, 52);
    g.fillStyle = '#4A3020'; g.fillRect(0, 0, W, 49);
    g.fillStyle = C.gold; g.fillRect(0, 49, W, 3);
    card(8, 6, 150, 36);
    blit(ICON.yen, 26, 33, 3);
    txt(U.fmt(Math.floor(S.money)), 44, 25, T(19, INK, 'left'));
    // despensa
    card(168, 6, 372, 36, '#FFF3D6');
    txt('Despensa', 178, 18, T(11, '#8A6A4A', 'left')); txt('da Vila', 178, 31, T(11, '#8A6A4A', 'left'));
    const r = CFG.FOCO[S.foco].r;
    ITEM_IDS.forEach((k, i) => {
      const x = 236 + i * 100, cap = CFG.ITEMS[k].cap, v = S.stock[k];
      blit(ICON[k], x + 10, 32, 3);
      txt(U.fmt(Math.floor(v)), x + 26, 19, T(15, INK, 'left'));
      bar(x + 26, 30, 64, 6, v / cap, v >= cap ? C.ora : C.grass);
    });
    void r;
    // corações
    heartPulse = Math.max(0, heartPulse - 0.04);
    card(550, 6, 96, 36);
    blit(ICON.heart, 572, 34 + heartPulse * 2, 3 + heartPulse);
    txt(U.fmt(S.hearts), 590, 25, T(18, C.redD, 'left'));
    // estação
    const se = SEASONS[S.season];
    card(656, 6, 152, 36, '#FFF3D6');
    blit(ICON[SEASON_ICON[S.season]], 674, 34, 3);
    txt(se.nome, 692, 18, T(14, INK, 'left'));
    txt(S.festOn > 0 ? 'festival agora!' : 'festival: ' + se.fest, 692, 33, T(12, '#8A6A4A', 'left'));
    [1, 2, 5].forEach((v, i) => button(818 + i * 36, 6, 32, 36, v + '×', () => { S.speed = v; sfx('click'); }, { on: S.speed === v, size: 13 }));
    button(924, 6, 30, 36, S.muted ? 'x' : '♪', () => { S.muted = !S.muted; try { E.Audio.muted = S.muted; } catch (e) { /* */ } }, { on: !S.muted, size: 15 });
  }
  function drawOrders(t) {
    g.fillStyle = INK; g.fillRect(0, BOT, W, H - BOT);
    g.fillStyle = '#5A3A22'; g.fillRect(0, BOT + 3, W, H - BOT);
    for (let x = 0; x < W; x += 40) { g.fillStyle = '#4E3220'; g.fillRect(x, BOT + 3, 2, H - BOT); }
    for (let i = 0; i < 3; i++) {
      const x = 8 + i * 236, y = BOT + 8, w = 226, h = 74, o = S.orders[i];
      if (!o) {
        card(x, y, w, h, '#E8DCC0');
        txt('novo pedido em ' + Math.max(1, Math.ceil(S.gap[i])) + ' s', x + w / 2, y + h / 2, T(14, '#8a7a66'));
        continue;
      }
      const sel = S.sel === i, ok = S.stock[o.item] >= o.qty;
      card(x, y, w, h, sel ? '#FFF1BF' : C.cream);
      hit(x, y, w - 90, h, () => { S.sel = S.sel === i ? -1 : i; S.camT = U.clamp(o.p.x - W / 2, 0, WORLD - W); o.p.jump = 1; sfx('click'); });
      // retrato
      g.fillStyle = INK; D.rrect(g, x + 6, y + 6, 58, 62, 8); g.fill();
      g.fillStyle = sel ? C.goldL : '#F6E4C4'; D.rrect(g, x + 8, y + 8, 54, 58, 6); g.fill();
      g.save(); D.rrect(g, x + 8, y + 8, 54, 58, 6); g.clip();
      E.drawShibaHead(g, x + 35, y + 40, t + i, { scale: 1.25, expr: ok ? 'happy' : 'normal', pal: o.p.def.pal, hat: o.p.def.hat });
      g.restore();
      txt(o.p.def.nome, x + 72, y + 16, T(14, INK, 'left'));
      blit(ICON[o.item], x + 82, y + 44, 3);
      txt('×' + o.qty, x + 96, y + 37, T(17, INK, 'left'));
      for (let k = 0; k < o.hearts; k++) blit(ICON.heart, x + 80 + k * 16, y + 69, 2);
      if (o.item === o.p.def.fav) txt('ama!', x + 80 + o.hearts * 16, y + 63, T(12, C.redD, 'left'));
      const have = Math.min(o.qty, Math.floor(S.stock[o.item]));
      if (ok) button(x + w - 82, y + 16, 74, 42, 'Entregar', () => deliver(i), { on: true, size: 14, sub: '+¥' + U.fmt(o.pay), subSize: 11 });
      else {
        button(x + w - 82, y + 16, 74, 42, have + '/' + o.qty, () => { S.sel = i; toast('A fábrica tá fazendo: faltam ' + (o.qty - have) + ' ' + CFG.ITEMS[o.item].plural + '. Dica: mude o foco da fábrica.'); sfx('click'); }, { off: true, size: 14, sub: 'fazendo…', subSize: 11 });
        bar(x + w - 78, y + 62, 66, 5, have / o.qty, C.grass);
      }
    }
    // festival
    const x = 716, y = BOT + 8, w = 236, h = 74, se = SEASONS[S.season], full = S.fest >= CFG.FEST_NEED;
    card(x, y, w, h, full ? '#FFE9B0' : '#FFF3D6');
    blit(ICON[SEASON_ICON[S.season]], x + 22, y + 32, 4);
    if (S.festOn > 0) {
      txt('Festival ' + se.fest, x + 44, y + 18, T(15, C.redD, 'left'));
      txt('corações ×2 nos pedidos', x + 44, y + 38, T(12, '#6B4A2E', 'left'));
      bar(x + 44, y + 52, w - 56, 8, S.festOn / CFG.FEST_SEC, C.red);
    } else if (full) {
      const pulse = 1 + Math.sin(t * 6) * 0.03;
      g.save(); g.translate(x + w / 2 + 18, y + 37); g.scale(pulse, pulse); g.translate(-(x + w / 2 + 18), -(y + 37));
      button(x + 44, y + 12, w - 54, 50, 'Começar o ' + se.fest + '!', startFest, { on: true, size: 15, sub: 'quando você quiser', subSize: 11 });
      g.restore();
    } else {
      txt('Festival ' + se.fest, x + 44, y + 18, T(15, INK, 'left'));
      txt(Math.floor(S.fest) + ' de ' + CFG.FEST_NEED + ' corações', x + 44, y + 36, T(12, '#6B4A2E', 'left'));
      bar(x + 44, y + 50, w - 56, 10, S.fest / CFG.FEST_NEED, C.sakuraD);
    }
  }
  let focoOpen = false;
  function drawFoco(t) {
    if (!focoOpen) return;
    const x = 20, y = 140, w = 300, h = 236;
    card(x, y, w, h, '#FFF3D6');
    txt('Fábrica: o que fazer mais?', x + w / 2, y + 20, T(15));
    txt('(no jogo: fatia "Vila" da Doca de Venda)', x + w / 2, y + 38, T(11, '#8A6A4A'));
    Object.keys(CFG.FOCO).forEach((k, i) => {
      const F = CFG.FOCO[k], bx = x + 12 + (i % 2) * 142, by = y + 54 + Math.floor(i / 2) * 76;
      button(bx, by, 134, 66, F.nome, () => { S.foco = k; focoOpen = false; sfx('click'); toast('Fábrica: ' + F.nome); }, { on: S.foco === k, size: 14 });
      ITEM_IDS.forEach((it, j) => { blit(ICON[it], bx + 22 + j * 44, by + 58, 2); txt((F.r[it] * 60).toFixed(0), bx + 36 + j * 44, by + 50, T(11, '#6B4A2E', 'left')); });
    });
    txt('por minuto', x + w / 2, y + h - 14, T(11, '#8A6A4A'));
    hit(0, 0, W, H, () => { focoOpen = false; });   // tocar fora fecha (registrado por último = menor prioridade)
  }
  function drawChoice(t) {
    const c = S.choice; if (!c) return;
    g.fillStyle = 'rgba(42,26,16,.55)'; g.fillRect(0, 0, W, H);
    const w = 620, h = 330, x = (W - w) / 2, y = 90;
    card(x, y, w, h, '#FFF3D6');
    g.fillStyle = INK; D.rrect(g, x + 16, y + 14, 72, 72, 10); g.fill();
    g.fillStyle = C.goldL; D.rrect(g, x + 18, y + 16, 68, 68, 8); g.fill();
    g.save(); D.rrect(g, x + 18, y + 16, 68, 68, 8); g.clip();
    E.drawShibaHead(g, x + 52, y + 54, t, { scale: 1.6, expr: 'love', pal: c.p.def.pal, hat: c.p.def.hat }); g.restore();
    txt(c.p.def.nome + ': amizade nível ' + c.lv + '!', x + 100, y + 34, T(20, INK, 'left'));
    txt('"Kome, dá pra gente construir uma coisa na rua?" · ' + c.p.def.job, x + 100, y + 60, T(12, '#6B4A2E', 'left'));
    c.opts.forEach((id, i) => {
      const B = BUILD[id], bx = x + 20 + i * 296, by = y + 100, bw = 284, bh = 212;
      card(bx, by, bw, bh, C.cream);
      g.fillStyle = '#CFE8F2'; g.fillRect(bx + 10, by + 10, bw - 20, 108);
      g.fillStyle = SEASONS[S.season].grass; g.fillRect(bx + 10, by + 100, bw - 20, 18);
      drawArt(B.art, bx + bw / 2, by + 112, B.art === 'cid_templo' ? 1.1 : 1.6, t);
      txt(B.nome, bx + bw / 2, by + 136, T(17));
      txt(B.fx, bx + bw / 2, by + 158, T(12, '#6B4A2E'));
      button(bx + 40, by + 172, bw - 80, 34, 'Construir', () => choose(id), { on: true, size: 15 });
    });
    hit(0, 0, W, H, () => {});      // modal: engole o resto
  }
  function drawHeartsFly(dt) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]; h.t += dt;
      if (h.t < 0) continue;
      const k = Math.min(1, h.t / 0.8), sx = h.wx - S.camX, sy = h.wy;
      const x = U.lerp(sx, 572, k * k), y = U.lerp(sy, 24, k) - Math.sin(k * Math.PI) * 60;
      blit(ICON.heart, x, y + 8, 3);
      if (k >= 1) { hearts.splice(i, 1); heartPulse = 1; sfx('pop', { pitch: 1.6, vol: 0.3 }); }
    }
  }
  function drawHint(t) {
    if (!S.hint || S.choice) return;
    const i = S.orders.findIndex((o, k) => o && canDeliver(k)); if (i < 0) return;
    const x = 8 + i * 236 + 226 - 45, y = BOT - 6 + Math.sin(t * 6) * 4;
    g.fillStyle = INK; g.beginPath(); g.moveTo(x - 10, y - 14); g.lineTo(x + 10, y - 14); g.lineTo(x, y); g.closePath(); g.fill();
    g.fillStyle = C.gold; g.beginPath(); g.moveTo(x - 7, y - 12); g.lineTo(x + 7, y - 12); g.lineTo(x, y - 3); g.closePath(); g.fill();
    g.fillStyle = 'rgba(42,26,16,.82)'; D.rrect(g, x - 150, y - 46, 170, 26, 8); g.fill();
    txt('a despensa tem! toque Entregar', x - 65, y - 33, T(12, C.cream));
  }
  function drawEdges(t) {          // setinhas: tem rua pros lados
    const a = 0.6 + Math.sin(t * 4) * 0.25;
    if (S.camX > 10) { g.globalAlpha = a; txt('◀', 18, 290, TS(22)); g.globalAlpha = 1; }
    if (S.camX < WORLD - W - 10) { g.globalAlpha = a; txt('▶', W - 18, 290, TS(22)); g.globalAlpha = 1; }
  }

  /* ======================================================================
     Entrada: arrastar passeia pela rua, toque seleciona
     ====================================================================== */
  let drag = null;
  input.on('down', (x, y) => {
    const b = btns.slice().reverse().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    drag = { x, y, cam: S.camX, moved: false, b };
    if (b && b.w < W) pressBtn = { x: b.x, y: b.y };
    try { E.Audio && E.Audio.unlock && E.Audio.unlock(); } catch (e) { /* */ }
  });
  input.on('move', (x, y) => {
    if (!drag) return;
    if (Math.abs(x - drag.x) > 8) drag.moved = true;
    if (drag.moved && !S.choice && !focoOpen && drag.y > 52 && drag.y < BOT) { S.camX = U.clamp(drag.cam - (x - drag.x), 0, WORLD - W); S.camT = null; }
  });
  input.on('up', (x, y) => {
    const d = drag; drag = null; pressBtn = null;
    if (!d || d.moved) return;
    if (d.b) { d.b.fn(); return; }
    if (y < 52 || y >= BOT) return;
    const wx = x + S.camX;
    // morador?
    const p = people.slice().sort((a, b) => b.y - a.y).find(p => Math.abs(p.x - wx) < 22 && y > p.y - 70 && y < p.y + 6);
    if (p) {
      const oi = orderOf(p);
      p.jump = 1; sfx('yip', { vol: 0.4 });
      if (oi >= 0) { S.sel = oi; chat(p, oi >= 0 ? 'Quero ' + S.orders[oi].qty + ' ' + CFG.ITEMS[S.orders[oi].item].plural + '!' : '', 0.01); }
      else chat(p, p.def.fala[Math.floor(rng() * p.def.fala.length)], 2.6);
      toast(p.def.nome + ' · ' + p.def.job + ' · ama ' + CFG.ITEMS[p.def.fav].nome + ' · amizade nv ' + p.lv + ' (' + p.hearts + '/' + lvNeed(p) + ' ♥)');
      return;
    }
    if (wx < 360 && y < BASE + 10) { focoOpen = true; sfx('click'); return; }
    const L = lots.find(l => Math.abs(l.x - wx) < 76 && y < BASE + 6 && y > BASE - 110);
    if (L) {
      if (L.b) toast(BUILD[L.b].nome + ': ' + BUILD[L.b].fx);
      else if (L.res) toast('Casa de ' + L.res.def.nome);
      else if (L.obra) toast('Obra: fica pronta em ' + Math.ceil(L.obra) + ' s');
      else toast('Terreno livre: abre quando um morador sobe de amizade');
      L.bounce = 1; sfx('click');
    }
  });
  input.on('key', code => {
    if (code === 'ArrowLeft' || code === 'KeyA') { S.camT = U.clamp(S.camX - 300, 0, WORLD - W); }
    if (code === 'ArrowRight' || code === 'KeyD') { S.camT = U.clamp(S.camX + 300, 0, WORLD - W); }
  });

  /* ======================================================================
     Laço
     ====================================================================== */
  let lastDt = 1 / 60;
  function update(dt) {
    lastDt = dt;
    let left = dt * S.speed;
    while (left > 1e-6) { const st = Math.min(left, 1 / 30); sim(st); left -= st; }
    if (S.camT !== null) { S.camX += (S.camT - S.camX) * Math.min(1, dt * 4); if (Math.abs(S.camT - S.camX) < 1) S.camT = null; }
    ps.update(dt); fl.update(dt);
    if (clouds) clouds.update(dt); if (birds) birds.update(dt); if (ff) ff.update(dt);
    // pétalas / folhas / neve da estação
    const vx0 = S.camX, vx1 = S.camX + W;
    if (S.season === 0 && N.sakuraPetals) N.sakuraPetals(ps, { x0: vx0, x1: vx1, y0: 60, y1: 440 }, dt, 3);
    if (S.season === 2 && Math.random() < dt * 3) ps.add({ x: U.rnd(vx0, vx1), y: 60, vx: U.rnd(-20, 20), vy: 20, g: 12, life: 6, shape: 'leaf', w: 6, c: [C.ora, C.red, C.gold][Math.floor(Math.random() * 3)], sway: 2, vr: 2, fade: 0.3 });
    if (S.season === 3 && Math.random() < dt * 14) ps.add({ x: U.rnd(vx0, vx1), y: 56, vx: U.rnd(-10, 10), vy: 30, g: 4, life: 9, shape: 'dot', w: U.rnd(2, 4), c: C.white, sway: 1.5, fade: 0.2 });
  }
  function render() {
    const t = performance.now() / 1000;
    btns = []; drawList = [];
    g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    drawSky(t);
    g.save(); g.translate(-Math.round(S.camX), 0);
    drawGroundBack(t);
    drawStreet(t);
    lotDrawables(t); propDrawables(t); personDrawables(t);
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) d.fn();
    streetLanterns(t);
    ps.draw(g);
    g.restore();
    // luz da hora (fim de tarde quente; festival = noite com lanternas)
    if (N.grade) N.grade(g, W, BOT, { tod: tod(), horizon: 216, strength: 0.8 });
    if (ff && night() > 0.5) { g.save(); g.translate(-Math.round(S.camX), 0); ff.draw(g, night()); g.restore(); }
    g.save(); g.translate(-Math.round(S.camX), 0);
    drawBubbles(t); fl.draw(g);
    g.restore();
    drawEdges(t);
    drawTopBar(t);
    drawOrders(t);
    drawHint(t);
    drawHeartsFly(lastDt);
    drawFoco(t);
    drawChoice(t);
  }

  /* ======================================================================
     Começo e cenas pra print
     ====================================================================== */
  function quiet(sec) { S.fast = true; let left = sec; while (left > 1e-6) { const st = Math.min(left, 1 / 30); sim(st); left -= st; } S.fast = false; }
  function setup() {
    S.money = 0;
    const cena = Q.get('cena');
    if (cena === 'pedido') {
      quiet(8); S.stock.onigiri = 200; S.stock.mochi = 60; S.stock.bento = 20; S.camX = 330; S.sel = 0; S.hint = 1;
      const o = S.orders[0]; if (o) S.camX = U.clamp(o.p.x - 380, 0, WORLD - W);
    } else if (cena === 'escolha') {
      quiet(6); const p = people.find(q => q.def.id === 'momo'); p.lv = 2; levelUp(p); S.choice = pending.shift(); S.camX = 900;
    } else if (cena === 'festa' || cena === 'cheia') {
      S.stock = { onigiri: 200, mochi: 70, bento: 24 };
      ['kiku', 'taro', 'genji', 'momo'].forEach(id => { const p = people.find(q => q.def.id === id); addHearts(p, lvNeed(p)); });
      quiet(14);
      people.forEach(p => { p.x = U.clamp(p.x, 400, WORLD - 60); });
      if (cena === 'festa') { S.fest = CFG.FEST_NEED; startFest(); quiet(5); S.camX = S.camT; S.camT = null; }
      else { S.season = 2; S.camX = 820; }
    }
  }
  setup();
  const loop = E.Loop({ update, render });
  loop.start();

  /* ======================================================================
     Ganchos de teste
     ====================================================================== */
  window.__cidade = {
    S, CFG, people, lots,
    get state() {
      return { t: Math.round(S.t), money: Math.round(S.money), hearts: S.hearts, fest: S.fest, season: SEASONS[S.season].nome, delivered: S.delivered,
        firstDeliver: S.firstDeliver, stock: Object.fromEntries(ITEM_IDS.map(k => [k, Math.floor(S.stock[k])])),
        orders: S.orders.map(o => o && { quem: o.p.def.nome, item: o.item, qty: o.qty, hearts: o.hearts }),
        people: people.map(p => ({ id: p.def.id, lv: p.lv, hearts: p.hearts })), lots: lots.map(l => l.b || (l.res && l.res.def.id) || (l.obra ? 'obra' : '-')), log: S.log.slice(-12) };
    },
    step(sec) { quiet(sec); return this.state; },
    deliver, fest() { S.fest = CFG.FEST_NEED; startFest(); },
    levelUp(id) { const p = people.find(q => q.def.id === id); if (p) addHearts(p, lvNeed(p) - p.hearts); },
    choose, money(v) { S.money = v; }, cam(x) { S.camX = x; S.camT = null; }, foco(k) { S.foco = k; },
    // jogador robô: entrega tudo que dá e escolhe a 1ª construção (pra medir ritmo: __cidade.bot(600))
    bot(sec) { S.fast = true; for (let k = 0; k < sec; k += 0.5) { for (let i = 0; i < 3; i++) if (canDeliver(i)) deliver(i); if (S.fest >= CFG.FEST_NEED) startFest(); let l = 0.5; while (l > 1e-6) { sim(1 / 30); l -= 1 / 30; } if (S.choice) choose(S.choice.opts[0]); } S.fast = false; return this.state; },
  };
})();
