/* Kome no Japão — oficina-arte.js
   A ARTE da Oficina do Kome (as regras, o toque e o HUD ficam no oficina.js; as contas no infinite.js / industry.js).
   Uma garagem japonesa de mecânico em vista 3/4, no mesmo jeito da Fábrica: cenário em pixel art na escala 2 (1 px de arte =
   2 px do palco 960×540), contorno #3B2818, 3 tons por material. As MÁQUINAS são os desenhos de verdade do jogo
   (G.Tools[id]), desenhados uma vez numa imagem (bake) ou ao vivo em cima do elevador. Nada aqui muda regra: só desenho.
     G.OfiArt.geo            medidas do palco (porta, quadros, vagas, elevador, cartão)
     G.OfiArt.bg()/.sun()/.dusk()   cenário fixo em cache e as duas luzes (dia / fim de tarde)
     G.OfiArt.yard(g, t, L, o)      o pátio lá fora pela porta de enrolar (as gigantes que não cabem)
     G.OfiArt.wall(g, t, o)         o que vive na parede (ferramentas penduradas, projeto da Gêmea, lojas, rádio, chaleira…)
     G.OfiArt.bake(id, s, dpr)      máquina parada numa imagem · .live(...) máquina viva (motor ligado) · .glow() friso dourado
     G.OfiArt.lift(...)             elevador com medidor de peso · .lamps() · .mech() mecânico de boné · .stamp() carimbo "+1" */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, C = E.PAL, D = E.Draw, TAU = Math.PI * 2, INK = '#3B2818';
  const W = 960, H = 540, PX = 2, WALL = 200;
  const geo = {
    W, H, WALL,
    door: { x: 20, y: 60, w: 222, h: 140 },
    peg: { x: 262, y: 58, w: 146, h: 114 },
    plan: { x: 420, y: 56, w: 148, h: 116 },
    fab: { x: 582, y: 60, w: 104, h: 76 },
    cork: { x: 706, y: 58, w: 122, h: 92 },
    win: { x: 874, y: 58, w: 74, h: 62 },
    bench: { x: 712, y: 178, w: 170, h: 46 },
    lift: { x: 494, y: 436, w: 328, ry: 24 },
    lamps: [140, 414, 574, 862],
    card: { x: 708, y: 232, w: 244, h: 228 },
    // vagas: x do "zero" da máquina, y dos pés e escala
    bays: {
      carrinho: { x: 262, y: 246, s: 1.5 }, britadeira: { x: 452, y: 244, s: 1.15 },
      trator: { x: 52, y: 306, s: 0.6 }, empilhadeira: { x: 172, y: 306, s: 0.6 },
      colheita: { x: 68, y: 440, s: 0.6 }, escav: { x: 186, y: 442, s: 0.56 },
    },
    // gigantes no pátio (dentro do vão da porta); hz = névoa de distância
    yard: {
      bagger: { x: 150, y: 172, s: 0.142, hz: 0.42 }, pacabo: { x: 146, y: 186, s: 0.27, hz: 0.2 }, caminhao: { x: 62, y: 211, s: 0.6, hz: 0 },
    },
  };

  /* ---------- paleta (a da Fábrica + concreto e o verde-menta de oficina antiga) ---------- */
  const K = {
    wood: '#A9763F', woodL: '#CF9E63', woodD: '#7A5228', woodDD: '#5E3E1E',
    steel: '#C3CBD4', steelL: '#E8EDF2', steelD: '#808A96', steelDD: '#5B6470',
    red: '#C8423A', redL: '#E8776A', redD: '#93302A',
    gold: '#F3C94A', goldL: '#FFE68A', goldD: '#B4852A',
    yel: '#EDB93A', yelL: '#F8DC7C', yelD: '#B88A1E',
    cream: '#FFFAEE', paper: '#FFF1C2', white: '#FFFFFF', rice: '#FFFDF6', riceS: '#E6DCC4',
    blk: '#3A332D', blkL: '#5A524A', dark: '#2A1A10',
    blue: '#3F5E92', blueL: '#6487C0', blueD: '#2C4470',
    green: '#7F9E5C', greenL: '#A9C08A', greenD: '#5D7A40',
    mint: '#8DB2A2', mintL: '#A9C9BB', mintD: '#739888', mintDD: '#587A6C',
    conc: '#C7B697', concL: '#D6C7A9', concD: '#B3A183', concDD: '#978566',
    cork: '#C8985A', corkL: '#D9AD72', corkD: '#B07F45',
    rub: '#3E3A38', rubL: '#5C5753', rubD: '#2A2624',
    pink: '#F4B8C5', pinkD: '#D98AA0', ora: '#E2742E', oraL: '#F3A566',
    sack: '#D8C49A', glass: '#A8D8EA', glassD: '#6FAECB',
  };
  const SP = (name, w, h, fn, ol) => E.sprite('ofi/' + name, w, h, fn, ol);
  const ST = (name, txt, pal) => E.spriteText('ofi-' + name, txt, { pal: Object.assign({ U: K.blue, u: K.blueD, V: K.blueL, M: K.mint, m: K.mintD, K: K.blk, k: K.blkL, O: K.ora, o: K.oraL, G: K.gold, g: K.goldD, L: K.goldL, C: K.cream, c: K.riceS, A: K.steel, a: K.steelD, Z: K.steelL }, pal || {}) });

  /* blit(g, sprite, x centro, y base, escala=2, {sx, sy, alpha, flip, rot}) — igual ao da Fábrica */
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
  // silhueta de um sprite numa cor só (marca de tinta no painel, sombra de carimbo)
  const silC = {};
  function sil(cv, col) {
    const k = cv.width + 'x' + cv.height + col + (cv._id || (cv._id = ++sil.n));
    if (silC[k]) return silC[k];
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d');
    g.drawImage(cv, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
    return (silC[k] = c);
  }
  sil.n = 0;

  /* ======================================================================
     SPRITES pequenos (px de arte; entram na escala 2)
     ====================================================================== */
  const spr = {
    // ---- ferramentas de mão penduradas no painel ----
    pata: SP('h-pata', 15, 19, P => {            // plaquinha de madeira com a marca da pata
      P.rect(7, 0, 1, 4, K.blk); P.ell(7.5, 11, 6.5, 6.5, K.woodL); P.ring(7.5, 11, 6.5, 1.2, K.wood); P.rect(3, 15, 9, 1, K.woodD);
      P.ell(7.5, 12.5, 2.6, 2.2, K.pinkD); P.ell(4.5, 9.5, 1.2, 1.4, K.pinkD); P.ell(7.5, 8, 1.2, 1.4, K.pinkD); P.ell(10.5, 9.5, 1.2, 1.4, K.pinkD);
    }),
    hashi: SP('h-hashi', 9, 27, P => {           // par de hashi vermelho numa presilha
      P.rect(2, 1, 2, 24, K.red); P.rect(2, 1, 1, 24, K.redL); P.rect(5, 1, 2, 24, K.red); P.rect(6, 1, 1, 24, K.redD);
      P.rect(2, 1, 2, 3, K.goldL); P.rect(5, 1, 2, 3, K.goldL); P.rect(2, 22, 2, 3, K.woodL); P.rect(5, 22, 2, 3, K.woodL);
      P.rect(1, 8, 7, 2, K.steelD); P.rect(1, 8, 7, 1, K.steel);
    }),
    tigela: SP('h-tigela', 17, 14, P => {        // tigela azul pendurada de lado
      P.rect(8, 0, 1, 3, K.blk);
      P.poly([[1, 4], [15, 4], [12, 11], [4, 11]], K.blue); P.rect(1, 3, 15, 2, K.blueL); P.rect(5, 11, 7, 2, K.blueD); P.rect(11, 5, 2, 5, K.blueD); P.rect(3, 6, 2, 1, K.blueL);
      P.rect(3, 7, 9, 1, K.cream);
    }),
    pa: SP('h-pa', 11, 30, P => {                // pá: cabo de madeira com alça em D e lâmina de aço
      P.ring(5.5, 3.5, 3, 1.4, K.woodD); P.rect(5, 6, 2, 13, K.woodL); P.rect(6, 6, 1, 13, K.wood);
      P.poly([[1, 19], [10, 19], [10, 25], [5.5, 29], [1, 25]], K.steel); P.rect(2, 19, 2, 6, K.steelL); P.rect(8, 20, 2, 5, K.steelD); P.rect(4, 18, 4, 2, K.steelD);
    }),
    duaspas: SP('h-duaspas', 23, 30, P => {      // duas pás cruzadas
      P.line(4, 3, 15, 20, 2, K.woodL); P.line(18, 3, 7, 20, 2, K.wood);
      P.ring(4, 3, 2.6, 1.3, K.woodD); P.ring(18.5, 3, 2.6, 1.3, K.woodD);
      P.poly([[12, 19], [19, 18], [21, 24], [17, 28], [13, 25]], K.steel); P.rect(14, 20, 2, 4, K.steelL);
      P.poly([[3, 18], [10, 19], [9, 25], [5, 28], [1, 24]], K.steelD); P.rect(4, 20, 2, 4, K.steel);
    }),
    // ---- coisas da parede ----
    wrench: SP('wrench', 7, 18, P => { P.rect(3, 4, 2, 11, K.steel); P.rect(3, 4, 1, 11, K.steelL); P.ell(3.5, 3, 3, 3, K.steel); P.rect(3, 0, 2, 3, K.dark); P.ell(3.5, 15.5, 2.5, 2.5, K.steelD); P.set(3, 15, K.dark).set(4, 15, K.dark).set(3, 16, K.dark).set(4, 16, K.dark); }),
    tooth: SP('tooth', 9, 13, P => { P.rect(4, 0, 1, 3, K.blk); P.poly([[1, 3], [8, 3], [7, 8], [4.5, 12], [2, 8]], K.steelD); P.rect(2, 3, 2, 5, K.steel); P.rect(1, 3, 7, 1, K.yel); }),
    calendar: SP('calendar', 14, 18, P => { P.rect(1, 2, 12, 15, K.cream); P.rect(1, 2, 12, 4, K.red); P.rect(1, 2, 12, 1, K.redL); P.rect(3, 0, 1, 3, K.blk); P.rect(10, 0, 1, 3, K.blk); P.rect(4, 8, 2, 6, K.dark); P.rect(8, 8, 3, 1, K.dark); P.rect(10, 9, 1, 2, K.dark); P.rect(8, 11, 3, 1, K.dark); P.rect(8, 12, 1, 2, K.dark); P.rect(8, 14, 3, 1, K.dark); P.rect(2, 16, 10, 1, K.riceS); }),
    exting: SP('exting', 9, 18, P => { P.rrect(1, 5, 7, 12, 2, K.red); P.rect(2, 6, 2, 9, K.redL); P.rect(6, 7, 1, 9, K.redD); P.rect(3, 2, 3, 3, K.blk); P.rect(5, 1, 3, 1, K.blk); P.rect(2, 9, 5, 3, K.cream); P.rect(0, 3, 2, 1, K.blk); }),
    lamp: SP('lamp', 16, 11, P => {              // luminária esmaltada verde de galpão
      P.rect(7, 0, 2, 2, K.blk); P.poly([[5, 2], [11, 2], [15, 8], [1, 8]], K.mintDD); P.rect(6, 2, 4, 1, K.mintD); P.poly([[4, 4], [7, 3], [6, 7], [2, 7]], K.mintD);
      P.rect(1, 8, 14, 1, K.cream); P.rect(5, 9, 6, 2, K.goldL); P.rect(6, 9, 3, 1, K.white);
    }),
    // ---- bancada e cantinho ----
    vise: SP('vise', 18, 15, P => {              // morsa
      P.rect(2, 11, 14, 3, K.blueD); P.rect(2, 11, 14, 1, K.blue); P.rect(4, 5, 4, 7, K.blue); P.rect(4, 5, 1, 7, K.blueL); P.rect(10, 4, 4, 8, K.blue); P.rect(13, 4, 1, 8, K.blueD);
      P.rect(3, 3, 6, 3, K.steelD); P.rect(3, 3, 6, 1, K.steel); P.rect(9, 2, 6, 3, K.steelD); P.rect(9, 2, 6, 1, K.steel); P.rect(0, 8, 5, 1, K.steel); P.rect(0, 6, 1, 5, K.steelD);
    }),
    radio: SP('radio', 20, 16, P => {            // rádio de pilha com antena
      P.line(15, 5, 18, 0, 1, K.steelD); P.rrect(1, 5, 18, 10, 2, K.red); P.rect(2, 6, 16, 1, K.redL); P.rect(2, 13, 16, 1, K.redD);
      P.ell(6.5, 10, 3.5, 3.5, K.blk); P.ell(6.5, 10, 2, 2, K.blkL); P.set(6, 10, K.steel); P.rect(11, 7, 6, 3, K.cream); P.rect(13, 7, 1, 3, K.red); P.ell(12, 12.5, 1, 1, K.goldL); P.ell(15.5, 12.5, 1, 1, K.goldL);
    }),
    kettle: SP('kettle', 16, 15, P => {          // chaleira no fogareiro
      P.rect(2, 12, 12, 2, K.blk); P.rect(3, 11, 10, 1, K.ora);
      P.rrect(3, 4, 10, 8, 3, K.steel); P.rect(4, 5, 2, 5, K.steelL); P.rect(10, 5, 2, 6, K.steelD); P.rect(5, 3, 6, 1, K.steelD); P.rect(7, 2, 2, 1, K.blk);
      P.poly([[12, 6], [15, 4], [15, 5], [13, 8]], K.steelD); P.arc(8, 4, 5, Math.PI * 1.15, Math.PI * 1.85, 1, K.blk);
    }),
    mug: SP('mug', 8, 8, P => { P.rect(1, 1, 5, 6, K.cream); P.rect(1, 1, 5, 1, K.woodD); P.rect(6, 2, 1, 3, K.cream); P.rect(2, 3, 2, 2, K.red); P.rect(4, 2, 1, 5, K.riceS); }),
    oilcan: SP('oilcan', 10, 13, P => { P.rect(2, 4, 6, 8, K.yel); P.rect(2, 4, 2, 8, K.yelL); P.rect(7, 4, 1, 8, K.yelD); P.rect(4, 2, 2, 2, K.blk); P.line(6, 2, 9, 0, 1, K.blk); P.rect(3, 6, 4, 3, K.red); }),
    toolbox: SP('toolbox', 22, 13, P => { P.rect(8, 0, 6, 1, K.blk); P.rect(8, 1, 1, 2, K.blk); P.rect(13, 1, 1, 2, K.blk); P.rrect(1, 3, 20, 9, 1, K.red); P.rect(1, 3, 20, 1, K.redL); P.rect(1, 6, 20, 1, K.redD); P.rect(9, 5, 4, 3, K.goldL); P.rect(1, 10, 20, 2, K.redD); }),
    tires: SP('tires', 32, 36, P => {            // pilha de 3 pneus (cada um com sua luz em cima e gomos; aro por cima)
      for (let i = 0; i < 3; i++) {
        const y = 25 - i * 10, dx = i === 1 ? 2 : 0;
        P.rrect(2 + dx, y, 26, 9, 4, '#544E4A'); P.rect(5 + dx, y + 1, 20, 2, '#8C847D'); P.rect(4 + dx, y + 7, 22, 1, '#3A3532');
        for (let x = 5; x < 26; x += 3) P.rect(x + dx, y + 4, 1, 3, '#3A3532');
        if (i < 2) P.rect(3 + dx, y + 9, 24, 1, K.dark);
      }
      P.ell(15, 5.5, 11, 3.2, '#6A635D'); P.ell(15, 5.5, 6, 1.7, K.dark); P.rect(7, 4, 4, 1, '#A39A92');
    }),
    drum: SP('drum', 16, 22, P => { P.rrect(1, 2, 14, 19, 2, K.blue); P.rect(2, 3, 3, 17, K.blueL); P.rect(12, 3, 2, 17, K.blueD); P.rect(1, 7, 14, 1, K.blueD); P.rect(1, 14, 14, 1, K.blueD); P.ell(8, 2.5, 6.5, 1.8, K.blueL); P.rect(5, 9, 6, 4, K.cream); P.ell(8, 11, 1.5, 1.5, K.red); }),
    broom: SP('broom', 9, 30, P => { P.line(4, 0, 4, 21, 2, K.woodL); P.rect(1, 20, 7, 3, K.red); P.poly([[1, 23], [8, 23], [9, 29], [0, 29]], K.sack); P.rect(3, 24, 1, 5, K.woodD); P.rect(6, 24, 1, 5, K.woodD); }),
    jack: SP('jack', 13, 11, P => { P.poly([[4, 0], [9, 0], [12, 10], [1, 10]], K.red); P.rect(5, 1, 2, 8, K.redL); P.rect(3, 0, 7, 1, K.steelD); P.rect(1, 9, 11, 1, K.redD); }),
    cart: SP('cart', 24, 22, P => {              // carrinho de ferramentas vermelho com rodízios
      P.rect(2, 2, 20, 2, K.steelD); P.rect(2, 2, 20, 1, K.steel); P.rect(4, 0, 3, 2, K.steel); P.rect(12, 0, 6, 2, K.yel);
      P.rect(2, 4, 20, 14, K.red); P.rect(2, 4, 2, 14, K.redL); P.rect(19, 4, 3, 14, K.redD); for (let j = 0; j < 3; j++) { P.rect(4, 8 + j * 4, 15, 1, K.redD); P.rect(9, 6 + j * 4, 5, 1, K.steelL); }
      P.rect(1, 3, 1, 8, K.blk); P.ell(5, 19.5, 2, 2, K.blk); P.ell(18, 19.5, 2, 2, K.blk);
    }),
    cart2: SP('cart2', 24, 22, P => {             // segundo carrinho de ferramentas (azul), com a gaveta de cima aberta
      P.rect(2, 2, 20, 2, K.steelD); P.rect(2, 2, 20, 1, K.steel); P.rect(5, 0, 2, 2, K.red); P.rect(9, 0, 5, 2, K.steelL); P.rect(16, 0, 3, 2, K.yel);
      P.rect(2, 4, 20, 14, K.blue); P.rect(2, 4, 2, 14, K.blueL); P.rect(19, 4, 3, 14, K.blueD); for (let j = 0; j < 3; j++) { P.rect(4, 8 + j * 4, 15, 1, K.blueD); P.rect(9, 6 + j * 4, 5, 1, K.steelL); }
      P.rect(22, 5, 1, 7, K.blk); P.ell(5, 19.5, 2, 2, K.blk); P.ell(18, 19.5, 2, 2, K.blk);
    }),
    crate: SP('crate', 20, 16, P => {            // caixote de peças (ripas, cantoneiras e estêncil de engrenagem)
      P.rect(1, 1, 18, 14, K.woodL); P.rect(1, 1, 18, 2, '#E2B983'); P.rect(1, 13, 18, 2, K.wood);
      for (const y of [5, 9]) P.rect(1, y, 18, 1, K.wood); P.rect(1, 1, 2, 14, K.wood); P.rect(17, 1, 2, 14, K.woodD);
      P.ell(10, 8, 3, 3, K.woodD); P.ell(10, 8, 1.2, 1.2, K.woodL); for (const [x, y] of [[10, 4], [10, 12], [6, 8], [14, 8]]) P.set(x, y, K.woodD);
    }),
    crateS: SP('crateS', 14, 11, P => { P.rect(1, 1, 12, 9, '#D8AC70'); P.rect(1, 1, 12, 2, '#E6BE86'); P.rect(1, 5, 12, 1, K.wood); P.rect(1, 1, 2, 9, K.wood); P.rect(11, 1, 2, 9, K.woodD); P.rect(5, 3, 4, 2, K.red); }),
    gear: SP('gear', 11, 11, P => { P.ell(5, 5, 4, 4, K.steel); for (const [x, y] of [[5, 0], [5, 10], [0, 5], [10, 5], [1.5, 1.5], [8.5, 1.5], [1.5, 8.5], [8.5, 8.5]]) P.rect(Math.round(x), Math.round(y), 1, 1, K.steelD); P.ell(4, 4, 2, 2, K.steelL); P.ell(5, 5, 1.5, 1.5, K.blk); }),
    reel: SP('reel', 18, 18, P => {              // carretel de mangueira de ar preso na parede
      P.rect(7, 0, 4, 3, K.steelD); P.ell(9, 10, 8, 8, K.red); P.ell(9, 10, 6, 6, K.yel); P.ell(9, 10, 6, 6, K.yel); P.ell(9, 10, 4.5, 4.5, K.yelD); P.ell(9, 10, 3, 3, K.yel); P.ell(9, 10, 1.5, 1.5, K.blk); P.ell(6, 6, 2, 1.5, K.redL);
    }),
    bucket: SP('bucket', 11, 11, P => { P.poly([[1, 2], [9, 2], [8, 10], [2, 10]], K.steel); P.rect(1, 2, 9, 1, K.steelL); P.rect(2, 3, 2, 6, K.steelL); P.rect(1, 0, 1, 2, K.blk); P.rect(9, 0, 1, 2, K.blk); P.rect(1, 0, 9, 1, K.blk); P.rect(3, 3, 5, 1, '#6FA8DC'); }),
    creeper: SP('creeper', 26, 8, P => { P.rrect(1, 1, 24, 4, 1, K.red); P.rect(2, 1, 22, 1, K.redL); P.rect(1, 1, 6, 4, K.blk); P.rect(2, 1, 4, 1, K.blkL); for (const x of [4, 12, 21]) P.ell(x, 6, 1.5, 1.5, K.blk); }),
    oilpan: SP('oilpan', 16, 7, P => { P.poly([[1, 1], [14, 1], [12, 5], [3, 5]], K.steelD); P.rect(1, 1, 14, 1, K.steel); P.rect(3, 2, 10, 1, K.dark); }),
    cone: SP('cone', 11, 13, P => { P.poly([[5, 1], [6, 1], [9, 10], [2, 10]], K.ora); P.rect(4, 5, 4, 2, K.cream); P.rect(1, 10, 9, 2, K.ora); P.rect(1, 11, 9, 1, '#B0531C'); P.set(5, 2, K.oraL); }),
    cat0: ST('cat0', `
      ...........
      .N.N.......
      .NNNN.NNNN.
      .NNNNNNNNNN
      .NNNNNNNNNN
      ..NNNNNNNN.`, { N: '#E9A75A', n: '#C98A4A' }),
    cat1: ST('cat1', `
      .N.N.......
      .NNNN.NNN..
      .NNNNNNNNN.
      .NNNNNNNNNN
      .NNNNNNNNNN
      ..NNNNNNNN.`, { N: '#E9A75A', n: '#C98A4A' }),
    // ---- o que o mecânico usa ----
    cap: ST('cap', `
      ...UUUUUU...
      ..UUUUUUUU..
      .UUUUUWWUUU.
      .UUUUUUUUUUu
      uuuuuuuuuuuuuu`),
    mask: ST('mask', `
      ..KKKKKKK..
      .KKKKKKKKK.
      .KKkkkkkKK.
      .KKVVVVVKK.
      .KKVVVVVKK.
      .KKKKKKKKK.
      ..KKKKKKK..`),
    spanner: SP('spanner', 16, 7, P => { P.rect(4, 2, 9, 2, K.steel); P.rect(4, 2, 9, 1, K.steelL); P.ell(2.5, 3, 2.5, 2.5, K.steel); P.rect(0, 2, 2, 2, K.dark); P.ell(13.5, 3, 2, 2, K.steelD); }),
    torch: SP('torch', 14, 7, P => { P.rect(1, 2, 8, 3, K.red); P.rect(1, 2, 8, 1, K.redL); P.rect(9, 3, 3, 1, K.steelD); P.rect(12, 2, 1, 3, K.goldL); }),
    // ---- selos e medalhas ----
    star: SP('star', 11, 11, P => { P.poly([[5.5, 0.5], [7, 4], [10.5, 4.2], [7.8, 6.6], [8.8, 10.2], [5.5, 8.2], [2.2, 10.2], [3.2, 6.6], [0.5, 4.2], [4, 4]], K.gold); P.rect(4, 3, 2, 2, K.goldL); P.rect(6, 6, 2, 2, K.goldD); }),
    starOff: SP('star0', 11, 11, P => { P.poly([[5.5, 0.5], [7, 4], [10.5, 4.2], [7.8, 6.6], [8.8, 10.2], [5.5, 8.2], [2.2, 10.2], [3.2, 6.6], [0.5, 4.2], [4, 4]], '#CFC2A2'); P.rect(4, 3, 2, 2, '#E6DCC4'); }),
    bolt: SP('bolt', 9, 12, P => { P.poly([[5, 0], [8, 0], [5, 5], [8, 5], [2, 11], [4, 6], [1, 6]], K.yel); P.rect(5, 1, 1, 3, K.yelL); }),
    grain: SP('grain', 9, 11, P => { P.ell(4.5, 5.5, 3.5, 4.5, K.gold); P.ell(3.5, 4, 1.5, 2, K.goldL); P.rect(6, 6, 1, 3, K.goldD); P.set(3, 3, K.white); }),
    spark: ST('spark', `
      .W.
      WLW
      .W.`),
    coin: SP('coin', 11, 11, P => { P.ell(5, 5, 4.5, 4.5, K.gold); P.ell(5, 5, 3, 3, K.goldL); P.rect(5, 3, 1, 5, K.goldD); P.rect(4, 4, 3, 1, K.goldD); P.rect(4, 6, 3, 1, K.goldD); }),
    up: SP('up', 13, 13, P => { P.ell(6, 6, 5.5, 5.5, K.green); P.ell(6, 5, 4.5, 4, K.greenL); P.ell(6, 6, 4.5, 4.5, '#6FAE4E'); P.poly([[6, 2], [10, 6], [2, 6]], K.white); P.rect(5, 6, 3, 4, K.white); }),
    pin: SP('pin', 5, 5, P => { P.ell(2.5, 2.5, 1.6, 1.6, K.red); P.set(2, 2, K.redL); }),
    lock: ST('lock', `
      ..AAA..
      .A...A.
      .A...A.
      GGGGGGG
      GGGKGGG
      GGGKGGg
      ggggggg`),
  };
  // panfletos das lojas no quadro de cortiça (cada um com a cara da cliente)
  const flyer = {
    konbini: SP('f-konbini', 13, 16, P => { P.rect(1, 1, 11, 14, K.cream); P.rect(1, 1, 11, 2, K.green); P.rect(1, 3, 11, 1, K.ora); P.rect(1, 4, 11, 1, K.blue); P.rect(3, 7, 7, 5, K.glass); P.rect(6, 7, 1, 5, K.steelD); P.rect(3, 13, 7, 1, K.riceS); }),
    sushi: SP('f-sushi', 13, 16, P => { P.rect(1, 1, 11, 14, '#F6E3AE'); P.rect(1, 1, 11, 2, K.red); P.rrect(3, 7, 7, 4, 1, K.rice); P.rrect(3, 5, 7, 3, 1, K.ora); P.rect(4, 6, 2, 1, K.oraL); P.rect(5, 8, 3, 3, K.blk); P.rect(3, 13, 7, 1, K.red); }),
    mochiya: SP('f-mochiya', 13, 16, P => { P.rect(1, 1, 11, 14, '#FBE4EA'); P.rect(1, 1, 11, 2, K.pinkD); P.ell(6.5, 9, 3.5, 2.6, K.white); P.ell(6.5, 6.5, 2.6, 2, K.pink); P.ell(6.5, 4.6, 1.6, 1.3, K.greenL); P.rect(3, 13, 7, 1, K.pinkD); }),
    sake: SP('f-sake', 13, 16, P => { P.rect(1, 1, 11, 14, '#DCE9F2'); P.rect(1, 1, 11, 2, K.blue); P.rect(5, 4, 3, 2, K.blueD); P.rrect(4, 6, 5, 7, 1, K.blue); P.rect(5, 8, 3, 3, K.cream); P.set(6, 9, K.red); P.rect(4, 13, 5, 1, K.blueD); }),
    export: SP('f-export', 13, 16, P => { P.rect(1, 1, 11, 14, '#E8F0D8'); P.rect(1, 1, 11, 2, K.greenD); P.poly([[2, 9], [11, 9], [9, 12], [3, 12]], K.red); P.rect(4, 6, 3, 3, K.ora); P.rect(7, 7, 2, 2, K.blue); P.rect(2, 13, 9, 1, K.glassD); P.rect(2, 12, 2, 1, K.white); }),
  };

  flyer.ramen = SP('f-ramen', 13, 16, P => { P.rect(1, 1, 11, 14, '#FFF1C2'); P.rect(1, 1, 11, 2, K.ora); P.poly([[2, 8], [11, 8], [9, 12], [4, 12]], K.red); P.rect(2, 7, 9, 1, K.cream); P.rect(4, 5, 1, 2, K.riceS); P.rect(7, 4, 1, 3, K.riceS); P.rect(3, 13, 7, 1, K.ora); });
  flyer.outro = SP('f-outro', 13, 16, P => { P.rect(1, 1, 11, 14, K.cream); P.rect(1, 1, 11, 2, K.gold); P.ell(6.5, 9, 3.5, 3, K.rice); P.rect(5, 9, 3, 3, K.blk); P.rect(3, 13, 7, 1, K.goldD); });
  // projeto da Gêmea em traço branco (4 peças, cada uma num sprite sem contorno)
  const BPC = '#EAF2FF';
  const bp = [
    SP('bp0', 66, 42, P => { for (const x of [4, 24, 44]) { P.rrect(x, 33, 17, 7, 3, BPC); P.rect(x + 2, 35, 13, 3, '#34558C'); for (let i = 0; i < 4; i++) P.set(x + 3 + i * 3, 36, BPC); } P.rect(6, 30, 53, 1, BPC); P.rect(12, 31, 1, 2, BPC); P.rect(32, 31, 1, 2, BPC); P.rect(52, 31, 1, 2, BPC); }, false),
    SP('bp1', 66, 42, P => { P.rect(22, 20, 19, 1, BPC); P.rect(22, 29, 19, 1, BPC); P.rect(22, 20, 1, 10, BPC); P.rect(40, 20, 1, 10, BPC); for (const x of [26, 31, 36]) P.rect(x, 23, 2, 3, BPC);
      P.line(26, 20, 31, 4, 1, BPC); P.line(36, 20, 31, 4, 1, BPC); P.line(28, 13, 34, 13, 1, BPC); P.line(22, 23, 5, 19, 1, BPC); P.line(31, 4, 6, 18, 1, BPC); P.rect(2, 18, 6, 1, BPC); P.rect(2, 24, 6, 1, BPC); P.rect(2, 18, 1, 7, BPC); P.rect(7, 18, 1, 7, BPC); }, false),
    SP('bp2', 66, 42, P => { P.line(40, 22, 54, 17, 1, BPC); P.line(40, 26, 54, 21, 1, BPC); for (let i = 0; i < 4; i++) P.line(42 + i * 3, 21.5 - i, 43 + i * 3, 24.5 - i, 1, BPC); P.line(31, 4, 54, 17, 1, BPC);
      P.ring(58.5, 20, 6, 1.2, BPC); P.ring(58.5, 20, 2, 1, BPC); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; P.set(Math.round(58.5 + Math.cos(a) * 7.4), Math.round(20 + Math.sin(a) * 7.4), BPC); } }, false),
    SP('bp3', 66, 42, P => { P.line(31, 4, 49, 7, 1, BPC); P.line(38, 20, 49, 10, 1, BPC); P.ring(54.5, 7, 5, 1.2, BPC); P.ring(54.5, 7, 1.6, 1, BPC); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.3; P.set(Math.round(54.5 + Math.cos(a) * 6.4), Math.round(7 + Math.sin(a) * 6.4), BPC); } }, false),
  ];
  const flyerOf = id => flyer[id] || flyer.outro;

  /* ======================================================================
     CENÁRIO FIXO  (parede + piso em baixa resolução 480×270, ampliado 2×; objetos parados por cima)
     ====================================================================== */
  let bgCv = null, sunCv = null, duskCv = null;
  function mk() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
  function paintBg() {
    const lo = document.createElement('canvas'); lo.width = W / 2; lo.height = H / 2;
    const b = lo.getContext('2d'), R = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(x, y, w, h); }, rng = E.RNG(29);
    const wy = WALL / 2;                                     // 100
    // ---- piso de concreto: placas com tons diferentes, juntas, pedrinhas, rachaduras
    R(0, wy, 480, 270 - wy, K.conc);
    const rows = [100, 122, 148, 178, 212, 250, 270];
    for (let r = 0; r < rows.length - 1; r++) {
      const y0 = rows[r], y1 = rows[r + 1];
      let x = -((r * 37) % 60);
      while (x < 480) {
        const len = 70 + Math.floor(rng() * 40), tone = rng();
        R(x, y0, len, y1 - y0, tone < 0.3 ? '#CEBE9F' : tone < 0.7 ? K.conc : '#BEAC8C');
        R(x + len - 1, y0, 1, y1 - y0, '#A5936F'); R(x, y0, 1, y1 - y0, '#D8C9AB');
        x += len;
      }
      R(0, y0, 480, 1, '#A08E6C'); R(0, y0 + 1, 480, 1, '#D8C9AB');
    }
    for (let i = 0; i < 520; i++) { const x = Math.floor(rng() * 480), y = wy + 2 + Math.floor(rng() * 166); R(x, y, rng() < 0.2 ? 2 : 1, 1, rng() < 0.55 ? '#B5A382' : '#D9CAAC'); }
    b.strokeStyle = '#9A8866'; b.lineWidth = 1;
    for (const [x, y, n] of [[300, 128, 5], [52, 236, 6], [420, 190, 4], [150, 170, 3]]) { b.beginPath(); let px = x + 0.5, py = y + 0.5; b.moveTo(px, py); for (let i = 0; i < n; i++) { px += 3 + Math.floor(rng() * 6); py += Math.floor(rng() * 5) - 2; b.lineTo(px, py); } b.stroke(); }
    // marcas de pneu da porta até o elevador
    b.strokeStyle = 'rgba(70,58,46,.16)'; b.lineWidth = 3;
    for (const o of [0, 14]) { b.beginPath(); b.moveTo(52 + o, 101); b.bezierCurveTo(60 + o, 150, 150 + o, 196 - o * 0.4, 236, 206 - o * 0.5); b.stroke(); }
    // manchas de óleo
    for (const [x, y, rx, ry] of [[118, 160, 9, 3], [36, 162, 6, 2], [88, 232, 10, 3], [296, 226, 12, 3], [206, 136, 7, 2], [392, 124, 8, 2], [150, 126, 5, 2]]) {
      b.fillStyle = 'rgba(64,50,40,.20)'; b.beginPath(); b.ellipse(x, y, rx, ry, 0, 0, TAU); b.fill();
      b.fillStyle = 'rgba(52,40,34,.26)'; b.beginPath(); b.ellipse(x - 1, y, rx * 0.55, ry * 0.6, 0, 0, TAU); b.fill();
      R(x - 2, y - 1, 2, 1, 'rgba(255,255,255,.22)');
    }
    // vagas pintadas no chão (amarelo gasto) com número de estêncil
    const worn = (x, y, w, h) => { for (let i = 0; i < w; i += 2) for (let j = 0; j < h; j++) if (rng() > 0.2) R(x + i, y + j, 2, 1, rng() < 0.7 ? '#E0B43C' : '#C89C2E'); };
    const DIG = { 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'] };
    const bay = (x0, x1, y0, y1, n) => {
      worn(x0, y1, x1 - x0, 2); worn(x0, y0, 2, y1 - y0); worn(x1 - 2, y0, 2, y1 - y0);
      DIG[n].forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') R(x0 + 5 + i * 2, y1 - 13 + j * 2, 2, 2, 'rgba(226,182,60,.75)'); });
    };
    bay(4, 60, 134, 156, 1); bay(64, 124, 134, 156, 2); bay(2, 62, 200, 229, 3); bay(64, 152, 200, 229, 4);
    // área de trabalho pintada (epóxi cinza-azulado gasto) com borda amarela, embaixo da plataforma giratória
    {
      const x0 = 150, x1 = 346, y0 = 188, y1 = 236;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
        if (e < 2) { if (rng() > 0.14) R(x, y, 1, 1, rng() < 0.75 ? '#E0B43C' : '#C89C2E'); continue; }
        if (rng() < 0.035) continue;                           // falha na tinta: aparece o concreto
        R(x, y, 1, 1, ((x * 7 + y * 13) % 11 === 0) ? '#B4C2BD' : ((x + y * 3) % 17 === 0) ? '#93A6A1' : '#A3B5B0');
      }
      for (let i = 0; i < 14; i++) { const x = x0 + 6 + Math.floor(rng() * (x1 - x0 - 16)), y = y0 + 4 + Math.floor(rng() * (y1 - y0 - 8)); R(x, y, 3 + Math.floor(rng() * 5), 1, '#BBAA8A'); R(x + 1, y + 1, 2 + Math.floor(rng() * 3), 1, K.conc); }
      R(x0 + 2, y0 + 2, x1 - x0 - 4, 1, '#B9C7C2');
    }
    // ralo
    R(232, 238, 14, 5, '#8A7C66'); for (let x = 233; x < 245; x += 2) R(x, 239, 1, 3, '#4A4038');
    // ---- mais vida no piso (sem entulhar): vagas pintadas do carrinho e da britadeira, zona zebrada na porta, setas até o
    //      elevador, faixa de pedestre junto da parede e a mangueira de ar que sai do carretel e vai até a britadeira
    {
      const r2 = E.RNG(131), wornB = (x, y, w, h, c1, c2) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if (r2() > 0.22) R(x + i, y + j, 1, 1, r2() < 0.7 ? c1 : c2); };
      DIG[5] = ['###', '#..', '###', '..#', '###']; DIG[6] = ['###', '#..', '###', '#.#', '###'];
      bay(139, 181, 106, 126, 5); bay(187, 240, 106, 126, 6);
      // zebrado "não estacione" na soleira da porta de enrolar
      for (let x = 12; x < 120; x++) for (let y = 103; y < 110; y++) if (((x + y) >> 2) % 2 === 0 && r2() > 0.18) R(x, y, 1, 1, r2() < 0.7 ? '#E0B43C' : '#C89C2E');
      // setas (chevrons) da porta pro elevador, por cima das marcas de pneu
      for (const [cx, cy] of [[96, 150], [128, 172], [162, 190]]) for (let k = 0; k < 6; k++) { wornB(cx + k, cy - 6 + k, 2, 2, '#E8DFC8', '#D4C8AA'); wornB(cx + k, cy + 6 - k, 2, 2, '#E8DFC8', '#D4C8AA'); }
      // faixa de pedestre verde junto da parede, da bancada até o painel de ferramentas
      for (let x = 246; x < 336; x += 7) wornB(x, 104, 4, 9, '#9CC6A4', '#86B28E');
      wornB(244, 102, 94, 1, '#E8DFC8', '#D4C8AA'); wornB(244, 114, 94, 1, '#E8DFC8', '#D4C8AA');
      // mangueira de ar: desce do carretel (parede), faz uma barriga no chão e chega na vaga 6
      b.lineCap = 'round'; b.lineJoin = 'round';
      for (const [col, lw, dy] of [['#5E2A22', 3, 1], ['#C8423A', 2, 0], ['#E8776A', 1, -0.5]]) {
        b.strokeStyle = col; b.lineWidth = lw; b.beginPath(); b.moveTo(184.5, 96 + dy); b.bezierCurveTo(184, 110 + dy, 176, 128 + dy, 190, 130 + dy); b.bezierCurveTo(204, 132 + dy, 196, 122 + dy, 210, 123 + dy); b.stroke();
      }
    }

    // ---- parede: caibros escuros no alto (o HUD mora ali), viga de aço, reboco creme, lambri verde-menta
    R(0, 0, 480, 22, '#3A2516');
    for (let x = -4; x < 480; x += 22) { R(x + 8, 0, 6, 17, '#4C311E'); R(x + 8, 0, 1, 17, '#5E3E26'); R(x + 13, 0, 1, 17, '#2E1C10'); }
    R(0, 16, 480, 6, '#6B7480'); R(0, 16, 480, 1, '#98A2AE'); R(0, 21, 480, 1, '#434B55'); R(0, 18, 480, 1, '#7C8692');
    for (let x = 10; x < 480; x += 26) { R(x, 19, 2, 1, '#434B55'); R(x, 18, 1, 1, '#B0BAC6'); }
    R(0, 22, 480, 42, '#EDDFBF');
    for (let i = 0; i < 150; i++) R(Math.floor(rng() * 478), 23 + Math.floor(rng() * 40), 2 + Math.floor(rng() * 4), 1, rng() < 0.5 ? '#E4D3AE' : '#F4E9CE');
    R(0, 22, 480, 2, '#D2BE98'); R(0, 24, 480, 1, '#E0CFAB');
    R(0, 64, 480, 2, '#7A5228'); R(0, 64, 480, 1, '#A47440');
    R(0, 66, 480, 30, K.mint);
    for (let x = 0; x < 480; x += 8) { R(x, 66, 1, 30, K.mintD); R(x + 1, 66, 1, 30, K.mintL); }
    for (let i = 0; i < 46; i++) { const x = Math.floor(rng() * 476), y = 68 + Math.floor(rng() * 26); R(x, y, 1 + Math.floor(rng() * 3), 1, rng() < 0.5 ? '#C9DCD2' : K.mintDD); }
    for (let i = 0; i < 9; i++) { const x = Math.floor(rng() * 470), y = 84 + Math.floor(rng() * 9); R(x, y, 3, 2, '#D9C7A6'); R(x + 1, y + 1, 2, 1, '#B89E76'); }   // tinta descascada
    R(0, 66, 480, 1, '#6A8E7F'); R(0, 96, 480, 4, '#5E3E1E'); R(0, 96, 480, 1, '#8E6232'); R(0, 99, 480, 1, '#3E2814');
    for (const px of [126, 349]) { R(px, 22, 4, 78, '#7A5228'); R(px, 22, 1, 78, '#9A6C38'); R(px + 3, 22, 1, 78, '#5E3E1E'); }
    // ---- porta de enrolar: caixa do rolo, trilhos de aço e soleira (o vão é recortado depois)
    {
      const d = geo.door, x = d.x / 2, y = d.y / 2, w = d.w / 2;
      R(x - 4, 22, w + 8, 8, '#7B8591'); R(x - 4, 22, w + 8, 1, '#A9B3BF'); R(x - 4, 29, w + 8, 1, '#4A525C');
      for (let i = 0; i < 3; i++) R(x - 3, 24 + i * 2, w + 6, 1, '#636D79');
      R(x - 4, y, 4, wy - y, '#59626E'); R(x - 4, y, 1, wy - y, '#8792A0'); R(x + w, y, 4, wy - y, '#59626E'); R(x + w + 3, y, 1, wy - y, '#3E4650');
      R(x - 6, wy - 1, w + 12, 3, '#808A96'); R(x - 6, wy - 1, w + 12, 1, '#B4BEC9'); R(x - 6, wy + 2, w + 12, 1, '#4A525C');
      for (let i = x - 6; i < x + w + 6; i += 6) R(i, wy, 3, 2, '#E6B93C');
    }
    // ---- painel perfurado das ferramentas de mão
    {
      const p = geo.peg, x = p.x / 2, y = p.y / 2, w = p.w / 2, h = p.h / 2;
      R(x, y, w, h, '#7A5228'); R(x, y, w, 1, '#A47440'); R(x + 2, y + 2, w - 4, h - 4, '#D8AC70'); R(x + 2, y + 2, w - 4, 1, '#E6BE86');
      for (let j = y + 5; j < y + h - 3; j += 4) for (let i = x + 5; i < x + w - 3; i += 4) R(i, j, 1, 1, '#B58A52');
      R(x + 2, y + h - 3, w - 4, 1, '#BE9258');
    }
    // ---- prancheta azul do projeto (o desenho e as peças entram ao vivo)
    {
      const p = geo.plan, x = p.x / 2, y = p.y / 2, w = p.w / 2, h = p.h / 2;
      R(x, y, w, h, '#7A5228'); R(x, y, w, 1, '#A47440'); R(x + 2, y + 2, w - 4, h - 4, '#34558C'); R(x + 2, y + 2, w - 4, 1, '#4868A0');
      for (let i = x + 6; i < x + w - 2; i += 6) R(i, y + 2, 1, h - 4, '#3F609A');
      for (let j = y + 6; j < y + h - 2; j += 6) R(x + 2, j, w - 4, 1, '#3F609A');
      R(x + 2, y + h - 3, w - 4, 1, '#2A4678');
    }
    // ---- quadro da fábrica do pátio (foto emoldurada)
    {
      const p = geo.fab, x = p.x / 2, y = p.y / 2, w = p.w / 2, h = p.h / 2;
      R(x, y, w, h, '#5E3E1E'); R(x, y, w, 1, '#8E6232'); R(x + 2, y + 2, w - 4, h - 4, '#BFE3F0'); R(x + 2, y + 2, w - 4, 8, '#9FD3E8');
      R(x + 2, y + h - 12, w - 4, 10, '#A9C08A'); R(x + 2, y + h - 12, w - 4, 1, '#C4D6A8');
      b.fillStyle = '#FFFDF6'; b.beginPath(); b.ellipse(x + 13, y + h - 11, 13, 14, 0, Math.PI, TAU); b.fill();          // montanha de arroz
      R(x + 22, y + 18, 22, 14, '#F0E6D2'); for (let i = 0; i < 3; i++) R(x + 24 + i * 7, y + 22, 4, 4, '#8FB6D3');     // galpão
      b.fillStyle = '#B5523B'; b.beginPath(); b.moveTo(x + 20, y + 19); b.lineTo(x + 46, y + 19); b.lineTo(x + 42, y + 12); b.lineTo(x + 24, y + 12); b.closePath(); b.fill();
      R(x + 30, y + 26, 6, 6, '#6B4A32'); R(x + 40, y + 6, 3, 8, '#8A96A3'); R(x + 40, y + 9, 3, 1, '#D8574E');
    }
    // ---- quadro de cortiça das clientes
    {
      const p = geo.cork, x = p.x / 2, y = p.y / 2, w = p.w / 2, h = p.h / 2;
      R(x, y, w, h, '#7A5228'); R(x, y, w, 1, '#A47440'); R(x + 2, y + 2, w - 4, h - 4, K.cork);
      for (let i = 0; i < 90; i++) R(x + 2 + Math.floor(rng() * (w - 5)), y + 2 + Math.floor(rng() * (h - 5)), 1, 1, rng() < 0.5 ? K.corkL : K.corkD);
      R(x + 2, y + 2, w - 4, 1, K.corkL); R(x + 2, y + h - 3, w - 4, 1, K.corkD);
    }
    // ---- janela (o vidro é recortado depois)
    { const p = geo.win, x = p.x / 2, y = p.y / 2, w = p.w / 2, h = p.h / 2; R(x - 2, y - 2, w + 4, h + 4, '#5E3E1E'); R(x - 2, y - 2, w + 4, 1, '#8E6232'); R(x - 3, y + h + 2, w + 6, 2, '#C99458'); R(x - 3, y + h + 4, w + 6, 1, '#7A5228'); }
    // ---- bancada: tampo grosso de madeira e gaveteiro vermelho
    {
      const p = geo.bench, x = p.x / 2, y = p.y / 2, w = p.w / 2;
      R(x - 1, y + 4, w + 2, 3, '#7A5228'); R(x - 1, y, w + 2, 5, '#CF9E63'); R(x - 1, y, w + 2, 1, '#E2B983'); R(x - 1, y + 4, w + 2, 1, '#A9763F');
      for (let i = x + 9; i < x + w; i += 17) R(i, y + 1, 1, 3, '#B98A52');
      R(x + 2, y + 7, 3, 16, '#5B6470'); R(x + w - 5, y + 7, 3, 16, '#5B6470');
      R(x + 8, y + 7, 40, 15, '#C8423A'); R(x + 8, y + 7, 40, 1, '#E8776A'); R(x + 46, y + 7, 2, 15, '#93302A');
      for (let j = 0; j < 3; j++) { R(x + 9, y + 11 + j * 4, 38, 1, '#93302A'); R(x + 24, y + 9 + j * 4, 8, 1, '#E8EDF2'); }
      R(x + 52, y + 12, 28, 2, '#7A5228'); R(x + 52, y + 12, 28, 1, '#A9763F');   // prateleira de baixo
    }
    // ---- amplia 2× e recorta porta e janela
    bgCv = mk(); const g = bgCv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(lo, 0, 0, W, H);
    g.clearRect(geo.door.x, geo.door.y, geo.door.w, geo.door.h); g.clearRect(geo.win.x, geo.win.y, geo.win.w, geo.win.h);
    // porta meio enrolada: três ripas penduradas + corrente
    { const d = geo.door; for (let i = 0; i < 3; i++) { g.fillStyle = '#8792A0'; g.fillRect(d.x, d.y + i * 6, d.w, 6); g.fillStyle = '#B4BEC9'; g.fillRect(d.x, d.y + i * 6, d.w, 2); g.fillStyle = '#59626E'; g.fillRect(d.x, d.y + i * 6 + 5, d.w, 1); }
      g.fillStyle = INK; g.fillRect(d.x, d.y + 18, d.w, 2); g.fillStyle = '#E6B93C'; g.fillRect(d.x + d.w / 2 - 14, d.y + 14, 28, 4); }
    // caixilho da janela
    { const p = geo.win; g.fillStyle = '#5E3E1E'; g.fillRect(p.x + p.w / 2 - 2, p.y, 4, p.h); g.fillRect(p.x, p.y + p.h / 2 - 2, p.w, 4); g.fillStyle = '#8E6232'; g.fillRect(p.x + p.w / 2 - 2, p.y, 2, p.h); g.fillRect(p.x, p.y + p.h / 2 - 2, p.w, 2); }
    // objetos parados: chaves e dentes de reserva embaixo do quadro, calendário, extintor, morsa, lata de óleo, pneus, tambor
    for (let i = 0; i < 3; i++) blit(g, spr.wrench, 590 + i * 14, 192 - i * 2);
    for (let i = 0; i < 4; i++) blit(g, spr.tooth, 636 + i * 15, 186);
    g.fillStyle = INK; g.fillRect(628, 158, 60, 3); g.fillStyle = K.steel; g.fillRect(628, 158, 60, 1);
    blit(g, spr.calendar, 844, 100);
    blit(g, spr.exting, 255, 180);
    blit(g, spr.vise, 736, 184); blit(g, spr.oilcan, 866, 182); blit(g, spr.toolbox, 846, 222 + 2);
    shadow(g, 920, 224, 34, 6, 0.3); blit(g, spr.tires, 920, 226);
    shadow(g, 676, 252, 20, 5); blit(g, spr.drum, 676, 254); blit(g, spr.broom, 696, 238, 2, { rot: 0.12 });
    shadow(g, 244, 378, 22, 5); blit(g, spr.cart, 244, 380);
    shadow(g, 132, 362, 26, 4, 0.2); blit(g, spr.creeper, 132, 364); shadow(g, 26, 368, 14, 4, 0.2); blit(g, spr.jack, 26, 370); blit(g, spr.oilpan, 172, 384);
    shadow(g, 318, 470, 13, 4); blit(g, spr.cone, 318, 472); shadow(g, 668, 468, 13, 4); blit(g, spr.cone, 670, 470);
    // peças novas: carretel da mangueira, caixotes de peças com engrenagens, segundo carrinho, balde
    blit(g, spr.reel, 369, 198);
    shadow(g, 296, 330, 30, 5); blit(g, spr.crate, 284, 332); blit(g, spr.crate, 312, 334); blit(g, spr.crateS, 296, 304); blit(g, spr.gear, 318, 306); blit(g, spr.gear, 268, 334, 2, { rot: 0.5 });
    shadow(g, 604, 300, 22, 5); blit(g, spr.cart2, 604, 302); blit(g, spr.bucket, 574, 304);
    // sombra de contato: parede/piso, cantos, frente do palco e teto
    let gr = g.createLinearGradient(0, WALL, 0, WALL + 34); gr.addColorStop(0, 'rgba(58,30,10,.36)'); gr.addColorStop(1, 'rgba(58,30,10,0)'); g.fillStyle = gr; g.fillRect(0, WALL, W, 34);
    gr = g.createLinearGradient(0, 0, 46, 0); gr.addColorStop(0, 'rgba(58,30,10,.28)'); gr.addColorStop(1, 'rgba(58,30,10,0)'); g.fillStyle = gr; g.fillRect(0, WALL, 46, H - WALL);
    gr = g.createLinearGradient(W, 0, W - 46, 0); gr.addColorStop(0, 'rgba(58,30,10,.28)'); gr.addColorStop(1, 'rgba(58,30,10,0)'); g.fillStyle = gr; g.fillRect(W - 46, WALL, 46, H - WALL);
    gr = g.createLinearGradient(0, H - 90, 0, H); gr.addColorStop(0, 'rgba(58,30,10,0)'); gr.addColorStop(1, 'rgba(58,30,10,.34)'); g.fillStyle = gr; g.fillRect(0, H - 90, W, 90);
    gr = g.createLinearGradient(0, 0, 0, 30); gr.addColorStop(0, 'rgba(20,10,4,.45)'); gr.addColorStop(1, 'rgba(20,10,4,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 30);
  }
  // luz do dia: o sol entra pela porta aberta e pela janela
  function paintSun() {
    sunCv = mk(); const g = sunCv.getContext('2d'), d = geo.door;
    let gr = g.createLinearGradient(0, WALL, 0, WALL + 230); gr.addColorStop(0, 'rgba(255,246,206,.50)'); gr.addColorStop(0.5, 'rgba(255,246,206,.18)'); gr.addColorStop(1, 'rgba(255,246,206,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(d.x + 4, WALL + 3); g.lineTo(d.x + d.w - 4, WALL + 3); g.lineTo(d.x + d.w + 120, WALL + 230); g.lineTo(d.x + 10, WALL + 230); g.closePath(); g.fill();
    const p = geo.win;
    for (let i = 0; i < 2; i++) {
      const a = p.x + 4 + i * 40, top = WALL - 24, bot = WALL + 120;
      gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, 'rgba(255,240,180,.40)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(a, top); g.lineTo(a + 30, top); g.lineTo(a + 30 - (bot - top) * 0.5, bot); g.lineTo(a - (bot - top) * 0.5 - 14, bot); g.closePath(); g.fill();
    }
  }
  // luz da tarde/noite: poças quentes embaixo das luminárias (somadas por cima de um véu azul)
  function paintDusk() {
    duskCv = mk(); const g = duskCv.getContext('2d');
    for (const lx of geo.lamps) {
      let gr = g.createRadialGradient(lx, 80, 4, lx, 80, 130); gr.addColorStop(0, 'rgba(255,200,110,.55)'); gr.addColorStop(1, 'rgba(255,200,110,0)');
      g.fillStyle = gr; g.fillRect(lx - 130, 0, 260, 220);
      g.save(); g.translate(lx, 330); g.scale(1, 0.5); gr = g.createRadialGradient(0, 0, 10, 0, 0, 200); gr.addColorStop(0, 'rgba(255,196,110,.36)'); gr.addColorStop(1, 'rgba(255,196,110,0)');
      g.fillStyle = gr; g.fillRect(-200, -200, 400, 400); g.restore();
    }
  }

  /* ======================================================================
     MÁQUINAS DE VERDADE: bake (parada, numa imagem) e live (viva, no elevador)
     ====================================================================== */
  // caixa de cada desenho no espaço do modelo [x0, y0, x1, y1] (medido; sem o cabo comprido da pá elétrica)
  const BB = {
    pata: [-24, -44, 24, 3], hashi: [-32, -44, 36, 3], tigela: [-24, -44, 26, 3], pa: [-24, -46, 24, 6], duaspas: [-24, -46, 30, 6],
    carrinho: [-22, -29, 60, 4], britadeira: [-60, -50, 17, 4],
    trator: [-58, -127, 111, 6], empilhadeira: [-62, -119, 94, 7], colheita: [-102, -146, 105, 8], escav: [-104, -195, 231, 9],
    caminhao: [-183, -206, 196, 11], pacabo: [-236, -496, 420, 11], bagger: [-770, -764, 764, 6],
  };
  const BBN = { carrinho: [15, -31, 63, 5] };                 // caixa do desenho SEM o Kome (só o carrinho muda: sai a sombra dele)
  const HAND = { pata: 1, hashi: 1, tigela: 1, pa: 1, duaspas: 1, carrinho: 1, britadeira: 1 };   // com o Kome segurando no elevador
  const CLIPOUT = { britadeira: [-24, -50, 30, 23] };       // chapéu do Kome que a britadeira desenha solto: fora do desenho "sem cachorro"
  const INP = { x: 0, y: 0, face: 1, floor: () => 0, digging: false, power: 1, tx: null, ty: null, zoom: 1, night: 0 };
  const NOEX = () => ({ pulse: 0, count: 0, update() {}, burst() {}, clear() {}, draw() {} });
  let nodog = null;
  const donors = {};
  function donor(id, o) {
    o = o || {};
    const key = id + (o.dog ? 'D' + (o.pal || '') : '') + (o.smoke ? 'S' : '');
    if (donors[key]) return donors[key];
    const T = G.Tools[id]; if (!T) return null;
    const ex0 = E.Exhaust; let m = null;
    if (!o.smoke) E.Exhaust = NOEX;
    try { m = T.create({ pilot: o.pal || 'kome' }); } finally { E.Exhaust = ex0; }
    INP.face = 1;
    for (let i = 0; i < 150; i++) T.update(m, 1 / 60, INP);
    return (donors[key] = m);
  }
  // desenha a máquina no contexto já posicionado (origem = zero da máquina, escala s); dog=false tira os shibas
  function drawTool(g, id, m, s, dog) {
    const T = G.Tools[id], z0 = D.zoom, m0 = D.minPx, sh0 = E.drawShiba;
    if (!nodog) nodog = Object.assign(function () {}, sh0);
    D.lod(s, 0);
    if (!dog) E.drawShiba = nodog;
    g.save();
    try {
      const co = !dog && CLIPOUT[id];
      if (co) { const b = BB[id]; g.beginPath(); g.rect(b[0] - 40, b[1] - 60, b[2] - b[0] + 80, b[3] - b[1] + 80); g.rect(co[0], co[1], co[2], co[3]); g.clip('evenodd'); }
      T.draw(g, m);
    } finally { g.restore(); E.drawShiba = sh0; D.lod(z0, m0); }
  }
  /* bake(id, s, dpr, haze) -> {cv, dx, dy, w, h}: máquina parada, sem cachorro, numa imagem (dx/dy = canto em relação ao zero) */
  const bakes = {};
  function bake(id, s, dpr, haze) {
    dpr = dpr || 1;
    const key = id + '|' + s + '|' + dpr + '|' + (haze || 0);
    if (bakes[key]) return bakes[key];
    const b = BBN[id] || BB[id], pad = 4, w = (b[2] - b[0]) * s + pad * 2, h = (b[3] - b[1]) * s + pad * 2;
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w * dpr)); cv.height = Math.max(1, Math.ceil(h * dpr));
    const g = cv.getContext('2d');
    const m = donor(id);
    if (m) {
      g.setTransform(dpr * s, 0, 0, dpr * s, (pad - b[0] * s) * dpr, (pad - b[1] * s) * dpr);
      try { drawTool(g, id, m, s * dpr, false); } catch (err) { if (window.console) console.warn('[kome] oficina bake ' + id, err); }
      if (haze) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = haze; g.fillRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'source-over'; }
    }
    return (bakes[key] = { cv, dx: b[0] * s - pad, dy: b[1] * s - pad, w, h });
  }
  function drawBake(g, bk, x, y, o) {
    const pa = g.globalAlpha; if (o && o.alpha !== undefined) g.globalAlpha = pa * o.alpha;
    g.imageSmoothingEnabled = true;
    g.drawImage(bk.cv, x + bk.dx, y + bk.dy, bk.w, bk.h);
    g.globalAlpha = pa;
  }
  /* glow(id, s, dpr, cor) -> friso em volta da máquina (a silhueta engordada numa cor só): marco 25 prata, marco 50 ouro */
  const glows = {};
  function glow(id, s, dpr, col, r) {
    const key = id + '|' + s + '|' + dpr + col + r;
    if (glows[key]) return glows[key];
    const bk = bake(id, s, dpr), p = Math.ceil(r * dpr) + 1;
    const cv = document.createElement('canvas'); cv.width = bk.cv.width + p * 2; cv.height = bk.cv.height + p * 2;
    const g = cv.getContext('2d');
    for (let a = 0; a < 12; a++) g.drawImage(bk.cv, p + Math.cos(a / 12 * TAU) * r * dpr, p + Math.sin(a / 12 * TAU) * r * dpr);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, cv.width, cv.height);
    return (glows[key] = { cv, dx: bk.dx - p / dpr, dy: bk.dy - p / dpr, w: cv.width / dpr, h: cv.height / dpr });
  }
  /* live(id, pal) -> máquina viva pro elevador: {id, m, hand}; liveTick avança o motor parado; liveDraw desenha */
  function live(id, pal) { const hand = !!HAND[id]; return { id, hand, m: donor(id, hand ? { dog: true, pal } : { smoke: true }) }; }
  function liveTick(lv, dt) { if (!lv || !lv.m) return; INP.face = 1; try { G.Tools[lv.id].update(lv.m, dt, INP); } catch (err) { /* desenho segue parado */ } if (lv.m.ev) lv.m.ev.length = 0; }
  function liveDraw(g, lv, x, y, s, dpr, o) {
    if (!lv || !lv.m) return;
    const sx = (o && o.sx) || 1, sy = (o && o.sy) || 1;
    g.save(); g.translate(x, y); g.scale(s * sx, s * sy);
    try { drawTool(g, lv.id, lv.m, s * (dpr || 1), lv.hand); } catch (err) { /* */ }
    g.restore();
  }
  // escala de cada máquina em cima do elevador: toda máquina nova fica MAIOR na tela
  const LIFT_S = { pata: 3, hashi: 3, tigela: 3, pa: 3, duaspas: 3, carrinho: 2.7, britadeira: 2.5, trator: 1.42, empilhadeira: 1.5, colheita: 1.36, escav: 1.0, caminhao: 0.97, pacabo: 0.51, bagger: 0.264 };
  // onde fica o zero da máquina pra ela ficar centrada no elevador
  function liftPos(id) { const b = BB[id], s = LIFT_S[id] || 1, hand = HAND[id]; return { s, ox: hand ? (id === 'carrinho' ? -16 * s : id === 'britadeira' ? 18 * s : 0) : -(b[0] + b[2]) / 2 * s, w: (b[2] - b[0]) * s, h: -b[1] * s, x0: b[0] * s, x1: b[2] * s }; }

  /* ======================================================================
     MECÂNICOS (shiba de boné; a máscara de solda entra quando está soldando)
     ====================================================================== */
  const ANC = { x: 0, y: 0 };
  function mech(g, x, y, pose, t, o) {
    o = o || {};
    const sc = o.scale || 1, face = o.face || 1, hatK = o.hat === undefined ? 'cap' : o.hat;
    const tt = E.drawShiba.frameT ? E.drawShiba.frameT(t, null, pose) : t;
    E.drawShiba(g, x, y, pose, t, { scale: sc, pal: o.pal || 'kome', face, hat: !hatK, shadow: o.shadow !== false, alpha: o.alpha });
    if (pose === 'sleep' || pose === 'lie') return;
    g.imageSmoothingEnabled = false;
    if (hatK && spr[hatK]) {
      E.shibaAnchor(pose, tt, 'head', ANC, { hat: false });
      const cv = spr[hatK], off = hatK === 'mask' ? 1 : -6;
      const w = cv.width * sc, h = cv.height * sc, hx = x + ANC.x * sc * face + (hatK === 'mask' ? 2 * face * sc : 0), hy = y + ANC.y * sc + off * sc;
      if (face < 0) { g.save(); g.translate(Math.round(hx), 0); g.scale(-1, 1); g.drawImage(cv, Math.round(-w / 2), Math.round(hy - h / 2), w, h); g.restore(); }
      else g.drawImage(cv, Math.round(hx - w / 2), Math.round(hy - h / 2), w, h);
    }
    if (o.tool && spr[o.tool]) {                             // ferramenta na pata, girando
      E.shibaAnchor(pose, tt, 'paw', ANC, { hat: false });
      const px = x + ANC.x * sc * face, py = y + ANC.y * sc;
      g.save(); g.translate(Math.round(px), Math.round(py)); g.scale(face, 1); g.rotate(o.rot || 0);
      const cv = spr[o.tool]; g.drawImage(cv, -2 * sc, -cv.height * sc / 2, cv.width * sc * 1.5, cv.height * sc * 1.5); g.restore();
      ANC.x = px + face * Math.cos(o.rot || 0) * cv.width * 1.4 * sc; ANC.y = py + Math.sin(o.rot || 0) * cv.width * 1.4 * sc;   // ponta da ferramenta (faísca sai daqui)
    }
  }

  /* ======================================================================
     O PÁTIO LÁ FORA (pela porta de enrolar): céu da hora do dia, montanha de arroz e as gigantes que não cabem
     ====================================================================== */
  const SKY = { top: '#8FCBE6', mid: '#BFE3F0', bot: '#F3EBD2' };
  /* yard(g, t, L, {dpr, show:{bagger, pacabo, caminhao}, night}) */
  function yard(g, t, L, o) {
    const d = geo.door, s = L || SKY;
    { const p = geo.win; g.fillStyle = s.top || SKY.top; g.fillRect(p.x, p.y, p.w, p.h * 0.5); g.fillStyle = s.mid || SKY.mid; g.fillRect(p.x, p.y + p.h * 0.5, p.w, p.h * 0.5); g.fillStyle = 'rgba(255,255,255,.7)'; const cx2 = p.x + ((t * 3) % (p.w + 60)) - 30; g.fillRect(Math.round(cx2), p.y + 14, 26, 6); g.fillRect(Math.round(cx2) + 6, p.y + 9, 12, 5); if (o.night > 0.03) { g.fillStyle = 'rgba(30,24,70,' + (o.night * 0.5).toFixed(3) + ')'; g.fillRect(p.x, p.y, p.w, p.h); } }
    g.save(); g.beginPath(); g.rect(d.x, d.y, d.w, d.h); g.clip();
    g.fillStyle = s.top || SKY.top; g.fillRect(d.x, d.y, d.w, d.h * 0.4); g.fillStyle = s.mid || SKY.mid; g.fillRect(d.x, d.y + d.h * 0.36, d.w, d.h * 0.34); g.fillStyle = s.bot || SKY.bot; g.fillRect(d.x, d.y + d.h * 0.66, d.w, d.h * 0.34);
    // nuvem passando
    const cx = d.x + ((t * 4) % (d.w + 120)) - 60; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(Math.round(cx), d.y + 32, 44, 8); g.fillRect(Math.round(cx) + 8, d.y + 26, 24, 6);
    // montanha de arroz, morros e chão de terra do pátio
    g.fillStyle = INK; g.beginPath(); g.ellipse(d.x + 196, d.y + d.h + 30, 118, 104, 0, 0, TAU); g.fill();
    g.fillStyle = K.riceS; g.beginPath(); g.ellipse(d.x + 196, d.y + d.h + 30, 116, 102, 0, 0, TAU); g.fill();
    g.fillStyle = K.rice; g.beginPath(); g.ellipse(d.x + 188, d.y + d.h + 26, 106, 94, 0, 0, TAU); g.fill();
    g.fillStyle = K.white; for (let i = 0; i < 7; i++) g.fillRect(d.x + 122 + ((i * 37) % 84), d.y + 62 + ((i * 23) % 40), 3, 2);
    g.fillStyle = '#8FB07A'; g.beginPath(); g.ellipse(d.x + 30, d.y + d.h - 6, 90, 30, 0, 0, TAU); g.fill();
    g.fillStyle = '#C9B48C'; g.fillRect(d.x, d.y + d.h - 26, d.w, 26); g.fillStyle = '#DBC9A4'; g.fillRect(d.x, d.y + d.h - 26, d.w, 2);
    g.fillStyle = '#B5A07A'; for (let i = 0; i < 9; i++) g.fillRect(d.x + 8 + ((i * 53) % (d.w - 20)), d.y + d.h - 20 + ((i * 7) % 16), 10, 2);
    for (const id of ['bagger', 'pacabo', 'caminhao']) {
      if (!o.show[id]) continue;
      const y = geo.yard[id], bk = bake(id, y.s, o.dpr, y.hz ? 'rgba(191,224,238,' + y.hz + ')' : 0);
      shadow(g, d.x + y.x + (bk.dx + bk.w / 2), y.y, bk.w * 0.42, 4, 0.2);
      drawBake(g, bk, d.x + y.x, y.y);
    }
    if (o.night > 0.03) { g.fillStyle = 'rgba(30,24,70,' + (o.night * 0.5).toFixed(3) + ')'; g.fillRect(d.x, d.y, d.w, d.h); }
    g.restore();
  }
  // o caminhão "põe o nariz pra dentro": a parte de baixo dele passa por cima da soleira (desenhar DEPOIS do cenário)
  function yardPoke(g, o) {
    if (!o.show.caminhao) return;
    const d = geo.door, y = geo.yard.caminhao, bk = bake('caminhao', y.s, o.dpr, 0);
    g.save(); g.beginPath(); g.rect(d.x, d.y + d.h, d.w, 14); g.clip(); drawBake(g, bk, d.x + y.x, y.y); g.restore();
  }
  // retângulo (palco) de cada gigante no pátio, pro toque
  function yardRect(id) { const d = geo.door, y = geo.yard[id], b = BB[id]; const x0 = Math.max(d.x, d.x + y.x + b[0] * y.s), x1 = Math.min(d.x + d.w, d.x + y.x + b[2] * y.s), y0 = Math.max(d.y, y.y + b[1] * y.s); return { x: x0, y: y0, w: x1 - x0, h: Math.min(d.y + d.h + 12, y.y) - y0 }; }

  /* ======================================================================
     PAREDE VIVA
     ====================================================================== */
  const PEG = [['pata', 22, 96], ['hashi', 50, 104], ['tigela', 78, 78], ['pa', 106, 108], ['duaspas', 22 + 104, 108]];
  PEG[3][1] = 104; PEG[4][1] = 128; PEG[2][2] = 80;
  // posição (palco) de cada ferramenta de mão no painel
  function pegPos(id) { const p = geo.peg, e = PEG.find(q => q[0] === id); return e ? { x: p.x + e[1], y: p.y + e[2] } : null; }
  function plate(g, x, y, txt, col, colD, w) {
    w = w || Math.max(60, txt.length * 10.4 + 18);
    g.fillStyle = INK; D.rrect(g, x - w / 2 - 2, y - 2, w + 4, 26, 6); g.fill();
    g.fillStyle = col; D.rrect(g, x - w / 2, y, w, 20, 4); g.fill(); g.fillStyle = colD; g.fillRect(x - w / 2 + 2, y + 16, w - 4, 3); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x - w / 2 + 3, y + 1, w - 6, 2);
    D.text(g, txt, x, y + 10.5, { size: 17, col: K.cream, sw: 0, weight: 900 });
  }
  /* wall(g, t, {tod, dusk, L, owned:{id:1}, sel, giant, fabLv, shops:{id:lv}, client, can:{gemea, fab, lojas}, hot}) */
  function wall(g, t, o) {
    { const p = geo.win; g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(p.x + 6, p.y + 6, 3, 14); g.fillRect(p.x + 46, p.y + 38, 3, 12); }   // reflexo no vidro
    // painel: as ferramentas de mão que você tem; a que está no elevador deixa só a marca
    for (const [id, dx, dy] of PEG) {
      if (!o.owned[id]) continue;
      const p = geo.peg, x = p.x + dx, y = p.y + dy, cv = spr[id];
      g.fillStyle = INK; g.fillRect(x - 3, y - cv.height * 2 - 3, 6, 4); g.fillStyle = K.steel; g.fillRect(x - 2, y - cv.height * 2 - 2, 4, 2);
      const wsil = sil(cv, '#FFF6DE');                       // marca branca pintada no painel (quadro de sombras de oficina)
      for (const [ax, ay] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) blit(g, wsil, x + ax, y + ay, 2, { alpha: 0.9 });
      if (o.sel === id) blit(g, sil(cv, '#E9D6A8'), x, y, 2);
      else blit(g, cv, x, y + (o.hot === id ? -2 : 0), 2);
    }
    // projeto da Gêmea: o desenho técnico em 4 peças que acendem
    {
      const p = geo.plan, n = o.giant | 0;
      // traço branco da Bagger: cada peça comprada acende e ganha o visto verde
      for (let i = 0; i < 4; i++) blit(g, bp[i], p.x + p.w / 2, p.y + p.h - 6, 2, { alpha: i < n ? 1 : 0.24 });
      for (let i = 0; i < Math.min(4, n); i++) {
        const cx = p.x + [26, 52, 126, 94][i], cy = p.y + [100, 40, 76, 34][i];
        g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(cx - 6, cy); g.lineTo(cx - 1, cy + 5); g.lineTo(cx + 7, cy - 5); g.stroke(); g.strokeStyle = '#8FD46A'; g.lineWidth = 3; g.stroke(); g.lineCap = 'butt';
      }
      if (n < 4) { const cx = p.x + [26, 52, 126, 94][n], cy = p.y + [100, 40, 76, 34][n], pu = 0.5 + 0.5 * Math.sin(t * 4); g.strokeStyle = 'rgba(255,230,138,' + (0.5 + 0.5 * pu).toFixed(2) + ')'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(cx, cy, 11 + pu * 2, 0, TAU); g.stroke(); g.setLineDash([]); }
      plate(g, p.x + p.w / 2, p.y + 5, n >= 4 ? 'GÊMEA ★' : 'GÊMEA ' + n + '/4', K.blue, K.blueD, 104);
      if (o.can.gemea) blit(g, spr.up, p.x + p.w - 8, p.y + 30 + Math.sin(t * 5) * 2.5, 2);
    }
    // quadro da fábrica do pátio: fumaça da chaminé e plaquinha de nível
    {
      const p = geo.fab, L = o.fabLv | 0;
      g.save(); g.beginPath(); g.rect(p.x + 4, p.y + 4, p.w - 8, p.h - 8); g.clip();
      for (let i = 0; i < 3; i++) { const q = (t * 0.3 + i / 3) % 1, r = 3 + q * (4 + Math.min(6, L)); g.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - q)).toFixed(2) + ')'; g.fillRect(Math.round(p.x + 82 + q * 10 - r), Math.round(p.y + 12 - q * 16 - r), Math.round(r * 2), Math.round(r * 2)); }
      g.restore();
      plate(g, p.x + p.w / 2, p.y + p.h - 8, 'PÁTIO Nv ' + L, K.red, K.redD, 100);
      if (o.can.fab) blit(g, spr.up, p.x + p.w - 6, p.y + 16 + Math.sin(t * 5 + 1) * 2.5, 2);
    }
    // quadro de cortiça: um panfleto por loja; a cliente escolhida ganha estrela
    {
      const p = geo.cork, ids = o.shopIds || [], pos = [[20, 54], [52, 52], [86, 56], [24, 90], [58, 88], [92, 90]];
      ids.slice(0, 6).forEach((id, i) => {
        const L = o.shops[id] | 0, x = p.x + pos[i][0], y = p.y + pos[i][1], rot = [-0.06, 0.04, -0.03, 0.05, -0.04, 0.03][i] + Math.sin(t * 0.9 + i * 2) * 0.01;
        blit(g, flyerOf(id), x, y, 2, { rot, alpha: L ? 1 : 0.5 });
        blit(g, spr.pin, x, y - 27, 2);
        if (o.client === id) blit(g, spr.star, x + 12, y - 16 + Math.sin(t * 3) * 1.5, 2);
      });
      plate(g, p.x + p.w / 2, p.y - 4, 'LOJAS', K.green, K.greenD, 70);
      if (o.can.lojas) blit(g, spr.up, p.x + p.w - 6, p.y + 12 + Math.sin(t * 5 + 2) * 2.5, 2);
    }
    // bancada: rádio tocando (notinhas), chaleira com vapor, caneca
    {
      const bx = geo.bench.x, by = geo.bench.y + 6;
      blit(g, spr.radio, bx + 74, by + (Math.floor(t * 4) % 2 ? 0 : -1));
      for (let i = 0; i < 2; i++) {
        const q = (t * 0.45 + i * 0.5) % 1, nx = bx + 92 + q * 16 + Math.sin(q * 9 + i) * 4, ny = by - 26 - q * 26;
        g.globalAlpha = Math.min(1, (1 - q) * 2); g.fillStyle = INK; g.fillRect(Math.round(nx) - 1, Math.round(ny) - 1, 7, 6); g.fillRect(Math.round(nx) + 4, Math.round(ny) - 11, 3, 11);
        g.fillStyle = i ? K.goldL : K.cream; g.fillRect(Math.round(nx), Math.round(ny), 5, 4); g.fillRect(Math.round(nx) + 5, Math.round(ny) - 10, 1, 10); g.globalAlpha = 1;
      }
      blit(g, spr.kettle, bx + 116, by); blit(g, spr.mug, bx + 138, by);
      for (let i = 0; i < 3; i++) { const q = (t * 0.6 + i / 3) % 1; g.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - q)).toFixed(2) + ')'; const r = 2 + q * 3; g.fillRect(Math.round(bx + 130 + q * 8 + Math.sin(t * 2 + i * 2) * 3 - r), Math.round(by - 22 - q * 24 - r), Math.round(r * 2), Math.round(r * 2)); }
    }
    // gato dormindo em cima dos pneus
    { const f = Math.floor(t * 0.8) % 2; blit(g, f ? spr.cat1 : spr.cat0, 920, 166, 2); const u = (t * 0.5) % 1; D.text(g, 'z', 938 + u * 8, 144 - u * 14, { size: 11 + u * 5, col: K.cream, sw: 3, alpha: 1 - u }); }
  }
  /* lamps(g, t, dusk, hotX): luminárias penduradas balançando; add=true desenha só os cones de luz (somar por cima) */
  // feixe de luz em cache: imagem pequena (o canvas amplia suavizando) com queda suave do centro pra borda e do bico pro chão
  const BEAM_W = 196; let beamCv = null;
  function beam() {
    if (beamCv) return beamCv;
    const w = 128, h = 96; beamCv = document.createElement('canvas'); beamCv.width = w; beamCv.height = h;
    const c = beamCv.getContext('2d'), im = c.createImageData(w, h), d = im.data;
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1), half = (8 + (190 - 8) * v) / BEAM_W, kv = 0.048 * 5 * (1.6 - 1.1 * v);   // meia largura (0..1) e força nessa altura
      for (let x = 0; x < w; x++) {
        const u = Math.abs((x + 0.5) / w * 2 - 1) / half, f = u >= 1 ? 0 : Math.pow(1 - u, 1.35) * (0.55 + 0.45 * (1 - u)), i = (y * w + x) * 4;
        // um tiquinho de ruído ordenado quebra qualquer degrau que sobrar nos 8 bits
        const a = kv * f * 255 + ((x * 7 + y * 13) % 5) / 5 - 0.4;
        d[i] = 255; d[i + 1] = 236; d[i + 2] = 170; d[i + 3] = Math.max(0, Math.min(255, Math.round(a)));
      }
    }
    c.putImageData(im, 0, 0);
    return beamCv;
  }
  function lamps(g, t, o) {
    for (let i = 0; i < geo.lamps.length; i++) {
      const lx = geo.lamps[i], a = Math.sin(t * 1.1 + i * 1.7) * 0.05 + (o.kick || 0) * Math.sin(t * 9 + i) * 0.06, len = 16;
      const bx = lx + Math.sin(a) * len, by = 44 + Math.cos(a) * len;
      if (o.add) {
        const spot = i === 1 || i === 2, tx = spot ? geo.lift.x : lx, ty = spot ? geo.lift.y + 10 : 430;
        if (spot) {                                          // feixe de palco: UMA imagem com a borda macia calculada ponto a ponto
          // (antes eram 5 trapézios empilhados: no fim de tarde, com os dois feixes cruzando, dava pra contar as faixas)
          const bm = beam(), dx = tx - bx, dy = ty - (by + 20), len = Math.hypot(dx, dy);
          g.save(); g.translate(bx, by + 20); g.rotate(Math.atan2(dy, dx) - Math.PI / 2); g.globalAlpha = (0.022 + o.dusk * 0.026) / 0.048;
          g.imageSmoothingEnabled = true; g.drawImage(bm, -BEAM_W, 0, BEAM_W * 2, len); g.imageSmoothingEnabled = false;
          g.restore();
        }
        if (i === 1 || !spot) {                              // poça de luz no chão
          g.save(); g.translate(tx, ty); g.scale(1, 0.26); const pr = spot ? 260 : 150, pg = g.createRadialGradient(0, 0, 10, 0, 0, pr);
          pg.addColorStop(0, 'rgba(255,240,190,' + ((spot ? 0.24 : 0.1) + o.dusk * 0.1).toFixed(3) + ')'); pg.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = pg; g.fillRect(-pr, -pr, pr * 2, pr * 2); g.restore();
        }
        const hg = g.createRadialGradient(bx, by + 20, 2, bx, by + 20, 34); hg.addColorStop(0, 'rgba(255,236,170,' + (0.3 + o.dusk * 0.3).toFixed(2) + ')'); hg.addColorStop(1, 'rgba(255,236,170,0)'); g.fillStyle = hg; g.fillRect(bx - 34, by - 14, 68, 68);
        continue;
      }
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(lx, 42); g.lineTo(bx, by); g.stroke();
      blit(g, spr.lamp, bx, by + 21, 2, { rot: -a });
      g.fillStyle = 'rgba(255,230,150,' + (0.35 + o.dusk * 0.4).toFixed(2) + ')'; g.beginPath(); g.ellipse(bx, by + 19, 9, 5, 0, 0, TAU); g.fill();
    }
  }

  /* ======================================================================
     ELEVADOR: plataforma com chapa xadrez, duas colunas amarelas e o medidor de peso (as gigantes estouram o ponteiro)
     ====================================================================== */
  let treadCv = null;
  function tread() {
    if (treadCv) return treadCv;
    treadCv = document.createElement('canvas'); treadCv.width = 160; treadCv.height = 20; const g = treadCv.getContext('2d');
    g.fillStyle = '#9BA6B2'; g.fillRect(0, 0, 160, 20);
    for (let y = 0; y < 20; y += 3) for (let x = (y % 2) * 3; x < 160; x += 6) { g.fillStyle = '#B9C3CE'; g.fillRect(x, y, 2, 1); g.fillStyle = '#7C8793'; g.fillRect(x + 1, y + 1, 2, 1); }
    return treadCv;
  }
  /* lift(g, t, {h (px que subiu), heavy 0..1 (peso: estoura o medidor), load 0..1, back:true = painel do medidor (atrás)})
     Plataforma giratória de exposição: tampo de chapa xadrez, aro zebrado que roda devagar, pistão quando sobe. */
  function lift(g, t, o) {
    const L = geo.lift, cx = L.x, hw = L.w / 2, ry = L.ry, heavy = o.heavy || 0;
    if (o.back) {
      // pedestal de comando com o medidor de peso (as gigantes estouram o ponteiro)
      const gx = cx + hw + 22, by = L.y - 2, gy = by - 62, over = heavy > 0.5;
      shadow(g, gx, by + 2, 14, 4, 0.3);
      g.fillStyle = INK; g.fillRect(gx - 7, gy + 10, 14, 56); g.fillStyle = K.yel; g.fillRect(gx - 5, gy + 10, 10, 54); g.fillStyle = K.yelL; g.fillRect(gx - 5, gy + 10, 3, 54); g.fillStyle = K.yelD; g.fillRect(gx + 2, gy + 10, 3, 54);
      for (let i = 0; i < 2; i++) { g.fillStyle = K.blk; g.beginPath(); g.moveTo(gx - 5, by - 12 - i * 12); g.lineTo(gx + 5, by - 18 - i * 12); g.lineTo(gx + 5, by - 13 - i * 12); g.lineTo(gx - 5, by - 7 - i * 12); g.closePath(); g.fill(); }
      g.fillStyle = INK; g.fillRect(gx - 11, by - 2, 22, 7); g.fillStyle = K.steelDD; g.fillRect(gx - 9, by, 18, 3);
      g.fillStyle = INK; g.beginPath(); g.arc(gx, gy, 18, 0, TAU); g.fill();
      g.fillStyle = K.cream; g.beginPath(); g.arc(gx, gy, 15.5, 0, TAU); g.fill();
      const seg = (a0, a1, c) => { g.strokeStyle = c; g.lineWidth = 5; g.beginPath(); g.arc(gx, gy, 11, a0, a1); g.stroke(); };
      seg(Math.PI * 0.85, Math.PI * 1.35, K.green); seg(Math.PI * 1.35, Math.PI * 1.75, K.yel); seg(Math.PI * 1.75, Math.PI * 2.15, K.red);
      const na = Math.PI * (0.9 + (o.load || 0) * 1.2) + (over ? Math.sin(t * 31) * 0.14 : Math.sin(t * 2.3) * 0.02);
      g.strokeStyle = INK; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + Math.cos(na) * 12, gy + Math.sin(na) * 12); g.stroke(); g.lineCap = 'butt';
      g.fillStyle = K.red; g.beginPath(); g.arc(gx, gy, 3, 0, TAU); g.fill();
      if (over) { const u = (t * 1.6) % 1; D.text(g, '!', gx + 24, gy - 14 - u * 6, { size: 22, col: K.red, sw: 4, stroke: K.cream, alpha: 1 - u * 0.6 }); }
      return;
    }
    const y = L.y - o.h, th = 9;
    shadow(g, cx, L.y + th + 4, hw + 8, ry + 5, 0.26);
    if (o.h > 1) { g.fillStyle = INK; g.fillRect(cx - 34, y + 4, 68, o.h + th); g.fillStyle = K.steel; g.fillRect(cx - 31, y + 4, 62, o.h + th - 2); g.fillStyle = K.steelL; g.fillRect(cx - 31, y + 4, 12, o.h + th - 2); g.fillStyle = K.steelD; g.fillRect(cx + 18, y + 4, 13, o.h + th - 2); }
    // lado (aro) + contorno
    g.fillStyle = INK; g.beginPath(); g.ellipse(cx, y + th, hw + 3, ry + 3, 0, 0, TAU); g.fill(); g.fillRect(cx - hw - 3, y, L.w + 6, th); g.beginPath(); g.ellipse(cx, y, hw + 3, ry + 3, 0, 0, TAU); g.fill();
    g.fillStyle = '#4A525C'; g.beginPath(); g.ellipse(cx, y + th, hw, ry, 0, 0, Math.PI); g.lineTo(cx - hw, y); g.lineTo(cx + hw, y); g.closePath(); g.fill();
    // zebra do aro, rodando devagar
    g.save(); g.beginPath(); g.ellipse(cx, y + th, hw, ry, 0, 0, Math.PI); g.lineTo(cx - hw, y); g.ellipse(cx, y, hw, ry, 0, Math.PI, 0, true); g.closePath(); g.clip();
    const n = 26, ph = (t * 0.12) % (TAU / n * 2);
    g.fillStyle = K.yel;
    for (let i = -1; i < n; i += 2) { const a0 = i / n * Math.PI + ph, a1 = a0 + Math.PI / n; g.beginPath(); g.moveTo(cx + Math.cos(a0) * hw, y - 2 + Math.sin(a0) * ry); g.lineTo(cx + Math.cos(a1) * hw, y - 2 + Math.sin(a1) * ry); g.lineTo(cx + Math.cos(a1) * hw, y + th + 2 + Math.sin(a1) * ry); g.lineTo(cx + Math.cos(a0) * hw, y + th + 2 + Math.sin(a0) * ry); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(40,22,8,.22)'; g.fillRect(cx - hw, y + ry + th - 6, L.w, 8);
    g.restore();
    // tampo de chapa xadrez
    g.save(); g.beginPath(); g.ellipse(cx, y, hw, ry, 0, 0, TAU); g.clip();
    g.imageSmoothingEnabled = false; for (let x = cx - hw; x < cx + hw; x += 320) for (let yy = y - ry; yy < y + ry; yy += 40) g.drawImage(tread(), x, yy, 320, 40);
    const sh = g.createLinearGradient(0, y - ry, 0, y + ry); sh.addColorStop(0, 'rgba(40,30,20,.20)'); sh.addColorStop(0.5, 'rgba(255,255,255,.10)'); sh.addColorStop(1, 'rgba(255,255,255,.22)'); g.fillStyle = sh; g.fillRect(cx - hw, y - ry, L.w, ry * 2);
    g.restore();
    g.strokeStyle = 'rgba(59,40,24,.45)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, y, hw - 12, ry - 5, 0, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, y, hw - 1, ry - 1, 0, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 0.12; g.fillStyle = INK; g.beginPath(); g.ellipse(cx + Math.cos(a) * (hw - 22), y + Math.sin(a) * (ry - 8), 4, 2.4, 0, 0, TAU); g.fill(); g.fillStyle = K.steelL; g.beginPath(); g.ellipse(cx + Math.cos(a) * (hw - 22), y - 0.6 + Math.sin(a) * (ry - 8), 2.4, 1.4, 0, 0, TAU); g.fill(); }
  }

  /* ======================================================================
     MEDALHAS da máquina (marcos 10/25/50) e adesivos da escolha (raio = mais rápida, grão = mais dourada)
     ====================================================================== */
  // marcos depois do 50 (75, 100, 125…): cada um é uma medalha de cor nova (rubi, esmeralda, safira, ametista, arco-íris…)
  const XMED = ['#E0525A', '#3FBF7F', '#4C8DF0', '#B36BE8', '#F08A3C', '#2EC4C4', 'rainbow'];
  function levelBadge(g, x, y, lvl, miles) {
    const w = lvl >= 1000 ? 48 : lvl >= 100 ? 40 : lvl >= 10 ? 32 : 24;
    g.fillStyle = INK; D.rrect(g, x - w / 2 - 2, y - 12, w + 4, 24, 8); g.fill();
    g.fillStyle = miles >= 4 ? medCol(g, miles - 4, x - w / 2, x + w / 2) : miles >= 3 ? K.goldL : miles >= 2 ? '#DDE6EE' : miles >= 1 ? '#EDB27A' : K.cream; D.rrect(g, x - w / 2, y - 10, w, 20, 6); g.fill();
    D.text(g, String(lvl), x, y + 0.5, { size: 17, col: INK, sw: 0, weight: 900 });
  }
  function medCol(g, i, x0, x1) {
    const c = XMED[i % XMED.length]; if (c !== 'rainbow') return c;
    const gr = g.createLinearGradient(x0, 0, x1, 0); ['#FF8A8A', '#FFD36B', '#9BE38A', '#7FC8FF', '#C9A0F0'].forEach((k, j) => gr.addColorStop(j / 4, k)); return gr;
  }
  // quantas medalhas a fita mostra (3 estrelas + até 3 medalhas novas; a última leva o número se tiver mais)
  const medalSlots = (miles, spec) => Math.min(3, miles) + Math.min(3, Math.max(0, miles - 3)) + (spec ? Math.min(3, spec.length) : 0);
  function medals(g, x, y, miles, spec, t, sc) {
    if (!miles && !(spec && spec.length)) return;
    sc = sc || 2;
    const n = medalSlots(miles, spec), w = n * 11 * sc * 0.5 + 8, h = 13 * sc * 0.5;
    let px = x - w / 2 + 4 + 5.5 * sc * 0.5;
    g.fillStyle = INK; D.rrect(g, x - w / 2 - 2, y - h - 3, w + 4, h + 6, 6); g.fill();
    g.fillStyle = '#4A3424'; D.rrect(g, x - w / 2, y - h - 1, w, h + 2, 4); g.fill();
    for (let i = 0; i < Math.min(3, miles); i++) { blit(g, spr.star, px, y - 1 + (Math.sin(t * 3 + i) > 0.96 ? -1 : 0), sc * 0.5); px += 11 * sc * 0.5; }
    const extra = Math.max(0, miles - 3);
    for (let i = Math.max(0, extra - 3); i < extra; i++) {   // as 3 medalhas mais novas
      const r = 2.6 * sc, cx = px, cy = y - h * 0.5;
      g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, r + 1, 0, TAU); g.fill();
      g.fillStyle = medCol(g, i, cx - r, cx + r); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.35, r * 0.35, 0, TAU); g.fill();
      if (i === extra - 1 && extra > 3) D.text(g, String(extra), cx, cy + 0.5, { size: Math.max(9, 4 * sc), col: INK, sw: 2, stroke: K.cream, weight: 900 });
      px += 11 * sc * 0.5;
    }
    if (spec) for (let i = Math.max(0, spec.length - 3); i < spec.length; i++) { blit(g, spec[i] === 'd' ? spr.grain : spr.bolt, px, y - 1, sc * 0.5); px += 11 * sc * 0.5; }
  }
  // brilhos piscando em cima de uma máquina (marco 25+)
  function twinkle(g, x0, y0, w, h, t, n, seed) {
    for (let i = 0; i < n; i++) {
      const u = (t * 0.7 + i * 0.37 + seed) % 1; if (u > 0.5) continue;
      const px = x0 + ((i * 97 + seed * 131) % 100) / 100 * w, py = y0 + ((i * 53 + seed * 71) % 100) / 100 * h;
      blit(g, spr.spark, px, py, 2, { alpha: Math.sin(u * TAU) });
    }
  }
  /* stamp(g, x, y, k, txt, col): carimbo de tinta ("+1", "MARCO!") batendo (k 0..1 = tempo do efeito) */
  function stamp(g, x, y, k, txt, col, size) {
    if (k <= 0 || k >= 1) return;
    const inn = Math.min(1, k / 0.16), sc = 1 + (1 - U.ease.out(inn)) * 1.3, a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    size = size || 30;
    g.save(); g.translate(x, y); g.rotate(-0.2); g.scale(sc, sc); g.globalAlpha = a;
    const w = Math.max(64, txt.length * size * 0.62 + 26), h = size + 18;
    g.fillStyle = K.cream; D.rrect(g, -w / 2, -h / 2, w, h, 10); g.fill();
    g.strokeStyle = col || K.red; g.lineWidth = 5; D.rrect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 8); g.stroke();
    g.lineWidth = 1.5; D.rrect(g, -w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 5); g.stroke();
    D.text(g, txt, 0, 1, { size, col: col || K.red, sw: 0, weight: 900 });
    g.restore();
  }

  /* ---------- ícone da ferramenta pros botões (o do jogo, 16×16) ---------- */
  function icon(id) { return G.Props && G.Props.icon ? G.Props.icon(id) : spr.star; }

  G.OfiArt = {
    geo, K, PX, blit, shadow, sil, spr, flyer, BB, HAND, LIFT_S,
    bg() { if (!bgCv) paintBg(); return bgCv; }, sun() { if (!sunCv) paintSun(); return sunCv; }, dusk() { if (!duskCv) paintDusk(); return duskCv; },
    donor, bake, drawBake, glow, live, liveTick, liveDraw, liftPos,
    mech, yard, yardPoke, yardRect, wall, flyerOf, pegPos, lamps, lift, levelBadge, medals, medalSlots, twinkle, stamp, plate, icon,
  };
})();
