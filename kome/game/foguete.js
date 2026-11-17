/* Kome no Japão — foguete.js
   'foguete' = FOGUETE DE MOCHI (máquina absurda nº 18 do Pátio, camada-cookie.md · galho Absurdo).
   Um foguete de ~1.600 px feito de dango (bolas verde, branca e rosa num espeto que vira antena) numa base de lançamento no pé da
   montanha. Uma torre com braço telescópico pega arroz da encosta (4 conchadas = bites) e despeja no tanque; contagem "3, 2, 1",
   decolagem com chama e fumaça gigante, some pra cima e, segundos depois, desce de paraquedas um caixote de ienes (PAGAR no 'land').
   Enquanto o caixote desce, o próximo foguete sobe do silo da base. Kome vai na escotilha da bola branca.
   Depende de: core.js, pix.js, shiba.js, fx.js (só Draw/drawShiba de fato). Molde: trembala.js.

   Interface comum: G.Tools.foguete = {id, name, kind, w, h, meta, create(opts), update(m,dt,inp), draw(g,m), bite(m), bites(m),
   dump(m), seat(m), dig(m, heap, area, o), horizon(g, o), prebake(level?)}.
   Espaço do modelo: origem no chão no CENTRO da base; +x = lado da montanha (inp.face), y pra baixo, escala fixa 1 (Kome = 44 px).
   Base de x −560 a +560 (topo y −40), foguete até y ≈ −1600, torre em +360..+480 até −1720, braço alcança dx 1.100–1.900.
   opts = {mode: 'normal' | 'chegada', pilot: paleta do Kome}. m.x pega inp.x só no 1º update (escrever m.x pra mudar a base).
   inp: x, y, face, floor(x) (y de mundo da superfície da montanha; sem floor supõe encosta a −600), digging (false = pausa a carga),
   speedMul, parts (E.Particles), night, view {x0,x1}.

   CICLO normal (meta.cycle = 25 s / speedMul): 0.6–11.8 quatro conchadas de 2,8 s (cada uma: 'bite' quando a concha morde a
   encosta, 'load' quando despeja; m.fill 0→1) · 12 'full' · 13/14/15 'count' (m.count = 3,2,1) · 16 'launch' (m.payload = m.fill,
   m.flash, m.shakeK) · 18.5 'gone' · 19.5 caixote aparece lá em cima · 20.5–23.5 foguete novo sobe do silo ('rise') ·
   23 'land' (PAGAR AQUI com m.payload; moedas) · 25 = 0.
   Modo 'chegada' (meta.chegadaT = 11 s): laje cai ('build' 1.2), torre cresce, foguete sobe do silo ('rise' 3.6), título (m.title),
   contagem 6.6/7.6/8.6, 'launch' 9.6, 'ready' 11 → vira 'normal' no meio do voo (ct = 17.4), então o caixote desce e paga.
   Âncoras: bites(m) = [a conchada atual] {x,y,r:120,active}; bite(m) = ela; dump(m) = escotilha do tanque; seat(m) = escotilha do Kome.
   Ler: m.phase ('carregando','contagem','voo','descida','chegada'), m.fill, m.payload, m.count, m.rk (altura do foguete, ≤0),
   m.crate {x,y,on}, m.flash, m.shakeK, m.cam {x,y,z}, m.title. */
