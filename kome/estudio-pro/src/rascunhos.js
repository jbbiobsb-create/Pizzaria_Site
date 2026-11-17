/* ==========================================================================
   Pixxel Estúdio — rascunhos.js
   Caixa de rascunhos prontos (como o "Novo documento" do Photoshop):
   escolha o que quer e ele abre com as CAMADAS separadas e nomeadas, as
   animações com tags e o tipo pro jogo — pronto pra retocar e exportar.
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, E = S.E, { h } = S;
  const B = () => S.Builders, C = () => S.Creature;

  // casa/castelo em camadas: cada etapa do construtor vira uma camada (Paredes, Telhado, Portas e janelas, Detalhes)
  function openCasaLayered(preset, extra) {
    const CASA = B().casa, pr = Object.assign({ res: 1 }, CASA.presets[preset], extra || {}), names = ['Paredes', 'Telhado', 'Portas e janelas', 'Detalhes'];
    const tags = CASA.anims(pr), frames = []; tags.forEach(([t, n]) => { for (let k = 0; k < n; k++) frames.push([t, k]); });
    const full = frames.map(([t, k]) => CASA.draw(pr, t, k)), W = Math.max(...full.map(f => f.w)), Hh = Math.max(...full.map(f => f.h));
    const fit = b => { const o = new Uint32Array(W * Hh), ox = Math.floor((W - b.w) / 2), oy = Hh - b.h; for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) o[(oy + y) * W + ox + x] = b.buf[y * b.w + x]; return o; };
    const stageBufs = names.map((_, si) => frames.map(([t, k]) => fit(CASA.draw(Object.assign({}, pr, { _stage: si + 1 }), t, k))));
    const layers = names.map((nm, si) => S.newLayer(nm, { cels: frames.map((_, fi) => { const cur = stageBufs[si][fi], prev = si ? stageBufs[si - 1][fi] : null, o = new Uint32Array(W * Hh); let any = false; for (let q = 0; q < o.length; q++) if ((cur[q] >>> 24) && (!prev || cur[q] !== prev[q])) { o[q] = cur[q]; any = true; } return any ? o : null; }) }));
    // última etapa = desenho completo (inclui contorno/luz finais): diferença final vai pra "Detalhes"
    frames.forEach((fr, fi) => { const fullB = fit(full[fi]), comp = new Uint32Array(W * Hh); layers.forEach(L => { const c = L.cels[fi]; if (c) for (let q = 0; q < c.length; q++) if (c[q] >>> 24) comp[q] = c[q]; }); const det = layers[3].cels[fi] || new Uint32Array(W * Hh); let any = false; for (let q = 0; q < comp.length; q++) if (fullB[q] !== comp[q]) { det[q] = fullB[q]; any = true; } if (any) layers[3].cels[fi] = det; });
    let from = 0; const T = tags.map(([t, n], i) => { const tg = { name: t, from, to: from + n - 1, dir: 'frente', cor: S.tagColor(i) }; from += n; return tg; });
    const d = S.newDoc(W, Hh, { name: preset }); d.frames = frames.map(() => ({ dur: 200 })); d.layers = layers.concat([S.newLayer('Retoques', { cels: frames.map(() => null) })]); d.cur = { f: 0, l: d.layers.length - 1 }; d.tags = T;
    d.meta = { tipo: 'construção', builder: 'casa', params: pr, altura: Hh }; const set = new Set(); full.forEach(f => f.buf.forEach(v => { if (v >>> 24) set.add(v >>> 0); })); d.pal = [...set].slice(0, 96); d.tile = { w: 16, h: 16 };
    S.openDoc(d); S.setWorkspace('draw'); S.toast(preset + ': camadas Paredes / Telhado / Portas e janelas / Detalhes'); return d;
  }
  S.openCasaLayered = openCasaLayered;
  function openBuilderDoc(id, preset) { // máquina, props, chão: 1 camada + Retoques, com tags
    const Bd = B()[id], p = Object.assign({ res: 1 }, Bd.presets[preset]), anims = Bd.anims(p), raw = [], tags = []; let W = 0, Hh = 0;
    anims.forEach(([t, n], ti) => { const from = raw.length; for (let k = 0; k < n; k++) { const r = Bd.draw(p, t, k); raw.push(r); W = Math.max(W, r.w); Hh = Math.max(Hh, r.h); } tags.push({ name: t, from, to: raw.length - 1, dir: 'frente', cor: S.tagColor(ti) }); });
    const frames = raw.map(r => { const c = new Uint32Array(W * Hh), ox = Math.floor((W - r.w) / 2), oy = Hh - r.h; for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) c[(oy + y) * W + ox + x] = r.buf[y * r.w + x]; return c; });
    const d = S.newDoc(W, Hh, { name: preset }); d.frames = frames.map(() => ({ dur: Bd.tile ? 220 : 110 })); d.layers = [S.newLayer(Bd.nome, { cels: frames }), S.newLayer('Retoques', { cels: frames.map(() => null) })]; d.cur = { f: 0, l: 1 }; d.tags = tags;
    if (Bd.tile) { d.tile = { w: +p.tile, h: +p.tile }; if (S.map) S.map.tsId = d.id; }
    d.meta = { tipo: id === 'maquina' ? 'veículo' : 'enfeite', builder: id, params: p, altura: Hh }; S.openDoc(d); S.setWorkspace('draw'); return d;
  }
  function foodDoc(id, seed, size) { const it = E.Fab.make(id, seed, { size: size || 'GG', face: true }), fr = S.lettersToBuf(it.rows, true); S.openFrames([fr], it.nome, { tipo: 'comida' }); const d = S.getDoc(); d.layers[0].name = 'Fundo'; d.layers[1].name = 'Comida'; S.ops.addLayer('Retoques'); }

  /* ---------------- catálogo ---------------- */
  function catalog() {
    const L = [];
    const add = (cat, nome, info, thumb, open, sub) => L.push({ cat, nome, info, thumb, open, sub });
    const sp = C().SPECIES;
    Object.keys(sp).forEach(id => {
      add('Animais', sp[id].nome, '9 animações · camadas: Contorno, Rabo, Pernas, Corpo, Cabeça, Rosto, Retoques', () => C().render({ especie: id, res: 1, cores: {} }, 'parado', 0), () => S.openCreatureDoc({ especie: id, res: 1, acessorio: 'nenhum', cores: {} }), '1× (tamanho do Kome)');
      add('Animais HD', sp[id].nome + ' 2×', 'o dobro de detalhe · 9 animações em camadas', () => C().render({ especie: id, res: 2, cores: {} }, 'sentar', 1), () => S.openCreatureDoc({ especie: id, res: 2, acessorio: 'nenhum', cores: {} }, null, sp[id].nome.split(' (')[0] + ' HD'));
    });
    const pals = E.PALS || {}; Object.keys(pals).forEach(k => { const p = pals[k], par = { especie: 'cachorro', res: 1, acessorio: 'kasa', corAcessorio: p.h, cores: { pelo: p.o, creme: p.c, olho: p.k, nariz: p.n, lingua: p.p } }; add('Kome', 'Kome ' + k, 'o Kome com a pelagem "' + k + '" · 9 animações em camadas', () => C().render(par, 'sentar', 0), () => S.openCreatureDoc(par, null, 'Kome ' + k)); });
    const CP = B().casa.presets; Object.keys(CP).forEach(n => { const isC = /Castelo|Templo/.test(n); add(isC ? 'Castelos e templos' : 'Casas', n, 'camadas: Paredes, Telhado, Portas e janelas, Detalhes · dia/noite', () => B().casa.draw(Object.assign({ res: 1 }, CP[n]), 'dia', 0), () => openCasaLayered(n)); });
    [1, 7, 21, 42].forEach((sd, i) => add('Vilas e cenários', 'Vila ' + (i + 1), 'cena com céu, morros, castelo, casas, árvores, torii e postes — cada um numa camada · dia/noite', () => B().casa.draw(Object.assign({ res: 1 }, CP['Casa japonesa']), 'dia', 0), () => S.openVila({ seed: sd, castelo: i % 2 === 0, largura: i === 3 ? 768 : 480 })));
    ['onigiri', 'dango', 'tigela', 'sushi', 'fruta', 'doce'].forEach(id => [3, 8, 15].forEach(sd => add('Comida', E.Fab.R[id].nome + ' #' + sd, 'comida fofa com carinha · camadas Comida + Retoques', () => S.lettersToBuf(E.Fab.make(id, sd, { size: 'G', face: true }).rows, true), () => foodDoc(id, sd))));
    Object.keys(B().maquina.presets).forEach(n => add('Máquinas', n, 'parado, andar e trabalho', () => B().maquina.draw(Object.assign({ res: 1 }, B().maquina.presets[n]), 'parado', 0), () => openBuilderDoc('maquina', n)));
    Object.keys(B().props.presets).forEach(n => add('Rua e objetos', n, 'pronto pra pôr na rua', () => B().props.draw(Object.assign({ res: 1 }, B().props.presets[n]), B().props.anims(B().props.presets[n])[0][0], 0), () => openBuilderDoc('props', n)));
    Object.keys(B().chao.presets).forEach(n => add('Rua e objetos', 'Tileset ' + n, 'chão que emenda — já vai pro Mapa', () => B().chao.draw(Object.assign({}, B().chao.presets[n]), 'parado', 0), () => openBuilderDoc('chao', n)));
    ['onigiri', 'mochi', 'gato', 'passaro', 'peixe', 'sapo', 'coelho', 'fantasma', 'arvore', 'vaso', 'cogumelo', 'pocao', 'bau', 'lanterna', 'moeda', 'cristal', 'espada', 'chave', 'livro', 'sino', 'torii', 'barraca', 'toro'].forEach(id => { if (!E.Fab.R[id]) return; add('Fábrica (pequenos)', E.Fab.R[id].nome, 'sprite pequeno estilo Kome', () => S.lettersToBuf(E.Fab.make(id, 5, { size: 'G' }).rows, true), () => { S.openFrames([S.lettersToBuf(E.Fab.make(id, 5, { size: 'GG' }).rows, true)], E.Fab.R[id].nome); }); });
    (E.PACKS || []).filter(p => /Personagens|Bichos|Sushi/.test(p.pack)).forEach(p => add('Base dos pacotes', p.nome, p.pack + ' · ' + p.frames.length + ' quadro(s) · use como base', () => packBuf(p, 0), () => S.openFrames(p.frames.map((_, i) => packBuf(p, i)), p.nome)));
    return L;
  }
  function packBuf(p, i) { const TP = E.TEXT_PAL; const s2 = (() => { const c = []; let num = ''; for (const ch of p.frames[i]) { if (ch >= '0' && ch <= '9') { num += ch; continue; } const k = num ? +num : 1; for (let q = 0; q < k; q++) c.push(ch); num = ''; } return c.join(''); })(); const rows = []; for (let y = 0; y < p.H; y++) rows.push(s2.slice(y * p.W, (y + 1) * p.W)); return S.lettersToBuf(rows, true); }

  /* ---------------- janela ---------------- */
  let cat = 'Animais', sel = null;
  S.openRascunhos = function (startCat) {
    if (startCat) cat = startCat;
    const L = catalog(), cats = [...new Set(L.map(x => x.cat))];
    const ov = h('div', { class: 'ov' }), box = h('div', { class: 'dlg lib' }), side = h('div', { class: 'rside' }), gal = h('div', { class: 'gal rgal' }), det = h('div', { class: 'rdet' });
    const close = () => ov.remove();
    box.append(h('div', { class: 'dhead' }, h('b', null, 'Rascunhos prontos'), h('span', { class: 'hint' }, 'escolha um e ele abre com as camadas separadas, as animações e o tipo pro jogo'), h('span', { style: 'flex:1' }), h('button', { class: 'ib', onclick: close }, '×')), h('div', { class: 'rbody' }, side, gal, det)); ov.appendChild(box); ov.onclick = e => { if (e.target === ov) close(); }; document.body.appendChild(ov);
    function renderSide() { side.innerHTML = ''; cats.forEach(c => side.appendChild(h('button', { class: 'rcat' + (c === cat ? ' on' : ''), onclick: () => { cat = c; renderSide(); renderGal(); } }, c, h('small', null, String(L.filter(x => x.cat === c).length))))); side.appendChild(h('hr')); side.appendChild(h('button', { class: 'rcat', onclick: () => { close(); S.guidesDialog(); } }, '✨ Modo guiado')); side.appendChild(h('button', { class: 'rcat', onclick: () => { close(); S.openBuildHub(); } }, 'Construtores')); side.appendChild(h('button', { class: 'rcat', onclick: () => { close(); S.openLibrary('jogo'); } }, 'Coisas do jogo Kome')); }
    function renderGal() {
      gal.innerHTML = ''; const items = L.filter(x => x.cat === cat); let i = 0;
      const step = () => { const t0 = performance.now(); while (i < items.length && performance.now() - t0 < 25) { const it = items[i++]; let cv; try { const r = it.thumb(); cv = S.toCanvas(r.buf, r.w, r.h); } catch (e) { continue; } const k = Math.max(1, Math.min(4, Math.floor(100 / Math.max(cv.width, cv.height)))), c2 = S.scaleCv(cv, k); const card = h('div', { class: 'gitem' + (sel === it ? ' on' : ''), onclick: () => { sel = it; [...gal.children].forEach(ch => ch.classList.remove('on')); card.classList.add('on'); renderDet(it, cv); }, ondblclick: () => { close(); it.open(); } }, c2, h('div', { class: 'nm' }, it.nome)); gal.appendChild(card); if (!sel || sel.cat !== cat) { sel = it; card.classList.add('on'); renderDet(it, cv); } } if (i < items.length && document.body.contains(gal)) requestAnimationFrame(step); };
      step();
    }
    function renderDet(it, cv) { det.innerHTML = ''; const k = Math.max(1, Math.min(6, Math.floor(220 / Math.max(cv.width, cv.height)))); det.append(S.scaleCv(cv, k), h('h3', null, it.nome), h('p', { class: 'hint' }, it.info), it.sub ? h('p', { class: 'hint' }, it.sub) : null, h('p', { class: 'hint' }, 'Tamanho base: ' + cv.width + '×' + cv.height + ' px'), h('button', { class: 'tb big green', onclick: () => { close(); S.toast('Abrindo ' + it.nome + '…'); setTimeout(() => it.open(), 20); } }, 'Abrir rascunho'), h('p', { class: 'hint' }, 'Duplo clique na miniatura também abre.')); }
    renderSide(); renderGal();
  };

  /* ---------------- Início (como a tela inicial do Photoshop) ---------------- */
  S.openHome = function () {
    S.dialog('Pixxel Estúdio — Início', (box, close) => {
      const sizes = [['Kome 48×48', 48, 48], ['Item 32×32', 32, 32], ['Personagem 64×64', 64, 64], ['Casa 128×128', 128, 128], ['Cena 320×180', 320, 180], ['Gigante 512×512', 512, 512]];
      box.append(h('div', { class: 'home' },
        h('div', null, h('h3', null, 'Começar'), h('div', { class: 'hubrow' }, h('button', { class: 'hubitem big', onclick: () => { close(); S.openRascunhos(); } }, h('b', null, 'Rascunhos prontos'), h('span', { class: 'hint' }, 'animais, Kome, casas, castelos, vilas, comida, máquinas — já com camadas')), h('button', { class: 'hubitem big magicbg', onclick: () => { close(); S.guidesDialog(); } }, h('b', null, '✨ Modo guiado'), h('span', { class: 'hint' }, 'aprenda fazendo: faça um Kome passo a passo')), h('button', { class: 'hubitem big', onclick: () => { close(); S.openBuildHub(); } }, h('b', null, 'Construtores'), h('span', { class: 'hint' }, 'bicho, casa, castelo, vila, máquina, rua'))),
          h('h3', null, 'Tela em branco'), h('div', { class: 'chips' }, ...sizes.map(([t, w, hh]) => h('button', { class: 'chip', onclick: () => { close(); const d = S.newDoc(w, hh, { name: 'Sem título' }); d.tile = { w: Math.min(16, w), h: Math.min(16, hh) }; S.openDoc(d); } }, t)))),
        h('div', null, h('h3', null, 'Recentes'), (() => { const g = h('div', { class: 'gal' }); S.store.list().then(list => list.slice(0, 12).forEach(it => g.appendChild(h('div', { class: 'gitem', onclick: () => { const open = S.docs.find(d => d.id === it.id); close(); if (open) S.selectDoc(open); else S.store.get(it.id).then(d => d && S.openDoc(d)); } }, it.thumb ? h('img', { src: it.thumb }) : h('div', { class: 'noimg' }), h('div', { class: 'nm' }, it.name))))).catch(() => { }); return g; })())));
      return [];
    }, { wide: true });
  };
})();
