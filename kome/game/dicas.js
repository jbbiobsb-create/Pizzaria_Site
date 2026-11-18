/* Kome no Japão — dicas.js
   MINI TUTORIAL DE MECÂNICA NOVA: na 1ª vez que cada coisa aparece, um cartãozinho (1–2 linhas) com anel/seta no botão ou na
   área certa. "Entendi" ou tocar em qualquer lugar fecha. Nunca pausa o jogo, uma por vez, em fila, com respiro entre elas.
   - Dicas = DADOS (tabela TIPS abaixo): id, t (título), x (texto), el() alvo (elemento ou retângulo de tela), when() = a coisa
     apareceu, ctx() = só mostra com aquela tela aberta (Pátio, Fábrica, mapa…; sem ctx = só com o jogo livre), loose = mostra
     mesmo sem alvo, skip() = já foi ensinado de outro jeito (marca vista quieta).
   - Vistas em S.stats.dicas = {id: 1} (vai no save junto com S.stats; não precisou de MIGR). Save antigo: o que já estava
     aberto nos primeiros segundos fica marcado como visto (quem já joga não leva uma enxurrada de dicas).
   - Modo acelerado (__kome.step, ?dev acelerado, navegador de teste sem ?dicas) e Ajustes › Dicas desligado: nunca mostra nem
     espera; marca vista em silêncio. Ajustes › "Rever dicas" zera as vistas.
   - Não aparece nos primeiros 35 s (plaquinha de controles), em cutscene, fim do dia, comemoração, banner, celular em pé com
     aviso de girar, nem com painel aberto (a não ser a dica daquele painel).
   API: G.Dicas.show(id) (força), demo(id) (prints/sweep), close(), reset(), seen(id), list. Demo: ?dev&dica=<id> */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const UI = E && E.UI, D = G.Data;
  const S = () => G.S;

  /* ---------- alvos ---------- */
  const vis = e => { if (!e || !e.getBoundingClientRect || !e.isConnected) return false; const r = e.getBoundingClientRect(); if (r.width < 3 || r.height < 3) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.1; };
  const q = sel => { const e = document.querySelector(sel); return vis(e) ? e : null; };
  const chip = id => (G.HUD && G.HUD.chipEl ? G.HUD.chipEl(id) : null);
  const byTxt = (sel, t) => { for (const b of document.querySelectorAll(sel)) if (b.textContent.trim().indexOf(t) === 0 && vis(b)) return b; return null; };
  const mob = () => document.body.classList.contains('k-mob');
  const swapEl = () => q(mob() ? '.k-swapfab' : '.k-swapbtn');
  const dockFirst = () => q('.k-zone-dock > .k-btn');
  // saco na tela: mundo -> tela (câmera do jogo) -> pixels do canvas
  function sackRect() {
    const s = S(), cam = G.cam, cv = document.querySelector('canvas'); if (!s || !cam || !cv || !s.sacks) return null;
    const k = s.sacks.find(o => !o.state); if (!k) return null;
    const p = cam.toScreen(k.x, k.y - 16), r = cv.getBoundingClientRect(), f = r.width / (cam.vw || 960), g = r.height / (cam.vh || 540);
    const x = r.left + p.x * f, y = r.top + p.y * g, h = Math.max(46, 40 * cam.z * f);
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
    return { left: x - h / 2, top: y - h / 2, width: h, height: h, right: x + h / 2, bottom: y + h / 2 };
  }
  const fabMax = () => { const F = D && D.FAB && D.FAB.lvl; const st = G.Fab && G.Fab.state; return !!(st && st.machines && st.machines.some(m => m.lvl >= ((F && F.max) || 10))); };
  const absurda = () => !!(G.Patio && G.Patio.unlocked && D && D.PATIO && D.PATIO.turmas.some(t => t.seed && G.Patio.unlocked(t.id)));
  const open = (o, f) => !!(o && o[f] && o[f]());

  /* ---------- a tabela ---------- */
  const TIPS = [
    { id: 'trocar', t: 'Trocar de máquina', x: () => 'Pilote qualquer máquina que você já comprou. A renda segue a da melhor, então vai de favorita.' + (mob() ? '' : ' Atalho: tecla T.'),
      el: swapEl, when: () => S().tool >= 1 && !!swapEl() },
    { id: 'combo', t: 'Combo', x: 'Cavar sem parar enche essa barra e multiplica tudo. Soltou, ela esvazia aos poucos.',
      el: () => q('.k-bar.k-digonly'), when: () => S().combo >= D.COMBO.max * 0.35 && !!q('.k-bar.k-digonly') },
    { id: 'sacos', t: 'Saco de arroz!', x: 'Toque no saco antes que ele suma: lá dentro tem uns segundos de renda (às vezes bem mais).',
      el: sackRect, when: () => !!sackRect(), wait: 0.6 },
    { id: 'arvore', t: 'Árvore do Kome', x: 'Os 3 botões de baixo são só os nós mais baratos. A árvore inteira, com sinergias, mora aqui.',
      el: () => q('.k-zone-dock [aria-label="Árvore"]'), when: () => Object.keys(S().own).length >= 2 && S().time > 60 && !!q('.k-zone-dock [aria-label="Árvore"]') },
    { id: 'vila', t: 'Vila', x: 'Dá uma olhada na Vila: casinhas, lojas e quem compra o seu arroz. Toque de novo pra voltar.',
      el: () => chip('vila'), when: () => S().time > 150 && !!chip('vila') },
    { id: 'oficina', t: 'Oficina', x: 'Campanha feita! Esse botão agora é a Oficina: deixa a sua máquina favorita mais forte, sem teto.',
      el: dockFirst, when: () => !!S().ended && !D.TOOLS[S().tool + 1] && !!dockFirst() },
    { id: 'ilhas', t: 'Volta ao Japão', x: 'Tem ilhas pra visitar. Toque aqui pro mapa e viaje quando quiser: sem pressa, nada se perde.',
      el: () => chip('ilhas'), when: () => !!chip('ilhas'), skip: () => !!S().stats.cs_ilhas },
    { id: 'sementes', t: 'Sementes Douradas', x: 'Cada viagem rende sementes que nunca zeram. Gaste no mapa das Ilhas pra começar a próxima mais forte.',
      el: () => chip('ilhas'), when: () => (S().stats.seeds | 0) > 0 && !!chip('ilhas') },
    { id: 'faixa', t: 'Faixa nova no Kome', x: 'Cada volta completa amarra uma faixa: 1 regra nova e mais sementes por viagem. O mapa mostra tudo.',
      el: () => chip('ilhas'), loose: true, when: () => !!(G.Faixas && G.Faixas.level() >= 1 && !G.Faixas.isOpen()) },
    { id: 'amuleto', t: 'Amuletos', x: 'Escolha 1 de 3 pra build desta ilha. Não curtiu? Troque as 3 com sementes. 3 da mesma etiqueta = conjunto.',
      ctx: () => open(G.AmuletosUI, 'isOpen'), el: () => byTxt('.k-am-b', 'Trocar as 3'), loose: true, when: () => open(G.AmuletosUI, 'isOpen'), at: 'top' },
    { id: 'conjunto', t: 'Sua build', x: 'Aqui ficam os amuletos da ilha. Feche 3 da mesma etiqueta pra ligar o bônus de conjunto.',
      el: () => chip('amuletos'), when: () => ((S().stats.am && S().stats.am.cur) || []).length >= 2 && !!chip('amuletos') },
    { id: 'patio', t: 'Pátio da Frota', x: 'Compre várias cópias de cada máquina: quantidade vira marco, marco vira multiplicador.',
      el: () => chip('patio'), when: () => !!chip('patio') },
    { id: 'coracao', t: 'Arroz do Coração', x: 'Cada conquista soma aqui e multiplica a frota inteira. As Tigelas abrem conforme você conquista.',
      ctx: () => !!(G.CookieUI && G.CookieUI.state && G.CookieUI.state().patio), el: () => byTxt('button', 'Arroz do Coração'), when: () => !!byTxt('button', 'Arroz do Coração') },
    { id: 'absurda', t: 'Máquina absurda!', x: 'Ela entrou no Pátio da Frota: compre cópias como as outras. A silhueta aparece no horizonte do Pátio.',
      el: () => chip('patio'), loose: true, when: () => absurda() && !open(G.Absurdas, 'isOpen') },
    { id: 'verpatio', t: 'Ver o Pátio', x: 'Passeio de câmera pela frota inteira trabalhando. Não rende nada, só orgulho.',
      el: () => chip('verpatio'), when: () => !!chip('verpatio') },
    { id: 'evento', t: 'Evento dourado!', x: 'Toque no brilho dourado pra disparar. Cada evento que você vê vai pro Livro dos Eventos, no Pátio.',
      el: () => chip('evento'), when: () => !!chip('evento'), wait: 0.6 },
    { id: 'fabrica', t: 'Fábrica KOME PACK', x: 'Seu arroz vira produto: monte a linha e ligue as esteiras. Toque aqui pra entrar.',
      el: () => chip('fabrica'), when: () => !!chip('fabrica') },
    { id: 'selo', t: 'Selo de Qualidade', x: 'Máquina no nível máximo pode tirar o Selo: volta pro Nv. 1 com 1 estrela e +50% no que faz, pra sempre.',
      ctx: () => open(G.Fab, 'isOpen'), loose: true, at: 'top', when: () => open(G.Fab, 'isOpen') && fabMax() },
    { id: 'cidade', t: 'A Cidade abriu', x: 'Atenda pedidos com seus mochis: a amizade sobe, prédios novos abrem e de vez em quando rola festival.',
      el: () => chip('cidade'), when: () => !!chip('cidade') },
    { id: 'escada', t: 'Conquistas em escada', x: 'Cada grau fechado vale +1% de renda, pra sempre e sem fim. Este chip mostra a escada mais perto de fechar.',
      el: () => chip('escada'), when: () => S().time > 200 && !!chip('escada') },
    { id: 'evolucao', t: 'Evolução!', x: 'Máquina no nível 25 da Oficina + o amuleto certo = versão absurda, ×3. As que faltam ficam no Caderno com "?".',
      el: () => (G.HUD && vis(G.HUD.homeEl) ? G.HUD.homeEl : null), loose: true,
      when: () => Object.keys((S().stats.evo && S().stats.evo.seen) || {}).length > 0 && !(G.Faixas && G.Faixas.isOpen()) },
    { id: 'carta', t: 'Carta do dia', x: 'Uma por dia, com um presentinho. Sem sequência: pulou um dia, nada se perde.',
      ctx: () => open(G.Carta, 'isOpen'), loose: true, at: 'top', when: () => open(G.Carta, 'isOpen') },
    { id: 'modos', t: 'Modos de partida', x: 'Desafio do Dia, Só na Pata e Maratona: a ilha com outra regra e recorde próprio. O permanente fica salvo.',
      ctx: () => open(G.IslandsUI, 'isOpen') && !open(G.IslandsUI, 'coaching'), el: () => byTxt('.k-md-box', 'Modos de partida'),
      when: () => open(G.IslandsUI, 'isOpen') && !!byTxt('.k-md-box', 'Modos de partida') },
  ];
  const byId = {}; for (const t of TIPS) byId[t.id] = t;

  /* ---------- quando NÃO mostrar ---------- */
  const qs = sel => document.querySelector(sel);
  function hardBusy() {
    const s = S();
    if (document.hidden || !G.HUD || !G.HUD.ready) return true;
    if (s.time < 35 || performance.now() - T0 < 8000 || qs('.k-tipcontrols')) return true;      // plaquinha de controles / intro
    if ((UI && UI.root && UI.root.__cs) || s.dayEnd > 0 || s.endOpen || document.body.classList.contains('k-night')) return true;
    if (s.cele && s.cele.t >= 0 && s.cele.t < s.cele.dur) return true;                           // comemoração de compra
    if (qs('.k-banner') || open(G.IslandsUI, 'coaching')) return true;                          // banner ou tour das ilhas
    const rot = document.getElementById('k-rot'); if (rot && getComputedStyle(rot).display !== 'none') return true;
    return false;
  }
  function panelOpen() {
    return !!(qs('.k-dim.k-show') || (G.HUD && G.HUD.treeOpen) || open(G.Home, 'isOpen') || open(G.IslandsUI, 'isOpen') || open(G.CookieUI, 'isOpen') ||
      open(G.Fab, 'isOpen') || open(G.City, 'isOpen') || open(G.AmuletosUI, 'isOpen') || open(G.Faixas, 'isOpen') || open(G.Carta, 'isOpen') ||
      open(G.Absurdas, 'isOpen') || open(G.Ofi, 'isOpen') || open(G.Topo, 'isOpen'));
  }
  const silent = () => (navigator.webdriver && !/[?&]dicas\b/.test(location.search)) || (G.devSpeed || 1) > 1 || S().opts.dicas === false;
  const seenMap = () => { const st = S().stats; if (!st.dicas || typeof st.dicas !== 'object') st.dicas = {}; return st.dicas; };
  const isSeen = id => !!seenMap()[id];
  const mark = id => { seenMap()[id] = 1; };
  const txt = t => (typeof t.x === 'function' ? t.x() : t.x);
  const safe = (f, d) => { try { return f(); } catch (e) { return d; } };

  /* ---------- fila ---------- */
  let T0 = performance.now(), vetUntil = 0, queue = [], cur = null, lastClose = 0, setup = false;
  // marca vistas em silêncio tudo que já está valendo (modo acelerado, dicas desligadas, save antigo)
  function quiet() { for (const t of TIPS) if (!isSeen(t.id) && (safe(() => t.skip && t.skip(), false) || safe(t.when, false))) mark(t.id); queue = []; }
  function tick() {
    const s = S(); if (!s || !G.HUD || !G.HUD.ready) return;
    if (!setup) {
      setup = true; settings();
      // save antigo (sem S.stats.dicas) que já jogou: o que está aberto nos primeiros segundos conta como visto
      if (!s.stats.dicas) { seenMap(); if (s.time > 120 || s.ended || (s.stats.islandsDone | 0) > 0) vetUntil = performance.now() + 4000; }
      const m = /[?&]dica=(\w+)/.exec(location.search); if (m && /[?&]dev\b/.test(location.search)) setTimeout(() => demo(m[1]), 1500);
    }
    if (cur) { follow(); return; }
    if (performance.now() < vetUntil || silent()) { quiet(); return; }
    const now = performance.now() / 1000;
    for (const t of TIPS) {
      if (isSeen(t.id)) continue;
      if (safe(() => t.skip && t.skip(), false)) { mark(t.id); continue; }
      const on = safe(t.when, false), qi = queue.findIndex(e => e.id === t.id);
      if (on && qi < 0) queue.push({ id: t.id, at: now });
      else if (!on && qi >= 0) queue.splice(qi, 1);
    }
    if (!queue.length || now - lastClose < 5 || hardBusy()) return;
    const busy = panelOpen();
    for (const e of queue) {
      const t = byId[e.id];
      if (now - e.at < (t.wait || 1.5)) continue;
      if (t.ctx ? !safe(t.ctx, false) : busy) continue;
      if (!t.loose && !rectOf(safe(t.el, null))) continue;
      show(t.id); return;
    }
  }
  function rectOf(x) { if (!x) return null; if (x.getBoundingClientRect) return vis(x) ? x.getBoundingClientRect() : null; return x.width ? x : null; }

  /* ---------- o cartão ---------- */
  function show(id, force) {
    const t = byId[id]; if (!t) return false;
    close(true);
    mark(id); queue = queue.filter(e => e.id !== id);
    const card = document.createElement('div'); card.className = 'k-dica k-theme'; card.setAttribute('role', 'status');
    const b = document.createElement('b'); b.textContent = t.t; card.appendChild(b);
    const sp = document.createElement('span'); sp.textContent = txt(t); card.appendChild(sp);
    const row = document.createElement('div'); row.className = 'k-dica-row'; card.appendChild(row);
    const sm = document.createElement('small'); sm.textContent = 'toque em qualquer lugar pra fechar'; row.appendChild(sm);
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'k-btn k-dica-ok'; ok.textContent = 'Entendi'; row.appendChild(ok);
    const ar = document.createElement('i'); ar.className = 'k-dica-arrow'; card.appendChild(ar);
    const ring = document.createElement('div'); ring.className = 'k-dica-ring';
    document.body.appendChild(ring); document.body.appendChild(card);
    ok.addEventListener('click', e => { e.stopPropagation(); close(); });
    cur = { t, card, ring, t0: performance.now(), pos: '', force: !!force };
    follow();
    requestAnimationFrame(() => { if (cur && cur.card === card) card.classList.add('k-on'); });
    if (UI && UI.sfx && UI.sound !== false) { try { UI.sfx('pling'); } catch (e) { /* sem som */ } }
    return true;
  }
  // reposiciona (o alvo pode andar: chip quente, layout do celular); só escreve no DOM se mudou. Fecha sozinho em 15 s.
  function follow() {
    if (!cur) return;
    const t = cur.t, age = (performance.now() - cur.t0) / 1000;
    if (!cur.force && (age > 15 || (t.ctx && !safe(t.ctx, false)) || (!t.ctx && age > 0.6 && panelOpen()) || hardBusyStrict())) { close(); return; }
    const r = rectOf(safe(t.el, null)), card = cur.card, vw = innerWidth, vh = innerHeight;
    const bw = card.offsetWidth || 300, bh = card.offsetHeight || 110;
    let left, top, cls = '', ax = bw / 2, ring = null;
    if (r) {
      // lugares possíveis: embaixo, em cima, à esquerda, à direita do alvo; fica o que cabe sem tapar CAVAR/joystick/o próprio alvo
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, cl = (v, a, b) => Math.max(a, Math.min(b, v));
      const hx = cl(cx - bw / 2, 12, vw - bw - 12), vy = cl(cy - bh / 2, 8, vh - bh - 8);
      const C = [[hx, r.bottom + 16, 'k-up'], [hx, r.top - 16 - bh, 'k-down'], [r.left - 16 - bw, vy, 'k-left'], [r.right + 16, vy, 'k-right']];
      const avoid = [r]; for (const sel of ['.k-dig', '.k-joy']) { const e = q(sel); if (e) avoid.push(e.getBoundingClientRect()); }
      const cost = ([x, y]) => { if (x < 6 || y < 4 || x + bw > vw - 6 || y + bh > vh - 4) return 1e9; let o = 0; for (const a of avoid) o += Math.max(0, Math.min(x + bw, a.right) - Math.max(x, a.left)) * Math.max(0, Math.min(y + bh, a.bottom) - Math.max(y, a.top)); return o; };
      let best = C[0], bc = Infinity; for (const c of C) { const k = cost(c); if (k < bc) { bc = k; best = c; } if (!k) break; }
      if (bc >= 1e9) best = [hx, cl(r.bottom + 16, 8, vh - bh - 8), 'k-up'];
      [left, top, cls] = best;
      ax = cls === 'k-left' || cls === 'k-right' ? cl(cy - top, 20, bh - 20) : cl(cx - left, 20, bw - 20);
      ring = [r.left - 6, r.top - 6, r.width + 12, r.height + 12].map(Math.round);
    } else { left = (vw - bw) / 2; top = t.at === 'top' ? 10 : Math.round(vh * 0.3); }
    const pos = [Math.round(left), Math.round(top), cls, Math.round(ax), ring ? ring.join(',') : ''].join('|');
    if (pos === cur.pos) return; cur.pos = pos;
    card.style.left = Math.round(left) + 'px'; card.style.top = Math.round(top) + 'px';
    for (const k of ['k-up', 'k-down', 'k-left', 'k-right']) card.classList.toggle(k, cls === k);
    card.style.setProperty('--k-ax', Math.round(ax) + 'px');
    const rs = cur.ring.style;
    if (ring) { rs.display = 'block'; rs.left = ring[0] + 'px'; rs.top = ring[1] + 'px'; rs.width = ring[2] + 'px'; rs.height = ring[3] + 'px'; } else rs.display = 'none';
  }
  // enquanto aberta, só fecha por cutscene/fim do dia/comemoração (banner e tempo de jogo não contam)
  function hardBusyStrict() { const s = S(); return !!((UI && UI.root && UI.root.__cs) || s.dayEnd > 0 || s.endOpen || document.body.classList.contains('k-night')); }
  function close(instant) {
    if (!cur) return;
    const c = cur; cur = null; lastClose = performance.now() / 1000;
    c.ring.remove();
    if (instant) c.card.remove(); else { c.card.classList.remove('k-on'); setTimeout(() => c.card.remove(), 260); }
  }
  // tocar em qualquer lugar fecha (o toque segue pro jogo: o botão apontado já funciona no mesmo toque)
  document.addEventListener('pointerdown', e => { if (cur && performance.now() - cur.t0 > 350 && !cur.card.contains(e.target)) close(); }, true);
  document.addEventListener('keydown', e => { if (cur && e.key === 'Escape') close(); });

  /* ---------- Ajustes: ligar/desligar + rever ---------- */
  function settings() {
    const aj = G.HUD && G.HUD.settings; if (!aj || !aj.body || !UI) return;
    const box = document.createElement('div'); box.className = 'k-dica-aj';
    const jogo = [...aj.body.querySelectorAll('.k-h')].find(h => h.textContent === 'Salvar');
    aj.body.insertBefore(box, jogo || null);
    UI.toggle(box, { icon: 'book', label: 'Dicas de mecânica nova', sub: 'um cartãozinho na 1ª vez que algo aparece', value: S().opts.dicas !== false,
      onChange: v => { S().opts.dicas = !!v; if (!v) close(); } });
    const r = UI.el('div', 'k-row', box); r.style.padding = '2px 0 8px';
    UI.button(r, { title: 'Rever dicas', size: 'sm', onClick: () => {
      S().stats.dicas = {}; S().opts.dicas = true; queue = []; lastClose = 0;
      UI.toast('As dicas voltam a aparecer', { icon: 'book', sub: 'conforme cada coisa estiver na tela' });
    } });
  }

  /* ---------- demo e modo acelerado ---------- */
  function demo(id, ms) {
    const t = byId[id] || TIPS[0];
    if (t.id === 'trocar' && S() && S().tool < 1 && window.__kome) { __kome.addMoney(1e6); __kome.buyTool(); }
    setTimeout(() => show(t.id, true), ms == null ? 600 : ms);
  }
  function wrapStep() {
    const K = window.__kome; if (!K || !K.step || K.step._dicas) return !!K;
    const st = K.step; K.step = function () { const r = st.apply(this, arguments); if (S()) { if (cur && !cur.force) close(true); quiet(); } return r; }; K.step._dicas = 1;
    return true;
  }
  if (!wrapStep()) setTimeout(wrapStep, 0);
  setInterval(() => { try { tick(); } catch (e) { console.warn('[kome] dicas', e); } }, 500);

  G.Dicas = { show: id => show(id, true), demo, close: () => close(true), reset: () => { if (S()) S().stats.dicas = {}; }, seen: id => isSeen(id), list: TIPS, queue: () => queue.map(e => e.id) };
})();
