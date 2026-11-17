/* Kome no Japão — fabrica.js  (FASE 1 do PLANO-100H · spec docs/design/fabrica.md, APROVADA)
   A FÁBRICA KOME PACK: mini-Factorio fofo visto de cima, em tela cheia por cima do jogo (canvas próprio de 960×540).
   Portada do protótipo do designer (demos/fabrica-proto.js) com:
   - arroz DE VERDADE: a Doca de Entrada puxa uma % do que você cava (G.Fab.dig/sacks recebem do game.js e items.js);
   - valor que acompanha o jogo: 1 item cru vale (renda de cavar/s × pct da doca) / (itens/s da doca); vender paga só o que
     o produto vale A MAIS que o cru (o cru já foi pago ao cavar: nada paga duas vezes, nada se perde);
   - preços em segundos de renda (G.priceIps), dinheiro do jogo (G.S.money), Divisor (alterna esquerda/direita);
   - roda sempre por G.Sim (com a tela fechada também); offline só termina o que já estava nas esteiras (P1 da spec);
   - save em S.stats.fab (layout, níveis, contadores); abre no final da campanha e fica em todas as ilhas.
   Números: D.FAB (data.js). Testes/ganchos: G.Fab (open, close, isOpen, place, belt, step, state, unlockAll). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, C = E.PAL, D = E.Draw, DATA = G.Data, F = DATA.FAB;
  const W = 960, H = 540, INK = '#3B2818', TAU = Math.PI * 2;
  const GW = 8, GH = 6, CELL = 52, GX = 272, GY = 104;
  const BELT_SPEED = F.beltSpeed, SP = 0.25;
  const LVL_SPEED = F.lvl.speed, LVL_COST = F.lvl.cost, MAX_LVL = F.lvl.max;
  const UNLOCK = F.unlock;   // lido ao vivo (painel ?dev e fabrica-sim --set)
  const ITEMS = {
    raw: { name: 'Arroz cru' }, gold: { name: 'Arroz Dourado' }, cozido: { name: 'Arroz Cozido' },
    onigiri: { name: 'Onigiri' }, mochi: { name: 'Mochi' }, mochid: { name: 'Mochi Dourado' },
  };
  for (const k in ITEMS) Object.assign(ITEMS[k], F.items[k]);
  const CARD_ID = { cozido: 'cozido', onigiri: 'onigiri', mochi: 'mochi', mochid: 'mochi_dourado' };   // id no Armazém
  const MDEF = {
    panela: { name: 'Panela', desc: 'cozinha o arroz' }, moldadora: { name: 'Moldadora', desc: 'aperta o arroz em triângulo' },
    pilao: { name: 'Pilão', desc: 'shiba bate mochi no martelão' }, divisor: { name: 'Divisor', desc: 'manda um pra esquerda, um pra direita' },
  };
  for (const k in MDEF) Object.assign(MDEF[k], F.machines[k]);
  MDEF.pilao.recipes.forEach((r, i) => { r.name = i ? 'Mochi Dourado' : 'Mochi'; });
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  const ang = d => d * Math.PI / 2;

  /* ======================================================================
     Estado
     ====================================================================== */
  let api = null;
  const S = {
    on: false, t: 0, dockLvl: 1, dockBudget: 0, dockRR: 0, dockUse: 0,
    made: { cozido: 0, onigiri: 0, mochi: 0, mochid: 0 }, sold: {},
    unlocked: { pilao: false, mochid: false },
    digRate: 0, slow: 0, pb: 0, sackRate: 0, goldMix: 0, digAcc: 0, sackAcc: 0, goldAcc: 0, rateT: 0,
    facAcc: 0, secT: 0, hist: [], tool: null, sel: null, tut: -1, tutDone: false, frame: 0, fast: true,
    timeOpen: 0, firstSale: -1, offYen: 0,
  };
  let grid, machines = [], nextId = 1;
  const undo = [];
  function newGrid() { grid = []; for (let y = 0; y < GH; y++) { grid.push(new Array(GW).fill(null)); } }
  newGrid();
  const ps = E.Particles(900), fl = E.Floaters(140);
  const GS = () => G.S;
  const money = () => (GS() ? GS().money : 0);
  const pay = v => { const s = GS(); if (!s || !(v > 0)) return; s.money += v; s.earned += v; s.dayEarn = (s.dayEarn || 0) + v; s.ipsAcc = (s.ipsAcc || 0) + v; };
  const spend = v => { const s = GS(); s.money -= v; S.pb = Math.max(S.pb || 0, S.slow || 0); };

  /* ---- valor de 1 item cru e ritmo da doca ---- */
  const dockPct = () => Math.min(F.dock.pctMax, F.dock.pct0 + F.dock.pctLvl * (S.dockLvl - 1));
  const dockCap = () => F.dock.items0 * Math.pow(F.dock.itemsGrow, S.dockLvl - 1);                 // itens/s que a doca puxa no máximo
  const unitV = () => Math.max(0, S.slow || S.digRate) * dockPct() / dockCap();                   // ¥ de 1 item cru (renda média de 1 min)
  // preço em segundos da renda MÉDIA de cavar (1 min). Não usa o G.priceIps do jogo: ele guarda o pico de todos os tempos,
  // que no núcleo dourado da Bagger fica muitas vezes acima da renda normal da montanha nova (1ª compra levava 30 min)
  const priceIps = () => Math.max(10, S.slow || S.digRate || (GS() && GS().ips) || 10) * (F.priceK || 1);
  const dockMax = () => dockPct() >= F.dock.pctMax;
  const dockPrice = () => F.dock.price * Math.pow(F.dock.costGrow || F.lvl.cost, S.dockLvl) * priceIps();
  const machinePrice = type => MDEF[type].price * priceIps();
  const levelPrice = m => Math.min(Math.max(MDEF[m.type].price, 20), F.lvl.cap || 1e9) * (F.lvl.base || 1) * Math.pow(F.lvl.cost, m.lvl) * priceIps();
  const recipeOf = m => MDEF[m.type].recipes[m.rec] || { in: {}, out: null, time: 1 };
  const speedOf = m => 1 + LVL_SPEED * (m.lvl - 1);
  function rates() {
    const fac = S.hist.length ? S.hist.reduce((a, h) => a + h, 0) / S.hist.length : 0;
    return { raw: S.digRate, fac };
  }

  /* ======================================================================
     Grid, máquinas, esteiras
     ====================================================================== */
  const inGrid = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH;
  const cellAt = (x, y) => (inGrid(x, y) ? grid[y][x] : null);
  function mcells(type, x, y, rot) { const n = MDEF[type].len, a = []; for (let k = 0; k < n; k++) a.push([x + DX[rot] * k, y + DY[rot] * k]); return a; }
  function front(m) { const c = mcells(m.type, m.x, m.y, m.rot); return c[c.length - 1]; }
  function outTarget(m) { const f = front(m); return [f[0] + DX[m.rot], f[1] + DY[m.rot]]; }
  // divisor: saídas pros lados (esquerda e direita de quem olha pra rot)
  const sideDirs = m => [(m.rot + 3) % 4, (m.rot + 1) % 4];
  function outsOf(m) { if (m.type !== 'divisor') return [outTarget(m)]; return sideDirs(m).map(d => [m.x + DX[d], m.y + DY[d]]); }
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
  function fitAnchor(type, x, y, rot, ignore) {
    const n = MDEF[type].len;
    for (let k = 0; k < n; k++) { const ax = x - DX[rot] * k, ay = y - DY[rot] * k; if (canPlace(type, ax, ay, rot, ignore)) return [ax, ay]; }
    return null;
  }
  function sellLoose(item, px, py) {          // item que sai do mundo (esteira apagada etc.): vende na hora, nada se perde
    const v = (ITEMS[item.t].val - ITEMS[item.t].base) * unitV(); pay(v); S.facAcc += v;
    if (!S.fast && px !== undefined && v > 0) fl.add(px, py, '+¥' + U.fmt(v), { size: 11, c: C.cream, life: 0.8 });
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
      inB: { raw: 0, gold: 0, cozido: 0 }, out: [], work: false, prog: 0, busy: 0, anim: 0, idle: 0, hitN: 0, sq: 0, blocked: false, full: 0, side: 0 };
    if (m.id >= nextId) nextId = m.id + 1;
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
    const m = c.m;
    if (m.type === 'divisor') { if (dir !== m.rot) return false; return m.out.length < 2 ? (m.out.push(item), true) : false; }   // divisor: só entra por trás
    const o = outTarget(m);
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
  let saleAnim = 0;
  function sell(item, row) {
    const it = ITEMS[item.t], v = (it.val - it.base) * unitV();
    pay(v); S.facAcc += v; S.sold[item.t] = (S.sold[item.t] || 0) + 1;
    if (S.firstSale < 0 && item.t !== 'raw' && item.t !== 'gold') S.firstSale = S.timeOpen;
    const p = pend[row]; p.v += v; p.best = Math.max(p.best, it.val);
    saleAnim = 1;
  }
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
  function sim(dt, offline) {
    S.frame++; S.t += dt; if (!S.fast) S.timeOpen += dt;
    // 0) ritmo de cavar (média de ~8 s), do game.js: ¥/s de cavar, sacos/s e quanto é dourado
    S.rateT += dt;
    if (S.rateT >= 1) {
      const k = Math.min(1, S.rateT / 8);
      const r0 = S.digAcc / S.rateT;
      if (!(S.slow > 0)) S.slow = r0; else S.slow += (r0 - S.slow) * Math.min(1, S.rateT / 60);   // 1ª medida já vale (não sobe de zero)
      S.digRate += (S.digAcc / S.rateT - S.digRate) * k; S.sackRate += (S.sackAcc / S.rateT - S.sackRate) * k;
      if (S.sackAcc > 0) S.goldMix += (S.goldAcc / S.sackAcc - S.goldMix) * k;
      S.digAcc = S.sackAcc = S.goldAcc = 0; S.rateT = 0;
    }
    // 1) Doca de Entrada: puxa até dockCap itens/s enquanto você cava (offline não puxa nada)
    if (!offline && S.digRate > 0) {
      S.dockBudget = Math.min(S.dockBudget + dockCap() * dt, 1.5);
      let tries = GH, pulled = 0; const wantGold = machines.some(m => m.type === 'pilao' && m.rec === 1);
      while (S.dockBudget >= 1 && tries-- > 0) {
        S.dockRR = (S.dockRR + 1) % GH;
        // doca esperta: só puxa Arroz Dourado se algum Pilão está na receita Mochi Dourado (senão o dourado vende cru, que já vale 6×)
        const item = { t: wantGold && Math.random() < S.goldMix ? 'gold' : 'raw' };
        if (tryPush(-1, S.dockRR, 0, item)) { S.dockBudget -= 1; pulled++; dockRowAnim[S.dockRR] = 1; }
      }
      if (S.dockBudget > 1) S.dockBudget = 1;           // o que sobra já vendeu cru: nada se perde
      S.dockUse += (pulled / dt - S.dockUse) * Math.min(1, dt / 3);
    } else S.dockUse += (0 - S.dockUse) * Math.min(1, dt / 3);

    // 2) máquinas
    for (const m of machines) {
      if (m.type === 'divisor') {
        if (m.out.length) {   // alterna esquerda/direita; se um lado está travado, tenta o outro
          const ds = sideDirs(m);
          for (let k = 0; k < 2; k++) { const d = ds[(m.side + k) % 2]; if (tryPush(m.x, m.y, d, m.out[0])) { m.out.shift(); m.side = (m.side + k + 1) % 2; break; } }
        }
        m.busy += ((m.out.length ? 1 : 0) - m.busy) * Math.min(1, dt / 6); continue;
      }
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
          if (m.out.length < 2) { m.out.push({ t: R.out }); m.work = false; S.made[R.out]++; m.idle = 0; madeFx(m, R); if (G.Items && G.Items.count) G.Items.count(CARD_ID[R.out], 1); }
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
    if (!S.unlocked.pilao && S.made.onigiri >= UNLOCK.pilao) { S.unlocked.pilao = true; celebrate('Pilão liberado!', 'você fez ' + UNLOCK.pilao + ' onigiris: agora dá pra bater mochi'); }
    if (!S.unlocked.mochid && S.made.mochi >= UNLOCK.dourado && hasGold()) { S.unlocked.mochid = true; celebrate('Receita Mochi Dourado!', '2 cozidos + 1 Arroz Dourado no pilão: vale 48×'); }
    // 5) renda da fábrica por segundo (média dos últimos 10 s)
    S.secT += dt;
    if (S.secT >= 1) { S.hist.push(S.facAcc / S.secT); if (S.hist.length > 10) S.hist.shift(); S.facAcc = 0; S.secT = 0; }
    flushSales(dt);
  }
  const hasGold = () => S.goldMix > 0 || (G.Items && G.Items.has && (GS().stats.got || {}).koshi > 0);
  // algo ainda andando (pro offline parar cedo)
  function busyAny() {
    for (const m of machines) if (m.work || m.out.length || m.inB.raw || m.inB.cozido || m.inB.gold) return true;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const c = grid[y][x]; if (c && c.k === 'b' && c.items.length) return true; }
    return false;
  }

  function celebrate(t, sub) {
    if (S.fast) { pendingBanners.push([t, sub]); return; }
    banner = { t, sub, life: 3.2 };
    sfx('fanfare'); sfx('chirin');
    ps.burst(W / 2, 200, 40, { c: [C.gold, C.sakura, C.goldL, C.cream], shape: 'star', speed: [120, 360], life: 1.2 });
  }
  const pendingBanners = [];
  let banner = null;

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
    if (S.fast || (GS() && GS().opts && GS().opts.mute) || !E.Sfx || !E.Sfx.has || !E.Sfx.has(name)) return;
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
  function commit(a) { undo.push(a); if (undo.length > 60) undo.shift(); persist(); }
  function doUndo() {
    const a = undo.pop();
    if (!a) { toast('nada pra desfazer'); sfx('error'); return; }
    restore(a.snap); GS().money += a.cost; sfx('whoosh', { vol: 0.5 });
  }
  function toast(t) { if (S.fast) return; toastMsg = { t, life: 1.8 }; }

  function buyMachine(type, x, y, rot, free) {
    if (type === 'pilao' && !S.unlocked.pilao && !free) { toast('O Pilão abre com ' + UNLOCK.pilao + ' onigiris'); sfx('error'); return null; }
    const at = fitAnchor(type, x, y, rot);
    if (!at) { sfx('error'); return null; }
    const price = free ? 0 : machinePrice(type);
    if (money() < price) { toast('Falta ¥' + U.fmt(price - money())); sfx('error'); return null; }
    const a = beginAction();
    if (price) spend(price); a.cost = price;
    const m = makeMachine(type, at[0], at[1], rot, { paid: price });
    commit(a);
    if (!S.fast) { const c = mcenter(m); ps.puff(c.x, c.y + 14, 10, 9, { c: C.sand }); sfx('stomp', { vol: 0.35 }); sfx('buy', { vol: 0.5 }); }
    return m;
  }
  function eraseAt(x, y, a) {
    const c = cellAt(x, y); if (!c) return false;
    if (c.k === 'b') { clearBelt(x, y); sfx('click'); return true; }
    const ref = removeMachine(c.m); GS().money += ref; a.cost -= ref;
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
    if (money() < p) { toast('Falta ¥' + U.fmt(p - money())); sfx('error'); return; }
    const a = beginAction(); spend(p); a.cost = p; m.spent += p; m.lvl++; commit(a);
    m.sq = 1; sfx('levelup', { vol: 0.5 }); const c = mcenter(m);
    if (!S.fast) { ps.burst(c.x, c.y, 14, { c: [C.gold, C.goldL], shape: 'star', speed: [60, 180], life: 0.7 }); fl.add(c.x, c.y - 24, 'Nv. ' + m.lvl + '!', { size: 16, c: C.goldL }); }
  }
  function setRecipe(m, i) {
    if (m.rec === i) return;
    if (i === 1 && !S.unlocked.mochid) { toast('Mochi Dourado abre com ' + UNLOCK.dourado + ' mochis'); sfx('error'); return; }
    const a = beginAction();
    const c = mcenter(m), need = MDEF[m.type].recipes[i].in;
    for (const k in m.inB) if (!need[k]) { for (let j = 0; j < m.inB[k]; j++) sellLoose({ t: k }, c.x, c.y - 10); m.inB[k] = 0; }
    m.rec = i; commit(a); sfx('click');
  }
  function dockUp() {
    if (dockMax()) { toast('A doca já está no máximo'); return; }
    const p = dockPrice();
    if (money() < p) { toast('Falta ¥' + U.fmt(p - money())); sfx('error'); return; }
    const a = beginAction(); spend(p); a.cost = p; S.dockLvl++; commit(a);
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
    split: sp('split', `
      ...YY...
      ..YYYY..
      .YY..YY.
      YY....YY
      ...NN...
      ...NN...`),
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
    return outsOf(n.m).some(o => o[0] === x && o[1] === y);
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
    if (m.type === 'divisor') {   // caixinha de madeira com o Y dourado; a seta gira com a peça
      g.fillStyle = INK; D.rrect(g, r.x + 9, r.y + 9, r.w - 18, r.h - 18, 6); g.fill();
      g.fillStyle = C.wood; D.rrect(g, r.x + 11, r.y + 11, r.w - 22, r.h - 22, 5); g.fill();
      g.fillStyle = C.woodL; g.fillRect(r.x + 13, r.y + 13, r.w - 26, 4);
      g.save(); g.translate(cx, r.y + r.h / 2); g.rotate(ang(m.rot) - Math.PI / 2);
      g.strokeStyle = C.gold; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 10); g.lineTo(0, 0); g.lineTo(-9, -8); g.moveTo(0, 0); g.lineTo(9, -8); g.stroke();
      g.restore();
      if (m.out.length) blit(ICON[m.out[0].t], cx, r.y + r.h / 2 + 6, 1.5);
    }
    g.restore();
    if (ghost) return;
    drawPorts(m, r);
    if (m.type === 'divisor') { if (S.sel === m) { g.strokeStyle = C.goldL; g.lineWidth = 2; g.setLineDash([6, 4]); g.lineDashOffset = -t * 20; g.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); g.setLineDash([]); } return; }
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
    if (m.type === 'divisor') {   // duas saídas (lados) e a entrada (trás)
      for (const d of sideDirs(m)) { g.save(); g.translate(GX + m.x * CELL + 26 + DX[d] * 22, GY + m.y * CELL + 26 + DY[d] * 22); g.rotate(ang(d)); g.fillStyle = INK; g.beginPath(); g.moveTo(-5, -7); g.lineTo(3, 0); g.lineTo(-5, 7); g.closePath(); g.fill(); g.fillStyle = C.gold; g.beginPath(); g.moveTo(-4, -5); g.lineTo(1, 0); g.lineTo(-4, 5); g.closePath(); g.fill(); g.restore(); }
      const bx0 = GX + m.x * CELL + 26 - DX[m.rot] * 22, by0 = GY + m.y * CELL + 26 - DY[m.rot] * 22; g.save(); g.translate(bx0, by0); g.rotate(ang(m.rot)); g.fillStyle = INK; g.beginPath(); g.moveTo(-3, -7); g.lineTo(5, 0); g.lineTo(-3, 7); g.closePath(); g.fill(); g.fillStyle = C.cream; g.beginPath(); g.moveTo(-2, -5); g.lineTo(3, 0); g.lineTo(-2, 5); g.closePath(); g.fill(); g.restore();
      return;
    }
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


  /* ---- overlay da fábrica: stage próprio (960×540) por cima do jogo ---- */
  const root = document.createElement('div'); root.className = 'k-fab';
  document.body.appendChild(root);
  const css = document.createElement('style');
  css.textContent = '.k-fab{position:fixed;inset:0;z-index:55;background:#2a1a10;display:none}.k-fab.k-fab-open{display:block}.k-fabchip{background:#FFE0C2}';
  document.head.appendChild(css);
  const stage = E.Stage({ parent: root, width: W, height: H, bg: '#2a1a10' });
  const g = stage.g;
  const input = E.Input(stage);
  let toastMsg = null;

  function drawRightPanel(t) {
    card(782, 62, 170, 392, '#FFF3D6');
    const X = 867;
    if (S.sel && S.sel !== 'dock') return drawCard(S.sel, t);
    if (S.sel === 'dock') { txt('Doca de Entrada', X, 80, T(14)); txt('puxa ' + fmt1(dockCap()) + ' sacos/s', X, 100, T(12, '#6B4A2E')); txt('veja à esquerda', X, 118, T(11, '#8A6A4A')); }
    txt('Metas da fábrica', X, 80, T(14));
    goal(796, 98, 'Pilão', S.made.onigiri, UNLOCK.pilao, 'onigiris', S.unlocked.pilao, ICON.onigiri);
    goal(796, 160, 'Mochi Dourado', S.made.mochi, UNLOCK.dourado, 'mochis', S.unlocked.mochid, ICON.mochid);
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
    if (m.type === 'divisor') return drawDivCard(m, t);
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
        button(794 + i * 75, 156, 71, 44, i ? 'Dourado' : 'Mochi', () => setRecipe(m, i), { on: m.rec === i, off: lock, size: 12, sub: lock ? UNLOCK.dourado + ' mochis' : (rc.time + ' s'), subSize: 11 });
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
    button(794, y + 54, 146, 48, max ? 'Nível máximo' : 'Subir nível', () => levelUp(m), { off: max || money() < p, sub: max ? '' : '¥' + U.fmt(p) + '  (+25%)', subCol: money() >= p ? C.grassD : C.redD });
    button(794, y + 112, 70, 44, 'Girar', () => rotateMachine(m), { size: 12 });
    button(870, y + 112, 70, 44, 'Tirar', () => { const a = beginAction(); const c = mcenter(m); const ref = removeMachine(m); GS().money += ref; a.cost = -ref; commit(a); sfx('pop'); if (ref) fl.add(c.x, c.y, 'devolveu ¥' + U.fmt(ref), { size: 12, c: C.goldL }); }, { size: 12, sub: m.paid + m.spent > 0 ? '+¥' + U.fmt(m.paid + m.spent) : 'grátis', subSize: 11 });
  }

  const TOOLS = [
    { id: 'panela', name: 'Panela' }, { id: 'moldadora', name: 'Moldadora' }, { id: 'pilao', name: 'Pilão' },
    { id: 'esteira', name: 'Esteira' }, { id: 'divisor', name: 'Divisor' }, { id: 'borracha', name: 'Borracha' }, { id: 'undo', name: 'Desfazer' },
  ];
  const toolIcon = id => ({ panela: ICON.cozido, moldadora: ICON.onigiri, pilao: ICON.mochi, esteira: SPR.belt, divisor: SPR.split, borracha: SPR.eraser, undo: SPR.undo })[id];
  function drawBottomBar() {
    g.fillStyle = INK; g.fillRect(0, 460, W, 80);
    g.fillStyle = '#4A3020'; g.fillRect(0, 463, W, 77);
    const w = 128, gap = 6, x0 = (W - (w * 7 + gap * 6)) / 2;
    TOOLS.forEach((tl, i) => {
      const x = x0 + i * (w + gap), y = 472;
      let sub = '', off = false, subCol;
      if (MDEF[tl.id] && tl.id !== 'divisor') {
        const p = machinePrice(tl.id);
        if (tl.id === 'pilao' && !S.unlocked.pilao) { sub = S.made.onigiri + '/' + UNLOCK.pilao + ' onigiris'; off = true; }
        else { sub = '¥' + U.fmt(p); subCol = money() >= p ? C.grassD : C.redD; }
      } else if (tl.id === 'esteira' || tl.id === 'divisor') sub = 'grátis';
      else if (tl.id === 'borracha') sub = 'devolve 100%';
      else sub = undo.length ? undo.length + ' ação(ões)' : '—';
      const icon = tl.id === 'pilao' && !S.unlocked.pilao ? SPR.lock : toolIcon(tl.id);
      button(x, y, w, 56, tl.name, () => {
        if (tl.id === 'undo') return doUndo();
        if (off) { toast('O Pilão abre com ' + UNLOCK.pilao + ' onigiris'); sfx('error'); return; }
        S.tool = S.tool === tl.id ? null : tl.id; S.sel = null; sfx('click');
      }, { on: S.tool === tl.id, off, sub, subCol, icon, iconS: tl.id === 'esteira' || tl.id === 'divisor' || tl.id === 'borracha' || tl.id === 'undo' ? 2.4 : 3, iconX: 26, iconY: 10, textX: 48, size: 13 });
    });
  }

  const TUT = [
    { r: () => DOCK_IN, t: 'Esta é a Doca de Entrada.', s: ['Ela puxa uma parte do arroz que você cava', '(10% no começo). O resto vende cru, como sempre.'] },
    { r: () => { const m = machines.find(q => q.type === 'panela'); return m ? mrect(m.type, m.x, m.y, m.rot) : { x: GX, y: GY, w: 52, h: 52 }; }, t: 'A Panela cozinha o arroz.', s: ['1 saco vira 1 arroz cozido em 1 s,', 'e o cozido vale 2× o cru. Essa é grátis!'] },
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
  function endTut() { S.tut = -1; S.tutDone = true; persist(); }

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
    if (!isOpen()) return;
    if (e.key === 'Escape' && !S.tool && !S.sel) { close(); return; }
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
     Barra de cima e painel da doca (versão do jogo)
     ====================================================================== */
  function drawTopBar() {
    g.fillStyle = INK; g.fillRect(0, 0, W, 52);
    g.fillStyle = '#4A3020'; g.fillRect(0, 0, W, 49);
    g.fillStyle = C.gold; g.fillRect(0, 49, W, 3);
    button(8, 5, 132, 40, '← Montanha', close, { fill: '#F6B6B0', size: 15 });
    card(152, 6, 168, 36);
    txt('¥', 168, 24, T(22, C.goldD));
    txt(U.fmt(Math.floor(money())), 182, 25, T(20, INK, 'left'));
    const rt = rates(), tot = rt.raw + rt.fac, sh = tot > 0 ? rt.fac / tot : 0;
    card(330, 6, 300, 36);
    txt('fábrica ¥' + U.fmt(rt.fac) + '/s', 340, 17, T(14, INK, 'left'));
    txt('cavando ¥' + U.fmt(rt.raw) + '/s', 340, 33, T(11, '#6B4A2E', 'left'));
    const bx = 510, bw = 112;
    g.fillStyle = INK; g.fillRect(bx - 1, 11, bw + 2, 10);
    g.fillStyle = C.riceS; g.fillRect(bx, 12, bw, 8);
    g.fillStyle = C.ora; g.fillRect(bx, 12, bw * sh, 8);
    txt(Math.round(sh * 100) + '% da renda', bx + bw / 2, 30, T(11, C.oraD));
    card(640, 6, 312, 36);
    const items = ['cozido', 'onigiri', 'mochi', 'mochid'];
    items.forEach((k, i) => {
      const x = 652 + i * 76, locked = (k === 'mochi' && !S.unlocked.pilao) || (k === 'mochid' && !S.unlocked.mochid);
      blit(ICON[k], x + 8, 33, 2, { alpha: locked ? 0.35 : 1 });
      txt(locked ? '?' : U.fmt(S.made[k]), x + 20, 25, T(12, locked ? '#9a8a76' : INK, 'left'));
    });
  }
  function drawLeftPanel(t) {
    card(8, 62, 170, 392, '#FFF3D6');
    txt('Kome cavando', 93, 78, T(14));
    txt(U.fmt(S.sackRate) + ' sacos/s', 93, 94, T(11, '#8A6A4A'));
    g.fillStyle = C.riceS; g.beginPath(); g.ellipse(118, 160, 40, 22, 0, Math.PI, 0); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    g.fillStyle = C.rice; g.beginPath(); g.ellipse(112, 152, 22, 8, 0, Math.PI, 0); g.fill();
    const digging = S.digRate > 0;
    E.drawShiba(g, 62, 160, digging ? 'dig' : 'sit', t, { scale: 1, pal: (GS().look && GS().look.pal) || 'kome' });
    if (digging && Math.random() < 0.2) ps.add({ x: 84, y: 146, vx: U.rnd(20, 90), vy: U.rnd(-140, -60), g: 400, shape: 'grain', c: Math.random() < S.goldMix ? C.gold : C.rice, life: 0.6, w: 2, h: 3 });
    g.fillStyle = INK; g.fillRect(20, 160, 146, 2);
    txt('1 item cru = ¥' + U.fmt(unitV()), 93, 182, T(12, C.goldD));
    txt(Math.round(S.goldMix * 100) + '% dourado', 93, 200, T(11, '#8A6A4A'));
    g.fillStyle = 'rgba(59,40,24,.15)'; g.fillRect(18, 214, 150, 2);
    txt('Doca de Entrada · Nv. ' + S.dockLvl, 93, 232, T(12));
    txt('puxa ' + Math.round(dockPct() * 100) + '% do que você cava', 93, 250, T(11, '#6B4A2E'));
    const cap = dockCap(), use = Math.min(S.dockUse, cap);
    txt('usando ' + fmt1(use) + ' de ' + fmt1(cap) + ' itens/s', 93, 268, T(11, '#6B4A2E'));
    const bw = 140; g.fillStyle = INK; g.fillRect(22, 278, bw + 2, 9); g.fillStyle = C.riceS; g.fillRect(23, 279, bw, 7);
    g.fillStyle = C.grass; g.fillRect(23, 279, bw * U.clamp(use / Math.max(0.01, cap), 0, 1), 7);
    const p = dockPrice(), max = dockPct() >= F.dock.pctMax;
    button(18, 300, 150, 52, max ? 'Doca no máximo' : 'Subir doca', dockUp, { sub: max ? '' : '¥' + U.fmt(p) + ' (+5% e +40%/s)', subSize: 10, subCol: money() >= p ? C.grassD : C.redD, off: max || money() < p });
    txt('nada se perde: o que', 93, 382, T(11, '#8A6A4A'));
    txt('a doca não puxa', 93, 398, T(11, '#8A6A4A'));
    txt('vende cru, como sempre', 93, 414, T(11, '#8A6A4A'));
    if (!digging) txt('cave pra fábrica andar!', 93, 438, T(11, C.redD));
  }
  function drawDivCard(m, t) {
    const X = 867;
    txt('Divisor', 796, 80, T(15, INK, 'left'));
    txt('um pra esquerda, um pra direita', X, 100, T(10, '#8A6A4A'));
    txt('entra por trás (setinha creme)', X, 130, T(11, '#6B4A2E'));
    txt('sai pelos dois lados', X, 148, T(11, '#6B4A2E'));
    txt('lado travado? manda pro outro', X, 166, T(11, '#6B4A2E'));
    button(794, 200, 70, 44, 'Girar', () => rotateMachine(m), { size: 12 });
    button(870, 200, 70, 44, 'Tirar', () => { const a = beginAction(); removeMachine(m); commit(a); sfx('pop'); }, { size: 12, sub: 'grátis', subSize: 11 });
  }

  /* ======================================================================
     Tela: overlay em tela cheia com stage próprio (960×540, cabe deitado no celular)
     ====================================================================== */
  function drawOverlayMsgs(t, dt) {
    if (banner) {
      banner.life -= dt; const a = U.clamp(Math.min(banner.life, 3.2 - banner.life) * 3, 0, 1);
      g.globalAlpha = a; card(W / 2 - 220, 150, 440, 74, '#FFE9A8');
      txt(banner.t, W / 2, 176, T(22, INK)); txt(banner.sub, W / 2, 204, T(13, '#6B4A2E')); g.globalAlpha = 1;
      if (banner.life <= 0) banner = null;
    }
    if (toastMsg) {
      toastMsg.life -= dt; g.globalAlpha = U.clamp(toastMsg.life * 3, 0, 1);
      g.fillStyle = 'rgba(42,26,16,.88)'; D.rrect(g, W / 2 - 190, 404, 380, 26, 9); g.fill();
      txt(toastMsg.t, W / 2, 417, T(13, C.cream)); g.globalAlpha = 1;
      if (toastMsg.life <= 0) toastMsg = null;
    }
  }
  let lastT = 0, raf = 0;
  function frame() {
    if (!isOpen()) { raf = 0; return; }
    const now = performance.now() / 1000, dt = Math.min(0.05, lastT ? now - lastT : 0.016); lastT = now;
    ps.update(dt); fl.update(dt);
    while (pendingBanners.length) { const [a, b] = pendingBanners.shift(); S.fast = false; celebrate(a, b); }
    render(dt);
    raf = requestAnimationFrame(frame);
  }
  function render(dt) {
    const t = performance.now() / 1000;
    btns = [];
    g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    g.drawImage(bgCv, 0, 0, W, H);
    drawDocks(t);
    drawBelts(t);
    const ms = machines.slice().sort((a, b) => (a.y + (a.rot === 1 ? 1 : 0)) - (b.y + (b.rot === 1 ? 1 : 0)));
    for (const m of ms) drawMachine(m, t);
    drawGhost(t);
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
    drawOverlayMsgs(t, dt);
    if (S.tut >= 0) drawTutorial(t);
  }

  /* ======================================================================
     Save (S.stats.fab), começo já montado, desbloqueio
     ====================================================================== */
  function persist() {
    const s = GS(); if (!s || !S.on) return;
    const bs = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const c = grid[y][x]; if (c && c.k === 'b') bs.push([x, y, c.dir]); }
    s.stats.fab = { on: 1, dock: S.dockLvl, ms: machines.map(m => [m.type, m.x, m.y, m.rot, m.lvl, m.rec, Math.round(m.paid), Math.round(m.spent)]), bs,
      made: Object.assign({}, S.made), un: [S.unlocked.pilao ? 1 : 0, S.unlocked.mochid ? 1 : 0], tut: S.tutDone ? 1 : 0, fs: S.firstSale, pb: S.pb, slow: S.slow };
  }
  function load() {
    const d = GS() && GS().stats.fab; if (!d || !d.on) return false;
    newGrid(); machines = [];
    S.on = true; S.dockLvl = d.dock | 0 || 1; Object.assign(S.made, d.made || {});
    S.unlocked.pilao = !!(d.un && d.un[0]); S.unlocked.mochid = !!(d.un && d.un[1]); S.tutDone = !!d.tut; S.firstSale = d.fs === undefined ? -1 : d.fs; S.pb = +d.pb || 0; S.slow = +d.slow || 0;
    for (const [x, y, dir] of d.bs || []) setBelt(x, y, dir);
    for (const q of d.ms || []) if (MDEF[q[0]] && canPlace(q[0], q[1], q[2], q[3])) makeMachine(q[0], q[1], q[2], q[3], { lvl: q[4], rec: q[5], paid: q[6], spent: q[7] });
    return true;
  }
  function setup() {
    newGrid(); machines = [];
    setBelt(0, 2, 0); setBelt(1, 2, 0);
    makeMachine('panela', 2, 2, 0, { paid: 0 });
    for (let x = 3; x < GW; x++) setBelt(x, 2, 0);
  }
  function unlock(quiet) {
    if (S.on) return;
    S.on = true; setup(); persist();
    if (!quiet && api && api.banner) api.banner();
  }

  /* ---- botão "Fábrica" no topo do HUD (ao lado do chip das Ilhas) ---- */
  let hudBtn = null, hudT = 0;
  function hudTick(dt) {
    hudT -= dt; if (hudT > 0) return; hudT = 0.5;
    if (!G.HUD || !G.HUD.zones || !G.HUD.zones.tc) return;
    if (!hudBtn) {
      hudBtn = document.createElement('button'); hudBtn.className = 'k-btn k-islchip k-fabchip';
      hudBtn.innerHTML = '<span class="k-islchip-t"><b>Fábrica</b><small></small></span>';
      hudBtn.addEventListener('click', () => open());
      G.HUD.zones.tc.appendChild(hudBtn);
    }
    hudBtn.style.display = S.on ? '' : 'none'; if (!S.on) return;
    const rt = rates(), tot = rt.raw + rt.fac, sh = tot > 0 ? Math.round(rt.fac / tot * 100) : 0;
    const sub = (S.tutDone ? '¥' + U.fmt(rt.fac) + '/s · ' + sh + '%' : 'nova! toque');
    const sm = hudBtn.querySelector('small'); if (sm.textContent !== sub) sm.textContent = sub;
    hudBtn.classList.toggle('k-pulse', !S.tutDone);
  }

  /* ---- passo por tempo (G.Sim): roda com a tela aberta ou fechada ---- */
  let saveT = 0;
  function tick(dt) {
    const s = GS(); if (!s) return;
    if (!S.on) { if (s.ended) unlock(false); hudTick(dt); return; }
    S.fast = !isOpen();
    let left = Math.min(dt, 0.25);
    while (left > 1e-6) { const st = Math.min(left, 1 / 30); sim(st, false); left -= st; }
    hudTick(dt);
    if ((saveT -= dt) <= 0) { saveT = 2; persist(); }
  }
  function offline(dt) {
    if (!S.on || !busyAny()) return null;
    const m0 = money(); S.fast = true;
    let left = Math.min(dt, 120);
    while (left > 1e-6 && busyAny()) { const st = Math.min(left, 0.1); sim(st, true); left -= st; }
    return { yen: money() - m0 };
  }

  /* ---- abrir / fechar ---- */
  function isOpen() { return !!(root && root.classList.contains('k-fab-open')); }
  function open() {
    if (!S.on) return false;
    root.classList.add('k-fab-open'); stage.resize(); S.fast = false; lastT = 0;
    if (!S.tutDone && S.tut < 0) S.tut = 0;
    if (!raf) raf = requestAnimationFrame(frame);
    sfx('whoosh');
    return true;
  }
  function close() {
    if (!isOpen()) return;
    root.classList.remove('k-fab-open'); S.tool = null; drag = null; S.fast = true; persist();
    if (api && api.save) api.save();
  }

  G.Sim && 0;   // (registrado no init: G.Sim é criado pelo game.js no boot)
  G.Fab = {
    init(a) {
      api = a || {};
      if (!load() && GS().ended) unlock(true);   // save antigo que já terminou a campanha: fábrica aparece direto
      if (G.Sim) G.Sim.add('fabrica', { tick, offline });
      const aw = GS().away, yen = aw && aw.res && aw.res.fabrica ? aw.res.fabrica.yen : 0;
      if (yen > 0 && api.toast) api.toast('Enquanto você estava fora', 'a fábrica terminou o que estava na esteira: +¥' + U.fmt(yen));
    },
    // chamados pelo game.js / items.js
    dig(v) { if (S.on) S.digAcc += v; },                       // só conta com a fábrica aberta (senão a campanha inteira entrava na 1ª média)
    sacks(id, n) { if (!S.on) return; S.sackAcc += n; if (id === 'koshi') S.goldAcc += n; },
    open, close, isOpen, unlock: () => unlock(true), on: () => S.on, persist,
    // testes e simulador
    step(sec) { const f = S.fast; S.fast = true; let left = sec; while (left > 1e-6) { const st = Math.min(left, 1 / 30); sim(st, false); left -= st; } S.fast = f; return G.Fab.state; },
    place(type, x, y, rot, free) { const m = free ? makeMachine(type, x, y, rot || 0, { paid: 0 }) : buyMachine(type, x, y, rot || 0); return m ? m.id : null; },
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
    levelUp(x, y) { const m = G.Fab.machineAt(x, y); if (m) levelUp(m); },
    recipe(x, y, i) { setRecipe(G.Fab.machineAt(x, y), i); },
    dockUp, unlockAll() { S.unlocked.pilao = true; S.unlocked.mochid = true; }, skipTut() { S.tut = -1; S.tutDone = true; }, tut(n) { S.tut = n; },
    price: machinePrice, levelPrice: (x, y) => levelPrice(G.Fab.machineAt(x, y)), dockPrice,
    get state() {
      const rt = rates();
      return { on: S.on, fac: Math.round(rt.fac), raw: Math.round(rt.raw), share: +(rt.fac / Math.max(1, rt.raw + rt.fac)).toFixed(3), unit: unitV(),
        made: Object.assign({}, S.made), unlocked: Object.assign({}, S.unlocked), dock: S.dockLvl, dockMax: dockMax(), dockUse: +S.dockUse.toFixed(2), firstSale: S.firstSale,
        machines: machines.map(m => ({ type: m.type, x: m.x, y: m.y, rot: m.rot, lvl: m.lvl, busy: +m.busy.toFixed(2) })), free: (() => { let n = 0; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (!grid[y][x]) n++; return n; })() };
    },
  };
})();
