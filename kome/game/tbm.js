/* Kome no Japão — tbm.js
   'tbm' = Tatuzão: tatuzão (tunnel boring machine) de escudo com trem de apoio (backup) de 4 pórticos treliçados.
   Depende de: core.js, pix.js, shiba.js, fx.js, terrain.js, rig.js. Opcional: machines-mine.js (G.Scale.pickup no modo transporte).

   Interface comum: G.Tools.tbm = {id, name, kind, w, h, meta, create(opts), update(m,dt,inp), draw(g,m), bite(m), dump(m), seat(m),
   drawTunnel(g,m)}. Espaço do modelo: origem no chão sob o PLANO DA FACE do escudo (frente do cilindro), +x = frente (pra dentro
   da montanha), y pra baixo, px de arte × opts.scale. Escudo Ø 288 (centro a 146 do chão), corpo até x=-300, trem até x≈-1100.
   opts = {pilot, scale, mode: 'bore' | 'transport'}.
   A máquina é dona de m.x (plano da face, mundo): pega inp.x só no 1º update. m.y = inp.y (piso do túnel = base do escudo).
   Ciclo (meta.cycle = 4 s / rate): 0–.55 avança um anel (36 px) com os pistões esticando; .55–.66 pistões recolhem;
   .62–.90 eretor gira um segmento até o lugar ('ring' em .90); .92–1 pistões voltam a encostar no anel novo.
   O jogo pode escrever m.tunnel.x0 (boca do túnel, mundo) e m.mode. Ler: m.bored, m.tunnel {x0,x1,y,r}, m.rings, m.rpm,
   m.pushing, m.done, m.flow. */
