/* Kome no Japão — portal.js
   'portal' = PORTAL ONIGIRI (máquina absurda nº 20 do Pátio, a última do galho Absurdo, camada-cookie.md).
   Quase só efeito: um anel gigante em forma de onigiri (borda de arroz branco, faixa de nori embaixo, ~1.300 px) em pé perto da
   montanha, com um vórtice girando dentro. Ele chupa um rio de grãos da encosta (3 mordidas ao longo da face) e um portal gêmeo,
   menor, do lado do coletor cospe onigiris dourados (dump). Kome fica sentadinho no topo do anel (44 px, pra dar a escala).
   Depende de: core.js, pix.js, shiba.js, fx.js (só Draw/drawShiba de fato). Molde: trembala.js.

   Interface comum: G.Tools.portal = {id, name, kind, w, h, meta, create(opts), update(m,dt,inp), draw(g,m), bite(m), bites(m),
   dump(m), seat(m), dig(m, heap, area, o), horizon(g, o), prebake(level?), silence(m)}.
   Espaço do modelo: origem no chão sob o anel grande; +x = lado da montanha (inp.face); escala fixa 1. Anel de x −650 a +650, topo
   y ≈ −1310; portal gêmeo em dx −1.500 (centro y ≈ −330). Mordidas em dx 1.300 / 1.600 / 1.900 na superfície (inp.floor).
   m.x pega inp.x só no 1º update. inp: x, y, face, floor(x), digging (false = vórtice em marcha lenta, sem chupar), speedMul, parts, night.
   CICLO normal (meta.cycle = 12 s / speedMul): 0 'open' (vórtice acelera) · 0.8 'suck' (bites ativos até 8; m.fill 0→1) · 8 'full'
   (carrega, fica dourado) · 9 'spit' (PAGAR AQUI com m.payload; o gêmeo cospe ~14 onigiris dourados até 11; m.flash) · 12 = 0.
   Modo 'chegada' (meta.chegadaT = 8 s): 24 onigiris voam de fora e montam o anel ('clink'), 'ignite' 3.5 (flash, shake, vórtice
   nasce), título (m.title) 4, 'twin' 5 (o gêmeo aparece), 'ready' 8 → 'normal' (ct = 0).
   Cuspe: os onigiris (pixel art 22×22, 16 rotações prontas, pixel inteiro de tela) saem em arco, quicam 2× e empilham num monte
   (pirâmide 4-3-2-1 ao lado do gêmeo); quando tudo assenta, o monte fica 0,7 s à mostra e é recolhido (pulam pro coletor = moedas).
   Kome: 'gasp' agarrado e orelhas batendo enquanto chupa; 'cheer' no cuspe. SOM próprio (E.Sfx.define/E.Loops.define, nomes
   'portal-*'): vento em loop que sobe de tom com m.fill, pop/ploc do cuspe, sino quando o monte é recolhido. Respeita
   E.Audio.muted e S.opts.mute; create({sfx:false}) ou inp.sfx=false desliga; silence(m) para o loop (chamar ao sair da tela).
   Ler: m.phase ('abrindo','sugando','carregando','cuspindo','chegada'), m.fill, m.payload, m.spin (0..1 força do vórtice),
   m.gold (0..1), m.flash, m.shakeK, m.cam {x,y,z}, m.title. */
