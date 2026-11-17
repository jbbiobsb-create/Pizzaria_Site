/* ============================================================================
   Pixxel v1.0 — board.js
   E.Board: SEGUNDA TELA, vista de cima, em grid (fábrica, cidade, mapa de regiões...). Tela cheia por cima do jogo,
   com canvas próprio, barra de ferramentas embaixo e botão de voltar. Feita pro celular DEITADO (toque) e pro mouse.
     const b = E.Board({
       cols: 8, rows: 6, title: 'Fábrica', back: 'Montanha',
       tools: [{ id: 'esteira', label: 'Esteira', icon: 'belt' }, ...],   // botões da barra (icon = ícone do E.UI, opcional)
       floor(c, r) -> cor do ladrilho (padrão: grama em xadrez)
       drawCell(g, c, r, x, y, s, t)  -> desenha o que tem na célula (x,y = canto, s = lado em px)
       draw(g, view, t)               -> desenho livre por cima (view = {x, y, s, cols, rows, w, h})
       onTap(c, r), onDrag(cells, done)  -> cells = [[c,r]...] em caminho contínuo (4 vizinhos), done no fim
       onTool(id), onOpen(), onClose()
     });
     b.open() · b.close() · b.isOpen() · b.tool (id ativo ou null) · b.setTool(id) · b.sel ([c,r] ou null)
     b.cellAt(px, py) -> [c,r] ou null · b.view · b.toast(txt) · b.el (raiz DOM) · b.bar (barra, pra pôr mais coisas)
   Sem ferramenta ativa, arrastar move a vista (quando o grid não cabe). Toque = selecionar.
   Depende de: core.js (E.UI é opcional, só pros ícones)
   ============================================================================ */
