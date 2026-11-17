/* Kome no Japão — trembala.js
   'trembala' = TREM-BALA DE ARROZ (máquina absurda nº 17 do Pátio, camada-cookie.md · galho Absurdo).
   Não cava: é o absurdo de LOGÍSTICA. Um shinkansen de ~4.000 px (cabeça de shiba laranja, 8 vagões-tremonha/onigiri, cauda de
   shiba preto) encosta na estação no pé da montanha, 8 calhas descem da encosta e enchem todos os vagões de uma vez (a montanha
   perde uma faixa no pé), ele sai com estrondo sônico (BUUUM, linhas de velocidade, o vento leva os chapéus dos shibas) e volta
   pelo outro lado segundos depois: deu a volta no Japão. Kome dirige na cabine com quepe de maquinista.
   Depende de: core.js, pix.js, shiba.js, fx.js, terrain.js, rig.js (só Draw/drawShiba/shibaAnchor de fato).

   Interface comum: G.Tools.trembala = {id, name, kind, w, h, meta, create(opts), update(m,dt,inp), draw(g,m), bite(m), dump(m),
   seat(m), bites(m), dig(m, heap, area, o), horizon(g, o), prebake(level?), profile(mode, t, out)}.
   Espaço do modelo: origem no chão sob a PONTA DO NARIZ quando o trem está parado na estação (a "doca"); +x = sentido da partida
   (opts/inp.face), y pra baixo, px de arte (escala fixa 1: o Kome da plataforma tem 44 px). Trilho em y=-16, teto -240, onigiri
   até -452, fio da catenária -486. Trem do nariz (x=0) até x≈-4040. Plataforma de x≈+300 até -1560.
   opts = {mode: 'normal' | 'chegada', pilot: paleta do Kome (padrão 'kome')}.
   A máquina é dona da doca: m.x (mundo) pega inp.x só no 1º update; pra mudar a estação, escrever m.x. m.y = inp.y (chão).

   inp: x, y, face (±1: pra onde ele parte; volta pelo lado oposto), floor(x) -> y de mundo da SUPERFÍCIE da montanha (heap) naquele x
   (sem floor: supõe montanha alta), digging (false = segura a carga parada; o resto do ciclo termina sozinho), speedMul, parts
   (E.Particles: grãos, poeira, faíscas), night (0..1), view {x0,x1} opcional (senão corta pelo canvas).

   CICLO normal (meta.cycle = 20 s / speedMul): 0 'arrive' (parado na doca) · 0–0.8 calhas descem e tampas abrem · 0.8 'load' ·
   0.8–9.0 enche (m.fill 0→1; bites ativos) · 9.0 'full' · 9.4 'whistle' (fecha) · 10.0 'depart' (m.payload = m.fill) · 11.6 'boom'
   (estrondo: m.flash=1, m.shakeK=1, m.speed.on, chapéus voam) · 11.95 some · 16.4 'return' (entra pelo outro lado a ~11.000 px/s,
   PAGAR AQUI com m.payload) · 17.4 'brake' (faísca nas rodas) · 20 = 0 'arrive' (sanfona dos engates: 'clank').
   Também: 'spark' (pantógrafo, ≤ 2/s), 'clank' (engates). Modo 'chegada' (cena de estreia, meta.chegadaT = 11.6 s): shibas
   assentam o trilho com o trem empurrando atrás ('horn' 1.2 e 2.4), encosta 'arrive' 4.0, corte da fita 'ribbon' 5.0 (título),
   'whistle' 5.8, 'depart' 6.2, 'boom' 7.8, 'return' 8.6, 'arrive' + 'ready' 11.6 → vira 'normal' sozinho (ct = 0).

   Âncoras (mundo): bites(m) = 8 calhas [{x,y,r,active}] na superfície da montanha (y = floor(x)); bite(m) = a calha do meio
   (ou a 1ª ativa); dig(m, heap, area) aplica heap.dig(x, area/ativas, r) em cada calha ativa e devolve a soma de got;
   dump(m) = boca do vagão do meio (ativo enquanto enche); seat(m) = cabine do Kome.
   Ler: m.phase ('abrindo','carregando','fechando','partindo','fora','voltando','chegada'), m.s (avanço do nariz desde a doca),
   m.v (px/s), m.fill, m.payload, m.flash, m.shakeK, m.speed {on,dir,k} (linhas de velocidade pra ScreenFX), m.cam {x,y,z}
   (câmera sugerida), m.lap (tempo da volta ao Japão, s), m.title (0..1 título da estreia).
   Desempenho: carrocerias, trilho, postes e plataforma pré-renderizados em níveis (cache global); ao vivo só tampas, arroz,
   pantógrafos, calhas, Kome, equipe e efeitos. */
