/* Kome no Japão — modos.js
   RECORDES POR ILHA E POR FAIXA + MODOS DE PARTIDA: passos 5–6 de docs/design/jogo-infinito.md (seções 5 e 6).

   RECORDES (partida normal): cada final de ilha guarda, por ilha E por faixa, o melhor tempo, o maior ¥ e a medalha
   (D.ENDGAME.medal, mesma régua do islands.js). Mostrados no mapa (ficha da ilha) e no cartão do final ("bater o próprio tempo").
   Estado: S.stats.recF = {ilha: {faixa: {t, y, m, n}}}. Os recordes antigos por ilha (S.stats.isl, medalha + sementes) continuam.

   MODOS (aparecem no mapa depois da 1ª volta; nenhum dá prêmio exclusivo nem sementes, só recorde):
     dia       DESAFIO DO DIA — ilha, faixa e 3 amuletos sorteados pela DATA (mesma semente pra todo mundo naquele dia; amuletos
               só do baralho que não depende de conquista). 1 tentativa por dia (começar gasta a do dia); terminar vale recorde.
     pata      SÓ NA PATA — a ilha seguinte sem máquina a motor (só ferramentas seat 'paw'); 20 min de jogo: recorde = ¥ ganho.
     maratona  MARATONA — as 5 ilhas seguidas (Honshu → Mochi) na sua faixa, com a MESMA build: os amuletos escolhidos na 1ª
               ilha seguem nas outras 4 (sem escolhas novas). Recorde = tempo somado (medalha pela soma da régua) e ¥ somado.
   COMO (sem forkar o laço do jogo): um modo é uma ILHA NORMAL com bandeira. Ao começar, o save inteiro da sua partida vira um
   RETRATO guardado dentro do próprio save (d.snap: vai junto no Exportar) e o save passa a ser uma ilha nova feita pelo mesmo
   makeSave das viagens, com S.stats.modo = {id, ...}. Os ganchos são 1 linha cada e só fazem algo com modo ligado:
     islands.js  onEnding → G.Modos.onEnding (recorde do modo, sem sementes/medalha da ilha) · gain() = 0 · buy() bloqueado
                 (as sementes ficam guardadas) · travel() → G.Modos.travel (maratona: próxima ilha; senão volta pra partida)
     game.js     buyTool/HUD: lockTool (Só na Pata) · islandEnd: lista e "depois" do modo · api.rewrite (reescreve o save e recarrega)
     islands-ui  mapInfo (recordes por faixa + quadro dos modos), chipHot
   VOLTAR (restore): o retrato volta inteiro (montanha, frota, árvore, casa, dinheiro, ilha, sementes, faixa) e só o que é
   PERMANENTE vem do modo: roupas, quintal, Cidade, layout da fábrica, conquistas (goals + Cookie), contadores e graus das
   escadas, amuletos/evoluções descobertos, recordes, carta do dia. ¥ e grãos do modo somam nos contadores permanentes.
   Sair no meio = só volta (sem recorde; o Desafio do Dia já gastou a tentativa do dia). Nada é perdido da partida normal.
   Estado permanente dos modos: S.stats.mrec = {dia: {day, t, y, m, isl, fx}, diaTry: 'AAAA-MM-DD', hist: [...], pata: {y, isl, fx},
   mara: {t, y, m}}.
   MODO ACELERADO (FAST): nenhum cartão espera (o final do modo no FAST só deixa a ilha terminada; o cartão do Só na Pata não abre). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.U) return;
  const U = E.U, D = G.Data, EG = D.ENDGAME;
  const CFG = D.MODOS = Object.assign({ pataSec: 1200, maraN: 5 }, D.MODOS || {});
  const S = () => G.S;
  let api = null, pataCard = false, chip = null;

  const ms = () => (S() && S().stats.modo && S().stats.modo.id ? S().stats.modo : null);
  const on = () => !!ms();
  const mrec = () => { const s = S().stats; return s.mrec && typeof s.mrec === 'object' ? s.mrec : (s.mrec = {}); };
  const recF = () => { const s = S().stats; return s.recF && typeof s.recF === 'object' ? s.recF : (s.recF = {}); };
  const fxNow = () => (G.Faixas ? G.Faixas.level() : S().stats.lap | 0);
  const fxName = n => (G.Faixas ? G.Faixas.name(n) : 'faixa ' + n);
  const MED = ['', 'bronze', 'prata', 'ouro'];
  const pawMax = () => { let m = 0; D.TOOLS.forEach((t, i) => { if (t.seat === 'paw') m = i; }); return m; };
  const NAMES = { dia: 'Desafio do Dia', pata: 'Só na Pata', maratona: 'Maratona' };
  const shortIsl = n => n.replace('Ilha Flutuante de ', 'Ilha de ');

  /* ---- data e sorteio do Desafio do Dia (igual pra todo mundo: só a data entra na semente) ---- */
  const pad = n => (n < 10 ? '0' : '') + n;
  const today = () => (G.Carta ? G.Carta.today() : (() => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); })());
  function rng(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } let a = h >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function daily(day) {
    day = day || today();
    const r = rng('kome-desafio-' + day), isl = (r() * D.ISLANDS.length) | 0, fx = 1 + ((r() * 7) | 0);   // Faixa Branca … Preta
    const pool = (D.AMULETOS || []).filter(a => !a.unlock && (!a.faixa || a.faixa <= fx)).map(a => a.id).sort();
    const am = []; while (am.length < 3 && pool.length) am.push(pool.splice((r() * pool.length) | 0, 1)[0]);
    return { day, isl, fx, am };
  }

  /* ---- recordes da partida normal (islands.js onEnding chama) ---- */
  function record(i, sec, yen) {
    const id = D.ISLANDS[i].id, f = fxNow(), R = recF()[id] || (recF()[id] = {}), r = R[f] || (R[f] = { t: 0, y: 0, m: 0, n: 0 });
    const prev = r.t, m = G.Islands.medalFor(i, sec), newT = !r.t || sec < r.t, newY = yen > (r.y || 0);
    r.n = (r.n | 0) + 1; if (newT) r.t = Math.round(sec); if (newY) r.y = yen; r.m = Math.max(r.m | 0, m);
    return { f, prev, newT, newY, best: r.t, m };
  }
  const recOf = (i, f) => { const R = recF()[D.ISLANDS[i].id]; return R ? R[f === undefined ? fxNow() : f] || null : null; };

  /* ---- montar a partida do modo (dentro do save; game.js api.rewrite grava e recarrega) ---- */
  function build(d, cfg) {
    const snap = JSON.parse(JSON.stringify(d)); delete snap.snap;
    const s0 = d.stats || {}, e0 = s0.earnedAll || 0, g0 = s0.dugAll || 0, isd = s0.islandsDone | 0;
    G.Islands.makeSave(d, cfg.isl, 0);
    const s = d.stats;
    s.earnedAll = e0; s.dugAll = g0; s.islandsDone = isd; s.lap = cfg.fx; s.arrive = 1;   // o makeSave somaria a ilha atual de novo (ela continua no retrato)
    s.fx = Object.assign({}, s.fx || {}, { seen: Math.max((s.fx && s.fx.seen) | 0, cfg.fx) });   // sem cartão de "faixa nova" no modo
    s.am = { trip: isd, cur: (cfg.am || []).slice(), got: cfg.am ? 99 : 0, rr: 0, offer: null, disc: Object.assign({}, (s.am && s.am.disc) || {}), t0: d.tool | 0, rg: 0 };
    if (cfg.am) cfg.am.forEach(id => { s.am.disc[id] = 1; });
    if (cfg.id === 'pata') d.tool = Math.min(d.tool | 0, pawMax());
    s.modo = { id: cfg.id, day: cfg.day || '', isl0: cfg.isl, fx: cfg.fx, k: 0, t: 0, y: 0, e0, g0, build: null };
    d.snap = snap;
    return d;
  }
  function start(id, sure) {
    if (!S() || on() || !api || !api.rewrite) return false;
    const s = S().stats;
    if (!unlocked()) { toast('Os modos abrem depois da 1ª volta ao Japão', 'lock'); return false; }
    let cfg;
    if (id === 'dia') { const dd = daily(); if (mrec().diaTry === dd.day) { toast('Você já jogou o Desafio de hoje', 'clock', 'amanhã tem outro (sem pressa)'); return false; } cfg = { id, isl: dd.isl, fx: dd.fx, am: dd.am, day: dd.day }; }
    else if (id === 'pata') cfg = { id, isl: (S().island + 1) % D.ISLANDS.length, fx: Math.max(1, s.lap | 0) };   // faixa ≥ 1: modo é sempre ilha de viagem (nunca a campanha)
    else cfg = { id: 'maratona', isl: 0, fx: Math.max(1, s.lap | 0) };
    const txt = { dia: 'Ilha ' + shortIsl(D.ISLANDS[cfg.isl].n) + ' na ' + fxName(cfg.fx) + ', com 3 amuletos sorteados pela data. Uma tentativa hoje: terminar vale recorde.',
      pata: shortIsl(D.ISLANDS[cfg.isl].n) + ' sem máquina a motor: ' + Math.round(CFG.pataSec / 60) + ' min de jogo pra fazer o máximo de ¥ só com as patas.',
      maratona: 'As 5 ilhas seguidas na ' + fxName(cfg.fx) + '. Os amuletos que você escolher na 1ª ilha valem nas 5.' }[cfg.id];
    const go = () => { if (cfg.id === 'dia') mrec().diaTry = cfg.day; api.rewrite(d => build(d, cfg)); };
    if (!sure && E.UI && E.UI.confirm && !(api.fast && api.fast())) E.UI.confirm(txt + ' Sua partida fica guardada do jeito que está e volta quando o modo acabar (ou quando você quiser). Sem sementes e sem prêmio: só o recorde.', go, { title: NAMES[cfg.id], yes: 'Começar', no: 'Agora não' });
    else go();
    return true;
  }
  const unlocked = () => { const s = S().stats; return (s.lap | 0) >= 1 || !!s.legend; };
  function toast(t, icon, sub) { if (E.UI && E.UI.toast) E.UI.toast(t, { icon: icon || 'star', sub }); }

  /* ---- voltar pra partida: retrato inteiro + o que é permanente vindo do modo ---- */
  const PERM = ['ach', 'misDone', 'heart', 'sacks', 'bestSack', 'pockets', 'onigiri', 'goldEv', 'secret', 'events', 'evSeen', 'swaps', 'esc', 'amPick', 'recF', 'mrec', 'city', 'carta', 'perfectSecs', 'crowned', 'comboMaxSecs', 'bestCombo'];
  function merge(d) {
    const snap = d.snap, m = d.stats || {}, mo = m.modo || {};
    if (!snap || !snap.stats) { if (d.stats) delete d.stats.modo; delete d.snap; return d; }
    const ss = snap.stats;
    ['closet', 'look', 'home', 'opts'].forEach(k => { if (d[k] !== undefined) snap[k] = d[k]; });
    if (snap.home && snap.island !== undefined && D.ISLANDS[snap.island | 0]) snap.home.theme = D.ISLANDS[snap.island | 0].theme || snap.home.theme;
    PERM.forEach(k => { if (m[k] !== undefined) ss[k] = m[k]; });
    if (m.am && m.am.disc) { ss.am = ss.am || {}; ss.am.disc = Object.assign({}, ss.am.disc || {}, m.am.disc); }
    if (m.evo && m.evo.disc) { ss.evo = ss.evo || { disc: {}, seen: {} }; ss.evo.disc = Object.assign({}, ss.evo.disc || {}, m.evo.disc); }
    if (m.fab) ss.fab = Object.assign({}, m.fab, { slow: (ss.fab && ss.fab.slow) || 0, pb: (ss.fab && ss.fab.pb) || 0 });
    ss.earnedAll = (ss.earnedAll || 0) + Math.max(0, (m.earnedAll || 0) - (mo.e0 || 0)) + (+d.earned || 0);
    ss.dugAll = (ss.dugAll || 0) + Math.max(0, (m.dugAll || 0) - (mo.g0 || 0)) + (+d.dug || 0);
    delete ss.modo;
    for (const k in d) delete d[k];
    Object.assign(d, snap);
    return d;
  }
  function restore() { if (api && api.rewrite) api.rewrite(merge); }
  // maratona: próxima ilha com a mesma build (zero sementes); o retrato vai junto
  function nextIsland() {
    api.rewrite(d => {
      const snap = d.snap, s0 = d.stats, mo = s0.modo, build0 = (s0.am && s0.am.cur) || [], disc = Object.assign({}, (s0.am && s0.am.disc) || {});
      mo.build = mo.build || build0.slice();
      const next = ((d.island | 0) + 1) % D.ISLANDS.length;
      G.Islands.makeSave(d, next, 0);
      const s = d.stats;
      s.lap = mo.fx; s.modo = mo;
      s.am = { trip: s.islandsDone | 0, cur: mo.build.slice(), got: 99, rr: 0, offer: null, disc, t0: d.tool | 0, rg: 0 };
      d.snap = snap;
      return d;
    });
  }

  /* ---- final da ilha num modo (islands.js onEnding desvia pra cá): recorde do modo; o cartão do game.js mostra res.list ---- */
  function onEnding(sec) {
    const mo = ms(), s = S(), i = G.Islands.index(), isl = D.ISLANDS[i], R = mrec();
    const out = { medal: 1, was: 0, bonus: 0, best: Math.round(sec), newBest: false, sec, island: isl, last: false, modo: mo.id, list: [] };
    const L = out.list;
    if (mo.id === 'dia') {
      const m = G.Islands.medalFor(i, sec), old = R.dia && R.dia.day === mo.day ? R.dia : null;
      out.medal = m; out.newBest = !old || sec < old.t;
      R.dia = { day: mo.day, t: Math.round(sec), y: s.earned, m, isl: i, fx: mo.fx };
      R.hist = (R.hist || []).filter(h => h.day !== mo.day).concat([{ day: mo.day, t: Math.round(sec), y: s.earned, m }]).slice(-14);
      L.push({ icon: 'clock', label: 'Desafio de ' + mo.day.split('-').reverse().slice(0, 2).join('/'), value: U.fmtTime(sec) });
      L.push({ icon: 'star', label: 'Medalha', value: MED[m] + ' (' + fxName(mo.fx) + ')' });
      L.push({ icon: 'yen', label: 'Ienes', value: '¥ ' + U.fmt(s.earned) });
      L.push({ icon: 'boat', label: 'Depois', value: 'volta pra sua partida' });
    } else if (mo.id === 'maratona') {
      mo.k = (mo.k | 0) + 1; mo.t = (mo.t || 0) + sec; mo.y = (mo.y || 0) + s.earned;
      if (!mo.build) mo.build = ((s.stats.am && s.stats.am.cur) || []).slice();
      const done = mo.k >= CFG.maraN;
      L.push({ icon: 'clock', label: 'Ilha ' + mo.k + '/' + CFG.maraN, value: U.fmtTime(sec) });
      L.push({ icon: 'clock', label: 'Tempo somado', value: U.fmtTime(mo.t) });
      L.push({ icon: 'yen', label: 'Ienes somados', value: '¥ ' + U.fmt(mo.y) });
      if (done) {
        const sum = k => EG.medal[k].reduce((a, b) => a + b, 0) * 60, m = mo.t <= sum('ouro') ? 3 : mo.t <= sum('prata') ? 2 : 1, old = R.mara;
        out.medal = m; out.newBest = !old || mo.t < old.t; out.sec = mo.t;
        if (out.newBest) R.mara = { t: Math.round(mo.t), y: Math.max(mo.y, (old && old.y) || 0), m: Math.max(m, (old && old.m) || 0), fx: mo.fx };
        else if (mo.y > (old.y || 0)) old.y = mo.y;
        L.push({ icon: 'star', label: 'Maratona completa', value: MED[m] + (out.newBest ? ' · recorde!' : '') });
      } else L.push({ icon: 'boat', label: 'Próxima', value: shortIsl(D.ISLANDS[(i + 1) % D.ISLANDS.length].n) + ' (mesma build)' });
    }
    if (api && api.save) api.save();
    return out;
  }
  // depois do cartão do final: maratona segue; o resto volta pra partida
  function after() {
    const mo = ms(); if (!mo) return;
    if (mo.id === 'maratona' && (mo.k | 0) < CFG.maraN) { nextIsland(); return; }
    restore();
  }
  // botão Partir (mapa, chip, Pátio) dentro de um modo
  function travel() {
    const mo = ms(); if (!mo) return false;
    const s = S();
    if (mo.id === 'maratona' && s.ended && (mo.k | 0) < CFG.maraN) { nextIsland(); return true; }
    const msg = s.ended || pataCard ? 'Voltar pra sua partida? Ela está do jeitinho que você deixou.' : 'Sair do ' + NAMES[mo.id] + ' agora? Sem recorde desta vez' + (mo.id === 'dia' ? ' (o desafio de hoje já foi usado)' : '') + '; sua partida volta do jeitinho que você deixou.';
    if (E.UI && E.UI.confirm) E.UI.confirm(msg, restore, { title: NAMES[mo.id], yes: 'Voltar', no: 'Ficar' }); else restore();
    return true;
  }
  const chipHot = () => { const mo = ms(); if (!mo) return null; return mo.id === 'maratona' && (mo.k | 0) < CFG.maraN ? 'Maratona: próxima ilha' : 'Voltar pra partida'; };
  const lockTool = t => { const mo = ms(); return !!(mo && mo.id === 'pata' && t && t.seat !== 'paw'); };
  const seedMul = () => (on() ? 0 : 1);

  /* ---- Só na Pata: o relógio (20 min de jogo) e o cartão do resultado ---- */
  function tick() {
    const mo = ms(); if (!mo || mo.id !== 'pata' || pataCard) return;
    const s = S(); if (s.time < CFG.pataSec) return;
    const R = mrec(), old = R.pata, nb = !old || s.earned > old.y;
    if (!mo.done) { mo.done = 1; mo.y = s.earned; if (nb) R.pata = { y: s.earned, isl: G.Islands.index(), fx: mo.fx }; if (api && api.save) api.save(); }
    if (api && api.fast && api.fast()) return;   // modo acelerado: só registra (nenhum cartão espera)
    if ((api && api.busy && api.busy()) || (G.Faixas && G.Faixas.isOpen()) || (G.AmuletosUI && G.AmuletosUI.isOpen())) return;
    pataCard = true;
    if (G.Faixas && G.Faixas.card) G.Faixas.card({ kick: 'Só na Pata · tempo!', title: '¥ ' + U.fmt(mo.y) + (nb ? ' · recorde!' : ''),
      lines: [{ t: Math.round(CFG.pataSec / 60) + ' min só com as patas em ' + shortIsl(G.Islands.island().n) + ' (' + fxName(mo.fx) + ').' }, { t: old && !nb ? 'Seu recorde: ¥ ' + U.fmt(old.y) : 'Melhor marca guardada no mapa.', cls: 'k-fx-pay' }],
      btn: 'Voltar pra partida', onClose: restore });
    else restore();
  }

  /* ---- chip do modo (relógio da partida + o recorde a bater) ---- */
  function chipTick() {
    if (!S() || !G.HUD || !G.HUD.ready || !G.HUD.chip) return;
    if (!chip) { chip = G.HUD.chip({ id: 'modo', icon: 'clock', label: 'Modo', order: 2, tone: '#FFE9C4', show: false, onClick: () => { if (G.IslandsUI) G.IslandsUI.open(); } }); if (!chip) return; }
    const mo = ms(); if (!mo) { chip.set({ show: false }); return; }
    const s = S(), R = mrec();
    let label = NAMES[mo.id], tip = '';
    if (mo.id === 'pata') { label = 'Pata ' + U.fmtTime(Math.max(0, CFG.pataSec - s.time)); tip = 'Só na Pata · ¥ ' + U.fmt(s.earned) + (R.pata ? ' · recorde ¥ ' + U.fmt(R.pata.y) : ''); }
    else if (mo.id === 'maratona') { label = 'Maratona ' + ((mo.k | 0) + 1) + '/' + CFG.maraN; tip = 'tempo somado ' + U.fmtTime((mo.t || 0) + (s.ended ? 0 : s.time)) + (R.mara ? ' · recorde ' + U.fmtTime(R.mara.t) : ''); }
    else { label = 'Desafio ' + U.fmtTime(s.time); tip = 'Desafio do Dia · ' + fxName(mo.fx) + ' · ouro ≤ ' + EG.medal.ouro[G.Islands.index()] + ' min'; }
    chip.set({ show: true, label, tip, act: 'Mapa' }); chip.el.title = tip;
  }

  /* ---- mapa: recordes por faixa da ilha escolhida + quadro dos modos ---- */
  function el(tag, cls, par, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (par) par.appendChild(e); return e; }
  const css = document.createElement('style');
  css.textContent = `
.k-md-box{margin-top:8px;padding:8px 10px;border:3px solid #3B2818;border-radius:14px;background:#FFF6DE;display:flex;flex-direction:column;gap:5px}
.k-md-box b{font-size:18px;font-weight:900}
.k-md-box small{display:block;font-size:16px;font-weight:700;color:#5A4430;line-height:1.25}
.k-md-row{display:flex;flex-wrap:wrap;gap:6px}
.k-md-row .k-btn{flex:1 1 140px;min-height:44px;font-size:16px;font-weight:900;padding:4px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
.k-md-row .k-btn small{font-size:13px;font-weight:700;color:#5A4430}
.k-md-row .k-off{opacity:.55}
.k-md-m1{color:#9A6A44}.k-md-m2{color:#7C8894}.k-md-m3{color:#C08A10}
`;
  document.head.appendChild(css);
  function recLines(box, i) {
    const R = recF()[D.ISLANDS[i].id]; if (!R) return;
    const ks = Object.keys(R).map(Number).sort((a, b) => b - a).slice(0, 4);
    for (const f of ks) { const r = R[f], sm = el('small', null, box); sm.textContent = (f ? fxName(f) : 'sem faixa') + ': ' + (r.t ? U.fmtTime(r.t) : '—') + ' · ¥ ' + U.fmt(r.y || 0) + ' · '; const m = el('span', 'k-md-m' + (r.m | 0), sm, MED[r.m | 0] || '—'); m.style.fontWeight = '900'; }
  }
  function mapInfo(side, i) {
    if (!S()) return;
    const s = S(), cur = G.Islands.index(), mo = ms();
    // recordes desta ilha por faixa ("bater o próprio tempo")
    if (recF()[D.ISLANDS[i].id]) {
      const box = el('div', 'k-md-box', side); el('b', null, box, 'Recordes por faixa');
      if (i === cur && !s.ended && !mo) { const r = recOf(i); el('small', null, box, 'agora: ' + U.fmtTime(s.time) + (r && r.t ? ' · seu tempo nesta faixa: ' + U.fmtTime(r.t) : ' · primeira vez nesta faixa')); }
      recLines(box, i);
    }
    // quadro dos modos
    const box = el('div', 'k-md-box', side); el('b', null, box, mo ? NAMES[mo.id] + ' rolando' : 'Modos de partida');
    if (mo) {
      el('small', null, box, mo.id === 'maratona' ? 'ilha ' + ((mo.k | 0) + 1) + '/' + CFG.maraN + ' · tempo somado ' + U.fmtTime((mo.t || 0) + (s.ended ? 0 : s.time)) : mo.id === 'pata' ? 'faltam ' + U.fmtTime(Math.max(0, CFG.pataSec - s.time)) + ' · ¥ ' + U.fmt(s.earned) : 'Desafio de hoje · ' + fxName(mo.fx));
      el('small', null, box, 'Sua partida normal está guardada e volta igualzinha.');
      const row = el('div', 'k-md-row', box), b = el('button', 'k-btn', row); b.innerHTML = '<span>' + (chipHot() || 'Voltar') + '</span>'; b.onclick = () => { if (G.IslandsUI) G.IslandsUI.close(true); travel(); };
      return;
    }
    if (!unlocked()) { el('small', null, box, 'Abrem depois da 1ª volta ao Japão: Desafio do Dia, Só na Pata e Maratona.'); return; }
    const dd = daily(), R = mrec(), usado = R.diaTry === dd.day;
    el('small', null, box, 'Desafio de hoje: ' + shortIsl(D.ISLANDS[dd.isl].n) + ' · ' + fxName(dd.fx) + ' · ' + dd.am.map(id => { const a = (D.AMULETOS || []).find(x => x.id === id); return a ? a.n : id; }).join(', ') + (R.dia && R.dia.day === dd.day ? ' · feito: ' + U.fmtTime(R.dia.t) + ' (' + MED[R.dia.m] + ')' : ''));
    if (R.mara || R.pata) el('small', null, box, (R.mara ? 'Maratona: ' + U.fmtTime(R.mara.t) + ' (' + MED[R.mara.m] + ')' : '') + (R.mara && R.pata ? ' · ' : '') + (R.pata ? 'Só na Pata: ¥ ' + U.fmt(R.pata.y) : ''));
    const row = el('div', 'k-md-row', box);
    const mk = (id, t, sub, off) => { const b = el('button', 'k-btn' + (off ? ' k-off' : ''), row); b.innerHTML = '<span>' + t + '</span><small>' + sub + '</small>'; b.onclick = () => { if (G.IslandsUI) G.IslandsUI.close(true); start(id); }; };
    mk('dia', 'Desafio do Dia', usado ? 'amanhã tem outro' : '1 tentativa hoje', usado);
    mk('pata', 'Só na Pata', Math.round(CFG.pataSec / 60) + ' min sem motor');
    mk('maratona', 'Maratona', '5 ilhas, 1 build');
  }

  G.Modos = {
    init(a) { api = a || {}; if (G.Sim) G.Sim.add('modos', { tick }); setInterval(() => { try { chipTick(); } catch (e) { /* */ } }, 600); },
    on, state: ms, start, restore, after, travel, onEnding, record, recOf, mapInfo, chipHot, lockTool, seedMul, daily, unlocked,
    sim: { build, merge },   // tools/alicerce.js
    NAMES,
  };
})();
