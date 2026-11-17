/* Kome no Japão — patio.js  (camada Cookie, passo 1: o SISTEMA; spec docs/design/camada-cookie.md, APROVADA)
   PÁTIO DA FROTA: depois do final de cada ilha, cada uma das 14 máquinas vira uma "turma" que dá pra comprar VÁRIAS vezes.
   - preço = custo × R0 × grow^n (R0 = renda do final da ilha, gravada quando o Pátio abre); rende r × R0 × 2^marcos por unidade;
   - marcos ×2 quando a turma chega em D.PATIO.at (comprados, preço custo × R0 × mk[i]);
   - renda entra a cada segundo pelo crédito de automação do jogo (api.credit, pop pequeno cinza);
   - zera na viagem (islands.js · makeSave: stats.patio = {}), é o prestígio;
   - offline: D.PATIO.off da renda, até offMax; carta na volta.
   Visual: provisório (chip + painel de lista). A arte dos patamares é do designer (game/patio-arte.js, G.PatioArt).
   Estado: S.stats.patio = { on, R0, n: {id: qtd}, m: {id: marcos comprados} }. API de teste/simulador: G.Patio.sim. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data, P = D.PATIO;
  let api = null, chip = null, panel = null, mode = 1, accT = 0, refT = 0;
  const S = () => G.S;
  const st = () => { const s = S().stats; return s.patio || (s.patio = {}); };
  const on = () => !!(S() && st().on);
  const cnt = id => (st().n && st().n[id]) | 0;
  const mks = id => (st().m && st().m[id]) | 0;
  const byId = {}; P.turmas.forEach(t => { byId[t.id] = t; });
  const R0 = () => st().R0 || 10;
  const sl = id => ((S().stats.sl || {})[id] | 0);   // nível de semente (islands.js · D.SEEDS)
  const unitCost = (t, n) => t.c * R0() * Math.pow(0.99, sl('desc_frota')) * Math.pow(P.grow, n);
  function costN(id, k) {   // custo de comprar k unidades a partir da quantidade atual
    const t = byId[id], n = cnt(id), g = P.grow;
    return t.c * R0() * Math.pow(0.99, sl('desc_frota')) * Math.pow(g, n) * (Math.pow(g, k) - 1) / (g - 1);
  }
  function maxK(id) {   // quantas dá pra comprar agora
    const t = byId[id], n = cnt(id), g = P.grow, m = S().money, c0 = t.c * R0() * Math.pow(0.99, sl('desc_frota')) * Math.pow(g, n);
    if (m < c0) return 0;
    return Math.max(1, Math.floor(Math.log(m * (g - 1) / c0 + 1) / Math.log(g)));
  }
  /* ---- PASSO 2: tabelas da planilha (conteudo/cookie*.csv -> game/cookie-data.js, G.Data.COOKIE) ----
     marcos com nome (efeito mult_maquina), sinergias (a+b, as duas >= alvo: b ganha +v por unidade de a), Tigelas do
     Coração (cada conquista vale +v a mais), conquistas (+1% cada no Arroz do Coração; FICAM entre viagens). */
  const CK = D.COOKIE || { up: [], ach: [], ev: [], nomes: [] };
  if (CK.nomes && CK.nomes.length && U.addUnits) U.addUnits(CK.nomes);   // arrozilhão, onigirilhão…
  const UPM = {}; CK.up.filter(u => u.ef === 'mult_maquina').forEach(u => { UPM[u.maq + '@' + u.alvo] = u; });
  const SYN = CK.up.filter(u => u.ef === 'sinergia'), TIG = CK.up.filter(u => u.ef === 'coracao');
  const H0 = () => { const s = S().stats; return s.heart || (s.heart = { ach: {}, tig: {} }); };   // fica entre viagens
  const synOn = id => !!(st().syn && st().syn[id]);
  const synOpen = u => { const [a, b] = u.maq.split('+'); return !synOn(u.id) && cnt(a) >= u.alvo && cnt(b) >= u.alvo; };
  const synCost = u => { const [a, b] = u.maq.split('+'), big = Math.max(byId[a].c, byId[b].c); return (u.preco || 30) * big * R0(); };
  function buySyn(u) { const c = synCost(u); if (!synOpen(u) || S().money < c) return false; S().money -= c; (st().syn || (st().syn = {}))[u.id] = 1; st().lastNew = S().time; if (api && api.sfx) api.sfx('fanfare'); return true; }
  const synMult = id => { let m = 1; for (const u of SYN) if (synOn(u.id)) { const [a, b] = u.maq.split('+'); if (b === id) m *= 1 + (u.v || 0) * cnt(a); } return m; };
  const achN = () => Object.keys(H0().ach).length;
  const tigOpen = u => !H0().tig[u.id] && achN() >= u.alvo;
  const tigCost = u => (u.preco || 600) * R0();
  function buyTig(u) { const c = tigCost(u); if (!tigOpen(u) || S().money < c) return false; S().money -= c; H0().tig[u.id] = 1; if (api && api.recompute) api.recompute(); return true; }
  const perAch = () => 0.01 + 0.001 * sl('pote') + TIG.reduce((s, u) => s + (H0().tig[u.id] ? (u.v || 0) : 0), 0);
  const heart = () => 1 + achN() * perAch();
  function achOk(a) {
    const s = S(), n = a.maq === 'todas' ? Math.min(...P.turmas.map(t => cnt(t.id))) : cnt(a.maq);
    if (a.cond === 'qtd') return n >= a.alvo;
    if (a.cond === 'ganho') return (s.stats.earnedAll || 0) + (s.earned || 0) >= a.alvo;
    if (a.cond === 'eventos') return (s.stats.goldEv | 0) >= a.alvo;
    if (a.cond === 'segredo') return !!(s.stats.secret && s.stats.secret[a.alvo]);
    return false;
  }
  function achTick() {
    let got = 0;
    for (const a of CK.ach) if (!H0().ach[a.id] && achOk(a)) { H0().ach[a.id] = 1; got++; st().lastNew = S().time; if (api && api.ach) api.ach(a); }
    if (got && api && api.recompute) api.recompute();
  }
  const marcoMult = id => { const k = mks(id), t = sl('marco_turbo') ? Math.min(k, 2) : 0; return Math.pow(3, t) * Math.pow(2, k - t); };
  const totalN = () => P.turmas.reduce((s, t) => s + cnt(t.id), 0);
  const sind = () => 1 + 0.005 * sl('sindicato') * Math.floor(totalN() / 10);
  const rateOf = id => cnt(id) * byId[id].r * R0() * marcoMult(id) * synMult(id) * heart() * sind();
  const rate = () => P.turmas.reduce((s, t) => s + rateOf(t.id), 0);
  const nextMarco = id => { const i = mks(id); return i < P.at.length && cnt(id) >= P.at[i] ? i : -1; };
  const marcoRow = id => UPM[id + '@' + P.at[mks(id)]] || null;
  const marcoCost = id => { const u = marcoRow(id); return byId[id].c * R0() * (u && u.preco ? u.preco : P.mk[mks(id)]); };

  function unlock() {
    if (on() || !S().ended) return;
    const s = S(), p = st();
    p.on = 1; p.R0 = Math.max(10, s.stats.topIps || s.ips || 10); p.n = {}; p.m = {}; p.lastNew = s.time; p.t0 = s.time;
    if (sl('garagem')) for (const id of ['pata', 'hashi', 'tigela', 'pa', 'duaspas', 'carrinho', 'britadeira']) p.n[id] = 5;
    if (api && api.banner) api.banner();
  }
  function buy(id, k) {
    if (!on() || !byId[id]) return 0;
    const want = k === 'max' ? maxK(id) : k | 0; if (want <= 0) return 0;
    const c = costN(id, want); if (S().money < c) return 0;
    if (!cnt(id)) st().lastNew = S().time;
    S().money -= c; const p = st(); p.n[id] = cnt(id) + want;
    if (id === 'hashi' && cnt('bagger') >= 100) (S().stats.secret || (S().stats.secret = {})).hashi_com_100_bagger = 1;
    if (api && api.sfx) api.sfx('pling');
    if (G.priceBump) G.priceBump();
    return want;
  }
  function buyMarco(id) {
    const i = nextMarco(id); if (i < 0) return false;
    const c = marcoCost(id); if (S().money < c) return false;
    S().money -= c; st().m[id] = mks(id) + 1; st().lastNew = S().time;
    if (api && api.sfx) api.sfx('fanfare');
    return true;
  }

  /* ---- tempo: renda a cada segundo; chip; painel ---- */
  function tick(dt) {
    if (!api || !S()) return;
    if (!on()) { unlock(); chipTick(); return; }
    accT += dt;
    if (accT >= 1) { const v = rate() * accT; accT = 0; if (v > 0 && api.credit) api.credit(v); }
    if ((refT -= dt) <= 0) { refT = 0.5; achTick(); chipTick(); if (panel && panel.isOpen && !panel.book) fill(); }
  }
  // HORA DE PARTIR: Sementes do Pátio já valem as da ilha e nada novo há D.PATIO.plateau s (o platô convida a viajar ou parar)
  let goChip = null;
  function partirTick() {
    if (!G.HUD || !G.HUD.chip || !G.Islands || !G.Islands.seedsPatio) return;
    if (!goChip) { goChip = G.HUD.chip({ id: 'partir', icon: 'boat', label: 'Hora de partir', order: 3, tone: '#BFE6FF', show: false, onClick: () => { if (G.IslandsUI) G.IslandsUI.open(); } }); if (!goChip) return; }
    const sp = G.Islands.seedsPatio(), sb = G.Islands.seedsBase(), quiet = S().time - (st().lastNew || 0) > (P.plateau || 240) && S().time - (st().t0 || 0) > (P.minRun || 1800);
    const on = on_() && sp >= sb && sb > 0 && quiet;
    goChip.set({ show: on, hint: on ? '+' + (sb + sp) + ' sementes' : '', prio: on ? 6 : 0 });
  }
  const on_ = () => on();
  let fable = false;
  function chipTick() {
    if (fable) return;   // tela do Fable (cookie-ui.js) tem os próprios chips
    partirTick();
    if (!G.HUD || !G.HUD.chip) return;
    if (!chip) { chip = G.HUD.chip({ id: 'patio', icon: 'star', label: 'Pátio', order: 25, tone: '#FFF0C8', show: false, onClick: () => open() }); if (!chip) return; }
    if (!on()) { chip.set({ show: false }); return; }
    // dica: a compra mais barata, se der
    let best = null; for (const t of P.turmas) { const c = unitCost(t, cnt(t.id)); if (!best || c < best[0]) best = [c, t]; }
    const can = best && S().money >= best[0];
    chip.set({ show: true, label: 'Pátio', hint: can ? best[1].n + ' · comprar!' : '', prio: can ? 2 : 0 });
  }
  function open() {
    if (fable && G.CookieUI.openPatio) { G.CookieUI.openPatio(); return; }
    if (!on() || !UI) return;
    if (!panel) panel = UI.panel({ title: 'Pátio da Frota', icon: 'star', side: 'right', dim: false });
    panel.open(); fill();
  }
  function fill() {
    panel.book = false;
    const body = panel.body; body.innerHTML = '';
    const top = UI.el('div', 'k-row', body); top.style.cssText = 'display:flex;gap:6px;padding:4px 0 8px';
    [['×1', 1], ['×10', 10], ['×máx', 'max']].forEach(([l, k]) => { const b = UI.button(top, { title: l, size: 'sm', tone: mode === k ? 'gold' : undefined, onClick: () => { mode = k; fill(); } }); (b.el || b).style.flex = '1'; });
    const info = UI.el('div', '', body); info.style.cssText = 'font-size:13px;padding:0 4px 6px;opacity:.85';
    const gi = G.Islands && G.Islands.seedsPatio ? ' · viajar agora: +' + (G.Islands.seedsBase() + G.Islands.seedsPatio()) + ' sementes (' + G.Islands.seedsPatio() + ' do Pátio)' : '';
    info.textContent = 'Frota rende ¥' + U.fmt(rate()) + '/s · zera na viagem' + gi + ' · Coração: ' + achN() + ' conquistas (+' + Math.round((heart() - 1) * 100) + '%)';
    const extra = (title, sub, cost, fn) => { const b = UI.button(body, { title, sub: sub + ' · ¥' + U.fmt(cost), size: 'sm', tone: 'gold', onClick: () => { fn(); fill(); } }); const el = b.el || b; el.style.width = '100%'; if (S().money < cost) el.style.opacity = '0.55'; };
    if (G.Events) { const bk = UI.button(body, { title: 'Livro dos Eventos', sub: 'o que já apareceu e a chance de cada um', size: 'sm', onClick: () => { panel.book = true; body.innerHTML = ''; const back = UI.button(body, { title: '← voltar pro Pátio', size: 'sm', onClick: () => fill() }); (back.el || back).style.width = '100%'; G.Events.fillBook(body); } }); (bk.el || bk).style.width = '100%'; }
    for (const u of SYN) if (synOpen(u)) extra('⇄ ' + u.n, u.d, synCost(u), () => buySyn(u));
    for (const u of TIG) if (tigOpen(u)) extra('♥ ' + u.n, u.d, tigCost(u), () => buyTig(u));
    for (const t of P.turmas) {
      const n = cnt(t.id), k = mode === 'max' ? Math.max(1, maxK(t.id)) : mode, c = costN(t.id, k), can = S().money >= c;
      const b = UI.button(body, { title: t.n + ' ×' + n, sub: '¥' + U.fmt(c) + (k > 1 ? ' (' + k + ')' : '') + ' · +¥' + U.fmt(t.r * R0() * Math.pow(2, mks(t.id)) * k) + '/s', size: 'sm', onClick: () => { buy(t.id, mode === 'max' ? 'max' : mode); fill(); } });
      const el = b.el || b; el.style.width = '100%'; if (!can) el.style.opacity = '0.55';
      const i = nextMarco(t.id);
      if (i >= 0) { const mc = marcoCost(t.id), mr = marcoRow(t.id), mb = UI.button(body, { title: '★ ' + (mr ? mr.n : 'Marco ' + P.at[i] + ': ' + t.n) + ' (×2)', sub: (mr ? mr.d + ' · ' : t.n + ' ' + P.at[i] + ' · ') + '¥' + U.fmt(mc), size: 'sm', tone: 'gold', onClick: () => { buyMarco(t.id); fill(); } }); const me = mb.el || mb; me.style.width = '100%'; if (S().money < mc) me.style.opacity = '0.55'; }
    }
  }

  // tempo fora (o game.js calcula antes de o Pátio se registrar, então ele faz a conta aqui, como a fábrica)
  function offlineOnce() {
    const aw = S().away; if (!aw || !(aw.sec > 5) || !on()) return;
    const sec = Math.min(aw.sec, P.offMax + 4 * 3600 * sl('cama')), v = rate() * sec * Math.min(1, P.off + 0.1 * sl('cochilo')); if (!(v > 0)) return;
    const capSec = P.offMax + 4 * 3600 * sl('cama');
    if (G.CookieUI) { pendAway = { sec: aw.sec, capSec, capped: aw.sec > capSec, rows: [{ icon: 'yen', label: 'A frota cavou', value: v }], total: v }; return; }
    S().money += v; S().earned += v;
    if (api && api.away) api.away(sec, v);
  }
  let pendAway = null;

  /* ---- ADAPTADOR da tela do Fable (game/cookie-ui.js, contrato no topo de lá): a tela só desenha, as contas são daqui ---- */
  function adapter() {
    if (!G.CookieUI || !G.CookieUI.use) return false;
    const I = () => G.Islands, seedById = id => D.SEEDS.find(s => s.id === id);
    const fam = a => (a.cond === 'segredo' ? 'segredo' : a.cond === 'ganho' ? 'riqueza' : a.cond === 'eventos' ? 'eventos' : 'turmas');
    G.CookieUI.use({
      ready: () => on(), money: () => S().money,
      patio: () => P.turmas.map(t => ({ id: t.id, name: t.n, n: cnt(t.id), rate: rateOf(t.id) })),
      total: () => ({ rate: rate(), n: totalN() }),
      price: (id, k) => costN(id, k === 'max' ? Math.max(1, maxK(id)) : k), maxBuy: id => maxK(id),
      buy: (id, k) => buy(id, k === 'max' ? 'max' : k),
      marco: id => { const i = mks(id); if (i >= P.at.length) return null; const r = marcoRow(id);
        return { at: P.at[i], name: r ? r.n : 'Marco ' + P.at[i], desc: r ? r.d : byId[id].n + ' rende o dobro', mult: sl('marco_turbo') && i < 2 ? 3 : 2, price: marcoCost(id), ready: cnt(id) >= P.at[i], prev: i ? { at: P.at[i - 1] } : null }; },
      buyMarco: id => buyMarco(id),
      sinergias: id => SYN.filter(u => u.maq.split('+').indexOf(id) >= 0).map(u => { const [a, b] = u.maq.split('+'), other = a === id ? b : a;
        return { id: u.id, other, otherName: byId[other].n, name: u.n, desc: u.d, mult: 1 + (u.v || 0), state: synOn(u.id) ? 'on' : synOpen(u) ? 'ready' : 'need', need: u.alvo, have: Math.min(cnt(a), cnt(b)), price: synCost(u) }; }),
      buySinergia: sid => { const u = SYN.find(x => x.id === sid); return u ? buySyn(u) : false; },
      coracao: () => { const nx = TIG.find(u => !H0().tig[u.id]); return { n: achN(), total: CK.ach.length, per: perAch(), bonus: achN() * perAch(), next: nx ? { need: nx.alvo, name: nx.n } : null, recent: [] }; },
      conquistas: () => CK.ach.map(a => ({ id: a.id, name: a.n, desc: a.d, fam: fam(a), icon: a.icon, secret: a.cond === 'segredo', got: !!H0().ach[a.id], hint: null })),
      tigelas: () => TIG.map(u => ({ id: u.id, name: u.n, desc: u.d, need: u.alvo, price: tigCost(u), owned: !!H0().tig[u.id], can: tigOpen(u) && S().money >= tigCost(u) })),
      buyTigela: i => (TIG[i] ? buyTig(TIG[i]) : false),
      seeds: () => S().stats.seeds | 0,
      seedTree: () => {
        const BR = { Viagem: { name: 'Viagem', color: '#E3BC62', icon: 'boat' }, 'Pátio': { name: 'Pátio', color: '#7DB34A', icon: 'paw' }, Sorte: { name: 'Sorte', color: '#F3C94A', icon: 'star' }, 'Coração': { name: 'Coração', color: '#E86A7A', icon: 'star' }, 'Poupança': { name: 'Poupança', color: '#6FA8DC', icon: 'yen' } };
        const col = {}; return { branches: BR, nodes: D.SEEDS.map(s => { const b = s.g || 'Viagem', k = Object.keys(BR).indexOf(b), r = (col[b] = (col[b] | 0) + 1) - 1;
          return { id: s.id, n: s.n, desc: s.d, branch: b, pos: { x: (k - 2) * 1.6, y: -1 - r * 1.2 }, req: [], size: 1, icon: BR[b].icon, max: s.max || 0 }; }) };
      },
      seedLevel: id => ((S().stats.sl || {})[id] | 0), seedCost: id => { const s = seedById(id); return s && I() ? I().seedCost(s) : Infinity; },
      buySeed: id => { const s = seedById(id); return !!(s && I() && I().buy(s) !== false); },
      away: () => pendAway, claimAway: () => { if (pendAway) { S().money += pendAway.total; S().earned += pendAway.total; pendAway = null; } },
      partir: () => (I() && I().seedsPatio && on() ? { ok: G.Patio.partir(), patio: I().seedsPatio(), island: I().seedsBase(), later: null, laterMin: 20 } : null),
    });
    return true;
  }

  G.Patio = {
    init(a) { api = a || {}; fable = adapter(); if (S()) { if (S().ended && !on()) unlock(); offlineOnce(); if (fable && pendAway && G.CookieUI.showAway) G.CookieUI.showAway(); } },
    tick, open, rate, on, heart, achN,
    // simulador (tools/longo.js) e testes
    partir: () => { const sp = G.Islands.seedsPatio(), sb = G.Islands.seedsBase(); return on() && sp >= sb && sb > 0 && S().time - (st().lastNew || 0) > (P.plateau || 240) && S().time - (st().t0 || 0) > (P.minRun || 1800); },
    sim: { types: () => P.turmas.map(t => t.id), cost: id => costN(id, 1), count: cnt, buy: id => buy(id, 1) > 0,
      marco: id => (nextMarco(id) >= 0 ? marcoCost(id) : Infinity), buyMarco, unlock: () => { unlock(); return on(); },
      extras: () => SYN.filter(synOpen).map(u => [synCost(u), u.n, () => buySyn(u)]).concat(TIG.filter(tigOpen).map(u => [tigCost(u), u.n, () => buyTig(u)])) },
    get state() { return on() ? { R0: R0(), rate: rate(), n: Object.assign({}, st().n), m: Object.assign({}, st().m) } : null; },
  };
})();
