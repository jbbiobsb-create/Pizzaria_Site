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
  function csMount(g, cx, base, w, h, k) {
    // montanha de arroz (k: quanto sobrou, 1 = inteira)
    if (k <= 0.01) return; const hh = h * k, ww = w * (0.55 + 0.45 * k);
    g.beginPath(); g.moveTo(cx - ww, base); g.quadraticCurveTo(cx - ww * 0.35, base - hh * 1.02, cx, base - hh); g.quadraticCurveTo(cx + ww * 0.35, base - hh * 1.02, cx + ww, base); g.closePath();
    g.fillStyle = PAL.rice; g.fill(); g.lineWidth = 2.5; g.strokeStyle = CS_LINE; g.stroke();
    g.save(); g.clip();
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
    return SHOTS;
  };
})();
