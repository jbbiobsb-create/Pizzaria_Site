/* Kome no Japão — bagger.js
   'bagger': a Bagger 293, escavadeira de roda de caçambas que o Kome pilota sozinho. Rig articulado que fica NO CHÃO, ao pé da
   montanha (nunca sobe no arroz): 3 grupos de esteiras, subestrutura, anel de giro, conveses empilhados, dois mastros
   treliçados com leque de estais, lança da roda (560 px) com correia, cabine pendurada, roda de 18 caçambas, lança do
   contrapeso, ponte de descarga e unidade de carregamento sobre esteiras própria.
   Depende de: core.js, pix.js, shiba.js, fx.js, terrain.js, rig.js.

   Interface (igual a machines-mid.js): G.Tools.bagger = {id, name, kind, w, h, meta, create(opts)->m, update(m,dt,inp),
   draw(g,m), glow(g,m), bite(m), dump(m), seat(m)}; m.ev = eventos do frame ('clank','rev','horn','stall').
   Espaço do modelo: origem no chão embaixo do eixo de giro (m.x, m.y), +x = frente (lado da roda), y pra baixo, 6.5 px/m.

   Controles (inp): tx = x de mundo que a RODA deve alcançar (a máquina rasteja a no máx. 40 px/s); ty = y de mundo do centro
   da roda (vira ângulo da lança, mola, limitado a -18°..+32°); digging = gira a roda (0 -> 100% em 2 s); horn = buzina.
   Sem inp.tx a máquina segue inp.x (o jogo dirige). O jogo pode escrever: m.bite01 (0..1 fração enterrada, null = sem medidor),
   m.band = [min,max] da mordida perfeita, m.stage (1 esteiras+subestrutura, 2 +conveses/mastros/contrapeso, 3 completa), m.x.
   Só leitura: m.luff (rad, + = lança pra cima), m.rpm (0..1), m.vx, m.fill (0..1 das caçambas), m.flow (0..1 saindo na ponta),
   m.perfect (mordida na faixa), m.stalled.
   Noite: draw() já chama glow(); se o jogo escurece a cena por cima, ponha m.deferGlow = true e chame Tools.bagger.glow(g, m)
   depois do filtro de noite (luzes, janelas, giroflex). */
