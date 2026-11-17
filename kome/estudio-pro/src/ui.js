/* ==========================================================================
   Pixxel Estúdio — ui.js  (interface no jeito do Photoshop)
   Menus, barra de opções, ferramentas em grupos (com flyout e Shift+letra),
   atalhos do Photoshop, dock de painéis (Prévia no topo, Cor/Amostras,
   Mágica/O que é isso?/Propriedades, Camadas/Histórico), linha do tempo
   de quadros, documentos em abas, diálogos e espaços de trabalho.
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, E = S.E, { h, $, $$, clamp } = S;
  S.docs = []; const hists = new Map(); let doc = null, H = null;
  const st = S.state; st.opacity = 100;

  /* ---------------- aviso e som ---------------- */
  let toastT = 0;
  S.toast = t => { const d = $('#toast'); d.textContent = t; d.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => d.classList.remove('show'), 2400); };
  const sfx = (n, o) => { try { if (S.sound && E.Sfx) E.Sfx.play(n, o); } catch (e) { } };
  S.sound = false; addEventListener('pointerdown', () => { try { E.Audio && E.Audio.unlock(); } catch (e) { } }, { passive: true });

  /* ---------------- ícones (pixel art estilo Kome) ---------------- */
  const C = E.PAL;
  const ICONS = {
    move: P => P.rect(7, 2, 2, 12, C.cream).rect(2, 7, 12, 2, C.cream).tri(8, 0, 5, 4, 11, 4, C.cream).tri(8, 16, 5, 12, 11, 12, C.cream).tri(0, 8, 4, 5, 4, 11, C.cream).tri(16, 8, 12, 5, 12, 11, C.cream),
    select: P => { for (let i = 2; i < 14; i += 2) { P.set(i, 2, C.cream).set(i, 13, C.cream).set(2, i, C.cream).set(13, i, C.cream); } },
    ellsel: P => { for (let a = 0; a < 6.28; a += 0.45) P.set(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 5, C.cream); },
    lasso: P => P.arc(8, 7, 5, 0, 6.28, 1.4, C.cream).line(4, 10, 3, 14, 1, C.wood),
    polylasso: P => P.line(2, 12, 6, 3, 1, C.cream).line(6, 3, 13, 6, 1, C.cream).line(13, 6, 9, 13, 1, C.cream).line(9, 13, 2, 12, 1, C.cream).set(2, 12, C.gold).set(6, 3, C.gold).set(13, 6, C.gold).set(9, 13, C.gold),
    wand: P => P.line(2, 14, 10, 6, 2, C.woodD).poly([[12, 1], [13, 4], [15, 5], [13, 6], [12, 9], [11, 6], [9, 5], [11, 4]], C.goldL),
    crop: P => P.rect(4, 1, 2, 11, C.cream).rect(4, 10, 11, 2, C.cream).rect(1, 4, 11, 2, C.cream).rect(10, 4, 2, 11, C.cream),
    pick: P => P.line(3, 13, 10, 6, 2.4, C.glass).rrect(9, 2, 5, 5, 2, C.ink).set(2, 14, C.water),
    heal: P => P.rrect(2, 5, 12, 6, 3, C.sakura).rect(6, 5, 4, 6, C.cream).set(7, 7, C.sakuraD).set(8, 8, C.sakuraD),
    pen: P => P.line(3, 12, 11, 4, 3, C.yel).line(11, 4, 13, 2, 3, C.pink).tri(2, 14, 2.5, 11, 5, 13.5, C.sack).set(2, 13, C.ink),
    spray: P => P.rrect(3, 6, 6, 9, 2, C.red).rect(4, 3, 4, 3, C.steel).set(11, 3, C.cream).set(13, 5, C.cream).set(12, 7, C.cream).set(14, 2, C.cream).set(10, 1, C.cream),
    shade: P => P.ell(8, 8, 6, 6, C.gold).ell(10, 10, 4.5, 4.5, C.goldD).set(5, 5, C.goldL),
    dither: P => { for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) if ((x + y) & 1) P.set(x, y, C.cream); },
    replace: P => P.ell(5, 6, 3.5, 3.5, C.red).ell(11, 10, 3.5, 3.5, C.water).line(5, 11, 9, 13, 1, C.cream).line(11, 5, 7, 3, 1, C.cream),
    clone: P => P.rrect(3, 9, 10, 4, 1, C.wood).rect(6, 4, 4, 5, C.woodD).ell(8, 3, 3, 2, C.wood).rect(2, 13, 12, 2, C.red),
    erase: P => P.poly([[2, 8], [8, 2], [14, 8], [8, 14]], C.sakura).poly([[2, 8], [5, 5], [11, 11], [8, 14]], C.cream),
    grad: P => { for (let x = 2; x < 14; x++) for (let y = 3; y < 13; y++) P.set(x, y, ((x - 2) / 12) > ((y * 7 + x * 3) % 16) / 16 ? C.ink : C.cream); },
    fill: P => P.poly([[3, 7], [8, 2], [13, 7], [8, 12]], C.steel).line(8, 2, 8, 7, 1, C.steelD).ell(13, 12, 2, 2.6, C.water),
    light: P => P.ell(8, 8, 4, 4, C.sun).line(8, 1, 8, 3, 1, C.gold).line(8, 13, 8, 15, 1, C.gold).line(1, 8, 3, 8, 1, C.gold).line(13, 8, 15, 8, 1, C.gold),
    dark: P => { P.ell(8, 8, 6, 6, C.night); P.mask((x, y) => Math.hypot(x + .5 - 11, y + .5 - 5) > 4.5); },
    sponge: P => P.rrect(3, 4, 10, 8, 3, C.yel).set(5, 6, C.yelD).set(9, 7, C.yelD).set(7, 9, C.yelD).set(11, 9, C.yelD),
    text: P => P.rect(3, 2, 10, 3, C.cream).rect(7, 2, 3, 12, C.cream),
    rect: P => { P.rect(2, 3, 12, 10, C.cream); P.erase(4, 5, 8, 6); },
    ell: P => { P.ell(8, 8, 6.5, 5.5, C.cream); P.mask((x, y) => { const dx = (x + .5 - 8) / 4.5, dy = (y + .5 - 8) / 3.5; return dx * dx + dy * dy > 1; }); },
    line: P => P.line(2, 13, 13, 2, 2, C.cream).ell(2.5, 13.5, 1.6, 1.6, C.red).ell(13.5, 2.5, 1.6, 1.6, C.red),
    hand: P => P.rrect(4, 6, 9, 8, 3, C.fur).rect(4, 2, 2, 6, C.fur).rect(7, 1, 2, 6, C.fur).rect(10, 2, 2, 6, C.fur).rect(2, 7, 2, 4, C.fur),
    zoom: P => P.ring(7, 7, 5, 1.6, C.cream).line(10, 10, 14, 14, 2.4, C.wood),
  };
  function iconCanvas(name, k) { const P = E.Pix(16, 16); try { (ICONS[name] || (() => { }))(P); } catch (e) { } const cv = P.canvas(true); const c = document.createElement('canvas'); c.width = c.height = Math.round(16 * (k || 2)); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(cv, 0, 0, c.width, c.height); return c; }
  S.iconCanvas = iconCanvas;

  /* ---------------- ferramentas em grupos (igual ao Photoshop) ---------------- */
  const TOOLS = {
    move: ['Mover', 'V'], select: ['Letreiro retangular', 'M'], ellsel: ['Letreiro elíptico', 'M'], lasso: ['Laço', 'L'], polylasso: ['Laço poligonal', 'L'], wand: ['Varinha mágica', 'W'], crop: ['Cortar demarcação', 'C'], pick: ['Conta-gotas', 'I'],
    heal: ['Pincel corretor (limpa pixel solto)', 'J'], pen: ['Lápis', 'B'], spray: ['Spray', 'B'], shade: ['Pincel de sombra (rampa)', 'B'], dither: ['Retícula', 'B'], replace: ['Substituição de cor', 'B'], clone: ['Carimbo (Alt+clique marca a origem)', 'S'],
    erase: ['Borracha', 'E'], grad: ['Degradê com retícula', 'G'], fill: ['Lata de tinta', 'G'], light: ['Subexposição (clarear)', 'O'], dark: ['Superexposição (escurecer)', 'O'], sponge: ['Esponja (saturação)', 'O'],
    text: ['Texto pixel', 'T'], rect: ['Retângulo', 'U'], ell: ['Elipse', 'U'], line: ['Linha', 'U'], hand: ['Mão', 'H'], zoom: ['Zoom', 'Z'],
  };
  const GROUPS = [['move'], ['select', 'ellsel'], ['lasso', 'polylasso'], ['wand'], ['crop'], ['pick'], '-', ['heal'], ['pen', 'spray', 'shade', 'dither', 'replace'], ['clone'], ['erase'], ['grad', 'fill'], ['light', 'dark', 'sponge'], '-', ['text'], ['rect', 'ell', 'line'], '-', ['hand'], ['zoom']];
  const lastOf = {}; GROUPS.forEach((g, i) => { if (g !== '-') lastOf[i] = g[0]; }); lastOf[11] = 'fill';
  S.setTool = function (t) {
    if (t === 'pick' && st.tool !== 'pick') st.prevTool = st.tool;
    if (S.transform && t !== 'move') S.applyTransform();
    if (st.tool === 'crop' && t !== 'crop') S.cancelOverlays();
    st.tool = t; const gi = GROUPS.findIndex(g => g !== '-' && g.includes(t)); if (gi >= 0) lastOf[gi] = t;
    buildTools(); buildCtx(); S.redraw(); const el = $('#stTool'); if (el) el.textContent = TOOLS[t] ? TOOLS[t][0] : t;
  };
  function buildTools() {
    const box = $('#tools'); if (!box) return; box.innerHTML = '';
    GROUPS.forEach((g, gi) => {
      if (g === '-') { box.appendChild(h('div', { class: 'tsep' })); return; }
      const t = lastOf[gi], b = h('button', { class: 'tool' + (g.includes(st.tool) ? ' on' : '') + (g.length > 1 ? ' grp' : ''), 'data-tool': t, title: TOOLS[t][0] + ' (' + TOOLS[t][1] + ')' + (g.length > 1 ? ' — botão direito: mais ferramentas' : ''), onclick: () => S.setTool(t), oncontextmenu: e => { e.preventDefault(); flyout(b, g); } }, iconCanvas(t, 1.5));
      let lp = 0; b.addEventListener('pointerdown', () => { lp = setTimeout(() => flyout(b, g), 450); }); b.addEventListener('pointerup', () => clearTimeout(lp)); b.addEventListener('pointerleave', () => clearTimeout(lp));
      box.appendChild(b);
    });
    box.appendChild(h('div', { class: 'fgbg', title: 'cor principal / secundária (X troca, D padrão)' }, h('div', { class: 'sw bg', style: { background: S.css(st.bg) }, onclick: swap }), h('div', { class: 'sw fg', style: { background: S.css(st.fg) }, onclick: () => S.focusPanel('cor') })));
  }
  function flyout(btn, g) {
    $$('.flyout').forEach(f => f.remove()); if (g.length < 2) return; const r = btn.getBoundingClientRect(), f = h('div', { class: 'flyout', style: { left: r.right + 2 + 'px', top: r.top + 'px' } });
    g.forEach(t => f.appendChild(h('button', { onclick: () => { f.remove(); S.setTool(t); } }, iconCanvas(t, 1.25), TOOLS[t][0], h('small', null, TOOLS[t][1])))); document.body.appendChild(f);
    setTimeout(() => addEventListener('pointerdown', function off(e) { if (!f.contains(e.target)) { f.remove(); removeEventListener('pointerdown', off); } }), 0);
  }
  function cycleGroup(key) { const gi = GROUPS.findIndex(g => g !== '-' && TOOLS[g[0]][1] === key); if (gi < 0) return; const g = GROUPS[gi]; const i = g.indexOf(st.tool); S.setTool(g[(i + 1) % g.length]); }
  function toolForKey(key) { const gi = GROUPS.findIndex(g => g !== '-' && TOOLS[g[0]][1] === key); if (gi >= 0) S.setTool(lastOf[gi]); }

  // barra de opções (contexto da ferramenta)
  function buildCtx() {
    const c = $('#ctx'); if (!c) return; c.innerHTML = ''; const t = st.tool;
    const num = (label, key, min, max, suf) => h('label', null, label + ' ', h('input', { type: 'range', min, max, value: st[key], style: 'width:90px', oninput: e => { st[key] = +e.target.value; e.target.nextSibling.textContent = st[key] + (suf || ''); S.redraw(); } }), h('b', null, st[key] + (suf || '')));
    const chk = (label, key, title) => h('label', { title }, h('input', { type: 'checkbox', checked: !!st[key], onchange: e => { st[key] = e.target.checked; S.redraw(); } }), label);
    const sep = () => h('span', { class: 'sep' });
    const ic = iconCanvas(t, 1.5); ic.className = 'ctxicon';
    c.append(ic, h('b', null, TOOLS[t] ? TOOLS[t][0] : t), sep());
    if (['pen', 'erase', 'shade', 'dither', 'spray', 'light', 'dark', 'line', 'clone', 'sponge', 'heal', 'text'].includes(t)) c.appendChild(num(t === 'text' ? 'tamanho da letra' : 'tamanho', 'brush', 1, 32, 'px'));
    if (['pen', 'erase', 'spray', 'line', 'rect', 'ell'].includes(t)) c.appendChild(num('opacidade', 'opacity', 1, 100, '%'));
    if (t === 'pen') c.appendChild(chk('pixel perfeito', 'pp', 'tira os cantinhos em L do traço'));
    if (['pen', 'erase', 'line', 'rect', 'ell', 'shade', 'dither', 'spray', 'clone'].includes(t)) { c.appendChild(sep()); c.appendChild(chk('simetria ↔', 'symX')); c.appendChild(chk('simetria ↕', 'symY')); }
    if (['pen', 'fill', 'line', 'rect', 'ell', 'shade', 'dither', 'spray', 'grad', 'clone'].includes(t)) c.appendChild(chk('só por cima do desenho', 'lockA', 'pinta só onde já existe desenho em qualquer camada'));
    if (t === 'rect' || t === 'ell') c.appendChild(chk('preenchido', 'fillShape'));
    if (t === 'fill' || t === 'wand') { c.appendChild(num('tolerância', 'tol', 0, 100)); c.appendChild(chk('contíguo', 'contiguous')); c.appendChild(chk('todas as camadas', t === 'fill' ? 'fillAll' : 'wandAll')); }
    if (t === 'dither') c.appendChild(h('label', null, 'padrão ', h('select', { onchange: e => st.ditherPat = e.target.value }, ...Object.keys(S.DITHER).map(k => h('option', { selected: k === st.ditherPat }, k)))));
    if (t === 'spray') c.appendChild(h('label', null, 'densidade ', h('input', { type: 'range', min: 5, max: 90, value: st.sprayDens * 100, oninput: e => st.sprayDens = +e.target.value / 100 })));
    if (t === 'shade') c.appendChild(h('span', { class: 'hint' }, 'anda na rampa da paleta: clique escurece, Shift clareia'));
    if (t === 'sponge') c.appendChild(h('label', null, 'modo ', h('select', { onchange: e => st.spongeMode = e.target.value }, h('option', { value: 'por' }, 'saturar'), h('option', { value: 'tirar', selected: st.spongeMode === 'tirar' }, 'dessaturar'))));
    if (t === 'light' || t === 'dark') c.appendChild(h('span', { class: 'hint' }, 'Alt inverte (clarear ↔ escurecer)'));
    if (t === 'clone') { c.appendChild(chk('alinhado', 'cloneAligned')); c.appendChild(chk('amostrar todas as camadas', 'cloneAll')); c.appendChild(h('span', { class: 'hint' }, 'Alt+clique marca a origem')); }
    if (['select', 'ellsel', 'lasso', 'polylasso', 'wand'].includes(t)) c.appendChild(h('span', { class: 'hint' }, 'Shift soma · Alt subtrai · arraste a seleção pra mover · Ctrl+arrastar copia' + (t === 'polylasso' ? ' · clique ponto a ponto; clique no 1º ponto ou Enter fecha' : '')));
    if (t === 'move') { c.appendChild(h('span', { class: 'hint' }, 'arraste a camada ou a seleção · setas 1px (Shift 8px)')); c.appendChild(h('button', { class: 'tb', onclick: () => S.startTransform() }, 'Transformar (Ctrl+T)')); }
    if (t === 'crop') c.appendChild(h('span', { class: 'hint' }, 'arraste a área e aperte Enter (Esc cancela)'));
    if (t === 'text') c.appendChild(h('span', { class: 'hint' }, 'clique na tela pra escrever (fonte pixel 3×5)'));
    if (t === 'pick') c.appendChild(chk('só da camada', 'pickLayer'));
    if (t === 'zoom') c.appendChild(h('span', { class: 'hint' }, 'clique aproxima · Alt+clique afasta · ' + Math.round(S.view.z * 100) + '%'));
  }
  S.refreshCtx = buildCtx;

  /* ---------------- painéis com abas ---------------- */
  const TAB_NAMES = { cor: 'Cor', amostras: 'Amostras', magica: '✨ Mágica', tipo: 'O que é isso?', props: 'Propriedades', camadas: 'Camadas', historico: 'Histórico' };
  function setupPanels() {
    $$('.panel[data-tabs]').forEach(p => { const tabs = p.dataset.tabs.split(','), bar = p.querySelector('.ptabs'); tabs.forEach((t, i) => bar.appendChild(h('button', { class: 'ptab' + (i ? '' : ' on'), 'data-tab': t, onclick: () => showTab(p, t), ondblclick: () => p.classList.toggle('closed') }, TAB_NAMES[t]))); bar.appendChild(h('span', { class: 'grow', ondblclick: () => p.classList.toggle('closed') })); showTab(p, tabs[0]); });
    $('#pPrev .ptabs').ondblclick = () => $('#pPrev').classList.toggle('closed');
  }
  function showTab(p, t) { p.querySelectorAll('.ptab').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); p.querySelectorAll('[data-t]').forEach(d => d.style.display = d.dataset.t === t ? '' : 'none'); p.classList.remove('closed'); if (t === 'tipo') prevType(); if (t === 'props') buildProps(); }
  S.focusPanel = function (t) { const p = $$('.panel[data-tabs]').find(x => x.dataset.tabs.split(',').includes(t)); if (p) { showTab(p, t); p.scrollIntoView({ block: 'nearest' }); } };

  /* ---------------- cor ---------------- */
  let hsv = [0, 1, 1], alpha = 255;
  function syncHSV() { hsv = S.rgb2hsv(S.R(st.fg), S.G(st.fg), S.B(st.fg)); alpha = S.A(st.fg); }
  function buildColor() {
    const box = $('#colorPanel'); box.innerHTML = '';
    const sv = h('canvas', { width: 280, height: 110, class: 'sv' }), hue = h('canvas', { width: 280, height: 10, class: 'hue' }), al = h('canvas', { width: 280, height: 10, class: 'hue' });
    const fgb = h('div', { class: 'swbig fg', title: 'cor principal' }), bgb = h('div', { class: 'swbig bg', title: 'cor secundária (X troca)' });
    const hex = h('input', { type: 'text', class: 'hex', value: S.c2hex(st.fg), onchange: e => { const v = e.target.value.trim(); if (/^#?[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) { st.fg = S.hex2c(v); syncHSV(); S.emit('color'); } } });
    box.append(h('div', { class: 'row' }, h('div', { class: 'swpair' }, bgb, fgb), h('div', { style: 'flex:1' }, hex, h('div', { class: 'row', style: 'margin:3px 0 0' }, h('button', { class: 'tb', title: 'trocar (X)', onclick: swap }, '⇄'), h('button', { class: 'tb', title: 'padrão (D): contorno marrom e creme', onclick: defColors }, 'D'), h('button', { class: 'tb', title: 'pôr nas amostras', onclick: () => { doc.pal.push(st.fg); buildPalette(); } }, '+ amostra'), h('button', { class: 'tb', title: 'rampa de 5 tons com deslocamento de matiz', onclick: () => { doc.pal.push(...S.ramp(st.fg, 5)); buildPalette(); S.focusPanel('amostras'); } }, '+ rampa')))), sv, hue, al);
    const paint = () => {
      const g = sv.getContext('2d'), W = sv.width, Hh = sv.height; const [r, gg, b] = S.hsv2rgb(hsv[0], 1, 1); const gr1 = g.createLinearGradient(0, 0, W, 0); gr1.addColorStop(0, '#fff'); gr1.addColorStop(1, `rgb(${r},${gg},${b})`); g.fillStyle = gr1; g.fillRect(0, 0, W, Hh); const gr2 = g.createLinearGradient(0, 0, 0, Hh); gr2.addColorStop(0, 'rgba(0,0,0,0)'); gr2.addColorStop(1, '#000'); g.fillStyle = gr2; g.fillRect(0, 0, W, Hh);
      g.strokeStyle = hsv[2] > .5 ? '#000' : '#fff'; g.strokeRect(hsv[1] * W - 3, (1 - hsv[2]) * Hh - 3, 6, 6);
      const hg = hue.getContext('2d'); for (let x = 0; x < W; x++) { const [a, bb, cc] = S.hsv2rgb(x / W * 360, 1, 1); hg.fillStyle = `rgb(${a},${bb},${cc})`; hg.fillRect(x, 0, 1, 10); } hg.fillStyle = '#000'; hg.fillRect(hsv[0] / 360 * W - 1, 0, 3, 10);
      const ag = al.getContext('2d'); ag.clearRect(0, 0, W, 10); for (let x = 0; x < W; x += 5) { ag.fillStyle = (x / 5) & 1 ? '#999' : '#ddd'; ag.fillRect(x, 0, 5, 5); ag.fillStyle = (x / 5) & 1 ? '#ddd' : '#999'; ag.fillRect(x, 5, 5, 5); } const agr = ag.createLinearGradient(0, 0, W, 0); agr.addColorStop(0, 'rgba(0,0,0,0)'); agr.addColorStop(1, S.c2hex(st.fg | 0xFF000000).slice(0, 7)); ag.fillStyle = agr; ag.fillRect(0, 0, W, 10); ag.fillStyle = '#000'; ag.fillRect(alpha / 255 * (W - 1) - 1, 0, 3, 10);
      fgb.style.background = S.css(st.fg); bgb.style.background = S.css(st.bg); hex.value = S.c2hex(st.fg);
      const t1 = $('.fgbg .fg'), t2 = $('.fgbg .bg'); if (t1) t1.style.background = S.css(st.fg); if (t2) t2.style.background = S.css(st.bg);
    };
    const setFromHSV = () => { st.fg = S.pack(...S.hsv2rgb(hsv[0], hsv[1], hsv[2]), alpha); paint(); markPal(); };
    const drag = (el, fn) => { el.onpointerdown = e => { el.setPointerCapture(e.pointerId); fn(e); el.onpointermove = fn; }; el.onpointerup = () => { el.onpointermove = null; }; };
    drag(sv, e => { const r = sv.getBoundingClientRect(); hsv[1] = clamp((e.clientX - r.left) / r.width, 0, 1); hsv[2] = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); setFromHSV(); });
    drag(hue, e => { const r = hue.getBoundingClientRect(); hsv[0] = clamp((e.clientX - r.left) / r.width, 0, 0.999) * 360; setFromHSV(); });
    drag(al, e => { const r = al.getBoundingClientRect(); alpha = Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * 255); setFromHSV(); });
    bgb.onclick = swap; S.paintColor = paint; paint();
  }
  function swap() { const t = st.fg; st.fg = st.bg; st.bg = t; syncHSV(); S.emit('color'); }
  function defColors() { st.fg = S.hex2c(E.LINE_CSS); st.bg = S.hex2c('#FFFAEE'); syncHSV(); S.emit('color'); }
  S.on('color', () => { syncHSV(); S.paintColor && S.paintColor(); markPal(); });

  /* ---------------- amostras (paleta) ---------------- */
  function buildPalette() {
    const box = $('#palPanel'); box.innerHTML = ''; if (!doc) return;
    const sel = h('select', { onchange: e => { if (!e.target.value) return; if (!confirm('Trocar as amostras deste desenho por "' + e.target.value + '"?')) { e.target.value = ''; return; } doc.pal = S.PALETTES[e.target.value].map(S.hex2c); buildPalette(); } }, h('option', { value: '' }, 'paletas prontas…'), ...Object.keys(S.PALETTES).map(k => h('option', null, k)));
    const grid = h('div', { class: 'palgrid' });
    doc.pal.forEach((c, i) => grid.appendChild(h('div', { class: 'sw', style: { background: S.css(c) }, title: S.c2hex(c) + ' · clique: principal · Alt/direito: secundária · Ctrl+clique: apagar', 'data-i': i, onclick: e => { if (e.ctrlKey || e.metaKey) { doc.pal.splice(i, 1); buildPalette(); return; } if (e.altKey) st.bg = c; else st.fg = c; S.emit('color'); }, oncontextmenu: e => { e.preventDefault(); st.bg = c; S.emit('color'); } })));
    box.append(h('div', { class: 'row' }, sel), grid,
      h('div', { class: 'row' }, h('button', { class: 'tb', title: '5 tons com matiz deslocada', onclick: () => { doc.pal.push(...S.ramp(st.fg, 5)); buildPalette(); } }, '+ rampa'), h('button', { class: 'tb', title: 'cores usadas no desenho', onclick: () => { const set = new Set(); doc.layers.forEach(l => l.cels.forEach(c => c && c.forEach(v => { if (v >>> 24) set.add(v >>> 0); }))); doc.pal = [...set].slice(0, 256); buildPalette(); } }, 'do desenho'), h('button', { class: 'tb', title: 'encaixa a camada nas amostras', onclick: () => S.celOp('encaixar na paleta', c => S.mapToPalette(c.slice(), doc.pal)) }, 'encaixar')),
      h('div', { class: 'row' }, h('button', { class: 'tb', onclick: () => S.dlText(S.paletteText(doc.pal, 'gpl'), 'paleta.gpl', 'text/plain') }, 'baixar .gpl'), h('button', { class: 'tb', onclick: () => pickFile('.hex,.gpl,.txt,image/*', f => { if (/^image/.test(f.type)) { S.loadImage(URL.createObjectURL(f)).then(im => { const b = S.imageBuf(im); const set = new Set(); b.forEach(v => { if (v >>> 24) set.add(v | 0xFF000000); }); doc.pal = [...set].slice(0, 256).map(v => v >>> 0); buildPalette(); }); } else f.text().then(t => { const p = S.parsePalette(t); if (p.length) { doc.pal = p; buildPalette(); } }); }) }, 'abrir paleta')));
    markPal();
  }
  function markPal() { $$('#palPanel .sw').forEach(s => s.classList.toggle('on', doc && doc.pal[+s.dataset.i] === st.fg)); }

  /* ---------------- camadas (painel do PS) ---------------- */
  let dragLi = -1;
  function buildLayers() {
    const box = $('#layersPanel'); if (!box || !doc) return; box.innerHTML = ''; const L = doc.layers[doc.cur.l];
    const blend = h('select', { title: 'modo de mesclagem', onchange: e => { H.begin('modo de mesclagem', 'all'); L.blend = e.target.value; H.end(); refresh(); } }, ...Object.entries(S.BLENDS).map(([k, v]) => h('option', { value: k, selected: (L.blend || 'normal') === k }, v)));
    const op = h('input', { type: 'range', min: 0, max: 100, value: Math.round(L.op / 2.55), style: 'width:80px', title: 'opacidade (com a ferramenta Mover: teclas 1..0)', oninput: e => { L.op = Math.round(+e.target.value * 2.55); e.target.nextSibling.textContent = e.target.value + '%'; S.redraw(); updatePreviewCache(); }, onchange: () => { doc.dirty = true; scheduleSave(); } });
    box.append(h('div', { class: 'lyopts' }, blend, h('span', null, 'Opac.'), op, h('b', null, Math.round(L.op / 2.55) + '%')),
      h('div', { class: 'lyopts' }, h('span', { class: 'hint' }, 'Bloquear:'), h('label', { title: 'travar pixels transparentes (/)' }, h('input', { type: 'checkbox', checked: !!L.lockA, onchange: e => { L.lockA = e.target.checked; buildLayers(); } }), '▦ transp.'), h('label', { title: 'travar tudo' }, h('input', { type: 'checkbox', checked: !!L.lock, onchange: e => { L.lock = e.target.checked; buildLayers(); } }), '🔒 tudo')));
    const list = h('div', { id: 'layers' });
    for (let li = doc.layers.length - 1; li >= 0; li--) {
      const Ly = doc.layers[li], th = h('canvas', { width: 34, height: 28 }), tg = th.getContext('2d'), c = Ly.cels[doc.cur.f];
      if (c) { const cv = S.toCanvas(c, doc.w, doc.h), k = Math.min(34 / doc.w, 28 / doc.h); tg.imageSmoothingEnabled = k < 1; tg.drawImage(cv, (34 - doc.w * k) / 2, (28 - doc.h * k) / 2, doc.w * k, doc.h * k); }
      const row = h('div', { class: 'lyr' + (li === doc.cur.l ? ' on' : ''), draggable: 'true', onclick: () => { doc.cur.l = li; buildLayers(); }, ondblclick: e => { if (e.target.classList.contains('nm')) { const n = prompt('Nome da camada', Ly.name); if (n) { Ly.name = n; buildLayers(); scheduleSave(); } } else layerProps(li); } },
        h('button', { class: 'ib', title: Ly.vis ? 'esconder (Alt+clique: só esta)' : 'mostrar', onclick: e => { e.stopPropagation(); H.begin('visibilidade', 'all'); if (e.altKey) { const solo = doc.layers.every((l, i) => i === li || !l.vis); doc.layers.forEach((l, i) => l.vis = solo ? true : i === li); } else Ly.vis = !Ly.vis; H.end(); refresh(); } }, Ly.vis ? '👁' : '·'), th, h('span', { class: 'nm' }, (Ly.kind === 'ref' ? '📷 ' : '') + Ly.name), h('span', { class: 'bl' }, (Ly.blend && Ly.blend !== 'normal' ? S.BLENDS[Ly.blend] + ' ' : '') + (Ly.op < 255 ? Math.round(Ly.op / 2.55) + '%' : '') + (Ly.lock ? ' 🔒' : '') + (Ly.lockA ? ' ▦' : '')));
      row.addEventListener('dragstart', () => { dragLi = li; row.classList.add('drag'); });
      row.addEventListener('dragend', () => { row.classList.remove('drag'); $$('.lyr').forEach(r => r.classList.remove('dropT')); });
      row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('dropT'); });
      row.addEventListener('dragleave', () => row.classList.remove('dropT'));
      row.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); if (dragLi < 0 || dragLi === li) return; H.begin('reordenar camadas', 'all'); const [m] = doc.layers.splice(dragLi, 1); const to = dragLi < li ? li : li + 1; doc.layers.splice(Math.min(to, doc.layers.length), 0, m); doc.cur.l = doc.layers.indexOf(m); H.end(); dragLi = -1; refresh(); });
      list.appendChild(row);
    }
    box.append(list, h('div', { class: 'lybtns' }, h('button', { title: 'propriedades', onclick: () => layerProps(doc.cur.l) }, 'fx'), h('button', { title: 'mesclar abaixo (Ctrl+E)', onclick: ops.mergeDown }, '⤓'), h('button', { title: 'subir (Ctrl+])', onclick: () => ops.moveLayer(1) }, '▲'), h('button', { title: 'descer (Ctrl+[)', onclick: () => ops.moveLayer(-1) }, '▼'), h('button', { title: 'duplicar (Ctrl+J)', onclick: ops.dupLayer }, '⧉'), h('button', { title: 'nova camada (Ctrl+Shift+N)', onclick: () => ops.addLayer() }, '＋'), h('button', { title: 'apagar camada', onclick: ops.delLayer }, '🗑')));
  }
  function layerProps(li) { const L = doc.layers[li]; dialog('Propriedades da camada', box => { const nm = h('input', { type: 'text', value: L.name }), op = h('input', { type: 'range', min: 0, max: 255, value: L.op }), bm = h('select', null, ...Object.entries(S.BLENDS).map(([k, v]) => h('option', { value: k, selected: (L.blend || 'normal') === k }, v))), kind = h('select', null, h('option', { value: 'normal', selected: L.kind !== 'ref' }, 'normal'), h('option', { value: 'ref', selected: L.kind === 'ref' }, 'referência (não exporta)')); box.append(h('div', { class: 'row' }, 'nome ', nm), h('div', { class: 'row' }, 'opacidade ', op), h('div', { class: 'row' }, 'mesclagem ', bm), h('div', { class: 'row' }, 'tipo ', kind)); return [['OK', () => { H.begin('camada', 'all'); L.name = nm.value; L.op = +op.value; L.blend = bm.value; L.kind = kind.value; H.end(); refresh(); }]]; }); }

  /* ---------------- linha do tempo (quadros) ---------------- */
  function buildTimeline() {
    const box = $('#tl'); if (!box || !doc) return; const closed = box.classList.contains('closed'); box.innerHTML = ''; const N = doc.frames.length, f = doc.cur.f;
    box.append(h('div', { id: 'tlhead' },
      h('b', { style: 'cursor:pointer', title: 'clique pra recolher', onclick: () => box.classList.toggle('closed') }, 'Linha do tempo'), h('span', { class: 'hint' }, N + ' quadro(s)'),
      h('button', { class: 'tb', title: 'primeiro', onclick: () => goFrame(0) }, '⏮'), h('button', { class: 'tb', title: 'anterior (,)', onclick: () => goFrame(f - 1) }, '◀'), h('button', { class: 'tb' + (playing ? ' on' : ''), title: 'tocar (Enter sem seleção)', onclick: togglePlay }, playing ? '■' : '▶'), h('button', { class: 'tb', title: 'próximo (.)', onclick: () => goFrame(f + 1) }, '▶'),
      h('button', { class: 'tb', title: 'duplicar quadro (Alt+D)', onclick: () => ops.addFrame(true) }, '+ quadro'), h('button', { class: 'tb', title: 'quadro vazio', onclick: () => ops.addFrame(false) }, '+ vazio'), h('button', { class: 'tb', title: 'apagar quadro', onclick: ops.delFrame }, '🗑'), h('button', { class: 'tb', title: 'nova tag de animação', onclick: newTag }, '+ tag'), h('button', { class: 'tb', title: 'duração de todos', onclick: ops.allDur }, '⏱'),
      h('label', { class: 'hint', title: 'papel vegetal (onion skin)' }, ' papel vegetal ', h('select', { onchange: e => { const [a, b] = e.target.value.split(','); S.view.onion = +a; S.view.onionNext = +b; S.redraw(); } }, ...[['0,0', 'não'], ['1,0', '1 antes'], ['2,0', '2 antes'], ['1,1', 'antes+depois'], ['2,2', '2+2']].map(([v, t]) => h('option', { value: v, selected: v === S.view.onion + ',' + S.view.onionNext }, t))))));
    if (closed) box.classList.add('closed');
    const body = h('div', { id: 'tlbody' }), tags = h('div', { id: 'tltags', style: { width: N * 66 + 'px' } }), frs = h('div', { id: 'tlframes' });
    doc.tags.forEach((t, ti) => tags.appendChild(h('div', { class: 'ttag', style: { left: t.from * 66 + 'px', width: (t.to - t.from + 1) * 66 - 4 + 'px', background: t.cor || S.tagColor(ti) }, title: t.name + ' (' + (t.from + 1) + '–' + (t.to + 1) + ') · clique toca · duplo clique edita', onclick: () => { playTag = t; goFrame(t.from); if (!playing) togglePlay(); }, ondblclick: () => editTag(ti) }, t.name)));
    for (let i = 0; i < N; i++) {
      const cv = h('canvas', { width: 56, height: 44 }), g = cv.getContext('2d');
      const big = doc.w * doc.h > 300000; if (!big || Math.abs(i - f) < 12) { const fc = S.toCanvas(S.compose(doc, i, { skipRef: true }), doc.w, doc.h), k = Math.min(56 / doc.w, 44 / doc.h); g.imageSmoothingEnabled = k < 1; g.drawImage(fc, (56 - doc.w * k) / 2, (44 - doc.h * k) / 2, doc.w * k, doc.h * k); }
      frs.appendChild(h('div', { class: 'fr' + (i === f ? ' on' : ''), onclick: () => goFrame(i), ondblclick: () => { const v = prompt('Duração do quadro ' + (i + 1) + ' (ms)', doc.frames[i].dur); if (v && +v > 0) { H.begin('duração', 'all'); doc.frames[i].dur = Math.round(+v); H.end(); buildTimeline(); } } }, cv, h('div', null, String(i + 1)), h('small', null, doc.frames[i].dur + 'ms')));
    }
    body.append(tags, frs); box.appendChild(body);
    const on = frs.querySelector('.fr.on'); if (on && !closed) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function goFrame(i) { if (!doc) return; if (S.float) S.dropFloat(); doc.cur.f = (i + doc.frames.length) % doc.frames.length; buildTimeline(); buildLayers(); S.redraw(); }
  let playing = false, playTag = null, lastTick = 0;
  function togglePlay() { playing = !playing; if (!playing) playTag = null; lastTick = performance.now(); buildTimeline(); }
  function tick(now) {
    if (playing && doc && now - lastTick >= doc.frames[doc.cur.f].dur) { lastTick = now; let n = doc.cur.f + 1; if (playTag) { if (n > playTag.to || n < playTag.from) n = playTag.from; } doc.cur.f = n % doc.frames.length; S.redraw(); $$('#tlframes .fr').forEach((c, i) => c.classList.toggle('on', i === doc.cur.f)); }
    requestAnimationFrame(tick);
  }
  function newTag() { const name = prompt('Nome da animação (ex.: parado, andar, pular)', 'andar'); if (!name) return; const from = +prompt('Do quadro', doc.cur.f + 1) - 1, to = +prompt('Até o quadro', doc.frames.length) - 1; if (isNaN(from) || isNaN(to)) return; H.begin('nova tag', 'all'); doc.tags.push({ name, from: clamp(Math.min(from, to), 0, doc.frames.length - 1), to: clamp(Math.max(from, to), 0, doc.frames.length - 1), dir: 'frente', cor: S.tagColor(doc.tags.length) }); H.end(); buildTimeline(); }
  function editTag(i) { const t = doc.tags[i]; dialog('Tag "' + t.name + '"', box => { const nm = h('input', { type: 'text', value: t.name }), fr = h('input', { type: 'number', value: t.from + 1, style: 'width:60px' }), to = h('input', { type: 'number', value: t.to + 1, style: 'width:60px' }), dir = h('select', null, ...[['frente', 'pra frente'], ['tras', 'de trás pra frente'], ['vaievem', 'vai e vem']].map(([v, l]) => h('option', { value: v, selected: t.dir === v }, l))); box.append(h('div', { class: 'row' }, 'nome ', nm), h('div', { class: 'row' }, 'quadros ', fr, ' até ', to), h('div', { class: 'row' }, 'direção ', dir)); return [['Apagar', () => { H.begin('apagar tag', 'all'); doc.tags.splice(i, 1); H.end(); buildTimeline(); }, 'red'], ['OK', () => { H.begin('editar tag', 'all'); Object.assign(t, { name: nm.value || t.name, from: clamp(+fr.value - 1, 0, doc.frames.length - 1), to: clamp(+to.value - 1, 0, doc.frames.length - 1), dir: dir.value }); H.end(); buildTimeline(); }]]; }); }

  /* ---------------- operações ---------------- */
  const ops = S.ops = {
    addFrame(copy) { H.begin(copy ? 'duplicar quadro' : 'novo quadro', 'all'); const f = doc.cur.f; doc.frames.splice(f + 1, 0, { dur: doc.frames[f].dur }); doc.layers.forEach(l => l.cels.splice(f + 1, 0, copy && l.cels[f] ? l.cels[f].slice() : null)); doc.tags.forEach(t => { if (t.from > f) t.from++; if (t.to >= f) t.to++; }); doc.cur.f++; H.end(); refresh(); },
    delFrame() { if (doc.frames.length < 2) return S.toast('Precisa ter 1 quadro'); H.begin('apagar quadro', 'all'); const f = doc.cur.f; doc.frames.splice(f, 1); doc.layers.forEach(l => l.cels.splice(f, 1)); doc.tags = doc.tags.filter(t => !(t.from === f && t.to === f)).map(t => ({ ...t, from: t.from > f ? t.from - 1 : t.from, to: t.to >= f ? t.to - 1 : t.to })); doc.cur.f = Math.min(f, doc.frames.length - 1); H.end(); refresh(); },
    moveFrame(d) { const f = doc.cur.f, j = f + d; if (j < 0 || j >= doc.frames.length) return; H.begin('mover quadro', 'all'); [doc.frames[f], doc.frames[j]] = [doc.frames[j], doc.frames[f]]; doc.layers.forEach(l => { [l.cels[f], l.cels[j]] = [l.cels[j], l.cels[f]]; }); doc.cur.f = j; H.end(); refresh(); },
    reverseFrames() { H.begin('inverter quadros', 'all'); doc.frames.reverse(); doc.layers.forEach(l => l.cels.reverse()); H.end(); refresh(); },
    allDur() { const v = prompt('Duração de todos os quadros (ms)', doc.frames[doc.cur.f].dur); if (!v || +v <= 0) return; H.begin('duração', 'all'); doc.frames.forEach(f => f.dur = Math.round(+v)); H.end(); refresh(); },
    addLayer(name, cels) { H.begin('nova camada', 'all'); const L = S.newLayer(name || 'Camada ' + (doc.layers.length + 1)); L.cels = cels || doc.frames.map(() => null); doc.layers.splice(doc.cur.l + 1, 0, L); doc.cur.l++; H.end(); refresh(); },
    dupLayer() { if (doc.sel || S.float) return ops.selToLayer(false); H.begin('duplicar camada', 'all'); const s = doc.layers[doc.cur.l], L = S.newLayer(s.name + ' cópia', { op: s.op, blend: s.blend, cels: s.cels.map(c => c ? c.slice() : null) }); doc.layers.splice(doc.cur.l + 1, 0, L); doc.cur.l++; H.end(); refresh(); },
    selToLayer(cut) { if (S.float) S.dropFloat(); const src = doc.layers[doc.cur.l].cels[doc.cur.f]; if (!src || !doc.sel) return; const m = doc.sel.mask, c = new Uint32Array(src.length); for (let i = 0; i < c.length; i++) if (m[i]) c[i] = src[i]; if (cut) S.celOp('recortar', cc => cc.map((v, i) => m[i] ? 0 : v)); const cels = doc.frames.map((_, fi) => fi === doc.cur.f ? c : null); ops.addLayer(cut ? 'Camada via recorte' : 'Camada via cópia', cels); },
    delLayer() { if (doc.layers.length < 2) return S.toast('Precisa ter 1 camada'); H.begin('apagar camada', 'all'); doc.layers.splice(doc.cur.l, 1); doc.cur.l = Math.max(0, doc.cur.l - 1); H.end(); refresh(); },
    moveLayer(d) { const i = doc.cur.l, j = i + d; if (j < 0 || j >= doc.layers.length) return; H.begin('mover camada', 'all'); [doc.layers[i], doc.layers[j]] = [doc.layers[j], doc.layers[i]]; doc.cur.l = j; H.end(); refresh(); },
    mergeDown() { const i = doc.cur.l; if (i < 1) return S.toast('Não tem camada embaixo'); H.begin('mesclar abaixo', 'all'); const top = doc.layers[i]; doc.frames.forEach((_, f) => { if (!top.cels[f]) return; const b = S.celW(doc, i - 1, f), t = top.cels[f]; for (let k = 0; k < b.length; k++) if (t[k] >>> 24) b[k] = top.blend && top.blend !== 'normal' ? S.blendPx(t[k], b[k], top.blend, top.op / 255) : S.over(t[k], b[k], top.op / 255); }); doc.layers.splice(i, 1); doc.cur.l = i - 1; H.end(); refresh(); },
    mergeVisible() { H.begin('mesclar visíveis', 'all'); const cels = doc.frames.map((_, f) => S.compose(doc, f, { skipRef: true })); doc.layers = doc.layers.filter(l => !l.vis || l.kind === 'ref'); doc.layers.push(S.newLayer('Mesclado', { cels })); doc.cur.l = doc.layers.length - 1; H.end(); refresh(); },
    flatten() { H.begin('achatar imagem', 'all'); const cels = doc.frames.map((_, f) => S.compose(doc, f, { skipRef: true })); doc.layers = [S.newLayer('Fundo', { cels })]; doc.cur.l = 0; H.end(); refresh(); },
    resize(nw, nh, anchor) { nw = clamp(nw | 0, 1, 1024); nh = clamp(nh | 0, 1, 1024); const ax = anchor[1] === 'e' ? 0 : anchor[1] === 'd' ? 1 : 0.5, ay = anchor[0] === 'c' ? 0 : anchor[0] === 'b' ? 1 : 0.5; const ox = Math.round((nw - doc.w) * ax), oy = Math.round((nh - doc.h) * ay); H.begin('tamanho da tela', 'all'); doc.layers.forEach(l => l.cels = l.cels.map(c => { if (!c) return null; const o = new Uint32Array(nw * nh); for (let y = 0; y < doc.h; y++) for (let x = 0; x < doc.w; x++) { const X = x + ox, Y = y + oy; if (X >= 0 && Y >= 0 && X < nw && Y < nh) o[Y * nw + X] = c[y * doc.w + x]; } return o; })); doc.w = nw; doc.h = nh; doc.sel = null; H.end(); refresh(true); },
    scaleSprite(k, smart) { const nw = Math.max(1, Math.round(doc.w * k)), nh = Math.max(1, Math.round(doc.h * k)); if (nw > 1024 || nh > 1024) return S.toast('Passaria de 1024px'); H.begin('tamanho da imagem', 'all'); doc.layers.forEach(l => l.cels = l.cels.map(c => c ? (smart ? S.pxScale(c, doc.w, doc.h, k).buf : S.xf.scale(c, doc.w, doc.h, nw, nh).buf) : null)); doc.w = nw; doc.h = nh; doc.sel = null; H.end(); refresh(true); },
    cropRect(x, y, w, hh) { H.begin('cortar', 'all'); doc.layers.forEach(l => l.cels = l.cels.map(c => { if (!c) return null; const o = new Uint32Array(w * hh); for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) o[j * w + i] = c[(y + j) * doc.w + x + i]; return o; })); doc.w = w; doc.h = hh; doc.sel = null; H.end(); refresh(true); },
    cropToContent() { let bb = null; doc.frames.forEach((_, f) => { const b = S.bboxOf(S.compose(doc, f, { all: true }), doc.w, doc.h); if (b) bb = bb ? { x: Math.min(bb.x, b.x), y: Math.min(bb.y, b.y), x2: Math.max(bb.x2, b.x + b.w), y2: Math.max(bb.y2, b.y + b.h) } : { x: b.x, y: b.y, x2: b.x + b.w, y2: b.y + b.h }; }); if (bb) ops.cropRect(bb.x, bb.y, bb.x2 - bb.x, bb.y2 - bb.y); },
    cropToSel() { if (!doc.sel) return S.toast('Faça uma seleção'); ops.cropRect(doc.sel.x, doc.sel.y, doc.sel.w, doc.sel.h); },
    fill(col) { S.celOp('preencher', c => c.map((v, i) => S.inSel(i) && (!doc.layers[doc.cur.l].lockA || (v >>> 24)) ? col : v)); },
    outline(color, outside) { S.celOp('contorno', (c, w, hh) => { const o = c.slice(); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = y * w + x; const filled = (X, Y) => X >= 0 && Y >= 0 && X < w && Y < hh && (c[Y * w + X] >>> 24); if (outside) { if (c[i] >>> 24 || !S.inSel(i)) continue; if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) o[i] = color; } else { if (!(c[i] >>> 24) || !S.inSel(i)) continue; if (!filled(x + 1, y) || !filled(x - 1, y) || !filled(x, y + 1) || !filled(x, y - 1)) o[i] = color; } } return o; }); },
    invert() { S.celOp('inverter cores', c => c.map((v, i) => (v >>> 24) && S.inSel(i) ? S.pack(255 - S.R(v), 255 - S.G(v), 255 - S.B(v), v >>> 24) : v)); },
    desat() { S.celOp('dessaturar', c => c.map((v, i) => { if (!(v >>> 24) || !S.inSel(i)) return v; const l = Math.round(0.3 * S.R(v) + 0.59 * S.G(v) + 0.11 * S.B(v)); return S.pack(l, l, l, v >>> 24); })); },
    hueSat() { dialog('Matiz/Saturação (Ctrl+U)', box => { const hh = h('input', { type: 'range', min: -180, max: 180, value: 0 }), s = h('input', { type: 'range', min: -100, max: 100, value: 0 }), v = h('input', { type: 'range', min: -100, max: 100, value: 0 }), all = h('input', { type: 'checkbox' }); box.append(h('div', { class: 'row' }, 'matiz ', hh), h('div', { class: 'row' }, 'saturação ', s), h('div', { class: 'row' }, 'luminosidade ', v), h('label', { class: 'row' }, all, ' todos os quadros')); return [['OK', () => S.celOp('matiz/saturação', c => c.map((p, i) => { if (!(p >>> 24) || !S.inSel(i)) return p; const [a, b, cc] = S.rgb2hsv(S.R(p), S.G(p), S.B(p)); return S.pack(...S.hsv2rgb((a + +hh.value + 360) % 360, clamp(b + s.value / 100, 0, 1), clamp(cc + v.value / 100, 0, 1)), p >>> 24); }), { allFrames: all.checked })]]; }); },
    levels() { dialog('Brilho/Contraste (Ctrl+L)', box => { const b = h('input', { type: 'range', min: -100, max: 100, value: 0 }), c = h('input', { type: 'range', min: -100, max: 100, value: 0 }); box.append(h('div', { class: 'row' }, 'brilho ', b), h('div', { class: 'row' }, 'contraste ', c)); return [['OK', () => { const bb = +b.value * 1.28, ct = +c.value * 1.28, k = (259 * (ct + 255)) / (255 * (259 - ct)); const f = x => clamp(Math.round(k * (x - 128) + 128 + bb), 0, 255); S.celOp('brilho/contraste', cc => cc.map((p, i) => (p >>> 24) && S.inSel(i) ? S.pack(f(S.R(p)), f(S.G(p)), f(S.B(p)), p >>> 24) : p)); }]]; }); },
    posterize() { const n = +prompt('Quantas cores no máximo?', 8); if (!n) return; S.celOp('limitar cores', c => { const set = new Map(); c.forEach(v => { if (v >>> 24) set.set(v, (set.get(v) || 0) + 1); }); const pal = [...set.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]); return S.mapToPalette(c.slice(), pal); }); },
    autoShade() { S.applyMagic('sombra'); },
    cleanOrphans() { S.applyMagic('limpar'); },
  };

  /* ---------------- área de transferência ---------------- */
  let clip = null, lastSel = null;
  function copySel(cut, merged) { if (S.float) { clip = { buf: S.float.buf.slice(), w: S.float.w, h: S.float.h, x: S.float.x, y: S.float.y }; return; } const sel = doc.sel || { x: 0, y: 0, w: doc.w, h: doc.h, mask: null }; const c = merged ? S.compose(doc, doc.cur.f, { skipRef: true }) : doc.layers[doc.cur.l].cels[doc.cur.f]; if (!c) return; const b = new Uint32Array(sel.w * sel.h); for (let y = 0; y < sel.h; y++) for (let x = 0; x < sel.w; x++) { const i = (sel.y + y) * doc.w + sel.x + x; if (!sel.mask || sel.mask[i]) b[y * sel.w + x] = c[i]; } clip = { buf: b, w: sel.w, h: sel.h, x: sel.x, y: sel.y }; if (cut) S.celOp('recortar', cc => cc.map((v, i) => S.inSel(i) ? 0 : v)); S.toast(cut ? 'Recortado' : merged ? 'Copiado (mesclado)' : 'Copiado'); try { S.toCanvas(b, sel.w, sel.h).toBlob(bl => navigator.clipboard && window.ClipboardItem && navigator.clipboard.write([new ClipboardItem({ 'image/png': bl })]).catch(() => { })); } catch (e) { } }
  function pasteClip(c2, inPlace) { c2 = c2 || clip; if (!c2) return; if (S.float) S.dropFloat(); H.begin('colar'); H.touch(doc.cur.l, doc.cur.f); const x = inPlace && c2.x != null ? c2.x : Math.round((doc.w - c2.w) / 2), y = inPlace && c2.y != null ? c2.y : Math.round((doc.h - c2.h) / 2); S.float = { buf: c2.buf.slice(), w: c2.w, h: c2.h, x, y, x0: x, y0: y }; S.setTool('move'); S.redraw(); S.toast('Colado — arraste; Enter fixa'); }
  S.pasteBuf = (buf, w, hh) => pasteClip({ buf, w, h: hh });

  /* ---------------- documentos ---------------- */
  function openDoc(d, select) { d.layers.forEach(l => { l.blend = l.blend || 'normal'; }); S.docs.push(d); hists.set(d.id, S.History(d)); if (select !== false) selectDoc(d); buildTabs(); return d; }
  S.openDoc = openDoc;
  function selectDoc(d) { if (S.float) S.dropFloat(); doc = d; H = hists.get(d.id); S.setDoc(d, H); syncHSV(); buildPalette(); refresh(true); buildTabs(); buildHist(); }
  S.selectDoc = selectDoc;
  function closeDoc(d) { if (d.dirty && !confirm('"' + d.name + '" foi salvo sozinho em Projetos, mas não foi baixado. Fechar?')) return; const i = S.docs.indexOf(d); S.docs.splice(i, 1); hists.delete(d.id); if (!S.docs.length) openDoc(S.newDoc(64, 64, { name: 'Sem título' })); else if (doc === d) selectDoc(S.docs[Math.max(0, i - 1)]); buildTabs(); }
  function buildTabs() { const box = $('#doctabs'); if (!box) return; box.innerHTML = ''; S.docs.forEach(d => box.appendChild(h('div', { class: 'dtab' + (d === doc ? ' on' : ''), onclick: () => selectDoc(d), title: d.w + '×' + d.h + ' · ' + d.frames.length + ' quadro(s) · ' + d.layers.length + ' camada(s)' }, h('span', null, d.name + (d === doc ? ' @ ' + Math.round(S.view.z * 100) + '%' : '') + (d.dirty ? ' *' : '')), h('button', { class: 'ib', title: 'fechar (Ctrl+W)', onclick: e => { e.stopPropagation(); closeDoc(d); } }, '×')))); box.appendChild(h('button', { class: 'dtab add', title: 'novo (Ctrl+N)', onclick: newDialog }, '+')); if (S.refreshMapUI && workspace === 'map') S.refreshMapUI(); }
  function refresh(fit) { if (!doc) return; if (fit) S.fit(); buildTimeline(); buildLayers(); S.redraw(); updatePreviewCache(); status(); buildTabs(); }
  S.refresh = refresh;
  let tlT = 0; S.on('change', () => { updatePreviewCache(); status(); scheduleSave(); clearTimeout(tlT); tlT = setTimeout(() => { buildTimeline(); buildLayers(); }, 80); });
  S.on('structure', () => refresh(true));
  S.on('history', () => { buildHist(); buildTabs(); });
  S.on('zoom', () => { status(); buildTabs(); if (st.tool === 'zoom') buildCtx(); });

  let saveT = 0;
  function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(() => { if (!doc) return; const d = doc; const th = S.toCanvas(S.compose(d, 0, { skipRef: true }), d.w, d.h); const tc = document.createElement('canvas'), k = Math.min(1, 96 / Math.max(d.w, d.h)) || 1; tc.width = Math.max(1, d.w * k); tc.height = Math.max(1, d.h * k); const tg = tc.getContext('2d'); tg.imageSmoothingEnabled = k < 1; tg.drawImage(th, 0, 0, tc.width, tc.height); S.store.put(d, tc.toDataURL()).then(() => { $('#saveInfo').textContent = 'salvo sozinho às ' + new Date().toLocaleTimeString().slice(0, 5); S.store.kvSet('open', S.docs.map(x => x.id)).catch(() => { }); }).catch(() => { $('#saveInfo').textContent = 'não deu pra salvar sozinho'; }); }, 900); }

  /* ---------------- histórico ---------------- */
  function buildHist() { const box = $('#histPanel'); if (!box || !H) return; box.innerHTML = ''; const from = Math.max(0, H.list.length - 100); box.appendChild(h('div', { class: 'hi' + (H.i === -1 ? ' on' : ''), onclick: () => { H.go(-1); refresh(); } }, '📄 Abrir')); for (let i = from; i < H.list.length; i++) box.appendChild(h('div', { class: 'hi' + (i === H.i ? ' on' : i > H.i ? ' fut' : ''), onclick: () => { H.go(i); refresh(); } }, H.list[i].label)); box.scrollTop = box.scrollHeight; }
  function undo() { if (S.transform) { S.cancelTransform(); refresh(); return; } if (S.float) S.dropFloat(); const l = H.undo(); if (l) { S.toast('Desfeito: ' + l); refresh(); } }
  function redo() { const l = H.redo(); if (l) { S.toast('Refeito: ' + l); refresh(); } }
  S.undo = undo; S.redo = redo;

  /* ---------------- prévia (no topo do dock) ---------------- */
  let prevFrames = [], pf = 0, pacc = 0, plast = performance.now();
  function updatePreviewCache() { if (!doc) return; const kome = $('#pvKome').checked, tag = $('#pvTag').value; let fs = doc.frames.map((_, i) => i); const t = doc.tags.find(t2 => t2.name === tag); if (t) { fs = []; for (let i = t.from; i <= t.to; i++) fs.push(i); } if (doc.w * doc.h > 400000) fs = fs.slice(0, 8); prevFrames = fs.map(f => ({ cv: kome ? S.komeStyle(S.compose(doc, f, { skipRef: true }), doc.w, doc.h) : S.toCanvas(S.compose(doc, f, { skipRef: true }), doc.w, doc.h), dur: doc.frames[f].dur })); const sel = $('#pvTag'), cur = sel.value; sel.innerHTML = ''; sel.appendChild(h('option', { value: '' }, 'tudo')); doc.tags.forEach(t2 => sel.appendChild(h('option', { value: t2.name, selected: t2.name === cur }, t2.name))); }
  function previewLoop(now) {
    const cv = $('#pv'); if (cv && doc && prevFrames.length && !$('#pPrev').classList.contains('closed') && workspace === 'draw') {
      const g = cv.getContext('2d'), W = cv.width, Hh = cv.height, dt = now - plast; plast = now; if ($('#pvPlay').checked) { pacc += dt; if (pacc >= prevFrames[pf % prevFrames.length].dur) { pacc = 0; pf = (pf + 1) % prevFrames.length; } } else pf = Math.min(prevFrames.length - 1, doc.cur.f);
      g.imageSmoothingEnabled = false; const bg = $('#pvBg').value, gy = Hh - 20, t = now / 1000;
      try { if (bg === 'xadrez') { g.fillStyle = '#d6ccb6'; g.fillRect(0, 0, W, Hh); } else { const tod = bg === 'noite' ? 0.95 : bg === 'tarde' ? 0.74 : 0.35; E.Nature.sky(g, W, Hh, { tod, t }); E.Nature.ground(g, 0, W, gy, { t, depth: 30, seed: 1 }); } } catch (e) { g.fillStyle = '#9FD3E8'; g.fillRect(0, 0, W, Hh); }
      const fr = prevFrames[pf % prevFrames.length].cv, showK = $('#pvWithK').checked; let s = +$('#pvScale').value; const real = s === 0; if (real) s = 1;
      const avail = showK ? W - 70 : W - 10; if (!real) { s = Math.max(1, Math.floor(Math.min(avail / fr.width, (Hh - 26) / fr.height))); if (fr.width * s > avail || fr.height * s > Hh - 26) s = Math.min(avail / fr.width, (Hh - 26) / fr.height); }
      const x = showK ? 60 + (W - 60) / 2 : W / 2, bb = S.bboxOf(S.compose(doc, 0, { skipRef: true }), doc.w, doc.h), footPad = bb ? (doc.h - (bb.y + bb.h)) : 0;
      g.imageSmoothingEnabled = s < 1; g.drawImage(fr, Math.round(x - fr.width * s / 2), Math.round(gy - (fr.height - footPad - ($('#pvKome').checked ? 1 : 0)) * s), Math.round(fr.width * s), Math.round(fr.height * s)); g.imageSmoothingEnabled = false;
      if (showK) try { E.drawShiba(g, 32, gy, $('#pvPose').value, t, { scale: real ? 1 : Math.max(1, Math.min(3, Math.round(s))) }); } catch (e) { }
    }
    requestAnimationFrame(previewLoop);
  }

  /* ---------------- "O que é isso?" ---------------- */
  let typeSel = 'cachorro', typePrev = null, tpF = 0, tpAcc = 0, tpLast = 0, tpTag = 0;
  S.setTypeSel = id => { if (S.TYPES.find(t => t.id === id)) { typeSel = id; buildTypes(); } };
  function buildTypes() {
    const box = $('#typePanel'); box.innerHTML = ''; const groups = {}; S.TYPES.forEach(t => (groups[t.grupo] = groups[t.grupo] || []).push(t));
    const grid = h('div', { class: 'typegrid' }); for (const gname in groups) { grid.appendChild(h('div', { class: 'tg' }, gname)); groups[gname].forEach(t => grid.appendChild(h('button', { class: 'chip' + (t.id === typeSel ? ' on' : ''), title: t.nome + ' · ' + t.altura + 'px no jogo', onclick: () => { typeSel = t.id; buildTypes(); } }, t.nome.split(' (')[0]))); }
    const T = S.TYPES.find(t => t.id === typeSel);
    const alt = h('input', { type: 'range', id: 'tAlt', min: 6, max: 256, value: T.altura, oninput: e => { $('#tAltV').textContent = e.target.value; prevType(); } });
    const tags = h('div', { class: 'chips' }, ...T.tags.map(([n, q]) => h('label', { class: 'chip on' }, h('input', { type: 'checkbox', checked: true, 'data-tag': n }), n + ' (' + q + ')')));
    box.append(h('div', { class: 'hint' }, 'Desenhe e diga o que é: ele acha as partes, anima e põe na escala do jogo.'), grid, h('div', { class: 'row' }, 'altura no jogo ', alt, h('b', { id: 'tAltV' }, String(T.altura)), 'px', h('span', { class: 'hint' }, ' (Kome ≈ 40)')), h('div', { class: 'row' }, 'exagero ', h('input', { type: 'range', id: 'tAmp', min: 1, max: 5, value: 2, oninput: prevType })), tags,
      h('canvas', { id: 'tPrev', width: 280, height: 110, class: 'tprev' }), h('div', { class: 'hint', id: 'tInfo' }), h('div', { class: 'row' }, h('button', { class: 'tb big green', onclick: applyType }, 'Animar como ' + T.nome.split(' (')[0].toLowerCase())));
    prevType();
  }
  function prevType() { if (!doc || !$('#tAlt')) return; if (doc.w * doc.h > 250000) { $('#tInfo').textContent = 'Desenho grande: a prévia aparece ao animar.'; typePrev = null; return; } const buf = S.compose(doc, doc.cur.f, { skipRef: true }); typePrev = S.previewType(buf, doc.w, doc.h, typeSel, +$('#tAlt').value, +$('#tAmp').value); if (typePrev) { typePrev.cvs = typePrev.tags.map(t => t.frames.map(f => S.toCanvas(f, typePrev.w, typePrev.h))); $('#tInfo').textContent = 'vira ' + typePrev.w + '×' + typePrev.h + ' px · ' + typePrev.an.legs.length + ' pata(s)/perna(s) · olhando pra ' + (typePrev.an.facing < 0 ? 'esquerda' : 'direita'); } else $('#tInfo').textContent = 'Desenhe alguma coisa primeiro.'; }
  function typeLoop(now) {
    const cv = $('#tPrev'); if (cv && cv.offsetParent && typePrev && typePrev.cvs.length) {
      const g = cv.getContext('2d'); if (now - tpLast > 110) { tpLast = now; tpF++; if (tpF >= typePrev.cvs[tpTag % typePrev.cvs.length].length) { tpF = 0; tpAcc++; if (tpAcc >= 2) { tpAcc = 0; tpTag = (tpTag + 1) % typePrev.cvs.length; } } }
      g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#5a5a5a'; g.fillRect(0, cv.height - 10, cv.width, 10);
      const set = typePrev.cvs[tpTag % typePrev.cvs.length], fr = set[tpF % set.length]; let s = 1; if (fr.width > cv.width - 70 || fr.height > cv.height - 14) s = Math.min((cv.width - 70) / fr.width, (cv.height - 14) / fr.height);
      g.imageSmoothingEnabled = s < 1; g.drawImage(fr, Math.round(70 + (cv.width - 70) / 2 - fr.width * s / 2), Math.round(cv.height - 9 - fr.height * s), fr.width * s, fr.height * s); g.imageSmoothingEnabled = false;
      try { E.drawShiba(g, 30, cv.height - 9, 'sit', now / 1000, { scale: 1 }); } catch (e) { } g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(typePrev.tags[tpTag % typePrev.tags.length].name, 6, 13);
    }
    requestAnimationFrame(typeLoop);
  }
  function applyType() { const tags = $$('#typePanel [data-tag]').filter(i => i.checked).map(i => i.dataset.tag); const r = S.applyType(doc, H, { type: typeSel, altura: +$('#tAlt').value, tags, amp: +$('#tAmp').value }); if (r) { S.toast('Pronto! ' + r.frames + ' quadros: ' + r.tags.join(', ')); sfx('sparkle'); refresh(true); } }
  S.on('change', () => { clearTimeout(prevType.t); prevType.t = setTimeout(() => { if ($('#typePanel').offsetParent) prevType(); }, 400); });

  /* ---------------- propriedades do documento ---------------- */
  function buildProps() { const box = $('#propsPanel'); if (!box || !doc) return; box.innerHTML = ''; const m = doc.meta || (doc.meta = {}); const nm = h('input', { type: 'text', value: doc.name, onchange: e => { doc.name = e.target.value || doc.name; buildTabs(); scheduleSave(); } }), tipo = h('select', { onchange: e => { m.tipo = e.target.value; scheduleSave(); } }, ...['enfeite', 'bicho', 'personagem', 'comida', 'objeto', 'planta', 'construção', 'veículo', 'roupa', 'cenário'].map(t => h('option', { selected: m.tipo === t }, t))); box.append(h('div', { class: 'row' }, 'nome ', nm), h('div', { class: 'row' }, 'tipo no jogo ', tipo), h('div', { class: 'hint' }, doc.w + '×' + doc.h + ' px · ' + doc.frames.length + ' quadro(s) · ' + doc.layers.length + ' camada(s) · tile ' + doc.tile.w + '×' + doc.tile.h), h('div', { class: 'row' }, h('button', { class: 'tb', onclick: resizeDialog }, 'Tamanho da tela…'), h('button', { class: 'tb', onclick: scaleDialog }, 'Tamanho da imagem…'), h('button', { class: 'tb', onclick: tileDialog }, 'Tile…')), (m.bicho || m.builder) ? h('div', { class: 'row' }, h('button', { class: 'tb magic', onclick: () => m.bicho ? S.openCreature(m.bicho) : S.openBuilder(m.builder, m.params) }, '✨ Reabrir o construtor')) : null, h('div', { class: 'row' }, h('button', { class: 'tb green', onclick: exportDialog }, 'Exportar pro jogo…'))); }

  /* ---------------- diálogos ---------------- */
  function dialog(title, build, o) {
    const ov = h('div', { class: 'ov' }), box = h('div', { class: 'dlg' + (o && o.wide ? ' wide' : '') }), body = h('div', { class: 'dbody' });
    const close = () => ov.remove();
    box.append(h('div', { class: 'dhead' }, h('b', null, title), h('span', { style: 'flex:1' }), h('button', { class: 'ib', onclick: close }, '×')), body);
    const btns = build(body, close) || []; const foot = h('div', { class: 'dfoot' }, h('button', { class: 'tb', onclick: close }, 'Cancelar'), ...btns.map(([t, fn, k]) => h('button', { class: 'tb ' + (k || 'green'), onclick: () => { if (fn() !== false) close(); } }, t)));
    if (btns.length) box.appendChild(foot); ov.appendChild(box); ov.onclick = e => { if (e.target === ov) close(); }; document.body.appendChild(ov);
    const first = box.querySelector('input,select'); if (first) first.focus(); return { close, body };
  }
  S.dialog = dialog;
  function pickFile(accept, fn, multiple) { const i = h('input', { type: 'file', accept, multiple }); i.onchange = () => { [...i.files].forEach(fn); }; i.click(); }
  S.pickFile = pickFile;
  function newDialog() {
    const dl = dialog('Novo documento (Ctrl+N)', box => {
      const w = h('input', { type: 'number', value: 64, min: 1, max: 1024, style: 'width:80px' }), hh = h('input', { type: 'number', value: 64, min: 1, max: 1024, style: 'width:80px' }), nm = h('input', { type: 'text', value: 'Sem título' }), pal = h('select', null, ...Object.keys(S.PALETTES).map(k => h('option', null, k)));
      const presets = [['16×16 ícone/tile', 16, 16], ['32×32 item', 32, 32], ['48×48 Kome', 48, 48], ['64×64 personagem', 64, 64], ['128×128 casa', 128, 128], ['256×256 castelo', 256, 256], ['512×512 gigante', 512, 512], ['320×180 cena', 320, 180], ['768×240 vila', 768, 240], ['256×64 tileset', 256, 64]];
      box.append(h('div', { class: 'row' }, 'nome ', nm), h('div', { class: 'chips' }, ...presets.map(([t, a, b]) => h('button', { class: 'chip', onclick: () => { w.value = a; hh.value = b; } }, t))), h('div', { class: 'row' }, 'largura ', w, ' altura ', hh, ' px (até 1024)'), h('div', { class: 'row' }, 'amostras ', pal), h('div', { class: 'row' }, h('button', { class: 'tb', onclick: () => { dl.close(); S.openRascunhos(); } }, 'ou comece de um rascunho pronto →')));
      return [['Criar', () => { const d = S.newDoc(clamp(+w.value, 1, 1024), clamp(+hh.value, 1, 1024), { name: nm.value || 'Sem título', pal: S.PALETTES[pal.value] }); d.tile = { w: Math.min(16, d.w), h: Math.min(16, d.h) }; openDoc(d); }]];
    });
  }
  function resizeDialog() { dialog('Tamanho da tela (Ctrl+Alt+C)', box => { const w = h('input', { type: 'number', value: doc.w, style: 'width:80px' }), hh = h('input', { type: 'number', value: doc.h, style: 'width:80px' }), an = h('select', null, ...[['bm', 'embaixo no meio (pés no chão)'], ['mm', 'no meio'], ['ce', 'canto de cima/esquerda'], ['cm', 'em cima no meio']].map(([v, t]) => h('option', { value: v }, t))); box.append(h('div', { class: 'row' }, 'largura ', w, ' altura ', hh), h('div', { class: 'row' }, 'âncora ', an)); return [['OK', () => ops.resize(+w.value, +hh.value, an.value)]]; }); }
  function scaleDialog() { dialog('Tamanho da imagem (Ctrl+Alt+I)', box => { const k = h('input', { type: 'number', value: 200, step: 25, style: 'width:80px' }), sm = h('input', { type: 'checkbox', checked: true }); box.append(h('div', { class: 'row' }, 'escala ', k, ' %'), h('label', { class: 'row' }, sm, ' redução esperta (mantém contorno e cores)')); return [['OK', () => ops.scaleSprite(+k.value / 100, sm.checked)]]; }); }
  function tileDialog() { dialog('Tamanho do tile', box => { const w = h('input', { type: 'number', value: doc.tile.w, style: 'width:70px' }), hh = h('input', { type: 'number', value: doc.tile.h, style: 'width:70px' }); box.append(h('div', { class: 'row' }, w, ' × ', hh, ' px'), h('div', { class: 'hint' }, 'Grade azul e fatiamento do Mapa. Visualizar → Repetir em volta mostra se o tile emenda.')); return [['OK', () => { doc.tile = { w: Math.max(1, +w.value), h: Math.max(1, +hh.value) }; S.redraw(); }]]; }); }
  function rotateDialog() { dialog('Girar', box => { const a = h('input', { type: 'number', value: 45, style: 'width:80px' }); box.append(h('div', { class: 'row' }, a, ' graus (camada ou seleção)')); return [['Girar', () => S.floatOp((b, w, hh) => S.xf.rotate(b, w, hh, +a.value), 'girar')]]; }); }
  function fillDialog() { dialog('Preencher (Shift+F5)', box => { const s = h('select', null, h('option', { value: 'fg' }, 'cor principal'), h('option', { value: 'bg' }, 'cor secundária'), h('option', { value: 'clear' }, 'transparente')); box.append(h('div', { class: 'row' }, 'conteúdo ', s)); return [['OK', () => ops.fill(s.value === 'fg' ? st.fg : s.value === 'bg' ? st.bg : 0)]]; }); }
  function exportDialog() {
    dialog('Exportar "' + doc.name + '"', box => {
      const fmt = h('select', null, ...[['sheet', 'Spritesheet PNG + JSON (Aseprite/Godot/Unity/Phaser)'], ['pack', 'Pacote pra engine Pixxel (.pixxel.js)'], ['gif', 'GIF animado'], ['png', 'PNG do quadro atual'], ['frames', 'Cada quadro num PNG'], ['layers', 'Cada camada num PNG'], ['ficha', 'Ficha do jogo (letras)'], ['projeto', 'Projeto .pixxel']].map(([v, t]) => h('option', { value: v }, t)));
      const sc = h('select', null, ...[1, 2, 3, 4, 6, 8, 10].map(k => h('option', { value: k }, k + '×'))), kome = h('input', { type: 'checkbox' }), lay = h('select', null, h('option', { value: 'linha' }, 'uma linha'), h('option', { value: 'grade' }, 'grade'), h('option', { value: 'tags' }, 'uma linha por tag')), tag = h('select', null, h('option', { value: '' }, 'todas'), ...doc.tags.map(t => h('option', null, t.name)));
      box.append(h('div', { class: 'row' }, 'formato ', fmt), h('div', { class: 'row' }, 'escala ', sc, ' ', h('label', null, kome, ' estilo Kome (contorno + luz)')), h('div', { class: 'row' }, 'folha ', lay, ' tag ', tag));
      return [['Exportar', () => { const o = { scale: +sc.value, kome: kome.checked, layout: lay.value, tag: tag.value }; const f = fmt.value; if (f === 'sheet') S.exportSheet(doc, o); else if (f === 'pack') S.exportEnginePack(doc, o); else if (f === 'gif') S.exportGIF(doc, o); else if (f === 'png') S.exportPNG(doc, o); else if (f === 'frames') doc.frames.forEach((_, i) => setTimeout(() => S.scaleCv(S.frameCanvas(doc, i, o), o.scale).toBlob(b => S.dlBlob(b, S.slug(doc.name) + '-' + i + '.png')), i * 150)); else if (f === 'layers') doc.layers.forEach((l, i) => setTimeout(() => { const c = l.cels[doc.cur.f]; if (c) S.scaleCv(S.toCanvas(c, doc.w, doc.h), o.scale).toBlob(b => S.dlBlob(b, S.slug(doc.name) + '-' + S.slug(l.name) + '.png')); }, i * 150)); else if (f === 'ficha') { const t = S.fichaText(doc); navigator.clipboard && navigator.clipboard.writeText(t); S.dlText(t, S.slug(doc.name) + '.ficha.js', 'text/javascript'); S.toast('Ficha copiada e baixada'); } else saveFile(); }]];
    });
  }
  S.exportDialog = exportDialog;
  function saveFile() { S.dlText(JSON.stringify(S.serialize(doc)), S.slug(doc.name) + '.pixxel', 'application/json'); doc.dirty = false; buildTabs(); }
  function importImage(f, asLayer) {
    if (/\.pixxel$|\.json$/i.test(f.name)) { f.text().then(t => { try { const o = JSON.parse(t); if (o.app === 'pixxel-estudio' || o.layers) openDoc(S.deserialize(o)); else S.toast('JSON não reconhecido'); } catch (e) { S.toast('Arquivo inválido'); } }); return; }
    S.loadImage(URL.createObjectURL(f)).then(im => {
      const buf = S.imageBuf(im), k = S.detectScale(buf, im.width, im.height);
      dialog('Abrir "' + f.name + '" (' + im.width + '×' + im.height + ')', box => {
        const scale = h('input', { type: 'number', value: k, min: 1, max: 16, style: 'width:60px' }), slice = h('input', { type: 'checkbox', checked: im.width > im.height * 1.8 }), fw = h('input', { type: 'number', value: im.height / k, style: 'width:70px' }), fh = h('input', { type: 'number', value: im.height / k, style: 'width:70px' }), pal = h('input', { type: 'checkbox' }), lay = h('input', { type: 'checkbox', checked: !!asLayer }), maxw = h('input', { type: 'number', value: Math.min(512, Math.round(im.width / k)), style: 'width:70px' }), mag = h('input', { type: 'checkbox' });
        box.append(h('div', { class: 'row' }, 'pixel ampliado ', scale, '× ', h('span', { class: 'hint' }, k > 1 ? '(detectado: pixel art ' + k + 'x)' : '')), h('div', { class: 'row' }, 'largura máxima ', maxw, ' px'), h('label', { class: 'row' }, slice, ' folha de sprites: fatiar em ', fw, '×', fh), h('label', { class: 'row' }, pal, ' encaixar nas amostras'), h('label', { class: 'row' }, mag, ' ✨ pixelizar limpo + estilo Kome (pra foto/desenho)'), h('label', { class: 'row' }, lay, ' entrar como camada nova'));
        return [['Abrir', () => {
          let s = Math.max(1, +scale.value), W = Math.floor(im.width / s), Hh = Math.floor(im.height / s), b = S.pxScale(buf, im.width, im.height, 1 / s).buf;
          if (W > +maxw.value) { const r = S.pxScale(b, W, Hh, +maxw.value / W); b = r.buf; W = r.w; Hh = r.h; }
          if (pal.checked) S.mapToPalette(b, doc.pal);
          let frames = [b], FW = W, FH = Hh;
          if (slice.checked) { FW = Math.max(1, Math.round(+fw.value * W / (im.width / s))); FH = Math.max(1, Math.round(+fh.value * Hh / (im.height / s))); frames = S.sliceSheet(b, W, Hh, FW, FH, { skipEmpty: true }); }
          if (lay.checked) { const cels = doc.frames.map((_, i) => { const src = frames[i % frames.length], o = new Uint32Array(doc.w * doc.h); for (let y = 0; y < Math.min(FH, doc.h); y++) for (let x = 0; x < Math.min(FW, doc.w); x++) o[(doc.h - Math.min(FH, doc.h) + y) * doc.w + Math.floor((doc.w - Math.min(FW, doc.w)) / 2) + x] = src[y * FW + x]; return o; }); ops.addLayer(f.name.replace(/\..*/, ''), cels); return; }
          const d = S.newDoc(FW, FH, { name: f.name.replace(/\..*/, '') }); d.frames = frames.map(() => ({ dur: 100 })); d.layers = [S.newLayer('Fundo', { cels: frames })]; d.cur = { f: 0, l: 0 }; openDoc(d);
          if (mag.checked) { S.applyMagic('pixelizar', { allFrames: true }); S.applyMagic('kome', { allFrames: true }); }
        }]];
      });
    });
  }
  S.importImage = importImage;
  function projectsDialog() { const dl = dialog('Projetos salvos neste computador', box => { box.appendChild(h('div', { class: 'hint' }, 'Carregando…')); S.store.list().then(list => { box.innerHTML = ''; if (!list.length) box.appendChild(h('div', { class: 'hint' }, 'Nada ainda.')); const g = h('div', { class: 'gal' }); list.forEach(it => g.appendChild(h('div', { class: 'gitem' }, it.thumb ? h('img', { src: it.thumb }) : h('div', { class: 'noimg' }), h('div', { class: 'nm' }, it.name), h('div', { class: 'hint' }, it.w + '×' + it.h + ' · ' + it.nf + 'q'), h('div', { class: 'row' }, h('button', { class: 'tb', onclick: () => { const open = S.docs.find(d => d.id === it.id); if (open) { selectDoc(open); dl.close(); return; } S.store.get(it.id).then(d => { if (d) { openDoc(d); dl.close(); } }); } }, 'Abrir'), h('button', { class: 'tb red', onclick: e => { if (confirm('Apagar "' + it.name + '"?')) S.store.del(it.id).then(() => e.target.closest('.gitem').remove()); } }, 'Apagar'))))); box.appendChild(g); }); return []; }, { wide: true }); }
  function helpDialog() {
    const K = [['Ferramentas (as letras do Photoshop)', '<b>V</b> mover · <b>M</b> letreiro · <b>L</b> laço · <b>W</b> varinha · <b>C</b> cortar · <b>I</b> conta-gotas · <b>J</b> corretor · <b>B</b> lápis e pincéis · <b>S</b> carimbo · <b>E</b> borracha · <b>G</b> degradê/lata · <b>O</b> clarear/escurecer/esponja · <b>T</b> texto · <b>U</b> formas · <b>H</b> mão · <b>Z</b> zoom · <b>Shift+letra</b> alterna dentro do grupo · botão direito no ícone abre o grupo'],
      ['Navegar', '<b>Espaço</b>+arrastar mão · <b>roda</b> zoom no cursor · <b>Ctrl++</b>/<b>Ctrl+-</b> zoom · <b>Ctrl+0</b> caber · <b>Ctrl+1</b> 100% · <b>Tab</b> esconde painéis · <b>F</b> tela cheia'],
      ['Editar', '<b>Ctrl+Z</b> desfazer · <b>Ctrl+Shift+Z</b>/<b>Ctrl+Y</b> refazer · <b>Ctrl+Alt+Z</b> voltar passo · <b>Ctrl+X/C/V</b> · <b>Ctrl+Shift+C</b> copiar mesclado · <b>Ctrl+Shift+V</b> colar no lugar · <b>Del</b> apagar · <b>Ctrl+T</b> transformação livre · <b>Alt+Backspace</b> preencher com a principal · <b>Ctrl+Backspace</b> com a secundária · <b>Shift+F5</b> preencher'],
      ['Selecionar', '<b>Ctrl+A</b> tudo · <b>Ctrl+D</b> desmarcar · <b>Ctrl+Shift+D</b> remarcar · <b>Ctrl+Shift+I</b> inverter · <b>Enter</b> fixa/aplica · <b>Esc</b> cancela'],
      ['Camadas', '<b>Ctrl+Shift+N</b> nova · <b>Ctrl+J</b> duplicar / camada via cópia · <b>Ctrl+Shift+J</b> camada via recorte · <b>Ctrl+E</b> mesclar abaixo · <b>Ctrl+Shift+E</b> mesclar visíveis · <b>Ctrl+[ ]</b> mover · <b>Alt+[ ]</b> selecionar abaixo/acima · <b>/</b> travar transparência · <b>1…0</b> opacidade (com Mover: da camada; senão: do pincel) · Alt+clique no olho: só esta camada'],
      ['Imagem e ajustes', '<b>Ctrl+U</b> matiz/saturação · <b>Ctrl+L</b> brilho/contraste · <b>Ctrl+I</b> inverter · <b>Ctrl+Shift+U</b> dessaturar · <b>Ctrl+Alt+I</b> tamanho da imagem · <b>Ctrl+Alt+C</b> tamanho da tela'],
      ['Cor e pincel', '<b>D</b> cores padrão (contorno Kome / creme) · <b>X</b> trocar · <b>[ ]</b> pincel menor/maior · <b>Alt+clique</b> conta-gotas'],
      ['Arquivo, estúdio e animação', '<b>Ctrl+N</b> novo · <b>Ctrl+O</b> abrir · <b>Ctrl+S</b> salvar · <b>Ctrl+Shift+Alt+W</b> exportar · <b>Ctrl+W</b> fechar · <b>Alt+R</b> rascunhos · <b>Ctrl+B</b> construir · <b>Ctrl+Shift+L</b> biblioteca · <b>, .</b> quadro anterior/próximo · <b>Enter</b> tocar · <b>Alt+D</b> duplicar quadro'],
      ['Pixel art bonita', 'luz de cima/esquerda · sombra fria, luz quente ("+ rampa") · poucas cores · nada de pixel solto nem sombra em volta de tudo · silhueta primeiro · ✨ Filtro/Mágica faz isso tudo num clique']];
    dialog('Atalhos e dicas', box => { box.innerHTML = '<div class="help">' + K.map(([a, b]) => '<h4>' + a + '</h4><p>' + b + '</p>').join('') + '</div>'; return []; }, { wide: true });
  }

  /* ---------------- menus (como no Photoshop) ---------------- */
  function menus() { return {
    Arquivo: [['Início…', '', () => S.openHome()], ['Novo…', 'Ctrl+N', newDialog], ['Rascunhos prontos…', 'Alt+R', () => S.openRascunhos()], ['Abrir…', 'Ctrl+O', () => pickFile('image/*,.pixxel,.json', f => importImage(f), true)], ['Projetos salvos…', '', projectsDialog], ['Inserir imagem como camada…', '', () => pickFile('image/*', f => importImage(f, true))], '-', ['Salvar (.pixxel)', 'Ctrl+S', saveFile], ['Exportar…', 'Ctrl+Shift+Alt+W', exportDialog], ['Exportar GIF', '', () => S.exportGIF(doc, { scale: 4 })], ['Exportar spritesheet + JSON', '', () => S.exportSheet(doc, { layout: 'tags' })], ['Pacote pra engine (.pixxel.js)', '', () => S.exportEnginePack(doc, {})], ['Copiar ficha do jogo', '', () => { const t = S.fichaText(doc); navigator.clipboard && navigator.clipboard.writeText(t); S.toast('Ficha copiada'); }], '-', ['Fechar', 'Ctrl+W', () => closeDoc(doc)]],
    Editar: [['Desfazer', 'Ctrl+Z', undo], ['Refazer', 'Ctrl+Shift+Z', redo], '-', ['Recortar', 'Ctrl+X', () => copySel(true)], ['Copiar', 'Ctrl+C', () => copySel(false)], ['Copiar mesclado', 'Ctrl+Shift+C', () => copySel(false, true)], ['Colar', 'Ctrl+V', () => pasteClip()], ['Colar no lugar', 'Ctrl+Shift+V', () => pasteClip(null, true)], ['Apagar', 'Del', () => S.celOp('apagar', c => c.map((v, i) => S.inSel(i) ? 0 : v))], '-', ['Preencher…', 'Shift+F5', fillDialog], ['Contorno por fora (cor principal)', '', () => ops.outline(st.fg, true)], ['Contorno por dentro', '', () => ops.outline(st.fg, false)], '-', ['Transformação livre', 'Ctrl+T', () => S.startTransform()], ['Virar na horizontal', '', () => S.floatOp(S.xf.flipH, 'virar horizontal')], ['Virar na vertical', '', () => S.floatOp(S.xf.flipV, 'virar vertical')], ['Girar 90°', '', () => S.floatOp(S.xf.rot90, 'girar 90°')], ['Girar…', '', rotateDialog]],
    Imagem: [['Matiz/Saturação…', 'Ctrl+U', ops.hueSat], ['Brilho/Contraste…', 'Ctrl+L', ops.levels], ['Inverter', 'Ctrl+I', ops.invert], ['Dessaturar', 'Ctrl+Shift+U', ops.desat], ['Limitar cores…', '', ops.posterize], ['Encaixar nas amostras', '', () => S.celOp('encaixar na paleta', c => S.mapToPalette(c.slice(), doc.pal))], '-', ['Tamanho da imagem…', 'Ctrl+Alt+I', scaleDialog], ['Tamanho da tela…', 'Ctrl+Alt+C', resizeDialog], ['Cortar no desenho', '', ops.cropToContent], ['Cortar na seleção', '', ops.cropToSel], ['Tamanho do tile…', '', tileDialog]],
    Camada: [['Nova camada', 'Ctrl+Shift+N', () => ops.addLayer()], ['Duplicar / camada via cópia', 'Ctrl+J', ops.dupLayer], ['Camada via recorte', 'Ctrl+Shift+J', () => ops.selToLayer(true)], ['Apagar camada', '', ops.delLayer], '-', ['Mesclar abaixo', 'Ctrl+E', ops.mergeDown], ['Mesclar visíveis', 'Ctrl+Shift+E', ops.mergeVisible], ['Achatar imagem', '', ops.flatten], '-', ['Trazer pra frente', 'Ctrl+]', () => ops.moveLayer(1)], ['Enviar pra trás', 'Ctrl+[', () => ops.moveLayer(-1)], ['Propriedades…', '', () => layerProps(doc.cur.l)], ['Travar transparência', '/', () => { const L = doc.layers[doc.cur.l]; L.lockA = !L.lockA; buildLayers(); S.toast('Transparência ' + (L.lockA ? 'travada' : 'livre')); }], '-', ['Imagem de referência…', '', () => pickFile('image/*', f => S.loadImage(URL.createObjectURL(f)).then(im => { const k = Math.min(doc.w / im.width, doc.h / im.height); S.view.ref = { img: im, x: 0, y: 0, w: im.width * k, h: im.height * k }; S.redraw(); }))], ['Tirar referência', '', () => { S.view.ref = null; S.redraw(); }]],
    Selecionar: [['Tudo', 'Ctrl+A', () => S.selectAll()], ['Desmarcar', 'Ctrl+D', () => { lastSel = doc.sel; S.deselect(); }], ['Remarcar', 'Ctrl+Shift+D', () => { if (lastSel) { doc.sel = lastSel; S.redraw(); } }], ['Inverter', 'Ctrl+Shift+I', () => S.invertSel()], ['Fixar seleção flutuante', 'Enter', () => S.dropFloat()]],
    Filtro: S.MAGIC.map(m => [m.nome, '', () => S.applyMagic(m.id)]).concat([['✨ Variações de cor', '', S.magicVariations]]),
    Construir: [['Bicho…', 'Ctrl+B', () => S.openCreature()], ['Casa / castelo…', '', () => S.openBuilder('casa')], ['Vila…', '', () => S.openVila({ seed: 1 + Math.floor(Math.random() * 999) })], ['Máquina…', '', () => S.openBuilder('maquina')], ['Rua & chão (tileset)…', '', () => S.openBuilder('chao')], ['Coisas da rua…', '', () => S.openBuilder('props')], '-', ['Todos os construtores…', '', () => S.openBuildHub()], ['Biblioteca (jogo, Kome, pacotes)…', 'Ctrl+Shift+L', () => S.openLibrary()], ['Reabrir o construtor deste desenho', '', () => { const m = doc.meta || {}; if (m.bicho) S.openCreature(m.bicho); else if (m.builder) S.openBuilder(m.builder, m.params); else S.toast('Este desenho não veio de um construtor'); }]],
    Animação: [['Novo quadro (copia)', 'Alt+D', () => ops.addFrame(true)], ['Novo quadro vazio', '', () => ops.addFrame(false)], ['Apagar quadro', '', ops.delFrame], ['Mover quadro ◀', '', () => ops.moveFrame(-1)], ['Mover quadro ▶', '', () => ops.moveFrame(1)], ['Inverter ordem', '', ops.reverseFrames], ['Duração de todos…', '', ops.allDur], ['Nova tag…', '', newTag], ['Tocar / pausar', 'Enter', togglePlay], '-', ['✨ Animar sozinho (O que é isso?)', '', () => S.focusPanel('tipo')]],
    Visualizar: [['Caber na tela', 'Ctrl+0', () => S.fit()], ['100%', 'Ctrl+1', () => S.zoomAt(1)], ['Aproximar', 'Ctrl++', () => S.zoomAt(S.view.z * 1.25)], ['Afastar', 'Ctrl+-', () => S.zoomAt(S.view.z / 1.25)], '-', ['Grade de pixels', "Ctrl+'", () => { S.view.pgrid = !S.view.pgrid; S.redraw(); }], ['Grade de tiles', "Ctrl+Shift+'", () => { S.view.grid = !S.view.grid; S.redraw(); }], ['Repetir em volta (tile)', 'Shift+T', () => { S.view.tiled = !S.view.tiled; S.redraw(); }], ['Esconder painéis', 'Tab', () => document.body.classList.toggle('nopanels')], ['Tela cheia', 'F', fullscreen], ['Tema claro (Kome) / escuro (PS)', '', () => { document.documentElement.classList.toggle('claro'); try { localStorage.setItem('pxe-tema', document.documentElement.classList.contains('claro') ? 'claro' : 'escuro'); } catch (e) { } }], ['Som ligado/desligado', '', () => { S.sound = !S.sound; S.toast('Som ' + (S.sound ? 'ligado' : 'desligado')); }]],
    Ajuda: [['Atalhos e dicas', 'F1', helpDialog], ['✨ Modo guiado', '', () => S.guidesDialog()]],
  }; }
  function fullscreen() { if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); else document.exitFullscreen && document.exitFullscreen(); }
  function buildMenus() {
    const bar = $('#menubar'), M = menus(); let open = null;
    const closeAll = () => { $$('.menu').forEach(m => m.remove()); open = null; $$('#menubar .mb').forEach(b => b.classList.remove('on')); };
    Object.keys(M).forEach(name => {
      const b = h('button', { class: 'mb' }, name);
      const show = () => { closeAll(); b.classList.add('on'); open = name; const r = b.getBoundingClientRect(), m = h('div', { class: 'menu', style: { left: r.left + 'px', top: r.bottom + 'px' } }); M[name].forEach(it => { if (it === '-') { m.appendChild(h('hr')); return; } m.appendChild(h('button', { class: 'mi', onclick: () => { closeAll(); it[2](); } }, h('span', null, it[0]), h('small', null, it[1]))); }); document.body.appendChild(m); };
      b.onclick = e => { e.stopPropagation(); open === name ? closeAll() : show(); }; b.onmouseenter = () => { if (open && open !== name) show(); };
      bar.appendChild(b);
    });
    addEventListener('click', e => { if (!e.target.closest('.menu')) closeAll(); });
  }

  /* ---------------- teclado (atalhos do Photoshop) ---------------- */
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || $('.ov') || $('.playov')) return;
    if (workspace !== 'draw' && !(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase(), C2 = e.ctrlKey || e.metaKey, Sh = e.shiftKey, Al = e.altKey;
    const run = fn => { e.preventDefault(); fn(); };
    if (C2) {
      if (k === 'z') return run(Al ? undo : Sh ? redo : undo); if (k === 'y') return run(redo);
      if (k === 'c' && Al) return run(resizeDialog);
      if (k === 'c') return run(() => copySel(false, Sh)); if (k === 'x') return run(() => copySel(true)); if (k === 'v') return run(() => { if (clip) pasteClip(null, Sh); });
      if (k === 'a') return run(() => S.selectAll()); if (k === 'd') return run(() => { if (Sh) { if (lastSel) { doc.sel = lastSel; S.redraw(); } } else { lastSel = doc.sel; S.deselect(); } });
      if (k === 'i') return run(() => Sh ? S.invertSel() : Al ? scaleDialog() : ops.invert());
      if (k === 'n') return run(() => Sh ? ops.addLayer() : newDialog()); if (k === 'o') return run(() => pickFile('image/*,.pixxel,.json', f => importImage(f), true));
      if (k === 's') return run(saveFile); if (k === 'w') return run(() => Sh && Al ? exportDialog() : closeDoc(doc)); if (k === 'e') return run(() => Sh ? ops.mergeVisible() : ops.mergeDown());
      if (k === 't') return run(() => S.startTransform()); if (k === 'j') return run(() => Sh ? ops.selToLayer(true) : ops.dupLayer());
      if (k === 'u') return run(() => Sh ? ops.desat() : ops.hueSat()); if (k === 'l') return run(() => Sh ? S.openLibrary() : ops.levels());
      if (k === 'b') return run(() => S.openBuildHub()); if (k === '0') return run(() => S.fit()); if (k === '1') return run(() => S.zoomAt(1));
      if (k === '+' || k === '=') return run(() => S.zoomAt(S.view.z * 1.25)); if (k === '-') return run(() => S.zoomAt(S.view.z / 1.25));
      if (k === '[') return run(() => ops.moveLayer(-1)); if (k === ']') return run(() => ops.moveLayer(1));
      if (k === "'") return run(() => { if (Sh) S.view.grid = !S.view.grid; else S.view.pgrid = !S.view.pgrid; S.redraw(); });
      if (k === 'backspace') return run(() => ops.fill(st.bg));
      return;
    }
    if (Al) { if (k === 'backspace') return run(() => ops.fill(st.fg)); if (k === 'd') return run(() => ops.addFrame(true)); if (k === 'r') return run(() => S.openRascunhos()); if (k === '[') return run(() => { doc.cur.l = Math.max(0, doc.cur.l - 1); buildLayers(); }); if (k === ']') return run(() => { doc.cur.l = Math.min(doc.layers.length - 1, doc.cur.l + 1); buildLayers(); }); return; }
    if (k === 'enter') return run(() => { if (S.applyTransform()) { refresh(); return; } if (st.tool === 'crop' && S.hasCrop()) { S.applyCrop(); return; } if (S.closePoly()) return; if (S.float) S.dropFloat(); else togglePlay(); });
    if (k === 'escape') return run(() => { if (S.cancelTransform()) { refresh(); return; } if (S.cancelOverlays()) return; if (S.float) S.dropFloat(); else S.deselect(); });
    if (k === 'delete' || k === 'backspace') return run(() => { if (S.float) { S.float = null; S.transform = null; H.end(); S.redraw(); refresh(); } else S.celOp('apagar', c => c.map((v, i) => S.inSel(i) ? 0 : v)); });
    if (k === 'f1') return run(helpDialog); if (k === 'tab') return run(() => document.body.classList.toggle('nopanels'));
    if (Sh && k === 'f5') return run(fillDialog);
    if (k === ',') return run(() => goFrame(doc.cur.f - 1)); if (k === '.') return run(() => goFrame(doc.cur.f + 1));
    if (k === '[') return run(() => { st.brush = Math.max(1, st.brush - 1); buildCtx(); }); if (k === ']') return run(() => { st.brush = Math.min(32, st.brush + 1); buildCtx(); });
    if (k === '/') return run(() => { const L = doc.layers[doc.cur.l]; L.lockA = !L.lockA; buildLayers(); S.toast('Transparência ' + (L.lockA ? 'travada' : 'livre')); });
    if (/^[0-9]$/.test(k)) return run(() => { const v = k === '0' ? 100 : +k * 10; if (st.tool === 'move') { const L = doc.layers[doc.cur.l]; H.begin('opacidade', 'all'); L.op = Math.round(v * 2.55); H.end(); refresh(); S.toast('Opacidade da camada ' + v + '%'); } else { st.opacity = v; buildCtx(); S.toast('Opacidade do pincel ' + v + '%'); } });
    if (k.startsWith('arrow') && (S.float || st.tool === 'move' || doc.sel)) return run(() => { const d = Sh ? 8 : 1, dx = k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, dy = k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0; const F = S.liftFloat(); if (F) { F.x += dx; F.y += dy; S.redraw(); } });
    if (k === 'x') return run(swap); if (k === 'd' && !Sh) return run(defColors);
    if (k === 'f' && !Sh) return run(fullscreen);
    if (Sh && k === 't') return run(() => { S.view.tiled = !S.view.tiled; S.redraw(); });
    const key = e.key.toUpperCase(); if (/^[VMLWCIJBSEGOTUHZ]$/.test(key)) return run(() => Sh ? cycleGroup(key) : toolForKey(key));
  });
  addEventListener('paste', e => { if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; const it = [...((e.clipboardData || {}).items || [])].find(i => i.type.startsWith('image/')); if (it) { e.preventDefault(); S.loadImage(URL.createObjectURL(it.getAsFile())).then(im => { const b = S.imageBuf(im), k = S.detectScale(b, im.width, im.height), r = S.pxScale(b, im.width, im.height, 1 / k); pasteClip({ buf: r.buf, w: r.w, h: r.h }); }); } });
  addEventListener('dragover', e => e.preventDefault()); addEventListener('drop', e => { e.preventDefault(); [...e.dataTransfer.files].forEach(f => importImage(f)); });

  /* ---------------- status ---------------- */
  function status() { if (!doc) return; $('#stSize').textContent = doc.w + '×' + doc.h + ' px · ' + doc.frames.length + ' quadro(s) · ' + doc.layers.length + ' camada(s)'; $('#stZoom').textContent = Math.round(S.view.z * 100) + '%'; }
  S.on('cursor', (x, y) => { $('#stPos').textContent = (doc && x >= 0 && y >= 0 && x < doc.w && y < doc.h) ? 'X ' + x + '  Y ' + y : '—'; });

  /* ---------------- espaços de trabalho e divisória ---------------- */
  let workspace = 'draw';
  function setWorkspace(w) { workspace = w; $$('#quick [data-ws]').forEach(b => b.classList.toggle('on', b.dataset.ws === w)); ['#center', '#split', '#dock', '#tools'].forEach(s => $(s).style.display = w === 'draw' ? '' : 'none'); $('#ctx').style.visibility = w === 'draw' ? '' : 'hidden'; $('#wsMap').style.display = w === 'map' ? '' : 'none'; if (w === 'map') { if (!$('#wsMap').childElementCount) S.mountMap($('#wsMap')); else S.refreshMapUI(); } if (w === 'draw') S.redraw(); }
  S.setWorkspace = setWorkspace;
  function splitter() { const sp = $('#split'); sp.onpointerdown = e => { sp.setPointerCapture(e.pointerId); sp.onpointermove = ev => { const w = clamp(innerWidth - ev.clientX, 240, 560); document.documentElement.style.setProperty('--dockw', w + 'px'); }; sp.onpointerup = () => { sp.onpointermove = null; try { localStorage.setItem('pxe-dockw', getComputedStyle(document.documentElement).getPropertyValue('--dockw')); } catch (e2) { } }; }; try { const w = localStorage.getItem('pxe-dockw'); if (w) document.documentElement.style.setProperty('--dockw', w); if (localStorage.getItem('pxe-tema') === 'claro') document.documentElement.classList.add('claro'); } catch (e) { } }

  /* ---------------- começo ---------------- */
  S.boot = async function () {
    splitter(); buildMenus(); setupPanels(); buildTools(); buildCtx(); S.initEditor($('#cv'), $('#cvwrap'));
    $$('#quick [data-ws]').forEach(b => b.onclick = () => setWorkspace(b.dataset.ws));
    $('#pvBg').onchange = $('#pvKome').onchange = $('#pvTag').onchange = updatePreviewCache;
    const poses = ['sit', 'wag', 'stand', 'walk', 'run', 'jump', 'dance', 'cheer', 'eat', 'sleep', 'wave', 'proud', 'think', 'surprise', 'dig', 'sniff', 'yawn', 'howl', 'roll', 'bow', 'stretch', 'shake', 'carry', 'point', 'cry', 'pant', 'scratch', 'dizzy', 'sword', 'slash', 'push', 'climb'];
    $('#pvPose').innerHTML = poses.map(p => '<option>' + p + '</option>').join(''); $('#pvPose').value = 'wag';
    let reopened = 0;
    try { const ids = await S.store.kvGet('open'); if (ids && ids.length) for (const id of ids) { const d = await S.store.get(id); if (d) { openDoc(d, false); reopened++; } } } catch (e) { }
    if (!reopened) openDoc(S.newDoc(64, 64, { name: 'Sem título' }), false);
    selectDoc(S.docs[0]); buildColor(); buildTypes(); buildHist(); S.magicPanel($('#magicPanel')); S.setTool('pen');
    requestAnimationFrame(tick); requestAnimationFrame(previewLoop); requestAnimationFrame(typeLoop);
    if (reopened) S.toast(reopened + ' desenho(s) reabertos ✓'); else setTimeout(() => S.openHome(), 300);
    window.__studio = S;
  };
  S.getDoc = () => doc; S.getHist = () => H;
})();
