/* Kome no Japão — eventos.js  (camada Cookie, passo 3: EVENTOS DOURADOS; spec docs/design/camada-cookie.md)
   Depois do final (Pátio aberto), a cada D.EVENTOS.every s de JOGO (aba visível, nunca offline) nasce uma coisa dourada que
   fica D.EVENTOS.life s na tela. O prêmio é sorteado QUANDO NASCE (pesos da planilha, tipo 'evento') e escrito nela: tocou,
   ganhou exatamente aquilo. Sem roleta, sem "quase", nenhum evento ruim. Efeitos:
     frenesi  renda toda ×v por dur s        festival  tudo ×v por dur s
     gigante  patada do Kome ×v por dur s    chuva     paga v minutos de renda ao longo de dur s
     desfile  maior turma do Pátio: +10% por unidade dela na renda da frota, dur s
     tempestade  sacos dourados: v minutos de renda (precisa S.stats.livro, nó da árvore de sementes, passo 4)
   Livro dos Eventos: S.stats.evSeen = {id: vezes}; mostra a chance "1 em N". Contador: S.stats.goldEv (conquistas).
   Visual PROVISÓRIO (botão dourado em DOM). A arte é do designer: G.Events.on(fn(evento, fase, k)) recebe 'nasce'/'pega'/'fim'. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data, CFG = D.EVENTOS;
  let api = null, wait = 0, live = null, btn = null, act = [], hooks = [], art = null;
  const S = () => G.S;
  const rows = () => ((D.COOKIE && D.COOKIE.ev) || []).filter(e => e.ef !== 'tempestade' || (S() && ((S().stats.sl || {}).livro | 0) > 0));
  const totalW = () => rows().reduce((s, e) => s + (e.peso || 1), 0);
  const emit = (e, f, k) => { for (const h of hooks) { try { h(e, f, k); } catch (err) { /* arte com erro não derruba o jogo */ } } };
  const nextWait = () => U.rnd(CFG.every[0], CFG.every[1]) / (1 + 0.1 * ((S() && S().stats.sl && S().stats.sl.faro_ev) | 0));
  function pick() {
    const L = rows(); let r = Math.random() * totalW();
    for (const e of L) { r -= e.peso || 1; if (r <= 0) return e; }
    return L[L.length - 1];
  }
  const label = e => e.n + ' · ' + (e.ef === 'chuva' || e.ef === 'tempestade' ? '+' + e.v + ' min de renda' : e.ef === 'desfile' ? 'desfile da frota' : '×' + e.v) + (e.dur && e.ef !== 'chuva' ? ' por ' + e.dur + ' s' : '');

  function spawn() {
    const e = pick(); if (!e) return;
    live = { e, t: CFG.life };
    emit(e, 'nasce', 0);
    if (api && api.fast && api.fast()) return;
    if (art && art.spawn) { live.trig = art.spawn(e.id, undefined, undefined, { life: CFG.life }); if (api && api.sfx) api.sfx('chirin'); return; }   // arte do Fable no canvas   // modo acelerado: o simulador "toca" pelo G.Events.sim
    if (!btn) {
      btn = document.createElement('button'); btn.className = 'k-btn k-golden';
      const css = document.createElement('style');
      css.textContent = '.k-golden{position:fixed;z-index:48;min-width:64px;min-height:64px;padding:8px 14px;border-radius:999px;background:radial-gradient(circle at 35% 30%,#FFF3B0,#F3C94A 55%,#C8962A);border:3px solid #3B2818;box-shadow:0 0 22px #FFE38A;font-weight:900;color:#3B2818;animation:kgold 1.2s ease-in-out infinite}' +
        '@keyframes kgold{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.06)}}';
      document.head.appendChild(css); document.body.appendChild(btn);
      btn.addEventListener('click', ev => { ev.stopPropagation(); take(); });
    }
    btn.textContent = '✦ ' + e.n;
    btn.title = label(e);
    btn.style.left = Math.round(U.rnd(0.25, 0.6) * innerWidth) + 'px';
    btn.style.top = Math.round(U.rnd(0.3, 0.55) * innerHeight) + 'px';
    btn.style.display = '';
    if (api && api.sfx) api.sfx('chirin');
  }
  function hide() { if (btn) btn.style.display = 'none'; }
  function take() {
    if (!live) return false;
    const e = live.e, trig = live.trig; live = null; hide();
    if (art && trig && art.take) art.take(trig);
    const s = S(); s.stats.goldEv = (s.stats.goldEv | 0) + 1;
    const seen = s.stats.evSeen || (s.stats.evSeen = {}); seen[e.id] = (seen[e.id] | 0) + 1;
    emit(e, 'pega', 0);
    if (e.ef === 'chuva' || e.ef === 'tempestade') act.push({ e, t: e.dur || 12, pay: (api && api.ips ? api.ips() : 0) * 60 * (e.v || 10) });
    else act.push({ e, t: e.dur || 30 });
    if (art && art.start) { try { art.start(e.id, { dur: e.dur }); } catch (err) { /* */ } }
    if (api && api.banner) api.banner(e, label(e));
    return true;
  }
  function tick(dt) {
    const s = S(); if (!api || !s || !s.ended) return;
    const fast = api.fast && api.fast();
    if (!fast && document.hidden) return;   // aba escondida: nada nasce e o relógio não anda
    if (live) { live.t -= dt; if (live.t <= 0) { emit(live.e, 'fim', 0); live = null; hide(); } }
    else if ((wait -= dt) <= 0) { wait = nextWait(); spawn(); }
    chipTick(dt);
    for (let i = act.length - 1; i >= 0; i--) {
      const a = act[i], d = Math.min(dt, a.t); a.t -= dt;
      if (a.pay && api.pay) api.pay(a.pay * d / (a.e.dur || 12));
      if (art && art.on && a.t > 0) art.on(a.e.id, a.t, 1 - a.t / (a.e.dur || 30));
      if (a.t <= 0) { act.splice(i, 1); emit(a.e, 'fim', 1); if (art && art.end) art.end(a.e.id, {}, ''); }
    }
  }
  // chip no topo enquanto um evento está rolando: "Frenesi ×7 · 42 s"
  let chip = null, chipT = 0;
  function chipTick(dt) {
    if ((chipT -= dt) > 0 || !G.HUD || !G.HUD.chip) return; chipT = 0.25;
    if (!chip) { chip = G.HUD.chip({ id: 'evento', icon: 'star', label: 'Evento', order: 5, tone: '#FFE38A', show: false }); if (!chip) return; }
    const a = act[0];
    if (!a) { chip.set({ show: false, prio: 0 }); return; }
    chip.set({ show: true, label: a.e.n, hint: (a.e.ef === 'chuva' || a.e.ef === 'tempestade' ? 'chovendo ¥' : '×' + a.e.v) + ' · ' + Math.ceil(a.t) + ' s', prio: 9 });
  }
  // multiplicador na renda: kind 0 = patada do Kome, 1 = automação/frota, 2 = prêmio (sacos etc., não multiplica)
  function mult(kind) {
    let m = 1;
    for (const a of act) {
      const ef = a.e.ef;
      if ((ef === 'frenesi' || ef === 'festival') && kind !== 2) m *= a.e.v || 1;
      else if (ef === 'gigante' && kind === 0) m *= a.e.v || 1;
      else if (ef === 'desfile' && kind === 1 && G.Patio && G.Patio.state) { const n = Math.max(0, ...Object.values(G.Patio.state.n || {})); if (n >= 10) m *= 1 + 0.1 * n; }
    }
    return m;
  }
  // Livro dos Eventos (dentro do painel do Pátio): o que já viu, com a chance escrita
  function fillBook(pane) {
    const tw = totalW(), seen = (S() && S().stats.evSeen) || {};
    for (const e of rows()) {
      const n = seen[e.id] | 0, b = UI.button(pane, { title: (n ? '✦ ' + e.n : '··· ???') + ' · 1 em ' + Math.max(1, Math.round(tw / (e.peso || 1))), sub: n ? e.d + ' (visto ' + n + '×)' : 'ainda não apareceu', size: 'sm' });
      (b.el || b).style.width = '100%';
    }
  }
  G.Events = {
    init(a) { api = a || {}; wait = nextWait() * 0.5; if (!art && G.EventArt) art = G.EventArt; },
    tick, mult, take, fillBook, label,
    on(fn) { hooks.push(fn); },
    listen(a) { art = a; },   // G.EventArt se pendura aqui sozinha
    hit(sx, sy) { if (!live || !art || !art.hitTrigger) return false; const tr = art.hitTrigger(sx, sy); if (tr) { take(); return true; } return false; },
    book() { const o = {}, seen = (S() && S().stats.evSeen) || {}; for (const e of rows()) o[e.id] = { seen: seen[e.id] | 0, locked: false }; return o; },
    force() { if (!live) { wait = nextWait(); spawn(); } },   // admin
    active: () => act.map(a => ({ id: a.e.id, t: a.t })), live: () => (live ? live.e.id : null),
    sim: { tap: () => take(), pending: () => !!live },
  };
})();
