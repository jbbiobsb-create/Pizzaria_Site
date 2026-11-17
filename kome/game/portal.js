/* Kome no Japão — portal.js
   'portal' = PORTAL ONIGIRI (máquina absurda nº 20 do Pátio, a última do galho Absurdo, camada-cookie.md).
   Quase só efeito: um anel gigante em forma de onigiri (borda de arroz branco, faixa de nori embaixo, ~1.300 px) em pé perto da
   montanha, com um vórtice girando dentro. Ele chupa um rio de grãos da encosta (3 mordidas ao longo da face) e um portal gêmeo,
   menor, do lado do coletor cospe onigiris dourados (dump). Kome fica sentadinho no topo do anel (44 px, pra dar a escala).
   Depende de: core.js, pix.js, shiba.js, fx.js (só Draw/drawShiba de fato). Molde: trembala.js.

   Interface comum: G.Tools.portal = {id, name, kind, w, h, meta, create(opts), update(m,dt,inp), draw(g,m), bite(m), bites(m),
   dump(m), seat(m), dig(m, heap, area, o), horizon(g, o), prebake(level?)}.
   Espaço do modelo: origem no chão sob o anel grande; +x = lado da montanha (inp.face); escala fixa 1. Anel de x −650 a +650, topo
   y ≈ −1310; portal gêmeo em dx −1.500 (centro y ≈ −330). Mordidas em dx 1.300 / 1.600 / 1.900 na superfície (inp.floor).
   m.x pega inp.x só no 1º update. inp: x, y, face, floor(x), digging (false = vórtice em marcha lenta, sem chupar), speedMul, parts, night.
   CICLO normal (meta.cycle = 12 s / speedMul): 0 'open' (vórtice acelera) · 0.8 'suck' (bites ativos até 8; m.fill 0→1) · 8 'full'
   (carrega, fica dourado) · 9 'spit' (PAGAR AQUI com m.payload; o gêmeo cospe ~14 onigiris dourados até 11; m.flash) · 12 = 0.
   Modo 'chegada' (meta.chegadaT = 8 s): 24 onigiris voam de fora e montam o anel ('clink'), 'ignite' 3.5 (flash, shake, vórtice
   nasce), título (m.title) 4, 'twin' 5 (o gêmeo aparece), 'ready' 8 → 'normal' (ct = 0).
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
  function oniBake(li) {
    return bake('oni', li, -40, -40, 80, 76, c => {
      c.beginPath(); triPath(c, [[0, -34], [34, 30], [-34, 30]], 12); c.lineWidth = 4; c.strokeStyle = LINE; c.stroke(); c.fillStyle = PAL.gold; c.fill();
      c.fillStyle = PAL.goldL; c.beginPath(); c.ellipse(-8, -6, 8, 5, -0.6, 0, TAU); c.fill();
      c.fillStyle = '#25322A'; c.fillRect(-16, 12, 32, 18);
    });
  }

  /* ---- estado ---- */
  function create(opts) {
    opts = opts || {};
    const m = {
      id: 'portal', mode: opts.mode === 'chegada' ? 'chegada' : 'normal', pilot: opts.pilot || 'kome',
      init: false, x: 0, y: 0, face: 1, t: 0, ct: 0, tc: 0, u: 0,
      phase: 'abrindo', fill: 0, payload: 0, spin: 0, gold: 0, ang: 0, ang2: 0, built: 1, twin: 1, title: 0, flash: 0, shakeK: 0,
      bitesA: BITE_DX.map(() => ({ x: 0, y: 0, r: 90, active: false })), biteO: null, dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
      oni: [], spitAcc: 0, pieces: [], cam: { x: 0, y: -800, z: 0.2 }, camInit: false, ev: [], parts: null, night: 0, floorF: null,
    };
    m.biteO = m.bitesA[1];
    for (let i = 0; i < NPIECE; i++) { const a = rnd(i * 3.7) * TAU; m.pieces.push({ u: i / NPIECE, sx: Math.cos(a) * 4200, sy: -1200 + Math.sin(a) * 2600, t0: 0.15 + rnd(i * 1.3) * 2.6, done: false }); }
    return m;
  }
  function emit(m, e) { m.ev.push(e); }

  function update(m, dt, inp) {
    m.ev.length = 0;
    dt = Math.min(dt, 0.1);
    if (!m.init) { m.init = true; m.x = inp.x || 0; }
    m.y = inp.y || 0; m.face = inp.face < 0 ? -1 : 1; m.night = +inp.night || 0; m.parts = inp.parts || null; m.floorF = inp.floor || null;
    const f = m.face, sp = inp.speedMul || 1, dig = inp.digging !== false;
    m.t += dt;
    let d = dt * sp, spinT = 0, sucking = false;
    if (m.mode === 'chegada') {
      const t0 = m.tc, t1 = t0 + d; m.tc = t1;
      const cr = a => t0 < a && t1 >= a;
      for (const p of m.pieces) if (!p.done && t1 >= p.t0 + 0.7) { p.done = true; if (Math.random() < 0.4) emit(m, 'clink'); }
      m.built = t1 >= CH.ignite ? 1 : 0;
      if (cr(CH.ignite)) { emit(m, 'ignite'); m.flash = 1; m.shakeK = 1; if (m.parts) m.parts.burst(m.x, m.y + CY, 40, { c: [PAL.goldL, '#B98AF0', '#FFFFFF'], speed: [300, 900] }); }
      if (cr(CH.title)) m.title = 0.001;
      if (cr(CH.twin)) { emit(m, 'twin'); if (m.parts) m.parts.burst(m.x + f * TWIN_DX, m.y + TWIN_CY, 20, { c: [PAL.goldL, '#B98AF0'], speed: [200, 500] }); }
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
      if (cr(T_FULL)) emit(m, 'full');
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
      if (spitting) { m.spitAcc += d * 7; while (m.spitAcc >= 1) { m.spitAcc--; spitOne(m); } }
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
    m.seatO.x = m.x; m.seatO.y = m.y - 1062;   // topo real da borda (o arredondado come o bico)
    // onigiris voando
    for (let i = m.oni.length - 1; i >= 0; i--) {
      const o = m.oni[i]; o.life += dt;
      if (!o.land) { o.vy += 1500 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.r += o.vr * dt; if (o.y >= m.y - 30) { o.y = m.y - 30; o.land = true; o.vr = 0; if (m.parts) m.parts.coins(o.x, o.y - 20, 2, { speed: [100, 260] }); } }
      if (o.life > 3.2) m.oni.splice(i, 1);
    }
    m.flash = Math.max(0, m.flash - dt * 2.5); m.shakeK = Math.max(0, m.shakeK - dt * 1.2);
    if (m.title > 0) { m.title = Math.min(1, m.title + dt / 3.2); if (m.title >= 1) m.title = 0; }
    const c = m.cam, tx = m.x + f * 200, ty = -820, tz = 0.2;
    if (!m.camInit) { m.camInit = true; c.x = tx; c.y = ty; c.z = tz; } else { c.x = damp(c.x, tx, 2, dt); c.y = damp(c.y, ty, 2, dt); c.z = damp(c.z, tz, 1.5, dt); }
  }
  function spitOne(m) {
    const f = m.face;
    if (m.oni.length > 40) m.oni.shift();
    m.oni.push({ x: m.x + f * TWIN_DX, y: m.y + TWIN_CY, vx: -f * (300 + Math.random() * 700), vy: -(500 + Math.random() * 600), r: 0, vr: (Math.random() - 0.5) * 10, life: 0, land: false });
  }

  /* ---- desenho ---- */
  const TMP = { x: 0, y: 0 };
  const KOME_O = { scale: 1, face: 1, pal: 'kome', hat: false, shadow: false };
  function drawRing(g, m, cx, by, s, li, glow) {
    // vórtice (recortado pelo contorno de dentro) + anel
    const rb = ringBake(li), vb = vortexBake(li);
    g.save(); g.beginPath(); triPath(g, IN, R_IN, s, cx, by); g.clip();
    g.fillStyle = '#1E1838'; g.fillRect(cx - 500 * s, by - 1100 * s, 1000 * s, 900 * s);
    const vs = s * (0.4 + 0.6 * Math.min(1, m.spin * 1.4)), vcy = by + CY * s;
    g.translate(cx, vcy);
    g.save(); g.rotate(m.ang); g.drawImage(vb.cv, -620 * vs, -620 * vs, 1240 * vs, 1240 * vs); g.restore();
    g.globalAlpha = 0.5; g.rotate(m.ang2); g.drawImage(vb.cv, -560 * vs, -560 * vs, 1120 * vs, 1120 * vs); g.globalAlpha = 1;
    if (glow > 0) { g.globalAlpha = glow * 0.8; g.fillStyle = PAL.goldL; g.beginPath(); g.arc(0, 0, 700 * s, 0, TAU); g.fill(); g.globalAlpha = 1; }
    g.restore();
    g.drawImage(rb.cv, cx + rb.x0 * s, by + rb.y0 * s, rb.w * s, rb.h * s);
    if (glow > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = glow * 0.35; g.drawImage(rb.cv, cx + rb.x0 * s, by + rb.y0 * s, rb.w * s, rb.h * s); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  }
  function draw(g, m) {
    if (!m.init) return;
    const f = m.face, li = level(), x = m.x, y = m.y, t = m.t;
    // portal gêmeo
    if (m.twin > 0.01) drawRing(g, m, x + f * TWIN_DX, y, TWIN_S * (m.twin < 1 ? 0.2 + 0.8 * m.twin + 0.1 * Math.sin(m.twin * PI) : 1), li, m.gold);
    // anel grande (ou os pedaços voando na estreia)
    if (m.built) drawRing(g, m, x, y, 1, li, m.gold * 0.6);
    else drawPieces(g, m, li);
    // rio de grãos: encosta → centro do vórtice
    if (m.mode === 'normal' && m.phase === 'sugando') drawStream(g, m);
    // Kome sentado no topo
    if (m.built) { KOME_O.pal = m.pilot; KOME_O.face = f; E.drawShiba(g, m.seatO.x, m.seatO.y, m.phase === 'cuspindo' ? 'cheer' : 'sit', t, KOME_O); }
    // onigiris dourados
    const ob = oniBake(li);
    for (const o of m.oni) {
      const a = o.life > 2.6 ? 1 - (o.life - 2.6) / 0.6 : 1;
      g.globalAlpha = a; g.save(); g.translate(o.x, o.y); g.rotate(o.r); g.scale(1.6, 1.6); g.drawImage(ob.cv, ob.x0, ob.y0, ob.w, ob.h); g.restore();
    }
    g.globalAlpha = 1;
    if (m.title > 0) {
      const k = m.title, pop = k < 0.12 ? 0.3 + 0.8 * smooth(k / 0.12) : 1.1 - 0.1 * smooth((k - 0.12) / 0.2), al = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
      g.save(); g.translate(x - f * 300, y - 1650); g.scale(pop, pop);
      Draw.text(g, 'PORTAL ONIGIRI', 0, 0, { size: 200, col: PAL.goldL, sw: 28, stroke: LINE, weight: 900, alpha: al, shadow: 12 });
      Draw.text(g, 'entra arroz · sai onigiri dourado', 0, 170, { size: 80, col: PAL.cream, sw: 14, stroke: LINE, weight: 800, alpha: al });
      g.restore();
    }
  }
  function drawPieces(g, m, li) {
    const ob = oniBake(Math.min(LEVELS.length - 1, li + 2)), tc = m.tc;
    for (let i = 0; i < m.pieces.length; i++) {
      const p = m.pieces[i], q = clamp((tc - p.t0) / 0.7, 0, 1); if (q <= 0) continue;
      rimPoint(p.u, TMP);
      const tx = m.x + TMP.x, ty = m.y + TMP.y, k = smooth(q);
      const x = lerp(m.x + p.sx, tx, k), yy = lerp(m.y + p.sy, ty, k) - Math.sin(k * PI) * 500;
      g.save(); g.translate(x, yy); g.rotate((1 - k) * 8 + i); g.scale(3.4, 3.4);
      g.drawImage(ob.cv, ob.x0, ob.y0, ob.w, ob.h); g.restore();
    }
    if (tc > CH.ignite - 0.6) { const a = (tc - (CH.ignite - 0.6)) / 0.6; g.globalAlpha = a * 0.6; g.fillStyle = '#B98AF0'; g.beginPath(); g.arc(m.x, m.y + CY, 80 + a * 200, 0, TAU); g.fill(); g.globalAlpha = 1; }
  }
  function drawStream(g, m) {
    const cx = m.x, cy = m.y + CY, t = m.t, N = 26;
    for (let i = 0; i < m.bitesA.length; i++) {
      const b = m.bitesA[i]; if (!b.active) continue;
      const kx = lerp(b.x, cx, 0.5), ky = Math.min(b.y, cy) - 500 - i * 120;
      // fita translúcida
      g.globalAlpha = 0.25; g.strokeStyle = '#E8E0FF'; g.lineWidth = 60; g.beginPath(); g.moveTo(b.x, b.y); g.quadraticCurveTo(kx, ky, cx, cy); g.stroke(); g.globalAlpha = 1;
      for (let j = 0; j < N; j++) {
        const q0 = (t * 0.55 + j / N + i * 0.13) % 1, q = q0 * q0 * (0.4 + 0.6 * q0) * 1.0, a = 1 - q;
        const px = a * a * b.x + 2 * a * q * kx + q * q * cx, py = a * a * b.y + 2 * a * q * ky + q * q * cy, s = 1.6 - q;
        g.fillStyle = LINE; g.beginPath(); g.ellipse(px, py, 14 * s + 3, 8 * s + 3, q * 6 + j, 0, TAU); g.fill();
        g.fillStyle = j % 3 ? PAL.rice : PAL.riceS; g.beginPath(); g.ellipse(px, py, 14 * s, 8 * s, q * 6 + j, 0, TAU); g.fill();
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
  function prebake(lv) { const keep = forceLv; forceLv = lv === undefined ? 0 : lv; const li = level(); ringBake(li); vortexBake(li); oniBake(li); forceLv = keep; }

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
    create, update, draw, bite, bites, dump, seat, dig, horizon, prebake,
  };
})();
