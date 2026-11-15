/* Kome no Japão — game-world.js
   Cenário do mundo persistente: fundo em camadas (céu, Fuji, morros), chão, a "régua do mundo" (objetos de referência
   fixos no pátio), a casa em estágios, os adereços que cada nó da árvore acrescenta e o coletor de arroz.
   Só desenha: não muda estado de jogo. Depende de core, pix, shiba, nature (opcional) e das máquinas (G.Scale).
   Ponto de extensão (Fase 2): G.World.props.push({node|when(S), x, draw(g, x, t, S)}) acrescenta adereços;
   G.World.layers.back / .front são listas de fn(g, view, t, S) chamadas atrás e na frente da montanha. */
(function () {
  'use strict';
  const E = window.KomeEngine, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, PAL = E.PAL, Draw = E.Draw, N = E.Nature || null, LINE = E.LINE_CSS;
  const W = 960, H = 540;
  const mixc = {};
  const mix = (a, b, t) => mixc[a + b + t] || (mixc[a + b + t] = U.mixCss(a, b, t));
  const SOIL = '#C7A26A', SOIL_D = '#A8834F';

  /* posições fixas (x de mundo) dos objetos de referência: crescem da montanha pra esquerda */
  const X = { casinha: 1560, barraca: 1440, sakura: 1320, torii: 1180, poste: 1060, vila: 930, torre: 760, fabrica: 480, casa: 170, silo: 1650 };

  const clouds = N && N.clouds ? N.clouds(7, { n: 7 }) : null;
  const birds = N && N.birds ? N.birds(3, { n: 5 }) : null;

  /* ---------- fundo em coordenadas de tela, com parallax ---------- */
  // drawBack(g, cam, t, S): céu, sol, nuvens, Fuji e duas faixas de morros. O Fuji encolhe devagar com o zoom (régua final).
  function drawBack(g, cam, t, S) {
    const gy = Math.min(H + 40, (0 - cam.y) * cam.z + H / 2);       // y de tela do chão
    const hz = U.clamp(gy, H * 0.35, H + 30);
    if (N) {
      N.sky(g, W, H, { tod: 0.42, t });
      if (N.celestial) N.celestial(g, W, hz - 10, { t, r: 16 });
      if (clouds) clouds.draw(g, W, hz, cam.x * 0.04);
      const fs = 1.1 + 0.9 * Math.sqrt(U.clamp(cam.z / 3, 0, 1));
      N.fuji(g, W * 0.62 - (cam.x - 2000) * 0.012, hz + 2, fs, { t });
      if (S.own.m11) drawShip(g, W * 0.2 - cam.x * 0.01, hz - 6, t);
      N.hills(g, W, hz - 4, cam.x * 0.25, { col: PAL.leaf, haze: 0.66, amp: 26 + 10 * cam.z, seed: 3, trees: 0.4, bottom: H, parallax: 0.3 });
      N.hills(g, W, hz + 6, cam.x * 0.5, { col: PAL.grass, haze: 0.36, amp: 16 + 8 * cam.z, seed: 8, freq: 0.011, trees: 0.25, bottom: H, parallax: 0.3 });
      if (birds) birds.draw(g, W, hz, cam.x * 0.1);
    } else {
      g.fillStyle = PAL.sky; g.fillRect(0, 0, W, H);
      g.fillStyle = mix(PAL.grassL, PAL.sky, 0.5); g.fillRect(0, hz - 30, W, H);
    }
  }
  function drawShip(g, x, y, t) {
    g.fillStyle = mix(PAL.steelD, PAL.sky, 0.5);
    g.fillRect(x, y - 6, 70, 6); g.fillRect(x + 44, y - 14, 14, 8); g.fillRect(x + 8, y - 10, 30, 4);
  }
  function updateBack(dt) { if (clouds) clouds.update(dt); if (birds) birds.update(dt); }

  /* ---------- chão ---------- */
  // drawGround(g, v): faixa de grama + terra por cima da base da montanha (desenhar DEPOIS de heap.draw)
  function drawGround(g, v, z) {
    const k = 1 / Math.min(1, z + 0.25);
    g.fillStyle = SOIL; g.fillRect(v.x0, 0, v.x1 - v.x0, v.y1 + 10);
    g.fillStyle = PAL.grass; g.fillRect(v.x0, 0, v.x1 - v.x0, 26);
    g.fillStyle = PAL.grassD; g.fillRect(v.x0, 26, v.x1 - v.x0, 3 * k);
    g.fillStyle = PAL.grassL; g.fillRect(v.x0, 0, v.x1 - v.x0, 2.5 * k);
    g.fillStyle = SOIL_D; g.fillRect(v.x0, 44, v.x1 - v.x0, 2 * k);
    g.fillStyle = LINE; g.fillRect(v.x0, -0.6 * k, v.x1 - v.x0, 1.2 * k);
  }

  /* ---------- placeholders de construções (Draw) ---------- */
  function casinha(g, x) {
    Draw.box(g, x - 20, -26, 40, 26, PAL.woodL, { r: 2 });
    Draw.poly(g, [[x - 26, -24], [x, -44], [x + 26, -24]], PAL.red);
    Draw.circle(g, x, -9, 8, PAL.ink, { ol: 1 }); g.fillStyle = PAL.ink; g.fillRect(x - 8, -9, 16, 9);
    Draw.box(g, x + 26, -6, 12, 6, PAL.bowl, { r: 2, ol: 1 });
  }
  function poste(g, x, t) {
    Draw.box(g, x - 4, -210, 8, 210, PAL.woodD, { r: 2 });
    Draw.box(g, x - 28, -200, 56, 6, PAL.woodD, { r: 2 });
    Draw.box(g, x + 4, -176, 26, 5, PAL.grayD, { r: 2 }); Draw.circle(g, x + 28, -170, 6, PAL.goldL, { ol: 1.5 });
    Draw.cable(g, [x - 26, -200], [X.torre + 60, -400], { sag: 46, lw: 1.5 });
    Draw.cable(g, [x + 26, -200], [X.vila - 40, -196], { sag: 12, lw: 1.5 });
  }
  function vila(g, x) {
    Draw.box(g, x - 80, -190, 160, 190, PAL.cream, { r: 2 });
    Draw.box(g, x - 80, -100, 160, 8, PAL.woodD);
    Draw.poly(g, [[x - 100, -186], [x - 60, -230], [x + 60, -230], [x + 100, -186]], PAL.steelD);
    Draw.poly(g, [[x - 96, -96], [x - 80, -112], [x + 80, -112], [x + 96, -96]], PAL.steelD);
    for (let f = 0; f < 2; f++) for (let i = 0; i < 3; i++) Draw.window(g, x - 62 + i * 46, -170 + f * 92, 32, 40);
    Draw.box(g, x - 14, -58, 28, 58, PAL.wood, { r: 2 });
  }
  function torre(g, x) {
    Draw.lattice(g, x - 34, -520, 68, 520, 52, 3.2, PAL.steel);
    for (let i = 0; i < 3; i++) Draw.box(g, x - 110 + i * 14, -500 + i * 62, 220 - i * 28, 7, PAL.steelD, { r: 2 });
    Draw.cable(g, [x - 108, -496], [x - 700, -420], { sag: 60, lw: 1.5 });
  }
  function fabrica(g, x, t, S) {
    const on = !!S.own.m5, c = on ? PAL.cream : mix(PAL.cream, PAL.gray, 0.5);
    Draw.box(g, x + 96, -470, 34, 100, PAL.rust, { r: 2, stripes: 0 });
    Draw.box(g, x - 150, -390, 300, 390, c, { r: 3 });
    Draw.box(g, x - 158, -400, 316, 16, on ? PAL.red : PAL.grayD, { r: 3 });
    for (let f = 0; f < 6; f++) for (let i = 0; i < 6; i++) Draw.window(g, x - 134 + i * 46, -372 + f * 58, 30, 34, { glare: on });
    Draw.box(g, x - 34, -48, 68, 48, PAL.woodD, { r: 2 });
    Draw.sign(g, x - 70, -438, 140, 30, on ? 'ONIGIRI' : 'EM BREVE', { col: on ? PAL.red : PAL.gray, ink: PAL.cream });
    if (on) for (let i = 0; i < 3; i++) {                       // baforadas em forma de onigiri
      const u = (t * 0.22 + i / 3) % 1, px = x + 113 + Math.sin(u * 5 + i) * 14, py = -480 - u * 170, s = 10 + u * 18;
      g.globalAlpha = 0.85 * (1 - u);
      g.fillStyle = PAL.white; g.beginPath(); g.moveTo(px, py - s); g.lineTo(px + s, py + s * 0.7); g.lineTo(px - s, py + s * 0.7); g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
  }
  function silo(g, x, t, S) {
    Draw.box(g, x - 34, -150, 68, 150, PAL.steelL, { r: 6, panels: 3 });
    Draw.poly(g, [[x - 38, -148], [x, -178], [x + 38, -148]], PAL.steelD);
    const f = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(S.dug * 0.00002 + t * 0.2));
    Draw.box(g, x - 8, -124, 16, 96, PAL.ink, { r: 3, ol: 1.5 });
    g.fillStyle = PAL.rice; g.fillRect(x - 6, -30 - 92 * f, 12, 92 * f);
  }

  /* ---------- a régua do mundo ---------- */
  const RULER = [
    { x: X.fabrica, r: 200, draw: fabrica }, { x: X.torre, r: 160, draw: torre }, { x: X.vila, r: 110, draw: vila },
    { x: X.poste, r: 300, draw: poste },
    { x: X.torii, r: 90, draw: (g, x, t) => { if (N) N.torii(g, x, 0, 2.2, { t }); } },
    { x: X.sakura, r: 80, draw: (g, x, t) => { if (N) N.tree(g, x, 0, { kind: 'sakura', s: 1.5, seed: 4, t }); } },
    { x: X.barraca, r: 70, draw: (g, x, t, S) => { if (N) N.stall(g, x, 0, { t, s: 1.15, col: S.own.m_b ? '#2F4670' : undefined }); } },
    { x: X.casinha, r: 50, draw: casinha },
  ];

  /* ---------- adereços que os nós da árvore acrescentam (regra do feedback visual) ---------- */
  const shO = { face: 1, scale: 1, pal: 'goma', shadow: true };
  function sh(g, x, y, pose, t, pal, face, scale) { shO.pal = pal; shO.face = face || 1; shO.scale = scale || 1; E.drawShiba(g, x, y, pose, t, shO); }
  const props = [
    // fila de clientes na barraquinha (m1: 3, m_b: 5) + balança (m_a)
    { node: 'm1', x: X.barraca, draw(g, x, t, S) { const n = S.own.m_b ? 5 : 3; for (let i = 0; i < n; i++) sh(g, x - 60 - i * 26, 6, i % 2 ? 'sit' : 'wag', t + i, ['shiro', 'kuro', 'goma', 'cha', 'aka'][i], 1); } },
    { node: 'm_a', x: X.barraca, draw(g, x, t) { const a = Math.sin(t * 3) * 3; Draw.box(g, x + 44, -30, 3, 30, PAL.goldD, { ol: 1 }); Draw.box(g, x + 32, -32 + a, 12, 3, PAL.gold, { ol: 1 }); Draw.box(g, x + 47, -32 - a, 12, 3, PAL.gold, { ol: 1 }); } },
    { node: 'm_c', x: 1250, draw(g, x, t) { if (N && N.nobori) for (let i = 0; i < 5; i++) N.nobori(g, 1000 + i * 150, 0, { t: t + i, col: i % 2 ? PAL.red : '#2F4670' }); } },
    { node: 'm_e', x: 640, draw(g, x) { Draw.box(g, x - 70, -14, 140, 14, PAL.stone, { r: 2 }); Draw.box(g, x - 30, -60, 60, 46, PAL.woodL, { r: 2 }); Draw.sign(g, x - 26, -76, 52, 16, 'EKIBEN', { col: PAL.red, ink: PAL.cream }); } },
    { node: 'm_f', x: 330, draw(g, x) { const c = [PAL.red, PAL.water, PAL.yel, PAL.grass, PAL.ora]; for (let i = 0; i < 5; i++) Draw.box(g, x - 70 + (i % 3) * 46 + (i > 2 ? 22 : 0), -30 - (i > 2 ? 30 : 0), 44, 30, c[i], { r: 1, panels: 3 }); } },
    { node: 'm9', x: 1010, draw(g, x) { for (let i = 0; i < 3; i++) { Draw.box(g, x - 30 + i * 22 - (i === 2 ? 33 : 0), -22 - (i === 2 ? 22 : 0), 20, 22, PAL.cream, { r: 5 }); } Draw.text(g, '酒', x - 20, -11, { size: 12, col: PAL.red, sw: 0 }); } },
    { node: 'm10', x: 620, draw(g, x, t) { Draw.box(g, x - 6, -300, 12, 300, PAL.steelD); Draw.box(g, x - 110, -420, 220, 130, PAL.gold, { r: 4 }); sh(g, x - 50, -306, 'proud', t, 'kome', 1, 2); Draw.text(g, 'KOME', x + 44, -372, { size: 30, col: PAL.red, sw: 5 }); Draw.text(g, 'no Japão', x + 44, -340, { size: 15, col: PAL.cream, sw: 4 }); } },
    { node: 'a3', x: 1500, draw(g, x, t) { Draw.box(g, x - 2, -62, 4, 62, PAL.wood, { ol: 1 }); Draw.box(g, x - 22, -48, 44, 4, PAL.wood, { ol: 1 }); Draw.circle(g, x, -62, 9, PAL.sack, { ol: 1.5 }); Draw.poly(g, [[x - 16, -66], [x, -80], [x + 16, -66]], PAL.woodL); } },
    { node: 'a7', x: X.silo, draw: silo },
    { node: 'a9', x: 1700, draw(g, x, t, S) { const a = [X.silo + 30, -150], b = [Math.max(1800, S.footX - 40), -24]; Draw.beam(g, [a, b], S.own.b4 ? 16 : 9, PAL.grayD); g.fillStyle = PAL.rice; for (let i = 0; i < 9; i++) { const u = (i / 9 + t * 0.25) % 1; g.fillRect(b[0] + (a[0] - b[0]) * u - 3, b[1] + (a[1] - b[1]) * u - 5 - (S.own.b4 ? 4 : 0), 7, 4); } } },
    { node: 'e3', x: 1610, draw(g, x, t) { sh(g, x, 8, 'point', t, 'cha', 1); } },
    { node: 'e5', x: 1380, draw(g, x, t) { Draw.lattice(g, x - 6, -150, 12, 150, 14, 1.6, PAL.steel); Draw.light(g, x, -154, 5, PAL.red, Math.sin(t * 4) > 0); } },
    { node: 'e2a', x: 860, draw(g, x) { Draw.box(g, x - 90, -110, 180, 110, PAL.steel, { r: 2, panels: 5 }); Draw.poly(g, [[x - 98, -108], [x, -140], [x + 98, -108]], PAL.rust); Draw.box(g, x - 40, -70, 80, 70, PAL.ink, { r: 2 }); Draw.sign(g, x - 34, -98, 68, 18, 'OFICINA', { col: PAL.yel, ink: PAL.ink }); } },
    { node: 'e2b', x: 1120, draw(g, x, t) { for (let i = 0; i < 2; i++) { const px = x + i * 420; Draw.lattice(g, px - 5, -240, 10, 240, 16, 1.6, PAL.steelD); Draw.box(g, px - 22, -254, 44, 14, PAL.grayD, { r: 2 }); Draw.light(g, px - 10, -247, 6, PAL.goldL, true); Draw.light(g, px + 10, -247, 6, PAL.goldL, true); } } },
    { node: 's6', x: 1270, draw(g, x) { Draw.box(g, x - 3, -50, 6, 50, PAL.wood); Draw.box(g, x - 34, -84, 68, 40, PAL.woodL, { r: 2 }); for (let i = 0; i < 3; i++) Draw.box(g, x - 28 + i * 20, -78, 16, 22, PAL.cream, { ol: 1 }); } },
    { node: 's11', x: 1385, draw(g, x, t) { Draw.box(g, x - 16, -12, 32, 4, PAL.woodD, { ol: 1 }); Draw.box(g, x - 12, -8, 3, 8, PAL.woodD, { ol: 1 }); Draw.box(g, x + 9, -8, 3, 8, PAL.woodD, { ol: 1 }); Draw.box(g, x - 4, -18, 8, 6, PAL.bowl, { r: 2, ol: 1 }); } },
  ];

  // trem de arroz (m8): cruza o fundo a cada 20 s
  function drawTrain(g, v, t) {
    const u = (t % 20) / 20; if (u > 0.5) return;
    const x = -400 + u * 2 * 2600;
    Draw.box(g, x, -44, 84, 36, PAL.red, { r: 4 }); Draw.window(g, x + 54, -38, 20, 14);
    for (let i = 1; i <= 3; i++) { Draw.box(g, x - i * 92, -36, 84, 28, PAL.steel, { r: 3 }); g.fillStyle = PAL.rice; g.beginPath(); g.ellipse(x - i * 92 + 42, -36, 36, 9, 0, Math.PI, 0); g.fill(); }
    for (let i = -3; i <= 0; i++) { Draw.circle(g, x + i * 92 + 16, -6, 6, PAL.blk, { ol: 1 }); Draw.circle(g, x + i * 92 + 66, -6, 6, PAL.blk, { ol: 1 }); }
  }

  const layers = { back: [], front: [] };

  // drawYard(g, v, t, S): casa, régua, adereços e trem (atrás das máquinas e do Kome)
  function drawYard(g, v, t, S) {
    if (v.x0 > 1900) return;
    if (S.own.m8) drawTrain(g, v, t);
    if (N && v.x0 < X.casa + 200) {
      if (S.house > 0) N.house(g, X.casa, 0, { stage: S.house - 1, s: 1.5, t });
      else { Draw.box(g, X.casa - 2, -40, 4, 40, PAL.wood, { ol: 1 }); Draw.sign(g, X.casa - 34, -66, 68, 26, 'À VENDA', { col: PAL.cream, ink: PAL.red }); }
    }
    for (let i = 0; i < RULER.length; i++) { const o = RULER[i]; if (o.x + o.r > v.x0 && o.x - o.r < v.x1) o.draw(g, o.x, t, S); }
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (p.node ? !S.own[p.node] : !(p.when && p.when(S))) continue;
      if (p.x + 500 > v.x0 && p.x - 500 < v.x1) p.draw(g, p.x, t, S);
    }
    for (let i = 0; i < layers.back.length; i++) layers.back[i](g, v, t, S);
  }

  /* ---------- coletor: pra onde o arroz vai (adendo §9) ---------- */
  // drawCollector(g, col{x,y,kind,fill,pulse}, t, S)
  function drawCollector(g, c, t, S) {
    const k = 1 + 0.18 * (c.pulse || 0), P = G.Props;
    g.save(); g.translate(c.x, c.y); g.scale(k, k);
    if (c.kind === 'saco') {
      const s = P ? P.sack(S.own.s8 ? 'golden' : 'plain') : null;
      if (s) { g.imageSmoothingEnabled = false; g.drawImage(s.cv, -s.ax * 1.4, -s.ay * 1.4, s.cv.width * 1.4, s.cv.height * 1.4); }
    } else if (c.kind === 'kei' && G.Scale && G.Scale.keitruck) G.Scale.keitruck.draw(g, 0, 0, { face: 1, t });
    else if (c.kind === 'moega' && G.Scale && G.Scale.moega) G.Scale.moega.draw(g, 0, 0, { face: 1, t, fill: 0.3 + 0.5 * (c.pulse || 0) });
    else if (c.kind === 'silo') { g.translate(-c.x, 0); silo(g, c.x, t, S); }
    g.restore();
  }

  G.World = { X, RULER, props, layers, drawBack, updateBack, drawGround, drawYard, drawCollector, drawSilo: silo, sh };
})();
