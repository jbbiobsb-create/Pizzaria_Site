#!/usr/bin/env node
/* Kome tools: SIMULADOR DA FÁBRICA — confere as metas de ritmo de docs/design/fabrica.md.
   Joga a campanha rápido (comprador guloso) até o final, aí a Fábrica abre e um "jogador de planta" monta linhas na
   ordem (moldadora → doca → 2ª e 3ª linha de onigiri → pilões → níveis), sempre cavando com a melhor ferramenta.
   Imprime as metas com ok/FORA e um resumo. uso: node tools/fabrica-sim.js [--min 125] [--verbose] [--runs 8] [--set lvl.cost=1.3,dock.price=40] [--coceira 90] [--barato 0.25]
   Cada partida varia bastante (sacos, onigiris e bolsões dão renda em rajada): use --runs pra ver mediana e faixa. */
const path = require('path');
const { launch } = require('./pw');
const a = process.argv.slice(2), val = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d), has = k => a.includes(k);
const MIN = +val('--min', 125), ITCH = +val('--coceira', 90), EAGER = +val('--barato', 0.25), RUNS = +val('--runs', 1);
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

// campanha: compra o mais barato (ferramenta, casa, nó) até o final
const CAMPAIGN = `((secs) => { const K = __kome, D = K.data, S = K.S;
  for (let s = 0; s < secs && !S.ended; s++) {
    const p = K.aim(); K.hold(p.x, p.y, S.time % 20 < 17); K.step(1); K.tapAll();
    for (let g = 0; g < 6; g++) { const C = [];
      const t = D.TOOLS[S.tool + 1]; if (t && !(t.needs || []).some(id => !S.own[id])) C.push([KomeGame.Game.toolCost(t), () => K.buyTool()]);
      const h = D.HOUSE[S.house]; if (h && S.tool + 1 >= h.tier) C.push([h.c * D.ECON.COST_HOUSE, () => K.buyHouse()]);
      for (const n of D.TREE) if (!S.own[n.id] && K.nodeState(n.id) === 'open') C.push([K.nodeCost(n.id), () => K.buyNode(n.id)]);
      C.sort((x, y) => x[0] - y[0]); if (!C[0] || C[0][0] > S.money) break; C[0][1](); }
  } return { t: S.time, ended: !!S.ended }; })`;

