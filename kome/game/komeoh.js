/* Kome no Japão — komeoh.js
   'komeoh' = KOME-OH: robô gigante de combinação (sentai) feito de TODAS as máquinas da frota, pilotado pelo Kome na cabeça.
   Depende de: core.js, pix.js, shiba.js, fx.js, terrain.js, rig.js. Usa como PEÇAS (desenhos de verdade, renderizados uma vez
   em canvas fora da tela e cacheados em 3 níveis): machines-mid.js (trator = canela da perna da frente, empilhadeira = canela da
   perna de trás, escav = braço-garra esquerdo + ombreira), machines-mine.js (caminhao = tronco, pacabo = braço direito + ombreira),
   bagger.js (roda de caçambas = escudo giratório do peito) e tbm.js (cabeça de corte = punho-broca). Tudo detectado na hora:
   máquina que não estiver carregada vira uma peça genérica desenhada aqui (o robô nunca quebra).

   Interface comum: G.Tools.komeoh = {id, name:'KOME-OH', kind:'mecha', w, h, meta, create(opts), update(m,dt,inp), draw(g,m),
   glow(g,m), bite(m), dump(m), seat(m), prebake(level?)}; m.ev = eventos do frame.
   Espaço do modelo: origem no chão sob a bacia, +x = frente, y pra baixo (y de mundo), ~1040 px de altura (topo do chapéu).
   A máquina é dona de m.x (bacia, mundo): pega inp.x no 1º update e depois ANDA até inp.x (ou até ficar ao alcance de inp.tx
   quando inp.x não vem), a no máx. meta.walk px/s, com passos de verdade: pés plantados em inp.floor(x) (sobe a montanha de arroz).
   opts = {mode:'normal'|'combine', pilot, x}.

   inp: x (alvo da bacia), y (chão sem floor), floor(x)->y, face (±1), tx/ty (alvo do golpe, mundo), digging (golpeia em ciclo:
   garra esquerda que cava e joga o arroz pra trás, depois soco-broca), boost (>= 1 na subida dispara o SOCO FOGUETE), dumpX (x de
   mundo pra onde a garra joga o arroz; padrão 700 atrás), parts (E.Particles), night (0..1), speedMul, power.
   Eventos: 'stomp' (pé no chão), 'punch' (impacto: garra ou broca), 'drill' (broca começa a furar), 'rocket' (punho decola),
   'return' (punho encaixa de volta), 'roar' (urro: pose final e carga do foguete), 'lock' (peça encaixa na combinação),
   'combined' (fim da combinação), 'toss' (garra solta o arroz pra trás).
   Âncoras (mundo): bite(m) = {x,y,r,active,phase,kind:'claw'|'drill'|'rocket',deep} (r ≈ 120; foguete r ≈ 190 e deep = quanto
   afundou); dump(m) = {x,y,active,tx} (garra soltando o arroz, tx = alvo); seat(m) = cabine do Kome (testa).
   Ler: m.combine {phase 0..1, step, fx, fy, zoom} (câmera da combinação), m.dark (0..1: escurecer o céu), m.mode, m.rocket
   (null | {x,y,state}), m.speed {on,x,y,dir} (linhas de velocidade do foguete pra ScreenFX), m.flash (0..1 clarão), m.shakeK. */
