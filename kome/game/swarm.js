/* Kome no Japão — swarm.js
   Enxame de robozinhos (GDD-ADENDO §12): robôs aspirador redondinhos, casco creme com faixa colorida, orelhinhas de shiba,
   luz piscando, rodinhas e uma pazinha na frente que mostra o grão. Carregam arroz grão por grão em FILA da montanha até o
   coletor: pista de ida (carregados, na frente) e pista de volta (vazios, atrás). Automação: ninguém pilota.
   Depende de: core.js, pix.js (E.PAL, E.Pix, E.sprite). Opcional: terrain.js (E.Heap) e fx.js (E.Particles).

   API (window.KomeGame.Swarm):
     const sw = Swarm.create({count, from:{x}|fn(heap)->x, to:{x,y}, heap, parts, seed, floor(x)->y, speed, carryPerBot,
                              spacing, dock, climb, max})
     sw.setCount(n)          compra/venda de lotes: os novos saem de trás do coletor; os que sobram terminam a entrega e saem
     sw.update(dt, {heap, floor, from, to, speedMul, cap})
     sw.draw(g, view{x0,x1,y0,y1}, zoom)   zoom < 0.4 = pontinhos (LOD)
     sw.onDeliver(fn(amount, x, y))        chamado no coletor (cada entrega)
     sw.onTake(fn(amount, x, y))           chamado na mordida (a mordida no heap já é feita se sw.biteArea > 0)
     sw.ev                   eventos do último update ('take','deliver','beep','dance'), no máximo 1 de cada por frame
     sw.full = true          estoque cheio: param e dançam em sincronia até voltar a false (ou cap <= 0 no update)
     sw.carryPerBot, sw.speed (px/s), sw.biteArea (px² por grão tirado da montanha), sw.count (alvo), sw.alive (na tela+garagem)
   Coordenadas: mundo (x pra direita, y pra baixo, chão em floor(x)). Internamente cada robô tem u = distância ao ponto de
   entrega (u=0 encostado no coletor, u=L na frente de corte). u<0 = "garagem" atrás do coletor (escondida). */