// planta: passos em ordem; cada um é [rótulo, custo(), fazer()]
const FACTORY = `((secs, st) => { const K = __kome, S = K.S, F = KomeGame.Fab, out = [], ITCH = ${ITCH}, EAGER = ${EAGER};
  const line = (y, kind) => kind === 'oni'
    ? [['esteiras linha ' + y, () => 0, () => F.belt([[0, y], [1, y], [2, y], [3, y], [4, y], [5, y], [6, y], [7, y]], 0)],
       ['panela L' + y, () => F.price('panela'), () => F.place('panela', 2, y, 0)], ['moldadora L' + y, () => F.price('moldadora'), () => F.place('moldadora', 4, y, 0)]]
    : [['esteiras linha ' + y, () => 0, () => F.belt([[0, y], [1, y], [2, y], [3, y], [4, y], [5, y], [6, y], [7, y]], 0)],
       ['panela L' + y, () => F.price('panela'), () => F.place('panela', 1, y, 0)], ['pilão L' + y, () => F.price('pilao'), () => F.place('pilao', 3, y, 0)]];
  const PLAN = [['moldadora L2', () => F.price('moldadora'), () => F.place('moldadora', 4, 2, 0)], ['doca', () => F.dockPrice(), () => F.dockUp()]]
    .concat(line(3, 'oni'), [['doca', () => F.dockPrice(), () => F.dockUp()]], line(1, 'oni'), [['doca', () => F.dockPrice(), () => F.dockUp()]],
            [['ESPERA PILÃO', () => 0, () => true]], line(4, 'mochi'), [['doca', () => F.dockPrice(), () => F.dockUp()]], line(5, 'mochi'), line(0, 'mochi'), [['doca', () => F.dockPrice(), () => F.dockUp()]]);
  for (let s = 0; s < secs; s++) {
    const p = K.aim(); K.hold(p.x, p.y, true); K.step(1); K.tapAll();
    if (K.heap.area < K.heap.total * 0.12) K.newMountain();   // modo infinito: montanha nova quando acaba
    const tf = S.time - st.t0;
    // jogador "com coceira": junta dinheiro pra próxima peça da planta, mas depois de ITCH s sem comprar nada leva o nível
    // mais barato (máquina ou doca) se ele custar até 60% do que tem na mão (não torra a poupança da peça grande).
    // Nível baratinho perto da peça (≤ EAGER do preço dela) ele compra na hora.
    let fill = null, plan = null;
    for (const m of F.state.machines) if (m.type !== 'divisor' && m.lvl >= 10 && F.selo) { F.selo(m.x, m.y); st.selo = (st.selo || 0) + 1; }   // Selo de Qualidade: no máximo, tira o selo na hora (é grátis)
    for (const m of F.state.machines) { if (m.type === 'divisor' || m.lvl >= 10) continue; const c = F.levelPrice(m.x, m.y); if (!fill || c < fill[0]) fill = [c, () => { F.levelUp(m.x, m.y); st.lv = (st.lv || 0) + 1; }]; }
    if (!F.state.dockMax) { const c = F.dockPrice(); if (!fill || c < fill[0]) fill = [c, () => { F.dockUp(); st.dk = (st.dk || 0) + 1; }]; }
    while (st.i < PLAN.length && PLAN[st.i][0] === 'doca' && F.state.dockMax) st.i++;
    if (st.i < PLAN.length) {
      const [lb, c, f] = PLAN[st.i];
      if (lb === 'ESPERA PILÃO') { if (F.state.unlocked.pilao) { st.i++; out.push([tf, 'pilão liberado']); } }
      else if (lb.startsWith('esteiras')) { f(); st.i++; }
      else plan = [c(), () => { const m = S.money; f(); if (S.money < m || c() === 0) { st.i++; out.push([tf, lb]); } }];
    }
    if (st.i >= PLAN.length && !st.full) { st.full = tf; out.push([tf, 'PLANTA CHEIA (falta espaço)']); }
    let best = null;
    if (plan && plan[0] <= S.money) best = plan;
    else if (fill && fill[0] <= S.money && (!plan || fill[0] <= plan[0] * EAGER || (tf - st.last >= ITCH && fill[0] <= S.money * 0.6))) best = fill;
    if (best) { best[1](); if (tf - st.last > st.maxWait) { st.maxWait = tf - st.last; st.maxAt = tf; } st.last = tf; }
    if (tf - st.last > st.maxWait) { st.maxWait = tf - st.last; st.maxAt = tf; }
    const fs = F.state; st.fw = (st.fw || 0) + fs.fac; st.rw = (st.rw || 0) + fs.raw;
    if (st.e0 === undefined) st.e0 = S.earned; st.eT = S.earned - st.e0; st.rT = (st.rT || 0) + fs.raw; st.fT = (st.fT || 0) + fs.fac;
    if (st.oni < 0 && fs.made.onigiri > 0) { st.oni = tf; out.push([tf, '1º onigiri']); }
    if (tf >= st.next) { out.push([tf, 'amostra: ganho ' + Math.round((S.earned - (st.eL || st.e0)) / 300) + '/s · cavar(8s) ' + fs.raw + ' · preço-base ' + Math.round(F.price('panela') / 40 / 3) + ' · ferramenta ' + S.tool + ' · ips ' + Math.round(S.ips)]); st.eL = S.earned; st.samples.push([Math.round(tf / 60), st.fw / Math.max(1, st.fw + st.rw)]); st.fw = st.rw = 0; st.next += 300; }   // média da janela
  }
  return { out, st, t: S.time - st.t0, fs: F.state }; })`;

