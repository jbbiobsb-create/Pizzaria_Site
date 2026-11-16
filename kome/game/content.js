/* GERADO por tools/content.js a partir de conteudo/*.js — não edite aqui, edite as fichas e rode o tools/content.js */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {}), D = G.Data;
  const lista = (G.Fichas = G.Fichas || []);
  function ficha(f) {
    try {
      const id = String(f.id || f.nome).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
      const spr = () => (f.desenho ? E.spriteText('ficha/' + id, f.desenho) : null);
      const base = { id, n: f.nome, d: f.desc || '', fromCard: true, sprite: spr, onde: f.onde || {}, escala: f.escala };
      if (f.tipo === 'enfeite' || f.tipo === 'bicho') {
        if (D.decorById && D.decorById[id]) return;
        const it = Object.assign(base, { kind: f.tipo === 'bicho' ? 'pet' : 'decor', sec: f.preco || 60, anda: f.tipo === 'bicho' });
        D.DECOR.push(it); if (D.decorById) D.decorById[id] = it;
      } else if (f.tipo === 'roupa') {
        if (D.CLOSET.some(c => c.id === id)) return;
        D.CLOSET.push(Object.assign(base, { kind: 'acc', island: f.ilha }));
      } else if (f.tipo === 'evento') {
        if (G.Inf && G.Inf.addEvent) G.Inf.addEvent({ id, n: f.nome, sub: f.sub || f.desc || '', dur: f.dur || 30, mult: f.mult || 2, icon: f.icone || 'star' });
      } else if (f.tipo === 'loja') {
        if (D.SHOPS && !D.SHOPS.some(s => s.id === id)) D.SHOPS.push({ id, n: f.nome, d: f.desc || '', k: f.k || 'sell', r: f.r || 0.05 });
      } else { console.warn('[kome] ficha com tipo desconhecido:', f.tipo, f.nome); return; }
      lista.push(Object.assign({ tipo: f.tipo }, base));
    } catch (e) { console.warn('[kome] ficha quebrada:', f && f.nome, e); }
  }

  /* ===== conteudo/bicho-tanuki.js ===== */
ficha({
  tipo: 'bicho', id: 'tanuki', nome: 'Tanuki', desc: 'aparece pra roubar onigiri (e fica)',
  preco: 120, onde: { x: 0.72, y: 30 }, escala: 2,
  desenho: `
    .kk....kk...
    kEEk..kEEk..
    .EEEEEEEE...
    EENNEEENNE..
    EnWNEEEWnE..
    .EEENNEEE...
    ..eEEEEe.kk.
    .eEAAAAEekKk
    .eEAAAAEe.Kk
    ..ee..ee..k.
  `,
});


  /* ===== conteudo/enfeite-lanterna_papel.js ===== */
ficha({
  tipo: 'enfeite', id: 'lanterna_papel', nome: 'Lanterninhas de papel', desc: 'chōchin vermelhas no varal',
  preco: 50, onde: { x: 0.3, y: -40 }, escala: 2,
  desenho: `
    NNNNNNNNNNNNNNNNNNNNNNNNNN
    ..n.......n.......n.......
    .rRr.....rRr.....rRr......
    rRRRr...rRRRr...rRRRr.....
    RRYRR...RRYRR...RRYRR.....
    rRRRr...rRRRr...rRRRr.....
    .rRr.....rRr.....rRr......
    ..y.......y.......y.......
  `,
});


  /* ===== conteudo/evento-chuva_onigiri.js ===== */
ficha({
  tipo: 'evento', id: 'chuva_onigiri', nome: 'Chuva de onigiri!', sub: 'renda ×2,5 por 25 segundos',
  dur: 25, mult: 2.5, icone: 'star',
});


  /* ===== conteudo/loja-ramen.js ===== */
ficha({
  tipo: 'loja', id: 'ramen', nome: 'Barraca de Ramen', desc: 'cliente: +6% de renda por nível (sopa com arroz do Kome)',
  k: 'sell', r: 0.06,
});


  /* ===== conteudo/roupa-bone.js ===== */
ficha({
  tipo: 'roupa', id: 'bone', nome: 'Boné Azul', desc: 'aba pra trás, estilo skatista',
  onde: { x: -1, y: -10 }, escala: 1,
  desenho: `
    ..bbbbb...
    .bBBBBBb..
    bBBWWBBBbb
    bbbbbbbbbb
  `,
});

})();
