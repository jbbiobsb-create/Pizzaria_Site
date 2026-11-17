/* ==========================================================================
   Pixxel Estúdio — library.js
   Biblioteca: Fábrica (receitas procedurais), Kome em todas as poses (animado),
   cenário do jogo (Nature) e pacotes convertidos. Abre como desenho novo ou
   cola como camada no desenho aberto.
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, E = S.E, { h, clamp } = S;
  const TP = E.TEXT_PAL;

  // letras -> RGBA (com estilo Kome assado: contorno + luz)
  function lettersToBuf(rows, kome) {
    const H = rows.length, W = Math.max(...rows.map(r => r.length)), b = new Uint32Array(W * H);
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = TP[r[x]]; if (c) b[y * W + x] = S.hex2c(c); } });
    if (!kome) return { buf: b, w: W, h: H };
    const cv = S.komeStyle(b, W, H); return { buf: S.fromCanvas(cv), w: cv.width, h: cv.height };
  }
  S.lettersToBuf = lettersToBuf;
  function cropCanvas(cv) { const b = S.fromCanvas(cv), bb = S.bboxOf(b, cv.width, cv.height); if (!bb) return null; const o = new Uint32Array(bb.w * bb.h); for (let y = 0; y < bb.h; y++) for (let x = 0; x < bb.w; x++) o[y * bb.w + x] = b[(bb.y + y) * cv.width + bb.x + x]; return { buf: o, w: bb.w, h: bb.h }; }
  const canvasOf = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };

  // abre lista de quadros ({buf,w,h}) como desenho novo, com tags opcionais
  function openFrames(frames, name, o) {
    o = o || {}; const W = Math.max(...frames.map(f => f.w)) + (o.pad != null ? o.pad : 4) * 2, H = Math.max(...frames.map(f => f.h)) + (o.pad != null ? o.pad : 4);
    const place = f => { const c = new Uint32Array(W * H), ox = Math.floor((W - f.w) / 2), oy = H - f.h; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) c[(oy + y) * W + ox + x] = f.buf[y * f.w + x]; return c; };
    if (o.asLayer) { const d = S.getDoc(); if (W > d.w || H > d.h) S.ops.resize(Math.max(d.w, W), Math.max(d.h, H), 'bm'); const d2 = S.getDoc(); const cels = d2.frames.map((_, i) => { const f = frames[i % frames.length], c = new Uint32Array(d2.w * d2.h), ox = Math.floor((d2.w - f.w) / 2), oy = d2.h - f.h; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) c[(oy + y) * d2.w + ox + x] = f.buf[y * f.w + x]; return c; }); S.ops.addLayer(name, cels); S.toast('Colado como camada: ' + name); return; }
    const d = S.newDoc(W, H, { name }); d.frames = frames.map(() => ({ dur: o.dur || 100 })); d.layers = [S.newLayer('Fundo', { cels: frames.map(() => null) }), S.newLayer('Desenho', { cels: frames.map(place) })]; d.cur = { f: 0, l: 1 };
    if (o.tags) d.tags = o.tags; if (o.tipo) d.meta.tipo = o.tipo; d.tile = { w: 16, h: 16 }; S.openDoc(d); S.setWorkspace('draw');
  }
  S.openFrames = openFrames;

  /* ---------------- capturas da engine ---------------- */
  const POSE_PT = { sit: 'sentado', wag: 'abanando', lie: 'deitado', stand: 'em pé', walk: 'andando', run: 'correndo', jump: 'pulando', dig: 'cavando', sniff: 'farejando', surprise: 'surpreso', dizzy: 'tonto', sword: 'espada', swordrun: 'espada correndo', windup: 'preparando', slash: 'golpe', eat: 'comendo', pant: 'ofegante', roll: 'rolando', bow: 'reverência', stretch: 'espreguiçando', scratch: 'coçando', yawn: 'bocejando', howl: 'uivando', sleep: 'dormindo', dance: 'dançando', dance2: 'dança 2', shake: 'sacudindo', drive: 'dirigindo', push: 'empurrando', carry: 'carregando', cheer: 'comemorando', point: 'apontando', think: 'pensando', gasp: 'espantado', cry: 'chorando', proud: 'orgulhoso', climb: 'escalando', wave: 'acenando', sign: 'placa' };
  function shiba(pose, t, pal, scale) { const [c, g] = canvasOf(220, 180); E.drawShiba(g, 110, 160, pose, t, { scale: scale || 1, pal: pal || 'kome', shadow: false, exact: true }); return cropCanvas(c); }
  // quadros alinhados pelos pés (todos do mesmo tamanho)
  function shibaFrames(pose, pal, scale, n) { const [c, g] = canvasOf(220, 180), out = []; for (let k = 0; k < n; k++) { g.clearRect(0, 0, 220, 180); E.drawShiba(g, 110, 160, pose, 1 + k / 12, { scale: scale || 1, pal, shadow: false, exact: true }); out.push(S.fromCanvas(c)); } let bb = null; out.forEach(b => { const q = S.bboxOf(b, 220, 180); if (q) bb = bb ? { x: Math.min(bb.x, q.x), y: Math.min(bb.y, q.y), x2: Math.max(bb.x2, q.x + q.w), y2: Math.max(bb.y2, q.y + q.h) } : { x: q.x, y: q.y, x2: q.x + q.w, y2: q.y + q.h }; }); const w = bb.x2 - bb.x, hh = bb.y2 - bb.y; return out.map(b => { const o = new Uint32Array(w * hh); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) o[y * w + x] = b[(bb.y + y) * 220 + bb.x + x]; return { buf: o, w, h: hh }; }); }
  const N = () => E.Nature;
  const GAME = [
    ['Árvore pinheiro', (g, x, y) => N().tree(g, x, y, { kind: 'pine', shadow: false })], ['Árvore sakura', (g, x, y) => N().tree(g, x, y, { kind: 'sakura', shadow: false })], ['Árvore momiji', (g, x, y) => N().tree(g, x, y, { kind: 'maple', shadow: false })], ['Bambu', (g, x, y) => N().tree(g, x, y, { kind: 'bamboo', shadow: false })], ['Bonsai', (g, x, y) => N().tree(g, x, y, { kind: 'bonsai', shadow: false })], ['Árvore redonda', (g, x, y) => N().tree(g, x, y, { kind: 'round', shadow: false })],
    ['Moita', (g, x, y) => N().bush(g, x, y, { kind: 'bush', shadow: false })], ['Azaleia', (g, x, y) => N().bush(g, x, y, { kind: 'azalea', shadow: false })], ...['daisy', 'tulip', 'tanpopo', 'iris', 'higanbana', 'ajisai'].map((k, i) => [['Margarida', 'Tulipa', 'Dente-de-leão', 'Íris', 'Higanbana', 'Hortênsia'][i], (g, x, y) => N().flower(g, x, y, { kind: k, s: 2 })]),
    ['Pedra', (g, x, y) => N().rock(g, x, y, { w: 30, h: 18, shadow: false, s: 1.5 })], ['Pedra com musgo', (g, x, y) => N().rock(g, x, y, { w: 30, h: 18, moss: true, shadow: false, s: 1.5, seed: 3 })], ['Torii', (g, x, y) => N().torii(g, x, y, 1, { shadow: false })], ['Tōrō', (g, x, y) => N().lantern(g, x, y, 1.5, { lit: false, shadow: false })], ['Chōchin', (g, x) => N().chochin(g, x, 20, { s: 2 })], ['Barraquinha', (g, x, y) => N().stall(g, x, y, { lanterns: true })], ['Fūrin', (g, x) => N().windchime(g, x, 20, { s: 2 })], ['Nobori', (g, x, y) => N().nobori(g, x, y, {})], ['Koinobori', (g, x, y) => N().koinobori(g, x, y, { h: 104 })],
    ['Ponte', (g, x, y) => N().bridge(g, x - 70, y - 4, 140, { shadow: false })], ['Cerca de bambu', (g, x, y) => N().fence(g, x - 60, x + 60, y, { kind: 'bamboo' })], ['Cerca de madeira', (g, x, y) => N().fence(g, x - 60, x + 60, y, { kind: 'wood' })], ['Onsen', (g, x, y) => N().onsen(g, x, y, {})], ['Monte Fuji', (g, x, y) => N().fuji(g, x, y, 0.6, {})],
    ...[0, 1, 2, 3, 4, 5].map(st => ['Casa (etapa ' + st + ')', (g, x, y) => N().house(g, x, y, { stage: st, s: 0.8 })]),
  ];
  // cenário animado: vários quadros com t (vento, água)
  function natureFrames(fn, n) { const [c, g] = canvasOf(460, 340), out = []; for (let k = 0; k < n; k++) { g.clearRect(0, 0, 460, 340); N().tod = 0.35; fn(g, 230, 330, k * 0.25); out.push(S.fromCanvas(c)); } let bb = null; out.forEach(b => { const q = S.bboxOf(b, 460, 340); if (q) bb = bb ? { x: Math.min(bb.x, q.x), y: Math.min(bb.y, q.y), x2: Math.max(bb.x2, q.x + q.w), y2: Math.max(bb.y2, q.y + q.h) } : { x: q.x, y: q.y, x2: q.x + q.w, y2: q.y + q.h }; }); if (!bb) return []; const w = bb.x2 - bb.x, hh = bb.y2 - bb.y; return out.map(b => { const o = new Uint32Array(w * hh); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) o[y * w + x] = b[(bb.y + y) * 460 + bb.x + x]; return { buf: o, w, h: hh }; }); }

  /* ---------------- janela ---------------- */
  let tab = 'fab', fab = { cat: 'tudo', rec: null, size: 'M', col: null, face: null, seed: 1, n: 24, kome: true }, kopt = { pal: 'kome', anim: true, scale: 1 }, packSel = null;
  S.openLibrary = function (startTab) {
    if (startTab) tab = startTab;
    const ov = h('div', { class: 'ov' }), box = h('div', { class: 'dlg lib' }), body = h('div', { class: 'libbody' }), tabs = h('div', { class: 'chips' });
    const close = () => ov.remove();
    const TABS = { fab: 'Fábrica', jogo: 'Coisas do jogo Kome', kome: 'Kome', cen: 'Cenário (engine)', pac: 'Pacotes convertidos' };
    Object.entries(TABS).forEach(([k, v]) => tabs.appendChild(h('button', { class: 'chip' + (k === tab ? ' on' : ''), onclick: () => { tab = k; [...tabs.children].forEach(c => c.classList.toggle('on', c.textContent === v)); render(); } }, v)));
    box.append(h('div', { class: 'dhead' }, h('b', null, 'Biblioteca'), tabs, h('button', { class: 'ib', onclick: close }, '×')), body); ov.appendChild(box); ov.onclick = e => { if (e.target === ov) close(); }; document.body.appendChild(ov);
    const card = (cv, name, acts) => { const k = clamp(Math.floor(96 / Math.max(cv.width, cv.height)), 1, 6); const c2 = S.scaleCv(cv, Math.max(1, k)); const d = h('div', { class: 'gitem' }, c2, h('div', { class: 'nm' }, name), h('div', { class: 'row' }, ...acts.map(([t, fn]) => h('button', { class: 'tb', onclick: () => { fn(); if (t !== '★') close(); } }, t)))); c2.onclick = () => { acts[0][1](); close(); }; return d; };
    function render() {
      body.innerHTML = ''; const opts = h('div', { class: 'libopts' }), gal = h('div', { class: 'gal' }); body.append(opts, gal);
      if (tab === 'jogo') { S.renderGameLib(opts, gal, card, close, render); return; }
      if (tab === 'fab') {
        const F = E.Fab, cats = [['tudo', 'Tudo']].concat(Object.entries(F.CATS));
        const chips = (items, cur, fn) => h('div', { class: 'chips' }, ...items.map(([k, v]) => h('button', { class: 'chip' + (k === cur ? ' on' : ''), onclick: () => { fn(k); render(); } }, v)));
        F.SIZES.GG = 2.2; F.SIZES.XG = 3.4; F.SIZES.XXG = 5;
        opts.append(chips(cats, fab.cat, k => { fab.cat = k; fab.rec = null; }), chips([[null, 'Surpresa']].concat(F.list().filter(r => fab.cat === 'tudo' || r.cat === fab.cat).map(r => [r.id, r.nome])), fab.rec, k => fab.rec = k),
          h('div', { class: 'row' }, 'tamanho ', chips([['P', 'P'], ['M', 'M'], ['G', 'G'], ['GG', 'Gigante'], ['XG', 'Enorme'], ['XXG', 'Colossal']], fab.size, k => fab.size = k), ' rostinho ', chips([[null, 'às vezes'], [true, 'sempre'], [false, 'nunca']], fab.face, k => fab.face = k)),
          h('div', { class: 'row' }, 'semente ', h('input', { type: 'number', value: fab.seed, style: 'width:80px', onchange: e => fab.seed = +e.target.value || 1 }), h('button', { class: 'tb', onclick: () => { fab.seed = 1 + Math.floor(Math.random() * 99999); render(); } }, 'Sortear'), h('button', { class: 'tb', onclick: () => { fab.seed += fab.n; render(); } }, 'Próximo lote'), h('label', null, h('input', { type: 'checkbox', checked: fab.kome, onchange: e => { fab.kome = e.target.checked; render(); } }), ' contorno Kome')));
        const pool = F.list().filter(r => fab.cat === 'tudo' || r.cat === fab.cat), rr = F.rng(fab.seed * 31 + 7);
        for (let i = 0; i < fab.n; i++) {
          const rec = fab.rec ? F.R[fab.rec] : rr.pick(pool); let it; try { it = F.make(rec.id, fab.seed + i, { size: fab.size, face: fab.face, col: fab.col }); } catch (e) { continue; }
          const fr = lettersToBuf(it.rows, fab.kome), cv = S.toCanvas(fr.buf, fr.w, fr.h), tipo = { bichos: 'bicho', comidas: 'comida', plantas: 'planta', objetos: 'objeto', construcoes: 'construção' }[rec.cat];
          gal.appendChild(card(cv, it.nome + ' #' + it.seed + ' · ' + fr.w + '×' + fr.h, [['Abrir', () => openFrames([fr], it.nome + ' ' + it.seed, { tipo })], ['Por cima', () => openFrames([fr], it.nome, { asLayer: true })]]));
        }
      } else if (tab === 'kome') {
        const pals = E.PALS ? Object.keys(E.PALS) : ['kome'];
        opts.append(h('div', { class: 'row' }, 'pelagem ', h('select', { onchange: e => { kopt.pal = e.target.value; render(); } }, ...pals.map(p => h('option', { selected: p === kopt.pal }, p))), h('label', null, h('input', { type: 'checkbox', checked: kopt.anim, onchange: e => kopt.anim = e.target.checked }), ' abrir animado (8 quadros)'), ' tamanho ', h('select', { onchange: e => { kopt.scale = +e.target.value; render(); } }, ...[1, 2, 3].map(k => h('option', { value: k, selected: k === kopt.scale }, k + '×')))), h('div', { class: 'row' }, h('button', { class: 'tb green', onclick: () => { const all = ['sit', 'walk', 'run', 'jump', 'wag', 'sleep', 'eat', 'dance']; const frames = [], tags = []; all.forEach(p => { const fs = shibaFrames(p, kopt.pal, kopt.scale, 6); tags.push({ name: POSE_PT[p], from: frames.length, to: frames.length + fs.length - 1, dir: 'frente', cor: S.tagColor(tags.length) }); frames.push(...fs); }); const W = Math.max(...frames.map(f => f.w)), H = Math.max(...frames.map(f => f.h)); openFrames(frames.map(f => ({ buf: (() => { const c = new Uint32Array(W * H); for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) c[(H - f.h + y) * W + Math.floor((W - f.w) / 2) + x] = f.buf[y * f.w + x]; return c; })(), w: W, h: H })), 'Kome completo', { tags, tipo: 'personagem', dur: 90 }); close(); } }, 'Abrir o Kome com 8 animações (tags prontas)')));
        let i = 0; const poses = Object.keys(POSE_PT); const step = () => { for (let n = 0; n < 6 && i < poses.length; n++, i++) { const p = poses[i]; let r; try { r = shiba(p, 1.3, kopt.pal, kopt.scale); } catch (e) { r = null; } if (!r) continue; gal.appendChild(card(S.toCanvas(r.buf, r.w, r.h), 'Kome ' + POSE_PT[p], [['Abrir', () => { const fs = kopt.anim ? shibaFrames(p, kopt.pal, kopt.scale, 8) : [r]; openFrames(fs, 'Kome ' + POSE_PT[p], { tags: kopt.anim ? [{ name: POSE_PT[p], from: 0, to: fs.length - 1, dir: 'frente', cor: S.tagColor(0) }] : [], tipo: 'personagem', dur: 90 }); }], ['Por cima', () => openFrames(kopt.anim ? shibaFrames(p, kopt.pal, kopt.scale, 8) : [r], 'Kome ' + POSE_PT[p], { asLayer: true })]])); } if (i < poses.length && tab === 'kome' && document.body.contains(gal)) requestAnimationFrame(step); }; step();
      } else if (tab === 'cen') {
        opts.append(h('div', { class: 'hint' }, 'Peças do cenário do jogo, desenhadas pela engine. As que têm vento abrem animadas (6 quadros).'));
        let i = 0; const step = () => { for (let n = 0; n < 3 && i < GAME.length; n++, i++) { const [nm, fn] = GAME[i]; let fr; try { fr = natureFrames((g, x, y, t) => fn(g, x, y, t), 1)[0]; } catch (e) { fr = null; } if (!fr) continue; gal.appendChild(card(S.toCanvas(fr.buf, fr.w, fr.h), nm + ' · ' + fr.w + '×' + fr.h, [['Abrir', () => { let fs; try { fs = natureFrames((g, x, y, t) => { const old = E.Nature.wind; fn(g, x, y, t); }, 1); } catch (e) { fs = [fr]; } openFrames(fs, nm, { tipo: 'enfeite' }); }], ['Por cima', () => openFrames([fr], nm, { asLayer: true })]])); } if (i < GAME.length && tab === 'cen' && document.body.contains(gal)) requestAnimationFrame(step); }; step();
      } else {
        const P = E.PACKS || []; if (!P.length) { gal.appendChild(h('div', { class: 'hint' }, 'Nenhum pacote embutido nesta versão.')); return; }
        const packs = [...new Set(P.map(p => p.pack))]; if (!packSel) packSel = packs[0];
        opts.append(h('div', { class: 'chips' }, ...packs.map(pk => h('button', { class: 'chip' + (pk === packSel ? ' on' : ''), onclick: () => { packSel = pk; render(); } }, pk + ' (' + P.filter(p => p.pack === pk).length + ')'))), h('div', { class: 'hint' }, 'Convertidos pra paleta e contorno do Kome. Uso só nos seus jogos — não redistribua os assets.'));
        const list = P.filter(p => p.pack === packSel); let i = 0;
        const unrle = (s, n) => { const LET = Object.keys(TP), CH = ['.'].concat(LET), IDX = {}; LET.forEach((l, k) => IDX[l] = k + 1); const c = []; let num = ''; for (const ch of s) { if (ch >= '0' && ch <= '9') { num += ch; continue; } const k = num ? +num : 1; for (let q = 0; q < k; q++) c.push(ch); num = ''; } return c.join(''); };
        const step = () => { for (let n = 0; n < 8 && i < list.length; n++, i++) { const it = list[i]; const frames = it.frames.map(f => { const s = unrle(f, it.W * it.H), rows = []; for (let y = 0; y < it.H; y++) rows.push(s.slice(y * it.W, (y + 1) * it.W)); return lettersToBuf(rows, true); }); gal.appendChild(card(S.toCanvas(frames[0].buf, frames[0].w, frames[0].h), it.nome + (frames.length > 1 ? ' · ' + frames.length + 'q' : ''), [['Abrir', () => openFrames(frames, it.nome)], ['Por cima', () => openFrames(frames, it.nome, { asLayer: true })]])); } if (i < list.length && tab === 'pac' && document.body.contains(gal)) requestAnimationFrame(step); }; step();
      }
    }
    render();
  };
})();