(function () {
  'use strict';
  const E = window.KomeEngine;
  if (!E || !E.Draw) throw new Error('trembala.js: carregue core, pix, shiba, fx, terrain e rig antes');
  const G = (window.KomeGame = window.KomeGame || {}); G.Tools = G.Tools || {};
  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const shc = new Map();
  function sh(c, k) { const key = c + '|' + k; let v = shc.get(key); if (v === undefined) { v = U.shade(c, k); shc.set(key, v); } return v; }

  /* ---- geometria (modelo) ---- */
  const RAIL = -16, WR = 17, WY = RAIL - WR, BB = -56, BT = -240, SKIRT = -76;
  const LEAD = 600, CAR = 330, GAP = 22, NOSE = 330;
  const WIRE = -486, MESS = -540, POLE = 540;
  const ST0 = -134, ST1 = -118, PIN0 = -112, PIN1 = -108;
  const HX = -CAR / 2, HATCH_A = -452, HATCH_B = -352, RIM_B = -352;
  const KIND = ['lead', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'tail'];
  const NCAR = KIND.length, LEN = [], FRONT = [];
  { let a = 0; for (let i = 0; i < NCAR; i++) { FRONT[i] = a; LEN[i] = KIND[i] === 'lead' || KIND[i] === 'tail' ? LEAD : CAR; a += LEN[i] + GAP; } }
  const TRAIN = FRONT[NCAR - 1] + LEN[NCAR - 1];            // ≈ 4.040 px
  const PANTO = [[0, -470], [NCAR - 1, -130]];               // [vagão, x no vagão]
  const KOME_FEET = [-236, -112], KOME_SC = 2.3;                             // pés do Kome dentro da cabine (modelo do vagão-líder)
  const PLAT0 = -300, PLAT1 = 1560, PLAT_Y = -30;             // plataforma: dx (pra trás da doca) e topo
  const BOARD_DX = 760;

  /* ---- cores ---- */
  const C_BODY = '#F7F3EA', C_BODYL = '#FFFFFF', C_BODYS = '#DDD6C6', C_SKIRT = '#BCC1C8', C_SKIRTD = '#8E949C', C_ROOF = '#CDD2D8';
  const C_RED = PAL.red, C_GOLD = PAL.gold, C_GLASS = '#2F3E4C', C_GLASSL = '#4F6A7E';
  const C_NORI = '#25322A', C_NORIL = '#3A4B3F';
  const C_BOG = '#585E68', C_WHEEL = '#3E434A';
  const FACE_A = { fur: '#E2893A', furD: '#B4632A', furL: '#F2AE68', cream: '#FFF4E2', brow: '#FFF4E2', eye: PAL.ink };   // cabeça: Kome
  const FACE_B = { fur: '#3E3632', furD: '#28221F', furL: '#5A4E47', cream: '#F3E1BF', brow: '#E2A65E', eye: '#140E0A' };   // cauda: shiba preto
  const STRAW = '#E2B85C', STRAWD = '#B48A3A';
  const P_CREW = [
    { h: STRAW, g: STRAWD, o: '#D9A066', c: '#EBEBEB', k: '#2A1A10', n: '#2A1A10', p: '#D95763' },
    { h: STRAW, g: STRAWD, o: '#B88E62', c: '#EFE0C4', k: '#2A1A10', n: '#2A1A10', p: '#E8707A' },
    { h: STRAW, g: STRAWD, o: '#34302C', c: '#C98A4A', k: '#F2E6C9', n: '#0E0C0B', p: '#E8707A' },
    { h: STRAW, g: STRAWD, o: '#F2E9DA', c: '#FFFFFF', k: '#2A1A10', n: '#2A1A10', p: '#E8707A' },
    { h: STRAW, g: STRAWD, o: '#C9783A', c: '#FFF1DC', k: '#2A1A10', n: '#2A1A10', p: '#D95763' },   // chefe da estação (quepe próprio)
  ];
  // equipe da plataforma: dx = distância pra trás da doca (negativo = à frente do nariz)
  // sc = escala do shiba (a plataforma é vista de 0.2: 44 px viram 9; com 2× o povo se lê). hold = segura o chapéu no estrondo
  const CREW = [
    { dx: -200, pal: 4, role: 'chefe', sc: 2.5, hold: true },
    { dx: 150, pal: 0, sc: 2.1 }, { dx: 300, pal: 2, sc: 1.9, hold: true }, { dx: 470, pal: 3, role: 'bento', sc: 2.0 },
    { dx: 640, pal: 1, sc: 2.2, hold: true }, { dx: 930, pal: 2, sc: 2.0 }, { dx: 1090, pal: 0, sc: 1.9, hold: true },
    { dx: 1250, pal: 3, sc: 2.1 }, { dx: 1440, pal: 1, sc: 2.0, hold: true },
  ];
  const CREW_SC = 2;

  /* ---- tempo ---- */
  const T_ACC = 1.8;   // depois do estrondo: 1,8 s de aceleração pra curtir (câmera vai junto) antes de sumir
  const T_OPEN = 0.8, T_FULL = 9.0, T_WHISTLE = 9.4, T_DEP = 10.0, T_BOOM = T_DEP + 1.6, T_GONE = T_BOOM + T_ACC + 0.45, T_RET = 16.4, T_BRAKE = 17.4, T_CYC = 20;
  const CH = { lay: 3.4, glide: 4.0, ribbon: 5.0, whistle: 5.8, dep: 6.2, boom: 7.8, ret: 10.4, end: 13.4 };
  const A_DEP = 700, S_BOOM = 0.5 * A_DEP * 1.6 * 1.6, V_BOOM = A_DEP * 1.6, RET_D = 14000, RET_D_CH = 12000;
  const A_ACC = 2600, S_ACC = S_BOOM + V_BOOM * T_ACC + A_ACC * T_ACC * T_ACC, V_ACC = V_BOOM + 2 * A_ACC * T_ACC;   // ≈ 11.300 px e 10.500 px/s
  const CAM_CAP = 8200;   // até onde a câmera sugerida persegue o nariz antes de deixar o trem fugir
  function sDep(tau) {
    if (tau <= 0) return 0;
    if (tau < 1.6) return 0.5 * A_DEP * tau * tau;
    const q = tau - 1.6;
    if (q < T_ACC) return S_BOOM + V_BOOM * q + A_ACC * q * q;
    const r = q - T_ACC; return S_ACC + V_ACC * r + 26000 * r * r;
  }
  const sRet = (p, D) => -D * Math.pow(1 - clamp(p, 0, 1), 3);
  // profile(mode, t, out): o "roteiro" puro (sem estado): s, ext (calhas), lid, fill, load, lay (frente do trilho, dx à frente da doca), phase
  function profile(mode, t, o) {
    o = o || {};
    o.lay = 1e9; o.load = false;
    if (mode === 'chegada') {
      o.ext = 0; o.lid = 0; o.fill = 0;
      if (t < CH.lay) { o.lay = lerp(-4800, 520, smooth(t / CH.lay * 0.85 + 0.15) * 1.0); o.s = Math.min(0, o.lay - 640); o.phase = 'chegada'; }
      else if (t < CH.glide) { const s0 = 520 - 640; o.lay = 520; o.s = lerp(s0, 0, smooth((t - CH.lay) / (CH.glide - CH.lay))); o.phase = 'chegada'; }
      else if (t < CH.dep) { o.lay = 520; o.s = 0; o.phase = 'chegada'; }
      else if (t < CH.ret) { o.s = sDep(t - CH.dep); o.phase = t < CH.boom + T_ACC + 0.45 ? 'partindo' : 'fora'; }
      else { o.s = sRet((t - CH.ret) / (CH.end - CH.ret), RET_D_CH); o.phase = 'voltando'; }
      return o;
    }
    const u = ((t % T_CYC) + T_CYC) % T_CYC;
    o.ext = u < T_OPEN ? smooth(u / T_OPEN) : u < T_FULL ? 1 : u < T_FULL + 0.8 ? 1 - smooth((u - T_FULL) / 0.8) : 0;
    o.lid = u < 0.5 ? smooth(u / 0.5) : u < T_WHISTLE ? 1 : u < T_DEP - 0.1 ? 1 - smooth((u - T_WHISTLE) / 0.5) : 0;
    o.fill = u < T_OPEN ? 0 : u < T_FULL ? 1 - Math.pow(1 - (u - T_OPEN) / (T_FULL - T_OPEN), 1.4) : u < T_RET ? 1 : 0;
    o.load = u > T_OPEN + 0.1 && u < T_FULL;
    if (u < T_DEP) { o.s = 0; o.phase = u < T_OPEN ? 'abrindo' : u < T_FULL ? 'carregando' : 'fechando'; }
    else if (u < T_RET) { o.s = sDep(u - T_DEP); o.phase = u < T_GONE ? 'partindo' : 'fora'; }
    else { o.s = sRet((u - T_RET) / (T_CYC - T_RET), RET_D); o.phase = 'voltando'; }
    return o;
  }

  /* ---- pré-render em níveis (cache global) ---- */
  const LEVELS = [0.25, 0.5, 1, 2];
  const bakes = new Map();
  let forceLv = -1;
  function level() {
    if (forceLv >= 0) return forceLv;
    const need = Draw.zoom * (window.devicePixelRatio || 1);
    for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i] >= need * 0.85) return i;
    return LEVELS.length - 1;
  }
  function bake(key, li, x0, y0, w, h, fn) {
    const k = key + '|' + li; let b = bakes.get(k);
    if (b) return b;
    const s = LEVELS[li], cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * s)); cv.height = Math.max(1, Math.ceil(h * s));
    const c = cv.getContext('2d');
    c.scale(s, s); c.translate(-x0, -y0); c.lineJoin = 'round'; c.lineCap = 'round';
    const z = Draw.zoom, mp = Draw.minPx; Draw.lod(s, 0); fn(c); Draw.lod(z, mp);
    b = { cv, x0, y0, w, h }; bakes.set(k, b);
    return b;
  }
  const OLW = 2;
  function olPath(c, col, lw) { c.lineWidth = (lw || OLW) * 2; c.strokeStyle = LINE; c.stroke(); c.fillStyle = col; c.fill(); }

  /* ======================================================================
     arte estática (carrocerias)
     ====================================================================== */
  function bogie(c, x) {
    Draw.box(c, x - 52, -56, 104, 18, C_BOG, { ol: 1.6, top: sh(C_BOG, 0.2), shade: sh(C_BOG, -0.25) });
    for (const dx of [-30, 30]) {
      Draw.circle(c, x + dx, WY, WR, C_WHEEL, { ol: 1.6, hi: false, shade: false });
      c.fillStyle = sh(C_WHEEL, 0.25); c.beginPath(); c.arc(x + dx, WY, WR - 5, 0, TAU); c.fill();
      c.fillStyle = PAL.steel; c.beginPath(); c.arc(x + dx, WY, 5.5, 0, TAU); c.fill();
    }
    Draw.box(c, x - 9, -50, 18, 14, PAL.yel, { ol: 1.2, top: PAL.yelL, shade: PAL.yelD });
    c.strokeStyle = sh(C_BOG, 0.35); c.lineWidth = 2.4; c.beginPath();
    for (let k = 0; k < 4; k++) { c.moveTo(x - 44 + k * 3, -54 + k * 4); c.lineTo(x - 36 + k * 3, -54 + k * 4); c.moveTo(x + 36 + k * 3, -54 + k * 4); c.lineTo(x + 44 + k * 3, -54 + k * 4); }
    c.stroke();
  }
  function bellows(c) {   // sanfona entre vagões: x 0..GAP na frente do vagão
    Draw.box(c, -4, -220, GAP + 8, 150, sh(PAL.blk, 0.05), { ol: 1.4, top: false, shade: false });
    c.fillStyle = sh(PAL.blk, 0.3);
    for (let x = 1; x < GAP; x += 5) c.fillRect(x, -218, 2, 146);
  }
  function bodyPath(c, x0, x1, r) {
    c.beginPath(); c.moveTo(x0, BB); c.lineTo(x0, BT + r); c.quadraticCurveTo(x0, BT, x0 + r, BT); c.lineTo(x1 - r, BT); c.quadraticCurveTo(x1, BT, x1, BT + r); c.lineTo(x1, BB); c.closePath();
  }
  // faixas comuns (dentro do clip da carroceria)
  function bands(c, x0, x1) {
    const w = x1 - x0;
    c.fillStyle = C_BODY; c.fillRect(x0, BT - 4, w, BB - BT + 8);
    c.fillStyle = C_BODYL; c.fillRect(x0, BT, w, 7);
    c.fillStyle = C_ROOF; c.fillRect(x0, BT, w, 5);
    c.fillStyle = C_BODYS; c.fillRect(x0, -96, w, SKIRT + 96);
    c.fillStyle = C_SKIRT; c.fillRect(x0, SKIRT, w, BB - SKIRT);
    c.fillStyle = C_SKIRTD; c.fillRect(x0, BB - 5, w, 5); c.fillRect(x0, SKIRT, w, 2);
    c.fillStyle = C_GOLD; c.fillRect(x0, PIN0, w, PIN1 - PIN0);
  }
  function grain(c, x, y, a, s, col) { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 4.2 * s, 2.3 * s, 0, 0, TAU); c.fill(); c.restore(); }

  /* --- cabeça (nariz pra +x em x=0) --- */
  function leadPath(c) {
    c.beginPath();
    c.moveTo(-LEAD, BB); c.lineTo(-52, BB);
    c.quadraticCurveTo(-6, BB, -1, -92);
    c.bezierCurveTo(3, -124, -96, -166, -190, -204);
    c.bezierCurveTo(-246, -226, -290, BT, -NOSE, BT);
    c.lineTo(-LEAD + 26, BT); c.quadraticCurveTo(-LEAD, BT, -LEAD, BT + 26);
    c.closePath();
  }
  function canopyPath(c) {
    c.beginPath();
    c.moveTo(-138, -166);
    c.quadraticCurveTo(-214, -214, -304, -237);
    c.lineTo(-308, -172);
    c.quadraticCurveTo(-226, -136, -138, -166);
    c.closePath();
  }
  function earPath(c, x, h, w) { c.beginPath(); c.moveTo(x - w / 2, BT + 2); c.quadraticCurveTo(x - w * 0.18, BT - h * 0.7, x + w * 0.12, BT - h); c.quadraticCurveTo(x + w * 0.3, BT - h * 0.45, x + w / 2, BT + 2); c.closePath(); }
  function drawHead(c, F, tail) {
    // orelhas (atrás da cabine, em cima do teto)
    earPath(c, -420, 50, 66); olPath(c, F.furD);
    earPath(c, -352, 62, 76); olPath(c, F.fur);
    c.save(); earPath(c, -350, 40, 40); c.fillStyle = F.cream; c.fill(); c.restore();
    for (const x of [140, 470]) bogie(c, -x);
    leadPath(c); c.lineWidth = OLW * 2.2; c.strokeStyle = LINE; c.stroke();
    c.save(); leadPath(c); c.clip();
    bands(c, -LEAD, 4);
    // máscara de shiba: topo do focinho e testa até a cabine
    c.fillStyle = F.fur;
    c.beginPath(); c.moveTo(6, -92); c.quadraticCurveTo(-46, -88, -98, -106); c.quadraticCurveTo(-150, -126, -178, -166);
    c.lineTo(-196, -250); c.lineTo(20, -250); c.closePath(); c.fill();
    c.fillStyle = F.furD; c.beginPath(); c.moveTo(6, -92); c.quadraticCurveTo(-46, -88, -98, -106); c.quadraticCurveTo(-150, -126, -178, -166);
    c.lineTo(-172, -156); c.quadraticCurveTo(-142, -118, -96, -99); c.quadraticCurveTo(-46, -82, 6, -86); c.closePath(); c.fill();
    c.fillStyle = F.furL; c.beginPath(); c.moveTo(-40, -126); c.quadraticCurveTo(-100, -150, -150, -186); c.lineTo(-140, -190); c.quadraticCurveTo(-96, -158, -36, -132); c.closePath(); c.fill();
    // faixa vermelha em "swoosh" que desce até a boca
    c.fillStyle = C_RED;
    c.beginPath(); c.moveTo(-LEAD, ST0); c.lineTo(-250, ST0); c.quadraticCurveTo(-150, ST0, -60, -80); c.lineTo(-74, -74); c.quadraticCurveTo(-160, ST1, -250, ST1); c.lineTo(-LEAD, ST1); c.closePath(); c.fill();
    c.fillStyle = sh(C_RED, 0.25); c.fillRect(-LEAD, ST0, LEAD - 250, 3);
    // olho = farol, com a "sobrancelha" clara típica de shiba
    c.fillStyle = F.brow; c.beginPath(); c.ellipse(-108, -145, 6, 3.6, -0.45, 0, TAU); c.fill();
    c.fillStyle = LINE; c.beginPath(); c.ellipse(-96, -126, 13, 9.5, -0.42, 0, TAU); c.fill();
    c.fillStyle = F.eye; c.beginPath(); c.ellipse(-96, -126, 11, 7.6, -0.42, 0, TAU); c.fill();
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(-92, -129, 3.4, 0, TAU); c.fill(); c.beginPath(); c.arc(-100, -123, 1.6, 0, TAU); c.fill();
    // bochecha rosada no branco do focinho
    c.fillStyle = 'rgba(232,112,122,.45)'; c.beginPath(); c.ellipse(-112, -96, 14, 7, -0.2, 0, TAU); c.fill();
    // janelas de passageiros
    for (let i = 0; i < 5; i++) Draw.window(c, -560 + i * 38, -196, 24, 26, { col: C_GLASSL, r: 6, ol: 1.3 });
    // porta
    Draw.box(c, -352, -206, 34, 118, sh(C_BODY, -0.05), { ol: 1.3, top: false, shade: false });
    Draw.window(c, -346, -198, 22, 30, { col: C_GLASSL, r: 5, ol: 1 });
    c.restore();
    // cabine (vidro escuro; o Kome entra ao vivo)
    canopyPath(c); olPath(c, C_GLASS, 1.6);
    c.save(); canopyPath(c); c.clip(); c.fillStyle = C_GLASSL; c.fillRect(-312, -240, 180, 12); c.restore();
    // focinho preto na ponta + boquinha "w"
    c.fillStyle = LINE; c.beginPath(); c.ellipse(-8, -94, 13, 11, 0.5, 0, TAU); c.fill();
    c.fillStyle = sh(F.eye, 0.12); c.beginPath(); c.ellipse(-8, -94, 10.5, 8.6, 0.5, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-6, -99, 4, 2, 0.4, 0, TAU); c.fill();
    c.strokeStyle = LINE; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-14, -82); c.quadraticCurveTo(-18, -72, -28, -72); c.quadraticCurveTo(-36, -72, -38, -78);
    c.moveTo(-38, -78); c.quadraticCurveTo(-42, -70, -50, -72); c.stroke();
    // engate coberto e farolete
    // base do pantógrafo
    Draw.box(c, -500, BT - 12, 64, 12, C_ROOF, { ol: 1.3 });
  }
  function bakeHead(c, tail) {
    if (!tail) { drawHead(c, FACE_A, false); return; }
    c.save(); c.translate(-LEAD, 0); c.scale(-1, 1); drawHead(c, FACE_B, true); c.restore();
  }
  function headText(c, tail) {
    Draw.text(c, 'TREM-BALA DE ARROZ', -LEAD + 160 + (tail ? 120 : 0), -90, { size: 17, col: C_RED, sw: 0, weight: 900 });
    Draw.text(c, tail ? 'Nº 10' : 'Nº 1', tail ? -560 + 470 : -LEAD + 300 + 30, -90, { size: 13, col: PAL.ink, sw: 0, weight: 800 });
  }

  /* --- vagão A: tanque-onigiri --- */
  function oniPath(c) {
    const xl = -CAR + 22, xr = -22, yb = -256, ya = -490;   // canto arredondado: o topo real fica em ≈ -446 (boca da escotilha)
    c.beginPath(); c.moveTo(HX, yb);
    c.arcTo(xr, yb, HX, ya, 46); c.arcTo(HX, ya, xl, yb, 48); c.arcTo(xl, yb, HX, yb, 46);
    c.closePath();
  }
  function bakeA(c, idx) {
    bellows(c);
    bogie(c, -72); bogie(c, -CAR + 72);
    bodyPath(c, -CAR, 0, 22); c.lineWidth = OLW * 2.2; c.strokeStyle = LINE; c.stroke();
    c.save(); bodyPath(c, -CAR, 0, 22); c.clip(); bands(c, -CAR, 0); c.fillStyle = C_RED; c.fillRect(-CAR, ST0, CAR, ST1 - ST0); c.fillStyle = sh(C_RED, 0.25); c.fillRect(-CAR, ST0, CAR, 3); c.restore();
    // berço de aço
    Draw.box(c, -CAR + 40, BT - 18, CAR - 80, 18, PAL.steelD, { ol: 1.4, top: PAL.steel });
    for (const x of [-CAR + 70, -100]) Draw.box(c, x - 8, BT - 44, 16, 28, PAL.steelD, { ol: 1.2 });
    // onigiri
    oniPath(c); c.lineWidth = OLW * 2.4; c.strokeStyle = LINE; c.stroke();
    c.save(); oniPath(c); c.clip();
    c.fillStyle = PAL.rice; c.fillRect(-CAR, -470, CAR, 230);
    c.fillStyle = PAL.riceS; c.beginPath(); c.ellipse(HX + 70, -270, 130, 70, 0, 0, TAU); c.fill();
    c.fillStyle = PAL.rice; c.beginPath(); c.ellipse(HX - 14, -300, 120, 80, 0, 0, TAU); c.fill();
    for (let i = 0; i < 46; i++) grain(c, HX + (rnd(i * 3 + idx) - 0.5) * 260, -270 - rnd(i * 7 + 1) * 170, rnd(i * 11) * PI, 1.2, i & 1 ? PAL.riceS : '#F1E9D6');
    // nori
    c.fillStyle = C_NORI; c.fillRect(HX - 62, -318, 124, 70);
    c.fillStyle = C_NORIL; c.fillRect(HX - 62, -318, 124, 6); c.fillRect(HX - 40, -308, 3, 56); c.fillRect(HX + 22, -308, 3, 56);
    c.restore();
    Draw.text(c, 'KOME', HX, -286, { size: 18, col: C_GOLD, sw: 0, weight: 900 });
    // carinha: olhinhos felizes, bochecha e a boca-escotilha (mostra o nível)
    c.strokeStyle = LINE; c.lineWidth = 3.2; c.beginPath();
    c.arc(HX - 30, -366, 7, PI * 1.1, PI * 1.9); c.moveTo(HX + 37, -366); c.arc(HX + 30, -366, 7, PI * 1.1, PI * 1.9); c.stroke();
    c.fillStyle = 'rgba(232,112,122,.5)'; c.beginPath(); c.ellipse(HX - 46, -352, 9, 5, 0, 0, TAU); c.ellipse(HX + 46, -352, 9, 5, 0, 0, TAU); c.fill();
    Draw.circle(c, HX, -342, 17, PAL.steel, { ol: 1.6, hi: false, shade: false });
    c.fillStyle = C_GLASS; c.beginPath(); c.arc(HX, -342, 12.5, 0, TAU); c.fill();
    // boca da escotilha no topo
    Draw.box(c, HX - 22, HATCH_A - 10, 44, 14, PAL.steel, { ol: 1.4, top: PAL.steelL, shade: PAL.steelD });
    // texto da lateral
    Draw.text(c, 'ONIGIRI EXPRESSO', -CAR / 2, -176, { size: 15, col: PAL.ink, sw: 0, weight: 900 });
    Draw.text(c, 'Nº ' + (idx + 1), -CAR / 2, -90, { size: 12, col: PAL.ink, sw: 0, weight: 800 });
  }
  /* --- vagão B: tremonha aberta --- */
  function hopPath(c) { c.beginPath(); c.moveTo(-CAR + 30, BT - 8); c.lineTo(-30, BT - 8); c.lineTo(-14, RIM_B); c.lineTo(-CAR + 14, RIM_B); c.closePath(); }
  function bakeB(c, idx) {
    bellows(c);
    bogie(c, -72); bogie(c, -CAR + 72);
    bodyPath(c, -CAR, 0, 22); c.lineWidth = OLW * 2.2; c.strokeStyle = LINE; c.stroke();
    c.save(); bodyPath(c, -CAR, 0, 22); c.clip(); bands(c, -CAR, 0); c.fillStyle = C_RED; c.fillRect(-CAR, ST0, CAR, ST1 - ST0); c.fillStyle = sh(C_RED, 0.25); c.fillRect(-CAR, ST0, CAR, 3); c.restore();
    hopPath(c); c.lineWidth = OLW * 2.4; c.strokeStyle = LINE; c.stroke();
    c.save(); hopPath(c); c.clip();
    c.fillStyle = C_RED; c.fillRect(-CAR, RIM_B, CAR, BT - RIM_B);
    c.fillStyle = sh(C_RED, 0.22); c.fillRect(-CAR, RIM_B, CAR, 10);
    c.fillStyle = sh(C_RED, -0.22); c.fillRect(-CAR, BT - 24, CAR, 16);
    c.fillStyle = PAL.cream; c.fillRect(-CAR, -318, CAR, 34);
    c.fillStyle = sh(C_RED, -0.3); for (let x = -CAR + 52; x < -20; x += 46) { if (x > -CAR + 60 && x < -60 && false) continue; c.fillRect(x, RIM_B + 10, 3, BT - RIM_B - 18); }
    c.restore();
    Draw.text(c, 'ARROZ', -CAR / 2, -300, { size: 26, col: C_RED, sw: 0, weight: 900 });
    Draw.box(c, -CAR + 8, RIM_B - 7, CAR - 16, 9, PAL.steel, { ol: 1.4, top: PAL.steelL, shade: false });
    Draw.text(c, 'GRANEL DE ARROZ · 60 t', -CAR / 2, -176, { size: 14, col: PAL.ink, sw: 0, weight: 900 });
    Draw.text(c, 'Nº ' + (idx + 1), -CAR / 2, -90, { size: 12, col: PAL.ink, sw: 0, weight: 800 });
  }
  function carBake(i, face, li) {
    const kind = KIND[i], len = LEN[i], front = kind === 'lead' ? 6 : GAP + 6;
    const bx0 = -len - 6, bw = len + front + 6, y0 = -480, h = 486;
    const x0 = face > 0 ? bx0 : -(bx0 + bw);
    const key = (kind === 'A' || kind === 'B') ? kind + i : kind;
    return bake('car' + key + '|' + face, li, x0, y0, bw, h, c => {
      c.save(); c.scale(face, 1);
      if (kind === 'lead') { bakeHead(c, false); headText(c, false); }
      else if (kind === 'tail') { bellows(c); bakeHead(c, true); headText(c, true); }
      else if (kind === 'A') bakeA(c, i);
      else bakeB(c, i);
      c.restore();
    });
  }

  /* --- trilho, poste, plataforma --- */
  const TW = 512;
  function trackBake(li) {
    return bake('track', li, 0, -24, TW, 46, c => {
      c.fillStyle = LINE; c.fillRect(0, -11, TW, 30);
      c.fillStyle = '#9C9282'; c.fillRect(0, -9, TW, 26); c.fillStyle = '#B3A996'; c.fillRect(0, -9, TW, 6); c.fillStyle = '#857C6D'; c.fillRect(0, 10, TW, 7);
      for (let i = 0; i < 40; i++) { c.fillStyle = i & 1 ? '#8A8172' : '#C2B8A4'; c.fillRect(rnd(i) * TW, -4 + rnd(i + 9) * 18, 4, 3); }
      for (let x = 0; x < TW; x += 32) { c.fillStyle = LINE; c.fillRect(x + 5, -14, 22, 9); c.fillStyle = PAL.stoneL; c.fillRect(x + 6, -13, 20, 7); c.fillStyle = PAL.stone; c.fillRect(x + 6, -8, 20, 2); }
      c.fillStyle = LINE; c.fillRect(0, RAIL - 1.5, TW, 7);
      c.fillStyle = PAL.steel; c.fillRect(0, RAIL, TW, 4); c.fillStyle = PAL.steelL; c.fillRect(0, RAIL, TW, 1.5);
    });
  }
  function poleBake(li) {
    return bake('pole', li, -24, MESS - 30, 100, -MESS + 34, c => {
      Draw.box(c, -9, MESS - 20, 18, -MESS + 20 + 2, PAL.grayL, { ol: 1.4, top: false, shade: PAL.gray });
      c.fillStyle = PAL.gray; c.fillRect(-3, MESS - 16, 6, -MESS + 14);
      Draw.box(c, -14, -6, 28, 8, PAL.stone, { ol: 1.2 });
      Draw.beam(c, [[0, MESS - 6], [64, MESS - 6]], 6, PAL.grayL, { ol: 1.2, hi: false });
      Draw.beam(c, [[0, WIRE - 16], [58, WIRE - 4]], 5, PAL.grayL, { ol: 1.2, hi: false });
      Draw.beam(c, [[8, MESS + 30], [56, MESS - 6]], 3.5, PAL.gray, { ol: 1, hi: false });
      for (const [x, y] of [[50, MESS - 2], [46, WIRE - 8]]) { Draw.box(c, x - 4, y, 8, 12, '#B5523F', { ol: 1, top: false, shade: false }); c.fillStyle = '#D9806A'; c.fillRect(x - 4, y + 3, 8, 2); c.fillRect(x - 4, y + 7, 8, 2); }
    });
  }
  function platBake(face, li) {
    const bx0 = -PLAT1 - 10, bw = PLAT1 - PLAT0 + 20, y0 = -250, h = 290;
    const x0 = face > 0 ? bx0 : -(bx0 + bw);
    return bake('plat|' + face, li, x0, y0, bw, h, c => {
      c.save(); c.scale(face, 1);
      const a = -PLAT1, b = -PLAT0;
      // placa da estação (dois postes)
      const sx = -1360;
      for (const px of [sx - 120, sx + 120]) Draw.box(c, px - 5, -196, 10, 170, PAL.steelD, { ol: 1.2, top: false });
      Draw.box(c, sx - 170, -236, 340, 62, '#2E4A7A', { ol: 1.8, r: 6, top: '#3F5F96', shade: '#24395E' });
      Draw.box(c, sx - 162, -228, 324, 8, PAL.cream, { ol: 0, r: 2, top: false, shade: false });
      Draw.text(c, 'PÉ-DO-MONTE', sx, -200, { size: 26, col: PAL.cream, sw: 0, weight: 900 });
      Draw.text(c, '← volta ao Japão · 5 s →', sx, -181, { size: 11, col: PAL.goldL, sw: 0, weight: 800 });
      // laje
      Draw.box(c, a, PLAT_Y, b - a, 64, PAL.stoneL, { ol: 2, top: '#E4DECF', shade: PAL.stone });
      c.fillStyle = '#E8C640'; c.fillRect(a, PLAT_Y + 1, b - a, 5);
      c.fillStyle = '#BE9E2C'; for (let x = a + 6; x < b; x += 12) c.fillRect(x, PLAT_Y + 2, 6, 3);
      c.fillStyle = PAL.stone; for (let x = a + 80; x < b; x += 160) c.fillRect(x, PLAT_Y + 10, 2, 50);
      c.fillStyle = LINE; c.fillRect(a, PLAT_Y + 8, b - a, 1.5);
      // poste do painel de horários
      Draw.box(c, -BOARD_DX - 5, -170, 10, 142, PAL.steelD, { ol: 1.2, top: false });
      c.restore();
    });
  }

  /* ======================================================================
     estado
     ====================================================================== */
  function create(opts) {
    opts = opts || {};
    const m = {
      id: 'trembala', mode: opts.mode === 'chegada' ? 'chegada' : 'normal', pilot: opts.pilot || 'kome',
      init: false, x: 0, y: 0, face: 1, t: 0, ct: 0, tc: 0,
      s: 0, v: 0, acc: 0, ext: 0, lid: 0, fill: 0, payload: 0, load: false, lay: 1e9, phase: 'abrindo',
      slack: new Float32Array(NCAR), slackV: new Float32Array(NCAR),
      ch: [], bitesA: [], biteO: { x: 0, y: 0, r: 70, active: false, phase: 0 }, dumpO: { x: 0, y: 0, active: false }, seatO: { x: 0, y: 0 },
      hats: CREW.map(() => ({ st: 0, x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0 })),
      boomT: -99, boomX: 0, flash: 0, shakeK: 0, speed: { on: false, dir: 1, k: 0 },
      lap: 4.8, best: 99, record: false, sparkT: 0, sparkA: 0, conf: [], title: 0, cam: { x: 0, y: -300, z: 0.2 }, camInit: false,
      ev: [], parts: null, night: 0, view: null, floorF: null, prof: {},
    };
    for (let k = 0; k < NCAR; k++) if (KIND[k] === 'A' || KIND[k] === 'B') { m.ch.push({ car: k, hx: 0, hy: 0, ix: 0, iy: 0, has: false }); m.bitesA.push({ x: 0, y: 0, r: 70, active: false }); }
    return m;
  }
  const carX = (m, i) => m.x + m.face * (m.s - FRONT[i] + m.slack[i]);
  function emit(m, e) { m.ev.push(e); }

  function update(m, dt, inp) {
    m.ev.length = 0;
    dt = Math.min(dt, 0.1);
    if (!m.init) { m.init = true; m.x = inp.x || 0; }
    m.y = inp.y || 0; m.face = inp.face < 0 ? -1 : 1; m.night = +inp.night || 0; m.parts = inp.parts || null;
    m.view = inp.view || null; m.floorF = inp.floor || null;
    const f = m.face, sp = inp.speedMul || 1;
    m.t += dt;
    let d = dt * sp;
    const P = m.prof;
    if (m.mode === 'chegada') {
      const t0 = m.tc, t1 = t0 + d; m.tc = t1;
      const cr = a => t0 < a && t1 >= a;
      if (cr(1.2) || cr(2.4)) emit(m, 'horn');
      if (cr(CH.glide)) { emit(m, 'arrive'); kick(m, 1); }
      if (cr(CH.ribbon)) { emit(m, 'ribbon'); confetti(m); m.title = 0.001; }
      if (cr(CH.whistle)) emit(m, 'whistle');
      if (cr(CH.dep)) { emit(m, 'depart'); emit(m, 'clank'); }
      if (cr(CH.boom)) boom(m);
      if (cr(CH.ret)) onReturn(m);
      if (t1 >= CH.end) { m.mode = 'normal'; m.ct = t1 - CH.end; emit(m, 'arrive'); emit(m, 'ready'); kick(m, 1); m.title = 0; }
    }
    if (m.mode === 'normal') {
      let u0 = ((m.ct % T_CYC) + T_CYC) % T_CYC;
      if (inp.digging === false && u0 >= T_OPEN && u0 < T_FULL) d = 0;
      const u1 = u0 + d; m.ct += d;
      const cr = a => (u0 < a && u1 >= a) || (u0 < a + T_CYC && u1 >= a + T_CYC);
      if (cr(T_OPEN)) emit(m, 'load');
      if (cr(T_FULL)) emit(m, 'full');
      if (cr(T_WHISTLE)) emit(m, 'whistle');
      if (cr(T_DEP)) { emit(m, 'depart'); emit(m, 'clank'); m.payload = m.fill; }
      if (cr(T_BOOM)) boom(m);
      if (cr(T_RET)) onReturn(m);
      if (cr(T_BRAKE)) emit(m, 'brake');
      if (u0 < T_CYC && u1 >= T_CYC) { emit(m, 'arrive'); emit(m, 'clank'); kick(m, 1); }
      profile('normal', m.ct, P);
    } else profile('chegada', m.tc, P);
    // movimento e sanfona dos engates
    const vOld = m.v;
    m.v = dt > 0 ? (P.s - m.s) / dt : 0;
    if (Math.abs(m.v) > 40000) m.v = Math.sign(m.v) * 40000;
    const a = dt > 0 ? clamp((m.v - vOld) / dt, -2600, 2600) : 0;
    m.s = P.s; m.acc = a;
    m.ext = P.ext; m.lid = P.lid; m.fill = P.fill; m.load = P.load && inp.digging !== false; m.lay = P.lay; m.phase = P.phase;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let s = 0; s < n; s++) {
      const h = dt / n;
      for (let i = 1; i < NCAR; i++) {
        const want = -a * 0.0052 * i / (NCAR - 1);
        m.slackV[i] += ((want - m.slack[i]) * 70 - m.slackV[i] * 2.6) * h;
        m.slack[i] = clamp(m.slack[i] + m.slackV[i] * h, -26, 26);
      }
    }
    // calhas e mordidas
    const floor = m.floorF;
    let nAct = 0;
    for (let k = 0; k < m.ch.length; k++) {
      const c = m.ch[k], i = c.car, fx = m.x - f * FRONT[i];   // calhas são da estação: miram a vaga do vagão parado
      c.hx = fx + f * HX; c.hy = m.y + (KIND[i] === 'A' ? HATCH_A : HATCH_B);
      c.ix = c.hx - f * 70; c.iy = floor ? floor(c.ix) : m.y - 950;
      c.has = c.iy < c.hy - 150;
      const b = m.bitesA[k]; b.x = c.ix; b.y = c.iy; b.r = 70; b.active = m.load && c.has && m.ext > 0.9;
      if (b.active) nAct++;
    }
    const mid = m.bitesA[3] || m.bitesA[0];
    let pick = mid; if (!mid.active) for (const b of m.bitesA) if (b.active) { pick = b; break; }
    const bo = m.biteO; bo.x = pick.x; bo.y = pick.y; bo.r = pick.r; bo.active = pick.active; bo.phase = P.fill;
    const dc = m.ch[3] || m.ch[0]; m.dumpO.x = dc.hx; m.dumpO.y = dc.hy; m.dumpO.active = m.load && m.ext > 0.9;
    m.seatO.x = carX(m, 0) + f * KOME_FEET[0]; m.seatO.y = m.y + KOME_FEET[1] - 32;
    // efeitos
    m.flash = Math.max(0, m.flash - dt * 4); m.shakeK = Math.max(0, m.shakeK - dt * 1.4);
    const sinceBoom = m.t - m.boomT;
    const accel = m.phase === 'partindo' && m.v > 600;
    m.speed.on = sinceBoom < 1.3 || accel || (m.phase === 'voltando' && Math.abs(m.v) > 2500); m.speed.dir = f;
    m.speed.k = Math.max(sinceBoom < 1.3 ? 1 - sinceBoom / 1.3 : 0, clamp(Math.abs(m.v) / 9000, 0, 1));
    if (m.title > 0) m.title = Math.min(1, m.title + dt / 2.8);
    if (m.title >= 1) m.title = 0;
    partsTick(m, dt, nAct);
    hatsTick(m, dt);
    confTick(m, dt);
    camTick(m, dt);
  }
  function kick(m, k) { for (let i = 1; i < NCAR; i++) m.slackV[i] += k * 46 * i / (NCAR - 1) * (i & 1 ? 1 : 0.8); }
  function boom(m) {
    emit(m, 'boom');
    m.boomT = m.t; m.boomX = m.x - m.face * (TRAIN / 2 - 300); m.flash = 1; m.shakeK = 1;
    const f = m.face;
    for (let k = 0; k < m.hats.length; k++) {
      const h = m.hats[k], c = CREW[k]; if (h.st !== 0 || c.hold) continue;
      const sc = c.sc || CREW_SC;
      h.st = 1; h.x = m.x - f * c.dx; h.y = m.y + PLAT_Y - 34 * sc; h.vx = f * (520 + rnd(k + m.t) * 700); h.vy = -(380 + rnd(k * 3 + m.t) * 360); h.r = 0; h.vr = (rnd(k * 5 + m.t) - 0.5) * 22;
    }
    if (m.parts) for (let i = 0; i < 14; i++) m.parts.puff(m.x - f * (i * 300 - 600), m.y - 6, 2, 26, { c: PAL.sand, speed: 260, up: 40 });
  }
  function onReturn(m) {
    emit(m, 'return');
    m.lap = Math.round((4.4 + rnd(Math.floor(m.t * 7)) * 0.9) * 10) / 10;
    m.record = m.lap < m.best; if (m.record) m.best = m.lap;
  }
  function partsTick(m, dt, nAct) {
    const P = m.parts, f = m.face;
    // pantógrafo: faísca no fio (mais com o trem andando)
    m.sparkT -= dt;
    const moving = Math.abs(m.v) > 150;
    if (m.sparkT <= 0) {
      m.sparkT = moving ? 0.25 + Math.random() * 0.3 : 1.2 + Math.random() * 2.2;
      m.sparkA = 1;
      if (m.sparkA && (m.t - (m.lastSparkEv || -9)) > 0.5) { emit(m, 'spark'); m.lastSparkEv = m.t; }
      if (P) for (const [ci, px] of PANTO) { const x = carX(m, ci) + f * px; P.sparks(x, m.y + WIRE + 4, moving ? 5 : 3, { c: ['#FFFFFF', '#BFE6FF', PAL.goldL], speed: [80, 260], dir: moving ? (f > 0 ? PI : 0) : -PI / 2, spread: PI * 0.7 }); }
    }
    m.sparkA = Math.max(0, m.sparkA - dt * 7);
    if (!P) return;
    // grãos caindo nas bocas e poeira nas tomadas da montanha
    if (m.load && m.ext > 0.9) {
      m.pAcc = (m.pAcc || 0) + dt * 10;
      while (m.pAcc >= 1) {
        m.pAcc -= 1;
        const c = m.ch[(Math.random() * m.ch.length) | 0];
        P.spray(c.hx, c.hy - 6, 2, { shape: 'grain', c: [PAL.rice, PAL.riceS], w: 3, life: 0.6, speed: [40, 120], dir: -PI / 2, spread: 1.2, ol: true });
        if (c.has && Math.random() < 0.5) P.puff(c.ix, c.iy, 1, 16, { c: PAL.riceS, speed: 50, up: 20 });
      }
    }
    // freio: faíscas nas rodas
    if (m.phase === 'voltando' && Math.abs(m.v) < 7000 && Math.abs(m.v) > 300) {
      for (let k = 0; k < 3; k++) {
        const i = (Math.random() * NCAR) | 0, x = carX(m, i) - f * (LEN[i] * (0.2 + Math.random() * 0.6));
        P.sparks(x, m.y + RAIL, 2, { c: ['#FFE08A', '#FFB347', '#FFFFFF'], speed: [120, 380], dir: f > 0 ? PI + 0.25 : -0.25, spread: 0.5 });
      }
    }
  }
  function groundY(m, x) { const dx = (m.x - x) * m.face; return dx > PLAT0 && dx < PLAT1 ? m.y + PLAT_Y : m.y; }
  function hatsTick(m, dt) {
    const f = m.face, u = m.mode === 'normal' ? ((m.ct % T_CYC) + T_CYC) % T_CYC : -1;
    for (let k = 0; k < m.hats.length; k++) {
      const h = m.hats[k];
      if (h.st === 1) {
        h.vy += 900 * dt; h.vx *= 1 - 0.7 * dt; h.vy *= 1 - 0.4 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.r += h.vr * dt; h.vr *= 1 - 0.8 * dt;
        h.vx += Math.sin(m.t * 3 + k) * 60 * dt;
        const gy = groundY(m, h.x) - 3;
        if (h.y >= gy && h.vy > 0) { h.y = gy; h.st = 2; h.r = rnd(k) * 0.6 - 0.3; }
        if (Math.abs(h.x - m.x) > 9000) h.st = 3;
      }
      // o trem voltando passa e leva de novo os chapéus caídos
      if (h.st === 2 && m.phase === 'voltando' && Math.abs(m.v) > 800) {
        const tail = carX(m, NCAR - 1) - f * LEAD, nose = carX(m, 0);
        if ((h.x - tail) * f > -400 && (h.x - nose) * f < 300) { h.st = 1; h.vx = f * (700 + rnd(k + 2) * 500); h.vy = -(200 + rnd(k) * 300); h.vr = (rnd(k + 7) - 0.5) * 18; }
      }
      // chapéu novo depois que o trem encosta (o chefe tem uma caixa deles)
      if (h.st !== 0 && (m.mode === 'chegada' ? m.tc < CH.boom : u > 0.5 && u < T_DEP)) { if (h.st === 1 && m.mode === 'chegada') continue; h.st = 0; }
    }
  }
  function confetti(m) {
    const f = m.face, cx = m.x + f * 190;
    const cols = [PAL.red, PAL.gold, '#4FA3E0', '#7FC25A', '#F4B8C5', PAL.cream];
    for (let i = 0; i < 70; i++) m.conf.push({ x: cx + (Math.random() - 0.5) * 60, y: m.y - 130, vx: (Math.random() - 0.5) * 700, vy: -300 - Math.random() * 600, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 16, c: cols[i % cols.length], life: 2.6 + Math.random() });
    if (m.parts) m.parts.burst(cx, m.y - 140, 30, { c: cols, speed: [120, 420] });
  }
  function confTick(m, dt) {
    for (let i = m.conf.length - 1; i >= 0; i--) {
      const p = m.conf[i]; p.life -= dt; if (p.life <= 0) { m.conf.splice(i, 1); continue; }
      p.vy += 520 * dt; p.vx *= 1 - 1.4 * dt; p.vy *= 1 - 1.2 * dt; p.x += p.vx * dt + Math.sin(m.t * 6 + i) * 30 * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      const gy = groundY(m, p.x); if (p.y > gy) { p.y = gy; p.vy = 0; p.vx = 0; p.vr = 0; }
    }
  }
  function camTick(m, dt) {
    const f = m.face, c = m.cam;
    let tx, ty, tz;
    if (m.mode === 'chegada' && m.tc < CH.dep) {
      if (m.tc < CH.lay - 0.4) { tx = m.x + f * (m.lay - 150); ty = -260; tz = 0.34; }
      else { tx = m.x + f * 60; ty = -230; tz = 0.46; }
    } else { tx = m.x - f * (TRAIN / 2 - 260); ty = -560; tz = 0.2; }
    // partida: a câmera persegue o trem (nariz ~1/3 da tela à frente) até CAM_CAP; depois ele foge e ela volta pra estação
    let kx = m.mode === 'chegada' && m.tc < CH.lay ? 7 : 2.2;
    if (m.phase === 'partindo' && m.s > 0) {
      const s = Math.min(m.s, CAM_CAP);
      tx = m.x + f * (s - TRAIN * 0.42 + 260 * (1 - smooth(m.s / 2400))); ty = -540; tz = 0.2 - 0.02 * smooth(m.s / 6000);
      kx = m.s < CAM_CAP ? 2.2 + 5 * smooth(m.s / 3000) : 3;
    }
    if (!m.camInit) { m.camInit = true; c.x = tx; c.y = ty; c.z = tz; return; }
    c.x = damp(c.x, tx, kx, dt); c.y = damp(c.y, ty, 2.2, dt); c.z = damp(c.z, tz, 1.8, dt);
  }

  /* ======================================================================
     desenho
     ====================================================================== */
  const VW = { x0: 0, x1: 0 };
  function viewOf(g, m) {
    if (m.view) { VW.x0 = m.view.x0; VW.x1 = m.view.x1; return VW; }
    const T = g.getTransform ? g.getTransform() : null, W = g.canvas ? g.canvas.width : 4000;
    if (!T || !T.a) { VW.x0 = m.x - 8000; VW.x1 = m.x + 8000; return VW; }
    const a = (0 - T.e) / T.a, b = (W - T.e) / T.a;
    VW.x0 = Math.min(a, b) - 60; VW.x1 = Math.max(a, b) + 60;
    return VW;
  }
  const TMP = { x: 0, y: 0 };
  const KOME_O = { scale: 1, face: 1, pal: 'kome', hat: false, shadow: false };
  const CREW_O = { scale: 1, face: 1, pal: null, hat: true, shadow: true };

  function draw(g, m) {
    if (!m.init) return;
    const f = m.face, li = level(), v = viewOf(g, m), t = m.t;
    const lay = m.lay < 1e8 ? m.x + f * m.lay : null;
    // trilho (até a frente da obra, na cena de estreia)
    let xa = v.x0, xb = v.x1;
    if (lay !== null) { if (f > 0) xb = Math.min(xb, lay); else xa = Math.max(xa, lay); }
    const tb = trackBake(li);
    if (xb > xa) {
      g.save(); g.beginPath(); g.rect(xa, m.y - 30, xb - xa, 60); g.clip();
      for (let x = Math.floor((xa - m.x) / TW) * TW + m.x; x < xb; x += TW) g.drawImage(tb.cv, x, m.y + tb.y0, TW, tb.h);
      g.restore();
    }
    drawCatenary(g, m, v, li, lay, 'poles');
    drawTowers(g, m, li);
    // vagões, da cauda pra cabeça
    const fast = Math.abs(m.v) > 2600;
    for (let i = NCAR - 1; i >= 0; i--) {
      const fx = carX(m, i), x0 = Math.min(fx, fx - f * LEN[i]) - 40, x1 = Math.max(fx, fx - f * LEN[i]) + 40;
      if (x1 < v.x0 || x0 > v.x1) continue;
      const b = carBake(i, f, li);
      if (fast) {
        const dx = -f * clamp(Math.abs(m.v) * 0.02, 0, 260);
        g.globalAlpha = 0.22; g.drawImage(b.cv, fx + b.x0 + dx * 2, m.y + b.y0, b.w, b.h);
        g.globalAlpha = 0.4; g.drawImage(b.cv, fx + b.x0 + dx, m.y + b.y0, b.w, b.h); g.globalAlpha = 1;
      }
      g.drawImage(b.cv, fx + b.x0, m.y + b.y0, b.w, b.h);
      g.save(); g.translate(fx, m.y); g.scale(f, 1);
      carLive(g, m, i);
      g.restore();
    }
    drawSpeedStreaks(g, m, v);
    drawChutes(g, m, li);
    drawCatenary(g, m, v, li, lay, 'wires');   // fio por cima das calhas: elas descem da encosta POR TRÁS da catenária
    drawStation(g, m, li, v);
    drawFx(g, m, v);
  }

  function drawCatenary(g, m, v, li, lay, part) {
    const f = m.face, pb = poleBake(li);
    const xa = v.x0 - 80, xb = v.x1 + 80;
    let wa = xa, wb = xb;
    if (lay !== null) { if (f > 0) wb = Math.min(wb, lay); else wa = Math.max(wa, lay); }
    if (wb <= wa) return;
    const k0 = Math.floor((wa - m.x) / POLE) - 1, k1 = Math.ceil((wb - m.x) / POLE) + 1;
    // postes (os novos sobem com um quique)
    if (part !== 'wires') for (let k = k0; k <= k1; k++) {
      const x = m.x + k * POLE + 30 * f;
      if (x < wa - 60 || x > wb + 60) continue;
      let sc = 1;
      if (lay !== null) { const d = (lay - x) * f; if (d < 0) continue; sc = d < 160 ? smooth(d / 160) * (1 + 0.15 * Math.sin(d / 160 * PI)) : 1; }
      if (sc < 0.999) { g.save(); g.translate(x, m.y); g.scale(1, sc); g.drawImage(pb.cv, pb.x0, pb.y0, pb.w, pb.h); g.restore(); }
      else g.drawImage(pb.cv, x + pb.x0, m.y + pb.y0, pb.w, pb.h);
    }
    if (part === 'poles') return;
    // fio de contato e mensageiro (com barriga entre postes) e pendurais
    const y = m.y;
    g.strokeStyle = LINE; g.lineWidth = 3; g.beginPath(); g.moveTo(wa, y + WIRE); g.lineTo(wb, y + WIRE); g.stroke();
    g.strokeStyle = '#7A6A58'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(wa, y + WIRE - 0.4); g.lineTo(wb, y + WIRE - 0.4); g.stroke();
    g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath();
    for (let k = k0; k <= k1; k++) {
      const a = m.x + k * POLE + 30 * f + 50, b = a + POLE;
      if (b < wa || a > wb) continue;
      g.moveTo(a, y + MESS); g.quadraticCurveTo((a + b) / 2, y + MESS + 56, b, y + MESS);
    }
    g.stroke();
    if (Draw.zoom * (window.devicePixelRatio || 1) > 0.28) {
      g.lineWidth = 1.2; g.beginPath();
      for (let k = k0; k <= k1; k++) {
        const a = m.x + k * POLE + 30 * f + 50;
        for (let j = 1; j < 6; j++) { const x = a + j * POLE / 6; if (x < wa || x > wb) continue; const q = j / 6; g.moveTo(x, y + MESS + 56 * 4 * q * (1 - q) * 0.5); g.lineTo(x, y + WIRE); }
      }
      g.stroke();
    }
  }
  // torre de carga pros vagões sem montanha em cima (pernas atrás do trem)
  function drawTowers(g, m, li) {
    if (m.s !== 0 && Math.abs(m.s) > 1) { /* torres ficam paradas na estação */ }
    for (const c of m.ch) {
      if (c.has) continue;
      const x = m.x + m.face * (-FRONT[c.car] + HX), top = m.y - 640;
      Draw.lattice(g, x - 22, top, 44, m.y - top, 40, 4, PAL.grayL, { ol: 1.2 });
    }
  }
  function towerHead(g, m, c) {
    const x = m.x + m.face * (-FRONT[c.car] + HX), top = m.y - 640;
    Draw.poly(g, [[x - 60, top - 70], [x + 60, top - 70], [x + 16, top + 4], [x - 16, top + 4]], PAL.yel, { ol: 1.6, shade: PAL.yelD, hi: PAL.yelL });
    Draw.text(g, 'ARROZ', x, top - 44, { size: 18, col: PAL.ink, sw: 0, weight: 900 });
    return [x, top + 4];
  }

  function pantograph(g, m, px, up) {
    const hy = WIRE + 6 + (1 - up) * 210, bx = px + 22, by = BT - 12;
    const hx = px - 4, dx = hx - bx, dy = hy - by, d = Math.hypot(dx, dy), L1 = 136, a = d / 2;
    const hgt = Math.sqrt(Math.max(0, L1 * L1 - a * a)), nx = -dy / d, ny = dx / d;
    const sgn = nx < 0 ? 1 : -1;   // joelho pra trás (-x)
    const kx = bx + dx / 2 + nx * hgt * sgn, ky = by + dy / 2 + ny * hgt * sgn;
    for (const x of [px - 22, px + 22]) { Draw.box(g, x - 5, BT - 22, 10, 12, '#B5523F', { ol: 1, top: false, shade: false }); g.fillStyle = '#D9806A'; g.fillRect(x - 5, BT - 18, 10, 2); }
    Draw.beam(g, [[bx, by], [kx, ky]], 8, PAL.grayL, { ol: 1.3, hi: false });
    Draw.beam(g, [[kx, ky], [hx, hy]], 6, PAL.grayL, { ol: 1.3, hi: false });
    Draw.beam(g, [[bx - 30, by + 2], [kx + 4, ky + 10]], 3, PAL.gray, { ol: 1, hi: false });
    Draw.circle(g, kx, ky, 5, PAL.steelD, { ol: 1.2, hi: false, shade: false });
    Draw.box(g, hx - 40, hy - 3, 76, 7, PAL.steelD, { ol: 1.3, top: PAL.steel, shade: false });
    g.strokeStyle = LINE; g.lineWidth = 4; g.beginPath(); g.moveTo(hx - 40, hy); g.quadraticCurveTo(hx - 54, hy, hx - 56, hy + 12); g.moveTo(hx + 36, hy); g.quadraticCurveTo(hx + 50, hy, hx + 52, hy + 12); g.stroke();
    g.strokeStyle = PAL.steelD; g.lineWidth = 2; g.stroke();
    return [hx, hy];
  }
  function carLive(g, m, i) {
    const kind = KIND[i], t = m.t;
    if (kind === 'lead' || kind === 'tail') {
      const px = kind === 'lead' ? PANTO[0][1] : PANTO[1][1];
      const up = m.mode === 'chegada' && m.tc < CH.lay ? clamp((m.lay - (m.s - FRONT[i] + px) - 40) / 200, 0, 1) : 1;
      const hd = pantograph(g, m, px, up);
      if (m.sparkA > 0 && up > 0.98) {
        g.globalCompositeOperation = 'lighter';
        Draw.light(g, hd[0] + (Math.random() - 0.5) * 30, hd[1] - 2, 6 + 8 * m.sparkA, '#BFE6FF', m.sparkA, { ol: 0, halo: 4 });
        g.globalCompositeOperation = 'source-over';
      }
      if (kind === 'lead') {
        g.save(); canopyPath(g); g.clip();
        // cabine acesa: luz quente de painel (lê-se até em 0.2) e o Kome grande de quepe
        g.fillStyle = m.night > 0.3 ? '#FFD98A' : '#F6C77A'; g.fillRect(-312, -240, 180, 110);
        g.fillStyle = '#FFE9B8'; g.beginPath(); g.ellipse(-214, -176, 70, 30, -0.3, 0, TAU); g.fill();
        g.fillStyle = '#C98F4A'; g.fillRect(-312, -150, 180, 20);
        const pose = 'drive';
        KOME_O.pal = m.pilot; KOME_O.scale = KOME_SC;
        E.drawShiba(g, KOME_FEET[0], KOME_FEET[1], pose, t, KOME_O);
        const ft = E.drawShiba.frameT ? E.drawShiba.frameT(t) : t;
        const hd2 = E.shibaAnchor(pose, ft, 'head', TMP, { hat: false });
        capS(g, KOME_FEET[0] + hd2.x * KOME_SC, KOME_FEET[1] + hd2.y * KOME_SC - 2, KOME_SC * 1.15, 1, C_GOLD);
        // painel: botões e alavanca
        g.fillStyle = LINE; g.fillRect(-176, -166, 30, 14); g.fillStyle = '#2F3E4C'; g.fillRect(-174, -164, 26, 10);
        g.fillStyle = (t * 2 | 0) & 1 ? '#7FE08A' : '#3E7A48'; g.fillRect(-170, -162, 5, 4); g.fillStyle = PAL.red; g.fillRect(-162, -162, 5, 4);
        g.fillStyle = 'rgba(255,255,255,.30)'; g.beginPath(); g.moveTo(-196, -240); g.lineTo(-172, -240); g.lineTo(-206, -150); g.lineTo(-230, -150); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(-262, -240); g.lineTo(-250, -240); g.lineTo(-284, -150); g.lineTo(-296, -150); g.closePath(); g.fill();
        g.restore();
        // brilho da cabine pra fora (halo quente)
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.05 + 0.3 * m.night; g.fillStyle = '#FFC860';
        g.beginPath(); g.ellipse(-222, -194, 100, 42, -0.3, 0, TAU); g.fill(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        if (m.night > 0.05) Draw.light(g, -96, -126, 10, '#FFF3C4', m.night, { ol: 0, halo: 5 });
      } else if (m.night > 0.05) Draw.light(g, -LEAD + 40, -64, 5, PAL.red, m.night, { ol: 0, halo: 4 });
      return;
    }
    if (kind === 'A') {
      // nível na escotilha-boca
      if (m.fill > 0.01) {
        g.save(); g.beginPath(); g.arc(HX, -342, 12.5, 0, TAU); g.clip();
        const top = -342 + 12.5 - m.fill * 25;
        g.fillStyle = PAL.rice; g.fillRect(HX - 13, top, 26, 30);
        g.fillStyle = PAL.riceS; g.fillRect(HX - 13, top + 6, 26, 30);
        g.restore();
      }
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(HX - 6, -350, 3, 8);
      // tampa basculante
      const a = -m.lid * 1.9;
      g.save(); g.translate(HX - 22, HATCH_A - 10); g.rotate(a);
      Draw.box(g, 0, -6, 44, 7, PAL.steelD, { ol: 1.3, top: PAL.steel, shade: false });
      g.restore();
    } else {
      // monte de arroz na tremonha + tampas sanfonadas
      if (m.fill > 0.01) {
        const hgt = m.fill * 56, x0 = -CAR + 18, x1 = -18;
        g.beginPath(); g.moveTo(x0, RIM_B + 2);
        for (let k = 0; k <= 12; k++) { const q = k / 12, x = lerp(x0, x1, q); g.lineTo(x, RIM_B - hgt * Math.pow(Math.sin(q * PI), 0.7) - (k & 1) * 2.5 * m.fill); }
        g.lineTo(x1, RIM_B + 2); g.closePath();
        g.lineWidth = 3; g.strokeStyle = LINE; g.stroke(); g.fillStyle = PAL.rice; g.fill();
        g.fillStyle = PAL.riceS; g.fillRect(x0, RIM_B - 6, x1 - x0, 6);
      }
      const half = (CAR - 28) / 2, w = half * (1 - 0.86 * m.lid);
      Draw.box(g, -CAR + 14, RIM_B - 14, w, 10, PAL.steelD, { ol: 1.3, top: PAL.steel, shade: false, panels: Math.max(1, Math.round(w / 20)) });
      Draw.box(g, -14 - w, RIM_B - 14, w, 10, PAL.steelD, { ol: 1.3, top: PAL.steel, shade: false, panels: Math.max(1, Math.round(w / 20)) });
    }
  }
  function cap(g, hx, hy) {   // quepe de maquinista (azul-marinho, faixa dourada, pala preta)
    g.fillStyle = LINE; g.beginPath(); g.moveTo(hx - 10, hy - 6); g.lineTo(hx - 11, hy - 15); g.quadraticCurveTo(hx, hy - 21, hx + 11, hy - 15); g.lineTo(hx + 10, hy - 6); g.closePath(); g.fill();
    g.fillStyle = '#2E3E66'; g.beginPath(); g.moveTo(hx - 8.6, hy - 7); g.lineTo(hx - 9.6, hy - 14.6); g.quadraticCurveTo(hx, hy - 19.6, hx + 9.6, hy - 14.6); g.lineTo(hx + 8.6, hy - 7); g.closePath(); g.fill();
    g.fillStyle = '#44588A'; g.fillRect(hx - 8, hy - 16, 9, 2);
    g.fillStyle = C_GOLD; g.fillRect(hx - 8.8, hy - 10, 17.6, 2.6);
    g.fillStyle = PAL.goldL; g.beginPath(); g.arc(hx + 2, hy - 13.5, 2, 0, TAU); g.fill();
    g.fillStyle = LINE; g.beginPath(); g.moveTo(hx + 4, hy - 7.5); g.lineTo(hx + 14, hy - 6); g.lineTo(hx + 13, hy - 4); g.lineTo(hx + 3, hy - 5); g.closePath(); g.fill();
  }

  // capS: quepe escalado (s = escala do shiba) virado pra `face`, com faixa colorida
  function capS(g, hx, hy, s, face, band) {
    g.save(); g.translate(hx, hy); g.scale(s * face, s);
    g.fillStyle = LINE; g.beginPath(); g.moveTo(-6.5, -4); g.lineTo(-7.5, -10); g.quadraticCurveTo(0, -14.5, 7.5, -10); g.lineTo(6.5, -4); g.closePath(); g.fill();
    g.fillStyle = '#2E3E66'; g.beginPath(); g.moveTo(-5.4, -4.8); g.lineTo(-6.3, -9.7); g.quadraticCurveTo(0, -13.2, 6.3, -9.7); g.lineTo(5.4, -4.8); g.closePath(); g.fill();
    g.fillStyle = '#44588A'; g.fillRect(-5, -11, 6, 1.4);
    g.fillStyle = band || C_GOLD; g.fillRect(-5.8, -7, 11.6, 2.2);
    g.fillStyle = PAL.goldL; g.fillRect(0.6, -10.2, 2.2, 2.2);
    g.fillStyle = LINE; g.beginPath(); g.moveTo(2.5, -5); g.lineTo(10, -4); g.lineTo(9.4, -2.4); g.lineTo(2, -3.2); g.closePath(); g.fill();
    g.restore();
  }
  // patinha segurando o chapéu/quepe (contorno + pelo + dedinhos)
  function pawOn(g, x, y, s, pal) {
    const r = 4.2 * s;
    g.fillStyle = LINE; g.beginPath(); g.arc(x, y, r + s, 0, TAU); g.fill();
    g.fillStyle = pal.o; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = pal.c; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.45, 0, TAU); g.fill();
    g.fillStyle = LINE; g.fillRect(x - r * 0.5, y + r * 0.2, s * 0.8, r * 0.6); g.fillRect(x + r * 0.15, y + r * 0.2, s * 0.8, r * 0.6);
  }
  // bandeira do chefe: verde enchendo, vermelha erguida no apito, tremulando forte no vento da partida
  function flag(g, ax, ay, face, s, m, u, windy) {
    const red = (u > T_WHISTLE - 0.2 && u < T_DEP + 0.2) || windy;
    const up = red ? 1 : 0, L = 36 * s, px = ax + face * (2 + up * 2) * s, top = ay - L * (0.7 + 0.3 * up);
    Draw.beam(g, [[ax, ay + 4 * s], [px, top]], 1.6 * s, PAL.wood, { ol: 1, hi: false });
    const fw = 22 * s, fh = 14 * s, t = m.t, amp = (windy ? 3.2 : red ? 1.8 : 0.8) * s, sp = windy ? 22 : 7;
    const pts = [];
    for (let i = 0; i <= 6; i++) { const q = i / 6; pts.push([px + face * q * fw, top + Math.sin(t * sp - q * 5) * amp * q]); }
    for (let i = 6; i >= 0; i--) { const q = i / 6; pts.push([px + face * q * fw, top + fh + Math.sin(t * sp - q * 5 + 0.6) * amp * q]); }
    Draw.poly(g, pts, red ? PAL.red : '#4FA36A', { ol: 1.4, shade: false, hi: false });
    g.fillStyle = red ? PAL.redL : '#7FC98F'; g.fillRect(Math.min(px, px + face * fw * 0.5), top + 1.5 * s, fw * 0.5, 2 * s);
  }

  function drawChutes(g, m, li) {
    const t = m.t, flow = m.load && m.ext > 0.9;
    for (const c of m.ch) {
      if (!c.has) {
        const top = towerHead(g, m, c);
        if (m.ext > 0.02 && Math.abs(m.s) < 2) {
          const ly = lerp(top[1], c.hy - 26, m.ext);
          Draw.beam(g, [[top[0], top[1]], [top[0], ly]], 20, PAL.steel, { ol: 1.4, hi: false });
          if (flow) stream(g, top[0], ly, c.hy - 2, t);
        }
        continue;
      }
      const ix = c.ix, iy = c.iy - 50, hx = c.hx, hy = c.hy - 34;
      const k = lerp(0.3, 1, m.ext), lx = lerp(ix, hx, k), ly = lerp(iy, hy, k);
      // tomada na encosta (capô com rosca girando)
      const bob = flow ? Math.sin(t * 9 + c.car) * 2 : 0;
      Draw.poly(g, [[c.ix - 70, c.iy + 10 + bob], [c.ix + 70, c.iy + 10 + bob], [c.ix + 24, iy + bob], [c.ix - 24, iy + bob]], PAL.ora, { ol: 2, shade: PAL.oraD, hi: PAL.oraL });
      g.fillStyle = PAL.blk; g.fillRect(c.ix - 62, c.iy + 1 + bob, 124, 9);
      if (Draw.zoom > 0.25) { g.fillStyle = PAL.steel; const ph = (t * (flow ? 3 : 0.3)) % 1; for (let j = 0; j < 5; j++) g.fillRect(c.ix - 60 + ((j + ph) % 5) * 24, c.iy + 3 + bob, 8, 5); }
      // calha telescópica
      const mx = lerp(ix, lx, 0.5), my = lerp(iy, ly, 0.5);
      Draw.beam(g, [[ix, iy + bob], [mx, my]], 46, PAL.yel, { ol: 2, hi: PAL.yelL, shade: PAL.yelD, cap: 'butt' });
      Draw.beam(g, [[mx, my], [lx, ly]], 36, PAL.grayL, { ol: 1.8, hi: PAL.steelL, shade: PAL.gray, cap: 'butt' });
      Draw.circle(g, mx, my, 25, PAL.yel, { ol: 1.6, hi: false, shade: PAL.yelD });
      if (flow) {
        // arroz escorrendo pela calha
        g.strokeStyle = LINE; g.lineWidth = 20; g.beginPath(); g.moveTo(ix, iy + bob); g.lineTo(lx, ly); g.stroke();
        g.strokeStyle = PAL.rice; g.lineWidth = 16; g.stroke();
        const L = Math.hypot(lx - ix, ly - iy), n = Math.max(3, Math.min(22, (L / 36) | 0)), ph = (t * 2.2 + c.car * 0.37) % 1;
        g.fillStyle = PAL.riceS;
        for (let j = 0; j < n; j++) { const q = (j + ph) / n; g.fillRect(lerp(ix, lx, q) - 3, lerp(iy, ly, q) - 3, 7, 5); }
        stream(g, lx, ly, c.hy - 2, t + c.car);
      }
      // bico
      Draw.box(g, lx - 22, ly - 8, 44, 20, PAL.grayD, { ol: 1.6, top: PAL.gray, shade: false });
    }
  }
  function stream(g, x, y0, y1, t) {
    if (y1 <= y0) return;
    g.fillStyle = LINE; g.fillRect(x - 13, y0, 26, y1 - y0);
    g.fillStyle = PAL.rice; g.fillRect(x - 10.5, y0, 21, y1 - y0);
    g.fillStyle = PAL.riceS; const ph = (t * 90) % 12; for (let y = y0 + ph; y < y1 - 2; y += 12) g.fillRect(x - 4 + ((y | 0) % 3), y, 3, 4);
  }

  function drawSpeedStreaks(g, m, v) {
    const f = m.face, sb = m.t - m.boomT;
    const fastRet = m.phase === 'voltando' && Math.abs(m.v) > 2500, acc = m.phase === 'partindo' && m.v > 500;
    if (!(sb < 1.2) && !fastRet && !acc) return;
    const k = Math.max(sb < 1.2 ? 1 - sb / 1.2 : 0, clamp(Math.abs(m.v) / 11000, 0, 1));
    // vento colado no trem: linhas brancas que nascem no nariz e escorrem pra trás (com a câmera indo junto, é aqui que se sente)
    if (acc) {
      const nose = carX(m, 0), tail = nose - f * TRAIN, vk = clamp(m.v / 9000, 0.15, 1);
      g.fillStyle = '#FFFFFF';
      for (let i = 0; i < 22; i++) {
        const ph = (m.t * (1.4 + vk * 2.2) + rnd(i * 4.3)) % 1, len = (300 + rnd(i * 2.9) * 700) * (0.5 + vk);
        const x = nose - f * ph * (TRAIN + 1200), y = m.y - 40 - rnd(i * 6.1) * 520;
        g.globalAlpha = 0.65 * vk * Math.sin(ph * PI); g.fillRect(Math.min(x, x + f * len), y, len, 3 + rnd(i) * 5);
      }
      g.globalAlpha = 1;
    }
    g.fillStyle = '#FFFFFF';
    for (let i = 0; i < 18; i++) {
      const y = m.y - 20 - rnd(i * 3.1) * 460, len = 400 + rnd(i * 7.7) * 900;
      const span = v.x1 - v.x0, x = v.x0 + ((rnd(i * 1.9) * span + (m.t * 9000 * f)) % span + span) % span;
      g.globalAlpha = 0.5 * k; g.fillRect(x - len / 2, y, len, 3 + rnd(i) * 4);
    }
    g.globalAlpha = 1;
  }

  function drawStation(g, m, li, v) {
    const f = m.face, pb = platBake(f, li), x = m.x, y = m.y;
    if (x + pb.x0 + pb.w < v.x0 || x + pb.x0 > v.x1) return;
    // equipe (atrás da beira da plataforma)
    const t = m.t, sb = t - m.boomT, u = m.mode === 'normal' ? ((m.ct % T_CYC) + T_CYC) % T_CYC : -1;
    const dep = m.phase === 'partindo', windK = dep ? clamp(Math.abs(m.v) / 5000, 0.25, 1) : 0;
    for (let k = 0; k < CREW.length; k++) {
      const c = CREW[k], h = m.hats[k], cx = x - f * c.dx, sc = c.sc || CREW_SC, tk = t + k * 0.37;
      if (cx < v.x0 - 120 || cx > v.x1 + 120) continue;
      let pose = 'stand', face = k & 1 ? -f : f, rot = 0, holding = false;
      const lost = h.st !== 0;
      if (c.role === 'chefe') {
        // chefe da estação: de frente pro trem, bandeira verde enquanto enche, vermelha no apito, acena na partida
        face = -f;
        if (m.mode === 'chegada') pose = m.tc < CH.glide ? 'stand' : m.tc < CH.ribbon + 0.1 ? 'point' : 'cheer';
        else if (dep || (sb >= 0 && sb < 2.4)) { pose = 'stand'; holding = true; rot = -0.1 * f * windK; }
        else pose = u > T_FULL && u < T_DEP ? 'point' : 'stand';
        if (m.mode === 'chegada' && m.tc < CH.glide) face = f;
      } else if (dep && sb < 0) { pose = 'stand'; face = -f; holding = !lost; rot = -0.08 * f * windK; }
      else if (sb >= 0 && sb < 1.8) { if (c.hold) { pose = 'gasp'; holding = true; rot = -0.16 * f; } else pose = 'surprise'; face = -f; }
      else if (sb >= 1.8 && sb < 4.4 && m.phase === 'fora') pose = c.hold ? 'proud' : k & 1 ? 'dizzy' : 'gasp';
      else if (m.phase === 'voltando') { pose = Math.abs(m.v) > 3000 ? 'surprise' : 'gasp'; face = -f; }
      else if (m.mode === 'chegada') { pose = m.tc < CH.glide ? 'cheer' : m.tc < CH.ribbon + 0.1 ? 'stand' : 'cheer'; face = -f; }
      else if (c.role === 'bento') pose = 'sit';
      else pose = m.phase === 'carregando' ? (k % 3 === 1 ? 'wag' : 'sit') : m.phase === 'fechando' ? 'wave' : 'cheer';
      CREW_O.pal = P_CREW[c.pal]; CREW_O.face = face; CREW_O.scale = sc; CREW_O.rot = rot;
      CREW_O.hat = c.role === 'chefe' ? false : !lost;
      E.drawShiba(g, cx, y + PLAT_Y, pose, tk, CREW_O);
      const ft = E.drawShiba.frameT ? E.drawShiba.frameT(tk) : tk;
      if (c.role === 'chefe') {
        const hd = E.shibaAnchor(pose, ft, 'head', TMP, { hat: false });
        const hx = cx + hd.x * face * sc, hy = y + PLAT_Y + hd.y * sc;
        capS(g, hx, hy, sc * 1.05, face, PAL.red);
        if (holding) pawOn(g, hx - face * 2 * sc, hy - 16 * sc, sc, P_CREW[c.pal]);
        const pa = E.shibaAnchor(pose, ft, 'paw', TMP);
        const ax = cx + pa.x * face * sc, ay = y + PLAT_Y + pa.y * sc;
        if (m.mode === 'chegada' && m.tc < CH.ribbon + 0.6) scissors(g, ax, ay, face, m.tc);
        else flag(g, ax, ay, face, sc, m, u, dep || (sb >= 0 && sb < 2.4));
      } else if (holding) {
        const ht = E.shibaAnchor(pose, ft, 'hatTop', TMP);
        pawOn(g, cx + ht.x * face * sc, y + PLAT_Y + ht.y * sc + 2 * sc, sc, P_CREW[c.pal]);
      }
      // vento da partida: risquinhos passando pelo povo
      if (windK > 0.3 && dep) {
        g.fillStyle = '#FFFFFF'; g.globalAlpha = 0.6 * windK;
        for (let j = 0; j < 3; j++) { const ph = ((t * 2.6 + j * 0.33 + k * 0.17) % 1), wx = cx + f * (ph - 0.5) * 220, wy = y + PLAT_Y - (14 + j * 22 + rnd(k * 3 + j) * 10) * sc / 2; g.fillRect(wx - 34, wy, 68 * (1 - Math.abs(ph - 0.5)), 4); }
        g.globalAlpha = 1;
      }
    }
    CREW_O.rot = 0;
    g.drawImage(pb.cv, x + pb.x0, y + pb.y0, pb.w, pb.h);
    // painel de horários (texto ao vivo)
    const bx = x - f * BOARD_DX, bw = 270, txt = boardText(m, u);
    Draw.box(g, bx - bw / 2, y - 212, bw, 46, '#1F2630', { ol: 1.8, r: 5, top: '#2C3542', shade: '#151A21' });
    Draw.text(g, txt[0], bx, y - 199, { size: 13, col: PAL.goldL, sw: 0, weight: 900 });
    Draw.text(g, txt[1], bx, y - 181, { size: 12, col: txt[2] ? '#7FE08A' : '#FF9E6B', sw: 0, weight: 800 });
    // fita da inauguração
    if (m.mode === 'chegada') ribbon(g, m);
    // chapéus voando / caídos
    for (let k = 0; k < m.hats.length; k++) {
      const h = m.hats[k]; if (h.st !== 1 && h.st !== 2) continue;
      if (h.x < v.x0 - 40 || h.x > v.x1 + 40) continue;
      g.save(); g.translate(h.x, h.y); g.rotate(h.r); g.scale(CREW_SC, CREW_SC);
      g.fillStyle = LINE; g.beginPath(); g.moveTo(-12, 2); g.lineTo(0, -10); g.lineTo(12, 2); g.closePath(); g.fill();
      g.fillStyle = STRAW; g.beginPath(); g.moveTo(-9.5, 0.6); g.lineTo(0, -7.6); g.lineTo(9.5, 0.6); g.closePath(); g.fill();
      g.fillStyle = STRAWD; g.fillRect(-9.5, -0.6, 19, 1.6);
      g.restore();
    }
    // confete
    for (const p of m.conf) {
      if (p.x < v.x0 || p.x > v.x1) continue;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-4, -2.5, 8, 5 * Math.abs(Math.cos(p.r * 1.7)) + 1); g.restore();
    }
  }
  function boardText(m, u) {
    const pct = Math.round(m.fill * 100);
    if (m.mode === 'chegada') return m.tc < CH.ribbon ? ['INAUGURAÇÃO HOJE', 'TREM-BALA DE ARROZ', true] : ['PRÓXIMO: VOLTA AO JAPÃO', 'PARTIDA IMEDIATA', true];
    if (m.phase === 'carregando' || m.phase === 'abrindo') return ['CARREGANDO ARROZ', pct + '% · 8 vagões', true];
    if (m.phase === 'fechando') return ['PORTAS FECHANDO', 'SEGURA O CHAPÉU', false];
    if (m.phase === 'partindo') return ['PARTINDO', 'VOLTA AO JAPÃO', false];
    if (m.phase === 'fora') { const dt = Math.max(0, u - T_DEP - 1.6); return ['DANDO A VOLTA NO JAPÃO', dt.toFixed(1).replace('.', ',') + ' s', true]; }
    return ['VOLTA: ' + m.lap.toFixed(1).replace('.', ',') + ' s', m.record ? 'RECORDE PESSOAL!' : 'NO HORÁRIO', true];
  }
  function ribbon(g, m) {
    const f = m.face, y = m.y - 118, xa = m.x + f * 70, xb = m.x + f * 330, tc = m.tc;
    for (const x of [xa, xb]) { Draw.box(g, x - 5, y - 10, 10, 128 + PLAT_Y + 30 - 20, PAL.gold, { ol: 1.3, top: PAL.goldL, shade: PAL.goldD }); Draw.circle(g, x, y - 12, 7, PAL.goldL, { ol: 1.2, hi: false }); }
    const cut = tc >= CH.ribbon, mid = (xa + xb) / 2;
    g.lineCap = 'round';
    if (!cut) {
      Draw.beam(g, [[xa, y], [mid, y + 10], [xb, y]], 9, C_RED, { ol: 1.4, hi: PAL.redL, shade: false });
      // laço
      Draw.poly(g, [[mid, y + 10], [mid - 26, y - 6], [mid - 28, y + 22]], C_RED, { ol: 1.4 });
      Draw.poly(g, [[mid, y + 10], [mid + 26, y - 6], [mid + 28, y + 22]], C_RED, { ol: 1.4 });
      Draw.circle(g, mid, y + 10, 7, PAL.redL, { ol: 1.4, hi: false });
    } else {
      const k = smooth((tc - CH.ribbon) / 0.7), L = (xb - xa) / 2;
      for (const [x0, s] of [[xa, 1], [xb, -1]]) {
        const ang = lerp(0.08, 1.35, k) * (s * f > 0 ? 1 : -1);
        const ex = x0 + Math.cos(ang) * L * s * (s * f > 0 ? 1 : 1) * f * s, ey = y + Math.sin(Math.abs(ang)) * L;
        Draw.beam(g, [[x0, y], [lerp(x0, ex, 0.35), lerp(y, ey, 0.35) + 14 * (1 - k) + 5 * Math.sin(tc * 9 + s)], [lerp(x0, ex, 0.7), lerp(y, ey, 0.7) + 10 * (1 - k)], [ex + 4 * Math.sin(tc * 7 + s), ey]], 9, C_RED, { ol: 1.4, hi: PAL.redL, shade: false });
      }
    }
  }
  function scissors(g, x, y, face, tc) {
    const open = tc < CH.ribbon - 0.5 ? 0.5 + 0.12 * Math.sin(tc * 6) : tc < CH.ribbon ? lerp(0.6, 0, smooth((tc - (CH.ribbon - 0.5)) / 0.5)) : 0.05;
    g.save(); g.translate(x, y - 4); g.scale(face, 1); g.rotate(-0.35);
    for (const s of [-1, 1]) {
      g.save(); g.rotate(s * open * 0.5);
      Draw.poly(g, [[0, -6 * s], [110, -2 * s], [114, 0], [0, 5 * s]], PAL.steelL, { ol: 1.6, hi: '#FFFFFF' });
      Draw.ring(g, -18, s * 14, 15, 7, s > 0 ? C_RED : PAL.redD, { ol: 1.4, hi: false });
      g.restore();
    }
    Draw.circle(g, 0, 0, 4.5, PAL.gold, { ol: 1.2, hi: false, shade: false });
    g.restore();
  }

  function drawFx(g, m, v) {
    const f = m.face, sb = m.t - m.boomT, y = m.y;
    // estrondo sônico: nuvem de vapor ao longo do trem, anel de choque, BUUUM (centrado na estação, que é onde a câmera está)
    if (sb >= 0 && sb < 1.6) {
      const bx = m.boomX;
      if (sb < 0.9) {
        const k = 1 - sb / 0.9;
        g.fillStyle = '#FFFFFF';
        for (let i = 0; i < 16; i++) {
          const q = i / 15, px = bx + f * lerp(-2100, 2300, q) + f * sb * 1400 * q, py = y - 70 - rnd(i * 2.3) * 260, r = (110 + rnd(i * 5.1) * 120) * (1 + sb * 1.6);
          g.globalAlpha = 0.8 * k * (0.5 + 0.5 * q); g.beginPath(); g.ellipse(px, py, r * 1.6, r * 0.7, 0, 0, TAU); g.fill();
        }
      }
      for (let r = 0; r < 2; r++) {
        const q = (sb - r * 0.15) / 0.95; if (q < 0 || q > 1) continue;
        const R = 260 + q * 3200;
        g.globalAlpha = 0.8 * (1 - q); g.strokeStyle = '#FFFFFF'; g.lineWidth = 46 * (1 - q) + 6;
        g.beginPath(); g.ellipse(bx + f * 900, y - 260, R, R * 0.6, 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
      if (sb < 1.45) {
        const k = sb < 0.16 ? sb / 0.16 : 1, pop = sb < 0.16 ? 0.4 + 0.95 * k : 1.35 - 0.3 * smooth((sb - 0.16) / 0.3), al = sb > 1.05 ? 1 - (sb - 1.05) / 0.4 : 1;
        g.save(); g.translate(bx + f * Math.max(0, m.s - S_BOOM) * 0.55, y - 800 - sb * 40); g.rotate(-0.07 * f); g.scale(pop, pop);
        Draw.text(g, 'BUUUM!', 0, 0, { size: 230, col: PAL.goldL, sw: 24, stroke: LINE, weight: 900, alpha: al, shadow: 12 });
        g.restore();
      }
    }
    // buzina impaciente atrás dos shibas da obra
    if (m.mode === 'chegada') {
      const tc = m.tc;
      for (const ht of [1.2, 2.4]) {
        const q = tc - ht; if (q < 0 || q > 0.7) continue;
        const nx = m.x + f * (m.s + 60), s = 1 + 0.25 * Math.sin(q * 30) * (1 - q / 0.7);
        g.save(); g.translate(nx, y - 380); g.scale(s, s);
        Draw.text(g, ht < 2 ? 'FOM FOM!' : 'ANDA, GENTE!', 0, 0, { size: 54, col: PAL.cream, sw: 9, weight: 900, alpha: 1 - Math.max(0, q - 0.5) / 0.2 });
        g.restore();
      }
      if (tc < CH.lay + 0.3) workers(g, m, tc);
      if (m.title > 0) {
        const k = m.title, pop = k < 0.12 ? 0.3 + 0.8 * smooth(k / 0.12) : k > 0.85 ? 1 - smooth((k - 0.85) / 0.15) * 0.2 : 1.1 - 0.1 * smooth((k - 0.12) / 0.2), al = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
        g.save(); g.translate(m.x + f * 60, y - 560); g.scale(pop, pop);
        Draw.text(g, 'TREM-BALA DE ARROZ', 0, 0, { size: 104, col: PAL.goldL, sw: 16, stroke: LINE, weight: 900, alpha: al, shadow: 8 });
        Draw.text(g, 'inaugurado · dá a volta no Japão em 5 s', 0, 92, { size: 40, col: PAL.cream, sw: 8, stroke: LINE, weight: 800, alpha: al });
        g.restore();
      }
    }
  }
  // shibas assentando o trilho na frente do trem (cena de estreia)
  const WORK_O = { scale: 1, face: 1, pal: null, hat: true, shadow: true };
  function workers(g, m, tc) {
    const f = m.face, F = m.x + f * m.lay, y = m.y, t = m.t;
    // dormentes e trilhos soltos à frente
    for (let k = 0; k < 4; k++) { const x = F + f * (40 + k * 36); Draw.box(g, x - 11, y - 12, 22, 8, PAL.stoneL, { ol: 1.2, top: false }); }
    const W = [[-30, 'dig', 0], [70, 'carry', 1], [150, 'push', 2], [-120, 'carry', 3]];
    for (let k = 0; k < W.length; k++) {
      const [dx, pose, p] = W[k], x = F + f * dx;
      WORK_O.pal = P_CREW[p]; WORK_O.face = pose === 'dig' ? f : f;
      E.drawShiba(g, x, y - 14, pose, t * 1.4 + k, WORK_O);
      if (pose === 'carry') Draw.box(g, x - 40, y - 52, 80, 6, PAL.steel, { ol: 1.2, top: PAL.steelL, shade: false });
      if (pose === 'dig' && Math.sin(t * 14) > 0.6 && m.parts) m.parts.sparks(x + f * 14, y - 14, 1, { c: [PAL.goldL, '#FFFFFF'], speed: [60, 160], dir: -PI / 2, spread: 1 });
    }
  }

  /* ======================================================================
     âncoras e ajudantes
     ====================================================================== */
  function bite(m) { return m.biteO; }
  function bites(m) { return m.bitesA; }
  function dump(m) { return m.dumpO; }
  function seat(m) { return m.seatO; }
  // dig(m, heap, area, o): aplica a mordida de todas as calhas ativas (area total no quadro) -> soma de got
  function dig(m, heap, area, o) {
    let n = 0; for (const b of m.bitesA) if (b.active) n++;
    if (!n || !heap) return 0;
    let got = 0;
    for (const b of m.bitesA) if (b.active) { const r = heap.dig(b.x, area / n, b.r, o); got += r.got || 0; }
    return got;
  }
  function prebake(lv) {
    const keep = forceLv; forceLv = lv === undefined ? 0 : lv;
    const li = level();
    for (const f of [1, -1]) { for (let i = 0; i < NCAR; i++) carBake(i, f, li); platBake(f, li); }
    trackBake(li); poleBake(li);
    forceLv = keep;
  }

  /* ======================================================================
     horizonte do Pátio: o trem pequenininho fazendo o ciclo inteiro num viaduto lá longe
     horizon(g, {x0, x1, y (base), k=0.12, t, n=1, tint='#93A3B4', haze=0.7, night=0})
     n >= 10: 2 viadutos; n >= 25: 3 (e com 50+ os trens andam em comboio, 2 por viaduto).
     ====================================================================== */
  const SIL = new Map();
  function silImg(face, tint, haze, k) {
    const key = face + '|' + tint + '|' + haze + '|' + k; let o = SIL.get(key);
    if (o) return o;
    const s = 2, w = TRAIN * k + 20, h = 500 * k + 10, cv = document.createElement('canvas');
    cv.width = Math.ceil(w * s); cv.height = Math.ceil(h * s);
    const c = cv.getContext('2d');
    c.scale(s * k, s * k); c.translate(face > 0 ? TRAIN + 10 / k : 10 / k, 490);
    const keep = forceLv; forceLv = 0;
    for (let i = NCAR - 1; i >= 0; i--) { const b = carBake(i, face, 0); c.drawImage(b.cv, -face * FRONT[i] + b.x0, b.y0, b.w, b.h); }
    forceLv = keep;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = haze; c.fillStyle = tint; c.fillRect(0, 0, cv.width, cv.height);
    o = { cv, w, h, ax: face > 0 ? TRAIN * k + 10 : 10, ay: 490 * k }; SIL.set(key, o);
    return o;
  }
  const HP = {};
  // horizonte calmo: no máximo 2 viadutos (n ≥ 10), sem catenária no de trás; n ≥ 50 põe um 2º trem no da frente.
  // À noite: postes de luz no viaduto, janelinhas acesas e farol.
  function horizon(g, o) {
    const k = o.k || 0.12, t = o.t || 0, n = Math.max(1, o.n | 0), tint = o.tint || '#93A3B4', haze = o.haze === undefined ? 0.7 : o.haze, night = o.night || 0;
    const lanes = n >= 10 ? 2 : 1;
    for (let L = lanes - 1; L >= 0; L--) {
      const kk = k * (1 - L * 0.3), y = o.y - L * 30 * (k / 0.12), hz = Math.min(0.92, haze + L * 0.1), face = L & 1 ? -1 : 1;
      const x0 = o.x0 + L * 90, x1 = o.x1 - L * 70, dock = face > 0 ? lerp(x0, x1, 0.72) : lerp(x0, x1, 0.3);
      const sk = kk / 0.12, deck = U.mixCss(tint, '#FFFFFF', L ? 0.32 : 0.2);
      // viaduto: tabuleiro + pilares espaçados (sem triângulos)
      g.fillStyle = deck;
      g.fillRect(x0, y - 3 * sk, x1 - x0, 6 * sk);
      for (let x = x0 + 80; x < x1 - 40; x += 420 * sk) g.fillRect(x - 3 * sk, y, 6 * sk, 60);
      if (!L) {
        g.globalAlpha = 0.4;
        for (let x = x0 + 60; x < x1; x += POLE * 3 * kk) g.fillRect(x, y + WIRE * kk, 1, -WIRE * kk);
        g.fillRect(x0, y + WIRE * kk, x1 - x0, 1);
        g.globalAlpha = 1;
      }
      // bocas de túnel nas pontas (o trem some numa e volta pela outra)
      for (const [x, s] of [[x0, 1], [x1, -1]]) { g.fillStyle = U.mixCss(tint, '#3B2818', 0.2); g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x, y - 300 * kk); g.quadraticCurveTo(x + s * 120 * kk, y - 330 * kk, x + s * 160 * kk, y + 4); g.closePath(); g.fill(); g.fillStyle = U.mixCss(tint, '#1A1A22', 0.5); g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x, y - 250 * kk); g.quadraticCurveTo(x + s * 70 * kk, y - 260 * kk, x + s * 90 * kk, y + 2); g.closePath(); g.fill(); }
      // luzes da noite: postes no viaduto (pontinhos quentes com halo) e lampião nas bocas
      if (night > 0.2) {
        g.globalAlpha = night * (L ? 0.6 : 0.9);
        for (let x = x0 + 150 * sk; x < x1 - 60; x += 420 * sk) { g.fillStyle = 'rgba(255,214,140,.25)'; g.beginPath(); g.arc(x, y - 22 * sk, 7 * sk, 0, TAU); g.fill(); g.fillStyle = '#FFE3A0'; g.fillRect(x - 1.2 * sk, y - 24 * sk, 2.4 * sk, 2.4 * sk); g.fillStyle = deck; g.fillRect(x - 0.5 * sk, y - 22 * sk, 1 * sk, 19 * sk); }
        g.fillStyle = '#FFC86A'; for (const [x, s] of [[x0, 1], [x1, -1]]) g.fillRect(x + s * 96 * kk - 1.5, y - 270 * kk, 3, 3);
        g.globalAlpha = 1;
      }
      const trains = n >= 50 && !L ? 2 : 1;
      g.save(); g.beginPath(); g.rect(x0 + 60 * kk, y - 520 * kk, x1 - x0 - 120 * kk, 560 * kk); g.clip();
      for (let j = 0; j < trains; j++) {
        const P = profile('normal', t + L * 6.7 + j * 10, HP), img = silImg(face, tint, hz, Math.round(kk * 1000) / 1000);
        if (Math.abs(P.s) > 20000) continue;
        const nx = dock + face * P.s * kk;
        if (Math.abs(P.s) > 1) { g.globalAlpha = 0.3; g.drawImage(img.cv, nx - img.ax - face * 30 * clamp(Math.abs(P.s) / 3000, 0, 1), y - img.ay, img.w, img.h); g.globalAlpha = 1; }
        g.drawImage(img.cv, nx - img.ax, y - img.ay, img.w, img.h);
        if (night > 0.2) {
          g.fillStyle = '#FFE3A0'; g.globalAlpha = night * (L ? 0.7 : 1);
          for (let q = 0; q < 16; q++) g.fillRect(nx - face * (q * TRAIN / 16 + 90) * kk, y - 170 * kk, Math.max(1.5, 60 * kk), Math.max(1.2, 22 * kk));
          g.fillStyle = 'rgba(255,240,190,.35)'; g.beginPath(); g.moveTo(nx, y - 120 * kk); g.lineTo(nx + face * 420 * kk, y - 190 * kk); g.lineTo(nx + face * 420 * kk, y - 40 * kk); g.closePath(); g.fill();
          g.globalAlpha = 1;
        }
        if (P.load && !L) { g.fillStyle = U.mixCss(PAL.rice, tint, 0.45); g.globalAlpha = 0.7; for (let q = 0; q < 8; q++) { const cx = nx - face * (FRONT[q + 1] - HX) * kk; g.fillRect(cx - 0.75, y - 760 * kk, 1.5, 320 * kk); } g.globalAlpha = 1; }
      }
      g.restore();
      // anel do estrondo (só no da frente)
      const u = (((t + L * 6.7) % T_CYC) + T_CYC) % T_CYC, sb = u - T_BOOM;
      if (!L && sb > 0 && sb < 0.9) { const R = (60 + sb * 900) * kk / 0.12; g.globalAlpha = 0.5 * (1 - sb / 0.9); g.strokeStyle = '#FFFFFF'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(dock + face * 300 * kk, y - 200 * kk, R, R * 0.6, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; }
    }
  }

  /* ======================================================================
     som: E.Sfx/E.Loops sintetizados (sem arquivo). O host chama audio(m, ligado) uma vez por quadro, DEPOIS do update
     (ele lê m.ev). ligado = false (ou E.Audio.muted) cala tudo e solta o loop do trilho.
     ====================================================================== */
  let sndOk = false;
  function defineSounds() {
    if (sndOk || !E.Sfx || !E.Sfx.define) return sndOk;
    sndOk = true;
    // "ding-dong" da estação: dois sinos (Mi5 → Dó5) com cauda longa
    E.Sfx.define('trem-chime', { gate: 1.5, max: 1, peak: 0.42, jit: 0, rev: 0.35, render: D => {
      const b = D.buf(2.2);
      D.modal(b, 659, [1, 2.0, 2.76, 4.07], [0.6, 0.22, 0.12, 0.05], [1.4, 0.9, 0.5, 0.3]);
      D.modal(b, 523, [1, 2.0, 2.76, 4.07], [0.6, 0.22, 0.12, 0.05], [1.6, 1.0, 0.55, 0.3], { at: 0.42 });
      return b;
    } });
    // chiado pneumático (tampas fechando / freio soltando)
    E.Sfx.define('trem-hiss', { gate: 0.4, max: 2, peak: 0.3, jit: 0.4, render: D => {
      const b = D.buf(0.9); D.noise(b, { a: 0.01, s: 0.15, d: 0.65, vol: 0.6, hp: 3200, hp1: 1800 }); D.noise(b, { d: 0.05, vol: 0.3, bp: 900, q: 1.2 }); return b;
    } });
    // apito de partida: duas notas (acorde de buzina de trem), "pwaaa-pwaaa"
    E.Sfx.define('trem-apito', { gate: 0.6, max: 2, peak: 0.45, jit: 0.2, rev: 0.25, render: D => {
      const b = D.buf(1.25);
      for (const [f, at, d] of [[466, 0, 0.42], [554, 0, 0.42], [466, 0.5, 0.65], [587, 0.5, 0.65]]) {
        D.osc(b, { wave: 'saw', f, a: 0.03, s: d * 0.7, d: d * 0.3, vol: 0.22, at, lp: 2400, vib: 0.004, vibHz: 5.5 });
        D.osc(b, { wave: 'sq', f: f * 1.003, a: 0.03, s: d * 0.7, d: d * 0.3, vol: 0.08, at, lp: 1600 });
      }
      D.noise(b, { a: 0.02, s: 0.9, d: 0.3, vol: 0.05, bp: 1800, q: 0.8 });
      return b;
    } });
    // estrondo sônico: estalo duplo (N-wave) + grave longo rolando
    E.Sfx.define('trem-boom', { gate: 1, max: 1, peak: 0.7, jit: 0.15, rev: 0.4, duck: 0.6, render: D => {
      const b = D.buf(2.6);
      D.noise(b, { d: 0.05, vol: 0.9, lp: 5000 }); D.noise(b, { d: 0.06, vol: 0.8, lp: 4000, at: 0.11 });
      D.osc(b, { f: 70, f1: 32, a: 0.004, s: 0.1, d: 1.6, vol: 0.9, punch: 0.4, curve: 2.4 });
      D.osc(b, { f: 48, f1: 28, a: 0.02, s: 0.2, d: 2.1, vol: 0.5, at: 0.11 });
      D.noise(b, { color: 'brown', a: 0.01, s: 0.3, d: 2.0, vol: 0.7, lp: 600, lp1: 120 });
      D.sat(b, 1.6); return b;
    } });
    // chiado do freio: metal agudo com vibrato + ruído de roda
    E.Sfx.define('trem-freio', { gate: 1, max: 1, peak: 0.3, jit: 0.3, render: D => {
      const b = D.buf(2.0);
      D.osc(b, { f: 2350, f1: 1900, a: 0.12, s: 1.1, d: 0.7, vol: 0.32, vib: 0.012, vibHz: 9 });
      D.osc(b, { f: 3120, f1: 2700, a: 0.2, s: 0.9, d: 0.6, vol: 0.14, vib: 0.016, vibHz: 7, at: 0.15 });
      D.noise(b, { a: 0.1, s: 1.2, d: 0.6, vol: 0.18, bp: 2600, q: 2 });
      return b;
    } });
    // engates batendo (clank)
    E.Sfx.define('trem-clank', { gate: 0.3, max: 2, peak: 0.32, jit: 0.6, render: D => {
      const b = D.buf(0.5); D.noise(b, { d: 0.03, vol: 0.5, bp: 1400, q: 1.4 });
      D.modal(b, 420, [1, 2.7, 5.1], [0.5, 0.25, 0.1], [0.25, 0.15, 0.08]); D.modal(b, 380, [1, 2.7], [0.35, 0.15], [0.2, 0.1], { at: 0.09 }); return b;
    } });
    if (E.Loops && E.Loops.define) {
      // batida do trilho: "ta-tak … ta-tak" sobre um ronco; o regime (rate) acelera o loop junto com o trem
      E.Loops.define('trem-trilho', { vol: 0.9, rate: [0.55, 2.2], lp: [900, 5200], gain: [0.35, 1], render: D => {
        const dur = 1.6, n = Math.floor(dur * D.sr), out = E.Loops.bed(D, n, { color: 'brown', vol: 0.22, lp: 380 }), hit = D.buf(0.12);
        for (const at of [0, 0.13, 0.8, 0.93]) {
          hit.fill(0); D.noise(hit, { d: 0.035, vol: 0.55, bp: 1100, q: 1.1 }); D.osc(hit, { f: 160, f1: 90, d: 0.06, vol: 0.5 }); D.modal(hit, 760, [1, 2.4], [0.18, 0.07], [0.05, 0.03]);
          D.wrap(out, hit, at, at % 0.8 ? 0.8 : 1);
        }
        return out;
      } });
    }
    return sndOk;
  }
  const SND = { load: null, full: ['trem-chime'], whistle: ['trem-hiss'], depart: ['trem-apito'], boom: ['trem-boom'], brake: ['trem-freio'],
    clank: ['trem-clank'], horn: ['trem-apito'], arrive: ['trem-hiss'], ribbon: ['trem-chime'] };
  // audio(m, on=true, o={vol}): toca os eventos do quadro e mantém o loop do trilho (m.sndLoop) no regime da velocidade
  function audio(m, on, o) {
    const muted = on === false || (E.Audio && E.Audio.muted);
    if (muted || !defineSounds()) { if (m.sndLoop) { try { m.sndLoop.stop(0.3); } catch (e) { /* */ } m.sndLoop = null; } return; }
    const vol = o && o.vol !== undefined ? o.vol : 1;
    for (const ev of m.ev) {
      const list = SND[ev]; if (!list) continue;
      for (const n of list) { try { E.Sfx.play(n, { vol: vol * (ev === 'clank' ? 0.6 : 1), pitch: ev === 'horn' ? 1.12 : 1 }); } catch (e) { /* sem áudio */ } }
    }
    const sp = Math.abs(m.v), want = sp > 80 && sp < 30000;
    if (want && !m.sndLoop && E.Loops) { try { m.sndLoop = E.Loops.start('trem-trilho', { vol: 0, rate: 0 }); } catch (e) { m.sndLoop = null; } }
    if (m.sndLoop) {
      const r = clamp(sp / 9000, 0, 1.3);
      try { m.sndLoop.set({ vol: want ? vol * (0.25 + 0.5 * Math.min(1, r)) : 0, rate: r }, want ? 0.12 : 0.5); } catch (e) { /* */ }
    }
  }

  G.Tools.trembala = {
    id: 'trembala', name: 'Trem-Bala de Arroz', kind: 'train', w: TRAIN, h: -MESS,
    meta: { zoom: 0.2, shake: 0.6, cycle: T_CYC, length: TRAIN, height: -MESS, wireY: WIRE, railY: RAIL, chutes: 8, cars: NCAR, chegadaT: CH.end, accel: T_ACC,
      platform: [PLAT0, PLAT1], times: { open: T_OPEN, full: T_FULL, depart: T_DEP, boom: T_BOOM, ret: T_RET, cycle: T_CYC } },
    create, update, draw, bite, bites, dump, seat, dig, horizon, prebake, profile, audio, defineSounds,
  };
})();
