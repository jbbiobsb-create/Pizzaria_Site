#!/usr/bin/env node
/* Kome tools: FÁBRICA DE ARTE. Lê as fichas de conteudo/*.js que têm `receita:` e usa os geradores do Pixxel Estúdio
   (estudio-pro/Pixxel_Estudio.html, sem abrir janela) pra desenhar e animar cada uma. Salva um pacote por ficha em
   conteudo/arte/<id>.pixxel.js (spritesheet + animações) que o jogo toca com Pixxel.Anim (engine/assets.js).
   uso: node tools/arte.js [--todas] [--so id1,id2] [--galeria]
     sem --todas, só gera o que ainda não tem pacote ou cuja receita mudou. --galeria monta %TEMP%/kome-arte.png.
   Depois roda o tools/content.js sozinho.

   RECEITAS (dentro da ficha):
     receita: { gerador: 'bicho',  especie: 'gato', acessorio: 'laco', cores: { pelo: '#E8893A' }, res: 1, ... }
       especies: cachorro gato urso raposa coelho panda tanuki porco lobo capivara cervo ovelha vaca cavalo hamster
       acessorio: kasa lenco coleira laco gorro oculos (ou nenhum)   ·  animações saem prontas: parado andar correr pular
       sentar abanar dormir comer feliz
     receita: { gerador: 'casa',    modelo?: '<nome de um modelo>', estilo: 'loja', andares: 2, ... }
     receita: { gerador: 'maquina', modelo?: '...', tipo: 'trator' ... }
     receita: { gerador: 'props',   modelo?: 'Poste', tipo: 'poste' ... }
     `node tools/arte.js --opcoes` lista os modelos e ajustes de cada gerador. */
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const { launch } = require('./pw');
const a = process.argv.slice(2), has = k => a.includes(k), val = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'conteudo'), ART = path.join(DIR, 'arte');
const STUDIO = 'file://' + path.join(ROOT, 'estudio-pro', 'Pixxel_Estudio.html');

// lê as fichas sem rodar o jogo: cada ficha({...}) é avaliada isolada
function lerFichas() {
  const out = [];
  if (!fs.existsSync(DIR)) return out;
  for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    try { new Function('ficha', src)(o => out.push(Object.assign({ _arquivo: f }, o))); } catch (e) { console.log('ficha com erro: ' + f + ' — ' + e.message); }
  }
  return out;
}
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');