(function () {
  'use strict';
  const E = window.KomeEngine;
  if (!E || !E.Draw) throw new Error('portal.js: carregue core, pix, shiba e fx antes');
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  /* ---- geometria ---- */
  const OUT = [[0, -1310], [660, -70], [-660, -70]], IN = [[0, -1060], [455, -230], [-455, -230]];
  const R_OUT = 230, R_IN = 120, CY = -560, NORI_Y = -380;
  const TWIN_DX = -1500, TWIN_S = 0.42, TWIN_CY = -70 + (CY + 70) * TWIN_S;
  const BITE_DX = [1300, 1600, 1900];
  const T_OPEN = 0.8, T_FULL = 8, T_SPIT = 9, T_SPITEND = 11, T_CYC = 12;
  const CH = { ignite: 3.5, title: 4, twin: 5, end: 8 };
  const NPIECE = 24;

  function triPath(c, P, r, s, ox, oy) {
    s = s || 1; ox = ox || 0; oy = oy || 0;
    const X = i => ox + P[i][0] * s, Y = i => oy + P[i][1] * s;
    const mx = (X(1) + X(2)) / 2, my = (Y(1) + Y(2)) / 2;
    c.moveTo(mx, my); c.arcTo(X(1), Y(1), X(0), Y(0), r * s); c.arcTo(X(0), Y(0), X(2), Y(2), r * s); c.arcTo(X(2), Y(2), X(1), Y(1), r * s); c.closePath();
  }
  // ponto ao longo do contorno do meio da borda (u 0..1), pra montar o anel com pedaços
  const MIDP = OUT.map((p, i) => [(p[0] + IN[i][0]) / 2, (p[1] + IN[i][1] - 0) / 2]);
  function rimPoint(u, o) {
    const k = (u % 1) * 3, i = Math.floor(k), q = k - i, a = MIDP[i], b = MIDP[(i + 1) % 3];
    o.x = lerp(a[0], b[0], q); o.y = lerp(a[1], b[1], q); return o;
  }

  /* ---- pré-render em níveis ---- */
  const LEVELS = [0.25, 0.5, 1, 2];
  const bakes = new Map();
  let forceLv = -1;
  function level() {
    if (forceLv >= 0) return forceLv;
    const need = Draw.zoom * (window.devicePixelRatio || 1);
    for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i] >= need * 0.85) return i;
    return LEVELS.length - 1;
  }
  function bake(key, li, x0, y0, w, h, fn) {
    const k = key + '|' + li; let b = bakes.get(k);
    if (b) return b;
    const s = LEVELS[li], cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * s)); cv.height = Math.max(1, Math.ceil(h * s));
    const c = cv.getContext('2d');
    c.scale(s, s); c.translate(-x0, -y0); c.lineJoin = 'round'; c.lineCap = 'round';
    const z = Draw.zoom, mp = Draw.minPx; Draw.lod(s, 0); fn(c); Draw.lod(z, mp);
    b = { cv, x0, y0, w, h }; bakes.set(k, b);
    return b;
  }
  function ringArt(c) {
    // pés de pedra
    for (const s of [-1, 1]) Draw.box(c, s * 470 - 110, -90, 220, 90, PAL.stone, { ol: 3, r: 10, top: PAL.stoneL, shade: PAL.stoneD });
    // borda de arroz (anel = contorno de fora menos o de dentro)
    c.beginPath(); triPath(c, OUT, R_OUT); triPath(c, IN, R_IN);
    c.lineWidth = 10; c.strokeStyle = LINE; c.stroke(); c.fillStyle = PAL.rice; c.fill('evenodd');
    c.save(); c.beginPath(); triPath(c, OUT, R_OUT); triPath(c, IN, R_IN); c.clip('evenodd');
    c.fillStyle = PAL.riceS; c.beginPath(); triPath(c, OUT, R_OUT, 1, 18, 26); triPath(c, OUT, R_OUT, 1, 0, 0); c.fill('evenodd');
    for (let i = 0; i < 260; i++) {
      const x = (rnd(i) - 0.5) * 1320, y = -70 - rnd(i * 3.3) * 1240;
      c.save(); c.translate(x, y); c.rotate(rnd(i * 7) * PI); c.fillStyle = i & 1 ? PAL.riceS : '#FFFFFF';
      c.beginPath(); c.ellipse(0, 0, 13, 7, 0, 0, TAU); c.fill(); c.restore();
    }
    // nori na base
    c.fillStyle = '#25322A'; c.fillRect(-700, NORI_Y, 1400, 400);
    c.fillStyle = '#3A4B3F'; c.fillRect(-700, NORI_Y, 1400, 14); for (let x = -560; x < 600; x += 140) c.fillRect(x, NORI_Y + 30, 6, 280);
    c.restore();
    c.beginPath(); triPath(c, IN, R_IN); c.lineWidth = 10; c.strokeStyle = LINE; c.stroke();
    // runas/ideogramas de arroz no nori
    Draw.text(c, '米', -360, NORI_Y + 170, { size: 120, col: PAL.goldL, sw: 0, weight: 900 });
    Draw.text(c, '米', 360, NORI_Y + 170, { size: 120, col: PAL.goldL, sw: 0, weight: 900 });
  }
  function ringBake(li) { return bake('ring', li, -720, -1340, 1440, 1350, ringArt); }
  function vortexBake(li) {
    return bake('vort', li, -620, -620, 1240, 1240, c => {
      const gr = c.createRadialGradient(0, 0, 20, 0, 0, 620);
      gr.addColorStop(0, '#FFF6D0'); gr.addColorStop(0.18, '#B98AF0'); gr.addColorStop(0.55, '#4E3A8E'); gr.addColorStop(1, '#1E1838');
      c.fillStyle = gr; c.fillRect(-620, -620, 1240, 1240);
      for (let a = 0; a < 5; a++) {
        c.beginPath();
        for (let k = 0; k <= 60; k++) { const q = k / 60, r = 40 + q * 600, ang = a * TAU / 5 + q * 4.2; const x = Math.cos(ang) * r, y = Math.sin(ang) * r; k ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.lineWidth = 34; c.strokeStyle = 'rgba(255,255,255,.22)'; c.stroke();
        c.lineWidth = 12; c.strokeStyle = 'rgba(255,240,200,.35)'; c.stroke();
      }
    });
  }
  // braços finos e claros do vórtice (camada da frente, gira ao contrário, somada com 'lighter')
  function armsBake(li) {
    return bake('arms', li, -620, -620, 1240, 1240, c => {
      for (let a = 0; a < 3; a++) {
        c.beginPath();
        for (let k = 0; k <= 70; k++) { const q = k / 70, r = 30 + q * 590, ang = a * TAU / 3 - q * 5.6; const x = Math.cos(ang) * r, y = Math.sin(ang) * r; k ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.lineWidth = 46; c.strokeStyle = 'rgba(150,110,230,.35)'; c.stroke();
        c.lineWidth = 16; c.strokeStyle = 'rgba(255,236,190,.55)'; c.stroke();
      }
      for (let i = 0; i < 70; i++) {   // poeirinha de estrela presa nos braços
        const q = rnd(i * 2.1), r = 40 + q * 560, ang = (i % 3) * TAU / 3 - q * 5.6 + (rnd(i * 5.3) - 0.5) * 0.5, z = 6 + rnd(i) * 8;
        c.fillStyle = i % 4 ? 'rgba(255,250,230,.7)' : 'rgba(255,214,120,.8)'; c.fillRect(Math.cos(ang) * r - z / 2, Math.sin(ang) * r - z / 2, z, z);
      }
    });
  }

  /* ---- onigiri em PIXEL ART (sprite 22×22 de verdade, 16 rotações pré-desenhadas: nada de borrão girando) ---- */
  const ONI_N = 22, ONI_ROT = 16, K3 = Math.sqrt(3);
  const ONI_COL = {
    rice: { b: '#FFFDF6', s: '#E6DCC4', d: '#CFC2A2', h: '#FFFFFF' },
    gold: { b: '#F3C94A', s: '#D9A63A', d: '#B4852A', h: '#FFE68A' },
  };
  function sdTri(px, py, r) {   // distância com sinal até um triângulo equilátero de "raio" r, ponta pra cima (y pra baixo)
    let x = Math.abs(px) - r, y = -py + r / K3;
    if (x + K3 * y > 0) { const nx = (x - K3 * y) / 2, ny = (-K3 * x - y) / 2; x = nx; y = ny; }
    x -= clamp(x, -2 * r, 0);
    return -Math.hypot(x, y) * Math.sign(y);
  }
  function oniSprite(kind, step) {
    step = ((step % ONI_ROT) + ONI_ROT) % ONI_ROT;
    return E.sprite('portal-oni-' + kind + '-' + step, ONI_N, ONI_N, P => {
      const C = ONI_COL[kind], a = -step * TAU / ONI_ROT, ca = Math.cos(a), sa = Math.sin(a), c0 = (ONI_N - 1) / 2;
      for (let y = 0; y < ONI_N; y++) for (let x = 0; x < ONI_N; x++) {
        const dx = x - c0, dy = y - c0 - 0.5, lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;   // coords do onigiri em pé
        const d = sdTri(lx, ly - 1.2, 6.2) - 3.2;
        if (d > 0) continue;
        let col = C.b;
        if (ly > 3.2 && Math.abs(lx) < 5.6) col = ly < 4.4 ? '#3A4B3F' : '#25322A';            // faixa de nori
        else if (lx + ly * 0.7 > 4.2 || d > -1.1 && ly > 0) col = C.s;                          // sombra embaixo/direita
        if (col === C.s && lx + ly > 8.5) col = C.d;
        if (col === C.b && lx < -0.5 && ly < -3.2 && lx > -4 && ly > -7) col = C.h;              // brilho em cima/esquerda
        if (col === C.b && rnd(x * 31 + y * 7 + step) < 0.07) col = C.s;                          // grãozinhos
        P.set(x, y, col);
      }
    });
  }
  const snapPx = w => { const z = Draw.zoom || 1; return Math.max(1, Math.round(w * z)) / z; };
  // drawOni(g, kind, x, y, ang, size): size = largura no mundo; o pixel da arte é arredondado pra pixel inteiro de tela
  function drawOni(g, kind, x, y, ang, size, alpha) {
    const cv = oniSprite(kind, Math.round(ang / (TAU / ONI_ROT))), px = snapPx(size / ONI_N), w = px * ONI_N;
    const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
    if (alpha !== undefined && alpha < 1) g.globalAlpha = alpha;
    g.drawImage(cv, x - w / 2, y - w / 2, w, w);
    g.globalAlpha = 1; g.imageSmoothingEnabled = sm;
  }
  // orelhas do Kome batendo no vento (frente/trás), 5×6 px, cor do pelo
  function earSprite(fr) {
    return E.sprite('portal-orelha-' + fr, 5, 7, P => {
      if (fr === 0) { P.poly([[0, 6], [2, 0], [4, 6]], '#D9A066'); P.set(2, 3, '#EBEBEB'); P.set(2, 4, '#EBEBEB'); }
      else { P.poly([[0, 6], [4, 1], [4, 6]], '#D9A066'); P.set(3, 4, '#EBEBEB'); }
    });
  }

  /* ---- som (E.Sfx.define / E.Loops.define, sintetizado; respeita E.Audio.muted e S.opts.mute) ---- */
  let sndOk = false;
  function defineSounds() {
    if (sndOk || !E.Sfx || !E.Sfx.define) return sndOk;
    sndOk = true;
    // pop do onigiri saindo do gêmeo
    E.Sfx.define('portal-pop', { gate: 0.05, max: 4, peak: 0.4, jit: 0.9, render: Dk => { const b = Dk.buf(0.2); Dk.osc(b, { f: 260, f1: 760, d: 0.06, vol: 0.6 }); Dk.osc(b, { wave: 'tri', f: 520, f1: 980, d: 0.05, vol: 0.25, at: 0.02 }); Dk.noise(b, { d: 0.03, vol: 0.2, bp: 1800, q: 1.2 }); return b; } });
    // quique fofo no chão
    E.Sfx.define('portal-ploc', { gate: 0.06, max: 3, peak: 0.32, jit: 0.8, render: Dk => { const b = Dk.buf(0.16); Dk.osc(b, { f: 210, f1: 110, d: 0.07, vol: 0.7 }); Dk.noise(b, { color: 'brown', d: 0.04, vol: 0.4, lp: 900 }); return b; } });
    // pedaço encaixando no anel (estreia)
    E.Sfx.define('portal-clink', { gate: 0.06, max: 3, peak: 0.34, jit: 0.7, render: Dk => { const b = Dk.buf(0.3); Dk.noise(b, { d: 0.015, vol: 0.4, bp: 3000, q: 2 }); Dk.modal(b, 1320, [1, 2.7, 4.1], [0.5, 0.2, 0.08], [0.2, 0.12, 0.06], { at: 0.003 }); return b; } });
    // vórtice acendendo
    E.Sfx.define('portal-acende', a => { a.noise(0.7, 500, 0.3, 0.6); a.tone(70, 0.6, 'sine', 0.45, 0.6); a.tone(220, 0.5, 'triangle', 0.12, 3, 0.05); a.drum('chan', { vel: 0.4, delay: 0.25 }); a.drum('furin', { vel: 0.4, delay: 0.3 }); });
    // ficou cheio: brilho subindo
    E.Sfx.define('portal-cheio', a => { const n = [0, 2, 4, 7]; for (let i = 0; i < n.length; i++) a.note(a.deg(n[i]), { inst: 'bell', vel: 0.35 + i * 0.05, delay: i * 0.06 }); });
    // sino dourado: o monte foi recolhido (dinheiro entrou)
    E.Sfx.define('portal-sino', a => { const n = [7, 9, 12]; for (let i = 0; i < n.length; i++) a.note(a.deg(n[i]), { inst: 'bell', vel: 0.5 + i * 0.08, delay: i * 0.09 }); a.drum('furin', { vel: 0.35, delay: 0.27 }); });
    // tique de cada onigiri recolhido
    E.Sfx.define('portal-tique', { gate: 0.04, max: 3, peak: 0.25, jit: 0.4, render: Dk => { const b = Dk.buf(0.14); Dk.modal(b, 1760, [1, 2.4], [0.4, 0.15], [0.09, 0.05], { at: 0.002 }); return b; } });
    if (E.Loops && E.Loops.define) {
      // vento girando: cama rosa em passa-banda que "respira" (3 s, emenda exata) + assobio fino; o regime (rate) sobe o tom
      E.Loops.define('portal-vento', { vol: 0.9, rate: [0.7, 1.55], lp: [900, 3600], gain: [0.45, 1], render: Dk => {
        const n = Math.floor(3 * Dk.sr), out = E.Loops.bed(Dk, n, { color: 'pink', vol: 0.22, bp: 520, q: 0.9, am: 1, amDepth: 0.55 });
        const hi = E.Loops.bed(Dk, n, { vol: 0.05, bp: 1700, q: 5, am: 2, amDepth: 0.7 });
        const lo = E.Loops.bed(Dk, n, { color: 'brown', vol: 0.18, lp: 160 });
        for (let i = 0; i < n; i++) out[i] += hi[i] + lo[i];
        return out;
      } });
    }
    return sndOk;
  }
  function muted() { return !!((E.Audio && E.Audio.muted) || (G.S && G.S.opts && G.S.opts.mute)); }
  function snd(m, name, o) {
    if (!m.sfx || !defineSounds() || muted() || !E.Sfx.play) return;
    try { E.Sfx.play(name, o); } catch (e) { /* sem áudio */ }
  }
  function windLoop(m) {
    const want = m.sfx && !!E.Loops && defineSounds() && !muted() && m.built;
    if (want && !m.loopH) { try { m.loopH = E.Loops.start('portal-vento', { vol: 0, rate: 0.2 }); } catch (e) { m.loopH = null; } }
    if (!m.loopH) return;
    if (!want) { try { m.loopH.stop(0.4); } catch (e) { /* */ } m.loopH = null; return; }
    const suck = m.phase === 'sugando' ? 1 : 0;
    m.loopH.set({ vol: 0.12 + 0.3 * m.spin + 0.12 * suck, rate: 0.1 + 0.8 * m.fill + 0.15 * m.gold }, 0.3);
  }
  function silence(m) { if (m && m.loopH) { try { m.loopH.stop(0.3); } catch (e) { /* */ } m.loopH = null; } }

  /* ---- estado ---- */
  const PILE_N = 10, PILE_ROWS = [4, 3, 2, 1], ONI_W = 130, GRAV = 1700;
  function create(opts) {
    opts = opts || {};
    const m = {
      id: 'portal', mode: opts.mode === 'chegada' ? 'chegada' : 'normal', pilot: opts.pilot || 'kome', sfx: opts.sfx !== false,
      init: false, x: 0, y: 0, face: 1, t: 0, ct: 0, tc: 0, u: 0,
      phase: 'abrindo', fill: 0, payload: 0, spin: 0, gold: 0, ang: 0, ang2: 0, built: 1, twin: 1, title: 0, flash: 0, shakeK: 0, kick: 0,
      bitesA: BITE_DX.map(() => ({ x: 0, y: 0, r: 90, active: false })), biteO: null, dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
      oni: [], pile: 0, collectAcc: 0, spitAcc: 0, pieces: [], cam: { x: 0, y: -800, z: 0.2 }, camInit: false, ev: [], parts: null, night: 0, floorF: null, loopH: null,
    };
    m.biteO = m.bitesA[1];
    for (let i = 0; i < NPIECE; i++) { const a = rnd(i * 3.7) * TAU; m.pieces.push({ u: i / NPIECE, sx: Math.cos(a) * 4200, sy: -1200 + Math.sin(a) * 2600, t0: 0.15 + rnd(i * 1.3) * 2.6, spin: (rnd(i * 9.1) - 0.5) * 16, done: false }); }
    return m;
  }
  function emit(m, e) { m.ev.push(e); }
  // posição da vaga k do monte (pirâmide 5-4-3-2 ao lado do gêmeo, do lado de fora)
  function pileSlot(m, k, o) {
    let r = 0, j = k; while (r < PILE_ROWS.length - 1 && j >= PILE_ROWS[r]) { j -= PILE_ROWS[r]; r++; }
    const n = PILE_ROWS[r], cx = m.x + m.face * (TWIN_DX - 470);
    o.x = cx + (j - (n - 1) / 2) * ONI_W * 0.86 * -m.face; o.y = m.y - ONI_W * 0.42 - r * ONI_W * 0.7; return o;
  }

  function update(m, dt, inp) {
    m.ev.length = 0;
    dt = Math.min(dt, 0.1);
    if (!m.init) { m.init = true; m.x = inp.x || 0; }
    if (inp.sfx !== undefined) m.sfx = inp.sfx !== false;
    m.y = inp.y || 0; m.face = inp.face < 0 ? -1 : 1; m.night = +inp.night || 0; m.parts = inp.parts || null; m.floorF = inp.floor || null;
    const f = m.face, sp = inp.speedMul || 1, dig = inp.digging !== false;
    m.t += dt;
    let d = dt * sp, spinT = 0, sucking = false;
    if (m.mode === 'chegada') {
      const t0 = m.tc, t1 = t0 + d; m.tc = t1;
      const cr = a => t0 < a && t1 >= a;
      for (const p of m.pieces) if (!p.done && t1 >= p.t0 + 0.7) { p.done = true; snd(m, 'portal-clink', { pitch: 0.85 + p.u * 0.4 }); if (Math.random() < 0.4) emit(m, 'clink'); }
      m.built = t1 >= CH.ignite ? 1 : 0;
      if (cr(CH.ignite)) { emit(m, 'ignite'); snd(m, 'portal-acende'); m.flash = 1; m.shakeK = 1; if (m.parts) m.parts.burst(m.x, m.y + CY, 40, { c: [PAL.goldL, '#B98AF0', '#FFFFFF'], speed: [300, 900] }); }
      if (cr(CH.title)) m.title = 0.001;
      if (cr(CH.twin)) { emit(m, 'twin'); snd(m, 'portal-pop', { pitch: 0.6 }); if (m.parts) m.parts.burst(m.x + f * TWIN_DX, m.y + TWIN_CY, 20, { c: [PAL.goldL, '#B98AF0'], speed: [200, 500] }); }
      m.twin = smooth((t1 - CH.twin) / 0.5);
      spinT = t1 >= CH.ignite ? 0.7 : 0;
      m.phase = 'chegada'; m.fill = 0;
      if (t1 >= CH.end) { m.mode = 'normal'; m.ct = 0; m.twin = 1; emit(m, 'ready'); }
    }
    if (m.mode === 'normal') {
      const u0 = ((m.ct % T_CYC) + T_CYC) % T_CYC;
      if (!dig && u0 >= T_OPEN && u0 < T_FULL) d = 0;
      const u1 = u0 + d; m.ct += d; const u = u1 % T_CYC; m.u = u;
      const cr = a => (u0 < a && u1 >= a) || (u0 < a + T_CYC && u1 >= a + T_CYC);
      if (u0 < T_CYC && u1 >= T_CYC) emit(m, 'open');
      if (cr(T_OPEN)) emit(m, 'suck');
      if (cr(T_FULL)) { emit(m, 'full'); snd(m, 'portal-cheio'); }
      if (cr(T_SPIT)) { emit(m, 'spit'); m.payload = m.fill || 1; m.flash = 0.7; m.shakeK = 0.4; }
      m.fill = u < T_OPEN ? 0 : u < T_FULL ? (u - T_OPEN) / (T_FULL - T_OPEN) : u < T_SPIT ? 1 : Math.max(0, 1 - (u - T_SPIT) / (T_SPITEND - T_SPIT));
      sucking = dig && u >= T_OPEN && u < T_FULL;
      spinT = u < T_OPEN ? 0.4 + 0.6 * u / T_OPEN : u < T_SPITEND ? 1 : 0.5;
      if (!dig && u >= T_OPEN && u < T_FULL) spinT = 0.35;
      m.gold = u >= T_FULL && u < T_SPITEND ? (u < T_SPIT ? smooth((u - T_FULL) / (T_SPIT - T_FULL)) : 1 - smooth((u - T_SPIT) / 2)) : 0;
      m.phase = u < T_OPEN ? 'abrindo' : u < T_FULL ? 'sugando' : u < T_SPIT ? 'carregando' : u < T_SPITEND ? 'cuspindo' : 'abrindo';
      // cuspe de onigiris
      const spitting = u >= T_SPIT && u < T_SPITEND;
      m.dumpO.active = spitting;
      if (spitting) { m.spitAcc += d * 5.5; while (m.spitAcc >= 1) { m.spitAcc--; spitOne(m); } }
      // recolhe o monte (de cima pra baixo) depois do cuspe
      let busy = spitting; for (const o of m.oni) if (o.st === 'fly' || o.st === 'settle') { busy = true; break; }
      m.restT = busy ? 0 : (m.restT || 0) + dt;   // o monte fica à mostra um instante antes de ser recolhido
      if (m.restT > 0.7 && m.pile > 0) {
        m.collectAcc += dt * 22;
        while (m.collectAcc >= 1) {
          m.collectAcc--;
          let top = null; for (const o of m.oni) if (o.st === 'pile' && (!top || o.slot > top.slot)) top = o;
          if (!top) { m.collectAcc = 0; break; }
          top.st = 'go'; top.life = 0; top.x0 = top.x; top.y0 = top.y; m.pile--;
          snd(m, 'portal-tique', { pitch: 0.9 + (PILE_N - top.slot) * 0.03 });
          if (m.pile === 0) snd(m, 'portal-sino');
        }
      }
    }
    m.spin = damp(m.spin, spinT, 2.5, dt);
    m.ang += dt * (0.6 + m.spin * 3.4); m.ang2 -= dt * (0.4 + m.spin * 1.6);
    // mordidas na face
    for (let i = 0; i < BITE_DX.length; i++) {
      const b = m.bitesA[i], bx = m.x + f * BITE_DX[i], fy = m.floorF ? m.floorF(bx) : m.y - 700;
      b.x = bx; b.y = fy; b.r = 90; b.active = sucking && fy < m.y - 60;
    }
    m.biteO = m.bitesA[1].active ? m.bitesA[1] : (m.bitesA.find(b => b.active) || m.bitesA[1]);
    if (sucking && m.parts && Math.random() < dt * 8) { const b = m.bitesA[(Math.random() * 3) | 0]; if (b.active) m.parts.puff(b.x, b.y, 1, 30, { c: PAL.riceS, speed: 90, up: 50 }); }
    m.dumpO.x = m.x + f * TWIN_DX; m.dumpO.y = m.y + TWIN_CY;
    m.seatO.x = m.x; m.seatO.y = m.y - 1055;   // topo real da borda (o arredondado come o bico)
    // onigiris: voam do gêmeo em arco, quicam 2× e deslizam pra vaga do monte; depois pulam pro coletor e viram moeda
    const ground = m.y - ONI_W * 0.42;
    for (let i = m.oni.length - 1; i >= 0; i--) {
      const o = m.oni[i]; o.life += dt;
      if (o.st === 'fly') {
        o.vy += GRAV * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.r += o.vr * dt;
        const gy = o.slot < PILE_N && o.hop >= 2 ? o.ty : ground;
        if (o.y >= gy && o.vy > 0) {
          o.y = gy; o.hop++;
          if (o.hop <= 2) { o.vy *= -0.42; o.vx *= 0.55; o.vr *= 0.5; o.sq = 1; snd(m, 'portal-ploc', { pitch: 1 + o.hop * 0.2, vol: 0.8 / o.hop }); if (o.hop === 1 && m.parts) m.parts.puff(o.x, m.y - 4, 3, 30, { c: PAL.riceS, speed: 80, up: 30 }); }
          else { o.st = 'settle'; o.life = 0; o.x0 = o.x; o.y0 = o.y; o.r0 = o.r; o.sq = 0.6; }
        }
      } else if (o.st === 'settle') {
        const k = smooth(Math.min(1, o.life / 0.22));
        o.x = lerp(o.x0, o.tx, k); o.y = lerp(o.y0, o.ty, k) - Math.sin(k * PI) * 40; o.r = lerp(o.r0, o.tr, k);
        if (k >= 1) { if (o.slot < PILE_N) { o.st = 'pile'; m.pile++; } else { o.st = 'go'; o.life = 0; o.x0 = o.x; o.y0 = o.y; } }
      } else if (o.st === 'go') {
        const k = Math.min(1, o.life / 0.45);
        o.x = o.x0 - f * 520 * k; o.y = o.y0 - Math.sin(k * PI) * 260 + k * (m.y - 60 - o.y0); o.r += dt * 9;
        if (k >= 1) { if (m.parts) m.parts.coins(o.x, o.y - 20, 2, { speed: [120, 300] }); m.oni.splice(i, 1); continue; }
      }
      o.sq = Math.max(0, (o.sq || 0) - dt * 6);
    }
    m.kick = Math.max(0, m.kick - dt * 5);
    m.flash = Math.max(0, m.flash - dt * 2.5); m.shakeK = Math.max(0, m.shakeK - dt * 1.2);
    if (m.title > 0) { m.title = Math.min(1, m.title + dt / 3.2); if (m.title >= 1) m.title = 0; }
    windLoop(m);
    const c = m.cam, tx = m.x - f * 120, ty = -820, tz = 0.2;
    if (!m.camInit) { m.camInit = true; c.x = tx; c.y = ty; c.z = tz; } else { c.x = damp(c.x, tx, 2, dt); c.y = damp(c.y, ty, 2, dt); c.z = damp(c.z, tz, 1.5, dt); }
  }
  const SLOT = { x: 0, y: 0 };
  function spitOne(m) {
    const f = m.face, x0 = m.x + f * TWIN_DX, y0 = m.y + TWIN_CY;
    if (m.oni.length > 40) m.oni.shift();
    let used = 0; for (const o of m.oni) if (o.st !== 'go') used++;
    const slot = used < PILE_N ? used : PILE_N;
    if (slot < PILE_N) pileSlot(m, slot, SLOT); else { SLOT.x = x0 - f * 1000; SLOT.y = m.y - ONI_W * 0.42; }
    // mira: 2 quiques levam ~25% a mais de distância; voo até o chão resolvido pela parábola
    const vy = -(650 + Math.random() * 350), h = (m.y - ONI_W * 0.42) - y0, T = (-vy + Math.sqrt(vy * vy + 2 * GRAV * h)) / GRAV;
    const vx = (SLOT.x - x0) / (T * 1.32);
    m.oni.push({ x: x0, y: y0, vx, vy, r: 0, vr: (Math.random() - 0.5) * 12, life: 0, st: 'fly', hop: 0, slot, tx: SLOT.x, ty: SLOT.y, tr: 0, sq: 0 });
    m.kick = 1;
    snd(m, 'portal-pop', { pitch: 0.9 + Math.random() * 0.35 });
  }

  /* ---- desenho ---- */
  const TMP = { x: 0, y: 0 }, HEAD = { x: 0, y: 0 };
  const KOME_O = { scale: 1, face: 1, pal: 'kome', hat: false, shadow: false };
  function drawVortex(g, m, s, vs, glow, kq) {
    // (já transladado pro centro do vórtice e recortado pelo contorno de dentro)
    const vb = vortexBake(kq.li), ab = armsBake(kq.li), t = m.t, sp = m.spin;
    g.save(); g.rotate(m.ang); g.drawImage(vb.cv, -620 * vs, -620 * vs, 1240 * vs, 1240 * vs); g.restore();
    g.save(); g.globalAlpha = 0.5; g.rotate(m.ang2); g.drawImage(vb.cv, -560 * vs, -560 * vs, 1120 * vs, 1120 * vs); g.restore();
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + 0.45 * sp; g.rotate(-m.ang * 1.35 + 0.7); g.drawImage(ab.cv, -540 * vs, -540 * vs, 1080 * vs, 1080 * vs); g.restore();
    // grãos de arroz espiralando pro centro (pixel: retanguinhos alinhados)
    const N = Math.round(14 + 34 * sp * (0.5 + 0.5 * kq.big)), px = snapPx(7 * s);
    for (let i = 0; i < N; i++) {
      const q = (t * (0.35 + 0.35 * sp) + rnd(i * 1.7)) % 1, r = 470 * s * Math.pow(1 - q, 1.25), a = rnd(i * 4.3) * TAU + q * 7 + m.ang * 0.5;
      const x = Math.round(Math.cos(a) * r / px) * px, y = Math.round(Math.sin(a) * r / px) * px;
      g.globalAlpha = q > 0.8 ? (1 - q) * 5 : 1;
      g.fillStyle = LINE; g.fillRect(x - px, y - px, px * 5, px * 4);
      g.fillStyle = i % 3 ? PAL.rice : PAL.riceS; g.fillRect(x, y, px * 3, px * 2);
      if (i % 3) { g.fillStyle = '#FFFFFF'; g.fillRect(x, y, px, px); }
    }
    g.globalAlpha = 1;
    // brilho do miolo (respira; fica dourado conforme enche)
    g.globalCompositeOperation = 'lighter';
    const pr = (150 + 60 * Math.sin(t * 3.1) + 120 * m.fill) * s, gr = g.createRadialGradient(0, 0, 0, 0, 0, pr * 1.8);
    const cc = m.fill > 0.5 || glow > 0 ? '255,214,120' : '220,190,255';
    gr.addColorStop(0, 'rgba(' + cc + ',' + (0.45 + 0.3 * sp).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(' + cc + ',0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, pr * 1.8, 0, TAU); g.fill();
    // faíscas (cruzinha de pixel piscando)
    const sp2 = snapPx(9 * s);
    for (let i = 0; i < 12; i++) {
      const ph = t * (1.3 + rnd(i) * 1.2) + rnd(i * 3.3) * 9, k = Math.max(0, Math.sin(ph)); if (k < 0.3) continue;
      const cyc = Math.floor(ph / TAU), a = rnd(i * 7 + cyc) * TAU, r = (90 + rnd(i * 11 + cyc) * 330) * s;
      const x = Math.round(Math.cos(a) * r / sp2) * sp2, y = Math.round(Math.sin(a) * r / sp2) * sp2, L = k > 0.8 ? 2 : 1;
      g.globalAlpha = k; g.fillStyle = i % 3 ? '#FFF6D0' : '#FFD56A';
      g.fillRect(x, y - sp2 * L, sp2, sp2 * (2 * L + 1)); g.fillRect(x - sp2 * L, y, sp2 * (2 * L + 1), sp2);
    }
    g.globalAlpha = 1;
    if (glow > 0) { g.globalAlpha = glow * 0.55; g.fillStyle = PAL.goldL; g.beginPath(); g.arc(0, 0, 700 * s, 0, TAU); g.fill(); g.globalAlpha = 1; }
    g.globalCompositeOperation = 'source-over';
  }
  const KQ = { li: 0, big: 1 };
  function drawRing(g, m, cx, by, s, li, glow) {
    // vórtice (recortado pelo contorno de dentro) + brilho na borda de dentro + anel
    const rb = ringBake(li);
    g.save(); g.beginPath(); triPath(g, IN, R_IN, s, cx, by); g.clip();
    g.fillStyle = '#1E1838'; g.fillRect(cx - 500 * s, by - 1100 * s, 1000 * s, 900 * s);
    const vs = s * (0.4 + 0.6 * Math.min(1, m.spin * 1.4)), vcy = by + CY * s;
    KQ.li = li; KQ.big = s > 0.6 ? 1 : 0;
    g.save(); g.translate(cx, vcy); drawVortex(g, m, s, vs, glow, KQ); g.restore();
    // brilho suave grudado na borda de dentro
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = (0.16 + 0.1 * Math.sin(m.t * 2.3)) * (0.5 + m.spin * 0.5);
    g.strokeStyle = m.gold > 0.3 ? '#FFD56A' : '#B48CFF'; g.lineWidth = 150 * s; g.beginPath(); triPath(g, IN, R_IN, s, cx, by); g.stroke();
    g.lineWidth = 60 * s; g.stroke();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.restore();
    g.drawImage(rb.cv, cx + rb.x0 * s, by + rb.y0 * s, rb.w * s, rb.h * s);
    if (glow > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = glow * 0.35; g.drawImage(rb.cv, cx + rb.x0 * s, by + rb.y0 * s, rb.w * s, rb.h * s); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  }
  function drawKome(g, m) {
    const f = m.face, t = m.t, sx = m.seatO.x, sy = m.seatO.y;
    const suck = m.mode === 'normal' && (m.phase === 'sugando' || m.phase === 'carregando');
    let pose = 'sit', rot = 0, sq = 0;
    if (m.mode === 'chegada') pose = m.tc > CH.ignite && m.tc < CH.ignite + 1.6 ? 'surprise' : 'sit';
    else if (m.phase === 'cuspindo') pose = 'cheer';
    else if (suck) { pose = 'gasp'; rot = -f * 0.1 + Math.sin(t * 19) * 0.05 * m.spin; sq = 0.06 + 0.04 * Math.sin(t * 23); }
    KOME_O.pal = m.pilot; KOME_O.face = f; KOME_O.rot = rot; KOME_O.squash = sq;
    E.drawShiba(g, sx, sy, pose, t, KOME_O);
    KOME_O.rot = 0; KOME_O.squash = 0;
    if (!suck) return;
    // orelhas batendo no vento
    E.shibaAnchor(pose, E.drawShiba.frameT ? E.drawShiba.frameT(t) : t, 'head', HEAD, { hat: false });
    const fr = Math.floor(t * 14) % 2, ec = earSprite(fr), hx = sx + HEAD.x * f, hy = sy + HEAD.y;
    g.save(); g.translate(sx, sy); g.rotate(rot); g.translate(-sx, -sy); g.imageSmoothingEnabled = false;
    for (const k of [-1, 1]) {
      g.save(); g.translate(hx + k * 4, hy - 4); g.scale(-f * k, 1); g.drawImage(ec, -2, -6); g.restore();
    }
    g.restore();
  }
  function draw(g, m) {
    if (!m.init) return;
    const f = m.face, li = level(), x = m.x, y = m.y;
    // portal gêmeo (pulsa a cada cuspe)
    if (m.twin > 0.01) drawRing(g, m, x + f * TWIN_DX, y, TWIN_S * (m.twin < 1 ? 0.2 + 0.8 * m.twin + 0.1 * Math.sin(m.twin * PI) : 1) * (1 + 0.06 * m.kick), li, m.gold);
    // anel grande (ou os pedaços voando na estreia)
    if (m.built) drawRing(g, m, x, y, 1, li, m.gold * 0.6);
    else drawPieces(g, m);
    // rio de grãos: encosta → centro do vórtice
    if (m.mode === 'normal' && m.phase === 'sugando') drawStream(g, m);
    if (m.built) drawKome(g, m);
    // onigiris dourados (monte primeiro, de baixo pra cima; os que voam por cima)
    for (let pass = 0; pass < 2; pass++) for (const o of m.oni) {
      if ((o.st === 'pile' || o.st === 'settle') !== (pass === 0)) continue;
      const sz = ONI_W * (o.st === 'fly' && o.life < 0.15 ? 0.45 + 0.55 * o.life / 0.15 : 1), sq = o.sq || 0;
      const al = o.st === 'go' ? 1 - Math.max(0, (o.life - 0.3) / 0.15) : 1;
      drawOni(g, 'gold', o.x, o.y + sq * 14, o.r, sz * (1 + sq * 0.12), al);
    }
    // brilhinho de vez em quando no monte
    if (m.pile > 3) { const k = Math.floor(m.t * 3), o = m.oni[k % m.oni.length]; if (o && o.st === 'pile') { const ph = (m.t * 3) % 1, p = snapPx(9); g.globalAlpha = Math.sin(ph * PI); g.fillStyle = '#FFF6D0'; g.fillRect(o.x - p / 2 - 30, o.y - p * 2.5 - 40, p, p * 5); g.fillRect(o.x - p * 2.5 - 30, o.y - p / 2 - 40, p * 5, p); g.globalAlpha = 1; } }
    if (m.title > 0) {
      const k = m.title, pop = k < 0.12 ? 0.3 + 0.8 * smooth(k / 0.12) : 1.1 - 0.1 * smooth((k - 0.12) / 0.2), al = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
      g.save(); g.translate(x - f * 300, y - 1650); g.scale(pop, pop);
      Draw.text(g, 'PORTAL ONIGIRI', 0, 0, { size: 200, col: PAL.goldL, sw: 28, stroke: LINE, weight: 900, alpha: al, shadow: 12 });
      Draw.text(g, 'entra arroz · sai onigiri dourado', 0, 170, { size: 80, col: PAL.cream, sw: 14, stroke: LINE, weight: 800, alpha: al });
      g.restore();
    }
  }
  function drawPieces(g, m) {
    const tc = m.tc;
    for (let i = 0; i < m.pieces.length; i++) {
      const p = m.pieces[i], q = clamp((tc - p.t0) / 0.7, 0, 1); if (q <= 0) continue;
      rimPoint(p.u, TMP);
      const tx = m.x + TMP.x, ty = m.y + TMP.y, k = smooth(q);
      const x = lerp(m.x + p.sx, tx, k), yy = lerp(m.y + p.sy, ty, k) - Math.sin(k * PI) * 500;
      const land = tc - p.t0 - 0.7, pop = land > 0 && land < 0.18 ? 1 + 0.25 * Math.sin(land / 0.18 * PI) : 1;
      drawOni(g, 'rice', x, yy, (1 - k) * p.spin, 290 * pop);
    }
    // costura de luz ligando os pedaços que já pousaram, e o vórtice nascendo
    if (tc > CH.ignite - 0.6) { const a = (tc - (CH.ignite - 0.6)) / 0.6; g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.6; g.fillStyle = '#B98AF0'; g.beginPath(); g.arc(m.x, m.y + CY, 80 + a * 200, 0, TAU); g.fill(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  }
  function drawStream(g, m) {
    const cx = m.x, cy = m.y + CY, t = m.t, N = 26, px = snapPx(7);
    for (let i = 0; i < m.bitesA.length; i++) {
      const b = m.bitesA[i]; if (!b.active) continue;
      const kx = lerp(b.x, cx, 0.5), ky = Math.min(b.y, cy) - 500 - i * 120;
      // fita translúcida
      g.globalAlpha = 0.22; g.strokeStyle = '#E8E0FF'; g.lineWidth = 60; g.beginPath(); g.moveTo(b.x, b.y); g.quadraticCurveTo(kx, ky, cx, cy); g.stroke(); g.globalAlpha = 1;
      for (let j = 0; j < N; j++) {
        const q0 = (t * 0.55 + j / N + i * 0.13) % 1, q = q0 * q0 * (0.4 + 0.6 * q0), a = 1 - q;
        const x = a * a * b.x + 2 * a * q * kx + q * q * cx, y = a * a * b.y + 2 * a * q * ky + q * q * cy, z = q < 0.75 ? 1 : 0;
        const w = z ? 4 : 3, X = Math.round(x / px) * px, Y = Math.round(y / px) * px;
        g.fillStyle = LINE; g.fillRect(X - px, Y - px, px * (w + 2), px * 4);
        g.fillStyle = j % 3 ? PAL.rice : PAL.riceS; g.fillRect(X, Y, px * w, px * 2);
        g.fillStyle = '#FFFFFF'; g.fillRect(X, Y, px, px);
      }
    }
  }

  /* ---- âncoras ---- */
  function bite(m) { return m.biteO; }
  function bites(m) { return m.bitesA; }
  function dump(m) { return m.dumpO; }
  function seat(m) { return m.seatO; }
  function dig(m, heap, area, o) {
    let n = 0; for (const b of m.bitesA) if (b.active) n++;
    if (!n || !heap) return 0;
    let got = 0; for (const b of m.bitesA) if (b.active) { const r = heap.dig(b.x, area / n, b.r, o); got += r.got || 0; }
    return got;
  }
  function prebake(lv) { const keep = forceLv; forceLv = lv === undefined ? 0 : lv; const li = level(); ringBake(li); vortexBake(li); armsBake(li); oniSprite('rice', 0); oniSprite('gold', 0); forceLv = keep; }

  /* ---- horizonte do Pátio: anel(éis) pequeninho(s) com vórtice girando e um fio de grãos subindo ----
     horizon(g, {x0,x1,y,k=.12,t,n,tint,haze,night}); n>=10: 2 anéis; n>=25: 3. Ocupa o fim da faixa. */
  function horizon(g, o) {
    const k = (o.k || 0.12) * 0.9, t = o.t || 0, n = Math.max(1, o.n | 0), tint = o.tint || '#93A3B4', night = o.night || 0;
    const cnt = n >= 25 ? 3 : n >= 10 ? 2 : 1;
    const rim = U.mixCss(tint, '#FFFFFF', 0.35), nori = U.mixCss(tint, '#25322A', 0.45), vort = U.mixCss(tint, '#6A4FB0', 0.45);
    for (let i = 0; i < cnt; i++) {
      const s = k * (1 - i * 0.18), cx = lerp(o.x1, o.x0, 0.08 + i * 0.09), by = o.y - i * 5;
      g.fillStyle = vort; g.beginPath(); triPath(g, IN, R_IN, s, cx, by); g.fill();
      g.save(); g.beginPath(); triPath(g, IN, R_IN, s, cx, by); g.clip();
      g.strokeStyle = U.mixCss(tint, '#FFFFFF', 0.6); g.lineWidth = 1.5; const vy = by + CY * s;
      for (let a = 0; a < 3; a++) { g.beginPath(); g.arc(cx, vy, (30 + a * 18) * s * 4, t * (2 + a) + a * 2, t * (2 + a) + a * 2 + 2.2); g.stroke(); }
      g.restore();
      g.fillStyle = rim; g.beginPath(); triPath(g, OUT, R_OUT, s, cx, by); triPath(g, IN, R_IN, s, cx, by); g.fill('evenodd');
      g.fillStyle = nori; g.fillRect(cx - 560 * s, by + NORI_Y * s, 1120 * s, (-70 - NORI_Y) * s);
      // grãos subindo pro anel
      g.fillStyle = rim;
      for (let j = 0; j < 8; j++) { const q = (t * 0.5 + j / 8) % 1; g.fillRect(cx + lerp(-1400, 0, q) * s, by + lerp(0, CY, q) * s - Math.sin(q * PI) * 300 * s, 2, 2); }
      if (night > 0.2) { g.globalAlpha = night * 0.6; g.fillStyle = '#C9B2FF'; g.beginPath(); g.arc(cx, by + CY * s, 260 * s, 0, TAU); g.fill(); g.globalAlpha = 1; }
    }
  }

  G.Tools.portal = {
    id: 'portal', name: 'Portal Onigiri', kind: 'portal', w: 1320, h: 1310,
    meta: { zoom: 0.2, shake: 0.5, cycle: T_CYC, chegadaT: CH.end, twinDx: TWIN_DX, bites: BITE_DX,
      times: { open: T_OPEN, full: T_FULL, spit: T_SPIT, spitEnd: T_SPITEND, cycle: T_CYC } },
    create, update, draw, bite, bites, dump, seat, dig, horizon, prebake, silence,
  };
})();
