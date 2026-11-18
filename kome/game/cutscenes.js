/* Kome no Japão — cutscenes.js
   Arte das cutscenes (abertura, chegada da Bagger, final estilo Dave the Diver): painéis desenhados em código.
   Cada cena em SHOTS = { id: [ { dur, cap (legenda), draw(g, k 0..1, t) }, ... ] }.
   O controle (tocar pra passar, Esc pula, pausa o jogo) fica em game.js (csPlay, csNext, drawCutscene).
   Pra criar/editar uma cena: mexa só aqui. G.makeShots(W, H, S) é chamado uma vez no game.js. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, PAL = E.PAL, Draw = E.Draw, D = G.Data;
  G.makeShots = function (W, H, S) {
    const CS_LINE = PAL.line;
    let csBag = null;
    const HELP_PAL = ['goma', 'kuro', 'shiro', 'cha', 'aka', 'yuki', 'sakura', 'matcha', 'sumi', 'kin'];
  function csGround(g, y, col) { g.fillStyle = col; g.fillRect(0, y, W, H - y); g.fillStyle = CS_LINE; g.fillRect(0, y, W, 2); }
  function csSky(g, a, b) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  function csStars(g, t, n) { g.fillStyle = '#FFF6D8'; for (let i = 0; i < n; i++) { g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.7 + i)); g.fillRect((i * 97.3) % W, (i * 53.7) % (H * 0.5), 2, 2); } g.globalAlpha = 1; }
  function csMount(g, cx, base, w, h, k, col, cap) {
    // montanha de arroz (k: quanto sobrou, 1 = inteira)
    if (k <= 0.01) return; const hh = h * k, ww = w * (0.55 + 0.45 * k);
    g.beginPath(); g.moveTo(cx - ww, base); g.quadraticCurveTo(cx - ww * 0.35, base - hh * 1.02, cx, base - hh); g.quadraticCurveTo(cx + ww * 0.35, base - hh * 1.02, cx + ww, base); g.closePath();
    g.fillStyle = col || PAL.rice; g.fill(); g.lineWidth = 2.5; g.strokeStyle = CS_LINE; g.stroke();
    g.save(); g.clip();
    if (cap) { g.fillStyle = cap; g.beginPath(); g.moveTo(cx - ww, base - hh * 0.62); for (let i = 0; i <= 12; i++) g.lineTo(cx - ww + i * ww / 6, base - hh * (0.62 + (i % 2 ? -0.05 : 0.04))); g.lineTo(cx + ww, base - hh * 1.1); g.lineTo(cx - ww, base - hh * 1.1); g.closePath(); g.fill(); }
    const fr = x => x - Math.floor(x);
    for (let i = 0; i < 900; i++) { const u = fr(Math.sin(i * 12.9898) * 43758.5), v = fr(Math.sin(i * 78.233) * 12345.6); g.fillStyle = i % 3 ? '#D8CCB4' : '#FFFFFF'; g.beginPath(); g.ellipse(cx - ww + u * ww * 2, base - v * hh, 3.2, 1.5, i, 0, 6.3); g.fill(); }
    g.restore();
  }
  function csCity(g, base, t) {
    for (let i = 0; i < 14; i++) {
      const bw = 50 + (i * 37) % 60, bh = 90 + (i * 71) % 170, x = i * (W / 13) - 30;
      Draw.box(g, x, base - bh, bw, bh, i % 2 ? '#3A4470' : '#2F385E', { r: 2 });
      g.fillStyle = '#FFE39A'; for (let r = 0; r < bh / 22 - 1; r++) for (let c = 0; c < bw / 16 - 1; c++) if (((i * 7 + r * 3 + c * 5) % 4) === 0) g.fillRect(x + 8 + c * 16, base - bh + 10 + r * 22, 7, 9);
    }
  }
  function csBagger(g, x, y, s, t) {
    const Tb = G.Tools.bagger; if (!Tb) return;
    try {
      if (!csBag) csBag = Tb.create({ pilot: S.look.pal || 'kome', scale: 1 });
      Tb.update(csBag, 1 / 60, { x: csBag.x + 200, y: csBag.y - 200, digging: true, face: 1, vx: 0, floor: () => csBag.y });
      g.save(); g.translate(x - csBag.x * s, y - csBag.y * s); g.scale(s, s); Tb.draw(g, csBag); g.restore();
    } catch (e) { /* */ }
  }
  function csCoins(g, cx, base, n, t) {
    for (let i = 0; i < n; i++) { const u = (i * 0.618) % 1, row = Math.floor(Math.sqrt(i)); const x = cx + (u - 0.5) * (220 - row * 18), y = base - row * 9 - 6; Draw.circle(g, x, y, 9, i % 3 ? PAL.gold : PAL.goldL, { ol: 1.5 }); }
  }

  /* ---- fim de jogo: A VOLTA AO JAPÃO, chegada em cada ilha, fim de ilha (medalha) e o Grande Final do Kome-Oh ---- */
  const ISL = () => (G.Islands ? G.Islands.island() : D.ISLANDS[0]);
  const SC = () => G.Scenery;
  // fundo de verdade da ilha atual (céu, longe, morros, cidade) numa câmera falsa; o chão na altura `gy`
  function csIsland(g, gy, t, tod, camX) {
    const sav = S.tod; S.tod = tod === undefined ? 0.36 : tod;
    const fc = { x: camX === undefined ? 2000 : camX, y: -(gy - H / 2), z: 1, mx: 1 };
    try { if (G.World && G.World.drawBack) G.World.drawBack(g, fc, t, S); else csSky(g, '#9FCBEA', '#E8F1F4'); } catch (e) { csSky(g, '#9FCBEA', '#E8F1F4'); }
    const sc = SC() && SC().profile(), gc = (sc && sc.ground) || { grass: PAL.grass, grassD: PAL.grassD, grassL: PAL.grassL, soil: '#C7A26A' };
    g.fillStyle = gc.soil; g.fillRect(0, gy, W, H - gy); g.fillStyle = gc.grass; g.fillRect(0, gy, W, 22); g.fillStyle = gc.grassL; g.fillRect(0, gy, W, 3); g.fillStyle = CS_LINE; g.fillRect(0, gy, W, 2);
    S.tod = sav;
    return { sc, fc };
  }
  function csAir(g, t, fc) { if (SC() && fc) { try { SC().air(g, W, H, fc, t, S); } catch (e) { /* */ } } }
  function csMedal(g, x, y, r, md, t) {
    const col = ['#B9A88A', '#C98A4A', '#C9D2DC', '#F3C94A'][md] || '#B9A88A';
    g.save(); g.translate(x, y); g.rotate(Math.sin(t * 2) * 0.06);
    Draw.poly(g, [[-r * 0.5, -r * 2.2], [-r * 0.1, -r * 0.8], [r * 0.1, -r * 0.8], [r * 0.5, -r * 2.2]], PAL.red, { ol: 2 });
    Draw.circle(g, 0, 0, r, col, { ol: 3 }); Draw.circle(g, 0, 0, r * 0.72, U.mixCss(col, '#FFFFFF', 0.25), { ol: 1.5 });
    Draw.text(g, '米', 0, 2, { size: r * 0.8, col: CS_LINE, sw: 0.01 });
    for (let i = 0; i < 6; i++) { const a = t * 1.5 + i * 1.05, q = (t * 2 + i * 0.3) % 1; g.globalAlpha = 1 - q; Draw.circle(g, Math.cos(a) * r * (1.2 + q * 0.6), Math.sin(a) * r * (1.2 + q * 0.6), 3, '#FFF3B0', { ol: 0 }); }
    g.globalAlpha = 1; g.restore();
  }
  function csSparkles(g, cx, cy, s, t) {   // brilho nos olhos
    for (let i = 0; i < 2; i++) { const x = cx + (i ? 1 : -1) * 10 * s, y = cy, r = (4 + 2 * Math.sin(t * 9 + i)) * s; g.fillStyle = '#FFFFFF'; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.35 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
  }
  function csRays(g, cx, cy, t, c1, c2) { for (let i = 0; i < 16; i++) { const a0 = i * Math.PI / 8 + t * 0.15, a1 = a0 + Math.PI / 16; g.fillStyle = i % 2 ? c1 : c2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * W, cy + Math.sin(a0) * W); g.lineTo(cx + Math.cos(a1) * W, cy + Math.sin(a1) * W); g.closePath(); g.fill(); } }
  function csBoat(g, x, y, s, t, pose) {
    g.save(); g.translate(x, y); g.rotate(Math.sin(t * 2.2) * 0.05); g.scale(s, s); g.strokeStyle = CS_LINE; g.lineWidth = 2;
    g.fillStyle = '#9A6A44'; g.beginPath(); g.moveTo(-110, -10); g.lineTo(110, -10); g.lineTo(80, 34); g.lineTo(-80, 34); g.closePath(); g.fill(); g.stroke();
    Draw.box(g, -4, -150, 8, 142, '#7A5034', { r: 2 });
    g.fillStyle = '#FFF8EC'; g.beginPath(); g.moveTo(6, -146); g.quadraticCurveTo(80 + Math.sin(t * 4) * 6, -90, 6, -30); g.closePath(); g.fill(); g.stroke();
    Draw.circle(g, 32, -90, 16, PAL.red, { ol: 1.5 });
    E.drawShiba(g, -50, -10, pose || 'wag', t, { scale: 3, pal: S.look.pal });
    g.restore();
  }
  function csSea(g, y0, t) { for (let b = 0; b < 4; b++) { const y = y0 + b * 26; g.fillStyle = ['#4FA3D9', '#3E8FC6', '#3580B4', '#2C6FA0'][b]; g.beginPath(); g.moveTo(0, H); g.lineTo(0, y); for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + t * (2 + b) + b) * (3 + b)); g.lineTo(W, H); g.closePath(); g.fill(); } }
  // montanha da cutscene com a cara da ilha (curry, mochi rosa, neve no topo, areia)
  const MCOL = { hokkaido: ['#F6F1E4', '#FFFFFF'], kyushu: ['#F3C566', '#7A6A64'], okinawa: ['#F2E6C4', null], mochijima: ['#FBE3EA', '#FFFFFF'] };
  function csMountIsl(g, cx, base, w, h, k) { const c = MCOL[ISL().id] || [null, null]; csMount(g, cx, base, w, h, k, c[0], c[1]); }
  const feelPose = sc => (!sc ? 'cheer' : sc.feel === 'cold' ? 'shake' : sc.feel === 'hot' ? 'pant' : sc.feel === 'beach' ? 'dance' : sc.feel === 'float' ? 'jump' : 'cheer');
  const mapBox = () => { const mh = H * 0.74, mw = Math.min(W * 0.86, mh * 1.45); return [W / 2 - mw / 2, H * 0.11, mw, mh]; };
  const KOH = {};
  // Kome-Oh na cutscene: a simulação anda no tempo da cena (lt), em passos fixos, então a combinação dura o mesmo em qualquer PC
  function csKomeOh(g, x, y, s, t, mode, lt) {
    const T = G.Tools.komeoh; if (!T) { E.drawShiba(g, x, y, 'cheer', t, { scale: 4, pal: S.look.pal }); return; }
    try {
      let k = KOH[mode];
      if (!k || lt < k.simT - 0.1) { k = KOH[mode] = { m: T.create({ mode, x: 0, pilot: S.look.pal || 'kome' }), simT: mode === 'combine' ? 0 : -1.5 }; }
      const koh = k.m, INP = { x: 0, y: 0, floor: () => 0, face: 1, tx: null, ty: null, digging: false, night: 0.5 };
      for (let n = 0; k.simT < lt && n < 240; n++) { T.update(koh, 1 / 60, INP); k.simT += 1 / 60; }
      g.save(); g.translate(x, y); g.scale(s, s); T.draw(g, koh); g.restore();
    } catch (e) { E.drawShiba(g, x, y, 'cheer', t, { scale: 4, pal: S.look.pal }); }
  }
  const SHOTS = {
    intro: [
      { dur: 4.2, cap: 'Tóquio. O Kome vende onigiri numa barraquinha e sonha com uma casa só dele.', draw(g, k, t) {
        csSky(g, '#141A36', '#3B3F72'); csStars(g, t, 30); csCity(g, H * 0.8, t); csGround(g, H * 0.8, '#4A4E63');
        Draw.box(g, W * 0.38, H * 0.8 - 70, 150, 70, PAL.woodL, { r: 4 }); Draw.box(g, W * 0.38 - 10, H * 0.8 - 92, 170, 24, PAL.red, { r: 4 });
        Draw.text(g, 'おにぎり', W * 0.38 + 75, H * 0.8 - 80, { size: 14, col: PAL.cream, sw: 3 });
        E.drawShiba(g, W * 0.38 + 75, H * 0.8 - 4, k < 0.6 ? 'wag' : 'yawn', t, { scale: 2, pal: S.look.pal });
      } },
      { dur: 4.4, cap: 'Um dia chega uma carta do vovô: "te deixo a minha montanha de arroz".', draw(g, k, t) {
        csSky(g, '#F6E7CF', '#E9D2AE');
        const ew = Math.min(W * 0.5, 420), eh = ew * 0.6, ex = W / 2 - ew / 2, ey = H * 0.42 - eh / 2 - (1 - Math.min(1, k * 3)) * 60;
        Draw.box(g, ex, ey, ew, eh, '#FFF8EA', { r: 6 });
        g.strokeStyle = CS_LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(ex, ey); g.lineTo(W / 2, ey + eh * 0.55); g.lineTo(ex + ew, ey); g.stroke();
        Draw.circle(g, W / 2, ey + eh * 0.55, 22, PAL.red, { ol: 2 }); Draw.text(g, '米', W / 2, ey + eh * 0.55 + 1, { size: 20, col: PAL.cream, sw: 0.01 });
        E.drawShiba(g, W * 0.5 + ew * 0.55, H * 0.86, k > 0.5 ? 'surprise' : 'sniff', t, { scale: 2.2, face: -1, pal: S.look.pal });
      } },
      { dur: 4.6, cap: 'Uma montanha. Inteira. E o Kome só tem um par de hashi.', draw(g, k, t) {
        csSky(g, '#9FCBEA', '#E8F1F4'); csMount(g, W * 0.62, H * 0.82, W * 0.5, H * 0.66 * (0.9 + 0.1 * k), 1); csGround(g, H * 0.82, '#7FA35A');
        E.drawShiba(g, W * 0.2, H * 0.82, 'gasp', t, { scale: 1.2 + 0.5 * (1 - k), pal: S.look.pal });
      } },
      { dur: 3.2, cap: 'Bora cavar!', draw(g, k, t) {
        csSky(g, '#9FCBEA', '#E8F1F4'); csMount(g, W * 0.7, H * 0.82, W * 0.45, H * 0.6, 1); csGround(g, H * 0.82, '#7FA35A');
        E.drawShiba(g, W * 0.32, H * 0.82, 'cheer', t, { scale: 2.6, pal: S.look.pal });
        Draw.text(g, 'Kome no Japão', W / 2, H * 0.2, { size: 40, col: PAL.cream, sw: 6 });
      } },
    ],
    bagger: [
      { dur: 4.2, cap: 'Do outro lado do mundo, um navio cargueiro apita.', draw(g, k, t) {
        csSky(g, '#F2A86B', '#F6D59A'); g.fillStyle = '#3E6C98'; g.fillRect(0, H * 0.7, W, H * 0.3);
        const sx = -320 + k * (W * 0.55), sy = H * 0.7 + Math.sin(t * 2) * 3;
        Draw.poly(g, [[sx, sy - 40], [sx + 420, sy - 40], [sx + 380, sy + 10], [sx + 30, sy + 10]], '#5A5F6B', { ol: 2 });
        for (let i = 0; i < 6; i++) Draw.box(g, sx + 40 + i * 52, sy - 78, 48, 38, [PAL.red, '#E3BC62', '#4E7397'][i % 3], { r: 2 });
        Draw.box(g, sx + 340, sy - 110, 46, 70, PAL.cream, { r: 3 });
      } },
      { dur: 4.4, cap: 'Dentro das caixas: 13 mil toneladas de aço, em peças. O Kome lê o manual a noite inteira.', draw(g, k, t) {
        csSky(g, '#141A36', '#2B3360'); csStars(g, t, 40); csGround(g, H * 0.8, '#3B4A2E');
        for (let i = 0; i < 5; i++) Draw.box(g, W * 0.08 + i * 90, H * 0.8 - 50 - (i % 2) * 30, 80, 50 + (i % 2) * 30, '#C9A46A', { r: 3 });
        Draw.circle(g, W * 0.7, H * 0.72, 40 + Math.sin(t * 9) * 2, 'rgba(255,200,90,.25)', { ol: 0 });
        E.drawShiba(g, W * 0.7, H * 0.8, 'think', t, { scale: 2.2, pal: S.look.pal });
        Draw.box(g, W * 0.7 + 20, H * 0.8 - 44, 34, 24, '#FFF8EA', { r: 2 });
      } },
      { dur: 4.6, cap: 'De manhã, ela está pronta.', draw(g, k, t) {
        csSky(g, '#9FCBEA', '#F6E7CF'); csGround(g, H * 0.86, '#8E6A44');
        csBagger(g, W * (0.62 - 0.08 * k), H * 0.86, Math.min(W / 1900, H / 900) * (0.9 + 0.12 * k), t);
        E.drawShiba(g, W * 0.12, H * 0.86, 'surprise', t, { scale: 1.6, pal: S.look.pal });
      } },
    ],

    // A VOLTA AO JAPÃO: toca depois do final da campanha (uma vez; revê no mapa das ilhas)
    ilhas: [
      { dur: 4.4, cap: 'Dias depois, o corretor shiba aparece no portão com uma carta selada.', draw(g, k, t) {
        csSky(g, '#9FCBEA', '#F6E7CF'); csGround(g, H * 0.8, '#7FA35A');
        if (E.Nature && E.Nature.house) E.Nature.house(g, W * 0.24, H * 0.8, { stage: Math.max(0, D.HOUSE.length - 1), s: 1.3, t });
        E.drawShiba(g, W * 0.42, H * 0.8, k < 0.7 ? 'sit' : 'surprise', t, { scale: 2.2, pal: S.look.pal });
        const cx = W * (1.05 - 0.4 * Math.min(1, k * 1.4)); E.drawShiba(g, cx, H * 0.8, k < 0.7 ? 'walk' : 'wave', t * 2, { scale: 2.2, pal: 'sumi', face: -1 });
        Draw.box(g, cx - 40, H * 0.8 - 52, 30, 20, '#FFF8EA', { r: 2 }); Draw.circle(g, cx - 25, H * 0.8 - 42, 4, PAL.red, { ol: 1 });
        Draw.box(g, cx - 18, H * 0.8 - 88, 30, 8, '#3B3F4A', { r: 2 });   // chapéu de corretor
      } },
      { dur: 4.6, cap: '"O Japão inteiro ouviu falar do Kome. Cinco ilhas querem as suas montanhas de arroz."', draw(g, k, t) {
        csSky(g, '#F6E7CF', '#E9D2AE');
        const pw = Math.min(W * 0.46, 400), ph = pw * 0.7, px = W / 2 - pw / 2, py = H * 0.5 - ph / 2 + (1 - Math.min(1, k * 2.5)) * 40;
        Draw.box(g, px, py, pw, ph, '#FFFDF6', { r: 6 });
        for (let i = 0; i < 4; i++) Draw.box(g, px + 30, py + 34 + i * 26, pw * (0.75 - (i % 2) * 0.2), 6, '#E2D4B8', { r: 3 });
        for (let i = 0; i < 5; i++) { const on = k * 6 > i + 1; Draw.circle(g, px + pw * (0.2 + i * 0.15), py + ph - 40, 12, on ? D.ISLANDS[i].land : '#D8CCB4', { ol: 2 }); Draw.text(g, String(i + 1), px + pw * (0.2 + i * 0.15), py + ph - 39, { size: 12, col: CS_LINE, sw: 0.01 }); }
        Draw.circle(g, px + pw - 30, py + 30, 18, PAL.red, { ol: 2 }); Draw.text(g, '米', px + pw - 30, py + 31, { size: 16, col: PAL.cream, sw: 0.01 });
      } },
      { dur: 7.2, cap: 'Cada ilha muda tudo: o cenário, a montanha, o clima… e até o lado da montanha!', draw(g, k, t) {
        csSky(g, '#7FC6E8', '#4C9ED0');
        const [mx, my, mw, mh] = mapBox(), lit = D.ISLANDS.map((_, i) => U.clamp(k * 6.2 - i * 1.05, 0, 1));
        if (SC()) SC().japan(g, mx, my, mw, mh, { bg: false, t, lit, state: () => 'open', names: true });
        const cur = Math.min(D.ISLANDS.length - 1, Math.floor(k * 6.2 / 1.05)), I = D.ISLANDS[cur];
        if (lit[cur] > 0.3) { g.globalAlpha = Math.min(1, (lit[cur] - 0.3) * 3); Draw.text(g, I.n, mx + mw * 0.42, my + mh * 0.38, { size: Math.min(24, W / 38), col: '#FFF3B0', sw: 6 }); Draw.text(g, I.hook, mx + mw * 0.42, my + mh * 0.38 + 28, { size: Math.min(16, W / 56), col: PAL.cream, sw: 4 }); g.globalAlpha = 1; }
      } },
      { dur: 3.6, cap: 'O Kome nunca tinha saído de Honshu…', draw(g, k, t) {
        csRays(g, W / 2, H * 0.55, t, '#FFE9A8', '#F6C86A');
        const s = 8.5 + k * 1.5; E.drawShiba(g, W / 2 - 10 * s, H * 0.46 + 27 * s, 'surprise', t, { scale: s, pal: S.look.pal, eyes: 'sparkle', mouth: 'open' });
        for (let i = 0; i < 7; i++) { const a = i * 0.9 + t * 0.8, rr = (150 + 30 * Math.sin(t * 3 + i)) * (0.8 + 0.2 * k); csSparkles(g, W / 2 + Math.cos(a) * rr * 1.5, H * 0.42 + Math.sin(a) * rr * 0.8, 1.6 + (i % 3) * 0.5, t + i); }
      } },
      { dur: 3.8, cap: 'Seu novo objetivo:', draw(g, k, t) {
        csSky(g, '#7EC4EC', '#D8F0FA'); csSea(g, H * 0.66, t);
        csBoat(g, W * (0.2 + 0.1 * k), H * 0.7, 0.9, t, 'cheer');
        const sc = 0.8 + 0.2 * Math.min(1, k * 3);
        g.save(); g.translate(W * 0.6, H * 0.3); g.scale(sc, sc);
        Draw.text(g, 'A VOLTA', 0, -34, { size: 54, col: PAL.cream, sw: 9, shadow: 4 });
        Draw.text(g, 'AO JAPÃO', 0, 26, { size: 62, col: PAL.goldL || '#FFE08A', sw: 9, shadow: 4 });
        Draw.text(g, '5 ilhas · 5 montanhas · 1 shiba', 0, 72, { size: 18, col: PAL.cream, sw: 5 });
        g.restore();
      } },
      { dur: 7, cap: 'A cada viagem você ganha Sementes Douradas: elas nunca zeram e deixam tudo mais rápido.', draw(g, k, t) {
        csSky(g, '#F6E7CF', '#E9D2AE');
        const cw = Math.min(W * 0.36, 320), y0 = H * 0.18;
        const col = (x, title, tone, items, fill) => {
          Draw.box(g, x, y0, cw, H * 0.5, '#FFFDF6', { r: 10 }); Draw.box(g, x, y0, cw, 44, tone, { r: 10 });
          Draw.text(g, title, x + cw / 2, y0 + 22, { size: 20, col: PAL.cream, sw: 4 });
          items.forEach((it, i) => { const on = k * 9 > i + (fill ? 0 : 4.5); g.globalAlpha = on ? 1 : 0.15; Draw.text(g, it, x + cw / 2, y0 + 78 + i * 38, { size: 17, col: CS_LINE, sw: 0.01, weight: 800 }); g.globalAlpha = 1; });
        };
        col(W * 0.5 - cw - 16, 'VAI JUNTO', '#4E9A4E', ['Sementes Douradas', 'Roupinhas', 'Quintal da Casa', 'Conquistas e recordes'], true);
        col(W * 0.5 + 16, 'RECOMEÇA', '#D8763A', ['Montanha nova', 'Máquinas e árvore', 'Casa e ienes', '(com cenário novo!)'], false);
        E.drawShiba(g, W / 2, H * 0.86, 'proud', t, { scale: 1.6, pal: S.look.pal });
      } },
    ],
    // chegada numa ilha nova (depois da viagem): o barco, a ilha revelada com o seu cenário, o nome e as regras
    chegada: [
      { dur: 3.6, cap: 'Terra à vista!', draw(g, k, t) {
        const r = csIsland(g, H * 0.6, t, 0.3); csSea(g, H * 0.6, t);
        csBoat(g, W * (0.1 + 0.25 * k), H * 0.66, 0.85, t, 'wag'); csAir(g, t, r.fc);
      } },
      { dur: 4.2, cap: '', draw(g, k, t) {
        const r = csIsland(g, H * 0.78, t, 0.36, 2000 + k * 120), sc = r.sc, I = ISL();
        csMountIsl(g, sc && sc.mirror ? W * 0.18 : W * 0.82, H * 0.78, W * 0.32, H * 0.5, 1);
        E.drawShiba(g, W * 0.48, H * 0.78, feelPose(sc), t, { scale: 2.6, pal: S.look.pal });
        if (sc && sc.feel === 'cold') for (let i = 0; i < 3; i++) { const q = (t * 0.9 + i / 3) % 1; g.globalAlpha = 0.8 * (1 - q); Draw.circle(g, W * 0.48 + 34 + q * 24, H * 0.78 - 52 - q * 10, 5 + q * 8, '#FFFFFF', { ol: 0 }); g.globalAlpha = 1; }
        csAir(g, t, r.fc);
        Draw.text(g, I.hook, W / 2, H * 0.2, { size: Math.min(24, W / 36), col: PAL.cream, sw: 6 });
      } },
      { dur: 4.2, cap: '', draw(g, k, t) {
        const r = csIsland(g, H * 0.86, t, 0.42), I = ISL();
        g.fillStyle = 'rgba(30,20,10,.35)'; g.fillRect(0, 0, W, H);
        const s = 0.85 + 0.15 * Math.min(1, k * 4);
        g.save(); g.translate(W / 2, H * 0.32); g.scale(s, s);
        Draw.text(g, (G.Islands && G.Islands.lap() ? 'VOLTA ' + (G.Islands.lap() + 1) + ' · ' : '') + 'ILHA ' + (D.ISLANDS.indexOf(I) + 1) + ' DE ' + D.ISLANDS.length, 0, -52, { size: 18, col: '#FFF3B0', sw: 4 });
        Draw.text(g, I.n.toUpperCase(), 0, 0, { size: I.n.length > 14 ? 40 : 58, col: PAL.cream, sw: 9, shadow: 4 });
        g.restore();
        (I.mods || []).forEach((m, i) => { g.globalAlpha = U.clamp(k * 5 - i - 0.5, 0, 1); Draw.text(g, '· ' + m, W / 2, H * 0.5 + i * 30, { size: 18, col: PAL.cream, sw: 4 }); g.globalAlpha = 1; });
        csAir(g, t, r.fc);
      } },
      { dur: 3, cap: 'Bora cavar!', draw(g, k, t) {
        const r = csIsland(g, H * 0.82, t, 0.38), sc = r.sc;
        csMountIsl(g, sc && sc.mirror ? W * 0.25 : W * 0.75, H * 0.82, W * 0.4, H * 0.58, 1);
        E.drawShiba(g, sc && sc.mirror ? W * 0.68 : W * 0.32, H * 0.82, 'cheer', t, { scale: 2.6, pal: S.look.pal, face: sc && sc.mirror ? -1 : 1 });
        csAir(g, t, r.fc);
      } },
    ],
    // fim de uma ilha (da 2ª em diante): planície, medalha e a próxima parada no mapa
    ilhafim: [
      { dur: 3.4, cap: '', draw(g, k, t) {
        const r = csIsland(g, H * 0.8, t, 0.7), I = ISL(), sc = r.sc;
        csMountIsl(g, sc && sc.mirror ? W * 0.3 : W * 0.7, H * 0.8, W * 0.3, H * 0.14, 1 - 0.3 * k);
        E.drawShiba(g, W * 0.45, H * 0.8, 'proud', t, { scale: 2.4, pal: S.look.pal });
        Draw.text(g, 'A montanha de ' + I.n + ' virou planície!', W / 2, H * 0.2, { size: Math.min(26, W / 34), col: PAL.cream, sw: 6 });
        csAir(g, t, r.fc);
      } },
      { dur: 3.8, cap: '', draw(g, k, t) {
        const res = S.islandRes || { medal: 1, sec: 0, bonus: 0 };
        csRays(g, W / 2, H * 0.45, t, '#FFE9A8', '#F6C86A');
        csMedal(g, W / 2, H * 0.46, 60 * Math.min(1, 0.4 + k * 2), res.medal, t);
        Draw.text(g, 'Medalha de ' + ['', 'bronze', 'prata', 'ouro'][res.medal] + '!', W / 2, H * 0.72, { size: 34, col: PAL.cream, sw: 7 });
        Draw.text(g, U.fmtTime(res.sec) + (res.newBest ? ' · recorde' : '') + (res.bonus ? ' · +' + res.bonus + ' sementes' : ''), W / 2, H * 0.8, { size: 18, col: PAL.cream, sw: 4 });
      } },
      { dur: 3.4, cap: '', draw(g, k, t) {
        csSky(g, '#7FC6E8', '#4C9ED0');
        const [mx, my, mw, mh] = mapBox(), i0 = G.Islands ? G.Islands.index() : 0, nx = (i0 + 1) % D.ISLANDS.length;
        if (SC()) SC().japan(g, mx, my, mw, mh, { bg: false, t, state: i => (i === i0 ? 'done' : i === nx ? 'here' : i < i0 ? 'done' : 'locked'), sel: nx });
        Draw.text(g, 'Próxima parada:', mx + mw * 0.42, my + mh * 0.36, { size: 18, col: PAL.cream, sw: 4 }); Draw.text(g, D.ISLANDS[nx].n, mx + mw * 0.42, my + mh * 0.36 + 28, { size: 24, col: '#FFF3B0', sw: 6 });
      } },
    ],
    // GRANDE FINAL (Ilha de Mochi terminada na 1ª volta): toda a frota vira o KOME-OH
    finale: [
      { dur: 4.4, cap: 'Cinco ilhas. Cinco montanhas. O Japão inteiro comendo onigiri do Kome.', draw(g, k, t) {
        csSky(g, '#7FC6E8', '#4C9ED0');
        const [mx, my, mw, mh] = mapBox();
        if (SC()) SC().japan(g, mx, my, mw, mh, { bg: false, t, state: () => 'done', lit: D.ISLANDS.map((_, i) => U.clamp(k * 6 - i, 0, 1)) });
      } },
      { dur: 4.2, cap: 'Naquela noite, todas as máquinas do Kome apareceram de uma vez…', draw(g, k, t) {
        csSky(g, '#0E1230', '#2A2756'); csStars(g, t, 50); csGround(g, H * 0.84, '#3B4A2E');
        csBagger(g, W * 0.7, H * 0.84, Math.min(W / 2600, H / 1250), t);
        for (let i = 0; i < 6; i++) E.drawShiba(g, W * (0.08 + i * 0.07), H * 0.84, i % 2 ? 'cheer' : 'wag', t + i, { scale: 1.4, pal: HELP_PAL[i] });
        E.drawShiba(g, W * 0.5, H * 0.84, 'think', t, { scale: 2, pal: S.look.pal });
      } },
      { dur: 8.6, cap: 'KOME-OH… COMBINAR!', draw(g, k, t, lt) {
        csSky(g, '#140E2A', '#3A2A5E'); csStars(g, t, 60); csGround(g, H * 0.9, '#2E3A28');
        csKomeOh(g, W / 2, H * 0.88, Math.min(H * 0.66 / 1040, W / 1500), t, 'combine', lt);
      } },
      { dur: 5, cap: 'A lenda do Japão: renda ×2 pra sempre e o Kome Hinomaru no guarda-roupa!', draw(g, k, t, lt) {
        csSky(g, '#0E1230', '#2A2756'); csStars(g, t, 50);
        for (let i = 0; i < 5; i++) { const T0 = (t * 0.55 + i * 0.37) % 1.6; if (T0 > 1) continue; const fx = W * (0.12 + ((i * 0.23) % 0.8)), fy = H * (0.16 + (i % 3) * 0.07), rr = 20 + T0 * 80; g.globalAlpha = Math.max(0, 1 - T0); for (let a = 0; a < 16; a++) { const an = a * 0.3927; Draw.circle(g, fx + Math.cos(an) * rr, fy + Math.sin(an) * rr + T0 * T0 * 20, 3, ['#FF7A8A', '#FFD25E', '#8FD3FF', '#B7F28C', '#F6A8C0'][i], { ol: 0 }); } g.globalAlpha = 1; }
        csGround(g, H * 0.9, '#2E3A28');
        csKomeOh(g, W / 2, H * 0.88, Math.min(H * 0.62 / 1040, W / 1500), t, 'normal', lt);
        Draw.text(g, 'KOME-OH!', W / 2, H * 0.14, { size: 52, col: PAL.goldL || '#FFE08A', sw: 9, shadow: 4 });
      } },
      { dur: 4.4, cap: 'E a volta continua: Honshu de novo, com montanhas maiores e as sementes no bolso.', draw(g, k, t) {
        csSky(g, '#F29C6B', '#F6D59A'); csSea(g, H * 0.66, t);
        csBoat(g, W * (0.3 + 0.2 * k), H * 0.7, 0.9, t, 'bow');
      } },
    ],
    final: [
      { dur: 4.4, cap: 'A montanha de arroz virou planície.', draw(g, k, t) {
        csSky(g, '#F29C6B', '#F6D59A'); csMount(g, W * 0.6, H * 0.84, W * 0.4, H * 0.2, 1 - (S.heapTotal ? 1 - S.heapArea / S.heapTotal : 0.85) * 0.8 - 0.2 * k); csGround(g, H * 0.84, '#8E6A44');
        csBagger(g, W * 0.5, H * 0.84, Math.min(W / 2300, H / 1100), t);
      } },
      { dur: 4.8, cap: 'O Kome agora tem casa, um onsen no quintal…', draw(g, k, t) {
        csSky(g, '#141A36', '#3B3F72'); csStars(g, t, 40); csGround(g, H * 0.8, '#3B4A2E');
        if (E.Nature && E.Nature.house) E.Nature.house(g, W * 0.3, H * 0.8, { stage: Math.max(0, D.HOUSE.length - 1), s: 1.5, t, lit: true });
        Draw.box(g, W * 0.56, H * 0.8 - 24, 220, 34, '#7FB8D8', { r: 14 });
        E.drawShiba(g, W * 0.56 + 110, H * 0.8 + 2, 'sit', t, { scale: 2.2, pal: S.look.pal });
        g.globalAlpha = 0.85; Draw.box(g, W * 0.56 - 4, H * 0.8 - 10, 228, 30, '#8FC6E0', { r: 12 }); g.globalAlpha = 1;
        for (let i = 0; i < 6; i++) { const a = (t * 0.6 + i / 6) % 1; g.globalAlpha = 0.5 * (1 - a); Draw.circle(g, W * 0.56 + 30 + i * 32, H * 0.8 - 30 - a * 70, 10 + a * 12, '#FFFFFF', { ol: 0 }); } g.globalAlpha = 1;
      } },
      { dur: 4.8, cap: '…e arroz guardado pra 300 anos de onigiri.', draw(g, k, t) {
        csSky(g, '#FFE9A8', '#F6C86A'); csGround(g, H * 0.82, '#C9A46A'); csCoins(g, W / 2, H * 0.82, 70, t);
        E.drawShiba(g, W / 2, H * 0.82 - 70, k < 0.5 ? 'proud' : 'dance', t, { scale: 2.4, pal: S.look.pal });
        for (let i = 0; i < 10; i++) { const y = ((t * 120 + i * 67) % (H * 0.8)); Draw.circle(g, (i * 131) % W, y, 7, PAL.gold, { ol: 1.2 }); }
      } },
      { dur: 6.5, cap: 'E naquela noite, a cidade inteira fez o Natsu Matsuri do Kome!', draw(g, k, t) {
        csSky(g, '#0E1230', '#2A2756'); csStars(g, t, 50);
        // fogos de artifício
        for (let i = 0; i < 5; i++) {
          const T0 = (t * 0.55 + i * 0.37) % 1.6; if (T0 > 1) continue;
          const fx = W * (0.12 + ((i * 0.23) % 0.8)), fy = H * (0.18 + (i % 3) * 0.08), rr = 20 + T0 * 90, cols = ['#FF7A8A', '#FFD25E', '#8FD3FF', '#B7F28C', '#F6A8C0'];
          g.globalAlpha = Math.max(0, 1 - T0); for (let a = 0; a < 16; a++) { const an = a * 0.3927; Draw.circle(g, fx + Math.cos(an) * rr, fy + Math.sin(an) * rr + T0 * T0 * 20, 3.2, cols[i], { ol: 0 }); } g.globalAlpha = 1;
        }
        csGround(g, H * 0.82, '#3B4A2E');
        // barraquinhas
        for (let i = 0; i < 3; i++) { const x = W * (0.1 + i * 0.32); Draw.box(g, x, H * 0.82 - 62, 120, 62, PAL.woodL, { r: 3 }); Draw.box(g, x - 8, H * 0.82 - 80, 136, 22, [PAL.red, '#4E7397', PAL.red][i], { r: 4 }); Draw.text(g, ['たこ焼き', 'かき氷', 'おにぎり'][i], x + 60, H * 0.82 - 69, { size: 12, col: PAL.cream, sw: 0.01 }); }
        // varal de lanternas
        g.strokeStyle = CS_LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(0, H * 0.3); g.quadraticCurveTo(W / 2, H * 0.42, W, H * 0.3); g.stroke();
        for (let i = 1; i < 12; i++) { const u = i / 12, x = u * W, y = H * 0.3 + Math.sin(u * Math.PI) * H * 0.06 + 10; g.globalAlpha = 0.35; Draw.circle(g, x, y, 16, '#FFB060', { ol: 0 }); g.globalAlpha = 1; Draw.box(g, x - 7, y - 9, 14, 18, i % 2 ? PAL.red : '#FFF1D6', { r: 6 }); }
        // yagura com o Kome no taiko
        Draw.box(g, W / 2 - 70, H * 0.82 - 90, 140, 90, '#8A5A3A', { r: 2 }); Draw.box(g, W / 2 - 84, H * 0.82 - 102, 168, 14, PAL.red, { r: 3 });
        Draw.circle(g, W / 2 + 34, H * 0.82 - 122, 18, '#B5683C', { ol: 2 });
        E.drawShiba(g, W / 2 - 14, H * 0.82 - 102, 'cheer', t * 1.5, { scale: 1.7, pal: S.look.pal });
        // shibas dançando o bon odori em roda
        for (let i = 0; i < 8; i++) { const x = W * 0.08 + i * W * 0.12 + Math.sin(t * 2 + i) * 6; if (Math.abs(x - W / 2) < 90) continue; E.drawShiba(g, x, H * 0.82 - 2, i % 2 ? 'dance' : 'wag', t + i * 0.4, { scale: 1.1, pal: HELP_PAL[i % HELP_PAL.length], face: i % 2 ? 1 : -1 }); }
      } },
      { dur: 4, cap: 'Obrigado por jogar!', draw(g, k, t) {
        csSky(g, '#F6E7CF', '#E9D2AE');
        E.drawShiba(g, W / 2, H * 0.72, 'bow', t, { scale: 3, pal: S.look.pal });
        Draw.text(g, 'Kome no Japão', W / 2, H * 0.22, { size: 40, col: PAL.cream, sw: 6 });
        Draw.text(g, 'um jogo do Elias com o Kome', W / 2, H * 0.32, { size: 16, col: PAL.woodD || CS_LINE, sw: 0.01 });
      } },
    ],
  };
    /* O ÚLTIMO GRÃO + KOME EM CASA: o momento do fim que o dono gosta. Entra no final da campanha (depois da planície), no fim de
       cada ilha (antes da medalha) e antes do Grande Final (cena 'ultimo'). Montanha acabada antes da casa também cai aqui (ending). */
    const lastGrain = { dur: 3.4, cap: 'Sobrou um grão. O último.', draw(g, k, t) {
      const gy = H * 0.8, r = csIsland(g, gy, t), mx = W * 0.6;
      g.globalAlpha = 0.22; g.fillStyle = '#F29C6B'; g.fillRect(0, 0, W, gy); g.globalAlpha = 1;   // fim de tarde
      Draw.poly(g, [[mx - 46, gy + 1], [mx - 14, gy - 12], [mx + 14, gy - 12], [mx + 46, gy + 1]], PAL.rice || '#F6F1E4', { ol: 2 });   // montinho
      const walk = U.clamp(k / 0.45, 0, 1), kx = W * 0.2 + (mx - 64 - W * 0.2) * walk, up = U.clamp((k - 0.55) / 0.2, 0, 1);
      const pose = walk < 1 ? 'walk' : k < 0.55 ? 'sniff' : 'cheer';
      E.drawShiba(g, kx, gy, pose, t, { scale: 2.6, pal: S.look.pal, face: 1 });
      const gx = mx + (kx + 14 - mx) * up, gyy = gy - 16 - up * 112, sp = 0.5 + 0.5 * Math.sin(t * 9);
      if (up > 0.6) { g.globalAlpha = 0.35 + 0.3 * sp; Draw.circle(g, gx, gyy, 16 + sp * 6, '#FFF3B0', { ol: 0 }); g.globalAlpha = 1; }
      g.save(); g.translate(gx, gyy); g.rotate(0.5 + up * 2.6);
      g.fillStyle = '#FFFDF4'; g.strokeStyle = CS_LINE; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 7, 4, 0, 0, 6.3); g.fill(); g.stroke(); g.restore();
      for (let i = 0; i < 4 && up > 0.8; i++) { const a = t * 3 + i * 1.57, d = 22 + 6 * Math.sin(t * 5 + i); Draw.circle(g, gx + Math.cos(a) * d, gyy + Math.sin(a) * d, 2.4, PAL.gold, { ol: 0 }); }
      csAir(g, t, r.fc);
    } };
    const homeShot = SHOTS.final[1];   // a casa com onsen e o Kome de molho
    const homeIsl = { dur: 4.2, get cap() { return 'Casa pronta em ' + ISL().n + ': onsen quentinho e pé pra cima.'; }, draw: homeShot.draw };
    SHOTS.final.splice(1, 0, lastGrain);
    SHOTS.ilhafim.splice(1, 0, lastGrain, homeIsl);
    SHOTS.ultimo = [lastGrain, homeIsl];
    return SHOTS;
  };
})();
