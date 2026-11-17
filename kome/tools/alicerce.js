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
  // 4) E.Sim puro
  const r4 = await p.evaluate(() => { const s = Pixxel.Sim(); let t = 0; s.add('a', { tick: dt => { t += dt; }, offline: dt => ({ yen: dt * 2 }) }).add('b', { tick() {} });
    s.tick(0.5); const off = s.catchUp(3600); return { t, off }; });
  ok(r4.t === 0.5 && r4.off.a && r4.off.a.yen === 7200 && !r4.off.b, 'E.Sim tick/catchUp: ' + JSON.stringify(r4.off));
  ok(!errs.length, 'sem erro de página' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
  console.log(bad ? bad + ' FALHA(S)' : 'ALICERCE OK');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
