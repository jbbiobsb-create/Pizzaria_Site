/* Kome no Japão — game-world.js
   Cenário do mundo persistente: fundo em camadas (céu, Fuji, morros), chão, a "régua do mundo" (objetos de referência
   fixos no pátio), a casa em estágios, os adereços que cada nó da árvore acrescenta e o coletor de arroz.
   Só desenha: não muda estado de jogo. Depende de core, pix, shiba, nature (opcional) e das máquinas (G.Scale).
   Ponto de extensão (Fase 2): G.World.props.push({node|when(S), x, draw(g, x, t, S)}) acrescenta adereços;
   G.World.layers.back / .front são listas de fn(g, view, t, S) chamadas atrás e na frente da montanha. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, PAL = E.PAL, Draw = E.Draw, N = E.Nature || null, LINE = E.LINE_CSS;
  // largura lógica vem do jogo (960 a 1280 conforme a tela); antes era fixa em 960 e o céu ficava cortado em tela larga
  let W = 960, H = 540;
  const mixc = {};
  const mix = (a, b, t) => mixc[a + b + t] || (mixc[a + b + t] = U.mixCss(a, b, t));
  const SOIL = '#C7A26A', SOIL_D = '#A8834F';

  /* posições fixas (x de mundo) dos objetos de referência: crescem da montanha pra esquerda */
  const X = { casinha: 1560, barraca: 1440, sakura: 1320, torii: 1180, poste: 1060, vila: 930, torre: 760, fabrica: 480, casa: 170, silo: 1650 };

  const clouds = N && N.clouds ? N.clouds(7, { n: 7 }) : null;
  const birds = N && N.birds ? N.birds(3, { n: 5 }) : null;

  /* ---------- fundo em coordenadas de tela, com parallax ---------- */
  // drawBack(g, cam, t, S): céu, sol, nuvens, Fuji e duas faixas de morros. O Fuji encolhe devagar com o zoom (régua final).
  function drawBack(g, cam, t, S) {
    const gy = Math.min(H + 40, (0 - cam.y) * cam.z + H / 2);       // y de tela do chão
    const hz = U.clamp(gy, H * 0.35, H + 30);
    if (N) {
      N.sky(g, W, H, { tod: S.tod !== undefined ? S.tod : 0.42, t });
      if (N.celestial) N.celestial(g, W, hz - 10, { t, r: 16 });
      if (clouds) clouds.draw(g, W, hz, cam.x * 0.04);
      const fs = 1.1 + 0.9 * Math.sqrt(U.clamp(cam.z / 3, 0, 1));
      N.fuji(g, W * 0.3 - (cam.x - 2000) * 0.012, hz + 2, fs, { t });   // à esquerda, no céu livre (à direita o topo aparecia atrás da montanha e parecia bug)
      if (S.own.m11) drawShip(g, W * 0.2 - cam.x * 0.01, hz - 6, t);
      N.hills(g, W, hz - 4, cam.x * 0.25, { col: PAL.leaf, haze: 0.66, amp: 26 + 10 * cam.z, seed: 3, trees: 0.4, bottom: H, parallax: 0.3 });
      drawCity(g, hz + 2, t, S, cam);
      N.hills(g, W, hz + 6, cam.x * 0.5, { col: PAL.grass, haze: 0.36, amp: 16 + 8 * cam.z, seed: 8, freq: 0.011, trees: 0.25, bottom: H, parallax: 0.3 });
      if (S.own.m8) drawTrainBack(g, hz - 3, t, S, cam);
      if (birds) birds.draw(g, W, hz, cam.x * 0.1);
    } else {
      g.fillStyle = PAL.sky; g.fillRect(0, 0, W, H);
      g.fillStyle = mix(PAL.grassL, PAL.sky, 0.5); g.fillRect(0, hz - 30, W, H);
    }
  }
  // cidade crescendo no fundo (etapa 4): mais prédios conforme a frota, a casa e as montanhas novas; janelas acendem à noite
  // cidade no fundo, no traço do Kome (contorno, 3 tons, telhado de kawara), com névoa de distância.
  // Cresce do meio pra fora conforme frota, casa, montanhas novas e lojas do modo infinito.
  const CITY = (() => {
    const r = E.RNG(77), kinds = ['machiya', 'loja', 'predio', 'machiya', 'loja', 'pagode', 'predio', 'machiya', 'castelo'], o = [];
    for (let i = 0; i < 26; i++) {
      const k = i === 13 ? 'castelo' : i === 9 || i === 18 ? 'pagode' : kinds[(i * 7 + 3) % kinds.length] === 'castelo' ? 'predio' : kinds[(i * 7 + 3) % kinds.length];
      o.push({ x: i * 58 + r.range(-8, 8), k, w: k === 'predio' ? r.range(30, 40) : k === 'loja' ? r.range(30, 38) : r.range(26, 34), h: k === 'predio' ? r.range(50, 84) : r.range(22, 30), c: r.range(0, 1), seed: r.range(0, 1e4) | 0 });
    }
    return o;
  })();
  const CIT = { wall: ['#F3EBDB', '#E4D6BE', '#D6C3A3'], wood: ['#9A6A44', '#7A5034', '#5E3C26'], roof: ['#5C6672', '#46505C', '#343C46'], red: ['#D8574E', '#B8423B', '#93302A'],
    flat: [['#E8B27A', '#D19A63'], ['#9EC1D8', '#7FA5BF'], ['#E8D58A', '#CDB86A'], ['#B9C9A0', '#9DB083']] };
  function drawCity(g, y, t, S, cam) {
    const shops = S.stats && S.stats.run && S.stats.run.shops ? Object.values(S.stats.run.shops).reduce((a, b) => a + (b | 0), 0) : 0;
    const n = Math.min(CITY.length, Math.max(0, S.tool - 3) * 2 + S.house * 2 + ((S.mount || 1) - 1) * 4 + shops + (S.island | 0) * 3);
    if (n <= 0) return;
    const L = N && N.light ? N.light(S.tod || 0.4) : { night: 0 }, night = L.night || 0, haze = 0.32;
    const H3 = c => mix(c, PAL.sky, haze), ink = mix(PAL.line, PAL.sky, 0.45);
    const off = cam.x * 0.18, span = CITY.length * 58;
    const idx = CITY.map((c, i) => i).sort((a, b) => Math.abs(a - 13) - Math.abs(b - 13)).slice(0, n).sort((a, b) => CITY[a].h - CITY[b].h);
    g.save(); g.lineJoin = 'round'; g.lineWidth = 1; g.strokeStyle = ink;
    const box = (x, yy, w, h, c3) => { g.fillStyle = H3(c3[0]); g.fillRect(x, yy, w, h); g.fillStyle = H3(c3[1]); g.fillRect(x + w - 3, yy, 3, h); g.strokeRect(x + 0.5, yy + 0.5, w - 1, h - 1); };
    const roof = (x, yy, w, lip, hgt, c3) => {   // telhado de kawara com beiral curvo
      g.fillStyle = H3(c3[1]); g.beginPath(); g.moveTo(x - lip, yy); g.quadraticCurveTo(x + w * 0.2, yy - hgt * 0.35, x + w * 0.3, yy - hgt); g.lineTo(x + w * 0.7, yy - hgt); g.quadraticCurveTo(x + w * 0.8, yy - hgt * 0.35, x + w + lip, yy); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = H3(c3[0]); g.fillRect(x + w * 0.3, yy - hgt, w * 0.4, 2);
    };
    const win = (x, yy, w, h, lit) => { g.fillStyle = lit ? 'rgba(255,214,120,' + (0.6 + 0.35 * night) + ')' : H3('#8FB0C8'); g.fillRect(x, yy, w, h); };
    for (const i of idx) {
      const c = CITY[i]; let x = Math.round(((c.x - off) % span + span) % span - 60);
      if (x > W + 70 || x < -80) continue;
      const lit = k => night > 0.15 && ((c.seed + k * 37) % 7) < 5;
      if (c.k === 'machiya') {
        box(x, y - c.h, c.w, c.h, CIT.wall);
        g.fillStyle = H3(CIT.wood[1]); for (let k = x + 4; k < x + c.w - 4; k += 5) g.fillRect(k, y - c.h + 6, 2, c.h - 10);   // treliça de madeira
        roof(x, y - c.h, c.w, 4, 9, CIT.roof);
      } else if (c.k === 'loja') {
        box(x, y - c.h, c.w, c.h, CIT.wall);
        const nc = c.c < 0.5 ? CIT.red : [ '#3F6FA8', '#335C8C', '#284A72' ];
        g.fillStyle = H3(nc[0]); g.fillRect(x + 3, y - c.h + 6, c.w - 6, 8); g.strokeRect(x + 3.5, y - c.h + 6.5, c.w - 7, 7);   // noren
        g.fillStyle = H3(nc[2]); for (let k = x + 8; k < x + c.w - 4; k += 7) g.fillRect(k, y - c.h + 6, 1, 8);
        win(x + 5, y - c.h + 16, c.w - 10, 6, lit(1));
        roof(x, y - c.h, c.w, 3, 7, CIT.roof);
        const sw = Math.sin(t * 2 + c.seed) * 1.2;   // lanterna vermelha balançando
        g.fillStyle = H3(night > 0.15 ? '#FF8A5C' : CIT.red[0]); g.beginPath(); g.ellipse(x + c.w + 2 + sw, y - c.h + 12, 2.5, 3.5, 0, 0, 6.3); g.fill(); g.stroke();
      } else if (c.k === 'predio') {
        const fc = CIT.flat[c.seed % 4];
        box(x, y - c.h, c.w, c.h, [fc[0], fc[1]]);
        for (let wy = y - c.h + 5, row = 0; wy < y - 8; wy += 9, row++) {
          for (let wx = x + 4, k = 0; wx < x + c.w - 6; wx += 8, k++) win(wx, wy, 4, 4, lit(row * 5 + k));
          g.fillStyle = H3('#EDE7DA'); g.fillRect(x + 2, wy + 5, c.w - 4, 1);   // varandinha
        }
        g.fillStyle = H3(CIT.roof[2]); g.fillRect(x - 1, y - c.h - 2, c.w + 2, 3);
        if (c.seed % 3 === 0) { g.fillStyle = H3('#FFFFFF'); g.fillRect(x + c.w - 9, y - c.h - 9, 5, 7); g.strokeRect(x + c.w - 8.5, y - c.h - 8.5, 4, 6); }   // caixa d'água
      } else if (c.k === 'pagode') {
        for (let f = 0; f < 4; f++) { const fw = 26 - f * 4, fx = x + f * 2, fy = y - f * 13; box(fx, fy - 9, fw, 9, CIT.red); roof(fx, fy - 9, fw, 5, 5, CIT.roof); }
        g.fillStyle = H3('#C8A23A'); g.fillRect(x + 12, y - 70, 2, 14);
      } else if (c.k === 'castelo') {
        box(x - 6, y - 14, 46, 14, ['#B7AFA2', '#9E968A']);   // base de pedra
        for (let f = 0; f < 3; f++) { const fw = 36 - f * 9, fx = x - 1 + f * 4.5, fy = y - 14 - f * 14; box(fx, fy - 10, fw, 10, CIT.wall); roof(fx, fy - 10, fw, 5, 6, CIT.roof); win(fx + fw / 2 - 2, fy - 7, 4, 3, lit(f)); }
        g.fillStyle = H3('#D9B34A'); g.fillRect(x + 12, y - 62, 2, 3); g.fillRect(x + 20, y - 62, 2, 3);   // shachihoko dourados
      }
    }
    g.restore();
  }
  function drawShip(g, x, y, t) {
    g.fillStyle = mix(PAL.steelD, PAL.sky, 0.5);
    g.fillRect(x, y - 6, 70, 6); g.fillRect(x + 44, y - 14, 14, 8); g.fillRect(x + 8, y - 10, 30, 4);
  }
  function updateBack(dt) { if (clouds) clouds.update(dt); if (birds) birds.update(dt); }

  /* ---------- chão ---------- */
  // drawGround(g, v): faixa de grama + terra por cima da base da montanha (desenhar DEPOIS de heap.draw)
  function drawGround(g, v, z) {
    const k = 1 / Math.min(1, z + 0.25);
    g.fillStyle = SOIL; g.fillRect(v.x0, 0, v.x1 - v.x0, v.y1 + 10);
    g.fillStyle = PAL.grass; g.fillRect(v.x0, 0, v.x1 - v.x0, 26);
    g.fillStyle = PAL.grassD; g.fillRect(v.x0, 26, v.x1 - v.x0, 3 * k);
    g.fillStyle = PAL.grassL; g.fillRect(v.x0, 0, v.x1 - v.x0, 2.5 * k);
    g.fillStyle = SOIL_D; g.fillRect(v.x0, 44, v.x1 - v.x0, 2 * k);
    g.fillStyle = LINE; g.fillRect(v.x0, -0.6 * k, v.x1 - v.x0, 1.2 * k);
  }

  /* ---------- placeholders de construções (Draw) ---------- */
  /* ---- construções do pátio em pixel art Pixxel (mesmo traço do torii, da árvore e do Kome; máquinas continuam vetor) ----
     Cada uma é um E.sprite (contorno automático + bevel = 3 tons), desenhado em escala inteira K sem suavizar. */
  const SPK = 2, PSPR = E.sprite;
  const pblit = (g, cv, x, k) => { const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; g.drawImage(cv, Math.round(x - cv.width * k / 2), Math.round(-cv.height * k + 2 * k), cv.width * k, cv.height * k); g.imageSmoothingEnabled = sm; };
  const YC = { wood: '#B98A5A', woodD: '#7A5034', woodL: '#D9B07A', red: '#D8574E', redD: '#A8392F', cream: '#F6EEDC', creamD: '#E2D4B8', roof: '#5C6672', roofD: '#3E4650', glass: '#9CC9E2', glassL: '#E8F6FF', ink: '#3B2818', steel: '#9AA6B2', steelD: '#66727F', rust: '#B5523B', gold: '#F3C94A', blue: '#3F78C8' };
  function pwin(P, x, y, w, h, lit) { P.rect(x, y, w, h, YC.woodD); P.rect(x + 1, y + 1, w - 2, h - 2, lit ? YC.gold : YC.glass); if (!lit) { P.line(x + 2, y + h - 3, x + w - 3, y + 2, 1, YC.glassL); } P.rect(x + (w >> 1), y + 1, 1, h - 2, YC.woodD); }
  const sCasinha = () => PSPR('yard/casinha', 34, 26, P => {
    P.rect(4, 11, 22, 14, YC.wood); for (let y = 13; y < 25; y += 3) P.rect(4, y, 22, 1, YC.woodD);
    P.poly([[1, 12], [15, 1], [29, 12]], YC.red); P.rect(1, 11, 28, 2, YC.redD);
    P.rect(11, 15, 8, 10, YC.ink); P.ell(15, 15, 4, 3, YC.ink);
    P.rect(26, 21, 7, 4, YC.blue); P.rect(27, 21, 5, 1, '#F6EEDC');          // tigelinha com ração
    P.bevel(0.28, 0.22);
  });
  const sVila = () => PSPR('yard/vila', 104, 118, P => {
    P.rect(12, 26, 80, 92, YC.cream); P.rect(12, 70, 80, 4, YC.woodD);
    P.poly([[2, 28], [22, 4], [82, 4], [102, 28]], YC.roof); for (let x = 6; x < 100; x += 4) P.line(x, 27, x + (x < 52 ? 6 : -6), 7, 1, YC.roofD);
    P.poly([[6, 72], [14, 64], [90, 64], [98, 72]], YC.roof);
    for (let f = 0; f < 2; f++) for (let i = 0; i < 3; i++) pwin(P, 21 + i * 24, 36 + f * 44, 16, 20, false);
    P.rect(45, 89, 14, 29, YC.wood); P.rect(55, 103, 2, 2, YC.gold);
    P.rect(16, 116, 72, 2, YC.creamD);
    P.bevel(0.25, 0.2);
  });
  const sFabrica = on => PSPR('yard/fabrica' + (on ? '1' : '0'), 162, 244, P => {
    const wall = on ? YC.cream : '#CFC8BC';
    P.rect(130, 2, 17, 50, YC.rust); P.rect(130, 8, 17, 3, YC.redD); P.rect(130, 22, 17, 3, YC.redD);
    P.rect(6, 44, 150, 200, wall); P.rect(2, 38, 158, 9, on ? YC.red : '#8E9198');
    for (let f = 0; f < 6; f++) for (let i = 0; i < 6; i++) pwin(P, 13 + i * 23, 53 + f * 29, 15, 17, on && (f * 7 + i * 3) % 5 === 0);
    P.rect(64, 220, 34, 24, YC.woodD); P.rect(80, 220, 2, 24, '#5E3C26');
    P.rect(46, 24, 70, 15, on ? YC.red : '#9AA0A8'); P.rect(48, 26, 66, 11, on ? '#E8695F' : '#B3B8BF');
    if (on) { for (let k = 0; k < 4; k++) { const ox = 56 + k * 14; P.poly([[ox, 35], [ox + 5, 27], [ox + 10, 35]], '#FFFFFF'); P.rect(ox + 3, 32, 4, 3, YC.ink); } }   // ONIGIRI em 4 bolinhos
    else { for (let k = 0; k < 5; k++) P.rect(54 + k * 11, 29, 7, 5, '#7E848C'); }
    P.bevel(0.22, 0.2);
  });
  const sSilo = f => PSPR('yard/silo' + f, 40, 92, P => {
    P.rect(3, 16, 34, 76, YC.steel); for (let y = 24; y < 92; y += 12) P.rect(3, y, 34, 1, YC.steelD);
    P.poly([[1, 17], [20, 2], [39, 17]], YC.steelD);
    P.rect(16, 28, 8, 50, YC.ink); const hh = Math.round(48 * f / 8) * 8 / 8; P.rect(17, 77 - Math.round(48 * f), 6, Math.round(48 * f), '#FBF8EF');
    P.bevel(0.3, 0.22);
  });
  const sPoste = () => PSPR('yard/poste', 32, 108, P => {
    P.rect(14, 2, 4, 106, YC.woodD); P.rect(2, 6, 28, 3, YC.woodD);
    P.rect(18, 18, 12, 3, YC.steelD); P.ell(28, 22, 3, 3, YC.gold);
    P.bevel(0.3, 0.25);
  });
  const sTorre = () => PSPR('yard/torre', 114, 264, P => {
    const L = 40, R = 74, top = 4, bot = 262;
    P.rect(L, top, 3, bot - top, YC.steelD); P.rect(R - 3, top, 3, bot - top, YC.steelD);
    for (let y = top; y < bot - 20; y += 26) { P.rect(L, y, R - L, 2, YC.steel); P.line(L + 1, y + 1, R - 2, y + 25, 1.4, YC.steel); P.line(R - 2, y + 1, L + 1, y + 25, 1.4, YC.steel); }
    for (let i = 0; i < 3; i++) P.rect(2 + i * 7, 10 + i * 31, 110 - i * 14, 4, YC.steelD);
    P.ell(57, 6, 3, 3, YC.red);
    P.bevel(0.3, 0.22);
  });


  /* ---- adereços das melhorias em pixel art (antes eram caixas em vetor e destoavam da árvore e do torii) ---- */
  const sKakashi = () => PSPR('prop/kakashi', 30, 44, P => {
    P.rect(14, 18, 2, 26, YC.woodD);                                        // estaca
    P.rect(2, 21, 26, 2, YC.woodD);                                         // braços
    P.rect(1, 20, 3, 4, '#D9B85A'); P.rect(26, 20, 3, 4, '#D9B85A');       // palha saindo das mangas
    P.poly([[9, 22], [21, 22], [23, 34], [7, 34]], '#5C7FA8');              // quimono azul
    P.rect(12, 26, 3, 3, '#D8574E'); P.rect(17, 29, 3, 2, '#E8C77A');       // remendos
    P.ell(15, 14, 5, 5, '#E9DCBE'); P.rect(13, 13, 1, 1, YC.ink); P.rect(17, 13, 1, 1, YC.ink); P.rect(14, 16, 3, 1, YC.ink);   // cara de saco
    P.poly([[5, 11], [15, 2], [25, 11]], '#D9B85A'); P.rect(5, 10, 21, 2, '#B8963F');   // chapéu kasa
    P.rect(8, 34, 2, 4, '#D9B85A'); P.rect(20, 34, 2, 4, '#D9B85A');
    P.bevel(0.28, 0.22);
  });
  const sBalanca = f => PSPR('prop/balanca' + f, 32, 22, P => {
    const d = f ? 2 : -2;
    P.rect(14, 4, 3, 18, '#B8963F'); P.rect(10, 19, 11, 3, '#8E6E2A');
    P.line(4, 6 + d, 27, 6 - d, 1.5, '#8E6E2A');
    P.rect(2, 8 + d, 8, 2, YC.gold); P.rect(22, 8 - d, 8, 2, YC.gold);
    P.ell(6, 7 + d, 2, 1.5, '#FBF8EF');
    P.bevel(0.3, 0.22);
  });
  const sEkiben = () => PSPR('prop/ekiben', 72, 42, P => {
    P.rect(1, 34, 70, 8, '#A9A49A'); for (let x = 3; x < 70; x += 9) P.rect(x, 35, 1, 6, '#8C877E');
    P.rect(20, 12, 32, 22, YC.woodL); P.rect(22, 15, 28, 8, '#F6EEDC');
    for (let i = 0; i < 4; i++) { P.rect(23 + i * 7, 16, 5, 6, ['#D8574E', '#F3C94A', '#7FB069', '#F6EEDC'][i]); P.rect(24 + i * 7, 17, 3, 1, '#FFFFFF'); }
    P.rect(18, 2, 36, 9, YC.red);
    P.bevel(0.28, 0.2);
  });
  const sCaixotes = () => PSPR('prop/caixotes', 74, 32, P => {
    const cols = ['#D8574E', '#5BA4D6', '#F3C94A', '#7FB069', '#E8893A'];
    const pos = [[0, 16], [24, 16], [48, 16], [12, 0], [36, 0]];
    pos.forEach(([x, y], i) => { P.rect(x, y, 23, 16, cols[i]); P.rect(x, y + 5, 23, 1, YC.woodD); P.rect(x, y + 10, 23, 1, YC.woodD); P.rect(x + 2, y + 2, 4, 2, '#FFFFFF'); });
    P.bevel(0.28, 0.22);
  });
  const sSake = () => PSPR('prop/sake', 46, 24, P => {
    const barrel = (x, y) => { P.rect(x, y, 14, 12, '#F6EEDC'); P.rect(x, y + 2, 14, 1, '#B8963F'); P.rect(x, y + 9, 14, 1, '#B8963F'); P.ell(x + 7, y + 6, 2.5, 2.5, YC.red); P.rect(x, y, 14, 1, '#E2D4B8'); };
    barrel(1, 12); barrel(16, 12); barrel(31, 12); barrel(9, 0); barrel(24, 0);
    P.bevel(0.3, 0.2);
  });
  const sOutdoor = () => PSPR('prop/outdoor', 112, 152, P => {
    P.rect(53, 62, 6, 90, YC.steelD); P.rect(40, 62, 4, 90, YC.steel); P.rect(68, 62, 4, 90, YC.steel);
    for (let y = 70; y < 150; y += 14) P.line(42, y, 70, y + 12, 1, YC.steelD);
    P.rect(1, 1, 110, 64, YC.gold); P.rect(4, 4, 104, 58, '#FFE9A8'); P.rect(1, 1, 110, 3, '#FFF3C8');
    for (let i = 0; i < 5; i++) P.rect(10 + i * 22, 63, 6, 3, '#CDA23A');   // luzinhas
    P.bevel(0.25, 0.2);
  });
  const sAntena = f => PSPR('prop/antena' + f, 14, 80, P => {
    P.rect(2, 4, 2, 76, YC.steelD); P.rect(10, 4, 2, 76, YC.steelD);
    for (let y = 6; y < 78; y += 8) { P.line(3, y, 11, y + 8, 1, YC.steel); P.rect(3, y, 8, 1, YC.steel); }
    P.ell(7, 3, 2.5, 2.5, f ? '#FF6B6B' : '#7A2A2A');
    P.bevel(0.3, 0.2);
  });
  const sOficina = () => PSPR('prop/oficina', 102, 76, P => {
    P.rect(5, 18, 92, 58, YC.steel); for (let x = 9; x < 96; x += 6) P.rect(x, 20, 1, 56, YC.steelD);
    P.poly([[1, 20], [51, 2], [101, 20]], YC.rust); P.rect(1, 18, 100, 3, '#8E3A2A');
    P.rect(30, 38, 42, 38, '#2E2A28'); for (let y = 42; y < 76; y += 5) P.rect(30, y, 42, 1, '#46403C');   // portão de enrolar
    P.rect(33, 26, 36, 9, YC.gold);
    P.bevel(0.25, 0.2);
  });
  const sLuz = () => PSPR('prop/luz', 26, 128, P => {
    P.rect(10, 8, 2, 120, YC.steelD); P.rect(14, 8, 2, 120, YC.steelD);
    for (let y = 10; y < 126; y += 10) P.line(11, y, 15, y + 10, 1, YC.steel);
    P.rect(1, 1, 24, 8, '#56606E'); P.rect(3, 3, 8, 4, '#FFE7A0'); P.rect(15, 3, 8, 4, '#FFE7A0');
    P.bevel(0.3, 0.2);
  });
  const sMural = () => PSPR('prop/mural', 38, 44, P => {
    P.rect(17, 20, 4, 24, YC.woodD); P.rect(1, 1, 36, 22, YC.woodL); P.rect(1, 1, 36, 2, '#E8C890');
    for (let i = 0; i < 3; i++) { P.rect(4 + i * 11, 5, 8, 12, '#F6EEDC'); P.rect(5 + i * 11, 7, 6, 1, '#B8A57A'); P.rect(5 + i * 11, 9, 5, 1, '#B8A57A'); P.rect(7 + i * 11, 4, 2, 2, YC.red); }
    P.bevel(0.28, 0.2);
  });
  const sMesinha = () => PSPR('prop/mesinha', 18, 12, P => {
    P.rect(1, 5, 16, 2, YC.woodD); P.rect(3, 7, 2, 5, YC.woodD); P.rect(13, 7, 2, 5, YC.woodD);
    P.rect(6, 1, 6, 4, YC.blue); P.rect(7, 1, 4, 1, '#F6EEDC');
    P.bevel(0.3, 0.22);
  });

  // terreno ainda sem casa: estacas, cordinha com bandeirinhas e placa "à venda" (Casa do Kome e cena da noite)
  const sTerreno = () => PSPR('yard/terreno', 120, 46, P => {
    P.rect(2, 40, 116, 4, '#8C6A44'); P.rect(2, 39, 116, 1, '#A9855A');                  // terra marcada
    for (const x of [4, 60, 114]) { P.rect(x, 18, 2, 24, YC.woodD); P.rect(x, 17, 2, 1, YC.woodL); }   // estacas
    for (let x = 6; x < 114; x++) { const y = 20 + Math.round(3 * Math.sin((x % 54) / 54 * Math.PI)); P.set(x, y, '#E8E0CC'); }
    const fl = ['#D8574E', '#F3C94A', '#5BA4D6', '#7FB069'];
    for (let i = 0; i < 10; i++) { const x = 10 + i * 10, y = 21 + Math.round(3 * Math.sin(((x - 6) % 54) / 54 * Math.PI)); P.poly([[x, y], [x + 5, y], [x + 2, y + 5]], fl[i % 4]); }
    P.rect(76, 4, 2, 36, YC.woodD);                                                     // placa
    P.rect(64, 2, 28, 14, YC.cream); P.rect(64, 2, 28, 2, YC.creamD); P.rect(66, 6, 24, 2, YC.red); P.rect(66, 10, 16, 2, YC.red);
    P.bevel(0.28, 0.22);
  });
  function drawPlot(g, x, y, k) {
    const cv = sTerreno(), sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
    g.drawImage(cv, Math.round(x - cv.width * k / 2), Math.round(y - cv.height * k + 2 * k), cv.width * k, cv.height * k); g.imageSmoothingEnabled = sm;
  }
  function casinha(g, x) { pblit(g, sCasinha(), x + 6, SPK); }
  function poste(g, x, t) {
    pblit(g, sPoste(), x + 4, SPK);
    Draw.cable(g, [x - 26, -200], [X.torre + 60, -400], { sag: 46, lw: 1.5 });
    Draw.cable(g, [x + 26, -200], [X.vila - 40, -196], { sag: 12, lw: 1.5 });
    const lit = N && N.light ? N.light(G.S && G.S.tod || 0.4).night : 0;
    if (lit > 0.2) { g.globalAlpha = lit * 0.5; Draw.circle(g, x + 28, -170, 16, '#FFE7A0', { ol: 0 }); g.globalAlpha = 1; }
  }
  function vila(g, x) { pblit(g, sVila(), x, SPK); }
  function torre(g, x) {
    pblit(g, sTorre(), x, SPK);
    Draw.cable(g, [x - 108, -496], [x - 700, -420], { sag: 60, lw: 1.5 });
  }
  function fabrica(g, x, t, S) {
    const on = !!S.own.m5;
    pblit(g, sFabrica(on), x, SPK + 1);
    if (on) for (let i = 0; i < 3; i++) {                       // baforadas em forma de onigiri
      const u = (t * 0.22 + i / 3) % 1, px = x + 113 + Math.sin(u * 5 + i) * 14, py = -720 - u * 170, s = 10 + u * 18;
      g.globalAlpha = 0.85 * (1 - u);
      g.fillStyle = PAL.white; g.beginPath(); g.moveTo(px, py - s); g.lineTo(px + s, py + s * 0.7); g.lineTo(px - s, py + s * 0.7); g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
  }
  function silo(g, x, t, S) {
    const f = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(S.dug * 0.00002 + t * 0.2));
    pblit(g, sSilo(Math.round(f * 8) / 8), x, SPK);
  }

  // popK(S, node): 0..1 do "surgir" de um adereço logo depois da compra (escala com elástico); 1 = já estava lá
  function popK(S, node) {
    if (S.popNode !== node || S.popAt === undefined) return 1;
    const u = (S.time - S.popAt - 0.5) / 0.7; if (u <= 0) return 0; if (u >= 1) return 1;
    return 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2);
  }
  function popDraw(g, x, k, fn) { if (k <= 0) return; if (k === 1) { fn(); return; } g.save(); g.translate(x, 0); g.scale(k, k); g.translate(-x, 0); fn(); g.restore(); }
  /* ---------- a régua do mundo ---------- */
  const RULER = [
    { x: X.fabrica, r: 200, draw: fabrica }, { x: X.torre, r: 160, draw: torre }, { x: X.vila, r: 110, draw: vila },
    { x: X.poste, r: 300, draw: poste },
    { x: X.torii, r: 90, draw: (g, x, t) => { if (N) N.torii(g, x, 0, 2.2, { t }); } },
    { x: X.sakura, r: 80, draw: (g, x, t) => { if (N) N.tree(g, x, 0, { kind: 'sakura', s: 1.5, seed: 4, t }); } },
    { x: X.barraca, r: 70, draw: (g, x, t, S) => {
      if (!N) return;
      if (!S.own.m1) { Draw.box(g, x - 2, -36, 4, 36, PAL.wood, { ol: 1 }); Draw.sign(g, x - 30, -60, 60, 24, 'ALUGA-SE', { col: PAL.cream, ink: PAL.red }); return; }   // ponto vazio até comprar a Barraquinha
      popDraw(g, x, popK(S, 'm1'), () => N.stall(g, x, 0, { t, s: 1.15, col: S.own.m_b ? '#2F4670' : undefined }));
    } },
    { x: X.casinha, r: 50, draw: casinha },
  ];

  /* ---------- adereços que os nós da árvore acrescentam (regra do feedback visual) ---------- */
  const shO = { face: 1, scale: 1, pal: 'goma', shadow: true };
  function sh(g, x, y, pose, t, pal, face, scale) { shO.pal = pal; shO.face = face || 1; shO.scale = scale || 1; E.drawShiba(g, x, y, pose, t, shO); }
  const props = [
    // fila de clientes na barraquinha (m1: 3, m_b: 5) + balança (m_a)
    { node: 'm1', x: X.barraca, draw(g, x, t, S) { const n = S.own.m_b ? 5 : 3; for (let i = 0; i < n; i++) sh(g, x - 60 - i * 26, 6, i % 2 ? 'sit' : 'wag', t + i, ['shiro', 'kuro', 'goma', 'cha', 'aka'][i], 1); } },
    { node: 'm_a', x: X.barraca, draw(g, x, t) { pblit(g, sBalanca(Math.sin(t * 3) > 0 ? 1 : 0), x + 46, SPK); } },
    { node: 'm_c', x: 1250, draw(g, x, t) { if (N && N.nobori) for (let i = 0; i < 5; i++) N.nobori(g, 1000 + i * 150, 0, { t: t + i, col: i % 2 ? PAL.red : '#2F4670' }); } },
    { node: 'm_e', x: 640, draw(g, x) { pblit(g, sEkiben(), x, SPK); Draw.text(g, 'EKIBEN', x, -73, { size: 11, col: PAL.cream, sw: 0, weight: 900 }); } },
    { node: 'm_f', x: 330, draw(g, x) { pblit(g, sCaixotes(), x, SPK); } },
    { node: 'm9', x: 1010, draw(g, x) { pblit(g, sSake(), x - 8, SPK); } },
    { node: 'm10', x: 620, draw(g, x, t) { pblit(g, sOutdoor(), x, SPK + 1); sh(g, x - 70, -326, 'proud', t, 'kome', 1, 2); Draw.text(g, 'KOME', x + 40, -390, { size: 30, col: PAL.red, sw: 5 }); Draw.text(g, 'no Japão', x + 40, -358, { size: 15, col: PAL.red, sw: 0 }); } },
    { node: 'a3', x: 1500, draw(g, x, t) { pblit(g, sKakashi(), x, SPK); } },
    { node: 'a7', x: X.silo, draw: silo },
    { node: 'a9', x: 1700, draw() { /* a esteira agora é desenhada pelo belts.js (E.Conveyor de verdade) */ } },
    { node: 'e3', x: 1610, draw(g, x, t) { sh(g, x, 8, 'point', t, 'cha', 1); } },
    { node: 'e5', x: 1380, draw(g, x, t) { pblit(g, sAntena(Math.sin(t * 4) > 0 ? 1 : 0), x, SPK); } },
    { node: 'e2a', x: 860, draw(g, x) { pblit(g, sOficina(), x, SPK); Draw.text(g, 'OFICINA', x, -91, { size: 13, col: PAL.ink, sw: 0, weight: 900 }); } },
    { node: 'e2b', x: 1120, draw(g, x, t) { for (let i = 0; i < 2; i++) pblit(g, sLuz(), x + i * 420, SPK); } },
    { node: 's6', x: 1270, draw(g, x) { pblit(g, sMural(), x, SPK); } },
    { node: 's11', x: 1385, draw(g, x, t) { pblit(g, sMesinha(), x, SPK); } },
  ];

  // trem de arroz (m8): trilho no fundo, entre os morros e o pátio. Evolui com a frota: vapor → diesel → trem-bala.
  function drawTrainBack(g, yr, t, S, cam) {
    const era = S.tool >= 11 ? 2 : S.tool >= 7 ? 1 : 0, L = PAL.line;
    // trilho com dormentes (parallax 0,5)
    g.fillStyle = mix(PAL.woodD || '#5B3A1E', PAL.sky, 0.35);
    const off = -((cam.x * 0.5) % 14 + 14) % 14;
    for (let x = off; x < W; x += 14) g.fillRect(x, yr - 1, 8, 3);
    g.fillStyle = mix(PAL.steelD || '#555', PAL.sky, 0.3); g.fillRect(0, yr - 3, W, 1.6);
    const period = era === 2 ? 14 : 24, u = (t % period) / period, nCar = era === 2 ? 5 : 4, cw = era === 2 ? 46 : 34, span = nCar * (cw + 4) + 60;
    const x0 = -span + u * (W + span * 2);
    if (x0 - span > W || x0 < -60) return;
    g.save(); g.lineJoin = 'round'; g.lineWidth = 1.2; g.strokeStyle = L;
    const box = (x, y, w, h, c, r) => { g.fillStyle = c; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r || 2) : g.rect(x, y, w, h); g.fill(); g.stroke(); };
    const wheel = (x, c) => { g.fillStyle = c || '#2A2A2E'; g.beginPath(); g.arc(x, yr - 4, 3, 0, 6.3); g.fill(); g.stroke(); };
    // vagões (atrás da locomotiva, que vai na frente à direita)
    for (let i = 1; i <= nCar; i++) {
      const x = x0 - i * (cw + 4);
      if (era === 2) { box(x, yr - 19, cw, 14, '#F4F6F8', 3); g.fillStyle = '#2E64B0'; g.fillRect(x + 1, yr - 10, cw - 2, 2); for (let k = 0; k < 4; k++) { g.fillStyle = '#3A4A66'; g.fillRect(x + 5 + k * 10, yr - 16, 6, 4); } }
      else {
        box(x, yr - 15, cw, 9, era === 0 ? (PAL.wood || '#8B5A2B') : (PAL.steel || '#7A8794'), 2);
        g.fillStyle = PAL.rice; g.beginPath(); g.ellipse(x + cw / 2, yr - 15, cw / 2 - 3, 5, 0, Math.PI, 0); g.fill(); g.stroke();
        wheel(x + 7); wheel(x + cw - 7);
      }
    }
    // locomotiva
    if (era === 0) {
      box(x0, yr - 16, 30, 11, '#2C2C30', 4); box(x0 - 12, yr - 22, 13, 17, '#2C2C30', 2); box(x0 + 22, yr - 22, 5, 7, '#2C2C30', 1);
      g.fillStyle = '#C8423A'; g.fillRect(x0 - 12, yr - 8, 42, 2);
      wheel(x0 - 4, '#C8423A'); wheel(x0 + 8, '#C8423A'); wheel(x0 + 20, '#C8423A');
      for (let k = 0; k < 4; k++) { const q = ((t * 1.6 + k / 4) % 1), r = 3 + q * 7; g.globalAlpha = 0.65 * (1 - q); g.fillStyle = '#EDEDED'; g.beginPath(); g.arc(x0 + 24 - q * 26, yr - 24 - q * 14, r, 0, 6.3); g.fill(); }
      g.globalAlpha = 1;
    } else if (era === 1) {
      box(x0 - 6, yr - 19, 40, 13, '#D8763A', 3); g.fillStyle = '#F3E4C2'; g.fillRect(x0 - 5, yr - 12, 38, 2);
      g.fillStyle = '#3A4A66'; g.fillRect(x0 + 24, yr - 17, 7, 4); wheel(x0); wheel(x0 + 26);
    } else {
      g.fillStyle = '#F4F6F8'; g.beginPath(); g.moveTo(x0 - 4, yr - 19); g.lineTo(x0 + 26, yr - 19); g.quadraticCurveTo(x0 + 52, yr - 14, x0 + 54, yr - 5); g.lineTo(x0 - 4, yr - 5); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#2E64B0'; g.fillRect(x0 - 3, yr - 10, 50, 2); g.fillStyle = '#3A4A66'; g.beginPath(); g.moveTo(x0 + 30, yr - 17); g.lineTo(x0 + 40, yr - 15); g.lineTo(x0 + 30, yr - 13); g.fill();
    }
    g.restore();
  }

  const layers = { back: [], front: [] };

  // drawYard(g, v, t, S): casa, régua, adereços e trem (atrás das máquinas e do Kome)
  function drawYard(g, v, t, S) {
    if (v.x0 > 1900) return;
    if (N && v.x0 < X.casa + 200) {
      if (S.house > 0) N.house(g, X.casa, 0, { stage: S.house - 1, s: 1.5, t });
      else { Draw.box(g, X.casa - 2, -40, 4, 40, PAL.wood, { ol: 1 }); Draw.sign(g, X.casa - 34, -66, 68, 26, 'À VENDA', { col: PAL.cream, ink: PAL.red }); }
    }
    for (let i = 0; i < RULER.length; i++) { const o = RULER[i]; if (o.x + o.r > v.x0 && o.x - o.r < v.x1) o.draw(g, o.x, t, S); }
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (p.node ? !S.own[p.node] : !(p.when && p.when(S))) continue;
      if (p.x + 500 > v.x0 && p.x - 500 < v.x1) { const k = p.node ? popK(S, p.node) : 1; if (k === 1) p.draw(g, p.x, t, S); else popDraw(g, p.x, k, () => p.draw(g, p.x, t, S)); }
    }
    for (let i = 0; i < layers.back.length; i++) layers.back[i](g, v, t, S);
  }

  /* ---------- coletor: pra onde o arroz vai (adendo §9) ---------- */
  // drawCollector(g, col{x,y,kind,fill,pulse}, t, S)
  function drawCollector(g, c, t, S) {
    const k = 1 + 0.18 * (c.pulse || 0), P = G.Props;
    g.save(); g.translate(c.x, c.y); g.scale(k, k);
    if (c.kind === 'saco') {
      const s = P ? P.sack(S.own.s8 ? 'golden' : 'plain') : null;
      if (s) { g.imageSmoothingEnabled = false; g.drawImage(s.cv, -s.ax * 1.4, -s.ay * 1.4, s.cv.width * 1.4, s.cv.height * 1.4); }
    } else if (c.kind === 'kei' && G.Scale && G.Scale.keitruck) G.Scale.keitruck.draw(g, 0, 0, { face: 1, t });
    else if (c.kind === 'moega' && G.Scale && G.Scale.moega) G.Scale.moega.draw(g, 0, 0, { face: 1, t, fill: 0.3 + 0.5 * (c.pulse || 0) });
    else if (c.kind === 'silo') { g.translate(-c.x, 0); silo(g, c.x, t, S); }
    g.restore();
  }

  // pátio mais largo (15/11): estica tudo pra esquerda (a montanha começa em 1800), assim prédios e adereços não se encavalam
  const SP = x => (x < 1700 ? 1800 - (1800 - x) * 1.6 : x);
  RULER.forEach(o => { o.x = SP(o.x); }); props.forEach(p => { p.x = SP(p.x); });
  Object.keys(X).forEach(k => { if (k !== 'silo') X[k] = SP(X[k]); });
  G.World = { setSize(w, h) { W = w; H = h; }, drawPlot, X, RULER, props, layers, drawBack, updateBack, drawGround, drawYard, drawCollector, drawSilo: silo, sh };
})();
