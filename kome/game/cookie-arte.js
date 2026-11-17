/* Kome no Japão — cookie-arte.js
   ARTE das interfaces da camada Cookie (game/cookie-ui.js). Só desenha; nada de estado de jogo.
   Reaproveita o que já existe: Kome = poses do shiba.js (yawn, sleep, wag), ícones das turmas = G.Props.icon, máquinas absurdas =
   a silhueta de horizonte de cada uma (G.Tools[id].horizon). Novo aqui (vetor, contorno #3B2818, 3 tons): o coração de arroz,
   as 8 Tigelas do Coração e a moeda da chuva do "Pegar!".
   API (G.CookieArt): machineIcon(id, size) -> canvas · heart(n, total, w, h) -> {cv, stop} · bowl(i, filled, can) -> canvas
   · coin(g, x, y, r, spin, alpha) · komeCard(pose, w, h) -> {cv, stop} · komeNap(w, h) -> {cv, stop} · seedIcon() -> canvas */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.U) return;
  const U = E.U, PAL = E.PAL || {}, INK = '#3B2818', TAU = Math.PI * 2;
  const mk = (w, h, d) => { d = d || 2; const c = document.createElement('canvas'); c.width = w * d; c.height = h * d; c.style.width = w + 'px'; c.style.height = h + 'px'; const g = c.getContext('2d'); g.scale(d, d); return [c, g]; };
  const live = [];   // animações vivas (um rAF só pra todas)
  let raf = 0;
  function anim(cv, fn) {
    const a = { cv, fn, t0: performance.now(), dead: false, stop() { a.dead = true; } };
    live.push(a); if (!raf) raf = requestAnimationFrame(step); fn(0); return a;
  }
  function step(now) {
    for (let i = live.length - 1; i >= 0; i--) { const a = live[i]; if (a.dead || !a.cv.isConnected && now - a.t0 > 2000) { live.splice(i, 1); continue; } if (a.cv.isConnected) a.fn((now - a.t0) / 1000); }
    raf = live.length ? requestAnimationFrame(step) : 0;
  }

  /* ---- ícone de turma: 14 de G.Props.icon; absurdas com a silhueta de horizonte ---- */
  const ABS = { tatus: 'tbm', komeohs: 'komeoh', trembala: 'trembala', foguete: 'foguete', fuji: 'fuji', portal: 'portal' };
  const ABS_ICON = { tatus: 'drill', komeohs: 'gear', trembala: 'bolt', foguete: 'star', fuji: 'mount', portal: 'chest' };
  function machineIcon(id, size) {
    size = size || 48;
    const T = ABS[id] && G.Tools && G.Tools[ABS[id]];
    if (ABS[id]) {
      const [c, g] = mk(size, size);
      // céu do horizonte, base dourada (máquina absurda = dourado)
      const gr = g.createLinearGradient(0, 0, 0, size); gr.addColorStop(0, '#FCE7B0'); gr.addColorStop(1, '#F2C866');
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
      let ok = false;
      if (T && T.horizon) { try { g.save(); g.beginPath(); g.rect(0, 0, size, size); g.clip(); T.horizon(g, { x0: 2, x1: size - 2, y: size - 6, k: size / 420, t: 0, n: 1, tint: '#6B4A2E', haze: 0, night: 0 }); g.restore(); ok = true; } catch (e) { ok = false; } }
      if (!ok && E.UI && E.UI.icon) { const ic = E.UI.icon(ABS_ICON[id] || 'star', size * 0.7); if (ic) { g.imageSmoothingEnabled = false; g.drawImage(ic, size * 0.15, size * 0.15, size * 0.7, size * 0.7); } }
      g.fillStyle = INK; g.fillRect(0, size - 5, size, 5);
      return c;
    }
    if (G.Props && G.Props.icon && E.UI && E.UI.icon) return E.UI.icon(G.Props.icon(id), size * 0.86);
    return null;
  }

  /* ---- coração de arroz: grãos enchem o coração de baixo pra cima (n / total) ---- */
  function heartPath(g, cx, cy, s) {
    g.beginPath(); g.moveTo(cx, cy + s * 0.95);
    g.bezierCurveTo(cx - s * 1.25, cy + s * 0.15, cx - s * 1.1, cy - s * 0.95, cx - s * 0.5, cy - s * 0.95);
    g.bezierCurveTo(cx - s * 0.18, cy - s * 0.95, cx, cy - s * 0.72, cx, cy - s * 0.52);
    g.bezierCurveTo(cx, cy - s * 0.72, cx + s * 0.18, cy - s * 0.95, cx + s * 0.5, cy - s * 0.95);
    g.bezierCurveTo(cx + s * 1.1, cy - s * 0.95, cx + s * 1.25, cy + s * 0.15, cx, cy + s * 0.95);
    g.closePath();
  }
  function heart(n, total, w, h) {
    const [c, g] = mk(w, h);
    const cx = w / 2, cy = h * 0.5, s = Math.min(w / 2.6, h / 2.1), f = U.clamp(n / Math.max(1, total), 0, 1);
    // um grão por conquista: grade com tremidinha dentro do coração, de baixo pra cima (os n primeiros aparecem)
    let sd = 3; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const d0 = g.getTransform ? g.getTransform().a : 2;
    let inside = [], step = 14;
    for (let tries = 0; tries < 12; tries++) {
      inside = []; heartPath(g, cx, cy, s * 0.92);
      for (let y = cy + s; y > cy - s; y -= step * 0.8) for (let x = cx - s * 1.3; x < cx + s * 1.3; x += step) {
        const jx = x + (rnd() - 0.5) * step * 0.5, jy = y + (rnd() - 0.5) * step * 0.4;
        if (g.isPointInPath(jx * d0, jy * d0)) inside.push([jx, jy, rnd() * TAU, rnd()]);
      }
      if (inside.length >= total) break; step *= 0.9;
    }
    inside.sort((a, b) => b[1] - a[1]);
    const gr = step * 0.46;
    const show = Math.min(inside.length, Math.round(total * f));
    return anim(c, t => {
      g.clearRect(0, 0, w, h);
      // brilho atrás
      const pulse = 1 + Math.sin(t * 2.2) * 0.025;
      g.save(); g.translate(cx, cy); g.scale(pulse, pulse); g.translate(-cx, -cy);
      const rg = g.createRadialGradient(cx, cy, s * 0.3, cx, cy, s * 1.4); rg.addColorStop(0, 'rgba(255,214,120,.55)'); rg.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
      heartPath(g, cx, cy + 5, s); g.fillStyle = INK; g.fill();                     // sombra dura
      heartPath(g, cx, cy, s); g.fillStyle = '#F7C6CE'; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
      g.save(); heartPath(g, cx, cy, s); g.clip();
      g.fillStyle = '#EFA9B6'; g.fillRect(cx - s * 1.3, cy + s * 0.35, s * 2.6, s);    // tom escuro embaixo
      for (let i = 0; i < show; i++) {
        const q = inside[i], wob = i > show - 12 ? Math.sin(t * 6 + i) * 0.6 : 0;
        g.save(); g.translate(q[0], q[1] + wob); g.rotate(q[2]);
        g.fillStyle = q[3] > 0.92 ? (PAL.gold || '#E3BC62') : '#FFFDF4'; g.strokeStyle = 'rgba(59,40,24,.55)'; g.lineWidth = 0.8;
        g.beginPath(); g.ellipse(0, 0, gr, gr * 0.52, 0, 0, TAU); g.fill(); g.stroke(); g.restore();
      }
      g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(cx - s * 0.55, cy - s * 0.55, s * 0.22, s * 0.12, -0.6, 0, TAU); g.fill();
      g.restore();
      g.restore();
      // número no meio, com contorno
      g.font = '900 40px ' + font(); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText(String(n), cx, cy + 4); g.fillStyle = '#FFF6E6'; g.fillText(String(n), cx, cy + 4);
      g.font = '900 17px ' + font(); g.lineWidth = 5; g.strokeText('de ' + total, cx, cy + 34); g.fillStyle = '#FFE9A8'; g.fillText('de ' + total, cx, cy + 34);
    });
  }
  const font = () => "'Zen Maru Gothic','Nunito','Arial Rounded MT Bold',system-ui,sans-serif";

  /* ---- 8 tigelas (cada uma com sua estampa); cheia = arroz + vapor + aro dourado; vazia = tracejada ---- */
  const BOWL = [   // corpo, tom escuro, estampa
    ['#C8423A', '#93302A', 'dots'], ['#E8913A', '#A8601E', 'wave'], ['#5B9BD5', '#2E6E92', 'flag'], ['#7DB34A', '#4F6142', 'leaf'],
    ['#E48FA5', '#B0566C', 'heart'], ['#8E6BB0', '#5A3E78', 'star'], ['#3B2818', '#1F140B', 'gold'], ['#E3BC62', '#B4852A', 'crown'],
  ];
  function bowl(i, filled, can) {
    const w = 96, h = 64, [c, g] = mk(w, h), B = BOWL[i % 8], cx = w / 2, top = 30;
    g.lineJoin = 'round';
    if (!filled) {
      g.globalAlpha = can ? 0.9 : 0.55;
      g.setLineDash([5, 4]); g.lineWidth = 2.5; g.strokeStyle = INK;
      g.beginPath(); g.moveTo(cx - 34, top); g.quadraticCurveTo(cx - 32, top + 28, cx, top + 28); g.quadraticCurveTo(cx + 32, top + 28, cx + 34, top); g.closePath();
      g.fillStyle = can ? '#FFF0B8' : '#E9DFCB'; g.fill(); g.stroke(); g.setLineDash([]);
      g.font = '900 20px ' + font(); g.textAlign = 'center'; g.fillStyle = INK; g.fillText(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i], cx, top + 20);
      g.globalAlpha = 1; return c;
    }
    // vapor
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.5; g.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(cx + k * 12, top - 12); g.bezierCurveTo(cx + k * 12 - 5, top - 18, cx + k * 12 + 5, top - 22, cx + k * 12, top - 28); g.stroke(); }
    // arroz (montinho)
    g.fillStyle = '#FFFDF4'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - 32, top + 1); g.quadraticCurveTo(cx - 20, top - 16, cx, top - 15); g.quadraticCurveTo(cx + 22, top - 16, cx + 32, top + 1); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#E8DEC6'; for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(cx - 18 + k * 6, top - 6 - (k % 3) * 3, 2.2, 1.1, 0.4, 0, TAU); g.fill(); }
    // corpo
    g.beginPath(); g.moveTo(cx - 36, top); g.quadraticCurveTo(cx - 34, top + 28, cx, top + 28); g.quadraticCurveTo(cx + 34, top + 28, cx + 36, top); g.closePath();
    g.fillStyle = B[0]; g.fill();
    g.save(); g.clip();
    g.fillStyle = B[1]; g.fillRect(cx - 40, top + 18, 80, 14);
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (let k = 0; k < 5; k++) {
      const x = cx - 24 + k * 12, y = top + 11;
      if (B[2] === 'dots') { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); }
      else if (B[2] === 'wave') { g.fillRect(x - 5, y - 1, 10, 2); g.fillRect(x - 2, y - 3, 4, 2); }
      else if (B[2] === 'flag') { g.fillStyle = '#FFF'; g.fillRect(x - 4, y - 3, 8, 6); g.fillStyle = '#C8423A'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.8)'; }
      else if (B[2] === 'leaf') { g.beginPath(); g.ellipse(x, y, 4, 2, 0.6, 0, TAU); g.fill(); }
      else if (B[2] === 'heart') { g.beginPath(); g.arc(x - 1.5, y - 1, 1.8, 0, TAU); g.arc(x + 1.5, y - 1, 1.8, 0, TAU); g.moveTo(x - 3.2, y); g.lineTo(x, y + 3.2); g.lineTo(x + 3.2, y); g.fill(); }
      else if (B[2] === 'star' || B[2] === 'crown') { g.fillStyle = B[2] === 'crown' ? '#FFF6E6' : '#FFE16A'; g.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? 1.6 : 3.8; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); g.fillStyle = 'rgba(255,255,255,.8)'; }
      else if (B[2] === 'gold') { g.fillStyle = '#E3BC62'; g.fillRect(x - 4, y - 1, 8, 2); }
    }
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(cx - 20, top + 7, 8, 3, -0.3, 0, TAU); g.fill();
    g.restore();
    g.beginPath(); g.moveTo(cx - 36, top); g.quadraticCurveTo(cx - 34, top + 28, cx, top + 28); g.quadraticCurveTo(cx + 34, top + 28, cx + 36, top); g.closePath();
    g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
    g.fillStyle = PAL.gold || '#E3BC62'; g.fillRect(cx - 37, top - 2, 74, 4); g.strokeRect(cx - 37, top - 2, 74, 4);
    g.fillStyle = B[1]; g.fillRect(cx - 10, top + 27, 20, 5); g.strokeRect(cx - 10, top + 27, 20, 5);
    return c;
  }

  /* ---- moeda girando (chuva do Pegar! e brilhos de compra) ---- */
  function coin(g, x, y, r, spin, a) {
    const sx = Math.max(0.15, Math.abs(Math.cos(spin)));
    g.save(); g.globalAlpha = a === undefined ? 1 : a; g.translate(x, y); g.scale(sx, 1);
    g.fillStyle = INK; g.beginPath(); g.arc(0, 1.5, r + 1.5, 0, TAU); g.fill();
    g.fillStyle = '#E9B23E'; g.beginPath(); g.arc(0, 0, r + 0.5, 0, TAU); g.fill();
    g.fillStyle = '#FFE16A'; g.beginPath(); g.arc(0, 0, r * 0.72, 0, TAU); g.fill();
    if (sx > 0.5) { g.fillStyle = '#B4852A'; g.font = '900 ' + Math.round(r * 1.2) + 'px ' + font(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('¥', 0, 1); }
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-r * 0.5, -r * 0.55, r * 0.3, r * 0.3);
    g.restore();
  }

  /* ---- Kome (poses do shiba.js, sem mexer nelas) ---- */
  const pal = () => (G.S && G.S.look && G.S.look.pal) || 'kome';
  function komeCard(pose, w, h) {
    const [c, g] = mk(w, h, 1); c.style.imageRendering = 'pixelated';
    return anim(c, t => { g.clearRect(0, 0, w, h); g.imageSmoothingEnabled = false; if (E.drawShiba) E.drawShiba(g, w / 2, h - 6, pose || 'wag', t, { scale: 2, pal: pal(), shadow: true }); });
  }
  // cochilo: boceja (2,4 s), deita e dorme com "z" subindo
  function komeNap(w, h) {
    const [c, g] = mk(w, h, 1); c.style.imageRendering = 'pixelated';
    return anim(c, t => {
      g.clearRect(0, 0, w, h); g.imageSmoothingEnabled = false;
      g.fillStyle = '#E8DCC0'; g.beginPath(); g.ellipse(w / 2, h - 10, w * 0.36, 8, 0, 0, TAU); g.fill();   // almofadinha
      const sleep = t > 2.4;
      if (E.drawShiba) E.drawShiba(g, w / 2, h - 10, sleep ? 'sleep' : 'yawn', t, { scale: 2, pal: pal(), shadow: !sleep });
      if (sleep) {
        g.font = '900 16px ' + font(); g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = INK; g.fillStyle = '#FFF6E6';
        for (let i = 0; i < 3; i++) { const p = ((t - 2.4) * 0.5 + i / 3) % 1, x = w * 0.66 + p * 18 + i * 3, y = h * 0.55 - p * 40; g.globalAlpha = Math.sin(p * Math.PI); g.font = '900 ' + (12 + i * 4) + 'px ' + font(); g.strokeText('z', x, y); g.fillText('z', x, y); }
        g.globalAlpha = 1;
      }
    });
  }
  function seedIcon() {
    const [c, g] = mk(48, 46, 2);
    g.fillStyle = INK; g.beginPath(); g.ellipse(24, 26, 13, 17, 0.25, 0, TAU); g.fill();
    g.fillStyle = '#E3BC62'; g.beginPath(); g.ellipse(23, 24, 11, 15, 0.25, 0, TAU); g.fill();
    g.fillStyle = '#FFE58A'; g.beginPath(); g.ellipse(20, 20, 5, 9, 0.25, 0, TAU); g.fill();
    g.fillStyle = '#7DB34A'; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.ellipse(31, 8, 8, 4, -0.5, 0, TAU); g.fill(); g.stroke();
    return c;
  }

  G.CookieArt = { machineIcon, heart, bowl, coin, komeCard, komeNap, seedIcon };
})();
