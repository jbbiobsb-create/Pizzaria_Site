/* Pixxel v1.0 — terrain.js
   Terreno granular: a montanha de arroz (E.Heap), pilhas pequenas que assentam (E.Pile) e grãos voando (E.Grains).
   Depende de core.js e pix.js.

   COORDENADAS (importante):
     - "mundo": x pra direita, y pra baixo; a base da montanha fica em y = heap.y0 (padrão 0), pra cima é negativo.
     - "altura" (alt): distância ACIMA da base, positiva pra cima. alt = heap.y0 - yMundo.
     heap.h / heap.h0 / matAt(i, alt) / pocketAt(x, alt) / bolsões {x, y: alt} / elipse {cx, cy: alt} usam ALTURA.
     surf(x) / digCircle(cx, cy, ...) / bite() / draw() / Grains usam Y DE MUNDO.

   Seções: 1 texturas de grão · 2 Heap (dados, camadas, cavar, avalanche, desenho) · 3 Pile · 4 Grains */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const E = (root.Pixxel = root.Pixxel || {});
  if (!E.U) throw new Error('Pixxel: carregue core.js antes de terrain.js');
  if (!E.PAL) throw new Error('Pixxel: carregue pix.js antes de terrain.js');
  const U = E.U, PAL = E.PAL, TAU = Math.PI * 2, NO = Object.freeze({});
  const LINE = PAL.line || '#3B2818';
  const BROWN = '#4A2E14';
  const doc = root.document;

  /* ======================================================================
     1. Texturas de grão (gerador próprio; não usa Draw.pattern)
        Cada material tem ladrilhos sem emenda:
          'g'  grãos de verdade em 3 camadas (vãos escuros, grãos médios, grãos claros com brilho)   4 texels por px de mundo
          's'  textura macia pra longe (manchas + pontinhos), sem moiré
          'ca' / 'cb'  grãos grandes e ensolarados da crista (fundo transparente; denso / esparso)
        O mesmo ladrilho 'g' serve o LOD perto (escala 1/4) e o LOD médio (escala 1/2, grão com o dobro do tamanho).
     ====================================================================== */
  const TG = 256, TS = 128;
  const texCache = new Map();
  const PM = typeof DOMMatrix !== 'undefined' ? new DOMMatrix() : null;

  // tons de um material: vão entre grãos, sombra, base, luz, brilho
  function tonesOf(kind, col, c2, c3) {
    const gold = kind === 'gold', mochi = kind === 'mochi';
    const dark = gold ? '#5A3206' : mochi ? '#9A4E58' : BROWN;
    return {
      gap: U.mixCss(col, dark, kind === 'pressed' ? 0.34 : gold ? 0.5 : mochi ? 0.5 : 0.38),
      low: c2 || U.mixCss(col, gold ? '#7A4A0C' : dark, gold ? 0.26 : mochi ? 0.14 : 0.11),
      mid: col,
      top: c3 || U.mixCss(col, gold ? '#FFF3B0' : '#FFFFFF', gold ? 0.5 : 0.66),
      hi: gold ? '#FFFBE0' : '#FFFFFF',
      shadow: gold ? 'rgba(70,36,4,.38)' : 'rgba(60,36,14,.28)',
    };
  }

  // elipse preenchida repetida nas bordas do ladrilho (pra emendar)
  function wfill(c, T, x, y, rx, ry, a) {
    const m = rx + 2;
    for (let ox = -T; ox <= T; ox += T) {
      const X = x + ox; if (X < -m || X > T + m) continue;
      for (let oy = -T; oy <= T; oy += T) {
        const Y = y + oy; if (Y < -m || Y > T + m) continue;
        c.beginPath(); c.ellipse(X, Y, rx, ry, a, 0, TAU); c.fill();
      }
    }
  }
  // um grão: sombra de contato, barriga escura, corpo (deslocado pra luz, que vem de cima-esquerda) e brilho
  function grain(c, T, x, y, L, W, a, body, under, hi, shadow) {
    if (shadow) { c.fillStyle = shadow; wfill(c, T, x + L * 0.06, y + W * 0.32, L * 0.5, W * 0.5, a); }
    c.fillStyle = under; wfill(c, T, x, y, L * 0.5, W * 0.5, a);
    c.fillStyle = body; wfill(c, T, x - L * 0.03, y - W * 0.13, L * 0.455, W * 0.365, a);
    if (hi) { c.fillStyle = hi; wfill(c, T, x - L * 0.08, y - W * 0.2, L * 0.2, W * 0.11, a); }
  }
  function grainPass(c, T, r, n, L, W, spread, body, under, hi, shadow, hiChance) {
    for (let i = 0; i < n; i++) {
      const k = 0.85 + r() * 0.35;
      const a = spread >= 3 ? r() * Math.PI : (r() - 0.5) * 2 * spread;
      grain(c, T, r() * T, r() * T, L * k, W * (0.9 + r() * 0.25), a, body, under, hi && r() < hiChance ? hi : null, shadow);
    }
  }
  function star4(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s);
    c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.fill();
  }
  // linha ondulada horizontal que emenda (período inteiro)
  function wavy(c, T, y, amp, m, ph, x0, x1) {
    c.beginPath();
    for (let x = x0; x <= x1; x += 4) {
      const Y = y + amp * Math.sin((x / T) * TAU * m + ph);
      if (x === x0) c.moveTo(x, Y); else c.lineTo(x, Y);
    }
    c.stroke();
  }

  function tileGrains(c, T, r, kind, tn) {
    c.fillStyle = tn.gap; c.fillRect(0, 0, T, T);
    if (kind === 'pressed') {
      // (17/11) grão legível como o do arroz solto, só mais apertado e deitado; antes era uma massa borrada
      grainPass(c, T, r, 1000, 13, 5.6, 0.5, tn.low, U.mixCss(tn.low, tn.gap, 0.6), null, null, 0);
      grainPass(c, T, r, 560, 13.2, 5.8, 0.45, tn.mid, tn.low, tn.top, tn.shadow, 0.55);
      grainPass(c, T, r, 210, 13.5, 6, 0.4, tn.top, tn.mid, tn.hi, tn.shadow, 1);
      c.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 50; i++) wfill(c, T, r() * T, r() * T, 1.5, 1, (r() - 0.5) * 0.4);
      c.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const y = (k + 0.2 + r() * 0.6) * (T / 5), m = 1 + ((r() * 3) | 0), ph = r() * TAU, amp = 1.5 + r() * 2.5;
        for (let oy = -T; oy <= T; oy += T) {
          let x = -8;
          while (x < T + 8) { // traços quebrados: estrato não é régua
            const len = 40 + r() * 120;
            c.strokeStyle = U.rgba(tn.gap, 0.55); c.lineWidth = 1.3; wavy(c, T, y + oy, amp, m, ph, x, Math.min(T + 8, x + len));
            c.strokeStyle = U.rgba(tn.top, 0.55); c.lineWidth = 1; wavy(c, T, y + oy + 1.9, amp, m, ph, x, Math.min(T + 8, x + len));
            x += len + 6 + r() * 26;
          }
        }
      }
    } else {
      const gold = kind === 'gold';
      // polido (15/11): grãos um pouco maiores e menos amontoados, cada um com sombra, corpo e brilho legíveis
      grainPass(c, T, r, 900, 13, 6, 9, tn.low, U.mixCss(tn.low, tn.gap, 0.6), null, null, 0);
      grainPass(c, T, r, 470, 13.5, 6.2, 9, tn.mid, tn.low, tn.top, tn.shadow, 0.6);
      grainPass(c, T, r, gold ? 260 : 190, 14, 6.5, 9, tn.top, tn.mid, tn.hi, tn.shadow, 1);
      // pontinho de luz na ponta de alguns grãos (o "brilho de arroz cozido")
      c.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 70; i++) wfill(c, T, r() * T, r() * T, 1.6, 1.1, r() * Math.PI);
      if (gold) { c.fillStyle = '#FFFFFF'; for (let i = 0; i < 16; i++) star4(c, 10 + r() * (T - 20), 10 + r() * (T - 20), 3.5 + r() * 4.5); }
    }
  }
  function tileMochi(c, T, r, tn) {
    c.fillStyle = tn.mid; c.fillRect(0, 0, T, T);
    // manchas largas (massa lisa, sem grão)
    for (let i = 0; i < 26; i++) {
      c.fillStyle = U.rgba(i & 1 ? tn.low : tn.top, 0.3);
      wfill(c, T, r() * T, r() * T, 22 + r() * 30, 9 + r() * 12, (r() - 0.5) * 0.7);
    }
    // rachaduras de esticar: linha escura com beirada clara
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < 9; i++) {
      const x = r() * T, y = r() * T, a = (r() - 0.5) * 1.1, L = 34 + r() * 50;
      const dx = Math.cos(a) * L, dy = Math.sin(a) * L, bx = (r() - 0.5) * 16, by = (r() - 0.5) * 16;
      for (let ox = -T; ox <= T; ox += T) for (let oy = -T; oy <= T; oy += T) {
        const X = x + ox, Y = y + oy;
        if (X < -90 || X > T + 90 || Y < -90 || Y > T + 90) continue;
        c.strokeStyle = U.rgba(tn.top, 0.9); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(X, Y + 1.8); c.quadraticCurveTo(X + dx * 0.5 + bx, Y + dy * 0.5 + by + 1.8, X + dx, Y + dy + 1.8); c.stroke();
        c.strokeStyle = U.rgba(tn.gap, 0.8); c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(X, Y); c.quadraticCurveTo(X + dx * 0.5 + bx, Y + dy * 0.5 + by, X + dx, Y + dy); c.stroke();
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(X + dx * 0.55 + bx * 0.5, Y + dy * 0.55 + by * 0.5); c.lineTo(X + dx * 0.55 - dy * 0.22, Y + dy * 0.55 + dx * 0.22); c.stroke();
      }
    }
    // covinhas: elipse escura com meia-lua clara embaixo
    for (let i = 0; i < 30; i++) {
      const x = r() * T, y = r() * T, s = 4 + r() * 5, a = (r() - 0.5) * 0.5;
      c.fillStyle = tn.top; wfill(c, T, x + 0.6, y + 1.8, s, s * 0.6, a);
      c.fillStyle = tn.low; wfill(c, T, x, y, s, s * 0.6, a);
      c.fillStyle = U.mixCss(tn.low, tn.gap, 0.45); wfill(c, T, x - 0.4, y - 0.7, s * 0.62, s * 0.3, a);
    }
    // brilho de superfície lisa: cápsula branca + pontinho
    for (let i = 0; i < 24; i++) {
      const x = r() * T, y = r() * T, L = 8 + r() * 14;
      c.fillStyle = 'rgba(255,255,255,.85)';
      wfill(c, T, x, y, L, 2.1, -0.42);
      wfill(c, T, x + L * 1.25, y - L * 0.56, 2.2, 1.9, 0);
    }
  }
  function tileSoft(c, T, r, kind, tn) {
    c.fillStyle = U.mixCss(tn.mid, tn.low, kind === 'mochi' ? 0.1 : kind === 'loose' ? 0.2 : 0.4); c.fillRect(0, 0, T, T);
    const nb = kind === 'mochi' ? 26 : 70;
    for (let i = 0; i < nb; i++) { c.fillStyle = U.rgba(tn.gap, 0.1); wfill(c, T, r() * T, r() * T, 5 + r() * 10, 3 + r() * 5, (r() - 0.5) * 0.8); }
    for (let i = 0; i < nb; i++) { c.fillStyle = U.rgba(tn.top, 0.2); wfill(c, T, r() * T, r() * T, 4 + r() * 9, 2.5 + r() * 4, (r() - 0.5) * 0.8); }
    if (kind === 'pressed') {
      c.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const y = (k + 0.5) * (T / 6), m = 1 + (k % 3), ph = r() * TAU;
        c.strokeStyle = U.rgba(tn.gap, 0.28); wavy(c, T, y, 1.6, m, ph, 0, T);
        c.strokeStyle = U.rgba(tn.top, 0.3); wavy(c, T, y + 1.2, 1.6, m, ph, 0, T);
      }
    } else if (kind === 'mochi') {
      for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(255,255,255,.5)'; wfill(c, T, r() * T, r() * T, 4 + r() * 4, 1, -0.42); }
      for (let i = 0; i < 10; i++) { c.fillStyle = U.rgba(tn.gap, 0.3); wfill(c, T, r() * T, r() * T, 6 + r() * 8, 0.7, (r() - 0.5)); }
    }
    if (kind !== 'mochi') {
      const ns = kind === 'gold' ? 80 : 46;
      for (let i = 0; i < ns; i++) { c.fillStyle = U.rgba(tn.hi, 0.55 + r() * 0.4); wfill(c, T, r() * T, r() * T, 0.9 + r() * 0.7, 0.8, 0); }
      for (let i = 0; i < 40; i++) { c.fillStyle = U.rgba(tn.gap, 0.22); wfill(c, T, r() * T, r() * T, 1.2, 0.8, 0); }
    }
  }
  function tileCrest(c, T, r, kind, tn, dense) {
    const flat = kind === 'pressed';
    const L = flat ? 15 : 15.5, W = flat ? 5.4 : 7.2, sp = flat ? 0.3 : 9;
    // sem sombra por grão aqui: somadas viravam um véu cinza que andava junto com a superfície ("a sombra cavando")
    if (dense) grainPass(c, T, r, 300, L * 0.9, W * 0.9, sp, tn.mid, tn.low, tn.top, null, 0.5);
    grainPass(c, T, r, dense ? 330 : 150, L, W, sp, tn.top, tn.mid, tn.hi, null, 1);
  }

  // textura(g, kind, col, c2, c3, variante) -> CanvasPattern cacheado
  function texture(g, kind, col, c2, c3, variant) {
    const key = kind + '|' + col + '|' + (c2 || '') + '|' + (c3 || '') + '|' + variant;
    let p = texCache.get(key);
    if (p) return p;
    // 'g2' = mesmo ladrilho de grãos com o dobro de resolução (8 texels por px de mundo), pra zoom alto em tela densa (celular)
    const hd = variant.length === 3 || variant === 'g2', base = hd ? variant.slice(0, -1) : variant, T = base === 's' ? TS : TG;
    const cv = doc.createElement('canvas'); cv.width = cv.height = hd ? T * 2 : T;
    const c = cv.getContext('2d');
    if (hd) c.scale(2, 2);
    let hsh = 2166136261; for (let i = 0; i < key.length; i++) { hsh ^= key.charCodeAt(i); hsh = Math.imul(hsh, 16777619); }
    const r = E.RNG(hsh >>> 0), tn = tonesOf(kind, col, c2, c3);
    if (base === 's') tileSoft(c, T, r, kind, tn);
    else if (base === 'ca' || base === 'cb') tileCrest(c, T, r, kind, tn, base === 'ca');
    else if (kind === 'mochi') tileMochi(c, T, r, tn);
    else tileGrains(c, T, r, kind, tn);
    p = g.createPattern(cv, 'repeat');
    p.canvas = cv;
    texCache.set(key, p);
    return p;
  }
  function useTex(g, p, scale) {
    if (PM && p.setTransform) { PM.a = PM.d = scale; p.setTransform(PM); }
    g.fillStyle = p;
  }

  // nível de detalhe pela escala S (px de dispositivo por unidade de mundo): A opaco + B por cima com alfa (crossfade)
  let LA = 'g', LAs = 0.25, LB = 'g', LBs = 0.25, LBa = 0, LNear = 1;
  function pickLod(S) {
    const q = Math.pow(2, Math.max(0, Math.round(Math.log2(1 / S))));
    if (S >= 4.2) { LA = 'g2'; LAs = 0.125; LBa = 0; }                    // bem de perto: textura em dobro de resolução (sem borrar)
    else if (S >= 2.55) { LA = 'g'; LAs = 0.25; LBa = 0; }
    else if (S >= 2.25) { LA = 'g'; LAs = 0.5; LB = 'g'; LBs = 0.25; LBa = (S - 2.25) / 0.3; }
    else if (S >= 0.85) { LA = 'g'; LAs = 0.5; LB = 's'; LBs = q; LBa = U.clamp((1.7 - S) / 0.85, 0, 1) * 0.18; }   // menos textura macia: grão continua nítido // médio: grão graúdo, acalmado pela textura macia
    else if (S >= 0.65) { LA = 's'; LAs = q; LB = 'g'; LBs = 0.5; LBa = ((S - 0.65) / 0.2) * 0.58; }
    else { LA = 's'; LAs = q; LBa = 0; }
    LNear = U.clamp((S - 2.25) / 0.3, 0, 1); // 1 = grãos no tamanho real
  }
  function matTex(g, m, variant) {
    const t = m._tx || (m._tx = {});
    return t[variant] || (t[variant] = texture(g, m.tex, m.col, m.col2, m.col3, variant));
  }
  // preenche o caminho atual com a textura do material no LOD corrente (com crossfade)
  function fillMat(g, m) {
    useTex(g, matTex(g, m, LA), LAs); g.fill();
    if (LBa > 0.01) { const pa = g.globalAlpha; g.globalAlpha = pa * LBa; useTex(g, matTex(g, m, LB), LBs); g.fill(); g.globalAlpha = pa; }
  }
  function scaleOf(g) { const m = g.getTransform(); return Math.sqrt(m.a * m.a + m.b * m.b) || 1; }

  const GOLD_MAT = { id: '_gold', tex: 'gold', col: PAL.gold || '#F3C94A', col2: null, col3: null, _tx: null };
  const TEX_BY_INDEX = ['loose', 'pressed', 'mochi'];

  /* ======================================================================
     2. Heap — a montanha de arroz (heightfield em colunas)
     ====================================================================== */
  // E.Heap({width, colW=4, x0=0, y0=0, repose=3.6, relaxIters=2, minK=0.4, flowRate=0.3, layers?, onPocket?(p)}) -> heap
  function Heap(opts) {
    opts = opts || NO;
    const colW = opts.colW || 4;
    const n = Math.max(2, Math.ceil((opts.width || 960) / colW));
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0;
    const h = new Float32Array(n), h0 = new Float32Array(n);
    const act = new Float32Array(n);       // atividade recente de avalanche por coluna (pra desenhar grãos rolando)
    const pk = new Uint8Array(n);          // coluna cruza algum bolsão?
    // ruído fixo dos grãos da crista: 2 por coluna x (posição, altura, ângulo, tamanho)
    const gr = new Float32Array(n * 8);
    { const r = E.RNG(opts.seed || 90210); for (let i = 0; i < gr.length; i++) gr[i] = r(); }
    // rascunhos de desenho (sem alocar por frame)
    const px = new Float32Array(n + 8), py = new Float32Array(n + 8), ph = new Float32Array(n + 8), th = new Float32Array(n + 8);
    const pc = new Int32Array(n + 8);
    const GMAX = Math.min(n * 2, 1400);
    const gX = new Float32Array(GMAX), gY = new Float32Array(GMAX), gA = new Float32Array(GMAX), gL = new Float32Array(GMAX), gW = new Float32Array(GMAX);
    const gM = new Uint8Array(GMAX);

    let layers = [], bands = [], ells = [];
    let layVer = 0;                        // muda quando camadas/bolsões/forma original mudam (refaz a montanha guardada)
    let rA = n, rB = -1;                   // faixa ativa da avalanche (vazia = parada)
    let relaxAcc = 0, sweep = 0, peakDirty = true, lastT = -1;
    const peakOut = { x: 0, h: 0, i: 0 };
    const res = { got: 0, val: 0, gold: 0, hard: 1, blocked: 0, hardMat: null, pocket: null, fell: 0, byMat: {} };

    const heap = {
      n, colW, x0, y0, h, h0, act,
      total: 0,          // área original (px²)
      area: 0,           // área atual (px²)
      maxH: 0,           // maior altura original
      repose: opts.repose !== undefined ? opts.repose : 3.6,
      relaxIters: opts.relaxIters || 2,
      flowRate: opts.flowRate || 0.3,
      minK: opts.minK !== undefined ? opts.minK : 0.4,  // pow/hard abaixo disso = "duro demais" (não cava)
      pockets: [],
      layers,
      flow: 0,           // área que escorreu na última relax() (px²)
      flowX: 0,          // x médio de onde escorreu (mundo)
      onPocket: opts.onPocket || null,

      /* ---------- geração ---------- */
      // generate(fn(x)->altura): preenche a montanha a partir de uma função do x de mundo (centro da coluna)
      generate(fn) {
        for (let i = 0; i < n; i++) { const v = fn(x0 + (i + 0.5) * colW, i); h[i] = h0[i] = v > 0 ? v : 0; }
        return reset0();
      },
      // fromArray(arr): alturas originais vindas de um array (uma por coluna)
      fromArray(arr) {
        for (let i = 0; i < n; i++) { const v = +arr[i] || 0; h[i] = h0[i] = v > 0 ? v : 0; }
        return reset0();
      },
      // restore(): volta a montanha ao estado original (bolsões voltam a ficar escondidos)
      restore() {
        h.set(h0); heap.area = heap.total; act.fill(0); rA = n; rB = -1; peakDirty = true;
        for (let k = 0; k < heap.pockets.length; k++) { heap.pockets[k].found = false; heap.pockets[k].flash = 0; }
        return heap;
      },

      /* ---------- consultas ---------- */
      // col(x) -> índice da coluna (limitado a 0..n-1)
      col(x) { const i = Math.floor((x - x0) / colW); return i < 0 ? 0 : i >= n ? n - 1 : i; },
      // colX(i) -> x de mundo do centro da coluna
      colX(i) { return x0 + (i + 0.5) * colW; },
      // height(x) -> altura atual em x (interpolada entre colunas)
      height(x) {
        const u = (x - x0) / colW - 0.5;
        if (u <= 0) return h[0]; if (u >= n - 1) return h[n - 1];
        const i = u | 0, f = u - i;
        return h[i] + (h[i + 1] - h[i]) * f;
      },
      // surf(x) -> y de MUNDO da superfície (negativo pra cima)
      surf(x) { return y0 - heap.height(x); },
      // alt(yMundo) -> altura acima da base
      alt(y) { return y0 - y; },
      // slope(x) -> inclinação (dAltura/dx; positivo = sobe pra direita)
      slope(x) {
        const i = heap.col(x), a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1;
        return (h[b] - h[a]) / ((b - a) * colW || 1);
      },
      // peak() -> {x, h, i} do ponto mais alto atual (objeto reaproveitado)
      peak() {
        if (peakDirty) {
          let m = -1, mi = 0;
          for (let i = 0; i < n; i++) if (h[i] > m) { m = h[i]; mi = i; }
          peakOut.i = mi; peakOut.h = m; peakOut.x = x0 + (mi + 0.5) * colW; peakDirty = false;
        }
        return peakOut;
      },
      // remaining() -> área que resta (px²)
      remaining() { return heap.area; },
      // frac() -> 0..1 do que resta em relação ao original
      frac() { return heap.total > 0 ? heap.area / heap.total : 0; },
      // dugDepth(x) -> quanto já foi cavado em x (altura original - atual; negativo = empilhado)
      dugDepth(x) { const i = heap.col(x); return h0[i] - h[i]; },

      /* ---------- camadas ---------- */
      // setLayers([{id,name,hard,val,slope,col,col2,col3,tex, top (fração da altura original) | d0,d1 (profundidade abaixo da superfície original) | ellipse:{cx,cy,rx,ry}}])
      //   ordem: da superfície pro fundo; elipses passam por cima das faixas. tex: 'loose'|'pressed'|'mochi'|'gold'
      setLayers(defs) {
        layers = heap.layers = []; bands = []; ells = [];
        for (let k = 0; k < defs.length; k++) {
          const d = defs[k], m = Object.assign({}, d);
          m.index = k; m.id = d.id !== undefined ? d.id : 'm' + k;
          m.hard = d.hard || 1; m.val = d.val !== undefined ? d.val : 1;
          m.slope = d.slope || 0; m.col = d.col || PAL.rice; m.col2 = d.col2 || null; m.col3 = d.col3 || null;
          m.isEllipse = !!d.ellipse;
          m.tex = d.tex || (m.isEllipse ? 'gold' : TEX_BY_INDEX[Math.min(bands.length, 2)]);
          m.lo = new Float32Array(n); m.hi = new Float32Array(n); m._tx = null;
          m.tone = tonesOf(m.tex, m.col, m.col2, m.col3);
          layers.push(m); (m.isEllipse ? ells : bands).push(m);
        }
        if (!bands.length) { heap.setLayers([{ id: 'solto', name: 'Arroz Solto', top: 1, col: '#F6F1E4' }].concat(defs)); return heap; }
        rebuild();
        return heap;
      },
      // matAt(i, alt) -> camada (objeto com id,hard,val,slope,col...) na coluna i e altura alt
      matAt,
      // matAtX(x, alt) -> camada no x de mundo
      matAtX(x, alt) { return matAt(heap.col(x), alt); },
      // topMat(x) -> camada exposta na superfície em x
      topMat(x) { const i = heap.col(x); return matAt(i, h[i] - 0.01); },

      /* ---------- bolsões ---------- */
      // addPocket({x, y (altura), r, mult=8, kind='gold'}) -> bolsão (ganha .found e .flash)
      addPocket(p) {
        p.mult = p.mult !== undefined ? p.mult : 8; p.kind = p.kind || 'gold'; p.found = !!p.found; p.flash = 0;
        const sh = p.shape = new Float32Array(12), r = E.RNG(((p.x * 31 + p.y * 17) | 0) + 7);
        for (let k = 0; k < 12; k++) sh[k] = 0.82 + r() * 0.3;
        p.seed = r();
        heap.pockets.push(p); layVer++;
        const a = heap.col(p.x - p.r * 1.15), b = heap.col(p.x + p.r * 1.15);
        for (let i = a; i <= b; i++) pk[i] = 1;
        return p;
      },
      // clearPockets(): remove todos os bolsões
      clearPockets() { heap.pockets.length = 0; pk.fill(0); layVer++; return heap; },
      // pocketAt(x, alt) -> bolsão que contém o ponto, ou null
      pocketAt,

      /* ---------- cavar / depositar ---------- */
      // dig(cx, area, rad, {pow=1, onTake(i, areaTirada, yTopoMundo)}) -> {got, val, gold, hard, blocked, hardMat, pocket, byMat}
      //   perfil parabólico; cada coluna perde do topo, pesando a dureza (k = pow/hard: >=1 100%, minK..1 = k, <minK nada)
      //   ATENÇÃO: o objeto devolvido é reaproveitado a cada chamada (copie o que for guardar)
      dig(cx, area, rad, o) {
        o = o || NO; clearRes();
        const pow = o.pow || 1, i0 = heap.col(cx - rad), i1 = heap.col(cx + rad);
        let ws = 0;
        for (let i = i0; i <= i1; i++) { const d = (x0 + (i + 0.5) * colW - cx) / rad; if (d > -1 && d < 1) ws += 1 - d * d; }
        if (!(ws > 0) || !(area > 0)) return res;
        for (let i = i0; i <= i1; i++) {
          const d = (x0 + (i + 0.5) * colW - cx) / rad;
          if (d <= -1 || d >= 1 || h[i] <= 0) continue;
          takeCol(i, (area * (1 - d * d)) / ws / colW, pow, 0, o.onTake);
        }
        return finish(i0, i1);
      },
      // digCircle(cx, cy, r, area, {pow, onTake}) -> igual ao dig + {fell}: corte da roda de caçambas (cy em Y DE MUNDO)
      //   colunas dentro do vão da roda perdem do topo, pesado pela sobreposição; nunca abaixo do fundo do círculo.
      //   fell = área que estava ACIMA da roda e "caiu dentro" (pra soltar partículas)
      digCircle(cx, cy, r, area, o) {
        o = o || NO; clearRes();
        const pow = o.pow || 1, i0 = heap.col(cx - r), i1 = heap.col(cx + r), ac = y0 - cy;
        let ws = 0;
        for (let i = i0; i <= i1; i++) {
          const dx = x0 + (i + 0.5) * colW - cx, q = r * r - dx * dx;
          th[i - i0] = q > 0 ? h[i] - (ac - Math.sqrt(q)) : 0;
          if (th[i - i0] > 0) ws += th[i - i0];
        }
        if (!(ws > 0) || !(area > 0)) return res;
        for (let i = i0; i <= i1; i++) {
          const ov = th[i - i0];
          if (!(ov > 0)) continue;
          const dx = x0 + (i + 0.5) * colW - cx, s = Math.sqrt(Math.max(0, r * r - dx * dx));
          const before = h[i], floor = Math.max(0, ac - s);
          takeCol(i, (area * ov) / ws / colW, pow, floor, o.onTake);
          const above = before - (ac + s);
          if (above > 0) res.fell += Math.min(before - h[i], above) * colW;
        }
        return finish(i0, i1);
      },
      // digRect(xa, xb, depth, {pow, onTake}) -> igual ao dig: tira 'depth' px do topo de cada coluna do vão (garfo da empilhadeira)
      digRect(xa, xb, depth, o) {
        o = o || NO; clearRes();
        const pow = o.pow || 1, i0 = heap.col(Math.min(xa, xb)), i1 = heap.col(Math.max(xa, xb));
        for (let i = i0; i <= i1; i++) if (h[i] > 0) takeCol(i, depth, pow, 0, o.onTake);
        return finish(i0, i1);
      },
      // bite(cx, cy, r, dir=1, amostras=12) -> 0..1: fração enterrada do semicírculo da frente da roda (cy em Y de mundo)
      bite(cx, cy, r, dir, samples) {
        const ns = samples || 12; let b = 0;
        for (let k = 0; k < ns; k++) {
          const a = -Math.PI / 2 + ((k + 0.5) / ns) * Math.PI;
          const x = cx + Math.cos(a) * r * (dir < 0 ? -1 : 1), y = cy + Math.sin(a) * r;
          if (y > y0 - heap.height(x)) b++;
        }
        return b / ns;
      },
      // add(x, area, rad=colW*2) -> deposita área em volta de x (perfil parabólico); a avalanche assenta depois
      add(x, area, rad) {
        rad = rad || colW * 2;
        const i0 = heap.col(x - rad), i1 = heap.col(x + rad);
        let ws = 0;
        for (let i = i0; i <= i1; i++) { const d = (x0 + (i + 0.5) * colW - x) / rad; if (d > -1 && d < 1) ws += 1 - d * d; }
        if (!(ws > 0)) { h[heap.col(x)] += area / colW; }
        else for (let i = i0; i <= i1; i++) { const d = (x0 + (i + 0.5) * colW - x) / rad; if (d > -1 && d < 1) h[i] += (area * (1 - d * d)) / ws / colW; }
        heap.area += area; markDirty(i0, i1);
        return heap;
      },
      // wake(xa?, xb?): acorda a avalanche numa faixa (ou em tudo) depois de mexer em heap.h na mão
      wake(xa, xb) {
        if (xa === undefined) markDirty(0, n - 1); else markDirty(heap.col(xa), heap.col(xb));
        let s = 0; for (let i = 0; i < n; i++) s += h[i];
        heap.area = s * colW;
        return heap;
      },

      /* ---------- avalanche ---------- */
      // relax(dt) -> área que escorreu: desliza grão das colunas mais altas que o talude de repouso (por material) permite
      relax(dt) {
        const dtt = dt === undefined ? 1 / 60 : dt;
        // decaimento da atividade e do flash dos bolsões
        const dec = Math.exp(-dtt * 5);
        if (heap._actHot) {
          let hot = false;
          for (let i = heap._a0; i <= heap._a1; i++) { const v = act[i] * dec; act[i] = v < 0.02 ? 0 : v; if (act[i]) hot = true; }
          if (!hot) { heap._actHot = false; heap._a0 = n; heap._a1 = -1; }
        }
        heap.flow = 0;
        if (rB < rA) return 0;
        relaxAcc += heap.relaxIters * dtt * 60;
        let it = relaxAcc | 0; relaxAcc -= it; if (it > 6) it = 6;
        let fx = 0;
        const rate = heap.flowRate, defS = heap.repose;
        for (let k = 0; k < it; k++) {
          const a = rA > 0 ? rA - 1 : 0, b = rB < n - 1 ? rB : n - 2;
          let mA = n, mB = -1;
          sweep ^= 1;
          for (let j = a; j <= b; j++) {
            const i = sweep ? j : b - (j - a);
            const d = h[i] - h[i + 1];
            if (d > defS || d < -defS) {
              const hc = d > 0 ? i : i + 1;
              let m = defS;
              if (layers.length) { const mt = matAt(hc, h[hc] - 0.5); if (mt.slope) m = mt.slope; }
              let t = (d > 0 ? d : -d) - m;
              if (t > 0.002) {
                t *= rate;
                if (d > 0) { h[i] -= t; h[i + 1] += t; } else { h[i] += t; h[i + 1] -= t; }
                if (heap.divert) {                         // grãos de verdade: parte do arroz sai do mapa e rola como partícula
                  const r = d > 0 ? i + 1 : i, tk = heap.divert(r, t * colW) / colW;
                  if (tk > 0) { h[r] -= tk; heap.area -= tk * colW; }
                }
                act[i] += t; act[i + 1] += t * 0.5;
                heap.flow += t * colW; fx += t * colW * (i + 1);
                if (i < mA) mA = i; if (i + 1 > mB) mB = i + 1;
              }
            }
          }
          if (mB < 0) { rA = n; rB = -1; break; }
          rA = mA; rB = mB;
        }
        if (heap.flow > 0) {
          heap.flowX = x0 + (fx / heap.flow) * colW; peakDirty = true;
          heap._actHot = true;
          if (rA - 1 < heap._a0) heap._a0 = Math.max(0, rA - 1);
          if (rB + 1 > heap._a1) heap._a1 = Math.min(n - 1, rB + 1);
        }
        return heap.flow;
      },
      // settle(maxIters=4000): roda a avalanche até parar (carregar save, gerar terreno já assentado)
      settle(maxIters) {
        let k = maxIters || 4000;
        while (rB >= rA && k-- > 0) heap.relax(1 / 60);
        return heap;
      },
      // moving -> true se a avalanche ainda está escorrendo
      get moving() { return rB >= rA; },
      _actHot: false, _a0: n, _a1: -1,

      /* ---------- desenho ---------- */
      // draw(g, view{x0,x1,y0,y1}, time, {outline=true, sparkle=true, grains=true, pockets='all'|'found'|'hint'|false, haze:{col,a0,a1}|0, scale, ol, cache=false})
      //   corte em camadas com grãos, crista ensolarada, sombra nos buracos, bolsões dourados, brilhos e contorno. g já com a câmera aplicada.
      //   cache:true = montanha guardada numa tela de apoio na escala da tela; só refaz as colunas que mudaram (cavar, avalanche),
      //   a faixa nova quando a câmera anda e tudo quando muda zoom/espelho/opções/camadas. Brilhos, flash e grãos rolando ficam vivos.
      //   Com zoom andando (ou câmera girando no tremor) desenha direto. Não mexe em nada da simulação.
      draw,
      // dropCache(): solta a tela de apoio do cache (libera memória; a próxima draw com cache refaz tudo)
      dropCache() { if (BK.cv) { BK.cv.width = BK.cv.height = 0; } BK.cv = null; BK.g = null; BK.sig = ''; BK.w = BK.h = 0; return heap; },
      // cacheStats -> {bakes: retângulos refeitos desde o início, w, h, K}
      get cacheStats() { return { bakes: BK.n, w: BK.w, h: BK.h, K: BK.K }; },
      // prewarm(g): gera as texturas agora (evita o engasgo do primeiro frame)
      prewarm(g) {
        const vs = ['g', 's', 'ca', 'cb'];
        for (let k = 0; k < layers.length; k++) for (let v = 0; v < 4; v++) if (layers[k].tex !== 'mochi' || v < 2) matTex(g, layers[k], vs[v]);
        matTex(g, GOLD_MAT, 'g'); matTex(g, GOLD_MAT, 's');
        return heap;
      },

      /* ---------- save ---------- */
      // serialize({full=false}) -> string compacta (Uint16 em base64; só a faixa que mudou em relação ao original)
      serialize(o) {
        let a = 0, b = n;
        if (!(o && o.full)) {
          while (a < n && Math.abs(h[a] - h0[a]) < 0.02) a++;
          while (b > a && Math.abs(h[b - 1] - h0[b - 1]) < 0.02) b--;
        }
        let mx = 1; for (let i = a; i < b; i++) if (h[i] > mx) mx = h[i];
        const q = 65535 / mx, u8 = new Uint8Array((b - a) * 2);
        for (let i = a; i < b; i++) { const v = Math.round(h[i] * q); u8[(i - a) * 2] = v & 255; u8[(i - a) * 2 + 1] = v >> 8; }
        let s = '';
        for (let i = 0; i < u8.length; i += 4096) s += String.fromCharCode.apply(null, u8.subarray(i, i + 4096));
        let found = '';
        for (let k = 0; k < heap.pockets.length; k++) found += heap.pockets[k].found ? '1' : '0';
        return 'KH1|' + n + '|' + a + '|' + b + '|' + mx.toFixed(3) + '|' + found + '|' + btoa(s);
      },
      // deserialize(dado) -> true se carregou: aceita a string do serialize() ou um array de alturas. Chame depois de generate()/addPocket()
      deserialize(d) {
        try {
          if (typeof d === 'string') {
            const p = d.split('|');
            if (p[0] !== 'KH1' || +p[1] !== n) return false;
            const a = +p[2], b = +p[3], mx = +p[4], bin = atob(p[6]);
            if (!(a >= 0 && b <= n && bin.length === (b - a) * 2)) return false;
            h.set(h0);
            for (let i = a; i < b; i++) h[i] = ((bin.charCodeAt((i - a) * 2) | (bin.charCodeAt((i - a) * 2 + 1) << 8)) * mx) / 65535;
            for (let k = 0; k < heap.pockets.length && k < p[5].length; k++) heap.pockets[k].found = p[5][k] === '1';
          } else if (d && d.length === n) { for (let i = 0; i < n; i++) h[i] = Math.max(0, +d[i] || 0); }
          else return false;
        } catch (e) { return false; }
        heap.wake();
        peakDirty = true;
        return true;
      },
    };

    /* ---------- internos: dados ---------- */
    function reset0() {
      let s = 0, m = 0;
      for (let i = 0; i < n; i++) { s += h0[i]; if (h0[i] > m) m = h0[i]; }
      heap.total = heap.area = s * colW; heap.maxH = m;
      act.fill(0); rA = n; rB = -1; peakDirty = true;
      if (!layers.length) heap.setLayers(opts.layers || [{ id: 'solto', name: 'Arroz Solto', top: 1, col: '#F6F1E4' }]); else rebuild();
      return heap;
    }
    // profundidade da fronteira entre camadas com ondulação suave (não fica uma diagonal reta "colada");
    // mesma função dos dois lados da fronteira, então não abre buraco nem sobrepõe
    function bdepth(i, d) {
      if (!d || !E.Noise || !E.Noise.n1) return d || 0;
      const A = Math.min(34, d * 0.12);
      return Math.max(0, d + (E.Noise.n1(i * colW * 0.006 + d * 0.0137, 77) - 0.5) * 2 * A + (E.Noise.n1(i * colW * 0.031 + d, 31) - 0.5) * A * 0.35);
    }
    // intervalo [lo, hi] (em altura) de cada camada em cada coluna
    function rebuild() {
      layVer++;
      for (let b = 0; b < bands.length; b++) {
        const m = bands[b], nx = bands[b + 1], lo = m.lo, hi = m.hi;
        const byDepth = m.d0 !== undefined || m.d1 !== undefined;
        for (let i = 0; i < n; i++) {
          const H = h0[i];
          let t, l;
          if (byDepth) { t = H - bdepth(i, m.d0 || 0); l = m.d1 !== undefined ? H - bdepth(i, m.d1) : 0; }
          else { t = H * (m.top !== undefined ? m.top : 1); l = nx ? (nx.d0 !== undefined ? H - bdepth(i, nx.d0) : H * (nx.top !== undefined ? nx.top : 0)) : 0; }
          if (b === 0) t = 1e9;                  // o que for empilhado acima da superfície original é da 1ª camada
          if (b === bands.length - 1 || l < 0) l = 0;
          if (t < l) t = l;
          lo[i] = l; hi[i] = t;
        }
      }
      for (let e = 0; e < ells.length; e++) {
        const m = ells[e], el = m.ellipse;
        for (let i = 0; i < n; i++) {
          const dx = (x0 + (i + 0.5) * colW - el.cx) / el.rx, q = 1 - dx * dx;
          if (q > 0) { const s = el.ry * Math.sqrt(q); m.lo[i] = Math.max(0, el.cy - s); m.hi[i] = Math.max(0, el.cy + s); }
          else { m.lo[i] = 0; m.hi[i] = 0; }
        }
      }
    }
    function matAt(i, alt) {
      for (let e = ells.length - 1; e >= 0; e--) { const m = ells[e]; if (alt < m.hi[i] && alt >= m.lo[i]) return m; }
      for (let b = 0; b < bands.length; b++) if (alt >= bands[b].lo[i]) return bands[b];
      return bands[bands.length - 1];
    }
    // fundo do trecho contínuo do material m que contém 'alt' na coluna i
    function segBot(i, alt, m) {
      let bot = m.lo[i];
      if (!m.isEllipse) for (let e = 0; e < ells.length; e++) { const t = ells[e].hi[i]; if (t > bot && t <= alt) bot = t; }
      return bot;
    }
    function pocketAt(x, alt) {
      const P = heap.pockets;
      for (let k = 0; k < P.length; k++) { const p = P[k], dx = x - p.x, dy = alt - p.y; if (dx * dx + dy * dy < p.r * p.r) return p; }
      return null;
    }
    function clearRes() {
      res.got = res.val = res.gold = res.blocked = res.fell = 0; res.hard = 1; res.hardMat = null; res.pocket = null;
      for (let k = 0; k < layers.length; k++) res.byMat[layers[k].id] = 0;
    }
    // tira até 'budget' px (medidos em dureza 1) do topo da coluna i, sem passar de floorAlt
    function takeCol(i, budget, pow, floorAlt, onTake) {
      let hh = h[i], guard = 0;
      const start = hh, xc = x0 + (i + 0.5) * colW, minK = heap.minK, hasP = pk[i];
      while (budget > 1e-5 && hh > floorAlt + 1e-4 && guard++ < 500) {
        const m = matAt(i, hh - 0.01), k = pow / m.hard;
        if (k < 1 && 1 / k > res.hard) res.hard = 1 / k;
        if (k < minK) { res.blocked += budget * colW; res.hardMat = m; break; }
        const eff = k >= 1 ? 1 : k;
        let bot = segBot(i, hh - 0.01, m); if (bot < floorAlt) bot = floorAlt;
        let can = hh - bot; if (hasP && can > 6) can = 6;
        let t = budget * eff; if (t > can) t = can;
        if (!(t > 0)) break;
        const p = hasP ? pocketAt(xc, hh - t * 0.5) : null;
        hh -= t; budget -= t / eff;
        const a = t * colW;
        res.got += a; res.byMat[m.id] += a;
        if (p) {
          res.gold += a; res.val += a * m.val * p.mult;
          if (!p.found) { p.found = true; p.flash = 1; res.pocket = p; if (heap.onPocket) heap.onPocket(p); }
          else if (!res.pocket) res.pocket = p;
        } else res.val += a * m.val;
      }
      if (hh !== start) { h[i] = hh; if (onTake) onTake(i, (start - hh) * colW, y0 - start); }
    }
    function finish(i0, i1) {
      if (res.got > 0) { heap.area -= res.got; markDirty(i0, i1); }
      return res;
    }
    function markDirty(i0, i1) {
      if (i0 < rA) rA = i0; if (i1 > rB) rB = i1;
      peakDirty = true;
    }

    /* ---------- internos: desenho ---------- */
    let M = 0, smooth = false;
    // caminho da superfície entre as amostras ka..kb, deslocado dy pra baixo; cont = continua o caminho atual
    function surfPath(g, ka, kb, dy, cont) {
      if (cont) g.lineTo(px[ka], py[ka] + dy); else g.moveTo(px[ka], py[ka] + dy);
      if (smooth && kb - ka > 1) {
        for (let k = ka + 1; k < kb; k++) g.quadraticCurveTo(px[k], py[k] + dy, (px[k] + px[k + 1]) * 0.5, (py[k] + py[k + 1]) * 0.5 + dy);
        g.lineTo(px[kb], py[kb] + dy);
      } else for (let k = ka + 1; k <= kb; k++) g.lineTo(px[k], py[k] + dy);
    }
    function bodyPath(g, dy) {
      g.beginPath(); surfPath(g, 0, M - 1, dy, false);
      g.lineTo(px[M - 1], y0); g.lineTo(px[0], y0); g.closePath();
    }
    function ellipsesPath(g, ng, sx, sy, kx, ky, only) {
      g.beginPath();
      for (let q = 0; q < ng; q++) {
        if (only >= 0 && gM[q] !== only) continue;
        const a = gA[q], rx = gL[q] * kx, ry = gW[q] * ky, x = gX[q] + sx * gL[q], y = gY[q] + sy * gW[q];
        g.moveTo(x + rx * Math.cos(a), y + rx * Math.sin(a));
        g.ellipse(x, y, rx, ry, a, 0, TAU);
      }
    }
    function pocketPath(g, p, k) {
      const sh = p.shape, N = sh.length, cy = y0 - p.y;
      g.beginPath();
      for (let j = 0; j <= N; j++) {
        const a0 = (j / N) * TAU, a1 = ((j + 1) / N) * TAU, r0 = p.r * sh[j % N] * k, r1 = p.r * sh[(j + 1) % N] * k;
        const xA = p.x + Math.cos(a0) * r0, yA = cy + Math.sin(a0) * r0 * 0.86, xB = p.x + Math.cos(a1) * r1, yB = cy + Math.sin(a1) * r1 * 0.86;
        if (j === 0) g.moveTo((xA + xB) * 0.5, (yA + yB) * 0.5);
        else g.quadraticCurveTo(xA, yA, (xA + xB) * 0.5, (yA + yB) * 0.5);
      }
      g.closePath();
    }
    function sparkle(g, x, y, s) {
      const t = s * 0.22;
      g.fillRect(x - s, y - t, s * 2, t * 2); g.fillRect(x - t, y - s, t * 2, s * 2);
    }

    // amostra a superfície na vista (px/py/ph/pc, M, KA..KB, STEP, smooth). false = nada da montanha à vista
    let STEP = 1, KA = 0, KB = 0, I0 = 0, I1 = 0;
    function sample(view, S) {
      let i0 = view ? Math.floor((view.x0 - x0) / colW) - 2 : 0, i1 = view ? Math.ceil((view.x1 - x0) / colW) + 2 : n - 1;
      if (i0 < 0) i0 = 0; if (i1 > n - 1) i1 = n - 1;
      if (i1 - i0 < 1) return false;
      /* amostragem (decima colunas quando afastado: >= ~1,6 px de dispositivo por vértice) */
      const step = Math.max(1, Math.floor(1.6 / (colW * S)));
      i0 -= i0 % step;
      M = 0;
      let anyH = false, ka = -1, kb = -1;
      for (let i = i0; i <= i1; i += step) {
        let s = 0, c = 0;
        for (let j = i; j < i + step && j < n; j++) { s += h[j]; c++; }
        s /= c;
        pc[M] = i + (c >> 1); px[M] = x0 + (i + c * 0.5) * colW; ph[M] = s; py[M] = y0 - s;
        if (s > 0.05) { anyH = true; if (ka < 0) ka = M; kb = M; }
        M++;
      }
      if (!anyH || M < 2) return false;
      KA = Math.max(0, ka - 1); KB = Math.min(M - 1, kb + 1); STEP = step; I0 = i0; I1 = i1;
      smooth = step === 1 && colW * S > 2.5;
      return true;
    }

    function draw(g, view, time, o) {
      o = o || NO;
      const S = o.scale || scaleOf(g);
      time = time || 0;
      const dtDraw = lastT < 0 ? 0 : Math.min(0.1, Math.max(0, time - lastT)); lastT = time;
      if (o.cache && view && drawCached(g, view, time, o, S, dtDraw)) return;
      if (!drawStatic(g, view, time, o, S, dtDraw, true)) return;
      drawLive(g, view, time, o, S, dtDraw, false);
    }

    // parte parada da montanha (corpo, camadas, crista, grãos, contorno, bolsões sem brilho): só depende de h, h0, camadas, bolsões
    // achados, escala e opções. live = brilho/flash dos bolsões junto (desenho direto, ordem de sempre)
    function drawStatic(g, view, time, o, S, dt, live) {
      if (!sample(view, S)) return false;
      const vy0 = view ? view.y0 : y0 - heap.maxH * 1.5 - 200;
      pickLod(S);
      const ka = KA, kb = KB, step = STEP, i0 = I0, i1 = I1;
      const ol = o.outline === false ? 0 : Math.max(o.ol || 1.25, 1.25 / S);
      const pxw = 1 / S; // 1 px de dispositivo em unidades de mundo

      /* grãos individuais da crista (só de perto): calculados uma vez, usados no contorno e no preenchimento */
      let ng = 0;
      const gAlpha = o.grains === false ? 0 : U.clamp((S - 1.25) / 0.5, 0, 1);
      if (gAlpha > 0) {
        const gk = 1 + (1 - LNear) * 0.7; // no LOD médio o grão da textura dobra; a crista acompanha
        for (let i = Math.max(1, i0); i <= i1 && i < n - 1 && ng < GMAX - 2; i++) {
          if (h[i] < 0.6) continue;
          const mt = matAt(i, h[i] - 0.01);
          if (mt.tex === 'mochi') continue;
          const flat = mt.tex === 'pressed';
          const sl = Math.atan2(-(h[i + 1] - h[i - 1]), colW * 2);
          for (let j = 0; j < 2; j++) {
            const b = (i * 2 + j) * 4, fx = gr[b];
            const u = i + fx - 0.5, ia = u | 0, f = u - ia;
            const alt = h[ia] + (h[ia + 1] - h[ia]) * f;
            const W = (flat ? 1.15 : 1.5) * (0.85 + gr[b + 3] * 0.4) * gk;
            gX[ng] = x0 + (i + fx) * colW; gY[ng] = y0 - alt - W * (gr[b + 1] * 0.75 - 0.25);
            gA[ng] = sl + (gr[b + 2] - 0.5) * (flat ? 0.5 : 1.9);
            gL[ng] = (flat ? 3.6 : 3.3) * (0.85 + gr[b + 3] * 0.4) * gk; gW[ng] = W; gM[ng] = mt.index;
            ng++;
          }
        }
      }

      /* 1. contorno primeiro (o corpo cobre a metade de dentro): silhueta = linha da superfície + grãos que saem dela */
      g.lineJoin = 'round'; g.lineCap = 'round';
      if (ol > 0) {
        g.strokeStyle = LINE; g.lineWidth = ol * 2;
        g.beginPath(); surfPath(g, ka, kb, 0, false); g.stroke();
        if (ng) { g.globalAlpha = gAlpha; g.lineWidth = ol * 1.7; ellipsesPath(g, ng, 0, 0, 0.5, 0.5, -1); g.stroke(); g.globalAlpha = 1; }
      }

      /* 2. corpo, recortado pela superfície */
      g.save();
      bodyPath(g, 0); g.clip();

      // faixas (da superfície pro fundo)
      for (let b = 0; b < bands.length; b++) {
        const m = bands[b], lo = m.lo, hi = m.hi;
        let vis = false;
        for (let k = 0; k < M; k++) { const c = pc[k]; if (hi[c] - lo[c] > 0.01 && lo[c] < ph[k]) { vis = true; break; } }
        if (!vis) continue;
        g.beginPath();
        if (b === 0) { g.moveTo(px[0], vy0 - 20); g.lineTo(px[M - 1], vy0 - 20); }
        else { g.moveTo(px[0], y0 - hi[pc[0]]); for (let k = 1; k < M; k++) g.lineTo(px[k], y0 - hi[pc[k]]); }
        for (let k = M - 1; k >= 0; k--) g.lineTo(px[k], y0 - lo[pc[k]] + (b < bands.length - 1 ? pxw : 0));
        g.closePath();
        fillMat(g, m);
      }
      // divisas entre faixas: acompanham a superfície original
      for (let b = 1; b < bands.length; b++) {
        const m = bands[b], hi = m.hi;
        g.beginPath(); g.moveTo(px[0], y0 - hi[pc[0]]);
        for (let k = 1; k < M; k++) g.lineTo(px[k], y0 - hi[pc[k]]);
        g.strokeStyle = U.rgba(m.tone.gap, 0.75); g.lineWidth = Math.max(1.1, 1.5 * pxw); g.stroke();
        g.beginPath(); g.moveTo(px[0], y0 - hi[pc[0]] + Math.max(1.4, 1.8 * pxw));
        for (let k = 1; k < M; k++) g.lineTo(px[k], y0 - hi[pc[k]] + Math.max(1.4, 1.8 * pxw));
        g.strokeStyle = U.rgba(m.tone.top, 0.6); g.lineWidth = Math.max(0.8, pxw); g.stroke();
      }
      // regiões em elipse (núcleo)
      for (let e = 0; e < ells.length; e++) {
        const m = ells[e], el = m.ellipse;
        if (view && (el.cx + el.rx < view.x0 || el.cx - el.rx > view.x1)) continue;
        g.beginPath(); g.ellipse(el.cx, y0 - el.cy, el.rx, el.ry, 0, 0, TAU);
        fillMat(g, m);
        g.strokeStyle = U.rgba(m.tone.gap, 0.9); g.lineWidth = Math.max(2, 2.4 * pxw); g.stroke();
        g.beginPath(); g.ellipse(el.cx, y0 - el.cy, Math.max(1, el.rx - Math.max(3, 3.4 * pxw)), Math.max(1, el.ry - Math.max(3, 3.4 * pxw)), 0, 0, TAU);
        g.strokeStyle = U.rgba(m.tone.hi, 0.55); g.lineWidth = Math.max(1.2, 1.4 * pxw); g.stroke();
      }

      // peso da profundidade: dois degraus de tom chapado abaixo da superfície atual (mais escuro e apertado lá embaixo)
      const dk = Math.max(1, 0.7 * pxw);
      g.fillStyle = 'rgba(74,46,20,.045)';
      bodyPath(g, 18 * dk); g.fill();
      bodyPath(g, 46 * dk); g.fill();
      bodyPath(g, 105 * dk); g.fill();
      // sombra na base
      const bs = Math.max(10, Math.min(60, heap.maxH * 0.03));
      g.fillStyle = 'rgba(74,46,20,.09)';
      g.fillRect(px[0], y0 - bs, px[M - 1] - px[0], bs); g.fillRect(px[0], y0 - bs * 0.45, px[M - 1] - px[0], bs * 0.45);

      // bolsões dourados
      if (o.pockets !== false && heap.pockets.length) drawPockets(g, view, time, S, o.pockets || 'all', dt, live);

      // crista: grãos maiores e ensolarados nos primeiros px abaixo da superfície, por material
      const cT = 9 * (1 + (1 - LNear) * 0.6);
      if (S >= 0.65) {
        const hdC = S >= 4.2, cScale = hdC ? 0.125 : LNear > 0.5 ? 0.25 : 0.5, ca = S < 0.85 ? (S - 0.65) / 0.2 : 1;
        for (let L = 0; L < layers.length; L++) {
          const m = layers[L], lo = m.lo, hi = m.hi;
          let vis = false;
          for (let k = 0; k < M; k++) { const c = pc[k]; if (ph[k] > lo[c] + 0.01 && ph[k] - cT * 2 < hi[c] && hi[c] > lo[c]) { vis = true; break; } }
          if (!vis) continue;
          for (let pass = 0; pass < 2; pass++) {
            const a0 = pass * cT, a1 = a0 + cT;
            g.beginPath();
            for (let k = 0; k < M; k++) { const c = pc[k]; let t = ph[k] - a0; if (t > hi[c]) t = hi[c]; const y = y0 - t; if (k) g.lineTo(px[k], y); else g.moveTo(px[k], y); }
            for (let k = M - 1; k >= 0; k--) {
              const c = pc[k]; let t = ph[k] - a0; if (t > hi[c]) t = hi[c];
              let bt = ph[k] - a1; if (bt < lo[c]) bt = lo[c]; if (bt > t) bt = t;
              g.lineTo(px[k], y0 - bt);
            }
            g.closePath();
            g.globalAlpha = ca;
            if (m.tex === 'mochi') { g.fillStyle = pass ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.34)'; g.fill(); }
            else { useTex(g, matTex(g, m, (pass ? 'cb' : 'ca') + (hdC ? '2' : '')), cScale); g.fill(); }
          }
        }
        g.globalAlpha = 1;
      }
      if (S < 0.85) { // de longe: uma faixa clara chapada segura a leitura da crista
        g.globalAlpha = S < 0.65 ? 1 : 1 - (S - 0.65) / 0.2;
        g.fillStyle = 'rgba(255,253,244,.34)';
        g.beginPath(); surfPath(g, 0, M - 1, 0, false);
        for (let k = M - 1; k >= 0; k--) g.lineTo(px[k], py[k] + 7 * pxw);
        g.closePath(); g.fill();
        g.globalAlpha = 1;
      }

      // oclusão: buracos e pés de barranco ficam mais escuros (faixa chapada de espessura variável)
      {
        const w = 6;
        let sum = 0, cnt = 0, any = false;
        for (let k = 0; k < Math.min(M, w); k++) { sum += ph[k]; cnt++; }
        const cap = Math.max(22, 16 * pxw);
        for (let k = 0; k < M; k++) {
          if (k + w < M) { sum += ph[k + w]; cnt++; }
          if (k - w - 1 >= 0) { sum -= ph[k - w - 1]; cnt--; }
          const c = pc[k];
          let t = (sum / cnt - ph[k]) * 1.5;
          const dug = (h0[c] - ph[k]) * 0.12; if (dug > t) t = dug > 9 ? 9 : dug;
          t = t < 0 ? 0 : t > cap ? cap : t;
          th[k] = t; if (t > 0.3) any = true;
        }
        if (any) {
          g.fillStyle = 'rgba(64,38,16,.06)';
          for (let pass = 0; pass < 2; pass++) {
            const kk = pass ? 0.45 : 1;
            g.beginPath(); surfPath(g, 0, M - 1, 0, false);
            for (let k = M - 1; k >= 0; k--) g.lineTo(px[k], py[k] + th[k] * kk);
            g.closePath(); g.fill();
          }
        }
      }

      // filete de luz ao longo da crista (por dentro do contorno)
      {
        const rim = Math.max(0.9, 1.5 * pxw);
        g.strokeStyle = 'rgba(255,254,246,.55)'; g.lineWidth = (ol + rim) * 1.6;
        g.beginPath(); surfPath(g, ka, kb, 0, false); g.stroke();
      }

      // névoa de distância (opcional): tinge o corpo, mais forte no alto
      if (o.haze) {
        const hz = o.haze, col = hz.col || PAL.sky, a0 = hz.a0 !== undefined ? hz.a0 : 0.04, a1 = hz.a1 !== undefined ? hz.a1 : 0.3;
        const top = y0 - heap.maxH, N = 6;
        for (let k = 0; k < N; k++) { // degraus chapados, sem gradiente liso
          g.fillStyle = U.rgba(col, a0 + ((a1 - a0) * (k + 0.5)) / N);
          const ya = y0 + ((top - y0) * k) / N, yb = k === N - 1 ? vy0 - 50 : y0 + ((top - y0) * (k + 1)) / N;
          g.fillRect(px[0], yb, px[M - 1] - px[0], ya - yb);
        }
      }
      g.restore();

      /* 3. grãos da crista por cima (barriga, corpo, brilho), em lote por material */
      if (ng) {
        g.globalAlpha = gAlpha;
        for (let L = 0; L < layers.length; L++) {
          const m = layers[L]; let c = 0;
          for (let q = 0; q < ng; q++) if (gM[q] === L) c++;
          if (!c) continue;
          g.fillStyle = m.tone.mid; ellipsesPath(g, ng, 0, 0, 0.5, 0.5, L); g.fill();
          g.fillStyle = m.tone.top; ellipsesPath(g, ng, -0.03, -0.13, 0.44, 0.35, L); g.fill();
          g.fillStyle = m.tone.hi; ellipsesPath(g, ng, -0.08, -0.2, 0.2, 0.11, L); g.fill();
        }
        g.globalAlpha = 1;
      }
      return true;
    }

    // parte viva (depois de sample() na vista atual): grãos rolando, brilhinhos e, se pockets, brilho/flash dos bolsões
    function drawLive(g, view, time, o, S, dt, pockets) {
      const step = STEP, pxw = 1 / S, ol = o.outline === false ? 0 : Math.max(o.ol || 1.25, 1.25 / S);
      if (pockets && o.pockets !== false && heap.pockets.length) livePockets(g, view, time, S, o.pockets || 'all', dt);
      /* 4. grãos rolando onde a avalanche está escorrendo */
      if (heap._actHot && S > 0.12 && o.rolling !== false) {   // rolling:false quando o jogo usa E.SlideFX
        const big = S >= 0.9, rs = big ? 1 : 1.3 * pxw;
        g.fillStyle = PAL.rice; g.strokeStyle = LINE; g.lineWidth = Math.max(0.45, 0.8 * pxw);
        g.beginPath();
        let cnt = 0;
        for (let k = 1; k < M - 1 && cnt < 260; k++) {
          const c = pc[k], a = act[c];
          if (a < 0.12) continue;
          const dir = ph[k + 1] < ph[k - 1] ? 1 : -1, hsh = gr[c * 8 + 5];
          const nn = a > 1.2 ? 2 : 1;
          for (let j = 0; j < nn; j++) {
            const f = (time * (2.2 + hsh * 1.6) + hsh * 7 + j * 0.5) % 1;
            const x = px[k] + dir * (f - 0.5) * colW * step * 2.4;
            const kx = k + (dir * (f - 0.5) > 0 ? dir : 0), y = (kx >= 0 && kx < M ? (py[k] + py[kx]) * 0.5 : py[k]) - Math.abs(Math.sin(f * Math.PI * 2)) * (big ? 2.4 : 2.5 * pxw) - rs - (big ? 0 : ol * 1.3);
            if (big) { const an = f * 9 * dir; g.moveTo(x + 1.7 * Math.cos(an), y + 1.7 * Math.sin(an)); g.ellipse(x, y, 1.7, 0.85, an, 0, TAU); }
            else g.rect(x - rs, y - rs, rs * 2, rs * 2);
            cnt++;
          }
        }
        if (cnt) { if (big) g.stroke(); g.fill(); }
      }

      /* 5. brilhinhos */
      if (o.sparkle !== false) {
        const vw = px[M - 1] - px[0];
        const slot = Math.pow(2, Math.ceil(Math.log2(Math.max(8, vw / 30))));
        const s0 = Math.floor(px[0] / slot), s1 = Math.ceil(px[M - 1] / slot);
        g.fillStyle = '#FFFFFF';
        for (let s = s0; s <= s1; s++) {
          const r1 = E.hash(s * 3 + 1), r2 = E.hash(s * 3 + 2), r3 = E.hash(s * 3 + 3);
          const tw = Math.sin(time * (1.6 + r2 * 2.4) + r1 * 40);
          if (tw < 0.55) continue;
          const x = (s + r1) * slot;
          if (x < px[0] || x > px[M - 1]) continue;
          const alt = heap.height(x);
          if (alt < 3) continue;
          const sz = ((tw - 0.55) / 0.45) * (1.6 + r3 * 1.8) * Math.max(pxw, 0.55);
          sparkle(g, x, y0 - alt + (2 + r3 * 14) * Math.max(pxw, 0.6), sz);
        }
      }
    }

    /* ---------- montanha guardada (o.cache): o corpo vai pra uma tela de apoio na escala da tela (1 pixel = 1 pixel, sem
       reamostrar) e só os retângulos das colunas que mudaram são refeitos; vivos por cima: brilhos, flash, grãos rolando.
       Refaz tudo quando muda escala/espelho/opções/camadas; câmera andando = copia o que já tem e desenha só a faixa nova. */
    const BK = { cv: null, g: null, K: 0, mir: 0, sig: '', bx: 0, by: 0, ox: 0, oy: 0, w: 0, h: 0, hs: null, fd: '', lastK: 0, n: 0 };
    const BV = { x0: 0, x1: 0, y0: 0, y1: 0 };
    function bakeMargin(K) { const step = Math.max(1, Math.floor(1.6 / (colW * K))); return (8 * step + 4) * colW + 24 / K; }
    function foundSig() { let f = ''; for (let k = 0; k < heap.pockets.length; k++) f += heap.pockets[k].found ? '1' : '0'; return f; }
    // refaz o retângulo (pixels da tela de apoio) com o h atual
    function bakeRect(o, rx, ry, rw, rh) {
      if (rx < 0) { rw += rx; rx = 0; } if (ry < 0) { rh += ry; ry = 0; }
      if (rx + rw > BK.w) rw = BK.w - rx; if (ry + rh > BK.h) rh = BK.h - ry;
      if (rw <= 0 || rh <= 0) return;
      heap._lastBake = [rx, ry, rw, rh];
      const c = BK.g, K = BK.K, E2 = bakeMargin(K);
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(rx, ry, rw, rh);
      c.save(); c.beginPath(); c.rect(rx, ry, rw, rh); c.clip();
      c.setTransform(K, 0, 0, K, BK.bx - BK.ox, BK.by - BK.oy);
      BV.x0 = (rx + BK.ox - BK.bx) / K - E2; BV.x1 = (rx + rw + BK.ox - BK.bx) / K + E2;
      BV.y0 = (ry + BK.oy - BK.by) / K - E2; BV.y1 = (ry + rh + BK.oy - BK.by) / K + E2;
      drawStatic(c, BV, 0, o, K, 0, false);
      c.restore();
      BK.n++;
    }
    function drawCached(g, view, time, o, S, dt) {
      const m = g.getTransform();
      if (m.b || m.c || !(m.d > 0)) return false;
      const K = m.d;
      if (Math.abs(Math.abs(m.a) - K) > K * 1e-7 || K * colW < 0.05) return false;
      const mir = m.a < 0 ? 1 : 0;
      const stable = K === BK.lastK; BK.lastK = K;
      if (K !== BK.K && !stable) return false;            // zoom ainda andando: desenha direto até assentar
      // pedaço da montanha que aparece (mundo)
      const padW = 10 + 6 / K, top = y0 - Math.max(1, heap.peak().h) - padW, bot = y0 + padW;
      const ax0 = Math.max(view.x0, x0 - padW), ax1 = Math.min(view.x1, x0 + n * colW + padW), ay0 = Math.max(view.y0, top), ay1 = Math.min(view.y1, bot);
      if (ax1 <= ax0 || ay1 <= ay0) return false;          // nada à vista: o caminho direto sai cedo
      const hz = o.haze, sig = K + '|' + mir + '|' + (o.outline === false ? 0 : o.ol || 1) + '|' + (o.grains === false ? 0 : 1) + '|' + (o.pockets === false ? 0 : o.pockets || 'all') + '|' +
        (hz ? (hz.col || '') + ',' + hz.a0 + ',' + hz.a1 : '') + '|' + layVer + '|' + n;
      const vw = view.x1 - view.x0, vh = view.y1 - view.y0;
      // janela desejada (mundo), do tamanho da vista + folga, presa à montanha
      const wantW = Math.min(vw * 1.3, x0 + n * colW + padW - (x0 - padW)), wantH = Math.min(vh * 1.2, bot - top);
      const cw = Math.ceil(wantW * K) + 4, ch = Math.ceil(wantH * K) + 4;
      const cx = (view.x0 + view.x1) / 2, cy = (view.y0 + view.y1) / 2;
      let full = sig !== BK.sig || !BK.cv || cw > BK.w || ch > BK.h || cw < BK.w * 0.7 || ch < BK.h * 0.7;
      if (full) {
        if (!BK.cv) { BK.cv = doc.createElement('canvas'); BK.g = BK.cv.getContext('2d'); }
        BK.w = BK.cv.width = cw; BK.h = BK.cv.height = ch;
        BK.K = K; BK.mir = mir; BK.sig = sig;
        BK.bx = mir ? Math.ceil(m.e) - m.e : m.e - Math.floor(m.e); BK.by = m.f - Math.floor(m.f);
        if (!BK.hs || BK.hs.length !== n) BK.hs = new Float32Array(n);
      }
      // janela atual em mundo
      const wx0 = (BK.ox - BK.bx) / K, wy0 = (BK.oy - BK.by) / K, wx1 = wx0 + BK.w / K, wy1 = wy0 + BK.h / K;
      const inside = !full && ax0 >= wx0 && ax1 <= wx1 && ay0 >= wy0 && ay1 <= wy1;
      heap._dbg = [full, ax0, ax1, ay0, ay1, wx0, wx1, wy0, wy1, view.x0, view.x1, view.y0, view.y1, top, bot].map(v => typeof v === "number" ? +v.toFixed(2) : v);
      if (!full) {
        // colunas que mudaram desde a última vez (inclusive as da folga, que mexem na sombra de dentro)
        const E2 = bakeMargin(K), hs = BK.hs;
        let c0 = Math.floor((wx0 - E2 - x0) / colW), c1 = Math.ceil((wx1 + E2 - x0) / colW);
        if (c0 < 0) c0 = 0; if (c1 > n - 1) c1 = n - 1;
        let ra = -1, rb = -1, lo = 1e9, hi = -1e9, tot = 0;
        const runs = [];
        for (let i = c0; i <= c1 + 1; i++) {
          const ch2 = i <= c1 && h[i] !== hs[i];
          if (ch2) {
            if (ra >= 0 && i - rb > 24) { runs.push(ra, rb, lo, hi); tot += rb - ra; ra = -1; }
            if (ra < 0) { ra = i; lo = 1e9; hi = -1e9; }
            rb = i;
            const a = h[i] < hs[i] ? h[i] : hs[i], b = h[i] > hs[i] ? h[i] : hs[i];
            if (a < lo) lo = a; if (b > hi) hi = b;
            hs[i] = h[i];
          } else if (ra >= 0 && (i > c1 || i - rb > 24)) { runs.push(ra, rb, lo, hi); tot += rb - ra; ra = -1; }
        }
        if (tot * colW > (wx1 - wx0) * 0.6) full = true;
        else {
          const stepK = Math.max(1, Math.floor(1.6 / (colW * K))), dk = Math.max(1, 0.7 / K), deep = Math.max(105 * dk, 22, 16 / K, 30) + 12 + 6 / K, fx = E2 + colW;
          for (let r = 0; r < runs.length; r += 4) {
            // a sombra de oclusão usa a média das vizinhas: o retângulo pega a altura mais alta em volta
            let lo2 = runs[r + 2], hi2 = runs[r + 3];
            const ia = Math.max(0, runs[r] - 8 * stepK - 2), ib = Math.min(n - 1, runs[r + 1] + 8 * stepK + 2);
            for (let i = ia; i <= ib; i++) { if (h[i] > hi2) hi2 = h[i]; if (h[i] < lo2) lo2 = h[i]; }
            const xa = x0 + runs[r] * colW - fx, xb = x0 + (runs[r + 1] + 1) * colW + fx;
            const ya = y0 - hi2 - padW, yb = y0 - lo2 + deep;
            const rx = Math.floor(K * xa + BK.bx) - BK.ox, ry = Math.floor(K * ya + BK.by) - BK.oy;
            bakeRect(o, rx, ry, Math.ceil(K * xb + BK.bx) - BK.ox - rx, Math.ceil(K * yb + BK.by) - BK.oy - ry);
          }
        }
        // bolsão achado agora: refaz o retângulo dele
        const fd = foundSig();
        if (!full && fd !== BK.fd) {
          for (let k = 0; k < heap.pockets.length; k++) {
            if (fd[k] === BK.fd[k]) continue;
            const p = heap.pockets[k], rr = p.r * 1.3 + 8 + 6 / K;
            const rx = Math.floor(K * (p.x - rr) + BK.bx) - BK.ox, ry = Math.floor(K * (y0 - p.y - rr) + BK.by) - BK.oy;
            bakeRect(o, rx, ry, Math.ceil(K * rr * 2) + 2, Math.ceil(K * rr * 2) + 2);
          }
          BK.fd = fd;
        }
      }
      if (full || !inside) {
        // nova janela: centrada na vista, presa à montanha
        let nx0 = cx - BK.w / K / 2, ny0 = cy - BK.h / K / 2;
        const lx0 = x0 - padW, lx1 = x0 + n * colW + padW + 2 / K, b2 = bot + 2 / K;   // +2 px: o arredondamento pra baixo não corta a borda
        if (nx0 + BK.w / K > lx1) nx0 = lx1 - BK.w / K; if (nx0 < lx0) nx0 = lx0;
        if (ny0 + BK.h / K > b2) ny0 = b2 - BK.h / K; if (ny0 < top) ny0 = top;
        const nox = Math.floor(K * nx0 + BK.bx), noy = Math.floor(K * ny0 + BK.by);
        const dx = BK.ox - nox, dy = BK.oy - noy;
        if (!full && Math.abs(dx) < BK.w * 0.75 && Math.abs(dy) < BK.h * 0.75) {
          // câmera andou: copia o que já está pronto e desenha só as faixas novas
          const c = BK.g;
          c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'copy'; c.drawImage(BK.cv, dx, dy); c.globalCompositeOperation = 'source-over';
          BK.ox = nox; BK.oy = noy;
          if (dx > 0) bakeRect(o, 0, 0, dx, BK.h); else if (dx < 0) bakeRect(o, BK.w + dx, 0, -dx, BK.h);
          if (dy > 0) bakeRect(o, 0, 0, BK.w, dy); else if (dy < 0) bakeRect(o, 0, BK.h + dy, BK.w, -dy);
        } else {
          BK.ox = nox; BK.oy = noy;
          bakeRect(o, 0, 0, BK.w, BK.h);
          BK.hs.set(h); BK.fd = foundSig();
        }
      }
      // carimba só o pedaço que aparece, pixel com pixel (translação inteira, sem suavizar)
      const cvw = g.canvas.width, cvh = g.canvas.height;
      const D = Math.round(mir ? BK.bx + m.e - BK.ox : BK.ox - BK.bx + m.e), Dy = Math.round(BK.oy - BK.by + m.f);
      let u0 = mir ? D - cvw : -D, u1 = mir ? D : cvw - D, v0 = -Dy, v1 = cvh - Dy;
      if (u0 < 0) u0 = 0; if (v0 < 0) v0 = 0; if (u1 > BK.w) u1 = BK.w; if (v1 > BK.h) v1 = BK.h;
      if (u1 > u0 && v1 > v0) {
        g.save(); g.setTransform(mir ? -1 : 1, 0, 0, 1, D, Dy); g.imageSmoothingEnabled = false;
        g.drawImage(BK.cv, u0, v0, u1 - u0, v1 - v0, u0, v0, u1 - u0, v1 - v0);
        g.restore();
      }
      if (sample(view, S)) drawLive(g, view, time, o, S, dt, true);
      return true;
    }

    function drawPockets(g, view, time, S, mode, dt, live) {
      const P = heap.pockets, pxw = 1 / S;
      for (let k = 0; k < P.length; k++) {
        const p = P[k];
        if (live && p.flash > 0) p.flash = Math.max(0, p.flash - dt * 1.6);
        if (mode === 'found' && !p.found) continue;
        if (view && (p.x + p.r * 1.2 < view.x0 || p.x - p.r * 1.2 > view.x1 || y0 - p.y + p.r < view.y0 || y0 - p.y - p.r > view.y1)) continue;
        // só o que ainda está enterrado aparece (o recorte do corpo cuida do resto)
        if (p.y - p.r > heap.height(p.x) + p.r) continue;
        const pa = mode === 'hint' && !p.found ? 0.4 : 1;
        g.globalAlpha = pa;
        pocketPath(g, p, 1);
        fillMat(g, GOLD_MAT);
        g.strokeStyle = PAL.goldD || '#B4852A'; g.lineWidth = Math.max(1.6, 2 * pxw); g.stroke();
        pocketPath(g, p, 1 - Math.min(0.3, Math.max(3.2 * pxw, 3) / p.r));
        g.strokeStyle = 'rgba(255,246,190,.75)'; g.lineWidth = Math.max(1, 1.2 * pxw); g.stroke();
        if (live) pocketFx(g, p, k, time, pxw);
        g.globalAlpha = 1;
      }
    }
    // brilhos que piscam em posições que trocam + flash de quando foi achado
    function pocketFx(g, p, k, time, pxw) {
      const pa = g.globalAlpha;
      g.fillStyle = '#FFFFFF';
      for (let j = 0; j < 3; j++) {
        const ph0 = time * (0.7 + j * 0.23) + p.seed * 9 + j * 2.1, cyc = Math.floor(ph0), f = ph0 - cyc;
        const a = E.hash(cyc * 7 + j + k * 13) * TAU, rr = E.hash(cyc * 11 + j * 5 + k) * p.r * 0.72;
        const sz = Math.sin(f * Math.PI) * Math.max(2.2 * pxw, Math.min(5, p.r * 0.11));
        sparkle(g, p.x + Math.cos(a) * rr, y0 - p.y + Math.sin(a) * rr * 0.8, sz);
      }
      if (p.flash > 0) {
        g.globalAlpha = p.flash;
        pocketPath(g, p, 1 + (1 - p.flash) * 0.25);
        g.strokeStyle = '#FFFFFF'; g.lineWidth = Math.max(3, 4 * pxw) * (0.5 + p.flash); g.stroke();
      }
      g.globalAlpha = pa;
    }
    // só a parte viva dos bolsões (montanha guardada), recortada pelo corpo da vista atual
    function livePockets(g, view, time, S, mode, dt) {
      const P = heap.pockets, pxw = 1 / S;
      let clip = false;
      for (let k = 0; k < P.length; k++) {
        const p = P[k];
        if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 1.6);
        if (mode === 'found' && !p.found) continue;
        if (view && (p.x + p.r * 1.2 < view.x0 || p.x - p.r * 1.2 > view.x1 || y0 - p.y + p.r < view.y0 || y0 - p.y - p.r > view.y1)) continue;
        if (p.y - p.r > heap.height(p.x) + p.r) continue;
        if (!clip) { g.save(); bodyPath(g, 0); g.clip(); clip = true; }
        g.globalAlpha = mode === 'hint' && !p.found ? 0.4 : 1;
        pocketFx(g, p, k, time, pxw);
      }
      if (clip) { g.globalAlpha = 1; g.restore(); }
    }

    if (opts.layers) heap.setLayers(opts.layers);
    return heap;
  }
  E.Heap = Heap;

  /* ======================================================================
     3. Pile — pilha pequena que assenta dentro de um recipiente (caçamba, carrinho, visor do silo)
     ====================================================================== */
  // E.Pile({cap=100, cols=20, slope=.05, max=1.2, col='#F6F1E4', tex='loose', seed}) -> pile
  //   volume em unidades livres (cap = cheio e plano). Perfil interno em colunas que escorrem: o monte cresce onde cai e assenta.
  function Pile(opts) {
    opts = opts || NO;
    const cols = opts.cols || 20;
    const u = new Float32Array(cols), d = new Float32Array(cols);   // alturas (1 = topo do recipiente) reais e mostradas
    const gr = new Float32Array(cols * 4);
    { const r = E.RNG(opts.seed || 4242); for (let i = 0; i < gr.length; i++) gr[i] = r(); }
    const mat = { tex: opts.tex || 'loose', col: opts.col || '#F6F1E4', col2: opts.col2 || null, col3: opts.col3 || null, _tx: null };
    mat.tone = tonesOf(mat.tex, mat.col, mat.col2, mat.col3);
    const sxs = new Float32Array(cols + 2), sys = new Float32Array(cols + 2);
    let live = false;

    function relax(iters) {
      const s = pile.slope * (20 / cols), bias = pile.tilt * s * 2;
      let moved = 0;
      for (let k = 0; k < iters; k++) {
        for (let j = 0; j < cols - 1; j++) {
          const i = k & 1 ? cols - 2 - j : j, df = u[i] - u[i + 1] + bias;
          if (df > s) { let t = (df - s) * 0.35; if (t > u[i]) t = u[i]; u[i] -= t; u[i + 1] += t; moved += t; }
          else if (df < -s) { let t = (-df - s) * 0.35; if (t > u[i + 1]) t = u[i + 1]; u[i] += t; u[i + 1] -= t; moved += t; }
        }
      }
      return moved;
    }
    const pile = {
      cap: opts.cap || 100,
      max: opts.max || 1.2,          // quanto passa do cheio antes de derramar (carga coroada)
      slope: opts.slope || 0.05,     // desnível máximo entre colunas vizinhas (em fração da altura), pra 20 colunas
      tilt: 0,                       // -1..1: inclina o repouso (caçamba basculando, freada)
      v: 0, cols, u, mat,
      // frac -> 0..max (1 = cheio)
      get frac() { return pile.v / pile.cap; },
      // add(v, at=.5 (0..1 ao longo da largura), spread=.16) -> quanto coube (o resto derramou)
      add(v, at, spread) {
        const room = pile.cap * pile.max - pile.v;
        if (v > room) v = room;
        if (!(v > 0)) return 0;
        at = at === undefined ? 0.5 : at; spread = spread || 0.16;
        const c = at * cols - 0.5, rad = Math.max(1, spread * cols);
        let ws = 0;
        for (let i = 0; i < cols; i++) { const q = (i - c) / rad; if (q > -1 && q < 1) ws += 1 - q * q; }
        const dm = (v / pile.cap) * cols;
        if (!(ws > 0)) u[U.clamp(Math.round(c), 0, cols - 1)] += dm;
        else for (let i = 0; i < cols; i++) { const q = (i - c) / rad; if (q > -1 && q < 1) u[i] += (dm * (1 - q * q)) / ws; }
        pile.v += v;
        relax(3);
        return v;
      },
      // take(v, at?) -> quanto saiu: tira do topo (em volta de 'at', ou das colunas mais altas)
      take(v, at) {
        if (v > pile.v) v = pile.v;
        if (!(v > 0)) return 0;
        let need = (v / pile.cap) * cols, guard = 0;
        while (need > 1e-6 && guard++ < 40) {
          let ws = 0;
          if (at !== undefined) { for (let i = 0; i < cols; i++) { const q = (i + 0.5) / cols - at; ws += u[i] > 0 ? 1 / (1 + q * q * 40) : 0; } }
          else for (let i = 0; i < cols; i++) ws += u[i];
          if (!(ws > 0)) break;
          let got = 0;
          for (let i = 0; i < cols; i++) {
            if (u[i] <= 0) continue;
            const q = (i + 0.5) / cols - at, w = at !== undefined ? 1 / (1 + q * q * 40) : u[i];
            let t = (need * w) / ws; if (t > u[i]) t = u[i];
            u[i] -= t; got += t;
          }
          need -= got;
          if (got < 1e-7) break;
        }
        pile.v -= v; if (pile.v < 1e-6) { pile.v = 0; u.fill(0); }
        relax(2);
        return v;
      },
      // set(frac): define o volume direto (monte já assentado)
      set(f) {
        u.fill(0); pile.v = 0;
        if (f > 0) { pile.add(f * pile.cap, 0.5, 0.3); relax(60); }
        d.set(u);
        return pile;
      },
      // clear(): esvazia
      clear() { u.fill(0); d.fill(0); pile.v = 0; return pile; },
      // update(dt): continua assentando e anima a superfície mostrada (opcional, mas é o que dá vida)
      update(dt) {
        live = true;
        relax(2);
        const k = 1 - Math.exp(-dt * 16);
        for (let i = 0; i < cols; i++) d[i] += (u[i] - d[i]) * k;
      },
      // topAt(at, hmax) -> altura do monte (px) na posição 0..1 (pra pousar grãos em cima)
      topAt(at, hmax) { return (live ? d : u)[U.clamp(Math.floor(at * cols), 0, cols - 1)] * hmax; },
      // draw(g, x (centro), y (fundo), w, hmax, {outline=true, grains=true, scale, clip=true}): monte com grão, crista clara e contorno
      draw(g, x, y, w, hmax, o) {
        if (pile.v <= 0) return;
        o = o || NO;
        const S = o.scale || scaleOf(g), a = live ? d : u, xl = x - w / 2, cw = w / cols, pxw = 1 / S;
        let any = false;
        for (let i = 0; i < cols; i++) { sxs[i] = xl + (i + 0.5) * cw; sys[i] = y - a[i] * hmax; if (a[i] * hmax > 0.3) any = true; }
        if (!any) return;
        const ol = o.outline === false ? 0 : Math.max(o.ol || 1, 1.25 / S);
        const top = g2 => {
          g2.moveTo(xl, y - a[0] * hmax);
          for (let i = 0; i < cols - 1; i++) g2.quadraticCurveTo(sxs[i], sys[i], (sxs[i] + sxs[i + 1]) * 0.5, (sys[i] + sys[i + 1]) * 0.5);
          g2.lineTo(xl + w, y - a[cols - 1] * hmax);
        };
        pickLod(S);
        g.lineJoin = 'round'; g.lineCap = 'round';
        if (ol > 0) { g.strokeStyle = LINE; g.lineWidth = ol * 2; g.beginPath(); top(g); g.stroke(); }
        g.save();
        g.beginPath(); top(g); g.lineTo(xl + w, y); g.lineTo(xl, y); g.closePath(); g.clip();
        fillMat(g, mat);
        // fundo mais escuro, crista ensolarada
        g.fillStyle = 'rgba(74,46,20,.10)';
        g.beginPath(); g.moveTo(xl, y); for (let i = 0; i < cols; i++) g.lineTo(sxs[i], Math.min(y, sys[i] + Math.max(7, hmax * 0.3))); g.lineTo(xl + w, y); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(xl, y); for (let i = 0; i < cols; i++) g.lineTo(sxs[i], Math.min(y, sys[i] + Math.max(14, hmax * 0.6))); g.lineTo(xl + w, y); g.closePath(); g.fill();
        if (S >= 0.65 && mat.tex !== 'mochi') {
          const cT = Math.min(hmax * 0.22, 7 * (1 + (1 - LNear) * 0.6));
          g.beginPath(); top(g);
          for (let i = cols - 1; i >= 0; i--) g.lineTo(sxs[i], sys[i] + cT);
          g.closePath(); useTex(g, matTex(g, mat, 'ca'), LNear > 0.5 ? 0.25 : 0.5); g.fill();
        }
        g.strokeStyle = 'rgba(255,254,246,.9)'; g.lineWidth = (ol + Math.max(0.8, 1.3 * pxw)) * 2;
        g.beginPath(); top(g); g.stroke();
        g.restore();
        // grãos soltos na crista
        if (o.grains !== false && S >= 1.25 && mat.tex !== 'mochi') {
          const tn = mat.tone, gk = 1 + (1 - LNear) * 0.5;
          for (let pass = 0; pass < 4; pass++) {
            g.beginPath();
            for (let i = 1; i < cols - 1; i++) {
              if (a[i] * hmax < 1.5) continue;
              const b = i * 4, L = 3.2 * (0.85 + gr[b + 3] * 0.4) * gk, W = L * 0.45;
              const gx = xl + (i + gr[b]) * cw, gy = sys[i] + (sys[i + (gr[b] > 0.5 ? 1 : -1)] - sys[i]) * Math.abs(gr[b] - 0.5) - W * (gr[b + 1] * 0.6 - 0.2);
              const an = Math.atan2(sys[i + 1] - sys[i - 1], cw * 2) + (gr[b + 2] - 0.5) * 1.8;
              const kx = pass < 2 ? 0.5 : pass === 2 ? 0.44 : 0.2, ky = pass < 2 ? 0.5 : pass === 2 ? 0.35 : 0.11;
              const ox = pass === 2 ? -0.03 * L : pass === 3 ? -0.08 * L : 0, oy = pass === 2 ? -0.13 * W : pass === 3 ? -0.2 * W : 0;
              g.moveTo(gx + ox + L * kx * Math.cos(an), gy + oy + L * kx * Math.sin(an));
              g.ellipse(gx + ox, gy + oy, L * kx, W * ky, an, 0, TAU);
            }
            if (pass === 0) { if (ol > 0) { g.strokeStyle = LINE; g.lineWidth = ol * 1.7; g.stroke(); } }
            else { g.fillStyle = pass === 1 ? tn.mid : pass === 2 ? tn.top : tn.hi; g.fill(); }
          }
        }
      },
    };
    if (opts.frac) pile.set(opts.frac);
    return pile;
  }
  E.Pile = Pile;

  /* ======================================================================
     4. Grains — grãos voando; com deposit, somam na montanha onde pousam ("pilha que assenta")
     ====================================================================== */
  // E.Grains(particles|null, heap, {max=700, g=900, drag=.4, col, onLand(x, y, gold, vol)}) -> grains
  //   Grãos com deposit (ou sem Particles) usam o simulador interno (precisam pousar certinho na superfície);
  //   grãos só decorativos vão pro E.Particles recebido, se houver (shape 'grain').
  function Grains(particles, heap, opts) {
    opts = opts || NO;
    const MAX = opts.max || 700, G = opts.g !== undefined ? opts.g : 900, DRAG = opts.drag !== undefined ? opts.drag : 0.4;
    const X = new Float32Array(MAX), Y = new Float32Array(MAX), VX = new Float32Array(MAX), VY = new Float32Array(MAX);
    const R = new Float32Array(MAX), VR = new Float32Array(MAX), LIFE = new Float32Array(MAX), VOL = new Float32Array(MAX), SZ = new Float32Array(MAX);
    const FL = new Uint8Array(MAX); // 1 ouro, 2 deposita, 4 já quicou
    const usePs = !!(particles && particles.add);
    const cRice = opts.col || PAL.rice, cRiceS = PAL.riceD || '#CFC2A2', cGold = PAL.gold, cGoldD = PAL.goldD;
    const PS = { x: 0, y: 0, vx: 0, vy: 0, g: G, life: 2.5, r: 0, vr: 0, w: 3, h: 1.4, c: cRice, shape: 'grain', land: true, drag: DRAG, fade: 0.2 };
    let n = 0;

    const grains = {
      heap, particles: particles || null,
      onLand: opts.onLand || null,
      // count -> grãos vivos no simulador interno
      get count() { return n; },
      // emit(x, y, n, {vx=0, vy=-120, spread=60, gold=false, deposit=false, vol=0 (área total que os n grãos carregam), size=1, life=4})
      emit(x, y, cnt, o) {
        o = o || NO;
        const vx = o.vx || 0, vy = o.vy !== undefined ? o.vy : -120, sp = o.spread !== undefined ? o.spread : 60;
        const dep = !!o.deposit && !!heap, vol = dep && o.vol ? o.vol / cnt : 0, fl = (o.gold ? 1 : 0) | (dep ? 2 : 0);
        if (usePs && !dep && !o.internal) {
          for (let k = 0; k < cnt; k++) {
            const s = (o.size || 1) * (0.8 + Math.random() * 0.5);
            PS.x = x + (Math.random() - 0.5) * 4; PS.y = y - Math.random() * 3;
            PS.vx = vx + (Math.random() - 0.5) * sp; PS.vy = vy + (Math.random() - 0.5) * sp * 0.8;
            PS.life = o.life || 2.5; PS.r = Math.random() * TAU; PS.vr = (Math.random() - 0.5) * 16;
            PS.w = 3.2 * s; PS.h = 1.5 * s; PS.c = o.gold ? cGold : cRice;
            particles.add(PS); // o Particles copia os campos: o molde é reaproveitado
          }
          return grains;
        }
        for (let k = 0; k < cnt; k++) {
          let i = n;
          if (n < MAX) n++;
          else { // cheio: recicla um aleatório, sem perder o volume que ele carregava
            i = (Math.random() * MAX) | 0;
            if ((FL[i] & 2) && VOL[i] > 0 && heap) heap.add(X[i], VOL[i]);
          }
          X[i] = x + (Math.random() - 0.5) * 4; Y[i] = y - Math.random() * 3;
          VX[i] = vx + (Math.random() - 0.5) * sp; VY[i] = vy + (Math.random() - 0.5) * sp * 0.8;
          R[i] = Math.random() * TAU; VR[i] = (Math.random() - 0.5) * 18;
          LIFE[i] = o.life || 4; VOL[i] = vol; SZ[i] = (o.size || 1) * (0.8 + Math.random() * 0.5); FL[i] = fl;
        }
        return grains;
      },
      // update(dt): gravidade, arrasto, quique e pouso (com deposit: heap.add onde pousou)
      update(dt) {
        const dr = Math.exp(-DRAG * dt), y0 = heap ? heap.y0 : 0;
        for (let i = 0; i < n; i++) {
          VY[i] += G * dt; VX[i] *= dr;
          X[i] += VX[i] * dt; Y[i] += VY[i] * dt; R[i] += VR[i] * dt; LIFE[i] -= dt;
          let dead = LIFE[i] <= 0;
          if (!dead && VY[i] > 0) {
            const fy = heap ? heap.surf(X[i]) : y0;
            if (Y[i] >= fy) {
              if (!(FL[i] & 4) && VY[i] > 90 && Math.random() < 0.45) { // um quique curto, descendo o barranco
                const sl = heap ? heap.slope(X[i]) : 0;
                FL[i] |= 4; Y[i] = fy - 0.5; VY[i] *= -0.22 - Math.random() * 0.12; VX[i] = VX[i] * 0.4 - sl * 60; VR[i] *= 0.6;
              } else dead = true;
            }
          }
          if (dead) {
            if ((FL[i] & 2) && VOL[i] > 0 && heap) heap.add(X[i], VOL[i], heap.colW * 1.6);
            if (grains.onLand) grains.onLand(X[i], Y[i], !!(FL[i] & 1), VOL[i]);
            n--;
            if (i < n) { X[i] = X[n]; Y[i] = Y[n]; VX[i] = VX[n]; VY[i] = VY[n]; R[i] = R[n]; VR[i] = VR[n]; LIFE[i] = LIFE[n]; VOL[i] = VOL[n]; SZ[i] = SZ[n]; FL[i] = FL[n]; i--; }
          }
        }
      },
      // draw(g, view?, scale?): grãos com barriga escura e corpo claro (de longe viram pontinhos)
      draw(g, view, scale) {
        if (!n) return;
        const S = scale || scaleOf(g), big = S >= 0.9, mn = 1.1 / S;
        for (let pass = 0; pass < 4; pass++) {
          const gold = pass >= 2 ? 1 : 0, body = pass & 1;
          if (!big && !body) continue;
          let c = 0;
          g.beginPath();
          for (let i = 0; i < n; i++) {
            if ((FL[i] & 1) !== gold) continue;
            const x = X[i], y = Y[i];
            if (view && (x < view.x0 - 8 || x > view.x1 + 8 || y < view.y0 - 8 || y > view.y1 + 8)) continue;
            if (big) {
              const L = 1.75 * SZ[i], W = 0.85 * SZ[i], a = R[i];
              if (body) { g.moveTo(x - 0.12 + L * 0.86 * Math.cos(a), y - 0.22 + L * 0.86 * Math.sin(a)); g.ellipse(x - 0.12, y - 0.22, L * 0.86, W * 0.7, a, 0, TAU); }
              else { g.moveTo(x + (L + 0.35) * Math.cos(a), y + (L + 0.35) * Math.sin(a)); g.ellipse(x, y, L + 0.35, W + 0.35, a, 0, TAU); }
            } else { const s = Math.max(mn, 1.2 * SZ[i]); g.rect(x - s * 0.5, y - s * 0.5, s, s); }
            c++;
          }
          if (!c) continue;
          g.fillStyle = gold ? (body ? cGold : cGoldD) : body ? cRice : big ? LINE : cRiceS;
          if (big && !body) g.globalAlpha = gold ? 1 : 0.8;
          g.fill();
          g.globalAlpha = 1;
        }
      },
      // floor(x) -> y de mundo do chão (pra passar como floorFn no particles.update)
      floor(x) { return heap ? heap.surf(x) : 0; },
      // clear(): some com todos (sem depositar)
      clear() { n = 0; return grains; },
      // flush(): pousa todos agora (deposita o que carregavam); útil antes de salvar
      flush() {
        for (let i = 0; i < n; i++) if ((FL[i] & 2) && VOL[i] > 0 && heap) heap.add(X[i], VOL[i]);
        n = 0; return grains;
      },
    };
    return grains;
  }
  E.Grains = Grains;

  /* ======================================================================
     5. SlideFX: grãos de verdade descendo a encosta durante a avalanche
     ====================================================================== */
  // E.SlideFX(heap, {max=240, g=900, onLand(x, y, speed, mat), carry=.45, grainMass=6, active()}) -> { update(dt, view{x0,x1}), draw(g, zoom=1), list, flush() }
  //   Com carry > 0 ele instala heap.divert: uma fração do arroz que escorrega SAI do mapa de altura e vira grão de verdade,
  //   que rola e, quando para (ou sai da tela), devolve a massa pro mapa onde parou (heap.add). Assim dá pra ver o arroz
  //   descer e se acumular no pé. Só empresta enquanto update() está rodando e dentro da vista; flush() devolve tudo.
  //   Nasce grão onde a coluna está escorrendo (heap.act), na cor do material exposto; ele rola pela superfície
  //   ganhando velocidade no íngreme, dá pulinhos, perde força no plano e some. onLand avisa quando cai de um pulo forte
  //   (o jogo põe poeira/som ali).
  function SlideFX(heap, o) {
    o = o || NO;
    const max = o.max || 240, G = o.g || 900, list = [], free = [], carry = o.carry === undefined ? 0.45 : o.carry, GM = o.grainMass || 6;
    let spawnAcc = 0, lastUpd = 0, vx0 = -1e9, vx1 = 1e9;
    const pool = new Map();                                  // coluna -> massa emprestada esperando virar grão
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    function giveBack(x, m) { if (m > 0) heap.add(x, m, heap.colW * 2); }
    if (carry > 0) heap.divert = (i, area) => {
      if (now() - lastUpd > 200 || list.length >= max || (o.active && !o.active())) return 0;          // sem update recente (jogo acelerado/pausado): não empresta
      const x = heap.colX(i); if (x < vx0 || x > vx1) return 0;
      const take = area * carry; pool.set(i, (pool.get(i) || 0) + take); return take;
    };
    const colOf = m => (m && m.col) || PAL.rice;
    function spawn(i, mass) {
      if (list.length >= max) { if (mass) giveBack(heap.colX(i), mass); return; }
      const x = heap.colX(i) + (Math.random() - 0.5) * heap.colW * 2, y = heap.surf(x);
      const m = heap.topMat ? heap.topMat(x) : null, clump = m && m.hard >= 2 && Math.random() < 0.35;
      const p = free.pop() || {};
      p.x = x; p.y = y - 1; p.vx = (Math.random() - 0.5) * 20; p.vy = 0; p.air = false; p.t = 0; p.still = 0;
      p.r = clump ? 2.6 + Math.random() * 2.2 : 1.5 + Math.random() * 0.8; p.rot = Math.random() * 6.3; p.c = colOf(m); p.m = m; p.clump = clump; p.mass = mass || 0;
      if (p.mass > GM * 2.5) { p.clump = true; p.r = Math.min(6, 2.4 + Math.sqrt(p.mass) * 0.35); }
      list.push(p);
    }
    return {
      list,
      // flush(): devolve pro mapa toda massa que está rolando ou esperando (antes de salvar / trocar de montanha)
      flush() { for (const [i, m] of pool) giveBack(heap.colX(i), m); pool.clear(); for (const p of list) giveBack(p.x, p.mass); list.length = 0; },
      update(dt, v) {
        lastUpd = now(); if (v) { vx0 = v.x0; vx1 = v.x1; }
        // massa emprestada vira grão (ou volta pro mapa se for pouquinha)
        for (const [i, m] of pool) { if (m >= GM) { spawn(i, m); pool.delete(i); } else if (Math.random() < dt * 4) { giveBack(heap.colX(i), m); pool.delete(i); } }
        // nascer: proporcional à atividade das colunas visíveis (só enfeite, sem massa)
        if (heap._actHot && v) {
          const a0 = Math.max(heap._a0, heap.col(v.x0)), a1 = Math.min(heap._a1, heap.col(v.x1)), act = heap.act;
          const step = Math.max(1, Math.round((a1 - a0) / 220));
          spawnAcc += dt * 60;
          if (spawnAcc >= 1) {
            spawnAcc = 0;
            for (let i = a0; i <= a1; i += step) { const a = act[i]; if (a > 0.25 && Math.random() < Math.min(0.3, a * 0.03) * step) spawn(i, 0); }
          }
        }
        for (let k = list.length - 1; k >= 0; k--) {
          const p = list[k]; p.t += dt;
          if (p.air) {
            p.vy += G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 0.2 * dt;
            const sy = heap.surf(p.x);
            if (p.y >= sy) {
              const hit = p.vy;
              p.y = sy;
              if (hit > 140 && o.onLand) o.onLand(p.x, sy, hit, p.m);
              if (hit > 90 && !p.clump) { p.vy = -hit * 0.32; } else { p.air = false; p.vy = 0; }
            }
          } else {
            const sl = heap.slope(p.x);                         // + = sobe pra direita: rola pra esquerda
            const a = -sl / (1 + sl * sl) * G * (p.clump ? 0.8 : 1);
            p.vx += a * dt; p.vx *= 1 - (Math.abs(sl) < 0.35 ? 4 : 1.1) * dt;    // atrito: forte no plano
            const nx = p.x + p.vx * dt, ny = heap.surf(nx);
            // a superfície caiu mais que a "parábola" do grão: ele sai voando (borda convexa)
            if (ny - p.y > Math.abs(p.vx) * dt * 1.8 + 1.5) { p.air = true; p.vy = Math.abs(p.vx) * 0.15; }
            else if (Math.abs(sl) > 1.2 && Math.random() < dt * 3) { p.air = true; p.vy = -40 - Math.random() * 70; }   // pulinho na encosta
            p.x = nx; if (!p.air) p.y = ny;
          }
          p.rot += p.vx * dt * (p.clump ? 0.06 : 0.25);
          p.still = Math.abs(p.vx) < 10 && !p.air ? p.still + dt : 0;
          if (p.still > 0.35 || p.t > 6 || (v && (p.x < v.x0 - 200 || p.x > v.x1 + 200))) { giveBack(p.x, p.mass); list[k] = list[list.length - 1]; list.pop(); free.push(p); }
        }
      },
      draw(g, z) {
        if (!list.length) return;
        const k = Math.max(1, 0.9 / (z || 1));                // longe: grão um pouco maior pra continuar visível
        g.save(); g.lineJoin = 'round';
        for (const p of list) {
          const fade = p.still > 0 ? 1 - p.still / 0.35 : 1, r = p.r * k;
          g.globalAlpha = Math.max(0, fade);
          g.fillStyle = p.c; g.strokeStyle = LINE; g.lineWidth = Math.max(0.5, 0.7 * k);
          g.beginPath();
          if (p.clump) { for (let j = 0; j < 3; j++) { const an = p.rot + j * 2.1; g.moveTo(p.x + Math.cos(an) * r * 0.55 + r * 0.55, p.y - r + Math.sin(an) * r * 0.45); g.arc(p.x + Math.cos(an) * r * 0.55, p.y - r + Math.sin(an) * r * 0.45, r * 0.55, 0, TAU); } }
          else g.ellipse(p.x, p.y - r * 0.6, r, r * 0.5, p.rot, 0, TAU);
          g.fill(); g.stroke();
        }
        g.restore();
      },
    };
  }
  E.SlideFX = SlideFX;

  // E.Terrain: utilitários expostos (gerador de textura de grão pra outros módulos usarem o mesmo arroz)
  //   E.Terrain.texture(g, 'loose'|'pressed'|'mochi'|'gold', col, col2?, col3?, 'g'|'s'|'ca'|'cb') -> CanvasPattern (ladrilho em .canvas)
  //   E.Terrain.fill(g, {tex, col}, escala?) preenche o caminho atual com o LOD certo pra escala
  E.Terrain = {
    texture,
    fill(g, mat, scale) { pickLod(scale || scaleOf(g)); fillMat(g, mat); },
    clearCache() { texCache.clear(); },
  };
})();
