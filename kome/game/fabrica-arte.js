/* Kome no Japão — fabrica-arte.js
   A ARTE da Fábrica KOME PACK (a simulação, o toque e o HUD ficam no fabrica.js).
   Galpão em vista 3/4 (chão visto de cima + parede do fundo de frente), tudo em pixel art na escala 2 (1 px de arte = 2 px
   do palco 960×540), contorno #3B2818, 3 tons por material. Nada aqui muda regra do jogo: são funções puras de desenho.
     G.FabArt.geo      medidas do palco (grid 8×6 com casas de 80×58, portas, esteiras das docas)
     G.FabArt.bg()     cenário fixo em cache (parede, janelas shoji, vigas, tábuas, sombras); .sun() luz do dia; .dusk() luz da tarde
     G.FabArt.item / .spr / .hat   sprites (itens, peças das máquinas, adereços, toucas)
     G.FabArt.belts(g, lista, t) · .strip() · .itemAt()   esteiras com volume, curva e ripas andando
     G.FabArt.panela / .moldadora / .pilao / .divisor (g, m, cx, by, t, o)   máquinas com operador
     G.FabArt.outside / .truck / .wall …   o que aparece pelas portas e as coisas vivas da parede */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, C = E.PAL, D = E.Draw, TAU = Math.PI * 2, INK = '#3B2818';
  const W = 960, H = 540, PX = 2;
  const geo = {
    W, H, GW: 8, GH: 6, CW: 80, CH: 57, GX: 160, GY: 130, WALL: 124,
    BH: 15, BV: 20, BT: 6,                                  // meia-largura da esteira deitada / em pé e a altura do "corpo"
    doorIn: { x: 12, y: 44, w: 138, h: 80 }, doorOut: { x: 810, y: 44, w: 138, h: 80 },
    feedX: 128, collX: 832,                                 // centro das esteiras das docas (entrada desce, venda sobe)
  };
  const { GW, GH, CW, CH, GX, GY, WALL, BH, BV, BT } = geo;
  const GR = GX + GW * CW, GB = GY + GH * CH;               // borda direita e de baixo do grid

  /* ---------- paleta do galpão (3 tons por material) ---------- */
  const K = {
    wood: '#A9763F', woodL: '#CF9E63', woodD: '#7A5228', woodDD: '#5E3E1E',
    brick: '#C0623A', brickL: '#DB8558', brickD: '#8F4426',
    stone: '#A39C8C', stoneL: '#CFC8B6', stoneD: '#77705F',
    clay: '#6E4B36', clayL: '#94694C', clayD: '#4E3324',
    steel: '#C3CBD4', steelL: '#E8EDF2', steelD: '#808A96', steelDD: '#5B6470',
    red: '#C8423A', redL: '#E8776A', redD: '#93302A',
    copper: '#D08A4A', copperL: '#EDB27A', copperD: '#9A5A2A',
    gold: '#F3C94A', goldL: '#FFE68A', goldD: '#B4852A',
    rice: '#FFFDF6', riceS: '#E6DCC4', riceD: '#CFC2A2', cream: '#FFFAEE',
    sack: '#D8C49A', sackL: '#EBDDB9', sackD: '#B89E6C',
    blk: '#3A332D', blkL: '#5A524A', dark: '#2A1A10',
    blue: '#3F5E92', blueL: '#6487C0', blueD: '#2C4470',
    green: '#7F9E5C', greenL: '#A9C08A', greenD: '#5D7A40',
    mochi: '#F8E8E2', mochiD: '#E2C4BA', pink: '#F4B8C5',
    card: '#D9A066', cardL: '#EBBE86', cardD: '#B07C46',
    paper: '#FFF1C2', paperL: '#FFF9DE', white: '#FFFFFF', glass: '#A8D8EA', glassD: '#6FAECB',
    fire: '#F28A2E', fireL: '#FFD35A', fireD: '#D9502A',
  };
  const SP = (name, w, h, fn) => E.sprite('fab2/' + name, w, h, fn);
  const ST = (name, txt, pal) => E.spriteText('fab2-' + name, txt, { pal: Object.assign({ Q: K.mochi, q: K.mochiD, X: K.goldL, D: K.card, d: K.cardD, L: K.cardL, H: K.copper, h: K.copperD, F: K.fireL, f: K.fire, U: K.blue, u: K.blueD, J: K.brick, j: K.brickD, I: K.clay, i: K.clayD }, pal || {}) });

  /* blit(g, sprite, x centro, y base, escala=2, {sx, sy, alpha, flip, rot}) */
  function blit(g, cv, x, y, s, o) {
    s = s || PX;
    const sx = (o && o.sx) || 1, sy = (o && o.sy) || 1, w = cv.width * s * sx, h = cv.height * s * sy;
    g.imageSmoothingEnabled = false;
    const al = o && o.alpha !== undefined ? o.alpha : 1, pa = g.globalAlpha;
    if (al !== 1) g.globalAlpha = pa * al;
    if (o && (o.flip || o.rot)) {
      g.save(); g.translate(Math.round(x), Math.round(y)); if (o.rot) g.rotate(o.rot); if (o.flip) g.scale(-1, 1);
      g.drawImage(cv, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h)); g.restore();
    } else g.drawImage(cv, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
    if (al !== 1) g.globalAlpha = pa;
  }
  function shadow(g, x, y, rx, ry, a) { g.fillStyle = 'rgba(46,26,10,' + (a === undefined ? 0.26 : a) + ')'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }

  /* ======================================================================
     ITENS (o que anda na esteira): reconhecíveis de longe
     ====================================================================== */
  const item = {
    raw: SP('i-raw', 13, 13, P => {            // saquinho de arroz com carimbo vermelho
      P.ell(6, 8, 5, 4, K.sack); P.rect(2, 8, 9, 3, K.sack); P.rect(4, 2, 5, 3, K.sack); P.rect(3, 1, 7, 1, K.sackL);
      P.rect(4, 4, 5, 1, K.red); P.rect(5, 7, 3, 3, K.red); P.set(6, 8, K.redL);
      P.rect(2, 10, 9, 1, K.sackD); P.rect(9, 6, 2, 4, K.sackD); P.set(3, 6, K.sackL).set(4, 6, K.sackL);
    }),
    gold: SP('i-gold', 13, 13, P => {          // saquinho dourado
      P.ell(6, 8, 5, 4, K.gold); P.rect(2, 8, 9, 3, K.gold); P.rect(4, 2, 5, 3, K.gold); P.rect(3, 1, 7, 1, K.goldL);
      P.rect(4, 4, 5, 1, K.red); P.rect(5, 7, 3, 3, K.cream);
      P.rect(2, 10, 9, 1, K.goldD); P.rect(9, 6, 2, 4, K.goldD); P.set(3, 6, K.goldL).set(4, 6, K.goldL).set(3, 7, K.white);
    }),
    cozido: SP('i-cozido', 14, 12, P => {      // tigela azul com montinho de arroz
      P.ell(7, 5, 5, 4, K.rice); P.set(5, 3, K.white).set(6, 2, K.white).set(9, 4, K.riceS).set(10, 5, K.riceS);
      P.poly([[1, 6], [12, 6], [10, 10], [3, 10]], K.blue); P.rect(1, 5, 12, 2, K.blueL); P.rect(4, 8, 2, 1, K.blueL); P.rect(5, 10, 4, 1, K.blueD); P.rect(9, 7, 2, 3, K.blueD);
    }),
    onigiri: SP('i-onigiri', 13, 13, P => {    // triângulo com faixa de nori
      P.poly([[6, 1], [11, 9], [10, 11], [2, 11], [1, 9]], K.rice); P.rect(5, 1, 3, 1, K.rice);
      P.rect(4, 7, 5, 5, K.blk); P.rect(4, 7, 5, 1, K.blkL); P.set(5, 3, K.white).set(4, 5, K.white);
      P.rect(9, 8, 2, 3, K.riceS); P.rect(2, 10, 2, 1, K.riceS);
    }),
    mochi: SP('i-mochi', 14, 11, P => {        // bolinho macio com uma florzinha rosa em cima
      P.ell(7, 6, 6, 4, K.mochi); P.rect(2, 6, 10, 3, K.mochi); P.rect(3, 9, 8, 1, K.mochiD); P.rect(10, 5, 2, 4, K.mochiD);
      P.rect(4, 3, 3, 1, K.white); P.set(3, 4, K.white); P.rect(6, 5, 2, 2, K.pink); P.set(8, 5, '#D98AA0');
    }),
    mochid: SP('i-mochid', 14, 11, P => {      // mochi dourado
      P.ell(7, 6, 6, 4, K.gold); P.rect(2, 6, 10, 3, K.gold); P.rect(3, 9, 8, 1, K.goldD); P.rect(10, 5, 2, 4, K.goldD);
      P.rect(4, 3, 3, 1, K.goldL); P.set(3, 4, K.white).set(4, 3, K.white); P.rect(6, 5, 2, 2, K.cream);
    }),
    box: SP('i-box', 14, 13, P => {            // caixa de papelão KOME PACK
      P.rect(1, 3, 12, 9, K.card); P.rect(1, 2, 12, 2, K.cardL); P.rect(1, 10, 12, 2, K.cardD); P.rect(11, 4, 2, 6, K.cardD);
      P.rect(6, 2, 2, 10, K.cream); P.ell(4, 7, 1.6, 1.6, K.red);
    }),
  };
  item.sack = SP('i-sack', 18, 16, P => {     // sacão de arroz (pilhas das docas)
    P.rrect(1, 3, 16, 12, 4, K.sack); P.rect(6, 1, 6, 3, K.sack); P.rect(5, 1, 8, 1, K.sackL); P.rect(6, 4, 6, 1, K.red);
    P.rect(7, 8, 4, 4, K.red); P.rect(8, 9, 2, 2, K.cream); P.rect(2, 13, 14, 2, K.sackD); P.rect(14, 6, 3, 7, K.sackD); P.rect(3, 6, 3, 1, K.sackL);
  });
  const SPARK = ST('spark', `
    .W.
    WXW
    .W.`);

  /* ======================================================================
     TOUCAS E FAIXAS DOS OPERADORES (escala do shiba: 1 px = 1 px)
     ====================================================================== */
  const hat = {
    toque: ST('toque', `
      ..WWW.WWW..
      .WWWWWWWWW.
      WWWWWWWWWWW
      WWWWWWWWWWW
      .WWWWWWWWW.
      ..wWWWWWw..
      ..WWWWWWW..
      ..WWWWWWW..
      ..wwwwwww..`),
    faixa: ST('faixa', `
      ...........WW
      WWWWWWWWWWWW.
      WWWWRRWWWWWWW
      wwwwwwwwwww.W`),
    bone: ST('bone', `
      ...UUUUUU...
      ..UUUUUUUU..
      .UUUUUWUUUU.
      .UUUUUUUUUUu
      uuuuuuuuuuuuuu`),
    palha: ST('palha', `
      .....TT.....
      ...TTTTTT...
      ..TTTTTTTT..
      .TttttttttT.
      TTTTTTTTTTTT`),
  };
  const ANC = { x: 0, y: 0 };
  /* operador(g, x, y, pose, t, {pal, face, scale, hat:'toque'|'faixa'|'bone'|'palha'|null}): shiba com touca (pés em x,y) */
  function worker(g, x, y, pose, t, o) {
    o = o || {};
    const sc = o.scale || 1, face = o.face || 1, cap = o.hat === undefined ? 'toque' : o.hat;
    const tt = E.drawShiba.frameT ? E.drawShiba.frameT(t, null, pose) : t;
    E.drawShiba(g, x, y, pose, t, { scale: sc, pal: o.pal || 'kome', face, hat: !cap, shadow: o.shadow !== false, alpha: o.alpha });
    if (!cap || !hat[cap] || pose === 'sleep' || pose === 'lie') return;
    E.shibaAnchor(pose, tt, 'head', ANC, { hat: false });
    const cv = hat[cap], off = cap === 'faixa' ? -3 : cap === 'bone' ? -6 : -7;
    g.imageSmoothingEnabled = false;
    const w = cv.width * sc, h = cv.height * sc, hx = x + ANC.x * sc * face, hy = y + ANC.y * sc + off * sc;
    if (face < 0) { g.save(); g.translate(Math.round(hx), 0); g.scale(-1, 1); g.drawImage(cv, Math.round(-w / 2), Math.round(hy - h / 2), w, h); g.restore(); }
    else g.drawImage(cv, Math.round(hx - w / 2), Math.round(hy - h / 2), w, h);
  }

  /* ======================================================================
     PEÇAS DAS MÁQUINAS  (tier 0..3 = níveis 1, 3, 6 e 10: ganham chaminé, cobre, tamanho e ouro)
     ====================================================================== */
  const tierOf = lvl => (lvl >= 10 ? 3 : lvl >= 6 ? 2 : lvl >= 3 ? 1 : 0);
  // fogão de tijolo (kamado) da Panela
  // inv = peças de lado trocado (chaminé e reloginho), com a LUZ no mesmo lado: é a máquina virada pra esquerda (rot 2).
  // Antes ela era o desenho espelhado inteiro e a sombra ia junto pro lado errado.
  const stove = (t, back, inv) => SP('stove' + t + (back ? 'b' : '') + (inv ? 'i' : ''), 40, 60, P => {
    const cx = 20, by = 58, w = 13 + [0, 1, 3, 4][t], top = by - 17 - [0, 1, 3, 5][t];
    if (t >= 1) {                                             // chaminé de lata atrás
      const ch = 16 + t * 4, x = inv ? cx - w + 1 : cx + w - 6;
      P.rect(x, top - ch, 5, ch + 2, K.steel); P.rect(x, top - ch, 1, ch + 2, K.steelL); P.rect(x + 4, top - ch, 1, ch + 2, K.steelD);
      P.rect(x - 1, top - ch - 2, 7, 3, K.steelD); P.rect(x, top - ch + 6, 5, 2, t >= 3 ? K.gold : K.red);
      if (t >= 2) { P.rect(x - 1, top - ch - 5, 7, 1, K.steelDD); P.rect(x + 1, top - ch - 4, 3, 2, K.steelD); P.rect(x - 2, top - ch - 6, 9, 1, K.steel); }
    }
    P.rect(cx - w - 1, by - 3, 2 * w + 2, 3, K.stoneD); P.rect(cx - w - 1, by - 3, 2 * w + 2, 1, K.stone);
    P.rect(cx - w, top, 2 * w, by - 3 - top, K.brick);
    for (let r = 0, y = top + 3; y < by - 3; y += 4, r++) {
      P.rect(cx - w, y, 2 * w, 1, K.brickD);
      for (let x = cx - w + (r % 2 ? 2 : 5); x < cx + w; x += 6) P.rect(x, y - 3, 1, 3, K.brickD);
    }
    for (const [x, y] of [[cx - w + 1, top], [cx + 4, top + 4], [cx - 9, top + 8], [cx + w - 5, top + 8]]) P.rect(x, y, 3, 3, K.brickL);
    P.rect(cx + w - 2, top, 2, by - 3 - top, K.brickD);
    P.rect(cx - w - 1, top - 2, 2 * w + 2, 2, t >= 3 ? K.gold : K.stoneL); P.rect(cx - w - 1, top - 1, 2 * w + 2, 1, t >= 3 ? K.goldD : K.stone);
    if (!back) { P.rrect(cx - 6, by - 13, 12, 10, 4, K.stoneD); P.rrect(cx - 5, by - 12, 10, 9, 3, K.dark); P.rect(cx - 5, by - 6, 10, 3, K.dark); }   // boca do fogo (de costas: só tijolo, a moega entra por cima)
    if (t >= 2) { const gx = inv ? cx + w - 5 : cx - w + 4; P.ell(gx, top + 5, 2.5, 2.5, K.cream); P.set(gx, top + 5, K.red); P.set(gx + 1, top + 4, K.blk); }   // reloginho de pressão
    if (t >= 3) { P.rect(cx - w, by - 4, 2 * w, 1, K.gold); }
  });
  const pot = t => SP('pot' + t, 40, 18, P => {             // donabe
    const cx = 20, w = 12 + [0, 1, 3, 4][t];
    P.rrect(cx - w, 3, 2 * w, 13, 5, K.clay); P.rect(cx - w + 1, 2, 2 * w - 2, 2, K.clayL);
    P.rect(cx - w + 1, 6, 2 * w - 2, 2, K.clayL); P.rect(cx - w + 2, 13, 2 * w - 4, 2, K.clayD); P.rect(cx + w - 3, 5, 2, 9, K.clayD);
    P.rect(cx - w - 2, 6, 2, 3, K.clayD); P.rect(cx + w, 6, 2, 3, K.clayD);
    if (t >= 1) P.rect(cx - w + 1, 10, 2 * w - 2, 1, t >= 3 ? K.gold : K.copper);
    if (t >= 2) { P.rect(cx - w + 1, 4, 2 * w - 2, 1, t >= 3 ? K.goldL : K.copperL); }
  });
  const lid = t => SP('lid' + t, 30, 12, P => {
    const cx = 15, w = 10 + [0, 1, 3, 4][t];
    P.poly([[cx - w, 10], [cx - w + 2, 5], [cx - 4, 3], [cx + 4, 3], [cx + w - 2, 5], [cx + w, 10]], K.clayL);
    P.rect(cx - w + 3, 6, 2 * w - 6, 1, K.cream); P.rect(cx - w + 1, 9, 2 * w - 2, 1, K.clay); P.rect(cx + w - 4, 5, 2, 4, K.clay);
    P.rect(cx - 2, 1, 4, 3, t >= 3 ? K.gold : t >= 2 ? K.copper : K.clayD); P.rect(cx - 2, 1, 4, 1, t >= 3 ? K.goldL : t >= 2 ? K.copperL : K.clay);
  });
  const flame = f => SP('flame' + f, 12, 11, P => {
    const pts = [[[1, 10], [2, 5], [4, 7], [5, 2], [7, 6], [9, 3], [10, 10]], [[1, 10], [3, 4], [4, 7], [6, 1], [8, 6], [9, 4], [10, 10]], [[1, 10], [2, 6], [5, 3], [6, 6], [8, 2], [9, 6], [10, 10]]][f];
    P.poly(pts, K.fire); P.poly([[3, 10], [4, 7], [6, 5], [8, 7], [8, 10]], K.fireL); P.rect(5, 8, 2, 2, K.white);
  }, false);
  const paddle = SP('paddle', 7, 22, P => { P.rect(3, 6, 1, 15, K.woodL); P.rrect(1, 1, 5, 7, 2, K.woodL); P.rect(4, 2, 1, 5, K.wood); });

  // prensa da Moldadora
  const press = (t, back, inv) => SP('press' + t + (back ? 'b' : '') + (inv ? 'i' : ''), 44, 58, P => {
    const cx = 22, by = 56, sd = inv ? -1 : 1, X = (dx, w) => (inv ? cx - dx - (w || 1) : cx + dx);   // X(dx, largura): mesma peça do outro lado
    P.rect(cx - 15, by - 2, 30, 2, K.woodDD);
    P.rect(cx - 14, by - 11, 28, 9, K.wood); P.rect(cx - 14, by - 11, 28, 2, K.woodL); P.rect(cx - 14, by - 4, 28, 2, K.woodD); P.rect(cx + 11, by - 9, 3, 6, K.woodD);
    P.rect(cx - 6, by - 9, 1, 6, K.woodD); P.rect(cx + 6, by - 9, 1, 6, K.woodD);
    if (!back) {
      P.rect(cx - 5, by - 9, 10, 5, K.dark); P.rect(cx - 6, by - 4, 12, 2, K.steelD); P.rect(cx - 6, by - 4, 12, 1, K.steel);        // boca de saída + bandeja
      P.ell(cx - 10, by - 7, 2, 2, K.red); P.ell(cx + 10, by - 7, 2, 2, K.red);
    } else { for (const x of [cx - 11, cx - 4, cx + 3, cx + 10]) P.set(x, by - 7, K.woodDD); }                                        // de costas: tábua pregada
    P.rect(cx - 16, by - 14, 32, 3, K.steel); P.rect(cx - 16, by - 14, 32, 1, K.steelL); P.rect(cx - 16, by - 12, 32, 1, K.steelD);   // mesa de aço
    for (const x of [cx - 14, cx + 11]) { P.rect(x, by - 35, 3, 21, K.steelD); P.rect(x, by - 35, 1, 21, K.steel); }                   // colunas
    P.rect(cx - 16, by - 40, 32, 6, t >= 3 ? K.gold : K.red); P.rect(cx - 16, by - 40, 32, 1, t >= 3 ? K.goldL : K.redL); P.rect(cx - 16, by - 35, 32, 1, t >= 3 ? K.goldD : K.redD);
    for (const x of [cx - 14, cx - 2, cx + 1, cx + 13]) P.set(x, by - 38, K.cream);
    const hw = 8 + [0, 1, 3, 4][t], hh = 7 + [0, 1, 3, 5][t];                                                                          // funil de arroz
    P.poly([[cx - hw, by - 40 - hh], [cx + hw, by - 40 - hh], [cx + 4, by - 40], [cx - 4, by - 40]], K.steel);
    P.rect(cx - hw - 1, by - 41 - hh, 2 * hw + 2, 2, K.steelD); P.rect(cx - hw + 1, by - 40 - hh, 2 * hw - 2, 2, K.rice); P.rect(cx - hw + 2, by - 39 - hh, 4, 1, K.white);
    P.rect(cx + 2, by - 38 - hh + 3, 2, Math.max(1, hh - 4), K.steelD);
    if (t >= 1) {                                                                                                                      // cano de cobre + volante
      P.rect(X(14, 2), by - 38, 2, 25, K.copper); P.rect(X(14, 2), by - 38, 1, 25, K.copperL); P.rect(X(13, 4), by - 28, 4, 2, K.copperD); P.rect(X(13, 4), by - 19, 4, 2, K.copperD);
      P.ring(cx - 17 * sd, by - 25, 4, 1.4, K.copper); P.set(cx - 17 * sd, by - 25, K.copperD);
    }
    if (t >= 2) { P.ell(cx - 10 * sd, by - 44, 3, 3, K.cream); P.set(cx - 10 * sd, by - 44, K.red); P.set(cx - 10 * sd + 1, by - 45, K.blk); P.rect(X(9, 3), by - 43, 3, 3, K.goldL); P.rect(X(9, 3), by - 40, 3, 1, K.steelD); }
    if (t >= 3) { P.rect(cx - 16, by - 14, 32, 1, K.goldL); P.rect(cx - 14, by - 11, 28, 1, K.gold); P.rect(X(16, 3), by - 47, 3, 9, K.steel); P.rect(X(15, 5), by - 49, 5, 2, K.steelD); }
  });
  const pressHead = SP('presshead', 18, 9, P => { P.rect(1, 1, 16, 4, K.steelD); P.rect(1, 1, 16, 1, K.steel); P.poly([[3, 5], [15, 5], [12, 8], [6, 8]], K.steel); P.rect(7, 2, 4, 2, K.red); });

  // usu (pilão de madeira) e baldinho
  const usu = t => SP('usu' + t, 44, 44, P => {
    const cx = 22, by = 42, w = 14 + [0, 1, 3, 4][t], h = 24 + [0, 1, 3, 5][t];
    if (t >= 2) { P.rect(cx - w - 2, by - 3, 2 * w + 4, 3, K.stoneD); P.rect(cx - w - 2, by - 3, 2 * w + 4, 1, K.stoneL); }
    const b0 = t >= 2 ? by - 3 : by;
    P.poly([[cx - w, b0 - h + 2], [cx + w, b0 - h + 2], [cx + w - 3, b0 - 10], [cx + w - 1, b0], [cx - w + 1, b0], [cx - w + 3, b0 - 10]], K.wood);
    for (const dx of [-8, -2, 5, 10]) P.rect(cx + dx, b0 - h + 6, 1, h - 8, K.woodD);
    P.rect(cx + w - 5, b0 - h + 6, 2, h - 7, K.woodD); P.rect(cx - w + 3, b0 - h + 6, 2, h - 8, K.woodL);
    P.rect(cx - w + 1, b0 - h + 7, 2 * w - 2, 2, t >= 3 ? K.gold : K.blkL); P.rect(cx - w + 2, b0 - h + 7, 5, 1, t >= 3 ? K.goldL : '#7A7068'); P.rect(cx - w + 2, b0 - 4, 2 * w - 4, 2, t >= 3 ? K.gold : K.blkL);
    P.ell(cx, b0 - h + 2, w, 4, K.woodL); P.ell(cx, b0 - h + 2, w - 3, 2.5, K.woodDD);
    if (t >= 1) {                                                                         // corda sagrada com papeizinhos
      P.rect(cx - w + 2, b0 - 12, 2 * w - 4, 2, t >= 3 ? K.gold : K.sack); P.rect(cx - w + 2, b0 - 11, 2 * w - 4, 1, t >= 3 ? K.goldD : K.sackD);
      for (const dx of [-7, 0, 7]) { P.rect(cx + dx, b0 - 10, 2, 2, K.white); P.rect(cx + dx + 1, b0 - 8, 2, 2, K.white); }
    }
    if (t >= 3) { P.rect(cx - w + 1, b0 - h + 5, 2 * w - 2, 1, K.gold); P.rect(cx - w + 2, b0 - 2, 2 * w - 4, 1, K.gold); }
  });
  const bucket = SP('bucket', 12, 11, P => { P.poly([[1, 2], [10, 2], [9, 10], [2, 10]], K.woodL); P.rect(1, 4, 10, 1, K.woodD); P.rect(2, 8, 8, 1, K.woodD); P.rect(2, 2, 8, 1, K.glass); P.rect(8, 3, 1, 6, K.wood); });

  // divisor: mesa giratória com cancela
  const turn = SP('turn', 34, 22, P => {
    P.ell(17, 13, 14, 7, K.steelDD); P.rect(3, 9, 28, 4, K.steelDD); P.ell(17, 9, 14, 7, K.steel); P.ell(17, 9, 11, 5, K.steelL); P.ell(17, 9, 8, 3.5, K.steel);
    P.ell(17, 9, 3, 2, K.red); P.set(16, 8, K.redL);
    for (const [x, y] of [[6, 9], [28, 9], [17, 4], [17, 14]]) P.set(x, y, K.steelD);
  });
  // peças que mostram pra onde a máquina está virada: calha de saída (de lado, de frente, de costas), plaquinha de seta e moega
  const chute = SP('chute', 13, 11, P => {                   // de lado: desce pra ESQUERDA
    P.rect(8, 6, 2, 3, K.steelDD); P.poly([[11, 1], [11, 6], [1, 9], [1, 4]], K.steelD); P.poly([[11, 2], [11, 4], [1, 7], [1, 5]], K.steelL);
    P.rect(5, 4, 2, 2, K.gold);
  });
  const chuteF = SP('chutef', 16, 10, P => {                 // de frente: desce pra quem olha (seta pra baixo)
    P.poly([[4, 1], [11, 1], [14, 8], [1, 8]], K.steel); P.rect(4, 1, 8, 1, K.steelDD); P.line(4, 1, 1, 8, 1, K.steelL); P.line(11, 1, 14, 8, 1, K.steelD);
    P.rect(2, 8, 12, 1, K.steelDD); P.rect(5, 3, 6, 1, K.gold); P.rect(6, 4, 4, 1, K.gold); P.rect(7, 5, 2, 2, K.gold);
  });
  const chuteB = SP('chuteb', 16, 10, P => {                 // de costas: sobe pro fundo (seta pra cima)
    P.poly([[4, 1], [11, 1], [14, 8], [1, 8]], K.steelD); P.rect(4, 1, 8, 1, K.steelL); P.line(4, 1, 1, 8, 1, K.steel); P.line(11, 1, 14, 8, 1, K.steelDD);
    P.rect(7, 2, 2, 2, K.gold); P.rect(6, 4, 4, 1, K.gold); P.rect(5, 5, 6, 1, K.gold);
  });
  const plate = SP('plate', 9, 9, P => {                     // plaquinha dourada, seta pra ESQUERDA
    P.rect(1, 1, 7, 7, K.gold); P.rect(1, 1, 7, 1, K.goldL); P.rect(1, 7, 7, 1, K.goldD);
    for (const [x, y] of [[5, 2], [4, 3], [3, 4], [4, 5], [5, 6]]) { P.set(x, y, INK); P.set(x + 1, y, INK); }
  });
  const plateU = SP('plateu', 9, 9, P => {                   // seta pra CIMA
    P.rect(1, 1, 7, 7, K.gold); P.rect(1, 1, 7, 1, K.goldL); P.rect(1, 7, 7, 1, K.goldD);
    for (const [x, y] of [[2, 5], [3, 4], [4, 3], [5, 4], [6, 5]]) { P.set(x, y, INK); P.set(x, y + 1, INK); }
  });
  const hopper = SP('hopper', 16, 12, P => {                 // moega (onde o operador despeja o arroz), vista de costas
    P.poly([[1, 2], [14, 2], [11, 10], [4, 10]], K.steel); P.rect(1, 1, 14, 2, K.steelD); P.rect(2, 1, 12, 1, K.steelL);
    P.rect(3, 2, 10, 2, K.rice); P.rect(4, 2, 3, 1, K.white); P.rect(10, 4, 2, 5, K.steelD); P.rect(4, 4, 1, 5, K.steelL);
  });
  const flag = SP('flag', 12, 9, P => { P.poly([[1, 1], [10, 4], [1, 7]], K.gold); P.rect(1, 1, 2, 7, K.goldD); P.set(4, 3, K.goldL).set(5, 4, K.goldL); });

  /* ======================================================================
     ADEREÇOS DO GALPÃO
     ====================================================================== */
  const spr = {
    crate: SP('crate', 22, 20, P => { P.rect(1, 2, 20, 17, K.wood); P.rect(1, 2, 20, 2, K.woodL); P.rect(1, 16, 20, 3, K.woodD); P.rect(1, 2, 2, 17, K.woodD); P.rect(19, 2, 2, 17, K.woodD); P.line(3, 15, 18, 5, 1.6, K.woodD); P.rect(8, 8, 6, 5, K.cream); P.ell(11, 10, 1.4, 1.4, K.red); }),
    pallet: SP('pallet', 44, 8, P => { P.rect(1, 1, 42, 2, K.woodL); P.rect(1, 3, 42, 1, K.woodD); for (const x of [2, 19, 37]) P.rect(x, 4, 5, 3, K.wood); }),
    plant: SP('plant', 20, 28, P => {
      P.poly([[5, 18], [15, 18], [13, 27], [7, 27]], K.brick); P.rect(4, 17, 12, 2, K.brickL); P.rect(12, 19, 2, 7, K.brickD);
      P.ell(10, 10, 7, 6, K.green); P.ell(6, 12, 4, 4, K.greenD); P.ell(13, 7, 4, 4, K.greenL); P.ell(8, 6, 3, 3, K.greenL); P.rect(9, 14, 2, 4, K.woodD); P.set(13, 12, K.pink).set(6, 8, K.pink);
    }),
    tanuki: SP('tanuki', 22, 28, P => {      // estátua de tanuki com chapéu de palha (sorte nos negócios)
      P.ell(11, 19, 8, 8, '#A8773F'); P.ell(11, 21, 5, 5, K.cream); P.ell(11, 10, 6, 5, '#A8773F'); P.ell(11, 11, 4, 3, K.cream);
      P.rect(7, 9, 3, 2, K.blk); P.rect(12, 9, 3, 2, K.blk); P.set(8, 9, K.white).set(13, 9, K.white); P.set(11, 12, K.blk);
      P.poly([[2, 7], [11, 1], [20, 7]], K.sack); P.rect(3, 7, 16, 1, K.sackD); P.rect(4, 26, 5, 2, '#8A5E30'); P.rect(13, 26, 5, 2, '#8A5E30'); P.rect(17, 15, 3, 6, K.clayL);
    }),
    cat0: ST('cat0', `
      ...........
      .N.N.......
      .NNNN.NNNN.
      .NNNNNNNNNN
      .NNNNNNNNNN
      ..NNNNNNNN.`, { N: '#5A5048', n: '#3E3630' }),
    cat1: ST('cat1', `
      .N.N.......
      .NNNN.NNN..
      .NNNNNNNNN.
      .NNNNNNNNNN
      .NNNNNNNNNN
      ..NNNNNNNN.`, { N: '#5A5048', n: '#3E3630' }),
    lantern: SP('lantern', 12, 20, P => { P.rect(5, 0, 2, 3, K.blk); P.rect(3, 3, 6, 2, K.blk); P.rrect(1, 5, 10, 11, 3, K.red); P.rect(2, 7, 8, 1, K.redD); P.rect(2, 10, 8, 1, K.redD); P.rect(2, 13, 8, 1, K.redD); P.rect(3, 6, 2, 8, K.redL); P.rect(3, 16, 6, 2, K.blk); P.rect(5, 18, 2, 2, K.gold); }),
    clock: SP('clock', 16, 16, P => { P.ell(8, 8, 7, 7, K.woodD); P.ell(8, 8, 5.5, 5.5, K.cream); for (const [x, y] of [[8, 3], [13, 8], [8, 13], [3, 8]]) P.set(x, y, K.blk); }, true),
    jar: SP('jar', 10, 12, P => { P.rrect(1, 3, 8, 8, 2, K.blueL); P.rect(2, 1, 6, 2, K.wood); P.rect(2, 5, 6, 3, K.cream); P.rect(7, 4, 1, 6, K.blue); }),
    table: SP('table', 40, 20, P => { P.rect(1, 1, 38, 4, K.woodL); P.rect(1, 4, 38, 2, K.wood); P.rect(3, 6, 3, 13, K.woodD); P.rect(34, 6, 3, 13, K.woodD); P.rect(6, 11, 28, 2, K.woodD); }),
    scale: SP('scale', 16, 14, P => { P.rect(2, 9, 12, 4, K.steelD); P.rect(2, 9, 12, 1, K.steel); P.rect(1, 6, 14, 2, K.steel); P.rect(7, 8, 2, 1, K.steelD); P.ell(8, 11, 2, 1.5, K.cream); }),
    truck: SP('truck', 56, 32, P => {        // kei-truck branco, de lado, olhando pra direita
      P.rect(2, 20, 50, 3, K.steelDD);                                                    // chassi
      P.rect(1, 12, 30, 8, K.white); P.rect(1, 12, 30, 1, K.steelL); P.rect(1, 18, 30, 2, K.steel); for (const x of [8, 16, 24]) P.rect(x, 13, 1, 6, K.steel);   // carroceria
      P.rect(1, 10, 1, 3, K.steelD); P.rect(30, 6, 2, 14, K.steel);
      P.poly([[32, 20], [32, 5], [45, 5], [51, 12], [53, 14], [53, 20]], K.white); P.rect(33, 5, 12, 1, K.steelL);
      P.poly([[39, 7], [45, 7], [49, 12], [39, 12]], K.glass); P.rect(39, 7, 2, 5, K.glassD); P.rect(34, 7, 4, 5, K.glass);
      P.rect(33, 14, 18, 2, K.red); P.rect(41, 16, 1, 4, K.steel); P.rect(44, 13, 3, 1, K.steelD); P.rect(51, 15, 2, 2, K.goldL); P.rect(50, 19, 4, 2, K.steelD);
      for (const x of [10, 43]) { P.ell(x, 25, 5, 5, K.blk); P.ell(x, 25, 2.5, 2.5, K.steel); P.set(x, 25, K.steelD); }
      P.rect(4, 20, 14, 2, K.blkL); P.rect(37, 20, 12, 2, K.blkL);
    }),
    lock: ST('lock', `
      ..SSS..
      .S...S.
      .S...S.
      YYYYYYY
      YYYNYYY
      YYYNYYy
      yyyyyyy`),
    eraser: ST('eraser', `
      .....PPPP
      ....PPPPP
      ...PPPPP.
      ..WPPPP..
      .WWWPP...
      WWWWW....
      WWWW.....`),
    undo: ST('undo', `
      ...Y.....
      ..YY.....
      .YYYYYYY.
      ..YY....Y
      ...Y....Y
      ........Y
      ...YYYYY.`),
    coin: SP('coin', 11, 11, P => { P.ell(5, 5, 4.5, 4.5, K.gold); P.ell(5, 5, 3, 3, K.goldL); P.rect(5, 3, 1, 5, K.goldD); P.rect(4, 4, 3, 1, K.goldD); P.rect(4, 6, 3, 1, K.goldD); }),
    up: SP('up', 13, 13, P => { P.ell(6, 6, 5.5, 5.5, K.green); P.ell(6, 5, 4.5, 4, K.greenL); P.ell(6, 6, 4.5, 4.5, '#6FAE4E'); P.poly([[6, 2], [10, 6], [2, 6]], K.white); P.rect(5, 6, 3, 4, K.white); }),
  };

  /* ======================================================================
     CENÁRIO FIXO  (parede + chão em baixa resolução 480×270, ampliado 2×; luz e sombra por cima em resolução cheia)
     ====================================================================== */
  const WIN = [206, 362, 598, 754];                         // x do centro das janelas (palco)
  const LAMPS = [164, 406, 554, 796];                       // lanternas penduradas na viga
  let bgCv = null, sunCv = null, duskCv = null;
  function mk() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
  function paintBg() {
    const lo = document.createElement('canvas'); lo.width = W / 2; lo.height = H / 2;
    const b = lo.getContext('2d'), R = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(x, y, w, h); }, rng = E.RNG(11);
    const wy = WALL / 2;                                     // 56
    // ---- chão de tábuas (corridas na horizontal, juntas desencontradas, brilho na borda de cima)
    R(0, wy, 480, 270 - wy, '#C99B62');
    for (let y = wy, i = 0; y < 270; y += 7, i++) {
      let x = -((i * 53) % 47);
      while (x < 480) {
        const len = 30 + Math.floor(rng() * 44), tone = rng();
        R(x, y, len, 6, tone < 0.28 ? '#D6A970' : tone < 0.72 ? '#CC9D63' : '#C2925A');
        R(x, y, len, 1, tone < 0.28 ? '#E2B983' : '#D9AD76');
        if (rng() < 0.3) R(x + 4 + Math.floor(rng() * Math.max(1, len - 14)), y + 2 + Math.floor(rng() * 3), 4 + Math.floor(rng() * 7), 1, '#B98A52');
        if (rng() < 0.22) R(x + 3 + Math.floor(rng() * Math.max(1, len - 8)), y + 3, 2, 2, '#A97C48');
        R(x + len - 1, y, 1, 6, '#A97C48'); R(x + len - 2, y + 3, 1, 1, '#8E6638');
        x += len;
      }
      R(0, y + 6, 480, 1, '#A87A46');
    }
    // ---- parede do fundo: caibros escuros no alto (o HUD mora ali), viga, reboco, lambri de madeira
    R(0, 0, 480, 22, '#3A2516');
    for (let x = -4; x < 480; x += 22) { R(x + 8, 0, 6, 18, '#4C311E'); R(x + 8, 0, 1, 18, '#5E3E26'); R(x + 13, 0, 1, 18, '#2E1C10'); }
    R(0, 16, 480, 6, '#7A5228'); R(0, 16, 480, 1, '#A47440'); R(0, 21, 480, 1, '#4A2E18');
    for (let x = 14; x < 480; x += 44) { R(x, 18, 2, 2, '#4A2E18'); }
    R(0, 22, 480, 28, '#EDDFBF');
    for (let i = 0; i < 110; i++) R(Math.floor(rng() * 478), 23 + Math.floor(rng() * 26), 2 + Math.floor(rng() * 4), 1, rng() < 0.5 ? '#E4D3AE' : '#F4E9CE');
    R(0, 22, 480, 2, '#D2BE98'); R(0, 24, 480, 1, '#E0CFAB');
    R(0, 50, 480, 12, '#A9763F');
    for (let x = 0; x < 480; x += 8) { R(x, 51, 1, 11, '#8E6232'); R(x + 1, 51, 1, 11, '#BA8548'); }
    R(0, 50, 480, 1, '#D2A262'); R(0, 51, 480, 1, '#7A5228'); R(0, 60, 480, 2, '#5E3E1E');
    for (const px of [123, 159, 202, 274, 319, 355]) { R(px, 22, 4, 40, '#7A5228'); R(px, 22, 1, 40, '#9A6C38'); R(px + 3, 22, 1, 40, '#5E3E1E'); }
    // ---- janelas shoji (papel + treliça) com parapeito
    for (const wxS of WIN) {
      const x = Math.round(wxS / 2) - 16;
      R(x - 2, 25, 36, 25, '#5E3E1E'); R(x - 1, 26, 34, 23, '#8E6232');
      R(x, 27, 32, 21, K.paper); R(x, 27, 32, 7, K.paperL); R(x, 43, 32, 5, '#F6E3AE');
      for (const dx of [7, 15, 16, 24]) R(x + dx, 27, 1, 21, '#B98A4A');
      for (const dy of [6, 13]) R(x, 27 + dy, 32, 1, '#B98A4A');
      R(x - 3, 50, 38, 2, '#C99458'); R(x - 3, 52, 38, 1, '#7A5228');
    }
    // ---- prateleira de parede (os potes e sacos entram depois, em sprite)
    R(324, 42, 30, 2, '#7A5228'); R(324, 42, 30, 1, '#A47440'); R(326, 44, 2, 3, '#5E3E1E'); R(350, 44, 2, 3, '#5E3E1E');
    // ---- portas das docas: batente grosso e soleira de pedra (o buraco é recortado depois)
    for (const d of [geo.doorIn, geo.doorOut]) {
      const x = d.x / 2, w = d.w / 2, y = d.y / 2;
      R(x - 4, y - 3, w + 8, wy - y + 3, '#5E3E1E'); R(x - 3, y - 2, w + 6, 2, '#8E6232'); R(x - 3, y - 2, 2, wy - y + 2, '#8E6232'); R(x + w + 1, y - 2, 2, wy - y + 2, '#7A5228');
      R(x - 5, wy - 1, w + 10, 3, K.stone); R(x - 5, wy - 1, w + 10, 1, K.stoneL); R(x - 5, wy + 2, w + 10, 1, K.stoneD);
    }
    // ---- amplia 2× e recorta as portas
    bgCv = mk(); const g = bgCv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(lo, 0, 0, W, H);
    for (const d of [geo.doorIn, geo.doorOut]) g.clearRect(d.x, d.y, d.w, d.h);
    // coisas nas prateleiras, vasos e caixas encostados na parede
    blit(g, item.sack, 666, 84); blit(g, item.box, 694, 84);
    // sombra de contato: parede/chão, cantos e a frente do palco (dá o volume do galpão)
    let gr = g.createLinearGradient(0, WALL, 0, WALL + 34); gr.addColorStop(0, 'rgba(58,30,10,.42)'); gr.addColorStop(1, 'rgba(58,30,10,0)'); g.fillStyle = gr; g.fillRect(0, WALL, W, 34);
    gr = g.createLinearGradient(0, 0, 46, 0); gr.addColorStop(0, 'rgba(58,30,10,.30)'); gr.addColorStop(1, 'rgba(58,30,10,0)'); g.fillStyle = gr; g.fillRect(0, WALL, 46, H - WALL);
    gr = g.createLinearGradient(W, 0, W - 46, 0); gr.addColorStop(0, 'rgba(58,30,10,.30)'); gr.addColorStop(1, 'rgba(58,30,10,0)'); g.fillStyle = gr; g.fillRect(W - 46, WALL, 46, H - WALL);
    gr = g.createLinearGradient(0, H - 90, 0, H); gr.addColorStop(0, 'rgba(58,30,10,0)'); gr.addColorStop(1, 'rgba(58,30,10,.34)'); g.fillStyle = gr; g.fillRect(0, H - 90, W, 90);
    gr = g.createLinearGradient(0, 0, 0, 30); gr.addColorStop(0, 'rgba(20,10,4,.45)'); gr.addColorStop(1, 'rgba(20,10,4,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 30);
    // caminho gasto (mais claro) onde o arroz entra e sai
    g.fillStyle = 'rgba(255,238,200,.10)';
    for (const x of [geo.feedX, geo.collX]) { g.beginPath(); g.ellipse(x, 300, 54, 190, 0, 0, TAU); g.fill(); }
    // marcas das casas: xadrez bem leve + cruzinhas nos cantos (fita no chão)
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      g.fillStyle = (x + y) & 1 ? 'rgba(255,244,214,.085)' : 'rgba(90,52,20,.045)';
      g.fillRect(GX + x * CW + 3, GY + y * CH + 3, CW - 6, CH - 6);
    }
    for (let y = 0; y <= GH; y++) for (let x = 0; x <= GW; x++) {
      const px = GX + x * CW, py = GY + y * CH;
      g.fillStyle = 'rgba(94,56,24,.34)'; g.fillRect(px - 5, py - 1, 10, 2); g.fillRect(px - 1, py - 4, 2, 8);
      g.fillStyle = 'rgba(255,236,190,.30)'; g.fillRect(px - 5, py + 1, 10, 1);
    }
    g.strokeStyle = 'rgba(243,201,74,.30)'; g.lineWidth = 2; g.setLineDash([12, 8]); g.strokeRect(GX - 4, GY - 4, GW * CW + 8, GH * CH + 8); g.setLineDash([]);
  }
  // luz do dia: manchas de sol no chão embaixo das janelas e das portas
  function paintSun() {
    sunCv = mk(); const g = sunCv.getContext('2d');
    for (const wx of WIN) {
      for (let p = 0; p < 3; p++) {                          // três folhas de papel = três faixas de luz
        const a = wx - 30 + p * 21, top = WALL + 30, bot = WALL + 200, sk = 0.62;
        const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, 'rgba(255,240,180,.42)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(a + 26, top); g.lineTo(a + 44, top); g.lineTo(a + 44 + (bot - top) * sk + 8, bot); g.lineTo(a + 26 + (bot - top) * sk - 8, bot); g.closePath(); g.fill();
      }
    }
    for (const d of [geo.doorIn, geo.doorOut]) {
      const gr = g.createLinearGradient(0, WALL, 0, WALL + 190); gr.addColorStop(0, 'rgba(255,246,206,.46)'); gr.addColorStop(0.5, 'rgba(255,246,206,.16)'); gr.addColorStop(1, 'rgba(255,246,206,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(d.x + 4, WALL + 3); g.lineTo(d.x + d.w - 4, WALL + 3); g.lineTo(d.x + d.w + 50, WALL + 190); g.lineTo(d.x - 30, WALL + 190); g.closePath(); g.fill();
    }
  }
  // luz da tarde/noite: poças quentes embaixo das lanternas (somadas por cima de um véu azul)
  function paintDusk() {
    duskCv = mk(); const g = duskCv.getContext('2d');
    for (const lx of LAMPS.concat([geo.doorIn.x + 20, geo.doorOut.x + geo.doorOut.w - 20])) {
      let gr = g.createRadialGradient(lx, 74, 4, lx, 74, 120); gr.addColorStop(0, 'rgba(255,200,110,.55)'); gr.addColorStop(1, 'rgba(255,200,110,0)');
      g.fillStyle = gr; g.fillRect(lx - 120, 0, 240, 200);
      g.save(); g.translate(lx, 250); g.scale(1, 0.55); gr = g.createRadialGradient(0, 0, 10, 0, 0, 170); gr.addColorStop(0, 'rgba(255,196,110,.34)'); gr.addColorStop(1, 'rgba(255,196,110,0)');
      g.fillStyle = gr; g.fillRect(-170, -170, 340, 340); g.restore();
    }
    for (const wx of WIN) { const gr = g.createRadialGradient(wx, 70, 6, wx, 70, 70); gr.addColorStop(0, 'rgba(255,214,130,.4)'); gr.addColorStop(1, 'rgba(255,214,130,0)'); g.fillStyle = gr; g.fillRect(wx - 70, 0, 140, 140); }
  }

  G.FabArt = {
    geo, K, PX, blit, shadow, item, hat, spr, worker, tierOf, SPARK, WIN, LAMPS,
    parts: { stove, pot, lid, flame, paddle, press, pressHead, usu, bucket, turn, flag, chute, chuteF, chuteB, plate, plateU, hopper },
    bg() { if (!bgCv) paintBg(); return bgCv; }, sun() { if (!sunCv) paintSun(); return sunCv; }, dusk() { if (!duskCv) paintDusk(); return duskCv; },
  };
})();

