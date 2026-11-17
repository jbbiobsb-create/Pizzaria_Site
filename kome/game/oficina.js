/* Kome no Japão — oficina.js
   A OFICINA DO KOME como um LUGAR (garagem de mecânico em tela cheia, no jeito da Fábrica: canvas próprio de 960×540 por
   cima do jogo). Aqui é só apresentação e toque; as CONTAS continuam onde sempre estiveram:
     - nível das máquinas, preço, marcos 10/25/50: game/infinite.js (G.Inf.up / G.Inf.info);
     - Bagger Gêmea, fábrica do pátio, lojas, pintura, escolha do marco: game/industry.js (G.Ind.buy.* / G.Ind.spec).
   Nenhuma fórmula nem chave de save mudou. G.Inf.open() abre esta tela; se ela falhar (ou com ?oficina=lista) abre a lista antiga.
   Como funciona: as máquinas que você tem estão na garagem (painel, vagas, pátio lá fora). Tocar numa leva ela pro elevador;
   "Melhorar" chama a equipe de mecânicos (segurar repete). Prancheta azul = Gêmea, quadro = fábrica do pátio, cortiça = lojas.
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
  const fx2 = v => v.toFixed(2).replace('.', ','), fx1 = v => v.toFixed(1).replace('.', ',');
  const pct = v => '+' + Math.round(v * 100) + '%';

  /* ======================================================================
     Estado da tela (nada daqui vai pro save)
     ====================================================================== */
  const V = {
    tool: null, board: null, live: null, enter: 1, sq: 0, sqV: 0, liftH: 0, burst: 0, burstN: 0, kick: 0,
    stamp: null, mile: null, banner: null, toast: null, help: false, shop: null, hover: -1, hold: null, t: 0, flash: 0, boardFx: null,
    tinkT: 4, tinkWho: 0, tinkLeft: 0,
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
  function sparksAt(x, y, n) { ps.sparks(x, y, n, { speed: [90, 300], life: [0.2, 0.5] }); }
  function upgrade() {
    const t = toolOf(V.tool); if (!t || V.mile || !G.Inf) return false;
    const inf = G.Inf.info(t);
    if (money() < inf.cost) { toast('Faltam ¥' + U.fmt(inf.cost - money())); sfx('error'); V.hold = null; return false; }
    const r = G.Inf.up(t, { quiet: true }); if (!r) return false;
    V.burst = 0.6; V.burstN++; V.sqV = -2.6; V.kick = 1;
    const lp = A.liftPos(V.tool);
    V.stamp = { t: 0, txt: '+1', x: LIFT.x + Math.min(120, lp.w * 0.32), y: LIFT.y - Math.min(190, lp.h * 0.8) - 6 };
    sfx(V.burstN % 2 ? 'ofi-catraca' : 'ofi-solda', { pitch: 0.94 + (V.burstN % 5) * 0.04 }); sfx('ofi-carimbo', { delay: 0.1 });
    fl.add(GEO.card.x + 120, GEO.card.y + 150, 'Nv ' + r.L, { size: 20, c: K.goldL, life: 0.9 });
    if (r.mile) milestone(t, r.L);
    return true;
  }
  function milestone(t, L) {
    V.hold = null; V.mile = { tool: t, L, t: 0 }; V.flash = 1;
    sfx('ofi-marco'); sfx('fanfare', { vol: 0.6 });
    ps.burst(LIFT.x, LIFT.y - 120, 60, { c: [C.gold, C.sakura, C.goldL, C.cream], shape: 'star', speed: [140, 420], life: 1.3 });
    V.stamp = { t: 0, txt: 'MARCO!', x: LIFT.x, y: LIFT.y - 150, big: true };
  }
  function pick(ch) {
    const m = V.mile; if (!m || m.t < 0.9) return false;
    G.Ind.spec(m.tool, ch); G.Inf.recompute();
    V.mile = null; V.sqV = -3; V.flash = 0.6; sfx('ofi-peca'); sfx('chirin');
    ps.burst(LIFT.x, LIFT.y - 100, 34, { c: ch === 'd' ? [C.gold, C.goldL, C.cream] : [C.red, C.yel, C.cream], shape: 'star', speed: [120, 360], life: 1 });
    banner(ch === 'd' ? 'Mais dourada!' : 'Mais rápida!', ch === 'd' ? '+10% em todos os bolsões dourados' : m.tool.name + ': bônus +50%', ch === 'd' ? K.gold : K.red);
    return true;
  }
  function boardFx(b, s) { const r = b === 'gemea' ? GEO.plan : b === 'fab' ? GEO.fab : GEO.cork; V.boardFx = { b, t: 0 }; ps.burst(r.x + r.w / 2, r.y + r.h / 2, 22, { c: [C.gold, C.goldL, C.cream], shape: 'star', speed: [80, 260], life: 0.9 }); V.stamp = { t: 0, txt: s, x: r.x + r.w / 2, y: r.y + r.h / 2 + 8 }; sfx('ofi-peca'); sfx('ofi-carimbo', { delay: 0.08 }); }
  function buyGiant() {
    const I = G.Ind, r = I.run(), gp = Math.min(4, r.giant | 0), part = DATA.GIANT[gp]; if (!part) return;
    const c = I.cost.giant(); if (money() < c) { toast('Faltam ¥' + U.fmt(c - money())); sfx('error'); return; }
    if (!I.buy.giant(true)) return;
    boardFx('gemea', 'PEÇA ' + (gp + 1) + '/4');
    if (gp + 1 >= 4) { banner('BAGGER GÊMEA!', 'duas rodas, 50% maior que a 293', K.gold); sfx('ofi-marco'); sfx('fanfare', { vol: 0.6 }); V.flash = 1; }
  }
  function buyFab() { const I = G.Ind, c = I.cost.fab(); if (money() < c) { toast('Faltam ¥' + U.fmt(c - money())); sfx('error'); return; } if (I.buy.fab(true)) boardFx('fab', '+12%'); }
  function buyShop(id) { const I = G.Ind, c = I.cost.shop(id); if (money() < c) { toast('Faltam ¥' + U.fmt(c - money())); sfx('error'); return; } if (I.buy.shop(id, true)) boardFx('lojas', '+4%'); }

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
  function drawTopBar(t) {
    button(8, 6, 116, 38, '← Montanha', close, { fill: '#F6B6B0', size: 17 });
    pill(132, 6, 150, 38);
    const bump = Math.sin(Math.min(1, yenBump) * Math.PI) * 0.12;
    blit(SPR.coin, 152, 36 - bump * 20, 2 + bump * 2);
    txt(U.fmt(Math.floor(money())), 170, 26, T(18, INK, 'left'));
    // a máquina que você está usando na montanha e o que ela ganha da Oficina
    const cur = G.Inf && G.Inf.playing ? G.Inf.playing() : null, ct = cur && toolOf(cur.id) ? toolOf(cur.id) : toolOf(V.tool);
    pill(290, 6, 662, 38);
    txt('Usando', 302, 26, T(17, '#8A6A4A', 'left'));
    if (ct) {
      const inf = G.Inf.info(ct);
      iconAt(ct.id, 388, 25, 2);
      fit(ct.name, 410, 26, 214, 18, INK, 'left');
      nvBadge(630, 12, inf.L, inf.miles);
      txt('renda ×' + fx2(G.Inf.mult(ct.id)), 708, 26, T(17, C.grassD, 'left'));
      txt('força ×' + fx1(G.Inf.powK(ct.id)), 940, 26, T(17, C.oraD, 'right'));
      hit(290, 6, 662, 38, () => { if (!V.mile) select(ct.id); }, null);
    }
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
      if (cur && cur.id === tl.id) { g.fillStyle = INK; g.beginPath(); g.moveTo(x + BAR.w - 18, y + dy - 1); g.lineTo(x + BAR.w + 1, y + dy - 1); g.lineTo(x + BAR.w + 1, y + 18 + dy); g.closePath(); g.fill(); g.fillStyle = C.red; g.beginPath(); g.moveTo(x + BAR.w - 13, y + dy + 1); g.lineTo(x + BAR.w - 1, y + dy + 1); g.lineTo(x + BAR.w - 1, y + 13 + dy); g.closePath(); g.fill(); }
      hit(x - 2, BAR.y - 6, BAR.w + 4, BAR.h + 10, () => { if (!V.mile) select(tl.id); }, { x, y: BAR.y });
      if (V.hover === i || (on && V.enter < 1)) {
        const label = tl.name, tw = Math.max(80, label.length * 9.8 + 24), lx = U.clamp(x + BAR.w / 2 - tw / 2, 6, W - tw - 6);
        g.fillStyle = INK; D.rrect(g, lx, y - 34, tw, 26, 8); g.fill(); g.beginPath(); g.moveTo(x + BAR.w / 2 - 6, y - 9); g.lineTo(x + BAR.w / 2, y - 3); g.lineTo(x + BAR.w / 2 + 6, y - 9); g.fill();
        txt(label, lx + tw / 2, y - 20.5, T(17, C.cream));
      }
    });
    button(890, 476, 62, 58, '?', () => { V.help = !V.help; sfx('click'); }, { size: 26, on: V.help });
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
  function drawToolCard(t) {
    const tl = toolOf(V.tool); if (!tl) return;
    const c = GEO.card, x = c.x + 12, w = c.w - 24, inf = G.Inf.info(tl), cur = G.Inf.playing ? G.Inf.playing() : null, using = cur && cur.id === tl.id;
    let y = c.y;
    card(c.x, c.y, c.w, c.h, 0, c.y + 150, 'l');
    fit(tl.name, x, y + 22, w, 19, INK, 'left');
    nvBadge(x, y + 38, inf.L, inf.miles);
    txt(using ? 'usando agora' : 'na garagem', c.x + c.w - 12, y + 51.5, T(17, using ? C.grassD : '#8A6A4A', 'right'));
    // régua dos marcos: 10, 25 e 50 viram estrela
    const rx = x + 4, rw = w - 14, ry = y + 82, MIL = G.Inf.MILES;
    meter(rx, ry, rw, 9, Math.min(1, inf.L / 50), C.gold);
    MIL.forEach((m, i) => {
      const mx = rx + rw * m / 50, got = inf.L >= m, nxt = inf.nextMile === m;
      blit(got ? SPR.star : SPR.starOff, mx - 2, ry + 15 + (nxt ? Math.sin(t * 4) * 1.5 : 0), 2);
      txt(String(m), mx - 2, ry + 28, T(17, got ? C.goldD : nxt ? INK : '#9a8a76'));
    });
    y += 122;
    const row = (lab, a, b, col, yy) => { txt(lab, x, yy, T(17, '#6B4A2E', 'left')); txt('×' + a + '  ▸  ×' + b, c.x + c.w - 12, yy, T(17, col, 'right')); };
    row('renda', fx2(inf.mult), fx2(inf.multNext), C.grassD, y + 6);
    row('força', fx1(inf.pow), fx1(inf.powNext), C.oraD, y + 28);
    const can = money() >= inf.cost, soon = inf.nextMile && inf.L + 1 === inf.nextMile;
    button(x, y + 44, w, 54, soon ? 'Melhorar ★' : 'Melhorar', () => { if (upgrade()) V.hold = { t: 0.38, n: 0 }; }, { fill: soon ? '#FFE9A8' : '#DDF0C2', off: !can, size: 20, sub: '¥' + U.fmt(inf.cost), subCol: can ? C.grassD : C.redD, hold: true });
  }
  function drawGemeaCard(t) {
    const I = G.Ind, r = I.run(), gp = Math.min(4, r.giant | 0), part = DATA.GIANT[gp], p = GEO.plan;
    const w = 316, h = part ? 232 : 236, x = U.clamp(p.x + p.w / 2 - w / 2, 8, W - w - 8), y = p.y + p.h + 18;
    card(x, y, w, h, p.x + p.w / 2, 0, 'u');
    txt('Bagger Gêmea', x + 14, y + 22, T(19, INK, 'left'));
    txt(gp + '/4 peças', x + w - 14, y + 22, T(17, gp >= 4 ? C.goldD : '#8A6A4A', 'right'));
    for (let i = 0; i < 4; i++) {
      const tx = x + 14 + i * 73, on = i < gp, nx = i === gp;
      g.fillStyle = INK; D.rrect(g, tx - 2, y + 38, 70, 46, 9); g.fill();
      g.fillStyle = on ? '#34558C' : nx ? '#FFE9A8' : '#E0D4BA'; D.rrect(g, tx, y + 40, 66, 42, 7); g.fill();
      txt(String(i + 1), tx + 16, y + 62, T(22, on ? C.cream : nx ? INK : '#9a8a76'));
      if (on) blit(SPR.star, tx + 46, y + 73, 2); else if (!nx) blit(SPR.lock, tx + 46, y + 72, 2, { alpha: 0.7 });
      else blit(SPR.up, tx + 46, y + 72 + Math.sin(t * 5) * 2, 2);
    }
    if (part) {
      const c = I.cost.giant(), can = money() >= c, m0 = gp ? DATA.GIANT[gp - 1].mult : 1;
      fit('Peça ' + (gp + 1) + ': ' + part.n, x + 14, y + 106, w - 28, 18, INK, 'left');
      fit(part.d, x + 14, y + 128, w - 28, 17, '#6B4A2E', 'left');
      txt('renda', x + 14, y + 152, T(17, '#6B4A2E', 'left')); txt('×' + String(m0).replace('.', ',') + '  ▸  ×' + String(part.mult).replace('.', ','), x + w - 14, y + 152, T(17, C.grassD, 'right'));
      button(x + 14, y + 168, w - 28, 52, 'Comprar a peça', buyGiant, { fill: '#DDF0C2', off: !can, size: 19, sub: '¥' + U.fmt(c), subCol: can ? C.grassD : C.redD });
    } else {
      txt('completa! cavando do outro lado', x + w / 2, y + 106, T(17, C.grassD));
      txt('renda ×' + String(DATA.GIANT[3].mult).replace('.', ',') + ' · escolha a pintura:', x + w / 2, y + 130, T(17, '#6B4A2E'));
      const cur = r.paint || 'kawaii', cols = { kawaii: '#F4B8C5', dino: '#9BC47A', normal: '#EDB93A' }, names = { kawaii: 'Kawaii', dino: 'Dino', normal: 'Fábrica' };
      I.PAINTS.forEach(([id], i) => {
        const bx = x + 14 + i * 98;
        button(bx, y + 150, 92, 70, names[id], () => { I.buy.paint(id, true); sfx('pop'); boardFx('gemea', names[id].toUpperCase()); }, { on: cur === id, size: 17, dx: 0, sub: ' ', });
        g.fillStyle = INK; D.rrect(g, bx + 24, y + 186, 44, 24, 7); g.fill(); g.fillStyle = cols[id]; D.rrect(g, bx + 26, y + 188, 40, 20, 5); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(bx + 29, y + 190, 34, 3);
      });
    }
  }
  function drawFabCard(t) {
    const I = G.Ind, r = I.run(), L = r.fab | 0, p = GEO.fab, w = 300, h = 204, x = U.clamp(p.x + p.w / 2 - w / 2, 8, W - w - 8), y = p.y + p.h + 30;
    const c = I.cost.fab(), can = money() >= c;
    card(x, y, w, h, p.x + p.w / 2, 0, 'u');
    txt('Fábrica do pátio', x + 14, y + 22, T(19, INK, 'left')); nvBadge(x + w - 80, y + 9, L, 0);
    txt('o galpão no pé da montanha', x + 14, y + 50, T(17, '#6B4A2E', 'left'));
    txt('renda', x + 14, y + 78, T(17, '#6B4A2E', 'left')); txt(pct(0.12 * L) + '  ▸  ' + pct(0.12 * (L + 1)), x + w - 14, y + 78, T(17, C.grassD, 'right'));
    txt('chega', x + 14, y + 102, T(17, '#6B4A2E', 'left')); fit(I.nextFab(L), x + w - 14, y + 102, w - 90, 17, C.oraD, 'right');
    button(x + 14, y + 122, w - 28, 54, 'Ampliar', buyFab, { fill: '#DDF0C2', off: !can, size: 19, sub: '¥' + U.fmt(c), subCol: can ? C.grassD : C.redD });
  }
  // lojas: funciona com qualquer número delas (as fichas de conteudo/ podem somar lojas novas, ex.: Barraca de Ramen)
  const shopName = sh => { const n = sh.n || sh.id; return n.indexOf(' de ') > 0 ? n.split(' de ').pop() : n; };
  function shopDesc(sh) {
    const d = String(sh.d || '').replace(/^cliente:\s*/, '').replace(/\s*\(.*\)\s*$/, ''), words = d.split(' ');
    if (d.length <= 16) return [d, ''];
    let best = 1, bl = 1e9;                                   // quebra em duas linhas o mais iguais possível
    for (let k = 1; k < words.length; k++) { const a = words.slice(0, k).join(' ').length, b = words.slice(k).join(' ').length, m = Math.max(a, b); if (m < bl) { bl = m; best = k; } }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  function drawShopCard(t) {
    const I = G.Ind, r = I.run(), p = GEO.cork, list = DATA.SHOPS, n = list.length, two = n > 6, per = two ? Math.ceil(n / 2) : n;
    const rh = Math.max(36, Math.min(44, Math.floor(252 / per))), w = 336, h = 62 + per * rh + 118, x = p.x - w - 18, y = Math.max(52, 462 - h);
    card(x, y, w, h, 0, U.clamp(p.y + p.h / 2, y + 20, y + h - 20), 'r');
    txt('Cidade que compra', x + 14, y + 22, T(19, INK, 'left'));
    txt('cada nível de loja: +4% de renda', x + 14, y + 46, T(17, '#6B4A2E', 'left'));
    list.forEach((sh, i) => {
      const col = two ? Math.floor(i / per) : 0, cw = two ? (w - 24) / 2 : w - 20, rx = x + 10 + col * (cw + 4), ry = y + 62 + (two ? i % per : i) * rh, on = V.shop === sh.id, L = r.shops[sh.id] | 0, cl = r.client === sh.id;
      g.fillStyle = INK; D.rrect(g, rx, ry - 2, cw, rh - 2, 9); g.fill();
      g.fillStyle = on ? C.goldL : '#F3E7CC'; D.rrect(g, rx + 2, ry, cw - 4, rh - 6, 7); g.fill();
      blit(A.flyerOf(sh.id), rx + 22, ry + rh / 2 + 13, 2, { alpha: L ? 1 : 0.6 });
      fit(shopName(sh), rx + 44, ry + rh / 2 - 2.5, two ? cw - 96 : 150, 17, INK, 'left');
      if (cl) { blit(SPR.star, rx + cw - 78, ry + rh / 2 + 8, 2); if (!two) txt('cliente', rx + cw - 92, ry + rh / 2 - 2.5, T(17, C.goldD, 'right')); }
      txt('Nv ' + L, rx + cw - 12, ry + rh / 2 - 2.5, T(17, L ? INK : '#9a8a76', 'right'));
      hit(rx, ry - 2, cw, rh, () => { V.shop = sh.id; sfx('click', { pitch: 1.2 }); }, null);
    });
    const sh = list.find(q => q.id === V.shop) || list[0], L = r.shops[sh.id] | 0, c = I.cost.shop(sh.id), can = money() >= c, cl = r.client === sh.id, by = y + 62 + per * rh + 4, ds = shopDesc(sh);
    txt('se for a cliente:', x + 14, by + 12, T(17, '#8A6A4A', 'left'));
    fit(ds[0], x + w - 14, by + 12, 170, 17, C.oraD, 'right'); fit(ds[1], x + w - 14, by + 34, 300, 17, C.oraD, 'right');
    button(x + 14, by + 50, 176, 54, L ? 'Subir nível' : 'Abrir loja', () => buyShop(sh.id), { fill: '#DDF0C2', off: !can, size: 18, sub: '¥' + U.fmt(c), subCol: can ? C.grassD : C.redD });
    button(x + 200, by + 50, w - 214, 54, cl ? 'Cliente ★' : 'Cliente', () => { if (!L) { toast('Abra a loja primeiro'); sfx('error'); return; } if (I.buy.client(sh.id)) { sfx('chirin'); boardFx('lojas', 'CLIENTE'); } }, { on: cl, off: !L, size: 18 });
  }

  /* ---- escolha do marco: dois cartões ilustrados ---- */
  function drawMile(t, dt) {
    const m = V.mile; m.t += dt;
    const k = U.clamp((m.t - 0.9) / 0.35, 0, 1); if (k <= 0) return;
    g.fillStyle = 'rgba(30,18,10,' + (0.6 * k).toFixed(2) + ')'; g.fillRect(0, 0, W, H);
    hit(0, 0, W, H, () => {}, null);
    const e = U.ease.out(k), cw = 268, ch = 286, gap = 28, x0 = W / 2 - cw - gap / 2, y0 = 150 + (1 - e) * 40;
    g.globalAlpha = k;
    pill(W / 2 - 300, 64 - (1 - e) * 20, 600, 66, '#FFF6DE', 14);
    fit('Marco! ' + m.tool.name + ' nível ' + m.L, W / 2, 86 - (1 - e) * 20, 570, 21, INK);
    txt('o bônus desta máquina DOBROU · agora escolha um caminho', W / 2, 112 - (1 - e) * 20, T(17, C.oraD));
    const opts = [['r', 'Mais rápida', ['bônus desta', 'máquina +50%'], K.red, '#FBD9D2'], ['d', 'Mais dourada', ['+10% em todos os', 'bolsões dourados'], K.goldD, '#FFF0B8']];
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
      txt(name, x + cw / 2, y + 186, T(22, col));
      txt(sub[0], x + cw / 2, y + 214, T(17, '#6B4A2E')); txt(sub[1], x + cw / 2, y + 236, T(17, '#6B4A2E'));
      g.fillStyle = INK; D.rrect(g, x + 60, y + 250, cw - 120, 28, 10); g.fill(); g.fillStyle = id === 'r' ? '#F6B6B0' : C.goldL; D.rrect(g, x + 62, y + 252, cw - 124, 24, 8); g.fill();
      txt('escolher', x + cw / 2, y + 264.5, T(17, INK));
      hit(x, y0, cw, ch, () => pick(id), { x, y: y0 });
    });
    g.globalAlpha = 1;
  }
  function drawHelp() {
    g.fillStyle = 'rgba(30,18,10,.55)'; g.fillRect(0, 0, W, H);
    const w = 780, h = 330, x = (W - w) / 2, y = 96;
    pill(x, y, w, h, '#FFF6DE', 14);
    E.drawShibaHead(g, x + 52, y + 50, performance.now() / 1000, { scale: 1.1, expr: 'happy' });
    txt('Oficina do Kome', x + 100, y + 34, T(22, INK, 'left'));
    txt('cada máquina sua mora aqui e pode ficar mais forte', x + 100, y + 62, T(17, '#6B4A2E', 'left'));
    const tips = ['Toque numa máquina (ou na régua de baixo): ela sobe na plataforma', 'Melhorar: +5% de renda e mais força. Segure pra repetir', 'Nível 10, 25 e 50: o bônus DOBRA e você escolhe um caminho', 'O nível vale pra máquina que você está USANDO na montanha', 'Prancheta azul: Bagger Gêmea · Quadro: fábrica do pátio', 'Cortiça: as lojas da cidade e a cliente preferida'];
    tips.forEach((s, i) => { g.fillStyle = C.gold; g.beginPath(); g.arc(x + 34, y + 104 + i * 34, 5, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); txt(s, x + 50, y + 105 + i * 34, T(18, INK, 'left')); });
    hit(0, 0, W, H, () => { V.help = false; sfx('click'); });
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
    for (let i = zones.length - 1; i >= 0; i--) { const z = zones[i]; if (inR(x, y, z)) { z.fn(); return; } }
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
    if (e.key === 'Escape') { if (V.help) V.help = false; else if (V.mile) { /* tem que escolher */ } else if (V.board) V.board = null; else close(); return; }
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
    const can = { gemea: false, fab: false, lojas: false };
    { const opt = []; if ((r.giant | 0) < 4) opt.push(['gemea', I.cost.giant()]); opt.push(['fab', I.cost.fab()]); opt.push(['lojas', Math.min.apply(null, DATA.SHOPS.map(q => I.cost.shop(q.id)))]);
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
        A.medals(g, bx + 30 + (inf.miles + Math.min(3, inf.spec.length)) * 5.5, b.y + 16, inf.miles, inf.spec, t);
      } });
    }
    // mecânico cochilando embaixo do trator e outro mexendo na bancada
    if (own.trator && onLift !== 'trator') items.push({ y: 307, fn: () => A.mech(g, 96, 312, (t % 14) < 10 ? 'lie' : 'scratch', t, { pal: 'cha', face: -1 }) });
    items.push({ y: 229, fn: () => A.mech(g, 792, 230, ['sit', 'think', 'sniff', 'sit'][Math.floor(t / 4.5) % 4], t + 2, { pal: 'aka', face: 1, tool: Math.floor(t / 4.5) % 4 === 0 ? 'spanner' : null, rot: -0.6 + Math.sin(t * 5) * 0.4 }) });
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
    drawTopBar(t);
    drawBottomBar(t);
    if (V.board === 'gemea') drawGemeaCard(t); else if (V.board === 'fab') drawFabCard(t); else if (V.board === 'lojas') drawShopCard(t); else if (V.tool) drawToolCard(t);
    if (V.stamp && V.stamp.big) A.stamp(g, V.stamp.x, V.stamp.y, V.stamp.t, V.stamp.txt, K.red, 44);
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
    V.tool = null; V.live = null; V.board = null; V.mile = null; V.help = false; V.hold = null; V.stamp = null; V.banner = null; V.toast = null; V.burst = 0;
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
    if (V.mile) { V.mile.t = 2; pick('r'); }                 // nunca sai sem gravar a escolha do marco
    root.classList.remove('k-ofi-open'); V.hold = null; V.help = false; V.board = null; ps.clear(); fl.clear();
    if (G.Inf && G.Inf.recompute) G.Inf.recompute();
  }

  G.Ofi = {
    open, close, isOpen,
    // testes e prints
    select: id => select(id, true), board: b => { V.board = b || null; if (b === 'lojas' && !V.shop) V.shop = DATA.SHOPS[0].id; }, upgrade, pick: ch => { if (V.mile) V.mile.t = Math.max(V.mile.t, 2); return pick(ch); },
    help: on => { V.help = !!on; }, shop: id => { V.shop = id; },
    step(sec) { let left = sec, n = 0; const t0 = performance.now(); while (left > 1e-6) { const d = Math.min(1 / 30, left); tick(d); render(d); left -= d; n++; } return +((performance.now() - t0) / n).toFixed(2); },   // avança sem esperar o relógio (prints); devolve ms por quadro
    get state() { return { open: isOpen(), tool: V.tool, board: V.board, mile: !!V.mile, lv: V.tool ? lvOf(V.tool) : 0, burst: V.burst }; },
  };
})();
