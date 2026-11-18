/* Kome no Japão — game-ui.js
   HUD em DOM (E.UI) no layout do GDD §11: iene, ¥/s com sparkline, combo, montanha, panfleto da casa, botão da próxima
   ferramenta, 3 compras rápidas, Árvore e Ajustes. Lê o estado por G.S e age pela API passada em init(api).
   Ponto de extensão (Fase 2): G.HUD.zones (tl, tc, tr, mr, dock) pra pendurar missões, caderno e medidores. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data, PAL = E.PAL;
  const HUD = (G.HUD = { ready: false, zones: {} });
  let swapFab = null, swapOn = false, swapId = '', swapT = 0, swapPos = '';
  let api, S, ui, swapBtn, swapPanel, yenPill, rate, combo, mount, flyer, toolBtn, slots = [], hornBtn, treeBtn, treePanel, tree, aj, slotNodes = [];
  let acc = 0, sampleT = 0, lastComboTone = '';

  const yen = v => '¥ ' + U.fmt(Math.ceil(v));

  /* ---- AVISOS: UMA fila só pra toast E banner, num slot fixo pequeno no topo (1 linha + sublinha), um por vez ----
     · mesmo tipo de aviso já na fila = troca o texto (não empilha); repetido em < 6 s = descartado ("Faltam ¥" 1× a cada 5 s)
     · conversa fiada (buzina, corvos, bônus de combo...) cai fora no modo "Poucos" (padrão no celular) e espera 8 s no "Normal"
     · banner grande (level 3 = máquina nova, casa, final, ilha) vira uma faixa compacta no MESMO slot, ~1,2 s
     · resposta a toque (Faltam/Precisa/fechado) passa na frente; o resto espera 1,5 s entre um e outro */
  const NOTE = (function () {
    if (!UI || !UI.toast) return null;
    const CHAT = /^(FOOO|FÚRIA|DESLIZAMENTO|BOLSÃO|SACO LENDÁRIO|Onigiri|Troca de lugar|MORDIDA|kin|Combo|Núcleo Vivo)/i;
    const RESP = /^(Faltam?|Precisa|Só na Pata)|está fechado$/i;
    const q = []; const seen = Object.create(null);
    let el = null, busy = false, lastEnd = 0, timer = 0, lastIn = performance.now();
    addEventListener('pointerdown', () => { lastIn = performance.now(); }, true);
    addEventListener('keydown', () => { lastIn = performance.now(); }, true);
    const mob = () => document.body.classList.contains('k-mob');
    const few = () => { const o = (G.S && G.S.opts) || {}; return (o.avisos || (mob() ? 'poucos' : 'normal')) === 'poucos'; };
    const keyOf = t => /^Falta/i.test(t) ? 'falta' : String(t).replace(/[\d.,¥%+×\s]+/g, '').slice(0, 18).toLowerCase();
    function slot() {
      const R = UI.root || document.body;
      if (!el || el.parentNode !== R) { el = el || document.createElement('div'); el.className = 'ux-note'; el.setAttribute('aria-live', 'polite'); R.appendChild(el); }
      return el;
    }
    function next() {
      if (busy || !q.length) return;
      const wait = q[0].resp ? 120 : 1500 - (performance.now() - lastEnd);
      if (wait > 0) { clearTimeout(timer); timer = setTimeout(next, wait); return; }
      busy = true;
      const n = q.shift(), e = slot();
      e.className = 'ux-note' + (n.big ? ' ux-note-big' : '') + (n.tone ? ' ux-note-' + n.tone : '');
      e.textContent = '';
      const ic = n.icon && UI.iconEl ? UI.iconEl(n.icon, n.big ? 26 : 20) : null; if (ic) e.appendChild(ic);
      const tx = document.createElement('span'); tx.className = 'ux-note-t';
      const b = document.createElement('b'); b.textContent = n.text; tx.appendChild(b);
      if (n.sub) { const sm = document.createElement('small'); sm.textContent = n.sub; tx.appendChild(sm); }
      e.appendChild(tx);
      void e.offsetWidth; e.classList.add('ux-note-in');
      if (n.sound && UI.sfx) { try { UI.sfx(n.sound); } catch (er) { /* */ } }
      setTimeout(() => {
        e.classList.remove('ux-note-in');
        setTimeout(() => { busy = false; lastEnd = performance.now(); if (n.onDone) { try { n.onDone(); } catch (er) { /* */ } } next(); }, 220);
      }, n.dur * 1000);
    }
    function push(n) {
      const S0 = G.S, now = performance.now();
      if (/^Cave a montanha/i.test(n.text)) {   // dica de cavar: só no 1º minuto de um jogo novo ou depois de 20 s parado
        const digging = !!document.querySelector('.k-dig.on, .k-dig.k-dig-lock');
        if (digging || !(S0 && S0.time < 60) && now - lastIn < 20000) return;
      }
      n.chat = !n.big && CHAT.test(n.text); n.resp = RESP.test(n.text);
      if (n.chat && few()) return;
      const k = n.key = keyOf(n.text), gap = k === 'falta' ? 5000 : n.chat ? 8000 : 6000;
      const inQ = q.find(x => x.key === k);
      if (inQ) { Object.assign(inQ, n); return; }                     // mesmo tipo esperando: só atualiza o texto
      if (seen[k] && now - seen[k] < gap) return;
      seen[k] = now;
      n.dur = n.big ? (mob() ? 1.2 : 1.6) : Math.max(1.6, Math.min(n.resp ? 2 : 3.2, n.dur || 2.2));
      if (n.resp) q.unshift(n); else q.push(n);
      while (q.length > 3) { const i = q.findIndex(x => !x.big); q.splice(i >= 0 ? i : 0, 1); }   // fila curta: o miúdo mais velho sai
      next();
    }
    UI.toast = (text, o) => { o = o || {}; push({ text, sub: o.sub, icon: o.icon, tone: o.tone, dur: o.dur }); };
    UI.banner = (text, sub, o) => { o = o || {}; const lv = o.level || 2;
      push({ text, sub, icon: o.icon, tone: o.tone || (lv >= 3 ? 'gold' : ''), dur: o.dur || 1.5, big: lv >= 3, sound: lv >= 3 ? (o.sound || 'fanfare') : o.sound, onDone: o.onDone }); };
    return { push, clear() { q.length = 0; } };
  })();
  HUD.note = NOTE;

  /* ---- FILEIRA DE CHIPS (logo abaixo da barra da montanha): Vila, Fábrica, Tatuzão, Ilhas... tudo que é "atalho pra outro
     lugar" entra aqui por G.HUD.chip({id, icon, label, order, tone, onClick}) -> {el, set({label, hot, hint, prio, show, icon, tone})}.
     Chip = ícone + nome curto (44 px de toque). Só UM chip por vez (o de maior prio > 0 e com hint) abre o texto de detalhe e
     pulsa; os outros com prio > 0 ganham só uma bolinha dourada. Quebra em até 2 linhas e nunca entra no iene nem na casa.
     Celular: UMA linha só; o detalhe vira balão embaixo do chip quente; set({tip, act}) = cartão de toque (preço/detalhe + botão). */
  if (UI && UI.defineIcon) {
    UI.defineIcon('mount', (P, C) => { P.poly([[0, 14], [6, 3], [10, 9], [12, 6], [16, 14]], C.gold || '#E0B040').poly([[4, 7], [6, 3], [8, 6]], '#FFF8EC').rect(0, 14, 16, 2, '#7A5034'); });
    UI.defineIcon('factory', (P, C) => { P.rect(11, 1, 3, 7, '#8A5A44').rect(1, 8, 14, 7, C.red || '#C8423A').poly([[1, 8], [5, 5], [5, 8], [9, 5], [9, 8]], C.red || '#C8423A').rect(3, 10, 2, 2, '#FFF3B0').rect(7, 10, 2, 2, '#FFF3B0').rect(11, 10, 2, 5, '#5A3A28'); });
    UI.defineIcon('more', (P) => { P.rect(1, 6, 4, 4, '#3B2818').rect(6, 6, 4, 4, '#3B2818').rect(11, 6, 4, 4, '#3B2818').rect(2, 7, 2, 1, '#8A6A50').rect(7, 7, 2, 1, '#8A6A50').rect(12, 7, 2, 1, '#8A6A50'); });
    UI.defineIcon('drill', (P, C) => { P.rect(1, 5, 8, 7, '#C9D2DA').rect(1, 7, 8, 1, '#8794A0').poly([[9, 3], [15, 8], [9, 13]], C.gold || '#E0B040').rect(11, 6, 1, 5, '#9A6A20').rect(2, 12, 2, 2, '#5A3A28').rect(6, 12, 2, 2, '#5A3A28'); });
  }
  const chips = []; let chipRow = null, chipFitT = 0;
  /* chips SECUNDÁRIOS (atalho pra tela que não pede ação agora): com 2+ ligados eles vão pra gaveta "Mais" (um chip só);
     o secundário QUENTE (o de maior prio com hint) continua na fileira pra o aviso não sumir. HUD.chipEl(id) = o elemento
     que está na tela pra esse chip (ele mesmo ou o "Mais"), pra dica apontar. */
  let more = null, moreBox = null, moreSig = '', moreT = 0, chipDemo = false;
  function moreClose() { if (moreBox && moreBox.classList.contains('k-open')) { moreBox.classList.remove('k-open'); document.body.classList.remove('k-moreopen'); clearTimeout(moreT); } }
  function moreOpen() {
    if (!moreBox || !more) return;
    if (moreBox.classList.contains('k-open')) { moreClose(); return; }
    chipPopClose(); moreBox.classList.add('k-open'); document.body.classList.add('k-moreopen');
    const e = more.el, Z = moreBox.parentNode, x = chipRow.offsetLeft + e.offsetLeft + e.offsetWidth / 2, half = moreBox.offsetWidth / 2;
    const zl = Z.getBoundingClientRect().left, k = Z.getBoundingClientRect().width / (Z.offsetWidth || 1) || 1;   // não sai da tela
    moreBox.style.left = Math.round(Math.max(8 - zl / k, Math.min(innerWidth / k - zl / k - 8 - 2 * half, x - half))) + 'px'; moreBox.style.top = Math.round(chipRow.offsetTop + e.offsetTop + e.offsetHeight + 8) + 'px';
    clearTimeout(moreT); moreT = setTimeout(moreClose, 9000);
  }
  document.addEventListener('pointerdown', e => { if (moreBox && moreBox.classList.contains('k-open') && !moreBox.contains(e.target) && !(more && more.el.contains(e.target))) moreClose(); }, true);
  function chipFit() {   // largura máxima: do fim do iene/¥-s até o começo do cartão da casa, medido na tela (vale pra celular)
    if (!chipRow || !yenPill) return;
    const pr = chipRow.parentNode.getBoundingClientRect(), k = pr.width / (chipRow.parentNode.offsetWidth || 1) || 1, cx = pr.left + pr.width / 2;
    let l = 0, r = window.innerWidth;
    for (const e of [yenPill.el || yenPill, rate && (rate.el || rate)]) if (e && e.getBoundingClientRect) { const b = e.getBoundingClientRect(); if (b.width) l = Math.max(l, b.right); }
    const fe = flyer && (flyer.el || flyer); if (fe && fe.getBoundingClientRect) { const b = fe.getBoundingClientRect(); if (b.width && b.left > cx) r = b.left; }
    const w = Math.max(200, Math.floor(2 * Math.min(cx - l, r - cx) / k) - 20);
    if (chipRow._w !== w) { chipRow._w = w; chipRow.style.maxWidth = w + 'px'; }
  }
  /* FILEIRA = SÓ ALERTAS (rodada de UX): quem tem novidade (prio > 0) ou relógio correndo (ALWAYS). Atalho parado não mora
     mais aqui: toda função fica nos hubs da barra de navegação (Comprar · Lugares · Viagem · Mais). No máx. 3 chips, 1 linha. */
  const ALWAYS = { modo: 1, sementes: 1 };
  let chipToldId = '';
  const navTabName = id => { const g = GROUP[id] || 'lugares', n = NAV.find(x => x.id === g); return n ? n.t : ''; };
  function chipLayout() {
    const isOn = c => c !== more && (c.on || chipDemo);
    const mob = document.body.classList.contains('k-mob');
    const rw = mob && innerHeight > innerWidth ? innerWidth - 24 : (chipRow && chipRow._w) || 400;
    const cap = Math.max(1, Math.min(3, Math.floor(rw / 140)));
    const al = chips.filter(c => isOn(c) && (c.prio > 0 || ALWAYS[c.id] || chipDemo)).sort((x, y) => (ALWAYS[y.id] ? 99 : y.prio) - (ALWAYS[x.id] ? 99 : x.prio)).slice(0, cap);
    let top = null;
    for (const c of al) if (c.prio > 0 && c.hint && (!top || c.prio > top.prio)) top = c;
    if (more && more.el.style.display !== 'none') more.el.style.display = 'none';
    // celular: a fileira de chips não aparece (o centro fica livre); a novidade vira bolinha na aba + UM aviso pequeno
    if (top && mob && !chipDemo && top.id !== chipToldId) { chipToldId = top.id; const tn = navTabName(top.id); UI.toast(top.label + (top.hot ? ': ' + top.hot : ''), { icon: 'star', tone: 'gold', sub: tn ? 'veja na aba ' + tn : top.hint }); }
    else if (!top) chipToldId = '';
    for (const c of chips) {
      if (c === more) continue;
      const hot = c === top, e = c.el, on = al.indexOf(c) >= 0;
      c.fold = false;
      if (e.style.display !== (on ? '' : 'none')) e.style.display = on ? '' : 'none';
      e.classList.toggle('k-chip-hot', hot); e.classList.toggle('k-pulse', hot);
      e.classList.toggle('k-chip-dot', !hot && on && c.prio > 0);
      // celular: o detalhe do chip quente vira balãozinho embaixo dele (game.css .k-mob)
      const lb = hot && c.hot && !mob ? c.hot : c.label;
      const hi = !hot ? '' : mob ? (c.hot ? c.hot + ' · ' : '') + c.hint : '· ' + c.hint;
      if (c.b.textContent !== lb) c.b.textContent = lb;
      if (c.sm.textContent !== hi) c.sm.textContent = hi;
      const tn = hot ? '' : (c.tone || ''); if (e.style.background !== tn) e.style.background = tn;
    }
    chipFit(); navDots();
  }
  // toque (celular): chip com tip (preço, detalhe que no PC fica no hover) abre um cartãozinho com o texto e o botão da ação
  let chipPop = null;
  function chipPopClose() { if (chipPop) { chipPop.el.remove(); clearTimeout(chipPop.t); chipPop = null; } }
  function chipPopOpen(c, o) {
    chipPopClose();
    const p = document.createElement('div'); p.className = 'k-chip-pop';
    const s = document.createElement('span'); s.textContent = c.tip; p.appendChild(s);
    const a = document.createElement('button'); a.className = 'k-btn k-chip-go'; a.textContent = c.act || 'Abrir'; p.appendChild(a);
    a.addEventListener('click', e => { e.stopPropagation(); chipPopClose(); if (o.onClick) o.onClick(e); });
    p.addEventListener('pointerdown', e => e.stopPropagation());
    chipRow.appendChild(p);
    const cx = c.el.offsetLeft + c.el.offsetWidth / 2, half = p.offsetWidth / 2, rw = chipRow.offsetWidth;
    p.style.left = Math.round(Math.max(half - 40, Math.min(rw - half + 40, cx)) - half) + 'px'; p.style.top = (c.el.offsetTop + c.el.offsetHeight + 8) + 'px';
    p.style.setProperty('--k-tail', Math.round(cx - parseFloat(p.style.left)) + 'px');
    chipPop = { el: p, c, t: setTimeout(chipPopClose, 6000) };
  }
  document.addEventListener('pointerdown', e => { if (chipPop && !chipPop.el.contains(e.target) && !chipPop.c.el.contains(e.target)) chipPopClose(); }, true);
  HUD.chip = function (o) {
    const Z = HUD.zones.tc; if (!Z || !UI) return null;
    if (!chipRow) {
      chipRow = document.createElement('div'); chipRow.className = 'k-chips'; Z.appendChild(chipRow); window.addEventListener('resize', () => setTimeout(chipFit, 60));
      moreBox = document.createElement('div'); moreBox.className = 'k-chip-more'; Z.appendChild(moreBox);
      moreBox.addEventListener('pointerdown', e => e.stopPropagation());
      more = HUD.chip({ id: 'mais', icon: 'more', label: 'Mais', order: 999, tone: '#F2EBDD', show: false, onClick: () => moreOpen() });
    }
    const b = document.createElement('button'); b.className = 'k-btn k-chip'; b.setAttribute('data-chip', o.id);
    b.innerHTML = '<span class="k-chip-i"></span><b></b><small></small>';
    const c = { id: o.id, el: b, b: b.querySelector('b'), sm: b.querySelector('small'), ic: b.querySelector('.k-chip-i'), label: o.label || '', hot: '', hint: '', prio: 0, on: o.show !== false, tone: o.tone || '', order: o.order || 0, icon: null, click: o.onClick || null };
    c.set = function (p) {
      // chips são atualizados por vários relógios (300–700 ms): sem mudança, não refaz o layout (chipFit mede a tela = layout forçado)
      const sig0 = c.label + '|' + c.hot + '|' + c.hint + '|' + c.prio + '|' + c.on + '|' + c.tone + '|' + c.icon;
      if (p.icon !== undefined && p.icon !== c.icon) { c.icon = p.icon; c.ic.textContent = ''; const i = UI.iconEl ? UI.iconEl(p.icon, 20) : null; if (i) c.ic.appendChild(i); }
      if (p.label !== undefined) c.label = p.label; if (p.hot !== undefined) c.hot = p.hot;
      if (p.hint !== undefined) c.hint = p.hint || ''; if (p.prio !== undefined) c.prio = +p.prio || 0;
      if (p.show !== undefined) c.on = !!p.show; if (p.tone !== undefined) c.tone = p.tone;
      if (p.tip !== undefined) { c.tip = p.tip || ''; if (chipPop && chipPop.c === c) chipPop.el.firstChild.textContent = c.tip; }
      if (p.act !== undefined) c.act = p.act;
      if (!c.on && chipPop && chipPop.c === c) chipPopClose();
      const sig1 = c.label + '|' + c.hot + '|' + c.hint + '|' + c.prio + '|' + c.on + '|' + c.tone + '|' + c.icon, now = performance.now();
      if (sig1 !== sig0 || c.isNew) { c.isNew = false; chipLayout(); chipFitT = now; }
      else if (now - chipFitT > 2000) { chipFitT = now; chipFit(); }   // iene cresceu? a largura da fileira acompanha de vez em quando
      return c;
    };
    c.isNew = true;
    b.addEventListener('click', e => {
      e.stopPropagation(); b.blur();
      const open = chipPop && chipPop.c === c; chipPopClose();
      if (c.fold) { moreClose(); if (o.onClick) o.onClick(e); return; }   // dentro da gaveta "Mais": age direto
      if (c.tip && !b.classList.contains('k-chip-hot') && document.body.classList.contains('k-mob')) { if (!open) chipPopOpen(c, o); return; }   // toque: 1º mostra, botão age
      if (o.onClick) o.onClick(e);
    });
    let at = null; for (const q of chips) if (q.order > c.order) { at = q; break; }
    chips.splice(at ? chips.indexOf(at) : chips.length, 0, c);
    let ref = null; for (let i = chips.indexOf(c) + 1; i < chips.length; i++) if (chips[i].el.parentNode === chipRow) { ref = chips[i].el; break; }
    chipRow.insertBefore(b, ref); moreSig = '-';   // recalcula a gaveta com o chip novo
    return c.set({ icon: o.icon || 'star' });
  };
  // HUD.chipEl(id): o que está na tela pra esse chip (ele, ou o "Mais" se está na gaveta); null se apagado
  HUD.chipEl = function (id) {
    const c = chips.find(q => q.id === id && (q.on || chipDemo));
    if (!c) return null;
    if (c.el.style.display !== 'none' && c.el.offsetParent) return c.el;
    const t = navTabs[GROUP[id] || 'lugares']; return t ? t.el : null;   // chip sem alerta mora no hub: a dica aponta a aba
  };
  // prints/sweep: liga todos os chips (fileira cheia) e abre a gaveta
  HUD.chipDemo = function (on) { chipDemo = on !== false; chipLayout(); };
  function icon(id) { return G.Props ? G.Props.icon(id) : 'paw'; }


  // init(api): monta o HUD. api = {stage, buyTool, buyNode, buyHouse, horn, nodeState, exportStr, importStr, reset, setOpt}
  // lane(out): faixa livre AO LADO do iene (entre o iene e a barra da montanha), em coords do palco: é onde os "+¥" grandes sobem
  HUD.lane = function (out) {
    if (!yenPill || !mount || !api) return null;
    const cv = api.stage && api.stage.cv, ye = yenPill.el || yenPill, me = mount.el || mount, re = rate && (rate.el || rate);
    if (!cv || !ye.getBoundingClientRect || !me.getBoundingClientRect) return null;
    const c = cv.getBoundingClientRect(), y = ye.getBoundingClientRect(), m = me.getBoundingClientRect(), k = cv.width / (api.stage.dpr || 1) / (c.width || 1);
    if (!y.width || !m.width) return null;
    const r = re && re.getBoundingClientRect ? re.getBoundingClientRect() : y;
    out.x0 = (Math.max(y.right, r.right) + 8 - c.left) * k; out.x1 = (m.left - 8 - c.left) * k; out.y = (y.bottom - 4 - c.top) * k;
    if (out.x1 - out.x0 < 230) {   // celular: ao lado do iene não cabe (o "kin!" caía e a letra encolhia): faixa larga centrada embaixo dos chips
      let bot = m.bottom;
      if (chipRow && chipRow.offsetHeight) { bot = Math.max(bot, chipRow.getBoundingClientRect().bottom - 10); for (const q of chips) if (q.on && q.el.classList.contains('k-chip-hot') && q.sm.offsetWidth) bot = Math.max(bot, q.sm.getBoundingClientRect().bottom); }
      const cx = (m.left + m.right) / 2;
      out.x0 = (cx - c.left) * k - 200; out.x1 = (cx - c.left) * k + 200; out.y = (bot - c.top) * k + 52;
    }
    return out.x1 - out.x0 > 110 ? out : null;
  };
  HUD.init = function (a) {
    api = a; S = G.S;
    if (!UI) return;
    try { if (UI.loadFont && !/nofont/.test(location.search)) UI.loadFont(); } catch (e) { /* offline */ }
    ui = UI.mount(api.stage);
    const Z = HUD.zones; ['tl', 'tc', 'tr', 'mr', 'dock'].forEach(k => { Z[k] = ui.zone(k); });

    yenPill = UI.pill(Z.tl, { id: 'yen', icon: 'yen', big: true, value: S.money });
    rate = UI.rate(Z.tl, { icon: 'rice', label: '¥/s', every: 8, lines: [
      () => 'recorde: ¥' + U.fmt(S.stats.bestIps) + '/s',
      () => U.fmt(S.dug * 40) + ' grãos cavados',
      () => 'tempo: ' + U.fmtTime(S.time) ] });
    combo = UI.bar(Z.tl, { size: 'sm', label: 'combo', value: '×1,00', endowed: 0.1 });
    (combo.el || combo).classList.add('k-digonly');

    mount = UI.goal(Z.tc, { label: 'Montanha', w: 250, pct: true, done: 'acabou!', endowed: 0.12,
      ticks: [{ at: 0.06, color: PAL.pressD }, { at: 0.23, color: PAL.sakuraD || PAL.pink }, { at: 0.8, color: PAL.gold }] });

    flyer = UI.flyer(Z.tr, { art: 'house', title: 'Casa', sub: '', progress: 0, onClick: () => { const h = D.HOUSE[S.house]; if ((!h || S.tool + 1 < h.tier || S.money < api.houseCost(h)) && api.openHome && api.openHome('casa')) return; api.buyHouse(); } });   // não dá pra pagar: abre a escada da casa
    UI.tooltip(flyer, () => { const h = D.HOUSE[S.house]; return h ? '<b>' + h.n + '</b><br>' + h.draw + (S.tool + 1 < h.tier ? '<br>precisa: ' + D.TOOLS[h.tier - 1].name : '') : 'A casa está pronta!'; });

    toolBtn = UI.button(Z.dock, { icon: icon('hashi'), iconSize: 36, title: '…', sub: '', w: 218, progress: 0, cls: 'k-toolbtn', onClick: () => (!D.TOOLS[S.tool + 1] && S.ended && G.Inf) ? G.Inf.open() : gain(() => api.buyTool()) });
    UI.tooltip(toolBtn, () => { const t = D.TOOLS[S.tool + 1]; return t ? '<b>Próxima ferramenta: ' + t.name + '</b><br>' + t.act + '<br>' + t.size : 'Você tem a maior máquina do mundo.'; });
    for (let i = 0; i < 3; i++) slots.push(UI.button(Z.dock, { icon: 'paw', iconSize: 26, title: '…', sub: '', w: 150, progress: 0, cls: 'k-slot k-slot' + (i + 1), onClick: () => quickBuy(i) }));
    slots.forEach((s, i) => UI.tooltip(s, () => { const n = slotNodes[i]; return n ? '<b>' + n.n + '</b><br>' + n.desc + '<br><i>' + n.see + '</i>' : ''; }));
    UI.spacer(Z.dock);
    hornBtn = UI.button(Z.dock, { icon: 'horn', tone: 'red', onClick: () => api.horn() });
    hornBtn.el.style.display = 'none';
    // TROCAR DE MÁQUINA: botão grande com o ícone da máquina que você está pilotando + setinhas de troca.
    // PC: na barra de baixo, antes da Árvore (tecla T). Celular: redondo, colado no CAVAR (em cima dele deitado, ao lado em pé).
    swapBtn = UI.button(Z.dock, { icon: icon('hashi'), iconSize: 34, cls: 'k-swapbtn', title: 'Trocar', sub: 'máquina', label: 'Trocar de máquina', onClick: () => openSwap() });
    UI.el('span', 'k-swap-mark', swapBtn.el).appendChild(UI.iconEl('swap', 18));
    UI.tooltip(swapBtn, () => '<b>Trocar de máquina</b> (tecla T)<br>jogando com: ' + swapName() + '<br>pilote qualquer uma que você já comprou');
    swapFab = UI.button(ui.hud, { icon: icon('hashi'), iconSize: 30, cls: 'k-swapfab', vertical: true, title: 'Trocar', label: 'Trocar de máquina', onClick: () => openSwap() });
    UI.el('span', 'k-swap-mark', swapFab.el).appendChild(UI.iconEl('swap', 16));
    swapBtn.el.style.display = swapFab.el.style.display = 'none';
    addEventListener('resize', () => setTimeout(swapPlace, 120));
    document.addEventListener('keydown', e => {
      if ((e.key !== 't' && e.key !== 'T') || e.ctrlKey || e.metaKey || e.altKey || e.repeat || !swapOn) return;
      const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
      if (swapPanel && swapPanel.isOpen) { swapPanel.close(); return; }
      if (document.querySelector('.k-dim.k-show') || (G.Home && G.Home.isOpen())) return;
      openSwap();
    });
    // NAVEGAÇÃO FIXA (rodada de UX): 4 abas grandes de ícone + palavra na barra de baixo; cada uma abre um hub de tela cheia
    navBuild(Z.dock);
    HUD.homeEl = navTabs.lugares.el;
    HUD.homeBadge = n => { homeN = n ? 1 : 0; navDots(); };

    // Árvore (escada), Ajustes e Trocar moram em game/menu-ui.js (G.MenuUI)
    const MU = G.MenuUI.init(api);
    tree = MU.tree; treePanel = MU.treePanel; aj = MU.settings;
    HUD.tree = tree; HUD.treePanel = treePanel; HUD.settings = aj;
    HUD.refreshCloset = () => {};   // o guarda-roupa mora na Casa › Roupas

    // tela baixa: a missão é uma pílula (ícone + "0 de 1"); 1º toque abre o nome por 4 s, o 2º faz a ação (Pegar! age direto)
    document.addEventListener('click', e => {
      const m = e.target.closest && e.target.closest('.ux-mis'); if (!m || innerHeight > 420 || m.classList.contains('ux-mis-ok')) return;
      if (!m.classList.contains('ux-mis-open')) { e.stopPropagation(); e.preventDefault(); m.classList.add('ux-mis-open'); clearTimeout(m._t); m._t = setTimeout(() => m.classList.remove('ux-mis-open'), 4000); }
    }, true);
    HUD.ready = true;
    HUD.refreshSlots(); HUD.update(1, true);
  };

  // refreshSlots(): as 3 compras rápidas = nós abertos mais baratos
  HUD.refreshSlots = function () {
    if (!HUD.ready) return;
    slotNodes = D.TREE.filter(n => api.nodeState(n) === 'open').sort((a, b) => a.c - b.c).slice(0, 3);
    slots.forEach((s, i) => {
      const n = slotNodes[i];
      s.el.style.visibility = n ? '' : 'hidden';
      if (!n) return;
      s.el.style.setProperty('--k-accent', D.BRANCHES[n.branch].color);
      s.set({ title: n.n, icon: D.BRANCHES[n.branch].icon });
    });
    if (tree && HUD.treeOpen) tree.refresh();
  };
  /* ======================================================================
     NAVEGAÇÃO FIXA + HUBS (rodada de UX, docs/design/ux-guia.md)
     Barra de baixo: Comprar · Lugares · Viagem · Mais (ícone + palavra, bolinha dourada = tem novidade lá dentro).
     Cada aba abre o HUB: tela cheia com as 5 abas em cima (Cavar = volta pro jogo) e blocos grandes (desenho + nome +
     1 linha de "como isso dá mais dinheiro" + bolinha de novidade; travado = cinza dizendo o que destrava).
     TODA função do jogo tem bloco aqui (≤ 2 toques). Bloco novo = 1 linha em hubTiles(). G.HUD.hub(id) abre; G.HUD.hubClose().
     ====================================================================== */
  const NAV = [
    { id: 'cavar', icon: 'mount', t: 'Cavar' },
    { id: 'comprar', icon: 'yen', t: 'Comprar', hint: 'Toque no que quer comprar. Dourado = dá pra pagar agora.' },
    { id: 'lugares', icon: 'house', t: 'Lugares', hint: 'Toque num lugar pra ir. Cada um rende mais ienes.' },
    { id: 'viagem', icon: 'boat', t: 'Viagem', hint: 'Viaje de ilha, ganhe sementes e fique mais forte.' },
    { id: 'mais', icon: 'book', t: 'Mais', hint: 'Metas, prêmios e ajustes do jogo.' },
  ];
  const GROUP = { tatuzao: 'comprar', socasa: 'comprar', vila: 'lugares', cidade: 'lugares', fabrica: 'lugares', patio: 'lugares', verpatio: 'lugares',
    ilhas: 'viagem', partir: 'viagem', amuletos: 'viagem', modo: 'viagem', sementes: 'viagem', escada: 'mais', evento: 'mais' };
  const navTabs = {};
  let homeN = 0, homeNews = false, treeN = -1, hubEl = null, hubGrid = null, hubHint = null, hubTab = '', hubSig = '', hubT = 0, hubTabs = {}, seedChip = null, seedC = null, seedCT = -9;
  const chipBy = id => chips.find(c => c.id === id && c.on) || null;
  function navBuild(dock) {
    for (const n of NAV) {
      if (n.id === 'cavar') continue;
      const b = UI.button(dock, { icon: n.icon, iconSize: 28, title: n.t, vertical: true, cls: 'k-nav k-nav-' + n.id, onClick: () => hubOpen(n.id) });
      b.dot = UI.el('i', 'k-nav-dot', b.el); navTabs[n.id] = b;
    }
  }
  // sementes: quantas tem e se dá pra comprar algum nó (lido do adaptador da tela de Sementes; cache de 2 s)
  function seedInfo() {
    if (seedC && S.time - seedCT < 2 && S.time >= seedCT) return seedC;
    const n = Math.floor((S.stats && S.stats.seeds) || 0); let can = false, any = n > 0 || (S.stats.islandsDone | 0) > 0;
    try {
      const A = G.CookieUI && G.CookieUI.api, nodes = A ? A.seedTree().nodes || [] : [];
      for (const nd of nodes) { const L = A.seedLevel(nd.id) | 0; if (L > 0) any = true; if (n > 0 && A.seedCost(nd.id) <= n && !(nd.max && L >= nd.max) && !(nd.req || []).some(r => !(A.seedLevel(r) > 0))) can = true; }
      seedC = { n, can, any, tree: nodes.length > 0 };
    } catch (e) { seedC = { n, can: false, any, tree: false }; }
    seedCT = S.time; return seedC;
  }
  function openSeeds() { const si = seedInfo(); if (si.tree && G.CookieUI && G.CookieUI.openSeeds) G.CookieUI.openSeeds(); else if (G.IslandsUI) G.IslandsUI.open(); }
  // bolinha dourada nas abas: tem novidade em algum bloco daquele hub
  function navNews(id) {
    if (id === 'lugares' && (homeN || homeNews)) return true;
    if (id === 'viagem' && seedC && seedC.can) return true;
    for (const c of chips) if (c.on && c.prio > 0 && GROUP[c.id] === id) return true;
    return false;
  }
  function navDots() {
    for (const id in navTabs) { const on = navNews(id); if (navTabs[id]._dot !== on) { navTabs[id]._dot = on; navTabs[id].el.classList.toggle('k-nav-news', on); } if (hubTabs[id]) hubTabs[id].classList.toggle('k-nav-news', on); }
  }
  // bloco que espelha um chip (Vila, Fábrica, Cidade...): travado enquanto o chip não existe; a linha vira o aviso do chip quando tem
  function chipTile(id, ic, t, s, lock) {
    const c = chipBy(id);
    return { icon: ic, t, s: c && c.prio > 0 && c.hint ? c.hint : s, lock: c ? '' : lock, dot: !!c && c.prio > 0, fn: () => { const q = chipBy(id); if (q && q.click) q.click({}); } };
  }
  function hubTiles(tab) {
    const o = [], ended = !!S.ended, hd = S.homeData || {}, END = 'Abre quando a casa ficar pronta';
    if (tab === 'comprar') {
      const nt = D.TOOLS[S.tool + 1];
      if (nt) {
        let lock = ''; if (nt.needs) for (const id of nt.needs) if (!S.own[id]) { lock = 'Precisa: ' + D.nodeById[id].n; break; }
        if (!lock && G.Modos && G.Modos.lockTool(nt)) lock = 'Só na Pata: sem motor';
        const c = api.toolCost(nt), can = S.money >= c;
        o.push({ icon: icon(nt.id), t: nt.name, s: can ? 'Máquina maior · custa ' + yen(c) : 'Máquina maior · falta ' + yen(c - S.money), lock, gold: can, need: !can, big: true, fn: () => gain(() => api.buyTool()) });
      }
      slotNodes.forEach(n => { const c = api.nodeCost(n), can = S.money >= c; o.push({ icon: D.BRANCHES[n.branch].icon, t: n.n, s: (can ? 'custa ' + yen(c) : 'falta ' + yen(c - S.money)) + ' · ' + n.desc, gold: can, need: !can, stay: true, fn: () => gain(() => api.buyNode(n.id)) }); });
      const nA = Math.max(0, treeN);
      o.push({ icon: 'tree', t: 'Árvore do Kome', s: nA ? nA + (nA > 1 ? ' melhorias pra comprar' : ' melhoria pra comprar') : 'Todas as melhorias: cavar e vender mais', dot: nA > 0, fn: () => treePanel.open() });
      const h = D.HOUSE[S.house];
      if (h) { const c = api.houseCost(h), lk = S.tool + 1 < h.tier ? 'Precisa: ' + D.TOOLS[h.tier - 1].name : '', can = S.money >= c; o.push({ icon: 'house', t: h.n, s: can ? 'Etapa da casa · custa ' + yen(c) : 'Etapa da casa · falta ' + yen(c - S.money), lock: lk, gold: can, need: !can, fn: () => api.buyHouse() }); }
      o.push({ icon: 'swap', t: 'Trocar de máquina', s: 'Pilote qualquer uma que já comprou', lock: S.tool >= 1 || (api.twinReady && api.twinReady()) ? '' : 'Compre a 2ª ferramenta', fn: () => openSwap() });
      o.push(chipTile('tatuzao', 'drill', 'Tatuzão', 'Cava por baixo sozinho: mais arroz', END));
    } else if (tab === 'lugares') {
      o.push({ icon: 'house', t: 'Casa do Kome', s: 'Jardim e bichinhos: enfeite dá bônus', dot: !!(hd.newAch || homeNews), fn: () => api.openHome && api.openHome('jardim') });
      o.push({ icon: 'hat', t: 'Roupinhas', s: (S.closet || []).length + ' de ' + D.CLOSET.length + ' achadas cavando', dot: !!hd.newCloth, fn: () => api.openHome && api.openHome('roupa') });
      const vc = chipBy('vila'), inV = vc && vc.label === 'Montanha';
      o.push(Object.assign(chipTile('vila', inV ? 'mount' : 'house', inV ? 'Voltar pra montanha' : 'Vila', inV ? 'Volta a cavar o arroz' : 'Onde seu arroz é vendido', 'Abre em 30 segundos de jogo')));
      o.push(chipTile('fabrica', 'factory', 'Fábrica', 'Vira arroz em comida: vende mais caro', END));
      { const cOn = !!(G.City && G.City.on && G.City.on()), pl = cOn && G.City.perkLine ? G.City.perkLine() : '';
        o.push(Object.assign(chipTile('cidade', 'house', 'Cidade', pl ? 'Prédios: ' + pl : 'Vizinhos pagam ¥ por entrega', G.City && G.City.lockText ? G.City.lockText() : ''), cOn ? { lock: '', fn: () => G.City.open() } : {})); }
      o.push({ icon: 'bolt', t: 'Oficina', s: 'Deixa cada máquina mais forte', lock: ended ? '' : END, fn: () => G.Inf && G.Inf.open() });
      o.push(chipTile('patio', 'paw', 'Pátio', 'Turmas de máquinas rendendo sozinhas', END));
      if (chipBy('verpatio')) o.push(chipTile('verpatio', 'paw', 'Ver o Pátio', 'Passeio pra ver suas máquinas', ''));
    } else if (tab === 'viagem') {
      const si = seedInfo(), isl = chipBy('ilhas'), pt = chipBy('partir'), pOn = !!(G.Patio && G.Patio.on && G.Patio.on());
      if (pt) o.push(Object.assign(chipTile('partir', 'boat', 'Hora de partir', 'Viaje agora e ganhe sementes', ''), { gold: true, big: true }));
      o.push({ icon: 'boat', t: 'Ilhas', s: isl && isl.prio > 0 && isl.hint ? (isl.hot ? isl.hot + ' · ' : '') + isl.hint : 'Mapa: ilha nova, montanha maior', lock: isl ? '' : END, dot: !!isl && isl.prio > 0, fn: () => G.IslandsUI && G.IslandsUI.open() });
      o.push({ icon: 'star', t: 'Sementes Douradas', s: si.can ? 'Você tem ' + U.fmt(si.n) + ' · dá pra comprar!' : si.any ? 'Você tem ' + U.fmt(si.n) + ' · bônus que não some' : 'Bônus que fica pra sempre', lock: si.any ? '' : 'Ganhe sementes viajando de ilha', dot: si.can, gold: si.can, fn: () => openSeeds() });
      o.push({ icon: 'rice', t: 'Arroz do Coração', s: 'Cada grão dá +1% de renda', lock: pOn && G.CookieUI && G.CookieUI.openHeart ? '' : 'Abre junto com o Pátio', fn: () => G.CookieUI.openHeart() });
      o.push(chipTile('amuletos', 'star', 'Amuletos', 'Poderes da ilha: escolha os seus', 'Ganhe o 1º chegando numa ilha'));
      const fx = G.Faixas, lv = fx && fx.level ? fx.level() : 0;
      o.push({ icon: 'trophy', t: 'Faixa do Kome', s: lv > 0 && fx.name ? String(fx.name(lv)) + ' · sementes valem mais' : 'Cada volta no Japão vale mais sementes', lock: lv > 0 ? '' : 'Dê a volta em todas as ilhas', fn: () => G.IslandsUI && G.IslandsUI.open() });
      if (chipBy('modo')) o.push(chipTile('modo', 'clock', 'Modo de partida', 'Sua partida especial de agora', ''));
      o.push({ icon: 'mount', t: 'Nova montanha', s: 'Montanha nova pra cavar tudo de novo', lock: ended ? '' : END, fn: () => api.newMountain && api.newMountain() });
    } else {
      const ach = S.stats.ach ? Object.keys(S.stats.ach).length : 0, ev = chipBy('evento');
      o.push({ icon: 'check', t: 'Missões', s: 'Cumpra e ganhe ienes na hora', fn: () => api.openHome && api.openHome('caderno') });
      o.push({ icon: 'book', t: 'Caderno', s: ach + ' conquistas · cada uma dá +1% de renda', dot: !!hd.newAch, fn: () => api.openHome && api.openHome('caderno') });
      o.push(chipTile('escada', 'trophy', 'Escadas', 'Metas longas: cada degrau +1% de renda', 'Abre em 1 minuto de jogo'));
      if (ev) o.push(chipTile('evento', 'star', 'Evento agora', 'Toque pra ganhar o bônus', ''));
      o.push({ icon: 'star', t: 'Livro dos Eventos', s: 'Os eventos dourados que você já viu', lock: G.EventArt && G.EventArt.openBook ? '' : 'Em breve', fn: () => G.EventArt.openBook() });
      o.push({ icon: 'gear', t: 'Ajustes', s: 'Som, letra, salvar o jogo', fn: () => aj.open() });
    }
    return o;
  }
  function hubBuild() {
    hubEl = UI.el('div', 'k-hub', document.body);
    const card = UI.el('div', 'k-hub-card', hubEl), head = UI.el('div', 'k-hub-head', card), tabs = UI.el('div', 'k-hub-tabs', head);
    for (const n of NAV) {
      const b = UI.el('button', 'k-hub-tab k-hub-tab-' + n.id, tabs); b.type = 'button';
      const ic = UI.iconEl(n.icon, 26); if (ic) b.appendChild(ic); UI.el('b', null, b, n.t); UI.el('i', 'k-nav-dot', b);
      b.addEventListener('click', () => { UI.sfx && UI.sfx('click'); if (n.id === 'cavar') hubClose(); else hubOpen(n.id); });
      hubTabs[n.id] = b;
    }
    const x = UI.el('button', 'k-hub-x', head, '×'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar'); x.addEventListener('click', () => { UI.sfx && UI.sfx('click'); hubClose(); });
    hubHint = UI.el('div', 'ux-hint k-hub-hint', card);
    hubGrid = UI.el('div', 'k-hub-grid', card);
    hubEl.addEventListener('pointerdown', e => { if (e.target === hubEl) hubClose(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && hubTab) { hubClose(); e.stopPropagation(); } }, true);
  }
  function hubRender(force) {
    const tiles = hubTiles(hubTab), sig = hubTab + '§' + tiles.map(t => t.t + '|' + t.s + '|' + (t.lock || '') + '|' + (t.dot ? 1 : 0) + (t.gold ? 1 : 0)).join('§');
    if (sig === hubSig && !force) return; hubSig = sig;
    hubGrid.textContent = '';
    for (const t of tiles) {
      const b = UI.el('button', 'k-tile' + (t.lock ? ' k-tile-lock' : t.gold ? ' k-tile-gold' : '') + (t.big ? ' k-tile-big' : '') + (t.dot && !t.lock ? ' k-tile-news' : ''), hubGrid); b.type = 'button';
      b.setAttribute('aria-label', t.t);
      const art = UI.el('span', 'k-tile-art', b), ic = UI.iconEl(t.lock ? t.icon : t.icon, 48); if (ic) art.appendChild(ic);
      if (t.lock) { const lk = UI.iconEl('lock', 22); if (lk) { lk.classList.add('k-tile-lk'); art.appendChild(lk); } }
      const tx = UI.el('span', 'k-tile-t', b); UI.el('b', null, tx, t.t); UI.el('small', null, tx, t.lock || t.s || '');
      UI.el('i', 'k-nav-dot', b);
      b.addEventListener('click', () => {
        if (t.lock) { UI.sfx && UI.sfx('error'); b.classList.remove('ux-shake'); void b.offsetWidth; b.classList.add('ux-shake'); UI.toast(t.t + ' está fechado', { icon: 'lock', sub: t.lock }); return; }
        if (t.need) { UI.sfx && UI.sfx('error'); b.classList.remove('ux-shake'); void b.offsetWidth; b.classList.add('ux-shake'); UI.toast(t.s.split(' · ').pop().replace(/^falta/, 'Falta'), { icon: 'yen', tone: 'bad', sub: t.t }); return; }
        UI.sfx && UI.sfx('click');
        if (t.stay) { t.fn(); hubRender(); return; }
        hubClose(); t.fn();
      });
    }
    const bk = UI.el('button', 'ux-btn ux-main k-hub-back', hubGrid); bk.type = 'button';
    const bi = UI.iconEl('mount', 26); if (bi) bk.appendChild(bi); UI.el('span', null, bk, 'Voltar pra cavar');
    bk.addEventListener('click', () => { UI.sfx && UI.sfx('click'); hubClose(); });
  }
  function hubOpen(id) {
    if (!NAV.some(n => n.id === id && id !== 'cavar')) id = 'lugares';
    if (!hubEl) hubBuild();
    moreClose(); chipPopClose();
    const was = hubTab; hubTab = id; hubT = 0;
    for (const n of NAV) hubTabs[n.id].classList.toggle('k-sel', n.id === id);
    hubHint.textContent = NAV.find(n => n.id === id).hint;
    hubRender(true); hubGrid.scrollTop = 0;
    if (!was) { hubEl.classList.add('k-open'); document.body.classList.add('k-hubopen'); }
    navDots();
  }
  function hubClose() { if (!hubTab) return; hubTab = ''; hubEl.classList.remove('k-open'); document.body.classList.remove('k-hubopen'); }
  // 2x por segundo: hub aberto acompanha os preços (só refaz se o texto mudou); contador de sementes no HUD; bolinhas das abas
  function hubTick(dt) {
    if ((hubT -= dt) > 0) return; hubT = 0.5;
    if (hubTab) hubRender();
    const si = seedInfo();
    if (!seedChip && si.any && HUD.chip) seedChip = HUD.chip({ id: 'sementes', icon: 'star', label: 'Sementes', order: 1, tone: '#FFF0C4', show: false, onClick: () => openSeeds() });
    if (seedChip) seedChip.set({ show: si.any && si.n > 0, label: U.fmt(si.n) + (si.n === 1 ? ' semente' : ' sementes'), prio: si.can ? 0.3 : 0, hint: si.can ? 'dá pra comprar!' : '' });
    navDots();
  }
  HUD.hub = hubOpen; HUD.hubClose = hubClose; HUD.hubIsOpen = () => !!hubTab; HUD.openSeeds = openSeeds;
  // toda compra mostra o salto da renda: "+¥ 1,2 mi/s" subindo do ¥/s (3 s depois, quando a média já pegou a compra)
  function gain(fn) {
    const before = S.ips, ok = fn();
    if (ok && rate) setTimeout(() => {
      const d = S.ips - before, re = rate.el || rate; if (!(d > 0.5) || !re || !re.appendChild) return;
      const f = UI.el('span', 'k-gain', re, '+¥ ' + U.fmt(d) + '/s'); setTimeout(() => f.remove(), 1700);
    }, 3000);
    return ok;
  }
  // painel de troca: game/menu-ui.js
  function openSwap() { swapPanel = G.MenuUI.openSwap(); }
  function quickBuy(i) {
    const n = slotNodes[i]; if (!n) return;
    if (gain(() => api.buyNode(n.id))) slots[i].pop && slots[i].pop();
    else UI.toast('Faltam ' + yen(api.nodeCost(n) - S.money), { icon: 'yen', tone: 'bad', sub: n.n });
  }

  function goalBtn(btn, title, cost, lockTxt, ic) {
    const f = U.clamp(S.money / cost, 0, 1), can = S.money >= cost && !lockTxt;
    const eta = S.ips > 1 && !can ? ' · ≈ ' + U.fmtTime(Math.max(1, (cost - S.money) / S.ips)) : '';
    const o = { title, sub: lockTxt || (can ? yen(cost) + ' · dá pra comprar!' : 'faltam ' + yen(cost - S.money) + eta), progress: lockTxt ? 0 : 0.12 + 0.88 * f, state: lockTxt ? 'off' : can ? 'can' : '' };
    if (ic) o.icon = ic;
    btn.set(o);
  }

  // update(dt, force): atualiza os números (10x por segundo)
  // a Casa pulsa quando tem coisa pra comprar lá (ou roupinha nova); aviso único aos 2 minutos de jogo
  let homeChk = 0;
  function homeTick(dt) {
    if (!HUD.homeEl || (homeChk -= dt) > 0) return; homeChk = 2;
    const hd = S.homeData || {}, own = hd.own || {}, ips = Math.max(5, S.ips || 0);
    const cheap = D.DECOR ? D.DECOR.filter(x => !own[x.id] && (!x.needs || own[x.needs])).reduce((m, x) => Math.min(m, Math.ceil(x.sec * ips / 10) * 10), Infinity) : Infinity;
    const hn = S.money >= cheap || !!hd.newCloth || !!hd.newAch; if (hn !== homeNews) { homeNews = hn; navDots(); }
    if (!S.stats.homeTip && S.time > 120 && !S.endOpen) { S.stats.homeTip = 1; UI.toast('Novo: Casa do Kome!', { icon: 'house', tone: 'gold', sub: 'toque em Lugares, lá embaixo: jardim, bichinhos e roupas', dur: 7 }); }
  }
  HUD.update = function (dt, force) {
    homeTick(dt);
    if (!HUD.ready) return;
    acc += dt; sampleT += dt;
    if (acc < 0.1 && !force) return;
    const sdt = acc; acc = 0;   // tempo desde a última atualização (swapTick conta o relógio dele com isso, não com o dt do quadro)
    yenPill.set(S.money);
    rate.set(S.ips);
    if (sampleT >= 5 || force) { sampleT = 0; rate.push(S.ips); }
    const st = api.stats(), cm = 1 + (st.comboCap - 1) * S.combo / D.COMBO.max;
    combo.set(S.combo / D.COMBO.max, null, { value: (S.furia > 0 ? 'FÚRIA ×' : '×') + (cm * (S.furia > 0 ? 2 : 1)).toFixed(2).replace('.', ',') });
    combo.el.classList.toggle('k-maxed', S.combo >= D.COMBO.max - 0.01);
    { const on = S.furia > 0 || cm > 1.005; if (combo._on !== on) { combo._on = on; combo.el.classList.toggle('ux-combo-off', !on); } }   // ×1,00 = some
    const tone = S.furia > 0 ? 'fury' : st.comboCap >= 2 ? 'pink' : st.comboCap > 1.5 ? 'sack' : '';
    if (tone !== lastComboTone && combo.tone) { combo.tone(tone); lastComboTone = tone; }
    mount.set(Math.min(S.heapTotal - S.heapArea, S.heapTotal * D.END_DUG), S.heapTotal * D.END_DUG);   // 100% = o final (D.END_DUG da montanha)

    const nt = D.TOOLS[S.tool + 1];
    if (nt) {
      let lock = null;
      if (nt.needs) for (const id of nt.needs) if (!S.own[id]) { lock = 'precisa: ' + D.nodeById[id].n; break; }
      if (!lock && G.Modos && G.Modos.lockTool(nt)) lock = 'Só na Pata: sem motor';   // modo de partida (modos.js)
      goalBtn(toolBtn, nt.name, api.toolCost(nt), lock, toolBtn._id !== nt.id ? icon(nt.id) : null); toolBtn._id = nt.id;
    } else toolBtn.set(S.ended ? ofiBtn() : { title: 'Bagger 293', sub: 'a maior máquina do mundo', progress: 1, state: '' });
    const h = D.HOUSE[S.house];
    if (h) {
      // nome curto pro cartão não vazar ("Escavadeira Hidráulica" -> "Escavadeira")
      const tn = D.TOOLS[h.tier - 1].name, sn = tn.length <= 12 ? tn : tn.startsWith('Pá ') ? 'Pá Elétrica' : tn.split(' ')[0];
      const c = api.houseCost(h), lock = S.tool + 1 < h.tier ? 'precisa: ' + sn : null;
      const teaser = h.teaser && S.house < 2 ? h.teaser : c;
      flyer.set({ title: h.n, sub: lock || (S.money >= c ? yen(c) + ' · pagar!' : 'faltam ' + yen(c - S.money)), progress: 0.12 + 0.88 * U.clamp(S.money / teaser, 0, 1), state: lock ? 'off' : S.money >= c ? 'can' : '' });
    } else flyer.set({ title: 'Casa pronta', sub: 'onsen quentinho', progress: 1, state: '' });
    let nAff = 0;
    slots.forEach((s, i) => {
      const n = slotNodes[i]; if (!n) return;
      const c = api.nodeCost(n), can = S.money >= c;
      s.set({ sub: can ? yen(c) : 'faltam ' + yen(c - S.money), progress: 0.12 + 0.88 * U.clamp(S.money / c, 0, 1), state: can ? 'can' : '' });
    });
    for (const n of D.TREE) if (!S.own[n.id] && S.money >= api.nodeCost(n) && api.nodeState(n) === 'open') nAff++;
    if (nAff !== treeN) { treeN = nAff; UI.badge(navTabs.comprar.el, nAff); }
    hubTick(sdt);
    hornBtn.el.style.display = S.own.b0 && api.playing && api.playing().kind === 'bagger' ? '' : 'none';
    swapTick(sdt);
  };

  /* ---- trocar de máquina: só toca no DOM quando muda (aparece, troca de máquina, muda de lugar) ---- */
  function swapName() { const p = api.playing && api.playing(); return S.twinPlay ? 'Bagger Gêmea' : p ? p.name || (D.TOOLS.find(t => t.id === p.id) || {}).name || p.id : '…'; }
  function swapTick(dt) {
    const on = S.tool >= 1 || !!(api.twinReady && api.twinReady());
    if (on !== swapOn) { swapOn = on; swapBtn.el.style.display = swapFab.el.style.display = on ? '' : 'none'; swapPos = ''; }
    if (!on) return;
    const p = api.playing && api.playing(), id = S.twinPlay ? 'bagger' : p ? p.id : 'hashi';
    if (id !== swapId) {
      swapId = id; swapBtn.set({ icon: icon(id) }); swapFab.set({ icon: icon(id) });
      const lb = 'Trocar de máquina (jogando com ' + swapName() + ')'; swapBtn.el.setAttribute('aria-label', lb); swapFab.el.setAttribute('aria-label', lb);
    }
    if ((swapT -= dt) <= 0) { swapT = 0.5; swapPlace(); }
  }
  // celular: lê onde está o CAVAR e encosta o botão nele (deitado: em cima; em pé ou sem espaço em cima: do lado esquerdo)
  function swapPlace() {
    if (!swapFab || !swapOn || !document.body.classList.contains('k-mob')) return;
    const dg = document.querySelector('.k-dig'), r = dg && dg.getBoundingClientRect(), hb = ui.hud.getBoundingClientRect();
    let pos = 'none';
    if (r && r.width && hb.width) {
      const k = hb.width / (ui.hud.offsetWidth || hb.width), s = 68 * k, gap = 14 * k, port = innerHeight > innerWidth * 1.1;
      let trB = 0; const tr = document.querySelector('.k-zone-tr'); if (tr) { const b = tr.getBoundingClientRect(); trB = b.bottom; }
      let x = r.left + (r.width - s) / 2, y = r.top - s - gap;
      if (port || y < trB + gap) { x = r.left + r.width / 2 < innerWidth / 2 ? r.right + gap * 1.4 : r.left - s - gap * 1.4; y = r.top + (r.height - s) / 2; }   // canhoto: CAVAR à esquerda, Trocar do lado de dentro
      pos = Math.round((x - hb.left) / k) + ',' + Math.round((y - hb.top) / k);
    }
    if (pos === swapPos) return; swapPos = pos;
    const st = swapFab.el.style;
    if (pos === 'none') { st.visibility = 'hidden'; return; }
    const [l, t] = pos.split(','); st.visibility = ''; st.left = l + 'px'; st.top = t + 'px';
  }

  HUD.bump = function () { if (HUD.ready && yenPill.bump) yenPill.bump(); };
  // botão da Oficina depois do final: mostra a Bagger Gêmea (que mora dentro da Oficina, na prancheta azul) até ela ficar pronta
  function ofiBtn() {
    const I = G.Ind, r = I && I.run ? I.run() : null, gp = r ? r.giant | 0 : 4;
    if (gp >= 4 || !I.cost) return { title: 'Oficina', sub: 'melhorar as máquinas', progress: 1, state: '' };
    const c = I.cost.giant(), can = S.money >= c;
    return { title: 'Oficina', sub: 'Bagger Gêmea ' + gp + '/4 · ' + (can ? 'peça à venda!' : 'faltam ' + yen(c - S.money)), progress: 0.12 + 0.88 * U.clamp(S.money / c, 0, 1), state: can ? 'can' : '' };
  }
  // endCard(rows): cartão simples do final com as estatísticas
  HUD.endCard = function (rows, onMore) {
    if (!UI) return;
    const rank = UI.el('div', 'k-rank', null, rows.rank || 'A');
    if (UI.clearBanners) UI.clearBanners(); document.querySelectorAll('.k-banner').forEach(b => b.remove());
    UI.dialog({ art: rank, kicker: 'Campanha concluída', title: 'O Kome comprou a casa no Japão!', text: 'A casa ficou pronta. O que sobrou da montanha continua lá: dá pra seguir cavando ou abrir uma montanha nova.',
      rows: rows.list, buttons: [{ title: 'Continuar cavando', tone: 'primary', onClick: onMore }] });
  };
})();