/* ======================================================================
   PARTE 2 — o que se mexe: esteiras, máquinas com operador, portas, parede viva
   ====================================================================== */
(function () {
  'use strict';
  const E = window.Pixxel, G = window.KomeGame, A = G.FabArt, U = E.U, D = E.Draw, K = A.K, TAU = Math.PI * 2, INK = '#3B2818';
  const { GW, GH, CW, CH, GX, GY, WALL, BH, BV, BT, W, H } = A.geo, blit = A.blit, shadow = A.shadow, P = A.parts, item = A.item, spr = A.spr;
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], BASE = 4;
  const HW = CW / 2, HH = CH / 2;

  /* ---------- ESTEIRAS ----------
     célula = {cx, cy, ins:[lados de onde entra], outs:[direções pra onde sai], moving, speed}
     Uma entrada + uma saída em ângulo reto = peça de CURVA (quarto de anel); o resto são meias-retas + miolo. */
  function curveOf(c) {
    if (c.ins.length !== 1 || c.outs.length !== 1) return null;
    const a = c.ins[0], b = c.outs[0]; if ((a + b) % 2 === 0) return null;
    const h = a % 2 === 0 ? a : b, v = a % 2 === 0 ? b : a;
    const kx = c.cx + DX[h] * HW, ky = c.cy + DY[v] * HH;
    const ang = s => Math.atan2((c.cy + DY[s] * HH - ky) / HH, (c.cx + DX[s] * HW - kx) / HW);
    let a0 = ang(a), a1 = ang(b);
    if (a1 - a0 > Math.PI) a1 -= TAU; if (a0 - a1 > Math.PI) a1 += TAU;
    return { kx, ky, a0, a1 };
  }
  function trace(g, c, f, n) {
    const k = c.curve;
    if (k) {
      const lo = Math.min(k.a0, k.a1), hi = Math.max(k.a0, k.a1), e = f ? 0.03 : 0;
      g.moveTo(k.kx + (HW + BV - n + f) * Math.cos(lo - e), k.ky + (HH + BH - n + f) * Math.sin(lo - e));
      g.ellipse(k.kx, k.ky, HW + BV - n + f, HH + BH - n + f, 0, lo - e, hi + e, false);
      g.ellipse(k.kx, k.ky, Math.max(1, HW - BV + n - f), Math.max(1, HH - BH + n - f), 0, hi + e, lo - e, true);
      g.closePath();
      return;
    }
    const hy = BH - n + f, hx = BV - n + f;
    g.rect(c.cx - hx, c.cy - hy, hx * 2, hy * 2);
    for (let i = 0; i < c.sides.length; i++) {
      const s = c.sides[i];
      if (s === 0) g.rect(c.cx, c.cy - hy, HW + f, hy * 2);
      else if (s === 2) g.rect(c.cx - HW - f, c.cy - hy, HW + f, hy * 2);
      else if (s === 1) g.rect(c.cx - hx, c.cy, hx * 2, HH + f);
      else g.rect(c.cx - hx, c.cy - HH - f, hx * 2, HH + f);
    }
  }
  function pass(g, list, f, n, dy, col) {
    g.fillStyle = col; g.beginPath();
    if (dy) g.translate(0, dy);
    for (let i = 0; i < list.length; i++) trace(g, list[i], f, n);
    g.fill();
    if (dy) g.translate(0, -dy);
  }
  const mod = (a, b) => ((a % b) + b) % b;
  function chevrons(g, c, t) {
    const sp = c.speed * (c.moving ? t : 0), k = c.curve;
    if (k) {
      const n = 4, len = k.a1 - k.a0, sgn = len > 0 ? 1 : -1, ph = mod(sp * 2, 1 / n);
      for (let i = 0; i < n; i++) {
        const u = i / n + ph, th = k.a0 + len * u, th2 = th + sgn * 0.12;
        g.moveTo(k.kx + (HW - BV + 7) * Math.cos(th), k.ky + (HH - BH + 5) * Math.sin(th));
        g.lineTo(k.kx + HW * Math.cos(th2), k.ky + HH * Math.sin(th2));
        g.lineTo(k.kx + (HW + BV - 7) * Math.cos(th), k.ky + (HH + BH - 5) * Math.sin(th));
      }
      return;
    }
    const seg = (s, m) => {            // m = +1 anda no sentido do lado s, -1 anda pro miolo
      if (s % 2 === 0) {
        const d = DX[s] * m, x0 = s === 0 ? c.cx : c.cx - HW, x1 = x0 + HW, step = 16, pos = sp * CW * d;
        for (let x = x0 + mod(pos - x0, step); x < x1; x += step) { g.moveTo(x - 4 * d, c.cy - BH + 6); g.lineTo(x + 3 * d, c.cy); g.lineTo(x - 4 * d, c.cy + BH - 6); }
      } else {
        const d = DY[s] * m, y0 = s === 1 ? c.cy : c.cy - HH, y1 = y0 + HH, step = 12, pos = sp * CH * d;
        for (let y = y0 + mod(pos - y0, step); y < y1; y += step) { g.moveTo(c.cx - BV + 7, y - 3 * d); g.lineTo(c.cx, y + 3 * d); g.lineTo(c.cx + BV - 7, y - 3 * d); }
      }
    };
    for (let i = 0; i < c.ins.length; i++) seg(c.ins[i], -1);
    for (let i = 0; i < c.outs.length; i++) seg(c.outs[i], 1);
  }
  /* prep(c): calcula curva e lados (chamar quando a célula muda); belts(g, lista, t): desenha tudo em 7 passadas */
  A.beltPrep = function (c) { c.curve = curveOf(c); c.sides = c.ins.concat(c.outs); if (c.speed === undefined) c.speed = 2; if (c.moving === undefined) c.moving = true; return c; };
  A.belts = function (g, list, t) {
    if (!list.length) return;
    g.save(); g.beginPath(); g.rect(0, WALL + 2, W, H); g.clip();     // as esteiras das docas nascem na soleira da porta
    pass(g, list, 3, 0, BT + 4, 'rgba(46,26,10,.24)');          // sombra no chão
    pass(g, list, 2, 0, BT, INK); pass(g, list, 2, 0, 0, INK);    // contorno (tampo + saia)
    pass(g, list, 0, 0, BT, '#59626E'); pass(g, list, 0, 0, BT / 2, '#6E7884');   // saia de aço (o corpo da esteira)
    pass(g, list, 0, 0, 0, K.steel);                               // trilhos
    pass(g, list, 0, 3, 0, '#5C554E');                             // borracha
    g.strokeStyle = 'rgba(255,246,225,.26)'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); for (let i = 0; i < list.length; i++) chevrons(g, list[i], t); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath();           // brilho fino no trilho de cima das retas deitadas
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (c.curve) continue; for (let j = 0; j < c.sides.length; j++) { const s = c.sides[j]; if (s === 0) g.rect(c.cx, c.cy - BH, HW, 1); else if (s === 2) g.rect(c.cx - HW, c.cy - BH, HW, 1); } }
    g.fill();
    g.restore();
  };
  /* itemAt(c, de, p, out) -> posição de um item na célula (p 0..1; de = lado por onde entrou; out = direção de saída) */
  A.itemAt = function (c, from, p, outDir, o) {
    const k = c.curve;
    if (k && from === c.ins[0]) { const th = k.a0 + (k.a1 - k.a0) * p; o.x = k.kx + HW * Math.cos(th); o.y = k.ky + HH * Math.sin(th); return o; }
    if (p < 0.5) { const q = 1 - p * 2; o.x = c.cx + DX[from] * HW * q; o.y = c.cy + DY[from] * HH * q; }
    else { const q = (p - 0.5) * 2; o.x = c.cx + DX[outDir] * HW * q; o.y = c.cy + DY[outDir] * HH * q; }
    return o;
  };
  /* drawItem(g, tipo, x, y, t, i): item em cima da esteira (sombra, balancinho, vapor/brilho) */
  A.drawItem = function (g, type, x, y, t, i, lift) {
    const bob = lift === undefined ? Math.abs(Math.sin(t * 7 + i * 1.7)) * 1.5 : lift;
    shadow(g, x, y + 5, 10, 3.5, 0.3);
    blit(g, item[type], x, y + 8 - bob);
    if (type === 'cozido') {                                    // vaporzinho
      const u = (t * 1.3 + i * 0.37) % 1; g.fillStyle = 'rgba(255,255,255,' + (0.55 * (1 - u)).toFixed(2) + ')';
      g.fillRect(Math.round(x - 3 + Math.sin(u * 6 + i) * 2), Math.round(y - 14 - u * 9 - bob), 2, 3); g.fillRect(Math.round(x + 3 + Math.sin(u * 5 + i + 2) * 2), Math.round(y - 11 - ((u + 0.5) % 1) * 9 - bob), 2, 2);
    } else if (type === 'mochid' || type === 'gold') {
      const u = (t * 1.6 + i * 0.61) % 1; if (u < 0.5) blit(g, A.SPARK, x - 6 + ((i * 7) % 12), y - 6 - bob - ((i * 5) % 8), 2, { alpha: Math.sin(u * TAU) });
    }
  };

  /* ---------- MÁQUINAS ---------- */
  const PALS_COOK = ['aka', 'kome', 'kin', 'momo'], PALS_MOLD = ['goma', 'sumi', 'yuki', 'matcha'];
  function fx(g, x, y, col, a) { g.fillStyle = col; g.globalAlpha = a; g.beginPath(); g.ellipse(x, y, 36, 11, 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
  function levelBadge(g, x, y, lvl) {
    if (lvl < 2) return;
    const tr = A.tierOf(lvl), w = lvl >= 10 ? 28 : 20;
    g.fillStyle = INK; D.rrect(g, x - w / 2 - 2, y - 11, w + 4, 22, 7); g.fill();
    g.fillStyle = tr >= 3 ? K.goldL : tr >= 2 ? K.copperL : tr >= 1 ? '#DDE6EE' : K.cream; D.rrect(g, x - w / 2, y - 9, w, 18, 5); g.fill();
    D.text(g, String(lvl), x, y + 1, { size: 17, col: INK, sw: 0, weight: 900 });
  }
  A.levelBadge = levelBadge;
  /* A.tagPos(m, cx, by) -> {x, y}: onde mora a etiqueta (nível + barrinha "ocupada") de cada máquina, em coordenada de tela.
     Fica NA CABEÇA da máquina (ombro da tampa / canto do funil / acima de quem vira o mochi), do lado do operador: a fileira
     da frente só cobre o pé e o corpo da de trás, nunca a cabeça. */
  A.tagPos = function (m, cx, by) {
    const tr = A.tierOf(m.lvl), s = A.mirrored(m.type, m.rot) ? -1 : 1;
    if (m.type === 'panela') return { x: cx - 9 * s + 27 * s, y: by + 6 - 38 - [0, 2, 6, 10][tr] - 26 };
    if (m.type === 'moldadora') return { x: cx - 9 * s + 27 * s, y: by + 6 - 88 - [0, 1, 3, 5][tr] * 2 };
    return { x: cx + (m.rot % 2 ? 34 : 50 + [0, 0, 4, 6][tr]) * s, y: by - 62 - [0, 2, 12, 16][tr] * 0.5 };
  };

  /* ORIENTAÇÃO  (o.rot = pra onde a máquina solta o produto: 0 direita · 1 baixo/de frente · 2 esquerda · 3 cima/de costas)
     O desenho-base da Panela e da Moldadora solta pela ESQUERDA, com o operador à direita (ele fica do lado por onde o arroz entra).
       rot 2 = base · rot 0 = base espelhada · rot 1 = de frente (calha no pé, operador atrás) · rot 3 = de costas, espelhada
       (parede sem boca, moega com seta pra cima, operador na frente).
     O Pilão-base solta pela DIREITA (rot 0); rot 2 e rot 3 espelham (quem bate troca de lado); em pé a calha fica na frente (1) ou atrás (3).
     As peças de corpo levam flip quando precisa, pra sombra ficar do mesmo lado em 0, 1 e 3. */
  const MIR = { panela: [1, 0, 0, 1], moldadora: [1, 0, 0, 1], pilao: [0, 0, 1, 1], divisor: [0, 0, 0, 0] };
  A.mirrored = (type, rot) => !!(MIR[type] && MIR[type][rot | 0]);
  A.bodyX = (m, cx) => (m.type === 'panela' || m.type === 'moldadora' ? cx + (A.mirrored(m.type, m.rot) ? 9 : -9) : cx);   // centro do corpo, já na tela
  function oriented(type, fn) {
    return function (g, m, cx, by, t, o) {
      const mir = A.mirrored(type, o.rot);
      if (mir) { g.save(); g.translate(cx * 2, 0); g.scale(-1, 1); }
      fn(g, m, cx, by, t, o);
      if (mir) g.restore();
    };
  }

  // PANELA: donabe num fogão de tijolo, fogo piscando, tampa batendo, shiba de touca mexendo
  /* DROP: o CORPO da Panela e da Moldadora assenta 6 px mais embaixo na casa (calha, operador e esteira ficam onde estavam):
     duas máquinas empilhadas se cobrem menos. Sombra de cada peça sempre do mesmo lado (luz da esquerda) nas 4 direções:
     flip só desfaz o espelho do quadro (mir); quando a saída é pra esquerda (rot 2) entra o desenho `inv` (peças do outro lado).
     Calha de lado termina NA BORDA da casa (não entra na vizinha). De costas, a moega é desenhada por cima do operador. */
  const DROP = 6;
  A.DROP = DROP;
  A.panela = oriented('panela', function (g, m, cx, fy, t, o) {
    const by = fy + DROP, tr = A.tierOf(m.lvl), working = m.work && m.prog < 1, sq = m.sq || 0, mx = cx - 9, top = by - 38 - [0, 2, 6, 10][tr];
    const rot = o.rot | 0, front = rot === 1, back = rot === 3, F = A.mirrored('panela', rot), inv = rot === 2, w2 = (13 + [0, 1, 3, 4][tr]) * 2;
    const ox = cx + (back ? 29 : 26), oy = fy + (front ? -11 : back ? 9 : 4);
    const op = () => {
      const pal = PALS_COOK[m.id % PALS_COOK.length], pose = working ? 'push' : (m.idle > 6 ? (back ? 'sit' : 'sleep') : 'sit');
      if (working && !back) blit(g, P.paddle, ox - 10, oy - 20, 2, { rot: -0.75 + Math.sin(m.anim * 7) * 0.3 });
      A.worker(g, ox, oy, pose, t + m.id * 0.7, { pal, face: -1, hat: 'toque' });
    };
    shadow(g, mx, by + 2, 36, 8);
    if (front && !o.ghost) op();                                // de frente: o cozinheiro fica atrás do fogão
    if (working && !o.ghost) fx(g, mx, by + 5, '#FFB040', (back ? 0.08 : 0.16) + 0.08 * Math.sin(t * 17 + m.id));
    blit(g, P.stove(tr, back, inv), mx, by + BASE, 2, { flip: F });
    if (!back) {
      if (working) blit(g, P.flame(Math.floor(t * 9 + m.id) % 3), mx, by - 6, 2);
      else { g.fillStyle = m.idle < 4 ? '#D9502A' : '#6A3A22'; g.fillRect(mx - 6, by - 10, 4, 2); g.fillRect(mx + 2, by - 9, 3, 2); }
    }
    blit(g, P.pot(tr), mx, top + 6 + sq * 3, 2, { sx: 1 + sq * 0.08, sy: 1 - sq * 0.1, flip: F });
    const rat = working ? Math.abs(Math.sin(m.anim * 13)) : 0;
    blit(g, P.lid(tr), mx + (working ? Math.sin(m.anim * 29) * 1.2 : 0), top - 20 - rat * 4 + sq * 3, 2, { rot: working ? Math.sin(m.anim * 13) * 0.07 : 0, flip: F });
    if (front) blit(g, P.chuteF, mx, fy + BASE + 12);
    else if (!back) { blit(g, P.chute, Math.max(cx - 26, mx - w2 - 8), fy + BASE + 2); blit(g, P.plate, mx - w2 + 8, by - 9); }
    if (o.ghost) { if (back) { blit(g, P.hopper, mx, fy + BASE + 3); blit(g, P.plateU, mx, fy + BASE + 1); } return; }
    if (!front) op();
    if (back) { blit(g, P.hopper, mx, fy + BASE + 3); blit(g, P.plateU, mx, fy + BASE + 1); }   // moega por cima: o operador nunca tapa
  });
  A.panelaTop = (m, cx, by) => ({ x: A.bodyX(m, cx), y: by + DROP - 38 - [0, 2, 6, 10][A.tierOf(m.lvl)] - 34 });

  // MOLDADORA: prensa com pistão, funil de arroz, alavanca e o onigiri pulando pra fora
  A.moldadora = oriented('moldadora', function (g, m, cx, fy, t, o) {
    const by = fy + DROP, tr = A.tierOf(m.lvl), working = m.work && m.prog < 1, sq = m.sq || 0, mx = cx - 9, k = m.prog;
    const rot = o.rot | 0, front = rot === 1, back = rot === 3, F = A.mirrored('moldadora', rot), inv = rot === 2, side = rot !== 1;
    let d = 0;                                                  // 0 = pistão em cima, 1 = carimbou
    if (working) { if (k < 0.4) d = -0.12 * Math.sin(k / 0.4 * Math.PI); else if (k < 0.6) d = U.ease.in((k - 0.4) / 0.2); else d = 1 - U.ease.out((k - 0.6) / 0.4); }
    const ox = cx + (back ? 31 : 28), oy = fy + (front ? -11 : back ? 9 : 4);
    const op = () => A.worker(g, ox, oy, working ? (d > 0.35 ? 'push' : 'stand') : (m.idle > 6 ? (back ? 'sit' : 'sleep') : 'sit'), t + m.id * 0.9, { pal: PALS_MOLD[m.id % PALS_MOLD.length], face: -1, hat: 'bone' });
    shadow(g, mx, by + 2, 38, 8);
    if (front && !o.ghost) op();
    blit(g, P.press(tr, back, inv), mx, by + BASE, 2, { flip: F });
    const hb = by - 52 + d * 20, rt = by - 70, rl = Math.max(0, hb - 14 - rt);   // base da cabeça do pistão; haste
    g.fillStyle = INK; g.fillRect(mx - 5, rt, 10, rl + 2);
    g.fillStyle = K.steel; g.fillRect(mx - 3, rt, 6, rl); g.fillStyle = K.steelL; g.fillRect(mx - 3, rt, 2, rl); g.fillStyle = K.steelD; g.fillRect(mx + 1, rt, 2, rl);
    if (m.work) blit(g, k > 0.58 ? item.onigiri : item.cozido, mx, by - 26 + (k > 0.58 ? 0 : 2), 2, { sx: 1 + sq * 0.3, sy: 1 - sq * 0.3 });
    blit(g, P.pressHead, mx, hb + 2);
    if (tr >= 1) { const a = (working ? m.anim * 5 : 0), wx = mx + (side ? 34 : -34); g.strokeStyle = K.copperD; g.lineWidth = 2; g.beginPath(); g.moveTo(wx + Math.cos(a) * 7, by - 46 + Math.sin(a) * 7); g.lineTo(wx - Math.cos(a) * 7, by - 46 - Math.sin(a) * 7); g.moveTo(wx + Math.cos(a + 1.57) * 7, by - 46 + Math.sin(a + 1.57) * 7); g.lineTo(wx - Math.cos(a + 1.57) * 7, by - 46 - Math.sin(a + 1.57) * 7); g.stroke(); }
    if (front) blit(g, P.chuteF, mx, fy + BASE + 12);
    else if (!back) { blit(g, P.chute, cx - 26, fy + BASE + 2); blit(g, P.plate, mx - 20, by - 5); }
    if (o.ghost) { if (back) { blit(g, P.hopper, mx, fy + BASE + 3); blit(g, P.plateU, mx, fy + BASE + 1); } return; }
    // alavanca (o operador puxa junto com o pistão)
    const pvx = mx + 30, pvy = by - 24, la = -1.95 + Math.max(0, d) * 0.9, lx = pvx + Math.cos(la) * 24, ly = pvy + Math.sin(la) * 24;
    g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(pvx, pvy); g.lineTo(lx, ly); g.stroke();
    g.strokeStyle = K.steel; g.lineWidth = 3; g.beginPath(); g.moveTo(pvx, pvy); g.lineTo(lx, ly); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(lx, ly, 5.5, 0, TAU); g.fill(); g.fillStyle = K.red; g.beginPath(); g.arc(lx, ly, 4, 0, TAU); g.fill(); g.fillStyle = K.redL; g.fillRect(lx - 2, ly - 3, 2, 2);
    g.fillStyle = INK; g.beginPath(); g.arc(pvx, pvy, 4, 0, TAU); g.fill(); g.fillStyle = K.steelD; g.beginPath(); g.arc(pvx, pvy, 2.5, 0, TAU); g.fill();
    if (!front) op();
    if (back) { blit(g, P.hopper, mx, fy + BASE + 3); blit(g, P.plateU, mx, fy + BASE + 1); }   // moega por cima: o operador nunca tapa
    if (m.pop > 0) {                                            // onigiri pronto pula da boca pra saída (no quadro local a saída de lado é sempre pra esquerda)
      const ldx = rot % 2 === 0 ? -1 : 0, ldy = front ? 1 : back ? -1 : 0;
      const u = 1 - m.pop, px = mx + ldx * 34 * u, py = by - 8 + ldy * 20 * u - Math.sin(u * Math.PI) * 20;
      blit(g, item.onigiri, px, py, 2, { rot: (ldx || 1) * u * 1.2 });
    }
  });

  // PILÃO: usu grandão, um shiba bate com o kine (antecipa, desce, amassa) e o outro vira o mochi entre as batidas
  A.pilao = oriented('pilao', function (g, m, cx, by, t, o) {
    const tr = A.tierOf(m.lvl), working = m.work && m.prog < 1, sq = m.sq || 0, vert = !!o.vert, gold = m.rec === 1;
    const rim = by - 44 - [0, 2, 12, 16][tr], rw = 22 + [0, 2, 6, 8][tr], sx = vert ? 36 : 50 + [0, 0, 4, 6][tr];
    shadow(g, cx, by + 2, vert ? 44 : 62, 9);
    if (o.rot === 3) blit(g, P.chuteB, cx, rim - 4);              // de costas: a calha sobe por trás do usu
    blit(g, P.usu(tr), cx, by + BASE);
    if (m.work || m.inB.cozido > 0) {                           // a massa
      const rx = rw - 6 + sq * 7, ry = 6 - sq * 2.2, my = rim - 1 + sq * 2;
      g.fillStyle = INK; g.beginPath(); g.ellipse(cx, my, rx + 2, ry + 2, 0, 0, TAU); g.fill();
      g.fillStyle = gold ? K.gold : K.mochi; g.beginPath(); g.ellipse(cx, my, rx, ry, 0, 0, TAU); g.fill();
      g.fillStyle = gold ? K.goldL : K.white; g.beginPath(); g.ellipse(cx - 5, my - 1.5, rx * 0.45, ry * 0.4, 0, 0, TAU); g.fill();
    }
    if (o.rot === 1) blit(g, P.chuteF, cx, by + BASE + 26);     // de frente: calha no pé
    else if (!vert) blit(g, P.chute, Math.min(cx + 66, cx + sx + 26), by + BASE + 2, 2, { flip: true });   // deitado: calha na ponta de quem vira o mochi, sem passar da borda da casa
    if (o.ghost) return;
    for (let i = 0; i < Math.min(4, m.inB.cozido); i++) blit(g, item.cozido, cx - 20 + i * 13, by + 9, 1);
    if (m.inB.gold) blit(g, item.gold, cx + 32, by + 9, 1);
    // quem bate
    const hx = cx - sx, hy = by + 4, ph = working ? (m.prog * 4 + 0.2) % 1 : 0.86;
    const pvx = hx + 12, pvy = hy - 22, hitA = Math.atan2(rim - 8 - pvy, cx - pvx), L = Math.hypot(cx - pvx, rim - 8 - pvy), upA = hitA - 1.75;
    let Aang, stretch = 1;
    if (!working) Aang = hitA - 0.95;
    else if (ph < 0.5) Aang = U.lerp(hitA, upA, U.ease.out(ph / 0.5));
    else if (ph < 0.62) Aang = upA - 0.16 * Math.sin((ph - 0.5) / 0.12 * Math.PI);      // antecipação: recua antes de descer
    else if (ph < 0.8) { Aang = U.lerp(upA, hitA, U.ease.in((ph - 0.62) / 0.18)); stretch = 1.06; }
    else { Aang = hitA + Math.sin((ph - 0.8) / 0.2 * Math.PI) * -0.08; stretch = 1 - 0.08 * Math.sin((ph - 0.8) / 0.2 * Math.PI); }
    const pal1 = ['kuro', 'cha', 'sumi'][m.id % 3], pal2 = ['shiro', 'yuki', 'sakura'][m.id % 3];
    A.worker(g, hx, hy, working ? (ph < 0.62 ? 'carry' : 'push') : (m.idle > 6 ? 'sleep' : 'stand'), t + m.id, { pal: pal1, face: 1, hat: 'faixa' });
    // quem vira (põe a pata na massa logo depois da batida e tira antes da próxima)
    const tx = cx + sx, turning = working && ph > 0.02 && ph < 0.42;
    if (!vert) blit(g, P.bucket, cx + 30, by + 8);
    A.worker(g, tx, hy, working ? (turning ? 'push' : 'wag') : (m.idle > 6 ? 'sleep' : 'sit'), t + m.id * 1.3, { pal: pal2, face: -1, hat: 'faixa' });
    // o martelão (kine)
    const ex = pvx + Math.cos(Aang) * L * stretch, ey = pvy + Math.sin(Aang) * L * stretch, hw = 12 + [0, 1, 4, 6][tr], hh = 7.5 + [0, 0.5, 2, 3][tr];
    g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(pvx, pvy); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = K.woodL; g.lineWidth = 4; g.beginPath(); g.moveTo(pvx, pvy); g.lineTo(ex, ey); g.stroke();
    g.save(); g.translate(ex, ey); g.rotate(Aang + Math.PI / 2);
    g.fillStyle = INK; D.rrect(g, -hw - 2, -hh - 2, hw * 2 + 4, hh * 2 + 4, 4); g.fill();
    g.fillStyle = K.wood; D.rrect(g, -hw, -hh, hw * 2, hh * 2, 3); g.fill();
    g.fillStyle = K.woodL; g.fillRect(-hw + 1, -hh + 1, hw * 2 - 2, 4); g.fillStyle = K.woodD; g.fillRect(-hw + 1, hh - 4, hw * 2 - 2, 3);
    if (tr >= 1) { g.fillStyle = tr >= 3 ? K.gold : K.copper; g.fillRect(-hw + 3, -hh, 3, hh * 2); g.fillRect(hw - 6, -hh, 3, hh * 2); }
    g.restore();
  });
  A.pilaoRim = (m, cx, by) => ({ x: cx, y: by - 44 - [0, 2, 12, 16][A.tierOf(m.lvl)] });

  // DIVISOR: mesa giratória com cancela que troca de lado e bandeirinha apontando
  A.divisor = function (g, m, cx, cy, t, o) {
    shadow(g, cx, cy + 14, 30, 8);
    blit(g, P.turn, cx, cy + 16);
    const vx = o.vx || 0, vy = o.vy || 0, hx = cx, hy = cy - 6, ex = hx + vx * 26, ey = hy + vy * 15;
    if (o.item) A.drawItem(g, o.item, cx - vx * 8, cy - 2 - vy * 4, t, m.id, 0);
    g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 10; g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = K.red; g.lineWidth = 6; g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = K.cream; g.lineWidth = 6; g.lineCap = 'butt'; g.setLineDash([5, 6]); g.lineDashOffset = -3; g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
    g.fillStyle = INK; g.fillRect(cx - 4, cy - 34, 8, 30); g.fillStyle = K.woodL; g.fillRect(cx - 2, cy - 32, 4, 26); g.fillStyle = K.wood; g.fillRect(cx + 0.5, cy - 32, 1.5, 26);
    g.fillStyle = INK; g.beginPath(); g.arc(cx, cy - 6, 5, 0, TAU); g.fill(); g.fillStyle = K.gold; g.beginPath(); g.arc(cx, cy - 6, 3.2, 0, TAU); g.fill();
    const left = vx < -0.15 || (Math.abs(vx) <= 0.15 && vy < 0);
    blit(g, P.flag, cx + (left ? -12 : 12), cy - 20, 2, { flip: left });
  };

  /* ---------- ÍCONES DA BARRA (a própria máquina montada, pequena) ---------- */
  const icons = {};
  A.icon = function (id) {
    if (icons[id]) return icons[id];
    const c = document.createElement('canvas'); c.width = 48; c.height = 44; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const d = (cv, x, y) => g.drawImage(cv, Math.round(x - cv.width / 2), Math.round(y - cv.height));
    if (id === 'panela') { d(P.stove(0), 24, 46); d(P.pot(0), 24, 27); d(P.lid(0), 24, 14); d(P.flame(0), 24, 41); }
    else if (id === 'moldadora') { g.drawImage(P.press(0), 0, 13, 44, 44, 2, 0, 44, 44); d(P.pressHead, 24, 21); }
    else if (id === 'pilao') {
      d(P.usu(0), 22, 46); g.fillStyle = INK; g.beginPath(); g.ellipse(22, 22, 11, 4, 0, 0, TAU); g.fill(); g.fillStyle = K.mochi; g.beginPath(); g.ellipse(22, 22, 9.5, 3, 0, 0, TAU); g.fill();
      g.save(); g.translate(34, 10); g.rotate(0.6); g.fillStyle = INK; g.fillRect(-2, -1, 4, 22); g.fillStyle = K.woodL; g.fillRect(-1, 0, 2, 20); g.fillStyle = INK; g.fillRect(-7, -6, 14, 9); g.fillStyle = K.wood; g.fillRect(-6, -5, 12, 7); g.fillStyle = K.woodL; g.fillRect(-6, -5, 12, 2); g.restore();
    } else if (id === 'divisor') { d(P.turn, 24, 40); g.fillStyle = INK; g.fillRect(22, 8, 4, 18); g.fillStyle = K.woodL; g.fillRect(23, 9, 2, 16); d(P.flag, 30, 18); }
    else if (id === 'esteira') {
      g.fillStyle = INK; g.fillRect(3, 11, 42, 26); g.fillStyle = '#59626E'; g.fillRect(5, 29, 38, 6); g.fillStyle = K.steel; g.fillRect(5, 13, 38, 16); g.fillStyle = K.steelL; g.fillRect(5, 13, 38, 1);
      g.fillStyle = '#5C554E'; g.fillRect(5, 16, 38, 10);
      g.strokeStyle = 'rgba(255,246,225,.45)'; g.lineWidth = 2.5; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
      for (const x of [13, 24, 35]) { g.moveTo(x - 3, 18); g.lineTo(x + 2, 21); g.lineTo(x - 3, 24); } g.stroke();
    }
    return (icons[id] = c);
  };

  /* ---------- O QUE APARECE PELAS PORTAS ---------- */
  const SKY = { top: '#8FCBE6', mid: '#BFE3F0', bot: '#F3EBD2' };
  function sky(g, d, L) {
    const s = L || SKY, h = d.h;
    g.fillStyle = s.top || SKY.top; g.fillRect(d.x, d.y, d.w, h * 0.4); g.fillStyle = s.mid || SKY.mid; g.fillRect(d.x, d.y + h * 0.36, d.w, h * 0.34); g.fillStyle = s.bot || SKY.bot; g.fillRect(d.x, d.y + h * 0.66, d.w, h * 0.34);
  }
  // porta da ENTRADA: a montanha de arroz lá fora e o Kome cavando
  A.outsideIn = function (g, t, L, digging, pal) {
    const d = A.geo.doorIn;
    g.save(); g.beginPath(); g.rect(d.x, d.y, d.w, d.h); g.clip();
    sky(g, d, L);
    g.fillStyle = '#A9C08A'; g.beginPath(); g.ellipse(d.x + 110, d.y + d.h + 4, 80, 30, 0, 0, TAU); g.fill();
    g.fillStyle = INK; g.beginPath(); g.ellipse(d.x + 34, d.y + d.h + 22, 86, 80, 0, 0, TAU); g.fill();
    g.fillStyle = K.riceS; g.beginPath(); g.ellipse(d.x + 34, d.y + d.h + 22, 84, 78, 0, 0, TAU); g.fill();
    g.fillStyle = K.rice; g.beginPath(); g.ellipse(d.x + 26, d.y + d.h + 18, 76, 72, 0, 0, TAU); g.fill();
    g.fillStyle = K.white; for (let i = 0; i < 6; i++) g.fillRect(d.x + 10 + ((i * 37) % 70), d.y + 22 + ((i * 23) % 34), 3, 2);
    g.fillStyle = K.green; g.fillRect(d.x, d.y + d.h - 8, d.w, 8); g.fillStyle = K.greenL; g.fillRect(d.x, d.y + d.h - 8, d.w, 2);
    E.drawShiba(g, d.x + 92, d.y + d.h - 5, digging ? 'dig' : 'sit', t, { scale: 0.85, pal: pal || 'kome', face: -1 });
    g.restore();
  };
  // porta da VENDA: a rua e o kei-truck (dx = quanto ele já andou, n = caixas na carroceria)
  A.outsideOut = function (g, t, L, truck) {
    const d = A.geo.doorOut;
    g.save(); g.beginPath(); g.rect(d.x, d.y, d.w, d.h); g.clip();
    sky(g, d, L);
    g.fillStyle = '#A9C08A'; g.beginPath(); g.ellipse(d.x + 30, d.y + d.h, 70, 26, 0, 0, TAU); g.fill();
    g.fillStyle = '#8FB07A'; g.beginPath(); g.ellipse(d.x + 120, d.y + d.h + 2, 60, 22, 0, 0, TAU); g.fill();
    g.fillStyle = '#8E8A80'; g.fillRect(d.x, d.y + d.h - 12, d.w, 12); g.fillStyle = '#A7A398'; g.fillRect(d.x, d.y + d.h - 12, d.w, 2);
    g.fillStyle = '#E9E2CF'; for (let x = d.x + 6 - ((truck.dx * 0.5) % 24 + 24) % 24; x < d.x + d.w; x += 24) g.fillRect(x, d.y + d.h - 5, 12, 2);
    const tx = d.x + 72 + truck.dx, ty = d.y + d.h - 1 - (truck.dx ? Math.abs(Math.sin(t * 22)) * 1.5 : 0) + (truck.bump || 0) * 2;
    shadow(g, tx, ty + 1, 54, 5, 0.3);
    for (let i = 0; i < truck.n; i++) blit(g, item.box, tx - 44 + (i % 3) * 18, ty - 24 - Math.floor(i / 3) * 14 - (i % 3 === 1 ? 2 : 0));
    blit(g, spr.truck, tx, ty + 2);
    if (truck.dx) { const u = (t * 3) % 1; g.fillStyle = 'rgba(240,240,236,' + (0.6 * (1 - u)).toFixed(2) + ')'; g.beginPath(); g.arc(tx - 60 - u * 14, ty - 8 - u * 8, 3 + u * 5, 0, TAU); g.fill(); }
    g.restore();
  };

  /* ---------- PAREDE VIVA: noren, placas das portas, relógio, lanternas, gato ---------- */
  function plate(g, x, y, w, txt, col, colD, sway) {
    g.save(); g.translate(x, y); g.rotate(sway);
    g.fillStyle = INK; g.fillRect(-w / 2 + 6, -2, 2, 8); g.fillRect(w / 2 - 8, -2, 2, 8);
    g.fillStyle = INK; D.rrect(g, -w / 2 - 2, 4, w + 4, 28, 6); g.fill();
    g.fillStyle = col; D.rrect(g, -w / 2, 6, w, 24, 5); g.fill(); g.fillStyle = colD; g.fillRect(-w / 2 + 2, 26, w - 4, 3); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-w / 2 + 3, 7, w - 6, 2);
    D.text(g, txt, 0, 18, { size: 17, col: K.cream, sw: 0, weight: 900 });
    g.restore();
  }
  A.wall = function (g, t, o) {
    // noren vermelho KOME PACK (cinco panos que balançam)
    const nx = 480, ny = 46, nw = 128, n = 5, fw = nw / n;
    g.fillStyle = INK; g.fillRect(nx - nw / 2 - 8, ny - 3, nw + 16, 6); g.fillStyle = K.woodL; g.fillRect(nx - nw / 2 - 7, ny - 2, nw + 14, 3);
    for (let i = 0; i < n; i++) {
      const x = nx - nw / 2 + i * fw, sw = Math.sin(t * 1.5 + i * 0.9) * 1.6, hgt = 46 + sw;
      g.fillStyle = INK; g.fillRect(x - 1, ny + 2, fw + 2, hgt + 3);
      g.fillStyle = K.red; g.fillRect(x + 1, ny + 3, fw - 2, hgt); g.fillStyle = K.redL; g.fillRect(x + 1, ny + 3, fw - 2, 3); g.fillStyle = K.redD; g.fillRect(x + fw - 4, ny + 6, 3, hgt - 3); g.fillRect(x + 1, ny + hgt, fw - 2, 3);
    }
    D.text(g, 'KOME PACK', nx, ny + 20, { size: 18, col: K.cream, sw: 0, weight: 900 });
    g.fillStyle = K.cream; g.beginPath(); g.ellipse(nx - 9, ny + 38, 4, 2.6, -0.5, 0, TAU); g.fill(); g.beginPath(); g.ellipse(nx + 1, ny + 37, 4, 2.6, 0.3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(nx + 10, ny + 39, 4, 2.6, -0.2, 0, TAU); g.fill();
    // placas penduradas nas portas
    plate(g, A.geo.doorIn.x + 54, 45, 96, 'ENTRADA', K.green, K.greenD, Math.sin(t * 1.3) * 0.03);
    plate(g, A.geo.doorOut.x + 42, 45, 74, 'VENDA', K.red, K.redD, Math.sin(t * 1.3 + 2) * 0.03);
    // relógio (o ponteiro grande dá uma volta por dia do jogo)
    blit(g, spr.clock, 282, 90);
    const tod = o.tod || 0, a1 = tod * TAU * 2 - Math.PI / 2, a2 = tod * TAU * 24 - Math.PI / 2;
    g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(282, 74); g.lineTo(282 + Math.cos(a1) * 5, 74 + Math.sin(a1) * 5); g.moveTo(282, 74); g.lineTo(282 + Math.cos(a2) * 8, 74 + Math.sin(a2) * 8); g.stroke();
    g.fillStyle = K.red; g.fillRect(281, 73, 2, 2);
    // lanternas: acendem no fim da tarde
    for (let i = 0; i < A.LAMPS.length; i++) {
      const lx = A.LAMPS[i], sw = Math.sin(t * 1.1 + i * 1.7) * 0.04;
      blit(g, spr.lantern, lx, 86, 2, { rot: sw });
      if (o.dusk > 0.05) { g.fillStyle = 'rgba(255,214,120,' + (o.dusk * 0.55).toFixed(2) + ')'; g.beginPath(); g.ellipse(lx, 68, 9, 11, 0, 0, TAU); g.fill(); }
    }
  };
  // cantinho do gato (embaixo, à esquerda): caixas, vaso e o gato dormindo em cima
  A.corner = function (g, t) {
    shadow(g, 62, 526, 54, 8);
    blit(g, spr.crate, 40, 528); blit(g, spr.crate, 84, 530); blit(g, spr.crate, 60, 494);
    const f = Math.floor(t * 0.8) % 2;
    blit(g, f ? spr.cat1 : spr.cat0, 60, 458 + (f ? 0 : 0), 2);
    const u = (t * 0.5) % 1; D.text(g, 'z', 78 + u * 8, 440 - u * 14, { size: 17 + u * 3, col: K.cream, sw: 3, alpha: 1 - u });
    blit(g, spr.plant, 122, 532);
  };
  A.cornerR = function (g) {
    shadow(g, 916, 526, 34, 7);
    blit(g, spr.tanuki, 916, 400); shadow(g, 916, 398, 20, 5);
  };
})();
