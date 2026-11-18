#!/usr/bin/env node
/* Kome tools: "laboratório" visual. Passa por TODAS as telas do jogo em vários aparelhos e monta uma folha de contato
   por aparelho (uma imagem com miniaturas numeradas), pra revisar tudo de uma vez gastando pouco.
   uso: node tools/sweep.js [--only celular,em-pe] [--out pasta]
   Saída: <out>/sweep-<aparelho>.png + lista de erros de página. Código 1 se houver erro de página. */
const path = require('path'), fs = require('fs'), os = require('os');
const { launch } = require('./pw');
const a = process.argv.slice(2), val = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const OUT = val('--out', path.join(os.tmpdir(), 'kome-sweep')), only = val('--only', '').split(',').filter(Boolean);
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?fresh&nointro&nofont';
const DEVICES = [
  { id: 'pc', w: 1280, h: 720 },
  { id: 'celular', w: 800, h: 368, mob: true, dpr: 2 },
  { id: 'em-pe', w: 390, h: 844, mob: true, dpr: 2 },
];
// cada cena: [nome, código rodado na página (pode devolver texto curto), espera em ms]
const CLEAN = `document.querySelectorAll('.k-toast,.k-banner,.k-ach,.k-tipcontrols').forEach(e=>e.remove());`;
const CLOSE = `document.querySelectorAll('.k-x').forEach(b=>{ if (b.offsetParent) b.click(); }); if (KomeGame.Home && KomeGame.Home.isOpen()) KomeGame.Home.close(); if (KomeGame.Ofi && KomeGame.Ofi.isOpen()) KomeGame.Ofi.close();`;
const DIG = n => `for (let i=0;i<${n};i++){ const a=__kome.aim(); __kome.hold(a.x,a.y,true); __kome.step(1);} __kome.hold(0,0,false);`;
const SCENES = [
  ['início', `${DIG(4)}`],
  ['carrinho', `__kome.setTool(5); ${DIG(6)}`],
  ['trator', `__kome.setTool(7); __kome.S.own.a7=true; ${DIG(6)}`],
  ['escavadeira+esteiras', `__kome.setTool(10); __kome.S.own.a9=true; ${DIG(8)}`],
  ['Bagger', `__kome.setTool(13); ${DIG(6)}`],
  ['Bagger zoom aberto', `__kome.S.zoomMul=0.55; __kome.step(1);`],
  ['menu do Kome', `__kome.S.zoomMul=1; ${CLOSE} KomeGame.HUD.hub('lugares');`],
  ['árvore', `${CLOSE} document.querySelector('[aria-label="Árvore"]') ? document.querySelector('[aria-label="Árvore"]').click() : KomeGame.HUD.treePanel.open();`],
  ['ajustes', `${CLOSE} KomeGame.HUD.settings.open();`],
  ['Casa · jardim', `${CLOSE} __kome.addMoney(1e7); KomeGame.Home.open('jardim');`],
  ['Casa · bichinhos', `KomeGame.Home.close(); KomeGame.Home.open('bichos');`],
  ['Casa · roupas', `KomeGame.Home.close(); __kome.S.closet=['cachecol','coroa','sakura']; KomeGame.Home.open('roupa');`],
  ['Casa · caderno', `KomeGame.Home.close(); KomeGame.Home.open('caderno');`],
  ['Casa · ilhas', `KomeGame.Home.close(); KomeGame.Home.open('ilhas');`],
  ['Casa cheia', `KomeGame.Home.close(); __kome.S.house=4; const d=KomeGame.Home.data(); KomeGame.Data.DECOR.forEach(x=>d.own[x.id]=1); KomeGame.Home.open('jardim');`],
  ['fim do dia', `KomeGame.Home.close(); __kome.S.dayT=239; __kome.step(1.5);`],
  ['pátio', `__kome.step(7); __kome.playAs(1); __kome.P.x=900; __kome.S.camX=900; __kome.step(0.5);`],
  ['oficina', `${CLOSE} __kome.playAs(13); __kome.S.ended=true; __kome.addMoney(1e12); KomeGame.Inf.open();`],
  ['Bagger Gêmea', `${CLOSE} const r=KomeGame.Ind.run(); r.giant=4; r.fab=6; __kome.step(1); KomeGame.Ind.showTwin();`],
  ['fábrica', `${CLOSE} KomeGame.Fab.unlock(); KomeGame.Fab.unlockAll(); KomeGame.Fab.skipTut(); KomeGame.Fab.place('moldadora',4,2,0,true); KomeGame.Fab.belt([[0,4],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4]],0); KomeGame.Fab.place('panela',1,4,0,true); KomeGame.Fab.place('pilao',3,4,0,true); KomeGame.Fab.place('divisor',6,4,0,true); for(let i=0;i<200;i++){const a=__kome.aim();__kome.hold(a.x,a.y,true);__kome.step(0.1);} KomeGame.Fab.open();`],
  ['fábrica tutorial', `KomeGame.Fab.close(); KomeGame.Fab.open(); KomeGame.Fab.tut(0);`],
  ['cidade', `KomeGame.Fab.close(); KomeGame.City.demo();`],
  ['cidade · escolha', `KomeGame.City.close(); KomeGame.City.demo('escolha');`],
  ['chips + gaveta Mais', `KomeGame.City.close(); __kome.vila(false); KomeGame.HUD.chipDemo(true);`],
  ['dica (trocar máquina)', `KomeGame.HUD.chipDemo(false); KomeGame.Dicas.demo('trocar', 50);`],
  ['vila · rua da cidade', `KomeGame.Dicas.close(); KomeGame.City.close(); __kome.vilaHold(1); __kome.vila(true); setTimeout(() => __kome.vila(true, KomeGame.World.X.cid0 + 300, 0.5), 250);`],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await launch(); let bad = 0;
  for (const dv of DEVICES) {
    if (only.length && !only.includes(dv.id)) continue;
    const c = await b.newContext({ viewport: { width: dv.w, height: dv.h }, isMobile: !!dv.mob, hasTouch: !!dv.mob, deviceScaleFactor: dv.dpr || 1 });
    const p = await c.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    await p.goto(URL); await p.waitForTimeout(1000);
    const shots = [];
    for (const [name, code] of SCENES) {
      try { await p.evaluate(`(() => { ${code} })()`); } catch (e) { errs.push(name + ': ' + e.message.split('\n')[0]); }
      await p.waitForTimeout(name === 'Bagger Gêmea' ? 2400 : 700);
      await p.evaluate(CLEAN);
      shots.push([name, (await p.screenshot({ type: 'jpeg', quality: 70 })).toString('base64')]);
    }
    // folha de contato: miniaturas numeradas
    const cols = dv.h > dv.w ? 6 : 4, tw = dv.h > dv.w ? 210 : 320, th = Math.round(tw * dv.h / dv.w);
    const html = '<body style="margin:0;background:#222;font:700 13px system-ui;color:#fff;display:grid;grid-template-columns:repeat(' + cols + ',' + tw + 'px);gap:4px;padding:4px">' +
      shots.map(([n, s], i) => '<div><div>' + (i + 1) + '. ' + n + '</div><img style="width:' + tw + 'px;height:' + th + 'px;display:block" src="data:image/jpeg;base64,' + s + '"></div>').join('') + '</body>';
    const q = await b.newPage({ viewport: { width: cols * (tw + 4) + 4, height: 400 } });
    await q.setContent(html); const f = path.join(OUT, 'sweep-' + dv.id + '.png');
    await q.screenshot({ path: f, fullPage: true }); await q.close();
    console.log(dv.id.padEnd(8) + ' ' + SCENES.length + ' telas -> ' + f + (errs.length ? '  ERROS: ' + errs.slice(0, 4).join(' | ') : '  sem erro'));
    bad += errs.length; await c.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