(function () {
  'use strict';
  const E = window.KomeEngine;
  if (!E || !E.Draw) throw new Error('tbm.js: carregue core, pix, shiba, fx, terrain e rig antes');
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const seg = (u, a, b) => smooth((u - a) / (b - a));
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const shc = new Map();
  function sh(c, k) { const key = c + '|' + k; let v = shc.get(key); if (v === undefined) { v = U.shade(c, k); shc.set(key, v); } return v; }

  /* ---- geometria (modelo, escala 1) ---- */
  const RC = 148, R = 144, CY = -146, LS = 300, BULK = -192, TAIL = -300;
  const RING_W = 36, LIN_O = 140, LIN_I = 124, RAIL_Y = CY + LIN_I;     // trilho do backup a -22
  const K_BORE = 0.35, K_TRANS = 0.7, CXF = 6;
  const NG = 4, GL = 176, GGAP = 16, G0 = -324;                          // pórticos: x1 = G0 - k*(GL+GGAP)
  const D1 = -50, D2 = -130, ROOF = -200, BELT = -224;
  const REAR = G0 - (NG - 1) * (GL + GGAP) - GL;                         // ≈ -1076
  const DUMP_X = REAR - 26, DUMP_Y = BELT + 12;
  const LIGHTS = [];
  for (let k = 0; k < NG; k++) { const x1 = G0 - k * (GL + GGAP), x0 = x1 - GL; LIGHTS.push([x0 + 34, ROOF + 10], [x1 - 34, ROOF + 10], [x0 + GL / 2, D2 + 14]); }
  const CAB = { x: G0 - 92, y: D2 - 58, w: 76, h: 58 };                  // cabine no pórtico 1
  const WIN = { x: CAB.x + 8, y: CAB.y + 10, w: 50, h: 24 };
  const ERECT_ANG = [PI * 0.72, -PI * 0.72, PI * 0.38, -PI * 0.38, PI * 0.05, -PI * 0.9];
  const PIST_Y = [-104, -54, 0, 54, 104];

  /* ---- cores ---- */
  const C_BODY = sh(PAL.cream, -0.05), C_FACE = sh(PAL.cream, -0.1), C_SPOKE = PAL.cream, C_HOLE = sh(PAL.blk, -0.25);
  const C_CUT = PAL.blk, C_CUTI = PAL.grayD, C_FR = PAL.steelL, C_WEB = PAL.steel;
  const C_CON = PAL.stone, C_CONL = PAL.stoneL, C_COND = PAL.stoneD, C_DARK = sh(PAL.ink, 0.06);
  const BANDS = [[-1, -0.78, 0.3], [-0.78, -0.42, 0.14], [-0.42, 0.12, 0], [0.12, 0.5, -0.1], [0.5, 0.8, -0.22], [0.8, 1, -0.34]];

  /* ---- rascunhos (zero alocação por frame) ---- */
  const PA = [0, 0], PB = [0, 0], LN = [[0, 0], [0, 0]];
  function pa(x, y) { PA[0] = x; PA[1] = y; return PA; }
  function pb(x, y) { PB[0] = x; PB[1] = y; return PB; }
  function ln(a, b, c, d) { LN[0][0] = a; LN[0][1] = b; LN[1][0] = c; LN[1][1] = d; return LN; }
  const THIN = { ol: 1.2 }, THIN_R = { ol: 1.2, r: 2 }, FLAT = { ol: 1, top: false, shade: false }, NOHI = { hi: false };
  const PIST = { col: PAL.yel, len: 46, ol: 1.4 }, ARM = { col: PAL.ora, len: 40, ol: 1.4 };
  const shO = { scale: 0.55, shadow: false, pal: 'kome', face: 1 };
  const CREW_A = { h: PAL.ora, g: PAL.oraD, o: '#D9A066', c: '#EBEBEB', k: '#2A1A10', n: '#2A1A10', p: '#D95763' };
  const CREW_B = { h: PAL.yel, g: PAL.yelD, o: '#B88E62', c: '#EFE0C4', k: '#2A1A10', n: '#2A1A10', p: '#E8707A' };
  const GRAIN = { shape: 'grain', c: [PAL.rice, PAL.rice, PAL.riceS], land: true, w: 2.4, life: 1.6, ol: true, speed: [20, 60], spread: 0.5, dir: PI / 2 };
  const DUST = { c: PAL.sand };
  const TXT = { size: 12, col: PAL.ink, sw: 0, weight: 900, align: 'center' };
  const SIGN = { col: PAL.cream, ink: PAL.ink, ol: 1.6 };

  /* ---- pré-render em níveis (cache global, conteúdo estático igual pra toda instância) ---- */
  const LEVELS = [0.4, 0.8, 1.6, 2.4];
  const bakes = new Map();
  function level() {
    const need = Draw.zoom * (window.devicePixelRatio || 1) * curSc;
    for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i] >= need * 0.8) return i;
    return LEVELS.length - 1;
  }
  let curSc = 1;
  function bake(name, li, x0, y0, w, h, fn) {
    const key = name + li; let b = bakes.get(key);
    if (b) return b;
    const s = LEVELS[li], cv = document.createElement('canvas');
    cv.width = Math.ceil(w * s); cv.height = Math.ceil(h * s);
    const c = cv.getContext('2d');
    c.scale(s, s); c.translate(-x0, -y0);
    const z = Draw.zoom; Draw.lod(s); fn(c); Draw.lod(z);
    b = { cv, x0, y0, w, h }; bakes.set(key, b);
    return b;
  }
  function blit(g, b, dy) { g.drawImage(b.cv, b.x0, b.y0 + dy, b.w, b.h); }

  /* ---- cabeça de corte (coordenadas do disco, gira inteira) ---- */
  function drawCutterDisc(c) {
    Draw.circle(c, 0, 0, RC, C_FACE, { ol: 2, hi: false, shade: false });
    // aberturas de material (fendas escuras entre os raios)
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) * TAU / 8;
      c.save(); c.rotate(a);
      c.beginPath(); c.moveTo(56, -6); c.lineTo(128, -11); c.quadraticCurveTo(133, 0, 128, 11); c.lineTo(56, 6); c.closePath();
      c.fillStyle = LINE; c.lineWidth = 3; c.strokeStyle = LINE; c.stroke();
      c.fillStyle = C_HOLE; c.fill();
      c.fillStyle = sh(PAL.cream, -0.3); c.fillRect(58, 3, 70, 4);           // lábio da caçamba
      c.restore();
    }
    // raios (braços) com duas fileiras de alojamentos de disco
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      c.save(); c.rotate(a);
      Draw.box(c, 26, -15, RC - 36, 30, C_SPOKE, { ol: 1.6, top: sh(PAL.cream, 0.0), shade: sh(PAL.cream, -0.2), r: 3 });
      for (let j = 0; j < 7; j++) {
        const r = 44 + j * 14.5, o = j & 1 ? 5 : -5;
        Draw.box(c, r - 5, o - 4.5 - (j & 1 ? 0 : 0), 10, 9, C_CUT, FLAT);
        c.fillStyle = C_CUTI; c.fillRect(r - 3, o - 2.5, 6, 5);
        c.fillStyle = PAL.steelL; c.fillRect(r - 0.6, o - 2.5, 1.2, 5);        // o disco de corte
      }
      // fileira extra na chapa entre o raio e a fenda
      for (let j = 0; j < 4; j++) {
        const r = 62 + j * 20, b = 0.2 + j * 0.002;
        const x = Math.cos(b) * r, y = Math.sin(b) * r;
        Draw.box(c, x - 4.5, y - 4, 9, 8, C_CUT, FLAT); c.fillStyle = C_CUTI; c.fillRect(x - 2.5, y - 2, 5, 4);
        const y2 = -y;
        Draw.box(c, x - 4.5, y2 - 4, 9, 8, C_CUT, FLAT); c.fillStyle = C_CUTI; c.fillRect(x - 2.5, y2 - 2, 5, 4);
      }
      c.restore();
    }
    // aro com cortadores de bitola
    Draw.ring(c, 0, 0, RC, 12, sh(PAL.cream, -0.16), { ol: 1.6 });
    c.fillStyle = C_CUT;
    for (let i = 0; i < 40; i++) {
      const a = i * TAU / 40;
      c.save(); c.rotate(a); c.fillRect(RC - 10, -3.5, 7, 7); c.restore();
    }
    // cubo central com cortadores gêmeos
    Draw.circle(c, 0, 0, 32, C_SPOKE, { ol: 1.8, hi: false });
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(i * PI / 2 + PI / 4);
      Draw.box(c, 6, -4.5, 22, 9, C_CUT, FLAT); c.fillStyle = C_CUTI; c.fillRect(9, -2.5, 16, 5);
      c.restore();
    }
    Draw.circle(c, 0, 0, 7, PAL.steel, { ol: 1.4, hi: false });
  }
  const discBake = li => bake('disc', li, -RC - 4, -RC - 4, RC * 2 + 8, RC * 2 + 8, drawCutterDisc);

  /* ---- escudo (parte estática) ---- */
  function cylBands(c, x0, x1, cy, r, base) {
    for (let i = 0; i < BANDS.length; i++) {
      const b = BANDS[i];
      c.fillStyle = sh(base, b[2]); c.fillRect(x0, cy + b[0] * r, x1 - x0, (b[1] - b[0]) * r + 0.5);
    }
  }
  function drawShieldStatic(c) {
    const ol = 2.2;
    // casca da cauda (recorte): interior escuro com nervuras
    c.fillStyle = LINE; c.fillRect(TAIL - ol, CY - R - ol, BULK - TAIL + ol * 2, R * 2 + ol * 2);
    c.fillStyle = C_DARK; c.fillRect(TAIL, CY - R, BULK - TAIL, R * 2);
    c.fillStyle = sh(PAL.blk, -0.05);
    for (let i = 0; i < 4; i++) c.fillRect(TAIL, CY - 90 + i * 60, BULK - TAIL, 3);
    cylBands(c, TAIL, BULK, CY, R, C_BODY);
    c.fillStyle = C_DARK; c.fillRect(TAIL, CY - R + 11, BULK - TAIL, R * 2 - 22);
    c.fillStyle = sh(PAL.blk, 0.1); for (let i = 0; i < 5; i++) c.fillRect(TAIL + 6, CY - 100 + i * 50, BULK - TAIL - 6, 2);
    c.fillStyle = LINE; c.fillRect(TAIL, CY - R + 10, BULK - TAIL, 1.6); c.fillRect(TAIL, CY + R - 11.6, BULK - TAIL, 1.6);
    // rosca transportadora saindo da câmara
    Draw.beam(c, ln(BULK + 14, -36, -330, BELT + 6), 22, PAL.yelD, NOHI);
    Draw.beam(c, ln(BULK + 14, -36, -330, BELT + 6), 14, PAL.yel, NOHI);
    c.strokeStyle = sh(PAL.yel, -0.3); c.lineWidth = 1.4; c.beginPath();
    for (let i = 1; i < 9; i++) { const t = i / 9, x = lerp(BULK + 14, -330, t), y = lerp(-36, BELT + 6, t); c.moveTo(x - 6, y - 5); c.lineTo(x + 6, y + 5); }
    c.stroke();
    // anteparo de pressão
    Draw.box(c, BULK - 4, CY - R + 8, 12, R * 2 - 16, PAL.gray, { ol: 1.6, top: false, panels: 0 });
    // corpo frontal
    c.fillStyle = LINE; c.fillRect(BULK - ol, CY - R - ol, -BULK + ol * 2, R * 2 + ol * 2);
    cylBands(c, BULK, 0, CY, R, C_BODY);
    // costuras circunferenciais (levemente curvas, mesma perspectiva da face)
    c.strokeStyle = sh(C_BODY, -0.42); c.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) { const x = -150 + i * 52; c.beginPath(); c.ellipse(x, CY, 16, R, 0, -PI / 2, PI / 2); c.stroke(); }
    c.fillStyle = sh(C_BODY, -0.3);
    for (let i = 0; i < 3; i++) { const x = -150 + i * 52; for (let j = -6; j <= 6; j++) { const a = j / 6.6 * PI / 2; c.fillRect(x + Math.cos(a) * 16 + 3, CY + Math.sin(a) * R - 1, 2.2, 2.2); } }
    // junta articulada e borda cortante
    c.fillStyle = sh(PAL.steel, -0.2); c.fillRect(BULK, CY - R, 7, R * 2);
    c.fillStyle = LINE; c.fillRect(BULK + 7, CY - R, 1.6, R * 2);
    // olhais vermelhos de içamento
    for (let i = 0; i < 4; i++) {
      const x = [-176, -142, -60, -26][i];
      c.fillStyle = LINE; c.beginPath(); c.moveTo(x - 9, CY - R + 1); c.lineTo(x - 7, CY - R - 13); c.quadraticCurveTo(x, CY - R - 21, x + 7, CY - R - 13); c.lineTo(x + 9, CY - R + 1); c.closePath(); c.fill();
      c.fillStyle = PAL.red; c.beginPath(); c.moveTo(x - 7, CY - R); c.lineTo(x - 5.5, CY - R - 12); c.quadraticCurveTo(x, CY - R - 18.5, x + 5.5, CY - R - 12); c.lineTo(x + 7, CY - R); c.closePath(); c.fill();
      c.fillStyle = PAL.redL; c.fillRect(x - 5, CY - R - 12, 3, 9);
      c.fillStyle = LINE; c.beginPath(); c.arc(x, CY - R - 11, 2.6, 0, TAU); c.fill();
      c.fillStyle = PAL.redD; c.fillRect(x - 10, CY - R - 1, 20, 3);
    }
    // painéis, escotilha e respiros
    Draw.box(c, -96, CY + 34, 34, 46, sh(C_BODY, -0.14), { ol: 1.2, r: 3, rivets: 7 });
    c.fillStyle = sh(C_BODY, -0.38); for (let i = 0; i < 5; i++) c.fillRect(-180 + i * 7, CY + 46, 3.5, 22);
  }
  const shieldBake = li => bake('shield', li, TAIL - 6, CY - R - 26, -TAIL + 14, R * 2 + 34, drawShieldStatic);

  /* ---- trem de apoio (estático) ---- */
  const TR = { taper: 1, bays: 6, ol: 1.2, web: C_WEB };
  function drawGantry(c, k) {
    const x1 = G0 - k * (GL + GGAP), x0 = x1 - GL, xm = (x0 + x1) / 2;
    // contraventamento em X (atrás)
    c.strokeStyle = LINE; c.lineWidth = 3.4; c.beginPath();
    for (let b = 0; b < 2; b++) { const a = b ? xm : x0, z = b ? x1 : xm; c.moveTo(a + 4, D1); c.lineTo(z - 4, D2 + 8); c.moveTo(a + 4, D2 + 8); c.lineTo(z - 4, D1); c.moveTo(a + 4, D2 - 4); c.lineTo(z - 4, ROOF + 8); c.moveTo(a + 4, ROOF + 8); c.lineTo(z - 4, D2 - 4); }
    c.stroke(); c.strokeStyle = C_WEB; c.lineWidth = 1.6; c.stroke();
    // equipamento
    gear(c, k, x0, x1);
    // montantes
    for (let i = 0; i < 3; i++) { const x = i === 0 ? x0 : i === 1 ? xm - 4 : x1 - 8; Draw.box(c, x, ROOF - 4, 8, D1 + 12 - ROOF + 4, C_FR, { ol: 1.2, shade: sh(C_FR, -0.18) }); }
    // vigas treliçadas dos pisos e do teto
    TR.bays = 8;
    Draw.truss(c, pa(x0 - 2, D1 + 6), pb(x1 + 2, D1 + 6), 12, 3, C_FR, TR);
    Draw.truss(c, pa(x0 - 2, D2 + 6), pb(x1 + 2, D2 + 6), 12, 3, C_FR, TR);
    Draw.truss(c, pa(x0 - 2, ROOF), pb(x1 + 2, ROOF), 10, 3, C_FR, TR);
    // guarda-corpos amarelos
    Draw.rail(c, pa(x0 + 2, D2), pb(x1 - 2, D2), { posts: 9, h: 15, col: PAL.yel, lw: 1.6, ol: 1 });
    Draw.rail(c, pa(x0 + 2, D1), pb(x1 - 2, D1), { posts: 9, h: 15, col: PAL.yel, lw: 1.6, ol: 1 });
    // escada entre os pisos
    if (k !== 3) Draw.stairs(c, pa(x0 + 14, D1), pb(x0 + 58, D2), 8, { col: PAL.steel, lw: 2, railCol: PAL.yel, ol: 1 });
    // truques com rodas de trilho
    for (let i = 0; i < 2; i++) {
      const bx = i ? x1 - 48 : x0 + 12;
      Draw.box(c, bx, D1 + 10, 36, 9, PAL.grayD, THIN);
      Draw.wheel(c, bx + 8, RAIL_Y - 7, 7, i, { tire: PAL.steelD, hub: PAL.steel, spokes: 0, tread: false, ol: 1.2 });
      Draw.wheel(c, bx + 28, RAIL_Y - 7, 7, i, { tire: PAL.steelD, hub: PAL.steel, spokes: 0, tread: false, ol: 1.2 });
    }
    // engate
    if (k < NG - 1) { c.fillStyle = LINE; c.fillRect(x0 - GGAP - 1, D1 + 11, GGAP + 2, 6); c.fillStyle = PAL.grayD; c.fillRect(x0 - GGAP, D1 + 12, GGAP, 4); }
  }
  function tank(c, x, y, w, h, col) {
    Draw.box(c, x, y, w, h, col, { ol: 1.4, r: Math.min(w, h) * 0.45 });
    c.fillStyle = sh(col, -0.25); c.fillRect(x + w * 0.2, y, 2, h); c.fillRect(x + w * 0.75, y, 2, h);
  }
  function gear(c, k, x0, x1) {
    if (k === 0) {
      // unidade hidráulica + cabine do operador
      Draw.box(c, x0 + 76, D1 - 40, 70, 40, PAL.yel, { ol: 1.4, panels: 3, rivets: 9 });
      Draw.box(c, x0 + 86, D1 - 52, 18, 12, PAL.grayD, THIN);
      Draw.box(c, CAB.x, CAB.y, CAB.w, CAB.h, PAL.white, { ol: 1.8, r: 3, shade: sh(PAL.white, -0.2) });
      Draw.box(c, CAB.x - 3, CAB.y - 5, CAB.w + 6, 7, PAL.ora, THIN_R);
      Draw.window(c, WIN.x, WIN.y, WIN.w, WIN.h, { ol: 1.4 });
      Draw.box(c, WIN.x + WIN.w + 4, WIN.y, 9, CAB.h - 16, sh(PAL.white, -0.1), THIN);
      Draw.box(c, x0 + 64, D2 - 26, 30, 26, PAL.grayL, { ol: 1.2, panels: 2 });
    } else if (k === 1) {
      // transformadores e carretel de cabo
      for (let i = 0; i < 2; i++) {
        const x = x0 + 70 + i * 48; Draw.box(c, x, D1 - 44, 40, 44, PAL.gray, { ol: 1.4, panels: 5 });
        Draw.box(c, x + 6, D1 - 52, 28, 8, PAL.grayD, THIN);
      }
      Draw.circle(c, x0 + 120, D2 - 36, 34, PAL.ora, { ol: 1.6 });
      Draw.circle(c, x0 + 120, D2 - 36, 20, PAL.blk, { ol: 1.2, hi: false });
      Draw.circle(c, x0 + 120, D2 - 36, 8, PAL.steel, { ol: 1.2, hi: false });
      Draw.box(c, x0 + 22, D2 - 40, 36, 40, PAL.steelL, { ol: 1.2, panels: 2, rivets: 8 });
    } else if (k === 2) {
      // tanques de argamassa e água
      tank(c, x0 + 70, D1 - 66, 30, 66, PAL.cream); tank(c, x0 + 106, D1 - 66, 30, 66, PAL.cream);
      tank(c, x0 + 140, D1 - 50, 24, 50, PAL.steelL);
      Draw.box(c, x0 + 20, D2 - 34, 140, 34, PAL.steelL, { ol: 1.4, r: 15 });
      c.fillStyle = sh(PAL.steelL, -0.25); for (let i = 0; i < 4; i++) c.fillRect(x0 + 40 + i * 32, D2 - 34, 2, 34);
    } else {
      // vagão de segmentos e ventilador
      for (let i = 0; i < 3; i++) Draw.poly(c, segPts(x0 + 30 + i * 4, D1 - 10 - i * 12), C_CONL, { ol: 1.3, shade: C_COND, shadeK: 0.4 });
      Draw.box(c, x0 + 20, D1 - 10, 120, 10, PAL.grayD, THIN);
      tank(c, x0 + 24, D2 - 44, 74, 44, PAL.yel);
      Draw.circle(c, x0 + 61, D2 - 22, 15, PAL.blk, { ol: 1.2, hi: false });
      Draw.box(c, x0 + 108, D2 - 30, 40, 30, PAL.grayL, { ol: 1.2, panels: 2 });
    }
  }
  const SEGP = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
  function segPts(x, y) {
    SEGP[0][0] = x; SEGP[0][1] = y; SEGP[1][0] = x + 10; SEGP[1][1] = y - 12; SEGP[2][0] = x + 100; SEGP[2][1] = y - 12;
    SEGP[3][0] = x + 110; SEGP[3][1] = y; SEGP[4][0] = x + 98; SEGP[4][1] = y - 3; SEGP[5][0] = x + 12; SEGP[5][1] = y - 3; return SEGP;
  }
  function drawTrainStatic(c) {
    // ponte até o escudo
    Draw.truss(c, pa(TAIL + 2, ROOF + 6), pb(G0 - 4, ROOF + 6), 10, 3, C_FR, TR);
    for (let k = NG - 1; k >= 0; k--) drawGantry(c, k);
    // esteira de material no topo, do escudo até a ponta traseira
    c.fillStyle = LINE;
    for (let k = 0; k < NG; k++) { const x1 = G0 - k * (GL + GGAP); for (let i = 0; i < 3; i++) c.fillRect(x1 - 10 - i * 78, BELT + 4, 3, ROOF - BELT - 6); }
    Draw.truss(c, pa(-334, BELT + 8), pb(REAR - 14, BELT + 8), 9, 2.4, PAL.grayL, { taper: 1, ol: 1.1, web: PAL.gray });
    c.fillStyle = LINE; c.fillRect(REAR - 16, BELT - 2.5, -334 - REAR + 16, 5);
    c.fillStyle = PAL.blkL; c.fillRect(REAR - 16, BELT - 1.5, -334 - REAR + 16, 3);
    Draw.circle(c, -334, BELT + 2, 6, PAL.steel, { ol: 1.2, hi: false });
    Draw.circle(c, REAR - 16, BELT + 2, 7, PAL.steel, { ol: 1.2, hi: false });
    Draw.box(c, DUMP_X - 8, BELT - 6, 18, 26, PAL.ora, THIN_R);                  // calha de descarga
  }
  const trainBake = li => bake('train', li, REAR - 40, BELT - 40, -REAR + 40 - 290, -18 - BELT + 40, drawTrainStatic);

  /* ---- carretas autopropelidas (SPMT) pro modo transporte ---- */
  const SP0 = REAR - 30, SP1 = 120, SPH = 30;
  function drawSPMT(c) {
    const n = Math.round((SP1 - SP0) / 124), mw = (SP1 - SP0) / n;
    for (let i = 0; i < n; i++) {
      const x = SP0 + i * mw;
      for (let j = 0; j < 5; j++) {
        const wx = x + 14 + j * (mw - 28) / 4;
        Draw.box(c, wx - 6, -SPH + 10, 12, 8, PAL.oraD, FLAT);
        Draw.wheel(c, wx, -8, 8, j, { tire: PAL.blk, hub: PAL.yel, spokes: 0, ol: 1.2 });
      }
      Draw.box(c, x + 2, -SPH, mw - 4, 14, PAL.ora, { ol: 1.6, rivets: 10, panels: 2 });
      c.fillStyle = PAL.oraD; c.fillRect(x + 2, -SPH + 11, mw - 4, 3);
    }
    // power pack amarelo na frente
    Draw.box(c, SP1 - 8, -SPH - 30, 40, 44, PAL.yel, { ol: 1.6, r: 3, panels: 2 });
    Draw.box(c, SP1 + 2, -SPH - 40, 10, 12, PAL.grayD, THIN);
    // berços sob o escudo
    for (let i = 0; i < 2; i++) {
      const x = i ? -250 : -90;
      c.fillStyle = LINE; c.beginPath(); c.moveTo(x - 46, -SPH); c.lineTo(x - 34, -SPH - 12); c.lineTo(x + 34, -SPH - 12); c.lineTo(x + 46, -SPH); c.closePath(); c.fill();
      Draw.poly(c, [[x - 43, -SPH], [x - 32, -SPH - 10], [x + 32, -SPH - 10], [x + 43, -SPH]], PAL.yel, { ol: 0, shade: true });
    }
  }
  const spmtBake = li => bake('spmt', li, SP0 - 6, -SPH - 46, SP1 - SP0 + 50, SPH + 50, drawSPMT);

  /* ======================================================================
     estado
     ====================================================================== */
  function create(opts) {
    opts = opts || {};
    return {
      id: 'tbm', sc: opts.scale || 1, pal: opts.pilot || 'kome', mode: opts.mode === 'transport' ? 'transport' : opts.mode === 'launch' ? 'launch' : 'bore',
      t: 0, ev: [], x: 0, y: 0, face: 1, init: false, ph: 0, busy: false, rate: 1, rpm: 0, rot: 0, flow: 0,
      pushing: false, done: false, digging: false, rings: 0, ringW: 0, rodEnd: -260, erPhi: PI, erOut: 0, erOn: false,
      bored: 0, tunnel: { x0: null, x1: 0, y: 0, r: RC * (opts.scale || 1) }, night: 0, parts: null, grindAcc: 0, dumpAcc: 0,
      roll: 0, beltOff: 0, shake: 0,
      biteO: { x: 0, y: 0, r: 0, active: false, phase: 0 }, dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
    };
  }
  const wx = (m, u) => m.x + m.face * u * m.sc;
  const wy = (m, v) => m.y + v * m.sc;

  function update(m, dt, inp) {
    m.ev.length = 0; m.t += dt;
    m.parts = inp.parts || null;
    m.face = inp.face < 0 ? -1 : 1;
    m.y = inp.y || 0;
    if (!m.init) {
      m.init = true; m.x = inp.x || 0;
      m.ringW = wx(m, -260);
      if (m.tunnel.x0 === null) m.tunnel.x0 = m.x;
    }
    const pw = inp.power === undefined ? 1 : clamp(inp.power, 0, 1);
    m.rate = clamp((inp.speedMul || 1) * (0.7 + 0.3 * pw) * (1 + 0.15 * (inp.boost || 0)), 0.4, 3);
    m.night = inp.night ? 1 : 0;
    const tx = typeof inp.tx === 'number' ? inp.tx : null;
    const dig = !!inp.digging;
    if (dig && !m.digging) m.ev.push('rev');
    m.digging = dig;

    if (m.mode === 'transport') {
      const want = tx === null || Math.abs(tx - m.x) < 2 ? 0 : 8 * m.rate * Math.sign(tx - m.x);
      const v0 = m.roll; m.roll = damp(m.roll, dig ? want : 0, 1.5, dt);
      m.x += m.roll * dt;
      if (Math.abs(v0) > 0.5 && Math.abs(m.roll) <= 0.5 && dig) m.ev.push('done');
      m.rpm = damp(m.rpm, 0.05, 1, dt); m.rot += m.rpm * dt; m.pushing = false; m.flow = 0;
      return finish(m);
    }

    const left = tx === null ? Infinity : (tx - m.x) * m.face;
    const can = dig && left > 0.5;
    const p0 = m.ph;
    if (can) {
      if (!m.busy) { m.busy = true; m.ph = 0; m.done = false; }
      m.ph += dt * m.rate / G.Tools.tbm.meta.cycle;
    }
    if (m.ph >= 1) m.ph -= 1;
    const u = m.ph, wrap = u < p0;
    if (can && (wrap || (p0 === 0 && u > 0 && !m.pushing && u < 0.05))) m.ev.push('push');
    // avanço (exato: um anel por ciclo)
    m.pushing = can && u < 0.55;
    if (can) {
      const a0 = wrap ? 0 : seg(p0, 0, 0.55), a1 = seg(u, 0, 0.55);
      let dx = RING_W * m.sc * Math.max(0, a1 - a0);
      if (dx > left) dx = left;
      m.x += m.face * dx;
      if (left - dx <= 0.5) { m.done = true; m.busy = false; m.ev.push('done'); }
    }
    // pistões e eretor
    const rfM = (m.ringW - m.x) * m.face / m.sc;
    if (u < 0.55) m.rodEnd = rfM;
    else if (u < 0.66) m.rodEnd = lerp(rfM, -252, seg(u, 0.55, 0.66));
    else if (u < 0.92) m.rodEnd = -252;
    else m.rodEnd = lerp(-252, rfM, seg(u, 0.92, 1));
    m.erOn = u > 0.6 && u < 0.92;
    const tgt = ERECT_ANG[m.rings % ERECT_ANG.length];
    m.erPhi = u < 0.66 ? PI : lerp(PI, tgt > 0 ? tgt : tgt + TAU, seg(u, 0.66, 0.84));
    m.erOut = u < 0.62 ? 0 : u < 0.84 ? 0.4 : seg(u, 0.84, 0.9);
    if (can && p0 < 0.9 && u >= 0.9) {
      m.rings++; m.ringW += m.face * RING_W * m.sc; m.ev.push('ring'); m.shake = 1;
      if (m.parts) m.parts.puff(wx(m, -280), wy(m, CY + 120), 3, 9, DUST);
    }
    // cabeça de corte
    const want = can ? (m.pushing ? 1 : 0.25) * m.rate : 0;
    m.rpm = damp(m.rpm, want, 1.2, dt);
    m.rot += m.rpm * 0.75 * dt;
    m.flow = damp(m.flow, m.pushing ? 1 : 0, 0.8, dt);
    m.beltOff = (m.beltOff + dt * 70 * (0.3 + m.flow) * (can ? 1 : 0)) % 12000;
    m.shake = Math.max(0, m.shake - dt * 4);
    if (m.pushing) {
      m.grindAcc += dt * 4; if (m.grindAcc >= 1) { m.grindAcc -= 1; m.ev.push('grind'); }
      if (m.parts && Math.random() < dt * 3) m.parts.puff(wx(m, CXF + 30), wy(m, CY + RC * 0.9), 1, 10, DUST);
    }
    if (m.parts && m.flow > 0.2) {
      m.dumpAcc += dt * 30 * m.flow;
      const n = m.dumpAcc | 0;
      if (n > 0) {
        m.dumpAcc -= n; GRAIN.dir = PI / 2 - m.face * 0.4;
        m.parts.spray(wx(m, DUMP_X), wy(m, DUMP_Y + 14), n, GRAIN);
      }
    }
    return finish(m);
  }
  function finish(m) {
    m.bored = Math.max(0, (m.x - m.tunnel.x0) * m.face);
    m.tunnel.x1 = m.x; m.tunnel.y = wy(m, CY); m.tunnel.r = RC * m.sc;
    const b = m.biteO; b.x = wx(m, CXF + 10); b.y = wy(m, CY); b.r = RC * m.sc; b.active = m.pushing; b.phase = m.ph;
    const d = m.dumpO; d.x = wx(m, DUMP_X); d.y = wy(m, DUMP_Y + 14); d.active = m.flow > 0.3;
    const lift = m.mode === 'transport' ? -8 : 0;
    m.seatO.x = wx(m, WIN.x + WIN.w / 2); m.seatO.y = wy(m, WIN.y + WIN.h + lift);
  }

  /* ======================================================================
     desenho
     ====================================================================== */
  function label(g, txt, x, y, w, h, f) {
    g.save(); g.translate(x + w / 2, y); if (f < 0) g.scale(-1, 1);
    Draw.sign(g, -w / 2, 0, w, h, txt, SIGN);
    g.restore();
  }
  // segmento de anel no plano do anel, projetado com a mesma perspectiva da face (k)
  function ringPiece(g, xc, cy, k, r0, r1, a0, a1) {
    g.beginPath();
    for (let i = 0; i <= 8; i++) { const a = lerp(a0, a1, i / 8); const x = xc + k * r1 * Math.sin(a), y = cy - r1 * Math.cos(a); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    for (let i = 8; i >= 0; i--) { const a = lerp(a0, a1, i / 8); g.lineTo(xc + k * r0 * Math.sin(a), cy - r0 * Math.cos(a)); }
    g.closePath();
  }
  function drawCutter(g, m, li, cy, k) {
    const cx = CXF, dep = 22, rx = RC * k;
    // tambor (espessura da cabeça)
    g.fillStyle = LINE; g.beginPath(); g.ellipse(cx - dep, cy, rx + 2, RC + 2, 0, 0, TAU); g.fill();
    g.fillRect(cx - dep, cy - RC - 2, dep, RC * 2 + 4);
    g.fillStyle = sh(PAL.steel, -0.25); g.beginPath(); g.ellipse(cx - dep, cy, rx, RC, 0, 0, TAU); g.fill();
    g.fillRect(cx - dep, cy - RC, dep, RC * 2);
    g.fillStyle = sh(PAL.steel, -0.05); g.fillRect(cx - dep, cy - RC, dep, RC * 0.5);
    // face girando
    const b = discBake(li);
    g.save(); g.translate(cx, cy + (m.pushing ? Math.sin(m.t * 47) * 0.5 : 0)); g.scale(k, 1); g.rotate(m.rot * -m.face);
    g.drawImage(b.cv, b.x0, b.y0, b.w, b.h);
    g.restore();
    // luz fixa: sombra embaixo/atrás, brilho em cima
    g.save(); g.translate(cx, cy); g.scale(k, 1);
    g.fillStyle = 'rgba(59,40,24,.2)'; g.beginPath(); g.arc(0, 0, RC, PI * 0.1, PI * 0.9); g.closePath(); g.fill();
    g.fillStyle = 'rgba(59,40,24,.14)'; g.beginPath(); g.arc(0, 0, RC, PI * 0.5, PI * 1.25); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,250,238,.55)'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, RC - 7, PI * 1.15, PI * 1.75); g.stroke();
    g.restore();
  }
  function drawTailLive(g, m) {
    const cy = CY, rf = Math.max(TAIL, Math.min(BULK - 8, (m.ringW - m.x) * m.face / m.sc));
    // anéis já montados dentro da cauda
    g.save(); g.beginPath(); g.rect(TAIL, cy - R + 11, BULK - TAIL, R * 2 - 22); g.clip();
    if (rf > TAIL) {
      g.fillStyle = C_CON; g.fillRect(TAIL, cy - LIN_O + 6, rf - TAIL, (LIN_O - 6) * 2);
      g.fillStyle = sh(C_CON, 0.18); g.fillRect(TAIL, cy - 50, rf - TAIL, 70);
      g.fillStyle = sh(C_CON, -0.2); g.fillRect(TAIL, cy + 70, rf - TAIL, 60);
      g.strokeStyle = LINE; g.lineWidth = 1.6; g.beginPath();
      for (let x = rf; x > TAIL - 20; x -= RING_W) { g.moveTo(x, cy - LIN_O); g.ellipse(x, cy, 12, LIN_O, 0, -PI / 2, PI / 2); }
      g.stroke();
    }
    // eretor
    const xe = rf + RING_W / 2 - 2 > BULK - 30 ? BULK - 30 : rf + RING_W * 0.5;
    if (m.erOn) {
      const r1 = 136 - (1 - m.erOut) * 30, a = m.erPhi;
      ringPiece(g, xe, cy, 0.3, r1 - 15, r1, a - 0.34, a + 0.34);
      g.strokeStyle = LINE; g.lineWidth = 3; g.stroke(); g.fillStyle = C_CONL; g.fill();
      Draw.piston(g, pa(xe + 18, cy), pb(xe + 0.3 * (r1 - 16) * Math.sin(a), cy - (r1 - 16) * Math.cos(a)), 9, ARM);
    }
    Draw.circle(g, xe + 18, cy, 16, PAL.ora, { ol: 1.6 });
    // pistões de empuxo do anteparo até o último anel
    const re = m.rodEnd;
    for (let i = 0; i < PIST_Y.length; i++) {
      const y = cy + PIST_Y[i];
      Draw.piston(g, pa(BULK - 2, y), pb(re + 6, y), 11, PIST);
      Draw.box(g, re, y - 9, 6, 18, PAL.grayD, FLAT);
    }
    g.restore();
  }
  function drawCrew(g, m, k, deck, span, i, ph) {
    const x1 = G0 - k * (GL + GGAP), x0 = x1 - GL;
    const s = Math.sin(m.t * 0.35 + ph), c = Math.cos(m.t * 0.35 + ph);
    shO.scale = 0.55; shO.pal = i & 1 ? CREW_A : CREW_B; shO.face = c >= 0 ? 1 : -1;
    E.drawShiba(g, x0 + 70 + span * (0.5 + 0.5 * s), deck, Math.abs(c) < 0.15 ? 'stand' : 'walk', m.t + i, shO);
  }
  function draw(g, m) {
    curSc = m.sc;
    const li = level(), tr = m.mode === 'transport', f = m.face;
    const dyS = tr ? -SPH - 4 : 0, dyG = tr ? -SPH + 22 : 0;
    const sk = m.shake * 1.2 * Math.sin(m.t * 60);
    g.save(); g.translate(m.x, m.y); g.scale(f * m.sc, m.sc);
    if (tr) { Draw.shadow(g, -480, 2, 680, 10, 0.22); blit(g, spmtBake(li), 0); }
    // trem de apoio
    blit(g, trainBake(li), dyG);
    g.save(); g.translate(0, dyG);
    // arroz na esteira
    if (m.flow > 0.02) {
      const off = m.beltOff % 12, base = Math.floor(m.beltOff / 12);
      g.fillStyle = LINE; g.beginPath();
      for (let i = 0; i < 62; i++) {
        const j = base - i; if (((j * 0.61803) % 1 + 1) % 1 > m.flow * 0.9) continue;
        g.rect(-338 - i * 12 - off - 1, BELT - 7, 9, 5.5);
      }
      g.fill();
      g.fillStyle = PAL.rice; g.beginPath();
      for (let i = 0; i < 62; i++) {
        const j = base - i; if (((j * 0.61803) % 1 + 1) % 1 > m.flow * 0.9) continue;
        g.rect(-338 - i * 12 - off, BELT - 6.5, 7, 4);
      }
      g.fill();
    }
    // cabine: piloto atrás do vidro (acende de noite)
    g.save(); g.beginPath(); g.rect(WIN.x, WIN.y, WIN.w, WIN.h); g.clip();
    if (m.night) { g.fillStyle = 'rgba(255,230,138,.55)'; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h); }
    shO.scale = 0.55; shO.pal = m.pal; shO.face = 1;
    E.drawShiba(g, WIN.x + 26, WIN.y + WIN.h + 6, 'drive', m.t, shO);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(WIN.x, WIN.y, WIN.w * 0.3, WIN.h);
    g.restore();
    Draw.light(g, CAB.x + CAB.w - 10, CAB.y - 8, 3, PAL.ora, 0.5 + 0.5 * Math.sin(m.t * 6));
    // equipe
    drawCrew(g, m, 0, D1, 60, 0, 0); drawCrew(g, m, 1, D2, 50, 1, 2); drawCrew(g, m, 2, D1, 40, 2, 4.2); drawCrew(g, m, 3, D2, 50, 3, 1);
    // luzes
    const on = m.night ? 1 : tr ? 0 : 0.35;
    for (let i = 0; i < LIGHTS.length; i++) Draw.light(g, LIGHTS[i][0], LIGHTS[i][1], 2.6, PAL.goldL, on);
    g.restore();
    // escudo
    g.save(); g.translate(0, dyS + sk * 0.3);
    blit(g, shieldBake(li), 0);
    if (tr) {
      g.fillStyle = LINE; g.fillRect(TAIL - 2.2, CY - R - 2.2, BULK - TAIL + 4, R * 2 + 4.4);
      cylBands(g, TAIL, BULK + 2, CY, R, C_BODY);
      g.strokeStyle = sh(C_BODY, -0.42); g.lineWidth = 1.6; g.beginPath(); g.ellipse(-250, CY, 16, R, 0, -PI / 2, PI / 2); g.stroke();
      g.fillStyle = sh(PAL.steel, -0.2); g.fillRect(TAIL, CY - R, 8, R * 2); g.fillStyle = LINE; g.fillRect(TAIL + 8, CY - R, 1.6, R * 2);
    } else drawTailLive(g, m);
    label(g, 'KOME-TBM', tr ? -296 : -184, CY - 12, 84, 26, f);
    drawCutter(g, m, li, CY, tr ? K_TRANS : K_BORE);
    Draw.light(g, -110, CY - R + 8, 2.6, PAL.goldL, m.night ? 1 : 0);
    g.restore();
    // transporte: pessoal de colete andando ao lado
    if (tr) {
      shO.scale = 0.55;
      for (let i = 0; i < 4; i++) {
        const walk = (m.t * 6 + i * 70) % 160;
        shO.pal = i & 1 ? CREW_A : CREW_B; shO.face = i === 3 ? -1 : 1;
        E.drawShiba(g, 160 - i * 210 + (i === 3 ? -walk : walk) * 0.3, 14, Math.abs(m.roll) > 0.5 || i < 2 ? 'walk' : 'point', m.t + i, shO);
      }
    }
    g.restore();
    if (tr && G.Scale && G.Scale.pickup) G.Scale.pickup.draw(g, wx(m, 330), m.y + 20, { face: -f, t: m.t, pal: 'goma' });
  }

  /* ---- túnel atrás da máquina (chamar depois da montanha, antes da máquina) ---- */
  function drawTunnel(g, m) {
    if (!m.init || m.mode === 'transport') return;
    const f = m.face, u0 = (m.tunnel.x0 - m.x) * f / m.sc, rf = Math.min(TAIL, (m.ringW - m.x) * f / m.sc);
    g.save(); g.translate(m.x, m.y); g.scale(f * m.sc, m.sc);
    // plataforma de lançamento com trilhos (fora do túnel)
    const pl0 = u0 - 1000;
    Draw.box(g, pl0, RAIL_Y, u0 - pl0, -RAIL_Y, C_CON, { ol: 1.6, top: C_CONL, shade: C_COND });
    if (u0 < 4) {
      // vão escavado (anel de folga escuro) e revestimento
      g.fillStyle = LINE; g.beginPath(); g.ellipse(CXF + 4, CY, RC * K_BORE + 10, RC + 5, 0, -PI / 2, PI / 2); g.fill();
      g.fillStyle = sh(PAL.blk, -0.1); g.beginPath(); g.ellipse(CXF + 4, CY, RC * K_BORE + 7, RC + 2, 0, -PI / 2, PI / 2); g.fill();
      g.fillStyle = LINE; g.fillRect(u0, CY - RC - 2, 4 - u0, RC * 2 + 2);
      g.fillStyle = sh(PAL.blk, -0.1); g.fillRect(u0, CY - RC, 4 - u0, RC * 2);
      if (rf > u0) {
        const w = rf - u0;
        g.fillStyle = C_CON; g.fillRect(u0, CY - LIN_I, w, LIN_I * 2);
        g.fillStyle = sh(C_CON, -0.3); g.fillRect(u0, CY - LIN_I, w, 26);
        g.fillStyle = sh(C_CON, -0.15); g.fillRect(u0, CY - LIN_I + 26, w, 30);
        g.fillStyle = sh(C_CON, 0.14); g.fillRect(u0, CY - 30, w, 60);
        g.fillStyle = sh(C_CON, -0.18); g.fillRect(u0, CY + 70, w, LIN_I - 70);
        // corte do revestimento (faixas de concreto em cima e embaixo)
        g.fillStyle = LINE; g.fillRect(u0, CY - LIN_O, w, LIN_O - LIN_I + 1.5); g.fillRect(u0, CY + LIN_I - 1.5, w, LIN_O - LIN_I + 1.5);
        g.fillStyle = C_CONL; g.fillRect(u0, CY - LIN_O + 1.5, w, LIN_O - LIN_I - 3); g.fillRect(u0, CY + LIN_I + 1.5, w, LIN_O - LIN_I - 3);
        // juntas dos anéis
        g.strokeStyle = sh(C_CON, -0.45); g.lineWidth = 1.6; g.beginPath();
        let n = 0;
        for (let x = rf; x > u0 && n < 400; x -= RING_W, n++) {
          g.moveTo(x, CY - LIN_I); g.ellipse(x, CY, 12, LIN_I, 0, -PI / 2, PI / 2);
          g.moveTo(x, CY - LIN_O); g.lineTo(x, CY - LIN_I); g.moveTo(x, CY + LIN_I); g.lineTo(x, CY + LIN_O);
        }
        g.stroke();
        // duto de ventilação, cabo e luminárias na parede
        g.fillStyle = LINE; g.fillRect(u0, CY - 108, w, 26);
        g.fillStyle = PAL.yel; g.fillRect(u0, CY - 106.5, w, 23);
        g.fillStyle = PAL.yelL; g.fillRect(u0, CY - 106.5, w, 6);
        g.fillStyle = PAL.yelD; g.fillRect(u0, CY - 89, w, 5.5);
        g.fillStyle = sh(PAL.yel, -0.3); for (let x = rf - 10; x > u0; x -= 18) g.fillRect(x, CY - 106.5, 1.6, 23);
        g.fillStyle = LINE; g.fillRect(u0, CY - 66, w, 2);
        const on = m.night ? 1 : 0.55;
        for (let x = rf - 60; x > u0 + 10; x -= 144) Draw.light(g, x, CY - 58, 3.4, PAL.goldL, on);
      }
      // trilhos no piso
      g.fillStyle = LINE; g.fillRect(Math.min(u0, pl0), RAIL_Y - 5, 4 - Math.min(u0, pl0), 5);
    }
    g.fillStyle = PAL.blkL;
    for (let x = Math.ceil(pl0 / 16) * 16; x < 0; x += 16) g.fillRect(x, RAIL_Y - 2, 9, 2);
    g.fillStyle = LINE; g.fillRect(pl0, RAIL_Y - 6, -pl0, 3.5);
    g.fillStyle = PAL.steelL; g.fillRect(pl0, RAIL_Y - 5.4, -pl0, 1.6);
    // emboque: muro de testa de concreto com o anel do portal
    Draw.box(g, u0 - 30, CY - RC - 46, 30, RC * 2 + 46 + RAIL_Y + 22, C_CONL, { ol: 2, panels: 0, top: sh(C_CONL, 0.2), shade: C_COND });
    Draw.box(g, u0 - 40, CY - RC - 58, 50, 16, C_CON, { ol: 2 });
    Draw.hazard(g, u0 - 30, CY - RC - 14, 30, 6, { ol: 0 });
    g.restore();
  }

  /* ---- horizonte do Pátio (turma 15, Frota de Tatuzões): tatuzões em fila indiana furando atrás dos morros ----
     horizon(g, {x0,x1,y,k=.16,t,n,tint,haze,night}); n>=5 põe o 2º, n>=25 o 3º (mais longe e menor). Mesmo cache da Fuji:
     um ciclo de anel (meta.cycle) gravado UMA vez em HZ_F quadros recortados, sem tinta (o rig de verdade, modo 'bore');
     quadros tingidos guardados até a tinta mudar. Quadro normal = 1 drawImage por tatuzão. */
  const HZ_F = 12, HZ_S = 0.35, HZ_BOX = [REAR - 60, CY - RC - 40, CXF + RC + 40, 30];
  const HZ = { fr: null, tf: [], ok: [], tk: [] };
  function hzBake() {
    if (HZ.fr) return HZ;
    const m = create({ pilot: 'kome', scale: 1, mode: 'bore' }), dt = 1 / 60;
    const inp = { x: 0, y: 0, face: 1, tx: 1e9, ty: 0, digging: true, power: 1, speedMul: 1, floor: () => 0, parts: null, night: 0 };
    for (let i = 0; i < 240; i++) update(m, dt, inp);                 // aquece (rpm e esteira no ritmo)
    const N = Math.round(G.Tools.tbm.meta.cycle / dt), W = Math.ceil((HZ_BOX[2] - HZ_BOX[0]) * HZ_S), H = Math.ceil((HZ_BOX[3] - HZ_BOX[1]) * HZ_S);
    const z0 = Draw.zoom, mp = Draw.minPx; Draw.lod(HZ_S, 0.6);
    const fr = [];
    for (let f = 0, step = 0; f < HZ_F; f++) {
      const want = Math.round(f * N / HZ_F); while (step < want) { update(m, dt, inp); step++; }
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
      c.scale(HZ_S, HZ_S); c.translate(-HZ_BOX[0] - m.x, -HZ_BOX[1]); m.shake = 0;
      try { draw(c, m); } catch (e) { /* horizonte nunca derruba */ }
      fr.push(cv);
    }
    Draw.lod(z0, mp);
    HZ.fr = fr; HZ.w = W; HZ.h = H;
    return HZ;
  }
  function horizon(g, o) {
    const hz = hzBake(), k = o.k || 0.16, t = o.t || 0, n = Math.max(1, o.n | 0), tint = o.tint || '#93A3B4', haze = o.haze === undefined ? 0.6 : o.haze, night = o.night || 0;
    const count = n >= 25 ? 3 : n >= 5 ? 2 : 1, lw = o.x1 - o.x0;
    const base = Math.min(k * 1.0, lw * 0.92 / ((HZ_BOX[2] - HZ_BOX[0]) * (1 + 0.62 * (count - 1))));   // cabe no lote (e no ícone)
    for (let i = count - 1; i >= 0; i--) {
      const ph = ((t * 0.9 + i * 1.37) / G.Tools.tbm.meta.cycle) % 1, fi = Math.floor(ph * HZ_F) % HZ_F;
      const al = Math.min(0.95, haze + 0.2 + i * 0.1), key = tint + '|' + al + '|' + i;
      if (hz.tk[i] !== key) { hz.tf[i] = hz.tf[i] || []; hz.ok[i] = []; hz.tk[i] = key; }   // tinta mudou: retinge sob demanda
      let out = hz.tf[i][fi];
      if (!out) { out = hz.tf[i][fi] = document.createElement('canvas'); out.width = hz.w; out.height = hz.h; }
      if (!hz.ok[i][fi]) {
        const c = out.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, hz.w, hz.h); c.drawImage(hz.fr[fi], 0, 0);
        c.globalCompositeOperation = 'source-atop'; c.globalAlpha = al; c.fillStyle = tint; c.fillRect(0, 0, hz.w, hz.h); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        hz.ok[i][fi] = true;
      }
      const sc = base * (1 - i * 0.22), fx = o.x1 - lw * 0.06 - i * (HZ_BOX[2] - HZ_BOX[0]) * base * 0.62, y = o.y - i * 6;   // face do escudo à direita, fila pra trás
      g.drawImage(out, fx + HZ_BOX[0] * sc, y + HZ_BOX[1] * sc, hz.w / HZ_S * sc, hz.h / HZ_S * sc);
      if (night > 0.2) { g.fillStyle = '#FFE3A0'; g.globalAlpha = night * (1 - i * 0.25); for (let q = 0; q < NG; q++) g.fillRect(fx + (G0 - q * (GL + GGAP) - GL / 2) * sc - 1.5, y + (ROOF + 10) * sc - 1.5, 3, 3); g.globalAlpha = 1; }
    }
  }

  G.Tools.tbm = {
    id: 'tbm', name: 'Tatuzão', kind: 'tbm', w: 1240, h: 300,
    meta: { zoom: 0.3, shake: 0.35, cycle: 4, ringW: RING_W, radius: RC, shieldLen: LS, trainLen: -REAR, axisY: CY, railY: RAIL_Y },
    create, update, draw, drawTunnel, horizon,
    bite: m => m.biteO, dump: m => (m.mode === 'transport' ? null : m.dumpO), seat: m => m.seatO,
  };
})();
