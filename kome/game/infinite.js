/* Kome no Japão — infinite.js
   Modo infinito (rodada de 16/11, etapa 4). Só liga DEPOIS do final da campanha, pra não mexer no balanço.
   - Oficina: cada veículo comprado tem nível. Cada nível dá +5% de renda; no nível 10, 25 e 50 o bônus daquele veículo
     DOBRA (marco). Preço = segundos da renda atual × 1,12^nível, então nunca acaba.
   - Eventos: a cada ~2 min acontece um (hora do rush, veio dourado, festival) com multiplicador e contagem no HUD.
   Estado: S.stats.lv = { toolId: nível } (vai no save junto com stats). Liga por G.Inf.init(api) em game.js. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data;
  let api = null, S = null, panel = null, pill = null, nextEv = 70;
  const MILES = [10, 25, 50];
  const EVENTS = [
    { id: 'rush', n: 'Hora do rush!', sub: 'a cidade quer arroz: preço ×2', dur: 30, mult: 2, icon: 'clock' },
    { id: 'veio', n: 'Veio de arroz dourado!', sub: 'cada cavada vale ×3', dur: 20, mult: 3, icon: 'star' },
    { id: 'matsuri', n: 'Festival na vila!', sub: 'preço ×1,5 por 1 minuto', dur: 60, mult: 1.5, icon: 'rice' },
  ];
  const lv = () => (S.stats.lv || (S.stats.lv = {}));
  const owned = () => D.TOOLS.slice(0, S.tool + 1);
  const miles = L => MILES.filter(m => L >= m).length;
  const bonusOf = L => 0.05 * L * Math.pow(2, miles(L));
  // o nível vale só pra máquina que você está usando (pedido do irmão do dono: evoluir a pata não pode fortalecer a Bagger)
  function mult(id) {
    if (!S || !S.ended || !id) return 1;
    return 1 + bonusOf(lv()[id] | 0) * (G.Ind ? G.Ind.speedK(id) : 1);
  }
  // força de penetração: +4% por nível (com marcos dobrando), então uma pata nível 50 já atravessa arroz prensado
  const powK = id => (S && S.ended && id ? 1 + 0.04 * (lv()[id] | 0) * Math.pow(1.5, miles(lv()[id] | 0)) : 1);
  // preço proporcional ao tamanho da máquina: nível da pata é barato, nível da Bagger é caro
  const cost = t => { const k = (D.TOOLS.indexOf(t) + 1) / D.TOOLS.length; return Math.max(100, Math.ceil(45 * Math.max(10, G.priceIps ? G.priceIps() : (S.ips || 0)) * k * Math.pow(1.12, lv()[t.id] | 0) / 10) * 10); };
  // up(t, {quiet}): compra 1 nível. quiet = quem chamou cuida do aviso, da festa e da escolha do marco (a tela nova da Oficina).
  // Devolve null se faltou dinheiro, senão { L, mile, cost }.
  function up(t, o) {
    const q = !!(o && o.quiet), c = cost(t);
    if (S.money < c) { if (!q) UI.toast('Faltam ¥' + U.fmt(c - S.money), { icon: 'yen', tone: 'bad', sub: t.name }); return null; }
    S.money -= c; const L = (lv()[t.id] | 0) + 1; lv()[t.id] = L; if (G.priceBump) G.priceBump();
    const mile = MILES.indexOf(L) >= 0;
    api.recompute(); if (!q) api.sfx(mile ? 'fanfare' : 'pling');
    if (mile && !q) { UI.banner(t.name + ' nível ' + L + '!', 'marco: o bônus dela dobrou', { icon: 'star', tone: 'gold', dur: 2.6 }); if (G.Ind) G.Ind.specChoice(t, () => { api.recompute(); api.save(); refresh(); }); }
    api.save(); refresh();
    return { L, mile, cost: c };
  }
  // info(t): tudo que a ficha da máquina mostra (as contas ficam aqui; a tela só desenha)
  function info(t) {
    const L = lv()[t.id] | 0, sk = G.Ind ? G.Ind.speedK(t.id) : 1, pw = n => 1 + 0.04 * n * Math.pow(1.5, miles(n));
    return { L, cost: cost(t), mult: 1 + bonusOf(L) * sk, multNext: 1 + bonusOf(L + 1) * sk, pow: pw(L), powNext: pw(L + 1),
      miles: miles(L), nextMile: MILES.find(m => m > L) || 0, prevMile: MILES.filter(m => m <= L).pop() || 0, spec: ((S.stats.spec || {})[t.id] || []).slice() };
  }
  function refresh() {
    if (!panel) return;
    const b = panel.body; b.innerHTML = '';
    const col = UI.el('div', 'k-col', b);
    if (G.Ind) G.Ind.fillPanel(col, refresh);
    UI.el('div', 'k-h', col, 'Frota');
    UI.el('div', 'k-homehint', col, 'Cada nível deixa ESSA máquina mais forte enquanto você usa ela: mais renda e mais força pra atravessar arroz duro. Troque de lugar (setinhas) pra usar as antigas.');
    const now = api.playing ? api.playing() : null;
    for (const t of owned().slice().reverse()) {
      const L = lv()[t.id] | 0, nx = MILES.find(m => m > L), c = cost(t), on = now && now.id === t.id;
      const btn = UI.button(col, { title: (on ? '★ ' : '') + t.name + ' · nível ' + L, sub: '¥ ' + U.fmt(c) + ' · renda ×' + mult(t.id).toFixed(2).replace('.', ',') + ' · força ×' + powK(t.id).toFixed(1).replace('.', ',') + (on ? ' · usando agora' : '') + (nx ? ' · marco no ' + nx : ''),
        icon: G.Props ? G.Props.icon(t.id) : 'bolt', size: 'sm', onClick: () => up(t) });
      const el = btn.el || btn; el.style.width = '100%'; if (S.money < c) el.style.opacity = '0.6';
    }
  }
  // A Oficina é um LUGAR (game/oficina.js). A lista antiga continua aqui de reserva: abre se a tela nova não carregou,
  // se ela der erro ao abrir, ou com ?oficina=lista no endereço (G.Inf.classic = true faz o mesmo pelo console).
  function openList() {
    if (!S.ended) return false;
    if (!panel) panel = UI.panel({ title: 'Oficina do Kome', icon: 'bolt', side: 'right', onOpen: refresh });
    panel.open(); refresh(); return true;
  }
  function open() {
    if (!S.ended) return false;
    if (G.Ofi && !G.Inf.classic && !/[?&]oficina=lista\b/.test(location.search)) {
      try { if (G.Ofi.open()) return true; } catch (e) { if (window.console) console.warn('[kome] oficina nova falhou, abrindo a lista', e); try { G.Ofi.close(); } catch (e2) { /* */ } }
    }
    return openList();
  }

  /* ---- eventos ---- */
  let ev = null, evT = 0, acc = 0;
  function evMult() { return ev ? ev.mult : 1; }
  function tick(dt) {
    if (!S || !S.ended || api.busy()) return;
    if (ev) {
      evT -= dt;
      if (evT <= 0) { ev = null; nextEv = 90 + Math.random() * 70; if (pill) pill.style.display = 'none'; }
    } else if ((nextEv -= dt) <= 0) {
      ev = EVENTS[(Math.random() * EVENTS.length) | 0]; evT = ev.dur; S.stats.events = (S.stats.events || 0) + 1;
      api.sfx('fanfare'); UI.banner(ev.n, ev.sub, { icon: ev.icon, tone: 'gold', dur: 2.6 });
      if (api.onEvent) api.onEvent(ev);
    }
    if ((acc += dt) >= 0.25) { acc = 0; showPill(); if (panel && panel.isOpen) refreshMoney(); }
  }
  let lastM = -1;
  function refreshMoney() { const m = Math.floor(Math.log10(Math.max(1, S.money)) * 20); if (m !== lastM) { lastM = m; refresh(); } }
  function showPill() {
    const Z = G.HUD && G.HUD.zones; if (!Z || !Z.tc) return;
    if (!pill) { pill = UI.el('div', 'k-pill k-sm k-gold k-evpill', Z.tc); pill.style.display = 'none'; }
    if (!ev) { pill.style.display = 'none'; return; }
    pill.style.display = ''; pill.textContent = ev.n.replace('!', '') + ' ×' + String(ev.mult).replace('.', ',') + ' · ' + Math.ceil(evT) + 's';
  }

  G.Inf = {
    init(a) { api = a; S = G.S; },
    sim: { cost, up },   // tools/longo.js (simulador de horas) compra sem abrir a tela
    addEvent: e => { if (!EVENTS.some(x => x.id === e.id)) EVENTS.push(e); },   // fichas de conteudo/ (tipo evento)
    mult, powK, evMult, tick, open, openList, event: () => ev,
    levels: lv, info, up, owned, playing: () => (api && api.playing ? api.playing() : null), MILES, classic: false,
    recompute() { api.recompute(); api.save(); refresh(); },
  };
})();
