/* ==========================================================================
   Pixxel Estúdio — base.js
   Cores (uint32 0xAABBGGRR, igual ao E.Pix), paletas com rampas, documento
   (camadas × quadros, tags de animação, durações), histórico por célula,
   armazenamento grande (IndexedDB) e utilidades.
   ========================================================================== */
(function () {
  'use strict';
  const E = window.Pixxel;
  const S = (window.Studio = window.Studio || {});
  S.E = E;

  /* ---------------- utilidades ---------------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    return el;
  }
  Object.assign(S, { clamp, $, $$, h });

  /* ---------------- cores ---------------- */
  const pack = (r, g, b, a) => (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
  const R = c => c & 255, G = c => (c >>> 8) & 255, B = c => (c >>> 16) & 255, A = c => c >>> 24;
  const hex2c = s => { s = String(s).replace('#', ''); if (s.length === 3) s = s.split('').map(x => x + x).join(''); const n = parseInt(s.slice(0, 6), 16); const a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255; return pack(n >> 16 & 255, n >> 8 & 255, n & 255, a); };
  const c2hex = c => '#' + [R(c), G(c), B(c)].map(v => v.toString(16).padStart(2, '0')).join('') + (A(c) < 255 ? A(c).toString(16).padStart(2, '0') : '');
  const css = c => A(c) === 255 ? c2hex(c) : 'rgba(' + R(c) + ',' + G(c) + ',' + B(c) + ',' + (A(c) / 255).toFixed(3) + ')';
  function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let hh = 0; if (d) { if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; } return [hh, mx ? d / mx : 0, mx]; }
  function hsv2rgb(hh, s, v) { const c = v * s, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = v - c; let r = 0, g = 0, b = 0; if (hh < 60) [r, g, b] = [c, x, 0]; else if (hh < 120) [r, g, b] = [x, c, 0]; else if (hh < 180) [r, g, b] = [0, c, x]; else if (hh < 240) [r, g, b] = [0, x, c]; else if (hh < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]; }
  const cdist = (a, b) => { const r = (R(a) + R(b)) / 2, dr = R(a) - R(b), dg = G(a) - G(b), db = B(a) - B(b); return (2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db; };
  // mistura a sobre b (alfa)
  function over(top, bot, op) {
    const ta = A(top) * (op == null ? 1 : op) / 255; if (ta <= 0) return bot; if (ta >= 1 && op !== 0) return (top | 0xFF000000) >>> 0;
    const ba = A(bot) / 255, oa = ta + ba * (1 - ta); if (oa <= 0) return 0;
    const f = (t, b2) => Math.round((t * ta + b2 * ba * (1 - ta)) / oa);
    return pack(f(R(top), R(bot)), f(G(top), G(bot)), f(B(top), B(bot)), Math.round(oa * 255));
  }
  // rampa com deslocamento de matiz (sombra puxa pro frio/roxo, luz pro quente) — base da pixel art bem sombreada
  function ramp(c, n, hueShift, satBoost) {
    n = n || 5; hueShift = hueShift == null ? 20 : hueShift; satBoost = satBoost == null ? 0.15 : satBoost;
    const [hh, s, v] = rgb2hsv(R(c), G(c), B(c)), out = [], mid = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const t = (i - mid) / Math.max(1, mid); // -1 escuro .. 1 claro
      // escuro: matiz vai pro azul/roxo (240-280), claro: pro amarelo (60)
      const toward = t < 0 ? 255 : 55, dh = ((toward - hh + 540) % 360) - 180, nh = (hh + dh * Math.min(1, Math.abs(t)) * hueShift / 90 + 360) % 360;
      const ns = clamp(s + (t < 0 ? satBoost * -t : -satBoost * 1.6 * t), 0, 1), nv = clamp(v + t * (t < 0 ? 0.42 : 0.3) * (t < 0 ? 1 : (1 - v * 0.4)), 0.04, 1);
      out.push(pack(...hsv2rgb(nh, ns, nv), 255));
    }
    return out;
  }
  Object.assign(S, { pack, R, G, B, A, hex2c, c2hex, css, rgb2hsv, hsv2rgb, cdist, over, ramp });

  /* ---------------- paletas ---------------- */
  const P = E.PAL;
  // Paleta Kome organizada em rampas (claro -> escuro), pra o pincel de sombra andar certinho
  const KOME_RAMPS = [
    [P.white, P.cream, P.rice, P.riceS, P.riceD], [P.goldL, P.gold, P.goldD], [P.yelL, P.yel, P.yelD], [P.oraL, P.ora, P.oraD], [P.redL, P.red, P.redD, P.pink],
    [P.sakura, P.sakuraD], [P.mochi, P.mochiD], [P.fur, P.furS], [P.woodL, P.wood, P.woodD], [P.sack, P.sackD], [P.press, P.pressD], [P.rust, P.rustD],
    [P.grassL, P.grass, P.grassD], [P.leaf, P.leafD], [P.waterL, P.water, P.waterD], [P.glass, P.glassD], [P.bowlL, P.bowl], [P.sky, P.skyL],
    ['#B49BD6', '#8E6FB3', '#5E4A80'], [P.steelL, P.steel, P.steelD], [P.grayL, P.gray, P.grayD], [P.stoneL, P.stone, P.stoneD], [P.sand], [P.blkL, P.blk, P.ink, P.line], [P.night, P.sun],
  ];
  const PALETTES = {
    'Kome (oficial)': KOME_RAMPS.flat(),
    'Pico-8': ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'],
    'Game Boy': ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F'],
    'Sweetie 16': ['#1A1C2C', '#5D275D', '#B13E53', '#EF7D57', '#FFCD75', '#A7F070', '#38B764', '#257179', '#29366F', '#3B5DC9', '#41A6F6', '#73EFF7', '#F4F4F4', '#94B0C2', '#566C86', '#333C57'],
    'Endesga 32': ['#BE4A2F', '#D77643', '#EAD4AA', '#E4A672', '#B86F50', '#733E39', '#3E2731', '#A22633', '#E43B44', '#F77622', '#FEAE34', '#FEE761', '#63C74D', '#3E8948', '#265C42', '#193C3E', '#124E89', '#0099DB', '#2CE8F5', '#FFFFFF', '#C0CBDC', '#8B9BB4', '#5A6988', '#3A4466', '#262B44', '#181425', '#FF0044', '#68386C', '#B55088', '#F6757A', '#E8B796', '#C28569'],
    'Cinzas': ['#000000', '#222222', '#444444', '#666666', '#888888', '#AAAAAA', '#CCCCCC', '#EEEEEE', '#FFFFFF'],
  };
  Object.assign(S, { PALETTES, KOME_RAMPS });
  // letras da ficha do jogo (E.TEXT_PAL)
  const TP = E.TEXT_PAL, LETTERS = Object.keys(TP), LETTER_C = LETTERS.map(l => hex2c(TP[l]));
  function nearestLetter(c) { let bi = 0, bd = 1e12; for (let i = 0; i < LETTER_C.length; i++) { const d = cdist(c, LETTER_C[i]); if (d < bd) { bd = d; bi = i; } } return LETTERS[bi]; }
  const letterColor = l => TP[l] ? hex2c(TP[l]) : 0;
  Object.assign(S, { LETTERS, LETTER_C, nearestLetter, letterColor });

  /* ---------------- documento ---------------- */
  let uid = 1;
  const newId = () => 'x' + (Date.now().toString(36)) + (uid++).toString(36);
  function newLayer(name, o) { return Object.assign({ id: newId(), name: name || 'Camada', vis: true, lock: false, op: 255, cels: [], kind: 'normal' }, o || {}); }
  function newDoc(w, hgt, o) {
    o = o || {};
    const d = { id: newId(), name: o.name || 'Sem título', w, h: hgt, frames: [{ dur: 100 }], layers: [newLayer('Fundo'), newLayer('Desenho')], tags: [], cur: { f: 0, l: 1 }, sel: null, pal: (o.pal || PALETTES['Kome (oficial)']).map(hex2c), tile: { w: 16, h: 16 }, meta: { tipo: 'enfeite' }, dirty: false, saved: 0 };
    d.layers.forEach(l => l.cels = [null]);
    return d;
  }
  const celOf = (d, li, f) => d.layers[li].cels[f] || null;
  function celW(d, li, f) { const L = d.layers[li]; if (!L.cels[f]) L.cels[f] = new Uint32Array(d.w * d.h); return L.cels[f]; }
  // composição de um quadro (camadas visíveis); opts.skipRef pula camadas de referência; opts.only = índice
  function compose(d, f, opts) {
    opts = opts || {}; const out = new Uint32Array(d.w * d.h);
    for (let li = 0; li < d.layers.length; li++) {
      const L = d.layers[li]; if (!L.vis && !opts.all) continue; if (opts.skipRef && L.kind === 'ref') continue; if (opts.only != null && opts.only !== li) continue;
      const c = L.cels[f]; if (!c) continue; const op = L.op / 255, bm = L.blend || 'normal';
      if (bm !== 'normal') { for (let i = 0; i < out.length; i++) { const v = c[i]; if (v >>> 24) out[i] = blendPx(v, out[i], bm, op); } continue; }
      for (let i = 0; i < out.length; i++) { const v = c[i]; if (v >>> 24) out[i] = (op >= 1 && (v >>> 24) === 255) ? v : over(v, out[i], op); }
    }
    return out;
  }
  // modos de mesclagem (iguais aos do Photoshop): multiplicar, tela, sobrepor, adicionar, escurecer, clarear, diferença
  const BLENDS = { normal: 'Normal', multiplicar: 'Multiplicar', tela: 'Tela', sobrepor: 'Sobrepor', adicionar: 'Adicionar (luz)', escurecer: 'Escurecer', clarear: 'Clarear', diferenca: 'Diferença', cor: 'Cor' };
  function blendPx(top, bot, mode, op) {
    if (!(bot >>> 24)) return over(top, bot, op);
    const f = (a, b) => { a /= 255; b /= 255; let r; switch (mode) { case 'multiplicar': r = a * b; break; case 'tela': r = 1 - (1 - a) * (1 - b); break; case 'sobrepor': r = b < .5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b); break; case 'adicionar': r = Math.min(1, a + b); break; case 'escurecer': r = Math.min(a, b); break; case 'clarear': r = Math.max(a, b); break; case 'diferenca': r = Math.abs(a - b); break; default: r = a; } return Math.round(r * 255); };
    let mixed;
    if (mode === 'cor') { const [h1, s1] = rgb2hsv(R(top), G(top), B(top)), v2 = rgb2hsv(R(bot), G(bot), B(bot))[2]; mixed = pack(...hsv2rgb(h1, s1, v2), A(top)); }
    else mixed = pack(f(R(top), R(bot)), f(G(top), G(bot)), f(B(top), B(bot)), A(top));
    return over(mixed, bot, op);
  }
  S.BLENDS = BLENDS; S.blendPx = blendPx;
  function bboxOf(buf, w, hgt) { let x0 = w, x1 = -1, y0 = hgt, y1 = -1; for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) if (buf[y * w + x] >>> 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; }
  function toCanvas(buf, w, hgt, k) { k = k || 1; const c = document.createElement('canvas'); c.width = w; c.height = hgt; const g = c.getContext('2d'), im = g.createImageData(w, hgt); new Uint32Array(im.data.buffer).set(buf); g.putImageData(im, 0, 0); if (k === 1) return c; const c2 = document.createElement('canvas'); c2.width = w * k; c2.height = hgt * k; const g2 = c2.getContext('2d'); g2.imageSmoothingEnabled = false; g2.drawImage(c, 0, 0, w * k, hgt * k); return c2; }
  function fromCanvas(cv) { const g = cv.getContext('2d'); return new Uint32Array(g.getImageData(0, 0, cv.width, cv.height).data.buffer.slice(0)); }
  // estilo Kome: contorno 4-vizinhos marrom + luz/sombra de borda (o mesmo da engine)
  function komeStyle(buf, w, hgt, o) {
    o = o || {}; const P2 = E.Pix(w + 2, hgt + 2), b = P2.buf;
    for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) { const v = buf[y * w + x]; if ((v >>> 24) > 100) b[(y + 1) * (w + 2) + x + 1] = (v | 0xFF000000) >>> 0; }
    if (o.bevel !== false) P2.bevel(0.25, 0.2);
    return P2.canvas(o.outline !== false);
  }
  Object.assign(S, { newId, newLayer, newDoc, celOf, celW, compose, bboxOf, toCanvas, fromCanvas, komeStyle });

  /* ---------------- serialização ---------------- */
  // célula -> string compacta: paleta local + índices em RLE base36
  function encCel(c) {
    if (!c) return null; const map = new Map(), pal = []; let s = '', i = 0, any = false;
    const idx = v => { if (!(v >>> 24)) return 0; let k = map.get(v); if (k == null) { k = pal.length + 1; map.set(v, k); pal.push(c2hex(v)); } return k; };
    while (i < c.length) { const v = idx(c[i]); let j = i + 1; while (j < c.length && idx(c[j]) === v) j++; if (v) any = true; s += (j - i).toString(36) + ':' + v.toString(36) + ','; i = j; }
    return any ? { p: pal, d: s } : null;
  }
  function decCel(o, n) { if (!o) return null; const pal = o.p.map(hex2c), c = new Uint32Array(n); let i = 0; for (const part of o.d.split(',')) { if (!part) continue; const [a, b] = part.split(':'); const k = parseInt(a, 36), v = parseInt(b, 36); const col = v ? pal[v - 1] : 0; for (let q = 0; q < k && i < n; q++) c[i++] = col; } return c; }
  function serialize(d) { return { app: 'pixxel-estudio', v: 3, id: d.id, name: d.name, w: d.w, h: d.h, frames: d.frames, tags: d.tags, pal: d.pal.map(c2hex), tile: d.tile, meta: d.meta, map: d.map || null, layers: d.layers.map(l => ({ id: l.id, name: l.name, vis: l.vis, lock: l.lock, lockA: !!l.lockA, blend: l.blend || 'normal', op: l.op, kind: l.kind, cels: l.cels.map(encCel) })) }; }
  function deserialize(o) {
    const d = newDoc(o.w, o.h, { name: o.name }); d.id = o.id || newId(); d.frames = o.frames || [{ dur: 100 }]; d.tags = o.tags || []; d.pal = (o.pal || []).map(hex2c); if (!d.pal.length) d.pal = PALETTES['Kome (oficial)'].map(hex2c);
    d.tile = o.tile || { w: 16, h: 16 }; d.meta = o.meta || {}; d.map = o.map || null;
    d.layers = o.layers.map(l => newLayer(l.name, { id: l.id || newId(), vis: l.vis !== false, lock: !!l.lock, op: l.op == null ? 255 : l.op, kind: l.kind || 'normal', lockA: !!l.lockA, blend: l.blend || 'normal', cels: l.cels.map(c => decCel(c, o.w * o.h)) }));
    d.layers.forEach(l => { while (l.cels.length < d.frames.length) l.cels.push(null); });
    d.cur = { f: 0, l: Math.max(0, d.layers.length - 1) }; return d;
  }
  Object.assign(S, { serialize, deserialize, encCel, decCel });

  /* ---------------- histórico ----------------
     Cada passo guarda só as células que mudaram (antes/depois), ou o documento
     inteiro quando a estrutura muda (camadas, quadros, tamanho). */
  function History(doc) {
    const H = { list: [], i: -1, pend: null, doc };
    H.snapAll = () => ({ s: serialize(doc), cur: Object.assign({}, doc.cur) });
    H.begin = function (label, kind) {
      if (H.pend) H.end();
      H.pend = { label, kind: kind || 'cels', before: kind === 'all' ? H.snapAll() : new Map(), t: Date.now() };
    };
    // touch(li,f): antes de mexer numa célula
    H.touch = function (li, f) { const p = H.pend; if (!p || p.kind === 'all') return; const L = doc.layers[li], key = L.id + '|' + f; if (!p.before.has(key)) p.before.set(key, { id: L.id, f, c: L.cels[f] ? L.cels[f].slice() : null }); };
    H.end = function () {
      const p = H.pend; if (!p) return; H.pend = null; let step;
      if (p.kind === 'all') step = { label: p.label, kind: 'all', before: p.before, after: H.snapAll() };
      else {
        const ch = []; for (const b of p.before.values()) { const L = doc.layers.find(l => l.id === b.id); if (!L) continue; const a = L.cels[b.f]; const same = (!a && !b.c) || (a && b.c && a.length === b.c.length && a.every((v, i) => v === b.c[i])); if (!same) ch.push({ id: b.id, f: b.f, before: b.c, after: a ? a.slice() : null }); }
        if (!ch.length) return; step = { label: p.label, kind: 'cels', ch };
      }
      H.list.length = H.i + 1; H.list.push(step); if (H.list.length > 300) H.list.shift(); H.i = H.list.length - 1; doc.dirty = true; S.emit('history', doc);
    };
    H.cancel = () => { H.pend = null; };
    function apply(step, dir) {
      if (step.kind === 'all') { const st = dir < 0 ? step.before : step.after, nd = deserialize(st.s); Object.assign(doc, { w: nd.w, h: nd.h, frames: nd.frames, layers: nd.layers, tags: nd.tags, pal: nd.pal, tile: nd.tile, meta: nd.meta, map: nd.map, name: nd.name }); doc.cur = Object.assign({}, st.cur); doc.cur.f = clamp(doc.cur.f, 0, doc.frames.length - 1); doc.cur.l = clamp(doc.cur.l, 0, doc.layers.length - 1); }
      else for (const c of step.ch) { const L = doc.layers.find(l => l.id === c.id); if (L) L.cels[c.f] = (dir < 0 ? c.before : c.after) ? (dir < 0 ? c.before : c.after).slice() : null; }
    }
    H.undo = () => { if (H.pend) H.end(); if (H.i < 0) return null; const st = H.list[H.i]; apply(st, -1); H.i--; doc.dirty = true; S.emit('change', doc); S.emit('history', doc); return st.label; };
    H.redo = () => { if (H.i >= H.list.length - 1) return null; H.i++; const st = H.list[H.i]; apply(st, 1); doc.dirty = true; S.emit('change', doc); S.emit('history', doc); return st.label; };
    H.go = i => { while (H.i > i && H.i >= 0) H.undo(); while (H.i < i) H.redo(); };
    return H;
  }
  S.History = History;

  /* ---------------- eventos ---------------- */
  const ev = {};
  S.on = (n, fn) => (ev[n] = ev[n] || []).push(fn);
  S.emit = (n, a, b) => (ev[n] || []).forEach(fn => { try { fn(a, b); } catch (e) { console.error(e); } });

  /* ---------------- IndexedDB (projetos grandes) ---------------- */
  let dbp = null;
  function db() { if (dbp) return dbp; dbp = new Promise((res, rej) => { const r = indexedDB.open('pixxel-estudio', 1); r.onupgradeneeded = () => { r.result.createObjectStore('docs', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return dbp; }
  const tx = (store, mode, fn) => db().then(d => new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store); const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
  S.store = {
    put: (doc, thumb) => tx('docs', 'readwrite', s => s.put({ id: doc.id, name: doc.name, w: doc.w, h: doc.h, nf: doc.frames.length, when: Date.now(), thumb: thumb || null, data: serialize(doc) })),
    list: () => tx('docs', 'readonly', s => s.getAll()).then(a => (a || []).map(x => ({ id: x.id, name: x.name, w: x.w, h: x.h, nf: x.nf, when: x.when, thumb: x.thumb })).sort((p, q) => q.when - p.when)),
    get: id => tx('docs', 'readonly', s => s.get(id)).then(x => x && deserialize(x.data)),
    del: id => tx('docs', 'readwrite', s => s.delete(id)),
    kvGet: k => tx('kv', 'readonly', s => s.get(k)),
    kvSet: (k, v) => tx('kv', 'readwrite', s => s.put(v, k)),
  };

  /* ---------------- downloads ---------------- */
  S.download = function (href, name) { const a = h('a', { href, download: name }); document.body.appendChild(a); a.click(); a.remove(); };
  S.dlBlob = function (blob, name) { const u = URL.createObjectURL(blob); S.download(u, name); setTimeout(() => URL.revokeObjectURL(u), 5000); };
  S.dlText = (txt, name, type) => S.dlBlob(new Blob([txt], { type: type || 'application/json' }), name);
  S.slug = n => (n || 'desenho').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'desenho';
})();