(async () => {
  fs.mkdirSync(ART, { recursive: true });
  const b = await launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.goto(STUDIO); await p.waitForFunction(() => window.Studio && window.Studio.Creature && window.Studio.Builders, null, { timeout: 20000 });
  if (has('--opcoes')) {
    console.log(await p.evaluate(() => {
      const S = window.Studio, o = ['bicho: especies ' + Object.keys(S.Creature.SPECIES).join(' ') + ' | acessorios ' + (Array.isArray(S.Creature.ACCS) ? S.Creature.ACCS.map(x => x.id || x) : Object.keys(S.Creature.ACCS || {})).join(' ') + ' | animações ' + Object.keys(S.Creature.POSES).join(' ')];
      for (const [id, B] of Object.entries(S.Builders)) o.push(id + ': modelos ' + Object.keys(B.presets).join(' / ') + '\n   ajustes ' + B.params.map(q => q[0] + (q[2] === 'select' ? '(' + Object.keys(q[3]).join('|') + ')' : '')).join(', '));
      return o.join('\n');
    }));
    await b.close(); return;
  }
  const fichas = lerFichas().filter(f => f.receita), so = val('--so', '').split(',').filter(Boolean);
  let feitas = 0, puladas = 0;
  for (const f of fichas) {
    const id = slug(f.id || f.nome); if (so.length && !so.includes(id)) continue;
    const hash = crypto.createHash('md5').update(JSON.stringify(f.receita)).digest('hex').slice(0, 10), file = path.join(ART, id + '.pixxel.js');
    if (!has('--todas') && fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(hash)) { puladas++; continue; }
    const pack = await p.evaluate(([R, id, nome, tipo]) => {
      const S = window.Studio, ms = 130;
      let w = 0, h = 0, frames = [], anims = {};
      if (R.gerador === 'bicho') {
        const params = Object.assign({ especie: 'cachorro', res: 1 }, R); delete params.gerador;
        const r = S.Creature.build(params); w = r.w; h = r.h; frames = r.frames; r.tags.forEach(t => { anims[t.name] = { from: t.from, to: t.to }; });
      } else {
        const B = S.Builders[R.gerador]; if (!B) throw new Error('gerador desconhecido: ' + R.gerador);
        const base = R.modelo && B.presets[R.modelo] ? B.presets[R.modelo] : Object.values(B.presets)[0];
        const params = Object.assign({ res: 1 }, base, R); delete params.gerador; delete params.modelo;
        const list = B.anims(params), raw = [];
        for (const [tag, n] of list) { const from = raw.length; for (let i = 0; i < n; i++) raw.push(B.draw(params, tag, i)); anims[tag] = { from, to: raw.length - 1 }; }
        w = Math.max(...raw.map(r => r.w)); h = Math.max(...raw.map(r => r.h));
        frames = raw.map(r => { const o = new Uint32Array(w * h), ox = (w - r.w) >> 1, oy = h - r.h; for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) o[(oy + y) * w + ox + x] = r.buf[y * r.w + x]; return o; });
      }
      // folha em linha: um quadro do lado do outro
      const c = document.createElement('canvas'); c.width = w * frames.length; c.height = h; const g = c.getContext('2d');
      frames.forEach((buf, i) => { const im = new ImageData(new Uint8ClampedArray(buf.buffer.slice(0)), w, h); g.putImageData(im, i * w, 0); });
      return { img: c.toDataURL('image/png'), w, h, frames: frames.map(() => ms), anims, tipo, nome };
    }, [f.receita, id, f.nome, f.tipo]).catch(e => ({ erro: e.message.split('\n')[0] }));
    if (pack.erro) { console.log('ERRO em ' + id + ': ' + pack.erro); continue; }
    fs.writeFileSync(file, '/* arte gerada por tools/arte.js a partir da receita de ' + f._arquivo + ' · receita ' + hash + ' — não edite: mude a receita */\n' +
      'Pixxel.Assets.add(' + JSON.stringify(id) + ', ' + JSON.stringify(pack) + ');\n');
    feitas++; console.log('arte: ' + id + ' (' + pack.w + '×' + pack.h + ', ' + pack.frames.length + ' quadros: ' + Object.keys(pack.anims).join(' ') + ')');
  }
  if (has('--galeria')) {
    const packs = fs.readdirSync(ART).filter(x => x.endsWith('.pixxel.js')).map(x => fs.readFileSync(path.join(ART, x), 'utf8'));
    await p.setContent('<body style="margin:0;background:#CFE8F5"></body>');
    const png = await p.evaluate(async srcs => {
      const items = []; window.Pixxel = { Assets: { add: (id, d) => items.push([id, d]) } }; srcs.forEach(s => new Function(s)());
      const cell = 180, cols = 6, rows = Math.max(1, Math.ceil(items.length / cols)), c = document.createElement('canvas'); c.width = cols * cell; c.height = rows * cell;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#CFE8F5'; g.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < items.length; i++) {
        const [id, d] = items[i], im = new Image(); await new Promise(r => { im.onload = r; im.src = d.img; });
        const x = (i % cols) * cell, y = Math.floor(i / cols) * cell, k = Math.max(1, Math.floor(Math.min(160 / d.w, 140 / d.h)));
        g.drawImage(im, 0, 0, d.w, d.h, x + (cell - d.w * k) / 2, y + 8 + (150 - d.h * k), d.w * k, d.h * k);
        g.fillStyle = '#2A1A10'; g.font = '12px system-ui'; g.fillText(id + ' · ' + Object.keys(d.anims).length + ' anim', x + 4, y + cell - 6);
      }
      return c.toDataURL('image/png');
    }, packs);
    const out = path.join(os.tmpdir(), 'kome-arte.png'); fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64')); console.log('galeria -> ' + out);
  }
  await b.close();
  console.log('arte: ' + feitas + ' geradas, ' + puladas + ' já estavam prontas' + (errs.length ? ' · erros no estúdio: ' + errs[0] : ''));
  cp.execFileSync(process.execPath, [path.join(__dirname, 'content.js')], { stdio: 'inherit' });
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
