#!/usr/bin/env node
/* Kome tools: SIMULADOR DE HORAS — joga o jogo inteiro acelerado (campanha → modo infinito → ilhas → ...) com um jogador
   guloso e mede o que importa pra um jogo de 100 h: quanto dura cada fase, e principalmente ONDE fica chato
   (trecho sem nada novo aparecendo, renda travada). Só imprime o resumo.
   uso: node tools/longo.js [--horas 10] [--verbose] [--chato 10] [--json saida.json]
     --chato N   minutos sem novidade que contam como "trecho chato" (padrão 10)
   Novidade = ferramenta, etapa da casa, nó da árvore, peça da Gêmea, nível de fábrica/loja, enfeite/bicho da Casa,
   conquista, ilha nova, montanha nova, marco da Oficina (nível 10/25/50). Roda em segundo plano se quiser:
   `node tools/longo.js --horas 100 > %TEMP%/longo.txt` (100 h simuladas ≈ 1 h real). */
const path = require('path'), fs = require('fs');
const { launch } = require('./pw');
const a = process.argv.slice(2), val = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d), has = k => a.includes(k);
const HORAS = +val('--horas', 10), CHATO = +val('--chato', 10) * 60, LIM = HORAS * 3600;
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

// um bloco de simulação dentro da página: joga `secs` segundos e devolve as novidades
const CHUNK = `((secs) => {
  const K = __kome, D = K.data, S = K.S, G = KomeGame, out = [], t0 = S.time;
  const note = (k, txt) => out.push({ t: S.time - t0, k, txt });
  const achN = () => Object.keys(S.stats.ach || {}).length;
  let ach0 = achN();
  for (let s = 0; s < secs && !(S.stats.simTravel); s++) {
    const ph = S.time % 20;
    if (ph < 17) { const p = K.aim(); K.hold(p.x, p.y, true); } else K.hold(0, 0, false);
    K.step(1); K.tapAll();
    if (s % 3) continue;
    for (let guard = 0; guard < 8; guard++) {
      // candidatos: [custo, rótulo, tipo, compra]
      const C = [];
      const t = D.TOOLS[S.tool + 1];
      if (t && !(t.needs || []).some(id => !S.own[id])) C.push([K.toolCost ? K.toolCost(t) : t.cost, 'ferramenta: ' + t.name, 'tool', () => K.buyTool()]);
      const h = D.HOUSE[S.house];
      if (h && S.tool + 1 >= h.tier) C.push([h.c * D.ECON.COST_HOUSE, 'casa: ' + h.n, 'casa', () => K.buyHouse()]);
      for (const n of D.TREE) if (!S.own[n.id] && K.nodeState(n.id) === 'open') C.push([K.nodeCost(n.id), 'nó: ' + n.n, 'no', () => K.buyNode(n.id)]);
      if (S.ended) {
        const I = G.Inf && G.Inf.sim, R = G.Ind && G.Ind.sim, H = G.Home && G.Home.sim;
        if (I) { const cur = K.tool; const lv = (S.stats.lv || {})[cur.id] | 0; C.push([I.cost(cur), 'oficina: ' + cur.name + ' ' + (lv + 1), lv + 1 === 10 || lv + 1 === 25 || lv + 1 === 50 ? 'marco' : 'oficina', () => { G.S.stats.lv = G.S.stats.lv || {}; const m = S.money; I.up(cur); return S.money < m; }]); }
        if (R) {
          const r = R.run(), gp = r.giant | 0;
          if (gp < 4) C.push([R.cost.giant(), 'Gêmea peça ' + (gp + 1), 'gemea', () => R.pay(R.cost.giant(), 'g', () => { r.giant = gp + 1; })]);
          C.push([R.cost.fab(), 'fábrica nível ' + ((r.fab | 0) + 1), 'fabrica', () => R.pay(R.cost.fab(), 'f', () => { r.fab = (r.fab | 0) + 1; })]);
          const sh = D.SHOPS[(S.time / 60 | 0) % D.SHOPS.length];
          C.push([R.cost.shop(sh.id), 'loja ' + sh.n + ' ' + (((r.shops || {})[sh.id] | 0) + 1), 'loja', () => R.pay(R.cost.shop(sh.id), sh.n, () => { r.shops[sh.id] = (r.shops[sh.id] | 0) + 1; if (!r.client) r.client = sh.id; })]);
        }
        if (H) { const own = (S.homeData || {}).own || {}; for (const it of D.DECOR) if (!own[it.id] && (!it.needs || own[it.needs])) C.push([H.cost(it), 'casa: ' + it.n, 'enfeite', () => { const m = S.money; H.buy(it); return S.money < m; }]); }
      }
      C.sort((x, y) => x[0] - y[0]);
      const best = C[0]; if (!best || !(best[0] <= S.money)) break;
      if (best[3]() === false) break;
      note(best[2], best[1]);
    }
    const an = achN(); if (an > ach0) { note('conquista', 'conquista ' + an); ach0 = an; }
    // depois do final: montanha nova quando a atual está quase toda cavada
    if (S.ended && K.heap.area < K.heap.total * 0.12) { K.newMountain(); note('montanha', 'montanha nova ' + (S.mount | 0)); }
  }
  return { out, dt: S.time - t0, ended: !!S.ended, island: S.island | 0, ips: S.ips, tool: K.tool.id, house: S.house, money: S.money,
    dug: 1 - K.heap.area / K.heap.total, seeds: S.stats.seeds | 0, islandsDone: S.stats.islandsDone | 0, earned: S.earned };
})`;
// viagem: compra sementes (o mais barato primeiro) e vai pra próxima ilha (recarrega a página)
const TRAVEL = `(() => { const K = __kome, S = K.S, G = KomeGame, I = G.Islands; if (!I || !I.sim) return -1;
  const next = Math.min(4, (S.island | 0) + 1); if (next === (S.island | 0)) return -1;
  I.go(next); return next; })()`;
