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
  const A_UP = 950, CRATE_Y0 = -4200, CRATE_DX = 980, BOOTH_DX = 1340, CREW_DX = [650, 770];
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

  /* ---- som (E.Sfx / E.Loops, se audio.js estiver carregado). Toca sozinho a partir dos eventos da instância.
     Respeita mudo: E.Audio.muted e KomeGame.S.opts.mute. create({sound:false}) cala a instância (frota, prints).
     Só toca se a base estiver na vista (inp.view), pra 30 foguetes fora da tela não virarem barulho. ---- */
  const SND = ['fog-bip', 'fog-ronco', 'fog-torcida', 'fog-pop', 'fog-caixa', 'fog-grao'];
  (function defineSounds() {
    const SF = E.Sfx, LP = E.Loops;
    if (!SF || !SF.define) return;
    // bip da contagem: quadrado + seno, o "1" é mais agudo e longo; carimbo grave junto (o número bate na tela)
    SF.define('fog-bip', a => {
      const one = a.opts.n === 1, f = one ? 1320 : 880, d = one ? 0.34 : 0.16;
      a.tone(f, d, 'square', 0.09); a.tone(f, d * 1.2, 'sine', 0.16);
      a.tone(150, 0.09, 'sine', 0.32, 0.45); a.noise(0.03, 800, 0.16, 1);
    });
    // ignição: estalo + ronco grave que rola e vai abrindo
    SF.define('fog-ronco', { gate: 1, max: 1, peak: 0.62, rev: 0.3, duck: 0.4, prio: 1, render: D => {
      const b = D.buf(3.4);
      D.noise(b, { a: 0.002, d: 0.12, vol: 0.8, lp: 3000, lp1: 400 });
      D.noise(b, { color: 'brown', at: 0.02, a: 0.08, s: 1.2, d: 2, vol: 1, lp: 260, am: 11, amDepth: 0.3 });
      D.noise(b, { color: 'pink', at: 0.05, a: 0.3, s: 0.9, d: 1.8, vol: 0.45, bp: 700, bp1: 300, q: 0.7 });
      D.osc(b, { f: 62, f1: 38, a: 0.02, s: 1, d: 1.6, vol: 0.55 });
      D.sat(b, 1.6); return b; } });
    // torcida: plateia (ruído com formantes) + latidos dos shibas + apito
    SF.define('fog-torcida0', { max: 2, peak: 0.42, rev: 0.4, render: D => {
      const b = D.buf(2.6);
      D.noise(b, { color: 'pink', a: 0.18, s: 0.8, d: 1.4, vol: 0.6, bp: 1100, q: 0.8, am: 7, amDepth: 0.45 });
      D.noise(b, { color: 'pink', at: 0.1, a: 0.2, s: 0.6, d: 1.3, vol: 0.32, bp: 2500, q: 1.2, am: 9.5, amDepth: 0.5 });
      for (let i = 0; i < 7; i++) { const f = D.rr(380, 620); D.osc(b, { wave: 'saw', at: D.rr(0, 0.9), f, f1: f * D.rr(1.2, 1.5), a: 0.05, s: 0.15, d: 0.4, vol: 0.06, vib: 0.03, vibHz: 6, lp: 1600 }); }
      return b; } });
    SF.define('fog-torcida', a => { a.play('fog-torcida0', { vol: a.opts.vol }); a.play('bark', { delay: 0.12, vol: 0.45 }); a.play('yip', { delay: 0.4, vol: 0.4, pitch: 1.1 }); a.play('whistle', { delay: 0.25, vol: 0.35 }); });
    // paraquedas abrindo: "pof" de pano + vento
    SF.define('fog-pop', a => { a.play('pop', { pitch: 0.7 }); a.noise(0.14, 520, 0.28, 0.7); a.play('whoosh', { pitch: 1.3, vol: 0.5, delay: 0.04 }); });
    // caixote pousa: baque de madeira + caixa registradora + moedas
    SF.define('fog-caixa', a => { a.play('stomp', { pitch: 1.4, vol: 0.55 }); a.play('kaching', { delay: 0.1 }); a.play('coins', { delay: 0.18, vol: 0.8 }); });
    // concha despeja no tanque: chiado de grão, baixinho
    SF.define('fog-grao', { gate: 0.5, max: 2, peak: 0.25, render: D => { const b = D.buf(0.5); D.noise(b, { a: 0.02, s: 0.2, d: 0.25, vol: 0.6, bp: 3200, q: 0.8, am: 30, amDepth: 0.6 }); return b; } });
    // motor no ar (loop): ronco grave + chiado; rate 1 = colado no chão, 0 = longe lá em cima
    if (LP && LP.define && LP.bed) LP.define('fog-chama', { vol: 0.9, rate: [0.85, 1.1], lp: [500, 3200], gain: [0.15, 1], render: D => {
      const n = Math.floor(2 * D.sr), a = LP.bed(D, n, { color: 'brown', vol: 1, lp: 240 }), b = LP.bed(D, n, { color: 'pink', vol: 0.4, bp: 800, q: 0.6 });
      for (let i = 0; i < n; i++) a[i] += b[i];
      LP.tones(D, a, [['sin', 46, 0.25]]); D.sat(a, 1.5); return a; } });
  })();
  function muted() {
    const S = G.S;
    return !!((E.Audio && E.Audio.muted) || (S && S.opts && (S.opts.mute || S.fast)));
  }
  function inView(m) { const v = m.view; return !v || (m.x + 1700 > v.x0 && m.x - 1700 < v.x1); }
  function sfx(m, name, o) {
    if (!m.sound || muted() || !E.Sfx || !E.Sfx.has || !E.Sfx.has(name) || !inView(m)) return;
    try { E.Sfx.play(name, o); } catch (e) { /* sem áudio */ }
  }
  function roarStop(m) { if (m.roarH) { try { m.roarH.stop(1.2); } catch (e) { /* */ } m.roarH = null; } }
  function soundTick(m, u) {
    const ev = m.ev;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e === 'count') sfx(m, 'fog-bip', { n: m.count });
      else if (e === 'launch') {
        sfx(m, 'fog-ronco');
        if (m.sound && !muted() && inView(m) && !m.roarH && E.Loops && E.Loops.start) { try { m.roarH = E.Loops.start('fog-chama', { vol: 0.8, rate: 1 }); } catch (err) { m.roarH = null; } }
      }
      else if (e === 'chute') sfx(m, 'fog-pop');
      else if (e === 'land') { sfx(m, 'fog-caixa'); sfx(m, 'fog-torcida', { vol: 0.6 }); }
      else if (e === 'load') sfx(m, 'fog-grao', { vol: 0.7 });
      else if (e === 'build') sfx(m, 'stomp', { pitch: 0.7 });
    }
    const a = T_LAUNCH + 1.1;
    if (m.uPrev < a && u >= a && u < a + 1) sfx(m, 'fog-torcida');
    m.uPrev = u;
    if (m.roarH) {
      if (!m.sound || muted() || u < T_LAUNCH - 0.01 || u >= T_REARM || m.rk < -5200) roarStop(m);
      else try { m.roarH.set({ rate: clamp(1 + m.rk / 4500, 0, 1) }, 0.3); } catch (err) { /* */ }
    }
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
      crate: { x: 0, y: 0, on: false, sway: 0, landed: 0, open: 0 }, smoke: [], flash: 0, shakeK: 0, flame: 0,
      cam: { x: 0, y: -900, z: 0.24 }, camInit: false, sound: opts.sound !== false, roarH: null, uPrev: 0, ev: [], parts: null, night: 0, view: null, floorF: null,
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
      if (cr(T_DROP)) emit(m, 'chute');
      if (cr(T_REARM)) emit(m, 'rise');
      if (cr(T_LAND)) land(m);
      m.fill = u < T_L0 ? 0 : u < T_FULL ? Math.min(1, Math.floor((u - T_L0) / SCOOP) * 0.25 + 0.25 * smooth(((u - T_L0) % SCOOP - SCOOP * 0.85) / (SCOOP * 0.15))) : u < T_LAUNCH ? 1 : 0;
      m.count = u >= T_C3 && u < T_LAUNCH ? 3 - Math.floor(u - T_C3) : 0;
      m.rk = u >= T_LAUNCH && u < T_REARM ? rkY(u - T_LAUNCH) : 0;
      m.rkIn = u >= T_REARM ? 1 - smooth((u - T_REARM) / (T_LAND + 0.5 - T_REARM)) : 0;   // no voo o foguete que subiu é o desenhado (rk); o próximo só aparece no 'rise'
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
    if (flying && m.rk > -1800) {
      m.sAcc = (m.sAcc || 0) + dt * (m.rk > -1100 ? 30 : 14);
      while (m.sAcc >= 1) {
        m.sAcc--;
        if (m.rk > -1100) { const s = Math.random() < 0.5 ? -1 : 1; smokeAdd(m, m.x + s * (100 + Math.random() * 200), m.y + PT, s * (700 + Math.random() * 1300), -Math.random() * 80, 110 + Math.random() * 110); }   // vapor rolando pros lados
        else smokeAdd(m, m.x + (Math.random() - 0.5) * 160, m.y + PT + m.rk + 60, (Math.random() - 0.5) * 500, 200 + Math.random() * 300, 100 + Math.random() * 80);
      }
    }
    if (m.count && Math.random() < dt * 10) smokeAdd(m, m.x + (Math.random() - 0.5) * 500, m.y + PT, (Math.random() - 0.5) * 300, -40, 70);
    smokeTick(m, dt);
    if (m.title > 0) { m.title = Math.min(1, m.title + dt / 3.2); if (m.title >= 1) m.title = 0; }
    camTick(m, dt);
    soundTick(m, u);
  }
  function biteEv(m, k) {
    emit(m, 'bite');
    const b = m.bitesA[0];
    if (m.parts && b.active) m.parts.puff(b.x, b.y, 4, 30, { c: PAL.riceS, speed: 120, up: 60 });
  }
  function launch(m) {
    emit(m, 'launch'); m.payload = m.fill || 1; m.flash = 1; m.shakeK = 1;
    for (let i = 0; i < 44; i++) { const s = i & 1 ? 1 : -1; smokeAdd(m, m.x + s * (120 + rnd(i) * 280), m.y + PT, s * (800 + rnd(i * 3) * 1900), -(rnd(i * 7) * 160), 130 + rnd(i * 5) * 170); }
  }
  function land(m) {
    emit(m, 'land');
    const c = m.crate;
    if (m.parts) { m.parts.coins(c.x, c.y - 120, 24, { speed: [200, 520] }); m.parts.puff(c.x, c.y, 6, 40, { c: PAL.sand, speed: 160, up: 30 }); }
  }
  function puffRing(m, dx, dy, n, r) { for (let i = 0; i < n; i++) { const s = i & 1 ? 1 : -1; smokeAdd(m, m.x + s * rnd(i) * PAD, m.y + dy, s * (200 + rnd(i * 2) * 500), -60 - rnd(i) * 100, r * (0.6 + rnd(i * 9) * 0.6)); } }
  function smokeAdd(m, x, y, vx, vy, r) { if (m.smoke.length > 150) m.smoke.shift(); m.smoke.push({ x, y, vx, vy, r, r0: r, life: 0, max: 2.6 + Math.random() * 1.6 }); }
  function smokeTick(m, dt) {
    for (let i = m.smoke.length - 1; i >= 0; i--) {
      const p = m.smoke[i]; p.life += dt; if (p.life > p.max) { m.smoke.splice(i, 1); continue; }
      p.vx *= 1 - 1.3 * dt; p.vy = p.vy * (1 - 1.3 * dt) - 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r = p.r0 * (1 + p.life * 0.45);
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
    const c = m.crate, f = m.face, lx = m.x - f * CRATE_DX;
    if (m.mode === 'normal' && u >= T_DROP && u < T_CYC) {
      c.on = true; c.x = lx + Math.sin(m.t * 1.3) * 60 * (u < T_LAND ? 1 : 0);
      const q = clamp((u - T_DROP) / (T_LAND - T_DROP), 0, 1);
      c.y = m.y + lerp(CRATE_Y0, 0, 1 - (1 - q) * (1 - q * 0.3)) ;
      if (u >= T_LAND) c.y = m.y;
      c.sway = u < T_LAND ? Math.sin(m.t * 1.3 + 0.6) * 0.12 : 0;
      c.landed = u >= T_LAND ? clamp((u - T_LAND) / 0.6, 0, 1) : 0;
      c.open = clamp((u - T_DROP) / 0.6, 0, 1);
    } else c.on = false;
  }
  function camTick(m, dt) {
    const f = m.face, c = m.cam;
    let tx = m.x + f * 330, ty = -980, tz = 0.24;
    if (m.mode === 'chegada' && m.tc < CH.title) { tx = m.x + f * 200; ty = -800; tz = 0.3; }
    if (!m.camInit) { m.camInit = true; c.x = tx; c.y = ty; c.z = tz; return; }
    c.x = damp(c.x, tx, 2, dt); c.y = damp(c.y, ty, 2, dt); c.z = damp(c.z, tz, 1.5, dt);
  }

  /* ---- desenho ---- */
  const KOME_O = { scale: 1.6, face: 1, pal: 'kome', hat: false, shadow: false };
  const CREW_O = { scale: 2.8, face: 1, pal: 'kome', hat: true, shadow: true };
  const DESK_O = { scale: 2.2, face: 1, pal: 'kome', hat: false, shadow: false };
  const ancT = { x: 0, y: 0 }, ancO = { hat: false };
  // tremor da laje: cresce na contagem, pancada na ignição e vai morrendo
  function padShake(m) {
    const u = m.u || 0, tl = m.mode === 'chegada' ? m.tc - CH.launch : u - T_LAUNCH;
    let k = m.count ? 3 + (3 - m.count) * 3 : 0;
    if (tl >= 0 && tl < 2.6) k = Math.max(k, 24 * (1 - tl / 2.6));
    return k;
  }
  function draw(g, m) {
    if (!m.init) return;
    const f = m.face, li = level(), x = m.x, y = m.y, t = m.t;
    const ps = padShake(m), sx = Math.sin(t * 67) * ps, sy = Math.cos(t * 53) * ps * 0.5;
    drawBooth(g, m, li);
    // fumaça atrás
    drawSmoke(g, m, true);
    // base + torre (crescendo na estreia), tremendo junto com o foguete
    g.save(); g.translate(sx, sy);
    const bb = baseBake(f, li);
    if (m.built < 1 || m.tower < 1) {
      const dy = (1 - m.built) * -2400;
      g.save(); g.beginPath(); g.rect(x - PAD - 30, y + PT - 10 + dy, PAD * 2 + 60, 90); g.clip(); g.drawImage(bb.cv, x + bb.x0, y + bb.y0 + dy, bb.w, bb.h); g.restore();
      if (m.tower > 0) { const th = (-TTOP + 60) * m.tower; g.save(); g.beginPath(); g.rect(x + Math.min(f * (TX0 - 120), f * (TX1 + 40)), y + PT - th, 160 + 120, th); g.clip(); g.drawImage(bb.cv, x + bb.x0, y + bb.y0, bb.w, bb.h); g.restore(); }
    } else g.drawImage(bb.cv, x + bb.x0, y + bb.y0, bb.w, bb.h);
    // portas do silo
    const dw = 230 * (1 - m.doors * 0.85);
    Draw.box(g, x - 230, y + PT - 6, dw, 16, PAL.grayD, { ol: 2, top: PAL.gray, shade: false });
    Draw.box(g, x + 230 - dw, y + PT - 6, dw, 16, PAL.grayD, { ol: 2, top: PAL.gray, shade: false });
    g.restore();
    // foguete
    if (m.rk > -9000) {
      const rb = rocketBake(f, li), ry = y + PT + m.rk + m.rkIn * ROCK_H;
      const clipIt = m.rkIn > 0.001;
      if (clipIt) { g.save(); g.beginPath(); g.rect(x - 400, ry - 1700, 800, y + PT - (ry - 1700)); g.clip(); }
      if (m.flame) flame(g, x, ry + 10, t, m.rk < -50 ? 1 : 0.45, y + PT);
      const near = m.rk > -400 ? 1 : 0;
      const shk = (m.count ? (Math.random() - 0.5) * 6 : 0) + sx * near, shy = sy * near;
      g.drawImage(rb.cv, x + rb.x0 + shk, ry + rb.y0 + shy, rb.w, rb.h);
      rocketLive(g, m, x + shk, ry + shy);
      if (clipIt) g.restore();
    }
    drawArm(g, m);
    drawCrew(g, m);
    drawCrate(g, m);
    drawSmoke(g, m, false);
    drawTexts(g, m);
  }
  // chama: gota em 3 tons com diamantes de choque; colada no chão vira coluna de fogo que espirra na laje
  function flame(g, x, y, t, k, gy) {
    const L = (420 + Math.sin(t * 40) * 40 + Math.random() * 70) * (0.5 + k * 0.7), W = 150 + 10 * Math.sin(t * 31);
    const gap = gy - y;
    if (k >= 1 && gap < 1500 && gap > 0) {   // coluna até a laje
      const a = 1 - gap / 1500, w = (110 + 60 * a) * (0.9 + 0.1 * Math.sin(t * 50));
      g.fillStyle = LINE; g.fillRect(x - w - 7, y, (w + 7) * 2, gap);
      g.fillStyle = PAL.ora; g.fillRect(x - w, y, w * 2, gap);
      g.fillStyle = PAL.yelL; g.fillRect(x - w * 0.6, y, w * 1.2, gap);
      g.fillStyle = '#FFFFFF'; g.fillRect(x - w * 0.22, y, w * 0.44, gap);
      // espirro na laje
      const sw = 260 + 340 * a + Math.random() * 40, sh = 70 + 50 * a;
      g.fillStyle = LINE; g.beginPath(); g.ellipse(x, gy, sw + 8, sh + 8, 0, PI, TAU); g.fill();
      g.fillStyle = PAL.ora; g.beginPath(); g.ellipse(x, gy, sw, sh, 0, PI, TAU); g.fill();
      g.fillStyle = PAL.yelL; g.beginPath(); g.ellipse(x, gy, sw * 0.62, sh * 0.7, 0, PI, TAU); g.fill();
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(x, gy, sw * 0.28, sh * 0.4, 0, PI, TAU); g.fill();
    }
    g.fillStyle = LINE; g.beginPath(); g.moveTo(x - W - 10, y - 6); g.quadraticCurveTo(x - W * 0.8, y + L * 0.6, x, y + L + 14); g.quadraticCurveTo(x + W * 0.8, y + L * 0.6, x + W + 10, y - 6); g.fill();
    g.fillStyle = PAL.ora; g.beginPath(); g.moveTo(x - W, y); g.quadraticCurveTo(x - W * 0.75, y + L * 0.6, x, y + L); g.quadraticCurveTo(x + W * 0.75, y + L * 0.6, x + W, y); g.fill();
    g.fillStyle = PAL.yelL; g.beginPath(); g.moveTo(x - W * 0.62, y); g.quadraticCurveTo(x - W * 0.45, y + L * 0.45, x, y + L * 0.74); g.quadraticCurveTo(x + W * 0.45, y + L * 0.45, x + W * 0.62, y); g.fill();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(x, y + 40, 52, 72, 0, 0, TAU); g.fill();
    for (let i = 0; i < 3; i++) {   // diamantes de choque
      const dy = y + 150 + i * L * 0.17, dw = 34 - i * 7;
      g.beginPath(); g.moveTo(x, dy - dw * 1.4); g.lineTo(x + dw, dy); g.lineTo(x, dy + dw * 1.4); g.lineTo(x - dw, dy); g.fill();
    }
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
  // fone de ouvido com microfone na cabeça de um shiba desenhado em (x, y) com escala sc virado pra fc
  function headset(g, pose, t, x, y, sc, fc) {
    const p = E.shibaAnchor ? E.shibaAnchor(pose, t, 'head', ancT, ancO) : { x: 4, y: -30 };
    const hx = x + fc * p.x * sc, hy = y + p.y * sc;
    g.lineCap = 'round';
    g.strokeStyle = LINE; g.lineWidth = 3.4 * sc; g.beginPath(); g.arc(hx - fc * 1.5 * sc, hy - 1 * sc, 9 * sc, PI * 1.05, PI * 1.95); g.stroke();
    g.strokeStyle = PAL.grayD; g.lineWidth = 1.6 * sc; g.beginPath(); g.arc(hx - fc * 1.5 * sc, hy - 1 * sc, 9 * sc, PI * 1.1, PI * 1.9); g.stroke();
    const ex = hx - fc * 4 * sc, ey = hy + 1 * sc;
    g.strokeStyle = LINE; g.lineWidth = 2.6 * sc; g.beginPath(); g.moveTo(ex, ey); g.quadraticCurveTo(ex + fc * 4 * sc, ey + 7 * sc, hx + fc * 8 * sc, hy + 5 * sc); g.stroke();
    Draw.circle(g, ex, ey, 3.6 * sc, PAL.grayD, { ol: 2, hi: PAL.gray, shade: false });
    Draw.circle(g, hx + fc * 8 * sc, hy + 5 * sc, 1.8 * sc, PAL.red, { ol: 1.6, hi: false, shade: false });
  }
  function crewPose(m, k) {
    if (m.mode === 'chegada' && m.tc < CH.rise) return k === 1 ? 'push' : 'carry';
    if (m.count) return k === 0 ? 'point' : 'gasp';
    if (m.phase === 'voo') return m.rk > -1500 ? 'surprise' : 'cheer';
    if (m.phase === 'descida') return m.crate.landed > 0 ? 'cheer' : 'point';
    return k === 1 ? 'sit' : 'stand';
  }
  // equipe de solo: dois shibas de capacete perto da laje, um com bandeirinha de sinal
  function drawCrew(g, m) {
    const f = m.face, t = m.t;
    for (let k = 0; k < CREW_DX.length; k++) {
      const cx = m.x - f * CREW_DX[k], pose = crewPose(m, k);
      CREW_O.face = k === 0 ? f : -f; CREW_O.pal = k === 1 ? 'shiro' : 'kuro';
      E.drawShiba(g, cx, m.y, pose, t + k * 0.41, CREW_O);
    }
    // cone de sinalização
    const qx = m.x - f * 590;
    Draw.poly(g, [[qx - 26, m.y], [qx - 8, m.y - 70], [qx + 8, m.y - 70], [qx + 26, m.y]], PAL.ora, { ol: 2.6, shade: PAL.oraD });
    g.fillStyle = PAL.cream; g.fillRect(qx - 16, m.y - 40, 32, 10);
  }
  // cabine de controle: bunker com janelão, dois shibas de fone olhando o foguete, painel piscando, antena parabólica
  function boothBake(f, li) {
    return bake('booth|' + f, li, -260, -560, 520, 580, c => {
      c.save(); c.scale(f, 1);
      // antena parabólica e mastro
      Draw.beam(c, [[-120, -330], [-120, -420]], 18, PAL.grayL, { ol: 2.4, hi: PAL.steelL, shade: PAL.gray });
      c.save(); c.translate(-118, -440); c.rotate(-0.55);
      c.beginPath(); c.ellipse(0, 0, 80, 34, 0, 0, PI); c.closePath(); c.lineWidth = 6; c.strokeStyle = LINE; c.stroke(); c.fillStyle = PAL.grayL; c.fill();
      c.fillStyle = PAL.steelL; c.beginPath(); c.ellipse(-14, 8, 46, 14, 0, 0, PI); c.fill();
      c.strokeStyle = LINE; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, 60); c.stroke();
      Draw.circle(c, 0, 62, 9, PAL.grayD, { ol: 2, hi: false, shade: false });
      c.restore();
      Draw.beam(c, [[150, -330], [150, -500]], 10, PAL.grayD, { ol: 2, hi: PAL.gray, shade: false });
      // corpo
      Draw.box(c, -190, -300, 380, 300, PAL.stoneL, { ol: 3.2, top: '#E4DECF', shade: PAL.stone });
      Draw.box(c, -215, -332, 430, 42, PAL.grayL, { ol: 3, top: PAL.steelL, shade: PAL.gray });
      Draw.box(c, 40, -372, 80, 40, PAL.gray, { ol: 2.4, top: PAL.grayL, shade: PAL.grayD });   // ar-condicionado
      c.fillStyle = PAL.grayD; for (let i = 0; i < 3; i++) c.fillRect(52 + i * 22, -362, 10, 22);
      // faixa de perigo no pé
      c.fillStyle = PAL.yel; c.fillRect(-190, -34, 380, 18);
      c.fillStyle = PAL.blk; for (let x = -190; x < 180; x += 44) { c.beginPath(); c.moveTo(x, -16); c.lineTo(x + 16, -34); c.lineTo(x + 32, -34); c.lineTo(x + 16, -16); c.fill(); }
      // janelão (moldura + vidro; os shibas entram ao vivo)
      Draw.box(c, -168, -278, 336, 140, PAL.grayD, { ol: 3, r: 8, top: false, shade: false });
      c.fillStyle = '#2F3E4C'; c.fillRect(-152, -264, 304, 112);
      c.fillStyle = '#3E5163'; c.fillRect(-152, -264, 304, 30);
      // porta e plaquinha
      Draw.box(c, 92, -128, 76, 112, PAL.wood, { ol: 3, top: false, shade: PAL.woodD });
      Draw.circle(c, 104, -72, 6, PAL.gold, { ol: 2, hi: false, shade: false });
      Draw.box(c, -168, -122, 230, 50, PAL.cream, { ol: 2.6, r: 6, top: false, shade: PAL.sand });
      c.restore();
      Draw.text(c, 'CONTROLE', -f * 53, -97, { size: 34, col: PAL.red, sw: 0, weight: 900 });
    });
  }
  function drawBooth(g, m, li) {
    const f = m.face, bx = m.x - f * BOOTH_DX, y = m.y, t = m.t, bb = boothBake(f, li);
    // cabo até a laje
    g.strokeStyle = LINE; g.lineWidth = 10; g.beginPath(); g.moveTo(bx + f * 190, y - 8); g.quadraticCurveTo(lerp(bx, m.x, 0.5), y + 4, m.x - f * PAD, y - 8); g.stroke();
    g.strokeStyle = PAL.grayD; g.lineWidth = 5; g.stroke();
    g.drawImage(bb.cv, bx + bb.x0, y + bb.y0, bb.w, bb.h);
    // shibas de fone na janela (só do peito pra cima)
    g.save(); g.beginPath(); g.rect(Math.min(bx - 152, bx + 152 * f * -1), y - 264, 304, 112); g.clip();
    for (let k = 0; k < 2; k++) {
      const wx = bx + f * (k ? 70 : -70), wy = y - 118 + (k ? 4 : 0);
      let pose = k ? 'stand' : 'drive';
      if (m.count) pose = k ? 'gasp' : 'point';
      else if (m.phase === 'voo') pose = 'cheer';
      else if (m.phase === 'descida' && m.crate.landed > 0) pose = 'cheer';
      DESK_O.face = f; DESK_O.pal = k ? 'shiro' : 'kome';
      const tt = t + k * 0.7;
      E.drawShiba(g, wx, wy, pose, tt, DESK_O);
      headset(g, pose, tt, wx, wy, DESK_O.scale, f);
    }
    // reflexo no vidro
    g.fillStyle = 'rgba(255,255,255,.16)';
    g.beginPath(); g.moveTo(bx - 120, y - 264); g.lineTo(bx - 70, y - 264); g.lineTo(bx - 140, y - 152); g.lineTo(bx - 190, y - 152); g.fill();
    g.beginPath(); g.moveTo(bx + 30, y - 264); g.lineTo(bx + 50, y - 264); g.lineTo(bx - 20, y - 152); g.lineTo(bx - 40, y - 152); g.fill();
    g.restore();
    // painel na frente da janela, luzinhas piscando (mais rápido na contagem)
    Draw.box(g, bx - 176, y - 158, 352, 36, PAL.steel, { ol: 3, top: PAL.steelL, shade: PAL.steelD });
    const sp = m.count || m.phase === 'voo' ? 9 : 3, LC = [PAL.red, PAL.grass, PAL.yel, '#6CC4F0'];
    for (let i = 0; i < 9; i++) {
      const on = rnd(i * 13 + Math.floor(t * sp + rnd(i) * 3)) > 0.4;
      g.fillStyle = on ? LC[i & 3] : PAL.grayD; g.fillRect(bx - 150 + i * 34, y - 146, 18, 12);
    }
    // luz do mastro
    const mx = bx + f * 150, on = Math.sin(t * 4) > 0;
    Draw.circle(g, mx, y - 506, 14, on ? PAL.red : PAL.redD, { ol: 2.4, hi: false, shade: false });
    if (on && Draw.light) Draw.light(g, mx, y - 506, 12, PAL.red, 0.5 + 0.5 * (m.night || 0), { ol: 0, halo: 4 });
  }
  // caixote de ienes: paraquedas listrado que abre com um tranco, ¥ enorme pintado, sombra no chão crescendo
  function drawCrate(g, m) {
    const c = m.crate; if (!c.on) return;
    const x = c.x, y = c.y, a = c.landed, e = c.open || 1;
    // sombra
    const hgt = clamp((m.y - y) / 3000, 0, 1);
    g.fillStyle = 'rgba(59,40,24,' + (0.28 * (1 - hgt * 0.7)).toFixed(3) + ')';
    g.beginPath(); g.ellipse(x, m.y + 4, 170 * (1 - hgt * 0.5), 24, 0, 0, TAU); g.fill();
    g.save(); g.translate(x, y); g.rotate(c.sway);
    if (a < 1) {
      g.globalAlpha = 1 - a;
      const R = 380, H = 300, N = 8, cy = -700 + a * 420;
      const sxk = e < 1 ? 0.15 + 0.85 * (1 - Math.pow(1 - e, 3)) + 0.14 * Math.sin(e * PI) : 1, syk = Math.min(1, 0.35 + e * 1.3) * (1 - a * 0.6);
      // cordas
      g.strokeStyle = LINE; g.lineWidth = 5; g.beginPath();
      for (const s of [-1, -0.5, 0.5, 1]) { g.moveTo(s * R * sxk, cy); g.lineTo(s * 105, -248); }
      g.stroke();
      g.save(); g.translate(0, cy); g.scale(sxk, syk);
      const dome = () => {
        g.beginPath(); g.moveTo(-R, 0); g.bezierCurveTo(-R, -H * 1.3, R, -H * 1.3, R, 0);
        const gw = 2 * R / N;
        for (let i = N - 1; i >= 0; i--) { const x1 = -R + i * gw; g.quadraticCurveTo(x1 + gw / 2, -34, x1, 0); }
        g.closePath();
      };
      dome(); g.fillStyle = PAL.red; g.fill();
      g.save(); dome(); g.clip();
      // gomos creme alternados, convergindo pro topo
      g.fillStyle = PAL.cream;
      for (let i = 1; i < N; i += 2) { const x0 = -R + i * (2 * R / N), x1 = x0 + 2 * R / N; g.beginPath(); g.moveTo(x0 * 0.12, -H * 1.1); g.lineTo(x1 * 0.12, -H * 1.1); g.lineTo(x1 * 1.05, 10); g.lineTo(x0 * 1.05, 10); g.closePath(); g.fill(); }
      g.fillStyle = 'rgba(59,40,24,.2)'; g.fillRect(-R, -60, R * 2, 80);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-R * 0.4, -H * 0.72, R * 0.32, H * 0.12, -0.35, 0, TAU); g.fill();
      g.restore();
      dome(); g.lineWidth = 9 / Math.max(0.3, Math.min(sxk, syk)); g.strokeStyle = LINE; g.stroke();
      g.restore();
      g.globalAlpha = 1;
    }
    // caixote: tábuas, cantoneiras de metal, ¥ gigante pintado
    Draw.box(g, -130, -240, 260, 240, PAL.wood, { ol: 3.4, top: PAL.woodL, shade: PAL.woodD, panels: 3 });
    g.fillStyle = PAL.woodD; g.fillRect(-126, -164, 252, 8); g.fillRect(-126, -84, 252, 8);
    for (const sx of [-1, 1]) for (const sy of [-240, -36]) Draw.box(g, sx < 0 ? -134 : 98, sy, 36, 36, PAL.steel, { ol: 2.4, top: PAL.steelL, shade: PAL.steelD });
    Draw.text(g, '¥', 0, -116, { size: 210, col: PAL.goldL, stroke: LINE, sw: 22, weight: 900, shadow: 8 });
    g.restore();
  }
  // nuvens de fumaça/vapor com contorno: contorno embaixo de tudo, sombra, luz em cima (3 tons)
  const SMK = { back: [LINE, '#CFC6B8', '#E8E1D6'], front: [LINE, '#DCD5CA', '#FFFFFF'] };
  function drawSmoke(g, m, back) {
    const v = m.smoke; if (!v.length) return;
    const C = back ? SMK.back : SMK.front, i0 = back ? 0 : 1;
    for (let pass = 0; pass < 3; pass++) {
      g.fillStyle = C[pass];
      for (let i = i0; i < v.length; i += 2) {
        const p = v[i], k = p.life / p.max, al = k > 0.5 ? Math.pow((1 - k) / 0.5, 1.6) : 1;
        if (pass === 0 && al < 0.55) continue;   // contorno some antes, sem riscar a nuvem que se desfaz
        g.globalAlpha = 0.95 * al;
        g.beginPath();
        if (pass === 0) g.arc(p.x, p.y, p.r + 8, 0, TAU);
        else if (pass === 1) g.arc(p.x, p.y, p.r, 0, TAU);
        else g.arc(p.x - p.r * 0.14, p.y - p.r * 0.2, p.r * 0.74, 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }
  // contagem: carimbo redondo (3 verde, 2 laranja, 1 vermelho) que bate na tela com tranco e risquinhos de impacto
  const STAMP = { 3: [PAL.grass, PAL.grassD || PAL.grass], 2: [PAL.ora, PAL.oraD], 1: [PAL.red, PAL.redD] };
  function drawTexts(g, m) {
    const f = m.face, u = m.u || 0;
    if (m.count) {
      const tt = m.mode === 'chegada' ? (m.tc - CH.c3) % 1 : (u - T_C3) % 1;
      const sc = tt < 0.1 ? lerp(2.3, 0.9, smooth(tt / 0.1)) : tt < 0.2 ? lerp(0.9, 1.04, (tt - 0.1) / 0.1) : tt < 0.3 ? lerp(1.04, 1, (tt - 0.2) / 0.1) : 1;
      const al = tt > 0.82 ? 1 - (tt - 0.82) / 0.18 : 1, col = STAMP[m.count] || STAMP[1];
      g.save(); g.translate(m.x - f * 900, m.y - 1220); g.rotate((m.count === 2 ? 0.08 : -0.1) * f); g.scale(sc, sc);
      g.globalAlpha = al;
      if (tt > 0.08 && tt < 0.4) {   // risquinhos de impacto
        const q = (tt - 0.08) / 0.32; g.strokeStyle = LINE; g.lineWidth = 16;
        for (let i = 0; i < 10; i++) { const an = i / 10 * TAU + 0.2, r0 = 330 + q * 90, r1 = r0 + 70 * (1 - q); g.beginPath(); g.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); g.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); g.stroke(); }
      }
      g.fillStyle = 'rgba(59,40,24,.35)'; g.beginPath(); g.arc(22, 30, 300, 0, TAU); g.fill();
      Draw.circle(g, 0, 0, 300, col[0], { ol: 5, hi: PAL.cream, shade: col[1] });
      g.strokeStyle = PAL.cream; g.lineWidth = 22; g.beginPath(); g.arc(0, 0, 248, 0, TAU); g.stroke();
      Draw.text(g, String(m.count), 0, 18, { size: 400, col: PAL.cream, stroke: LINE, sw: 40, weight: 900, shadow: 16 });
      g.globalAlpha = 1;
      g.restore();
    }
    const tl = m.mode === 'chegada' ? m.tc - CH.launch : u - T_LAUNCH;
    if (tl >= 0 && tl < 1.6) {
      const pop = tl < 0.15 ? 0.4 + 4 * tl : 1;
      g.save(); g.translate(m.x - f * 800, m.y - 1300); g.rotate(-0.06 * f); g.scale(pop, pop);
      Draw.text(g, 'DECOLAR!', 0, 0, { size: 240, col: PAL.goldL, sw: 30, stroke: LINE, weight: 900, alpha: tl > 1.2 ? 1 - (tl - 1.2) / 0.4 : 1 });
      g.restore();
    }
    if (m.title > 0) {
      const k = m.title, pop = k < 0.12 ? 0.3 + 0.8 * smooth(k / 0.12) : 1.1 - 0.1 * smooth((k - 0.12) / 0.2), al = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
      g.save(); g.translate(m.x - f * 300, m.y - 1720); g.scale(pop, pop);
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
    for (const f of [1, -1]) { rocketBake(f, li); baseBake(f, li); boothBake(f, li); }
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
        const q = clamp((u - T_DROP) / (T_LAND - T_DROP), 0, 1), cx = x - CRATE_DX * kk, cy = y - (1 - q) * 300;
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
