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
  function glyph(id) {
    try {
      const P = G.Props;
      if (P && P.ids && P.ids.indexOf(id) >= 0) return UI.icon(P.icon(id), 48);
      if (P && id === 'onigiri') return UI.icon(P.onigiri().cv, 48);
      if (P && id === 'sack_gold') return UI.icon(P.sack('golden').cv, 48);
      if (P && id === 'sack_leg') return UI.icon(P.sack('legendary').cv, 48);
      if (P && id === 'coin') return UI.icon(P.coin().cv, 48);
      return UI.icon(id || 'star', 48) || UI.icon('star', 48);
    } catch (e) { return UI.icon('star', 48); }
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

  /* ---------- CSS ---------- */
  const css = document.createElement('style');
  css.textContent = `
.k-am{position:fixed;inset:0;z-index:10000;pointer-events:none;font-family:'Zen Maru Gothic','Hiragino Maru Gothic ProN','M PLUS Rounded 1c','Nunito','Varela Round','Arial Rounded MT Bold','Trebuchet MS','Segoe UI',system-ui,sans-serif;color:#2A1A10;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.k-am *{box-sizing:border-box}
.k-am button{font:inherit;color:inherit;margin:0;cursor:pointer;touch-action:manipulation;border:0;background:none;padding:0}
.k-am-v{position:absolute;left:0;top:0;transform-origin:0 0}
.k-am-dim{position:absolute;inset:0;pointer-events:auto;background:radial-gradient(ellipse at 50% 50%,rgba(70,46,20,.62),rgba(20,12,6,.88) 75%);opacity:0;transition:opacity .3s}
.k-am-dim.on{opacity:1}
.k-am-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:14px;pointer-events:none}
.k-am-wrap>*{pointer-events:auto}
.k-am-kick{font-size:17px;font-weight:900;letter-spacing:2px;color:#FFE16A;text-transform:uppercase;text-shadow:0 2px 0 ${INK}}
.k-am-title{font-size:34px;font-weight:900;color:#FFF6E6;-webkit-text-stroke:6px ${INK};paint-order:stroke;line-height:1;text-align:center}
.k-am-row{display:flex;gap:20px;align-items:stretch;justify-content:center}
.k-am-card{position:relative;width:250px;height:320px;perspective:900px;opacity:0;transform:translateY(40px) scale(.9);animation:kamin .45s cubic-bezier(.2,1.4,.4,1) forwards;animation-delay:var(--d)}
@keyframes kamin{to{opacity:1;transform:none}}
.k-am-in{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateY(180deg);animation:kamflip .6s cubic-bezier(.3,1.5,.5,1) forwards;animation-delay:calc(var(--d) + .35s)}
@keyframes kamflip{to{transform:rotateY(0)}}
.k-am-face{position:absolute;inset:0;border:4px solid ${INK};border-radius:18px;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 6px 0 ${INK},0 12px 26px rgba(20,10,0,.4);overflow:hidden}
.k-am-back{transform:rotateY(180deg);background:#C8463A repeating-linear-gradient(45deg,rgba(255,255,255,.08) 0 12px,transparent 12px 24px);display:flex;align-items:center;justify-content:center}
.k-am-back span{font-size:96px;font-weight:900;color:#FFE16A;-webkit-text-stroke:6px ${INK};paint-order:stroke}
.k-am-front{background:#FFFAEE;display:flex;flex-direction:column;align-items:center;padding:10px 12px 12px;gap:6px;text-align:center}
.k-am-card.r-comum .k-am-front{border-color:${INK};box-shadow:0 6px 0 ${INK},inset 0 0 0 5px #D9B57A}
.k-am-card.r-raro .k-am-front{box-shadow:0 6px 0 ${INK},inset 0 0 0 5px #6FA8EA,0 0 22px rgba(80,150,240,.55)}
.k-am-card.r-lendario .k-am-front{background:linear-gradient(160deg,#FFF6D2,#FFE6A0 50%,#FFF6D2);box-shadow:0 6px 0 ${INK},inset 0 0 0 5px #F0B429,0 0 30px rgba(255,200,60,.8)}
.k-am-card.r-lendario .k-am-front::after{content:'';position:absolute;inset:-40%;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.75) 50%,transparent 60%);animation:kamshine 2.4s linear infinite;pointer-events:none}
@keyframes kamshine{from{transform:translateX(-60%)}to{transform:translateX(60%)}}
.k-am-rar{font-size:17px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:2px 12px;border:2px solid ${INK};border-radius:10px;background:#F3E5C4}
.k-am-card.r-raro .k-am-rar{background:#CFE3FA}
.k-am-card.r-lendario .k-am-rar{background:#FFD84A}
.k-am-art{flex:0 0 auto;height:100px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 0 rgba(59,40,24,.25))}
.k-am-card:hover .k-am-art,.k-am-card:focus-visible .k-am-art{animation:kambob .6s ease-in-out infinite alternate}
@keyframes kambob{to{transform:translateY(-5px) rotate(-3deg)}}
.k-am-tb{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;flex:1 1 auto}
.k-am-nm{font-size:23px;font-weight:900;line-height:1.05}
.k-am-tx{font-size:17px;font-weight:700;line-height:1.2;color:#4A3524}
.k-am-tags{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:auto}
.k-am-tag{font-size:17px;font-weight:900;color:#FFF6E6;padding:1px 10px;border:2px solid ${INK};border-radius:10px;text-shadow:0 1px 0 ${INK}}
.k-am-set{font-size:17px;font-weight:900;color:#9A6A20}
.k-am-stamp{position:absolute;left:50%;top:44%;width:150px;height:150px;margin:-75px 0 0 -75px;border:7px solid #D6322A;border-radius:50%;color:#D6322A;display:flex;align-items:center;justify-content:center;flex-direction:column;font-weight:900;font-size:24px;line-height:1;opacity:0;transform:scale(2.6) rotate(-30deg);pointer-events:none;background:rgba(255,250,238,.35)}
.k-am-stamp b{font-size:52px;line-height:1}
.k-am-card.pick .k-am-stamp{animation:kamstamp .38s cubic-bezier(.5,0,.6,1.4) forwards}
@keyframes kamstamp{60%{opacity:1;transform:scale(.88) rotate(-14deg)}100%{opacity:.95;transform:scale(1) rotate(-14deg)}}
.k-am-card.pick{animation:kampick .7s ease-out forwards;z-index:2}
@keyframes kampick{0%{opacity:1;transform:none}30%{transform:scale(1.08)}100%{opacity:1;transform:scale(1.04)}}
.k-am-card.pick .k-am-face{box-shadow:0 6px 0 ${INK},0 0 0 6px #FFE16A,0 0 50px rgba(255,220,90,.95)}
.k-am-card.gone{animation:kamgone .45s ease-in forwards}
@keyframes kamgone{0%{opacity:1;transform:none}100%{opacity:0;transform:translateY(60px) rotate(6deg) scale(.85)}}
.k-am-foot{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center}
.k-am-b{min-height:62px;min-width:62px;padding:6px 20px;border-radius:14px!important;border:3px solid ${INK}!important;box-shadow:0 4px 0 ${INK};background:#F6ECD4!important;font-weight:900!important;font-size:19px!important;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap}
.k-am-b.gold{background:linear-gradient(#FFE58A,#F0BE48)!important}
.k-am-b.off{background:#E4DCCB!important;color:#7A6A58!important}
.k-am-b:active{transform:translateY(2px);box-shadow:0 1px 0 ${INK}}
.k-am-build{display:flex;gap:6px;align-items:center;min-height:44px;color:#FFF6E6;font-size:17px;font-weight:800;text-shadow:0 2px 0 ${INK}}
.k-am-build canvas{image-rendering:pixelated}
.k-am.port .k-am-row{flex-direction:column;gap:12px}
.k-am.port .k-am-card{width:480px;height:196px}
.k-am.port .k-am-front{flex-direction:row;text-align:left;padding:10px 14px;gap:12px}
.k-am.port .k-am-rar{position:absolute;right:10px;top:8px}
.k-am.port .k-am-art{height:auto;width:96px}
.k-am.port .k-am-tb{align-items:flex-start;padding-top:22px}
.k-am.port .k-am-tags{justify-content:flex-start}
.k-am.port .k-am-title{font-size:32px}
.k-am.port .k-am-stamp{top:50%}
.k-am.port .k-am-back span{font-size:80px}
/* build (painel) */
.k-am-panel{position:absolute;left:50%;top:50%;width:620px;max-width:calc(100% - 20px);max-height:calc(100% - 20px);transform:translate(-50%,-50%);background:#FFFAEE;border:3px solid ${INK};border-radius:18px;box-shadow:0 5px 0 ${INK},0 10px 24px rgba(40,20,5,.28);pointer-events:auto;display:flex;flex-direction:column;overflow:hidden}
.k-am-ph{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 14px;background:#6B4526;border-bottom:3px solid ${INK};color:#FFF6E6}
.k-am-ph h2{margin:0;font-size:24px;font-weight:900;flex:1 1 auto;text-shadow:0 2px 0 ${INK};min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.k-am-ph h2 small{display:block;font-size:17px;font-weight:800;color:#F6E2B8;text-shadow:none}
.k-am-x{width:62px;height:62px;border-radius:14px!important;background:#FFFAEE!important;border:3px solid ${INK}!important;box-shadow:0 3px 0 ${INK};font-size:26px!important;font-weight:900!important;color:${INK}!important;flex:0 0 auto}
.k-am-pl{overflow-y:auto;padding:10px 12px 14px;display:flex;flex-direction:column;gap:8px;touch-action:pan-y;overscroll-behavior:contain}
.k-am-it{display:flex;gap:10px;align-items:center;padding:6px 10px;border:3px solid ${INK};border-radius:14px;background:#FBF3DF}
.k-am-it.r-raro{background:#EAF3FD}.k-am-it.r-lendario{background:#FFF0C4}
.k-am-it>div{min-width:0;flex:1 1 auto}
.k-am-it b{display:block;font-size:19px;font-weight:900}
.k-am-it span{display:block;font-size:17px;font-weight:700;color:#5A4430;line-height:1.2}
.k-am-sets{display:flex;flex-wrap:wrap;gap:6px}
.k-am-sb{display:flex;align-items:center;gap:6px;min-height:46px;padding:2px 10px;border:2px solid ${INK};border-radius:12px;background:#EDE3CF;font-size:17px;font-weight:900;color:#6B5640}
.k-am-sb.on{background:linear-gradient(#FFE58A,#F0BE48);color:#2A1A10;box-shadow:0 0 14px rgba(255,200,60,.9);animation:kamglow 1.4s ease-in-out infinite alternate}
@keyframes kamglow{to{box-shadow:0 0 4px rgba(255,200,60,.4)}}
.k-am-note{font-size:17px;font-weight:700;color:#6B5640}
.k-chip.k-am-lit{box-shadow:0 0 0 3px #FFE16A,0 0 14px rgba(255,200,60,.9)}
.k-am-mini{display:flex;gap:1px;align-items:center}
.k-am-mini canvas{image-rendering:pixelated}
`;
  document.head.appendChild(css);

  /* ---------- casca (palco lógico 960x540 deitado / 520x900 em pé, igual ao cookie-ui) ---------- */
  const root = document.createElement('div'); root.className = 'k-am';
  const V = document.createElement('div'); V.className = 'k-am-v'; root.appendChild(V);
  let k = 1, mounted = false;
  function fit() {
    const w = innerWidth, h = innerHeight, port = h > w;
    k = port ? Math.min(w / 520, h / 900) : Math.min(w / 960, h / 540);
    V.style.width = (w / k) + 'px'; V.style.height = (h / k) + 'px'; V.style.transform = 'scale(' + k + ')';
    root.classList.toggle('port', port);
  }
  function mount() { if (mounted) return; mounted = true; document.body.appendChild(root); fit(); addEventListener('resize', fit); }
  function el(tag, cls, parent, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (parent) parent.appendChild(e); return e; }
  function btn(parent, txt, cls, fn) { const b = el('button', 'k-am-b' + (cls ? ' ' + cls : ''), parent, txt); b.type = 'button'; b.addEventListener('click', e => { e.stopPropagation(); fn(e); }); return b; }
  function sfx(n, o) { const S = G.S; if ((S && S.opts && S.opts.mute) || !E.Sfx || !E.Sfx.play) return; if (E.Sfx.has && !E.Sfx.has(n)) return; try { E.Sfx.play(n, o); } catch (e) { /* */ } }
  function tagEl(parent, t) { const T = A().TAGS[t] || { n: t, c: '#888' }; const s = el('span', 'k-am-tag', parent, T.n); s.style.background = T.c; return s; }

  /* ---------- tela de escolha ---------- */
  let open = null, busyPick = false, demoCards = null;
  function setLine(x) {   // "mão 2/3 → Trio da Pata!" quando a carta fecha um conjunto
    const n = A().tagCount(A().current().map(c => c.id)), need = A().need();
    for (const t of x.tags) if ((n[t] | 0) + 1 >= need && A().sets[t]) return (A().TAGS[t].n + ' ' + ((n[t] | 0) + 1) + '/' + need + ' → ' + A().sets[t].n + '!');
    const t = x.tags[0]; return t && n[t] ? A().TAGS[t].n + ' ' + ((n[t] | 0) + 1) + '/' + need : '';
  }
  function cardEl(parent, x, i) {
    const c = el('button', 'k-am-card r-' + x.rar, parent); c.type = 'button'; c.style.setProperty('--d', (i * 0.12) + 's');
    c.setAttribute('aria-label', x.n + ': ' + x.d);
    const inn = el('div', 'k-am-in', c);
    const back = el('div', 'k-am-face k-am-back', inn); el('span', null, back, '守');
    const f = el('div', 'k-am-face k-am-front', inn);
    el('div', 'k-am-rar', f, A().RAR[x.rar] ? A().RAR[x.rar].n : x.rar);
    const artB = el('div', 'k-am-art', f); artB.appendChild(icon(x, 88));
    const tb = el('div', 'k-am-tb', f);
    el('div', 'k-am-nm', tb, x.n); el('div', 'k-am-tx', tb, x.d);
    const sl = setLine(x); if (sl) el('div', 'k-am-set', tb, sl);
    const tg = el('div', 'k-am-tags', tb); for (const t of x.tags) tagEl(tg, t);
    const stp = el('div', 'k-am-stamp', c); el('b', null, stp, '守'); el('span', null, stp, 'ESCOLHIDO');
    c.addEventListener('click', e => { e.stopPropagation(); choose(x, c); });
    setTimeout(() => sfx('shing', { vol: 0.35 }), (i * 0.12 + 0.5) * 1000);
    return c;
  }
  function render() {
    if (!open) return;
    const w = open.wrap; w.innerHTML = '';
    const cards = DEMO && demoCards ? demoCards : A().offer() || [];
    const m = A().nextMarco(), isl = G.Islands ? G.Islands.island() : null, n = A().current().length;
    el('div', 'k-am-kick', w, 'Omamori · ' + (n + 1) + '/' + A().max() + ' · ' + (m ? m.n : '') + (isl ? ' · ' + isl.n : ''));
    el('div', 'k-am-title', w, 'Escolha 1 amuleto');
    const row = el('div', 'k-am-row', w); open.cards = cards.map((x, i) => ({ x, el: cardEl(row, x, i) }));
    const cb = A().current();
    if (cb.length) { const b = el('div', 'k-am-build', w); el('span', null, b, 'Sua build:'); for (const x of cb) b.appendChild(icon(x, 30)); }
    const ft = el('div', 'k-am-foot', w), c = A().rerollCost(), can = A().seeds() >= c;
    open.rr = btn(ft, c === 0 ? 'Trocar as 3 · grátis (carta do dia)' : 'Trocar as 3 · ★ ' + c + (c > 1 ? ' sementes' : ' semente'), can ? 'gold' : 'off', () => {
      if (busyPick) return;
      if (DEMO) { demoCards = sample(); render(); sfx('whoosh'); return; }
      if (!A().reroll()) { sfx('error', { vol: 0.5 }); open.rr.classList.remove('k-cui-shake'); return; }
      sfx('whoosh'); render();
    });
    btn(ft, 'Depois', '', () => { if (busyPick) return; api.later = true; close(); });
  }
  function choose(x, c) {
    if (busyPick || !open) return; busyPick = true;
    c.classList.add('pick'); for (const o of open.cards) if (o.el !== c) o.el.classList.add('gone');
    sfx('stomp', { vol: 0.6 }); setTimeout(() => sfx('sparkle'), 200);
    const res = DEMO ? { amuleto: x, sets: [] } : A().pick(x.id);
    setTimeout(() => {
      busyPick = false; close();
      if (!res) return;
      if (UI && UI.banner) UI.banner('Amuleto: ' + x.n, x.d, { icon: art(x), tone: 'gold', dur: 3 });
      for (const s of res.sets || []) setTimeout(() => { sfx('fanfare'); if (UI && UI.banner) UI.banner(s.n + '!', 'conjunto aceso: ' + s.d, { icon: 'star', tone: 'gold', dur: 3.5 }); }, 1600);
      chipTick(true);
    }, 950);
  }
  function sample() { const L = A().list().slice(); const out = []; while (out.length < 3 && L.length) out.push(L.splice((Math.random() * L.length) | 0, 1)[0]); return out; }
  function openChoice() {
    if (open || !A()) return false;
    if (!DEMO && (!A().pending() || A().fast())) return false;
    mount(); api.later = false;
    const dim = el('div', 'k-am-dim', V), wrap = el('div', 'k-am-wrap', V);
    open = { dim, wrap, cards: [] };
    void dim.offsetWidth; dim.classList.add('on');
    sfx('whoosh', { vol: 0.5 });
    render(); return true;
  }
  function close() {
    if (!open) return;
    const o = open; open = null; o.dim.classList.remove('on'); o.wrap.style.transition = 'opacity .25s'; o.wrap.style.opacity = '0';
    setTimeout(() => { o.dim.remove(); o.wrap.remove(); }, 280);
  }

  /* ---------- build (painel do chip) ---------- */
  let panel = null;
  function openBuild() {
    if (panel || open) return;
    if (A().pending()) { openChoice(); return; }
    mount();
    const dim = el('div', 'k-am-dim', V); void dim.offsetWidth; dim.classList.add('on');
    const p = el('div', 'k-am-panel', V);
    const h = el('div', 'k-am-ph', p), t = el('h2', null, h, 'Amuletos desta ilha');
    el('small', null, t, A().current().length + '/' + A().max() + ' · a viagem zera; o descoberto fica no Caderno');
    const x = el('button', 'k-am-x', h, '×'); x.type = 'button'; x.setAttribute('aria-label', 'fechar');
    const L = el('div', 'k-am-pl', p);
    const cur = A().current();
    if (!cur.length) el('div', 'k-am-note', L, 'Nenhum amuleto ainda. Você escolhe um na chegada e outro em cada marco: 1ª máquina a motor, Escavadeira, Bagger e casa pronta.');
    for (const a of cur) {
      const r = el('div', 'k-am-it r-' + a.rar, L); r.appendChild(icon(a, 44));
      const d = el('div', null, r); el('b', null, d, a.n); el('span', null, d, a.d);
      const tg = el('div', 'k-am-tags', d); tg.style.justifyContent = 'flex-start'; for (const tt of a.tags) tagEl(tg, tt);
    }
    el('div', 'k-am-note', L, 'Conjuntos: ' + A().need() + ' amuletos da mesma etiqueta acendem um bônus.');
    const sets = el('div', 'k-am-sets', L), n = A().tagCount(cur.map(c => c.id)), lit = A().lit();
    for (const tt in A().sets) {
      const s = A().sets[tt], on = lit.indexOf(tt) >= 0, b = el('div', 'k-am-sb' + (on ? ' on' : ''), sets);
      b.textContent = s.n + ' · ' + A().TAGS[tt].n + ' ' + Math.min(n[tt] | 0, A().need()) + '/' + A().need(); b.title = s.d;
      if (on) el('div', 'k-am-note', L, s.n + ': ' + s.d);
    }
    const done = () => { if (!panel) return; panel = null; dim.remove(); p.remove(); };
    x.addEventListener('click', e => { e.stopPropagation(); sfx('click'); done(); });
    dim.addEventListener('pointerdown', e => { if (e.target === dim) done(); });
    panel = { done };
    sfx('whoosh', { vol: 0.4 });
  }

  /* ---------- chip do HUD: fila de até 5 ícones; pisca quando tem escolha pendente; conjunto aceso brilha ---------- */
  let chip = null, chipKey = '';
  function chipTick(force) {
    if (!A()) return;
    if (!chip) { if (!G.HUD || !G.HUD.ready || !G.HUD.chip) return; chip = G.HUD.chip({ id: 'amuletos', icon: 'star', label: 'Amuletos', order: 6, tone: '#FFF0C4', show: false, onClick: () => { sfx('click'); openBuild(); } }); if (!chip) return; }
    const run = A().run(), cur = A().current(), pend = A().pending(), lit = A().lit();
    const key = run + '|' + cur.map(c => c.id).join(',') + '|' + pend + '|' + lit.join(',');
    if (!force && key === chipKey) return; chipKey = key;
    chip.set({ show: run && (cur.length > 0 || pend), label: cur.length ? '' : 'Amuletos', hint: pend ? 'escolha seu amuleto!' : '', prio: pend ? 5 : 0, hot: pend ? 'escolha!' : '' });
    chip.ic.textContent = '';
    if (cur.length) { const m = el('span', 'k-am-mini', chip.ic); for (const x of cur) m.appendChild(icon(x, 22)); if (pend) m.appendChild(UI.icon('star', 18)); }
    else chip.ic.appendChild(UI.icon('star', 20));
    chip.el.classList.toggle('k-am-lit', lit.length > 0);
    chip.el.title = cur.map(x => x.n + ': ' + x.d).join('\n') || 'Amuletos';
  }
  setInterval(() => { try { chipTick(false); } catch (e) { /* */ } }, 500);

  /* ---------- Caderno: amuletos descobertos (goals.js chama) ---------- */
  function caderno(col) {
    if (!A() || !UI || !UI.el) return;
    const L = A().list(), disc = A().discovered(), n = L.filter(x => disc[x.id]).length;
    UI.el('div', 'k-h', col, 'Amuletos descobertos · ' + n + '/' + L.length);
    if (UI.album) UI.album(col, { cols: 2, items: L.map(x => ({ id: 'am_' + x.id, name: x.n, hint: '???', q: x.faixa && !A().unlocked(x) ? 'entra no baralho na ' + (G.Faixas ? G.Faixas.name(x.faixa) : 'faixa ' + x.faixa) : x.rar === 'lendario' && !A().unlocked(x) ? 'lendário: destrava com uma conquista' : 'escolha numa ilha pra descobrir', a: x.d, icon: disc[x.id] ? art(x) : 'lock', unlocked: !!disc[x.id] })) });
  }

  const api = (G.AmuletosUI = { open: openChoice, close, isOpen: () => !!open, later: false, openBuild, caderno, icon, art, chipTick });
  if (DEMO) { const go = () => { if (!A() || !G.HUD || !G.HUD.ready) return setTimeout(go, 300); demoCards = sample(); openChoice(); }; setTimeout(go, 1200); }
})();
