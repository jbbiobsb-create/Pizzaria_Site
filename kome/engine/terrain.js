/* Kome Engine v1.0 — terrain.js
   Terreno granular: a montanha de arroz (E.Heap), pilhas pequenas que assentam (E.Pile) e grãos que voam (E.Grains).
   Depende de: core.js, pix.js

   COORDENADAS
     mundo:   x pra direita, y pra baixo; a base da montanha fica em y = heap.y0 (padrão 0), o topo é y negativo.
     altura:  "alt" = distância pra cima a partir da base (alt = y0 - y). heap.h[i] é a altura da coluna i.
     Usam ALTURA:  h, h0, matAt(i, alt), pocketAt(x, alt), pockets[].y, elipses de camada (cy), height(x).
     Usam MUNDO:   surf(x) (y do topo, negativo), digCircle(cx, cy, r, ...), bite(cx, cy, r), onTake(i, take, yTopo).

   E.Heap(opts)            montanha em colunas: cavar, depositar, avalanche por material, camadas, bolsões, desenho
   E.Pile(opts)            pilha pequena dentro de um recipiente (caçamba, carrinho, visor de silo)
   E.Grains(ps, heap, o)   grãos voando; os de depósito somam volume onde pousam ("pilha que assenta")            */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const E = (root.KomeEngine = root.KomeEngine || {});
  if (!E.U) throw new Error('KomeEngine: carregue core.js antes de terrain.js');
  if (!E.PAL || !E.Draw) throw new Error('KomeEngine: carregue pix.js antes de terrain.js');
  const U = E.U, PAL = E.PAL, Draw = E.Draw, TAU = Math.PI * 2;
  const LINE = PAL.line || '#3B2818';
  const NO = Object.freeze({});
  const SHADE = '40,20,8';           // marrom das sombras (rgb)
  const HILITE = '#FFFFFF';

  /* ======================================================================
     0. Utilidades internas
     ====================================================================== */
  // hash barato e determinístico 0..1 (sem alocar)
  function hs(n) { const v = Math.sin(n * 127.1 + 11.7) * 43758.5453; return v - Math.floor(v); }
  function clampi(v, a, b) { return v < a ? a : v > b ? b : v; }

  // textura de grãos cacheada pelo conjunto de cores (Draw.pattern); kind: 'grain' | 'packed' | 'mochi' | 'gold'
  const TEX = {
    grain: { size: 64, n: 190, shape: 'grain' },
    packed: { size: 64, n: 380, shape: 'grain' },
    mochi: { size: 64, n: 150, shape: 'dots' },
    gold: { size: 64, n: 300, shape: 'grain' },
  };
  function texture(g, base, c2, c3, kind) {
    const t = typeof kind === 'object' && kind ? kind : (TEX[kind] || TEX.grain);
    return Draw.pattern(g, 'kome-terrain:' + base + c2 + c3 + t.shape + t.n + ':' + t.size, base, c2, c3, t);
  }

  // escala de textura (LOD): o padrão é esticado em potências de 2 pra o grão nunca virar ruído de 1 px
  const mats = new Map();
  function patScale(p, k) {
    if (!p || !p.setTransform || p._k === k) return;
    let m = mats.get(k);
    if (!m) { if (typeof DOMMatrix === 'undefined') return; m = new DOMMatrix().scale(k, k); mats.set(k, m); }
    p.setTransform(m); p._k = k;
  }

  // vetores de rascunho compartilhados pelo desenho (crescem sob demanda; nada é alocado por frame)
  let CAP = 0, PX, PA, PY, PT, PO, PRE, PI_;
  function ensure(m) {
    if (m <= CAP) return;
    CAP = Math.ceil(m * 1.25) + 16;
    PX = new Float32Array(CAP); PA = new Float32Array(CAP); PY = new Float32Array(CAP); PT = new Float32Array(CAP);
    PO = new Float32Array(CAP); PRE = new Float64Array(CAP + 1); PI_ = new Int32Array(CAP);
  }

  // traça PX/Y de a até b; smooth = curva passando pelos pontos médios (cantos gordinhos); cont = continua o caminho atual
  function run(g, Y, a, b, smooth, cont) {
    if (cont) g.lineTo(PX[a], Y[a]); else g.moveTo(PX[a], Y[a]);
    if (smooth && b - a > 1) {
      g.lineTo((PX[a] + PX[a + 1]) * 0.5, (Y[a] + Y[a + 1]) * 0.5);
      for (let k = a + 1; k < b; k++) g.quadraticCurveTo(PX[k], Y[k], (PX[k] + PX[k + 1]) * 0.5, (Y[k] + Y[k + 1]) * 0.5);
      g.lineTo(PX[b], Y[b]);
    } else for (let k = a + 1; k <= b; k++) g.lineTo(PX[k], Y[k]);
  }
  // o mesmo, de trás pra frente (fecha polígonos de faixa)
  function runBack(g, Y, a, b, smooth) {
    g.lineTo(PX[b], Y[b]);
    if (smooth && b - a > 1) {
      g.lineTo((PX[b] + PX[b - 1]) * 0.5, (Y[b] + Y[b - 1]) * 0.5);
      for (let k = b - 1; k > a; k--) g.quadraticCurveTo(PX[k], Y[k], (PX[k] + PX[k - 1]) * 0.5, (Y[k] + Y[k - 1]) * 0.5);
      g.lineTo(PX[a], Y[a]);
    } else for (let k = b - 1; k >= a; k--) g.lineTo(PX[k], Y[k]);
  }
  // estrelinha de 4 pontas (brilho) no caminho atual
  function star(g, x, y, r) {
    const q = r * 0.2;
    g.moveTo(x, y - r); g.lineTo(x + q, y - q); g.lineTo(x + r, y); g.lineTo(x + q, y + q);
    g.lineTo(x, y + r); g.lineTo(x - q, y + q); g.lineTo(x - r, y); g.lineTo(x - q, y - q); g.closePath();
  }

  /* ======================================================================
     1. E.Heap — montanha granular em colunas
     ====================================================================== */
  const DEF_LAYER = { id: 'solto', name: 'Arroz Solto', hard: 1, val: 1, col: '#F6F1E4' };

  // E.Heap({width|n, colW=4, x0=0, y0=0, repose=3.6, relaxIters=2, minK=0.4, goldMult=8, flowRate=0.3}) -> heap
  function Heap(opts) {
    opts = opts || NO;
    const colW = opts.colW || 4;
    const n = Math.max(2, opts.n || Math.ceil((opts.width || 960) / colW));
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0;
    const h = new Float32Array(n), h0 = new Float32Array(n);
    const act = new Float32Array(n);                 // atividade de avalanche por coluna (decai); alimenta os grãos rolando
    let bands = [], ells = [];                       // camadas compiladas
    let actLo = n, actHi = -1;                       // faixa de colunas que ainda pode deslizar
    let flowLo = n, flowHi = -1;                     // faixa com 'act' > 0
    let relaxAcc = 0, sweepDir = 1, peakDirty = true;
    const peakOut = { x: 0, h: 0, i: 0 };
    const res = { got: 0, val: 0, gold: 0, hard: 1, blocked: 0, byMat: {}, pocket: null, cols: 0 };
    let cbTake = null, digPow = 1;
    let hazeGrad = null, hazeKey = '';

    const heap = {
      n, colW, x0, y0, h, h0, act,
      width: n * colW,
      total: 0,            // área original (px²)
      area: 0,             // área atual (px²), mantida incrementalmente
      repose: opts.repose || 3.6,          // desnível máx. por coluna quando a camada não define 'slope'
      relaxIters: opts.relaxIters || 2,    // varreduras de avalanche por frame de 60 fps
      flowRate: opts.flowRate || 0.3,      // fração do excesso que escorre por varredura
      minK: opts.minK !== undefined ? opts.minK : 0.4, // pow/hard abaixo disso = não cava ("duro demais")
      goldMult: opts.goldMult || 8,        // multiplicador padrão dos bolsões
      layers: [],          // camadas normalizadas (ordem: superfície -> fundo; elipses por último)
      pockets: [],         // bolsões dourados
      flow: 0,             // área (px²) que escorreu no último relax()
      flowX: 0,            // x médio (mundo) de onde escorreu
      active: false,       // ainda tem avalanche rolando?
      onPocket: opts.onPocket || null,     // fn(pocket) na primeira vez que a cavada encosta num bolsão
      stats: { pts: 0, step: 1, lod: 1 },  // do último draw()

      /* ---------- forma ---------- */
      // generate(fn(x)->altura, {maxSlope}): define a forma original; maxSlope (px/coluna) apara encostas íngremes demais
      generate(fn, o) {
        for (let i = 0; i < n; i++) { const v = +fn(x0 + (i + 0.5) * colW, i); h[i] = v > 0 ? v : 0; }
        if (o && o.maxSlope > 0) limitSlope(o.maxSlope);
        return commitShape();
      },
      // fromArray(arr, {maxSlope}): alturas originais a partir de um vetor (reamostra se o tamanho for outro)
      fromArray(arr, o) {
        const m = arr.length;
        for (let i = 0; i < n; i++) {
          if (m === n) h[i] = Math.max(0, +arr[i] || 0);
          else { const f = (i / (n - 1)) * (m - 1), a = Math.floor(f), b = Math.min(m - 1, a + 1); h[i] = Math.max(0, U.lerp(+arr[a] || 0, +arr[b] || 0, f - a)); }
        }
        if (o && o.maxSlope > 0) limitSlope(o.maxSlope);
        return commitShape();
      },
      // reset(): volta à forma original (bolsões voltam a ficar "não achados")
      reset() {
        h.set(h0); heap.area = heap.total; act.fill(0);
        actLo = n; actHi = -1; flowLo = n; flowHi = -1; heap.active = false; heap.flow = 0; peakDirty = true;
        for (let k = 0; k < heap.pockets.length; k++) { heap.pockets[k].found = false; heap.pockets[k].flash = 0; }
        return heap;
      },
      // settle(maxSweeps=4000) -> varreduras usadas: roda a avalanche até parar (use depois de gerar, antes de jogar)
      settle(maxSweeps) {
        const cap = maxSweeps || 4000; let k = 0;
        mark(0, n - 1);
        while (k < cap && actLo <= actHi) { sweep(); k++; }
        act.fill(0); flowLo = n; flowHi = -1; heap.flow = 0; heap.active = actLo <= actHi;
        return k;
      },

      /* ---------- consultas ---------- */
      // col(x) -> índice da coluna (limitado a 0..n-1)
      col(x) { return clampi(Math.floor((x - x0) / colW), 0, n - 1); },
      // colX(i) -> x do centro da coluna i
      colX(i) { return x0 + (i + 0.5) * colW; },
      // height(x) -> altura da coluna em x (0 fora da montanha)
      height(x) { const i = Math.floor((x - x0) / colW); return i < 0 || i >= n ? 0 : h[i]; },
      // surf(x) -> y de mundo do topo em x (negativo pra cima; interpolado entre colunas, bom pra andar em cima)
      surf(x) {
        const f = (x - x0) / colW - 0.5, i = Math.floor(f);
        if (i < 0) return y0 - (i < -1 ? 0 : h[0] * (f + 1));
        if (i >= n - 1) return y0 - (i >= n ? 0 : h[n - 1] * (1 - (f - (n - 1))));
        return y0 - (h[i] + (h[i + 1] - h[i]) * (f - i));
      },
      // alt(y) -> altura acima da base a partir de um y de mundo
      alt(y) { return y0 - y; },
      // slope(x) -> inclinação dy/dx da superfície em x (positivo = sobe pra direita)
      slope(x) {
        const i = heap.col(x), a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        return b > a ? (h[b] - h[a]) / ((b - a) * colW) : 0;
      },
      // peak() -> {x, h, i} ponto mais alto (objeto reaproveitado)
      peak() {
        if (peakDirty) {
          let bi = 0, bh = -1;
          for (let i = 0; i < n; i++) if (h[i] > bh) { bh = h[i]; bi = i; }
          peakOut.i = bi; peakOut.h = bh; peakOut.x = x0 + (bi + 0.5) * colW; peakDirty = false;
        }
        return peakOut;
      },
      // remaining() -> área (px²) que ainda existe
      remaining() { return heap.area; },
      // frac() -> 0..1 do volume original que ainda existe
      frac() { return heap.total > 0 ? Math.max(0, heap.area / heap.total) : 0; },
      // dugAt(x) -> quanto a coluna em x já baixou em relação à original (negativo = pilha cresceu)
      dugAt(x) { const i = heap.col(x); return h0[i] - h[i]; },

      /* ---------- camadas ---------- */
      // setLayers([{id,name,hard=1,val=1,slope,col,col2,col3,tex, top | d0,d1 | ellipse:{cx,cy,rx,ry}}]) da superfície pro fundo
      //   top = fração da altura original onde a camada começa (a 1ª vale 1) ; d0/d1 = profundidade absoluta abaixo da
      //   superfície original ; ellipse = região (cx em mundo, cy em altura) que passa por cima das outras
      setLayers(list) {
        heap.layers.length = 0; bands = []; ells = [];
        for (let k = 0; k < list.length; k++) {
          const s = list[k], col = s.col || DEF_LAYER.col;
          const L = Object.assign({}, s, {
            idx: k, id: s.id !== undefined ? s.id : 'l' + k, name: s.name || String(s.id || k),
            hard: s.hard || 1, val: s.val !== undefined ? s.val : 1, slope: s.slope || heap.repose,
            col, col2: s.col2 || U.shade(col, -0.16), col3: s.col3 || U.shade(col, 0.55),
            line: s.line || U.shade(col, -0.34),
            tex: s.tex || (s.ellipse ? 'gold' : (s.hard || 1) >= 6 ? 'mochi' : (s.hard || 1) >= 2 ? 'packed' : 'grain'),
            kind: s.ellipse ? 'ellipse' : 'band', hi: new Float32Array(n), lo: new Float32Array(n), pat: null,
          });
          heap.layers.push(L);
          (L.kind === 'ellipse' ? ells : bands).push(L);
        }
        if (!bands.length) { heap.setLayers([DEF_LAYER].concat(list)); return heap; }
        res.byMat = {};
        for (let k = 0; k < heap.layers.length; k++) res.byMat[heap.layers[k].id] = 0;
        compile();
        return heap;
      },
      // matAt(i, alt) -> camada (material) na coluna i e altura alt
      matAt,
      // layerTop(layer|id, x) -> altura do topo da camada na coluna de x (original, sem considerar o que já foi cavado)
      layerTop(L, x) { L = typeof L === 'object' ? L : heap.layer(L); return L ? L.hi[heap.col(x)] : 0; },
      // layer(id) -> camada normalizada
      layer(id) { for (let k = 0; k < heap.layers.length; k++) if (heap.layers[k].id === id) return heap.layers[k]; return null; },
      // surfaceMat(x) -> material exposto no topo da coluna em x
      surfaceMat(x) { const i = heap.col(x); return matAt(i, h[i] - 0.01); },

      /* ---------- bolsões ---------- */
      // addPocket({x, y (altura), r, mult=goldMult, kind='gold'}) -> pocket
      addPocket(p) {
        const q = Object.assign({ x: 0, y: 0, r: 30, mult: 0, kind: 'gold', found: false, flash: 0 }, p);
        q.seed = heap.pockets.length * 13.37 + q.x * 0.01;
        q.shape = new Float32Array(10);
        for (let k = 0; k < 10; k++) q.shape[k] = 0.84 + 0.2 * hs(q.seed + k * 3.1);
        heap.pockets.push(q);
        return q;
      },
      // scatterPockets({n=28, r:[35,90], minDepth=60, mult, seed=7, x0, x1, kind}) -> lista: espalha bolsões dentro da montanha
      scatterPockets(o) {
        o = o || NO;
        const r = E.RNG(o.seed !== undefined ? o.seed : 7), cnt = o.n || 28, rr = o.r || [35, 90], md = o.minDepth !== undefined ? o.minDepth : 60;
        const xa = o.x0 !== undefined ? o.x0 : x0, xb = o.x1 !== undefined ? o.x1 : x0 + n * colW;
        let tries = cnt * 40;
        while (heap.pockets.length < cnt && tries-- > 0) {
          const pr = rr[0] + r() * (rr[1] - rr[0]), px = xa + r() * (xb - xa), i = heap.col(px);
          const room = h0[i] - md - pr * 2;
          if (room <= 0) continue;
          const py = pr + r() * room;
          let ok = true;
          for (let k = 0; k < heap.pockets.length && ok; k++) { const q = heap.pockets[k]; if (U.dist(px, py, q.x, q.y) < (pr + q.r) * 1.15) ok = false; }
          if (ok) heap.addPocket({ x: px, y: py, r: pr, mult: o.mult || 0, kind: o.kind || 'gold' });
        }
        return heap.pockets;
      },
      // pocketAt(x, alt) -> bolsão que contém o ponto, ou null
      pocketAt(x, alt) {
        const P = heap.pockets;
        for (let k = 0; k < P.length; k++) {
          const p = P[k], dx = x - p.x;
          if (dx > p.r || dx < -p.r) continue;
          const dy = alt - p.y;
          if (dx * dx + dy * dy < p.r * p.r) return p;
        }
        return null;
      },

      /* ---------- cavar / depositar ---------- */
      // dig(cx, area, rad, {pow=1, onTake(i, take, yTopo)}) -> {got, val, gold, hard, blocked, byMat, pocket, cols}
      //   perfil parabólico; 'area' é o esforço (px²) a 100%; material duro rende pow/hard (ou nada abaixo de minK).
      //   hard = maior hard/pow encontrado (>=1); blocked = esforço que bateu em material duro demais.
      //   ATENÇÃO: o objeto devolvido é reaproveitado a cada chamada (copie os números se for guardar).
      dig(cx, area, rad, o) {
        begin(o);
        if (!(area > 0)) return res;
        rad = Math.max(rad, colW * 0.5);
        const i0 = Math.max(0, Math.ceil((cx - rad - x0) / colW - 0.5)), i1 = Math.min(n - 1, Math.floor((cx + rad - x0) / colW - 0.5));
        let ws = 0;
        for (let i = i0; i <= i1; i++) { const d = (x0 + (i + 0.5) * colW - cx) / rad; if (d > -1 && d < 1) ws += 1 - d * d; }
        if (ws <= 0) {
          const i = Math.floor((cx - x0) / colW);
          if (i >= 0 && i < n) { takeCol(i, area / colW, 0); end(i, i); }
          return res;
        }
        for (let i = i0; i <= i1; i++) {
          const d = (x0 + (i + 0.5) * colW - cx) / rad;
          if (d <= -1 || d >= 1 || h[i] <= 0) continue;
          takeCol(i, area * (1 - d * d) / ws / colW, 0);
        }
        end(i0, i1);
        return res;
      },
      // digCircle(cx, cy, r, area, {pow=1, onTake}) -> mesmo retorno do dig (+ res.cols)
      //   corte da roda de caçambas: colunas no vão da roda perdem altura por cima, com peso pela sobreposição com o
      //   círculo; nunca desce abaixo do fundo do círculo (o arroz acima da roda "cai dentro"). cy em y de mundo.
      digCircle(cx, cy, r, area, o) {
        begin(o);
        if (!(area > 0) || !(r > 0)) return res;
        const i0 = Math.max(0, Math.ceil((cx - r - x0) / colW - 0.5)), i1 = Math.min(n - 1, Math.floor((cx + r - x0) / colW - 0.5));
        const ca = y0 - cy;
        let ws = 0;
        for (let i = i0; i <= i1; i++) {
          const dx = x0 + (i + 0.5) * colW - cx, ov = h[i] - (ca - Math.sqrt(Math.max(0, r * r - dx * dx)));
          if (ov > 0) ws += ov;
        }
        if (ws <= 0) return res;
        for (let i = i0; i <= i1; i++) {
          const dx = x0 + (i + 0.5) * colW - cx, fl = Math.max(0, ca - Math.sqrt(Math.max(0, r * r - dx * dx))), ov = h[i] - fl;
          if (ov > 0) takeCol(i, area * ov / ws / colW, fl);
        }
        end(i0, i1);
        return res;
      },
      // digRect(xa, xb, depth, {pow=1, onTake, floor}) -> mesmo retorno: tira até 'depth' px do topo de cada coluna do vão
      //   (garfo da empilhadeira); floor = altura mínima opcional
      digRect(xa, xb, depth, o) {
        begin(o);
        if (!(depth > 0)) return res;
        const i0 = Math.max(0, Math.ceil((xa - x0) / colW - 0.5)), i1 = Math.min(n - 1, Math.floor((xb - x0) / colW - 0.5));
        const fl = o && o.floor > 0 ? o.floor : 0;
        for (let i = i0; i <= i1; i++) if (h[i] > fl) takeCol(i, depth, Math.max(fl, h[i] - depth));
        end(i0, i1);
        return res;
      },
      // bite(cx, cy, r, dir=1, samples=12) -> 0..1: fração enterrada do semicírculo da frente da roda (dir = lado da frente)
      bite(cx, cy, r, dir, samples) {
        const m = samples || 12; let c = 0;
        for (let k = 0; k < m; k++) {
          const a = -Math.PI / 2 + Math.PI * (k + 0.5) / m, px = cx + Math.cos(a) * r * (dir < 0 ? -1 : 1), py = cy + Math.sin(a) * r;
          if (py > heap.surf(px)) c++;
        }
        return c / m;
      },
      // add(x, area, rad=colW*2): deposita 'area' px² em volta de x (perfil parabólico); a avalanche espalha depois
      add(x, area, rad) {
        if (!(area > 0)) return heap;
        rad = Math.max(rad || colW * 2, colW * 0.5);
        const i0 = Math.max(0, Math.ceil((x - rad - x0) / colW - 0.5)), i1 = Math.min(n - 1, Math.floor((x + rad - x0) / colW - 0.5));
        let ws = 0;
        for (let i = i0; i <= i1; i++) { const d = (x0 + (i + 0.5) * colW - x) / rad; if (d > -1 && d < 1) ws += 1 - d * d; }
        if (ws <= 0) {
          const i = Math.floor((x - x0) / colW);
          if (i < 0 || i >= n) return heap;
          h[i] += area / colW; heap.area += area; mark(i - 1, i + 1); peakDirty = true;
          return heap;
        }
        for (let i = i0; i <= i1; i++) {
          const d = (x0 + (i + 0.5) * colW - x) / rad;
          if (d > -1 && d < 1) h[i] += area * (1 - d * d) / ws / colW;
        }
        heap.area += area; mark(i0 - 1, i1 + 1); peakDirty = true;
        return heap;
      },
      // level(xa, xb, rate=1): alisa a faixa em direção à média (esteiras achatando o arroz embaixo); conserva volume
      level(xa, xb, rate) {
        const i0 = heap.col(xa), i1 = heap.col(xb); if (i1 <= i0) return heap;
        let s = 0; for (let i = i0; i <= i1; i++) s += h[i];
        const avg = s / (i1 - i0 + 1), k = rate === undefined ? 1 : U.clamp(rate, 0, 1);
        for (let i = i0; i <= i1; i++) h[i] += (avg - h[i]) * k;
        mark(i0 - 1, i1 + 1); peakDirty = true;
        return heap;
      },
      // touch(xa, xb): acorda a avalanche numa faixa (se você mexer em heap.h na mão)
      touch(xa, xb) { mark(heap.col(xa) - 1, heap.col(xb) + 1); peakDirty = true; heap.area = sum(h) * colW; return heap; },

      /* ---------- avalanche ---------- */
      // relax(dt) -> área que escorreu: avalanche (cada material tem seu 'slope'); custa ~zero quando nada se mexe
      relax(dt) {
        if (dt === undefined) dt = 1 / 60;
        const P = heap.pockets;
        for (let k = 0; k < P.length; k++) if (P[k].flash > 0) P[k].flash = Math.max(0, P[k].flash - dt * 2.5);
        // atividade decai
        if (flowLo <= flowHi) {
          const dec = Math.exp(-dt * 5);
          for (let i = flowLo; i <= flowHi; i++) act[i] *= dec;
          while (flowLo <= flowHi && act[flowLo] < 0.02) act[flowLo++] = 0;
          while (flowHi >= flowLo && act[flowHi] < 0.02) act[flowHi--] = 0;
          if (flowLo > flowHi) { flowLo = n; flowHi = -1; }
        }
        heap.flow = 0;
        if (actLo > actHi) { heap.active = false; relaxAcc = 0; return 0; }
        relaxAcc += dt * 60 * heap.relaxIters;
        let it = Math.floor(relaxAcc);
        relaxAcc -= it;
        if (it > 8) { it = 8; relaxAcc = 0; }
        let moved = 0, mx = 0;
        for (let k = 0; k < it && actLo <= actHi; k++) { moved += sweep(); mx += sweepX; }
        heap.flow = moved * colW;
        if (moved > 0) { heap.flowX = x0 + (mx / moved + 0.5) * colW; peakDirty = true; }
        heap.active = actLo <= actHi;
        return heap.flow;
      },

      /* ---------- salvar ---------- */
      // serialize({full=false}) -> string compacta 'KH1|n|a|b|escala|base64(Uint16)|bolsões': só a faixa que mudou
      serialize(o) {
        let a = 0, b = n;
        if (!(o && o.full)) {
          while (a < n && Math.abs(h[a] - h0[a]) < 0.02) a++;
          while (b > a && Math.abs(h[b - 1] - h0[b - 1]) < 0.02) b--;
        }
        let mxh = 0;
        for (let i = a; i < b; i++) if (h[i] > mxh) mxh = h[i];
        const sc = mxh > 0 ? 65535 / mxh : 1;
        let bin = '';
        for (let i = a; i < b; i++) { const v = Math.round(h[i] * sc); bin += String.fromCharCode(v & 255, v >> 8); }
        let pk = '';
        for (let k = 0; k < heap.pockets.length; k++) pk += heap.pockets[k].found ? '1' : '0';
        return 'KH1|' + n + '|' + a + '|' + b + '|' + (+sc.toPrecision(9)) + '|' + btoa(bin) + '|' + pk;
      },
      // deserialize(str|array) -> true/false: restaura as alturas (a forma original e as camadas precisam já estar definidas)
      deserialize(s) {
        if (s && typeof s !== 'string' && s.length !== undefined) {
          if (s.length !== n) return false;
          for (let i = 0; i < n; i++) h[i] = Math.max(0, +s[i] || 0);
        } else {
          const p = String(s || '').split('|');
          if (p[0] !== 'KH1' || +p[1] !== n) return false;
          const a = +p[2], b = +p[3], sc = +p[4] || 1;
          let bin;
          try { bin = atob(p[5] || ''); } catch (e) { return false; }
          if (!(a >= 0 && b <= n && a <= b) || bin.length !== (b - a) * 2) return false;
          h.set(h0);
          for (let i = a, j = 0; i < b; i++, j += 2) h[i] = (bin.charCodeAt(j) | (bin.charCodeAt(j + 1) << 8)) / sc;
          const pk = p[6] || '';
          for (let k = 0; k < heap.pockets.length; k++) heap.pockets[k].found = pk.charAt(k) === '1';
        }
        heap.area = sum(h) * colW; act.fill(0); flowLo = n; flowHi = -1; peakDirty = true;
        mark(0, n - 1);
        return true;
      },

      /* ---------- desenho ---------- */
      // draw(g, view{x0,x1,y0,y1}, time, {outline=true, sparkle=true, pockets=true, shade=true, roll=true, haze, zoom, smooth})
      //   g já com a câmera aplicada. haze = alpha (0..1) ou {col, top, base}: névoa de distância pra montanhas enormes.
      //   zoom = px de tela por unidade de mundo (se omitido, lê do transform do contexto).
      draw,
    };

    /* ---------- internos: forma ---------- */
    function sum(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; }
    function limitSlope(ms) {
      for (let i = 1; i < n; i++) if (h[i] > h[i - 1] + ms) h[i] = h[i - 1] + ms;
      for (let i = n - 2; i >= 0; i--) if (h[i] > h[i + 1] + ms) h[i] = h[i + 1] + ms;
    }
    function commitShape() {
      h0.set(h);
      heap.total = heap.area = sum(h) * colW;
      act.fill(0); actLo = n; actHi = -1; flowLo = n; flowHi = -1; peakDirty = true; heap.active = false;
      if (!heap.layers.length) heap.setLayers([DEF_LAYER]); else compile();
      return heap;
    }
    function mark(a, b) {
      if (a < 0) a = 0; if (b > n - 1) b = n - 1;
      if (a < actLo) actLo = a; if (b > actHi) actHi = b;
      heap.active = true;
    }

    /* ---------- internos: camadas ---------- */
    // calcula, por coluna, o topo (hi) e o fundo (lo) de cada camada em altura
    function compile() {
      for (let i = 0; i < n; i++) {
        const H = h0[i];
        let prev = 1e9;
        for (let k = 0; k < bands.length; k++) {
          const L = bands[k];
          let top;
          if (L.d0 !== undefined) top = H - L.d0;
          else if (L.top !== undefined) top = H * L.top;
          else top = k === 0 ? H : prev;
          if (k === 0) top = 1e9;               // a 1ª camada vai até o céu (o que for depositado em cima é dela)
          if (top > prev) top = prev;
          if (top < 0) top = 0;
          L.hi[i] = top; prev = top;
        }
        for (let k = 0; k < bands.length; k++) bands[k].lo[i] = k + 1 < bands.length ? bands[k + 1].hi[i] : 0;
        const x = x0 + (i + 0.5) * colW;
        for (let k = 0; k < ells.length; k++) {
          const L = ells[k], e = L.ellipse, d = (x - e.cx) / e.rx;
          if (d <= -1 || d >= 1) { L.hi[i] = -1; L.lo[i] = -1; continue; }
          const hy = e.ry * Math.sqrt(1 - d * d);
          const lo = Math.max(0, e.cy - hy), hi = Math.min(H, e.cy + hy);
          if (hi <= lo) { L.hi[i] = -1; L.lo[i] = -1; } else { L.hi[i] = hi; L.lo[i] = lo; }
        }
      }
    }
    function matAt(i, y) {
      for (let k = ells.length - 1; k >= 0; k--) { const L = ells[k]; if (y < L.hi[i] && y >= L.lo[i]) return L; }
      for (let k = bands.length - 1; k > 0; k--) if (y < bands[k].hi[i]) return bands[k];
      return bands[0];
    }
    // fundo do trecho contínuo do material m que contém a altura y na coluna i
    function segBottom(i, y, m) {
      if (m.kind === 'ellipse') return m.lo[i];
      let b = m.lo[i];
      for (let k = 0; k < ells.length; k++) { const t = ells[k].hi[i]; if (t > b && t < y) b = t; }
      return b;
    }

    /* ---------- internos: cavar ---------- */
    function begin(o) {
      res.got = res.val = res.gold = res.blocked = 0; res.hard = 1; res.pocket = null; res.cols = 0;
      for (const k in res.byMat) res.byMat[k] = 0;
      digPow = (o && o.pow) || 1; cbTake = (o && o.onTake) || null;
    }
    function end(i0, i1) {
      if (res.got > 0) { heap.area -= res.got; mark(i0 - 1, i1 + 1); peakDirty = true; }
      cbTake = null;
    }
    // tira até 'hb' px (a 100%) do topo da coluna i, sem passar de 'floor'; atravessa materiais
    function takeCol(i, hb, floor) {
      let guard = 6, took = 0;
      const top = h[i], x = x0 + (i + 0.5) * colW;
      while (hb > 1e-5 && h[i] > floor + 1e-4 && guard-- > 0) {
        const y = h[i], m = matAt(i, y - 0.001), k = digPow / m.hard;
        const r = m.hard / digPow;
        if (r > res.hard) res.hard = r;
        const eff = k >= 1 ? 1 : k >= heap.minK ? k : 0;
        if (eff <= 0) { res.blocked += hb * colW; break; }
        let bot = segBottom(i, y - 0.001, m);
        if (bot < floor) bot = floor;
        let can = hb * eff;
        if (can > y - bot) can = y - bot;
        if (can <= 0) break;
        h[i] = y - can; hb -= can / eff; took += can;
        const a = can * colW;
        let mult = 1;
        if (heap.pockets.length) {
          const p = heap.pocketAt(x, y - can * 0.5);
          if (p) {
            mult = p.mult || heap.goldMult; res.gold += a; res.pocket = p;
            if (!p.found) { p.found = true; p.flash = 1; if (heap.onPocket) heap.onPocket(p); }
          }
        }
        res.got += a; res.val += a * m.val * mult;
        res.byMat[m.id] = (res.byMat[m.id] || 0) + a;
      }
      if (took > 0) { res.cols++; if (cbTake) cbTake(i, took, y0 - top); }
    }

    /* ---------- internos: avalanche ---------- */
    let sweepX = 0;
    // uma varredura na faixa ativa; devolve a altura total transferida (e sweepX = Σ índice*transferência)
    function sweep() {
      const rate = heap.flowRate, EPS = 0.03;
      const a = Math.max(0, actLo - 1), b = Math.min(n - 2, actHi);
      let lo = n, hi = -1, moved = 0; sweepX = 0;
      const dir = sweepDir; sweepDir = -sweepDir;
      for (let i = dir > 0 ? a : b; dir > 0 ? i <= b : i >= a; i += dir) {
        const d = h[i] - h[i + 1];
        if (d > EPS) {
          const m = matAt(i, h[i] - 0.01).slope;
          if (d > m + EPS) {
            const t = (d - m) * rate; h[i] -= t; h[i + 1] += t; moved += t; sweepX += t * i; act[i + 1] += t; act[i] += t * 0.5;
            if (i < lo) lo = i; if (i + 1 > hi) hi = i + 1;
          }
        } else if (d < -EPS) {
          const m = matAt(i + 1, h[i + 1] - 0.01).slope;
          if (-d > m + EPS) {
            const t = (-d - m) * rate; h[i] += t; h[i + 1] -= t; moved += t; sweepX += t * i; act[i] += t; act[i + 1] += t * 0.5;
            if (i < lo) lo = i; if (i + 1 > hi) hi = i + 1;
          }
        }
      }
      if (hi < 0) { actLo = n; actHi = -1; }
      else {
        actLo = Math.max(0, lo - 1); actHi = Math.min(n - 1, hi + 1);
        if (actLo < flowLo) flowLo = actLo; if (actHi > flowHi) flowHi = actHi;
      }
      return moved;
    }

    /* ---------- internos: desenho ---------- */
    function layerPat(g, L) { return L.pat || (L.pat = texture(g, L.col, L.col2, L.col3, L.tex)); }
    let goldPat = null;

    // preenche o caminho atual com a textura no LOD k0 e, se bl>0, mistura o LOD seguinte por cima
    function fillTex(g, p, k0, bl, rule) {
      patScale(p, k0); g.fillStyle = p;
      if (rule) g.fill(rule); else g.fill();
      if (bl > 0) { const pa = g.globalAlpha; g.globalAlpha = pa * bl; patScale(p, k0 * 2); g.fillStyle = p; if (rule) g.fill(rule); else g.fill(); g.globalAlpha = pa; }
    }

    function draw(g, view, time, o) {
      o = o || NO; time = time || 0;
      let z = o.zoom;
      if (!z) { const tr = g.getTransform(); z = Math.sqrt(tr.a * tr.a + tr.b * tr.b) || 1; }
      const pxw = 1 / z;                                   // unidades de mundo por pixel do canvas
      const u = Math.max(1, pxw * 1.6);                    // "1 px de arte" que nunca some no zoom longe
      const vx0 = view ? view.x0 : x0, vx1 = view ? view.x1 : x0 + n * colW;
      const vy1 = view && view.y1 !== undefined ? Math.min(view.y1 + 4 * u, y0) : y0;   // base visível
      const WIN = 9;                                       // janela (em pontos) da oclusão dos buracos

      /* --- 1. decimação: um ponto por grupo de 'step' colunas (média), alinhado em múltiplos de step --- */
      const step = Math.max(1, Math.floor(pxw * 1.6 / colW));
      let i0 = Math.floor((vx0 - x0) / colW) - step * (WIN + 1), i1 = Math.ceil((vx1 - x0) / colW) + step * (WIN + 1);
      if (i1 < 0 || i0 > n - 1) return;
      i0 = Math.max(0, i0); i0 -= i0 % step; i1 = Math.min(n - 1, i1);
      const cnt = Math.floor((i1 - i0) / step) + 1;
      ensure(cnt + 4);
      let m = 0, maxA = 0;
      PRE[0] = 0;
      for (let i = i0; i <= i1; i += step) {
        const e = Math.min(n, i + step);
        let s = 0;
        for (let j = i; j < e; j++) s += h[j];
        s /= e - i;
        PX[m] = x0 + (i + e) * 0.5 * colW; PA[m] = s; PY[m] = y0 - s; PI_[m] = (i + e) >> 1;
        PRE[m + 1] = PRE[m] + s;
        if (s > maxA) maxA = s;
        m++;
      }
      heap.stats.pts = m; heap.stats.step = step;
      if (m < 2 || maxA <= 0) return;
      const smooth = o.smooth !== undefined ? o.smooth : colW * step * z > 3;
      const last = m - 1;

      /* --- 2. LOD da textura --- */
      const lf = Math.max(0, Math.log2(0.8 * pxw * (o.grain || 1)));
      const k0 = Math.pow(2, Math.floor(lf)), fr = lf - Math.floor(lf), bl = fr > 0.6 ? (fr - 0.6) / 0.4 : 0;
      heap.stats.lod = k0;

      g.save();
      g.lineJoin = 'round'; g.lineCap = 'round';

      /* --- 3. corpo (camada de cima) + recorte --- */
      g.beginPath();
      g.moveTo(PX[0], vy1);
      run(g, PY, 0, last, smooth, true);
      g.lineTo(PX[last], vy1);
      g.closePath();
      fillTex(g, layerPat(g, bands[0]), k0, bl);
      g.clip();

      /* --- 4. camadas de baixo (pintor: cada uma do seu topo até a base) --- */
      for (let b = 1; b < bands.length; b++) {
        const L = bands[b], hi = L.hi;
        let any = false;
        for (let k = 0; k < m; k++) { const t = Math.min(PA[k], hi[PI_[k]]); PT[k] = y0 - t; if (t > 0.5) any = true; }
        if (!any) continue;
        g.beginPath();
        g.moveTo(PX[0], vy1);
        run(g, PT, 0, last, smooth, true);
        g.lineTo(PX[last], vy1);
        g.closePath();
        fillTex(g, layerPat(g, L), k0, bl);
        // linha do contato entre camadas (só onde o contato está enterrado)
        g.beginPath();
        let open = -1;
        for (let k = 0; k <= m; k++) {
          const inside = k < m && hi[PI_[k]] > 0.5 && hi[PI_[k]] < PA[k] - 0.6 * u;
          if (inside && open < 0) open = k;
          else if (!inside && open >= 0) { if (k - 1 > open) run(g, PT, Math.max(0, open - 1), Math.min(last, k), smooth, false); open = -1; }
        }
        g.strokeStyle = L.line; g.lineWidth = 1.5 * u; g.globalAlpha = 0.55; g.stroke();
        g.globalAlpha = 0.5; g.strokeStyle = L.col3; g.lineWidth = 1.2 * u;
        g.translate(0, 1.6 * u); g.stroke(); g.translate(0, -1.6 * u);
        g.globalAlpha = 1;
      }

      /* --- 5. regiões em elipse (núcleo) --- */
      for (let e = 0; e < ells.length; e++) {
        const L = ells[e], el = L.ellipse;
        if (el.cx + el.rx < vx0 || el.cx - el.rx > vx1) continue;
        const cy = y0 - el.cy;
        g.beginPath(); g.ellipse(el.cx, cy, el.rx, el.ry, 0, 0, TAU);
        fillTex(g, layerPat(g, L), k0, bl);
        g.strokeStyle = L.line; g.lineWidth = 2.4 * u; g.globalAlpha = 0.75; g.stroke();
        // aro interno claro + anel pulsando devagar: o núcleo "respira"
        g.globalAlpha = 0.45; g.strokeStyle = L.col3; g.lineWidth = 2 * u;
        g.beginPath(); g.ellipse(el.cx, cy, Math.max(1, el.rx - 4 * u), Math.max(1, el.ry - 4 * u), 0, 0, TAU); g.stroke();
        const br = 0.5 + 0.5 * Math.sin(time * 0.9 + e);
        g.globalAlpha = 0.10 + 0.10 * br; g.lineWidth = (5 + 5 * br) * u;
        g.beginPath(); g.ellipse(el.cx, cy, el.rx * (0.62 + 0.03 * br), el.ry * (0.62 + 0.03 * br), 0, 0, TAU); g.stroke();
        g.globalAlpha = 1;
        if (o.sparkle !== false) {
          g.fillStyle = HILITE; g.beginPath();
          const ns = 9;
          for (let s = 0; s < ns; s++) {
            const ph = time * 0.45 + hs(e * 9.1 + s * 3.7) * 9, cyc = Math.floor(ph), tw = Math.sin((ph - cyc) * Math.PI);
            const a = hs(cyc * 1.31 + s * 7.7) * TAU, rr = Math.sqrt(hs(cyc * 2.77 + s * 5.1)) * 0.9;
            star(g, el.cx + Math.cos(a) * el.rx * rr, cy + Math.sin(a) * el.ry * rr, (1.5 + 4.5 * tw * tw) * u);
          }
          g.fill();
        }
      }

      /* --- 6. sombreamento em tons chapados --- */
      if (o.shade !== false) {
        // pele: tudo que está mais fundo que D1/D2 abaixo da superfície atual escurece um degrau (dá volume)
        for (let pass = 0; pass < 2; pass++) {
          const D = (pass ? 46 : 13) * u;
          for (let k = 0; k < m; k++) PT[k] = y0 - Math.max(0, PA[k] - D);
          g.beginPath(); g.moveTo(PX[0], vy1); run(g, PT, 0, last, smooth, true); g.lineTo(PX[last], vy1); g.closePath();
          g.fillStyle = 'rgba(' + SHADE + (pass ? ',.055)' : ',.05)'); g.fill();
        }
        // buracos: quanto mais afundado em relação à vizinhança, mais grossa a sombra logo abaixo da superfície
        let anyO = false;
        for (let k = 0; k < m; k++) {
          const a = Math.max(0, k - WIN), b = Math.min(m, k + WIN + 1);
          let oc = (PRE[b] - PRE[a]) / (b - a) - PA[k];
          oc = oc > 0 ? Math.min(oc * 0.85, 30 * u, PA[k]) : 0;
          if (PA[k] < 0.5) oc = 0;
          PO[k] = oc; if (oc > 0.4 * u) anyO = true;
        }
        if (anyO) for (let pass = 0; pass < 2; pass++) {
          const f = pass ? 0.45 : 1;
          for (let k = 0; k < m; k++) PT[k] = PY[k] + PO[k] * f;
          g.beginPath(); run(g, PY, 0, last, smooth, false); runBack(g, PT, 0, last, smooth); g.closePath();
          g.fillStyle = 'rgba(' + SHADE + ',.085)'; g.fill();
        }
        // base: dois degraus de sombra encostados no chão
        const bh = U.clamp(maxA * 0.05, 5 * u, 70 * u);
        g.fillStyle = 'rgba(' + SHADE + ',.06)';
        g.fillRect(PX[0], y0 - bh, PX[last] - PX[0], bh);
        g.fillRect(PX[0], y0 - bh * 0.42, PX[last] - PX[0], bh * 0.42);
      }

      /* --- 7. bolsões dourados --- */
      if (o.pockets !== false && heap.pockets.length) drawPockets(g, vx0, vx1, time, u, k0, bl, o);

      /* --- 8. névoa de distância --- */
      if (o.haze) {
        const hz = typeof o.haze === 'object' ? o.haze : NO;
        const hc = hz.col || PAL.sky, top = hz.top !== undefined ? hz.top : (typeof o.haze === 'number' ? o.haze : 0.3);
        const base = hz.base !== undefined ? hz.base : top * 0.25, pk = heap.peak().h;
        const key = hc + '|' + top + '|' + base + '|' + Math.round(pk);
        if (key !== hazeKey) {
          hazeGrad = g.createLinearGradient(0, y0, 0, y0 - Math.max(1, pk));
          hazeGrad.addColorStop(0, U.rgba(hc, base)); hazeGrad.addColorStop(1, U.rgba(hc, top));
          hazeKey = key;
        }
        g.fillStyle = hazeGrad;
        g.fillRect(PX[0], y0 - pk - 8, PX[last] - PX[0], pk + 8);
      }

      /* --- 9. brilho da crista (lado da luz) e sombra (lado oposto), por dentro do contorno --- */
      const lw = Math.max(1.5, 2.3 * pxw);
      const thr = 0.42 * colW * step;                      // desnível por ponto que conta como "de costas pra luz"
      for (let pass = 0; pass < 2; pass++) {
        g.beginPath();
        let open = -1;
        for (let k = 0; k <= last; k++) {
          const seg = k < last && (PA[k] > 0.3 || PA[k + 1] > 0.3);
          const away = seg && PA[k] - PA[k + 1] > thr;
          const want = seg && (pass ? away : !away);
          if (want && open < 0) open = k;
          else if (!want && open >= 0) { run(g, PY, open, k, smooth, false); open = -1; }
        }
        if (pass) { g.strokeStyle = 'rgba(' + SHADE + ',.13)'; g.lineWidth = lw + 7 * u; }
        else { g.strokeStyle = HILITE; g.globalAlpha = 0.95; g.lineWidth = lw + 4.4 * u; }
        g.stroke(); g.globalAlpha = 1;
      }

      /* --- 10. brilhinhos: estrelas minúsculas que piscam logo abaixo da crista --- */
      if (o.sparkle !== false) {
        const slotW = Math.pow(2, Math.ceil(Math.log2(Math.max(8, (vx1 - vx0) / 30))));
        const s0 = Math.floor(vx0 / slotW), s1 = Math.floor(vx1 / slotW);
        g.fillStyle = HILITE; g.beginPath();
        for (let s = s0; s <= s1; s++) {
          const hsh = hs(s * 1.618 + slotW * 0.013), ph = time * (0.35 + 0.3 * hsh) + hsh * 11, cyc = Math.floor(ph), f = ph - cyc;
          if (hs(cyc * 3.3 + s * 0.71) > 0.62) continue;
          const tw = Math.sin(f * Math.PI);
          const x = (s + hs(cyc * 1.7 + s * 2.3)) * slotW, ci = Math.floor((x - x0) / colW);
          if (ci < 0 || ci >= n || h[ci] < 10 * u) continue;
          const dd = (5 + hs(cyc * 5.1 + s) * 26) * u;
          if (dd > h[ci] - 2) continue;
          star(g, x, y0 - h[ci] + dd, (1 + 3.4 * tw * tw) * u);
        }
        g.fill();
      }
      g.restore();

      /* --- 11. contorno Kome ao longo da superfície --- */
      g.save();
      g.lineJoin = 'round'; g.lineCap = 'round';
      if (o.outline !== false) {
        g.beginPath();
        let open = -1;
        for (let k = 0; k <= last; k++) {
          const seg = k < last && (PA[k] > 0.05 || PA[k + 1] > 0.05);
          if (seg && open < 0) open = k;
          else if (!seg && open >= 0) { run(g, PY, open, k, smooth, false); open = -1; }
        }
        g.strokeStyle = o.line || LINE; g.lineWidth = lw; g.stroke();
      }

      /* --- 12. grãos rolando onde a avalanche está passando --- */
      if (o.roll !== false && flowLo <= flowHi) {
        const a = Math.max(flowLo, i0), b = Math.min(flowHi, i1), st = Math.max(1, Math.round(step * 0.75));
        const gr = Math.max(1.5, 1.8 * u);
        for (let pass = 0; pass < 2; pass++) {
          g.beginPath();
          for (let i = a - (a % st); i <= b; i += st) {
            if (i < 1 || i >= n - 1) continue;
            const av = act[i];
            if (av < 0.12) continue;
            const dir = h[i - 1] > h[i + 1] ? 1 : -1;
            const cntG = av > 1.2 ? 2 : 1;
            for (let q = 0; q < cntG; q++) {
              const sd = hs(i * 0.917 + q * 4.3), span = colW * st * 3.2;
              const ph = (time * (1.4 + sd * 1.6) + sd * 7) % 1;
              const x = x0 + (i + 0.5) * colW + dir * (ph - 0.5) * span;
              const hop = Math.abs(Math.sin(ph * Math.PI * 3 + sd * 6)) * (1.5 + 3 * sd) * u * Math.min(1, av);
              const y = heap.surf(x) - hop - gr * 0.6;
              const rot = ph * 9 * dir + sd * 6;
              const R = pass ? gr : gr + Math.max(0.7, pxw * 1.1);
              g.moveTo(x + Math.cos(rot) * R, y + Math.sin(rot) * R);
              g.ellipse(x, y, R, R * (pass ? 0.55 : 0.62), rot, 0, TAU);
            }
          }
          g.fillStyle = pass ? PAL.rice : (o.line || LINE);
          g.fill();
        }
      }
      g.restore();
    }

    function drawPockets(g, vx0, vx1, time, u, k0, bl, o) {
      const P = heap.pockets;
      if (!goldPat) goldPat = texture(g, PAL.gold, PAL.goldD, PAL.goldL, 'gold');
      for (let q = 0; q < P.length; q++) {
        const p = P[q];
        if (p.x + p.r < vx0 || p.x - p.r > vx1) continue;
        const ci = heap.col(p.x), top = Math.max(h[ci], h[heap.col(p.x - p.r * 0.7)], h[heap.col(p.x + p.r * 0.7)]);
        if (p.y - p.r > top) continue;                 // já foi todo cavado
        const cy = y0 - p.y, r = p.r, tiny = r < 5 * u;
        g.beginPath();
        if (tiny) g.arc(p.x, cy, r, 0, TAU);
        else {
          // bolha irregular e gordinha
          const N = 10, S = p.shape;
          let ax = p.x + r * (S[N - 1] + S[0]) * 0.5 * Math.cos(-TAU / N / 2), ay = cy + r * (S[N - 1] + S[0]) * 0.5 * Math.sin(-TAU / N / 2);
          g.moveTo(ax, ay);
          for (let k = 0; k < N; k++) {
            const a = TAU * k / N, an = a + TAU / N / 2, rn = r * (S[k] + S[(k + 1) % N]) * 0.5;
            g.quadraticCurveTo(p.x + Math.cos(a) * r * S[k] * 1.08, cy + Math.sin(a) * r * S[k] * 1.08, p.x + Math.cos(an) * rn, cy + Math.sin(an) * rn);
          }
          g.closePath();
        }
        fillTex(g, goldPat, k0, bl);
        g.strokeStyle = PAL.goldD; g.lineWidth = Math.max(1.6 * u, Math.min(3, r * 0.07)); g.stroke();
        if (!tiny) {
          // aro claro por dentro (luz de cima-esquerda) + sombra embaixo
          g.lineWidth = Math.max(1.3 * u, r * 0.07);
          g.strokeStyle = PAL.goldL; g.globalAlpha = 0.9;
          g.beginPath(); g.arc(p.x, cy, r * 0.66, Math.PI * 1.02, Math.PI * 1.62); g.stroke();
          g.strokeStyle = 'rgba(' + SHADE + ',.22)'; g.globalAlpha = 1;
          g.beginPath(); g.arc(p.x, cy, r * 0.68, Math.PI * 0.08, Math.PI * 0.6); g.stroke();
        }
        if (o.sparkle !== false) {
          // glints: 3 estrelas que acendem em pontos diferentes a cada ciclo
          g.fillStyle = HILITE; g.beginPath();
          for (let s = 0; s < 3; s++) {
            const ph = time * (0.55 + 0.2 * s) + p.seed + s * 0.37, cyc = Math.floor(ph), tw = Math.sin((ph - cyc) * Math.PI);
            const a = hs(cyc * 1.9 + p.seed + s) * TAU, rr = hs(cyc * 4.1 + p.seed * 2 + s) * 0.6;
            star(g, p.x + Math.cos(a) * r * rr, cy + Math.sin(a) * r * rr, Math.max(1.2 * u, r * 0.2) * (0.3 + 1.1 * tw * tw));
          }
          g.fill();
        }
        if (p.flash > 0) {
          g.strokeStyle = HILITE; g.globalAlpha = p.flash; g.lineWidth = (3 + 6 * p.flash) * u;
          g.beginPath(); g.arc(p.x, cy, r * (1.02 + 0.25 * (1 - p.flash)), 0, TAU); g.stroke();
          g.globalAlpha = p.flash * 0.35; g.fillStyle = HILITE; g.fill();
          g.globalAlpha = 1;
        }
      }
    }

    if (opts.layers) heap.setLayers(opts.layers);
    if (opts.generate) heap.generate(opts.generate, opts);
    return heap;
  }
  E.Heap = Heap;

  /* ======================================================================
     2. E.Pile — pilha pequena que assenta dentro de um recipiente
     ====================================================================== */
  // E.Pile({cap=100, v=0, cols=22, slope=0.045, max=1.2, col, col2, col3, tex='grain', seed}) -> pile
  //   alturas internas em fração de hmax; v = cap deixa a pilha rente à borda (com o morrinho passando um pouco)
  function Pile(opts) {
    opts = opts || NO;
    const K = Math.max(6, opts.cols || 22);
    const tgt = new Float32Array(K), dsp = new Float32Array(K), vel = new Float32Array(K);
    const X = new Float32Array(K + 2), Y = new Float32Array(K + 2);
    const col = opts.col || PAL.rice, col2 = opts.col2 || PAL.riceS, col3 = opts.col3 || '#FFFFFF';
    let pat = null, animated = false, busy = false;
    const pile = {
      cap: opts.cap || 100,
      v: 0,
      max: opts.max || 1.2,                 // quanto passa de cheio antes de derramar (carga coroada)
      slope: opts.slope || 0.045,           // desnível máx. entre colunas vizinhas (fração de hmax)
      seed: opts.seed || 1,
      wob: 0,                               // tremidinha de quando cai carga (decai sozinha)
      // frac: 0..max
      get frac() { return pile.v / pile.cap; },
      get full() { return pile.v >= pile.cap; },
      // add(v, at=0.5, spread=0.16) -> quanto coube: despeja em 'at' (0 = parede esquerda, 1 = direita)
      add(v, at, spread) {
        const room = pile.cap * pile.max - pile.v, a = Math.max(0, Math.min(v, room));
        if (a <= 0) return 0;
        pile.v += a;
        spread = Math.max(0.5 / K, spread || 0.16);
        const c = (at === undefined ? 0.5 : at) * (K - 1);
        let ws = 0;
        for (let i = 0; i < K; i++) { const d = (i - c) / (spread * K); if (d > -1 && d < 1) ws += 1 - d * d; }
        const dh = (a / pile.cap) * K;
        if (ws <= 0) tgt[clampi(Math.round(c), 0, K - 1)] += dh;
        else for (let i = 0; i < K; i++) { const d = (i - c) / (spread * K); if (d > -1 && d < 1) tgt[i] += dh * (1 - d * d) / ws; }
        pile.wob = Math.min(1, pile.wob + 0.25 + (a / pile.cap) * 3);
        busy = true;
        if (!animated) settle(60);
        return a;
      },
      // take(v, at) -> quanto saiu: tira das colunas mais altas (ou em volta de 'at')
      take(v, at) {
        const a = Math.max(0, Math.min(v, pile.v));
        if (a <= 0) return 0;
        pile.v -= a;
        let rem = (a / pile.cap) * K, guard = 200;
        while (rem > 1e-6 && guard-- > 0) {
          let bi = 0, bh = -1;
          if (at !== undefined) { bi = clampi(Math.round(at * (K - 1) + (hs(guard * 1.7) - 0.5) * K * 0.3), 0, K - 1); if (tgt[bi] <= 0) at = undefined; }
          if (at === undefined) for (let i = 0; i < K; i++) if (tgt[i] > bh) { bh = tgt[i]; bi = i; }
          const t = Math.min(tgt[bi], Math.max(rem * 0.12, 0.004), rem);
          if (t <= 0) break;
          tgt[bi] -= t; rem -= t;
        }
        if (pile.v <= 1e-9) { pile.v = 0; tgt.fill(0); }
        busy = true;
        if (!animated) settle(60);
        return a;
      },
      // set(v): define o volume direto, já assentado
      set(v) {
        pile.v = 0; tgt.fill(0);
        const an = animated; animated = false;
        pile.add(v); animated = an;
        settle(200); dsp.set(tgt); vel.fill(0); pile.wob = 0;
        return pile;
      },
      // clear(): esvazia
      clear() { pile.v = 0; tgt.fill(0); dsp.fill(0); vel.fill(0); pile.wob = 0; return pile; },
      // update(dt, tilt=0): assenta (avalanche) e amortece a superfície; tilt (-1..1) empurra o arroz pra um lado (freada)
      update(dt, tilt) {
        animated = true;
        if (busy || tilt) busy = relax(2, tilt || 0) > 1e-5;
        const k = 90, c = 13;
        for (let i = 0; i < K; i++) {
          vel[i] += ((tgt[i] - dsp[i]) * k - vel[i] * c) * dt;
          dsp[i] += vel[i] * dt;
          if (dsp[i] < 0) { dsp[i] = 0; vel[i] = 0; }
        }
        if (pile.wob > 0) pile.wob = Math.max(0, pile.wob - dt * 3.2);
      },
      // topAt(at) -> altura (fração de hmax) da superfície em 'at' 0..1
      topAt(at) { return dsp[clampi(Math.round((at === undefined ? 0.5 : at) * (K - 1)), 0, K - 1)]; },
      // draw(g, x, y, w, hmax, {t=0, outline=true, clip=true, grains=true, lip}): x,y = canto inferior esquerdo do vão;
      //   w = largura interna; hmax = altura da pilha quando cheia (frac 1). clip corta nas paredes; lip = teto do recorte (px)
      draw(g, x, y, w, hmax, o) {
        o = o || NO;
        const A = animated ? dsp : tgt, t = o.t || 0;
        let mx = 0;
        for (let i = 0; i < K; i++) if (A[i] > mx) mx = A[i];
        if (mx <= 0.002) return;
        const cw = w / K, wob = pile.wob;
        X[0] = 0; Y[0] = -A[0] * hmax;
        for (let i = 0; i < K; i++) {
          X[i + 1] = (i + 0.5) * cw;
          Y[i + 1] = -(A[i] * hmax) - (wob > 0 ? Math.sin(t * 38 + i * 1.7) * wob * 0.9 : 0);
          if (Y[i + 1] > 0) Y[i + 1] = 0;
        }
        X[K + 1] = w; Y[K + 1] = -A[K - 1] * hmax;
        const M = K + 1;
        g.save();
        g.translate(x, y);
        g.lineJoin = 'round'; g.lineCap = 'round';
        if (o.clip !== false) { const lip = o.lip !== undefined ? o.lip : hmax * (pile.max + 0.6); g.beginPath(); g.rect(0, -lip, w, lip + 1); g.clip(); }
        g.beginPath(); g.moveTo(0, 0.5); topPath(g, M, true); g.lineTo(w, 0.5); g.closePath();
        if (!pat) pat = texture(g, col, col2, col3, opts.tex || { size: 40, n: 150, shape: 'grain' });
        patScale(pat, o.grainScale || 0.5);
        g.fillStyle = pat; g.fill();
        g.save(); g.clip();
        // sombra chapada no fundo e encostada nas paredes
        const sh = Math.min(mx * hmax * 0.45, hmax * 0.3);
        g.fillStyle = 'rgba(' + SHADE + ',.10)';
        g.fillRect(0, -sh, w, sh + 1); g.fillRect(0, -sh * 0.45, w, sh * 0.45 + 1);
        g.fillRect(0, -hmax * 3, Math.min(2.2, w * 0.05), hmax * 3); g.fillRect(w - Math.min(2.2, w * 0.05), -hmax * 3, 3, hmax * 3);
        // crista iluminada
        g.beginPath(); topPath(g, M, false);
        g.strokeStyle = HILITE; g.lineWidth = o.outline === false ? 2.6 : 4.6; g.stroke();
        // brilhinho
        const ph = t * 0.8 + pile.seed * 3.3, cyc = Math.floor(ph), tw = Math.sin((ph - cyc) * Math.PI);
        const si = 1 + Math.floor(hs(cyc * 2.3 + pile.seed) * (K - 1));
        if (A[si - 1] * hmax > 7) { g.fillStyle = HILITE; g.beginPath(); star(g, X[si], Y[si] + 4.5, 0.8 + 2.2 * tw * tw); g.fill(); }
        g.restore();
        if (o.outline !== false) { g.beginPath(); topPath(g, M, false); g.strokeStyle = o.line || LINE; g.lineWidth = o.lw || 1.5; g.stroke(); }
        // grãos soltos pousados na superfície
        if (o.grains !== false) {
          for (let pass = 0; pass < 2; pass++) {
            g.beginPath();
            for (let q = 0; q < 5; q++) {
              const f = hs(pile.seed * 7.7 + q * 2.9), i = 1 + Math.floor(f * (K - 1));
              if (A[i - 1] * hmax < 3) continue;
              const gx = X[i], gy = Y[i] - 0.4, rot = f * 9, R = pass ? 1.5 : 2.3;
              g.moveTo(gx + Math.cos(rot) * R, gy + Math.sin(rot) * R);
              g.ellipse(gx, gy, R, R * (pass ? 0.55 : 0.7), rot, 0, TAU);
            }
            g.fillStyle = pass ? col : (o.line || LINE); g.fill();
          }
        }
        g.restore();
      },
    };
    // superfície da pilha (curva pelos pontos médios) no caminho atual
    function topPath(g, M, cont) {
      if (cont) g.lineTo(X[0], Y[0]); else g.moveTo(X[0], Y[0]);
      g.lineTo((X[0] + X[1]) * 0.5, (Y[0] + Y[1]) * 0.5);
      for (let k = 1; k < M; k++) g.quadraticCurveTo(X[k], Y[k], (X[k] + X[k + 1]) * 0.5, (Y[k] + Y[k + 1]) * 0.5);
      g.lineTo(X[M], Y[M]);
    }
    // avalanche entre colunas com paredes; devolve o quanto se mexeu
    function relax(iters, tilt) {
      let moved = 0;
      const sl = pile.slope * (22 / K);
      for (let it = 0; it < iters; it++) {
        for (let i = 0; i < K - 1; i++) {
          const d = tgt[i] - tgt[i + 1] + tilt * sl * 1.6;
          if (d > sl) { const t = Math.min(tgt[i], (d - sl) * 0.3); tgt[i] -= t; tgt[i + 1] += t; moved += t; }
          else if (d < -sl) { const t = Math.min(tgt[i + 1], (-d - sl) * 0.3); tgt[i] += t; tgt[i + 1] -= t; moved += t; }
        }
      }
      return moved;
    }
    function settle(iters) { for (let k = 0; k < iters; k += 4) if (relax(4, 0) < 1e-5) break; }
    if (opts.v) pile.set(opts.v);
    return pile;
  }
  E.Pile = Pile;

  /* ======================================================================
     3. E.Grains — grãos que voam e, se 'deposit', somam na pilha onde pousam
     ====================================================================== */
  // E.Grains(particles|null, heap|null, {max=700, g=560, onLand(x, y, vol, gold)}) -> grains
  //   grãos com depósito são sempre simulados aqui dentro (o volume tem que fechar a conta); os decorativos vão pro
  //   E.Particles se ele foi passado (ps.add com shape 'grain'), senão também ficam aqui. Chame update(dt) e draw(g).
  function Grains(particles, heap, opts) {
    opts = opts || NO;
    const MAX = opts.max || 700;
    const ps = particles && typeof particles.add === 'function' ? particles : null;
    const gx = new Float32Array(MAX), gy = new Float32Array(MAX), gvx = new Float32Array(MAX), gvy = new Float32Array(MAX);
    const grot = new Float32Array(MAX), gvr = new Float32Array(MAX), glife = new Float32Array(MAX), gvol = new Float32Array(MAX);
    const gsz = new Float32Array(MAX), gflag = new Uint8Array(MAX);   // bit0 ouro, bit1 depósito, bit2 já quicou, bit3 pousado
    let cnt = 0;
    const G = opts.g || 560;
    const grains = {
      heap: heap || null,
      onLand: opts.onLand || null,       // fn(x, y, vol, gold) quando um grão de depósito assenta
      landed: 0,                         // área depositada no último update()
      get count() { return cnt; },
      // floor(x) -> y do chão pra passar como floorFn do E.Particles.update
      floor(x) { return grains.heap ? grains.heap.surf(x) : 0; },
      // emit(x, y, n, {vx=0, vy=-140, spread=70, gold=false|0..1, deposit=false, vol=0 (área total que os n grãos carregam),
      //                 size=1, life=3, jitter=3}) -> quantos saíram
      emit(x, y, n, o) {
        o = o || NO;
        const vx = o.vx || 0, vy = o.vy !== undefined ? o.vy : -140, sp = o.spread !== undefined ? o.spread : 70;
        const dep = !!o.deposit, gp = o.gold === true ? 1 : +o.gold || 0, jit = o.jitter !== undefined ? o.jitter : 3;
        const size = o.size || 1, life = o.life || 3;
        if (!dep && ps) {
          for (let k = 0; k < n; k++) {
            const gold = Math.random() < gp;
            ps.add({
              x: x + (Math.random() - 0.5) * jit * 2, y: y + (Math.random() - 0.5) * jit, vx: vx + (Math.random() - 0.5) * sp * 2,
              vy: vy + (Math.random() - 0.5) * sp, g: G, life, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 16,
              w: 3.4 * size, h: 1.8 * size, c: gold ? PAL.gold : PAL.rice, shape: 'grain', land: true,
            });
          }
          return n;
        }
        const per = dep && o.vol > 0 ? o.vol / n : 0;
        let made = 0;
        for (let k = 0; k < n; k++) {
          if (cnt >= MAX) {
            // lotado: o volume que não coube em grão vai direto pra pilha (a conta sempre fecha)
            if (per > 0 && grains.heap) grains.heap.add(x, per * (n - k), grains.heap.colW * 3);
            break;
          }
          const i = cnt++;
          gx[i] = x + (Math.random() - 0.5) * jit * 2; gy[i] = y + (Math.random() - 0.5) * jit;
          gvx[i] = vx + (Math.random() - 0.5) * sp * 2; gvy[i] = vy + (Math.random() - 0.5) * sp;
          grot[i] = Math.random() * TAU; gvr[i] = (Math.random() - 0.5) * 18;
          glife[i] = life * (0.8 + Math.random() * 0.4); gvol[i] = per; gsz[i] = size * (0.8 + Math.random() * 0.5);
          gflag[i] = (Math.random() < gp ? 1 : 0) | (dep ? 2 : 0);
          made++;
        }
        return made;
      },
      // update(dt): gravidade, quique, pouso (depósito na pilha)
      update(dt) {
        const hp = grains.heap;
        grains.landed = 0;
        for (let i = cnt - 1; i >= 0; i--) {
          let f = gflag[i];
          glife[i] -= dt;
          let dead = glife[i] <= 0;
          if (!dead && !(f & 8)) {
            gvy[i] += G * dt;
            gvx[i] *= 1 - 0.6 * dt;
            gx[i] += gvx[i] * dt; gy[i] += gvy[i] * dt; grot[i] += gvr[i] * dt;
            const fy = hp ? hp.surf(gx[i]) : 0;
            if (gvy[i] > 0 && gy[i] >= fy - 0.8) {
              const sp = Math.abs(gvy[i]) + Math.abs(gvx[i]);
              if (!(f & 4) && sp > 150 && gsz[i] > 0.95) {
                // um quique curto morro abaixo antes de assentar
                const sl = hp ? hp.slope(gx[i]) : 0;
                gy[i] = fy - 1; gvy[i] = -gvy[i] * 0.22 - 20; gvx[i] = gvx[i] * 0.35 - sl * 70; gvr[i] *= 1.4;
                gflag[i] = f | 4;
              } else if (f & 2) {
                if (hp && gvol[i] > 0) { hp.add(gx[i], gvol[i], hp.colW * 1.6); grains.landed += gvol[i]; }
                if (grains.onLand) grains.onLand(gx[i], fy, gvol[i], (f & 1) === 1);
                dead = true;
              } else {
                gy[i] = fy - 0.6; gflag[i] = f | 8; if (glife[i] > 0.3) glife[i] = 0.3;
              }
            }
          }
          if (dead) {
            // grão de depósito que morre no ar ainda entrega o volume
            if ((f & 2) && glife[i] <= 0 && hp && gvol[i] > 0) { hp.add(gx[i], gvol[i], hp.colW * 1.6); grains.landed += gvol[i]; }
            const j = --cnt;
            if (i !== j) {
              gx[i] = gx[j]; gy[i] = gy[j]; gvx[i] = gvx[j]; gvy[i] = gvy[j]; grot[i] = grot[j]; gvr[i] = gvr[j];
              glife[i] = glife[j]; gvol[i] = gvol[j]; gsz[i] = gsz[j]; gflag[i] = gflag[j];
            }
          }
        }
      },
      // draw(g, view?, {zoom}): 3 preenchimentos no total (contorno, arroz, ouro), sem alocar
      draw(g, view, o) {
        if (!cnt) return;
        let z = o && o.zoom;
        if (!z) { const tr = g.getTransform(); z = Math.sqrt(tr.a * tr.a + tr.b * tr.b) || 1; }
        const pxw = 1 / z, minR = 1.5 * pxw, ol = Math.max(0.55, 0.9 * pxw);
        const vx0 = view ? view.x0 - 8 : -1e9, vx1 = view ? view.x1 + 8 : 1e9;
        for (let pass = 0; pass < 3; pass++) {
          g.beginPath();
          let any = false;
          for (let i = 0; i < cnt; i++) {
            const gold = gflag[i] & 1;
            if (pass === 1 && gold) continue;
            if (pass === 2 && !gold) continue;
            const x = gx[i]; if (x < vx0 || x > vx1) continue;
            const fade = glife[i] < 0.3 ? Math.max(0.15, glife[i] / 0.3) : 1;
            let R = Math.max(minR, 2.1 * gsz[i]) * fade; if (pass === 0) R += ol;
            const rot = grot[i], ry = pass === 0 ? R * 0.5 + ol * 0.5 : R * 0.5;
            g.moveTo(x + Math.cos(rot) * R, gy[i] + Math.sin(rot) * R);
            g.ellipse(x, gy[i], R, ry, rot, 0, TAU);
            any = true;
          }
          if (any) { g.fillStyle = pass === 0 ? LINE : pass === 1 ? PAL.rice : PAL.gold; g.fill(); }
        }
      },
      // clear(): some com todos os grãos (volume de depósito pendente é entregue antes)
      clear() {
        const hp = grains.heap;
        if (hp) for (let i = 0; i < cnt; i++) if ((gflag[i] & 2) && gvol[i] > 0) hp.add(gx[i], gvol[i], hp.colW * 1.6);
        cnt = 0;
      },
    };
    return grains;
  }
  E.Grains = Grains;
})();
