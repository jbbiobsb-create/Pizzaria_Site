/* Kome no Japão — faixas.js
   FAIXAS (as "stakes" do Balatro): passo 3 de docs/design/jogo-infinito.md. Terminou as 5 ilhas + o Kome-Oh (= deu a volta,
   S.stats.lap sobe no makeSave do islands.js) → abre a faixa seguinte: branca, amarela, laranja, verde, azul, marrom, preta,
   depois 1º Dan, 2º Dan… sem fim, como no judô. Faixa atual = volta (lap 0 = campanha + 1ª volta, sem faixa; lap 1 = branca).
   Cada faixa SOMA uma regra que muda a partida (as anteriores continuam): tabela REGRAS abaixo (10 regras = faixas 1..10).
   Do 4º Dan em diante (faixa 11+) cada faixa REFORÇA uma regra numérica, em rodízio (montanha, duro, eventos, combo, sacos,
   núcleo), até o teto de cada uma; depois do teto a faixa só paga (nunca fica impossível).
   PAGA: sementes da viagem × D.ENDGAME.faixa.seeds ^ faixa (1,5 por faixa, composto; islands.js gain()), amuletos novos no
   baralho (ficha amuleto com faixa: n, ver amuletos.js unlocked) e a faixa amarrada no Kome (E.shibaBelt, engine/shiba.js:
   camada nova, as poses não mudam) em todas as telas que desenham o Kome pela paleta dele, inclusive o mapa das ilhas.
   PREÇO: a faixa NÃO mexe em preço. O preço por viagem (D.ENDGAME.price.trip/grow, t = ilha + volta×5, islands.js priceMul) já
   sobe a cada volta: essa é a parte "preço" da aposta. Faixa = só regra + sementes (decidido 19/11; antes a spec dizia ×2,5).
   SEM PUNIÇÃO: nada aqui tira coisa permanente (Vila, coleção, sementes, selos, conquistas); as regras valem só na ilha.
   GANCHOS (cada um 1 linha, com G.Faixas opcional):
     game.js  AM(k) × mult(k) (comboDecay, sackRate) · computeStats → applyStats (sack) · buildWorld: altura × val('mont'),
              bolsões rasos somem com has('escondido') · heap.draw sem brilho com has('escondido') · MATS() → mats() (duro, núcleo)
     amuletos.js  max − val('amMax') · cartas − val('amOffer') · marco da chegada some com has('semChegada') · unlocked (faixa)
     islands.js   gain() × seedMul() · intervalo do evento da ilha × mult('evRaro') · texto da viagem (nextTxt)
     eventos.js   intervalo dos eventos dourados × mult('evRaro')
     islands-ui.js  título e quadro da faixa no mapa (title, mapInfo)
   Estado (save): S.stats.fx = {best: maior faixa já jogada, seen: última faixa cuja apresentação já passou}. MIGR[7] no game.js.
   MODO ACELERADO (FAST): a apresentação nunca abre (marca vista na hora). Demo: index.html?dev&faixa=3 (força a faixa 3). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.U) return;
  const U = E.U, D = G.Data, EG = D.ENDGAME, INK = '#3B2818';
  const CFG = EG.faixa = Object.assign({ seeds: 1.5 }, EG.faixa || {});   // mover pro data.js junto do resto do balanço
  const DEMO = (() => { const m = /[?&]faixa=(\d+)/.exec(location.search || ''); return m && /[?&]dev\b/.test(location.search) ? +m[1] : null; })();

  /* ---- as faixas (cor do pano, 2ª cor listrada, cor do nó) ---- */
  const BELTS = [
    null,
    { n: 'Faixa Branca', b: '#F4F1E6', bk: '#B9B09A' },
    { n: 'Faixa Amarela', b: '#F2C94C' },
    { n: 'Faixa Laranja', b: '#EE8A2E' },
    { n: 'Faixa Verde', b: '#4FA35A' },
    { n: 'Faixa Azul', b: '#3E6FC8' },
    { n: 'Faixa Marrom', b: '#7A4A2A' },
    { n: 'Faixa Preta', b: '#2A2420', bk: '#5A4E46' },
  ];
  function belt(n) {
    if (n <= 0) return null;
    if (n < BELTS.length) return BELTS[n];
    const dan = n - 7;   // 1º Dan = faixa 8
    if (dan <= 5) return { n: dan + 'º Dan', b: '#2A2420', bk: '#F0B429' };          // preta com nó dourado
    if (dan <= 8) return { n: dan + 'º Dan', b: '#D6322A', b2: '#F4F1E6' };           // coral (vermelha e branca)
    return { n: dan + 'º Dan', b: '#C8262A', bk: '#F0B429' };                          // vermelha
  }

  /* ---- as regras (faixa k soma REGRAS[k-1]). v = valor; up/cap = reforço do 4º Dan em diante ----
     chaves: mont (× altura da montanha) · amMax (amuletos a menos por ilha) · escondido · duro (× profundidade das camadas)
     evRaro (× intervalo dos eventos) · comboDecay (× esfriar do combo) · amOffer (cartas a menos) · sackRate/sack (sacos)
     semChegada (sem amuleto na chegada) · nucleo (× dureza do Núcleo Koshihikari) */
  const REGRAS = [
    { id: 'montanha', n: 'Montanha 20% maior', d: 'mais arroz pra cavar (e pra vender): a ilha fica mais comprida', v: { mont: 1.2 }, up: { mont: 0.1 }, cap: { mont: 1.6 } },
    { id: 'amuletos4', n: 'Só 4 amuletos por ilha', d: 'um marco a menos: cada escolha pesa mais', v: { amMax: 1 } },
    { id: 'escondido', n: 'Bolsões escondidos', d: 'os bolsões dourados não brilham nem nascem rasos: cave pra achar', v: { escondido: 1 } },
    { id: 'duro', n: 'Arroz duro mais cedo', d: 'as camadas duras começam 25% mais perto da superfície', v: { duro: 0.75 }, up: { duro: -0.08 }, cap: { duro: 0.5 } },
    { id: 'raros', n: 'Eventos mais raros', d: 'eventos da ilha e dourados demoram 60% mais pra aparecer', v: { evRaro: 1.6 }, up: { evRaro: 0.3 }, cap: { evRaro: 3 } },
    { id: 'combo', n: 'Combo frágil', d: 'o combo esfria 70% mais rápido quando você para', v: { comboDecay: 1.7 }, up: { comboDecay: 0.3 }, cap: { comboDecay: 3 } },
    { id: 'cartas', n: 'Duas cartas', d: 'cada escolha de amuleto mostra 2 cartas em vez de 3', v: { amOffer: 1 } },
    { id: 'sacos', n: 'Sacos tímidos', d: 'sacos caem metade das vezes, mas valem ×1,6', v: { sackRate: 0.5, sack: 1.6 }, up: { sackRate: -0.06, sack: 0.15 }, cap: { sackRate: 0.26, sack: 2.6 } },
    { id: 'chegada', n: 'Chegada sem presente', d: 'o 1º amuleto só vem com a 1ª máquina a motor', v: { semChegada: 1 } },
    { id: 'nucleo', n: 'Núcleo blindado', d: 'o Núcleo Koshihikari fica 50% mais duro', v: { nucleo: 1.5 }, up: { nucleo: 0.25 }, cap: { nucleo: 3 } },
  ];
  D.FAIXA_REGRAS = REGRAS;
  const STACK = REGRAS.filter(r => r.up);

  const S = () => G.S;
  let api = null;
  const lap = () => (S() ? S().stats.lap | 0 : 0);
  const level = () => (DEMO !== null ? DEMO : lap());
  const fst = () => { const s = S().stats; let f = s.fx; if (!f || typeof f !== 'object') f = s.fx = { best: 0, seen: 0 }; f.best = Math.max(f.best | 0, level()); f.seen = f.seen | 0; return f; };

  // regras de uma faixa n: [{regra, v (valores já reforçados), reps}]
  function rulesOf(n) {
    const out = [], reps = {};
    for (let k = 0; k < Math.min(n, REGRAS.length); k++) out.push({ r: REGRAS[k], reps: 0 });
    for (let j = 0; j < n - REGRAS.length; j++) { const r = STACK[j % STACK.length]; reps[r.id] = (reps[r.id] | 0) + 1; }
    for (const o of out) {
      o.reps = reps[o.r.id] | 0; o.v = {};
      for (const k in o.r.v) {
        let v = o.r.v[k];
        if (o.reps && o.r.up && o.r.up[k] !== undefined) { v += o.r.up[k] * o.reps; const c = o.r.cap[k]; v = o.r.up[k] > 0 ? Math.min(c, v) : Math.max(c, v); }
        o.v[k] = Math.round(v * 1000) / 1000;
      }
    }
    return out;
  }
  let cache = { n: -1, v: {}, list: [] };
  function agg() {
    const n = level();
    if (cache.n !== n) { const list = rulesOf(n), v = {}; for (const o of list) Object.assign(v, o.v); cache = { n, v, list }; }
    return cache.v;
  }
  const has = k => !!agg()[k];
  function mult(k) { const v = agg()[k]; return v === undefined ? 1 : v; }
  function val(k, d) { const v = agg()[k]; return v === undefined ? (d || 0) : v; }
  const seedMul = (n) => Math.pow(CFG.seeds, n === undefined ? level() : n);

  // computeStats (depois dos amuletos): só o valor dos sacos (o resto entra pelos ganchos)
  function applyStats(s) { const v = agg(); if (v.sack) s.sack *= v.sack; }
  // camadas da montanha: duras mais rasas e núcleo blindado (só a ilha atual; a ficha da ilha não muda)
  function mats(list) {
    const v = agg(); if (!v.duro && !v.nucleo) return list;
    return list.map(m => {
      const o = Object.assign({}, m);
      if (v.duro && m.d0 !== undefined) { o.d0 = m.d0 * v.duro; if (m.d1 < 1e8) o.d1 = m.d1 * v.duro; }
      if (v.nucleo && m.ellipse) o.hard = m.hard * v.nucleo;
      return o;
    });
  }

  const name = n => { const b = belt(n === undefined ? level() : n); return b ? b.n : 'sem faixa'; };
  const fmtX = x => '×' + (Math.round(x * 100) / 100).toLocaleString('pt-BR');
  // amuletos que entram no baralho em cada faixa (fichas com faixa: n)
  const newAmulets = n => (D.AMULETOS || []).filter(a => (a.faixa | 0) === n);
  function nextTxt() {
    const n = level() + 1, rs = rulesOf(n), r = rs[rs.length - 1];
    return 'Abre a ' + name(n) + ': ' + (n <= REGRAS.length ? 'regra nova "' + r.r.n + '"' : 'uma regra reforçada') + ', sementes ' + fmtX(seedMul(n)) + '.';
  }

  /* ---- a faixa amarrada no Kome: pela paleta dele (E.shibaBelt); troca de roupa/cor = troca a paleta que leva a faixa ---- */
  let beltPal = null, beltN = -1;
  function syncBelt() {
    if (!E.shibaBelt || !S()) return;
    const pal = (S().look && S().look.pal) || 'kome', n = level();
    if (pal === beltPal && n === beltN) return;
    if (beltPal) E.shibaBelt(beltPal, null);
    const b = belt(n);
    if (b) E.shibaBelt(pal, { b: b.b, b2: b.b2, bk: b.bk });
    beltPal = b ? pal : null; beltN = n;
  }

  /* ---- cartão de tela cheia (apresentação da faixa; evolucoes.js usa o mesmo) — estilo das cartas de amuleto ---- */
  const css = document.createElement('style');
  css.textContent = `
.k-fx-card{position:relative;width:680px;font-size:17px;max-width:calc(100% - 20px);background:#FFFAEE;border:4px solid ${INK};border-radius:18px;box-shadow:0 6px 0 ${INK},0 12px 26px rgba(20,10,0,.4),inset 0 0 0 5px #F0B429;padding:8px 16px 10px;display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;animation:kfxin .45s cubic-bezier(.2,1.4,.4,1)}
@keyframes kfxin{from{opacity:0;transform:translateY(40px) scale(.9)}to{opacity:1;transform:none}}
.k-fx-card canvas{image-rendering:pixelated;max-width:100%}
.k-fx-nm{font-size:26px;font-weight:900;line-height:1.05}
.k-fx-tx{font-size:18px;font-weight:700;line-height:1.25;color:#4A3524}
.k-fx-new{font-size:19px;font-weight:900;color:#9A3A20;background:#FFE9C4;border:2px solid ${INK};border-radius:12px;padding:4px 12px}
.k-fx-list{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.k-fx-list span{font-size:17px;font-weight:800;background:#EDE3CF;border:2px solid ${INK};border-radius:10px;padding:1px 9px;color:#5A4430}
.k-fx-pay{font-size:17px;font-weight:900;color:#2E6B3A}
.k-am.port .k-fx-card{width:480px}
.k-fx-side{margin-top:8px;padding:8px 10px;border:3px solid ${INK};border-radius:14px;background:#FFF6DE;display:flex;flex-direction:column;gap:4px}
.k-fx-side b{font-size:18px;font-weight:900;display:flex;align-items:center;gap:8px}
.k-fx-side i{display:inline-block;width:34px;height:12px;border:2px solid ${INK};border-radius:4px}
.k-fx-side small{display:block;font-size:17px;font-weight:700;color:#5A4430;line-height:1.2}
`;
  document.head.appendChild(css);
  let croot = null, cV = null, ck = 1, cur = null;
  function cfit() {
    if (!croot) return;
    const w = innerWidth, h = innerHeight, port = h > w;
    ck = port ? Math.min(w / 520, h / 900) : Math.min(w / 960, h / 540);
    cV.style.width = (w / ck) + 'px'; cV.style.height = (h / ck) + 'px'; cV.style.transform = 'scale(' + ck + ')';
    croot.classList.toggle('port', port);
  }
  function el(tag, cls, parent, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (parent) parent.appendChild(e); return e; }
  function sfx(n, o) { const s = S(); if ((s && s.opts && s.opts.mute) || !E.Sfx || !E.Sfx.play) return; if (E.Sfx.has && !E.Sfx.has(n)) return; try { E.Sfx.play(n, o); } catch (e) { /* */ } }
  // card({kick, title, lines:[{t, cls}], art: {w, h, draw(g, t, w, h)}, btn, auto (s), onClose}) -> {close}
  function card(o) {
    if (cur) cur.close(true);
    if (!croot) { croot = el('div', 'k-am'); cV = el('div', 'k-am-v', croot); document.body.appendChild(croot); addEventListener('resize', cfit); }
    cfit();
    const dim = el('div', 'k-am-dim', cV), wrap = el('div', 'k-am-wrap', cV);
    void dim.offsetWidth; dim.classList.add('on');
    if (o.kick) el('div', 'k-am-kick', wrap, o.kick);
    if (o.title) el('div', 'k-am-title', wrap, o.title);
    const c = el('div', 'k-fx-card', wrap);
    let cv = null, raf = 0, t0 = performance.now(), done = false;
    if (o.art) {
      cv = el('canvas', null, c); const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = o.art.w * dpr; cv.height = o.art.h * dpr; cv.style.width = o.art.w + 'px'; cv.style.height = o.art.h + 'px';
      const g = cv.getContext('2d');
      const frame = () => { if (done) return; const t = (performance.now() - t0) / 1000; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, o.art.w, o.art.h); try { o.art.draw(g, t, o.art.w, o.art.h); } catch (e) { /* arte quebrada não trava a tela */ } if (o.auto && t > o.auto) { close(); return; } raf = requestAnimationFrame(frame); };
      raf = requestAnimationFrame(frame);
    } else if (o.auto) setTimeout(() => close(), o.auto * 1000);
    for (const L of o.lines || []) if (L && L.t) el('div', L.cls || 'k-fx-tx', c, L.t);
    if (o.list && o.list.length) { const l = el('div', 'k-fx-list', c); for (const x of o.list) el('span', null, l, x); }
    const ft = el('div', 'k-am-foot', wrap), b = el('button', 'k-am-b gold', ft, o.btn || 'Bora!'); b.type = 'button';
    function close(quiet) {
      if (done) return; done = true; cancelAnimationFrame(raf); cur = null;
      dim.classList.remove('on'); wrap.style.transition = 'opacity .25s'; wrap.style.opacity = '0';
      setTimeout(() => { dim.remove(); wrap.remove(); }, 280);
      if (!quiet && o.onClose) o.onClose();
    }
    b.addEventListener('click', e => { e.stopPropagation(); sfx('click'); close(); });
    dim.addEventListener('pointerdown', e => { if (e.target === dim) close(); });
    cur = { close };
    return cur;
  }

  /* ---- apresentação da faixa nova (1x por faixa) ---- */
  let waitT = 3;
  function present(n) {
    const b = belt(n), rs = rulesOf(n), last = rs[rs.length - 1], fresh = n <= REGRAS.length, am = newAmulets(n);
    sfx('fanfare');
    card({
      kick: 'Volta ' + (lap() + 1) + ' ao Japão · faixa nova', title: b.n + '!',
      art: { w: 260, h: 112, draw(g, t, w, h) {
        g.imageSmoothingEnabled = false;
        const pal = (S().look && S().look.pal) || 'kome', pose = t < 0.9 ? 'bow' : Math.floor(t / 1.6) % 2 ? 'proud' : 'cheer';
        E.drawShiba(g, w / 2, h - 6, pose, t, { scale: 2.4, pal });
        if (t < 1.4) { g.globalAlpha = Math.max(0, 1 - t / 1.4); g.fillStyle = b.b; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + t * 2, r = 30 + t * 70; g.fillRect(w / 2 + Math.cos(a) * r - 3, h / 2 + Math.sin(a) * r * 0.6 - 3, 6, 6); } g.globalAlpha = 1; }
      } },
      lines: [
        { t: (fresh ? 'Regra nova: ' : 'Regra reforçada: ') + last.r.n + ' · ' + last.r.d, cls: 'k-fx-new' },
        { t: 'Paga: sementes ' + fmtX(seedMul(n)) + ' na viagem' + (am.length ? ' · no baralho: ' + am.map(a => a.n).join(', ') : ''), cls: 'k-fx-pay' },
        { t: 'Valem nesta volta (nada permanente sai):' },
      ],
      list: rs.map(o => o.r.n + (o.reps ? ' +' + o.reps : '')),
      btn: 'Amarrar a faixa!',
    });
  }
  function tick(dt) {
    if (!S()) return;
    syncBelt();
    const n = level(); if (n <= 0) return;
    const f = fst();
    if (f.seen >= n) return;
    if (api && api.fast && api.fast()) { f.seen = n; return; }
    if (api && api.busy && api.busy()) { waitT = Math.max(waitT, 1.5); return; }
    if ((G.AmuletosUI && G.AmuletosUI.isOpen()) || cur) return;
    if ((waitT -= dt) > 0) return;
    f.seen = n; present(n);
    if (api && api.save) api.save();
  }

  /* ---- mapa das ilhas: título e quadro da faixa ---- */
  function mapInfo(side) {
    const n = level(), b = belt(n), box = el('div', 'k-fx-side', side);
    const h = el('b', null, box); const sw = el('i', null, h); sw.style.background = b ? b.b : '#E4DCCB'; h.appendChild(document.createTextNode(b ? b.n : 'Sem faixa ainda'));
    if (!b) { el('small', null, box, 'Dê a volta no Japão (5 ilhas + Kome-Oh) pra ganhar a Faixa Branca: uma regra nova por faixa, sementes ×1,5 cada.'); return; }
    el('small', null, box, 'Regras desta volta: ' + rulesOf(n).map(o => o.r.n + (o.reps ? ' +' + o.reps : '')).join(' · '));
    el('small', null, box, 'Sementes da viagem ' + fmtX(seedMul(n)) + ' · próxima: ' + name(n + 1));
  }
  const title = () => { const n = level(); return n > 0 ? ' · ' + name(n) : ''; };

  G.Faixas = {
    init(a) { api = a || {}; if (G.Sim) G.Sim.add('faixas', { tick }); if (S()) { fst(); syncBelt(); } },
    level, name, belt, rulesOf, has, mult, val, seedMul, applyStats, mats, nextTxt, mapInfo, title, card, newAmulets, REGRAS,
    best: () => (S() ? Math.max(fst().best | 0, level()) : 0),
    present: n => present(n || Math.max(1, level())),   // ?dev / testes
  };
})();
