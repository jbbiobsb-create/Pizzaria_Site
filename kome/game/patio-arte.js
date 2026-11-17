/* Kome no Japão — patio-arte.js
   ARTE do PÁTIO DA FROTA (camada Cookie, docs/design/camada-cookie.md · "Como a quantidade aparece sem virar bagunça").
   Só desenha: não muda estado de jogo nem save. O sistema (S.patio, preço, marcos) é do programador.

   API
     G.PatioArt.draw(g, view, t, patio)   desenha o pátio inteiro em coordenadas de MUNDO (dentro de cam.begin).
                                          view = {x0,x1,y0,y1} (o `view` do render), t = S.time,
                                          patio = { [toolId]: { n: quantidade, marcos: marcos atingidos } } (ids de D.TOOLS).
     G.PatioArt.slots()                   retângulo do pátio + grupos + câmeras sugeridas ({x0,x1,y0,y1,groups,cam,camHand,camMid}).
     G.PatioArt.auto = true               já se pendura sozinho em G.World.layers.back (atrás das máquinas e do Kome) e desenha
                                          com S.patio (ou o pátio falso do ?patio=) quando S.ended. false = o programador chama.
     G.PatioArt.fake(spec)                pátio falso pra testar: 'demo' | 'poucos' | 'medio' | 'cheio' | 'absurdo' | número | 'pata:12,trator:30'
                                          | '+pata' / '+10trator' (compra de mentira, mostra a animação). Também via ?patio=... no endereço.
     G.PatioArt.stats                     {ms, avg, figs, groupSpr, mach} do último quadro (medir desempenho).

   Onde fica: do lado da cava, DEPOIS da estátua do Kome-Oh (X.estatua - 260 pra fora), andando junto com o pátio (X.shift).
   Classes (camada-cookie.md): MÃO (pata…britadeira) = turma de até 8 shibas num canteiro com montinho de arroz;
   MÉDIA (trator…escavadeira) = até 4 nas vagas + comboio na rua do pátio; GIGANTE (caminhão, pá de cabo, Bagger) = silhuetas no
   horizonte (3 camadas, névoa, parallax). Patamares visuais em PA.TIERS (10, 25, 50, 100, 150…).
   Desempenho: shiba de turma = quadro pronto (6 quadros por ferramenta/paleta), máquinas = imagem pronta (2 quadros), estruturas
   e placas = imagem pronta; corta pelo view; no máx. PA.FIG_CAP figuras animadas soltas, o resto vira imagem de grupo. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;

  /* ===================== MOVER PRO data.js (D.PATIO_ART) — números do visual do Pátio ===================== */
  const PA = {
    TIERS: [10, 25, 50, 100, 150, 200, 250, 300, 400, 500],     // patamares visuais por turma (camada-cookie.md)
    HAND: ['pata', 'hashi', 'tigela', 'pa', 'duaspas', 'carrinho', 'britadeira'],
    MID: ['trator', 'empilhadeira', 'colheita', 'escav'],
    GIANT: ['caminhao', 'pacabo', 'bagger'],
    // absurdas (15–20) no horizonte: cada uma desenha a si mesma com G.Tools[id].horizon(g, {x0,x1,y,k,t,n,tint,haze,night}), se tiver
    ABSURD: ['tatus', 'komeohs', 'trembala', 'foguete', 'fuji', 'portal'],
    CREW_MAX: 8,          // shibas soltos por turma de mão
    BAY_MAX: 4,           // máquinas médias nas vagas
    CONVOY_MAX: 3,        // máquinas médias andando no comboio (por tipo)
    GIANT_LAYERS: [3, 8, 20],   // silhuetas por camada do horizonte (perto → longe), por tipo
    FIG_CAP: 60,          // figuras animadas soltas por quadro; acima disso o canteiro vira imagem de grupo
    LOD_Z: 0.3,           // zoom abaixo disso: turmas só em imagem de grupo
    COLORS: { pata: '#D8574E', hashi: '#3F78C8', tigela: '#2FA3A0', pa: '#E2742E', duaspas: '#8A5CC8', carrinho: '#5FA04A', britadeira: '#E0A82A',
      trator: '#C8423A', empilhadeira: '#EDB93A', colheita: '#5D9A40', escav: '#E2742E', caminhao: '#EDB93A', pacabo: '#E2742E', bagger: '#EDB93A' },
    NAMES: { pata: 'TURMA DA PATA', hashi: 'BRIGADA DO HASHI', tigela: 'CLUBE DA TIGELA', pa: 'SINDICATO DA PÁ', duaspas: 'DUPLA DINÂMICA',
      carrinho: 'ESQUADRILHA DO CARRINHO', britadeira: 'BANDA DA BRITADEIRA', trator: 'COMBOIO DE TRATORES', empilhadeira: 'BALÉ DAS EMPILHADEIRAS',
      colheita: 'FILA DE COLHEITADEIRAS', escav: 'ESCAVADEIRAS COREOGRAFADAS', caminhao: 'CARAVANA', pacabo: 'PÁS DE CABO', bagger: 'FROTA BAGGER' },
  };
  /* ======================================================================================================= */

  const TAU = Math.PI * 2, clamp = U.clamp, lerp = U.lerp;
  const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const mixc = {}, mix = (a, b, k) => mixc[a + b + k] || (mixc[a + b + k] = U.mixCss(a, b, k));
  const isHand = {}, isMid = {}, isGiant = {}; PA.HAND.forEach(i => { isHand[i] = 1; }); PA.MID.forEach(i => { isMid[i] = 1; }); PA.GIANT.forEach(i => { isGiant[i] = 1; });
  function tierOf(n) { let k = 0; while (k < PA.TIERS.length && n >= PA.TIERS[k]) k++; return k; }   // 0 = abaixo de 10; 1 = 10+; 2 = 25+; 3 = 50+; 4 = 100+ ...
  const T10 = 1, T25 = 2, T50 = 3, T100 = 4, T150 = 5, T200 = 6, T250 = 7, T300 = 8, T400 = 9, T500 = 10;
  const fmtN = n => n >= 10000 ? U.fmt(n) : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const night = () => { const N = E.Nature, S = G.S; return N && N.light && S ? N.light(S.tod !== undefined ? S.tod : 0.4).night : 0; };
  const dpr = () => Math.min(3, window.devicePixelRatio || 1);

  /* ---------- cache genérico de imagem: desenha uma vez em coordenadas locais (w x h, origem no canto de cima) ---------- */
  const CACHE = new Map();
  function cached(key, w, h, k, fn) {
    let o = CACHE.get(key);
    if (o && o.k === k) return o;
    const c = o && o.c.width === Math.ceil(w * k) && o.c.height === Math.ceil(h * k) ? o.c : mkc(w * k, h * k);
    const cg = c.getContext('2d'); cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, c.width, c.height);
    cg.setTransform(k, 0, 0, k, 0, 0); cg.lineJoin = 'round'; cg.lineCap = 'round';
    const z0 = Draw.zoom, m0 = Draw.minPx; Draw.lod(Math.max(1, k), 0.6);
    try { fn(cg); } catch (e) { /* desenho de cache nunca derruba o quadro */ }
    Draw.lod(z0, m0);
    o = { c, w, h, k }; CACHE.set(key, o);
    if (CACHE.size > 900) { const it = CACHE.keys(); for (let i = 0; i < 200; i++) CACHE.delete(it.next().value); }
    return o;
  }
  const blit = (g, o, x, y) => g.drawImage(o.c, x, y, o.w, o.h);
  // máquina pronta com âncora (ax,ay): em ilha espelhada desvira (a arte da máquina tem letreiro e lado certo); flip = virada de propósito
  function drawM(g, c, x, y, ax, ay, w, h, flip) {
    if (Draw.mirrored(g)) flip = !flip;
    if (!flip) g.drawImage(c, x - ax, y - ay, w, h);
    else { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(c, -ax, y - ay, w, h); g.restore(); }
  }
  // imagem com texto: em ilha espelhada o mundo vira; desvira só a placa pra continuar legível
  function blitText(g, o, x, y, s) {
    s = s || 1;
    if (Draw.mirrored(g)) { g.save(); g.translate(x + o.w * s / 2, 0); g.scale(-1, 1); g.drawImage(o.c, -o.w * s / 2, y, o.w * s, o.h * s); g.restore(); }
    else g.drawImage(o.c, x, y, o.w * s, o.h * s);
  }

  /* ---------- paletas das turmas: <10 cada um com a sua; 10+ todo mundo de chapéu na cor da turma ---------- */
  const MIXED = ['shiro', 'kuro', 'goma', 'cha', 'aka', 'sumi', 'yuki', 'momo'];
  const FURS = ['shiro', 'kuro', 'goma', 'cha', 'aka'];
  const UNI = {};
  function uniPal(id, k) {
    const a = UNI[id] || (UNI[id] = []);
    if (!a[k]) { const b = E.PALS[FURS[k % FURS.length]], c = PA.COLORS[id] || PAL.red; a[k] = Object.assign({}, b, { h: c, g: mix(c, '#2A1A10', 0.35) }); }
    return a[k];
  }
  const GOLD_PAL = { h: '#F3C94A', g: '#B4852A', o: '#EDBE4A', c: '#FFE68A', k: '#7A5228', n: '#7A5228', p: '#E8A040' };
  const palOf = (id, i, uni) => uni ? uniPal(id, i % FURS.length) : MIXED[(i + PA.HAND.indexOf(id) * 3) % MIXED.length];
  const palKey = (id, i, uni) => uni ? id + 'u' + (i % FURS.length) : MIXED[(i + PA.HAND.indexOf(id) * 3) % MIXED.length];

  /* ---------- ferramentas na mão (pixel, mesma grade do shiba; contorno automático do E.sprite) ---------- */
  // ferramentas GRANDES de propósito (cartum): na escala do pátio a silhueta tem que ler de longe, não 3 pixels
  const TOOL = {
    pa: () => E.sprite('pt_pa2', 15, 31, P => { P.rect(3, 1, 9, 3, PAL.woodD).rect(4, 1, 7, 1, PAL.wood).rect(6, 3, 3, 17, PAL.wood).rect(8, 4, 1, 15, PAL.woodD).rect(6, 4, 1, 14, PAL.woodL)
      .rect(5, 18, 5, 2, PAL.steelD).rrect(2, 19, 11, 11, 3, PAL.steel).rect(3, 20, 2, 7, PAL.steelL).rect(3, 28, 9, 1, PAL.steelD).rect(11, 21, 1, 6, PAL.steelD); }),
    hashi: () => E.sprite('pt_hashi2', 10, 27, P => { P.rect(1, 1, 2, 21, PAL.red).rect(1, 1, 1, 18, PAL.redL).rect(6, 1, 2, 21, PAL.redD).rect(1, 3, 2, 1, PAL.gold).rect(6, 3, 2, 1, PAL.gold)
      .rect(1, 21, 2, 3, PAL.woodL).rect(6, 21, 2, 3, PAL.woodL).ell(4.5, 24.5, 2.5, 1.8, PAL.rice).set(4, 24, PAL.riceS); }),
    tigela: () => E.sprite('pt_tigela2', 23, 15, P => { P.ell(11.5, 5.5, 8, 4, PAL.rice).set(8, 4, PAL.riceS).set(13, 3, PAL.riceS).set(15, 6, PAL.riceS)
      .rrect(2, 6, 19, 8, 3, PAL.bowl).rect(3, 6, 17, 1, PAL.bowlL).rect(4, 9, 15, 1, PAL.red).rect(8, 13, 7, 1, PAL.bowlL); }),
    carrinho: () => E.sprite('pt_carr2', 38, 22, P => {
      P.line(1, 7, 10, 9, 2, PAL.woodD).poly([[8, 5], [33, 4], [28, 14], [12, 14]], PAL.red).rect(9, 5, 24, 1, PAL.redL).rect(13, 13, 14, 1, PAL.redD)
        .ell(20, 5, 9, 3.2, PAL.rice).set(16, 4, PAL.riceS).set(22, 3, PAL.riceS).set(25, 5, PAL.riceS).rect(13, 14, 2, 6, PAL.grayD).ell(29.5, 16.5, 4.5, 4.5, PAL.blk).ell(29.5, 16.5, 1.6, 1.6, PAL.grayL);
    }),
    britadeira: () => E.sprite('pt_brit2', 18, 31, P => { P.rect(1, 1, 16, 3, PAL.blk).rect(1, 1, 16, 1, PAL.blkL).rect(5, 4, 8, 13, PAL.yel).rect(5, 4, 2, 13, PAL.yelL).rect(5, 16, 8, 1, PAL.yelD)
      .rect(5, 9, 8, 2, PAL.blk).rect(7, 17, 4, 3, PAL.blkL).rect(8, 20, 2, 9, PAL.steel).rect(8, 20, 1, 8, PAL.steelL).set(8, 29, PAL.steelD).set(9, 29, PAL.steelD); }),
    // pata: luvona de pata (almofadinhas cor-de-rosa) na cor da turma
    pata: () => E.sprite('pt_pata2', 14, 14, P => { P.ell(7, 8, 5.5, 5, PAL.red).ell(3, 3.5, 1.8, 1.8, PAL.red).ell(7, 2.5, 1.8, 1.8, PAL.red).ell(11, 3.5, 1.8, 1.8, PAL.red)
      .ell(7, 9, 2.6, 2.2, '#FFD3D8').set(3, 3, '#FFD3D8').set(7, 2, '#FFD3D8').set(11, 3, '#FFD3D8').rect(4, 6, 2, 1, PAL.redL); }),
  };
  // quanto tempo dura um ciclo da turma (s) e qual pose
  const CREW = {
    pata: { pose: 'dig', cyc: 0.48 }, hashi: { pose: 'dig', cyc: 0.6 }, tigela: { pose: 'dig', cyc: 1.0 }, pa: { pose: 'dig', cyc: 0.8 },
    duaspas: { pose: 'dig', cyc: 0.62 }, carrinho: { pose: 'push', cyc: 0.7 }, britadeira: { pose: 'stand', cyc: 0.24 },
  };
  const NF = 6, FW = 92, FH = 80, FAX = 46, FAY = 70;   // quadros de turma: 92x80 com os pés em (46,70) (folga pras ferramentas grandes)
  const AN = { x: 0, y: 0 };
  function rot(cg, spr, x, y, ax, ay, a) { cg.save(); cg.translate(Math.round(x), Math.round(y)); cg.rotate(a); cg.drawImage(spr, -ax, -ay); cg.restore(); }
  // crewFrames(id, i, uni) -> [NF canvases]: o shiba da turma com a ferramenta, já pronto (1 drawImage por figura)
  const FRAMES = new Map();
  function crewFrames(id, i, uni) {
    const key = id + '|' + palKey(id, i, uni); let a = FRAMES.get(key);
    if (a) return a;
    a = []; const pal = palOf(id, i, uni), C = CREW[id];
    for (let f = 0; f < NF; f++) {
      const c = mkc(FW, FH), cg = c.getContext('2d'); cg.imageSmoothingEnabled = false;
      const u = f / NF, tigUp = id === 'tigela' && f >= 3, pose = tigUp ? 'carry' : C.pose, tp = E.drawShiba.frameT(u * 0.5 + (tigUp ? 0.1 : 0));
      E.drawShiba(cg, FAX, FAY, pose, tp, { pal, face: 1, scale: 1, smooth: false });
      E.shibaAnchor(pose, tp, 'hold', AN);
      const hx = FAX + AN.x, hy = FAY + AN.y, sw = Math.sin(u * TAU);
      if (id === 'pa') rot(cg, TOOL.pa(), hx, hy, 7, 4, -0.35 - 0.75 * sw);
      else if (id === 'pata') rot(cg, TOOL.pata(), hx + 1, hy, 7, 9, -0.3 - 0.6 * sw);
      else if (id === 'duaspas') { rot(cg, TOOL.pa(), hx - 4, hy, 7, 4, 0.2 + 0.6 * sw); rot(cg, TOOL.pa(), hx + 2, hy + 1, 7, 4, -0.4 - 0.7 * sw); }
      else if (id === 'hashi') rot(cg, TOOL.hashi(), hx, hy, 4, 3, -0.75 - 0.25 * sw + 0.08 * (f % 2));
      else if (id === 'tigela') { const s = TOOL.tigela(); if (tigUp) cg.drawImage(s, Math.round(hx - 11), Math.round(hy - 14)); else cg.drawImage(s, Math.round(hx - 6), Math.round(hy - 9)); }
      else if (id === 'carrinho') { const s = TOOL.carrinho(); cg.drawImage(s, Math.round(hx - 3), FAY - 21); }
      else if (id === 'britadeira') { const s = TOOL.britadeira(), j = f % 2; cg.drawImage(s, Math.round(hx - 5 + j), FAY - 29 + j); }
      // grãos voando da pata / da pá
      if ((id === 'pata' || id === 'pa' || id === 'duaspas') && f >= 2 && f <= 4) {
        cg.fillStyle = PAL.rice; const q = f - 2;
        cg.fillRect(hx + 4 - q * 5, hy - 4 - q * 3, 2, 1); cg.fillRect(hx + 1 - q * 7, hy - 1 - q * 5, 1, 2); cg.fillStyle = PAL.riceS; cg.fillRect(hx - 2 - q * 4, hy - 6 - q * 2, 1, 1);
      }
      if (id === 'britadeira') { cg.fillStyle = 'rgba(230,220,196,.8)'; cg.fillRect(hx - 6 + f, FAY - 1, 2, 1); cg.fillRect(hx + 7 - f, FAY - 2, 2, 2); }
      a.push(c);
    }
    FRAMES.set(key, a);
    if (FRAMES.size > 80) FRAMES.delete(FRAMES.keys().next().value);
    return a;
  }

  /* ---------- estado do visual (detecta compra pra animar; não vai pro save) ---------- */
  const ST = {};
  const st = id => ST[id] || (ST[id] = { n: undefined, shown: 0, from: 0, popT: -9, dn: 0, tier: 0, tierT: -9, arr: [] });
  const FX = [];   // partículas (confete, poeira grande): {x,y,vx,vy,life,age,c,s}
  function burst(x, y, n, cols, spd) {
    for (let i = 0; i < n && FX.length < 260; i++) { const a = -Math.PI / 2 + (rnd(i * 3.1 + x) - 0.5) * 2.2, v = (0.5 + rnd(i + y) * 0.8) * (spd || 220); FX.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.1 + rnd(i * 7) * 0.6, age: 0, c: cols[i % cols.length], s: 2.5 + rnd(i * 5) * 2.5 }); }
  }
  const CONF = ['#D8574E', '#F3C94A', '#3F78C8', '#5FA04A', '#FFFAEE', '#E8707A'];
  let lastT = null;

  /* ---------- layout (x de mundo), medido da estátua pra fora ---------- */
  const GATE_W = 240, HPW = 240, HSW = 48, HGW = HPW + HSW, MSW = 76, MGAP = 30, SEC_GAP = 120;
  const MW = { trator: 152, empilhadeira: 150, colheita: 170, escav: 330 }, MH = { trator: 124, empilhadeira: 116, colheita: 135, escav: 190 };
  const MK = { trator: 0.86, empilhadeira: 0.86, colheita: 0.84, escav: 0.74 };   // escala no pátio (coleção arrumada: um tico menor que a frota de verdade)
  const PITCH = 1.1;   // distância entre vagas (× largura da máquina)
  const L = { R: 0, L: 0, gate: 0, hand: {}, mid: {}, handL: 0, midR: 0, midL: 0, band: {} };
  let layR = NaN;
  function layout() {
    const W = G.World, X = W && W.X; const R = X && X.estatua ? X.estatua - 260 : -6000;
    if (R === layR) return L;
    layR = R; L.R = R; L.gate = R - GATE_W / 2;
    let x = R - GATE_W;
    for (const id of PA.HAND) { L.hand[id] = { x0: x - HGW, x1: x, px0: x - HGW, px1: x - HSW, sx: x - HSW / 2 }; x -= HGW; }
    L.handL = x; x -= SEC_GAP; L.midR = x;
    for (const id of PA.MID) { const w = MW[id] * MK[id], gw = Math.round(w * PITCH * 4 + 24) + MSW; L.mid[id] = { x0: x - gw, x1: x, bx0: x - gw, bx1: x - MSW, sx: x - MSW / 2, w }; x -= gw + MGAP; }
    L.midL = x + MGAP; L.L = L.midL - 90;
    // faixas do horizonte das gigantes: caminhão perto do portão, pá de cabo no meio, Bagger no fundo do pátio
    const span = R - L.L;
    L.band.caminhao = [R - span * 0.3, R - 60]; L.band.pacabo = [R - span * 0.64, R - span * 0.3]; L.band.bagger = [L.L + 40, R - span * 0.64];
    return L;
  }

  /* ---------- placas "×N" ---------- */
  function signImg(id, shown, marcos, tier, klass) {
    const big = klass === 'mid', w = big ? 70 : 62, h = big ? 38 : 34, k = 3;
    const key = 'sg|' + id + '|' + shown + '|' + (marcos | 0) + '|' + (tier >= T500 ? 9 : Math.min(tier, 4)) + '|' + klass;
    return cached(key, w + 8, h + 10, k, cg => {
      const frame = tier >= T100 ? PAL.gold : tier >= T10 ? (PA.COLORS[id] || PAL.wood) : PAL.wood, gold = tier >= T500;
      Draw.box(cg, 2, 2, w + 4, h + 4, frame, { r: 4, ol: 1.4 });
      Draw.box(cg, 5, 5, w - 2, h - 2, gold ? '#FFF1BE' : shown ? PAL.cream : '#D9D2C2', { r: 3, ol: 0.8 });
      if (gold) { cg.fillStyle = PAL.goldL; cg.fillRect(4, 3, w + 1, 1.4); cg.fillStyle = PAL.goldD; cg.fillRect(4, h + 4, w + 1, 1.2); }
      const ic = G.Props && G.Props.icon ? G.Props.icon(id) : null, is = big ? 1.8 : 1.65;
      if (ic) { cg.imageSmoothingEnabled = false; if (!shown) cg.globalAlpha = 0.45; cg.drawImage(ic, 7, 4 + (h - 16 * is) / 2 + 2, 16 * is, 16 * is); cg.globalAlpha = 1; }
      const tx = 7 + 16 * is + (w - 4 - 16 * is) / 2, txt = shown ? '×' + fmtN(shown) : 'vaga';
      cg.font = '900 ' + (big ? 15 : 11) + 'px system-ui, sans-serif'; const tw = cg.measureText(txt).width, sz = Math.min(big ? 15 : 11, (big ? 15 : 11) * (w - 10 - 16 * is) / Math.max(1, tw));
      Draw.text(cg, txt, tx, 4 + h / 2 + (marcos ? -1 : 1), { size: sz, col: shown ? PAL.ink : '#8A8070', sw: 0 });
      if (marcos) { cg.fillStyle = PAL.goldD; const nm = Math.min(13, marcos), pw = Math.min(3, (w - 8) / 13); for (let i = 0; i < nm; i++) { cg.fillStyle = PAL.gold; cg.fillRect(7 + 16 * is + 1 + i * pw * 1.0, h - 1, Math.max(1, pw - 0.8), 2.2); } }
    });
  }
  // drawSign: poste + placa, base no chão em (x, yb); cresce com o zoom aberto pra continuar legível (sz0 = zoom em que ela é 1x)
  function drawSign(g, id, x, yb, post, klass, z, t) {
    const s = st(id), p = PATIO[id] || {}, tier = tierOf(s.n | 0);
    const age = t - s.popT, pop = age >= 0 && age < 0.55 ? 1 + 0.45 * Math.pow(1 - age / 0.55, 2) * Math.cos(age * 14) : 1;
    let shown = s.n | 0; if (age >= 0 && age < 0.45 && s.dn > 1) shown = Math.round(lerp(s.from, s.n, age / 0.45));
    const o = signImg(id, shown, p.marcos | 0, tier, klass);
    const zk = clamp((klass === 'mid' ? 0.5 : 0.85) / Math.max(0.05, z), 1, klass === 'mid' ? 1.9 : 2.3), sc = zk * pop;
    const top = yb - post * zk;
    g.fillStyle = LINE; g.fillRect(x - 2.4 * zk, top, 4.8 * zk, yb - top); g.fillStyle = tier >= T100 ? PAL.gold : '#9A8A72'; g.fillRect(x - 1.2 * zk, top, 2.4 * zk, yb - top);
    blitText(g, o, x - o.w * sc / 2, top - o.h * sc + 4 * sc, sc);
    if (age >= 0 && age < 1.2 && s.dn > 0) Draw.text(g, '+' + fmtN(s.dn), x, top - o.h * sc - 8 - age * 34, { size: 15 * zk, col: '#FFE68A', sw: 4 * zk, alpha: Math.min(1, (1.2 - age) * 2) });
  }

  /* ---------- peças de cenário (todas em cache) ---------- */
  function shedImg(id) {   // galpãozinho de ferramentas da turma (25+)
    return cached('shed|' + id, 56, 60, 2, cg => {
      const c = PA.COLORS[id];
      Draw.poly(cg, [[2, 22], [28, 6], [54, 22]], mix(c, '#3B2818', 0.25), { ol: 1.2 });
      Draw.box(cg, 6, 22, 44, 36, '#E9DCBE', { ol: 1.2 }); Draw.box(cg, 18, 34, 20, 24, '#7A5228', { ol: 1 });
      cg.fillStyle = '#5E3C26'; cg.fillRect(27.4, 35, 1.2, 22); Draw.box(cg, 9, 27, 7, 6, PAL.glass, { ol: 0.8 }); Draw.box(cg, 40, 27, 7, 6, PAL.glass, { ol: 0.8 });
      const ic = G.Props.icon(id); cg.imageSmoothingEnabled = false; cg.drawImage(ic, 22, 9, 12, 12);
    });
  }
  function bannerImg(id, w) {   // faixa com o nome da turma (50+)
    return cached('ban|' + id + '|' + w, w, 18, 3, cg => {
      Draw.box(cg, 1, 2, w - 2, 13, PA.COLORS[id], { r: 2, ol: 1 });
      Draw.text(cg, PA.NAMES[id] || id, w / 2, 9, { size: Math.min(9, (w - 10) / Math.max(1, (PA.NAMES[id] || id).length) * 1.7), col: PAL.cream, sw: 0 });
    });
  }
  // brilho dourado: estrelinhas de 4 pontas piscando num retângulo (patamar de ouro, 500+)
  function sparkle(g, x, y, w, h, t, n, seed) {
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.9 + rnd(i * 5.3 + seed)) % 1, a = Math.sin(ph * Math.PI); if (a < 0.15) continue;
      const cyc = Math.floor(t * 0.9 + rnd(i * 5.3 + seed)), sx = x + rnd(i * 11.7 + cyc * 3.1 + seed) * w, sy = y + rnd(i * 7.9 + cyc * 1.3 + seed) * h, r = 2 + 4 * a;
      g.fillStyle = a > 0.7 ? '#FFFFFF' : PAL.goldL; g.globalAlpha = a;
      g.fillRect(sx - r, sy - 0.8, r * 2, 1.6); g.fillRect(sx - 0.8, sy - r, 1.6, r * 2); g.fillRect(sx - 1.4, sy - 1.4, 2.8, 2.8);
    }
    g.globalAlpha = 1;
  }
  // placa de ouro (500+): moldura dourada em 3 tons, estrelas e o título
  function goldPlateImg(txt, w) {
    return cached('gpl|' + txt + '|' + w, w, 30, 3, cg => {
      Draw.box(cg, 1, 2, w - 2, 26, PAL.goldD, { r: 5, ol: 1.4 }); Draw.box(cg, 4, 4, w - 8, 21, PAL.gold, { r: 4, ol: 0.8 });
      cg.fillStyle = PAL.goldL; cg.fillRect(7, 5.5, w - 14, 2.2); cg.fillStyle = mix(PAL.goldD, PAL.gold, 0.4); cg.fillRect(7, 21, w - 14, 2);
      for (const sx of [13, w - 13]) { Draw.poly(cg, [[sx, 8], [sx + 2.2, 13], [sx + 6, 14], [sx + 2.5, 16.5], [sx + 3.5, 21], [sx, 18.5], [sx - 3.5, 21], [sx - 2.5, 16.5], [sx - 6, 14], [sx - 2.2, 13]], '#FFF1BE', { ol: 0.8 }); }
      Draw.text(cg, txt, w / 2, 14.5, { size: Math.min(11, (w - 44) / Math.max(1, txt.length) * 1.75), col: '#6B4512', sw: 0 });
    });
  }
  // QG da turma (100+): pagode de madeira na cor da turma, 1 andar a cada patamar (cresce junto com os estacionamentos das máquinas)
  const PG_FH = 62;
  function pagodaImg(id, lv, gold) {
    const W0 = 236, H0 = lv * PG_FH + 92;
    return cached('pgd|' + id + '|' + lv + '|' + (gold ? 1 : 0), W0, H0, 2, cg => {
      const c = PA.COLORS[id], roof = gold ? PAL.gold : mix(c, '#3B2818', 0.18), roofL = gold ? PAL.goldL : mix(c, '#FFFFFF', 0.25), roofD = gold ? PAL.goldD : mix(c, '#3B2818', 0.45), cx = W0 / 2;
      Draw.box(cg, cx - 100, H0 - 14, 200, 13, '#CFC8B6', { ol: 1.3, top: '#E3DDD0' });
      for (let f = 0; f < lv; f++) {
        const ww = 168 - f * 12, yb = H0 - 14 - f * PG_FH, yt = yb - PG_FH + 16;
        Draw.box(cg, cx - ww / 2, yt, ww, yb - yt, '#EFE3C6', { ol: 1.2 });
        cg.fillStyle = '#7A5228'; cg.fillRect(cx - ww / 2 + 1, yb - 5, ww - 2, 4);
        for (const px of [cx - ww / 2 + 3, cx + ww / 2 - 7]) { cg.fillStyle = '#7A5228'; cg.fillRect(px, yt + 1, 4, yb - yt - 2); }
        const nwin = Math.max(2, Math.floor(ww / 40));
        for (let i = 0; i < nwin; i++) {
          const wx = cx - ww / 2 + 14 + i * (ww - 28) / nwin + ((ww - 28) / nwin - 20) / 2, wy = yt + 8;
          Draw.box(cg, wx, wy, 20, 22, '#FFD98A', { ol: 1 });
          if ((i + f) % 2 === 0) {   // carinha de shiba espiando na janela
            const fx = wx + 10, fy = wy + 17, fur = ['#E2914A', '#FFFAEE', '#4A3A32'][(i + f * 2) % 3];
            cg.fillStyle = LINE; cg.beginPath(); cg.arc(fx, fy, 6.4, Math.PI, 0); cg.fill(); cg.fillRect(fx - 6.4, fy, 12.8, 5);
            cg.beginPath(); cg.moveTo(fx - 6.5, fy - 1); cg.lineTo(fx - 4.5, fy - 10); cg.lineTo(fx - 1, fy - 4); cg.moveTo(fx + 6.5, fy - 1); cg.lineTo(fx + 4.5, fy - 10); cg.lineTo(fx + 1, fy - 4); cg.fill();
            cg.fillStyle = fur; cg.beginPath(); cg.arc(fx, fy, 5.2, Math.PI, 0); cg.fill(); cg.fillRect(fx - 5.2, fy, 10.4, 4.6);
            cg.beginPath(); cg.moveTo(fx - 5.2, fy - 1.5); cg.lineTo(fx - 4.3, fy - 8); cg.lineTo(fx - 1.6, fy - 4); cg.moveTo(fx + 5.2, fy - 1.5); cg.lineTo(fx + 4.3, fy - 8); cg.lineTo(fx + 1.6, fy - 4); cg.fill();
            cg.fillStyle = LINE; cg.fillRect(fx - 3, fy - 1, 1.6, 1.6); cg.fillRect(fx + 1.6, fy - 1, 1.6, 1.6); cg.fillRect(fx - 0.8, fy + 1.2, 1.6, 1.2);
          } else { cg.fillStyle = '#E8B95A'; cg.fillRect(wx + 9.3, wy + 1, 1.4, 20); cg.fillRect(wx + 1, wy + 10.3, 18, 1.4); }
          cg.fillStyle = LINE; cg.fillRect(wx - 1, wy + 21, 22, 2.2);
        }
        // telhado com beiral curvo
        const rw = ww / 2 + 22, ry = yt + 2;
        Draw.poly(cg, [[cx - rw, ry + 2], [cx - rw + 10, ry - 6], [cx - ww / 2 + 6, ry - 12], [cx + ww / 2 - 6, ry - 12], [cx + rw - 10, ry - 6], [cx + rw, ry + 2], [cx + rw - 16, ry - 1], [cx - rw + 16, ry - 1]], roof, { ol: 1.3 });
        cg.fillStyle = roofL; cg.fillRect(cx - ww / 2 + 6, ry - 11, ww - 12, 2.2); cg.fillStyle = roofD; cg.fillRect(cx - rw + 16, ry - 2.6, rw * 2 - 32, 1.8);
        if (gold) { cg.fillStyle = '#FFF6D0'; cg.fillRect(cx - rw + 2, ry, 3, 2); cg.fillRect(cx + rw - 5, ry, 3, 2); }
      }
      // telhado de cima + medalhão gigante da ferramenta + sorin (pináculo)
      const tw = 168 - lv * 12, ty = H0 - 14 - lv * PG_FH + 16;
      Draw.poly(cg, [[cx - tw / 2 - 18, ty + 2], [cx, ty - 26], [cx + tw / 2 + 18, ty + 2]], roof, { ol: 1.3 });
      cg.fillStyle = roofL; cg.beginPath(); cg.moveTo(cx - tw / 2 - 8, ty - 2); cg.lineTo(cx, ty - 22); cg.lineTo(cx + 6, ty - 20); cg.lineTo(cx - tw / 2, ty - 1); cg.fill();
      cg.fillStyle = LINE; cg.fillRect(cx - 2.2, ty - 60, 4.4, 36); cg.fillStyle = PAL.gold; cg.fillRect(cx - 1, ty - 60, 2, 35);
      for (let r = 0; r < 4; r++) Draw.box(cg, cx - 6 + r, ty - 32 - r * 7, 12 - r * 2, 3.4, PAL.gold, { ol: 0.8 });
      Draw.circle(cg, cx, ty - 66, 4, PAL.goldL, { ol: 1 });
      const ic = G.Props && G.Props.icon ? G.Props.icon(id) : null, my = ty - 6;
      Draw.circle(cg, cx, my, 19, gold ? PAL.goldL : PAL.cream, { ol: 1.4 }); Draw.circle(cg, cx, my, 15.5, gold ? PAL.gold : c, { ol: 0.8 });
      if (ic) { cg.imageSmoothingEnabled = false; cg.drawImage(ic, cx - 12, my - 12, 24, 24); }
    });
  }
  function bleachImg(id, f) {   // arquibancada com torcida (100+), 2 quadros: degraus de trás pra frente, torcida sentada em cada um
    return cached('blc|' + id + '|' + f, 92, 66, 2, cg => {
      cg.imageSmoothingEnabled = true;
      for (let b = 2; b >= 0; b--) {
        const yt = 50 - b * 15, x0 = 4 + b * 7, x1 = 88 - b * 7;
        Draw.box(cg, x0, yt, x1 - x0, 64 - yt, b % 2 ? '#B9C0C8' : '#D3D8DE', { ol: 1, top: '#EEF1F4' });
        const nn = b === 0 ? 4 : b === 1 ? 4 : 3;
        for (let i = 0; i < nn; i++) {
          const x = x0 + 9 + i * (x1 - x0 - 18) / Math.max(1, nn - 1);
          E.drawShiba(cg, x, yt + 2, (i + b) % 3 === 0 ? 'wave' : 'cheer', ((f + i + b) % 2) * 0.25 + 0.05, { pal: uniPal(id, i + b), scale: 0.52, smooth: true, shadow: false, face: i % 2 ? -1 : 1 });
        }
      }
      cg.fillStyle = PA.COLORS[id]; cg.fillRect(4, 62, 84, 2);
    });
  }
  function statueImg(id) {   // estátua dourada da turma (250+)
    return cached('stt|' + id, 44, 96, 2, cg => {
      Draw.box(cg, 6, 66, 32, 28, '#CFC8B6', { ol: 1.2 }); Draw.box(cg, 3, 62, 38, 7, '#E3DDD0', { ol: 1.2 });
      cg.imageSmoothingEnabled = false; E.drawShiba(cg, 22, 63, 'proud', 0.3, { pal: GOLD_PAL, scale: 1.2, smooth: false, shadow: false });
      const ic = G.Props.icon(id); cg.drawImage(ic, 14, 72, 16, 16);
    });
  }
  function screenImg(id, n) {   // telão com o número (200+)
    return cached('scr|' + id + '|' + n, 84, 56, 3, cg => {
      Draw.box(cg, 39, 30, 6, 26, PAL.steelD, { ol: 1 });
      Draw.box(cg, 2, 2, 80, 32, '#2B2A3A', { r: 3, ol: 1.4 }); Draw.box(cg, 6, 6, 72, 24, '#1C1B26', { r: 2, ol: 0 });
      const ic = G.Props.icon(id); cg.imageSmoothingEnabled = false; cg.drawImage(ic, 9, 9, 18, 18);
      Draw.text(cg, '×' + fmtN(n), 52, 18.5, { size: Math.min(15, 150 / String(n).length / 2.2 + 4), col: '#FFD36B', sw: 0 });
      cg.fillStyle = 'rgba(255,255,255,.08)'; for (let y = 7; y < 30; y += 2) cg.fillRect(6, y, 72, 0.6);
    });
  }
  function blimpImg(id) {   // dirigível da turma (300+)
    return cached('blp|' + id, 120, 50, 2, cg => {
      const c = PA.COLORS[id];
      Draw.poly(cg, [[88, 22], [112, 8], [114, 20], [112, 36]], mix(c, '#3B2818', 0.2), { ol: 1.2 });
      cg.fillStyle = LINE; cg.beginPath(); cg.ellipse(56, 22, 49, 18, 0, 0, TAU); cg.fill();
      cg.fillStyle = PAL.cream; cg.beginPath(); cg.ellipse(56, 22, 47.5, 16.5, 0, 0, TAU); cg.fill();
      cg.fillStyle = c; cg.fillRect(8, 18, 96, 8); cg.fillStyle = 'rgba(255,255,255,.6)'; cg.beginPath(); cg.ellipse(44, 13, 26, 4, 0, 0, TAU); cg.fill();
      Draw.box(cg, 44, 38, 24, 9, '#5C6672', { r: 2, ol: 1 }); cg.fillStyle = PAL.glass; cg.fillRect(48, 40, 4, 4); cg.fillRect(55, 40, 4, 4); cg.fillRect(62, 40, 4, 4);
      const ic = G.Props.icon(id); cg.imageSmoothingEnabled = false; cg.drawImage(ic, 22, 14, 16, 16);
    });
  }
  function gateImg() {   // portal do pátio
    return cached('gate', 230, 260, 2, cg => {
      for (const px of [24, 206]) { Draw.box(cg, px - 9, 40, 18, 220, '#C8423A', { ol: 1.4 }); Draw.box(cg, px - 13, 248, 26, 12, '#5C6672', { ol: 1.2 }); }
      Draw.box(cg, 4, 26, 222, 16, '#3E4650', { ol: 1.4 }); Draw.box(cg, 14, 54, 202, 10, '#C8423A', { ol: 1.2 });
      Draw.sign(cg, 38, 2, 154, 34, 'PÁTIO DA FROTA', { col: '#2F4670', ink: PAL.cream });
      Draw.hazard(cg, 15, 230, 18, 18); Draw.hazard(cg, 197, 230, 18, 18);
    });
  }
  function garageImg(id, w, h, doors, k) {   // garagem (25+) / galpão com portas (50+)
    const W0 = w, H0 = h;
    return cached('gar|' + id + '|' + doors + '|' + Math.round(w) + '|' + k, W0, H0, k, cg => {
      const c = PA.COLORS[id];
      Draw.box(cg, 2, 14, W0 - 4, H0 - 16, '#D6CFC4', { ol: 1.4, panels: Math.max(2, Math.round(W0 / 60)) });
      Draw.box(cg, 0, 4, W0, 14, '#5C6672', { ol: 1.4 });
      const dw = Math.min(MW[id] * 0.95, (W0 - 20) / doors - 14), dh = Math.min(H0 - 40, MH[id] * 0.95);
      for (let i = 0; i < doors; i++) {
        const dx = 10 + (i + 0.5) * (W0 - 20) / doors - dw / 2;
        Draw.box(cg, dx, H0 - 2 - dh, dw, dh, '#9AA6B2', { ol: 1.2 });
        cg.fillStyle = '#808A96'; for (let y = H0 - dh + 4; y < H0 - 4; y += 7) cg.fillRect(dx + 2, y, dw - 4, 1.6);
        Draw.hazard(cg, dx, H0 - 8, dw, 6);
      }
      cg.fillStyle = c; cg.fillRect(2, 18, W0 - 4, 5);
      if (doors > 1) Draw.sign(cg, W0 / 2 - Math.min(150, W0 * 0.6) / 2, 26, Math.min(150, W0 * 0.6), 18, PA.NAMES[id], { col: c, ink: PAL.cream });
    });
  }
  // estacionamento de andares (100+): N andares com fileiras de máquinas miniatura
  function parkingImg(id, levels, mini, k) {
    const w = L.mid[id].bx1 - L.mid[id].bx0, lh = Math.max(64, MH[id] * 0.62), H0 = levels * lh + 26;
    return cached('prk|' + id + '|' + levels + '|' + k + '|' + (mini ? 1 : 0), w, H0, k, cg => {
      const c = PA.COLORS[id];
      for (let l = 0; l < levels; l++) {
        const y = H0 - (l + 1) * lh;
        Draw.box(cg, 0, y, w, 9, '#B7AFA2', { ol: 1.2 });
        cg.fillStyle = '#7D766B'; cg.fillRect(2, y + 9, w - 4, lh - 9); cg.fillStyle = '#6A645A'; cg.fillRect(2, y + lh - 6, w - 4, 6);
        for (let px = 8; px < w - 4; px += Math.max(70, w / 6)) Draw.box(cg, px, y + 9, 7, lh - 9, '#CFC8B6', { ol: 1 });
        if (mini) { const mw = mini.w * mini.s, nn = Math.max(1, Math.floor((w - 20) / (mw * 1.1))); for (let i = 0; i < nn; i++) cg.drawImage(mini.c, 14 + i * (w - 28) / nn + ((w - 28) / nn - mw) / 2, y + lh - mini.h * mini.s + 2, mw, mini.h * mini.s); }
        cg.fillStyle = c; cg.fillRect(0, y + 7, w, 2);
      }
      Draw.box(cg, 0, 0, w, 16, '#5C6672', { ol: 1.4 });
      Draw.sign(cg, w / 2 - Math.min(170, w * 0.6) / 2, 2, Math.min(170, w * 0.6), 13, 'ESTACIONAMENTO · ' + PA.NAMES[id], { col: c, ink: PAL.cream });
    });
  }

  /* ---------- máquinas médias e gigantes: rig de verdade desenhado numa imagem (2 quadros) ---------- */
  const MACH = new Map();
  const INP = { x: 0, y: 0, floor: () => 0, face: 1, digging: false, night: 0 };
  function machImg(id, f, k, variant) {
    const key = id + '|' + f + '|' + k + '|' + variant; let o = MACH.get(key);
    if (o) return o;
    const T0 = G.Tools && G.Tools[id]; if (!T0) return null;
    const w = (T0.w || 300) * 1.7, h = (T0.h || 200) * 1.55 + 30, c = mkc(w * k, h * k), cg = c.getContext('2d');
    try {
      const pilot = variant === 'uni' ? uniPal(id, 1) : (variant === 'gold' ? GOLD_PAL : ['goma', 'shiro', 'kuro', 'cha', 'aka'][PA.MID.indexOf(id) % 5] || 'goma');
      const m = T0.create({ pilot, scale: 1, x: 0, stage: 3 }), dt = 1 / 30;
      for (let i = 0; i < 40 + f * 7; i++) T0.update(m, dt, INP);
      const z0 = Draw.zoom, m0 = Draw.minPx; Draw.lod(Math.max(0.6, k), 0.6);
      cg.setTransform(k, 0, 0, k, w * k * 0.5, (h - 24) * k); cg.lineJoin = 'round'; cg.lineCap = 'round';
      T0.draw(cg, m); Draw.lod(z0, m0);
      if (variant === 'gold') { cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'source-atop';
        const gr = cg.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, 'rgba(255,236,150,.55)'); gr.addColorStop(0.55, 'rgba(243,190,60,.5)'); gr.addColorStop(1, 'rgba(160,110,30,.5)');
        cg.fillStyle = gr; cg.fillRect(0, 0, c.width, c.height); cg.globalCompositeOperation = 'source-over'; }
    } catch (e) { /* rig que não sabe desenhar fora do jogo: fica sem imagem */ }
    o = { c, w, h, ax: w * 0.5, ay: h - 24 }; MACH.set(key, o);
    return o;
  }
  // silhueta de gigante na névoa (camada L: 0 perto … 2 longe)
  function giantImg(id, layer, tint, gold) {
    const key = 'gi|' + id + '|' + layer + '|' + tint + '|' + (gold ? 1 : 0); let o = MACH.get(key);
    if (o) return o;
    const sc = { caminhao: [0.3, 0.21, 0.14], pacabo: [0.24, 0.17, 0.115], bagger: [0.17, 0.12, 0.085] }[id][layer], k = 1.6;
    const src = machImg(id, 0, 0.6, 'n'); if (!src) return null;
    const w = src.w * sc, h = src.h * sc, c = mkc(w * k, h * k), cg = c.getContext('2d');
    cg.drawImage(src.c, 0, 0, c.width, c.height);
    cg.globalCompositeOperation = 'source-atop';
    const haze = [0.66, 0.78, 0.88][layer];
    cg.globalAlpha = gold ? 0.45 : haze; cg.fillStyle = gold ? '#F3C94A' : tint; cg.fillRect(0, 0, c.width, c.height);
    cg.globalAlpha = 1; cg.globalCompositeOperation = 'source-over';
    o = { c, w, h, ax: src.ax * sc, ay: src.ay * sc }; MACH.set(key, o);
    return o;
  }

  /* ---------- PÁTIO FALSO (?patio=… / G.PatioArt.fake) ---------- */
  const ALL = PA.HAND.concat(PA.MID, PA.GIANT);
  const PRESET = {
    demo: { pata: 120, hashi: 64, tigela: 30, pa: 12, duaspas: 6, carrinho: 3, britadeira: 1, trator: 26, empilhadeira: 9, colheita: 4, escav: 2, caminhao: 12, pacabo: 5, bagger: 2 },
    poucos: { pata: 5, hashi: 4, tigela: 3, pa: 3, duaspas: 2, carrinho: 2, britadeira: 1, trator: 3, empilhadeira: 2, colheita: 1, escav: 1, caminhao: 2, pacabo: 1, bagger: 1 },
    medio: { pata: 25, hashi: 22, tigela: 18, pa: 14, duaspas: 12, carrinho: 10, britadeira: 10, trator: 25, empilhadeira: 15, colheita: 12, escav: 10, caminhao: 10, pacabo: 6, bagger: 3 },
    cheio: { pata: 100, hashi: 100, tigela: 90, pa: 75, duaspas: 60, carrinho: 55, britadeira: 50, trator: 100, empilhadeira: 80, colheita: 60, escav: 50, caminhao: 40, pacabo: 25, bagger: 12 },
    absurdo: { pata: 500, hashi: 450, tigela: 400, pa: 350, duaspas: 300, carrinho: 260, britadeira: 220, trator: 500, empilhadeira: 300, colheita: 250, escav: 200, caminhao: 150, pacabo: 100, bagger: 50, trembala: 30, foguete: 12, fuji: 3, portal: 30 },
  };
  let FAKE = null, PATIO = {};
  function milestones(n) { const M = [1, 5, 25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]; let k = 0; while (k < M.length && n >= M[k]) k++; return k; }
  function fake(spec) {
    spec = String(spec || 'demo');
    const m = /^\+(\d*)([a-z]+)$/.exec(spec);
    if (m) { FAKE = FAKE || {}; const id = m[2], d = +(m[1] || 1); const o = FAKE[id] || (FAKE[id] = { n: 0, marcos: 0 }); o.n += d; o.marcos = milestones(o.n); return FAKE; }
    const out = {};
    if (PRESET[spec]) for (const id in PRESET[spec]) out[id] = PRESET[spec][id];
    else if (/^\d+$/.test(spec)) for (const id of ALL) out[id] = +spec;
    else for (const kv of spec.split(',')) { const [id, v] = kv.split(':'); if (id) out[id.trim()] = +v || 0; }
    FAKE = {}; for (const id in out) FAKE[id] = { n: out[id], marcos: milestones(out[id]) };
    return FAKE;
  }
  try { const q = /[?&]patio=([^&]*)/.exec(location.search); if (q) fake(decodeURIComponent(q[1]) || 'demo'); } catch (e) { /* sem location */ }

  /* ======================================================================================================
     DESENHO
     ====================================================================================================== */
  const stats = { ms: 0, avg: 0, figs: 0, groupSpr: 0, mach: 0, n: 0 };
  let figs = 0;
  const Y_BACK = 6, Y_FRONT = 32, K_BACK = 0.8, K_FRONT = 0.9;
  // posições na turma (x local no canteiro, fila, rosto) na ordem em que os shibas chegam
  const SLOT = [[96, 1, 1], [146, 1, -1], [82, 0, 1], [160, 0, -1], [56, 1, 1], [190, 1, -1], [40, 0, 1], [206, 0, -1]];
  const MOUND_X = 121;

  function drawFig(g, fr, x, y, k, face, alpha) {
    const w = FW * k, h = FH * k;
    if (alpha !== undefined) g.globalAlpha = alpha;
    if (face < 0) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(fr, -FAX * k, y - FAY * k, w, h); g.restore(); }
    else g.drawImage(fr, x - FAX * k, y - FAY * k, w, h);
    if (alpha !== undefined) g.globalAlpha = 1;
    figs++;
  }
  function crewPos(id, i, t, x0) {   // x/rosto de quem está na vaga i (o carrinho vai e volta)
    const s = SLOT[i]; let x = x0 + s[0], face = s[2];
    if (id === 'carrinho') { const ph = t * 0.8 + i * 1.7, o = Math.sin(ph) * 20; x += o; face = Math.cos(ph) >= 0 ? 1 : -1; }
    return [x, s[1] ? Y_FRONT : Y_BACK, s[1] ? K_FRONT : K_BACK, face];
  }
  function frameIdx(id, i, t) { return Math.floor((t / CREW[id].cyc + i * 0.37) * NF) % NF; }
  // imagem de grupo do canteiro (zoom aberto / acima do teto de figuras): os 8 numa imagem só, 2 quadros
  function crewGroup(id, nw, uni, f, k) {
    return cached('cg2|' + id + '|' + nw + '|' + (uni ? 1 : 0) + '|' + f, HPW, 96, k, cg => {
      cg.imageSmoothingEnabled = k < 1;
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < nw; i++) {
        const s = SLOT[i]; if (s[1] !== pass) continue;
        const fr = crewFrames(id, i, uni)[(f * 3 + i) % NF], kk = s[1] ? K_FRONT : K_BACK, y = (s[1] ? Y_FRONT : Y_BACK) + 46;
        if (s[2] < 0) { cg.save(); cg.translate(s[0], 0); cg.scale(-1, 1); cg.drawImage(fr, -FAX * kk, y - FAY * kk, FW * kk, FH * kk); cg.restore(); }
        else cg.drawImage(fr, s[0] - FAX * kk, y - FAY * kk, FW * kk, FH * kk);
      }
    });
  }
  function mound(g, x, y, t, gold, i) {
    const h = 22 + 3 * Math.sin(t * 1.1 + i * 2), w = 36;
    g.fillStyle = gold ? PAL.gold : PAL.rice; g.strokeStyle = LINE; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.35, y - h * 1.15, x, y - h); g.quadraticCurveTo(x + w * 0.4, y - h * 1.1, x + w, y); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = gold ? PAL.goldL : PAL.riceS; g.beginPath(); g.ellipse(x - 8, y - 4, 4, 1.6, 0.3, 0, TAU); g.ellipse(x + 9, y - 6, 4, 1.6, -0.3, 0, TAU); g.fill();
    if (gold && Math.sin(t * 5 + i) > 0.6) { g.fillStyle = '#FFFFFF'; g.fillRect(x - 3 + Math.sin(t * 3) * 10, y - h + 3, 2, 2); }
  }
  function plotFloor(id, tier) {
    return cached('pf|' + id + '|' + Math.min(tier, 10), HPW, 48, 2, cg => {
      const c = PA.COLORS[id], gold = tier >= T500;
      Draw.box(cg, 6, 8, HPW - 12, 36, gold ? '#E9C76A' : '#B58B57', { ol: 1.2 });
      cg.fillStyle = gold ? '#D9B24A' : '#A27A48'; for (let i = 0; i < 9; i++) cg.fillRect(14 + i * 25, 18 + (i % 3) * 7, 10, 1.6);
      const curb = tier >= T100 ? PAL.gold : tier >= T10 ? c : PAL.woodL;
      cg.fillStyle = LINE; cg.fillRect(4, 40, HPW - 8, 6.4); cg.fillStyle = curb; cg.fillRect(5, 41, HPW - 10, 4.4); cg.fillStyle = mix(curb, '#3B2818', 0.3); cg.fillRect(5, 44, HPW - 10, 1.4);
      if (tier >= T10) for (const px of [8, HPW - 8]) { Draw.box(cg, px - 2, 0, 4, 44, PAL.woodD, { ol: 1 }); Draw.poly(cg, [[px + 2, 1], [px + 13, 5], [px + 2, 9]], c, { ol: 1 }); }
    });
  }

  // uma turma de mão inteira
  function drawHand(g, id, t, z, useGroup, nightK) {
    const Lg = L.hand[id], s = st(id), n = s.n | 0, tier = tierOf(n), x0 = Lg.px0, uni = tier >= T10, c = PA.COLORS[id];
    const nw = Math.min(PA.CREW_MAX, n);
    // --- fundo da turma (patamares) --- (escala pensada pra ficar à altura dos estacionamentos de andares das máquinas)
    const gold = tier >= T500;
    if (tier >= T100) {   // QG da turma: pagode que ganha andar a cada patamar
      const lv = Math.min(6, 2 + Math.floor((n - 100) / 50)), o = pagodaImg(id, lv, gold);
      blitText(g, o, x0 + HPW / 2 - o.w / 2, -4 - o.h);
      if (gold) sparkle(g, x0 + 10, -4 - o.h, HPW - 20, o.h - 20, t, 7, PA.HAND.indexOf(id) * 17);
    }
    if (tier >= T150) {   // 2º andar: deck sobre palafitas com mais uma turma
      const dy = -128;
      g.fillStyle = LINE; for (const px of [50, 120, 196]) g.fillRect(x0 + px - 2.5, dy, 5, -dy); g.fillStyle = PAL.woodD; for (const px of [50, 120, 196]) g.fillRect(x0 + px - 1.2, dy, 2.4, -dy);
      Draw.box(g, x0 + 36, dy - 20, 176, 22, gold ? '#E9C76A' : '#C49A66', { ol: 1.2, top: gold ? PAL.goldL : '#D9B07A' }); Draw.box(g, x0 + 36, dy + 2, 176, 7, gold ? PAL.goldD : PAL.woodD, { ol: 1.2 });
      const f = Math.floor(t * 4) % 2, o = crewGroup(id, 4, true, f, 1);
      mound(g, x0 + 36 + MOUND_X * 0.7, dy - 6, t, gold, 9);
      g.drawImage(o.c, x0 + 36, dy + 4 - 78 * 0.7, HPW * 0.7, 96 * 0.7);
      stats.groupSpr++;
    }
    if (tier >= T100) { const o = bleachImg(id, Math.floor(t * 3) % 2); g.drawImage(o.c, x0 + 51, -95, o.w * 1.5, o.h * 1.5); }
    if (tier >= T25) {
      const o = shedImg(id); blitText(g, o, x0 - 14, -80, 1.4);
      if (E.Nature && E.Nature.nobori) E.Nature.nobori(g, x0 + HPW - 10, 2, { t: t + PA.HAND.indexOf(id), col: c, h: tier >= T100 ? 120 : 84, s: tier >= T100 ? 1.3 : 1 });
    }
    if (tier >= T50) {
      const by = tier >= T100 ? -112 : -70, o = bannerImg(id, 150), bx0 = x0 + 14, bx1 = x0 + 226;
      g.fillStyle = LINE; g.fillRect(bx0 - 2, by, 4.4, 2 - by); g.fillRect(bx1 - 2, by, 4.4, 2 - by); g.fillStyle = gold ? PAL.gold : PAL.woodL; g.fillRect(bx0 - 0.8, by, 2, 2 - by); g.fillRect(bx1 - 0.8, by, 2, 2 - by);
      blitText(g, o, bx0 + 2, by - 4, (bx1 - bx0 - 4) / o.w);
      if (gold) { const gp = goldPlateImg('TURMA LENDÁRIA', 150); blitText(g, gp, x0 + HPW / 2 - 75, by - 40); }
      if (E.Nature && E.Nature.stall) E.Nature.stall(g, x0 + 190, 0, { s: 0.62, col: c, t, lit: nightK > 0.3 });
    }
    if (tier >= T100) {   // holofote
      const px = x0 + 6, top = -236; g.fillStyle = LINE; g.fillRect(px - 2.5, top, 5, 2 - top); g.fillStyle = PAL.steelD; g.fillRect(px - 1.2, top, 2.4, -top);
      Draw.box(g, px - 10, top - 10, 20, 10, '#5C6672', { ol: 1 });
      if (nightK > 0.2) { g.globalAlpha = 0.18 * nightK; g.fillStyle = '#FFF3C4'; g.beginPath(); g.moveTo(px - 8, top - 1); g.lineTo(px + 8, top - 1); g.lineTo(px + 160, 40); g.lineTo(px + 20, 40); g.closePath(); g.fill(); g.globalAlpha = 1; }
      Draw.light(g, px, top - 3, 3.2, '#FFE9A0', nightK > 0.2 ? 1 : 0.25, { halo: 3 });
    }
    // --- canteiro ---
    blit(g, plotFloor(id, tier), x0, -8);
    // sacos prontos ao lado do galpão (25+): pilha arrumada que cresce
    if (tier >= T25 && G.Props && G.Props.sack) { const sk = G.Props.sack(gold ? 'golden' : 'plain'), np = Math.min(6, 2 + tier); g.imageSmoothingEnabled = false; for (let i = 0; i < np; i++) { const r = i < 3 ? 0 : i < 5 ? 1 : 2, j = r === 0 ? i : r === 1 ? i - 3 : 0; g.drawImage(sk.cv, x0 + 14 + j * 11 + r * 5.5, 8 - r * 11 - sk.cv.height, sk.cv.width, sk.cv.height); } }
    const arrivals = s.arr;
    if (nw > 0) {
      if (useGroup) {
        const o = crewGroup(id, nw, uni, Math.floor(t * 4) % 2, z < 0.45 ? 0.5 : 1);
        g.drawImage(o.c, x0, -46, HPW, 96); stats.groupSpr++;
        mound(g, x0 + MOUND_X, 20, t, gold, PA.HAND.indexOf(id));
      } else {
        // troca de turno (50+): de 8 em 8 s alguém vai pra barraca e alguém volta
        let swapI = -1, su = 0;
        if (tier >= T50) { const cyc = 8, ph = (t + PA.HAND.indexOf(id) * 1.3) % cyc; if (ph < 2.4) { swapI = Math.floor((t + PA.HAND.indexOf(id) * 1.3) / cyc) % nw; su = ph / 2.4; } }
        for (let pass = 0; pass < 2; pass++) {
          if (pass === 1) mound(g, x0 + MOUND_X, 20, t, gold, PA.HAND.indexOf(id));
          for (let i = 0; i < nw; i++) {
            if (SLOT[i][1] !== pass) continue;
            if (arrivals.length && arrivals.some(a => a.slot === i && t < a.t0 + 1.3)) continue;
            const p = crewPos(id, i, t, x0);
            if (i === swapI) {
              const tx = x0 + 168, a = U.smooth ? U.smooth(su) : su;
              E.drawShiba(g, lerp(p[0], tx, a), p[1], 'walk', t, { pal: palOf(id, i, uni), face: 1, scale: p[2] * 0.9 });
              E.drawShiba(g, lerp(tx, p[0], a), p[1] + 2, 'walk', t + 0.3, { pal: palOf(id, i + 1, uni), face: -1, scale: p[2] * 0.9 });
              figs += 2; continue;
            }
            drawFig(g, crewFrames(id, i, uni)[frameIdx(id, i, t)], p[0], p[1], p[2], p[3]);
          }
        }
        if (tier >= T50) {   // quem está de folga na barraca
          E.drawShiba(g, x0 + 172, 4, 'eat', t, { pal: palOf(id, 5, uni), face: 1, scale: 0.72 }); E.drawShiba(g, x0 + 206, 4, 'sit', t + 1, { pal: palOf(id, 6, uni), face: -1, scale: 0.72 }); figs += 2;
        }
      }
    }
    // carregadores (25+): fila de 2 levando saco do montinho pra pilha, com poeirinha
    if (tier >= T25 && !useGroup && nw > 0) {
      const sk = G.Props && G.Props.sack ? G.Props.sack(gold ? 'golden' : 'plain') : null;
      for (let k = 0; k < 2; k++) {
        const u = ((t * 0.16 + k * 0.5) % 1), go = u < 0.5, q = go ? u * 2 : (1 - u) * 2, x = lerp(x0 + MOUND_X - 18, x0 + 30, q), y = 44;
        E.drawShiba(g, x, y, go ? 'carry' : 'walk', t + k, { pal: palOf(id, k + 3, uni), face: go ? -1 : 1, scale: 0.78 }); figs++;
        if (go && sk) { g.imageSmoothingEnabled = false; g.drawImage(sk.cv, x - 6, y - 44, 12, 13); }
        g.globalAlpha = 0.35; g.fillStyle = '#E6D8B8'; g.beginPath(); g.arc(x + (go ? 10 : -10), y - 1, 3 + (t * 7 % 2), 0, TAU); g.fill(); g.globalAlpha = 1;
      }
    }
    // chegada: o shiba novo entra correndo pelo lado do portão
    for (let a = arrivals.length - 1; a >= 0; a--) {
      const A = arrivals[a], u = (t - A.t0) / 1.3;
      if (u >= 1) { arrivals.splice(a, 1); continue; }
      if (u < 0) continue;
      const p = crewPos(id, A.slot, t, x0), sx = Lg.x1 + 70, e = 1 - Math.pow(1 - u, 2);
      E.drawShiba(g, lerp(sx, p[0], e), p[1], 'run', t, { pal: palOf(id, A.slot, uni), face: -1, scale: p[2] }); figs++;
      if (rnd(Math.floor(t * 20) + a) > 0.5) { g.globalAlpha = 0.4 * (1 - u); g.fillStyle = '#E6D8B8'; g.beginPath(); g.arc(lerp(sx, p[0], e) + 12, p[1] - 2, 4, 0, TAU); g.fill(); g.globalAlpha = 1; }
    }
    // frente: estátua dourada (250+), telão (200+)
    if (tier >= T250) blitText(g, statueImg(id), Lg.sx - 22, -88 - 2);
    if (tier >= T200) { const o = screenImg(id, n); blitText(g, o, x0 + HPW / 2 - o.w / 2, -256); }   // telão na fachada do 4º andar do QG
    if (gold && !useGroup) sparkle(g, x0 + 20, -30, HPW - 40, 60, t, 6, PA.HAND.indexOf(id) * 31 + 5);
    if (n === 0) { g.globalAlpha = 0.5; mound(g, x0 + MOUND_X, 20, t, false, 0); g.globalAlpha = 1; }
  }

  // uma fileira de máquinas médias
  function bayPos(id, i) {   // [x, y, escala] da vaga i: fileira única, espaçamento fixo
    const B = L.mid[id], w = B.w;
    return [B.bx0 + 12 + w * PITCH * (i + 0.5), Y_BACK + 2, 1];
  }
  function drawBay(g, id, i, x, y, dust, t, tier, k, variant, hh) {
    const gold = (tier >= T250 && i === 0) || tier >= T500;
    const o = machImg(id, Math.floor(t * 1.5 + i) % 2, k, gold ? 'gold' : variant); if (!o) return;
    const sc = MK[id], bob = Math.sin(t * 9 + i * 2) * 0.5;
    Draw.shadow(g, x, y + 1, MW[id] * 0.45 * sc, 4 * sc, 0.16);
    drawM(g, o.c, x, y + bob, o.ax * sc, o.ay * sc, o.w * sc, o.h * sc, false); stats.mach++;
    if (dust > 0) for (let d = 0; d < 4; d++) { g.globalAlpha = 0.35 * dust; g.fillStyle = '#E6D8B8'; g.beginPath(); g.arc(x + MW[id] * 0.5 * sc + d * 14, y - 4 - d * 3, 6 + d * 3, 0, TAU); g.fill(); g.globalAlpha = 1; }
    if (gold) sparkle(g, x - MW[id] * 0.45 * sc, y - hh, MW[id] * 0.9 * sc, hh * 0.9, t, 4, i * 13 + PA.MID.indexOf(id) * 7);
  }
  function drawMid(g, id, t, z, nightK) {
    const B = L.mid[id], s = st(id), n = s.n | 0, tier = tierOf(n), c = PA.COLORS[id], mk = MK[id];
    const k = clamp(Math.round(z * dpr() * 4) / 4, 0.5, 1), variant = tier >= T10 ? 'uni' : 'n', gw = B.bx1 - B.bx0, hh = MH[id] * mk;
    // fundo: garagem (25) / galpão com portas (50) / estacionamento de andares (100+)
    if (tier >= T100) {
      const lv = Math.min(6, 2 + Math.floor((n - 100) / 50)), mi = machImg(id, 0, 0.5, variant);
      const o = parkingImg(id, lv, mi ? { c: mi.c, w: mi.w, h: mi.h, s: 0.4 * mk } : null, k < 0.75 ? 0.5 : 0.75);
      blitText(g, o, B.bx0, Y_BACK - 8 - o.h);
      if (tier >= T500) { const gp = goldPlateImg('FROTA LENDÁRIA', 190); blitText(g, gp, (B.bx0 + B.bx1) / 2 - gp.w * 0.75, Y_BACK - 8 - o.h - 50, 1.5); sparkle(g, B.bx0, Y_BACK - 8 - o.h, gw, o.h, t, 10, PA.MID.indexOf(id) * 23); }
    } else if (tier >= T50) { const o = garageImg(id, gw, hh * 1.3, 4, k); blitText(g, o, B.bx0, Y_BACK - 8 - o.h); }
    else if (tier >= T25) { const o = garageImg(id, B.w * 1.25, hh * 1.25, 1, k); blitText(g, o, B.bx0 + 4, Y_BACK - 8 - o.h); }
    // piso das vagas: faixas pintadas (10+), douradas (100+), número da vaga
    if (n > 0 && tier >= T10) {
      g.fillStyle = tier >= T100 ? PAL.gold : '#F3C94A'; const pw = B.w * PITCH;
      for (let i = 0; i <= 4; i++) g.fillRect(B.bx0 + 12 + i * pw - 1.6, Y_BACK + 6, 3.2, 30);
      for (let i = 0; i < 4; i++) Draw.text(g, String(i + 1), B.bx0 + 12 + (i + 0.5) * pw, Y_BACK + 28, { size: 10, col: 'rgba(255,250,230,.8)', sw: 0 });
    }
    const nb = Math.min(PA.BAY_MAX, n), arr = s.arr;
    let late = null;
    for (let i = 0; i < nb; i++) {
      const p = bayPos(id, i); let x = p[0], y = p[1];
      const A = arr.find(a => a.slot === i); let dust = 0;
      if (A) {   // chega pela rua do pátio (vem do portão) e encosta na vaga
        const u = (t - A.t0) / 2.2; if (u < 0) continue;
        if (u >= 1) arr.splice(arr.indexOf(A), 1);
        else { const e = 1 - Math.pow(1 - Math.min(1, u / 0.75), 2); x = lerp(B.bx1 + B.w, p[0], e); y = lerp(60, p[1], clamp((u - 0.55) / 0.45, 0, 1)); dust = 1 - u; late = [i, x, y, dust]; continue; }
      }
      drawBay(g, id, i, x, y, 0, t, tier, k, variant, hh);
    }
    if (late) drawBay(g, id, late[0], late[1], late[2], late[3], t, tier, k, variant, hh);
    // comboio na rua do pátio (5+): fila arrumada, espaçamento fixo, poeira; desfile com bandeirinha (100+)
    if (n > PA.BAY_MAX) {
      const nc = Math.min(PA.CONVOY_MAX, n - PA.BAY_MAX), spd = 30, sp = B.w * 1.45, span = Math.max(gw + B.w, sp * nc + B.w);
      g.save(); g.beginPath(); g.rect(B.bx0 - 10, -400, gw + MSW + 10, 520); g.clip();
      for (let j = 0; j < nc; j++) {
        const x = B.bx1 + B.w * 0.5 - ((t * spd + j * sp) % span), y = 64, sc = 0.66 * mk;
        const o = machImg(id, Math.floor(t * 2 + j) % 2, k, variant); if (!o) break;
        Draw.shadow(g, x, y + 1, MW[id] * 0.4 * sc, 3, 0.16);
        drawM(g, o.c, x, y + Math.sin(t * 11 + j) * 0.6, o.ax * sc, o.ay * sc, o.w * sc, o.h * sc, true); stats.mach++;
        const dn = tier >= T25 ? 4 : 2;
        for (let d = 0; d < dn; d++) { const q = (t * 1.3 + d / dn + j * 0.3) % 1; g.globalAlpha = 0.3 * (1 - q); g.fillStyle = '#E6D8B8'; g.beginPath(); g.arc(x + MW[id] * 0.42 * sc + q * 30, y - 3 - q * 10, 4 + q * 9, 0, TAU); g.fill(); }
        g.globalAlpha = 1;
        if (tier >= T100 && E.Nature && E.Nature.nobori) E.Nature.nobori(g, x + MW[id] * 0.2 * sc, y - hh * 0.7 * sc, { t: t + j, col: c, h: 34, s: 0.9 });
      }
      g.restore();
    }
    // turno dos pilotos (50+): barraca no canto da placa, um vai e um volta
    if (tier >= T50 && nb > 0) {
      const tx = B.sx, p = bayPos(id, 1);
      if (E.Nature && E.Nature.stall) E.Nature.stall(g, tx, Y_BACK - 2, { s: 0.7, col: c, t, lit: nightK > 0.3 });
      const u = (t * 0.12 + PA.MID.indexOf(id) * 0.21) % 1, q = u < 0.5 ? u * 2 : (1 - u) * 2, x1 = p[0] + MW[id] * 0.35;
      E.drawShiba(g, lerp(tx - 20, x1, q), 44, 'walk', t, { pal: uniPal(id, 2), face: u < 0.5 ? -1 : 1, scale: 0.75 });
      E.drawShiba(g, lerp(x1, tx - 20, q), 46, 'walk', t + 0.4, { pal: uniPal(id, 3), face: u < 0.5 ? 1 : -1, scale: 0.75 }); figs += 2;
    }
    if (tier >= T100) {   // holofotes nas pontas
      for (const px of [B.bx0 + 4, B.bx1 - 6]) {
        g.fillStyle = LINE; g.fillRect(px - 3, -hh * 1.6 - 30, 6, hh * 1.6 + 32); g.fillStyle = PAL.steelD; g.fillRect(px - 1.5, -hh * 1.6 - 30, 3, hh * 1.6 + 30);
        Draw.box(g, px - 14, -hh * 1.6 - 42, 28, 12, '#5C6672', { ol: 1 });
        Draw.light(g, px, -hh * 1.6 - 34, 4, '#FFE9A0', nightK > 0.2 ? 1 : 0.25, { halo: 3 });
        if (nightK > 0.2) { g.globalAlpha = 0.14 * nightK; g.fillStyle = '#FFF3C4'; g.beginPath(); g.moveTo(px - 10, -hh * 1.6 - 32); g.lineTo(px + 10, -hh * 1.6 - 32); g.lineTo(px + (px < B.sx ? 220 : -220), 50); g.lineTo(px + (px < B.sx ? 40 : -40), 50); g.closePath(); g.fill(); g.globalAlpha = 1; }
      }
    }
    if (n === 0) { g.fillStyle = 'rgba(243,201,74,.45)'; for (let i = 0; i < 2; i++) g.fillRect(B.bx0 + 12 + i * B.w * PITCH, Y_BACK + 6, 3, 30); }
  }

  // horizonte das gigantes: 3 camadas (longe → perto), névoa, parallax, luzinhas de noite, holofote varrendo (100+)
  const RIDGE = [];
  function drawGiants(g, v, t, nightK) {
    const sc = G.Scenery && G.Scenery.profile ? G.Scenery.profile() : null, sky = (sc && sc.sky && sc.sky[1]) || '#CFE3F2';
    const tint = [mix('#7C8C9E', sky, 0.35), mix('#93A3B4', sky, 0.5), mix('#AAB8C6', sky, 0.62)];
    const cx = (v.x0 + v.x1) / 2, P = [0.62, 0.48, 0.36], BASE = [-6, -22, -36];
    g.save(); g.beginPath(); g.rect(L.L, -1400, L.R - 30 - L.L, 1400); g.clip();
    for (let layer = 2; layer >= 0; layer--) {
      const shiftR = clamp((cx - (L.L + L.R) / 2) * (1 - P[layer]), -500, 500);
      for (const id of PA.GIANT) {
        const n = st(id).n | 0; if (!n) continue;
        let before = 0; for (let l = 0; l < layer; l++) before += PA.GIANT_LAYERS[l];
        const cnt = Math.min(PA.GIANT_LAYERS[layer], Math.max(0, n - before)); if (!cnt) continue;
        const o = giantImg(id, layer, tint[layer], false); if (!o) continue;
        const b = L.band[id], bw = b[1] - b[0], shift = clamp((cx - (b[0] + b[1]) / 2) * (1 - P[layer]), -bw * 0.4, bw * 0.4);
        for (let i = 0; i < cnt; i++) {
          const u = (i + 0.5) / PA.GIANT_LAYERS[layer], x = b[0] + bw * (layer === 0 ? (i + 0.5) / Math.max(cnt, 2) : u) + (rnd(i * 13 + layer) - 0.5) * bw / PA.GIANT_LAYERS[layer] * 0.6 + shift;
          if (x + o.w < v.x0 || x - o.w > v.x1) continue;
          const gold = layer === 0 && i === 0 && tierOf(n) >= T250, img = gold ? giantImg(id, 0, tint[0], true) : o, face = rnd(i * 7 + layer * 3) > 0.5 ? 1 : -1;
          const y = BASE[layer] + Math.sin(t * 0.4 + i) * 0.5;
          drawM(g, img.c, x, y, img.ax, img.ay, img.w, img.h, face < 0);
          if (gold) sparkle(g, x - img.w * 0.4, y - img.ay, img.w * 0.8, img.ay, t, 3, i * 9 + layer);
          if (nightK > 0.3 && layer < 2) { const on = Math.sin(t * 3 + i * 1.7) > 0; g.fillStyle = on ? '#FF6B5E' : '#FFE3A0'; g.fillRect(x - 1.5, y - img.ay * 0.85, 3, 3); g.fillStyle = '#FFE3A0'; g.fillRect(x + img.w * 0.2 * face, y - img.ay * 0.4, 2, 2); }
        }
        // número discreto, na névoa
        if (layer === 0) { const mx = b[0] + bw * 0.5 + shift * 0.5; if (mx > v.x0 - 80 && mx < v.x1 + 80) Draw.text(g, PA.NAMES[id] + ' ×' + fmtN(n), mx, BASE[0] + 8, { size: 9, col: mix(tint[0], '#FFFFFF', 0.5), sw: 2, stroke: mix(tint[0], '#3B2818', 0.4), alpha: 0.85 }); }
      }
      if (layer === 1) drawAbsurd(g, t, nightK, tint[1], BASE[1]);
      // morro de névoa da camada (os de trás ficam de pé "no morro")
      const col = layer === 0 ? mix('#9DB083', sky, 0.38) : layer === 1 ? mix('#A9BC92', sky, 0.55) : mix('#B9C8A8', sky, 0.7);
      const shift = shiftR, y0 = BASE[layer] + 5, step = 40, xa = Math.max(L.L, v.x0 - step), xb = Math.min(L.R, v.x1 + step);
      g.fillStyle = col; g.beginPath(); g.moveTo(xa, 2);
      for (let x = Math.floor((xa - shift) / step) * step + shift; x <= xb + step; x += step) { const q = Math.round((x - shift) / step); g.lineTo(x, y0 - 4 - 4 * Math.sin(q * 0.9 + layer) - 3 * rnd(q + layer * 50)); }
      g.lineTo(xb + step, 2); g.closePath(); g.fill();
    }
    // holofotes varrendo o céu (alguma gigante com 100+)
    let hi = 0; for (const id of PA.GIANT) hi = Math.max(hi, tierOf(st(id).n | 0));
    if (hi >= T100) {
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) {
        const bx = L.L + (L.R - L.L) * (0.3 + 0.4 * k), a = -Math.PI / 2 + Math.sin(t * 0.35 + k * 2) * 0.5, len = 900, wd = 0.07;
        g.globalAlpha = 0.05 + 0.1 * nightK; g.fillStyle = '#FFF6D0';
        g.beginPath(); g.moveTo(bx, -30); g.lineTo(bx + Math.cos(a - wd) * len, -30 + Math.sin(a - wd) * len); g.lineTo(bx + Math.cos(a + wd) * len, -30 + Math.sin(a + wd) * len); g.closePath(); g.fill();
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  // máquinas absurdas no horizonte do meio: SKYLINE arrumado — cada uma ganha o seu lote (largura por peso, na ordem de PA.ABSURD),
  // em cima de um platô de névoa contínuo; nada se sobrepõe. horizon(g, {x0,x1,…}) de cada uma desenha dentro do lote.
  const ABS_W = { tatus: 0.8, komeohs: 0.9, trembala: 1.5, foguete: 0.8, fuji: 1.2, portal: 0.8 };
  const absList = [];
  function drawAbsurd(g, t, nightK, tint, base) {
    absList.length = 0; let tw = 0;
    for (const id of PA.ABSURD) {
      const p = PATIO[id], n = p ? p.n | 0 : 0, T0 = G.Tools && G.Tools[id];
      if (n <= 0 || !T0 || !T0.horizon) continue;
      absList.push(id); tw += ABS_W[id] || 1;
    }
    if (!absList.length) return;
    const X0 = L.L + 80, X1 = L.R - 120, gap = 50, span = X1 - X0 - gap * (absList.length - 1);
    // platô de névoa: base reta comum a todas (lê como uma linha de horizonte só)
    const py = base - 6;
    g.globalAlpha = 0.55; g.fillStyle = mix(tint, '#FFFFFF', 0.25); g.fillRect(X0 - 30, py, X1 - X0 + 60, 12);
    g.globalAlpha = 0.7; g.fillStyle = mix(tint, '#FFFFFF', 0.5); g.fillRect(X0 - 30, py, X1 - X0 + 60, 1.6); g.globalAlpha = 1;
    let x = X0;
    for (const id of absList) {
      const w = span * (ABS_W[id] || 1) / tw, n = PATIO[id].n | 0;
      try { G.Tools[id].horizon(g, { x0: x, x1: x + w, y: py, k: 0.16, t, n, tint, haze: 0.45, night: nightK }); } catch (e) { /* desenho de horizonte nunca derruba o pátio */ }
      const nm = (G.Tools[id].name || id).toUpperCase() + ' ×' + fmtN(n);   // plaquinha na névoa, igual às gigantes
      Draw.text(g, nm, x + w / 2, py + 9, { size: 9, col: mix(tint, '#FFFFFF', 0.55), sw: 2, stroke: mix(tint, '#3B2818', 0.4), alpha: 0.9 });
      x += w + gap;
    }
  }

  function drawGround(g, v) {
    const a = Math.max(L.L, v.x0), b = Math.min(L.R, v.x1); if (b <= a) return;
    // cerca de tela no fundo do pátio (baixa e clara)
    g.fillStyle = '#B9C0C8'; for (let x = Math.ceil(a / 46) * 46; x <= b; x += 46) g.fillRect(x - 1.5, -30, 3, 31);
    g.fillRect(a, -30, b - a, 2.5); g.fillRect(a, -16, b - a, 1.5);
    // piso: terra batida na parte das turmas, asfalto na das máquinas, rua do comboio na frente
    const ha = Math.max(a, L.handL), hb = Math.min(b, L.R);
    if (hb > ha) { g.fillStyle = '#CDB48A'; g.fillRect(ha, 1, hb - ha, 66); g.fillStyle = '#B99E72'; g.fillRect(ha, 62, hb - ha, 4); g.fillStyle = '#E3D2AE'; g.fillRect(ha, 1, hb - ha, 2.5);
      g.fillStyle = '#E8DCC2'; for (let x = Math.ceil(ha / 34) * 34; x < hb; x += 34) g.fillRect(x, 50, 22, 6); }
    const ma = Math.max(a, L.L), mb = Math.min(b, L.handL);
    if (mb > ma) {
      g.fillStyle = '#8B8F96'; g.fillRect(ma, 1, mb - ma, 46); g.fillStyle = '#A3A7AD'; g.fillRect(ma, 1, mb - ma, 3);
      g.fillStyle = '#6F747C'; g.fillRect(ma, 47, mb - ma, 20); g.fillStyle = '#5E636B'; g.fillRect(ma, 64, mb - ma, 3);
      g.fillStyle = '#E8E2D2'; for (let x = Math.ceil(ma / 60) * 60; x < mb; x += 60) g.fillRect(x, 56, 28, 2.5);
    }
  }

  /* ---------- FAIXA DA FRENTE: rua, calçada, cerquinhas, caixotes, arrozal, poças, placas (enche o chão até o HUD) ----------
     Tudo numa imagem pronta por pedaço (FG_W de largura, 3 variações); por cima, só uns shibas andando na calçada e a poça brilhando.
     Reaproveita arte que já existe: Nature (cerca, arrozal, moita, árvore, pedra, flor, capim) e as fichas prop_* (caixote, cone, barril…). */
  const FG_Y = 66, FG_W = 720, FG_H = 820;
  const FG_SIGNS = ['DEVAGAR · SHIBAS TRABALHANDO', '347 DIAS SEM DERRUBAR ARROZ', 'PROIBIDO COCHILAR NA PÁ', 'VAGA DO CARRINHO DE MÃO', 'BUZINE SE GOSTA DE ONIGIRI', 'CUIDADO: PATAS NA PISTA'];
  const PROPS = ['prop_caixote', 'prop_cone', 'prop_barril', 'prop_lixeira', 'prop_venda'];
  function fgTile(vi, k) {
    const A = E.Assets, rd = A && A.ready ? PROPS.filter(id => A.ready(id)).length : 0;
    return cached('fg|' + vi + '|' + rd, FG_W, FG_H, k, cg => {
      const N = E.Nature, R = i => rnd(i * 3.7 + vi * 91.3), W = FG_W;
      // meio-fio + rua (asfalto, faixa tracejada, bordas)
      Draw.box(cg, -4, 0, W + 8, 9, '#B7AFA2', { ol: 1.2, top: '#D3CCC0' });
      cg.fillStyle = '#6F747C'; cg.fillRect(0, 9, W, 76); cg.fillStyle = '#5E636B'; cg.fillRect(0, 9, W, 4); cg.fillStyle = '#7C818A'; for (let i = 0; i < 14; i++) cg.fillRect(R(i) * W, 20 + R(i + 40) * 58, 6 + R(i + 9) * 10, 1.6);
      cg.fillStyle = '#D9D4C6'; cg.fillRect(0, 17, W, 2); cg.fillRect(0, 78, W, 2);
      cg.fillStyle = '#F3C94A'; for (let x = 10; x < W; x += 90) cg.fillRect(x, 46, 46, 3.4);
      // meio-fio + calçada de lajotas
      Draw.box(cg, -4, 85, W + 8, 10, '#B7AFA2', { ol: 1.2, top: '#D3CCC0' });
      cg.fillStyle = '#DCCFB4'; cg.fillRect(0, 95, W, 30); cg.fillStyle = '#C7B898'; for (let x = 0; x < W; x += 30) cg.fillRect(x, 95, 1.6, 30); cg.fillRect(0, 109, W, 1.4); cg.fillStyle = '#EDE3CC'; cg.fillRect(0, 95, W, 2);
      // gramado (o resto até embaixo)
      if (N && N.ground) N.ground(cg, -2, W + 2, 125, { depth: FG_H - 125, t: 0, seed: vi * 7 + 3, tufts: true });
      else { cg.fillStyle = PAL.grass; cg.fillRect(0, 125, W, FG_H - 125); }
      // escurece pro fundo (lê como "mais perto da câmera")
      const gr = cg.createLinearGradient(0, 360, 0, FG_H); gr.addColorStop(0, 'rgba(40,60,20,0)'); gr.addColorStop(1, 'rgba(40,60,20,.38)'); cg.fillStyle = gr; cg.fillRect(0, 360, W, FG_H - 360);
      // fileira 1 (logo atrás da calçada): cerca de madeira em lances, caixotes, cones, placas, moitas
      const y1 = 176;
      if (N && N.fence) { N.fence(cg, 20 + R(1) * 40, 170 + R(2) * 120, y1 - 4, { kind: 'wood' }); if (R(3) > 0.35) N.fence(cg, 430 + R(3) * 60, 690, y1 - 4, { kind: R(22) > 0.5 ? 'bamboo' : 'wood' }); }
      const art = (id, x, y, sc) => { if (A && A.ready && A.ready(id)) A.draw(cg, id, 0, Math.round(x), Math.round(y), { scale: sc }); };
      if (N && N.bush) { N.bush(cg, 300 + R(4) * 30, y1 + 4, { s: 1.2, seed: vi + 1 }); N.bush(cg, 380 + R(5) * 20, y1 + 6, { kind: 'azalea', s: 1, seed: vi + 2 }); }
      art('prop_caixote', 120 + R(6) * 60, y1 + 4, 2); art('prop_caixote', 150 + R(6) * 60, y1 + 4, 2); art('prop_caixote', 135 + R(6) * 60, y1 + 4 - 28, 2);
      art('prop_cone', 40 + R(7) * 30, y1 + 8, 1.6); art('prop_cone', 74 + R(7) * 30, y1 + 8, 1.6);
      art(PROPS[2 + (vi % 3)], 560 + R(8) * 60, y1 + 6, 2);
      { const sx = 470 + R(9) * 40, txt = FG_SIGNS[(vi * 2) % FG_SIGNS.length];
        cg.fillStyle = LINE; cg.fillRect(sx + 18, y1 - 30, 4.4, 34); cg.fillRect(sx + 90, y1 - 30, 4.4, 34); cg.fillStyle = PAL.woodL; cg.fillRect(sx + 19.2, y1 - 30, 2, 33); cg.fillRect(sx + 91.2, y1 - 30, 2, 33);
        Draw.sign(cg, sx, y1 - 62, 112, 34, txt, { col: vi % 2 ? '#2F4670' : '#C8423A', ink: PAL.cream }); }
      // arrozal (2 lances) com taipa
      if (N && N.paddy) { const pa = 160 + R(10) * 260; N.paddy(cg, 10 + R(13) * 40, 232 + R(17) * 14, pa, 44, { t: 0, seed: vi * 3 + 1 }); if (R(21) > 0.3) N.paddy(cg, pa + 70 + R(11) * 40, 238, W - pa - 110 - R(11) * 40, 40, { t: 0, seed: vi * 3 + 2 }); else if (N.tree) N.tree(cg, pa + 200, 280, { kind: 'sakura', s: 0.9, seed: vi + 11 }); }
      // fileira 2: poças que refletem o céu, pedras, flores, sacos
      for (let i = 0; i < 2; i++) {
        const px = 90 + i * 330 + R(12 + i) * 120, py = 344 + R(14 + i) * 30, pw = 38 + R(16 + i) * 26;
        cg.fillStyle = LINE; cg.beginPath(); cg.ellipse(px, py, pw + 1.4, pw * 0.26 + 1.4, 0, 0, TAU); cg.fill();
        cg.fillStyle = '#9FC6E0'; cg.beginPath(); cg.ellipse(px, py, pw, pw * 0.26, 0, 0, TAU); cg.fill();
        cg.fillStyle = '#CFE6F4'; cg.fillRect(px - pw * 0.5, py - 2, pw * 0.45, 1.6); cg.fillRect(px + pw * 0.1, py + 2, pw * 0.3, 1.4);
      }
      if (N && N.rock) { N.rock(cg, 260 + R(18) * 40, 360, { w: 26, h: 15, seed: vi + 4, moss: true }); N.rock(cg, 640 + R(19) * 40, 372, { w: 20, h: 12, seed: vi + 5 }); }
      if (N && N.flower) for (let i = 0; i < 9; i++) N.flower(cg, R(20 + i) * W, 400 + R(30 + i) * 40, { kind: ['tanpopo', 'daisy', 'tulip', 'ajisai'][(i + vi) % 4], seed: i + vi * 9, t: 0 });
      if (G.Props && G.Props.sack) { const sk = G.Props.sack('plain').cv; cg.imageSmoothingEnabled = false; for (let i = 0; i < 3; i++) cg.drawImage(sk, 200 + R(40) * 200 + i * 13 - (i === 2 ? 19 : 0), 386 - sk.height - (i === 2 ? 12 : 0)); }
      // fileira 3: cerca de bambu + árvores e moitas maiores (mais perto)
      if (N && N.fence) N.fence(cg, -4, W + 4, 492, { kind: 'bamboo' });
      if (N && N.tree) { N.tree(cg, 130 + R(41) * 120, 520, { kind: ['round', 'pine', 'maple'][vi % 3], s: 1.1, seed: vi + 7 }); N.tree(cg, 520 + R(42) * 120, 526, { kind: ['pine', 'sakura', 'round'][vi % 3], s: 1.25, seed: vi + 8 }); }
      if (N && N.bush) for (let i = 0; i < 3; i++) N.bush(cg, 40 + i * 240 + R(43 + i) * 60, 540, { s: 1.4, seed: vi * 5 + i, kind: i === 1 ? 'azalea' : 'bush' });
      if (N && N.paddy) { const w3 = 280 + R(47) * 300; N.paddy(cg, 20 + R(48) * (W - w3 - 40), 596 + R(49) * 30, w3, 56, { t: 0, seed: vi * 3 + 9 }); }
      if (N && N.grassTuft) for (let i = 0; i < 16; i++) N.grassTuft(cg, R(50 + i) * W, 300 + R(70 + i) * 480, { seed: i + vi * 13, t: 0, s: 1 + R(90 + i) * 0.8 });
    });
  }
  function drawFront(g, v, t, z) {
    const a = Math.max(L.L - 20, v.x0 - 10), b = Math.min(L.R + 10, v.x1 + 10); if (b <= a || v.y1 < FG_Y) return;
    const k = z < 0.32 ? 0.35 : z < 0.62 ? 0.6 : 1;
    g.save(); g.beginPath(); g.rect(L.L - 20, FG_Y - 2, L.R - L.L + 30, FG_H + 4); g.clip();
    const i0 = Math.floor((a - L.L) / FG_W), i1 = Math.floor((b - L.L) / FG_W);
    for (let i = i0; i <= i1; i++) { const o = fgTile(Math.floor(rnd(i * 5.1 + 2) * 3), k); blitText(g, o, L.L + i * FG_W, FG_Y); }
    // vivo: shibas indo e vindo na calçada (com saco ou não), um a cada ~700 de pátio
    const yS = FG_Y + 112, sp = 700, n = Math.ceil((L.R - L.L) / sp);
    for (let j = 0; j < n; j++) {
      const dir = j % 2 ? 1 : -1, u = ((t * 22 * (0.8 + rnd(j) * 0.4) * dir + j * 260) % sp + sp) % sp, x = L.L + j * sp + u;
      if (x < v.x0 - 40 || x > v.x1 + 40) continue;
      const carry = j % 3 === 0;
      E.drawShiba(g, x, yS + (j % 2) * 6, carry ? 'carry' : 'walk', t + j, { pal: MIXED[j % MIXED.length], face: dir, scale: 0.8 }); figs++;
      if (carry && G.Props && G.Props.sack) { const sk = G.Props.sack('plain').cv; g.imageSmoothingEnabled = false; g.drawImage(sk, x - 6, yS + (j % 2) * 6 - 44, 12, 13); }
    }
    g.restore();
    // pontas: muro de arrimo de pedra (fecha a faixa em vez de cortar seco no barro)
    for (const ex of [L.L - 20, L.R + 10]) if (ex > v.x0 - 30 && ex < v.x1 + 30) {
      Draw.box(g, ex - 12, FG_Y - 4, 24, FG_H + 6, '#B7AFA2', { ol: 1.4 });
      g.fillStyle = '#9E978A'; for (let y = FG_Y + 18, r = 0; y < FG_Y + FG_H; y += 22, r++) { g.fillRect(ex - 10, y, 20, 1.8); g.fillRect(ex + (r % 2 ? -3 : 3), y - 20, 1.8, 20); }
      Draw.box(g, ex - 15, FG_Y - 10, 30, 9, '#D3CCC0', { ol: 1.4 });
    }
  }

  /* ---------- quadro ---------- */
  function sync(patio, t) {
    PATIO = patio || {};
    for (const id of ALL) {
      const p = PATIO[id], n = p ? Math.max(0, p.n | 0) : 0, s = st(id);
      if (s.n === undefined) { s.n = n; s.tier = tierOf(n); continue; }
      if (n === s.n) continue;
      if (n < s.n) { s.n = n; s.tier = tierOf(n); s.arr.length = 0; continue; }   // viagem zerou
      const dn = n - s.n; s.from = s.n; s.dn = dn; s.popT = t;
      const cap = isHand[id] ? PA.CREW_MAX : isMid[id] ? PA.BAY_MAX : 0;
      for (let k = s.n; k < Math.min(n, cap); k++) if (s.arr.length < 8) s.arr.push({ slot: k, t0: t + (k - s.n) * 0.22 });
      const tr = tierOf(n), gx = isHand[id] ? L.hand[id].px0 + MOUND_X : isMid[id] ? (L.mid[id].bx0 + L.mid[id].bx1) / 2 : (L.band[id][0] + L.band[id][1]) / 2;
      if (tr > s.tier) { burst(gx, -60, 46, CONF, 300); s.tierT = t; }
      else if (dn >= 5) burst(gx, -30, 22, CONF, 220);
      s.n = n; s.tier = tr;
    }
  }
  function draw(g, v, t, patio) {
    const t0 = performance.now();
    layout(); sync(patio, t);
    figs = 0; stats.groupSpr = 0; stats.mach = 0;
    if (L.R < v.x0 - 400 || L.L > v.x1 + 400) { stats.ms = 0; return; }
    const z = Draw.zoom || 1, nk = night();
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1); lastT = t;
    const P = stats.part || (stats.part = {}), pn = () => performance.now(); let tp = pn();
    drawGiants(g, v, t, nk); P.giants = pn() - tp; tp = pn();
    drawGround(g, v);
    drawFront(g, v, t, z); P.front = pn() - tp; tp = pn();
    // turmas de mão: as mais perto do centro da tela ganham figuras soltas; o resto (ou zoom aberto) vai em imagem de grupo
    const cx = (v.x0 + v.x1) / 2, vis = [];
    for (const id of PA.HAND) { const H = L.hand[id]; if (H.x1 + 60 < v.x0 || H.x0 - 120 > v.x1) continue; vis.push(id); }
    vis.sort((a, b) => Math.abs((L.hand[a].x0 + L.hand[a].x1) / 2 - cx) - Math.abs((L.hand[b].x0 + L.hand[b].x1) / 2 - cx));
    const order = [];
    for (const id of vis) { const n = st(id).n | 0, cost = Math.min(PA.CREW_MAX, n) + (tierOf(n) >= T25 ? 2 : 0) + (tierOf(n) >= T50 ? 4 : 0); const grp = z < PA.LOD_Z || figs + cost > PA.FIG_CAP; if (!grp) figs += cost; order.push([id, grp]); }
    figs = 0;
    order.sort((a, b) => PA.HAND.indexOf(b[0]) - PA.HAND.indexOf(a[0]));   // de trás (esquerda) pra frente: nada passa por cima errado
    for (const [id, grp] of order) drawHand(g, id, t, z, grp, nk);
    P.hand = pn() - tp; tp = pn();
    for (const id of PA.MID) { const B = L.mid[id]; if (B.x1 + 260 < v.x0 || B.x0 - 260 > v.x1) continue; drawMid(g, id, t, z, nk); }
    P.mid = pn() - tp; tp = pn();
    // placas (por cima do canteiro, cada uma na sua faixa)
    for (const id of PA.HAND) { const H = L.hand[id]; if (H.x1 < v.x0 - 120 || H.x0 > v.x1 + 120) continue; drawSign(g, id, H.sx, 40, 40, 'hand', z, t); }
    for (const id of PA.MID) { const B = L.mid[id]; if (B.x1 < v.x0 - 200 || B.x0 > v.x1 + 200) continue; drawSign(g, id, B.sx, 40, MH[id] * MK[id] + 34, 'mid', z, t); }
    // céu: dirigível (300+) e fogos (400+) — por turma
    for (const id of PA.HAND.concat(PA.MID)) {
      const n = st(id).n | 0, tr = tierOf(n); if (tr < T300) continue;
      const gx = isHand[id] ? L.hand[id].px0 + HPW / 2 : (L.mid[id].bx0 + L.mid[id].bx1) / 2, gy = isHand[id] ? -4 - (Math.min(6, 2 + Math.floor((n - 100) / 50)) * PG_FH + 92) - 70 : -(Math.min(6, 2 + Math.floor((n - 100) / 50)) * Math.max(64, MH[id] * 0.62) + 26) - 110;
      if (gx + 200 < v.x0 || gx - 200 > v.x1) continue;
      const o = blimpImg(id), bs = isHand[id] ? 1 : 2; blitText(g, o, gx - 60 * bs + Math.sin(t * 0.3 + gx) * 30, gy + Math.sin(t * 0.8 + gx) * 5, bs);
      if (tr >= T400) for (let k = 0; k < 2; k++) {
        const cyc = 2.6, ph = (t + k * 1.3 + gx * 0.01) % cyc, fx = gx + (rnd(Math.floor((t + k * 1.3) / cyc) + k * 9) - 0.5) * 200, fy = gy - 60 - rnd(k + Math.floor(t / cyc)) * 80;
        if (ph < 0.5) { g.fillStyle = '#FFE9A0'; g.fillRect(fx - 1, fy + 160 * (1 - ph / 0.5), 2, 8); }
        else if (ph < 1.6) { const q = (ph - 0.5) / 1.1, r = 10 + q * 46, cc = CONF[(k + Math.floor(t / cyc)) % CONF.length]; g.globalAlpha = 1 - q; g.fillStyle = cc; for (let j = 0; j < 12; j++) { const a = j / 12 * TAU; g.fillRect(fx + Math.cos(a) * r - 1.5, fy + Math.sin(a) * r + q * q * 20 - 1.5, 3, 3); } g.globalAlpha = 1; }
      }
    }
    // portal (na frente de tudo, esconde a emenda do horizonte)
    if (L.R + 20 > v.x0 && L.R - GATE_W - 20 < v.x1) blitText(g, gateImg(), L.R - GATE_W + 5, -258);
    // ponta de fora: mourão grosso
    if (L.L + 40 > v.x0 && L.L - 40 < v.x1) { Draw.box(g, L.L - 6, -60, 12, 62, '#9AA6B2', { ol: 1.2 }); Draw.box(g, L.L - 9, -66, 18, 8, '#5C6672', { ol: 1.2 }); }
    // partículas (confete)
    for (let i = FX.length - 1; i >= 0; i--) {
      const p = FX[i]; p.age += dt; if (p.age > p.life) { FX.splice(i, 1); continue; }
      p.vy += 420 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y > 40) { p.y = 40; p.vy *= -0.3; p.vx *= 0.6; }
      g.globalAlpha = Math.min(1, (p.life - p.age) * 2); g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s * 0.6);
    }
    g.globalAlpha = 1;
    const ms = performance.now() - t0;
    stats.ms = ms; stats.n++; stats.avg += (ms - stats.avg) / Math.min(stats.n, 60); stats.figs = figs; stats.max = Math.max(stats.max || 0, ms);
  }

  /* ---------- retângulos pro programador (câmera, chip "Pátio", limite X.minX) ---------- */
  function slots() {
    layout();
    const groups = [];
    for (const id of PA.HAND) groups.push({ id, kind: 'hand', x0: L.hand[id].x0, x1: L.hand[id].x1 });
    for (const id of PA.MID) groups.push({ id, kind: 'mid', x0: L.mid[id].x0, x1: L.mid[id].x1 });
    for (const id of PA.GIANT) groups.push({ id, kind: 'giant', x0: L.band[id][0], x1: L.band[id][1] });
    return {
      x0: L.L, x1: L.R, y0: -620, y1: FG_Y + FG_H, gate: L.gate, groups,
      cam: { x: (L.L + L.R) / 2, y: -220, z: 0.2 },
      camHand: { x: (L.handL + L.R) / 2, y: -100, z: 0.48 },
      camMid: { x: (L.midL + L.midR) / 2, y: -170, z: 0.34 },
    };
  }

  const PatioArt = { draw, slots, fake, stats, auto: true, PA, tierOf, layout: () => layout(), get fakePatio() { return FAKE; } };
  G.PatioArt = PatioArt;
  // gancho já existente do game-world.js (camada de trás, depois do pátio industrial e antes das máquinas/Kome): sem mexer no game.js
  if (G.World && G.World.layers) G.World.layers.back.push((g, v, t, S) => {
    if (!PatioArt.auto || !S || !S.ended) return;
    const p = S.patio || FAKE; if (!p) return;
    draw(g, v, t, p);
  });
})();
