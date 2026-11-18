/* Kome no Japão — carta.js
   CARTA DO DIA: passo 5 de docs/design/jogo-infinito.md (seção 5). Uma vez por dia de calendário (data local do aparelho), ao
   abrir o jogo, o Kome deixa uma carta: o que rendeu enquanto você estava fora (S.away: fábrica, Cidade; a frota tem o cartão
   "Pegar!" próprio, que abre antes) + 1 presente pequeno sorteado pela data.
   HONESTO: sem sequência, sem contador de dias, sem "volte amanhã". Presente que é ficha (rerrolar grátis, raro garantido) fica
   GUARDADO até você usar e não acumula (no máximo 1 de cada): pular dias não tira nem dá nada. Primeira vez que o jogo abre num
   save novo não tem carta (só marca o dia).
   Presentes: rr = 1 rerrolar de amuleto grátis (amuletos.js rerollCost/reroll) · raro = a próxima escolha de amuleto tem um raro
   garantido (amuletos.js draw) · sacos = chuva de sacos dourados agora · turbo = renda ×2 nos próximos 10 min DE JOGO (computeStats).
   Os de amuleto só saem depois da 1ª viagem (antes não há amuleto).
   Estado (save): S.stats.carta = {day: 'AAAA-MM-DD', tok: {rr, raro}, turbo: s} (MIGR[9] no game.js).
   MODO ACELERADO (FAST): nunca abre a carta; o presente entra sozinho, sem esperar tela. Demo: index.html?dev&carta=1. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.U) return;
  const U = E.U, D = G.Data;
  const CFG = D.CARTA = Object.assign({ sacos: 6, turbo: 600, turboX: 2, wait: 3.5 }, D.CARTA || {});
  const DEMO = /[?&]carta=1\b/.test(location.search || '') && /[?&]dev\b/.test(location.search || '');
  const S = () => G.S;
  let api = null, pend = null, waitT = CFG.wait, cardOn = false, turboWas = false;

  const pad = n => (n < 10 ? '0' : '') + n;
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'], MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const longDay = () => { const d = new Date(); return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]; };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const cst = () => { const s = S().stats; let c = s.carta; if (!c || typeof c !== 'object') c = s.carta = { day: '', tok: {} }; if (!c.tok || typeof c.tok !== 'object') c.tok = {}; c.turbo = +c.turbo || 0; return c; };

  const GIFTS = {
    rr: { n: 'Rerrolar grátis', d: 'a próxima troca das cartas de amuleto sai de graça (fica guardado até você usar)', icon: 'star' },
    raro: { n: 'Amuleto raro garantido', d: 'a próxima escolha de amuleto vem com pelo menos um raro (fica guardado até você usar)', icon: 'star' },
    sacos: { n: 'Chuva de sacos', d: 'sacos dourados caindo agora, perto do Kome', icon: 'sack' },
    turbo: { n: 'Arroz fresquinho', d: 'renda ×2 nos próximos 10 min de jogo (só conta com o jogo aberto)', icon: 'bolt' },
  };
  function pickGift(day) {
    const s = S().stats, amu = (s.islandsDone | 0) > 0 || (s.lap | 0) > 0, c = cst();
    const L = (amu ? ['rr', 'raro', 'sacos', 'turbo'] : ['sacos', 'turbo']).filter(k => !c.tok[k]);   // ficha que você ainda guarda não repete
    return L.length ? L[hash(day) % L.length] : 'sacos';
  }
  // o que rendeu fora (S.away do boot; fábrica e Cidade fazem a conta delas no init e escrevem em S.away.res)
  function awayLines() {
    const aw = S().away; if (!aw || !(aw.sec > 60)) return [];
    const r = aw.res || {}, out = ['Você ficou fora ' + U.fmtTime(aw.sec) + '.'];
    if (r.fabrica && r.fabrica.yen > 0) out.push('A fábrica vendeu ¥ ' + U.fmt(r.fabrica.yen) + '.');
    if (r.cidade && (r.cidade.yen > 0 || r.cidade.built > 0)) out.push('A Cidade vendeu ¥ ' + U.fmt(r.cidade.yen || 0) + (r.cidade.built ? ' e terminou ' + r.cidade.built + (r.cidade.built > 1 ? ' obras' : ' obra') : '') + '.');
    if (G.Patio && G.Patio.on && G.Patio.on()) out.push('A frota entregou no cartão "Pegar!".');
    return out;
  }
  function claim(quiet) {
    if (!pend) return;
    const c = cst(), k = pend.gift; c.day = pend.day; pend = null;
    if (k === 'rr' || k === 'raro') c.tok[k] = 1;
    else if (k === 'turbo') { c.turbo = CFG.turbo; if (api && api.recompute) api.recompute(); }
    else if (k === 'sacos' && api && api.gift) api.gift(CFG.sacos);
    if (!quiet && api && api.save) api.save();
  }
  function open() {
    const F = G.Faixas; if (!F || !F.card || !pend) { claim(false); return; }
    const g = GIFTS[pend.gift], lines = awayLines().map(t => ({ t }));
    lines.push({ t: 'Presente de hoje: ' + g.n + ' · ' + g.d, cls: 'k-fx-new' });
    lines.push({ t: 'Sem sequência e sem pressa: pular dias não tira nada.', cls: 'k-fx-pay' });
    cardOn = true;
    if (api && api.sfx) api.sfx('chime');
    F.card({ kick: 'Carta do dia · ' + longDay(), title: 'O Kome deixou uma carta',
      art: { w: 260, h: 104, draw(g2, t, w, h) {
        g2.imageSmoothingEnabled = false;
        const s = S(), pal = (s && s.look && s.look.pal) || 'kome', bob = Math.sin(t * 3) * 2;
        // envelope (traço do Kome: contorno #3B2818)
        const x = w / 2 + 52, y = h - 52 + bob;
        g2.fillStyle = '#FFF6DE'; g2.strokeStyle = '#3B2818'; g2.lineWidth = 2.5;
        g2.fillRect(x - 28, y - 18, 56, 36); g2.strokeRect(x - 28, y - 18, 56, 36);
        g2.beginPath(); g2.moveTo(x - 28, y - 18); g2.lineTo(x, y + 4); g2.lineTo(x + 28, y - 18); g2.stroke();
        g2.fillStyle = '#C8423A'; g2.beginPath(); g2.arc(x, y + 2, 6, 0, 6.283); g2.fill(); g2.stroke();
        E.drawShiba(g2, w / 2 - 34, h - 4, Math.floor(t / 1.4) % 2 ? 'wag' : 'cheer', t, { scale: 2.3, pal });
      } },
      lines, btn: 'Valeu, Kome!', onClose: () => { cardOn = false; claim(false); } });
  }
  const busy = () => (api && api.busy && api.busy()) || (G.AmuletosUI && G.AmuletosUI.isOpen()) || (G.Faixas && G.Faixas.isOpen()) ||
    (G.CookieUI && G.CookieUI.isOpen && G.CookieUI.isOpen());   // cartão "Pegar!" da frota abre antes

  function tick(dt) {
    if (!S()) return;
    const c = cst();
    if (c.turbo > 0) { c.turbo = Math.max(0, c.turbo - dt); turboWas = true; if (c.turbo <= 0 && api && api.recompute) api.recompute(); }
    else if (turboWas) turboWas = false;
    if (!pend || cardOn) return;
    if (api && api.fast && api.fast()) { claim(true); return; }   // modo acelerado: presente entra sozinho, sem tela
    if (busy()) { waitT = Math.max(waitT, 1.5); return; }
    if ((waitT -= dt) > 0) return;
    open();
  }

  G.Carta = {
    init(a) {
      api = a || {}; if (!S()) return;
      const c = cst(), day = today();
      if (G.Sim) G.Sim.add('carta', { tick });
      if (DEMO) { pend = { day, gift: (/[?&]presente=(\w+)/.exec(location.search) || [])[1] || pickGift(day) }; return; }
      if (!api.had || !api.had()) { c.day = day; return; }   // save novo: a 1ª abertura não tem carta, só marca o dia
      if (c.day === day) return;
      pend = { day, gift: pickGift(day) };
    },
    tick, pending: () => !!pend, isOpen: () => cardOn,
    tok: k => !!(S() && cst().tok[k]),
    use: k => { if (S() && cst().tok[k]) { cst().tok[k] = 0; return true; } return false; },
    mult: () => (S() && cst().turbo > 0 ? CFG.turboX : 1),
    turboLeft: () => (S() ? cst().turbo : 0),
    GIFTS, today, claim: () => claim(true),
  };
})();
