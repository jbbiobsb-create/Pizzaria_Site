/* Kome no Japão — oficina.js
   A OFICINA DO KOME como um LUGAR (garagem de mecânico em tela cheia, no jeito da Fábrica: canvas próprio de 960×540 por
   cima do jogo). Aqui é só apresentação e toque; as CONTAS continuam onde sempre estiveram:
     - nível das máquinas, preço, marcos 10/25/50: game/infinite.js (G.Inf.up / G.Inf.info);
     - Bagger Gêmea, fábrica do pátio, lojas, pintura, escolha do marco: game/industry.js (G.Ind.buy.* / G.Ind.spec).
   Nenhuma fórmula nem chave de save mudou. G.Inf.open() abre esta tela; se ela falhar (ou com ?oficina=lista) abre a lista antiga.
   Como funciona: as máquinas que você tem estão na garagem (painel, vagas, pátio lá fora). Tocar numa leva ela pro elevador;
   "Melhorar" chama a equipe de mecânicos (x1 / x10 / máx: compra em lote, sem segurar). Abas em cima: Máquinas, Gêmea, Galpão, Lojas. Prancheta azul = Gêmea, quadro = fábrica do pátio, cortiça = lojas.
   Arte: game/oficina-arte.js (G.OfiArt). Ganchos de teste: G.Ofi (open, close, isOpen, select, board, upgrade, pick, state). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, C = E.PAL, D = E.Draw, DATA = G.Data, A = G.OfiArt;
  if (!A || !E.Stage) return;
  const W = 960, H = 540, INK = '#3B2818', TAU = Math.PI * 2, GEO = A.geo, K = A.K, SPR = A.spr, LIFT = GEO.lift;
  const GS = () => G.S;
  const money = () => (GS() ? GS().money : 0);
  const TOOLS = () => DATA.TOOLS;
  const owned = () => DATA.TOOLS.slice(0, (GS() ? GS().tool : 0) + 1);
  const toolOf = id => DATA.TOOLS.find(t => t.id === id) || null;
  const idxOf = id => DATA.TOOLS.findIndex(t => t.id === id);
  const lvOf = id => ((GS().stats.lv || {})[id] | 0);
  const fx2 = v => (v >= 1e4 ? U.fmt(v) : v.toFixed(2).replace('.', ',')), fx1 = v => (v >= 1e4 ? U.fmt(v) : v.toFixed(1).replace('.', ','));   // marcos sem fim: ×12,3 mil
  const pct = v => '+' + Math.round(v * 100) + '%';

  /* ======================================================================
     Estado da tela (nada daqui vai pro save)
     ====================================================================== */
  const V = {
    tool: null, board: null, live: null, enter: 1, sq: 0, sqV: 0, liftH: 0, burst: 0, burstN: 0, kick: 0,
    stamp: null, mile: null, banner: null, toast: null, help: false, shop: null, hover: -1, hold: null, t: 0, flash: 0, boardFx: null,
    tinkT: 4, tinkWho: 0, tinkLeft: 0, pops: [], qty: 1, shake: 0, page: 0, shopFx: null,
  };
  const ps = E.Particles(700), fl = E.Floaters(80);
  // a equipe do elevador: onde descansam e que ferramenta usam
  const CREW = [
    { pal: 'goma', hx: 420, hy: 468, face: 1, idle: ['sit', 'scratch', 'wag', 'yawn'], tool: 'spanner', x: 420, y: 468, work: 0 },
    { pal: 'kuro', hx: 632, hy: 468, face: -1, idle: ['stand', 'sniff', 'think', 'sit'], tool: 'spanner', x: 632, y: 468, work: 0 },
    { pal: 'shiro', hx: 570, hy: 468, face: -1, idle: ['sit', 'wag', 'stretch', 'sit'], tool: 'torch', x: 570, y: 468, work: 0 },
  ];

  /* ======================================================================
     Som (Sfx da engine; respeita o mudo do jogo)
     ====================================================================== */
  if (E.Sfx && E.Sfx.define) {
    // catraca: seis cliques secos subindo de tom
    E.Sfx.define('ofi-catraca', a => { for (let i = 0; i < 6; i++) a.noise(0.014, 3200 + i * 160, 0.2, 7, i * 0.026); a.tone(170, 0.05, 'triangle', 0.12, 0.7, 0.15); });
    // solda: chiado com estalinhos
    E.Sfx.define('ofi-solda', a => { a.noise(0.2, 5600, 0.07, 0.7); a.tone(118, 0.18, 'sawtooth', 0.035); for (let i = 0; i < 4; i++) a.noise(0.01, 7400, 0.12, 4, 0.02 + i * 0.045 + a.rnd() * 0.02); });
    // carimbo: pancada surda no papel
    E.Sfx.define('ofi-carimbo', a => { a.tone(150, 0.08, 'sine', 0.42, 0.45); a.noise(0.03, 800, 0.24, 1); a.noise(0.012, 2600, 0.1, 2, 0.01); });
    // máquina assentando no elevador
    E.Sfx.define('ofi-pouso', a => { a.tone(96, 0.14, 'sine', 0.4, 0.55); a.noise(0.06, 380, 0.22, 0.8); a.noise(0.22, 6200, 0.035, 0.5, 0.05); });
    // marco: jingle de marimba + sininho
    E.Sfx.define('ofi-marco', a => { const n = [0, 4, 7, 9, 12, 16]; for (let i = 0; i < n.length; i++) a.note(a.deg(n[i]), { inst: 'marimba', vel: 0.5 + i * 0.06, delay: i * 0.08 }); a.drum('chan', { vel: 0.5, delay: 0.5 }); a.drum('furin', { vel: 0.5, delay: 0.56 }); });
    // peça da Gêmea / nível comprado num quadro
    E.Sfx.define('ofi-peca', a => { a.drum('anvil', { vel: 0.5 }); a.note(a.deg(7), { inst: 'marimba', vel: 0.55, delay: 0.06 }); a.note(a.deg(11), { inst: 'marimba', vel: 0.6, delay: 0.16 }); });
  }
  const sfxLast = {};
  function sfx(name, o) {
    const s = GS(); if ((s && s.opts && s.opts.mute) || !E.Sfx || !E.Sfx.has || !E.Sfx.has(name)) return;
    const now = performance.now(); if (sfxLast[name] && now - sfxLast[name] < 70) return; sfxLast[name] = now;
    try { E.Sfx.play(name, o); } catch (e) { /* sem áudio */ }
  }

  /* ======================================================================
     Overlay: stage próprio (960×540) por cima do jogo
     ====================================================================== */
  const root = document.createElement('div'); root.className = 'k-ofi';
  document.body.appendChild(root);
  const css = document.createElement('style');
  css.textContent = '.k-ofi{position:fixed;inset:0;z-index:55;background:#2a1a10;display:none}.k-ofi.k-ofi-open{display:block}';
  document.head.appendChild(css);
  const stage = E.Stage({ parent: root, width: W, height: H, bg: '#2a1a10' });
  const g = stage.g;
  const input = E.Input(stage);
  const blit = (cv, x, y, s, o) => A.blit(g, cv, x, y, s, o);
  const txt = (s, x, y, o) => D.text(g, s, x, y, o);
  const T = (size, col, align, extra) => Object.assign({ size, col: col || INK, sw: 0, align: align || 'center', weight: 900 }, extra || {});
  // texto que encolhe pra caber (nunca abaixo de 17 px: regra do celular)
  function fit(s, x, y, maxW, size, col, align) {
    g.font = '900 ' + size + 'px system-ui'; let sz = size; const w = s.length * size * 0.56;
    if (w > maxW) sz = Math.max(17, Math.floor(size * maxW / w));
    txt(s, x, y, T(sz, col, align));
  }

  /* ======================================================================
     Ações (todas passam pelas funções de sempre do jogo)
     ====================================================================== */
  function toast(s) { V.toast = { t: s, life: 1.9 }; }
  function banner(a, b, col) { V.banner = { a, b, t: 0, life: 2.6, col: col || K.gold }; }
  function pal() { const s = GS(); return (s && s.look && s.look.pal) || 'kome'; }
  function select(id, quiet) {
    const t = toolOf(id); if (!t || idxOf(id) > GS().tool) return false;
    V.board = null;
    if (V.tool === id && V.live) { if (!quiet) { V.sqV = 3.2; sfx('click', { pitch: 1.2 }); } return true; }
    V.tool = id; V.live = A.live(id, pal()); V.enter = 0; V.sq = 0; V.sqV = 0; V.burst = 0; V.stamp = null; V.hold = null;
    if (!quiet) sfx('whoosh', { pitch: 1.2, vol: 0.5 });
    return true;
  }
  function openBoard(b) { V.board = V.board === b ? null : b; V.hold = null; if (b === 'lojas' && !V.shop) V.shop = G.Ind.run().client || DATA.SHOPS[0].id; sfx('click', { pitch: 1.1 }); }
  // pontos de trabalho da equipe em volta da máquina que está no elevador
  function workSpots() {
    const lp = A.liftPos(V.tool), cx = LIFT.x, half = Math.min(lp.w / 2, 210);
    return [[cx - half + 4, LIFT.y + 22, 1], [cx + half - 4, LIFT.y + 20, -1], [cx + Math.min(40, half * 0.4), LIFT.y + 32, -1]];
  }
  function sparksAt(x, y, n) { ps.sparks(x, y, n, { speed: [120, 380], life: [0.25, 0.6], w: [5, 9] }); V.pops.push({ x, y, t: 0 }); if (V.pops.length > 12) V.pops.shift(); }
  /* COMPRA EM LOTE sem segurar o botão: V.qty = 1 | 10 | 'max'. O lote nunca passa do próximo marco (pra festa e o presente
     aparecerem) nem do dinheiro. O preço mostrado é a soma pela fórmula de sempre (×1,12 por nível); quem cobra é o G.Inf.up. */
  function plan(tl) {
    const inf = G.Inf.info(tl), want = V.qty === 'max' ? 999 : V.qty, cap = Math.max(1, Math.min(want, inf.nextMile ? inf.nextMile - inf.L : want)), m = money();
    let n = 0, tot = 0;
    while (n < cap) { const ci = n ? Math.ceil(inf.cost * Math.pow(1.12, n) / 10) * 10 : inf.cost; if (n && tot + ci > m) break; tot += ci; n++; }
    const gain = G.Inf.multAt ? G.Inf.multAt(tl, inf.L + n) / inf.mult - 1 : inf.multNext / inf.mult - 1;
    return { inf, n, tot, can: m >= inf.cost, gain, mile: !!inf.nextMile && inf.L + n >= inf.nextMile };
  }
  const gainTxt = r => (r >= 1 ? 'arroz ×' + fx1(1 + r) : '+' + (r < 0.1 ? (r * 100).toFixed(1).replace('.', ',') : Math.round(r * 100)) + '% de arroz');
  function deny(c) { toast('Falta ¥ ' + U.fmt(c - money())); sfx('error'); V.shake = 0.3; V.hold = null; return false; }
  function upgrade() {
    const t = toolOf(V.tool); if (!t || V.mile || !G.Inf) return false;
    const p = plan(t);
    if (!p.can) return deny(p.inf.cost);
    let done = 0, r = null;
    for (let i = 0; i < p.n; i++) { const q = G.Inf.up(t, { quiet: true }); if (!q) break; r = q; done++; if (q.mile) break; }
    if (!r) return false;
    V.burst = 0.6; V.burstN++; V.sqV = -2.6; V.kick = 1; yenBump = 1;
    const lp = A.liftPos(V.tool);
    V.stamp = { t: 0, txt: '+' + done, x: LIFT.x + Math.min(120, lp.w * 0.32), y: LIFT.y - Math.min(190, lp.h * 0.8) - 6 };
    sfx(V.burstN % 2 ? 'ofi-catraca' : 'ofi-solda', { pitch: 0.94 + (V.burstN % 5) * 0.04 }); sfx('ofi-carimbo', { delay: 0.1 });
    fl.add(CARD.x + 130, CARD.y + 70, 'nível ' + r.L, { size: 20, c: K.goldL, life: 0.9 });
    if (r.mile) milestone(t, r.L);
    return true;
  }
  /* MARCO (níveis 10/25/50): a escolha "mais rápida × mais dourada" NÃO trava mais a tela. Dá pra fechar ("decidir depois"):
     o marco fica PENDENTE naquela máquina (estrela piscando na régua, na vaga e no cartão), ela continua subindo de nível e
     nada é escolhido sozinho. Pendente = marcos batidos (G.Inf.info.miles) > escolhas gravadas (S.stats.spec[id]). */
  const pendOf = id => { const t = toolOf(id); if (!t || !G.Inf) return 0; const inf = G.Inf.info(t); return Math.max(0, inf.miles - inf.spec.length); };
  function milestone(t, L) {
    V.hold = null; V.mile = { tool: t, L, t: 0 }; V.flash = 1;
    sfx('ofi-marco'); sfx('fanfare', { vol: 0.6 });
    ps.burst(LIFT.x, LIFT.y - 120, 60, { c: [C.gold, C.sakura, C.goldL, C.cream], shape: 'star', speed: [140, 420], life: 1.3 });
    V.stamp = { t: 0, txt: 'MARCO!', x: LIFT.x, y: LIFT.y - 150, big: true };
  }
  // reabre a escolha de um marco pendente (o mais antigo daquela máquina)
  function openMile(id) {
    const t = toolOf(id); if (!t || !pendOf(id) || V.mile) return false;
    V.hold = null; V.board = null; V.mile = { tool: t, L: G.Inf.mileAt(G.Inf.info(t).spec.length), t: 0.9, again: true }; sfx('click', { pitch: 1.2 });
    return true;
  }
  function later() {
    const m = V.mile; if (!m || m.t < 0.9) return false;
    V.mile = null; sfx('click', { pitch: 0.9 }); toast('Guardado! O presente espera na ★');
    return true;
  }
  function pick(ch) {
    const m = V.mile; if (!m || m.t < 0.9) return false;
    G.Ind.spec(m.tool, ch); G.Inf.recompute();
    V.mile = null; V.sqV = -3; V.flash = 0.6; sfx('ofi-peca'); sfx('chirin');
    ps.burst(LIFT.x, LIFT.y - 100, 34, { c: ch === 'd' ? [C.gold, C.goldL, C.cream] : [C.red, C.yel, C.cream], shape: 'star', speed: [120, 360], life: 1 });
    banner(ch === 'd' ? 'Mais dourada!' : 'Mais rápida!', ch === 'd' ? 'arroz dourado vale +10%' : m.tool.name + ' rende +50%', ch === 'd' ? K.gold : K.red);
    return true;
  }
  // "Usar esta máquina": a troca de lugar de sempre do jogo (game.js playAs), sem sair da Oficina
  function useTool() {
    const i = idxOf(V.tool), GM = G.Game; if (i < 0 || !GM || !GM.playAs) return false;
    if (GM.playIndex && GM.playIndex() === i && !(GS() && GS().twinPlay)) return false;
    if (!GM.playAs(i)) { toast('Agora não dá pra trocar'); sfx('error'); V.shake = 0.3; return false; }
    V.flash = 0.5; V.sqV = 3.6; sfx('chirin');
    return true;
  }
  function boardFx(b, s) { const r = b === 'gemea' ? GEO.plan : b === 'fab' ? GEO.fab : GEO.cork; V.boardFx = { b, t: 0 }; ps.burst(r.x + r.w / 2, r.y + r.h / 2, 22, { c: [C.gold, C.goldL, C.cream], shape: 'star', speed: [80, 260], life: 0.9 }); V.stamp = { t: 0, txt: s, x: r.x + r.w / 2, y: r.y + r.h / 2 + 8 }; sfx('ofi-peca'); sfx('ofi-carimbo', { delay: 0.08 }); }
  function buyGiant() {
    const I = G.Ind, r = I.run(), gp = Math.min(4, r.giant | 0), part = DATA.GIANT[gp]; if (!part) return;
    const c = I.cost.giant(); if (money() < c) { deny(c); return; }
    if (!I.buy.giant(true)) return;
    boardFx('gemea', 'PEÇA ' + (gp + 1) + '/4');
    if (gp + 1 >= 4) { banner('BAGGER GÊMEA!', 'pronta: ela cava do seu lado', K.gold); sfx('ofi-marco'); sfx('fanfare', { vol: 0.6 }); V.flash = 1; }
  }
  function buyFab() { const I = G.Ind, c = I.cost.fab(); if (money() < c) { deny(c); return; } if (I.buy.fab(true)) boardFx('fab', '+12%'); }
  function buyShop(id) { const I = G.Ind, c = I.cost.shop(id); if (money() < c) { deny(c); return; } if (I.buy.shop(id, true)) { V.shopFx = { id, t: 0 }; yenBump = 1; sfx('ofi-peca'); sfx('ofi-carimbo', { delay: 0.08 }); } }

  /* ======================================================================
     HUD em canvas (mesmo jeito da Fábrica: pílulas creme com contorno e sombra)
     ====================================================================== */
  let btns = [], pressBtn = null;
  function hit(x, y, w, h, fn, o) { btns.push({ x, y, w, h, fn, o }); }
  function pill(x, y, w, h, fill, r) {
    r = r === undefined ? 10 : r;
    g.fillStyle = 'rgba(40,22,8,.30)'; D.rrect(g, x - 2, y + 2, w + 4, h + 6, r + 2); g.fill();
    g.fillStyle = INK; D.rrect(g, x - 2.5, y - 2.5, w + 5, h + 7.5, r + 2); g.fill();
    g.fillStyle = fill || C.cream; D.rrect(g, x, y, w, h, r); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; D.rrect(g, x + 4, y + 2.5, w - 8, 3, 1.5); g.fill();
  }
  function button(x, y, w, h, label, fn, o) {
    o = o || {};
    const on = o.on, off = o.off, pressed = pressBtn && pressBtn.x === x && pressBtn.y === y, dy = pressed ? 2 : 0;
    g.fillStyle = 'rgba(40,22,8,.30)'; D.rrect(g, x - 2, y + 2, w + 4, h + 6, 11); g.fill();
    g.fillStyle = INK; D.rrect(g, x - 2.5, y - 2.5, w + 5, h + 7.5, 11); g.fill();
    g.fillStyle = on ? C.gold : off ? '#E0D4BA' : (o.fill || C.cream); D.rrect(g, x, y + dy, w, h, 9); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; D.rrect(g, x + 4, y + 2.5 + dy, w - 8, 3, 1.5); g.fill();
    const cx = x + w / 2 + (o.dx || 0);
    if (o.sub) {
      txt(label, cx, y + h / 2 - 10 + dy, T(o.size || 18, off ? '#8a7a66' : INK));
      txt(o.sub, cx, y + h / 2 + 12 + dy, T(o.subSize || 17, o.subCol || (off ? '#8a7a66' : '#6B4A2E')));
    } else txt(label, cx, y + h / 2 + 1 + dy, T(o.size || 18, off ? '#8a7a66' : INK));
    hit(x, y, w, h, fn, { x, y, hold: o.hold });
  }
  function meter(x, y, w, h, k, col) {
    g.fillStyle = INK; D.rrect(g, x - 1.5, y - 1.5, w + 3, h + 3, h / 2 + 1); g.fill();
    g.fillStyle = '#E6DCC4'; D.rrect(g, x, y, w, h, h / 2); g.fill();
    if (k > 0.02) { g.fillStyle = col; D.rrect(g, x, y, Math.max(h, w * U.clamp(k, 0, 1)), h, h / 2); g.fill(); }
  }
  function nvBadge(x, y, L, miles) {
    g.fillStyle = INK; D.rrect(g, x, y, 66, 26, 9); g.fill();
    g.fillStyle = miles >= 3 ? C.goldL : miles >= 2 ? '#DDE6EE' : miles >= 1 ? '#EDB27A' : C.cream; D.rrect(g, x + 2, y + 2, 62, 22, 7); g.fill();
    txt('Nv ' + L, x + 33, y + 13.5, T(17, INK));
  }
  function iconAt(id, x, y, s) { g.imageSmoothingEnabled = false; const cv = A.icon(id); g.drawImage(cv, Math.round(x - cv.width * s / 2), Math.round(y - cv.height * s / 2), cv.width * s, cv.height * s); }

  let yenBump = 0;
  // botão de aba / de seletor: o ativo fica escuro (dourado é só "dá pra comprar"); dot = bolinha dourada de novidade
  function seg(x, y, w, h, label, active, fn, o) {
    o = o || {};
    const pressed = pressBtn && pressBtn.x === x && pressBtn.y === y, dy = pressed ? 2 : 0;
    g.fillStyle = 'rgba(40,22,8,.30)'; D.rrect(g, x - 2, y + 2, w + 4, h + 6, 11); g.fill();
    g.fillStyle = INK; D.rrect(g, x - 2.5, y - 2.5, w + 5, h + 7.5, 11); g.fill();
    g.fillStyle = active ? '#5A3E28' : C.cream; D.rrect(g, x, y + dy, w, h, 9); g.fill();
    if (!active) { g.fillStyle = 'rgba(255,255,255,.5)'; D.rrect(g, x + 4, y + 2.5 + dy, w - 8, 3, 1.5); g.fill(); }
    if (o.icon) o.icon(x + 24, y + h / 2 + dy);
    txt(label, x + w / 2 + (o.icon ? 14 : 0), y + h / 2 + 1 + dy, T(o.size || 18, active ? '#FFF6DE' : INK));
    if (o.dot && !active) { const by = y - 2 + Math.sin(V.t * 5) * 1.5; g.fillStyle = INK; g.beginPath(); g.arc(x + w - 8, by + 4, 8, 0, TAU); g.fill(); g.fillStyle = C.gold; g.beginPath(); g.arc(x + w - 8, by + 4, 5.5, 0, TAU); g.fill(); }
    hit(x, y, w, h, fn, { x, y });
  }
  // X de fechar (sempre igual: canto de cima à direita)
  function xBtn(x, y, w, h, fn, label) {
    button(x, y, w, h, label || '', fn, { fill: '#F6B6B0', size: 18, dx: label ? 12 : 0 });
    const cx = label ? x + 22 : x + w / 2, cy = y + h / 2 + (pressBtn && pressBtn.x === x && pressBtn.y === y ? 2 : 0);
    g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 7, cy - 7); g.lineTo(cx + 7, cy + 7); g.moveTo(cx + 7, cy - 7); g.lineTo(cx - 7, cy + 7); g.stroke(); g.lineCap = 'butt';
  }
  const TABS = [['', 'Máquinas'], ['gemea', 'Gêmea'], ['fab', 'Galpão'], ['lojas', 'Lojas']];
  function setTab(b) { if ((V.board || '') === b) return; if (b) { V.board = null; openBoard(b); } else { V.board = null; sfx('click', { pitch: 1.1 }); } }
  function drawTopBar(t, can) {
    pill(8, 6, 148, 42);
    const bump = Math.sin(Math.min(1, yenBump) * Math.PI) * 0.12;
    blit(SPR.coin, 28, 38 - bump * 20, 2 + bump * 2);
    txt(U.fmt(Math.floor(money())), 46, 28, T(18, INK, 'left'));
    const r = G.Ind.run(), cur = V.board || '';
    TABS.forEach(([id, name], i) => {
      const x = 166 + i * 172;
      seg(x, 6, 164, 42, name, cur === id, () => { if (!V.mile) setTab(id); }, { dot: id && can && can[id], icon: (ix, iy) => {
        if (!id) iconAt(V.tool || 'pata', ix, iy, 1.5);
        else if (id === 'gemea') iconAt('bagger', ix, iy, 1.5);
        else if (id === 'fab') blit(SPR.up, ix, iy + 9, 2);
        else blit(A.flyerOf(r.client || DATA.SHOPS[0].id), ix, iy + 13, 1.6);
      } });
    });
    xBtn(858, 6, 94, 42, close, 'Sair');
  }

  /* ---- régua de baixo: uma ficha por máquina (ícone + nível) ---- */
  const BAR = { w: 58, h: 60, gap: 4.4, y: 474 };
  function barX(i, n) { const tot = n * BAR.w + (n - 1) * BAR.gap, x0 = n >= 14 ? 8 : Math.max(8, (880 - tot) / 2 + 4); return x0 + i * (BAR.w + BAR.gap); }
  function drawBottomBar(t) {
    const list = owned(), n = list.length, cur = G.Inf && G.Inf.playing ? G.Inf.playing() : null;
    const tot = n * BAR.w + (n - 1) * BAR.gap, x0 = barX(0, n);
    g.fillStyle = 'rgba(40,22,8,.42)'; D.rrect(g, x0 - 8, BAR.y - 8, tot + 16, 90, 16); g.fill();
    list.forEach((tl, i) => {
      const x = barX(i, n), on = V.tool === tl.id && !V.board, y = BAR.y - (on ? 5 + Math.sin(t * 6) * 1.5 : 0), L = lvOf(tl.id), ml = G.Inf.info(tl).miles;
      const pressed = pressBtn && pressBtn.x === x && pressBtn.y === BAR.y, dy = pressed ? 2 : 0;
      g.fillStyle = 'rgba(40,22,8,.30)'; D.rrect(g, x - 2, y + 2, BAR.w + 4, BAR.h + 6, 12); g.fill();
      g.fillStyle = INK; D.rrect(g, x - 2.5, y - 2.5, BAR.w + 5, BAR.h + 7.5, 12); g.fill();
      g.fillStyle = on ? C.gold : C.cream; D.rrect(g, x, y + dy, BAR.w, BAR.h, 10); g.fill();
      g.fillStyle = on ? C.goldL : '#F3E7CC'; D.rrect(g, x + 4, y + 4 + dy, BAR.w - 8, 34, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; D.rrect(g, x + 5, y + 2.5 + dy, BAR.w - 10, 3, 1.5); g.fill();
      iconAt(tl.id, x + BAR.w / 2, y + 21 + dy, 2);
      txt(String(L), x + BAR.w / 2, y + 49 + dy, T(17, ml >= 3 ? C.goldD : INK));
      for (let k = 0; k < ml; k++) { g.fillStyle = INK; g.fillRect(x + 5 + k * 8, y + 5 + dy, 8, 8); g.fillStyle = C.gold; g.fillRect(x + 6 + k * 8, y + 6 + dy, 6, 6); g.fillStyle = C.goldL; g.fillRect(x + 6 + k * 8, y + 6 + dy, 3, 2); }
      if (pendOf(tl.id)) { const by = y + dy - 9 + Math.sin(t * 5 + i) * 2; g.fillStyle = INK; g.beginPath(); g.arc(x + 9, by + 6, 11, 0, TAU); g.fill(); g.fillStyle = C.gold; g.beginPath(); g.arc(x + 9, by + 6, 8.5, 0, TAU); g.fill(); txt('!', x + 9, by + 7, T(17, INK)); }   // marco esperando escolha
      if (cur && cur.id === tl.id) { g.fillStyle = INK; g.beginPath(); g.moveTo(x + BAR.w - 18, y + dy - 1); g.lineTo(x + BAR.w + 1, y + dy - 1); g.lineTo(x + BAR.w + 1, y + 18 + dy); g.closePath(); g.fill(); g.fillStyle = C.red; g.beginPath(); g.moveTo(x + BAR.w - 13, y + dy + 1); g.lineTo(x + BAR.w - 1, y + dy + 1); g.lineTo(x + BAR.w - 1, y + 13 + dy); g.closePath(); g.fill(); }
      hit(x - 2, BAR.y - 6, BAR.w + 4, BAR.h + 10, () => { if (!V.mile) select(tl.id); }, { x, y: BAR.y });
      if (V.hover === i || (on && V.enter < 1)) {
        const label = tl.name, tw = Math.max(80, label.length * 9.8 + 24), lx = U.clamp(x + BAR.w / 2 - tw / 2, 6, W - tw - 6);
        g.fillStyle = INK; D.rrect(g, lx, y - 34, tw, 26, 8); g.fill(); g.beginPath(); g.moveTo(x + BAR.w / 2 - 6, y - 9); g.lineTo(x + BAR.w / 2, y - 3); g.lineTo(x + BAR.w / 2 + 6, y - 9); g.fill();
        txt(label, lx + tw / 2, y - 20.5, T(17, C.cream));
      }
    });
    button(886, 476, 66, 58, '?', () => { V.help = !V.help; sfx('click'); }, { size: 24, sub: 'Ajuda', subSize: 17 });
  }

  /* ---- cartões flutuantes ---- */
  function card(x, y, w, h, px, py, side) {            // side: 'l' seta na esquerda, 'u' seta em cima, 'r' na direita
    g.fillStyle = 'rgba(40,22,8,.30)'; D.rrect(g, x - 2, y + 3, w + 4, h + 6, 14); g.fill();
    g.fillStyle = INK; D.rrect(g, x - 3, y - 3, w + 6, h + 8, 14); g.fill();
    g.beginPath();
    if (side === 'l') { g.moveTo(x - 2, py - 10); g.lineTo(x - 13, py); g.lineTo(x - 2, py + 10); }
    else if (side === 'r') { g.moveTo(x + w + 2, py - 10); g.lineTo(x + w + 13, py); g.lineTo(x + w + 2, py + 10); }
    else { g.moveTo(px - 10, y - 2); g.lineTo(px, y - 13); g.lineTo(px + 10, y - 2); }
    g.fill();
    g.fillStyle = '#FFF6DE'; D.rrect(g, x, y, w, h, 11); g.fill();
    g.beginPath();
    if (side === 'l') { g.moveTo(x + 1, py - 6); g.lineTo(x - 8, py); g.lineTo(x + 1, py + 6); }
    else if (side === 'r') { g.moveTo(x + w - 1, py - 6); g.lineTo(x + w + 8, py); g.lineTo(x + w - 1, py + 6); }
    else { g.moveTo(px - 6, y + 1); g.lineTo(px, y - 8); g.lineTo(px + 6, y + 1); }
    g.fill();
    hit(x - 4, y - 4, w + 8, h + 10, () => {}, null);
  }
  // quebra em até 2 linhas de n letras (texto de cartão estreito, sempre 17 px)
  function wrap2(str, n) { if (str.length <= n) return [str, '']; const w = str.split(' '); let a = '', i = 0; while (i < w.length && (a + ' ' + w[i]).trim().length <= n) { a = (a + ' ' + w[i]).trim(); i++; } return [a, w.slice(i).join(' ')]; }
  /* CARTÃO DA MÁQUINA (coluna da direita, guia de UX): dica "o que fazer agora" · nome · barra do nível até o próximo marco ·
     fileira de medalhas · seletor x1/x10/máx · UM botão dourado grande (preço + ganho em palavras) · "Usar na montanha". */
  const CARD = { x: 672, y: 156, w: 280, h: 306 };
  function hintStrip(x, y, w, s) { g.fillStyle = '#FFE9A8'; D.rrect(g, x, y, w, 30, 8); g.fill(); txt(s, x + w / 2, y + 16, T(17, INK)); }
  // botão de compra: dourado = dá pra comprar agora · cinza = falta dinheiro (e diz quanto)
  function buyBtn(x, y, w, h, label, cost, fn, extra, size) {
    const can = money() >= cost;
    button(x, y, w, h, label, fn, { fill: C.gold, off: !can, size: size || 20, sub: can ? '¥ ' + U.fmt(cost) + (extra ? ' · ' + extra : '') : 'falta ¥ ' + U.fmt(cost - money()), subCol: can ? INK : '#6B4A2E' });
  }
  function drawToolCard(t) {
    const tl = toolOf(V.tool); if (!tl) return;
    const c = CARD, x = c.x + 12, w = c.w - 24, y = c.y, p = plan(tl), inf = p.inf, cur = G.Inf.playing ? G.Inf.playing() : null, using = cur && cur.id === tl.id, pend = Math.max(0, inf.miles - inf.spec.length);
    card(c.x, c.y, c.w, c.h, 0, c.y + 200, 'l');
    if (pend) button(x, y + 8, w, 30, '★ Pegue o presente do marco', () => openMile(tl.id), { fill: Math.sin(t * 6) > 0 ? C.gold : C.goldL, size: 17 });
    else hintStrip(x, y + 8, w, p.can ? 'Toque em Melhorar' : 'Cave mais arroz pra melhorar');
    fit(tl.name, x, y + 60, using ? w - 70 : w, 20, INK, 'left');
    if (using) txt('em uso', x + w, y + 60, T(17, C.grassD, 'right'));
    // nível: barra do marco anterior até o próximo, com a estrela do marco na ponta
    txt('nível ' + inf.L + ' · marco no ' + inf.nextMile, x, y + 84, T(17, '#6B4A2E', 'left'));
    meter(x, y + 96, w - 24, 14, (inf.L - inf.prevMile) / Math.max(1, inf.nextMile - inf.prevMile), C.gold);
    blit(SPR.starOff, x + w - 9, y + 111 + Math.sin(t * 4) * 1.5, 2);
    // medalhas: uma por marco batido
    txt('medalhas', x, y + 128, T(17, '#6B4A2E', 'left'));
    if (inf.miles) { const mw = A.medalSlots(inf.miles, inf.spec) * 11 + 8; A.medals(g, x + w - mw / 2 - 2, y + 136, inf.miles, inf.spec, t, 2); }
    else txt('nenhuma ainda', x + w, y + 128, T(17, '#9a8a76', 'right'));
    // quantos níveis por toque (sem segurar)
    const sw = (w - 12) / 3;
    [[1, 'x1'], [10, 'x10'], ['max', 'máx']].forEach(([q, lab], i) => seg(x + i * (sw + 6), y + 146, sw, 34, lab, V.qty === q, () => { V.qty = q; sfx('click', { pitch: 1.2 }); }));
    const lab = 'Melhorar' + (p.n > 1 ? ' +' + p.n : '') + (p.mile ? ' ★' : '');
    button(x, y + 190, w, 64, lab, upgrade, { fill: C.gold, off: !p.can, size: 22, sub: p.can ? '¥ ' + U.fmt(p.tot) + ' · ' + gainTxt(p.gain) : 'falta ¥ ' + U.fmt(inf.cost - money()), subCol: p.can ? INK : '#6B4A2E' });
    button(x, y + 264, w, 32, using ? 'Em uso na montanha' : 'Usar na montanha', useTool, { fill: using ? '#BFE3B4' : '#D6E8F7', size: 17 });
  }
  /* cartões dos quadros da parede (Gêmea e Galpão): moram na COLUNA DA DIREITA, no lugar do cartão da máquina, e o quadro
     deles acende na parede. Abrem pela aba de cima ou tocando no quadro; fecham no X, na aba Máquinas, tocando fora ou Esc. */
  const RC = { x: 672, w: 280, bottom: 462 };
  function boardCard(h, p, t, title, hint) {
    const y = RC.bottom - h, k = 0.5 + 0.5 * Math.sin(t * 5), x = RC.x + 12, w = RC.w - 24;
    g.strokeStyle = INK; g.lineWidth = 7; D.rrect(g, p.x - 4, p.y - 4, p.w + 8, p.h + 8, 8); g.stroke();
    g.strokeStyle = k > 0.5 ? C.goldL : C.gold; g.lineWidth = 3.5; D.rrect(g, p.x - 4, p.y - 4, p.w + 8, p.h + 8, 8); g.stroke();
    card(RC.x, y, RC.w, h, 0, y + 60, 'l');
    txt(title, x, y + 26, T(20, INK, 'left'));
    xBtn(x + w - 42, y + 7, 42, 34, () => setTab(''));
    hintStrip(x, y + 50, w, hint);
    return y + 62;
  }
  function drawGemeaCard(t) {
    const I = G.Ind, r = I.run(), gp = Math.min(4, r.giant | 0), part = DATA.GIANT[gp], x = RC.x + 12, w = RC.w - 24;
    const y = boardCard(part ? 300 : 262, GEO.plan, t, 'Bagger Gêmea', part ? 'Compre as 4 peças dela' : 'Pronta! Escolha a cor');
    const tw = (w - 18) / 4;
    for (let i = 0; i < 4; i++) {   // progresso: 4 peças (verde = comprada, dourada = a próxima, cinza = depois)
      const tx = x + i * (tw + 6), on = i < gp, nx = i === gp;
      g.fillStyle = INK; D.rrect(g, tx - 2, y + 30, tw + 4, 44, 9); g.fill();
      g.fillStyle = on ? '#6DBF67' : nx ? C.gold : '#D9CFBB'; D.rrect(g, tx, y + 32, tw, 40, 7); g.fill();
      txt(String(i + 1), tx + 16, y + 53, T(20, on || nx ? INK : '#8a7a66'));
      if (on) blit(SPR.star, tx + tw - 16, y + 64, 2); else if (!nx) blit(SPR.lock, tx + tw - 16, y + 63, 2, { alpha: 0.7 });
      else blit(SPR.up, tx + tw - 16, y + 63 + Math.sin(t * 5) * 2, 2);
    }
    if (part) {
      const m0 = gp ? DATA.GIANT[gp - 1].mult : 1;
      txt('peça ' + (gp + 1) + ' de 4', x, y + 96, T(17, '#6B4A2E', 'left'));
      fit(part.n, x, y + 120, w, 19, INK, 'left');
      txt('arroz', x, y + 146, T(17, '#6B4A2E', 'left')); txt('×' + String(m0).replace('.', ',') + '  ▸  ×' + String(part.mult).replace('.', ','), x + w, y + 146, T(17, C.grassD, 'right'));
      buyBtn(x, y + 162, w, 64, 'Comprar a peça', I.cost.giant(), buyGiant);
    } else {
      txt('Ela cava do seu lado.', x, y + 96, T(17, '#6B4A2E', 'left'));
      txt('Arroz ×' + String(DATA.GIANT[3].mult).replace('.', ',') + ' pra sempre.', x, y + 118, T(17, C.grassD, 'left'));
      const cur = r.paint || 'kawaii', cols = { kawaii: '#F4B8C5', dino: '#9BC47A', normal: '#EDB93A' }, names = { kawaii: 'Kawaii', dino: 'Dino', normal: 'Normal' }, bw = (w - 12) / 3;
      I.PAINTS.forEach(([id], i) => {
        const bx = x + i * (bw + 6);
        button(bx, y + 132, bw, 58, names[id], () => { I.buy.paint(id, true); sfx('pop'); boardFx('gemea', names[id].toUpperCase()); }, { fill: cur === id ? '#BFE3B4' : C.cream, size: 17, sub: ' ' });
        g.fillStyle = INK; D.rrect(g, bx + bw / 2 - 22, y + 162, 44, 20, 7); g.fill(); g.fillStyle = cols[id]; D.rrect(g, bx + bw / 2 - 20, y + 164, 40, 16, 5); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(bx + bw / 2 - 17, y + 166, 34, 3);
      });
    }
  }
  function drawFabCard(t) {
    const I = G.Ind, r = I.run(), L = r.fab | 0, x = RC.x + 12, w = RC.w - 24;
    const y = boardCard(252, GEO.fab, t, 'Galpão do pátio', 'Cada nível: +12% de arroz');
    txt('nível ' + L, x, y + 46, T(19, INK, 'left'));
    txt('arroz', x, y + 72, T(17, '#6B4A2E', 'left')); txt(pct(0.12 * L) + '  ▸  ' + pct(0.12 * (L + 1)), x + w, y + 72, T(17, C.grassD, 'right'));
    txt('chega', x, y + 96, T(17, '#6B4A2E', 'left')); fit(I.nextFab(L), x + w, y + 96, w - 56, 17, C.oraD, 'right');
    buyBtn(x, y + 114, w, 64, 'Ampliar', I.cost.fab(), buyFab, '+12%');
  }
  /* LOJAS DA CIDADE: janela grande com um cartão por loja (desenho, nome, nível, 1 linha, botão de preço e "Favoritar").
     Funciona com qualquer número de lojas (fichas de conteudo/ somam lojas): 6 por página, botão "Mais lojas".
     Cores: dourado = dá pra comprar · cinza = falta dinheiro / fechada · verde = a favorita. */
  const SHOP_KN = { sell: 'de arroz', val: 'no preço', gold: 'no dourado' };
  const shopLine = sh => (G.Ind.shopLine ? G.Ind.shopLine(sh) : 'Favorita: +' + Math.round((sh.r || 0) * 100) + '% ' + (SHOP_KN[sh.k] || 'de arroz'));
  function drawShopCard(t) {
    const I = G.Ind, r = I.run(), list = DATA.SHOPS, pages = Math.max(1, Math.ceil(list.length / 6)), px = 18, py = 56, pw = 924, ph = 408;
    if (V.page >= pages) V.page = 0;
    g.fillStyle = 'rgba(30,18,10,.5)'; g.fillRect(0, 52, W, BAR.y - 62);
    hit(0, 52, W, BAR.y - 62, () => setTab(''), null);                       // tocar fora fecha
    pill(px, py, pw, ph, '#FFF6DE', 14); hit(px, py, pw, ph, () => {}, null);
    blit(A.flyerOf(r.client || list[0].id), px + 28, py + 44, 2);
    txt('Lojas da cidade', px + 50, py + 28, T(22, INK, 'left'));
    const hw = pages > 1 ? 330 : 500; hintStrip(px + 232, py + 12, hw, pages > 1 ? 'Cada nível de loja: +4% de arroz' : 'Abra e melhore lojas: cada nível dá +4% de arroz');
    if (pages > 1) button(px + 574, py + 9, 280, 36, 'Mais lojas ▸  (' + (V.page + 1) + ' de ' + pages + ')', () => { V.page = (V.page + 1) % pages; sfx('click'); }, { size: 17 });
    xBtn(px + pw - 60, py + 8, 48, 40, () => setTab(''));
    const cw = 292, ch = 164;
    list.slice(V.page * 6, V.page * 6 + 6).forEach((sh, i) => {
      const cx = px + 12 + (i % 3) * (cw + 12), cy = py + 58 + Math.floor(i / 3) * (ch + 12), L = r.shops[sh.id] | 0, cl = r.client === sh.id, c = I.cost.shop(sh.id), can = money() >= c;
      g.fillStyle = INK; D.rrect(g, cx - 2.5, cy - 2.5, cw + 5, ch + 6, 13); g.fill();
      g.fillStyle = cl ? '#E4F3D8' : L ? '#FFFDF2' : '#EDE4D0'; D.rrect(g, cx, cy, cw, ch, 10); g.fill();
      g.fillStyle = INK; D.rrect(g, cx + 8, cy + 8, 76, 76, 9); g.fill(); g.fillStyle = L ? '#FFE9A8' : '#D9CFBB'; D.rrect(g, cx + 10, cy + 10, 72, 72, 7); g.fill();
      blit(A.flyerOf(sh.id), cx + 46, cy + 78, 4, { alpha: L ? 1 : 0.55 });
      fit(sh.n || sh.id, cx + 94, cy + 26, cw - 104, 19, INK, 'left');
      txt(L ? 'nível ' + L : 'fechada', cx + 94, cy + 52, T(17, L ? C.grassD : '#8a7a66', 'left'));
      if (cl) { blit(SPR.star, cx + cw - 20, cy + 62, 2); txt('favorita', cx + cw - 34, cy + 52, T(17, C.grassD, 'right')); }
      txt(shopLine(sh), cx + 10, cy + 98, T(17, C.oraD, 'left'));
      button(cx + 8, cy + 112, 172, 44, can ? (L ? 'Subir ¥ ' : 'Abrir ¥ ') + U.fmt(c) : 'falta ¥ ' + U.fmt(c - money()), () => buyShop(sh.id), { fill: C.gold, off: !can, size: 17 });
      button(cx + 188, cy + 112, 96, 44, cl ? 'Favorita' : 'Favoritar', () => {
        if (!L) { toast('Abra a loja primeiro'); sfx('error'); V.shake = 0.3; return; }
        if (cl) { toast('Ela já é a favorita'); return; }
        if (I.buy.client(sh.id)) { sfx('chirin'); V.shopFx = { id: sh.id, t: 0, txt: '★' }; }
      }, { fill: cl ? '#BFE3B4' : C.cream, off: !L, size: 17 });
      if (V.shopFx && V.shopFx.id === sh.id) A.stamp(g, cx + cw / 2 + 40, cy + 56, V.shopFx.t, V.shopFx.txt || '+4%', K.red, 30);
    });
  }

  /* ---- escolha do marco: dois cartões ilustrados ---- */
  function drawMile(t, dt) {
    const m = V.mile; m.t += dt;
    const k = U.clamp((m.t - 0.9) / 0.35, 0, 1); if (k <= 0) return;
    g.fillStyle = 'rgba(30,18,10,' + (0.6 * k).toFixed(2) + ')'; g.fillRect(0, 0, W, H);
    hit(0, 0, W, H, () => {}, null);
    const e = U.ease.out(k), cw = 290, ch = 286, gap = 28, x0 = W / 2 - cw - gap / 2, y0 = 132 + (1 - e) * 40;
    g.globalAlpha = k;
    pill(W / 2 - 300, 54 - (1 - e) * 20, 600, 66, '#FFF6DE', 14);
    fit('Marco! ' + m.tool.name + ' nível ' + m.L, W / 2, 76 - (1 - e) * 20, 570, 21, INK);
    txt(m.again ? 'Seu presente do marco: escolha 1' : 'Ela ficou 2x mais forte! Agora escolha 1 presente:', W / 2, 102 - (1 - e) * 20, T(18, C.oraD));
    const opts = [['r', 'Mais rápida', 'esta máquina rende +50%', K.red, '#FBD9D2'], ['d', 'Mais dourada', 'arroz dourado vale +10%', K.goldD, '#FFF0B8']];
    opts.forEach(([id, name, sub, col, bgc], i) => {
      const x = x0 + i * (cw + gap), pressed = pressBtn && pressBtn.x === x, y = y0 + (pressed ? 2 : 0) + Math.sin(t * 2.4 + i * 2) * 2;
      g.fillStyle = 'rgba(40,22,8,.35)'; D.rrect(g, x - 2, y + 4, cw + 4, ch + 8, 18); g.fill();
      g.fillStyle = INK; D.rrect(g, x - 3, y - 3, cw + 6, ch + 9, 18); g.fill();
      g.fillStyle = '#FFF6DE'; D.rrect(g, x, y, cw, ch, 15); g.fill();
      g.fillStyle = bgc; D.rrect(g, x + 10, y + 10, cw - 20, 150, 10); g.fill();
      // ilustração: a própria máquina (ícone grandão) correndo com risquinhos, ou dourada com brilhos
      g.save(); D.rrect(g, x + 10, y + 10, cw - 20, 150, 10); g.clip();
      const ix = x + cw / 2, iy = y + 88;
      if (id === 'r') {
        g.strokeStyle = 'rgba(200,66,58,.55)'; g.lineWidth = 5; g.lineCap = 'round';
        for (let j = 0; j < 7; j++) { const q = (t * 1.8 + j * 0.37) % 1, ly = y + 24 + j * 20, lx = x + cw - 10 - q * (cw + 40); g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 34 + (j % 3) * 14, ly); g.stroke(); }
        g.lineCap = 'butt';
        g.save(); g.translate(ix + Math.sin(t * 18) * 1.5, iy + Math.abs(Math.sin(t * 9)) * -4); g.rotate(-0.1); iconAt(m.tool.id, 6, 0, 6); g.restore();
        blit(SPR.bolt, x + 48, y + 64 + Math.sin(t * 6) * 3, 4); blit(SPR.bolt, x + cw - 44, y + 150 + Math.sin(t * 6 + 2) * 3, 3);
        for (let j = 0; j < 3; j++) { const q = (t * 2.2 + j / 3) % 1; g.fillStyle = 'rgba(255,250,238,' + (0.8 * (1 - q)).toFixed(2) + ')'; g.beginPath(); g.arc(ix - 50 - q * 46, iy + 34 - q * 10, 5 + q * 9, 0, TAU); g.fill(); }
      } else {
        const gr = g.createRadialGradient(ix, iy, 6, ix, iy, 120); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, cw, 170);
        g.save(); g.translate(ix, iy); g.rotate(t * 0.25); g.fillStyle = 'rgba(243,201,74,.35)'; for (let j = 0; j < 8; j++) { g.rotate(TAU / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(-14, 150); g.lineTo(14, 150); g.closePath(); g.fill(); } g.restore();
        iconAt(m.tool.id, ix, iy + Math.sin(t * 3) * 3, 6);
        for (let j = 0; j < 5; j++) { const a = t * 0.9 + j * TAU / 5; blit(SPR.grain, ix + Math.cos(a) * 84, iy + 12 + Math.sin(a) * 40, 2 + (j % 2)); }
        A.twinkle(g, x + 24, y + 26, cw - 48, 120, t, 9, i + 3);
      }
      g.restore();
      txt(name, x + cw / 2, y + 182, T(24, col));
      txt(sub, x + cw / 2, y + 210, T(18, '#6B4A2E'));
      g.fillStyle = INK; D.rrect(g, x + 28, y + 228, cw - 56, 48, 12); g.fill(); g.fillStyle = C.gold; D.rrect(g, x + 31, y + 231, cw - 62, 40, 9); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; D.rrect(g, x + 36, y + 233.5, cw - 72, 3, 1.5); g.fill();
      txt('Quero esta', x + cw / 2, y + 252, T(20, INK));
      hit(x, y0, cw, ch, () => pick(id), { x, y: y0 });
    });
    txt('Não tem escolha errada. As duas são boas!', W / 2, y0 + ch + 24, T(18, '#FFF6DE'));
    button(W / 2 - 130, y0 + ch + 44, 260, 44, 'Decidir depois', later, { fill: '#F3E7CC', size: 18 });
    g.globalAlpha = 1;
  }
  function drawHelp() {
    g.fillStyle = 'rgba(30,18,10,.6)'; g.fillRect(0, 0, W, H);
    hit(0, 0, W, H, () => { V.help = false; sfx('click'); });
    const w = 700, h = 372, x = (W - w) / 2, y = 84;
    pill(x, y, w, h, '#FFF6DE', 14);
    E.drawShibaHead(g, x + 52, y + 50, performance.now() / 1000, { scale: 1.1, expr: 'happy' });
    txt('Como funciona a Oficina', x + 100, y + 36, T(24, INK, 'left'));
    txt('Aqui suas máquinas ficam mais fortes.', x + 100, y + 66, T(18, '#6B4A2E', 'left'));
    const tips = ['Toque numa máquina (fileira de baixo).', 'Aperte o botão dourado Melhorar.', 'x10 e máx compram vários níveis de uma vez.', 'No marco (★) ela dobra a força e dá um presente.', 'O nível vale pra máquina que está em uso.', 'Em cima: Gêmea, Galpão e Lojas dão mais arroz.'];
    tips.forEach((s, i) => { g.fillStyle = INK; g.beginPath(); g.arc(x + 40, y + 112 + i * 38, 13, 0, TAU); g.fill(); g.fillStyle = C.gold; g.beginPath(); g.arc(x + 40, y + 112 + i * 38, 10.5, 0, TAU); g.fill(); txt(String(i + 1), x + 40, y + 113 + i * 38, T(17, INK)); txt(s, x + 64, y + 113 + i * 38, T(20, INK, 'left')); });
    xBtn(x + w - 58, y + 10, 48, 44, () => { V.help = false; sfx('click'); });
  }
  function drawOverlayMsgs(t, dt) {
    if (V.banner) {
      const b = V.banner; b.t += dt;
      const k = Math.min(1, b.t / 0.25), out = b.t > b.life - 0.3 ? (b.life - b.t) / 0.3 : 1, e = U.ease.out(k) * Math.max(0, out), y = 56 + e * 26 - 26;
      g.globalAlpha = Math.max(0, Math.min(1, e));
      const w = Math.max(360, Math.max(b.a.length * 15, b.b.length * 10.4) + 70);
      g.fillStyle = 'rgba(40,22,8,.3)'; D.rrect(g, W / 2 - w / 2 - 2, y + 4, w + 4, 74, 18); g.fill();
      g.fillStyle = INK; D.rrect(g, W / 2 - w / 2 - 3, y - 3, w + 6, 76, 18); g.fill();
      g.fillStyle = b.col; D.rrect(g, W / 2 - w / 2, y, w, 68, 15); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; D.rrect(g, W / 2 - w / 2 + 6, y + 4, w - 12, 5, 2.5); g.fill();
      blit(SPR.star, W / 2 - w / 2 + 26, y + 46, 3); blit(SPR.star, W / 2 + w / 2 - 26, y + 46, 3);
      txt(b.a, W / 2, y + 24, T(24, C.cream, 'center', { sw: 5, stroke: INK })); txt(b.b, W / 2, y + 51, T(17, INK));
      g.globalAlpha = 1;
      if (b.t >= b.life) V.banner = null;
    }
    if (V.toast) {
      const o = V.toast; o.life -= dt; const a = U.clamp(o.life * 3, 0, 1), tw = Math.max(160, o.t.length * 10.2 + 36);
      g.globalAlpha = a; g.fillStyle = INK; D.rrect(g, W / 2 - tw / 2, 416, tw, 36, 12); g.fill(); txt(o.t, W / 2, 434.5, T(18, C.cream)); g.globalAlpha = 1;
      if (o.life <= 0) V.toast = null;
    }
  }

  /* ======================================================================
     Entrada (mouse e toque)
     ====================================================================== */
  const inR = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  let zones = [];                                             // áreas tocáveis da cena (remontadas a cada quadro)
  input.on('down', (x, y) => {
    for (let i = btns.length - 1; i >= 0; i--) { const b = btns[i]; if (x >= b.x - 3 && y >= b.y - 3 && x < b.x + b.w + 3 && y < b.y + b.h + 6) { pressBtn = b.o; b.fn(); return; } }
    if (V.mile || V.help) return;
    if (V.board !== 'lojas') for (let i = zones.length - 1; i >= 0; i--) { const z = zones[i]; if (inR(x, y, z)) { z.fn(); return; } }
    if (V.board) { V.board = null; sfx('click', { pitch: 0.9 }); }
  });
  input.on('move', (x, y) => {
    V.hover = -1;
    if (y >= BAR.y - 6 && y < BAR.y + BAR.h + 8) { const n = owned().length; for (let i = 0; i < n; i++) { const bx = barX(i, n); if (x >= bx && x < bx + BAR.w) V.hover = i; } }
    V.hot = null; if (!V.mile && !V.help && y < BAR.y - 10) for (let i = zones.length - 1; i >= 0; i--) if (inR(x, y, zones[i])) { V.hot = zones[i].id; break; }
    if (V.hold && pressBtn && !(x >= pressBtn.x - 12 && x < pressBtn.x + 232 && y >= pressBtn.y - 12 && y < pressBtn.y + 70)) V.hold = null;
  });
  input.on('up', () => { pressBtn = null; V.hold = null; });
  addEventListener('blur', () => { V.hold = null; pressBtn = null; });
  addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { if (V.help) V.help = false; else if (V.mile) later(); else if (V.board) V.board = null; else close(); return; }
    if (V.mile || V.help) return;
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !V.board) { upgrade(); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const l = owned(), i = Math.max(0, l.findIndex(q => q.id === V.tool)) + (e.key === 'ArrowRight' ? 1 : -1); if (l[i]) select(l[i].id); }
  });

  /* ======================================================================
     Quadro
     ====================================================================== */
  let lastT = 0, raf = 0;
  function tick(dt, rdt) {                                   // dt = passo da animação (limitado); rdt = tempo de verdade (segurar o botão)
    V.t += dt; ps.update(dt); fl.update(dt);
    yenBump = Math.max(0, yenBump - dt * 3);
    if (V.enter < 1) { const e0 = V.enter; V.enter = Math.min(1, V.enter + dt / 0.32); if (e0 < 0.7 && V.enter >= 0.7) { V.sqV = 4.2; sfx('ofi-pouso'); const lp = A.liftPos(V.tool); ps.puff(LIFT.x - lp.w * 0.3, LIFT.y + 6, 5, 9, { c: C.sand }); ps.puff(LIFT.x + lp.w * 0.3, LIFT.y + 6, 5, 9, { c: C.sand }); } }
    // mola do amassa-e-estica da máquina
    for (let left = dt; left > 1e-6; left -= 1 / 120) { const h = Math.min(1 / 120, left); V.sqV += (-260 * V.sq - 15 * V.sqV) * h; V.sq += V.sqV * h; }
    V.sq = U.clamp(V.sq, -0.2, 0.2);
    V.shake = Math.max(0, V.shake - dt); if (V.shopFx) { V.shopFx.t += dt * 1.6; if (V.shopFx.t >= 1) V.shopFx = null; }
    V.burst = Math.max(0, V.burst - dt); V.kick = Math.max(0, V.kick - dt * 2.2); V.flash = Math.max(0, V.flash - dt * 1.6);
    V.liftH += ((V.burst > 0 ? 12 : 0) - V.liftH) * Math.min(1, dt * 12);
    if (V.stamp) { V.stamp.t += dt / (V.stamp.big ? 1.5 : 0.75); if (V.stamp.t >= 1) V.stamp = null; }
    if (V.boardFx) { V.boardFx.t += dt * 1.6; if (V.boardFx.t >= 1) V.boardFx = null; }
    // segurar o botão: repete cada vez mais rápido
    if (V.hold && input.down && !V.mile) { V.hold.t -= (rdt || dt); if (V.hold.t <= 0) { V.hold.n++; V.hold.t = Math.max(0.09, 0.26 - V.hold.n * 0.02); if (!upgrade()) V.hold = null; } }
    else if (V.hold && !input.down) V.hold = null;
    if (V.live) A.liveTick(V.live, dt);
    // equipe: corre pro ponto de trabalho durante a melhoria, volta pro cantinho depois
    const ws = V.tool ? workSpots() : null, all = V.burst > 0 && ws;
    // de vez em quando um deles vai dar uma apertadinha sozinho (nada fica parado)
    if (!all && !V.mile && ws) { V.tinkT -= dt; if (V.tinkT <= 0) { V.tinkT = 5 + Math.random() * 4; V.tinkWho = (V.tinkWho + 1) % CREW.length; V.tinkLeft = 1.7; } }
    V.tinkLeft = Math.max(0, V.tinkLeft - dt);
    CREW.forEach((c, i) => {
      const busy = all || (ws && V.tinkLeft > 0 && V.tinkWho === i), rate = all ? 22 : 5;
      const tx = busy ? ws[i][0] : c.hx, ty = busy ? ws[i][1] : c.hy, k = Math.min(1, dt * (busy ? 16 : 6));
      c.vx = (tx - c.x); c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
      c.work = busy && Math.abs(tx - c.x) < 14 ? Math.min(1, c.work + dt * 8) : Math.max(0, c.work - dt * 5);
      if (busy && c.work > 0.5 && Math.random() < dt * rate) { const sx = c.x + ws[i][2] * 24, sy = c.y - 22 - Math.random() * 30; sparksAt(sx, sy, c.tool === 'torch' ? 4 : 2); }
    });
  }
  const sortY = (a, b) => a.y - b.y;
  function render(dt) {
    const t = performance.now() / 1000, s = GS(), dpr = stage.dpr;
    btns = []; zones = [];
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tod = s ? (s.tod || 0.3) : 0.3, Lg = E.Nature && E.Nature.light ? E.Nature.light(tod) : null;
    const dusk = Lg ? U.clamp(Math.max(Lg.night, Lg.dusk * 0.75), 0, 1) : 0, day = 1 - dusk;
    const I = G.Ind, r = I.run(), own = {}, list = owned();
    for (const tl of list) own[tl.id] = 1;
    const onLift = V.tool, show = { bagger: own.bagger && onLift !== 'bagger', pacabo: own.pacabo && onLift !== 'pacabo', caminhao: own.caminhao && onLift !== 'caminhao' };
    // ---- lá fora, cenário, luz do dia
    A.yard(g, t, Lg, { dpr, show, night: dusk });
    g.imageSmoothingEnabled = false; g.drawImage(A.bg(), 0, 0, W, H);
    if (day > 0.03) { g.globalAlpha = day; g.drawImage(A.sun(), 0, 0, W, H); g.globalAlpha = 1; }
    A.yardPoke(g, { dpr, show });
    // qual quadro ganha a setinha verde (só o mais barato que dá pra comprar)
    const can = { gemea: false, fab: false, lojas: false }, canAll = {};
    { const opt = []; if ((r.giant | 0) < 4) opt.push(['gemea', I.cost.giant()]); opt.push(['fab', I.cost.fab()]); opt.push(['lojas', Math.min.apply(null, DATA.SHOPS.map(q => I.cost.shop(q.id)))]);
      for (const q of opt) canAll[q[0]] = money() >= q[1];
      opt.sort((a, b) => a[1] - b[1]); if (opt[0] && money() >= opt[0][1] && !V.board) can[opt[0][0]] = true; }
    A.wall(g, t, { tod, dusk, L: Lg, owned: own, sel: onLift, giant: Math.min(4, r.giant | 0), fabLv: r.fab | 0, shops: r.shops, shopIds: DATA.SHOPS.map(q => q.id), client: r.client, can, hot: V.hot });
    // áreas tocáveis da parede e do pátio
    for (const id of ['bagger', 'pacabo', 'caminhao']) if (show[id]) { const q = A.yardRect(id); zones.push({ id, x: q.x, y: q.y, w: q.w, h: q.h, fn: () => select(id) }); }
    for (const id of ['pata', 'hashi', 'tigela', 'pa', 'duaspas']) if (own[id]) { const q = A.pegPos(id); zones.push({ id, x: q.x - 15, y: q.y - 66, w: 30, h: 72, fn: () => select(id) }); }
    zones.push({ id: 'gemea', x: GEO.plan.x, y: GEO.plan.y, w: GEO.plan.w, h: GEO.plan.h, fn: () => openBoard('gemea') });
    zones.push({ id: 'fab', x: GEO.fab.x - 4, y: GEO.fab.y, w: GEO.fab.w + 8, h: GEO.fab.h + 14, fn: () => openBoard('fab') });
    zones.push({ id: 'lojas', x: GEO.cork.x, y: GEO.cork.y, w: GEO.cork.w, h: GEO.cork.h, fn: () => openBoard('lojas') });
    // ---- chão: tudo que tem pé, de trás pra frente
    const items = [];
    for (const id in GEO.bays) {
      if (!own[id]) continue;
      const b = GEO.bays[id], bk = A.bake(id, b.s, dpr), inf = G.Inf.info(toolOf(id)), away = onLift === id;
      if (!away) zones.push({ id, x: b.x + bk.dx, y: b.y + bk.dy, w: bk.w, h: bk.h + 8, fn: () => select(id) });
      items.push({ y: b.y, fn: () => {
        if (away) { g.strokeStyle = 'rgba(255,246,206,.5)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.strokeRect(b.x + bk.dx + 8, b.y - 14, bk.w - 16, 16); g.setLineDash([]); return; }
        const hop = V.hot === id ? -3 : 0;
        if (inf.miles >= 2) A.drawBake(g, A.glow(id, b.s, dpr, inf.miles >= 3 ? '#F3C94A' : '#EAF2FF', 2.5), b.x, b.y + hop);
        A.drawBake(g, bk, b.x, b.y + hop);
        if (inf.miles >= 2) A.twinkle(g, b.x + bk.dx, b.y + bk.dy, bk.w, bk.h, t, 3, idxOf(id));
        const bx = b.x + bk.dx + 22;
        A.levelBadge(g, bx, b.y + 6, inf.L, inf.miles);
        A.medals(g, bx + 30 + A.medalSlots(inf.miles, inf.spec) * 5.5, b.y + 16, inf.miles, inf.spec, t);
        if (inf.miles > inf.spec.length) blit(SPR.star, bx, b.y - 12 + Math.sin(t * 5) * 3, 2);   // marco esperando escolha
      } });
    }
    // mecânico cochilando embaixo do trator e outro mexendo na bancada
    if (own.trator && onLift !== 'trator') items.push({ y: 307, fn: () => A.mech(g, 96, 312, (t % 14) < 10 ? 'lie' : 'scratch', t, { pal: 'cha', face: -1 }) });
    items.push({ y: 229, fn: () => A.mech(g, 806, 230, ['sit', 'think', 'sniff', 'sit'][Math.floor(t / 4.5) % 4], t + 2, { pal: 'aka', face: 1, tool: Math.floor(t / 4.5) % 4 === 0 ? 'spanner' : null, rot: -0.6 + Math.sin(t * 5) * 0.4 }) });
    // segundo mecânico da bancada: solda uma peça na morsa de tempos em tempos (máscara, maçarico e clarão azul)
    items.push({ y: 228, fn: () => {
      const ph = (t + 3) % 11, weld = ph < 3.4, bx = 752, by = 230;
      A.mech(g, bx, by, weld ? 'stand' : ['sit', 'wag', 'sniff'][Math.floor(t / 5.5) % 3], t + 5, { pal: 'shiro', face: -1, hat: weld ? 'mask' : 'cap', tool: weld ? 'torch' : null, rot: -0.5 + Math.sin(t * 22) * 0.25 });
      if (weld) {
        const fk = 0.5 + 0.5 * Math.sin(t * 61); g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(bx - 24, by - 22, 2, bx - 24, by - 22, 38); gr.addColorStop(0, 'rgba(190,225,255,' + (0.65 * fk).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(190,225,255,0)'); g.fillStyle = gr; g.fillRect(bx - 64, by - 62, 80, 80);
        g.globalCompositeOperation = 'source-over';
        for (let k = 0; k < 3; k++) { const q = (t * 3.1 + k / 3) % 1; g.fillStyle = k % 2 ? '#FFF6C8' : '#FFD67A'; g.fillRect(Math.round(bx - 24 - q * (10 + k * 6)), Math.round(by - 22 + q * q * 26 - q * 10), 2, 2); }
      }
    } });
    // o Kome assistindo (quando não é ele mesmo em cima do elevador)
    if (onLift && !A.HAND[onLift]) items.push({ y: 467, fn: () => E.drawShiba(g, 346, 466, V.burst > 0 ? 'cheer' : ['sit', 'wag', 'proud', 'wag'][Math.floor(t / 3.7) % 4], t, { pal: pal(), face: 1 }) });
    // elevador: colunas atrás, plataforma, máquina viva
    const ti = idxOf(onLift), heavy = ti >= 13 ? 1 : ti === 12 ? 0.7 : ti === 11 ? 0.35 : 0;
    items.push({ y: LIFT.y - 3, fn: () => A.lift(g, t, { back: true, h: V.liftH, heavy, load: (ti + 1) / TOOLS().length }) });
    items.push({ y: LIFT.y, fn: () => {
      A.lift(g, t, { h: V.liftH, heavy });
      if (!onLift || !V.live) return;
      const lp = A.liftPos(onLift), inf = G.Inf.info(toolOf(onLift)), e = V.enter, drop = e < 0.7 ? (1 - U.ease.in(e / 0.7)) * 70 : 0;
      const x = LIFT.x + lp.ox, y = LIFT.y - V.liftH - drop, sx = 1 + V.sq, sy = 1 - V.sq;
      g.globalAlpha = Math.min(1, e * 3);
      if (!V.live.hand && inf.miles >= 2) { const gl = A.glow(onLift, lp.s, dpr, inf.miles >= 3 ? '#F3C94A' : '#EAF2FF', 3); g.save(); g.translate(x, y); g.scale(sx, sy); A.drawBake(g, gl, 0, 0); g.restore(); }
      A.liveDraw(g, V.live, x, y, lp.s, dpr, { sx, sy });
      g.globalAlpha = 1;
      if (inf.miles >= 2) A.twinkle(g, LIFT.x - lp.w / 2, y - lp.h, lp.w, lp.h, t, 7, ti + 1);
      zones.push({ id: 'lift', x: LIFT.x - Math.min(170, lp.w / 2), y: Math.max(206, y - lp.h), w: Math.min(340, lp.w), h: Math.min(lp.h, y - 206), fn: () => { V.sqV = 3.4; sfx('click', { pitch: 1.3 }); } });
      A.medals(g, LIFT.x, LIFT.y + 31 - V.liftH, inf.miles, inf.spec, t, 3);
    } });
    CREW.forEach((c, i) => items.push({ y: c.y, fn: () => {
      const moving = Math.abs(c.vx) > 10, working = c.work > 0.5, ws = V.tool && (V.burst > 0 || (V.tinkLeft > 0 && V.tinkWho === i)) ? workSpots()[i] : null;
      const face = ws ? (moving ? Math.sign(c.vx) || 1 : ws[2]) : (moving ? Math.sign(c.vx) || 1 : c.face);
      const pose = moving ? 'run' : working ? (i === 2 ? 'stand' : i ? 'push' : 'dig') : c.idle[Math.floor((t + i * 1.7) / 4.2) % c.idle.length];
      A.mech(g, c.x, c.y, pose, t + i, { pal: c.pal, face, hat: working && i === 2 ? 'mask' : 'cap', tool: working || pose === 'sit' ? c.tool : null, rot: working ? -0.5 + Math.sin(t * 26 + i) * 0.6 : -0.9 + Math.sin(t * 3 + i) * 0.15 });
      if (working && i === 2) { const fk = 0.5 + 0.5 * Math.sin(t * 61); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(c.x + face * 26, c.y - 20, 2, c.x + face * 26, c.y - 20, 46); gr.addColorStop(0, 'rgba(190,225,255,' + (0.7 * fk).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(190,225,255,0)'); g.fillStyle = gr; g.fillRect(c.x - 60, c.y - 70, 120, 100); g.globalCompositeOperation = 'source-over'; }
    } }));
    items.sort(sortY);
    for (const it of items) it.fn();
    ps.draw(g);
    // estalos de impacto (estrelinha de 4 pontas que abre e some)
    for (let i = V.pops.length - 1; i >= 0; i--) {
      const p = V.pops[i]; p.t += dt * 5; if (p.t >= 1) { V.pops.splice(i, 1); continue; }
      const r = 6 + p.t * 16, a = 1 - p.t;
      g.globalAlpha = a; g.fillStyle = INK; g.beginPath(); for (let k = 0; k < 8; k++) { const an = k / 8 * TAU, rr = (k % 2 ? r * 0.36 : r) + 2; g.lineTo(p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr); } g.closePath(); g.fill();
      g.fillStyle = '#FFF6C8'; g.beginPath(); for (let k = 0; k < 8; k++) { const an = k / 8 * TAU, rr = k % 2 ? r * 0.36 : r; g.lineTo(p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr); } g.closePath(); g.fill(); g.globalAlpha = 1;
    }
    if (day > 0.2) {                                         // poeirinha no sol da porta
      g.fillStyle = '#FFF6D0';
      for (let i = 0; i < 16; i++) { const y = 206 + ((i * 97 + t * (5 + i % 4)) % 190), x = 40 + ((i * 53) % 190) + (y - 206) * 0.42 + Math.sin(t * 0.5 + i) * 6; g.globalAlpha = day * 0.5 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 2.1)); g.fillRect(Math.round(x), Math.round(y), 2, 2); }
      g.globalAlpha = 1;
    }
    // ---- luminárias, tinta da hora do dia e cones de luz
    A.lamps(g, t, { dusk, kick: V.kick });
    if (dusk > 0.03) { g.fillStyle = 'rgba(38,28,84,' + (dusk * 0.36).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
    g.globalCompositeOperation = 'lighter';
    if (dusk > 0.03) { g.globalAlpha = dusk; g.drawImage(A.dusk(), 0, 0, W, H); g.globalAlpha = 1; }
    A.lamps(g, t, { dusk, kick: V.kick, add: true });
    if (V.flash > 0) { g.fillStyle = 'rgba(255,240,190,' + (V.flash * 0.35).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
    g.globalCompositeOperation = 'source-over';
    if (V.stamp && !V.stamp.big) A.stamp(g, V.stamp.x, V.stamp.y, V.stamp.t, V.stamp.txt, K.red, V.stamp.txt.length > 3 ? 24 : 34);
    fl.draw(g);
    // ---- HUD
    drawTopBar(t, canAll);
    drawBottomBar(t);
    { const sk = V.shake > 0 ? Math.sin(V.shake * 42) * 5 * (V.shake / 0.3) : 0; if (sk) { g.save(); g.translate(sk, 0); }
      if (V.board === 'gemea') drawGemeaCard(t); else if (V.board === 'fab') drawFabCard(t); else if (V.board === 'lojas') drawShopCard(t); else if (V.tool) drawToolCard(t);
      if (sk) g.restore(); }
    if (V.stamp && V.stamp.big) A.stamp(g, V.stamp.x, V.stamp.y, V.stamp.t, V.stamp.txt, K.red, 44);
    if (G.News && V.board !== 'lojas') G.News.draw(g, 10, 58, dt, { maxW: 400 });   // evento do modo infinito + avisos do jogo (banner, toast, conquista)
    drawOverlayMsgs(t, dt);
    if (V.mile) drawMile(t, dt);
    if (V.help) drawHelp();
  }
  function frame() {
    if (!isOpen()) { raf = 0; return; }
    const now = performance.now() / 1000, rdt = Math.min(0.3, lastT ? now - lastT : 0.016), dt = Math.min(0.1, rdt); lastT = now;
    try { tick(dt, rdt); render(dt); }
    catch (err) { if (window.console) console.warn('[kome] oficina: erro no quadro, voltando pra lista', err); close(); if (G.Inf) { G.Inf.classic = true; G.Inf.openList(); } return; }
    raf = requestAnimationFrame(frame);
  }

  /* ---- abrir / fechar ---- */
  function isOpen() { return root.classList.contains('k-ofi-open'); }
  function open() {
    const s = GS(); if (!s || !s.ended || !G.Inf || !G.Ind || !G.Inf.info || !G.Ind.buy) return false;
    const cur = G.Inf.playing ? G.Inf.playing() : null, list = owned();
    const first = cur && list.some(q => q.id === cur.id) ? cur.id : list[list.length - 1].id;
    V.shake = 0; V.shopFx = null; V.tool = null; V.live = null; V.board = null; V.mile = null; V.help = false; V.hold = null; V.stamp = null; V.banner = null; V.toast = null; V.burst = 0;
    select(first, true); V.enter = 1;
    CREW.forEach(c => { c.x = c.hx; c.y = c.hy; c.work = 0; });
    A.bg();                                                  // se a arte tiver erro, estoura aqui e o G.Inf.open cai na lista
    root.classList.add('k-ofi-open'); stage.resize(); lastT = 0;
    if (!raf) raf = requestAnimationFrame(frame);
    sfx('whoosh');
    return true;
  }
  function close() {
    if (!isOpen()) return;
    V.mile = null;                                           // marco sem escolha fica PENDENTE na máquina (nada é escolhido sozinho)
    root.classList.remove('k-ofi-open'); V.hold = null; V.help = false; V.board = null; ps.clear(); fl.clear();
    if (G.Inf && G.Inf.recompute) G.Inf.recompute();
  }

  G.Ofi = {
    open, close, isOpen,
    // testes e prints
    select: id => select(id, true), board: b => { V.board = b || null; if (b === 'lojas' && !V.shop) V.shop = DATA.SHOPS[0].id; }, upgrade, pick: ch => { if (V.mile) V.mile.t = Math.max(V.mile.t, 2); return pick(ch); },
    help: on => { V.help = !!on; }, shop: id => { V.shop = id; }, later: () => { if (V.mile) V.mile.t = Math.max(V.mile.t, 2); return later(); }, openMile, pending: pendOf, use: useTool,
    step(sec) { let left = sec, n = 0; const t0 = performance.now(); while (left > 1e-6) { const d = Math.min(1 / 30, left); tick(d); render(d); left -= d; n++; } return +((performance.now() - t0) / n).toFixed(2); },   // avança sem esperar o relógio (prints); devolve ms por quadro
    qty: q => { V.qty = q === 'max' ? 'max' : q === 10 ? 10 : 1; }, plan: () => { const t = toolOf(V.tool); return t ? plan(t) : null; },
    get state() { return { open: isOpen(), tool: V.tool, board: V.board, qty: V.qty, mile: !!V.mile, lv: V.tool ? lvOf(V.tool) : 0, burst: V.burst, pend: V.tool ? pendOf(V.tool) : 0, hold: !!V.hold }; },
  };
})();
