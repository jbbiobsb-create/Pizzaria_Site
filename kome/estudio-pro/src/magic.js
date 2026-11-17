/* ==========================================================================
   Pixxel Estúdio — magic.js  ("Toque de mágica")
   Varinhas que fazem o trabalho de artista num clique, na camada atual
   (ou na seleção), no quadro atual ou em todos os quadros.
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, E = S.E, { clamp, R, G, B, A, pack, rgb2hsv, hsv2rgb } = S;
  const LINE = S.hex2c(E.LINE_CSS);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const shift = (c, dv, dh, ds) => { const [h, s, v] = rgb2hsv(R(c), G(c), B(c)); return pack(...hsv2rgb((h + dh + 360) % 360, clamp(s + ds, 0, 1), clamp(v + dv, 0, 1)), A(c)); };
  // sombra fria / luz quente (deslocamento de matiz, o truque clássico)
  const darker = (c, k) => { const [h] = rgb2hsv(R(c), G(c), B(c)); const toward = 250, dh = ((toward - h + 540) % 360) - 180; return shift(c, -0.22 * k, dh * 0.12 * k, 0.08 * k); };
  const lighter = (c, k) => { const [h] = rgb2hsv(R(c), G(c), B(c)); const toward = 50, dh = ((toward - h + 540) % 360) - 180; return shift(c, 0.14 * k, dh * 0.1 * k, -0.1 * k); };
  const has = (c, w, h, x, y) => x >= 0 && y >= 0 && x < w && y < h && (c[y * w + x] >>> 24) > 0;

  const MAGIC = [
    { id: 'kome', nome: '✨ Estilo Kome', desc: 'troca as cores pelas da paleta oficial do jogo e põe o contorno marrom por fora', fn(c, w, h) {
      const pal = S.PALETTES['Kome (oficial)'].map(S.hex2c), o = c.slice(); S.mapToPalette(o, pal);
      const src = o.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (src[i] >>> 24 || !S.inSel(i)) continue; if (N4.some(([dx, dy]) => has(src, w, h, x + dx, y + dy))) o[i] = LINE; }
      return o; } },
    { id: 'sombra', nome: '✨ Sombra de artista', desc: 'luz vindo de cima/esquerda: sombra em crescente embaixo/direita (fria) e brilho em cima (quente), por material', fn(c, w, h) {
      const o = c.slice(), same = (x, y, v) => x >= 0 && y >= 0 && x < w && y < h && c[y * w + x] === v;
      // espessura da sombra por cor = 20% do menor lado da mancha
      const box = new Map(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = c[y * w + x]; if (!(v >>> 24)) continue; const b = box.get(v) || { x0: x, x1: x, y0: y, y1: y }; b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); box.set(v, b); }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, v = c[i]; if (!(v >>> 24) || !S.inSel(i) || S.cdist(v, LINE) < 400) continue; const b = box.get(v), d = Math.max(1, Math.round(Math.min(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1) * 0.2)), dd = Math.ceil(d * 0.75);
        if (!same(x + dd, y + dd, v) || !same(x, y + Math.max(1, Math.round(d * 0.6)), v)) o[i] = darker(v, 1);
        else if (!same(x - 1, y - 1, v) && !same(x, y - 1, v)) o[i] = lighter(v, 1); }
      return o; } },
    { id: 'selout', nome: '✨ Contorno colorido', desc: 'o contorno escuro ganha a cor do que está dentro (técnica "sel-out" dos profissionais); se não tiver contorno, cria um', fn(c, w, h) {
      const o = c.slice(), isLine = v => (v >>> 24) && S.cdist(v, LINE) < 1800 && rgb2hsv(R(v), G(v), B(v))[2] < 0.32;
      let any = false;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, v = c[i]; if (!isLine(v) || !S.inSel(i)) continue; const nb = N4.map(([dx, dy]) => has(c, w, h, x + dx, y + dy) ? c[(y + dy) * w + x + dx] : 0).filter(q => q >>> 24 && !isLine(q)); if (!nb.length) continue; any = true; const outside = N4.some(([dx, dy]) => !has(c, w, h, x + dx, y + dy)); o[i] = darker(nb[0], outside && y > h * 0.4 ? 1.9 : 1.5); }
      if (!any) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, v = c[i]; if (!(v >>> 24) || !S.inSel(i)) continue; if (N4.some(([dx, dy]) => !has(c, w, h, x + dx, y + dy))) o[i] = darker(v, 1.6); }
      return o; } },
    { id: 'limpar', nome: '✨ Limpar traço', desc: 'tira pixel solto, cantinho em L dos traços e "dentes" de 1 pixel (deixa a linha limpa)', fn(c, w, h) {
      let o = c.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, v = c[i]; if (!(v >>> 24) || !S.inSel(i)) continue; const n = N4.filter(([dx, dy]) => has(c, w, h, x + dx, y + dy)).length; if (n === 0) o[i] = 0; }
      const src = o.slice();
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, v = src[i]; if (!(v >>> 24) || !S.inSel(i)) continue; const L2 = q => src[q] === v;
        // cotovelo em L numa linha de 1px: se tem vizinho reto em 2 direções perpendiculares e o diagonal entre eles, o do meio sobra
        const r = L2(i + 1), l = L2(i - 1), d = L2(i + w), u = L2(i - w);
        if ((r && d && !l && !u && L2(i + w + 1)) || (l && d && !r && !u && L2(i + w - 1)) || (r && u && !l && !d && L2(i - w + 1)) || (l && u && !r && !d && L2(i - w - 1))) { const count = N4.filter(([dx, dy]) => has(src, w, h, x + dx, y + dy)).length; if (count === 2) o[i] = 0; } }
      return o; } },
    { id: 'brilho', nome: '✨ Luz de borda', desc: '1 pixel de luz quente na borda de cima/esquerda de cada forma (dá volume na hora)', fn(c, w, h) { const o = c.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, v = c[i]; if (!(v >>> 24) || !S.inSel(i) || S.cdist(v, LINE) < 400) continue; if (!has(c, w, h, x, y - 1) || (S.cdist(c[(y - 1) * w + x] || 0, LINE) < 400 && !has(c, w, h, x - 1, y - 1))) o[i] = lighter(v, 1.3); } return o; } },
    { id: 'paleta', nome: '✨ Paleta harmoniosa', desc: 'junta as cores parecidas (fica no máximo 12) — pixel art bonita usa poucas cores', fn(c, w, h) {
      const cols = []; for (let i = 0; i < c.length; i++) if (c[i] >>> 24 && S.inSel(i)) cols.push(c[i]); if (!cols.length) return;
      let cent = [...new Set(cols)].slice(0, 400).sort((a, b) => rgb2hsv(R(a), G(a), B(a))[2] - rgb2hsv(R(b), G(b), B(b))[2]); const K = Math.min(12, cent.length); cent = Array.from({ length: K }, (_, k) => cent[Math.floor(k * cent.length / K)]);
      for (let it = 0; it < 6; it++) { const acc = cent.map(() => [0, 0, 0, 0]); for (const v of cols) { let bi = 0, bd = 1e12; cent.forEach((q, k) => { const d = S.cdist(v, q); if (d < bd) { bd = d; bi = k; } }); const a = acc[bi]; a[0] += R(v); a[1] += G(v); a[2] += B(v); a[3]++; } cent = cent.map((q, k) => acc[k][3] ? pack(acc[k][0] / acc[k][3] | 0, acc[k][1] / acc[k][3] | 0, acc[k][2] / acc[k][3] | 0, 255) : q); }
      const o = c.slice(); for (let i = 0; i < o.length; i++) { const v = o[i]; if (!(v >>> 24) || !S.inSel(i)) continue; let bi = 0, bd = 1e12; cent.forEach((q, k) => { const d = S.cdist(v, q); if (d < bd) { bd = d; bi = k; } }); o[i] = (cent[bi] & 0xFFFFFF | (A(v) << 24)) >>> 0; } return o; } },
    { id: 'espelho', nome: '✨ Espelhar metade', desc: 'copia a metade esquerda pra direita (rosto, prédio, item simétrico)', fn(c, w, h) { const o = c.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < (w >> 1); x++) o[y * w + w - 1 - x] = c[y * w + x]; return o; } },
    { id: 'pixelizar', nome: '✨ Pixelizar limpo', desc: 'pra imagem convertida/foto: tira o ruído deixando cada pixel com a cor que manda na vizinhança', fn(c, w, h) { const o = c.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!S.inSel(i)) continue; const cnt = new Map(); let best = c[i], bn = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!has(c, w, h, x + dx, y + dy) && !(c[i] >>> 24)) continue; const v = (x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h) ? c[(y + dy) * w + x + dx] : 0; const n = (cnt.get(v) || 0) + (dx || dy ? 1 : 1.5); cnt.set(v, n); if (n > bn) { bn = n; best = v; } } o[i] = best; } return o; } },
  ];
  S.MAGIC = MAGIC;
  S.applyMagic = function (id, o) {
    o = o || {}; const M = MAGIC.find(m => m.id === id); if (!M) return;
    S.celOp(M.nome.replace('✨ ', ''), (c, w, h) => M.fn(c, w, h), { allFrames: !!o.allFrames, allLayers: !!o.allLayers });
    try { S.E.Sfx && S.sound && S.E.Sfx.play('sparkle'); } catch (e) { }
  };
  // variações de cor: cria um desenho novo com 6 versões (uma por quadro)
  S.magicVariations = function () {
    const d = S.getDoc(), base = S.compose(d, d.cur.f, { skipRef: true }), shifts = [0, 40, 90, 160, 220, 300];
    const frames = shifts.map(dh => base.map(v => (v >>> 24) && S.cdist(v, LINE) > 400 ? shift(v, 0, dh, 0) : v));
    const nd = S.newDoc(d.w, d.h, { name: d.name + ' — variações' }); nd.frames = frames.map(() => ({ dur: 500 })); nd.layers = [S.newLayer('Variações', { cels: frames })]; nd.cur = { f: 0, l: 0 }; S.openDoc(nd); S.toast('6 variações de cor (uma por quadro)');
  };
  S.magicPanel = function (box) {
    const { h } = S; box.innerHTML = '';
    const all = h('input', { type: 'checkbox' }), lay = h('input', { type: 'checkbox' });
    box.append(h('div', { class: 'hint' }, 'Um clique e o estúdio faz o trabalho de artista na camada atual (ou só na seleção). Dá pra desfazer com Ctrl+Z.'), h('div', { class: 'row' }, h('label', null, all, ' todos os quadros'), h('label', null, lay, ' todas as camadas')));
    MAGIC.forEach(M => box.appendChild(h('button', { class: 'magicbtn', title: M.desc, onclick: () => S.applyMagic(M.id, { allFrames: all.checked, allLayers: lay.checked }) }, h('b', null, M.nome), h('span', null, M.desc))));
    box.appendChild(h('button', { class: 'magicbtn', onclick: S.magicVariations }, h('b', null, '✨ Variações de cor'), h('span', null, '6 versões com cores diferentes, num desenho novo')));
    box.appendChild(h('button', { class: 'magicbtn', onclick: () => S.focusPanel && S.focusPanel('tipo') }, h('b', null, '✨ Animar sozinho'), h('span', null, 'diga o que é (cachorro, casa, peixe…) e ele anima e põe na escala do jogo')));
  };
})();
