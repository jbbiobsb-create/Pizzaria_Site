/* Kome no Japão — amuletos-ui.js
   TELA DOS AMULETOS (omamori): escolha de 1 entre 3 cartas grandes (vira, brilha, carimba), botão de rerrolar (sementes),
   "depois" (o chip do HUD fica piscando até você escolher), fila da build no HUD (chip "Amuletos" com até 5 ícones; toque abre
   a build com o texto de cada um e os conjuntos acesos) e a seção de amuletos descobertos no Caderno (goals.js chama
   G.AmuletosUI.caderno). Só apresentação: as contas moram em game/amuletos.js (G.Amuletos).
   Ícone de cada amuleto: saquinho omamori em pixel (texto pro E.spriteText, cor da 1ª etiqueta, nó na cor da raridade) com o
   desenho da ficha (ícone de ferramenta do G.Props, onigiri, saco ou ícone do E.UI) na etiqueta branca.
   Demo: index.html?dev&amuleto=demo (abre a escolha com 3 cartas sorteadas, sem mexer no save de verdade). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.U) return;
  const UI = E.UI, INK = '#3B2818';
  const DEMO = /[?&]amuleto=demo\b/.test(location.search || '');
  const A = () => G.Amuletos;

  /* ---------- ícone: omamori em pixel ---------- */
  const BAG = `
    .....QQQQ.....
    ....Q....Q....
    .....QQQQ.....
    ......QQ......
    ...XXXXXXXX...
    ..XXXXXXXXXX..
    .XXXXXXXXXXXX.
    .XWWWWWWWWWWX.
    .XWWWWWWWWWWX.
    .XWWWWWWWWWWX.
    .XWWWWWWWWWWX.
    .XWWWWWWWWWWX.
    .XWWWWWWWWWWX.
    .XWWWWWWWWWWX.
    .XWWWWWWWWWWX.
    .XXXXXXXXXXXX.
    .XQXQXQXQXQXX.
    .XXXXXXXXXXXX.
    ..xxxxxxxxxx..`;
  const RIM = { comum: '#C9A060', raro: '#7FB6F0', lendario: '#FFD84A' };
  const dark = c => E.U.mixCss ? E.U.mixCss(c, INK, 0.35) : c;
  const icC = {};
  function glyph(id, z) {
    z = z || 48;
    try {
      const P = G.Props;
      if (P && P.ids && P.ids.indexOf(id) >= 0) return UI.icon(P.icon(id), z);
      if (P && id === 'onigiri') return UI.icon(P.onigiri().cv, z);
      if (P && id === 'sack_gold') return UI.icon(P.sack('golden').cv, z);
      if (P && id === 'sack_leg') return UI.icon(P.sack('legendary').cv, z);
      if (P && id === 'coin') return UI.icon(P.coin().cv, z);
      return UI.icon(id || 'star', z) || UI.icon('star', z);
    } catch (e) { return UI.icon('star', z); }
  }
  // art(x) -> canvas-fonte (64x84) do omamori daquele amuleto (cache)
  function art(x) {
    if (!x) return null;
    if (icC[x.id]) return icC[x.id];
    const tag = A().TAGS[x.tags[0]] || { c: '#B8564A' }, col = tag.c;
    const bag = E.spriteText('omamori_' + (x.tags[0] || 'x') + '_' + x.rar, BAG, { pal: { X: col, x: dark(col), Q: RIM[x.rar] || RIM.comum } });
    const k = 4, cv = document.createElement('canvas'); cv.width = bag.width * k; cv.height = bag.height * k;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(bag, 0, 0, cv.width, cv.height);
    const gl = glyph(x.icon);
    if (gl) { const bx = 3 * k, by = 8 * k, bw = 10 * k, bh = 8 * k, s = Math.min(bw / gl.width, bh / gl.height) * 0.95, w = gl.width * s, h = gl.height * s; g.drawImage(gl, bx + (bw - w) / 2, by + (bh - h) / 2, w, h); }
    return (icC[x.id] = cv);
  }
  function icon(x, size) { const c = art(x); return c ? UI.icon(c, size || 40) : UI.icon('star', size || 40); }

  /* ---------- CSS: game/ux-amuletos.css (.k-am-* da tela, .ux-cad-* / .ux-amc / .ux-evo / .ux-esc do Caderno) ---------- */

  /* ---------- texto de cada amuleto: 1 frase do que GANHA (verde) + 1 do que CUSTA (marrom), cada uma com o ícone do tipo
     de efeito (pata, motor, saco, combo…). Frases: campos bom/ruim da ficha. Ícone: sai do 1º gancho bom/ruim do fx. ---------- */
  const FXI = { mao: 'pata', maoPow: 'pata', motor: 'trator', motorDig: 'trator', porMaquina: 'trator', hm: 'paw', help: 'paw', frota: 'paw', porFerramenta: 'paw',
    fab: 'gear', sell: 'rice', val: 'rice', slide: 'rice', sack: 'sack', sackRate: 'sack', sackFloor: 'sack', autosack: 'sack', comboGain: 'bolt', comboDecay: 'bolt', furia: 'bolt', maratona: 'bolt',
    crit: 'star', critMult: 'star', preco: 'yen', kome: 'pa', dig: 'pa', spd: 'pa', reach: 'pa', stomp: 'pa', noite: 'clock', dia: 'clock', offline: 'clock', offCap: 'clock', rush: 'clock', fora: 'clock',
    estimacao: 'clock', gold: 'chest', regrow: 'chest', oni: 'onigiri', porAmuleto: 'trophy', conjunto2: 'trophy' };
  const PLUS = { help: 1, crit: 1, porMaquina: 1, porFerramenta: 1, porAmuleto: 1, furia: 1, stomp: 1, autosack: 1, slide: 1, oni: 1, regrow: 1, conjunto2: 1, offCap: 1, sackFloor: 1, estimacao: 1, maratona: 1 };
  const LOW = { preco: 1, comboDecay: 1 }, AUX = { rushSec: 1, estimacaoMax: 1, maratonaX: 1 };
  function fxIcon(x, good) {
    const v = (x.fx && x.fx.values) || {};
    for (const k in v) { if (AUX[k] || !FXI[k]) continue; const n = +v[k], g = PLUS[k] ? n > 0 : LOW[k] ? n < 1 : n >= 1; if (g === good) return FXI[k]; }
    return good ? x.icon : 'clock';
  }
  function lines(parent, x) {
    const box = el('div', 'k-am-lns', parent);
    const ln = (txt, good) => { const r = el('div', 'k-am-ln ' + (good ? 'g' : 'b'), box); const ic = glyph(fxIcon(x, good), 22); if (ic) r.appendChild(ic); el('span', null, r, txt); };
    if (x.good) ln(x.good, true); if (x.bad) ln(x.bad, false);
    if (!x.good && !x.bad) el('div', 'k-am-ln', box, x.d);
    return box;
  }
  const short = x => (x.good || x.d) + (x.bad ? ' · ' + x.bad : '');
  // etiqueta em palavra simples ("2 de 3 da Sorte")
  const TG = { mao: { n: 'Pata', de: 'da Pata', q: 'ferramentas de mão' }, motor: { n: 'Motor', de: 'do Motor', q: 'máquinas a motor' }, sorte: { n: 'Sorte', de: 'da Sorte', q: 'sacos e sorte' },
    fabrica: { n: 'Fábrica', de: 'da Fábrica', q: 'fábrica e preços' }, equipe: { n: 'Turma', de: 'da Turma', q: 'ajudantes e frota' } };
  const tg = t => TG[t] || { n: t, de: 'de ' + t, q: '' };

  /* ---------- casca (palco lógico 880x470 deitado / 440x820 em pé: letra maior no celular) ---------- */
  const root = document.createElement('div'); root.className = 'k-am';
  const V = document.createElement('div'); V.className = 'k-am-v'; root.appendChild(V);
  let k = 1, mounted = false;
  function fit() {
    const w = innerWidth, h = innerHeight, port = h > w;
    k = port ? Math.min(w / 440, h / 820) : Math.min(w / 880, h / 470);
    V.style.width = (w / k) + 'px'; V.style.height = (h / k) + 'px'; V.style.transform = 'scale(' + k + ')';
    root.classList.toggle('port', port);
  }
  function mount() {
    if (mounted) return; mounted = true; document.body.appendChild(root); fit(); addEventListener('resize', fit);
    addEventListener('keydown', e => { if (e.key !== 'Escape' || (!open && !panel)) return; e.stopPropagation(); if (panel) panel.done(); else later(); }, true);   // Esc fecha igual ao X
  }
  function el(tag, cls, parent, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (parent) parent.appendChild(e); return e; }
  function btn(parent, txt, cls, fn) { const b = el('button', 'k-am-b' + (cls ? ' ' + cls : ''), parent, txt); b.type = 'button'; b.addEventListener('click', e => { e.stopPropagation(); fn(e); }); return b; }
  function sfx(n, o) { const S = G.S; if ((S && S.opts && S.opts.mute) || !E.Sfx || !E.Sfx.play) return; if (E.Sfx.has && !E.Sfx.has(n)) return; try { E.Sfx.play(n, o); } catch (e) { /* */ } }
  function shake(e) { e.classList.remove('ux-shake'); void e.offsetWidth; e.classList.add('ux-shake'); }
  // "2 de 3 da Sorte" (progresso do trio daquela etiqueta); plus = conta mais 1 (a carta que você está olhando)
  function setChip(parent, t, plus) {
    const n = Math.min(A().need(), (A().tagCount(A().current().map(c => c.id))[t] | 0) + (plus ? 1 : 0)), need = A().need(), full = n >= need && A().sets[t];
    const s = el('span', 'k-am-tag' + (full ? ' full' : ''), parent, full && plus ? 'Fecha o trio ' + tg(t).de + '!' : n + ' de ' + need + ' ' + tg(t).de);
    s.style.background = full ? '' : (A().TAGS[t] || { c: '#888' }).c; return s;
  }

  /* ---------- tela de escolha: toque numa carta = marca; botão dourado "Escolher" na carta marcada = confirma ---------- */
  let open = null, busyPick = false, demoCards = null;
  const HINT0 = () => ((G.S && G.S.stats.amPick | 0) < 3 || DEMO ? 'Amuleto = um poder que dá mais ¥ nesta ilha. Toque numa carta.' : 'Toque numa carta pra ver e escolher.');
  function select(o) {
    if (busyPick || !open) return;
    if (open.sel === o) { choose(o.x, o.el); return; }   // 2º toque na mesma carta também confirma
    open.sel = o; sfx('click');
    for (const c of open.cards) c.el.classList.toggle('sel', c === o);
    open.hint.textContent = 'Quer o ' + o.x.n + '? Toque em Escolher. Ou veja outra carta.';
  }
  function cardEl(parent, x, i) {
    const c = el('div', 'k-am-card r-' + x.rar, parent); c.style.setProperty('--d', (i * 0.1) + 's');
    c.setAttribute('role', 'button'); c.tabIndex = 0; c.setAttribute('aria-label', x.n + ': ' + short(x));
    const inn = el('div', 'k-am-in', c);
    const back = el('div', 'k-am-face k-am-back', inn); el('span', null, back, '守');
    const f = el('div', 'k-am-face k-am-front', inn);
    el('div', 'k-am-rar', f, A().RAR[x.rar] ? A().RAR[x.rar].n : x.rar);
    const artB = el('div', 'k-am-art', f); artB.appendChild(icon(x, 68));
    const tb = el('div', 'k-am-tb', f);
    el('div', 'k-am-nm', tb, x.n); lines(tb, x);
    const z = el('div', 'k-am-z', tb), tgs = el('div', 'k-am-tags', z); for (const t of x.tags) setChip(tgs, t, true);
    const o = { x, el: c };
    const go = el('button', 'k-am-go', z, 'Escolher'); go.type = 'button'; go.insertBefore(UI.icon('check', 24), go.firstChild);
    go.addEventListener('click', e => { e.stopPropagation(); if (open && open.sel === o) choose(x, c); else select(o); });
    const stp = el('div', 'k-am-stamp', c); el('b', null, stp, '守'); el('span', null, stp, 'ESCOLHIDO');
    c.addEventListener('click', e => { e.stopPropagation(); select(o); });
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(o); } });
    setTimeout(() => sfx('shing', { vol: 0.35 }), (i * 0.1 + 0.45) * 1000);
    return o;
  }
  function later() { if (busyPick || !open) return; sfx('click'); api.later = true; close(); }
  function render() {
    if (!open) return;
    const w = open.wrap; w.innerHTML = ''; open.sel = null;
    const box = el('div', 'k-am-box', w);
    const cards = DEMO && demoCards ? demoCards : A().offer() || [];
    const n = A().current().length;
    const tt = el('div', 'k-am-title', box, 'Escolha 1 amuleto'); el('small', null, tt, (n + 1) + ' de ' + A().max() + ' desta ilha');
    open.hint = el('div', 'k-am-hint', box, HINT0());
    const row = el('div', 'k-am-row', box); open.cards = cards.map((x, i) => cardEl(row, x, i));
    const ft = el('div', 'k-am-foot', box), c = A().rerollCost(), have = A().seeds(), can = have >= c;
    const cb = A().current();
    if (cb.length) { const b = el('div', 'k-am-build', ft); el('span', null, b, 'Você já tem:'); for (const x of cb) b.appendChild(icon(x, 30)); }
    open.rr = btn(ft, 'Trocar as 3', can ? 'gold2' : 'off', () => {
      if (busyPick) return;
      if (DEMO) { demoCards = sample(); render(); sfx('whoosh'); return; }
      if (!A().reroll()) { sfx('error', { vol: 0.5 }); shake(open.rr); open.hint.textContent = 'Faltam sementes pra trocar (custa ' + c + ', você tem ' + have + '). Sementes vêm das viagens.'; return; }
      sfx('whoosh'); render();
    });
    open.rr.insertBefore(UI.icon('swap', 24), open.rr.firstChild);
    el('small', null, open.rr, c === 0 ? 'grátis (carta do dia)' : 'custa ' + c + (c > 1 ? ' sementes' : ' semente') + ' · você tem ' + have);
    const dp = btn(ft, 'Depois', '', later); dp.insertBefore(UI.icon('clock', 24), dp.firstChild); el('small', null, dp, 'as cartas ficam guardadas');
  }
  function choose(x, c) {
    if (busyPick || !open) return; busyPick = true;
    c.classList.add('pick'); for (const o of open.cards) if (o.el !== c) o.el.classList.add('gone');
    sfx('stomp', { vol: 0.6 }); setTimeout(() => sfx('sparkle'), 200);
    const res = DEMO ? { amuleto: x, sets: [] } : A().pick(x.id);
    setTimeout(() => {
      busyPick = false; close();
      if (!res) return;
      if (UI && UI.banner) UI.banner('Amuleto: ' + x.n, short(x), { icon: art(x), tone: 'gold', dur: 3 });
      for (const s of res.sets || []) setTimeout(() => { sfx('fanfare'); if (UI && UI.banner) UI.banner(s.n + '!', 'Trio fechado: ' + s.d, { icon: 'star', tone: 'gold', dur: 3.5 }); }, 1600);
      chipTick(true);
    }, 950);
  }
  function sample() { const L = A().list().slice(); const out = []; while (out.length < 3 && L.length) out.push(L.splice((Math.random() * L.length) | 0, 1)[0]); return out; }
  function openChoice() {
    if (open || !A()) return false;
    if (!DEMO && (!A().pending() || A().fast())) return false;
    mount(); api.later = false;
    const dim = el('div', 'k-am-dim', V), wrap = el('div', 'k-am-wrap', V);
    const x = el('button', 'k-am-x k-am-xc', V, '×'); x.type = 'button'; x.setAttribute('aria-label', 'fechar e escolher depois');
    x.addEventListener('click', e => { e.stopPropagation(); later(); });
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.classList.contains('k-am-box') || e.target.classList.contains('k-am-row')) later(); });   // tocar fora = Depois (seguro)
    open = { dim, wrap, x, cards: [], sel: null };
    void dim.offsetWidth; dim.classList.add('on');
    sfx('whoosh', { vol: 0.5 });
    render(); return true;
  }
  function close() {
    if (!open) return;
    const o = open; open = null; o.dim.classList.remove('on'); o.wrap.style.transition = 'opacity .25s'; o.wrap.style.opacity = '0'; o.x.remove();
    setTimeout(() => { o.dim.remove(); o.wrap.remove(); }, 280);
  }

  /* ---------- painel "Seus amuletos" (toque no chip): os da ilha, as vagas que faltam e os trios ---------- */
  let panel = null;
  const QUANDO = { chegada: 'na chegada da ilha', motor: 'na 1ª máquina a motor', escav: 'ao comprar a Escavadeira', bagger: 'ao comprar a Bagger', patio: 'quando a casa ficar pronta' };
  function openBuild() {
    if (panel || open) return;
    if (A().pending()) { openChoice(); return; }
    mount();
    const dim = el('div', 'k-am-dim', V); void dim.offsetWidth; dim.classList.add('on');
    const p = el('div', 'k-am-panel', V), cur = A().current(), max = A().max();
    const h = el('div', 'k-am-ph', p); h.appendChild(UI.icon('star', 34));
    const t = el('h2', null, h, 'Seus amuletos'); el('small', null, t, cur.length + ' de ' + max + ' nesta ilha');
    const x = el('button', 'k-am-x', h, '×'); x.type = 'button'; x.setAttribute('aria-label', 'fechar');
    const L = el('div', 'k-am-pl', p);
    el('div', 'k-am-hint', L, 'Cada amuleto dá mais ¥ só nesta ilha. Na viagem, você escolhe de novo.');
    for (const a of cur) {
      const r = el('div', 'k-am-it r-' + a.rar, L); r.appendChild(icon(a, 48));
      const d = el('div', null, r); el('b', null, d, a.n); lines(d, a);
    }
    const falta = (A().MARCOS || []).filter(m => { try { return !m.ok(); } catch (e) { return false; } });
    for (let i = cur.length, j = 0; i < max; i++, j++) {
      const r = el('div', 'k-am-it vazio', L); el('u', null, r, '+');
      const d = el('div', null, r); el('b', null, d, 'Vaga livre'); el('span', null, d, falta[j] ? 'Você ganha ' + (QUANDO[falta[j].id] || falta[j].n) + '.' : 'Você ganha mais pra frente.');
    }
    el('div', 'k-am-sh', L, 'Trios: ' + A().need() + ' amuletos do mesmo tipo dão um bônus');
    const n = A().tagCount(cur.map(c => c.id)), lit = A().lit(), need = A().need();
    for (const tt in A().sets) {
      const s = A().sets[tt], on = lit.indexOf(tt) >= 0, m = Math.min(n[tt] | 0, need), r = el('div', 'k-am-set' + (on ? ' on' : m ? '' : ' zero'), L);
      const dots = el('div', 'k-am-dots', r); for (let i = 0; i < need; i++) { const dd = el('i', i < m ? 'on' : '', dots); if (i < m) dd.style.background = A().TAGS[tt].c; }
      const d = el('div', null, r); el('b', null, d, (on ? 'Fechado! ' : '') + m + ' de ' + need + ' ' + tg(tt).de); el('span', null, d, (on ? 'Bônus ligado: ' : 'Bônus: ') + s.d);
    }
    const done = () => { if (!panel) return; panel = null; dim.remove(); p.remove(); };
    x.addEventListener('click', e => { e.stopPropagation(); sfx('click'); done(); });
    dim.addEventListener('pointerdown', e => { if (e.target === dim) done(); });
    panel = { done };
    sfx('whoosh', { vol: 0.4 });
  }

  /* ---------- chip do HUD: ícones da build + palavra; pisca "Escolha!" quando tem escolha pendente; trio fechado brilha ---------- */
  let chip = null, chipKey = '';
  function chipTick(force) {
    if (!A()) return;
    if (!chip) { if (!G.HUD || !G.HUD.ready || !G.HUD.chip) return; chip = G.HUD.chip({ id: 'amuletos', icon: 'star', label: 'Amuletos', order: 6, tone: '#FFF0C4', show: false, onClick: () => { sfx('click'); openBuild(); } }); if (!chip) return; }
    const run = A().run(), cur = A().current(), pend = A().pending(), lit = A().lit();
    const key = run + '|' + cur.map(c => c.id).join(',') + '|' + pend + '|' + lit.join(',');
    if (!force && key === chipKey) return; chipKey = key;
    chip.set({ show: run && (cur.length > 0 || pend), label: pend ? 'Escolha um amuleto!' : cur.length ? cur.length + ' de ' + A().max() : 'Amuletos', hint: pend ? 'Toque pra escolher seu amuleto' : '', prio: pend ? 5 : 0, hot: pend ? 'Escolha!' : '' });
    chip.ic.textContent = '';
    if (cur.length) { const m = el('span', 'k-am-mini', chip.ic); for (const x of cur) m.appendChild(icon(x, 22)); if (pend) m.appendChild(UI.icon('star', 18)); }
    else chip.ic.appendChild(UI.icon('star', 20));
    chip.el.classList.toggle('k-am-lit', lit.length > 0);
    chip.el.title = cur.map(x => x.n + ': ' + short(x)).join('\n') || 'Amuletos';
  }
  setInterval(() => { try { chipTick(false); } catch (e) { /* */ } }, 500);

  /* ---------- Caderno, aba Amuletos (goals.js chama): coleção com "12 de 35", barra e "?" nos que faltam ---------- */
  function caderno(col) {
    if (!A() || !UI || !UI.el) return;
    const L = A().list(), disc = A().discovered(), n = L.filter(x => disc[x.id]).length;
    const hd = el('div', 'ux-cad-head', col); el('b', null, hd, 'Amuletos'); el('span', null, hd, n + ' de ' + L.length);
    el('i', null, el('div', 'ux-cad-bar', col)).style.transform = 'scaleX(' + (L.length ? n / L.length : 0) + ')';
    el('div', 'ux-hint', col, 'Escolha um amuleto numa ilha e ele entra aqui pra sempre.');
    const g = el('div', 'ux-amg', col);
    for (const x of L) {
      const ok = !!disc[x.id], c = el('div', 'ux-amc' + (ok ? ' ok r-' + x.rar : ''), g);
      if (ok) { c.appendChild(icon(x, 48)); const d = el('div', null, c); el('b', null, d, x.n); lines(d, x); if (x.joke) el('em', null, d, x.joke); }
      else {
        el('u', null, c, '?'); const d = el('div', null, c); el('b', null, d, '???');
        el('span', null, d, x.faixa && !A().unlocked(x) ? 'Aparece a partir da ' + (G.Faixas ? G.Faixas.name(x.faixa) : 'faixa ' + x.faixa) + '.' : x.rar === 'lendario' && !A().unlocked(x) ? 'Lendário: uma conquista libera.' : 'Escolha numa ilha pra descobrir.');
      }
    }
  }

  const api = (G.AmuletosUI = { open: openChoice, close, isOpen: () => !!open, later: false, openBuild, caderno, icon, art, chipTick, lines });
  if (DEMO) { const go = () => { if (!A() || !G.HUD || !G.HUD.ready) return setTimeout(go, 300); demoCards = sample(); openChoice(); }; setTimeout(go, 1200); }
})();
