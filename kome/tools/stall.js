// Kome tools: simula ficar MUITO tempo numa ferramenta sem comprar a próxima e mostra se a renda trava (ex.: parede de material duro).
// uso: node tools/stall.js [idDaFerramenta=escav] [minutos=90]
const path = require('path'); const { launch } = require('./pw');
const TOOL = process.argv[2] || 'escav', MIN = +(process.argv[3] || 90);
(async () => { const b = await launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '?fresh&nointro&nofont'); await p.waitForTimeout(900);
  const r = await p.evaluate(([TOOL, MIN]) => { const K = __kome, D = K.data, S = K.S, out = [];
    K.setTool(D.toolIndex[TOOL]);
    for (const n of D.TREE) if (n.tier <= D.toolIndex[TOOL] + 1 && !(n.needs)) S.own[n.id] = true;   // árvore até aqui
    K.step(0.1);
    for (let m = 0; m < MIN; m++) {                     // 90 minutos segurando o dedo no melhor ponto
      const e0 = S.earned;
      for (let s = 0; s < 60; s++) { const a = K.aim(); K.hold(a.x, a.y, true); K.step(1); K.tapAll(); }
      if (m % 10 === 0 || m >= MIN - 3) out.push('min ' + m + ': ganho/min ¥' + Math.round(S.earned - e0) + ' · cavado ' + ((1 - K.heap.area / K.heap.total) * 100).toFixed(1) + '% · x=' + (K.P.x | 0) + ' · foot=' + (S.footX | 0));
    }
    return out; }, [TOOL, MIN]);
  console.log(r.join('\n')); await b.close(); })();
