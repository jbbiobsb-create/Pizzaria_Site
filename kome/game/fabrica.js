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
  const A = G.FabArt, GEO = A.geo, K = A.K;                 // arte e medidas do palco (fabrica-arte.js)
  const GW = GEO.GW, GH = GEO.GH, CW = GEO.CW, CH = GEO.CH, GX = GEO.GX, GY = GEO.GY, GR = GX + GW * CW;
  const cellX = x => GX + x * CW + CW / 2, cellY = y => GY + y * CH + CH / 2;
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
    digRate: 0, slow: 0, s5: 0, pb: 0, sackRate: 0, goldMix: 0, digAcc: 0, sackAcc: 0, goldAcc: 0, rateT: 0,
    facAcc: 0, secT: 0, hist: [], tool: null, sel: null, tut: -1, tutDone: false, frame: 0, fast: true,
    timeOpen: 0, firstSale: -1, offYen: 0,
    starBank: {},   // estrelas de máquina tirada do grid (por tipo): a próxima do mesmo tipo comprada leva (o selo é permanente)
  };
  let grid, machines = [], nextId = 1;
  const undo = [];
  function newGrid() { grid = []; for (let y = 0; y < GH; y++) { grid.push(new Array(GW).fill(null)); } }
  newGrid();
  const ps = E.Particles(900), fl = E.Floaters(140);
  const GS = () => G.S;
  const money = () => (GS() ? GS().money : 0);
  const pay = v => { const s = GS(); if (!s || !(v > 0)) return; s.money += v; s.earned += v; s.dayEarn = (s.dayEarn || 0) + v; s.ipsAcc = (s.ipsAcc || 0) + v; };
  const spend = v => { const s = GS(); s.money -= v; rebase(); };

  /* ---- valor de 1 item cru e ritmo da doca ---- */
  const dockPct = () => Math.min(F.dock.pctMax, F.dock.pct0 + F.dock.pctLvl * (S.dockLvl - 1));
  const dockCap = () => F.dock.items0 * Math.pow(F.dock.itemsGrow, S.dockLvl - 1);                 // itens/s que a doca puxa no máximo
  const unitV = () => Math.max(0, S.slow || S.digRate) * dockPct() / dockCap();                   // ¥ de 1 item cru (renda média de 1 min)
  // preço em segundos da renda MÉDIA de cavar. Não usa o G.priceIps do jogo: ele guarda o pico de todos os tempos,
  // que no núcleo dourado da Bagger fica muitas vezes acima da renda normal da montanha nova (1ª compra levava 30 min).
  // PREÇO TRAVADO (v7, "fica mais caro toda hora e não dá pra comprar nunca"): antes o preço seguia a média de 1 min a cada
  // quadro; numa ilha nova a renda sobe ×1000 em 25 min e o preço fugia do bolso (Moldadora ¥1,3 mil → ¥2 mi sem comprar
  // nada). Agora a renda de referência S.pb só muda quando você COMPRA algo na fábrica (rebase, menor entre a média de 1 min
  // e a de 5 min: comprar no meio de um Frenesi não deixa a próxima ×7) ou quando a renda cai pra menos da metade (preço só
  // desce sozinho, nunca sobe). Ilha nova zera (islands.js makeSave) e a 1ª medida trava.
  const baseNow = () => { const r = S.slow || S.digRate; return r > 0 ? Math.min(r, S.s5 > 0 ? S.s5 : r) : 0; };
  function rebase() { const b = baseNow(); if (b > 0) S.pb = b; }
  function priceBase() { if (!(S.pb > 0)) rebase(); return S.pb > 0 ? S.pb : (GS() && GS().ips) || 10; }
  // × Amigo do Corretor (sementes: "todos os preços") × amuletos de preço (Pão-Duro "tudo custa 20% menos", Diesel +20%)
  const priceCut = () => (G.Islands && G.Islands.precoMul ? G.Islands.precoMul() : 1) * (G.Amuletos ? G.Amuletos.mult('preco') : 1);
  // valor do que a fábrica vende: amuletos (Chef, Esteira Expressa, Selo de Exportação) × semente Tempero da Vó (islands.js)
  const fabMul = () => (G.Amuletos ? G.Amuletos.mult('fab') : 1) * (G.Islands && G.Islands.fabMul ? G.Islands.fabMul() : 1);
  const priceIps = () => Math.max(10, priceBase()) * (F.priceK || 1) * priceCut();
  const dockMax = () => dockPct() >= F.dock.pctMax;
  const dockPrice = () => F.dock.price * Math.pow(F.dock.costGrow || F.lvl.cost, S.dockLvl) * priceIps();
  const machinePrice = type => MDEF[type].price * priceIps();
  // SELO DE QUALIDADE (fabrica.md fim de jogo + jogo-infinito.md: sem teto): no nível máximo a máquina "tira o selo", volta pro
  // Nv. 1 e ganha 1 estrela: +50% no valor do que ela produz por estrela (o bônus vai junto no item até a venda, então a linha
  // inteira estrelada multiplica) e os níveis dela ficam ×3 mais caros por estrela. Placa: bronze, prata (5), ouro (10), arco-íris (25).
  const SELO = F.selo || { val: 0.5, cost: 3 };
  const starMul = m => 1 + SELO.val * (m.star | 0);
  const levelPrice = m => Math.min(Math.max(MDEF[m.type].price, 20), F.lvl.cap || 1e9) * (F.lvl.base || 1) * Math.pow(F.lvl.cost, m.lvl) * Math.pow(SELO.cost, m.star | 0) * priceIps();
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
    return { x: GX + x0 * CW, y: GY + y0 * CH, w: (x1 - x0 + 1) * CW, h: (y1 - y0 + 1) * CH };
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
    const v = (ITEMS[item.t].val - ITEMS[item.t].base) * unitV() * fabMul(); pay(v); S.facAcc += v;
    if (!S.fast && px !== undefined && v > 0) fl.add(px, py, '+¥' + U.fmt(v), { size: 17, c: C.cream, life: 0.8 });
  }
  function clearBelt(x, y) {
    const c = cellAt(x, y); if (!c || c.k !== 'b') return;
    for (const it of c.items) sellLoose(it, cellX(x), cellY(y) - 8);
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
    const m = { id: o.id || nextId++, type, x, y, rot, lvl: o.lvl || 1, rec: o.rec || 0, paid: o.paid || 0, spent: o.spent || 0, star: o.star | 0, qA: 0, qN: 0, wq: 1,
      inB: { raw: 0, gold: 0, cozido: 0 }, out: [], work: false, prog: 0, busy: 0, anim: 0, idle: 0, hitN: 0, sq: 0, blocked: false, full: 0, side: 0, pop: 0 };
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
    m.inB = { raw: 0, gold: 0, cozido: 0 }; m.out = []; m.work = false; m.prog = 0; m.qA = 0; m.qN = 0;
  }
  function removeMachine(m) {
    dumpMachine(m); vacate(m);
    if (m.star) { S.starBank[m.type] = (S.starBank[m.type] | 0) + m.star; m.star = 0; }   // o selo não se perde: fica guardado pra próxima
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
      if (m.inB[item.t] < need[item.t] * 2) { m.inB[item.t]++; m.qA += item.q || 1; m.qN++; return true; }
      // esperando OUTRO ingrediente (ex.: pilão dourado sem Arroz Dourado): o que sobra passa direto, senão a linha trava pra sempre
      if (!hasAll(m) && m.out.length < 2) { m.out.push(item); return true; }
      m.full = 0.4; return false;                       // fila cheia: espera na esteira (gargalo)
    }
    if (m.out.length < 2) { m.out.push(item); return true; }   // não usa: passa direto pra frente
    return false;
  }
  function hasAll(m) { const need = recipeOf(m).in; for (const k in need) if (m.inB[k] < need[k]) return false; return true; }

  /* ---------- venda na doca ---------- */
  const pend = { v: 0, best: 0, t: 0, n: 0 };
  function sell(item, row) {
    if (G.City && G.City.take(item.t, item.q || 1)) { S.sold.vila = (S.sold.vila | 0) + 1; return; }   // fatia da Vila: vai pra Despensa da Cidade (paga lá)
    const it = ITEMS[item.t], v = (it.val - it.base) * (item.q || 1) * unitV() * fabMul();   // amuletos Chef / Esteira Expressa; q = Selo de Qualidade
    pay(v); S.facAcc += v; S.sold[item.t] = (S.sold[item.t] || 0) + 1;
    if (S.firstSale < 0 && item.t !== 'raw' && item.t !== 'gold') S.firstSale = S.timeOpen;
    pend.v += v; pend.best = Math.max(pend.best, it.val); pend.n++;
    if (!S.fast && ship.length < 26) ship.push({ t: item.t, x: GR - 6, y: cellY(row), st: 0, u: 0 });   // sobe a esteira até o kei-truck
  }
  function flushSales(dt) {
    pend.t -= dt;
    if (!(pend.v > 0) || pend.t > 0) return;
    if (!S.fast && pend.v >= 1) {
      const b = pend.best, size = 17 + Math.log2(b + 1) * 2.2, x = GEO.doorOut.x + 78, y = GEO.WALL - 34;   // o +¥ estoura em cima do kei-truck
      const c = b >= 40 ? C.goldL : b >= 10 ? C.sakura : b >= 4 ? C.yelL : C.cream;
      popK = (popK + 1) % 3;   // 3 posições alternadas: os +¥ não se encavalam
      fl.add(x + (popK - 1) * 40, y - popK * 9, '+¥' + U.fmt(pend.v), { size, c, life: 0.85 + b / 90, pop: 1 + b / 30, shake: b >= 40 ? 1.2 : 0 });
      if (b >= 40) ps.burst(x, y, 10, { c: [C.gold, C.goldL], shape: 'star', speed: [60, 160], life: 0.7, up: 80 });
      coinFly(x, y, b >= 40 ? 4 : b >= 10 ? 3 : b >= 4 ? 2 : 1); saleFlash = 1;
      sfx('fab-caixa', { pitch: 0.82 + Math.min(1.1, Math.log2(b + 1) * 0.17), vol: 0.5 });   // produto mais caro = sininho mais agudo
    }
    pend.v = 0; pend.best = 0; pend.n = 0; pend.t = 0.8;
  }
  let popK = 0;

  /* ---------- passo da simulação ---------- */
  function sim(dt, offline) {
    S.frame++; S.t += dt; if (!S.fast) S.timeOpen += dt;
    // 0) ritmo de cavar (média de ~8 s), do game.js: ¥/s de cavar, sacos/s e quanto é dourado
    S.rateT += dt;
    if (S.rateT >= 1) {
      const k = Math.min(1, S.rateT / 8);
      const r0 = S.digAcc / S.rateT;
      if (!(S.slow > 0)) S.slow = r0; else S.slow += (r0 - S.slow) * Math.min(1, S.rateT / 60);   // 1ª medida já vale (não sobe de zero)
      if (!(S.s5 > 0)) S.s5 = r0; else S.s5 += (r0 - S.s5) * Math.min(1, S.rateT / 300);          // média de 5 min (preço travado)
      if (S.pb > 0 && Math.max(S.slow, S.s5) < S.pb * 0.5) S.pb = Math.max(S.slow, S.s5);          // renda caiu de verdade: preço desce (nunca sobe sozinho)
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
        m.busy += ((m.out.length ? 1 : 0) - m.busy) * Math.min(1, dt / 6); m.sq = Math.max(0, m.sq - dt * 5); continue;
      }
      const R = recipeOf(m);
      if (m.out.length) { const f = front(m); if (tryPush(f[0], f[1], m.rot, m.out[0])) m.out.shift(); }
      if (!m.work && hasAll(m) && m.out.length < 2) {
        let n = 0; for (const k in R.in) { m.inB[k] -= R.in[k]; n += R.in[k]; }
        const q = m.qN > 0 ? m.qA / m.qN : 1; m.qA = Math.max(0, m.qA - q * n); m.qN = Math.max(0, m.qN - n); m.wq = q * starMul(m);   // selo: qualidade dos ingredientes × estrelas
        m.work = true; m.prog = 0; m.hitN = 0;
      }
      m.blocked = false;
      if (m.work) {
        if (m.prog < 1) { m.prog = Math.min(1, m.prog + dt * speedOf(m) / R.time); m.anim += dt * speedOf(m); }
        machineFx(m, R);
        if (m.prog >= 1) {
          if (m.out.length < 2) { m.out.push(m.wq > 1 ? { t: R.out, q: m.wq } : { t: R.out }); m.work = false; S.made[R.out]++; m.idle = 0; madeFx(m, R); if (S.made[R.out] === 1 && R.out !== 'cozido') { if (S.fast) pendingFirst.push(R.out); else firstMade(R.out); } if (G.Items && G.Items.count) G.Items.count(CARD_ID[R.out], 1); }
          else m.blocked = true;
        }
      }
      const working = m.work && m.prog < 1;
      m.busy += ((working ? 1 : 0) - m.busy) * Math.min(1, dt / 6);
      if (!working) m.idle += dt; else m.idle = 0;
      m.full = Math.max(0, m.full - dt);
      m.sq = Math.max(0, m.sq - dt * 5); m.pop = Math.max(0, (m.pop || 0) - dt * 2.8);
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
    banner = { t, sub, life: 3.2 }; chipPop[/Dourado/.test(t) ? 1 : 0] = 3;
    sfx('fanfare'); sfx('chirin');
    ps.burst(/Dourado/.test(t) ? 896 : 778, 30, 18, { c: [C.gold, C.goldL, C.cream], shape: 'star', speed: [80, 220], life: 0.9 });
    ps.burst(W / 2, 200, 40, { c: [C.gold, C.sakura, C.goldL, C.cream], shape: 'star', speed: [120, 360], life: 1.2 });
  }
  const pendingBanners = [], pendingFirst = [];
  let banner = null;

  /* ---------- efeitos das máquinas ---------- */
  function mcenter(m) { const r = mrect(m.type, m.x, m.y, m.rot); return { x: r.x + r.w / 2, y: r.y + r.h / 2, r }; }
  function machineFx(m, R) {
    if (S.fast) return;
    const r = mrect(m.type, m.x, m.y, m.rot), b = mbase(m, r);
    if (m.type === 'panela') {            // vapor em plumas + borbulho (o borbulho é um loop só: bubbleLoop)
      if (Math.random() < 0.2) { const p = A.panelaTop(m, b.cx, b.by); ps.add({ x: p.x + U.rnd(-12, 12), y: p.y + U.rnd(0, 8), vx: U.rnd(-10, 10), vy: U.rnd(-58, -30), shape: 'puff', c: Math.random() < 0.5 ? '#FFFFFF' : '#F3EEE2', w: U.rnd(4, 8), life: U.rnd(0.7, 1.2), drag: 0.8 }); }
    } else if (m.type === 'moldadora') {
      const n = Math.floor(m.prog + 0.4);   // 1 carimbada por onigiri, em 60%
      if (n > m.hitN) { m.hitN = n; m.sq = 0.8; ps.puff(A.bodyX(m, b.cx), b.by - 28, 5, 6, { c: C.rice }); sfx('fab-ploc', { pitch: U.rnd(0.94, 1.08), vol: 0.6 }); }
    } else if (m.type === 'pilao') {
      const n = Math.floor(m.prog * 4 + 0.4);     // 4 marteladas por mochi (o kine encosta em 80% de cada ciclo)
      if (n > m.hitN) {
        m.hitN = n; m.sq = 1;
        const p = A.pilaoRim(m, b.cx, b.by);
        ps.burst(p.x, p.y - 2, 9, { c: [C.rice, C.cream, '#FFFFFF'], shape: 'dot', speed: [40, 120], life: 0.55, up: 80, w: 2.5 });
        ps.puff(p.x, p.y, 4, 7, { c: C.rice });
        sfx('fab-pon', { vol: 0.6, pitch: U.rnd(0.92, 1.08) });
        if (n % 2 === 0 || Math.random() < 0.2) fl.add(p.x + U.rnd(-10, 10), p.y - 30, 'PON!', { size: 18, c: C.cream, life: 0.55, pop: 1.5, vy: -30, rot: U.rnd(-0.2, 0.2) });
        if (Math.random() < 0.3) sfx('yip', { vol: 0.3, pitch: U.rnd(1.05, 1.3) });   // "yoisho!" de shiba
      }
    }
  }
  function madeFx(m, R) {
    if (S.fast) return;
    if (m.type === 'moldadora') m.pop = 1;
    else if (m.type === 'pilao') { const r = mrect(m.type, m.x, m.y, m.rot), b = mbase(m, r), p = A.pilaoRim(m, b.cx, b.by); ps.sparkle(p.x, p.y - 6, m.rec === 1 ? 8 : 4, { c: m.rec === 1 ? [C.gold, C.goldL] : [C.cream, '#FFFFFF'], r: 16 }); sfx('hanko', { vol: 0.4, pitch: 0.8 }); }
  }

  /* ======================================================================
     Som (Sfx da engine, com mudo e trava pra não virar barulheira)
     ====================================================================== */
  if (E.Sfx && E.Sfx.define) {
    // "ploc" da moldadora: batida oca de madeira + estalinho
    E.Sfx.define('fab-ploc', { gate: 0.07, max: 3, peak: 0.42, jit: 0.8, render: Dk => { const b = Dk.buf(0.16); Dk.osc(b, { f: 520, f1: 190, d: 0.07, vol: 0.7 }); Dk.noise(b, { d: 0.02, vol: 0.35, bp: 2400, q: 1.5 }); Dk.modal(b, 330, [1, 2.4], [0.5, 0.2], [0.09, 0.05], { at: 0.004 }); return b; } });
    // "PON!" do pilão: pancada grave de madeira na massa (o latidinho 'yip' entra por fora, de vez em quando)
    E.Sfx.define('fab-pon', { gate: 0.1, max: 3, peak: 0.5, jit: 0.6, render: Dk => { const b = Dk.buf(0.34); Dk.osc(b, { f: 150, f1: 62, d: 0.2, vol: 0.9 }); Dk.noise(b, { color: 'brown', d: 0.04, vol: 0.5, lp: 1400 }); Dk.noise(b, { d: 0.05, vol: 0.22, bp: 900, q: 0.8, at: 0.005 }); Dk.modal(b, 210, [1, 1.9, 3.1], [0.4, 0.2, 0.1], [0.16, 0.1, 0.05]); return b; } });
    // caixa registradora da doca: "ka" + sininho (quem chama passa pitch mais alto pra produto mais caro)
    E.Sfx.define('fab-caixa', { gate: 0.12, max: 3, peak: 0.36, jit: 0.2, rev: 0.15, render: Dk => { const b = Dk.buf(0.55); Dk.noise(b, { d: 0.02, vol: 0.4, bp: 2600, q: 1.4 }); Dk.osc(b, { f: 240, f1: 150, d: 0.04, vol: 0.3 }); Dk.modal(b, 1760, [1, 2.01, 3.3], [0.5, 0.22, 0.08], [0.42, 0.3, 0.12], { at: 0.05 }); Dk.modal(b, 2637, [1, 2.0], [0.32, 0.12], [0.36, 0.2], { at: 0.12 }); return b; } });
    // "pop" de pôr máquina no chão
    E.Sfx.define('fab-pop', { gate: 0.08, max: 2, peak: 0.42, jit: 0.5, render: Dk => { const b = Dk.buf(0.22); Dk.osc(b, { f: 240, f1: 620, d: 0.06, vol: 0.7 }); Dk.osc(b, { f: 90, f1: 55, d: 0.12, vol: 0.6, at: 0.03 }); Dk.noise(b, { d: 0.05, vol: 0.2, lp: 900, at: 0.03 }); return b; } });
    // jingle de subir de nível (máquina e doca)
    E.Sfx.define('fab-jingle', a => { const n = [5, 7, 9, 12]; for (let i = 0; i < n.length; i++) a.note(a.deg(n[i]), { inst: 'marimba', vel: 0.5 + i * 0.07, delay: i * 0.07 }); a.note(a.deg(14), { inst: 'marimba', vel: 0.65, delay: 0.32 }); a.drum('ten', { vel: 0.4, delay: 0.32 }); });
  }
  if (E.Loops && E.Loops.define) {
    // borbulho da panela (loop de 4 s: fervura grave + bolhas subindo de tom)
    E.Loops.define('fab-borbulho', { vol: 0.8, rate: [0.9, 1.15], lp: [1800, 4200], gain: [0.5, 1], render: Dk => {
      const n = Math.floor(4 * Dk.sr), out = E.Loops.bed(Dk, n, { color: 'brown', vol: 0.16, lp: 700 }), blip = Dk.buf(0.09);
      for (let i = 0; i < 46; i++) { blip.fill(0); const f = Dk.rr(140, 420); Dk.osc(blip, { f, f1: f * Dk.rr(1.5, 2.3), a: 0.006, d: Dk.rr(0.03, 0.07), vol: Dk.rr(0.12, 0.35) }); Dk.wrap(out, blip, Dk.rr(0, 4), 1); }
      return out;
    } });
  }
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
    return { ms: machines.map(m => ({ id: m.id, type: m.type, x: m.x, y: m.y, rot: m.rot, lvl: m.lvl, rec: m.rec, paid: m.paid, spent: m.spent, star: m.star | 0 })), bs, dock: S.dockLvl, sb: Object.assign({}, S.starBank) };
  }
  function restore(sn) {
    const old = grid, oldM = machines.slice();
    newGrid(); machines = [];
    const keep = new Map(oldM.map(m => [m.id, m]));
    for (const s of sn.ms) {
      let m = keep.get(s.id);
      if (m) { keep.delete(s.id); Object.assign(m, { x: s.x, y: s.y, rot: s.rot, lvl: s.lvl, rec: s.rec, paid: s.paid, spent: s.spent, star: s.star | 0 }); machines.push(m); for (const [a, b] of mcells(m.type, m.x, m.y, m.rot)) grid[b][a] = { k: 'm', m }; }
      else makeMachine(s.type, s.x, s.y, s.rot, s);
    }
    for (const m of keep.values()) dumpMachine(m);
    for (const [x, y, dir] of sn.bs) {
      const o = old[y][x];
      grid[y][x] = { k: 'b', dir, items: o && o.k === 'b' ? o.items : [], jam: 0 };
    }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const o = old[y][x];
      if (o && o.k === 'b' && !(grid[y][x] && grid[y][x].k === 'b')) for (const it of o.items) sellLoose(it, cellX(x), cellY(y) - 8);
    }
    S.dockLvl = sn.dock; S.starBank = Object.assign({}, sn.sb || {});
    if (S.sel && typeof S.sel === 'object' && machines.indexOf(S.sel) < 0) S.sel = null;
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
    const m = makeMachine(type, at[0], at[1], rot, { paid: price, star: S.starBank[type] | 0 });
    if (m.star) { S.starBank[type] = 0; toast('o selo guardado voltou: ★' + m.star); }
    commit(a);
    m.sq = 1;
    if (!S.fast) { const c = mcenter(m); ps.puff(c.x - 20, c.y + 18, 6, 9, { c: C.sand }); ps.puff(c.x + 20, c.y + 18, 6, 9, { c: C.sand }); sfx('fab-pop', { vol: 0.7 }); if (price) sfx('buy', { vol: 0.4 }); }
    return m;
  }
  function eraseAt(x, y, a) {
    const c = cellAt(x, y); if (!c) return false;
    if (c.k === 'b') { clearBelt(x, y); sfx('click'); return true; }
    const ref = removeMachine(c.m); GS().money += ref; a.cost -= ref;
    if (!S.fast) { ps.puff(cellX(x), cellY(y) + 12, 8, 8, { c: C.sand }); if (ref > 0) fl.add(cellX(x), cellY(y) - 18, 'devolveu ¥' + U.fmt(ref), { size: 17, c: C.goldL }); sfx('pop', { vol: 0.4 }); }
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
    if (m.lvl >= MAX_LVL) return selo(m);
    const p = levelPrice(m);
    if (money() < p) { toast('Falta ¥' + U.fmt(p - money())); sfx('error'); return; }
    const a = beginAction(); spend(p); a.cost = p; m.spent += p; m.lvl++; commit(a);
    m.sq = 1; sfx('fab-jingle', { vol: 0.8 }); const c = mcenter(m), tierUp = m.lvl === 3 || m.lvl === 6 || m.lvl === 10;
    if (!S.fast) {
      ps.burst(c.x, c.y - 20, tierUp ? 30 : 16, { c: [C.gold, C.goldL, C.cream], shape: 'star', speed: [80, tierUp ? 280 : 200], life: 0.8 }); ps.sparkle(c.x, c.y - 24, 8, { c: [C.goldL, '#FFFFFF'], r: 34 });
      fl.add(c.x, c.y - 50, 'Nv. ' + m.lvl + '!', { size: tierUp ? 22 : 18, c: C.goldL, pop: 1.4 });
      if (tierUp) { fl.add(c.x, c.y - 78, 'visual novo!', { size: 17, c: C.cream, delay: 0.25 }); sfx('fanfare', { vol: 0.5 }); }
    }
  }
  // "Tirar o Selo": nível máximo → Nv. 1 com +1 estrela (sem teto)
  function selo(m) {
    if (!m || m.type === 'divisor' || m.lvl < MAX_LVL) return false;
    const a = beginAction(); m.lvl = 1; m.star = (m.star | 0) + 1; commit(a);
    m.sq = 1; S.selos = (S.selos | 0) + 1;
    if (!S.fast) {
      const c = mcenter(m), big = m.star === 5 || m.star === 10 || m.star === 25;
      sfx('fanfare', { vol: 0.7 }); sfx('chirin');
      ps.burst(c.x, c.y - 24, big ? 60 : 36, { c: [C.gold, C.goldL, C.cream, C.sakura], shape: 'star', speed: [100, big ? 380 : 280], life: 1.1 });
      fl.add(c.x, c.y - 56, 'Selo ★' + m.star + '!', { size: 24, c: C.goldL, pop: 1.6 });
      fl.add(c.x, c.y - 84, big ? 'placa ' + ['', 'bronze', 'prata', 'ouro', 'arco-íris'][seloTier(m.star)] + '!' : '+50% no valor', { size: 17, c: C.cream, delay: 0.25 });
    }
    return true;
  }
  const seloTier = n => (n >= 25 ? 4 : n >= 10 ? 3 : n >= 5 ? 2 : n >= 1 ? 1 : 0);
  function seloFill(n, x0, x1) {
    const k = seloTier(n); if (k < 4) return ['', '#D9925A', '#DDE6EE', C.goldL][k];
    const gr = g.createLinearGradient(x0, 0, x1, 0); ['#FF8A8A', '#FFD36B', '#9BE38A', '#7FC8FF', '#C9A0F0'].forEach((c, j) => gr.addColorStop(j / 4, c)); return gr;
  }
  // placa do selo: "★N" com a cor do degrau (bronze / prata / ouro / arco-íris)
  function seloPlate(x, y, n, sz) {
    if (!(n > 0)) return 0;
    sz = sz || 17; const s = '★' + n, w = Math.max(26, textW(s, sz) + 12), h = sz + 5;
    g.fillStyle = INK; D.rrect(g, x - 2, y - 2, w + 4, h + 4, 7); g.fill();
    g.fillStyle = seloFill(n, x, x + w); D.rrect(g, x, y, w, h, 5); g.fill();
    if (n >= 10) { g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x + 3, y + 2, w - 6, 2); }
    txt(s, x + w / 2, y + h / 2 + 0.5, T(sz, INK));
    return w + 4;
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
    sfx('fab-jingle', { vol: 0.8 });
    if (!S.fast) { ps.burst(GEO.feedX, 180, 22, { c: [C.gold, C.goldL, C.cream], shape: 'star', speed: [60, 220], life: 0.8 }); fl.add(GEO.feedX, 150, 'Doca Nv. ' + S.dockLvl + '!', { size: 18, c: C.goldL, pop: 1.4 }); }
  }

  /* ======================================================================
     TELA (arte em fabrica-arte.js: G.FabArt). Daqui pra baixo é só apresentação: nada muda regra nem save.
     ====================================================================== */
  const blit = (cv, x, y, s, o) => A.blit(g, cv, x, y, s, o);
  const ICON = A.item, SPR = A.spr;
  const txt = (s, x, y, o) => D.text(g, s, x, y, o);
  const T = (size, col, align, extra) => Object.assign({ size, col: col || INK, sw: 0, align: align || 'center', weight: 900 }, extra || {});
  const fmt1 = v => (Math.round(v * 10) / 10).toLocaleString('pt-BR');
  const fmtK = n => (n < 10000 ? String(Math.floor(n)) : n < 1e6 ? fmt1(n / 1000) + 'k' : fmt1(n / 1e6) + 'M');   // contador curtinho do HUD
  const BAY_IN = { x: 4, y: 40, w: 150, h: 430 }, BAY_OUT = { x: 806, y: 40, w: 150, h: 430 }, YEN = { x: 148, y: 25 };
  const PHRASE = { cozido: 'fofinho, ainda soltando vapor', onigiri: 'o triângulo que move o Japão', mochi: "batido no pilão com um 'yoisho!'", mochid: 'dizem que dá MUITA sorte' };
  // REGRA DE TEXTO: o palco de 960×540 encolhe pra ~0,72 no celular de 844×390, então nada de texto abaixo de 17 px aqui (= 12 px no aparelho)
  const TXT = 17;
  const textW = (s, size) => { D.text(g, '', 0, 0, { size: size || TXT }); return g.measureText(s).width; };

  /* ---- overlay da fábrica: stage próprio (960×540) por cima do jogo ---- */
  const root = document.createElement('div'); root.className = 'k-fab';
  document.body.appendChild(root);
  const css = document.createElement('style');
  css.textContent = '.k-fab{position:fixed;inset:0;z-index:55;background:#2a1a10;display:none}.k-fab.k-fab-open{display:block}';
  document.head.appendChild(css);
  const stage = E.Stage({ parent: root, width: W, height: H, bg: '#2a1a10' });
  const g = stage.g;
  const input = E.Input(stage);
  let toastMsg = null;

  /* ======================================================================
     Esteiras: lista de células pra arte (refeita só quando o layout muda)
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
  function canFeedRow(r) { const c = cellAt(0, r); if (!c) return false; if (c.k === 'b') return c.dir !== 2; if (c.m.type === 'divisor') return c.m.rot === 0; const o = outTarget(c.m); return !(o[0] === -1 && o[1] === r); }
  function rowSells(r) { const c = cellAt(GW - 1, r); if (!c) return false; if (c.k === 'b') return c.dir === 0; return outsOf(c.m).some(o => o[0] === GW && o[1] === r); }
  let bview = [], bcell = [], bsig = '', feedV = [], collV = [];
  function layoutSig() {
    let s = '';
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const c = grid[y][x]; s += !c ? '.' : c.k === 'b' ? c.dir : c.m.type === 'divisor' ? 'd' + c.m.rot : 'm' + c.m.rot; }
    return s;
  }
  function rebuildBelts() {
    bview = []; bcell = []; feedV = []; collV = [];
    for (let y = 0; y < GH; y++) {
      bcell.push(new Array(GW).fill(null));
      for (let x = 0; x < GW; x++) {
        const c = grid[y][x]; if (!c) continue;
        let v = null;
        if (c.k === 'b') v = A.beltPrep({ cx: cellX(x), cy: cellY(y), ins: beltSides(c, x, y), outs: [c.dir], speed: BELT_SPEED, cell: c });
        else if (c.m.type === 'divisor') v = A.beltPrep({ cx: cellX(x), cy: cellY(y), ins: [(c.m.rot + 2) % 4], outs: sideDirs(c.m), speed: BELT_SPEED, cell: null });
        if (v) { bview.push(v); bcell[y][x] = v; }
      }
    }
    for (let r = -1; r < GH; r++) {       // esteiras fixas das docas: a de entrada desce da porta, a de venda sobe até ela
      const f = A.beltPrep({ cx: GEO.feedX, cy: cellY(r), ins: [3], outs: (r < GH - 1 ? [1] : []).concat(r >= 0 && canFeedRow(r) ? [0] : []), speed: BELT_SPEED });
      const k = A.beltPrep({ cx: GEO.collX, cy: cellY(r), ins: (r < GH - 1 ? [1] : []).concat(r >= 0 && rowSells(r) ? [2] : []), outs: [3], speed: BELT_SPEED });
      f.curve = k.curve = null; feedV.push(f); collV.push(k); bview.push(f, k);
    }
  }
  const IP = { x: 0, y: 0 };
  function drawBeltItems(t) {
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const c = grid[y][x]; if (!c || c.k !== 'b' || !c.items.length) continue;
      const v = bcell[y] && bcell[y][x]; if (!v) continue;
      const jam = c.jam > 0.4;
      for (let i = c.items.length - 1; i >= 0; i--) {
        const it = c.items[i];
        A.itemAt(v, it.from === undefined ? (c.dir + 2) % 4 : it.from, it.p, c.dir, IP);
        if (jam) A.drawItem(g, it.t, IP.x + ((i * 37) % 7) - 3, IP.y - (i % 2) * 6, t, i + x * 3 + y * 5, Math.min(3, c.jam) + (i % 2) * 2);
        else A.drawItem(g, it.t, IP.x, IP.y, t, i + x * 3 + y * 5);
      }
      if (c.jam > 2.2) { const n = cellAt(x + DX[c.dir], y + DY[c.dir]), end = x + DX[c.dir] >= GW ? false : !n; if (end) bubble(v.cx + 18, v.cy - 26, '!', C.ora, t); }   // só o beco sem saída avisa (máquina cheia tem o balão dela)
    }
  }

  /* ======================================================================
     Docas vivas: sacos entrando, itens subindo pro caminhão, kei-truck, moedas
     ====================================================================== */
  const dockRowAnim = new Array(GH).fill(0);
  const ship = [];                                       // itens vendidos subindo a esteira da venda (só enfeite)
  const truck = { st: 'in', dx: 0, n: 0, t: 0, bump: 0, pile: 0, pt: 0, trips: 0 };
  const coins = []; for (let i = 0; i < 14; i++) coins.push({ on: false, x: 0, y: 0, t: 0, d: 0 });
  let yenBump = 0, saleFlash = 0;
  function coinFly(x, y, n) {
    for (const c of coins) { if (n <= 0) break; if (c.on) continue; c.on = true; c.x = x + U.rnd(-8, 8); c.y = y + U.rnd(-6, 6); c.t = -n * 0.07; c.d = U.rnd(0.5, 0.7); n--; }
  }
  function baysTick(dt) {
    for (let r = 0; r < GH; r++) dockRowAnim[r] = Math.max(0, dockRowAnim[r] - dt * 3.2);
    saleFlash = Math.max(0, saleFlash - dt * 2.5); yenBump = Math.max(0, yenBump - dt * 4); truck.bump = Math.max(0, truck.bump - dt * 6);
    const topY = GEO.WALL + 14, sp = BELT_SPEED * CH;
    for (let i = ship.length - 1; i >= 0; i--) {
      const s = ship[i];
      if (s.st === 0) { s.x = Math.min(GEO.collX, s.x + 220 * dt); if (s.x >= GEO.collX) { s.y -= sp * dt; if (s.y <= topY) { s.st = 1; s.u = 0; } } }
      else { s.u += dt / 0.38; if (s.u >= 1) { ship.splice(i, 1); if (truck.st === 'in' && truck.n < 9) { truck.n++; truck.bump = 1; } else truck.pile = Math.min(12, truck.pile + 1); } }
    }
    truck.t += dt;
    if (truck.st === 'in') {
      truck.dx = 0;
      if (truck.pile > 0 && truck.n < 9 && (truck.pt -= dt) <= 0) { truck.pile--; truck.n++; truck.bump = 1; truck.pt = 0.07; }
      if (truck.n >= 9 && truck.t > 0.5) { truck.st = 'out'; truck.t = 0; sfx('horn', { vol: 0.25, pitch: 1.5 }); }
    } else if (truck.st === 'out') {
      truck.dx = U.ease.in(Math.min(1, truck.t / 0.9)) * 200;
      if (truck.t >= 0.9) { truck.st = 'away'; truck.t = 0; truck.n = 0; truck.trips++; fl.add(GEO.doorOut.x + 70, GEO.doorOut.y + 64, 'carga entregue!', { size: 17, c: C.goldL, life: 1.3 }); }
    } else if (truck.st === 'away') { truck.dx = 200; if (truck.t >= 0.9) { truck.st = 'back'; truck.t = 0; } }
    else { truck.dx = (1 - U.ease.out(Math.min(1, truck.t / 0.8))) * 200; if (truck.t >= 0.8) { truck.st = 'in'; truck.t = 0; truck.dx = 0; } }
    for (const c of coins) { if (!c.on) continue; c.t += dt; if (c.t >= c.d) { c.on = false; yenBump = 1; } }
  }
  function drawBays(t) {
    // ENTRADA: palete de sacos (cresce com o nível da doca) e o shiba que joga os sacos na esteira
    const lv = S.dockLvl, piles = Math.min(3, 1 + Math.floor(lv / 3));
    for (let p = 0; p < piles; p++) {
      const px = 50, py = 210 + p * 78;
      A.shadow(g, px, py + 2, 44, 8); blit(SPR.pallet, px, py + 4);
      const n = Math.min(7, 3 + Math.floor((lv + p) / 2));
      for (let i = 0; i < n; i++) { const row = i < 3 ? 0 : i < 5 ? 1 : 2, k = i < 3 ? i : i < 5 ? i - 3 : 0, w = row === 0 ? 3 : row === 1 ? 2 : 1; blit(ICON.sack, px + (k - (w - 1) / 2) * 26, py - 4 - row * 20); }
    }
    const dig = S.digRate > 0, ph = (t * 1.6) % 1;
    A.worker(g, 84, 160, dig ? (ph < 0.5 ? 'carry' : 'push') : 'sit', t, { pal: 'cha', face: 1, hat: 'palha' });
    if (dig && ph < 0.5) blit(ICON.raw, 94, 140 - Math.sin(ph * 2 * Math.PI) * 4);
    // cortina de tiras onde a esteira entra/sai pela porta
    for (const bx of [GEO.feedX, GEO.collX]) { g.fillStyle = INK; g.fillRect(bx - 24, GEO.WALL - 8, 48, 12); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#5A524A' : '#6E665E'; g.fillRect(bx - 22 + i * 7.4, GEO.WALL - 6, 6.4, 8 + Math.sin(t * 5 + i * 1.3 + bx) * (S.digRate > 0 || bx > 400 ? 1.5 : 0)); } }
    // sacos descendo a esteira da entrada (mais sacos = doca mais usada) e o que entra em cada linha
    const use = U.clamp(S.dockUse / Math.max(0.01, dockCap()), 0, 1), cnt = dig ? Math.max(1, Math.round(1 + use * 5)) : 0, L = cellY(GH - 1) - GEO.WALL - 16;
    for (let i = 0; i < cnt; i++) { const y = GEO.WALL + 16 + ((t * BELT_SPEED * CH * 0.6 + i * L / cnt) % L); A.drawItem(g, i % 4 === 3 && S.goldMix > 0.02 ? 'gold' : 'raw', GEO.feedX, y, t, i); }
    for (let r = 0; r < GH; r++) if (dockRowAnim[r] > 0) { const a = 1 - dockRowAnim[r]; A.drawItem(g, 'raw', GEO.feedX + a * (GX - GEO.feedX + 6), cellY(r), t, r, 0); }
    // plaquinha de nível da doca
    A.levelBadge(g, GEO.feedX - 34, 144, lv);

    // VENDA: itens subindo, mesa de embalar, pilha esperando o caminhão
    for (let i = 0; i < ship.length; i++) {
      const s = ship[i];
      if (s.st === 0) A.drawItem(g, s.t, s.x, s.y, t, i);
      else { const u = s.u, tx = truck.st === 'in' ? GEO.doorOut.x + 46 : 908, ty = truck.st === 'in' ? 92 : 226, x = U.lerp(GEO.collX, tx, u), y = U.lerp(GEO.WALL + 14, ty, u) - Math.sin(u * Math.PI) * 26; blit(ICON.box, x, y + 8, 2, { rot: u * 3 }); }
    }
    A.shadow(g, 908, 250, 46, 8); blit(SPR.pallet, 908, 252);
    for (let i = 0; i < truck.pile; i++) blit(ICON.box, 884 + (i % 3) * 24, 242 - Math.floor(i / 3) * 18);
    const busy = ship.length > 0 || truck.pile > 0;
    A.worker(g, 878, 166, saleFlash > 0.3 ? 'cheer' : busy ? 'carry' : (truck.st === 'in' ? 'wag' : 'sit'), t + 3, { pal: 'kin', face: truck.st === 'in' ? -1 : 1, hat: 'bone' });
    A.shadow(g, 918, 320, 44, 7); blit(SPR.table, 918, 320); blit(SPR.scale, 906, 288); blit(ICON.box, 932, 290);
    blit(SPR.crate, 842, 526); blit(SPR.crate, 806, 532); blit(ICON.box, 824, 494); blit(SPR.plant, 772, 534);
  }

  /* ======================================================================
     Máquinas
     ====================================================================== */
  const mbase = (m, r) => (m.type === 'pilao' && m.rot % 2 === 1 ? { cx: r.x + r.w / 2, by: r.y + CH + 26 } : m.type === 'divisor' ? { cx: r.x + r.w / 2, by: r.y + r.h / 2 } : { cx: r.x + r.w / 2, by: r.y + r.h - 16 });
  const MO = { ghost: false, vert: false, rot: 0, dx: 0, dy: 0, vx: 0, vy: 0, item: null };
  /* Máquina alta × esteira da linha de trás. A máquina fica SEMPRE sólida enquanto a fábrica trabalha: o item que passa
     escondido atrás dela aparece num balãozinho em cima da tampa (hiddenItems), andando junto com ele. Só quando o jogador
     está MONTANDO (ferramenta na mão ou arrastando esteira) a parte que invade a casa de cima fica ~45% transparente, pra
     enxergar a esteira de trás. A máquina é desenhada numa camada à parte só nesse caso. */
  let fadeCv = null, fadeG = null;
  function behindOf(m) {                                     // 0 nada · 1 tem esteira atrás · 2 tem item passando atrás
    if (m.type === 'divisor' || (m.type === 'pilao' && m.rot % 2 === 1) || m.y + Math.min(0, DY[m.rot]) <= 0) return 0;
    let res = 0;
    for (const [a, b] of mcells(m.type, m.x, m.y, m.rot)) {
      const c = cellAt(a, b - 1); if (!c) continue;
      if (c.k === 'b') res = Math.max(res, c.items.length ? 2 : 1);
      else if (c.m !== m && c.m.type === 'divisor') res = Math.max(res, c.m.out.length ? 2 : 1);
    }
    return res;
  }
  function fadeTick(dt) {
    const building = !!(S.tool || (drag && drag.mode !== 'move'));
    for (const m of machines) { const b = behindOf(m), want = b >= 1 && building ? 1 : 0; m.fade = (m.fade || 0) + (want - (m.fade || 0)) * Math.min(1, dt * (want ? 10 : 4)); }
  }
  // balãozinho do item escondido: bolinha creme com o item pequeno, em cima da máquina, no x de onde ele está passando
  const HIP = { x: 0, y: 0 };
  function hiddenItems(m, t, cx, by) {
    if (m.type === 'divisor' || (m.fade || 0) > 0.5 || behindOf(m) < 2) return;
    const mxb = A.bodyX(m, cx), half = m.type === 'pilao' ? 62 : 30, topY = (m.type === 'moldadora' ? by - 104 : m.type === 'pilao' ? by - 76 : by - 86) - [0, 2, 8, 12][A.tierOf(m.lvl)];
    for (const [a, b] of mcells(m.type, m.x, m.y, m.rot)) {
      const c = cellAt(a, b - 1); if (!c || c.k !== 'b' || !c.items.length) continue;
      const v = bcell[b - 1] && bcell[b - 1][a]; if (!v) continue;
      for (let i = 0; i < c.items.length; i++) {
        const it = c.items[i]; A.itemAt(v, it.from === undefined ? (c.dir + 2) % 4 : it.from, it.p, c.dir, HIP);
        const d = Math.abs(HIP.x - mxb); if (d > half) continue;
        const al = U.clamp((half - d) / 10, 0, 1) * 0.95, x = Math.round(HIP.x), y = Math.round(topY + Math.sin(t * 5 + i + a) * 1.5), ic = A.item[it.t];
        g.globalAlpha = al;
        g.fillStyle = INK; g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x - 4, y + 9); g.lineTo(x, y + 16); g.lineTo(x + 4, y + 9); g.fill();
        g.fillStyle = '#FFF6DE'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
        if (ic) { g.imageSmoothingEnabled = false; g.drawImage(ic, Math.round(x - ic.width / 2), Math.round(y - ic.height / 2)); }
        g.globalAlpha = 1;
      }
    }
  }
  // selo verde "dá pra subir": só no upgrade MAIS BARATO que o dinheiro paga (máquina ou doca); com um cartão de máquina aberto, em todos
  let upPick = null, upAll = false;
  function pickUp() {
    upPick = null; upAll = false;
    if (S.tut >= 0 || S.tool) return;
    upAll = !!(S.sel && typeof S.sel === 'object');
    const mny = money(); let best = Infinity;
    for (const m of machines) { if (m.type === 'divisor' || m.lvl >= MAX_LVL) continue; const p = levelPrice(m); if (p <= mny && p < best) { best = p; upPick = m; } }
    if (!dockMax()) { const p = dockPrice(); if (p <= mny && p < best) upPick = 'dock'; }
  }
  const upBob = (t, k) => Math.sin(t * 2.2 + k) * 2;
  function drawMachine(m, t, ghost) {
    const r = mrect(m.type, m.x, m.y, m.rot), b = mbase(m, r), cx = b.cx, by = b.by;
    MO.ghost = !!ghost; MO.vert = m.rot % 2 === 1; MO.rot = m.rot; MO.dx = DX[m.rot]; MO.dy = DY[m.rot];
    const fade = ghost ? 0 : (m.fade || 0), dpr = stage.dpr;
    let q = g, px = 0, py = 0, fw = 0, fh = 0;
    if (fade > 0.02) {
      fw = Math.ceil((r.w + 100) * dpr); fh = Math.ceil((r.h + 130) * dpr);
      if (!fadeCv) { fadeCv = document.createElement('canvas'); fadeG = fadeCv.getContext('2d'); }
      if (fadeCv.width < fw || fadeCv.height < fh) { fadeCv.width = Math.max(fadeCv.width, fw); fadeCv.height = Math.max(fadeCv.height, fh); }
      px = Math.round((r.x - 50) * dpr); py = Math.round((r.y - 100) * dpr);
      q = fadeG; q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, fw, fh);
      q.setTransform(dpr, 0, 0, dpr, -px, -py);
    }
    q.save();
    if (ghost) q.globalAlpha = ghost;
    const pop = m.sq || 0;                                   // pulinho ao pôr / subir de nível
    if (pop > 0 && !ghost) { q.translate(cx, by); q.scale(1 + pop * 0.06, 1 - pop * 0.06); q.translate(-cx, -by); }
    if (m.type === 'panela') A.panela(q, m, cx, by, t, MO);
    else if (m.type === 'moldadora') A.moldadora(q, m, cx, by, t, MO);
    else if (m.type === 'pilao') A.pilao(q, m, cx, by, t, MO);
    else {
      const ds = sideDirs(m), k = m.flip === undefined ? m.side : m.flip;   // m.flip segue m.side com molinha
      MO.vx = U.lerp(DX[ds[0]], DX[ds[1]], k) + DX[m.rot] * 0.55 * (1 - Math.abs(k * 2 - 1)); MO.vy = U.lerp(DY[ds[0]], DY[ds[1]], k) + DY[m.rot] * 0.55 * (1 - Math.abs(k * 2 - 1));
      MO.item = m.out.length ? m.out[0].t : null;
      A.divisor(q, m, cx, by, t, MO);
    }
    q.restore();
    if (q !== g) {                                           // apaga em degradê o que passa da borda de cima da casa e cola no palco, pixel com pixel
      const gr = q.createLinearGradient(0, r.y - 14, 0, r.y + 2);
      gr.addColorStop(0, 'rgba(0,0,0,' + (0.55 * fade).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      q.globalCompositeOperation = 'destination-out'; q.fillStyle = gr; q.fillRect(r.x - 50, r.y - 100, r.w + 100, 102); q.globalCompositeOperation = 'source-over';
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(fadeCv, 0, 0, fw, fh, px, py, fw, fh); g.restore();
    }
    if (ghost) return;
    if (m.type === 'divisor') return;
    // balõezinhos de estado
    const mxb = A.bodyX(m, cx), topY = (m.type === 'moldadora' ? by - 92 : m.type === 'pilao' ? by - 84 : by - 80), hot = m.blocked || (m.full > 0 && m.busy > 0.8), sgn = A.mirrored(m.type, m.rot) ? -1 : 1;
    if (m.blocked) bubble(cx - 22 * sgn, topY, '!', C.red, t);
    else if (hot) bubble(cx - 22 * sgn, topY, '!', C.ora, t);
    else if (!m.work && m.idle > 6 && !m.out.length) { const u = (t * 0.6 + m.id * 0.3) % 1, zx = m.type === 'pilao' ? 34 : A.mirrored(m.type, m.rot) ? -30 : 34; txt('z', cx + zx + u * 8, by - 40 - u * 16, { size: TXT + u * 4, col: C.cream, sw: 3, alpha: 1 - u }); }
    if (!hot && S.sel !== m && m.lvl < MAX_LVL && (upPick === m || (upAll && money() >= levelPrice(m)))) blit(SPR.up, mxb - 4 * sgn, topY + 8 + upBob(t, m.id), 2);
  }
  /* etiqueta de cada máquina (plaquinha de nível + barrinha "ocupada %"): desenhada DEPOIS de todas as máquinas, na cabeça dela
     (A.tagPos), do lado do operador. A fileira da frente não cobre mais, e ela não entra na casa de baixo. */
  function drawMachineTag(m, t) {
    if (m.type === 'divisor') return;
    const r = mrect(m.type, m.x, m.y, m.rot), b = mbase(m, r), p = A.tagPos(m, b.cx, b.by), bw = 26, x = Math.round(p.x), y = Math.round(p.y);
    g.fillStyle = INK; D.rrect(g, x - bw / 2 - 2, y + 10, bw + 4, 8, 3); g.fill();
    g.fillStyle = '#5a4030'; g.fillRect(x - bw / 2, y + 12, bw, 4);
    g.fillStyle = m.busy > 0.85 ? C.ora : m.busy > 0.4 ? C.gold : C.grassL; g.fillRect(x - bw / 2, y + 12, bw * U.clamp(m.busy, 0, 1), 4);
    A.levelBadge(g, x, y, m.lvl);
    if (m.star) seloPlate(x + (m.lvl >= 2 ? 16 : -12), y - 11, m.star, 14);
    hiddenItems(m, t, b.cx, b.by);
  }
  function bubble(x, y, s, col, t) {
    const b = Math.sin(t * 6) * 2;
    g.fillStyle = INK; g.beginPath(); g.arc(x, y + b, 12.5, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x - 5, y + b + 9); g.lineTo(x - 9, y + b + 19); g.lineTo(x + 2, y + b + 11); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x, y + b, 10.5, 0, TAU); g.fill();
    txt(s, x, y + b + 1, { size: 18, col: C.cream, sw: 0, weight: 900 });
  }
  function arrow(x, y, d, col, k) {
    g.save(); g.translate(x, y); g.scale(1, CH / CW * 1.15); g.rotate(ang(d)); g.scale(k || 1, k || 1);
    g.fillStyle = INK; g.beginPath(); g.moveTo(-7, -10); g.lineTo(6, 0); g.lineTo(-7, 10); g.closePath(); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(-5, -6.5); g.lineTo(2.5, 0); g.lineTo(-5, 6.5); g.closePath(); g.fill();
    g.restore();
  }
  // setas no chão: saída sem esteira pisca (falta ligar); selecionada mostra todas as bocas
  function drawPorts(m, t, all) {
    const outs = outsOf(m);
    for (const o of outs) {
      const tc = o[0] >= GW ? 1 : cellAt(o[0], o[1]), linked = !!tc;
      if (linked && !all) continue;
      const f = m.type === 'divisor' ? [m.x, m.y] : front(m), dx = Math.sign(o[0] - f[0]), dy = Math.sign(o[1] - f[1]), d = dx > 0 ? 0 : dx < 0 ? 2 : dy > 0 ? 1 : 3;
      arrow(cellX(f[0]) + dx * (CW / 2 + 4), cellY(f[1]) + dy * (CH / 2 + 3), d, C.gold, linked ? 1 : 1 + 0.18 * Math.sin(t * 7));
    }
    if (!all) return;
    const ins = m.type === 'divisor' ? [(m.rot + 2) % 4] : [(m.rot + 2) % 4, (m.rot + 1) % 4, (m.rot + 3) % 4];
    const back = [m.x, m.y];
    for (let i = 0; i < ins.length; i++) { if (i > 0 && m.type === 'pilao') continue; const s = ins[i]; arrow(cellX(back[0]) + DX[s] * (CW / 2 + 4), cellY(back[1]) + DY[s] * (CH / 2 + 3), (s + 2) % 4, C.cream, 0.85); }
  }
  function selRing(m, t) {
    const r = mrect(m.type, m.x, m.y, m.rot);
    g.strokeStyle = INK; g.lineWidth = 5; g.setLineDash([10, 7]); g.lineDashOffset = -t * 24; D.rrect(g, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 10); g.stroke();
    g.strokeStyle = C.goldL; g.lineWidth = 2.5; D.rrect(g, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 10); g.stroke(); g.setLineDash([]);
  }

  /* ======================================================================
     HUD em canvas (botões imediatos, jeito de jogo: pílulas creme com contorno e sombra)
     ====================================================================== */
  let btns = [];
  function hit(x, y, w, h, fn, o) { btns.push({ x, y, w, h, fn, o }); }
  function pill(x, y, w, h, fill, r) {
    r = r === undefined ? 10 : r;
    g.fillStyle = 'rgba(40,22,8,.30)'; D.rrect(g, x - 2, y + 2, w + 4, h + 6, r + 2); g.fill();
    g.fillStyle = INK; D.rrect(g, x - 2.5, y - 2.5, w + 5, h + 7.5, r + 2); g.fill();
    g.fillStyle = fill || C.cream; D.rrect(g, x, y, w, h, r); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; D.rrect(g, x + 4, y + 2.5, w - 8, 3, 1.5); g.fill();
  }
  function button(x, y, w, h, label, fn, o) {
    o = o || {};
    const on = o.on, off = o.off, pressed = pressBtn && pressBtn.x === x && pressBtn.y === y, dy = pressed ? 2 : 0;
    g.fillStyle = 'rgba(40,22,8,.30)'; D.rrect(g, x - 2, y + 2, w + 4, h + 6, 11); g.fill();
    g.fillStyle = INK; D.rrect(g, x - 2.5, y - 2.5, w + 5, h + 7.5, 11); g.fill();
    g.fillStyle = on ? C.gold : off ? '#E0D4BA' : (o.fill || C.cream); D.rrect(g, x, y + dy, w, h, 9); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; D.rrect(g, x + 4, y + 2.5 + dy, w - 8, 3, 1.5); g.fill();
    const cx = x + w / 2;
    if (o.sub) {
      txt(label, cx, y + h / 2 - 10 + dy, T(o.size || TXT, off ? '#8a7a66' : INK));
      txt(o.sub, cx, y + h / 2 + 10 + dy, T(o.subSize || TXT, o.subCol || (off ? '#8a7a66' : '#6B4A2E')));
    } else txt(label, cx, y + h / 2 + 1 + dy, T(o.size || TXT, off ? '#8a7a66' : INK));
    if (o.lock) blit(SPR.lock, x + 14, y + h / 2 + 8 + dy, 2);
    hit(x, y, w, h, fn, { x, y });
  }
  function meter(x, y, w, h, k, col) {
    g.fillStyle = INK; D.rrect(g, x - 1.5, y - 1.5, w + 3, h + 3, h / 2 + 1); g.fill();
    g.fillStyle = '#E6DCC4'; D.rrect(g, x, y, w, h, h / 2); g.fill();
    if (k > 0.02) { g.fillStyle = col; D.rrect(g, x, y, Math.max(h, w * U.clamp(k, 0, 1)), h, h / 2); g.fill(); }
  }
  function check(x, y, col) { g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x - 1, y + 5); g.lineTo(x + 7, y - 5); g.stroke(); g.strokeStyle = col; g.lineWidth = 3; g.stroke(); }

  const chipPop = [0, 0];
  let facShow = 0, facBump = 0, dtUI = 0.016;
  function goalChip(i, x, name, n, need, done, icon) {       // ícone do produto + "3/20" com barrinha (ou "liberado"); o nome aparece no toque
    const p = chipPop[i], y = 6 - Math.sin(Math.min(1, p) * Math.PI) * 4, w = 116;
    pill(x, y, w, 38, done ? '#DDF0C2' : C.cream);
    blit(icon, x + 20, y + 31, 2, done ? null : { alpha: 0.45 });
    if (done) txt('liberado', x + 38, y + 20, T(TXT, C.grassD, 'left'));
    else {
      blit(SPR.lock, x + 28, y + 35, 2);
      txt(need >= 1000 ? Math.floor(Math.min(n, need) / need * 100) + '%' : Math.min(n, need) + '/' + need, x + 76, y + 14, T(TXT, '#6B4A2E'));
      meter(x + 44, y + 26, 64, 6, n / need, C.gold);
    }
    hit(x, y, w, 38, () => { toast(done ? name + ': liberado!' : i === 0 ? 'Pilão: faça ' + UNLOCK.pilao + ' onigiris (' + S.made.onigiri + ' até agora)' : 'Mochi Dourado: ' + UNLOCK.dourado + ' mochis e Arroz Dourado no Armazém'); sfx('click'); });
  }
  function drawTopBar(t) {
    button(8, 6, 112, 38, '← Montanha', close, { fill: '#F6B6B0' });
    // dinheiro (as moedas da venda voam pra cá)
    const bump = Math.sin(Math.min(1, yenBump) * Math.PI) * 0.12;
    pill(128, 6, 136, 38);
    blit(SPR.coin, YEN.x, 36 - bump * 20, 2 + bump * 2);
    txt(U.fmt(Math.floor(money())), YEN.x + 17, 26, T(18, INK, 'left'));
    // a frase da fábrica: "a fábrica rende ¥X/s" (grande, contando pra cima) e quanto isso é a mais no seu ganho
    const rt = rates(), tot = rt.raw + rt.fac, sh = tot > 0 ? rt.fac / tot : 0;
    if (rt.fac > facShow * 1.02 + 0.5 && facShow > 0) facBump = 1;
    facShow += (rt.fac - facShow) * Math.min(1, dtUI * 3); if (Math.abs(rt.fac - facShow) < 0.5) facShow = rt.fac;
    facBump = Math.max(0, facBump - dtUI * 2.5);
    pill(272, 6, 432, 38, facBump > 0 ? '#FFE9A8' : C.cream);
    txt('a fábrica rende', 284, 26, T(TXT, '#6B4A2E', 'left'));
    const fx = 290 + textW('a fábrica rende', TXT), fs = '¥' + U.fmt(facShow) + '/s', fk = 22 + Math.sin(facBump * Math.PI) * 5;
    txt(fs, fx, 26, T(fk, C.goldD, 'left'));
    const fx2 = fx + textW(fs, 22) + 12, extra = rt.raw > 0 ? Math.round(rt.fac / rt.raw * 100) : 0;
    if (extra > 0 && fx2 < 560) { blit(SPR.up, fx2 + 8, 37, 2); txt('+' + (extra > 999 ? U.fmt(extra) : extra) + '% de dinheiro', fx2 + 20, 26, T(TXT, C.grassD, 'left')); }
    hit(272, 6, 432, 38, () => { toast('A fábrica rende ¥' + U.fmt(rt.fac) + ' por segundo: ' + Math.round(sh * 100) + '% de tudo que você ganha'); sfx('click'); });
    goalChip(0, 712, 'Pilão', S.made.onigiri, UNLOCK.pilao, S.unlocked.pilao, ICON.mochi);
    goalChip(1, 836, 'Dourado', S.made.mochi, UNLOCK.dourado, S.unlocked.mochid, ICON.mochid);
  }

  const TOOLS = [
    { id: 'panela', name: 'Panela', hint: 'toque numa casa pra pôr' }, { id: 'moldadora', name: 'Moldadora', hint: 'toque numa casa pra pôr' }, { id: 'pilao', name: 'Pilão', hint: 'ocupa 2 casas' },
    { id: 'esteira', name: 'Esteira', hint: 'toque ou arraste nas casas' }, { id: 'divisor', name: 'Divisor', hint: 'um pra cada lado' }, { id: 'borracha', name: 'Borracha', hint: 'o dinheiro volta' }, { id: 'undo', name: 'Desfazer', hint: '' },
  ];
  // cada botão: desenho + NOME + uma palavra embaixo (preço / grátis). Largo pro dedo (92×70 no palco ≈ 66×50 no celular… a barra inteira é alvo).
  const BAR = { w: 92, h: 70, gap: 4, y: 466 }; BAR.x = (W - (BAR.w * 7 + BAR.gap * 6)) / 2;
  const toolRect = i => ({ x: BAR.x + i * (BAR.w + BAR.gap), y: BAR.y, w: BAR.w, h: BAR.h });
  let toolT = 0, hoverTool = -1;
  function drawBottomBar(t) {
    g.fillStyle = 'rgba(40,22,8,.42)'; D.rrect(g, BAR.x - 8, BAR.y - 6, BAR.w * 7 + BAR.gap * 6 + 16, 86, 16); g.fill();
    TOOLS.forEach((tl, i) => {
      const x = BAR.x + i * (BAR.w + BAR.gap), on = S.tool === tl.id, y = BAR.y - (on ? 4 + Math.sin(t * 6) * 1.5 : 0);
      const lockP = tl.id === 'pilao' && !S.unlocked.pilao, isM = MDEF[tl.id] && tl.id !== 'divisor', p = isM ? machinePrice(tl.id) : 0, can = !isM || money() >= p;
      const pressed = pressBtn && pressBtn.x === x && pressBtn.y === BAR.y, dy = pressed ? 2 : 0;
      g.fillStyle = 'rgba(40,22,8,.30)'; D.rrect(g, x - 2, y + 2, BAR.w + 4, BAR.h + 6, 12); g.fill();
      g.fillStyle = INK; D.rrect(g, x - 2.5, y - 2.5, BAR.w + 5, BAR.h + 7.5, 12); g.fill();
      g.fillStyle = on ? C.gold : lockP ? '#D8CCB4' : C.cream; D.rrect(g, x, y + dy, BAR.w, BAR.h, 10); g.fill();
      g.fillStyle = on ? C.goldL : '#F3E7CC'; D.rrect(g, x + 4, y + 4 + dy, BAR.w - 8, 31, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; D.rrect(g, x + 5, y + 2.5 + dy, BAR.w - 10, 3, 1.5); g.fill();
      const ix = x + BAR.w / 2, iy = y + dy;
      g.imageSmoothingEnabled = false;
      if (lockP) { g.globalAlpha = 0.35; g.drawImage(A.icon('pilao'), ix - 18, iy + 2, 36, 33); g.globalAlpha = 1; blit(SPR.lock, ix, iy + 30, 2); }
      else if (tl.id === 'borracha') blit(SPR.eraser, ix, iy + 32, 2);
      else if (tl.id === 'undo') blit(SPR.undo, ix, iy + 32, 2, { alpha: undo.length ? 1 : 0.4 });
      else g.drawImage(A.icon(tl.id), ix - 18, iy + 2, 36, 33);
      let sub, col = '#6B4A2E';
      if (lockP) { meter(x + 10, y + 56 + dy, BAR.w - 20, 8, S.made.onigiri / UNLOCK.pilao, C.gold); sub = null; }
      else if (isM) { sub = p > 0 ? '¥' + U.fmt(p) : 'grátis'; col = can ? C.grassD : C.redD; }
      else if (tl.id === 'esteira' || tl.id === 'divisor') sub = 'grátis';
      else if (tl.id === 'borracha') sub = 'apaga';
      else { sub = undo.length ? 'volta 1' : 'nada'; if (!undo.length) col = '#a8987e'; }
      txt(tl.name, ix, y + 45 + dy, T(textW(tl.name, TXT) > BAR.w - 6 ? 15 : TXT, lockP || (tl.id === 'undo' && !undo.length) ? '#8a7a66' : INK));
      if (sub) txt(sub, ix, y + 61 + dy, T(TXT, col));
      hit(x, BAR.y - 6, BAR.w, BAR.h + 8, () => {
        moveSel = null;
        if (tl.id === 'undo') return doUndo();
        if (lockP) { toast('O Pilão abre com ' + UNLOCK.pilao + ' onigiris (você fez ' + S.made.onigiri + ')'); sfx('error'); return; }
        S.tool = S.tool === tl.id ? null : tl.id; S.sel = null; toolT = 0; sfx('click');
      }, { x, y: BAR.y });
      // balão com a dica de como usar (some sozinho; volta se passar o mouse)
      const show = tl.hint && ((on && toolT < 2.6) || hoverTool === i);
      if (show) {
        const label = tl.hint, tw = Math.max(70, textW(label) + 24), lx = U.clamp(ix - tw / 2, 6, W - tw - 6), a = on ? U.clamp((2.6 - toolT) * 3, 0, 1) : 1;
        g.globalAlpha = hoverTool === i ? 1 : a;
        g.fillStyle = INK; D.rrect(g, lx, y - 36, tw, 28, 9); g.fill(); g.beginPath(); g.moveTo(ix - 6, y - 9); g.lineTo(ix, y - 3); g.lineTo(ix + 6, y - 9); g.fill();
        txt(label, lx + tw / 2, y - 21.5, T(TXT, C.cream)); g.globalAlpha = 1;
      }
    });
    // dos lados: "Arrumar pra mim" (refaz o chão em fileiras) e a Ajuda
    button(6, BAR.y, 120, BAR.h, 'Arrumar', arrange, { sub: 'pra mim', fill: '#DDF0C2' });
    button(834, BAR.y, 120, BAR.h, '? Ajuda', () => { helpOpen = !helpOpen; sfx('click'); }, { size: 18, on: helpOpen });
  }

  /* ---- "Arrumar pra mim": refaz o chão em fileiras retas (entrada → panela → quem usa o cozido → venda).
     Não cobra nada, nada se perde (o que estava na esteira vende) e o Desfazer devolve tudo como era. ---- */
  function arrange() {
    const rk = (a, b) => (b.star | 0) - (a.star | 0) || b.lvl - a.lvl, by = ty => machines.filter(m => m.type === ty).sort(rk);
    const P = by('panela'), M = by('moldadora'), L = by('pilao'), lines = [], len = l => l.reduce((n, m) => n + MDEF[m.type].len, 0);
    if (!P.length && !M.length && !L.length) { toast('Ponha uma máquina primeiro'); sfx('error'); return false; }
    let k = 0, lone = 0;
    while (P.length && lines.length < GH) { const l = [P.shift()], c = k++ % 2 === 0 ? (M.shift() || L.shift()) : (L.shift() || M.shift()); if (c) l.push(c); lines.push(l); }
    for (const m of P.concat(M, L)) {                 // sobrou: fileira só dela se tiver; senão no fim da fileira mais vazia
      if (m.type !== 'panela') lone++;
      if (lines.length < GH) { lines.push([m]); continue; }
      const l = lines.slice().sort((a, b) => len(a) - len(b))[0];
      if (len(l) + MDEF[m.type].len > GW - 1) { toast('Tem máquina demais pra eu arrumar sozinho'); sfx('error'); return false; }
      l.push(m);
    }
    const a = beginAction(), rows = []; for (let i = 0; i < GH; i++) rows.push(i); const mid = (GH - 1) / 2 - 0.6; rows.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid));
    for (const m of machines.slice()) { if (m.type === 'divisor') removeMachine(m); else vacate(m); }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) clearBelt(x, y);
    lines.forEach((l, i) => {
      const y = rows[i], n = len(l), gap = n + l.length - 1 <= GW - 2 ? 1 : 0;
      let x = n + (l.length - 1) * gap <= GW - 3 ? 2 : 1;
      for (const m of l) { m.x = x; m.y = y; m.rot = 0; occupy(m); m.sq = 1; x += MDEF[m.type].len + gap; }
      for (let bx = 0; bx < GW; bx++) if (!grid[y][bx]) setBelt(bx, y, 0);
    });
    commit(a); S.sel = null; S.tool = null; moveSel = null; sfx('fab-pop', { vol: 0.7 });
    toast(lone ? 'Arrumei! Falta Panela pra ' + lone + (lone > 1 ? ' máquinas' : ' máquina') : 'Arrumei! Não gostou? Toque em Desfazer');
    return true;
  }

  /* ---- faixa "o que fazer agora" (1 linha embaixo da barra de cima) + guia da 1ª Moldadora em 3 passos ----
     Tudo sai do estado do chão (nada no save): passo 1 tocar na Moldadora · 2 tocar no chão · 3 ligar e ver vender. */
  let moveSel = null, seloAsk = null;
  const unlinked = m => outsOf(m).some(o => o[0] < GW && !cellAt(o[0], o[1]));
  function guideStep() {
    if (!S.tutDone || S.tut >= 0 || S.made.onigiri > 0 || S.unlocked.pilao) return 0;
    if (machines.some(m => m.type === 'moldadora')) return 3;
    return S.tool === 'moldadora' ? 2 : S.tool ? 0 : 1;
  }
  function guideCell() {     // casa sugerida: na esteira, uma casa depois da saída da Panela
    const p = machines.find(m => m.type === 'panela'); if (!p) return null;
    const o = outTarget(p), d = p.rot;
    for (const c of [[o[0] + DX[d], o[1] + DY[d]], o]) if (inGrid(c[0], c[1])) { const q = cellAt(c[0], c[1]); if (!q || q.k !== 'm') return c; }
    return null;
  }
  function nowLine() {
    const gs = guideStep();
    if (moveSel) return { s: 'Toque na casa pra onde a máquina vai' };
    if (gs === 1) { const p = machinePrice('moldadora'); return money() >= p ? { s: 'Toque na Moldadora aqui embaixo', n: 1 } : { s: 'Junte mais ¥' + U.fmt(p - money()) + ' pra comprar a Moldadora', n: 1, wait: 1 }; }
    if (gs === 2) return { s: 'Agora toque no chão que está brilhando', n: 2 };
    if (gs === 3) {
      const mo = machines.find(m => m.type === 'moldadora');
      if (unlinked(mo)) return { s: 'Ligue a saída dela com Esteira até a Venda', n: 3 };
      return mo.work || mo.inB.cozido > 0 || mo.out.length ? { s: 'Pronto! O onigiri sai e vende sozinho', n: 3 } : { s: 'Faça a esteira levar o arroz cozido até ela', n: 3 };
    }
    if (S.tool === 'divisor') return { s: 'Toque numa casa: o Divisor manda um pra cada lado' };
    if (MDEF[S.tool]) return { s: 'Toque numa casa do chão pra pôr ' + (S.tool === 'pilao' ? 'o Pilão' : 'a ' + MDEF[S.tool].name) };
    if (S.tool === 'esteira') return { s: 'Toque nas casas (ou arraste) pra pôr esteira. Toque de novo pra virar' };
    if (S.tool === 'borracha') return { s: 'Toque no que quer apagar. O dinheiro volta!' };
    if (S.sel) return null;
    if (!machines.some(m => m.type !== 'divisor')) return { s: 'Toque numa máquina aqui embaixo e depois no chão' };
    if (!(S.digRate > 0)) return { s: 'Sem arroz chegando: volte e cave na montanha', col: C.redD };
    if (machines.some(unlinked)) return { s: 'Seta piscando = saída solta. Ligue com Esteira até a Venda', col: C.oraD };
    if (upPick) return { s: 'Dá pra melhorar! Toque ' + (upPick === 'dock' ? 'na Entrada' : 'na máquina') + ' com a seta verde' };
    return { flow: 1 };
  }
  function flowArrow(x, y, k) {
    k = k || 1; g.fillStyle = INK; g.beginPath(); g.moveTo(x - 9 * k, y - 3 * k); g.lineTo(x + 1 * k, y - 3 * k); g.lineTo(x + 1 * k, y - 8 * k); g.lineTo(x + 10 * k, y); g.lineTo(x + 1 * k, y + 8 * k); g.lineTo(x + 1 * k, y + 3 * k); g.lineTo(x - 9 * k, y + 3 * k); g.closePath(); g.fill();
  }
  // desenho do caminho: arroz entra → máquina faz → produto sai → vende (¥)
  const FLOW = [['raw', 'arroz entra'], ['maq', 'máquina faz'], ['onigiri', 'produto sai'], ['yen', 'vende']];
  function flowIcon(k, x, y, sc) {
    if (k === 'maq') { g.imageSmoothingEnabled = false; g.drawImage(A.icon('panela'), Math.round(x - 12 * sc), Math.round(y - 22 * sc), 24 * sc, 22 * sc); }
    else blit(k === 'yen' ? SPR.coin : ICON[k], x, y, sc);
  }
  function drawNow(t) {
    const L = nowLine(); if (!L) return;
    const y = 50, h = 32;
    if (L.flow) {
      const ws = FLOW.map(f => 30 + textW(f[1], TXT)), w = ws.reduce((a, b) => a + b, 0) + 30 * 3 + 24; let x = W / 2 - w / 2;
      pill(x, y, w, h, '#FFF6DE'); x += 12;
      FLOW.forEach((f, i) => { flowIcon(f[0], x + 12, y + 27, 1); txt(f[1], x + 28, y + 17, T(TXT, INK, 'left')); x += ws[i]; if (i < 3) { flowArrow(x + 15, y + 16, 0.9); x += 30; } });
      return;
    }
    const tw = textW(L.s, 18), w = tw + 28 + (L.n ? 74 : 0), x = W / 2 - w / 2;
    pill(x, y, w, h, '#FFE9A8');
    if (L.n) { g.fillStyle = INK; D.rrect(g, x + 5, y + 4, 70, h - 8, 9); g.fill(); txt(L.n + ' de 3', x + 40, y + 16.5, T(TXT, C.goldL)); }
    txt(L.s, x + (L.n ? 82 : 14), y + 17, T(18, L.col || INK, 'left'));
  }
  // "toque aqui": moldura piscando + seta pulando em cima do alvo
  function pointAt(r, t) {
    const b = Math.abs(Math.sin(t * 5)) * 10, cx = r.x + r.w / 2, ty = r.y - 12 - b;
    g.strokeStyle = INK; g.lineWidth = 7; D.rrect(g, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 13); g.stroke();
    g.strokeStyle = C.goldL; g.lineWidth = 3.5; g.setLineDash([10, 7]); g.lineDashOffset = -t * 30; D.rrect(g, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 13); g.stroke(); g.setLineDash([]);
    g.fillStyle = INK; g.beginPath(); g.moveTo(cx - 17, ty - 24); g.lineTo(cx + 17, ty - 24); g.lineTo(cx, ty + 3); g.closePath(); g.fill();
    g.fillStyle = C.gold; g.beginPath(); g.moveTo(cx - 11, ty - 20.5); g.lineTo(cx + 11, ty - 20.5); g.lineTo(cx, ty - 3); g.closePath(); g.fill();
  }
  function drawGuide(t) {
    const gs = guideStep(); if (!gs || helpOpen || seloAsk) return;
    if (gs === 1) { if (money() >= machinePrice('moldadora')) pointAt(toolRect(1), t); }
    else if (gs === 2) { const c = guideCell(); if (c) { cellGlow(c[0], c[1], 'rgba(243,201,74,.45)', t); pointAt({ x: GX + c[0] * CW + 4, y: GY + c[1] * CH + 4, w: CW - 8, h: CH - 8 }, t); } }
    else if (S.tool !== 'esteira' && !S.sel) { const mo = machines.find(m => m.type === 'moldadora'); if (mo && unlinked(mo)) pointAt(toolRect(3), t); }
  }

  /* ---- cartões flutuantes (máquina, divisor, docas): pequenos, presos ao lado do que foi tocado ---- */
  function floatCard(ax, ay, w, h, side, bx) {   // devolve o canto (x, y) do cartão; ax = borda direita da máquina, bx = esquerda
    if (bx === undefined) bx = ax;
    let x = side > 0 ? ax + 16 : bx - 16 - w;      // nunca em cima da máquina (o 2º toque do toque duplo cai nela)
    if (x + w > W - 8) x = bx - 16 - w; if (x < 8) x = ax + 16;
    x = U.clamp(x, 8, W - w - 8);
    const y = U.clamp(ay - h / 2, 52, 462 - h), left = x >= ax;
    g.fillStyle = 'rgba(40,22,8,.30)'; D.rrect(g, x - 2, y + 3, w + 4, h + 6, 14); g.fill();
    g.fillStyle = INK; D.rrect(g, x - 3, y - 3, w + 6, h + 8, 14); g.fill();
    const py = U.clamp(ay, y + 16, y + h - 16);
    g.beginPath(); if (left) { g.moveTo(x - 2, py - 10); g.lineTo(x - 13, py); g.lineTo(x - 2, py + 10); } else { g.moveTo(x + w + 2, py - 10); g.lineTo(x + w + 13, py); g.lineTo(x + w + 2, py + 10); } g.fill();
    g.fillStyle = '#FFF6DE'; D.rrect(g, x, y, w, h, 11); g.fill();
    g.fillStyle = '#FFF6DE'; g.beginPath(); if (left) { g.moveTo(x + 1, py - 6); g.lineTo(x - 8, py); g.lineTo(x + 1, py + 6); } else { g.moveTo(x + w - 1, py - 6); g.lineTo(x + w + 8, py); g.lineTo(x + w - 1, py + 6); } g.fill();
    hit(x - 4, y - 4, w + 8, h + 10, () => {}, null);
    return { x, y };
  }
  function removeBtn(m, x, y, w) {
    const back = m.paid + m.spent;
    button(x, y, w, 44, back > 0 ? 'Tirar daqui · devolve ¥' + U.fmt(back) : 'Tirar daqui', () => { const a = beginAction(); const c = mcenter(m); const ref = removeMachine(m); GS().money += ref; a.cost = -ref; commit(a); sfx('pop'); if (!S.fast) { ps.puff(c.x, c.y + 10, 10, 9, { c: C.sand }); if (ref) fl.add(c.x, c.y - 10, 'devolveu ¥' + U.fmt(ref), { size: 17, c: C.goldL }); } });
  }
  function moveBtns(m, x, y, w) {                            // Girar e Mover: botões (nada de toque duplo ou arrastar como único caminho)
    const bw = (w - 8) / 2;
    button(x, y, bw, 48, 'Girar', () => rotateMachine(m));
    button(x + bw + 8, y, bw, 48, 'Mover', () => { moveSel = m; S.sel = null; S.tool = null; sfx('click'); });
  }
  function lvlTag(x, y, lvl, fill) {                          // etiqueta "Nv. 3" no canto do cartão
    g.fillStyle = INK; D.rrect(g, x - 68, y + 6, 60, 26, 9); g.fill(); g.fillStyle = fill; D.rrect(g, x - 66, y + 8, 56, 22, 7); g.fill();
    txt('Nv. ' + lvl, x - 38, y + 19.5, T(TXT, INK));
  }
  // quanto ESTA máquina põe de dinheiro por segundo: o que ela faz vale mais do que o que entrou nela (a soma das máquinas = a fábrica)
  function machineYen(m) {
    const R = recipeOf(m); if (!R.out) return { n: 0, yen: 0 };
    const sv = k => ITEMS[k].val - ITEMS[k].base; let add = sv(R.out) * starMul(m); for (const k in R.in) add -= sv(k) * R.in[k];
    const n = U.clamp(m.busy, 0, 1) * speedOf(m) / R.time;
    return { n, yen: Math.max(0, add) * n * unitV() * fabMul() };
  }
  const INAME = { raw: 'arroz', gold: 'arroz dourado', cozido: 'arroz cozido' };
  function drawCard(m, t) {
    const r = mrect(m.type, m.x, m.y, m.rot), ax = r.x + r.w, ay = r.y + r.h / 2 - 10, def = MDEF[m.type], w = 270;
    if (m.type === 'divisor') {
      const c = floatCard(ax - 6, ay + 10, w, 196, m.x < 5 ? 1 : -1, r.x + 6), x = c.x + 10, y = c.y;
      txt('Divisor', x, y + 19, T(18, INK, 'left'));
      txt('entra por trás e sai', c.x + w / 2, y + 46, T(TXT, '#6B4A2E')); txt('um pra cada lado', c.x + w / 2, y + 67, T(TXT, '#6B4A2E'));
      moveBtns(m, x, y + 86, w - 20); removeBtn(m, x, y + 142, w - 20);
      return;
    }
    const R = recipeOf(m), two = def.recipes.length > 1, h = two ? 404 : 356, c = floatCard(ax - 4, ay, w, h, m.x + (m.type === 'pilao' && m.rot % 2 === 0 ? 1 : 0) < 5 ? 1 : -1, r.x + 4), x = c.x + 10;
    let y = c.y;
    txt(def.name, x, y + 19, T(18, INK, 'left'));
    if (m.star) seloPlate(x + textW(def.name, 18) + 8, y + 8, m.star);
    lvlTag(c.x + w, y, m.lvl, [C.cream, '#DDE6EE', K.copperL, C.goldL][A.tierOf(m.lvl)]);
    // receita em desenho: o que entra → o que sai
    g.fillStyle = '#F1E4C2'; D.rrect(g, x, y + 38, w - 20, 36, 8); g.fill();
    let ix = x + 18; for (const k in R.in) for (let i = 0; i < R.in[k]; i++) { blit(ICON[k], ix, y + 68, 2); ix += 22; }
    flowArrow(ix + 4, y + 56, 0.8);
    blit(ICON[R.out], ix + 30, y + 68, 2);
    txt('vira ' + (R.out === 'mochid' ? 'Mochi D.' : ITEMS[R.out].name.replace('Arroz ', '')), c.x + w - 16, y + 56.5, T(TXT, '#6B4A2E', 'right'));
    y += 82;
    if (two) {
      const bw = (w - 28) / 2;
      def.recipes.forEach((rc, i) => {
        const lock = i === 1 && !S.unlocked.mochid;
        button(x + i * (bw + 8), y, bw, 40, i ? 'Dourado' : 'Mochi', () => setRecipe(m, i), { on: m.rec === i, off: lock, lock });
      });
      y += 48;
    }
    // em palavras: o que ela está fazendo e quanto dinheiro ela põe
    let miss = ''; for (const k in R.in) if (!miss && m.inB[k] < R.in[k]) miss = INAME[k] || k;
    const st = m.blocked ? ['travada: ligue a saída', C.redD] : (m.full > 0 && m.busy > 0.8) ? ['fila cheia: melhore ela!', C.oraD] : (m.work && m.prog < 1) ? ['trabalhando · ' + fmt1(R.time / speedOf(m)) + ' s cada', C.grassD] : ['esperando ' + (miss || 'arroz'), '#8A6A4A'];
    const my = machineYen(m), p = levelPrice(m), max = m.lvl >= MAX_LVL, can = money() >= p;
    txt(st[0], c.x + w / 2, y + 9, T(TXT, st[1]));
    txt('ela rende', x + 4, y + 36, T(TXT, '#6B4A2E', 'left')); txt('¥' + U.fmt(my.yen) + '/s', c.x + w - 14, y + 36, T(22, C.goldD, 'right'));
    y += 58;
    // MELHORAR: o botão principal (dourado se o dinheiro dá; cinza dizendo quanto falta), com o salto de dinheiro
    const pct = Math.round(LVL_SPEED * 100), jump = my.yen * LVL_SPEED / speedOf(m), sj = SELO.val * my.yen;
    if (max) button(x, y, w - 20, 58, 'Tirar o Selo ★' + ((m.star | 0) + 1), () => { seloAsk = m; sfx('click'); }, { on: true, size: 19, sub: 'tudo dela vale +' + Math.round(SELO.val * 100) + '%', subCol: INK });
    else button(x, y, w - 20, 58, 'Melhorar · ¥' + U.fmt(p), () => {
      const l0 = m.lvl; levelUp(m);
      if (m.lvl > l0 && !S.fast) { const cc = mcenter(m); fl.add(cc.x, cc.y - 104, '+' + pct + '% mais rápida' + (jump >= 1 ? ' · +¥' + U.fmt(jump) + '/s' : ''), { size: 19, c: C.goldL, delay: 0.45, life: 1.6 }); facBump = 1; }
    }, { on: can, off: !can, size: 19, sub: can ? '+' + pct + '% mais rápida' + (jump >= 1 ? ' · +¥' + U.fmt(jump) + '/s' : '') : 'falta ¥' + U.fmt(p - money()), subCol: can ? INK : C.redD });
    txt('nível ' + m.lvl + ' de ' + MAX_LVL, x + 4, y + 78, T(TXT, '#6B4A2E', 'left')); meter(x + 118, y + 73, w - 20 - 122, 10, m.lvl / MAX_LVL, C.gold);
    y += 96;
    moveBtns(m, x, y, w - 20); removeBtn(m, x, y + 56, w - 20);
    void sj;
  }
  // confirma o Selo: diz numa frase o que acontece (a máquina volta ao nível 1) e o que se ganha (+50% pra sempre)
  function drawSeloAsk(t) {
    const m = seloAsk; if (!m || machines.indexOf(m) < 0 || m.lvl < MAX_LVL) { seloAsk = null; return; }
    g.fillStyle = 'rgba(30,18,10,.6)'; g.fillRect(0, 0, W, H);
    hit(0, 0, W, H, () => { seloAsk = null; sfx('click'); }, null);
    const w = 540, h = 262, x = (W - w) / 2, y = 124, n = (m.star | 0) + 1, pc = Math.round(SELO.val * 100), gain = machineYen(m).yen * SELO.val / starMul(m) / speedOf(m);
    pill(x, y, w, h, '#FFF6DE', 14); hit(x, y, w, h, () => {}, null);
    const pw = seloPlate(x + 22, y + 20, n, 24);
    txt('Tirar o Selo de Qualidade?', x + 30 + pw, y + 35, T(22, INK, 'left'));
    txt('A ' + MDEF[m.type].name.replace('Pilão', 'máquina') + ' volta ao nível 1 e ganha uma ★.', x + w / 2, y + 78, T(18, INK));
    txt('Com a ★, tudo que ela faz vale +' + pc + '%. Pra sempre!', x + w / 2, y + 106, T(18, C.goldD));
    txt('Os próximos níveis dela ficam ' + SELO.cost + '× mais caros.', x + w / 2, y + 134, T(TXT, '#6B4A2E'));
    txt('Mudou de ideia? É só tocar em Desfazer.', x + w / 2, y + 158, T(TXT, '#6B4A2E'));
    button(x + 20, y + h - 74, 180, 56, 'Agora não', () => { seloAsk = null; sfx('click'); });
    button(x + 216, y + h - 74, w - 236, 56, 'Tirar o Selo ★' + n, () => { seloAsk = null; S.sel = m; selo(m); facBump = 1; }, { on: true, size: 20 });
    void gain;
  }
  function drawDockCard(t) {
    const w = 300, h = 222, c = floatCard(BAY_IN.x + BAY_IN.w - 10, 230, w, h, 1), x = c.x + 10, y = c.y, cap = dockCap(), use = Math.min(S.dockUse, cap), max = dockMax(), p = dockPrice(), can = money() >= p;
    txt('Entrada do arroz', x, y + 19, T(18, INK, 'left'));
    lvlTag(c.x + w, y, S.dockLvl, C.cream);
    txt('puxa ' + fmt1(dockPct() * 100) + '% do arroz que você cava', c.x + w / 2, y + 48, T(TXT, '#6B4A2E'));
    meter(x, y + 62, w - 20, 10, use / Math.max(0.01, cap), C.grass);
    txt('usando ' + fmt1(use) + ' de ' + fmt1(cap) + ' sacos por segundo', c.x + w / 2, y + 88, T(TXT, '#6B4A2E'));
    txt('1 saco na esteira = ¥' + U.fmt(unitV()), c.x + w / 2, y + 110, T(TXT, C.goldD));
    if (max) button(x, y + 126, w - 20, 44, 'Entrada no máximo', dockUp, { off: true });
    else button(x, y + 126, w - 20, 58, 'Melhorar · ¥' + U.fmt(p), () => { const l0 = S.dockLvl; dockUp(); if (S.dockLvl > l0) facBump = 1; }, { on: can, off: !can, size: 19, sub: can ? 'mais arroz = mais dinheiro' : 'falta ¥' + U.fmt(p - money()), subCol: can ? INK : C.redD });
    txt(S.digRate > 0 ? 'o resto vende cru: nada se perde' : 'cave lá fora pra fábrica andar!', c.x + w / 2, y + 204, T(TXT, S.digRate > 0 ? '#8A6A4A' : C.redD));
  }
  function drawSaleCard(t) {
    const w = 280, h = 176, c = floatCard(BAY_OUT.x + 10, 230, w, h, -1), x = c.x + 10, y = c.y;
    txt('Venda', x, y + 19, T(18, INK, 'left'));
    txt('o que chega aqui vira dinheiro', c.x + w / 2, y + 48, T(TXT, '#6B4A2E'));
    txt('sozinho. Cada um vale mais:', c.x + w / 2, y + 69, T(TXT, '#6B4A2E'));
    ['cozido', 'onigiri', 'mochi', 'mochid'].forEach((k, i) => { blit(ICON[k], x + 14 + i * 65, y + 110, 2); txt(ITEMS[k].val + '×', x + 30 + i * 65, y + 97, T(TXT, C.goldD, 'left')); });
    txt('você já fez:', x, y + 132, T(TXT, '#6B4A2E', 'left'));
    ['cozido', 'onigiri', 'mochi', 'mochid'].forEach((k, i) => { const locked = (k === 'mochi' && !S.unlocked.pilao) || (k === 'mochid' && !S.unlocked.mochid); blit(ICON[k], x + 14 + i * 65, y + 168, 2, { alpha: locked ? 0.3 : 1 }); txt(locked ? '?' : fmtK(S.made[k]), x + 29 + i * 65, y + 156, T(TXT, locked ? '#9a8a76' : INK, 'left')); });
  }
  let helpOpen = false;
  function drawHelp() {
    g.fillStyle = 'rgba(30,18,10,.6)'; g.fillRect(0, 0, W, H);
    hit(0, 0, W, H, () => { helpOpen = false; sfx('click'); }, null);
    const w = 660, h = 398, x = (W - w) / 2, y = 66;
    pill(x, y, w, h, '#FFF6DE', 14);
    E.drawShibaHead(g, x + 50, y + 44, performance.now() / 1000, { scale: 1, expr: 'happy' });
    txt('A fábrica faz seu arroz valer mais', x + 96, y + 30, T(22, INK, 'left'));
    txt('mais máquina e mais nível = mais dinheiro por segundo', x + 96, y + 58, T(TXT, '#6B4A2E', 'left'));
    // o caminho, em desenho grande
    g.fillStyle = '#F1E4C2'; D.rrect(g, x + 20, y + 84, w - 40, 92, 10); g.fill();
    FLOW.forEach((f, i) => { const cx = x + 96 + i * 156; flowIcon(f[0], cx, y + 142, 3); txt(f[1], cx, y + 160, T(TXT, INK)); if (i < 3) flowArrow(cx + 78, y + 120, 1.5); });
    const tips = ['Pôr máquina: toque nela aqui embaixo, depois no chão', 'Esteira leva as coisas: escolha Esteira e arraste no chão', 'Toque numa máquina pra Melhorar, Girar, Mover ou Tirar', 'Errou? Toque em Desfazer. Bagunçou? Toque em Arrumar'];
    tips.forEach((s, i) => { g.fillStyle = C.gold; g.beginPath(); g.arc(x + 34, y + 202 + i * 27, 4, 0, TAU); g.fill(); txt(s, x + 48, y + 203 + i * 27, T(TXT, INK, 'left')); });
    txt('cada produto vale mais que o arroz cru:', x + 30, y + 322, T(TXT, '#6B4A2E', 'left'));
    ['cozido', 'onigiri', 'mochi', 'mochid'].forEach((k, i) => { blit(ICON[k], x + 64 + i * 110, y + 372, 2); txt(ITEMS[k].val + '×', x + 84 + i * 110, y + 359, T(18, C.goldD, 'left')); });
    button(x + w - 150, y + h - 66, 130, 52, 'Entendi', () => { helpOpen = false; sfx('click'); }, { on: true, size: 19 });
    button(x + w - 54, y + 8, 44, 40, 'X', () => { helpOpen = false; sfx('click'); }, { size: 20, fill: '#F6B6B0' });
  }

  /* ---- tutorial: 4 passos com o Kome ---- */
  const TUT = [
    { r: () => BAY_IN, t: 'Esta é a Doca de Entrada.', s: ['Ela puxa uma parte do arroz que você cava', 'lá fora. O resto vende cru, como sempre.'] },
    { r: () => { const m = machines.find(q => q.type === 'panela'); if (!m) return { x: GX, y: GY, w: CW, h: CH }; const r = mrect(m.type, m.x, m.y, m.rot); return { x: r.x, y: r.y - 36, w: r.w, h: r.h + 36 }; }, t: 'A Panela cozinha o arroz.', s: ['1 saco vira 1 arroz cozido,', 'e o cozido vale 2× o cru. Essa é grátis!'] },
    { r: () => BAY_OUT, t: 'Doca de Venda.', s: ['Tudo que chega aqui vende sozinho', 'e o kei-truck leva. Nada se perde.'] },
    { r: () => ({ x: BAR.x - 8, y: BAR.y - 8, w: BAR.w * 7 + BAR.gap * 6 + 16, h: BAR.h + 18 }), t: 'Pronto, veja o +¥ subindo!', s: ['Agora ponha uma Moldadora: o cozido vira', 'onigiri e vale o dobro. Eu mostro onde tocar!'] },
  ];
  function drawTutorial(t) {
    const st = TUT[S.tut], r = st.r(), pad = 6;
    g.save();
    g.fillStyle = 'rgba(30,18,10,.6)';
    g.beginPath(); g.rect(0, 0, W, H); g.rect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2); g.fill('evenodd');   // escurece tudo menos o alvo
    g.strokeStyle = C.goldL; g.lineWidth = 3; g.setLineDash([9, 6]); g.lineDashOffset = -t * 30;
    D.rrect(g, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 12); g.stroke(); g.setLineDash([]);
    g.restore();
    const bw = 520, bh = 154;
    let bx = U.clamp(r.x + r.w / 2 - bw / 2, 20, W - bw - 20), by = r.y + r.h + 20;
    if (by + bh > H - 10) by = r.y - bh - 22;
    if (S.tut === 0) { bx = r.x + r.w + 26; by = 200; }
    if (S.tut === 2) { bx = r.x - bw - 26; by = 200; }
    hit(0, 0, W, H, () => {}, null);      // o tutorial segura o toque: só os botões dele respondem
    pill(bx, by, bw, bh, '#FFF6DE', 14);
    E.drawShibaHead(g, bx + 46, by + 54, t, { scale: 1.15, expr: 'happy', pal: (GS().look && GS().look.pal) || 'kome' });
    for (let i = 0; i < 4; i++) { g.fillStyle = i === S.tut ? C.gold : i < S.tut ? C.grass : '#D8CCB4'; g.beginPath(); g.arc(bx + bw - 64 + i * 15, by + 18, 4.5, 0, TAU); g.fill(); }
    txt(st.t, bx + 92, by + 27, T(20, INK, 'left'));
    st.s.forEach((s, i) => txt(s, bx + 92, by + 55 + i * 22, T(TXT, '#6B4A2E', 'left')));
    button(bx + bw - 146, by + bh - 56, 132, 46, S.tut === 3 ? 'Começar!' : 'Próximo', () => { S.tut++; sfx('click'); if (S.tut >= TUT.length) endTut(); }, { on: true, size: 18 });
    button(bx + 92, by + bh - 56, 150, 46, 'Pular tutorial', endTut);
  }
  function endTut() { S.tut = -1; S.tutDone = true; persist(); }

  /* ======================================================================
     Entrada (mouse e toque)
     ====================================================================== */
  let drag = null, hover = null, pressBtn = null, lastTap = { t: 0, m: null }, hoverXY = null;
  const toCell = (x, y) => { const cx = Math.floor((x - GX) / CW), cy = Math.floor((y - GY) / CH); return inGrid(cx, cy) ? [cx, cy] : null; };
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  // máquina é mais alta que a casa: tocar no "corpo" dela (que cobre a casa de trás) também pega a máquina
  function pickMachine(x, y) {
    let best = null;
    for (const m of machines) {
      if (m.type === 'divisor') continue;
      const r = mrect(m.type, m.x, m.y, m.rot);
      if (x >= r.x + 10 && x < r.x + r.w - 10 && y >= r.y - 30 && y < r.y) { const up = cellAt(Math.floor((x - GX) / CW), Math.floor((y - GY) / CH)); if (!up || up.k !== 'm') best = m; }
    }
    return best;
  }
  input.on('down', (x, y) => {
    for (let i = btns.length - 1; i >= 0; i--) { const b = btns[i]; if (x >= b.x - 3 && y >= b.y - 3 && x < b.x + b.w + 3 && y < b.y + b.h + 6) { pressBtn = b.o; b.fn(); return; } }
    if (S.tut >= 0) return;
    if (firstCard) { firstCard.life = Math.min(firstCard.life, 0.3); }
    if (moveSel) {                                             // botão Mover: o próximo toque no chão é o destino
      const m = moveSel, mc = toCell(x, y); moveSel = null;
      if (mc && machines.indexOf(m) >= 0) { const at = fitAnchor(m.type, mc[0], mc[1], m.rot, m); if (at) moveMachine(m, at[0], at[1]); else { toast('Aí não cabe: já tem máquina'); sfx('error'); } S.sel = m; }
      return;
    }
    const c = toCell(x, y);
    if (!c) {
      const pm = !S.tool && pickMachine(x, y);
      if (pm) { drag = { mode: 'move', m: pm, start: [pm.x, pm.y], last: [pm.x, pm.y], moved: false, off: [0, 0] }; return; }
      if (inRect(x, y, BAY_IN)) { S.sel = S.sel === 'dock' ? null : 'dock'; S.tool = null; sfx('click', { pitch: 1.1 }); return; }
      if (inRect(x, y, BAY_OUT)) { S.sel = S.sel === 'sale' ? null : 'sale'; S.tool = null; sfx('click', { pitch: 1.1 }); return; }
      S.sel = null;
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
      const pm = (!cell || cell.k !== 'm') && pickMachine(x, y);
      if (pm) drag = { mode: 'move', m: pm, start: c, last: c, moved: false, off: [pm.x - c[0], pm.y - c[1]], tall: true };
      else if (cell && cell.k === 'm') drag = { mode: 'move', m: cell.m, start: c, last: c, moved: false, off: [cell.m.x - c[0], cell.m.y - c[1]] };
      else if (cell && cell.k === 'b') { drag = { mode: 'beltTap', last: c }; S.sel = null; }
      else { S.sel = null; }
    }
  });
  let lastBeltDir = 0;
  input.on('move', (x, y) => {
    hover = toCell(x, y); hoverXY = [x, y];
    hoverTool = -1; if (y >= BAR.y - 6 && y < BAR.y + BAR.h + 8) { const i = Math.floor((x - BAR.x) / (BAR.w + BAR.gap)); if (i >= 0 && i < TOOLS.length && x - BAR.x - i * (BAR.w + BAR.gap) < BAR.w) hoverTool = i; }
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
        else { lastTap = { t: now, m: d.m }; S.sel = S.sel === d.m ? null : d.m; sfx('click', { pitch: 1.1 }); }
      }
    } else if (d.mode === 'beltTap') {
      const cell = cellAt(c[0], c[1]);
      if (cell && cell.k === 'b') { const a = beginAction(); cell.dir = (cell.dir + 1) % 4; commit(a); sfx('click'); }
    }
  });
  addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape' && (helpOpen || seloAsk || moveSel)) { helpOpen = false; seloAsk = null; moveSel = null; return; }
    if (e.key === 'Escape' && !S.tool && !S.sel) { close(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { doUndo(); e.preventDefault(); }
    if (e.key === 'Escape') { S.tool = null; S.sel = null; }
    if (e.key === 'r' && S.sel && typeof S.sel === 'object') rotateMachine(S.sel);
  });

  /* ======================================================================
     Fantasma (prévia de pôr / mover) e realce das casas
     ====================================================================== */
  const GHOST = { type: '', x: 0, y: 0, rot: 0, lvl: 1, rec: 0, inB: { raw: 0, gold: 0, cozido: 0 }, out: [], work: false, prog: 0, anim: 0, sq: 0, idle: 0, id: 0, side: 0, pop: 0, busy: 0 };
  function cellGlow(a, b, col, t) {
    const x = GX + a * CW, y = GY + b * CH;
    g.fillStyle = col; D.rrect(g, x + 4, y + 4, CW - 8, CH - 8, 9); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.setLineDash([8, 6]); g.lineDashOffset = -t * 20; D.rrect(g, x + 4, y + 4, CW - 8, CH - 8, 9); g.stroke(); g.setLineDash([]);
  }
  function drawGhost(t) {
    let type, x, y, rot, ignore;
    if (drag && drag.mode === 'move' && drag.moved) { type = drag.m.type; x = drag.last[0] + drag.off[0]; y = drag.last[1] + drag.off[1]; rot = drag.m.rot; ignore = drag.m; }
    else if (moveSel && hover) { const at = fitAnchor(moveSel.type, hover[0], hover[1], moveSel.rot, moveSel) || hover; type = moveSel.type; x = at[0]; y = at[1]; rot = moveSel.rot; ignore = moveSel; }
    else if (MDEF[S.tool] && (hover || (drag && drag.last))) { const c = (drag && drag.last) || hover; const at = fitAnchor(S.tool, c[0], c[1], 0); type = S.tool; rot = 0; if (at) { x = at[0]; y = at[1]; } else { x = c[0]; y = c[1]; } }
    else if ((S.tool === 'esteira' || S.tool === 'borracha') && hover && !drag) { cellGlow(hover[0], hover[1], S.tool === 'borracha' ? 'rgba(200,66,58,.30)' : 'rgba(243,201,74,.28)', t); return; }
    else return;
    const ok = canPlace(type, x, y, rot, ignore);
    for (const [a, b] of mcells(type, x, y, rot)) if (inGrid(a, b)) cellGlow(a, b, ok ? 'rgba(127,190,92,.42)' : 'rgba(200,66,58,.42)', t);
    if (ok) { GHOST.type = type; GHOST.x = x; GHOST.y = y; GHOST.rot = rot; GHOST.lvl = ignore ? ignore.lvl : 1; GHOST.rec = ignore ? ignore.rec : 0; drawMachine(GHOST, t, 0.62); drawPorts(GHOST, t, true); }
  }

  /* ======================================================================
     Avisos por cima: faixa de desbloqueio, produto novo, recado
     ====================================================================== */
  let firstCard = null; const firstQueue = [];
  function firstMade(k) { if (firstCard) firstQueue.push(k); else { firstCard = { k, life: 4.2, t: 0 }; if (!S.fast) { sfx('chirin'); sfx('fab-jingle', { vol: 0.7 }); ps.burst(W / 2, 190, 26, { c: [C.gold, C.sakura, C.goldL, C.cream], shape: 'star', speed: [100, 300], life: 1.1 }); } } }
  function drawOverlayMsgs(t, dt) {
    if (banner) {
      banner.life -= dt; const a = U.clamp(Math.min(banner.life, 3.2 - banner.life) * 3, 0, 1), k = U.ease.back(U.clamp((3.2 - banner.life) * 3, 0, 1));
      g.globalAlpha = a; g.save(); g.translate(W / 2, 188); g.scale(k, k); g.translate(-W / 2, -188);
      const bw2 = Math.max(460, textW(banner.sub) + 48);
      pill(W / 2 - bw2 / 2, 148, bw2, 80, '#FFE9A8', 14);
      txt(banner.t, W / 2, 176, T(23, INK)); txt(banner.sub, W / 2, 207, T(TXT, '#6B4A2E')); g.restore(); g.globalAlpha = 1;
      if (banner.life <= 0) banner = null;
    } else if (firstCard) {
      const f = firstCard; f.life -= dt; f.t += dt;
      const a = U.clamp(Math.min(f.life * 4, f.t * 6), 0, 1), k = U.ease.back(U.clamp(f.t * 3.5, 0, 1));
      g.globalAlpha = a; g.save(); g.translate(W / 2, 200); g.scale(k, k); g.translate(-W / 2, -200);
      pill(W / 2 - 230, 142, 460, 118, '#FFF6DE', 14);
      const ccx = W / 2 - 176;
      g.fillStyle = '#FFE9A8'; g.beginPath(); g.arc(ccx, 201, 40, 0, TAU); g.fill();
      for (let i = 0; i < 8; i++) { const an = t * 0.8 + i * TAU / 8; g.fillStyle = 'rgba(243,201,74,.5)'; g.beginPath(); g.moveTo(ccx, 201); g.arc(ccx, 201, 46, an, an + 0.2); g.fill(); }
      blit(ICON[f.k], ccx, 223 + Math.sin(t * 4) * 2, 4);
      txt('PRODUTO NOVO!', W / 2 - 120, 162, T(TXT, C.oraD, 'left'));
      txt(ITEMS[f.k].name, W / 2 - 120, 187, T(22, INK, 'left'));
      txt(PHRASE[f.k] || '', W / 2 - 120, 213, T(TXT, '#6B4A2E', 'left'));
      txt('vale ' + ITEMS[f.k].val + '× o saco cru', W / 2 - 120, 238, T(TXT, C.goldD, 'left'));
      g.restore(); g.globalAlpha = 1;
      if (f.life <= 0) { firstCard = null; if (firstQueue.length) firstMade(firstQueue.shift()); }
    }
    if (toastMsg) {
      toastMsg.life -= dt; g.globalAlpha = U.clamp(toastMsg.life * 3, 0, 1);
      const tw = Math.max(200, textW(toastMsg.t) + 32);
      g.fillStyle = 'rgba(42,26,16,.92)'; D.rrect(g, W / 2 - tw / 2, 426, tw, 34, 11); g.fill();
      txt(toastMsg.t, W / 2, 443.5, T(TXT, C.cream)); g.globalAlpha = 1;
      if (toastMsg.life <= 0) toastMsg = null;
    }
  }

  /* ======================================================================
     Quadro: cenário em cache → portas → esteiras → máquinas por linha → luz → HUD
     ====================================================================== */
  let lastT = 0, raf = 0, bubH = null;
  function bubbleLoop() {            // borbulho das panelas: um loop só, mais alto com mais panelas trabalhando
    let n = 0; for (const m of machines) if (m.type === 'panela' && m.work && m.prog < 1) n++;
    const want = isOpen() && n > 0 && !(GS() && GS().opts && GS().opts.mute) && E.Loops;
    if (want && !bubH) { try { bubH = E.Loops.start('fab-borbulho', { vol: 0.25, rate: 0.3 }); } catch (e) { bubH = null; } }
    if (bubH && want) bubH.set({ vol: Math.min(0.6, 0.22 + n * 0.07), rate: Math.min(1, 0.25 + n * 0.12) }, 0.4);
    if (bubH && !want) { try { bubH.stop(0.4); } catch (e) { /* */ } bubH = null; }
  }
  function frame() {
    if (!isOpen()) { raf = 0; bubbleLoop(); return; }
    const now = performance.now() / 1000, dt = Math.min(0.05, lastT ? now - lastT : 0.016); lastT = now;
    ps.update(dt); fl.update(dt); baysTick(dt); toolT += dt;
    for (let i = 0; i < 2; i++) chipPop[i] = Math.max(0, chipPop[i] - dt * 1.4);
    for (const m of machines) if (m.type === 'divisor') m.flip = m.flip === undefined ? m.side : m.flip + (m.side - m.flip) * Math.min(1, dt * 14);
    while (pendingBanners.length) { const [a, b] = pendingBanners.shift(); S.fast = false; celebrate(a, b); }
    fadeTick(dt); bubbleLoop();
    render(dt);
    raf = requestAnimationFrame(frame);
  }
  const NIGHT = { top: '#2B2A4A', mid: '#4A4470', bot: '#8A6A8A' };
  function render(dt) {
    const t = performance.now() / 1000, s = GS();
    btns = [];
    g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    // hora do dia do jogo: de dia entra sol pelas janelas; no fim da tarde as lanternas acendem
    const tod = s ? (s.tod || 0.3) : 0.3, Lg = E.Nature && E.Nature.light ? E.Nature.light(tod) : null;
    const dusk = Lg ? U.clamp(Math.max(Lg.night, Lg.dusk * 0.75), 0, 1) : 0, day = 1 - dusk;
    A.outsideIn(g, t, Lg, S.digRate > 0, (s && s.look && s.look.pal) || 'kome');
    A.outsideOut(g, t, Lg, truck);
    g.imageSmoothingEnabled = false; g.drawImage(A.bg(), 0, 0, W, H);
    if (day > 0.03) { g.globalAlpha = day; g.drawImage(A.sun(), 0, 0, W, H); g.globalAlpha = 1; }
    A.wall(g, t, { tod, dusk });
    const sig = layoutSig(); if (sig !== bsig) { bsig = sig; rebuildBelts(); }
    for (let i = 0; i < bview.length; i++) { const v = bview[i]; if (v.cell) v.moving = !(v.cell.jam > 0.3); }
    const feeding = S.digRate > 0; for (let i = 0; i < feedV.length; i++) feedV[i].moving = feeding;
    A.belts(g, bview, t);
    for (const m of machines) drawPorts(m, t, S.sel === m);
    if (S.sel && typeof S.sel === 'object') selRing(S.sel, t);
    if (moveSel) selRing(moveSel, t);
    drawBays(t);
    drawBeltItems(t);
    drawGhostCells = null; pickUp();
    const ms = machines.slice().sort((a, b) => (a.y + (a.type === 'pilao' && a.rot % 2 === 1 ? 1 : 0)) - (b.y + (b.type === 'pilao' && b.rot % 2 === 1 ? 1 : 0)) || a.x - b.x);
    const moving = drag && drag.mode === 'move' && drag.moved ? drag.m : null;
    for (const m of ms) { if (m === moving) { g.globalAlpha = 0.35; drawMachine(m, t); g.globalAlpha = 1; } else drawMachine(m, t); }
    for (const m of ms) if (m !== moving) drawMachineTag(m, t);   // etiquetas por cima de tudo: nunca ficam embaixo da fileira da frente
    drawGhost(t);
    ps.draw(g); fl.draw(g);
    A.corner(g, t); A.cornerR(g);
    // poeirinha no raio de sol
    if (day > 0.2) {
      g.fillStyle = '#FFF6D0';
      for (let i = 0; i < 18; i++) {
        const wx = A.WIN[i % 4], y = 130 + ((i * 97 + t * (5 + i % 4)) % 170), x = wx - 6 + (y - 130) * 0.62 + ((i * 53) % 44) + Math.sin(t * 0.5 + i) * 6;
        g.globalAlpha = day * 0.55 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 2.1)); g.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
      g.globalAlpha = 1;
    }
    if (dusk > 0.03) {
      g.fillStyle = 'rgba(38,28,84,' + (dusk * 0.36).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = dusk; g.drawImage(A.dusk(), 0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    // moedas voando da venda pro dinheiro
    for (const c of coins) {
      if (!c.on || c.t < 0) continue;
      const u = U.ease.inOut(c.t / c.d), mx = (c.x + YEN.x) / 2, my = Math.min(c.y, YEN.y) + 150;
      const x = (1 - u) * (1 - u) * c.x + 2 * (1 - u) * u * mx + u * u * YEN.x, y = (1 - u) * (1 - u) * c.y + 2 * (1 - u) * u * my + u * u * YEN.y;
      blit(SPR.coin, x, y + 10, 2);
    }
    dtUI = dt; drawTopBar(t);
    drawBottomBar(t);
    if (S.tut < 0 && !helpOpen) drawNow(t);
    if (G.News) G.News.draw(g, 166, 88, dt, { maxW: 400 });   // evento do modo infinito + avisos do jogo (ficavam escondidos atrás desta tela)
    if (S.sel === 'dock') drawDockCard(t); else if (S.sel === 'sale') drawSaleCard(t); else if (S.sel) drawCard(S.sel, t);
    if (S.sel !== 'dock' && !dockMax() && (upPick === 'dock' || (upAll && money() >= dockPrice()))) blit(SPR.up, GEO.feedX - 34, 122 + upBob(t, 0), 2);
    if (S.tut < 0) drawGuide(t);
    drawOverlayMsgs(t, dt);
    if (seloAsk) drawSeloAsk(t);
    if (helpOpen) drawHelp();
    if (S.tut >= 0) drawTutorial(t);
  }
  let drawGhostCells = null;

  /* ======================================================================
     Save (S.stats.fab), começo já montado, desbloqueio
     ====================================================================== */
  function persist() {
    const s = GS(); if (!s || !S.on) return;
    const bs = [];
    // o que está andando também vai pro save (itens nas esteiras e dentro das máquinas): é isso que o offline termina
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const c = grid[y][x]; if (c && c.k === 'b') bs.push(c.items.length ? [x, y, c.dir, c.items.map(i => i.t + ':' + i.p.toFixed(2) + ':' + (i.from | 0) + (i.q > 1 ? ':' + i.q.toFixed(2) : '')).join(' ')] : [x, y, c.dir]); }
    s.stats.fab = { on: 1, dock: S.dockLvl, ms: machines.map(m => [m.type, m.x, m.y, m.rot, m.lvl, m.rec, Math.round(m.paid), Math.round(m.spent), [m.inB.raw | 0, m.inB.gold | 0, m.inB.cozido | 0, m.out.map(i => i.t).join(' '), m.work ? 1 : 0, +m.prog.toFixed(2)], m.star | 0]), bs, sb: S.starBank,
      made: Object.assign({}, S.made), un: [S.unlocked.pilao ? 1 : 0, S.unlocked.mochid ? 1 : 0], tut: S.tutDone ? 1 : 0, fs: S.firstSale, pb: S.pb, slow: S.slow, s5: S.s5 };
  }
  function load() {
    const d = GS() && GS().stats.fab; if (!d || !d.on) return false;
    newGrid(); machines = [];
    S.on = true; S.dockLvl = d.dock | 0 || 1; Object.assign(S.made, d.made || {}); S.starBank = Object.assign({}, d.sb || {});
    S.unlocked.pilao = !!(d.un && d.un[0]); S.unlocked.mochid = !!(d.un && d.un[1]); S.tutDone = !!d.tut; S.firstSale = d.fs === undefined ? -1 : d.fs; S.pb = +d.pb || 0; S.slow = +d.slow || 0; S.s5 = +d.s5 || 0;
    for (const [x, y, dir, its] of d.bs || []) { setBelt(x, y, dir); if (its && grid[y][x]) grid[y][x].items = its.split(' ').map(q => { const [t, pp, fr, qq] = q.split(':'), it = { t, p: +pp || 0, from: fr | 0, stuck: 0, f: -1 }; if (+qq > 1) it.q = +qq; return it; }).filter(i => ITEMS[i.t]); }
    for (const q of d.ms || []) if (MDEF[q[0]] && canPlace(q[0], q[1], q[2], q[3])) {
      const m = makeMachine(q[0], q[1], q[2], q[3], { lvl: q[4], rec: q[5], paid: q[6], spent: q[7], star: q[9] | 0 }), b = q[8];
      if (b) { m.inB = { raw: b[0] | 0, gold: b[1] | 0, cozido: b[2] | 0 }; m.out = (b[3] || '').split(' ').filter(t => ITEMS[t]).map(t => ({ t })); m.work = !!b[4]; m.prog = +b[5] || 0; }
    }
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
    if (!G.HUD || !G.HUD.chip) return;
    if (!hudBtn) { hudBtn = G.HUD.chip({ id: 'fabrica', icon: 'factory', label: 'Fábrica', order: 20, tone: '#FFE0C2', show: false, onClick: () => open() }); if (!hudBtn) return; }
    if (!S.on) { hudBtn.set({ show: false }); return; }
    const rt = rates(), tot = rt.raw + rt.fac, sh = tot > 0 ? Math.round(rt.fac / tot * 100) : 0;
    hudBtn.el.title = 'Fábrica: ¥' + U.fmt(rt.fac) + '/s · ' + sh + '% da renda';
    hudBtn.set({ show: true, tip: S.tutDone ? '¥' + U.fmt(rt.fac) + '/s · ' + sh + '% da renda' : '', act: 'Abrir', prio: S.tutDone ? 0 : 2, hint: S.tutDone ? '' : 'nova! toque' });
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
    while (pendingFirst.length) firstMade(pendingFirst.shift());
    if (!raf) raf = requestAnimationFrame(frame);
    sfx('whoosh');
    return true;
  }
  function close() {
    if (!isOpen()) return;
    root.classList.remove('k-fab-open'); S.tool = null; S.sel = null; helpOpen = false; seloAsk = null; moveSel = null; drag = null; S.fast = true; ship.length = 0; persist(); bubbleLoop();
    if (api && api.save) api.save();
  }

  G.Sim && 0;   // (registrado no init: G.Sim é criado pelo game.js no boot)
  G.Fab = {
    init(a) {
      api = a || {};
      if (!load() && GS().ended) unlock(true);   // save antigo que já terminou a campanha: fábrica aparece direto
      if (G.Sim) G.Sim.add('fabrica', { tick, offline });
      // tempo fora: o game.js calcula antes da fábrica se registrar, então ela termina a esteira aqui
      const aw = GS().away; let yen = aw && aw.res && aw.res.fabrica ? aw.res.fabrica.yen : 0;
      if (!yen && aw && aw.sec > 5 && S.on) { const r = offline(aw.sec); yen = r ? r.yen : 0; if (aw.res) aw.res.fabrica = { yen }; }
      if (yen > 0 && api.toast) api.toast('Enquanto você estava fora', 'a fábrica terminou o que estava na esteira: +¥' + U.fmt(yen));
    },
    // chamados pelo game.js / items.js
    dig(v) { if (S.on) S.digAcc += v; },                       // só conta com a fábrica aberta (senão a campanha inteira entrava na 1ª média)
    sacks(id, n) { if (!S.on) return; S.sackAcc += n; if (id === 'koshi') S.goldAcc += n; },
    open, close, isOpen, unlock: () => unlock(true), on: () => S.on, persist, tool(t) { S.tool = t || null; S.sel = null; },
    // 0..1: o quanto a fábrica está rendendo agora (o galpão do pátio solta mais vapor; industry.js)
    activity() { if (!S.on) return 0; const rt = rates(), tot = rt.raw + rt.fac; return tot > 0 ? Math.min(1, rt.fac / tot * 2.2) : 0; },
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
    selo(x, y) { const m = G.Fab.machineAt(x, y); return m ? selo(m) : false; },   // Selo de Qualidade (testes/simulador)
    recipe(x, y, i) { setRecipe(G.Fab.machineAt(x, y), i); },
    dockUp, unlockAll() { S.unlocked.pilao = true; S.unlocked.mochid = true; }, skipTut() { S.tut = -1; S.tutDone = true; }, quiet() { firstCard = null; firstQueue.length = 0; pendingFirst.length = 0; banner = null; pendingBanners.length = 0; }, select(x, y) { S.sel = x === 'dock' || x === 'sale' ? x : G.Fab.machineAt(x, y); }, tool(id) { S.tool = id; toolT = 0; }, tut(n) { S.tut = n; },
    itemV: t => { const it = ITEMS[t]; return it ? (it.val - it.base) * unitV() * fabMul() : 0; },   // quanto a doca paga por 1 produto (Cidade)
    price: machinePrice, levelPrice: (x, y) => levelPrice(G.Fab.machineAt(x, y)), dockPrice,
    get state() {
      const rt = rates();
      return { on: S.on, fac: Math.round(rt.fac), raw: Math.round(rt.raw), share: +(rt.fac / Math.max(1, rt.raw + rt.fac)).toFixed(3), unit: unitV(),
        made: Object.assign({}, S.made), unlocked: Object.assign({}, S.unlocked), dock: S.dockLvl, dockMax: dockMax(), dockUse: +S.dockUse.toFixed(2), firstSale: S.firstSale,
        machines: machines.map(m => ({ type: m.type, x: m.x, y: m.y, rot: m.rot, lvl: m.lvl, star: m.star | 0, busy: +m.busy.toFixed(2) })), free: (() => { let n = 0; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (!grid[y][x]) n++; return n; })() };
    },
  };
})();
