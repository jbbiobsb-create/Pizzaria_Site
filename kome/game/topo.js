/* Kome no Japão — topo.js  (preparação da fase 1 do PLANO-100H)
   A SEGUNDA TELA, vista de cima (E.Board), onde a Fábrica vai morar. Por enquanto é um canteiro de obras de 8×6:
   abre e fecha, seleciona célula, e a ferramenta "Esteira" desenha esteira de teste arrastando o dedo (só na memória,
   não vai pro save). Quando a spec docs/design/fabrica.md for aprovada, as máquinas entram aqui.
   Só aparece no ?dev (atalho "tela de cima") até a fábrica existir. O jogo da montanha pausa com ela aberta
   (game.js · update), mas G.Sim continua rodando. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  let board = null, api = null;
  const belts = {};   // "c,r" -> direção 0..3 (→ ↓ ← ↑), teste
  const key = (c, r) => c + ',' + r;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  // esteira vista de cima: faixa escura com setinhas andando na direção
  function drawBelt(g, x, y, s, d, t) {
    const LINE = '#3B2818';
    g.save(); g.translate(x + s / 2, y + s / 2); g.rotate(d * Math.PI / 2);   // desenha sempre "pra direita" e gira
    const h = s / 2;
    g.fillStyle = '#5E544C'; g.fillRect(-h - 0.5, -s * 0.3, s + 1, s * 0.6);
    g.fillStyle = '#B7AFA2'; g.fillRect(-h - 0.5, -s * 0.3, s + 1, 3); g.fillRect(-h - 0.5, s * 0.3 - 3, s + 1, 3);
    g.strokeStyle = LINE; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-h, -s * 0.3); g.lineTo(h, -s * 0.3); g.moveTo(-h, s * 0.3); g.lineTo(h, s * 0.3); g.stroke();
    g.beginPath(); g.rect(-h, -s * 0.3 + 3, s, s * 0.6 - 6); g.clip();
    const off = (t * s * 0.8) % (s / 2);
    g.strokeStyle = '#F3C94A'; g.lineWidth = Math.max(2, s / 14);
    for (let i = -2; i < 3; i++) { const ax = -s / 2 + off + i * s / 2; g.beginPath(); g.moveTo(ax - s * 0.08, -s * 0.14); g.lineTo(ax + s * 0.06, 0); g.lineTo(ax - s * 0.08, s * 0.14); g.stroke(); }
    g.restore();
  }
  function build() {
    board = E.Board({
      cols: 8, rows: 6, title: 'Fábrica · em obras', back: 'Montanha',
      tools: [{ id: 'esteira', label: 'Esteira' }, { id: 'apagar', label: 'Apagar' }],
      floor: (c, r) => ((c + r) & 1 ? '#E9D9B8' : '#E1CFA9'),   // piso de madeira clara do galpão
      drawCell(g, c, r, x, y, s, t) { const d = belts[key(c, r)]; if (d !== undefined) drawBelt(g, x, y, s, d, t); },
      draw(g, v, t) {
        // placa de obra e o Kome de capacete no canto, pra tela vazia não ficar sem vida
        const bx = v.x + v.s * 6.1, by = v.y + v.s * 5.85;
        if (E.drawShiba) E.drawShiba(g, bx, by, Math.floor(t / 3) % 2 ? 'wag' : 'sit', t, { scale: Math.max(1, v.s / 26), pal: (G.S && G.S.look && G.S.look.pal) || 'kome' });
        if (E.Draw && E.Draw.sign) E.Draw.sign(g, v.x + v.s * 0.3, v.y + v.s * 0.3, v.s * 2.4, v.s * 0.6, 'EM OBRAS', { col: '#F3C94A', ink: '#3B2818' });
      },
      onDrag(cells, done) {
        if (board.tool === 'apagar') { for (const [c, r] of cells) delete belts[key(c, r)]; return; }
        if (board.tool !== 'esteira') return;
        for (let i = 0; i < cells.length; i++) {   // cada célula aponta pra próxima do caminho
          const [c, r] = cells[i], n = cells[i + 1] || cells[i], p = cells[i - 1];
          let dx = n[0] - c, dy = n[1] - r; if (!dx && !dy && p) { dx = c - p[0]; dy = r - p[1]; }
          const d = DIRS.findIndex(q => q[0] === Math.sign(dx) && q[1] === Math.sign(dy));
          belts[key(c, r)] = d < 0 ? 0 : d;
        }
        if (done && api) api.sfx('pling');
      },
      onTap(c, r) { if (board.tool === 'apagar') delete belts[key(c, r)]; },
      onOpen() { if (api) api.sfx('whoosh'); },
    });
  }
  G.Topo = {
    init(a) { api = a; },
    open() { if (!board) build(); board.open(); return board; },
    close() { if (board) board.close(); },
    isOpen: () => !!(board && board.isOpen()),
    board: () => board, belts,
  };
})();
