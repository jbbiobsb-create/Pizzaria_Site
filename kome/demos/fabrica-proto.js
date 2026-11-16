/* Kome no Japão · protótipo jogável da Fábrica (docs/design/fabrica.md)
   Página solta (demos/fabrica.html). Não está ligada ao jogo: o arroz que entra vem do seletor "Kome cavando".
   Console / testes: __fab.step(seg) · __fab.place(tipo,x,y,rot) · __fab.belt([[x,y],...]) · __fab.erase(x,y) · __fab.state */
(function () {
  'use strict';
  const E = Pixxel, U = E.U, C = E.PAL, D = E.Draw;
  const W = 960, H = 540, INK = '#3B2818', TAU = Math.PI * 2;
  const Q = new URLSearchParams(location.search);
  const stage = E.Stage({ width: W, height: H, bg: '#2a1a10' });
  const g = stage.g;
  const UI = E.UI; UI.mount(stage);
  const input = E.Input(stage);
  const ps = E.Particles(900), fl = E.Floaters(140);

  /* ======================================================================
     Números da ficha (docs/design/fabrica.md). Tudo em "x 1 saco cru".
     ====================================================================== */
  const V = 10;                       // ¥ de 1 saco cru (só pra escala dos números)
  const GW = 8, GH = 6, CELL = 52;    // grid 8x6, casas de 52 px
  const GX = 272, GY = 104;           // canto do grid na tela (416 x 312)
  const BELT_SPEED = 2, SP = 0.25;    // esteira: 2 casas/s; espaço mínimo entre itens (4 por casa)
  const LVL_SPEED = 0.25, LVL_COST = 1.6, MAX_LVL = 10;
  const DOCK_BASE = 2, DOCK_GROW = 1.4, DOCK_PRICE = 30;
  const UNLOCK_PILAO = 50, UNLOCK_DOURADO = 20;
  const ITEMS = {
    raw: { name: 'Arroz cru', val: 1 }, gold: { name: 'Arroz Dourado', val: 6 },
    cozido: { name: 'Arroz Cozido', val: 2 }, onigiri: { name: 'Onigiri', val: 4 },
    mochi: { name: 'Mochi', val: 10 }, mochid: { name: 'Mochi Dourado', val: 48 },
  };
  const MDEF = {
    panela: { name: 'Panela', len: 1, price: 40, desc: 'cozinha o arroz',
      recipes: [{ in: { raw: 1 }, out: 'cozido', time: 1.5, name: 'Arroz cozido' }] },
    moldadora: { name: 'Moldadora', len: 1, price: 60, desc: 'aperta o arroz em triângulo',
      recipes: [{ in: { cozido: 1 }, out: 'onigiri', time: 1.0, name: 'Onigiri' }] },
    pilao: { name: 'Pilão', len: 2, price: 240, desc: 'shiba bate mochi no martelão',
      recipes: [{ in: { cozido: 2 }, out: 'mochi', time: 5.0, name: 'Mochi' },
                { in: { cozido: 2, gold: 1 }, out: 'mochid', time: 6.0, name: 'Mochi Dourado' }] },
  };
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  const ang = d => d * Math.PI / 2;

  /* ======================================================================
     Estado
     ====================================================================== */
  const rng = E.RNG(7);
  const S = {
    money: 0, t: 0, dig: 20, goldMix: 0.05, speed: 1, dockLvl: 1, dockBudget: 0, dockRR: 0, dockUse: 0,
    made: { cozido: 0, onigiri: 0, mochi: 0, mochid: 0 }, sold: {},
    unlocked: { pilao: false, mochid: false },
    rawAcc: 0, facAcc: 0, secT: 0, hist: [], tool: null, sel: null, muted: false, tut: -1, frame: 0, fast: false,
    timeOpen: 0, firstSale: -1,
  };
  let grid, machines = [], nextId = 1;
  const undo = [];
  function newGrid() { grid = []; for (let y = 0; y < GH; y++) { grid.push(new Array(GW).fill(null)); } }
  newGrid();

  const avgRaw = () => (1 - S.goldMix) * ITEMS.raw.val + S.goldMix * ITEMS.gold.val;
  const potentialIps = () => S.dig * avgRaw() * V;
  function ips() {
    if (!S.hist.length) return potentialIps();
    let s = 0; for (const h of S.hist) s += h.raw + h.fac; return s / S.hist.length;
  }
  function rates() {
    if (!S.hist.length) return { raw: potentialIps(), fac: 0 };
    let r = 0, f = 0; for (const h of S.hist) { r += h.raw; f += h.fac; }
    return { raw: r / S.hist.length, fac: f / S.hist.length };
  }
  const dockCap = () => DOCK_BASE * Math.pow(DOCK_GROW, S.dockLvl - 1);
  const dockPrice = () => DOCK_PRICE * Math.pow(LVL_COST, S.dockLvl) * ips();
  const machinePrice = type => MDEF[type].price * ips();
  const levelPrice = m => MDEF[m.type].price * Math.pow(LVL_COST, m.lvl) * ips();
  const recipeOf = m => MDEF[m.type].recipes[m.rec];
  const speedOf = m => 1 + LVL_SPEED * (m.lvl - 1);

  /* ======================================================================
     Grid, máquinas, esteiras
     ====================================================================== */
  const inGrid = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH;
  const cellAt = (x, y) => (inGrid(x, y) ? grid[y][x] : null);
  function mcells(type, x, y, rot) { const n = MDEF[type].len, a = []; for (let k = 0; k < n; k++) a.push([x + DX[rot] * k, y + DY[rot] * k]); return a; }
  function front(m) { const c = mcells(m.type, m.x, m.y, m.rot); return c[c.length - 1]; }
  function outTarget(m) { const f = front(m); return [f[0] + DX[m.rot], f[1] + DY[m.rot]]; }
  function mrect(type, x, y, rot) {
    const cs = mcells(type, x, y, rot); let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
    for (const [a, b] of cs) { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
    return { x: GX + x0 * CELL, y: GY + y0 * CELL, w: (x1 - x0 + 1) * CELL, h: (y1 - y0 + 1) * CELL };
  }
  function canPlace(type, x, y, rot, ignore) {
    for (const [a, b] of mcells(type, x, y, rot)) {
      if (!inGrid(a, b)) return false;
      const c = grid[b][a]; if (c && c.k === 'm' && c.m !== ignore) return false;
    }
    return true;
  }
  // tenta achar uma âncora válida perto da casa tocada (pilão 2x1 encosta pra trás se não cabe)
  function fitAnchor(type, x, y, rot, ignore) {
    const n = MDEF[type].len;
    for (let k = 0; k < n; k++) { const ax = x - DX[rot] * k, ay = y - DY[rot] * k; if (canPlace(type, ax, ay, rot, ignore)) return [ax, ay]; }
    return null;
  }
  function sellLoose(item, px, py) {          // item que sai do mundo (esteira apagada etc.): vende na hora, nada se perde
    const v = ITEMS[item.t].val * V; S.money += v; S.facAcc += v;
    if (!S.fast && px !== undefined) fl.add(px, py, '+¥' + U.fmt(v), { size: 11, c: C.cream, life: 0.8 });
  }
  function clearBelt(x, y) {
    const c = cellAt(x, y); if (!c || c.k !== 'b') return;
    for (const it of c.items) sellLoose(it, GX + x * CELL + 26, GY + y * CELL + 20);
    grid[y][x] = null;
  }
  function setBelt(x, y, dir) {
    if (!inGrid(x, y)) return false;
    const c = grid[y][x];
    if (c && c.k === 'm') return false;
    if (c && c.k === 'b') { c.dir = dir; return true; }
    grid[y][x] = { k: 'b', dir, items: [], jam: 0 };
    return true;
  }
  function makeMachine(type, x, y, rot, o) {
    o = o || {};
    const m = { id: o.id || nextId++, type, x, y, rot, lvl: o.lvl || 1, rec: o.rec || 0, paid: o.paid || 0, spent: o.spent || 0,
      inB: { raw: 0, gold: 0, cozido: 0 }, out: [], work: false, prog: 0, busy: 0, anim: 0, idle: 0, hitN: 0, sq: 0, blocked: false, full: 0 };
    occupy(m);
    machines.push(m);
    return m;
  }
  function occupy(m) {
    for (const [a, b] of mcells(m.type, m.x, m.y, m.rot)) { clearBelt(a, b); grid[b][a] = { k: 'm', m }; }
  }
  function vacate(m) {
    for (const [a, b] of mcells(m.type, m.x, m.y, m.rot)) if (inGrid(a, b) && grid[b][a] && grid[b][a].m === m) grid[b][a] = null;
  }
  function dumpMachine(m) {
    const r = mrect(m.type, m.x, m.y, m.rot);
    for (const k in m.inB) for (let i = 0; i < m.inB[k]; i++) sellLoose({ t: k }, r.x + r.w / 2, r.y + 10);
    for (const it of m.out) sellLoose(it, r.x + r.w / 2, r.y + 10);
    if (m.work) for (const k in recipeOf(m).in) for (let i = 0; i < recipeOf(m).in[k]; i++) sellLoose({ t: k });
    m.inB = { raw: 0, gold: 0, cozido: 0 }; m.out = []; m.work = false; m.prog = 0;
  }
  function removeMachine(m) {
    dumpMachine(m); vacate(m);
    machines.splice(machines.indexOf(m), 1);
    if (S.sel === m) S.sel = null;
    return m.paid + m.spent;
  }

  /* ---------- fluxo ---------- */
  // empurra item da casa (fx,fy) na direção dir. true = foi.
  function tryPush(fx, fy, dir, item) {
    const tx = fx + DX[dir], ty = fy + DY[dir];
    if (tx >= GW) { if (dir === 0 && ty >= 0 && ty < GH) { sell(item, ty); return true; } return false; }
    if (!inGrid(tx, ty)) return false;
    const c = grid[ty][tx]; if (!c) return false;
    if (c.k === 'b') {
      if (c.dir === (dir + 2) % 4) return false;
      for (const it of c.items) if (it.p < SP) return false;
      item.p = 0; item.from = (dir + 2) % 4; item.stuck = 0; item.f = S.frame;
      c.items.push(item); return true;
    }
    const m = c.m, o = outTarget(m);
    if (o[0] === fx && o[1] === fy) return false;     // não entra pela frente (saída)
    return accept(m, item);
  }
  function accept(m, item) {
    const need = recipeOf(m).in;
    if (need[item.t]) {
      if (m.inB[item.t] < need[item.t] * 2) { m.inB[item.t]++; return true; }
      // esperando OUTRO ingrediente (ex.: pilão dourado sem Arroz Dourado): o que sobra passa direto, senão a linha trava pra sempre
      if (!hasAll(m) && m.out.length < 2) { m.out.push(item); return true; }
      m.full = 0.4; return false;                       // fila cheia: espera na esteira (gargalo)
    }
    if (m.out.length < 2) { m.out.push(item); return true; }   // não usa: passa direto pra frente
    return false;
  }
  function hasAll(m) { const need = recipeOf(m).in; for (const k in need) if (m.inB[k] < need[k]) return false; return true; }

  /* ---------- venda na doca ---------- */
  const pend = []; for (let i = 0; i < GH; i++) pend.push({ v: 0, best: 0, t: 0 });
  function sell(item, row) {
    const it = ITEMS[item.t], v = it.val * V;
    S.money += v; S.facAcc += v; S.sold[item.t] = (S.sold[item.t] || 0) + 1;
    if (S.firstSale < 0 && item.t !== 'raw' && item.t !== 'gold') S.firstSale = S.timeOpen;
    const p = pend[row]; p.v += v; p.best = Math.max(p.best, it.val);
    saleAnim = 1;
  }
  let saleAnim = 0;
  function flushSales(dt) {
    for (let r = 0; r < GH; r++) {
      const p = pend[r]; p.t -= dt;
      if (p.v > 0 && p.t <= 0) {
        if (!S.fast) {
          const size = 11 + Math.log2(p.best + 1) * 3.2;
          const c = p.best >= 40 ? C.goldL : p.best >= 10 ? C.sakura : p.best >= 4 ? C.yelL : C.cream;
          fl.add(GX + GW * CELL + 44 + U.rnd(-6, 6), GY + r * CELL + 18, '+¥' + U.fmt(p.v), { size, c, life: 1.1 + p.best / 60, pop: 1 + p.best / 30, shake: p.best >= 40 ? 1.2 : 0 });
          if (p.best >= 40) ps.burst(GX + GW * CELL + 44, GY + r * CELL + 20, 10, { c: [C.gold, C.goldL], shape: 'star', speed: [60, 160], life: 0.7, up: 80 });
          sfx('kaching', { pitch: 0.8 + Math.min(1.2, Math.log2(p.best + 1) * 0.18), vol: 0.5 });
        }
        p.v = 0; p.best = 0; p.t = 0.35;
      }
    }
  }

  /* ---------- passo da simulação ---------- */
  function sim(dt) {
    S.frame++; S.t += dt; S.timeOpen += dt;
    // 1) arroz cavado: tudo vende cru, menos o que a Doca de Entrada puxar
    const dug = S.dig * dt * avgRaw() * V;
    S.money += dug; S.rawAcc += dug;
    const want = Math.min(dockCap(), S.dig);
    S.dockBudget = Math.min(S.dockBudget + want * dt, 1.5);
    let tries = GH, pulled = 0;
    while (S.dockBudget >= 1 && tries-- > 0) {
      S.dockRR = (S.dockRR + 1) % GH;
      const item = { t: rng() < S.goldMix ? 'gold' : 'raw' };
      if (tryPush(-1, S.dockRR, 0, item)) {
        S.dockBudget -= 1; pulled++;
        const v = ITEMS[item.t].val * V; S.money -= v; S.rawAcc -= v;   // não vende cru (não paga 2x)
        dockRowAnim[S.dockRR] = 1;
      }
    }
    if (S.dockBudget > 1) S.dockBudget = 1;           // o que sobra vende cru: nada se perde
    S.dockUse += (pulled / dt - S.dockUse) * Math.min(1, dt / 3);

    // 2) máquinas
    for (const m of machines) {
      const R = recipeOf(m);
      if (m.out.length) { const f = front(m); if (tryPush(f[0], f[1], m.rot, m.out[0])) m.out.shift(); }
      if (!m.work && hasAll(m) && m.out.length < 2) {
        for (const k in R.in) m.inB[k] -= R.in[k];
        m.work = true; m.prog = 0; m.hitN = 0;
      }
      m.blocked = false;
      if (m.work) {
        if (m.prog < 1) { m.prog = Math.min(1, m.prog + dt * speedOf(m) / R.time); m.anim += dt * speedOf(m); }
        machineFx(m, R);
        if (m.prog >= 1) {
          if (m.out.length < 2) { m.out.push({ t: R.out }); m.work = false; S.made[R.out]++; m.idle = 0; madeFx(m, R); }
          else m.blocked = true;
        }
      }
      const working = m.work && m.prog < 1;
      m.busy += ((working ? 1 : 0) - m.busy) * Math.min(1, dt / 6);
      if (!working) m.idle += dt; else m.idle = 0;
      m.full = Math.max(0, m.full - dt);
      m.sq = Math.max(0, m.sq - dt * 5);
    }
    // 3) esteiras
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const c = grid[y][x]; if (!c || c.k !== 'b' || !c.items.length) { if (c && c.k === 'b') c.jam = Math.max(0, c.jam - dt); continue; }
      c.items.sort((a, b) => b.p - a.p);
      let ahead = null, keep = [], allStuck = true;
      for (const it of c.items) {
        if (it.f === S.frame) { keep.push(it); ahead = it; allStuck = false; continue; }
        let np = it.p + BELT_SPEED * dt;
        if (ahead) np = Math.min(np, ahead.p - SP);
        else if (np >= 1) { np = 1; if (tryPush(x, y, c.dir, it)) { allStuck = false; continue; } }
        if (np > it.p + 1e-6) { it.stuck = 0; allStuck = false; } else it.stuck += dt;
        it.p = Math.max(it.p, np); keep.push(it); ahead = it;
      }
      c.items = keep;
      if (allStuck && keep.length >= 3) c.jam = Math.min(6, c.jam + dt); else c.jam = Math.max(0, c.jam - dt * 2);
    }
    // 4) desbloqueios
    if (!S.unlocked.pilao && S.made.onigiri >= UNLOCK_PILAO) { S.unlocked.pilao = true; celebrate('Pilão liberado!', 'você fez ' + UNLOCK_PILAO + ' onigiris: agora dá pra bater mochi'); }
    if (!S.unlocked.mochid && S.made.mochi >= UNLOCK_DOURADO && S.goldMix > 0) { S.unlocked.mochid = true; celebrate('Receita Mochi Dourado!', '2 cozidos + 1 Arroz Dourado no pilão: vale 48×'); }
    // 5) renda por segundo (média dos últimos 10 s)
    S.secT += dt;
    if (S.secT >= 1) { S.hist.push({ raw: S.rawAcc / S.secT, fac: S.facAcc / S.secT }); if (S.hist.length > 10) S.hist.shift(); S.rawAcc = 0; S.facAcc = 0; S.secT = 0; }
    flushSales(dt);
  }

  function celebrate(t, sub) {
    if (S.fast) { pendingBanners.push([t, sub]); return; }
    try { UI.banner(t, sub, { level: 3 }); } catch (e) { /* sem UI */ }
    sfx('fanfare'); sfx('chirin');
    ps.burst(W / 2, 200, 40, { c: [C.gold, C.sakura, C.goldL, C.cream], shape: 'star', speed: [120, 360], life: 1.2 });
  }
  const pendingBanners = [];

  /* ---------- efeitos das máquinas ---------- */
  function mcenter(m) { const r = mrect(m.type, m.x, m.y, m.rot); return { x: r.x + r.w / 2, y: r.y + r.h / 2, r }; }
  function machineFx(m, R) {
    if (S.fast) return;
    const c = mcenter(m);
    if (m.type === 'panela') {
      if (Math.random() < 0.12) ps.add({ x: c.x + 6 + U.rnd(-6, 6), y: c.y - 16, vx: U.rnd(-8, 8), vy: U.rnd(-40, -25), shape: 'puff', c: C.rice, w: U.rnd(2.5, 4), life: U.rnd(0.5, 0.8), drag: 1 });
      if (Math.random() < 0.01) sfx('drip', { vol: 0.35, pitch: U.rnd(0.7, 1) });
    } else if (m.type === 'moldadora') {
      const n = Math.floor(m.prog * 1.0 + 0.4);   // 1 carimbada por onigiri, em 60%
      if (n > m.hitN) { m.hitN = n; m.sq = 1; ps.puff(c.x + 6, c.y + 10, 4, 5, { c: C.rice }); sfx('click', { pitch: 0.6, vol: 0.6 }); sfx('hanko', { vol: 0.3, pitch: 1.4 }); }
    } else if (m.type === 'pilao') {
      const n = Math.floor(m.prog * 4 + 0.2);     // 4 marteladas por mochi
      if (n > m.hitN) {
        m.hitN = n; m.sq = 1;
        const mx = c.x + (m.rot % 2 === 0 ? 2 : 0), my = c.r.y + c.r.h - 34;
        ps.burst(mx, my, 6, { c: [C.rice, C.cream], shape: 'dot', speed: [30, 90], life: 0.5, up: 60, w: 2 });
        sfx('thud', { vol: 0.45, pitch: 1.2 }); sfx('boing', { vol: 0.25 });
        if (Math.random() < 0.25) sfx('yip', { vol: 0.35 });
      }
    }
  }
  function madeFx(m, R) {
    if (S.fast) return;
    if (m.type === 'pilao') { sfx('hanko', { vol: 0.5, pitch: 0.8 }); }
  }

  /* ======================================================================
     Som (Sfx da engine, com mudo e trava pra não virar barulheira)
     ====================================================================== */
  const sfxLast = {};
  function sfx(name, o) {
    if (S.muted || S.fast || !E.Sfx || !E.Sfx.has || !E.Sfx.has(name)) return;
    const now = performance.now(); if (sfxLast[name] && now - sfxLast[name] < 90) return; sfxLast[name] = now;
    try { E.Sfx.play(name, o); } catch (e) { /* sem áudio */ }
  }

  /* ======================================================================
     Ações do jogador (com desfazer)
     ====================================================================== */
  function snapshot() {
    const bs = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const c = grid[y][x]; if (c && c.k === 'b') bs.push([x, y, c.dir]); }
    return { ms: machines.map(m => ({ id: m.id, type: m.type, x: m.x, y: m.y, rot: m.rot, lvl: m.lvl, rec: m.rec, paid: m.paid, spent: m.spent })), bs, dock: S.dockLvl };
  }
  function restore(sn) {
    const old = grid, oldM = machines.slice();
    newGrid(); machines = [];
    const keep = new Map(oldM.map(m => [m.id, m]));
    for (const s of sn.ms) {
      let m = keep.get(s.id);
      if (m) { keep.delete(s.id); Object.assign(m, { x: s.x, y: s.y, rot: s.rot, lvl: s.lvl, rec: s.rec, paid: s.paid, spent: s.spent }); machines.push(m); for (const [a, b] of mcells(m.type, m.x, m.y, m.rot)) grid[b][a] = { k: 'm', m }; }
      else makeMachine(s.type, s.x, s.y, s.rot, s);
    }
    for (const m of keep.values()) dumpMachine(m);
    for (const [x, y, dir] of sn.bs) {
      const o = old[y][x];
      grid[y][x] = { k: 'b', dir, items: o && o.k === 'b' ? o.items : [], jam: 0 };
    }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const o = old[y][x];
      if (o && o.k === 'b' && !(grid[y][x] && grid[y][x].k === 'b')) for (const it of o.items) sellLoose(it, GX + x * CELL + 26, GY + y * CELL + 20);
    }
    S.dockLvl = sn.dock;
    if (S.sel && S.sel !== 'dock' && machines.indexOf(S.sel) < 0) S.sel = null;
  }
  function beginAction() { return { snap: snapshot(), cost: 0 }; }
  function commit(a) { undo.push(a); if (undo.length > 60) undo.shift(); }
  function doUndo() {
    const a = undo.pop();
    if (!a) { toast('nada pra desfazer'); sfx('error'); return; }
    restore(a.snap); S.money += a.cost; sfx('whoosh', { vol: 0.5 });
  }
  function toast(t, o) { if (S.fast) return; try { UI.toast(t, o); } catch (e) { /* */ } }

  function buyMachine(type, x, y, rot, free) {
    if (type === 'pilao' && !S.unlocked.pilao && !free) { toast('O Pilão abre com ' + UNLOCK_PILAO + ' onigiris'); sfx('error'); return null; }
    const at = fitAnchor(type, x, y, rot);
    if (!at) { sfx('error'); return null; }
    const price = free ? 0 : machinePrice(type);
    if (S.money < price) { toast('Falta ¥' + U.fmt(price - S.money), { tone: 'bad' }); sfx('error'); return null; }
    const a = beginAction();
    S.money -= price; a.cost = price;
    const m = makeMachine(type, at[0], at[1], rot, { paid: price });
    commit(a);
    if (!S.fast) { const c = mcenter(m); ps.puff(c.x, c.y + 14, 10, 9, { c: C.sand }); sfx('stomp', { vol: 0.35 }); sfx('buy', { vol: 0.5 }); }
    return m;
  }
  function eraseAt(x, y, a) {
    const c = cellAt(x, y); if (!c) return false;
    if (c.k === 'b') { clearBelt(x, y); sfx('click'); return true; }
    const ref = removeMachine(c.m); S.money += ref; a.cost -= ref;
    if (!S.fast) { ps.puff(GX + x * CELL + 26, GY + y * CELL + 40, 8, 8, { c: C.sand }); if (ref > 0) fl.add(GX + x * CELL + 26, GY + y * CELL + 10, 'devolveu ¥' + U.fmt(ref), { size: 12, c: C.goldL }); sfx('pop', { vol: 0.4 }); }
    return true;
  }
  function rotateMachine(m) {
    for (let k = 1; k <= 4; k++) {
      const r = (m.rot + k) % 4;
      if (canPlace(m.type, m.x, m.y, r, m)) {
        const a = beginAction(); vacate(m); m.rot = r; occupy(m); commit(a); sfx('click', { pitch: 1.2 }); m.sq = 1; return true;
      }
    }
    sfx('error'); return false;
  }
  function moveMachine(m, x, y) {
    if (x === m.x && y === m.y) return false;
    if (!canPlace(m.type, x, y, m.rot, m)) { sfx('error'); return false; }
    const a = beginAction(); vacate(m); m.x = x; m.y = y; occupy(m); commit(a);
    m.sq = 1; sfx('thud', { vol: 0.4 }); return true;
  }
  function levelUp(m) {
    if (m.lvl >= MAX_LVL) return;
    const p = levelPrice(m);
    if (S.money < p) { toast('Falta ¥' + U.fmt(p - S.money), { tone: 'bad' }); sfx('error'); return; }
    const a = beginAction(); S.money -= p; a.cost = p; m.spent += p; m.lvl++; commit(a);
    m.sq = 1; sfx('levelup', { vol: 0.5 }); const c = mcenter(m);
    if (!S.fast) { ps.burst(c.x, c.y, 14, { c: [C.gold, C.goldL], shape: 'star', speed: [60, 180], life: 0.7 }); fl.add(c.x, c.y - 24, 'Nv. ' + m.lvl + '!', { size: 16, c: C.goldL }); }
  }
  function setRecipe(m, i) {
    if (m.rec === i) return;
    if (i === 1 && !S.unlocked.mochid) { toast('Mochi Dourado abre com ' + UNLOCK_DOURADO + ' mochis'); sfx('error'); return; }
    const a = beginAction();
    const c = mcenter(m), need = MDEF[m.type].recipes[i].in;
    for (const k in m.inB) if (!need[k]) { for (let j = 0; j < m.inB[k]; j++) sellLoose({ t: k }, c.x, c.y - 10); m.inB[k] = 0; }
    m.rec = i; commit(a); sfx('click');
  }
  function dockUp() {
    const p = dockPrice();
    if (S.money < p) { toast('Falta ¥' + U.fmt(p - S.money), { tone: 'bad' }); sfx('error'); return; }
    const a = beginAction(); S.money -= p; a.cost = p; S.dockLvl++; commit(a);
    sfx('levelup', { vol: 0.5 });
    if (!S.fast) ps.burst(GX - 40, GY + 156, 16, { c: [C.gold, C.goldL], shape: 'star', speed: [60, 200], life: 0.8 });
  }

  /* ======================================================================
     Sprites (pixel em texto: contorno e luz/sombra automáticos)
     ====================================================================== */
  const XP = { Q: C.mochi, q: C.mochiD, Z: '#4A2E1A', X: C.goldL, F: '#FFE9A8' };
  const sp = (name, txt) => E.spriteText('fab-' + name, txt, { pal: XP });
  const ICON = {
    raw: sp('raw', `
      ..AAA..
      .AAAAa.
      AAAAAaa`),
    gold: sp('gold', `
      ..YXY..
      .YYYYy.
      YYYYYyy`),
    cozido: sp('cozido', `
      .AAAAA.
      AAAAAAa
      BBBBBBB
      .bBBBb.`),
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
    sack: sp('sack', `
      ..tt..
      .TTTT.
      TTTTTT
      TTTTTt
      .tttt.`),
  };
  const SPR = {
    panLid: sp('panlid', `
      .....oOOo.....
      ...oOOOOOOo...
      ..OOOOOOOOOO..
      .NNNNNNNNNNNN.`),
    panBody: sp('panbody', `
      .oKKKKKKKKKKo.
      oKKAKKKKKKAKKo
      okkkkkkkkkkkko
      .okkkkkkkkkko.`),
    stove0: sp('stove0', `
      ..MMMMMMMMMM..
      .MRYRRYRRYRRM.
      .MMMMMMMMMMMM.`),
    stove1: sp('stove1', `
      ..MMMMMMMMMM..
      .MYRRYXRYRRYM.
      .MMMMMMMMMMMM.`),
    moldBase: sp('moldbase', `
      .SS..........SS.
      .Ss..........Ss.
      .Ss..........Ss.
      .Ss..........Ss.
      .Ss..........Ss.
      .Ss..........Ss.
      .Ss..........Ss.
      SSSSSSSSSSSSSSSS
      SBBBBBBBBBBBBBBS
      SBbbbbbbbbbbbbBS
      SSSSSSSSSSSSSSSS
      .NN..........NN.`),
    moldTop: sp('moldtop', `
      RRRRRRRRRRRRRRRR
      RrrrrrrrrrrrrrrR`),
    moldHead: sp('moldhead', `
      .SSSSSS.
      SSSSSSSS
      .ssssss.`),
    usu: sp('usu', `
      .KKKKKKKKKKKK.
      KkZZZZZZZZZZkK
      .KKKKKKKKKKKK.
      .KkkkkkkkkkkK.
      ..KKKKKKKKKK..
      ..KkkkkkkkkK..
      ...KKKKKKKK...
      ..KKKKKKKKKK..`),
    register: sp('register', `
      ..NNNN..
      .NWWWWN.
      SSSSSSSS
      SYsYsYsS
      SSSSSSSS
      SssssssS`),
    lock: sp('lock', `
      ..SSS..
      .S...S.
      .S...S.
      YYYYYYY
      YYYNYYY
      YYYNYYy
      yyyyyyy`),
    eraser: sp('eraser', `
      ....PPP
      ...PPPP
      ..WPPP.
      .WWWP..
      WWWW...
      WWW....`),
    undo: sp('undo', `
      ..Y.....
      .YY.....
      YYYYYYY.
      .YY....Y
      ..Y....Y
      .......Y
      ..YYYYY.`),
    belt: sp('beltico', `
      NNNNNNNN
      NWNNWNNW
      NNNNNNNN
      S.S..S.S`),
  };
  function blit(cv, x, y, s, o) {     // x = centro, y = base
    const sx = (o && o.sx) || 1, sy = (o && o.sy) || 1, w = cv.width * s * sx, h = cv.height * s * sy;
    g.imageSmoothingEnabled = false;
    if (o && o.alpha !== undefined) { const a = g.globalAlpha; g.globalAlpha = a * o.alpha; g.drawImage(cv, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h)); g.globalAlpha = a; }
    else g.drawImage(cv, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
  }
  const txt = (s, x, y, o) => D.text(g, s, x, y, o);
  const T = (size, col, align, extra) => Object.assign({ size, col: col || INK, sw: 0, align: align || 'center', weight: 900 }, extra || {});

  /* ======================================================================
     Cenário fixo (galpão) em cache
     ====================================================================== */
  const bgCv = document.createElement('canvas'); bgCv.width = W; bgCv.height = H;
  (function paintBg() {
    const b = bgCv.getContext('2d');
    b.fillStyle = '#4A3020'; b.fillRect(0, 0, W, H);
    // tábuas de fora (escuras)
    for (let y = 0; y < H; y += 18) { b.fillStyle = (y / 18) % 2 ? '#523522' : '#47301F'; b.fillRect(0, y, W, 17); }
    // chão do galpão
    const fx = 188, fy = 60, fw = 584, fh = 392;
    b.fillStyle = INK; b.fillRect(fx - 4, fy - 4, fw + 8, fh + 8);
    const R = E.RNG(3);
    for (let y = fy, i = 0; y < fy + fh; y += 13, i++) {
      let x = fx - (i % 3) * 37;
      while (x < fx + fw) {
        const len = 70 + Math.floor(R() * 80), tone = R();
        b.fillStyle = tone < 0.33 ? C.woodL : tone < 0.7 ? '#C4925A' : '#BB8850';
        const x0 = Math.max(fx, x), x1 = Math.min(fx + fw, x + len);
        b.fillRect(x0, y, x1 - x0, 12);
        b.fillStyle = 'rgba(255,250,230,.18)'; b.fillRect(x0, y, x1 - x0, 2);
        b.fillStyle = '#8E6236'; b.fillRect(x1 - 1, y, 1, 12);
        if (R() < 0.5) { b.fillStyle = '#7A5228'; b.fillRect(x0 + 4, y + 5, 2, 2); b.fillRect(x1 - 7, y + 5, 2, 2); }
        x += len;
      }
      b.fillStyle = '#8E6236'; b.fillRect(fx, y + 12, fw, 1);
    }
    // parede de cima com janelinhas
    b.fillStyle = INK; b.fillRect(fx - 4, fy - 4, fw + 8, 26);
    b.fillStyle = C.woodD; b.fillRect(fx, fy, fw, 18);
    b.fillStyle = '#6A4520'; for (let x = fx; x < fx + fw; x += 24) b.fillRect(x, fy, 2, 18);
    for (let i = 0; i < 5; i++) {
      const wx = fx + 70 + i * 112;
      b.fillStyle = INK; b.fillRect(wx - 2, fy + 1, 48, 16);
      b.fillStyle = '#FFE9A8'; b.fillRect(wx, fy + 3, 44, 12);
      b.fillStyle = '#FFF6D0'; b.fillRect(wx + 2, fy + 4, 18, 4);
      b.fillStyle = INK; b.fillRect(wx + 21, fy + 3, 2, 12); b.fillRect(wx, fy + 8, 44, 2);
      // raio de luz no chão
      b.fillStyle = 'rgba(255,233,168,.13)';
      b.beginPath(); b.moveTo(wx, fy + 18); b.lineTo(wx + 44, fy + 18); b.lineTo(wx + 104, fy + 300); b.lineTo(wx + 40, fy + 300); b.closePath(); b.fill();
    }
    // vigas
    b.fillStyle = INK; b.fillRect(fx - 4, fy + fh - 4, fw + 8, 8);
    // grid marcado no chão (fita no chão)
    b.strokeStyle = 'rgba(59,40,24,.18)'; b.lineWidth = 1;
    for (let i = 0; i <= GW; i++) { b.beginPath(); b.moveTo(GX + i * CELL + .5, GY); b.lineTo(GX + i * CELL + .5, GY + GH * CELL); b.stroke(); }
    for (let j = 0; j <= GH; j++) { b.beginPath(); b.moveTo(GX, GY + j * CELL + .5); b.lineTo(GX + GW * CELL, GY + j * CELL + .5); b.stroke(); }
    b.strokeStyle = 'rgba(237,185,58,.55)'; b.lineWidth = 3; b.setLineDash([10, 6]);
    b.strokeRect(GX - 2, GY - 2, GW * CELL + 4, GH * CELL + 4); b.setLineDash([]);
    // placa do galpão
    b.fillStyle = INK; b.fillRect(W / 2 - 74, fy + 22, 148, 20);
    b.fillStyle = C.red; b.fillRect(W / 2 - 72, fy + 24, 144, 16);
    D.text(b, 'GALPÃO KOME PACK', W / 2, fy + 32.5, { size: 11, col: C.cream, sw: 0, weight: 900 });
  })();

  /* ======================================================================
     Desenho: esteiras
     ====================================================================== */
  function feeds(x, y, s) {             // a casa vizinha do lado s empurra pra dentro de (x,y)?
    const nx = x + DX[s], ny = y + DY[s];
    if (nx === -1 && inGrid(0, ny)) return s === 2;          // doca de entrada
    const n = cellAt(nx, ny); if (!n) return false;
    if (n.k === 'b') return n.dir === (s + 2) % 4;
    const o = outTarget(n.m); return o[0] === x && o[1] === y;
  }
  function beltSides(c, x, y) {
    const ins = [];
    for (let s = 0; s < 4; s++) if (s !== c.dir && feeds(x, y, s)) ins.push(s);
    if (!ins.length) ins.push((c.dir + 2) % 4);
    return ins;
  }
  const BW = 26;
  function seg(cx, cy, d, x0, x1, fn) { g.save(); g.translate(cx, cy); g.rotate(ang(d)); fn(x0, x1); g.restore(); }
  function drawBelts(t) {
    const list = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const c = grid[y][x]; if (c && c.k === 'b') list.push([c, x, y, beltSides(c, x, y)]); }
    const half = CELL / 2;
    // passes: contorno, moldura, borracha, faixas
    const pass = (fn) => { for (const [c, x, y, ins] of list) { const cx = GX + x * CELL + half, cy = GY + y * CELL + half; for (const s of ins) seg(cx, cy, (s + 2) % 4, -half, 0, fn); seg(cx, cy, c.dir, 0, half, fn); } };
    g.fillStyle = 'rgba(59,40,24,.25)'; pass((a, b) => g.fillRect(a - 2, -BW / 2 + 3, b - a + 4, BW + 2));
    g.fillStyle = INK; pass((a, b) => g.fillRect(a - BW / 2 * (a === 0 ? 1 : 0) - 1, -BW / 2 - 2, b - a + 2 + (a === 0 ? BW / 2 : 0) + (b === 0 ? BW / 2 : 0), BW + 4));
    g.fillStyle = C.steelD; pass((a, b) => g.fillRect(a - (a === 0 ? BW / 2 - 1 : 0), -BW / 2, b - a + (a === 0 ? BW / 2 - 1 : 0) + (b === 0 ? BW / 2 - 1 : 0), BW));
    g.fillStyle = C.steel; pass((a, b) => g.fillRect(a - (a === 0 ? BW / 2 - 1 : 0), -BW / 2, b - a + (a === 0 ? BW / 2 - 1 : 0) + (b === 0 ? BW / 2 - 1 : 0), 3));
    g.fillStyle = C.blk; pass((a, b) => g.fillRect(a - (a === 0 ? BW / 2 - 4 : 0), -BW / 2 + 4, b - a + (a === 0 ? BW / 2 - 4 : 0) + (b === 0 ? BW / 2 - 4 : 0), BW - 8));
    const off = (t * BELT_SPEED * CELL) % 13;
    for (const [c, x, y, ins] of list) {
      const cx = GX + x * CELL + half, cy = GY + y * CELL + half, moving = !(c.jam > 0.3);
      const o = moving ? off : 0;
      g.fillStyle = C.blkL;
      const stripes = (a, b) => { for (let p = a - 13 + o; p < b; p += 13) { const q = Math.max(a, p); if (p + 4 > a && q < b) { g.beginPath(); g.moveTo(q, -BW / 2 + 5); g.lineTo(Math.min(b, q + 4), 0); g.lineTo(q, BW / 2 - 5); g.lineTo(Math.max(a, q - 3), BW / 2 - 5); g.lineTo(Math.max(a, q + 1 - 3), 0); g.lineTo(Math.max(a, q - 3), -BW / 2 + 5); g.closePath(); g.fill(); } } };
      for (const s of ins) seg(cx, cy, (s + 2) % 4, -half, 0, stripes);
      seg(cx, cy, c.dir, 0, half, stripes);
      // setinha da direção
      seg(cx, cy, c.dir, 0, half, () => { g.fillStyle = 'rgba(243,201,74,.75)'; g.beginPath(); g.moveTo(14, -4); g.lineTo(20, 0); g.lineTo(14, 4); g.closePath(); g.fill(); });
    }
    // montinhos de engarrafamento (gargalo) embaixo dos itens
    for (const [c, x, y] of list) if (c.jam > 0.4) {
      const cx = GX + x * CELL + half, cy = GY + y * CELL + half, k = Math.min(1, c.jam / 3);
      g.fillStyle = INK; g.beginPath(); g.ellipse(cx, cy + 4, 14 + 6 * k, 7 + 3 * k, 0, 0, TAU); g.fill();
      g.fillStyle = C.riceD; g.beginPath(); g.ellipse(cx, cy + 3, 12 + 6 * k, 5.5 + 3 * k, 0, 0, TAU); g.fill();
      g.fillStyle = C.riceS; g.beginPath(); g.ellipse(cx - 2, cy + 1, 8 + 4 * k, 3.5 + 2 * k, 0, 0, TAU); g.fill();
    }
    // itens
    for (const [c, x, y] of list) {
      const cx = GX + x * CELL + half, cy = GY + y * CELL + half;
      const jam = c.jam > 0.4;
      for (let i = 0; i < c.items.length; i++) {
        const it = c.items[i], p = it.p;
        let px, py;
        if (p < 0.5) { const k = p / 0.5; px = cx + DX[it.from] * half * (1 - k); py = cy + DY[it.from] * half * (1 - k); }
        else { const k = (p - 0.5) / 0.5; px = cx + DX[c.dir] * half * k; py = cy + DY[c.dir] * half * k; }
        let lift = 0, sc = 2;
        if (jam) { lift = (i % 2) * 5 + Math.min(4, c.jam); sc = 2; px += ((i * 37) % 7) - 3; }
        else lift = Math.abs(Math.sin(t * 9 + i)) * 0.8;
        blit(ICON[it.t], px, py + 6 - lift, sc);
      }
    }
  }

  /* ======================================================================
     Desenho: máquinas
     ====================================================================== */
  const shiba = (x, y, pose, t, o) => E.drawShiba(g, x, y, pose, t, Object.assign({ scale: 0.6, shadow: true }, o || {}));
  function drawMachine(m, t, ghost) {
    const r = mrect(m.type, m.x, m.y, m.rot), cx = r.x + r.w / 2, by = r.y + r.h - 7;
    const working = m.work && m.prog < 1, a = m.anim, sq = m.sq;
    g.save();
    if (ghost) g.globalAlpha = ghost;
    // pé no chão
    g.fillStyle = 'rgba(59,40,24,.22)'; g.beginPath(); g.ellipse(cx, by, r.w * 0.42, 6, 0, 0, TAU); g.fill();
    // nível: plaquinha dourada embaixo
    if (m.type === 'panela') {
      const px = cx + 6;
      blit(Math.floor(t * 8) % 2 && working ? SPR.stove1 : SPR.stove0, px, by, 3);
      if (working) { g.fillStyle = 'rgba(255,200,80,.25)'; g.beginPath(); g.ellipse(px, by - 6, 22, 6, 0, 0, TAU); g.fill(); }
      blit(SPR.panBody, px, by - 9 + sq * 2, 3, { sx: 1 + sq * 0.08, sy: 1 - sq * 0.08 });
      const lid = working ? -Math.abs(Math.sin(a * 11)) * 3 : 0;
      blit(SPR.panLid, px, by - 21 + lid + sq * 2, 3);
      shiba(r.x + 10, by + 2, working ? 'wag' : (m.idle > 6 ? 'sleep' : 'sit'), t + m.id, { pal: 'kome' });
    } else if (m.type === 'moldadora') {
      const px = cx + 5;
      blit(SPR.moldBase, px, by, 3);
      const k = m.prog;                      // pistão desce em ~60% e volta
      let d = 0;
      if (working) { if (k < 0.45) d = U.ease.inOut(k / 0.45) * 0.25; else if (k < 0.6) d = 0.25 + 0.75 * U.ease.quadIn((k - 0.45) / 0.15); else d = 1 - U.ease.out((k - 0.6) / 0.4); }
      const topY = by - 38, headY = topY + 4 + d * 11;
      g.fillStyle = INK; g.fillRect(px - 3, topY - 1, 6, headY - topY + 2);
      g.fillStyle = C.steelL; g.fillRect(px - 2, topY, 2, headY - topY); g.fillStyle = C.steel; g.fillRect(px, topY, 2, headY - topY);
      // arroz/onigiri no prato
      if (m.work) blit(k > 0.6 ? ICON.onigiri : ICON.cozido, px, by - 12, 2, { sx: 1 + sq * 0.35, sy: 1 - sq * 0.3 });
      blit(SPR.moldHead, px, headY + 9, 3);
      blit(SPR.moldTop, px, topY + 2, 3);
      shiba(r.x + 44, by + 2, working ? (d > 0.5 ? 'push' : 'stand') : (m.idle > 6 ? 'sleep' : 'sit'), t + m.id * 0.7, { pal: 'goma', face: -1 });
    } else if (m.type === 'pilao') {
      const horiz = m.rot % 2 === 0;
      const mx = cx + (horiz ? 4 : 2), my = by - 4;
      blit(SPR.usu, mx, my, 3);
      // mochi dentro do usu
      const doura = m.rec === 1;
      if (m.work || m.inB.cozido > 0) {
        const rx = 13 + sq * 5, ry = 5 - sq * 1.8;
        g.fillStyle = INK; g.beginPath(); g.ellipse(mx, my - 24, rx + 2, ry + 2, 0, 0, TAU); g.fill();
        g.fillStyle = doura ? C.gold : C.mochi; g.beginPath(); g.ellipse(mx, my - 24, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = doura ? C.goldL : C.white; g.beginPath(); g.ellipse(mx - 4, my - 25.5, rx * 0.45, ry * 0.4, 0, 0, TAU); g.fill();
      }
      // shiba do martelão (kine)
      const hx = mx - (horiz ? 34 : 18), hy = by + 1;
      const ph = working ? (m.prog * 4 + 0.2) % 1 : 0.9;
      const up = -2.25, hit = -0.45;
      let A;
      if (ph < 0.6) A = U.lerp(hit, up, U.ease.out(ph / 0.6));
      else if (ph < 0.8) A = U.lerp(up, hit, U.ease.quadIn((ph - 0.6) / 0.2));
      else A = hit - Math.sin((ph - 0.8) / 0.2 * Math.PI) * 0.12;
      if (!working) A = -1.2;
      const pvx = hx + 6, pvy = hy - 16, L = horiz ? 30 : 22;
      shiba(hx, hy, working ? (ph < 0.6 ? 'carry' : 'push') : (m.idle > 6 ? 'sleep' : 'stand'), t + m.id, { pal: 'kuro' });
      const ex = pvx + Math.cos(A) * L, ey = pvy + Math.sin(A) * L;
      g.lineCap = 'round';
      g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(pvx, pvy); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = C.woodL; g.lineWidth = 2.5; g.beginPath(); g.moveTo(pvx, pvy); g.lineTo(ex, ey); g.stroke();
      g.save(); g.translate(ex, ey); g.rotate(A + Math.PI / 2);
      g.fillStyle = INK; D.rrect(g, -9, -6, 18, 12, 3); g.fill();
      g.fillStyle = C.wood; D.rrect(g, -7.5, -4.5, 15, 9, 2); g.fill();
      g.fillStyle = C.woodL; g.fillRect(-7, -4, 14, 3); g.fillStyle = C.woodD; g.fillRect(-7, 2, 14, 2);
      g.restore();
      // shiba que vira o mochi
      const tx = mx + (horiz ? 32 : 17);
      shiba(tx, by + 1, working ? (ph > 0.15 && ph < 0.5 ? 'push' : 'wag') : (m.idle > 6 ? 'sleep' : 'sit'), t + m.id * 1.3, { pal: 'shiro', face: -1 });
      // cozidos esperando
      for (let i = 0; i < m.inB.cozido; i++) blit(ICON.cozido, r.x + 9 + (i % 2) * 11, r.y + 13 + Math.floor(i / 2) * 7, 1.5);
      if (m.inB.gold) blit(ICON.gold, r.x + 31, r.y + 13, 1.5);
    }
    g.restore();
    if (ghost) return;
    drawPorts(m, r);
    // barra "ocupada %"
    const bw = Math.min(40, r.w - 12), bx = cx - bw / 2, bY = r.y + r.h - 6;
    g.fillStyle = INK; g.fillRect(bx - 1, bY - 1, bw + 2, 5);
    g.fillStyle = '#5a4030'; g.fillRect(bx, bY, bw, 3);
    g.fillStyle = m.busy > 0.85 ? C.ora : m.busy > 0.4 ? C.gold : C.grassL; g.fillRect(bx, bY, bw * U.clamp(m.busy, 0, 1), 3);
    // nível
    if (m.lvl > 1) { for (let i = 0; i < Math.min(m.lvl - 1, 9); i++) { g.fillStyle = INK; g.fillRect(r.x + 4 + i * 4, r.y + 3, 4, 4); g.fillStyle = C.gold; g.fillRect(r.x + 5 + i * 4, r.y + 4, 2, 2); } }
    // balõezinhos de estado
    if (m.blocked) bubble(r.x + r.w - 10, r.y + 8, '!', C.red, t);
    else if (m.full > 0 && m.busy > 0.8) bubble(r.x + r.w - 10, r.y + 8, '!', C.ora, t);
    else if (!m.work && m.idle > 3 && !m.out.length) txt('z', r.x + 20 + Math.sin(t * 2) * 2, r.y + 10 - (t * 6 % 6), { size: 10, col: C.cream, sw: 3 });
    if (S.sel === m) { g.strokeStyle = C.goldL; g.lineWidth = 2; g.setLineDash([6, 4]); g.lineDashOffset = -t * 20; g.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); g.setLineDash([]); }
  }
  function bubble(x, y, s, col, t) {
    const b = Math.sin(t * 6) * 1.5;
    g.fillStyle = INK; g.beginPath(); g.arc(x, y + b, 8, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x, y + b, 6.5, 0, TAU); g.fill();
    txt(s, x, y + b + 0.5, { size: 11, col: C.cream, sw: 0 });
  }
  function drawPorts(m, r) {
    // saída: seta dourada na borda da frente ; entrada: entalhe creme na borda de trás
    const f = front(m), fx = GX + f[0] * CELL + 26 + DX[m.rot] * 24, fy = GY + f[1] * CELL + 26 + DY[m.rot] * 24;
    g.save(); g.translate(fx, fy); g.rotate(ang(m.rot));
    g.fillStyle = INK; g.beginPath(); g.moveTo(-5, -7); g.lineTo(3, 0); g.lineTo(-5, 7); g.closePath(); g.fill();
    g.fillStyle = C.gold; g.beginPath(); g.moveTo(-4, -5); g.lineTo(1, 0); g.lineTo(-4, 5); g.closePath(); g.fill();
    g.restore();
    const bx = GX + m.x * CELL + 26 - DX[m.rot] * 24, byy = GY + m.y * CELL + 26 - DY[m.rot] * 24;
    g.save(); g.translate(bx, byy); g.rotate(ang(m.rot));
    g.fillStyle = INK; g.beginPath(); g.moveTo(-3, -7); g.lineTo(5, 0); g.lineTo(-3, 7); g.closePath(); g.fill();
    g.fillStyle = C.cream; g.beginPath(); g.moveTo(-2, -5); g.lineTo(3, 0); g.lineTo(-2, 5); g.closePath(); g.fill();
    g.restore();
  }

  /* ======================================================================
     Desenho: docas
     ====================================================================== */
  const dockRowAnim = new Array(GH).fill(0);
  const DOCK_IN = { x: GX - 78, y: GY - 14, w: 72, h: GH * CELL + 28 };
  const DOCK_OUT = { x: GX + GW * CELL + 6, y: GY - 14, w: 72, h: GH * CELL + 28 };
  function woodBox(x, y, w, h, c1, c2, c3) {
    g.fillStyle = INK; D.rrect(g, x - 2, y - 2, w + 4, h + 4, 6); g.fill();
    g.fillStyle = c1; D.rrect(g, x, y, w, h, 5); g.fill();
    g.fillStyle = c3; g.fillRect(x + 3, y + 2, w - 6, 3);
    g.fillStyle = c2; g.fillRect(x + 3, y + h - 5, w - 6, 3);
  }
  function drawDocks(t) {
    // ENTRADA
    const A = DOCK_IN;
    woodBox(A.x, A.y, A.w, A.h, C.woodD, '#5E3E1E', C.wood);
    for (let y = A.y + 30; y < A.y + A.h - 8; y += 10) { g.fillStyle = '#6A4520'; g.fillRect(A.x + 4, y, A.w - 8, 1); }
    woodBox(A.x + 6, A.y - 10, A.w - 12, 24, C.grass, C.grassD, C.grassL);
    txt('ENTRADA', A.x + A.w / 2, A.y + 2, { size: 11, col: C.cream, sw: 3 });
    // pilha de sacos
    for (let i = 0; i < 6; i++) blit(ICON.sack, A.x + 14 + (i % 3) * 11, A.y + A.h - 4 - Math.floor(i / 3) * 12, 2);
    // bocas por linha
    for (let r = 0; r < GH; r++) {
      const yy = GY + r * CELL + 26, open = canFeedRow(r);
      dockRowAnim[r] = Math.max(0, dockRowAnim[r] - 0.05);
      g.fillStyle = INK; g.fillRect(A.x + A.w - 18, yy - 12, 20, 24);
      g.fillStyle = open ? '#2A1A10' : '#5E3E1E'; g.fillRect(A.x + A.w - 16, yy - 10, 18, 20);
      if (open) {
        g.fillStyle = C.gold; g.beginPath(); g.moveTo(A.x + A.w - 13, yy - 5); g.lineTo(A.x + A.w - 5, yy); g.lineTo(A.x + A.w - 13, yy + 5); g.closePath(); g.fill();
        if (dockRowAnim[r] > 0) blit(ICON.raw, A.x + A.w - 26, yy + 6, 2, { alpha: dockRowAnim[r] });
      }
    }
    // shiba carregando saco
    const walk = (t * 0.6) % 2, wy = A.y + 60 + (walk < 1 ? walk : 2 - walk) * (A.h - 130);
    shiba(A.x + 22, wy, 'carry', t, { pal: 'cha', face: 1 });
    blit(ICON.sack, A.x + 24, wy - 18, 2);
    txt(fmt1(Math.min(S.dockUse, dockCap())) + ' de ' + fmt1(dockCap()) + '/s', A.x + A.w / 2, A.y + A.h + 10, { size: 11, col: C.cream, sw: 3 });

    // VENDA
    const B = DOCK_OUT;
    woodBox(B.x, B.y, B.w, B.h, C.woodD, '#5E3E1E', C.wood);
    for (let y = B.y + 30; y < B.y + B.h - 8; y += 10) { g.fillStyle = '#6A4520'; g.fillRect(B.x + 4, y, B.w - 8, 1); }
    // noren vermelho
    woodBox(B.x + 6, B.y - 10, B.w - 12, 24, C.red, C.redD, C.redL);
    txt('VENDA', B.x + B.w / 2, B.y + 2, { size: 11, col: C.cream, sw: 3 });
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? C.red : C.redD; g.fillRect(B.x + 8 + i * 14, B.y + 14, 12, 12 + Math.sin(t * 2 + i) * 1.5); }
    for (let r = 0; r < GH; r++) {
      const yy = GY + r * CELL + 26, open = rowSells(r);
      g.fillStyle = INK; g.fillRect(B.x - 2, yy - 12, 20, 24);
      g.fillStyle = open ? '#2A1A10' : '#5E3E1E'; g.fillRect(B.x - 2, yy - 10, 18, 20);
      if (open) { g.fillStyle = C.gold; g.beginPath(); g.moveTo(B.x + 3, yy - 5); g.lineTo(B.x + 11, yy); g.lineTo(B.x + 3, yy + 5); g.closePath(); g.fill(); }
    }
    saleAnim = Math.max(0, saleAnim - 0.04);
    blit(SPR.register, B.x + 46, B.y + B.h - 34 - saleAnim * 2, 3);
    shiba(B.x + 46, B.y + B.h - 6, saleAnim > 0.3 ? 'cheer' : 'wag', t, { pal: 'goma', face: -1 });
  }
  function canFeedRow(r) { const c = cellAt(0, r); if (!c) return false; if (c.k === 'b') return c.dir !== 2; const o = outTarget(c.m); return !(o[0] === -1 && o[1] === r); }
  function rowSells(r) { const c = cellAt(GW - 1, r); if (!c) return false; if (c.k === 'b') return c.dir === 0; const o = outTarget(c.m); return o[0] === GW && o[1] === r; }
  const fmt1 = v => (Math.round(v * 10) / 10).toLocaleString('pt-BR');

  /* ======================================================================
     HUD em canvas (botões imediatos)
     ====================================================================== */
  let btns = [];
  function hit(x, y, w, h, fn, o) { btns.push({ x, y, w, h, fn, o }); }
  function card(x, y, w, h, fill) {
    g.fillStyle = INK; D.rrect(g, x - 2, y - 2, w + 4, h + 6, 10); g.fill();
    g.fillStyle = fill || C.cream; D.rrect(g, x, y, w, h, 8); g.fill();
  }
  function button(x, y, w, h, label, fn, o) {
    o = o || {};
    const on = o.on, off = o.off, pressed = pressBtn && pressBtn.x === x && pressBtn.y === y;
    const dy = pressed ? 2 : 0;
    g.fillStyle = INK; D.rrect(g, x - 2, y - 2, w + 4, h + 6, 9); g.fill();
    g.fillStyle = on ? C.gold : off ? '#E8DCC0' : (o.fill || C.cream); D.rrect(g, x, y + dy, w, h, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; D.rrect(g, x + 3, y + 2 + dy, w - 6, 4, 2); g.fill();
    if (o.icon) blit(o.icon, x + (o.iconX || 22), y + h / 2 + (o.iconY || 8) + dy, o.iconS || 2, { alpha: off ? 0.5 : 1 });
    const tx = o.icon ? x + (o.textX || 44) : x + w / 2;
    if (o.sub) {
      txt(label, tx, y + h / 2 - 7 + dy, T(o.size || 13, off ? '#8a7a66' : INK, o.icon ? 'left' : 'center'));
      txt(o.sub, tx, y + h / 2 + 9 + dy, T(o.subSize || 11, o.subCol || (off ? '#8a7a66' : '#6B4A2E'), o.icon ? 'left' : 'center'));
    } else txt(label, tx, y + h / 2 + 1 + dy, T(o.size || 13, off ? '#8a7a66' : INK, o.icon ? 'left' : 'center'));
    hit(x, y, w, h, fn, { x, y });
  }

  function drawTopBar() {
    g.fillStyle = INK; g.fillRect(0, 0, W, 52);
    g.fillStyle = '#4A3020'; g.fillRect(0, 0, W, 49);
    g.fillStyle = C.gold; g.fillRect(0, 49, W, 3);
    // dinheiro
    card(8, 6, 176, 36);
    txt('¥', 26, 24, T(22, C.goldD));
    txt(U.fmt(Math.floor(S.money)), 42, 25, T(20, INK, 'left'));
    // renda
    const rt = rates(), tot = rt.raw + rt.fac, sh = tot > 0 ? rt.fac / tot : 0;
    card(194, 6, 300, 36);
    txt('¥' + U.fmt(tot) + '/s', 204, 17, T(14, INK, 'left'));
    txt('cru ¥' + U.fmt(rt.raw) + '  ·  fábrica ¥' + U.fmt(rt.fac), 204, 33, T(11, '#6B4A2E', 'left'));
    const bx = 372, bw = 112;
    g.fillStyle = INK; g.fillRect(bx - 1, 11, bw + 2, 10);
    g.fillStyle = C.riceS; g.fillRect(bx, 12, bw, 8);
    g.fillStyle = C.ora; g.fillRect(bx, 12, bw * sh, 8);
    txt('fábrica ' + Math.round(sh * 100) + '%', bx + bw / 2, 30, T(11, C.oraD));
    // contadores
    card(504, 6, 248, 36);
    const items = ['cozido', 'onigiri', 'mochi', 'mochid'];
    items.forEach((k, i) => {
      const x = 514 + i * 60, locked = (k === 'mochi' && !S.unlocked.pilao) || (k === 'mochid' && !S.unlocked.mochid);
      blit(ICON[k], x + 8, 33, 2, { alpha: locked ? 0.35 : 1 });
      txt(locked ? '?' : U.fmt(S.made[k]), x + 20, 25, T(12, locked ? '#9a8a76' : INK, 'left'));
    });
    // velocidade
    [1, 2, 5].forEach((v, i) => button(764 + i * 46, 4, 40, 40, v + '×', () => { S.speed = v; sfx('click'); }, { on: S.speed === v, size: 14 }));
    button(906, 4, 46, 40, S.muted ? 'mudo' : 'som', () => { S.muted = !S.muted; try { E.Audio.muted = S.muted; } catch (e) { /* */ } }, { on: !S.muted, size: 12 });
  }

  function drawLeftPanel(t) {
    card(8, 62, 170, 392, '#FFF3D6');
    txt('Kome cavando', 93, 78, T(14));
    txt('(simula a montanha)', 93, 94, T(11, '#8A6A4A'));
    // cena: kome cavando
    g.fillStyle = C.riceS; g.beginPath(); g.ellipse(118, 160, 40, 22, 0, Math.PI, 0); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    g.fillStyle = C.rice; g.beginPath(); g.ellipse(112, 152, 22, 8, 0, Math.PI, 0); g.fill();
    E.drawShiba(g, 62, 160, 'dig', t * (0.6 + S.dig / 60), { scale: 1 });
    if (!S.fast && Math.random() < S.dig / 200) ps.add({ x: 84, y: 146, vx: U.rnd(20, 90), vy: U.rnd(-140, -60), g: 400, shape: 'grain', c: Math.random() < S.goldMix ? C.gold : C.rice, life: 0.6, w: 2, h: 3 });
    g.fillStyle = INK; g.fillRect(20, 160, 146, 2);
    txt('sacos/s', 93, 176, T(11, '#8A6A4A'));
    [5, 20, 80].forEach((v, i) => button(18 + i * 52, 186, 46, 44, String(v), () => { S.dig = v; sfx('shovel', { vol: 0.5 }); }, { on: S.dig === v, size: 16 }));
    txt('mistura: ' + Math.round(S.goldMix * 100) + '% dourado', 93, 248, T(11, C.goldD));
    // doca
    g.fillStyle = 'rgba(59,40,24,.15)'; g.fillRect(18, 262, 150, 2);
    txt('Doca de Entrada · Nv. ' + S.dockLvl, 93, 278, T(12));
    const cap = dockCap(), use = Math.min(S.dockUse, cap), cru = Math.max(0, S.dig - use);
    txt('puxa até ' + fmt1(cap) + ' sacos/s', 93, 296, T(11, '#6B4A2E'));
    txt('usando ' + fmt1(use) + ' · cru ' + fmt1(cru) + '/s', 93, 312, T(11, '#6B4A2E'));
    const bw = 140; g.fillStyle = INK; g.fillRect(22, 322, bw + 2, 9); g.fillStyle = C.riceS; g.fillRect(23, 323, bw, 7);
    g.fillStyle = C.grass; g.fillRect(23, 323, bw * U.clamp(use / Math.max(0.01, cap), 0, 1), 7);
    const p = dockPrice();
    button(18, 342, 150, 48, 'Subir doca', dockUp, { sub: '¥' + U.fmt(p) + '  (+40%)', subCol: S.money >= p ? C.grassD : C.redD, off: S.money < p });
    txt('nada se perde: o que', 93, 410, T(11, '#8A6A4A'));
    txt('a doca não puxa', 93, 424, T(11, '#8A6A4A'));
    txt('vende cru na hora', 93, 438, T(11, '#8A6A4A'));
  }

  function drawRightPanel(t) {
    card(782, 62, 170, 392, '#FFF3D6');
    const X = 867;
    if (S.sel && S.sel !== 'dock') return drawCard(S.sel, t);
    if (S.sel === 'dock') { txt('Doca de Entrada', X, 80, T(14)); txt('puxa ' + fmt1(dockCap()) + ' sacos/s', X, 100, T(12, '#6B4A2E')); txt('veja à esquerda', X, 118, T(11, '#8A6A4A')); }
    txt('Metas da fábrica', X, 80, T(14));
    goal(796, 98, 'Pilão', S.made.onigiri, UNLOCK_PILAO, 'onigiris', S.unlocked.pilao, ICON.onigiri);
    goal(796, 160, 'Mochi Dourado', S.made.mochi, UNLOCK_DOURADO, 'mochis', S.unlocked.mochid, ICON.mochid);
    txt('Como jogar', X, 236, T(13));
    const tips = ['toque o botão e a casa', 'pra pôr máquina', 'arraste pra mover', 'toque 2× pra girar', 'Esteira: arraste o dedo', 'toque numa esteira: gira', 'toque na máquina:', 'cartão com nível'];
    tips.forEach((s, i) => txt(s, X, 256 + i * 16, T(11, i % 2 ? '#8A6A4A' : '#6B4A2E')));
    txt('valor × saco cru', X, 398, T(11, '#6B4A2E'));
    ['cozido', 'onigiri', 'mochi', 'mochid'].forEach((k, i) => { blit(ICON[k], 798 + i * 38, 430, 2); txt(ITEMS[k].val + '×', 809 + i * 38, 424, T(11, INK, 'left')); });
  }
  function goal(x, y, name, n, need, unit, done, icon) {
    card(x, y, 142, 50, done ? '#E8F2D0' : C.cream);
    blit(done ? icon : SPR.lock, x + 16, y + 30, 2);
    txt(name, x + 30, y + 14, T(12, INK, 'left'));
    txt(done ? 'liberado!' : Math.min(n, need) + '/' + need + ' ' + unit, x + 30, y + 30, T(11, done ? C.grassD : '#6B4A2E', 'left'));
    g.fillStyle = INK; g.fillRect(x + 30, y + 38, 104, 6); g.fillStyle = C.riceS; g.fillRect(x + 31, y + 39, 102, 4);
    g.fillStyle = done ? C.grass : C.gold; g.fillRect(x + 31, y + 39, 102 * Math.min(1, n / need), 4);
  }
  function drawCard(m, t) {
    const X = 867, def = MDEF[m.type], R = recipeOf(m);
    txt(def.name, 796, 80, T(15, INK, 'left'));
    txt('Nv. ' + m.lvl, 938, 80, T(13, C.goldD, 'right'));
    txt(def.desc, X, 98, T(def.desc.length > 26 ? 10 : 11, '#8A6A4A'));
    // receita
    card(794, 108, 146, 40, C.cream);
    let x = 806; for (const k in R.in) { for (let i = 0; i < R.in[k]; i++) { blit(ICON[k], x, 136, 2); x += 16; } }
    txt('→', x + 4, 128, T(14)); blit(ICON[R.out], x + 22, 136, 2.4);
    txt(ITEMS[R.out].val + '×', x + 36, 128, T(12, C.goldD, 'left'));
    let y = 166;
    if (def.recipes.length > 1) {
      def.recipes.forEach((rc, i) => {
        const lock = i === 1 && !S.unlocked.mochid;
        button(794 + i * 75, 156, 71, 44, i ? 'Dourado' : 'Mochi', () => setRecipe(m, i), { on: m.rec === i, off: lock, size: 12, sub: lock ? UNLOCK_DOURADO + ' mochis' : (rc.time + ' s'), subSize: 11 });
      });
      y = 214;
    }
    const tm = R.time / speedOf(m);
    txt('tempo: ' + fmt1(tm) + ' s  (×' + fmt1(speedOf(m)) + ')', X, y, T(11, '#6B4A2E'));
    txt('ocupada ' + Math.round(m.busy * 100) + '%', 796, y + 18, T(12, INK, 'left'));
    g.fillStyle = INK; g.fillRect(898, y + 13, 44, 10); g.fillStyle = C.riceS; g.fillRect(899, y + 14, 42, 8);
    g.fillStyle = m.busy > 0.85 ? C.ora : C.gold; g.fillRect(899, y + 14, 42 * U.clamp(m.busy, 0, 1), 8);
    const st = m.blocked ? ['saída travada', C.redD] : (m.full > 0 && m.busy > 0.8) ? ['fila cheia: gargalo aqui!', C.oraD] : (m.work && m.prog < 1) ? ['trabalhando', C.grassD] : ['esperando ingrediente', '#8A6A4A'];
    txt(st[0], X, y + 38, T(11, st[1]));
    const p = levelPrice(m), max = m.lvl >= MAX_LVL;
    button(794, y + 54, 146, 48, max ? 'Nível máximo' : 'Subir nível', () => levelUp(m), { off: max || S.money < p, sub: max ? '' : '¥' + U.fmt(p) + '  (+25%)', subCol: S.money >= p ? C.grassD : C.redD });
    button(794, y + 112, 70, 44, 'Girar', () => rotateMachine(m), { size: 12 });
    button(870, y + 112, 70, 44, 'Tirar', () => { const a = beginAction(); const c = mcenter(m); const ref = removeMachine(m); S.money += ref; a.cost = -ref; commit(a); sfx('pop'); if (ref) fl.add(c.x, c.y, 'devolveu ¥' + U.fmt(ref), { size: 12, c: C.goldL }); }, { size: 12, sub: m.paid + m.spent > 0 ? '+¥' + U.fmt(m.paid + m.spent) : 'grátis', subSize: 11 });
  }

  const TOOLS = [
    { id: 'panela', name: 'Panela' }, { id: 'moldadora', name: 'Moldadora' }, { id: 'pilao', name: 'Pilão' },
    { id: 'esteira', name: 'Esteira' }, { id: 'borracha', name: 'Borracha' }, { id: 'undo', name: 'Desfazer' },
  ];
  const toolIcon = id => ({ panela: ICON.cozido, moldadora: ICON.onigiri, pilao: ICON.mochi, esteira: SPR.belt, borracha: SPR.eraser, undo: SPR.undo })[id];
  function drawBottomBar() {
    g.fillStyle = INK; g.fillRect(0, 460, W, 80);
    g.fillStyle = '#4A3020'; g.fillRect(0, 463, W, 77);
    const w = 146, gap = 8, x0 = (W - (w * 6 + gap * 5)) / 2;
    TOOLS.forEach((tl, i) => {
      const x = x0 + i * (w + gap), y = 472;
      let sub = '', off = false, subCol;
      if (MDEF[tl.id]) {
        const p = machinePrice(tl.id);
        if (tl.id === 'pilao' && !S.unlocked.pilao) { sub = S.made.onigiri + '/' + UNLOCK_PILAO + ' onigiris'; off = true; }
        else { sub = '¥' + U.fmt(p); subCol = S.money >= p ? C.grassD : C.redD; }
      } else if (tl.id === 'esteira') sub = 'grátis';
      else if (tl.id === 'borracha') sub = 'devolve 100%';
      else sub = undo.length ? undo.length + ' ação(ões)' : '—';
      const icon = tl.id === 'pilao' && !S.unlocked.pilao ? SPR.lock : toolIcon(tl.id);
      button(x, y, w, 56, tl.name, () => {
        if (tl.id === 'undo') return doUndo();
        if (off) { toast('O Pilão abre com ' + UNLOCK_PILAO + ' onigiris'); sfx('error'); return; }
        S.tool = S.tool === tl.id ? null : tl.id; S.sel = null; sfx('click');
      }, { on: S.tool === tl.id, off, sub, subCol, icon, iconS: tl.id === 'esteira' || tl.id === 'borracha' || tl.id === 'undo' ? 2.4 : 3, iconX: 26, iconY: 10, textX: 50, size: 14 });
    });
  }

  /* ======================================================================
     Tutorial (4 toques)
     ====================================================================== */
  const TUT = [
    { r: () => DOCK_IN, t: 'Esta é a Doca de Entrada.', s: ['Ela puxa uma parte do arroz que o Kome cava', '(2 sacos/s). O resto continua vendendo cru.'] },
    { r: () => { const m = machines.find(q => q.type === 'panela'); return m ? mrect(m.type, m.x, m.y, m.rot) : { x: GX, y: GY, w: 52, h: 52 }; }, t: 'A Panela cozinha o arroz.', s: ['1 saco vira 1 arroz cozido em 1,5 s,', 'e o cozido vale 2× o cru. Essa é grátis!'] },
    { r: () => DOCK_OUT, t: 'Doca de Venda.', s: ['Tudo que chega aqui vende sozinho.', 'Se a esteira encher, nada se perde.'] },
    { r: () => ({ x: 14, y: 466, w: 932, h: 70 }), t: 'Pronto, veja o +¥ subindo!', s: ['Agora compre uma Moldadora, ligue com Esteira', 'e transforme o cozido em onigiri (4×).'] },
  ];
  function drawTutorial(t) {
    const st = TUT[S.tut], r = st.r(), pad = 6;
    g.save();
    g.fillStyle = 'rgba(30,18,10,.62)';
    g.beginPath(); g.rect(0, 0, W, H); g.rect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2); g.fill('evenodd');
    g.strokeStyle = C.goldL; g.lineWidth = 3; g.setLineDash([8, 5]); g.lineDashOffset = -t * 30;
    g.strokeRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2); g.setLineDash([]);
    g.restore();
    const bw = 400, bh = 132;
    let bx = U.clamp(r.x + r.w / 2 - bw / 2, 20, W - bw - 20), by = r.y + r.h + 18;
    if (by + bh > H - 10) by = r.y - bh - 18;
    if (S.tut === 0) { bx = r.x + r.w + 30; by = 290; }
    if (S.tut === 2) { bx = r.x - bw - 30; by = 290; }
    card(bx, by, bw, bh, C.cream);
    E.drawShibaHead(g, bx + 44, by + 52, t, { scale: 1.1, expr: 'happy' });
    txt((S.tut + 1) + '/4', bx + bw - 14, by + 16, T(11, '#8A6A4A', 'right'));
    txt(st.t, bx + 86, by + 26, T(16, INK, 'left'));
    st.s.forEach((s, i) => txt(s, bx + 86, by + 50 + i * 18, T(12, '#6B4A2E', 'left')));
    button(bx + bw - 136, by + bh - 52, 122, 44, S.tut === 3 ? 'Começar!' : 'Próximo', () => { S.tut++; sfx('click'); if (S.tut >= TUT.length) endTut(); }, { on: true, size: 14 });
    button(bx + 86, by + bh - 52, 140, 44, 'Pular tutorial', endTut, { size: 12 });
  }
  function endTut() { S.tut = -1; try { localStorage.setItem('kome-fab-tut', '1'); } catch (e) { /* */ } }

  /* ======================================================================
     Entrada (mouse e toque)
     ====================================================================== */
  let drag = null, hover = null, pressBtn = null, lastTap = { t: 0, m: null };
  const toCell = (x, y) => { const cx = Math.floor((x - GX) / CELL), cy = Math.floor((y - GY) / CELL); return inGrid(cx, cy) ? [cx, cy] : null; };
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  input.on('down', (x, y) => {
    for (let i = btns.length - 1; i >= 0; i--) { const b = btns[i]; if (x >= b.x - 3 && y >= b.y - 3 && x < b.x + b.w + 3 && y < b.y + b.h + 6) { pressBtn = b.o; b.fn(); return; } }
    if (S.tut >= 0) return;
    const c = toCell(x, y);
    if (!c) {
      if (inRect(x, y, DOCK_IN)) { S.sel = 'dock'; S.tool = null; return; }
      if (y > 56 && y < 456 && x > 182 && x < 778) { S.sel = null; }
      return;
    }
    const cell = cellAt(c[0], c[1]);
    if (S.tool === 'esteira') {
      drag = { mode: 'belt', last: c, start: c, moved: false, act: beginAction(), changed: false };
      if (!cell) { setBelt(c[0], c[1], lastBeltDir); drag.changed = true; drag.created = true; sfx('click', { pitch: 1.4 }); }
    } else if (S.tool === 'borracha') {
      drag = { mode: 'erase', act: beginAction(), changed: false, last: c };
      if (eraseAt(c[0], c[1], drag.act)) drag.changed = true;
    } else if (MDEF[S.tool]) {
      drag = { mode: 'place', last: c };
    } else {
      if (cell && cell.k === 'm') drag = { mode: 'move', m: cell.m, start: c, last: c, moved: false, off: [cell.m.x - c[0], cell.m.y - c[1]] };
      else if (cell && cell.k === 'b') drag = { mode: 'beltTap', last: c };
      else { S.sel = null; }
    }
  });
  let lastBeltDir = 0;
  input.on('move', (x, y) => {
    hover = toCell(x, y);
    if (!drag) return;
    const c = toCell(x, y); if (!c) return;
    if (drag.mode === 'belt') {
      while (c[0] !== drag.last[0] || c[1] !== drag.last[1]) {
        const [lx, ly] = drag.last; const ddx = c[0] - lx, ddy = c[1] - ly;
        const dir = Math.abs(ddx) >= Math.abs(ddy) ? (ddx > 0 ? 0 : 2) : (ddy > 0 ? 1 : 3);
        const nx = lx + DX[dir], ny = ly + DY[dir];
        const lc = cellAt(lx, ly); if (lc && lc.k === 'b') lc.dir = dir;
        const nc = cellAt(nx, ny);
        if (!nc || nc.k === 'b') { setBelt(nx, ny, dir); }
        lastBeltDir = dir; drag.changed = true; drag.moved = true; drag.last = [nx, ny];
        sfx('click', { pitch: 1.3, vol: 0.4 });
      }
    } else if (drag.mode === 'erase') {
      if (c[0] !== drag.last[0] || c[1] !== drag.last[1]) { drag.last = c; if (eraseAt(c[0], c[1], drag.act)) drag.changed = true; }
    } else if (drag.mode === 'move') {
      if (c[0] !== drag.start[0] || c[1] !== drag.start[1]) drag.moved = true;
      drag.last = c;
    } else drag.last = c;
  });
  input.on('up', (x, y) => {
    pressBtn = null;
    if (!drag) return;
    const d = drag; drag = null;
    const c = toCell(x, y) || d.last;
    if (d.mode === 'belt') {
      if (!d.moved && !d.created) { const cell = cellAt(c[0], c[1]); if (cell && cell.k === 'b') { cell.dir = (cell.dir + 1) % 4; d.changed = true; sfx('click'); } }
      if (d.changed) commit(d.act);
    } else if (d.mode === 'erase') { if (d.changed) commit(d.act); }
    else if (d.mode === 'place') {
      const m = buyMachine(S.tool, c[0], c[1], 0);
      if (m) { S.tool = null; S.sel = m; }
    } else if (d.mode === 'move') {
      if (d.moved) moveMachine(d.m, d.last[0] + d.off[0], d.last[1] + d.off[1]);
      else {
        const now = performance.now();
        if (lastTap.m === d.m && now - lastTap.t < 380) { rotateMachine(d.m); lastTap.m = null; }
        else { lastTap = { t: now, m: d.m }; S.sel = d.m; sfx('click', { pitch: 1.1 }); }
      }
    } else if (d.mode === 'beltTap') {
      const cell = cellAt(c[0], c[1]);
      if (cell && cell.k === 'b') { const a = beginAction(); cell.dir = (cell.dir + 1) % 4; commit(a); sfx('click'); }
    }
  });
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { doUndo(); e.preventDefault(); }
    if (e.key === 'Escape') { S.tool = null; S.sel = null; }
    if (e.key === 'r' && S.sel && S.sel !== 'dock') rotateMachine(S.sel);
  });

  /* ======================================================================
     Fantasma (prévia de pôr / mover)
     ====================================================================== */
  function drawGhost(t) {
    let type, x, y, rot, ignore;
    if (drag && drag.mode === 'move' && drag.moved) { type = drag.m.type; x = drag.last[0] + drag.off[0]; y = drag.last[1] + drag.off[1]; rot = drag.m.rot; ignore = drag.m; }
    else if (MDEF[S.tool] && (hover || (drag && drag.last))) { const c = (drag && drag.last) || hover; const at = fitAnchor(S.tool, c[0], c[1], 0); type = S.tool; rot = 0; if (at) { x = at[0]; y = at[1]; } else { x = c[0]; y = c[1]; } }
    else return;
    const ok = canPlace(type, x, y, rot, ignore);
    for (const [a, b] of mcells(type, x, y, rot)) if (inGrid(a, b)) {
      g.fillStyle = ok ? 'rgba(156,199,107,.35)' : 'rgba(200,66,58,.35)'; g.fillRect(GX + a * CELL + 2, GY + b * CELL + 2, CELL - 4, CELL - 4);
    }
    if (ok) drawMachine({ type, x, y, rot, lvl: 1, rec: 0, inB: { cozido: 0 }, out: [], work: false, prog: 0, anim: 0, sq: 0, idle: 0, id: 0 }, t, 0.6);
  }

  /* ======================================================================
     Laço
     ====================================================================== */
  function update(dt) {
    let left = dt * S.speed;
    while (left > 1e-6) { const st = Math.min(left, 1 / 30); sim(st); left -= st; }
    ps.update(dt); fl.update(dt);
    while (pendingBanners.length && !S.fast) { const [a, b] = pendingBanners.shift(); celebrate(a, b); }
  }
  let anim = 0;
  function render() {
    anim = S.t;
    const t = performance.now() / 1000;
    btns = [];
    g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    g.drawImage(bgCv, 0, 0, W, H);
    drawDocks(t);
    drawBelts(t);
    const ms = machines.slice().sort((a, b) => (a.y + (a.rot === 1 ? 1 : 0)) - (b.y + (b.rot === 1 ? 1 : 0)));
    for (const m of ms) drawMachine(m, t);
    drawGhost(t);
    // poeira na luz
    ps.draw(g); fl.draw(g);
    if (S.tool) {
      const label = { esteira: 'arraste pelas casas · toque numa esteira pra girar', borracha: 'toque ou arraste pra apagar (devolve 100%)' }[S.tool] || ('toque numa casa pra pôr: ' + MDEF[S.tool].name);
      g.fillStyle = 'rgba(42,26,16,.8)'; D.rrect(g, W / 2 - 200, 430, 400, 22, 8); g.fill();
      txt(label, W / 2, 441, T(12, C.cream));
    }
    drawTopBar();
    drawLeftPanel(t);
    drawRightPanel(t);
    drawBottomBar();
    if (S.tut >= 0) drawTutorial(t);
  }

  /* ======================================================================
     Começo: já vem montado (Entrada → esteira → Panela grátis → esteira → Venda)
     ====================================================================== */
  function setup() {
    setBelt(0, 2, 0); setBelt(1, 2, 0);
    makeMachine('panela', 2, 2, 0, { paid: 0 });
    for (let x = 3; x < GW; x++) setBelt(x, 2, 0);
    S.money = 60 * potentialIps();
    let seen = false; try { seen = localStorage.getItem('kome-fab-tut') === '1'; } catch (e) { /* */ }
    S.tut = Q.has('notut') ? -1 : (Q.has('tut') || !seen) ? 0 : -1;
  }
  setup();
  const loop = E.Loop({ update, render });
  loop.start();

  /* ======================================================================
     Ganchos de teste
     ====================================================================== */
  window.__fab = {
    S, ITEMS, MDEF,
    get state() {
      const rt = rates();
      return { money: Math.round(S.money), t: Math.round(S.t), ips: Math.round(ips()), raw: Math.round(rt.raw), fac: Math.round(rt.fac),
        share: +(rt.fac / Math.max(1, rt.raw + rt.fac)).toFixed(3), made: Object.assign({}, S.made), sold: Object.assign({}, S.sold),
        unlocked: Object.assign({}, S.unlocked), dock: S.dockLvl, dockUse: +S.dockUse.toFixed(2), firstSale: +S.firstSale.toFixed(1),
        machines: machines.map(m => ({ id: m.id, type: m.type, x: m.x, y: m.y, rot: m.rot, lvl: m.lvl, rec: m.rec, busy: +m.busy.toFixed(2), blocked: m.blocked, inB: Object.assign({}, m.inB) })),
        jams: (() => { const j = []; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const c = grid[y][x]; if (c && c.k === 'b' && c.jam > 0.4) j.push([x, y]); } return j; })() };
    },
    step(sec, quiet) { S.fast = quiet !== false; let left = sec; while (left > 1e-6) { const st = Math.min(left, 1 / 30); sim(st); left -= st; } S.fast = false; return this.state; },
    place(type, x, y, rot, free) { const m = buyMachine(type, x, y, rot || 0, free !== false); return m ? m.id : null; },
    belt(path, lastDir) {
      for (let i = 0; i < path.length; i++) {
        const [x, y] = path[i]; let dir;
        if (i < path.length - 1) { const [nx, ny] = path[i + 1]; dir = nx > x ? 0 : nx < x ? 2 : ny > y ? 1 : 3; }
        else dir = lastDir !== undefined ? lastDir : (i ? (() => { const [px, py] = path[i - 1]; return x > px ? 0 : x < px ? 2 : y > py ? 1 : 3; })() : 0);
        setBelt(x, y, dir);
      }
    },
    erase(x, y) { const a = beginAction(); eraseAt(x, y, a); commit(a); },
    machineAt(x, y) { const c = cellAt(x, y); return c && c.k === 'm' ? c.m : null; },
    select(x, y) { const c = cellAt(x, y); S.sel = c && c.k === 'm' ? c.m : null; S.tool = null; },
    levelUp(x, y, n) { const m = this.machineAt(x, y); for (let i = 0; i < (n || 1); i++) levelUp(m); },
    recipe(x, y, i) { setRecipe(this.machineAt(x, y), i); },
    dockUp(n) { for (let i = 0; i < (n || 1); i++) dockUp(); },
    money(v) { S.money = v; }, dig(v) { S.dig = v; }, speed(v) { S.speed = v; }, tool(t) { S.tool = t; S.sel = null; },
    tut(n) { S.tut = n; }, undo: doUndo, clearFx() { ps.clear(); },
    unlockAll() { S.unlocked.pilao = true; S.unlocked.mochid = true; },
  };
})();
