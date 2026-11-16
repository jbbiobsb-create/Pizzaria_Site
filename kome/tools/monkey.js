#!/usr/bin/env node
/* Kome tools: ROBÔ que joga feito criança apertando tudo — clica em botões aleatórios (HUD, menus, painéis, Casa, árvore),
   toca/segura na tela, aperta teclas, troca de ferramenta, compra, abre e fecha coisas, pula pro fim, viaja de ilha…
   Depois de cada rodada confere se o jogo continua são: erro de página, dinheiro NaN/negativo, Kome fora do mundo,
   montanha inválida, jogo travado (tempo parado), painel que não fecha. Só imprime o resumo e os problemas (barato).
   uso: node tools/monkey.js [--partidas 40] [--acoes 300] [--paralelo 4] [--celular]
   Código 1 se achar problema. Os prints dos problemas vão pra %TEMP%/kome-monkey/. */
const path = require('path'), fs = require('fs'), os = require('os');
const { launch } = require('./pw');
const a = process.argv.slice(2), val = (k, d) => (a.includes(k) ? +a[a.indexOf(k) + 1] : d), has = k => a.includes(k);
const RUNS = val('--partidas', 40), ACTS = val('--acoes', 300), PAR = val('--paralelo', 4), MOB = has('--celular');
const OUT = path.join(os.tmpdir(), 'kome-monkey'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?fresh&nointro&nofont';

// uma ação aleatória (roda na página). Devolve o nome da ação pro log.
const ACT = `(seed) => {
  const K = __kome, D = K.data, S = K.S, r = Math.random;
  const vis = e => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && getComputedStyle(e).visibility !== 'hidden' && e.offsetParent !== null; };
  const pick = arr => arr[(r() * arr.length) | 0];
  const roll = r();
  if (roll < 0.30) { const NAO = /apagar|importar|abrir arquivo|baixar|exportar|partir|tela cheia/i;   // destrutivo/recarrega a página: o robô não aperta
    const bs = [...document.querySelectorAll('button, [role=button], .k-tab, .k-tree-node, .k-card')].filter(vis).filter(e => !NAO.test((e.getAttribute('aria-label') || '') + ' ' + e.textContent)); const b = pick(bs); if (b) { b.click(); return 'clique: ' + (b.getAttribute('aria-label') || b.textContent || b.className).trim().slice(0, 30); } }
  if (roll < 0.45) { for (let i = 0; i < 8; i++) { const p = K.aim(); K.hold(p.x + (r() - 0.5) * 300, p.y + (r() - 0.5) * 200, true); K.step(0.5); } K.hold(0, 0, false); return 'cava'; }
  if (roll < 0.52) { K.addMoney(Math.pow(10, 2 + r() * 10)); return 'dinheiro'; }
  if (roll < 0.58) { const ok = K.buyTool(); return 'compra ferramenta ' + ok; }
  if (roll < 0.63) { const n = pick(D.TREE); K.addMoney(1e9); K.buyNode(n.id); return 'compra nó ' + n.id; }
  if (roll < 0.66) { K.addMoney(1e12); K.buyHouse(); return 'compra casa'; }
  if (roll < 0.71) { const i = (r() * (S.tool + 1)) | 0; K.playAs(i); return 'troca pra ' + i; }
  if (roll < 0.74) { K.S.zoomMul = 0.55 + r() * 1.35; return 'zoom'; }
  if (roll < 0.78) { document.querySelectorAll('.k-x').forEach(b => b.offsetParent && b.click()); if (KomeGame.Home && KomeGame.Home.isOpen()) KomeGame.Home.close(); return 'fecha tudo'; }
  if (roll < 0.81) { KomeGame.Home && KomeGame.Home.open(pick(['jardim','bichos','roupa','tema','caderno','ilhas'])); return 'abre casa'; }
  if (roll < 0.84) { K.S.dayT = 9999; K.step(0.2); return 'pula pro fim do dia'; }
  if (roll < 0.86) { K.setTool(D.TOOLS.length - 1); S.ended = true; K.step(0.5); return 'pula pro final'; }
  if (roll < 0.88 && S.ended) { K.newMountain && K.newMountain(); return 'montanha nova'; }
  if (roll < 0.90 && S.ended) { const run = KomeGame.Ind && KomeGame.Ind.run(); if (run) { run.giant = (run.giant | 0) + 1; run.fab = (run.fab | 0) + 1; } K.step(0.5); return 'gêmea/fábrica'; }
  if (roll < 0.93) { K.S.closet = D.CLOSET.map(c => c.id); K.S.look.acc = pick(D.CLOSET.filter(c => c.kind === 'acc')).id; return 'veste acessório'; }
  if (roll < 0.96) { K.step(5 + r() * 30); return 'espera'; }
  K.step(1); return 'passo';
}`;
const SANE = `() => {
  const K = __kome, S = K.S, bad = [];
  if (!isFinite(S.money) || S.money < -1) bad.push('dinheiro inválido: ' + S.money);
  if (!isFinite(S.earned)) bad.push('ganho total inválido');
  if (!isFinite(K.P.x) || !isFinite(K.P.y) || K.P.x < -3000 || K.P.x > 12000) bad.push('Kome fora do mundo: ' + Math.round(K.P.x) + ',' + Math.round(K.P.y));
  if (!isFinite(K.heap.area) || K.heap.area < 0) bad.push('montanha inválida');
  if (!(S.tool >= 0 && S.tool < K.data.TOOLS.length)) bad.push('ferramenta inválida ' + S.tool);
  if (!isFinite(K.cam.z) || K.cam.z <= 0) bad.push('câmera inválida ' + K.cam.z);
  if (!isFinite(S.ips)) bad.push('¥/s inválido');
  return bad;
}`;
async function partida(b, n) {
  const c = await b.newContext(MOB ? { viewport: { width: 800, height: 368 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  const p = await c.newPage(), probs = [], log = [];
  p.on('pageerror', e => probs.push('ERRO: ' + e.message.split('\n')[0]));
  await p.goto(URL); await p.waitForTimeout(800);
  let lastT = -1, stuck = 0;
  for (let i = 0; i < ACTS && probs.length < 3; i++) {
    let act = '';
    try { act = await p.evaluate(`(${ACT})(${i})`); } catch (e) { probs.push('ERRO na ação: ' + e.message.split('\n')[0]); }
    log.push(act); if (log.length > 6) log.shift();
    if (i % 10 === 9) {
      await p.waitForTimeout(60);
      const bad = await p.evaluate(`(${SANE})()`).catch(e => ['página não responde: ' + e.message.split('\n')[0]]);
      for (const x of bad) probs.push(x + '  ← depois de: ' + log.join(' > '));
      const t = await p.evaluate('__kome.paused() ? -2 : __kome.S.time').catch(() => -1);   // pausa de propósito (Casa, cutscene, cartão) não conta
      if (t !== -2 && t === lastT) { if (++stuck >= 3) probs.push('jogo parado (tempo não anda)  ← depois de: ' + log.join(' > ')); } else stuck = 0;
      lastT = t;
    }
  }
  if (probs.length) await p.screenshot({ path: path.join(OUT, 'partida-' + n + '.png') }).catch(() => {});
  await c.close();
  return probs;
}
(async () => {
  const t0 = Date.now(), b = await launch(), all = new Map(); let done = 0, next = 0;
  async function worker() { while (next < RUNS) { const n = next++; const pr = await partida(b, n); done++; for (const x of pr) { const k = x.split('  ←')[0]; if (!all.has(k)) all.set(k, { n: 0, ex: x, partida: n }); all.get(k).n++; } } }
  await Promise.all(Array.from({ length: PAR }, worker));
  await b.close();
  console.log('robô: ' + done + ' partidas × ' + ACTS + ' ações (' + (MOB ? 'celular' : 'PC') + ') em ' + Math.round((Date.now() - t0) / 1000) + ' s');
  if (!all.size) { console.log('nenhum problema'); process.exit(0); }
  for (const [k, v] of all) console.log('PROBLEMA ×' + v.n + ' (print: partida-' + v.partida + '.png): ' + v.ex.slice(0, 300));
  process.exit(1);
})();
