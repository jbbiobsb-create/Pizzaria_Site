/* Kome no Japão — tools-hand.js
   Degraus "de pata" da escada de ferramentas (o Kome É a máquina): 'pata', 'hashi', 'tigela', 'pa', 'duaspas', 'carrinho'
   e 'britadeira' (com compressorzinho amarelo). Também G.Props (sprites pequenos em Pix) e G.Props.icon(id) (ícones 16x16).
   Depende de: core.js, pix.js, shiba.js, fx.js, terrain.js, rig.js.

   Mesma interface de machines-mid.js (G.Tools[id]): create(opts) -> m; update(m, dt, inp); draw(g, m); bite(m); dump(m);
   seat(m); m.ev; meta {zoom, shake, cycle}.
   Espaço do modelo: origem no contato com o chão (inp.x, inp.y), +x = frente (o desenho inteiro é espelhado por face),
   y pra baixo, unidades = px de arte (1 px da grade do Kome), multiplicadas por opts.scale.
   Estado útil pro jogo (só leitura): m.ph (fase 0..1 do ciclo), m.busy, m.load (0..1 de carga visível), m.off (avanço próprio
   dentro do ciclo, em px de arte), m.n (golpes/ciclos contados).
   Eventos em m.ev: 'hit' (golpe na terra), 'tic' (hashi pegou um grão), 'scoop', 'toss' (carga voou por cima do ombro),
   'spin' (giro-helicóptero das duas pás, a cada 8 golpes), 'dump' (carrinho começou a despejar), 'squeak' (roda do carrinho),
   'tat' (batida da britadeira). */
