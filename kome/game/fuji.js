/* Kome no Japão — fuji.js
   'fuji' = ESCAVADEIRA DO MONTE FUJI (máquina absurda nº 19 do Pátio, camada-cookie.md · galho Absurdo).
   É a MESMA escavadeira hidráulica de machines-mid.js (G.Tools.escav), criada uma vez e desenhada com escala 9: do tamanho de um
   morro. A escav interna é "vestida" (dress): o Kome sai no tamanho normal (~50 px) sentado numa pilha de sacos no banco, e a
   neve (lança, teto, capô, contrapeso) é desenhada DENTRO das peças, presa nelas. Escala de montanha: pinheirinhos e casinhas no
   pé, teleférico da casa de máquinas até uma torre no chão, nuvens passando na frente, passarinhos, argolinha + "KOME".
   Som: sound(m, {mute, vol}) todo quadro (loop 'fuji-hidraulica' + 'fuji-terremoto' na mordida, 'fuji-geme', 'fuji-ronco');
   stopSound(m). Custo do draw ≈ 1 ms (demo: __demo.cost(), 200 quadros em canvas de CPU). A caçamba morde pedaços enormes da montanha (r ≈ 300).
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
  const KOME_SC = 1.15 / S;            // Kome do tamanho de sempre (~50 px no mundo) dentro da cabine gigante
  const SNOW = '#FFFFFF', SNOW_S = '#D6E7F3', ICE = '#BFDDF0';
  const esc = () => G.Tools.escav;

  /* ---- roupa da escav interna: Kome pequenininho e neve presa nas PEÇAS (desenhada no espaço local de cada uma) ----
     A escav de machines-mid.js desenha o piloto em tamanho fixo (0.86 do modelo = 340 px aqui). Em vez de mexer nela, troca
     E.drawShiba só enquanto a cabine desenha: no lugar do Kome gigante sai uma pilha de sacos de arroz no banco e o Kome
     de tamanho normal sentado em cima, alcançando o joystick. */
  // dorso da lança (X_BOOM = [[0,0,10.5],[52,-24,17],[134,0,9]]): amostras {x,y,nx,ny,r} da borda de cima
  const BOOM_TOP = (() => {
    const P = [[0, 0, 10.5], [52, -24, 17], [134, 0, 9]], out = [];
    const seg = (a, b, u0, u1, n) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L;
      for (let i = 0; i <= n; i++) { const u = lerp(u0, u1, i / n); out.push([a[0] + dx * u, a[1] + dy * u, nx, ny, lerp(a[2], b[2], u)]); } };
    seg(P[0], P[1], 0.3, 1, 5); seg(P[1], P[2], 0.08, 0.86, 7);
    return out;
  })();
  const BOOM_H = [2.6, 3.4, 2.4, 3.8, 3.0, 2.2, 3.2, 4.0, 2.8, 3.4, 2.6, 3.0, 2.0, 1.4];
  function boomSnow(g) {
    const A = BOOM_TOP; g.beginPath();
    for (let i = 0; i < A.length; i++) { const [x, y, nx, ny, r] = A[i], h = r + BOOM_H[i % BOOM_H.length]; g.lineTo(x + nx * h, y + ny * h); }
    for (let i = A.length - 1; i >= 0; i--) { const [x, y, nx, ny, r] = A[i]; g.lineTo(x + nx * (r - 1.6), y + ny * (r - 1.6)); }
    g.closePath(); g.lineJoin = 'round'; g.strokeStyle = LINE; g.lineWidth = 1.3; g.stroke(); g.fillStyle = SNOW_S; g.fill();
    g.beginPath();
    for (let i = 0; i < A.length; i++) { const [x, y, nx, ny, r] = A[i], h = r + BOOM_H[i % BOOM_H.length]; g.lineTo(x + nx * h, y + ny * h); }
    for (let i = A.length - 1; i >= 0; i--) { const [x, y, nx, ny, r] = A[i]; g.lineTo(x + nx * (r + 0.4), y + ny * (r + 0.4)); }
    g.closePath(); g.fillStyle = SNOW; g.fill();
    // pingentes de gelo na barriga da lança
    g.fillStyle = ICE; g.strokeStyle = LINE; g.lineWidth = 0.7;
    for (let i = 2; i < A.length - 1; i += 3) { const [x, y, nx, ny, r] = A[i], bx = x - nx * r, by = y - ny * r, L = 3.5 + (i & 1) * 2.5;
      g.beginPath(); g.moveTo(bx - 1.4, by); g.lineTo(bx + 1.4, by); g.lineTo(bx, by + L); g.closePath(); g.fill(); g.stroke(); }
  }
  // monte de neve feito de "lombadas" (contorno por fora: risca grosso, depois enche) + faixa de sombra embaixo
  function mounds(g, x0, x1, y, base, M) {
    const path = () => { g.beginPath(); g.rect(x0, y - base, x1 - x0, base + 0.6); for (const [cx, w, h] of M) { g.moveTo(cx + w, y - base + 0.5); g.ellipse(cx, y - base + 0.5, w, h, 0, 0, PI, true); } };
    path(); g.strokeStyle = LINE; g.lineWidth = 2.4; g.lineJoin = 'round'; g.stroke(); g.fillStyle = SNOW; g.fill();
    g.fillStyle = SNOW_S; g.fillRect(x0, y - 0.9, x1 - x0, 1.5);
  }
  const ROOF_M = [[-9.6, 3.6, 2.6], [7, 4.4, 3.4], [23, 2.6, 2], [37, 2.4, 1.8]];
  const HOOD_M = [[-62, 6, 2.8], [-50, 3, 1.6], [-27, 6, 3.4], [-12, 7, 2.6]];
  const CWT_M = [[-86, 5, 2.4], [-74, 5, 2]];
  function sacks(g) {   // pilha de sacos de arroz no banco (o Kome precisa alcançar o joystick)
    const S3 = [[13, -53.4, 8.4], [14, -55.8, 7.4], [15, -58.2, 6.2]];
    g.lineWidth = 0.55; g.strokeStyle = LINE;
    for (const [x, y, w] of S3) {
      g.fillStyle = PAL.sack; g.beginPath(); g.ellipse(x + w / 2, y + 1.2, w / 2, 1.3, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = PAL.red; g.fillRect(x + w / 2 - 0.9, y + 0.5, 1.8, 1.2);
    }
  }
  const SHB = { real: null };
  function tinyKome(g, x, y, pose, t, o) {
    sacks(g);
    const sc = o.scale; o.scale = KOME_SC; SHB.real(g, 18, -59.5, 'drive', t, o); o.scale = sc;
  }
  function dress(ex) {
    const rig = ex.rig; if (!rig || !rig.get) return;
    const wrap = (name, after, shim) => { const p = rig.get(name); if (!p || !p.draw || p._fuji) return; const f0 = p.draw; p._fuji = true;
      p.draw = (g, pp, r, t) => {
        if (shim) { SHB.real = E.drawShiba; E.drawShiba = tinyKome; try { f0(g, pp, r, t); } finally { E.drawShiba = SHB.real; } }
        else f0(g, pp, r, t);
        after(g, t);
      }; };
    wrap('cab', g => { mounds(g, -13.5, 38.5, -112, 1.6, ROOF_M);
      g.fillStyle = ICE; g.strokeStyle = LINE; g.lineWidth = 0.6;     // pingentes na aba do teto
      for (let i = 0; i < 4; i++) { const x = -9 + i * 13; g.beginPath(); g.moveTo(x - 1.2, -105); g.lineTo(x + 1.2, -105); g.lineTo(x, -100.5 - (i & 1) * 1.6); g.closePath(); g.fill(); g.stroke(); } }, true);
    // a neve da lança vai por cima do pistão do braço (que deita no dorso dela): desenha no quadro da lança, depois do pistão
    const boomP = rig.get('boom'), host = rig.get('pStick') || boomP;
    wrap(host === boomP ? 'boom' : 'pStick', g => {
      if (host !== boomP) { const a = host.m, b = boomP.m, det = a[0] * a[3] - a[1] * a[2]; if (!det) return;
        const i0 = a[3] / det, i1 = -a[1] / det, i2 = -a[2] / det, i3 = a[0] / det, i4 = -(i0 * a[4] + i2 * a[5]), i5 = -(i1 * a[4] + i3 * a[5]);
        g.save(); g.transform(i0, i1, i2, i3, i4, i5); g.transform(b[0], b[1], b[2], b[3], b[4], b[5]); boomSnow(g); g.restore(); }
      else boomSnow(g);
    });
    wrap('house', g => { mounds(g, -69, -3, -66, 1.4, HOOD_M); mounds(g, -91, -67, -57, 1.2, CWT_M); });
  }

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
      komeO: { x: 0, y: 0 }, anchorO: { x: 0, y: 0 }, snd: null, sndT: 0,
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
    dress(m.ex);
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
    if (m.ex.rig) { toW(m, m.ex.rig.world('cab', 19, -62, TW), m.komeO); toW(m, m.ex.rig.world('house', -80, -76, TW), m.anchorO); }
    m.fill = m.ex.load || 0;
    m.shakeK = Math.max(0, m.shakeK - dt * 1.5); m.flash = Math.max(0, m.flash - dt * 3);
    if (m.title > 0) { m.title = Math.min(1, m.title + dt / 3.4); if (m.title >= 1) m.title = 0; }
    for (const bd of m.birds) bd.a += dt * bd.sp;
    // câmera
    const c = m.cam, tx = m.x + f * 700, ty = m.mode === 'chegada' && m.tc < CH.roar ? -1100 : -1450, tz = 0.13;
    if (!m.camInit) { m.camInit = true; c.x = tx; c.y = ty; c.z = tz; } else { c.x = damp(c.x, tx, 2, dt); c.y = damp(c.y, ty, 1.5, dt); c.z = damp(c.z, tz, 1.5, dt); }
  }

  const TW = { x: 0, y: 0, rot: 0 };
  function drawClouds(g, m, front) {
    const ci = cloudImg(), s = m.seatO, t = m.t;
    for (let i = 0; i < 6; i++) {
      if ((i & 1) !== (front ? 1 : 0)) continue;
      const span = front ? 3000 : 4600, x = s.x - span / 2 + ((t * (50 + i * 18) + i * 1300) % span), y = s.y + [-300, 80, 160, 520, -560, -180][i];
      const sc = (front ? 0.55 : 0.85) + 0.3 * rnd(i);
      g.globalAlpha = front ? 0.74 : 0.95;
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
  /* pé da montanha: pinheirinhos, duas casinhas e a estação do teleférico (tudo no tamanho de sempre = a máquina é que é enorme) */
  const TREES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => ({ d: 1750 + i * 115 + rnd(i * 11) * 60, h: 70 + rnd(i * 13) * 60 }));
  const HOUSES = [1960, 2560];
  const STATION = 2240;
  function groundY(m, x) { if (!m.floorF) return m.y; const y = m.floorF(x); return Math.abs(y - m.y) < 30 ? y : null; }
  function drawFoot(g, m) {
    const f = m.face; g.lineWidth = 6; g.strokeStyle = LINE; g.lineJoin = 'round';
    for (const tr of TREES) {
      const x = m.x - f * tr.d, y = groundY(m, x); if (y === null) continue;
      const h = tr.h, w = h * 0.42;
      g.fillStyle = PAL.woodD; g.fillRect(x - 5, y - 16, 10, 16); g.strokeRect(x - 5, y - 16, 10, 16);
      g.fillStyle = PAL.leafD; g.beginPath(); g.moveTo(x, y - h - 12); g.lineTo(x + w, y - 12); g.lineTo(x - w, y - 12); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = PAL.leaf; g.beginPath(); g.moveTo(x, y - h - 12); g.lineTo(x - w * 0.55, y - h * 0.45); g.lineTo(x - w * 0.1, y - h * 0.45); g.closePath(); g.fill();
      g.fillStyle = SNOW; g.beginPath(); g.moveTo(x, y - h - 12); g.lineTo(x + w * 0.26, y - h * 0.62 - 12); g.lineTo(x - w * 0.26, y - h * 0.62 - 12); g.closePath(); g.fill();
    }
    for (let i = 0; i < HOUSES.length; i++) {
      const x = m.x - f * HOUSES[i], y = groundY(m, x); if (y === null) continue;
      const w = 110, h = 62;
      Draw.box(g, x - w / 2, y - h, w, h, i ? PAL.cream : '#F2D9A6', { r: 4 });
      g.fillStyle = PAL.glassD; g.fillRect(x - 14, y - 44, 28, 22); g.strokeRect(x - 14, y - 44, 28, 22);
      g.fillStyle = i ? '#3F5E86' : PAL.red; g.beginPath(); g.moveTo(x - w / 2 - 18, y - h + 4); g.lineTo(x, y - h - 46); g.lineTo(x + w / 2 + 18, y - h + 4); g.closePath(); g.fill(); g.stroke();
      if (m.night > 0.2) { g.fillStyle = '#FFE3A0'; g.globalAlpha = m.night; g.fillRect(x - 12, y - 42, 24, 18); g.globalAlpha = 1; }
    }
  }
  // teleférico: torre no chão atrás da máquina, cabo até a lança, cabine indo e voltando
  function drawCable(g, m, front) {
    const f = m.face, sx = m.x - f * STATION, sy = groundY(m, sx); if (sy === null) return null;
    const tx = sx, ty = sy - 300, a = m.anchorO;
    if (!front) {
      g.lineWidth = 6; g.strokeStyle = LINE;
      Draw.box(g, sx - 70, sy - 96, 140, 96, '#C9D3DC', { r: 4 }); Draw.box(g, sx - 84, sy - 112, 168, 22, PAL.red, { r: 4 });
      g.fillStyle = PAL.glassD; g.fillRect(sx - 40, sy - 70, 80, 34); g.strokeRect(sx - 40, sy - 70, 80, 34);
      Draw.box(g, sx - 12, ty, 24, sy - 112 - ty, PAL.steelD, {});
      Draw.box(g, sx - 44, ty - 10, 88, 16, PAL.steel, { r: 3 });
      return null;
    }
    if (m.rise > 0.01) return null;
    const cx = (tx + a.x) / 2, cy = (ty + a.y) / 2 + 220;
    g.lineWidth = 9; g.strokeStyle = LINE; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(cx, cy, a.x, a.y); g.stroke();
    g.lineWidth = 3; g.strokeStyle = PAL.grayL; g.stroke();
    // poliazinha presa na lança
    g.lineWidth = 6; g.strokeStyle = LINE; g.fillStyle = PAL.steelD; g.beginPath(); g.arc(a.x, a.y, 30, 0, TAU); g.fill(); g.stroke();
    const u = 0.08 + 0.84 * (0.5 - 0.5 * Math.cos(m.t * 0.32)), iu = 1 - u;
    const gx = iu * iu * tx + 2 * iu * u * cx + u * u * a.x, gy = iu * iu * ty + 2 * iu * u * cy + u * u * a.y;
    const sw = Math.sin(m.t * 1.7) * 0.06;
    g.save(); g.translate(gx, gy); g.rotate(sw);
    g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 46); g.stroke();
    Draw.box(g, -46, 46, 92, 70, PAL.red, { r: 10 });
    g.fillStyle = PAL.cream; g.fillRect(-36, 58, 72, 26); g.strokeRect(-36, 58, 72, 26);
    g.fillStyle = LINE; g.fillRect(-2, 58, 4, 26);
    g.restore();
    return null;
  }
  function draw(g, m) {
    if (!m.init) return;
    const ex = m.ex, dy = m.rise * RISE_D, t = m.t, f = m.face;
    drawClouds(g, m, false);
    drawFoot(g, m);
    drawCable(g, m, false);
    g.save();
    if (m.rise > 0.001) { g.beginPath(); g.rect(m.x - 6000, m.y - 8000, 12000, 8000); g.clip(); }
    g.translate(m.x, m.y + dy); g.scale(S, S);
    const z0 = Draw.zoom, mp = Draw.minPx; Draw.lod(z0 * S, mp);
    esc().draw(g, ex);            // neve e Kome pequenininho saem de dentro das peças (dress)
    Draw.lod(z0, mp);
    g.restore();
    drawCable(g, m, true);
    drawClouds(g, m, true);
    // passarinhos rodando a ponta do braço (bandinho miúdo: do tamanho de passarinho, perto de uma lança de morro)
    if (m.rise < 0.5) {
      const b = toW(m, esc().bite(ex), { x: 0, y: 0 });
      g.strokeStyle = LINE; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
      for (const bd of m.birds) {
        const x = b.x + Math.cos(bd.a) * bd.r * 1.6, y = b.y - 700 - bd.dy + Math.sin(bd.a) * bd.r * 0.5, w = 22, fl = Math.sin(t * 9 + bd.a * 3) * 10;
        g.moveTo(x - w, y - fl); g.quadraticCurveTo(x - w * 0.4, y - 8, x, y); g.quadraticCurveTo(x + w * 0.4, y - 8, x + w, y - fl);
      }
      g.stroke();
    }
    // cadê o Kome? argolinha piscando em volta dele dentro da cabine + plaquinha em cima do teto
    if (m.rise < 0.3) {
      const k = m.komeO, s = m.seatO, bl = 0.55 + 0.45 * Math.sin(t * 5);
      g.globalAlpha = bl; g.strokeStyle = PAL.goldL; g.lineWidth = 22; g.beginPath(); g.arc(k.x, k.y + 10, 110, 0, TAU); g.stroke(); g.globalAlpha = 1;
      const ly = s.y - 470;
      Draw.text(g, 'KOME', k.x, ly, { size: 96, col: PAL.goldL, sw: 16, stroke: LINE, weight: 900 });
      g.fillStyle = PAL.goldL; g.strokeStyle = LINE; g.lineWidth = 10; g.beginPath(); g.moveTo(k.x - 34, ly + 62); g.lineTo(k.x + 34, ly + 62); g.lineTo(k.x, ly + 110 + 10 * Math.sin(t * 5)); g.closePath(); g.stroke(); g.fill();
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

  /* ---- som (E.Sfx/E.Loops, tudo sintetizado). Quem chama: sound(m, {mute, vol}) depois de update, todo quadro.
     Gemido hidráulico grave em loop (regime = força dos pistões), terremoto a cada mordida, gemido na virada, ronco na estreia.
     mute (ou E.Audio.muted) desliga tudo; stopSound(m) solta o loop (ao trocar de tela). */
  let sndDef = false;
  function defSounds() {
    if (sndDef || !E.Sfx || !E.Sfx.define) return; sndDef = true;
    E.Sfx.define('fuji-terremoto', { gate: 0.6, max: 2, peak: 0.6, duck: 0.35, prio: 2, rev: 0.15, render: D => {   // mordida = tremor de terra
      const b = D.buf(2.6);
      D.osc(b, { f: 68, f1: 24, slide: 0.6, a: 0.004, s: 0.08, d: 0.9, vol: 0.9, punch: 0.5 });
      D.noise(b, { color: 'brown', a: 0.04, s: 0.5, d: 1.7, vol: 1, lp: 140 });
      D.noise(b, { color: 'brown', a: 0.2, s: 0.4, d: 1.5, vol: 0.45, bp: 280, q: 0.7, am: 9, amDepth: 0.7 });
      D.noise(b, { a: 0.01, d: 0.35, vol: 0.18, lp: 1100, at: 0.03 });
      return D.sat(b, 1.6); } });
    E.Sfx.define('fuji-geme', { gate: 0.8, max: 1, peak: 0.4, jit: 0.3, render: D => {                               // gemido hidráulico grave
      const b = D.buf(2.1);
      D.osc(b, { wave: 'saw', path: [[0, 46], [0.7, 60], [1.7, 42]], a: 0.25, s: 0.9, d: 0.85, vol: 0.6, lp: 300, vib: 0.02, vibHz: 2.5 });
      D.osc(b, { wave: 'saw', path: [[0, 69], [0.7, 90], [1.7, 63]], a: 0.3, s: 0.8, d: 0.85, vol: 0.35, lp: 420, vib: 0.025, vibHz: 3.1 });
      D.noise(b, { color: 'pink', a: 0.3, s: 0.8, d: 0.8, vol: 0.12, bp: 520, q: 2 });
      return D.sat(b, 1.3); } });
    E.Sfx.define('fuji-ronco', { gate: 2, max: 1, peak: 0.6, duck: 0.5, prio: 2, rev: 0.25, render: D => {          // estreia: ronco de vulcão
      const b = D.buf(3.4);
      D.osc(b, { wave: 'saw', path: [[0, 30], [0.8, 52], [3, 34]], a: 0.5, s: 1.4, d: 1.4, vol: 0.7, lp: 260, vib: 0.03, vibHz: 4 });
      D.noise(b, { color: 'brown', a: 0.6, s: 1.2, d: 1.5, vol: 1, lp: 150 });
      D.noise(b, { color: 'brown', a: 0.8, s: 1, d: 1.4, vol: 0.4, bp: 340, q: 0.8, am: 6, amDepth: 0.6 });
      return D.sat(b, 1.7); } });
    if (E.Loops && E.Loops.define && E.Loops.tones) E.Loops.define('fuji-hidraulica', { vol: 0.7, rate: [0.75, 1.3], lp: [260, 900], gain: [0.4, 1], render: D => {
      const n = 2 * D.sr, b = new Float32Array(n);
      E.Loops.tones(D, b, [['saw', 41, 0.3], ['saw', 61.5, 0.18], ['sin', 20.5, 0.35], ['sin', 82, 0.06]]);
      D.filter(b, 'lp', 240, 0.8, 0, true);
      const bd = E.Loops.bed(D, n, { color: 'brown', vol: 0.25, lp: 150 });
      for (let i = 0; i < n; i++) b[i] = b[i] * (0.85 + 0.15 * Math.sin(TAU * 2 * i / n)) + bd[i];
      return D.sat(b, 1.3); } });
  }
  const SND = { vol: 1, pitch: 1 };
  function sound(m, o) {
    o = o || {};
    if (o.mute || !E.Sfx || (E.Audio && E.Audio.muted)) { stopSound(m); return; }
    defSounds();
    const v = o.vol === undefined ? 1 : o.vol;
    if (!m.snd && E.Loops && m.rise < 0.98) { try { m.snd = E.Loops.start('fuji-hidraulica', { vol: 0, rate: 0.2 }); } catch (e) { m.snd = null; } }
    m.sndT -= 1 / 60;
    if (m.snd && m.sndT <= 0) { m.sndT = 0.12; try { m.snd.set({ rate: clamp((m.ex.power || 0) * 1.2, 0, 1), vol: 0.55 * v * (1 - m.rise) }, 0.25); } catch (e) { /* */ } }
    for (const e of m.ev) {
      let n = null; SND.vol = v; SND.pitch = 1;
      if (e === 'bite') n = 'fuji-terremoto';
      else if (e === 'swing') n = 'fuji-geme';
      else if (e === 'dump') { n = 'fuji-geme'; SND.pitch = 0.8; SND.vol = v * 0.6; }
      else if (e === 'roar') n = 'fuji-ronco';
      else if (e === 'rise') { n = 'fuji-geme'; SND.pitch = 0.6; }
      if (n) { try { E.Sfx.play(n, SND); } catch (err) { /* sem áudio */ } }
    }
  }
  function stopSound(m) { if (m && m.snd) { try { m.snd.stop(0.4); } catch (e) { /* */ } m.snd = null; } }

  function bite(m) { return m.bitesA[0]; }
  function bites(m) { return m.bitesA; }
  function dump(m) { return m.dumpO; }
  function seat(m) { return m.seatO; }
  function dig(m, heap, area, o) { const b = m.bitesA[0]; if (!b.active || !heap) return 0; const r = heap.dig(b.x, area, b.r, o); return r.got || 0; }
  function prebake() { cloudImg(); defSounds(); }

  /* ---- horizonte do Pátio: a escavadeira gigante (silhueta de verdade, animada) cavando atrás dos morros ----
     horizon(g, {x0,x1,y,k=.12,t,n,tint,haze,night}); n>=10 ganha uma 2ª (mais longe); ocupa o meio-fim da faixa. */
  /* Cache: a silhueta custava ~10 ms/quadro (rig inteiro redesenhado). Agora cada lado (i) é gravado UMA vez como
     HZ_F quadros de um ciclo de cavada (sem tinta) e reaproveitado; os quadros tingidos (tinta+névoa) também ficam guardados
     até a tinta mudar, então o quadro normal é só 1 drawImage. Noite = só a luzinha da cabine, desenhada por cima (não entra no cache). */
  const HZ_W = 460, HZ_H = 300, HZ_F = 12;
  const HZ = { side: [] };
  const HINP = { x: 0, y: 0, face: 1, floor: () => 0, digging: true, speedMul: 0.6, power: 1, tx: 220, ty: -40, parts: null };
  function hzSide(i) {
    if (HZ.side[i]) return HZ.side[i];
    const E0 = esc(), ex = E0.create({}), dt = 1 / 60; HINP.face = i ? 1 : -1;
    let w = 0; while (w++ < 600) { E0.update(ex, dt, HINP); if (ex.wrap && w > 60) break; }   // aquece e para no começo de um ciclo
    let N = 0; while (N++ < 1200) { E0.update(ex, dt, HINP); if (ex.wrap) break; }            // mede o ciclo (em passos)
    const per = Math.max(0.5, N * dt), fr = [];
    for (let f = 0, step = 0; f < HZ_F; f++) {
      const want = Math.round(f * N / HZ_F); while (step < want) { E0.update(ex, dt, HINP); step++; }
      const cv = document.createElement('canvas'); cv.width = HZ_W; cv.height = HZ_H;
      const c = cv.getContext('2d'); c.translate(230, 270); E0.draw(c, ex); fr.push(cv);
    }
    // recorta pro retângulo que algum quadro usa (menos pixel pra compor a cada quadro)
    let x0 = HZ_W, y0 = HZ_H, x1 = 0, y1 = 0;
    try {
      for (const cv of fr) { const d = cv.getContext('2d').getImageData(0, 0, HZ_W, HZ_H).data;
        for (let yy = 0; yy < HZ_H; yy++) for (let xx = 0; xx < HZ_W; xx++) if (d[(yy * HZ_W + xx) * 4 + 3]) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; } }
    } catch (e) { x0 = 0; y0 = 0; x1 = HZ_W - 1; y1 = HZ_H - 1; }
    if (x1 < x0) { x0 = 0; y0 = 0; x1 = HZ_W - 1; y1 = HZ_H - 1; }
    const bx = x0, by = y0, bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const crop = fr.map(cv => { const o = document.createElement('canvas'); o.width = bw; o.height = bh; o.getContext('2d').drawImage(cv, -bx, -by); return o; });
    return (HZ.side[i] = { fr: crop, per, bx, by, bw, bh, tf: [], ok: [], tk: '', seat: { x: ex.seatO.x, y: ex.seatO.y } });
  }
  function horizon(g, o) {
    if (!esc()) return;
    const k = o.k || 0.12, t = o.t || 0, n = Math.max(1, o.n | 0), tint = o.tint || '#93A3B4', haze = o.haze === undefined ? 0.6 : o.haze, night = o.night || 0;
    const count = n >= 10 ? 2 : 1;
    for (let i = count - 1; i >= 0; i--) {
      const sd = hzSide(i), ph = ((t + i * 1.3) / sd.per) % 1;
      const fi = Math.floor((ph < 0 ? ph + 1 : ph) * HZ_F) % HZ_F, al = Math.min(0.95, haze + 0.2 + i * 0.1), key = tint + '|' + al;
      if (sd.tk !== key) { sd.tk = key; sd.ok = []; }   // tinta mudou (céu/estação): retinge os quadros sob demanda
      if (!sd.tf[fi]) { sd.tf[fi] = document.createElement('canvas'); sd.tf[fi].width = sd.bw; sd.tf[fi].height = sd.bh; }
      const out = sd.tf[fi];
      if (!sd.ok[fi]) {
        const c = out.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, sd.bw, sd.bh); c.drawImage(sd.fr[fi], 0, 0);
        c.globalCompositeOperation = 'source-atop'; c.globalAlpha = al; c.fillStyle = tint; c.fillRect(0, 0, sd.bw, sd.bh); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        sd.ok[fi] = true;
      }
      const sc = k * S * 0.9 * (1 - i * 0.3), x = lerp(o.x0, o.x1, i ? 0.42 : 0.62), y = o.y - i * 8;
      g.drawImage(out, x + (sd.bx - 230) * sc, y + (sd.by - 270) * sc, sd.bw * sc, sd.bh * sc);
      if (night > 0.2) { g.fillStyle = '#FFE3A0'; g.globalAlpha = night; const s = sd.seat; g.fillRect(x + s.x * sc - 2, y + s.y * sc - 2, 4, 3); g.globalAlpha = 1; }
    }
    // nuvenzinha passando na frente
    const ci = cloudImg(), cx = lerp(o.x0, o.x1, 0.5 + 0.15 * Math.sin(t * 0.07)), cs = k * 1.2;
    g.globalAlpha = 0.7; g.drawImage(ci.cv, cx - ci.w * cs / 2, o.y - 150 * k * S * 0.9 - ci.h * cs / 2, ci.w * cs, ci.h * cs); g.globalAlpha = 1;
  }

  G.Tools.fuji = {
    id: 'fuji', name: 'Escavadeira do Monte Fuji', kind: 'escav', w: 330 * S, h: 190 * S,
    meta: { zoom: 0.13, shake: 0.8, cycle: CYC, scale: S, reach: [96 * S, 300 * S], chegadaT: CH.end },
    create, update, draw, bite, bites, dump, seat, dig, horizon, prebake, sound, stopSound,
  };
})();
