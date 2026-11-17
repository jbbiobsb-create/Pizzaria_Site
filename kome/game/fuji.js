/* Kome no Japão — fuji.js
   'fuji' = ESCAVADEIRA DO MONTE FUJI (máquina absurda nº 19 do Pátio, camada-cookie.md · galho Absurdo).
   É a MESMA escavadeira hidráulica de machines-mid.js (G.Tools.escav), criada uma vez e desenhada com escala 9: do tamanho de um
   morro. Detalhes absurdos baratos por cima: neve na lança e no teto da cabine, nuvens passando na altura da cabine, passarinhos
   dando volta na ponta do braço e uma plaquinha piscando "KOME" na janela. A caçamba morde pedaços enormes da montanha (r ≈ 300).
   Depende de: core.js, pix.js, shiba.js, fx.js, terrain.js, rig.js e game/machines-mid.js (carregar ANTES). Molde: trembala.js.

   Interface comum: G.Tools.fuji = {id, name, kind, w, h, meta, create(opts), update(m,dt,inp), draw(g,m), bite(m), bites(m),
   dump(m), seat(m), dig(m, heap, area, o), horizon(g, o), prebake()}.
   Espaço do modelo: origem no chão sob a máquina (m.x = inp.x a cada quadro); +x = lado da montanha (inp.face); escala do modelo
   interno × SCALE (9). A caçamba alcança ~900–2.700 px à frente e cava até ~1.700 px de altura; despeja virando pra trás
   (dump ≈ 1.500 px atrás). inp: x, y, face, floor(x), digging, speedMul, parts, night.
   CICLO normal (meta.cycle ≈ 5 s / speedMul; a escav interna roda a 0.4×): 'bite' (caçamba bate na encosta: PEGAR aqui, m.shakeK),
   'scoop', 'swing', 'dump' (despeja atrás: pagar aqui se o jogo paga por caçamba). digging === false = para no fim do ciclo.
   Modo 'chegada' (meta.chegadaT = 9 s): ela sobe de trás do horizonte ('rise' 0), um banco de nuvens se abre ('part' 2.4),
   ronco ('roar' 4.4, shake), título (m.title), começa a cavar em 6, 'ready' em 9 → 'normal'.
   Ler: m.ex (instância da escav interna), m.rise (0..1, quanto falta subir), m.shakeK, m.cam {x,y,z}, m.title, m.phase. */