(function () {
  'use strict';
  const E = window.Pixxel;
  if (!E || !E.Draw || !E.Spring) throw new Error('bagger.js: carregue core, pix, shiba, fx, terrain e rig antes');
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const shc = new Map();
  function sh(c, k) { const key = c + '|' + k; let v = shc.get(key); if (v === undefined) { v = U.shade(c, k); shc.set(key, v); } return v; }

  /* ---------------- geometria (modelo: x pra frente, y negativo = pra cima) ---------------- */
  const TH = 66, TW = 108;                         // esteira principal
  const RING = -142, LIFT = 30;                             // topo do anel de giro (tudo acima balança junto)
  const PX = 60, PY = -310;                       // pino da lança da roda
  const BL = 560, WR = 134, WS = 1.2, NB = 18, STEP = TAU / NB;
  const LMIN = -22 * DEG, LMAX = 32 * DEG;   // −22°: a roda (centro y −130, raio 134) encosta no chão; com −18° ela parava 33 px acima e a Bagger nunca limpava o chão
  const M1B = [66, -318], M1T = [244, -636];      // mastro inclinado pra frente
  const M2B = [-34, -292], M2T = [-34, -664];     // torre vertical
  const K0 = [-44, -326], K1 = [-340, -388];      // lança do contrapeso
  const NEAR_TR = [-256, -146, 38, 148], FAR_TR = [-110, 2]; // x das esteiras (2 grupos na frente, 1 atrás)
  const LD_TR = [-694, -610], LTH = 40;           // esteiras da unidade de carregamento
  const BR_A = [-112, -206], BR_B = [-594, -218]; // ponte de descarga
  const LB_A = [-650, -184], LB_B = [-752, -132]; // lança de descarga da unidade
  const DECKS = [                                 // conveses: x0, x1, topo, base, cor
    [-222, 200, -204, -142, 'grayD'], [-184, 162, -256, -204, 'gray'], [-134, 112, -298, -256, 'grayD']];
  const C_LAT = PAL.steel, C_LATF = sh(PAL.steel, 0.3), C_HOUSE = PAL.steelL, C_RAIL = PAL.yel, C_WEB = PAL.steelD;
  const C_WARM = PAL.goldL, C_RICE = PAL.rice;
  const P2 = [[0, 0], [0, 0]], PA = [0, 0], PB = [0, 0], TMP = { x: 0, y: 0 };
  function ln(a, b, c, d) { P2[0][0] = a; P2[0][1] = b; P2[1][0] = c; P2[1][1] = d; return P2; }
  function pa(x, y) { PA[0] = x; PA[1] = y; return PA; }
  function pb(x, y) { PB[0] = x; PB[1] = y; return PB; }
  const pitchOf = (w, h) => { const gh = h * 0.07, R = h / 2 - gh, per = 2 * (w - h) + TAU * R; return per / Math.max(8, Math.round(per / (h * 0.24))); };
  const PITCH = pitchOf(TW, TH), LPITCH = pitchOf(TW, LTH), TRK_N = 6;
  const topChord = lx => -40 + lx * 15.2 / 530, botChord = lx => 40 - lx * 15.2 / 530;

  /* ---------------- sprites pré-renderizados (por nível de detalhe) ---------------- */
  const sprites = new Map();
  function sprite(name, rs, box, fn) {
    const key = name + '@' + rs; let s = sprites.get(key);
    if (!s) {
      const cv = document.createElement('canvas'), w = box[2] - box[0], h = box[3] - box[1];
      cv.width = Math.ceil(w * rs); cv.height = Math.ceil(h * rs);
      const g = cv.getContext('2d'), z0 = Draw.zoom, m0 = Draw.minPx;
      g.scale(rs, rs); g.translate(-box[0], -box[1]);
      Draw.lod(rs, 0.62);
      fn(g);
      Draw.lod(z0, m0);
      s = { cv, x: box[0], y: box[1], w, h }; sprites.set(key, s);
    }
    return s;
  }
  function blit(g, s) { g.drawImage(s.cv, s.x, s.y, s.w, s.h); }

  const BOX_UNDER = [-340, -190, 312, 4], BOX_UPPER = [-420, -712, 290, -132], BOX_BOOM = [-36, -132, 572, 62];
  const BOX_WHEEL = [-152, -152, 152, 152], BOX_GUARD = [430, -76, 596, 40], BOX_BRIDGE = [-776, -366, -84, 4];
  const BOX_SCAF = [-200, -348, 200, -132], BOX_SCAF2 = [16, -384, 124, -292], BOX_TRK = [-262, -86, 262, 2], BOX_LTRK = [-700, -42, -524, 2];

  function yoke(g, cx, half, top, col) {
    Draw.poly(g, [[cx - half, -TH + 8], [cx + half, -TH + 8], [cx + 30, top], [cx - 30, top]], col, { shade: sh(col, -0.2) });
    Draw.circle(g, cx, -TH - 18, 11, PAL.blkL, { hi: false }); Draw.circle(g, cx, -TH - 18, 4, PAL.steelL, { ol: 1 });
    Draw.circle(g, cx - half + 22, -TH + 2, 7, PAL.steelD, { ol: 1.2 }); Draw.circle(g, cx + half - 22, -TH + 2, 7, PAL.steelD, { ol: 1.2 });
  }
  function drawUnder(g) {
    const RU = RING - LIFT;
    // grupo de trás (mais claro), colunas, travessa
    yoke(g, 0, 104, -118, sh(PAL.gray, 0.3));
    Draw.box(g, -26, -126, 52, 22, sh(PAL.gray, 0.3));
    // subestrutura: caixão trapezoidal fundo, com nervuras
    Draw.poly(g, [[-272, -106], [272, -106], [204, RU + 10], [-204, RU + 10]], PAL.gray, { shade: PAL.grayD, hi: PAL.grayL });
    Draw.box(g, -186, RU + 12, 372, -118 - RU, PAL.gray, { panels: 12, rivets: true });
    for (let i = -4; i <= 4; i++) Draw.box(g, i * 44 - 3.5, RU + 12, 7, -118 - RU, PAL.grayD, { ol: 1, top: false });
    Draw.box(g, -282, -112, 564, 12, PAL.grayD, { rivets: 12 });
    yoke(g, -147, 108, -108, PAL.grayD); yoke(g, 147, 108, -108, PAL.grayD);
    Draw.box(g, -160, -106, 26, 10, PAL.blkL, { ol: 1.2 }); Draw.box(g, 134, -106, 26, 10, PAL.blkL, { ol: 1.2 });
    // anel de giro (engrenagem escura com graxa)
    Draw.box(g, -142, RU - 2, 284, 18, PAL.blkL, { r: 2 });
    g.fillStyle = PAL.blk; for (let x = -136; x < 138; x += 10) g.fillRect(x, RU + 3, 5, 10);
    Draw.box(g, -152, RU - 4, 304, 5, PAL.steelD, { ol: 1.4 });
    // escada de acesso do chão, com patamar
    Draw.stairs(g, [-336, 0], [-284, -106], 14, { railCol: C_RAIL, lw: 2.2 });
    Draw.stairs(g, [-280, -112], [-222, RU], 9, { railCol: C_RAIL, lw: 2 });
    // carretel do cabo de força (a máquina liga na tomada)
    Draw.box(g, 226, -150, 48, 38, PAL.steelD, { r: 2 });
    Draw.circle(g, 250, -132, 21, PAL.red); Draw.ring(g, 250, -132, 14, 5, PAL.blk, { hi: false }); Draw.circle(g, 250, -132, 4, PAL.steelL, { ol: 1 });
    Draw.cable(g, [266, -118], [308, -1], { sag: 10, lw: 3 });
    Draw.hazard(g, -272, -103, 544, 5);
  }

  function deckWindows(fn) {
    for (let d = 0; d < DECKS.length; d++) {
      const D = DECKS[d], n = Math.floor((D[1] - D[0] - 30) / 34);
      for (let i = 0; i < n; i++) if ((i * 7 + d * 3) % 5 !== 1) fn(D[0] + 18 + i * 34, D[2] + 13, 16, 12, d, i);
    }
  }
  function mastPair(g, a, b, depth, w, o) {
    Draw.truss(g, [a[0] + 12, a[1] - 5], [b[0] + 12, b[1] - 5], depth, w * 0.85, C_LATF, { taper: o.taper, cross: o.cross });
    Draw.truss(g, a, b, depth, w, C_LAT, o);
  }
  function sheaves(g, x, y, r) {
    Draw.box(g, x - r * 1.7, y - r * 0.5, r * 3.4, r * 1.3, PAL.grayD, { r: 2 });
    Draw.circle(g, x - r * 0.8, y - r * 0.3, r, PAL.blkL); Draw.circle(g, x + r * 0.8, y - r * 0.3, r, PAL.blkL);
    Draw.circle(g, x - r * 0.8, y - r * 0.3, r * 0.35, PAL.steelL, { ol: 1 }); Draw.circle(g, x + r * 0.8, y - r * 0.3, r * 0.35, PAL.steelL, { ol: 1 });
  }
  function drawUpper(g) {
    const X = { taper: 0.55, cross: true, web: C_WEB }, WAR = { taper: 0.8 }, WARN = { taper: 0.8, web: C_WEB };
    // lança do contrapeso + escora de trás
    Draw.truss(g, [K0[0] + 10, K0[1] - 6], [K1[0] + 10, K1[1] - 6], 54, 5, C_LATF, WAR);
    Draw.truss(g, [-24, -596], [-252, -406], 22, 4.5, C_LATF, { taper: 1 });
    Draw.truss(g, K0, K1, 62, 7, C_LAT, WARN);
    Draw.rail(g, [K0[0], K0[1] - 27], [K1[0] + 40, K1[1] - 20], { posts: 16, h: 9, col: C_RAIL });
    // lastro: caixão escuro pendurado na ponta, com lajes
    Draw.box(g, -372, -396, 132, 92, PAL.grayD, { r: 3, rivets: true, panels: 4 });
    for (let i = 0; i < 4; i++) Draw.box(g, -366, -330 + i * 6.5, 120, 5, i % 2 ? PAL.stone : PAL.stoneD, { ol: 1, top: false, shade: false });
    Draw.box(g, -380, -402, 148, 9, PAL.blkL, { r: 2 });
    // casa do guincho em cima da lança + guindaste de serviço
    Draw.box(g, -236, -448, 96, 50, C_HOUSE, { r: 2, panels: 4 });
    Draw.box(g, -242, -454, 108, 8, PAL.steelD, { r: 2 });
    Draw.window(g, -226, -438, 16, 12); Draw.window(g, -168, -438, 16, 12);
    Draw.circle(g, -196, -420, 13, PAL.blkL); Draw.circle(g, -196, -420, 5, PAL.steelL, { ol: 1 });
    Draw.truss(g, [-352, -402], [-352, -492], 14, 3.5, PAL.yel, { taper: 0.8, cross: true });
    Draw.truss(g, [-352, -490], [-404, -512], 10, 3, PAL.yel, { taper: 0.5 });
    Draw.cable(g, [-402, -512], [-402, -452], { lw: 1.6 }); Draw.box(g, -406, -454, 8, 9, PAL.red, { ol: 1.2 });
    Draw.cable(g, [-352, -496], [-312, -404], { lw: 1.4 });
    // mastros: torre vertical, mastro inclinado, travamentos
    Draw.truss(g, [M2T[0], M2T[1] + 18], [M1T[0], M1T[1] + 12], 16, 3.6, C_LATF, { taper: 1, cross: true });
    Draw.truss(g, [-34, -446], [138, -446], 14, 3.6, C_LATF, { taper: 1 });
    Draw.truss(g, [-34, -600], [-262, -410], 26, 6, C_LAT, { taper: 1 });
    Draw.truss(g, [-34, -552], [196, -552], 14, 3.6, C_LATF, { taper: 1 });
    mastPair(g, M2B, M2T, 60, 7.5, X);
    mastPair(g, M1B, M1T, 58, 7.5, X);
    Draw.truss(g, [96, -300], [164, -452], 20, 5, C_LAT, { taper: 0.8 });           // escora grossa do pé do mastro
    Draw.box(g, M2T[0] - 28, M2T[1] - 4, 56, 7, PAL.steelD, { r: 2 });
    Draw.rail(g, [M2T[0] - 28, M2T[1] - 4], [M2T[0] + 28, M2T[1] - 4], { posts: 5, h: 8, col: C_RAIL });
    sheaves(g, M2T[0], M2T[1] - 12, 9); sheaves(g, M1T[0], M1T[1] - 6, 10);
    Draw.box(g, M2T[0] - 2, M2T[1] - 34, 4, 16, PAL.steelD, { ol: 1.2 });
    Draw.stairs(g, [M2B[0] + 30, -300], [M2B[0] - 8, -372], 9, { railCol: C_RAIL, lw: 1.8 });
    // conveses empilhados
    for (let d = 0; d < DECKS.length; d++) {
      const D = DECKS[d], col = PAL[D[4]], w = D[1] - D[0];
      Draw.box(g, D[0], D[2], w, D[3] - D[2], col, { panels: Math.round(w / 34), rivets: true });
      g.fillStyle = sh(col, -0.3); g.fillRect(D[0] + 2, D[2] + 3, w - 4, 4);                // sombra do beiral
    }
    deckWindows((x, y, w, h, d, i) => {
      if ((i + d) % 4 === 2) { Draw.box(g, x - 1, y - 2, 18, 22, PAL.blkL, { ol: 1.2, r: 1 }); g.fillStyle = PAL.blk; for (let k = 0; k < 5; k++) g.fillRect(x + 1, y + 1 + k * 4, 14, 1.6); }
      else Draw.window(g, x, y, w, h, { col: PAL.glassD });
    });
    for (let d = 0; d < DECKS.length; d++) {
      const D = DECKS[d];
      Draw.box(g, D[0] - 12, D[3] - 5, D[1] - D[0] + 24, 6, PAL.blkL, { ol: 1.4, r: 1 });   // passarela
      Draw.rail(g, [D[0] - 12, D[3] - 5], [D[1] + 12, D[3] - 5], { posts: Math.round((D[1] - D[0]) / 18), h: 11, col: C_RAIL, lw: 1.5 });
    }
    Draw.stairs(g, [194, -147], [162, -209], 8, { railCol: C_RAIL, lw: 2 });
    Draw.stairs(g, [-216, -147], [-184, -209], 8, { railCol: C_RAIL, lw: 2 });
    Draw.stairs(g, [156, -209], [118, -261], 7, { railCol: C_RAIL, lw: 2 });
    Draw.stairs(g, [-178, -209], [-140, -261], 7, { railCol: C_RAIL, lw: 2 });
    // casas elétricas, dutos e chaminés no teto
    Draw.box(g, -104, -330, 60, 32, C_HOUSE, { r: 2, panels: 3 }); Draw.box(g, -108, -335, 68, 7, PAL.steelD, { r: 2 });
    Draw.box(g, -6, -322, 34, 24, PAL.steelD, { r: 2, panels: 2 });
    Draw.box(g, -92, -350, 8, 20, PAL.blkL, { r: 1 }); Draw.box(g, -74, -356, 8, 26, PAL.blkL, { r: 1 });
    Draw.window(g, -96, -322, 12, 9); Draw.window(g, -64, -322, 12, 9);
    // cabine secundária laranja no canto da frente
    Draw.box(g, 162, -252, 44, 44, PAL.ora, { r: 4 }); Draw.window(g, 172, -246, 30, 20); Draw.box(g, 158, -256, 52, 6, PAL.oraD, { r: 2 });
    // pórtico do pino da lança
    Draw.poly(g, [[22, -298], [102, -298], [84, -334], [38, -334]], PAL.gray, { shade: PAL.grayD });
    Draw.circle(g, PX, PY, 15, PAL.steelD); Draw.circle(g, PX, PY, 6, PAL.blk, { hi: false });
    // caixas de holofote
    const L = [[200, -210], [-222, -210], [162, -262], [-184, -262], [-140, -456]];
    for (const p of L) Draw.box(g, p[0] - 4, p[1] - 4, 8, 8, PAL.blk, { ol: 1.2, r: 1 });
  }

  function drawBoom(g) {
    Draw.truss(g, [12, -10], [542, -10], 80, 5.5, C_LATF, { taper: 0.62, bays: 14 });
    Draw.beam(g, [[384, -30], [418, -112]], 6, C_LATF);
    Draw.truss(g, [0, 0], [530, 0], 80, 7.5, C_LAT, { taper: 0.62, bays: 14, cross: true, web: C_WEB });
    Draw.beam(g, ln(0, topChord(0), 530, topChord(530)), 3, PAL.blkL, { ol: 1.2, hi: false });               // calha da correia
    Draw.rail(g, [6, botChord(6)], [470, botChord(470)], { posts: 30, h: 12, col: C_RAIL, lw: 1.6 });            // passarela no banzo de baixo
        // cavalete dos estais (pórtico em A na cabeça da lança)
    Draw.beam(g, [[366, topChord(366)], [410, -112], [452, topChord(452)]], 8, C_LAT);
    Draw.beam(g, ln(388, -68, 432, -66), 4, C_LAT);
    sheaves(g, 410, -114, 8);
    // pé da lança e braço que segura o eixo da roda
    Draw.circle(g, 0, 0, 24, PAL.gray); Draw.circle(g, 0, 0, 8, PAL.blkL, { hi: false });
    Draw.poly(g, [[486, -30], [560, -16], [566, 0], [560, 16], [486, 28]], PAL.steelD, { shade: sh(PAL.steelD, -0.2) });
    for (let x = 60; x < 470; x += 82) Draw.box(g, x - 3, botChord(x) + 2, 6, 6, PAL.blk, { ol: 1, r: 1 });
  }
  function drawGuard(g) {
    // caixa chapeada do acionamento + calha que cobre o quadrante de trás-de-cima da roda
    Draw.poly(g, [[434, -20], [446, -66], [498, -70], [514, -46], [504, -10], [490, 32], [438, 32]], C_HOUSE, { shade: PAL.steel, hi: PAL.white });
    Draw.box(g, 444, -14, 42, 40, PAL.steel, { r: 2, rivets: true, panels: 2 });
    Draw.rail(g, [438, -68], [498, -72], { posts: 5, h: 9, col: C_RAIL });
    Draw.box(g, 462, -50, 30, 6, PAL.red, { ol: 1.2, r: 1 });
    Draw.poly(g, [[488, -15], [556, -11], [556, 11], [488, 17]], PAL.steel, { shade: PAL.steelD, hi: PAL.steelL });
    Draw.circle(g, BL, 0, 25, PAL.steel); Draw.ring(g, BL, 0, 17, 4, PAL.steelD, { ol: 1.2, hi: false });
    g.fillStyle = PAL.blk; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2; g.beginPath(); g.arc(BL + Math.cos(a) * 21, Math.sin(a) * 21, 1.8, 0, TAU); g.fill(); }
    Draw.circle(g, BL, 0, 8, PAL.ora, { ol: 1.3 });
  }

  function drawWheel(g) {
    g.save(); g.scale(WS, WS);
    // 18 caçambas fundas: boca aberta pro lado da rotação (-y local), lábio de aço claro com dentes grandes
    for (let i = 0; i < NB; i++) {
      g.save(); g.rotate(i * STEP);
      const TI = G.S && G.S.own && G.S.own.b3;   // b3 Caçambas de Titânio: azul-titânio
      Draw.poly(g, [[76, 14], [78, -18], [96, -24], [114, -18], [110, -2], [104, 11], [92, 18]], TI ? (i % 2 ? '#7E9CB8' : '#5F7F9E') : (i % 2 ? PAL.ora : PAL.rust), { shade: TI ? '#46627E' : PAL.rustD });
      Draw.poly(g, [[82, -11], [95, -16], [105, -11], [99, 5], [84, 8]], sh(PAL.rustD, -0.15), { ol: 0 });
      Draw.beam(g, ln(80, -19, 114, -19), 5.5, PAL.steelL, { ol: 1.5 });
      Draw.poly(g, [[88, -21], [95, -21], [92, -31]], PAL.white, { ol: 1.3 });
      Draw.poly(g, [[98, -21], [105, -21], [103, -32]], PAL.white, { ol: 1.3 }); Draw.poly(g, [[108, -21], [115, -21], [115, -32]], PAL.white, { ol: 1.3 });
      g.restore();
    }
    // aro grosso enferrujado, com chapas rebitadas
    Draw.ring(g, 0, 0, 91, 26, PAL.rust);
    g.strokeStyle = PAL.rustD; g.lineWidth = 2.2;
    for (let i = 0; i < NB; i++) { const a = (i + 0.5) * STEP, c = Math.cos(a), q = Math.sin(a); g.beginPath(); g.moveTo(c * 67, q * 67); g.lineTo(c * 89, q * 89); g.stroke(); }
    g.fillStyle = sh(PAL.rustD, -0.25); for (let i = 0; i < NB * 2; i++) { const a = i * STEP / 2 + 0.09; g.beginPath(); g.arc(Math.cos(a) * 85, Math.sin(a) * 85, 1.5, 0, TAU); g.fill(); }
    Draw.ring(g, 0, 0, 68, 5, PAL.ora, { ol: 1.3 });
    Draw.circle(g, 0, 0, 62, sh(PAL.rustD, -0.14), { hi: false });
    for (let i = 0; i < 9; i++) {                                                         // raios em chapa, bem marcados
      const a = i * TAU / 9 + 0.17, c = Math.cos(a), q = Math.sin(a), c2 = Math.cos(a + 0.24), s2 = Math.sin(a + 0.24), c3 = Math.cos(a - 0.24), s3 = Math.sin(a - 0.24);
      Draw.poly(g, [[c2 * 30, s2 * 30], [c * 64, q * 64], [c3 * 30, s3 * 30]], PAL.rust, { ol: 1.4 });
      Draw.beam(g, ln(c * 26, q * 26, c * 64, q * 64), 8, i % 3 ? PAL.ora : PAL.oraL, { ol: 1.5 });
    }
    Draw.ring(g, 0, 0, 47, 7, PAL.rustD, { ol: 1.3 });
    g.strokeStyle = sh(PAL.rustD, -0.3); g.lineWidth = 2.6; g.globalAlpha = 0.5;
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3; g.beginPath(); g.arc(0, 0, 76 + (i % 3) * 4, a, a + 0.35); g.stroke(); }
    g.globalAlpha = 1;
    Draw.circle(g, 0, 0, 31, PAL.steelD);                                                 // cubo grande
    g.fillStyle = PAL.blk; for (let i = 0; i < 10; i++) { const a = i * TAU / 10; g.beginPath(); g.arc(Math.cos(a) * 24, Math.sin(a) * 24, 2.6, 0, TAU); g.fill(); }
    g.restore();
  }

  function drawBridge(g) {
    // unidade de carregamento: base, casa, mastro e lança de descarga
    Draw.truss(g, [BR_A[0] + 8, BR_A[1] - 6], [BR_B[0] + 8, BR_B[1] - 6], 46, 4.5, C_LATF, { taper: 0.85, bays: 13 });
    Draw.truss(g, [-616, -176], [-616, -350], 26, 4.5, C_LATF, { taper: 0.7, cross: true });
    Draw.poly(g, [[-700, -36], [-520, -36], [-548, -66], [-676, -66]], PAL.grayD, { shade: sh(PAL.grayD, -0.2) });
    Draw.box(g, -664, -76, 104, 10, PAL.blkL, { r: 2 });
    Draw.box(g, -676, -170, 124, 94, PAL.gray, { r: 2, panels: 4, rivets: true });
    Draw.window(g, -664, -156, 16, 12, { col: PAL.glassD }); Draw.window(g, -636, -156, 16, 12, { col: PAL.glassD }); Draw.window(g, -580, -156, 16, 12, { col: PAL.glassD });
    Draw.box(g, -608, -150, 18, 22, PAL.blkL, { ol: 1.2, r: 1 });
    Draw.box(g, -688, -176, 148, 6, PAL.blkL, { ol: 1.4, r: 1 });
    Draw.rail(g, [-688, -176], [-540, -176], { posts: 10, h: 11, col: C_RAIL, lw: 1.5 });
    Draw.stairs(g, [-506, 0], [-544, -74], 9, { railCol: C_RAIL, lw: 2 });
    Draw.stairs(g, [-548, -80], [-542, -176], 10, { railCol: C_RAIL, lw: 1.8 });
    Draw.truss(g, [-580, -176], [-580, -226], 30, 4.5, C_LAT, { taper: 1, cross: true });      // apoio da ponte
    Draw.truss(g, [-655, -170], [-750, -122], 28, 5, C_LAT, { taper: 0.6 });                   // lança de descarga
    Draw.truss(g, [-610, -176], [-610, -344], 26, 5.5, C_LAT, { taper: 0.7, cross: true });
    sheaves(g, -610, -350, 7);
    Draw.truss(g, BR_A, BR_B, 46, 6, C_LAT, { taper: 0.85, bays: 13, cross: true, web: C_WEB });
    Draw.beam(g, ln(BR_A[0], BR_A[1] - 23, BR_B[0], BR_B[1] - 19.5), 3, PAL.blkL, { ol: 1.2, hi: false });
    Draw.rail(g, [BR_A[0], BR_A[1] + 23], [BR_B[0], BR_B[1] + 19.5], { posts: 30, h: 11, col: C_RAIL, lw: 1.5 });
    const S = [[-470, -238], [-350, -235], [-748, -134], [-560, -226]];
    for (const p of S) Draw.cable(g, [-610, -348], p, { lw: 1.6, sag: 3 });
    Draw.box(g, -764, -128, 22, 12, PAL.steelD, { r: 2 });                                     // bica da ponta
  }

  function drawScaf(g) {
    // obra: andaime, pranchas, um convés pela metade
    Draw.box(g, -120, -204, 190, 62, PAL.grayD, { panels: 5, rivets: true });
    Draw.box(g, -80, -238, 90, 34, PAL.gray, { panels: 3 });
    for (let lvl = 0; lvl < 4; lvl++) {
      const y = RING - 48 * (lvl + 1), w = 180 - lvl * 22;
      Draw.lattice(g, -w, y, w * 2, 48, 44, 2.4, PAL.woodL, { ol: 1.2, joints: false });
      Draw.box(g, -w - 6, y + 44, w * 2 + 12, 4, PAL.wood, { ol: 1.2, top: false, shade: false });
    }
    Draw.rail(g, [-120, -334], [120, -334], { posts: 9, h: 10, col: C_RAIL });
    Draw.hazard(g, -180, RING - 8, 360, 6);
    Draw.box(g, 90, -230, 40, 30, PAL.water, { r: 2 }); Draw.box(g, -168, -178, 30, 30, PAL.sack, { r: 2 });
  }
  function drawScaf2(g) {
    Draw.lattice(g, 24, -378, 92, 80, 40, 2.4, PAL.woodL, { ol: 1.2, joints: false });
    Draw.box(g, 20, -340, 100, 4, PAL.wood, { ol: 1.2, top: false, shade: false });
    Draw.hazard(g, 24, -304, 92, 6);
  }
  function trackSprite(rs, i) {
    return sprite('trk' + i, rs, BOX_TRK, g => {
      const ph = i / TRK_N * PITCH;
      for (const x of FAR_TR) Draw.track(g, x + 2, -TH - 15, TW, TH, ph, { col: sh(PAL.grayD, 0.25), belt: PAL.blkL });
      for (const x of NEAR_TR) Draw.track(g, x, -TH, TW, TH, ph, { col: PAL.yelD });
    });
  }
  function ltrackSprite(rs, i) {
    return sprite('ltrk' + i, rs, BOX_LTRK, g => {
      const ph = i / TRK_N * LPITCH;
      Draw.track(g, LD_TR[0] + 12, -LTH - 9, TW, LTH, ph, { col: sh(PAL.grayD, 0.25), belt: PAL.blkL });
      for (const x of LD_TR) Draw.track(g, x, -LTH, TW, LTH, ph, { col: PAL.yelD });
    });
  }

  /* ---------------- correias (leves: uma lista de montinhos que anda) ---------------- */
  function Belt(len, sp, speed) { return { n: Math.ceil(len / sp), sp, len, speed, ph: 0, load: new Float32Array(Math.ceil(len / sp)), on: 0 }; }
  function beltPut(b, v) { b.load[0] = Math.min(1.6, b.load[0] + v); }
  function beltStep(b, dt, k) {
    let out = 0; b.ph += b.speed * k * dt;
    while (b.ph >= b.sp) { b.ph -= b.sp; out += b.load[b.n - 1]; b.load.copyWithin(1, 0, b.n - 1); b.load[0] = 0; }
    return out;
  }
  function beltDraw(g, b, ax, ay, bx, by, lit) {
    const dx = (bx - ax) / b.len, dy = (by - ay) / b.len, m = Draw.minPx / Draw.zoom, ol = Math.max(1.4, m);
    g.lineCap = 'butt';
    g.strokeStyle = LINE; g.lineWidth = 5 + ol * 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.strokeStyle = PAL.blk; g.lineWidth = 5; g.stroke();
    if (Draw.zoom > 0.4) {
      g.strokeStyle = PAL.blkL; g.lineWidth = 3; g.setLineDash([3, b.sp - 3]); g.lineDashOffset = -b.ph; g.stroke(); g.setLineDash([]);
    }
    // montinhos de arroz: contorno + corpo num caminho só
    const L = b.load;
    g.fillStyle = LINE; g.beginPath();
    for (let i = 0; i < b.n; i++) {
      const v = L[i]; if (v < 0.05) continue;
      const s = i * b.sp + b.ph, r = 4.5 + 6.5 * Math.min(1.3, v), x = ax + dx * s, y = ay + dy * s - 2;
      g.moveTo(x + r + ol, y); g.arc(x, y, r + ol, 0, PI, true);
    }
    g.fill();
    g.fillStyle = lit ? sh(C_RICE, -0.06) : C_RICE; g.beginPath();
    for (let i = 0; i < b.n; i++) {
      const v = L[i]; if (v < 0.05) continue;
      const s = i * b.sp + b.ph, r = 4.5 + 6.5 * Math.min(1.3, v), x = ax + dx * s, y = ay + dy * s - 2;
      g.moveTo(x + r, y); g.arc(x, y, r, 0, PI, true);
    }
    g.fill();
  }

  /* ---------------- estado ---------------- */
  const WALK = [  // shibas nas passarelas: quadro ('b' corpo, 'o' lança, 'r' ponte), x0, x1, y, velocidade, fase, paleta
    ['b', -226, 204, -147, 15, 0, 'goma'], ['b', -188, 166, -209, 12, 90, 'kuro'], ['b', -138, 114, -261, 10, 30, 'shiro'],
    ['b', -216, 196, -147, 18, 200, 'cha'], ['o', 20, 450, 0, 16, 60, 'goma'], ['r', -560, -130, 0, 14, 10, 'kuro'],
    ['b', -360, -250, -402, 8, 5, 'aka'], ['u', -270, 270, -112, 13, 44, 'shiro']];
  const GRAIN = { shape: 'grain', c: [PAL.rice, PAL.rice, PAL.riceS], land: true, w: [5, 8], life: 1.6, ol: true, speed: [30, 120], spread: 0.6, dir: PI / 2 };
  const shO = { scale: 0.27, shadow: false, pal: 'goma', face: 1 }, komeO = { scale: 1.05, shadow: false, pal: 'kome', face: 1 };

  function create(opts) {
    opts = opts || {};
    const m = {
      id: 'bagger', t: 0, ev: [], x: 0, y: 0, face: 1, init: false, stage: opts.stage || 3, pilot: opts.pilot || 'kome',
      vx: 0, luff: opts.luff !== undefined ? opts.luff : 4 * DEG, rpm: 0, rot: 0, fill: 0, flow: 0, bite01: null, band: [0.4, 0.7],
      perfect: false, stalled: false, night: 0, zoom: 0.26, parts: null, deferGlow: false, busy: false, ph: 0, load: 0, power: 0,
      trk: 0, sway: 0, wobX: 0, wobY: 0, hornT: 0, hornIn: false, moving: false, digIn: false, spill: 0, pour: 0, bIdx: 0,
      luffS: E.Spring(opts.luff !== undefined ? opts.luff : 4 * DEG, { k: 9, d: 5.2 }), swayS: E.Spring(0, { k: 26, d: 3.4 }), cabS: E.Spring(0, { k: 22, d: 2.2 }),
      buckets: new Float32Array(NB), boomBelt: Belt(498, 14, 95), bridgeBelt: Belt(484, 14, 110), loadBelt: Belt(114, 14, 120),
      biteO: { x: 0, y: 0, r: WR, active: false, phase: 0 }, dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
    };
    return m;
  }
  // ponto da lança (lx ao longo, ly perpendicular) -> modelo
  function boomPt(m, lx, ly, out) {
    const c = Math.cos(-m.luff), s = Math.sin(-m.luff);
    out.x = PX + lx * c - ly * s; out.y = PY + lx * s + ly * c; return out;
  }
  // modelo (parte de cima, com o balanço) -> mundo
  function toWorld(m, x, y, out) {
    const c = Math.cos(m.sway), s = Math.sin(m.sway), dy = y - RING;
    const k = m.k || 1; out.x = m.x + m.face * k * (x * c - dy * s); out.y = m.y + k * (RING - LIFT + x * s + dy * c); return out;
  }
  function wheelWorld(m, out) { boomPt(m, BL, 0, out); return toWorld(m, out.x + m.wobX, out.y + m.wobY, out); }

  function update(m, dt, inp) {
    inp = inp || {};
    m.ev.length = 0; m.t += dt;
    m.parts = inp.parts || null; m.night = inp.night || 0; if (inp.zoom) m.zoom = inp.zoom;
    m.face = inp.face < 0 ? -1 : 1;
    if (!m.init) { m.x = inp.x || 0; m.init = true; }
    m.y = inp.y || 0;
    const st = m.stage, face = m.face, full = st >= 3;
    // lança: mola pesada até o ângulo pedido
    if (full && inp.ty !== undefined && inp.ty !== null) m.luffS.target = clamp(Math.asin(clamp((m.y + PY - LIFT - inp.ty) / BL, -1, 1)), LMIN, LMAX);
    const pl = m.luff; m.luffS.update(dt);
    if (m.luffS.x < LMIN) { m.luffS.x = LMIN; if (m.luffS.v < 0) m.luffS.v = 0; }
    if (m.luffS.x > LMAX) { m.luffS.x = LMAX; if (m.luffS.v > 0) m.luffS.v = 0; }
    m.luff = m.luffS.x;
    // rastejo: a roda vai atrás de tx
    const pv = m.vx;
    if (inp.tx !== undefined && inp.tx !== null) {
      const wx = m.x + face * (PX + BL * Math.cos(m.luff)), err = inp.tx - wx;
      if (inp.crawl) {
        // jogo (19/11): viagem rápida com peso — vai a inp.crawl px/s, acelera/freia em inp.crawlTau s e freia a tempo de parar
        const a = inp.crawl / Math.max(0.1, inp.crawlTau || 1), ae = Math.abs(err);
        const want = ae < 3 ? 0 : Math.sign(err) * Math.min(inp.crawl, Math.sqrt(2 * a * 0.8 * ae), ae * 6);
        const mdv = a * dt * (Math.abs(want) < Math.abs(m.vx) || want * m.vx < 0 ? 1.6 : 1);
        m.vx += clamp(want - m.vx, -mdv, mdv); if (Math.abs(m.vx) < 0.4 && want === 0) m.vx = 0;
      } else {
        const want = Math.abs(err) < 3 ? 0 : clamp(err * 1.3, -70, 70);
        m.vx = damp(m.vx, want, 2.4, dt); if (Math.abs(m.vx) < 0.4 && want === 0) m.vx = 0;
      }
      m.x += m.vx * dt;
    } else if (inp.x !== undefined) { m.vx = dt > 0 ? clamp((inp.x - m.x) / dt, -200, 200) : 0; m.x = inp.x; }
    const mov = Math.abs(m.vx) > 2;
    if (mov && !m.moving) { m.ev.push('clank'); if (m.hornT <= 0) { m.ev.push('horn'); m.hornT = 8; } }
    if (!mov && m.moving) m.ev.push('clank');
    m.moving = mov; m.hornT -= dt;
    if (inp.horn && !m.hornIn) m.ev.push('horn'); m.hornIn = !!inp.horn;
    m.trk += m.vx * face * dt;
    const acc = dt > 0 ? (m.vx - pv) / dt * face : 0;
    m.swayS.target = clamp(-acc * 0.0004, -0.012, 0.012); m.sway = m.swayS.update(dt);
    m.cabS.target = clamp(acc * 0.004 + (m.luff - pl) / Math.max(dt, 1e-4) * 0.5, -0.3, 0.3); m.cabS.update(dt);
    // roda: gira enquanto 'digging' (0 -> 100% em 2 s), trava acima de .85 de mordida
    const dig = full && !!inp.digging, b = m.bite01 === null || m.bite01 === undefined ? (dig ? 0.55 : 0) : m.bite01;
    const stall = dig && b > 0.85;
    if (dig && !m.digIn) m.ev.push('rev'); m.digIn = dig;
    if (stall && !m.stalled) m.ev.push('stall'); m.stalled = stall;
    const tgt = dig ? (stall ? 0.3 : 1) : 0;
    m.rpm += clamp(tgt - m.rpm, -dt / (stall ? 0.6 : 3), dt / 2);
    m.perfect = dig && b >= m.band[0] && b <= m.band[1];
    m.fill = dig && m.rpm > 0.15 ? clamp(b / 0.4, 0, 1) * (m.perfect ? 1.3 : 1) : 0;
    const sm = inp.speedMul || 1;
    m.rot -= m.rpm * 0.33 * TAU * sm * (1 + 0.25 * (inp.boost || 0)) * dt;
    if (stall) { m.wobX = (Math.random() - 0.5) * 5; m.wobY = (Math.random() - 0.5) * 5; }
    else { const k = m.rpm * (m.fill > 0 ? 1.4 : 0.4); m.wobX = 0; m.wobY = Math.sin(m.rot * NB) * k; }
    m.busy = m.rpm > 0.05; m.power = m.rpm; m.load = m.fill; m.ph = ((-m.rot / STEP) % 1 + 1) % 1;
    const bi = Math.floor(-m.rot / STEP);
    if (bi !== m.bIdx) { m.bIdx = bi; if (m.fill > 0) m.ev.push('clank'); }
    // caçambas: enchem embaixo-na-frente, sobem cheias, viram na calha de trás-de-cima
    if (full) {
      const B = m.buckets, parts = m.parts; let spillAt = -1;
      for (let i = 0; i < NB; i++) {
        let a = (m.rot + i * STEP) % TAU; if (a > PI) a -= TAU; else if (a < -PI) a += TAU;
        if (a > 0.1 && a < 1.3) { if (m.fill > B[i]) B[i] = m.fill; }
        else if (a < -1.9 && a > -2.7 && B[i] > 0) { beltPut(m.boomBelt, B[i] * 0.75); B[i] = 0; }
        else if (B[i] > 0.3 && a < 0 && a > -1.7 && Math.random() < 0.5) spillAt = a;
      }
      m.spill += dt * (m.fill > 0 ? 26 * m.rpm : 0);
      if (parts && m.spill >= 1) {
        const n = Math.floor(m.spill); m.spill -= n;
        wheelWorld(m, TMP);
        const a = spillAt > -9 ? spillAt : 0.6, wx = TMP.x + face * Math.cos(a) * 126, wy = TMP.y + Math.sin(a) * 126;
        GRAIN.dir = PI / 2 - face * 0.5; GRAIN.speed[0] = 30; GRAIN.speed[1] = 150; GRAIN.spread = 0.9;
        parts.spray(wx, wy, n, GRAIN);
      }
      const run = m.rpm > 0.03 ? 1 : 0;
      m.boomBelt.on = damp(m.boomBelt.on, run || m.flow > 0.02 ? 1 : 0, 2, dt);
      const o1 = beltStep(m.boomBelt, dt, Math.max(m.boomBelt.on, 0.0)); if (o1 > 0) beltPut(m.bridgeBelt, o1);
      const o2 = beltStep(m.bridgeBelt, dt, 1); if (o2 > 0) beltPut(m.loadBelt, o2);
      const o3 = beltStep(m.loadBelt, dt, 1);
      m.pour = Math.max(0, m.pour - dt * 1.4) + o3 * 0.5; if (m.pour > 1.2) m.pour = 1.2;
      m.flow = damp(m.flow, clamp(m.pour, 0, 1), 5, dt);
      if (parts && o3 > 0.05) {
        const x = m.x + face * (LB_B[0] - 6), y = m.y + LB_B[1] + 4;
        GRAIN.dir = PI / 2 + face * 0.7; GRAIN.speed[0] = 60; GRAIN.speed[1] = 170; GRAIN.spread = 0.35;
        parts.spray(x, y, Math.ceil(o3 * 5), GRAIN);
      }
    } else { m.flow = 0; }
  }

  function bite(m) {
    const o = m.biteO; wheelWorld(m, TMP); o.x = TMP.x; o.y = TMP.y; o.r = WR * (m.k || 1);
    o.active = m.stage >= 3 && m.digIn && m.rpm > 0.25; o.phase = m.ph; return o;
  }
  function dump(m) { const o = m.dumpO, k = m.k || 1; o.x = m.x + m.face * k * (LB_B[0] - 8); o.y = m.y + k * (LB_B[1] + 6); o.active = m.flow > 0.03; return o; }
  function cabinPt(m, out) { boomPt(m, 352, botChord(352) + 2, out); return out; }
  function seat(m) {
    const o = m.seatO; cabinPt(m, TMP);
    toWorld(m, TMP.x - Math.sin(m.cabS.x) * 52, TMP.y + Math.cos(m.cabS.x) * 52, o); return o;
  }

  /* ---------------- desenho ---------------- */
  function lodOf(g) {
    const t = g.getTransform(), e = Math.hypot(t.a, t.b);
    return e <= 0.62 ? 0.5 : e <= 1.3 ? 1 : 2;
  }
  function walker(m, w, t) {
    const span = w[2] - w[1], u = ((t * w[4] + w[5]) % (span * 2) + span * 2) % (span * 2), fwd = u < span;
    shO.pal = w[6]; shO.face = fwd ? 1 : -1;
    return w[1] + (fwd ? u : span * 2 - u);
  }
  function signAt(g, m, cx, cy, w, h, txt, o) {
    g.save(); g.translate(cx, cy); if (m.face < 0) g.scale(-1, 1);
    Draw.sign(g, -w / 2, -h / 2, w, h, txt, o); g.restore();
  }
  const SIGN_O = { col: PAL.cream, ink: PAL.ink, rivets: true }, SIGN_R = { col: PAL.cream, ink: PAL.red };
  const CAB = { lw: 2, sag: 0, col: LINE }, CAB2 = { lw: 1.5, sag: 0, col: LINE };
  function stay(g, ax, ay, bx, by, sag, thin) {
    const o = thin ? CAB2 : CAB; o.sag = sag; Draw.cable(g, pa(ax, ay), pb(bx, by), o);
  }

  function draw(g, m) {
    const z0 = Draw.zoom, m0 = Draw.minPx, rs = lodOf(g), st = m.stage, t = m.t;
    Draw.lod(m.zoom, Math.max(m0, 0.62));
    g.save(); g.translate(m.x, m.y); g.scale(m.face * (m.k || 1), m.k || 1);
    const fi = ((Math.floor(m.trk / PITCH * TRK_N) % TRK_N) + TRK_N) % TRK_N;
    const sw = Math.sin(t * 1.3) * 1.2 + m.rpm * Math.sin(t * 9) * 0.8;       // estais vibrando

    // 1) ponte de descarga + unidade de carregamento (atrás de tudo)
    if (st >= 3) {
      const lfi = ((Math.floor(m.trk / LPITCH * TRK_N) % TRK_N) + TRK_N) % TRK_N;
      blit(g, ltrackSprite(rs, lfi));
      blit(g, sprite('bridge', rs, BOX_BRIDGE, drawBridge));
      beltDraw(g, m.bridgeBelt, BR_A[0], BR_A[1] - 26, BR_B[0], BR_B[1] - 22.5);
      beltDraw(g, m.loadBelt, LB_A[0], LB_A[1], LB_B[0], LB_B[1]);
      if (m.flow > 0.02) {                                                   // cortina de arroz caindo da ponta
        const x = LB_B[0] - 8, y = LB_B[1] + 4, w = 4 + 12 * m.flow, fy = -4, wob = Math.sin(t * 17) * 2;
        g.fillStyle = LINE; g.beginPath(); g.moveTo(x + w + 1.5, y); g.quadraticCurveTo(x - 20, y + 20, x - 34 - w * 1.5 + wob, fy); g.lineTo(x - 30 + w * 1.5 + wob, fy); g.quadraticCurveTo(x - 10, y + 26, x - w - 1.5 + 6, y + 4); g.closePath(); g.fill();
        g.fillStyle = C_RICE; g.beginPath(); g.moveTo(x + w, y); g.quadraticCurveTo(x - 20, y + 22, x - 33 - w + wob, fy); g.lineTo(x - 31 + w + wob, fy); g.quadraticCurveTo(x - 11, y + 26, x - w + 6, y + 5); g.closePath(); g.fill();
      }
      g.fillStyle = C_RICE; g.strokeStyle = LINE; g.lineWidth = 1.6;         // moega no pé da ponte
    }
    // 2) esteiras + subestrutura
    blit(g, trackSprite(rs, fi));
    blit(g, sprite('under', rs, BOX_UNDER, drawUnder));
    if (st === 1) { g.translate(0, -LIFT); blit(g, sprite('scaf', rs, BOX_SCAF, drawScaf)); g.translate(0, LIFT); }

    // 3) parte de cima (balança inteira em volta do anel)
    g.save(); g.translate(0, RING - LIFT); g.rotate(m.sway); g.translate(0, -RING);
    if (st >= 2) {
      blit(g, sprite('upper', rs, BOX_UPPER, drawUpper));
      // estais de trás: torre -> contrapeso / guincho; topo -> topo
      for (let i = 0; i < 3; i++) stay(g, M2T[0] - 6 + i * 6, M2T[1] - 16, K1[0] - 20 + i * 14, K1[1] - 18, 7 + sw + i, i > 0);
      for (let i = 0; i < 4; i++) stay(g, M2T[0] - 8 + i * 4, M2T[1] - 16, -204 + i * 8, -452, 2 + sw * 0.5, true);
      stay(g, M2T[0], -500, -150, K0[1] - 62, 4 + sw, true);
      stay(g, M2T[0] + 8, M2T[1] - 18, M1T[0] - 8, M1T[1] - 12, 5 + sw, false); stay(g, M2T[0] + 8, M2T[1] - 12, M1T[0] - 8, M1T[1] - 6, 6 - sw, true);
    }
    if (st === 2) {
      blit(g, sprite('scaf2', rs, BOX_SCAF2, drawScaf2));
      const hx = M1T[0] + 30 + Math.sin(t * 0.9) * 10;
      stay(g, M1T[0] + 6, M1T[1] - 8, hx, -430, 0, false);
      Draw.box(g, hx - 7, -432, 14, 16, PAL.yel, { r: 2 }); Draw.ring(g, hx, -408, 7, 2.6, PAL.steelD, { ol: 1.2 });
    }
    let wxm = 0, wym = 0;
    if (st >= 3 && m.wheels === 2) {
      // Bagger Gigante (modo infinito, peça 4): segunda lança mais baixa, atrás da primeira, roda girando em outra fase
      g.save(); g.translate(PX - 30, PY - 40); g.rotate(-(m.luff + (m.boom2 === undefined ? 0.3 : m.boom2)));   // m.boom2: abertura entre as duas lanças (a Gêmea no monte de estoque fecha mais)
      blit(g, sprite('boom', rs, BOX_BOOM, drawBoom));
      g.save(); g.translate(BL * 0.96 + m.wobY, m.wobX);
      g.save(); g.rotate(m.rot + STEP * 0.5); blit(g, sprite('wheel', rs, BOX_WHEEL, drawWheel)); g.restore();
      g.restore();
      blit(g, sprite('guard', rs, BOX_GUARD, drawGuard));
      g.restore();
    }
    if (st >= 3) {
      // lança + correia + roda + guarda
      g.save(); g.translate(PX, PY); g.rotate(-m.luff);
      blit(g, sprite('boom', rs, BOX_BOOM, drawBoom));
      beltDraw(g, m.boomBelt, 506, topChord(506) - 4, 8, topChord(8) - 4);
      g.save(); g.translate(BL + m.wobX, m.wobY);
      g.save(); g.rotate(m.rot); blit(g, sprite((G.S && G.S.own && G.S.own.b3) ? 'wheelTi' : 'wheel', rs, BOX_WHEEL, drawWheel)); g.restore();
      // arroz nas caçambas (sobe pela frente)
      const B = m.buckets; let any = false;
      g.fillStyle = LINE; g.beginPath();
      for (let i = 0; i < NB; i++) { const v = B[i]; if (v < 0.05) continue; any = true; const a = m.rot + i * STEP - 0.15, r = 6 + 9 * Math.min(1.3, v), x = Math.cos(a) * 117, y = Math.sin(a) * 117; g.moveTo(x + r + 1.6, y); g.arc(x, y, r + 1.6, 0, TAU); }
      if (any) {
        g.fill(); g.fillStyle = C_RICE; g.beginPath();
        for (let i = 0; i < NB; i++) { const v = B[i]; if (v < 0.05) continue; const a = m.rot + i * STEP - 0.15, r = 6 + 9 * Math.min(1.3, v), x = Math.cos(a) * 117, y = Math.sin(a) * 117; g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
        g.fill();
        g.fillStyle = PAL.riceS; g.beginPath();
        for (let i = 0; i < NB; i++) { const v = B[i]; if (v < 0.05) continue; const a = m.rot + i * STEP - 0.15, r = 6 + 9 * Math.min(1.3, v), x = Math.cos(a) * 117 + r * 0.25, y = Math.sin(a) * 117 + r * 0.3; g.moveTo(x + r * 0.5, y); g.arc(x, y, r * 0.5, 0, TAU); }
        g.fill();
      }
      g.restore();
      blit(g, sprite('guard', rs, BOX_GUARD, drawGuard));
      g.save(); g.translate(465, 6); g.rotate(m.luff); if (m.face < 0) g.scale(-1, 1); Draw.sign(g, -16, -8, 32, 16, '293', SIGN_R); g.restore();
      g.restore();
      // cabine pendurada (fica no prumo, balança) com o Kome dentro
      cabinPt(m, TMP);
      g.save(); g.translate(TMP.x, TMP.y); g.rotate(m.cabS.x);
      Draw.beam(g, ln(-12, -2, -18, 24), 3, PAL.steelD, { ol: 1.4 }); Draw.beam(g, ln(12, -2, 18, 24), 3, PAL.steelD, { ol: 1.4 });
      Draw.box(g, -34, 22, 68, 58, PAL.ora, { r: 6 });
      Draw.box(g, -38, 18, 76, 8, PAL.oraD, { r: 2 });
      Draw.window(g, -28, 30, 56, 36, { col: m.night > 0.3 ? C_WARM : PAL.skyL, glare: false });
      komeO.pal = m.pilot; E.drawShiba(g, -4, 80, 'drive', t, komeO);
      Draw.box(g, -34, 66, 68, 14, PAL.ora, { ol: 0, top: false, r: 4 });
      g.fillStyle = PAL.oraD; g.fillRect(-31, 76, 62, 3);
      g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(14, 30); g.lineTo(22, 30); g.lineTo(8, 66); g.lineTo(0, 66); g.closePath(); g.fill();
      g.strokeStyle = LINE; g.lineWidth = Math.max(1.6, Draw.minPx / Draw.zoom); g.strokeRect(-28, 30, 56, 36);
      g.restore();
      // estais da frente: leque do mastro até a cabeça da lança
      boomPt(m, 410, -118, TMP); const hx = TMP.x, hy = TMP.y;
      for (let i = 0; i < 4; i++) stay(g, M1T[0] - 8 + i * 5, M1T[1] - 8, hx - 6 + i * 4, hy, 6 + sw + i * 1.5, i > 0);
      boomPt(m, 250, topChord(250), TMP); stay(g, M1T[0], M1T[1] - 4, TMP.x, TMP.y, 5 - sw, true);
      boomPt(m, 505, -62, TMP); stay(g, M1T[0] + 6, M1T[1] - 8, TMP.x, TMP.y, 9 + sw, true);
      boomPt(m, 130, topChord(130), TMP); stay(g, M2T[0] + 6, -500, TMP.x, TMP.y, 4 + sw, true);
      boomPt(m, BL, 0, TMP); wxm = TMP.x; wym = TMP.y;
    }
    // 4) shibas minúsculos nas passarelas
    for (let i = 0; i < WALK.length; i++) {
      const w = WALK[i], k = w[0];
      if (k === 'u') { if (st !== 1) continue; }
      else if ((k === 'b' && st < 2) || ((k === 'o' || k === 'r') && st < 3)) continue;
      let x = walker(m, w, t), y = w[3];
      if (k === 'o') { boomPt(m, x, botChord(x) - 1, TMP); x = TMP.x; y = TMP.y; }
      else if (k === 'r') { y = BR_A[1] + 23 + (x - BR_A[0]) * (BR_B[1] - BR_A[1] - 3.5) / (BR_B[0] - BR_A[0]); }
      if (k === 'r' || k === 'u') { g.restore(); E.drawShiba(g, x, y, 'walk', t + i, shO); g.save(); g.translate(0, RING - LIFT); g.rotate(m.sway); g.translate(0, -RING); }
      else E.drawShiba(g, x, y, 'walk', t + i, shO);
    }
    // 5) placas (nunca espelhadas)
    if (st >= 2) { signAt(g, m, -306, -366, 112, 40, 'KOME-293', SIGN_O); signAt(g, m, 30, -230, 80, 26, 'KOME', SIGN_O); }
    g.restore();
    if (st === 1) signAt(g, m, 0, -250 - LIFT, 120, 34, 'EM MONTAGEM', SIGN_O);
    g.restore();
    if (!m.deferGlow) glowIn(g, m);
    if (st >= 3 && m.bite01 !== null && m.bite01 !== undefined && m.rpm > 0.04) gauge(g, m);
    Draw.lod(z0, m0);
  }

  /* ---------------- luzes ---------------- */
  const FLOOD = [[200, -212, 7], [-222, -212, 7], [162, -264, 6], [-184, -264, 6], [-140, -458, 6], [-34, -500, 6], [-610, -300, 6], [-560, -182, 6], [-250, -410, 6]];
  const BEACON = [[M2T[0], M2T[1] - 38, 0], [M1T[0], M1T[1] - 22, 0.5], [-610, -362, 0.25], [-352, -500, 0.75]];
  const LT = { halo: 5.5, ol: 1.2 }, LTB = { halo: 7, ol: 1.2 }, LTS = { halo: 4, ol: 0 };
  function glow(g, m) { const z0 = Draw.zoom, m0 = Draw.minPx; Draw.lod(m.zoom, Math.max(m0, 0.62)); glowIn(g, m); Draw.lod(z0, m0); }
  function glowIn(g, m) {
    const n = m.night, st = m.stage, t = m.t;
    g.save(); g.translate(m.x, m.y); g.scale(m.face * (m.k || 1), m.k || 1);
    if (st >= 3 && n > 0.05) for (let i = 6; i < 8; i++) Draw.light(g, FLOOD[i][0], FLOOD[i][1], FLOOD[i][2], C_WARM, n, LT);
    if (st >= 3) { const k = (t * 0.9 + BEACON[2][2]) % 1; Draw.light(g, BEACON[2][0], BEACON[2][1], 5, PAL.red, k < 0.5 ? 1 : 0, LTB); }
    if (st >= 3 && n > 0.05) for (let x = BR_A[0] - 40; x > BR_B[0]; x -= 88) Draw.light(g, x, BR_A[1] + 26, 3.5, C_WARM, n, LTS);
    g.translate(0, RING - LIFT); g.rotate(m.sway); g.translate(0, -RING);
    if (st >= 2) {
      if (n > 0.05) {
        g.globalAlpha = n; g.fillStyle = C_WARM;
        deckWindows((x, y, w, h, d, i) => { if ((i + d) % 4 !== 2 && (i * 5 + d) % 3 !== 0) g.fillRect(x + 1, y + 1, w - 2, h - 2); });
        g.fillRect(173, -245, 28, 18); g.fillRect(-225, -437, 14, 10); g.fillRect(-167, -437, 14, 10);
        g.globalAlpha = 1;
        for (let i = 0; i < 6; i++) Draw.light(g, FLOOD[i][0], FLOOD[i][1], FLOOD[i][2], C_WARM, n, LT);
        Draw.light(g, FLOOD[8][0], FLOOD[8][1], FLOOD[8][2], C_WARM, n, LT);
      }
      for (let i = 0; i < 4; i++) { if (i === 2) continue; const b = BEACON[i], k = (t * 0.9 + b[2]) % 1; Draw.light(g, b[0], b[1], 5.5, PAL.red, k < 0.5 ? 1 : 0, LTB); }
    }
    if (st >= 3) {
      if (n > 0.05) {
        // holofote da cabeça da lança iluminando o corte + fio de luzes da correia
        boomPt(m, 470, -70, TMP); const lx = TMP.x, ly = TMP.y; boomPt(m, BL + 30, 0, TMP);
        g.globalAlpha = 0.16 * n; g.fillStyle = C_WARM; g.beginPath(); g.moveTo(lx, ly); g.lineTo(TMP.x + 130, TMP.y - 150); g.lineTo(TMP.x + 130, TMP.y + 170); g.closePath(); g.fill(); g.globalAlpha = 1;
        Draw.light(g, lx, ly, 8, C_WARM, n, LTB);
        for (let x = 60; x < 470; x += 82) { boomPt(m, x, botChord(x) + 6, TMP); Draw.light(g, TMP.x, TMP.y, 4, C_WARM, n, LTS); }
        cabinPt(m, TMP);
        const hr = 60, pa0 = g.globalAlpha; g.globalAlpha = 0.5 * n; Draw.light(g, TMP.x, TMP.y + 50, 16, C_WARM, 1, { halo: 4.5, ol: 0 }); g.globalAlpha = pa0;
        g.save(); g.translate(TMP.x, TMP.y); g.rotate(m.cabS.x);
        g.globalAlpha = 0.35 * n; g.fillStyle = C_WARM; g.fillRect(-28, 30, 56, 36); g.globalAlpha = 1;
        komeO.pal = m.pilot; E.drawShiba(g, -4, 80, 'drive', t, komeO);
        Draw.box(g, -34, 66, 68, 14, PAL.ora, { ol: 0, top: false, r: 4 });
        g.restore();
      }
      boomPt(m, 410, -128, TMP); Draw.light(g, TMP.x, TMP.y, 5, PAL.red, (t * 0.9 + 0.6) % 1 < 0.5 ? 1 : 0, LTB);
      cabinPt(m, TMP); Draw.light(g, TMP.x - Math.sin(m.cabS.x) * 14, TMP.y + 14, 4, PAL.yel, m.rpm > 0.05 ? (t * 3 % 1 < 0.5 ? 1 : 0.2) : 0, LTS);
    }
    g.restore();
  }

  /* ---------------- medidor de Mordida (arco em volta da roda, em espaço de mundo) ---------------- */
  const TXT = { size: 14, col: PAL.goldL, sw: 4, align: 'center' };
  function gauge(g, m) {
    wheelWorld(m, TMP);
    const cx = TMP.x, cy = TMP.y, f = m.face, z = m.zoom, b = clamp(m.bite01, 0, 1), R = WR + 30 + 6 / z, lw = clamp(5 / z, 7, 26);
    const A0 = 1.25, A1 = -1.25, ang = v => { const a = A0 + (A1 - A0) * v; return f > 0 ? a : PI - a; };
    const arc = (v0, v1, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(cx, cy, R, ang(v0), ang(v1), f > 0); g.stroke(); };
    const pa0 = g.globalAlpha; g.globalAlpha = pa0 * clamp(m.rpm * 4, 0, 1); g.lineCap = 'butt';
    arc(-0.012, 1.012, LINE, lw + 4 / z);
    arc(0, 1, PAL.blkL, lw); arc(0, m.band[0] * 0.75, sh(PAL.blkL, 0.15), lw);
    arc(m.band[0], m.band[1], m.perfect ? PAL.grassL : PAL.grass, lw); arc(0.85, 1, PAL.red, lw);
    arc(0, b, 'rgba(255,250,238,.45)', lw * 0.36);
    const a = ang(b), nx = Math.cos(a), ny = Math.sin(a), r0 = R - lw * 0.9, r1 = R + lw * 0.9;
    g.lineCap = 'round'; g.strokeStyle = LINE; g.lineWidth = 6 / z; g.beginPath(); g.moveTo(cx + nx * r0, cy + ny * r0); g.lineTo(cx + nx * r1, cy + ny * r1); g.stroke();
    g.strokeStyle = PAL.cream; g.lineWidth = 3 / z; g.stroke();
    let txt = '', col = PAL.cream;
    if (m.stalled) { txt = 'TRAVOU!'; col = PAL.redL; }
    else if (m.perfect) { txt = 'MORDIDA PERFEITA'; col = PAL.goldL; }
    else if (b > 0.02) txt = Math.round(100 * (b < m.band[0] ? b / m.band[0] : m.band[1] / b)) + '% da mordida perfeita';
    if (txt) { TXT.size = (m.perfect ? 15 : 12) / z; TXT.col = col; TXT.sw = 4 / z; Draw.text(g, txt, cx + f * R * 0.15, cy - R - 16 / z, TXT); }
    g.globalAlpha = pa0;
  }

  G.Tools.bagger = {
    id: 'bagger', name: 'Bagger 293', kind: 'bagger', w: 1500, h: 700,
    meta: { zoom: 0.26, shake: 1, cycle: 1 / (0.33 * NB), boom: BL, wheelR: WR, pivot: [PX, PY - LIFT], luffMin: LMIN, luffMax: LMAX, maxCrawl: 70 },
    create, update, draw, glow, bite, dump, seat,
  };
})();
