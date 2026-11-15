/* Kome no Japão — machines-mine.js
   Degraus de mineração da escada de ferramentas: 'pacabo' (pá de cabo elétrica classe P&H 4100) e 'caminhao'
   (caminhão fora-de-estrada classe Cat 797), mais G.Scale = {pickup, keitruck, moega} (objetos de escala / cenário).
   Depende de: core.js, pix.js, shiba.js, fx.js, terrain.js, rig.js.

   Interface comum (G.Tools[id]), igual a machines-mid.js: create(opts) -> m; update(m, dt, inp); draw(g, m); bite(m); dump(m);
   seat(m); m.ev; meta. Espaço do modelo: origem no contato com o chão (inp.x, inp.y), +x = frente, y pra baixo, px de arte.
   opts = {pilot, scale, showScale (estaciona uma pickup do lado)}.
   Estado só-leitura: m.ph, m.busy, m.load, m.off, m.power e, no caminhão, m.state ('idle'|'load'|'haul'|'dump'|'back'),
   m.wantsLoad, m.payload (carga na saída, 0..1.15), m.crowned, m.bedO {x,y,w} (boca da caçamba no mundo), m.rev.

   PAREAMENTO pá + caminhão (unidades do modelo, escala 1; multiplique por scale):
     pacabo.meta.dumpAt = {x: -160, y: -293}  fundo da caçamba (dipper) no despejo: 160 ATRÁS do centro da pá (a casa gira
                                   ~125° "pra câmera") e a 293 do chão; a porta aberta pendura até ~235 do chão.
     caminhao.meta.bed  = {x, y, w} centro da boca da caçamba (x = -51), borda a ~190-200 do chão, monte coroado até ~225.
     caminhao.parkX(shovelX, shovelFace, shovelScale, truckScale) -> x do caminhão (mesma face da pá) pra conchada cair no meio.
     O caminhão fica NA FRENTE da pá (desenhe depois dela). Com inp.loader = true o caminhão não desenha o jorro próprio
     nem enche sozinho: chame G.Tools.caminhao.fill(m, fração) a cada evento 'dump' da pá (≈ 0.34 por conchada). */
