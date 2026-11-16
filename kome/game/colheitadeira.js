/* Kome no Japão — colheitadeira.js
   Degrau 'colheita': colheitadeira de arroz (entre o Trator e a Empilhadeira). O molinete gira na frente e puxa o arroz pra
   plataforma de corte; o sem-fim leva pro tanque em cima (dá pra ver enchendo); com o tanque cheio ela para, levanta o tubo
   de descarga e despeja (evento 'dump' = hora de pagar). Palha voa pela traseira.
   Mesma interface das outras máquinas (ver machines-mid.js): create/update/draw/bite/dump/seat, m.ev, m.busy, m.load, m.power, m.off.
   Espaço do modelo: origem no chão sob o centro da máquina, +x = frente, y pra baixo. */
(function () {
  'use strict';
  const E = window.Pixxel;
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

  const BODY = '#4E8C3A', BODYD = '#3A6B2B', BODYL = '#76B256', STRIPE = PAL.cream;
  const R2 = { r: 2 }, R3 = { r: 3 }, R4 = { r: 4 }, THIN = { ol: 1.2 }, NOHI = { hi: false };
  const GRAIN = { shape: 'grain', c: [PAL.rice, PAL.rice, PAL.riceS], land: true, w: 2.2, life: 1.6, ol: true, speed: [40, 120], spread: 0.35, dir: PI / 2 };
  const STRAW = { shape: 'rect', c: ['#E8CF7A', '#D9B85C', '#F2E2A0'], land: true, w: [1.5, 4], life: 1.4, ol: false, speed: [40, 120], spread: 0.7, dir: PI, vr: 10 };
  const shO = { scale: 0.8, shadow: false, pal: 'kome', fast: false };
  const TIRE = { hub: PAL.yel, spokes: 6 }, TIRE_S = { hub: PAL.yel, spokes: 5 };

  const FILL_SEC = 4.2, DUMP_SEC = 1.7;

  function make(opts) {
    opts = opts || {};
    const sc = (opts.scale || 1) * 0.92;
    const m = {
      id: 'colheita', sc, pal: opts.pilot || 'kome', t: 0, ev: [], x: 0, y: 0, face: 1, off: 0, ph: 0, busy: false,
      load: 0, power: 0, vx: 0, parts: null, fl: null, gy: 0, state: 'idle', st: 0, reel: 0, auger: 0, augA: 0, wheel: 0,
      acc: 0, acc2: 0, lastX: NaN, bob: 0,
      biteO: { x: 0, y: 0, r: 0, active: false, phase: 0 }, dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
    };
    m.floorF = x => (m.fl ? m.fl(x) : m.gy);
    const exhaust = E.Exhaust ? E.Exhaust({ size: 2.4 * sc, rate: 4, rise: 30 * sc, wind: -5 }) : null;

    // modelo -> mundo
    const W = { x: 0, y: 0 };
    function toW(lx, ly) { W.x = m.x + m.face * (lx + m.off) * sc; W.y = m.y + (ly + m.bob) * sc; return W; }

    function spray(x, y, n, mold, dir, s0, s1) {
      if (!m.parts || n <= 0) return;
      mold.dir = dir; mold.speed[0] = s0 * sc; mold.speed[1] = s1 * sc;
      m.parts.spray(x, y, n, mold);
    }

    function update(dt, inp) {
      inp = inp || {};
      m.ev.length = 0; m.t += dt;
      m.fl = typeof inp.floor === 'function' ? inp.floor : null; m.gy = inp.y || 0; m.parts = inp.parts || null;
      const nx = inp.x || 0; m.vx = isNaN(m.lastX) ? 0 : (nx - m.lastX) / Math.max(dt, 1e-4); m.lastX = nx;
      m.x = nx; m.y = inp.y || 0; m.face = inp.face < 0 ? -1 : 1;
      const rate = clamp((inp.speedMul || 1) * (1 + 0.15 * (inp.boost || 0)), 0.4, 2.6);
      const dig = !!inp.digging;

      // máquina de estados: colhe enquanto segura; tanque cheio -> descarrega
      if (m.state === 'idle' && dig) { m.state = 'harvest'; m.ev.push('rev'); }
      if (m.state === 'harvest') {
        if (!dig) m.state = 'idle';
        else {
          m.load = Math.min(1, m.load + dt * rate / FILL_SEC);
          if (m.load >= 1) { m.state = 'dump'; m.st = 0; m.ev.push('full'); }
        }
      } else if (m.state === 'dump') {
        m.st += dt * rate;
        if (m.st > 0.35 && m.st - dt * rate <= 0.35) m.ev.push('dump');
        if (m.st > DUMP_SEC) { m.state = dig ? 'harvest' : 'idle'; m.load = 0; m.ev.push('empty'); }
      }
      const harvesting = m.state === 'harvest', dumping = m.state === 'dump';
      m.busy = dumping;
      m.ph = dumping ? clamp(m.st / DUMP_SEC, 0, 1) : m.load;

      // molinete e sem-fim giram com o esforço; o tubo de descarga sobe pra despejar
      m.power = damp(m.power, harvesting ? 1 : dumping ? 0.7 : Math.min(1, Math.abs(m.vx) / 200), 5, dt);
      m.reel += dt * (0.6 + 4.2 * (harvesting ? 1 : 0)) * rate;
      m.auger += dt * (harvesting || dumping ? 14 : 0) * rate;
      m.augA = damp(m.augA, dumping ? 1 : 0, 6, dt);
      m.wheel += (m.vx * m.face) / (24 * sc) * dt + (harvesting ? 0.6 * dt : 0);
      m.off = damp(m.off, harvesting ? 4 + Math.sin(m.t * 2.2) * 2 : dumping ? -2 : 0, 4, dt);
      m.bob = Math.sin(m.t * 37) * (0.25 + m.power * 0.35);

      // âncoras
      const b = m.biteO, h = toW(90, -10); b.x = h.x; b.y = h.y; b.r = 26 * sc; b.active = harvesting; b.phase = m.ph;
      const s = toW(14, -84); m.seatO.x = s.x; m.seatO.y = s.y;
      const ang = -2.9 + m.augA * 0.75, ax = -38 + Math.cos(ang) * 64, ay = -96 + Math.sin(ang) * 64;
      const d = toW(ax, ay); m.dumpO.x = d.x; m.dumpO.y = d.y; m.dumpO.active = dumping && m.st > 0.3 && m.st < DUMP_SEC - 0.15;

      // partículas: arroz subindo no molinete, palha saindo atrás, arroz caindo do tubo
      if (harvesting && m.parts) {
        m.acc += dt * 26 * rate; let n = m.acc | 0; m.acc -= n;
        if (n) spray(b.x, b.y - 4 * sc, n, GRAIN, -PI / 2 - m.face * 0.9, 40, 120);
        m.acc2 += dt * 16 * rate; n = m.acc2 | 0; m.acc2 -= n;
        const tail = toW(-70, -40);
        if (n) spray(tail.x, tail.y, n, STRAW, m.face > 0 ? PI + 0.25 : -0.25, 60, 160);
      }
      if (m.dumpO.active && m.parts) { m.acc += dt * 70; const n = m.acc | 0; m.acc -= n; spray(d.x, d.y, n, GRAIN, PI / 2, 10, 60); }
      if (exhaust) { const e = toW(-20, -128); exhaust.update(dt, e.x, e.y, m.power); }
    }

    function draw(g) {
      const f = m.face, k = sc, t = m.t;
      Draw.shadow(g, m.x + f * m.off * k, m.floorF(m.x) + 2 * k, 92 * k, 6 * k, 0.22);
      if (exhaust) exhaust.draw(g);
      g.save(); g.translate(m.x + f * m.off * k, m.y + m.bob * k); g.scale(f * k, k);

      // tubo de descarga (atrás do corpo)
      const ang = -2.9 + m.augA * 0.75;
      g.save(); g.translate(-38, -96); g.rotate(ang);
      Draw.box(g, 0, -4.5, 66, 9, BODYD, R3); Draw.box(g, 0, -4.5, 66, 2.4, BODYL, { ol: 0, r: 1 });
      for (let i = 0; i < 5; i++) Draw.box(g, 8 + i * 12, -4.5, 2.2, 9, sh(-0.2), { ol: 0 });
      Draw.box(g, 62, -6, 7, 12, PAL.grayD, R2);
      g.restore();

      // rodas
      Draw.wheel(g, 22, -26, 26, m.wheel, TIRE);
      Draw.wheel(g, -50, -15, 15, m.wheel * 1.7, TIRE_S);

      // corpo principal
      Draw.box(g, -66, -82, 108, 52, BODY, R4);
      Draw.box(g, -66, -82, 108, 6, BODYL, { ol: 0, r: 3 });
      Draw.box(g, -62, -46, 100, 5, STRIPE, { ol: 0, r: 1 });
      for (let i = 0; i < 6; i++) Draw.box(g, -58 + i * 7, -70, 3.5, 16, sh(-0.25), { ol: 0, r: 1 });   // grade do radiador
      Draw.box(g, -70, -42, 10, 10, BODYD, R2);                                                            // saída de palha
      // para-lama da roda grande
      g.lineCap = 'round'; g.beginPath(); g.arc(22, -26, 29, PI * 1.05, PI * 1.95);
      g.strokeStyle = LINE; g.lineWidth = 8; g.stroke(); g.strokeStyle = BODYD; g.lineWidth = 4.6; g.stroke();

      // tanque de grãos em cima, com o arroz visível enchendo
      Draw.box(g, -56, -112, 50, 31, BODYD, R3);
      Draw.box(g, -52, -108, 42, 23, '#2F4F22', { ol: 0, r: 2 });
      const fillH = 22 * m.load;
      if (fillH > 0.5) {
        g.fillStyle = PAL.rice; g.fillRect(-52, -86 - fillH, 42, fillH);
        g.beginPath(); g.ellipse(-31, -86 - fillH, 21, Math.min(5, fillH * 0.5 + 1), 0, PI, TAU); g.fill();
        g.fillStyle = PAL.riceS; for (let i = 0; i < 6; i++) g.fillRect(-48 + i * 6.5, -86 - fillH * (0.3 + (i % 3) * 0.2), 2.4, 1.2);
      }
      g.strokeStyle = LINE; g.lineWidth = 1.4; g.strokeRect(-52, -108, 42, 23);
      // escapamento
      Draw.box(g, -22, -128, 4.5, 20, PAL.steelD, THIN); Draw.box(g, -24, -120, 8.5, 8, PAL.blk, R2);

      // cabine com o Kome
      Draw.box(g, -2, -118, 38, 38, BODY, R3);
      Draw.box(g, -4, -122, 42, 6, STRIPE, R2);
      g.fillStyle = PAL.glass || '#A8D8EA'; g.fillRect(2, -114, 30, 26);
      shO.pal = m.pal; shO.scale = 0.78;
      E.drawShiba(g, 16, -86, 'drive', t, shO);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(4, -112, 6, 22);
      g.strokeStyle = LINE; g.lineWidth = 1.4; g.strokeRect(2, -114, 30, 26);
      Draw.light(g, 34, -119, 2.2, PAL.ora, 0.5 + 0.5 * Math.sin(t * 8));

      // plataforma de corte (frente, rente ao chão) com sem-fim
      Draw.beam(g, [[40, -54], [66, -24]], 8, BODYD, NOHI);                                  // canal alimentador
      Draw.box(g, 60, -24, 46, 16, BODYD, R3);
      Draw.box(g, 64, -21, 38, 9, '#2F4F22', { ol: 0, r: 2 });
      g.save(); g.beginPath(); g.rect(64, -21, 38, 9); g.clip();
      g.strokeStyle = PAL.steelL; g.lineWidth = 2;
      for (let i = -2; i < 10; i++) { const x = 64 + ((i * 6 + m.auger * 4) % 54); g.beginPath(); g.moveTo(x, -21); g.lineTo(x - 5, -12); g.stroke(); }
      g.restore();
      for (let i = 0; i < 9; i++) Draw.poly(g, [[106, -11], [112, -9], [106, -7]], PAL.steelL, { ol: 0.8 });   // dentes da barra de corte
      Draw.box(g, 104, -12, 5, 6, PAL.steel, THIN);

      // molinete: braços até o eixo e 6 travessas girando
      Draw.beam(g, [[36, -68], [88, -50]], 3.4, BODYD, NOHI);
      const cx = 88, cy = -44, R = 20;
      g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = m.reel + i * TAU / 6, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        g.strokeStyle = LINE; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke();
        g.strokeStyle = PAL.ora; g.lineWidth = 1.4; g.stroke();
        Draw.box(g, x - 4, y - 1.6, 8, 3.2, PAL.ora, { ol: 1, r: 1 });
        g.strokeStyle = LINE; g.lineWidth = 1; g.beginPath();
        for (let j = -1; j <= 1; j++) { g.moveTo(x + j * 3, y); g.lineTo(x + j * 3 + Math.cos(a + 1.2) * 4, y + Math.sin(a + 1.2) * 4); }
        g.stroke();
      }
      Draw.circle(g, cx, cy, 4.2, PAL.yel, THIN);
      g.restore();
    }
    function sh(k) { return U.shade ? U.shade(BODY, k) : BODYD; }

    m.update = update; m.drawFn = draw;
    return m;
  }

  G.Tools.colheita = {
    id: 'colheita', name: 'Colheitadeira', kind: 'trator', w: 170, h: 135,
    meta: { zoom: 0.95, shake: 0.3, cycle: FILL_SEC + DUMP_SEC },
    create(opts) { return make(opts || {}); },
    update(m, dt, inp) { m.update(dt, inp || { x: 0, y: 0, face: 1 }); },
    draw(g, m) { m.drawFn(g); },
    bite(m) { return m.biteO; },
    dump(m) { return m.dumpO; },
    seat(m) { return m.seatO; },
  };
})();
