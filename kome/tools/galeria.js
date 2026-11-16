#!/usr/bin/env node
/* Kome tools: GALERIA — todos os desenhos em pixel do jogo numa imagem só (fichas, construções, adereços, Casa).
   uso: node tools/galeria.js [saida.png]   (padrão: %TEMP%/kome-galeria.png). Mostra o nome embaixo de cada um. */
const path = require('path'), os = require('os');
const { launch } = require('./pw');
const OUT = process.argv[2] || path.join(os.tmpdir(), 'kome-galeria.png');
(async () => {
  const b = await launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?fresh&nointro&nofont'); await p.waitForTimeout(900);
  // passa pelas telas que desenham sprites pra todos entrarem no cache
  await p.evaluate(() => {
    const K = __kome, D = K.data; K.setTool(10); for (const n of D.TREE) K.S.own[n.id] = true; K.S.house = 3;
    for (const x of [300, 700, 1100, 1500]) { K.P.x = x; K.S.camX = x; K.S.zoomMul = 0.5; K.step(0.2); }
    const d = KomeGame.Home.data(); D.DECOR.forEach(x => d.own[x.id] = 1); KomeGame.Home.open('jardim'); K.step(0.2);
    for (const f of (KomeGame.Fichas || [])) f.sprite && f.sprite();
  });
  await p.waitForTimeout(600);
  const png = await p.evaluate(() => {
    const E = Pixxel, names = E.sprite.names().filter(n => !/^(fab\/(est|braco|robo|fum)|bury)/.test(n)).sort();
    const seen = new Set(), cvs = names.filter(n => { const k = n.replace(/[\d.#A-F]+m?$/i, '').replace(/[\d.]+/g, ''); if (seen.has(k)) return false; seen.add(k); return true; })   // 1 exemplar por tipo (sem 80 pedras)
      .map(n => [n, E.sprite.get(n)]).filter(x => x[1] && x[1].width > 2);
    const cell = 150, cols = 8, rows = Math.ceil(cvs.length / cols), c = document.createElement('canvas');
    c.width = cols * cell; c.height = rows * cell; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#CFE8F5'; g.fillRect(0, 0, c.width, c.height);
    cvs.forEach(([n, cv], i) => {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell, k = Math.max(1, Math.floor(Math.min(120 / cv.width, 110 / cv.height)));
      g.strokeStyle = '#9AB'; g.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      g.drawImage(cv, Math.round(x + (cell - cv.width * k) / 2), Math.round(y + 8 + (112 - cv.height * k) / 2), cv.width * k, cv.height * k);
      g.fillStyle = '#2A1A10'; g.font = '11px system-ui'; g.fillText(n.slice(0, 24), x + 4, y + cell - 6);
    });
    return c.toDataURL('image/png');
  });
  require('fs').writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
  console.log('galeria -> ' + OUT + (errs.length ? '  ERROS: ' + errs[0] : ''));
  await b.close(); process.exit(errs.length ? 1 : 0);
})();
