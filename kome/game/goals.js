/* Kome no Japão — goals.js
   Conquistas, missões e caderno (GDD §8.3). Nada de culpa, prazo ou streak: missão não expira e não falha.
   - 30 conquistas; cada uma dá um Selo = +1% de renda pra sempre (entra em computeStats via G.Goals.mult()).
   - 3 missões ativas, geradas a partir do momento do jogador; ao completar paga ~1 min de renda e outra entra no lugar.
   - Caderno: aba na Casa do Kome com as missões e o álbum de conquistas.
   Estado: S.stats.ach = {id: 1}, S.stats.mis = [{k, base, need, r}], S.stats.misDone (vai no save junto com stats). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data;
  let api = null, S = null, acc = 0;
  const TI = id => (D.toolIndex && D.toolIndex[id] !== undefined ? D.toolIndex[id] : 99);
  const frac = () => (S.heapTotal ? (S.heapTotal - S.heapArea) / S.heapTotal : 0);
  const homeN = k => { const h = S.homeData; if (!h || !h.own) return 0; return D.DECOR.filter(x => x.kind === k && h.own[x.id]).length; };
  const st = () => S.stats;
  const ACH = [
    ['k01', 'Primeira Patada', 'cave o primeiro montinho', () => S.dug >= 20, 'paw'],
    ['k02', 'Primeiro Iene Suado', 'ganhe ¥1.000', () => S.earned >= 1e3, 'yen'],
    ['k03', 'Estourador', 'estoure 10 sacos', () => st().sacks >= 10, 'sack'],
    ['k04', 'Garimpeiro', 'ache 3 bolsões', () => st().pockets >= 3, 'chest'],
    ['k05', 'Combo de Mestre', 'segure o combo cheio por 30 s', () => st().comboMaxSecs >= 30, 'bolt'],
    ['k06', 'Onigiri Feliz', 'pegue 5 onigiris da sorte', () => st().onigiri >= 5, 'star'],
    ['k07', 'Dono de Terreno', 'compre o terreno', () => S.house >= 1, 'house'],
    ['k08', 'Tirou a Carta', 'compre o trator', () => S.tool >= TI('trator'), 'check'],
    ['k09', 'Mordida Perfeita', '60 s de mordidas perfeitas', () => st().perfectSecs >= 60, 'star'],
    ['k10', 'Carga Coroada', 'coroe 5 cargas', () => st().crowned >= 5, 'trophy'],
    ['k11', 'Milionário', 'ganhe ¥1 milhão', () => S.earned >= 1e6, 'yen'],
    ['k12', 'Escavadeira!', 'compre a escavadeira', () => S.tool >= TI('escav'), 'bolt'],
    ['k13', 'Árvore Florida', 'tenha 40 nós da árvore', () => Object.keys(S.own).length >= 40, 'tree'],
    ['k14', 'Meia Montanha', 'cave metade da montanha', () => frac() >= 0.5, 'rice'],
    ['k15', 'Engenheiro', 'monte a fundação da Bagger', () => !!S.own.bg2, 'gear'],
    ['k16', '1 Shiba, 14.200 t', 'compre a Bagger 293', () => S.tool >= TI('bagger'), 'horn'],
    ['k17', 'Bilionário', 'ganhe ¥1 bilhão', () => S.earned >= 1e9, 'yen'],
    ['k18', 'Casa no Japão', 'termine a casa', () => S.house >= 6, 'house'],
    ['k19', 'Árvore Completa', 'compre todos os nós', () => Object.keys(S.own).length >= D.TREE.length, 'tree'],
    ['k20', 'Velocista', 'chegue a ¥100 mil/s', () => st().bestIps >= 1e5, 'clock'],
    ['k21', 'Fashion Shiba', 'ache 3 roupinhas', () => (S.closet || []).length >= 3, 'hat'],
    ['k22', 'Guarda-roupa Cheio', 'ache todas as roupinhas', () => (S.closet || []).length >= D.CLOSET.length, 'hat'],
    ['k23', 'Jardineiro', '5 enfeites no quintal', () => homeN('decor') >= 5, 'tree'],
    ['k24', 'Zoológico do Kome', '4 bichinhos em casa', () => homeN('pet') >= 4, 'paw'],
    ['k25', 'Semana de Trabalho', 'chegue ao dia 7', () => (S.day || 1) >= 7, 'clock'],
    ['k26', 'Montanha Nova', 'comece a segunda montanha', () => (S.mount || 1) >= 2, 'rice'],
    ['k27', 'Mecânico', 'um veículo no nível 10', () => Object.values(st().lv || {}).some(v => v >= 10), 'bolt'],
    ['k28', 'Troca-Troca', 'troque de lugar 5 vezes', () => (st().swaps || 0) >= 5, 'swap'],
    ['k29', 'Festeiro', 'aproveite 3 eventos', () => (st().events || 0) >= 3, 'star'],
    ['k30', 'Missão Dada', 'complete 15 missões', () => (st().misDone || 0) >= 15, 'book'],
  ].map(a => ({ id: a[0], n: a[1], d: a[2], cond: a[3], icon: a[4] }));

  // missões: k = estatística, need = quanto a mais
  const TPL = [
    { k: 'sacks', n: v => 'Estoure ' + v + ' sacos', need: () => 8 + S.tool, icon: 'sack' },
    { k: 'pockets', n: v => 'Ache ' + v + (v > 1 ? ' bolsões' : ' bolsão'), need: () => 1 + (S.tool >= 8 ? 1 : 0), icon: 'chest' },
    { k: 'earned', n: v => 'Ganhe ¥' + U.fmt(v), need: () => Math.max(500, Math.round((S.ips || 5) * 240)), icon: 'yen' },
    { k: 'comboMaxSecs', n: v => 'Combo cheio por ' + v + ' s', need: () => 10, icon: 'bolt' },
    { k: 'buys', n: v => 'Compre ' + v + ' coisas', need: () => 4, icon: 'check' },
    { k: 'dug', n: v => 'Cave ' + U.fmt(v * 40) + ' grãos', need: () => Math.max(50, Math.round((S.heapTotal || 1e5) * 0.015)), icon: 'rice' },
    { k: 'onigiri', n: v => 'Pegue ' + v + ' onigiri', need: () => 1, icon: 'star' },
  ];
  const val = k => k === 'earned' ? S.earned : k === 'dug' ? S.dug : (st()[k] || 0);
  function newMission(skip) {
    const used = (st().mis || []).map(m => m.k);
    const pool = TPL.filter(t => used.indexOf(t.k) < 0 && t.k !== skip && (t.k !== 'onigiri' || S.tool >= 2));
    const t = pool[(Math.random() * pool.length) | 0] || TPL[0], need = t.need();
    return { k: t.k, base: val(t.k), need };
  }
  function ensure() {
    const s = st(); s.ach = s.ach || {}; s.mis = Array.isArray(s.mis) ? s.mis.filter(m => TPL.some(t => t.k === m.k)) : [];
    while (s.mis.length < 3) s.mis.push(newMission());
  }
  const count = () => Object.keys(st().ach || {}).length;
  function mult() { return S ? 1 + 0.01 * count() : 1; }

  function tick(dt) {
    if (!S || (acc += dt) < 1) return; acc = 0;
    ensure();
    const s = st(); let changed = false, mis = false;
    for (const a of ACH) if (!s.ach[a.id]) {
      let ok = false; try { ok = !!a.cond(); } catch (e) { ok = false; }
      if (ok) { s.ach[a.id] = 1; changed = true; if (!api.quiet()) { UI.achievement(a.n, { sub: 'selo: +1% de renda pra sempre', icon: a.icon, kicker: 'Conquista' }); api.sfx('fanfare'); } api.badge(); }
    }
    for (let i = 0; i < s.mis.length; i++) {
      const m = s.mis[i];
      if (val(m.k) - m.base >= m.need) {
        const r = Math.max(30, Math.round(Math.min(S.ips || 5, (S.stats.bestIps || 5)) * 6));
        api.pay(r); s.misDone = (s.misDone || 0) + 1;
        if (!api.quiet()) { const t = TPL.find(x => x.k === m.k); UI.toast('Missão feita: ' + t.n(m.need), { icon: 'chest', tone: 'gold', sub: '+¥' + U.fmt(r) }); api.sfx('pling'); }
        s.mis[i] = newMission(m.k); mis = true;
      }
    }
    if (changed) api.recompute();
    if ((changed || mis) && panelEls && panelEls.root.isConnected) refresh();
  }

  /* ---- caderno (dentro da aba "Caderno" da Casa) ---- */
  let panelEls = null;
  function fill(pane) {
    pane.innerHTML = '';
    const col = UI.el('div', 'k-col', pane);
    panelEls = { root: col };
    UI.el('div', 'k-h', col, 'Missões');
    ensure();
    for (const m of st().mis) {
      const t = TPL.find(x => x.k === m.k), p = U.clamp((val(m.k) - m.base) / m.need, 0, 1);
      const b = UI.button(col, { title: t.n(m.need), sub: Math.round(p * 100) + '% · prêmio: um saquinho de ienes', icon: t.icon, size: 'sm', progress: p });
      (b.el || b).style.width = '100%';
    }
    UI.el('div', 'k-h', col, 'Conquistas · ' + count() + '/30 · renda +' + count() + '%');
    if (UI.album) {
      UI.album(col, { cols: 2, items: ACH.map(a => ({ id: a.id, name: a.n, hint: a.d, q: '', a: a.d, icon: a.icon, unlocked: !!st().ach[a.id] })) });
    } else for (const a of ACH) UI.el('div', 'k-homehint', col, (st().ach[a.id] ? '✓ ' + a.n : '··· ' + a.d));
    if (G.AmuletosUI) G.AmuletosUI.caderno(col);   // coleção de amuletos (omamori) descobertos
    if (G.Evolucoes) G.Evolucoes.caderno(col);   // evoluções de máquina (com "?" até achar)
  }
  function refresh() { if (panelEls && panelEls.pane) fill(panelEls.pane); }
  function mountIn(pane) { fill(pane); panelEls.pane = pane; }

  G.Goals = {
    init(a) { api = a; S = G.S; ensure(); },
    tick, mult, mountIn, refresh, list: ACH, count,
  };
})();