(function () {
  'use strict';
  const E = window.KomeEngine;
  if (!E || !E.Pix) throw new Error('swarm.js: carregue core.js e pix.js antes');
  const G = (window.KomeGame = window.KomeGame || {});
  const PAL = E.PAL, LINE = E.LINE_CSS, NO = Object.freeze({});

  /* ======================================================================
     1. Sprites (Pix, contorno LINE, cache). Base virada pra direita, 20x17, âncora (9,16) = contato com o chão.
     ====================================================================== */
  const SW = 20, SH = 17, AX = 9, AY = 16;
  const VARS = [
    { s: PAL.red, sd: PAL.redD, ear: PAL.fur, earD: PAL.furS },
    { s: PAL.bowlL, sd: PAL.bowl, ear: PAL.fur, earD: PAL.furS },
    { s: PAL.grass, sd: PAL.grassD, ear: PAL.blkL, earD: PAL.blk },
    { s: PAL.ora, sd: PAL.oraD, ear: PAL.fur, earD: PAL.furS },
    { s: PAL.sakura, sd: PAL.sakuraD, ear: PAL.cream, earD: PAL.riceD },
    { s: PAL.yel, sd: PAL.yelD, ear: PAL.fur, earD: PAL.furS },
  ];
  const NV = VARS.length;
  const SPOKE = [[-1, -1], [0, -1], [0, 0]]; // pixel claro do aro por quadro (roda 3x3 em torno de (cx-0.5, cy-0.5))
  const cache = new Array(NV * 4 * 2 * 3 * 2).fill(null);
  function sprIdx(v, carry, light, wheel, flip) { return ((((v * 4 + carry) * 2 + light) * 3 + wheel) * 2) + flip; }

  function paint(P, v, carry, light, wheel) {
    const V = VARS[v];
    // casco (domo) e saia
    P.ell(9, 9.5, 7, 5.5, PAL.cream);
    P.erase(0, 12, SW, 6);
    // orelhinhas de shiba
    P.tri(4.5, 6, 6.5, 2, 8.5, 5, V.ear); P.tri(9.5, 5, 11.5, 2, 13.5, 6, V.ear);
    P.set(6, 4, V.earD); P.set(11, 4, V.earD);
    P.ell(9, 9.5, 7, 5.5, PAL.cream); P.erase(0, 12, SW, 6);
    // sombra do casco embaixo e luz em cima-esquerda
    for (let x = 2; x < 17; x++) if (P.get(x, 10)) P.set(x, 10, PAL.riceS);
    P.set(5, 6, PAL.white); P.set(6, 5, PAL.white); P.set(7, 5, PAL.white); P.set(4, 7, PAL.white);
    // faixa colorida (2 linhas, só onde tem casco)
    for (let x = 0; x < SW; x++) { if (P.get(x, 8)) P.set(x, 8, V.s); if (P.get(x, 9)) P.set(x, 9, V.sd); }
    // para-choque
    P.rect(2, 11, 15, 1, PAL.grayL);
    // olhinho/sensor na frente
    P.rect(13, 6, 2, 2, PAL.ink); P.set(14, 6, PAL.white);
    // luz de status no topo
    P.rect(8, 3, 2, 1, light ? (carry ? PAL.goldL : PAL.grassL) : PAL.grayD);
    if (light) P.set(8, 3, PAL.white);
    // rodinhas
    for (let k = 0; k < 2; k++) {
      const cx = k ? 13 : 5;
      P.rect(cx - 1, 12, 3, 3, PAL.blk);
      P.set(cx + SPOKE[wheel][0], 13 + SPOKE[wheel][1], PAL.steel);
    }
    // pazinha (bandeja) na frente
    P.rect(15, 11, 3, 1, PAL.steelD); P.rect(16, 10, 2, 1, PAL.steel); P.set(18, 9, PAL.steelD); P.set(18, 10, PAL.steelD);
    // grãos carregados
    if (carry >= 1) P.rect(16, 9, 2, 1, PAL.rice);
    if (carry >= 2) P.set(17, 8, PAL.white);
    if (carry >= 3) P.set(15, 9, PAL.riceS), P.set(16, 8, PAL.rice);
  }
  function getSprite(v, carry, light, wheel, flip) {
    const i = sprIdx(v, carry, light, wheel, flip);
    let cv = cache[i];
    if (!cv) {
      const P = E.Pix(SW, SH);
      paint(P, v, carry, light, wheel);
      if (flip) P.mirrorX();
      cv = cache[i] = P.canvas(true);
    }
    return cv;
  }

  /* ======================================================================
     2. Enxame
     ====================================================================== */
  const ST_GO = 0, ST_TAKE = 1, ST_CARRY = 2, ST_DELIV = 3, ST_EXIT = 4;
  const laneOf = st => (st <= ST_TAKE ? 0 : 1); // 0 = volta (atrás), 1 = ida carregado (frente)
  const EV_TAKE = 1, EV_DELIV = 2, EV_BEEP = 4, EV_DANCE = 8;
  const SPRAY = { c: PAL.rice, speed: [30, 80], spread: 0.9, w: 2.4, h: 1.2, life: 0.5, g: 400 };
  const DOT_COL = VARS.map(v => v.s);

  function create(o) {
    o = o || NO;
    const MAX = o.max || 1024;
    const rnd = E.RNG(o.seed || 4242);
    // struct-of-arrays
    const U = new Float32Array(MAX), V = new Float32Array(MAX), TM = new Float32Array(MAX), WH = new Float32Array(MAX);
    const PH = new Float32Array(MAX), WOB = new Float32Array(MAX), SPIN = new Float32Array(MAX), MOV = new Float32Array(MAX);
    const PX = new Float32Array(MAX), PY = new Float32Array(MAX), SL = new Float32Array(MAX);
    const ST = new Uint8Array(MAX), CR = new Uint8Array(MAX), VR = new Uint8Array(MAX), RET = new Uint8Array(MAX), ROW = new Uint8Array(MAX);
    const ACT = new Uint8Array(MAX), TAKEN = new Uint8Array(MAX);
    const ORD = new Uint16Array(MAX), FREE = new Uint16Array(MAX);
    let n = 0, nFree = 0, serial = 0;
    for (let i = MAX - 1; i >= 0; i--) FREE[nFree++] = i;

    let heap = o.heap || null, parts = o.parts || null, from = o.from, to = o.to || { x: 0, y: 0 };
    let floorFn = o.floor || null;
    let time = 0, L = 100, sgn = 1, x0 = 0, spacing = 15, wasFull = false, beepCD = 0, fromCache = 0, fromT = 0, evf = 0;
    let delivers = [], takes = [];
    const ev = [];

    const sw = {
      ev,
      full: false,
      speed: o.speed || 58,
      carryPerBot: o.carryPerBot || 1,
      biteArea: o.biteArea !== undefined ? o.biteArea : 1.6,
      spacingMax: o.spacing || 16,
      spacingMin: 5,
      dock: o.dock !== undefined ? o.dock : 20,
      climb: o.climb !== undefined ? o.climb : 22,   // altura no talude onde mordem (from automático)
      takeTime: 0.45, deliverTime: 0.3,
      count: 0,
      stats: { taken: 0, delivered: 0 },
      get alive() { return n; },
      get length() { return L; },
      onDeliver(fn) { delivers.push(fn); return sw; },
      onTake(fn) { takes.push(fn); return sw; },
      setCount, update, draw,
      // posição (mundo) do i-ésimo robô em ordem de fila, pra debug/câmera
      at(k, out) { const i = ORD[k]; out = out || {}; out.x = PX[i]; out.y = PY[i]; out.state = ST[i]; return out; },
    };

    function floorAt(x) { return floorFn ? floorFn(x) : heap ? heap.surf(x) : (to.y || 0); }
    function carryVis() { const c = sw.carryPerBot; return c < 2 ? 1 : c < 4 ? 2 : 3; }
    function emit(f, s) { if (!(evf & f)) { evf |= f; ev.push(s); } }
    function beep() { if (beepCD <= 0) { beepCD = 0.35; emit(EV_BEEP, 'beep'); } }

    function fromX() {
      if (typeof from === 'function') return from(heap);
      if (from && from.x !== undefined) return from.x;
      if (heap) { // automático: primeiro ponto, a partir do coletor, onde o talude passa de `climb`
        if (fromT > 0) return fromCache;
        fromT = 0.25;
        const dir = heap.x0 + heap.n * heap.colW * 0.5 > to.x ? 1 : -1, step = heap.colW;
        const xa = to.x, lim = heap.n * heap.colW + Math.abs(heap.x0 - to.x) + 10;
        for (let d = 0; d < lim; d += step) { const x = xa + dir * d; if (heap.height(x) >= sw.climb) return (fromCache = x - dir * 4); }
        return (fromCache = to.x + dir * 200);
      }
      return to.x + 200;
    }

    /* ---------- quantidade ---------- */
    function spawn() {
      if (!nFree) return;
      const i = FREE[--nFree];
      let minU = -18;
      for (let k = 0; k < n; k++) { const j = ORD[k]; if (laneOf(ST[j]) === 0 && U[j] - spacing < minU) minU = U[j] - spacing; }
      U[i] = Math.min(-18, minU) - rnd() * 2; ST[i] = ST_GO; CR[i] = 0; RET[i] = 0; ACT[i] = 1; TAKEN[i] = 0;
      V[i] = 0.9 + rnd() * 0.18; PH[i] = rnd(); WH[i] = rnd() * 8; WOB[i] = 0; SPIN[i] = 0; MOV[i] = 1; TM[i] = 0;
      VR[i] = (serial * 7 + (rnd() * 3 | 0)) % NV; ROW[i] = serial & 1; serial++;
      ORD[n++] = i;
      for (let k = n - 1; k > 0 && U[ORD[k - 1]] > U[ORD[k]]; k--) { const t = ORD[k]; ORD[k] = ORD[k - 1]; ORD[k - 1] = t; }
      PX[i] = x0 + sgn * U[i]; PY[i] = floorAt(PX[i]); SL[i] = 0;
    }
    function setCount(target) {
      target = Math.max(0, Math.min(MAX, target | 0));
      let cur = 0;
      for (let k = 0; k < n; k++) if (!RET[ORD[k]]) cur++;
      if (target > cur) {
        // primeiro desfaz aposentadorias, depois cria
        for (let k = 0; k < n && cur < target; k++) { const i = ORD[k]; if (RET[i] && ST[i] !== ST_EXIT) { RET[i] = 0; cur++; } }
        while (cur < target && nFree) { spawn(); cur++; }
      } else if (target < cur) {
        // aposenta os mais perto do coletor (saem primeiro)
        for (let k = 0; k < n && cur > target; k++) { const i = ORD[k]; if (!RET[i]) { RET[i] = 1; cur--; } }
      }
      sw.count = target;
      return sw;
    }

    // lado livre na outra pista perto da posição k da ordem?
    function laneFree(k, lane) {
      const u = U[ORD[k]], gap = spacing * 0.92;
      for (let j = k - 1; j >= 0; j--) { const q = ORD[j]; if (u - U[q] >= gap) break; if (laneOf(ST[q]) === lane) return false; }
      for (let j = k + 1; j < n; j++) { const q = ORD[j]; if (U[q] - u >= gap) break; if (laneOf(ST[q]) === lane) return false; }
      return true;
    }

    function doTake(i) {
      const amt = sw.carryPerBot, x = PX[i] + sgn * 8, y = PY[i] - 4;
      if (heap && sw.biteArea > 0) heap.dig(x, sw.biteArea * Math.max(1, amt), 7, { pow: 20 });
      for (let k = 0; k < takes.length; k++) takes[k](amt, x, y);
      if (parts && (n < 80 || rnd() < 80 / n)) { SPRAY.dir = -Math.PI / 2 - sgn * 0.5; parts.spray(x, y - 2, 2, SPRAY); }
      CR[i] = carryVis(); TAKEN[i] = 1; sw.stats.taken++;
      emit(EV_TAKE, 'take');
    }
    function doDeliver(i) {
      if (CR[i]) {
        const amt = sw.carryPerBot;
        for (let k = 0; k < delivers.length; k++) delivers[k](amt, to.x, to.y !== undefined ? to.y : PY[i]);
        sw.stats.delivered += amt;
        emit(EV_DELIV, 'deliver');
      }
      CR[i] = 0; TAKEN[i] = 0;
    }

    /* ---------- update ---------- */
    function update(dt, op) {
      op = op || NO;
      ev.length = 0; evf = 0;
      if (op.heap) heap = op.heap;
      if (op.floor) floorFn = op.floor;
      if (op.from !== undefined) from = op.from;
      if (op.to) to = op.to;
      if (dt > 0.1) dt = 0.1;
      const sm = op.speedMul || 1;
      time += dt; beepCD -= dt; fromT -= dt;
      const xF = fromX();
      sgn = xF >= to.x ? 1 : -1;
      x0 = to.x + sgn * sw.dock;
      L = Math.max(24, (xF - x0) * sgn);
      const want = n > 0 ? (2 * (L + 20) * 0.9) / n : sw.spacingMax;
      spacing = Math.max(sw.spacingMin, Math.min(sw.spacingMax, want));
      const full = sw.full || (op.cap !== undefined && op.cap <= 0);
      if (full && !wasFull) emit(EV_DANCE, 'dance');
      wasFull = full;

      if (!full) {
        // ordem por u (quase ordenado: inserção é O(n))
        for (let k = 1; k < n; k++) {
          const t = ORD[k], ut = U[t]; let j = k - 1;
          while (j >= 0 && U[ORD[j]] > ut) { ORD[j + 1] = ORD[j]; j--; }
          ORD[j + 1] = t;
        }
        const base = sw.speed * sm * dt, zone = Math.min(L * 0.5, 10 + spacing * 2.2);
        // pista de volta (+u): líder = maior u
        let front = 1e9;
        for (let k = n - 1; k >= 0; k--) {
          const i = ORD[k], st = ST[i];
          if (st > ST_TAKE) continue;
          if (st === ST_TAKE) {
            TM[i] -= dt * sm;
            if (TM[i] <= 0) {
              if (!TAKEN[i]) doTake(i);
              if (laneFree(k, 1)) { ST[i] = ST_CARRY; MOV[i] = 0.3; continue; }
            }
            front = U[i]; continue;
          }
          if (RET[i] && U[i] > 0 && laneFree(k, 1)) { ST[i] = ST_CARRY; continue; } // aposentado: dá meia-volta
          const target = Math.min(L, front - spacing), step = base * V[i];
          let nu = U[i] + step;
          const blocked = nu > target;
          if (blocked) {
            nu = target;
            if (MOV[i] > 0.85 && step > 0 && rnd() < 0.12 && U[i] > 0 && target < L - 1) { WOB[i] = 0.5; beep(); }
          }
          if (nu < U[i]) nu = U[i];
          const mv = nu - U[i];
          MOV[i] += ((step > 0 ? mv / step : 0) - MOV[i]) * 0.3;
          WH[i] += mv; U[i] = nu;
          if (nu >= L - zone && target - nu < 0.6 && (nu >= L - 0.6 || blocked)) { ST[i] = ST_TAKE; TM[i] = sw.takeTime * (0.8 + rnd() * 0.4); TAKEN[i] = 0; }
          else if (!blocked && U[i] > 0 && SPIN[i] <= 0 && rnd() < dt * 0.015) { SPIN[i] = 0.8; if (rnd() < 0.5) beep(); }
          front = U[i];
        }
        // pista de ida (-u): líder = menor u
        front = -1e9;
        for (let k = 0; k < n; k++) {
          const i = ORD[k], st = ST[i];
          if (st <= ST_TAKE) continue;
          if (st === ST_DELIV) {
            TM[i] -= dt * sm;
            if (TM[i] <= 0) {
              if (TAKEN[i] || CR[i]) doDeliver(i);
              if (RET[i]) { ST[i] = ST_EXIT; }
              else if (laneFree(k, 0)) { ST[i] = ST_GO; MOV[i] = 0.3; continue; }
            }
            front = U[i]; continue;
          }
          const step = base * V[i] * (CR[i] ? 0.92 : 1);
          const target = st === ST_EXIT ? front + spacing : Math.max(0, front + spacing);
          let nu = U[i] - step;
          const blocked = nu < target;
          if (blocked) {
            nu = target;
            if (MOV[i] > 0.85 && step > 0 && rnd() < 0.12 && target > 1) { WOB[i] = 0.5; beep(); }
          }
          if (nu > U[i]) nu = U[i];
          const mv = U[i] - nu;
          MOV[i] += ((step > 0 ? mv / step : 0) - MOV[i]) * 0.3;
          WH[i] += mv; U[i] = nu;
          if (st === ST_CARRY && nu <= 0.6 && target <= 0.6) { ST[i] = ST_DELIV; TM[i] = sw.deliverTime; }
          if (st === ST_EXIT && nu < -34) { ACT[i] = 0; continue; }
          front = U[i];
        }
        // remove quem saiu (compacta ORD sem alocar)
        let w = 0;
        for (let k = 0; k < n; k++) { const i = ORD[k]; if (ACT[i]) ORD[w++] = i; else FREE[nFree++] = i; }
        n = w;
      }
      // posições de mundo + timers de personalidade
      const zig = Math.max(0, Math.min(1, (14 - spacing) / 7)) * 1.6;
      for (let k = 0; k < n; k++) {
        const i = ORD[k], x = x0 + sgn * U[i];
        PX[i] = x;
        const lane = laneOf(ST[i]);
        PY[i] = floorAt(x) + (lane ? 1.5 : -2.5) + (ROW[i] ? zig : -zig) * 0.5;
        SL[i] = U[i] > 0 && heap ? (floorAt(x + 3) - floorAt(x - 3)) / 6 : 0;
        if (WOB[i] > 0) WOB[i] -= dt;
        if (SPIN[i] > 0) SPIN[i] -= dt;
      }
      return sw;
    }

    /* ---------- desenho ---------- */
    function visible(i, view) { return U[i] > -30 && (!view || (PX[i] > view.x0 - 20 && PX[i] < view.x1 + 20)); }
    function hopY(i, full) {
      if (full) return Math.abs(Math.sin(time * 7)) * 3.2;
      let y = MOV[i] > 0.2 ? Math.max(0, Math.sin(time * 9 + PH[i] * 6.28)) * 0.6 : 0;
      if (WOB[i] > 0) y += Math.sin(WOB[i] * 25) * WOB[i] * 2;
      if (SPIN[i] > 0) y += Math.sin(SPIN[i] / 0.8 * Math.PI) * 2.5;
      return y;
    }

    function drawDots(g, view, zoom, full) {
      const r = 1.4 / zoom, o = 0.8 / zoom;
      g.fillStyle = LINE; g.beginPath();
      for (let k = 0; k < n; k++) { const i = ORD[k]; if (!visible(i, view)) continue; const y = PY[i] - hopY(i, full); g.rect(PX[i] - r - o, y - 2 * r - o, 2 * (r + o), 2 * (r + o)); }
      g.fill();
      for (let v = 0; v < NV; v++) {
        g.fillStyle = DOT_COL[v]; g.beginPath();
        for (let k = 0; k < n; k++) { const i = ORD[k]; if (VR[i] !== v || !visible(i, view)) continue; const y = PY[i] - hopY(i, full); g.rect(PX[i] - r, y - 2 * r, 2 * r, 2 * r); }
        g.fill();
      }
      const p = 0.9 / zoom;
      g.fillStyle = PAL.cream; g.beginPath();
      for (let k = 0; k < n; k++) { const i = ORD[k]; if (!visible(i, view)) continue; const y = PY[i] - hopY(i, full); g.rect(PX[i] - r, y - 2 * r, p, p); }
      g.fill();
      g.fillStyle = PAL.white; g.beginPath();
      for (let k = 0; k < n; k++) {
        const i = ORD[k]; if (!CR[i] || !visible(i, view)) continue;
        const y = PY[i] - hopY(i, full), d = ST[i] <= ST_TAKE ? sgn : -sgn;
        g.rect(PX[i] + d * (r + o) - (d < 0 ? p : 0), y - r - p, p, p);
      }
      g.fill();
    }

    function draw(g, view, zoom) {
      zoom = zoom || 1;
      if (!n) return;
      const full = sw.full || wasFull;
      if (zoom < 0.4) { drawDots(g, view, zoom, full); return; }
      // sombras no chão (um path só)
      g.fillStyle = 'rgba(59,40,24,0.22)'; g.beginPath();
      for (let k = 0; k < n; k++) { const i = ORD[k]; if (!visible(i, view)) continue; g.rect(Math.round(PX[i]) - 6, Math.round(PY[i]) - 1, 12, 2); }
      g.fill();
      const sm = g.imageSmoothingEnabled, pa = g.globalAlpha;
      g.imageSmoothingEnabled = false;
      const M = g.getTransform(), ba = M.a, bb = M.b, bc = M.c, bd = M.d, be = M.e, bf = M.f;
      let touched = false;
      // ordem: pista de trás (fileira de trás, da frente), pista da frente (idem)
      for (let pass = 0; pass < 4; pass++) {
        const lane = pass >> 1, row = pass & 1;
        for (let k = 0; k < n; k++) {
          const i = ORD[k], st = ST[i];
          if (laneOf(st) !== lane || ROW[i] !== row || !visible(i, view)) continue;
          const faceR = (lane === 0 ? sgn : -sgn) > 0;
          const light = ((time * 1.7 + PH[i]) % 1) < 0.72 ? 1 : 0;
          const wheel = ((WH[i] / 2.2) | 0) % 3;
          const cv = getSprite(VR[i], CR[i], light, faceR ? wheel : 2 - wheel, faceR ? 0 : 1);
          const x = PX[i], y = PY[i] - hopY(i, full);
          let rot = 0, sx = 1;
          if (SL[i] > 0.12 || SL[i] < -0.12) rot = Math.atan(SL[i]) * 0.8;
          if (WOB[i] > 0) rot += Math.sin(WOB[i] * 30) * WOB[i] * 0.5;
          if (full) sx = Math.cos(time * 7);
          else if (SPIN[i] > 0) sx = Math.cos((1 - SPIN[i] / 0.8) * Math.PI * 4);
          const al = U[i] < -6 ? Math.max(0, (U[i] + 30) / 24) : 1;
          if (al !== 1) g.globalAlpha = pa * al;
          const ax = faceR ? AX : SW - 1 - AX;
          if (!rot && sx === 1) {
            if (touched) { g.setTransform(ba, bb, bc, bd, be, bf); touched = false; }
            g.drawImage(cv, Math.round(x) - ax, Math.round(y) - AY);
          } else {
            const c = Math.cos(rot), s = Math.sin(rot);
            const la = c * sx, lb = s * sx, lc = -s, ld = c;
            g.setTransform(ba * la + bc * lb, bb * la + bd * lb, ba * lc + bc * ld, bb * lc + bd * ld,
              ba * x + bc * y + be, bb * x + bd * y + bf);
            touched = true;
            g.drawImage(cv, -ax, -AY);
          }
          if (al !== 1) g.globalAlpha = pa;
        }
      }
      if (touched) g.setTransform(ba, bb, bc, bd, be, bf);
      g.imageSmoothingEnabled = sm;
    }

    if (o.count) setCount(o.count);
    return sw;
  }

  G.Swarm = {
    create,
    sprite: getSprite, // (variante 0..5, grãos 0..3, luz 0/1, roda 0..2, flip 0/1) -> canvas
    VARIANTS: NV,
    SIZE: { w: SW, h: SH, ax: AX, ay: AY },
  };
})();
