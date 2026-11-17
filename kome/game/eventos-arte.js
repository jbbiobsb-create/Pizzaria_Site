/* Kome no Japão — eventos-arte.js
   ARTE e SOM dos 6 EVENTOS DOURADOS + o LIVRO DOS EVENTOS (camada Cookie: docs/design/camada-cookie.md, "Eventos dourados").
   Só desenha e toca som. NÃO sorteia, NÃO conta tempo de jogo, NÃO paga, NÃO salva: isso é do sistema (G.Events, programador).

   LIGAR (programador) — já se pendura sozinho em G.World.layers.front (anda e desenha todo quadro, nada no game.js):
     G.EventArt.spawn(id, wx?, wy?, {life})   nasce a coisa dourada pra tocar, em coords de MUNDO (sem x/y: ponto bom na tela).
                                              Fica `life` s (padrão EA.LIFE = 15) inteirinhos, com anel de tempo honesto. -> gatilho
     G.EventArt.hitTrigger(sx, sy)            toque em coords de TELA lógica (input.x/input.y do game.js) -> gatilho ou null
     G.EventArt.take(gatilho)                 o jogador tocou: estoura o gatilho (depois o sistema chama start)
     G.EventArt.start(id, ctx) -> c           começou. ctx (tudo opcional) = {dur, crew: 'pata', n: 25, onLand(item), onStomp(n, pos),
                                              rollSack() -> 1..7}. Chuva: c.weight = soma dos pesos que vão cair (dividir o prêmio).
     G.EventArt.on(id, left, k)               (opcional, todo quadro) sincroniza o relógio da arte com o do sistema (left = s que
                                              faltam, k = 0..1). Se o evento ainda não começou na arte, começa.
     G.EventArt.tap(sx, sy)                   toque na Chuva/Tempestade -> item pego {kind:'grao'|'oni'|'saco', w, m, sx, sy} ou null
     G.EventArt.pop(sx, sy, txt, big)         número subindo na tela ("+¥ 12 mi") — o sistema chama ao pagar um item
     G.EventArt.end(id, ctx, result)          acabou: festa com o resultado. result = número (¥), texto pronto ("+¥ 1,2 tri") ou
                                              {v, txt, sub}. Itens que sobraram vão pro coletor e chamam ctx.onLand(item).
     G.EventArt.openBook(id?) / closeBook()   Livro dos Eventos (lê G.Events.book() -> {id: {seen, best, bestTxt, locked}} se existir;
                                              senão S.evBook, senão S.stats['evento_'+id] e o que a arte viu nesta sessão).
     G.EventArt.drawTrigger(g, gatilho, t) · drawScreen(g, W, H, t) · draw(g, view, t) · tick(dt): já chamados sozinhos;
     ficam públicos se o programador quiser chamar na mão (G.EventArt.manual = true desliga o automático).
   Ouvinte numa linha: se G.Events.listen existir, a arte se inscreve sozinha (G.Events.listen(G.EventArt)); o sistema chama
   spawn/take/start/on/end nela. Sem G.Events: demo no ?dev  ->  ?evento=frenesi (…&evt=20 pula pro segundo 20), ?evento=gatilho,
   ?livro (=demo pra páginas vistas), ou no console __kome.evento('chuva') / __kome.livro().
   Desempenho: partículas com teto (EA.P_CAP), chuva/raio/grãos procedurais sem alocar, sprites e gradientes em cache.
   G.EventArt.stats = {ms, avg, max, parts} do último quadro. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.Draw || !E.U) return;
  const U = E.U, PAL = E.PAL, Draw = E.Draw, INK = '#3B2818', TAU = Math.PI * 2, clamp = U.clamp, lerp = U.lerp, EZ = U.ease;

  /* ===================== MOVER PRO data.js (D.EVENT_ART) — números do visual e textos dos eventos ===================== */
  const EA = {
    LIFE: 15,             // s do gatilho na tela (spec: 15 s; "Brilho Longo" soma: passe {life} no spawn)
    TRIG_R: 27,           // raio da moeda dourada (px de tela lógica); o toque pega até TRIG_HIT
    TRIG_HIT: 50,
    INTRO: 2.0,           // s do cartaz de entrada
    OUTRO: 3.4,           // s da festa do fim
    P_CAP: 380,           // partículas na tela (teto)
    RAIN_ITEMS: 26, RAIN_ONI_EVERY: 4, RAIN_GRAINS: 130,     // Chuva: itens tocáveis, 1 onigiri a cada N, grãos de enfeite
    STORM_DROPS: 150, STORM_GAP: [1.3, 2.1],                  // Tempestade: gotas, intervalo entre raios (s)
    GIANT_H: 0.62, GIANT_BEAT: 1.3,                           // Kome Gigante: altura (fração da tela), s por patada
    PARADE_CREW: 8,                                           // Desfile: shibas marchando atrás do carro
    FEST_LANTERNS: 13, FEST_FW: [0.45, 0.95],                  // Festival: lanternas por corda, intervalo dos fogos
    FREN_BPM: 1.45,                                           // Frenesi: música ×1,45 mais rápida
    ORDER: ['frenesi', 'chuva', 'gigante', 'desfile', 'tempestade', 'festival'],
    EV: {   // nome, piada e números da planilha (camada-cookie-conteudo.csv, tipo evento) — o sistema manda nos números de verdade
      frenesi: { n: 'Frenesi do Shiba', s: 'FRENESI', sh: 'FRENESI', w: 40, dur: 60, fx: 'renda ×7', badge: '×7', col: '#F3C94A', ink: '#8A5A12',
        joke: 'Café triplo pra frota inteira. Todo mundo corre! Renda ×7.', fim: 'FIM DO FRENESI!', hint: 'O mais comum de todos. Cheira a café.' },
      chuva: { n: 'Chuva de Arroz', s: 'CHUVA DE ARROZ', sh: 'CHUVA', w: 30, dur: 12, fx: '≈ 10 min de renda em grãos', badge: 'TOQUE!', col: '#8FC9E4', ink: '#2E6E92',
        joke: 'Tá chovendo arroz! Toque nos grãos. O que cair no chão vai pro coletor pela metade.', fim: 'A CHUVA PASSOU!', hint: 'Quando as nuvens parecem feitas de arroz…' },
      gigante: { n: 'Kome Gigante', s: 'KOME GIGANTE', sh: 'GIGANTE', w: 12, dur: 20, fx: 'cada patada vale ×50', badge: '×50', col: '#E09A55', ink: '#7A4A1E',
        joke: 'O Kome cresceu! Cada patada vale ×50. Cuidado com o teto.', fim: 'O KOME ENCOLHEU!', hint: 'Um certo shiba anda comendo arroz demais.' },
      desfile: { n: 'Desfile da Frota', s: 'DESFILE DA FROTA', sh: 'DESFILE', w: 8, dur: 30, fx: '+10% por unidade da turma', badge: '+10%/un', col: '#D8574E', ink: '#8A2A22',
        joke: 'Uma turma com 10 ou mais vai pra avenida: +10% por unidade dela. Tem confete.', fim: 'FIM DO DESFILE!', hint: 'Precisa de uma turma com 10 ou mais (e do nó Livro de Receitas).' },
      tempestade: { n: 'Tempestade de Sacos Dourados', s: 'TEMPESTADE', sh: 'TEMPESTADE', w: 8, dur: 20, fx: 'sacos de 1 a 7 min de renda', badge: 'SACOS!', col: '#6F7BA6', ink: '#2F3858',
        joke: 'Chovem sacos. Cada um vale de 1 a 7 min de renda, sorteado quando nasce.', fim: 'A TEMPESTADE PASSOU!', hint: 'Precisa do nó Livro de Receitas. Traga guarda-chuva (de ouro).' },
      festival: { n: 'Festival das Lanternas', s: 'FESTIVAL', sh: 'FESTIVAL', w: 2, dur: 77, fx: 'tudo ×2', badge: '×2', col: '#E2563E', ink: '#7A1E14',
        joke: 'Lanternas e taiko. Tudo ×2 por um tempinho. Raro e lindo.', fim: 'FIM DO FESTIVAL', hint: 'Raríssimo. Dizem que dá pra ouvir o taiko de longe.' },
    },
  };
  try { const DD = G.Data && G.Data.EVENT_ART; if (DD) { for (const k in DD) { if (k === 'EV') { for (const id in DD.EV) EA.EV[id] = Object.assign(EA.EV[id] || {}, DD.EV[id]); } else EA[k] = DD[k]; } } } catch (e) { /* sem data */ }
  /* ===================================================================================================================== */

  const IDS = EA.ORDER;
  const DEF = id => EA.EV[id];
  const now = () => (window.performance ? performance.now() : Date.now()) / 1000;
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const mixc = {}, mix = (a, b, k) => mixc[a + b + k] || (mixc[a + b + k] = U.mixCss(a, b, k));
  const GS = () => G.S || null;
  const CAM = () => G.cam || (window.__kome && window.__kome.cam) || null;
  const fmtY = v => '+¥ ' + U.fmt(v);
  const tmpP = { x: 0, y: 0 };
  let SW = 960, SH = 540, DPR = 1;            // tela lógica atual (o jogo usa 960..1280 × 540)
  let MOBK = 1; try { if (window.matchMedia && matchMedia('(pointer: coarse)').matches) MOBK = 1.3; } catch (e) { /* */ }   // celular: coisas tocáveis maiores

  /* ---------- cache de imagens desenhadas uma vez (vetor em resolução de tela) ---------- */
  const CACHE = new Map();
  function baked(key, w, h, fn) {
    const k = Math.max(1, Math.min(3, DPR)), kk = key + '@' + k;
    let o = CACHE.get(kk);
    if (o) return o;
    const c = mkc(w * k, h * k), g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round';
    const z0 = Draw.zoom, m0 = Draw.minPx; Draw.lod(1, 0);
    try { fn(g, w, h); } catch (e) { if (window.console) console.warn('[kome] eventos-arte: cache', key, e); }
    Draw.lod(z0, m0);
    o = { c, w, h }; CACHE.set(kk, o);
    if (CACHE.size > 300) CACHE.delete(CACHE.keys().next().value);
    return o;
  }
  const blit = (g, o, x, y, s) => { s = s || 1; g.drawImage(o.c, x, y, o.w * s, o.h * s); };
  const blitC = (g, o, x, y, s) => { s = s || 1; g.drawImage(o.c, x - o.w * s / 2, y - o.h * s / 2, o.w * s, o.h * s); };

  /* =====================================================================
     1. Sprites em pixel art (coisas pequenas) — desenho em texto (E.spriteText)
     ===================================================================== */
  const ICON_TXT = {
    frenesi: `
      ....OOOO
      ...OOOo.
      ..OOOo..
      .OOOOOOo
      ...OOOo.
      ..OOOo..
      ..OOo...
      .OOo....
      .Oo.....`,
    chuva: `
      ....AA....
      ...AAAA...
      ..AAAAAA..
      .AAAAAAAA.
      .AAAAAAAA.
      AAnnnnnnAA
      AnnnnnnnnA
      .nnnnnnnn.`,
    gigante: `
      .ee...ee.
      .EE...EE.
      .EE...EE.
      e.......e
      EE.EEE.EE
      ...EEEEE.
      ..EEEEEEE
      ..EEEEEEE
      ...EEEEE.`,
    desfile: `
      N.......
      NRRRRRR.
      NRWWRRR.
      NRRRRRR.
      NRWWWRR.
      NRRRRRR.
      NRRRRRR.
      N.......
      N.......`,
    tempestade: `
      ...wwww...
      .wSSSSSSw.
      wSSSSSSSSw
      .ssssssss.
      ...YYy....
      ..YYYYy...
      ....Yy....
      ...Yy.....`,
    festival: `
      ...NNN...
      ..RRRRR..
      .RrRRRRR.
      .RRRWRRR.
      .RrRWRRR.
      .RRRRRRR.
      ..RRRRR..
      ...NNN...
      ....Y....`,
  };
  const icon = id => E.spriteText('ev_ic_' + id, ICON_TXT[id] || ICON_TXT.frenesi);
  const LANT_TXT = `
      ....NNNN....
      ...NNNNNN...
      ..RRRRRRRR..
      .RRrRRRRrRR.
      RRrRRRRRRrRR
      RRRRRWWRRRRR
      RRrRRWWRRrRR
      RRRRRWWRRRRR
      RRrRRRRRRrRR
      .RRrRRRRrRR.
      ..RRRRRRRR..
      ...NNNNNN...
      ....NNNN....
      .....YY.....
      .....YY.....`;
  const lantern = white => E.spriteText(white ? 'ev_lant_w' : 'ev_lant_r', LANT_TXT, white ? { pal: { R: '#FFF3DA', r: '#E9C99A', W: '#C8423A' } } : undefined);
  const GRAIN_TXT = ['AAa', 'A\nA\na', 'Aa.\n.Aa'];
  const grain = v => E.spriteText('ev_gr' + (v % 3), GRAIN_TXT[v % 3], { outline: false, pal: { A: '#FFFDF6', a: '#D9CCAE' } });
  const goldGrain = () => E.spriteText('ev_ggr', `
      ..YYYY...
      .YWYYYYy.
      YYYYYYYYy
      .yYYYYyy.
      ..yyyy...`);
  const FLAME = [`
      ...Y....
      ..YOY...
      ..YOOY..
      .YOROOY.
      .YORROY.
      YORRRROY
      YORRWROY
      .YORROY.
      ..YYYY..`, `
      ....Y...
      ...YOY..
      ..YOOY..
      ..YOROY.
      .YORROY.
      .YORRROY
      YORRWROY
      .YORROY.
      ..YYYY..`, `
      ..Y.....
      ..YY..Y.
      .YOOY.Y.
      .YOROOY.
      YORRROY.
      YORRRROY
      YORWRROY
      .YORROY.
      ..YYYY..`];
  const flame = f => E.spriteText('ev_fl' + (f % 3), FLAME[f % 3], { pal: { R: '#E2563E', O: '#F3A23A', Y: '#FFE07A', W: '#FFFBEA' } });
  const sackCv = () => (G.Props && G.Props.sack ? G.Props.sack('golden') : null);
  const oniCv = () => (G.Props && G.Props.onigiri ? G.Props.onigiri() : null);
  const coinCv = () => (G.Props && G.Props.coin ? G.Props.coin() : null);
  const pixImg = (g, cv, x, y, s) => { if (!cv) return; const c = cv.cv || cv; g.imageSmoothingEnabled = false; g.drawImage(c, Math.round(x - c.width * s / 2), Math.round(y - c.height * s / 2), c.width * s, c.height * s); };

  /* glow redondo (dourado, quente, branco) e raios — cache */
  function glowImg(col) {
    return baked('glow' + col, 128, 128, g => {
      const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
      gr.addColorStop(0, col.replace('A)', '0.95)')); gr.addColorStop(0.35, col.replace('A)', '0.45)')); gr.addColorStop(1, col.replace('A)', '0)'));
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
  }
  const GOLD_G = 'rgba(255,214,110,A)', WARM_G = 'rgba(255,170,90,A)', WHITE_G = 'rgba(255,252,235,A)', BLUE_G = 'rgba(190,220,255,A)';
  function raysImg(col, n) {
    return baked('rays' + col + n, 256, 256, g => {
      g.translate(128, 128);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, gr = g.createLinearGradient(0, 0, Math.cos(a) * 128, Math.sin(a) * 128);
        gr.addColorStop(0, col.replace('A)', '0.7)')); gr.addColorStop(1, col.replace('A)', '0)'));
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 128, a - TAU / n / 4, a + TAU / n / 4); g.closePath(); g.fill();
      }
    });
  }

  /* moeda dourada do gatilho (vetor, nítida em qualquer tela) */
  function medal(id, R) {
    return baked('medal' + id + R, R * 2 + 10, R * 2 + 10, g => {
      const c = R + 5;
      g.fillStyle = INK; g.beginPath(); g.arc(c, c, R + 2.5, 0, TAU); g.fill();
      g.fillStyle = PAL.goldD; g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill();
      g.fillStyle = PAL.gold; g.beginPath(); g.arc(c - R * 0.06, c - R * 0.08, R * 0.9, 0, TAU); g.fill();
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.fillStyle = i % 2 ? PAL.goldL : PAL.goldD; g.beginPath(); g.arc(c + Math.cos(a) * R * 0.82, c + Math.sin(a) * R * 0.82, R * 0.06, 0, TAU); g.fill(); }
      g.strokeStyle = PAL.goldD; g.lineWidth = R * 0.07; g.beginPath(); g.arc(c, c, R * 0.68, 0, TAU); g.stroke();
      g.fillStyle = '#FFF0B8'; g.beginPath(); g.arc(c, c, R * 0.64, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = R * 0.12; g.beginPath(); g.arc(c, c, R * 0.84, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
      const ic = icon(id), s = Math.max(2, Math.floor(R * 1.25 / Math.max(ic.width, ic.height)));
      g.imageSmoothingEnabled = false; g.drawImage(ic, Math.round(c - ic.width * s / 2), Math.round(c - ic.height * s / 2), ic.width * s, ic.height * s);
    });
  }

  /* nuvens em faixa que emenda (tempestade = escura; chuva = de arroz) */
  function cloudTile(kind) {
    const dark = kind === 'storm', TW = 420, TH = 150;
    return baked('cloud' + kind, TW, TH, g => {
      const R = E.RNG(dark ? 77 : 33), puffs = [];
      for (let i = 0; i < 16; i++) puffs.push([R() * TW, 30 + R() * 50, 26 + R() * 30]);
      const body = dark ? '#4C5576' : '#FFFDF6', shade = dark ? '#363D59' : '#E6DCC4', hi = dark ? '#6D789C' : '#FFFFFF';
      const each = fn => { for (const p of puffs) for (const o of [-TW, 0, TW]) fn(p[0] + o, p[1], p[2]); };
      g.fillStyle = INK; each((x, y, r) => { g.beginPath(); g.arc(x, y, r + 2.5, 0, TAU); g.fill(); });
      g.fillRect(0, 0, TW, 40);
      g.fillStyle = shade; each((x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }); g.fillRect(0, 0, TW, 40);
      g.fillStyle = body; each((x, y, r) => { g.beginPath(); g.arc(x - r * 0.08, y - r * 0.16, r * 0.86, 0, TAU); g.fill(); }); g.fillRect(0, 0, TW, 34);
      g.fillStyle = hi; each((x, y, r) => { g.beginPath(); g.arc(x - r * 0.25, y - r * 0.35, r * 0.4, 0, TAU); g.fill(); });
      if (!dark) { g.fillStyle = '#D9CCAE'; for (let i = 0; i < 260; i++) { const x = R() * TW, y = R() * 95; g.save(); g.translate(x, y); g.rotate(R() * 3); g.fillRect(-1.6, -0.7, 3.2, 1.4); g.restore(); } }
    });
  }

  /* barraquinha de festival (yatai): fundo (telhado+postes) e frente (balcão); entre os dois entra o vendedor */
  const STALLS = [['TAKOYAKI', '#D8574E'], ['DANGO', '#5D9A40'], ['RAMEN', '#E2742E'], ['KAKIGORI', '#3F78C8'], ['YAKISOBA', '#8A5CC8']];
  function stallBack(i) {
    const [, col] = STALLS[i % STALLS.length];
    return baked('stallB' + i, 160, 140, g => {
      Draw.box(g, 14, 30, 8, 104, PAL.woodD, { ol: 1.5 }); Draw.box(g, 138, 30, 8, 104, PAL.woodD, { ol: 1.5 });
      Draw.box(g, 18, 56, 124, 50, '#5A3A22', { ol: 0 });                                // fundo escuro da barraca
      // telhado listrado com franja de bico
      g.fillStyle = INK; g.beginPath(); g.moveTo(2, 34); g.lineTo(18, 8); g.lineTo(142, 8); g.lineTo(158, 34); g.closePath(); g.fill();
      for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#FFF6E6' : col; const x0 = 18 + k * 15.5, x1 = x0 + 15.5; g.beginPath(); g.moveTo(lerp(4, 18, 1) + (x0 - 18) * 1.21 - 14, 32); g.lineTo(x0, 10); g.lineTo(x1, 10); g.lineTo(lerp(4, 18, 1) + (x1 - 18) * 1.21 - 14, 32); g.closePath(); g.fill(); }
      for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#FFF6E6' : col; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(9 + k * 15.8, 33, 7.9, 0, Math.PI); g.fill(); g.stroke(); }
    });
  }
  function stallFront(i) {
    const [label, col] = STALLS[i % STALLS.length];
    return baked('stallF' + i, 160, 140, g => {
      // cortina noren curtinha com o nome
      for (let k = 0; k < 3; k++) { Draw.box(g, 26 + k * 37, 40, 34, 22, col, { ol: 1.2, top: false }); }
      Draw.text(g, label, 80, 52, { size: label.length > 7 ? 11 : 13, col: '#FFF6E6', sw: 3 });
      // balcão
      Draw.box(g, 8, 100, 144, 36, PAL.wood, { ol: 2, top: PAL.woodL });
      Draw.box(g, 4, 94, 152, 10, PAL.woodL, { ol: 2 });
      g.fillStyle = PAL.woodD; for (let k = 0; k < 5; k++) g.fillRect(14 + k * 28, 110, 18, 2);
    });
  }

  /* =====================================================================
     2. Partículas (tela lógica), com teto e pool — nada aloca depois de aquecer
     ===================================================================== */
  const PS = [], POOL = [];
  // kinds: 0 quadrado · 1 estrela · 2 grão · 3 moeda · 4 confete · 5 faísca (lighter) · 6 poeira · 7 lasca de arroz
  function part(kind, x, y, vx, vy, life, col, s, gr) {
    if (PS.length >= EA.P_CAP) return null;
    const p = POOL.pop() || {};
    p.k = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.age = 0; p.c = col; p.s = s; p.gr = gr || 0; p.r = Math.random() * TAU; p.vr = (Math.random() - 0.5) * 12; p.dr = kind === 6 ? 2.5 : kind === 5 ? 1.4 : 0.6;
    PS.push(p); return p;
  }
  function burst(kind, x, y, n, sp0, sp1, life, cols, s, gr, up) {
    for (let i = 0; i < n; i++) {
      const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * up : Math.random() * TAU, sp = lerp(sp0, sp1, Math.random());
      part(kind, x, y, Math.cos(a) * sp, Math.sin(a) * sp, life * (0.7 + Math.random() * 0.5), cols[i % cols.length], s * (0.7 + Math.random() * 0.6), gr);
    }
  }
  function partsTick(dt) {
    for (let i = PS.length - 1; i >= 0; i--) {
      const p = PS[i]; p.age += dt;
      if (p.age >= p.life) { PS[i] = PS[PS.length - 1]; PS.pop(); POOL.push(p); continue; }
      const d = Math.max(0, 1 - p.dr * dt); p.vx *= d; p.vy *= d; p.vy += p.gr * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
    }
  }
  const CONF = ['#E2563E', '#F3C94A', '#5FA04A', '#3F78C8', '#F29CB4', '#FFF6E6', '#8A5CC8'];
  function partsDraw(g) {
    let lighter = false;
    for (let i = 0; i < PS.length; i++) {
      const p = PS[i], q = p.age / p.life, a = q > 0.7 ? (1 - q) / 0.3 : 1;
      if ((p.k === 5) !== lighter) { lighter = p.k === 5; g.globalCompositeOperation = lighter ? 'lighter' : 'source-over'; }
      g.globalAlpha = a;
      if (p.k === 0) { g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
      else if (p.k === 1) { const s = p.s * (1 - q * 0.5); g.fillStyle = p.c; g.fillRect(p.x - s, p.y - s * 0.22, s * 2, s * 0.44); g.fillRect(p.x - s * 0.22, p.y - s, s * 0.44, s * 2); g.fillStyle = '#FFFFFF'; g.fillRect(p.x - s * 0.22, p.y - s * 0.22, s * 0.44, s * 0.44); }
      else if (p.k === 2) { pixImg(g, grain(i), p.x, p.y, 2); }
      else if (p.k === 3) { const c = coinCv(); if (c) { const cv = c.cv || c, w = Math.abs(Math.cos(p.r)) * cv.width * 2 + 1; g.imageSmoothingEnabled = false; g.drawImage(cv, p.x - w / 2, p.y - cv.height, w, cv.height * 2); } }
      else if (p.k === 4) { const w = p.s, h = p.s * 0.55 * Math.abs(Math.cos(p.r)) + 1; g.fillStyle = p.c; g.save(); g.translate(p.x, p.y); g.rotate(p.r * 0.3); g.fillRect(-w / 2, -h / 2, w, h); g.restore(); }
      else if (p.k === 5) { g.strokeStyle = p.c; g.lineWidth = p.s; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); g.stroke(); }
      else if (p.k === 6) { const r = p.s * (0.5 + q); g.globalAlpha = a * 0.75; g.fillStyle = INK; g.beginPath(); g.arc(p.x, p.y, r + 2, 0, TAU); g.fill(); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill(); }
      else if (p.k === 7) { g.fillStyle = INK; g.fillRect(p.x - p.s / 2 - 1, p.y - p.s / 2 - 1, p.s + 2, p.s + 2); g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
  /* textos que sobem (pop) */
  const POPS = [];
  function pop(sx, sy, txt, big) { if (POPS.length > 24) POPS.shift(); POPS.push({ x: sx, y: sy, txt: String(txt), big: !!big, age: 0 }); }
  function popsTick(dt) { for (let i = POPS.length - 1; i >= 0; i--) { POPS[i].age += dt; if (POPS[i].age > 1.3) POPS.splice(i, 1); } }
  function popsDraw(g) {
    for (let i = POPS.length - 1; i >= 0; i--) {
      const p = POPS[i];
      const k = p.age < 0.15 ? EZ.back(p.age / 0.15) : 1, a = p.age > 0.9 ? (1.3 - p.age) / 0.4 : 1;
      Draw.text(g, p.txt, p.x, p.y - p.age * 46, { size: (p.big ? 32 : 22) * k, col: p.big ? PAL.goldL : PAL.cream, sw: p.big ? 8 : 6, alpha: a });
    }
  }

  /* =====================================================================
     3. Som (E.Sfx da engine; respeita o mudo do jogo) e música
     ===================================================================== */
  const SF = E.Sfx;
  if (SF && SF.define) {
    // gatilho nasceu: "plim" dourado
    SF.define('ev-plim', a => { a.play('gold', { pitch: 1.12, vol: 0.8 }); a.play('chirin', { vol: 0.45, delay: 0.12 }); });
    // gatilho tocado: estouro + sobe
    SF.define('ev-pega', a => { a.play('pop', { pitch: 1.2 }); a.play('shing', { vol: 0.7, delay: 0.02 }); a.play('pling', { delay: 0.06 }); });
    // trovão (pré-renderizado): estalo seco + ronco grave que rola
    SF.define('ev-trovao', { v: 2, gate: 0.25, max: 2, peak: 0.62, rev: 0.45, duck: 0.35, prio: 1, render: D => {
      const b = D.buf(2.8);
      D.noise(b, { a: 0.001, d: 0.09, vol: 0.9, hp: 1800 });
      D.noise(b, { a: 0.003, s: 0.04, d: 0.45, vol: 0.75, lp: 3200, lp1: 380 });
      D.noise(b, { color: 'brown', at: 0.03, a: 0.06, s: 0.5, d: 1.9, vol: 1, lp: 170, am: 4.5, amDepth: 0.55 });
      D.noise(b, { color: 'pink', at: 0.12, a: 0.25, s: 0.3, d: 1.4, vol: 0.38, lp: 650, am: 8, amDepth: 0.7 });
      D.sat(b, 1.4); return b; } });
    // fogos de artifício: bum + chuvisco de estalinhos
    SF.define('ev-fogos', { v: 3, gate: 0.12, max: 3, peak: 0.45, rev: 0.55, render: D => {
      const b = D.buf(1.7);
      D.noise(b, { a: 0.002, d: 0.32, vol: 0.9, lp: 2400, lp1: 260 }); D.osc(b, { f: 95, f1: 38, d: 0.3, vol: 0.55, punch: 0.4 });
      for (let i = 0; i < 16; i++) D.noise(b, { at: 0.18 + D.rr(0, 1.0), a: 0.001, d: 0.018, vol: D.rr(0.12, 0.32), hp: 5200 });
      return b; } });
    // subida do foguete (assobio)
    SF.define('ev-subida', a => { a.tone(700, 0.55, 'sine', 0.05, 2.4); a.noise(0.5, 3000, 0.04, 2); });
    // grão pego na chuva / saco pego
    SF.define('ev-grao', a => { a.play('coinS', { n: 10 + ((a.rnd() * 12) | 0) }); a.play('pop', { pitch: 1.4, vol: 0.5 }); });
    SF.define('ev-saco', a => { a.play('sack'); a.play('kaching', { delay: 0.08, vol: 0.8 }); });
    // grão caiu no chão e foi pro coletor (metade): "plop" baixinho
    SF.define('ev-plop', a => { a.tone(320, 0.08, 'sine', 0.12, 0.6); a.noise(0.04, 900, 0.06, 1); });
    // começo de cada evento (jingle curto com a cara dele)
    SF.define('ev-ini-frenesi', a => { a.play('whoosh', { pitch: 0.9 }); a.play('levelup', { pitch: 1.12, delay: 0.08 }); a.drum('chan', { vel: 0.7, delay: 0.5 }); });
    SF.define('ev-ini-chuva', a => { a.play('splash', { pitch: 1.3, vol: 0.6 }); a.play('chime', { delay: 0.05 }); a.play('sparkle', { delay: 0.2 }); });
    SF.define('ev-ini-gigante', a => { a.play('boing', { pitch: 0.55 }); a.play('stomp', { delay: 0.45, pitch: 0.8 }); });
    SF.define('ev-ini-desfile', a => { a.play('whistle', { pitch: 1.5, vol: 0.6 }); a.play('taikoRoll', { delay: 0.1 }); });
    SF.define('ev-ini-tempestade', a => { a.play('ev-trovao'); a.play('whoosh', { pitch: 0.6, vol: 0.6 }); });
    SF.define('ev-ini-festival', a => { a.play('taikoRoll'); a.play('bell', { delay: 1.1 }); a.play('chime', { delay: 1.3 }); });
    // fim: fanfarra + caixa registradora
    SF.define('ev-fim', a => { a.play('fanfare'); a.play('kaching', { delay: 0.42, vol: 0.9 }); a.play('sparkle', { delay: 0.5 }); });
    // virar página do Livro: papel
    SF.define('ev-pagina', a => { a.noise(0.18, 2600, 0.12, 0.6); a.noise(0.08, 5200, 0.06, 1, 0.12); });
  }
  const sfxLast = {};
  function sfx(name, o) {
    const s = GS(); if ((s && s.opts && s.opts.mute) || !SF || !SF.has || !SF.has(name)) return;
    const t = now(); if (sfxLast[name] && t - sfxLast[name] < 0.06) return; sfxLast[name] = t;
    try { SF.play(name, o); } catch (e) { /* sem áudio */ }
  }
  function loop(name, vol) {
    const s = GS(); if ((s && s.opts && s.opts.mute) || !E.Loops) return null;
    try { return E.Loops.start(name, { vol: vol, rate: 0.5 }); } catch (e) { return null; }
  }
  const stopLoop = h => { if (h) { try { h.stop(0.8); } catch (e) { /* */ } } };
  let musPrev = null, musOwner = null;
  function musicOk() { const M = E.Music, s = GS(); return !!(M && M.playing && s && s.opts && !s.opts.mute && s.opts.music !== false); }
  function musicPush(owner, theme, make) {
    if (!musicOk()) return; const M = E.Music;
    try {
      if (!musPrev) musPrev = { th: M.theme, i: M.targetIntensity };
      if (make) M.define(theme, make(M.get(musPrev.th) || {}));
      M.setTheme(theme, 0.8); M.setIntensity(1); musOwner = owner;
    } catch (e) { /* */ }
  }
  function musicPop(owner) {
    if (!musPrev || musOwner !== owner) return; const M = E.Music;
    try { if (M.theme && M.theme.indexOf('ev-') === 0) M.setTheme(musPrev.th, 1.6); M.setIntensity(musPrev.i); } catch (e) { /* */ }
    musPrev = null; musOwner = null;
  }
  function beat(t, bpm) { const M = E.Music; const b = (M && M.playing && M.bpm) || bpm || 120; return (t * b / 60) % 1; }

  /* =====================================================================
     4. Onde ficam as coisas do HUD (DOM) na tela lógica — medido 2× por segundo
     ===================================================================== */
  const HUDY = { top: 64, bot: 540 - 92, t: -1 };
  function hudMeasure() {
    const T = now(); if (T - HUDY.t < 0.5) return; HUDY.t = T;
    try {
      let cv = null, best = 0;
      document.querySelectorAll('canvas').forEach(c => { const r = c.getBoundingClientRect(); if (r.width * r.height > best && !c.closest('.k-ofi,.k-evbook,.k-fab')) { best = r.width * r.height; cv = r; } });
      if (!cv || !cv.height) return;
      const toL = y => (y - cv.top) / cv.height * SH;
      const tc = document.querySelector('.k-zone-tc');
      if (tc) { let b = 0; tc.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(); if (r.height > 4 && r.width > 4) b = Math.max(b, r.bottom); }); if (b) HUDY.top = clamp(toL(b) + 10, 40, SH * 0.45); }
      const dk = document.querySelector('.k-zone-dock');
      if (dk) { let t = 1e9; dk.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(); if (r.height > 12 && r.width > 12) t = Math.min(t, r.top); }); if (t < 1e9) HUDY.bot = clamp(toL(t) - 6, SH * 0.6, SH - 40); }
    } catch (e) { /* sem DOM */ }
  }

  /* =====================================================================
     5. Peças de desenho compartilhadas (eventos e Livro)
     ===================================================================== */
  const palCache = {};
  function crewPal(col) {
    return palCache[col] || (palCache[col] = { h: col, g: mix(col, '#2A1A10', 0.32), o: '#D9A066', c: '#EBEBEB', k: '#2A1A10', n: '#2A1A10', p: '#D95763' });
  }
  const shOpt = { pal: 'kome', face: 1, scale: 1, smooth: false, squash: 0, rot: 0 };
  function shiba(g, x, y, pose, t, sc, pal, face, squash) {
    if (!E.drawShiba) return;
    shOpt.pal = pal || 'kome'; shOpt.face = face || 1; shOpt.scale = sc; shOpt.squash = squash || 0; shOpt.smooth = false;
    E.drawShiba(g, x, y, pose, t, shOpt);
  }
  function rr(g, x, y, w, h, r) { Draw.rrect(g, x, y, w, h, r); }
  function pill(g, x, y, w, h, fill, ol) { g.fillStyle = INK; rr(g, x - (ol || 2.5), y - (ol || 2.5), w + (ol || 2.5) * 2, h + (ol || 2.5) * 2, h / 2 + (ol || 2.5)); g.fill(); g.fillStyle = fill; rr(g, x, y, w, h, h / 2); g.fill(); }
  // raio: zigue-zague de (x0,y0) até (x1,y1), semente fixa por raio
  function boltPts(x0, y0, x1, y1, seed, n) {
    const pts = [[x0, y0]];
    for (let i = 1; i < n; i++) { const k = i / n; pts.push([lerp(x0, x1, k) + (hash(seed + i) - 0.5) * 46 * (1 - k * 0.5), lerp(y0, y1, k) + (hash(seed + i * 3) - 0.5) * 14]); }
    pts.push([x1, y1]); return pts;
  }
  function drawBolt(g, pts, w, a) {
    g.lineJoin = 'miter'; g.globalAlpha = a;
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
    g.globalCompositeOperation = 'lighter'; path(); g.strokeStyle = 'rgba(255,230,140,0.35)'; g.lineWidth = w * 4; g.stroke();
    g.globalCompositeOperation = 'source-over'; path(); g.strokeStyle = INK; g.lineWidth = w + 3; g.stroke();
    path(); g.strokeStyle = PAL.goldL; g.lineWidth = w; g.stroke(); path(); g.strokeStyle = '#FFFFFF'; g.lineWidth = Math.max(1, w * 0.4); g.stroke();
    g.globalAlpha = 1; g.lineJoin = 'round';
  }
  // bandeira nobori (mastro + pano vertical com texto)
  function nobori(g, x, y, h, col, txt, t, ph) {
    const w = h * 0.32, sway = Math.sin(t * 3 + ph) * 3;
    Draw.box(g, x - 2, y - h, 4, h, PAL.woodD, { ol: 1.2 });
    g.save(); g.translate(x + 2, y - h + 6); g.transform(1, 0, sway * 0.012, 1, 0, 0);
    Draw.box(g, 0, 0, w, h * 0.62, col, { ol: 1.6, top: mix(col, '#FFFFFF', 0.25) });
    g.fillStyle = '#FFF6E6'; g.fillRect(3, 3, w - 6, 4); g.fillRect(3, h * 0.62 - 7, w - 6, 3);
    if (txt) { const ch = String(txt).slice(0, 4).split(''); for (let i = 0; i < ch.length; i++) Draw.text(g, ch[i], w / 2, 18 + i * Math.min(15, (h * 0.62 - 24) / Math.max(1, ch.length - 0.5)), { size: Math.min(15, w * 0.62), col: '#FFF6E6', sw: 3 }); }
    g.restore();
  }
  // taiko num carrinho
  function drumCart(g, x, y, s, t, hit) {
    g.save(); g.translate(x, y); g.scale(s, s);
    Draw.box(g, -52, -26, 104, 18, PAL.wood, { ol: 2, top: PAL.woodL });
    Draw.wheel ? Draw.wheel(g, -34, -6, 10, t * -4, {}) : Draw.circle(g, -34, -6, 10, PAL.woodD, { ol: 2 });
    Draw.wheel ? Draw.wheel(g, 34, -6, 10, t * -4, {}) : Draw.circle(g, 34, -6, 10, PAL.woodD, { ol: 2 });
    const k = 1 + hit * 0.06;
    g.save(); g.translate(0, -52); g.scale(k, 1 / k);
    Draw.box(g, -26, -22, 52, 44, '#A2462E', { ol: 2, r: 10, top: '#C8623E' });
    g.fillStyle = INK; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-22 + i * 8.8, -18, 1.6, 0, TAU); g.fill(); g.beginPath(); g.arc(-22 + i * 8.8, 18, 1.6, 0, TAU); g.fill(); }
    g.fillStyle = INK; g.beginPath(); g.ellipse(26, 0, 6, 21, 0, 0, TAU); g.fill(); g.fillStyle = '#F2E2C2'; g.beginPath(); g.ellipse(26, 0, 4.4, 19, 0, 0, TAU); g.fill();
    g.fillStyle = '#C8423A'; g.beginPath(); g.arc(26, 0, 3, 0, TAU); g.fill();
    g.restore();
    g.restore();
  }
  // morrinho de arroz (Livro)
  function riceHill(g, x, y, w, h) {
    g.fillStyle = INK; g.beginPath(); g.moveTo(x - 3, y + 2); g.quadraticCurveTo(x + w * 0.5, y - h * 2 - 6, x + w + 3, y + 2); g.closePath(); g.fill();
    g.fillStyle = PAL.riceS; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w * 0.5, y - h * 2, x + w, y); g.closePath(); g.fill();
    g.fillStyle = PAL.rice; g.beginPath(); g.moveTo(x + w * 0.08, y); g.quadraticCurveTo(x + w * 0.42, y - h * 1.9, x + w * 0.74, y); g.closePath(); g.fill();
    g.fillStyle = PAL.riceD; for (let i = 0; i < 40; i++) { const u = hash(i + w), v = hash(i * 7 + h); const px = x + w * (0.1 + 0.8 * u), top = y - h * 2 * 4 * (px - x) / w * (1 - (px - x) / w) * 0.5; g.fillRect(px, lerp(top + 4, y - 2, v), 3, 1.5); }
  }
  function firework(g, x, y, r, q, col) {   // estouro estático (Livro): anel de pontos com rastro
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, rr2 = r * q; g.fillStyle = col; g.globalAlpha = 1 - q * 0.6; g.fillRect(x + Math.cos(a) * rr2 - 1.5, y + Math.sin(a) * rr2 + q * q * 8 - 1.5, 3, 3); g.globalAlpha = (1 - q) * 0.5; g.fillRect(x + Math.cos(a) * rr2 * 0.7 - 1, y + Math.sin(a) * rr2 * 0.7 - 1, 2, 2); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  /* =====================================================================
     6. Gatilhos (a coisa dourada pra tocar)
     ===================================================================== */
  const TR = [];
  function spawn(id, x, y, o) {
    if (!DEF(id)) return null;
    o = o || {};
    const cam = CAM(), z = cam ? cam.z : 1;
    if (x === undefined || x === null) {
      const base = cam ? cam.x : 0, hw = SW / 2 / z;
      x = base + (hash(now() * 3.1) - 0.5) * hw * 0.9;
      y = cam && cam.toWorld ? cam.toWorld(0, Math.max(HUDY.top + 70, SH * 0.36), tmpP).y : (cam ? cam.y : 0) - 120 / z;
    }
    const tr = { id, x, y, age: 0, life: o.life || EA.LIFE, taken: -1, gone: -1, seed: Math.random() * 100, sx: -999, sy: -999, vis: false };
    TR.push(tr); sfx('ev-plim'); return tr;
  }
  function hitTrigger(sx, sy) {
    for (let i = TR.length - 1; i >= 0; i--) { const tr = TR[i]; if (tr.taken >= 0 || tr.gone >= 0 || !tr.vis) continue; if (Math.hypot(sx - tr.sx, sy - tr.sy) < EA.TRIG_HIT * MOBK) return tr; }
    return null;
  }
  function take(tr) {
    if (!tr || tr.taken >= 0) return null;
    tr.taken = 0; sfx('ev-pega');
    burst(1, tr.sx, tr.sy, 14, 80, 260, 0.7, [PAL.goldL, '#FFFFFF', PAL.gold], 7, 0);
    burst(3, tr.sx, tr.sy, 8, 120, 260, 0.9, ['#000'], 1, 500, 2.2);
    return tr.id;
  }
  function trigTick(dt) {
    for (let i = TR.length - 1; i >= 0; i--) {
      const tr = TR[i]; tr.age += dt;
      if (tr.taken >= 0) { tr.taken += dt; if (tr.taken > 0.45) TR.splice(i, 1); continue; }
      if (tr.gone < 0 && tr.age >= tr.life) { tr.gone = 0; burst(1, tr.sx, tr.sy, 6, 30, 90, 0.6, [PAL.goldL, '#FFFFFF'], 5, 0); }
      if (tr.gone >= 0) { tr.gone += dt; if (tr.gone > 0.6) TR.splice(i, 1); }
    }
  }
  function drawTrigger(g, tr, t) {
    const cam = CAM(); if (!cam) return;
    const z = cam.z, wob = Math.sin(t * 0.55 + tr.seed) * 0.035 * SW / z;
    cam.toScreen(tr.x + wob, tr.y, tmpP);
    let x = tmpP.x, y = tmpP.y + Math.sin(t * 2.4 + tr.seed) * 6;
    const R = Math.round(EA.TRIG_R * MOBK), inView = x > -R && x < SW + R && y > -R && y < SH + R;
    tr.vis = true;
    if (!inView) {   // fora da tela: setinha dourada na borda apontando
      const ex = clamp(x, 36, SW - 36), ey = clamp(y, Math.max(36, HUDY.top), Math.min(SH - 36, HUDY.bot - 30)), a = Math.atan2(y - ey, x - ex);
      tr.sx = ex; tr.sy = ey;
      g.globalAlpha = 0.85 + 0.15 * Math.sin(t * 5); g.globalCompositeOperation = 'lighter'; blitC(g, glowImg(GOLD_G), ex, ey, 0.6); g.globalCompositeOperation = 'source-over';
      blitC(g, medal(tr.id, 18), ex, ey, 1);
      g.save(); g.translate(ex, ey); g.rotate(a); g.fillStyle = INK; g.beginPath(); g.moveTo(34, 0); g.lineTo(22, -10); g.lineTo(22, 10); g.closePath(); g.fill();
      g.fillStyle = PAL.gold; g.beginPath(); g.moveTo(31, 0); g.lineTo(24, -6); g.lineTo(24, 6); g.closePath(); g.fill(); g.restore(); g.globalAlpha = 1;
      return;
    }
    tr.sx = x; tr.sy = y;
    let s = tr.age < 0.4 ? EZ.back(tr.age / 0.4) : 1, a = 1;
    if (tr.taken >= 0) { const q = tr.taken / 0.45; s = 1 + q * 0.8; a = 1 - q; }
    if (tr.gone >= 0) { const q = tr.gone / 0.6; s = 1 - q * 0.6; a = 1 - q; }
    g.globalAlpha = a;
    // brilho e raios girando atrás
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a * (0.55 + 0.15 * Math.sin(t * 4 + tr.seed)); blitC(g, glowImg(GOLD_G), x, y, s * 1.25);
    g.save(); g.translate(x, y); g.rotate(t * 0.6 + tr.seed); g.globalAlpha = a * 0.5; blitC(g, raysImg(GOLD_G, 10), 0, 0, s * 0.62); g.restore();
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = a;
    // anel de tempo: esvazia sem pressa, igual do começo ao fim (sem piscar, sem truque)
    const left = tr.taken >= 0 ? 1 : clamp(1 - tr.age / tr.life, 0, 1), rr2 = (R + 9) * s;
    g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.arc(x, y, rr2, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,250,230,0.9)'; g.lineWidth = 4.5; g.beginPath(); g.arc(x, y, rr2, 0, TAU); g.stroke();
    if (left > 0) { g.strokeStyle = PAL.gold; g.lineWidth = 4.5; g.beginPath(); g.arc(x, y, rr2, -Math.PI / 2, -Math.PI / 2 + TAU * left); g.stroke(); }
    // moeda (gira de leve, como moeda no ar)
    const m = medal(tr.id, R), spin = 0.82 + 0.18 * Math.abs(Math.cos(t * 1.7 + tr.seed));
    g.drawImage(m.c, x - m.w * s * spin / 2, y - m.h * s / 2, m.w * s * spin, m.h * s);
    // estrelinhas em volta
    for (let k = 0; k < 3; k++) {
      const an = t * 1.3 + k * TAU / 3 + tr.seed, tw = 0.5 + 0.5 * Math.sin(t * 6 + k * 2), ss = (3 + 3 * tw) * s, px = x + Math.cos(an) * (R + 20) * s, py = y + Math.sin(an) * (R + 16) * s;
      g.fillStyle = PAL.goldL; g.fillRect(px - ss, py - 1, ss * 2, 2); g.fillRect(px - 1, py - ss, 2, ss * 2); g.fillStyle = '#FFFFFF'; g.fillRect(px - 1, py - 1, 2, 2);
    }
    // nome embaixo: dá pra saber o que vem (o evento foi sorteado quando nasceu)
    if (tr.taken < 0) {
      const d = DEF(tr.id), txt = d.s, w = Math.max(70, txt.length * 9.6 + 22);
      pill(g, x - w / 2, y + R + 16, w, 24, '#FFF6DE', 2);
      Draw.text(g, txt, x, y + R + 28.5, { size: 17, col: d.ink, sw: 0 });
    }
    g.globalAlpha = 1;
  }

  /* =====================================================================
     7. Eventos: estado, cartaz, chip, festa do fim
     ===================================================================== */
  const ACT = {};          // id -> c (evento rodando ou fazendo a festa do fim)
  const REC = {};          // o que a arte viu nesta sessão (fallback do Livro): {seen, best, bestTxt}
  let lastTickT = -1;
  function start(id, ctx) {
    const d = DEF(id); if (!d) return null;
    if (ACT[id] && ACT[id].phase === 'run') return ACT[id];
    ctx = ctx || {};
    const c = { id, d, ctx, dur: ctx.dur || d.dur, t: 0, left: ctx.dur || d.dur, synced: false, phase: 'run', endT: 0, res: null, items: [], n: 0, got: 0, seed: (Math.random() * 1e6) | 0, loops: [] };
    ACT[id] = c;
    try { MOD[id].start(c); } catch (e) { if (window.console) console.warn('[kome] eventos-arte start', id, e); }
    sfx('ev-ini-' + id);
    return c;
  }
  function on(id, left, k) {
    let c = ACT[id];
    if (!c || c.phase !== 'run') { if (!(left > 0)) return; c = start(id, { dur: k > 0 && k < 1 ? left / (1 - k) : left }); if (!c) return; }
    c.synced = true;
    if (left >= 0) { c.left = left; c.t = c.dur - left; }
  }
  function resOf(r, c) {
    if (r === undefined || r === null) return { txt: '', sub: '' };
    if (typeof r === 'number') return { v: r, txt: fmtY(r), sub: '' };
    if (typeof r === 'string') return { txt: r, sub: '' };
    return { v: r.v, txt: r.txt || (r.v !== undefined ? fmtY(r.v) : ''), sub: r.sub || '' };
  }
  function end(id, ctx, result) {
    const c = ACT[id]; if (!c || c.phase !== 'run') return;
    c.phase = 'end'; c.endT = 0; c.res = resOf(result, c);
    if (ctx && typeof ctx === 'object' && ctx !== c.ctx) Object.assign(c.ctx, ctx);
    try { MOD[id].end(c); } catch (e) { /* */ }
    c.loops.forEach(stopLoop); c.loops.length = 0;
    musicPop(id);
    sfx('ev-fim');
    // confete dos dois lados + moedas
    for (let s = 0; s < 2; s++) for (let i = 0; i < 40; i++) part(4, s ? SW + 10 : -10, SH * 0.7, (s ? -1 : 1) * lerp(160, 520, Math.random()), -lerp(250, 620, Math.random()), 2.6, CONF[i % CONF.length], 9, 520);
    const r = REC[id] || (REC[id] = { seen: 0, best: 0, bestTxt: '' }); r.seen++;
    if (c.res.v !== undefined ? c.res.v > r.best : !r.bestTxt) { r.best = c.res.v || 0; r.bestTxt = c.res.txt; }
  }
  function tick(dt) {
    dt = Math.min(0.1, Math.max(0, dt || 0));
    hudMeasure();
    trigTick(dt);
    for (const id in ACT) {
      const c = ACT[id];
      if (c.phase === 'run') {
        if (!c.synced) { c.t += dt; c.left = Math.max(0, c.dur - c.t); }
        c.synced = false;
        try { MOD[id].tick(c, dt); } catch (e) { if (window.console) console.warn('[kome] eventos-arte tick', id, e); }
        if (c.t > c.dur + 6) end(id, null, null);      // segurança: o sistema esqueceu de chamar end -> a arte não fica presa
      } else {
        c.endT += dt;
        try { if (MOD[id].tickEnd) MOD[id].tickEnd(c, dt); } catch (e) { /* */ }
        if (c.endT >= EA.OUTRO) delete ACT[id];
      }
    }
    partsTick(dt); popsTick(dt);
  }
  // força geral do evento (entra em 0,6 s, sai na festa do fim)
  const fade = c => c.phase === 'run' ? Math.min(1, c.t / 0.6) : Math.max(0, 1 - c.endT / 0.9);

  // cartaz de entrada: lê em 1 segundo (ícone grande + nome + o que faz)
  function drawIntro(g, c, t) {
    if (c.phase !== 'run' || c.t > EA.INTRO) return;
    const d = c.d, q = c.t / EA.INTRO, kin = EZ.back(clamp(q / 0.14, 0, 1)), kout = q > 0.82 ? EZ.in((q - 0.82) / 0.18) : 0;
    const cx = SW / 2, cy = SH * 0.42 - kout * (SH * 0.42 - HUDY.top - 20), s = kin * (1 - kout * 0.7);
    if (s <= 0.01) return;
    g.save(); g.globalAlpha = 1 - kout;
    // faixa escura diagonal atrás (mangá)
    g.fillStyle = 'rgba(42,26,16,0.62)'; g.beginPath(); g.moveTo(0, cy - 62 * s); g.lineTo(SW, cy - 78 * s); g.lineTo(SW, cy + 58 * s); g.lineTo(0, cy + 74 * s); g.closePath(); g.fill();
    g.fillStyle = d.col; g.fillRect(0, cy - 66 * s - (cy > 0 ? 0 : 0), SW, 4 * s); g.fillRect(0, cy + 66 * s, SW, 4 * s);
    g.translate(cx, cy); g.scale(s, s);
    g.globalCompositeOperation = 'lighter'; g.save(); g.rotate(t * 0.5); g.globalAlpha = (1 - kout) * 0.55; blitC(g, raysImg(GOLD_G, 14), -230, 0, 0.9); g.restore(); g.globalCompositeOperation = 'source-over';
    blitC(g, medal(c.id, 44), -230, 0, 1);
    Draw.text(g, d.s + '!', 40, -14, { size: d.s.length > 12 ? 50 : 58, col: d.col === '#F3C94A' ? PAL.goldL : mix(d.col, '#FFFFFF', 0.35), sw: 12, shadow: 4 });
    Draw.text(g, d.fx + '  ·  ' + Math.round(c.dur) + ' s', 40, 36, { size: 24, col: PAL.cream, sw: 7 });
    g.restore();
  }
  // chip do evento rodando: ícone, nome, tempo que falta (barra), número do evento.
  // Lugar FIXO e pequeno: logo abaixo da fileira de cima do HUD (barra da Montanha), centralizado. Os eventos que
  // desenham coisa alta (Gigante) respeitam chipBottom() pra nunca ficar por baixo do chip.
  const CHIP_H = 28;
  const chipY = slot => HUDY.top - 2 + slot * (CHIP_H + 8);
  const chipBottom = () => { let n = 0; for (const id in ACT) if (ACT[id].phase === 'run') n++; return chipY(Math.max(1, n)) + 6; };
  function drawChip(g, c, t, slot) {
    if (c.phase !== 'run' || c.t < EA.INTRO * 0.85) return;
    const d = c.d, lab = MOD[c.id].label ? MOD[c.id].label(c) : d.s;
    g.font = '900 15px ' + Draw.FONT; const w = Math.max(210, Math.ceil(g.measureText(lab).width) + 96), h = CHIP_H, x = SW / 2 - w / 2, y = chipY(slot), k = EZ.back(clamp((c.t - EA.INTRO * 0.85) / 0.3, 0, 1));
    g.save(); g.translate(SW / 2, y + h / 2); g.scale(k, k); g.translate(-SW / 2, -(y + h / 2));
    const bt = beat(t, 120), pulse = c.id === 'frenesi' || c.id === 'festival' ? Math.pow(1 - bt, 3) : 0;
    pill(g, x, y, w, h, '#FFF6DE', 2.5);
    g.save(); rr(g, x, y, w, h, h / 2); g.clip();
    g.fillStyle = mix(d.col, '#FFFFFF', 0.55); g.fillRect(x, y + h - 6, w * clamp(c.left / c.dur, 0, 1), 6);
    g.fillStyle = d.col; g.fillRect(x, y + h - 6, w * clamp(c.left / c.dur, 0, 1), 3);
    g.restore();
    blitC(g, medal(c.id, 16), x + 16, y + h / 2, 1 + pulse * 0.12);
    Draw.text(g, lab, x + 38, y + h / 2 - 1, { size: 15, col: d.ink, sw: 0, align: 'left' });
    Draw.text(g, Math.ceil(c.left) + ' s', x + w - 12, y + h / 2 - 1, { size: 16, col: INK, sw: 0, align: 'right' });
    g.restore();
    if (d.badge && c.id !== 'chuva') {
      g.font = '900 18px ' + Draw.FONT;
      const bs = 1 + pulse * 0.12, bw = Math.ceil(g.measureText(d.badge).width) + 18, bx = x + w + 10 + bw / 2, by = y + h / 2;
      g.save(); g.translate(bx, by); g.scale(bs * k, bs * k);
      pill(g, -bw / 2, -12, bw, 24, d.col === '#F3C94A' ? '#8A5A12' : d.ink, 2);
      Draw.text(g, d.badge, 0, -1, { size: 17, col: PAL.goldL, sw: 0 });
      g.restore();
      if (c.id === 'frenesi') for (let i = 0; i < 3; i++) pixImg(g, flame(Math.floor(t * 10) + i), bx + bw / 2 + 12 + i * 12, by + 2 - pulse * 3, 2);
    }
  }
  // festa do fim: cartão com o resultado
  function drawOutro(g, c, t) {
    if (c.phase !== 'end') return;
    const d = c.d, q = c.endT, kin = EZ.back(clamp(q / 0.32, 0, 1)), kout = q > EA.OUTRO - 0.45 ? (q - (EA.OUTRO - 0.45)) / 0.45 : 0;
    const w = 470, h = c.res.sub ? 178 : 158, cx = SW / 2, cy = Math.max(SH * 0.42, HUDY.top + h / 2 + 24) - kout * 60, s = kin;
    g.save(); g.globalAlpha = 1 - kout; g.translate(cx, cy); g.scale(s, s);
    g.globalCompositeOperation = 'lighter'; g.save(); g.rotate(t * 0.35); g.globalAlpha = (1 - kout) * 0.5; blitC(g, raysImg(GOLD_G, 16), 0, 0, 1.9); g.restore(); g.globalCompositeOperation = 'source-over';
    g.fillStyle = INK; rr(g, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 22); g.fill();
    g.fillStyle = '#E9D6AE'; rr(g, -w / 2, -h / 2, w, h, 18); g.fill();
    g.fillStyle = '#FFF6DE'; rr(g, -w / 2, -h / 2, w, h - 6, 18); g.fill();
    g.save(); rr(g, -w / 2, -h / 2, w, h, 18); g.clip(); g.fillStyle = d.col; g.fillRect(-w / 2, -h / 2, w, 46); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-w / 2, -h / 2, w, 8); g.restore();
    g.fillStyle = INK; g.fillRect(-w / 2, -h / 2 + 46, w, 3);
    blitC(g, medal(c.id, 30), -w / 2 + 14, -h / 2 + 10, 1);
    Draw.text(g, d.fim, 16, -h / 2 + 24, { size: 26, col: '#FFFBEA', sw: 6 });
    const big = c.res.txt || 'Que festa!', bk = 1 + Math.max(0, 0.25 - Math.abs(q - 0.45)) * 1.2;
    Draw.text(g, big, 0, -h / 2 + 46 + 52, { size: (big.length > 16 ? 40 : 54) * bk, col: PAL.gold, sw: 11, shadow: 4 });
    if (c.res.sub) Draw.text(g, c.res.sub, 0, h / 2 - 26, { size: 19, col: INK, sw: 0 });
    g.restore();
    if (q < 1.3 && Math.random() < 0.7) part(3, cx + (Math.random() - 0.5) * w, -20, (Math.random() - 0.5) * 60, 120 + Math.random() * 120, 2.2, '#000', 1, 380);
  }

  /* =====================================================================
     8. Os 6 eventos (MOD[id] = start, tick, world, screen, end, label)
     ===================================================================== */
  const MOD = {};
  function heapY(wx) { const h = G.heap; return h && h.surf ? h.surf(wx) : 0; }
  function groundScreenY(sx, fallback) {
    const cam = CAM(); if (!cam || !cam.toWorld) return fallback;
    const w = cam.toWorld(sx, SH * 0.5, tmpP).x, y = (heapY(w - 14) + heapY(w) + heapY(w + 14)) / 3;
    cam.toScreen(w, y, tmpP); return tmpP.y;
  }
  function collectorScreen(out) {
    const cam = CAM(), S = GS();
    if (cam && S && S.col) { cam.toScreen(S.col.x, S.col.y - 20, out); if (out.x > 20 && out.x < SW - 20 && out.y > 20 && out.y < SH - 20) return out; }
    out.x = 44; out.y = HUDY.bot - 40; return out;
  }

  /* ---------------- FRENESI: tudo brilha dourado, linhas de velocidade, labaredas, música acelera ---------------- */
  let vigC = null, vigKey = '';
  function vignette(W, H) {
    const key = W + 'x' + H + '@' + DPR; if (vigC && vigKey === key) return vigC;
    const k = 0.5, c = mkc(W * k, H * k), g = c.getContext('2d');
    const gr = g.createRadialGradient(W * k / 2, H * k / 2, H * k * 0.25, W * k / 2, H * k / 2, Math.hypot(W, H) * k * 0.55);
    gr.addColorStop(0, 'rgba(255,200,80,0)'); gr.addColorStop(0.6, 'rgba(255,190,70,0.25)'); gr.addColorStop(1, 'rgba(255,170,40,0.85)');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    vigC = c; vigKey = key; return c;
  }
  MOD.frenesi = {
    start(c) { musicPush('frenesi', 'ev-frenesi', th => Object.assign({}, th, { label: 'Frenesi', bpm: Math.round((th.bpm || 90) * EA.FREN_BPM), dens: 0.95, fills: 0.7, lift: 0.08 })); },
    tick(c, dt) {
      const f = fade(c);
      if (Math.random() < dt * 26 * f) part(1, Math.random() * SW, SH + 10, (Math.random() - 0.5) * 30, -lerp(80, 220, Math.random()), 2.6, Math.random() < 0.5 ? PAL.goldL : '#FFFFFF', lerp(3, 7, Math.random()), -20);
    },
    end() {},
    label: c => 'FRENESI DO SHIBA',
    world(g, c, v, t) {
      const P = G.P, cam = CAM(); if (!P || !cam) return;
      const f = fade(c), s = 2.6 / cam.z;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = f * (0.5 + 0.2 * Math.sin(t * 9));
      blitC(g, glowImg(GOLD_G), P.x, P.y - 24 / cam.z, s); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    },
    screen(g, c, t) {
      const f = fade(c); if (f <= 0) return;
      const bt = beat(t, 140), pulse = Math.pow(1 - bt, 2.5);
      // 1) mundo dourado
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.6 * f; g.fillStyle = '#FFC640'; g.fillRect(0, 0, SW, SH);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = f * (0.42 + 0.22 * pulse); g.drawImage(vignette(SW, SH), 0, 0, SW, SH);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      // 2) linhas de velocidade (só nas bordas, trocam 14× por segundo)
      const seed = Math.floor(t * 14), cx = SW / 2, cy = SH * 0.5, Rr = Math.hypot(SW, SH) * 0.62;
      g.fillStyle = '#FFFDF0'; g.globalAlpha = 0.85 * f; g.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = hash(seed * 31 + i) * TAU, r0 = Rr * lerp(0.42, 0.7, hash(seed * 7 + i)), wd = lerp(0.006, 0.02, hash(i + seed));
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7);
        g.lineTo(cx + Math.cos(a - wd) * Rr * 1.2, cy + Math.sin(a - wd) * Rr * 0.84); g.lineTo(cx + Math.cos(a + wd) * Rr * 1.2, cy + Math.sin(a + wd) * Rr * 0.84); g.closePath();
      }
      g.fill(); g.globalAlpha = 1;
      // 3) labaredas no pé da tela (entre os botões do HUD)
      const fy = HUDY.bot + 10, fs = 3;
      g.globalAlpha = 0.85 * f;
      for (let i = 0, x = -10; x < SW + 30; i++, x += 46) { const hh = 0.7 + 0.35 * Math.sin(t * 7 + i * 1.7) + 0.3 * pulse + (i % 3 === 1 ? 0.35 : 0); const fl = flame(Math.floor(t * 12) + i); g.imageSmoothingEnabled = false; g.drawImage(fl, x - fl.width * fs / 2, fy - fl.height * fs * hh, fl.width * fs, fl.height * fs * hh); }
      g.globalAlpha = 1;
      partsDraw(g);
    },
  };

  /* ---------------- CHUVA DE ARROZ: grãos e onigiris do céu; tocar coleta; o resto vai pro coletor pela metade ---------------- */
  MOD.chuva = {
    start(c) {
      c.plan = []; c.weight = 0; const n = EA.RAIN_ITEMS, span = c.dur * 0.8;
      for (let i = 0; i < n; i++) { const oni = i % EA.RAIN_ONI_EVERY === 2, w = oni ? 3 : 1; c.plan.push({ at: 0.4 + i * span / n + hash(c.seed + i) * 0.3, kind: oni ? 'oni' : 'grao', w, x: lerp(0.08, 0.92, hash(c.seed + i * 13)) }); c.weight += w; }
      c.next = 0; c.landed = 0;
      c.loops.push(loop('rice', 0.45));
    },
    tick(c, dt) {
      while (c.next < c.plan.length && c.plan[c.next].at <= c.t) { const p = c.plan[c.next++]; c.items.push({ kind: p.kind, w: p.w, x: p.x * SW, y: -40, vy: lerp(110, 150, Math.random()), ph: Math.random() * TAU, st: 0, a: 0, sx: 0, sy: 0 }); }
      const gy = HUDY.bot - 14;
      for (let i = c.items.length - 1; i >= 0; i--) {
        const it = c.items[i];
        if (it.st === 0) { it.vy = Math.min(190, it.vy + 22 * dt); it.y += it.vy * dt; if (it.y >= gy) { it.st = 2; it.a = 0; it.x0 = it.x + Math.sin(c.t * 2 + it.ph) * 18; it.y0 = gy; c.landed++; sfx('ev-plop'); burst(2, it.x0, gy, 5, 40, 120, 0.5, ['#000'], 1, 400, 2.4); if (c.ctx.onLand) { try { c.ctx.onLand(it); } catch (e) { /* */ } } } }
        else if (it.st === 1) { it.a += dt / 0.4; if (it.a >= 1) c.items.splice(i, 1); }
        else if (it.st === 2) { it.a += dt / 0.75; if (it.a >= 1) c.items.splice(i, 1); }
      }
    },
    end(c) { for (const it of c.items) if (it.st === 0) { it.st = 2; it.a = 0; it.x0 = it.x; it.y0 = it.y; if (c.ctx.onLand) { try { c.ctx.onLand(it); } catch (e) { /* */ } } } },
    tickEnd(c, dt) { this.tick(Object.assign(c, { plan: c.plan, next: c.plan.length }), dt); },
    label: c => 'CHUVA  ·  pegou ' + c.got,
    tap(c, sx, sy) {
      for (let i = c.items.length - 1; i >= 0; i--) {
        const it = c.items[i]; if (it.st !== 0) continue;
        if (Math.hypot(sx - it.sx, sy - it.sy) < (it.kind === 'oni' ? 52 : 44) * MOBK) {
          it.st = 1; it.a = 0; c.got++; sfx('ev-grao');
          burst(2, it.sx, it.sy, it.kind === 'oni' ? 16 : 9, 60, 220, 0.6, ['#000'], 1, 300);
          burst(1, it.sx, it.sy, 5, 40, 140, 0.5, [PAL.goldL, '#FFFFFF'], 5, 0);
          return it;
        }
      }
      return null;
    },
    screen(g, c, t) {
      const f = fade(c); if (f <= 0) return;
      // céu claro e nuvens de arroz no topo
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.45 * f; g.fillStyle = '#FFF4D6'; g.fillRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over';
      const cl = cloudTile('rice'), off = (t * 18) % cl.w;
      g.globalAlpha = f; for (let x = -off; x < SW; x += cl.w) blit(g, cl, x, -92 + 50 * f);
      g.globalAlpha = 1;
      // grãos de enfeite (procedurais, sem alocar)
      g.globalAlpha = f; g.beginPath();
      for (let i = 0; i < EA.RAIN_GRAINS; i++) {
        const sp = 150 + hash(i) * 120, y = ((t * sp + hash(i * 3) * (SH + 60)) % (SH + 60)) - 30, x = (hash(i * 7) * (SW + 40) + Math.sin(t * 0.8 + i) * 14) % (SW + 40) - 20;
        if (y < 30 * f - 10) continue;
        const r = hash(i * 5) * 3 + t * (hash(i) - 0.5) * 4, k = 0.8 + hash(i * 9) * 0.5;
        g.moveTo(x + Math.cos(r) * 4.5 * k, y + Math.sin(r) * 4.5 * k); g.ellipse(x, y, 4.5 * k, 2.2 * k, r, 0, TAU);
      }
      g.fillStyle = '#FFFDF6'; g.fill(); g.strokeStyle = 'rgba(59,40,24,0.75)'; g.lineWidth = 1.2; g.stroke();
      g.globalAlpha = 1;
      // itens tocáveis
      const col = collectorScreen(tmpP), cx = col.x, cy = col.y;
      for (const it of c.items) {
        let x, y, s = 1, a = 1;
        if (it.st === 0) { x = it.x + Math.sin(c.t * 2 + it.ph) * 18; y = it.y; }
        else if (it.st === 1) { x = it.sx; y = it.sy; s = 1 + it.a * 0.9; a = 1 - it.a; }
        else { const q = EZ.inOut(it.a); x = lerp(it.x0, cx, q); y = lerp(it.y0, cy, q) - Math.sin(q * Math.PI) * 90; s = 1 - q * 0.55; }
        it.sx = x; it.sy = y;
        g.globalAlpha = a;
        if (it.st === 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + 0.25 * Math.sin(t * 7 + it.ph); blitC(g, glowImg(WHITE_G), x, y, it.kind === 'oni' ? 0.75 : 0.55); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
        if (it.kind === 'oni') pixImg(g, oniCv(), x, y, Math.round(3.4 * s * MOBK * 2) / 2); else { g.save(); g.translate(x, y); g.rotate(Math.sin(t * 3 + it.ph) * 0.5); pixImg(g, goldGrain(), 0, 0, Math.round(4 * s * MOBK * 2) / 2); g.restore(); }
        if (it.st === 2 && it.a < 0.9) Draw.text(g, '½', x + 16, y - 14, { size: 18, col: PAL.cream, sw: 5, alpha: 1 - it.a });
      }
      g.globalAlpha = 1;
      // dica no começo: aponta o primeiro item
      if (c.phase === 'run' && c.got === 0 && c.t > EA.INTRO * 0.8 && c.t < 6) {
        const it = c.items.find(q => q.st === 0 && q.y > 60);
        if (it) { const b = Math.sin(t * 8) * 4; Draw.text(g, 'TOQUE!', it.sx, it.sy - 44 + b, { size: 24, col: PAL.goldL, sw: 7 }); }
      }
      partsDraw(g);
    },
  };

  /* ---------------- KOME GIGANTE: o Kome cresce e pisa na montanha; cada patada treme a tela ---------------- */
  MOD.gigante = {
    start(c) {
      const P = G.P; c.ax = P ? P.x : (CAM() ? CAM().x : 0); c.lastN = -1; c.n = 0; c.sq = 0; c.grow = 0; c.x = c.ax; c.face = 1;
      const S = GS(); c.pal = (S && S.look && S.look.pal) || 'kome';
    },
    tick(c, dt) {
      const B = EA.GIANT_BEAT, g0 = 1.0, tt = c.t - g0;
      c.grow = clamp(c.t / g0, 0, 1);
      c.sq = Math.max(0, c.sq - dt * 1.6);
      if (tt < 0) return;
      const n = Math.floor(tt / B), u = (tt / B) % 1;
      if (u >= 0.86 && n !== c.lastN && c.t < c.dur - 0.5) {
        c.lastN = n; c.n++; c.sq = 0.22;
        const cam = CAM(), S = GS();
        if (cam && S && S.opts && S.opts.shake !== false) { cam.addTrauma && cam.addTrauma(0.5); cam.punch && cam.punch(0.025); }
        sfx('stomp', { pitch: 0.75 }); sfx('crash', { pitch: 0.6, vol: 0.5 });
        if (cam) {
          cam.toScreen(c.x, heapY(c.x), tmpP); const fx = tmpP.x, fy = Math.min(tmpP.y, HUDY.bot - 4);
          c.fx = fx; c.fy = fy; c.ring = 0;
          for (let i = 0; i < 16; i++) { const s = i % 2 ? 1 : -1; part(6, fx + s * lerp(10, 60, Math.random()), fy - 6, s * lerp(80, 280, Math.random()), -lerp(10, 90, Math.random()), 0.9, i % 3 ? PAL.riceS : '#E9D7B0', lerp(8, 16, Math.random()), 120); }
          burst(7, fx, fy - 10, 22, 120, 420, 1.1, [PAL.rice, PAL.riceS, PAL.rice], 5, 900, 2.2);
          const side = (n % 2 ? 1 : -1), half = EA.GIANT_H * SH * 0.42;
          pop(clamp(fx + side * (half + 70), 120, SW - 120), Math.max(HUDY.top + 130, fy - SH * 0.2), 'PATADA ×50!', true);
          if (c.ctx.onStomp) { try { c.ctx.onStomp(c.n, { x: c.x, y: heapY(c.x), sx: fx, sy: fy }); } catch (e) { /* */ } }
        }
      }
      if (c.ring !== undefined) c.ring += dt;
      // anda um pouquinho a cada patada, perto de onde o Kome está
      const P = G.P, cam = CAM(), vw = cam ? SW / cam.z : 600;
      if (P) c.ax = lerp(c.ax, P.x, Math.min(1, dt * 3));
      c.x = c.ax + Math.sin(n * 1.7) * 0.012 * vw;
    },
    end(c) { c.shrink = 0; const cam = CAM(); if (cam) { cam.toScreen(c.x, heapY(c.x), tmpP); for (let i = 0; i < 18; i++) part(6, tmpP.x + (Math.random() - 0.5) * 140, tmpP.y - Math.random() * SH * 0.4, (Math.random() - 0.5) * 160, -Math.random() * 80, 1, '#FFFFFF', 18, 0); } sfx('boing', { pitch: 1.5 }); },
    tickEnd(c, dt) { c.shrink = Math.min(1, (c.shrink || 0) + dt / 0.6); },
    label: c => 'KOME GIGANTE  ·  ' + c.n + (c.n === 1 ? ' patada' : ' patadas'),
    world(g, c, v, t) {
      const cam = CAM(); if (!cam) return;
      if (c.phase === 'end' && c.shrink >= 1) return;
      // altura: GIANT_H da tela, mas a cabeça (com o pulo) nunca passa por baixo do chip do evento
      const fy0 = heapY(c.x); cam.toScreen(c.x, fy0, tmpP);
      const jumpPx = 0.1 * SH, roomPx = tmpP.y - chipBottom() - 8 - jumpPx;
      const z = cam.z, full = Math.max(2.2 * 42 * z, Math.min(EA.GIANT_H * SH, roomPx)) / (42 * z), grow = c.phase === 'end' ? 1 - EZ.in(c.shrink) : EZ.back(c.grow), sc = lerp(1, full, grow);
      const B = EA.GIANT_BEAT, tt = c.t - 1.0, u = tt < 0 ? 0 : (tt / B) % 1;
      let pose = 'stand', hgt = 0, sq = -c.sq;
      if (c.phase === 'end') pose = 'surprise';
      else if (tt < 0) pose = 'surprise';
      else if (u < 0.36) pose = Math.floor(t * 1.5) % 2 ? 'stand' : 'wag';
      else if (u < 0.55) { pose = 'windup'; sq = 0.14 * Math.sin((u - 0.36) / 0.19 * Math.PI / 2); }
      else if (u < 0.86) { pose = 'jump'; hgt = Math.sin(Math.PI * (u - 0.55) / 0.31) * jumpPx / z; }
      else pose = 'stand';
      const fy = heapY(c.x);
      // sombra no chão
      g.fillStyle = 'rgba(40,20,8,' + (0.28 * (1 - Math.min(1, hgt / (0.2 * SH / z)) * 0.6)).toFixed(3) + ')';
      g.beginPath(); g.ellipse(c.x, fy, 15 * sc * (1 - hgt / (SH / z)), 3.4 * sc, 0, 0, TAU); g.fill();
      // nuvem de poeira em cima do Kome normal (o gigante É ele; o pequeno some no meio da poeira)
      this.dust(g, c, t, grow);
      shiba(g, c.x, fy - hgt, pose, t, sc, c.pal, c.face, sq);
      // brilho dourado em volta (lê como "evento" mesmo de longe)
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 * fade(c); blitC(g, glowImg(GOLD_G), c.x, fy - hgt - 22 * sc, sc * 0.75); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    },
    dust(g, c, t, k) {
      const P = G.P; if (!P || k <= 0.02) return;
      const px = P.x, py = P.y, base = 16 * k, n = 8, cols = [PAL.riceS, '#EFE3C6', '#FFFBEA'];
      // 3 passadas (contorno, sombra, corpo+luz) — mesmas regras da arte do jogo: #3B2818 e 3 tons
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + t * 0.6, w = 1 + 0.12 * Math.sin(t * 5 + i * 1.9), rx = Math.cos(a) * base * 0.95, ry = Math.sin(a) * base * 0.55;
          const r = (10 + 4 * hash(i)) * k * w, x = px + rx, y = py - 16 * k + ry;
          g.fillStyle = pass === 0 ? INK : cols[pass === 1 ? 0 : 1];
          g.beginPath(); g.arc(x - (pass === 2 ? r * 0.12 : 0), y - (pass === 2 ? r * 0.18 : 0), pass === 0 ? r + 1.6 : pass === 1 ? r : r * 0.78, 0, TAU); g.fill();
        }
        if (pass > 0) { g.fillStyle = pass === 1 ? cols[0] : cols[1]; g.beginPath(); g.ellipse(px, py - 16 * k, base * 0.95, base * 0.62, 0, 0, TAU); g.fill(); }
      }
      g.fillStyle = cols[2]; for (let i = 0; i < 5; i++) { const a = i * 1.3 + t * 0.6; g.beginPath(); g.arc(px + Math.cos(a) * base * 0.5 - 4 * k, py - 21 * k + Math.sin(a) * base * 0.3, 3.5 * k, 0, TAU); g.fill(); }
      // grãos voando da poeira
      g.fillStyle = PAL.riceD; for (let i = 0; i < 6; i++) { const q = (t * 1.4 + hash(i * 3)) % 1, a = hash(i * 7) * Math.PI + Math.PI; g.globalAlpha = 1 - q; g.fillRect(px + Math.cos(a) * base * (0.8 + q), py - 16 * k + Math.sin(a) * base * (0.5 + q * 0.8), 2.5, 1.5); }
      g.globalAlpha = 1;
    },
    screen(g, c, t) {
      if (c.ring !== undefined && c.ring < 0.6) {   // onda de choque no chão
        const q = c.ring / 0.6, r = 40 + q * SW * 0.4;
        g.globalAlpha = (1 - q) * 0.9; g.strokeStyle = INK; g.lineWidth = 7 * (1 - q) + 2; g.beginPath(); g.ellipse(c.fx, c.fy, r, r * 0.16, 0, 0, TAU); g.stroke();
        g.strokeStyle = '#FFF6DE'; g.lineWidth = 3.5 * (1 - q) + 1; g.stroke(); g.globalAlpha = 1;
      }
      partsDraw(g);
    },
  };

  /* ---------------- DESFILE DA FROTA: bandeiras, taiko, carro alegórico da turma, shibas marchando, confete ---------------- */
  MOD.desfile = {
    start(c) {
      const PA = G.PatioArt && G.PatioArt.PA;
      c.crew = c.ctx.crew || 'pata'; c.cn = c.ctx.n || 25;
      c.col = (PA && PA.COLORS && PA.COLORS[c.crew]) || '#D8574E';
      c.name = (PA && PA.NAMES && PA.NAMES[c.crew]) || 'TURMA DA ' + c.crew.toUpperCase();
      c.marchers = Math.min(EA.PARADE_CREW, Math.max(4, Math.floor(c.cn / 5)));
      c.len = 520 + c.marchers * 48 + 60; c.lastBeat = -1; c.hit = 0;
      c.loops.push(null);
    },
    tick(c, dt) {
      c.hit = Math.max(0, c.hit - dt * 5);
      const bi = Math.floor(c.t / 0.5);
      if (bi !== c.lastBeat) {
        c.lastBeat = bi; const head = this.head(c), dx = head - 150;
        if (dx > -60 && dx < SW + 60 && c.phase === 'run') { c.hit = 1; const pat = bi % 4; sfx('taiko', { vol: pat === 3 ? 0.5 : 0.8, pitch: pat === 3 ? 1.15 : 1 }); if (pat === 2) setTimeout(() => sfx('taiko', { vol: 0.5, pitch: 1.15 }), 125); }
        if (bi % 16 === 5 && c.phase === 'run') sfx('whistle', { pitch: 1.6, vol: 0.35 });
      }
      // confete jogado pelo carro alegórico
      const fx = this.head(c) - 330;
      if (fx > 0 && fx < SW && Math.random() < dt * 14) part(4, fx + (Math.random() - 0.5) * 120, this.gy(fx) - 150, (Math.random() - 0.5) * 200, -lerp(150, 340, Math.random()), 2.4, CONF[(Math.random() * CONF.length) | 0], 8, 330);
    },
    end() {},
    label: c => 'DESFILE  ·  ' + c.cn + ' na avenida',
    head(c) { return -60 + (SW + c.len + 80) * clamp(c.t / c.dur, 0, 1); },
    // avenida PLANA: chão do pátio (y=0 do mundo), passando na frente do pé da montanha; nunca atrás do HUD de baixo
    gy() { const cam = CAM(); let y = HUDY.bot - 4; if (cam && cam.toScreen) { cam.toScreen(0, 0, tmpP); y = Math.min(y, tmpP.y - 2); } return clamp(y, SH * 0.5, HUDY.bot - 4); },
    screen(g, c, t) {
      const f = c.phase === 'run' ? 1 : Math.max(0, 1 - c.endT / 0.6); if (f <= 0) return;
      const head = this.head(c), step = Math.floor(t * 4) % 2, bob = i => Math.abs(Math.sin(t * 6.3 + i * 0.9)) * 3, S = 1.25;
      const PA = G.PatioArt && G.PatioArt.PA, pal = crewPal(c.col);
      g.globalAlpha = f;
      const vis = x => x > -160 && x < SW + 160;
      // cauda: marchando (de trás pra frente pra sobrepor certo)
      for (let i = c.marchers - 1; i >= 0; i--) { const x = head - 530 - i * 48; if (!vis(x)) continue; const y = this.gy(x); shiba(g, x, y - bob(i), 'walk', t + i * 0.13, S, pal, 1); }
      // carro alegórico: ícone gigante da ferramenta + faixa com o nome da turma
      const fx = head - 330;
      if (vis(fx)) {
        const y = this.gy(fx), yb = y - 4;
        for (let k = 0; k < 2; k++) { const px = fx + 108 + k * 34; shiba(g, px, this.gy(px) - bob(k + 3), 'walk', t + k * 0.3, S, pal, 1); }
        g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(fx + 70, yb - 34); g.quadraticCurveTo(fx + 100, yb - 18, fx + 140, yb - 26); g.stroke();
        g.save(); g.translate(fx, yb);
        Draw.box(g, -90, -40, 180, 28, mix(c.col, '#2A1A10', 0.15), { ol: 2.2, top: mix(c.col, '#FFFFFF', 0.3) });
        for (let k = 0; k < 9; k++) Draw.circle(g, -82 + k * 20.5, -40, 7, k % 2 ? '#FFF6E6' : '#F29CB4', { ol: 1.5, hi: false, shade: false });
        for (const wx of [-60, 60]) Draw.circle(g, wx, -10, 13, PAL.woodD, { ol: 2 }), Draw.circle(g, wx, -10, 5, PAL.wood, { ol: 1.5, hi: false });
        const ic = G.Props && G.Props.icon ? G.Props.icon(c.crew) : null, wob = Math.sin(t * 3) * 0.06;
        g.save(); g.translate(0, -80 - bob(0)); g.rotate(wob); if (ic) pixImg(g, ic, 0, 0, 4.6); g.restore();
        g.restore();
        const sw = Math.min(250, c.name.length * 10 + 70);
        Draw.sign(g, fx - sw / 2, yb - 160, sw, 30, c.name + '  ×' + c.cn, { col: '#FFF6E6', ink: mix(c.col, '#2A1A10', 0.35) });
        g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(fx - sw / 2 + 12, yb - 130); g.lineTo(fx - 70, yb - 40); g.moveTo(fx + sw / 2 - 12, yb - 130); g.lineTo(fx + 70, yb - 40); g.stroke();
      }
      // taiko no carrinho com tocador
      const dx = head - 150;
      if (vis(dx)) {
        const y = this.gy(dx);
        g.save(); g.translate(dx, y - 5);
        drumCart(g, 0, 0, 1.15, t, c.hit);
        shiba(g, -44, -30, c.hit > 0.5 ? 'cheer' : 'windup', t, 1.1, pal, 1);
        g.restore();
        const pulled = dx + 74; shiba(g, pulled, this.gy(pulled) - bob(9), 'walk', t + 0.4, S, pal, 1);
      }
      // bandeiras na frente
      for (let k = 0; k < 2; k++) {
        const x = head - k * 66; if (!vis(x)) continue; const y = this.gy(x);
        nobori(g, x + 12, y - 16, 112, c.col, k ? 'KOME' : 'ARROZ', t, k * 2);
        shiba(g, x, y - bob(k + 5), 'walk', t + k * 0.21, S, pal, 1);
      }
      g.globalAlpha = 1;
      partsDraw(g);
    },
  };

  /* ---------------- TEMPESTADE DE SACOS DOURADOS: nuvens escuras, chuva, raio arranca saco dourado da montanha ---------------- */
  MOD.tempestade = {
    start(c) { c.next = EA.INTRO * 0.55; c.bolts = []; c.flash = 0; c.loops.push(loop('rain', 0.55), loop('wind', 0.25)); c.strikes = 0; },
    tick(c, dt) {
      c.flash = Math.max(0, c.flash - dt * 3.2);
      for (let i = c.bolts.length - 1; i >= 0; i--) { c.bolts[i].a -= dt * 2.6; if (c.bolts[i].a <= 0) c.bolts.splice(i, 1); }
      c.next -= dt;
      if (c.next <= 0 && c.t < c.dur - 1.5 && c.phase === 'run') { c.next = lerp(EA.STORM_GAP[0], EA.STORM_GAP[1], Math.random()); this.strike(c); }
      const cam = CAM(), z = cam ? cam.z : 1;
      for (const s of c.items) {
        if (s.st === 0) {   // voando pra fora da montanha (mundo)
          s.vy += 900 / z * dt; s.x += s.vx * dt; s.y += s.vy * dt;
          const gy = heapY(s.x); if (s.vy > 0 && s.y >= gy) { s.y = gy; if (s.bounce++ < 1) { s.vy *= -0.35; s.vx *= 0.5; } else { s.st = 3; s.vy = 0; sfx('thud', { vol: 0.4 }); } }
        } else if (s.st === 1 || s.st === 2) s.a += dt / (s.st === 1 ? 0.45 : 0.8);
      }
      for (let i = c.items.length - 1; i >= 0; i--) if ((c.items[i].st === 1 || c.items[i].st === 2) && c.items[i].a >= 1) c.items.splice(i, 1);
    },
    strike(c) {
      const cam = CAM(); if (!cam) return;
      const sx = lerp(SW * 0.16, SW * 0.86, Math.random()), wx = cam.toWorld(sx, SH * 0.5, tmpP).x, wy = heapY(wx);
      cam.toScreen(wx, wy, tmpP); const tx = tmpP.x, ty = Math.min(tmpP.y, HUDY.bot - 10), seed = Math.random() * 1000;
      const pts = boltPts(sx + (Math.random() - 0.5) * 80, 70, tx, ty, seed, 9), br = [];
      const bi = 3 + ((Math.random() * 3) | 0); br.push(boltPts(pts[bi][0], pts[bi][1], pts[bi][0] + (Math.random() < 0.5 ? -1 : 1) * 90, pts[bi][1] + 70, seed + 50, 4));
      c.bolts.push({ pts, br, a: 1 }); c.flash = 1; c.strikes++;
      const S = GS(); if (S && S.opts && S.opts.shake !== false && cam.addTrauma) cam.addTrauma(0.22);
      setTimeout(() => sfx('ev-trovao', { pitch: lerp(0.85, 1.15, Math.random()) }), 60 + Math.random() * 220);
      burst(5, tx, ty, 18, 120, 380, 0.6, [PAL.goldL, '#FFFFFF', '#FFD36B'], 2.5, 300, 2.6);
      burst(7, tx, ty - 6, 12, 80, 300, 0.9, [PAL.rice, PAL.riceS], 5, 900, 2.0);
      // o saco dourado pula da montanha (valor sorteado quando nasce: tamanho mostra)
      const z = cam.z, m = c.ctx.rollSack ? c.ctx.rollSack() : 1 + Math.floor(Math.random() * 7);
      c.items.push({ kind: 'saco', m, w: m, x: wx, y: wy - 6 / z, vx: (Math.random() - 0.5) * 260 / z, vy: -lerp(520, 720, Math.random()) / z, st: 0, a: 0, bounce: 0, sx: tx, sy: ty, ph: Math.random() * TAU });
    },
    end(c) {
      const col = collectorScreen(tmpP);
      for (const s of c.items) if (s.st === 0 || s.st === 3) { s.st = 2; s.a = 0; s.x0 = s.sx; s.y0 = s.sy; s.cx = col.x; s.cy = col.y; if (c.ctx.onLand) { try { c.ctx.onLand(s); } catch (e) { /* */ } } }
    },
    tickEnd(c, dt) { this.tick(c, dt); },
    label: c => 'TEMPESTADE  ·  ' + c.got + (c.got === 1 ? ' saco' : ' sacos'),
    tap(c, sx, sy) {
      for (let i = c.items.length - 1; i >= 0; i--) {
        const s = c.items[i]; if (s.st !== 0 && s.st !== 3) continue;
        if (Math.hypot(sx - s.sx, sy - s.sy) < (40 + s.m * 2) * MOBK) {
          s.st = 1; s.a = 0; c.got++; sfx('ev-saco');
          burst(3, s.sx, s.sy, 6 + s.m, 120, 300, 0.9, ['#000'], 1, 600, 2.2); burst(1, s.sx, s.sy, 8, 60, 200, 0.6, [PAL.goldL, '#FFFFFF'], 6, 0);
          return s;
        }
      }
      return null;
    },
    screen(g, c, t) {
      const f = fade(c); if (f <= 0) return;
      // céu escurece (multiply) e topo com nuvens pesadas
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.62 * f; g.fillStyle = '#7D86A8'; g.fillRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over';
      const gr = g.createLinearGradient(0, 0, 0, SH * 0.5); gr.addColorStop(0, 'rgba(30,34,58,' + (0.55 * f).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(30,34,58,0)');
      g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, 0, SW, SH * 0.5);
      // flash do raio
      if (c.flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = c.flash * 0.35; g.fillStyle = '#E8ECFF'; g.fillRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
      // chuva (um traço só pra todas as gotas)
      g.strokeStyle = 'rgba(200,215,245,0.55)'; g.lineWidth = 1.6; g.globalAlpha = f; g.beginPath();
      for (let i = 0; i < EA.STORM_DROPS; i++) { const sp = 700 + hash(i) * 400, y = ((t * sp + hash(i * 5) * (SH + 60)) % (SH + 60)) - 30, x = (hash(i * 11) * (SW + 160) - y * 0.22 - t * 40) % (SW + 160); const xx = x < -80 ? x + SW + 160 : x; g.moveTo(xx, y); g.lineTo(xx - 5, y + 20); }
      g.stroke();
      // respingos no chão
      g.fillStyle = 'rgba(220,230,255,0.6)';
      for (let i = 0; i < 26; i++) { const ph = (t * 2.2 + hash(i * 9)) % 1, x = hash(i * 17 + Math.floor(t * 2.2 + hash(i * 9))) * SW, y = HUDY.bot - 4; g.globalAlpha = f * (1 - ph); g.fillRect(x - 6 * ph, y - 6 * ph, 2, 2); g.fillRect(x + 6 * ph, y - 6 * ph, 2, 2); }
      g.globalAlpha = 1;
      // raios
      for (const b of c.bolts) { drawBolt(g, b.pts, 5, Math.min(1, b.a * 1.4)); for (const p of b.br) drawBolt(g, p, 3, Math.min(1, b.a * 1.2)); }
      // nuvens por cima de tudo, descendo no começo
      const cl = cloudTile('storm'), off = (t * 26) % cl.w;
      for (let x = -off; x < SW; x += cl.w) blit(g, cl, x, -110 + 70 * f);
      const cl2 = off * 1.6 % cl.w; g.globalAlpha = 0.8; for (let x = -cl2 - 200; x < SW; x += cl.w) blit(g, cl, x, -128 + 60 * f, 0.9); g.globalAlpha = 1;
      // sacos dourados (posição do mundo -> tela, tamanho constante na tela)
      const cam = CAM();
      for (const s of c.items) {
        let x, y, sc = (2.2 + s.m * 0.16) * MOBK, a = 1;
        if (s.st === 0 || s.st === 3) { if (!cam) continue; cam.toScreen(s.x, s.y, tmpP); x = tmpP.x; y = Math.min(tmpP.y, HUDY.bot - 2); }
        else if (s.st === 1) { x = s.sx; y = s.sy; sc *= 1 + s.a; a = 1 - s.a; }
        else { const q = EZ.inOut(s.a); x = lerp(s.x0, s.cx, q); y = lerp(s.y0, s.cy, q) - Math.sin(q * Math.PI) * 80; sc *= 1 - q * 0.6; }
        if (s.st !== 1 && s.st !== 2) { s.sx = x; s.sy = y - 20; }
        g.globalAlpha = a;
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * (0.6 + 0.2 * Math.sin(t * 6 + s.ph)); blitC(g, glowImg(GOLD_G), x, y - 22, 0.45 + s.m * 0.05); g.globalCompositeOperation = 'source-over'; g.globalAlpha = a;
        const sk = sackCv(); if (sk) { const cv = sk.cv, w = cv.width * sc, h = cv.height * sc; g.imageSmoothingEnabled = false; g.drawImage(cv, Math.round(x - (sk.ax || cv.width / 2) * sc), Math.round(y - (sk.ay || cv.height) * sc), w, h); }
        if (s.st === 3 || s.st === 0) { const tw = (t * 1.5 + s.ph) % 1; if (tw < 0.25) { const q = tw / 0.25, px = x + 8 * sc, py = y - 14 * sc, ss = 6 * Math.sin(q * Math.PI); g.fillStyle = '#FFFFFF'; g.fillRect(px - ss, py - 1, ss * 2, 2); g.fillRect(px - 1, py - ss, 2, ss * 2); } }
      }
      g.globalAlpha = 1;
      partsDraw(g);
    },
  };

  const FW_LIFE = 1.9, FW_COLS = ['#FF6B5A', '#FFD34A', '#7FD8FF', '#B98CFF', '#7CF0A0', '#FF9AD0'];
  /* ---------------- FESTIVAL DAS LANTERNAS: entardecer, cordas de lanternas, barraquinhas, bon-odori, fogos e taiko ---------------- */
  MOD.festival = {
    start(c) {
      c.next = EA.INTRO * 0.6; c.shells = []; c.lastBeat = -1;
      c.loops.push(loop('crickets', 0.18));
      musicPush('festival', 'festa');
    },
    tick(c, dt) {
      c.next -= dt;
      if (c.next <= 0 && c.phase === 'run') {
        c.next = lerp(EA.FEST_FW[0], EA.FEST_FW[1], Math.random());
        c.shells.push({ x: lerp(SW * 0.12, SW * 0.88, Math.random()), y0: HUDY.bot, y1: lerp(HUDY.top + 70, SH * 0.42, Math.random()), t: 0, col: FW_COLS[(Math.random() * FW_COLS.length) | 0], kind: (Math.random() * 3) | 0 });
        sfx('ev-subida');
      }
      this.tickEnd(c, dt);
      for (let i = c.shells.length - 1; i >= 0; i--) {
        const s = c.shells[i]; s.t += dt;
        if (s.t >= 0.75) {
          c.shells.splice(i, 1); sfx('ev-fogos', { pitch: lerp(0.85, 1.2, Math.random()) });
          c.flashes = c.flashes || []; c.flashes.push({ x: s.x, y: s.y1, a: 1, col: s.col });
          c.fws = c.fws || []; if (c.fws.length > 6) c.fws.shift();
          c.fws.push({ x: s.x, y: s.y1, t: 0, col: s.col, kind: s.kind, r: lerp(78, 118, Math.random()) * (s.kind === 2 ? 0.8 : 1), rot: Math.random() * TAU, n: s.kind === 1 ? 20 : 28 });
          if (s.kind === 1) burst(1, s.x, s.y1, 10, 30, 120, 1.2, [PAL.goldL, '#FFFFFF'], 4, 30);
        }
      }
      // taiko: don · don · doko don
      const bi = Math.floor(c.t / 0.5);
      if (bi !== c.lastBeat && c.phase === 'run') { c.lastBeat = bi; const p = bi % 8; if (p === 0 || p === 2 || p === 4 || p === 6) sfx('taiko', { vol: p === 0 ? 0.85 : 0.55 }); if (p === 6) setTimeout(() => sfx('taiko', { vol: 0.5, pitch: 1.1 }), 125); }
    },
    tickEnd(c, dt) {
      if (c.flashes) for (let i = c.flashes.length - 1; i >= 0; i--) { c.flashes[i].a -= dt * 3; if (c.flashes[i].a <= 0) c.flashes.splice(i, 1); }
      if (c.fws) for (let i = c.fws.length - 1; i >= 0; i--) { c.fws[i].t += dt; if (c.fws[i].t >= FW_LIFE) c.fws.splice(i, 1); }
    },
    // estouro grande: raios com rastro (linha do centro até a ponta), cai com gravidade, ponta brilhante que pisca no fim
    fw(g, w) {
      const q = w.t / FW_LIFE, e = 1 - Math.pow(1 - Math.min(1, q * 1.7), 3), R = w.r * e, drop = q * q * 46, fadeA = q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45;
      const light = mix(w.col, '#FFFFFF', 0.55);
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < w.n; k++) {
        const a = w.rot + k / w.n * TAU, rk = R * (w.kind === 2 ? (k % 2 ? 1 : 0.62) : 1), ca = Math.cos(a), sa = Math.sin(a);
        const tx = w.x + ca * rk, ty = w.y + sa * rk + drop, tail = Math.min(rk, w.r * 0.55) * (0.35 + 0.65 * (1 - q));
        const bx = w.x + ca * (rk - tail), by = w.y + sa * (rk - tail) + drop * 0.6;
        g.globalAlpha = fadeA * 0.55; g.strokeStyle = w.col; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke();
        g.globalAlpha = fadeA; g.strokeStyle = light; g.lineWidth = 1.5; g.beginPath(); g.moveTo(lerp(bx, tx, 0.5), lerp(by, ty, 0.5)); g.lineTo(tx, ty); g.stroke();
        const tw = q > 0.6 ? (Math.sin(w.t * 40 + k * 2.3) > 0 ? 1 : 0.3) : 1, ps = k % 3 === 0 ? 5 : 4;
        g.globalAlpha = fadeA * tw; g.fillStyle = k % 3 === 0 ? '#FFF6DE' : light; g.fillRect(tx - ps / 2, ty - ps / 2, ps, ps);
        if (w.kind === 1 && q > 0.3) { g.fillStyle = PAL.goldL; g.fillRect(lerp(w.x, tx, 0.55) - 1.5, lerp(w.y, ty, 0.55) + drop * 0.3 - 1.5, 3, 3); }
      }
      if (q < 0.25) { g.globalAlpha = 1 - q / 0.25; g.fillStyle = '#FFFBEA'; g.beginPath(); g.arc(w.x, w.y, 10 + q * 40, 0, TAU); g.fill(); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    },
    end(c) { musicPop('festival'); },
    label: c => 'FESTIVAL  ·  tudo ×2',
    // chão das barraquinhas: o pátio (y=0 do mundo), com o balcão inteiro acima do HUD de baixo
    ground() { const cam = CAM(); let y = HUDY.bot - 10; if (cam && cam.toScreen) { cam.toScreen(0, 0, tmpP); y = Math.min(y, tmpP.y); } return clamp(y, SH * 0.55, HUDY.bot - 10); },
    screen(g, c, t) {
      const f = fade(c); if (f <= 0) return;
      // entardecer: tinta roxa quente e topo escuro
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.72 * f; g.fillStyle = '#A88CC4'; g.fillRect(0, 0, SW, SH); g.globalCompositeOperation = 'source-over';
      const gr = g.createLinearGradient(0, 0, 0, SH * 0.6); gr.addColorStop(0, 'rgba(34,20,64,' + (0.78 * f).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(40,24,70,0)');
      g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, 0, SW, SH * 0.6);
      // estrelinhas no céu escuro
      g.fillStyle = '#FFF6DE'; for (let i = 0; i < 30; i++) { g.globalAlpha = f * (0.3 + 0.5 * Math.abs(Math.sin(t * 1.3 + i * 2.1))); g.fillRect(hash(i * 3) * SW, hash(i * 5) * SH * 0.3, 2, 2); }
      g.globalAlpha = 1;
      // fogos (subindo + estouros)
      if (c.flashes) { g.globalCompositeOperation = 'lighter'; for (const fl of c.flashes) { g.globalAlpha = fl.a * 0.8; blitC(g, glowImg(WARM_G), fl.x, fl.y, 1.6); } g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
      if (c.fws) for (const w of c.fws) this.fw(g, w);
      for (const s of c.shells) {   // subindo: cabeça brilhante + rastro de faíscas que balança
        const q = EZ.out(s.t / 0.75), y = lerp(s.y0, s.y1, q), wob = Math.sin(s.t * 18) * 2;
        g.globalCompositeOperation = 'lighter';
        for (let k = 1; k < 9; k++) { g.globalAlpha = (1 - k / 9) * 0.7; g.fillStyle = k % 2 ? '#FFE9A0' : s.col; g.fillRect(s.x + wob * (k % 3 - 1) - 1, y + k * 6, 2.5, 3); }
        g.globalAlpha = 0.7; blitC(g, glowImg(WARM_G), s.x, y, 0.22);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#FFFBEA'; g.fillRect(s.x - 2, y - 2, 4, 6);
      }
      partsDraw(g);
      // lanternas flutuando (toro) subindo devagar
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) { const y = SH - ((t * (10 + hash(i) * 8) + hash(i * 3) * SH) % (SH + 40)), x = hash(i * 7) * SW + Math.sin(t * 0.6 + i) * 20; g.globalAlpha = f * 0.8; blitC(g, glowImg(WARM_G), x, y, 0.35); }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = f;
      for (let i = 0; i < 9; i++) { const y = SH - ((t * (10 + hash(i) * 8) + hash(i * 3) * SH) % (SH + 40)), x = hash(i * 7) * SW + Math.sin(t * 0.6 + i) * 20; g.fillStyle = INK; g.fillRect(x - 6, y - 7, 12, 14); g.fillStyle = '#FFD98A'; g.fillRect(x - 4, y - 5, 8, 10); g.fillStyle = '#FFF6DE'; g.fillRect(x - 2, y - 3, 4, 4); }
      // barraquinhas + vendedores + bon-odori no pé da tela
      const by = this.ground(), drop = (1 - f) * 120, n = SW < 1000 ? 3 : 4, gap = Math.min(178, (SW * 0.62) / n);
      for (let i = 0; i < n; i++) {
        const x = 6 + i * gap, y = by + drop;
        blit(g, stallBack(i), x, y - 140);
        shiba(g, x + 80, y - 32, i % 2 ? 'wave' : 'stand', t + i, 1.1, i % 3 === 0 ? 'goma' : i % 3 === 1 ? 'kome' : 'aka', 1);
        blit(g, stallFront(i), x, y - 140);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = f * 0.8; blitC(g, glowImg(WARM_G), x + 150, y - 100, 0.45); g.globalCompositeOperation = 'source-over'; g.globalAlpha = f;
        g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 150, y - 118); g.lineTo(x + 150, y - 110); g.stroke();
        pixImg(g, lantern(false), x + 150, y - 98, 2);
      }
      // bon-odori: 4 shibas dançando na frente
      for (let i = 0; i < 4; i++) { const x = 70 + i * gap * n / 4.3 + Math.sin(t * 0.8 + i) * 16, y = by + 6 + drop; shiba(g, x, y, Math.floor(t * 1.2 + i) % 2 ? 'dance' : 'dance2', t + i * 0.3, 1.3, ['kome', 'sakura', 'kuro', 'yuki'][i], i % 2 ? -1 : 1); }
      // cordas de lanternas no topo
      for (let r = 0; r < 2; r++) {
        const y0 = (r ? 18 : 6) - (1 - f) * 120, sag = r ? 46 : 62, n2 = EA.FEST_LANTERNS, xo = r ? SW / n2 / 2 : 0;
        g.strokeStyle = INK; g.lineWidth = 2; g.beginPath();
        for (let k = 0; k <= 40; k++) { const u = k / 40, x = -20 + u * (SW + 40), y = y0 + 4 * sag * u * (1 - u); if (k) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
        for (let k = 0; k < n2; k++) {
          const u = (k + 0.5) / n2, x = -20 + u * (SW + 40) + xo * 0, y = y0 + 4 * sag * u * (1 - u), sw = Math.sin(t * 1.6 + k + r) * 0.12, white = (k + r) % 2 === 1;
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = f * (0.55 + 0.1 * Math.sin(t * 3 + k)); blitC(g, glowImg(WARM_G), x, y + 26, 0.55); g.globalCompositeOperation = 'source-over'; g.globalAlpha = f;
          g.save(); g.translate(x, y); g.rotate(sw); pixImg(g, lantern(white), 0, 18, 2.5); g.restore();
        }
      }
      g.globalAlpha = 1;
    },
  };
  // mundo vazio por padrão
  for (const id of IDS) { MOD[id].world = MOD[id].world || null; }

  /* =====================================================================
     9. Desenho por quadro (mundo + tela) e toque
     ===================================================================== */
  const stats = { ms: 0, avg: 0, max: 0, n: 0, parts: 0 };
  function draw(g, view, t) {   // camada do MUNDO (dentro de cam.begin)
    for (const id in ACT) { const c = ACT[id], m = MOD[id]; if (m.world) { try { m.world(g, c, view, t); } catch (e) { /* */ } } }
  }
  function drawScreen(g, W, H, t) {   // camada da TELA (coords lógicas)
    SW = W || SW; SH = H || SH;
    const z0 = Draw.zoom, m0 = Draw.minPx; Draw.lod(1, 0);
    g.imageSmoothingEnabled = true; g.lineJoin = 'round'; g.lineCap = 'round';
    let slot = 0, any = false;
    for (const id of IDS) { const c = ACT[id]; if (!c) continue; any = true; try { MOD[id].screen(g, c, t); } catch (e) { if (window.console) console.warn('[kome] eventos-arte screen', id, e); } }
    if (!any && PS.length) partsDraw(g);
    for (let i = 0; i < TR.length; i++) { try { drawTrigger(g, TR[i], t); } catch (e) { /* */ } }
    for (const id of IDS) { const c = ACT[id]; if (!c) continue; drawChip(g, c, t, slot); if (c.phase === 'run' && c.t > EA.INTRO * 0.85) slot++; }
    for (const id of IDS) { const c = ACT[id]; if (c) { drawIntro(g, c, t); drawOutro(g, c, t); } }
    popsDraw(g);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    Draw.lod(z0, m0);
  }
  function tap(sx, sy) {
    for (const id of ['chuva', 'tempestade']) { const c = ACT[id]; if (c && c.phase === 'run' && MOD[id].tap) { const it = MOD[id].tap(c, sx, sy); if (it) return it; } }
    return null;
  }
  function busy() { for (const id in ACT) return true; return TR.length > 0 || PS.length > 0 || POPS.length > 0; }

  // gancho do game-world.js (camada da frente, depois do Kome): sem mexer no game.js
  let lastHookT = -1;
  if (G.World && G.World.layers) G.World.layers.front.push((g, v, t, S) => {
    if (!busy()) { lastHookT = -1; return; }
    const t0 = window.performance ? performance.now() : 0;
    try {
      const T = now(), dt = lastHookT < 0 ? 0.016 : Math.min(0.1, T - lastHookT); lastHookT = T;
      const K = window.__kome, paused = K && K.paused && K.paused();
      const cam = CAM(); if (cam) { SW = cam.vw || SW; SH = cam.vh || SH; }
      DPR = g.canvas && SW ? g.canvas.width / SW : 1;
      if (!EventArt.manual && !paused) tick(dt);
      draw(g, v, t);
      if (!EventArt.manual && !(G.World.layers.screen) && !paused) { g.save(); g.setTransform(DPR, 0, 0, DPR, 0, 0); drawScreen(g, SW, SH, t); g.restore(); }
    } catch (e) { if (window.console) console.warn('[kome] eventos-arte: erro no quadro', e); }
    const ms = (window.performance ? performance.now() : 0) - t0;
    stats.ms = ms; stats.n++; stats.avg += (ms - stats.avg) / Math.min(stats.n, 60); stats.max = Math.max(stats.max, ms); stats.parts = PS.length;
  });

  /* =====================================================================
     10. LIVRO DOS EVENTOS — tela própria (palco 960×540, por cima do jogo, como a Oficina)
     ===================================================================== */
  const BK = { root: null, stage: null, g: null, input: null, raf: 0, page: 0, flip: null, lastT: 0, t: 0, open: false, opens: 0, sil: {}, hover: -1, demo: null };
  const BW = 960, BH = 540;
  const BOOK = { x: 66, y: 50, w: 828, h: 462, gx: 480, pl: { x: 92, y: 66, w: 376, h: 426 }, pr: { x: 492, y: 66, w: 376, h: 426 } };
  function bookData() {
    const S = GS() || {}, out = {};
    let sys = null; try { if (G.Events && typeof G.Events.book === 'function') sys = G.Events.book(); } catch (e) { sys = null; }
    if (!sys && BK.demo) sys = BK.demo;
    let wsum = 0;
    for (const id of IDS) {
      const r = (sys && sys[id]) || (S.evBook && S.evBook[id]) || REC[id] || {};
      const st = S.stats && S.stats['evento_' + id];
      const seen = r.seen !== undefined ? r.seen : (st || (REC[id] ? REC[id].seen : 0));
      const best = r.bestTxt || (r.best ? fmtY(r.best) : (REC[id] && REC[id].bestTxt) || '');
      out[id] = { seen: seen | 0, best, locked: !!r.locked };
      if (!out[id].locked) wsum += DEF(id).w;
    }
    for (const id of IDS) {
      let ch = null; try { if (G.Events && typeof G.Events.chance === 'function') ch = G.Events.chance(id); } catch (e) { ch = null; }
      out[id].p = ch !== null && ch !== undefined ? ch : out[id].locked || !wsum ? 0 : DEF(id).w / wsum;
    }
    return out;
  }
  const pct = p => (Math.round(p * 1000) / 10).toString().replace('.', ',') + '%';
  const oneIn = p => p > 0 ? '1 em ' + (Math.round(10 / p) / 10).toString().replace('.', ',') : '—';

  function bookEnsure() {
    if (BK.root) return true;
    if (!E.Stage || !E.Input) return false;
    const root = document.createElement('div'); root.className = 'k-evbook';
    document.body.appendChild(root);
    const css = document.createElement('style');
    css.textContent = '.k-evbook{position:fixed;inset:0;z-index:57;background:#1c120b;display:none}.k-evbook.k-evbook-open{display:block}';
    document.head.appendChild(css);
    BK.root = root; BK.stage = E.Stage({ parent: root, width: BW, height: BH, bg: '#1c120b' }); BK.g = BK.stage.g; BK.input = E.Input(BK.stage);
    BK.input.on('down', (x, y) => bookTap(x, y));
    BK.input.on('move', (x, y) => { BK.hover = bookHit(x, y); });
    BK.input.on('key', code => { if (!BK.open) return; if (code === 'Escape') closeBook(); else if (code === 'ArrowRight' || code === 'KeyD') turn(1); else if (code === 'ArrowLeft' || code === 'KeyA') turn(-1); });
    return true;
  }
  // áreas de toque do Livro
  const B_CLOSE = { x: 916, y: 38, r: 30 }, B_PREV = { x: 38, y: 470, r: 30 }, B_NEXT = { x: 922, y: 470, r: 30 };
  const tabY = i => 92 + i * 64;
  function bookHit(x, y) {
    if (Math.hypot(x - B_CLOSE.x, y - B_CLOSE.y) < B_CLOSE.r + 8) return 'close';
    if (Math.hypot(x - B_PREV.x, y - B_PREV.y) < B_PREV.r + 8) return 'prev';
    if (Math.hypot(x - B_NEXT.x, y - B_NEXT.y) < B_NEXT.r + 8) return 'next';
    for (let i = 0; i < IDS.length; i++) if (x > 880 && x < 950 && y > tabY(i) - 28 && y < tabY(i) + 28) return 'tab' + i;
    return -1;
  }
  function bookTap(x, y) {
    if (!BK.open) return;
    const h = bookHit(x, y);
    if (h === 'close') closeBook();
    else if (h === 'prev') turn(-1);
    else if (h === 'next') turn(1);
    else if (typeof h === 'string' && h.indexOf('tab') === 0) goPage(+h.slice(3));
  }
  function goPage(i) { i = clamp(i | 0, 0, IDS.length - 1); if (i === BK.page || BK.flip) return; BK.flip = { from: BK.page, to: i, t: 0 }; sfx('ev-pagina'); }
  function turn(d) { const i = BK.page + d; if (i < 0 || i >= IDS.length) return; goPage(i); }

  function openBook(id) {
    if (!bookEnsure()) return false;
    const i = IDS.indexOf(id); BK.page = i >= 0 ? i : BK.page || 0; BK.flip = null; BK.t = 0;
    BK.root.classList.add('k-evbook-open'); BK.stage.resize(); BK.open = true; BK.opens++; BK.lastT = 0;
    if (!BK.raf) BK.raf = requestAnimationFrame(bookFrame);
    sfx('whoosh', { pitch: 1.2, vol: 0.5 }); sfx('ev-pagina');
    return true;
  }
  function closeBook() { if (!BK.open) return; BK.open = false; BK.root.classList.remove('k-evbook-open'); sfx('click'); }
  function bookFrame() {
    if (!BK.open) { BK.raf = 0; return; }
    const T = now(), dt = BK.lastT ? Math.min(0.1, T - BK.lastT) : 0.016; BK.lastT = T;
    try { bookRender(dt); } catch (e) { if (window.console) console.warn('[kome] Livro dos Eventos: erro no quadro', e); closeBook(); return; }
    BK.raf = requestAnimationFrame(bookFrame);
  }

  /* ---- ilustrações do Livro (cena pequena por evento; mesmas peças dos eventos) ---- */
  let SIL = false;
  const sky = (g, w, h, a, b) => { if (SIL) return; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
  const VIG = {
    frenesi(g, w, h, t) {
      sky(g, w, h, '#FFE08A', '#FFB347');
      if (!SIL) { g.globalCompositeOperation = 'lighter'; g.save(); g.translate(w * 0.5, h * 0.55); g.rotate(t * 0.4); g.globalAlpha = 0.6; blitC(g, raysImg(GOLD_G, 14), 0, 0, 1.6); g.restore(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
      riceHill(g, w * 0.52, h * 0.86, w * 0.6, h * 0.3);
      if (!SIL) { g.fillStyle = '#7F9E5C'; g.fillRect(0, h * 0.84, w, h * 0.16); g.fillStyle = INK; g.fillRect(0, h * 0.84, w, 2); }
      g.fillStyle = '#FFFBEA'; const seed = Math.floor(t * 12); for (let i = 0; i < 12; i++) { const y = h * (0.35 + 0.45 * hash(seed + i)), x = w * 0.08 + hash(i * 3 + seed) * w * 0.25; g.fillRect(x, y, 40 + hash(i) * 50, 3); }
      for (let i = 0; i < 6; i++) pixImg(g, flame(Math.floor(t * 10) + i), w * 0.12 + i * 18, h * 0.84 - 10, 2);
      shiba(g, w * 0.4, h * 0.84 + Math.abs(Math.sin(t * 12)) * -4, 'run', t, 3.2, 'kome', 1);
      // três cafés voando
      for (let k = 0; k < 3; k++) { const x = w * (0.62 + k * 0.1), y = h * (0.28 + 0.05 * Math.sin(t * 3 + k)); Draw.box(g, x - 9, y - 10, 18, 20, '#FFF6E6', { ol: 1.6, r: 3 }); g.fillStyle = '#6B3E1E'; g.fillRect(x - 7, y - 8, 14, 4); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(x + 11, y, 5, -1.2, 1.2); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.moveTo(x - 3, y - 14); g.quadraticCurveTo(x + 2 + Math.sin(t * 4 + k) * 3, y - 20, x - 2, y - 26); g.stroke(); }
      Draw.text(g, '×7', w * 0.84, h * 0.58, { size: 44, col: PAL.goldL, sw: 9 });
    },
    chuva(g, w, h, t) {
      sky(g, w, h, '#CFE9F5', '#FFF6DE');
      if (!SIL) { const cl = cloudTile('rice'); blit(g, cl, -((t * 14) % cl.w), -70, 1); blit(g, cl, cl.w - ((t * 14) % cl.w), -70, 1); }
      if (!SIL) { g.fillStyle = '#7F9E5C'; g.fillRect(0, h * 0.84, w, h * 0.16); g.fillStyle = INK; g.fillRect(0, h * 0.84, w, 2); }
      for (let i = 0; i < 40; i++) { const y = ((t * (90 + hash(i) * 60) + hash(i * 3) * h) % h), x = hash(i * 7) * w; if (y < 40) continue; const gc = grain(i); g.imageSmoothingEnabled = false; g.drawImage(gc, x, y, gc.width * 2, gc.height * 2); }
      pixImg(g, oniCv(), w * 0.72, 60 + ((t * 40) % (h * 0.6)), 3);
      shiba(g, w * 0.42, h * 0.84, 'cheer', t, 3.2, 'kome', 1);
      // tigela azul
      g.save(); g.translate(w * 0.24, h * 0.84); Draw.poly(g, [[-26, -22], [26, -22], [18, 0], [-18, 0]], PAL.bowl, { ol: 2 }); g.fillStyle = PAL.rice; g.beginPath(); g.ellipse(0, -22, 26, 7, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); g.restore();
    },
    gigante(g, w, h, t) {
      sky(g, w, h, '#9FD3E8', '#FBE8C8');
      riceHill(g, w * 0.38, h * 0.88, w * 0.7, h * 0.28);
      if (!SIL) { g.fillStyle = '#7F9E5C'; g.fillRect(0, h * 0.86, w, h * 0.14); g.fillStyle = INK; g.fillRect(0, h * 0.86, w, 2); }
      // casinhas e árvores pequenas (escala)
      for (let k = 0; k < 3; k++) { const x = w * (0.06 + k * 0.1); Draw.box(g, x, h * 0.86 - 14, 18, 14, '#F1E3C2', { ol: 1.4 }); Draw.poly(g, [[x - 3, h * 0.86 - 14], [x + 9, h * 0.86 - 24], [x + 21, h * 0.86 - 14]], PAL.red, { ol: 1.4 }); }
      const u = (t / 1.3) % 1, jump = u > 0.55 && u < 0.86 ? Math.sin(Math.PI * (u - 0.55) / 0.31) * 26 : 0, land = u > 0.86 ? 1 - (u - 0.86) / 0.14 : 0;
      shiba(g, w * 0.62, h * 0.86 - jump, u > 0.55 && u < 0.86 ? 'jump' : u > 0.36 && u <= 0.55 ? 'windup' : 'stand', t, 5.2, 'kome', -1, -land * 0.15);
      if (land > 0) { g.globalAlpha = land; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.ellipse(w * 0.62, h * 0.86, 60 + (1 - land) * 80, 10, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; }
      Draw.text(g, '×50', w * 0.18, h * 0.3, { size: 40, col: PAL.goldL, sw: 9 });
    },
    desfile(g, w, h, t) {
      sky(g, w, h, '#9FD3E8', '#FBE8C8');
      if (!SIL) { g.fillStyle = '#C9B48A'; g.fillRect(0, h * 0.8, w, h * 0.2); g.fillStyle = INK; g.fillRect(0, h * 0.8, w, 2); }
      for (let i = 0; i < 26; i++) { const y = ((t * 50 + hash(i) * h) % h), x = hash(i * 5) * w; g.fillStyle = CONF[i % CONF.length]; g.fillRect(x, y, 6, 3 + 2 * Math.abs(Math.sin(t * 5 + i))); }
      const off = (t * 26) % 60, col = '#D8574E', pal = crewPal(col);
      drumCart(g, w * 0.66 + off * 0.3, h * 0.8, 1, t, Math.pow(1 - ((t * 2) % 1), 3));
      shiba(g, w * 0.66 + off * 0.3 - 40, h * 0.8 - 28, Math.floor(t * 2) % 2 ? 'cheer' : 'windup', t, 1.1, pal, 1);
      for (let k = 0; k < 3; k++) { const x = w * 0.38 - k * 52 + off * 0.3; nobori(g, x + 10, h * 0.8 - 14, 96, col, k === 1 ? 'KOME' : 'ARROZ', t, k); shiba(g, x, h * 0.8 - Math.abs(Math.sin(t * 6 + k)) * 3, 'walk', t + k * 0.2, 1.5, pal, 1); }
    },
    tempestade(g, w, h, t) {
      sky(g, w, h, '#2C3150', '#6A6F8E');
      const fl = (t % 2.2) < 0.18 && !SIL; if (fl) { g.fillStyle = 'rgba(230,236,255,0.35)'; g.fillRect(0, 0, w, h); }
      riceHill(g, w * 0.3, h * 0.88, w * 0.75, h * 0.28);
      if (!SIL) { g.fillStyle = '#4E6A3A'; g.fillRect(0, h * 0.86, w, h * 0.14); g.fillStyle = INK; g.fillRect(0, h * 0.86, w, 2); }
      g.strokeStyle = 'rgba(200,215,245,0.6)'; g.lineWidth = 1.4; g.beginPath(); for (let i = 0; i < 50; i++) { const y = ((t * 500 + hash(i) * h) % h), x = hash(i * 3) * w; g.moveTo(x, y); g.lineTo(x - 4, y + 14); } g.stroke();
      if ((t % 2.2) < 0.4) { const a = 1 - (t % 2.2) / 0.4; drawBolt(g, boltPts(w * 0.55, 30, w * 0.66, h * 0.6, 7, 7), 4, a); }
      const u = (t % 2.2) / 2.2, sx = w * 0.66 + u * 60, sy = h * 0.6 - Math.sin(Math.min(1, u * 2) * Math.PI) * 60 + (u > 0.5 ? (u - 0.5) * 40 : 0);
      g.globalCompositeOperation = 'lighter'; blitC(g, glowImg(GOLD_G), sx, sy - 18, 0.5); g.globalCompositeOperation = 'source-over';
      const sk = sackCv(); if (sk) pixImg(g, sk, sx, sy - 18, 3);
      for (let k = 0; k < 2; k++) { const sk2 = sackCv(); if (sk2) pixImg(g, sk2, w * (0.2 + k * 0.12), h * 0.86 - 22, 2.6); }
      if (!SIL) { const cl = cloudTile('storm'); blit(g, cl, -((t * 20) % cl.w), -86, 1); blit(g, cl, cl.w - ((t * 20) % cl.w), -86, 1); }
    },
    festival(g, w, h, t) {
      sky(g, w, h, '#2B1E4A', '#C0647A');
      for (let i = 0; i < 3 && !SIL; i++) { const q = ((t * 0.7 + i * 0.33) % 1); firework(g, w * (0.25 + i * 0.25), h * (0.22 + 0.08 * i), 50, q, CONF[i]); }
      if (!SIL) { g.fillStyle = '#3A2A3E'; g.fillRect(0, h * 0.86, w, h * 0.14); }
      blit(g, stallBack(0), w * 0.02, h * 0.86 - 128, 0.9); shiba(g, w * 0.02 + 72, h * 0.86 - 28, 'wave', t, 1, 'goma', 1); blit(g, stallFront(0), w * 0.02, h * 0.86 - 128, 0.9);
      blit(g, stallBack(3), w * 0.56, h * 0.86 - 128, 0.9); blit(g, stallFront(3), w * 0.56, h * 0.86 - 128, 0.9);
      shiba(g, w * 0.5, h * 0.92, Math.floor(t * 1.2) % 2 ? 'dance' : 'dance2', t, 2.2, 'sakura', 1);
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); for (let k = 0; k <= 20; k++) { const u = k / 20; const x = u * w, y = 10 + 4 * 30 * u * (1 - u); if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
      for (let k = 0; k < 7; k++) { const u = (k + 0.5) / 7, x = u * w, y = 10 + 120 * u * (1 - u); g.globalCompositeOperation = 'lighter'; blitC(g, glowImg(WARM_G), x, y + 22, 0.45); g.globalCompositeOperation = 'source-over'; g.save(); g.translate(x, y); g.rotate(Math.sin(t * 1.5 + k) * 0.1); pixImg(g, lantern(k % 2 === 1), 0, 16, 2); g.restore(); }
    },
  };
  // silhueta pra evento ainda não visto (desenho parado, escuro)
  function silhouette(id, w, h) {
    const k = Math.min(3, BK.stage ? BK.stage.dpr || 1 : 1), key = id + w + 'x' + h + '@' + k;
    if (BK.sil[key]) return BK.sil[key];
    const c = mkc(w * k, h * k), g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
    const z0 = Draw.zoom, m0 = Draw.minPx; Draw.lod(1, 0);
    SIL = true; try { VIG[id](g, w, h, 1.37); } catch (e) { /* */ } SIL = false;
    Draw.lod(z0, m0);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#6B563E'; g.fillRect(0, 0, c.width, c.height);
    BK.sil[key] = c; return c;
  }

  function paper(g, x, y, w, h, left) {
    g.fillStyle = '#F6E8C8'; g.fillRect(x, y, w, h);
    const gr = g.createLinearGradient(left ? x + w : x, 0, left ? x + w - 46 : x + 46, 0); gr.addColorStop(0, 'rgba(120,80,40,0.28)'); gr.addColorStop(1, 'rgba(120,80,40,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(150,110,60,0.08)'; for (let i = 0; i < 14; i++) g.fillRect(x + 10, y + 30 + i * 28, w - 20, 1);
  }
  function wrapText(g, txt, x, y, maxW, size, col, lh, font) {
    g.font = (font || 'italic 700 ') + size + 'px ' + Draw.FONT; g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'top';
    const words = String(txt).split(' '); let line = '', yy = y;
    for (const wd of words) { const tt = line ? line + ' ' + wd : wd; if (g.measureText(tt).width > maxW && line) { g.fillText(line, x, yy); line = wd; yy += lh; } else line = tt; }
    if (line) g.fillText(line, x, yy); return yy + lh;
  }
  function hanko(g, x, y, txt, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = 0.85;
    g.strokeStyle = '#C8423A'; g.lineWidth = 3.5; rr(g, -60, -23, 120, 46, 8); g.stroke(); g.lineWidth = 1.5; rr(g, -55, -18, 110, 36, 5); g.stroke();
    Draw.text(g, txt, 0, 1, { size: txt.length > 7 ? 18 : 21, col: '#C8423A', sw: 0 });
    g.restore();
  }
  function roundBtn(g, b, kind, hot, off) {
    g.globalAlpha = off ? 0.35 : 1;
    Draw.circle(g, b.x, b.y + 3, b.r, '#7A4A22', { ol: 2.5, hi: false, shade: false });
    Draw.circle(g, b.x, b.y - (hot ? 1 : 0), b.r, kind === 'close' ? '#E2563E' : '#F3C94A', { ol: 2.5 });
    g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = 'round';
    if (kind === 'close') { const s = b.r * 0.38; g.strokeStyle = '#FFF6E6'; g.beginPath(); g.moveTo(b.x - s, b.y - s); g.lineTo(b.x + s, b.y + s); g.moveTo(b.x + s, b.y - s); g.lineTo(b.x - s, b.y + s); g.stroke(); }
    else { const d = kind === 'next' ? 1 : -1, s = b.r * 0.42; g.beginPath(); g.moveTo(b.x + d * s, b.y); g.lineTo(b.x - d * s * 0.6, b.y - s); g.lineTo(b.x - d * s * 0.6, b.y + s); g.closePath(); g.fill(); }
    g.globalAlpha = 1;
  }

  // fundo fixo do Livro: mesa de madeira + luz da luminária (cache)
  function deskBg() {
    return baked('evdesk', BW, BH, g => {
      g.fillStyle = '#3A2414'; g.fillRect(0, 0, BW, BH);
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#40281A' : '#362113'; g.fillRect(0, i * 62, BW, 60); g.fillStyle = '#24160C'; g.fillRect(0, i * 62 + 60, BW, 2); }
      const R = E.RNG(5); g.strokeStyle = 'rgba(20,10,4,0.35)'; g.lineWidth = 1.2; for (let i = 0; i < 70; i++) { const y = R() * BH, x = R() * BW; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 40, y + R() * 6 - 3, x + 90, y + R() * 6 - 3, x + 140, y); g.stroke(); }
      const gr = g.createRadialGradient(BW * 0.5, BH * 0.45, 60, BW * 0.5, BH * 0.5, 620); gr.addColorStop(0, 'rgba(255,214,140,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, BW, BH);
    });
  }
  // capa + páginas (sem conteúdo): cache
  function bookShell() {
    return baked('evshell', BW, BH, g => {
      const b = BOOK;
      g.fillStyle = 'rgba(0,0,0,0.4)'; rr(g, b.x + 8, b.y + 14, b.w, b.h, 16); g.fill();
      g.fillStyle = INK; rr(g, b.x - 3, b.y - 3, b.w + 6, b.h + 6, 18); g.fill();
      g.fillStyle = '#7A2E22'; rr(g, b.x, b.y, b.w, b.h, 16); g.fill();
      g.fillStyle = '#93402E'; rr(g, b.x, b.y, b.w, 10, 8); g.fill();
      for (const [cx, cy, sx, sy] of [[b.x, b.y, 1, 1], [b.x + b.w, b.y, -1, 1], [b.x, b.y + b.h, 1, -1], [b.x + b.w, b.y + b.h, -1, -1]]) { Draw.poly(g, [[cx, cy], [cx + sx * 40, cy], [cx, cy + sy * 40]], PAL.gold, { ol: 1.6 }); }
      // pilha de folhas
      for (let i = 4; i >= 1; i--) { g.fillStyle = i % 2 ? '#E2CFA6' : '#EAD9B4'; g.fillRect(b.pl.x - i * 2, b.pl.y + i * 2, b.pl.w + i * 2, b.pl.h); g.fillRect(b.pr.x, b.pr.y + i * 2, b.pr.w + i * 2, b.pr.h); }
      g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(b.pl.x - 8, b.pl.y, b.pl.w + 8, b.pl.h + 8); g.strokeRect(b.pr.x, b.pr.y, b.pr.w + 8, b.pr.h + 8);
    });
  }
  function drawLeft(g, id, dat, t, x0) {
    const d = DEF(id), P = BOOK.pl, seen = dat.seen > 0, x = x0 !== undefined ? x0 : P.x;
    paper(g, x, P.y, P.w, P.h, true);
    // moldura da gravura
    const fx = x + 22, fy = P.y + 20, fw = P.w - 44, fh = 216;
    g.fillStyle = INK; g.fillRect(fx - 5, fy - 5, fw + 10, fh + 10); g.fillStyle = '#C9A36A'; g.fillRect(fx - 3, fy - 3, fw + 6, fh + 6); g.fillStyle = INK; g.fillRect(fx - 1, fy - 1, fw + 2, fh + 2);
    g.save(); g.beginPath(); g.rect(fx, fy, fw, fh); g.clip(); g.translate(fx, fy);
    if (seen) { try { VIG[id](g, fw, fh, t); } catch (e) { /* */ } }
    else { g.fillStyle = '#EADBB8'; g.fillRect(0, 0, fw, fh); g.drawImage(silhouette(id, fw, fh), 0, 0, fw, fh); Draw.text(g, '?', fw - 44, 62, { size: 76, col: '#F6E8C8', sw: 10, stroke: '#6B563E' }); }
    g.restore();
    if (seen) hanko(g, fx + fw - 64, fy + fh - 28, 'VISTO ×' + dat.seen, -0.12);
    // nome e piada (ou dica)
    const ny = fy + fh + 34;
    Draw.text(g, seen ? d.n : '? ? ?', x + P.w / 2, ny, { size: d.n.length > 22 ? 22 : 27, col: seen ? d.ink : '#8A7458', sw: 0 });
    g.fillStyle = seen ? d.col : '#BBA580'; g.fillRect(x + P.w / 2 - 60, ny + 18, 120, 3);
    if (seen) { g.font = '900 34px ' + Draw.FONT; g.fillStyle = 'rgba(138,90,40,0.35)'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('“', x + 20, ny + 22); }
    wrapText(g, seen ? d.joke : 'Dica: ' + d.hint, x + 40, ny + 32, P.w - 66, 19, seen ? '#5A3A22' : '#7A6448', 24);
    Draw.text(g, (IDS.indexOf(id) + 1) + ' / ' + IDS.length, x + P.w / 2, P.y + P.h - 15, { size: 18, col: '#9A7E58', sw: 0 });
  }
  function drawRight(g, id, dat, all, t, x0) {
    const d = DEF(id), P = BOOK.pr, seen = dat.seen > 0, x = x0 !== undefined ? x0 : P.x;
    paper(g, x, P.y, P.w, P.h, false);
    const L = x + 28, R = x + P.w - 28;
    Draw.text(g, 'CHANCE POR COISA DOURADA', L, P.y + 26, { size: 18, col: '#9A7E58', sw: 0, align: 'left' });
    if (dat.locked) Draw.text(g, 'TRANCADO', L, P.y + 64, { size: 38, col: '#8A7458', sw: 0, align: 'left' });
    else { Draw.text(g, oneIn(dat.p), L, P.y + 64, { size: 40, col: d.ink, sw: 0, align: 'left' }); Draw.text(g, pct(dat.p), R, P.y + 68, { size: 26, col: '#9A7E58', sw: 0, align: 'right' }); }
    // barras com as 6 chances (a planilha toda num relance)
    let y = P.y + 102;
    for (let i = 0; i < IDS.length; i++) {
      const id2 = IDS[i], d2 = DEF(id2), dd = all[id2], me = id2 === id, BX = L + 134, BWm = R - BX - 52, bw = BWm * Math.min(1, dd.p / 0.4);
      if (me) { g.fillStyle = 'rgba(243,201,74,0.28)'; rr(g, L - 8, y - 13, R - L + 16, 26, 8); g.fill(); }
      pixImg(g, icon(id2), L + 8, y, 1.6);
      Draw.text(g, dd.seen > 0 ? (d2.sh || d2.s) : '???', L + 21, y + 1, { size: 17, col: me ? INK : '#7A6448', sw: 0, align: 'left' });
      g.fillStyle = '#E6D3AC'; rr(g, BX, y - 6, BWm, 12, 6); g.fill();   // (rótulos de 17 px: barra começa mais pra direita)
      if (bw > 0) { g.fillStyle = INK; rr(g, BX, y - 6, Math.max(12, bw), 12, 6); g.fill(); g.fillStyle = me ? d2.col : '#C9B48A'; rr(g, BX + 2, y - 4, Math.max(8, bw - 4), 8, 4); g.fill(); }
      Draw.text(g, dd.locked ? '—' : pct(dd.p), R, y + 1, { size: 17, col: me ? INK : '#7A6448', sw: 0, align: 'right' });
      y += 27;
    }
    // ficha
    y += 6; g.fillStyle = '#D9C49A'; g.fillRect(L, y - 8, R - L, 2);
    const row = (k, v, big) => { Draw.text(g, k, L, y + 12, { size: 18, col: '#9A7E58', sw: 0, align: 'left' }); Draw.text(g, v, R, y + 12, { size: big ? 22 : 19, col: big ? '#8A5A12' : INK, sw: 0, align: 'right' }); y += 30; };
    row('Duração', seen ? Math.round(d.dur) + ' s' : '?');
    row('O que faz', seen ? d.fx : '?');
    row('Vezes visto', String(dat.seen));
    row('Melhor resultado', seen && dat.best ? dat.best : '—', true);
    if (dat.locked) Draw.text(g, 'Abre com o nó Livro de Receitas.', x + P.w / 2, P.y + P.h - 44, { size: 17, col: '#C8423A', sw: 0 });
    Draw.text(g, 'A cada 3–8 min · nenhum é ruim', x + P.w / 2, P.y + P.h - 18, { size: 17, col: '#9A7E58', sw: 0 });
  }
  function bookRender(dt) {
    const g = BK.g; BK.t += dt;
    const t = BK.t, all = bookData();
    BK.stage.begin();
    const z0 = Draw.zoom, m0 = Draw.minPx; Draw.lod(1, 0); DPR = Math.max(DPR, BK.stage.dpr || 1);
    blit(g, deskBg(), 0, 0);
    // entra subindo
    const kin = EZ.back(clamp(t / 0.35, 0, 1));
    g.save(); g.translate(0, (1 - kin) * 60); g.globalAlpha = clamp(t / 0.2, 0, 1);
    blit(g, bookShell(), 0, 0);
    // marcadores (fitas) na borda direita
    for (let i = 0; i < IDS.length; i++) {
      const id = IDS[i], d = DEF(id), me = i === (BK.flip ? BK.flip.to : BK.page), hov = BK.hover === 'tab' + i, x1 = me ? 944 : hov ? 934 : 924, y = tabY(i);
      g.fillStyle = INK; rr(g, 862, y - 25, x1 - 862 + 3, 50, 10); g.fill();
      g.fillStyle = all[id].seen > 0 ? d.col : '#9A8668'; rr(g, 862, y - 22, x1 - 862, 44, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(866, y - 20, x1 - 870, 6);
      pixImg(g, icon(id), x1 - 24, y, 2);
    }
    // páginas (com virada)
    const F = BK.flip, cur = F ? F.from : BK.page;
    if (F) {
      F.t += dt / 0.42; const q = EZ.inOut(clamp(F.t, 0, 1)), fwd = F.to > F.from;
      // por baixo: a página nova aparece do lado que vira
      if (fwd) { drawLeft(g, IDS[F.from], all[IDS[F.from]], t); drawRight(g, IDS[F.to], all[IDS[F.to]], all, t); }
      else { drawLeft(g, IDS[F.to], all[IDS[F.to]], t); drawRight(g, IDS[F.from], all[IDS[F.from]], all, t); }
      // folha virando (encolhe até a lombada, depois abre do outro lado)
      const gx = BOOK.gx, P = fwd ? BOOK.pr : BOOK.pl;
      g.save();
      if (q < 0.5) { const s = 1 - q * 2; g.translate(gx, 0); g.scale(fwd ? s : -s, 1); g.translate(-gx, 0); if (fwd) drawRight(g, IDS[F.from], all[IDS[F.from]], all, t); else { g.translate(gx, 0); g.scale(-1, 1); g.translate(-gx, 0); drawLeft(g, IDS[F.from], all[IDS[F.from]], t); } }
      else { const s = (q - 0.5) * 2; g.translate(gx, 0); g.scale(s, 1); g.translate(-gx, 0); if (fwd) drawLeft(g, IDS[F.to], all[IDS[F.to]], t); else drawRight(g, IDS[F.to], all[IDS[F.to]], all, t); }
      g.fillStyle = 'rgba(60,30,10,' + (0.25 * Math.sin(q * Math.PI)).toFixed(3) + ')'; g.fillRect(P.x, P.y, P.w, P.h);
      g.restore();
      if (F.t >= 1) { BK.page = F.to; BK.flip = null; }
    } else { drawLeft(g, IDS[cur], all[IDS[cur]], t); drawRight(g, IDS[cur], all[IDS[cur]], all, t); }
    // lombada
    const gr = g.createLinearGradient(BOOK.gx - 14, 0, BOOK.gx + 14, 0); gr.addColorStop(0, 'rgba(90,50,20,0)'); gr.addColorStop(0.5, 'rgba(90,50,20,0.45)'); gr.addColorStop(1, 'rgba(90,50,20,0)');
    g.fillStyle = gr; g.fillRect(BOOK.gx - 14, BOOK.pl.y, 28, BOOK.pl.h); g.fillStyle = INK; g.fillRect(BOOK.gx - 1, BOOK.pl.y, 2, BOOK.pl.h);
    // fita do título
    const seenN = IDS.filter(id => all[id].seen > 0).length, tw = 380, tx = BW / 2 - tw / 2, ty = 14;
    Draw.poly(g, [[tx - 30, ty + 6], [tx + 6, ty + 6], [tx + 6, ty + 44], [tx - 30, ty + 44], [tx - 16, ty + 25]], '#93302A', { ol: 2 });
    Draw.poly(g, [[tx + tw + 30, ty + 6], [tx + tw - 6, ty + 6], [tx + tw - 6, ty + 44], [tx + tw + 30, ty + 44], [tx + tw + 16, ty + 25]], '#93302A', { ol: 2 });
    Draw.box(g, tx, ty, tw, 44, '#C8423A', { ol: 2.5, top: '#E8776A' });
    Draw.text(g, 'LIVRO DOS EVENTOS', BW / 2 - 26, ty + 22, { size: 26, col: '#FFF6E6', sw: 6 });
    Draw.text(g, seenN + '/' + IDS.length, tx + tw - 40, ty + 22, { size: 20, col: PAL.goldL, sw: 5 });
    // botões
    roundBtn(g, B_PREV, 'prev', BK.hover === 'prev', BK.page === 0 && !BK.flip);
    roundBtn(g, B_NEXT, 'next', BK.hover === 'next', BK.page === IDS.length - 1 && !BK.flip);
    g.restore();
    roundBtn(g, B_CLOSE, 'close', BK.hover === 'close');
    Draw.lod(z0, m0);
  }

  /* =====================================================================
     11. API pública + ouvinte + demo do ?dev
     ===================================================================== */
  const EventArt = {
    spawn, hitTrigger, take, start, on, tap, pop, end, tick, draw, drawScreen, drawTrigger,
    openBook, closeBook, isBookOpen: () => BK.open,
    manual: false, EA, stats, ids: IDS.slice(),
    active: id => (id ? ACT[id] || null : Object.keys(ACT)), triggers: () => TR.slice(),
    clear() { for (const id in ACT) { ACT[id].loops.forEach(stopLoop); musicPop(id); delete ACT[id]; } TR.length = 0; PS.length = 0; POPS.length = 0; },
    // ganchos de teste/prints: avança a arte sem esperar o relógio
    skip(sec) { let n = 0; while (sec > 1e-6 && n < 4000) { const d = Math.min(1 / 30, sec); tick(d); sec -= d; n++; } },
    bookPage: i => { BK.page = clamp(i | 0, 0, IDS.length - 1); BK.flip = null; },
    bookStep(sec) { if (!BK.open) return; let s = sec; while (s > 1e-6) { const d = Math.min(1 / 30, s); bookRender(d); s -= d; } },
  };
  G.EventArt = EventArt;
  try { if (G.Events && typeof G.Events.listen === 'function') G.Events.listen(EventArt); } catch (e) { /* */ }

  // DEMO (só ?dev, e só enquanto o sistema G.Events não existe)
  const DEV = /[?&]dev\b/.test(location.search) || window.KOME_DEV;
  function demoCtx(id) {
    const S = GS(), ips = () => Math.max(1, (S && S.ips) || 1000);
    const c = { dur: DEF(id).dur, crew: 'pata', n: 25, total: 0 };
    if (G.PatioArt && G.PatioArt.fakePatio) { let best = null; const f = G.PatioArt.fakePatio; for (const k in f) if (f[k].n >= 10 && (!best || f[k].n > f[best].n)) best = k; if (best) { c.crew = best; c.n = f[best].n; } }
    c.onLand = it => { const v = ips() * (it.kind === 'saco' ? it.m * 60 : 600 * it.w / 50) * (it.kind === 'saco' ? 1 : 0.5); c.total += v; };
    c.onStomp = (n, p) => { c.total += ips() * 50 * 2; };
    c.rollSack = () => 1 + Math.floor(Math.random() * 7);
    c.result = () => {
      const k = { frenesi: ips() * 6 * 60, festival: ips() * 77, desfile: ips() * 2.5 * 30 }[id];
      const sub = { chuva: 'pegou ' + (ACT.chuva ? ACT.chuva.got : 0) + ' de ' + EA.RAIN_ITEMS + ' · o resto foi pro coletor', gigante: (ACT.gigante ? ACT.gigante.n : 0) + ' patadas ×50', tempestade: (ACT.tempestade ? ACT.tempestade.got : 0) + ' sacos pegos na mão', frenesi: 'renda ×7 por 60 s', desfile: 'turma de ' + c.n + ' na avenida', festival: 'tudo ×2 por 77 s' }[id];
      return { v: (k || 0) + c.total, sub };
    };
    return c;
  }
  function demo(id, at) {
    if (id === 'gatilho' || id === 'gatilhos') {
      const cam = CAM(); if (!cam) return;
      IDS.forEach((k, i) => { const sx = SW * (0.14 + i * 0.145), w = cam.toWorld(sx, SH * 0.42 + (i % 2) * 60, tmpP); const tr = spawn(k, w.x, w.y); if (tr) tr.age = (at || 0) + i * 2.2; });
      return;
    }
    if (!DEF(id)) return;
    if (ACT[id]) { delete ACT[id]; }
    const ctx = demoCtx(id), c = start(id, ctx); if (!c) return;
    c.demo = ctx;
    if (at) EventArt.skip(at);
    return c;
  }
  // termina sozinho no fim (só demo) + toque no canvas do jogo
  if (DEV) setInterval(() => { if (G.Events) return; for (const id in ACT) { const c = ACT[id]; if (c.demo && c.phase === 'run' && c.t >= c.dur) end(id, null, c.demo.result()); } }, 100);
  if (DEV) {
    const K0 = () => window.__kome;
    const wire = () => {
      const K = K0(); if (!K || !G.cam || !G.World) return setTimeout(wire, 250);
      K.evento = (id, at) => { demo(id, at); return Object.keys(ACT); };
      K.livro = (id, demoBook) => { if (demoBook !== false && !G.Events) BK.demo = { frenesi: { seen: 14, best: 3.2e12 }, chuva: { seen: 9, bestTxt: '+¥ 840 bi' }, gigante: { seen: 3, best: 1.1e13 }, desfile: { seen: 1, bestTxt: '+¥ 95 bi' }, tempestade: { seen: 0 }, festival: { seen: 0 } }; return openBook(id); };
      document.addEventListener('pointerdown', e => {
        if (G.Events || BK.open) return;
        const cv = e.target && e.target.tagName === 'CANVAS' ? e.target : null; if (!cv) return;
        const r = cv.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * SW, sy = (e.clientY - r.top) / r.height * SH;
        const tr = hitTrigger(sx, sy); if (tr) { const id = take(tr); setTimeout(() => demo(id), 350); return; }
        const it = tap(sx, sy); if (it) { const S = GS(), ips = Math.max(1, (S && S.ips) || 1000), v = it.kind === 'saco' ? ips * it.m * 60 : ips * 600 * it.w / 50; const c = ACT[it.kind === 'saco' ? 'tempestade' : 'chuva']; if (c && c.demo) c.demo.total += v; pop(it.sx, it.sy - 10, fmtY(v), it.kind !== 'grao'); }
      }, true);
      const q = /[?&]evento=([a-z]+)/.exec(location.search), at = /[?&]evt=([\d.]+)/.exec(location.search), lv = /[?&]livro(=([a-z]+))?/.exec(location.search);
      if (q) setTimeout(() => demo(q[1], at ? +at[1] : 0), 200);
      if (lv) setTimeout(() => K.livro(lv[2] && lv[2] !== 'demo' ? lv[2] : undefined, true), 200);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else setTimeout(wire, 0);
  }
})();
