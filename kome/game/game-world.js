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

  /* MUNDO EM DOIS LADOS (docs/design/mundo-dois-lados.md): a MONTANHA separa dois bairros.
     - lado da cava (x < MX0) = ZONA INDUSTRIAL: vagas fixas calculadas pela largura real de cada coisa (layout(S)).
     - lado de lá (x > MX1)   = VILA DO KOME: casa em estágios, torii, sakura, barraca, sobrado... (posições fixas a partir de VB).
     X guarda o x de mundo de tudo; as chaves da zona industrial mudam com a era (layout). */
  const WLD = (G.Data && G.Data.WORLD) || { MX0: 1800, MX1: 8000 };
  const VB = WLD.MX1 + 900;                         // início da vila (a Bagger Gêmea agora mora do lado da cava: o vão entre a montanha e a vila encolheu)
  const X = {
    // vila (fixo)
    sakura: VB + 60, torii: VB + 260, sake: VB + 400, v4: VB + 500, barracaVila: VB + 740, mural: VB + 845, casinhaVila: VB + 925, mesinha: VB + 995,
    casa: VB + 1200, kakashi: VB + 1490, v3: VB + 1620, vila: VB + 1840, poste: VB + 1980, v2: VB + 2080, ekiben: VB + 2230,
    fabrica: VB + 2560, v1: VB + 2880, outdoor: VB + 3140,
    vilaX0: VB, vilaX1: VB + 3370, vilaCx: VB + 1040, lojas0: VB + 3580, lojaStep: 290,
    // lado da cava (layout(S) recalcula). shift = quanto o pátio já andou atrás do pé da montanha (game.js yardTick); mk = escala da Bagger na frente
    casinha: 1716, barraca: 1560, silo: 1320, capataz: 1262, antena: 1230, fab: 0, fabPorta: 0, oficina: 0, lotR: 0, lotL: 0, lotFull: 0, beco: 0,
    caixotes: 0, torre: 0, estatua: 0, keiMin: 1440, x0: 1380, park: {}, shift: 0, mk: 1, need: 0, lane: 420, front: 1800,
    gemea: 0, gemeaK: 0, pilha: 0, tunIn: 0, tunOut: 0,
    minX: -5600, maxX: VB + 3600,                   // limites da câmera (o jogador continua preso ao lado da cava)
  };
  // vagas do estacionamento, da menor pra maior: [id, largura real da máquina]
  const BAYS = [['trator', 152], ['empilhadeira', 150], ['colheita', 170], ['escav', 330], ['caminhao', 352], ['pacabo', 700]];
  const FAB_K = 3, FAB_W = 960, OFI_K = 3, OFI_W = 330, BAY_GAP = 96, ALLEY = 260;
  let laySig = '';
  // tem galpão no pátio? (nó Fábrica de Onigiri, Fábrica aberta ou nível de fábrica do modo infinito)
  const hasFab = S => !!(S.own.m5 || (G.Ind && G.Ind.level && G.Ind.level() > 0));
  /* layout(S): vagas da zona industrial, da montanha pra fora, sem nada em cima de nada:
     frente de lavra (só a máquina ativa + coletor) -> [Bagger Gêmea com o monte de estoque, no modo infinito] -> ESTACIONAMENTO DA
     FROTA -> silo -> galpão KOME PACK -> beco do kei-truck -> Oficina -> ramal.
     TUDO é medido a partir do PÉ DA MONTANHA de agora (X.front = MX0 + X.shift): o pátio anda atrás da frente de lavra (yardTick).
     Largura da frente de lavra (X.lane) = o que a máquina NA MÃO precisa (X.need, game.js yardNeed): a pé 420; cabine =
     distância de trabalho + ela + coletor (trator ~480, escavadeira ~660, pá de cabo ~910); caminhão ou Bagger 293 = 1500
     (também com a Bagger em montagem ou com o Goma); pilotando a Gêmea (1,5x) = 2120. */
  function layout(S) {
    const TI = (G.Data && G.Data.toolIndex) || {};
    const fab = hasFab(S), ofi = !!S.own.e2a, stall = S.tool < (TI.trator || 7);
    let nb = 0; for (const [id] of BAYS) if ((TI[id] || 99) <= S.tool) nb++;
    const gp = S.ended && G.Ind && G.Ind.run ? Math.min(4, G.Ind.run().giant | 0) : 0, mk = X.mk || 1, gk = gp ? (mk > 1 ? 1 : 1.5) : 0;
    const bagHere = !!S.bag || !!S.own.bg1;          // Bagger em montagem ou com o Goma: precisa da frente de lavra inteira
    const sig = nb + '|' + (bagHere ? 1 : 0) + (fab ? 1 : 0) + (ofi ? 1 : 0) + (stall ? 1 : 0) + '|' + gk + '|' + mk + '|' + (X.need | 0) + '|' + Math.round(X.shift * 8);
    if (sig === laySig) return X;
    laySig = sig;
    const F = WLD.MX0 + X.shift;                      // pé da montanha que o pátio está acompanhando
    X.front = F; X.lane = Math.max(420, X.need | 0, bagHere ? 1500 : 0);
    let x0 = F - X.lane;
    // Bagger Gêmea (modo infinito): vaga própria logo atrás da 293, com a roda num monte de estoque que a 293 alimenta
    X.gemeaK = gk;
    if (gk) { X.pilha = x0 - 420; X.gemea = X.pilha - 170 - 590 * gk; x0 = X.gemea - 900 * gk - 90; } else { X.pilha = 0; X.gemea = 0; }
    X.x0 = x0; X.keiMin = stall ? 1440 : F - X.lane + 60;
    X.barraca = stall ? 1560 : X.barracaVila;        // começo do jogo: barraquinha e casinha ficam no gramado de sempre (não andam)
    X.casinha = stall ? 1716 : X.casinhaVila;        // com o Trator o Kome compra o terreno: a casinha de cachorro muda pra vila junto
    // 1) estacionamento: colado na frente de lavra, da menor pra maior (vaga de máquina ainda não comprada não ocupa espaço)
    X.lotR = x0 - 40; let b = X.lotR - 70;
    for (const [id, w] of BAYS) { X.park[id] = b - w / 2; X.park[id + '_L'] = b - w - BAY_GAP / 2; if ((TI[id] || 99) <= S.tool) b -= w + BAY_GAP; }
    X.lotFull = b;
    // 2) silo (com capataz e antena), 3) galpão, 4) beco do kei-truck + Oficina
    let c = nb ? b - 20 : x0;
    X.silo = c - 60; X.antena = c - 112; X.capataz = c - 150; c -= 280;
    // esteira subterrânea: entra num túnel na beira do pátio (perto do coletor) e sai depois do silo, na porta do galpão
    X.tunIn = gk ? x0 + 34 : F - X.lane + 10; X.tunOut = c + 82;
    if (fab) { X.fab = c - 20; X.fabPorta = X.fab; c = X.fab - FAB_W; X.beco = c; } else { X.fab = 0; X.fabPorta = 0; X.beco = 0; }
    const gap = fab ? ALLEY : 20;                    // beco entre o galpão e a Oficina: o kei-truck entra nele (não passa na frente de porta nenhuma)
    X.oficina = c - gap - OFI_W / 2;
    if (ofi || fab) c = X.oficina - OFI_W / 2 - 20;  // com galpão o beco fica reservado mesmo sem Oficina
    X.caixotes = c - 150; X.torre = c - 430; X.estatua = c - 900;
    X.minX = c - 1500;
    for (const p of props) if (p.k) p.x = X[p.k];
    for (const o of RULER) if (o.k) o.x = X[o.k];
    return X;
  }

  const clouds = N && N.clouds ? N.clouds(7, { n: 7 }) : null;
  const birds = N && N.birds ? N.birds(3, { n: 5 }) : null;

  /* ---------- fundo em coordenadas de tela, com parallax ---------- */
  // drawBack(g, cam, t, S): céu, sol, nuvens, Fuji e duas faixas de morros. O Fuji encolhe devagar com o zoom (régua final).
  function drawBack(g, cam, t, S) {
    const gy = Math.min(H + 40, (0 - cam.y) * cam.z + H / 2);       // y de tela do chão
    const hz = U.clamp(gy, H * 0.35, H + 30);
    if (N) {
      const Sc = G.Scenery, sc = Sc ? Sc.profile() : null, far = sc && sc.far && sc.far !== 'fuji';   // cenário da ilha (scenery.js)
      N.sky(g, W, H, { tod: S.tod !== undefined ? S.tod : 0.42, t });
      if (sc) Sc.skyTint(g, W, H, sc, S);
      if (N.celestial) N.celestial(g, W, hz - 10, { t, r: 16 });
      if (clouds && !(sc && sc.far === 'mochi')) clouds.draw(g, W, hz, cam.x * 0.04);
      const fs = 1.1 + 0.9 * Math.sqrt(U.clamp(cam.z / 3, 0, 1));
      if (far) Sc.far(g, W, H, hz, cam, t, S, sc);
      else N.fuji(g, W * 0.3 - (cam.x - 2000) * 0.012, hz + 2, fs, { t });   // à esquerda, no céu livre (à direita o topo aparecia atrás da montanha e parecia bug)
      if (S.own.m11) drawShip(g, W * 0.2 - cam.x * 0.01, hz - 6, t);
      const hc = (sc && sc.hills) || [], tr = (sc && sc.trees) || [0.4, 0.25];
      N.hills(g, W, hz - 4, cam.x * 0.25, { col: hc[0] || PAL.leaf, haze: 0.66, amp: 26 + 10 * cam.z, seed: 3, trees: tr[0], bottom: H, parallax: 0.3 });
      drawCity(g, hz + 2, t, S, cam);
      N.hills(g, W, hz + 6, cam.x * 0.5, { col: hc[1] || PAL.grass, haze: 0.36, amp: 16 + 8 * cam.z, seed: 8, freq: 0.011, trees: tr[1], bottom: H, parallax: 0.3 });
      if (sc) Sc.near(g, W, H, hz, cam, t, S, sc);
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
  const CITY_ART = ['cid_machiya', 'cid_loja', 'cid_sobrado', 'cid_predio', 'cid_loja_azul', 'cid_templo', 'cid_predio2', 'cid_machiya', 'cid_loja', 'cid_sobrado', 'cid_predio2', 'cid_loja_azul', 'cid_predio'];
  function drawCity(g, y, t, S, cam) {
    // cada bairro tem o SEU horizonte: cidadezinha fofa (pagode, castelo, casinhas) só atrás da VILA; atrás da cava, zona industrial
    // em névoa (chaminés, guindastes, tanques, torres de energia, contêineres). vk 0..1 = quanto a câmera já passou pro lado da vila.
    const vk = U.clamp((cam.x - (X.vilaX0 - 1500)) / 1000, 0, 1);
    if (vk < 1) drawIndustry(g, y, t, S, cam, 1 - vk);
    if (vk <= 0) return;
    const shops = S.stats && S.stats.run && S.stats.run.shops ? Object.values(S.stats.run.shops).reduce((a, b) => a + (b | 0), 0) : 0;
    const n = Math.min(26, Math.max(0, S.tool - 3) * 2 + S.house * 2 + ((S.mount || 1) - 1) * 4 + shops + (S.island | 0) * 3);
    if (n <= 0 || !E.Assets || !E.Assets.ready || !E.Assets.ready('cid_machiya')) return;
    const span = 26 * 46, off = cam.x * 0.18;
    // ordem de crescimento: do meio pra fora; o castelo aparece no centro quando a cidade fica grande
    const idx = Array.from({ length: 26 }, (_, i) => i).sort((a, b) => Math.abs(a - 13) - Math.abs(b - 13)).slice(0, n).sort((a, b) => (a * 7) % 5 - (b * 7) % 5);
    g.save(); g.globalAlpha = vk;
    try { g.filter = 'saturate(0.75) brightness(1.06) contrast(0.85)'; } catch (e) { /* névoa de distância */ }
    for (const i of idx) {
      const x = ((i * 46 - off) % span + span) % span - 60; if (x > W + 80 || x < -90) continue;
      const id = i === 13 && n > 14 ? 'cid_castelo' : CITY_ART[(i * 5) % CITY_ART.length];
      art(g, id, x, 0.55, y);
    }
    g.restore();
  }
  /* horizonte da ZONA INDUSTRIAL (lado da cava): silhuetas em 3 tons de névoa, tingidas pelo céu da ilha, crescendo com a frota
     (nada antes do Trator: o começo do jogo é só gramado). Desenhado na tela pequena do fundo (vira pixel sozinho): por isso
     tudo em múltiplos de 3. Fumaça lenta nas chaminés, fios com barriga entre as torres, luzinha vermelha de noite. */
  const IND = (() => {
    const r = E.RNG(311), kinds = ['cham', 'galpao', 'torre', 'tanque', 'guind', 'cont', 'cham', 'silo', 'torre', 'galpao', 'esfera', 'guind', 'cham', 'torre', 'cont', 'galpao', 'tanque', 'cham', 'torre', 'silo', 'guind', 'esfera', 'cont', 'torre'], o = [];
    for (let i = 0; i < kinds.length; i++) o.push({ k: kinds[i], x: i * 84 + r.range(-12, 12), s: r.range(0.85, 1.25), q: r() });
    return o;
  })();
  const IND_ORDER = Array.from({ length: IND.length }, (_, i) => i).sort((a, b) => ((a * 11) % 24) - ((b * 11) % 24));
  function drawIndustry(g, y, t, S, cam, al) {
    const TI = (G.Data && G.Data.toolIndex) || {}, n = Math.min(IND.length, Math.max(0, S.tool - (TI.trator || 7) + 1) * 4 + (S.own.m5 ? 2 : 0) + (S.ended ? 4 : 0));
    if (n <= 0) return;
    const sc = G.Scenery ? G.Scenery.profile() : null, tint = (sc && sc.sky && sc.sky[1]) || '#CFE3F2';
    const A = mix('#77879A', tint, 0.3), B = mix('#9FAEBE', tint, 0.38), C = mix('#5C6B7C', tint, 0.24), SM = mix('#FFFFFF', tint, 0.3), K = 1.4;
    let ox = 0;
    const night = isNight(), span = IND.length * 84, off = cam.x * 0.18;
    const q3 = v => Math.round(v / 3) * 3, R = (x, yy, w, h, c) => { g.fillStyle = c; g.fillRect(q3(ox + (x - ox) * K), q3(y + (yy - y) * K), Math.max(3, q3(w * K)), Math.max(3, q3(h * K))); };
    const on = new Array(IND.length).fill(false); for (let k = 0; k < n; k++) on[IND_ORDER[k]] = true;
    const sx = i => ((IND[i].x - off) % span + span) % span - 90;
    g.save(); g.globalAlpha = al;
    // fios entre torres vizinhas (barriga de catenária em degraus de pixel)
    let prev = -1;
    for (let i = 0; i < IND.length; i++) {
      if (!on[i] || IND[i].k !== 'torre') continue;
      if (prev >= 0) { const x0 = sx(prev), x1 = sx(i); if (x1 > x0 && x1 - x0 < 520 && x1 > -20 && x0 < W + 20) for (const hy of [51 * K, 39 * K]) { g.fillStyle = C; for (let x = x0; x <= x1; x += 3) { const u = (x - x0) / (x1 - x0); g.fillRect(q3(x), q3(y - hy * (IND[prev].s * (1 - u) + IND[i].s * u) + 36 * u * (1 - u)), 3, 3); } } }
      prev = i;
    }
    for (let i = 0; i < IND.length; i++) {
      if (!on[i]) continue;
      const o = IND[i], x = sx(i), s = o.s; if (x > W + 90 || x < -90) continue;
      ox = x;
      if (o.k === 'cham') {
        const h = 57 * s;
        R(x - 4.5, y - h, 9, h, A); R(x - 6, y - h, 12, 3, C); R(x - 4.5, y - h + 9, 9, 3, B); R(x - 4.5, y - h + 18, 9, 3, B); R(x + 1.5, y - h + 3, 3, h - 3, B);
        R(x - 15, y - 12, 30, 12, A); R(x - 15, y - 12, 30, 3, B);
        for (let k = 0; k < 4; k++) { const u = (t * 0.07 + k / 4 + o.q) % 1, r = 6 + u * 12; g.globalAlpha = al * 0.75 * (1 - u); R(x + u * 30 - r / 2 + Math.sin(u * 6 + k) * 3, y - h - 6 - u * 36 - r / 2, r, r * 0.75, SM); }
        g.globalAlpha = al; if (night && Math.sin(t * 2 + i) > 0) R(x - 1.5, y - h - 3, 3, 3, '#FF6B5E');
      } else if (o.k === 'galpao') {
        R(x - 27, y - 21 * s, 54, 21 * s, A); for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) R(x - 27 + k * 18, y - 21 * s - 3 - j * 3, 18 - j * 6, 3, j ? A : C);
        for (let k = 0; k < 5; k++) R(x - 24 + k * 10.5, y - 12 * s, 6, 3, night ? '#FFE3A0' : B);
        R(x - 6, y - 9, 12, 9, C);
      } else if (o.k === 'tanque') {
        R(x - 15, y - 24 * s, 30, 24 * s, A); R(x - 12, y - 24 * s - 3, 24, 3, A); R(x - 15, y - 15 * s, 30, 3, C); R(x - 15, y - 24 * s, 6, 24 * s, B); R(x + 9, y - 24 * s - 3, 3, 24 * s + 3, C);
      } else if (o.k === 'esfera') {
        const r = 12 * s; g.fillStyle = A; g.beginPath(); g.arc(q3(x), q3(y - (r + 9) * K), r * K, 0, 6.3); g.fill(); g.fillStyle = B; g.beginPath(); g.arc(q3(x) - r * 0.3 * K, q3(y - (r + 9) * K) - r * 0.3 * K, r * 0.45 * K, 0, 6.3); g.fill();
        R(x - r + 1.5, y - 12, 3, 12, C); R(x + r - 4.5, y - 12, 3, 12, C); R(x - 1.5, y - 9, 3, 9, C); R(x - r, y - r - 9, r * 2, 1.5, C);
      } else if (o.k === 'guind') {
        const h = 45 * s;
        R(x - 21, y - h, 3, h, A); R(x + 18, y - h, 3, h, A); R(x - 30, y - h - 3, 63, 6, A); R(x - 30, y - h - 3, 63, 1.5, B);
        for (let k = 0; k < 4; k++) { R(x - 18 + k * 3, y - h + 6 + k * 3, 3, 3, C); R(x + 15 - k * 3, y - h + 6 + k * 3, 3, 3, C); }
        const tx = x - 12 + 18 * Math.sin(t * 0.12 + o.q * 6); R(tx, y - h + 3, 9, 4.5, C); R(tx + 3, y - h + 6, 1.5, 15, C); R(tx, y - h + 21, 9, 6, B);
        if (night) R(x - 30, y - h - 6, 3, 3, '#FF6B5E');
      } else if (o.k === 'torre') {
        const h = 57 * s;
        for (let k = 0; k < 6; k++) { R(x - 7.5 + k * 1.2, y - (k + 1) * h / 6, 3, h / 6, A); R(x + 4.5 - k * 1.2, y - (k + 1) * h / 6, 3, h / 6, A); if (k % 2) R(x - 6 + k, y - (k + 1) * h / 6, 12 - k * 2, 1.5, C); }
        R(x - 15, y - h * 0.9, 30, 3, A); R(x - 10.5, y - h * 0.68, 21, 3, A); R(x - 1.5, y - h - 6, 3, 9, A);
      } else if (o.k === 'cont') {
        const cs = [mix('#B5746A', tint, 0.5), mix('#6F8FB0', tint, 0.5), mix('#86A27C', tint, 0.5), A];
        for (let j = 0; j < 3; j++) for (let k = 0; k < 3 - (j > 1 ? 1 : 0); k++) { const c = cs[(i + j * 2 + k) % 4]; R(x - 24 + k * 16.5 + (j > 1 ? 9 : 0), y - (j + 1) * 7.5, 15, 6, c); R(x - 24 + k * 16.5 + (j > 1 ? 9 : 0), y - (j + 1) * 7.5 + 4.5, 15, 1.5, C); }
      } else if (o.k === 'silo') {
        for (let k = 0; k < 3; k++) { const h = (27 + k * 4.5) * s, xx = x - 16.5 + k * 12; R(xx, y - h, 9, h, A); R(xx + 1.5, y - h - 3, 6, 3, A); R(xx + 3, y - h - 6, 3, 3, C); R(xx, y - h, 3, h, B); }
        R(x - 18, y - 21 * s, 36, 1.5, C);
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
    const k = 1 / Math.min(1, z + 0.25), gc = (G.Scenery && G.Scenery.groundCols()) || null;   // chão da ilha (neve, areia, capim vulcânico...)
    g.fillStyle = gc ? gc.soil : SOIL; g.fillRect(v.x0, 0, v.x1 - v.x0, v.y1 + 10);
    g.fillStyle = gc ? gc.grass : PAL.grass; g.fillRect(v.x0, 0, v.x1 - v.x0, 26);
    g.fillStyle = gc ? gc.grassD : PAL.grassD; g.fillRect(v.x0, 26, v.x1 - v.x0, 3 * k);
    g.fillStyle = gc ? gc.grassL : PAL.grassL; g.fillRect(v.x0, 0, v.x1 - v.x0, 2.5 * k);
    g.fillStyle = gc ? gc.soilD : SOIL_D; g.fillRect(v.x0, 44, v.x1 - v.x0, 2 * k);
    g.fillStyle = LINE; g.fillRect(v.x0, -0.6 * k, v.x1 - v.x0, 1.2 * k);
  }

  /* ---------- placeholders de construções (Draw) ---------- */
  /* ---- construções do pátio em pixel art Pixxel (mesmo traço do torii, da árvore e do Kome; máquinas continuam vetor) ----
     Cada uma é um E.sprite (contorno automático + bevel = 3 tons), desenhado em escala inteira K sem suavizar. */
  const SPK = 2, PSPR = E.sprite;
  const pblit = (g, cv, x, k) => { if (G.Scenery && G.Scenery.roofSnow()) cv = G.Scenery.snowy(cv); const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; g.drawImage(cv, Math.round(x - cv.width * k / 2), Math.round(-cv.height * k + 2 * k), cv.width * k, cv.height * k); g.imageSmoothingEnabled = sm; };
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
  // ARTE GERADA (tools/arte.js, conteudo/estrutura-*.js): construções no traço do Kome, versão de dia e de noite
  function isNight() { return N && N.light && G.S ? N.light(G.S.tod || 0.4).night > 0.25 : false; }
  function art(g, id, x, k, y, tag) {
    const A = E.Assets; if (!A || !A.ready || !A.ready(id)) return false;
    const a = A.get(id), an = a.anims || {}, tg = tag || (isNight() && an.noite ? 'noite' : 'dia'), r = an[tg] || an.dia || { from: 0, to: 0 };
    const f = r.from === r.to ? r.from : r.from + (Math.floor((G.S ? G.S.time : 0) * 6) % (r.to - r.from + 1));
    A.draw(g, id, f, Math.round(x), Math.round(y === undefined ? 2 * k : y), { scale: k });
    return true;
  }
  function casinha(g, x) { pblit(g, sCasinha(), x + 6, SPK); }
  function poste(g, x, t) {
    pblit(g, sPoste(), x + 4, SPK);
    Draw.cable(g, [x - 26, -200], [X.vila + 60, -150], { sag: 10, lw: 1.5 });
    const lit = N && N.light ? N.light(G.S && G.S.tod || 0.4).night : 0;
    if (lit > 0.2) { g.globalAlpha = lit * 0.5; Draw.circle(g, x + 28, -170, 16, '#FFE7A0', { ol: 0 }); g.globalAlpha = 1; }
  }
  function vila(g, x) { if (!art(g, 'sobrado_vila', x, 2)) pblit(g, sVila(), x, SPK); }
  function torre(g, x) {
    pblit(g, sTorre(), x, SPK);
    Draw.cable(g, [x - 108, -496], [x - 700, -420], { sag: 60, lw: 1.5 });
    Draw.cable(g, [x + 108, -496], [x + 520, -150], { sag: 50, lw: 1.5 });
  }
  function fabrica(g, x, t, S) {
    const on = !!S.own.m5;
    if (!art(g, 'predio_onigiri', x, 3)) pblit(g, sFabrica(on), x, SPK + 1);
    if (on) for (let i = 0; i < 3; i++) {                       // baforadas em forma de onigiri
      const u = (t * 0.22 + i / 3) % 1, px = x + 113 + Math.sin(u * 5 + i) * 14, py = -270 - u * 170, s = 10 + u * 18;
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
  // k = chave em X (layout(S) atualiza o x). Vila: prédio onigiri, sobrado, poste, torii, sakura. Cava: torre e casinha.
  const RULER = [
    { k: 'fabrica', x: X.fabrica, r: 260, draw: fabrica }, { k: 'torre', x: X.torre, r: 800, draw: torre }, { k: 'vila', x: X.vila, r: 110, draw: vila },
    { k: 'poste', x: X.poste, r: 300, draw: poste },
    { k: 'torii', x: X.torii, r: 120, draw: (g, x, t) => { if (N) N.torii(g, x, 0, 2.2, { t }); if (G.Scenery) G.Scenery.toriiSnow(g, x, 2.2); } },
    { k: 'sakura', x: X.sakura, r: 100, draw: (g, x, t) => { if (G.Scenery) G.Scenery.rulerTree(g, x, t); else if (N) N.tree(g, x, 0, { kind: 'sakura', s: 1.5, seed: 4, t }); } },
    { k: 'barraca', x: X.barraca, r: 90, draw: (g, x, t, S) => {
      if (!N) return;
      if (!S.own.m1) { Draw.box(g, x - 2, -36, 4, 36, PAL.wood, { ol: 1 }); Draw.sign(g, x - 30, -60, 60, 24, 'ALUGA-SE', { col: PAL.cream, ink: PAL.red }); return; }   // ponto vazio até comprar a Barraquinha
      popDraw(g, x, popK(S, 'm1'), () => N.stall(g, x, 0, { t, s: 1.15, col: S.own.m_b ? '#2F4670' : undefined }));
    } },
    { k: 'casinha', x: X.casinha, r: 50, draw: casinha },
  ];

  /* ---------- adereços que os nós da árvore acrescentam (regra do feedback visual) ---------- */
  const shO = { face: 1, scale: 1, pal: 'goma', shadow: true };
  function sh(g, x, y, pose, t, pal, face, scale) { shO.pal = pal; shO.face = face || 1; shO.scale = scale || 1; E.drawShiba(g, x, y, pose, t, shO); }
  const NOBORI = [VB + 150, VB + 600, VB + 1440, VB + 1700, VB + 2370];
  const props = [
    // fila de clientes na barraquinha (m1: 3, m_b: 5) + balança (m_a)
    { node: 'm1', k: 'barraca', x: X.barraca, draw(g, x, t, S) { const n = S.own.m_b ? 5 : 3; for (let i = 0; i < n; i++) sh(g, x - 60 - i * 26, 6, i % 2 ? 'sit' : 'wag', t + i, ['shiro', 'kuro', 'goma', 'cha', 'aka'][i], 1); } },
    { node: 'm_a', k: 'barraca', x: X.barraca, draw(g, x, t) { pblit(g, sBalanca(Math.sin(t * 3) > 0 ? 1 : 0), x + 46, SPK); } },
    { node: 'm_c', x: VB + 1150, r: 1700, draw(g, x, t) { if (N && N.nobori) for (let i = 0; i < 5; i++) N.nobori(g, NOBORI[i], 0, { t: t + i, col: i % 2 ? PAL.red : '#2F4670' }); } },
    { node: 'm_e', k: 'ekiben', x: X.ekiben, draw(g, x) { if (!art(g, 'ekiben', x, 2)) pblit(g, sEkiben(), x, SPK); Draw.text(g, 'EKIBEN', x, -73, { size: 11, col: PAL.cream, sw: 0, weight: 900 }); } },
    { node: 'm_f', k: 'caixotes', x: 0, draw(g, x) { pblit(g, sCaixotes(), x, SPK); } },
    { node: 'm9', k: 'sake', x: X.sake, draw(g, x) { pblit(g, sSake(), x, SPK); } },
    { node: 'm10', k: 'outdoor', x: X.outdoor, draw(g, x, t) { pblit(g, sOutdoor(), x, SPK + 1); sh(g, x - 70, -326, 'proud', t, 'kome', 1, 2); Draw.text(g, 'KOME', x + 40, -390, { size: 30, col: PAL.red, sw: 5 }); Draw.text(g, 'no Japão', x + 40, -358, { size: 15, col: PAL.red, sw: 0 }); } },
    { node: 'a3', k: 'kakashi', x: X.kakashi, draw(g, x, t) { pblit(g, sKakashi(), x, SPK); } },
    { node: 'a7', k: 'silo', x: X.silo, draw: silo },
    { node: 'a9', k: 'silo', x: X.silo, draw() { /* a esteira agora é desenhada pelo belts.js (E.Conveyor de verdade) */ } },
    { node: 'e3', k: 'capataz', x: X.capataz, draw(g, x, t) { sh(g, x, 8, 'point', t, 'cha', 1); } },
    { node: 'e5', k: 'antena', x: X.antena, draw(g, x, t) { pblit(g, sAntena(Math.sin(t * 4) > 0 ? 1 : 0), x, SPK); } },
    { node: 'e2a', k: 'oficina', x: 0, draw(g, x) { if (!art(g, 'oficina', x, OFI_K)) pblit(g, sOficina(), x, OFI_K); Draw.text(g, 'OFICINA', x, -91 * OFI_K / 2, { size: 13 * OFI_K / 2, col: PAL.ink, sw: 0, weight: 900 }); } },
    { node: 'e2b', k: 'lotR', x: 0, r: 2600, draw(g, x, t, S) { pblit(g, sLuz(), X.lotR + 6, SPK); pblit(g, sLuz(), lotLeft(S) - 6, SPK); } },
    { when: S => S.tool >= ((G.Data && G.Data.toolIndex && G.Data.toolIndex.empilhadeira) || 8), k: 'lotR', x: 0, r: 300, draw(g, x, t, S) { lotSign(g, S); } },
    { node: 's6', k: 'mural', x: X.mural, draw(g, x) { pblit(g, sMural(), x, SPK); } },
    { node: 's11', k: 'mesinha', x: X.mesinha, draw(g, x, t) { pblit(g, sMesinha(), x, SPK); } },
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

  /* estacionamento da frota: UM pátio marcado (piso, vagas pintadas, cerca atrás e placa). Cresce uma vaga por máquina comprada. */
  function lotLeft(S) {
    const TI = (G.Data && G.Data.toolIndex) || {}; let L = X.lotR - 70;
    for (const [id] of BAYS) if ((TI[id] || 99) <= S.tool) L = X.park[id + '_L'];
    return L - 10;
  }
  // bancada de rechego: montinho de arroz na frente da vaga (encostado num bloco de concreto) com uma bica pingando arroz.
  // A máquina com piloto trabalha nele sem sair da vaga quando a frente de lavra está ocupada pela máquina grande.
  function drawBin(g, x, t, i, busy) {
    const h = 24 + 5 * Math.sin(t * 0.9 + i * 2.1) - (busy ? 4 * Math.abs(Math.sin(t * 2.3 + i)) : 0), w = 24;
    Draw.box(g, x + w - 2, -18, 9, 30, '#B9BEC6', { ol: 1.2 }); g.fillStyle = PAL.yel; g.fillRect(x + w - 1, -17, 7, 4);
    g.fillStyle = PAL.rice; g.strokeStyle = LINE; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x - w, 12); g.quadraticCurveTo(x - w * 0.4, 12 - h * 1.1, x + 2, 12 - h); g.quadraticCurveTo(x + w * 0.5, 12 - h, x + w - 2, 12 - h * 0.7); g.lineTo(x + w - 2, 12); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#E9DFC9'; g.beginPath(); g.ellipse(x - 6, 6, 4, 1.8, 0.4, 0, 6.3); g.ellipse(x + 8, 2, 4, 1.8, -0.3, 0, 6.3); g.fill();
    // bica vinda da cerca de trás
    g.fillStyle = '#8B939E'; g.fillRect(x + 2, -30, 4, 8); g.fillRect(x - 2, -24, 10, 3);
    g.fillStyle = PAL.rice; for (let k = 0; k < 3; k++) { const q = (t * 1.6 + k / 3 + i * 0.37) % 1; g.fillRect(x + 2 + (k % 2), -20 + q * (26 - h * 0.6), 2, 3); }
  }
  function drawLot(g, v, S) {
    const TI = (G.Data && G.Data.toolIndex) || {}; if (S.tool < (TI.empilhadeira || 8)) return;
    const R = X.lotR, L = lotLeft(S); if (R < v.x0 || L > v.x1) return;
    g.fillStyle = 'rgba(70,50,30,.16)'; g.fillRect(L - 4, 0, R - L + 8, 3);
    g.fillStyle = '#8B8F96'; g.fillRect(L, 1, R - L, 38); g.fillStyle = '#A3A7AD'; g.fillRect(L, 1, R - L, 3); g.fillStyle = '#6E737B'; g.fillRect(L, 36, R - L, 3);
    // cerca de tela atrás (baixa e clara: não briga com as máquinas)
    g.fillStyle = '#B9C0C8'; for (let x = L; x <= R; x += 46) g.fillRect(x - 1.5, -30, 3, 31);
    g.fillRect(L, -30, R - L, 2.5); g.fillRect(L, -16, R - L, 1.5);
    // vagas pintadas (linha amarela entre uma máquina e outra)
    g.fillStyle = '#F3C94A'; g.fillRect(R - 6, 4, 4, 32);
    for (const [id] of BAYS) if ((TI[id] || 99) <= S.tool) g.fillRect(X.park[id + '_L'] - 2, 4, 4, 32);
    const fl = S.fleet || [];
    for (let i = 0; i < fl.length; i++) { const f = fl[i]; if (f.bayOn) { const w = (BAYS.find(b => b[0] === f.id) || [0, 150])[1]; drawBin(g, X.park[f.id] + w / 2 + 28, G.S ? G.S.time : 0, i, f.bay); } }
  }
  // placa PÁTIO: no alto do poste da ponta (o mesmo do holofote), acima das máquinas e da boca do túnel da esteira
  function lotSign(g, S) {
    const R = X.lotR;
    if (!S.own.e2b) Draw.box(g, R + 4, -150, 4, 150, YC.steelD, { ol: 1 });
    Draw.sign(g, R - 38, -182, 88, 30, 'PÁTIO', { col: '#2F4670', ink: PAL.cream });
  }
  // rua da vila: calçada clara de pedra + placa de entrada
  function drawStreet(g, v) {
    if (X.vilaX1 < v.x0 || X.vilaX0 - 200 > v.x1) return;
    const a = Math.max(v.x0, X.vilaX0 - 40), b = Math.min(v.x1, X.vilaX1);
    g.fillStyle = '#E4D8BF'; g.fillRect(a, 5, b - a, 13); g.fillStyle = '#CDBE9F'; g.fillRect(a, 16, b - a, 2);
    g.fillStyle = '#F3EBDB'; for (let x = Math.ceil(a / 44) * 44; x < b; x += 44) g.fillRect(x, 7, 26, 3);
    const sx = X.vilaX0 - 120;   // placa de entrada, antes da sakura
    Draw.box(g, sx - 62, -52, 4, 52, PAL.wood, { ol: 1 }); Draw.box(g, sx + 58, -52, 4, 52, PAL.wood, { ol: 1 });
    Draw.sign(g, sx - 72, -88, 144, 36, 'VILA DO KOME', { col: PAL.cream, ink: PAL.red });
  }
  /* beco do kei-truck (entre o galpão e a Oficina): ruazinha lateral que entra pro fundo. Meio-fio, bueiro, faixa, caixotes,
     máquina de venda, lixeira, cone, espelho de esquina e cancela no fim: o caminhãozinho vira aqui (industry.js working()). */
  function drawAlley(g, t, S) {
    const R = X.beco - 12, L = X.beco - ALLEY + 12, cx = (L + R) / 2, yF = 9, yB = -40, wB = 46;   // boca larga na frente, estreita no fundo
    const edge = (side, u) => U.lerp(side < 0 ? L : R, cx + side * wB, u), yy = u => U.lerp(yF, yB, u);
    // calçada da boca do beco
    g.fillStyle = '#C9CCD2'; g.fillRect(L - 16, 0, R - L + 32, 4);
    // asfalto em 3 faixas (mais claro no fundo = distância)
    const cols = ['#858A92', '#8E939B', '#989DA5'];
    for (let i = 0; i < 3; i++) { const u0 = i / 3, u1 = (i + 1) / 3; g.fillStyle = cols[i]; g.beginPath(); g.moveTo(edge(-1, u0), yy(u0)); g.lineTo(edge(1, u0), yy(u0)); g.lineTo(edge(1, u1), yy(u1)); g.lineTo(edge(-1, u1), yy(u1)); g.closePath(); g.fill(); }
    // meio-fio dos dois lados (claro, com a quina escura)
    for (const sd of [-1, 1]) {
      g.fillStyle = '#E3E6EA'; g.beginPath(); g.moveTo(edge(sd, 0), yF); g.lineTo(edge(sd, 0) - sd * 12, yF); g.lineTo(edge(sd, 1) - sd * 4, yB); g.lineTo(edge(sd, 1), yB); g.closePath(); g.fill();
      g.strokeStyle = '#6E737B'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(edge(sd, 0), yF); g.lineTo(edge(sd, 1), yB); g.stroke();
    }
    // faixa central tracejada convergindo + seta de "entra"
    g.fillStyle = '#F3EBDB'; for (let i = 0; i < 4; i++) { const u = 0.1 + i * 0.22, w = 7 * (1 - u * 0.7), h = 7 * (1 - u * 0.6); g.fillRect(cx - w / 2, yy(u) - h, w, h); }
    // bueiro
    g.fillStyle = '#5E636B'; g.beginPath(); g.ellipse(cx - 44, 0, 15, 3.4, 0, 0, 6.3); g.fill(); g.fillStyle = '#7C8189'; g.beginPath(); g.ellipse(cx - 44, -0.6, 11, 2.2, 0, 0, 6.3); g.fill();
    g.fillStyle = '#5E636B'; g.fillRect(cx - 52, -1.2, 16, 1); g.fillRect(cx - 45, -2.6, 2, 4);
    // cancela no fim do beco (levantada) e uma cerquinha: é por ali que ele some
    g.fillStyle = '#B9C0C8'; g.fillRect(cx - wB - 22, yB - 22, wB * 2 + 44, 2); for (let x = cx - wB - 22; x <= cx + wB + 22; x += 11) if (Math.abs(x - cx) > wB) g.fillRect(x, yB - 22, 2, 22);
    Draw.box(g, cx + wB + 2, yB - 20, 6, 20, PAL.yel, { ol: 1 });
    g.save(); g.translate(cx + wB + 5, yB - 18); g.rotate(-1.05); Draw.box(g, -2, -56, 4, 56, PAL.cream, { ol: 1 }); g.fillStyle = PAL.red; for (let i = 0; i < 3; i++) g.fillRect(-2, -50 + i * 18, 4, 8); g.restore();
    // espelho de esquina (laranja) num poste, do lado da Oficina
    Draw.box(g, L + 2, -96, 4, 96, YC.steelD, { ol: 1 }); Draw.circle(g, L + 16, -92, 13, '#E8893A', { ol: 1.6 }); Draw.circle(g, L + 16, -92, 9, '#BFE3F2', { ol: 1 });
    g.fillStyle = '#FFFFFF'; g.fillRect(L + 11, -97, 5, 3);
    // tralha de beco (arte gerada): máquina de venda e lixeira do lado da Oficina, caixotes e cone do lado do galpão
    art(g, 'prop_venda', L + 46, 2, 6); art(g, 'prop_lixeira', L + 84, 1.5, 7);
    art(g, 'prop_caixote', R - 34, 2, 6); art(g, 'prop_caixote', R - 68, 2, 6); art(g, 'prop_caixote', R - 50, 2, -24); art(g, 'prop_cone', R - 98, 1.5, 8);
    if (isNight()) { g.globalAlpha = 0.35; Draw.circle(g, L + 46, -40, 34, '#FFE9A8', { ol: 0 }); g.globalAlpha = 1; }   // a máquina de venda ilumina o beco de noite
  }
  /* RUA DO COMÉRCIO (fim da rua da vila): as lojas do modo infinito (D.SHOPS + fichas 'loja') viram prédio quando têm nível.
     Freguesia (shibas na porta) cresce com o nível; a loja CLIENTE ganha bandeira vermelha, lanterna acesa e a plaquinha. */
  const SHOP_ART = { konbini: 'loja_konbini', sushi: 'loja_sushi', mochiya: 'loja_mochiya', sake: 'loja_sake', export: 'loja_export', ramen: 'loja_ramen' };
  const SHOP_ALT = ['cid_loja', 'cid_loja_azul', 'cid_machiya', 'lojinha_onigiri'];
  const shopRun = S => (S.ended && S.stats && S.stats.run && S.stats.run.shops) || null;
  function drawShops(g, v, t, S) {
    const sh = shopRun(S), list = (G.Data && G.Data.SHOPS) || []; if (!sh || !list.length) return;
    let any = false; for (const o of list) if (sh[o.id]) { any = true; break; }
    X.vilaX1 = VB + 3370 + (any ? list.length * X.lojaStep + 60 : 0);
    if (!any || X.lojas0 - 200 > v.x1 || X.vilaX1 < v.x0) return;
    const client = S.stats.run.client, night = isNight();
    // varal de lanterninhas por cima da rua do comércio
    const x0 = X.lojas0 - 160, x1 = X.lojas0 + (list.length - 1) * X.lojaStep + 160;
    Draw.box(g, x0 - 3, -250, 6, 250, PAL.wood, { ol: 1 }); Draw.box(g, x1 - 3, -250, 6, 250, PAL.wood, { ol: 1 });
    const seg = (x1 - x0) / list.length;
    for (let i = 0; i < list.length; i++) {
      const a = x0 + i * seg, b = a + seg; Draw.cable(g, [a, -246], [b, -246], { sag: 22, lw: 2 });
      for (let k = 1; k < 5; k++) { const u = k / 5, lx = U.lerp(a, b, u), ly = -246 + 88 * u * (1 - u) + 7; Draw.circle(g, lx, ly, 7, (k + i) % 2 ? PAL.red : PAL.cream, { ol: 1.2 }); if (night) { g.globalAlpha = 0.3; Draw.circle(g, lx, ly, 15, '#FFE9A8', { ol: 0 }); g.globalAlpha = 1; } }
    }
    for (let i = 0; i < list.length; i++) {
      const o = list[i], Lv = sh[o.id] | 0, x = X.lojas0 + i * X.lojaStep; if (x + 170 < v.x0 || x - 170 > v.x1) continue;
      if (!Lv) { Draw.box(g, x - 3, -50, 6, 50, PAL.wood, { ol: 1 }); Draw.sign(g, x - 62, -92, 124, 44, 'EM BREVE', { col: PAL.cream, ink: PAL.red }); continue; }   // terreno vago
      const id = SHOP_ART[o.id] || SHOP_ALT[i % SHOP_ALT.length];
      if (!art(g, id, x, 3)) art(g, SHOP_ALT[i % SHOP_ALT.length], x, 3);
      const nq = Math.min(4, 1 + Math.floor(Lv / 4));   // freguesia na porta
      for (let k = 0; k < nq; k++) sh8(g, x - 96 + k * 26 + (k > 1 ? 120 : 0), 8, (k + i) % 3 === 0 ? 'sit' : 'wag', t + k * 0.7 + i, ['shiro', 'kuro', 'goma', 'cha', 'aka'][(k + i * 2) % 5], k > 1 ? -1 : 1);
      if (o.id === client) {
        if (N && N.nobori) { N.nobori(g, x + 128, 0, { t: t + i, col: PAL.red }); N.nobori(g, x - 128, 0, { t: t + i + 1.3, col: PAL.red }); }
        Draw.sign(g, x - 86, -236, 172, 46, 'CLIENTE', { col: PAL.red, ink: PAL.cream });
        g.globalAlpha = (night ? 0.4 : 0.22) + 0.08 * Math.sin(t * 3); Draw.circle(g, x - 104, -213, 24, '#FFE9A8', { ol: 0 }); Draw.circle(g, x + 104, -213, 24, '#FFE9A8', { ol: 0 }); g.globalAlpha = 1;
        Draw.circle(g, x - 104, -213, 11, PAL.red, { ol: 1.6 }); Draw.circle(g, x + 104, -213, 11, PAL.red, { ol: 1.6 });   // lanternas acesas da cliente
      }
    }
  }
  const sh8 = (g, x, y, pose, t, pal, face) => { shO.pal = pal; shO.face = face || 1; shO.scale = 1; E.drawShiba(g, x, y, pose, t, shO); };
  // drawYard(g, v, t, S): os dois bairros (atrás das máquinas e do Kome). Vila: casa, régua fofa, adereços. Cava: pátio industrial.
  function drawYard(g, v, t, S) {
    layout(S);
    drawStreet(g, v);
    if (N && v.x1 > X.casa - 320 && v.x0 < X.casa + 320) {
      if (S.house > 0) N.house(g, X.casa, 0, { stage: S.house - 1, s: 1.5, t });
      else { Draw.box(g, X.casa - 2, -40, 4, 40, PAL.wood, { ol: 1 }); Draw.sign(g, X.casa - 34, -66, 68, 26, 'À VENDA', { col: PAL.cream, ink: PAL.red }); }
    }
    drawLot(g, v, S);
    if (X.beco && X.beco > v.x0 - 40 && X.beco - ALLEY < v.x1 + 40) drawAlley(g, t, S);
    drawShops(g, v, t, S);
    for (let i = 0; i < RULER.length; i++) { const o = RULER[i]; if (o.x + o.r > v.x0 && o.x - o.r < v.x1) o.draw(g, o.x, t, S); }
    for (let i = 0; i < props.length; i++) {
      const p = props[i], r = p.r || 500;
      if (p.node ? !S.own[p.node] : !(p.when && p.when(S))) continue;
      if (p.x + r > v.x0 && p.x - r < v.x1) { const k = p.node ? popK(S, p.node) : 1; if (k === 1) p.draw(g, p.x, t, S); else popDraw(g, p.x, k, () => p.draw(g, p.x, t, S)); }
    }
    if (G.Scenery) G.Scenery.yard(g, v, t, S, X);   // enfeites da ilha (na vila) e estátua
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
    else if (c.kind === 'silo' && G.Scale && G.Scale.moega) { g.scale(0.6, 0.6); G.Scale.moega.draw(g, 0, 0, { face: 1, t, fill: 0.3 + 0.5 * (c.pulse || 0) }); }   // moega pequena (o silo de verdade fica no pátio)
    g.restore();
  }

  G.World = { setSize(w, h) { W = w; H = h; }, drawPlot, X, layout, BAYS, FAB_K, RULER, props, layers, drawBack, updateBack, drawGround, drawYard, drawCollector, drawSilo: silo, sh };
})();
