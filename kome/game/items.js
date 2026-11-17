/* Kome no Japão — items.js  (fase 0 do PLANO-100H: alicerce)
   ITENS TIPADOS. O arroz continua virando ¥ na hora (nada muda pra quem só cava), mas agora cada saco que sai da montanha
   também entra no ARMAZÉM como item do seu tipo (arroz solto, integral, negro, koshihikari, curry de Kyushu...).
   A fábrica (fase 1) vai consumir daqui; a cidade (fase 3) vai pedir produtos daqui.
   - D.ITEMS (data.js): { id, n, d, val, mat?, icon } — mat = id do material da montanha que vira esse item.
     Material sem item cadastrado vira item automático (id do material, nome do material).
   - Estado no save: S.stats.inv = { id: sacos no armazém }, S.stats.got = { id: sacos já colhidos no total }.
   - 1 saco = D.ITEM_AREA px² de montanha cavada.
   API: G.Items.add(byMat) (chamado pelo game.js a cada mordida), has(id), take(id, n), list(), fill(pane) (aba Armazém da Casa),
        sim (registrado em G.Sim). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data;
  let S = null;
  const st = () => { S = G.S; const s = S.stats; s.inv = s.inv || {}; s.got = s.got || {}; return s; };
  const byMat = {};
  (D.ITEMS || []).forEach(it => { if (it.mat) byMat[it.mat] = it; });
  const byId = {}; (D.ITEMS || []).forEach(it => { byId[it.id] = it; });
  // material que não tem item cadastrado (ex.: camada nova de uma ilha) vira item sozinho
  function itemFor(matId) {
    if (byMat[matId]) return byMat[matId];
    const m = (G.Islands && G.Islands.matsFor ? G.Islands.matsFor() : D.MATS).find(x => x.id === matId) || D.MATS.find(x => x.id === matId);
    const it = { id: matId, n: m ? m.name : matId, d: 'da montanha', val: m ? m.val : 1, mat: matId, icon: 'rice', auto: true };
    byMat[matId] = byId[matId] = it; return it;
  }
  const AREA = () => D.ITEM_AREA || 400;
  function add(bm) {
    if (!bm || !G.S) return;
    const s = st(), k = 1 / AREA();
    for (const m in bm) { const a = bm[m]; if (!(a > 0)) continue; const id = itemFor(m).id; s.inv[id] = (s.inv[id] || 0) + a * k; s.got[id] = (s.got[id] || 0) + a * k; if (G.Fab) G.Fab.sacks(id, a * k); }
  }
  const has = id => (st().inv[id] || 0);
  function take(id, n) { const s = st(); if ((s.inv[id] || 0) < n) return false; s.inv[id] -= n; return true; }
  function put(id, n) { const s = st(); s.inv[id] = (s.inv[id] || 0) + n; s.got[id] = (s.got[id] || 0) + n; }
  function count(id, n) { const s = st(); s.got[id] = (s.got[id] || 0) + n; }   // só o contador (produto da fábrica, já vendido)
  // lista pra tela: cadastrados primeiro (na ordem de D.ITEMS), depois os automáticos que já apareceram
  function list() {
    const s = st(), ids = (D.ITEMS || []).map(i => i.id).concat(Object.keys(s.got).filter(id => !byId[id] || byId[id].auto));
    return ids.filter((id, i) => ids.indexOf(id) === i && (s.got[id] || 0) >= 1).map(id => ({ it: byId[id] || itemFor(id), n: Math.floor(s.inv[id] || 0), all: Math.floor(s.got[id] || 0) }));
  }
  // aba "Armazém" da Casa
  function fill(pane) {
    pane.innerHTML = '';
    const wrap = UI.el('div', 'k-col', pane); wrap.style.padding = '6px 0';
    const L = list();
    const head = UI.el('div', '', wrap);
    head.textContent = L.length ? 'Tudo que o Kome já tirou da montanha e tudo que a Fábrica já fez (o Cardápio).' : 'Cave um pouco: cada saco de arroz aparece aqui.';
    head.style.cssText = 'font-size:13px;opacity:.85;padding:0 4px 6px';
    for (const r of L) {
      const b = UI.button(wrap, { title: r.it.n + ' · ' + U.fmt(r.all) + (r.it.fab ? ' feitos' : ' sacos'), sub: (r.it.d || '') + ' · vale ' + (r.it.val || 1) + '×', size: 'sm', icon: r.it.icon || 'rice' });
      (b.el || b).style.width = '100%';
    }
  }
  G.Items = { add, has, take, put, count, list, fill, itemFor,
    sim: { tick() { /* armazém não muda sozinho ainda; fábrica (fase 1) consome aqui */ } } };
})();
