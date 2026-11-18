/* Kome no Japão — amuletos.js
   AMULETOS (omamori): passo 2 de docs/design/jogo-infinito.md. Cada ilha (a partir da 1ª viagem; a campanha de Honshu fica
   como está) é uma partida com BUILD: 1 escolha de 1 entre 3 amuletos na chegada e mais 1 em cada marco (1ª máquina a motor,
   Escavadeira, Bagger, casa pronta/Pátio) = até 5 por ilha. Valem só naquela ilha: a viagem zera (detectado pela troca de
   S.stats.islandsDone, sem mexer no islands.js). Rerrolar as 3 custa Sementes 1, 2, 4, 8… (zera por ilha).
   Conjuntos: 3 da mesma etiqueta (mao, motor, sorte, fabrica, equipe) acendem um bônus com nome (D.AMULETO.sets).
   Lendários só entram no baralho depois da conquista (G.Goals, campo desbloqueio da ficha).
   FAIXAS (game/faixas.js) mexem aqui: menos amuletos por ilha (amMax), menos cartas (amOffer), sem o da chegada (semChegada) e
   fichas com faixa: n só entram no baralho depois de jogar aquela faixa.

   FICHAS: conteudo/amuleto-<id>.js (tipo 'amuleto', ver tools/content.js) → D.AMULETOS. fx: {kind, values}; as chaves de
   values são os GANCHOS abaixo (kind é só o rótulo do tipo de efeito: mult | regra | vivo).
     na renda (computeStats → applyStats):  dig sell sack hm hv val spd reach powMul critMult (×) · help crit (+)
        mao / motor (× renda só com ferramenta de mão / a motor) · motorDig (× velocidade a motor) · maoPow (× força na mão)
        furia stomp autosack slide oni (liga a regra da árvore mesmo sem o nó)
     ganchos G.Amuletos.mult(k):  preco comboGain comboDecay sackRate fab offline   ·   val(k) (maior):  sackFloor offCap (h)
     crédito G.Amuletos.credit(kind):  kome (0 = você cavando) · frota (1 = ajudantes, frota, Pátio) · premio (2 = sacos, onigiri)
     vivos (contas aqui): porMaquina (+x renda por máquina no pátio) · porFerramenta (+x ajudante por ferramenta comprada
        na ilha) · porAmuleto (+x por amuleto na build) · conjunto2 (conjunto acende com 2) · regrow (bolsões voltam a crescer)
        noite/dia (× de noite / de dia) · rush/rushSec/fora (× depois de comprar ferramenta / fora disso)
        estimacao/estimacaoMax (+x por minuto na mesma ferramenta) · maratona/maratonaX (combo cheio por x s → ×)
   Estado (save): S.stats.am = {trip, cur:[ids], got, rr, offer:[ids]|null, disc:{id:1}, t0, rg}. Migração: MIGR[6] no game.js.
   MODO ACELERADO (FAST: testes, longo.js): nunca espera a tela; escolhe na hora pelo guloso best() (sim.drain() lista as
   escolhas pro longo.js). Tela, fila no HUD e Caderno: game/amuletos-ui.js (G.AmuletosUI). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.U) return;
  const U = E.U, D = G.Data;

  // números (mover pro data.js junto do resto do balanço quando o item 6 assentar)
  const CFG = D.AMULETO = Object.assign({
    max: 5, offer: 3, reroll: 1, peso: { comum: 60, raro: 28, lendario: 12 }, wait: 4,
    regrowEvery: 30, regrowFrac: 0.18, regrowCap: 0.03,
    sets: {
      mao: { n: 'Trio da Pata', d: 'ferramentas de mão rendem ×1,5 e o combo enche 2× mais rápido', values: { mao: 1.5, comboGain: 2 } },
      motor: { n: 'Ronco de Motor', d: 'máquinas a motor rendem ×1,5 e cavam 20% mais rápido', values: { motor: 1.5, motorDig: 1.2 } },
      sorte: { n: 'Trio da Sorte', d: 'todo saco é pelo menos dourado', values: { sackFloor: 2 } },
      fabrica: { n: 'Selo de Exportação', d: 'fábrica vende ×2 e todo arroz vale +15%', values: { fab: 2, val: 1.15 } },
      equipe: { n: 'Turma Completa', d: '+2 shibas ajudantes e a frota rende ×1,5', values: { help: 2, frota: 1.5 } },
    },
  }, D.AMULETO || {});
  const TAGS = { mao: { n: 'mão', c: '#E58A3A' }, motor: { n: 'motor', c: '#5C7FB8' }, sorte: { n: 'sorte', c: '#4FA36A' }, fabrica: { n: 'fábrica', c: '#B8564A' }, equipe: { n: 'equipe', c: '#8E6FB3' } };
  const RAR = { comum: { n: 'comum', c: '#B88A52' }, raro: { n: 'raro', c: '#3E86D6' }, lendario: { n: 'lendário', c: '#F0B429' } };
  const MARCOS = [
    { id: 'chegada', n: 'chegada na ilha', ok: () => !FX('semChegada') },   // faixa "Chegada sem presente" (faixas.js)
    { id: 'motor', n: '1ª máquina a motor', ok: () => S().tool >= ti('trator') },
    { id: 'escav', n: 'Escavadeira', ok: () => S().tool >= ti('escav') },
    { id: 'bagger', n: 'Bagger', ok: () => S().tool >= ti('bagger') },
    { id: 'patio', n: 'casa pronta', ok: () => !!S().ended },
  ];
  const ADD = { help: 1, crit: 1, porMaquina: 1, porFerramenta: 1, porAmuleto: 1 };
  const MAX = { furia: 1, stomp: 1, autosack: 1, slide: 1, oni: 1, sackFloor: 1, offCap: 1, regrow: 1, conjunto2: 1, rushSec: 1, estimacao: 1, estimacaoMax: 1, maratona: 1, maratonaX: 1 };
  const MULS = ['dig', 'sell', 'sack', 'hm', 'hv', 'val', 'spd', 'reach', 'powMul', 'critMult'];
  const FLAGS = ['furia', 'stomp', 'autosack', 'slide', 'oni'];

  let api = null, waitT = CFG.wait, cache = null, log = [];
  const dyn = { tool: '', est: 0, rushT: 0, lastTool: -1, fullT: 0, rgT: 0 };
  const S = () => G.S;
  const ti = id => (D.toolIndex && D.toolIndex[id] !== undefined ? D.toolIndex[id] : 99);
  const list = () => D.AMULETOS || [];
  let idMap = null, idN = -1;
  const byId = id => { if (idN !== list().length) { idMap = {}; for (const a of list()) idMap[a.id] = a; idN = list().length; } return idMap[id] || null; };
  // A/B de balanço: localStorage 'kome-sem-amuleto' = '1' desliga tudo (tools/longo.js --sem-amuleto)
  const OFF = (() => { try { return localStorage.getItem('kome-sem-amuleto') === '1'; } catch (e) { return false; } })();
  const run = () => !OFF && !!(G.Islands && G.Islands.islandRun && G.Islands.islandRun());
  const fast = () => !!(api && api.fast && api.fast());
  // faixas (game/faixas.js): regras que mexem nos amuletos — menos amuletos por ilha, menos cartas, sem o da chegada
  const FX = k => (G.Faixas ? G.Faixas.val(k) : 0);
  const maxN = () => Math.max(1, CFG.max - FX('amMax'));
  const offerN = () => Math.max(1, CFG.offer - FX('amOffer'));

  function fresh() { return { trip: 0, cur: [], got: 0, rr: 0, offer: null, disc: {}, t0: 0, rg: 0 }; }
  function norm(a) {
    if (!Array.isArray(a.cur)) a.cur = []; a.cur = a.cur.filter(id => typeof id === 'string');
    if (a.offer && !Array.isArray(a.offer)) a.offer = null;
    if (!a.disc || typeof a.disc !== 'object') a.disc = {};
    a.got = a.got | 0; a.rr = a.rr | 0; a.trip = a.trip | 0; a.t0 = a.t0 | 0; a.rg = +a.rg || 0;
    return a;
  }
  // estado da ilha atual; viagem nova (islandsDone mudou) = build zerada (o descoberto fica)
  function st() {
    const s = S().stats; let a = s.am;
    if (!a || typeof a !== 'object') a = s.am = fresh();
    if (!a.__ok) { norm(a); Object.defineProperty(a, '__ok', { value: 1, enumerable: false }); }
    const trip = s.islandsDone | 0;
    if (a.trip !== trip) { a.trip = trip; a.cur = []; a.got = 0; a.rr = 0; a.offer = null; a.t0 = S().tool | 0; a.rg = 0; cache = null; }
    return a;
  }
  const cur = () => (run() ? st().cur.map(byId).filter(Boolean) : []);

  /* ---- conjuntos e soma dos efeitos ---- */
  function tagCount(ids) { const n = {}; for (const id of ids) { const x = byId(id); if (x) for (const t of x.tags) n[t] = (n[t] | 0) + 1; } return n; }
  function need() { return st().cur.some(id => { const x = byId(id); return x && x.fx && x.fx.values && x.fx.values.conjunto2; }) ? 2 : 3; }
  function lit() { const n = tagCount(run() ? st().cur : []), k = need(), out = []; for (const t in CFG.sets) if ((n[t] | 0) >= k) out.push(t); return out; }
  function merge(o, vals) {
    for (const k in vals) {
      const v = +vals[k]; if (!isFinite(v)) continue;
      if (ADD[k]) o[k] = (o[k] || 0) + v; else if (MAX[k]) o[k] = Math.max(o[k] || 0, v); else o[k] = (o[k] === undefined ? 1 : o[k]) * v;
    }
  }
  function agg() {
    const a = st(), key = run() + '|' + a.trip + '|' + a.cur.join(',');
    if (cache && cache.key === key) return cache.v;
    const o = {};
    if (run()) { for (const x of cur()) merge(o, (x.fx && x.fx.values) || {}); for (const t of lit()) merge(o, CFG.sets[t].values); }
    cache = { key, v: o }; return o;
  }
  const has = k => agg()[k] !== undefined;
  function mult(k) { const v = agg()[k]; return v === undefined ? 1 : v; }
  function val(k, d) { const v = agg()[k]; return v === undefined ? (d || 0) : v; }

  // computeStats: tudo que mexe nos números da renda passa aqui (uma linha no game.js)
  function applyStats(s, tool) {
    if (!run()) return;
    const o = agg(), paw = tool && tool.seat === 'paw', cab = tool && tool.seat === 'cab';
    for (const k of MULS) if (o[k] !== undefined) s[k] *= o[k];
    if (o.mao !== undefined && paw) s.sell *= o.mao;
    if (o.motor !== undefined && cab) s.sell *= o.motor;
    if (o.motorDig !== undefined && cab) s.dig *= o.motorDig;
    if (o.maoPow !== undefined && paw) s.powMul *= o.maoPow;
    if (o.help) s.help += o.help;
    if (o.crit) s.crit += o.crit;
    for (const f of FLAGS) if (o[f]) s[f] = Math.max(+s[f] || 0, o[f]);
    if (o.porMaquina) s.sell *= 1 + o.porMaquina * (S().tool | 0);
    if (o.porFerramenta) s.help += Math.floor(o.porFerramenta * Math.max(0, (S().tool | 0) - st().t0));
    if (o.porAmuleto) s.sell *= 1 + o.porAmuleto * st().cur.length;
  }
  // crédito de cada pagamento (kind 0 você, 1 frota/ajudantes/Pátio, 2 prêmio): estáticos + os vivos (noite, rush, estimação, maratona)
  function credit(kind) {
    if (!run()) return 1;
    const o = agg(); let m = 1;
    if (kind === 0 && o.kome !== undefined) m *= o.kome;
    if (kind === 1 && o.frota !== undefined) m *= o.frota;
    if (kind === 2 && o.premio !== undefined) m *= o.premio;
    if (kind !== 2) {
      if (o.noite !== undefined || o.dia !== undefined) { const n = night(); m *= (o.dia || 1) * (1 - n) + (o.noite || 1) * n; }
      if (o.rush !== undefined) m *= dyn.rushT > 0 ? o.rush : (o.fora || 1);
    }
    if (kind === 0) {
      if (o.estimacao) m *= Math.min(o.estimacaoMax || 2, 1 + o.estimacao * dyn.est / 60);
      if (o.maratona && dyn.fullT >= o.maratona) m *= o.maratonaX || 2;
    }
    return m;
  }
  function night() { const s = S(); if (E.Nature && E.Nature.light && s.tod !== undefined) { try { return E.Nature.light(s.tod).night || 0; } catch (e) { /* */ } } return 0; }

  /* ---- baralho ---- */
  const unlocked = x => (!x.unlock || !!((S().stats.ach || {})[x.unlock])) && (!x.faixa || (G.Faixas ? G.Faixas.best() : 0) >= x.faixa);
  function pool(skip) { const a = st(); return list().filter(x => a.cur.indexOf(x.id) < 0 && unlocked(x) && (!skip || skip.indexOf(x.id) < 0)); }
  function draw(n, skip) {
    let P = pool(skip); if (P.length < n) P = pool();
    const out = [];
    while (out.length < n && P.length) {
      let tot = 0; for (const x of P) tot += CFG.peso[x.rar] || 10;
      let r = Math.random() * tot, i = 0;
      for (; i < P.length - 1; i++) { r -= CFG.peso[P[i].rar] || 10; if (r < 0) break; }
      out.push(P[i].id); P.splice(i, 1);
    }
    // carta do dia: "amuleto raro garantido" (ficha guardada) = se não veio raro/lendário, troca a última carta por um raro
    if (out.length && G.Carta && G.Carta.tok('raro') && run() && !fast()) {
      const rare = P.filter(x => x.rar === 'raro' || x.rar === 'lendario');
      if (!out.some(id => { const x = byId(id); return x && x.rar !== 'comum'; }) && rare.length) out[out.length - 1] = rare[(Math.random() * rare.length) | 0].id;
      G.Carta.use('raro');
    }
    return out;
  }
  const earned = () => (run() ? Math.min(maxN(), MARCOS.filter(m => m.ok()).length) : 0);
  const pending = () => run() && st().got < earned();
  const nextMarco = () => { const k = st().got; const m = MARCOS.filter(x => x.ok())[k]; return m || MARCOS[Math.min(k, MARCOS.length - 1)]; };
  function offer() { const a = st(); if (!pending()) return null; if (!a.offer || !a.offer.length) a.offer = draw(offerN()); return a.offer.map(byId).filter(Boolean); }
  const rerollCost = () => (G.Carta && G.Carta.tok('rr') ? 0 : CFG.reroll * Math.pow(2, st().rr));   // carta do dia: rerrolar grátis guardado
  function reroll() {
    const a = st(), c = rerollCost(), s = S().stats;
    if (!pending() || Math.floor(s.seeds || 0) < c) return false;
    if (c === 0 && G.Carta) G.Carta.use('rr'); else { s.seeds -= c; a.rr++; }
    a.offer = draw(offerN(), a.offer || []);
    if (api && api.save && !fast()) api.save();
    return true;
  }
  function pick(id, quiet) {
    const a = st(), x = byId(id);
    if (!x || !pending() || a.cur.indexOf(id) >= 0) return false;
    const was = lit();
    a.cur.push(id); a.got++; a.offer = null; a.disc[id] = 1; cache = null; waitT = CFG.wait; S().stats.amPick = (S().stats.amPick | 0) + 1;   // amPick: escada.js
    const now = lit(), fresh2 = now.filter(t => was.indexOf(t) < 0);
    log.push(x.n);
    if (api && api.recompute) api.recompute();
    if (!quiet && api && api.save) api.save();
    return { amuleto: x, sets: fresh2.map(t => Object.assign({ id: t }, CFG.sets[t])) };
  }
  // jogador guloso (modo acelerado e longo.js): nota da ficha (ai) × fase + bônus por fechar conjunto
  function score(x) {
    const s = S(), n = tagCount(st().cur), k = need();
    let v = x.ai || 1;
    const motorNow = s.tool >= ti('trator');
    if (x.tags.length === 1 && x.tags[0] === 'mao' && motorNow) v *= 0.35;
    if (x.tags.indexOf('motor') >= 0 && !motorNow && x.tags.indexOf('mao') < 0) v *= 0.8;
    if (x.tags.indexOf('fabrica') >= 0 && !(G.Fab && G.Fab.on && G.Fab.on())) v *= 0.7;
    for (const t of x.tags) if ((n[t] | 0) + 1 === k) v += 2;
    return v;
  }
  function best(cards) { let b = null, bv = -1; for (const x of cards) { const v = score(x); if (v > bv) { bv = v; b = x; } } return b; }

  /* ---- tick (E.Sim: roda inclusive no modo acelerado) ---- */
  function tick(dt) {
    if (!S() || !run()) return;
    const a = st(), o = agg(), s = S();
    // vivos
    if (o.estimacao) { const t = api && api.playing ? api.playing() : null, id = t ? t.id : ''; if (id === dyn.tool) dyn.est += dt; else { dyn.tool = id; dyn.est = 0; } }
    if (dyn.lastTool < 0) dyn.lastTool = s.tool; if (s.tool > dyn.lastTool) { dyn.lastTool = s.tool; dyn.rushT = o.rushSec || 60; } if (dyn.rushT > 0) dyn.rushT -= dt;
    if (o.maratona) dyn.fullT = s.combo >= D.COMBO.max - 0.01 ? dyn.fullT + dt : 0;
    if (o.regrow && (dyn.rgT += dt) >= CFG.regrowEvery) { dyn.rgT = 0; regrow(a); }
    // escolha pendente
    if (!pending()) return;
    if (!a.offer || !a.offer.length) a.offer = draw(offerN());
    if (fast()) { const o = offer(), b = G.Amuletos.sim.acaso && o && o.length ? o[Math.random() * o.length | 0] : best(o); if (b) pick(b.id, true); return; }   // sim.acaso: jogador casual do tools/longo.js (escolhe no escuro)
    const UIx = G.AmuletosUI;
    if (!UIx || UIx.isOpen() || UIx.later || (api && api.busy && api.busy()) || (G.Faixas && G.Faixas.isOpen())) { if (!UIx || !UIx.isOpen()) waitT = Math.max(waitT, 1.5); return; }
    if ((waitT -= dt) > 0) return;
    waitT = CFG.wait; UIx.open();
  }
  // Núcleo Vivo: um bolsão já cavado ganha arroz de volta (o arroz novo cai dentro do bolsão e sai dourado)
  function regrow(a) {
    const heap = api && api.heap ? api.heap() : null, s = S(); if (!heap || !heap.pockets || !s.heapTotal) return;
    if (a.rg >= s.heapTotal * CFG.regrowCap) return;
    const L = heap.pockets.filter(p => p.found && heap.height(p.x) < p.y + p.r * 0.6);
    if (!L.length) return;
    const p = L[(Math.random() * L.length) | 0], area = Math.PI * p.r * p.r * CFG.regrowFrac;
    heap.add(p.x, area, Math.max(30, p.r)); a.rg += area;
    if (!fast() && E.UI && E.UI.toast && api && api.ui) api.ui(() => E.UI.toast('Núcleo Vivo', { icon: 'chest', tone: 'gold', sub: 'um bolsão dourado voltou a crescer' }));
  }

  G.Amuletos = {
    init(a) { api = a || {}; if (G.Sim) G.Sim.add('amuletos', { tick }); if (S()) st(); },
    applyStats, credit, mult, val, has, tick,
    // tela (amuletos-ui.js) lê daqui
    run, list, byId, current: cur, offer, reroll, rerollCost, pick, pending, earned, nextMarco, lit, need, tagCount,
    seeds: () => Math.floor((S() && S().stats.seeds) || 0), discovered: () => Object.assign({}, st().disc), unlocked,
    max: maxN, sets: CFG.sets, TAGS, RAR, MARCOS, fast,
    dyn: () => ({ rush: dyn.rushT, est: dyn.est, full: dyn.fullT, night: night() }),
    sim: { acaso: false, best, score, drain: () => { const l = log; log = []; return l; }, auto() { const o = offer(); const b = o && best(o); return b ? pick(b.id, true) : null; } },
  };
})();
