/* Kome no Japão — menu-ui.js
   Os painéis que abrem DEPOIS do HUD (regras em docs/design/ux-guia.md; CSS em game/ux-menu.css):
   - Árvore do Kome: ESCADA de máquinas (1, 2, 3...) com as melhorias de cada degrau, "Você está aqui" e o próximo passo
     marcado. Cartão = desenho + nome + 1 linha + UM estado (dourado comprar / cinza "falta ¥X" / verde comprado).
   - Menu do Kome (blocos grandes), Trocar de máquina, Ajustes (chaves grandes, tamanho da letra, menos efeitos, cópia do save).
   game-ui.js chama G.MenuUI.init(api) dentro do HUD.init e usa openMenu/openSwap. Só mexe no DOM quando o estado muda.
   Ajustes salvos em S.opts: fs (0..3 -> --k-fs 1/1.25/1.5/2 no :root), calm (menos movimento), hc (cores fortes),
   cavar ('segurar' | 'alternar' | 'auto': quem lê é o HUD/controles) e canhoto (classe ux-canhoto no :root). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data;
  const M = (G.MenuUI = {});
  let api = null, S = null, tp = null, T = null, aj = null, menuPanel = null, swapPanel = null;

  const yen = v => '¥ ' + U.fmt(Math.ceil(v));
  const h = (tag, cls, par, txt) => UI.el(tag, cls, par, txt);
  const propIcon = id => (G.Props && G.Props.icon ? G.Props.icon(id) : 'paw');
  const sfx = (n, o) => { try { if (UI.sfx) UI.sfx(n, o); } catch (e) { /* sem áudio */ } };
  function shake(el) { el.classList.remove('ux-shake'); void el.offsetWidth; el.classList.add('ux-shake'); sfx('error'); }
  function ico(par, ic, size) { const e = UI.iconEl(ic, size); if (e) par.appendChild(e); return e; }
  // botão grande: ícone + palavra (+ 1 linha pequena)
  function big(par, o) {
    const b = h('button', 'ux-btn mx-btn' + (o.cls ? ' ' + o.cls : ''), par); b.type = 'button';
    const i = h('span', 'mx-btn-i', b); ico(i, o.icon, o.iconSize || 26);
    const t = h('span', 'mx-btn-t', b); const tt = h('b', null, t, o.title); const ss = h('small', null, t, o.sub || '');
    b.addEventListener('click', e => { sfx('click'); if (o.onClick) o.onClick(e, b); });
    return { el: b, set(p) { if (p.title !== undefined && tt.textContent !== p.title) tt.textContent = p.title; if (p.sub !== undefined && ss.textContent !== p.sub) ss.textContent = p.sub; } };
  }

  function foot(p) { const f = h('div', 'mx-foot', p.el); big(f, { icon: 'x', title: 'Fechar', cls: 'mx-close', iconSize: 20, onClick: () => p.close() }); }

  /* ---------- letra e efeitos (valem pro jogo todo, ligados no boot) ---------- */
  const FS = [1, 1.25, 1.5, 2];
  function applyLook() {
    const r = document.documentElement;
    r.style.setProperty('--k-fs', String(FS[S.opts.fs | 0] || 1));
    r.classList.toggle('ux-calm', !!S.opts.calm);
    r.classList.toggle('ux-hc', !!S.opts.hc);
    r.classList.toggle('ux-canhoto', !!S.opts.canhoto);
  }

  /* ---------- textos simples ---------- */
  // 1 linha do que a máquina faz (sem jargão)
  const TOOL_LINE = {
    pata: 'cava com as patinhas', hashi: 'pega grão por grão, bem rápido', tigela: 'enche e joga pra trás', pa: 'uma pazada vale 9 tigelas',
    duaspas: 'uma pá em cada pata', carrinho: 'bate no barranco e enche', britadeira: 'quebra o arroz duro', trator: 'empurra ondas de arroz',
    empilhadeira: 'arranca blocos de arroz duro', colheita: 'puxa, enche e despeja', escav: 'braço gigante que morde a montanha',
    caminhao: 'carrega 360 toneladas de arroz', pacabo: 'conchada gigante e lenta', bagger: 'a maior máquina do mundo',
  };
  const toolLine = t => TOOL_LINE[t.id] || t.act || '';
  // o que a melhoria faz, em português simples
  function fxText(n) {
    const f = n.fx || {}, o = [];
    const pc = v => '+' + Math.round((v - 1) * 100) + '%';
    if (f.dig) o.push(pc(f.dig) + ' de arroz cavado');
    if (f.sell) o.push('vende ' + pc(f.sell) + ' mais caro');
    if (f.val) o.push('arroz vale ' + pc(f.val));
    if (f.sack) o.push('sacos valem ' + pc(f.sack));
    if (f.hm) o.push('ajudantes ' + pc(f.hm) + ' mais rápidos');
    if (f.hv) o.push('arroz dos ajudantes vale ' + pc(f.hv));
    if (f.pm) o.push('máquinas com piloto rendem ' + pc(f.pm));
    if (f.help) o.push('+' + f.help + ' ajudante' + (f.help > 1 ? 's' : ''));
    if (f.crit) o.push('+' + Math.round(f.crit * 100) + '% de chance de grão dourado');
    if (f.gold) o.push('ouro enterrado vale ' + f.gold + ' vezes mais');
    if (f.comboCap) o.push('combo sobe até ' + String(f.comboCap).replace('.', ',') + ' vezes');
    if (f.spd) o.push('Kome anda ' + pc(f.spd) + ' mais rápido');
    if (f.reach) o.push('alcança ' + pc(f.reach) + ' mais longe');
    if (f.auto) o.push('Kome cava sozinho quando você solta');
    if (f.oni) o.push('onigiri da sorte passa voando: toque nele');
    if (f.pilot) o.push('a máquina antiga cava sozinha');
    if (f.part) o.push('chega uma peça da Bagger 293');
    if (f.powMul) o.push('corta até o miolo duro da montanha');
    if (f.stomp) o.push('pulo que abre um buraco a cada 6 s');
    if (f.furia) o.push('combo cheio por 10 s dobra o iene');
    if (f.autosack) o.push('pega os sacos sozinho');
    if (f.mordida) o.push('mordida certeira vale mais');
    if (f.horn) o.push('libera a BUZINA');
    if (f.slide) o.push('avalanche grande paga mais');
    if (f.silo) o.push('ganha um silo no pátio');
    if (f.boom) o.push('braço ' + pc(f.boom) + ' mais comprido');
    return o.join(' · ') || 'melhoria';
  }

  /* ======================================================================
     ÁRVORE: escada de máquinas + melhorias de cada degrau
     ====================================================================== */
  function komeCv() {
    const c = document.createElement('canvas'); c.width = 48; c.height = 46; c.className = 'mx-kome';
    try { E.drawShiba(c.getContext('2d'), 23, 44, 'sit', 0.5, { shadow: false }); } catch (e) { /* */ }
    return c;
  }
  function treeInit() {
    T = { cards: [], rungs: [], tool: -2, only: false, timer: 0, hintSig: '', progSig: '' };
    tp = UI.panel({ title: 'Árvore do Kome', icon: 'tree', full: true, cls: 'mx-panel mx-treepanel',
      onOpen: () => { G.HUD.treeOpen = true; treeOpenAt(); clearInterval(T.timer); T.timer = setInterval(treeSync, 500); },
      onClose: () => { G.HUD.treeOpen = false; clearInterval(T.timer); } });
    foot(tp);
    const b = tp.body, top = h('div', 'mx-top', b);
    T.hint = h('div', 'ux-hint mx-hint', top, '');
    const bar = h('div', 'mx-topbar', top);
    const pr = h('div', 'mx-prog', bar); T.progFill = h('i', null, pr); T.progTx = h('span', null, pr, '');
    const f = h('div', 'mx-filter', bar);
    T.fAll = big(f, { icon: 'tree', title: 'Tudo', cls: 'mx-seg', iconSize: 22, onClick: () => treeFilter(false) });
    T.fCan = big(f, { icon: 'yen', title: 'Dá pra comprar', cls: 'mx-seg', iconSize: 22, onClick: () => treeFilter(true) });
    T.list = h('div', 'mx-ladder', b);
    T.empty = h('div', 'mx-empty', b, 'Nada pra comprar agora. Continue cavando!');
    h('div', 'mx-more', b);   // sombra de "tem mais pra baixo"
    T.body = b;
  }
  function treeFilter(only) {
    T.only = !!only;
    T.list.classList.toggle('mx-onlycan', T.only);
    T.fAll.el.classList.toggle('mx-on', !T.only); T.fCan.el.classList.toggle('mx-on', T.only);
    treeSync(); T.body.scrollTop = 0;
    if (!T.only) treeScroll();
  }
  function treeBuild() {
    T.list.textContent = ''; T.cards = []; T.rungs = []; T.tool = S.tool; T.here = null;
    const byTier = {};
    for (const n of D.TREE) (byTier[n.tier] = byTier[n.tier] || []).push(n);
    for (let i = 0; i < D.TOOLS.length; i++) {
      const t = D.TOOLS[i], cls = i <= S.tool ? ' mx-got' : i === S.tool + 1 ? ' mx-nextrung' : ' mx-far';
      const rung = h('section', 'mx-rung' + cls, T.list), R = { el: rung, cards: [] };
      h('div', 'mx-step', rung, String(i + 1));
      const col = h('div', 'mx-rungcol', rung);
      if (i === S.tool) { T.here = h('div', 'mx-here', col); T.here.appendChild(komeCv()); h('b', null, T.here, 'Você está aqui'); }
      card({ kind: 'tool', i, t, R }, col);
      const nodes = (byTier[i + 1] || []).slice().sort((a, b2) => a.c - b2.c);
      if (!nodes.length) { T.rungs.push(R); continue; }
      if (i <= S.tool) { const grid = h('div', 'mx-grid', col); for (const n of nodes) card({ kind: 'node', n, R }, grid); }
      else h('div', 'mx-soon', col, '+ ' + nodes.length + (nodes.length > 1 ? ' melhorias vêm' : ' melhoria vem') + ' com esta máquina');
      T.rungs.push(R);
    }
  }
  function card(c, par) {
    const e = h('button', 'mx-card mx-' + c.kind, par); e.type = 'button';
    const art = h('span', 'mx-art', e);
    if (c.kind === 'tool') { ico(art, propIcon(c.t.id), 60); c.title = c.t.name; c.line = toolLine(c.t); }
    else {
      const br = D.BRANCHES[c.n.branch] || {};
      art.style.background = br.color || '#E3BC62'; ico(art, c.n.icon || br.icon || 'star', 30);
      c.title = c.n.n; c.line = c.n.desc || fxText(c.n);
      if (c.n.size === 2) { e.classList.add('mx-key'); h('span', 'mx-tag', e, 'especial'); }
    }
    const tx = h('span', 'mx-tx', e); h('b', null, tx, c.title); h('small', null, tx, c.line);
    c.st = h('span', 'mx-st', e); c.stI = h('span', 'mx-st-i', c.st); c.stT = h('span', null, c.st, '');
    c.bar = h('i', 'mx-bar', c.st);
    c.el = e; c.sig = ''; c.k = ''; c.q = -1; c.ic = '';
    e.setAttribute('aria-label', c.title);
    e.addEventListener('click', () => tapCard(c));
    T.cards.push(c); c.R.cards.push(c);
    return c;
  }
  // estado de um cartão: k = done | can | poor | lock; txt = o que aparece; why = o motivo falado no toque
  function stateOf(c) {
    if (c.kind === 'tool') {
      const t = c.t, i = c.i;
      if (i <= S.tool) return { k: 'done', txt: i === S.tool ? 'É a sua máquina' : 'Comprada', f: 1 };
      if (i > S.tool + 1) { const p = D.TOOLS[i - 1].name; return { k: 'lock', txt: 'Depois: ' + p, why: 'Compre antes: ' + p, f: 0 }; }
      if (t.needs) for (const id of t.needs) if (!S.own[id]) { const nm = D.nodeById[id].n; return { k: 'lock', txt: 'Precisa: ' + nm, why: 'Compre antes a melhoria ' + nm, f: 0 }; }
      if (G.Modos && G.Modos.lockTool && G.Modos.lockTool(t)) return { k: 'lock', txt: 'Só na Pata: sem motor', why: 'Neste modo não tem máquina com motor', f: 0 };
      const cost = api.toolCost(t);
      return S.money >= cost ? { k: 'can', txt: 'Comprar · ' + yen(cost), f: 1, cost } : { k: 'poor', txt: 'Falta ' + yen(cost - S.money), why: 'Falta ' + yen(cost - S.money), f: S.money / cost, cost };
    }
    const n = c.n;
    if (S.own[n.id]) return { k: 'done', txt: 'Comprado', f: 1 };
    for (const r of n.req) if (!S.own[r]) { const nm = D.nodeById[r] ? D.nodeById[r].n : r; return { k: 'lock', txt: 'Precisa: ' + nm, why: 'Compre antes: ' + nm, f: 0 }; }
    if (S.tool + 1 < n.tier) { const nm = D.TOOLS[n.tier - 1].name; return { k: 'lock', txt: 'Precisa: ' + nm, why: 'Compre antes a máquina ' + nm, f: 0 }; }
    const cost = api.nodeCost(n);
    return S.money >= cost ? { k: 'can', txt: 'Comprar · ' + yen(cost), f: 1, cost } : { k: 'poor', txt: 'Falta ' + yen(cost - S.money), why: 'Falta ' + yen(cost - S.money), f: S.money / cost, cost };
  }
  const ST_ICON = { done: 'check', can: 'yen', poor: 'yen', lock: 'lock' };
  function treeSync() {
    if (!T || !api) return;
    if (T.tool !== S.tool) treeBuild();
    let nCan = 0, nDone = 0, next = null, nextCost = Infinity, nextCan = false;
    for (const R of T.rungs) R.can = 0;
    for (const c of T.cards) {
      const s = stateOf(c);
      if (s.k === 'done') nDone++;
      if (s.k === 'can') { nCan++; c.R.can++; }
      // próximo passo: o mais barato que dá pra comprar; se não dá nada, o mais barato que falta
      if (s.k === 'can' || s.k === 'poor') { const better = s.k === 'can' ? (!nextCan || s.cost < nextCost) : (!nextCan && s.cost < nextCost); if (better) { next = c; nextCost = s.cost; nextCan = s.k === 'can'; } }
      const sig = s.k + '|' + s.txt;
      if (sig !== c.sig) {
        c.sig = sig;
        if (s.k !== c.k) { if (c.k) c.el.classList.remove('is-' + c.k); c.k = s.k; c.el.classList.add('is-' + s.k); }
        c.stT.textContent = s.txt;
        const ic = ST_ICON[s.k]; if (ic !== c.ic) { c.ic = ic; c.stI.textContent = ''; ico(c.stI, ic, 20); }
      }
      const q = s.k === 'poor' ? Math.round(U.clamp(s.f, 0, 1) * 50) : -1;
      if (q !== c.q) { c.q = q; c.bar.style.transform = 'scaleX(' + (q < 0 ? 0 : q / 50) + ')'; }
      c.why = s.why || '';
    }
    if (next !== T.next) { if (T.next) T.next.el.classList.remove('mx-next'); T.next = next; if (next) next.el.classList.add('mx-next'); }
    for (const R of T.rungs) { const on = R.can > 0; if (on !== R.on) { R.on = on; R.el.classList.toggle('mx-hascan', on); } }
    const hint = nCan ? 'Toque no cartão dourado pra comprar.' : next ? 'Junte ' + yen(nextCost) + ' pra comprar: ' + next.title + '.' : 'Você já comprou tudo. Parabéns!';
    if (hint !== T.hintSig) { T.hintSig = hint; T.hint.textContent = hint; T.hint.classList.toggle('mx-hint-go', !!nCan); }
    let own = S.tool + 1; for (const n of D.TREE) if (S.own[n.id]) own++;   // conta a árvore toda, não só os cartões montados
    const total = D.TOOLS.length + D.TREE.length, pg = own + ' de ' + total + ' compradas';
    if (pg !== T.progSig) { T.progSig = pg; T.progTx.textContent = pg; T.progFill.style.transform = 'scaleX(' + (total ? own / total : 0) + ')'; }
    const lb = 'Dá pra comprar' + (nCan ? ' (' + nCan + ')' : ''); T.fCan.set({ title: lb });
    const emp = T.only && !nCan; if (emp !== T.emptyOn) { T.emptyOn = emp; T.empty.style.display = emp ? 'block' : ''; }
  }
  function treeScroll() {
    const tg = (T.next && T.next.el) || T.here; if (!tg || !T.body) return;
    requestAnimationFrame(() => {
      const a = tg.getBoundingClientRect(), b = T.body.getBoundingClientRect(); if (!b.height) return;
      const top = T.body.querySelector('.mx-top'), th = top && getComputedStyle(top).position === 'sticky' ? top.offsetHeight : 0;
      T.body.scrollTop += a.top - b.top - th - Math.max(8, (b.height - th - a.height) * 0.3);
    });
  }
  function treeOpenAt() { if (T.only) treeFilter(false); else { treeSync(); treeScroll(); } }
  function tapCard(c) {
    const s = stateOf(c);
    if (s.k === 'done') { sfx('click'); c.el.classList.remove('mx-bounce'); void c.el.offsetWidth; c.el.classList.add('mx-bounce'); return; }
    if (s.k !== 'can') { shake(c.el); UI.toast(s.why || s.txt, { icon: s.k === 'lock' ? 'lock' : 'yen', tone: 'bad', sub: c.title }); return; }
    if (c.kind === 'tool') { tp.close(); api.buyTool(); return; }   // a festa da máquina nova acontece no jogo: sai da frente
    if (api.buyNode(c.n.id)) { c.el.classList.remove('mx-stamp'); void c.el.offsetWidth; c.el.classList.add('mx-stamp'); treeSync(); }
    else shake(c.el);
  }

  /* ======================================================================
     AJUSTES
     ====================================================================== */
  function settingsInit() {
    aj = UI.panel({ title: 'Ajustes', icon: 'gear', side: 'right', cls: 'mx-panel mx-aj', onOpen: () => ajSync() });
    foot(aj);
    const b = aj.body;
    h('div', 'ux-hint mx-hint', b, 'Toque pra ligar ou desligar.');

    h('div', 'k-h', b, 'Som');
    UI.toggle(b, { icon: 'sound', label: 'Sons', sub: 'barulhinhos do jogo', value: !S.opts.mute, onChange: v => api.setOpt('mute', !v) });
    UI.toggle(b, { icon: 'music', label: 'Música', sub: 'música japonesa de fundo', value: !!S.opts.music, onChange: v => api.setOpt('music', v) });

    h('div', 'k-h', b, 'Tamanho da letra');
    const seg = h('div', 'mx-fs', b), fsB = [];
    ['Normal', 'Grande', 'Maior', 'Enorme'].forEach((nm, i) => {
      const bt = h('button', 'ux-btn mx-fsbtn mx-fs' + i, seg); bt.type = 'button'; bt.setAttribute('aria-label', 'Letra ' + nm);
      h('span', 'mx-fs-a', bt, 'A'); h('b', null, bt, nm);
      bt.addEventListener('click', () => { sfx('click', { pitch: 0.9 + i * 0.15 }); api.setOpt('fs', i); applyLook(); fsMark(); });
      fsB.push(bt);
    });
    const fsMark = () => fsB.forEach((bt, i) => bt.classList.toggle('mx-on', (S.opts.fs | 0) === i));
    fsMark();
    h('div', 'mx-fsdemo', b, 'O Kome cava arroz pra comprar a casa.');

    h('div', 'k-h', b, 'Jogo');
    let tgShake = null;
    UI.toggle(b, { icon: 'star', label: 'Menos movimento', sub: 'sem tremor e sem coisa piscando', value: !!S.opts.calm, onChange: v => {
      api.setOpt('calm', !!v); if (v && S.opts.shake) { api.setOpt('shake', false); if (tgShake) tgShake.set(false, true); } applyLook(); } });
    tgShake = UI.toggle(b, { icon: 'bolt', label: 'Tela treme', sub: 'quando a máquina bate forte', value: !!S.opts.shake, onChange: v => api.setOpt('shake', v) });
    UI.toggle(b, { icon: 'mount', label: 'Fundo em quadradinhos', sub: 'céu e morros no estilo do Kome', value: S.opts.pixel !== false, onChange: v => api.setOpt('pixel', v) });
    UI.toggle(b, { icon: 'check', label: 'Cores mais fortes', sub: 'letra e contorno mais escuros', value: !!S.opts.hc, onChange: v => { api.setOpt('hc', !!v); applyLook(); } });

    h('div', 'k-h', b, 'Botão de cavar');
    const cvS = h('div', 'mx-fs mx-cavar', b), cvB = [];
    [['segurar', 'Segurar', 'aperta e segura'], ['alternar', 'Liga e desliga', 'um toque liga'], ['auto', 'Sozinho', 'cava sem apertar']].forEach(q => {
      const bt = h('button', 'ux-btn mx-fsbtn', cvS); bt.type = 'button'; bt.setAttribute('aria-label', 'Cavar: ' + q[1]);
      h('b', null, bt, q[1]); h('small', null, bt, q[2]);
      bt.addEventListener('click', () => { sfx('click'); api.setOpt('cavar', q[0]); cvMark(); });
      cvB.push([bt, q[0]]);
    });
    const cvMark = () => cvB.forEach(q => q[0].classList.toggle('mx-on', (S.opts.cavar || 'segurar') === q[1]));
    cvMark();
    // celular: menos avisos e 30 quadros/s por padrão (não esquenta o aparelho)
    const mob0 = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const seg = (title, key, def, opts) => {
      h('div', 'k-h', b, title);
      const box = h('div', 'mx-fs mx-cavar', b), bs = [];
      const mark = () => bs.forEach(q => q[0].classList.toggle('mx-on', (S.opts[key] || def) === q[1]));
      opts.forEach(q => {
        const bt = h('button', 'ux-btn mx-fsbtn', box); bt.type = 'button'; bt.setAttribute('aria-label', title + ': ' + q[1]);
        h('b', null, bt, q[1]); h('small', null, bt, q[2]);
        bt.addEventListener('click', () => { sfx('click'); api.setOpt(key, q[0]); mark(); });
        bs.push([bt, q[0]]);
      });
      mark();
    };
    h('div', 'k-h', b, 'Zoom (ou faça pinça com 2 dedos)');
    { const box = h('div', 'mx-fs mx-cavar', b);
      [['−', 'Afastar', 1 / 1.15], ['1×', 'Normal', 0], ['+', 'Aproximar', 1.15]].forEach(q => {
        const bt = h('button', 'ux-btn mx-fsbtn', box); bt.type = 'button'; bt.setAttribute('aria-label', 'Zoom: ' + q[1]);
        h('b', null, bt, q[0]); h('small', null, bt, q[1]);
        bt.addEventListener('click', () => { sfx('click'); S.zoomMul = q[2] ? U.clamp((S.zoomMul || 1) * q[2], 0.55, 1.9) : 1; });
      }); }
    seg('Avisos na tela', 'avisos', mob0 ? 'poucos' : 'normal', [['poucos', 'Poucos', 'só o importante'], ['normal', 'Normal', 'todos os avisos']]);
    seg('Economia de bateria', 'fps', mob0 ? 30 : 60, [[30, '30 fps', 'esquenta menos'], [60, '60 fps', 'mais suave']]);
    UI.toggle(b, { icon: 'swap', label: 'Modo canhoto', sub: 'troca os botões de lado', value: !!S.opts.canhoto, onChange: v => { api.setOpt('canhoto', !!v); applyLook(); } });

    h('div', 'k-h', b, 'Ajuda');
    // (dicas.js e cookie-ui.js penduram as chaves deles aqui, antes do título "Salvar")

    h('div', 'k-h', b, 'Salvar');
    h('div', 'mx-note', b, 'O jogo salva sozinho. Aqui você guarda uma cópia.');
    const sv = h('div', 'mx-save', b);
    const fail = () => UI.toast('Essa cópia não abriu', { icon: 'x', tone: 'bad', sub: 'confira se é o arquivo certo' });
    const bring = str => { str = String(str || '').trim(); if (!str) return;
      UI.confirm('O jogo de agora sai e entra o da cópia.', () => { if (!api.importStr(str)) fail(); }, { title: 'Trazer a cópia?', yes: 'Trazer', no: 'Deixa pra lá' }); };
    const copy = () => {
      const s = api.exportStr(), done = () => UI.toast('Cópia copiada', { icon: 'check', sub: 'cole num lugar seguro (ex.: conversa com você mesmo)' });
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(done, () => window.prompt('Copie este texto e guarde:', s)); else window.prompt('Copie este texto e guarde:', s);
    };
    big(sv, { icon: 'savedown', title: 'Guardar cópia', sub: 'baixa um arquivo', cls: 'ux-main', onClick: () => {
      try {
        const s = api.exportStr(), d = new Date(), stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/plain' })); a.download = 'kome-save-' + stamp + '.txt';
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        UI.toast('Cópia guardada', { icon: 'check', sub: 'arquivo kome-save, na pasta de downloads' });
      } catch (e) { copy(); }
    } });
    big(sv, { icon: 'saveup', title: 'Trazer cópia', sub: 'abre um arquivo', onClick: () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.txt,.json,text/plain';
      inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => bring(fr.result); fr.onerror = fail; fr.readAsText(f); };
      inp.click();
    } });
    h('div', 'mx-note mx-note-sm', b, 'Sem arquivo? Dá pra usar texto:');
    const sv2 = h('div', 'mx-save mx-save2', b);
    big(sv2, { icon: 'book', title: 'Copiar texto', iconSize: 20, onClick: copy });
    big(sv2, { icon: 'book', title: 'Colar texto', iconSize: 20, onClick: () => bring(window.prompt('Cole aqui o texto da cópia:')) });

    h('div', 'k-h', b, 'Recomeçar');
    const re = h('div', 'mx-save mx-col', b);
    M._newBtn = big(re, { icon: 'mount', title: 'Nova montanha', sub: '', onClick: (e, el) => {
      if (!S.ended) { shake(el); UI.toast('Termine a casa primeiro', { icon: 'lock', tone: 'bad', sub: 'Nova montanha abre depois do final' }); return; }
      if (api.newMountain && api.newMountain()) aj.close();
    } });
    big(re, { icon: 'x', title: 'Apagar tudo', sub: 'começa do zero, sem volta', cls: 'mx-danger', onClick: () =>
      UI.confirm('Some a montanha, a árvore e a casa. O Kome começa do zero.', () => api.reset(), { title: 'Apagar tudo mesmo?', yes: 'Apagar', no: 'Deixa pra lá', danger: true }) });
    return aj;
  }
  function ajSync() {
    if (!M._newBtn) return;
    M._newBtn.set({ sub: S.ended ? 'tudo que comprou continua' : 'abre depois do final' });
    M._newBtn.el.classList.toggle('ux-lock', !S.ended);
  }

  /* ======================================================================
     MENU DO KOME: blocos grandes; travado fica cinza e diz o que falta
     ====================================================================== */
  M.openMenu = function () {
    if (!api) return null;
    if (!menuPanel) (menuPanel = UI.panel({ title: 'Menu do Kome', icon: 'chest', side: 'right', cls: 'mx-panel mx-menu k-menupanel' })), foot(menuPanel);
    const b = menuPanel.body; b.textContent = '';
    h('div', 'ux-hint mx-hint', b, 'Toque aonde você quer ir.');
    const grid = h('div', 'mx-tiles', b);
    const hd = S.homeData || {}, own = hd.own || {}, ach = S.stats.ach ? Object.keys(S.stats.ach).length : 0;
    const closet = (S.closet || []).length, ended = !!S.ended, things = Object.keys(own).filter(k => k.indexOf('th_') < 0).length;
    let nBuy = 0; for (const n of D.TREE) if (!S.own[n.id] && api.nodeState(n) === 'open' && S.money >= api.nodeCost(n)) nBuy++;
    const go = fn => () => { menuPanel.close(); setTimeout(fn, 120); };
    const END = 'Abre quando a casa ficar pronta';
    const tiles = [
      { icon: 'tree', t: 'Árvore', s: nBuy ? nBuy + ' pra comprar agora' : 'máquinas e melhorias', hot: nBuy > 0, fn: go(() => tp.open()) },
      { icon: 'house', t: 'Casa do Kome', s: things ? things + (things > 1 ? ' coisas no quintal' : ' coisa no quintal') : 'enfeitar o quintal', hot: !!hd.newAch, fn: go(() => api.openHome && api.openHome('jardim')) },
      { icon: 'hat', t: 'Roupinhas', s: closet + ' de ' + D.CLOSET.length + ' achadas', hot: !!hd.newCloth, fn: go(() => api.openHome && api.openHome('roupa')) },
      { icon: 'swap', t: 'Trocar de máquina', s: 'pilotar outra que já é sua', lock: S.tool < 1 && !(api.twinReady && api.twinReady()) ? 'Compre a 2ª máquina primeiro' : '', fn: go(() => M.openSwap()) },
      { icon: 'book', t: 'Caderno', s: ach + ' de 30 conquistas', fn: go(() => api.openHome && api.openHome('caderno')) },
      { icon: 'bolt', t: 'Oficina', s: 'deixar as máquinas mais fortes', lock: ended ? '' : END, fn: go(() => G.Inf && G.Inf.open()) },
      { icon: 'boat', t: 'Ilhas', s: 'viajar pra outra ilha', lock: ended || (S.stats.islandsDone | 0) ? '' : END, fn: go(() => (G.IslandsUI ? G.IslandsUI.open() : api.openHome && api.openHome('ilhas'))) },
      { icon: 'mount', t: 'Nova montanha', s: 'cavar outra montanha', lock: ended ? '' : END, fn: go(() => api.newMountain && api.newMountain()) },
      { icon: 'gear', t: 'Ajustes', s: 'som, letra e salvar', fn: go(() => aj.open()) },
    ];
    for (const it of tiles) {
      const bt = h('button', 'mx-tile' + (it.lock ? ' is-lock' : '') + (it.hot ? ' is-hot' : ''), grid); bt.type = 'button'; bt.setAttribute('aria-label', it.t);
      const a = h('span', 'mx-tile-i', bt); ico(a, it.icon, 36);
      h('b', null, bt, it.t);
      const sm = h('small', null, bt); if (it.lock) ico(sm, 'lock', 16); h('span', null, sm, it.lock || it.s);
      if (it.hot) h('span', 'mx-dot', bt, 'novo');
      bt.addEventListener('click', () => { if (it.lock) { shake(bt); UI.toast(it.lock, { icon: 'lock', tone: 'bad', sub: it.t }); return; } sfx('click'); it.fn(); });
    }
    menuPanel.open();
    return menuPanel;
  };

  /* ======================================================================
     TROCAR DE MÁQUINA: todas as compradas; a de agora em verde
     ====================================================================== */
  M.openSwap = function () {
    if (!api) return null;
    if (!swapPanel) (swapPanel = UI.panel({ title: 'Trocar de máquina', icon: 'swap', side: 'right', cls: 'mx-panel mx-swap' })), foot(swapPanel);
    const b = swapPanel.body; b.textContent = '';
    h('div', 'ux-hint mx-hint', b, 'Toque na máquina que você quer pilotar.');
    const col = h('div', 'mx-swaplist', b);
    const now = api.playing && api.playing(), twin = !!(api.twinPlaying && api.twinPlaying());
    const row = (id, name, line, on, fn) => {
      const e = h('button', 'mx-card mx-tool ' + (on ? 'is-done' : 'is-can'), col); e.type = 'button'; e.setAttribute('aria-label', name);
      const art = h('span', 'mx-art', e); ico(art, propIcon(id), 52);
      const tx = h('span', 'mx-tx', e); h('b', null, tx, name); h('small', null, tx, line);
      const st = h('span', 'mx-st', e), si = h('span', 'mx-st-i', st); ico(si, on ? 'check' : 'swap', 20); h('span', null, st, on ? 'Você está nela' : 'Pilotar');
      e.addEventListener('click', () => { if (on) { sfx('click'); e.classList.remove('mx-bounce'); void e.offsetWidth; e.classList.add('mx-bounce'); return; } sfx('click'); if (fn()) swapPanel.close(); else shake(e); });
    };
    if (api.twinReady && api.twinReady()) row('bagger', 'Bagger Gêmea', 'maior, com duas rodas: cava em dobro', twin, () => api.playAs(S.tool, true));
    for (let i = S.tool; i >= 0; i--) { const t = D.TOOLS[i]; row(t.id, t.name, toolLine(t), !twin && now === t, () => api.playAs(i)); }
    h('div', 'mx-note', b, 'Um amigo cuida da outra máquina. O ganho por segundo não muda.');
    swapPanel.open();
    return swapPanel;
  };

  /* ---------- init: chamado pelo HUD.init ---------- */
  M.init = function (a) {
    api = a; S = G.S;
    if (!UI) return null;
    if (UI.defineIcon) {
      UI.defineIcon('savedown', P => { P.rect(2, 12, 12, 3, '#3B2818').rect(3, 13, 10, 1, '#F2C230').rect(7, 1, 2, 7, '#3B2818').poly([[3, 7], [13, 7], [8, 12]], '#3B2818'); });
      UI.defineIcon('saveup', P => { P.rect(2, 12, 12, 3, '#3B2818').rect(3, 13, 10, 1, '#6DBF67').rect(7, 5, 2, 6, '#3B2818').poly([[3, 6], [13, 6], [8, 1]], '#3B2818'); });
    }
    if (S.opts.calm === undefined && E.reducedMotion) S.opts.calm = true;   // o aparelho já pede menos movimento
    applyLook();
    for (const n of D.TREE) n.desc = fxText(n);
    treeInit(); settingsInit();
    M.tree = { el: T.list, refresh: treeSync, openAt: treeOpenAt };
    M.treePanel = tp; M.settings = aj;
    return M;
  };
  M.applyLook = () => { if (S) applyLook(); };
  M.fxText = fxText;
})();
