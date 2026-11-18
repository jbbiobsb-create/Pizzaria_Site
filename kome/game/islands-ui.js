/* Kome no Japão — islands-ui.js
   Interface da VOLTA AO JAPÃO (fim de jogo), em cima de islands.js:
   - chip no topo do HUD (logo abaixo da barra da montanha): ilha atual e a próxima viagem; pulsa quando dá pra partir;
   - MAPA DAS ILHAS em tela cheia: Japão desenhado no traço do Kome (scenery.js · japan), ilhas como nós (bloqueada = "?",
     atual = Kome pulando, concluída = carimbo 済 + medalha), ficha da ilha escolhida (gancho, regras, medalhas, recorde,
     roupinhas exclusivas), a árvore das Sementes Douradas e o botão grande "Partir pra X";
   - tutorial guiado (tour) depois da cutscene: anel pulsando + balão em 3 passos (chip, sementes, Partir). Pula com "Pular".
   O jogo pausa enquanto o mapa está aberto (game.js · update olha G.IslandsUI.isOpen). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data, EG = D.ENDGAME, PAL = E.PAL;
  let api = null, S = null, chip = null, root = null, cv = null, sel = -1, nodes = [], raf = 0, onClose = null, coach = null;
  const I = () => G.Islands;
  const yen = v => U.fmt(v);

  if (UI && UI.defineIcon) {
    UI.defineIcon('boat', (P, C) => {
      P.poly([[1, 10], [15, 10], [12, 14], [4, 14]], '#9A6A44').rect(2, 11, 12, 1, '#7A5034');
      P.rect(7, 2, 1, 8, '#7A5034').poly([[8, 2], [13, 7], [8, 9]], C.cream || '#FFF8EC').ell(10, 6, 1.4, 1.4, C.red || '#C8423A');
      P.rect(0, 15, 16, 1, '#4FA3D9');
    });
  }

  /* ---------- chip do HUD ---------- */
  function chipShow() { return !!(S && (S.ended || I().islandRun() || S.stats.cs_ilhas || I().event())); }
  let chipH = null;
  const shortIsl = n => n.replace('Ilha Flutuante de ', '').replace(/^Ilha d[eo] /, '');
  function chipTick() {
    if (!S || !G.HUD || !G.HUD.chip) return;
    if (!chipH) {
      chipH = G.HUD.chip({ id: 'ilhas', icon: 'boat', label: 'Ilhas', order: 40, show: false, onClick: () => { if (coach && coach.step === 0) coachNext(); else open(); } });
      if (!chipH) return; chip = chipH.el;
    }
    const on = chipShow(); if (!on) { chipH.set({ show: false }); return; }
    const here = I().island(), nx = I().next(), n = I().index() + 1, lap = I().lap(), ev = I().event(), g = I().gain();
    chip.title = here.n + ' · ilha ' + n + '/' + D.ISLANDS.length + (lap ? ' · volta ' + (lap + 1) : '') + ' · casa ' + S.house + '/' + D.HOUSE.length;
    // viagem liberada ganha de tudo (prio 3); evento da ilha rolando avisa (prio 1.5); senão é só o atalho "Ilhas"
    if (S.ended) chipH.set({ show: true, prio: 3, hot: 'Partir pra ' + shortIsl(nx.n), hint: g > 0 ? '+' + g + (g === 1 ? ' semente' : ' sementes') : 'toque!' });
    else if (ev) chipH.set({ show: true, prio: 1.5, hot: ev.n.replace('!', ''), hint: '×' + String(ev.mult).replace('.', ',') + ' · ' + Math.ceil(I().eventLeft()) + 's' });
    else chipH.set({ show: true, prio: 0, hint: '' });
  }

  /* ---------- mapa ---------- */
  const stateOf = i => {
    const cur = I().index(), r = I().rec(D.ISLANDS[i].id), lap = I().lap();
    if (i === cur) return 'here';
    if (r && r.n) return 'done';
    if (lap > 0 || i < cur) return 'done';
    return i === (cur + 1) % D.ISLANDS.length ? 'open' : 'locked';
  };
  function el(tag, cls, par, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (par) par.appendChild(e); return e; }
  function kome(pal, pose, sc) { const c = document.createElement('canvas'); c.width = 40 * sc; c.height = 38 * sc; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; E.drawShiba(g, c.width / 2, c.height - 2, pose || 'sit', 0.5, { scale: sc, pal, shadow: false }); return c; }
  function build() {
    root = el('div', 'k-isl k-theme');
    const card = el('div', 'k-isl-card', root);
    const head = el('div', 'k-isl-head', card);
    el('b', 'k-isl-title', head, 'A Volta ao Japão');
    el('span', 'k-isl-seeds', head);
    const x = el('button', 'k-btn k-isl-x', head, '×'); x.setAttribute('aria-label', 'Fechar'); x.onclick = close;
    const body = el('div', 'k-isl-body', card);
    const mapW = el('div', 'k-isl-map', body);
    cv = el('canvas', '', mapW);
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect(), k = cv.width / r.width / (cv._dpr || 1), px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
      for (const nd of nodes) if (Math.hypot(px - nd.x, py - nd.y) < nd.r) { sel = nd.i; api.sfx('paw'); fillSide(); return; }
    });
    el('div', 'k-isl-side', body);
    document.body.appendChild(root);
  }
  function fillSide() {
    const side = root.querySelector('.k-isl-side'); side.innerHTML = '';
    root.querySelector('.k-isl-seeds').textContent = '★ ' + U.fmt(S.stats.seeds || 0) + ' Sementes Douradas';
    root.querySelector('.k-isl-title').textContent = 'A Volta ao Japão' + (I().lap() ? ' · volta ' + (I().lap() + 1) : '') + (G.Faixas ? G.Faixas.title() : '') + (S.stats.legend ? ' · Lenda do Japão' : '');
    const i = sel, isl = D.ISLANDS[i], st = stateOf(i), r = I().rec(isl.id), cur = I().index();
    const info = el('div', 'k-isl-info', side);
    const h = el('div', 'k-isl-name', info); h.textContent = (st === 'locked' ? '???' : isl.n);
    el('div', 'k-isl-hook', info, st === 'locked' ? 'ilha misteriosa: chegue na anterior pra revelar' : isl.hook);
    el('div', 'k-isl-tag k-isl-' + st, info, st === 'here' ? 'você está aqui' : st === 'done' ? 'concluída' : st === 'open' ? 'próxima parada' : 'bloqueada');
    if (st !== 'locked') {
      const ul = el('ul', 'k-isl-mods', info); (isl.mods || []).forEach(m => el('li', '', ul, m));
      if (isl.ev) el('li', 'k-isl-ev', ul, 'evento: ' + isl.ev.n + ' ' + isl.ev.sub);
      // medalhas
      const md = el('div', 'k-isl-medals', info), mine = r ? r.medal | 0 : 0;
      [['bronze', 'terminar'], ['prata', '≤ ' + EG.medal.prata[i] + ' min'], ['ouro', '≤ ' + EG.medal.ouro[i] + ' min']].forEach((m, k) => {
        const b = el('span', 'k-isl-medal k-m' + (k + 1) + (mine > k ? ' k-got' : ''), md); b.textContent = m[0] + ' · ' + m[1] + (EG.medal.seeds[m[0]] ? ' · +' + EG.medal.seeds[m[0]] + '★' : '');
      });
      el('div', 'k-isl-best', info, r && r.best ? 'recorde: ' + U.fmtTime(r.best) + ' · concluída ' + r.n + 'x' : i === cur && !S.ended ? 'tempo nesta ilha: ' + U.fmtTime(S.time) : 'ainda sem recorde');
      const ex = D.CLOSET.filter(c => c.island === i);
      if (ex.length) {
        const row = el('div', 'k-isl-ex', info); el('span', '', row, 'só aqui:');
        ex.forEach(c => { const has = (S.closet || []).indexOf(c.id) >= 0, w = el('span', 'k-isl-exi' + (has ? ' k-got' : ''), row); w.appendChild(kome(c.kind === 'pal' ? c.id : 'kome', 'sit', 1)); el('small', '', w, c.n + (has ? ' ✓' : '')); });
      }
    }
    if (G.Faixas) G.Faixas.mapInfo(info);   // faixa da volta: regras e sementes
    // partir
    const nx = I().next(), go = el('button', 'k-btn k-isl-go' + (S.ended ? ' k-pulse' : ''), side);
    go.innerHTML = '<b>Partir pra ' + nx.n.replace('Ilha Flutuante de ', 'Ilha de ') + '</b><small>' + (S.ended ? '+' + U.fmt(I().gain()) + ' sementes agora' : 'termine a casa de ' + I().island().n.replace('Ilha Flutuante de ', '') + ' primeiro (' + S.house + '/' + D.HOUSE.length + ')') + '</small>';
    if (!S.ended) go.classList.add('k-off');
    go.onclick = () => { if (!S.ended) { UI.toast('Termine a casa nesta ilha primeiro', { icon: 'lock', sub: 'sem pressa: a ilha espera' }); return; } close(true); I().travel(); };
    // sementes
    const sd = el('div', 'k-isl-tree', side);
    el('div', 'k-isl-sub', sd, 'Sementes Douradas · nunca zeram');
    const grid = el('div', 'k-isl-grid', sd);
    for (const s of D.SEEDS) {
      const L = I().lvl(s.id), full = !!s.max && L >= s.max, c = I().seedCost(s), can = !full && Math.floor(S.stats.seeds || 0) >= c;
      const b = el('button', 'k-btn k-isl-seed' + (can ? ' k-can' : '') + (full ? ' k-full' : ''), grid);
      b.innerHTML = '<b>' + s.n + '</b><small>' + s.d + '</small><span class="k-isl-pips"></span><span class="k-isl-cost">' + (full ? 'completo' : '★ ' + U.fmt(c)) + '</span>';
      const pp = b.querySelector('.k-isl-pips'); if (!s.max) pp.textContent = 'Nv ' + L + ' · sem teto'; else if (s.max > 12) pp.textContent = 'Nv ' + L + '/' + s.max; else for (let k = 0; k < s.max; k++) el('i', k < L ? 'on' : '', pp);   // muitos níveis: texto em vez de paredão de quadradinhos
      b.onclick = () => { if (!full) I().buy(s); };
    }
    const row = el('div', 'k-isl-row', side);
    const rv = el('button', 'k-btn k-isl-small', row, 'Rever a cutscene'); rv.onclick = () => { close(); setTimeout(() => api.play('ilhas'), 150); };
    if (S.ended) { const nm = el('button', 'k-btn k-isl-small', row, 'Nova montanha aqui'); nm.onclick = () => { close(); setTimeout(() => api.pickMountain(), 150); }; }
  }
  function draw() {
    if (!root || !root.classList.contains('k-open')) { raf = 0; return; }
    const wrap = cv.parentElement, dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(200, wrap.clientWidth), h = Math.max(150, wrap.clientHeight);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    cv._dpr = dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const t = performance.now() / 1000;
    const mw = Math.min(w, h * 1.45), mh = mw / 1.45;
    const sea = g.createLinearGradient(0, 0, 0, h); sea.addColorStop(0, '#7FC6E8'); sea.addColorStop(1, '#4C9ED0'); g.fillStyle = sea; g.fillRect(0, 0, w, h);
    nodes = G.Scenery ? G.Scenery.japan(g, (w - mw) / 2, (h - mh) / 2, mw, mh, { t, bg: false, state: stateOf, sel, medal: i => { const r = I().rec(D.ISLANDS[i].id); return r ? r.medal | 0 : 0; } }) : [];
    raf = requestAnimationFrame(draw);
  }
  function open(cb) {
    if (!S) return false;
    if (!root) build();
    onClose = typeof cb === 'function' ? cb : null;
    sel = I().index();
    root.classList.add('k-open'); fillSide();
    if (!raf) raf = requestAnimationFrame(draw);
    api.sfx('whoosh');
    return true;
  }
  function close(silent) {
    if (!root || !root.classList.contains('k-open')) return;
    root.classList.remove('k-open'); if (coach && !silent) coachEnd();
    const f = onClose; onClose = null; if (f && silent !== true) f();
  }
  const isOpen = () => !!(root && root.classList.contains('k-open'));
  function refresh() { if (isOpen()) fillSide(); chipTick(); }

  /* ---------- tutorial guiado (3 passos) ---------- */
  const STEPS = [
    { el: () => chip, t: 'As ILHAS são o seu novo objetivo! Este botão mostra onde você está e quando dá pra viajar. Toque nele.' },
    { el: () => root && root.querySelector('.k-isl-tree'), t: 'A cada viagem você ganha Sementes Douradas. Elas NUNCA zeram: gaste aqui pra começar cada ilha mais forte.' },
    { el: () => root && root.querySelector('.k-isl-go'), t: 'Quando quiser (sem pressa!), toque em Partir. A montanha recomeça com cenário novo, e o Kome volta mais forte.' },
  ];
  function tour(done) {
    if (!S) { if (done) done(); return; }
    coach = { step: -1, done, ring: el('div', 'k-coach-ring', document.body), box: el('div', 'k-coach k-theme', document.body) };
    chipTick(); coachNext();
  }
  function coachNext() {
    if (!coach) return;
    coach.step++;
    if (coach.step === 1) open();
    if (coach.step >= STEPS.length) { coachEnd(); return; }
    const st = STEPS[coach.step];
    setTimeout(() => coachPlace(st), coach.step === 1 ? 260 : 30);
  }
  function coachPlace(st) {
    if (!coach) return;
    const e = st.el(); const r = e && e.getBoundingClientRect();
    const box = coach.box; box.innerHTML = '';
    el('div', 'k-coach-t', box, st.t);
    const row = el('div', 'k-coach-row', box);
    const sk = el('button', 'k-btn k-coach-skip', row, 'Pular'); sk.onclick = () => coachEnd();
    const nx = el('button', 'k-btn k-coach-next', row, coach.step === STEPS.length - 1 ? 'Entendi!' : 'Próximo'); nx.onclick = () => coachNext();
    el('span', 'k-coach-n', row, (coach.step + 1) + '/' + STEPS.length);
    if (r && r.width) {
      Object.assign(coach.ring.style, { display: 'block', left: (r.left - 6) + 'px', top: (r.top - 6) + 'px', width: (r.width + 12) + 'px', height: (r.height + 12) + 'px' });
      const bw = Math.min(320, innerWidth - 24), below = r.bottom + 14 + 150 < innerHeight;
      Object.assign(box.style, { width: bw + 'px', left: U.clamp(r.left + r.width / 2 - bw / 2, 12, innerWidth - bw - 12) + 'px', top: (below ? r.bottom + 14 : Math.max(12, r.top - 14 - 150)) + 'px' });
    } else { coach.ring.style.display = 'none'; Object.assign(box.style, { width: '320px', left: (innerWidth / 2 - 160) + 'px', top: '30%' }); }
    api.sfx('pling');
  }
  function coachEnd() {
    if (!coach) return;
    const c = coach; coach = null; c.ring.remove(); c.box.remove();
    if (isOpen()) close(true);
    if (c.done) c.done();
  }

  G.IslandsUI = {
    init(a) { api = a; S = G.S; setInterval(chipTick, 500); setTimeout(chipTick, 50); },
    open, close, isOpen, refresh, tour, chip: () => chip, coaching: () => !!coach,
  };
})();
