#!/usr/bin/env node
/* Kome tools: playtest automático do jogo (Chromium headless, mesmo estilo do shot.js).
   uso: node kome/tools/playtest.js [--rungs] [--auto] [--min 90] [--out dir] [--prints]
     --rungs   pra cada um dos 13 degraus: dá dinheiro, compra pelo caminho real, segura o ponteiro no barranco, avança alguns
               segundos com __kome.step() e confere: a montanha diminuiu, o dinheiro subiu, nenhum erro de página. Salva um PNG por degrau.
     --auto    autoplayer guloso a partir de um save novo (segura 85% do tempo, compra a coisa mais barata que der) e imprime a
               linha do tempo comparada com as metas do GDD §9 (final em 60-90 min, intervalo máx <= 180 s, <= 50% cavado na Bagger).
     --prints  salva os 3 prints oficiais em kome/docs/prints/.
   Sem opção nenhuma roda --rungs e --auto. Sai com código 1 se alguma verificação falhar. */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const a = process.argv.slice(2), has = k => a.includes(k), val = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const OUT = val('--out', '/tmp/claude-0/-home-user-Pizzaria-Site/73bb5c4b-e898-5ba0-a571-a9a62e6621c9/scratchpad/play');
const MAXMIN = +val('--min', 100);
const all = !has('--rungs') && !has('--auto') && !has('--prints');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?fresh&nofont';
const PRINTS = path.resolve(__dirname, '..', 'docs', 'prints');
let fails = 0;
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  page.errs = [];
  page.on('pageerror', e => { page.errs.push(e.message); console.log('PAGEERROR:', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')); });
  page.on('console', m => { if (m.type() === 'error') { console.log('CONSOLE.error:', m.text()); } });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  return page;
}
// segura no ponto bom por `sec` segundos de simulação, remirando a cada segundo
const CLEAN = `document.querySelectorAll('.k-toast, .k-banner, .k-ach').forEach(e => e.remove())`;
const HOLD = `(sec => { const K = __kome; for (let i = 0; i < sec; i++) { const p = K.aim(); K.hold(p.x, p.y, true); K.step(1); K.tapAll(); } })`;
// compra o próximo degrau pelo caminho real (incluindo a cadeia de nós que a Bagger exige)
const BUYNEXT = `(() => { const K = __kome, D = K.data, t = D.TOOLS[K.S.tool + 1]; if (!t) return 'fim';
  const need = id => { const n = D.nodeById[id]; if (K.S.own[id]) return; n.req.forEach(need); K.addMoney(K.nodeCost(id)); if (!K.buyNode(id)) throw new Error('não comprou o nó ' + id); };
  (t.needs || []).forEach(need);
  K.addMoney(Math.ceil(t.cost * D.ECON.COST_TOOL)); if (!K.buyTool()) throw new Error('não comprou ' + t.id); return t.id; })()`;

async function rungs(browser) {
  console.log('\n== 13 degraus ==');
  const page = await open(browser);
  fs.mkdirSync(OUT, { recursive: true });
  for (let i = 0; i < 13; i++) {
    const e0 = page.errs.length;
    let id = 'pata';
    try {
      if (i > 0) id = await page.evaluate(BUYNEXT);
      await page.evaluate(`__kome.step(${id === 'bagger' ? 8 : 2.2})`);
      const r = await page.evaluate(`(() => { const K = __kome, a0 = K.heap.area, m0 = K.S.money; ${HOLD}(${id === 'caminhao' ? 30 : id === 'bagger' ? 14 : 10});
        return { id: K.tool.id, dug: a0 - K.heap.area, yen: K.S.money - m0, ips: K.S.ips, x: K.P.x, y: K.P.y, z: K.tool.zoom }; })()`);
      await page.evaluate(`(() => { const p = __kome.aim(); __kome.hold(p.x, p.y, true); __kome.view(); })()`);
      await page.waitForTimeout(id === 'bagger' ? 4500 : 1300);
      await page.evaluate(CLEAN);
      await page.screenshot({ path: path.join(OUT, String(i + 1).padStart(2, '0') + '-' + id + '.png') });
      const perf = await page.evaluate(`({ u: __kome.S.perf.upd, r: __kome.S.perf.ren })`);
      const ok = r.dug > 0 && r.yen > 0 && page.errs.length === e0;
      if (!ok) fails++;
      console.log((ok ? 'ok   ' : 'FALHA') + ' ' + String(i + 1).padStart(2) + ' ' + id.padEnd(13) + ' cavou ' + Math.round(r.dug) + ' px²  +¥' + Math.round(r.yen) + '  x=' + Math.round(r.x) + '  update ' + perf.u.toFixed(2) + ' ms  render ' + perf.r.toFixed(2) + ' ms');
      await page.evaluate(`__kome.hold(0, 0, false)`);
    } catch (e) { fails++; console.log('FALHA ' + (i + 1) + ' ' + id + ': ' + e.message.split('\n')[0]); }
  }
  if (has('--prints') || all) {
    fs.mkdirSync(PRINTS, { recursive: true });
    await page.evaluate(`(() => { for (let i = 0; i < 40; i++) { const p = __kome.aim(); __kome.hold(p.x, p.y, true); __kome.step(1); } const p = __kome.aim(); __kome.hold(p.x, p.y, true); __kome.view(); })()`);
    await page.waitForTimeout(2500);
    await page.evaluate(CLEAN);
    await page.screenshot({ path: path.join(PRINTS, 'jogo-bagger.png') });
    console.log('print -> jogo-bagger.png');
  }
  // save -> recarrega -> confere que o mundo voltou igual
  const before = await page.evaluate(`(() => { const K = __kome; K.hold(0, 0, false); K.step(2); K.save(); return { money: Math.round(K.S.money), tool: K.S.tool, n: Object.keys(K.S.own).length, area: Math.round(K.heap.area), house: K.S.house }; })()`);
  await page.goto(URL.replace('?fresh&', '?'), { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const after = await page.evaluate(`(() => { const K = __kome; return { money: Math.round(K.S.money), tool: K.S.tool, n: Object.keys(K.S.own).length, area: Math.round(K.heap.area), house: K.S.house }; })()`);
  const same = before.tool === after.tool && before.n === after.n && Math.abs(before.area - after.area) < before.area * 0.002 && Math.abs(before.money - after.money) <= Math.max(50, before.money * 0.02);
  if (!same || page.errs.length) fails++;
  console.log((same ? 'ok   ' : 'FALHA') + ' save/load: ' + JSON.stringify(before) + ' -> ' + JSON.stringify(after));
  await page.close();
}

async function prints(browser) {
  fs.mkdirSync(PRINTS, { recursive: true });
  let page = await open(browser);
  await page.evaluate(`(() => { const p = __kome.aim(); __kome.hold(p.x, p.y, true); __kome.step(3); __kome.view(); })()`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(PRINTS, 'jogo-inicio.png') });
  // meio: escavadeira com nós comprados
  await page.evaluate(`(() => { const K = __kome, D = K.data; for (let i = 0; i < 9; i++) { ${BUYNEXT}; K.step(2); ${HOLD}(i < 6 ? 4 : 12); }
    for (let r = 0; r < 6; r++) for (const n of D.TREE) if (K.nodeState(n.id) === 'open' && n.c < 3e6 && !n.fx.part) { K.addMoney(K.nodeCost(n.id)); K.buyNode(n.id); }
    K.addMoney(300000); K.buyHouse(); ${HOLD}(25); const p = K.aim(); K.hold(p.x, p.y, true); K.view(); })()`);
  await page.waitForTimeout(1200);
  await page.evaluate(CLEAN);
  await page.screenshot({ path: path.join(PRINTS, 'jogo-meio.png') });
  console.log('prints -> jogo-inicio.png, jogo-meio.png');
  await page.close();
}

async function auto(browser) {
  console.log('\n== autoplayer guloso (segura 85%, compra o mais barato) ==');
  const page = await open(browser);
  const t0 = Date.now();
  let done = false, log = [];
  while (!done) {
    const r = await page.evaluate(`((maxMin) => { const K = __kome, D = K.data, S = K.S, out = [];
      const tEnd = S.time + 120;
      while (S.time < tEnd && !S.ended && S.time < maxMin * 60) {
        const ph = S.time % 20;
        if (ph < 17) { const p = K.aim(); K.hold(p.x, p.y, true); } else K.hold(0, 0, false);
        K.step(1); K.tapAll();
        for (let guard = 0; guard < 12; guard++) {
          let best = null, bc = Infinity;
          const t = D.TOOLS[S.tool + 1];
          if (t && !(t.needs || []).some(id => !S.own[id])) { best = ['tool', t.id]; bc = Math.ceil(t.cost * D.ECON.COST_TOOL); }
          const h = D.HOUSE[S.house];
          if (h && S.tool + 1 >= h.tier && h.c * D.ECON.COST_HOUSE < bc) { best = ['house', h.id]; bc = Math.ceil(h.c * D.ECON.COST_HOUSE); }
          for (const n of D.TREE) if (!S.own[n.id] && K.nodeState(n.id) === 'open' && K.nodeCost(n.id) < bc) { best = ['node', n.id]; bc = K.nodeCost(n.id); }
          if (!best || S.money < bc) break;
          const ok = best[0] === 'tool' ? K.buyTool() : best[0] === 'house' ? K.buyHouse() : K.buyNode(best[1]);
          if (!ok) break;
          const w = S.win, e = { t: S.time, k: best[0], id: best[1], c: bc, ips: S.ips, dug: 1 - K.heap.area / K.heap.total };
          if (best[0] === 'tool') { const tot = w.inc[0] + w.inc[1] + w.inc[2] || 1; e.val = w.val / (w.got || 1); e.auto = w.inc[1] / tot; e.bonus = w.inc[2] / tot; w.got = w.val = 0; w.inc[0] = w.inc[1] = w.inc[2] = 0; }
          out.push(e);
        }
      }
      return { out, t: S.time, ended: S.ended, money: S.money, ips: S.ips, dug: 1 - K.heap.area / K.heap.total, tool: K.tool.id, x: K.P.x, n: Object.keys(S.own).length, house: S.house };
    })(${MAXMIN})`);
    log = log.concat(r.out);
    if (has('--verbose')) console.log('  ' + fmt(r.t) + ' ' + r.tool + ' ¥' + Math.round(r.money) + ' ¥/s ' + Math.round(r.ips) + ' cavado ' + (r.dug * 100).toFixed(1) + '% x=' + Math.round(r.x) + ' nós ' + r.n);
    done = r.ended || r.t >= MAXMIN * 60;
    if (done) {
      let last = 0, maxGap = 0, gapAt = '', bag = null;
      console.log('tempo   compra                                   ¥/s      cavado  espera');
      for (const e of log) {
        const gap = e.t - last; if (gap > maxGap) { maxGap = gap; gapAt = e.id + ' @' + fmt(e.t); } last = e.t;
        if (e.k !== 'node') console.log(fmt(e.t).padStart(6) + '  ' + (e.k === 'tool' ? 'FERRAMENTA ' : 'CASA ') .padEnd(11) + e.id.padEnd(30) + String(Math.round(e.ips)).padStart(9) + (e.dug * 100).toFixed(1).padStart(8) + '%' + String(Math.round(gap)).padStart(6) + ' s' + (e.val ? '   janela anterior: val médio ' + e.val.toFixed(2) + ' · auto ' + Math.round(e.auto * 100) + '% · prêmios ' + Math.round(e.bonus * 100) + '%' : ''));
        if (e.id === 'bagger') bag = e;
      }
      const toolGaps = log.filter(e => e.k === 'tool').map((e, i, arr) => e.id + ':' + Math.round(e.t - (i ? arr[i - 1].t : 0)) + 's').join(' ');
      console.log('intervalos entre ferramentas: ' + toolGaps);
      console.log('\nRESULTADO: ' + (r.ended ? 'final em ' + (r.t / 60).toFixed(1) + ' min' : 'NÃO terminou em ' + MAXMIN + ' min (casa ' + r.house + '/6, ferramenta ' + r.tool + ')') +
        ' · compras ' + log.length + ' (nós ' + r.n + '/68) · intervalo máx ' + Math.round(maxGap) + ' s (' + gapAt + ')' +
        ' · Bagger aos ' + (bag ? (bag.t / 60).toFixed(1) + ' min com ' + (bag.dug * 100).toFixed(1) + '% cavado' : 'nunca') + ' · cavado no fim ' + (r.dug * 100).toFixed(1) + '%');
      const T = (ok, s) => console.log((ok ? '  ok    ' : '  FORA  ') + s);
      T(r.ended && r.t / 60 >= 60 && r.t / 60 <= 90, 'final entre 60 e 90 min');
      T(maxGap <= 180, 'intervalo máximo entre compras <= 180 s');
      T(bag && bag.dug <= 0.5, '<= 50% da montanha cavada quando a Bagger chega');
      console.log('  (simulou ' + (r.t / 60).toFixed(0) + ' min em ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s reais; erros de página: ' + page.errs.length + ')');
      if (page.errs.length) fails++;
    }
  }
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  if (all || has('--prints')) await prints(browser);
  if (all || has('--rungs')) await rungs(browser);
  if (all || has('--auto')) await auto(browser);
  await browser.close();
  console.log(fails ? '\n' + fails + ' falha(s)' : '\ntudo certo');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
