#!/usr/bin/env node
/* Kome tools: TESTE DO ALICERCE (fase 0 do PLANO-100H). Roda a cada camada nova; imprime só ok/FALHOU.
   1) cavar enche o Armazém (G.Items) com itens do tipo certo e o ¥ continua igual
   2) save antigo (v4, sem armazém) carrega, migra pra versão atual e não perde dinheiro/ferramenta
   3) armazém sobrevive a salvar + recarregar
   4) E.Sim: tick e catchUp (offline) somam o que os sistemas devolvem
   uso: node tools/alicerce.js */
const path = require('path');
const { launch } = require('./pw');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHOU ') + m); if (!c) bad++; };
(async () => {
  const b = await launch(), p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.goto(URL + '?fresh&nointro&nofont'); await p.waitForTimeout(700);
  // 1) cavar
  const r1 = await p.evaluate(() => { const K = __kome, S = K.S; const m0 = S.money;
    for (let s = 0; s < 240; s++) { const a = K.aim(); K.hold(a.x, a.y, true); K.step(1 / 4); }
    K.hold(0, 0, false); K.step(3);
    return { inv: Object.assign({}, S.stats.inv), list: KomeGame.Items.list().map(x => x.it.id + ':' + x.all), money: S.money - m0, sim: KomeGame.Sim && KomeGame.Sim.list() }; });
  ok(r1.list.length > 0 && r1.inv.arroz > 1, 'cavar enche o armazém: ' + r1.list.join(' '));
  ok(r1.money > 0, 'dinheiro continua entrando (+¥' + Math.round(r1.money) + ')');
  ok(r1.sim && r1.sim.indexOf('itens') >= 0, 'E.Sim registrado: ' + r1.sim);
  // fábrica: abre no final, monta, e tem que voltar igual depois de recarregar
  await p.evaluate(() => { __kome.S.ended = true; __kome.step(0.2); KomeGame.Fab.place('moldadora', 4, 2, 0, true); KomeGame.Fab.place('divisor', 6, 2, 1, true); });
  // 3) salvar e recarregar
  await p.evaluate(() => { KomeGame.Game.saveNow(); });
  const keyInfo = await p.evaluate(() => Object.keys(localStorage).filter(k => /kome/.test(k)));
  await p.evaluate(() => { KomeGame.Game.saveNow(); });
  await p.goto(URL + '?nointro&nofont'); await p.waitForTimeout(700);
  const r3 = await p.evaluate(() => ({ inv: __kome.S.stats.inv || {}, money: __kome.S.money }));
  const rf = await p.evaluate(() => KomeGame.Fab.state.machines.map(m => m.type + '@' + m.x + ',' + m.y).join(' '));
  ok(/panela@2,2/.test(rf) && /moldadora@4,2/.test(rf) && /divisor@6,2/.test(rf), 'fábrica volta igual depois de recarregar: ' + rf);
  ok((r3.inv.arroz | 0) === (r1.inv.arroz | 0) || r3.inv.arroz >= r1.inv.arroz * 0.99, 'armazém sobrevive ao recarregar (arroz ' + Math.floor(r3.inv.arroz || 0) + ', chaves ' + keyInfo.join(',') + ')');
  // 2) save antigo v4: tira o armazém e a versão, recarrega
  // (o jogo regrava o save ao sair da página, então a troca é feita ANTES dos scripts do jogo, na próxima carga)
  await p.addInitScript(() => { if (sessionStorage.getItem('mig')) return; sessionStorage.setItem('mig', '1');
    const k = 'kome-no-japao-v4', d = JSON.parse(localStorage.getItem(k));
    d.__v = 4; delete d.stats.inv; delete d.stats.got; d.money = 777; d.tool = 3; localStorage.setItem(k, JSON.stringify(d)); localStorage.removeItem(k + '.bak'); });
  await p.goto(URL + '?nointro&nofont'); await p.waitForTimeout(700);
  const r2 = await p.evaluate(() => { const K = __kome, S = K.S; for (let s = 0; s < 40; s++) { const a = K.aim(); K.hold(a.x, a.y, true); K.step(1 / 4); } K.hold(0, 0, false); K.step(3);
    return { money: S.money, tool: S.tool, inv: S.stats.inv, v: JSON.parse(localStorage.getItem('kome-no-japao-v4')).__v }; });
  ok(r2.tool === 3 && r2.money >= 777, 'save v4 carregou (ferramenta ' + r2.tool + ', ¥' + Math.round(r2.money) + ')');
  ok(r2.inv && typeof r2.inv === 'object' && Object.keys(r2.inv).length > 0, 'migração criou o armazém e ele enche: ' + JSON.stringify(Object.fromEntries(Object.entries(r2.inv || {}).map(([k, v]) => [k, Math.floor(v)]))));
  // 5) amuletos (game/amuletos.js): migração cria S.stats.am; na ilha o modo acelerado escolhe sozinho; volta igual do save; viagem zera
  const r5 = await p.evaluate(() => { const K = __kome, S = K.S, A = KomeGame.Amuletos; const mig = !!(S.stats.am && Array.isArray(S.stats.am.cur));
    S.island = 1; S.stats.islandsDone = 1; S.stats.seeds = 50; S.ended = false; S.tool = 3; const pend = A.pending(); K.step(1); const cur = S.stats.am.cur.slice();
    const rr0 = S.stats.seeds; S.tool = 7; const o1 = A.offer().map(x => x.id).join(); const okR = A.reroll(); const o2 = A.offer().map(x => x.id).join(); K.step(1);
    KomeGame.Game.saveNow(); return { mig, pend, cur, n: S.stats.am.cur.length, okR, spent: rr0 - S.stats.seeds, diff: o1 !== o2 }; });
  ok(r5.mig, 'migração criou S.stats.am (amuletos)');
  ok(r5.pend && r5.cur.length === 1 && r5.n === 2, 'modo acelerado escolhe o amuleto na hora (chegada + 1ª máquina a motor): ' + r5.cur.join());
  ok(r5.okR && r5.spent === 1 && r5.diff, 'rerrolar custa 1 semente e troca as cartas');
  await p.goto(URL + '?nointro&nofont'); await p.waitForTimeout(700);
  const r6 = await p.evaluate(() => { const S = __kome.S, A = KomeGame.Amuletos; const n = S.stats.am.cur.length, d = Object.keys(S.stats.am.disc).length;
    S.stats.islandsDone = 2; const after = A.current().length, disc = Object.keys(A.discovered()).length; return { n, d, after, disc, rr: S.stats.am.rr }; });
  ok(r6.n === 2 && r6.d >= 2, 'amuletos voltam do save (' + r6.n + ' na build, ' + r6.d + ' descobertos)');
  ok(r6.after === 0 && r6.disc === r6.d && r6.rr === 0, 'viagem zera a build e o rerrolar; descobertos ficam');
  // 7) Cidade (game/cidade.js): MIGR[7] cria S.stats.city; abre no 1º mochi vendido; entrega dá coração; amizade = grão no Coração + obra
  const r7 = await p.evaluate(() => { const K = __kome, S = K.S, G = KomeGame, C = G.City; const mig = !!(S.stats.city && typeof S.stats.city === 'object' && !S.stats.city.on);
    S.ended = true; K.step(0.3); const fab = G.Fab.on();
    C.take('onigiri'); const still = !C.on(); C.take('mochi'); const on = C.on();
    C.step(3); const o = S.stats.city.ord.findIndex(Boolean); const okD = o >= 0 && C.deliver(o);
    const h0 = G.Patio.heart(); C.levelUp('kiku'); C.choose(); const st = C.state;
    const obra = S.stats.city.lots.some(l => l.obra > 0); KomeGame.Game.saveNow();
    return { mig, fab, still, on, okD, del: st.delivered, hearts: st.hearts, grains: st.grains, obra, dh: G.Patio.heart() - h0, view: !!C.view() }; });
  ok(r7.mig, 'migração criou S.stats.city (Cidade fechada)');
  ok(r7.still && r7.on && r7.view, 'Cidade abre no 1º mochi vendido pela fábrica (não no onigiri)');
  ok(r7.okD && r7.del === 1 && r7.hearts >= 1, 'entrega na hora com a tela fechada: ' + r7.del + ' entrega, ♥' + r7.hearts);
  ok(r7.grains >= 1 && r7.dh > 0.009 && r7.obra, 'amizade: +1 grão no Arroz do Coração (+' + (r7.dh * 100).toFixed(1) + '%) e obra começou');
  await p.goto(URL + '?nointro&nofont'); await p.waitForTimeout(700);
  const r8 = await p.evaluate(() => { const S = __kome.S, G = KomeGame, C = G.City; const st = C.state;
    const off = G.Sim.catchUp(3600), built = S.stats.city.lots.filter(l => l.b).length;
    const d = JSON.parse(JSON.stringify({ v: 4, stats: S.stats, island: 0, earned: 1 })); G.Islands.makeSave(d, 1, 10);
    return { on: st.on, del: st.delivered, ppl: st.people.length, obraSaved: / obra/.test(' ' + st.lots), off: off.cidade, built, trip: d.stats.city && d.stats.city.on && d.stats.city.delivered === 1 && d.stats.city.grains === st.grains }; });
  ok(r8.on && r8.del === 1 && r8.ppl === 6 && r8.obraSaved, 'Cidade volta igual do save (moradores, entregas, obra)');
  ok(r8.off && r8.built >= 1, 'offline (E.Sim): a obra termina com o tempo fora: ' + JSON.stringify(r8.off));
  ok(r8.trip, 'viagem não zera a Cidade (S.stats.city fica)');
  // 7) faixas (game/faixas.js) e evoluções (game/evolucoes.js): migração MIGR[8], regras por volta, sementes, faixa no Kome, evolução ×3
  const rFx = await p.evaluate(() => { const K = __kome, S = K.S, F = KomeGame.Faixas, A = KomeGame.Amuletos, V = KomeGame.Evolucoes, P = Pixxel;
    const mig = !!(S.stats.fx && typeof S.stats.fx.seen === 'number' && S.stats.evo && S.stats.evo.disc);
    const lap0 = S.stats.lap | 0, g0 = KomeGame.Islands.gain() / F.seedMul();
    S.island = 1; S.stats.islandsDone = 7; S.stats.lap = 2; S.ended = false; S.tool = 3; K.step(0.5);
    const lv = F.level(), max = A.max(), mul = F.seedMul(), seen = S.stats.fx.seen;
    const cv = P.shibaCanvas('sit', 0.4, { pal: (S.look && S.look.pal) || 'kome' }), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let belt = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 242 && d[i + 1] === 201 && d[i + 2] === 76) belt++;
    S.stats.lap = 9; S.stats.islandsDone = 8; S.tool = 3; const earn9 = A.earned(); S.tool = 7; const off = (A.offer() || []).length;
    S.stats.am.cur = ['frota_feliz']; S.stats.lv = { trator: 25 }; S.ended = true; K.step(0.5);
    const act = Object.keys(V.active()), disc = !!S.stats.evo.disc.trator_comboio, st = { sell: 1 }; V.applyStats(st, { id: 'trator' });
    S.stats.lap = lap0; return { mig, lv, max, mul, seen, belt, earn9, off, act, disc, x3: st.sell, g0 }; });
  ok(rFx.mig, 'migração criou S.stats.fx e S.stats.evo (faixas/evoluções)');
  ok(rFx.lv === 2 && rFx.max === 4 && Math.abs(rFx.mul - 2.25) < 1e-9 && rFx.seen === 2, 'faixa amarela na volta 3: 4 amuletos, sementes ×2,25, apresentação pulada no modo acelerado (' + JSON.stringify([rFx.lv, rFx.max, rFx.mul, rFx.seen]) + ')');
  ok(rFx.belt > 4, 'faixa amarrada no Kome (' + rFx.belt + ' px da cor da faixa)');
  ok(rFx.earn9 === 0 && rFx.off === 2, '2º Dan: sem amuleto na chegada e 2 cartas por escolha (' + rFx.earn9 + ', ' + rFx.off + ')');
  ok(rFx.act.indexOf('trator') >= 0 && rFx.disc && rFx.x3 === 3, 'Trator nível 25 + Frota Feliz = Trator Comboio, ×3, anotado no Caderno (' + rFx.act.join() + ')');
  // 9) conquistas em escada (escada.js), carta do dia (carta.js): MIGR[9], graus sem fim valem no Arroz do Coração, carta 1x por dia
  const rEsc = await p.evaluate(() => { const K = __kome, S = K.S, G = KomeGame, Es = G.Escada;
    const mig = !!(S.stats.esc && S.stats.carta && S.stats.recF && S.stats.mrec && typeof S.stats.dugAll === 'number');
    const h0 = G.Patio.heart(), t0 = Es.total(); S.stats.sacks = 5000; S.stats.goldEv = 3; K.step(2); const t1 = Es.total(), h1 = G.Patio.heart();
    const c = Es.closest(), d = JSON.parse(JSON.stringify({ v: 4, stats: S.stats, island: 0, earned: 5, dug: 100 })); G.Islands.makeSave(d, 1, 0);
    return { mig, t0, t1, dh: h1 - h0, g: Es.grade('sacos'), c: c && c.txt, dug: d.stats.dugAll - (S.stats.dugAll || 0), keep: d.stats.esc.g.sacos === Es.grade('sacos') }; });
  ok(rEsc.mig, 'migração MIGR[9] criou esc/carta/recF/mrec/dugAll');
  ok(rEsc.g >= 10 && rEsc.t1 > rEsc.t0 && rEsc.dh > (rEsc.t1 - rEsc.t0) * 0.0099, 'escada: 5.000 sacos = ' + rEsc.g + ' graus de uma vez, +' + (rEsc.dh * 100).toFixed(0) + '% no Coração · mais perto: ' + rEsc.c);
  ok(rEsc.dug === 100 && rEsc.keep, 'viagem soma dugAll e não zera os graus');
  const rCa = await p.evaluate(() => { const S = __kome.S, G = KomeGame, C = G.Carta; S.stats.carta.day = '2000-01-01'; S.stats.carta.tok = {}; G.Game.saveNow(); return C.today(); });
  await p.goto(URL + '?nointro&nofont'); await p.waitForTimeout(700);
  const rCb = await p.evaluate(() => { const K = __kome, S = __kome.S, G = KomeGame, C = G.Carta; const pend = C.pending(); K.step(2); const after = C.pending();
    const day = S.stats.carta.day; S.stats.islandsDone = 3; S.island = 1; S.stats.carta.tok.rr = 1; const rc = G.Amuletos.rerollCost(); return { pend, after, day, rc }; });
  ok(rCb.pend && !rCb.after && rCb.day === rCa, 'carta do dia: abre num dia novo; no modo acelerado o presente entra sem tela (dia ' + rCb.day + ')');
  ok(rCb.rc === 0, 'presente "rerrolar grátis" deixa a troca de cartas de graça');
  // 4) E.Sim puro
  const r4 = await p.evaluate(() => { const s = Pixxel.Sim(); let t = 0; s.add('a', { tick: dt => { t += dt; }, offline: dt => ({ yen: dt * 2 }) }).add('b', { tick() {} });
    s.tick(0.5); const off = s.catchUp(3600); return { t, off }; });
  ok(r4.t === 0.5 && r4.off.a && r4.off.a.yen === 7200 && !r4.off.b, 'E.Sim tick/catchUp: ' + JSON.stringify(r4.off));
  ok(!errs.length, 'sem erro de página' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
  console.log(bad ? bad + ' FALHA(S)' : 'ALICERCE OK');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
