/* ==========================================================================
   Kome Engine v1.0 · ui.js — HUD em DOM por cima do canvas (par do kome.css)
   Depende só de core.js. Se pix.js estiver carregado, os ícones embutidos são
   pixel art (E.UI.icons); sem ele, viram glifos de texto (nunca emoji).
   Índice:
     1. base (DOM, relógio próprio, som opcional)      9. missões, metas
     2. ícones                                        10. álbum
     3. mount / zonas                                 11. ajustes (linha, toggle, slider)
     4. pílula, número rolante                        12. sparkline, taxa, medidor radial
     5. barra, meta                                   13. árvore (grafo de nós com pan/zoom)
     6. botão                                         14. export
     7. painel, abas, diálogo, confirmar
     8. banner, toast, conquista, celebração, tooltip
   ========================================================================== */
(function () {
  'use strict';
  const E = (window.KomeEngine = window.KomeEngine || {});
  if (!E.U) throw new Error('KomeEngine: carregue core.js antes de ui.js');
  const U = E.U, doc = document, TAU = Math.PI * 2;
  const INK = '#2a1a10', CREAM = '#fffaee', YEL = '#ffe9a8', GOLD = '#f3c94a';
  const UI = { root: null, sound: true, fmt: U.fmt };

  /* ======================================================================
     1. Base
     ====================================================================== */
  // h(tag, classe?, pai?, texto?) -> elemento
  function h(tag, cls, parent, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  // par(p): resolve o pai de um componente (elemento, handle com .el, ou a raiz atual)
  function par(p) { return p ? (p.el && p.el.nodeType ? p.el : p) : UI.root; }
  function need() { if (!UI.root) throw new Error('KomeEngine: chame E.UI.mount(stage) antes'); return UI.root; }

  /* relógio próprio: só roda enquanto existe algo animando (número rolando, árvore aberta) */
  const ticks = [];
  let raf = 0, lastNow = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    for (let i = ticks.length - 1; i >= 0; i--) if (ticks[i](dt, now / 1000) === false) ticks.splice(i, 1);
    if (ticks.length) raf = requestAnimationFrame(frame);
  }
  // tick(fn(dt,t)): registra uma animação; fn devolve false pra sair
  function tick(fn) {
    ticks.push(fn);
    if (!raf) { lastNow = performance.now(); raf = requestAnimationFrame(frame); }
    return fn;
  }

  // E.UI.sfx(nome, opts): toca um som da engine se audio.js existir e E.UI.sound estiver ligado (nunca quebra)
  function sfx(name, o) {
    if (!UI.sound || !E.Sfx || !E.Sfx.play) return;
    try { E.Sfx.play(name, o); } catch (e) { /* áudio é opcional */ }
  }

  // pressable(el): estado .k-press confiável no toque (o :active do iOS falha) + pulinho .k-pop ao soltar
  function pressable(el, pop) {
    const up = () => {
      if (!el.classList.contains('k-press')) return;
      el.classList.remove('k-press');
      if (pop) { el.classList.remove('k-pop'); void el.offsetWidth; el.classList.add('k-pop'); }
    };
    el.addEventListener('pointerdown', e => { if (e.button) return; el.classList.add('k-press'); });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', () => el.classList.remove('k-press'));
    el.addEventListener('pointercancel', () => el.classList.remove('k-press'));
    if (pop) el.addEventListener('animationend', e => { if (e.animationName === 'k-pop') el.classList.remove('k-pop'); });
  }
  // replay(el, classe): reinicia uma animação CSS de classe
  function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function setText(el, s) { if (el.__t !== s) { el.__t = s; el.textContent = s; } }

  /* ======================================================================
     2. Ícones
     ====================================================================== */
  /* conjunto embutido: 16x16 desenhado com Pix (contorno incluso). Cada entrada é fn(P, C); pode devolver fn(Q) com traços SEM contorno. */
  const ICON_DEFS = {
    yen(P, C) {
      P.ell(8, 8, 6.6, 6.6, C.gold).arc(8, 8, 5, 3.3, 4.9, 1, C.goldL).arc(8, 8, 5, 0.2, 1.9, 1, C.goldD);
      const k = '#7A5A14';
      P.set(6, 4, k).set(10, 4, k).set(6, 5, k).set(10, 5, k).set(7, 6, k).set(9, 6, k).rect(8, 7, 1, 5, k).rect(6, 8, 5, 1, k).rect(6, 10, 5, 1, k);
    },
    rice(P, C) {
      P.line(5.6, 11.4, 11.2, 5.2, 6.6, C.riceD).line(5.2, 11, 10.8, 4.8, 6, C.riceS).line(4.9, 10.5, 10.3, 4.5, 4.6, C.rice);
      P.line(5, 8, 8, 4, 1, C.white).set(3, 12, C.riceD).set(4, 13, C.riceD).set(4, 12, C.riceS);
    },
    sack(P, C) {
      P.rrect(2, 6, 12, 9, 3, C.sack).rect(6, 4, 4, 2, C.sackD).poly([[4, 1], [12, 1], [10, 4], [6, 4]], C.sack);
      P.rect(11, 8, 2, 6, C.sackD).rect(4, 13, 8, 1, C.sackD).rect(6, 5, 4, 1, C.red);
      P.ell(7.5, 10, 2.4, 2.4, C.red).set(7, 9, C.redL).rect(3, 8, 1, 3, C.cream);
    },
    gear(P, C) {
      const d = '#5A524A';
      P.rect(7, 1, 2, 14, C.steelD).rect(1, 7, 14, 2, C.steelD);
      P.line(3.5, 3.5, 12.5, 12.5, 2.4, C.steelD).line(12.5, 3.5, 3.5, 12.5, 2.4, C.steelD);
      P.ell(8, 8, 5, 5, C.steel).arc(8, 8, 3.6, 3.4, 5, 1, C.steelL).arc(8, 8, 3.8, 0.3, 1.8, 1, C.steelD).ell(8, 8, 2, 2, d);
    },
    sound(P, C) { speaker(P, C); return Q => Q.arc(6.5, 7.5, 4.5, -0.7, 0.7, 1, C.line).arc(6.5, 7.5, 7, -0.75, 0.75, 1, C.line); },
    mute(P, C) { speaker(P, C); return Q => Q.line(11, 6, 14.6, 9.6, 2, C.red).line(14.6, 6, 11, 9.6, 2, C.red); },
    music(P, C) {
      P.rect(6, 3, 1, 9, C.bowl).rect(12, 2, 1, 9, C.bowl).poly([[6, 2], [13, 1], [13, 4], [6, 5]], C.bowl);
      P.ell(4.5, 12, 2.4, 2, C.bowl).ell(10.5, 11, 2.4, 2, C.bowl).set(4, 11, C.bowlL).set(10, 10, C.bowlL);
    },
    tree(P, C) {
      P.rect(7, 10, 2, 5, C.wood).rect(8, 11, 1, 4, C.woodD).set(6, 14, C.wood).set(9, 14, C.woodD);
      P.ell(8, 6.3, 6, 5, C.grass).ell(5, 8, 3, 2.6, C.grass).ell(11, 8, 3, 2.6, C.grass);
      P.ell(6.3, 4.4, 2.6, 1.8, C.grassL).dither(8, 8, 6, 3, C.grassD, 'checker', { mask: true }).rect(4, 10, 8, 1, C.grassD);
      P.set(5, 6, C.sakura).set(10, 4, C.sakura).set(11, 7, C.sakura).set(7, 8, C.sakura);
    },
    trophy(P, C) {
      P.ring(3.6, 5, 2.6, 1.2, C.goldD).ring(12.4, 5, 2.6, 1.2, C.goldD);
      P.rect(4, 2, 8, 5, C.gold).ell(8, 6.5, 4, 3.4, C.gold).rect(7, 10, 2, 2, C.goldD).rect(5, 12, 6, 2, C.gold).rect(5, 13, 6, 1, C.goldD);
      P.rect(5, 3, 1, 4, C.goldL).rect(10, 3, 1, 5, C.goldD).rect(4, 2, 8, 1, C.goldL);
    },
    book(P, C) {
      P.rrect(2, 2, 12, 12, 1.5, C.red).rect(2, 2, 2, 12, C.redD).rect(12, 3, 1, 10, C.redD).rect(4, 12, 9, 1, C.cream);
      P.rect(6, 4, 5, 4, C.cream).ell(8.5, 6.6, 1.3, 1, C.redL).set(7, 5, C.redL).set(8, 4, C.redL).set(9, 5, C.redL);
    },
    lock(P, C) {
      P.arc(8, 6.2, 3, Math.PI, TAU, 2, C.steel).rect(4.5, 6, 2, 2, C.steel).rect(9.5, 6, 2, 2, C.steel);
      P.rrect(3, 7, 10, 7, 2, C.gold).rect(4, 8, 8, 1, C.goldL).rect(11, 9, 1, 4, C.goldD).rect(4, 12, 8, 1, C.goldD);
      P.ell(8, 10, 1.3, 1.3, C.line).rect(7.5, 10, 1, 2, C.line);
    },
    check(P, C) { P.line(3.5, 8.5, 6.5, 11.5, 3, C.grass).line(6.5, 11.5, 12.5, 4.5, 3, C.grass).line(3, 8, 6, 11, 1, C.grassL).line(7, 10, 12, 4, 1, C.grassL); },
    star(P, C) {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.1 : 7; pts.push([8 + Math.cos(a) * r, 8.6 + Math.sin(a) * r]); }
      P.poly(pts, C.gold).line(8, 3, 6, 7, 1, C.goldL).set(4, 7, C.goldL).line(10, 10, 11, 13, 1, C.goldD).set(9, 11, C.goldD);
    },
    clock(P, C) {
      P.ell(8, 8, 6.6, 6.6, C.red).ell(8, 8, 5, 5, C.cream).arc(8, 8, 4.4, 0.2, 1.9, 1, C.riceS);
      P.rect(8, 4, 1, 5, C.line).rect(8, 8, 3, 1, C.line).set(8, 3, C.redD);
    },
    paw(P, C) {
      const p = C.sakuraD, l = C.sakura;
      P.ell(8, 10.6, 3.8, 3.2, p).ell(3.4, 7.4, 1.7, 2, p).ell(6.3, 4, 1.7, 2.1, p).ell(9.9, 4, 1.7, 2.1, p).ell(12.7, 7.4, 1.7, 2, p);
      P.rect(6, 9, 3, 1, l).set(6, 3, l).set(9, 3, l).set(3, 6, l).set(12, 6, l);
    },
    chest(P, C) {
      P.rrect(2, 6, 12, 8, 1, C.wood).rrect(2, 3, 12, 5, 2.5, C.woodL).rect(2, 7, 12, 1, C.woodD).rect(2, 13, 12, 1, C.woodD);
      P.rect(4, 3, 1, 11, C.gold).rect(11, 3, 1, 11, C.gold).rect(7, 6, 2, 4, C.gold).set(7, 8, C.line).set(8, 8, C.line).rect(7, 6, 2, 1, C.goldL);
    },
    house(P, C) {
      P.rect(3, 8, 10, 6, C.cream).rect(11, 8, 2, 6, C.riceS).rect(7, 10, 2, 4, C.wood).rect(4, 10, 2, 2, C.glass).rect(10, 10, 2, 2, C.glass);
      P.poly([[8, 1], [15, 8], [1, 8]], C.bowl).line(8, 2, 3, 7, 1, C.bowlL).rect(2, 7, 12, 1, '#2F4670');
    },
    x(P, C) { P.line(4, 4, 12, 12, 3, C.red).line(12, 4, 4, 12, 3, C.red).line(4, 4, 6, 6, 1, C.redL).line(11, 4, 10, 5, 1, C.redL); },
    swap(P, C) {
      P.rect(3, 4, 8, 2, C.water).poly([[10, 1.5], [14.5, 5], [10, 8.5]], C.water);
      P.rect(5, 10, 8, 2, C.ora).poly([[6, 7.5], [1.5, 11], [6, 14.5]], C.ora);
    },
    horn(P, C) {
      P.poly([[2, 6], [6, 6], [11, 2], [11, 14], [6, 10], [2, 10]], C.yel).rect(2, 6, 4, 1, C.yelL).line(7, 5, 10, 3, 1, C.yelL).rect(6, 9, 5, 1, C.yelD).rect(10, 3, 1, 10, C.yelD);
      P.rect(3, 11, 2, 3, C.red);
      return Q => Q.set(13, 4, C.line).set(14, 3, C.line).set(13, 8, C.line).set(14, 8, C.line).set(13, 12, C.line).set(14, 13, C.line);
    },
    hat(P, C) {
      P.poly([[8, 3], [15, 11], [1, 11]], C.sack).rect(1, 11, 14, 2, C.sackD).line(8, 4, 4, 10, 1, C.cream).line(9, 5, 12, 10, 1, C.sackD).rect(7, 2, 2, 2, C.wood);
      P.rect(1, 11, 14, 1, C.sack).rect(5, 13, 1, 2, C.red).rect(10, 13, 1, 2, C.red);
    },
    bolt(P, C) { P.poly([[9, 1], [3, 9], [7, 9], [6, 15], [13, 6], [9, 6], [11, 1]], C.gold).line(9, 2, 5, 8, 1, C.goldL).line(8, 13, 11, 8, 1, C.goldD); },
  };
  function speaker(P, C) {
    P.rect(2, 6, 3, 4, C.steel).poly([[5, 6], [8, 3], [8, 13], [5, 10]], C.steelL).rect(7, 4, 1, 9, C.steelD).rect(2, 9, 3, 1, C.steelD).rect(2, 6, 3, 1, C.steelL);
  }
  /* sem pix.js: glifos de texto simples (nada de emoji) */
  const GLYPH = { yen: '¥', rice: '•', sack: '$', gear: '⚙', sound: '♪', mute: '×', music: '♫', tree: '♣', trophy: '★', book: '▤', lock: '▣',
    check: '✓', star: '★', clock: '◷', paw: '●', chest: '▣', house: '⌂', x: '×', swap: '⇄', horn: '◄', hat: '▲', bolt: 'ϟ' };
  const iconCache = Object.create(null);

  // srcIcon(icon) -> canvas-fonte | null: aceita nome embutido ou um canvas de sprite
  function srcIcon(icon) {
    if (!icon) return null;
    if (typeof icon !== 'string') return icon.getContext ? icon : null;
    if (iconCache[icon]) return iconCache[icon];
    const def = ICON_DEFS[icon];
    if (!def || !E.Pix || !E.PAL) return null;
    const P = E.Pix(16, 16), post = def(P, E.PAL), cv = P.canvas(true);
    if (typeof post === 'function') {                     // segundo passe sem contorno (traços finos: ondas de som)
      const Q = E.Pix(16, 16);
      post(Q, E.PAL);
      cv.getContext('2d').drawImage(Q.canvas(false), 0, 0);
    }
    return (iconCache[icon] = cv);
  }
  // silhouette(canvas) -> canvas chapado em marrom (névoa da árvore, cartas trancadas)
  const silCache = new WeakMap();
  function silhouette(src, col) {
    let s = silCache.get(src);
    if (!s) {
      s = doc.createElement('canvas'); s.width = src.width; s.height = src.height;
      const g = s.getContext('2d');
      g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col || '#1a110a'; g.fillRect(0, 0, s.width, s.height);
      silCache.set(src, s);
    }
    return s;
  }

  // E.UI.icon(spriteCanvas|nome, size=24) -> <canvas> nítido (pixels ampliados por fator inteiro; o navegador só reduz)
  function icon(src, size) {
    const s = srcIcon(src);
    if (!s) return null;
    size = size || 24;
    const sw = s.width, sh = s.height, m = Math.max(sw, sh);
    const k = Math.max(1, Math.min(Math.ceil(size * 3 / m), Math.floor(384 / m) || 1));
    const cv = doc.createElement('canvas');
    cv.width = sw * k; cv.height = sh * k; cv.className = 'k-ico' + (k === 1 ? ' k-ico-px' : '');
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(s, 0, 0, sw * k, sh * k);
    cv.style.width = Math.round(size * sw / m) + 'px';
    cv.style.height = Math.round(size * sh / m) + 'px';
    return cv;
  }
  // iconEl(icon, size) -> elemento: canvas/nome embutido vira ícone pixelado; outro texto vira glifo; nó DOM passa direto
  function iconEl(ic, size) {
    if (ic === undefined || ic === null || ic === '') return null;
    if (ic.nodeType && !ic.getContext) return ic;
    const c = icon(ic, size);
    if (c) return c;
    if (typeof ic !== 'string') return null;
    const s = h('span', 'k-ico k-ico-txt', null, GLYPH[ic] || ic);
    s.style.fontSize = Math.round((size || 24) * 0.82) + 'px';
    s.style.width = s.style.height = (size || 24) + 'px';
    return s;
  }
  // E.UI.defineIcon(nome, fn(P, PAL)): acrescenta/troca um ícone 16x16 do conjunto embutido
  function defineIcon(name, fn) { ICON_DEFS[name] = fn; delete iconCache[name]; }
  // E.UI.badge(el, n): bolinha vermelha com contador no canto (n=0/null tira; n=true vira só um ponto)
  function badge(el, n) {
    el = par(el);
    let b = el.__badge;
    if (!n) { if (b) { b.remove(); el.__badge = null; el.__badgeV = 0; } return; }
    if (el.__badgeV === n) return;
    if (b) b.remove();
    b = el.__badge = h('span', 'k-badge' + (n === true ? ' k-dot' : ''), el, n === true ? '' : String(n));
    el.__badgeV = n;
  }

  /* ======================================================================
     3. mount / zonas
     ====================================================================== */
  // E.UI.mount(stage, {parent?}) -> root: camada DOM por cima do canvas (é um <div>; ganha zone(), stage, layout())
  function mount(stage, o) {
    o = o || {};
    let root;
    if (stage && stage.layer) root = stage.layer('k-ui');
    else root = h('div', 'k-ui', o.parent || (stage && stage.el) || doc.body);
    root.style.width = ''; root.style.height = '';
    root.el = root; root.stage = stage || null; root.zones = {};
    // root.zone('tl'|'tc'|'tr'|'ml'|'mr'|'bl'|'bc'|'br'|'dock') -> div âncora (flex) naquela posição
    root.zone = name => root.zones[name] || (root.zones[name] = h('div', 'k-zone k-zone-' + name, root.hud));
    root.hud = h('div', 'k-layer k-l1', root);            // HUD fixo
    root.over = h('div', 'k-layer k-l2', root);           // painéis
    root.fx = h('div', 'k-layer k-l3', root);             // banners, toasts, conquistas
    root.top = h('div', 'k-layer k-l4', root);            // celebração, tooltip
    root.toasts = h('div', 'k-toasts', root.fx);
    root.achs = h('div', 'k-achs', root.fx);
    // root.layout(): reavalia retrato/paisagem e a área de toque extra (chamado sozinho no resize do stage)
    root.layout = () => {
      const w = stage ? stage.w : root.clientWidth, hh = stage ? stage.h : root.clientHeight;
      const s = stage ? stage.scale : 1;
      root.classList.toggle('k-portrait', hh > w);
      root.classList.toggle('k-narrow', w < 700);
      root.style.setProperty('--k-hitpad', U.clamp((44 / s - 44) / 2, 0, 12).toFixed(1) + 'px');
    };
    if (stage && stage.on) stage.on('resize', root.layout);
    root.layout();
    root.addEventListener('contextmenu', e => e.preventDefault());
    UI.root = root;
    return root;
  }
  // E.UI.spacer(pai): elemento elástico pra empurrar vizinhos numa zona flex (ex.: barra de baixo)
  function spacer(parent) { return h('div', 'k-spacer', par(parent)); }

  /* ======================================================================
     4. Pílula e número rolante
     ====================================================================== */
  // E.UI.roll(el, {fmt=U.fmt, speed=10, value=0}) -> {set(v, instant?), value, shown}: número que rola até o alvo
  function roll(el, o) {
    o = o || {};
    const fmt = o.fmt || U.fmt, speed = o.speed || 10;
    let cur = +o.value || 0, target = cur, active = false, lastTxt = null;
    function paint() { const s = fmt(cur); if (s !== lastTxt) { lastTxt = s; el.textContent = s; } }
    function step(dt) {
      const d = target - cur;
      if (Math.abs(d) <= Math.max(1e-3, Math.abs(target) * 2e-4)) { cur = target; paint(); active = false; return false; }
      cur += d * (1 - Math.exp(-speed * dt));
      paint();
    }
    paint();
    return {
      set(v, instant) {
        v = +v || 0;
        if (v === target && !instant) return;
        target = v;
        if (instant) { cur = v; paint(); return; }
        if (!active) { active = true; tick(step); }
      },
      get value() { return target; },
      get shown() { return cur; },
    };
  }

  // E.UI.pill(root, {id, icon, label, small, value, big, sm, tone:'gold', roll=true, fmt}) -> {el, set(v, instant?), bump(), gain(txt, crit?), small(txt), value}
  function pill(root, o) {
    o = o || {};
    const el = h('div', 'k-pill' + (o.big ? ' k-big' : '') + (o.sm ? ' k-sm' : '') + (o.tone ? ' k-' + o.tone : ''), par(root));
    if (o.id) el.id = o.id;
    const ic = iconEl(o.icon, o.big ? 30 : o.sm ? 16 : 22);
    if (ic) el.appendChild(ic);
    if (o.label) h('span', 'k-pre', el, o.label);
    const num = h('span', 'k-num', el);
    const sm = h('small', null, el, o.small || '');
    const r = o.roll === false ? null : roll(num, { fmt: o.fmt, value: +o.value || 0, speed: o.speed });
    if (!r) num.textContent = o.value === undefined ? '0' : o.value;
    el.addEventListener('animationend', e => { if (e.animationName === 'k-bump') el.classList.remove('k-bump'); });
    const api = {
      el,
      // set(v, instant?): número rola até v; texto entra direto
      set(v, instant) { if (r && typeof v === 'number') r.set(v, instant); else setText(num, String(v)); },
      // bump(): pulinho (dinheiro entrou)
      bump() { replay(el, 'k-bump'); },
      // gain(txt, crit?): "+¥120" subindo da pílula
      gain(txt, crit) {
        const g = h('span', 'k-gain' + (crit ? ' k-crit' : ''), el, txt);
        g.style.left = (45 + Math.random() * 35) + '%';
        g.addEventListener('animationend', () => g.remove());
      },
      // small(txt): troca o sufixo pequeno
      small(t) { setText(sm, t); },
      get value() { return r ? r.value : num.textContent; },
    };
    return api;
  }

  /* ======================================================================
     5. Barra e meta
     ====================================================================== */
  // E.UI.bar(root, {label, icon, endowed=0, tone, size:'sm'|'lg', w, fluid, ticks:[frac|{at,color}], near=.9, value}) -> {el, set(frac, label?, {left, value}?), tone(t), frac}
  function bar(root, o) {
    o = o || {};
    const el = h('div', 'k-bar' + (o.size ? ' k-' + o.size : '') + (o.fluid ? ' k-fluid' : '') + (o.tone ? ' k-tone-' + o.tone : ''), par(root));
    if (o.w) el.style.width = o.w + 'px';
    const lab = h('div', 'k-bar-lab', el);
    const nameWrap = h('span', null, lab);
    const ic = iconEl(o.icon, 16);
    if (ic) nameWrap.appendChild(ic);
    const name = h('span', null, nameWrap, o.label || '');
    const left = h('span', 'k-bar-left', lab);
    const track = h('div', 'k-bar-track', el);
    const fill = h('i', 'k-bar-fill', track);
    const val = h('span', 'k-bar-val', track, o.value || '');
    const endowed = o.endowed || 0, nearAt = o.near === undefined ? 0.9 : o.near;
    if (o.ticks) for (const t of o.ticks) {
      const at = typeof t === 'number' ? t : t.at;
      const k = h('span', 'k-bar-tick' + (t.color ? ' k-color' : ''), track);
      k.style.left = ((endowed + (1 - endowed) * at) * 100) + '%';
      if (t.color) k.style.background = t.color;
    }
    let lastQ = -1, lastState = 0, curTone = o.tone || '', frac = 0;
    const showLab = () => { lab.style.display = (name.textContent || left.textContent || ic) ? '' : 'none'; };
    const api = {
      el,
      // set(frac 0..1, label?, {left:'faltam ¥X', value:'×1,35'}?)
      set(f, label, extra) {
        f = U.clamp(+f || 0, 0, 1); frac = f;
        const q = Math.round((endowed + (1 - endowed) * f) * 1000);
        if (q !== lastQ) { lastQ = q; fill.style.width = q / 10 + '%'; }
        const st = f >= 1 ? 2 : f >= nearAt ? 1 : 0;
        if (st !== lastState) { lastState = st; el.classList.toggle('k-near', st === 1); el.classList.toggle('k-full', st === 2); }
        let ch = false;
        if (label !== undefined && label !== null && name.__t !== label) { setText(name, label); ch = true; }
        if (extra) {
          if (extra.left !== undefined && left.__t !== extra.left) { setText(left, extra.left); ch = true; }
          if (extra.value !== undefined) setText(val, extra.value);
        }
        if (ch) showLab();
      },
      // tone('gold'|'green'|'red'|'blue'|'sack'|'pink'|'fury'|''): troca a cor do preenchimento
      tone(t) { if (t === curTone) return; if (curTone) el.classList.remove('k-tone-' + curTone); if (t) el.classList.add('k-tone-' + t); curTone = t; },
      get frac() { return frac; },
    };
    showLab();
    api.set(o.frac || 0);
    return api;
  }

  // E.UI.goal(root, {label, icon, endowed=.12, unit='¥', pct=false, ...bar}) -> {el, bar, set(tem, precisa, taxaPorSeg?)}: barra de meta com "faltam X · ≈ 40s"
  function goal(root, o) {
    o = Object.assign({ endowed: 0.12 }, o);
    const b = bar(root, o), unit = o.unit === undefined ? '¥' : o.unit;
    let lastT = -1e9, lastDone = false;
    return {
      el: b.el, bar: b,
      set(have, needV, rate) {
        const f = needV > 0 ? U.clamp(have / needV, 0, 1) : 1, done = f >= 1;
        const now = performance.now();
        if (now - lastT < 200 && done === lastDone) { b.set(f); return; }      // texto a 5 Hz, largura todo frame
        lastT = now; lastDone = done;
        let s;
        if (done) s = o.done || 'pronto!';
        else if (o.pct) s = 'faltam ' + U.pct(1 - f, 1);
        else {
          s = 'faltam ' + unit + U.fmt(Math.ceil(needV - have));
          if (rate > 0) s += ' · ≈ ' + U.fmtTime(Math.ceil((needV - have) / rate));
        }
        b.set(f, undefined, { left: s });
      },
    };
  }
  // E.UI.goals(root) -> {el, add(opts) -> goal}: coluna de barras de meta sempre visíveis
  function goals(root) {
    const el = h('div', 'k-goals', par(root));
    return { el, add: o => goal(el, o) };
  }

  /* ======================================================================
     6. Botão
     ====================================================================== */
  // E.UI.button(root, {icon (canvas|nome|texto), iconSize, title, sub, onClick, progress, badge, state, tone:'primary'|'green'|'red'|'dark',
  //   size:'sm'|'lg', accent (cor da faixa lateral), vertical, center, w, sound='click'}) -> {el, set({title,sub,progress,state:'can'|'off'|'',badge,icon,left}), pop()}
  function button(root, o) {
    o = o || {};
    const el = h('button', 'k-btn' + (o.size ? ' k-' + o.size : '') + (o.tone ? ' k-' + o.tone : '') + (o.vertical ? ' k-vert' : '') +
      (o.center ? ' k-center' : '') + (o.cls ? ' ' + o.cls : ''), par(root));
    el.type = 'button';
    if (o.w) el.style.width = o.w + 'px';
    if (o.accent) { el.classList.add('k-accent'); el.style.setProperty('--k-accent', o.accent); }
    const icoSize = o.iconSize || (o.size === 'sm' ? 20 : 32);
    const icoBox = h('span', 'k-btn-ico', el);
    const txt = h('span', 'k-btn-t', el);
    const title = h('span', null, txt), sub = h('small', null, txt), left = h('span', 'k-btn-left', txt);
    let bp = null, bpFill = null, lastQ = -1, state = '', curIcon;
    function setIcon(ic) {
      if (ic === curIcon) return;
      curIcon = ic;
      icoBox.textContent = '';
      const e = iconEl(ic, icoSize);
      if (e) icoBox.appendChild(e);
      icoBox.style.display = e ? '' : 'none';
    }
    const api = {
      el,
      set(s) {
        if (s.title !== undefined) setText(title, s.title);
        if (s.sub !== undefined) setText(sub, s.sub);
        if (s.left !== undefined) setText(left, s.left);
        if (s.icon !== undefined) setIcon(s.icon);
        if (s.progress !== undefined && s.progress !== null) {
          if (!bp) { bp = h('span', 'k-btn-bp', el); bpFill = h('i', null, bp); el.classList.add('k-has-bp'); }
          const q = Math.round(U.clamp(s.progress, 0, 1) * 1000);
          if (q !== lastQ) { lastQ = q; bpFill.style.width = q / 10 + '%'; }
        }
        if (s.state !== undefined && s.state !== state) {
          if (state) el.classList.remove('k-' + state);
          state = s.state || '';
          if (state) el.classList.add('k-' + state);
        }
        if (s.badge !== undefined) badge(el, s.badge);
        return api;
      },
      // pop(): pulinho de confirmação (compra feita)
      pop() { replay(el, 'k-pop'); },
      get state() { return state; },
    };
    setIcon(o.icon);
    if (!o.title && !o.sub) { txt.style.display = 'none'; if (!o.vertical) el.classList.add('k-icon'); }
    api.set({ title: o.title || '', sub: o.sub || '', progress: o.progress, state: o.state, badge: o.badge });
    pressable(el, true);
    el.addEventListener('click', e => {
      if (state === 'off') { sfx('error'); replay(el, 'k-nope'); if (o.onOff) o.onOff(api, e); return; }
      if (o.sound !== 'none') sfx(o.sound || 'click');
      if (o.onClick) o.onClick(api, e);
    });
    return api;
  }
  // E.UI.flyer(root, {art (canvas|nó), title, sub, onClick}) -> botão vertical tipo panfleto (casa: arte em cima, preço e barra embaixo)
  function flyer(root, o) {
    o = Object.assign({ vertical: true, cls: 'k-flyer', iconSize: 44 }, o);
    o.icon = o.art || o.icon;
    return button(root, o);
  }

  /* ======================================================================
     7. Painel, abas, diálogo, confirmar
     ====================================================================== */
  const openPanels = [];
  doc.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !openPanels.length) return;
    const p = openPanels[openPanels.length - 1];
    if (p.dismiss) p.close();
  });

  // E.UI.tabs(pai, {tabs:[{id,label,icon,badge}], value, onChange(id)}) -> {el, panes, set(id), pane(id) -> div, badge(id,n), value}
  function tabs(parent, o) {
    parent = par(parent);
    const el = h('div', 'k-tabs', parent), panes = h('div', 'k-panes', parent);
    const btn = {}, pane = {};
    let value = null;
    const api = {
      el, panes,
      set(id, silent) {
        if (id === value || !btn[id]) return;
        if (value !== null) { btn[value].classList.remove('k-sel'); pane[value].classList.remove('k-sel'); }
        value = id;
        btn[id].classList.add('k-sel'); pane[id].classList.add('k-sel');
        if (!silent && o.onChange) o.onChange(id);
      },
      pane: id => pane[id],
      badge(id, n) { if (btn[id]) badge(btn[id], n); },
      get value() { return value; },
    };
    for (const t of o.tabs) {
      const b = btn[t.id] = h('button', 'k-tab', el);
      b.type = 'button';
      const ic = iconEl(t.icon, 18);
      if (ic) b.appendChild(ic);
      h('span', null, b, t.label);
      if (t.badge) badge(b, t.badge);
      pane[t.id] = h('div', 'k-pane', panes);
      b.addEventListener('click', () => { sfx('click'); api.set(t.id); });
    }
    api.set(o.value || o.tabs[0].id, true);
    return api;
  }

  // E.UI.panel({title, icon, wide, full, bare, side:'right'|'left'|'bottom', tabs:[...], dim=true, dismiss=true, onClose, onOpen, cls})
  //   -> {el, body, head, tabs, open(), close(), toggle(), isOpen, setTitle(t), destroy()}
  function panel(o) {
    o = o || {};
    const root = need();
    const dim = h('div', 'k-dim' + (o.side ? ' k-side-' + o.side : '') + (o.dim === false ? ' k-nodim' : '') + (o.bare ? ' k-deep' : ''), root.over);
    const el = h('div', 'k-panel' + (o.wide ? ' k-wide' : '') + (o.full || o.bare ? ' k-full' : '') + (o.bare ? ' k-bare' : '') + (o.cls ? ' ' + o.cls : ''), dim);
    let head = null, titleEl = null;
    const dismiss = o.dismiss !== false;
    if (o.title !== undefined || dismiss) {
      head = h('div', 'k-panel-head', el);
      const h2 = h('h2', null, head);
      const ic = iconEl(o.icon, 26);
      if (ic) h2.appendChild(ic);
      titleEl = h('span', null, h2, o.title || '');
      if (dismiss) {
        const x = h('button', 'k-x', head); x.type = 'button'; x.setAttribute('aria-label', 'fechar'); h('i', null, x);
        pressable(x);
        x.addEventListener('click', () => { sfx('click'); api.close(); });
      }
    }
    const body = h('div', 'k-panel-body', el);
    let timer = 0;
    const api = {
      el, body, head, dim, isOpen: false, dismiss, tabs: null,
      open() {
        if (api.isOpen) return api;
        clearTimeout(timer);
        api.isOpen = true; openPanels.push(api);
        dim.classList.add('k-show'); void dim.offsetWidth; dim.classList.add('k-on');
        sfx('whoosh', { vol: 0.5 });
        if (o.onOpen) o.onOpen(api);
        return api;
      },
      close() {
        if (!api.isOpen) return api;
        api.isOpen = false;
        const i = openPanels.indexOf(api); if (i >= 0) openPanels.splice(i, 1);
        dim.classList.remove('k-on');
        timer = setTimeout(() => dim.classList.remove('k-show'), 300);
        if (o.onClose) o.onClose(api);
        return api;
      },
      toggle() { return api.isOpen ? api.close() : api.open(); },
      setTitle(t) { if (titleEl) setText(titleEl, t); },
      destroy() { api.close(); clearTimeout(timer); dim.remove(); },
    };
    if (dismiss) dim.addEventListener('pointerdown', e => { if (e.target === dim) api.close(); });
    if (o.tabs) api.tabs = tabs(body, { tabs: o.tabs, value: o.tab, onChange: o.onTab });
    return api;
  }

  // E.UI.dialog({kicker, title, text, art (canvas|nó), big:{label, value, prefix, icon}, rows:[{icon,label,value}],
  //   buttons:[{title, sub, icon, tone, onClick, keep}], dismiss=false, onClose}) -> painel (já aberto) + {big: roll}
  //   cartão modal genérico: boas-vindas, "bom ponto pra parar", placar final. Botões sempre do mesmo tamanho.
  function dialog(o) {
    o = o || {};
    const p = panel({ dismiss: !!o.dismiss, cls: 'k-dialog', onClose: o.onClose });
    const b = p.el;
    b.removeChild(p.body);
    if (o.art) { const a = h('div', 'k-dialog-art', b); a.appendChild(o.art.nodeType && !o.art.getContext ? o.art : iconEl(o.art, o.artSize || 64)); }
    if (o.kicker) h('div', 'k-kicker', b, o.kicker);
    if (o.title) h('h2', null, b, o.title);
    if (o.text) h('p', null, b, o.text);
    if (o.big) {
      const box = h('div', 'k-dialog-big', b);
      h('small', null, box, o.big.label || '');
      const line = h('b', null, box);
      const ic = iconEl(o.big.icon, 28);
      if (ic) line.appendChild(ic);
      if (o.big.prefix) h('span', null, line, o.big.prefix);
      const n = h('span', null, line);
      p.big = roll(n, { speed: 3.2, fmt: o.big.fmt });
      if (typeof o.big.value === 'number') setTimeout(() => p.big.set(o.big.value), 350); else n.textContent = o.big.value;
    }
    if (o.rows && o.rows.length) {
      const rows = h('div', 'k-dialog-rows', b);
      for (const r of o.rows) stat(rows, r);
    }
    b.appendChild(p.body);
    p.body.style.display = 'none';                        // corpo extra opcional: p.body.style.display = '' pra usar
    const btns = h('div', 'k-dialog-btns', b);
    for (const bt of (o.buttons || [{ title: 'OK', tone: 'primary' }])) {
      button(btns, Object.assign({ center: true }, bt, { onClick(api, e) { if (!bt.keep) p.close(); if (bt.onClick) bt.onClick(api, e); } }));
    }
    p.destroyOnClose = true;
    const close0 = p.close;
    p.close = () => { close0(); setTimeout(() => p.dim.remove(), 320); return p; };
    return p.open();
  }
  // E.UI.confirm(texto, onYes, {title, yes='Sim', no='Agora não', onNo, danger}) -> diálogo com dois botões iguais
  function confirm(text, onYes, o) {
    o = o || {};
    return dialog({
      title: o.title || 'Tem certeza?', text, dismiss: true,
      buttons: [{ title: o.no || 'Agora não', onClick: o.onNo }, { title: o.yes || 'Sim', tone: o.danger ? 'red' : 'primary', onClick: onYes }],
    });
  }
  // E.UI.stat(pai, {icon, label, value}) -> {el, set(v)}: linha "rótulo ........ valor" (placar, recordes)
  function stat(parent, o) {
    const el = h('div', 'k-stat', par(parent));
    const l = h('span', null, el);
    const ic = iconEl(o.icon, 18);
    if (ic) l.appendChild(ic);
    h('span', null, l, o.label);
    const v = h('b', null, el, o.value === undefined ? '' : o.value);
    return { el, set(x) { setText(v, String(x)); } };
  }

  /* ======================================================================
     8. Banner, toast, conquista, celebração, tooltip
     ====================================================================== */
  const banQ = [];
  let banBusy = false;
  function banNext() {
    if (banBusy || !banQ.length) return;
    banBusy = true;
    const b = banQ.shift(), root = need();
    const el = h('div', 'k-banner' + (b.level >= 3 ? ' k-ribbon' : '') + (b.tone ? ' k-' + b.tone : ''), root.fx);
    const ic = iconEl(b.icon, b.level >= 3 ? 46 : 34);
    if (ic) el.appendChild(ic);
    const t = h('div', 'k-ban-t', el);
    h('div', null, t, b.text);
    if (b.sub) h('small', null, t, b.sub);
    void el.offsetWidth; el.classList.add('k-in');
    sfx(b.sound || (b.level >= 3 ? 'fanfare' : 'chime'));
    setTimeout(() => {
      el.classList.remove('k-in'); el.classList.add('k-out');
      setTimeout(() => { el.remove(); if (b.onDone) b.onDone(); setTimeout(() => { banBusy = false; banNext(); }, 300); }, 320);
    }, b.dur * 1000);
  }
  // E.UI.banner(texto, sub, {dur, level=2 (1 = toast, 2 = desce do topo, 3 = faixa de lado a lado), icon, tone:'gold', sound, onDone})
  //   fila: um por vez, 0,3 s entre eles; nunca bloqueia o toque
  function banner(text, sub, o) {
    o = o || {};
    const level = o.level || 2;
    if (level <= 1) return toast(text, { icon: o.icon, sub, dur: o.dur || 1.4 });
    banQ.push({ text, sub, level, icon: o.icon, tone: o.tone, sound: o.sound, onDone: o.onDone, dur: o.dur || (level >= 3 ? 2.5 : 1.5) });
    banNext();
  }

  const toastQ = [];
  let toastN = 0;
  function toastNext() {
    while (toastN < 3 && toastQ.length) {
      const t = toastQ.shift(), root = need();
      const el = h('div', 'k-toast' + (t.tone ? ' k-' + t.tone : ''), root.toasts);
      const ic = iconEl(t.icon, 22);
      if (ic) el.appendChild(ic);
      h('span', null, el, t.text);
      if (t.sub) h('small', null, el, t.sub);
      toastN++;
      setTimeout(() => {
        el.classList.add('k-out');
        setTimeout(() => { el.remove(); toastN--; toastNext(); }, 230);
      }, t.dur * 1000);
    }
  }
  // E.UI.toast(texto, {icon, sub, dur=2.2, tone:'light'|'gold'|'bad'}): fila de avisos curtos (3 visíveis, acima da barra de baixo)
  function toast(text, o) {
    o = o || {};
    toastQ.push({ text, icon: o.icon, sub: o.sub, tone: o.tone, dur: o.dur || 2.2 });
    toastNext();
  }

  const achQ = [];
  let achN = 0;
  function achNext() {
    while (achN < 2 && achQ.length) {
      const a = achQ.shift(), root = need();
      const el = h('div', 'k-ach', root.achs);
      const seal = h('div', 'k-ach-seal', el);
      const ic = iconEl(a.icon || 'paw', 28);
      if (ic) seal.appendChild(ic);
      const t = h('div', 'k-ach-t', el);
      h('small', null, t, a.kicker || 'Conquista!');
      h('b', null, t, a.title);
      if (a.sub) h('i', null, t, a.sub);
      achN++;
      setTimeout(() => sfx('bell'), 480);                // o "chirin" bate junto com o carimbo
      setTimeout(() => {
        el.classList.add('k-out');
        setTimeout(() => { el.remove(); achN--; achNext(); }, 300);
      }, (a.dur || 3.4) * 1000);
    }
  }
  // E.UI.achievement(título, {sub, icon='paw', kicker='Conquista!', dur=3.4}): cartão que entra pela direita com o selo carimbando (0,6 s)
  function achievement(title, o) {
    o = o || {};
    achQ.push({ title, sub: o.sub, icon: o.icon, kicker: o.kicker, dur: o.dur });
    achNext();
  }

  // E.UI.celebrate({title, sub, kicker, icon, iconSize=72, seal='novo!', dur=2.6, block=false, hint, onDone}) -> {el, close()}
  //   cartão de título carimbado com raios girando (o confete é do canvas: ScreenFX.confetti). block=true espera o toque.
  function celebrate(o) {
    if (typeof o === 'string') o = { title: o, sub: arguments[1] };
    const root = need();
    const el = h('div', 'k-celebrate' + (o.block ? ' k-block' : ''), root.top);
    h('div', 'k-rays', el);
    const card = h('div', 'k-cel-card', el);
    const ic = iconEl(o.icon, o.iconSize || 64);
    if (ic) h('div', 'k-cel-icon', card).appendChild(ic);
    if (o.kicker) h('div', 'k-cel-kicker', card, o.kicker);
    const title = h('div', 'k-cel-title', card);
    let n = 0;
    for (const word of String(o.title || '').split(' ')) {         // letra a letra, sem quebrar no meio da palavra
      const w = h('span', null, title); w.style.whiteSpace = 'nowrap'; w.style.animation = 'none';
      for (const ch of word) { const s = h('span', null, w, ch); s.style.animationDelay = (0.22 + n++ * 0.028) + 's'; }
      title.appendChild(doc.createTextNode(' '));
    }
    if (o.sub) h('div', 'k-cel-sub', card, o.sub);
    if (o.seal !== false) {
      const seal = h('div', 'k-cel-seal', card);
      const pi = iconEl('paw', 26);
      if (pi) seal.appendChild(pi);
      h('span', null, seal, o.seal || 'novo!');
    }
    if (o.block) h('div', 'k-cel-hint', el, o.hint || 'toque pra continuar');
    sfx('taiko');
    let closed = false, timer = 0;
    const api = {
      el,
      close() {
        if (closed) return;
        closed = true; clearTimeout(timer);
        el.classList.add('k-out');
        setTimeout(() => { el.remove(); if (o.onDone) o.onDone(); }, 300);
      },
    };
    if (o.block) el.addEventListener('click', api.close);
    else timer = setTimeout(api.close, (o.dur || 2.6) * 1000);
    return api;
  }

  // E.UI.tooltip(el, htmlFn|texto, {hold=2.4}): dica; mouse = ao passar, toque = ao encostar (some sozinha), não bloqueia o clique
  function tooltip(el, htmlFn, o) {
    el = par(el); o = o || {};
    const root = need();
    let tip = root.__tip, timer = 0;
    if (!tip) tip = root.__tip = h('div', 'k-tip', root.top);
    function show() {
      const html = typeof htmlFn === 'function' ? htmlFn(el) : htmlFn;
      if (!html) return;
      tip.innerHTML = html;
      tip.__owner = el;
      const rr = root.getBoundingClientRect(), r = el.getBoundingClientRect(), s = rr.width / root.offsetWidth || 1;
      const cx = (r.left + r.width / 2 - rr.left) / s, top = (r.top - rr.top) / s, bot = (r.bottom - rr.top) / s;
      const tw = tip.offsetWidth, th = tip.offsetHeight, W = root.offsetWidth;
      const x = U.clamp(cx - tw / 2, 6, W - tw - 6), below = top - th - 10 < 4;
      tip.style.left = x + 'px';
      tip.style.top = (below ? bot + 10 : top - th - 10) + 'px';
      tip.style.setProperty('--k-tip-x', U.clamp(cx - x, 12, tw - 12) + 'px');
      tip.classList.toggle('k-below', below);
      tip.classList.add('k-on');
    }
    function hide() { clearTimeout(timer); if (tip.__owner === el) tip.classList.remove('k-on'); }
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(); });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      show(); clearTimeout(timer);
      timer = setTimeout(hide, (o.hold || 2.4) * 1000);
    });
    return { show, hide };
  }

  /* ======================================================================
     9. Missões
     ====================================================================== */
  // E.UI.missions(root, {slots=3, title='Missões', collapsed=false, onClaim(i), onTap(i)}) -> {el, set(i, {icon, text, frac, count, done, empty}), collapse(bool), collapsed}
  //   chips com mini barra; missão pronta vira baú balançando pra tocar; a setinha recolhe em ícones
  function missions(root, o) {
    o = o || {};
    const el = h('div', 'k-missions', par(root));
    const head = h('div', 'k-missions-head', el);
    h('i', null, head); h('span', null, head, o.title === undefined ? 'Missões' : o.title);
    const listEl = h('div', 'k-missions-list', el);
    const slots = [];
    const api = {
      el, collapsed: false,
      set(i, s) {
        const m = slots[i];
        if (!m) return;
        const done = !!s.done, empty = !!s.empty;
        if (done !== m.done) {
          m.done = done; m.el.classList.toggle('k-done', done);
          m.icon = null;
          if (done) { sfx('thud', { vol: 0.5 }); replay(m.el, 'k-new'); }
        }
        if (empty !== m.empty) { m.empty = empty; m.el.classList.toggle('k-empty', empty); }
        const ic = done ? 'chest' : empty ? 'clock' : s.icon;
        if (ic !== m.icon) {
          m.icon = ic;
          if (m.ico) m.ico.remove();
          m.ico = iconEl(ic, 18);
          if (m.ico) m.el.insertBefore(m.ico, m.el.firstChild);
        }
        const text = done ? (s.doneText || 'Abrir o baú!') : s.text;
        if (text !== undefined && text !== m.text) {
          if (m.text !== undefined && !done && !empty) replay(m.el, 'k-new');
          m.text = text; m.t.textContent = text;
        }
        setText(m.n, done || empty ? '' : (s.count || ''));
        const q = Math.round(U.clamp(s.frac || 0, 0, 1) * 100);
        if (q !== m.q) { m.q = q; m.fill.style.width = q + '%'; }
      },
      collapse(b) { api.collapsed = !!b; el.classList.toggle('k-collapsed', api.collapsed); },
    };
    for (let i = 0; i < (o.slots || 3); i++) {
      const m = { el: h('div', 'k-mis k-empty', listEl), done: false, empty: true, q: -1 };
      m.t = h('span', 'k-mis-t', m.el); m.n = h('span', 'k-mis-n', m.el);
      m.fill = h('i', null, h('span', 'k-mis-bar', m.el));
      m.el.addEventListener('click', () => {
        if (m.done) { sfx('unlock'); if (o.onClaim) o.onClaim(i); } else if (o.onTap) o.onTap(i);
      });
      slots.push(m);
    }
    head.addEventListener('click', () => { sfx('click'); api.collapse(!api.collapsed); });
    if (o.collapsed) api.collapse(true);
    return api;
  }

  /* ======================================================================
     10. Álbum
     ====================================================================== */
  // E.UI.album(pai, {items:[{id, name, icon, q (pergunta), a (resposta), unlocked, isNew}], cols=4, iconSize=36, onOpen(item)})
  //   -> {el, unlock(id), set(id, patch), count() -> {have, total}}: cartas que começam silhueta + pergunta e viram a resposta
  function album(parent, o) {
    const el = h('div', 'k-album', par(parent));
    if (o.cols) el.style.setProperty('--k-cols', o.cols);
    const cards = {};
    function fill(c) {
      const it = c.item;
      c.el.classList.toggle('k-locked', !it.unlocked);
      c.name.textContent = it.unlocked ? it.name : (it.hint || '???');
      c.text.textContent = it.unlocked ? (it.a || it.desc || '') : (it.q || '');
      c.text.style.display = c.text.textContent ? '' : 'none';
      c.lock.style.display = it.unlocked ? 'none' : '';
      if (c.neu) { c.neu.remove(); c.neu = null; }
      if (it.unlocked && it.isNew) c.neu = h('span', 'k-new', c.el, 'novo!');
    }
    for (const it of o.items) {
      const c = cards[it.id] = { item: it, el: h('div', 'k-card', el) };
      const art = h('div', 'k-card-art', c.el);
      const ic = iconEl(it.icon || 'star', o.iconSize || 36);
      if (ic) art.appendChild(ic);
      c.name = h('b', null, c.el); c.text = h('span', null, c.el);
      c.lock = h('span', 'k-card-lock', c.el);
      const li = iconEl('lock', 14);
      if (li) c.lock.appendChild(li);
      fill(c);
      c.el.addEventListener('click', () => {
        if (!it.unlocked) { sfx('error', { vol: 0.5 }); replay(c.el, 'k-nope'); return; }
        if (it.isNew) { it.isNew = false; fill(c); }
        sfx('click');
        if (o.onOpen) o.onOpen(it);
      });
    }
    const api = {
      el,
      // unlock(id): vira a carta (pergunta -> resposta)
      unlock(id) {
        const c = cards[id];
        if (!c || c.item.unlocked) return;
        c.item.unlocked = true; c.item.isNew = true;
        replay(c.el, 'k-flip'); sfx('unlock');
        setTimeout(() => fill(c), 290);
      },
      set(id, patch) { const c = cards[id]; if (c) { Object.assign(c.item, patch); fill(c); } },
      count() { let have = 0; for (const it of o.items) if (it.unlocked) have++; return { have, total: o.items.length }; },
    };
    return api;
  }

  /* ======================================================================
     11. Ajustes: linha, toggle, slider
     ====================================================================== */
  // E.UI.row(pai, {icon, label, sub}) -> {el, ctl}: linha de ajustes; pendure o controle em .ctl
  function row(parent, o) {
    const el = h('div', 'k-setrow', par(parent));
    const ic = iconEl(o.icon, 24);
    if (ic) el.appendChild(ic);
    const t = h('div', 'k-setrow-t', el);
    h('span', null, t, o.label || '');
    if (o.sub) h('small', null, t, o.sub);
    return { el, ctl: h('div', 'k-setrow-c', el) };
  }
  // E.UI.toggle(pai, {icon, iconOff, label, sub, value=false, onChange(v)}) -> {el, value, set(v, silent?)}; sem label devolve só a chave
  function toggle(parent, o) {
    o = o || {};
    const r = o.label ? row(parent, o) : null;
    const el = h('button', 'k-toggle', r ? r.ctl : par(parent));
    el.type = 'button'; el.setAttribute('role', 'switch');
    h('i', null, el);
    let value = false;
    const api = {
      el: r ? r.el : el, ctl: el,
      set(v, silent) {
        v = !!v;
        el.classList.toggle('k-on', v); el.setAttribute('aria-checked', v);
        if (v === value) return;
        value = v;
        if (!silent && o.onChange) o.onChange(v);
      },
      get value() { return value; },
    };
    el.addEventListener('click', () => { api.set(!value); sfx('click', { pitch: value ? 1.2 : 0.85 }); });
    api.set(!!o.value, true);
    return api;
  }
  // E.UI.slider(pai, {icon, label, sub, min=0, max=1, step=0, value, w, fmt(v)->texto, onChange(v), onEnd(v)}) -> {el, value, set(v, silent?)}
  function slider(parent, o) {
    o = o || {};
    const r = o.label ? row(parent, o) : null, host = r ? r.ctl : par(parent);
    const el = h('div', 'k-slider', host);
    if (o.w) el.style.width = o.w + 'px';
    const fill = h('i', null, h('div', 'k-slider-track', el)), knob = h('div', 'k-slider-knob', el);
    const out = o.fmt === false ? null : h('span', 'k-slider-val', host);
    const min = o.min || 0, max = o.max === undefined ? 1 : o.max, step = o.step || 0;
    const fmt = o.fmt || (v => Math.round((v - min) / (max - min) * 100) + '%');
    let value = min;
    const api = {
      el: r ? r.el : el, ctl: el,
      set(v, silent) {
        v = U.clamp(+v || 0, min, max);
        if (step) v = min + Math.round((v - min) / step) * step;
        const f = (v - min) / (max - min || 1);
        fill.style.width = (f * 100) + '%';
        knob.style.left = 'calc(13px + ' + f + ' * (100% - 26px))';
        if (out) setText(out, fmt(v));
        if (v === value) return;
        value = v;
        if (!silent && o.onChange) o.onChange(v);
      },
      get value() { return value; },
    };
    function at(e) {
      const rc = el.getBoundingClientRect(), s = rc.width / el.offsetWidth || 1;
      const f = U.clamp(((e.clientX - rc.left) / s - 13) / (el.offsetWidth - 26), 0, 1);
      const before = value;
      api.set(min + f * (max - min));
      if (step && value !== before) sfx('click', { vol: 0.4 });
    }
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); el.classList.add('k-drag'); at(e); e.preventDefault(); });
    el.addEventListener('pointermove', e => { if (el.classList.contains('k-drag')) at(e); });
    const end = () => { if (!el.classList.contains('k-drag')) return; el.classList.remove('k-drag'); if (o.onEnd) o.onEnd(value); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    value = NaN; api.set(o.value === undefined ? min : o.value, true);
    return api;
  }

  /* ======================================================================
     12. Sparkline, taxa, medidor radial
     ====================================================================== */
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, cls, parent) { const e = doc.createElementNS(SVGNS, tag); if (cls) e.setAttribute('class', cls); if (parent) parent.appendChild(e); return e; }

  // E.UI.sparkline(pai, {w=64, h=14, max=60 (amostras), color, fill, size:'lg'}) -> {el, push(v), set(arr), last}
  function sparkline(parent, o) {
    o = o || {};
    const w = o.w || 64, hh = o.h || 14, cap = o.max || 60;
    const el = svg('svg', 'k-spark' + (o.size ? ' k-' + o.size : ''), par(parent));
    el.setAttribute('viewBox', '0 0 ' + w + ' ' + hh); el.setAttribute('width', w); el.setAttribute('height', hh);
    const area = svg('path', 'k-spark-area', el), line = svg('path', 'k-spark-line', el), dot = svg('circle', 'k-spark-dot', el);
    dot.setAttribute('r', o.size === 'lg' ? 3.5 : 2.5);
    if (o.color) line.style.stroke = o.color;
    if (o.fill) area.style.fill = o.fill;
    const data = [];
    function draw() {
      const n = data.length;
      if (!n) { line.setAttribute('d', ''); area.setAttribute('d', ''); dot.style.display = 'none'; return; }
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) { if (data[i] < lo) lo = data[i]; if (data[i] > hi) hi = data[i]; }
      if (o.zero !== false) lo = Math.min(lo, 0);
      const span = hi - lo || 1, pad = 2.5;
      let d = '', x = 0, y = 0;
      for (let i = 0; i < n; i++) {
        x = n === 1 ? w - pad : pad + (i / (n - 1)) * (w - pad * 2);
        y = hh - pad - ((data[i] - lo) / span) * (hh - pad * 2);
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      line.setAttribute('d', d);
      area.setAttribute('d', d + 'L' + x.toFixed(1) + ' ' + hh + 'L' + pad + ' ' + hh + 'Z');
      dot.style.display = ''; dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1));
    }
    const api = {
      el,
      push(v) { data.push(+v || 0); if (data.length > cap) data.shift(); draw(); },
      set(arr) { data.length = 0; for (let i = Math.max(0, arr.length - cap); i < arr.length; i++) data.push(+arr[i] || 0); draw(); },
      get last() { return data.length ? data[data.length - 1] : 0; },
      data,
    };
    if (o.data) api.set(o.data); else draw();
    return api;
  }

  // E.UI.rate(root, {label='¥/s', icon, lines:[texto|fn()->texto], every=8, w=64, max=60}) -> {el, set(v), push(v), lines(arr), spark}
  //   pílula pequena com sparkline + linha de competência que alterna ("+40% vs 5 min atrás", "recorde: ¥81k/s")
  function rate(root, o) {
    o = o || {};
    const el = h('div', 'k-rate', par(root));
    const p = pill(el, { sm: true, icon: o.icon, label: o.label === undefined ? '¥/s' : o.label, fmt: o.fmt });
    const sp = sparkline(p.el, { w: o.w || 64, h: 14, max: o.max || 60 });
    const lineEl = h('div', 'k-rate-line', el);
    let lines = o.lines || [], idx = 0, timer = 0;
    function show() {
      if (!lines.length) { lineEl.textContent = ''; return; }
      const l = lines[idx % lines.length], s = typeof l === 'function' ? l() : l;
      idx++;
      if (!s) return;
      lineEl.textContent = s; replay(lineEl, 'k-swap');
    }
    timer = setInterval(() => { if (el.isConnected) show(); else clearInterval(timer); }, (o.every || 8) * 1000);
    show();
    return { el, pill: p, spark: sp, set: v => p.set(v), push: v => sp.push(v), lines(a) { lines = a || []; idx = 0; show(); }, next: show };
  }

  // E.UI.gauge(pai, {size=72, label, sweep=270 (graus), zones:[[de,ate]] (0..1, faixa verde), needle=false, over=false (texto branco, pra cima do canvas), tone (cor)})
  //   -> {el, set(frac, texto?), hot(bool)}: medidor radial (RPM, carga, mordida)
  function gauge(parent, o) {
    o = o || {};
    const size = o.size || 72, sweep = (o.sweep || 270) * Math.PI / 180, R = 38, a0 = Math.PI / 2 + (TAU - sweep) / 2;
    const el = h('div', 'k-gauge' + (o.over ? ' k-over' : ''), par(parent));
    const s = svg('svg', null, el);
    s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('width', size); s.setAttribute('height', size);
    const pt = (f, r) => (50 + Math.cos(a0 + sweep * f) * r).toFixed(2) + ' ' + (50 + Math.sin(a0 + sweep * f) * r).toFixed(2);
    const arc = (f0, f1, r) => 'M' + pt(f0, r) + 'A' + r + ' ' + r + ' 0 ' + (sweep * (f1 - f0) > Math.PI ? 1 : 0) + ' 1 ' + pt(f1, r);
    const len = R * sweep;
    const mk = (cls, w) => { const p = svg('path', cls, s); p.setAttribute('d', arc(0, 1, R)); p.setAttribute('stroke-width', w); return p; };
    mk('k-g-out', 19); mk('k-g-track', 13);
    const fill = mk('k-g-fill', 13);
    fill.setAttribute('stroke-dasharray', len.toFixed(2) + ' ' + (len * 2).toFixed(2));
    if (o.tone) fill.style.stroke = o.tone;
    if (o.zones) for (const z of o.zones) { const p = svg('path', 'k-g-zone', s); p.setAttribute('d', arc(z[0], z[1], R + 8)); p.setAttribute('stroke-width', 4); if (z[2]) p.style.stroke = z[2]; }
    let needle = null;
    if (o.needle) {
      needle = svg('g', 'k-g-needle', s);
      svg('path', null, needle).setAttribute('d', 'M50 46 L' + (50 + R - 4) + ' 50 L50 54 Z');
      const hub = svg('circle', 'k-g-hub', s); hub.setAttribute('cx', 50); hub.setAttribute('cy', 50); hub.setAttribute('r', 6);
    }
    const v = h('div', 'k-gauge-v', el);
    const fs = o.needle ? 0.19 : 0.26;
    let lastLen = -1;
    v.style.top = Math.round(size * (o.needle ? 0.72 : 0.5)) + 'px';
    if (!o.needle) v.style.transform = 'translateY(-50%)';
    if (o.needle) el.classList.add('k-needle');
    const l = o.label ? h('div', 'k-gauge-l', el, o.label) : null;
    let lastQ = -1, hot = false;
    const api = {
      el, label: l,
      set(f, text) {
        f = U.clamp(+f || 0, 0, 1);
        const q = Math.round(f * 500);
        if (q !== lastQ) {
          lastQ = q;
          fill.style.strokeDashoffset = (len * (1 - f)).toFixed(2);
          fill.style.visibility = f < 0.004 ? 'hidden' : '';
          if (needle) needle.style.transform = 'rotate(' + ((a0 + sweep * f) * 180 / Math.PI).toFixed(1) + 'deg)';
        }
        if (text !== undefined) {
          text = String(text);
          if (text.length !== lastLen) { lastLen = text.length; v.style.fontSize = Math.round(size * Math.min(fs, 0.92 / Math.max(1, text.length))) + 'px'; }
          setText(v, text);
        }
      },
      hot(b) { b = !!b; if (b !== hot) { hot = b; el.classList.toggle('k-hot', b); } },
    };
    api.set(o.frac || 0, o.text);
    return api;
  }

  /* ======================================================================
     13. Árvore — grafo de nós com pan/zoom, névoa e cartão de compra
     ====================================================================== */
  const DASH_OPEN = [7, 6], DASH_FOG = [3, 7], DASH_SYN = [2, 7], DASH_KEY = [9, 7], DASH_NONE = [];
  const NODE_R = [15, 21, 29];

  // E.UI.tree(pai, {nodes:[{id,n,c,branch,pos:{x,y},req:[ids],size:0|1|2,desc,see,icon}], branches:{id:{name,color,icon}},
  //   owned(id)->bool, affordable(node)->bool, visible(node)->bool?, locked(node)->texto|null ("precisa: Trator"), money()->n, progress(node)->0..1,
  //   fmtCost(c)->texto, onBuy(node)->false cancela, onSelect(node), synergies:[{a,b}], center:{icon,label}, unit=96, zoomMin=.5, zoomMax=1.5, zoom=1, chips=true, plain})
  //   -> {el, refresh(), focus(id,{zoom,instant}), select(id|null), home(), cheapest(branch?) -> node, selected, destroy()}
  function tree(parent, o) {
    o = o || {};
    const el = h('div', 'k-tree' + (o.plain ? ' k-plain' : ''), par(parent));
    const cv = h('canvas', 'k-tree-cv', el), g = cv.getContext('2d');
    const UNIT = o.unit || 96, ZMIN = o.zoomMin || 0.5, ZMAX = o.zoomMax || 1.5;
    const branches = o.branches || {};
    const fmtCost = o.fmtCost || (c => '¥ ' + U.fmt(c));
    const FONT = (window.getComputedStyle ? getComputedStyle(el).fontFamily : '') || 'sans-serif';
    const F_NAME = '900 11px ' + FONT, F_SMALL = '900 9.5px ' + FONT, F_BIG = '900 13px ' + FONT, F_Q = '900 16px ' + FONT;
    const stageOf = () => (UI.root && UI.root.stage) || null;

    /* ---------- dados ---------- */
    const list = [], byId = Object.create(null);
    let x0 = -UNIT, x1 = UNIT, y0 = -UNIT, y1 = UNIT;
    for (const d of o.nodes || []) {
      const br = branches[d.branch] || {}, size = d.size || 0;
      const N = {
        d, id: d.id, x: d.pos.x * UNIT, y: d.pos.y * UNIT, size, r: NODE_R[size] || NODE_R[0],
        col: br.color || GOLD, colD: U.shade(br.color || GOLD, -0.3), colL: U.shade(br.color || GOLD, 0.55),
        ico: srcIcon(d.icon) || srcIcon(br.icon), st: 'hidden', can: false, prog: 0,
        pop: 0, rev: 1, name: d.n || d.id, price: fmtCost(d.c), need: '', wName: 0, wPrice: 0, wNeed: 0, reqs: null, ph: Math.random() * TAU,
      };
      list.push(N); byId[d.id] = N;
      if (N.x < x0) x0 = N.x; if (N.x > x1) x1 = N.x; if (N.y < y0) y0 = N.y; if (N.y > y1) y1 = N.y;
    }
    for (const N of list) N.reqs = (N.d.req || []).map(id => byId[id]).filter(Boolean);
    const syn = (o.synergies || []).map(s => ({ a: byId[s.a], b: byId[s.b] })).filter(s => s.a && s.b);
    const center = o.center === false ? null : Object.assign({ r: 32 }, o.center);
    const centerIco = center ? srcIcon(center.icon) : null;
    list.sort((a, b) => a.y - b.y);

    /* ---------- estado dos nós ---------- */
    const isOwned = id => !!(o.owned && o.owned(id));
    let first = true;
    function refresh() {
      for (const N of list) N._own = isOwned(N.id);
      for (const N of list) { let ok = true; for (const r of N.reqs) if (!r._own) ok = false; N._ok = ok; N._lock = !N._own && o.locked ? o.locked(N.d) : null; }
      for (const N of list) {
        let st;
        if (N._own) st = 'owned';
        else if (N._ok && !N._lock) st = 'open';
        else {
          let near = N._ok;                                   // trancado por ferramenta: mostra a silhueta
          for (const r of N.reqs) if (r._own || (r._ok && !r._lock)) near = true;
          st = near ? 'fog' : 'hidden';
        }
        if (o.visible) { const v = o.visible(N.d); if (v === false) st = 'hidden'; else if (v === true && st === 'hidden') st = 'fog'; }
        if (st === 'fog') {
          if (N._lock) N.need = N._lock;
          else { let s = ''; for (const r of N.reqs) if (!r._own) s += (s ? ' + ' : '') + r.name; N.need = 'precisa: ' + s; }
          N.wNeed = 0;
        }
        if (st !== N.st) { if (!first && N.st !== 'owned') N.rev = st === 'owned' ? 1 : 0; N.st = st; }
      }
      first = false;
      afford();
      if (o.chips !== false) updateChips();
      if (sel) fillCard();
      wake();
    }
    function afford() {
      const m = o.money ? o.money() : 0;
      for (const N of list) {
        if (N.st !== 'open') { N.can = false; continue; }
        N.can = o.affordable ? !!o.affordable(N.d) : o.money ? m >= N.d.c : true;
        N.prog = o.progress ? o.progress(N.d) : o.money ? U.clamp(m / (N.d.c || 1), 0, 1) : N.can ? 1 : 0;
      }
    }
    // cheapest(branch?) -> nó aberto mais barato (de um ramo, ou de todos)
    function cheapest(branch) {
      let best = null;
      for (const N of list) if (N.st === 'open' && (!branch || N.d.branch === branch) && (!best || N.d.c < best.d.c)) best = N;
      return best;
    }

    /* ---------- câmera ---------- */
    const cam = { x: 0, y: 0, z: o.zoom || 1, tx: 0, ty: 0, tz: o.zoom || 1, vx: 0, vy: 0, follow: false, ax: 0, ay: 0, awx: 0, awy: 0, anchor: false };
    let W = 0, H = 0, ratio = 1, running = false, dead = false, time = 0, affT = 0, cardT = 0;
    function resize() {
      W = el.clientWidth; H = el.clientHeight;
      if (!W || !H) return;
      const st = stageOf();
      ratio = U.clamp((window.devicePixelRatio || 1) * (st ? st.scale : 1), 1, 2);
      const bw = Math.round(W * ratio), bh = Math.round(H * ratio);
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      wake();
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(el);
    const offStage = stageOf() && stageOf().on ? stageOf().on('resize', resize) : null;
    function wake() { if (!running && !dead) { running = true; tick(run); } }
    const portrait = () => H > W;
    // deslocamento do "centro útil" quando o cartão está aberto (o nó focado não fica embaixo dele)
    const offX = () => (sel && !portrait() && W > 560 ? -138 : 0);
    const offY = () => (sel && portrait() ? -Math.min(110, H * 0.16) : 16);
    // focus(id|node, {zoom, instant}): leva a câmera até um nó
    function focus(id, f) {
      const N = typeof id === 'string' ? byId[id] : id;
      f = f || {};
      if (f.zoom) cam.tz = U.clamp(f.zoom, ZMIN, ZMAX);
      const z = cam.tz;
      cam.tx = (N ? N.x : 0) - offX() / z; cam.ty = (N ? N.y : 0) - offY() / z;
      cam.follow = true; cam.anchor = false; cam.vx = cam.vy = 0;
      if (f.instant) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
      wake();
    }
    const home = () => { select(null); cam.tz = o.zoom || 1; focus(null); };

    /* ---------- cartão de detalhe (DOM) ---------- */
    const card = h('div', 'k-tree-card', el);
    const cHead = h('div', 'k-tree-card-head', card), cIco = h('div', 'k-tree-card-ico', cHead), cT = h('div', 'k-tree-card-t', cHead);
    const cKind = h('small', null, cT), cName = h('b', null, cT);
    const cDesc = h('div', 'k-tree-card-desc', card), cSee = h('div', 'k-tree-card-see', card);
    const cGoal = goal(card, { fluid: true, size: 'sm', label: '' });
    const cBuy = button(card, { title: 'Comprar', icon: 'yen', iconSize: 22, center: true, sound: 'none', onClick: () => buy(sel) });
    const cX = h('button', 'k-x', card); cX.type = 'button'; h('i', null, cX);
    cX.addEventListener('click', () => { sfx('click'); select(null); });
    let sel = null;
    const KIND = ['Melhoria', 'Melhoria grande', 'Keystone'];
    function fillCard() {
      const N = sel, d = N.d, br = branches[d.branch] || {};
      card.style.setProperty('--k-accent', N.st === 'fog' ? '#8a7f70' : N.col);
      cIco.textContent = ''; cIco.classList.toggle('k-key', N.size === 2);
      const fog = N.st === 'fog';
      const ic = fog && N.ico ? icon(silhouette(N.ico), 30) : iconEl(N.ico || 'star', 30);
      if (ic) { if (fog) ic.style.opacity = 0.45; cIco.appendChild(ic); }
      setText(cKind, (br.name ? br.name + ' · ' : '') + KIND[N.size]);
      setText(cName, fog && o.fogNames === false ? '???' : N.name);
      setText(cDesc, fog ? N.need : (d.desc || ''));
      setText(cSee, fog ? (d.q || 'Ainda encoberto. Compre o que falta pra revelar.') : (d.see || ''));
      cardT = 0; liveCard();
    }
    function liveCard() {
      const N = sel;
      if (!N) return;
      if (N.st === 'owned') { cGoal.el.style.display = 'none'; cBuy.set({ title: 'Já é seu!', sub: '', icon: 'check', state: 'off' }); }
      else if (N.st === 'fog') { cGoal.el.style.display = 'none'; cBuy.set({ title: 'Trancado', sub: '', icon: 'lock', state: 'off' }); }
      else {
        cGoal.el.style.display = N.can ? 'none' : '';
        if (o.money) cGoal.set(o.money(), N.d.c, o.rate ? o.rate() : 0); else cGoal.bar.set(N.prog);
        cBuy.set({ title: N.can ? 'Comprar' : 'Ainda não dá', sub: N.price, icon: 'yen', state: N.can ? 'can' : 'off' });
      }
    }
    // select(id|node|null): abre/fecha o cartão de um nó
    function select(id) {
      const N = id ? (typeof id === 'string' ? byId[id] : id) : null;
      if (N === sel) return;
      sel = N && N.st !== 'hidden' ? N : null;
      if (sel) { fillCard(); replay(card, 'k-on'); if (o.onSelect) o.onSelect(sel.d); }
      else card.classList.remove('k-on');
      wake();
    }
    function buy(N) {
      if (!N || N.st !== 'open') return;
      afford();
      if (!N.can) { sfx('error'); return; }
      if (o.onBuy && o.onBuy(N.d) === false) return;
      sfx('buy');
      N.pop = 1; addBurst(N.x, N.y, N.col);
      refresh();
      cBuy.pop();
    }

    /* ---------- atalhos de ramo ---------- */
    const chipEls = {};
    let chipsEl = null;
    if (o.chips !== false) {
      chipsEl = h('div', 'k-tree-chips', el);
      for (const id in branches) {
        const b = branches[id], c = h('button', 'k-tree-chip', chipsEl);
        c.type = 'button'; c.style.setProperty('--k-accent', b.color || GOLD);
        const dot = h('i', null, c), ic = iconEl(b.icon, 14);
        if (ic) dot.appendChild(ic);
        h('span', null, c, b.name || id);
        chipEls[id] = { el: c, n: h('small', null, c) };
        c.addEventListener('click', () => {
          sfx('click');
          let N = cheapest(id);
          if (!N) for (const M of list) if (M.d.branch === id && M.st !== 'hidden' && (!N || Math.hypot(M.x, M.y) > Math.hypot(N.x, N.y))) N = M;
          if (N) { select(N); focus(N); }
        });
      }
    }
    function updateChips() {
      for (const id in chipEls) {
        let have = 0, tot = 0, can = false;
        for (const N of list) if (N.d.branch === id) { tot++; if (N.st === 'owned') have++; if (N.can) can = true; }
        const c = chipEls[id];
        setText(c.n, have + '/' + tot);
        c.el.classList.toggle('k-can', can); c.el.classList.toggle('k-done', have === tot);
      }
    }
    /* botões de zoom (pinça e roda também funcionam) */
    const zb = h('div', 'k-tree-zoom', el);
    button(zb, { title: '+', center: true, onClick: () => zoomBy(1.3) });
    button(zb, { title: '−', center: true, onClick: () => zoomBy(1 / 1.3) });
    button(zb, { icon: 'paw', iconSize: 22, onClick: home });
    function zoomBy(k, sx, sy) {
      cam.tz = U.clamp(cam.tz * k, ZMIN, ZMAX);
      cam.ax = sx === undefined ? W / 2 : sx; cam.ay = sy === undefined ? H / 2 : sy;
      cam.awx = cam.x + (cam.ax - W / 2) / cam.z; cam.awy = cam.y + (cam.ay - H / 2) / cam.z;
      cam.anchor = true; cam.follow = false;
      wake();
    }

    /* ---------- ponteiro: arrastar, pinça, toque ---------- */
    const ptr = new Map(), lp = { x: 0, y: 0 };
    let moved = 0, downT = 0, pinch = 0, hover = null, mx = 0, my = 0;
    function local(e) {
      const r = cv.getBoundingClientRect();
      lp.x = r.width ? (e.clientX - r.left) * W / r.width : 0; lp.y = r.height ? (e.clientY - r.top) * H / r.height : 0;
      return lp;
    }
    function hit(sx, sy) {
      const wx = cam.x + (sx - W / 2) / cam.z, wy = cam.y + (sy - H / 2) / cam.z, slack = 12 / cam.z;
      let best = null, bd = 1e9;
      for (const N of list) {
        if (N.st === 'hidden') continue;
        const dd = Math.hypot(N.x - wx, N.y - wy);
        if (dd < N.r + slack && dd < bd) { bd = dd; best = N; }
      }
      return best;
    }
    function two() { let a = null, b = null; for (const p of ptr.values()) { if (!a) a = p; else b = p; } mx = (a.x + b.x) / 2; my = (a.y + b.y) / 2; return Math.hypot(a.x - b.x, a.y - b.y); }
    cv.addEventListener('pointerdown', e => {
      if (e.button) return;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro sintético */ }
      const p = local(e);
      ptr.set(e.pointerId, { x: p.x, y: p.y });
      if (ptr.size === 1) { moved = 0; downT = performance.now(); cam.vx = cam.vy = 0; cam.follow = false; cam.anchor = false; cam.tz = cam.z; }
      else if (ptr.size === 2) { pinch = two(); moved = 99; }
      el.classList.add('k-grab');
      wake(); e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      const p = local(e), q = ptr.get(e.pointerId);
      if (!q) {
        const N = hit(p.x, p.y);
        if (N !== hover) { hover = N; cv.style.cursor = N ? 'pointer' : ''; wake(); }
        return;
      }
      const dx = p.x - q.x, dy = p.y - q.y;
      q.x = p.x; q.y = p.y;
      if (ptr.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) {
          cam.x -= dx / cam.z; cam.y -= dy / cam.z;
          cam.vx = U.lerp(cam.vx, -dx / cam.z * 60, 0.5); cam.vy = U.lerp(cam.vy, -dy / cam.z * 60, 0.5);
        }
      } else if (ptr.size === 2) {
        const pmx = mx, pmy = my, d = two();
        if (pinch > 0) {
          const wx = cam.x + (pmx - W / 2) / cam.z, wy = cam.y + (pmy - H / 2) / cam.z;
          cam.z = cam.tz = U.clamp(cam.z * d / pinch, ZMIN, ZMAX);
          cam.x = wx - (mx - W / 2) / cam.z; cam.y = wy - (my - H / 2) / cam.z;
        }
        pinch = d;
      }
      wake();
    });
    function up(e) {
      if (!ptr.has(e.pointerId)) return;
      const p = local(e);
      ptr.delete(e.pointerId);
      if (ptr.size === 1) { moved = 99; return; }
      if (ptr.size) return;
      el.classList.remove('k-grab');
      if (e.type === 'pointerup' && moved <= 6 && performance.now() - downT < 500) {
        const N = hit(p.x, p.y);
        if (!N) select(null);
        else if (N === sel && N.st === 'open' && N.can) buy(N);                  // tocar de novo compra
        else {
          sfx(N.st === 'fog' ? 'click' : 'pop', { vol: 0.6 });
          N.pop = Math.max(N.pop, 0.45);
          select(N);
          const sx = (N.x - cam.x) * cam.z + W / 2, sy = (N.y - cam.y) * cam.z + H / 2;
          const underCard = portrait() ? sy > H - 250 : sx > W - 300 && sy > H - 300;
          if (underCard || sx < 70 || sx > W - 70 || sy < 110 || sy > H - 60) focus(N);
        }
      }
      wake();
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (hover) { hover = null; cv.style.cursor = ''; } });
    cv.addEventListener('wheel', e => { const p = local(e); zoomBy(Math.exp(-U.clamp(e.deltaY, -240, 240) * 0.0022), p.x, p.y); e.preventDefault(); }, { passive: false });

    /* ---------- efeitos ---------- */
    const bursts = [];
    for (let i = 0; i < 6; i++) bursts.push({ x: 0, y: 0, t: 1, col: GOLD });
    function addBurst(x, y, col) { let b = bursts[0]; for (const c of bursts) if (c.t > b.t) b = c; b.x = x; b.y = y; b.t = 0; b.col = col; }

    /* ---------- desenho ---------- */
    function shape(x, y, r, size, rot) {
      g.beginPath();
      if (size === 1) {
        const k = r * 0.42;
        g.moveTo(x - r + k, y - r); g.arcTo(x + r, y - r, x + r, y + r, k); g.arcTo(x + r, y + r, x - r, y + r, k);
        g.arcTo(x - r, y + r, x - r, y - r, k); g.arcTo(x - r, y - r, x + r, y - r, k); g.closePath();
      } else if (size === 2) {
        for (let i = 0; i < 8; i++) { const a = (rot || 0) + Math.PI / 8 + i * Math.PI / 4; if (i) g.lineTo(x + Math.cos(a) * r * 1.06, y + Math.sin(a) * r * 1.06); else g.moveTo(x + Math.cos(a) * r * 1.06, y + Math.sin(a) * r * 1.06); }
        g.closePath();
      } else g.arc(x, y, r, 0, TAU);
    }
    function label(txt, x, y, col, w) {
      g.lineWidth = w || 3.5; g.strokeStyle = INK; g.strokeText(txt, x, y);
      g.fillStyle = col; g.fillText(txt, x, y);
    }
    const SX = x => (x - cam.x) * cam.z + W / 2, SY = y => (y - cam.y) * cam.z + H / 2;
    function edgePass(pass) {
      const z = cam.z;
      for (const N of list) {
        if (N.st === 'hidden') continue;
        const bx = SX(N.x), by = SY(N.y);
        const n = N.reqs.length || (center ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const R = N.reqs[i];
          if (R && R.st === 'hidden') continue;
          const ax = R ? SX(R.x) : SX(0), ay = R ? SY(R.y) : SY(0);
          if (Math.max(ax, bx) < -20 || Math.min(ax, bx) > W + 20 || Math.max(ay, by) < -20 || Math.min(ay, by) > H + 20) continue;
          const st = N.st, a = N.rev;
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + (bx - ax) * a, ay + (by - ay) * a);
          if (pass === 0) {
            if (st === 'fog') continue;
            g.lineWidth = (st === 'owned' ? 8 : 6.5) * z; g.strokeStyle = INK; g.setLineDash(DASH_NONE); g.stroke();
          } else if (st === 'owned') {
            g.lineWidth = 4 * z; g.strokeStyle = N.col; g.setLineDash(DASH_NONE); g.stroke();
          } else if (st === 'open') {
            g.lineWidth = 2.5 * z; g.strokeStyle = N.can ? YEL : N.colL; g.setLineDash(DASH_OPEN); g.lineDashOffset = -time * 16; g.stroke();
          } else {
            g.lineWidth = 2 * z; g.strokeStyle = 'rgba(255,250,238,.3)'; g.setLineDash(DASH_FOG); g.lineDashOffset = 0; g.stroke();
          }
        }
      }
      g.setLineDash(DASH_NONE); g.lineDashOffset = 0;
    }
    function drawIcon(src, x, y, s) {
      if (!src) return;
      const m = Math.max(src.width, src.height), w = src.width / m * s, hh = src.height / m * s;
      g.drawImage(src, Math.round(x - w / 2), Math.round(y - hh / 2), Math.round(w), Math.round(hh));
    }
    function drawNode(N, dt) {
      const z = cam.z, st = N.st;
      if (N.rev < 1) N.rev = Math.min(1, N.rev + dt * 2.6);
      if (N.pop > 0) N.pop = Math.max(0, N.pop - dt * 2.2);
      const x = SX(N.x), y0n = SY(N.y), pad = 90 * z;
      if (x < -pad || x > W + pad || y0n < -pad || y0n > H + pad) return;
      const rv = U.ease.back(N.rev), pp = Math.sin(N.pop * Math.PI) * 0.3;
      const bob = st === 'open' && N.can ? Math.sin(time * 3.2 + N.ph) * 2.2 * z : 0;
      const y = y0n + bob, r = N.r * z * rv * (1 + pp) * (N === hover ? 1.06 : 1);
      if (r < 1) return;
      const key = N.size === 2, lw = Math.max(1.5, 2.6 * z);
      // halo de "dá pra comprar": um pulso suave a cada 3 s
      if (st === 'open' && N.can) {
        const ph = (time * 0.33 + N.ph * 0.05) % 1, k = ph < 0.4 ? Math.sin(ph / 0.4 * Math.PI) : 0;
        g.globalAlpha = 0.25 + 0.4 * k; shape(x, y, r + (5 + 5 * k) * z, N.size); g.fillStyle = GOLD; g.fill(); g.globalAlpha = 1;
      }
      // keystone: aro tracejado girando
      if (key && st !== 'fog') {
        g.beginPath(); g.arc(x, y, r + 9 * z, 0, TAU);
        g.lineWidth = 5.5 * z; g.strokeStyle = INK; g.stroke();
        g.lineWidth = 2.6 * z; g.strokeStyle = st === 'owned' ? GOLD : CREAM; g.setLineDash(DASH_KEY); g.lineDashOffset = time * 14; g.stroke();
        g.setLineDash(DASH_NONE); g.lineDashOffset = 0;
      }
      if (st === 'fog') {
        shape(x, y, r, N.size); g.fillStyle = 'rgba(42,26,16,.72)'; g.fill();
        g.lineWidth = lw; g.strokeStyle = 'rgba(255,250,238,.42)'; g.setLineDash(DASH_FOG); g.stroke(); g.setLineDash(DASH_NONE);
        if (N.ico) { g.globalAlpha = 0.5; drawIcon(silhouette(N.ico, '#0d0805'), x, y, r * 1.15); g.globalAlpha = 1; }
        g.font = F_Q; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (z > 0.6) { g.fillStyle = 'rgba(255,250,238,.6)'; g.fillText('?', x, y + 1); }
      } else {
        // sombra dura + corpo + luz
        shape(x, y + 3.5 * z, r, N.size); g.fillStyle = INK; g.fill();
        g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
        shape(x, y, r, N.size);
        g.fillStyle = st === 'owned' ? N.col : N.can ? YEL : CREAM; g.fill();
        g.save(); g.clip();
        g.fillStyle = st === 'owned' ? N.colD : 'rgba(42,26,16,.12)'; g.globalAlpha = st === 'owned' ? 0.55 : 1;
        g.fillRect(x - r * 1.2, y + r * 0.55, r * 2.4, r);
        g.globalAlpha = 0.4; g.fillStyle = '#fff'; g.fillRect(x - r * 1.2, y - r * 1.1, r * 2.4, r * 0.42); g.globalAlpha = 1;
        // preenchimento de progresso (quanto falta) subindo por dentro
        if (st === 'open' && !N.can && N.prog > 0) { g.globalAlpha = 0.5; g.fillStyle = N.col; g.fillRect(x - r * 1.2, y + r * 1.1 - r * 2.2 * N.prog, r * 2.4, r * 2.2 * N.prog); g.globalAlpha = 1; }
        g.restore();
        shape(x, y, r, N.size); g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
        drawIcon(N.ico, x, y, r * (N.size === 0 ? 1.25 : 1.2));
        if (st === 'owned') {                                   // selinho de comprado
          const cx = x + r * 0.74, cy = y - r * 0.74, cr = Math.max(4, 6.5 * z);
          g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fillStyle = '#7f9e5c'; g.fill(); g.lineWidth = Math.max(1.2, 2 * z); g.strokeStyle = INK; g.stroke();
          g.beginPath(); g.moveTo(cx - cr * 0.45, cy); g.lineTo(cx - cr * 0.1, cy + cr * 0.38); g.lineTo(cx + cr * 0.5, cy - cr * 0.36);
          g.lineWidth = Math.max(1.2, 1.9 * z); g.strokeStyle = '#fff'; g.stroke();
        }
      }
      if (N === sel) {                                          // cantoneiras de seleção girando devagar
        const rr = r + (key ? 15 : 8) * z + Math.sin(time * 5) * 1.5 * z;
        g.lineWidth = 6 * z; g.strokeStyle = INK;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < 4; i++) { const a = time * 0.9 + i * Math.PI / 2; g.beginPath(); g.arc(x, y, rr, a, a + 0.75); g.stroke(); }
          g.lineWidth = 3 * z; g.strokeStyle = '#fff';
        }
      }
    }
    function drawLabel(N) {
      const z = cam.z, st = N.st;
      if (st === 'hidden' || N.rev < 0.6) return;
      const x = SX(N.x), y = SY(N.y) + (N.r + (N.size === 2 ? 12 : 5)) * z + 3;
      if (x < -80 || x > W + 80 || y < -30 || y > H + 30) return;
      const big = N.size > 0 || N === sel || N === hover;
      if (z < 0.62 && !big && !N.can) return;
      g.textAlign = 'center'; g.textBaseline = 'top';
      if (st === 'fog') {
        if (z < 0.8 && N !== sel && N !== hover) return;
        g.font = F_SMALL; g.globalAlpha = 0.8; label(N.need, x, y, '#d9cdb6', 3); g.globalAlpha = 1;
        return;
      }
      g.font = N.size === 2 ? F_BIG : F_NAME;
      label(N.name, x, y, st === 'owned' ? N.colL : '#fff');
      if (st === 'open') {
        g.font = F_SMALL;
        if (!N.wPrice) N.wPrice = g.measureText(N.price).width;
        const w = N.wPrice + 12, hh = 15, py = y + (N.size === 2 ? 17 : 14);
        g.beginPath(); g.moveTo(x - w / 2 + 7, py); g.arcTo(x + w / 2, py, x + w / 2, py + hh, 7); g.arcTo(x + w / 2, py + hh, x - w / 2, py + hh, 7);
        g.arcTo(x - w / 2, py + hh, x - w / 2, py, 7); g.arcTo(x - w / 2, py, x + w / 2, py, 7); g.closePath();
        g.fillStyle = INK; g.save(); g.translate(0, 2); g.fill(); g.restore();
        g.fillStyle = N.can ? YEL : CREAM; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
        g.fillStyle = INK; g.fillText(N.price, x, py + 2.5);
      }
    }
    function draw(dt) {
      const z = cam.z;
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      g.clearRect(0, 0, W, H);
      g.lineCap = 'round'; g.lineJoin = 'round'; g.imageSmoothingEnabled = false;
      // papel pontilhado do mapa + anéis de distância
      const step = UNIT / 2 * z, ox = ((W / 2 - cam.x * z) % step + step) % step, oy = ((H / 2 - cam.y * z) % step + step) % step;
      g.fillStyle = 'rgba(255,250,238,.1)';
      const ds = Math.max(1.5, 2.2 * z);
      g.beginPath();
      for (let yy = oy; yy < H; yy += step) for (let xx = ox; xx < W; xx += step) g.rect(xx - ds / 2, yy - ds / 2, ds, ds);
      g.fill();
      const cx = SX(0), cy = SY(0);
      g.strokeStyle = 'rgba(255,250,238,.07)'; g.lineWidth = 2;
      for (let i = 1; i <= 5; i++) { g.beginPath(); g.arc(cx, cy, i * UNIT * 1.3 * z, 0, TAU); g.stroke(); }
      // arestas: passe de contorno, depois o de cor (as junções ficam limpas)
      edgePass(0); edgePass(1);
      // sinergias: pontilhado dourado que acende quando os dois lados são seus
      for (const s of syn) {
        if (s.a.st === 'hidden' || s.b.st === 'hidden') continue;
        const lit = s.a.st === 'owned' && s.b.st === 'owned';
        g.beginPath(); g.moveTo(SX(s.a.x), SY(s.a.y)); g.lineTo(SX(s.b.x), SY(s.b.y));
        if (lit) { g.lineWidth = 6 * z; g.strokeStyle = INK; g.stroke(); }
        g.setLineDash(DASH_SYN); g.lineDashOffset = lit ? -time * 10 : 0;
        g.lineWidth = (lit ? 3.4 : 2.4) * z; g.strokeStyle = lit ? GOLD : 'rgba(243,201,74,.45)'; g.stroke();
        g.setLineDash(DASH_NONE);
      }
      // centro: o rosto do Kome
      if (center) {
        const r = center.r * z * (1 + Math.sin(time * 2) * 0.025);
        g.beginPath(); g.arc(cx, cy + 4 * z, r, 0, TAU); g.fillStyle = INK; g.fill();
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fillStyle = YEL; g.fill(); g.lineWidth = 3 * z; g.strokeStyle = INK; g.stroke();
        g.beginPath(); g.arc(cx, cy, r - 5 * z, 0, TAU); g.fillStyle = CREAM; g.fill(); g.lineWidth = 2 * z; g.stroke();
        drawIcon(centerIco, cx, cy + (center.dy || 0) * z, r * (center.scale || 1.5));
        if (center.label && z > 0.6) { g.font = F_BIG; g.textAlign = 'center'; g.textBaseline = 'top'; label(center.label, cx, cy + r + 6, YEL); }
      }
      for (const N of list) if (N.st !== 'hidden') drawNode(N, dt);
      g.imageSmoothingEnabled = true;
      for (const N of list) drawLabel(N);
      // explosão de compra: anel + raios
      for (const b of bursts) {
        if (b.t >= 1) continue;
        b.t = Math.min(1, b.t + dt * 1.9);
        const e = U.ease.out(b.t), x = SX(b.x), y = SY(b.y), r = (26 + 70 * e) * z;
        g.globalAlpha = 1 - b.t;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.lineWidth = (9 * (1 - e) + 1) * z; g.strokeStyle = '#fff'; g.stroke();
        g.lineWidth = 4 * z * (1 - e) + 1; g.strokeStyle = b.col;
        for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + 0.3; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); g.lineTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2); g.stroke(); }
        g.globalAlpha = 1;
      }
    }

    /* ---------- laço ---------- */
    function run(dt, t) {
      if (dead || !el.isConnected) { running = false; return false; }
      if (!el.offsetWidth) { running = false; return false; }           // escondida (painel fechado): dorme; o ResizeObserver acorda
      if (!W) resize();
      time = t;
      // zoom suave ancorado no cursor
      if (Math.abs(cam.tz - cam.z) > 0.001) {
        cam.z = U.damp(cam.z, cam.tz, 14, dt);
        if (cam.anchor) { cam.x = cam.awx - (cam.ax - W / 2) / cam.z; cam.y = cam.awy - (cam.ay - H / 2) / cam.z; }
      } else { cam.z = cam.tz; cam.anchor = false; }
      if (cam.follow) {
        cam.x = U.damp(cam.x, cam.tx, 9, dt); cam.y = U.damp(cam.y, cam.ty, 9, dt);
        if (Math.abs(cam.x - cam.tx) + Math.abs(cam.y - cam.ty) < 0.4) cam.follow = false;
      } else if (!ptr.size) {
        cam.x += cam.vx * dt; cam.y += cam.vy * dt;                        // inércia
        const k = Math.exp(-5 * dt); cam.vx *= k; cam.vy *= k;
        // limites elásticos
        const m = 60, lx0 = x0 - m, lx1 = x1 + m, ly0 = y0 - m, ly1 = y1 + m;
        if (cam.x < lx0) cam.x = U.damp(cam.x, lx0, 10, dt); else if (cam.x > lx1) cam.x = U.damp(cam.x, lx1, 10, dt);
        if (cam.y < ly0) cam.y = U.damp(cam.y, ly0, 10, dt); else if (cam.y > ly1) cam.y = U.damp(cam.y, ly1, 10, dt);
      }
      affT -= dt;
      if (affT <= 0) { affT = 0.2; afford(); if (o.chips !== false) updateChips(); }
      cardT -= dt;
      if (sel && cardT <= 0) { cardT = 0.2; liveCard(); }
      draw(dt);
    }

    refresh();
    resize();
    const start = o.focus ? byId[o.focus] : (o.startCheapest !== false ? cheapest() : null);
    if (start) focus(start, { instant: true }); else focus(null, { instant: true });

    return {
      el, refresh, focus, select, home, cheapest: br => { const N = cheapest(br); return N ? N.d : null; }, zoomBy,
      // openAt(id?): recentra (no nó aberto mais barato, se não passar id); chamar ao abrir o painel
      openAt(id) { refresh(); resize(); const N = id ? byId[id] : cheapest(); focus(N || null, { instant: true }); },
      // count() -> {have, total, can}
      count() { let have = 0, can = 0; for (const N of list) { if (N.st === 'owned') have++; if (N.can) can++; } return { have, total: list.length, can }; },
      get selected() { return sel ? sel.d : null; },
      state: id => (byId[id] ? byId[id].st : null),
      destroy() { dead = true; if (ro) ro.disconnect(); if (offStage) offStage(); el.remove(); },
    };
  }

  /* ======================================================================
     14. Export
     ====================================================================== */
  // E.UI.loadFont(): pede a Zen Maru Gothic ao Google Fonts sem travar a página (offline o fallback do kome.css assume)
  function loadFont() {
    if (doc.getElementById('k-font')) return;
    const l = h('link'); l.id = 'k-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=swap';
    l.media = 'print'; l.onload = () => { l.media = 'all'; };              // não bloqueia a primeira pintura
    doc.head.appendChild(l);
  }

  Object.assign(UI, {
    mount, spacer, pill, roll, bar, goal, goals, button, flyer, panel, tabs, dialog, confirm, stat,
    banner, toast, achievement, celebrate, tooltip, missions, album, row, toggle, slider,
    sparkline, rate, gauge, tree, icon, iconEl, defineIcon, badge, sfx, loadFont, el: h,
    // E.UI.icons() -> nomes do conjunto embutido
    icons: () => Object.keys(ICON_DEFS),
    // E.UI.iconSrc(nome) -> canvas-fonte 16x16 (pra desenhar o mesmo ícone dentro do canvas do jogo)
    iconSrc: srcIcon,
  });
  E.UI = UI;
})();
