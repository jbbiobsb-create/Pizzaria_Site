/* Kome no Japão — machines-mid.js
   Degraus do meio da escada de ferramentas: 'trator' (trator agrícola com carregadeira frontal), 'empilhadeira'
   (mastro telescópico de 2 estágios, arranca blocos de arroz prensado) e 'escav' (escavadeira hidráulica, IK de 3 ossos).
   Depende de: core.js, pix.js, shiba.js, fx.js, terrain.js, rig.js.

   Interface comum (G.Tools[id]): create(opts) -> m; update(m, dt, inp); draw(g, m); bite(m); dump(m); seat(m); m.ev; meta.
   Espaço do modelo: origem no contato com o chão (inp.x, inp.y), +x = frente da máquina, y pra baixo, unidades = px de arte.
   Estado extra útil pro jogo (só leitura): m.off (avanço/recuo próprio da máquina dentro do ciclo, em unidades do modelo),
   m.ph (fase 0..1 do ciclo), m.busy (ciclo em andamento), m.load (0..1 de carga visível), m.power (0..1 esforço do motor). */
(function () {
  'use strict';
  const E = window.Pixxel;
  if (!E || !E.Rig) throw new Error('machines-mid.js: carregue core, pix, shiba, fx, terrain e rig antes');
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, Rig = E.Rig, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const seg = (u, a, b) => smooth((u - a) / (b - a));          // 0 antes de a, 1 depois de b, suave no meio
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

  const shc = new Map();
  function sh(c, k) { const key = c + '|' + k; let v = shc.get(key); if (v === undefined) { v = U.shade(c, k); shc.set(key, v); } return v; }

  /* ---- rascunhos reaproveitados (zero alocação por frame) ---- */
  const LN = [[0, 0], [0, 0]], LN3 = [[0, 0], [0, 0], [0, 0]], CA = [0, 0], CB = [0, 0];
  function ln(a, b, c, d) { LN[0][0] = a; LN[0][1] = b; LN[1][0] = c; LN[1][1] = d; return LN; }
  function ln3(a, b, c, d, e, f) { LN3[0][0] = a; LN3[0][1] = b; LN3[1][0] = c; LN3[1][1] = d; LN3[2][0] = e; LN3[2][1] = f; return LN3; }
  const R1 = { r: 1 }, R2 = { r: 2 }, R3 = { r: 3 }, R4 = { r: 4 }, R5 = { r: 5 }, R6 = { r: 6 }, R8 = { r: 8 };
  const NOHI = { hi: false }, FLAT = { ol: 0, top: false, shade: false, r: 1.5 }, THIN = { ol: 1.2 }, THIN_R = { ol: 1.2, r: 1.5 };
  const PLAIN = { hi: false, shade: false }, PLAIN0 = { ol: 0, hi: false, shade: false };
  const shibaO = { scale: 0.8, shadow: false, pal: 'kome', fast: false };
  const tmp = { x: 0, y: 0, rot: 0 }, tmp2 = { x: 0, y: 0, rot: 0 }, ikO = {}, ikL = {};
  const GRAIN = { shape: 'grain', c: [PAL.rice, PAL.rice, PAL.riceS], land: true, w: 2, life: 1.5, ol: true, speed: [30, 90], spread: 0.7, dir: PI / 2 };
  const CRUMB = { shape: 'rect', c: [PAL.press, PAL.pressD, PAL.rice], land: true, w: [2, 3.6], life: 1.2, ol: true, speed: [40, 150], spread: 0.9, dir: -PI / 2, vr: 8 };
  const DUST = { c: PAL.sand }, DUSTW = { c: PAL.cream };

  function spray(m, x, y, n, mold, dir, s0, s1, spread) {
    if (!m.parts || n <= 0) return;
    mold.dir = dir; mold.speed[0] = s0; mold.speed[1] = s1; mold.spread = spread;
    m.parts.spray(x, y, n, mold);
  }
  function puff(m, x, y, n, size, o) { if (m.parts) m.parts.puff(x, y, n, size, o || DUST); }

  /* ---- estado e utilidades comuns ---- */
  function baseState(id, opts) {
    opts = opts || {};
    const m = {
      id, sc: opts.scale || 1, pal: opts.pilot || 'kome', t: 0, ev: [],
      x: 0, y: 0, face: 1, turn: 1, off: 0, ph: 0, busy: false, load: 0, power: 0, idle: 0,
      fl: null, gy: 0, parts: null, rate: 1, acc: 0, acc2: 0, dist: 0, lastX: NaN, vx: 0,
      biteO: { x: 0, y: 0, r: 0, active: false, phase: 0, w: 0, h: 0 }, dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
      floorF: null,
    };
    m.floorF = x => (m.fl ? m.fl(x) : m.gy);
    return m;
  }
  // lê o inp, calcula ritmo e a virada "de papel"
  function begin(m, dt, inp) {
    m.ev.length = 0;
    m.t += dt;
    m.fl = typeof inp.floor === 'function' ? inp.floor : null; m.gy = inp.y || 0;
    m.parts = inp.parts || null;
    m.x = inp.x || 0; m.y = inp.y || 0;
    m.face = inp.face < 0 ? -1 : 1;
    m.turn = clamp(m.turn + (m.face - m.turn > 0 ? 1 : -1) * Math.min(Math.abs(m.face - m.turn), dt * 6), -1, 1);
    const pw = inp.power === undefined ? 1 : clamp(inp.power, 0, 1);
    m.rate = clamp((inp.speedMul || 1) * (0.72 + 0.28 * pw) * (1 + 0.15 * (inp.boost || 0)), 0.4, 2.6);
    m.vx = inp.vx !== undefined ? inp.vx : (m.lastX === m.lastX && dt > 0 ? (m.x - m.lastX) / dt : 0);
    m.lastX = m.x;
  }
  const visFace = m => { const f = Math.sin(m.turn * PI / 2); return Math.abs(f) < 0.12 ? (m.turn >= 0 ? 0.12 : -0.12) : f; };
  // junta com ritmo: guarda os valores de fábrica e escala rigidez/vazão com a velocidade do jogo
  function J(ang, o) { const j = E.Joint(ang, o); j.k0 = j.k; j.d0 = j.d; j.s0 = j.speed; return j; }
  function tune(j, r) { j.k = j.k0 * r * r; j.d = j.d0 * r; j.speed = j.s0 * r; }
  // fase do ciclo: começa quando segura, sempre termina o ciclo começado
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

  /* ======================================================================
     TRATOR — trator agrícola com carregadeira frontal
     ====================================================================== */
  const T_BOOM = [[0, 0, 5.5], [48, 6, 8.2], [70, 58, 5]];
  const T_BOOM_RIB = [[14, 2, 2.2], [44, 6.5, 2.6]], T_KNEE = [[44, 3, 4], [40, -9, 3.2]], T_EAR = [[36, 9, 3.6], [38, 16, 3]];
  const T_TOWER = [[5, -36, 7], [6, -70, 6]], T_BK_EAR = [[0, -3, 3.6], [3, -17, 3]];
  const T_HOODP = [[0, -66], [44, -66], [54, -60], [56, -44], [0, -40]];
  const tWheelN = { hub: PAL.yelL }, tWheelF = { tire: sh(PAL.blk, -0.35), hub: sh(PAL.yelL, -0.4) };
  const tBk = { col: PAL.steel, load: 0 };
  const T_CYCLE = 1.8;

  function makeTrator(opts) {
    const m = baseState('trator', opts), sc = (m.sc *= 0.86);
    const BODY = PAL.red, ARM = PAL.yel, CYL = PAL.blkL;
    const rig = Rig();
    const ch = E.Chassis({ wheels: [{ x: -30 * sc, r: 27 * sc, travel: 4 * sc }, { x: 38 * sc, r: 16 * sc, travel: 4 * sc }], floor: m.floorF, k: 130, d: 9, tiltK: 90, tiltD: 8, squat: 0.0022 });
    const jb = J(-0.12, { k: 62, d: 11.5, min: -1.03, max: 0.09, speed: 2.7 });
    const jk = J(-0.3, { k: 150, d: 17, min: -1.25, max: 2.1, speed: 7.5 });
    const offS = E.Spring(0, { k: 60, d: 12 }), seat = E.Spring(0, { k: 190, d: 9 }), antenna = E.Spring(0, { k: 70, d: 3.2 });
    const flap = E.Spring(0, { k: 220, d: 9 }), charm = E.Spring(0, { k: 38, d: 1.6 }), bkS = E.Spring(0, { k: 260, d: 10 });
    const exhaust = E.Exhaust({ size: 2.3 * sc, rate: 4.2, rise: 30 * sc, wind: -5 });
    const pile = E.Pile({ cap: 100, cols: 14, slope: 0.07, max: 1.25 });
    m.rig = rig; m.ch = ch; m.J = { boom: jb, bucket: jk }; m.pile = pile; m.exhaust = exhaust;
    let abs = -0.3, fast = false;

    const wheelDraw = far => (g, p) => Draw.wheel(g, 0, 0, p.data.r / sc, p.data.rot, far ? tWheelF : tWheelN);
    rig.part('wRearF', { z: -10, data: ch.wheels[0], draw: wheelDraw(true) });
    rig.part('wFrontF', { z: -10, data: ch.wheels[1], draw: wheelDraw(true) });
    rig.part('body', { z: 0, draw: drawBody });
    rig.part('driver', { parent: 'body', z: 0.5, x: -25, y: -57, draw: drawDriver });
    rig.part('cab', { parent: 'body', z: 1, draw: drawCab });
    rig.part('hood', { parent: 'body', z: 2, draw: drawHood });
    rig.part('wRear', { z: 4, data: ch.wheels[0], draw: wheelDraw(false) });
    rig.part('wFront', { z: 4, data: ch.wheels[1], draw: wheelDraw(false) });
    rig.part('fender', { parent: 'body', z: 4.5, draw: drawFender });
    rig.part('tower', { parent: 'body', z: 5, draw: g => {
      Draw.beam(g, ln(4, -42, -22, -37), 4, sh(ARM, -0.25), NOHI);                 // escora do subchassi até o eixo de trás
      Rig.plate(g, T_TOWER, sh(ARM, -0.12)); Rig.pin(g, 18, -33, 2.6);
    } });
    rig.part('boomF', { parent: 'body', z: -8, x: 10, y: -72.5, draw: g => Rig.plate(g, T_BOOM, sh(ARM, -0.32), NOHI) });
    rig.part('boom', { parent: 'body', z: 7, x: 6, y: -70, joint: jb, draw: g => {
      Rig.plate(g, T_EAR, sh(ARM, -0.2), PLAIN);
      Rig.plate(g, T_KNEE, sh(ARM, -0.2), PLAIN);
      Rig.plate(g, T_BOOM, ARM);
      Rig.plate(g, T_BOOM_RIB, sh(ARM, -0.2), PLAIN0);
      Draw.circle(g, 48, 6, 3.4, sh(ARM, -0.3), THIN);                            // tubo travessa entre os dois braços
      Rig.pin(g, 0, 0, 3.2); Rig.pin(g, 70, 58, 2.8);
    } });
    rig.part('bucket', { parent: 'boom', z: 6.4, x: 70, y: 58, joint: jk, draw: drawBucket });
    rig.piston('liftF', { a: ['body', 22, -35.5], b: ['boomF', 37, 15], w: 5, z: -9, col: sh(CYL, -0.25) });
    rig.piston('lift', { a: ['body', 18, -33], b: ['boom', 37, 15], w: 6, z: 7.5, col: CYL });
    rig.piston('tilt', { a: ['boom', 40, -9], b: ['bucket', 3, -17], w: 4.6, z: 8, col: CYL });
    rig.calibrate('lift', [['boom', jb.min, jb.max]]);
    rig.calibrate('liftF', [['boomF', jb.min, jb.max]]);
    rig.calibrate('tilt', [['bucket', jk.min, jk.max]]);

    function drawBody(g, p, r, t) {
      Draw.box(g, -52, -35, 9, 5, PAL.blk, R1);                                    // engate
      Draw.circle(g, -51, -29, 2, PAL.steelD, THIN);
      Draw.box(g, -46, -46, 50, 20, PAL.blkL, R4);                                 // caixa de câmbio / eixo traseiro
      Draw.box(g, -2, -40, 56, 12, PAL.blk, R3);                                   // bloco do motor
      Draw.box(g, 14, -31, 22, 6, PAL.grayD, R2);                                  // cárter
      Draw.circle(g, 8, -34, 2.6, PAL.steelD, THIN); Draw.circle(g, 44, -34, 2.2, PAL.steelD, THIN);
      Draw.box(g, 31, -27, 14, 7, PAL.grayD, R2);                                  // pivô do eixo dianteiro
      Draw.box(g, -16, -45, 22, 4, PAL.grayD, R1);                                 // assoalho
      Draw.beam(g, ln(-9, -40, -9, -25), 2, PAL.blk, NOHI); Draw.box(g, -15, -26, 13, 3, PAL.grayD, THIN);   // degrau
      Draw.poly(g, T_DASH, BODY);                                                  // painel
      Draw.light(g, -49, -52, 2.2, PAL.red, 0.35 + 0.3 * (Math.sin(t * 5) > 0.6 ? 1 : 0));                   // lanterna traseira
    }
    function drawDriver(g, p, r, t) {
      const by = seat.x;
      Draw.box(g, -13, -19 + by, 6, 21, PAL.blk, R2);                              // encosto
      Draw.box(g, -12, -1 + by, 20, 5, PAL.blk, R2);                               // assento
      Draw.beam(g, ln(-2, 4, -2, 9), 2, PAL.steelD, NOHI);                         // mola do banco
      shibaO.scale = 1; shibaO.pal = m.pal; shibaO.fast = fast;
      E.drawShiba(g, -2, by, 'drive', t, shibaO);
      Draw.beam(g, ln(21, -3, 15, -13 + by * 0.3), 2.2, PAL.blk, NOHI);            // coluna do volante
      Draw.ring(g, 14.5, -13.5 + by * 0.3, 5, 1.8, PAL.blk, THIN);
    }
    function drawCab(g, p, r, t) {
      Draw.beam(g, ln(-47, -50, -49, -108), 4, PAL.blk, NOHI);                     // santantônio
      Draw.beam(g, ln(1, -66, -1, -108), 2.2, PAL.blk, NOHI);
      g.save(); g.translate(0, -7);
      Draw.box(g, -57, -109, 64, 7, PAL.cream, T_ROOF);
      Draw.box(g, -57, -103.5, 64, 1.5, PAL.red, FLAT);
      // giroflex
      Draw.box(g, -30, -114, 8, 5, PAL.ora, THIN_R);
      Draw.light(g, -26 + Math.cos(t * 9) * 2, -112, 2, PAL.goldL, 0.5 + 0.5 * Math.sin(t * 9));
      // antena com mola e bandeirinha
      const a = antenna.x;
      g.strokeStyle = LINE; g.lineWidth = 1.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-52, -109); g.quadraticCurveTo(-52 - a * 14, -122, -52 + a * 18, -134); g.stroke();
      const fx = -52 + a * 18, fw = Math.sin(t * 7 + a * 4) * 1.5;
      g.beginPath(); g.moveTo(fx, -134); g.lineTo(fx - 9, -131.5 + fw); g.lineTo(fx, -129); g.closePath();
      g.fillStyle = PAL.red; g.fill(); g.lineWidth = 1; g.stroke();
      // amuleto pendurado no teto (balança com a máquina)
      g.save(); g.translate(3, -101); g.rotate(charm.x);
      g.strokeStyle = LINE; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 8); g.stroke();
      Draw.box(g, -2.4, 8, 4.8, 6.5, PAL.gold, THIN_R);
      g.fillStyle = PAL.red; g.fillRect(-1.2, 10, 2.4, 2.6);
      g.restore();
      g.restore();
    }
    function drawHood(g, p, r, t) {
      // escapamento: cano, abafador e tampinha de chuva que bate com o pulso
      Draw.box(g, 20, -92, 4.4, 30, PAL.steelD, THIN);
      Draw.box(g, 18, -82, 8.4, 13, PAL.blk, R2);
      g.save(); g.translate(19.4, -93.2); g.rotate(-0.12 - flap.x);
      Draw.box(g, 0, -1.6, 7.6, 2.2, PAL.steelD, THIN);
      g.restore();
      Draw.box(g, 36, -73, 7, 8, PAL.steel, T_PRE);                                // pré-filtro de ar
      Draw.poly(g, T_HOODP, BODY, T_HOODO);
      g.fillStyle = sh(BODY, 0.3); g.fillRect(3, -64.6, 40, 1.8);
      g.fillStyle = sh(BODY, -0.28); for (let i = 0; i < 4; i++) g.fillRect(27 + i * 4.6, -57, 2.4, 9);     // respiros
      Draw.box(g, 4, -47.5, 34, 3, PAL.cream, FLAT);                               // faixa
      Draw.circle(g, 12, -56, 3.4, PAL.gold, THIN);                                // emblema
      g.fillStyle = PAL.red; g.fillRect(10.6, -57, 2.8, 2);
      Draw.box(g, 52.5, -61, 5, 19, PAL.blk, T_GRILLE);                            // grade
      g.fillStyle = PAL.blkL; for (let i = 0; i < 4; i++) g.fillRect(53.6, -58.6 + i * 4.2, 3, 1.6);
      Draw.light(g, 55.5, -63.5, 2.8, PAL.goldL, true);
      Draw.box(g, 50, -42, 9, 5, PAL.blk, R2);                                     // contrapeso dianteiro
    }
    function drawFender(g) {
      g.lineCap = 'round';
      g.beginPath(); g.arc(-30, -24, 31.5, PI * 1.03, PI * 1.9);
      g.strokeStyle = LINE; g.lineWidth = 10; g.stroke();
      g.strokeStyle = BODY; g.lineWidth = 6; g.stroke();
      g.beginPath(); g.arc(-30, -24, 32.8, PI * 1.1, PI * 1.84);
      g.strokeStyle = sh(BODY, 0.3); g.lineWidth = 1.7; g.stroke();
      g.beginPath(); g.arc(-30, -24, 29.8, PI * 1.1, PI * 1.84);
      g.strokeStyle = sh(BODY, -0.25); g.lineWidth = 1.4; g.stroke();
    }
    function drawBucket(g) {
      const k = 40 / 34, q = bkS.x;
      g.save(); g.scale(1 + q * 0.04, 1 - q * 0.05);
      Rig.plate(g, T_BK_EAR, sh(PAL.gray, -0.1));
      // monte de arroz assentando dentro da boca (E.Pile), atrás da chapa lateral
      g.save(); g.translate(25.9, -11.8); g.rotate(0.824);
      pile.draw(g, 0, 7, 37, 17);
      g.restore();
      Rig.bucket(g, 40, tBk);
      Draw.beam(g, ln(11.5 * k, -24 * k, 33 * k, 1.5 * k), 2, PAL.steelD, PLAIN0);   // lâmina de desgaste da boca
      g.restore();
    }

    function update(dt, inp) {
      begin(m, dt, inp);
      const r = m.rate, dig = !!inp.digging;
      tune(jb, r); tune(jk, r); offS.k = 60 * r * r; offS.d = 12 * r;
      const p0 = cycle(m, dt, dig, T_CYCLE), u = m.ph;
      const h = clamp((m.gy - (inp.ty !== undefined ? inp.ty : m.gy)) / sc - 8, 0, 44), boomDig = 0.035 - h / 80;
      let boomT, offT = 0, biting = false, dumping = false;
      const moving = Math.abs(m.vx) > 18;
      if (m.busy) {
        if (u < 0.24) { boomT = boomDig; abs = lerp(abs, 0.05, 1 - Math.exp(-14 * dt * r)); offT = lerp(-5, 20, seg(u, 0.03, 0.22)); }
        else if (u < 0.46) { const s = seg(u, 0.24, 0.44); boomT = boomDig - 0.14 * s; abs = lerp(0.05, -0.98, s); offT = 20 + 4 * s; biting = true; }
        else if (u < 0.69) { const s = seg(u, 0.46, 0.67); boomT = lerp(boomDig - 0.14, -1.0, s); abs = -0.98; offT = lerp(24, -12, s); }
        else if (u < 0.93) { boomT = -1.0; abs = lerp(-0.98, 0.95, seg(u, 0.69, 0.79)); offT = -12; dumping = true; }
        else { const s = seg(u, 0.93, 1); boomT = lerp(-1.0, -0.5, s); abs = lerp(0.95, 0, s); offT = lerp(-12, -5, s); dumping = true; }
        if (crossed(m, p0, 0.2)) { m.ev.push('hit'); ch.nod(0.3); bkS.kick(2.4); exhaust.burst(3, 1); }
        if (crossed(m, p0, 0.24)) m.ev.push('scoop');
        if (crossed(m, p0, 0.47)) { m.ev.push('rev'); exhaust.burst(2, 0.8); }
        if (crossed(m, p0, 0.74)) { m.ev.push('dump'); ch.nod(-0.3); }
      } else {
        // parado: caçamba pousada, respirando; andando: posição de transporte
        boomT = moving ? Math.min(boomDig, -0.2) : boomDig - 0.05 + Math.sin(m.t * 1.1) * 0.012;
        abs = lerp(abs, moving ? -0.55 : -0.12, 1 - Math.exp(-6 * dt));
      }
      jb.set(boomT);
      offS.target = offT; offS.update(dt); m.off = offS.x;
      // carga: enche na báscula, esvazia ao virar lá em cima
      if (biting) pile.add(dt * r / (0.2 * T_CYCLE) * 105, 0.72, 0.3);
      const wx = m.x + m.face * m.off * sc;
      ch.load = pile.frac * 1.5 * sc; ch.bias = pile.frac * 0.02 + (-jb.x) * 0.014;
      ch.update(dt, wx, m.face);
      jk.set(abs - jb.x);
      const bv = jb.v;
      rig.update(dt);
      if (jb.hit > 0.3) { ch.nod(0.4); m.ev.push('clank'); }
      ch.lean.kick((jb.v - bv) * 0.05 * m.face);
      const speed = Math.abs(ch.vx) / sc;
      m.power = damp(m.power, clamp(speed / 90 + Math.abs(jb.v) * 0.7 + Math.abs(jk.v) * 0.14 + (m.busy ? 0.25 : 0), 0, 1), 6, dt);
      fast = speed > 60;
      const body = rig.get('body');
      body.y = -3 + Math.sin(m.t * 41) * (0.22 + m.power * 0.32);
      rig.get('hood').y = Math.sin(m.t * 41 + 1.3) * (0.28 + m.power * 0.42) - exhaust.pulse * 0.55;
      rig.get('boomF').rot = jb.x;
      placeWheel(rig, 'wRear', ch.wheels[0], sc, 4, -2.5); placeWheel(rig, 'wFront', ch.wheels[1], sc, 4, -2.5);
      const jolt = (-ch.ax * 0.0008 * m.face + ch.lean.v * 0.6) * dt * 60;
      antenna.kick(jolt); antenna.update(dt);
      charm.kick(-jolt * 1.6 + Math.sin(m.t * 41) * m.power * 0.02); charm.update(dt);
      seat.kick((ch.heave.v * 0.05 + Math.sin(m.t * 41) * (1 + m.power * 3)) * dt * 60 * 0.08); seat.update(dt);
      flap.target = exhaust.pulse * 0.9 + m.power * 0.5; flap.update(dt);
      bkS.update(dt);
      // âncoras no mundo
      rig.solve(ch.x, ch.y, m.face, sc, ch.tilt);
      rig.world('bucket', 40, 4, tmp);
      const mouth = tmp.rot * m.face + 0.824;
      pile.tilt = clamp(Math.sin(mouth) * 1.6, -1, 1);
      if (dumping && mouth > 0.75 && pile.v > 0) {
        pile.take(dt * r / (0.09 * T_CYCLE) * 120, 0.9);
        m.acc += dt * 90;
        const n = m.acc | 0; m.acc -= n;
        spray(m, tmp.x, tmp.y, n, GRAIN, PI / 2 - m.face * 0.5, 30, 110, 0.5);
      }
      pile.update(dt);
      m.load = clamp(pile.frac, 0, 1);
      const b = m.biteO; b.x = tmp.x; b.y = tmp.y; b.r = 24 * sc; b.active = biting; b.phase = u;
      if (biting) { m.acc2 += dt * 46; const n = m.acc2 | 0; m.acc2 -= n; spray(m, tmp.x, tmp.y - 3, n, GRAIN, -PI / 2 - m.face * 0.5, 50, 150, 0.8); }
      if (crossed(m, p0, 0.2)) { spray(m, tmp.x, tmp.y - 4, 12, GRAIN, -PI / 2 - m.face * 0.7, 70, 190, 0.7); puff(m, tmp.x, tmp.y, 3, 6 * sc, DUSTW); }
      const d = m.dumpO; d.x = tmp.x; d.y = tmp.y; d.active = dumping && mouth > 0.75 && pile.v > 0;
      rig.world('driver', 4, -30, tmp); m.seatO.x = tmp.x; m.seatO.y = tmp.y;
      rig.world('hood', 22, -94, tmp);
      exhaust.update(dt, tmp.x, tmp.y, m.power, -ch.vx * 0.004, -1);
      wheelDust(m, ch.wheels[0], ch.vx, dt, sc);
    }
    function draw(g) {
      const f = visFace(m);
      Draw.shadow(g, ch.x + m.face * 14 * sc, m.floorF(ch.x) + 2 * sc, 78 * sc * Math.max(0.3, Math.abs(f)), 5 * sc, 0.2);
      exhaust.draw(g);
      DRAWO.face = f; DRAWO.scale = sc; DRAWO.rot = ch.tilt; DRAWO.t = m.t;
      rig.draw(g, ch.x, ch.y, DRAWO);
    }
    m.update = update; m.drawFn = draw;
    return m;
  }
  const T_DASH = [[-5, -45], [3, -45], [3, -68], [-7, -63]];
  const T_ROOF = { r: 3, shade: PAL.sand }, T_PRE = { r: 3, ol: 1.2 }, T_HOODO = { shade: true, hi: false }, T_GRILLE = { r: 2, ol: 1.5 };
  const DRAWO = { face: 1, scale: 1, rot: 0, t: 0 };

  function placeWheel(rig, name, w, sc, fx, fy) {
    const p = rig.get(name), f = rig.get(name + 'F');
    p.x = w.lx / sc; p.y = w.ly / sc;
    if (f) { f.x = p.x + fx; f.y = p.y + fy; }
  }
  function wheelDust(m, w, vx, dt, sc) {
    if (Math.abs(vx) < 30 * sc) return;
    m.dist += Math.abs(vx) * dt;
    if (m.dist > 26 * sc) { m.dist = 0; puff(m, w.wx - (vx > 0 ? 1 : -1) * w.r * 0.7, w.wy + w.r - 2, 1, 4.5 * sc, DUST); }
  }

  /* ======================================================================
     EMPILHADEIRA — mastro telescópico de 2 estágios, correntes, garfos que inclinam
     ====================================================================== */
  const F_CYCLE = 1.55, F_LIFT_MAX = 74;
  const fWheelN = { hub: PAL.steel, spokes: 5 }, fWheelF = { tire: sh(PAL.blk, -0.35), hub: sh(PAL.steel, -0.4), spokes: 5 };
  const F_CW = [[-54, -12], [-54, -40], [-49, -50], [-24, -50], [-20, -12]];
  const F_HOOD = [[-26, -12], [-26, -46], [6, -46], [18, -36], [30, -34], [34, -12]];
  const F_FORK = [[0, -24], [4, -24], [4, 0], [40, 1.6], [40, 3.2], [0, 3.2]];
  const F_ROOF = { r: 2.5, shade: PAL.grayD }, F_TANK = { r: 5.5 };
  let sackSpr = null;
  function sackSprite() {
    return sackSpr || (sackSpr = E.sprite('mm.sack', 20, 16, P => {
      P.rrect(1, 3, 18, 13, 4, PAL.sack).rect(3, 13, 14, 3, PAL.sackD).rect(7, 0, 6, 4, PAL.sack).rect(7, 3, 6, 1, PAL.red);
      P.rect(4, 6, 3, 1, PAL.cream).rect(8, 8, 4, 4, PAL.red).rect(9, 9, 2, 2, PAL.cream);
    }));
  }
  const sprO = { sx: 1, sy: 1, rot: 0, alpha: 1 };
  // bloco de arroz prensado (36x16) com o canto de baixo/esquerda em (x, y)
  function drawBlock(g, x, y, sq) {
    const w = 36 * (1 + sq * 0.5), h = 16 * (1 - sq);
    Draw.box(g, x - (w - 36) / 2, y - h, w, h, PAL.press, R2);
    g.fillStyle = PAL.pressD;
    g.fillRect(x + 1.5, y - h * 0.62, w - 5, 1.1); g.fillRect(x + 1.5, y - h * 0.3, w - 5, 1.1);
    g.fillRect(x + 6, y - h * 0.82, 3, 1); g.fillRect(x + 20, y - h * 0.46, 4, 1); g.fillRect(x + 12, y - h * 0.16, 3, 1); g.fillRect(x + 27, y - h * 0.8, 3, 1);
    g.fillStyle = PAL.white; g.fillRect(x + 3, y - h + 1.6, w - 12, 1.3);
  }

  function makeEmpilhadeira(opts) {
    const m = baseState('empilhadeira', opts), sc = m.sc;
    const BODY = PAL.ora, MAST = PAL.blkL, INNER = PAL.ora;
    const rig = Rig();
    const ch = E.Chassis({ wheels: [{ x: -34 * sc, r: 11 * sc, travel: 2.5 * sc }, { x: 22 * sc, r: 15 * sc, travel: 2.5 * sc }], floor: m.floorF, k: 190, d: 12, tiltK: 130, tiltD: 9, squat: 0.0022 });
    const jt = J(-0.03, { k: 90, d: 13, min: -0.13, max: 0.1, speed: 1.4 });              // inclinação do mastro
    const lift = J(6, { k: 110, d: 15, min: 0, max: F_LIFT_MAX, speed: 300, bounce: 0.25 });   // altura do carro (px)
    const offS = E.Spring(0, { k: 95, d: 14 }), seat = E.Spring(0, { k: 190, d: 9 }), blockS = E.Spring(0, { k: 300, d: 11 });
    const rattle = E.Spring(0, { k: 420, d: 9 }), chainS = E.Spring(0, { k: 60, d: 2.4 });
    const exhaust = E.Exhaust({ size: 1.9 * sc, rate: 3.2, rise: 24 * sc, wind: -4, max: 16 });
    m.rig = rig; m.ch = ch; m.J = { tilt: jt, lift }; m.exhaust = exhaust;
    m.block = false;                                    // bloco em cima dos garfos
    const drop = { on: false, x: 0, y: 0, t: 0 };       // bloco pousado no chão (mundo), antes de estourar em sacos
    const sacks = [];
    for (let i = 0; i < 6; i++) sacks.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, rot: 0, sq: 0 });
    let rev = 0, fast = false, seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    const wheelDraw = far => (g, p) => Draw.wheel(g, 0, 0, p.data.r / sc, p.data.rot, far ? fWheelF : fWheelN);
    rig.part('wRearF', { z: -10, data: ch.wheels[0], draw: wheelDraw(true) });
    rig.part('wFrontF', { z: -10, data: ch.wheels[1], draw: wheelDraw(true) });
    rig.part('body', { z: 0, draw: drawBody });
    rig.part('driver', { parent: 'body', z: 0.5, x: -13, y: -48, draw: drawDriver });
    rig.part('guard', { parent: 'body', z: 1.5, draw: drawGuard });
    rig.part('wRear', { z: 4, data: ch.wheels[0], draw: wheelDraw(false) });
    rig.part('wFront', { z: 4, data: ch.wheels[1], draw: wheelDraw(false) });
    rig.part('mast', { parent: 'body', z: 6, x: 37, y: -9, joint: jt, draw: drawMast });
    rig.piston('tiltF', { a: ['body', 16, -32], b: ['mast', -1, -27], w: 3.6, z: -1, dx: 3, dy: -2, col: sh(PAL.blkL, -0.25) });
    rig.piston('tilt', { a: ['body', 14, -30], b: ['mast', -1, -25], w: 4.2, z: 5, col: PAL.blk });
    rig.calibrate('tilt', [['mast', jt.min, jt.max]]); rig.calibrate('tiltF', [['mast', jt.min, jt.max]]);

    function drawBody(g, p, r, t) {
      Draw.box(g, -40, -16, 70, 8, PAL.blk, R2);                                  // longarina
      // contrapeso (ferro fundido) com pino de reboque e luzes de ré
      Draw.poly(g, F_CW, PAL.gray, F_CWO);
      g.fillStyle = sh(PAL.gray, 0.28); g.fillRect(-48, -48.6, 23, 1.8);
      g.fillStyle = sh(PAL.gray, -0.25); g.fillRect(-53, -17, 32, 4);
      g.fillStyle = sh(PAL.gray, -0.3); g.fillRect(-46, -40, 2.4, 16); g.fillRect(-41, -40, 2.4, 16); g.fillRect(-36, -40, 2.4, 16);
      Draw.box(g, -58, -24, 5, 5, PAL.blk, R1);
      const blink = rev > 0.3 && Math.sin(t * 22) > 0;
      Draw.light(g, -53.5, -44, 2.2, PAL.red, blink ? 1 : 0.25);
      Draw.light(g, -53.5, -37, 1.9, PAL.white, blink ? 1 : 0);
      // botijão de gás deitado em cima do contrapeso
      Draw.box(g, -52, -61 + rattle.x * 0.4, 28, 11, PAL.steelL, F_TANK);
      g.fillStyle = PAL.steelD; g.fillRect(-45, -61 + rattle.x * 0.4, 2, 11); g.fillRect(-33, -61 + rattle.x * 0.4, 2, 11);
      Draw.box(g, -24.5, -58 + rattle.x * 0.4, 3, 5, PAL.gold, THIN);
      // capô / caixa do motor
      Draw.poly(g, F_HOOD, BODY, F_CWO);
      g.fillStyle = sh(BODY, 0.3); g.fillRect(-24, -44.6, 29, 1.8);
      g.fillStyle = sh(BODY, -0.26); g.fillRect(-25, -16.5, 58, 4.5);
      for (let i = 0; i < 4; i++) g.fillRect(-20 + i * 4.6, -36, 2.4, 10);          // respiros
      Draw.box(g, -2, -38, 20, 3, PAL.cream, FLAT);                                // faixa
      Draw.hazard(g, -24, -22, 22, 3.4, HAZ0);
      Draw.box(g, 12, -22, 9, 3, PAL.grayD, THIN);                                 // degrau
      Draw.light(g, 30.5, -30, 2.2, PAL.goldL, true);                              // farol
    }
    function drawDriver(g, p, r, t) {
      const by = seat.x;
      Draw.box(g, -12, -18 + by, 6, 20, PAL.blk, R2);
      Draw.box(g, -11, -1 + by, 19, 4.5, PAL.blk, R2);
      shibaO.scale = 0.8; shibaO.pal = m.pal; shibaO.fast = fast;
      E.drawShiba(g, 0, by, 'drive', t, shibaO);
      Draw.beam(g, ln(22, 4, 14, -11 + by * 0.3), 2.2, PAL.blk, NOHI);             // coluna do volante
      Draw.ring(g, 13.5, -11.5 + by * 0.3, 4.4, 1.7, PAL.blk, THIN);
      Draw.beam(g, ln(24, 2, 26, -9), 1.6, PAL.blk, NOHI); Draw.circle(g, 26, -10, 1.7, PAL.red, THIN);     // alavancas
      Draw.beam(g, ln(27, 2, 30, -7), 1.6, PAL.blk, NOHI); Draw.circle(g, 30, -8, 1.7, PAL.gold, THIN);
    }
    function drawGuard(g, p, r, t) {
      // teto de proteção: 4 colunas (2 de trás escuras) e grade
      Draw.beam(g, ln(-27, -48, -31, -99), 3.6, PAL.blk, NOHI);
      Draw.beam(g, ln3(19, -37, 13, -72, 10, -99), 3.4, PAL.blk, NOHI);
      Draw.box(g, -37, -104, 53, 6, PAL.blkL, F_ROOF);
      g.fillStyle = PAL.blk; for (let i = 0; i < 6; i++) g.fillRect(-32 + i * 8, -103, 2, 4);
      // giroflex âmbar girando
      Draw.box(g, -30, -107, 9, 3, PAL.blk, THIN);
      Draw.box(g, -29, -113, 7, 6, PAL.ora, T_PRE);
      const a = t * 10;
      Draw.light(g, -25.5 + Math.cos(a) * 2.2, -110, 2.1, PAL.goldL, 0.45 + 0.55 * Math.max(0, Math.sin(a)));
      // retrovisor
      Draw.beam(g, ln(12, -90, 19, -88), 1.4, PAL.blk, NOHI); Draw.box(g, 18, -92, 3, 7, PAL.glass, THIN_R);
    }
    function drawMast(g, p, r, t) {
      const L = lift.x, ih = L * 0.5, cy = 9 - L, q = rattle.x * 0.5;             // cy = y local do topo das lâminas dos garfos no chão
      // trilho de fora do lado de lá + garfo de lá
      Draw.box(g, -5, -92, 5, 96, sh(MAST, -0.3), THIN);
      g.save(); g.translate(13, cy + q - 1.5); Draw.poly(g, F_FORK, sh(PAL.steelD, -0.3), PLAIN); g.restore();
      // estágio de dentro (sobe metade do curso)
      Draw.box(g, -1.5, -90 - ih, 6, 92, INNER, THIN); g.fillStyle = sh(INNER, -0.25); g.fillRect(2.6, -89 - ih, 1.6, 90);
      Draw.box(g, -3, -93 - ih, 11, 4.5, PAL.blk, THIN_R);                         // travessa de cima + eixo das roldanas
      // cilindro de levante no meio do mastro (haste cromada aparece quando sobe)
      Draw.box(g, 0.2, -90 - ih, 2.6, 50 + ih, PAL.steelL, THIN);
      Draw.box(g, -0.6, -42, 4.2, 44, PAL.blk, THIN_R);
      // correntes: da roldana desce até o carro (frente) e até a âncora no trilho de fora (trás)
      const sx = 9.4, sy = -89 - ih, sw = chainS.x;
      g.lineCap = 'butt'; g.strokeStyle = LINE; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(sx + 2.6, sy); g.quadraticCurveTo(sx + 2.6 + sw, (sy + cy - 24) / 2, sx + 2.6, cy - 24);
      g.moveTo(sx - 2.6, sy); g.lineTo(sx - 2.6, -44); g.stroke();
      g.strokeStyle = PAL.steelL; g.lineWidth = 1.1; g.setLineDash(F_DASH); g.lineDashOffset = L * 0.5; g.stroke(); g.setLineDash(F_NODASH);
      // trilho de fora (canal em U) com batentes e roletes
      Draw.box(g, 0, -92, 7, 96, MAST, THIN);
      g.fillStyle = sh(MAST, 0.28); g.fillRect(1, -91, 1.4, 94);
      Draw.box(g, -6, -50, 14, 3.4, PAL.blk, THIN_R);                              // travessa do meio (âncora da corrente)
      Draw.box(g, -6, 0, 15, 4.5, PAL.blk, THIN_R);
      Rig.pulley(g, sx, sy, 3.2, L / 3.2, F_PUL);
      Draw.circle(g, 3.5, -86, 1.9, PAL.steel, THIN); Draw.circle(g, 3.5, -4 - ih, 1.9, PAL.steel, THIN);
      Rig.pin(g, 0, 0, 2.6);
      // carro porta-garfos: placa, roletes e grade de encosto da carga
      g.save(); g.translate(0, q);
      Draw.box(g, 6.5, cy - 54, 2.6, 32, PAL.blk, THIN);
      Draw.box(g, 11.4, cy - 54, 2, 32, PAL.blk, THIN);
      for (let i = 0; i < 4; i++) Draw.box(g, 6.5, cy - 54 + i * 9, 7, 1.8, PAL.blk, PLAIN0);
      Draw.box(g, 5.5, cy - 25, 9, 24, PAL.red, THIN_R);
      Draw.circle(g, 8, cy - 20, 2, PAL.steel, THIN); Draw.circle(g, 8, cy - 6, 2, PAL.steel, THIN);
      // bloco prensado em cima dos garfos
      if (m.block) drawBlock(g, 18, cy, clamp(blockS.x * 0.05, -0.2, 0.25));
      g.save(); g.translate(13.5, cy); Draw.poly(g, F_FORK, PAL.steel, F_FORKO); g.restore();
      g.restore();
    }

    function update(dt, inp) {
      begin(m, dt, inp);
      const r = m.rate, dig = !!inp.digging;
      tune(jt, r); tune(lift, r); offS.k = 95 * r * r; offS.d = 14 * r;
      const p0 = cycle(m, dt, dig, F_CYCLE), u = m.ph;
      const aim = clamp((m.gy - (inp.ty !== undefined ? inp.ty : m.gy - 20)) / sc - 2, 3, F_LIFT_MAX - 16);
      let offT = 0, liftT = aim, tiltT = -0.03, biting = false, dumping = false;
      if (m.busy) {
        if (u < 0.226) { offT = u < 0.05 ? lerp(m.off, -8, 0.2) : lerp(-8, 26, seg(u, 0.05, 0.2)); tiltT = 0.012; biting = u > 0.13; }
        else if (u < 0.484) { const s = seg(u, 0.24, 0.44); offT = 26; liftT = aim + 14 * s; tiltT = lerp(0.012, -0.12, s); biting = u < 0.3; }
        else if (u < 0.806) { const s = seg(u, 0.5, 0.79); offT = lerp(26, -30, s); liftT = lerp(aim + 14, 7, seg(u, 0.56, 0.8)); tiltT = -0.12; }
        else { const s = seg(u, 0.806, 0.9); offT = -30; liftT = lerp(7, 0, s); tiltT = lerp(-0.12, 0.085, s); dumping = u > 0.9 && u < 0.97; }
        if (crossed(m, p0, 0.2)) { m.ev.push('hit'); ch.nod(0.7); rattle.kick(60); chainS.kick(30); }
        if (crossed(m, p0, 0.24)) { m.ev.push('scoop'); m.block = true; blockS.kick(16); ch.bump(40 * sc); m.ev.push('crack'); }
        if (crossed(m, p0, 0.5)) m.ev.push('rev');
      } else {
        liftT = aim + Math.sin(m.t * 1.3) * 0.6;
      }
      jt.set(tiltT); lift.set(liftT);
      const ov = offS.v;
      offS.target = offT; offS.update(dt); m.off = offS.x;
      rev = damp(rev, offS.v < -12 || m.vx * m.face < -8 ? 1 : 0, 14, dt);
      const wx = m.x + m.face * m.off * sc;
      m.load = m.block ? 1 : 0;
      ch.load = m.load * 1.6 * sc; ch.bias = m.load * (0.02 + lift.x * 0.0004);
      ch.update(dt, wx, m.face);
      const lv = lift.v;
      rig.update(dt); lift.update(dt);
      if (lift.hit > 30) { m.ev.push('clank'); rattle.kick(40); }
      ch.lean.kick((lift.v - lv) * 0.0006 * m.face);
      const speed = Math.abs(ch.vx) / sc;
      m.power = damp(m.power, clamp(speed / 110 + Math.abs(lift.v) / 220 + Math.abs(jt.v) * 1.5 + (m.busy ? 0.2 : 0), 0, 1), 6, dt);
      fast = speed > 70;
      const body = rig.get('body');
      body.y = -2 + Math.sin(m.t * 47) * (0.16 + m.power * 0.26);
      placeWheel(rig, 'wRear', ch.wheels[0], sc, 3.5, -2.2); placeWheel(rig, 'wFront', ch.wheels[1], sc, 3.5, -2.2);
      seat.kick((ch.heave.v * 0.05 + Math.sin(m.t * 47) * (1 + m.power * 2.5)) * dt * 60 * 0.07); seat.update(dt);
      rattle.kick(Math.sin(m.t * 47) * (0.5 + m.power * 2) + (offS.v - ov) * 0.05); rattle.update(dt);
      chainS.kick(-(offS.v - ov) * 0.02 + ch.lean.v * 2 * dt * 60); chainS.update(dt);
      blockS.update(dt);
      // âncoras
      rig.solve(ch.x, ch.y, m.face, sc, ch.tilt);
      const cy = 9 - lift.x;
      rig.world('mast', 52, cy - 6, tmp);                                          // ponta dos garfos
      const b = m.biteO; b.x = tmp.x; b.y = tmp.y; b.r = 18 * sc; b.w = 36 * sc; b.h = 16 * sc; b.active = biting; b.phase = u;
      if (crossed(m, p0, 0.2)) { spray(m, tmp.x, tmp.y, 10, CRUMB, -PI / 2 - m.face * 0.6, 60, 170, 0.8); puff(m, tmp.x, tmp.y, 3, 6 * sc, DUSTW); }
      if (m.block && u > 0.24 && u < 0.8) { m.acc += dt * 14; const n = m.acc | 0; m.acc -= n; rig.world('mast', 22 + rnd() * 30, cy + 2, tmp2); spray(m, tmp2.x, tmp2.y, n, GRAIN, PI / 2, 10, 40, 0.4); }
      rig.world('mast', 36, cy, tmp);                                              // centro do bloco (base)
      const d = m.dumpO; d.x = tmp.x; d.y = tmp.y; d.active = dumping;
      if (crossed(m, p0, 0.9) && m.block) {
        m.block = false; m.ev.push('dump'); ch.nod(-0.45); ch.bump(-30 * sc); rattle.kick(-50);
        drop.on = true; drop.x = tmp.x - m.face * 18 * sc; drop.y = m.floorF(tmp.x); drop.t = 0; drop.f = m.face;
        puff(m, tmp.x, drop.y - 2, 4, 6 * sc, DUST);
      }
      if (drop.on) {
        drop.t += dt * r;
        if (drop.t > 0.16) {                                                       // estoura em sacos
          drop.on = false;
          let n = 0;
          for (let i = 0; i < sacks.length && n < 3; i++) {
            const s = sacks[i]; if (s.on) continue;
            s.on = true; s.t = 0; s.x = drop.x + drop.f * (6 + n * 12) * sc; s.y = drop.y - 8 * sc;
            s.vx = (n - 1) * 30 * sc - drop.f * 8 * sc; s.vy = -(150 + n * 30 + rnd() * 30) * sc; s.rot = 0; s.vr = (rnd() - 0.5) * 6; s.sq = 0; n++;
          }
          spray(m, drop.x + drop.f * 18 * sc, drop.y - 8 * sc, 14, CRUMB, -PI / 2, 60, 200, 1.1);
          puff(m, drop.x + drop.f * 18 * sc, drop.y - 6 * sc, 5, 8 * sc, DUSTW);
        }
      }
      for (let i = 0; i < sacks.length; i++) {
        const s = sacks[i]; if (!s.on) continue;
        s.t += dt; s.sq = Math.max(0, s.sq - dt * 3);
        if (s.vy !== 0 || s.vx !== 0) {
          s.vy += 620 * sc * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
          const fy = m.floorF(s.x) + 5 * sc;
          if (s.y >= fy) { s.y = fy; s.sq = 0.3; s.rot = 0; if (s.vy > 90 * sc) { s.vy *= -0.3; s.vx *= 0.5; } else { s.vy = 0; s.vx = 0; } }
        }
        if (s.t > 1.35) s.on = false;
      }
      rig.world('driver', 4, -30, tmp); m.seatO.x = tmp.x; m.seatO.y = tmp.y;
      rig.world('body', -50, -20, tmp);
      exhaust.update(dt, tmp.x, tmp.y, m.power * 0.7, -m.face * 0.7, -0.5);
      wheelDust(m, ch.wheels[1], ch.vx, dt, sc);
    }
    function draw(g) {
      const f = visFace(m);
      Draw.shadow(g, ch.x + m.face * 8 * sc, m.floorF(ch.x) + 2 * sc, 60 * sc * Math.max(0.3, Math.abs(f)), 4.5 * sc, 0.2);
      exhaust.draw(g);
      // bloco pousado e sacos (mundo)
      if (drop.on) { g.save(); g.translate(drop.x, drop.y); g.scale(sc * drop.f, sc); drawBlock(g, 0, 0, Math.sin(Math.min(1, drop.t / 0.16) * PI) * 0.18); g.restore(); }
      DRAWO.face = f; DRAWO.scale = sc; DRAWO.rot = ch.tilt; DRAWO.t = m.t;
      rig.draw(g, ch.x, ch.y, DRAWO);
      const spr = sackSprite();                                                   // sacos caem no primeiro plano (na frente da máquina)
      for (let i = 0; i < sacks.length; i++) {
        const s = sacks[i]; if (!s.on) continue;
        const k = s.t > 1.15 ? Math.max(0, 1 - (s.t - 1.15) / 0.2) : 1;
        sprO.sx = 1.25 * sc * k * (1 + s.sq * 0.5); sprO.sy = 1.25 * sc * k * (1 - s.sq); sprO.rot = s.rot; sprO.alpha = 1;
        E.drawSprite(g, spr, s.x, s.y, sprO);
      }
    }
    m.update = update; m.drawFn = draw;
    return m;
  }
  const F_CWO = { shade: false, hi: false }, HAZ0 = { ol: 0 }, F_DASH = [1.6, 1.3], F_NODASH = [], F_PUL = { col: PAL.steel, holes: 3 }, F_FORKO = { hi: true, shade: false };

  /* ======================================================================
     ESCAVADEIRA HIDRÁULICA — lança + braço + caçamba (E.ik3), 3 pistões, casa que gira
     ====================================================================== */
  const X_CYCLE = 2.0, XL1 = 134, XL2 = 86, XL3 = 48, XFX = 52, XFY = -20, XHY = -47, XK = 48 / 29;
  const X_BOOM = [[0, 0, 10.5], [52, -24, 17], [134, 0, 9]];
  const X_BOOM_EAR = [[44, -37, 5.4], [60, -36, 5.4]], X_BOOM_LUG = [[50, -6, 6], [56, -12, 5]];
  const X_STICK = [[-21, -3, 6.5], [5, -2.5, 12], [86, 0, 7]], X_STICK_EAR = [[10, -8, 4.4], [22, -9, 4.4]];
  const X_HLINK = [[0, 0, 3], [20, 0, 2.6]];
  const X_CWT = [[-96, -8], [-98, -40], [-90, -56], [-66, -58], [-66, -8]];
  const X_CABP = [[-10, -8], [-10, -100], [-4, -106], [34, -106], [45, -74], [46, -8]];
  const X_GLASS = [[-4, -99], [31, -99], [40, -73], [40, -52], [-4, -52]];
  const xBk = { kind: 'excavator', col: PAL.steel, load: 0 }, X_TRK = { col: PAL.grayD }, X_RAIL = { posts: 5, h: 8, col: PAL.blk, lw: 1.3 };
  const X_ROOF = { r: 3, shade: PAL.sand }, X_GLASSO = { ol: 1.4, shade: false, hi: false };

  function makeEscav(opts) {
    const m = baseState('escav', opts), sc = m.sc;
    const BODY = PAL.yel, CYL = PAL.blkL;
    const rig = Rig();
    const ch = E.Chassis({ wheels: [{ x: -66 * sc, r: 8 * sc, travel: 2 * sc }, { x: 66 * sc, r: 8 * sc, travel: 2 * sc }], floor: m.floorF, k: 160, d: 14, tiltK: 110, tiltD: 13, squat: 0.0006 });
    const js = J(0, { k: 150, d: 21, min: 0, max: PI, speed: 8.5 });
    const jb = J(-0.7, { k: 44, d: 10.5, min: -1.34, max: 0.12, speed: 2.6 });
    const jst = J(1.5, { k: 62, d: 12.5, min: 0.36, max: 2.6, speed: 3.8 });
    const jk = J(0.6, { k: 100, d: 14, min: -0.75, max: 2.3, speed: 6 });
    const pitch = E.Spring(0, { k: 60, d: 6 }), heave = E.Spring(0, { k: 150, d: 9 }), seat = E.Spring(0, { k: 190, d: 9 });
    const antenna = E.Spring(0, { k: 70, d: 3.2 }), flap = E.Spring(0, { k: 220, d: 9 }), hose = E.Spring(0, { k: 80, d: 4 });
    const exhaust = E.Exhaust({ size: 3.4 * sc, rate: 4, rise: 34 * sc, wind: -5, max: 30 });
    m.rig = rig; m.ch = ch; m.J = { slew: js, boom: jb, stick: jst, bucket: jk }; m.exhaust = exhaust;
    let phase = 0, ax = 190, ay = -40, tx = 190, ty = -40, tipA = 1.8, side = 1, mid = 0, hlMin = 0;

    rig.part('tracks', { z: 0, draw: g => {
      Draw.track(g, -76 + 5, -37 - 3, 152, 36, phase, X_TRKF);                     // esteira do lado de lá
      Draw.box(g, -40, -30, 80, 14, PAL.blk, R2);                                  // chassi em X entre as esteiras
      Draw.track(g, -80, -36, 160, 36, phase, X_TRK);
      Draw.box(g, -17, -47, 34, 12, PAL.steelD, R2);                               // rolamento de giro
      g.fillStyle = LINE; for (let i = 0; i < 6; i++) g.fillRect(-14 + i * 5.4, -41, 1.4, 3);
    } });
    rig.part('house', { z: 2, y: XHY, draw: drawHouse });
    rig.part('boom', { parent: 'house', z: 4, x: XFX, y: XFY, joint: jb, draw: drawBoom });
    rig.part('stick', { parent: 'boom', z: 5, x: XL1, y: 0, joint: jst, draw: g => {
      Rig.plate(g, X_STICK_EAR, sh(BODY, -0.2), PLAIN);
      Rig.plate(g, X_STICK, BODY);
      Draw.box(g, 30, -3.4, 30, 5.4, sh(BODY, -0.14), FLAT);                       // chapa de reforço
      Rig.pin(g, 0, 0, 4.4); Rig.pin(g, 86, 0, 3.4); Rig.pin(g, 70, -1, 2.4);
    } });
    rig.part('hlink', { parent: 'stick', z: 5.7, x: 70, y: -1, draw: g => Rig.plate(g, X_HLINK, sh(BODY, -0.22), PLAIN) });
    rig.part('bucket', { parent: 'stick', z: 4.5, x: XL2, y: 0, joint: jk, draw: g => {
      xBk.load = m.load; Rig.bucket(g, XL3, xBk);
      Rig.pin(g, -1 * XK, -12 * XK, 2.4);
    } });
    rig.part('cab', { parent: 'house', z: 6, draw: drawCab });
    rig.link('blink', { a: ['hlink', 20, 0], b: ['bucket', -1 * XK, -12 * XK], z: 5.65, render: (g, a, b) => { BL[0][0] = a[0]; BL[0][1] = a[1]; BL[1][0] = b[0]; BL[1][1] = b[1]; Rig.plate(g, BL, PAL.steelD, PLAIN); } });
    rig.piston('pBoomF', { a: ['house', 76, -6], b: ['boom', 52, -8], w: 8, z: 3.5, dx: 5, dy: -3, col: sh(CYL, -0.25) });
    rig.piston('pBoom', { a: ['house', 72, -4], b: ['boom', 52, -8], w: 9, z: 4.6, col: CYL });
    rig.piston('pStick', { a: ['boom', 52, -37], b: ['stick', -21, -3], w: 8, z: 5.5, col: CYL });
    const pBk = rig.piston('pBucket', { a: ['stick', 14, -9], b: ['hlink', 20, 0], w: 6.4, z: 5.8, col: CYL });
    // mangueiras frouxas na articulação lança/braço (dobram com a junta)
    rig.link('hose', { a: ['boom', 112, -13], b: ['stick', 20, -10], z: 5.9, render: (g, a, b) => {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const slack = clamp(46 - L, 4, 30) + hose.x, s = side < 0 ? -1 : 1, nx = dy / L * s, ny = -dx / L * s;
      g.lineCap = 'round'; g.strokeStyle = LINE; g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(mx + nx * slack * 1.5, my + ny * slack * 1.5, b[0], b[1]); g.stroke();
      g.beginPath(); g.moveTo(a[0], a[1] + 3); g.quadraticCurveTo(mx + nx * slack * 1.05, my + ny * slack * 1.05 + 3, b[0], b[1] + 3); g.stroke();
      g.strokeStyle = PAL.blkL; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(mx + nx * slack * 1.5, my + ny * slack * 1.5, b[0], b[1]); g.stroke();
    } });
    rig.calibrate('pBoom', [['boom', jb.min, jb.max]]); rig.calibrate('pBoomF', [['boom', jb.min, jb.max]]);
    rig.calibrate('pStick', [['stick', jst.min, jst.max]]);
    // biela da caçamba: resolve o quadrilátero (2 círculos) e calibra o pistão varrendo a junta
    function solveLink(rot) {
      const c = Math.cos(rot), s = Math.sin(rot), ex = XL2 + c * (-1 * XK) - s * (-12 * XK), ey = s * (-1 * XK) + c * (-12 * XK);
      E.ik2(70, -1, ex, ey, 20, 17, 1, ikL);
      return ikL.a1;
    }
    { let mn = Infinity, mx = 0; const hl = rig.get('hlink'), bk = rig.get('bucket');
      for (let i = 0; i <= 16; i++) { const a = lerp(jk.min, jk.max, i / 16); bk.rot = a; hl.rot = solveLink(a); const d = rig.dist('stick', 14, -9, 'hlink', 20, 0); if (d < mn) mn = d; if (d > mx) mx = d; }
      pBk.min = mn; pBk.max = mx; hlMin = mn; bk.rot = jk.x; hl.rot = solveLink(jk.x); rig.pose(); }

    function drawHouse(g, p, r, t) {
      Draw.box(g, 40, -22, 44, 20, PAL.blkL, R3);                                  // berço do pino da lança
      // escapamento com tampinha
      Draw.box(g, -42, -86, 5, 22, PAL.steelD, THIN); Draw.box(g, -44.5, -78, 10, 13, PAL.blk, R2);
      g.save(); g.translate(-42.6, -87.2); g.rotate(-0.12 - flap.x); Draw.box(g, 0, -1.8, 8.4, 2.4, PAL.steelD, THIN); g.restore();
      // corrimão em cima do capô
      CA[0] = -84; CA[1] = -64; CB[0] = -48; CB[1] = -66; Draw.rail(g, CA, CB, X_RAIL);
      Draw.poly(g, X_CWT, PAL.blk, PLAIN);                                         // contrapeso
      g.fillStyle = PAL.blkL; g.fillRect(-94, -40, 2.4, 26);
      Draw.hazard(g, -92, -18, 24, 6, HAZ0);
      Draw.box(g, -70, -66, 68, 58, BODY, X_HOOD);                                 // capô do motor
      g.fillStyle = sh(BODY, -0.3); for (let i = 0; i < 6; i++) g.fillRect(-62 + i * 5.2, -54, 2.8, 18);    // respiros
      Draw.box(g, -26, -56, 18, 22, sh(BODY, -0.12), THIN_R);                      // tampa de inspeção
      Draw.circle(g, -12, -45, 1.4, PAL.blk, PLAIN0);
      Draw.box(g, -64, -30, 52, 3.4, PAL.cream, FLAT);
      Draw.box(g, -82, -10, 162, 10, PAL.blkL, R2);                                // plataforma
      Draw.hazard(g, -60, -8, 44, 4, HAZ0);
      Draw.light(g, -95, -47, 2.4, PAL.red, 0.5 + 0.5 * (Math.sin(t * 6) > 0 ? 1 : 0));
    }
    function drawBoom(g, p, r, t) {
      Rig.plate(g, X_BOOM_EAR, sh(BODY, -0.2), PLAIN);
      Rig.plate(g, X_BOOM, BODY);
      Rig.plate(g, X_BOOM_LUG, sh(BODY, -0.2), PLAIN0);
      // mangueiras hidráulicas presas ao longo do dorso da lança
      g.lineCap = 'round'; g.strokeStyle = LINE; g.lineWidth = 3;
      g.beginPath(); g.moveTo(6, -9); g.quadraticCurveTo(30, -27, 50, -30); g.quadraticCurveTo(84, -27, 112, -13); g.stroke();
      g.strokeStyle = PAL.blkL; g.lineWidth = 1.1; g.stroke();
      for (let i = 0; i < 3; i++) Draw.box(g, 68 + i * 16, -27 + i * 4.6, 3, 5, PAL.steelD, THIN);        // abraçadeiras
      // farol de trabalho da lança
      Draw.box(g, 36, -14, 7, 5, PAL.blk, THIN_R); Draw.light(g, 43.5, -11.5, 2.4, PAL.goldL, true);
      Rig.pin(g, 0, 0, 4.6); Rig.pin(g, 134, 0, 4); Rig.pin(g, 52, -8, 3.2);
    }
    function drawCab(g, p, r, t) {
      Draw.poly(g, X_CABP, BODY, PLAIN);
      g.fillStyle = sh(BODY, -0.22); g.fillRect(-9, -15, 54, 6);
      g.fillStyle = sh(BODY, 0.3); g.fillRect(-3, -104.6, 36, 1.8);
      // vidro grande; Kome dirigindo lá dentro
      Draw.poly(g, X_GLASS, PAL.glass, X_GLASSO);
      g.save(); g.beginPath(); g.moveTo(-4, -99); g.lineTo(31, -99); g.lineTo(40, -73); g.lineTo(40, -52); g.lineTo(-4, -52); g.closePath(); g.clip();
      g.fillStyle = PAL.glassD; g.fillRect(-4, -60, 46, 8);
      Draw.box(g, -2, -72 + seat.x, 6, 22, PAL.blk, R2);                           // encosto do banco
      shibaO.scale = 0.86; shibaO.pal = m.pal; shibaO.fast = false;
      E.drawShiba(g, 11, -51 + seat.x, 'drive', t, shibaO);
      Draw.beam(g, ln(31, -50, 27, -63), 1.8, PAL.blk, NOHI); Draw.circle(g, 27, -64, 2, PAL.red, THIN);   // joystick
      g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(14, -99); g.lineTo(22, -99); g.lineTo(4, -52); g.lineTo(-4, -52); g.closePath(); g.fill();
      g.restore();
      g.strokeStyle = LINE; g.lineWidth = 1.5; g.beginPath(); g.moveTo(18, -99); g.lineTo(18, -52); g.stroke();   // coluna da porta
      Draw.box(g, -6, -40, 46, 3.4, PAL.cream, FLAT);
      Draw.box(g, 2, -32, 9, 2.4, PAL.blk, PLAIN0);                                // maçaneta
      Draw.beam(g, ln(-7, -20, -7, -46), 1.8, PAL.blk, NOHI);                      // pega-mão
      Draw.box(g, -12, -112, 50, 7, PAL.cream, X_ROOF);                            // teto
      Draw.box(g, 26, -117, 8, 5, PAL.blk, THIN_R); Draw.light(g, 35, -114.5, 2.6, PAL.goldL, true);       // faróis de trabalho
      Draw.box(g, 12, -117, 8, 5, PAL.blk, THIN_R); Draw.light(g, 21, -114.5, 2.2, PAL.goldL, true);
      Draw.box(g, -6, -118, 8, 6, PAL.ora, T_PRE);                                 // giroflex
      Draw.light(g, -2 + Math.cos(t * 9) * 2.4, -115, 2.1, PAL.goldL, 0.45 + 0.55 * Math.max(0, Math.sin(t * 9)));
      Draw.beam(g, ln(44, -84, 51, -88), 1.5, PAL.blk, NOHI); Draw.box(g, 50, -93, 3.4, 9, PAL.glass, THIN_R);   // retrovisor
      const a = antenna.x;                                                         // antena com mola
      g.strokeStyle = LINE; g.lineWidth = 1.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-9, -112); g.quadraticCurveTo(-9 - a * 16, -128, -9 + a * 20, -142); g.stroke();
      Draw.circle(g, -9 + a * 20, -142, 2, PAL.red, THIN);
    }

    function update(dt, inp) {
      begin(m, dt, inp);
      const r = m.rate, dig = !!inp.digging;
      tune(js, r); tune(jb, r); tune(jst, r); tune(jk, r);
      const p0 = cycle(m, dt, dig, X_CYCLE), u = m.ph;
      ch.update(dt, m.x, m.face);
      phase += (ch.started && dt > 0 ? ch.vx * dt : 0) * m.face / sc;
      // alvo do ponteiro no espaço do modelo (frente = +x, chão = 0), suavizado: o operador não teleporta a alavanca
      const px = inp.tx !== undefined ? (inp.tx - ch.x) * m.face / sc : 190, py = inp.ty !== undefined ? (inp.ty - ch.y) / sc : -40;
      ax = damp(ax, clamp(px, 96, 300), 9, dt); ay = damp(ay, clamp(py, -190, 30), 9, dt);
      let biting = false, dumping = false, wantSlew = 0, wx, wy, wa;
      if (m.busy) {
        if (u < 0.3) { const s = seg(u, 0, 0.3); wx = ax + lerp(16, -34, s); wy = ay + lerp(-18, 2, s) + Math.sin(s * PI) * 12; wa = lerp(1.55, 3.15, seg(u, 0.07, 0.29)); biting = u > 0.06; }
        else if (u < 0.62) { const s = seg(u, 0.3, 0.46); wx = lerp(ax - 34, 126, s); wy = lerp(ay + 2, -92, s); wa = 3.3; wantSlew = u > 0.34 ? PI : 0;
          if (u > 0.5) { const q = seg(u, 0.5, 0.62); wx = lerp(126, 176, q); wy = lerp(-92, -74, q); } }
        else if (u < 0.8) { wx = 176; wy = -74; wa = lerp(3.3, 1.2, seg(u, 0.62, 0.71)); wantSlew = u < 0.77 ? PI : 0; dumping = true; }
        else { const s = seg(u, 0.84, 1); wx = lerp(150, ax + 16, s); wy = lerp(-80, ay - 18, s); wa = lerp(1.2, 1.55, s); wantSlew = 0; }
        if (crossed(m, p0, 0.07)) { m.ev.push('hit'); pitch.kick(0.22); heave.kick(14); }
        if (crossed(m, p0, 0.12)) m.ev.push('scoop');
        if (crossed(m, p0, 0.35)) { m.ev.push('rev'); exhaust.burst(4, 1); }
        if (crossed(m, p0, 0.65)) m.ev.push('dump');
      } else {
        wx = ax + Math.sin(m.t * 0.9) * 2; wy = ay - 10 + Math.sin(m.t * 1.3) * 2.5; wa = 1.75 + Math.sin(m.t * 0.7) * 0.05;
      }
      tx = damp(tx, wx, 18 * r, dt); ty = damp(ty, wy, 18 * r, dt); tipA = damp(tipA, wa, 16 * r, dt);
      js.set(wantSlew); js.update(dt);
      const cs = Math.cos(js.x);
      side = cs >= 0 ? 1 : -1; mid = 1 - Math.abs(cs);
      const house = rig.get('house'), vs = Math.pow(Math.abs(cs), 0.55);
      house.sx = (vs < 0.32 ? 0.32 : vs) * side;
      // IK no espaço da casa; no meio do giro o braço encolhe
      let lx = Math.max(70, tx), ly = Math.min(ty, 26) - XHY;
      lx = lerp(lx, 112, mid * 0.85); ly = lerp(ly, -56, mid * 0.85);
      E.ik3(XFX, XFY, lx, ly, XL1, XL2, XL3, tipA, 1, ikO);
      jb.set(ikO.a1); jst.set(ikO.rel2); jk.set(ikO.rel3);
      const bv = jb.v, sv = jst.v, slv = js.v;
      rig.update(dt);
      rig.get('hlink').rot = solveLink(jk.x);
      // carga
      if (biting && u > 0.1) m.load = Math.min(1, m.load + dt * r / (0.18 * X_CYCLE));
      // reação na carroceria
      pitch.target = (0.01 + 0.03 * clamp((ikO.reach - 0.55) * 2, 0, 1) + m.load * 0.014) * (1 - mid);
      pitch.kick((jb.v - bv) * 0.03 + (jst.v - sv) * 0.013);
      if (jb.hit > 0.2 || jst.hit > 0.3) { pitch.kick(0.12); heave.kick(12); m.ev.push('clank'); }
      pitch.update(dt); heave.update(dt);
      m.power = damp(m.power, clamp(Math.abs(jb.v) * 0.7 + Math.abs(jst.v) * 0.35 + Math.abs(jk.v) * 0.12 + Math.abs(js.v) * 0.2 + Math.abs(ch.vx) / sc / 60, 0, 1), 5, dt);
      house.rot = clamp(pitch.x, -0.05, 0.075) * side;
      house.y = XHY + heave.x + Math.sin(m.t * 38) * (0.22 + m.power * 0.34);
      rig.get('tracks').y = heave.x * 0.3;
      const jolt = (-(js.v - slv) * 0.012 * side + pitch.v * 0.4) * dt * 60;
      antenna.kick(jolt); antenna.update(dt);
      hose.kick((jst.v - sv) * 1.4 + Math.sin(m.t * 38) * m.power * 0.6); hose.update(dt);
      seat.kick((heave.v * 0.04 + Math.sin(m.t * 38) * (1 + m.power * 2.5)) * dt * 60 * 0.07); seat.update(dt);
      flap.target = exhaust.pulse * 0.9 + m.power * 0.5; flap.update(dt);
      // âncoras
      rig.solve(ch.x, ch.y, m.face, sc, ch.tilt);
      rig.world('bucket', XL3, 0, tmp);
      const b = m.biteO; b.x = tmp.x; b.y = tmp.y; b.r = 34 * sc; b.active = biting; b.phase = u;
      if (biting) { m.acc2 += dt * 60 * r; const n = m.acc2 | 0; m.acc2 -= n; spray(m, tmp.x, tmp.y - 4, n, GRAIN, -PI / 2 - m.face * 0.4, 60, 190, 1.0); }
      if (crossed(m, p0, 0.07)) puff(m, tmp.x, tmp.y, 4, 8 * sc, DUSTW);
      rig.world('bucket', XL3 * 0.55, XL3 * 0.25, tmp);
      const d = m.dumpO; d.x = tmp.x; d.y = tmp.y; d.active = false;
      if (dumping && tipA < 2.5 && m.load > 0) {
        d.active = true;
        m.load = Math.max(0, m.load - dt * r / (0.09 * X_CYCLE));
        m.acc += dt * 130; const n = m.acc | 0; m.acc -= n;
        spray(m, tmp.x, tmp.y, n, GRAIN, PI / 2, 30, 120, 0.6);
      }
      xBk.load = m.load;
      rig.world('cab', 20, -84, tmp); m.seatO.x = tmp.x; m.seatO.y = tmp.y;
      rig.world('house', -39.5, -89, tmp);
      exhaust.update(dt, tmp.x, tmp.y, m.power);
    }
    function draw(g) {
      Draw.shadow(g, ch.x, m.floorF(ch.x) + 2 * sc, 100 * sc, 6.5 * sc, 0.2);
      exhaust.draw(g);
      DRAWO.face = visFace(m); DRAWO.scale = sc; DRAWO.rot = ch.tilt; DRAWO.t = m.t;
      rig.draw(g, ch.x, ch.y, DRAWO);
    }
    m.update = update; m.drawFn = draw;
    return m;
  }
  const BL = [[0, 0, 2.6], [0, 0, 2.6]], X_TRKF = { col: sh(PAL.grayD, -0.3), belt: sh(PAL.blk, -0.3) }, X_HOOD = { r: 6, panels: 3 };

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
  }
  const NOINP = { x: 0, y: 0, face: 1 };
  reg('trator', 'Trator', 'trator', 152, 124, makeTrator, { zoom: 1.1, shake: 0.3, cycle: T_CYCLE });
  reg('empilhadeira', 'Empilhadeira', 'fork', 150, 116, makeEmpilhadeira, { zoom: 0.85, shake: 0.3, cycle: F_CYCLE });
  reg('escav', 'Escavadeira Hidráulica', 'escav', 330, 190, makeEscav, { zoom: 0.62, shake: 0.4, cycle: X_CYCLE });
})();