(function () {
  'use strict';
  const E = window.KomeEngine;
  if (!E || !E.Rig) throw new Error('machines-mine.js: carregue core, pix, shiba, fx, terrain e rig antes');
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {}; G.Scale = G.Scale || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, Rig = E.Rig, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const seg = (u, a, b) => smooth((u - a) / (b - a));
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

  const shc = new Map();
  function sh(c, k) { const key = c + '|' + k; let v = shc.get(key); if (v === undefined) { v = U.shade(c, k); shc.set(key, v); } return v; }

  /* ---- rascunhos reaproveitados (zero alocação por frame) ---- */
  const LN = [[0, 0], [0, 0]], CA = [0, 0], CB = [0, 0], Q4 = [[0, 0], [0, 0], [0, 0], [0, 0]], T3 = [[0, 0], [0, 0], [0, 0]];
  const PL2 = [[0, 0, 1], [0, 0, 1]];
  function ln(a, b, c, d) { LN[0][0] = a; LN[0][1] = b; LN[1][0] = c; LN[1][1] = d; return LN; }
  function pa(x, y) { CA[0] = x; CA[1] = y; return CA; }
  function pb(x, y) { CB[0] = x; CB[1] = y; return CB; }
  function q4(a, b, c, d, e, f, g, h) { Q4[0][0] = a; Q4[0][1] = b; Q4[1][0] = c; Q4[1][1] = d; Q4[2][0] = e; Q4[2][1] = f; Q4[3][0] = g; Q4[3][1] = h; return Q4; }
  function t3(a, b, c, d, e, f) { T3[0][0] = a; T3[0][1] = b; T3[1][0] = c; T3[1][1] = d; T3[2][0] = e; T3[2][1] = f; return T3; }
  const R1 = { r: 1 }, R2 = { r: 2 }, R3 = { r: 3 }, R4 = { r: 4 }, R6 = { r: 6 };
  const NOHI = { hi: false }, FLAT = { ol: 0, top: false, shade: false, r: 1 }, THIN = { ol: 1.2 }, THIN_R = { ol: 1.2, r: 1.5 };
  const PLAIN = { hi: false, shade: false }, PLAIN0 = { ol: 0, hi: false, shade: false };
  const shO = { scale: 1, shadow: false, pal: 'kome', fast: false };
  const tmp = { x: 0, y: 0 }, tmp2 = { x: 0, y: 0 };
  const GRAIN = { shape: 'grain', c: [PAL.rice, PAL.rice, PAL.riceS], land: true, w: 2.4, life: 1.6, ol: true, speed: [30, 90], spread: 0.7, dir: PI / 2 };
  const DUST = { c: PAL.sand }, DUSTW = { c: PAL.cream };
  const TXT = { size: 12, col: PAL.blk, sw: 0, weight: 900, align: 'center' };

  function spray(m, x, y, n, dir, s0, s1, spread) {
    if (!m.parts || n <= 0) return;
    GRAIN.dir = dir; GRAIN.speed[0] = s0; GRAIN.speed[1] = s1; GRAIN.spread = spread;
    m.parts.spray(x, y, n, GRAIN);
  }
  function puff(m, x, y, n, size, o) { if (m.parts) m.parts.puff(x, y, n, size, o || DUST); }
  function shiba(g, x, y, pose, t, scale, pal) { shO.scale = scale; shO.pal = pal; E.drawShiba(g, x, y, pose, t, shO); }
  // texto que nunca espelha: desfaz o sinal do flip em volta do ponto
  function label(g, txt, x, y, size, col, f) {
    g.save(); g.translate(x, y); if (f < 0) g.scale(-1, 1);
    TXT.size = size; TXT.col = col; Draw.text(g, txt, 0, 0, TXT);
    g.restore();
  }

  /* ---- estado e utilidades comuns (mesmas convenções de machines-mid.js) ---- */
  function baseState(id, opts) {
    opts = opts || {};
    const m = {
      id, sc: opts.scale || 1, pal: opts.pilot || 'kome', showScale: !!opts.showScale, t: 0, ev: [],
      x: 0, y: 0, face: 1, turn: 1, off: 0, ph: 0, busy: false, load: 0, power: 0,
      fl: null, gy: 0, parts: null, rate: 1, acc: 0, acc2: 0, dist: 0, lastX: NaN, vx: 0, night: 0,
      biteO: { x: 0, y: 0, r: 0, active: false, phase: 0 }, dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
      floorF: null,
    };
    m.floorF = x => (m.fl ? m.fl(x) : m.gy);
    return m;
  }
  function begin(m, dt, inp) {
    m.ev.length = 0;
    m.t += dt;
    m.fl = typeof inp.floor === 'function' ? inp.floor : null; m.gy = inp.y || 0;
    m.parts = inp.parts || null;
    m.x = inp.x || 0; m.y = inp.y || 0;
    m.face = inp.face < 0 ? -1 : 1;
    m.turn = clamp(m.turn + (m.face - m.turn > 0 ? 1 : -1) * Math.min(Math.abs(m.face - m.turn), dt * 4), -1, 1);
    const pw = inp.power === undefined ? 1 : clamp(inp.power, 0, 1);
    m.rate = clamp((inp.speedMul || 1) * (0.72 + 0.28 * pw) * (1 + 0.15 * (inp.boost || 0)), 0.4, 2.6);
    m.vx = inp.vx !== undefined ? inp.vx : (m.lastX === m.lastX && dt > 0 ? (m.x - m.lastX) / dt : 0);
    m.lastX = m.x;
    m.night = inp.night ? 1 : 0;
  }
  const visFace = m => { const f = Math.sin(m.turn * PI / 2); return Math.abs(f) < 0.12 ? (m.turn >= 0 ? 0.12 : -0.12) : f; };
  function cycle(m, dt, digging, T) {
    const p0 = m.ph;
    if (!m.busy && digging) { m.busy = true; m.ph = 0; }
    if (m.busy) {
      m.ph += dt * m.rate / T;
      if (m.ph >= 1) { if (digging) m.ph -= 1; else { m.ph = 0; m.busy = false; } }
    }
    m.wrap = m.busy && m.ph < p0;
    return p0;
  }
  const crossed = (m, p0, u) => m.busy && ((p0 < u && m.ph >= u) || (m.wrap && (u > p0 || u <= m.ph)));
  function setK(s, k, z) { s.k = k; s.d = 2 * Math.sqrt(k) * z; }

  /* ======================================================================
     G.Scale — pickup de mina, kei truck e moega (objetos de escala)
     ====================================================================== */
  const sWheel = { tire: PAL.blk, hub: PAL.steel, spokes: 5 };
  let sackSpr = null;
  function sackSprite() {
    return sackSpr || (sackSpr = E.sprite('mine.sack', 20, 16, P => {
      P.rrect(1, 3, 18, 13, 4, PAL.sack).rect(3, 13, 14, 3, PAL.sackD).rect(7, 0, 6, 4, PAL.sack).rect(7, 3, 6, 1, PAL.red);
      P.rect(4, 6, 3, 1, PAL.cream).rect(8, 8, 4, 4, PAL.red).rect(9, 9, 2, 2, PAL.cream);
    }));
  }
  const sprO = { sx: 1, sy: 1, rot: 0, alpha: 1 };
  const PK_BODY = [[-62, -12], [-62, -27], [-22, -28], [-18, -44], [16, -44], [28, -29], [58, -26], [62, -20], [62, -12]];
  const PK_WIN = [[-14, -30], [-12, -41], [0, -41], [0, -30]], PK_WIN2 = [[3, -30], [3, -41], [14, -41], [23, -30]];
  const PKO = { shade: PAL.steel };
  // pickup de mina branca: 128 x 46 (+ mastro da bandeira até ~112)
  function drawPickup(g, x, y, o) {
    o = o || PKO; const f = o.face < 0 ? -1 : 1, t = o.t || 0;
    g.save(); g.translate(x, y); g.scale(f, 1);
    Draw.shadow(g, 0, 1, 62, 4, 0.2);
    Draw.wheel(g, -38, -10, 10, t * 0, sWheel); Draw.wheel(g, 38, -10, 10, 0, sWheel);
    Draw.poly(g, PK_BODY, PAL.white, PKO);
    g.fillStyle = PAL.steelL; g.fillRect(-60, -17, 120, 3.5);
    Draw.hazard(g, -60, -22, 36, 3.6, HAZ0);                                       // faixa refletiva na caçamba
    g.fillStyle = PAL.ora; g.fillRect(-18, -22, 44, 3);
    Draw.poly(g, PK_WIN, PAL.glass, THIN); Draw.poly(g, PK_WIN2, PAL.glass, THIN);
    if (o.pal) { g.save(); g.beginPath(); g.rect(3, -42, 20, 13); g.clip(); shiba(g, 10, -22, 'drive', t, 0.36, o.pal); g.restore(); }
    g.fillStyle = LINE; g.fillRect(1, -42, 1.4, 28); g.fillRect(-21, -27, 1.2, 14);
    Draw.box(g, 58, -19, 6, 5, PAL.blk, R1); Draw.light(g, 60, -23, 2, PAL.goldL, true);
    Draw.light(g, -61, -24, 1.8, PAL.red, 0.5);
    Draw.wheel(g, -38, -10, 10, 0, sWheel); Draw.wheel(g, 38, -10, 10, 0, sWheel);
    // giroflex e bandeira no mastro flexível
    Draw.box(g, -4, -48, 8, 4.4, PAL.ora, THIN_R);
    Draw.light(g, Math.cos(t * 9) * 2.4, -46, 2, PAL.goldL, 0.5 + 0.5 * Math.sin(t * 9));
    const sw = Math.sin(t * 2.3) * 3;
    g.strokeStyle = LINE; g.lineWidth = 1.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-58, -27); g.quadraticCurveTo(-58, -70, -58 + sw, -112); g.stroke();
    const fw = Math.sin(t * 8) * 2;
    g.beginPath(); g.moveTo(-58 + sw, -112); g.lineTo(-74 + sw, -108 + fw); g.lineTo(-58 + sw, -102); g.closePath();
    g.fillStyle = PAL.ora; g.fill(); g.lineWidth = 1.1; g.stroke();
    g.restore();
  }
  const KT_CAB = [[14, -10], [14, -38], [18, -43], [36, -43], [41, -30], [41, -10]];
  // kei truck branco com saco de arroz: 82 x 44
  function drawKei(g, x, y, o) {
    o = o || PKO; const f = o.face < 0 ? -1 : 1, t = o.t || 0;
    g.save(); g.translate(x, y); g.scale(f, 1);
    Draw.shadow(g, 0, 1, 40, 3, 0.2);
    sprO.sx = sprO.sy = 1.15; E.drawSprite(g, sackSprite(), -22, -31, sprO); sprO.sx = sprO.sy = 1; E.drawSprite(g, sackSprite(), -4, -29, sprO);
    Draw.box(g, -40, -26, 55, 10, PAL.white, R1);                                  // caçamba baixa
    g.fillStyle = PAL.steel; g.fillRect(-39, -21, 53, 1.2);
    Draw.box(g, -38, -16, 76, 6, PAL.blk, R1);
    Draw.poly(g, KT_CAB, PAL.white, PKO);
    Draw.window(g, 22, -39, 15, 12, WIN_S);
    if (o.pal) { g.save(); g.beginPath(); g.rect(22, -39, 15, 12); g.clip(); shiba(g, 29, -20, 'drive', t, 0.36, o.pal); g.restore(); }
    Draw.light(g, 40.5, -17, 1.8, PAL.goldL, true); Draw.light(g, -40, -19, 1.5, PAL.red, 0.5);
    Draw.wheel(g, -24, -7, 7, 0, sWheel); Draw.wheel(g, 27, -7, 7, 0, sWheel);
    g.restore();
  }
  const MO_HOP = [[-104, -150], [-96, -150], [-78, -34], [58, -34], [96, -66], [104, -66], [70, -8], [-90, -8]];
  const MO_BACK = [[-104, -150], [-96, -150], [-86, -66], [96, -66], [96, -60], [-92, -60]];
  // moega móvel: 300 x 160. A boca fica do lado +x*face (o caminhão chega de ré por ali), a correia sai pro lado oposto.
  function drawMoega(g, x, y, o) {
    o = o || PKO; const f = o.face < 0 ? -1 : 1, t = o.t || 0, fill = clamp(o.fill || 0, 0, 1);
    g.save(); g.translate(x, y); g.scale(f, 1);
    Draw.shadow(g, -20, 1, 140, 5, 0.2);
    Draw.truss(g, pa(-60, -22), pb(-190, -112), 14, 2.2, PAL.yel, TRUSS_S);       // correia que sobe
    g.strokeStyle = LINE; g.lineWidth = 5; g.beginPath(); g.moveTo(-58, -34); g.lineTo(-190, -124); g.stroke();
    g.strokeStyle = PAL.blkL; g.lineWidth = 3; g.setLineDash(DASH_B); g.lineDashOffset = -t * 40; g.stroke(); g.setLineDash(NODASH);
    Rig.pulley(g, -190, -122, 7, t * 5, PUL_S);
    Draw.beam(g, ln(-176, -104, -176, -2), 3.4, PAL.steelD, NOHI); Draw.beam(g, ln(-150, -86, -176, -2), 2.4, PAL.steelD, NOHI);
    Draw.poly(g, MO_BACK, sh(PAL.yel, -0.25), PLAIN);
    if (fill > 0) { g.fillStyle = PAL.rice; g.strokeStyle = LINE; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-88, -62); g.quadraticCurveTo(0, -66 - fill * 46, 92, -64); g.lineTo(60, -34); g.lineTo(-78, -34); g.closePath(); g.fill(); g.stroke(); }
    Draw.poly(g, MO_HOP, PAL.yel);
    g.fillStyle = sh(PAL.yel, -0.25); for (let i = 0; i < 4; i++) g.fillRect(-60 + i * 34, -32, 3, 22);
    Draw.hazard(g, 60, -74, 44, 7, HAZ0);
    Draw.track(g, -84, -16, 150, 18, 0, TRK_S);
    Draw.light(g, -100, -156, 2.6, PAL.ora, 0.5 + 0.5 * Math.sin(t * 6));
    g.restore();
  }
  const HAZ0 = { ol: 0 }, WIN_S = { r: 1.5, ol: 1.2 }, TRUSS_S = { taper: 1, bays: 7 }, DASH_B = [5, 4], NODASH = [], PUL_S = { col: PAL.steel, holes: 3 }, TRK_S = { col: PAL.grayD };
  G.Scale.pickup = { w: 128, h: 46, draw: drawPickup };
  G.Scale.keitruck = { w: 82, h: 44, draw: drawKei };
  G.Scale.moega = { w: 300, h: 160, draw: drawMoega };
  const scaleO = { face: 1, t: 0, pal: 'goma' };
  function parkPickup(g, m, halfW) {
    if (!m.showScale) return;
    const x = m.x - m.face * halfW * m.sc;
    g.save(); g.translate(x, m.floorF(x) + 24 * m.sc); g.scale(m.sc, m.sc);
    scaleO.face = m.face; scaleO.t = m.t; drawPickup(g, 0, 0, scaleO);
    g.restore();
  }

  /* ======================================================================
     PACABO — pá de cabo elétrica (classe P&H 4100), ~470 de altura
     Lança fixa a 47°; braço (handle) desliza e gira no berço (saddle block) no meio da lança; cabos de içamento passam nas
     polias da ponta; caçamba (dipper) com dentes e porta de fundo. O giro da casa é fingido: fator kb = cos(phi) encurta
     a lança/braço em x (a lança "aponta pra câmera" e passa pro outro lado), a casa só aperta um pouco.
     ====================================================================== */
  const P_CYCLE = 3.6, P_AX = -10, P_BL = 480, P_BA = 0.82, P_FX = 60, P_FY = -90, P_HL = 268, P_PHI = 2.18, P_SR = 26;
  const P_COS = Math.cos(P_BA), P_SIN = Math.sin(P_BA), P_RY = -74;
  const P_A0 = 1.5, P_A1 = 0.45, P_A2 = -0.35, P_E0 = 172, P_E2 = 175;
  const P_DIP = [[-24, -22], [66, -42], [86, -30], [82, 40], [-24, 40]];
  const P_TOOTH = [[68, -41], [86, -31], [95, -60]];
  const P_CW = [[-216, -84], [-216, -150], [-206, -158], [-160, -158], [-160, -84]];
  const P_CABP = [[32, -224], [32, -284], [84, -284], [98, -262], [98, -224]];
  const pTrk = { col: PAL.grayD, wheels: 7 }, pTrkF = { col: sh(PAL.grayD, -0.3), belt: sh(PAL.blk, -0.3), wheels: 7 };
  const P_HOUSE = { r: 3, panels: 6 }, P_RAIL = { posts: 11, h: 15, col: PAL.yel, lw: 1.6 }, P_RAIL2 = { posts: 8, h: 11, col: PAL.yel, lw: 1.4 };
  const P_STAIR = { col: PAL.steel, lw: 2, railH: 12, railCol: PAL.yel }, P_PUL = { col: PAL.yel, holes: 5 }, P_PUL2 = { col: PAL.steel, holes: 3 };
  const P_WIN = { r: 2, ol: 1.4 };
  const PK = { kb: 1, kh: 1, sp: 0, fx: 0, fy: 0, tx: 0, ty: 0, sx: 0, sy: 0, ex: 0, ey: 0, a: 0, ca: 1, sa: 0 };
  function pose(a, e, phi) {
    const K = PK, sp = Math.sin(phi);
    K.kb = Math.cos(phi); K.sp = sp; K.kh = 1 - 0.16 * sp * sp;
    K.fx = P_AX + (P_FX - P_AX) * K.kh; K.fy = P_FY;
    K.tx = K.fx + P_BL * P_COS * K.kb; K.ty = K.fy - P_BL * P_SIN;
    K.sx = K.fx + 0.5 * P_BL * P_COS * K.kb; K.sy = K.fy - 0.5 * P_BL * P_SIN;
    K.a = a; K.ca = Math.cos(a); K.sa = Math.sin(a);
    K.ex = K.sx + e * K.ca * K.kb; K.ey = K.sy + e * K.sa;
    return K;
  }
  function dipPt(lx, ly, out) { const K = PK; out.x = K.ex + (lx * K.ca - ly * K.sa) * K.kb; out.y = K.ey + lx * K.sa + ly * K.ca; return out; }
  pose(P_A2, P_E2, P_PHI); dipPt(30, 46, tmp);
  const P_DUMP_AT = { x: Math.round(tmp.x), y: Math.round(tmp.y) };

  function makePacabo(opts) {
    const m = baseState('pacabo', opts), sc = m.sc;
    const HOUSE = PAL.cream, TRIM = PAL.red, BOOM = PAL.blkL, HAND = PAL.yel, DIP = PAL.grayD;
    const aS = E.Spring(1.3, { k: 60, d: 13 }), eS = E.Spring(165, { k: 60, d: 13 }), phiS = E.Spring(0, { k: 34, d: 10 });
    const door = E.Spring(0, { k: 46, d: 3.4 }), rock = E.Spring(0, { k: 30, d: 3.2 }), heave = E.Spring(0, { k: 90, d: 6 });
    const ropeS = E.Spring(0, { k: 50, d: 2.2 }), whip = E.Spring(0, { k: 60, d: 2.6 });
    let latched = true, trk = 0, rope = 0, tilt = 0, oy = 0, fanA = 0, walk = 0, sparkT = 0;
    m.J = { handle: aS, crowd: eS, slew: phiS, door };

    // modelo (parte de cima, já balançando) -> mundo
    function w(mx, my, out) {
      const rr = rock.x, c0 = Math.cos(rr), s0 = Math.sin(rr), dx = mx - P_AX, dy = my - P_RY;
      const X = (P_AX + dx * c0 - dy * s0) * sc * m.face, Y = (P_RY + dx * s0 + dy * c0 + heave.x) * sc;
      const c = Math.cos(tilt), s = Math.sin(tilt);
      out.x = m.x + X * c - Y * s; out.y = oy + X * s + Y * c; return out;
    }

    function update(dt, inp) {
      begin(m, dt, inp);
      const r = m.rate, dig = !!inp.digging;
      const p0 = cycle(m, dt, dig, P_CYCLE), u = m.ph;
      const moving = Math.abs(m.vx) > 6;
      let aT, eT, phiT = 0, biting = false, open = false;
      if (m.busy) {
        if (u < 0.08) { aT = P_A0; eT = lerp(160, P_E0, seg(u, 0, 0.08)); }
        else if (u < 0.4) { const s = (u - 0.08) / 0.32, q = smooth(s); aT = lerp(P_A0, P_A1, q); eT = P_E0 + 46 * Math.sin(PI * s) + 18 * q; biting = u > 0.1 && u < 0.38; }
        else if (u < 0.6) { const s = seg(u, 0.4, 0.58); aT = lerp(P_A1, P_A2, s); eT = lerp(P_E0 + 18, P_E2, s); phiT = P_PHI * seg(u, 0.41, 0.6); }
        else if (u < 0.76) { aT = P_A2; eT = P_E2; phiT = P_PHI; open = u > 0.62; }
        else { phiT = P_PHI * (1 - seg(u, 0.76, 0.93)); aT = lerp(P_A2, P_A0, seg(u, 0.79, 0.98)); eT = lerp(P_E2, 160, seg(u, 0.8, 0.98)); }
        if (crossed(m, p0, 0.1)) { m.ev.push('hit'); rock.kick(0.075); heave.kick(26); ropeS.kick(7); }
        if (crossed(m, p0, 0.4)) { m.ev.push('scoop'); rock.kick(-0.03); }
        if (crossed(m, p0, 0.42)) m.ev.push('rev');
        if (crossed(m, p0, 0.62)) { m.ev.push('dump'); latched = false; door.kick(5); rock.kick(-0.085); heave.kick(-30); ropeS.kick(-9); }
      } else {
        aT = moving ? 0.95 : 1.28 + Math.sin(m.t * 0.7) * 0.02; eT = moving ? 150 : 166;
      }
      setK(aS, 60 * r * r, 0.82); setK(eS, 70 * r * r, 0.85); setK(phiS, 46 * r * r, 0.9);
      aS.target = aT; eS.target = eT; phiS.target = phiT;
      const a0 = aS.x, e0 = eS.x;
      aS.update(dt); eS.update(dt); phiS.update(dt);
      // porta do fundo: solta = pendura no prumo (com batente); baixou a caçamba = fecha e trava
      door.target = latched ? 0 : clamp(PI / 2 - aS.x - 0.1, 0, 1.0);
      door.update(dt);
      if (door.x < 0) { door.x = 0; if (door.v < 0) door.v *= -0.3; }
      if (door.x > 1.05) { door.x = 1.05; if (door.v > 0) door.v *= -0.35; }
      if (!latched && !open && door.target < 0.12 && door.x < 0.14) { latched = true; door.snap(0); m.ev.push('clank'); rock.kick(0.02); ropeS.kick(4); }
      // carga
      if (biting) m.load = Math.min(1, m.load + dt * r / (0.27 * P_CYCLE));
      const pouring = !latched && door.x > 0.3 && m.load > 0;
      if (pouring) m.load = Math.max(0, m.load - dt * r / (0.09 * P_CYCLE));
      // balanço sobre as esteiras
      rock.target = (biting ? 0.007 : 0) + m.load * 0.004 * Math.cos(phiS.x);
      rock.update(dt); heave.update(dt); ropeS.update(dt);
      whip.kick(rock.v * 2.5 * dt * 60 * 0.3); whip.update(dt);
      trk = m.x / sc * m.face;
      const hw = 120 * sc, yl = m.floorF(m.x - hw), yr = m.floorF(m.x + hw);
      tilt = damp(tilt, Math.atan2(yr - yl, hw * 2), 8, dt); oy = damp(oy || m.y, (yl + yr) / 2, 10, dt);
      const hoistV = Math.abs(aS.x - a0) / Math.max(dt, 1e-4), crowdV = Math.abs(eS.x - e0) / Math.max(dt, 1e-4);
      m.power = damp(m.power, clamp(hoistV * 0.5 + crowdV / 160 + Math.abs(phiS.v) * 0.3 + (biting ? 0.4 : 0) + (moving ? 0.4 : 0), 0, 1), 6, dt);
      fanA += dt * (4 + m.power * 16); walk += dt;
      // âncoras no mundo
      const K = pose(aS.x, eS.x, phiS.x);
      const dx = K.tx - K.ex, dy = K.ty - K.ey; rope = Math.hypot(dx / (Math.abs(K.kb) > 0.2 ? K.kb : 0.2), dy);
      dipPt(88, -46, tmp); w(tmp.x, tmp.y, tmp);
      const b = m.biteO; b.x = tmp.x; b.y = tmp.y; b.r = 56 * sc; b.active = biting; b.phase = u;
      if (biting) { m.acc2 += dt * 90; const n = m.acc2 | 0; m.acc2 -= n; spray(m, tmp.x, tmp.y, n, -PI / 2 - m.face * 0.5, 60, 200, 0.9); }
      if (crossed(m, p0, 0.1)) { spray(m, tmp.x, tmp.y, 22, -PI / 2 - m.face * 0.6, 90, 260, 0.8); puff(m, tmp.x, tmp.y, 5, 12 * sc, DUSTW); }
      if (m.busy && u > 0.4 && u < 0.6 && m.load > 0.5) { m.acc += dt * 16; const n = m.acc | 0; m.acc -= n; dipPt(40, -44, tmp2); w(tmp2.x, tmp2.y, tmp2); spray(m, tmp2.x, tmp2.y, n, PI / 2, 10, 50, 0.5); }
      dipPt(30, 46, tmp); w(tmp.x, tmp.y, tmp);
      const d = m.dumpO; d.x = tmp.x; d.y = tmp.y; d.active = pouring;
      if (pouring) { m.acc += dt * 260; const n = m.acc | 0; m.acc -= n; spray(m, tmp.x + (Math.random() - 0.5) * 50 * sc, tmp.y, n, PI / 2, 40, 160, 0.35); }
      w(P_AX + (66 - P_AX) * K.kh, -250, tmp); m.seatO.x = tmp.x; m.seatO.y = tmp.y;
      // faísca no cabo de força de vez em quando
      sparkT -= dt; if (sparkT < 0 && m.power > 0.5) { sparkT = 1.5 + Math.random() * 2; if (m.parts && m.parts.sparks) m.parts.sparks(m.x - m.face * 118 * sc, oy - 44 * sc, 3); }
      if (moving) { m.dist += Math.abs(m.vx) * dt; if (m.dist > 40 * sc) { m.dist = 0; puff(m, m.x - m.face * Math.sign(m.vx * m.face) * 125 * sc, oy - 4, 2, 9 * sc, DUST); } }
    }

    function drawHouse(g, K, t) {
      g.save(); g.translate(P_AX, 0); g.scale(K.kh, 1); g.translate(-P_AX, 0);
      // pórtico (A-frame) no teto
      Draw.beam(g, ln(-168, -218, -80, -354), 8, BOOM, NOHI);
      Draw.beam(g, ln(26, -218, -80, -354), 9, BOOM);
      Draw.beam(g, ln(-128, -280, -22, -280), 4, sh(BOOM, -0.2), NOHI);
      Draw.beam(g, ln(-128, -280, 2, -250), 3, sh(BOOM, -0.2), NOHI);
      // contrapeso e chassi giratório
      Draw.poly(g, P_CW, PAL.blkL);
      Draw.hazard(g, -214, -98, 52, 12, HAZ0);
      g.fillStyle = sh(PAL.blkL, -0.25); for (let i = 0; i < 3; i++) g.fillRect(-208 + i * 16, -150, 3, 48);
      Draw.box(g, -204, -102, 284, 20, PAL.blk, R2);
      // casa de máquinas
      Draw.box(g, -200, -220, 262, 120, HOUSE, P_HOUSE);
      Draw.box(g, -200, -140, 262, 9, TRIM, FLAT);
      g.fillStyle = sh(HOUSE, -0.12); g.fillRect(-199, -128, 260, 26);
      for (let i = 0; i < 3; i++) {                                                 // venezianas
        const vx = -186 + i * 62;
        Draw.box(g, vx, -206, 42, 34, PAL.steelD, THIN_R);
        g.fillStyle = LINE; for (let j = 0; j < 5; j++) g.fillRect(vx + 3, -201 + j * 6, 36, 1.6);
      }
      Draw.box(g, 10, -200, 26, 62, sh(HOUSE, -0.1), THIN_R); g.fillStyle = PAL.glass; g.fillRect(15, -194, 16, 12); g.fillStyle = LINE; g.fillRect(31, -168, 2, 6);
      if (K.sp > 0.04) { const fw = 54 * K.sp; Draw.box(g, 62 - fw, -220, fw, 120, sh(HOUSE, -0.2), R2); g.fillStyle = TRIM; g.fillRect(62 - fw + 1, -140, fw - 2, 9); }
      // ventiladores no teto
      for (let i = 0; i < 2; i++) {
        const fx = -150 + i * 50;
        Draw.box(g, fx, -234, 34, 14, PAL.steel, THIN_R);
        g.fillStyle = LINE; const o = (Math.sin(fanA + i) * 0.5 + 0.5) * 6; g.fillRect(fx + 4 + o, -230, 3, 7); g.fillRect(fx + 14 + o, -230, 3, 7); g.fillRect(fx + 24 + o * 0.6, -230, 3, 7);
      }
      // escada marinheiro até o teto
      g.fillStyle = LINE; g.fillRect(-58, -220, 2.4, 118); g.fillRect(-44, -220, 2.4, 118);
      g.fillStyle = PAL.yel; for (let i = 0; i < 10; i++) g.fillRect(-56, -212 + i * 11.4, 12, 2);
      // passadiço, guarda-corpos e escada de embarque
      Draw.box(g, -210, -104, 274, 4, PAL.steelD, FLAT);
      Draw.stairs(g, pa(-212, -102), pb(-252, -22), 8, P_STAIR);
      Draw.rail(g, pa(-208, -102), pb(8, -102), P_RAIL);
      Draw.rail(g, pa(-198, -220), pb(-96, -220), P_RAIL2);
      // shibas minúsculos: um andando no passadiço, um no teto, um subindo a escada
      const wx = -110 + Math.sin(walk * 0.5) * 70;
      g.save(); g.translate(wx, -104); if (Math.cos(walk * 0.5) < 0) g.scale(-1, 1); shiba(g, 0, 0, 'walk', t, 0.25, 'goma'); g.restore();
      shiba(g, -176, -220, m.busy ? 'point' : 'sit', t, 0.25, 'kuro');
      shiba(g, -51, -140 - (t * 9) % 60, 'climb', t, 0.25, 'kome');
      // tomada do cabo de força
      Draw.box(g, -130, -86, 16, 10, PAL.ora, THIN_R);
      g.restore();
    }
    function drawCab(g, K, t) {
      g.save(); g.translate(P_AX, 0); g.scale(K.kh, 1); g.translate(-P_AX, 0);
      Draw.box(g, 30, -226, 60, 8, PAL.blk, R2);                                    // console de apoio
      Draw.poly(g, P_CABP, HOUSE, PLAIN);
      g.fillStyle = PAL.glassD; g.fillRect(46, -276, 40, 32);
      g.save(); g.beginPath(); g.rect(46, -276, 40, 32); g.clip();
      shiba(g, 64, -238, 'drive', t, 0.55, m.pal);
      g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(74, -276); g.lineTo(82, -276); g.lineTo(66, -244); g.lineTo(58, -244); g.fill();
      g.restore();
      g.strokeStyle = LINE; g.lineWidth = 1.8; g.strokeRect(46, -276, 40, 32);
      Draw.box(g, 28, -290, 72, 7, TRIM, R2);                                       // teto com aba
      g.fillStyle = TRIM; g.fillRect(33, -240, 12, 14);
      Draw.box(g, 52, -296, 9, 6, PAL.ora, THIN_R);
      Draw.light(g, 56.5 + Math.cos(t * 9) * 2.4, -293, 2.4, PAL.goldL, 0.5 + 0.5 * Math.sin(t * 9));
      Draw.light(g, 97, -232, 3, PAL.goldL, m.night ? 1 : 0.5);
      const a = whip.x; g.strokeStyle = LINE; g.lineWidth = 1.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(36, -290); g.quadraticCurveTo(36 - a * 30, -312, 36 + a * 60, -334); g.stroke();
      const fw = Math.sin(t * 7) * 2; g.beginPath(); g.moveTo(36 + a * 60, -334); g.lineTo(22 + a * 60, -330 + fw); g.lineTo(36 + a * 60, -325); g.closePath(); g.fillStyle = TRIM; g.fill(); g.lineWidth = 1; g.stroke();
      g.restore();
    }
    function ropes(g, x0, y0, x1, y1, off, sag) {
      const mx = (x0 + x1) / 2 + sag, my = (y0 + y1) / 2;
      g.beginPath();
      g.moveTo(x0 - 3.2, y0); g.quadraticCurveTo(mx - 3.2, my, x1 - 3.2, y1);
      g.moveTo(x0 + 3.2, y0); g.quadraticCurveTo(mx + 3.2, my, x1 + 3.2, y1);
      g.lineCap = 'butt'; g.strokeStyle = LINE; g.lineWidth = 3; g.stroke();
      g.strokeStyle = PAL.steel; g.lineWidth = 1.3; g.setLineDash(P_DASH); g.lineDashOffset = off; g.stroke(); g.setLineDash(NODASH);
    }
    function drawBoom(g, K, t) {
      const kb = K.kb, ks = Math.abs(kb) < 0.1 ? (kb < 0 ? -0.1 : 0.1) : kb;
      const gx = P_AX + (-80 - P_AX) * K.kh, gy = -354, hx = P_AX + (-30 - P_AX) * K.kh;
      // estais do pórtico até a ponta da lança
      g.lineCap = 'round'; g.strokeStyle = LINE; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(gx, gy); g.lineTo(K.tx - 6 * ks, K.ty - 6); g.moveTo(gx, gy + 7); g.lineTo(K.tx - 14 * ks, K.ty + 6); g.stroke();
      Rig.pulley(g, gx, gy, 9, rope / 9, P_PUL2);
      // cabo de içamento: tambor (dentro da casa) -> polia da ponta
      ropes(g, hx, -224, K.tx - P_SR * ks * 0.9, K.ty - P_SR * 0.3, rope, ropeS.x * 0.6);
      // lança (viga caixão, afina na ponta)
      PL2[0][0] = K.fx; PL2[0][1] = K.fy; PL2[0][2] = 25; PL2[1][0] = K.tx; PL2[1][1] = K.ty; PL2[1][2] = 13;
      Rig.plate(g, PL2, BOOM);
      const bx = K.tx - K.fx, by = K.ty - K.fy;
      g.strokeStyle = sh(BOOM, -0.3); g.lineWidth = 2.4; g.beginPath();
      for (let i = 1; i < 8; i++) { const q = i / 8, hwd = lerp(20, 11, q), nl = Math.hypot(bx, by) || 1, nx = -by / nl, ny = bx / nl; g.moveTo(K.fx + bx * q + nx * hwd, K.fy + by * q + ny * hwd); g.lineTo(K.fx + bx * (q + 0.06) - nx * hwd, K.fy + by * (q + 0.06) - ny * hwd); }
      g.stroke();
      Draw.rail(g, pa(K.fx + bx * 0.08, K.fy + by * 0.08 - 22), pb(K.fx + bx * 0.9, K.fy + by * 0.9 - 14), P_BRAIL);   // passarela da lança
      shiba(g, K.fx + bx * 0.3, K.fy + by * 0.3 - 20, 'wave', t, 0.25, 'goma');
      Rig.pin(g, K.fx, K.fy, 9);
      Draw.light(g, K.fx + bx * 0.62, K.fy + by * 0.62 + 16, 3.4, PAL.goldL, m.night ? 1 : 0.35);
      // braço (handle) com cremalheira, atravessando o berço
      const tl = P_HL - eS.x, hxT = K.sx - tl * K.ca * kb, hyT = K.sy - tl * K.sa;
      Draw.beam(g, ln(hxT, hyT, K.ex, K.ey), 15, HAND);
      g.strokeStyle = sh(HAND, -0.4); g.lineWidth = 3; g.lineCap = 'butt'; g.setLineDash(P_RACK); g.lineDashOffset = eS.x;
      g.beginPath(); g.moveTo(hxT + K.sa * 5 * ks, hyT - K.ca * 5); g.lineTo(K.ex + K.sa * 5 * ks, K.ey - K.ca * 5); g.stroke(); g.setLineDash(NODASH);
      Draw.circle(g, hxT, hyT, 8.5, sh(HAND, -0.2), THIN);
      // berço (saddle block) com o pinhão do avanço girando
      g.save(); g.translate(K.sx, K.sy); g.rotate(Math.atan2(K.sa, K.ca * ks));
      Draw.box(g, -27, -15, 54, 30, PAL.blk, R4);
      g.fillStyle = sh(HAND, -0.1); g.fillRect(-27, -5, 54, 10);
      g.restore();
      Rig.pulley(g, K.sx, K.sy, 12, -eS.x / 12, P_PUL);
      // polias da ponta e o cabo descendo até o estribo da caçamba
      dipPt(46, -40, tmp); const bx0 = tmp.x, by0 = tmp.y;
      const sxr = K.tx + P_SR * ks * 0.92, dxr = sxr - bx0, dyr = K.ty - by0, dl = Math.hypot(dxr, dyr) || 1, bl = Math.min(34, dl * 0.5);
      const ex = bx0 + dxr / dl * bl, ey = by0 + dyr / dl * bl;
      ropes(g, sxr, K.ty, ex, ey, -rope, ropeS.x);
      g.save(); g.translate(K.tx, K.ty); g.scale(Math.max(0.4, Math.abs(kb)), 1);
      Rig.pulley(g, 5, -3, P_SR * 0.92, -rope / P_SR + 0.6, P_PUL2); Rig.pulley(g, 0, 0, P_SR, -rope / P_SR, P_PUL);
      g.restore();
      Draw.box(g, K.tx - 5, K.ty - P_SR - 14, 10, 9, PAL.blk, THIN_R); Draw.light(g, K.tx, K.ty - P_SR - 17, 3, PAL.red, 0.5 + 0.5 * Math.sin(t * 3));
      drawDipper(g, K, ks);
      Draw.beam(g, ln(bx0, by0, ex, ey), 5, PAL.steelD, NOHI);                      // estribo + equalizador
      Rig.pulley(g, ex, ey, 9, rope / 9, P_PUL2);
    }
    function drawDipper(g, K, ks) {
      const L = m.load;
      g.save(); g.translate(K.ex, K.ey); g.scale(ks, 1); g.rotate(K.a);
      // porta do fundo (dobradiça do lado do braço)
      g.save(); g.translate(-22, 40); g.rotate(door.x);
      Draw.box(g, -2, -3, 108, 10, PAL.steelD, R2);
      g.fillStyle = sh(PAL.steelD, -0.3); for (let i = 0; i < 4; i++) g.fillRect(14 + i * 24, -2, 4, 8);
      Draw.box(g, 98, -8, 8, 8, PAL.blk, THIN_R);
      g.restore();
      if (L > 0.02) {                                                              // arroz transbordando na boca
        g.fillStyle = PAL.rice; g.strokeStyle = LINE; g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(-18, -20); g.quadraticCurveTo(20, -34 - 44 * L, 70, -38); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = PAL.riceS; g.fillRect(8, -30 - 12 * L, 5, 2); g.fillRect(34, -36 - 12 * L, 5, 2); g.fillRect(24, -28, 4, 2);
      }
      Draw.poly(g, P_DIP, DIP);
      g.fillStyle = sh(DIP, -0.25); g.fillRect(-22, 30, 102, 8); g.fillRect(8, -22, 5, 52); g.fillRect(40, -30, 5, 60);
      g.fillStyle = sh(DIP, 0.25); g.fillRect(-18, -14, 80, 2.4);
      Draw.beam(g, ln(64, -40, 86, -29), 6, PAL.steel, NOHI);                      // lábio de desgaste
      Draw.poly(g, P_TOOTH, PAL.steelL, THIN);
      Rig.pin(g, 0, 0, 7); Rig.pin(g, 46, -32, 5); Rig.pin(g, -22, 40, 4);
      g.restore();
      // parede da frente aparecendo quando a lança vira pra câmera
      if (K.sp > 0.12) {
        const hw = 40 * K.sp;
        dipPt(84, -32, tmp); dipPt(82, 40, tmp2);
        Draw.poly(g, q4(tmp.x - hw, tmp.y, tmp.x + hw, tmp.y, tmp2.x + hw, tmp2.y, tmp2.x - hw, tmp2.y), sh(DIP, 0.08));
        const tdx = (0.3 * K.ca + K.sa) * K.kb * 22, tdy = (0.3 * K.sa - K.ca) * 22;
        for (let i = 0; i < 4; i++) { const cx = tmp.x - hw + (i + 0.5) * hw / 2; Draw.poly(g, t3(cx - hw * 0.16, tmp.y, cx + hw * 0.16, tmp.y, cx + tdx, tmp.y + tdy), PAL.steelL, THIN); }
        g.fillStyle = sh(DIP, -0.2); g.fillRect(tmp.x - hw + 3, (tmp.y + tmp2.y) / 2, hw * 2 - 6, 4);
      }
    }
    const P_DASH = [4, 3], P_RACK = [3, 3], P_BRAIL = { posts: 12, h: 9, col: PAL.yel, lw: 1.2, mid: false };

    function draw(g) {
      const f = visFace(m), t = m.t, K = pose(aS.x, eS.x, phiS.x);
      Draw.shadow(g, m.x, oy + 3 * sc, 190 * sc, 9 * sc, 0.22);
      g.save(); g.translate(m.x, oy); g.rotate(tilt); g.scale(f * sc, sc);
      // cabo de força arrastando no chão, com um cavalete
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-122, -80); g.bezierCurveTo(-150, -30, -190, -2, -240, -3);
      for (let i = 0; i < 6; i++) { const x0 = -240 - i * 90; g.quadraticCurveTo(x0 - 45, -3 + (i & 1 ? 5 : -5) * (1 + 0.15 * Math.sin(t * 2 + i)), x0 - 90, -3); }
      g.strokeStyle = LINE; g.lineWidth = 6.5; g.stroke(); g.strokeStyle = PAL.ora; g.lineWidth = 3.4; g.stroke();
      Draw.beam(g, ln(-412, 0, -400, -22), 3, PAL.steelD, NOHI); Draw.beam(g, ln(-388, 0, -400, -22), 3, PAL.steelD, NOHI);
      // esteiras + carro
      Draw.track(g, -128, -72, 262, 66, trk, pTrkF);
      Draw.box(g, -74, -82, 128, 34, PAL.blk, R4);
      Draw.track(g, -140, -64, 262, 66, trk, pTrk);
      // parte de cima: balança em volta do rolamento de giro
      g.translate(P_AX, P_RY + heave.x); g.rotate(rock.x); g.translate(-P_AX, -P_RY);
      Draw.box(g, P_AX - 56, -90, 112, 14, PAL.steelD, R3);
      g.fillStyle = LINE; for (let i = 0; i < 10; i++) g.fillRect(P_AX - 52 + ((i * 11 + phiS.x * 60) % 104 + 104) % 104, -86, 2, 6);
      drawHouse(g, K, t);
      drawBoom(g, K, t);
      drawCab(g, K, t);
      g.restore();
      parkPickup(g, m, 215);
    }
    m.update = update; m.drawFn = draw;
    return m;
  }

  /* ======================================================================
     CAMINHAO — fora-de-estrada classe 797: 352 de comprimento, pneus de 100, ~202 de altura (≈ 362 basculado)
     Ciclo de degrau: 'load' (parado na face, sendo carregado) -> 'haul' (de ré até o ponto de descarga) -> 'dump'
     (bascula; o evento 'dump' é o momento do iene) -> 'back' (volta pra face).
     inp extra opcional: loader (true = carga externa via tool.fill), dumpX (x no mundo onde a traseira deve parar).
     ====================================================================== */
  const C_CYCLE = 11.2, C_PX = -126, C_PY = -92, C_BMAX = 0.82, C_HAUL = 430, C_TBX = -28, C_TBY = -50, C_TAX = 160, C_TAY = -6;
  const C_BED = [[-52, -54], [14, -4], [166, -4], [190, -88], [290, -96], [290, -108], [178, -110], [-44, -72]];
  const C_BEDIN = [[-40, -66], [14, -10], [164, -10], [182, -100], [-40, -66]];
  const C_HOOD = [[58, -62], [58, -124], [172, -124], [176, -112], [176, -62]];
  const C_CABP = [[70, -124], [70, -172], [108, -172], [120, -150], [120, -124]];
  const cWheel = { hub: PAL.grayL, spokes: 8 }, cWheelF = { tire: sh(PAL.blk, -0.35), hub: sh(PAL.grayL, -0.4), spokes: 8 };
  const C_RAIL = { posts: 6, h: 17, col: PAL.yel, lw: 1.6 }, C_STAIR = { col: PAL.steel, lw: 2.2, railH: 13, railCol: PAL.yel };
  const C_TAG = { r: 3, top: false, shade: false }, C_BEDO = { shade: true }, C_PILEO = { clip: false };
  const C_PH = 90;
  const C_BED_AT = { x: C_PX + 75, y: -200, w: 200 };

  function makeCaminhao(opts) {
    const m = baseState('caminhao', opts), sc = m.sc;
    const BODY = PAL.yel;
    const ch = E.Chassis({ wheels: [{ x: -78 * sc, r: 50 * sc, travel: 13 * sc }, { x: 96 * sc, r: 50 * sc, travel: 13 * sc }], floor: m.floorF, k: 60, d: 7.5, tiltK: 55, tiltD: 7, squat: 0.0011 });
    const bed = E.Spring(0, { k: 26, d: 8.5 }), bedJ = E.Spring(0, { k: 200, d: 9 }), mirror = E.Spring(0, { k: 90, d: 3 }), flap = E.Spring(0, { k: 200, d: 9 });
    const tel = E.Telescope({ stages: 3, len: 66, w: 14, sequential: true, col: PAL.blkL });
    const pile = E.Pile({ cap: 100, cols: 22, slope: 0.065, max: 1.15 });
    const exhaust = E.Exhaust({ size: 4 * sc, rate: 3.6, rise: 40 * sc, wind: -6, max: 30 });
    m.ch = ch; m.pile = pile; m.exhaust = exhaust; m.J = { bed };
    m.state = 'idle'; m.wantsLoad = false; m.payload = 0; m.crowned = false; m.rev = 0; m.bedO = { x: 0, y: 0, w: 0 };
    let st = 0, offV = 0, offT = 0, td = 0, pourT = 0, pouring = false, sliding = false, slid = false, spilled = false, full = false, haulD = C_HAUL, fast = false, flow = 0;
    let extK = 0, streamTop = 0;

    function wPt(mx, my, out) {
      const X = mx * sc * m.face, Y = my * sc, c = Math.cos(ch.tilt), s = Math.sin(ch.tilt);
      out.x = ch.x + X * c - Y * s; out.y = ch.y + X * s + Y * c; return out;
    }
    function bedPt(lx, ly, out) {                 // ponto local da caçamba (pivô = origem) -> modelo
      const c = Math.cos(bed.x), s = Math.sin(bed.x);
      out.x = C_PX + lx * c + ly * s; out.y = C_PY - lx * s + ly * c + bedJ.x; return out;
    }
    m.fill = v => { const got = pile.add(v * 100, 0.5 + (Math.random() - 0.5) * 0.2, 0.2); ch.bump(60 * sc * v); bedJ.kick(40 * v); return got / 100; };

    function update(dt, inp) {
      begin(m, dt, inp);
      const r = m.rate, dig = !!inp.digging, ext = !!inp.loader;
      const ahead = inp.tx === undefined || (inp.tx - m.x) * m.face > -60 * sc;
      const f0 = pile.frac;
      pouring = false;
      if (st === 0) {
        offT = 0;
        if (dig && ahead) { st = 1; pourT = 0.5; spilled = false; full = false; m.ev.push('load'); }
        else if (pile.frac > 0.02 && dig) st = 2;
      }
      if (st === 1) {
        offT = 0;
        if (!ext) {
          pourT += dt * r;
          pouring = (pourT % 1.5) < 0.95 && pile.frac < 1.15;
          if (pouring) pile.add(dt * r * 40, 0.5 + Math.sin(m.t * 3) * 0.12, 0.2);
        }
        if (pile.frac >= 1.148 && (pouring || ext) && !spilled) { spilled = true; m.ev.push('spill'); }
        if (!full && pile.frac >= 1) { full = true; m.ev.push('full'); }
        if ((!dig || !ahead) && pile.frac > 0.02) {
          st = 2; m.payload = Math.min(pile.frac, 1.15); m.crowned = m.payload >= 1; m.ev.push('depart'); m.ev.push('rev');
          haulD = inp.dumpX !== undefined ? Math.max(40, (m.x - inp.dumpX) * m.face / sc - 180)
            : (inp.tx !== undefined && (inp.tx - m.x) * m.face < -220 * sc ? (m.x - inp.tx) * m.face / sc - 180 : C_HAUL);
          exhaust.burst(5, 1);
        } else if (!dig && pile.frac <= 0.02) st = 0;
      }
      if (st === 2) {
        offT = -haulD;
        if (Math.abs(offT - m.off) < 7 && Math.abs(offV) < 34) { st = 3; td = 0; slid = false; m.ev.push('raise'); }
      }
      let bedT = 0;
      sliding = false;
      if (st === 3) {
        td += dt * r; offT = -haulD;
        bedT = C_BMAX;
        if (bed.x > 0.4 && pile.v > 0) {
          sliding = true;
          if (!slid) { slid = true; m.ev.push('dump'); ch.nod(-0.25 * m.face); exhaust.burst(4, 1); }
          pile.take(dt * r * (38 + 90 * (bed.x - 0.4)), 0.04);
        }
        if (pile.v <= 0.01 && slid) { if (td < 90) { td = 100; m.ev.push('empty'); ch.bump(-70 * sc); } if (td > 100.35) { st = 4; m.ev.push('back'); } }
      }
      if (st === 4) {
        offT = 0;
        if (Math.abs(m.off) < 7 && Math.abs(offV) < 34 && bed.x < 0.05) { st = dig && ahead ? 1 : 0; pourT = 0.6; spilled = false; full = false; m.ev.push('arrive'); if (st === 1) m.ev.push('load'); }
      }
      // deslocamento próprio (ré até a descarga e volta): acelera e freia com peso
      const vmax = (st === 2 ? 300 : 340) * r, want = clamp((offT - m.off) * 4, -vmax, vmax);
      offV = damp(offV, want, st === 3 ? 6 : 3.6 * r, dt);
      m.off += offV * dt;
      m.rev = damp(m.rev, offV < -6 || m.vx * m.face < -8 ? 1 : 0, 12, dt);
      // caçamba
      setK(bed, (bedT > bed.x ? 16 : 22) * r * r, 1.0);
      const bx0 = bed.x; bed.target = bedT; bed.update(dt);
      if (bx0 > 0.02 && bed.x <= 0.02 && bedT === 0) { m.ev.push('clank'); bedJ.kick(50); ch.bump(40 * sc); }
      if (bed.x < 0) bed.x = 0;
      bedJ.update(dt);
      pile.tilt = clamp(-bed.x * 2.2 - offV * 0.0006, -1, 1);
      pile.update(dt);
      flow = damp(flow, sliding ? 1 : 0, 10, dt);
      m.load = clamp(pile.frac, 0, 1.15);
      // suspensão
      const wx = m.x + m.face * m.off * sc;
      ch.load = pile.frac * 11 * sc; ch.bias = -bed.x * 0.012 - pile.frac * 0.006;
      ch.update(dt, wx, m.face);
      if (pile.frac - f0 > 0.0001 && !ext) { extK += dt; if (extK > 0.25) { extK = 0; ch.bump(14 * sc); } }
      const speed = Math.abs(ch.vx) / sc;
      fast = speed > 80;
      m.power = damp(m.power, clamp(speed / 240 + (bedT > bed.x + 0.05 ? 0.7 : 0) + (st === 2 || st === 4 ? 0.3 : 0), 0, 1), 5, dt);
      mirror.kick((ch.heave.v * 0.02 + Math.sin(m.t * 37) * (0.6 + m.power * 2)) * dt * 60 * 0.05); mirror.update(dt);
      flap.target = exhaust.pulse * 0.9 + m.power * 0.5; flap.update(dt);
      // estado público
      m.state = st === 0 ? 'idle' : st === 1 ? 'load' : st === 2 ? 'haul' : st === 3 ? 'dump' : 'back';
      m.wantsLoad = st === 1; m.busy = st !== 0;
      m.ph = st === 0 ? 0 : st === 1 ? 0.45 * clamp(pile.frac, 0, 1) : st === 2 ? 0.45 + 0.17 * clamp(-m.off / haulD, 0, 1)
        : st === 3 ? 0.62 + 0.2 * clamp(td > 90 ? 1 : td / 2.4, 0, 1) : 0.82 + 0.18 * (1 - clamp(-m.off / haulD, 0, 1));
      // âncoras
      bedPt(75, -100, tmp); const btx = tmp.x; wPt(tmp.x, tmp.y, tmp);
      m.bedO.x = tmp.x; m.bedO.y = tmp.y; m.bedO.w = C_BED_AT.w * sc;
      const b = m.biteO; b.x = tmp.x; b.y = tmp.y; b.r = 60 * sc; b.active = pouring; b.phase = m.ph;
      streamTop = tmp.y - 300 * sc;
      if (pouring) {
        const top = pile.topAt(0.5, C_PH);
        bedPt(75, -8 - top, tmp2); wPt(tmp2.x, tmp2.y, tmp2);
        m.acc2 += dt * 70; const n = m.acc2 | 0; m.acc2 -= n;
        spray(m, tmp2.x, tmp2.y, n, -PI / 2, 40, 150, 1.3);
      }
      if (spilled && st === 1 && (pouring || ext) && pile.frac >= 1.14) { m.acc += dt * 50; const n = m.acc | 0; m.acc -= n; wPt(btx + (Math.random() < 0.5 ? -90 : 80), -190, tmp2); spray(m, tmp2.x, tmp2.y, n, PI / 2, 20, 70, 0.6); }
      bedPt(-50, -52, tmp); wPt(tmp.x, tmp.y, tmp);
      const d = m.dumpO; d.x = tmp.x; d.y = tmp.y; d.active = sliding;
      if (sliding) { m.acc += dt * 240; const n = m.acc | 0; m.acc -= n; spray(m, tmp.x, tmp.y, n, PI / 2 + m.face * 0.5, 60, 200, 0.5); if (Math.random() < dt * 8) puff(m, tmp.x - m.face * 30 * sc, m.floorF(tmp.x) - 6, 1, 12 * sc, DUSTW); }
      wPt(92, -150, tmp); m.seatO.x = tmp.x; m.seatO.y = tmp.y;
      wPt(126, -182, tmp);
      exhaust.update(dt, tmp.x, tmp.y, m.power, -m.face * 0.25, -1);
      if (speed > 30) { m.dist += speed * dt; if (m.dist > 46) { m.dist = 0; const wl = ch.wheels[ch.vx * m.face > 0 ? 0 : 1]; puff(m, wl.wx, wl.wy + wl.r - 3, 2, 10 * sc, DUST); } }
    }

    function drawBed(g, f, t) {
      g.save(); g.translate(C_PX, C_PY + bedJ.x); g.rotate(-bed.x);
      Draw.poly(g, C_BEDIN, sh(BODY, -0.42), PLAIN);                               // lado de lá da caçamba (interior)
      g.save(); g.beginPath(); g.moveTo(-46, -330); g.lineTo(-50, -56); g.lineTo(14, -6); g.lineTo(166, -6); g.lineTo(188, -90); g.lineTo(188, -330); g.closePath(); g.clip();
      pile.draw(g, 75, -8, 206, C_PH, C_PILEO);
      g.restore();
      Draw.poly(g, C_BED, BODY, C_BEDO);
      g.fillStyle = sh(BODY, -0.2);
      for (let i = 0; i < 5; i++) { const x = 26 + i * 30; g.fillRect(x, -74 - i * 5.2, 4.5, 68 + i * 5.2); }   // nervuras
      g.fillRect(16, -12, 150, 6);
      g.fillStyle = sh(BODY, 0.3); g.beginPath(); g.moveTo(-42, -70); g.lineTo(178, -107.5); g.lineTo(288, -106); g.lineTo(288, -103); g.lineTo(178, -104); g.lineTo(-42, -66.5); g.fill();
      g.fillStyle = sh(BODY, -0.3); g.beginPath(); g.moveTo(192, -90); g.lineTo(288, -98); g.lineTo(288, -100.5); g.lineTo(192, -93); g.fill();
      Draw.hazard(g, 240, -106.5, 48, 6, HAZ0);
      // luzes de carga (33 / 66 / 100 %; vermelha piscando acima de 115 %)
      const L = pile.frac;
      Draw.light(g, 172, -72, 3.2, PAL.grassL, L >= 0.33); Draw.light(g, 172, -62, 3.2, PAL.goldL, L >= 0.66); Draw.light(g, 172, -52, 3.2, PAL.red, L >= 1.148 ? (Math.sin(t * 20) > 0 ? 1 : 0.2) : L >= 1 ? 1 : 0);
      Draw.box(g, 72, -52, 50, 22, PAL.cream, C_TAG);
      label(g, '797', 97, -40.5, 15, PAL.blk, f);
      // tiras de borracha (mud flaps) e lanternas na cauda
      Draw.box(g, -6, -8, 5, 22, PAL.blk, THIN);
      Draw.light(g, -40, -60, 2.8, PAL.red, 0.35 + 0.65 * (offV > -4 && offV < 4 && st !== 0 ? 1 : 0));
      Rig.pin(g, 0, 0, 6);
      g.restore();
    }
    function drawFront(g, f, t) {
      // motor, grade, para-choque
      Draw.box(g, 150, -64, 28, 30, PAL.blk, R3);
      Draw.poly(g, C_HOOD, BODY, C_BEDO);
      g.fillStyle = sh(BODY, -0.26); for (let i = 0; i < 5; i++) g.fillRect(70 + i * 7, -112, 3.6, 30);
      Draw.box(g, 154, -120, 20, 54, PAL.blk, R2);
      g.fillStyle = PAL.grayD; for (let i = 0; i < 6; i++) g.fillRect(156, -116 + i * 8.4, 16, 3);
      Draw.light(g, 172, -72, 3.6, PAL.goldL, true); Draw.light(g, 172, -110, 3, PAL.goldL, m.night ? 1 : 0.6);
      Draw.hazard(g, 152, -42, 26, 7, HAZ0);
      // cabine minúscula com o Kome
      Draw.box(g, 72, -170, 46, 46, PAL.blk, R2);
      g.fillStyle = PAL.glassD; g.fillRect(80, -166, 32, 26);
      g.save(); g.beginPath(); g.rect(80, -166, 32, 26); g.clip();
      shO.fast = fast; shiba(g, 94, -133, 'drive', t, 0.56, m.pal); shO.fast = false;
      g.fillStyle = 'rgba(255,255,255,.26)'; g.beginPath(); g.moveTo(102, -166); g.lineTo(109, -166); g.lineTo(96, -140); g.lineTo(89, -140); g.fill();
      g.restore();
      g.strokeStyle = LINE; g.lineWidth = 2.2; g.strokeRect(80, -166, 32, 26);
      g.fillStyle = BODY; g.fillRect(73, -139, 44, 14); g.fillRect(73, -169, 6, 32); g.fillRect(112.6, -169, 4.4, 32); g.fillRect(73, -169.5, 44, 3);
      g.fillStyle = LINE; g.fillRect(73, -140, 44, 1.4);
      // deque, guarda-corpo, escada diagonal na frente, retrovisor
      Draw.box(g, 54, -128, 126, 5, PAL.steelD, R1);
      Draw.rail(g, pa(122, -128), pb(180, -128), C_RAIL);
      Draw.stairs(g, pa(182, -30), pb(130, -126), 9, C_STAIR);
      const mw = mirror.x;
      Draw.beam(g, ln(178, -144, 190, -160 + mw), 2, PAL.blk, NOHI); Draw.box(g, 187, -172 + mw, 6, 14, PAL.glass, THIN_R);
      // escapamentos
      g.save(); g.translate(126, -128);
      Draw.box(g, -3, -52, 6, 52, PAL.steelD, THIN); Draw.box(g, -5, -34, 10, 20, PAL.blk, R2);
      g.translate(-3, -53); g.rotate(-0.1 - flap.x); Draw.box(g, 0, -1.6, 8, 2.4, PAL.steelD, THIN);
      g.restore();
      // shibas minúsculos: um no deque, um subindo a escada (só parado)
      shiba(g, 160, -128, st === 1 ? 'wave' : 'sit', t, 0.25, 'goma');
      if (st < 2 && Math.abs(ch.vx) < 20 * sc) { const q = (t * 0.22) % 1; shiba(g, 180 - q * 48, -34 - q * 90, 'climb', t, 0.25, 'kuro'); }
    }
    function drawFrame(g, t) {
      Draw.box(g, -152, -76, 306, 22, PAL.blk, R4);                                // longarina
      Draw.box(g, -150, -96, 40, 26, PAL.blk, R3);                                 // mancal da caçamba
      Draw.box(g, -112, -70, 70, 42, PAL.blkL, R6);                                // eixo traseiro / diferencial
      Draw.box(g, -14, -72, 64, 40, PAL.gray, R4);                                 // tanque
      g.fillStyle = sh(PAL.gray, -0.25); g.fillRect(-12, -40, 60, 6); g.fillStyle = LINE; g.fillRect(8, -72, 1.6, 40); g.fillRect(28, -72, 1.6, 40);
      Draw.box(g, 2, -84, 12, 12, PAL.steelD, THIN_R);
      // luz de ré + sirene
      const blink = m.rev > 0.3 && Math.sin(t * 20) > 0;
      Draw.box(g, -160, -72, 10, 16, PAL.blk, R2);
      Draw.light(g, -159, -66, 3.4, PAL.white, m.rev > 0.3 ? 1 : 0); Draw.light(g, -159, -58, 2.8, PAL.ora, blink ? 1 : 0.15);
    }

    function draw(g) {
      const f = visFace(m), t = m.t;
      Draw.shadow(g, ch.x, m.floorF(ch.x) + 3 * sc, 178 * sc * Math.max(0.3, Math.abs(f)), 8 * sc, 0.22);
      g.save(); g.translate(ch.x, ch.y); g.rotate(ch.tilt); g.scale(f * sc, sc);
      const w0 = ch.wheels[0], w1 = ch.wheels[1];
      Draw.wheel(g, w0.lx / sc + 10, w0.ly / sc - 5, 50, w0.rot, cWheelF); Draw.wheel(g, w1.lx / sc + 10, w1.ly / sc - 5, 50, w1.rot, cWheelF);
      drawFrame(g, t);
      // cilindro de basculamento telescópico
      bedPt(C_TAX, C_TAY, tmp);
      const dx = tmp.x - C_TBX, dy = tmp.y - C_TBY, d = Math.hypot(dx, dy);
      tel.draw(g, C_TBX, C_TBY, Math.atan2(dy, dx), clamp((d - tel.min) / (tel.max - tel.min), 0, 1));
      Rig.pin(g, C_TBX, C_TBY, 5);
      drawFront(g, f, t);
      drawBed(g, f, t);
      Rig.pin(g, tmp.x, tmp.y, 4.5);
      // pneus de perto (gigantes) e para-lamas
      Draw.wheel(g, w0.lx / sc, w0.ly / sc, 50, w0.rot, cWheel); Draw.wheel(g, w1.lx / sc, w1.ly / sc, 50, w1.rot, cWheel);
      Draw.box(g, 146, -66, 34, 8, BODY, R2);
      g.restore();
      exhaust.draw(g);
      // lençol de arroz escorrendo da cauda
      if (flow > 0.03) {
        const d0 = m.dumpO, gy = m.floorF(d0.x - m.face * 30 * sc), wd = 30 * sc * flow, k = m.face;
        g.fillStyle = PAL.rice; g.strokeStyle = LINE; g.lineWidth = 1.6 * sc;
        g.beginPath(); g.moveTo(d0.x + k * 6 * sc, d0.y - 4 * sc);
        g.quadraticCurveTo(d0.x - k * 18 * sc, d0.y + 6 * sc, d0.x - k * (26 * sc + wd), gy);
        g.lineTo(d0.x - k * (10 * sc - wd * 0.3), gy);
        g.quadraticCurveTo(d0.x - k * 2 * sc, d0.y + 26 * sc, d0.x + k * 20 * sc, d0.y + 8 * sc);
        g.closePath(); g.fill(); g.stroke();
        g.fillStyle = PAL.riceS; for (let i = 0; i < 4; i++) { const q = (t * 2.2 + i * 0.25) % 1; g.fillRect(d0.x - k * (6 + 20 * q) * sc, lerp(d0.y, gy, q * q), 4 * sc, 2 * sc); }
      }
      // jorro de carga "de cima" (só quando roda sozinho, sem pá ajudante)
      if (pouring) {
        const x = m.bedO.x, top = pile.topAt(0.5, C_PH) * sc, y1 = m.bedO.y + 92 * sc - top, y0 = streamTop;
        const wv = Math.sin(t * 17) * 2 * sc;
        g.fillStyle = PAL.rice; g.strokeStyle = LINE; g.lineWidth = 1.6 * sc;
        g.beginPath(); g.moveTo(x - 9 * sc, y0); g.quadraticCurveTo(x - 14 * sc + wv, (y0 + y1) / 2, x - 20 * sc, y1); g.lineTo(x + 20 * sc, y1); g.quadraticCurveTo(x + 14 * sc + wv, (y0 + y1) / 2, x + 9 * sc, y0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = PAL.riceS; for (let i = 0; i < 6; i++) { const q = (t * 2.6 + i / 6) % 1; g.fillRect(x - 7 * sc + (i % 3) * 5 * sc, lerp(y0, y1, q * q), 3 * sc, 7 * sc); }
        Draw.box(g, x - 16 * sc, y0 - 14 * sc, 32 * sc, 16 * sc, PAL.steelD, R3);   // bica
      }
      parkPickup(g, m, -40);
    }
    m.update = update; m.drawFn = draw;
    return m;
  }

  /* ======================================================================
     registro
     ====================================================================== */
  function reg(id, name, kind, w, h, make, meta) {
    G.Tools[id] = {
      id, name, kind, w, h, meta,
      create(opts) { return make(opts || {}); },
      update(m, dt, inp) { m.update(dt, inp || NOINP); },
      draw(g, m) { m.drawFn(g); },
      bite(m) { return m.biteO; },
      dump(m) { return m.dumpO; },
      seat(m) { return m.seatO; },
    };
    return G.Tools[id];
  }
  const NOINP = { x: 0, y: 0, face: 1 };
  reg('pacabo', 'Pá de Cabo Elétrica', 'rope', 700, 470, makePacabo, { zoom: 0.46, shake: 0.7, cycle: P_CYCLE, dumpAt: P_DUMP_AT, reach: 280 });
  const T = reg('caminhao', 'Caminhão de Mineração', 'haul', 352, 202, makeCaminhao, { zoom: 0.36, shake: 0.6, cycle: C_CYCLE, bed: C_BED_AT, haul: C_HAUL, tail: -178 });
  // fill(m, fração 0..1) -> quanto coube: carga vinda de fora (conchada da pá ajudante)
  T.fill = (m, v) => m.fill(v);
  // parkX: onde estacionar o caminhão (mesma face da pá) pra conchada cair no meio da caçamba
  T.parkX = (shovelX, shovelFace, shovelScale, truckScale) => shovelX + (shovelFace < 0 ? -1 : 1) * (P_DUMP_AT.x * (shovelScale || 1) - C_BED_AT.x * (truckScale || 1));
})();
