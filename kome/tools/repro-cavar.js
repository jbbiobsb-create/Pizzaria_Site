// repro: segurar CAVAR (toque) no celular pra cada máquina e ver se ela anda pra trás
const { launch } = require('./pw');
const { devices } = require('playwright-core');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '../index.html') + '?fresh&nointro' + (process.argv.includes('--mirror') ? '' : '');
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ ...devices['Pixel 5 landscape'], hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(url); await p.waitForTimeout(2500);
  const isl = process.argv.find(a => a.startsWith('--island='));
  const cdp = await ctx.newCDPSession(p);
  const N = await p.evaluate(() => __kome.data.TOOLS.length);
  for (let i = 0; i < N; i++) {
    const info = await p.evaluate(([i, isl]) => {
      const K = __kome; K.addMoney(1e15);
      while (K.S.tool < i) { K.addMoney(1e15); if (!K.buyTool()) { K.S.tool++; } }
      if (isl && !K._isl) { K.setIsland(+isl); K._isl = 1; }
      const id = K.setTool(i); document.querySelectorAll('.k-dim.k-show .k-x, .k-dim.k-show').forEach(e => e.click && 0);
      return { id, x: K.P.x, mx: K.m && K.m.x };
    }, [i, isl ? isl.split('=')[1] : null]);
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => { const d = document.querySelector('.k-dig').getBoundingClientRect(); return { x: d.left + d.width / 2, y: d.top + d.height / 2, vis: getComputedStyle(document.querySelector('.k-dig')).visibility, pan: document.body.classList.contains('k-panelopen') }; });
    const x0 = await p.evaluate(() => ({ px: __kome.P.x, mx: __kome.m && __kome.m.x }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
    const xs = [];
    const CYC = +(process.env.CYC || 8), HOLD = +(process.env.HOLD || 4000);
    for (let c = 0; c < CYC; c++) {
      if (c) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
      await p.waitForTimeout(80);
      const a = await p.evaluate(() => { const d = __kome.dbg(); return [Math.round(__kome.P.x), d.keyAim == null ? null : Math.round(d.keyAim)]; });
      await p.waitForTimeout(HOLD);
      const e = await p.evaluate(() => Math.round(__kome.P.x));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      xs.push(a[0] + '>' + e + (a[1] != null && a[1] < a[0] ? '(aimBEHIND ' + a[1] + ')' : '') + (e < a[0] - 8 ? ' BACK' : ''));
      await p.waitForTimeout(150 + Math.random() * 900);
    }
    console.log(String(i).padStart(2), info.id.padEnd(12), 'btn', Math.round(r.x), Math.round(r.y), r.vis, r.pan ? 'PANEL' : '', 'x0', Math.round(x0.px), '->', xs.join(' '));
    await p.waitForTimeout(300);
  }
  await b.close();
})();