(function () {
  'use strict';
  const E = (window.Pixxel = window.Pixxel || {});
  const LINE = '#3B2818';
  let css = false;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = [
      '.px-board{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:#6E9E4A;opacity:0;pointer-events:none;transform:scale(.97);transition:opacity .18s,transform .18s;touch-action:none;font-family:var(--k-font,system-ui,sans-serif)}',
      '.px-board.px-open{opacity:1;pointer-events:auto;transform:none}',
      '.px-board-top{display:flex;align-items:center;gap:8px;padding:6px 10px;padding-left:max(10px,env(safe-area-inset-left));padding-right:max(10px,env(safe-area-inset-right));background:#FFF8EC;border-bottom:3px solid ' + LINE + '}',
      '.px-board-top b{font-size:17px;color:' + LINE + ';flex:1}',
      '.px-board-wrap{flex:1;position:relative;min-height:0}',
      '.px-board canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}',
      '.px-board-bar{display:flex;gap:6px;padding:6px 10px;padding-bottom:max(6px,env(safe-area-inset-bottom));background:#FFF8EC;border-top:3px solid ' + LINE + ';overflow-x:auto}',
      '.px-board-btn{min-height:40px;min-width:44px;padding:4px 12px;border:3px solid ' + LINE + ';border-radius:12px;background:#FFF1D6;color:' + LINE + ';font-family:inherit;font-weight:800;font-size:14px;display:flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer}',
      '.px-board-btn canvas,.px-board-btn .k-ico{position:static!important;flex:none}',
      '.px-board-btn.px-on{background:#F3C94A;transform:translateY(1px)}',
      '.px-board-back{background:#F6B6B0}',
      '.px-board-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:#FFF8EC;border:3px solid ' + LINE + ';border-radius:12px;padding:4px 12px;font-weight:800;font-size:14px;color:' + LINE + ';opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap}',
      '.px-board-toast.px-on{opacity:1}',
    ].join('\n');
    document.head.appendChild(s);
  }
  const el = (tag, cls, parent, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (parent) parent.appendChild(e); return e; };
  function icon(name, size) {
    const UI = E.UI; if (!UI || !UI.icon || !name) return null;
    try { const c = UI.icon(name, size || 22); return c && c.nodeType ? c : null; } catch (e) { return null; }
  }

  function Board(o) {
    o = o || {}; style();
    const cols = o.cols || 8, rows = o.rows || 6;
    const root = el('div', 'px-board'), top = el('div', 'px-board-top', root);
    const back = el('button', 'px-board-btn px-board-back', top, '← ' + (o.back || 'Voltar'));
    el('b', '', top, o.title || '');
    const wrap = el('div', 'px-board-wrap', root), cv = el('canvas', '', wrap), toastEl = el('div', 'px-board-toast', wrap);
    const bar = el('div', 'px-board-bar', root);
    document.body.appendChild(root);
    const B = { el: root, bar, cols, rows, tool: null, sel: null, view: { x: 0, y: 0, s: 40, cols, rows, w: 0, h: 0 }, pan: { x: 0, y: 0 } };
    const btns = {};
    (o.tools || []).forEach(tl => {
      const b = el('button', 'px-board-btn', bar); const ic = icon(tl.icon); if (ic) b.appendChild(ic); el('span', '', b, tl.label);
      b.onclick = () => B.setTool(B.tool === tl.id ? null : tl.id); btns[tl.id] = b;
    });
    back.onclick = () => B.close();
    B.setTool = id => { B.tool = id || null; for (const k in btns) btns[k].classList.toggle('px-on', k === B.tool); if (o.onTool) o.onTool(B.tool); };
    let tT = 0;
    B.toast = txt => { toastEl.textContent = txt; toastEl.classList.add('px-on'); clearTimeout(tT); tT = setTimeout(() => toastEl.classList.remove('px-on'), 1600); };

    // layout: célula do maior tamanho que cabe (mín. 40 px pra dar toque); se não couber, a vista rola
    function layout(w, h) {
      const pad = 12, s = Math.max(40, Math.floor(Math.min((w - pad * 2) / cols, (h - pad * 2) / rows)));
      const gw = cols * s, gh = rows * s;
      const minX = Math.min(pad, w - gw - pad), minY = Math.min(pad, h - gh - pad);
      if (gw + pad * 2 <= w) B.pan.x = 0; else B.pan.x = Math.max(minX - (w - gw) / 2, Math.min(pad - (w - gw) / 2, B.pan.x));
      if (gh + pad * 2 <= h) B.pan.y = 0; else B.pan.y = Math.max(minY - (h - gh) / 2, Math.min(pad - (h - gh) / 2, B.pan.y));
      Object.assign(B.view, { s, x: Math.round((w - gw) / 2 + B.pan.x), y: Math.round((h - gh) / 2 + B.pan.y), w, h });
    }
    B.cellAt = (px, py) => { const v = B.view, c = Math.floor((px - v.x) / v.s), r = Math.floor((py - v.y) / v.s); return c >= 0 && r >= 0 && c < cols && r < rows ? [c, r] : null; };

    const floor = o.floor || ((c, r) => ((c + r) & 1 ? '#8DBE5C' : '#82B454'));
    let raf = 0;
    function frame() {
      if (!B.isOpen()) { raf = 0; return; }
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(100, wrap.clientWidth), h = Math.max(80, wrap.clientHeight);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      layout(w, h);
      const g = cv.getContext('2d'), t = performance.now() / 1000, v = B.view;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
      g.fillStyle = '#6E9E4A'; g.fillRect(0, 0, w, h);
      // moldura de madeira
      g.fillStyle = '#9A6A44'; g.fillRect(v.x - 8, v.y - 8, cols * v.s + 16, rows * v.s + 16);
      g.strokeStyle = LINE; g.lineWidth = 3; g.strokeRect(v.x - 8, v.y - 8, cols * v.s + 16, rows * v.s + 16);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = v.x + c * v.s, y = v.y + r * v.s;
        g.fillStyle = floor(c, r); g.fillRect(x, y, v.s, v.s);
        if (o.drawCell) { try { o.drawCell(g, c, r, x, y, v.s, t); } catch (e) { /* célula com erro não derruba a tela */ } }
      }
      g.strokeStyle = 'rgba(59,40,24,.18)'; g.lineWidth = 1;
      for (let c = 1; c < cols; c++) { g.beginPath(); g.moveTo(v.x + c * v.s + 0.5, v.y); g.lineTo(v.x + c * v.s + 0.5, v.y + rows * v.s); g.stroke(); }
      for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(v.x, v.y + r * v.s + 0.5); g.lineTo(v.x + cols * v.s, v.y + r * v.s + 0.5); g.stroke(); }
      if (o.draw) { try { o.draw(g, v, t); } catch (e) { /* idem */ } }
      // rastro do arraste e seleção pulsando
      if (drag && drag.on && drag.cells.length) { g.fillStyle = 'rgba(243,201,74,.45)'; for (const [c, r] of drag.cells) g.fillRect(v.x + c * v.s + 2, v.y + r * v.s + 2, v.s - 4, v.s - 4); }
      if (B.sel) { const [c, r] = B.sel, p = 2 + Math.sin(t * 6) * 1.5; g.strokeStyle = '#FFF3B0'; g.lineWidth = 3; g.strokeRect(v.x + c * v.s + p, v.y + r * v.s + p, v.s - p * 2, v.s - p * 2); g.strokeStyle = LINE; g.lineWidth = 1.5; g.strokeRect(v.x + c * v.s + p - 2, v.y + r * v.s + p - 2, v.s - p * 2 + 4, v.s - p * 2 + 4); }
      raf = requestAnimationFrame(frame);
    }

    // entrada: toque = selecionar; arrastar com ferramenta = caminho de células; arrastar sem ferramenta = mover a vista
    let drag = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function stepTo(cells, to) {   // completa o caminho com vizinhos de 4 lados (esteira não anda na diagonal)
      let [c, r] = cells[cells.length - 1];
      while (c !== to[0] || r !== to[1]) { if (c !== to[0]) c += Math.sign(to[0] - c); else r += Math.sign(to[1] - r); cells.push([c, r]); }
    }
    cv.addEventListener('pointerdown', e => { const p = pos(e); drag = { p0: p, last: p, cell: B.cellAt(p[0], p[1]), on: false, cells: [] }; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* */ } });
    cv.addEventListener('pointermove', e => {
      if (!drag) return; const p = pos(e);
      if (!drag.on && Math.hypot(p[0] - drag.p0[0], p[1] - drag.p0[1]) > 8) { drag.on = true; if (B.tool && drag.cell) drag.cells = [drag.cell.slice()]; }
      if (!drag.on) return;
      if (B.tool) { const c = B.cellAt(p[0], p[1]); if (c && drag.cells.length) { const l = drag.cells[drag.cells.length - 1]; if (l[0] !== c[0] || l[1] !== c[1]) { stepTo(drag.cells, c); if (o.onDrag) o.onDrag(drag.cells, false); } } }
      else { B.pan.x += p[0] - drag.last[0]; B.pan.y += p[1] - drag.last[1]; }
      drag.last = p;
    });
    const up = () => {
      if (!drag) return; const d = drag; drag = null;
      if (!d.on) { if (d.cell) { B.sel = d.cell; if (o.onTap) o.onTap(d.cell[0], d.cell[1]); } else B.sel = null; }
      else if (B.tool && d.cells.length && o.onDrag) o.onDrag(d.cells, true);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; });

    B.isOpen = () => root.classList.contains('px-open');
    B.open = () => { if (B.isOpen()) return B; root.classList.add('px-open'); if (!raf) raf = requestAnimationFrame(frame); if (o.onOpen) o.onOpen(); return B; };
    B.close = () => { if (!B.isOpen()) return B; root.classList.remove('px-open'); drag = null; if (o.onClose) o.onClose(); return B; };
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && B.isOpen()) B.close(); });
    return B;
  }
  E.Board = Board;
})();