const SEEDS = `(() => { const S = __kome.S, G = KomeGame, I = G.Islands; if (!I || !I.sim) return 0; let n = 0;
  for (let g = 0; g < 40; g++) { const L = KomeGame.Data.SEEDS.filter(s => ((S.stats.sl || {})[s.id] | 0) < s.max).sort((a, b) => I.sim.seedCost(a) - I.sim.seedCost(b));
    const s = L[0]; if (!s || (S.stats.seeds | 0) < I.sim.seedCost(s)) break; I.sim.buy(s); n++; } return n; })()`;

(async () => {
  const b = await launch(), p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  p.on('dialog', d => d.accept());
  await p.goto(URL + '?fresh&nointro&nofont'); await p.waitForTimeout(800);
  let T = 0, lastNew = 0, endedAt = null, islandStart = 0, phase = 'campanha';
  const ev = [], gaps = [], fases = [], t0 = Date.now(), byKind = {};
  const fmt = s => (s >= 3600 ? Math.floor(s / 3600) + 'h' : '') + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + 'min';
  while (T < LIM) {
    const r = await p.evaluate(`(${CHUNK})(300)`).catch(e => ({ erro: e.message.split('\n')[0] }));
    if (r.erro) { console.log('ERRO na simulação: ' + r.erro); break; }
    for (const e of r.out) {
      const at = T + e.t; if (at - lastNew > CHATO) gaps.push([lastNew, at, phase]); lastNew = at;
      ev.push([at, e.k, e.txt]); byKind[e.k] = (byKind[e.k] || 0) + 1;
      if (has('--verbose')) console.log(fmt(at) + '  ' + e.txt);
    }
    T += r.dt;
    if (r.ended && endedAt === null) { endedAt = T; fases.push([phase, T - islandStart]); phase = r.island === 0 && !r.islandsDone ? 'infinito (Honshu)' : 'infinito (ilha ' + r.island + ')'; console.log(fmt(T) + '  FINAL da ilha ' + r.island + ' (' + fmt(T - islandStart) + ')'); }
    // viaja: 30 min de modo infinito OU nada novo há 15 min (o jogador se cansaria), se ainda há ilha
    if (endedAt !== null && r.island < 4 && (T - endedAt > 1800 || T - lastNew > 900)) {
      fases.push([phase, T - endedAt]);
      await Promise.all([p.waitForNavigation({ timeout: 30000 }).catch(() => {}), p.evaluate(TRAVEL).catch(() => {})]);
      await p.waitForTimeout(1500);
      const sb = await p.evaluate(SEEDS).catch(() => 0);
      const isl = await p.evaluate('__kome.S.island').catch(() => '?');
      const sx = await p.evaluate('JSON.stringify({sementes: __kome.S.stats.seedsAll, sl: __kome.S.stats.sl, earned: Math.round(__kome.S.earned)})').catch(() => '');
      ev.push([T, 'ilha', 'viagem pra ilha ' + isl]); lastNew = T; islandStart = T; endedAt = null; phase = 'ilha ' + isl;
      console.log(fmt(T) + '  VIAGEM → ilha ' + isl + ' (' + sb + ' melhorias de semente compradas) ' + (has('--verbose') ? sx : ''));
    }
  }
  if (endedAt === null) fases.push([phase + ' (não terminou)', T - islandStart]); else fases.push([phase, T - endedAt]);
  await b.close();
  // ---- relatório ----
  console.log('\n== ' + fmt(T) + ' simuladas em ' + Math.round((Date.now() - t0) / 1000) + ' s reais' + (errs.length ? ' · ERROS DE PÁGINA: ' + errs.slice(0, 2).join(' | ') : ' · sem erro de página'));
  console.log('fases:'); fases.forEach(([n, d]) => console.log('  ' + n.padEnd(26) + fmt(d)));
  console.log('novidades por tipo: ' + Object.entries(byKind).map(([k, v]) => k + ' ' + v).join(' · '));
  const longGaps = gaps.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
  console.log('trechos CHATOS (mais de ' + CHATO / 60 + ' min sem novidade): ' + longGaps.length);
  longGaps.slice(0, 8).forEach(([x, y, ph]) => console.log('  ' + fmt(x) + ' → ' + fmt(y) + '  (' + Math.round((y - x) / 60) + ' min, ' + ph + ')'));
  if (has('--json')) fs.writeFileSync(val('--json'), JSON.stringify({ horas: T / 3600, fases, gaps: longGaps, ev }, null, 1));
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
