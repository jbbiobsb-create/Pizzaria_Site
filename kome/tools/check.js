#!/usr/bin/env node
/* Kome tools: verificação rápida com saída CURTA (feita pra gastar pouco token).
   uso: node tools/check.js [--fast] [--shots] [--only desktop,celular]
     abre o jogo em 3 telas (desktop 960x540, celular deitado 844x390, celular em pé 390x844), roda alguns segundos e confere:
       - erros de página/console
       - botões/controles que se sobrepõem (HUD, joystick, CAVAR, tela cheia)
       - botões saindo da tela ou menores que 32px no celular
       - texto visível menor que 11px (na tela real, já com zoom do HUD)
     depois roda playtest --rungs --auto e mostra só o resumo (pula com --fast).
     --shots salva um PNG por tela em <tmp>/kome-check/ (só pra olhar quando algo acusar problema).
   Sai com código 1 se algo falhar. */
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { launch } = require('./pw');
const a = process.argv.slice(2), has = k => a.includes(k), val = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?fresh&nointro&nofont';
const OUT = path.join(os.tmpdir(), 'kome-check');
const SCREENS = [
  { id: 'desktop', w: 960, h: 540 },
  { id: 'celular', w: 844, h: 390, mob: true },
  { id: 'celular-em-pe', w: 390, h: 844, mob: true },
  { id: 'pequeno', w: 640, h: 360, mob: true },
  { id: 'pequeno-em-pe', w: 360, h: 640, mob: true },
  { id: 'tablet', w: 1024, h: 768, mob: true },
  { id: 'celular-alargou', w: 700, h: 380, mob: true, after: [800, 368], dpr: 2 },   // barra do navegador some depois de abrir
];
const only = val('--only', '').split(',').filter(Boolean);
let fails = 0;
const say = (ok, s) => { if (!ok) fails++; console.log((ok ? 'ok    ' : 'FALHA ') + s); };

// roda dentro da página: devolve problemas de layout
const LAYOUT = `((MOB) => {
  const vw = innerWidth, vh = innerHeight, out = { overlap: [], off: [], small: [], tiny: [] };
  const vis = el => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !el.closest('[hidden]'); };
  const name = el => (el.getAttribute('aria-label') || el.title || el.className.toString().split(' ').find(c => c.startsWith('k-')) || el.tagName).slice(0, 28);
  // controles + blocos soltos do HUD (barras, plaquinhas), sem contar o que está dentro de outro da lista
  const SEL = 'button, .k-btn, .k-joy, .k-dig, .k-fullscr, [role=button], [class*="k-zone-"] > *, .k-tipcontrols';
  const ctl = [...document.querySelectorAll(SEL)].filter(vis).filter(el => !el.classList.contains('k-spacer'))
    .filter(el => !el.parentElement.closest('button, .k-btn, .k-joy, .k-dig, .k-tipcontrols'));
  const R = ctl.map(el => [el, el.getBoundingClientRect()]);
  for (let i = 0; i < R.length; i++) {
    const [e, r] = R[i];
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.off.push(name(e));
    if (MOB && e.matches('button, .k-btn, .k-joy, .k-dig, .k-fullscr, [role=button]') && Math.min(r.width, r.height) < 32) out.small.push(name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    for (let j = i + 1; j < R.length; j++) {
      const [f, q] = R[j];
      if (e.contains(f) || f.contains(e)) continue;
      const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left), iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (ix > 4 && iy > 4) out.overlap.push(name(e) + ' × ' + name(f));
    }
  }
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    let z = 1; for (let p = el; p; p = p.parentElement) { const zz = parseFloat(getComputedStyle(p).zoom); if (zz) z *= zz; }
    const px = parseFloat(getComputedStyle(el).fontSize) * (z === 1 ? 1 : z);
    if (px < 11) { const t = el.textContent.trim().slice(0, 18); if (!seen.has(t)) { seen.add(t); out.tiny.push('"' + t + '" ' + px.toFixed(1) + 'px'); } }
  }
  return out;
})`;

async function screen(browser, sc) {
  const ctx = await browser.newContext({ viewport: { width: sc.w, height: sc.h }, isMobile: !!sc.mob, hasTouch: !!sc.mob, deviceScaleFactor: sc.dpr || 1 });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  if (sc.after) { await page.setViewportSize({ width: sc.after[0], height: sc.after[1] }); await page.waitForTimeout(500); }
  await page.evaluate(`(() => { const K = __kome; K.addMoney(1e4); K.buyTool(); K.S.cele.t = -1; for (let i = 0; i < 6; i++) { const p = K.aim(); K.hold(p.x, p.y, true); K.step(1); } K.hold(0,0,false); K.S.combo = KomeGame.Data.COMBO.max; K.step(0.3); })()`).catch(e => errs.push('eval: ' + e.message.split('\n')[0]));
  await page.waitForTimeout(500);
  await page.evaluate(`document.querySelectorAll('.k-toast, .k-banner, .k-ach').forEach(e => e.remove())`);
  const L = await page.evaluate(LAYOUT + '(' + !!sc.mob + ')');
  const mobOn = await page.evaluate(`document.documentElement.classList.contains('k-mob') || document.body.classList.contains('k-mob')`);
  if (has('--shots')) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, sc.id + '.png') }); }
  const tag = sc.id.padEnd(14);
  say(!errs.length, tag + 'erros de página: ' + (errs.length ? errs.slice(0, 3).join(' | ') : '0'));
  if (sc.mob) say(mobOn, tag + 'modo celular ativo (k-mob)');
  say(!L.overlap.length, tag + 'sobreposição: ' + (L.overlap.length ? L.overlap.slice(0, 6).join('; ') : 'nenhuma'));
  say(!L.off.length, tag + 'fora da tela: ' + (L.off.length ? L.off.slice(0, 6).join('; ') : 'nada'));
  if (sc.mob) say(!L.small.length, tag + 'botões < 32px: ' + (L.small.length ? L.small.slice(0, 6).join('; ') : 'nenhum'));
  say(!L.tiny.length, tag + 'texto < 11px: ' + (L.tiny.length ? L.tiny.length + ' (' + L.tiny.slice(0, 5).join('; ') + ')' : 'nenhum'));
  await ctx.close();
}

(async () => {
  const t0 = Date.now();
  const browser = await launch();
  for (const sc of SCREENS) if (!only.length || only.includes(sc.id)) {
    try { await screen(browser, sc); } catch (e) { say(false, sc.id + ': ' + e.message.split('\n')[0]); }
  }
  await browser.close();
  if (!has('--fast')) {
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'playtest.js'), '--rungs', '--auto'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const lines = (r.stdout + r.stderr).split('\n');
    const keep = lines.filter(l => /^(FALHA|PAGEERROR|CONSOLE\.error|RESULTADO|  ok |  FORA|FALHOU|tudo certo|\d+ falha)/.test(l));
    const okRungs = lines.filter(l => /^ok +[0-9]+ /.test(l)).length;
    console.log('playtest      degraus ok: ' + okRungs + '/14');
    keep.forEach(l => console.log('              ' + l.trim()));
    if (r.status !== 0 || keep.some(l => /^  FORA/.test(l))) fails++;
  }
  console.log((fails ? fails + ' falha(s)' : 'TUDO OK') + ' · ' + Math.round((Date.now() - t0) / 1000) + ' s' + (has('--shots') ? ' · prints em ' + OUT : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