(function () {
  'use strict';
  const E = window.KomeEngine;
  if (!E || !E.Rig) throw new Error('komeoh.js: carregue core, pix, shiba, fx, terrain e rig antes');
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, Rig = E.Rig, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const seg = (u, a, b) => smooth((u - a) / (b - a));
  const lin = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const backOut = t => { const s = 1.6; t = clamp(t, 0, 1) - 1; return t * t * ((s + 1) * t + s) + 1; };
  const wrapA = a => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };
  const shc = new Map();
  function sh(c, k) { const key = c + '|' + k; let v = shc.get(key); if (v === undefined) { v = U.shade(c, k); shc.set(key, v); } return v; }
  function mixc(a, b, k) { const key = a + '>' + b + '|' + k; let v = shc.get(key); if (v === undefined) { v = U.mixCss(a, b, k); shc.set(key, v); } return v; }
  const HAT = (E.PALS && E.PALS.kome && E.PALS.kome.h) || PAL.gold, HATD = (E.PALS && E.PALS.kome && E.PALS.kome.g) || PAL.goldD;

  /* ======================================================================
     geometria (modelo do robô, px de arte)
     ====================================================================== */
  const LT = 168, LS = 170, ANK = 128, LEGMAX = LT + LS + ANK;     // coxa, canela, tornozelo -> chão (altura do veículo-bota)
  const STAND = 436;                                                // altura do quadril em pé (≈ .94 da perna)
  const HIP_N = [34, 8], HIP_F = [-46, 0];                          // quadris (bacia local)
  const TORSO_AT = [0, -40];                                        // tronco na bacia
  const SH_N = [214, -262], SH_F = [-206, -266];                    // ombros (tronco local)
  const HEAD_AT = [26, -300], CHEST_AT = [-6, -176], HEAD_K = 0.84;
  const LU_P = 200, LL_P = 214, FIST_L = 70;                       // braço direito (pá de cabo + punho-broca)
  const LU_X = 232, LL_X = 150, LH_X = 84;                          // braço esquerdo (escavadeira)
  const S_TR = 2.2, S_EM = 2.2, S_CA = 1.22, S_X = 1.48, S_P = 0.6, S_PD = 0.86, S_PB = 0.84, S_W = 0.72, S_D = 0.52;
  const WHEEL_R = 152 * S_W, DISC_R = 152 * S_D;
  const C_FRAME = PAL.grayD, C_FRAMEL = PAL.gray, C_TRIM = PAL.gold, C_SEAM = PAL.waterL, C_EYE = PAL.waterL, C_EYEG = PAL.goldL;
  const C_TBM = sh(PAL.cream, -0.05);
  const CYCLE_CLAW = 1.55, CYCLE_DRILL = 1.45, WALK_V = 92;

  /* ======================================================================
     cache de sprites (3 níveis: px de canvas por px de mundo)
     ====================================================================== */
  const LV = [0.42, 0.9, 1.8];
  const bakes = new Map();
  let curLv = 1;
  function lvFor(e) { return e <= 0.5 ? 0 : e <= 1.05 ? 1 : 2; }
  function bakeNow(def, s, v) {
    const b = def.box, cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil((b[2] - b[0]) * s)); cv.height = Math.max(1, Math.ceil((b[3] - b[1]) * s));
    const c = cv.getContext('2d');
    c.scale(s, s); c.translate(-b[0], -b[1]);
    const z0 = Draw.zoom, m0 = Draw.minPx;
    Draw.lod(s, 0);
    try { def.fn(c, v); } catch (err) { if (window.console) console.warn('[kome] komeoh bake ' + def.id, err); }
    Draw.lod(z0, m0);
    if (v & 1) {                                                    // variante "longe": mais escura e fria
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(52,40,70,.30)'; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'source-over';
    }
    return { cv, x0: b[0], y0: b[1], w: b[2] - b[0], h: b[3] - b[1] };
  }
  function spr(def, v) {
    let row = def.cache[v | 0];
    if (!row) row = def.cache[v | 0] = [null, null, null];
    let b = row[curLv];
    if (!b) b = row[curLv] = bakeNow(def, LV[curLv], v | 0);
    return b;
  }
  function blit(g, def, v) { const b = spr(def, v); g.drawImage(b.cv, b.x0, b.y0, b.w, b.h); }
  function Def(id, box, fn) { return { id, box, fn, cache: [] }; }

  /* ---- máquinas doadoras (instâncias só pra desenhar) ---- */
  const donors = new Map();
  const DINP = { x: 0, y: 0, face: 1, floor: null, digging: false, power: 1 };
  const flat0 = () => 0;
  function donor(id, face) {
    const T = G.Tools[id]; if (!T) return null;
    const key = id + face; let m = donors.get(key);
    if (!m) {
      m = T.create({});
      DINP.face = face; DINP.floor = flat0;
      for (let i = 0; i < 150; i++) T.update(m, 1 / 60, DINP);
      if (m.exhaust && m.exhaust.clear) m.exhaust.clear();
      if (m.rig && m.rig.has('driver')) m.rig.get('driver').draw = null;      // o Kome vai na cabeça do robô
      m.parts = null;
      donors.set(key, m);
    }
    return m;
  }
  function clipPoly(c, pts, k) { c.beginPath(); for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (i) c.lineTo(p[0] * k, p[1] * k); else c.moveTo(p[0] * k, p[1] * k); } c.closePath(); c.clip(); }
  // desenha a máquina inteira (escala S, origem no chão dela) recortada por um polígono no espaço da máquina
  function machine(c, id, S, clip, v) {
    const T = G.Tools[id], mirror = (v & 2) ? -1 : 1, m = donor(id, mirror);
    if (!T || !m) return false;
    c.save();
    if (clip) clipPoly(c, clip, S);
    c.scale(S * mirror, S);                                          // variante 2: texto pré-espelhado (o robô desvira na hora)
    T.draw(c, m);
    c.restore();
    return true;
  }
  // captura um canvas que a máquina desenha por drawImage com tamanho w x h (roda da Bagger, disco do tatuzão)
  const caps = {};
  function capture(id, w, h, prep) {
    if (caps[id] !== undefined) return caps[id];
    caps[id] = null;
    const T = G.Tools[id]; if (!T) return null;
    try {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      const c = cv.getContext('2d'), orig = c.drawImage;
      let got = null;
      c.drawImage = function (img, a, b, cw, ch) {
        if (!got && arguments.length >= 5 && Math.abs(cw - w) < 1.5 && Math.abs(ch - h) < 1.5) got = img;
        return orig.apply(c, arguments);
      };
      const m = T.create({}); DINP.face = 1; DINP.floor = flat0;
      for (let i = 0; i < 5; i++) T.update(m, 1 / 60, DINP);
      const z0 = Draw.zoom; prep(c, m); T.draw(c, m); Draw.lod(z0);
      caps[id] = got;
    } catch (err) { caps[id] = null; }
    return caps[id];
  }

  /* ======================================================================
     peças (sprites). Cada uma no espaço do VEÍCULO (já em escala de robô); tb = matriz osso <- sprite
     ====================================================================== */
  const ID = [1, 0, 0, 1, 0, 0];
  // frameFrom: sprite (x0,y0) -> origem do osso, (x1,y1) -> (L,0); fy=-1 espelha na perpendicular
  function frameFrom(x0, y0, x1, y1, L, fy) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), k = L / len, c = dx / len * k, s = dy / len * k;
    // osso = R(-ang)*S(k)*(p - p0), depois espelha y
    const a = c, b = -s * fy, cc = s, d = c * fy;
    return [a, b, cc, d, -(a * x0 + cc * y0), -(b * x0 + d * y0)];
  }
  function inv(m, out) {
    const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
    out[0] = m[3] / det; out[1] = -m[1] / det; out[2] = -m[2] / det; out[3] = m[0] / det;
    out[4] = -(out[0] * m[4] + out[2] * m[5]); out[5] = -(out[1] * m[4] + out[3] * m[5]);
    return out;
  }
  function mul(A, B, out) {                                          // out = A * B
    const a = A[0] * B[0] + A[2] * B[1], b = A[1] * B[0] + A[3] * B[1], c = A[0] * B[2] + A[2] * B[3], d = A[1] * B[2] + A[3] * B[3];
    const e = A[0] * B[4] + A[2] * B[5] + A[4], f = A[1] * B[4] + A[3] * B[5] + A[5];
    out[0] = a; out[1] = b; out[2] = c; out[3] = d; out[4] = e; out[5] = f; return out;
  }
  const tf = (g, M) => g.transform(M[0], M[1], M[2], M[3], M[4], M[5]);

  const PAC_HOUSE = [[-226, -366], [110, -366], [110, -215], [70, -150], [24, -78], [-226, -78]];
  const PAC_BOOM = (() => {                                          // faixa da lança da pá de cabo, do pino até antes da sela
    const x0 = 59, y0 = -90.5, dx = 0.683, dy = -0.731, nx = 0.731, ny = 0.683, a = -34, b = 212, w = 27;
    return [[x0 + dx * a + nx * w, y0 + dy * a + ny * w], [x0 + dx * b + nx * w, y0 + dy * b + ny * w], [x0 + dx * b - nx * w, y0 + dy * b - ny * w], [x0 + dx * a - nx * w, y0 + dy * a - ny * w]];
  })();
  const PAC_DIP = [[204, -296], [244, -300], [258, -246], [266, -196], [292, -150], [338, -150], [376, -30], [346, 2], [236, 2], [206, -112], [234, -190], [222, -236], [198, -262]];

  const SPR = {
    bootT: Def('bootT', [-62 * S_TR, -130 * S_TR, 114 * S_TR, 2], (c, v) => {
      if (!machine(c, 'trator', S_TR, [[-70, -140], [120, -140], [120, 0.5], [-70, 0.5]], v)) genericVehicle(c, S_TR, PAL.red, 165, 105);
    }),
    bootF: Def('bootF', [-70 * S_EM, -120 * S_EM, 96 * S_EM, 2], (c, v) => {
      if (!machine(c, 'empilhadeira', S_EM, [[-75, -130], [100, -130], [100, 0.5], [-75, 0.5]], v)) genericVehicle(c, S_EM, PAL.ora, 158, 110);
    }),
    pacHouse: Def('pacHouse', [-230 * S_P, -370 * S_P, 114 * S_P, -76 * S_P], (c, v) => {
      if (!machine(c, 'pacabo', S_P, PAC_HOUSE, v)) Draw.box(c, -220 * S_P, -230 * S_P, 320 * S_P, 150 * S_P, PAL.cream, { r: 6 });
    }),
    pacBoom: Def('pacBoom', [20 * S_PB, -270 * S_PB, 230 * S_PB, -40 * S_PB], (c, v) => {
      if (!machine(c, 'pacabo', S_PB, PAC_BOOM, v)) Rig.plate(c, [[59 * S_PB, -90 * S_PB, 20 * S_PB], [200 * S_PB, -240 * S_PB, 16 * S_PB]], PAL.blkL);
    }),
    pacDip: Def('pacDip', [194 * S_PD, -304 * S_PD, 380 * S_PD, 6 * S_PD], (c, v) => {
      if (!machine(c, 'pacabo', S_PD, PAC_DIP, v)) Draw.box(c, 220 * S_PD, -140 * S_PD, 120 * S_PD, 130 * S_PD, PAL.grayD, { r: 4 });
    }),
    // escavadeira: as peças do rig dela, cada uma no próprio espaço local (pino na origem)
    escHouse: Def('escHouse', [-104 * S_X, -150 * S_X, 64 * S_X, 14 * S_X], (c, v) => escPart(c, ['house', 'cab'], v) || Draw.box(c, -100 * S_X, -80 * S_X, 150 * S_X, 80 * S_X, PAL.yel, { r: 6 })),
    escBoom: Def('escBoom', [-16 * S_X, -48 * S_X, 148 * S_X, 18 * S_X], (c, v) => escPart(c, ['boom'], v) || Rig.plate(c, [[0, 0, 10 * S_X], [52 * S_X, -24 * S_X, 17 * S_X], [134 * S_X, 0, 9 * S_X]], PAL.yel)),
    escStick: Def('escStick', [-32 * S_X, -20 * S_X, 98 * S_X, 16 * S_X], (c, v) => escPart(c, ['stick'], v) || Rig.plate(c, [[-21 * S_X, -3 * S_X, 6 * S_X], [5 * S_X, -2 * S_X, 12 * S_X], [86 * S_X, 0, 7 * S_X]], PAL.yel)),
    escBucket: Def('escBucket', [-16 * S_X, -34 * S_X, 66 * S_X, 46 * S_X], (c, v) => escPart(c, ['bucket'], v) || Rig.bucket(c, 48 * S_X, { kind: 'excavator', col: PAL.steel })),
    wheel: Def('wheel', [-WHEEL_R - 4, -WHEEL_R - 4, WHEEL_R + 4, WHEEL_R + 4], c => {
      const cap = capture('bagger', 304, 304, (cc, m) => { cc.scale(2.4, 2.4); Draw.lod(2.4); });
      if (cap) c.drawImage(cap, -WHEEL_R, -WHEEL_R, WHEEL_R * 2, WHEEL_R * 2); else genericWheel(c, WHEEL_R);
    }),
    disc: Def('disc', [-DISC_R - 4, -DISC_R - 4, DISC_R + 4, DISC_R + 4], c => {
      const cap = capture('tbm', 304, 304, (cc, m) => { cc.scale(0.1, 0.1); Draw.lod(3); });
      if (cap) c.drawImage(cap, -DISC_R, -DISC_R, DISC_R * 2, DISC_R * 2); else genericDisc(c, DISC_R);
    }),
    // peças próprias (estáticas, também cacheadas)
    thighN: Def('thighN', [-80, -92, LT + 70, 86], c => drawThigh(c, PAL.red, PAL.yel)),
    thighF: Def('thighF', [-80, -92, LT + 70, 86], c => drawThigh(c, PAL.ora, PAL.gray)),
    shinN: Def('shinN', [-76, -90, LS + 60, 84], c => drawShin(c, PAL.red, PAL.yel)),
    shinF: Def('shinF', [-76, -90, LS + 60, 84], c => drawShin(c, PAL.ora, PAL.gray)),
    pelvis: Def('pelvis', [-140, -70, 140, 64], c => drawPelvis(c)),
    head: Def('head', [-150, -236, 170, 16], c => drawHeadBase(c)),
    hat: Def('hat', [-232, -136, 232, 34], c => drawHat(c)),
    drum: Def('drum', [-30, -66, 70, 66], c => drawDrum(c)),
    torso: Def('torso', [-248, -312, 262, 40], (c, v) => {
      drawTorsoFrame(c);
      c.save(); tf(c, TB.truck);
      if (!machine(c, 'caminhao', S_CA, [[-190, -220], [205, -220], [205, 0.5], [-190, 0.5]], v)) genericVehicle(c, S_CA, PAL.yel, 360, 200);
      c.restore();
      drawTorsoLive(c);
    }),
    cone0: Def('cone0', [6, -36, 100, 36], c => drawCone(c, 0)), cone1: Def('cone1', [6, -36, 100, 36], c => drawCone(c, 1)),
    cone2: Def('cone2', [6, -36, 100, 36], c => drawCone(c, 2)), cone3: Def('cone3', [6, -36, 100, 36], c => drawCone(c, 3)),
  };

  function escPart(c, names, v) {
    const m = donor('escav', 1); if (!m || !m.rig) return false;
    const rig = m.rig;
    c.save(); c.scale(S_X, S_X);
    for (let i = 0; i < names.length; i++) { const p = rig.get(names[i]); if (p && p.draw) p.draw(c, p, rig, 0); }
    c.restore();
    return true;
  }
  // boneTB: matrizes osso <- sprite de cada peça
  const TB = {
    bootT: [1, 0, 0, 1, 4 * S_TR, ANK],                               // tornozelo em cima do capô/cabine, rodas no chão
    bootF: [1, 0, 0, 1, 2 * S_EM, ANK],
    truck: [1, 0, 0, 1, -8 * S_CA, -46],
    torso: ID,
    pacHouse: [1, 0, 0, 1, 70 * S_P + 26, 80 * S_P + 26],
    pacBoom: frameFrom(59 * S_PB, -90.5 * S_PB, (59 + 0.683 * 205) * S_PB, (-90.5 - 0.731 * 205) * S_PB, LU_P, 1),
    pacDip: frameFrom(224 * S_PD, -266 * S_PD, 318 * S_PD, -40 * S_PD, LL_P, 1),
    escHouse: [1, 0, 0, 1, 0, 24 - 7 * S_X],
    escBoom: [LU_X / (134 * S_X), 0, 0, LU_X / (134 * S_X), 0, 0],
    escStick: [LL_X / (86 * S_X), 0, 0, LL_X / (86 * S_X), 0, 0],
    escBucket: [LH_X / (48 * S_X), 0, 0, LH_X / (48 * S_X), 0, 0],
  };

  /* ---- peças genéricas (só se a máquina não estiver carregada) ---- */
  function genericVehicle(c, S, col, L, H) {
    Draw.box(c, -L * 0.45 * S, -H * S, L * 0.6 * S, H * 0.7 * S, col, { r: 8 });
    Draw.wheel(c, -L * 0.25 * S, -24 * S, 24 * S, 0, {}); Draw.wheel(c, L * 0.3 * S, -24 * S, 24 * S, 0, {});
  }
  function genericWheel(c, R) {
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18; Draw.circle(c, Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, R * 0.16, PAL.ora); }
    Draw.ring(c, 0, 0, R * 0.72, R * 0.16, PAL.rust); Draw.circle(c, 0, 0, R * 0.25, PAL.steelD);
  }
  function genericDisc(c, R) {
    Draw.circle(c, 0, 0, R, C_TBM, { hi: false });
    for (let i = 0; i < 8; i++) { c.save(); c.rotate(i * TAU / 8); Draw.box(c, R * 0.2, -R * 0.1, R * 0.7, R * 0.2, PAL.cream, { r: 2 }); c.restore(); }
    Draw.circle(c, 0, 0, R * 0.22, PAL.steel);
  }

  /* ======================================================================
     desenhos próprios: coxa, bacia, pé, tronco, cabeça, chapéu, tambor do punho
     ====================================================================== */
  const R2 = { r: 2 }, R4 = { r: 4 }, R6 = { r: 6 }, R10 = { r: 10 }, THIN = { ol: 1.4 }, NOHI = { hi: false }, FLAT = { ol: 0, top: false, shade: false };
  function bolts(c, pts, r) { c.fillStyle = LINE; c.beginPath(); for (let i = 0; i < pts.length; i += 2) { c.moveTo(pts[i] + r + 1, pts[i + 1]); c.arc(pts[i], pts[i + 1], r + 1, 0, TAU); } c.fill(); c.fillStyle = PAL.steelL; c.beginPath(); for (let i = 0; i < pts.length; i += 2) { c.moveTo(pts[i] + r, pts[i + 1]); c.arc(pts[i], pts[i + 1], r, 0, TAU); } c.fill(); }
  function seam(c, x0, y0, x1, y1) {                                 // fenda luminosa (acende de noite no glow)
    c.lineCap = 'round'; c.strokeStyle = LINE; c.lineWidth = 7; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = sh(C_SEAM, -0.25); c.lineWidth = 3.4; c.stroke();
    c.strokeStyle = sh(C_SEAM, 0.25); c.lineWidth = 1.4; c.stroke();
  }
  function drawThigh(c, col, trim) {
    // quadro interno de aço (atrás) + couraça colorida da cor do veículo da perna
    Rig.plate(c, [[0, 0, 56], [LT * 0.5, 0, 52], [LT, 0, 48]], C_FRAME);
    Rig.plate(c, [[6, -8, 68], [LT * 0.45, -14, 72], [LT - 20, -8, 56]], col);
    Draw.poly(c, [[16, -70], [LT - 40, -72], [LT - 26, -44], [30, -42]], sh(col, 0.22), FLAT);
    Draw.poly(c, [[-8, 30], [LT - 30, 36], [LT - 40, 56], [6, 54]], sh(col, -0.25), FLAT);
    Draw.box(c, 26, -20, LT - 78, 26, trim, { r: 5, rivets: 14 });
    Draw.hazard(c, 30, 28, LT - 86, 12, {});
    seam(c, 22, -46, LT - 44, -48);
    bolts(c, [18, -40, LT - 40, -44, 22, 34, LT - 50, 36], 3.4);
    Rig.pin(c, 0, 0, 24, { col: PAL.steel }); Rig.pin(c, LT, 0, 22, { col: PAL.steel });
    Draw.circle(c, 0, 0, 10, C_TRIM, { hi: false, shade: false });
  }
  function drawPelvis(c) {
    Draw.poly(c, [[-124, -54], [124, -54], [110, 30], [40, 56], [-40, 56], [-110, 30]], C_FRAME, { shade: true, hi: true });
    Draw.box(c, -112, -54, 224, 30, C_FRAMEL, { r: 6, rivets: 18 });
    Draw.hazard(c, -100, -22, 200, 14, {});
    Draw.poly(c, [[-34, -12], [34, -12], [26, 40], [-26, 40]], C_TRIM, { shade: PAL.goldD, hi: PAL.goldL });
    Draw.poly(c, [[-12, -2], [12, -2], [0, 30]], PAL.red, THIN);                                // gema da fivela
    seam(c, -96, 8, -46, 28); seam(c, 96, 8, 46, 28);
  }
  function drawShin(c, col, trim) {
    // canela: quadro de aço + caneleira da cor do veículo-bota, joelheira grande e encaixe do tornozelo
    Rig.plate(c, [[0, 0, 48], [LS * 0.5, 0, 44], [LS, 0, 44]], C_FRAME);
    Rig.plate(c, [[18, -10, 64], [LS * 0.55, -18, 62], [LS - 30, -12, 50]], col);
    Draw.poly(c, [[30, -68], [LS - 50, -70], [LS - 40, -44], [40, -46]], sh(col, 0.22), FLAT);
    Draw.box(c, 50, -18, LS - 104, 22, trim, { r: 5, rivets: 14 });
    seam(c, 40, 30, LS - 50, 34);
    Draw.box(c, LS - 46, -40, 64, 80, C_FRAMEL, { r: 10, rivets: 16 });           // encaixe do tornozelo
    bolts(c, [44, -44, LS - 60, -46], 3.4);
    // joelheira
    Draw.poly(c, [[-40, -54], [26, -70], [58, -40], [40, 16], [-30, 28]], sh(col, -0.08), { hi: true, shade: true });
    Draw.circle(c, 10, -20, 13, C_TRIM, { ol: 2 });
    Rig.pin(c, LS, 0, 20, { col: PAL.steel });
  }
  function drawTorsoFrame(c) {
    // espinha, ombros e o "colarinho" que juntam o caminhão num tronco só (fica atrás do caminhão)
    Rig.plate(c, [[0, 18, 52], [-6, -110, 70], [10, -214, 66]], C_FRAME);
    Draw.box(c, -176, -236, 352, 46, C_FRAMEL, { r: 14, rivets: 22 });
    Draw.circle(c, SH_N[0], SH_N[1], 46, PAL.steelD); Draw.circle(c, SH_F[0], SH_F[1], 44, sh(PAL.steelD, -0.15));
    Draw.box(c, -190, -150, 34, 110, C_FRAME, R6); Draw.box(c, 166, -150, 34, 110, C_FRAME, R6);
    for (let i = 0; i < 4; i++) { Draw.box(c, -186, -140 + i * 24, 26, 12, PAL.blk, FLAT); Draw.box(c, 170, -140 + i * 24, 26, 12, PAL.blk, FLAT); }
  }
  // cabeça: cara de shiba em metal (origem = pino do pescoço; olha pra +x)
  const HEAD_C = [10, -112];
  function drawHeadBase(c) {
    const cx = HEAD_C[0], cy = HEAD_C[1];
    // pescoço sanfonado
    Draw.box(c, -34, -44, 68, 48, PAL.steelD, R6);
    c.fillStyle = sh(PAL.steelD, -0.3); for (let i = 0; i < 4; i++) c.fillRect(-30, -38 + i * 11, 60, 3);
    // crânio laranja (pelo de shiba em chapa)
    c.lineJoin = 'round';
    c.beginPath(); c.ellipse(cx, cy, 120, 96, 0, 0, TAU); c.fillStyle = LINE; c.lineWidth = 6; c.strokeStyle = LINE; c.stroke();
    c.fillStyle = PAL.ora; c.fill();
    c.save(); c.clip();
    c.fillStyle = PAL.oraD; c.beginPath(); c.ellipse(cx - 18, cy + 30, 130, 76, 0, 0, PI); c.fill();
    c.fillStyle = PAL.oraL; c.beginPath(); c.ellipse(cx - 10, cy - 70, 82, 26, -0.08, 0, TAU); c.fill();
    // bochechas creme (máscara de shiba)
    c.fillStyle = PAL.cream; c.beginPath(); c.ellipse(cx + 54, cy + 46, 84, 52, -0.15, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(cx - 76, cy + 50, 50, 40, 0.2, 0, TAU); c.fill();
    c.fillStyle = PAL.mochiD; c.beginPath(); c.ellipse(cx + 40, cy + 80, 80, 20, -0.1, 0, TAU); c.fill();
    // linhas de chapa
    c.strokeStyle = sh(PAL.oraD, -0.2); c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx - 100, cy - 20); c.quadraticCurveTo(cx - 60, cy - 34, cx - 40, cy + 10); c.stroke();
    c.restore();
    // focinho que avança pra frente
    Draw.poly(c, [[cx + 62, cy - 4], [cx + 138, cy - 2], [cx + 152, cy + 22], [cx + 140, cy + 50], [cx + 70, cy + 60]], PAL.cream, { shade: PAL.mochiD });
    Draw.poly(c, [[cx + 132, cy - 6], [cx + 156, cy - 2], [cx + 158, cy + 14], [cx + 140, cy + 18]], PAL.blk, { hi: PAL.blkL });  // nariz
    c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(cx + 140, cy - 2, 8, 4);
    c.strokeStyle = LINE; c.lineWidth = 4; c.lineCap = 'round';                                 // boquinha ω
    c.beginPath(); c.moveTo(cx + 146, cy + 18); c.lineTo(cx + 144, cy + 30);
    c.quadraticCurveTo(cx + 136, cy + 40, cx + 126, cy + 32); c.moveTo(cx + 144, cy + 30); c.quadraticCurveTo(cx + 150, cy + 40, cx + 156, cy + 30); c.stroke();
    // grade do queixo (robô)
    Draw.box(c, cx + 34, cy + 62, 80, 22, PAL.steel, { r: 5 });
    c.fillStyle = LINE; for (let i = 0; i < 5; i++) c.fillRect(cx + 42 + i * 14, cy + 66, 5, 14);
    // órbitas (os olhos acendem por cima, ao vivo)
    c.fillStyle = LINE; c.beginPath(); c.ellipse(cx + 58, cy - 13, 40, 27, 0.05, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(cx - 35, cy - 14, 27, 25, 0, 0, TAU); c.fill();
    c.fillStyle = PAL.ink; c.beginPath(); c.ellipse(cx + 58, cy - 13, 36, 23, 0.05, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(cx - 35, cy - 14, 23, 21, 0, 0, TAU); c.fill();
    // sobrancelhas-pinta de shiba (creme)
    Draw.circle(c, cx + 52, cy - 50, 11, PAL.cream, NOHI); Draw.circle(c, cx - 34, cy - 50, 9, PAL.cream, NOHI);
    // bochecha rosada
    c.fillStyle = 'rgba(217,87,99,.55)'; c.beginPath(); c.ellipse(cx + 100, cy + 36, 16, 9, 0, 0, TAU); c.fill();
    // moldura da cabine na testa
    Draw.box(c, cx - 26, cy - 98, 104, 60, PAL.steelD, { r: 14 });
    bolts(c, [cx - 18, cy - 90, cx + 70, cy - 90, cx - 18, cy - 46, cx + 70, cy - 46], 3);
  }
  const WIN = { x: HEAD_C[0] - 16, y: HEAD_C[1] - 90, w: 84, h: 44 };
  function drawHat(c) {
    // kasa (chapéu de palha) virado capacete: aba larga, cone, trama, aro de aço e crista dourada
    c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-226, 14); c.quadraticCurveTo(-120, -50, 4, -128); c.quadraticCurveTo(130, -50, 226, 14);
    c.quadraticCurveTo(0, 36, -226, 14); c.closePath();
    c.lineWidth = 7; c.strokeStyle = LINE; c.stroke(); c.fillStyle = HAT; c.fill();
    c.save(); c.clip();
    c.fillStyle = HATD; c.beginPath(); c.moveTo(4, -128); c.quadraticCurveTo(-60, -40, -230, 20); c.lineTo(-230, 40); c.lineTo(4, 40); c.closePath(); c.globalAlpha = 0.45; c.fill(); c.globalAlpha = 1;
    c.strokeStyle = sh(HATD, -0.1); c.lineWidth = 2.6;
    for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(4, -128); c.lineTo(i * 38, 30); c.stroke(); }
    for (let k = 1; k < 4; k++) { const y = -128 + k * 36; c.beginPath(); c.moveTo(-226, y + 40); c.quadraticCurveTo(4, y - 40 + k * 8, 226, y + 40); c.stroke(); }
    c.restore();
    Draw.beam(c, [[-224, 14], [0, 30], [224, 14]], 9, PAL.steel, { ol: 2.5 });                 // aro de aço
    bolts(c, [-150, 21, -75, 27, 75, 27, 150, 21], 3.4);
    // crista dourada (folhas de arroz em V, estilo sentai)
    Draw.poly(c, [[4, -86], [-60, -150], [-30, -96], [4, -70], [38, -96], [70, -150]], C_TRIM, { shade: PAL.goldD, hi: PAL.goldL });
    Draw.poly(c, [[-10, -98], [4, -122], [18, -98], [4, -80]], PAL.red, { hi: PAL.redL });
  }
  function drawCone(c, f) {
    // ponta cônica da broca com espiral (4 quadros de giro)
    const L = 70, R = 30;
    c.fillStyle = LINE; c.beginPath(); c.moveTo(10, -R - 4); c.lineTo(18 + L + 6, 0); c.lineTo(10, R + 4); c.closePath(); c.fill();
    c.fillStyle = PAL.steel; c.beginPath(); c.moveTo(12, -R); c.lineTo(18 + L, 0); c.lineTo(12, R); c.closePath(); c.fill();
    c.save(); c.clip();
    c.strokeStyle = PAL.steelD; c.lineWidth = 7;
    const ph = f * 5.5;
    for (let i = -2; i < 6; i++) { const x = 12 + i * 22 + ph; c.beginPath(); c.moveTo(x, -R); c.lineTo(x + 18, R); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(12, -R, L, R * 0.35);
    c.restore();
  }
  function drawDrum(c) {
    // munhequeira do punho-broca: anel de aço com faixa zebrada + flange creme do escudo do tatuzão
    const r = 58;
    Draw.box(c, -24, -r, 46, r * 2, PAL.steelD, { r: 8, rivets: 12 });
    Draw.hazard(c, -20, -r + 10, 12, r * 2 - 20, {});
    Draw.box(c, 18, -r - 6, 40, r * 2 + 12, C_TBM, { r: 10, top: sh(PAL.cream, 0.12), shade: sh(PAL.cream, -0.3) });
    c.fillStyle = sh(PAL.cream, -0.2); c.fillRect(20, r * 0.3, 36, r * 0.55);
    for (let i = 0; i < 4; i++) Draw.box(c, 26, -46 + i * 28, 24, 8, PAL.yel, { r: 2, ol: 1.4 });
    bolts(c, [-14, -48, -14, 48, 4, -48, 4, 48], 3);
  }

  /* ======================================================================
     instância
     ====================================================================== */
  const GRAINO = { shape: 'grain', c: PAL.rice, land: true, w: 8, h: 4, life: 2.2, ol: true, g: 900, x: 0, y: 0, vx: 0, vy: 0, vr: 6 };
  const SPARKO = { c: [PAL.goldL, PAL.yel, PAL.ora, PAL.cream], speed: [220, 760], spread: PI, w: [8, 16], life: [0.3, 0.7], g: 600, dir: -PI / 2 };
  const FIREO = { shape: 'puff', c: PAL.ora, w: 22, life: 0.35, g: -80, drag: 2.5, x: 0, y: 0, vx: 0, vy: 0, fade: 0.2 };
  const DUST = { c: PAL.sand }, DUSTW = { c: PAL.cream }, STEAM = { c: PAL.cream };
  const RICEC = [PAL.rice, PAL.riceS, PAL.rice];

  // grupos da combinação: [nome, início, encaixe] (s); ver steps
  const STEPS = [
    ['ceu', 0, 0.9], ['pernas', 0.9, 2.3], ['nucleo', 2.3, 2.9], ['tronco', 2.9, 3.8], ['bracos', 3.8, 5.0],
    ['peito', 5.0, 5.7], ['punho', 5.7, 6.2], ['cabeca', 6.2, 6.95], ['pose', 6.95, 8.0],
  ];
  const COMBINE_T = 8.0;

  function create(opts) {
    opts = opts || {};
    const rig = Rig();
    const jP = E.Spring(0, { k: 60, d: 9 });
    const J = (a, o) => E.Joint(a, o);
    const LEGJ = { k: 1600, d: 80 }, ARMJ = { k: 120, d: 15 }, ARMJF = { k: 90, d: 13 };
    const js = {
      torso: J(0, { k: 50, d: 10, min: -0.5, max: 0.7 }), head: J(0, { k: 40, d: 6, min: -0.5, max: 0.5 }),
      thN: J(1.5, LEGJ), shN: J(0.1, LEGJ), ftN: J(-1.6, LEGJ), thF: J(1.5, LEGJ), shF: J(0.1, LEGJ), ftF: J(-1.6, LEGJ),
      uN: J(1.4, ARMJ), lN: J(-0.4, ARMJ), fN: J(0, ARMJ), uF: J(1.6, ARMJF), lF: J(-0.4, ARMJF), hF: J(0.6, ARMJF),
    };
    const m = {
      id: 'komeoh', t: 0, ev: [], x: opts.x || 0, fixedX: opts.x !== undefined, y: 0, face: 1, init: false, pilot: opts.pilot || 'kome',
      mode: opts.mode === 'combine' ? 'combine' : 'normal', ct: 0, dark: 0, flash: 0, night: 0, parts: null, floorF: null, gy: 0,
      rig, js, jP, vx: 0, walking: false, stepCount: 0, crouch: E.Spring(0, { k: 40, d: 9 }), pelvisY: -STAND - 30, bob: E.Spring(0, { k: 90, d: 7 }),
      feet: [mkFoot(118), mkFoot(-138)], swingIdx: -1, idleT: 0, breath: 0, blink: 0, blinkT: 2,
      wheelRot: 0, wheelV: 0.35, spin: 0, spinV: 2, eyeGold: 0, roarT: 0,
      atk: null, atkN: 0, atkT: 0, load: 0, boostIn: false, rocket: null, rocketCool: 0,
      biteO: { x: 0, y: 0, r: 120, active: false, phase: 0, kind: 'claw', deep: 0 }, dumpO: { x: 0, y: 0, active: false, tx: 0 }, seatO: { x: 0, y: 0 },
      combine: { phase: 0, step: '', fx: 0, fy: 0, zoom: 0.22 }, speed: { on: false, x: 0, y: 0, dir: 0 }, shakeK: 0,
      steamA: E.Exhaust({ size: 26, rate: 0.9, rise: 70, wind: -14, life: 2.2, col: PAL.cream, colD: PAL.steel, max: 18 }),
      steamB: E.Exhaust({ size: 22, rate: 0.7, rise: 60, wind: -14, life: 2, col: PAL.cream, colD: PAL.steel, max: 14 }),
      trail: E.Exhaust({ size: 17, rate: 26, rise: 10, wind: 0, life: 0.7, col: PAL.grayL, colD: PAL.gray, max: 40 }),
      tgtX: 0, tgtY: 0, lock: new Float32Array(STEPS.length), title: 0, burst: 0, komeJump: 0, wantX: null,
      ikO: {}, tmp: { x: 0, y: 0, rot: 0 }, tmp2: { x: 0, y: 0, rot: 0 }, fistW: { x: 0, y: 0, rot: 0 },
    };
    // --- rig ---
    const pd = name => (g, p) => blit(g, SPR[name], p.data && p.data.v);
    rig.part('pelvis', { z: 6, draw: g => blit(g, SPR.pelvis) });
    rig.part('torso', { parent: 'pelvis', x: TORSO_AT[0], y: TORSO_AT[1], z: 7, joint: js.torso, draw: (g, p) => blit(g, SPR.torso, m.face < 0 ? 2 : 0) });
    rig.part('chest', { parent: 'torso', x: CHEST_AT[0], y: CHEST_AT[1], z: 8, draw: (g, p) => drawChest(g, m) });
    rig.part('head', { parent: 'torso', x: HEAD_AT[0], y: HEAD_AT[1], z: 9, sx: HEAD_K, sy: HEAD_K, joint: js.head, draw: (g, p) => drawHead(g, m) });
    rig.part('hat', { parent: 'head', x: 0, y: -224, z: 9.5, draw: (g, p) => drawHatLive(g, m) });
    // perna de trás (empilhadeira), mais escura
    rig.part('thF', { parent: 'pelvis', x: HIP_F[0], y: HIP_F[1], z: 1, joint: js.thF, data: { v: 1 }, draw: (g, p) => blit(g, SPR.thighF, 1) });
    rig.part('shF', { parent: 'thF', x: LT, z: 2, joint: js.shF, draw: (g, p) => blit(g, SPR.shinF, 1) });
    rig.part('ftF', { parent: 'shF', x: LS, z: 2.5, joint: js.ftF, draw: (g, p) => drawBoot(g, m, 1) });
    // braço esquerdo (escavadeira), atrás do braço direito
    rig.part('uF', { parent: 'torso', x: SH_F[0], y: SH_F[1], z: 12, joint: js.uF, draw: (g, p) => { g.save(); tf(g, TB.escBoom); blit(g, SPR.escBoom, 1); g.restore(); } });
    rig.part('lF', { parent: 'uF', x: LU_X, z: 12.5, joint: js.lF, draw: (g, p) => { g.save(); tf(g, TB.escStick); blit(g, SPR.escStick, 1); g.restore(); } });
    rig.part('hF', { parent: 'lF', x: LL_X, z: 12.2, joint: js.hF, draw: (g, p) => drawClaw(g, m) });
    rig.part('pauF', { parent: 'torso', x: SH_F[0], y: SH_F[1], z: 12.8, draw: (g, p) => { g.save(); tf(g, TB.escHouse); blit(g, SPR.escHouse, 1); g.restore(); Rig.pin(g, 0, 0, 22); } });
    // perna da frente (trator)
    rig.part('thN', { parent: 'pelvis', x: HIP_N[0], y: HIP_N[1], z: 14, joint: js.thN, draw: (g, p) => blit(g, SPR.thighN) });
    rig.part('shN', { parent: 'thN', x: LT, z: 15, joint: js.shN, draw: (g, p) => blit(g, SPR.shinN) });
    rig.part('ftN', { parent: 'shN', x: LS, z: 15.5, joint: js.ftN, draw: (g, p) => drawBoot(g, m, 0) });
    // braço direito (pá de cabo + punho-broca do tatuzão)
    rig.part('uN', { parent: 'torso', x: SH_N[0], y: SH_N[1], z: 17, joint: js.uN, draw: (g, p) => { g.save(); tf(g, TB.pacBoom); blit(g, SPR.pacBoom); g.restore(); Rig.pin(g, 0, 0, 20); } });
    rig.part('lN', { parent: 'uN', x: LU_P, z: 17.5, joint: js.lN, draw: (g, p) => { g.save(); tf(g, TB.pacDip); blit(g, SPR.pacDip); g.restore(); Rig.pin(g, 0, 0, 16); } });
    rig.part('fN', { parent: 'lN', x: LL_P, z: 18, joint: js.fN, draw: (g, p) => { if (!m.rocket) drawFist(g, m, 0); else drawSocket(g, m); } });
    rig.part('pauN', { parent: 'torso', x: SH_N[0], y: SH_N[1], z: 18.5, draw: (g, p) => { g.save(); tf(g, TB.pacHouse); blit(g, SPR.pacHouse); g.restore(); } });
    // pistões (esticam sozinhos com as juntas)
    const PK = { w: 22, col: PAL.blkL, rod: PAL.steelL };
    rig.piston('kneeF', { a: ['thF', 50, 42], b: ['shF', 110, 40], w: 22, z: 1.8, col: sh(PAL.blkL, -0.25) });
    rig.piston('kneeN', { a: ['thN', 50, 42], b: ['shN', 110, 40], w: 24, z: 14.8, col: PAL.blkL });
    rig.piston('hipN', { a: ['pelvis', 60, 34], b: ['thN', 96, -44], w: 20, z: 13.9, col: PAL.yel });
    rig.piston('elbN', { a: ['uN', 70, -26], b: ['lN', 30, -24], w: 18, z: 17.3, col: PAL.yel });
    rig.piston('elbF', { a: ['uF', 70, -34], b: ['lF', -22, -10], w: 18, z: 12.4, col: sh(PAL.blkL, -0.2) });
    rig.piston('wrF', { a: ['lF', 20, -20], b: ['hF', -2, -20], w: 13, z: 12.6, col: sh(PAL.blkL, -0.2) });
    rig.calibrate('kneeF', [['shF', 0, 1.6]]); rig.calibrate('kneeN', [['shN', 0, 1.6]]);
    rig.calibrate('hipN', [['thN', 0.6, 2.2]]); rig.calibrate('elbN', [['lN', -2.4, 0.2]]); rig.calibrate('elbF', [['lF', -2.4, 0.2]]);
    rig.calibrate('wrF', [['hF', -1, 2]]);
    void PK; void pd;
    return m;
  }
  function mkFoot(off) { return { off, x: 0, y: 0, ang: 0, lift: 0, t: 0, dur: 0.5, x0: 0, y0: 0, x1: 0, y1: 0, ph: 0, trk: 0, planted: true }; }

  /* ======================================================================
     update
     ====================================================================== */
  const NOINP = { x: 0, y: 0, face: 1 };
  function floorAt(m, x) { return m.floorF ? m.floorF(x) : m.gy; }
  function emit(m, e) { m.ev.push(e); }
  function stepFor(m, name) { for (let i = 0; i < STEPS.length; i++) if (STEPS[i][0] === name) return i; return -1; }

  function update(m, dt, inp) {
    inp = inp || NOINP;
    m.ev.length = 0; m.t += dt;
    m.parts = inp.parts || null; m.night = inp.night || 0;
    m.floorF = typeof inp.floor === 'function' ? inp.floor : null; m.gy = inp.y || 0;
    const newFace = inp.face < 0 ? -1 : 1;
    if (!m.init) {
      m.init = true; if (!m.fixedX && inp.x !== undefined && inp.x !== null) m.x = inp.x; m.face = newFace;
      for (let i = 0; i < 2; i++) { const f = m.feet[i]; f.x = m.x + m.face * f.off; f.y = floorAt(m, f.x); f.ang = slopeAt(m, f.x); }
      m.pelvisY = Math.max(m.feet[0].y, m.feet[1].y) - STAND;
      snapPose(m);
    }
    if (newFace !== m.face) { m.face = newFace; for (let i = 0; i < 2; i++) { const f = m.feet[i]; f.x = m.x + m.face * f.off; f.y = floorAt(m, f.x); } }
    const rate = clamp((inp.speedMul || 1) * (1 + 0.12 * Math.min(1, inp.boost || 0)), 0.5, 2.2);
    m.flash = Math.max(0, m.flash - dt * 2.2); m.shakeK = Math.max(0, m.shakeK - dt * 3);
    m.blinkT -= dt; if (m.blinkT < 0) { m.blink = 0.16; m.blinkT = 2.2 + ((m.t * 7.31) % 1) * 2.5; } m.blink = Math.max(0, m.blink - dt);
    m.breath = Math.sin(m.t * 1.6);
    if (m.mode === 'combine') updateCombine(m, dt, inp);
    else updateNormal(m, dt, inp, rate);
    // vapor das ventarolas (no ritmo da respiração)
    const r = m.rig;
    if (m.mode === 'combine' && m.ct < 3.8) { m.steamA.clear(); m.steamB.clear(); }
    r.world('torso', -196, -150, m.tmp); m.steamA.update(dt, m.tmp.x, m.tmp.y, m.atk ? 0.6 : 0.1, -m.face * 0.4, -1);
    r.world('torso', 186, -150, m.tmp); m.steamB.update(dt, m.tmp.x, m.tmp.y, m.atk ? 0.6 : 0.1, m.face * 0.3, -1);
    r.world('head', WIN.x + WIN.w / 2, WIN.y + WIN.h / 2, m.tmp); m.seatO.x = m.tmp.x; m.seatO.y = m.tmp.y;
  }
  function slopeAt(m, x) { return Math.atan2(floorAt(m, x + 60) - floorAt(m, x - 60), 120); }

  // pose em pé instantânea (início / combinação)
  function snapPose(m) {
    solveLegs(m, 0, true);
    const js = m.js;
    js.uN.snap(1.25); js.lN.snap(-0.55); js.fN.snap(-0.2); js.uF.snap(1.45); js.lF.snap(-0.7); js.hF.snap(1.2);
    js.torso.snap(0); js.head.snap(0);
    m.rig.get('pelvis').y = m.pelvisY; m.rig.get('pelvis').x = 0;
    const P = m.rig.parts; for (let i = 0; i < P.length; i++) if (P[i].joint) P[i].rot = P[i].joint.x;
    m.rig.solve(m.x, 0, m.face, 1, 0);
  }

  function solveLegs(m, dt, snap) {
    const r = m.rig, js = m.js, pel = r.get('pelvis');
    pel.y = m.pelvisY; pel.x = 0;
    r.solve(m.x, 0, m.face, 1, 0);
    for (let i = 0; i < 2; i++) {
      const f = m.feet[i], th = i ? 'thF' : 'thN';
      const hip = r.model(th, 0, 0, m.tmp);
      const fx = (f.x - m.x) * m.face, fang = f.ang * m.face + (f.planted ? 0 : -0.18 * Math.sin(PI * f.t));
      const ax = fx - Math.sin(fang) * ANK * 0.2, ay = f.y - f.lift - ANK;
      const ik = E.ik2(hip.x, hip.y, ax, ay, LT, LS, 1, m.ikO);
      const pr = pel.rot;
      const jt = i ? js.thF : js.thN, jsn = i ? js.shF : js.shN, jf = i ? js.ftF : js.ftN;
      jt.set(ik.a1 - pr); jsn.set(ik.rel); jf.set(fang - ik.a2);
      if (snap) { jt.snap(ik.a1 - pr); jsn.snap(ik.rel); jf.snap(fang - ik.a2); }
    }
  }

  function updateNormal(m, dt, inp, rate) {
    const js = m.js, r = m.rig, face = m.face;
    m.dark = Math.max(0, m.dark - dt * 0.8);
    m.title = Math.max(0, m.title - dt * 0.7); m.burst = Math.max(0, m.burst - dt * 0.8);
    m.rocketCool = Math.max(0, m.rocketCool - dt);
    // --- alvo do golpe ---
    const hasT = inp.tx !== undefined && inp.tx !== null;
    if (hasT) { m.tgtX = inp.tx; m.tgtY = inp.ty !== undefined && inp.ty !== null ? inp.ty : floorAt(m, inp.tx); }
    // --- soco foguete (subida do boost) ---
    const bst = (inp.boost || 0) >= 1;
    if (bst && !m.boostIn && !m.rocket && m.rocketCool <= 0 && hasT) startAtk(m, 'rocket');
    m.boostIn = bst;
    if (!m.atk && inp.digging && hasT && !m.rocket) startAtk(m, m.atkN % 2 ? 'drill' : 'claw');
    // --- onde a bacia quer ficar ---
    let want = inp.x !== undefined && inp.x !== null ? inp.x : m.x;
    if ((inp.x === undefined || inp.x === null) && hasT && (inp.digging || m.atk)) {
      const reachX = 430, d = (m.tgtX - m.x) * face;
      if (d > reachX + 70) want = m.tgtX - face * reachX; else if (d < 300) want = m.tgtX - face * 360;
    }
    if (m.atk && m.atk.kind === 'rocket') want = m.x;
    const err = want - m.x, vt = Math.abs(err) < 6 ? 0 : clamp(err * 1.4, -WALK_V * rate, WALK_V * rate);
    // anda só enquanto um pé está no ar ou pra começar o passo: velocidade com peso
    m.vx = damp(m.vx, vt, 2.2, dt);
    if (Math.abs(m.vx) < 0.5 && vt === 0) m.vx = 0;
    m.x += m.vx * dt;
    m.walking = Math.abs(m.vx) > 4;
    stepFeet(m, dt, rate);
    // --- altura da bacia: no pé mais baixo, com agachamento pro golpe baixo e balanço do passo ---
    const fyLow = Math.max(m.feet[0].y, m.feet[1].y), fyHigh = Math.min(m.feet[0].y, m.feet[1].y);
    let crouchT = 0;
    if (m.atk) { const low = clamp((m.tgtY - (fyLow - 420)) / 380, 0, 1); crouchT = 36 * low; }
    crouchT += Math.max(0, (fyLow - fyHigh) - 150) * 0.4;
    m.crouch.target = crouchT; m.crouch.update(dt);
    const swing = m.swingIdx >= 0 ? Math.sin(PI * m.feet[m.swingIdx].t) : 0;
    m.bob.target = -swing * 16 + m.breath * 3; m.bob.update(dt);
    m.pelvisY = damp(m.pelvisY, fyLow - STAND + m.crouch.x + m.bob.x, 14, dt);
    m.pelvisY = Math.max(m.pelvisY, fyLow - LEGMAX * 0.97);
    const pel = r.get('pelvis');
    m.jP.target = (m.walking ? -0.03 * Math.sign(m.vx * face) : 0) + 0.02 * swing * (m.swingIdx ? 1 : -1); m.jP.update(dt); pel.rot = m.jP.x;
    // --- tronco: inclina pro golpe, balança no passo, respira ---
    let lean = 0.02 * m.breath + (m.walking ? 0.06 : 0) + clamp((fyLow - fyHigh) / 900, 0, 0.2) * ((m.feet[0].y < m.feet[1].y) === (m.feet[0].x * face > m.feet[1].x * face) ? 1 : 0);
    // --- golpes ---
    const A = m.atk;
    let nT = null, fT = null, fistA = 0, handA = 1.2;
    m.biteO.active = false; m.dumpO.active = false; m.speed.on = false;
    m.eyeGold = damp(m.eyeGold, A || m.rocket ? 1 : 0, 6, dt);
    if (A) {
      A.t += dt * rate; const u = A.t / A.dur, p0 = A.u; A.u = u;
      const low = clamp((m.tgtY - (fyLow - 420)) / 380, 0, 1);
      lean += 0.08 + 0.2 * low;
      AO.fT = null; AO.nT = null; AO.handA = handA; AO.fistA = fistA; AO.lean = lean;
      if (A.kind === 'claw') clawAtk(m, A, u, p0, lean); else if (A.kind === 'drill') drillAtk(m, A, u, p0, lean, dt); else rocketAtk(m, A, u, p0, lean, dt);
      fT = AO.fT; nT = AO.nT; handA = AO.handA; fistA = AO.fistA; lean = AO.lean;
      if (u >= 1) { m.atk = null; if (A.kind !== 'rocket') m.atkN++; }
    }
    if (m.rocket) updateRocket(m, dt, inp);
    js.torso.set(lean); js.head.set(-lean * 0.6 + (m.atk ? -0.05 : 0.04 * Math.sin(m.t * 0.7)));
    // --- pernas (IK nos pés) ---
    r.get('pelvis').y = m.pelvisY;
    js.torso.update(dt); js.head.update(dt);
    r.get('torso').rot = js.torso.x; r.get('head').rot = js.head.x;
    solveLegs(m, dt, false);
    // --- braços (IK no espaço do modelo, alvo relativo ao tronco) ---
    const tAbs = pel.rot + js.torso.x;
    const sN = r.model('uN', 0, 0, m.tmp2), sNx = sN.x, sNy = sN.y;
    if (!nT && m.rocket) {                                          // punho voando: o braço fica esticado apontando pra ele
      const R = m.rocket, rx = (R.x - m.x) * face - sNx, ry = R.y - sNy, rd = Math.hypot(rx, ry) || 1, L = (LU_P + LL_P) * 0.96;
      nT = m.tmp; nT.x = sNx + rx / rd * L; nT.y = sNy + ry / rd * L; fistA = Math.atan2(ry, rx);
      lean += 0.1;
    }
    if (!nT) { nT = m.tmp; nT.x = sNx + 40 + Math.sin(m.t * 0.9) * 6 + (m.walking ? -30 * Math.sin(m.stepCount * PI + m.feet[0].t * PI) : 0); nT.y = sNy + 440 + m.breath * 6; fistA = 1.45; }
    armIK(m, sNx, sNy, nT.x, nT.y, LU_P, LL_P + FIST_L, js.uN, js.lN, tAbs, -1);
    js.fN.set(wrapA(fistA - (tAbs + js.uN.target + js.lN.target)));
    const sF = r.model('uF', 0, 0, m.tmp2), sFx = sF.x, sFy = sF.y;
    if (!fT) { fT = m.tmp; fT.x = sFx - 20 + Math.sin(m.t * 0.8 + 1) * 6 + (m.walking ? 30 * Math.sin(m.stepCount * PI + m.feet[0].t * PI) : 0); fT.y = sFy + 296 + m.breath * 6; }
    armIK(m, sFx, sFy, fT.x, fT.y, LU_X, LL_X, js.uF, js.lF, tAbs, -1);
    js.hF.set(handA);
    updJoints(m, dt);
    // roda do peito e broca
    m.wheelV = damp(m.wheelV, A ? 2.4 : m.walking ? 0.9 : 0.35, 2, dt); m.wheelRot += m.wheelV * dt;
    m.spinV = damp(m.spinV, (A && A.kind !== 'claw') || m.rocket ? 26 : 2.2, 4, dt); m.spin += m.spinV * dt;
    // âncoras dos golpes no mundo (na ponta de verdade, não no alvo)
    if (A && A.kind === 'claw') { r.world('hF', LH_X * 0.9, 10, m.tmp); m.biteO.x = m.tmp.x; m.biteO.y = m.tmp.y; }
    else if (A && A.kind === 'drill') { r.world('fN', FIST_L + 40, 0, m.tmp); m.biteO.x = m.tmp.x; m.biteO.y = m.tmp.y; }
    if (A && A.kind === 'claw' && A.u > 0.6 && A.u < 0.82) { r.world('hF', LH_X * 0.6, 0, m.tmp); m.dumpO.x = m.tmp.x; m.dumpO.y = m.tmp.y; }
    m.dumpO.tx = inp.dumpX !== undefined && inp.dumpX !== null ? inp.dumpX : m.x - face * 700;
    // efeitos do golpe
    fxAtk(m, dt);
  }
  const JK = ['uN', 'lN', 'fN', 'uF', 'lF', 'hF', 'thN', 'shN', 'ftN', 'thF', 'shF', 'ftF'];
  function updJoints(m, dt) {
    const js = m.js, r = m.rig, P = r.parts;
    for (let i = 0; i < JK.length; i++) js[JK[i]].update(dt);
    for (let i = 0; i < P.length; i++) { const p = P[i]; if (p.joint) p.rot = p.joint.x; }
    r.solve(m.x, 0, m.face, 1, 0);
  }
  function armIK(m, sx, sy, tx, ty, L1, L2, ju, jl, tAbs, bend) {
    const ik = E.ik2(sx, sy, tx, ty, L1, L2, bend, m.ikO);
    ju.set(wrapA(ik.a1 - tAbs)); jl.set(ik.rel);
    ju.target = clamp(ju.target, -PI, PI);
  }

  /* ---- passos ---- */
  function stepFeet(m, dt, rate) {
    const face = m.face, F = m.feet;
    for (let i = 0; i < 2; i++) {
      const f = F[i];
      if (!f.planted) {
        f.t += dt * rate / f.dur;
        const k = smooth(Math.min(1, f.t));
        f.x = lerp(f.x0, f.x1, k);
        const gy = lerp(f.y0, f.y1, k);
        f.y = gy; f.lift = Math.sin(PI * Math.min(1, f.t)) * (60 + Math.abs(f.y1 - f.y0) * 0.5);
        f.ang = lerp(f.ang, slopeAt(m, f.x1), 0.15);
        f.trk += (f.x1 - f.x0) * dt * rate / f.dur * 0.04;
        if (f.t >= 1) {
          f.planted = true; f.lift = 0; f.x = f.x1; f.y = floorAt(m, f.x); f.ang = slopeAt(m, f.x); m.swingIdx = -1; m.stepCount++;
          emit(m, 'stomp'); m.shakeK = 1; m.bob.kick(140);
          if (m.parts) { m.parts.puff(f.x + face * 30, f.y, 7, 70, DUST); m.parts.puff(f.x - face * 80, f.y, 4, 50, DUSTW); }
        }
      } else { f.y = damp(f.y, floorAt(m, f.x), 20, dt); }
      f.ph = ((Math.floor(f.trk) % 6) + 6) % 6;
    }
    if (m.swingIdx >= 0) return;
    // escolhe o pé mais atrasado em relação à casa dele
    const vdir = Math.abs(m.vx) > 4 ? Math.sign(m.vx) : 0;
    let best = -1, bestD = 0;
    for (let i = 0; i < 2; i++) {
      const f = F[i], home = m.x + face * f.off + vdir * 95, d = Math.abs(f.x - home);
      const need = vdir ? 70 : 34;
      if (d > need && d > bestD) { best = i; bestD = d; }
    }
    if (best >= 0) {
      const f = F[best];
      f.planted = false; f.t = 0; f.x0 = f.x; f.y0 = f.y;
      f.x1 = m.x + face * f.off + vdir * 130; f.y1 = floorAt(m, f.x1);
      f.dur = vdir ? 0.62 : 0.45; m.swingIdx = best;
    }
  }

  /* ---- golpes ---- */
  function startAtk(m, kind) {
    m.atk = { kind, t: 0, u: 0, dur: kind === 'claw' ? CYCLE_CLAW : kind === 'drill' ? CYCLE_DRILL : 0.62, hit: false };
    if (kind === 'rocket') { emit(m, 'roar'); m.flash = 0.5; }
  }
  const crossed = (p0, u, k) => p0 < k && u >= k;
  const AO = { fT: null, nT: null, handA: 0, fistA: 0, lean: 0 };
  const AT = { x: 0, y: 0 }, AT2 = { x: 0, y: 0 };
  function toModel(m, wx, wy, out) { out.x = (wx - m.x) * m.face; out.y = wy; return out; }
  function clawAtk(m, A, u, p0, lean) {
    // garra (braço esquerdo): sobe, crava, arrasta cavando, joga por cima do ombro pra trás
    const r = m.rig, tg = toModel(m, m.tgtX, m.tgtY, AT2), sh = r.model('uF', 0, 0, m.tmp2);
    const fT = AT; let handA = 1.2;
    if (u < 0.26) { const k = seg(u, 0, 0.26); fT.x = lerp(sh.x + 60, tg.x - 30, k); fT.y = lerp(sh.y + 200, tg.y - 300, k); handA = lerp(1.2, -0.6, k); lean -= 0.1 * k; }
    else if (u < 0.36) { const k = lin(u, 0.26, 0.36); fT.x = lerp(tg.x - 30, tg.x + 30, k * k); fT.y = lerp(tg.y - 300, tg.y + 40, k * k); handA = lerp(-0.6, 0.4, k); lean += 0.34 * k; }
    else if (u < 0.56) { const k = seg(u, 0.36, 0.56); fT.x = lerp(tg.x + 30, tg.x - 140, k); fT.y = lerp(tg.y + 40, tg.y - 10, k) + Math.sin(PI * k) * 30; handA = lerp(0.4, 1.9, k); lean += 0.34 - 0.2 * k; m.biteO.active = true; }
    else if (u < 0.8) { const k = seg(u, 0.56, 0.78); fT.x = lerp(tg.x - 140, sh.x - 220, k); fT.y = lerp(tg.y - 10, sh.y - 300, k); handA = lerp(1.9, -2.4, seg(u, 0.64, 0.8)); lean = lerp(lean + 0.14, -0.2, k); }
    else { const k = seg(u, 0.8, 1); fT.x = lerp(sh.x - 220, sh.x - 20, k); fT.y = lerp(sh.y - 300, sh.y + 300, k); handA = lerp(-2.4, 1.2, k); lean = lerp(-0.2, lean, k); }
    m.biteO.kind = 'claw'; m.biteO.r = 120; m.biteO.phase = u; m.biteO.deep = 0;
    if (crossed(p0, u, 0.355)) { emit(m, 'punch'); m.shakeK = 1; A.hit = true; m.js.torso.kick(0.4); if (m.parts) { m.parts.puff(m.tgtX, m.tgtY, 8, 80, DUSTW); m.parts.sparks(m.tgtX, m.tgtY, 10, SPARKO); } }
    if (m.biteO.active) m.load = Math.min(1, m.load + 0.06);
    if (crossed(p0, u, 0.7) && m.load > 0) emit(m, 'toss');
    if (u > 0.7 && u < 0.82) m.dumpO.active = m.load > 0.02;
    AO.fT = fT; AO.handA = handA; AO.lean = lean;
  }
  function drillAtk(m, A, u, p0, lean, dt) {
    const r = m.rig, tg = toModel(m, m.tgtX, m.tgtY, AT2), sh = r.model('uN', 0, 0, m.tmp2);
    const nT = AT; let fistA = 0;
    const dx = tg.x - sh.x, dy = tg.y - sh.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const reach = (LU_P + LL_P + FIST_L) * 0.97, dd = Math.min(d, reach);
    const ang = Math.atan2(uy, ux);
    if (u < 0.3) { const k = seg(u, 0, 0.3); nT.x = lerp(sh.x + 60, sh.x - ux * 40 - 30, k); nT.y = lerp(sh.y + 260, sh.y - uy * 40 + 140, k); fistA = lerp(1.3, ang, k); lean -= 0.22 * k; }
    else if (u < 0.38) { const k = lin(u, 0.3, 0.38); nT.x = lerp(sh.x - ux * 40 - 30, sh.x + ux * dd, k); nT.y = lerp(sh.y - uy * 40 + 140, sh.y + uy * dd, k); fistA = ang; lean += 0.3 * k; }
    else if (u < 0.8) { const k = seg(u, 0.38, 0.6), j = Math.sin(m.t * 61) * 5; nT.x = sh.x + ux * (dd + 30 * k) + j; nT.y = sh.y + uy * (dd + 30 * k) + j * 0.5; fistA = ang; lean += 0.3; m.biteO.active = true; }
    else { const k = seg(u, 0.8, 1); nT.x = lerp(sh.x + ux * dd, sh.x + 40, k); nT.y = lerp(sh.y + uy * dd, sh.y + 300, k); fistA = lerp(ang, 1.35, k); lean += 0.3 * (1 - k); }
    m.biteO.kind = 'drill'; m.biteO.r = 120; m.biteO.phase = lin(u, 0.38, 0.8); m.biteO.deep = 30 * seg(u, 0.38, 0.6);
    if (crossed(p0, u, 0.37)) { emit(m, 'punch'); m.shakeK = 1; m.js.torso.kick(-0.5); }
    if (crossed(p0, u, 0.4)) emit(m, 'drill');
    AO.nT = nT; AO.fistA = fistA; AO.lean = lean;
  }
  function rocketAtk(m, A, u, p0, lean, dt) {
    // carga: puxa o punho pra trás, chamas acendem; 'rocket' em u=1 (o punho sai voando)
    const r = m.rig, tg = toModel(m, m.tgtX, m.tgtY, AT2), sh = r.model('uN', 0, 0, m.tmp2);
    const nT = AT, dx = tg.x - sh.x, dy = tg.y - sh.y, ang = Math.atan2(dy, dx), k = seg(u, 0, 0.8);
    nT.x = lerp(sh.x + 60, sh.x - Math.cos(ang) * 60 - 20, k); nT.y = lerp(sh.y + 240, sh.y - Math.sin(ang) * 60 + 100, k);
    lean -= 0.25 * k;
    if (u >= 1 && !m.rocket) launch(m);
    AO.nT = nT; AO.fistA = ang; AO.lean = lean;
  }
  function launch(m) {
    const r = m.rig;
    r.world('fN', 0, 0, m.fistW);
    m.rocket = { x: m.fistW.x, y: m.fistW.y, vx: 0, vy: 0, ang: m.fistW.rot, state: 'out', t: 0, deep: 0, sx: m.fistW.x, sy: m.fistW.y };
    const R = m.rocket, a = Math.atan2(m.tgtY - R.y, m.tgtX - R.x);
    R.vx = Math.cos(a) * 900; R.vy = Math.sin(a) * 900; R.ang = a;
    emit(m, 'rocket'); m.shakeK = 1; m.flash = 0.8; m.js.torso.kick(-1.2);
    m.trail.update(0, R.x, R.y, 1, -Math.cos(a), -Math.sin(a)); m.trail.burst(10, 1);
  }
  function updateRocket(m, dt, inp) {
    const R = m.rocket, r = m.rig; R.t += dt;
    m.biteO.active = false;
    if (R.state === 'out') {
      const dx = m.tgtX - R.x, dy = m.tgtY - R.y, d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(1700, Math.hypot(R.vx, R.vy) + 2600 * dt);
      R.vx = damp(R.vx, dx / d * sp, 9, dt); R.vy = damp(R.vy, dy / d * sp, 9, dt);
      R.x += R.vx * dt; R.y += R.vy * dt; R.ang = Math.atan2(R.vy, R.vx);
      if (d < 40 || R.t > 2.2) { R.state = 'drill'; R.t = 0; R.dx = R.vx / (Math.hypot(R.vx, R.vy) || 1); R.dy = R.vy / (Math.hypot(R.vx, R.vy) || 1); R.hx = R.x; R.hy = R.y; emit(m, 'punch'); emit(m, 'drill'); m.shakeK = 1; m.flash = 0.6; if (m.parts) { m.parts.puff(R.x, R.y, 12, 110, DUSTW); m.parts.sparks(R.x, R.y, 30, SPARKO); } }
    } else if (R.state === 'drill') {
      const k = smooth(Math.min(1, R.t / 0.9));
      R.deep = 150 * k; R.x = R.hx + R.dx * R.deep + Math.sin(m.t * 70) * 6; R.y = R.hy + R.dy * R.deep + Math.cos(m.t * 63) * 4;
      m.biteO.active = true; m.biteO.kind = 'rocket'; m.biteO.r = 190; m.biteO.phase = Math.min(1, R.t / 1.1); m.biteO.deep = R.deep;
      m.biteO.x = R.x; m.biteO.y = R.y;
      if ((R.t * 8 | 0) !== ((R.t - dt) * 8 | 0)) m.shakeK = Math.max(m.shakeK, 0.6);
      if (m.parts) {
        const n = (R.t * 50 | 0) - ((R.t - dt) * 50 | 0);
        for (let i = 0; i < n; i++) riceOut(m, R.x - R.dx * 60, R.y - R.dy * 60, Math.atan2(-R.dy, -R.dx) + (Math.random() - 0.5) * 1.6, 300 + Math.random() * 500);
        if (n) m.parts.sparks(R.x, R.y, 2, SPARKO);
      }
      if (R.t >= 1.1) { R.state = 'back'; R.t = 0; m.parts && m.parts.puff(R.x, R.y, 8, 90, DUSTW); }
    } else {
      r.world('lN', LL_P, 0, m.tmp);
      const dx = m.tmp.x - R.x, dy = m.tmp.y - R.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(1500, 400 + R.t * 2200);
      R.vx = damp(R.vx, dx / d * sp, 10, dt); R.vy = damp(R.vy, dy / d * sp, 10, dt);
      R.x += R.vx * dt; R.y += R.vy * dt;
      const va = Math.atan2(R.vy, R.vx); R.ang = d > 320 ? va : R.ang + wrapA(m.tmp.rot - R.ang) * Math.min(1, dt * 10);
      if (d < 36 || R.t > 2.5) { m.rocket = null; m.rocketCool = 0.8; emit(m, 'return'); m.shakeK = 0.7; m.js.uN.kick(-2); m.flash = 0.3; if (m.parts) m.parts.sparks(m.tmp.x, m.tmp.y, 14, SPARKO); return; }
    }
    // chamas e linhas de velocidade enquanto voa
    if (R.state !== 'drill') {
      const bx = R.x - Math.cos(R.ang) * 40, by = R.y - Math.sin(R.ang) * 40;
      m.trail.update(dt, bx, by, 1, -Math.cos(R.ang), -Math.sin(R.ang));
      m.speed.on = true; m.speed.x = R.x; m.speed.y = R.y; m.speed.dir = R.ang;
      if (m.parts) { FIREO.x = bx; FIREO.y = by; for (let i = 0; i < 2; i++) { FIREO.vx = -Math.cos(R.ang) * 300 + (Math.random() - 0.5) * 120; FIREO.vy = -Math.sin(R.ang) * 300 + (Math.random() - 0.5) * 120; FIREO.c = i ? PAL.goldL : PAL.ora; FIREO.w = 26 + Math.random() * 18; m.parts.add(FIREO); } }
    } else m.trail.update(dt, R.x, R.y, 0, 0, -1);
  }
  function riceOut(m, x, y, a, s) {
    GRAINO.x = x; GRAINO.y = y; GRAINO.vx = Math.cos(a) * s; GRAINO.vy = Math.sin(a) * s; GRAINO.c = RICEC[(Math.random() * 3) | 0];
    GRAINO.w = 7 + Math.random() * 6; GRAINO.h = GRAINO.w * 0.5; GRAINO.r = Math.random() * TAU;
    m.parts.add(GRAINO);
  }
  function fxAtk(m, dt) {
    if (!m.parts) return;
    const A = m.atk, b = m.biteO;
    if (A && b.active && A.kind === 'drill') {
      const n = ((A.t * 40) | 0) - (((A.t - dt) * 40) | 0);
      for (let i = 0; i < n; i++) riceOut(m, b.x, b.y, -PI / 2 - m.face * (0.4 + Math.random() * 0.8), 250 + Math.random() * 380);
      if (n && Math.random() < 0.5) m.parts.sparks(b.x, b.y, 3, SPARKO);
    }
    if (A && b.active && A.kind === 'claw') {
      const n = ((A.t * 30) | 0) - (((A.t - dt) * 30) | 0);
      for (let i = 0; i < n; i++) riceOut(m, b.x, b.y, -PI / 2 - m.face * Math.random() * 0.6, 120 + Math.random() * 200);
    }
    // arroz jogado pra trás, em arco balístico até dumpX
    if (m.dumpO.active && m.load > 0) {
      const d = m.dumpO, T = 1.25, gy = floorAt(m, d.tx), n = 5;
      for (let i = 0; i < n; i++) {
        const tx = d.tx + (Math.random() - 0.5) * 160, Tt = T * (0.85 + Math.random() * 0.3);
        GRAINO.x = d.x + (Math.random() - 0.5) * 30; GRAINO.y = d.y + (Math.random() - 0.5) * 30;
        GRAINO.vx = (tx - GRAINO.x) / Tt; GRAINO.vy = (gy - GRAINO.y - 0.5 * 900 * Tt * Tt) / Tt;
        GRAINO.c = RICEC[i % 3]; GRAINO.w = 8 + Math.random() * 7; GRAINO.h = GRAINO.w * 0.5; GRAINO.r = Math.random() * TAU;
        m.parts.add(GRAINO);
      }
      m.load = Math.max(0, m.load - dt * 6);
    }
  }

  /* ======================================================================
     combinação (anime): cada máquina chega, gira pro lugar e trava
     ====================================================================== */
  // por peça: grupo da combinação e de onde ela vem (veículo inteiro rodando/voando)
  // vehicle: [x de largada (frente = +), y acima do chão, x antes do pulo, giro extra]
  const PIECES = {
    pelvis: ['nucleo'], thN: ['nucleo'], thF: ['nucleo'], shN: ['nucleo'], shF: ['nucleo'], kneeN: ['nucleo'], kneeF: ['nucleo'], hipN: ['nucleo'],
    ftN: ['pernas', 'bootT', -1700, 0, -300, 0, 0], ftF: ['pernas', 'bootF', 1700, 0, 300, 0, 0],
    torso: ['tronco', 'torso', -1700, 0, -620, 0, 0],
    uF: ['bracos', 'escBoom', -1500, -700, -700, 0, 0], lF: ['bracos', 'escStick', -1500, -700, -700, 0, 0], hF: ['bracos', 'escBucket', -1500, -700, -700, 0, 0], pauF: ['bracos', 'escHouse', -1500, -700, -700, 0, 0],
    elbF: ['bracos'], wrF: ['bracos'],
    uN: ['bracos', 'pacBoom', 1600, -900, 700, 0, 0.25], lN: ['bracos', 'pacDip', 1600, -900, 700, 0, 0.25], pauN: ['bracos', 'pacHouse', 1600, -900, 700, 0, 0.25], elbN: ['bracos'],
    chest: ['peito', 'wheel', 1600, 0, 500, 0, 0],
    fN: ['punho', 'disc', 900, -1400, 500, 0, 0],
    head: ['cabeca', null, 0, -1500, 0, 0, 0], hat: ['cabeca', null, 0, -1700, 0, 0, 0.45],
  };
  // donor layout: onde cada peça fica DENTRO do veículo (pra chegar montado). Pacabo/escav: peças na posição da máquina
  const VEH = {};
  function vehicleFrame(name, out) {
    // matriz sprite-do-veículo -> osso inverso: frame do osso quando o veículo está "inteiro" na origem
    const tb = TB[name]; if (!tb) { out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 1; out[4] = 0; out[5] = 0; return out; }
    return inv(tb, out);
  }
  const ESC_PIN = { escBoom: null, escStick: null, escBucket: null, escHouse: null };
  function escVehicle(name, out) {
    // peças da escavadeira: posição de cada osso no modelo da escav (pinos lidos do rig doador), escala do robô
    const m = donor('escav', 1);
    const part = name === 'escBoom' ? 'boom' : name === 'escStick' ? 'stick' : name === 'escBucket' ? 'bucket' : 'house';
    if (!m || !m.rig) return vehicleFrame(name, out);
    const o = m.rig.world(part, 0, 0, VEH);
    const c = Math.cos(o.rot), s = Math.sin(o.rot), tb = TB[name], k = 1 / tb[0];
    // sprite local da peça (em escala S_X) -> veículo (escala S_X): rot + pino; depois osso <- sprite = tb  => frame do osso = Rv * inv(tb)
    RV[0] = c; RV[1] = s; RV[2] = -s; RV[3] = c; RV[4] = o.x * S_X; RV[5] = o.y * S_X;
    void k; void ESC_PIN;
    return mul(RV, inv(tb, ITB), out);
  }
  const RV = [1, 0, 0, 1, 0, 0], ITB = [1, 0, 0, 1, 0, 0];
  const Mtmp = [1, 0, 0, 1, 0, 0], Mtmp2 = [1, 0, 0, 1, 0, 0], Mfin = [1, 0, 0, 1, 0, 0];
  const DEC_A = { x: 0, y: 0, a: 0, sx: 1, sy: 1 }, DEC_B = { x: 0, y: 0, a: 0, sx: 1, sy: 1 };
  function decompose(M, o) {
    o.x = M[4]; o.y = M[5]; o.sx = Math.hypot(M[0], M[1]); o.a = Math.atan2(M[1], M[0]);
    const det = M[0] * M[3] - M[1] * M[2]; o.sy = det / (o.sx || 1e-9); return o;
  }

  function updateCombine(m, dt, inp) {
    const r = m.rig, js = m.js;
    const ct0 = m.ct; m.ct += dt; const ct = m.ct;
    m.dark = Math.min(1, ct / 0.8);
    // pose: em pé, braços levantam no fim
    m.vx = 0; m.walking = false;
    for (let i = 0; i < 2; i++) { const f = m.feet[i]; f.planted = true; f.lift = 0; f.y = floorAt(m, f.x); }
    const fyLow = Math.max(m.feet[0].y, m.feet[1].y);
    m.pelvisY = fyLow - STAND + m.breath * 2;
    const pose = seg(ct, 6.95, 7.35);
    r.get('pelvis').y = m.pelvisY; r.get('pelvis').rot = 0;
    js.torso.set(-0.06 * pose); js.head.set(-0.12 * pose); js.torso.update(dt); js.head.update(dt);
    r.get('torso').rot = js.torso.x; r.get('head').rot = js.head.x;
    solveLegs(m, dt, false);
    // braços: pendurados, depois pose de vitória (punho-broca pro alto, garra aberta)
    js.uN.set(lerp(1.25, -1.15, pose)); js.lN.set(lerp(-0.55, -0.35, pose)); js.fN.set(lerp(-0.2, 0.1, pose));
    js.uF.set(lerp(1.45, -2.2, pose)); js.lF.set(lerp(-0.7, 0.5, pose)); js.hF.set(lerp(1.2, -0.4, pose));
    updJoints(m, dt);
    m.wheelV = ct > 5.7 ? 2.5 : 0.6; m.wheelRot += m.wheelV * dt; m.spinV = ct > 6.2 ? 8 : 2; m.spin += m.spinV * dt;
    m.eyeGold = ct > 6.95 ? 1 : 0;
    // passos da combinação
    let si = 0; for (let i = 0; i < STEPS.length; i++) if (ct >= STEPS[i][1]) si = i;
    const S = STEPS[si]; m.combine.step = S[0]; m.combine.phase = clamp(ct / COMBINE_T, 0, 1);
    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i], was = m.lock[i];
      m.lock[i] = clamp((ct - s[1]) / (s[2] - s[1]), 0, 1);
      if (was < 1 && m.lock[i] >= 1 && i > 0 && i < STEPS.length - 1) lockFx(m, s[0]);
    }
    // câmera sugerida
    const cam = m.combine;
    focusFor(m, S[0], cam);
    // kome pula pra cabeça; pose final
    m.komeJump = seg(ct, 0.55, 1.0);
    if (crossed(ct0, ct, 7.0)) { emit(m, 'roar'); m.flash = 1; m.shakeK = 1; if (m.parts) m.parts.confetti ? 0 : 0; }
    m.burst = seg(ct, 7.0, 7.3); m.title = seg(ct, 7.15, 7.3);
    if (crossed(ct0, ct, 7.15)) { m.shakeK = 1; if (m.parts) { r.world('chest', 0, 0, m.tmp); m.parts.sparks(m.tmp.x, m.tmp.y - 300, 40, SPARKO); } }
    if (ct >= COMBINE_T) { m.mode = 'normal'; emit(m, 'combined'); m.title = 1; m.burst = 1; }
    m.biteO.active = false; m.dumpO.active = false;
  }
  function focusFor(m, step, cam) {
    const r = m.rig, t = m.tmp2;
    let part = 'pelvis', z = 0.3, ly = 0;
    if (step === 'ceu') { part = 'pelvis'; z = 0.55; ly = 380; }
    else if (step === 'nucleo') { part = 'pelvis'; z = 0.34; }
    else if (step === 'pernas') { part = 'ftN'; z = 0.3; }
    else if (step === 'tronco') { part = 'torso'; z = 0.3; ly = -100; }
    else if (step === 'bracos') { part = 'torso'; z = 0.24; ly = -150; }
    else if (step === 'peito') { part = 'chest'; z = 0.42; }
    else if (step === 'punho') { part = 'fN'; z = 0.44; }
    else if (step === 'cabeca') { part = 'head'; z = 0.42; ly = -90; }
    else { part = 'torso'; z = 0.2; ly = -60; }
    r.world(part, 0, ly, t);
    if (step === 'ceu') { t.x = m.x; t.y = floorAt(m, m.x) - 60; }
    cam.fx = t.x; cam.fy = t.y; cam.zoom = z;
  }
  function lockFx(m, step) {
    emit(m, 'lock'); m.flash = Math.max(m.flash, 0.7); m.shakeK = Math.max(m.shakeK, 0.8);
    const r = m.rig, t = m.tmp2;
    const pts = step === 'nucleo' ? ['pelvis', 'shN', 'shF'] : step === 'pernas' ? ['ftN', 'ftF'] : step === 'tronco' ? ['torso'] : step === 'bracos' ? ['uN', 'uF'] : step === 'peito' ? ['chest'] : step === 'punho' ? ['fN'] : ['head'];
    for (let i = 0; i < pts.length; i++) {
      r.world(pts[i], 0, 0, t);
      if (m.parts) { m.parts.sparks(t.x, t.y, 26, SPARKO); m.parts.puff(t.x, t.y, 5, 60, STEAM); }
    }
    if (step === 'pernas' && m.parts) for (let i = 0; i < 2; i++) m.parts.puff(m.feet[i].x, m.feet[i].y, 8, 80, DUST);
  }

  /* ======================================================================
     desenho
     ====================================================================== */
  const ORDER = [];
  function drawPartsCombine(g, m) {
    const r = m.rig, ct = m.ct;
    if (!ORDER.length || ORDER.rig !== r) { ORDER.length = 0; for (const p of r.parts) ORDER.push(p); ORDER.sort((a, b) => a.z - b.z || a.idx - b.idx); ORDER.rig = r; }
    const gyM = floorAt(m, m.x);
    for (let i = 0; i < ORDER.length; i++) {
      const p = ORDER[i];
      if (!p.vis || !p.draw) continue;
      const pc = PIECES[p.name], si = pc ? stepFor(m, pc[0]) : 0, u = si >= 0 ? m.lock[si] : 1;
      if (si > 0 && u <= 0) continue;
      g.save();
      if (u >= 1 || !pc) { tf(g, p.m); p.draw(g, p, r, m.t); g.restore(); continue; }
      if (!pc[1] && (pc.length < 3)) {
        // núcleo / pistões: aparecem crescendo com brilho
        if (p.a) { if (u < 0.7) { g.restore(); continue; } tf(g, p.m); p.draw(g, p, r, m.t); g.restore(); continue; }
        const k = backOut(u);
        tf(g, p.m); g.scale(Math.max(0.01, k), Math.max(0.01, k)); p.draw(g, p, r, m.t); g.restore(); continue;
      }
      // peça que chega: frame inicial (veículo inteiro) -> frame final (osso)
      const st = STEPS[si], T = st[2] - st[1], tt = u * T;
      decompose(p.m, DEC_B);
      if (pc[1]) {
        if (pc[1].indexOf('esc') === 0) escVehicle(pc[1], Mtmp); else vehicleFrame(pc[1], Mtmp);
      } else { Mtmp[0] = DEC_B.sx; Mtmp[1] = 0; Mtmp[2] = 0; Mtmp[3] = DEC_B.sy; Mtmp[4] = 0; Mtmp[5] = 0; }
      // veículo: andando (ou voando) até o ponto de pulo, depois pulo girando até o lugar
      const drive = 0.45, du = Math.min(1, u / drive), jk = u <= drive ? 0 : (u - drive) / (1 - drive);
      const vx0 = pc[2], vy0 = pc[3], vx1 = pc[4], vyLift = vy0 < 0 ? vy0 * 0.25 : 0;
      const vxNow = lerp(vx0, vx1, 1 - (1 - du) * (1 - du)), vyNow = gyM + lerp(vy0, vyLift, du) + (vy0 === 0 ? -Math.abs(Math.sin(tt * 18)) * 8 : Math.sin(tt * 3) * 20);
      let roll = 0;
      if (pc[1] === 'wheel') { roll = vxNow / WHEEL_R; Mtmp2[0] = 1; Mtmp2[1] = 0; Mtmp2[2] = 0; Mtmp2[3] = 1; Mtmp2[4] = vxNow; Mtmp2[5] = vyNow - WHEEL_R; }
      else { Mtmp2[0] = 1; Mtmp2[1] = 0; Mtmp2[2] = 0; Mtmp2[3] = 1; Mtmp2[4] = vxNow; Mtmp2[5] = vyNow; }
      mul(Mtmp2, Mtmp, Mfin);
      decompose(Mfin, DEC_A);
      DEC_A.a += roll;
      if (jk <= 0) { g.translate(DEC_A.x, DEC_A.y); g.rotate(DEC_A.a); g.scale(DEC_A.sx, DEC_A.sy); }
      else {
        const k = smooth(jk), kp = backOut(jk), lift = -Math.sin(PI * Math.min(1, jk)) * (pc[1] === 'wheel' ? 420 : 300);
        const spin = pc[6] ? pc[6] * TAU * (1 - k) : 0;
        const x = lerp(DEC_A.x, DEC_B.x, k), y = lerp(DEC_A.y, DEC_B.y, kp) + lift;
        const a = DEC_A.a + wrapA(DEC_B.a - DEC_A.a) * k + spin;
        g.translate(x, y); g.rotate(a); g.scale(lerp(DEC_A.sx, DEC_B.sx, k), lerp(DEC_A.sy, DEC_B.sy, k));
      }
      p.draw(g, p, r, m.t);
      g.restore();
    }
  }

  const RDO = { face: 1, t: 0 };
  function draw(g, m) {
    const t = m.t, f = m.face;
    const tr = g.getTransform(), e = Math.hypot(tr.a, tr.b);
    curLv = lvFor(e);
    const z0 = Draw.zoom, m0 = Draw.minPx;
    Draw.lod(e / (window.devicePixelRatio || 1), Math.max(m0, 0.55));
    // raios coloridos atrás (pose final)
    if (m.burst > 0.01) drawBurst(g, m);
    m.steamA.draw(g); m.steamB.draw(g);
    // sombra
    const gx = m.x, gy = floorAt(m, m.x);
    Draw.shadow(g, gx, gy + 6, 300, 22, 0.22);
    if (m.mode === 'combine' && m.ct < 1.0) drawKomeIntro(g, m);
    g.save(); g.translate(m.x, 0); g.scale(f, 1);
    if (m.mode === 'combine') drawPartsCombine(g, m);
    else { RDO.t = t; m.rig.draw(g, 0, 0, RDO); m.rig.solve(m.x, 0, m.face, 1, 0); }
    g.restore();
    if (m.rocket) drawRocket(g, m);
    if (m.flash > 0.02 && m.mode === 'combine') drawKira(g, m);
    glowIn(g, m);
    if (m.title > 0.01) drawTitle(g, m);
    Draw.lod(z0, m0);
  }

  /* ---- peças vivas ---- */
  function drawTorsoLive(g) {
    // fendas luminosas e chapas de ligação por cima do caminhão
    Draw.box(g, -62, -250, 124, 30, C_TRIM, { r: 8 });
    seam(g, -150, -6, -60, -6); seam(g, 60, -6, 150, -6);
  }
  function drawChest(g, m) {
    g.save(); g.scale(0.9, 1);
    Draw.circle(g, 0, 0, WHEEL_R * 0.98, sh(PAL.rustD, -0.3), { hi: false, shade: false, ol: 4 });
    g.save(); g.rotate(m.wheelRot); blit(g, SPR.wheel); g.restore();
    // calota dourada com pata de shiba
    Draw.circle(g, 0, 0, 30, C_TRIM, { ol: 3 });
    g.fillStyle = PAL.goldD; g.beginPath(); g.ellipse(0, 6, 11, 9, 0, 0, TAU); g.fill();
    for (let i = 0; i < 4; i++) { const a = -PI / 2 + (i - 1.5) * 0.55; g.beginPath(); g.arc(Math.cos(a) * 18, 4 + Math.sin(a) * 18, 4.5, 0, TAU); g.fill(); }
    g.restore();
  }
  function drawHead(g, m) {
    blit(g, SPR.head);
    const cx = HEAD_C[0], cy = HEAD_C[1];
    // cabine com o Kome pilotando
    g.save(); Draw.rrect(g, WIN.x, WIN.y, WIN.w, WIN.h, 10); g.clip();
    g.fillStyle = m.night > 0.3 ? PAL.goldL : PAL.skyL; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    g.fillStyle = 'rgba(111,174,203,.35)'; g.fillRect(WIN.x, WIN.y + WIN.h * 0.6, WIN.w, WIN.h * 0.4);
    if (m.mode !== 'combine' || m.ct > 6.5) { KOMEO.pal = m.pilot; KOMEO.face = 1; E.drawShiba(g, WIN.x + WIN.w * 0.45, WIN.y + WIN.h + 10, 'drive', m.t, KOMEO); }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(WIN.x + 52, WIN.y); g.lineTo(WIN.x + 64, WIN.y); g.lineTo(WIN.x + 40, WIN.y + WIN.h); g.lineTo(WIN.x + 28, WIN.y + WIN.h); g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = LINE; g.lineWidth = 4; Draw.rrect(g, WIN.x, WIN.y, WIN.w, WIN.h, 10); g.stroke();
    // olhos (piscam; ciano normal, dourado no golpe)
    const on = m.mode === 'combine' ? (m.ct > 6.9 ? 1 : 0) : 1;
    const open = m.blink > 0 ? 0.15 : 1, col = m.eyeGold > 0.5 ? C_EYEG : C_EYE;
    eye(g, cx + 60, cy - 13, 25, 18 * open, col, on);
    eye(g, cx - 33, cy - 14, 15, 16 * open, col, on);
  }
  const KOMEO = { scale: 1.05, shadow: false, pal: 'kome', face: 1 };
  function eye(g, x, y, rx, ry, col, on) {
    if (on <= 0) { g.fillStyle = sh(PAL.steelD, -0.4); g.beginPath(); g.ellipse(x, y, rx, Math.max(2, ry * 0.5), 0, 0, TAU); g.fill(); return; }
    g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, Math.max(2, ry), 0, 0, TAU); g.fill();
    g.fillStyle = sh(col, 0.4); g.beginPath(); g.ellipse(x, y + ry * 0.2, rx * 0.6, Math.max(1.5, ry * 0.55), 0, 0, TAU); g.fill();
    g.fillStyle = sh(col, -0.35); g.beginPath(); g.ellipse(x - rx * 0.05, y + ry * 0.05, rx * 0.42, Math.max(1.5, ry * 0.5), 0, 0, TAU); g.fill();
    if (ry > 5) { g.fillStyle = PAL.white; g.beginPath(); g.arc(x + rx * 0.3, y - ry * 0.38, Math.min(rx, ry) * 0.36, 0, TAU); g.fill();
      g.beginPath(); g.arc(x - rx * 0.35, y + ry * 0.35, Math.min(rx, ry) * 0.16, 0, TAU); g.fill(); }
  }
  function drawHatLive(g, m) {
    blit(g, SPR.hat);
    // orelhas-antena furando o chapéu
    ear(g, 70, -40, 1, m); ear(g, -96, -34, 0.8, m);
  }
  function ear(g, x, y, k, m) {
    const w = 46 * k, h = 96 * k;
    Draw.poly(g, [[x - w, y + 10], [x + w * 0.2, y - h], [x + w, y + 10]], PAL.ora, { shade: PAL.oraD, hi: PAL.oraL });
    Draw.poly(g, [[x - w * 0.5, y + 4], [x + w * 0.15, y - h * 0.62], [x + w * 0.55, y + 4]], PAL.cream, { ol: 0 });
    Draw.beam(g, [[x + w * 0.2, y - h], [x + w * 0.2 + 6, y - h - 44 * k]], 5, PAL.steelD, NOHI);
    Draw.light(g, x + w * 0.2 + 6, y - h - 48 * k, 8 * k, k === 1 ? PAL.red : PAL.goldL, 0.5 + 0.5 * Math.sin(m.t * 4 + k * 3), LIGHTO);
  }
  const LIGHTO = { halo: 3.5, ol: 2 };
  function drawBoot(g, m, far) {
    // pé = o veículo em pé sobre as rodas; tornozelo dourado preso em cima
    g.save(); tf(g, far ? TB.bootF : TB.bootT); blit(g, far ? SPR.bootF : SPR.bootT, far ? 1 : 0); g.restore();
    Draw.box(g, -34, -18, 68, 40, far ? sh(C_FRAME, -0.2) : C_FRAME, { r: 8 });
    Rig.pin(g, 0, 0, 20, { col: far ? PAL.steelD : PAL.steel });
  }
  function drawClaw(g, m) {
    g.save(); tf(g, TB.escBucket); blit(g, SPR.escBucket, 1); g.restore();
    if (m.load > 0.05) { Rig.mound(g, LH_X * 0.45, 26, 26 * Math.min(1, m.load + 0.3), 22 * m.load); }
    Rig.pin(g, 0, 0, 14);
  }
  function drawFist(g, m, flying) {
    blit(g, SPR.drum);
    // disco do tatuzão girando (de lado, achatado) + ponta cônica em espiral
    g.save(); g.translate(62, 0);
    g.fillStyle = LINE; g.beginPath(); g.ellipse(0, 0, DISC_R * 0.32 + 4, DISC_R + 4, 0, 0, TAU); g.fill();
    g.save(); g.scale(0.3, 1); g.rotate(m.spin); blit(g, SPR.disc); g.restore();
    g.fillStyle = 'rgba(59,40,24,.22)'; g.beginPath(); g.ellipse(0, 0, DISC_R * 0.3, DISC_R, 0, PI * 0.05, PI * 0.95); g.fill();
    blit(g, CONES[((m.spin * 6) | 0) & 3]);
    g.restore();
    Rig.pin(g, 0, 0, 16);
  }
  const CONES = [SPR.cone0, SPR.cone1, SPR.cone2, SPR.cone3];
  function drawSocket(g, m) {
    Draw.circle(g, 6, 0, 40, PAL.steelD, { ol: 3 });
    Draw.light(g, 14, 0, 22, PAL.ora, 0.6 + 0.4 * Math.sin(m.t * 30), LIGHTO);
  }
  function drawRocket(g, m) {
    const R = m.rocket, a = R.ang, flying = R.state !== 'drill';
    m.trail.draw(g);
    g.save(); g.translate(R.x, R.y); g.rotate(a);
    if (Math.cos(a) < 0) g.scale(1, -1);
    g.scale(1.3, 1.3);
    if (flying && R.state === 'out') {
      // linhas de velocidade e labareda
      const sp = Math.min(1, Math.hypot(R.vx, R.vy) / 1400);
      g.strokeStyle = 'rgba(255,250,238,.85)'; g.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const h = ((i * 97.13) % 1) * 2 - 1, y = h * 150, len = 220 + ((i * 53.7) % 1) * 380, x0 = -90 - ((m.t * 2400 + i * 137) % 500);
        g.lineWidth = 5 + (i % 3) * 3; g.globalAlpha = 0.35 + 0.5 * sp; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 - len * sp, y); g.stroke();
      }
      g.globalAlpha = 1;
      const fl = 1 + 0.25 * Math.sin(m.t * 60), L = 230 * fl * (0.4 + 0.6 * sp);
      flame(g, -24, 66, L, PAL.red); flame(g, -24, 50, L * 0.78, PAL.ora); flame(g, -24, 30, L * 0.5, PAL.goldL);
    }
    drawFist(g, m, 1);
    g.restore();
  }
  function flame(g, x, w, L, col) {
    g.fillStyle = col; g.strokeStyle = LINE; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, -w); g.quadraticCurveTo(x - L * 0.5, -w * 0.9, x - L, 0); g.quadraticCurveTo(x - L * 0.5, w * 0.9, x, w); g.closePath();
    if (col === PAL.red) g.stroke();
    g.fill();
  }
  function drawBurst(g, m) {
    // raios coloridos (estouro de anime) atrás do robô
    const r = m.rig; r.world('chest', 0, 0, m.tmp2);
    const cx = m.tmp2.x, cy = m.tmp2.y - 60, k = m.burst, R = 2200 * smooth(k), n = 18, rot = m.t * 0.25;
    const cols = BURST;
    g.save(); g.globalAlpha = 0.62 * Math.min(1, k * 1.5);
    for (let i = 0; i < n; i++) {
      const a0 = rot + i * TAU / n, a1 = a0 + TAU / n * 0.55;
      g.fillStyle = cols[i % cols.length];
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); g.closePath(); g.fill();
    }
    g.globalAlpha = Math.min(1, k * 1.5);
    const rr = 260 + 40 * Math.sin(m.t * 6);
    Draw.light(g, cx, cy, rr * 0.4, PAL.goldL, 1, BURSTL);
    g.restore();
  }
  const BURST = [PAL.gold, PAL.ora, PAL.red, PAL.pink, PAL.goldL, PAL.water];
  const BURSTL = { halo: 5, ol: 0 };
  function drawKira(g, m) {
    // estrela de brilho no último encaixe
    const r = m.rig, ct = m.ct; let si = 1;
    for (let i = 1; i < STEPS.length - 1; i++) if (ct >= STEPS[i][2]) si = i;
    const nm = STEPS[si][0], part = nm === 'nucleo' ? 'pelvis' : nm === 'pernas' ? 'ftN' : nm === 'tronco' ? 'torso' : nm === 'bracos' ? 'uN' : nm === 'peito' ? 'chest' : nm === 'punho' ? 'fN' : 'head';
    r.world(part, 0, 0, m.tmp2);
    const k = m.flash, s = 60 + 340 * k;
    g.save(); g.translate(m.tmp2.x, m.tmp2.y); g.rotate(m.t * 2); g.globalAlpha = Math.min(1, k * 1.4);
    g.fillStyle = PAL.cream;
    for (let j = 0; j < 2; j++) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * PI / 4 + j * PI / 8, rr = i % 2 ? s * 0.16 : s * (j ? 0.55 : 1); if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); }
    g.restore();
  }
  function drawTitle(g, m) {
    // "KOME-OH!" carimbado (nunca espelhado: desenhado no mundo, fora do flip)
    const r = m.rig; r.world('hat', 0, -150, m.tmp2);
    const k = m.title, pop = m.mode === 'combine' ? lerp(2.6, 1, backOut(k)) : 1;
    const x = m.tmp2.x, y = m.tmp2.y - 120;
    g.save(); g.translate(x, y); g.rotate(-0.06); g.scale(pop, pop);
    TITLE.alpha = Math.min(1, k * 1.2);
    Draw.text(g, 'KOME-OH!', 0, 0, TITLE);
    g.restore();
  }
  const TITLE = { size: 190, col: PAL.goldL, stroke: LINE, sw: 34, weight: 900, shadow: 16, alpha: 1 };
  function drawKomeIntro(g, m) {
    // o Kome no chão, chamando as máquinas, e pulando pra cabeça
    const ct = m.ct, j = m.komeJump, x = m.x, y = floorAt(m, x) - j * j * 1600;
    KIO.face = m.face;
    E.drawShiba(g, x, y, j > 0 ? 'jump' : ct > 0.25 ? 'cheer' : 'point', m.t, KIO);
  }
  const KIO = { scale: 1, shadow: true, pal: 'kome', face: 1 };

  /* ---- luzes (noite): só halos aditivos (o desenho da peça já tem a lâmpada) ---- */
  const halos = new Map();
  function haloCv(col) {
    let cv = halos.get(col);
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 1, 32, 32, 32);
      gr.addColorStop(0, U.rgba(col, 0.9)); gr.addColorStop(0.25, U.rgba(col, 0.45)); gr.addColorStop(0.6, U.rgba(col, 0.12)); gr.addColorStop(1, U.rgba(col, 0));
      c.fillStyle = gr; c.fillRect(0, 0, 64, 64); halos.set(col, cv);
    }
    return cv;
  }
  function halo(g, x, y, r, col, a) {
    if (a <= 0.01) return;
    g.globalAlpha = Math.min(1, a); g.drawImage(haloCv(col), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
  }
  function glowIn(g, m) {
    const n = m.night, r = m.rig, t = m.tmp2, cb = m.mode === 'combine', ct = m.ct;
    const k = Math.max(n, m.dark * 0.85);
    g.globalCompositeOperation = 'lighter';
    if (!cb || ct > 6.9) {
      const col = m.eyeGold > 0.5 ? C_EYEG : C_EYE, a = 0.25 + 0.75 * k;
      r.world('head', HEAD_C[0] + 58, HEAD_C[1] - 13, t); halo(g, t.x, t.y, 90, col, a);
      r.world('head', HEAD_C[0] - 35, HEAD_C[1] - 14, t); halo(g, t.x, t.y, 64, col, a * 0.8);
    }
    if (k > 0.05) {
      if (!cb || ct > 6.95) { r.world('head', WIN.x + WIN.w / 2, WIN.y + WIN.h / 2, t); halo(g, t.x, t.y, 110, PAL.goldL, k * 0.55); }
      const sk = k * (0.75 + 0.25 * Math.sin(m.t * 3));
      if (!cb || ct > 2.9) for (let i = 0; i < SEAMS.length; i++) { const s = SEAMS[i]; r.world(s[0], s[1], s[2], t); halo(g, t.x, t.y, s[3], C_SEAM, sk * 0.7); }
      if (!cb || ct > 6.9) for (let i = 0; i < 2; i++) { r.world('hat', i ? -78 : 75, i ? -133 : -152, t); halo(g, t.x, t.y, 50, i ? PAL.goldL : PAL.red, k * (0.5 + 0.5 * Math.sin(m.t * 4 + i * 3))); }
    }
    g.globalCompositeOperation = 'source-over';
  }
  const SEAMS = [['thN', LT * 0.42, -47, 90], ['thF', LT * 0.42, -47, 70], ['shN', LS * 0.45, 32, 90], ['shF', LS * 0.45, 32, 70], ['pelvis', -70, 18, 70], ['pelvis', 70, 18, 70], ['torso', -105, -6, 80], ['torso', 105, -6, 80]];
  function glow(g, m) { glowIn(g, m); }

  function bite(m) { return m.biteO; }
  function dump(m) { return m.dumpO; }
  function seat(m) { return m.seatO; }
  // prebake(nível 0|1|2): assa todas as peças (evita o engasgo do 1º quadro)
  function prebake(lv) {
    const keep = curLv; curLv = lv === undefined ? 1 : lv;
    for (const k in SPR) { spr(SPR[k], 0); }
    spr(SPR.bootF, 1); spr(SPR.shinF, 1); spr(SPR.thighF, 1); spr(SPR.escBoom, 1); spr(SPR.escStick, 1); spr(SPR.escBucket, 1); spr(SPR.escHouse, 1); spr(SPR.torso, 2);
    curLv = keep;
  }

  /* ---- horizonte do Pátio (turma 16, Kome-Oh em Série): robôs gigantes de linha de montagem cavando atrás dos morros ----
     horizon(g, {x0,x1,y,k=.16,t,n,tint,haze,night}); n>=10 põe o 2º, n>=50 o 3º (mais longe e menor). Mesmo cache da Fuji:
     um ciclo garra+broca (CYCLE_CLAW+CYCLE_DRILL) do rig de verdade gravado UMA vez em HZ_F quadros pequenos (escala HZ_S),
     quadros tingidos guardados até a tinta mudar. Quadro normal = 1 drawImage por robô (+ olhinhos de noite). */
  const HZ_F = 12, HZ_S = 0.26, HZ_BOX = [-640, -1180, 860, 40];
  const HZ = { fr: null, tf: [], ok: [], tk: [] };
  function hzBake() {
    if (HZ.fr) return HZ;
    const m = create({ mode: 'normal', x: 0 }), dt = 1 / 60;
    const inp = { x: 0, y: 0, face: 1, floor: () => 0, tx: 430, ty: -60, digging: true, boost: 0, parts: null, night: 0, dumpX: -700, speedMul: 1 };
    for (let i = 0; i < 600 && !(m.atkN >= 2 && !m.atk); i++) update(m, dt, inp);   // aquece até fechar um par garra+broca
    const N = Math.round((CYCLE_CLAW + CYCLE_DRILL) / dt), W = Math.ceil((HZ_BOX[2] - HZ_BOX[0]) * HZ_S), H = Math.ceil((HZ_BOX[3] - HZ_BOX[1]) * HZ_S);
    const fr = [];
    for (let f = 0, step = 0; f < HZ_F; f++) {
      const want = Math.round(f * N / HZ_F); while (step < want) { update(m, dt, inp); step++; }
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
      c.scale(HZ_S, HZ_S); c.translate(-HZ_BOX[0] - m.x, -HZ_BOX[1]);
      try { draw(c, m); } catch (e) { /* horizonte nunca derruba */ }
      fr.push(cv);
    }
    r0.x = m.seatO.x - m.x; r0.y = m.seatO.y;
    HZ.fr = fr; HZ.w = W; HZ.h = H;
    return HZ;
  }
  const r0 = { x: 0, y: -900 };
  function horizon(g, o) {
    const hz = hzBake(), k = o.k || 0.16, t = o.t || 0, n = Math.max(1, o.n | 0), tint = o.tint || '#93A3B4', haze = o.haze === undefined ? 0.6 : o.haze, night = o.night || 0;
    const count = n >= 50 ? 3 : n >= 10 ? 2 : 1, lw = o.x1 - o.x0, bw = HZ_BOX[2] - HZ_BOX[0];
    const base = Math.min(k * 1.1, lw * 0.95 / (bw * (1 + 0.5 * (count - 1))));   // cabe no lote (e no ícone da turma)
    for (let i = count - 1; i >= 0; i--) {
      const ph = ((t + i * 1.1) / (CYCLE_CLAW + CYCLE_DRILL)) % 1, fi = Math.floor(ph * HZ_F) % HZ_F;
      const al = Math.min(0.95, haze + 0.2 + i * 0.1), key = tint + '|' + al;
      if (hz.tk[i] !== key) { hz.tf[i] = hz.tf[i] || []; hz.ok[i] = []; hz.tk[i] = key; }   // tinta mudou: retinge sob demanda
      let out = hz.tf[i][fi];
      if (!out) { out = hz.tf[i][fi] = document.createElement('canvas'); out.width = hz.w; out.height = hz.h; }
      if (!hz.ok[i][fi]) {
        const c = out.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, hz.w, hz.h); c.drawImage(hz.fr[fi], 0, 0);
        c.globalCompositeOperation = 'source-atop'; c.globalAlpha = al; c.fillStyle = tint; c.fillRect(0, 0, hz.w, hz.h); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        hz.ok[i][fi] = true;
      }
      const sc = base * (1 - i * 0.24), x = o.x0 + lw * (count === 1 ? 0.42 : 0.3 + 0.32 * i) - HZ_BOX[0] * sc * 0.15, y = o.y - i * 7;
      g.drawImage(out, x + HZ_BOX[0] * sc, y + HZ_BOX[1] * sc, hz.w / HZ_S * sc, hz.h / HZ_S * sc);
      if (night > 0.2) { g.fillStyle = '#FFE3A0'; g.globalAlpha = night * (1 - i * 0.25); g.fillRect(x + r0.x * sc - 2, y + r0.y * sc - 1.5, 4, 3); g.globalAlpha = 1; }
    }
  }

  G.Tools.komeoh = {
    id: 'komeoh', name: 'KOME-OH', kind: 'mecha', w: 900, h: 1060, horizon,
    meta: { zoom: 0.22, shake: 1, cycle: (CYCLE_CLAW + CYCLE_DRILL) / 2, combineT: COMBINE_T, height: 1040, walk: WALK_V, reach: 430, steps: STEPS.map(s => s[0]) },
    create, update, draw, glow, bite, dump, seat, prebake,
  };
})();
