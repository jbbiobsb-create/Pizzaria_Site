/* Kome no Japão — scenery.js
   Cenário de cada ilha (fim de jogo): lê o PERFIL DE CENA da ilha (D.ISLANDS[i].scene em islands.js, só dados) e desenha:
   - fundo: tinta do céu, o "longe" (fuji | peaks = picos nevados | volcano = Sakurajima fumegando | sea = mar de Okinawa |
     mochi = ilhas flutuantes e nuvens de mochi), cores dos morros e palmeiras na frente do morro;
   - pátio: árvore da régua (pinheiro, momiji, palmeira, sakura), enfeites da ilha (bonecos de neve, onsen fumegando, shisas e
     guarda-sol, mochis gigantes), neve nos telhados (snowy: pinta o topo de cada sprite de pixel);
   - montanha: crista por cima das camadas (neve que some onde você cava, crosta de cinza com fumaça na cratera, riscos de areia,
     brilho de mochi);
   - ar: partículas em tela (neve, cinza, brilho do mar e gaivotas, pétalas e mochizinhos), engrossadas pelo evento da ilha.
   game-world.js e game.js chamam estas funções; nada aqui muda estado do jogo. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, PAL = E.PAL, Draw = E.Draw, N = E.Nature || null, LINE = PAL.line;
  const mixc = {};
  const mix = (a, b, t) => mixc[a + b + t] || (mixc[a + b + t] = U.mixCss(a, b, t));
  const shade = (c, k) => mix(c, k < 0 ? '#2A1A10' : '#FFFFFF', Math.abs(k));
  const prof = () => (G.Islands ? G.Islands.scene() : null);
  const evNow = () => (G.Islands ? G.Islands.event() : null);
  const lightOf = S => (N && N.light ? N.light(S.tod !== undefined ? S.tod : 0.42) : { night: 0, haze: '#CFE3EE', top: '#9FCBEA', cloud: '#FFFFFF' });
  const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

  /* ================= fundo (coordenadas de tela, com parallax pelo cam.x) ================= */
  function skyTint(g, W, H, sc, S) {
    if (!sc.sky) return;
    const L = lightOf(S), a = sc.sky[2] * (1 - 0.75 * (L.night || 0));
    if (a <= 0.01) return;
    const gr = g.createLinearGradient(0, 0, 0, H * 0.8); gr.addColorStop(0, sc.sky[0]); gr.addColorStop(1, sc.sky[1]);
    g.save(); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
  }
  // picos nevados de Hokkaido (cordilheira azulada com chapéu de neve em zigue-zague)
  function peaks(g, W, H, hz, cam, t, S) {
    const L = lightOf(S), off = (cam.x - 2000) * 0.012, fs = 1 + 0.5 * Math.sqrt(U.clamp(cam.z / 3, 0, 1));
    const P = [[0.08, 0.8, 1.0], [0.24, 1.25, 1.2], [0.4, 0.9, 0.9], [0.58, 1.1, 1.05], [0.76, 0.75, 0.85], [0.92, 1.0, 1.0]];
    for (let k = 0; k < P.length; k++) {
      const p = P[k], x = W * p[0] - off * (0.7 + k * 0.05), h = 92 * p[1] * fs, w = 120 * p[2] * fs;
      const body = mix(mix('#7C93B4', L.haze, 0.35), L.top, 0.12), dark = mix(body, '#2A3348', 0.18), snow = mix('#FFFFFF', L.haze, 0.18 + 0.3 * (L.night || 0));
      g.fillStyle = body; g.beginPath(); g.moveTo(x - w, hz + 2); g.lineTo(x - w * 0.12, hz - h); g.lineTo(x + w * 0.08, hz - h * 0.97); g.lineTo(x + w, hz + 2); g.closePath(); g.fill();
      g.fillStyle = dark; g.beginPath(); g.moveTo(x + w * 0.08, hz - h * 0.97); g.lineTo(x + w, hz + 2); g.lineTo(x + w * 0.2, hz + 2); g.lineTo(x + w * 0.02, hz - h * 0.5); g.closePath(); g.fill();
      g.fillStyle = snow; g.beginPath(); g.moveTo(x - w * 0.12, hz - h); g.lineTo(x + w * 0.08, hz - h * 0.97);
      const sx1 = x + w * 0.42, sx0 = x - w * 0.55, sy = hz - h * 0.52;
      g.lineTo(sx1, sy); for (let i = 0; i <= 6; i++) { const u = i / 6; g.lineTo(sx1 + (sx0 - sx1) * u, sy + (i % 2 ? 9 : -2) * fs); }
      g.closePath(); g.fill();
    }
  }
  // Sakurajima: vulcão largo com cratera, fumaça subindo (erupção: mais fumaça, lava e brilho)
  function volcano(g, W, H, hz, cam, t, S, ev) {
    const L = lightOf(S), x = W * 0.3 - (cam.x - 2000) * 0.012, fs = 1.1 + 0.8 * Math.sqrt(U.clamp(cam.z / 3, 0, 1)), w = 170 * fs, h = 96 * fs;
    const er = ev && ev.erupt ? 1 : 0;
    const body = mix(mix('#5A4844', L.haze, 0.22), L.top, 0.08), lite = shade(body, 0.2), dark = shade(body, -0.2);
    g.fillStyle = body; g.beginPath(); g.moveTo(x - w, hz + 2); g.quadraticCurveTo(x - w * 0.45, hz - h * 0.4, x - w * 0.16, hz - h); g.lineTo(x + w * 0.16, hz - h); g.quadraticCurveTo(x + w * 0.45, hz - h * 0.4, x + w, hz + 2); g.closePath(); g.fill();
    g.fillStyle = lite; g.beginPath(); g.moveTo(x - w * 0.16, hz - h); g.quadraticCurveTo(x - w * 0.45, hz - h * 0.4, x - w, hz + 2); g.lineTo(x - w * 0.55, hz + 2); g.quadraticCurveTo(x - w * 0.25, hz - h * 0.5, x - w * 0.1, hz - h); g.closePath(); g.fill();
    g.fillStyle = dark; for (let i = 0; i < 5; i++) { const u = -0.08 + i * 0.05; g.fillRect(x + u * w * 2, hz - h * (0.92 - i * 0.04), 2 * fs, h * (0.35 + 0.08 * i)); }   // ravinas
    const glow = Math.max(er, 0.35, (L.night || 0) * 0.8);
    if (glow > 0.02) { g.save(); g.globalAlpha = glow * (0.6 + 0.3 * Math.sin(t * 6)); g.fillStyle = '#FF8A3A'; g.beginPath(); g.ellipse(x, hz - h, w * 0.17, 5 * fs, 0, 0, 6.3); g.fill(); g.restore(); }
    // fumaça
    const n = er ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const q = (t * (er ? 0.35 : 0.12) + i / n) % 1, r = (10 + q * (er ? 46 : 34)) * fs * 0.6;
      g.globalAlpha = (er ? 0.9 : 0.8) * (1 - q * 0.85);
      g.fillStyle = er && q < 0.25 ? '#8A7A70' : q < 0.4 ? '#C9C0B6' : mix('#ECE6DE', L.haze, 0.2);
      g.beginPath(); g.arc(x + Math.sin(i * 1.7 + t * 0.5) * 6 * fs + q * 60 * fs, hz - h - q * (er ? 150 : 95) * fs, r, 0, 6.3); g.fill();
    }
    g.globalAlpha = 1;
    if (er) for (let i = 0; i < 7; i++) {   // bolotas de curry voando
      const q = (t * 0.8 + i / 7) % 1, vx = (hash(i, 3) - 0.5) * 120 * fs, bx = x + vx * q, by = hz - h - (110 * q - 130 * q * q) * fs;
      g.fillStyle = i % 2 ? '#F3C94A' : '#E07A2A'; g.beginPath(); g.arc(bx, by, 2.6 * fs, 0, 6.3); g.fill();
    }
  }
  // mar de Okinawa no horizonte: faixa azul com brilhos, ilhotas e um barquinho (maré baixa: o mar recua)
  function sea(g, W, H, hz, cam, t, S, ev) {
    const L = lightOf(S), tide = ev && ev.tide ? 6 : 0, y0 = hz - 30 + tide;
    seaBand(g, W, H, y0, cam, t, L);
  }
  function seaBand(g, W, H, y0, cam, t, L) {
    const gr = g.createLinearGradient(0, y0, 0, H); gr.addColorStop(0, mix('#1E8FC8', L.haze, 0.25)); gr.addColorStop(0.4, mix('#3DB8DA', L.haze, 0.15)); gr.addColorStop(1, '#8BE0EA');
    g.fillStyle = gr; g.fillRect(0, y0, W, H - y0);
    const off = (cam.x * 0.02) % 60;
    for (let i = 0; i < 4; i++) { const x = ((i * 260 - cam.x * 0.008) % (W + 200) + W + 200) % (W + 200) - 100; g.fillStyle = mix('#4E8A5A', L.haze, 0.45); g.beginPath(); g.ellipse(x, y0 + 1, 30 + i * 9, 7 + i * 2, 0, Math.PI, 0); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.75)';
    for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) {
      const x = ((i * 97 + r * 41 - off * (r + 1) + t * (6 + r * 3)) % (W + 40) + W + 40) % (W + 40) - 20, y = y0 + 6 + r * 7;
      if ((Math.sin(t * 2 + i * 1.3 + r) + 1) > 0.9) g.fillRect(x, y, 6 + r * 2, 1);
    }
    const bx = ((t * 8 - cam.x * 0.01) % (W + 100) + W + 100) % (W + 100) - 50, by = y0 + 8 + Math.sin(t * 2) * 1;   // barquinho de pesca
    if (by > H) return;
    g.fillStyle = '#7A5034'; g.fillRect(bx - 9, by, 18, 3); g.fillStyle = '#FFF8EC'; g.beginPath(); g.moveTo(bx, by - 12); g.lineTo(bx + 8, by - 1); g.lineTo(bx, by - 1); g.closePath(); g.fill();
  }
  // ilha flutuante de mochi: ilhotas que boiam no céu com sakura e cachoeira, e nuvens de mochi com carinha
  function mochiSky(g, W, H, hz, cam, t, S) {
    const L = lightOf(S);
    for (let i = 0; i < 5; i++) {   // nuvens de mochi
      const r = (22 + (i % 3) * 8), x = ((i * 230 + t * (3 + i) - cam.x * 0.03) % (W + 160) + W + 160) % (W + 160) - 80, y = 60 + (i % 3) * 46 + Math.sin(t * 0.8 + i) * 4;
      const body = mix(i % 2 ? '#FFF6F8' : '#FBE0EA', L.haze, 0.12 + 0.3 * (L.night || 0));
      g.fillStyle = shade(body, -0.08); g.beginPath(); g.ellipse(x, y + 3, r * 1.25, r * 0.78, 0, 0, 6.3); g.fill();
      g.fillStyle = body; g.beginPath(); g.ellipse(x, y, r * 1.2, r * 0.72, 0, 0, 6.3); g.fill();
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(x - r * 0.45, y - r * 0.3, r * 0.3, r * 0.14, -0.3, 0, 6.3); g.fill();
      g.fillStyle = '#3B2818'; g.fillRect(x - 6, y - 1, 2, 3); g.fillRect(x + 4, y - 1, 2, 3);   // carinha
      g.fillStyle = 'rgba(240,120,150,.55)'; g.fillRect(x - 11, y + 3, 4, 2); g.fillRect(x + 7, y + 3, 4, 2);
    }
    for (let i = 0; i < 3; i++) {   // ilhotas flutuantes
      const x = W * (0.16 + i * 0.32) - (cam.x - 2000) * (0.008 + i * 0.003), y = hz - 120 - i * 26 + Math.sin(t * 0.7 + i * 2) * 5, w = 46 + i * 10;
      g.fillStyle = mix('#E4B7C6', L.haze, 0.3); g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.3, y + w * 0.9, x + w * 0.1, y + w * 0.75); g.quadraticCurveTo(x + w * 0.5, y + w * 0.5, x + w, y); g.closePath(); g.fill();
      g.fillStyle = mix('#BFE3A8', L.haze, 0.25); g.beginPath(); g.ellipse(x, y, w, 7, 0, Math.PI, 0); g.fill(); g.fillRect(x - w, y - 1, w * 2, 3);
      g.fillStyle = mix('#F29CB4', L.haze, 0.2); g.beginPath(); g.arc(x - w * 0.35, y - 12, 9, 0, 6.3); g.arc(x - w * 0.2, y - 16, 8, 0, 6.3); g.fill();
      g.fillStyle = mix('#8E5E3C', L.haze, 0.3); g.fillRect(x - w * 0.3, y - 8, 2, 8);
      g.fillStyle = 'rgba(190,230,255,.7)'; g.fillRect(x + w * 0.55, y + 2, 3, 18 + 6 * Math.sin(t * 3 + i));   // cachoeirinha
    }
  }
  const FAR = { peaks, volcano, sea, mochi: mochiSky };
  function far(g, W, H, hz, cam, t, S, sc) { const f = FAR[sc.far]; if (f) f(g, W, H, hz, cam, t, S, evNow()); }
  // na frente do morro de perto: palmeiras (Okinawa), pinheiros nevados (Hokkaido)
  function near(g, W, H, hz, cam, t, S, sc) {
    if (sc.far === 'sea') { const ev = evNow(); seaBand(g, W, H, hz - 34 + (ev && ev.tide ? 8 : 0), cam, t, lightOf(S)); }   // o mar aparece logo atrás do pátio
    if (sc.tree === 'palm') { const off = cam.x * 0.5; for (let i = 0; i < 9; i++) { const x = ((i * 150 - off) % (W + 300) + W + 300) % (W + 300) - 150; palm(g, x, hz + 14 + (i % 2) * 6, 0.32 + (i % 3) * 0.05, t + i, true); } }
    else if (sc.tree === 'pine' && sc.yard === 'neve') {
      const off = cam.x * 0.5, L = lightOf(S);
      for (let i = 0; i < 14; i++) {
        const x = ((i * 92 - off) % (W + 200) + W + 200) % (W + 200) - 100, y = hz + 12 + (i % 3) * 4, s = 0.6 + (i % 4) * 0.12;
        g.fillStyle = mix('#3E5E4C', L.haze, 0.35); g.beginPath(); g.moveTo(x, y - 30 * s); g.lineTo(x + 10 * s, y); g.lineTo(x - 10 * s, y); g.closePath(); g.fill();
        g.fillStyle = mix('#FFFFFF', L.haze, 0.15); g.beginPath(); g.moveTo(x, y - 30 * s); g.lineTo(x + 4 * s, y - 19 * s); g.lineTo(x - 4 * s, y - 19 * s); g.closePath(); g.fill();
        g.fillRect(x - 8 * s, y - 8 * s, 16 * s, 2);
      }
    }
  }

  /* ================= pátio (coordenadas de mundo, chão em y = 0) ================= */
  // palmeira vetorial: tronco em gomos curvados e 6 folhas que balançam
  function palm(g, x, y, s, t, flat) {
    const sw = Math.sin(t * 1.3) * 0.06, lean = 0.18;
    g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
    const top = [lean * 90 + sw * 40, -150];
    for (let i = 0; i < 9; i++) {
      const u = i / 9, u2 = (i + 1) / 9, x0 = top[0] * u * u, x1 = top[0] * u2 * u2;
      Draw.poly(g, [[x0 - 7 + u * 2, -150 * u], [x0 + 7 - u * 2, -150 * u], [x1 + 6 - u2 * 2, -150 * u2 - 1], [x1 - 6 + u2 * 2, -150 * u2 - 1]], i % 2 ? '#B98A5A' : '#A47648', { ol: flat ? 0 : 1.6 });
    }
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.62 + Math.sin(t * 1.7 + k) * 0.05, len = 70 + (k % 2) * 14;
      const ex = top[0] + Math.cos(a) * len, ey = top[1] + Math.sin(a) * len * 0.6 + 26;
      const mx = top[0] + Math.cos(a) * len * 0.5, my = top[1] + Math.sin(a) * len * 0.55 - 10;
      g.fillStyle = k % 2 ? '#4E9A4E' : '#3E8A44'; g.strokeStyle = LINE; g.lineWidth = flat ? 0 : 1.6;
      g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(mx, my - 10, ex, ey); g.quadraticCurveTo(mx, my + 8, top[0], top[1] + 4); g.closePath(); g.fill(); if (!flat) g.stroke();
    }
    if (!flat) { Draw.circle(g, top[0] - 5, top[1] + 8, 6, '#8A5A2A', { ol: 1.4 }); Draw.circle(g, top[0] + 6, top[1] + 9, 6, '#7A4E24', { ol: 1.4 }); }
    g.restore();
  }
  function snowman(g, x, t) {
    Draw.circle(g, x, -22, 22, '#FFFFFF', { ol: 2 }); Draw.circle(g, x, -56, 15, '#FFFFFF', { ol: 2 });
    g.fillStyle = 'rgba(160,190,215,.5)'; g.beginPath(); g.ellipse(x + 8, -16, 12, 14, 0, 0, 6.3); g.fill();
    Draw.box(g, x - 11, -82, 22, 12, '#3B3F4A', { r: 2 }); Draw.box(g, x - 15, -72, 30, 4, '#3B3F4A', { r: 1 });   // chapéu
    g.fillStyle = LINE; g.fillRect(x - 6, -61, 3, 3); g.fillRect(x + 3, -61, 3, 3);
    Draw.poly(g, [[x, -56], [x + 14, -53], [x, -51]], '#F08A3A', { ol: 1 });
    Draw.box(g, x - 14, -45, 28, 5, '#D8574E', { r: 2 }); Draw.box(g, x + 6, -45, 5, 14, '#D8574E', { r: 2 });   // cachecol
    g.strokeStyle = '#7A5034'; g.lineWidth = 2.4; const w = Math.sin(t * 2) * 3;
    g.beginPath(); g.moveTo(x - 18, -30); g.lineTo(x - 36, -44 + w); g.moveTo(x + 18, -30); g.lineTo(x + 36, -46 - w); g.stroke();
  }
  function steamRocks(g, x, t) {
    if (N) { N.rock(g, x - 26, 0, { w: 40, h: 22, seed: 3 }); N.rock(g, x + 18, 0, { w: 30, h: 18, seed: 9 }); }
    Draw.box(g, x - 30, -10, 60, 10, '#7FB8D8', { r: 5 });
    for (let i = 0; i < 4; i++) { const q = (t * 0.5 + i / 4) % 1; g.globalAlpha = 0.55 * (1 - q); Draw.circle(g, x - 18 + i * 12 + Math.sin(t + i) * 4, -16 - q * 60, 6 + q * 10, '#FFFFFF', { ol: 0 }); }
    g.globalAlpha = 1;
  }
  function lavaRock(g, x, t) {
    Draw.poly(g, [[x - 34, 0], [x - 26, -26], [x - 6, -38], [x + 18, -30], [x + 34, 0]], '#5A4A48', { ol: 2 });
    g.strokeStyle = 'rgba(255,140,50,' + (0.6 + 0.3 * Math.sin(t * 4)) + ')'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(x - 18, -6); g.lineTo(x - 8, -20); g.lineTo(x + 2, -14); g.lineTo(x + 12, -26); g.stroke();
  }
  // shisa (leão-cão de guarda de Okinawa) em pixel: um de boca aberta, outro fechada
  const sShisa = open => E.sprite('isl/shisa' + (open ? 1 : 0), 22, 26, P => {
    const b = '#D9733E', d = '#A9512A', l = '#F2A060', st = '#B7AFA2';
    P.rect(2, 20, 18, 6, st).rect(2, 20, 18, 1, '#D6CFC4');
    P.rect(4, 11, 13, 9, b).rect(14, 11, 3, 9, d).rect(5, 12, 4, 2, l);
    P.ell(10, 7, 7, 6, b).rect(3, 2, 4, 3, d).rect(13, 2, 4, 3, d);
    for (let i = 0; i < 5; i++) P.set(3 + i * 3, 12 - (i % 2), d);
    P.rect(7, 6, 2, 2, '#2A1A10').rect(12, 6, 2, 2, '#2A1A10');
    if (open) P.rect(8, 10, 5, 2, '#7A2A1A').rect(8, 10, 1, 1, '#FFFFFF').rect(12, 10, 1, 1, '#FFFFFF'); else P.rect(8, 10, 5, 1, d);
  });
  function shisas(g, x) {
    const k = 3, sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
    for (const s of [-1, 1]) { const cv = sShisa(s > 0); g.save(); g.translate(x + s * 120, 0); g.scale(-s, 1); g.drawImage(cv, -cv.width * k / 2, -cv.height * k + k, cv.width * k, cv.height * k); g.restore(); }
    g.imageSmoothingEnabled = sm;
  }
  function umbrella(g, x, t) {
    g.strokeStyle = LINE; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, -84); g.stroke();
    const cx = x + 8, cy = -80;
    g.save(); g.beginPath(); g.ellipse(cx, cy, 60, 28, 0, Math.PI, 0); g.closePath(); g.clip();
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#FFF8EC' : '#D8574E'; g.fillRect(cx - 60 + i * 20, cy - 30, 20, 32); }
    g.restore();
    g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, 60, 28, 0, Math.PI, 0); g.closePath(); g.stroke();
    Draw.box(g, x - 40, -4, 52, 5, '#3F78C8', { r: 2 }); Draw.box(g, x + 26, -26, 9, 26, '#F3C94A', { r: 4 });   // toalha e prancha
  }
  function giantMochi(g, x, t, col, i) {
    const sq = 1 + Math.sin(t * 2 + i) * 0.05;
    g.save(); g.translate(x, 0); g.scale(1 / sq, sq);
    g.fillStyle = col; g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -24, 36, 24, 0, Math.PI, 0); g.lineTo(36, 0); g.lineTo(-36, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(-14, -36, 9, 4, -0.4, 0, 6.3); g.fill();
    g.fillStyle = LINE; g.fillRect(-10, -22, 3, 4); g.fillRect(7, -22, 3, 4); g.fillRect(-3, -15, 6, 2);
    g.fillStyle = 'rgba(240,110,140,.6)'; g.fillRect(-19, -16, 6, 3); g.fillRect(13, -16, 6, 3);
    g.restore();
  }
  function dango(g, x, t) {
    g.strokeStyle = '#B98A5A'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -96); g.stroke();
    ['#A9CB8A', '#FFF6F4', '#F6B6C8'].forEach((c, i) => Draw.circle(g, x, -40 - i * 20, 11, c, { ol: 2 }));
  }
  // enfeites por ilha (x de mundo no pátio, longe dos prédios da régua)
  const YARD = {
    neve(g, v, t) { if (N) { N.tree(g, 720, 0, { kind: 'pine', s: 1.4, seed: 2, t }); N.tree(g, 1130, 0, { kind: 'pine', s: 1.2, seed: 5, t }); } snowman(g, 1500, t); snowman(g, 930, t + 1); },
    vulcao(g, v, t) { steamRocks(g, 1500, t); lavaRock(g, 930, t); if (N) N.tree(g, 1130, 0, { kind: 'maple', s: 1.1, seed: 3, t }); },
    praia(g, v, t, S, X) { shisas(g, X.torii); umbrella(g, 1500, t); palm(g, 1130, 0, 1.1, t); palm(g, 700, 0, 1.25, t + 2); },
    mochi(g, v, t) { giantMochi(g, 690, t, '#FFF6F4', 0); giantMochi(g, 930, t, '#F6C6D2', 1); giantMochi(g, 1520, t, '#A9CB8A', 2); dango(g, 1130, t); },
  };

  // estátua do KOME-OH no pátio depois do Grande Final (desenhada uma vez numa imagem e reaproveitada)
  let statue = null;
  function legendStatue(g, v, t, S) {
    if (!S.stats || !S.stats.legend) return;
    const x = -560; if (x + 200 < v.x0 || x - 200 > v.x1) return;
    const T = G.Tools && G.Tools.komeoh; if (!T) return;
    if (!statue) {
      try {
        const m = T.create({ mode: 'normal', x: 0, pilot: (S.look && S.look.pal) || 'kome' }), INP = { x: 0, y: 0, floor: () => 0, face: 1, digging: false };
        for (let i = 0; i < 90; i++) T.update(m, 1 / 60, INP);
        const k = 0.3, c = document.createElement('canvas'); c.width = 900 * k; c.height = 1180 * k;
        const cg = c.getContext('2d'); cg.translate(c.width / 2, c.height - 6); cg.scale(k, k); T.draw(cg, m);
        statue = { c, k };
      } catch (e) { statue = { c: null }; }
    }
    Draw.box(g, x - 120, -34, 240, 34, '#B7AFA2', { r: 3 }); Draw.box(g, x - 132, -44, 264, 12, '#D6CFC4', { r: 3 });
    Draw.sign(g, x - 60, -30, 120, 22, 'KOME-OH', { col: '#F3C94A', ink: LINE });
    if (statue.c) g.drawImage(statue.c, x - statue.c.width / 2, -44 - statue.c.height + 6);
    for (let i = 0; i < 3; i++) { const a = t * 1.2 + i * 2.1; g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i); Draw.circle(g, x + Math.cos(a) * 130, -220 + Math.sin(a) * 60, 4, '#FFF3B0', { ol: 0 }); } g.globalAlpha = 1;
  }
  function yard(g, v, t, S, X) {
    legendStatue(g, v, t, S); const sc = prof(); if (sc && YARD[sc.yard] && v.x0 < 1900) YARD[sc.yard](g, v, t, S, X); }
  // árvore da régua do pátio (no lugar da sakura)
  function rulerTree(g, x, t) {
    const sc = prof(), k = (sc && sc.tree) || 'sakura';
    if (k === 'palm') palm(g, x, 0, 1.3, t);
    else if (N) N.tree(g, x, 0, { kind: k, s: 1.5, seed: 4, t });
    if (sc && sc.roofSnow) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(x, -150, 34, 8, 0, Math.PI, 0); g.fill(); }
  }
  // neve no telhado: cópia do sprite com o topo de cada coluna pintado de branco (cache por sprite)
  const snowCache = new WeakMap();
  function snowy(cv) {
    let c = snowCache.get(cv); if (c) return c;
    c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    const x2 = c.getContext('2d'); x2.drawImage(cv, 0, 0);
    try {
      const id = x2.getImageData(0, 0, c.width, c.height), d = id.data, w = c.width, h = c.height;
      for (let x = 0; x < w; x++) {
        let y = 0; while (y < h && d[(y * w + x) * 4 + 3] < 10) y++;
        for (let k = 1; k <= 3 && y + k < h; k++) { const o = ((y + k) * w + x) * 4; if (d[o + 3] < 10) break; const v = k === 3 ? [205, 224, 238] : [250, 252, 255]; d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; }
      }
      x2.putImageData(id, 0, 0);
    } catch (e) { /* file:// sem acesso aos pixels: fica sem neve */ }
    snowCache.set(cv, c); return c;
  }
  const roofSnow = () => { const sc = prof(); return !!(sc && sc.roofSnow); };
  function toriiSnow(g, x, s) { if (!roofSnow()) return; g.fillStyle = '#FFFFFF'; g.strokeStyle = 'rgba(160,190,215,.8)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, -74 * s + 1, 46 * s, 4 * s, 0, Math.PI, 0); g.fill(); g.stroke(); }
  const groundCols = () => { const sc = prof(); return sc && sc.ground; };

  /* ================= crista da montanha (mundo; depois do heap.draw) ================= */
  function crest(g, heap, v, t, z, S) {
    const sc = prof(); if (!sc || !sc.crest || !heap) return;
    const h = heap.h, h0 = heap.h0, cw = heap.colW, n = heap.n, ev = evNow();
    let i0 = Math.max(1, Math.floor(v.x0 / cw) - 1), i1 = Math.min(n - 2, Math.ceil(v.x1 / cw) + 1);
    const step = Math.max(1, Math.floor(2 / (cw * z))), px = 1 / z, mh = heap.maxH || 2000;
    const kind = sc.crest, frost = ev && ev.frost;
    g.save(); g.lineJoin = 'round';
    if (kind === 'snow' || kind === 'mochi') {
      // faixas contínuas onde a montanha não foi cavada (cavou: a neve some ali)
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          g.beginPath(); g.moveTo(run[0][0], run[0][1]);
          for (let k = 1; k < run.length; k++) g.lineTo(run[k][0], run[k][1]);
          for (let k = run.length - 1; k >= 0; k--) g.lineTo(run[k][0], run[k][1] + run[k][2]);
          g.closePath();
          if (kind === 'snow') { g.fillStyle = frost ? '#E2F2FF' : '#FFFFFF'; g.fill(); g.strokeStyle = frost ? '#8FC4E8' : 'rgba(150,180,210,.9)'; g.lineWidth = Math.max(1, 1.4 * px); g.stroke(); }
          else { g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); }
        }
        run = [];
      };
      for (let i = i0; i <= i1; i += step) {
        const hh = h[i], dug = h0[i] - hh;
        if (hh < 3 || dug > (kind === 'snow' ? 5 : 3)) { flush(); continue; }
        const k = Math.pow(hh / mh, 1.4), x = (i + 0.5) * cw, y = -hh;
        const th = kind === 'snow' ? 3 + 11 * k + 2.5 * Math.sin(i * 0.9) + (frost ? 4 : 0) : 1.6 + 2.5 * k;
        run.push([x, y - (kind === 'snow' ? 1.2 : -2.5), Math.max(px * 2, th)]);
      }
      flush();
      if (kind === 'mochi') {   // brilho de mochi e bochechas rosadas
        g.fillStyle = 'rgba(255,255,255,.9)';
        for (let i = i0 - (i0 % 23); i <= i1; i += 23) { if (h[i] < 30 || h0[i] - h[i] > 3) continue; const x = (i + 0.5) * cw, y = -h[i] + 8 + (i % 3) * 4; g.beginPath(); g.ellipse(x, y, 7, 2.2, -0.3, 0, 6.3); g.fill(); }
      }
    } else if (kind === 'ash') {
      g.strokeStyle = 'rgba(70,62,60,.55)'; g.lineWidth = Math.max(1.2 * px, 3);
      g.beginPath(); let on = false;
      for (let i = i0; i <= i1; i += step) { const hh = h[i]; if (hh < 3 || h0[i] - hh > 6) { on = false; continue; } const x = (i + 0.5) * cw, y = -hh + 2; if (!on) { g.moveTo(x, y); on = true; } else g.lineTo(x, y); }
      g.stroke();
      // fumaça saindo do topo (cratera)
      const pk = heap.peak ? heap.peak() : null;
      if (pk && pk.x > v.x0 - 600 && pk.x < v.x1 + 600) {
        const er = ev && ev.erupt ? 1 : 0;
        for (let i = 0; i < (er ? 10 : 5); i++) { const q = (t * (er ? 0.4 : 0.18) + i / (er ? 10 : 5)) % 1; g.globalAlpha = (er ? 0.7 : 0.4) * (1 - q); g.fillStyle = er && q < 0.3 ? '#9A8A80' : '#D8D2CA'; g.beginPath(); g.arc(pk.x + Math.sin(i * 2 + t) * 30 + q * 120, -pk.h - 20 - q * (er ? 520 : 300), 30 + q * (er ? 120 : 70), 0, 6.3); g.fill(); }
        g.globalAlpha = 1;
      }
    } else if (kind === 'sand') {
      g.strokeStyle = 'rgba(214,180,110,.55)'; g.lineWidth = Math.max(px, 2.2);
      for (const off of [7, 15]) {
        g.beginPath(); let on = false;
        for (let i = i0; i <= i1; i += step) { const hh = h[i]; if (hh < off + 4 || h0[i] - hh > 6 || ((i / 12 | 0) + off) % 3 === 0) { on = false; continue; } const x = (i + 0.5) * cw, y = -hh + off + Math.sin(i * 0.3) * 1.5; if (!on) { g.moveTo(x, y); on = true; } else g.lineTo(x, y); }
        g.stroke();
      }
    }
    g.restore();
  }

  /* ================= ar: partículas em tela ================= */
  const AIR = Array.from({ length: 200 }, (_, i) => ({ x: hash(i, 1), y: hash(i, 2), s: 0.5 + hash(i, 3), p: hash(i, 4) * 6.3, d: 0.4 + hash(i, 5) * 0.6 }));
  function air(g, W, H, cam, t, S) {
    const sc = prof(), ev = evNow(); if (!sc) return;
    const kind = (ev && ev.air) || sc.air; if (!kind) return;
    const L = lightOf(S), mx = cam.mx || 1, n = Math.min(AIR.length, Math.round((sc.airN || 50) * (ev && ev.air ? (kind === 'snow' ? 2.2 : 1.8) : 1)));
    const camOff = cam.x * cam.z * 0.6 * mx, wind = ev && ev.frost ? 160 : 0;
    g.save();
    for (let i = 0; i < n; i++) {
      const a = AIR[i], dep = a.d;
      let vx = 0, vy = 0, sway = 0;
      if (kind === 'snow') { vy = 34 + 30 * dep; vx = -8 - wind * dep; sway = 14; }
      else if (kind === 'ash') { vy = 18 + 16 * dep; vx = 10; sway = 6; }
      else if (kind === 'petals') { vy = 26 + 16 * dep; vx = 22; sway = 18; }
      else if (kind === 'spray') { vy = -10 - 8 * dep; vx = 6; sway = 4; }
      const x = (((a.x * (W + 80) + vx * t - camOff * dep) % (W + 80)) + W + 80) % (W + 80) - 40 + Math.sin(t * 1.3 + a.p) * sway;
      const y = (((a.y * (H + 60) + vy * t) % (H + 60)) + H + 60) % (H + 60) - 30;
      if (kind === 'snow') { g.globalAlpha = 0.85; g.fillStyle = '#FFFFFF'; const r = (1.2 + 2.2 * a.s * dep); g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
      else if (kind === 'ash') { g.globalAlpha = 0.6; g.fillStyle = i % 7 === 0 ? '#F08A3A' : '#6E6662'; g.fillRect(x, y, 1.5 + a.s * 1.5, 1.5 + a.s); }
      else if (kind === 'petals') {
        g.globalAlpha = 0.9; g.fillStyle = i % 5 === 0 ? '#FFFFFF' : i % 2 ? '#F6B6C8' : '#F29CB4';
        g.beginPath(); if (i % 9 === 0) g.arc(x, y, 3.4 * a.s, 0, 6.3); else g.ellipse(x, y, 3.2 * a.s, 1.6 * a.s, t * 2 + a.p, 0, 6.3); g.fill();
      } else if (kind === 'spray') {   // brilhinhos de sol no ar do mar
        const tw = Math.sin(t * 3 + a.p); if (tw < 0.4) continue; g.globalAlpha = (tw - 0.4) * 1.4; g.fillStyle = '#FFFFFF'; const r = 1 + 2 * a.s * dep;
        g.fillRect(x - r, y, r * 2 + 1, 1); g.fillRect(x, y - r, 1, r * 2 + 1);
      }
    }
    g.globalAlpha = 1;
    if (kind === 'spray') for (let i = 0; i < 3; i++) {   // gaivotas grandes
      const x = ((t * (40 + i * 12) + i * 400) % (W + 200)) - 100, y = 70 + i * 34 + Math.sin(t * 2.5 + i) * 8, f = Math.sin(t * 7 + i) * 5;
      g.strokeStyle = LINE; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 14, y - f); g.quadraticCurveTo(x - 6, y - 8, x, y); g.quadraticCurveTo(x + 6, y - 8, x + 14, y - f); g.stroke();
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 1; g.stroke();
    }
    if (ev && ev.frost) { g.fillStyle = 'rgba(200,230,255,.16)'; g.fillRect(0, 0, W, H); }
    else if (ev && ev.erupt) { g.fillStyle = 'rgba(255,140,60,.10)'; g.fillRect(0, 0, W, H); }
    void L;
    g.restore();
  }


  /* ================= mapa do Japão (cutscene e painel das ilhas) =================
     japan(g, x, y, w, h, {t, lit:[0..1 por ilha], state(i)->'locked'|'open'|'here'|'done', sel, medal(i)->0..3, names, pal})
     devolve os nós em coordenadas do desenho [{x, y, r}] pra clique. */
  const SHP = {
    honshu: [[0.33, 0.66], [0.42, 0.62], [0.5, 0.6], [0.58, 0.55], [0.63, 0.48], [0.66, 0.4], [0.7, 0.32], [0.73, 0.27], [0.77, 0.29], [0.76, 0.37], [0.73, 0.45], [0.7, 0.53], [0.65, 0.59], [0.58, 0.65], [0.5, 0.69], [0.42, 0.71], [0.35, 0.73], [0.31, 0.7]],
    hokkaido: [[0.71, 0.15], [0.74, 0.08], [0.8, 0.05], [0.87, 0.09], [0.88, 0.14], [0.83, 0.18], [0.78, 0.22], [0.73, 0.22]],
    kyushu: [[0.22, 0.68], [0.28, 0.66], [0.31, 0.71], [0.29, 0.8], [0.24, 0.81], [0.2, 0.75]],
    shikoku: [[0.36, 0.74], [0.44, 0.72], [0.46, 0.76], [0.38, 0.78]],
  };
  function blob(g, pts, x, y, w, h) { g.beginPath(); const P = pts.map(p => [x + p[0] * w, y + p[1] * h]); g.moveTo((P[0][0] + P[P.length - 1][0]) / 2, (P[0][1] + P[P.length - 1][1]) / 2); for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } g.closePath(); }
  function japan(g, x, y, w, h, o) {
    o = o || {}; const t = o.t || 0, D = G.Data, IS = D.ISLANDS, st = o.state || (() => 'open'), lit = o.lit;
    const nodes = [];
    g.save();
    if (o.bg !== false) { const sea = g.createLinearGradient(0, y, 0, y + h); sea.addColorStop(0, '#7FC6E8'); sea.addColorStop(1, '#4C9ED0'); g.fillStyle = sea; g.fillRect(x, y, w, h); }
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) { const wx = x + ((hash(i, 7) * w + t * 8) % w), wy = y + hash(i, 8) * h; g.beginPath(); g.moveTo(wx - 7, wy); g.quadraticCurveTo(wx - 3, wy - 3, wx, wy); g.quadraticCurveTo(wx + 3, wy - 3, wx + 7, wy); g.stroke(); }
    // rota do barco (tracejada) na ordem das ilhas
    g.setLineDash([6, 7]); g.lineDashOffset = -t * 12; g.strokeStyle = 'rgba(255,248,236,.9)'; g.lineWidth = 2.5;
    g.beginPath();
    for (let i = 0; i < IS.length - 1; i++) {
      const a = IS[i].map, b = IS[i + 1].map, ax = x + a[0] * w, ay = y + a[1] * h, bx = x + b[0] * w, by = y + b[1] * h;
      if (i === 0) g.moveTo(ax, ay);
      const cx = (ax + bx) / 2 + (by - ay) * 0.35, cy = (ay + by) / 2 - (bx - ax) * 0.35;
      g.quadraticCurveTo(cx, cy, bx, by);
    }
    g.stroke(); g.setLineDash([]);
    const landOf = (i, base) => { const s = st(i); return s === 'locked' ? '#8E98AA' : base; };
    const lk = i => (lit ? U.clamp(lit[i] || 0, 0, 1) : 1);
    const glow = (i, px, py, r) => { const k = lk(i); if (k <= 0 || k >= 1) return; g.globalAlpha = (1 - k) * 0.8; g.fillStyle = '#FFF3B0'; g.beginPath(); g.arc(px, py, r * (1 + 2 * (1 - k)), 0, 6.3); g.fill(); g.globalAlpha = 1; };
    g.lineJoin = 'round';
    const drawLand = (i, pts) => {
      const k = lk(i); g.globalAlpha = 0.35 + 0.65 * k;
      g.fillStyle = 'rgba(40,60,80,.25)'; blob(g, pts, x + 3, y + 4, w, h); g.fill();
      g.fillStyle = landOf(i, IS[i].land); blob(g, pts, x, y, w, h); g.fill(); g.strokeStyle = LINE; g.lineWidth = 2.5; g.stroke();
      g.globalAlpha = 1;
    };
    g.fillStyle = '#9CC57A'; blob(g, SHP.shikoku, x, y, w, h); g.fill(); g.strokeStyle = LINE; g.lineWidth = 2; g.stroke();
    drawLand(0, SHP.honshu); drawLand(1, SHP.hokkaido); drawLand(2, SHP.kyushu);
    // Fuji, neve, vulcão: miniaturas em cima das ilhas
    const mini = (i, fn) => { if (st(i) !== 'locked' && lk(i) > 0.3) fn(); };
    mini(0, () => { const fx = x + 0.6 * w, fy = y + 0.56 * h; Draw.poly(g, [[fx - 14, fy], [fx - 3, fy - 16], [fx + 3, fy - 16], [fx + 14, fy]], '#6F86B8', { ol: 1.5 }); Draw.poly(g, [[fx - 6, fy - 9], [fx - 3, fy - 16], [fx + 3, fy - 16], [fx + 6, fy - 9]], '#FFFFFF', { ol: 0 }); });
    mini(1, () => { for (let k = 0; k < 3; k++) { const px = x + (0.76 + k * 0.035) * w, py = y + 0.15 * h; Draw.poly(g, [[px - 6, py + 4], [px, py - 9], [px + 6, py + 4]], '#3E5E4C', { ol: 1 }); } });
    mini(2, () => { const px = x + 0.255 * w, py = y + 0.745 * h; Draw.poly(g, [[px - 11, py + 4], [px - 3, py - 8], [px + 3, py - 8], [px + 11, py + 4]], '#6E5E58', { ol: 1.5 }); for (let k = 0; k < 3; k++) { const q = (t * 0.4 + k / 3) % 1; g.globalAlpha = 0.6 * (1 - q); Draw.circle(g, px + q * 8, py - 12 - q * 16, 3 + q * 5, '#E0D8D0', { ol: 0 }); } g.globalAlpha = 1; });
    // Okinawa: correntinha de ilhotas com palmeira
    { const k = lk(3); g.globalAlpha = 0.35 + 0.65 * k; for (let j = 0; j < 4; j++) { const px = x + (0.15 - j * 0.03) * w, py = y + (0.86 + j * 0.025) * h; g.fillStyle = landOf(3, IS[3].land); g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.ellipse(px, py, (j === 1 ? 0.03 : 0.018) * w, 0.016 * h + 3, -0.4, 0, 6.3); g.fill(); g.stroke(); } g.globalAlpha = 1;
      mini(3, () => { const px = x + 0.115 * w, py = y + 0.885 * h; g.strokeStyle = '#8A5A2A'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py); g.lineTo(px + 3, py - 12); g.stroke(); g.fillStyle = '#3E8A44'; for (let a = 0; a < 4; a++) { g.beginPath(); g.ellipse(px + 3 + Math.cos(a * 1.6) * 5, py - 13 + Math.sin(a * 1.6) * 2, 6, 2.2, a * 1.6, 0, 6.3); g.fill(); } }); }
    // Ilha de Mochi: flutua no céu do mapa, com nuvem embaixo
    { const k = lk(4), bob = Math.sin(t * 1.4) * 3, px = x + 0.2 * w, py = y + 0.19 * h + bob, rw = 0.075 * w;
      g.globalAlpha = 0.35 + 0.65 * k;
      g.fillStyle = 'rgba(255,255,255,.85)'; for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(px - rw * 0.8 + j * rw * 0.55, py + rw * 0.55, rw * 0.32, 0, 6.3); g.fill(); }
      g.fillStyle = landOf(4, IS[4].land); g.strokeStyle = LINE; g.lineWidth = 2.5; g.beginPath(); g.moveTo(px - rw, py); g.quadraticCurveTo(px - rw * 0.3, py + rw * 0.9, px + rw * 0.2, py + rw * 0.6); g.quadraticCurveTo(px + rw * 0.7, py + rw * 0.4, px + rw, py); g.quadraticCurveTo(px, py - rw * 0.35, px - rw, py); g.closePath(); g.fill(); g.stroke();
      g.globalAlpha = 1;
      mini(4, () => { Draw.circle(g, px - rw * 0.35, py - 6, 6, '#F29CB4', { ol: 1.2 }); Draw.circle(g, px + rw * 0.3, py - 4, 5, '#FFF6F4', { ol: 1.2 }); }); }
    // nós
    for (let i = 0; i < IS.length; i++) {
      const I = IS[i], px = x + I.map[0] * w, py = y + I.map[1] * h, s = st(i), r = Math.max(10, w * 0.022);
      nodes.push({ x: px, y: py, r: r * 2.2, i });
      glow(i, px, py, r * 2);
      if (lk(i) <= 0.05) continue;
      const sel = o.sel === i;
      if (sel) { g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5); Draw.circle(g, px, py, r * 1.9, '#FFF3B0', { ol: 0 }); g.globalAlpha = 1; }
      Draw.circle(g, px, py, r, s === 'locked' ? '#5E6678' : s === 'done' ? PAL.red : s === 'here' ? PAL.gold : '#FFF8EC', { ol: 2 });
      if (s === 'locked') Draw.text(g, '?', px, py + 1, { size: r * 1.3, col: '#FFF8EC', sw: 0.01 });
      else if (s === 'done') Draw.text(g, '済', px, py + 1, { size: r * 1.1, col: '#FFF8EC', sw: 0.01 });
      else Draw.text(g, String(i + 1), px, py + 1, { size: r * 1.1, col: LINE, sw: 0.01 });
      const md = o.medal ? o.medal(i) : 0;
      if (md > 0) { const mc = ['', '#C98A4A', '#C9D2DC', '#F3C94A'][md]; Draw.circle(g, px + r * 0.9, py - r * 0.9, r * 0.5, mc, { ol: 1.5 }); }
      if (o.names !== false && s !== 'locked') Draw.text(g, I.n.replace('Ilha Flutuante de ', 'Ilha de '), px, py + r * 2 + 4, { size: Math.max(11, r * 0.95), col: '#FFF8EC', sw: 4 });
      if (s === 'here') E.drawShiba(g, px, py - r - 2 - Math.abs(Math.sin(t * 4)) * 8, 'wag', t, { scale: Math.max(1, r / 9), pal: (G.S && G.S.look && G.S.look.pal) || 'kome' });
    }
    g.restore();
    return nodes;
  }

  G.Scenery = { profile: prof, skyTint, far, near, palm, yard, rulerTree, snowy, roofSnow, toriiSnow, groundCols, crest, air, FAR, YARD, japan };
})();
