/* Kome tools: abre o navegador headless usando o Chrome/Edge já instalado no PC (sem baixar Chromium).
   Ordem: playwright completo (se existir) -> playwright-core + Chrome -> playwright-core + Edge. */
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
async function launch(opts = {}) {
  const args = ['--autoplay-policy=no-user-gesture-required'].concat(opts.args || []);
  const tries = [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  let last;
  for (const t of tries) {
    try { return await pw.chromium.launch(Object.assign({ args }, t)); } catch (e) { last = e; }
  }
  throw last;
}
module.exports = { launch, chromium: { launch } };