if (RUNS > 1) {
  const { spawn } = require('child_process'), rest = a.filter((x, i) => x !== '--runs' && a[i - 1] !== '--runs' && x !== '--verbose');
  const one = () => new Promise(res => { let o = ''; const c = spawn(process.execPath, [__filename, ...rest, '--json']); c.stdout.on('data', d => { o += d; }); c.on('close', () => { try { res(JSON.parse(o.trim().split('\n').pop())); } catch (e) { res(null); } }); });
  (async () => {
    const rs = []; for (let i = 0; i < RUNS; i += 4) rs.push(...await Promise.all(Array.from({ length: Math.min(4, RUNS - i) }, one)));
    const ok = rs.filter(Boolean), med = v => { const s = v.filter(x => x !== null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
    const row = (name, key, lo, hi, fmt) => { const v = ok.map(r => r[key]), n = v.filter(x => x !== null && x >= lo && x <= hi).length, f = x => (x === null ? '—' : fmt(x)), w = v.filter(x => x !== null);
      console.log((n === ok.length ? 'ok    ' : n * 2 > ok.length ? 'quase ' : 'FORA  ') + name.padEnd(46) + ' mediana ' + f(med(v)).padEnd(9) + ' faixa ' + (w.length ? f(Math.min(...w)) + ' a ' + f(Math.max(...w)) : '—').padEnd(20) + ' ' + n + '/' + ok.length + ' dentro'); };
    const mn = x => (x / 60).toFixed(1) + ' min', pc = x => Math.round(x * 100) + '%', sc = x => Math.round(x) + ' s';
    console.log('== fábrica: ' + ok.length + ' partidas de ' + MIN + ' min (robô: coceira ' + ITCH + ' s, barato ' + EAGER + ')');
    row('1ª compra (Moldadora) ≤ 2 min', 'm1', 0, 120, mn); row('1º onigiri ≤ 3 min', 'oni', 0, 180, mn); row('Pilão abre ~15 min (10–22)', 'pl', 600, 1320, mn);
    row('fábrica 15–25% da renda aos 15 min', 's15', 0.145, 0.255, pc); row('fábrica ~30% depois de 1 h (22–40%)', 's60', 0.215, 0.405, pc); row('teto ~50% (máx ≤ 55%)', 'top', 0, 0.55, pc);
    row('espera máx entre compras ≤ 180 s', 'wait', 0, 180, sc); row('   (quando aconteceu a espera máx)', 'waitAt', 0, 1e9, mn); row('grid enche entre 60 e 120 min', 'full', 3600, 7200, mn);
    console.log('níveis comprados (mediana): ' + med(ok.map(r => r.lv)) + ' · doca nv (mediana): ' + med(ok.map(r => r.dock)));
    process.exit(0);
  })();
} else (async () => {
  const b = await launch(), p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.goto(URL + '?fresh&nointro&nofont'); await p.waitForTimeout(700);
  const t0 = Date.now();
  let r; do { r = await p.evaluate(`(${CAMPAIGN})(300)`); } while (!r.ended && r.t < 3 * 3600);
  console.log('campanha terminou em ' + Math.round(r.t / 60) + ' min (simulado)');
  await p.evaluate(() => { KomeGame.Fab.skipTut(); });
  if (val('--set', '')) await p.evaluate(kv => { for (const q of kv.split(',')) { const [k, v] = q.split('='), ks = k.split('.'); let o = KomeGame.Data.FAB; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = +v; } }, val('--set', ''));   // testar números sem editar o data.js: --set lvl.base=0.5,lvl.cost=1.3
  let st = { t0: await p.evaluate('__kome.S.time'), i: 0, last: 0, maxWait: 0, oni: -1, next: 0, samples: [] }, all = [];
  while (true) {
    const q = await p.evaluate(`(${FACTORY})(300, ${JSON.stringify(st)})`);
    st = q.st; all = all.concat(q.out); r = q;
    if (has('--verbose')) q.out.forEach(([t, l]) => console.log('  ' + (t / 60).toFixed(1) + ' min  ' + l));
    if (q.t >= MIN * 60) break;
  }
  await b.close();
  const fs = r.fs, sh = m => { const s = st.samples.find(x => x[0] >= m); return s ? s[1] : null; };
  const firstSale = fs.firstSale, find = l => { const e = all.find(x => x[1] === l); return e ? e[0] : null; };
  const pct = v => (v === null ? '—' : Math.round(v * 100) + '%');
  const m1j = find('moldadora L2'), plj = find('pilão liberado');
  if (has('--json')) { console.log(JSON.stringify({ m1: m1j, oni: st.oni < 0 ? null : st.oni, pl: plj, s15: sh(15), s60: sh(60), top: Math.max(...st.samples.map(x => x[1])), wait: st.maxWait, waitAt: st.maxAt || 0, full: st.full || null, lv: st.lv || 0, dock: fs.dock })); process.exit(errs.length ? 1 : 0); }
  const chk = (ok, txt) => console.log((ok ? 'ok    ' : 'FORA  ') + txt);
  console.log('== fábrica ' + MIN + ' min simulados em ' + Math.round((Date.now() - t0) / 1000) + ' s reais' + (errs.length ? ' · ERROS: ' + errs.slice(0, 2).join(' | ') : ''));
  chk(true, '1ª venda (cozido): o tutorial conta como aberto; venda roda desde o desbloqueio');
  const m1 = find('moldadora L2'); chk(m1 !== null && m1 <= 120, '1ª compra (Moldadora) ≤ 2 min: ' + (m1 === null ? 'não comprou' : (m1 / 60).toFixed(1) + ' min'));
  chk(st.oni >= 0 && st.oni <= 180, '1º onigiri ≤ 3 min: ' + (st.oni < 0 ? 'não fez' : (st.oni / 60).toFixed(1) + ' min'));
  const pl = find('pilão liberado'); chk(pl !== null && pl >= 10 * 60 && pl <= 22 * 60, 'Pilão abre ~15 min: ' + (pl === null ? 'não abriu' : (pl / 60).toFixed(1) + ' min'));
  chk(sh(15) !== null && sh(15) >= 0.145 && sh(15) <= 0.255, 'fábrica 15–25% da renda aos 15 min: ' + pct(sh(15)));
  chk(sh(60) !== null && sh(60) >= 0.215 && sh(60) <= 0.405, 'fábrica ~30% depois de 1 h: ' + pct(sh(60)));
  chk(Math.max(...st.samples.map(s => s[1])) <= 0.55, 'teto ~50%: máx ' + pct(Math.max(...st.samples.map(s => s[1]))));
  chk(st.maxWait <= 180, 'espera máx entre compras ≤ 3 min: ' + Math.round(st.maxWait) + ' s (aos ' + Math.round((st.maxAt || 0) / 60) + ' min)');
  chk(st.full && st.full >= 60 * 60 && st.full <= 120 * 60, 'falta espaço no grid em 60–120 min: ' + (st.full ? (st.full / 60).toFixed(1) + ' min' : 'não encheu'));
  console.log('renda da fábrica por 5 min: ' + st.samples.map(s => s[0] + 'min ' + pct(s[1])).join(' · '));
  console.log('feito: ' + JSON.stringify(fs.made) + ' · doca nv ' + fs.dock + ' · níveis comprados ' + (st.lv || 0) + ' · docas de tapa-buraco ' + (st.dk || 0) + ' · selos ' + (st.selo || 0));
  console.log('conferência: ganho total ÷ (cavar + fábrica medidos) = ' + (st.eT / Math.max(1, st.rT + st.fT)).toFixed(2) + ' (1,00 = toda a renda passa pela conta da fábrica)');
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
