/* ==========================================================================
   Pixxel Estúdio — map.js
   Editor de mapa com tiles (tileset = qualquer desenho aberto, fatiado pelo
   tamanho do tile) + "Testar no jogo": plataforma com o seu personagem
   (animações por tag via E.Assets/E.Anim da engine) e o Kome seguindo.
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, E = S.E, { h, clamp } = S;
  const M = S.map = { cols: 40, rows: 18, layers: [{ name: 'Fundo', data: null }, { name: 'Chão (sólido)', data: null, solid: true }, { name: 'Frente', data: null }], L: 1, tsId: null, tile: 0, stamp: null, tool: 'pen', z: 2, x: 20, y: 20, playerId: null, bg: 'dia' };
  const blankData = () => new Int16Array(M.cols * M.rows).fill(-1);
  M.layers.forEach(l => l.data = blankData());
  let ts = null; // {doc, tw, th, tiles:[canvas], bufs}

  S.mapSerialize = () => ({ cols: M.cols, rows: M.rows, tsId: M.tsId, playerId: M.playerId, bg: M.bg, layers: M.layers.map(l => ({ name: l.name, solid: !!l.solid, data: Array.from(l.data) })) });
  S.mapLoad = o => { if (!o) return; M.cols = o.cols; M.rows = o.rows; M.tsId = o.tsId; M.playerId = o.playerId; M.bg = o.bg || 'dia'; M.layers = o.layers.map(l => ({ name: l.name, solid: l.solid, data: Int16Array.from(l.data) })); };
  let saveT = 0; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => S.store.kvSet('map', S.mapSerialize()).catch(() => { }), 400); };

  function buildTileset() {
    const doc = S.docs.find(d => d.id === M.tsId) || S.curDoc(); if (!doc) return null; M.tsId = doc.id;
    const tw = doc.tile.w, th = doc.tile.h, buf = S.compose(doc, 0, { skipRef: true }), cols = Math.floor(doc.w / tw), rows = Math.floor(doc.h / th), tiles = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const b = new Uint32Array(tw * th); for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) b[y * tw + x] = buf[(r * th + y) * doc.w + c * tw + x]; tiles.push({ cv: S.toCanvas(b, tw, th), empty: !b.some(v => v >>> 24), c, r }); }
    ts = { doc, tw, th, cols, rows, tiles }; return ts;
  }

  /* ---------------- UI do mapa ---------------- */
  let root, mcv, mg, tcv, tg;
  S.mountMap = function (el) {
    root = el; el.innerHTML = '';
    const tsSel = h('select', { id: 'mTs', onchange: e => { M.tsId = e.target.value; buildTileset(); drawTs(); drawMap(); save(); } });
    const plSel = h('select', { id: 'mPl', onchange: e => { M.playerId = e.target.value; save(); } });
    const layerBox = h('div', { class: 'mlayers' });
    const tools = h('div', { class: 'seg' }, ...[['pen', 'Pintar'], ['erase', 'Apagar'], ['fill', 'Balde'], ['rect', 'Retângulo'], ['pick', 'Conta-gotas']].map(([id, nm]) => h('button', { class: 'tb' + (M.tool === id ? ' on' : ''), 'data-mt': id, onclick: () => { M.tool = id; S.$$('[data-mt]').forEach(b => b.classList.toggle('on', b.dataset.mt === id)); } }, nm)));
    tcv = h('canvas', { class: 'tscv' }); mcv = h('canvas', { class: 'mapcv' }); tg = tcv.getContext('2d'); mg = mcv.getContext('2d');
    el.append(
      h('div', { class: 'mapside panel' },
        h('h3', null, 'Tileset'), h('div', { class: 'row' }, 'desenho ', tsSel), h('div', { class: 'hint' }, 'O tileset é um desenho seu, fatiado no tamanho do tile (menu Sprite → Tamanho do tile). Clique num tile; arraste pra pegar vários.'),
        h('div', { class: 'tswrap' }, tcv),
        h('h3', null, 'Camadas do mapa'), layerBox,
        h('h3', null, 'Tamanho'), h('div', { class: 'row' }, h('input', { type: 'number', id: 'mCols', value: M.cols, min: 4, max: 400, style: 'width:64px' }), '×', h('input', { type: 'number', id: 'mRows', value: M.rows, min: 4, max: 200, style: 'width:64px' }), h('button', { class: 'tb', onclick: () => resizeMap(+S.$('#mCols').value, +S.$('#mRows').value) }, 'Aplicar')),
        h('h3', null, 'Testar no jogo'), h('div', { class: 'row' }, 'personagem ', plSel), h('div', { class: 'row' }, 'céu ', h('select', { onchange: e => { M.bg = e.target.value; save(); } }, ...['dia', 'tarde', 'noite'].map(v => h('option', { value: v, selected: M.bg === v }, v)))),
        h('div', { class: 'row' }, h('button', { class: 'tb big green', onclick: play }, '▶ Testar no jogo')),
        h('div', { class: 'hint' }, 'Setas/A-D andam, Espaço/W/↑ pula, Shift corre, Esc sai. O personagem usa as tags "parado", "andar", "correr" e "pular" do desenho (crie com "O que é isso?").'),
        h('h3', null, 'Exportar'), h('div', { class: 'row' }, h('button', { class: 'tb', onclick: exportMap }, 'Mapa JSON + tileset PNG'))
      ),
      h('div', { class: 'mapmain' }, h('div', { class: 'toolbar' }, tools, h('span', { class: 'sp' }), h('button', { class: 'tb', onclick: () => { M.z = Math.max(1, M.z - 1); drawMap(); } }, '−'), h('button', { class: 'tb', onclick: () => { M.z = Math.min(8, M.z + 1); drawMap(); } }, '+'), h('button', { class: 'tb', onclick: () => { mapHist.undo(); } }, '↶ Desfazer')), h('div', { class: 'mapwrap' }, mcv))
    );
    refreshMapUI(); bindMap();
  };
  function refreshMapUI() {
    if (!root) return; const tsSel = S.$('#mTs'), plSel = S.$('#mPl');
    tsSel.innerHTML = ''; plSel.innerHTML = ''; S.docs.forEach(d => { tsSel.appendChild(h('option', { value: d.id, selected: d.id === M.tsId }, d.name + ' (' + d.w + '×' + d.h + ')')); plSel.appendChild(h('option', { value: d.id, selected: d.id === M.playerId }, d.name + (d.tags.length ? ' · ' + d.tags.map(t => t.name).join('/') : ''))); });
    if (!M.playerId && S.docs[0]) M.playerId = (S.docs.find(d => d.tags.length) || S.docs[0]).id;
    const lb = root.querySelector('.mlayers'); lb.innerHTML = '';
    M.layers.forEach((l, i) => lb.appendChild(h('div', { class: 'ly' + (i === M.L ? ' on' : ''), onclick: () => { M.L = i; refreshMapUI(); } }, h('span', { class: 'nm' }, l.name), h('label', { class: 'hint', onclick: e => e.stopPropagation() }, h('input', { type: 'checkbox', checked: !!l.solid, onchange: e => { l.solid = e.target.checked; save(); } }), ' sólido'))));
    buildTileset(); drawTs(); drawMap();
  }
  S.refreshMapUI = refreshMapUI;
  function resizeMap(c, r) { c = clamp(c | 0, 4, 400); r = clamp(r | 0, 4, 200); mapHist.push(); M.layers.forEach(l => { const d = new Int16Array(c * r).fill(-1); for (let y = 0; y < Math.min(r, M.rows); y++) for (let x = 0; x < Math.min(c, M.cols); x++) d[(y + (r - M.rows > 0 ? r - M.rows : 0)) * c + x] = l.data[y * M.cols + x]; l.data = d; }); M.cols = c; M.rows = r; drawMap(); save(); }
  const mapHist = { list: [], push() { this.list.push(M.layers.map(l => l.data.slice())); if (this.list.length > 80) this.list.shift(); }, undo() { const s = this.list.pop(); if (!s) return; M.layers.forEach((l, i) => l.data = s[i]); drawMap(); save(); } };

  const TSZ = 2;
  function drawTs() {
    if (!ts) { tcv.width = tcv.height = 10; return; } tcv.width = ts.cols * (ts.tw * TSZ + 1); tcv.height = ts.rows * (ts.th * TSZ + 1); tg.imageSmoothingEnabled = false; tg.fillStyle = '#e9e2d2'; tg.fillRect(0, 0, tcv.width, tcv.height);
    ts.tiles.forEach((t, i) => { const x = t.c * (ts.tw * TSZ + 1), y = t.r * (ts.th * TSZ + 1); tg.drawImage(t.cv, x, y, ts.tw * TSZ, ts.th * TSZ); });
    const st = M.stamp || { x: M.tile % ts.cols, y: Math.floor(M.tile / ts.cols), w: 1, h: 1 }; tg.strokeStyle = '#2E64B0'; tg.lineWidth = 2; tg.strokeRect(st.x * (ts.tw * TSZ + 1) + 1, st.y * (ts.th * TSZ + 1) + 1, st.w * (ts.tw * TSZ + 1) - 2, st.h * (ts.th * TSZ + 1) - 2);
  }
  function drawMap() {
    if (!mcv || !ts) return; const tw = ts.tw, th = ts.th, z = M.z; mcv.width = M.cols * tw * z; mcv.height = M.rows * th * z; mg.imageSmoothingEnabled = false;
    try { E.Nature.sky(mg, mcv.width, mcv.height, { tod: M.bg === 'noite' ? 0.95 : M.bg === 'tarde' ? 0.74 : 0.35, stars: true }); } catch (e) { mg.fillStyle = '#9FD3E8'; mg.fillRect(0, 0, mcv.width, mcv.height); }
    M.layers.forEach((l, li) => { mg.globalAlpha = li === M.L ? 1 : 0.85; for (let y = 0; y < M.rows; y++) for (let x = 0; x < M.cols; x++) { const t = l.data[y * M.cols + x]; if (t >= 0 && ts.tiles[t]) mg.drawImage(ts.tiles[t].cv, x * tw * z, y * th * z, tw * z, th * z); } });
    mg.globalAlpha = 1; mg.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x <= M.cols; x++) mg.fillRect(x * tw * z, 0, 1, mcv.height); for (let y = 0; y <= M.rows; y++) mg.fillRect(0, y * th * z, mcv.width, 1);
    if (mHover && ts) { mg.strokeStyle = '#fff'; const st = M.stamp || { w: 1, h: 1 }; mg.strokeRect(mHover[0] * tw * z + .5, mHover[1] * th * z + .5, st.w * tw * z, st.h * th * z); }
  }
  let mHover = null;
  function bindMap() {
    let tdown = null;
    tcv.onpointerdown = e => { if (!ts) return; const r = tcv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * tcv.width / (ts.tw * TSZ + 1)), y = Math.floor((e.clientY - r.top) / r.height * tcv.height / (ts.th * TSZ + 1)); tdown = [x, y]; M.tile = y * ts.cols + x; M.stamp = null; drawTs(); };
    tcv.onpointermove = e => { if (!tdown || !ts) return; const r = tcv.getBoundingClientRect(), x = clamp(Math.floor((e.clientX - r.left) / r.width * tcv.width / (ts.tw * TSZ + 1)), 0, ts.cols - 1), y = clamp(Math.floor((e.clientY - r.top) / r.height * tcv.height / (ts.th * TSZ + 1)), 0, ts.rows - 1); M.stamp = { x: Math.min(x, tdown[0]), y: Math.min(y, tdown[1]), w: Math.abs(x - tdown[0]) + 1, h: Math.abs(y - tdown[1]) + 1 }; drawTs(); };
    tcv.onpointerup = () => { tdown = null; if (M.stamp && M.stamp.w === 1 && M.stamp.h === 1) M.stamp = null; };
    let down = false, start = null;
    const cell = e => { const r = mcv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * M.cols), Math.floor((e.clientY - r.top) / r.height * M.rows)]; };
    const put = (x, y, erase) => { const d = M.layers[M.L].data; if (erase || M.tool === 'erase') { if (x >= 0 && y >= 0 && x < M.cols && y < M.rows) d[y * M.cols + x] = -1; return; } const st = M.stamp || { x: M.tile % ts.cols, y: Math.floor(M.tile / ts.cols), w: 1, h: 1 }; for (let j = 0; j < st.h; j++) for (let i = 0; i < st.w; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < M.cols && Y < M.rows) d[Y * M.cols + X] = (st.y + j) * ts.cols + st.x + i; } };
    mcv.oncontextmenu = e => e.preventDefault();
    mcv.onpointerdown = e => { if (!ts) return; mcv.setPointerCapture(e.pointerId); const [x, y] = cell(e); mapHist.push(); down = true; start = [x, y];
      if (M.tool === 'pick') { const t = M.layers[M.L].data[y * M.cols + x]; if (t >= 0) { M.tile = t; M.stamp = null; drawTs(); } down = false; return; }
      if (M.tool === 'fill') { const d = M.layers[M.L].data, t0 = d[y * M.cols + x], st = [x, y], nt = e.button === 2 ? -1 : M.tile; if (t0 === nt) { down = false; return; } while (st.length) { const b = st.pop(), a = st.pop(); if (a < 0 || b < 0 || a >= M.cols || b >= M.rows || d[b * M.cols + a] !== t0) continue; d[b * M.cols + a] = nt; st.push(a + 1, b, a - 1, b, a, b + 1, a, b - 1); } drawMap(); save(); down = false; return; }
      if (M.tool !== 'rect') { put(x, y, e.button === 2); drawMap(); } };
    mcv.onpointermove = e => { const [x, y] = cell(e); mHover = [x, y]; if (down && (M.tool === 'pen' || M.tool === 'erase')) put(x, y, e.buttons === 2); drawMap(); };
    mcv.onpointerup = e => { if (!down) return; down = false; if (M.tool === 'rect') { const [x, y] = cell(e); for (let j = Math.min(y, start[1]); j <= Math.max(y, start[1]); j++) for (let i = Math.min(x, start[0]); i <= Math.max(x, start[0]); i++) { const st = M.stamp; M.stamp = null; put(i, j, e.button === 2); M.stamp = st; } } drawMap(); save(); };
    mcv.onpointerleave = () => { mHover = null; drawMap(); };
  }
  function exportMap() { if (!ts) return; const cv = S.toCanvas(S.compose(ts.doc, 0, { skipRef: true }), ts.doc.w, ts.doc.h); cv.toBlob(b => S.dlBlob(b, 'tileset.png')); S.dlText(JSON.stringify({ app: 'Pixxel Estúdio', tile: { w: ts.tw, h: ts.th }, cols: M.cols, rows: M.rows, tileset: { image: 'tileset.png', cols: ts.cols, rows: ts.rows }, layers: M.layers.map(l => ({ name: l.name, solid: !!l.solid, data: Array.from(l.data) })) }), 'mapa.json'); }

  /* ---------------- Testar no jogo ---------------- */
  function play() {
    if (!ts) return S.toast('Escolha um tileset');
    const pdoc = S.docs.find(d => d.id === M.playerId) || S.curDoc();
    // registra o personagem na engine exatamente como um jogo faria
    const { canvas } = S.buildSheet(pdoc, { layout: 'linha' }); const anims = {}; pdoc.tags.forEach(t => anims[t.name] = { from: t.from, to: t.to, dir: 'forward' });
    E.Assets.add('_jogador', { img: canvas.toDataURL(), w: pdoc.w, h: pdoc.h, frames: pdoc.frames.map(f => f.dur), anims });
    const ov = h('div', { class: 'playov' }), cv = h('canvas', { width: 480, height: 270 }), hint = h('div', { class: 'playhint' }, 'Setas andam · Espaço pula · Shift corre · Esc sai');
    ov.append(cv, hint, h('button', { class: 'tb playx', onclick: () => stop() }, 'Sair (Esc)')); document.body.appendChild(ov);
    const g = cv.getContext('2d'), tw = ts.tw, th = ts.th, solidL = M.layers.filter(l => l.solid);
    const solid = (px, py) => { const x = Math.floor(px / tw), y = Math.floor(py / th); if (x < 0 || x >= M.cols) return true; if (y < 0) return false; if (y >= M.rows) return true; return solidL.some(l => l.data[y * M.cols + x] >= 0); };
    // nasce no primeiro espaço livre do alto à esquerda
    const bb = S.bboxOf(S.compose(pdoc, 0, { skipRef: true }), pdoc.w, pdoc.h) || { x: 0, y: 0, w: pdoc.w, h: pdoc.h };
    const P = { x: tw * 2, y: th * 2, vx: 0, vy: 0, w: Math.max(4, bb.w * 0.6), h: Math.max(4, bb.h), ground: false, anim: E.Anim('_jogador', 'parado') };
    const kome = { x: P.x - 30, y: P.y, vx: 0, vy: 0, t: 0, pose: 'sit' };
    const keys = {}; const kd = e => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape') stop(); if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault(); }, ku = e => { keys[e.key.toLowerCase()] = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    let raf = 0, last = performance.now(), camX = 0, camY = 0;
    const collideX = (o, dx) => { o.x += dx; const top = o.y - o.h + 2, bot = o.y - 1; for (const yy of [top, (top + bot) / 2, bot]) { if (dx > 0 && solid(o.x + o.w / 2, yy)) { o.x = Math.floor((o.x + o.w / 2) / tw) * tw - o.w / 2 - 0.01; o.vx = 0; } if (dx < 0 && solid(o.x - o.w / 2, yy)) { o.x = (Math.floor((o.x - o.w / 2) / tw) + 1) * tw + o.w / 2 + 0.01; o.vx = 0; } } };
    const collideY = (o, dy) => { o.y += dy; o.ground = false; for (const xx of [o.x - o.w / 2 + 1, o.x, o.x + o.w / 2 - 1]) { if (dy >= 0 && solid(xx, o.y)) { o.y = Math.floor(o.y / th) * th; o.vy = 0; o.ground = true; } if (dy < 0 && solid(xx, o.y - o.h)) { o.y = (Math.floor((o.y - o.h) / th) + 1) * th + o.h; o.vy = 0; } } };
    function step(now) {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      const run = keys.shift, L = keys.arrowleft || keys.a, R = keys.arrowright || keys.d, J = keys[' '] || keys.arrowup || keys.w;
      const sp = run ? 150 : 80; P.vx += ((R ? sp : 0) - (L ? sp : 0) - P.vx) * Math.min(1, dt * 12);
      if (J && P.ground) { P.vy = -Math.sqrt(2 * 600 * (th * 3.2)); P.ground = false; }
      P.vy = Math.min(600, P.vy + 600 * dt); collideX(P, P.vx * dt); collideY(P, P.vy * dt);
      if (P.y > (M.rows + 4) * th) { P.x = tw * 2; P.y = th * 2; P.vy = 0; }
      if (Math.abs(P.vx) > 4) P.anim.flip = P.vx < 0 ? !(pdoc.meta && pdoc.meta.olhaEsq) : !!(pdoc.meta && pdoc.meta.olhaEsq);
      const has = n => pdoc.tags.some(t => t.name === n);
      const want = !P.ground ? (has('pular') ? 'pular' : 'parado') : Math.abs(P.vx) > 110 && has('correr') ? 'correr' : Math.abs(P.vx) > 10 ? (has('andar') ? 'andar' : 'parado') : 'parado';
      P.anim.play(want); P.anim.update(dt);
      // Kome segue
      const dx = P.x - 26 * Math.sign(P.vx || 1) - kome.x; kome.vx += (clamp(dx * 3, -150, 150) - kome.vx) * Math.min(1, dt * 6); kome.vy = Math.min(600, kome.vy + 600 * dt); kome.w = 20; kome.h = 26; collideX(kome, kome.vx * dt); collideY(kome, kome.vy * dt); if (kome.ground && Math.abs(dx) > 40 && Math.abs(kome.vx) < 20) kome.vy = -260; kome.t += dt; kome.pose = !kome.ground ? 'jump' : Math.abs(kome.vx) > 70 ? 'run' : Math.abs(kome.vx) > 12 ? 'walk' : 'wag';
      if (kome.y > (M.rows + 4) * th) { kome.x = P.x; kome.y = P.y - 20; }
      camX += (clamp(P.x - cv.width / 2, 0, Math.max(0, M.cols * tw - cv.width)) - camX) * Math.min(1, dt * 6); camY += (clamp(P.y - cv.height * 0.6, 0, Math.max(0, M.rows * th - cv.height)) - camY) * Math.min(1, dt * 6);
      // desenho
      g.imageSmoothingEnabled = false; const tod = M.bg === 'noite' ? 0.95 : M.bg === 'tarde' ? 0.74 : 0.35;
      try { E.Nature.sky(g, cv.width, cv.height, { tod, t: now / 1000 }); E.Nature.hills(g, cv.width, cv.height - 30, camX, { seed: 4, amp: 30, haze: 0.5, tod, parallax: 0.25 }); } catch (e) { g.fillStyle = '#9FD3E8'; g.fillRect(0, 0, cv.width, cv.height); }
      g.save(); g.translate(-Math.round(camX), -Math.round(camY));
      const x0 = Math.max(0, Math.floor(camX / tw)), x1 = Math.min(M.cols, Math.ceil((camX + cv.width) / tw) + 1), y0 = Math.max(0, Math.floor(camY / th)), y1 = Math.min(M.rows, Math.ceil((camY + cv.height) / th) + 1);
      const drawL = l => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const t = l.data[y * M.cols + x]; if (t >= 0 && ts.tiles[t]) g.drawImage(ts.tiles[t].cv, x * tw, y * th); } };
      M.layers.slice(0, 2).forEach(drawL);
      try { E.drawShiba(g, kome.x, kome.y, kome.pose, kome.t, { face: kome.vx < -5 ? -1 : 1, scale: 1 }); } catch (e) { }
      P.anim.draw(g, P.x, P.y + (pdoc.h - (bb.y + bb.h)));
      M.layers.slice(2).forEach(drawL);
      g.restore();
      try { if (tod > 0.6) E.Nature.grade(g, cv.width, cv.height, { tod, horizon: cv.height - 30 }); } catch (e) { }
      raf = requestAnimationFrame(step);
    }
    function stop() { cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); ov.remove(); }
    E.Assets.whenReady(() => { raf = requestAnimationFrame(step); });
  }
  S.playMap = play;
  S.store.kvGet('map').then(o => { if (o) S.mapLoad(o); }).catch(() => { });
})();
