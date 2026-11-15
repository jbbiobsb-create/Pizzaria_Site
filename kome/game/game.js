/* Kome no Japão — game.js (FASE 1: núcleo jogável, da pata até a Bagger 293 e a casa)
   Módulos neste arquivo, nesta ordem:
     1 estado e save · 2 stats() (redutor único dos efeitos) · 3 mundo (montanha, bolsões) · 4 economia (cavar, pagar, combo,
     sacos, onigiri, automação abstrata) · 5 condutores das ferramentas (um por `kind`) · 6 compras e celebração ·
     7 câmera e desenho · 8 laço, entrada, áudio e ganchos de teste (window.__kome).
   update(dt) nunca desenha nem toca DOM pesado; render() nunca muda estado: step() consegue avançar o jogo sem desenhar.
   Pontos de extensão pra Fase 2: G.Game.on(ev, fn) (eventos: dug, pay, buyTool, buyNode, buyHouse, pocket, sack, ending),
   S.fleet (máquinas antigas), S.helpers, G.World.props/layers, G.HUD.zones, autoTick() (trocar a automação abstrata). */
(function () {
  'use strict';
  const E = window.KomeEngine, G = window.KomeGame, D = G.Data, Wd = G.World, HUD = G.HUD;
  const U = E.U, PAL = E.PAL, Draw = E.Draw, UI = E.UI || null;
  const Sfx = E.Sfx || null, Loops = E.Loops || null, Music = E.Music || null, AudioE = E.Audio || null;
  const W = 960, H = 540, WL = D.WORLD, EC = D.ECON, TOOLS = D.TOOLS, NT = TOOLS.length;
  const LANE_Y = 16;                                   // faixa da frente do pátio (máquinas estacionadas)
  const PARK = { trator: 1380, empilhadeira: 1230, escav: 1040, pacabo: 640, caminhao: 300 };
  const PILOT_PAL = { trator: 'goma', empilhadeira: 'kuro', escav: 'shiro', pacabo: 'cha', caminhao: 'aka' };
  const HELP_PAL = ['goma', 'kuro', 'shiro', 'cha', 'aka', 'yuki', 'sakura', 'matcha', 'sumi', 'kin'];
  const em = E.Emitter(); let nListen = 0;
  let FAST = false;                                    // true dentro de step(): sem DOM, sem som, sem partículas de enfeite

  /* =====================================================================
     1. Estado e save
     ===================================================================== */
  const S = (G.S = {
    money: 0, earned: 0, tool: 0, own: {}, house: 0, time: 0, dug: 0, ended: false, bagX: 0,
    opts: { mute: false, music: true, shake: true },
    stats: { bestIps: 0, sacks: 0, bestSack: 0, pockets: 0, bestCombo: 0, perfectSecs: 0, crowned: 0, onigiri: 0, buys: 0, comboMaxSecs: 0 },
    // tempo de execução (não vai pro save)
    ips: 0, ipsAcc: 0, ipsT: 0, combo: 0, comboMaxT: 0, furia: 0, slide: 0, estreia: 0,
    pend: 0, pendAge: 0, payT: 0, budget: 0, digT: 9, lastDigX: WL.START_X, stompT: 0,
    heapTotal: 1, heapArea: 1, footX: WL.MX0, footT: 0,
    fleet: [], helpers: [], sacks: [], sackT: 20, oni: { on: false, x: 0, y: 0, t: 0, n: 1 }, oniT: 55,
    col: { x: 0, y: 0, kind: 'cesto', pulse: 0 }, cele: { t: -1, id: '', z0: 1 }, perfectForce: 0, perfT: 0, x3T: 0,
    boingT: 0, hornT: 0, autoT: 0, autoMode: false, cartCrown: false, stamp: 0, m: null, loader: null, bag: null,
    perf: { upd: 0, ren: 0 },
    win: { got: 0, val: 0, inc: [0, 0, 0] },      // diagnóstico da janela atual (o playtest lê e zera a cada ferramenta)
  });
  const P = (G.P = { x: WL.START_X, y: 0, vx: 0, vy: 0, face: 1, ground: true });   // Kome / máquina atual
  const ptr = { wx: WL.START_X + 40, wy: -20, down: false, has: false };
  const hook = { on: false, wx: 0, wy: 0, use: false };

  let stage, g, input, cam, parts, floaters, fx, heap, save, loop, cur, T, st;
  let extra = 1, celeCard = null, loopH = null, loopT = 0, sndT = 0, coinT = 0, saveT = 0, tapEat = false, audioOn = false;

  const sfx = (n, o) => { if (FAST || !Sfx || !Sfx.play || S.opts.mute) return; try { Sfx.play(n, o); } catch (e) { /* sem áudio */ } };
  const ui = fn => { if (!FAST && UI && HUD.ready) { try { fn(); } catch (e) { console.warn('[kome] ui', e); } } };

  function saveNow() {
    if (!save) return;
    const d = save.data || save.load();
    d.v = 4; d.money = S.money; d.earned = S.earned; d.tool = S.tool; d.tree = Object.keys(S.own); d.house = S.house; d.time = S.time; d.dug = S.dug;
    d.ended = S.ended; d.bagX = S.bagX; d.px = P.x; d.stats = S.stats; d.opts = S.opts; d.h = heap.serialize();
    d.found = heap.pockets.map(p => (p.found ? 1 : 0)).join('');
    save.save();
  }
  function loadState() {
    const d = save.load();
    if (!d || !d.v) return false;
    S.money = +d.money || 0; S.earned = +d.earned || 0; S.tool = U.clamp(d.tool | 0, 0, NT - 1); S.house = d.house | 0; S.time = +d.time || 0; S.dug = +d.dug || 0;
    S.ended = !!d.ended; S.bagX = +d.bagX || 0; S.own = {}; (d.tree || []).forEach(id => { if (D.nodeById[id]) S.own[id] = true; });
    Object.assign(S.stats, d.stats || {}); Object.assign(S.opts, d.opts || {});
    if (d.h) { try { heap.deserialize(d.h); } catch (e) { console.warn('[kome] montanha do save não abriu'); } }
    if (d.found) heap.pockets.forEach((p, i) => { p.found = d.found[i] === '1'; });
    P.x = +d.px || WL.START_X;
    return true;
  }

  /* =====================================================================
     2. stats(): TODOS os efeitos de árvore, sinergias e casa passam por aqui
     ===================================================================== */
  const MUL = { dig: 1, sell: 1, sack: 1, hm: 1, hv: 1, pm: 1, val: 1, spd: 1, reach: 1, powMul: 1, boom: 1 };
  function computeStats() {
    const s = { dig: 1, sell: 1, sack: 1, hm: 1, hv: 1, pm: 1, val: 1, spd: 1, reach: 1, powMul: 1, boom: 1, help: 0, crit: 0, critMult: 5,
      gold: D.POCKETS.mult, comboCap: D.COMBO.cap, oni: 0, auto: 0, pilots: {}, nodes: 0 };
    const ap = f => {
      for (const k in f) {
        const v = f[k];
        if (MUL[k]) s[k] *= v;
        else if (k === 'help' || k === 'crit') s[k] += v;
        else if (k === 'gold' || k === 'comboCap' || k === 'oni' || k === 'auto') s[k] = Math.max(s[k], v);
        else if (k === 'pilot') s.pilots[v] = true;
        else s[k] = v;
      }
    };
    for (const n of D.TREE) if (S.own[n.id]) { ap(n.fx); s.nodes++; }
    for (const y of D.SYN) if (S.own[y.a] && S.own[y.b]) ap(y.fx);
    for (let i = 0; i < S.house && i < D.HOUSE.length; i++) ap(D.HOUSE[i].perk);
    st = s;
    if (heap) for (const p of heap.pockets) p.mult = s.gold;
    return s;
  }
  const toolCost = t => Math.ceil(t.cost * EC.COST_TOOL);
  const nodeCost = n => Math.ceil(n.c * EC.COST_NODE);
  const houseCost = h => Math.ceil(h.c * EC.COST_HOUSE);
  // nodeState(n) -> 'owned' | 'open' | 'locked'
  function nodeState(n) {
    if (S.own[n.id]) return 'owned';
    if (S.tool + 1 < n.tier) return 'locked';
    for (const r of n.req) if (!S.own[r]) return 'locked';
    return 'open';
  }

  /* =====================================================================
     3. Mundo: a montanha (E.Heap) com camadas por profundidade, núcleo e bolsões
     ===================================================================== */
  function mountainShape(x) {
    if (x <= WL.MX0 || x >= WL.MX1) return 0;
    const a = (x - WL.MX0) * WL.SLOPE, b = (WL.MX1 - x) * WL.SLOPE;
    const base = Math.min(a, b, WL.MH), edge = Math.min(1, Math.min(x - WL.MX0, WL.MX1 - x) / 200);
    return Math.max(0, base + edge * (9 * Math.sin(x * 0.011) + 5 * Math.sin(x * 0.037 + 1)));
  }
  function buildWorld() {
    heap = E.Heap({ width: WL.WW, colW: WL.COLW, x0: 0, y0: 0, seed: WL.SEED, layers: D.MATS, onPocket });
    if (!heap.layers || !heap.layers.length) heap.setLayers(D.MATS);
    heap.minK = 0.41;
    heap.generate(mountainShape);
    heap.wake().settle(4000);                                   // nasce já assentada no talude do arroz solto
    heap.fromArray(heap.h.slice());
    heap.onPocket = onPocket;
    const r = E.RNG(WL.SEED), PK = D.POCKETS;
    let made = 0, guard = 0;
    while (made < PK.n && guard++ < 4000) {
      const early = made < 5;                                   // os primeiros ficam perto do começo, rasos
      const x = early ? r.range(2000, 2700) : r.range(2300, 7600), rad = early ? r.range(35, 48) : r.range(PK.r[0], PK.r[1]);
      const hs = heap.h0[heap.col(x)], dep = PK.minDepth + rad + (early ? r.range(0, 40) : r.range(0, Math.min(1100, hs * 0.6)));
      const alt = hs - dep;
      if (alt - rad < 8) continue;
      heap.addPocket({ x, y: alt, r: rad, mult: PK.mult, kind: 'gold' });
      made++;
    }
    S.heapTotal = heap.total; S.heapArea = heap.area;
    G.heap = heap;
  }
  const floorFn = x => heap.surf(x);
  const flatFn = () => LANE_Y;
  const baggerFloor = x => Math.min(0, heap.surf(x));
  // faceAhead(x, thr, max): primeiro x à frente onde o terreno sobe mais que thr acima de onde a máquina está
  function faceAhead(x, thr, max) {
    const h0 = heap.height(x);
    for (let d = 0; d <= max; d += 4) if (heap.height(x + d) - h0 > thr) return x + d;
    return x + max;
  }
  function scanFoot() {
    for (let x = WL.MX0 - 60; x < WL.MX1; x += 8) if (heap.height(x) > 20) return x;
    return WL.MX1;
  }
  // aim() -> {x,y}: um bom ponto pra segurar o ponteiro com a ferramenta atual (autoplayer e Kome Workaholic)
  const aimO = { x: 0, y: 0 };
  function aim() {
    const pow = cur.pow * st.powMul, k = cur.kind;
    if (k === 'hand' || k === 'push' || k === 'jack') {
      let best = -1, soft = -1, bestV = 0;
      for (let x = WL.MX0 - 40; x < WL.MX1; x += 8) {
        if (heap.height(x) < (k === 'push' ? 22 : 5)) continue;
        const mt = heap.topMat(x), kk = pow / mt.hard;
        if (kk < 0.41) continue;
        const sc = mt.val * Math.min(1, kk);                    // rende mais: material mais valioso que ainda corta bem
        if (soft < 0) soft = x;
        if (sc > bestV + 0.05) { bestV = sc; best = x; }
        if (x - soft > 420) break;
      }
      let x = (best >= 0 ? best : soft >= 0 ? soft : S.footX + 20) + (k === 'jack' ? 30 : 8);
      // se o ponto bom está logo ali, continua cavando onde está (não fica virando de costas pra montanha)
      const here = P.x + P.face * cur.reach * st.reach;
      if (P.face > 0 && Math.abs(x - here) < 70 && heap.height(here) > (k === 'push' ? 22 : 5) && pow / heap.topMat(here).hard >= 0.41 && heap.topMat(here).val * Math.min(1, pow / heap.topMat(here).hard) >= bestV - 0.06) x = here;
      aimO.x = x; aimO.y = heap.surf(aimO.x) - 4;
    } else if (k === 'bagger') {
      const m = S.m, b = T.bite(m);
      let x = m.x + 300;
      for (; x < WL.MX1; x += 8) if (heap.height(x) > 330) break;
      aimO.x = x + 30; aimO.y = -300;
      if (b && m.bite01 !== null && m.bite01 !== undefined) aimO.x = b.x + (0.55 - m.bite01) * 160;
    } else {
      const fxr = faceAhead(P.x, 16, 900);
      aimO.x = fxr + cur.r * 0.6; aimO.y = heap.surf(aimO.x) - cur.r * 0.3;
    }
    return aimO;
  }

  /* =====================================================================
     4. Economia
     ===================================================================== */
  const comboMult = () => 1 + (st.comboCap - 1) * S.combo / D.COMBO.max;
  // multiplicador de iene do que o Kome cava agora (preço x combo x eventos)
  function yenK() {
    return EC.P0 * extra * st.sell * st.val * (S.autoMode ? 1 : comboMult()) * (S.furia > 0 ? D.COMBO.furiaMult : 1) * (S.slide > 0 ? 1.5 : 1);
  }
  function Aeff() {
    return cur.A * st.dig * (S.estreia > 0 ? EC.ESTREIA_SPEED : 1) * (S.autoMode ? st.auto : 1);
  }
  const digO = { pow: 1 };
  // digAt(b, take, face, mode): tira `take` px² (em dureza 1) no ponto de mordida, do jeito de cada ferramenta, e contabiliza.
  //   mode 'rect' = vão retangular (britadeira, garfo, trombada do carrinho). Se a mordida pegou pouco arroz (ponta no ar,
  //   coluna rasa), o resto sai do barranco logo à frente, pra ferramenta render o A dela.
  function digAt(b, take, face, mode, w) {
    const k = cur.kind, R = cur.r * (S.estreia > 0 ? 1.15 : 1);
    digO.pow = cur.pow * st.powMul;
    let res;
    if (mode === 'rect') { const x0 = b.x - (face > 0 ? 0 : w); res = heap.digRect(x0, x0 + w, take / w, digO); }
    else if (k === 'hand') res = heap.dig(b.x + face * R * 0.3, take, R, digO);
    else res = heap.digCircle(b.x + face * R * 0.2, b.y, R, take, digO);
    let spent = res.got * res.hard + res.blocked;
    const blk = res.blocked;
    onDug(res, b.x, b.y);
    if (spent < take * 0.85 && blk < take * 0.3) {
      const x2 = b.x + face * R, r2 = heap.dig(x2, take - spent, R * 2.2 + 12, digO);
      spent += r2.got * r2.hard + r2.blocked;
      onDug(r2, x2, b.y);
    }
    return Math.max(0, take - spent);                       // sobra volta pro orçamento (não se perde cavada por falta de arroz na ponta)
  }
  // onDug(res, x, y): contabiliza o que saiu da montanha (iene fica pendente até o momento de pagar)
  function onDug(res, x, y) {
    if (res.got > 0) {
      S.dug += res.got; S.lastDigX = x; S.digT = 0; S.win.got += res.got; S.win.val += res.val;
      S.pend += res.val * yenK();
      if (!FAST && res.gold > 0 && parts) parts.sparkle(x, y, 2, GOLD_SPK);
      if (nListen) em.emit('dug', res, x, y);
    }
    if (res.blocked > 0.5 && res.blocked > res.got * 3) boing(res.hardMat, x, y);
  }
  const GOLD_SPK = { c: PAL.goldL };
  function boing(mat, x, y) {
    if (S.boingT > 0) return;
    S.boingT = 1.1;
    let need = null;
    if (mat) for (let i = S.tool + 1; i < NT; i++) if (TOOLS[i].pow / mat.hard >= 0.41) { need = TOOLS[i].name; break; }
    if (!FAST) {
      floaters.add(x, y - 26, 'duro demais!', { c: PAL.pink, size: 15, life: 1.2 });
      if (need) floaters.add(x, y - 10, 'precisa: ' + need, { c: PAL.cream, size: 11, life: 1.4, pop: 0 });
      cam.kick(-P.face * 5, 0);
    }
    sfx('boing');
  }
  function onPocket(p) {
    S.stats.pockets++;
    em.emit('pocket', p);
    if (FAST) return;
    sfx('shing'); if (Sfx && Sfx.gold && !S.opts.mute) { try { Sfx.gold(); } catch (e) { /* */ } }
    fx.hitstop(0.06); fx.flash(PAL.goldL, 0.25, 0.4);
    parts.coins(p.x, -p.y, 14);
    ui(() => UI.banner('BOLSÃO DOURADO!', 'arroz dourado vale ×' + st.gold, { icon: 'star', tone: 'gold', dur: 1.6 }));
  }

  /* fila de pagamentos: o arroz viaja até o coletor e o ¥ estoura lá (adendo §9) */
  const pays = []; for (let i = 0; i < 48; i++) pays.push({ on: false, t: 0, v: 0, kind: 0, crit: false });
  const TRAVEL = { shape: 'grain', c: PAL.rice, w: 2.4, life: 0.5, ol: true, g: 700, vx: 0, vy: 0, x: 0, y: 0 };
  // pay(v, sx, sy, kind, crit): kind 0 = Kome, 1 = automação (pop pequeno e cinza), 2 = prêmio (saco, onigiri: na hora)
  function pay(v, sx, sy, kind, crit) {
    if (!(v > 0)) return;
    let e = null;
    for (let i = 0; i < pays.length; i++) if (!pays[i].on) { e = pays[i]; break; }
    if (!e) { credit(v, kind, crit); return; }
    const c = S.col, dx = c.x - sx, dy = (c.y - 20) - sy, dist = Math.sqrt(dx * dx + dy * dy);
    const Tt = kind === 2 ? 0 : U.clamp(dist / 1300, D.PAY_DELAY[0], D.PAY_DELAY[1]);
    e.on = true; e.t = Tt; e.v = v; e.kind = kind; e.crit = !!crit;
    if (!FAST && kind === 0 && Tt > 0 && cam.visible(sx, sy, 60)) {
      const n = Math.min(8, 2 + (S.tool >> 1)), gg = 700 / Math.max(0.3, cam.z);
      for (let i = 0; i < n; i++) {
        const tt = Tt * (0.85 + 0.15 * i / n);
        TRAVEL.x = sx + (i - n / 2) * 2; TRAVEL.y = sy; TRAVEL.g = gg; TRAVEL.life = tt; TRAVEL.w = 2.2 / Math.min(1, cam.z + 0.2);
        TRAVEL.vx = dx / tt; TRAVEL.vy = dy / tt - 0.5 * gg * tt; TRAVEL.c = crit || S.estreia > 0 ? PAL.goldL : PAL.rice;
        parts.add(TRAVEL);
      }
    }
  }
  const POP = [[0.5, 12, PAL.white], [2, 16, '#FFF3B0'], [10, 22, PAL.ora], [60, 30, PAL.gold], [1e18, 40, PAL.goldL]];
  const edge = { x: 0, y: 0 };
  function credit(v, kind, crit) {
    S.money += v; S.earned += v; S.ipsAcc += v; S.col.pulse = 1; S.win.inc[kind] += v;
    if (nListen) em.emit('pay', v, kind);
    if (FAST) return;
    const secs = v / Math.max(1, S.ips), c = S.col;
    let i = 0; while (secs >= POP[i][0]) i++;
    if (kind === 1 && i > 0) i = 0;
    let x = c.x, y = c.y - 34 / Math.max(0.4, cam.z);
    if (!cam.visible(x, y, 0)) {                                   // coletor fora da tela: o pop aparece na borda, do lado dele
      cam.toWorld(x < cam.x ? 46 : W - 46, H * 0.6, edge); x = edge.x; y = edge.y; S.col.edge = 1;
    }
    const txt = '+¥' + U.fmt(v) + (crit ? ' kin!' : '') + (st.nodes && S.own.m_d ? ' ^_^' : '');
    floaters.add(x + U.rnd(-10, 10) / cam.z, y, txt, { c: kind === 1 ? PAL.grayL : crit ? PAL.gold : S.own.m10 ? PAL.goldL : POP[i][2], size: (kind === 1 ? 10 : POP[i][1]) * (crit ? 1.25 : 1), life: 0.9 + i * 0.15, shake: cur.kind === 'jack' ? 1.2 : i >= 4 ? 1.5 : 0, pop: 1 + i * 0.25 });
    if (i >= 2 && kind !== 1) { parts.coins(x, y, 2 + i * 2); HUD.bump(); }
    if (i >= 4) fx.hitstop(0.06);
    if (crit && S.own.s7) parts.coins(x, y, 6);
    if (coinT <= 0 && kind !== 1 && Sfx && !S.opts.mute) { coinT = 0.085; try { Sfx.coin ? Sfx.coin(S.combo | 0) : Sfx.play('kaching'); } catch (e) { /* */ } }
  }
  // flush(sx, sy, mult): paga o que estava pendente (com crítico e surpresa ×3)
  function flush(sx, sy, mult) {
    let v = S.pend * (mult || 1); S.pend = 0; S.pendAge = 0; S.payT = 0;
    if (!(v > 0)) return;
    let crit = false;
    if (st.crit > 0 && Math.random() < st.crit) { v *= st.critMult; crit = true; if (st.critCombo) S.combo = Math.min(D.COMBO.max, S.combo + st.critCombo); }
    if (Math.random() < EC.SURPRISE) { v *= EC.SURPRISE_MULT; if (!FAST) floaters.add(sx, sy - 30, '×3 NESTA ' + (cur.kind === 'bagger' ? 'MORDIDA' : cur.seat === 'cab' ? 'CONCHADA' : 'PATADA') + '!', { c: PAL.gold, size: 18 }); }
    pay(v, sx, sy, 0, crit);
  }

  function ecoTick(dt, hold) {
    const C = D.COMBO;
    S.digT += dt; if (S.boingT > 0) S.boingT -= dt; if (coinT > 0) coinT -= dt; if (sndT > 0) sndT -= dt;
    if (S.estreia > 0) S.estreia -= dt; if (S.slide > 0) S.slide -= dt; if (S.col.pulse > 0) S.col.pulse = Math.max(0, S.col.pulse - dt * 3);
    // combo
    if (S.digT < C.idle && !S.autoMode) S.combo = Math.min(C.max, S.combo + C.gain * dt); else S.combo = Math.max(0, S.combo - C.decay * dt);
    if (S.combo > S.stats.bestCombo) S.stats.bestCombo = S.combo;
    if (S.furia > 0) S.furia -= dt;
    else if (st.furia && S.combo >= C.max) {
      S.comboMaxT += dt; S.stats.comboMaxSecs += dt;
      if (S.comboMaxT >= C.furiaHold) { S.comboMaxT = 0; S.furia = C.furiaSec; if (!FAST) { fx.speedlines(true, { col: PAL.red }); sfx('howl'); ui(() => UI.banner('FÚRIA DO KOME!', 'iene ×2 por 5 segundos', { icon: 'bolt', tone: 'gold', dur: 1.4 })); } }
    } else S.comboMaxT = 0;
    if (S.furia <= 0 && !FAST && fx._fl) { fx.speedlines(false); fx._fl = false; } else if (S.furia > 0) fx._fl = true;
    // pagamentos chegando no coletor
    for (let i = 0; i < pays.length; i++) { const e = pays[i]; if (e.on && (e.t -= dt) <= 0) { e.on = false; credit(e.v, e.kind, e.crit); } }
    // ¥/s (média móvel)
    S.ipsT += dt;
    if (S.ipsT >= 1) { S.ips += (S.ipsAcc / S.ipsT - S.ips) * 0.22; S.ipsAcc = 0; S.ipsT = 0; if (S.ips > S.stats.bestIps) S.stats.bestIps = S.ips; }
    // deslizamento (s12)
    if (st.slide && heap.flow > 40000 * dt && S.slide <= -30) { S.slide = 3; ui(() => UI.banner('DESLIZAMENTO!', 'iene ×1,5 por 3 segundos', { icon: 'bolt', dur: 1.4 })); if (!FAST) cam.addTrauma(0.5); }
    // sacos
    if (hold && S.digT < 1) S.sackT -= dt;
    if (S.sackT <= 0) { S.sackT = D.SACK.every * U.rnd(D.SACK.jitter[0], D.SACK.jitter[1]); spawnSack(); }
    for (let i = S.sacks.length - 1; i >= 0; i--) {
      const k = S.sacks[i]; k.t += dt;
      const gy = heap.surf(k.x);
      if (k.y < gy) { k.vy += 900 * dt; k.y = Math.min(gy, k.y + k.vy * dt); }
      if (k.state === 0 && st.autosack && k.t > 2) tapSack(k);
      if (k.state === 1) { k.sh -= dt; if (k.sh <= 0) { popSack(k); S.sacks.splice(i, 1); continue; } }
      else if (k.t > D.SACK.life) S.sacks.splice(i, 1);
    }
    // onigiri da sorte
    if (st.oni > 0) {
      const o = S.oni;
      if (!o.on) { S.oniT -= dt; if (S.oniT <= 0) { o.on = true; o.t = 0; o.x = -30; o.y = 110 + Math.random() * 120; o.n = S.own.s9 ? 2 : 1; S.oniT = U.rnd(D.ONIGIRI.every[0], D.ONIGIRI.every[1]); sfx('trill'); } }
      else { o.t += dt; o.x = -30 + (W + 60) * o.t / D.ONIGIRI.life; if (o.t > D.ONIGIRI.life) o.on = false; }
    }
    // patada sísmica (c3)
    if (st.stomp && cur.seat === 'paw' && hold && S.digT < 0.5) {
      S.stompT += dt;
      if (S.stompT >= D.STOMP.every) {
        S.stompT = 0; digO.pow = cur.pow * st.powMul;
        const x = P.x + P.face * cur.reach;
        onDug(heap.dig(x, cur.A * st.dig * D.STOMP.worthSec, cur.r * D.STOMP.radMul, digO), x, P.y);
        if (!FAST) { cam.addTrauma(0.35); parts.puff(x, P.y, 10, 9, { c: PAL.sand }); fx.shock && fx.shock(cam.toScreen(x, P.y).x, cam.toScreen(x, P.y).y); sfx('stomp'); }
      }
    }
    S.slide = S.slide > 0 ? S.slide : Math.max(-31, S.slide - dt);
    // recarga de segurança (anti-encalhe)
    if (S.heapArea < S.heapTotal * EC.REFILL_AT && S.house < D.HOUSE.length) {
      heap.add(4900, S.heapTotal * EC.REFILL_ADD, 1400);
      ui(() => UI.banner('ARROZ IMPORTADO!', 'um trem despejou mais arroz na montanha', { icon: 'rice' }));
    }
  }

  /* ---- sacos (recompensa variável com antecipação) ---- */
  function spawnSack() {
    if (S.sacks.length >= 4) return;
    let r = Math.random(), gi = 0; const GA = D.SACK.gacha;
    for (; gi < GA.length - 1; gi++) { if (r < GA[gi].p) break; r -= GA[gi].p; }
    const x = U.clamp(P.x - P.face * U.rnd(50, 110) / Math.min(1, cam ? cam.z : 1), 950, WL.MX1);
    S.sacks.push({ x, y: heap.surf(x) - 160, vy: 0, t: 0, g: gi, state: 0, sh: 0, v: 0 });
  }
  function tapSack(k) {
    if (k.state) return;
    const ga = D.SACK.gacha[k.g];
    k.state = 1; k.sh = FAST ? 0 : ga.shake;
    k.v = ga.m * D.SACK.worthSec * Math.max(S.ips, cur.A * EC.P0) * st.sack * U.rnd(D.SACK.vary[0], D.SACK.vary[1]);
    sfx('sack');
  }
  function popSack(k) {
    const ga = D.SACK.gacha[k.g];
    S.stats.sacks++; if (k.v > S.stats.bestSack) S.stats.bestSack = k.v;
    pay(k.v, k.x, k.y, 2);
    em.emit('sack', k);
    if (FAST) return;
    floaters.add(k.x, k.y - 30, 'saco ×' + String(ga.m).replace('.', ',') + '  +¥' + U.fmt(k.v), { c: ga.m >= 3 ? PAL.gold : PAL.cream, size: ga.m >= 10 ? 30 : ga.m >= 3 ? 20 : 14, life: 1.5 });
    parts.coins(k.x, k.y - 10, ga.m >= 3 ? 16 : 6); parts.burst(k.x, k.y - 8, 14, { shape: 'grain', c: S.own.s5 ? PAL.sakura : PAL.rice, speed: [40, 160], life: 0.8 });
    sfx('pop');
    if (ga.m >= 10) { fx.hitstop(0.08); fx.flash(PAL.goldL, 0.3, 0.5); ui(() => UI.banner('SACO LENDÁRIO ×10!', '+¥' + U.fmt(k.v), { icon: 'sack', tone: 'gold' })); }
  }
  function tapOnigiri() {
    const o = S.oni; if (!o.on) return;
    o.on = false; S.stats.onigiri++;
    const v = (o.n > 1 ? D.ONIGIRI.worthSec2 : D.ONIGIRI.worthSec) * Math.max(S.ips, cur.A * EC.P0);
    pay(v, P.x, P.y, 2);
    if (!FAST) { ui(() => UI.toast('Onigiri da Sorte!', { icon: 'star', tone: 'gold', sub: '+¥' + U.fmt(v) })); sfx('sparkle'); fx.flash(PAL.cream, 0.2, 0.3); }
  }
  // tapAll(): estoura tudo que dá pra tocar (autoplayer)
  function tapAll() { for (const k of S.sacks) tapSack(k); if (S.oni.on) tapOnigiri(); }

  /* ---- automação abstrata (Fase 2 troca por ajudantes e pilotos de verdade, cavando o mesmo heightfield) ---- */
  function autoTick(dt) {
    S.autoT += dt; if (S.autoT < 0.5) return;
    const d = S.autoT; S.autoT = 0;
    const kHV = EC.P0 * extra * st.sell * st.val * st.hv;
    if (st.help > 0) {
      const A = TOOLS[Math.min(S.tool, D.toolIndex.escav)].A, r = cur.r * 1.5;
      digO.pow = cur.pow * st.powMul;
      const x = S.lastDigX + U.rnd(-6, 6) * cur.r;
      const res = heap.dig(x, st.help * EC.HR * A * st.hm * d, Math.max(18, r), digO);
      if (res.got > 0) { S.dug += res.got; pay(res.val * kHV, x, heap.surf(x), 1); }
    }
    for (let i = 0; i < S.fleet.length; i++) {
      const f = S.fleet[i]; if (!st.pilots[f.id]) continue;
      const t = TOOLS[D.toolIndex[f.id]];
      digO.pow = t.pow;
      const x = S.footX + 30 + ((i * 97 + (S.time * 13 | 0) * 53) % 260);
      const res = heap.dig(x, EC.PR * t.A * st.pm * d, t.r * 1.5, digO);
      if (res.got > 0) { S.dug += res.got; pay(res.val * kHV, x, heap.surf(x), 1); }
    }
  }

  /* =====================================================================
     5. Condutores das ferramentas (um por kind). Todos usam a interface comum G.Tools[id].
     ===================================================================== */
  const inp = { x: 0, y: 0, face: 1, tx: 0, ty: 0, digging: false, power: 1, speedMul: 1, vx: 0, floor: floorFn, load: 0, t: 0, parts: null, boost: 0, night: 0, zoom: 1, horn: false };
  const iL = { x: 0, y: 0, face: 1, tx: 0, ty: 0, digging: false, power: 1, speedMul: 1, vx: 0, floor: floorFn, t: 0, parts: null, boost: 0, night: 0 };            // pá do Tetsu
  const iT = { x: 0, y: 0, face: 1, tx: 0, ty: 0, digging: false, power: 1, speedMul: 1, vx: 0, floor: floorFn, t: 0, parts: null, boost: 0, night: 0, loader: true }; // caminhão do Kome
  const iF = { x: 0, y: LANE_Y, face: 1, tx: null, ty: null, digging: false, power: 0.3, speedMul: 1, vx: 0, floor: flatFn, t: 0, parts: null, boost: 0, night: 0, zoom: 1 }; // frota parada
  const LX = { x: 0, vx: 0 };                                     // posição da pá carregadeira (degrau do caminhão)

  function animSpeed() { return U.clamp(Math.sqrt(st.dig) * (S.estreia > 0 ? 1.6 : 1) * (S.furia > 0 ? 1.2 : 1), 0.6, 2.4); }
  // gasta o orçamento de cava quando a mordida está ativa
  function biteStep(m, tool, face, working, dt, src) {
    const A = Aeff();
    if (working) S.budget = Math.min(S.budget + A * dt, A * Math.max(1.5, (cur.cycle || 1.2) * 1.5));
    const b = tool.bite(m);
    if (b.active && S.budget > 0) {
      const take = S.budget;
      if (cur.kind === 'jack') { b.x -= cur.r * 0.5; S.budget = digAt(b, take, 1, 'rect', cur.r); b.x += cur.r * 0.5; } else S.budget = digAt(b, take, face);
    }
    return b;
  }
  function toolEvents(m) {
    let payNow = false;
    for (let i = 0; i < m.ev.length; i++) {
      const ev = m.ev[i];
      if (cur.pay.indexOf(ev) >= 0) payNow = true;
      if (FAST) continue;
      if (ev === 'hit' || ev === 'tic' || ev === 'scoop' || ev === 'tat' || ev === 'clank') {
        if (sndT <= 0) { sndT = ev === 'tat' || ev === 'clank' ? 0.09 : 0.05; sfx(cur.sfx, { pitch: 1 + S.combo * 0.008, vol: ev === 'tat' ? 0.5 : 1 }); }
        if (S.opts.shake && cur.shake && ev !== 'tic') cam.addTrauma(cur.shake * (ev === 'tat' || ev === 'clank' ? 0.25 : 1));
      } else if (ev === 'dump') { sfx('dump'); if (S.opts.shake) cam.addTrauma(cur.shake * 1.3); }
      else if (ev === 'spin') { sfx('whoosh'); if (S.opts.shake) cam.addTrauma(0.3); }
      else if (ev === 'squeak') sfx('squeak', { vol: 0.5 });
      else if (ev === 'rev') sfx('engineStart', { vol: 0.5 });
      else if (ev === 'horn') sfx('hornBig');
      else if (ev === 'stall') { sfx('groan'); cam.addTrauma(0.3); }
      else if (ev === 'crack') sfx('crash', { vol: 0.5 });
    }
    return payNow;
  }
  function payStep(m, tool, dt, payNow, maxAge) {
    if (S.pend > 0) { S.pendAge += dt; S.payT += dt; }
    const cont = cur.pay.length === 0;
    if (S.pend > 0 && (payNow || (cont && S.payT >= EC.PAY_BATCH) || S.pendAge > maxAge)) {
      const d = tool.dump(m), b = tool.bite(m), src = d && !cont ? d : b;
      flush(src.x, src.y, 1);
    }
  }

  /* Kome a pé: anda até o ponteiro, cai com a gravidade na encosta e a ferramenta morde onde o ponteiro está */
  function driveHand(dt, hold) {
    const m = S.m, jack = cur.kind === 'jack', cart = cur.kind === 'push';
    const dx = ptr.wx - P.x;
    if (hold && !m.busy && Math.abs(dx) > 8) P.face = dx > 0 ? 1 : -1;
    const reach = (jack ? 8 : cur.reach * st.reach);
    const xT = ptr.wx - P.face * reach, dist = xT - P.x, spd = cur.spd * st.spd * 0.55;
    const want = hold && !(m.busy && !jack) ? U.clamp(dist * 9, -spd, spd) : 0;
    P.vx = U.damp(P.vx, want, 12, dt);
    P.x = U.clamp(P.x + P.vx * dt, 60, WL.WW - 60);
    const gy = heap.surf(P.x);
    if (P.y < gy - 1.5) { P.vy += 1500 * dt; P.y += P.vy * dt; P.ground = false; if (P.y >= gy) { P.y = gy; P.vy = 0; P.ground = true; } }
    else { P.y = gy; P.vy = 0; P.ground = true; }
    inp.x = P.x; inp.y = P.y; inp.face = P.face; inp.vx = P.vx; inp.tx = ptr.wx; inp.ty = ptr.wy;
    inp.digging = hold && P.ground && Math.abs(dist) < (cart ? 14 : 7);
    inp.speedMul = animSpeed(); inp.boost = S.estreia > 0 ? 1 : 0; inp.t = S.time; inp.floor = floorFn;
    T.update(m, dt, inp);
    const payNow = toolEvents(m);
    if (cart) {
      // carrinho: a trombada derruba um pedaço do barranco pra dentro da caçamba (adendo §4)
      const A = Aeff();
      if (inp.digging || m.busy) S.budget = Math.min(S.budget + A * dt, A * 1.6);
      for (let i = 0; i < m.ev.length; i++) if (m.ev[i] === 'hit' && S.budget > 0) {
        const b = T.bite(m);
        S.budget = digAt(b, S.budget, P.face, 'rect', cur.r * 1.6); S.cartCrown = Math.random() < D.CART.crownChance;
        if (!FAST) { fx.hitstop(0.035); if (S.cartCrown) floaters.add(b.x, b.y - 30, 'carga coroada!', { c: PAL.gold, size: 14 }); }
      }
      if (payNow && S.cartCrown) { S.pend *= D.CART.crownMult; S.stats.crowned++; S.cartCrown = false; }
    } else biteStep(m, T, P.face, inp.digging || (m.busy && !jack), dt);
    if (!FAST && st.spd > 1 && Math.abs(P.vx) > 60 && Math.random() < dt * 14) parts.puff(P.x - P.face * 8, P.y, 1, 4, { c: PAL.sand });
    payStep(m, T, dt, payNow, 2.5);
  }

  /* máquinas de cabine (trator, empilhadeira, escavadeira, pá de cabo): estacionam na distância de trabalho do barranco */
  function parkAt(x, vxObj, park, maxV, busy, dt, hold) {
    const fxr = faceAhead(x, 16, 900);
    let xT = fxr - park;
    if (hold) xT = Math.min(xT, ptr.wx - park * 0.5);
    xT = Math.max(WL.MX0 - 300, xT);
    const want = busy || !hold ? 0 : U.clamp((xT - x) * 3, -maxV, maxV);
    vxObj.vx = U.damp(vxObj.vx, want, 5, dt);
    parkAt.face = fxr; parkAt.near = Math.abs(fxr - park - x) < 34;
    return x + vxObj.vx * dt;
  }
  function driveMachine(dt, hold) {
    const m = S.m, fork = cur.kind === 'fork';
    P.x = parkAt(P.x, P, cur.park, cur.kind === 'rope' ? 30 : Math.min(130, cur.spd * 0.3), m.busy, dt, hold);
    P.y = heap.surf(P.x); P.face = 1;
    inp.x = P.x; inp.y = P.y; inp.face = 1; inp.vx = P.vx; inp.floor = floorFn; inp.t = S.time;
    inp.tx = Math.max(ptr.wx, parkAt.face + 10); inp.ty = Math.min(ptr.wy, P.y + 10);
    inp.digging = hold && parkAt.near; inp.speedMul = animSpeed(); inp.boost = S.estreia > 0 ? 1 : 0;
    T.update(m, dt, inp);
    const payNow = toolEvents(m);
    if (fork) {
      // empilhadeira: arranca um bloco no vão dos garfos (digRect) a cada espetada
      const A = Aeff();
      if (inp.digging || m.busy) S.budget = Math.min(S.budget + A * dt, A * 2);
      for (let i = 0; i < m.ev.length; i++) if (m.ev[i] === 'scoop' && S.budget > 0) {
        const b = T.bite(m), w = Math.max(24, b.w || 36) + 8;
        b.x -= w - 8; S.budget = digAt(b, S.budget, 1, 'rect', w); b.x += w - 8;
      }
    } else biteStep(m, T, 1, inp.digging || m.busy, dt);
    payStep(m, T, dt, payNow, 3.5);
  }

  /* caminhão de mineração: o Tetsu carrega com a pá de cabo, o Kome leva até a moega; o ¥ sai na basculada */
  function driveHaul(dt, hold) {
    const tr = S.m, sh = S.loader, TS = G.Tools.pacabo, TT = T, park = TOOLS[D.toolIndex.pacabo].park;
    const loadSide = ptr.wx > P.x - 60;
    LX.x = parkAt(LX.x, LX, park, 30, sh.busy, dt, hold && loadSide);
    iL.x = LX.x; iL.y = heap.surf(LX.x); iL.vx = LX.vx; iL.t = S.time; iL.tx = parkAt.face + 30; iL.ty = Math.min(ptr.wy, -40);
    iL.speedMul = iT.speedMul = animSpeed() * EC.HAUL_SPEED;
    const wantLoad = hold && loadSide && tr.load < 1.0;
    iL.digging = wantLoad && tr.wantsLoad && parkAt.near;
    TS.update(sh, dt, iL);
    // a pá cava (orçamento corre enquanto o ciclo do caminhão roda)
    const cyc = hold || tr.state !== 'idle';
    const A = Aeff();
    if (cyc) S.budget = Math.min(S.budget + A * dt, A * cur.cycle * 1.5);
    const b = TS.bite(sh);
    if (b.active && S.budget > 0) { const take = Math.min(S.budget, A * dt * 12); S.budget += digAt(b, take, 1) - take; }
    if (TS.dump(sh).active && tr.wantsLoad) TT.fill(tr, dt * iL.speedMul / (0.09 * 3.6) * 0.34);
    iT.x = TT.parkX(LX.x, 1, 1, 1); iT.y = heap.surf(iT.x); iT.vx = LX.vx; iT.t = S.time;
    iT.tx = loadSide || !hold ? parkAt.face : iT.x - 600;
    iT.digging = hold && loadSide && (tr.load < 1.0 || (sh.busy && sh.ph < 0.76));
    TT.update(tr, dt, iT);
    P.x = iT.x; P.y = iT.y; P.face = 1;
    let payNow = false;
    for (let i = 0; i < tr.ev.length; i++) {
      const ev = tr.ev[i];
      if (ev === 'dump') { payNow = true; if (!FAST) { sfx('dump'); if (S.opts.shake) cam.addTrauma(0.5); } }
      else if (ev === 'depart') { S.haulCrown = !!tr.crowned; if (tr.crowned) { S.stats.crowned++; if (!FAST) floaters.add(iT.x, iT.y - 220, 'CARGA COROADA ×1,25', { c: PAL.gold, size: 26 }); } else if (!FAST && tr.payload < 1) floaters.add(iT.x, iT.y - 220, Math.round(tr.payload * 100) + '%: faltou ' + Math.round((1 - tr.payload) * 100) + '% pra carga coroada', { c: PAL.cream, size: 20 }); sfx('hornBig', { vol: 0.4 }); }
      else if (ev === 'rev' && !FAST) sfx('engineStart', { vol: 0.5 });
    }
    for (let i = 0; i < sh.ev.length; i++) if (!FAST && (sh.ev[i] === 'hit' || sh.ev[i] === 'scoop') && sndT <= 0) { sndT = 0.2; sfx('ropeshovel'); if (S.opts.shake) cam.addTrauma(0.2); }
    if (S.pend > 0) S.pendAge += dt;
    if (S.pend > 0 && (payNow || S.pendAge > 45)) { const d = TT.dump(tr) || iT; flush(d.x, d.y, payNow && S.haulCrown ? D.HAUL.crown : 1); }
  }

  /* Bagger 293: fica no chão no pé da montanha, rasteja até o ponteiro, o ponteiro em Y é a lança, segurar gira a roda */
  function driveBagger(dt, hold) {
    const m = S.m, MO = D.MORDIDA, b0 = T.bite(m);
    let hx = m.x - 150;
    for (; hx < WL.MX1; hx += 8) if (heap.height(hx) > 70) break;
    const maxX = hx - 340 + (b0.x - m.x);
    inp.x = P.x; inp.y = 0; inp.face = 1; inp.floor = baggerFloor; inp.t = S.time; inp.zoom = cam.z;
    inp.tx = hold ? Math.min(ptr.wx, maxX) : b0.x; inp.ty = ptr.wy;
    inp.digging = hold || S.cele.spin; inp.speedMul = animSpeed() * (S.own.b1 ? 1.2 : 1); inp.boost = S.estreia > 0 ? 1 : 0;
    inp.horn = S.hornT > 0; if (S.hornT > 0) S.hornT -= dt;
    const bt = heap.bite(b0.x, b0.y, b0.r, 1, 12);
    m.bite01 = bt; m.band = st.mordida ? [MO.loK, MO.hiK] : [MO.lo, MO.hi];
    T.update(m, dt, inp);
    P.x = m.x; P.y = 0;
    const payNow = toolEvents(m), b = T.bite(m);
    // multiplicador da Mordida (GDD §3)
    let mult = 1, perfect = bt >= m.band[0] && bt <= m.band[1];
    if (S.perfectForce > 0) { S.perfectForce -= dt; perfect = true; }
    if (perfect) mult = st.mordida ? MO.mPerfectK : MO.mPerfect; else if (bt < MO.empty) mult = MO.mEmpty;
    if (hold && perfect && b.active) {
      S.stats.perfectSecs += dt; S.perfT += dt;
      if (st.mordida && S.perfT >= MO.x3After) { S.perfT = 0; if (Math.random() < MO.x3Chance) { S.x3T = 1; if (!FAST) floaters.add(b.x, b.y - 180, '×3 NESTA MORDIDA', { c: PAL.gold, size: 60 }); } }
    } else S.perfT = 0;
    if (S.x3T > 0) { S.x3T -= dt; mult *= 3; }
    S.mordida = perfect ? 2 : bt < MO.empty ? 0 : 1; S.bite01 = bt;
    if (b.active && hold) {
      digO.pow = cur.pow * st.powMul;
      const res = heap.digCircle(b.x, b.y, b.r * (st.boom > 1 ? 1.12 : 1), Aeff() * (m.rpm || 1) * mult * dt, digO);
      onDug(res, b.x, b.y);
      if (!FAST && res.fell > 0 && Math.random() < 0.5) parts.spray(b.x + 40, b.y - b.r, 2, { shape: 'grain', c: perfect ? PAL.goldL : PAL.rice, dir: Math.PI / 2, spread: 1, speed: [60, 200], life: 0.9, w: 7, g: 900 });
      if (!FAST && S.opts.shake) cam.addTrauma(dt * (perfect ? 0.5 : 0.25));
    }
    // as esteiras alisam o arroz embaixo delas
    digO.pow = 99;
    const fl = heap.digRect(m.x - 330, m.x + 330, 160 * dt, digO);
    if (fl.got > 0) { S.dug += fl.got; S.pend += fl.val * yenK(); }
    payStep(m, T, dt, payNow, 1);
  }

  /* frota: máquinas antigas estacionadas no pátio (cenário vivo; a Fase 2 põe elas pra trabalhar) */
  function rebuildFleet() {
    const ids = [];
    for (const id of ['trator', 'empilhadeira', 'escav', 'pacabo', 'caminhao']) {
      const i = D.toolIndex[id];
      if (i < S.tool && !(id === 'pacabo' && cur.kind === 'haul')) ids.push(id);
    }
    S.fleet = ids.map(id => {
      const old = S.fleet.find(f => f.id === id);
      return old || { id, x: PARK[id], y: LANE_Y, m: G.Tools[id].create({ pilot: PILOT_PAL[id], scale: 1 }), warm: false };
    });
  }
  function fleetTick(dt) {
    for (let i = 0; i < S.fleet.length; i++) {
      const f = S.fleet[i];
      if (FAST && f.warm) continue;
      if (!f.warm || cam.visible(f.x, -100, 700)) { iF.x = f.x; iF.y = f.y; iF.t = S.time; iF.parts = null; G.Tools[f.id].update(f.m, dt, iF); f.warm = true; }
    }
    if (S.bag && S.bag.m !== S.m && !FAST) { iF.x = S.bagX; iF.y = 0; iF.floor = baggerFloor; iF.zoom = cam.z; G.Tools.bagger.update(S.bag.m, dt, iF); iF.floor = flatFn; }
  }
  function ensureBag() {
    const stg = S.tool === NT - 1 ? 3 : S.own.bg2 ? 2 : S.own.bg1 ? 1 : 0;
    if (!stg) return;
    if (!S.bagX) S.bagX = Math.max(1000, scanFoot() - 760);
    if (!S.bag) S.bag = { m: G.Tools.bagger.create({ stage: stg }) };
    S.bag.m.stage = stg;
  }

  /* =====================================================================
     6. Compras e celebração
     ===================================================================== */
  // setTool(i): troca a ferramenta ativa (cria o rig, a frota, o coletor e o som de motor)
  function setTool(i) {
    S.tool = U.clamp(i, 0, NT - 1); cur = TOOLS[S.tool]; T = G.Tools[cur.id];
    extra = EC.EXTRA_BY_TOOL[S.tool] || 1;
    if (S.pend > 0) { credit(S.pend, 0, false); S.pend = 0; }
    S.budget = 0; S.loader = null; P.vx = 0; S.camX = P.x + 30;
    computeStats();
    if (cur.kind === 'bagger') { ensureBag(); S.m = S.bag.m; S.m.stage = 3; P.x = S.bagX; }
    else S.m = T.create({ pilot: 'kome', scale: 1 });
    if (cur.kind === 'haul') { S.loader = G.Tools.pacabo.create({ pilot: 'sumi', scale: 1 }); LX.x = Math.max(WL.MX0 - 300, faceAhead(Math.max(P.x - 300, WL.MX0 - 300), 16, 2000) - TOOLS[D.toolIndex.pacabo].park); LX.vx = 0; }
    if (cur.seat === 'cab' && cur.kind !== 'bagger' && cur.kind !== 'haul') { P.x = Math.max(WL.MX0 - 300, faceAhead(Math.min(P.x, S.footX) - 400, 16, 2000) - cur.park); }
    P.y = heap.surf(P.x); P.face = 1;
    S.col.kind = D.COLLECTOR[S.tool]; S.col.x = P.x - 80; S.col.y = heap.surf(S.col.x);
    rebuildFleet(); ensureBag();
    if (loopH) { try { loopH.stop(0.3); } catch (e) { /* */ } loopH = null; }
    if (!FAST && audioOn && Loops && cur.loop && !S.opts.mute) { try { loopH = Loops.start(cur.loop, { vol: 0.35, rate: 0.1 }); } catch (e) { loopH = null; } }
    if (!FAST && Sfx && Sfx.setTool) { try { Sfx.setTool(Math.min(S.tool, 11)); } catch (e) { /* */ } }
    musicTheme();
    HUD.refreshSlots();
  }
  function buyTool() {
    const t = TOOLS[S.tool + 1]; if (!t) return false;
    if (t.needs) for (const id of t.needs) if (!S.own[id]) { ui(() => UI.toast('Precisa: ' + D.nodeById[id].n, { icon: 'lock', tone: 'bad' })); return false; }
    const c = toolCost(t);
    if (S.money < c) { ui(() => UI.toast('Faltam ¥' + U.fmt(c - S.money), { icon: 'yen', tone: 'bad', sub: t.name })); sfx('error'); return false; }
    S.money -= c; S.stats.buys++;
    const z0 = cam ? cam.z : 1, ips0 = S.ips;
    setTool(S.tool + 1);
    celebrate(t, z0, ips0);
    em.emit('buyTool', t);
    if (!FAST) saveNow();
    return true;
  }
  // celebrate(t): trava o controle, revela com zoom-out, bate o nome na tela e liga o "modo estreia"
  function celebrate(t, z0, ips0) {
    const big = t.kind === 'bagger', c = S.cele;
    c.t = 0; c.id = t.id; c.z0 = z0; c.big = big; c.dur = big ? 6.6 : 1.6; c.spin = false; c.step = 0; c.ips0 = ips0;
    S.estreia = (big ? 9 : 1.6) + EC.ESTREIA_SEC;
    if (FAST) return;
    if (big) { fx.vignette(0.9); if (Music && Music.stop) { try { Music.stop(0.3); } catch (e) { /* */ } } }
    else {
      if (Sfx && Sfx.buy && !S.opts.mute) { try { Sfx.buy(); } catch (e) { /* */ } }
      if (t.seat === 'cab') sfx('engineStart', { delay: 0.3 });
      fx.flash(PAL.cream, 0.3, 0.5); fx.confetti(40 + S.tool * 8);
      ui(() => { if (celeCard && celeCard.close) celeCard.close(); celeCard = UI.celebrate({ kicker: 'Nova ferramenta', title: t.name + '!', sub: t.size, icon: G.Props.icon(t.id), dur: 2.2 }); });
    }
  }
  function celeTick(dt) {
    const c = S.cele; if (c.t < 0) return;
    c.t += dt;
    if (c.big) {
      // revelação da Bagger: silêncio -> buzina e roda girando -> zoom-out de 3 s -> carimbo -> mordida perfeita garantida
      if (c.step === 0 && c.t >= 1.0) { c.step = 1; c.spin = true; S.hornT = 1.6; if (!FAST) { sfx('hornBig'); cam.addTrauma(0.5); fx.vignette(0.4); } }
      if (c.step === 1 && c.t >= 4.6) {
        c.step = 2; S.stamp = 2.6;
        if (!FAST) { fx.hitstop(0.12); fx.flash(PAL.cream, 0.4, 0.9); fx.confetti(220); fx.vignette(0); cam.addTrauma(0.8); if (Sfx && Sfx.big && !S.opts.mute) { try { Sfx.big(); } catch (e) { /* */ } } sfx('rumble'); musicTheme(); }
      }
      if (c.step === 2 && c.t >= c.dur) {
        c.step = 3; c.spin = false; S.perfectForce = 6;
        ui(() => { UI.banner('MORDIDA PERFEITA', 'segure o clique: a montanha vai despencar', { icon: 'star', tone: 'gold', level: 3, dur: 2.4 }); UI.achievement('A maior máquina do mundo', { sub: 'Bagger 293 · ¥/s de ¥' + U.fmt(c.ips0) + ' pra muito mais' }); });
      }
    }
    if (c.t >= c.dur + 0.5) c.t = -1;
  }
  const locked = () => S.cele.t >= 0 && S.cele.t < S.cele.dur;

  function buyNode(id) {
    const n = D.nodeById[id];
    if (!n || nodeState(n) !== 'open') return false;
    const c = nodeCost(n);
    if (S.money < c) return false;
    S.money -= c; S.own[id] = true; S.stats.buys++;
    computeStats(); ensureBag();
    em.emit('buyNode', n);
    if (!FAST) {
      if (Sfx && Sfx.buy && !S.opts.mute) { try { Sfx.buy(); } catch (e) { /* */ } }
      if (n.size === 2) ui(() => UI.banner(n.n, 'keystone desbloqueado!', { icon: 'star', tone: 'gold' }));
      else ui(() => UI.toast(n.n, { icon: 'check', sub: n.see.slice(0, 64) }));
      if (n.fx.part) { cam.addTrauma(0.4); ui(() => UI.banner('PROJETO BAGGER ' + (S.own.bg2 ? '2' : '1') + '/3', 'as peças chegaram no pátio', { icon: 'gear', level: 3 })); }
      fx.flash(PAL.cream, 0.15, 0.2); S.col.pulse = 1; saveNow();
    }
    HUD.refreshSlots();
    return true;
  }
  function buyHouse() {
    const h = D.HOUSE[S.house]; if (!h) return false;
    if (S.tool + 1 < h.tier) { ui(() => UI.toast('Precisa: ' + TOOLS[h.tier - 1].name, { icon: 'lock', tone: 'bad' })); return false; }
    const c = houseCost(h);
    if (S.money < c) { ui(() => UI.toast('Faltam ¥' + U.fmt(c - S.money) + ' pro ' + h.n.toLowerCase(), { icon: 'house', tone: 'bad' })); return false; }
    S.money -= c; S.house++; S.stats.buys++;
    computeStats();
    em.emit('buyHouse', h);
    if (!FAST) {
      if (Sfx && Sfx.big && !S.opts.mute) { try { Sfx.big(); } catch (e) { /* */ } }
      fx.confetti(120); fx.flash(PAL.cream, 0.3, 0.6);
      ui(() => UI.banner(h.n.toUpperCase() + '!', h.draw, { level: 3, icon: 'house' }));
      if (h.id === 'h2') ui(() => UI.toast('Carta do corretor', { icon: 'house', sub: 'o iene mudou :) o onsen subiu pra ¥70 mi', dur: 6 }));
    }
    if (S.house >= D.HOUSE.length) ending();
    if (!FAST) saveNow();
    return true;
  }
  function ending() {
    S.ended = true; S.endT = S.time;
    em.emit('ending');
    if (FAST) return;
    const pct = 1 - S.heapArea / S.heapTotal, mins = S.time / 60;
    const rank = mins < 70 ? 'S' : mins < 90 ? 'A' : mins < 130 ? 'B' : 'C';
    setTimeout(() => HUD.endCard({ rank, list: [
      { icon: 'clock', label: 'Tempo', value: U.fmtTime(S.time) }, { icon: 'rice', label: 'Montanha cavada', value: U.pct ? U.pct(pct, 1) : Math.round(pct * 100) + '%' },
      { icon: 'yen', label: 'Ienes ganhos', value: '¥ ' + U.fmt(S.earned) }, { icon: 'yen', label: 'Recorde de ¥/s', value: '¥ ' + U.fmt(S.stats.bestIps) },
      { icon: 'sack', label: 'Sacos estourados', value: S.stats.sacks + ' (maior: ¥ ' + U.fmt(S.stats.bestSack) + ')' }, { icon: 'star', label: 'Bolsões dourados', value: S.stats.pockets + '/' + D.POCKETS.n },
    ] }, () => {}), 1800);
  }

  /* =====================================================================
     7. Atualização, câmera e desenho
     ===================================================================== */
  // update(dt): um passo da simulação (seguro pra passo fixo; não desenha)
  function update(dt) {
    S.time += dt;
    const lock = locked();
    let hold = ptr.down && !lock;
    S.autoMode = false;
    if (!hold && !lock && st.auto > 0 && ptr.has) { hold = true; S.autoMode = true; }
    inp.parts = iL.parts = iT.parts = FAST ? null : parts;
    const k = cur.kind;
    if (k === 'hand' || k === 'push' || k === 'jack') driveHand(dt, hold);
    else if (k === 'haul') driveHaul(dt, hold);
    else if (k === 'bagger') driveBagger(dt, hold);
    else driveMachine(dt, hold);
    autoTick(dt);
    ecoTick(dt, hold && !S.autoMode);
    heap.relax(dt);
    S.heapArea = heap.area;
    S.footT -= dt; if (S.footT <= 0) { S.footT = 1; S.footX = scanFoot(); }
    celeTick(dt);
    fleetTick(dt);
    collectorTick(dt);
    if (S.stamp > 0) S.stamp -= dt;
    if (!FAST) {
      helpersTick(dt);
      parts.update(dt, floorFn); floaters.update(dt); Wd.updateBack(dt);
      camTick(dt);
      if (loopH && (loopT -= dt) <= 0) { loopT = 0.12; try { loopH.set({ rate: hold ? 0.75 + 0.2 * (S.estreia > 0 ? 1 : 0) : 0.12, vol: hold ? 0.5 : 0.28 }); } catch (e) { /* */ } }
    }
  }
  function collectorTick(dt) {
    const c = S.col, k = c.kind, X = Wd.X;
    if (k === 'cesto') { c.x = P.x - P.face * 10; c.y = P.y - 18; }
    else if (k === 'saco') { if (Math.abs(P.x - c.x) > 170) c.x = P.x - P.face * 80; c.y = heap.surf(c.x); }
    else if (k === 'barraca') { c.x = X.barraca + 6; c.y = -40; }
    else if (k === 'kei') { const tx = Math.max(X.casinha + 90, P.x - 190 - (cur.park || 0)); if (Math.abs(tx - c.x) > 120) c.x = U.damp(c.x, tx, 2, dt); c.y = heap.surf(c.x); }
    else if (k === 'silo') { c.x = X.silo; c.y = -150; }
    else if (cur.kind === 'haul') { c.x = iT.x - (T.meta.haul + 215); c.y = heap.surf(c.x); }
    else if (cur.kind === 'bagger') { const d = T.dump(S.m); c.x = d ? d.x : P.x - 700; c.y = 0; }
    else { const tx = P.x - 430; if (Math.abs(tx - c.x) > 160) c.x = U.damp(c.x, tx, 1.5, dt); c.y = heap.surf(c.x); }
  }
  function helpersTick(dt) {
    const n = Math.min(10, st.help);
    while (S.helpers.length < n) S.helpers.push({ x: S.lastDigX - 60 - S.helpers.length * 30, y: 0 });
    for (let i = 0; i < n; i++) {
      const hlp = S.helpers[i], side = i % 2 ? 1 : -1, tx = S.lastDigX + side * (36 + (i >> 1) * 30) * Math.max(1, cur.r / 20) - 40;
      hlp.vx = U.clamp((tx - hlp.x) * 2, -160, 160); hlp.x += hlp.vx * dt; hlp.y = heap.surf(hlp.x);
    }
  }
  function camTick(dt) {
    const c = S.cele, k = cur.kind;
    let z = cur.zoom, zk = 2.2;
    if (c.t >= 0) {
      if (c.big) {
        if (c.t < 1.6) { z = 0.62; zk = 3; }
        else if (c.t < 4.6) { z = Math.exp(U.lerp(Math.log(0.62), Math.log(cur.zoom), (c.t - 1.6) / 3)); zk = 30; }
      } else if (c.t < 0.4) { z = c.z0 * 1.25; zk = 9; } else zk = 1.9;
    }
    cam.zoomTo(z, zk);
    let fxx = P.x, fyy = P.y;
    if (k === 'hand' || k === 'push' || k === 'jack') {
      // zona morta: a câmera só anda quando o Kome chega perto da borda, senão o ponteiro (fixo na tela) fugiria dele pra sempre
      const dz = W * 0.24 / cam.z;
      if (P.x > S.camX + dz) S.camX = P.x - dz; else if (P.x < S.camX - dz) S.camX = P.x + dz;
      fxx = S.camX;
    }
    else if (k === 'bagger') { fxx = c.t >= 0 && c.t < 1.6 ? S.m.x - 100 : S.m.x - 130; fyy = 0; }
    else if (k === 'haul') fxx = P.x + 40;
    else fxx = P.x + cur.park * 0.7;
    const gf = k === 'hand' || k === 'push' || k === 'jack' ? 0.66 : WL.GROUND_FRAC;
    const hw = W / 2 / cam.z;
    cam.follow(U.clamp(fxx, hw - 40, WL.WW - hw + 40), fyy - (gf - 0.5) * H / cam.z, dt, 4.5);
    cam.maxShake = S.opts.shake ? 12 : 0;
    cam.update(dt);
  }

  const view = { x0: 0, x1: 0, y0: 0, y1: 0 }, sp = { x: 0, y: 0 };
  const hsO = { face: 1, scale: 0.8, pal: 'goma', shadow: true };
  function render() {
    stage.begin();
    const t = S.time, z = cam.z;
    Wd.drawBack(g, cam, t, S);
    cam.begin(g);
    cam.view(view, 30 / z);
    Draw.lod(z, 0.6);
    // 1. Bagger em montagem (atrás de tudo) e pátio
    if (S.bag && S.bag.m !== S.m) G.Tools.bagger.draw(g, S.bag.m);
    // 2. montanha + chão
    heap.draw(g, view, t, { pockets: st.glow ? 'hint' : 'found' });
    Wd.drawGround(g, view, z);
    Wd.drawYard(g, view, t, S);
    // 3. frota estacionada (faixa da frente)
    for (let i = 0; i < S.fleet.length; i++) {
      const f = S.fleet[i]; if (!f.warm || !cam.visible(f.x, -150, 800)) continue;
      G.Tools[f.id].draw(g, f.m);
      if (!st.pilots[f.id]) { const w = 86, hh = 22; Draw.sign(g, f.x - w / 2, f.y - G.Tools[f.id].h - 44, w, hh, 'PRECISA-SE PILOTO', { col: PAL.cream, ink: PAL.red }); Draw.text(g, 'z z z', f.x + 30, f.y - G.Tools[f.id].h - 54 - 6 * Math.sin(t * 2), { size: 13, col: PAL.cream, sw: 3 }); }
    }
    // 4. coletor, sacos, ajudantes
    const c = S.col;
    if (c.kind === 'cesto') { Draw.box(g, c.x - 5, c.y - 8, 10, 8, PAL.woodL, { r: 2, ol: 1 }); g.fillStyle = PAL.rice; g.fillRect(c.x - 3.5, c.y - 9.5, 7, 2); }
    else if (c.kind !== 'barraca' && !(c.kind === 'silo' && S.own.a7)) Wd.drawCollector(g, c, t, S);
    const nh = Math.min(S.helpers.length, st.help);
    for (let i = 0; i < nh; i++) {
      const hp = S.helpers[i]; if (!cam.visible(hp.x, hp.y, 60)) continue;
      hsO.pal = HELP_PAL[i % HELP_PAL.length]; hsO.face = hp.x < S.lastDigX ? 1 : -1; hsO.scale = i === 4 ? 0.62 : 0.8;
      E.drawShiba(g, hp.x, hp.y, Math.abs(hp.vx) > 30 ? 'run' : 'dig', t * (S.own.e1 ? 1.4 : 1) + i, hsO);
      if (S.own.e4 && G.Props.hardhat) { const hh = G.Props.hardhat(); g.imageSmoothingEnabled = false; g.drawImage(hh.cv, hp.x + hsO.face * 6 - hh.ax, hp.y - 30 - hh.ay); }
    }
    for (let i = 0; i < S.sacks.length; i++) drawSack(S.sacks[i], t);
    // 5. ferramenta atual
    if (S.loader) G.Tools.pacabo.draw(g, S.loader);
    T.draw(g, S.m);
    if (cur.kind === 'haul') Draw.text(g, 'Carga ' + Math.round((S.m.load || 0) * 100) + '%', iT.x - 40, iT.y - 250, { size: 30, col: S.m.load >= 1 ? PAL.gold : PAL.cream, sw: 8 });
    if (S.furia > 0 && cur.seat === 'paw') { g.globalAlpha = 0.25 + 0.1 * Math.sin(t * 20); Draw.circle(g, P.x, P.y - 20, 30, PAL.red, { ol: 0 }); g.globalAlpha = 1; }
    parts.draw(g, view);
    for (let i = 0; i < Wd.layers.front.length; i++) Wd.layers.front[i](g, view, t, S);
    cam.end(g);
    Draw.lod(1);
    floaters.draw(g, cam);
    // 6. tela: onigiri, indicador do coletor na borda, carimbo da Bagger, efeitos
    if (S.oni.on) drawOnigiri(t);
    if (!cam.visible(c.x, c.y - 20, 0) && c.pulse > 0) {
      const left = c.x < cam.x, ex = left ? 24 : W - 24, ey = H * 0.6;
      g.globalAlpha = 0.5 + 0.5 * c.pulse; Draw.circle(g, ex, ey, 15 + 4 * c.pulse, PAL.gold, { ol: 2.5 }); Draw.text(g, '¥', ex, ey + 1, { size: 17, col: PAL.cream, sw: 4 });
      g.fillStyle = PAL.line; g.beginPath(); g.moveTo(ex + (left ? -22 : 22), ey); g.lineTo(ex + (left ? -14 : 14), ey - 7); g.lineTo(ex + (left ? -14 : 14), ey + 7); g.fill(); g.globalAlpha = 1;
    }
    if (S.stamp > 0) {
      const u = 1 - S.stamp / 2.6, k = u < 0.08 ? 3 - 2 * (u / 0.08) : 1, a = S.stamp < 0.4 ? S.stamp / 0.4 : 1;
      g.save(); g.globalAlpha = a; g.translate(W / 2, H * 0.4); g.scale(k, k); g.rotate(-0.04);
      Draw.text(g, 'BAGGER 293', 0, 0, { size: 92, col: PAL.gold, sw: 16 });
      Draw.text(g, '96 m. 14.200 t. 1 shiba.', 0, 62, { size: 28, col: PAL.cream, sw: 8 });
      g.restore();
    }
    fx.draw(g);
  }
  function drawSack(k, t) {
    if (!cam.visible(k.x, k.y, 80)) return;
    const ga = D.SACK.gacha[k.g], s = G.Props.sack(S.own.s8 && ga.kind === 'plain' ? 'golden' : ga.kind);
    const sc = (S.own.s1 ? 1.3 : 1) * Math.max(1, 0.9 / cam.z) * (1 + (k.state ? 0.15 * Math.sin(t * 40) : 0.05 * Math.sin(t * 5 + k.x)));
    const ox = k.state ? Math.sin(t * 60) * 2.5 * (ga.m >= 3 ? 2 : 1) : 0, fade = k.state ? 1 : U.clamp((D.SACK.life - k.t) / 1.5, 0, 1);
    g.globalAlpha = fade; g.imageSmoothingEnabled = false;
    if (ga.m >= 10 && k.state) { g.globalAlpha = 0.5; Draw.circle(g, k.x, k.y - 12 * sc, 26 * sc, PAL.goldL, { ol: 0 }); g.globalAlpha = 1; }
    g.drawImage(s.cv, k.x + ox - s.ax * sc, k.y - s.ay * sc, s.cv.width * sc, s.cv.height * sc);
    g.globalAlpha = 1;
  }
  function drawOnigiri(t) {
    const o = S.oni, on = G.Props.onigiri();
    for (let i = 0; i < o.n; i++) {
      const x = o.x - i * 46, y = o.y + Math.sin(t * 3 + i) * 18, fl = Math.sin(t * 16) * 6;
      g.fillStyle = PAL.white; g.strokeStyle = PAL.line; g.lineWidth = 2;
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * 20, y - 6 - fl * 0.5, 12, 6 + fl * 0.3, s * 0.5, 0, 7); g.fill(); g.stroke(); }
      g.imageSmoothingEnabled = false; g.drawImage(on.cv, x - on.cv.width * 1.5, y - on.cv.height * 1.5, on.cv.width * 3, on.cv.height * 3);
    }
  }

  /* =====================================================================
     8. Laço, entrada, áudio, ganchos de teste
     ===================================================================== */
  function musicTheme() {
    if (FAST || !Music || !audioOn) return;
    try {
      if (!S.opts.music || S.opts.mute) { if (Music.stop) Music.stop(0.5); return; }
      Music.start(S.tool < 5 ? 'campo' : S.tool < 9 ? 'trabalho' : S.tool < 12 ? 'maquinas' : 'bagger', { fade: 1.5 });
    } catch (e) { /* sem música */ }
  }
  function initAudio() {
    if (audioOn || !AudioE) return;
    try { AudioE.init(); if (AudioE.unlock) AudioE.unlock(); audioOn = true; AudioE.muted = !!S.opts.mute; } catch (e) { return; }
    if (Loops && cur.loop && !S.opts.mute) { try { loopH = Loops.start(cur.loop, { vol: 0.3, rate: 0.1 }); } catch (e) { /* */ } }
    musicTheme();
  }
  function setOpt(k, v) {
    S.opts[k] = v;
    if (k === 'mute') { if (AudioE) { try { AudioE.muted = !!v; } catch (e) { /* */ } } if (UI) UI.sound = !v; if (v && loopH) { try { loopH.stop(0.2); } catch (e) { /* */ } loopH = null; } }
    if (k === 'music' || k === 'mute') musicTheme();
    saveNow();
  }
  function horn() { S.hornT = 1.2; sfx('hornBig'); if (!FAST) { cam.addTrauma(0.5); fx.shock && fx.shock(W / 2, H / 2); ui(() => UI.banner('FOOOOOM!', 'a buzina da Bagger assusta os corvos', { icon: 'horn', dur: 1.2 })); } }

  function readPointer() {
    if (input.pressed) {
      initAudio(); tapEat = false;
      // toque em saco ou onigiri não vira cavada
      for (const k of S.sacks) { cam.toScreen(k.x, k.y - 12, sp); if (!k.state && U.dist(sp.x, sp.y, input.x, input.y) < 44) { tapSack(k); tapEat = true; break; } }
      if (!tapEat && S.oni.on) for (let i = 0; i < S.oni.n; i++) if (U.dist(S.oni.x - i * 46, S.oni.y, input.x, input.y) < 52) { tapOnigiri(); tapEat = true; break; }
      hook.use = false;
    }
    if (hook.use) { ptr.down = hook.on; ptr.wx = hook.wx; ptr.wy = hook.wy; ptr.has = true; return; }
    ptr.down = input.down && !tapEat;
    if (input.down || input.inside) { cam.toWorld(input.x, input.y, sp); ptr.wx = sp.x; ptr.wy = sp.y; if (input.down) ptr.has = true; }
    if (input.keyPressed && input.keyPressed('Space') && S.own.b0 && cur.kind === 'bagger') horn();
  }
  function frame(dt) {
    const t0 = performance.now();
    readPointer();
    fx.update(dt);
    const sdt = dt * (fx.timeScale === undefined ? 1 : fx.timeScale);
    if (sdt > 0) update(sdt);
    HUD.update(dt);
    saveT += dt; if (saveT >= 10) { saveT = 0; saveNow(); }
    S.perf.upd += (performance.now() - t0 - S.perf.upd) * 0.05;
  }
  function draw() { const t0 = performance.now(); render(); S.perf.ren += (performance.now() - t0 - S.perf.ren) * 0.05; }

  function boot() {
    stage = E.Stage({ width: W, height: H, bg: PAL.sky });
    g = stage.g; input = E.Input(stage);
    cam = E.Camera(W, H); parts = E.Particles(1600); floaters = E.Floaters(120); fx = E.ScreenFX(stage);
    G.cam = cam;
    buildWorld();
    save = E.Save('kome-no-japao-v4', { version: 4, defaults: () => ({}) });
    computeStats();
    let had = false;
    if (/fresh/.test(location.search)) save.clear(); else had = loadState();   // ?fresh = começa do zero (testes)
    S.heapArea = heap.area; S.footX = scanFoot();
    cur = TOOLS[S.tool];
    setTool(S.tool);
    if (!had) { P.x = WL.START_X; P.y = heap.surf(P.x); }
    S.camX = P.x + 30; camTick(0.016); cam.snapTo(cam.tx, cam.ty, cur.zoom);
    if (heap.prewarm) { try { heap.prewarm(g); } catch (e) { /* */ } }
    HUD.init({ stage, buyTool, buyNode, buyHouse, horn, nodeState, nodeCost, toolCost, houseCost, stats: () => st, setOpt,
      exportStr: () => { saveNow(); return save.exportStr(); },
      importStr: s => { if (!save.importStr(s)) return false; save.save(); location.reload(); return true; },
      reset: () => { save.clear(); saveNow = () => {}; location.reload(); } });
    if (UI) UI.sound = !S.opts.mute;
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
    window.addEventListener('beforeunload', () => saveNow());
    loop = E.Loop({ update: frame, render: draw, input, maxDt: 0.05 });
    loop.start();
    if (S.ended) S.endT = S.time;
  }

  /* ---- API pública e ganchos de teste ---- */
  G.Game = { on: (ev, fn) => { nListen++; return em.on(ev, fn); }, buyTool, buyNode, buyHouse, setTool, stats: () => st, nodeState, nodeCost, toolCost, houseCost, pay, aim, tapAll, saveNow, horn };
  window.__kome = {
    S, P, data: D, buyTool, buyNode, buyHouse, tapAll, aim: () => { const a = aim(); return { x: a.x, y: a.y }; },
    setTool(i) { setTool(i); S.cele.t = -1; cam.snapTo(P.x, P.y - 60, cur.zoom); return cur.id; },
    addMoney(v) { S.money += v; return S.money; },
    // step(seg, dt=1/30): avança a simulação sem desenhar (determinístico o bastante pro autoplayer)
    step(sec, h) { h = h || 1 / 30; FAST = true; const n = Math.round(sec / h); try { for (let i = 0; i < n; i++) update(h); } finally { FAST = false; } return S.time; },
    hold(wx, wy, on) { hook.use = true; hook.on = on !== false; hook.wx = wx; hook.wy = wy; ptr.down = hook.on; ptr.wx = wx; ptr.wy = wy; ptr.has = true; },
    stats: () => st, nodeState: id => nodeState(D.nodeById[id]), nodeCost: id => nodeCost(D.nodeById[id]),
    reset() { save.clear(); saveNow = () => {}; location.reload(); },
    save: () => saveNow(), exportStr: () => save.exportStr(),
    view() { if (celeCard && celeCard.close) { celeCard.close(); celeCard = null; } S.stamp = 0; S.camX = P.x + 30 / cur.zoom; camTick(1); cam.snapTo(cam.tx, cam.ty, cur.zoom); },
    get heap() { return heap; }, get cam() { return cam; }, get tool() { return cur; }, get m() { return S.m; }, get loop() { return loop; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
