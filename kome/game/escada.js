/* Kome no Japão — escada.js
   CONQUISTAS EM ESCADA: passo 5 de docs/design/jogo-infinito.md (seção 5). Não duplica as 30 conquistas do goals.js nem as
   418 da camada Cookie (patio.js): ESTENDE elas. Cada escada é um contador permanente (fica entre viagens) com GRAUS SEM FIM
   ("cave 1 mi / 2 mi / 5 mi… grãos"). Cada grau fechado vale como mais uma conquista no Arroz do Coração (patio.js heart():
   +1% de renda por grau, mais com Pote Fundo/Tigelas, igual às conquistas). A escada mais perto de fechar (pelo ritmo de agora,
   não só pela %) fica num chip pequeno do HUD; toque abre o Caderno, que lista todas.
   RITMO: ~1 grau a cada 10 min de jogo (jogo-infinito.md, tabela de números). Contadores que crescem em linha reta usam
   limiar base × k^p (graus rápidos no começo, ~0,6/h por escada perto de 10 h, sem fim); o ¥ total cresce exponencial e usa
   ×1000 por grau (mi, bi, tri…: ver o número mudar de nome é a recompensa). Calibrado com `node tools/longo.js --stats`
   (4 h, 19/11: ritmo por hora ~ grãos 1,4 bi · sacos 200 · bolsões 100 · onigiris 60 · dourados 14 · ilhas 1,5 · amuletos 5 ·
   corações 200 · ¥ ×1000/h) → ~33 graus em 4 h (1 a cada ~7 min no começo, caindo pra ~1 a cada 10 min perto de 10 h).
   Estado (save): S.stats.esc = {g: {id: graus}} (MIGR[9] no game.js). Contadores novos: S.stats.dugAll (islands.js makeSave),
   S.stats.amPick (amuletos.js pick). Modo acelerado (FAST): fecha graus sem aviso. Nada aqui tira grau nem cobra nada. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.U) return;
  const U = E.U, D = G.Data;
  const S = () => G.S, st = () => S().stats;

  // limiar arredondado em 2 algarismos (1,2 mi, 48, 130…) e texto sem ",00"
  const nice = v => { if (v < 20) return Math.max(1, Math.round(v)); const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; };
  const fmt = v => U.fmt(v).replace(/,0+(?=\s|$)/, '');
  const pw = (base, p) => k => nice(base * Math.pow(k, p));          // contador em linha reta
  const x1000 = base => k => base * Math.pow(1000, k - 1);           // ¥: mil, mi, bi, tri…
  const lin = step => k => step * k;                                 // ilhas, faixas: 1 por grau
  const city = () => (st().city && st().city.hearts) || 0;

  /* ---- as escadas. get() = contador permanente; thr(k) = valor do grau k; n(v) = texto do grau ---- */
  const LAD = [
    { id: 'graos', s: 'Grãos', icon: 'rice', get: () => ((st().dugAll || 0) + (S().dug || 0)) * 40, thr: pw(2.7e8, 1.7), n: v => 'Cave ' + fmt(v) + ' grãos' },
    { id: 'iene', s: 'Ienes', icon: 'yen', get: () => (st().earnedAll || 0) + (S().earned || 0), thr: x1000(1e6), n: v => 'Ganhe ¥ ' + fmt(v) + ' no total' },
    { id: 'sacos', s: 'Sacos', icon: 'sack', get: () => st().sacks | 0, thr: pw(54, 1.6), n: v => 'Estoure ' + fmt(v) + ' sacos' },
    { id: 'bolsoes', s: 'Bolsões', icon: 'chest', get: () => st().pockets | 0, thr: pw(27, 1.6), n: v => 'Ache ' + fmt(v) + ' bolsões dourados' },
    { id: 'oni', s: 'Onigiris', icon: 'star', get: () => st().onigiri | 0, thr: pw(22, 1.5), n: v => 'Pegue ' + fmt(v) + ' onigiris da sorte' },
    { id: 'dourado', s: 'Eventos', icon: 'bolt', get: () => st().goldEv | 0, thr: pw(7, 1.4), n: v => 'Aproveite ' + fmt(v) + ' eventos dourados' },
    { id: 'ilhas', s: 'Ilhas', icon: 'boat', get: () => st().islandsDone | 0, thr: pw(1, 1.15), n: v => 'Conclua ' + fmt(v) + (v > 1 ? ' ilhas' : ' ilha') },
    { id: 'faixas', s: 'Faixas', icon: 'trophy', get: () => (G.Modos && G.Modos.on() ? 0 : G.Faixas ? G.Faixas.best() : st().lap | 0), thr: lin(1), n: v => 'Chegue na ' + (G.Faixas ? G.Faixas.name(v) : 'faixa ' + v) },   // faixa jogada num modo (Desafio do Dia) não conta
    { id: 'amuletos', s: 'Amuletos', icon: 'star', get: () => st().amPick | 0, thr: pw(3, 1.45), n: v => 'Escolha ' + fmt(v) + ' amuletos' },
    { id: 'coracoes', s: 'Corações', icon: 'house', get: city, thr: pw(75, 1.5), n: v => 'Junte ♥ ' + fmt(v) + ' na Cidade' },
  ];
  D.ESCADAS = LAD;

  let api = null, acc = 0, rateT = 0;
  const rate = {}, last = {};   // ritmo de cada contador (média móvel por segundo de jogo): "perto de fechar" = menos tempo, não maior %
  const est = () => { const s = st(); let e = s.esc; if (!e || typeof e !== 'object') e = s.esc = { g: {} }; if (!e.g || typeof e.g !== 'object') e.g = {}; return e; };
  const grade = L => est().g[L.id] | 0;
  const safe = L => { try { const v = +L.get(); return isFinite(v) ? v : 0; } catch (e) { return 0; } };
  function info(L) {
    const g = grade(L), v = safe(L), lo = g ? L.thr(g) : 0, hi = L.thr(g + 1);
    const p = U.clamp((v - lo) / Math.max(1e-9, hi - lo), 0, 1), r = rate[L.id] || 0;
    return { L, g, v, hi, p, eta: r > 0 ? (hi - v) / r : Infinity, txt: L.n(hi) };
  }
  const total = () => { if (!S()) return 0; let n = 0; const g = est().g; for (const k in g) n += g[k] | 0; return n; };

  // a mais perto de fechar: menor tempo estimado no ritmo de agora; sem ritmo, a de maior %
  function closest() {
    let best = null;
    for (const L of LAD) { const o = info(L); if (!best || (o.eta < best.eta) || (o.eta === best.eta && o.p > best.p)) best = o; }
    return best;
  }

  function tick(dt) {
    if (!S() || (acc += dt) < 1) return;
    const step = acc; acc = 0;
    // ritmo (a cada ~5 s de jogo): média móvel de ~2 min
    if ((rateT += step) >= 5) {
      for (const L of LAD) { const v = safe(L); if (last[L.id] !== undefined) { const d = Math.max(0, v - last[L.id]) / rateT; rate[L.id] = rate[L.id] === undefined ? d : rate[L.id] + (d - rate[L.id]) * 0.08; } last[L.id] = v; }
      rateT = 0;
    }
    let got = 0;
    for (const L of LAD) {
      const v = safe(L); let g = grade(L), n = 0;
      while (n < 40 && v >= L.thr(g + 1)) { g++; n++; }
      if (!n) continue;
      est().g[L.id] = g; got += n;
      if (!(api && api.quiet && api.quiet())) {
        const txt = L.n(L.thr(g));
        if (E.UI && E.UI.achievement) E.UI.achievement(txt, { sub: 'escada ' + L.s + ' · grau ' + g + ' · +1% de renda pra sempre', icon: L.icon, kicker: 'Conquista em escada' });
        if (api.sfx) api.sfx('chirin');
      }
    }
    if (got && api) { if (api.recompute) api.recompute(); if (api.badge) api.badge(); }
  }

  /* ---- chip do HUD: a escada mais perto de fechar, pequenininha ---- */
  let chip = null;
  function chipTick() {
    if (!S() || !G.HUD || !G.HUD.ready || !G.HUD.chip) return;
    if (!chip) { chip = G.HUD.chip({ id: 'escada', icon: 'trophy', label: 'Escada', order: 4, tone: '#F3ECFF', show: false, onClick: () => { if (api && api.sfx) api.sfx('click'); if (G.Home) G.Home.open('caderno'); } }); if (!chip) return; }
    const s = S(), show = !!(s.stats.tipDone || s.time > 90 || total() > 0);
    if (!show) { chip.set({ show: false }); return; }
    const c = closest(); if (!c) return;
    const pct = Math.floor(c.p * 100), soon = c.eta < 90 || c.p >= 0.95;
    chip.set({ show: true, icon: c.L.icon, label: c.L.s + ' ' + pct + '%', prio: soon ? 0.4 : 0, hot: 'Quase: ' + c.L.s, hint: soon ? c.txt : '',
      tip: c.txt + ' · ' + pct + '% · grau ' + (c.g + 1) + ' (+1% de renda)', act: 'Caderno' });
    chip.el.title = c.txt + ' (' + pct + '%) · ' + total() + ' graus de escada = +' + total() + '% de renda';
  }

  /* ---- Caderno (goals.js chama): uma linha por escada com a barra até o próximo grau ---- */
  function caderno(col) {
    const UI = E.UI; if (!UI || !UI.el || !S()) return;
    const n = total();
    UI.el('div', 'k-h', col, 'Conquistas em escada · ' + n + (n === 1 ? ' grau' : ' graus') + ' · renda +' + n + '%');
    UI.el('div', 'k-homehint', col, 'sem fim: cada grau fecha o próximo degrau e vale +1% de renda pra sempre (nunca zera na viagem)');
    const list = LAD.map(info).sort((a, b) => a.eta - b.eta || b.p - a.p);
    for (const o of list) {
      const b = UI.button(col, { title: o.txt, sub: o.L.s + ' · grau ' + o.g + ' · ' + Math.floor(o.p * 100) + '% · agora ' + fmt(Math.floor(o.v)), icon: o.L.icon, size: 'sm', progress: o.p });
      (b.el || b).style.width = '100%';
    }
  }

  G.Escada = {
    init(a) { api = a || {}; if (G.Sim) G.Sim.add('escada', { tick }); if (S()) est(); setInterval(() => { try { chipTick(); } catch (e) { /* */ } }, 700); },
    tick, total, closest, caderno, grade: id => (S() ? est().g[id] | 0 : 0), list: LAD, info: id => info(LAD.find(L => L.id === id)),
  };
})();
