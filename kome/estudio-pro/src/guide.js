/* ==========================================================================
   Pixxel Estúdio — guide.js  (modo guiado)
   Passo a passo: o estúdio cria a camada certa, escolhe ferramenta e cor,
   mostra o molde do que falta (piscando), mede seu progresso e tem o botão
   ✨ "Fazer pra mim". No fim, anima e leva pro jogo.
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, E = S.E, { h } = S;

  // passos de bicho (Construtor): partes cumulativas
  const BICHO_STEPS = [
    { parts: ['corpo'], layer: 'Corpo', tool: 'ell', fill: true, title: 'O corpo', text: 'Todo bicho começa por uma forma simples. Escolhi a Elipse (U) com a cor do pelo: arraste por cima do molde azul pra fazer o corpo (formas cheias já está ligado). Pode retocar com o Lápis (B).' },
    { parts: ['pernasTras', 'pernasFrente'], layer: 'Pernas', tool: 'pen', brush: 2, title: 'As pernas', text: 'Quatro perninhas grossas e curtas (é isso que deixa fofo). Lápis com pincel 2: desenhe do corpo até o chão. As de trás ficam um pouco mais escuras — já vem no molde.' },
    { parts: ['cabeca'], layer: 'Cabeça', tool: 'ell', fill: true, title: 'A cabeça', text: 'Cabeça GRANDE e redonda, quase do tamanho do corpo: no estilo Kome a cabeça manda. Elipse cheia por cima do molde.' },
    { parts: ['orelhas'], layer: 'Orelhas', tool: 'pen', brush: 1, title: 'As orelhas', text: 'Triângulos pontudos em cima da cabeça, com o miolo claro. Lápis (B), pincel 1. Dica: a orelha de trás fica mais escura que a da frente.' },
    { parts: ['cremeCorpo', 'cremeCabeca'], layer: 'Creme', tool: 'pen', brush: 2, title: 'O creme (bochecha, focinho, peito, barriga)', text: 'A cor clara faz o desenho "ler" de longe: focinho, bochecha, peito e barriga. Lápis com pincel 2, ou Balde (G) nos espaços fechados.' },
    { parts: ['rabo'], layer: 'Rabo', tool: 'pen', brush: 2, title: 'O rabo', text: 'Rabo enroladinho de shiba: uma bolinha de pelo com o miolo claro. Lápis.' },
    { parts: ['rosto'], layer: 'Rosto', tool: 'pen', brush: 1, title: 'O rosto', text: 'O mais importante! Olho escuro de 3×4 com 2 pixels brancos de brilho, nariz na ponta, boquinha e bochecha rosada. Lápis pincel 1. Use o Conta-gotas (I ou Alt+clique) pra pegar as cores do molde.' },
    { parts: ['acessorio'], layer: 'Chapéu', tool: 'pen', brush: 1, title: 'O chapéu kasa', text: 'O chapéu de palha cônico é a marca do Kome: um triângulo dourado com a aba mais escura. Lápis (ou Linha U + Balde G).' },
    { parts: [], shade: true, layer: null, tool: 'shade', brush: 2, title: 'Sombra e volume', text: 'Agora os 3 tons: com o Pincel de sombra (B, no grupo do lápis) passe na barriga, nas pernas de trás e embaixo da cabeça. A luz vem de cima/esquerda, então a sombra fica embaixo/direita. Ou use ✨ Fazer pra mim.' },
    { parts: [], shade: true, outline: true, layer: 'Contorno', tool: 'pen', brush: 1, title: 'Contorno', text: 'O contorno marrom de 1 pixel por fora é o que deixa com cara de jogo. Mais fácil: Editar → Contorno por fora (com a cor marrom já escolhida), ou ✨ Fazer pra mim.', outlineHelp: true },
    { final: true, title: 'Animar e levar pro jogo', text: 'Seu Kome está pronto! Agora: "Animar como cachorro" faz ele andar, correr, pular e abanar o rabo (usando as suas camadas). Depois, Exportar → Pacote pra engine ou Ficha do jogo.' },
  ];
  const GUIDES = {
    kome: { nome: 'Faça um Kome', desc: 'o shiba do jogo, peça por peça (11 passos)', bicho: { especie: 'cachorro', acessorio: 'kasa', res: 1, cores: {} }, steps: BICHO_STEPS },
    gato: { nome: 'Faça um gato', desc: 'gatinho listrado com bigode', bicho: { especie: 'gato', acessorio: 'nenhum', res: 1, cores: {} }, steps: BICHO_STEPS.filter(s2 => s2.layer !== 'Chapéu').map(s2 => s2.layer === 'Rabo' ? Object.assign({}, s2, { text: 'Rabo de gato: comprido e subindo em curva, com a pontinha escura. Lápis pincel 2.' }) : s2) },
    raposa: { nome: 'Faça uma raposa', desc: 'rabo fofo com ponta branca e meias pretas', bicho: { especie: 'raposa', acessorio: 'nenhum', res: 1, cores: {} }, steps: BICHO_STEPS.filter(s2 => s2.layer !== 'Chapéu') },
    casa: { nome: 'Faça uma casa japonesa', desc: 'paredes, telhado, portas/janelas e detalhes', casa: 'Casa japonesa' },
    castelo: { nome: 'Faça um castelo', desc: 'muralha de pedra, andares e telhados curvados', casa: 'Castelo japonês' },
    onigiri: { nome: 'Faça um onigiri', desc: 'comida fofa em 5 passos', onigiri: true },
  };
  S.GUIDES = GUIDES;

  function casaSteps(preset) {
    const pr = Object.assign({ res: 1 }, S.Builders.casa.presets[preset]), names = [['Paredes e base', 'Comece pelo bloco: Retângulo cheio (U, Ctrl) pras paredes, uma faixa de pedra embaixo. Construção é caixa antes de detalhe.', 'rect'], ['Telhado', 'O telhado japonês é um trapézio largo com as pontas do beiral viradas pra cima. Laço poligonal (L) + Balde (G), ou Lápis.', 'pen'], ['Portas e janelas', 'Janelas com moldura de madeira e grade (shoji); porta no meio. Retângulo (U) e Lápis (B).', 'rect'], ['Detalhes', 'Lanterna, vasos, plantas, telhas: o detalhe é o que conta a história. Lápis pincel 1.', 'pen']];
    return names.map(([title, text, tool], i) => ({ title, text, tool, layer: title.split(' ')[0], target: S.Builders.casa.draw(Object.assign({}, pr, { _stage: i + 1 }), 'dia', 0) })).concat([{ final: true, title: 'Pronto pra rua!', text: '"Animar como casa" cria o dia e a noite (janelas acesas). Depois exporte pro jogo.', anim: 'casa' }]);
  }
  function onigiriSteps() {
    const it = E.Fab.make('onigiri', 3, { size: 'GG', face: true }), rows = it.rows, Hh = rows.length, TP = E.TEXT_PAL;
    const mk = keep => { const W = Math.max(...rows.map(r => r.length)), b = new Uint32Array(W * Hh); rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch === '.') continue; const k = keep(ch, y); if (k) b[y * W + x] = S.hex2c(TP[k]); } }); return { buf: b, w: W, h: Hh }; };
    const nori = (ch, y) => (ch === 'N' || ch === 'n') && y > Hh * 0.55;
    const st = [
      mk((ch, y) => nori(ch, y) ? 'A' : 'A'),
      mk((ch, y) => nori(ch, y) ? 'N' : 'A'),
      mk((ch, y) => nori(ch, y) ? 'N' : ch === 'a' ? 'a' : 'A'),
      mk((ch, y) => ch),
    ];
    const ol = (() => { const cv = S.komeStyle(st[3].buf, st[3].w, st[3].h); return { buf: S.fromCanvas(cv).slice(), w: cv.width, h: cv.height }; })();
    const pad = b => { const o = new Uint32Array(ol.w * ol.h); for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) o[(y + 1) * ol.w + x + 1] = b.buf[y * b.w + x]; return { buf: o, w: ol.w, h: ol.h }; };
    return [
      { title: 'O arroz', text: 'Um triângulo de cantos bem redondos, todo branco-arroz. Laço poligonal (L) + Balde, ou Lápis com pincel grande.', tool: 'pen', brush: 3, layer: 'Arroz', target: pad(st[0]) },
      { title: 'A alga (nori)', text: 'Um retângulo escuro na parte de baixo. Retângulo cheio (U).', tool: 'rect', layer: 'Nori', target: pad(st[1]) },
      { title: 'Volume', text: 'Sombra creme embaixo/direita do arroz (luz vem de cima/esquerda). Pincel de sombra ou Lápis.', tool: 'pen', brush: 1, layer: 'Sombra', target: pad(st[2]) },
      { title: 'Carinha', text: 'Olhinhos, boca e bochecha rosa — comida fofa sempre tem rosto no estilo Kome!', tool: 'pen', brush: 1, layer: 'Rosto', target: pad(st[3]) },
      { title: 'Contorno', text: 'Contorno marrom por fora: Editar → Contorno por fora, ou ✨ Fazer pra mim.', tool: 'pen', layer: 'Contorno', target: ol, outlineHelp: true },
      { final: true, title: 'Bom apetite!', text: '"Animar como item" faz ele flutuar, brilhar e pular quando pega. Depois exporte pro jogo.', anim: 'item' },
    ];
  }

  /* ---------------- execução do guia ---------------- */
  let G0 = null; // {id, steps, i, doc, layers{}}
  S.startGuide = function (id) {
    const def = GUIDES[id]; if (!def) return;
    let steps;
    if (def.bicho) { const st = S.Creature.stages(def.bicho, 'parado', def.steps.filter(s2 => !s2.final)); steps = def.steps.map((s2, i) => Object.assign({}, s2, { target: st[i] || null, anim: s2.final ? 'cachorro' : null })); if (id === 'gato') steps[steps.length - 1].anim = 'gato'; if (id === 'raposa') steps[steps.length - 1].anim = 'quadrupede'; }
    else if (def.casa) steps = casaSteps(def.casa);
    else steps = onigiriSteps();
    const t0 = steps.find(s2 => s2.target).target, d = S.newDoc(t0.w, t0.h, { name: def.nome.replace('Faça ', '').replace(/^(um|uma) /, '') });
    d.layers = [S.newLayer('Fundo', { cels: [null] })]; d.cur = { f: 0, l: 0 }; d.meta.tipo = def.bicho ? 'bicho' : def.casa ? 'construção' : 'comida';
    // paleta do guia: as cores do resultado final
    const fin = steps.filter(s2 => s2.target).pop().target, set = new Set(); fin.buf.forEach(v => { if (v >>> 24) set.add(v >>> 0); }); d.pal = [...set];
    S.openDoc(d); G0 = { id, def, steps, i: 0, doc: d }; S.setWorkspace('draw'); go(0);
  };
  function prevTarget(i) { for (let k = i - 1; k >= 0; k--) if (G0.steps[k].target) return G0.steps[k].target; return null; }
  function diffMask(i) { const t = G0.steps[i].target, p = prevTarget(i), m = new Uint8Array(t.buf.length); for (let q = 0; q < m.length; q++) { const a = t.buf[q], b = p ? p.buf[q] : 0; if ((a >>> 24) && a !== b) m[q] = 1; } return m; }
  function go(i) {
    G0.i = Math.max(0, Math.min(G0.steps.length - 1, i)); const st = G0.steps[G0.i], d = G0.doc; S.selectDoc(d);
    if (st.target) {
      // camada do passo (cria se não existir)
      if (st.layer) { let li = d.layers.findIndex(l => l.name === st.layer); if (li < 0) { S.ops.addLayer(st.layer); li = d.layers.findIndex(l => l.name === st.layer); } d.cur.l = li; }
      const m = diffMask(G0.i), cnt = new Map(); for (let q = 0; q < m.length; q++) if (m[q]) { const v = st.target.buf[q]; cnt.set(v, (cnt.get(v) || 0) + 1); }
      const main = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]; if (main) { S.state.fg = main[0]; S.emit('color'); }
      if (st.outlineHelp) { S.state.fg = S.hex2c(E.LINE_CSS); S.emit('color'); }
      if (st.tool) S.setTool(st.tool); if (st.brush) { S.state.brush = st.brush; } if (st.fill != null) S.state.fillShape = st.fill; S.refreshCtx && S.refreshCtx();
      S.view.guide = { buf: st.target.buf, w: st.target.w, h: st.target.h, cmp: null };
    } else S.view.guide = null;
    S.refresh(); render(); measure();
  }
  function measure() {
    if (!G0) return; const st = G0.steps[G0.i]; if (!st.target) return; const d = G0.doc, comp = S.compose(d, d.cur.f, { skipRef: true }); S.view.guide.cmp = comp;
    const m = diffMask(G0.i); let need = 0, ok = 0; for (let q = 0; q < m.length; q++) if (m[q]) { need++; if ((comp[q] >>> 24) && S.cdist(comp[q], st.target.buf[q]) < 900) ok++; }
    const pct = need ? Math.round(ok / need * 100) : 100, bar = document.querySelector('#guideBar i'), lbl = document.querySelector('#guidePct'); if (bar) bar.style.width = pct + '%'; if (lbl) lbl.textContent = pct + '%' + (pct >= 85 ? ' — ótimo! pode ir pro próximo' : '');
    S.redraw();
  }
  S.on('change', () => { if (G0 && S.getDoc() === G0.doc) measure(); });
  // o cartão e o molde só aparecem no desenho do guia
  let savedGuide = null;
  setInterval(() => { if (!G0) return; const mine = S.getDoc() === G0.doc, card = document.getElementById('guideCard'); if (card) card.style.display = mine ? '' : 'none'; if (!mine && S.view.guide) { savedGuide = S.view.guide; S.view.guide = null; S.redraw(); } else if (mine && !S.view.guide && savedGuide) { S.view.guide = savedGuide; savedGuide = null; S.redraw(); } }, 250);
  function doIt() {
    const st = G0.steps[G0.i], d = G0.doc; if (!st.target) return;
    if (st.shade && !st.outline) { // sombra: aplica as cores sombreadas do molde em cima das camadas existentes
      S.ops.addLayer('Sombra'); const li = d.cur.l; const H = S.getHist(); H.begin('✨ sombra (guia)'); H.touch(li, d.cur.f); const c = S.celW(d, li, d.cur.f), m = diffMask(G0.i); for (let q = 0; q < m.length; q++) if (m[q]) c[q] = st.target.buf[q]; H.end(); S.refresh(); return;
    }
    const li = d.cur.l, H = S.getHist(); H.begin('✨ fazer pra mim: ' + st.title); H.touch(li, d.cur.f); const c = S.celW(d, li, d.cur.f), m = diffMask(G0.i); for (let q = 0; q < m.length; q++) if (m[q]) c[q] = st.target.buf[q]; H.end(); S.emit('change', d); S.refresh();
    try { E.Sfx && S.sound && E.Sfx.play('sparkle'); } catch (e) { }
  }
  function finish(kind) {
    const d = G0.doc; S.view.guide = null;
    if (G0.def.bicho) {
      // anima com o construtor, mantendo os parâmetros do guia: gera camadas animadas iguais às que você desenhou
      if (confirm('Gerar as 9 animações (parado, andar, correr, pular, sentar, abanar, dormir, comer, feliz) com as mesmas peças?\n\nOK = animação completa do construtor (as camadas animadas abrem num desenho novo)\nCancelar = animar o SEU desenho pelo "O que é isso?"')) { S.openCreatureDoc(G0.def.bicho, null, d.name + ' animado'); }
      else { S.focusPanel && S.focusPanel('tipo'); S.setTypeSel && S.setTypeSel(kind || 'cachorro'); }
    } else { S.focusPanel && S.focusPanel('tipo'); S.setTypeSel && S.setTypeSel(kind || 'item'); }
    stop();
  }
  function stop() { G0 = null; S.view.guide = null; const c = document.getElementById('guideCard'); if (c) c.remove(); S.redraw(); }
  S.stopGuide = stop;
  function render() {
    let card = document.getElementById('guideCard'); if (!card) { card = h('div', { id: 'guideCard' }); document.getElementById('cvwrap').appendChild(card); }
    const st = G0.steps[G0.i], n = G0.steps.length; card.innerHTML = '';
    card.append(h('div', { class: 'gtop' }, h('b', null, '✨ ' + G0.def.nome), h('span', null, 'passo ' + (G0.i + 1) + ' de ' + n), h('button', { class: 'ib', title: 'sair do guia', onclick: stop }, '×')),
      h('h4', null, st.title), h('p', null, st.text),
      st.target ? h('div', { id: 'guideBar' }, h('i')) : null, st.target ? h('div', { id: 'guidePct', class: 'hint' }, '0%') : null,
      h('div', { class: 'row' }, h('button', { class: 'tb', disabled: G0.i === 0, onclick: () => go(G0.i - 1) }, '← Voltar'), st.target ? h('button', { class: 'tb magic', onclick: doIt }, '✨ Fazer pra mim') : null, st.final ? h('button', { class: 'tb green', onclick: () => finish(st.anim) }, 'Animar!') : h('button', { class: 'tb green', onclick: () => go(G0.i + 1) }, 'Próximo →')),
      st.target ? h('div', { class: 'hint' }, 'O molde pisca onde ainda falta. Ferramenta e cor já escolhidas pra você.') : null);
  }
  S.guidesDialog = function () {
    S.dialog('Modo guiado — aprenda fazendo', (box, close) => {
      box.appendChild(h('p', { class: 'hint' }, 'O estúdio te leva passo a passo: cria as camadas, escolhe a ferramenta e a cor, mostra o molde e confere seu progresso. Travou? ✨ Fazer pra mim.'));
      const g = h('div', { class: 'hub' });
      Object.entries(GUIDES).forEach(([id, d]) => { const pv = h('canvas', { width: 120, height: 84 }); try { let r; if (d.bicho) r = S.Creature.render(d.bicho, 'parado', 0); else if (d.casa) r = S.Builders.casa.draw(Object.assign({ res: 1 }, S.Builders.casa.presets[d.casa]), 'dia', 0); else r = S.lettersToBuf(E.Fab.make('onigiri', 3, { size: 'G', face: true }).rows, true); const cv = S.toCanvas(r.buf, r.w, r.h), z = Math.min(3, 110 / r.w, 76 / r.h), pg = pv.getContext('2d'); pg.imageSmoothingEnabled = z < 1; pg.drawImage(cv, (120 - r.w * z) / 2, (84 - r.h * z) / 2, r.w * z, r.h * z); } catch (e) { } g.appendChild(h('button', { class: 'hubitem', onclick: () => { close(); S.startGuide(id); } }, pv, h('b', null, d.nome), h('span', { class: 'hint' }, d.desc))); });
      box.appendChild(g); return [];
    }, { wide: true });
  };
})();
