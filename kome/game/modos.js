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
    if (!unlocked()) { toast('Os modos abrem depois das 5 ilhas', 'lock'); return false; }
    let cfg;
    if (id === 'dia') { const dd = daily(); if (mrec().diaTry === dd.day) { toast('Você já jogou o Desafio de hoje', 'clock', 'amanhã tem outro'); return false; } cfg = { id, isl: dd.isl, fx: dd.fx, am: dd.am, day: dd.day }; }
    else if (id === 'pata') cfg = { id, isl: (S().island + 1) % D.ISLANDS.length, fx: Math.max(1, s.lap | 0) };   // faixa ≥ 1: modo é sempre ilha de viagem (nunca a campanha)
    else cfg = { id: 'maratona', isl: 0, fx: Math.max(1, s.lap | 0) };
    const ilha = shortIsl(D.ISLANDS[cfg.isl].n);
    const what = { dia: ilha + ', ' + fxName(cfg.fx) + ', 3 amuletos sorteados. Só 1 tentativa hoje.',
      pata: ilha + ': ' + Math.round(CFG.pataSec / 60) + ' min sem máquina a motor. Faça o máximo de ¥.',
      maratona: 'As ' + CFG.maraN + ' ilhas seguidas na ' + fxName(cfg.fx) + '. Os amuletos da 1ª ilha valem em todas.' }[cfg.id];
    const go = () => { if (cfg.id === 'dia') mrec().diaTry = cfg.day; if (G.IslandsUI) G.IslandsUI.close(true); api.rewrite(d => build(d, cfg)); };
    if (sure || (api.fast && api.fast())) go();
    else ask({ icon: { dia: 'clock', pata: 'paw', maratona: 'boat' }[cfg.id], title: 'Jogar ' + NAMES[cfg.id] + '?', sub: what,
      rows: [{ k: 'keep', l: 'Seu jogo normal', t: 'fica guardado e volta igualzinho' }, { k: 'reset', l: 'Neste modo', t: 'você começa uma ilha do zero' }, { k: 'gain', l: 'Você ganha', t: 'só o recorde (sem sementes)' }],
      yes: 'Começar', no: 'Agora não', onYes: go });
    return true;
  }
  const unlocked = () => { const s = S().stats; return (s.lap | 0) >= 1 || !!s.legend; };
  // confirmação em 3 linhas (islands-ui.js · ask); sem o mapa carregado cai no diálogo simples
  function ask(o) {
    if (G.IslandsUI && G.IslandsUI.ask) return G.IslandsUI.ask(o);
    if (E.UI && E.UI.confirm) E.UI.confirm((o.sub ? o.sub + ' ' : '') + (o.rows || []).map(r => r.l + ': ' + r.t + '.').join(' '), o.onYes, { title: o.title, yes: o.yes, no: o.no }); else if (o.onYes) o.onYes();
  }
  function toast(t, icon, sub) { if (E.UI && E.UI.toast) E.UI.toast(t, { icon: icon || 'star', sub }); }

  /* ---- voltar pra partida: retrato inteiro + o que é permanente vindo do modo ---- */
  const PERM = ['ach', 'misDone', 'heart', 'sacks', 'bestSack', 'pockets', 'onigiri', 'goldEv', 'secret', 'events', 'evSeen', 'swaps', 'esc', 'amPick', 'recF', 'mrec', 'city', 'carta', 'perfectSecs', 'crowned', 'comboMaxSecs', 'bestCombo', 'dicas', 'got'];   // dicas vistas e sacos colhidos no total também ficam (a dica não repete na volta)
  function merge(d) {
    const snap = d.snap, m = d.stats || {}, mo = m.modo || {};
    if (!snap || !snap.stats) { if (d.stats) delete d.stats.modo; delete d.snap; return d; }
    const ss = snap.stats;
    ['closet', 'look', 'home', 'opts'].forEach(k => { if (d[k] !== undefined) snap[k] = d[k]; });
    if (snap.home && snap.island !== undefined && D.ISLANDS[snap.island | 0]) snap.home.theme = D.ISLANDS[snap.island | 0].theme || snap.home.theme;
    PERM.forEach(k => { if (m[k] !== undefined) ss[k] = m[k]; });
    for (const k in m) if (/^cs_/.test(k) && m[k]) ss[k] = m[k];   // cutscene já vista no modo não toca de novo na partida
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
      L.push({ icon: 'boat', label: 'Depois', value: 'você volta pro seu jogo' });
    } else if (mo.id === 'maratona') {
      mo.k = (mo.k | 0) + 1; mo.t = (mo.t || 0) + sec; mo.y = (mo.y || 0) + s.earned;
      if (!mo.build) mo.build = ((s.stats.am && s.stats.am.cur) || []).slice();
      const done = mo.k >= CFG.maraN;
      L.push({ icon: 'clock', label: 'Ilha ' + mo.k + ' de ' + CFG.maraN, value: U.fmtTime(sec) });
      L.push({ icon: 'clock', label: 'Tempo somado', value: U.fmtTime(mo.t) });
      L.push({ icon: 'yen', label: 'Ienes somados', value: '¥ ' + U.fmt(mo.y) });
      if (done) {
        const sum = k => EG.medal[k].reduce((a, b) => a + b, 0) * 60, m = mo.t <= sum('ouro') ? 3 : mo.t <= sum('prata') ? 2 : 1, old = R.mara;
        out.medal = m; out.newBest = !old || mo.t < old.t; out.sec = mo.t;
        if (out.newBest) R.mara = { t: Math.round(mo.t), y: Math.max(mo.y, (old && old.y) || 0), m: Math.max(m, (old && old.m) || 0), fx: mo.fx };
        else if (mo.y > (old.y || 0)) old.y = mo.y;
        L.push({ icon: 'star', label: 'Maratona completa', value: MED[m] + (out.newBest ? ' · recorde!' : '') });
      } else L.push({ icon: 'boat', label: 'Próxima', value: shortIsl(D.ISLANDS[(i + 1) % D.ISLANDS.length].n) + ' (mesmos amuletos)' });
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
    const fim = s.ended || pataCard, back = () => { if (G.IslandsUI) G.IslandsUI.close(true); restore(); };
    ask({ icon: 'boat', title: fim ? 'Voltar pro seu jogo?' : 'Sair do ' + NAMES[mo.id] + '?', sub: fim ? '' : 'Saindo agora, não vale recorde' + (mo.id === 'dia' ? ' (e o desafio de hoje já foi usado).' : '.'),
      rows: [{ k: 'keep', l: 'Seu jogo normal', t: 'volta do jeitinho que você deixou' }, fim ? { k: 'gain', l: 'Recorde', t: 'já está guardado' } : { k: 'reset', l: 'Este modo', t: 'acaba aqui, sem recorde' }],
      yes: 'Voltar', no: 'Ficar', onYes: back });
    return true;
  }
  const chipHot = () => { const mo = ms(); if (!mo) return null; return mo.id === 'maratona' && (mo.k | 0) < CFG.maraN ? 'Maratona: próxima ilha' : 'Voltar pra partida'; };   // islands-ui.js compara com 'Voltar pra partida'
  const lockTool = t => { const mo = ms(); return !!(mo && mo.id === 'pata' && t && t.seat !== 'paw'); };
  const seedMul = () => (on() ? 0 : 1);

  /* ---- Só na Pata: o relógio (20 min de jogo) e o cartão do resultado ---- */
  function tick() {
    const mo = ms(); if (!mo || mo.id !== 'pata' || pataCard) return;
    const s = S(); if (s.time < CFG.pataSec) return;
    const R = mrec(), old = R.pata, nb = !old || s.earned > old.y;
    if (!mo.done) { mo.done = 1; mo.y = s.earned; mo.nb = nb ? 1 : 0; mo.old = old ? old.y : 0; if (nb) R.pata = { y: s.earned, isl: G.Islands.index(), fx: mo.fx }; if (api && api.save) api.save(); }
    const nb2 = mo.nb !== undefined ? !!mo.nb : nb, old2 = mo.nb !== undefined ? mo.old : old && old.y;   // cartão atrasado (painel aberto): o recorde já foi gravado, não comparar de novo
    if (api && api.fast && api.fast()) return;   // modo acelerado: só registra (nenhum cartão espera)
    if ((api && api.busy && api.busy()) || (G.Faixas && G.Faixas.isOpen()) || (G.AmuletosUI && G.AmuletosUI.isOpen())) return;
    pataCard = true;
    if (G.Faixas && G.Faixas.card) G.Faixas.card({ kick: 'Só na Pata · tempo!', title: '¥ ' + U.fmt(mo.y) + (nb2 ? ' · recorde!' : ''),
      lines: [{ t: 'Você fez isso em ' + Math.round(CFG.pataSec / 60) + ' min, só com as patas.' }, { t: old2 && !nb2 ? 'Seu melhor: ¥ ' + U.fmt(old2) : 'Ficou guardado como seu melhor.', cls: 'k-fx-pay' }],
      btn: 'Voltar pro meu jogo', onClose: restore });
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

  /* ---- mapa: recordes por faixa da ilha escolhida + os 3 cartões dos modos (CSS em game/ux-ilhas.css) ---- */
  function el(tag, cls, par, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (par) par.appendChild(e); return e; }
  function ico(par, name, size) { const c = E.UI && E.UI.iconEl ? E.UI.iconEl(name, size || 22) : null; if (c && par) par.appendChild(c); return c; }
  function shake(e) { e.classList.remove('ux-shake'); void e.offsetWidth; e.classList.add('ux-shake'); }
  // recordes desta ilha, 1 linha por faixa: "Faixa Branca: 24min · ouro"
  function recInfo(side, i) {
    if (!S()) return;
    const R = recF()[D.ISLANDS[i].id]; if (!R) return;
    const ks = Object.keys(R).map(Number).sort((a, b) => b - a).slice(0, 4); if (!ks.length) return;
    const box = el('div', 'k-md-box', side), h = el('b', null, box); ico(h, 'trophy', 22); h.appendChild(document.createTextNode('Seu melhor em cada faixa'));
    for (const f of ks) { const r = R[f], sm = el('small', 'k-md-rec', box); el('span', null, sm, (f ? fxName(f) : 'Sem faixa') + ': '); el('b', null, sm, r.t ? U.fmtTime(r.t) : '—'); if (r.m | 0) { el('span', null, sm, ' · '); el('b', 'k-md-m' + (r.m | 0), sm, MED[r.m | 0]); } }
  }
  // novidade pra bolinha da aba: desafio de hoje ainda não jogado
  const news = () => !!(S() && !on() && unlocked() && mrec().diaTry !== daily().day);
  function modesInfo(side) {
    if (!S()) return;
    const s = S(), mo = ms();
    const note = el('div', 'k-md-note', side); el('i', null, note, '✓'); el('span', null, note, mo ? 'Seu jogo normal está guardado e volta igualzinho.' : 'Isso não mexe no seu jogo normal. Ele fica guardado.');
    if (mo) {
      const box = el('div', 'k-md-box', side), h = el('b', null, box); ico(h, 'clock', 22); h.appendChild(document.createTextNode('Jogando: ' + NAMES[mo.id]));
      el('small', null, box, mo.id === 'maratona' ? 'Ilha ' + ((mo.k | 0) + 1) + ' de ' + CFG.maraN + ' · tempo somado: ' + U.fmtTime((mo.t || 0) + (s.ended ? 0 : s.time)) : mo.id === 'pata' ? 'Faltam ' + U.fmtTime(Math.max(0, CFG.pataSec - s.time)) + ' · você fez ¥ ' + U.fmt(s.earned) : 'Desafio de hoje · ' + fxName(mo.fx));
      const b = el('button', 'ux-btn ux-main k-md-back', box); ico(b, 'boat', 26); el('span', null, b, chipHot() === 'Voltar pra partida' ? 'Voltar pro meu jogo' : 'Próxima ilha');
      b.onclick = () => { travel(); };
      return;
    }
    if (!unlocked()) {
      const box = el('div', 'k-md-box k-md-locked', side), h = el('b', null, box); ico(h, 'lock', 22); h.appendChild(document.createTextNode('Ainda fechado'));
      el('small', null, box, 'Abre quando você terminar as ' + D.ISLANDS.length + ' ilhas (você está na ' + (G.Islands.index() + 1) + 'ª).');
      el('small', null, box, 'Depois: Desafio do Dia, Só na Pata e Maratona.');
      return;
    }
    const dd = daily(), R = mrec(), usado = R.diaTry === dd.day, feito = R.dia && R.dia.day === dd.day ? R.dia : null;
    el('div', 'k-md-how', side, 'Escolha um jogo extra. Vale só recorde.');
    const mk = (id, icon, t, sub, rec, off, offTxt) => {
      const b = el('button', 'k-md-card' + (off ? ' k-off' : ''), side);
      const ic = el('span', 'k-md-ic', b); ico(ic, icon, 34);
      const tx = el('span', 'k-md-tx', b); el('b', null, tx, t); el('small', null, tx, sub); if (rec) el('small', 'k-md-best', tx, rec);
      el('span', 'k-md-play', b, off ? offTxt : 'Jogar');
      b.onclick = () => { if (!start(id)) shake(b); };
    };
    mk('dia', 'clock', 'Desafio do Dia', 'Hoje: ' + shortIsl(D.ISLANDS[dd.isl].n) + ', ' + fxName(dd.fx) + '. 1 tentativa.', feito ? 'Feito hoje: ' + U.fmtTime(feito.t) + ' · ' + MED[feito.m] : '', usado, 'amanhã');
    mk('pata', 'paw', 'Só na Pata', Math.round(CFG.pataSec / 60) + ' min sem máquina. Quanto ¥ você faz?', R.pata ? 'Seu melhor: ¥ ' + U.fmt(R.pata.y) : '');
    mk('maratona', 'boat', 'Maratona', 'As ' + CFG.maraN + ' ilhas seguidas, com os mesmos amuletos.', R.mara ? 'Seu melhor: ' + U.fmtTime(R.mara.t) + ' · ' + MED[R.mara.m] : '');
  }
  function mapInfo(side, i) { recInfo(side, i); modesInfo(side); }   // compatibilidade (tudo junto)

  G.Modos = {
    init(a) { api = a || {}; if (G.Sim) G.Sim.add('modos', { tick }); setInterval(() => { try { chipTick(); } catch (e) { /* */ } }, 600); },
    on, state: ms, start, restore, after, travel, onEnding, record, recOf, mapInfo, recInfo, modesInfo, news, chipHot, lockTool, seedMul, daily, unlocked,
    sim: { build, merge },   // tools/alicerce.js
    NAMES,
  };
})();