(function () {
  'use strict';
  const E = window.KomeEngine;
  if (!E || !E.Draw) throw new Error('foguete.js: carregue core, pix, shiba e fx antes');
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  /* ---- geometria ---- */
  const PT = -40, PAD = 560, TX0 = 360, TX1 = 480, TTOP = -1720, PIV = [420, -1690];
  const BALLS = [[-300, '#9CCB6A', '#6E9E44', '#C2E59A'], [-680, '#FFF8EC', '#E6D9C2', '#FFFFFF'], [-1060, '#F4A7B9', '#D9788F', '#FFD0DA']];
  const BR = 210, HATCH = [138, -1222], PORT = [0, -705], ROCK_H = 1600;
  const REACH = [1150, 1400, 1650, 1900];
  /* ---- tempo ---- */
  const T_L0 = 0.6, SCOOP = 2.8, T_FULL = 12, T_C3 = 13, T_LAUNCH = 16, T_GONE = 18.5, T_DROP = 19.5, T_REARM = 20.5, T_LAND = 23, T_CYC = 25;
  const CH = { build: 1.2, tower: 3.4, rise: 3.6, risen: 5.4, title: 5.6, c3: 6.6, launch: 9.6, end: 11 };
  const A_UP = 950, CRATE_Y0 = -4200;
  const rkY = tau => (tau <= 0 ? 0 : -0.5 * A_UP * tau * tau - 120 * tau);

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

  /* ---- arte estática ---- */
  function rocketArt(c, f) {
    c.save(); c.scale(f, 1);
    // espeto (antena) atravessando tudo
    Draw.beam(c, [[0, -60], [0, -1590]], 34, PAL.wood, { ol: 3, hi: PAL.woodL, shade: PAL.woodD });
    // aletas
    for (const s of [-1, 1]) {
      Draw.poly(c, [[s * 150, -330], [s * 330, -150], [s * 340, 10], [s * 160, -70]], PAL.red, { ol: 3, shade: PAL.redD, hi: PAL.redL });
      Draw.poly(c, [[s * 230, -240], [s * 300, -175], [s * 304, -140], [s * 236, -200]], PAL.cream, { ol: 0 });
    }
    // sino do motor
    Draw.poly(c, [[-90, -120], [90, -120], [160, 0], [-160, 0]], PAL.steel, { ol: 3, shade: PAL.steelD, hi: PAL.steelL });
    Draw.box(c, -110, -150, 220, 40, PAL.grayD, { ol: 3, r: 6, top: PAL.gray });
    // bolas de dango (de baixo pra cima)
    for (let i = 0; i < 3; i++) {
      const [cy, col, d, l] = BALLS[i];
      Draw.circle(c, 0, cy, BR, col, { ol: 3.4, hi: l, shade: d });
      c.fillStyle = l; c.beginPath(); c.ellipse(-80, cy - 110, 50, 26, -0.5, 0, TAU); c.fill();
      // marca de tostado do dango
      c.fillStyle = 'rgba(160,100,40,.22)'; c.beginPath(); c.ellipse(70, cy + 60, 60, 30, 0.3, 0, TAU); c.fill();
    }
    // carinha na bola rosa
    c.strokeStyle = LINE; c.lineWidth = 9; c.beginPath();
    c.arc(-70, -1080, 22, PI * 1.1, PI * 1.9); c.moveTo(92, -1080); c.arc(70, -1080, 22, PI * 1.1, PI * 1.9); c.stroke();
    c.beginPath(); c.arc(0, -1030, 26, 0.15 * PI, 0.85 * PI); c.stroke();
    c.fillStyle = 'rgba(232,90,110,.45)'; c.beginPath(); c.ellipse(-120, -1035, 30, 16, 0, 0, TAU); c.ellipse(120, -1035, 30, 16, 0, 0, TAU); c.fill();
    // ponta de kinako
    c.beginPath(); c.moveTo(-150, -1225); c.quadraticCurveTo(-60, -1330, 0, -1470); c.quadraticCurveTo(60, -1330, 150, -1225); c.closePath();
    c.lineWidth = 7; c.strokeStyle = LINE; c.stroke(); c.fillStyle = '#E2B85C'; c.fill();
    c.fillStyle = '#C8963E'; c.beginPath(); c.moveTo(20, -1440); c.quadraticCurveTo(70, -1330, 150, -1225); c.lineTo(110, -1228); c.quadraticCurveTo(50, -1320, 20, -1440); c.fill();
    // bandeirinha no topo do espeto
    Draw.poly(c, [[0, -1590], [120, -1560], [0, -1530]], PAL.red, { ol: 2.6 });
    // escotilha do tanque
    Draw.box(c, HATCH[0] - 40, HATCH[1] - 14, 80, 28, PAL.steel, { ol: 2.6, r: 6, top: PAL.steelL, shade: PAL.steelD });
    // escotilha do Kome (vidro; o Kome entra ao vivo)
    Draw.circle(c, PORT[0], PORT[1], 86, PAL.steel, { ol: 3, hi: PAL.steelL, shade: PAL.steelD });
    c.fillStyle = '#2F3E4C'; c.beginPath(); c.arc(PORT[0], PORT[1], 66, 0, TAU); c.fill();
    // medidor do tanque (bola verde)
    Draw.box(c, -46, -440, 92, 240, PAL.grayD, { ol: 3, r: 10, top: false, shade: false });
    c.restore();
    Draw.text(c, 'KOME-1', 0, -540, { size: 60, col: PAL.red, sw: 0, weight: 900 });
  }
  function rocketBake(f, li) { return bake('rk|' + f, li, -360, -1620, 720, 1640, c => rocketArt(c, f)); }
  function baseBake(f, li) {
    return bake('base|' + f, li, -PAD - 20, TTOP - 60, PAD + TX1 + 60 + 20, -TTOP + 120, c => {
      c.save(); c.scale(f, 1);
      // torre de serviço
      Draw.lattice(c, TX0, TTOP, TX1 - TX0, -TTOP + PT, 120, 8, PAL.red, { ol: 2 });
      Draw.box(c, TX0 - 30, TTOP - 30, TX1 - TX0 + 60, 36, PAL.grayL, { ol: 2.4, top: PAL.steelL, shade: PAL.gray });
      for (let y = TTOP + 300; y < -200; y += 360) Draw.box(c, TX0 - 90, y, 90, 18, PAL.grayL, { ol: 2, top: false });
      // laje com faixas de perigo
      Draw.box(c, -PAD, PT, PAD * 2, 60, PAL.stoneL, { ol: 3, top: '#E4DECF', shade: PAL.stone });
      c.fillStyle = PAL.yel; c.fillRect(-PAD, PT + 4, PAD * 2, 14);
      c.fillStyle = PAL.blk; for (let x = -PAD; x < PAD; x += 56) { c.beginPath(); c.moveTo(x, PT + 18); c.lineTo(x + 20, PT + 4); c.lineTo(x + 40, PT + 4); c.lineTo(x + 20, PT + 18); c.fill(); }
      c.fillStyle = PAL.stone; c.fillRect(-230, PT + 22, 460, 12);
      c.restore();
      Draw.text(c, 'BASE DE LANÇAMENTO PÉ-DO-MONTE', -f * 0, PT + 44, { size: 22, col: PAL.ink, sw: 0, weight: 900 });
    });
  }

  /* ---- estado ---- */
  function create(opts) {
    opts = opts || {};
    return {
      id: 'foguete', mode: opts.mode === 'chegada' ? 'chegada' : 'normal', pilot: opts.pilot || 'kome',
      init: false, x: 0, y: 0, face: 1, t: 0, ct: 0, tc: 0,
      phase: 'carregando', fill: 0, payload: 0, count: 0, rk: 0, rkIn: 1, built: 1, tower: 1, doors: 0, title: 0,
      arm: { x: 0, y: 0, pour: 0 }, armInit: false, bucketLoad: 0,
      bitesA: [{ x: 0, y: 0, r: 120, active: false }], dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
      crate: { x: 0, y: 0, on: false, sway: 0, landed: 0 }, smoke: [], flash: 0, shakeK: 0, flame: 0,
      cam: { x: 0, y: -900, z: 0.24 }, camInit: false, ev: [], parts: null, night: 0, view: null, floorF: null,
    };
  }
  function emit(m, e) { m.ev.push(e); }
  function floorAt(m, x) { const y = m.floorF ? m.floorF(x) : m.y - 600; return y; }

  function update(m, dt, inp) {
    m.ev.length = 0;
    dt = Math.min(dt, 0.1);
    if (!m.init) { m.init = true; m.x = inp.x || 0; }
    m.y = inp.y || 0; m.face = inp.face < 0 ? -1 : 1; m.night = +inp.night || 0; m.parts = inp.parts || null;
    m.view = inp.view || null; m.floorF = inp.floor || null;
    const f = m.face, sp = inp.speedMul || 1;
    m.t += dt;
    let d = dt * sp;
    let u;   // tempo "de ciclo normal" equivalente (pro desenho)
    if (m.mode === 'chegada') {
      const t0 = m.tc, t1 = t0 + d; m.tc = t1;
      const cr = a => t0 < a && t1 >= a;
      m.built = smooth(t1 / CH.build); m.tower = smooth((t1 - CH.build) / (CH.tower - CH.build));
      m.rkIn = 1 - smooth((t1 - CH.rise) / (CH.risen - CH.rise)); m.doors = t1 > CH.rise - 0.4 && t1 < CH.risen + 0.4 ? 1 : 0;
      m.fill = 1; m.payload = 1;
      if (cr(CH.build)) { emit(m, 'build'); m.shakeK = 0.6; puffRing(m, 0, PT, 14, 120); }
      if (cr(CH.rise)) emit(m, 'rise');
      if (cr(CH.title)) m.title = 0.001;
      for (let k = 0; k < 3; k++) if (cr(CH.c3 + k)) { emit(m, 'count'); m.count = 3 - k; }
      if (cr(CH.launch)) launch(m);
      m.rk = rkY(t1 - CH.launch);
      m.phase = t1 < CH.c3 ? 'chegada' : t1 < CH.launch ? 'contagem' : 'voo';
      m.count = t1 >= CH.c3 && t1 < CH.launch ? 3 - Math.floor(t1 - CH.c3) : 0;
      u = t1 < CH.launch ? T_FULL + 0.5 : T_LAUNCH + (t1 - CH.launch);
      if (t1 >= CH.end) { m.mode = 'normal'; m.ct = T_LAUNCH + (t1 - CH.launch); emit(m, 'ready'); m.title = 0; m.built = m.tower = 1; m.rkIn = 0; }
    }
    if (m.mode === 'normal') {
      const u0 = ((m.ct % T_CYC) + T_CYC) % T_CYC;
      if (inp.digging === false && u0 >= T_L0 && u0 < T_FULL) d = 0;
      const u1 = u0 + d; m.ct += d; u = u1 % T_CYC;
      const cr = a => (u0 < a && u1 >= a) || (u0 < a + T_CYC && u1 >= a + T_CYC);
      for (let k = 0; k < 4; k++) { if (cr(T_L0 + k * SCOOP + SCOOP * 0.35)) biteEv(m, k); if (cr(T_L0 + k * SCOOP + SCOOP * 0.85)) emit(m, 'load'); }
      if (cr(T_FULL)) emit(m, 'full');
      for (let k = 0; k < 3; k++) if (cr(T_C3 + k)) emit(m, 'count');
      if (cr(T_LAUNCH)) launch(m);
      if (cr(T_GONE)) emit(m, 'gone');
      if (cr(T_REARM)) emit(m, 'rise');
      if (cr(T_LAND)) land(m);
      m.fill = u < T_L0 ? 0 : u < T_FULL ? Math.min(1, Math.floor((u - T_L0) / SCOOP) * 0.25 + 0.25 * smooth(((u - T_L0) % SCOOP - SCOOP * 0.85) / (SCOOP * 0.15))) : u < T_LAUNCH ? 1 : 0;
      m.count = u >= T_C3 && u < T_LAUNCH ? 3 - Math.floor(u - T_C3) : 0;
      m.rk = u >= T_LAUNCH && u < T_REARM ? rkY(u - T_LAUNCH) : 0;
      m.rkIn = u >= T_REARM ? 1 - smooth((u - T_REARM) / (T_LAND + 0.5 - T_REARM)) : u >= T_LAUNCH ? 1 : 0;
      m.doors = (u > T_REARM - 0.5 && u < T_LAND + 1) ? 1 : 0;
      m.phase = u < T_FULL ? 'carregando' : u < T_LAUNCH ? 'contagem' : u < T_DROP ? 'voo' : 'descida';
    }
    m.u = u;
    armTick(m, dt, u, inp);
    crateTick(m, dt, u);
    // âncoras
    m.dumpO.x = m.x + f * HATCH[0]; m.dumpO.y = m.y + PT + HATCH[1]; m.dumpO.active = m.arm.pour > 0.5;
    m.seatO.x = m.x + f * PORT[0]; m.seatO.y = m.y + PT + m.rk + m.rkIn * ROCK_H + PORT[1];
    // efeitos
    m.flash = Math.max(0, m.flash - dt * 3); m.shakeK = Math.max(0, m.shakeK - dt * 0.9);
    const flying = m.rk < 0 && m.rk > -6000;
    m.flame = flying || (m.count === 1 && (u % 1) > 0.6) ? 1 : 0;
    if (flying && m.rk > -2400) { m.sAcc = (m.sAcc || 0) + dt * 30; while (m.sAcc >= 1) { m.sAcc--; smokeAdd(m, m.x + (Math.random() - 0.5) * 200, m.y + PT + m.rk + 60, (Math.random() - 0.5) * 900, 200 + Math.random() * 300, 120 + Math.random() * 90); } }
    if (m.count && Math.random() < dt * 10) smokeAdd(m, m.x + (Math.random() - 0.5) * 500, m.y + PT, (Math.random() - 0.5) * 300, -40, 70);
    smokeTick(m, dt);
    if (m.title > 0) { m.title = Math.min(1, m.title + dt / 3.2); if (m.title >= 1) m.title = 0; }
    camTick(m, dt);
  }
  function biteEv(m, k) {
    emit(m, 'bite');
    const b = m.bitesA[0];
    if (m.parts && b.active) m.parts.puff(b.x, b.y, 4, 30, { c: PAL.riceS, speed: 120, up: 60 });
  }
  function launch(m) {
    emit(m, 'launch'); m.payload = m.fill || 1; m.flash = 1; m.shakeK = 1;
    for (let i = 0; i < 26; i++) { const s = i & 1 ? 1 : -1; smokeAdd(m, m.x + s * rnd(i) * 300, m.y + PT, s * (500 + rnd(i * 3) * 1300), -(rnd(i * 7) * 260), 150 + rnd(i * 5) * 140); }
  }
  function land(m) {
    emit(m, 'land');
    const c = m.crate;
    if (m.parts) { m.parts.coins(c.x, c.y - 120, 24, { speed: [200, 520] }); m.parts.puff(c.x, c.y, 6, 40, { c: PAL.sand, speed: 160, up: 30 }); }
  }
  function puffRing(m, dx, dy, n, r) { for (let i = 0; i < n; i++) { const s = i & 1 ? 1 : -1; smokeAdd(m, m.x + s * rnd(i) * PAD, m.y + dy, s * (200 + rnd(i * 2) * 500), -60 - rnd(i) * 100, r * (0.6 + rnd(i * 9) * 0.6)); } }
  function smokeAdd(m, x, y, vx, vy, r) { if (m.smoke.length > 90) m.smoke.shift(); m.smoke.push({ x, y, vx, vy, r, r0: r, life: 0, max: 2.6 + Math.random() * 1.6 }); }
  function smokeTick(m, dt) {
    for (let i = m.smoke.length - 1; i >= 0; i--) {
      const p = m.smoke[i]; p.life += dt; if (p.life > p.max) { m.smoke.splice(i, 1); continue; }
      p.vx *= 1 - 1.3 * dt; p.vy = p.vy * (1 - 1.3 * dt) - 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r = p.r0 * (1 + p.life * 0.8);
      const gy = m.y - p.r * 0.5; if (p.y > gy) p.y = gy;
    }
  }
  // braço da torre: conchadas na encosta
  function armTick(m, dt, u, inp) {
    const f = m.face, A = m.arm, px = m.x + f * PIV[0], py = m.y + PIV[1];
    const homeX = m.x + f * (HATCH[0] + 10), homeY = m.y + PT + HATCH[1] - 120;
    const parkX = m.x + f * 1000, parkY = m.y - 1500;
    let tx = parkX, ty = parkY, pour = 0, bite = null;
    const b = m.bitesA[0]; b.active = false;
    if (m.mode === 'normal' && u >= T_L0 && u < T_L0 + 4 * SCOOP) {
      const k = Math.floor((u - T_L0) / SCOOP), s = ((u - T_L0) % SCOOP) / SCOOP;
      const bx = m.x + f * REACH[k], fy = floorAt(m, bx), has = fy < m.y - 80, by = has ? fy : m.y - 80;
      b.x = bx; b.y = by; b.r = 120;
      if (s < 0.35) { const q = smooth(s / 0.35); tx = lerp(homeX, bx, q); ty = lerp(homeY, by - 40, q) - Math.sin(q * PI) * 380; }
      else if (s < 0.5) { tx = bx - f * 80 * smooth((s - 0.35) / 0.15); ty = by - 20 + 40 * Math.sin((s - 0.35) / 0.15 * PI); b.active = has && inp.digging !== false; m.bucketLoad = Math.max(m.bucketLoad, smooth((s - 0.35) / 0.15)); }
      else if (s < 0.85) { const q = smooth((s - 0.5) / 0.35); tx = lerp(bx - f * 80, homeX, q); ty = lerp(by - 20, homeY, q) - Math.sin(q * PI) * 420; }
      else { tx = homeX; ty = homeY; pour = smooth((s - 0.85) / 0.06); m.bucketLoad = 1 - smooth((s - 0.88) / 0.1); }
      if (s < 0.35) m.bucketLoad = 0;
    } else if (m.mode === 'chegada' && m.tc < CH.tower) { tx = px + f * 30; ty = py + 60; }
    if (!m.armInit) { m.armInit = true; A.x = tx; A.y = ty; }
    A.x = damp(A.x, tx, 9, dt); A.y = damp(A.y, ty, 9, dt); A.pour = damp(A.pour, pour, 12, dt);
    if (A.pour > 0.5 && m.parts && Math.random() < dt * 30) m.parts.spray(A.x, A.y + 40, 2, { shape: 'grain', c: [PAL.rice, PAL.riceS], w: 6, life: 0.6, speed: [40, 140], dir: PI / 2, spread: 0.5, ol: true });
    if (b.active && m.parts && Math.random() < dt * 14) m.parts.puff(b.x, b.y, 1, 26, { c: PAL.riceS, speed: 80, up: 40 });
    if (m.mode === 'chegada' && m.tc < CH.tower) { A.x = px; A.y = py + 40; }
  }
  function crateTick(m, dt, u) {
    const c = m.crate, f = m.face, lx = m.x - f * 820;
    if (m.mode === 'normal' && u >= T_DROP && u < T_CYC) {
      c.on = true; c.x = lx + Math.sin(m.t * 1.3) * 60 * (u < T_LAND ? 1 : 0);
      const q = clamp((u - T_DROP) / (T_LAND - T_DROP), 0, 1);
      c.y = m.y + lerp(CRATE_Y0, 0, 1 - (1 - q) * (1 - q * 0.3)) ;
      if (u >= T_LAND) c.y = m.y;
      c.sway = u < T_LAND ? Math.sin(m.t * 1.3 + 0.6) * 0.12 : 0;
      c.landed = u >= T_LAND ? clamp((u - T_LAND) / 0.6, 0, 1) : 0;
    } else c.on = false;
  }
  function camTick(m, dt) {
    const f = m.face, c = m.cam;
    let tx = m.x + f * 520, ty = -980, tz = 0.24;
    if (m.mode === 'chegada' && m.tc < CH.title) { tx = m.x + f * 200; ty = -800; tz = 0.3; }
    if (!m.camInit) { m.camInit = true; c.x = tx; c.y = ty; c.z = tz; return; }
    c.x = damp(c.x, tx, 2, dt); c.y = damp(c.y, ty, 2, dt); c.z = damp(c.z, tz, 1.5, dt);
  }

  /* ---- desenho ---- */
  const KOME_O = { scale: 1.6, face: 1, pal: 'kome', hat: false, shadow: false };
  const CREW_O = { scale: 1, face: 1, pal: 'kome', hat: true, shadow: true };
  function draw(g, m) {
    if (!m.init) return;
    const f = m.face, li = level(), x = m.x, y = m.y, t = m.t, u = m.u || 0;
    // fumaça atrás
    drawSmoke(g, m, true);
    // base + torre (crescendo na estreia)
    const bb = baseBake(f, li);
    if (m.built < 1 || m.tower < 1) {
      const dy = (1 - m.built) * -2400;
      // laje
      g.save(); g.beginPath(); g.rect(x - PAD - 30, y + PT - 10 + dy, PAD * 2 + 60, 90); g.clip(); g.drawImage(bb.cv, x + bb.x0, y + bb.y0 + dy, bb.w, bb.h); g.restore();
      if (m.tower > 0) { const th = (-TTOP + 60) * m.tower; g.save(); g.beginPath(); g.rect(x + Math.min(f * (TX0 - 120), f * (TX1 + 40)), y + PT - th, 160 + 120, th); g.clip(); g.drawImage(bb.cv, x + bb.x0, y + bb.y0, bb.w, bb.h); g.restore(); }
    } else g.drawImage(bb.cv, x + bb.x0, y + bb.y0, bb.w, bb.h);
    // portas do silo
    const dw = 230 * (1 - m.doors * 0.85);
    Draw.box(g, x - 230, y + PT - 6, dw, 16, PAL.grayD, { ol: 2, top: PAL.gray, shade: false });
    Draw.box(g, x + 230 - dw, y + PT - 6, dw, 16, PAL.grayD, { ol: 2, top: PAL.gray, shade: false });
    // foguete
    if (m.rk > -9000) {
      const rb = rocketBake(f, li), ry = y + PT + m.rk + m.rkIn * ROCK_H;
      const clipIt = m.rkIn > 0.001;
      if (clipIt) { g.save(); g.beginPath(); g.rect(x - 400, ry - 1700, 800, y + PT - (ry - 1700)); g.clip(); }
      if (m.flame) flame(g, x, ry + 10, t, m.rk < -50 ? 1 : 0.45);
      const shk = m.count ? (Math.random() - 0.5) * 6 : 0;
      g.drawImage(rb.cv, x + rb.x0 + shk, ry + rb.y0, rb.w, rb.h);
      rocketLive(g, m, x + shk, ry);
      if (clipIt) g.restore();
    }
    drawArm(g, m);
    drawCrew(g, m);
    drawCrate(g, m);
    drawSmoke(g, m, false);
    drawTexts(g, m);
  }
  function flame(g, x, y, t, k) {
    const L = (380 + Math.sin(t * 40) * 40 + Math.random() * 60) * (0.5 + k * 0.7);
    g.fillStyle = LINE; g.beginPath(); g.moveTo(x - 150, y - 6); g.quadraticCurveTo(x - 110, y + L * 0.6, x, y + L + 14); g.quadraticCurveTo(x + 110, y + L * 0.6, x + 150, y - 6); g.fill();
    g.fillStyle = PAL.ora; g.beginPath(); g.moveTo(x - 140, y); g.quadraticCurveTo(x - 100, y + L * 0.6, x, y + L); g.quadraticCurveTo(x + 100, y + L * 0.6, x + 140, y); g.fill();
    g.fillStyle = PAL.yelL; g.beginPath(); g.moveTo(x - 90, y); g.quadraticCurveTo(x - 60, y + L * 0.4, x, y + L * 0.7); g.quadraticCurveTo(x + 60, y + L * 0.4, x + 90, y); g.fill();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(x, y + 40, 50, 70, 0, 0, TAU); g.fill();
  }
  function rocketLive(g, m, x, ry) {
    const f = m.face;
    // medidor do tanque
    if (m.fill > 0.01) { const h = 220 * m.fill; g.fillStyle = PAL.rice; g.fillRect(x - 36, ry - 210 - h, 72, h); g.fillStyle = PAL.riceS; g.fillRect(x - 36, ry - 216, 72, 6); }
    // Kome na escotilha
    const px = x + f * PORT[0], py = ry + PORT[1];
    g.save(); g.beginPath(); g.arc(px, py, 66, 0, TAU); g.clip();
    KOME_O.pal = m.pilot; KOME_O.face = f;
    E.drawShiba(g, px, py + 62, m.rk < -10 ? 'surprise' : m.count ? 'gasp' : 'drive', m.t, KOME_O);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(px - 40, py - 66); g.lineTo(px - 10, py - 66); g.lineTo(px - 50, py + 40); g.lineTo(px - 74, py + 20); g.fill();
    g.restore();
    if (m.night > 0.05) Draw.light(g, x + f * 0, ry - 1590, 16, PAL.red, m.night * (0.5 + 0.5 * Math.sin(m.t * 4)), { ol: 0, halo: 5 });
  }
  function drawArm(g, m) {
    const f = m.face, A = m.arm;
    const px = m.x + f * PIV[0], py = m.y + PIV[1];
    if (m.mode === 'chegada' && m.tower < 1) return;
    const mx = lerp(px, A.x, 0.5), my = lerp(py, A.y, 0.5);
    Draw.beam(g, [[px, py], [mx, my]], 70, PAL.yel, { ol: 3, hi: PAL.yelL, shade: PAL.yelD, cap: 'butt' });
    Draw.beam(g, [[mx, my], [A.x, A.y - 60]], 50, PAL.grayL, { ol: 3, hi: PAL.steelL, shade: PAL.gray, cap: 'butt' });
    Draw.circle(g, px, py, 48, PAL.grayD, { ol: 3, hi: false, shade: false });
    Draw.circle(g, mx, my, 34, PAL.yel, { ol: 3, hi: false, shade: PAL.yelD });
    // concha (pendurada, vira pra despejar)
    g.save(); g.translate(A.x, A.y - 60); g.rotate(f * A.pour * 1.9);
    Draw.beam(g, [[0, 0], [0, 40]], 14, PAL.steelD, { ol: 2, hi: false });
    g.beginPath(); g.moveTo(-110, 30); g.lineTo(110, 30); g.lineTo(80, 150); g.quadraticCurveTo(0, 175, -80, 150); g.closePath();
    g.lineWidth = 7; g.strokeStyle = LINE; g.stroke(); g.fillStyle = PAL.ora; g.fill();
    g.fillStyle = PAL.oraD; g.fillRect(-96, 120, 192, 16);
    if (m.bucketLoad > 0.05) { g.fillStyle = PAL.rice; g.beginPath(); g.ellipse(0, 34, 104 * m.bucketLoad, 34 * m.bucketLoad, 0, PI, TAU); g.fill(); }
    g.restore();
    if (A.pour > 0.5) { g.fillStyle = LINE; g.fillRect(A.x + f * 40 - 18, A.y + 30, 36, m.y + PT + HATCH[1] - A.y - 30); g.fillStyle = PAL.rice; g.fillRect(A.x + f * 40 - 14, A.y + 30, 28, m.y + PT + HATCH[1] - A.y - 30); }
  }
  function drawCrew(g, m) {
    const f = m.face, u = m.u || 0, t = m.t;
    const spots = [-640, -760, -900];
    for (let k = 0; k < spots.length; k++) {
      const cx = m.x + f * spots[k];
      let pose = 'stand';
      if (m.mode === 'chegada' && m.tc < CH.rise) pose = k === 1 ? 'push' : 'carry';
      else if (m.count) pose = k === 0 ? 'point' : 'gasp';
      else if (m.phase === 'voo') pose = m.rk > -1500 ? 'surprise' : 'cheer';
      else if (m.phase === 'descida') pose = m.crate.landed > 0 ? 'cheer' : 'point';
      else pose = k === 2 ? 'sit' : 'stand';
      CREW_O.face = k === 0 ? f : -f; CREW_O.pal = k === 1 ? 'shiro' : k === 2 ? 'kuro' : 'kome';
      E.drawShiba(g, cx, m.y, pose, t + k * 0.41, CREW_O);
    }
  }
  function drawCrate(g, m) {
    const c = m.crate; if (!c.on) return;
    const x = c.x, y = c.y, a = c.landed;
    g.save(); g.translate(x, y); g.rotate(c.sway);
    if (a < 1) {
      g.globalAlpha = 1 - a;
      // paraquedas
      const cy = -620 + a * 400;
      g.strokeStyle = LINE; g.lineWidth = 4; g.beginPath();
      for (const s of [-1, -0.4, 0.4, 1]) { g.moveTo(s * 300, cy); g.lineTo(s * 70, -150); }
      g.stroke();
      g.beginPath(); g.moveTo(-320, cy); g.quadraticCurveTo(-320, cy - 300, 0, cy - 300); g.quadraticCurveTo(320, cy - 300, 320, cy);
      for (let i = 3; i >= -3; i--) g.quadraticCurveTo((i + 0.5) * 91, cy - 40, (i - 0) * 91 - 46 + (i === -3 ? -45 : 0), cy);
      g.closePath(); g.lineWidth = 8; g.strokeStyle = LINE; g.stroke(); g.fillStyle = PAL.red; g.fill();
      g.fillStyle = PAL.cream; g.beginPath(); g.moveTo(-110, cy - 6); g.quadraticCurveTo(-90, cy - 260, 0, cy - 296); g.quadraticCurveTo(90, cy - 260, 110, cy - 6); g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
    // caixote de ienes
    Draw.box(g, -90, -170, 180, 170, PAL.wood, { ol: 3, top: PAL.woodL, shade: PAL.woodD, panels: 3 });
    Draw.circle(g, 0, -86, 52, PAL.gold, { ol: 3, hi: PAL.goldL, shade: PAL.goldD });
    Draw.text(g, '¥', 0, -84, { size: 64, col: PAL.ink, sw: 0, weight: 900 });
    g.restore();
  }
  function drawSmoke(g, m, back) {
    const v = m.smoke; if (!v.length) return;
    g.fillStyle = back ? '#E6E0D6' : '#FFFFFF';
    for (let i = back ? 0 : 1; i < v.length; i += 2) {
      const p = v[i], k = p.life / p.max;
      g.globalAlpha = (back ? 0.85 : 0.92) * (1 - k * k);
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }
  function drawTexts(g, m) {
    const f = m.face, u = m.u || 0;
    if (m.count) {
      const tt = m.mode === 'chegada' ? (m.tc - CH.c3) % 1 : (u - T_C3) % 1, pop = tt < 0.15 ? 0.4 + 4 * tt : 1;
      g.save(); g.translate(m.x - f * 700, m.y - 1500); g.scale(pop, pop);
      Draw.text(g, String(m.count), 0, 0, { size: 520, col: PAL.goldL, sw: 40, stroke: LINE, weight: 900, alpha: 1 - Math.max(0, tt - 0.75) * 4 });
      g.restore();
    }
    const tl = m.mode === 'chegada' ? m.tc - CH.launch : u - T_LAUNCH;
    if (tl >= 0 && tl < 1.6) {
      const pop = tl < 0.15 ? 0.4 + 4 * tl : 1;
      g.save(); g.translate(m.x - f * 150, m.y - 1800); g.rotate(-0.06 * f); g.scale(pop, pop);
      Draw.text(g, 'DECOLAR!', 0, 0, { size: 300, col: PAL.goldL, sw: 30, stroke: LINE, weight: 900, alpha: tl > 1.2 ? 1 - (tl - 1.2) / 0.4 : 1 });
      g.restore();
    }
    if (m.title > 0) {
      const k = m.title, pop = k < 0.12 ? 0.3 + 0.8 * smooth(k / 0.12) : 1.1 - 0.1 * smooth((k - 0.12) / 0.2), al = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
      g.save(); g.translate(m.x - f * 300, m.y - 2000); g.scale(pop, pop);
      Draw.text(g, 'FOGUETE DE MOCHI', 0, 0, { size: 230, col: PAL.goldL, sw: 30, stroke: LINE, weight: 900, alpha: al, shadow: 12 });
      Draw.text(g, 'arroz sobe · ienes descem de paraquedas', 0, 190, { size: 90, col: PAL.cream, sw: 16, stroke: LINE, weight: 800, alpha: al });
      g.restore();
    }
  }

  /* ---- âncoras e ajudantes ---- */
  function bite(m) { return m.bitesA[0]; }
  function bites(m) { return m.bitesA; }
  function dump(m) { return m.dumpO; }
  function seat(m) { return m.seatO; }
  function dig(m, heap, area, o) {
    const b = m.bitesA[0];
    if (!b.active || !heap) return 0;
    const r = heap.dig(b.x, area, b.r, o); return r.got || 0;
  }
  function prebake(lv) {
    const keep = forceLv; forceLv = lv === undefined ? 0 : lv;
    const li = level();
    for (const f of [1, -1]) { rocketBake(f, li); baseBake(f, li); }
    forceLv = keep;
  }

  /* ---- horizonte do Pátio: base(s) pequenininhas, o foguete sobe com rastro e o caixote desce de paraquedas ----
     horizon(g, {x0, x1, y, k=.12, t, n, tint, haze, night}); n>=10: 2 bases; n>=25: 3. Ocupa o 1º quinto da faixa. */
  function horizon(g, o) {
    const k = (o.k || 0.12) * 0.9, t = o.t || 0, n = Math.max(1, o.n | 0), tint = o.tint || '#93A3B4', night = o.night || 0;
    const pads = n >= 25 ? 3 : n >= 10 ? 2 : 1;
    const light = U.mixCss(tint, '#FFFFFF', 0.25), dark = U.mixCss(tint, '#3B2818', 0.25);
    for (let i = 0; i < pads; i++) {
      const x = lerp(o.x0, o.x1, 0.06 + i * 0.07), y = o.y - i * 6, kk = k * (1 - i * 0.15);
      const u = (((t + i * 8.3) % T_CYC) + T_CYC) % T_CYC;
      g.fillStyle = dark; g.fillRect(x - PAD * kk, y - 40 * kk, PAD * 2 * kk, 40 * kk);
      g.fillRect(x + TX0 * kk, y + TTOP * kk, (TX1 - TX0) * kk, -TTOP * kk);
      let ry = 0;
      if (u >= T_LAUNCH && u < T_REARM) ry = rkY(u - T_LAUNCH) * kk; else if (u >= T_REARM) ry = (1 - smooth((u - T_REARM) / (T_LAND + 0.5 - T_REARM))) * ROCK_H * kk;
      if (ry > -900) {
        const by = y - 40 * kk + ry;
        g.save(); g.beginPath(); g.rect(x - 60, y - 400, 120, 400 - 40 * kk); g.clip();
        if (u >= T_LAUNCH && u < T_REARM) { g.fillStyle = PAL.ora; g.beginPath(); g.moveTo(x - 10, by); g.lineTo(x, by + 30); g.lineTo(x + 10, by); g.fill(); }
        g.fillStyle = light;
        for (const [cy] of BALLS) { g.beginPath(); g.arc(x, by + cy * kk, BR * kk, 0, TAU); g.fill(); }
        g.beginPath(); g.moveTo(x - 15 * kk * 10, by - 1225 * kk); g.lineTo(x, by - 1470 * kk); g.lineTo(x + 15 * kk * 10, by - 1225 * kk); g.fill();
        g.restore();
      }
      if (u >= T_LAUNCH && u < T_DROP + 2) {   // rastro
        const a = clamp(1 - (u - T_LAUNCH) / 5, 0, 1);
        g.globalAlpha = 0.6 * a; g.fillStyle = '#FFFFFF'; g.fillRect(x - 3, y - 260, 6, 220); g.beginPath(); g.arc(x, y - 30 * kk, 60 * kk * (1 + (u - T_LAUNCH)), 0, TAU); g.fill(); g.globalAlpha = 1;
      }
      if (u >= T_DROP && u < T_LAND + 1) {     // paraquedas
        const q = clamp((u - T_DROP) / (T_LAND - T_DROP), 0, 1), cx = x - 820 * kk, cy = y - (1 - q) * 300;
        g.fillStyle = PAL.red; g.beginPath(); g.arc(cx, cy - 70 * kk * 3, 9, PI, TAU); g.fill();
        g.fillStyle = PAL.gold; g.fillRect(cx - 3, cy - 6, 6, 6);
      }
      if (night > 0.2) { g.fillStyle = '#FF6A5A'; g.globalAlpha = night * (0.5 + 0.5 * Math.sin(t * 4 + i)); g.fillRect(x + TX0 * kk, y + TTOP * kk - 3, 3, 3); g.globalAlpha = 1; }
    }
  }

  G.Tools.foguete = {
    id: 'foguete', name: 'Foguete de Mochi', kind: 'rocket', w: PAD * 2, h: ROCK_H,
    meta: { zoom: 0.24, shake: 0.7, cycle: T_CYC, height: ROCK_H, chegadaT: CH.end, reach: REACH,
      times: { load: T_L0, scoop: SCOOP, full: T_FULL, count: T_C3, launch: T_LAUNCH, drop: T_DROP, land: T_LAND, cycle: T_CYC } },
    create, update, draw, bite, bites, dump, seat, dig, horizon, prebake,
  };
})();
