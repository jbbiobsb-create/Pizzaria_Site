/* ==========================================================================
   Pixxel Estúdio — editor.js
   Viewport (zoom/pan), desenho da tela, ferramentas, seleção flutuante.
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, { clamp, A, over, cdist, pack, R, G, B, rgb2hsv, hsv2rgb } = S;

  const V = S.view = { z: 8, x: 0, y: 0, grid: true, pgrid: true, tiled: false, onion: 1, onionNext: 0, ref: null, refOp: 0.4, showSel: true };
  S.state = { tool: 'pen', fg: 0xFF3A42C8 >>> 0, bg: 0, brush: 1, pp: true, symX: false, symY: false, lockA: false, fillShape: false, tol: 0, contiguous: true, ditherPat: 'xadrez', shadeDir: 1, sprayDens: 0.25 };
  S.state.fg = S.hex2c('#C8423A'); S.state.bg = S.hex2c('#FFFAEE');

  let cv, g, wrap, doc = null, H = null;
  const overlay = { pts: null, rect: null }; // pré-visualizações
  S.setDoc = function (d, hist) { doc = d; H = hist; S.fit(); S.redraw(); };
  S.curDoc = () => doc;

  S.initEditor = function (canvasEl, wrapEl) {
    cv = canvasEl; wrap = wrapEl; g = cv.getContext('2d');
    new ResizeObserver(() => { resize(); S.redraw(); }).observe(wrap);
    resize(); bindPointer();
  };
  function resize() { const r = wrap.getBoundingClientRect(), dpr = 1; cv.width = Math.max(50, Math.floor(r.width * dpr)); cv.height = Math.max(50, Math.floor(r.height * dpr)); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; }
  S.fit = function () { if (!doc || !cv) return; const z = Math.max(1, Math.floor(Math.min((cv.width - 40) / doc.w, (cv.height - 40) / doc.h))); V.z = clamp(z, 1, 64); V.x = Math.round((cv.width - doc.w * V.z) / 2); V.y = Math.round((cv.height - doc.h * V.z) / 2); S.emit('zoom'); };
  S.zoomAt = function (nz, px, py) { nz = clamp(nz, 0.5, 96); if (px == null) { px = cv.width / 2; py = cv.height / 2; } const wx = (px - V.x) / V.z, wy = (py - V.y) / V.z; V.z = nz; V.x = Math.round(px - wx * nz); V.y = Math.round(py - wy * nz); S.redraw(); S.emit('zoom'); };
  const toCell = (e) => { const r = cv.getBoundingClientRect(); const px = (e.clientX - r.left) * cv.width / r.width, py = (e.clientY - r.top) * cv.height / r.height; return [Math.floor((px - V.x) / V.z), Math.floor((py - V.y) / V.z), px, py]; };

  /* ---------------- desenho ---------------- */
  const off = document.createElement('canvas'), og = off.getContext('2d');
  let raf = 0; S.redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
  function checker() { const c = document.createElement('canvas'); c.width = c.height = 16; const q = c.getContext('2d'); q.fillStyle = '#e9e2d2'; q.fillRect(0, 0, 16, 16); q.fillStyle = '#d6ccb6'; q.fillRect(0, 0, 8, 8); q.fillRect(8, 8, 8, 8); return c; }
  let chk = null;
  function paint() {
    if (!g || !doc) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = getComputedStyle(document.body).getPropertyValue('--desk') || '#2a221c'; g.fillRect(0, 0, cv.width, cv.height);
    const W = doc.w, Hh = doc.h, z = V.z, f = doc.cur.f;
    // composição com camada atual possivelmente substituída pela flutuante
    const comp = new Uint32Array(W * Hh);
    // fantasmas (onion)
    const ghost = (fi, tint) => { if (fi < 0 || fi >= doc.frames.length || fi === f) return; const c = S.compose(doc, fi, { skipRef: true }); for (let i = 0; i < c.length; i++) if (c[i] >>> 24) comp[i] = over(((tint & 0x00FFFFFF) | (70 << 24)) >>> 0, comp[i]); };
    for (let k = V.onion; k >= 1; k--) ghost(f - k, 0xFF5050E0);
    for (let k = V.onionNext; k >= 1; k--) ghost(f + k, 0xFFE09050);
    for (let li = 0; li < doc.layers.length; li++) {
      const L = doc.layers[li]; if (!L.vis) continue; let c = L.cels[f];
      if (li === doc.cur.l && S.liveCel) c = S.liveCel;
      const op = L.op / 255, bm = L.blend || 'normal';
      if (c && bm !== 'normal') { for (let i = 0; i < comp.length; i++) { const v = c[i]; if (v >>> 24) comp[i] = S.blendPx(v, comp[i], bm, op); } }
      else if (c) for (let i = 0; i < comp.length; i++) { const v = c[i]; if (v >>> 24) comp[i] = (op >= 1 && (v >>> 24) === 255) ? v : over(v, comp[i], op); }
      if (li === doc.cur.l && S.float) { const F = S.float; for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) { const v = F.buf[y * F.w + x], X = F.x + x, Y = F.y + y; if (v >>> 24 && X >= 0 && Y >= 0 && X < W && Y < Hh) comp[Y * W + X] = over(v, comp[Y * W + X], op); } }
    }
    off.width = W; off.height = Hh; const im = og.createImageData(W, Hh); new Uint32Array(im.data.buffer).set(comp); og.putImageData(im, 0, 0);
    if (!chk) chk = g.createPattern(checker(), 'repeat');
    const reps = V.tiled ? [-1, 0, 1] : [0];
    for (const ty of reps) for (const tx of reps) {
      const ox = V.x + tx * W * z, oy = V.y + ty * Hh * z;
      g.save(); g.translate(ox, oy); g.fillStyle = chk; g.fillRect(0, 0, W * z, Hh * z); g.restore();
      if (V.ref && V.ref.img) { g.globalAlpha = V.refOp; g.imageSmoothingEnabled = true; g.drawImage(V.ref.img, ox + V.ref.x * z, oy + V.ref.y * z, V.ref.w * z, V.ref.h * z); g.imageSmoothingEnabled = false; g.globalAlpha = 1; }
      if (tx || ty) g.globalAlpha = 0.55;
      g.drawImage(off, ox, oy, W * z, Hh * z); g.globalAlpha = 1;
    }
    // grades
    if (V.pgrid && z >= 6) { g.fillStyle = 'rgba(0,0,0,.10)'; for (let x = 0; x <= W; x++) g.fillRect(V.x + x * z, V.y, 1, Hh * z); for (let y = 0; y <= Hh; y++) g.fillRect(V.x, V.y + y * z, W * z, 1); }
    if (V.grid && doc.tile) { const tw = doc.tile.w, th = doc.tile.h; if (tw * z >= 8) { g.fillStyle = 'rgba(46,100,176,.35)'; for (let x = 0; x <= W; x += tw) g.fillRect(V.x + x * z, V.y, 1, Hh * z); for (let y = 0; y <= Hh; y += th) g.fillRect(V.x, V.y + y * z, W * z, 1); } }
    g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(V.x - 0.5, V.y - 0.5, W * z + 1, Hh * z + 1);
    if (S.state.symX) { g.fillStyle = 'rgba(46,100,176,.7)'; g.fillRect(V.x + W * z / 2 - 1, V.y, 2, Hh * z); }
    if (S.state.symY) { g.fillStyle = 'rgba(46,100,176,.7)'; g.fillRect(V.x, V.y + Hh * z / 2 - 1, W * z, 2); }
    // seleção (formigas)
    const sel = doc.sel; const ant = (Date.now() / 120 | 0) % 8;
    if (sel && V.showSel) drawSelOutline(sel, ant);
    if (S.float) { g.setLineDash([4, 4]); g.lineDashOffset = -ant; g.strokeStyle = '#fff'; g.strokeRect(V.x + S.float.x * z + 0.5, V.y + S.float.y * z + 0.5, S.float.w * z, S.float.h * z); g.strokeStyle = '#000'; g.lineDashOffset = 4 - ant; g.strokeRect(V.x + S.float.x * z + 0.5, V.y + S.float.y * z + 0.5, S.float.w * z, S.float.h * z); g.setLineDash([]); }
    if (overlay.rect) { const r = overlay.rect; g.setLineDash([4, 3]); g.strokeStyle = '#fff'; g.strokeRect(V.x + r.x * z + 0.5, V.y + r.y * z + 0.5, r.w * z, r.h * z); g.setLineDash([]); }
    if (overlay.pts && overlay.pts.length > 1) { g.strokeStyle = '#fff'; g.beginPath(); overlay.pts.forEach(([x, y], i) => i ? g.lineTo(V.x + (x + .5) * z, V.y + (y + .5) * z) : g.moveTo(V.x + (x + .5) * z, V.y + (y + .5) * z)); g.stroke(); }
    // molde do modo guiado: o que falta desenhar aparece em azul claro piscando, o que já bate fica verde
    if (S.view.guide && S.view.guide.buf && S.view.guide.w === W && S.view.guide.h === Hh) {
      const gb = S.view.guide.buf, cur = S.view.guide.cmp, blink = 0.35 + 0.25 * Math.sin(Date.now() / 260);
      for (let i = 0; i < gb.length; i++) { const v = gb[i]; if (!(v >>> 24)) continue; const x = i % W, y = (i / W) | 0, ok = cur && (cur[i] >>> 24) && S.cdist(cur[i], v) < 900; if (ok) continue;
        g.fillStyle = 'rgba(' + (v & 255) + ',' + ((v >>> 8) & 255) + ',' + ((v >>> 16) & 255) + ',' + blink.toFixed(2) + ')'; g.fillRect(V.x + x * z, V.y + y * z, z, z);
        if (z >= 6) { g.strokeStyle = 'rgba(80,200,255,.55)'; g.strokeRect(V.x + x * z + .5, V.y + y * z + .5, z - 1, z - 1); } }
      S.redraw();
    }
    if (overlay.crop) { const r = overlay.crop; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(V.x, V.y, W * z, r.y * z); g.fillRect(V.x, V.y + (r.y + r.h) * z, W * z, (Hh - r.y - r.h) * z); g.fillRect(V.x, V.y + r.y * z, r.x * z, r.h * z); g.fillRect(V.x + (r.x + r.w) * z, V.y + r.y * z, (W - r.x - r.w) * z, r.h * z); g.strokeStyle = '#fff'; g.strokeRect(V.x + r.x * z + .5, V.y + r.y * z + .5, r.w * z, r.h * z); g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText(r.w + '×' + r.h + '  (Enter corta)', V.x + r.x * z + 4, V.y + r.y * z - 6); }
    if (overlay.poly && overlay.poly.length) { g.strokeStyle = '#fff'; g.setLineDash([3, 3]); g.beginPath(); overlay.poly.forEach(([x, y], i) => i ? g.lineTo(V.x + (x + .5) * z, V.y + (y + .5) * z) : g.moveTo(V.x + (x + .5) * z, V.y + (y + .5) * z)); if (hover) g.lineTo(V.x + (hover[0] + .5) * z, V.y + (hover[1] + .5) * z); g.stroke(); g.setLineDash([]); }
    if (overlay.ellsel) { const r = overlay.ellsel; g.setLineDash([4, 3]); g.strokeStyle = '#fff'; g.beginPath(); g.ellipse(V.x + (r.x + r.w / 2) * z, V.y + (r.y + r.h / 2) * z, r.w * z / 2, r.h * z / 2, 0, 0, 7); g.stroke(); g.setLineDash([]); }
    if (S.transform && S.float) { const F = S.float; g.strokeStyle = '#2d8ceb'; g.lineWidth = 1; g.strokeRect(V.x + F.x * z + .5, V.y + F.y * z + .5, F.w * z, F.h * z); handles().forEach(hd => { g.fillStyle = '#fff'; g.fillRect(hd.px - 4, hd.py - 4, 8, 8); g.strokeStyle = '#2d8ceb'; g.strokeRect(hd.px - 4.5, hd.py - 4.5, 9, 9); }); g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.fillText(F.w + '×' + F.h + (S.transform.rot ? '  ' + Math.round(S.transform.rot) + '°' : '') + '  · Enter aplica · Esc cancela', V.x + F.x * z, V.y + F.y * z - 6); }
    if (S.state.tool === 'clone' && cloneSrc) { const cx = V.x + (cloneSrc[0] + (cloneOff ? 0 : 0)) * z, cy = V.y + cloneSrc[1] * z; g.strokeStyle = '#fff'; g.beginPath(); g.arc(cx + z / 2, cy + z / 2, Math.max(4, z), 0, 7); g.moveTo(cx - 4, cy + z / 2); g.lineTo(cx + z + 4, cy + z / 2); g.moveTo(cx + z / 2, cy - 4); g.lineTo(cx + z / 2, cy + z + 4); g.stroke(); }
    // cursor do pincel
    if (hover && !panning) { const b = brushSz(), o = Math.floor((b - 1) / 2); g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeRect(V.x + (hover[0] - o) * z + 0.5, V.y + (hover[1] - o) * z + 0.5, b * z - 1, b * z - 1); g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeRect(V.x + (hover[0] - o) * z - 0.5, V.y + (hover[1] - o) * z - 0.5, b * z + 1, b * z + 1); }
    if (doc.sel || S.float) S.redraw(); // anima as formigas
  }
  function drawSelOutline(sel, ant) {
    const z = V.z, m = sel.mask, W = doc.w; g.beginPath();
    for (let y = sel.y; y < sel.y + sel.h; y++) for (let x = sel.x; x < sel.x + sel.w; x++) {
      if (!m[y * W + x]) continue; const px = V.x + x * z, py = V.y + y * z;
      if (y === 0 || !m[(y - 1) * W + x]) { g.moveTo(px, py + .5); g.lineTo(px + z, py + .5); }
      if (y === doc.h - 1 || !m[(y + 1) * W + x]) { g.moveTo(px, py + z - .5); g.lineTo(px + z, py + z - .5); }
      if (x === 0 || !m[y * W + x - 1]) { g.moveTo(px + .5, py); g.lineTo(px + .5, py + z); }
      if (x === W - 1 || !m[y * W + x + 1]) { g.moveTo(px + z - .5, py); g.lineTo(px + z - .5, py + z); }
    }
    g.setLineDash([4, 4]); g.lineDashOffset = -ant; g.strokeStyle = '#fff'; g.stroke(); g.lineDashOffset = 4 - ant; g.strokeStyle = '#000'; g.stroke(); g.setLineDash([]);
  }

  /* ---------------- seleção ---------------- */
  function selFromMask(mask) { let x0 = doc.w, x1 = -1, y0 = doc.h, y1 = -1; for (let y = 0; y < doc.h; y++) for (let x = 0; x < doc.w; x++) if (mask[y * doc.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : { mask, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; }
  function combine(mask, mode) { if (!doc.sel || mode === 'set') return mask; const m = doc.sel.mask.slice(); for (let i = 0; i < m.length; i++) { if (mode === 'add') m[i] = m[i] | mask[i]; else if (mode === 'sub') m[i] = m[i] && !mask[i] ? 1 : 0; else if (mode === 'and') m[i] = m[i] && mask[i] ? 1 : 0; } return m; }
  S.selectRect = function (x, y, w, hh, mode) { const m = new Uint8Array(doc.w * doc.h); for (let j = Math.max(0, y); j < Math.min(doc.h, y + hh); j++) for (let i = Math.max(0, x); i < Math.min(doc.w, x + w); i++) m[j * doc.w + i] = 1; doc.sel = selFromMask(combine(m, mode)); S.emit('sel'); S.redraw(); };
  S.selectAll = () => S.selectRect(0, 0, doc.w, doc.h, 'set');
  S.deselect = () => { S.dropFloat(); doc.sel = null; S.emit('sel'); S.redraw(); };
  S.invertSel = () => { const m = new Uint8Array(doc.w * doc.h); for (let i = 0; i < m.length; i++) m[i] = doc.sel && doc.sel.mask[i] ? 0 : 1; doc.sel = selFromMask(m); S.redraw(); };
  S.selectPoly = function (pts, mode) { const m = new Uint8Array(doc.w * doc.h); for (let y = 0; y < doc.h; y++) { const xs = []; const py = y + 0.5; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const ay = pts[i][1] + .5, by = pts[j][1] + .5; if ((ay <= py && by > py) || (by <= py && ay > py)) xs.push(pts[i][0] + .5 + (py - ay) / (by - ay) * (pts[j][0] - pts[i][0])); } xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - .5); x <= Math.floor(xs[k + 1] - .5); x++) if (x >= 0 && x < doc.w) m[y * doc.w + x] = 1; } for (const [x, y] of pts) if (x >= 0 && y >= 0 && x < doc.w && y < doc.h) m[y * doc.w + x] = 1; doc.sel = selFromMask(combine(m, mode)); S.redraw(); };
  S.selectWand = function (x, y, mode, global) {
    const src = S.compose(doc, doc.cur.f, { only: S.state.wandAll ? null : doc.cur.l }), W = doc.w, Hh = doc.h, t0 = src[y * W + x], tol = S.state.tol * S.state.tol * 30, m = new Uint8Array(W * Hh);
    const ok = v => (A(v) === 0 && A(t0) === 0) || (A(v) && A(t0) && cdist(v, t0) <= tol && Math.abs(A(v) - A(t0)) < 30);
    if (global) { for (let i = 0; i < src.length; i++) if (ok(src[i])) m[i] = 1; }
    else { const st = [x, y]; while (st.length) { const b = st.pop(), a = st.pop(); if (a < 0 || b < 0 || a >= W || b >= Hh) continue; const i = b * W + a; if (m[i] || !ok(src[i])) continue; m[i] = 1; st.push(a + 1, b, a - 1, b, a, b + 1, a, b - 1); } }
    doc.sel = selFromMask(combine(m, mode)); S.redraw();
  };
  const inSel = i => !doc.sel || doc.sel.mask[i];

  // flutuante: tira os pixels selecionados da camada pra mover/transformar
  S.liftFloat = function (copy) {
    if (S.float) return S.float; const L = doc.layers[doc.cur.l]; if (L.lock) return null;
    const sel = doc.sel || (() => { const c = L.cels[doc.cur.f]; const bb = c && S.bboxOf(c, doc.w, doc.h); if (!bb) return null; S.selectRect(bb.x, bb.y, bb.w, bb.h, 'set'); return doc.sel; })(); if (!sel) return null;
    H.begin('mover seleção'); H.touch(doc.cur.l, doc.cur.f);
    const c = S.celW(doc, doc.cur.l, doc.cur.f), buf = new Uint32Array(sel.w * sel.h);
    for (let y = 0; y < sel.h; y++) for (let x = 0; x < sel.w; x++) { const i = (sel.y + y) * doc.w + sel.x + x; if (sel.mask[i]) { buf[y * sel.w + x] = c[i]; if (!copy) c[i] = 0; } }
    S.float = { buf, w: sel.w, h: sel.h, x: sel.x, y: sel.y, x0: sel.x, y0: sel.y }; doc.sel = null; S.redraw(); return S.float;
  };
  S.dropFloat = function () {
    const F = S.float; if (!F) return; S.float = null; if (!H.pend) H.begin('soltar seleção');
    H.touch(doc.cur.l, doc.cur.f); const c = S.celW(doc, doc.cur.l, doc.cur.f), m = new Uint8Array(doc.w * doc.h);
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) { const v = F.buf[y * F.w + x], X = F.x + x, Y = F.y + y; if (X < 0 || Y < 0 || X >= doc.w || Y >= doc.h) continue; if (v >>> 24) { c[Y * doc.w + X] = over(v, c[Y * doc.w + X]); m[Y * doc.w + X] = 1; } }
    H.end(); doc.sel = selFromMask(m); S.emit('change', doc); S.redraw();
  };
  // transformações da flutuante (ou do quadro inteiro se não há seleção)
  S.floatOp = function (fn, label) { const F = S.liftFloat(); if (!F) return; const r = fn(F.buf, F.w, F.h); if (r) { F.buf = r.buf; const cx = F.x + F.w / 2, cy = F.y + F.h / 2; F.w = r.w; F.h = r.h; F.x = Math.round(cx - r.w / 2); F.y = Math.round(cy - r.h / 2); } if (H.pend) H.pend.label = label || H.pend.label; S.redraw(); };
  const T = S.xf = {
    flipH: (b, w, hh) => { const o = new Uint32Array(b.length); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) o[y * w + x] = b[y * w + w - 1 - x]; return { buf: o, w, h: hh }; },
    flipV: (b, w, hh) => { const o = new Uint32Array(b.length); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) o[y * w + x] = b[(hh - 1 - y) * w + x]; return { buf: o, w, h: hh }; },
    rot90: (b, w, hh) => { const o = new Uint32Array(b.length); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) o[x * hh + (hh - 1 - y)] = b[y * w + x]; return { buf: o, w: hh, h: w }; },
    scale: (b, w, hh, nw, nh) => { nw = Math.max(1, Math.round(nw)); nh = Math.max(1, Math.round(nh)); const o = new Uint32Array(nw * nh); for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) o[y * nw + x] = b[Math.min(hh - 1, Math.floor((y + .5) * hh / nh)) * w + Math.min(w - 1, Math.floor((x + .5) * w / nw))]; return { buf: o, w: nw, h: nh }; },
    // rotação livre com amostragem do vizinho (RotSprite simplificado: amplia 4x, gira, reduz pela moda)
    rotate: (b, w, hh, deg) => {
      const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), nw = Math.ceil(Math.abs(w * ca) + Math.abs(hh * sa)), nh = Math.ceil(Math.abs(w * sa) + Math.abs(hh * ca)), o = new Uint32Array(nw * nh), k = 3;
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
        const cnt = new Map(); let best = 0, bn = 0;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) { const px = x + (i + .5) / k - nw / 2, py = y + (j + .5) / k - nh / 2, sx = Math.floor(px * ca + py * sa + w / 2), sy = Math.floor(-px * sa + py * ca + hh / 2); const v = (sx >= 0 && sy >= 0 && sx < w && sy < hh) ? b[sy * w + sx] : 0; const n = (cnt.get(v) || 0) + 1; cnt.set(v, n); if (n > bn) { bn = n; best = v; } }
        o[y * nw + x] = best;
      }
      return { buf: o, w: nw, h: nh };
    },
  };

  /* ---------------- pintura ---------------- */
  const BRUSHES = ['pen', 'erase', 'shade', 'dither', 'spray', 'light', 'dark', 'clone', 'sponge', 'heal'];
  const brushSz = () => BRUSHES.includes(S.state.tool) ? S.state.brush : 1;
  let cloneSrc = null, cloneOff = null;
  const DITHER = { xadrez: (x, y) => (x + y) & 1, '25%': (x, y) => !(x & 1) && !(y & 1) && (((x >> 1) + (y >> 1)) & 1) === 0 ? 1 : (x & 1) && (y & 1) && (((x >> 1) + (y >> 1)) & 1) ? 1 : 0, '75%': (x, y) => !(!(x & 1) && !(y & 1)), linhas: (x, y) => y & 1, colunas: (x, y) => x & 1, diagonal: (x, y) => ((x + y) % 4) === 0 };
  S.DITHER = DITHER;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  let live = null, lockMask = null, stroke = null;
  function palIndexOf(c) { const p = doc.pal; let bi = -1, bd = 1e12; for (let i = 0; i < p.length; i++) { const d = cdist(c, p[i]); if (d < bd) { bd = d; bi = i; } } return bd < 60 ? bi : -1; }
  // rampa: grupos contíguos da paleta ordenados por brilho (pincel de sombra anda nela)
  function shadeStep(c, dir) {
    const i = palIndexOf(c); if (i < 0) { const [hh, s, v] = rgb2hsv(R(c), G(c), B(c)); const nv = clamp(v + dir * 0.12, 0, 1), nh = (hh + (dir < 0 ? 8 : -6) + 360) % 360; return pack(...hsv2rgb(nh, clamp(s + (dir < 0 ? 0.05 : -0.05), 0, 1), nv), A(c)); }
    const ramps = S.paletteRamps(doc.pal), r = ramps.find(rr => rr.includes(i)); if (!r) return c;
    const k = r.indexOf(i) + (dir < 0 ? 1 : -1); return k < 0 || k >= r.length ? c : (doc.pal[r[k]] & 0x00FFFFFF | (A(c) << 24)) >>> 0;
  }
  S.paletteRamps = function (pal) {
    // usa as rampas da paleta Kome se bater; senão agrupa por matiz/brilho
    const out = []; if (pal.length === S.PALETTES['Kome (oficial)'].length) { let i = 0; for (const r of S.KOME_RAMPS) { out.push(r.map((_, k) => i + k)); i += r.length; } return out; }
    const items = pal.map((c, i) => { const [hh, s, v] = rgb2hsv(R(c), G(c), B(c)); return { i, hh: s < 0.12 ? -1 : Math.round(hh / 30), v }; });
    const groups = new Map(); for (const it of items) { if (!groups.has(it.hh)) groups.set(it.hh, []); groups.get(it.hh).push(it); }
    for (const gr of groups.values()) out.push(gr.sort((a, b) => b.v - a.v).map(x => x.i)); return out;
  };
  function plot(x, y, mode) {
    const W = doc.w, Hh = doc.h, pts = [[x, y]];
    if (S.state.symX) pts.push([W - 1 - x, y]); if (S.state.symY) pts.slice().forEach(([a, b]) => pts.push([a, Hh - 1 - b]));
    for (const [a, b] of pts) {
      if (a < 0 || b < 0 || a >= W || b >= Hh) continue; const i = b * W + a;
      if (!inSel(i) || (lockMask && !lockMask[i])) continue;
      if (stroke && stroke.done[i] && (mode === 'shade' || mode === 'light' || mode === 'dark')) continue;
      const cur = live[i];
      if (mode === 'erase') { const op = (S.state.opacity == null ? 100 : S.state.opacity) / 100; live[i] = op >= 1 ? 0 : (A(cur) ? ((cur & 0xFFFFFF) | (Math.round(A(cur) * (1 - op)) << 24)) >>> 0 : 0); }
      else if (mode === 'clone') { if (!cloneOff) continue; const sx = a + cloneOff[0], sy = b + cloneOff[1]; if (sx < 0 || sy < 0 || sx >= W || sy >= Hh) continue; const v = stroke.src[sy * W + sx]; if (v >>> 24) live[i] = v; }
      else if (mode === 'sponge' || mode === 'desat') { if (!(cur >>> 24) || stroke.done[i]) continue; const [hh, ss, vv] = rgb2hsv(R(cur), G(cur), B(cur)); live[i] = pack(...hsv2rgb(hh, clamp(ss + (mode === 'sponge' ? 0.15 : -0.2), 0, 1), vv), A(cur)); stroke.done[i] = 1; }
      else if (mode === 'heal') { // corretor: pixel que destoa dos vizinhos vira a cor da maioria (limpa ruído sem borrar)
        const cnt = new Map(); let best = 0, bn = 0, same = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const X2 = a + dx, Y2 = b + dy; if (X2 < 0 || Y2 < 0 || X2 >= W || Y2 >= Hh) continue; const v = stroke.base[Y2 * W + X2]; if (v === cur) same++; const n = (cnt.get(v) || 0) + 1; cnt.set(v, n); if (n > bn) { bn = n; best = v; } }
        if (same <= 1 && bn >= 4) live[i] = best; }
      else if (mode === 'shade' || mode === 'dark' || mode === 'light') { if (cur >>> 24) { live[i] = shadeStep(cur, mode === 'light' ? 1 : mode === 'dark' ? -1 : -S.state.shadeDir); if (stroke) stroke.done[i] = 1; } }
      else if (mode === 'dither') live[i] = DITHER[S.state.ditherPat](a, b) ? S.state.fg : (A(S.state.bg) ? S.state.bg : cur);
      else { const op = (S.state.opacity == null ? 100 : S.state.opacity) / 100; if (op < 1) { if (stroke && stroke.done[i]) continue; live[i] = over(((mode & 0xFFFFFF) | (Math.round(A(mode) * op) << 24)) >>> 0, cur); if (stroke) stroke.done[i] = 1; } else live[i] = A(mode) === 255 ? mode : over(mode, cur); }
    }
  }
  function stamp(x, y, mode) {
    const b = brushSz(), o = Math.floor((b - 1) / 2);
    for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) {
      if (b >= 3) { const dx = i - (b - 1) / 2, dy = j - (b - 1) / 2; if (dx * dx + dy * dy > (b / 2) * (b / 2) + 0.25) continue; }
      if (S.state.tool === 'spray' && Math.random() > S.state.sprayDens) continue;
      plot(x - o + i, y - o + j, mode);
    }
  }
  function line(x0, y0, x1, y1, fn) { let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy; for (; ;) { fn(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
  S.lineCells = line;
  function shape(kind, a, b, mode, fillIt) {
    if (kind === 'line') { line(a[0], a[1], b[0], b[1], (x, y) => stamp(x, y, mode)); return; }
    const xa = Math.min(a[0], b[0]), xb = Math.max(a[0], b[0]), ya = Math.min(a[1], b[1]), yb = Math.max(a[1], b[1]);
    if (kind === 'rect') { for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (fillIt || x === xa || x === xb || y === ya || y === yb) plot(x, y, mode); return; }
    const cx = (xa + xb + 1) / 2, cy = (ya + yb + 1) / 2, rx = (xb - xa + 1) / 2, ry = (yb - ya + 1) / 2, inE = (x, y) => { const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; return dx * dx + dy * dy <= 1; };
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (inE(x, y) && (fillIt || !inE(x - 1, y) || !inE(x + 1, y) || !inE(x, y - 1) || !inE(x, y + 1))) plot(x, y, mode);
  }
  function flood(x, y, col, global) {
    const W = doc.w, Hh = doc.h, src = S.state.fillAll ? S.compose(doc, doc.cur.f) : live.slice(), t0 = src[y * W + x], tol = S.state.tol * S.state.tol * 30;
    const ok = v => (!(v >>> 24) && !(t0 >>> 24)) || ((v >>> 24) && (t0 >>> 24) && cdist(v, t0) <= tol);
    if (global) { for (let i = 0; i < src.length; i++) if (ok(src[i]) && inSel(i)) live[i] = col; return; }
    const seen = new Uint8Array(W * Hh), st = [x, y];
    while (st.length) { const b = st.pop(), a = st.pop(); if (a < 0 || b < 0 || a >= W || b >= Hh) continue; const i = b * W + a; if (seen[i] || !ok(src[i]) || !inSel(i)) continue; seen[i] = 1; live[i] = col; st.push(a + 1, b, a - 1, b, a, b + 1, a, b - 1); }
  }
  // degradê com retícula Bayer entre fg e bg
  function gradient(a, b) {
    const W = doc.w, Hh = doc.h, dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!inSel(i) || (lockMask && !lockMask[i])) continue; const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1), th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; live[i] = t > th ? S.state.bg : S.state.fg; }
  }

  /* ---------------- ponteiro ---------------- */
  let down = false, start = null, last = null, hover = null, panning = null, ppHist = [], btn = 0, spaceDown = false, moveStart = null;
  addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { spaceDown = true; if (cv) cv.style.cursor = 'grab'; e.preventDefault(); } });
  addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; if (cv) cv.style.cursor = ''; } });
  const SEL_TOOLS = ['select', 'lasso', 'wand'];
  function bindPointer() {
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), px = (e.clientX - r.left), py = (e.clientY - r.top); if (e.ctrlKey || e.metaKey || !e.shiftKey) { const f = e.deltaY < 0 ? 1.2 : 1 / 1.2; let nz = V.z * f; if (V.z >= 1 && nz > 1) nz = e.deltaY < 0 ? Math.max(V.z + 1, Math.round(nz)) : Math.max(1, Math.min(V.z - 1, Math.round(nz))); S.zoomAt(nz, px, py); } else { V.x -= e.deltaY; S.redraw(); } }, { passive: false });
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); btn = e.button;
      const [x, y, px, py] = toCell(e);
      if (e.button === 1 || spaceDown) { panning = { px, py, x: V.x, y: V.y }; cv.style.cursor = 'grabbing'; return; }
      if (!doc) return; const L = doc.layers[doc.cur.l], tool = S.state.tool;
      if (e.button === 2 && tool !== 'select' && tool !== 'lasso') { pick(x, y, true); return; }
      if (S.transform) { tfDown(e, x, y, px, py); return; }
      if (tool === 'clone' && e.altKey) { cloneSrc = [x, y]; cloneOff = null; S.toast('Origem do carimbo marcada'); S.redraw(); return; }
      if (tool === 'zoom') { S.zoomAt(e.altKey || e.button === 2 ? (V.z <= 4 ? V.z - 1 : V.z / 1.5) : (V.z < 4 ? V.z + 1 : V.z * 1.5), px, py); return; }
      if (tool === 'text') { textAt(x, y); return; }
      if (tool === 'crop') { down = true; start = [x, y]; overlay.crop = { x, y, w: 1, h: 1 }; return; }
      if (tool === 'polylasso') { if (S.float) S.dropFloat(); overlay.poly = overlay.poly || []; const f0 = overlay.poly[0]; if (overlay.poly.length > 2 && f0 && Math.abs(f0[0] - x) <= 1 && Math.abs(f0[1] - y) <= 1) { S.selectPoly(overlay.poly, e.shiftKey ? 'add' : e.altKey ? 'sub' : 'set'); overlay.poly = null; } else overlay.poly.push([x, y]); S.redraw(); return; }
      if (tool === 'ellsel') { if (S.float) S.dropFloat(); down = true; start = [x, y]; stroke = { mode: e.shiftKey ? 'add' : e.altKey ? 'sub' : 'set' }; overlay.ellsel = { x, y, w: 1, h: 1 }; return; }
      if (e.altKey && !SEL_TOOLS.includes(tool)) { pick(x, y); return; }
      if (tool === 'pick') { pick(x, y); return; }
      if (tool === 'hand') { panning = { px, py, x: V.x, y: V.y }; return; }
      if (SEL_TOOLS.includes(tool)) {
        const mode = e.shiftKey ? 'add' : (e.altKey || e.button === 2) ? 'sub' : 'set';
        if (S.float) S.dropFloat();
        if (tool === 'wand') { S.selectWand(x, y, mode, e.ctrlKey); return; }
        if (doc.sel && mode === 'set' && doc.sel.mask[y * doc.w + x] && tool === 'select') { down = true; S.liftFloat(e.ctrlKey); start = [x, y]; if (S.float) { S.float.xBase = S.float.x; S.float.yBase = S.float.y; } return; }
        down = true; start = [x, y]; stroke = { mode }; if (tool === 'lasso') overlay.pts = [[x, y]]; return;
      }
      if (tool === 'move') { down = true; start = [x, y]; const F = S.liftFloat(e.ctrlKey); if (!F) down = false; else { F.xBase = F.x; F.yBase = F.y; } return; }
      if (L.lock) { S.toast('Camada trancada'); return; }
      if (!L.vis) { S.toast('Camada escondida'); return; }
      if (S.float) S.dropFloat();
      down = true; start = [x, y]; last = [x, y]; ppHist = [[x, y]];
      lockMask = L.lockA ? (L.cels[doc.cur.f] || new Uint32Array(doc.w * doc.h)).map(v => (v >>> 24) ? 1 : 0) : S.state.lockA ? S.compose(doc, doc.cur.f).map(v => (v >>> 24) ? 1 : 0) : null;
      live = (L.cels[doc.cur.f] || new Uint32Array(doc.w * doc.h)).slice(); S.liveCel = live; stroke = { base: live.slice(), done: new Uint8Array(doc.w * doc.h), src: S.state.cloneAll ? S.compose(doc, doc.cur.f) : live.slice() };
      const mode = modeOf(e);
      if (tool === 'fill') { flood(x, y, mode === 'erase' ? 0 : S.state.fg, e.shiftKey || !S.state.contiguous); commit('balde'); return; }
      if (tool === 'replace') { const t0 = live[y * doc.w + x]; for (let i = 0; i < live.length; i++) if (live[i] === t0 && inSel(i)) live[i] = S.state.fg; commit('trocar cor'); return; }
      if (tool === 'clone' && !cloneSrc) { S.toast('Carimbo: segure Alt e clique onde quer copiar'); S.liveCel = null; live = null; down = false; return; }
      if (tool === 'clone') { if (!cloneOff || S.state.cloneAligned === false) cloneOff = [cloneSrc[0] - x, cloneSrc[1] - y]; }
      if (BRUSHES.includes(tool)) { stamp(x, y, mode); S.redraw(); }
    });
    cv.addEventListener('pointermove', e => {
      const [x, y, px, py] = toCell(e); hover = [x, y]; S.emit('cursor', x, y);
      if (panning) { V.x = Math.round(panning.x + px - panning.px); V.y = Math.round(panning.y + py - panning.py); S.redraw(); return; }
      if (S.transform && tfDrag) { tfMove(e, x, y, px, py); return; }
      if (!down || !doc) { S.redraw(); return; }
      const tool = S.state.tool;
      if (tool === 'crop' || tool === 'ellsel') { let w = x - start[0], hh = y - start[1]; if (e.shiftKey) { const d = Math.max(Math.abs(w), Math.abs(hh)); w = Math.sign(w || 1) * d; hh = Math.sign(hh || 1) * d; } const r = { x: clamp(Math.min(start[0], start[0] + w), 0, doc.w - 1), y: clamp(Math.min(start[1], start[1] + hh), 0, doc.h - 1), w: Math.abs(w) + 1, h: Math.abs(hh) + 1 }; r.w = Math.min(r.w, doc.w - r.x); r.h = Math.min(r.h, doc.h - r.y); if (tool === 'crop') overlay.crop = r; else overlay.ellsel = r; S.redraw(); return; }
      if (S.float && (tool === 'move' || tool === 'select') && S.float.xBase != null) { S.float.x = S.float.xBase + x - start[0]; S.float.y = S.float.yBase + y - start[1]; S.redraw(); return; }
      if (tool === 'select') { let w = x - start[0], hh = y - start[1]; if (e.shiftKey) { const d = Math.max(Math.abs(w), Math.abs(hh)); w = Math.sign(w || 1) * d; hh = Math.sign(hh || 1) * d; } overlay.rect = { x: Math.min(start[0], start[0] + w), y: Math.min(start[1], start[1] + hh), w: Math.abs(w) + 1, h: Math.abs(hh) + 1 }; S.redraw(); return; }
      if (tool === 'lasso') { const lp = overlay.pts[overlay.pts.length - 1]; if (lp[0] !== x || lp[1] !== y) overlay.pts.push([x, y]); S.redraw(); return; }
      const mode = modeOf(e);
      if (BRUSHES.includes(tool)) {
        line(last[0], last[1], x, y, (a, b) => {
          if (S.state.pp && tool === 'pen' && brushSz() === 1) {
            const lp = ppHist[ppHist.length - 1]; if (lp && lp[0] === a && lp[1] === b) return; ppHist.push([a, b]);
            // pixel perfeito: remove o canto em L (tira o pixel do meio quando os 3 formam cotovelo)
            if (ppHist.length >= 3) { const [p0, p1, p2] = ppHist.slice(-3); if (Math.abs(p0[0] - p2[0]) === 1 && Math.abs(p0[1] - p2[1]) === 1 && (p1[0] === p0[0] || p1[1] === p0[1])) { const i = p1[1] * doc.w + p1[0]; if (p1[0] >= 0 && p1[1] >= 0 && p1[0] < doc.w && p1[1] < doc.h) live[i] = stroke.base[i]; ppHist.splice(ppHist.length - 2, 1); } }
          }
          stamp(a, b, mode);
        }); last = [x, y]; S.redraw(); return;
      }
      if (['line', 'rect', 'ell', 'grad'].includes(tool)) {
        let tx = x, ty = y; if (e.shiftKey && tool !== 'grad') { if (tool === 'line') { const dx = x - start[0], dy = y - start[1], ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, len = Math.max(Math.abs(dx), Math.abs(dy)); tx = start[0] + Math.round(Math.cos(ang) * len); ty = start[1] + Math.round(Math.sin(ang) * len); } else { const d = Math.max(Math.abs(x - start[0]), Math.abs(y - start[1])); tx = start[0] + Math.sign(x - start[0] || 1) * d; ty = start[1] + Math.sign(y - start[1] || 1) * d; } }
        live.set(stroke.base); if (tool === 'grad') gradient(start, [tx, ty]); else shape(tool, start, [tx, ty], mode, S.state.fillShape || e.ctrlKey); S.redraw();
      }
    });
    const up = e => {
      if (panning) { panning = null; cv.style.cursor = spaceDown ? 'grab' : ''; return; }
      if (S.transform && tfDrag) { tfDrag = null; tfUp(); return; }
      if (!down) return; down = false; const tool = S.state.tool;
      if (tool === 'crop') { S.redraw(); return; }
      if (tool === 'ellsel') { const r = overlay.ellsel; overlay.ellsel = null; if (r && r.w > 1 && r.h > 1) { const m = new Uint8Array(doc.w * doc.h), cx = r.x + r.w / 2, cy = r.y + r.h / 2; for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) { const dx = (xx + .5 - cx) / (r.w / 2), dy = (yy + .5 - cy) / (r.h / 2); if (dx * dx + dy * dy <= 1) m[yy * doc.w + xx] = 1; } S.selectMask(m, stroke.mode); } else if (stroke.mode === 'set') S.deselect(); return; }
      if (S.float && (tool === 'move' || tool === 'select')) { S.emit('change', doc); return; }
      if (tool === 'select') { const r = overlay.rect; overlay.rect = null; if (r && (r.w > 1 || r.h > 1)) S.selectRect(r.x, r.y, r.w, r.h, stroke.mode); else if (stroke.mode === 'set') S.deselect(); return; }
      if (tool === 'lasso') { const pts = overlay.pts; overlay.pts = null; if (pts.length > 2) S.selectPoly(pts, stroke.mode); return; }
      const names = { clone: 'carimbo', sponge: 'esponja', heal: 'corretor', pen: 'lápis', erase: 'borracha', shade: 'sombrear', dither: 'retícula', spray: 'spray', line: 'linha', rect: 'retângulo', ell: 'elipse', grad: 'degradê', light: 'clarear', dark: 'escurecer' };
      commit(names[tool] || tool);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { hover = null; S.redraw(); });
  }
  function modeOf(e) { const t = S.state.tool; if (t === 'shade' && e.shiftKey) return 'light'; if (t === 'clone') return 'clone'; if (t === 'heal') return 'heal'; if (t === 'sponge') return (e.altKey || S.state.spongeMode === 'tirar') ? 'desat' : 'sponge'; if (t === 'light' && e.altKey) return 'dark'; if (t === 'dark' && e.altKey) return 'light'; if (t === 'erase' || (btn === 2 && t !== 'shade')) return 'erase'; if (t === 'shade' || t === 'light' || t === 'dark') return t; if (t === 'dither') return 'dither'; return S.state.fg; }
  function commit(label) {
    if (!live) return; H.begin(label); H.touch(doc.cur.l, doc.cur.f);
    const L = doc.layers[doc.cur.l]; L.cels[doc.cur.f] = live.some(v => v >>> 24) ? live : null;
    S.liveCel = null; live = null; lockMask = null; stroke = null; H.end(); S.emit('change', doc); S.redraw();
  }
  function pick(x, y, toBg) {
    if (!doc || x < 0 || y < 0 || x >= doc.w || y >= doc.h) return; const c = S.state.pickLayer ? (doc.layers[doc.cur.l].cels[doc.cur.f] || [])[y * doc.w + x] || 0 : S.compose(doc, doc.cur.f)[y * doc.w + x];
    if (!(c >>> 24)) return; if (toBg) S.state.bg = c; else S.state.fg = c; S.emit('color'); if (S.state.tool === 'pick' && S.state.prevTool) S.setTool(S.state.prevTool);
  }

  S.selectMask = (m, mode) => { doc.sel = selFromMask(combine(m, mode || 'set')); S.emit('sel'); S.redraw(); };
  S.applyCrop = function () { const r = overlay.crop; overlay.crop = null; if (!r || r.w < 1 || r.h < 1) return false; S.ops.cropRect(r.x, r.y, r.w, r.h); return true; };
  S.cancelOverlays = () => { const had = !!(overlay.crop || overlay.poly); overlay.crop = null; overlay.poly = null; overlay.ellsel = null; S.redraw(); return had; };
  S.closePoly = () => { if (overlay.poly && overlay.poly.length > 2) { S.selectPoly(overlay.poly, 'set'); overlay.poly = null; return true; } return false; };
  S.hasCrop = () => !!overlay.crop;

  /* ---------- texto em pixel (fonte 3×5 e 5×7) ---------- */
  const F35 = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110', '!': '010010010000010', '?': '110001010000010', '.': '000000000000010', ',': '000000000010100', ':': '000010000010000', '-': '000000111000000', '+': '000010111010000', '/': '001001010100100', "'": '010010000000000', '(': '010100100100010', ')': '010001001001010', '♥': '000101111111010', ' ': '000000000000000' };
  function textBuf(txt, k, col) {
    txt = txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); const lines = txt.split('\n'), cw = 4 * k, lh = 6 * k;
    const W = Math.max(1, ...lines.map(l => l.length)) * cw, Hh = lines.length * lh, b = new Uint32Array(W * Hh);
    lines.forEach((ln, li) => [...ln].forEach((ch, ci) => { const gph = F35[ch] || F35['?']; for (let i = 0; i < 15; i++) if (gph[i] === '1') { const gx = i % 3, gy = (i / 3) | 0; for (let a = 0; a < k; a++) for (let c = 0; c < k; c++) b[(li * lh + gy * k + a) * W + ci * cw + gx * k + c] = col; } }));
    return { buf: b, w: W, h: Hh };
  }
  S.textBuf = textBuf;
  function textAt(x, y) {
    const t = prompt('Texto (fonte pixel 3×5; o tamanho do pincel aumenta a letra):', S.state.lastText || 'KOME'); if (!t) return; S.state.lastText = t;
    const tb = textBuf(t, Math.max(1, S.state.brush), S.state.fg); if (S.float) S.dropFloat(); H.begin('texto'); H.touch(doc.cur.l, doc.cur.f);
    S.float = { buf: tb.buf, w: tb.w, h: tb.h, x, y, x0: x, y0: y }; S.setTool('move'); S.redraw(); S.toast('Arraste o texto e aperte Enter pra fixar');
  }

  /* ---------- transformação livre (Ctrl+T, igual ao Photoshop) ---------- */
  let tfDrag = null;
  S.startTransform = function () { const F = S.liftFloat(); if (!F) { S.toast('Nada pra transformar nesta camada'); return; } S.transform = { orig: { buf: F.buf.slice(), w: F.w, h: F.h }, x0: F.x, y0: F.y, w: F.w, h: F.h, rot: 0, cx: F.x + F.w / 2, cy: F.y + F.h / 2 }; S.redraw(); S.toast('Transformar: arraste os quadradinhos (Shift mantém proporção), fora gira, dentro move'); };
  function handles() { const F = S.float, z = V.z, x0 = V.x + F.x * z, y0 = V.y + F.y * z, x1 = x0 + F.w * z, y1 = y0 + F.h * z, mx = (x0 + x1) / 2, my = (y0 + y1) / 2; return [{ k: 'nw', px: x0, py: y0 }, { k: 'n', px: mx, py: y0 }, { k: 'ne', px: x1, py: y0 }, { k: 'e', px: x1, py: my }, { k: 'se', px: x1, py: y1 }, { k: 's', px: mx, py: y1 }, { k: 'sw', px: x0, py: y1 }, { k: 'w', px: x0, py: my }]; }
  function tfDown(e, x, y, px, py) {
    const F = S.float; if (!F) { S.transform = null; return; } const hd = handles().find(q => Math.abs(q.px - px) <= 7 && Math.abs(q.py - py) <= 7);
    const T = S.transform; if (hd) tfDrag = { k: hd.k, x0: F.x, y0: F.y, w: F.w, h: F.h, sx: x, sy: y };
    else if (x >= F.x && y >= F.y && x < F.x + F.w && y < F.y + F.h) tfDrag = { k: 'move', x0: F.x, y0: F.y, sx: x, sy: y };
    else { const cxp = V.x + (F.x + F.w / 2) * V.z, cyp = V.y + (F.y + F.h / 2) * V.z; tfDrag = { k: 'rot', a0: Math.atan2(py - cyp, px - cxp), r0: T.rot }; }
  }
  function rebuild() { const T = S.transform, F = S.float; let r = S.xf.scale(T.orig.buf, T.orig.w, T.orig.h, T.w, T.h); if (T.rot % 360) r = S.xf.rotate(r.buf, r.w, r.h, T.rot); const cx = F.x + F.w / 2, cy = F.y + F.h / 2; F.buf = r.buf; F.w = r.w; F.h = r.h; F.x = Math.round(cx - r.w / 2); F.y = Math.round(cy - r.h / 2); }
  function tfMove(e, x, y, px, py) {
    const F = S.float, T = S.transform, d = tfDrag;
    if (d.k === 'move') { F.x = d.x0 + x - d.sx; F.y = d.y0 + y - d.sy; S.redraw(); return; }
    if (d.k === 'rot') { const cxp = V.x + (F.x + F.w / 2) * V.z, cyp = V.y + (F.y + F.h / 2) * V.z; let a = d.r0 + (Math.atan2(py - cyp, px - cxp) - d.a0) * 180 / Math.PI; if (e.shiftKey) a = Math.round(a / 15) * 15; T.rot = Math.round(a); T.pending = true; S.redraw(); return; }
    const dx = x - d.sx, dy = y - d.sy; let nw = d.w, nh = d.h, nx = d.x0, ny = d.y0;
    if (d.k.includes('e')) nw = Math.max(1, d.w + dx); if (d.k.includes('w')) { nw = Math.max(1, d.w - dx); nx = d.x0 + d.w - nw; }
    if (d.k.includes('s')) nh = Math.max(1, d.h + dy); if (d.k.includes('n')) { nh = Math.max(1, d.h - dy); ny = d.y0 + d.h - nh; }
    if (e.shiftKey && d.k.length === 2) { const k = Math.max(nw / d.w, nh / d.h); nw = Math.max(1, Math.round(d.w * k)); nh = Math.max(1, Math.round(d.h * k)); if (d.k.includes('w')) nx = d.x0 + d.w - nw; if (d.k.includes('n')) ny = d.y0 + d.h - nh; }
    const sxk = nw / (T.rot ? F.w : T.w), syk = nh / (T.rot ? F.h : T.h); T.w = Math.max(1, Math.round(T.w * (T.rot ? sxk : nw / T.w))); T.h = Math.max(1, Math.round(T.h * (T.rot ? syk : nh / T.h)));
    if (!T.rot) { const r = S.xf.scale(T.orig.buf, T.orig.w, T.orig.h, nw, nh); F.buf = r.buf; F.w = nw; F.h = nh; F.x = nx; F.y = ny; T.w = nw; T.h = nh; }
    S.redraw();
  }
  function tfUp() { const T = S.transform; if (T && T.pending) { T.pending = false; rebuild(); } S.redraw(); }
  S.applyTransform = function () { if (!S.transform) return false; S.transform = null; S.dropFloat(); return true; };
  S.cancelTransform = function () { const T = S.transform; if (!T) return false; const F = S.float; F.buf = T.orig.buf; F.w = T.orig.w; F.h = T.orig.h; F.x = T.x0; F.y = T.y0; S.transform = null; S.dropFloat(); return true; };

  /* ---------------- operações rápidas na célula atual ---------------- */
  // op(label, fn(cel, w, h) -> nova célula | undefined), allLayers / allFrames
  S.celOp = function (label, fn, o) {
    o = o || {}; if (S.float) S.dropFloat(); H.begin(label);
    const ls = o.allLayers ? doc.layers.map((_, i) => i) : [doc.cur.l], fs = o.allFrames ? doc.frames.map((_, i) => i) : [doc.cur.f];
    for (const li of ls) { if (doc.layers[li].lock) continue; for (const f of fs) { H.touch(li, f); const c = S.celW(doc, li, f), r = fn(c, doc.w, doc.h, li, f); if (r) c.set(r); if (!c.some(v => v >>> 24)) doc.layers[li].cels[f] = null; } }
    H.end(); S.emit('change', doc); S.redraw();
  };
  S.inSel = inSel;
})();
