/* Kome no Japão — islands-ui.js
   Interface da VOLTA AO JAPÃO (fim de jogo), em cima de islands.js:
   - chip no topo do HUD (logo abaixo da barra da montanha): ilha atual e a próxima viagem; pulsa quando dá pra partir;
   - MAPA DAS ILHAS em tela cheia: Japão desenhado no traço do Kome (scenery.js · japan) com PARADAS grandes por cima (botões:
     fechada = cadeado, atual = Kome pulando + "você está aqui", feita = ✓ + medalha, próxima = barco dourado piscando), 3 abas
     (Ilha · Sementes · Modos) e o botão dourado "Viajar pra X" fixo no rodapé; CSS em game/ux-ilhas.css;
   - confirmação em 3 linhas (ask/askTravel): o que FICA, o que RECOMEÇA, o que você GANHA;
   - tutorial guiado (tour) depois da cutscene: anel pulsando + balão em 3 passos (chip, sementes, Partir). Pula com "Pular".
   O jogo pausa enquanto o mapa está aberto (game.js · update olha G.IslandsUI.isOpen). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data, EG = D.ENDGAME, PAL = E.PAL;
  let api = null, S = null, chip = null, root = null, cv = null, sel = -1, raf = 0, onClose = null, coach = null;
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
    if (S.ended && G.Modos && G.Modos.on()) chipH.set({ show: true, prio: 3, hot: G.Modos.chipHot(), hint: 'toque!' });
    else if (S.ended) chipH.set({ show: true, prio: 3, hot: 'Viajar pra ' + shortIsl(nx.n), hint: g > 0 ? '+' + g + (g === 1 ? ' semente' : ' sementes') : 'toque!' });
    else if (ev) chipH.set({ show: true, prio: 1.5, hot: ev.n.replace('!', ''), hint: '×' + String(ev.mult).replace('.', ',') + ' · ' + Math.ceil(I().eventLeft()) + 's' });
    else chipH.set({ show: true, prio: 0, hint: '' });
  }

  /* ---------- mapa ----------
     Tela (docs/design/ux-guia.md): cabeçalho (título, sementes, X) · frase "o que fazer agora" · mapa com PARADAS grandes
     (botões DOM em cima do desenho do Japão) · lado com 3 abas (Ilha, Sementes, Modos) que rola só na vertical (seta "tem mais")
     · rodapé fixo com o botão dourado "Viajar" (sempre à vista). O DOM só é refeito quando algo muda (fillSide). */
  const stateOf = i => {
    const cur = I().index(), r = I().rec(D.ISLANDS[i].id), lap = I().lap();
    if (i === cur) return 'here';
    if (r && r.n) return 'done';
    if (lap > 0 || i < cur) return 'done';
    return i === (cur + 1) % D.ISLANDS.length ? 'open' : 'locked';
  };
  const MED = ['', 'bronze', 'prata', 'ouro'];
  const TABS = [['ilha', 'boat', 'Ilha'], ['sem', 'star', 'Sementes'], ['modos', 'clock', 'Modos']];
  let tab = 'ilha', stopsKey = '';
  function el(tag, cls, par, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (par) par.appendChild(e); return e; }
  function ico(par, name, size) { const c = UI.iconEl ? UI.iconEl(name, size || 22) : null; if (c && par) par.appendChild(c); return c; }
  function kome(pal, pose, sc) { const c = document.createElement('canvas'); c.width = 40 * sc; c.height = 38 * sc; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; E.drawShiba(g, c.width / 2, c.height - 2, pose || 'sit', 0.5, { scale: sc, pal, shadow: false }); return c; }
  function shake(e) { e.classList.remove('ux-shake'); void e.offsetWidth; e.classList.add('ux-shake'); }
  function build() {
    root = el('div', 'k-isl k-theme');
    root.addEventListener('pointerdown', e => { if (e.target === root && !coach) close(); });   // tocar fora fecha
    const card = el('div', 'k-isl-card', root);
    const head = el('div', 'k-isl-head', card);
    ico(head, 'boat', 30);
    el('b', 'k-isl-title', head, 'Volta ao Japão');
    el('span', 'k-isl-seeds', head);
    const x = el('button', 'k-btn k-isl-x', head, '×'); x.setAttribute('aria-label', 'Fechar'); x.onclick = () => close();
    el('div', 'ux-hint k-isl-hint', card);
    const body = el('div', 'k-isl-body', card);
    const mapW = el('div', 'k-isl-map', body);
    cv = el('canvas', '', mapW);
    el('div', 'k-isl-stops', mapW);
    const side = el('div', 'k-isl-side', body);
    const tb = el('div', 'k-isl-tabs', side);
    TABS.forEach(t => { const b = el('button', 'k-btn k-isl-tab', tb); b.dataset.tab = t[0]; ico(b, t[1], 22); el('span', '', b, t[2]); el('i', 'k-isl-dotn', b); b.onclick = () => { api.sfx('click'); setTab(t[0]); }; });
    const sw = el('div', 'k-isl-scrollw', side);
    const sc = el('div', 'k-isl-scroll', sw);
    const more = el('button', 'k-isl-more', sw, '▼ tem mais'); more.setAttribute('aria-label', 'Rolar pra baixo');
    more.onclick = () => { sc.scrollBy({ top: Math.max(120, sc.clientHeight * 0.7), behavior: 'smooth' }); };
    sc.addEventListener('scroll', moreTick, { passive: true });
    el('div', 'k-isl-foot', side);
    document.body.appendChild(root);
  }
  function moreTick() { if (!root) return; const sc = root.querySelector('.k-isl-scroll'); root.querySelector('.k-isl-more').classList.toggle('on', sc.scrollTop + sc.clientHeight < sc.scrollHeight - 6); }
  function setTab(t) { if (tab === t) return; tab = t; fillSide(); root.querySelector('.k-isl-scroll').scrollTop = 0; moreTick(); }
  const seedCan = () => !(G.Modos && G.Modos.on()) && D.SEEDS.some(s => !I().capped(s) && (!s.req || I().lvl(s.req)) && Math.floor(S.stats.seeds || 0) >= I().seedCost(s));

  /* paradas: botões grandes em cima do mapa (posição = mesma conta do desenho) */
  function mapBox() { const wrap = cv.parentElement, w = Math.max(200, wrap.clientWidth), h = Math.max(150, wrap.clientHeight), mw = Math.min(w, h * 1.45) * 0.9, mh = mw / 1.45; return { w, h, mw, mh, x: (w - mw) / 2, y: (h - mh) / 2 - 4 }; }
  function placeStops() {
    const B = mapBox(), key = [B.w, B.h, sel, I().index(), I().lap(), S.ended ? 1 : 0, D.ISLANDS.map((_, i) => { const r = I().rec(D.ISLANDS[i].id); return stateOf(i)[0] + (r ? r.medal | 0 : 0); }).join('')].join('|');
    if (key === stopsKey) return; stopsKey = key;
    const box = root.querySelector('.k-isl-stops'); box.innerHTML = '';
    D.ISLANDS.forEach((isl, i) => {
      const st = stateOf(i), r = I().rec(isl.id), md = r ? r.medal | 0 : 0, mp = isl.map;
      const b = el('button', 'k-isl-stop k-s-' + st + (i === sel ? ' k-sel' : '') + (mp[1] > 0.8 ? ' k-up' : '') + (mp[0] < 0.16 ? ' k-left' : ''), box);
      b.style.left = Math.round(B.x + mp[0] * B.mw) + 'px'; b.style.top = Math.round(B.y + mp[1] * B.mh) + 'px';
      b.setAttribute('aria-label', st === 'locked' ? 'Ilha fechada' : isl.n);
      const d = el('span', 'k-isl-dot', b);
      if (st === 'done') d.textContent = '✓'; else if (st === 'open') ico(d, 'boat', 26); else if (st === 'locked') ico(d, 'lock', 22);
      if (md) el('i', 'k-isl-md k-m' + md, b).title = 'medalha de ' + MED[md];
      const l = el('span', 'k-isl-lbl', b);
      el('b', '', l, st === 'locked' ? '???' : shortIsl(isl.n));
      el('small', '', l, st === 'here' ? 'você está aqui' : st === 'open' ? (S.ended ? 'próxima: viajar!' : 'próxima') : st === 'done' ? (md ? MED[md] : 'feita') : 'fechada');
      b.onclick = () => { sel = i; tab = 'ilha'; api.sfx('paw'); fillSide(); root.querySelector('.k-isl-scroll').scrollTop = 0; moreTick(); };
    });
  }

  function fillSide() {
    const sc = root.querySelector('.k-isl-scroll'), keep = sc.scrollTop; sc.innerHTML = '';
    const modo = !!(G.Modos && G.Modos.on()), nx = I().next(), nHouse = D.HOUSE.length;
    root.querySelector('.k-isl-seeds').textContent = '★ ' + U.fmt(Math.floor(S.stats.seeds || 0)) + (Math.floor(S.stats.seeds || 0) === 1 ? ' semente' : ' sementes');
    root.querySelector('.k-isl-title').textContent = 'Volta ao Japão' + (I().lap() ? ' ' + (I().lap() + 1) : '') + (G.Faixas ? G.Faixas.title() : '') + (S.stats.legend ? ' · Lenda' : '');
    root.querySelector('.k-isl-hint').textContent = modo ? 'Você está num modo. Seu jogo normal está guardado.' : S.ended ? 'Toque em Viajar pra ir pra ' + shortIsl(nx.n) + '.' : 'Termine a casa pra liberar a viagem (' + S.house + ' de ' + nHouse + ').';
    const news = { sem: seedCan(), modos: !!(G.Modos && G.Modos.news && G.Modos.news()) };
    root.querySelectorAll('.k-isl-tab').forEach(b => { b.classList.toggle('k-on', b.dataset.tab === tab); b.classList.toggle('k-new', !!news[b.dataset.tab] && b.dataset.tab !== tab); });
    if (tab === 'sem') paneSeeds(sc); else if (tab === 'modos') paneModos(sc); else paneIlha(sc);
    // rodapé: o botão principal (dourado quando dá pra fazer; cinza diz o que falta)
    const ft = root.querySelector('.k-isl-foot'); ft.innerHTML = '';
    const go = el('button', 'ux-btn ux-main k-isl-go' + (modo || S.ended ? '' : ' ux-lock'), ft);
    ico(go, modo || S.ended ? 'boat' : 'lock', 28);
    const gt = el('span', 'k-isl-got', go);
    if (modo) { el('b', '', gt, G.Modos.chipHot() === 'Voltar pra partida' ? 'Voltar pro meu jogo' : 'Próxima ilha da Maratona'); el('small', '', gt, 'seu jogo normal está guardado'); }
    else if (S.ended) { const g = I().gain(); el('b', '', gt, 'Viajar pra ' + shortIsl(nx.n)); el('small', '', gt, 'você ganha ' + U.fmt(g) + (g === 1 ? ' semente' : ' sementes')); go.classList.add('k-glow'); }
    else { el('b', '', gt, 'Viajar pra ' + shortIsl(nx.n)); el('small', '', gt, 'falta terminar a casa (' + S.house + ' de ' + nHouse + ')'); }
    go.onclick = () => {
      if (!modo && !S.ended) { shake(go); api.sfx('click'); UI.toast('Falta terminar a casa nesta ilha', { icon: 'lock', sub: S.house + ' de ' + nHouse + ' partes prontas' }); return; }
      if (coach) coachEnd();
      I().travel();   // abre a confirmação (askTravel) por cima do mapa; "Viajar" fecha o mapa
    };
    stopsKey = ''; placeStops();
    sc.scrollTop = keep; moreTick();
  }
  function paneIlha(side) {
    const i = sel, isl = D.ISLANDS[i], st = stateOf(i), r = I().rec(isl.id), cur = I().index();
    const info = el('div', 'k-isl-info', side);
    const top = el('div', 'k-isl-top', info);
    el('div', 'k-isl-name', top, st === 'locked' ? '???' : isl.n.replace('Ilha Flutuante de ', 'Ilha de '));
    el('div', 'k-isl-tag k-isl-' + st, top, st === 'here' ? 'você está aqui' : st === 'done' ? '✓ feita' : st === 'open' ? 'próxima parada' : 'fechada');
    el('div', 'k-isl-hook', info, st === 'locked' ? 'Ilha misteriosa. Chegue na ilha anterior pra abrir.' : isl.hook);
    if (st !== 'locked') {
      // recorde compacto + metas das medalhas
      const mine = r ? r.medal | 0 : 0;
      const best = el('div', 'k-isl-best', info);
      if (r && r.best) { el('span', '', best, 'Seu melhor: '); el('b', '', best, U.fmtTime(r.best)); if (mine) { el('span', '', best, ' · '); el('b', 'k-md-m' + mine, best, MED[mine]); } }
      else best.textContent = i === cur && !S.ended ? 'Jogando agora: ' + U.fmtTime(S.time) : 'Ainda sem tempo marcado.';
      if (r && r.best && i === cur && !S.ended) el('div', 'k-isl-best', info, 'Agora: ' + U.fmtTime(S.time));
      const md = el('div', 'k-isl-medals', info);
      [['bronze', 'terminar'], ['prata', 'até ' + EG.medal.prata[i] + ' min'], ['ouro', 'até ' + EG.medal.ouro[i] + ' min']].forEach((m, k) => {
        const b = el('span', 'k-isl-medal k-m' + (k + 1) + (mine > k ? ' k-got' : ''), md); el('i', '', b); el('b', '', b, (mine > k ? '✓ ' : '') + m[0]); el('small', '', b, m[1]);
      });
      if ((isl.mods || []).length || isl.ev) {
        el('div', 'k-isl-sub', info, 'O que muda nesta ilha');
        const ul = el('ul', 'k-isl-mods', info); (isl.mods || []).forEach(m => el('li', '', ul, m));
        if (isl.ev) el('li', 'k-isl-ev', ul, 'Evento: ' + isl.ev.n + ' ' + isl.ev.sub);
      }
      const ex = D.CLOSET.filter(c => c.island === i);
      if (ex.length) {
        const row = el('div', 'k-isl-ex', info); el('span', '', row, 'Roupas só daqui:');
        ex.forEach(c => { const has = (S.closet || []).indexOf(c.id) >= 0, w = el('span', 'k-isl-exi' + (has ? ' k-got' : ''), row); w.appendChild(kome(c.kind === 'pal' ? c.id : 'kome', 'sit', 1)); el('small', '', w, c.n + (has ? ' ✓' : '')); });
      }
    }
    if (G.Faixas) G.Faixas.mapInfo(side);   // faixa da volta: a regra nova em 1 frase
    if (G.Modos && G.Modos.recInfo) G.Modos.recInfo(side, i);   // recordes desta ilha por faixa (modos.js)
    const row = el('div', 'k-isl-row', side);
    const rv = el('button', 'ux-btn k-isl-small', row); ico(rv, 'book', 20); el('span', '', rv, 'Rever a história'); rv.onclick = () => { close(); setTimeout(() => api.play('ilhas'), 150); };
    if (S.ended) { const nm = el('button', 'ux-btn k-isl-small', row); ico(nm, 'mount', 20); el('span', '', nm, 'Montanha nova aqui'); nm.onclick = () => { close(); setTimeout(() => api.pickMountain(), 150); }; }
  }
  function paneSeeds(side) {
    const sd = el('div', 'k-isl-tree', side), have = Math.floor(S.stats.seeds || 0), modo = !!(G.Modos && G.Modos.on());
    el('div', 'k-isl-sub', sd, modo ? 'No modo, as sementes ficam guardadas.' : 'Sementes nunca somem. Gaste pra ficar mais forte.');
    const grid = el('div', 'k-isl-grid', sd);
    for (const s of D.SEEDS) {
      const L = I().lvl(s.id), full = !!s.max && L >= s.max, c = I().seedCost(s), req = s.req && !I().lvl(s.req) ? D.SEEDS.find(x => x.id === s.req) : null, can = !modo && !full && !req && have >= c;
      const b = el('button', 'k-btn k-isl-seed' + (can ? ' k-can' : '') + (full ? ' k-full' : ''), grid);
      const fx = I().seedFx ? I().seedFx(s) : '';   // efeito de agora ("−41% nos preços")
      const tx = el('span', 'k-isl-seedt', b); el('b', '', tx, s.n); el('small', '', tx, s.d + (fx ? ' Agora: ' + fx + '.' : ''));
      const pp = el('span', 'k-isl-pips', tx); if (!s.max) pp.textContent = 'nível ' + L; else if (s.max > 12) pp.textContent = 'nível ' + L + ' de ' + s.max; else for (let k = 0; k < s.max; k++) el('i', k < L ? 'on' : '', pp);   // muitos níveis: texto em vez de paredão de quadradinhos
      el('span', 'k-isl-cost', b, full ? '✓ completo' : req ? 'antes: ' + req.n : can ? '★ ' + U.fmt(c) : modo ? '★ ' + U.fmt(c) : 'falta ★ ' + U.fmt(c - have));
      b.onclick = () => { if (full) return; if (!I().buy(s)) { shake(b); api.sfx('click'); } };
    }
  }
  function paneModos(side) {
    if (G.Modos && G.Modos.modesInfo) G.Modos.modesInfo(side);
    else el('div', 'k-isl-sub', side, 'Os modos ainda não abriram.');
  }
  function draw() {
    if (!root || !root.classList.contains('k-open')) { raf = 0; return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1), B = mapBox(), w = B.w, h = B.h;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; placeStops(); moreTick(); }
    cv._dpr = dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const t = performance.now() / 1000;
    const sea = g.createLinearGradient(0, 0, 0, h); sea.addColorStop(0, '#7FC6E8'); sea.addColorStop(1, '#4C9ED0'); g.fillStyle = sea; g.fillRect(0, 0, w, h);
    if (G.Scenery) G.Scenery.japan(g, B.x, B.y, B.mw, B.mh, { t, bg: false, names: false, state: stateOf, sel, medal: () => 0 });
    raf = requestAnimationFrame(draw);
  }
  function open(cb) {
    if (!S) return false;
    if (!root) build();
    onClose = typeof cb === 'function' ? cb : null;
    sel = I().index(); tab = 'ilha';
    root.classList.add('k-open'); fillSide(); root.querySelector('.k-isl-scroll').scrollTop = 0; moreTick();
    if (!raf) raf = requestAnimationFrame(draw);
    api.sfx('whoosh');
    return true;
  }
  function close(silent) {
    if (!root || !root.classList.contains('k-open')) return;
    askClose();
    root.classList.remove('k-open'); if (coach && !silent) coachEnd();
    const f = onClose; onClose = null; if (f && silent !== true) f();
  }
  const isOpen = () => !!(root && root.classList.contains('k-open'));
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (askEl) { askClose(true); e.stopImmediatePropagation(); return; }
    if (isOpen() && !coach && !document.querySelector('.k-am-dim.on')) { close(); e.stopImmediatePropagation(); }   // Esc fecha o mapa (não no tutorial nem com carta por cima)
  });
  function refresh() { if (isOpen()) fillSide(); chipTick(); }

  /* ---------- confirmação em 3 linhas (viajar, começar modo, sair do modo) ----------
     ask({title, sub, rows: [{k: 'keep'|'reset'|'gain'|'info', l: 'FICA', t: 'frase curta'}], yes, no, onYes, onNo})
     Fecha igual a tudo: X, tocar fora, Esc (= "não"). */
  let askEl = null, askNo = null;
  const GLY = { keep: '✓', reset: '↻', gain: '★', info: '!' };
  function askClose(runNo) { if (!askEl) return; const e = askEl, f = askNo; askEl = null; askNo = null; e.remove(); if (runNo && f) f(); }
  function ask(o) {
    askClose();
    const dim = askEl = el('div', 'k-ask k-theme', document.body), c = el('div', 'k-ask-card', dim);
    askNo = o.onNo || null;
    dim.addEventListener('pointerdown', e => { if (e.target === dim) askClose(true); });
    const x = el('button', 'k-btn k-isl-x', c, '×'); x.setAttribute('aria-label', 'Fechar'); x.onclick = () => askClose(true);
    const h = el('div', 'k-ask-head', c); ico(h, o.icon || 'boat', 34); el('b', '', h, o.title || 'Tem certeza?');
    if (o.sub) el('div', 'k-ask-sub', c, o.sub);
    for (const r of o.rows || []) { if (!r) continue; const row = el('div', 'k-ask-row k-ask-' + r.k, c); el('i', '', row, GLY[r.k] || '•'); const t = el('span', '', row); el('b', '', t, r.l); el('span', '', t, r.t); }
    const ft = el('div', 'k-ask-foot', c);
    const no = el('button', 'ux-btn', ft, o.no || 'Agora não'); no.onclick = () => { if (api) api.sfx('click'); askClose(true); };
    const yes = el('button', 'ux-btn ux-main', ft); ico(yes, o.yesIcon || o.icon || 'boat', 26); el('span', '', yes, o.yes || 'Sim');
    yes.onclick = () => { if (api) api.sfx('pling'); askClose(false); if (o.onYes) o.onYes(); };
    if (api) api.sfx('whoosh');
    return true;
  }
  // islands.js travel() chama: o que FICA, o que RECOMEÇA e o que você GANHA
  function askTravel(o, go) {
    const fx = o.wrap && G.Faixas ? G.Faixas.name(G.Faixas.level() + 1) : '';
    return ask({
      icon: 'boat', title: 'Viajar pra ' + shortIsl(o.to.n) + '?', sub: o.wrap ? 'Volta nova no Japão' + (fx ? ': você ganha a ' + fx + ' (1 regra nova).' : '.') : o.to.d,
      rows: [
        { k: 'keep', l: 'Fica com você', t: 'sementes, roupas, quintal e conquistas' },
        { k: 'reset', l: 'Começa de novo', t: 'montanha, máquinas, casa e dinheiro' },
        { k: 'gain', l: 'Você ganha', t: '+' + U.fmt(o.g) + (o.g === 1 ? ' Semente Dourada' : ' Sementes Douradas') + (o.patio > 0 ? ' (' + U.fmt(o.base) + ' da ilha + ' + U.fmt(o.patio) + ' do Pátio)' : '') },
      ],
      yes: 'Viajar', no: 'Ainda não', onYes: () => { close(true); go(); },
    });
  }

  /* ---------- tutorial guiado (3 passos) ---------- */
  const STEPS = [
    { el: () => chip, t: 'Este botão abre o mapa das ilhas. Toque nele.' },
    { el: () => root && root.querySelector('.k-isl-tree'), t: 'Cada viagem dá Sementes Douradas. Elas nunca somem: gaste aqui pra ficar mais forte.' },
    { el: () => root && root.querySelector('.k-isl-go'), t: 'Quando quiser, toque em Viajar. A montanha recomeça e o Kome volta mais forte.' },
  ];
  function tour(done) {
    if (!S) { if (done) done(); return; }
    coach = { step: -1, done, ring: el('div', 'k-coach-ring', document.body), box: el('div', 'k-coach k-theme', document.body) };
    chipTick(); coachNext();
  }
  function coachNext() {
    if (!coach) return;
    coach.step++;
    if (coach.step === 1) { open(); setTab('sem'); }
    if (coach.step === 2) root.querySelector('.k-isl-scroll').scrollTop = 0;
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
    open, close, isOpen, refresh, tour, ask, askTravel, askOpen: () => !!askEl, chip: () => chip, coaching: () => !!coach,
  };
})();
