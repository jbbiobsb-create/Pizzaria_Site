#!/usr/bin/env node
/* Kome tools: abre uma página local no Chromium headless, roda JS opcional e tira screenshot.
   uso: node kome/tools/shot.js <arquivo.html|url> <saida.png> [--wait ms] [--size 960x540] [--scale 1]
        [--eval "js"]... [--click x,y]... [--hold x,y,ms] [--query "?a=1"] [--full] [--mob]
   --eval roda depois do wait inicial; se retornar valor, é impresso como JSON (EVAL: ...).
   As ações rodam na ordem em que aparecem. Erros de console/página são impressos (PAGEERROR/CONSOLE).
   Sai com código 1 se houve erro de página. */
const path = require('path');
const { chromium } = require('./pw');
(async () => {
  const a = process.argv.slice(2);
  if (a.length < 2) { console.error('uso: shot.js <html> <png> [opções]'); process.exit(2); }
  const [target, out] = a; const acts = []; let wait = 600, size = [960, 540], scale = 1, query = '', full = false, mob = false;
  for (let i = 2; i < a.length; i++) {
    const k = a[i], v = a[i + 1];
    if (k === '--wait') { acts.push(['wait', +v]); if (!acts.some(x => x[0] !== 'wait')) wait = +v; i++; }
    else if (k === '--size') { size = v.split('x').map(Number); i++; }
    else if (k === '--scale') { scale = +v; i++; }
    else if (k === '--eval') { acts.push(['eval', v]); i++; }
    else if (k === '--click') { acts.push(['click', v.split(',').map(Number)]); i++; }
    else if (k === '--hold') { acts.push(['hold', v.split(',').map(Number)]); i++; }
    else if (k === '--shot') { acts.push(['shot', v]); i++; }
    else if (k === '--query') { query = v; i++; }
    else if (k === '--full') full = true;
    else if (k === '--mob') mob = true;   // emula celular (toque + pointer: coarse): liga o modo k-mob do jogo
  }
  const url = /^https?:|^file:/.test(target) ? target : 'file://' + path.resolve(target) + query;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: scale, isMobile: mob, hasTouch: mob });
  let errs = 0;
  page.on('pageerror', e => { errs++; console.log('PAGEERROR:', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE.' + m.type() + ':', m.text()); else if (m.text().startsWith('[kome]')) console.log(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(wait);
  let first = true;
  for (const [k, v] of acts) {
    if (k === 'wait') { if (first) { first = false; continue; } await page.waitForTimeout(v); }
    else if (k === 'eval') { try { const r = await page.evaluate(v); if (r !== undefined) console.log('EVAL:', JSON.stringify(r)); } catch (e) { errs++; console.log('EVALERROR:', e.message.split('\n')[0]); } }
    else if (k === 'click') await page.mouse.click(v[0], v[1]);
    else if (k === 'hold') { await page.mouse.move(v[0], v[1]); await page.mouse.down(); await page.waitForTimeout(v[2] || 500); await page.mouse.up(); }
    else if (k === 'shot') await page.screenshot({ path: v, fullPage: full });
    first = false;
  }
  await page.screenshot({ path: out, fullPage: full });
  await browser.close();
  console.log('OK ->', out, errs ? `(${errs} erro(s))` : '');
  process.exit(errs ? 1 : 0);
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
