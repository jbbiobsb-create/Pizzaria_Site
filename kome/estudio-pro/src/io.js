/* ==========================================================================
   Pixxel Estúdio — io.js
   Exportar: PNG, spritesheet (+JSON no formato do Aseprite, que quase toda
   engine lê), GIF animado, ficha do jogo (letras), pacote Pixxel (.js pronto
   pra E.Assets). Importar: PNG/JPG, folha fatiada em grade, GIF não.
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, E = S.E;

  // quadro final (com opção estilo Kome = contorno + luz da engine)
  S.frameCanvas = function (doc, f, o) {
    o = o || {}; const buf = S.compose(doc, f, { skipRef: true });
    if (o.kome) return S.komeStyle(buf, doc.w, doc.h, o);
    return S.toCanvas(buf, doc.w, doc.h);
  };
  const scaleCv = (cv, k) => { if (k === 1) return cv; const c = document.createElement('canvas'); c.width = cv.width * k; c.height = cv.height * k; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(cv, 0, 0, c.width, c.height); return c; };
  S.scaleCv = scaleCv;
  S.exportPNG = function (doc, o) { o = o || {}; const cv = scaleCv(S.frameCanvas(doc, doc.cur.f, o), o.scale || 1); cv.toBlob(b => S.dlBlob(b, S.slug(doc.name) + '.png')); };

  /* ---------- spritesheet ---------- */
  // layout: 'linha' | 'grade' | 'tags' (uma linha por tag). JSON estilo Aseprite (hash)
  S.buildSheet = function (doc, o) {
    o = o || {}; const k = o.scale || 1, pad = o.pad || 0, n = doc.frames.length;
    const cvs = doc.frames.map((_, f) => S.frameCanvas(doc, f, o)), fw = cvs[0].width, fh = cvs[0].height;
    let pos = [];
    if (o.layout === 'tags' && doc.tags.length) { let row = 0; const used = new Set(); doc.tags.forEach(t => { for (let f = t.from; f <= t.to; f++) { pos[f] = pos[f] || [f - t.from, row]; used.add(f); } row++; }); for (let f = 0; f < n; f++) if (!used.has(f)) pos[f] = [f, row]; }
    else if (o.layout === 'grade') { const cols = Math.ceil(Math.sqrt(n)); for (let f = 0; f < n; f++) pos[f] = [f % cols, Math.floor(f / cols)]; }
    else for (let f = 0; f < n; f++) pos[f] = [f, 0];
    const cols = Math.max(...pos.map(p => p[0])) + 1, rows = Math.max(...pos.map(p => p[1])) + 1;
    const c = document.createElement('canvas'); c.width = cols * (fw * k + pad) - pad; c.height = rows * (fh * k + pad) - pad; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const frames = {}; const base = S.slug(doc.name);
    cvs.forEach((cv, f) => { const x = pos[f][0] * (fw * k + pad), y = pos[f][1] * (fh * k + pad); g.drawImage(cv, x, y, fw * k, fh * k); frames[base + ' ' + f + '.png'] = { frame: { x, y, w: fw * k, h: fh * k }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: fw * k, h: fh * k }, sourceSize: { w: fw * k, h: fh * k }, duration: doc.frames[f].dur }; });
    const json = { frames, meta: { app: 'Pixxel Estúdio', version: '3', image: base + '.png', format: 'RGBA8888', size: { w: c.width, h: c.height }, scale: String(k), frameTags: doc.tags.map(t => ({ name: t.name, from: t.from, to: t.to, direction: t.dir === 'tras' ? 'reverse' : t.dir === 'vaievem' ? 'pingpong' : 'forward', color: t.cor || '#000000' })), layers: doc.layers.map(l => ({ name: l.name, opacity: l.op, blendMode: 'normal' })), pixxel: { tipo: doc.meta.tipo, rig: doc.meta.rig, altura: doc.meta.altura, ancora: 'pés', kome: !!o.kome } } };
    return { canvas: c, json };
  };
  S.exportSheet = function (doc, o) { const { canvas, json } = S.buildSheet(doc, o); const base = S.slug(doc.name); canvas.toBlob(b => S.dlBlob(b, base + '.png')); S.dlText(JSON.stringify(json, null, 1), base + '.json'); };

  /* ---------- pacote pra engine (um .js que registra em E.Assets) ---------- */
  S.exportEnginePack = function (doc, o) {
    const { canvas, json } = S.buildSheet(doc, Object.assign({ layout: 'linha' }, o));
    const id = S.slug(doc.name), url = canvas.toDataURL('image/png');
    const anims = {}; json.meta.frameTags.forEach(t => anims[t.name] = { from: t.from, to: t.to, dir: t.direction });
    const js = '/* ' + doc.name + ' — gerado pelo Pixxel Estúdio. Carregue depois da engine (precisa de assets.js). */\n' +
      'Pixxel.Assets.add(' + JSON.stringify(id) + ', ' + JSON.stringify({ img: url, w: doc.w * (o && o.scale || 1), h: doc.h * (o && o.scale || 1), frames: doc.frames.map(f => f.dur), anims, tipo: doc.meta.tipo || 'enfeite', altura: doc.meta.altura || doc.h, ancora: 'pés' }) + ');\n';
    S.dlText(js, id + '.pixxel.js', 'text/javascript');
  };

  /* ---------- ficha do jogo (letras) ---------- */
  S.fichaText = function (doc) {
    const nome = doc.name || 'Meu desenho', tipo = doc.meta.tipo || 'enfeite', N = doc.frames.length;
    const rowsOf = f => { const b = S.compose(doc, f, { skipRef: true }), bb = S.bboxOf(b, doc.w, doc.h) || { x: 0, y: 0, w: 1, h: 1 }; const out = []; for (let y = 0; y < doc.h; y++) { let s = ''; for (let x = 0; x < doc.w; x++) { const v = b[y * doc.w + x]; s += (v >>> 24) > 100 ? S.nearestLetter(v) : '.'; } out.push(s); } return { out, bb }; };
    const all = Array.from({ length: N }, (_, f) => rowsOf(f));
    // corta tudo pela caixa que cobre todos os quadros
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; all.forEach(a => { x0 = Math.min(x0, a.bb.x); y0 = Math.min(y0, a.bb.y); x1 = Math.max(x1, a.bb.x + a.bb.w - 1); y1 = Math.max(y1, a.bb.y + a.bb.h - 1); });
    const fr = all.map(a => a.out.slice(y0, y1 + 1).map(r => r.slice(x0, x1 + 1)));
    const onde = tipo === 'roupa' ? '{ x: 0, y: -10 }' : tipo === 'bicho' ? '{ x: 0.6, y: 30 }' : '{ x: 0.5, y: 10 }';
    const anims = doc.tags.length ? '\n  animacoes: { ' + doc.tags.map(t => t.name + ': [' + t.from + ', ' + t.to + ']').join(', ') + ' },' : '';
    const quadros = N > 1 ? '\n  quadros: [\n' + fr.map(f => '    `\n' + f.map(r => '      ' + r).join('\n') + '\n    `').join(',\n') + '\n  ],' : '';
    return "ficha({\n  tipo: '" + tipo + "', id: '" + S.slug(nome) + "', nome: '" + nome.replace(/'/g, "\\'") + "', desc: 'feito no Pixxel Estúdio',\n  " + (tipo === 'roupa' ? '' : 'preco: 60, ') + 'onde: ' + onde + ', escala: 1,' + (doc.meta.altura ? ' altura: ' + doc.meta.altura + ',' : '') + '\n  desenho: `\n' + fr[0].map(r => '    ' + r).join('\n') + '\n  `,' + anims + quadros + '\n});\n';
  };

  /* ---------- GIF animado (codificador próprio, LZW) ---------- */
  S.encodeGIF = function (frames, w, h, delays, o) {
    o = o || {}; const k = o.scale || 1, W = w * k, H = h * k;
    // paleta global: cores mais frequentes (até 255) + transparente no índice 0
    const cnt = new Map(); for (const f of frames) for (let i = 0; i < f.length; i++) { const v = f[i]; if ((v >>> 24) > 127) { const c = v & 0xFFFFFF; cnt.set(c, (cnt.get(c) || 0) + 1); } }
    const cols = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255).map(e => e[0]);
    const pal = [0].concat(cols), idx = new Map(cols.map((c, i) => [c, i + 1]));
    const near = c => { let bi = 1, bd = 1e12; for (let i = 0; i < cols.length; i++) { const d = S.cdist(c | 0xFF000000, cols[i] | 0xFF000000); if (d < bd) { bd = d; bi = i + 1; } } idx.set(c, bi); return bi; };
    let bits = 1; while ((1 << bits) < pal.length) bits++; bits = Math.max(2, bits); const psize = 1 << bits;
    const out = []; const w8 = b => out.push(b & 255), w16 = v => { w8(v); w8(v >> 8); }, str = s => { for (const ch of s) w8(ch.charCodeAt(0)); };
    str('GIF89a'); w16(W); w16(H); w8(0xF0 | (bits - 1)); w8(0); w8(0);
    for (let i = 0; i < psize; i++) { const c = pal[i] || 0; w8(c & 255); w8((c >> 8) & 255); w8((c >> 16) & 255); }
    str('!\xFF\x0BNETSCAPE2.0'); w8(3); w8(1); w16(0); w8(0);
    frames.forEach((f, fi) => {
      w8(0x21); w8(0xF9); w8(4); w8(0x09); w16(Math.max(2, Math.round((delays[fi] || 100) / 10))); w8(0); w8(0);
      w8(0x2C); w16(0); w16(0); w16(W); w16(H); w8(0);
      const px = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = f[Math.floor(y / k) * w + Math.floor(x / k)]; if ((v >>> 24) <= 127) continue; const c = v & 0xFFFFFF; px[y * W + x] = idx.has(c) ? idx.get(c) : near(c); }
      lzw(px, bits, w8);
    });
    w8(0x3B); return new Uint8Array(out);
  };
  function lzw(px, minBits, w8) {
    w8(minBits); const clear = 1 << minBits, eoi = clear + 1; let size = minBits + 1, next = eoi + 1, dict = new Map(), cur = 0, nb = 0; const block = [];
    const emit = code => { cur |= code << nb; nb += size; while (nb >= 8) { block.push(cur & 255); cur >>>= 8; nb -= 8; if (block.length === 255) { w8(255); block.forEach(w8); block.length = 0; } } };
    emit(clear); let prefix = px[0];
    for (let i = 1; i < px.length; i++) { const c = px[i], key = prefix * 4096 + c; const v = dict.get(key); if (v !== undefined) { prefix = v; continue; } emit(prefix); if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; } else { emit(clear); dict = new Map(); size = minBits + 1; next = eoi + 1; } prefix = c; }
    emit(prefix); emit(eoi); if (nb > 0) block.push(cur & 255); if (block.length) { w8(block.length); block.forEach(w8); } w8(0);
  }
  S.exportGIF = function (doc, o) {
    o = o || {}; let fs = doc.frames.map((_, f) => f); if (o.tag) { const t = doc.tags.find(t => t.name === o.tag); if (t) { fs = []; for (let f = t.from; f <= t.to; f++) fs.push(f); } }
    let w = doc.w, h = doc.h; const bufs = fs.map(f => { if (o.kome) { const cv = S.komeStyle(S.compose(doc, f, { skipRef: true }), doc.w, doc.h); w = cv.width; h = cv.height; return S.fromCanvas(cv); } return S.compose(doc, f, { skipRef: true }); });
    const bytes = S.encodeGIF(bufs, w, h, fs.map(f => doc.frames[f].dur), o);
    S.dlBlob(new Blob([bytes], { type: 'image/gif' }), S.slug(doc.name) + (o.tag ? '-' + S.slug(o.tag) : '') + '.gif');
  };

  /* ---------- importar ---------- */
  S.loadImage = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  S.imageBuf = function (im, x, y, w, h) { const c = document.createElement('canvas'); c.width = w || im.width; c.height = h || im.height; const g = c.getContext('2d'); g.drawImage(im, -(x || 0), -(y || 0)); return S.fromCanvas(c); };
  // detecta se a imagem é pixel art ampliada (2x, 3x…) e devolve o fator
  S.detectScale = function (buf, w, h) { for (const f of [8, 6, 5, 4, 3, 2]) { if (w % f || h % f) continue; let bad = 0, tot = 0; for (let y = 0; y < h; y += f) for (let x = 0; x < w; x += f) { const v = buf[y * w + x]; tot++; if (buf[(y + f - 1) * w + x + f - 1] !== v || buf[y * w + x + f - 1] !== v) bad++; } if (bad / tot < 0.04) return f; } return 1; };
  // fatia folha em grade -> lista de buffers (tira quadros vazios do fim)
  S.sliceSheet = function (buf, w, h, fw, fh, o) {
    o = o || {}; const out = []; const cols = Math.floor(w / fw), rows = Math.floor(h / fh);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const b = new Uint32Array(fw * fh); let any = false; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const v = buf[(r * fh + y) * w + c * fw + x]; b[y * fw + x] = v; if (v >>> 24) any = true; } if (any || !o.skipEmpty) out.push(b); }
    return out;
  };
  // reduz paleta (opcional) pra encaixar na paleta do documento
  S.mapToPalette = function (buf, pal) { const cache = new Map(); for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (!(v >>> 24)) continue; let c = cache.get(v); if (c == null) { let bi = 0, bd = 1e12; for (let k = 0; k < pal.length; k++) { const d = S.cdist(v, pal[k]); if (d < bd) { bd = d; bi = k; } } c = (pal[bi] & 0xFFFFFF | ((v >>> 24) > 127 ? 0xFF000000 : 0)) >>> 0; cache.set(v, c); } buf[i] = c; } return buf; };
  // paleta: .hex / .gpl / imagem
  S.parsePalette = function (txt) { const out = []; for (const line of txt.split(/\r?\n/)) { const m = line.match(/#?([0-9a-fA-F]{6})\b/); if (m) { out.push(S.hex2c(m[1])); continue; } const g = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)/); if (g) out.push(S.pack(+g[1], +g[2], +g[3], 255)); } return out; };
  S.paletteText = (pal, fmt) => fmt === 'gpl' ? 'GIMP Palette\nName: Pixxel\nColumns: 8\n#\n' + pal.map(c => [S.R(c), S.G(c), S.B(c)].map(v => String(v).padStart(3)).join(' ') + '\t' + S.c2hex(c)).join('\n') + '\n' : pal.map(c => S.c2hex(c).slice(1, 7)).join('\n') + '\n';
})();