(function () {
  'use strict';
  const E = window.KomeEngine;
  if (!E || !E.Draw) throw new Error('fuji.js: carregue core, pix, shiba, fx, terrain e rig antes');
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  const S = 9, RISE_D = 2600, REACH = 235, CYC = 5;
  const CH = { part: 2.4, roar: 4.4, title: 4.6, dig: 6, end: 9 };
  const BOOM_SNOW = [[26, -2, 9], [50, -3, 11], [74, -3, 10], [100, -2, 8]];
  const esc = () => G.Tools.escav;

  /* nuvem pré-renderizada */
  let CLOUD = null;
  function cloudImg() {
    if (CLOUD) return CLOUD;
    const w = 900, h = 360, cv = document.createElement('canvas'); cv.width = w / 2; cv.height = h / 2;
    const c = cv.getContext('2d'); c.scale(0.5, 0.5);
    const B = [[180, 230, 120], [330, 170, 150], [520, 160, 170], [690, 220, 130], [420, 260, 130], [260, 270, 90], [780, 270, 70]];
    c.fillStyle = 'rgba(59,40,24,.35)'; for (const [x, y, r] of B) { c.beginPath(); c.arc(x, y + 8, r + 6, 0, TAU); c.fill(); }
    c.fillStyle = '#FFFFFF'; for (const [x, y, r] of B) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.fillStyle = '#E4EEF6'; c.fillRect(60, 300, 800, 60); c.globalCompositeOperation = 'destination-out'; c.fillRect(0, 330, w, 40);
    CLOUD = { cv, w, h };
    return CLOUD;
  }

  function create(opts) {
    opts = opts || {};
    if (!esc()) throw new Error('fuji.js: carregue game/machines-mid.js antes (usa G.Tools.escav)');
    const m = {
      id: 'fuji', mode: opts.mode === 'chegada' ? 'chegada' : 'normal', pilot: opts.pilot || 'kome',
      ex: esc().create({ pilot: opts.pilot || 'kome' }), x: 0, y: 0, face: 1, t: 0, tc: 0, init: false,
      rise: opts.mode === 'chegada' ? 1 : 0, part: 1, title: 0, shakeK: 0, flash: 0, phase: 'cavando', fill: 0,
      bitesA: [{ x: 0, y: 0, r: 34 * S, active: false }], dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
      cam: { x: 0, y: -1500, z: 0.13 }, camInit: false, ev: [], parts: null, night: 0, floorF: null,
      inpE: { x: 0, y: 0, face: 1, floor: () => 0, digging: true, speedMul: 0.4, power: 1, tx: 0, ty: 0, parts: null },
      proxy: null, birds: [0, 1, 2, 3, 4].map(i => ({ a: rnd(i) * TAU, r: 260 + rnd(i * 3) * 220, sp: 0.6 + rnd(i * 5) * 0.5, dy: rnd(i * 7) * 200 })),
    };
    // partículas da escav interna: coordenadas do modelo → mundo (e tudo 3× maior)
    m.proxy = {
      spray(x, y, n, o) { if (m.parts) m.parts.spray(m.x + x * S, m.y + y * S + m.rise * RISE_D, n, o); },
      puff(x, y, n, size, o) { if (m.parts) m.parts.puff(m.x + x * S, m.y + y * S + m.rise * RISE_D, n, (size || 8) * 3, o); },
      sparks(x, y, n, o) { if (m.parts) m.parts.sparks(m.x + x * S, m.y + y * S, n, o); },
      burst(x, y, n, o) { if (m.parts) m.parts.burst(m.x + x * S, m.y + y * S, n, o); },
      coins(x, y, n, o) { if (m.parts) m.parts.coins(m.x + x * S, m.y + y * S, n, o); },
    };
    return m;
  }
  function emit(m, e) { m.ev.push(e); }
  const toW = (m, p, o) => { o.x = m.x + p.x * S; o.y = m.y + p.y * S + m.rise * RISE_D; return o; };

  function update(m, dt, inp) {
    m.ev.length = 0;
    dt = Math.min(dt, 0.1);
    m.init = true;
    m.x = inp.x || 0; m.y = inp.y || 0; m.face = inp.face < 0 ? -1 : 1; m.night = +inp.night || 0; m.parts = inp.parts || null; m.floorF = inp.floor || null;
    const f = m.face, sp = inp.speedMul || 1;
    m.t += dt;
    let digging = inp.digging !== false;
    if (m.mode === 'chegada') {
      const t0 = m.tc, t1 = t0 + dt * sp; m.tc = t1;
      const cr = a => t0 < a && t1 >= a;
      if (t0 === 0) emit(m, 'rise');
      m.rise = 1 - smooth(t1 / CH.roar);
      m.part = 1 - smooth((t1 - CH.part) / 2.2);
      if (cr(CH.part)) emit(m, 'part');
      if (cr(CH.roar)) { emit(m, 'roar'); m.shakeK = 1; if (m.parts) for (let i = 0; i < 10; i++) m.parts.puff(m.x + (i - 5) * 260, m.y, 2, 60, { c: PAL.sand, speed: 300, up: 80 }); }
      if (cr(CH.title)) m.title = 0.001;
      digging = digging && t1 > CH.dig;
      m.phase = 'chegada';
      if (t1 >= CH.end) { m.mode = 'normal'; m.rise = 0; m.part = 0; emit(m, 'ready'); }
    } else { m.rise = 0; m.part = 0; m.phase = digging ? 'cavando' : 'parada'; }
    // alvo da caçamba: a encosta à frente
    const wx = m.x + f * REACH * S, fy = m.floorF ? m.floorF(wx) : m.y - 900;
    const I = m.inpE; I.face = f; I.digging = digging; I.speedMul = 0.4 * sp; I.parts = m.proxy;
    I.tx = f * REACH; I.ty = clamp((fy - m.y) / S, -190, 30);
    esc().update(m.ex, dt, I);
    for (const e of m.ex.ev) {
      if (e === 'hit') { emit(m, 'bite'); m.shakeK = Math.max(m.shakeK, 0.45); const b = m.bitesA[0]; if (m.parts) { m.parts.puff(b.x, b.y, 6, 70, { c: PAL.riceS, speed: 260, up: 90 }); m.parts.burst(b.x, b.y, 14, { c: [PAL.rice, PAL.riceS, PAL.press], speed: [200, 600], shape: 'rect', w: [10, 22] }); } }
      else if (e === 'scoop') emit(m, 'scoop');
      else if (e === 'rev') emit(m, 'swing');
      else if (e === 'dump') emit(m, 'dump');
    }
    // âncoras
    const B = esc().bite(m.ex), b = m.bitesA[0];
    toW(m, B, b); b.r = 34 * S; b.active = !!B.active && m.rise < 0.01;
    if (m.floorF) { const sy = m.floorF(b.x); if (b.y < sy - b.r) b.active = false; }
    const D = esc().dump(m.ex); toW(m, D, m.dumpO); m.dumpO.active = !!D.active;
    toW(m, esc().seat(m.ex), m.seatO);
    m.fill = m.ex.load || 0;
    m.shakeK = Math.max(0, m.shakeK - dt * 1.5); m.flash = Math.max(0, m.flash - dt * 3);
    if (m.title > 0) { m.title = Math.min(1, m.title + dt / 3.4); if (m.title >= 1) m.title = 0; }
    for (const bd of m.birds) bd.a += dt * bd.sp;
    // câmera
    const c = m.cam, tx = m.x + f * 700, ty = m.mode === 'chegada' && m.tc < CH.roar ? -1100 : -1450, tz = 0.13;
    if (!m.camInit) { m.camInit = true; c.x = tx; c.y = ty; c.z = tz; } else { c.x = damp(c.x, tx, 2, dt); c.y = damp(c.y, ty, 1.5, dt); c.z = damp(c.z, tz, 1.5, dt); }
  }

  const TMP = { x: 0, y: 0, rot: 0 };
  function drawClouds(g, m, front) {
    const ci = cloudImg(), s = m.seatO, t = m.t;
    for (let i = 0; i < 4; i++) {
      if ((i & 1) !== (front ? 1 : 0)) continue;
      const span = 3400, x = s.x - span / 2 + ((t * (60 + i * 25) + i * 900) % span), y = s.y - 120 + (i - 1.5) * 170;
      const sc = 0.9 + 0.3 * rnd(i);
      g.globalAlpha = front ? 0.82 : 0.95;
      g.drawImage(ci.cv, x - ci.w * sc / 2, y - ci.h * sc / 2, ci.w * sc, ci.h * sc);
    }
    g.globalAlpha = 1;
  }
  function drawBank(g, m) {   // banco de nuvens da estreia (se abre ao meio)
    if (m.part <= 0.01) return;
    const ci = cloudImg(), cx = m.x + m.face * 300, y = m.y - 1200, open = (1 - m.part) * 2600;
    g.globalAlpha = Math.min(1, m.part * 1.5);
    for (let i = 0; i < 6; i++) {
      const s = i & 1 ? 1 : -1, k = (i >> 1), x = cx + s * (300 + k * 520 + open), yy = y + (k - 1) * 360 + 200 * rnd(i);
      g.drawImage(ci.cv, x - ci.w * 1.4, yy - ci.h * 1.4, ci.w * 2.8, ci.h * 2.8);
    }
    g.globalAlpha = 1;
  }
  function draw(g, m) {
    if (!m.init) return;
    const ex = m.ex, dy = m.rise * RISE_D, f = m.face, t = m.t;
    drawClouds(g, m, false);
    g.save();
    if (m.rise > 0.001) { g.beginPath(); g.rect(m.x - 6000, m.y - 8000, 12000, 8000); g.clip(); }
    g.translate(m.x, m.y + dy); g.scale(S, S);
    const z0 = Draw.zoom, mp = Draw.minPx; Draw.lod(z0 * S, mp);
    esc().draw(g, ex);
    // neve na lança, no teto da cabine e da casa (pontos locais das peças → modelo)
    g.fillStyle = '#FFFFFF'; g.strokeStyle = LINE; g.lineWidth = 1.2;
    const rig = ex.rig;
    if (rig && rig.world) {
      g.beginPath();
      for (const [lx, ly, r] of BOOM_SNOW) { rig.world('boom', lx, ly, TMP); g.moveTo(TMP.x + r * Math.cos(TMP.rot), TMP.y + r * Math.sin(TMP.rot)); g.ellipse(TMP.x, TMP.y, r, r * 0.5, TMP.rot, 0, TAU); }
      g.stroke(); g.fill();
      // pingentes de gelo na lança
      g.fillStyle = '#CFE6F5';
      for (let i = 0; i < 4; i++) { rig.world('boom', 30 + i * 24, 6, TMP); g.beginPath(); g.moveTo(TMP.x - 2, TMP.y); g.lineTo(TMP.x + 2, TMP.y); g.lineTo(TMP.x, TMP.y + 5 + (i & 1) * 3); g.fill(); }
    }
    Draw.lod(z0, mp);
    g.restore();
    // neve no teto da cabine (relativa ao assento do Kome: o teto fica ~40 px do modelo acima)
    { const s = m.seatO, rx = s.x - f * 4 * S, ry = s.y - 41 * S;
      g.fillStyle = '#FFFFFF'; g.strokeStyle = LINE; g.lineWidth = 12; g.beginPath(); g.ellipse(rx, ry, 23 * S, 5 * S, 0, PI, TAU); g.quadraticCurveTo(rx + 23 * S, ry + 3 * S, rx, ry + 2 * S); g.quadraticCurveTo(rx - 23 * S, ry + 3 * S, rx - 23 * S, ry); g.stroke(); g.fill(); }
    drawClouds(g, m, true);
    // passarinhos rodando a ponta do braço
    if (m.rise < 0.5) {
      const b = toW(m, esc().bite(ex), { x: 0, y: 0 });
      g.strokeStyle = LINE; g.lineWidth = 10; g.beginPath();
      for (const bd of m.birds) {
        const x = b.x + Math.cos(bd.a) * bd.r * 1.6, y = b.y - 700 - bd.dy + Math.sin(bd.a) * bd.r * 0.5, w = 34, fl = Math.sin(t * 9 + bd.a * 3) * 14;
        g.moveTo(x - w, y - fl); g.quadraticCurveTo(x - w * 0.4, y - 12, x, y); g.quadraticCurveTo(x + w * 0.4, y - 12, x + w, y - fl);
      }
      g.stroke();
    }
    // plaquinha do Kome
    if (m.rise < 0.3) {
      const s = m.seatO, bl = 0.6 + 0.4 * Math.sin(t * 5);
      g.globalAlpha = bl; g.strokeStyle = PAL.goldL; g.lineWidth = 22; g.beginPath(); g.arc(s.x, s.y - 160, 330, 0, TAU); g.stroke(); g.globalAlpha = 1;
      Draw.text(g, 'KOME', s.x + f * 0, s.y - 560, { size: 120, col: PAL.goldL, sw: 18, stroke: LINE, weight: 900 });
    }
    drawBank(g, m);
    if (m.title > 0) {
      const k = m.title, pop = k < 0.12 ? 0.3 + 0.8 * smooth(k / 0.12) : 1.1 - 0.1 * smooth((k - 0.12) / 0.2), al = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
      g.save(); g.translate(m.x + f * 300, m.y - 3200); g.scale(pop, pop);
      Draw.text(g, 'ESCAVADEIRA DO MONTE FUJI', 0, 0, { size: 330, col: PAL.goldL, sw: 44, stroke: LINE, weight: 900, alpha: al, shadow: 16 });
      Draw.text(g, 'a mesma escavadeira. só que do tamanho de um morro.', 0, 280, { size: 140, col: PAL.cream, sw: 24, stroke: LINE, weight: 800, alpha: al });
      g.restore();
    }
  }

  function bite(m) { return m.bitesA[0]; }
  function bites(m) { return m.bitesA; }
  function dump(m) { return m.dumpO; }
  function seat(m) { return m.seatO; }
  function dig(m, heap, area, o) { const b = m.bitesA[0]; if (!b.active || !heap) return 0; const r = heap.dig(b.x, area, b.r, o); return r.got || 0; }
  function prebake() { cloudImg(); }

  /* ---- horizonte do Pátio: a escavadeira gigante (silhueta de verdade, animada) cavando atrás dos morros ----
     horizon(g, {x0,x1,y,k=.12,t,n,tint,haze,night}); n>=10 ganha uma 2ª (mais longe); ocupa o meio-fim da faixa. */
  const HZ = { inst: [], cv: null, c: null, lastT: [] };
  const HINP = { x: 0, y: 0, face: 1, floor: () => 0, digging: true, speedMul: 0.6, power: 1, tx: 220, ty: -40, parts: null };
  function horizon(g, o) {
    if (!esc()) return;
    const k = o.k || 0.12, t = o.t || 0, n = Math.max(1, o.n | 0), tint = o.tint || '#93A3B4', haze = o.haze === undefined ? 0.6 : o.haze, night = o.night || 0;
    const count = n >= 10 ? 2 : 1;
    if (!HZ.cv) { HZ.cv = document.createElement('canvas'); HZ.cv.width = 460; HZ.cv.height = 300; HZ.c = HZ.cv.getContext('2d'); }
    for (let i = count - 1; i >= 0; i--) {
      if (!HZ.inst[i]) { HZ.inst[i] = esc().create({}); HZ.lastT[i] = t; }
      const ex = HZ.inst[i], dt = clamp(t - HZ.lastT[i], 0, 0.1); HZ.lastT[i] = t;
      HINP.face = i ? 1 : -1; esc().update(ex, dt, HINP);
      const c = HZ.c; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, 460, 300);
      c.translate(230, 270); esc().draw(c, ex);
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = Math.min(0.95, haze + 0.2 + i * 0.1); c.fillStyle = tint; c.fillRect(0, 0, 460, 300); c.globalAlpha = 1;
      // neve nos picos da silhueta
      const sc = k * S * 0.9 * (1 - i * 0.3), x = lerp(o.x0, o.x1, i ? 0.42 : 0.62), y = o.y - i * 8;
      g.drawImage(HZ.cv, x - 230 * sc, y - 270 * sc, 460 * sc, 300 * sc);
      if (night > 0.2) { g.fillStyle = '#FFE3A0'; g.globalAlpha = night; const s = ex.seatO; g.fillRect(x + s.x * sc - 2, y + s.y * sc - 2, 4, 3); g.globalAlpha = 1; }
    }
    // nuvenzinha passando na frente
    const ci = cloudImg(), cx = lerp(o.x0, o.x1, 0.5 + 0.15 * Math.sin(t * 0.07)), cs = k * 1.2;
    g.globalAlpha = 0.7; g.drawImage(ci.cv, cx - ci.w * cs / 2, o.y - 150 * k * S * 0.9 - ci.h * cs / 2, ci.w * cs, ci.h * cs); g.globalAlpha = 1;
  }

  G.Tools.fuji = {
    id: 'fuji', name: 'Escavadeira do Monte Fuji', kind: 'escav', w: 330 * S, h: 190 * S,
    meta: { zoom: 0.13, shake: 0.8, cycle: CYC, scale: S, reach: [96 * S, 300 * S], chegadaT: CH.end },
    create, update, draw, bite, bites, dump, seat, dig, horizon, prebake,
  };
})();