(function () {
  'use strict';
  const E = window.Pixxel;
  if (!E || !E.drawShiba || !E.Pile || !E.Exhaust) throw new Error('tools-hand.js: carregue core, pix, shiba, fx, terrain e rig antes');
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const seg = (u, a, b) => smooth((u - a) / (b - a));
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const hash = n => { const s = Math.sin(n * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); };

  /* ---- moldes de partícula e rascunhos reaproveitados (zero alocação por frame) ---- */
  const GRAIN = { shape: 'grain', c: [PAL.rice, PAL.rice, PAL.riceS], land: true, w: 2, life: 1.5, ol: true, speed: [30, 90], spread: 0.7, dir: PI / 2 };
  const BIGGRAIN = { shape: 'grain', c: PAL.rice, land: true, w: 2.8, life: 1.5, ol: true, speed: [200, 215], spread: 0.06, dir: 0, jitter: 0 };
  const CLOD = { shape: 'rect', c: [PAL.rice, PAL.riceS, PAL.press], land: true, w: [2.6, 4.6], life: 1.3, ol: true, speed: [60, 160], spread: 0.6, dir: -PI / 2, vr: 9 };
  const CHIP = { shape: 'rect', c: [PAL.press, PAL.pressD, PAL.rice, PAL.riceS], land: true, w: [1.6, 3.2], life: 0.9, ol: true, speed: [80, 220], spread: 1.1, dir: -PI / 2, vr: 14 };
  const DUST = { c: PAL.sand }, DUSTW = { c: PAL.cream };
  const KO = { scale: 1, face: 1, pal: 'kome', rot: 0, squash: 0, shadow: false, eyes: null, mouth: null, hat: true, alpha: 1, smooth: false };
  const AO = { hat: true, fast: false }, AT = { x: 0, y: 0 };
  const T1 = { x: 0, y: 0 }, T2 = { x: 0, y: 0 }, T3 = { x: 0, y: 0 };
  const PD = { scale: 1 }, HATO = { ax: 9.5, ay: 1, rot: 0 };
  const C_NOHI = { hi: false }, C_FLAT = { hi: false, shade: false }, B_R3 = { r: 3 }, B_R1 = { r: 1 };

  function spray(m, x, y, n, mold, dir, s0, s1, spread) {
    if (!m.parts || n <= 0) return;
    n = Math.round(n * (m.gm || 1)); if (n <= 0) return;
    mold.dir = dir; mold.speed[0] = s0 * m.sc; mold.speed[1] = s1 * m.sc; mold.spread = spread;
    m.parts.spray(x, y, n, mold);
  }
  function puff(m, x, y, n, size, o) { if (m.parts) m.parts.puff(x, y, n, size * m.sc, o || DUST); }

  /* ---- estado comum ---- */
  function baseState(id, opts) {
    opts = opts || {};
    const m = {
      id, sc: opts.scale || 1, pal: opts.pilot || 'kome', t: 0, ev: [],
      x: 0, y: 0, face: 1, turn: 1, off: 0, ph: 0, busy: false, wrap: false, load: 0, power: 1, boost: 0, idle: 0, n: 0,
      fl: null, gy: 0, parts: null, rate: 1, acc: 0, acc2: 0, lastX: NaN, vx: 0,
      kt: opts.seed || 0, w: 0, sqk: 0, pose: 'stand', kx: 0, ky: 0, rot: 0, sq: 0, eyes: null, mouth: null,
      px: 0, py: 0, ang: 0,
      biteO: { x: 0, y: 0, r: 0, active: false, phase: 0, w: 0, h: 0 }, dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
      hasDump: true, floorF: null, update: null, drawFn: null,
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
    m.turn = clamp(m.turn + (m.face - m.turn > 0 ? 1 : -1) * Math.min(Math.abs(m.face - m.turn), dt * 7), -1, 1);
    m.power = inp.power === undefined ? 1 : clamp(inp.power, 0, 1);
    m.gm = inp.grainMul || 1;
    m.boost = damp(m.boost, inp.boost || 0, 8, dt);
    m.rate = clamp((inp.speedMul || 1) * (0.72 + 0.28 * m.power) * (1 + 0.15 * (inp.boost || 0)), 0.4, 2.6);
    m.vx = inp.vx !== undefined ? inp.vx : (m.lastX === m.lastX && dt > 0 ? (m.x - m.lastX) / dt : 0);
    m.lastX = m.x;
    m.sqk = damp(m.sqk, 0, 11, dt);
    const dig = !!inp.digging;
    m.w = damp(m.w, dig || m.busy ? 1 : 0, 10, dt);
    if (dig) m.idle = 0; else m.idle += dt;
    return dig;
  }
  const visFace = m => { const f = Math.sin(m.turn * PI / 2); return Math.abs(f) < 0.12 ? (m.turn >= 0 ? 0.12 : -0.12) : f; };
  function cycle(m, dt, digging, T) {
    const p0 = m.ph;
    if (!m.busy && digging) { m.busy = true; m.ph = 0; }
    if (m.busy) {
      m.ph += dt * m.rate / T;
      if (m.ph >= 1) { m.n++; if (digging) m.ph -= 1; else { m.ph = 0; m.busy = false; } }
    }
    m.wrap = m.busy && m.ph < p0;
    return p0;
  }
  const crossed = (m, p0, u) => m.busy && ((p0 < u && m.ph >= u) || (m.wrap && (u > p0 || u <= m.ph)));

  /* ---- modelo <-> mundo ---- */
  const WX = (m, lx) => m.x + m.face * m.sc * lx, WY = (m, ly) => m.y + m.sc * ly;
  const flo = (m, lx) => (m.floorF(m.x + m.face * m.sc * lx) - m.y) / m.sc;      // chão (y do modelo) em lx
  const backDir = (m, a) => (m.face > 0 ? -PI / 2 - a : -PI / 2 + a);            // ângulo de mundo: pra cima, 'a' rad pra trás
  // ponto local do sprite do Kome (origem nos pés) -> modelo, com a mesma rotação/squash do drawShiba
  function xf(lx, ly, kx, ky, rot, sq, out) {
    lx *= 1 + sq * 0.6; ly *= 1 - sq;
    const c = Math.cos(rot), s = Math.sin(rot);
    out.x = kx + lx * c - ly * s; out.y = ky + lx * s + ly * c; return out;
  }
  function anchor(m, pose, t, name, kx, ky, rot, sq, out) {
    KO.pal = m.pal;
    E.shibaAnchor(pose, E.drawShiba.frameT(t, KO), name, AT, AO);
    return xf(AT.x, AT.y, kx, ky, rot, sq, out);
  }
  function kome(g, m, pose, t, kx, ky, rot, sq, eyes, mouth, hat, alpha) {
    KO.pal = m.pal; KO.rot = rot; KO.squash = sq; KO.eyes = eyes || null; KO.mouth = mouth || null; KO.hat = hat !== false;
    KO.alpha = alpha === undefined ? 1 : alpha; KO.smooth = m.sc * (Draw.zoom || 1) < 0.75;
    E.drawShiba(g, kx, ky, pose, t, KO);
  }
  const komeM = (g, m) => kome(g, m, m.pose, m.kt, m.kx, m.ky, m.rot, m.sq, m.eyes, m.mouth);
  function enter(g, m, fx) {
    g.save(); g.translate(m.x, m.y); g.scale((fx === undefined ? visFace(m) : fx) * m.sc, m.sc);
    g.lineJoin = 'round'; g.lineCap = 'round';
  }

  /* ---- peças desenhadas (unidades de arte) ---- */
  function stick(g, x0, y0, x1, y1, w, col) {
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
    g.strokeStyle = LINE; g.lineWidth = w + 1.7; g.stroke();
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
  function disc(g, x, y, r, col, lw) {
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col; g.fill();
    if (lw !== 0) { g.strokeStyle = LINE; g.lineWidth = lw || 0.9; g.stroke(); }
  }
  // montinho de arroz (meia elipse) com grãos marcados
  function mound(g, x, y, rx, ry) {
    if (ry < 0.4) return;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, PI, TAU); g.closePath();
    g.fillStyle = PAL.rice; g.fill(); g.strokeStyle = LINE; g.lineWidth = 0.9; g.stroke();
    g.fillStyle = PAL.riceD;
    g.fillRect(x - rx * 0.45, y - ry * 0.45, 1.2, 0.6); g.fillRect(x + rx * 0.2, y - ry * 0.62, 1.2, 0.6); g.fillRect(x + rx * 0.5, y - ry * 0.25, 1, 0.6);
    g.fillRect(x - rx * 0.1, y - ry * 0.25, 1.2, 0.6);
  }
  // pá: pivô (pata) em (px,py), cabo ao longo do ângulo a; back = cabo pra trás da pata, fwd = até o pescoço da lâmina
  function shovel(g, px, py, a, back, fwd, bs, far, load) {
    g.save(); g.translate(px, py); g.rotate(a);
    stick(g, -back, 0, fwd, 0, 1.7, far ? PAL.woodD : PAL.wood);
    g.beginPath(); g.arc(-back - 1.6, 0, 1.9, 0, TAU);
    g.strokeStyle = LINE; g.lineWidth = 2.5; g.stroke(); g.strokeStyle = far ? PAL.wood : PAL.woodL; g.lineWidth = 1; g.stroke();
    const h = bs / 2;
    g.beginPath(); g.moveTo(fwd - 1, -h); g.lineTo(fwd + bs * 0.75, -h); g.quadraticCurveTo(fwd + bs * 1.5, 0, fwd + bs * 0.75, h); g.lineTo(fwd - 1, h); g.closePath();
    g.fillStyle = far ? PAL.steelD : PAL.steel; g.fill(); g.strokeStyle = LINE; g.lineWidth = 1; g.stroke();
    g.fillStyle = far ? PAL.steel : PAL.steelL; g.fillRect(fwd + 0.6, -h + 1, bs * 0.7, 1.1);
    g.fillStyle = far ? PAL.gray : PAL.steelD; g.fillRect(fwd + 0.6, h - 1.9, bs * 0.7, 1);
    if (load > 0.02) { g.translate(fwd + bs * 0.55, 0); g.rotate(-a); mound(g, 0, bs * 0.3, bs * 0.62 * load, bs * 0.8 * load); }
    g.restore();
  }
  // tigela azul; fill 0..1 = arroz aparecendo por cima da borda
  function bowl(g, x, y, a, r, fill) {
    g.save(); g.translate(x, y); g.rotate(a);
    if (fill > 0.02) mound(g, 0, 0.4, r * 0.86, r * 0.72 * fill);
    g.fillStyle = PAL.bowl; g.strokeStyle = LINE; g.lineWidth = 1;
    g.fillRect(-r * 0.3, r * 0.82, r * 0.6, r * 0.34); g.strokeRect(-r * 0.3, r * 0.82, r * 0.6, r * 0.34);
    g.beginPath(); g.arc(0, 0, r, 0, PI); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = PAL.bowlL; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r * 0.62, PI * 0.55, PI * 0.9); g.stroke();
    g.fillStyle = PAL.bowlL; g.fillRect(-r + 0.9, 0.5, r * 2 - 1.8, 1);
    g.restore();
  }
  // brilho e riscos de velocidade do boost
  function boostFx(g, m, cx, cy, r) {
    const b = m.boost * (0.3 + 0.7 * m.w); if (b < 0.02) return;
    const k = Math.floor(m.t * 20);
    g.globalAlpha = (0.1 + 0.04 * Math.sin(m.t * 17)) * b; g.fillStyle = PAL.goldL;
    g.beginPath(); g.arc(cx, cy, r * 0.95, 0, TAU); g.fill();
    g.beginPath(); g.arc(cx, cy, r * 0.62, 0, TAU); g.fill();
    g.globalAlpha = 0.85 * b; g.strokeStyle = PAL.white; g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const h1 = hash(i * 7 + k * 13), h2 = hash(i * 3 + k * 5 + 1), y = cy + (h1 - 0.5) * r * 2.1, x = cx - r * (0.7 + h2 * 0.9);
      g.moveTo(x, y); g.lineTo(x - 5 - h1 * 9, y);
    }
    g.stroke(); g.globalAlpha = 1;
  }
  function shadow(g, x, y, rx) { Draw.shadow(g, x, y, rx, rx * 0.22, 0.18); }

  /* ======================================================================
     1. PATA — duas patas frenéticas, arroz voando pra trás
     ====================================================================== */
  function makePata(opts) {
    const m = baseState('pata', opts); m.hasDump = false;
    m.update = (dt, inp) => {
      const dig = begin(m, dt, inp);
      m.busy = dig;
      m.kt += dt * (dig ? m.rate * 1.25 : 1);
      if (dig) {
        m.ph = (m.ph + dt * m.rate / 0.4) % 1;
        m.acc2 += dt * m.rate * 8.7;
        if (m.acc2 >= 1) {
          m.acc2 -= 1; m.n++; m.ev.push('hit');
          if (m.n % 3 === 0) puff(m, WX(m, 13), WY(m, flo(m, 13) - 1), 1, 3.5, DUSTW);
        }
        m.acc += dt * m.rate * (16 + 12 * m.power + 14 * m.boost); const n = m.acc | 0; m.acc -= n;
        spray(m, WX(m, -7), WY(m, -5), n, GRAIN, backDir(m, 0.85), 70, 150, 0.45);
      } else m.ph = 0;
      m.pose = m.w > 0.4 ? 'dig' : (m.idle > 3 && m.idle % 7 > 4.6 ? 'sniff' : 'stand');
      m.rot = 0.11 * m.w; m.sq = m.w * 0.035 * Math.sin(m.kt * 44);
      m.kx = m.w * Math.sin(m.kt * 44) * 0.4; m.ky = 0;
      const b = m.biteO; b.x = WX(m, 13); b.y = m.floorF(b.x); b.r = 6 * m.sc; b.active = dig; b.phase = m.ph;
      m.seatO.x = m.x; m.seatO.y = WY(m, -14);
    };
    m.drawFn = g => {
      enter(g, m); shadow(g, 0, 1, 13);
      boostFx(g, m, 0, -14, 20);
      komeM(g, m);
      g.restore();
    };
    return m;
  }

  /* ======================================================================
     2. HASHI — pinça grão por grão absurdamente rápido e joga por cima do ombro (pra dentro de uma tigelinha)
     ====================================================================== */
  const H_T = 0.17, H_L = 15, H_BOWL = -25;
  function makeHashi(opts) {
    const m = baseState('hashi', opts);
    let aim = 1.05, open = 1, grain = 0, bump = 0;
    m.update = (dt, inp) => {
      const dig = begin(m, dt, inp), p0 = cycle(m, dt, dig, H_T), u = m.ph;
      m.kt += dt;
      if (m.wrap || (m.busy && p0 === 0)) aim = 0.85 + 0.45 * hash(m.n + 1);
      let a, jab = 0;
      if (m.busy) {
        jab = seg(u, 0, 0.3) * (1 - seg(u, 0.42, 0.62));
        a = lerp(0.45, aim, seg(u, 0, 0.28)) + (-1.95 - aim) * seg(u, 0.42, 0.62) + (0.45 + 1.95) * seg(u, 0.78, 1);
        open = u < 0.3 ? 1 : u < 0.6 ? 0 : 1;
        grain = u >= 0.3 && u < 0.6 ? 1 : 0;
      } else {
        a = 0.35 + 0.08 * Math.sin(m.t * 2.1); grain = 0;
        open = m.idle % 2.6 < 0.42 ? 0.5 + 0.5 * Math.cos(m.idle * 34) : 1;          // "tec-tec" à toa
      }
      m.pose = 'point'; m.eyes = m.busy ? 'squint' : null; m.mouth = m.busy ? 'tongue' : 'smile';
      m.rot = 0.1 * m.w + 0.2 * jab - 0.07 * (m.busy ? seg(u, 0.5, 0.62) * (1 - seg(u, 0.8, 1)) : 0);
      m.sq = m.sqk; m.kx = 0; m.ky = 0;
      anchor(m, 'point', m.kt, 'hold', 0, 0, m.rot, m.sq, T1);
      m.px = T1.x; m.py = T1.y; m.ang = a; m.open = open; m.grain = grain;
      const tx = m.px + H_L * Math.cos(a), ty = m.py + H_L * Math.sin(a);
      if (crossed(m, p0, 0.3)) { m.ev.push('tic'); m.sqk += 0.03; if (m.n % 2 === 0) puff(m, WX(m, tx), WY(m, ty), 1, 2.5, DUSTW); }
      if (crossed(m, p0, 0.6)) {
        const sx = WX(m, tx), sy = WY(m, ty), dx = WX(m, H_BOWL) - sx, vy = -175 - 25 * hash(m.n * 3), tt = 0.47;
        if (m.parts) { BIGGRAIN.dir = Math.atan2(vy * m.sc, dx / tt); const sp = Math.hypot(vy * m.sc, dx / tt); BIGGRAIN.speed[0] = sp; BIGGRAIN.speed[1] = sp * 1.04; m.parts.spray(sx, sy, 1 + (m.boost > 0.5 ? 1 : 0), BIGGRAIN); }
        bump = 1; m.load = ((m.n % 30) + 1) / 30;
      }
      bump = damp(bump, 0, 9, dt); m.bump = bump;
      const b = m.biteO; b.x = WX(m, m.px + H_L * Math.cos(aim)); b.y = m.floorF(b.x); b.r = 8 * m.sc; b.active = m.busy; b.phase = u;
      const d = m.dumpO; d.x = WX(m, H_BOWL); d.y = WY(m, flo(m, H_BOWL) - 4); d.active = m.busy && u >= 0.6 && u < 0.8;
      m.seatO.x = m.x; m.seatO.y = WY(m, -16);
    };
    m.drawFn = g => {
      enter(g, m); shadow(g, 1, 1, 10);
      boostFx(g, m, 2, -18, 22);
      const by = flo(m, H_BOWL);
      shadow(g, H_BOWL, by + 0.5, 6);
      bowl(g, H_BOWL, by - 4.6 + m.bump * 0.8, 0, 4.6, 0.25 + 0.75 * m.load);
      komeM(g, m);
      const a = m.ang, o = m.open * 0.15, c1 = PAL.redD, c2 = PAL.red;
      for (let i = 0; i < 2; i++) {
        const aa = a + (i ? o : -o), cx = Math.cos(aa), sy = Math.sin(aa);
        stick(g, m.px - cx * 3.5, m.py - sy * 3.5, m.px + cx * H_L, m.py + sy * H_L, 0.8, i ? c2 : c1);
      }
      const tx = m.px + H_L * Math.cos(a), ty = m.py + H_L * Math.sin(a);
      if (m.grain) { g.save(); g.translate(tx, ty); g.rotate(a + 1.2); g.beginPath(); g.ellipse(0, 0, 1.9, 1.05, 0, 0, TAU); g.fillStyle = PAL.rice; g.fill(); g.strokeStyle = LINE; g.lineWidth = 0.8; g.stroke(); g.restore(); }
      disc(g, m.px, m.py, 1.5, PAL.cream, 0.8);
      g.restore();
    };
    return m;
  }

  /* ======================================================================
     3. TIGELA — enche, joga em arco por cima do ombro, tigela vazia
     ====================================================================== */
  const TG_T = 0.4, TG_R = 6.4;
  function makeTigela(opts) {
    const m = baseState('tigela', opts);
    m.fill = 0; m.ba = 0;
    m.update = (dt, inp) => {
      const dig = begin(m, dt, inp), p0 = cycle(m, dt, dig, TG_T), u = m.ph;
      m.kt += dt * (m.busy ? 1.4 : 1);
      if (m.busy) {
        m.rot = 0.06 + 0.46 * seg(u, 0, 0.28) - 0.8 * seg(u, 0.3, 0.55) + 0.34 * seg(u, 0.74, 1);
        m.pose = u > 0.42 && u < 0.84 ? 'carry' : 'point';
        m.sq = m.sqk - 0.07 * seg(u, 0.44, 0.56) * (1 - seg(u, 0.6, 0.8));
        m.ba = 0.95 * (1 - seg(u, 0.12, 0.3)) - 2.1 * seg(u, 0.47, 0.57) + 3.05 * seg(u, 0.72, 0.98);
        m.eyes = u > 0.42 && u < 0.84 ? 'happy' : null; m.mouth = u > 0.42 && u < 0.84 ? 'open' : null;
        anchor(m, m.pose, m.kt, m.pose === 'carry' ? 'paw' : 'hold', 0, 0, m.rot, m.sq, T1);
        m.px = T1.x + (m.pose === 'carry' ? -1 : 2.5); m.py = T1.y + (m.pose === 'carry' ? -3 : 1.5);
        if (crossed(m, p0, 0.3)) { m.fill = 1; m.sqk += 0.1; m.ev.push('scoop'); puff(m, WX(m, m.px + 3), WY(m, m.py + 3), 2, 4, DUSTW); spray(m, WX(m, m.px + 4), WY(m, m.py), 3, GRAIN, -PI / 2, 40, 90, 1); }
        if (crossed(m, p0, 0.55)) {
          m.fill = 0; m.ev.push('toss');
          spray(m, WX(m, m.px - 3), WY(m, m.py - 5), Math.round(9 + 9 * m.power + 8 * m.boost), GRAIN, backDir(m, 0.62), 150, 215, 0.2);
        }
      } else {
        m.rot = 0; m.sq = 0; m.pose = 'sit'; m.eyes = null; m.mouth = null;
        m.px = 18; m.py = flo(m, 18) - TG_R - 1.6; m.ba = 0; m.fill = damp(m.fill, 0.45, 4, dt);
      }
      m.load = m.fill; m.kx = 0; m.ky = 0;
      const b = m.biteO; b.x = WX(m, 24); b.y = m.floorF(b.x); b.r = 11 * m.sc; b.active = m.busy && u > 0.12 && u < 0.34; b.phase = u;
      const d = m.dumpO; d.x = WX(m, -46); d.y = m.floorF(d.x); d.active = m.busy && u >= 0.55 && u < 0.75;
      m.seatO.x = m.x; m.seatO.y = WY(m, -16);
    };
    m.drawFn = g => {
      enter(g, m); shadow(g, 1, 1, 11);
      boostFx(g, m, 2, -20, 24);
      if (!m.busy) shadow(g, m.px, m.py + TG_R + 1.8, 7);
      komeM(g, m);
      bowl(g, m.px, m.py, m.ba, TG_R, m.fill);
      if (m.busy && m.pose === 'point') disc(g, m.px - 3.2, m.py + 0.5, 1.5, PAL.cream, 0.8);
      g.restore();
    };
    return m;
  }

  /* ======================================================================
     4. PÁ — carrega o golpe lá atrás, desce com squash, torrão voa
     ====================================================================== */
  const PA_T = 0.625, PA_REST = -0.3;
  const strike = u => { const k = clamp((u - 0.36) / 0.14, 0, 1); return k * k; };
  function makePa(opts) {
    const m = baseState('pa', opts);
    m.clod = 0; m.wob = E.Spring(0, { k: 160, d: 5 });
    m.update = (dt, inp) => {
      const dig = begin(m, dt, inp), p0 = cycle(m, dt, dig, PA_T), u = m.ph;
      m.kt += dt * (m.busy ? 1.2 : 1);
      m.wob.update(dt);
      if (m.busy) {
        m.rot = -0.32 * seg(u, 0.02, 0.34) + 0.8 * strike(u) - 0.33 * seg(u, 0.52, 0.72) - 0.15 * seg(u, 0.76, 1);
        m.ang = PA_REST + (-2.55 - PA_REST) * seg(u, 0, 0.3) - 0.25 * seg(u, 0.28, 0.36) + 3.7 * strike(u) - 0.8 * seg(u, 0.52, 0.66) - 0.8 * seg(u, 0.62, 0.76) + 0.4 * seg(u, 0.8, 1);
        m.pose = u > 0.05 && u < 0.4 ? 'carry' : 'point';
        m.sq = m.sqk - 0.08 * seg(u, 0.1, 0.34) * (1 - strike(u));
        m.eyes = 'squint'; m.mouth = u < 0.5 ? 'grit' : 'open';
        anchor(m, m.pose, m.kt, m.pose === 'carry' ? 'paw' : 'hold', 0, 0, m.rot, m.sq, T1);
        m.px = T1.x; m.py = T1.y;
        if (u > 0.4 && m.ang > 0) {                                              // a lâmina morde, mas não some debaixo do chão
          const lim = flo(m, m.px + 22 * Math.cos(m.ang)) + 3.5 - m.py;
          if (22 * Math.sin(m.ang) > lim) m.ang = Math.asin(clamp(lim / 22, -1, 1));
        }
        const tx = WX(m, m.px + 21 * Math.cos(m.ang)), ty = WY(m, m.py + 21 * Math.sin(m.ang));
        if (crossed(m, p0, 0.5)) {
          m.sqk += 0.2; m.clod = 1; m.ev.push('hit');
          const hx = WX(m, m.px + 17), hy = m.floorF(hx);
          puff(m, hx, hy, 4, 7, DUSTW);
          spray(m, hx, hy - 2, Math.round(6 + 6 * m.power), GRAIN, -PI / 2, 60, 150, 1.2);
        }
        if (crossed(m, p0, 0.66)) {
          m.clod = 0; m.ev.push('toss');
          spray(m, tx, ty, Math.round(4 + 3 * m.power + 2 * m.boost), CLOD, backDir(m, 0.5), 150, 230, 0.3);
          spray(m, tx, ty, Math.round(8 + 8 * m.power), GRAIN, backDir(m, 0.5), 120, 240, 0.4);
        }
      } else {
        if (m.pose !== 'proud') m.wob.kick(3);
        m.pose = 'proud'; m.rot = 0; m.sq = 0; m.eyes = null; m.mouth = null; m.clod = 0;
        m.px = 17; m.py = flo(m, 17) - 15; m.ang = PI / 2 + m.wob.x * 0.3;
      }
      m.kx = 0; m.ky = 0; m.load = m.clod;
      const b = m.biteO; b.x = WX(m, 30); b.y = m.floorF(b.x) - 3 * m.sc; b.r = 15 * m.sc; b.active = m.busy && u > 0.47 && u < 0.64; b.phase = u;
      const d = m.dumpO; d.x = WX(m, -50); d.y = m.floorF(d.x); d.active = m.busy && u >= 0.66 && u < 0.86;
      m.seatO.x = m.x; m.seatO.y = WY(m, -18);
    };
    m.drawFn = g => {
      enter(g, m); shadow(g, 1, 1, 11);
      boostFx(g, m, 2, -20, 26);
      const u = m.ph, behind = m.busy && m.pose === 'carry';
      if (m.busy && u > 0.37 && u < 0.52) {                                      // rastro do golpe
        g.globalAlpha = 0.5 * (1 - (u - 0.37) / 0.15 * 0.5); g.strokeStyle = PAL.white; g.lineWidth = 4;
        g.beginPath(); g.arc(m.px, m.py, 18, m.ang - 1.5, m.ang - 0.15); g.stroke(); g.globalAlpha = 1;
      }
      if (behind) shovel(g, m.px - 11, m.py - 2.5, m.ang, 9, 13, 8, false, 0);
      komeM(g, m);
      if (!behind) {
        shovel(g, m.px, m.py, m.ang, 9, 13, 8, false, m.clod);
        if (m.busy) disc(g, m.px, m.py, 1.6, PAL.cream, 0.8);
      }
      g.restore();
    };
    return m;
  }

  /* ======================================================================
     5. DUAS PÁS — em pé, uma em cada pata, girando alternadas feito moinho; a cada 8 golpes um giro-helicóptero
     ====================================================================== */
  const DP_T = 0.625, DP_HIT = 0.95;
  function makeDuasPas(opts) {
    const m = baseState('duaspas', opts);
    m.a1 = 0; m.a2 = 0; m.x2 = 0; m.y2 = 0; m.spin = 0; m.hits = 0;
    m.update = (dt, inp) => {
      const dig = begin(m, dt, inp), p0 = cycle(m, dt, dig, DP_T), u = m.ph;
      m.kt += dt * (m.busy ? 1.35 * m.rate : 1);
      m.spin = Math.max(0, m.spin - dt * m.rate / 0.42);
      if (m.busy) {
        const th = TAU * (u + 0.035 * Math.sin(TAU * 2 * (u - 0.02))) + DP_HIT - TAU * 0.1;
        m.a1 = th; m.a2 = th + PI;
        m.pose = 'carry'; m.eyes = 'happy'; m.mouth = 'open';
        m.rot = 0.3 + 0.06 * Math.sin(TAU * 2 * u + 0.6); m.sq = m.sqk - 0.03;
        anchor(m, 'carry', m.kt, 'paw', 0, 0, m.rot, m.sq, T1); m.px = T1.x; m.py = T1.y;
        E.shibaAnchor('carry', E.drawShiba.frameT(m.kt, KO), 'paw', AT, AO);
        xf(AT.x - 23.5, AT.y + 1, 0, 0, m.rot, m.sq, T2); m.x2 = T2.x; m.y2 = T2.y;
        for (let i = 0; i < 2; i++) {
          if (!crossed(m, p0, i ? 0.6 : 0.1)) continue;
          m.hits++; m.sqk += 0.11; m.ev.push('hit');
          const big = m.hits % 8 === 0;
          if (big) { m.spin = 1; m.ev.push('spin'); }
          const lx = (i ? m.x2 : m.px) + 26 * Math.cos(DP_HIT), hx = WX(m, lx), hy = Math.min(WY(m, (i ? m.y2 : m.py) + 26 * Math.sin(DP_HIT)), m.floorF(hx));
          puff(m, hx, hy, big ? 7 : 4, big ? 10 : 7, DUSTW);
          spray(m, hx, hy - 3, Math.round((4 + 3 * m.power + 3 * m.boost) * (big ? 2 : 1)), CLOD, backDir(m, 0.45), 170, 270, 0.35);
          spray(m, hx, hy - 3, Math.round((7 + 7 * m.power) * (big ? 2 : 1)), GRAIN, backDir(m, 0.3), 110, 280, 0.7);
        }
      } else {
        m.pose = 'proud'; m.rot = 0; m.sq = 0; m.eyes = null; m.mouth = null;
        m.px = 17; m.py = flo(m, 17) - 16; m.x2 = 17; m.y2 = m.py;
        m.a1 = PI / 2 - 0.42 + 0.03 * Math.sin(m.t * 2); m.a2 = PI / 2 + 0.42;
      }
      m.kx = 0; m.ky = 0;
      const b = m.biteO, hw = m.busy && ((u > 0.06 && u < 0.22) || (u > 0.56 && u < 0.72));
      b.x = WX(m, 32); b.y = m.floorF(b.x) - 6 * m.sc; b.r = 19 * m.sc * (m.spin > 0 ? 2 : 1); b.active = hw || m.spin > 0.3; b.phase = u;
      const d = m.dumpO; d.x = WX(m, -55); d.y = m.floorF(d.x); d.active = b.active;
      m.seatO.x = m.x; m.seatO.y = WY(m, -22);
    };
    function trail(g, x, y, a, al) {
      g.globalAlpha = al; g.strokeStyle = PAL.white; g.lineWidth = 5;
      g.beginPath(); g.arc(x, y, 22, a - 1.25, a - 0.2); g.stroke();
      g.globalAlpha = al * 0.6; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 15, a - 0.9, a - 0.2); g.stroke(); g.globalAlpha = 1;
    }
    m.drawFn = g => {
      const sp = m.spin > 0 ? Math.cos(m.spin * TAU) : 1;
      enter(g, m, visFace(m) * (Math.abs(sp) < 0.2 ? (sp < 0 ? -0.2 : 0.2) : sp)); shadow(g, 1, 1, 11);
      boostFx(g, m, 4, -24, 30);
      if (m.busy) {
        if (m.spin > 0) { g.globalAlpha = 0.35; g.strokeStyle = PAL.white; g.lineWidth = 3; g.beginPath(); g.ellipse(4, -30, 36, 7, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; }
        trail(g, m.x2, m.y2, m.a2, 0.3);
        shovel(g, m.x2, m.y2, m.a2, 2, 17, 7.5, true, 0);
      } else shovel(g, m.x2 + 2, m.y2, m.a2, 2, 14, 7.5, true, 0);
      komeM(g, m);
      if (m.busy) { trail(g, m.px, m.py, m.a1, 0.45); shovel(g, m.px, m.py, m.a1, 2, 17, 7.5, false, 0); disc(g, m.px, m.py, 1.6, PAL.cream, 0.8); }
      else shovel(g, m.px - 2, m.py, m.a1, 2, 14, 7.5, false, 0);
      g.restore();
    };
    return m;
  }

  /* ======================================================================
     6. CARRINHO DE MÃO — enfia no barranco, enche (E.Pile), basculha pra despejar; roda bamba
     ====================================================================== */
  const CR_T = 1.2, CR_L = 34, CR_A0 = Math.atan2(-10, -32.5), CR_WR = 5;
  function makeCarrinho(opts) {
    const m = baseState('carrinho', opts);
    const pile = E.Pile({ cap: 100, cols: 12, slope: 0.12, max: 1.25 });
    const hop = E.Spring(0, { k: 260, d: 9 });
    m.pile = pile; m.ax = 53; m.ay = -5; m.phi = 0; m.wrot = 0; m.tip = 0; m.kxi = -10; m.shud = 0;
    let lastAx = 53, rev = 0;
    m.update = (dt, inp) => {
      const dig = begin(m, dt, inp), p0 = cycle(m, dt, dig, CR_T), u = m.ph;
      let off = 0, tip = 0;
      if (m.busy) {
        const r = seg(u, 0, 0.25);
        off = 14 * r * r - 17 * seg(u, 0.56, 0.7) + 3 * seg(u, 0.92, 1);
        tip = seg(u, 0.7, 0.8) * (1 - seg(u, 0.92, 1));
        if (crossed(m, p0, 0.25)) { m.ev.push('hit'); hop.kick(-55); m.sqk += 0.12; puff(m, WX(m, m.ax + 6), WY(m, flo(m, m.ax + 6) - 2), 5, 8, DUSTW); spray(m, WX(m, m.ax + 5), WY(m, -8), Math.round(8 + 8 * m.power), GRAIN, -PI / 2, 60, 170, 1.2); }
        if (u > 0.25 && u < 0.56) {
          pile.add(dt * m.rate * 100 / (0.31 * CR_T), 0.72, 0.2);
          m.shud = 1;
          m.acc += dt * 46 * (0.6 + m.power); const n = m.acc | 0; m.acc -= n;
          spray(m, WX(m, m.ax - 6), WY(m, m.ay - 28), n, GRAIN, PI / 2 + m.face * 0.5, 30, 90, 0.5);
        }
        if (crossed(m, p0, 0.8)) { m.ev.push('dump'); hop.kick(-30); }
        if (u > 0.79 && u < 0.93 && pile.v > 0) {
          pile.take(dt * m.rate * 125 / (0.12 * CR_T), 0.95);
          xf(-1, -19, m.ax, m.ay, m.phi, 0, T3);
          m.acc2 += dt * 150 * (0.6 + m.power); const n = m.acc2 | 0; m.acc2 -= n;
          spray(m, WX(m, T3.x), WY(m, T3.y), n, GRAIN, PI / 2 - m.face * 0.5, 40, 130, 0.5);
        }
      }
      m.shud = damp(m.shud, 0, 14, dt);
      m.tip = tip; m.off = off;
      m.kxi = damp(m.kxi, m.busy || Math.abs(m.vx) > 4 ? 0 : -10, 9, dt);
      const walk = Math.abs(m.vx) * 0.05 / m.sc;
      m.kt += dt * (m.busy ? 0.35 + 1.6 * Math.abs(off - (m.lastOff || 0)) / Math.max(dt, 1e-4) / 40 : 1) + dt * walk;
      m.lastOff = off;
      hop.update(dt);
      // Kome: empurra (push); na basculada fica em pé e ergue os cabos por cima da cabeça (carry)
      const up = tip > 0.5;
      m.pose = m.busy || Math.abs(m.vx) > 4 ? (up ? 'carry' : 'push') : 'pant';
      m.kx = m.kxi + off + 22 * tip; m.ky = 0;
      m.rot = m.busy ? (up ? 0.12 : -0.1 * tip + 0.05 * seg(u, 0.05, 0.25) * (1 - seg(u, 0.3, 0.5))) : 0;
      m.sq = m.sqk * 0.5; m.eyes = up ? 'happy' : null; m.mouth = up ? 'open' : null;
      // punho: mistura das duas poses pra o carrinho não pular quando a pose troca
      const pk = off + 22 * tip;
      anchor(m, 'push', m.kt, 'hold', pk, 0, 0, 0, T1);
      anchor(m, 'carry', m.kt, 'paw', pk, 0, 0.12, 0, T2);
      const gx = lerp(T1.x, T2.x, tip), gy = lerp(T1.y, T2.y + 2, tip);
      const gnd = clamp(flo(m, m.ax), -7, 4);
      m.ay = gnd - CR_WR + hop.x * 0.05 + (m.shud > 0.05 ? Math.sin(m.t * 70) * 0.5 * m.shud : 0);
      const dy = gy - m.ay;
      m.ax = gx + Math.sqrt(Math.max(4, CR_L * CR_L - dy * dy));
      m.phi = Math.atan2(gy - m.ay, gx - m.ax) - CR_A0;
      m.px = gx; m.py = gy;
      const dAx = (m.ax - lastAx) + m.vx * dt / m.sc * m.face; lastAx = m.ax;
      m.wrot += dAx / CR_WR;
      const rv = Math.floor(m.wrot / TAU); if (rv !== rev) { rev = rv; m.ev.push('squeak'); }
      pile.tilt = clamp(m.phi * 1.3, -1, 1);
      pile.update(dt);
      m.load = pile.frac;
      const b = m.biteO; b.x = WX(m, m.ax + 8); b.y = m.floorF(b.x) - 8 * m.sc; b.r = 22 * m.sc; b.active = m.busy && u > 0.22 && u < 0.56; b.phase = u;
      xf(-1, -19, m.ax, m.ay, m.phi, 0, T3);
      const d = m.dumpO; d.x = WX(m, T3.x + 3); d.y = WY(m, T3.y); d.active = m.busy && u > 0.79 && u < 0.93;
      m.seatO.x = WX(m, m.kx); m.seatO.y = WY(m, -18);
    };
    m.drawFn = g => {
      enter(g, m); shadow(g, m.kx, 1, 11); shadow(g, m.ax - 12, flo(m, m.ax - 12) + 1, 17);
      boostFx(g, m, m.kx + 14, -16, 30);
      const up = m.pose === 'carry';
      if (!up) komeM(g, m);
      // carrinho no próprio referencial: origem no eixo da roda, cabos pra -x
      g.save(); g.translate(m.ax, m.ay); g.rotate(m.phi);
      stick(g, -20.5, -8, -22, 3, 1.2, PAL.grayD);
      stick(g, 0, 0, -9, -8, 1.3, PAL.grayD);
      stick(g, -23, -9.6, -33.5, -10, 1.7, PAL.wood);
      PD.scale = m.sc * (Draw.zoom || 1);
      pile.draw(g, -14.5, -12.5, 23, 9, PD);
      g.beginPath(); g.moveTo(-28, -17.5); g.lineTo(-1, -19.5); g.lineTo(-8, -7); g.lineTo(-24, -7); g.closePath();
      g.fillStyle = PAL.red; g.fill();
      g.beginPath(); g.moveTo(-26.3, -11.5); g.lineTo(-5.5, -11.5); g.lineTo(-8, -7); g.lineTo(-24, -7); g.closePath(); g.fillStyle = PAL.redD; g.fill();
      g.beginPath(); g.moveTo(-28, -17.5); g.lineTo(-1, -19.5); g.lineTo(-8, -7); g.lineTo(-24, -7); g.closePath(); g.strokeStyle = LINE; g.lineWidth = 1; g.stroke();
      stick(g, -28, -17.5, -1, -19.5, 1, PAL.redL);
      // roda bamba: oval que muda com o giro + raios
      const wb = Math.sin(m.wrot) * 0.11;
      g.save(); g.rotate(-m.phi); g.translate(Math.sin(m.wrot * 0.5) * 0.5, 0); g.scale(1 + wb, 1 - wb * 0.6);
      disc(g, 0, 0, CR_WR, PAL.blk, 1); disc(g, 0, 0, 2.9, PAL.grayL, 0.7);
      g.strokeStyle = PAL.grayD; g.lineWidth = 0.8; g.beginPath();
      for (let i = 0; i < 3; i++) { const a = m.wrot + i * PI / 3; g.moveTo(Math.cos(a) * 2.6, Math.sin(a) * 2.6); g.lineTo(-Math.cos(a) * 2.6, -Math.sin(a) * 2.6); }
      g.stroke(); disc(g, 0, 0, 1, PAL.red, 0.6);
      g.restore();
      g.restore();
      if (up) komeM(g, m);
      else if (m.pose === 'push') { disc(g, m.px - 1, m.py - 0.5, 1.5, PAL.cream, 0.8); }
      g.restore();
    };
    return m;
  }

  /* ======================================================================
     7. BRITADEIRA — Kome em pé, corpo inteiro vibrando, chapéu pulando; mangueira até o compressorzinho amarelo
     ====================================================================== */
  const BR_KX = -12, BR_HZ = 15, BR_CX = -46;
  const hatCv = {};
  function kasa(pal) {
    if (hatCv[pal]) return hatCv[pal];
    const p = (E.PALS && E.PALS[pal]) || (E.PALS && E.PALS.kome) || { h: '#E3BC62', g: '#B98A3A' };
    return (hatCv[pal] = E.sprite('th_kasa_' + pal, 20, 11, P => {
      P.tri(1, 9, 19, 8, 9.5, 1, p.h); P.line(1.5, 8.6, 18.5, 7.6, 1.5, p.g); P.line(9, 2, 7, 7, 1, U.mixCss(p.h, '#FFFAE6', 0.35)); P.set(9, 1, p.g);
    }));
  }
  function makeBritadeira(opts) {
    const m = baseState('britadeira', opts); m.hasDump = false;
    const ex = E.Exhaust({ max: 22, size: 2.6 * m.sc, rate: 3.2, rise: 26 * m.sc, life: 1.0 });
    const hop = E.Spring(0, { k: 340, d: 9 }), tilt = E.Spring(0, { k: 200, d: 7 }), hose = E.Spring(0, { k: 110, d: 4 }), needle = E.Spring(0.2, { k: 60, d: 6 });
    m.on = 0; m.hp = 0; m.fr = 0; m.cxw = NaN; m.cx = BR_CX; m.cy = 0; m.hy = 0; m.hv = 0; m.hr = 0; m.putt = 0;
    m.jx = 0; m.jt = 0; m.tip = 0; m.gy2 = 0; m.wr = 0; m.hx = 0; m.hty = 0; m.dizzy = 0;
    m.update = (dt, inp) => {
      const dig = begin(m, dt, inp);
      m.busy = dig; m.fr++;
      m.on = damp(m.on, dig ? 1 : 0, dig ? 22 : 7, dt);
      m.dizzy = dig ? 0.7 : Math.max(0, m.dizzy - dt);
      const on = m.on, par = m.fr & 1 ? 1 : -1;
      m.kt += dt * (1 + on * 1.5);
      if (dig) m.ph = (m.ph + dt * m.rate / 0.5) % 1; else m.ph = 0;
      // batidas
      const hp0 = Math.floor(m.hp); m.hp += dt * BR_HZ * m.rate * (dig ? 1 : 0);
      const tat = Math.floor(m.hp) !== hp0;
      // Kome
      const vib = on * (0.75 + 0.3 * m.power + 0.3 * m.boost);
      m.pose = 'point'; m.kx = BR_KX + Math.sin(m.t * 61) * 0.45 * vib; m.ky = clamp(flo(m, BR_KX), -6, 6) + par * 0.7 * vib;
      m.rot = -0.07 * on + par * 0.022 * vib; m.sq = 0.05 * vib * par + m.sqk;
      m.eyes = on > 0.3 ? 'tight' : m.dizzy > 0 ? 'spiral' : null; m.mouth = on > 0.3 ? 'grit' : m.dizzy > 0 ? 'tongue' : 'smile';
      anchor(m, 'point', m.kt, 'hold', m.kx, m.ky, m.rot, m.sq, T1);
      m.px = T1.x; m.py = T1.y;
      m.jx = BR_KX + 20.5 + Math.sin(m.t * 53) * 0.3 * vib; m.jt = m.py - 1;
      m.gy2 = flo(m, m.jx);
      m.tip = m.gy2 + 2.5 + (dig && (m.hp % 1) < 0.5 ? 2.2 : 0) - (dig ? 0 : 1.5);
      // chapéu: quica na cabeça com gravidade própria
      anchor(m, 'point', m.kt, 'hatTop', m.kx, m.ky, m.rot, m.sq, T2);
      m.hx = T2.x; m.hty = T2.y;
      m.hv += 620 * dt; m.hy += m.hv * dt;
      if (m.hy >= 0) { m.hy = 0; m.hv = on > 0.3 ? -(34 + 44 * hash(m.fr)) * (0.7 + 0.3 * m.power) : (m.hv > 30 ? -m.hv * 0.35 : 0); }
      m.hr = damp(m.hr, on > 0.3 ? par * 0.16 + Math.sin(m.t * 23) * 0.12 : 0, 30, dt);
      // compressor: vem atrás com atraso, pulando a cada "puf" do motor
      const cxT = m.x + m.face * m.sc * BR_CX;
      if (m.cxw !== m.cxw || Math.abs(m.cxw - cxT) > 90 * m.sc) m.cxw = cxT;
      const cx0 = m.cxw; m.cxw = damp(m.cxw, cxT, 3.2, dt);
      m.cx = (m.cxw - m.x) / (m.face * m.sc); m.cy = flo(m, m.cx);
      const cv = Math.abs(m.cxw - cx0) / Math.max(dt, 1e-4) / m.sc;
      m.wr += (m.cxw - cx0) * m.face / m.sc / 3;
      const p1 = Math.floor(m.putt); m.putt += dt * (2.4 + 5.5 * on + cv * 0.08);
      if (Math.floor(m.putt) !== p1) { hop.kick(-(26 + 30 * on + Math.min(40, cv * 0.5))); tilt.kick((hash(m.putt | 0) - 0.5) * 3.4); }
      hop.update(dt); tilt.update(dt);
      if (hop.x > 0) { hop.x = 0; if (hop.v > 0) hop.v = -hop.v * 0.3; }
      needle.target = on > 0.3 ? 0.55 + 0.25 * hash(m.fr >> 2) : 0.88; needle.update(dt);
      if (tat) hose.kick(par * 26 * vib);
      hose.update(dt);
      ex.update(dt, WX(m, m.cx - 5), WY(m, m.cy + hop.x - 22), 0.12 + 0.7 * on);
      // lascas e poeira
      if (tat) {
        m.n++; m.ev.push('tat');
        const wx = WX(m, m.jx), wy = WY(m, m.gy2);
        spray(m, wx, wy - 1, Math.round(1 + 2 * m.power + 2 * m.boost), CHIP, -PI / 2, 70, 190 + 60 * m.power, 1.15);
        if (m.n % 3 === 0) puff(m, wx, wy, 2, 5, m.n % 2 ? DUST : DUSTW);
        if (m.n % 5 === 0) spray(m, wx, wy - 1, 2, GRAIN, -PI / 2, 60, 140, 1.3);
      }
      m.hop = hop.x; m.tilt = tilt.x * 0.05; m.hw = hose.x; m.nd = needle.x;
      const b = m.biteO; b.x = WX(m, m.jx); b.y = WY(m, m.gy2) + 9 * m.sc; b.r = 10 * m.sc; b.w = 14 * m.sc; b.h = 40 * m.sc; b.active = dig; b.phase = m.ph;
      m.seatO.x = WX(m, m.kx); m.seatO.y = WY(m, -20);
    };
    m.drawFn = g => {
      ex.draw(g);
      enter(g, m);
      const on = m.on, par = m.fr & 1 ? 1 : -1, cyy = m.cy + m.hop;
      shadow(g, BR_KX, m.ky + 1, 10); shadow(g, m.cx, m.cy + 1, 12 * (1 + m.hop * 0.03));
      boostFx(g, m, BR_KX + 4, -18, 26);
      // mangueira (atrás de tudo)
      const jy = m.jt + 4, ox = m.cx + 10, oy = cyy - 8, gl = Math.min(Math.max(m.gy2, m.cy), m.cy + 5);
      for (let i = 0; i < 2; i++) {
        g.beginPath(); g.moveTo(m.jx - 2.5, jy);
        g.bezierCurveTo(m.jx - 9, gl + 2.5 + m.hw * 0.5, ox + 14, gl + 3 - m.hw * 0.6 + Math.sin(m.t * 3) * 0.6, ox, oy);
        g.strokeStyle = i ? PAL.ora : LINE; g.lineWidth = i ? 1.5 : 3.1; g.stroke();
      }
      // compressor
      g.save(); g.translate(m.cx, cyy); g.rotate(m.tilt);
      stick(g, 8, -13, 14.5, -18.5, 1.1, PAL.grayD); stick(g, 13.4, -19.6, 15.8, -17.4, 1.2, PAL.blk);
      g.fillStyle = PAL.grayD; g.strokeStyle = LINE; g.lineWidth = 0.9; g.fillRect(-6.2, -22, 2.4, 5.5); g.strokeRect(-6.2, -22, 2.4, 5.5);
      stick(g, -6.6, -22.2 - (on > 0.3 ? par * 0.5 + 0.8 : 0), -3.2, -22.6 - (on > 0.3 ? 1.6 : 0), 0.7, PAL.gray);
      Draw.box(g, -10.5, -17.5, 21, 12.5, PAL.yel, B_R3);
      g.fillStyle = PAL.yelD; g.fillRect(-9.5, -8, 19, 2);
      g.fillStyle = PAL.blk; for (let i = 0; i < 3; i++) g.fillRect(-8.2 + i * 2.3, -14.6, 1.1, 5.2);
      Draw.box(g, 9.5, -10, 2.6, 3, PAL.steel, B_R1);
      disc(g, 4.2, -11.8, 3.5, PAL.cream, 0.9);
      g.fillStyle = PAL.red; g.fillRect(5.6, -13.9, 1.2, 1.2);
      const na = -PI * 1.15 + m.nd * PI * 1.25 + (on > 0.3 ? par * 0.22 : Math.sin(m.t * 9) * 0.04);
      g.strokeStyle = PAL.redD; g.lineWidth = 0.8; g.beginPath(); g.moveTo(4.2, -11.8); g.lineTo(4.2 + Math.cos(na) * 2.7, -11.8 + Math.sin(na) * 2.7); g.stroke();
      g.fillStyle = LINE; g.fillRect(3.8, -12.2, 0.9, 0.9);
      for (let i = 0; i < 2; i++) {
        const wx = i ? 6.2 : -6.2; disc(g, wx, -3, 3.1, PAL.blk, 0.9); disc(g, wx, -3, 1.3, PAL.grayL, 0);
        g.fillStyle = PAL.grayD; g.fillRect(wx + Math.cos(m.wr) * 1.9 - 0.4, -3 + Math.sin(m.wr) * 1.9 - 0.4, 0.8, 0.8);
      }
      g.restore();
      // braço de trás até o punho da britadeira
      xf(-2.5, -16.4, m.kx, m.ky, m.rot, m.sq, T3);
      stick(g, T3.x + 3, T3.y + 1, m.jx - 2.4, m.jt, 1.9, PAL.furS);
      // Kome borrado de tanto tremer (bochecha, orelha e rabo "duplos") + ele mesmo, sem chapéu
      if (on > 0.25) {
        kome(g, m, 'point', m.kt, m.kx - 0.8, m.ky - par * 1.5, m.rot, -m.sq, m.eyes, m.mouth, false, 0.3);
        kome(g, m, 'point', m.kt, m.kx + 0.9, m.ky + par * 0.4, m.rot + 0.03, m.sq, m.eyes, m.mouth, false, 0.25);
      }
      kome(g, m, 'point', m.kt, m.kx, m.ky, m.rot, m.sq, m.eyes, m.mouth, false);
      HATO.rot = m.hr + m.rot;
      E.drawSprite(g, kasa(m.pal), m.hx + 0.5, m.hty + m.hy, HATO);
      if (m.hy < -2.5) { g.strokeStyle = LINE; g.lineWidth = 0.6; g.globalAlpha = 0.55; g.beginPath(); g.moveTo(m.hx - 5, m.hty + 9); g.lineTo(m.hx - 5, m.hty + 9 + m.hy * 0.5); g.moveTo(m.hx + 5, m.hty + 8.5); g.lineTo(m.hx + 5, m.hty + 8.5 + m.hy * 0.5); g.stroke(); g.globalAlpha = 1; }
      // britadeira: punho em T, corpo amarelo, mola, ponteira que martela
      const jx = m.jx, top = m.jt, bot = Math.min(top + 12.5, Math.max(top + 7, m.gy2 - 6.5)), kick = on > 0.3 ? par * 0.5 : 0;
      stick(g, jx, bot - 1, jx, m.tip - 2.5, 1.3, PAL.steelD);
      g.beginPath(); g.moveTo(jx - 1.5, m.tip - 3); g.lineTo(jx + 1.5, m.tip - 3); g.lineTo(jx, m.tip + 1); g.closePath(); g.fillStyle = PAL.steel; g.fill(); g.strokeStyle = LINE; g.lineWidth = 0.8; g.stroke();
      Draw.box(g, jx - 2.2, bot - 2.4 + kick, 4.4, 2.6, PAL.blkL, B_R1);
      Draw.box(g, jx - 3.4, top + 1.2 + kick, 6.8, bot - top - 3.2, PAL.yel, B_R1);
      g.fillStyle = PAL.yelD; g.fillRect(jx - 2.6, top + 3.6 + kick, 5.2, 1);
      g.fillStyle = PAL.blk; g.fillRect(jx - 2.6, top + 5.4 + kick, 5.2, 0.9);
      stick(g, jx - 4.8, top + kick, jx + 4.8, top + kick, 1.5, PAL.blk);
      disc(g, m.px + 0.5, m.py - 0.2, 1.7, PAL.cream, 0.8);
      // risquinhos de vibração
      if (on > 0.3) {
        g.strokeStyle = LINE; g.lineWidth = 0.7; g.globalAlpha = 0.75; g.beginPath();
        const k = par > 0 ? 0 : 1.6;
        g.arc(BR_KX - 15 - k, m.ky - 20, 3, PI * 0.75, PI * 1.25); g.moveTo(BR_KX - 18 - k + Math.cos(PI * 0.75) * 3, m.ky - 20 + Math.sin(PI * 0.75) * 3);
        g.arc(BR_KX - 18 - k, m.ky - 20, 3, PI * 0.75, PI * 1.25);
        g.moveTo(jx + 7 + k + Math.cos(-0.5) * 3, top + 5 + Math.sin(-0.5) * 3); g.arc(jx + 7 + k, top + 5, 3, -0.5, 0.5);
        g.moveTo(jx + 10 + k + Math.cos(-0.5) * 3, top + 5 + Math.sin(-0.5) * 3); g.arc(jx + 10 + k, top + 5, 3, -0.5, 0.5);
        g.stroke(); g.globalAlpha = 1;
      }
      g.restore();
    };
    return m;
  }

  /* ======================================================================
     registro
     ====================================================================== */
  const NOINP = { x: 0, y: 0, face: 1 };
  // andando sem cavar: troca a pose parada por walk/run (as patas acompanham o chão em vez de deslizar)
  // e leva junto a ferramenta que está na pata (m.px/m.py), pelo deslocamento entre as duas âncoras
  const WA = { x: 0, y: 0 }, WB = { x: 0, y: 0 };
  function walkFix(m, dt) {
    const v = Math.abs(m.vx), moving = v > 14 && !m.busy && m.w < 0.5;
    m.walkT = (m.walkT || 0) + dt * (moving ? Math.min(2.2, 0.6 + v / 160) : 0);
    if (!moving || m.pose === 'push' || m.pose === 'carry') return;
    const wp = v > 170 ? 'run' : 'walk';
    anchor(m, m.pose, m.kt, 'hold', m.kx, m.ky, m.rot, m.sq, WA);
    m.pose = wp; m.kt = m.walkT; m.rot = 0; m.sq = 0;
    anchor(m, wp, m.kt, 'paw', m.kx, m.ky, 0, 0, WB);
    m.px += WB.x - WA.x; m.py += Math.sin(m.walkT * (v > 170 ? 18 : 12)) * 0.6;   // fica na altura da mão, balançando com o passo
  }
  function reg(id, name, kind, w, h, make, meta) {
    G.Tools[id] = {
      id, name, kind, w, h, meta,
      create(opts) { return make(opts || {}); },
      update(m, dt, inp) { m.update(dt, inp || NOINP); if (kind === 'hand') walkFix(m, dt); },
      draw(g, m) { m.drawFn(g); },
      bite(m) { return m.biteO; },
      dump(m) { return m.hasDump ? m.dumpO : null; },
      seat(m) { return m.seatO; },
      // back(m): ponto das costas do Kome no mundo + inclinação do corpo (pra mochila/cesto acompanhar a pose)
      // head(m, out): ponto da cabeça do Kome no mundo (pra faixa do combo máximo etc.)
      head(m, out) {
        out = out || {}; anchor(m, m.pose, m.kt, 'head', m.kx, m.ky, m.rot, m.sq, BK);
        const f = visFace(m); out.x = m.x + f * m.sc * BK.x; out.y = m.y + m.sc * BK.y; out.a = f * m.rot; out.f = f < 0 ? -1 : 1; out.sc = m.sc; return out;
      },
      back(m, out) {
        out = out || {}; anchor(m, m.pose, m.kt, 'back', m.kx, m.ky, m.rot, m.sq, BK);
        const f = visFace(m); out.x = m.x + f * m.sc * BK.x; out.y = m.y + m.sc * BK.y; out.a = f * m.rot; out.f = f < 0 ? -1 : 1; out.sc = m.sc; return out;
      },
    };
  }
  const BK = { x: 0, y: 0 };
  reg('pata', 'Pata do Kome', 'hand', 48, 44, makePata, { zoom: 3.0, shake: 0.02, cycle: 0.4 });
  reg('hashi', 'Hashi', 'hand', 70, 46, makeHashi, { zoom: 2.7, shake: 0.01, cycle: H_T });
  reg('tigela', 'Tigela', 'hand', 60, 54, makeTigela, { zoom: 2.4, shake: 0.04, cycle: TG_T });
  reg('pa', 'Pá', 'hand', 70, 62, makePa, { zoom: 2.1, shake: 0.12, cycle: PA_T });
  reg('duaspas', 'Duas Pás', 'hand', 84, 76, makeDuasPas, { zoom: 1.8, shake: 0.14, cycle: DP_T });
  reg('carrinho', 'Carrinho de Mão', 'push', 86, 48, makeCarrinho, { zoom: 1.45, shake: 0.16, cycle: CR_T });
  reg('britadeira', 'Britadeira', 'jack', 96, 54, makeBritadeira, { zoom: 1.28, shake: 0.1, cycle: 0.5 });

  /* ======================================================================
     PROPS — sprites pequenos em Pix (cacheados): cada função devolve {cv, ax, ay}
     ====================================================================== */
  const P_ = PAL, propC = {};
  function prop(name, w, h, ax, ay, fn) {
    return propC[name] || (propC[name] = { cv: E.sprite('th_' + name, w, h, fn), ax, ay });
  }
  const FONT = { V: '101101101101010', E: '111100110100111', N: '111101101101101', D: '110101101101110', I: '111010010010111', O: '111101101101111' };
  function ptext(P, s, x, y, c) {
    for (let k = 0; k < s.length; k++) { const gl = FONT[s[k]]; if (gl) for (let i = 0; i < 15; i++) if (gl[i] === '1') P.set(x + k * 4 + i % 3, y + ((i / 3) | 0), c); }
  }
  function sackShape(P, x, y, a, b, hi, tie) {            // saco 14x15 com canto em (x,y)
    P.rrect(x, y + 4, 14, 11, 3, a).rect(x + 2, y + 12, 10, 2, b).rect(x + 4, y + 1, 6, 4, a).rect(x + 3, y, 8, 2, a)
      .rect(x + 4, y + 4, 6, 1, tie).rect(x + 2, y + 6, 1, 4, hi).rect(x + 11, y + 6, 1, 5, b);
  }
  function kome5(P, x, y, c) { P.rect(x + 2, y, 1, 5, c).rect(x, y + 2, 5, 1, c).set(x, y, c).set(x + 4, y, c).set(x, y + 4, c).set(x + 4, y + 4, c); }
  const SACK = {
    plain: [P_.sack, P_.sackD, P_.cream, P_.red, P_.sackD],
    golden: [P_.gold, P_.goldD, P_.goldL, P_.red, P_.goldD],
    legendary: [P_.bowl, P_.night, P_.bowlL, P_.gold, P_.goldL],
  };
  const Props = {
    // sack('plain'|'golden'|'legendary')
    sack(kind) {
      const k = SACK[kind] ? kind : 'plain', c = SACK[k];
      return prop('sack_' + k, 16, 17, 8, 16, P => {
        sackShape(P, 1, 1, c[0], c[1], c[2], c[3]); kome5(P, 6, 8, c[4]);
        if (k !== 'plain') { P.set(12, 6, P_.white).set(4, 12, P_.white); }
        if (k === 'legendary') P.rect(1, 9, 1, 1, P_.goldL).rect(14, 9, 1, 1, P_.goldL).set(11, 3, P_.white);
      });
    },
    onigiri() {
      return prop('onigiri', 15, 14, 7.5, 13, P => {
        P.tri(7.5, 0.5, 0.5, 12, 14.5, 12, P_.rice).rrect(2, 6, 11, 7, 3, P_.rice).rrect(5, 1, 5, 6, 2, P_.rice)
          .rect(3, 11, 9, 1, P_.riceS).rect(11, 7, 1, 4, P_.riceS).rect(5, 8, 5, 5, P_.blk).rect(5, 8, 5, 1, P_.blkL).set(6, 4, P_.riceS).set(9, 6, P_.riceS);
      });
    },
    coin() {
      return prop('coin', 11, 11, 5.5, 10, P => {
        P.ell(5.5, 5.5, 4.5, 4.5, P_.gold).ring(5.5, 5.5, 4.5, 1, P_.goldD).rect(4, 4, 3, 3, P_.goldD).rect(5, 5, 1, 1, P_.goldL)
          .set(3, 3, P_.goldL).set(4, 2, P_.goldL).set(2, 4, P_.goldL);
      });
    },
    crate() {
      return prop('crate', 17, 15, 8.5, 14, P => {
        P.rect(1, 1, 15, 13, P_.wood).rect(1, 1, 15, 2, P_.woodL).rect(1, 12, 15, 2, P_.woodD).rect(1, 1, 2, 13, P_.woodL).rect(14, 1, 2, 13, P_.woodD)
          .line(3, 11, 13, 3, 1, P_.woodD).rect(3, 7, 11, 1, P_.woodD).set(2, 2, P_.blk).set(14, 2, P_.blk).set(2, 12, P_.blk).set(14, 12, P_.blk);
      });
    },
    // palete com 5 sacas de arroz
    pallet() {
      return prop('pallet', 36, 33, 18, 32, P => {
        const c = SACK.plain;
        sackShape(P, 7, 1, c[0], c[1], c[2], c[3]); sackShape(P, 19, 1, c[0], c[1], c[2], c[3]);
        sackShape(P, 1, 13, c[0], c[1], c[2], c[3]); sackShape(P, 12, 13, c[0], c[1], c[2], c[3]); sackShape(P, 22, 13, c[0], c[1], c[2], c[3]);
        kome5(P, 12, 8, c[4]); kome5(P, 24, 8, c[4]); kome5(P, 6, 20, c[4]); kome5(P, 17, 20, c[4]); kome5(P, 27, 20, c[4]);
        P.rect(1, 28, 34, 2, P_.woodL).rect(1, 29, 34, 1, P_.wood).rect(2, 30, 4, 2, P_.woodD).rect(16, 30, 4, 2, P_.woodD).rect(30, 30, 4, 2, P_.woodD);
      });
    },
    // placa 'VENDIDO'
    sold() {
      return prop('sold', 35, 28, 17.5, 27, P => {
        P.rect(16, 12, 3, 15, P_.wood).rect(18, 12, 1, 15, P_.woodD)
          .rrect(1, 1, 33, 12, 2, P_.red).rect(2, 2, 31, 1, P_.redL).rect(2, 11, 31, 1, P_.redD);
        ptext(P, 'VENDIDO', 4, 4, P_.cream);
        P.set(2, 3, P_.goldL).set(32, 3, P_.goldL);
      });
    },
    hardhat() {
      return prop('hardhat', 15, 10, 7.5, 9, P => {
        P.ell(7, 6.5, 5.5, 5.5, P_.yel).erase(0, 8, 15, 2).rect(1, 7, 13, 1, P_.yelD).rect(1, 6, 13, 1, P_.yel).rect(12, 6, 2, 1, P_.yel)
          .rect(6, 1, 2, 5, P_.yelL).rect(3, 3, 1, 2, P_.yelL).rect(10, 4, 1, 2, P_.yelD);
      });
    },
    // ícone ~16x16 de cada degrau (canvas)
    icon(id) {
      const f = ICONS[id] || ICONS.pata;
      return E.sprite('th_icon_' + (ICONS[id] ? id : 'pata'), 16, 16, f);
    },
    get(name, a) { return typeof Props[name] === 'function' ? Props[name](a) : null; },
    ids: ['pata', 'hashi', 'tigela', 'pa', 'duaspas', 'carrinho', 'britadeira', 'trator', 'colheita', 'empilhadeira', 'escav', 'pacabo', 'caminhao', 'bagger'],
  };
  function icoShovel(P, x0, y0, x1, y1, bx, by) {        // cabo (x0,y0)->(x1,y1), lâmina 4x5 em (bx,by)
    P.line(x0, y0, x1, y1, 1, P_.wood).rrect(bx, by, 4, 5, 1, P_.steel).rect(bx, by, 1, 4, P_.steelL);
  }
  const ICONS = {
    pata(P) {
      P.ell(8, 10.5, 4.2, 3.6, P_.fur).ell(8, 11, 2.6, 2, P_.pink).ell(3.5, 6, 1.6, 2, P_.fur).ell(6.5, 3.5, 1.6, 2, P_.fur).ell(9.8, 3.5, 1.6, 2, P_.fur).ell(12.6, 6, 1.6, 2, P_.fur);
    },
    hashi(P) {
      P.line(4, 12, 8, 1, 1, P_.red).line(5, 13, 14, 6, 1, P_.redD).set(8, 1, P_.woodL).set(14, 6, P_.woodL).rect(1, 13, 3, 2, P_.rice).set(2, 14, P_.riceD);
    },
    tigela(P) {
      P.ell(8, 7.5, 5, 3.6, P_.rice).set(6, 5, P_.riceD).set(9, 6, P_.riceD)
        .ell(8, 8, 6.5, 6, P_.bowl).erase(0, 0, 16, 8).ell(8, 7.6, 5, 3.4, P_.rice).erase(0, 0, 16, 1)
        .rect(2, 8, 12, 1, P_.bowlL).rect(6, 13, 4, 2, P_.bowl).set(4, 10, P_.bowlL).set(6, 6, P_.riceD).set(9, 5, P_.riceD);
    },
    pa(P) { P.line(12, 2, 6, 9, 1.6, P_.wood).rect(11, 1, 3, 1, P_.woodD); P.rrect(2, 8, 6, 6, 2, P_.steel).rect(3, 9, 1, 3, P_.steelL).rect(3, 13, 4, 1, P_.steelD); },
    duaspas(P) { icoShovel(P, 3, 2, 10, 10, 9, 9); P.line(12, 2, 5, 10, 1, P_.woodD).rrect(2, 9, 4, 5, 1, P_.steelD).rect(2, 9, 1, 4, P_.steel); },
    carrinho(P) {
      P.poly([[1, 4], [12, 3], [10, 9], [4, 9]], P_.red).rect(4, 8, 6, 1, P_.redD).rect(2, 4, 9, 1, P_.redL).line(1, 4, 0, 3, 1, P_.wood).rect(4, 10, 1, 4, P_.grayD)
        .ell(11.5, 11.5, 2.6, 2.6, P_.blk).set(11, 11, P_.grayL).ell(6.5, 3, 3.5, 1.6, P_.rice);
    },
    britadeira(P) {
      P.rect(3, 1, 10, 2, P_.blk).rect(5, 3, 6, 6, P_.yel).rect(5, 3, 1, 6, P_.yelL).rect(5, 7, 6, 1, P_.yelD).rect(6, 9, 4, 1, P_.blkL).rect(7, 10, 2, 3, P_.steel).set(7, 13, P_.steelD).set(8, 13, P_.steelD)
        .set(4, 14, P_.riceD).set(11, 13, P_.riceD).set(12, 11, LINE).set(3, 11, LINE);
    },
    trator(P) {
      P.rect(7, 6, 7, 4, P_.red).rect(7, 6, 7, 1, P_.redL).rect(3, 2, 5, 6, P_.red).rect(4, 3, 3, 3, P_.glass).rect(12, 3, 1, 3, P_.blkL)
        .ell(5, 10.5, 3.8, 3.8, P_.blk).ell(5, 10.5, 1.5, 1.5, P_.yelL).ell(12.5, 12, 2.3, 2.3, P_.blk).set(12, 12, P_.yelL);
    },
    colheita(P) {
      P.rect(2, 6, 9, 5, P_.grass).rect(2, 6, 9, 1, P_.grassL).rect(3, 3, 4, 3, P_.grassD).rect(4, 4, 2, 1, P_.rice).rect(8, 2, 3, 4, P_.grass).rect(9, 3, 1, 2, P_.glass)
        .rect(11, 9, 4, 3, P_.grassD).set(14, 7, P_.ora).set(13, 8, P_.ora).set(15, 8, P_.ora).set(14, 9, P_.ora)
        .ell(8.5, 12, 3, 3, P_.blk).set(8, 12, P_.yelL).ell(3.5, 13, 1.8, 1.8, P_.blk);
    },
    empilhadeira(P) {
      P.rect(3, 6, 7, 6, P_.yel).rect(3, 6, 7, 1, P_.yelL).rect(4, 2, 5, 4, P_.yelD).rect(5, 3, 3, 3, P_.glass).rect(11, 1, 1, 13, P_.grayD).rect(12, 12, 3, 1, P_.steel).rect(12, 8, 1, 4, P_.steel)
        .ell(4.5, 12.5, 2, 2, P_.blk).ell(9.5, 12.5, 2, 2, P_.blk).rect(12, 9, 3, 3, P_.press);
    },
    escav(P) {
      P.rrect(1, 11, 10, 4, 2, P_.blk).rect(2, 12, 8, 1, P_.gray).rect(2, 6, 7, 5, P_.yel).rect(2, 6, 7, 1, P_.yelL).rect(3, 7, 3, 3, P_.glass)
        .line(8, 7, 12, 2, 1.6, P_.yelD).line(12, 2, 14, 8, 1.4, P_.yelD).poly([[12, 8], [15, 8], [15, 11], [13, 11]], P_.steel);
    },
    pacabo(P) {
      P.rrect(1, 12, 9, 3, 1, P_.blk).rect(1, 6, 8, 6, P_.ora).rect(1, 6, 8, 1, P_.oraL).rect(2, 7, 3, 3, P_.glass).line(8, 9, 14, 1, 1.5, P_.oraD)
        .line(14, 1, 13, 8, 1, LINE).poly([[11, 8], [15, 8], [15, 12], [12, 12]], P_.steel).line(8, 5, 14, 1, 1, LINE);
    },
    caminhao(P) {
      P.poly([[1, 3], [11, 3], [10, 9], [3, 9]], P_.yel).rect(2, 3, 9, 1, P_.yelL).ell(6, 3, 4, 1.8, P_.rice).rect(11, 5, 4, 5, P_.yelD).rect(12, 6, 2, 2, P_.glass).rect(2, 9, 12, 2, P_.grayD)
        .ell(4.5, 12, 2.6, 2.6, P_.blk).ell(11.5, 12, 2.6, 2.6, P_.blk).set(4, 12, P_.yelL).set(11, 12, P_.yelL);
    },
    bagger(P) {
      P.ring(5.5, 6, 5, 1.6, P_.steelD).ell(5.5, 6, 1.4, 1.4, P_.yel);
      for (let i = 0; i < 6; i++) { const a = i * PI / 3 + 0.3; P.rect(Math.round(5 + Math.cos(a) * 4.6), Math.round(5.5 + Math.sin(a) * 4.6), 2, 2, P_.yel); }
      P.line(6, 6, 13, 10, 1.6, P_.yelD).rect(10, 9, 5, 4, P_.yel).rect(10, 9, 5, 1, P_.yelL).rect(9, 13, 6, 2, P_.blk).line(13, 9, 13, 3, 1, P_.grayD).line(13, 3, 6, 6, 1, LINE);
    },
  };
  G.Props = Props;
})();
