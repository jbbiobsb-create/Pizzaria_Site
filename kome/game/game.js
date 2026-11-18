/* Kome no Japão — game.js (FASE 1: núcleo jogável, da pata até a Bagger 293 e a casa)
   Módulos neste arquivo, nesta ordem:
     1 estado e save · 2 stats() (redutor único dos efeitos) · 3 mundo (montanha, bolsões) · 4 economia (cavar, pagar, combo,
     sacos, onigiri, automação abstrata) · 5 condutores das ferramentas (um por `kind`) · 6 compras e celebração ·
     7 câmera e desenho · 8 laço, entrada, áudio e ganchos de teste (window.__kome).
   update(dt) nunca desenha nem toca DOM pesado; render() nunca muda estado: step() consegue avançar o jogo sem desenhar.
   Pontos de extensão pra Fase 2: G.Game.on(ev, fn) (eventos: dug, pay, buyTool, buyNode, buyHouse, pocket, sack, ending),
   S.fleet (máquinas antigas), S.helpers, G.World.props/layers, G.HUD.zones, autoTick() (trocar a automação abstrata). */
(function () {
  'use strict';
  const E = window.Pixxel, G = window.KomeGame, D = G.Data, Wd = G.World, HUD = G.HUD;
  const U = E.U, PAL = E.PAL, Draw = E.Draw, UI = E.UI || null;
  const Sfx = E.Sfx || null, Loops = E.Loops || null, Music = E.Music || null, AudioE = E.Audio || null;
  const MOBILE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const ASP0 = Math.max(innerWidth, innerHeight) / Math.max(1, Math.min(innerWidth, innerHeight)), MOB0 = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  // celular: largura lógica máxima e o palco cobre a tela deitada (corta um pouco dos lados, sem faixa preta), mesmo que a barra do navegador suma depois
  const W = MOB0 && ASP0 >= 1.6 ? 1280 : Math.round(Math.max(960, Math.min(1280, 540 * ASP0))), H = 540, WL = D.WORLD, EC = D.ECON, TOOLS = D.TOOLS, NT = TOOLS.length;
  const LANE_Y = 16;                                   // faixa da frente do pátio (máquinas estacionadas)
  // frota estacionada: UM estacionamento marcado na zona industrial, vagas por largura real (game-world.js layout)
  const PARK = id => Wd.layout(S).park[id];
  const PILOT_PAL = { trator: 'goma', colheita: 'shiro', empilhadeira: 'kuro', escav: 'shiro', pacabo: 'cha', caminhao: 'aka' };
  const HELP_PAL = ['goma', 'kuro', 'shiro', 'cha', 'aka', 'yuki', 'sakura', 'matcha', 'sumi', 'kin'];
  const em = E.Emitter(); let nListen = 0;
  let FAST = false;                                    // true dentro de step(): sem DOM, sem som, sem partículas de enfeite

  /* =====================================================================
     1. Estado e save
     ===================================================================== */
  const S = (G.S = {
    money: 0, earned: 0, tool: 0, own: {}, house: 0, time: 0, dug: 0, ended: false, bagX: 0,
    opts: { mute: false, music: true, shake: !E.reducedMotion, pixel: true },   // quem pede menos movimento começa sem tremor
    day: 1, dayT: 0, dayEarn: 0, dayEnd: 0, dayPay: 0,
    closet: [], look: { pal: 'kome', acc: '' }, mount: 1,
    stats: { bestIps: 0, sacks: 0, bestSack: 0, pockets: 0, bestCombo: 0, perfectSecs: 0, crowned: 0, onigiri: 0, buys: 0, comboMaxSecs: 0 },
    // tempo de execução (não vai pro save)
    ips: 0, ipsAcc: 0, ipsT: 0, combo: 0, comboMaxT: 0, furia: 0, slide: 0, estreia: 0,
    pend: 0, pendAge: 0, payT: 0, budget: 0, digT: 9, lastDigX: WL.START_X, stompT: 0,
    heapTotal: 1, heapArea: 1, footX: WL.MX0, footT: 0,
    fleet: [], helpers: [], sacks: [], sackT: 20, oni: { on: false, x: 0, y: 0, t: 0, n: 1 }, oniT: 55,
    col: { x: 0, y: 0, kind: 'cesto', pulse: 0 }, cele: { t: -1, id: '', z0: 1 }, perfectForce: 0, perfT: 0, x3T: 0,
    boingT: 0, hornT: 0, autoT: 0, autoMode: false, cartCrown: false, stamp: 0, m: null, loader: null, bag: null,
    perf: { upd: 0, ren: 0 },
    win: { got: 0, val: 0, inc: [0, 0, 0] },      // diagnóstico da janela atual (o playtest lê e zera a cada ferramenta)
  });
  const P = (G.P = { x: WL.START_X, y: 0, vx: 0, vy: 0, face: 1, ground: true });   // Kome / máquina atual
  const ptr = { wx: WL.START_X + 40, wy: -20, down: false, has: false };
  const hook = { on: false, wx: 0, wy: 0, use: false };

  let pixCv = null, pixG = null; const BGC = { sig: '', n: 0, every: 2 };
  let stage, g, input, cam, parts, floaters, fx, heap, save, loop, cur, T, st;
  let extra = 1, celeCard = null, loopH = null, loopT = 0, sndT = 0, coinT = 0, saveT = 0, tapEat = false, audioOn = false;

  const sfx = (n, o) => { if (FAST || !Sfx || !Sfx.play || S.opts.mute) return; try { Sfx.play(n, o); } catch (e) { /* sem áudio */ } };
  // avisos ficam quietos durante cutscene e com o cartão final aberto
  const ui = fn => { if (!FAST && UI && HUD.ready && !cs && !S.endOpen) { try { fn(); } catch (e) { console.warn('[kome] ui', e); } } };

  /* SAVE VERSIONADO (fase 0 do PLANO-100H): cada camada nova sobe SAVE_V e põe UMA migração aqui. Save antigo nunca quebra:
     E.Save chama migrate(d, versãoAntiga) e roda todas as migrações que faltam, em ordem. */
  const SAVE_V = 10;
  const MIGR = {
    5: d => { d.stats = d.stats || {}; d.stats.inv = d.stats.inv || {}; d.stats.got = d.stats.got || {}; },   // armazém de itens
    // amuletos (amuletos.js): build da ilha atual; trip = ilhas concluídas (a viagem zera sozinha). Save antigo entra sem amuleto
    6: d => { d.stats = d.stats || {}; const a = d.stats.am; if (!a || typeof a !== 'object') d.stats.am = { trip: d.stats.islandsDone | 0, cur: [], got: 0, rr: 0, offer: null, disc: {}, t0: d.tool | 0, rg: 0 }; },
    // Cidade (cidade.js): camada permanente (fica entre viagens). Save antigo entra fechada; abre no 1º mochi vendido
    7: d => { d.stats = d.stats || {}; if (!d.stats.city || typeof d.stats.city !== 'object') d.stats.city = { on: 0 }; },
    // faixas (faixas.js) e evoluções (evolucoes.js): best = faixa já jogada (= volta), seen = apresentação vista; evo.disc = Caderno
    8: d => { d.stats = d.stats || {}; const s = d.stats; if (!s.fx || typeof s.fx !== 'object') s.fx = { best: s.lap | 0, seen: 0 }; if (!s.evo || typeof s.evo !== 'object') s.evo = { disc: {}, seen: {} }; },
    // jogo-infinito passos 5–6: conquistas em escada (escada.js: esc.g = graus; dugAll/amPick = contadores permanentes novos, começam
    // do que dá pra saber), carta do dia (carta.js: dia já visto + presentes guardados), recordes por ilha×faixa e dos modos (modos.js)
    9: d => { d.stats = d.stats || {}; const s = d.stats; if (!s.esc || typeof s.esc !== 'object') s.esc = { g: {} }; s.dugAll = +s.dugAll || 0; s.amPick = s.amPick | 0 || Object.keys((s.am && s.am.disc) || {}).length;
      if (!s.carta || typeof s.carta !== 'object') s.carta = { day: '', tok: {} }; if (!s.recF || typeof s.recF !== 'object') s.recF = {}; if (!s.mrec || typeof s.mrec !== 'object') s.mrec = {}; },
    // casa perdida: loadState não lia d.house (estava dentro de um comentário), então cada recarga gravava house 0 por cima. Recupera o que
    // dá pra provar: ilha terminada = casa pronta (o final exige a casa); sem viagem ainda, as conquistas Dono de Terreno/Casa no Japão contam
    10: d => { const fix = x => { const s = x.stats || {}, n = D.HOUSE.length, a = s.ach || {}; let h = x.house | 0;
        if (x.ended) h = n; else if (!(s.islandsDone | 0) && !s.modo) h = Math.max(h, a.k18 ? n : a.k07 ? 1 : 0);
        x.house = Math.min(n, h); if (Array.isArray(s.mis)) s.mis = s.mis.filter(m => m && m.k !== 'dug'); };   // missão de cavar tinha base do cavado zerado: refaz
      fix(d); if (d.snap && typeof d.snap === 'object') fix(d.snap); },   // retrato da partida normal (modos.js) também
  };
  function migrate(d, v) { for (let k = (v | 0) + 1; k <= SAVE_V; k++) if (MIGR[k]) MIGR[k](d); return d; }

  function saveNow() {
    if (!save) return;
    if (slideFX) slideFX.flush();   // arroz que está rolando volta pro mapa antes de gravar
    if (G.Fab && G.Fab.persist) G.Fab.persist();   // layout da fábrica vai junto
    const d = save.data || save.load();
    d.v = 4; d.tv = 3; d.mount = S.mount; d.island = S.island | 0; d.shape = S.shape; d.mountT = S.mountT; d.closet = S.closet; d.look = S.look; d.home = S.homeData; d.day = S.day; d.dayT = S.dayT; d.dayEarn = S.dayEarn; d.money = S.money; d.earned = S.earned; d.tool = S.tool; d.tree = Object.keys(S.own); d.house = S.house; d.soCasa = S.soCasa ? 1 : 0; d.time = S.time; d.dug = S.dug;
    d.ended = S.ended; d.bagX = S.bagX; d.px = P.x; d.stats = S.stats; d.opts = S.opts; d.h = heap.serialize();
    d.found = heap.pockets.map(p => (p.found ? 1 : 0)).join('');
    save.save();
  }

  /* roupinhas do save: ids antigos/com acento/maiúscula/duplicados → id de D.CLOSET (senão o achado some do guarda-roupa).
     Id que não existe mais em D.CLOSET sai (senão conta no "x/21 achados" e na conquista de guarda-roupa cheio). */
  const CLOSET_ALIAS = { kome_dourado: 'kin', dourado: 'kin', neve: 'yuki', carvao: 'sumi', ruivo: 'aka', chocolate: 'cha', oculos_escuros: 'oculos',
    cachecol_vermelho: 'cachecol', coroa_de_ouro: 'coroa', flor_de_sakura: 'flor', bandana_azul: 'bandana', gorro_de_la: 'gorro',
    laco_vermelho: 'laco', capa_de_heroi: 'capa', hinomaru: 'nihon', bone_azul: 'bone' };
  function fixCloset(list) {
    if (!Array.isArray(list)) return [];
    const known = {}; for (const c of D.CLOSET) known[c.id] = 1;
    const out = [];
    for (const raw of list) {
      if (typeof raw !== 'string' || !raw) continue;
      let id = raw;
      if (!known[id]) { const n = raw.normalize ? raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : raw; id = n.toLowerCase().trim().replace(/[\s-]+/g, '_'); id = known[id] ? id : CLOSET_ALIAS[id] || id; }
      if (known[id] && out.indexOf(id) < 0) out.push(id);
    }
    return out;
  }
  function loadState() {
    const d = save.load();
    if (!d || !d.v) return false;
    S.money = +d.money || 0; S.earned = +d.earned || 0; S.tool = U.clamp((d.tool | 0) + (!d.tv && (d.tool | 0) >= 8 ? 1 : 0), 0, NT - 1); if ((d.tv | 0) < 3) S.tool = ({ 8: 9, 9: 8, 11: 12, 12: 11 })[S.tool] || S.tool;   // 16/11: empilhadeira antes da colheitadeira, caminhão antes da pá de cabo
    // casa, tempo e cavado: ficaram DENTRO do comentário acima desde a importação (a casa voltava a 'nunca comprada' a cada recarga/versão nova)
    S.house = U.clamp(d.house | 0, 0, D.HOUSE.length); S.soCasa = !!d.soCasa; S.time = +d.time || 0; S.dug = +d.dug || 0;
    S.closet = fixCloset(d.closet); S.look = d.look && typeof d.look === 'object' ? { pal: d.look.pal || 'kome', acc: d.look.acc || '' } : { pal: 'kome', acc: '' };
    S.island = d.island | 0; S.shape = d.shape || ''; S.mountT = +d.mountT || 0;
    S.homeData = d.home && typeof d.home === 'object' ? d.home : { own: {}, hide: {}, theme: 'verao' }; S.homeData.own = S.homeData.own || {}; S.homeData.hide = S.homeData.hide || {};
    S.day = d.day | 0 || 1; S.dayT = +d.dayT || 0; S.dayEarn = +d.dayEarn || 0;
    S.ended = !!d.ended; S.bagX = +d.bagX || 0; S.own = {}; (d.tree || []).forEach(id => { if (D.nodeById[id]) S.own[id] = true; });
    Object.assign(S.stats, d.stats || {}); Object.assign(S.opts, d.opts || {});
    if (d.h) { try { heap.deserialize(d.h); } catch (e) { console.warn('[kome] montanha do save não abriu'); } }
    if (d.found) heap.pockets.forEach((p, i) => { p.found = d.found[i] === '1'; });
    P.x = +d.px || WL.START_X;
    return true;
  }

  /* =====================================================================
     2. stats(): TODOS os efeitos de árvore, sinergias e casa passam por aqui
     ===================================================================== */
  const MUL = { dig: 1, sell: 1, sack: 1, hm: 1, hv: 1, pm: 1, val: 1, spd: 1, reach: 1, powMul: 1, boom: 1 };
  function computeStats() {
    const s = { dig: 1, sell: 1, sack: 1, hm: 1, hv: 1, pm: 1, val: 1, spd: 1, reach: 1, powMul: 1, boom: 1, help: 0, crit: 0, critMult: 5,
      gold: D.POCKETS.mult, comboCap: D.COMBO.cap, oni: 0, auto: 0, pilots: {}, nodes: 0 };
    const ap = f => {
      for (const k in f) {
        const v = f[k];
        if (MUL[k]) s[k] *= v;
        else if (k === 'help' || k === 'crit') s[k] += v;
        else if (k === 'gold' || k === 'comboCap' || k === 'oni' || k === 'auto') s[k] = Math.max(s[k], v);
        else if (k === 'pilot') s.pilots[v] = true;
        else s[k] = v;
      }
    };
    for (const n of D.TREE) if (S.own[n.id]) { ap(n.fx); s.nodes++; }
    for (const y of D.SYN) if (S.own[y.a] && S.own[y.b]) ap(y.fx);
    for (let i = 0; i < S.house && i < D.HOUSE.length; i++) ap(D.HOUSE[i].perk);
    if (G.Inf && cur) { s.sell *= G.Inf.mult(cur.id); s.powMul *= G.Inf.powK(cur.id); }   // oficina: só a máquina em uso
    // depois da Bagger, qualquer ferramenta (trocando de lugar) fura até o núcleo dourado: devagar, mas fura (a favorita não fica inútil)
    if (cur && S.tool === NT - 1 && cur.kind !== 'bagger') s.powMul = Math.max(s.powMul, 10.4 / (cur.pow || 1));
    if (G.Goals) s.sell *= G.Goals.mult();
    if (G.Carta) s.sell *= G.Carta.mult();   // carta do dia: presente "arroz fresquinho" (×2 por 10 min de jogo)
    if (G.Patio && G.Patio.heart) s.sell *= G.Patio.heart();   // Arroz do Coração: +1% por conquista da camada Cookie
    if (G.Islands) G.Islands.applyStats(s);   // árvore das sementes + bônus da ilha
    if (G.Amuletos) G.Amuletos.applyStats(s, cur);   // amuletos da ilha (mão/motor, sacos, ajudantes, regras da árvore)
    if (G.Faixas) G.Faixas.applyStats(s);   // faixa da volta (sacos tímidos; o resto entra pelos ganchos AM/MATS/buildWorld)
    if (G.Evolucoes) G.Evolucoes.applyStats(s, cur);   // máquina evoluída em uso: ×3
    if (G.City && G.City.applyStats) G.City.applyStats(s);   // prédios da Cidade: +% cavar/preço, combo mais longo (cidade.js)
    if (G.Ind) G.Ind.applyStats(s);           // fábrica, lojas e Bagger gêmea (modo infinito)   // selos das conquistas: +1% cada   // oficina do modo infinito
    st = s;
    if (heap) for (const p of heap.pockets) p.mult = s.gold;
    return s;
  }
  const PM = () => (G.Islands ? G.Islands.priceMul() : 1) * AM('preco');   // sementes: Amigo do Corretor · amuletos Pão-Duro/Diesel
  const toolCost = t => Math.ceil(t.cost * EC.COST_TOOL * PM());
  const nodeCost = n => Math.ceil(n.c * EC.COST_NODE * PM());
  const houseCost = h => Math.ceil(h.c * EC.COST_HOUSE * PM());
  // nodeState(n) -> 'owned' | 'open' | 'locked'
  function nodeState(n) {
    if (S.own[n.id]) return 'owned';
    if (S.tool + 1 < n.tier) return 'locked';
    for (const r of n.req) if (!S.own[r]) return 'locked';
    return 'open';
  }

  /* =====================================================================
     3. Mundo: a montanha (E.Heap) com camadas por profundidade, núcleo e bolsões
     ===================================================================== */
  function mountainShape(x) {
    if (x <= WL.MX0 || x >= WL.MX1) return 0;
    const a = (x - WL.MX0) * WL.SLOPE, b = (WL.MX1 - x) * WL.SLOPE, sh = shapeId();
    const v = sh === 'futago' ? 1 : sh === 'mesa' ? 2 : 0, L0 = WL.MX1 - WL.MX0, u = (x - WL.MX0) / L0;
    let base = Math.min(a, b, WL.MH);
    if (sh === 'mochi') base = Math.min(base * 1.6, WL.MH * 0.92 * Math.pow(Math.max(0, 1 - Math.pow((u - 0.5) * 2, 2)), 0.45));   // domo redondo
    else if (sh === 'vulcao') { const c = Math.abs(u - 0.55); base = Math.min(a * 1.15, b * 1.15, WL.MH) - (c < 0.08 ? (0.08 - c) / 0.08 * WL.MH * 0.22 : 0); }   // cratera de curry no topo
    else if (sh === 'terraco') { const st = WL.MH / 4.5, cyc = st * 1.9, ter = q => { const k = Math.floor(q / cyc), pos = q - k * cyc; return k * st + st * Math.min(1, pos / (cyc * 0.35)); }; base = Math.min(ter(a * 1.2), ter(b * 1.2), WL.MH); }   // degraus de arrozal
    if (v === 1) {   // modo infinito: dois picos (Futago-yama)
      const L = WL.MX1 - WL.MX0, p1 = WL.MX0 + L * 0.34, p2 = WL.MX0 + L * 0.7;
      base = Math.min(base, Math.max(WL.MH * 0.98 - Math.abs(x - p1) * WL.SLOPE * 0.9, WL.MH * 0.82 - Math.abs(x - p2) * WL.SLOPE * 0.9));
    } else if (v === 2) base = Math.min(a * 1.4, b * 1.4, WL.MH * 0.88);   // mesa: paredão e topo chato
    const edge = Math.min(1, Math.min(x - WL.MX0, WL.MX1 - x) / 200);
    return Math.max(0, base + edge * (9 * Math.sin(x * 0.011) + 5 * Math.sin(x * 0.037 + 1)));
  }
  // camadas da montanha: a ilha define a base e o FORMATO troca os materiais (montanha de mochi é de mochi, vulcão é de curry)
  const SHAPE_MATS = {
    mochi: [
      { id: 'solto', name: 'Mochi de Arroz', col: '#FFF6F4', val: 1.1, tex: 'mochi' },
      { id: 'prensado', name: 'Mochi de Morango', col: '#F6C6D2', tex: 'mochi' },
      { id: 'mochi', name: 'Mochi de Matchá', col: '#A9CB8A', tex: 'mochi' },
    ],
    vulcao: [
      { id: 'solto', name: 'Arroz com Curry', col: '#F3C566', tex: 'loose' },
      { id: 'prensado', name: 'Curry Apimentado', col: '#D9893A', tex: 'pressed' },
      { id: 'mochi', name: 'Curry Vulcânico', col: '#9E3B22', tex: 'loose' },
    ],
  };
  const MATS = () => {
    const base = G.Faixas ? G.Faixas.mats(G.Islands ? G.Islands.matsFor() : D.MATS) : G.Islands ? G.Islands.matsFor() : D.MATS, sm = SHAPE_MATS[shapeId()];   // faixas: duro mais cedo, núcleo blindado
    if (!sm) return base;
    return base.map(m => { const o = sm.find(x => x.id === m.id); return o ? Object.assign({}, m, o) : m; });
  };
  let slideFX = null, slideSum = 0, slideT = 0, rumbleCD = 0;
  function buildWorld() {
    if (heap && heap.dropCache) heap.dropCache();   // solta a tela de apoio da montanha velha já (iOS conta memória de canvas até o GC)
    heap = E.Heap({ width: WL.WW, colW: WL.COLW, x0: 0, y0: 0, seed: WL.SEED + ((S.mount || 1) - 1) * 7919 + (S.island | 0) * 104729, layers: MATS(), onPocket });
    if (!heap.layers || !heap.layers.length) heap.setLayers(MATS());
    heap.minK = 0.41;
    // grãos de verdade descendo a encosta + poeira quando um grão grande cai de um pulo
    slideFX = E.SlideFX ? E.SlideFX(heap, { max: 260, carry: 0, active: () => !FAST,   // carry desligado: com grão carregando massa o save/load divergia (investigar antes de religar)
       onLand: (x, y, sp) => { if (!FAST && parts && Math.random() < 0.25) parts.puff(x, y, 1 + (sp > 260 ? 2 : 0), 4, { c: PAL.sand }); } }) : null;
    const fxM = G.Faixas ? G.Faixas.val('mont', 1) : 1;   // faixa "Montanha 20% maior"
    heap.generate(fxM === 1 ? mountainShape : x => mountainShape(x) * fxM);
    heap.wake().settle(4000);                                   // nasce já assentada no talude do arroz solto
    heap.fromArray(heap.h.slice());
    heap.onPocket = onPocket;
    const r = E.RNG(WL.SEED + ((S.mount || 1) - 1) * 7919 + (S.island | 0) * 104729), PK = D.POCKETS;
    let made = 0, guard = 0;
    while (made < PK.n && guard++ < 4000) {
      const early = made < 5 && !(G.Faixas && G.Faixas.has('escondido'));   // os primeiros ficam perto do começo, rasos (faixa "Bolsões escondidos": não)
      const x = early ? r.range(2000, 2700) : r.range(2300, 7600), rad = early ? r.range(35, 48) : r.range(PK.r[0], PK.r[1]);
      const hs = heap.h0[heap.col(x)], dep = PK.minDepth + rad + (early ? r.range(0, 40) : r.range(0, Math.min(1100, hs * 0.6)));
      const alt = hs - dep;
      if (alt - rad < 8) continue;
      heap.addPocket({ x, y: alt, r: rad, mult: PK.mult, kind: 'gold' });
      made++;
    }
    S.heapTotal = heap.total; S.heapArea = heap.area;
    G.heap = heap;
  }
  const floorFn = x => heap.surf(x);
  const flatFn = () => LANE_Y;
  const baggerFloor = x => Math.min(0, heap.surf(x));
  // faceAhead(x, thr, max): primeiro x à frente onde o terreno sobe mais que thr acima de onde a máquina está
  function faceAhead(x, thr, max) {
    const h0 = heap.height(x);
    for (let d = 0; d <= max; d += 4) if (heap.height(x + d) - h0 > thr) return x + d;
    return x + max;
  }
  function scanFoot() {
    for (let x = WL.MX0 - 60; x < WL.MX1; x += 8) if (heap.height(x) > 20) return x;
    return WL.MX1;
  }
  // aim() -> {x,y}: um bom ponto pra segurar o ponteiro com a ferramenta atual (autoplayer e Kome Workaholic)
  const aimO = { x: 0, y: 0 };
  function aim() {
    const pow = cur.pow * st.powMul, k = cur.kind;
    if (k === 'hand' || k === 'push' || k === 'jack') {
      let best = -1, soft = -1, bestV = 0;
      for (let x = WL.MX0 - 40; x < WL.MX1; x += 8) {
        if (heap.height(x) < (k === 'push' ? 22 : 5)) continue;
        const mt = heap.topMat(x), kk = pow / mt.hard;
        if (kk < 0.41) continue;
        const sc = mt.val * Math.min(1, kk);                    // rende mais: material mais valioso que ainda corta bem
        if (soft < 0) soft = x;
        if (sc > bestV + 0.05) { bestV = sc; best = x; }
        if (x - soft > 420) break;
      }
      let x = (best >= 0 ? best : soft >= 0 ? soft : S.footX + 20) + (k === 'jack' ? 30 : 8);
      // se o ponto bom está logo ali, continua cavando onde está (não fica virando de costas pra montanha)
      const here = P.x + P.face * cur.reach * st.reach;
      if (P.face > 0 && Math.abs(x - here) < 70 && heap.height(here) > (k === 'push' ? 22 : 5) && pow / heap.topMat(here).hard >= 0.41 && heap.topMat(here).val * Math.min(1, pow / heap.topMat(here).hard) >= bestV - 0.06) x = here;
      aimO.x = x; aimO.y = heap.surf(aimO.x) - 4;
    } else if (k === 'bagger') {
      const m = S.m, b = T.bite(m);
      let x = m.x + 300;
      for (; x < WL.MX1; x += 8) if (heap.height(x) > 330) break;
      aimO.x = x + 30; aimO.y = -300;
      if (b && m.bite01 !== null && m.bite01 !== undefined) aimO.x = b.x + (0.55 - m.bite01) * 160;
    } else {
      const fxr = faceAhead(P.x, 16, 900);
      aimO.x = fxr + cur.r * 0.6; aimO.y = heap.surf(aimO.x) - cur.r * 0.3;
    }
    return aimO;
  }

  /* =====================================================================
     4. Economia
     ===================================================================== */
  let comboLv = 0;
  const AM = k => (G.Amuletos ? G.Amuletos.mult(k) : 1) * (G.Faixas ? G.Faixas.mult(k) : 1);   // ganchos dos amuletos (game/amuletos.js) e das faixas (combo, sacos): 1 = sem efeito
  const comboMult = () => 1 + (st.comboCap - 1) * S.combo / D.COMBO.max;
  // multiplicador de iene do que o Kome cava agora (preço x combo x eventos)
  function yenK() {
    return EC.P0 * extra * st.sell * st.val * (S.autoMode ? 1 : comboMult()) * (S.furia > 0 ? D.COMBO.furiaMult : 1) * (S.slide > 0 ? 1.5 : 1);
  }
  function Aeff() {
    if (S.twinPlay && cur.kind === 'bagger' && S.m && S.m.k > 1) return Aeff0() * 2;   // Gêmea: roda maior + segunda roda
    return Aeff0();
  }
  function Aeff0() {
    return cur.A * st.dig * (S.estreia > 0 ? EC.ESTREIA_SPEED : 1) * (S.autoMode ? st.auto : 1);
  }
  const digO = { pow: 1 };
  // digAt(b, take, face, mode): tira `take` px² (em dureza 1) no ponto de mordida, do jeito de cada ferramenta, e contabiliza.
  //   mode 'rect' = vão retangular (britadeira, garfo, trombada do carrinho). Se a mordida pegou pouco arroz (ponta no ar,
  //   coluna rasa), o resto sai do barranco logo à frente, pra ferramenta render o A dela.
  function digAt(b, take, face, mode, w) {
    const k = cur.kind, R = cur.r * (S.estreia > 0 ? 1.15 : 1);
    digO.pow = cur.pow * st.powMul;
    let res;
    if (mode === 'rect') { const x0 = b.x - (face > 0 ? 0 : w); res = heap.digRect(x0, x0 + w, take / w, digO); }
    else if (k === 'hand') res = heap.dig(b.x + face * R * 0.3, take, R, digO);
    else res = heap.digCircle(b.x + face * R * 0.2, b.y, R, take, digO);
    let spent = res.got * res.hard + res.blocked;
    const blk = res.blocked;
    onDug(res, b.x, b.y);
    if (spent < take * 0.85 && blk < take * 0.3) {
      const x2 = b.x + face * R, r2 = heap.dig(x2, take - spent, R * 2.2 + 12, digO);
      spent += r2.got * r2.hard + r2.blocked;
      onDug(r2, x2, b.y);
    }
    return Math.max(0, take - spent);                       // sobra volta pro orçamento (não se perde cavada por falta de arroz na ponta)
  }
  // onDug(res, x, y): contabiliza o que saiu da montanha (iene fica pendente até o momento de pagar)
  // arroz da beirada escorrendo pra dentro do buraco (só enfeite, partículas que pousam)
  let trickleT = 0;
  const TRICKLE = { shape: 'grain', c: [PAL.rice, PAL.rice, PAL.riceS], land: true, w: 2.2, life: 1.6, ol: true, speed: [20, 60], spread: 0.35, dir: 0, g: 700 };
  function trickle(x, n) {
    if (FAST || !parts) return;
    const up = heap.surf(x + 24) < heap.surf(x - 24) ? 1 : -1, z = Math.max(0.3, cam.z), sc = Math.max(1, 1.4 / z);
    TRICKLE.w = 2.4;
    for (let i = 0; i < n; i++) {
      const d = (cur.r || 6) * (0.9 + Math.random() * 1.4) + 4, sx = x + up * d, sy = heap.surf(sx) - 1.5;
      TRICKLE.dir = up > 0 ? Math.PI * 0.85 : Math.PI * 0.15;   // rola de volta pra dentro (pro lado do buraco)
      TRICKLE.speed[0] = 25 * sc; TRICKLE.speed[1] = 70 * sc;
      parts.spray(sx, sy, 1, TRICKLE);
    }
  }
  function onDug(res, x, y) {
    if (res.got > 0 && !FAST && (trickleT -= 1) <= 0) { trickleT = 2; trickle(x, 1 + (Math.random() < 0.5 ? 1 : 0)); }
    if (res.got > 0) {
      S.dug += res.got; S.lastDigX = x; S.digT = 0; S.win.got += res.got; S.win.val += res.val;
      S.pend += res.val * yenK();
      if (G.Items) G.Items.add(res.byMat);   // armazém: o saco também vira item do seu tipo
      if (!FAST && res.gold > 0 && parts) parts.sparkle(x, y, 2, GOLD_SPK);
      if (nListen) em.emit('dug', res, x, y);
    }
    if (res.blocked > 0.5 && res.blocked > res.got * 3) boing(res.hardMat, x, y);
  }
  const GOLD_SPK = { c: PAL.goldL };
  function boing(mat, x, y) {
    if (S.boingT > 0) return;
    S.boingT = 1.1;
    let need = null;
    // a partir da ferramenta NA MÃO (não da melhor comprada): se já tem uma que fura, sugere trocar; senão, a próxima a comprar
    const ci = Math.max(0, TOOLS.indexOf(cur));
    if (mat) for (let i = ci + 1; i < NT; i++) if (TOOLS[i].pow / mat.hard >= 0.41) { need = (i <= S.tool ? 'troque pra ' : 'precisa: ') + TOOLS[i].name; break; }
    if (!FAST) {
      floaters.add(x, y - 26, 'duro demais!', { c: PAL.pink, size: 15, life: 1.2 });
      if (need) floaters.add(x, y - 10, need, { c: PAL.cream, size: 11, life: 1.4, pop: 0 });
      cam.kick(-P.face * 5, 0);
    }
    sfx('boing');
  }
  function onPocket(p) {
    S.stats.pockets++;
    em.emit('pocket', p);
    if (Math.random() < 0.4) findTreasure();
    if (FAST) return;
    sfx('shing'); if (Sfx && Sfx.gold && !S.opts.mute) { try { Sfx.gold(); } catch (e) { /* */ } }
    fx.hitstop(0.06); fx.flash(PAL.goldL, 0.25, 0.4);
    parts.coins(p.x, -p.y, 14);
    ui(() => UI.banner('BOLSÃO DOURADO!', 'arroz dourado vale ×' + st.gold, { icon: 'star', tone: 'gold', dur: 1.6 }));
  }

  /* fila de pagamentos: o arroz viaja até o coletor e o ¥ estoura lá (adendo §9) */
  const pays = []; for (let i = 0; i < 48; i++) pays.push({ on: false, t: 0, v: 0, kind: 0, crit: false });
  const TRAVEL = { shape: 'grain', c: PAL.rice, w: 2.4, life: 0.5, ol: true, g: 700, vx: 0, vy: 0, x: 0, y: 0 };
  // pay(v, sx, sy, kind, crit): kind 0 = Kome, 1 = automação (pop pequeno e cinza), 2 = prêmio (saco, onigiri: na hora)
  function pay(v, sx, sy, kind, crit) {
    if (!(v > 0)) return;
    let e = null;
    for (let i = 0; i < pays.length; i++) if (!pays[i].on) { e = pays[i]; break; }
    if (!e) { credit(v, kind, crit); return; }
    const c = S.col, dx = c.x - sx, dy = (c.y - 20) - sy, dist = Math.sqrt(dx * dx + dy * dy);
    const Tt = kind === 2 ? 0 : U.clamp(dist / 1300, D.PAY_DELAY[0], D.PAY_DELAY[1]);
    e.on = true; e.t = Tt; e.v = v; e.kind = kind; e.crit = !!crit;
    if (!FAST && kind === 0 && Tt > 0 && cam.visible(sx, sy, 60)) {
      const n = Math.min(8, 2 + (S.tool >> 1)), gg = 700 / Math.max(0.3, cam.z);
      for (let i = 0; i < n; i++) {
        const tt = Tt * (0.85 + 0.15 * i / n);
        TRAVEL.x = sx + (i - n / 2) * 2; TRAVEL.y = sy; TRAVEL.g = gg; TRAVEL.life = tt; TRAVEL.w = 2.2 / Math.min(1, cam.z + 0.2);
        TRAVEL.vx = dx / tt; TRAVEL.vy = dy / tt - 0.5 * gg * tt; TRAVEL.c = crit || S.estreia > 0 ? PAL.goldL : PAL.rice;
        parts.add(TRAVEL);
      }
    }
  }
  const POP = [[0.5, 12, PAL.white], [2, 16, '#FFF3B0'], [10, 22, PAL.ora], [60, 30, PAL.gold], [1e18, 40, PAL.goldL]];
  const edge = { x: 0, y: 0 };
  const DIESEL_TINT = ['#8FB8E8', '#4F78B0'];
  let popT = -9, popN = 0;
  const LANE = { x0: 0, x1: 0, y: 0 }; let laneF = null, laneV = 0, laneC = false, laneT = -9;
  let smallV = 0, smallK = 0, smallT = 0, smallShow = false;
  function smallTick(dt) {
    smallT += dt; if (smallT < 1.2 || smallV <= 0) return;
    smallT = 0; const v = smallV; smallV = 0; smallShow = true;
    try { credit(v, smallK, false); } finally { smallShow = false; }
  }
  function credit(v, kind, crit) {
    if (!smallShow && G.Inf) v *= G.Inf.evMult();   // evento do modo infinito (rush, veio, festival)
    if (!smallShow && G.Islands) v *= G.Islands.evMult();
    if (!smallShow && G.Amuletos) v *= G.Amuletos.credit(kind);   // amuletos: você / frota / prêmio, noite, rush, estimação
    if (!smallShow && G.Events) v *= G.Events.mult(kind);   // eventos dourados da camada Cookie (frenesi, gigante, desfile…)   // evento da ilha (nevasca, erupção, maré, gravidade fofa)
    if (G.Fab && kind !== 2 && !smallShow) G.Fab.dig(v);   // fábrica: ritmo de cavar (a Doca puxa uma % disso)
    if (!smallShow) { S.money += v; S.earned += v; S.dayEarn += v; S.ipsAcc += v; if (kind === 0) S.ipsAccP = (S.ipsAccP || 0) + v;   // só o que VOCÊ cava (sem frota/Goma e sem prêmio de evento: o prêmio é minutos da renda TOTAL, Pátio junto, e virava o R0 do próximo Pátio)
      S.col.pulse = 1; S.win.inc[kind] += v; }   // (pulse/win estavam presos no fim do comentário acima: o coletor não pulsava com a renda)
    // smallShow = só o pop do ganho miúdo que já entrou antes (antes subtraía e somava de novo, mas esquecia dayEarn/ipsAccP: contavam 2x)
    if (nListen && !smallShow) em.emit('pay', v, kind);
    if (FAST) return;
    const secs = v / Math.max(1, S.ips), c = S.col;
    let i = 0; while (secs >= POP[i][0]) i++;
    if (kind === 1 && i > 0) i = 0;
    // ganho miúdo (até ~2 s de renda): não estoura sozinho; junta e mostra um "+¥" só a cada 1,2 s, sem som
    if (i <= 1 && !crit && kind !== 2 && !smallShow) { smallV += v; smallK = kind; return; }
    let x = c.x, y = c.y - 34 / Math.max(0.4, cam.z);
    if (!cam.visible(x, y, 0)) {                                   // coletor fora da tela: o pop aparece na borda, do lado dele
      cam.toWorld((x < cam.x) !== (cam.mx < 0) ? 46 : W - 46, H * (vila.k > 0 ? 0.34 : 0.6), edge);   // olhando a vila: o pop sobe pro céu, não tapa as casinhas
      x = edge.x; y = edge.y; S.col.edge = 1;   // (estava preso no comentário: o pop ficava fora da tela)
    }
    // vários pops em sequência: empilha um em cima do outro em vez de sobrepor
    popN = S.time - popT < 0.4 ? Math.min(4, popN + 1) : 0; popT = S.time;
    y -= popN * (POP[i][1] + 4) / Math.max(0.4, cam.z);
    const txt = '+¥' + U.fmt(v) + (crit ? ' kin!' : '') + (st.nodes && S.own.m_d ? ' ^_^' : '');
    const col = kind === 1 ? PAL.grayL : crit ? PAL.gold : S.own.m10 ? PAL.goldL : POP[i][2];
    // pop GRANDE (>= 10 s de renda): não nasce mais em cima do coletor (tapava esteira, máquinas e o "MORDIDA PERFEITA" da roda).
    // Sobe na faixa livre ao lado do iene, tamanho travado, e pops seguidos SOMAM no mesmo texto em vez de empilhar.
    const ln = i >= 2 && kind !== 1 && HUD.lane ? HUD.lane(LANE) : null;
    if (ln) {
      const live = laneF && laneF.life > 0 && laneF.ui && S.time - laneT < 0.7;
      laneV = live ? laneV + v : v; laneC = live ? laneC || crit : !!crit; laneT = S.time;
      let t2 = '+¥' + U.fmt(laneV) + (laneC ? ' kin!' : ''), sz = (ln.x1 - ln.x0) / (t2.length * 0.6);
      if (sz < 17 && laneC) { t2 = '+¥' + U.fmt(laneV); sz = (ln.x1 - ln.x0) / (t2.length * 0.6); }   // faixa estreita: sem o "kin!", o dourado já diz
      sz = U.clamp(sz, 17, 24);   // nunca abaixo de 17 no palco 960x540 (celular deitado: a faixa vai pra baixo dos chips, ver HUD.lane)
      if (live) { laneF.txt = t2; laneF.size = sz; laneF.life = laneF.life0; laneF.y = Math.max(laneF.y, ln.y - 14); laneF.vy = -18; laneF.c = laneC ? PAL.gold : col; }
      else laneF = floaters.add((ln.x0 + ln.x1) / 2, ln.y, t2, { c: col, size: sz, life: 1.25, vy: -34, rot: 0, pop: 1, ui: true });
    } else floaters.add(x + U.rnd(-4, 4) / cam.z, y, txt, { c: col, size: Math.min(24, (kind === 1 ? 10 : POP[i][1]) * (crit ? 1.25 : 1)), life: 0.9 + i * 0.15, shake: cur.kind === 'jack' ? 1.2 : 0, pop: 1 + Math.min(i, 2) * 0.25 });
    if (i >= 2 && kind !== 1) { parts.coins(x, y, 2 + i * 2); HUD.bump(); }
    if (i >= 4) fx.hitstop(0.06);
    if (crit && S.own.s7) parts.coins(x, y, 6);
    if (coinT <= 0 && kind !== 1 && Sfx && !S.opts.mute && !smallShow) { const big = i >= 2 || crit; coinT = big ? 0.25 : 0.35; try { if (!big && Sfx.coinSoft) Sfx.coinSoft(S.combo | 0); else if (Sfx.coin) Sfx.coin(S.combo | 0); else Sfx.play('kaching'); } catch (e) { /* */ } }
  }
  // flush(sx, sy, mult): paga o que estava pendente (com crítico e surpresa ×3)
  function flush(sx, sy, mult) {
    let v = S.pend * (mult || 1); S.pend = 0; S.pendAge = 0; S.payT = 0;
    if (!(v > 0)) return;
    let crit = false;
    if (st.crit > 0 && Math.random() < st.crit) { v *= st.critMult; crit = true; if (st.critCombo) S.combo = Math.min(D.COMBO.max, S.combo + st.critCombo); }
    if (Math.random() < EC.SURPRISE) { v *= EC.SURPRISE_MULT; if (!FAST) floaters.add(sx, sy - 30, '×3 NESTA ' + (cur.kind === 'bagger' ? 'MORDIDA' : cur.seat === 'cab' ? 'CONCHADA' : 'PATADA') + '!', { c: PAL.gold, size: 18 }); }
    pay(v, sx, sy, 0, crit);
  }

  function ecoTick(dt, hold) {
    const C = D.COMBO;
    S.digT += dt; if (S.boingT > 0) S.boingT -= dt; if (coinT > 0) coinT -= dt; if (sndT > 0) sndT -= dt;
    if (S.estreia > 0) S.estreia -= dt; if (S.slide > 0) S.slide -= dt; if (S.col.pulse > 0) S.col.pulse = Math.max(0, S.col.pulse - dt * 3);
    // combo
    if (S.digT < C.idle + (cur.kind === 'hand' || cur.kind === 'jack' ? 0 : (cur.cycle || 2.5) * 1.6) && !S.autoMode) S.combo = Math.min(C.max, S.combo + C.gain * dt * AM('comboGain')); else S.combo = Math.max(0, S.combo - C.decay * dt * AM('comboDecay') * (st.cDecay || 1));
    if (S.combo > S.stats.bestCombo) S.stats.bestCombo = S.combo;
    { const lv = Math.floor(S.combo / 3); if (lv > comboLv && lv > 0 && Sfx && !S.opts.mute && !FAST) { try { Sfx.combo(S.combo >= C.max - 0.01 ? 30 : lv * 3); } catch (e) { /* */ } } comboLv = lv; }
    if (S.furia > 0) S.furia -= dt;
    else if (st.furia && S.combo >= C.max) {
      S.comboMaxT += dt; S.stats.comboMaxSecs += dt;
      if (S.comboMaxT >= C.furiaHold) { S.comboMaxT = 0; S.furia = C.furiaSec; if (!FAST) { fx.speedlines(true, { col: PAL.red }); sfx('howl'); ui(() => UI.banner('FÚRIA DO KOME!', 'iene ×2 por 5 segundos', { icon: 'bolt', tone: 'gold', dur: 1.4 })); } }
    } else S.comboMaxT = 0;
    if (S.furia <= 0 && !FAST && fx._fl) { fx.speedlines(false); fx._fl = false; } else if (S.furia > 0) fx._fl = true;
    // pagamentos chegando no coletor
    for (let i = 0; i < pays.length; i++) { const e = pays[i]; if (e.on && (e.t -= dt) <= 0) { e.on = false; credit(e.v, e.kind, e.crit); } }
    // ¥/s (média móvel)
    S.ipsT += dt;
    if (S.ipsT >= 1) { const raw = S.ipsAcc / S.ipsT, rawP = (S.ipsAccP || 0) / S.ipsT; S.ipsAccP = 0; if (TOOLS[S.tool] === cur && S.play < 0 && !S.twinPlay) S.stats.topIps = (S.stats.topIps || rawP) + (rawP - (S.stats.topIps || rawP)) * 0.04;   // média de verdade com você na melhor máquina
      S.ips += (raw - S.ips) * 0.22; S.ipsAcc = 0; S.ipsT = 0; if (S.ips > S.stats.bestIps) S.stats.bestIps = S.ips;
      // ¥/s com você na melhor máquina (o Goma garante 80% disso quando você troca); guarda o nível de Oficina daquele momento
      if (TOOLS[S.tool] === cur && S.play < 0 && !S.twinPlay) S.stats.topWk = G.Inf ? G.Inf.mult(cur.id) : 1; }
    // deslizamento (s12)
    if (st.slide && heap.flow > 40000 * dt && S.slide <= -30) { S.slide = 3; ui(() => UI.banner('DESLIZAMENTO!', 'iene ×1,5 por 3 segundos', { icon: 'bolt', dur: 1.4 })); if (!FAST) quake(0.5); }
    // sacos
    if (hold && S.digT < 1) S.sackT -= dt;
    if (S.sackT <= 0) { S.sackT = D.SACK.every * U.rnd(D.SACK.jitter[0], D.SACK.jitter[1]) / AM('sackRate'); spawnSack(); }
    for (let i = S.sacks.length - 1; i >= 0; i--) {
      const k = S.sacks[i]; k.t += dt;
      const gy = heap.surf(k.x);
      if (k.y < gy) { k.vy += 900 * dt; k.y = Math.min(gy, k.y + k.vy * dt); }
      if (k.state === 0 && st.autosack && k.t > 2) tapSack(k);
      if (k.state === 1) { k.sh -= dt; if (k.sh <= 0) { popSack(k); S.sacks.splice(i, 1); continue; } }
      else if (k.t > D.SACK.life) S.sacks.splice(i, 1);
    }
    // onigiri da sorte
    if (st.oni > 0) {
      const o = S.oni;
      if (!o.on) { S.oniT -= dt; if (S.oniT <= 0) { o.on = true; o.t = 0; o.x = -30; o.y = 110 + Math.random() * 120; o.n = S.own.s9 ? 2 : 1; S.oniT = U.rnd(D.ONIGIRI.every[0], D.ONIGIRI.every[1]); sfx('trill'); } }
      else { o.t += dt; o.x = -30 + (W + 60) * o.t / D.ONIGIRI.life; if (o.t > D.ONIGIRI.life) o.on = false; }
    }
    // patada sísmica (c3)
    if (st.stomp && cur.seat === 'paw' && hold && S.digT < 0.5) {
      S.stompT += dt;
      if (S.stompT >= D.STOMP.every) {
        S.stompT = 0; digO.pow = cur.pow * st.powMul;
        const x = P.x + P.face * cur.reach;
        onDug(heap.dig(x, cur.A * st.dig * D.STOMP.worthSec, cur.r * D.STOMP.radMul, digO), x, P.y);
        if (!FAST) { quake(0.35); parts.puff(x, P.y, 10, 9, { c: PAL.sand }); fx.shock && fx.shock(cam.toScreen(x, P.y).x, cam.toScreen(x, P.y).y); sfx('stomp'); }
      }
    }
    S.slide = S.slide > 0 ? S.slide : Math.max(-31, S.slide - dt);
    // recarga de segurança (anti-encalhe): agora mora no soCasaTick (só falta a casa), anunciada e longe do núcleo dourado
  }

  /* ---- sacos (recompensa variável com antecipação) ---- */
  function spawnSack() {
    if (S.sacks.length >= 4) return;
    let r = Math.random(), gi = 0; const GA = D.SACK.gacha;
    for (; gi < GA.length - 1; gi++) { if (r < GA[gi].p) break; r -= GA[gi].p; }
    if (G.Amuletos) gi = Math.min(GA.length - 1, Math.max(gi, G.Amuletos.val('sackFloor')));   // Trio da Sorte / Saco do Imperador
    const x = U.clamp(P.x - P.face * U.rnd(50, 110) / Math.min(1, cam ? cam.z : 1), 950, WL.MX1);
    S.sacks.push({ x, y: heap.surf(x) - 160, vy: 0, t: 0, g: gi, state: 0, sh: 0, v: 0 });
  }
  function tapSack(k) {
    if (k.state) return;
    const ga = D.SACK.gacha[k.g];
    k.state = 1; k.sh = FAST ? 0 : ga.shake;
    k.v = ga.m * D.SACK.worthSec * Math.max(S.ips, cur.A * EC.P0) * st.sack * U.rnd(D.SACK.vary[0], D.SACK.vary[1]);
    sfx('sack');
  }
  function popSack(k) {
    const ga = D.SACK.gacha[k.g];
    S.stats.sacks++; if (k.v > S.stats.bestSack) S.stats.bestSack = k.v;
    pay(k.v, k.x, k.y, 2);
    em.emit('sack', k);
    if (FAST) return;
    floaters.add(k.x, k.y - 30, 'saco ×' + String(ga.m).replace('.', ',') + '  +¥' + U.fmt(k.v), { c: ga.m >= 3 ? PAL.gold : PAL.cream, size: ga.m >= 10 ? 30 : ga.m >= 3 ? 20 : 14, life: 1.5 });
    parts.coins(k.x, k.y - 10, ga.m >= 3 ? 16 : 6); parts.burst(k.x, k.y - 8, 14, { shape: 'grain', c: S.own.s5 ? PAL.sakura : PAL.rice, speed: [40, 160], life: 0.8 });
    sfx('pop');
    if (ga.m >= 10) { fx.hitstop(0.08); fx.flash(PAL.goldL, 0.3, 0.5); ui(() => UI.banner('SACO LENDÁRIO ×10!', '+¥' + U.fmt(k.v), { icon: 'sack', tone: 'gold' })); }
  }
  function tapOnigiri() {
    const o = S.oni; if (!o.on) return;
    o.on = false; S.stats.onigiri++;
    const v = (o.n > 1 ? D.ONIGIRI.worthSec2 : D.ONIGIRI.worthSec) * Math.max(S.ips, cur.A * EC.P0);
    pay(v, P.x, P.y, 2);
    if (!FAST) { ui(() => UI.toast('Onigiri da Sorte!', { icon: 'star', tone: 'gold', sub: '+¥' + U.fmt(v) })); sfx('sparkle'); fx.flash(PAL.cream, 0.2, 0.3); }
  }
  // tapAll(): estoura tudo que dá pra tocar (autoplayer)
  function tapAll() { for (const k of S.sacks) tapSack(k); if (S.oni.on) tapOnigiri(); }

  /* ---- automação abstrata (Fase 2 troca por ajudantes e pilotos de verdade, cavando o mesmo heightfield) ---- */
  function autoTick(dt) {
    S.autoT += dt; if (S.autoT < 0.5) return;
    const d = S.autoT; S.autoT = 0;
    const kHV = EC.P0 * (EC.EXTRA_BY_TOOL[S.tool] || 1) * st.sell * st.val * st.hv;   // frota e ajudantes: sempre no nível da melhor ferramenta
    if (st.help > 0) {
      const A = TOOLS[Math.min(S.tool, D.toolIndex.escav)].A, r = cur.r * 1.5;
      digO.pow = cur.pow * st.powMul;
      const x = helpBase() + U.rnd(-6, 6) * Math.min(cur.r, 30);
      const res = heap.dig(x, st.help * EC.HR * A * st.hm * d, Math.max(18, r), digO);
      if (res.got > 0) { S.dug += res.got; pay(res.val * kHV, x, heap.surf(x), 1); if (G.Items) G.Items.add(res.byMat); }
    }
    for (let i = 0; i < S.fleet.length; i++) {
      const f = S.fleet[i]; if (!st.pilots[f.id]) continue;
      const t = TOOLS[D.toolIndex[f.id]], wk = G.Inf ? G.Inf.mult(f.id) : 1;   // nível da Oficina vale pro shiba que pilota
      digO.pow = t.pow * (G.Inf ? G.Inf.powK(f.id) : 1);
      const x = f.biteX ? f.biteX : S.footX + 30 + ((i * 97 + (S.time * 13 | 0) * 53) % 260);   // cava onde a máquina está, se ela estiver cavando
      const res = heap.dig(x, EC.PR * t.A * st.pm * d, t.r * 1.5, digO);
      if (res.got > 0) { S.dug += res.got; pay(res.val * kHV * wk, x, heap.surf(x), 1); if (G.Items) G.Items.add(res.byMat); }
    }
    // o Kome trocou pra uma ferramenta antiga: o Goma pilota a melhor máquina e ela continua faturando (a renda não cai)
    if ((S.play >= 0 && TOOLS[S.tool] !== cur) || S.twinPlay) {
      const t = TOOLS[S.tool], wk = G.Inf ? G.Inf.mult(t.id) : 1;
      digO.pow = t.pow * (G.Inf ? G.Inf.powK(t.id) : 1);
      let x = S.footX + 20;
      if (t.kind === 'bagger' && S.bag && S.bag.m && G.Tools.bagger.bite) { const bb = G.Tools.bagger.bite(S.bag.m); if (bb && bb.x) x = bb.x; }
      const res = heap.dig(x, EC.PR * 2 * t.A * st.pm * d, t.r * 1.5, digO);   // cava de verdade (montanha diminui lá)
      if (res.got > 0) S.dug += res.got;
      // renda garantida: ~80% do ¥/s que você fazia nela (medido quando era você pilotando), com os níveis da Oficina dela
      const base = (S.stats.topIps || 0) * 0.75 * d;
      if (base > 0) pay(base * wk / Math.max(1, S.stats.topWk || 1), x, heap.surf(x), 1);
    }
  }

  /* =====================================================================
     5. Condutores das ferramentas (um por kind). Todos usam a interface comum G.Tools[id].
     ===================================================================== */
  const inp = { x: 0, y: 0, face: 1, tx: 0, ty: 0, digging: false, power: 1, speedMul: 1, vx: 0, floor: floorFn, load: 0, t: 0, parts: null, boost: 0, night: 0, zoom: 1, horn: false };
  const iL = { x: 0, y: 0, face: 1, tx: 0, ty: 0, digging: false, power: 1, speedMul: 1, vx: 0, floor: floorFn, t: 0, parts: null, boost: 0, night: 0 };            // pá do Tetsu
  const iT = { x: 0, y: 0, face: 1, tx: 0, ty: 0, digging: false, power: 1, speedMul: 1, vx: 0, floor: floorFn, t: 0, parts: null, boost: 0, night: 0, loader: true }; // caminhão do Kome
  const iF = { x: 0, y: LANE_Y, face: 1, tx: null, ty: null, digging: false, power: 0.3, speedMul: 1, vx: 0, floor: flatFn, t: 0, parts: null, boost: 0, night: 0, zoom: 1 }; // frota parada
  const LX = { x: 0, vx: 0 };                                     // posição da pá carregadeira (degrau do caminhão)

  function animSpeed() { return U.clamp(Math.sqrt(st.dig) * (S.estreia > 0 ? 1.6 : 1) * (S.furia > 0 ? 1.2 : 1), 0.6, 2.4); }
  // gasta o orçamento de cava quando a mordida está ativa
  function biteStep(m, tool, face, working, dt, src) {
    const A = Aeff();
    if (working) S.budget = Math.min(S.budget + A * dt, A * Math.max(1.5, (cur.cycle || 1.2) * 1.5));
    const b = tool.bite(m);
    if (b.active && S.budget > 0) {
      const take = S.budget;
      if (cur.kind === 'jack') { b.x -= cur.r * 0.5; S.budget = digAt(b, take, 1, 'rect', cur.r); b.x += cur.r * 0.5; } else S.budget = digAt(b, take, face);
    }
    return b;
  }
  function toolEvents(m) {
    let payNow = false;
    for (let i = 0; i < m.ev.length; i++) {
      const ev = m.ev[i];
      if (cur.pay.indexOf(ev) >= 0) payNow = true;
      if (FAST) continue;
      if (ev === 'hit' || ev === 'tic' || ev === 'scoop' || ev === 'tat' || ev === 'clank') {
        if (sndT <= 0) { const hand = cur.kind === 'hand'; sndT = ev === 'tat' || ev === 'clank' ? 0.09 : hand ? 0.14 : 0.07; sfx(cur.sfx, { pitch: (hand ? 0.94 + Math.random() * 0.1 : 1) + S.combo * 0.002, vol: ev === 'tat' ? 0.5 : hand ? 0.5 : 0.85 }); }
        if (S.opts.shake && cur.shake && ev !== 'tic') quake(cur.shake * (ev === 'tat' || ev === 'clank' ? 0.25 : 1));
      } else if (ev === 'dump') { sfx('dump'); if (S.opts.shake) quake(cur.shake * 1.3); }
      else if (ev === 'spin') { sfx('whoosh'); if (S.opts.shake) quake(0.3); }
      else if (ev === 'squeak') sfx('squeak', { vol: 0.5 });
      else if (ev === 'rev') sfx('engineStart', { vol: 0.5 });
      else if (ev === 'horn') sfx('hornBig');
      else if (ev === 'stall') { sfx('groan'); quake(0.3); }
      else if (ev === 'crack') sfx('crash', { vol: 0.5 });
    }
    return payNow;
  }
  function payStep(m, tool, dt, payNow, maxAge) {
    if (S.pend > 0) { S.pendAge += dt; S.payT += dt; }
    const cont = cur.pay.length === 0;
    if (S.pend > 0 && (payNow || (cont && S.payT >= EC.PAY_BATCH) || S.pendAge > maxAge)) {
      const d = tool.dump(m), b = tool.bite(m), src = d && !cont ? d : b;
      flush(src.x, src.y, 1);
    }
  }

  /* Kome a pé: anda até o ponteiro, cai com a gravidade na encosta e a ferramenta morde onde o ponteiro está */
  const gravK = () => { const e = G.Islands && G.Islands.event(); return e && e.grav ? e.grav : 1; };   // gravidade fofa (Ilha de Mochi)
  const AIR = { h: 0 }, airFloor = x => floorFn(x) - AIR.h;
  function driveHand(dt, hold) {
    const m = S.m, jack = cur.kind === 'jack', cart = cur.kind === 'push';
    const dx = ptr.wx - P.x;
    if (hold && !m.busy && Math.abs(dx) > 8) P.face = dx > 0 ? 1 : -1;
    const reach = (jack ? 8 : cur.reach * st.reach);
    const xT = ptr.wx - P.face * reach, dist = xT - P.x, spd = cur.spd * st.spd * 0.55;
    const want = hold && !(m.busy && !jack) ? U.clamp(dist * 9, -spd, spd) : 0;
    P.vx = U.damp(P.vx, want, 12, dt);
    P.x = U.clamp(P.x + P.vx * dt, 60, WL.WW - 60);
    const gy = heap.surf(P.x);
    if (P.y < gy - 1.5) { P.vy += 1500 * gravK() * dt; P.y += P.vy * dt; P.ground = false; if (P.y >= gy) { P.y = gy; P.vy = 0; P.ground = true; } }
    else { P.y = gy; P.vy = 0; P.ground = true; }
    inp.x = P.x; inp.y = P.y; inp.face = P.face; inp.vx = P.vx; inp.tx = ptr.wx; inp.ty = ptr.wy;
    inp.digging = hold && P.ground && Math.abs(dist) < (cart ? 14 : 7);
    inp.speedMul = animSpeed(); inp.boost = S.estreia > 0 ? 1 : 0; inp.t = S.time;
    // no pulo o "chão" da ferramenta sobe junto com o Kome (senão a pá/tigela ficava grudada no chão lá embaixo)
    AIR.h = P.ground ? 0 : Math.max(0, heap.surf(P.x) - P.y); inp.floor = AIR.h > 1 ? airFloor : floorFn;
    inp.grainMul = (S.own.c1 ? 1.7 : 1) * (S.own.cA ? 1.3 : 1);
    // cavar no chão (fora da montanha) não rende: a ferramenta bate na terra e o Kome fica tontinho
    if (S.stunCD > 0) S.stunCD -= dt;
    if (S.stun > 0) { S.stun -= dt; inp.digging = false; P.vx = 0; }
    else if (hold && P.ground && !cart && ptr.wy > -6 && Math.abs(ptr.wx - P.x) < reach + 24 && heap.height(ptr.wx) < 5 && heap.height(P.x + P.face * 30) < 5) {
      if (!(S.stunCD > 0)) { S.stun = 0.9; S.stunCD = 1.4; inp.digging = false; if (!FAST) { sfx('thud'); quake(0.15); floaters.add(ptr.wx, ptr.wy - 20, 'TONC!', { c: PAL.cream, size: 16 }); parts.puff(ptr.wx, 0, 6, 6, { c: PAL.sand }); } }
      else inp.digging = false;
    }
    T.update(m, dt, inp);
    feelTick(dt, hold);
    const payNow = toolEvents(m);
    if (cart) {
      // carrinho: a trombada derruba um pedaço do barranco pra dentro da caçamba (adendo §4)
      const A = Aeff();
      if (inp.digging || m.busy) S.budget = Math.min(S.budget + A * dt, A * 1.6);
      for (let i = 0; i < m.ev.length; i++) if (m.ev[i] === 'hit' && S.budget > 0) {
        const b = T.bite(m);
        S.budget = digAt(b, S.budget, P.face, 'rect', cur.r * 1.6); S.cartCrown = Math.random() < D.CART.crownChance;
        if (!FAST) { fx.hitstop(0.035); if (S.cartCrown) floaters.add(b.x, b.y - 30, 'carga coroada!', { c: PAL.gold, size: 14 }); }
      }
      if (payNow && S.cartCrown) { S.pend *= D.CART.crownMult; S.stats.crowned++; S.cartCrown = false; }
    } else biteStep(m, T, P.face, inp.digging || (m.busy && !jack), dt);
    if (!FAST && st.spd > 1 && Math.abs(P.vx) > 60 && Math.random() < dt * 14) parts.puff(P.x - P.face * 8, P.y, 1, 4, { c: PAL.sand });
    payStep(m, T, dt, payNow, 2.5);
  }

  /* máquinas de cabine (trator, empilhadeira, escavadeira, pá de cabo): estacionam na distância de trabalho do barranco */
  /* viagem com peso (dono 19/11: máquina grande cobre o terreno grande): vai até xT a no máx vmax px/s, acelera/freia em
     ~tau s (a = vmax/tau) e começa a frear a tempo de parar no alvo (sem passar e voltar). stop = parar (ciclo em andamento,
     soltou o dedo). Devolve o x novo; a velocidade fica em o.vx. */
  function travel(x, o, xT, vmax, tau, dt, stop) {
    const a = vmax / Math.max(0.05, tau), d = xT - x, ad = Math.abs(d);
    const want = stop || ad < 2 ? 0 : Math.sign(d) * Math.min(vmax, Math.sqrt(2 * a * 0.8 * ad), ad * 10);
    const braking = Math.abs(want) < Math.abs(o.vx) || want * o.vx < 0, mdv = a * dt * (braking ? 1.6 : 1);
    o.vx += U.clamp(want - o.vx, -mdv, mdv);
    if (!(o.vx === o.vx)) o.vx = 0;
    return x + o.vx * dt;
  }
  const VMAX = t => t.vmax || 130, TAU = t => t.tau || 0.2;
  function parkAt(x, vxObj, park, maxV, busy, dt, hold, noPtr, tau) {
    const fxr = faceAhead(x, 16, 900);
    let xT = fxr - park;
    if (hold && !noPtr) xT = Math.min(xT, ptr.wx - park * 0.5);
    xT = Math.max(WL.MX0 - 300, xT);
    parkAt.face = fxr; parkAt.near = Math.abs(fxr - park - x) < 34;
    return travel(x, vxObj, xT, maxV, tau || 0.2, dt, busy || !hold);
  }
  // máquinas que sobem a montanha (trator, colheitadeira, empilhadeira, escavadeira): só param num paredão íngreme
  const CLIMB = { trator: 1, fork: 1, escav: 1 };
  function climbFace(x, max) {
    for (let d = 8; d <= max; d += 8) if (heap.height(x + d + 8) - heap.height(x + d) > 10) return x + d;   // inclinação > ~51°
    return x + max;
  }
  function parkClimb(x, o, park, maxV, busy, dt, hold, noPtr, tau) {
    const wall = climbFace(x, 1400);
    let xT = Math.min(wall - park, hold ? ptr.wx - park * 0.55 : x);
    xT = Math.max(WL.MX0 - 300, xT);
    parkAt.face = Math.min(wall, x + park + 10); parkAt.near = Math.abs(xT - x) < 34 || x >= wall - park - 6;
    return travel(x, o, xT, maxV, tau || 0.2, dt, busy || !hold);
  }
  function driveMachine(dt, hold) {
    const m = S.m, fork = cur.kind === 'fork', climb = CLIMB[cur.kind];
    P.x = (climb ? parkClimb : parkAt)(P.x, P, cur.park, VMAX(cur), m.busy, dt, hold, false, TAU(cur));
    P.y = heap.surf(P.x); P.face = 1;
    inp.x = P.x; inp.y = P.y; inp.face = 1; inp.vx = P.vx; inp.floor = floorFn; inp.t = S.time;
    inp.tx = climb ? Math.max(ptr.wx, P.x + 20) : Math.max(ptr.wx, parkAt.face + 10); inp.ty = Math.min(ptr.wy, P.y + 10);
    inp.digging = hold && parkAt.near; inp.speedMul = animSpeed(); inp.boost = S.estreia > 0 ? 1 : 0;
    T.update(m, dt, inp);
    const payNow = toolEvents(m);
    if (fork) {
      // empilhadeira: arranca um bloco no vão dos garfos (digRect) a cada espetada
      const A = Aeff();
      if (inp.digging || m.busy) S.budget = Math.min(S.budget + A * dt, A * 2);
      for (let i = 0; i < m.ev.length; i++) if (m.ev[i] === 'scoop' && S.budget > 0) {
        const b = T.bite(m), w = Math.max(24, b.w || 36) + 8;
        b.x -= w - 8; S.budget = digAt(b, S.budget, 1, 'rect', w); b.x += w - 8;
      }
    } else biteStep(m, T, 1, inp.digging || m.busy, dt);
    payStep(m, T, dt, payNow, 3.5);
  }

  /* caminhão de mineração: o Tetsu carrega com a pá de cabo, o Kome leva até a moega; o ¥ sai na basculada */
  function driveHaul(dt, hold) {
    const tr = S.m, sh = S.loader, TS = G.Tools.escav, TT = T, park = TOOLS[D.toolIndex.escav].park;
    // segurar em cima do caminhão (inclusive na caçamba) ou na frente = carregar; só bem atrás dele = "leva embora já"
    // (antes era P.x - 60: clicar na caçamba fazia ele dar ré pro pátio e parecer travado)
    const loadSide = ptr.wx > P.x - 380;
    const far = Math.abs(faceAhead(LX.x, 16, 900) - park - LX.x) > 160;   // longe da montanha (ex.: save com o caminhão no pátio): vem rápido
    LX.x = parkAt(LX.x, LX, park, far ? VMAX(cur) : Math.min(VMAX(cur), 160), sh.busy, dt, hold && loadSide, true, TAU(cur));   // a pá do caminhão fica na montanha (não segue o mouse)
    iL.x = LX.x; iL.y = heap.surf(LX.x); iL.vx = LX.vx; iL.t = S.time; iL.tx = parkAt.face + 30; iL.ty = Math.min(ptr.wy, -40);
    iL.speedMul = iT.speedMul = animSpeed() * EC.HAUL_SPEED;
    const wantLoad = hold && loadSide && tr.load < 1.0;
    iL.digging = wantLoad && tr.wantsLoad && parkAt.near;
    TS.update(sh, dt, iL);
    // a pá cava (orçamento corre enquanto o ciclo do caminhão roda)
    const cyc = hold || tr.state !== 'idle';
    const A = Aeff();
    if (cyc) S.budget = Math.min(S.budget + A * dt, A * cur.cycle * 1.5);
    const b = TS.bite(sh);
    if (b.active && S.budget > 0) { const take = Math.min(S.budget, A * dt * 12); S.budget += digAt(b, take, 1) - take; }
    if (TS.dump(sh).active && tr.wantsLoad) TT.fill(tr, dt * iL.speedMul / (0.09 * 3.6) * 0.34);
    { const dd = TS.dump(sh); if (dd && dd.active) LX.dOff = U.damp(LX.dOff || -170, dd.x - LX.x, 3, dt); }
    iT.x = LX.x + (LX.dOff || -170) + TT.parkX(0, 1, 0, 1); iT.y = heap.surf(iT.x); iT.vx = LX.vx; iT.t = S.time;
    iT.tx = loadSide || !hold ? parkAt.face : iT.x - 600;
    iT.digging = hold && loadSide && (tr.load < 1.0 || (sh.busy && sh.ph < 0.76));
    TT.update(tr, dt, iT);
    P.x = iT.x; P.y = iT.y; P.face = 1;
    let payNow = false;
    for (let i = 0; i < tr.ev.length; i++) {
      const ev = tr.ev[i];
      if (ev === 'dump') { payNow = true; if (!FAST) { sfx('dump'); if (S.opts.shake) quake(0.5); } }
      else if (ev === 'depart') { S.haulCrown = !!tr.crowned; if (tr.crowned) { S.stats.crowned++; if (!FAST) floaters.add(iT.x, iT.y - 220, 'CARGA COROADA ×1,25', { c: PAL.gold, size: 26 }); } else if (!FAST && tr.payload < 1) floaters.add(iT.x, iT.y - 220, Math.round(tr.payload * 100) + '%: faltou ' + Math.round((1 - tr.payload) * 100) + '% pra carga coroada', { c: PAL.cream, size: 20 }); sfx('hornBig', { vol: 0.4 }); }
      else if (ev === 'rev' && !FAST) sfx('engineStart', { vol: 0.5 });
    }
    for (let i = 0; i < sh.ev.length; i++) if (!FAST && (sh.ev[i] === 'hit' || sh.ev[i] === 'scoop') && sndT <= 0) { sndT = 0.2; sfx('excavator'); if (S.opts.shake) quake(0.2); }
    if (S.pend > 0) S.pendAge += dt;
    if (S.pend > 0 && (payNow || S.pendAge > 45)) { const d = TT.dump(tr) || iT; flush(d.x, d.y, payNow && S.haulCrown ? D.HAUL.crown : 1); }
  }

  /* ZONA MORTA da Bagger ("a bagger não limpa o chão"): a roda fica sempre ~560 à frente do corpo (lança curta não traz ela
     pra perto) e o corpo para 300 antes de qualquer arroz > 34 de altura. Cavando com a roda no alto sobrava um degrau baixo
     (~160) entre as esteiras e a roda que ninguém alcançava, e a Bagger ficava parada atrás dele. Segurando, ela raspa esse
     banco (só colunas até `lim` de altura, entre xa e xb), dentro de um orçamento de área (budget) pra não virar renda grátis. */
  function shaveShelf(xa, xb, lim, budget, maxD) {
    if (!(xb > xa + 8) || !(budget > 0)) return;
    let w = 0;
    for (let x = xa; x <= xb; x += 4) { const hh = heap.height(x); if (hh > 0.3 && hh <= lim) w += 4; }
    if (w < 8) return;
    const depth = Math.min(budget / w, maxD);
    digO.pow = cur.pow * st.powMul;
    let a = -1;
    for (let x = xa; x <= xb + 4; x += 4) {
      const hh = x <= xb ? heap.height(x) : 0, ok = hh > 0.3 && hh <= lim;
      if (ok && a < 0) a = x;
      else if (!ok && a >= 0) { const r = heap.digRect(a, x - 4, depth, digO); a = -1; if (r.got > 0) { S.dug += r.got; S.pend += r.val * yenK(); if (G.Items) G.Items.add(r.byMat); } }
    }
  }

  /* Bagger 293: fica no chão no pé da montanha, rasteja até o ponteiro, o ponteiro em Y é a lança, segurar gira a roda */
  function driveBagger(dt, hold) {
    const m = S.m, MO = D.MORDIDA, b0 = T.bite(m);
    let hx = m.x - 150;
    for (; hx < WL.MX1; hx += 8) if (heap.height(hx) > 70) break;
    // a Bagger não entra na montanha: o corpo para antes do pé; ela avança conforme a roda vai abrindo caminho
    let fx0 = m.x - 330 * (m.k || 1); for (; fx0 < WL.MX1; fx0 += 8) if (heap.height(fx0) > 34) break;
    const mk = m.k || 1, bodyMax = fx0 - 300 * mk;   // Gêmea (mk 1,5) para mais longe: corpo maior
    const maxX = Math.min(hx - 340 * mk, bodyMax) + (b0.x - m.x);   // o alvo da roda já respeita o corpo (viajando rápido não bate e volta)
    inp.x = P.x; inp.y = 0; inp.face = 1; inp.floor = baggerFloor; inp.t = S.time; inp.zoom = cam.z;
    inp.tx = hold ? Math.min(maxX, Math.max(ptr.wx, Wd.X.front - Wd.X.lane + 70 + 780 * mk + (b0.x - m.x))) : b0.x; inp.ty = ptr.wy;   // de ré, para antes do pátio
    inp.digging = hold || S.cele.spin; inp.speedMul = animSpeed() * (S.own.b1 ? 1.2 : 1); inp.boost = S.estreia > 0 ? 1 : 0;
    { const bt0 = TOOLS[D.toolIndex.bagger]; inp.crawl = VMAX(bt0) * mk; inp.crawlTau = TAU(bt0) * mk; }   // Gêmea (mk 1,5): maior = mais rápida e mais pesada
    inp.horn = S.hornT > 0; if (S.hornT > 0) S.hornT -= dt;
    const bt = heap.bite(b0.x, b0.y, b0.r, 1, 12);
    m.bite01 = bt; m.band = st.mordida ? [MO.loK, MO.hiK] : [MO.lo, MO.hi];
    T.update(m, dt, inp);
    if (m.x > bodyMax) { m.x = Math.max(bodyMax, m.x - 400 * dt); if (m.vx > 0) m.vx = 0; }
    P.x = m.x; P.y = 0;
    const payNow = toolEvents(m), b = T.bite(m);
    // multiplicador da Mordida (GDD §3)
    let mult = 1, perfect = bt >= m.band[0] && bt <= m.band[1];
    if (S.perfectForce > 0) { S.perfectForce -= dt; perfect = true; }
    if (perfect) mult = st.mordida ? MO.mPerfectK : MO.mPerfect; else if (bt < MO.empty) mult = MO.mEmpty;
    if (hold && perfect && b.active) {
      S.stats.perfectSecs += dt; S.perfT += dt;
      if (st.mordida && S.perfT >= MO.x3After) { S.perfT = 0; if (Math.random() < MO.x3Chance) { S.x3T = 1; if (!FAST) floaters.add(b.x, b.y - 180, '×3 NESTA MORDIDA', { c: PAL.gold, size: 60 }); } }
    } else S.perfT = 0;
    if (S.x3T > 0) { S.x3T -= dt; mult *= 3; }
    S.mordida = perfect ? 2 : bt < MO.empty ? 0 : 1; S.bite01 = bt;
    if (b.active && hold) {
      digO.pow = cur.pow * st.powMul;
      const res = heap.digCircle(b.x, b.y, b.r * (st.boom > 1 ? 1.12 : 1), Aeff() * (m.rpm || 1) * mult * dt, digO);
      onDug(res, b.x, b.y);
      if (!FAST && res.fell > 0 && Math.random() < 0.5) parts.spray(b.x + 40, b.y - b.r, 2, { shape: 'grain', c: perfect ? PAL.goldL : PAL.rice, dir: Math.PI / 2, spread: 1, speed: [60, 200], life: 0.9, w: 7, g: 900 });
      if (!FAST && S.opts.shake) quake(dt * (perfect ? 0.5 : 0.25));
    }
    // as esteiras alisam o arroz embaixo delas
    digO.pow = 99;
    const fl = heap.digRect(m.x - 330, Math.min(m.x + 330, fx0 - 12), 160 * dt, digO);
    if (fl.got > 0) { S.dug += fl.got; S.pend += fl.val * yenK(); if (G.Items) G.Items.add(fl.byMat); }
    if (hold && b.active) shaveShelf(fx0 - 12, b.x - b.r * 0.7, 220 * mk, Aeff() * dt * 0.4, 140 * dt);
    payStep(m, T, dt, payNow, 1);
  }

  /* frota: máquinas antigas estacionadas no pátio (cenário vivo; a Fase 2 põe elas pra trabalhar) */
  function rebuildFleet() {
    const ids = [];
    for (const id of ['trator', 'colheita', 'empilhadeira', 'escav', 'pacabo', 'caminhao']) {
      const i = D.toolIndex[id];
      if (i <= S.tool && TOOLS[i] !== cur && !(id === 'pacabo' && cur.kind === 'haul')) ids.push(id);
    }
    S.fleet = ids.map(id => {
      const old = S.fleet.find(f => f.id === id);
      return old || { id, x: PARK(id), y: LANE_Y, m: G.Tools[id].create({ pilot: PILOT_PAL[id], scale: 1 }), warm: false };
    });
  }
  /* máquinas antigas com piloto trabalham de verdade (o rendimento é sempre o do autoTick; aqui só muda ONDE elas aparecem):
     - Kome a pé (pá, carrinho, britadeira) e nenhuma gigante na frente: saem do pátio pela faixa da frente, cavam alguns ciclos
       no pé da montanha (f.biteX = onde a renda cava) e voltam.
     - Kome numa máquina de cabine, caminhão ou Bagger na frente de lavra: o barranco fica todo da máquina grande (ele é íngreme,
       60 a 74 graus: não tem como subir nem onde apoiar bancada sem ficar em cima da gigante). As pequenas trabalham NA VAGA,
       cada uma na sua BANCADA DE RECHEGO (montinho de arroz na frente da vaga, desenhado pelo game-world.js): não atravessam
       ninguém, não sobem encosta e a renda cava espalhado no pé da montanha (autoTick), sem abrir entalhe. */
  const WORKERS = { trator: 1, colheita: 1, empilhadeira: 1, escav: 1 };
  const iW = { x: 0, y: 0, face: 1, tx: null, ty: null, digging: false, power: 1, speedMul: 1, vx: 0, floor: null, t: 0, parts: null, boost: 0, night: 0, zoom: 1 };
  function fleetWork(f, i, dt, atFace, bg) {
    const t = TOOLS[D.toolIndex[f.id]], spd = Math.min(220, t.spd * 0.6), TW = G.Tools[f.id].w;
    if (!f.st || !(f.wt === f.wt)) { f.st = 'park'; f.wt = 1.5 + i * 2.2; f.vx = 0; }   // (wt sem número = veio do modo acelerado)
    const home = PARK(f.id);
    let face = home + t.park, digX = home, tx = home;
    if (atFace) {
      // cada uma tem o seu lugar na frente de lavra: fila pela largura real, atrás do Kome (nada encavalado)
      let slot = 0; for (let j = 0; j < i; j++) { const o = S.fleet[j]; if (WORKERS[o.id] && st.pilots[o.id]) slot += G.Tools[o.id].w + 40; }
      face = faceAhead(Math.min(Math.max(f.x, WL.MX0 - 400), S.footX - 40), 16, 1400);
      // segundo plano (decisão do dono): com máquina grande na frente, as pequenas trabalham no pé da montanha ATRÁS dela,
      // menores e escurecidas (desenho em drawFleetBg); não precisam caber na frente da gigante
      let nb = 0; if (bg) for (let j = 0; j < i; j++) { const o = S.fleet[j]; if (WORKERS[o.id] && st.pilots[o.id]) nb++; }
      digX = bg ? face - t.park - slot * 0.55 : Math.min(face - t.park, P.x - (T.w || 100) / 2 - TW / 2 - 40) - slot;
      if (!bg && digX - TW / 2 < Wd.X.x0 + 16) { atFace = false; face = home + t.park; digX = home; }   // não cabe entre o pátio e o Kome: trabalha na vaga
    }
    const far = Math.abs(f.x - home) > 10;
    if (f.st === 'park') { f.x = home; f.wt -= dt; if (f.wt <= 0) { f.st = atFace ? 'go' : 'dig'; f.wt = atFace ? 0 : 16 + (i * 5) % 9; } }
    else if (f.st === 'go') { tx = digX; if (!atFace) f.st = 'back'; else if (Math.abs(f.x - digX) < 6) { f.st = 'dig'; f.wt = 26 + i * 4; } }
    else if (f.st === 'dig') { tx = atFace ? digX : home; f.wt -= dt; if (f.wt <= 0 || (!atFace && far)) { f.st = far ? 'back' : 'park'; f.wt = 3 + (i * 3) % 4; } }
    else if (f.st === 'back') { tx = home; if (!far) { f.st = 'park'; f.wt = 1.5 + i * 0.4; } }
    const want = U.clamp((tx - f.x) * 2, -spd, spd);
    f.vx = U.damp(f.vx || 0, want, 4, dt); f.x += f.vx * dt; f.y = LANE_Y;
    f.bay = !atFace && f.st === 'dig' && !far;         // trabalhando na bancada de rechego da vaga
    f.bayOn = !atFace;
    const digNow = f.st === 'dig' && (f.bay || Math.abs(f.x - digX) < 12);
    iW.x = f.x; iW.y = f.y; iW.face = f.st === 'back' ? -1 : 1; iW.vx = f.vx; iW.t = S.time; iW.parts = FAST ? null : parts;
    iW.floor = flatFn; iW.digging = digNow; iW.tx = face + 10; iW.ty = f.bay ? LANE_Y - 16 : heap.surf(face + 10);
    G.Tools[f.id].update(f.m, dt, iW); f.warm = true;
    f.bg = !!(bg && atFace); f.dX = digX;
    if (f.bg) { iW.tx = f.x + 60; iW.ty = LANE_Y - 4; G.Tools[f.id].update(f.m, 0, iW); }   // na bancada: cava o próprio degrau
    if (atFace && !bg && f.st === 'dig' && digX > face - t.park - 30) { const b = G.Tools[f.id].bite(f.m); if (b && b.active) f.biteX = b.x; } else f.biteX = 0;   // longe do barranco / na vaga: rende pelo autoTick (pé da montanha)
  }
  // frota no segundo plano: menor, um pouco mais alta e escurecida, atrás da máquina grande do Kome
  const BG_K = 0.8, BG_UP = 26;
  // escurecidas: o filtro vai pra dentro da imagem guardada de cada máquina (refeita a cada poucos quadros), não pro quadro inteiro.
  // Antes: tudo numa tela de apoio do tamanho da frota + UM filtro por quadro = ~15-30 ms por quadro no celular (pós-final).
  const BG_FLT = 'brightness(0.72) saturate(0.7)';
  function drawFleetBg(g) {
    for (let i = 0; i < S.fleet.length; i++) {
      const f = S.fleet[i]; if (!f.bg || !f.st || f.st === 'park' || !f.warm || !cam.visible(f.x, f.y - 150, 800)) continue;
      // sem degrau (o dono não gostou): no chão, atrás da máquina grande, menor e um pouco mais alta
      const h = f._bgc || (f._bgc = { always: true, flt: BG_FLT });
      g.save(); g.translate(f.x, f.y - BG_UP); g.scale(BG_K, BG_K); g.translate(-f.x, -f.y); drawMach(g, f.id, f.m, h); g.restore();
    }
  }
  function fleetTick(dt) {
    // só com o Kome a pé e sem gigante na frente as pequenas vão até o barranco; senão trabalham na vaga (bancada de rechego)
    const k = cur.kind, atFace = (k === 'hand' || k === 'push' || k === 'jack') && !S.bag;   // Bagger na frente (montando ou pronta): ninguém passa por cima dela
    for (let i = 0; i < S.fleet.length; i++) {
      const f = S.fleet[i];
      if (st.pilots[f.id] && WORKERS[f.id]) { if (!FAST || !f.warm) fleetWork(f, i, dt, true, !atFace); else { f.x = PARK(f.id); f.y = LANE_Y; f.st = 'park'; f.bay = false; f.biteX = 0; } continue; }
      f.st = null; f.biteX = 0; f.bay = f.bayOn = false; f.x = PARK(f.id); f.y = LANE_Y;
      if (FAST && f.warm) continue;
      if (!f.warm || cam.visible(f.x, -100, 700)) { iF.x = f.x; iF.y = f.y; iF.t = S.time; iF.parts = null; G.Tools[f.id].update(f.m, dt, iF); f.warm = true; }
    }
    if (S.bag && S.bag.m !== S.m && !FAST) {
      // Bagger pronta e o Kome em outra máquina: o Goma assume a cabine e a roda continua girando (não fica parada sem piloto)
      const working = S.tool === NT - 1;
      S.bag.m.pilot = working ? 'goma' : ((S.look && S.look.pal) || 'kome');
      iF.x = S.bagX; iF.y = 0; iF.floor = baggerFloor; iF.zoom = cam.z; iF.digging = working;
      G.Tools.bagger.update(S.bag.m, dt, iF); iF.floor = flatFn; iF.digging = false;
    }
  }
  function ensureBag() {
    const stg = S.tool === NT - 1 ? 3 : S.own.bg2 ? 2 : S.own.bg1 ? 1 : 0;
    if (!stg) return;
    if (!S.bagX) S.bagX = Math.max(1000, scanFoot() - 760);
    if (!S.bag) S.bag = { m: G.Tools.bagger.create({ stage: stg }) };
    S.bag.m.stage = stg;
  }

  /* =====================================================================
     6. Compras e celebração
     ===================================================================== */
  // setTool(i): troca a ferramenta ativa (cria o rig, a frota, o coletor e o som de motor)
  function setTool(i) {
    S.tool = U.clamp(i, 0, NT - 1);
    const di = S.play >= 0 && S.play < S.tool ? S.play : S.tool;   // etapa 5: dá pra jogar com qualquer ferramenta já comprada
    cur = TOOLS[di]; T = G.Tools[cur.id];
    extra = EC.EXTRA_BY_TOOL[di] || 1;   // multiplicador da ferramenta NA MÃO (a melhor fica com o Goma, que garante a renda dela)
    if (S.pend > 0) { credit(S.pend, 0, false); S.pend = 0; }
    S.budget = 0; S.loader = null; P.vx = 0; S.camX = P.x + 30;
    computeStats();
    if (cur.kind === 'bagger') { ensureBag(); S.m = S.bag.m; S.m.stage = 3; P.x = S.bagX;
      const tw = !!(S.twinPlay && G.Ind && (G.Ind.run().giant | 0) >= 4); S.m.k = tw ? 1.5 : 1; S.m.wheels = tw ? 2 : 1; }
    else S.m = T.create({ pilot: (S.look && S.look.pal) || 'kome', scale: 1 });
    if (cur.kind === 'haul') { S.loader = G.Tools.escav.create({ pilot: 'sumi', scale: 1 }); LX.x = Math.max(WL.MX0 - 300, faceAhead(Math.max(P.x - 300, WL.MX0 - 300), 16, 2000) - TOOLS[D.toolIndex.escav].park); LX.vx = 0; }
    if (cur.seat === 'cab' && cur.kind !== 'bagger' && cur.kind !== 'haul') { P.x = Math.max(WL.MX0 - 300, faceAhead(Math.min(P.x, S.footX) - 400, 16, 2000) - cur.park); }
    P.y = heap.surf(P.x); P.face = 1;
    S.col.kind = D.COLLECTOR[di]; S.col.x = P.x - 80;   // coletor da ferramenta NA MÃO (antes a moega da Bagger seguia o Kome com o carrinho)
    S.col.y = heap.surf(S.col.x);
    ensureBag(); yardSnap(); rebuildFleet();
    if (cur.seat === 'paw' && S.tool >= D.toolIndex.trator && P.x < Wd.X.x0 + 90) { P.x = Wd.X.x0 + 90; P.y = heap.surf(P.x); S.col.x = P.x - 80; S.camX = P.x + 30; }   // trocou pra ferramenta de mão: o Kome desce na frente de lavra, não no meio das vagas
    if (loopH) { try { loopH.stop(0.3); } catch (e) { /* */ } loopH = null; }
    if (!FAST && audioOn && Loops && cur.loop && !S.opts.mute) { try { loopH = Loops.start(cur.loop, { vol: 0.35, rate: 0.1 }); } catch (e) { loopH = null; } }
    if (!FAST && Sfx && Sfx.setTool) { try { Sfx.setTool(Math.min(di, 11)); } catch (e) { /* */ } }
    musicTheme();
    HUD.refreshSlots();
  }
  // trocar de lugar: um shiba assume a máquina atual e o Kome pega outra ferramenta já comprada (renda continua a da melhor)
  function playAs(i, twin) {
    i = U.clamp(i | 0, 0, S.tool); if (locked() || cs) return false;
    S.twinPlay = !!twin;
    const was = cur; S.play = i === S.tool ? -1 : i; setTool(S.tool); S.stats.swaps = (S.stats.swaps || 0) + 1;
    if (!FAST) { const f = ['Goma', 'Kuro', 'Shiro', 'Aka', 'Cha'][(Math.random() * 5) | 0];
      ui(() => UI.banner('Troca de lugar!', was === cur ? cur.name : f + ' assume ' + was.name + ' · Kome pega ' + cur.name, { icon: 'swap', dur: 2.2 })); sfx('pling'); fx.flash(PAL.cream, 0.2, 0.3); }
    return true;
  }
  function buyTool() {
    const t = TOOLS[S.tool + 1]; if (!t) return false;
    if (t.needs) for (const id of t.needs) if (!S.own[id]) { ui(() => UI.toast('Precisa: ' + D.nodeById[id].n, { icon: 'lock', tone: 'bad' })); return false; }
    if (G.Modos && G.Modos.lockTool(t)) { ui(() => UI.toast('Só na Pata: nada de motor', { icon: 'lock', sub: 'compre árvore, ajudantes e casa' })); return false; }   // modo de partida (modos.js)
    const c = toolCost(t);
    if (S.money < c) { ui(() => UI.toast('Faltam ¥' + U.fmt(c - S.money), { icon: 'yen', tone: 'bad', sub: t.name })); sfx('error'); return false; }
    S.money -= c; S.stats.buys++;
    const z0 = cam ? cam.z : 1, ips0 = S.ips;
    if (t.kind === 'bagger' && !FAST) { csPlay('bagger', () => { S.play = -1; setTool(S.tool + 1); celebrate(t, z0, ips0); em.emit('buyTool', t); saveNow(); }); return true; }
    S.play = -1; setTool(S.tool + 1);
    celebrate(t, z0, ips0);
    em.emit('buyTool', t);
    if (!FAST) saveNow();
    return true;
  }
  // celebrate(t): trava o controle, revela com zoom-out, bate o nome na tela e liga o "modo estreia"
  function celebrate(t, z0, ips0) {
    const big = t.kind === 'bagger', c = S.cele;
    c.t = 0; c.id = t.id; c.z0 = z0; c.big = big; c.dur = big ? 6.6 : 1.6; c.spin = false; c.step = 0; c.ips0 = ips0;
    S.estreia = (big ? 9 : 1.6) + EC.ESTREIA_SEC;
    if (FAST) return;
    if (big) { fx.vignette(0.9); if (Music && Music.stop) { try { Music.stop(0.3); } catch (e) { /* */ } } }
    else {
      if (Sfx && Sfx.buy && !S.opts.mute) { try { Sfx.buy(); } catch (e) { /* */ } }
      if (t.seat === 'cab') sfx('engineStart', { delay: 0.3 });
      fx.flash(PAL.cream, 0.3, 0.5); fx.confetti(40 + S.tool * 8);
      ui(() => { if (celeCard && celeCard.close) celeCard.close(); celeCard = UI.celebrate({ kicker: 'Nova ferramenta', title: t.name + '!', sub: t.size, icon: G.Props.icon(t.id), dur: 2.2 }); });
    }
  }
  function celeTick(dt) {
    const c = S.cele; if (c.t < 0) return;
    c.t += dt;
    if (c.big) {
      // revelação da Bagger: silêncio -> buzina e roda girando -> zoom-out de 3 s -> carimbo -> mordida perfeita garantida
      if (c.step === 0 && c.t >= 1.0) { c.step = 1; c.spin = true; S.hornT = 1.6; if (!FAST) { sfx('hornBig'); quake(0.5); fx.vignette(0.4); } }
      if (c.step === 1 && c.t >= 4.6) {
        c.step = 2; S.stamp = 2.6;
        if (!FAST) { fx.hitstop(0.12); fx.flash(PAL.cream, 0.4, 0.9); fx.confetti(220); fx.vignette(0); quake(0.8); if (Sfx && Sfx.big && !S.opts.mute) { try { Sfx.big(); } catch (e) { /* */ } } sfx('rumble'); musicTheme(); }
      }
      if (c.step === 2 && c.t >= c.dur) {
        c.step = 3; c.spin = false; S.perfectForce = 6;
        ui(() => { UI.banner('MORDIDA PERFEITA', 'segure o clique: a montanha vai despencar', { icon: 'star', tone: 'gold', level: 3, dur: 2.4 }); UI.achievement('A maior máquina do mundo', { sub: 'Bagger 293 · ¥/s de ¥' + U.fmt(c.ips0) + ' pra muito mais' }); });
      }
    }
    if (c.t >= c.dur + 0.5) c.t = -1;
  }
  // visita: depois de comprar algo que aparece no pátio, a câmera vai até lá ver nascer (a compra tem que aparecer na tela)
  let visit = null;
  /* VILA DO KOME: a câmera voa por cima da montanha até o outro bairro e volta (botão "Vila" no topo, compra de casa/adereço).
     vila.k 0..1 = progresso do voo; o jogo continua rodando, só o dedo/mouse não cava enquanto olha a vila. */
  const vila = { on: false, k: 0, x: 0, y: 0, z: 0.5, auto: 0, hx: 0, hy: 0, hz: 1, fly: 0, dir: 1 };
  function vilaGo(on, x, z, sec) {
    if (cs || S.endOpen || (FAST && on)) return false;   // modo acelerado (testes): o voo só anda nos quadros de tela, não voa
    if (on) { if (vila.k <= 0) { vila.hx = cam.x; vila.hy = cam.y; vila.hz = cam.z; } vila.x = x || Wd.X.vilaCx; vila.z = z || 0.56; vila.auto = sec || 0; }
    vila.on = !!on; vila.grab = false; if (!FAST) sfx('whoosh', { vol: 0.4 });
    return true;
  }
  const locked = () => (S.cele.t >= 0 && S.cele.t < S.cele.dur) || !!visit || S.dayEnd > 0;
  /* VER O PÁTIO: o Pátio da Frota (patio-arte.js) fica DEPOIS da estátua do Kome-Oh, fora do X.minX da câmera de sempre.
     Voo de ida e volta só de CÂMERA (camTick, que não roda no FAST): não trava entrada, sim, save nem o modo acelerado
     (regra de ouro: voo da Vila e cena da Bagger já travaram o FAST). Toque/tecla depois de 0,8 s = volta já. */
  let ptour = null;
  const patioHas = () => { if (!S.ended || !G.PatioArt || !G.PatioArt.real) return false; const p = G.PatioArt.real(); if (!p) return false; for (const k in p) if (p[k].n > 0) return true; return false; };
  function patioTour() {
    if (FAST || cs || S.endOpen || ptour || !G.PatioArt || !G.PatioArt.slots) return false;
    if (vila.on || vila.k > 0) vilaGo(false);
    ptour = { t: 0, hx: cam.x, hy: cam.y, hz: cam.z, back: -1, down0: ptr.down };
    sfx('whoosh', { vol: 0.4 }); document.body.classList.add('k-vila-auto');
    return true;
  }
  function patioTourCam(dt) {   // devolve true se a câmera é do passeio neste quadro
    const T = ptour; if (!T) return false;
    if (vila.on || vila.k > 0 || visit || cs) { ptour = null; document.body.classList.remove('k-vila-auto'); return false; }
    T.t += Math.min(dt, 0.05);
    const OUT = 2.4, PAN = 6, BACK = 2.2, end = T.back >= 0 ? T.back + BACK : OUT + PAN + BACK;
    if (T.back < 0 && T.t > 0.8 && ptr.down && !T.down0) T.back = T.t;   // toque = volta agora
    if (!ptr.down) T.down0 = false;
    if (T.back < 0 && T.t >= OUT + PAN) T.back = OUT + PAN;
    const sm = k => { k = U.clamp(k, 0, 1); return k * k * k * (k * (6 * k - 15) + 10); };
    const lz = (a, b, e) => Math.exp(U.lerp(Math.log(a), Math.log(b), e));
    const zf = H / 540;   // as câmeras do slots() são pra tela de 540 de altura
    const sl = G.PatioArt.slots(), A = sl.camHand, B = sl.camMid, Cc = sl.cam;   // ao vivo: o pátio anda junto com X.shift/estátua
    let x, y, z;
    if (T.back < 0 && T.t < OUT) {   // ida: sobe (zoom abre no meio do caminho) e chega na turma de mão
      const e = sm(T.t / OUT), dip = 1 - 0.45 * Math.sin(Math.PI * e);
      x = U.lerp(T.hx, A.x, e); y = U.lerp(T.hy, A.y, e) - 220 * Math.sin(Math.PI * e); z = lz(T.hz, A.z * zf, e) * dip;
    } else if (T.back < 0) {         // passeio: turmas de mão → médias → horizonte das gigantes e absurdas
      const u = (T.t - OUT) / PAN, e1 = sm(u * 2), e2 = sm(u * 2 - 1);
      if (u < 0.5) { x = U.lerp(A.x, B.x, e1); y = U.lerp(A.y, B.y, e1); z = lz(A.z * zf, B.z * zf, e1); }
      else { x = U.lerp(B.x, Cc.x, e2); y = U.lerp(B.y, Cc.y, e2); z = lz(B.z * zf, Cc.z * zf, e2); }
      T.lx = x; T.ly = y; T.lz = z;
    } else {                         // volta pro Kome (de onde estiver)
      if (T.lx === undefined) { T.lx = cam.x; T.ly = cam.y; T.lz = cam.z; }
      const e = sm((T.t - T.back) / BACK), dip = 1 - 0.45 * Math.sin(Math.PI * e);
      x = U.lerp(T.lx, T.hx, e); y = U.lerp(T.ly, T.hy, e) - 220 * Math.sin(Math.PI * e); z = lz(T.lz, T.hz, e) * dip;
    }
    if (T.t >= end) { ptour = null; document.body.classList.remove('k-vila-auto'); return false; }
    if (T.back < 0 && T.t >= OUT) { T.lx = x; T.ly = y; T.lz = z; }
    cam.snapTo(x, y, z); cam.maxShake = 0; cam.update(dt);
    return true;
  }

  function buyNode(id) {
    const n = D.nodeById[id];
    if (!n || nodeState(n) !== 'open') return false;
    const c = nodeCost(n);
    if (S.money < c) return false;
    S.money -= c; S.own[id] = true; S.stats.buys++;
    computeStats(); ensureBag();
    em.emit('buyNode', n);
    if (!FAST) {
      if (Sfx && Sfx.buy && !S.opts.mute) { try { Sfx.buy(); } catch (e) { /* */ } }
      if (n.size === 2) ui(() => UI.banner(n.n, 'keystone desbloqueado!', { icon: 'star', tone: 'gold' }));
      else ui(() => UI.toast(n.n, { icon: 'check', sub: n.see.slice(0, 64) }));
      if (n.fx.part) { quake(0.4); ui(() => UI.banner('PROJETO BAGGER ' + (S.own.bg2 ? '2' : '1') + '/3', 'as peças chegaram no pátio', { icon: 'gear', level: 3 })); }
      fx.flash(PAL.cream, 0.15, 0.2); S.col.pulse = 1; saveNow();
      // adereço no pátio? a câmera vai lá e ele surge
      let px = null; Wd.layout(S); if (id === 'm1') px = Wd.X.barraca; else for (const p of Wd.props) if (p.node === id) { px = p.x; break; }
      if (px !== null && px > WL.MX1 && S.cele.t < 0) { vilaGo(true, px, 1.1, 3.4); S.popNode = id; S.popAt = S.time + 1.0; setTimeout(() => floaters.add(px, -150, id === 'm1' ? 'ABRIU!' : n.n + '!', { c: PAL.gold, size: 30, life: 1.8 }), 1900); }   // adereço da vila: voa até lá
      else if (px !== null && Math.abs(px - P.x) > 120 && S.cele.t < 0) { visit = { x: px, t: 0, dur: 2.8 }; S.popNode = id; S.popAt = S.time; setTimeout(() => floaters.add(px, -150, id === 'm1' ? 'ABRIU!' : n.n + '!', { c: PAL.gold, size: 30, life: 1.8 }), 900); }
      else if (px !== null) { S.popNode = id; S.popAt = S.time - 0.4; }
    }
    HUD.refreshSlots();
    return true;
  }
  function buyHouse() {
    const h = D.HOUSE[S.house]; if (!h) return false;
    if (S.tool + 1 < h.tier) { ui(() => UI.toast('Precisa: ' + TOOLS[h.tier - 1].name, { icon: 'lock', tone: 'bad' })); return false; }
    const c = houseCost(h);
    if (S.money < c) { ui(() => UI.toast('Faltam ¥' + U.fmt(c - S.money) + ' pro ' + h.n.toLowerCase(), { icon: 'house', tone: 'bad' })); return false; }
    S.money -= c; S.house++; S.stats.buys++;
    computeStats();
    em.emit('buyHouse', h);
    if (!FAST) {
      if (Sfx && Sfx.big && !S.opts.mute) { try { Sfx.big(); } catch (e) { /* */ } }
      fx.confetti(120); fx.flash(PAL.cream, 0.3, 0.6);
      ui(() => UI.banner(h.n.toUpperCase() + '!', h.draw, { level: 3, icon: 'house' }));
      vilaGo(true, Wd.X.casa, 0.95, 4);   // a casa nova fica na vila: a câmera vai lá mostrar
      if (h.id === 'h2') ui(() => UI.toast('Carta do corretor', { icon: 'house', sub: 'o iene mudou :) o onsen subiu pra ¥70 mi', dur: 6 }));
    }
    if (S.house >= D.HOUSE.length) { if (houseFinal()) ending(); else if (!FAST) ui(() => UI.toast('Casa pronta!', { icon: 'house', tone: 'gold', sub: 'agora acabe a montanha: faltam ' + Math.ceil((1 - dugFrac() / D.END_DUG) * 100) + '%', dur: 6 })); }
    if (!FAST) saveNow();
    return true;
  }
  const dugFrac = () => (S.heapTotal ? 1 - S.heapArea / S.heapTotal : 0);
  /* SÓ FALTA A CASA: montanha acabada (D.END_DUG) com a casa por fazer. Nada de recarga calada: aviso uma vez + chip fixo apontando
     pra Casa (houseChipTick); a compra da última etapa dá o final na hora (S.soCasa vai no save, a montanha pode ter crescido).
     A montanha só cresce de novo se o dinheiro + a renda não pagam o resto da casa em EC.HOUSE_WAIT s (EC.HOUSE_GRACE s seguidos),
     anunciada e LONGE do núcleo dourado (o dourado não reaparece do nada). Roda 1x/s, inclusive no modo acelerado (sem tela). */
  const houseFinal = () => S.house >= D.HOUSE.length && (S.soCasa || dugFrac() >= D.END_DUG);
  function houseLeft() {   // ¥ que faltam pra casa inteira: etapas que faltam + ferramentas que a etapa mais alta ainda pede
    let c = 0, tier = 0;
    for (let i = S.house; i < D.HOUSE.length; i++) { c += houseCost(D.HOUSE[i]); tier = Math.max(tier, D.HOUSE[i].tier); }
    for (let i = S.tool + 1; i < tier && i < NT; i++) c += toolCost(TOOLS[i]);
    return c;
  }
  function soCasaInfo() {
    const h = D.HOUSE[S.house]; if (!h) return null;
    const c = houseCost(h), lock = S.tool + 1 < h.tier ? TOOLS[h.tier - 1].name : '';
    return { h, c, lock, n: S.house + 1, of: D.HOUSE.length, can: !lock && S.money >= c,
      line: 'Etapa ' + (S.house + 1) + ' de ' + D.HOUSE.length + ': ' + h.n + (lock ? ' · precisa: ' + lock : ' · custa ¥ ' + U.fmt(c)) };
  }
  function soCasaTick() {
    if (S.ended || S.house >= D.HOUSE.length) { S.soCasa = false; S.soCasaT = 0; return; }
    if (!S.soCasa) {
      if (dugFrac() < D.END_DUG) return;
      S.soCasa = true; S.soCasaT = 0; S.soCasaToast = true;
      if (!FAST) saveNow();
    }
    if (S.soCasaToast && !FAST && UI && HUD.ready && !cs && !S.endOpen) {   // aviso uma vez (espera a cena/painel fechar)
      S.soCasaToast = false; const i = soCasaInfo();
      ui(() => { UI.banner('MONTANHA ACABADA!', 'agora só falta a casa', { icon: 'house', tone: 'gold', level: 3, dur: 3.5 });
        UI.toast('Agora só falta a casa', { icon: 'house', tone: 'gold', sub: i.line + ' · toque em "Só falta a casa"', dur: 7 }); });
      sfx('fanfare');
    } else if (FAST) S.soCasaToast = false;
    if (S.heapArea >= S.heapTotal * EC.REFILL_AT) { S.soCasaT = 0; return; }   // ainda tem arroz pra cavar: segue juntando
    const need = houseLeft() - S.money, eta = need / Math.max(1e-6, S.ips || 0);
    if (need <= 0 || eta <= EC.HOUSE_WAIT) { S.soCasaT = 0; return; }
    if (++S.soCasaT < EC.HOUSE_GRACE) return;
    S.soCasaT = 0; refillHouse();
  }
  // frente da máquina na mão (x de mundo): daqui pra direita ela alcança. Trator/escavadeira/Bagger/caminhão só cavam pra frente
  // (+x; a ilha espelhada só vira o desenho) e no celular o CAVAR só procura arroz à frente: arroz atrás deles fica inalcançável
  function workFront() {
    if (cur.kind === 'bagger' && S.m) return S.m.x + 520 * (S.m.k || 1);   // corpo + roda (~560 à frente)
    if (cur.kind === 'haul') return Math.max(P.x, LX.x) + (TOOLS[D.toolIndex.escav].park || 100) + 60;
    if (cur.seat === 'cab') return P.x + (cur.park || 100) + 60;
    return P.x + 120;
  }
  // põe a máquina na mão antes de xFoot (o pé do arroz novo), virada pra ele (montanha nova, recarga sem espaço na frente)
  function seatBefore(xFoot) {
    if (cur.kind === 'bagger' && S.m) { S.m.x = Math.min(S.m.x, xFoot - 700 * (S.m.k || 1)); S.m.vx = 0; P.x = S.m.x; S.bagX = S.m.x; }
    else if (cur.kind === 'haul') { const pk = TOOLS[D.toolIndex.escav].park || 100; LX.x = Math.min(LX.x, xFoot - pk); LX.vx = 0; P.x = Math.min(P.x, LX.x - 170); }
    else if (cur.seat === 'cab') { P.x = Math.min(P.x, xFoot - (cur.park || 100)); P.vx = 0; }
    else P.x = Math.min(P.x, xFoot - 60);
    P.y = heap.surf(P.x);
  }
  // refillSpot() -> {x, rad, seat}: onde a recarga da casa cai. Sempre NA FRENTE da máquina (pé do monte >= workFront + folga
  // pro arroz escorrer), longe do núcleo dourado (camada com elipse, duro) e o mais perto possível; sem espaço na frente nem
  // com o monte mais estreito (até ~half): longe do núcleo e seat = a máquina vai pra antes dele (o "trem" traz ela junto)
  function refillSpot() {
    const R0 = EC.REFILL_RAD || 900, ells = MATS().filter(m => m.ellipse).map(m => m.ellipse), front = workFront() + 150;
    const ovOf = (x, rad) => { let ov = 0; for (const e of ells) ov += Math.max(0, Math.min(x + rad, e.cx + e.rx) - Math.max(x - rad, e.cx - e.rx)); return ov; };
    for (let rad = R0; rad >= R0 * 0.5 - 1; rad *= 0.8) {
      const lo = Math.max(WL.MX0 + rad, front + rad), hi = WL.MX1 - rad * 0.6;
      if (lo > hi) continue;
      let bx = lo, best = Infinity;
      for (let x = lo; x <= hi; x += 50) { const sc = ovOf(x, rad) * 10 + (x - lo) * 0.5; if (sc < best) { best = sc; bx = x; } }
      return { x: bx, rad, seat: false };
    }
    let bx = WL.MX0 + R0, best = Infinity;
    for (let x = WL.MX0 + R0; x <= WL.MX1 - R0; x += 50) { const sc = ovOf(x, R0) * 10 + Math.abs(x - front) * 0.1; if (sc < best) { best = sc; bx = x; } }
    return { x: bx, rad: R0, seat: true };
  }
  // a montanha cresce de novo pra juntar o da casa: na frente da máquina, longe do núcleo dourado (ver refillSpot)
  function refillHouse() {
    const sp = refillSpot(), bx = sp.x, rad = sp.rad;
    if (sp.seat) seatBefore(bx - rad - 150);
    heap.add(bx, S.heapTotal * EC.REFILL_ADD, rad);
    if (sp.seat) { S.footX = Math.min(S.footX, bx - rad); yardSnap(); }
    S.heapArea = heap.area; S.stats.refills = (S.stats.refills | 0) + 1;
    if (!FAST) {
      quake(0.3); sfx('pling');
      ui(() => { UI.banner('A MONTANHA CRESCEU DE NOVO', 'um trem trouxe arroz pra você juntar o da casa', { icon: 'rice', tone: 'gold', level: 3, dur: 3.5 });
        UI.toast('Arroz novo pra casa', { icon: 'house', sub: 'faltam ¥ ' + U.fmt(Math.max(0, houseLeft() - S.money)) + ' pra casa inteira · o final sai na última etapa', dur: 6 }); });
      saveNow();
    }
  }
  function ending() {
    S.ended = true; S.endT = S.time; S.stats.earnedEnd = S.earned; computeStats();   // sementes da campanha = até aqui
    const res = G.Islands ? G.Islands.onEnding(S.time) : null;   // tempo e medalha da ilha (sementes extras)
    em.emit('ending');
    if (FAST) return;
    if (res && G.Islands.islandRun()) { islandEnd(res); return; }   // ilhas depois da primeira: final curtinho com a medalha
    const pct = 1 - S.heapArea / S.heapTotal, mins = S.time / 60;
    const rank = mins < 70 ? 'S' : mins < 90 ? 'A' : mins < 130 ? 'B' : 'C';
    csPlay('final', () => (S.endOpen = true) && HUD.endCard({ rank, list: [
      { icon: 'clock', label: 'Tempo', value: U.fmtTime(S.time) }, { icon: 'rice', label: 'Montanha cavada', value: U.pct ? U.pct(pct, 1) : Math.round(pct * 100) + '%' },
      { icon: 'yen', label: 'Ienes ganhos', value: '¥ ' + U.fmt(S.earned) }, { icon: 'yen', label: 'Recorde de ¥/s', value: '¥ ' + U.fmt(S.stats.bestIps) },
      { icon: 'sack', label: 'Sacos estourados', value: S.stats.sacks + ' (maior: ¥ ' + U.fmt(S.stats.bestSack) + ')' }, { icon: 'star', label: 'Bolsões dourados', value: S.stats.pockets + '/' + D.POCKETS.n },
    ] }, () => { S.endOpen = false; if (!S.stats.cs_ilhas) endgameIntro(); else pickMountain(); }));
  }
  // A VOLTA AO JAPÃO: cutscene que apresenta as ilhas + tutorial guiado (uma vez; dá pra rever no mapa)
  function endgameIntro() {
    if (cs || !G.Islands) { pickMountain(); return; }
    if (!(S.island | 0) && !G.Islands.rec('honshu')) G.Islands.onEnding(S.endT || S.time);   // save antigo: registra Honshu como concluída
    csPlay('ilhas', () => { S.stats.cs_ilhas = 1; saveNow(); if (G.IslandsUI) G.IslandsUI.tour(() => pickMountain()); else pickMountain(); });
  }
  // final de uma ilha (2ª em diante): cena curta com a medalha; na Ilha de Mochi da 1ª volta, o Grande Final do Kome-Oh
  function islandEnd(res) {
    S.islandRes = res;
    const rf = res.rf, list = res.list || [   // modo de partida (modos.js) traz a lista dele
      { icon: 'clock', label: 'Tempo nesta ilha', value: U.fmtTime(res.sec) + (res.newBest ? ' (recorde!)' : '') },
      { icon: 'star', label: 'Medalha', value: ['', 'bronze', 'prata', 'ouro'][res.medal] + (res.bonus ? ' · +' + res.bonus + ' sementes' : '') },
      { icon: 'yen', label: 'Ienes ganhos', value: '¥ ' + U.fmt(S.earned) },
      { icon: 'star', label: 'Sementes na próxima viagem', value: '+' + G.Islands.gain() },
    ];
    if (rf && rf.f > 0) list.splice(1, 0, { icon: 'clock', label: 'Recorde na ' + (G.Faixas ? G.Faixas.name(rf.f) : 'faixa'), value: rf.newT ? (rf.prev ? 'novo! antes ' + U.fmtTime(rf.prev) : 'primeiro tempo') : U.fmtTime(rf.best) + ' (bater o próprio tempo)' });
    const then = () => { S.endOpen = true; HUD.endCard({ rank: ['', 'C', 'A', 'S'][res.medal] || 'B', list }, () => { S.endOpen = false; if (res.modo && G.Modos) G.Modos.after(); else if (G.IslandsUI) G.IslandsUI.open(); else pickMountain(); }); };
    if (res.last && !S.stats.legend && !res.modo) csPlay('ultimo', () => csPlay('finale', () => { S.stats.legend = 1; if (S.closet.indexOf('nihon') < 0) S.closet.push('nihon'); computeStats(); saveNow(); then(); }));   // último grão + Kome em casa, depois o Kome-Oh
    else csPlay('ilhafim', then);   // ilhafim já traz o último grão e o Kome em casa antes da medalha
  }
  function welcome(i) { ui(() => UI.banner('Bem-vindo a ' + i.n + '!', i.hook || i.d, { icon: 'star', tone: 'gold', dur: 3.5 })); sfx('fanfare'); }
  // ilha espelhada (scene.mirror): a montanha fica à ESQUERDA. Só o desenho e a entrada viram; a simulação é a mesma
  function setMirror() { const sc = G.Scenery ? G.Scenery.profile() : null; cam.mx = sc && sc.mirror ? -1 : 1; }
  // presente do evento da ilha: sacos dourados caindo perto do Kome (erupção de curry, maré baixa)
  function giftSacks(n) {
    for (let i = 0; i < n; i++) {
      const x = U.clamp(P.x + (i - (n - 1) / 2) * 70 / Math.min(1, cam.z) + P.face * 60, 950, WL.MX1);
      S.sacks.push({ x, y: heap.surf(x) - 260 - i * 50, vy: 0, t: 0, g: Math.random() < 0.2 ? 3 : 2, state: 0, sh: 0, v: 0 });
    }
  }

  /* =====================================================================
     7. Atualização, câmera e desenho
     ===================================================================== */
  /* PÁTIO ACOMPANHA A FRENTE DE LAVRA: Wd.X.shift persegue o recuo do pé da montanha devagar e sem pulo (20% da distância por
     segundo, no máximo 40 u/s: a câmera anda junto com a máquina, então o pátio parece parado na tela; a frota e o coletor nunca
     ficam pra trás). Troca de ferramenta, montanha
     nova, save carregado e modo FAST encaixam na hora (yardSnap). A Bagger em montagem anda junto com o pátio; a Bagger com o
     Goma (Kome em outra máquina) acompanha o pé da montanha. Nada disso entra no save (é tudo derivado de S.footX). */
  const yardTarget = () => U.clamp(S.footX - WL.MX0, 0, WL.MX1 - WL.MX0 - 600);
  // espaço que a máquina na mão precisa entre o pé da montanha e o pátio (canteiro): distância de trabalho + ela + o coletor atrás
  const yardNeed = () => (!cur || !T ? 0 : cur.kind === 'bagger' ? Math.round(1240 * ((S.m && S.m.k) || 1) + 260) : cur.kind === 'haul' ? 1500 : cur.seat === 'cab' ? (cur.park || 0) + (T.w || 150) / 2 + 300 : 0);
  function yardSnap() { const X = Wd.X; X.mk = cur && cur.kind === 'bagger' && S.m ? (S.m.k || 1) : 1; X.need = yardNeed(); X.shift = yardTarget(); Wd.layout(S); bagFollow(0, true); }
  function bagFollow(dt, snap) {
    if (!S.bag) return;
    if (S.bag.m === S.m) { if (isFinite(S.m.x) && S.m.init) S.bagX = S.m.x; return; }                                   // o Kome pilotando: guarda onde ela está
    if (S.tool < NT - 1) { S.bagX = Wd.X.front - 610; return; }                          // em montagem: vaga fixa no distrito
    const tx = S.footX - 380;                                                            // pronta, com o Goma: fica no pé da montanha
    S.bagX = snap || FAST ? Math.max(S.bagX, tx) : S.bagX < tx ? Math.min(tx, S.bagX + 40 * dt) : S.bagX;
  }
  function yardTick(dt) {
    const X = Wd.X, tg = yardTarget(), mk = cur.kind === 'bagger' && S.m ? (S.m.k || 1) : 1;
    X.need = yardNeed();
    if (FAST || mk !== X.mk || tg < X.shift - 200) { X.mk = mk; X.shift = tg; }          // montanha nova / troca de máquina gigante
    else if (tg > X.shift) X.shift = Math.min(tg, X.shift + U.clamp((tg - X.shift) * 0.2, 0.4, 40) * dt);   // aproximação suave: sem tranco, nunca dá pra ver prédio andando
    Wd.layout(S); bagFollow(dt, false);
    // o pátio VARRE o chão onde pisa: o tapetinho de arroz que as máquinas deixam pra trás (menos de 20 de altura) é recolhido
    // e pago como qualquer arroz (mesma conta das esteiras da Bagger). Sem isso o estacionamento ficava em cima de arroz solto
    // e o Kome a pé ia cavar no meio das vagas.
    if ((sweepT -= dt) <= 0) {
      sweepT = 0.5; const xb = X.front - X.lane - 8;
      if (xb > WL.MX0) { digO.pow = 99; const fl = heap.digRect(WL.MX0 - 60, xb, 24, digO); if (fl.got > 0) { S.dug += fl.got; S.pend += fl.val * yenK(); if (G.Items) G.Items.add(fl.byMat); } }
    }
  }
  let sweepT = 0;

  // update(dt): um passo da simulação (seguro pra passo fixo; não desenha)
  const INDC = { mainX: 0, floor: null, zoom: 1, col: null };
  const SILO_P = () => (Wd.props || []).find(p => p.node === 'a7');
  const IND_CTX = () => { INDC.footX = S.footX; INDC.siloX = (SILO_P() || {}).x || 0; INDC.fabX = Wd.X ? Wd.X.fabPorta : 0; INDC.noA = cur.kind === 'bagger'; INDC.mainX = S.bag && S.bag.m ? S.bag.m.x : S.footX - 700; INDC.floor = baggerFloor; INDC.zoom = cam.z; INDC.col = S.col; return INDC; };
  // celular em pé: aviso de virar cobre tudo e o jogo pausa. Guardado e refeito só no resize (ler innerWidth várias vezes por quadro
  // depois do HUD mexer no DOM forçava layout no celular)
  let portraitV = MOBILE && innerHeight > innerWidth * 1.1;
  const portraitUpd = () => { portraitV = MOBILE && innerHeight > innerWidth * 1.1; };
  addEventListener('resize', portraitUpd); addEventListener('orientationchange', () => setTimeout(portraitUpd, 60));
  const PORTRAIT = () => portraitV;
  let rotDrawn = false;
  function update(dt) {
    if (G.Sim && !cs && !PORTRAIT()) G.Sim.tick(dt);
    if (G.Tatu && !cs && !PORTRAIT()) G.Tatu.tick(dt);
    if (G.Patio && !cs && !PORTRAIT()) G.Patio.tick(dt);
    if (G.Events && !cs && !PORTRAIT()) G.Events.tick(dt);   // sistemas por tempo (E.Sim): rodam mesmo com a Casa ou o mapa abertos
    if (PORTRAIT()) { if (!rotDrawn) { const c = document.getElementById('k-rot-cv'); if (c) { const cg = c.getContext('2d'); cg.imageSmoothingEnabled = false; E.drawShiba(cg, 48, 74, 'wag', 1, { scale: 2, pal: (S.look && S.look.pal) || 'kome' }); rotDrawn = true; } } return; }
    if (cs) { csTick(dt); return; }
    if (G.Home && G.Home.isOpen()) { G.Home.tick(dt); return; }
    if (G.IslandsUI && G.IslandsUI.isOpen() && !FAST) return;
    if (G.Topo && G.Topo.isOpen() && !FAST) return;   // tela de cima aberta: a montanha espera (G.Sim continua)   // mapa das ilhas aberto: o jogo espera
    if (S.quake > 0) S.quake = Math.max(0, S.quake - dt * 1.4);
    S.time += dt;
    E.Exhaust.tint = S.own.cB ? DIESEL_TINT : null;   // cB Diesel Premium: fumaça azul
    dayTick(dt); S.tod = todNow(); if (G.Inf) G.Inf.tick(dt); if (G.Islands) G.Islands.evTick(dt); feelFlags(); if (G.Goals) G.Goals.tick(dt); if (G.Missoes) G.Missoes.tick(dt);
    if (G.Ind && !FAST) G.Ind.tick(dt, IND_CTX());
    if (G.Belts && !FAST) G.Belts.tick(dt, IND_CTX());
    { const L = E.Nature && E.Nature.light ? E.Nature.light(S.tod) : null; const nt = L ? L.night * 0.6 + L.dusk * 0.4 : 0; inp.night = iL.night = iT.night = iF.night = iW.night = nt; }
    if (visit && (visit.t += dt) >= visit.dur) visit = null;
    yardTick(dt);
    S.bury = 0;   // soterramento removido (o dono não curtiu); variável fica pra saves antigos
    if (cur.kind === 'jack' && !FAST) crackTick(dt);
    const lock = locked();
    let hold = ptr.down && !lock && (vila.k <= 0 || FAST);
    S.autoMode = false;
    if (!hold && !lock && st.auto > 0 && ptr.has) { hold = true; S.autoMode = true; }
    inp.parts = iL.parts = iT.parts = FAST ? null : parts;
    const k = cur.kind;
    if (k === 'hand' || k === 'push' || k === 'jack') driveHand(dt, hold);
    else if (k === 'haul') driveHaul(dt, hold);
    else if (k === 'bagger') driveBagger(dt, hold);
    else driveMachine(dt, hold);
    if (!lock) { p2Tick(dt); if (P2.on) p2Pay(dt); }
    autoTick(dt);
    ecoTick(dt, hold && !S.autoMode);
    heap.relax(dt);
    if (!FAST) slideTick(dt);
    if (!FAST && heap.flow > 30 && Math.random() < Math.min(0.9, heap.flow / 400)) trickle(heap.flowX, 1 + (heap.flow > 300 ? 2 : 0));
    S.heapArea = heap.area;
    S.footT -= dt; if (S.footT <= 0) { S.footT = 1; S.footX = scanFoot(); soCasaTick(); if (!S.ended && houseFinal() && !cs) ending(); }   // final = casa pronta + montanha acabada (ou acabou antes da casa)
    celeTick(dt);
    fleetTick(dt);
    collectorTick(dt);
    if (S.stamp > 0) S.stamp -= dt;
    if (!FAST) {
      helpersTick(dt);
      smallTick(dt);
      parts.update(dt, floorFn); floaters.update(dt); Wd.updateBack(dt);
      camTick(dt);
      if (loopH && (loopT -= dt) <= 0) { loopT = 0.12; try { loopH.set({ rate: hold ? 0.75 + 0.2 * (S.estreia > 0 ? 1 : 0) : 0.12, vol: hold ? 0.5 : 0.28 }); } catch (e) { /* */ } }
    }
  }
  /* ---------- Jogador 2: shiba Goma no controle (Xbox / qualquer gamepad), mesma tela ----------
     Entra apertando qualquer botão do controle. Analógico esquerdo ou direcional anda; A ou RT cava; Start sai.
     Usa a melhor ferramenta de mão já comprada e cava a mesma montanha; o dinheiro vai pro mesmo cofre. */
  const P2 = { on: false, x: 0, y: 0, vx: 0, face: 1, m: null, tid: '', budget: 0, ax: 0, dig: false, startT: 0, inp: { x: 0, y: 0, face: 1, vx: 0, digging: false, floor: null, parts: null, t: 0 } };
  G.P2 = P2;
  function padRead() {
    let gp = null;
    try { const a = navigator.getGamepads ? navigator.getGamepads() : []; for (let i = 0; i < a.length; i++) if (a[i] && a[i].connected) { gp = a[i]; break; } } catch (e) { /* */ }
    if (!gp) { P2.ax = 0; P2.dig = false; if (P2.on) { P2.on = false; if (!FAST) ui(() => UI.toast('Controle desconectou', { icon: 'x', sub: 'o Jogador 2 foi descansar' })); } return; }
    const B = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4));
    let ax = gp.axes[0] || 0; if (Math.abs(ax) < 0.22) ax = 0;
    if (B(14)) ax = -1; if (B(15)) ax = 1;
    const dig = B(0) || B(7) || B(5) || B(1);
    const any = dig || ax !== 0 || B(2) || B(3) || B(9);
    if (!P2.on && any) p2Join();
    if (P2.on && B(9) && S.time - P2.startT > 1) { P2.on = false; ui(() => UI.toast('Jogador 2 saiu', { icon: 'check' })); }
    P2.ax = ax; P2.dig = dig;
  }
  function p2Tool() { let i = Math.min(S.tool, NT - 1); while (i > 0 && TOOLS[i].kind !== 'hand') i--; return TOOLS[i]; }
  function p2Join() {
    P2.on = true; P2.startT = S.time; P2.x = P.x - P.face * 50; P2.y = heap.surf(P2.x); P2.vx = 0; P2.face = P.face; P2.tid = '';
    if (!FAST) { ui(() => UI.toast('Jogador 2 entrou!', { icon: 'star', tone: 'gold', sub: 'A cava · Start sai' })); sfx('sparkle'); }
  }
  function p2Tick(dt) {
    if (!P2.on) return;
    const t = p2Tool();
    if (P2.tid !== t.id) { P2.tid = t.id; P2.m = G.Tools[t.id].create({ pilot: 'goma', seed: 7 }); }
    const spd = t.spd * st.spd * 0.55;
    if (P2.ax) P2.face = P2.ax > 0 ? 1 : -1;
    P2.vx = U.damp(P2.vx, P2.dig ? 0 : P2.ax * spd, 12, dt);
    // fica dentro da tela (a câmera segue o Kome)
    const z = Math.max(0.3, cam.z), half = (W / 2) / z - 30 / z, hh = (H / 2) / z;
    let nx = U.clamp(P2.x + P2.vx * dt, Math.max(60, cam.x - half), Math.min(WL.WW - 60, cam.x + half));
    const ny = heap.surf(nx);
    if (ny - 50 / z < cam.y - hh + 60 / z || ny > cam.y + hh - 90 / z) { nx = P2.x; P2.vx = 0; }   // não sai da tela por cima/baixo
    P2.x = nx; P2.y = heap.surf(P2.x);
    const I = P2.inp; I.x = P2.x; I.y = P2.y; I.face = P2.face; I.vx = P2.vx; I.digging = P2.dig; I.floor = floorFn; I.t = S.time;
    I.parts = FAST ? null : parts; I.speedMul = 1; I.boost = 0; I.power = 1;
    const T2 = G.Tools[t.id]; T2.update(P2.m, dt, I);
    if (P2.dig || P2.m.busy) P2.budget = Math.min(P2.budget + t.A * st.dig * dt, t.A * 1.5);
    const b = T2.bite(P2.m);
    if (b.active && P2.budget > 0) {
      digO.pow = t.pow * st.powMul;
      const res = heap.dig(b.x + P2.face * t.r * 0.3, P2.budget, t.r, digO); P2.budget = 0;
      if (res.got > 0) { S.dug += res.got; P2.pend = (P2.pend || 0) + res.val * EC.P0 * extra * st.sell * st.val; P2.px = b.x; }
      if (res.blocked > 0.5 && res.blocked > res.got * 3) boing(res.hardMat, b.x, b.y);
    }
  }
  function p2Pay(dt) {
    P2.payT = (P2.payT || 0) + dt;
    if (P2.pend > 0 && (P2.payT > 0.6 || !P2.dig) && P2.pend >= 1) { pay(P2.pend, P2.px, heap.surf(P2.px), 0); P2.pend = 0; P2.payT = 0; }
  }
  function p2Draw(g, t) {
    if (!P2.on || !P2.m) return;
    G.Tools[P2.tid].draw(g, P2.m);
    const z = Math.max(0.3, cam.z); Draw.text(g, 'P2', P2.x, P2.y - 46 * (P2.m.sc || 1) - (8 + 2 * Math.sin(t * 4)) / z, { size: 13 / z, col: PAL.cream, sw: 3 / z });
  }
  /* ---- feedback visual de nós que antes só mudavam número ---- */
  // s10 Veio de Ouro: veios dourados ligando os bolsões, só onde ainda tem arroz (aparecem no corte da montanha)
  function drawVeins(g, v, t) {
    const P = heap.pockets; if (!P || P.length < 2) return;
    const arr = P.slice().sort((a, b) => a.x - b.x), z = Math.max(0.3, cam.z);
    g.save(); g.lineCap = 'round';
    for (let k = 0; k < arr.length - 1; k++) {
      const a = arr[k], b = arr[k + 1]; if (Math.max(a.x, b.x) < v.x0 - 50 || Math.min(a.x, b.x) > v.x1 + 50) continue;
      const n = Math.max(6, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 10));
      g.strokeStyle = 'rgba(255,214,92,0.55)'; g.lineWidth = 2.2 / z + 1; g.beginPath(); let pen = false;
      for (let j = 0; j <= n; j++) {
        const u = j / n, x = a.x + (b.x - a.x) * u, alt = a.y + (b.y - a.y) * u + Math.sin(u * 9 + k) * 8, hh = heap.height(x), y = heap.surf(x) + hh - alt;
        if (alt < hh - 3) { if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; } } else pen = false;
      }
      g.stroke();
    }
    // brilhinho correndo pelos veios
    const k = Math.floor(t * 0.7) % (arr.length - 1), u = (t * 0.7) % 1, a = arr[k], b = arr[k + 1];
    if (a && b) { const x = a.x + (b.x - a.x) * u, alt = a.y + (b.y - a.y) * u + Math.sin(u * 9 + k) * 8, hh = heap.height(x), y = heap.surf(x) + hh - alt; if (alt < hh - 3) Draw.circle(g, x, y, 3 / z + 1.5, PAL.goldL, { ol: 0 }); }
    g.restore();
  }
  // m7a Selo Premium / m7b Selo Ouro: carimbo hanko no coletor
  function drawSeal(g, x, y, t) {
    const gold = S.own.m7b, r = 8;
    g.save(); g.translate(x, y); g.rotate(-0.12);
    if (gold) { g.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3); Draw.circle(g, 0, 0, r * 1.5, PAL.goldL, { ol: 0 }); g.globalAlpha = 1; }
    Draw.circle(g, 0, 0, r, gold ? PAL.gold : PAL.red, { ol: 1.5 });
    Draw.circle(g, 0, 0, r * 0.72, gold ? PAL.goldL : PAL.red, { ol: 0 });
    Draw.text(g, '米', 0, r * 0.05, { size: r * 1.15, col: PAL.cream, sw: 0.01, weight: 700 });
    g.restore();
  }
  /* ---- ciclo do dia (adendo §8): ~9 min de manhã até o pôr do sol; no fim, salário do dia e o Kome vai pra casa (prêmio, nunca castigo) ---- */
  const DAY_SEC = 240, DAY_SCENE = 6;   // dia de 4 min e cena de dormir de 6 s (dá tempo de ver a casa crescendo)
  const todNow = () => 0.08 + 0.74 * U.clamp(S.dayT / DAY_SEC, 0, 1);       // 0.08 manhã ... 0.82 fim do pôr do sol
  function dayTick(dt) {
    if (S.ended) { if (S.dayEnd > 0) { S.dayEnd = 0; document.body.classList.remove('k-night'); } return; }   // final no meio da noite: a noite acaba (antes S.dayEnd ficava > 0 pra sempre e travava amuletos/faixa/modos/carta)
    if (S.dayEnd > 0) {
      S.dayEnd -= dt;
      if (S.dayEnd <= 0) { S.dayEnd = 0; S.day++; document.body.classList.remove('k-night'); S.dayT = 0; S.dayEarn = 0; if (!FAST) ui(() => UI.banner('Dia ' + S.day, 'bom dia, Kome!', { icon: 'star', dur: 1.6 })); }
      return;
    }
    S.dayT += dt;
    if (S.dayT >= DAY_SEC && S.cele.t < 0 && !visit) {
      const pay = Math.round(S.dayEarn * 0.15);                                // salário do dia: 15% do que ganhou hoje
      document.body.classList.add('k-night');   // sai quando a noite acaba (no relógio do jogo; o setTimeout de antes voltava o HUD antes da hora com o jogo lento)
      S.dayPay = pay; S.money += pay; S.earned += pay; S.dayEnd = DAY_SCENE; if (G.priceBump) G.priceBump();   // preços da Oficina/Casa só se atualizam quando o dia vira
      if (!FAST) { sfx('pling'); saveNow(); }
    }
  }
  // cena curtinha no quintal: noite, a casa (no estágio atual), o Kome dormindo e o salário do dia
  function drawDayEnd(g, t) {
    const N = E.Nature;
    const k = S.dayEnd, a = Math.min(1, (DAY_SCENE - k) / 0.5, k / 0.5);
    g.save(); g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0); g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#141629'); gr.addColorStop(0.7, '#2B3360'); gr.addColorStop(1, '#46527F');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#FFF6D8'; for (let i = 0; i < 40; i++) { const x = (i * 97.3) % W, y = (i * 53.7) % (H * 0.55); g.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))); g.fillRect(x, y, 2, 2); }
    g.globalAlpha = a; Draw.circle(g, W * 0.82, H * 0.18, 26, '#FFF3C4', { ol: 0 }); Draw.circle(g, W * 0.82 + 10, H * 0.16, 22, '#2B3360', { ol: 0 });
    g.fillStyle = '#3B4A2E'; g.fillRect(0, H * 0.78, W, H * 0.22);
    if (N && N.house) {
      const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;   // escala inteira e sem suavizar: mesmo pixel do jogo
      if (S.house > 0) N.house(g, Math.round(W * 0.42), Math.round(H * 0.78), { stage: S.house - 1, s: 2, t, lit: true });
      else if (Wd.drawPlot) Wd.drawPlot(g, Math.round(W * 0.42), Math.round(H * 0.78), 2);
      g.imageSmoothingEnabled = sm;
    }
    E.drawShiba(g, Math.round(W * 0.64), Math.round(H * 0.78), 'sleep', t, { scale: 3, pal: S.look.pal || 'kome' });
    Draw.text(g, 'z', W * 0.62 + 30 + Math.sin(t * 2) * 4, H * 0.78 - 70 - (t * 20 % 30), { size: 22, col: '#FFFFFF', sw: 3 });
    Draw.text(g, 'Fim do dia ' + S.day, W / 2, H * 0.2, { size: 34, col: PAL.cream, sw: 5 });
    Draw.text(g, 'salário do dia: +¥' + U.fmt(S.dayPay), W / 2, H * 0.31, { size: 22, col: PAL.goldL, sw: 4 });
    Draw.text(g, S.house > 0 ? 'o Kome descansa em casa' : 'o Kome sonha com a casa própria', W / 2, H * 0.39, { size: 15, col: '#C9D3F0', sw: 3 });
    { const nx = D.HOUSE[S.house];   // próxima etapa da casa: dá vontade de voltar a cavar
      if (nx) Draw.text(g, 'próxima etapa: ' + nx.n + ' · faltam ¥' + U.fmt(Math.max(0, houseCost(nx) - S.money)), W / 2, H * 0.45, { size: 14, col: PAL.goldL, sw: 3 }); }
    g.restore();
  }
  // britadeira: rachaduras se espalhando a partir da ponteira antes do bloco soltar
  const crack = { x: 0, y: 0, k: 0, seed: 1 };
  const CHUNK = { shape: 'rect', c: [PAL.press || PAL.riceS, PAL.rice, PAL.riceS], land: true, w: [2.5, 5], life: 1.3, ol: true, speed: [60, 200], spread: 1.1, dir: -Math.PI / 2, vr: 9, g: 800 };
  function crackTick(dt) {
    const b = T.bite ? T.bite(S.m) : null; if (!b) return;
    if (!b.active) { crack.k = Math.max(0, crack.k - dt * 0.8); return; }
    if (Math.abs(b.x - crack.x) > 18 || crack.k <= 0) { crack.x = b.x; crack.y = heap.surf(b.x); crack.seed = (Math.random() * 1e5) | 0; crack.k = 0.06; }
    crack.k += dt * 0.75; crack.y = heap.surf(crack.x);
    if (crack.k >= 1) {   // o bloco solta
      parts.spray(crack.x, crack.y - 4, 14, CHUNK); quake(0.3); sfx('thud');
      floaters.add(crack.x, crack.y - 30, 'krak!', { c: PAL.cream, size: 13 }); crack.k = 0.06; crack.seed++;
    }
  }
  function drawCrack(g) {
    const r = E.RNG(crack.seed), L = 6 + crack.k * 26;
    g.save(); g.strokeStyle = PAL.line; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let a = 0; a < 5; a++) {
      let x = crack.x, y = crack.y + 2, ang = Math.PI * (0.15 + r() * 0.7) + (r() - 0.5) * 0.3;
      g.lineWidth = 1.6 - a * 0.15; g.beginPath(); g.moveTo(x, y);
      const n = 4, len = L * (0.6 + r() * 0.5);
      for (let i = 0; i < n; i++) { ang += (r() - 0.5) * 0.9; x += Math.cos(ang) * len / n; y += Math.sin(ang) * len / n; g.lineTo(x, y); }
      g.stroke();
    }
    g.restore();
  }

  /* ---- cutscenes (GDD §9): abertura, chegada da Bagger e final estilo Dave the Diver ----
     Painéis desenhados em código no traço do Kome. Clique/toque/tecla passa; Esc pula tudo. O jogo pausa por baixo. */
  let cs = null;
  function csPlay(id, then) {
    if (FAST || !SHOTS[id]) { if (then) then(); return; }
    cs = { id, shots: SHOTS[id], i: 0, t: 0, then, skipT: 0, clock: 0 };
    if (Music && Music.stop) { try { Music.stop(0.4); } catch (e) { /* */ } }
  }
  function csNext(all) {
    if (!cs) return; sfx('paw');
    if (all || ++cs.i >= cs.shots.length) { const f = cs.then; S.stats['cs_' + cs.id] = 1; cs = null; if (f) f(); saveNow(); return; }
    cs.t = 0;
  }
  function csTick(dt) {
    if (FAST) { csNext(true); return; }   // modo acelerado (testes): cena acaba na hora (compra feita fora do step travava o tempo)
    cs.t += dt; cs.clock += dt; const sh = cs.shots[cs.i];
    if (cs.t >= (sh && sh.dur > 0 ? sh.dur : 3)) csNext();   // parte sem duração não trava a cena
  }
  const SHOTS = G.makeShots(W, H, S);   // arte das cutscenes mora em game/cutscenes.js
  function drawCutscene(g, t) {
    const sh = cs.shots[cs.i], k = Math.min(1, cs.t / sh.dur);
    g.save(); g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.save(); sh.draw(g, k, t + cs.clock, cs.t); g.restore();   // relógio próprio: o jogo está pausado, mas a cena anima
    const bar = Math.round(H * 0.09); g.fillStyle = '#120C08'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    const fin = Math.min(1, cs.t / 0.35, (sh.dur - cs.t) / 0.35); if (fin < 1) { g.globalAlpha = 1 - fin; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    const n = Math.min(sh.cap.length, Math.floor(cs.t * 38));
    Draw.text(g, sh.cap.slice(0, n), W / 2, H - bar - 26, { size: Math.min(20, W / 42), col: PAL.cream, sw: 4 });
    g.globalAlpha = 0.6; Draw.text(g, 'toque pra seguir · Esc pula', W - 110, bar / 2, { size: 11, col: '#C9B89A', sw: 0.01 }); g.globalAlpha = 1;
    for (let i = 0; i < cs.shots.length; i++) Draw.circle(g, 20 + i * 14, bar / 2, 4, i === cs.i ? PAL.goldL : '#5A4A3A', { ol: 0 });
    g.restore();
  }
  /* ---- modo infinito: depois do final, montanhas novas (formatos se alternam), tudo comprado continua ---- */
  const MOUNT_NAMES = ['Kome-yama', 'Futago-yama (dois picos)', 'Mesa do Vovô'];
  // formatos do modo infinito (parte 2): o jogador escolhe entre 3 sorteados; recorde de tempo por formato
  const SHAPES = [
    { id: 'classica', n: 'Kome-yama', d: 'a montanha clássica' },
    { id: 'futago', n: 'Futago-yama', d: 'dois picos gêmeos' },
    { id: 'mesa', n: 'Mesa do Vovô', d: 'paredão e topo chato' },
    { id: 'mochi', n: 'Montanha Mochi', d: 'redondinha e fofa' },
    { id: 'vulcao', n: 'Vulcão de Curry', d: 'com cratera no topo' },
    { id: 'terraco', n: 'Terraços de Arroz', d: 'degraus de arrozal' },
  ];
  function shapeId() { return S.shape || (S.island && G.Islands && (S.mount || 1) === 1 ? G.Islands.island().shape : '') || ['classica', 'futago', 'mesa'][((S.mount || 1) - 1) % 3]; }
  const shapeOf = id => SHAPES.find(s => s.id === id) || SHAPES[0];
  // escolher a próxima: 3 sorteados (sem repetir a atual) num cartão; fora do jogo/teste vai direto
  function pickMountain() {
    if (!S.ended) { ui(() => UI.toast('Termine a primeira montanha antes', { icon: 'lock' })); return false; }
    const pool = SHAPES.filter(s => s.id !== shapeId()).sort(() => Math.random() - 0.5).slice(0, 3);
    if (FAST || !UI || !UI.dialog) return newMountain(pool[0].id);
    const rec = S.stats.rec || {};
    const d = UI.dialog({ kicker: 'Modo infinito', title: 'Qual montanha agora?', text: 'Tudo que você comprou continua. Escolha o formato:',
      buttons: pool.map(s => ({ title: s.n, sub: s.d + (rec[s.id] ? ' · recorde ' + Math.round(rec[s.id] / 60) + ' min' : ''), onClick: () => { newMountain(s.id); } })) });
    return !!d;
  }
  function newMountain(shape) {
    if (!S.ended) { ui(() => UI.toast('Termine a primeira montanha antes', { icon: 'lock' })); return false; }
    if (G.Tatu) G.Tatu.reset();   // túnel novo na montanha nova
    // recorde da montanha que está saindo (tempo do início até agora), só se cavou boa parte
    if (S.heapTotal && (S.heapTotal - S.heapArea) / S.heapTotal > 0.6) { const r = (S.stats.rec = S.stats.rec || {}), dt = S.time - (S.mountT || 0), id = shapeId(); if (!r[id] || dt < r[id]) r[id] = dt; }
    S.mount = (S.mount || 1) + 1; S.shape = typeof shape === 'string' ? shape : SHAPES[(S.mount - 1) % SHAPES.length].id; S.mountT = S.time;
    buildWorld();
    S.heapArea = heap.area; S.footX = scanFoot(); S.sacks.length = 0; S.quake = 0;
    S.bagX = Math.max(1000, S.footX - 760);
    if (cur.kind === 'bagger' && S.m) { S.m.x = S.footX - 700; S.m.vx = 0; P.x = S.m.x; }
    else seatBefore(S.footX);   // máquina de cabine / caminhão (a pá carregadeira também) ficam antes do pé, nunca dentro do monte
    S.lastDigX = S.footX; S.camX = P.x; yardSnap();
    if (!FAST) {
      fx.flash(PAL.cream, 0.4, 0.8); sfx('pling');
      ui(() => UI.banner('Montanha ' + S.mount + '!', shapeOf(shapeId()).n + ' · chegou arroz novo', { icon: 'rice', tone: 'gold', dur: 3 }));
    }
    saveNow(); return true;
  }
  /* ---- guarda-roupa: achados enterrados ---- */
  function findTreasure() {
    const left = D.CLOSET.filter(c => S.closet.indexOf(c.id) < 0 && !c.prize && (c.island === undefined || c.island === (S.island | 0))); if (!left.length) return;
    const c = left[(Math.random() * left.length) | 0]; S.closet.push(c.id); if (G.Home) G.Home.clothFound();
    if (!FAST) { ui(() => { UI.banner('Achado enterrado!', c.n + ' · vista na Casa › Roupas', { icon: 'hat', tone: 'gold', dur: 3 }); UI.toast('Roupinha nova: ' + c.n, { icon: 'hat', tone: 'gold', sub: 'toque em Casa (lá em cima) pra vestir', dur: 5 }); }); sfx('pling'); if (HUD.refreshCloset) HUD.refreshCloset(); }
  }
  function wear(kind, id) {
    if (kind === 'pal') { S.look.pal = id || 'kome'; if (S.m) S.m.pal = S.look.pal; }
    else S.look.acc = S.look.acc === id ? '' : id;
    saveNow();
  }
  // estrelinhas girando na cabeça quando ele bate no chão
  function drawDizzy(g, t) {
    if (!(S.stun > 0) || !T.head) return;
    T.head(S.m, HB); const sc = HB.sc || 1;
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + i * 2.094, x = HB.x + Math.cos(a) * 12 * sc, y = HB.y - 14 * sc + Math.sin(a) * 4 * sc, r = 3.2 * sc;
      Draw.poly(g, [[x, y - r * 1.4], [x + r * 0.45, y - r * 0.45], [x + r * 1.4, y], [x + r * 0.45, y + r * 0.45], [x, y + r * 1.4], [x - r * 0.45, y + r * 0.45], [x - r * 1.4, y], [x - r * 0.45, y - r * 0.45]], PAL.goldL, { ol: 1 });
    }
  }
  // acessórios no Kome (ferramentas de mão), presos na cabeça
  function drawAcc(g, t) {
    const a = S.look.acc || (FEEL.cold ? 'cachecol' : ''); if (!a || !T.head || FEEL.danced) return;   // frio e sem acessório: cachecol automático
    T.head(S.m, HB); drawAccAt(g, t, HB, a);
  }
  // desenha um acessório preso numa cabeça {x, y, f, sc, a}: usado no jogo, na Casa e nos ícones do guarda-roupa
  function drawAccAt(g, t, HB, a) {
    const f = HB.f, sc = HB.sc || 1;
    // acessório de ficha (conteudo/): sprite em pixel preso na cabeça
    const card = D.CLOSET.find(c => c.id === a && c.fromCard);
    if (card && card.sprite) {
      const cv = card.sprite(); if (!cv) return;
      const s = sc * (card.escala || 1), sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
      g.save(); g.translate(HB.x, HB.y); g.rotate(HB.a || 0); g.scale(f, 1);
      g.drawImage(cv, Math.round(((card.onde.x || 0) - cv.width / 2) * s), Math.round(((card.onde.y || 0) - cv.height / 2) * s), cv.width * s, cv.height * s);
      g.restore(); g.imageSmoothingEnabled = sm; return;
    }
    g.save(); g.translate(HB.x, HB.y); g.rotate(HB.a || 0); g.scale(f * sc, sc); g.lineCap = 'round';
    if (a === 'oculos') {
      g.fillStyle = '#1D1B22'; g.strokeStyle = PAL.line; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(4.5, -1.5, 3.2, 2.3, 0, 0, 6.3); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(-1.5, -1.8, 2.6, 2.1, 0, 0, 6.3); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(3.4, -3, 1.4, 0.9);
      g.strokeStyle = '#1D1B22'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(1.1, -1.8); g.lineTo(1.4, -1.8); g.moveTo(-4, -2); g.lineTo(-8, -3); g.stroke();
    } else if (a === 'cachecol') {
      const w = Math.sin(t * 9) * 2 + Math.min(4, Math.abs(P.vx) / 60) * -1;
      g.strokeStyle = PAL.line; g.lineWidth = 4.4; g.beginPath(); g.moveTo(-6, 7); g.quadraticCurveTo(0, 9, 6, 6.5); g.stroke();
      g.strokeStyle = PAL.red; g.lineWidth = 3; g.stroke();
      g.strokeStyle = PAL.line; g.lineWidth = 3.4; g.beginPath(); g.moveTo(-5, 7.5); g.lineTo(-12, 10 + w); g.stroke();
      g.strokeStyle = PAL.red; g.lineWidth = 2; g.stroke();
    } else if (a === 'coroa') {
      Draw.poly(g, [[-6, -10], [-6, -15], [-3, -12], [0, -17], [3, -12], [6, -15], [6, -10]], PAL.goldL, { ol: 0.8 });
      Draw.circle(g, 0, -12, 1, PAL.red, { ol: 0 });
    } else if (a === 'bandana') {
      g.strokeStyle = PAL.line; g.lineWidth = 4; g.beginPath(); g.moveTo(-8, -5); g.lineTo(7, -6.5); g.stroke();
      g.strokeStyle = '#3F78C8'; g.lineWidth = 2.6; g.stroke();
      const w = Math.sin(t * 12) * 1.5; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, -5); g.lineTo(-13, -2 + w); g.stroke();
    } else if (a === 'gorro') {
      g.fillStyle = '#C8423A'; g.strokeStyle = PAL.line; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-8, -7); g.quadraticCurveTo(-1, -19, 7, -8); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#F3EEE4'; g.fillRect(-8, -8.5, 15, 2.5); g.strokeRect(-8, -8.5, 15, 2.5);
      Draw.circle(g, -1 + Math.sin(t * 5) * 0.6, -17, 2, '#F3EEE4', { ol: 0.7 });
    } else if (a === 'laco') {
      Draw.poly(g, [[-7, -9], [-11, -12], [-11, -6]], '#E0405A', { ol: 0.7 }); Draw.poly(g, [[-7, -9], [-3, -12], [-3, -6]], '#E0405A', { ol: 0.7 });
      Draw.circle(g, -7, -9, 1.2, '#B8283E', { ol: 0.5 });
    } else if (a === 'capa') {
      const fl = Math.sin(t * 10) * 2 + Math.min(6, Math.abs(P.vx) / 40);
      g.fillStyle = '#C8423A'; g.strokeStyle = PAL.line; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(-4, 7); g.quadraticCurveTo(-12 - fl, 12, -16 - fl, 22); g.lineTo(-6, 20); g.quadraticCurveTo(-4, 14, 2, 8); g.closePath(); g.fill(); g.stroke();
    } else if (a === 'flor') {
      for (let i = 0; i < 5; i++) { const an = i * 1.2566 + t * 0.3; Draw.circle(g, -6 + Math.cos(an) * 2.2, -9 + Math.sin(an) * 2.2, 1.7, '#F6A8C0', { ol: 0.6 }); }
      Draw.circle(g, -6, -9, 1.1, PAL.goldL, { ol: 0 });
    }
    g.restore();
  }
  // faixa na cabeça (hachimaki) quando o combo está no máximo ou com o Kome Incansável
  const HB = {};
  function drawHeadband(g, t) {
    T.head(S.m, HB); const f = HB.f, sc = HB.sc || 1;
    g.save(); g.translate(HB.x, HB.y); g.rotate(HB.a || 0); g.scale(f * sc, sc);
    g.lineCap = 'round';
    g.strokeStyle = PAL.line; g.lineWidth = 4.2; g.beginPath(); g.moveTo(-8, -6); g.lineTo(6, -7.5); g.stroke();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 2.6; g.stroke();
    Draw.circle(g, 0, -6.8, 1.6, PAL.red, { ol: 0 });
    // pontas balançando atrás
    const w = Math.sin(t * 14) * 2;
    g.strokeStyle = PAL.line; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-8, -6); g.lineTo(-15, -4 + w); g.moveTo(-8, -6); g.lineTo(-14, -1 - w); g.stroke();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.3; g.stroke();
    g.restore();
  }
  // c6 Kome Workaholic: gota de suor quando ele cava sozinho
  /* ---- o Kome sente a ilha: frio (tremidinha parado, bafo, cachecol), calor (língua de fora, suor), praia (dancinha) ---- */
  const FEEL = { cold: false, hot: false, beach: false, float: false, idle: 0, puffT: 0, danced: false };
  function feelFlags() {
    const sc = G.Scenery ? G.Scenery.profile() : null, f = sc && sc.feel;
    FEEL.cold = f === 'cold'; FEEL.hot = f === 'hot'; FEEL.beach = f === 'beach'; FEEL.float = f === 'float';
    if (S.m && (cur.kind === 'hand')) S.m.idleAlt = FEEL.cold ? 'shake' : FEEL.hot ? 'pant' : FEEL.beach || FEEL.float ? 'wag' : null;
  }
  function feelTick(dt, hold) {
    const idle = !hold && Math.abs(P.vx) < 6 && P.ground && !(S.stun > 0);
    FEEL.idle = idle ? FEEL.idle + dt : 0;
    const ev = G.Islands && G.Islands.event();   // gravidade fofa: parado, o Kome quica sozinho
    if (ev && ev.grav && idle && P.ground && cur.kind === 'hand' && (FEEL.hop = (FEEL.hop || 0) - dt) <= 0) { FEEL.hop = 1.3; P.vy = -300; P.y -= 2; P.ground = false; }
    if (FAST || !T.head || !(FEEL.cold || FEEL.hot) || (FEEL.puffT -= dt) > 0) return;
    T.head(S.m, HB); const sc = HB.sc || 1;
    if (FEEL.cold) FEEL.puffT = 1;   // o bafo é desenhado em drawBreath
    else if (FEEL.idle > 1.5) { FEEL.puffT = 0.6; parts.puff(HB.x - HB.f * 2 * sc, HB.y - 10 * sc, 1, 2.6 * sc, { c: '#FFF1D6', up: 14 * sc, speed: 2 * sc, life: 0.8 }); }   // calorão subindo
    else FEEL.puffT = 0.5;
  }
  // desenha o Kome quando o clima muda o jeito dele; true = já desenhou
  function drawFeel(g, t) {
    FEEL.danced = false;
    const k = cur.kind; if (k !== 'hand' && k !== 'push' && k !== 'jack') return false;
    if (FEEL.beach && k === 'hand' && FEEL.idle > 4 && FEEL.idle % 9 > 5.5 && T.head) {   // praia: larga a ferramenta e dança um pouquinho
      T.head(S.m, HB); FEEL.danced = true;
      E.drawShiba(g, P.x, P.y, FEEL.idle % 2 < 1 ? 'dance' : 'dance2', t, { scale: HB.sc || 1, face: P.face, pal: S.look.pal || 'kome', shadow: true });
      return true;
    }
    if (FEEL.cold) {
      const shv = FEEL.idle > 1.5;   // parado no frio: tremidinha rápida no corpo todo
      if (shv) { g.save(); g.translate(Math.sin(t * 71) * 0.55 * ((S.m && S.m.sc) || 1), Math.abs(Math.sin(t * 53)) * 0.25); }
      T.draw(g, S.m); if (shv) g.restore();
      drawBreath(g, t, shv ? 1.1 : 1.9);
      return true;
    }
    if (FEEL.hot && FEEL.idle > 2) { T.draw(g, S.m); drawSweat(g, t); return true; }
    return false;
  }
  // bafo de frio: nuvenzinha que sai do focinho a cada `per` segundos, cresce e some
  function drawBreath(g, t, per) {
    if (!T.head) return; const q = (t % per) / 0.9; if (q >= 1) return;
    T.head(S.m, HB); const sc = HB.sc || 1, f = HB.f, x = HB.x + f * (12 + q * 12) * sc, y = HB.y + (1.5 - q * 4) * sc, r = (3.2 + q * 5) * sc;
    g.save(); g.globalAlpha = 0.95 * (1 - q * q);
    g.fillStyle = '#FFFFFF'; g.strokeStyle = 'rgba(150,180,210,.9)'; g.lineWidth = Math.max(0.4, 0.5 * sc);
    g.beginPath(); g.arc(x, y, r, 0, 6.3); g.arc(x + f * r * 0.9, y - r * 0.35, r * 0.75, 0, 6.3); g.arc(x + f * r * 0.2, y + r * 0.45, r * 0.6, 0, 6.3); g.fill();
    g.globalAlpha *= 0.6; g.stroke();
    g.restore();
  }
  function drawSweat(g, t) {
    const u = (t * 0.9) % 1, x = P.x - P.face * 6, y = P.y - 40 + u * 10;
    g.save(); g.globalAlpha = u < 0.8 ? 1 : (1 - u) * 5;
    g.fillStyle = '#7CC4F0'; g.strokeStyle = PAL.line; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x, y - 4); g.quadraticCurveTo(x + 3, y + 1, x, y + 2.6); g.quadraticCurveTo(x - 3, y + 1, x, y - 4); g.fill(); g.stroke();
    g.restore();
  }
  // cestinho de bambu nas costas do Kome (preso no ponto 'back' da pose, gira junto com o corpo)
  function drawBackpack(g, c, t) {
    const sc = c.sc || 1, f = c.f || 1, fill = Math.min(1, (c.pulse || 0) * 0.6 + 0.4);
    g.save(); g.translate(c.x, c.y); g.rotate(c.a || 0); g.scale(f * sc, sc);
    g.lineJoin = 'round';
    // alça passando pelo peito
    g.strokeStyle = PAL.line; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-1, -2); g.quadraticCurveTo(5, 3, 9, 6); g.stroke();
    g.strokeStyle = PAL.red; g.lineWidth = 1.2; g.stroke();
    // cesto (um pouco mais largo em cima), atrás das costas
    const x0 = -9, y0 = -9;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 10, y0); g.lineTo(x0 + 9, y0 + 9); g.lineTo(x0 + 1, y0 + 9); g.closePath();
    g.fillStyle = PAL.woodL; g.fill(); g.strokeStyle = PAL.line; g.lineWidth = 1; g.stroke();
    g.strokeStyle = PAL.wood; g.lineWidth = 0.7; g.beginPath();
    for (let i = 1; i < 3; i++) { const y = y0 + i * 3; g.moveTo(x0 + 0.4 + i * 0.12, y); g.lineTo(x0 + 9.6 - i * 0.12, y); }
    g.stroke();
    // arroz aparecendo por cima
    g.fillStyle = PAL.rice; g.beginPath(); g.ellipse(x0 + 5, y0, 4.6, 1.2 + 1.3 * fill, 0, Math.PI, Math.PI * 2); g.fill();
    g.strokeStyle = PAL.line; g.lineWidth = 0.6; g.stroke();
    g.restore();
  }
  function collectorTick(dt) {
    const c = S.col, X = Wd.layout(S);
    if (c.kind === 'barraca' && X.barraca > WL.MX1) c.kind = 'kei';   // a barraquinha mudou pra vila: quem volta pra pá entrega no kei-truck
    const k = c.kind;
    if (k === 'cesto') { if (T.back && S.m) { T.back(S.m, c); } else { c.x = P.x - P.face * 10; c.y = P.y - 18; c.a = 0; c.f = P.face; c.sc = 1; } }
    else if (k === 'saco') { if (Math.abs(P.x - c.x) > 170) c.x = P.x - P.face * 80; c.y = heap.surf(c.x); }
    else if (k === 'barraca') { c.x = X.barraca + 6; c.y = -40; }
    else if (k === 'kei') { let tx = Math.max(X.keiMin, P.x - 190 - (cur.park || 0)); if (X.barraca < WL.MX1 && Math.abs(tx - X.barraca) < 120) tx = X.barraca + 120;   // barraquinha ainda do lado da cava: o kei-truck não estaciona em cima dela
      if (Math.abs(tx - c.x) > 120) c.x = U.damp(c.x, tx, 2, dt); c.y = heap.surf(c.x); }
    else if (k === 'silo') { const tx = Math.max(X.keiMin + 40, P.x - (T.w || 200) / 2 - 96); if (Math.abs(tx - c.x) > 60) c.x = U.damp(c.x, tx, 2, dt); c.y = heap.surf(c.x); }   // moega pequena logo atrás da máquina (o silo fica depois do estacionamento: a esteira leva)
    else if (cur.kind === 'haul') { c.x = iT.x - (T.meta.haul + 215); c.y = heap.surf(c.x); }
    else if (cur.kind === 'bagger') { const d = T.dump(S.m); c.x = d ? d.x : P.x - 700; c.y = 0; }
    else { const tx = P.x - 430; if (Math.abs(tx - c.x) > 160) c.x = U.damp(c.x, tx, 1.5, dt); c.y = heap.surf(c.x); }
  }
  // onde os ajudantes cavam: junto do Kome a pé; com máquina, num canto próprio da encosta (sem grudar na máquina)
  // tremor: só a montanha (forte) e o chão (fraco) tremem; a câmera e as máquinas ficam firmes
  function quake(v) { S.quake = Math.min(1, (S.quake || 0) + v); }
  function helpBase() {
    if (cur.kind === 'hand' || cur.kind === 'push' || cur.kind === 'jack') return S.lastDigX;
    const x0 = Math.max(P.x + (cur.reach || 60) + 260, S.footX + 220);
    let x = x0; for (; x < x0 + 900; x += 12) if (heap.height(x) > 60) break;
    return x + 60;
  }
  function helpersTick(dt) {
    const n = Math.min(10, st.help);
    while (S.helpers.length < n) S.helpers.push({ x: S.lastDigX - 60 - S.helpers.length * 30, y: 0 });
    const hb = helpBase();
    for (let i = 0; i < n; i++) {
      const hlp = S.helpers[i], side = i % 2 ? 1 : -1, tx = hb + side * (36 + (i >> 1) * 30) * Math.max(1, cur.r / 20) - 40;
      hlp.vx = U.clamp((tx - hlp.x) * 2, -160, 160); hlp.x += hlp.vx * dt; hlp.y = heap.surf(hlp.x);
    }
  }
  function camTick(dt) {
    const c = S.cele, k = cur.kind;
    let z = cur.zoom * (S.zoomMul || 1) * (S.twinPlay && cur.kind === 'bagger' ? 0.72 : 1) * (G.Ind && cur.kind === 'bagger' ? G.Ind.zoomK() : 1), zk = 2.2;
    if (c.t >= 0) {
      if (c.big) {
        if (c.t < 1.6) { z = 0.62; zk = 3; }
        else if (c.t < 4.6) { z = Math.exp(U.lerp(Math.log(0.62), Math.log(cur.zoom), (c.t - 1.6) / 3)); zk = 30; }
      } else if (c.t < 0.4) { z = c.z0 * 1.25; zk = 9; } else zk = 1.9;
    }
    if (visit) { z = visit.z || 1.5; zk = 3; }
    cam.zoomTo(z, zk);
    let fxx = P.x, fyy = P.y;
    if (S.camLock) { cam.zoomTo(S.camLock.z, 9); cam.follow(S.camLock.x, S.camLock.y !== undefined ? S.camLock.y : -120, dt, 9); cam.update(dt); return; }   // só pra testes/prints
    if (ptour && patioTourCam(dt)) return;   // Ver o Pátio (só câmera)
    const vcl = vila.on ? (vila.auto > 0 ? 2 : 1) : 0;   // 1 = o jogador quis ver a vila: some o HUD de cavar; 2 = voo automático: a doca fica
    if (vcl !== vila.cls) { vila.cls = vcl; document.body.classList.toggle('k-vila', vcl === 1); document.body.classList.toggle('k-vila-auto', vcl === 2); }   // game.css
    if (vila.on && vila.k >= 1 && !vila.auto && vila.hintT === undefined) vila.hintT = 3.6; if (vila.hintT > 0 && vila.k >= 1) vila.hintT -= dt;
    if (vila.on || vila.k > 0) {
      if (vila.on && vila.auto > 0 && vila.k >= 1 && (vila.auto -= dt) <= 0) vila.on = false;
      if (vila.hold === undefined) vila.k = U.clamp(vila.k + (vila.on ? dt : -dt) / 1.5, 0, 1); else vila.k = vila.hold;   // hold: só pros prints (voo congelado)
      if (vila.k > 0) {
        // voo POR CIMA do pico atual: e = vai-e-vem suave (smootherstep); up sobe rápido e fica chato no alto. No ápice o centro da
        // câmera passa ACIMA do pico (pico + 8% da tela de folga): a encosta nunca raspa na câmera. O zoom NÃO abre mais que 60%
        // do zoom de quem está mais aberto (pátio ou vila): em vez de afastar (no celular virava formiga), o caminho sobe.
        // Montanha quase toda cavada = pico baixo = voo baixo. vila.fly (0..1) = velocidade do voo, pras nuvens e riscos (drawFlight).
        const k = vila.k, e = k * k * k * (k * (6 * k - 15) + 10), a = Math.sin(Math.PI * e), up = 1 - (1 - a) * (1 - a), vy = -0.2 * H / vila.z;
        const pk = heap.peak ? heap.peak().h : heap.maxH, zb = Math.exp(U.lerp(Math.log(vila.hz), Math.log(vila.z), e));
        const zA = Math.min(zb, Math.max(H / (pk * 1.5 + 500), 0.6 * Math.min(vila.hz, vila.z))), yb = U.lerp(vila.hy, vy, e), yA = Math.min(yb - 160, -pk - 0.08 * H / zA);
        vila.fly = a; vila.dir = vila.on ? 1 : -1;
        cam.snapTo(U.lerp(vila.hx, vila.x, e), U.lerp(yb, yA, up), Math.exp(U.lerp(Math.log(zb), Math.log(zA), up))); cam.maxShake = 0; cam.update(dt); return;
      }
      vila.fly = 0;
      cam.snapTo(vila.hx, vila.hy, vila.hz);
    }
    if (visit) { const hw0 = W / 2 / cam.z; cam.follow(U.clamp(visit.x, hw0 + Wd.X.minX, WL.WW - hw0 + (visit.far ? 1400 : 40)), visit.y !== undefined ? visit.y : -60 + 0.16 * H / cam.z, dt, 3.2); cam.maxShake = S.opts.shake ? 12 : 0; cam.update(dt); return; }
    if (k === 'hand' || k === 'push' || k === 'jack') {
      // zona morta: a câmera só anda quando o Kome chega perto da borda, senão o ponteiro (fixo na tela) fugiria dele pra sempre
      const dz = W * 0.24 / cam.z;
      if (P.x > S.camX + dz) S.camX = P.x - dz; else if (P.x < S.camX - dz) S.camX = P.x + dz;
      fxx = S.camX;
    }
    else if (k === 'bagger') { fxx = (c.t >= 0 && c.t < 1.6 ? S.m.x - 100 : S.m.x - 130) - (Wd.X.gemeaK ? 300 : 0); fyy = 0; }   // com a Gêmea ao lado, o quadro puxa pra ela
    else if (k === 'haul') fxx = P.x - 90;   // um pouco pra trás: o pátio (que acompanha a frente) fica na tela
    else if (k === 'rope') fxx = P.x - 40;   // pá de cabo: quadro um pouco pra trás, o pátio aparece
    else fxx = P.x + cur.park * 0.7;
    const gf = k === 'hand' || k === 'push' || k === 'jack' ? 0.66 : WL.GROUND_FRAC;
    const hw = W / 2 / cam.z;
    cam.follow(U.clamp(fxx, hw + Wd.X.minX, WL.WW - hw + 40), fyy - (gf - 0.5) * H / cam.z, dt, 4.5);
    cam.maxShake = S.opts.shake ? 12 : 0;
    cam.update(dt);
  }

  const view = { x0: 0, x1: 0, y0: 0, y1: 0 }, sp = { x: 0, y: 0 };
  const hsO = { face: 1, scale: 0.8, pal: 'goma', shadow: true };
  // avalanche com peso: grãos rolando sempre; deslizamento grande (muito arroz em meio segundo) = poeira, tremor e ronco
  const SV = { x0: 0, x1: 0 };
  function slideTick(dt) {
    if (!slideFX) return;
    const half = W / 2 / Math.max(0.05, cam.z); SV.x0 = cam.x - half; SV.x1 = cam.x + half;
    slideFX.update(dt, SV);
    slideSum += heap.flow; slideT += dt; rumbleCD -= dt;
    if (slideT >= 0.5) {
      const big = 2500 / Math.max(0.25, cam.z);            // escala com o zoom: máquina grande precisa de deslizamento maior
      if (slideSum > big && rumbleCD <= 0) {
        rumbleCD = 2.5; const k = Math.min(1, slideSum / (big * 4)), x = heap.flowX, y = heap.surf(x);
        quake(0.12 + 0.25 * k); parts.puff(x, y, 4 + Math.round(8 * k), 10 + 10 * k, { c: PAL.sand }); sfx('rumble', { vol: 0.35 + 0.5 * k });
      }
      slideSum = 0; slideT = 0;
    }
  }
  // pé da montanha: sombra de contato na grama e grãos soltos espalhados (a pilha não fica "carimbada" na linha do chão)
  const FOOT_R = E.RNG(4242), FOOT_G = Array.from({ length: 70 }, () => ({ d: Math.pow(FOOT_R(), 1.8) * 170, y: 1 + FOOT_R() * 7, a: FOOT_R() * 3, s: 0.8 + FOOT_R() * 0.7 }));
  function drawFoot(g, v) {
    const fx = S.footX; if (!(fx > v.x0 - 260 && fx < v.x1 + 260)) return;
    g.save();
    const sh = g.createLinearGradient(0, 0, 0, 10); sh.addColorStop(0, 'rgba(70,50,30,.22)'); sh.addColorStop(1, 'rgba(70,50,30,0)');
    g.fillStyle = sh; g.fillRect(fx - 30, 0, Math.min(WL.MX1, v.x1 + 50) - fx + 30, 10);          // faixa de sombra ao longo da base
    g.fillStyle = 'rgba(70,50,30,.14)'; g.beginPath(); g.ellipse(fx - 12, 2, 46, 5, 0, 0, 6.3); g.fill();   // sombra mais forte no pezinho
    g.lineWidth = Math.max(0.35, 0.9 / Math.max(1, cam.z)); g.strokeStyle = PAL.line;
    // grãos do tamanho do grão da textura: em lote (1 caminho por cor + 1 contorno; eram 140 desenhos por quadro). Quase não se
    // encostam, então a ordem de quem fica por cima não aparece
    for (let pass = 0; pass < 3; pass++) {
      g.beginPath();
      for (let i = 0; i < FOOT_G.length; i++) {
        const q = FOOT_G[i], x = fx - 6 - q.d; if (x < v.x0 || x > v.x1 || (pass < 2 && (q.a > 2) !== (pass === 1))) continue;
        const rx = 1.5 * q.s; g.moveTo(x + rx * Math.cos(q.a), q.y * 0.6 + rx * Math.sin(q.a)); g.ellipse(x, q.y * 0.6, rx, 0.62 * q.s, q.a, 0, 6.3);
      }
      if (pass < 2) { g.fillStyle = pass ? PAL.riceS : PAL.rice; g.fill(); } else g.stroke();
    }
    g.restore();
  }
  // máquina de fundo com zoom aberto: desenha numa imagem e reaproveita por alguns quadros (celular ficava lento com a Bagger)
  let machFrame = 0, machSeq = 0; const BAGC = {};
  // force = imagem mesmo de perto (frota estacionada parada: redesenha a cada 4 quadros, a cada 8 com zoom < 0,45 — parada, o que
  // mexe nela é menor que 1 pixel de tela nesse zoom; até zoom 1,5 a imagem tem a resolução da tela)
  function drawMach(g, id, m, f, force) {
    const T0 = G.Tools[id], z = cam.z;
    if ((z > 0.55 && !f.always && !(force && z <= 1.5)) || !T0.w) { T0.draw(g, m); return; }
    // sem f.res: a imagem nasce na escala do aparelho (transformação atual de g) e entra pixel com pixel, sem reamostrar
    // (carimbo esticado/suavizado custava ~0,6 ms por máquina no celular). Mais de 1,5x de zoom: imagem limitada e esticada.
    const tm = f.res ? null : g.getTransform(), td = tm && !tm.b && !tm.c ? Math.abs(tm.d) : 0;
    const k = td && td <= 1.5 * stage.dpr ? td : Math.min(1.5, z * (f.res || 1)) * stage.dpr, mk = m.k || 1, W0 = (T0.w || 300) * 1.6 * mk, H0 = (T0.h || 200) * 1.7 * mk, x0 = m.x - W0 / 2, y0 = m.y - H0, bw = Math.ceil(W0 * k), bh = Math.ceil((H0 + 40) * k);
    const c = f._cv || (f._cv = document.createElement('canvas')), mir = cam.mx < 0;
    // zoom andando (tamanho mudou e a escala não é a do quadro passado): desenha direto em vez de refazer a imagem todo quadro
    if (f._ok && !f.flt && (c.width !== bw || c.height !== bh) && f._pk !== k) { f._pk = k; T0.draw(g, m); return; }
    f._pk = k;
    if (c.width !== bw || c.height !== bh || !f._ok || f._mir !== mir || (machFrame - (f._fr || 0)) > (f.every || (force && z < 0.45 ? 7 : z < 0.3 ? 6 : 3)) || Math.abs(m.x - f._mx) > 60) {
      if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
      const cg = c.getContext('2d'); cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, bw, bh);
      // ilha espelhada: a imagem já é desenhada espelhada (assim placas e textos da máquina saem legíveis) e carimbada sem espelhar
      if (mir) cg.setTransform(-k, 0, 0, k, (x0 + W0) * k, -y0 * k); else cg.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
      T0.draw(cg, m);
      if (f.flt) { cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'copy'; try { cg.filter = f.flt; } catch (e) { /* sem filter: cor normal */ } cg.drawImage(c, 0, 0); cg.filter = 'none'; cg.globalCompositeOperation = 'source-over'; }   // cor filtrada 1x na imagem
      if (f._ph === undefined) f._ph = (machSeq++) % 4;   // cada imagem refaz num quadro diferente (não todas juntas no mesmo quadro)
      f._ok = true; f._fr = f._fr === undefined ? machFrame - f._ph : machFrame; f._mx = m.x; f._x0 = x0; f._y0 = y0; f._mir = mir;
    }
    const bx = f._x0 + (m.x - f._mx);
    if (k === td && Math.abs(Math.abs(tm.a) - td) < 1e-6 * td) {
      const X = Math.round(tm.a < 0 ? tm.a * (bx + W0) + tm.e : tm.a * bx + tm.e), Y = Math.round(tm.d * f._y0 + tm.f);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(c, X, Y); g.restore(); return;
    }
    if (mir) { g.save(); g.translate(bx + W0 / 2, 0); g.scale(-1, 1); g.drawImage(c, -W0 / 2, f._y0, W0, H0 + 40); g.restore(); }
    else g.drawImage(c, bx, f._y0, W0, H0 + 40);
  }
  G.drawMach = (g, id, m, f) => drawMach(g, id, m, f);   // industry.js: a Gêmea usa o mesmo cache (uma imagem só passa pelo filtro de cor)
  let HEAP_CACHE = !/[?&]nocache\b/.test(location.search);   // ?nocache = montanha desenhada inteira todo quadro (comparar)
  function render() {
    machFrame++;
    stage.begin(); E.drawShiba.loose = false;
    // cena de fim do dia já opaca: o mundo todo ficaria escondido atrás dela (economiza ~5 s de quadros pesados por dia)
    if (S.dayEnd > 0 && !cs && !S.oni.on && !(S.stamp > 0) && !(G.Home && G.Home.isOpen()) && Math.min(1, (DAY_SCENE - S.dayEnd) / 0.5, S.dayEnd / 0.5) >= 1) { drawDayEnd(g, S.time); fx.draw(g); return; }
    const t = S.time, z = cam.z;
    // fundo (céu, sol, nuvens, Fuji, morros) em pixel art no traço do Kome: desenhado numa tela 3x menor e ampliado sem suavizar.
    // Fica atrás de tudo e não depende do zoom, então o pixel não "pula". A montanha de arroz, o pátio e as máquinas seguem lisos.
    const pf = S.opts.pixel === false ? 1 : Math.max(2, Math.round(3 * stage.dpr));
    if (pf > 1) {
      const main = g, pw = Math.ceil(W * stage.dpr / pf), ph = Math.ceil(H * stage.dpr / pf);
      if (!pixCv) { pixCv = document.createElement('canvas'); pixG = pixCv.getContext('2d'); }
      if (pixCv.width !== pw || pixCv.height !== ph) { pixCv.width = pw; pixCv.height = ph; BGC.n = 0; }
      // imagem do fundo guardada: com a câmera parada, só redesenha a cada 2 quadros (nuvens/pássaros andam menos de 1 pixel
      // grosso por quadro); câmera mexeu, hora mudou ou tamanho mudou = redesenha na hora
      const bsig = cam.x + '|' + cam.y + '|' + cam.z + '|' + cam.mx + '|' + Math.round((S.tod || 0) * 400) + '|' + (S.island | 0);
      if (BGC.n <= 0 || bsig !== BGC.sig) {
        BGC.sig = bsig; BGC.n = BGC.every;
        const k = stage.dpr / pf; pixG.setTransform(k, 0, 0, k, 0, 0); pixG.globalAlpha = 1; pixG.imageSmoothingEnabled = false;
        pixG.fillStyle = PAL.sky; pixG.fillRect(0, 0, W, H);
        if (cam.mx < 0) pixG.setTransform(-k, 0, 0, k, W * k, 0);   // ilha espelhada: o fundo vira junto com o mundo
        g = pixG; Wd.drawBack(g, cam, t, S); g = main;
      }
      BGC.n--;
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
      g.drawImage(pixCv, 0, 0, pixCv.width * pf, pixCv.height * pf); g.restore();
    } else if (cam.mx < 0) { g.save(); g.translate(W, 0); g.scale(-1, 1); Wd.drawBack(g, cam, t, S); g.restore(); } else Wd.drawBack(g, cam, t, S);
    cam.begin(g);
    cam.view(view, 30 / z);
    Draw.lod(z, 0.6);
    E.drawShiba.loose = true;   // shibas de fundo (ajudantes, pilotos da frota) em laço guardado; Kome e a máquina dele: exatos
    // 1. Bagger em montagem (atrás de tudo) e pátio
    if (G.Ind) G.Ind.drawBack(g, t);
    if (S.bag && S.bag.m !== S.m) {
      // com o Kome em outra máquina a Bagger fica meio transparente: continua ali trabalhando, mas não tapa a visão
      const ghost = S.tool === NT - 1; if (ghost) { g.save(); g.globalAlpha = 0.38; }
      G.Tools.bagger.draw(g, S.bag.m);
      if (ghost) g.restore();
    }
    // 2. montanha + chão
    const qa = (S.quake || 0) * (S.quake || 0) * 9 / Math.max(0.2, cam.z), qx = (Math.random() - 0.5) * 2 * qa, qy = (Math.random() - 0.5) * 2 * qa;
    g.save(); g.translate(qx, qy);
    heap.draw(g, view, t, { pockets: st.glow && !(G.Faixas && G.Faixas.has('escondido')) ? 'hint' : 'found', rolling: !slideFX, cache: HEAP_CACHE });   // corpo guardado em tela de apoio (só refaz o que cavou)
    if (slideFX) slideFX.draw(g, cam.z);
    if (G.Scenery) G.Scenery.crest(g, heap, view, t, cam.z, S);   // neve / cinza / areia / brilho de mochi por cima
    if (S.own.s10) drawVeins(g, view, t);
    if (G.Tatu) { G.Tatu.drawTunnel(g, view); G.Tatu.draw(g, view); }   // Tatuzão furando a montanha
    g.restore(); g.save(); g.translate(qx * 0.3, qy * 0.3);
    Wd.drawGround(g, view, z);
    drawFoot(g, view);
    g.restore();
    Wd.drawYard(g, view, t, S);
    if (G.Ind) G.Ind.drawFront(g, t, IND_CTX());   // fábrica do modo infinito: na frente do pátio, atrás das máquinas
    if (G.Belts) G.Belts.draw(g, t);               // esteiras: pé da montanha -> coletor -> silo
    // 3. frota estacionada (faixa da frente)
    for (let i = 0; i < S.fleet.length; i++) {
      const f = S.fleet[i]; if (!f.warm || !cam.visible(f.x, -150, 800) || (f.st && f.st !== 'park' && !f.bay)) continue;
      drawMach(g, f.id, f.m, f, !f.st || f.st === 'park');
      if (!st.pilots[f.id]) { const w = 86, hh = 22; Draw.sign(g, f.x - w / 2, f.y - G.Tools[f.id].h - 44, w, hh, 'PRECISA-SE PILOTO', { col: PAL.cream, ink: PAL.red }); Draw.text(g, 'z z z', f.x + 30, f.y - G.Tools[f.id].h - 54 - 6 * Math.sin(t * 2), { size: 13, col: PAL.cream, sw: 3 }); }
    }
    // 4. coletor, sacos, ajudantes
    const c = S.col;
    if (c.kind === 'cesto') { /* desenhado depois do Kome (mochila nas costas) */ }
    else if (c.kind !== 'barraca') Wd.drawCollector(g, c, t, S);
    if (S.own.m7a && c.kind !== 'cesto') drawSeal(g, c.x + 14, c.y - 22, t);
    const nh = Math.min(S.helpers.length, st.help), hb0 = helpBase();
    for (let i = 0; i < nh; i++) {
      const hp = S.helpers[i]; if (!cam.visible(hp.x, hp.y, 60)) continue;
      hsO.pal = HELP_PAL[i % HELP_PAL.length]; hsO.face = hp.x < hb0 ? 1 : -1; hsO.scale = i === 4 ? 0.62 : 0.8;
      E.drawShiba(g, hp.x + (FEEL.cold && Math.abs(hp.vx) <= 30 ? Math.sin(t * 64 + i * 2) * 0.7 : 0), hp.y, Math.abs(hp.vx) > 30 ? 'run' : 'dig', t * (S.own.e1 ? 1.4 : 1) + i, hsO);
      if (S.own.a6) {   // a6 Pás pros Shibas: cada ajudante ganha uma pazinha que sobe e desce
        const f = hsO.face, a = (Math.abs(hp.vx) > 30 ? 0.5 : 0.2 + 0.7 * Math.abs(Math.sin(t * 9 + i * 1.7))) * f, sc = hsO.scale;
        g.save(); g.translate(hp.x + f * 9 * sc, hp.y - 12 * sc); g.rotate(a); g.lineCap = 'round';
        g.strokeStyle = PAL.line; g.lineWidth = 3.4 * sc; g.beginPath(); g.moveTo(0, -6 * sc); g.lineTo(0, 12 * sc); g.stroke();
        g.strokeStyle = PAL.wood; g.lineWidth = 1.8 * sc; g.stroke();
        Draw.poly(g, [[-4 * sc, 11 * sc], [4 * sc, 11 * sc], [3.4 * sc, 19 * sc], [0, 21 * sc], [-3.4 * sc, 19 * sc]], PAL.steelL, { ol: 1 });
        g.restore();
      }
      if (S.own.e4 && G.Props.hardhat) { const hh = G.Props.hardhat(); g.imageSmoothingEnabled = false; g.drawImage(hh.cv, hp.x + hsO.face * 6 - hh.ax, hp.y - 30 - hh.ay); }
    }
    for (let i = 0; i < S.sacks.length; i++) drawSack(S.sacks[i], t);
    drawFleetBg(g);
    // 5. ferramenta atual
    E.drawShiba.loose = false;
    if (S.loader) G.Tools.escav.draw(g, S.loader);
    const twinPaint = S.twinPlay && cur.kind === 'bagger' && G.Ind && G.Ind.paintFilter ? G.Ind.paintFilter() : '';
    // Gêmea pilotada: a máquina vai pra uma tela de apoio e entra com UM filtro de cor (filtro por traço = celular a 3 quadros/s)
    if (twinPaint) Wd.filtered(g, twinPaint, null, c => { if (cam.z < 0.3) { BAGC.every = 1; drawMach(c, 'bagger', S.m, BAGC); } else if (!drawFeel(c, t)) T.draw(c, S.m); });
    else if (cur.kind === 'bagger' && cam.z < 0.3) { BAGC.every = 1; drawMach(g, 'bagger', S.m, BAGC); } else if (!drawFeel(g, t)) T.draw(g, S.m);   // zoom bem aberto: Bagger em cache
    if (c.kind === 'cesto' && cur.kind === 'hand') drawBackpack(g, c, t);
    p2Draw(g, t);
    E.drawShiba.loose = true;
    for (let i = 0; i < S.fleet.length; i++) { const f = S.fleet[i]; if (f.st && f.st !== 'park' && !f.bay && !f.bg && f.warm && cam.visible(f.x, f.y - 150, 800)) drawMach(g, f.id, f.m, f); }
    E.drawShiba.loose = false;   // frota indo cavar no barranco (Kome a pé), na faixa da frente
    if (crack.k > 0.05 && cur.kind === 'jack') drawCrack(g);
    if (S.own.c6 && S.autoMode && cur.kind === 'hand') { drawSweat(g, t); if (S.own.c6b) drawSweat(g, t + 0.45); }
    if (cur.kind === 'hand' || cur.kind === 'push' || cur.kind === 'jack') { drawAcc(g, t); drawDizzy(g, t); }   // acessório também com carrinho e britadeira
    if (cur.kind === 'hand' && T.head && (S.combo >= D.COMBO.max - 0.01 || (S.autoMode && S.own.c6c))) drawHeadband(g, t);
    if (cur.kind === 'haul') Draw.text(g, 'Carga ' + Math.round((S.m.load || 0) * 100) + '%', iT.x - 40, iT.y - 250, { size: 30, col: S.m.load >= 1 ? PAL.gold : PAL.cream, sw: 8 });
    if (S.furia > 0 && cur.seat === 'paw') { g.globalAlpha = 0.25 + 0.1 * Math.sin(t * 20); Draw.circle(g, P.x, P.y - 20, 30, PAL.red, { ol: 0 }); g.globalAlpha = 1; }
    parts.draw(g, view);
    for (let i = 0; i < Wd.layers.front.length; i++) Wd.layers.front[i](g, view, t, S);
    cam.end(g);
    if (G.Scenery && !(G.Home && G.Home.isOpen())) { g.save(); g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0); G.Scenery.air(g, W, H, cam, t, S); g.restore(); }   // neve, cinza, pétalas...
    // tinta da hora sobre o mundo: dourado no fim da tarde, azulado no anoitecer
    if (E.Nature && E.Nature.light && S.tod > 0.55) {
      const L = E.Nature.light(S.tod);
      g.save(); g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = Math.min(0.45, 0.25 * L.dusk + 0.4 * L.night); g.fillStyle = L.tint; g.fillRect(0, 0, W, H);
      g.restore();
    }
    Draw.lod(1);
    drawFlight(g, t);
    floaters.draw(g, cam);
    // 6. tela: onigiri, indicador do coletor na borda, carimbo da Bagger, efeitos
    if (G.Home && !cs) { const dtw = Math.min(0.1, Math.max(0, t - (render.lt || t))); render.lt = t; g.save(); g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0); G.Home.worldFX(g, dtw, W, H); g.restore(); }
    if (S.dayEnd > 0) drawDayEnd(g, t);
    if (G.Home && G.Home.isOpen()) G.Home.draw(g, t);
    if (cs) drawCutscene(g, t);
    if (S.oni.on) drawOnigiri(t);
    if (!cs && !cam.visible(c.x, c.y - 20, 0) && c.pulse > 0) {
      const left = (c.x < cam.x) !== (cam.mx < 0), ex = left ? 24 : W - 24, ey = H * 0.6;
      g.globalAlpha = 0.5 + 0.5 * c.pulse; Draw.circle(g, ex, ey, 15 + 4 * c.pulse, PAL.gold, { ol: 2.5 }); Draw.text(g, '¥', ex, ey + 1, { size: 17, col: PAL.cream, sw: 4 });
      g.fillStyle = PAL.line; g.beginPath(); g.moveTo(ex + (left ? -22 : 22), ey); g.lineTo(ex + (left ? -14 : 14), ey - 7); g.lineTo(ex + (left ? -14 : 14), ey + 7); g.fill(); g.globalAlpha = 1;
    }
    if (S.stamp > 0) {
      const u = 1 - S.stamp / 2.6, k = u < 0.08 ? 3 - 2 * (u / 0.08) : 1, a = S.stamp < 0.4 ? S.stamp / 0.4 : 1;
      g.save(); g.globalAlpha = a; g.translate(W / 2, H * 0.4); g.scale(k, k); g.rotate(-0.04);
      Draw.text(g, 'BAGGER 293', 0, 0, { size: 92, col: PAL.gold, sw: 16 });
      Draw.text(g, '96 m. 14.200 t. 1 shiba.', 0, 62, { size: 28, col: PAL.cream, sw: 8 });
      g.restore();
    }
    fx.draw(g);
  }
  /* voo pra Vila (e a volta): nuvens fofas e riscos de vento passando na tela, pro voo "ler" como voo (pedido do dono).
     Tudo em coordenada de tela; a força vem de vila.fly (0 parado .. 1 no meio do voo) e o lado de vila.dir. Sem estado. */
  const FLY_R = E.RNG(8128), FLY_S = Array.from({ length: 16 }, () => ({ y: FLY_R(), s: 0.7 + FLY_R() * 0.9, l: 50 + FLY_R() * 130, p: FLY_R() })),
    FLY_C = Array.from({ length: 6 }, () => ({ y: 0.08 + FLY_R() * 0.7, s: 0.9 + FLY_R() * 1.3, p: FLY_R(), v: 0.6 + FLY_R() * 0.5 }));
  let flyCv = null;
  // na vila: setinhas nas bordas quando tem mais rua pra ver (arrastar passeia), e a dica escrita até o jogador arrastar a 1ª vez
  function drawVilaHint(g, t) {
    if (!(vila.on && vila.k >= 1)) return;
    const hw = W / 2 / vila.z, more = [vila.x - hw > Wd.X.vilaX0 - 200, vila.x + hw < Wd.X.vilaX1 + 60];
    if (cam.mx < 0) more.reverse();
    g.save(); g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    const y = H * 0.56, b = Math.sin(t * 4) * 4;
    for (let s = 0; s < 2; s++) if (more[s]) {
      const d = s ? 1 : -1, x = s ? W - 30 + b : 30 - b;
      g.globalAlpha = 0.9; Draw.circle(g, x, y, 19, PAL.cream, { ol: 2.5 });
      g.fillStyle = PAL.line; g.beginPath(); g.moveTo(x + d * 8, y); g.lineTo(x - d * 5, y - 9); g.lineTo(x - d * 5, y + 9); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    if (vila.hintT > 0 && !vila.panned) { g.globalAlpha = Math.min(1, vila.hintT / 0.6); Draw.text(g, 'arraste pra passear · toque pra voltar', W / 2, H * 0.82, { size: 18, col: PAL.cream, sw: 5 }); g.globalAlpha = 1; }   // 1 vez por sessão, 3 s e some   // na faixa de terra, embaixo da rua: não tapa casa nem placa
    g.restore();
  }
  function drawFlight(g, t) {
    drawVilaHint(g, t);
    const f = vila.fly || 0; if (f <= 0.02) return;
    const dir = -(vila.dir || 1) * (cam.mx < 0 ? -1 : 1);                 // as coisas passam no sentido contrário ao do voo
    g.save(); g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    if (!flyCv) {                                                         // nuvem em pixel (mesmo traço das nuvens do fundo): desenhada 1 vez, ampliada sem suavizar
      flyCv = document.createElement('canvas'); flyCv.width = 64; flyCv.height = 26; const c = flyCv.getContext('2d');
      const blob = (col, dy) => { c.fillStyle = col; c.beginPath(); c.ellipse(17, 15 + dy, 12, 8, 0, 0, 6.3); c.ellipse(32, 10 + dy, 15, 10, 0, 0, 6.3); c.ellipse(47, 15 + dy, 12, 7, 0, 0, 6.3); c.rect(6, 15 + dy, 52, 6); c.fill(); };
      blob('#DCE8F4', 2); blob('#FFFFFF', 0);
      const d = c.getImageData(0, 0, 64, 26), a = d.data; for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 110 ? 255 : 0; c.putImageData(d, 0, 0);   // borda dura
    }
    g.imageSmoothingEnabled = false;
    for (const c of FLY_C) {
      const k = Math.round(2 + c.s * 1.5), cw = 64 * k, span = W + cw * 2, u = ((c.p + t * c.v * 1.5 * dir) % 1 + 1) % 1;
      g.globalAlpha = Math.min(1, f * 1.3) * 0.86;
      g.drawImage(flyCv, Math.round(u * span - cw), Math.round(c.y * H), cw, 26 * k);
    }
    for (const q of FLY_S) {                                              // riscos de vento
      const span = W + q.l * 2, u = ((q.p + t * q.s * 2.6 * dir) % 1 + 1) % 1, x = u * span - q.l, y = (0.06 + q.y * 0.86) * H;
      g.globalAlpha = f * f * (0.3 + 0.35 * q.y); g.fillStyle = '#FFFFFF';
      g.fillRect(Math.round(x), Math.round(y), Math.round(q.l * (0.5 + 0.5 * f)), q.s > 1.1 ? 3 : 2);
    }
    g.restore();
  }
  function drawSack(k, t) {
    if (!cam.visible(k.x, k.y, 80)) return;
    const ga = D.SACK.gacha[k.g], s = G.Props.sack(S.own.s8 && ga.kind === 'plain' ? 'golden' : ga.kind);
    const sc = (S.own.s1 ? 1.3 : 1) * Math.max(1, 0.9 / cam.z) * (1 + (k.state ? 0.15 * Math.sin(t * 40) : 0.05 * Math.sin(t * 5 + k.x)));
    const ox = k.state ? Math.sin(t * 60) * 2.5 * (ga.m >= 3 ? 2 : 1) : 0, fade = k.state ? 1 : U.clamp((D.SACK.life - k.t) / 1.5, 0, 1);
    g.globalAlpha = fade; g.imageSmoothingEnabled = false;
    if (ga.m >= 10 && k.state) { g.globalAlpha = 0.5; Draw.circle(g, k.x, k.y - 12 * sc, 26 * sc, PAL.goldL, { ol: 0 }); g.globalAlpha = 1; }
    g.drawImage(s.cv, k.x + ox - s.ax * sc, k.y - s.ay * sc, s.cv.width * sc, s.cv.height * sc);
    g.globalAlpha = 1;
  }
  function drawOnigiri(t) {
    const o = S.oni, on = G.Props.onigiri();
    for (let i = 0; i < o.n; i++) {
      const x = o.x - i * 46, y = o.y + Math.sin(t * 3 + i) * 18, fl = Math.sin(t * 16) * 6;
      g.fillStyle = PAL.white; g.strokeStyle = PAL.line; g.lineWidth = 2;
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * 20, y - 6 - fl * 0.5, 12, 6 + fl * 0.3, s * 0.5, 0, 7); g.fill(); g.stroke(); }
      g.imageSmoothingEnabled = false; g.drawImage(on.cv, x - on.cv.width * 1.5, y - on.cv.height * 1.5, on.cv.width * 3, on.cv.height * 3);
    }
  }

  /* =====================================================================
     8. Laço, entrada, áudio, ganchos de teste
     ===================================================================== */
  function musicTheme() {
    if (FAST || !Music || !audioOn) return;
    try {
      if (!S.opts.music || S.opts.mute) { if (Music.stop) Music.stop(0.5); return; }
      const im = G.Islands && G.Islands.islandRun() ? G.Islands.scene().music : null;   // cada ilha tem o seu tema até as máquinas grandes
      Music.start(im && S.tool < 10 ? im : S.tool < 5 ? 'campo' : S.tool < 10 ? 'trabalho' : S.tool < 13 ? 'maquinas' : 'bagger', { fade: 1.5 });
    } catch (e) { /* sem música */ }
  }
  function initAudio() {
    if (audioOn || !AudioE) return;
    try { AudioE.init(); if (AudioE.unlock) AudioE.unlock(); audioOn = true; AudioE.muted = !!S.opts.mute; } catch (e) { return; }
    if (Loops && cur.loop && !S.opts.mute) { try { loopH = Loops.start(cur.loop, { vol: 0.3, rate: 0.1 }); } catch (e) { /* */ } }
    musicTheme();
  }
  // Ajustes › Economia de bateria: 30 quadros/s (padrão no celular) ou 60; a lógica anda por dt, então nada muda no jogo
  function fpsApply() { if (loop) loop.fpsCap = (S.opts.fps || (MOBILE ? 30 : 60)) === 30 ? 30 : 0; }
  function setOpt(k, v) {
    S.opts[k] = v;
    if (k === 'fps') fpsApply();
    if (k === 'mute') { if (AudioE) { try { AudioE.muted = !!v; } catch (e) { /* */ } } if (UI) UI.sound = !v; if (v && loopH) { try { loopH.stop(0.2); } catch (e) { /* */ } loopH = null; } }
    if (k === 'music' || k === 'mute') musicTheme();
    saveNow();
  }
  function horn() { S.hornT = 1.2; sfx('hornBig'); if (!FAST) { quake(0.5); fx.shock && fx.shock(W / 2, H / 2); ui(() => UI.banner('FOOOOOM!', 'a buzina da Bagger assusta os corvos', { icon: 'horn', dur: 1.2 })); } }

  function readPointer() {
    if (cs) {
      const K0 = input.keys || {};
      if (K0.Escape && !cs.esc) { cs.esc = 1; csNext(true); return; }
      if (input.pressed || ((K0.Space || K0.Enter) && cs.t > 0.4 && !cs.kd)) { initAudio(); if (cs.t > 0.3) csNext(); }
      if (cs) cs.kd = !!(K0.Space || K0.Enter);
      ptr.down = false; return;
    }
    if (G.Home && G.Home.isOpen()) { ptr.down = false; return; }
    if (input.pressed) {
      initAudio(); tapEat = false;
      // olhando a vila: ARRASTAR passeia pela rua (dá pra ir até a rua do comércio); toque simples volta pra montanha
      if (vila.on && vila.k >= 1) { vila.dragX = input.x; vila.drag0 = vila.x; vila.moved = false; vila.grab = true; tapEat = true; }
      else if (vila.on && vila.k > 0.3) { vilaGo(false); tapEat = true; }
      // toque em saco ou onigiri não vira cavada
      if (!tapEat && G.Events && G.Events.hit && G.Events.hit(input.x, input.y)) tapEat = true;   // evento dourado (arte no canvas)
      for (const k of S.sacks) { cam.toScreen(k.x, k.y - 12, sp); if (!k.state && U.dist(sp.x, sp.y, input.x, input.y) < 44) { tapSack(k); tapEat = true; break; } }
      if (!tapEat && S.oni.on) for (let i = 0; i < S.oni.n; i++) if (U.dist(S.oni.x - i * 46, S.oni.y, input.x, input.y) < 52) { tapOnigiri(); tapEat = true; break; }
      hook.use = false;
    }
    if (vila.grab) {
      const hw = W / 2 / vila.z, lo = Wd.X.vilaX0 - 260 + hw, hi = Math.max(lo, Wd.X.vilaX1 + 120 - hw);
      if (input.down) {
        const dx = (input.x - vila.dragX) * (cam.mx < 0 ? -1 : 1);
        if (Math.abs(dx) > 10) vila.moved = true;
        if (vila.moved) { vila.x = U.clamp(vila.drag0 - dx / vila.z, lo, hi); vila.auto = 0; vila.panned = true; }
      } else { vila.grab = false; if (!vila.moved && vila.on) { cam.toWorld(input.x, input.y, sp); if (!(G.City && G.City.tapVila && G.City.tapVila(sp.x, sp.y))) vilaGo(false); } }   // tocar na rua da Cidade entra nela
    }
    if (vila.on && vila.k >= 1 && !vila.grab) {   // teclado também passeia
      const K1 = input.keys || {}, d = ((K1.KeyD || K1.ArrowRight) ? 1 : 0) - ((K1.KeyA || K1.ArrowLeft) ? 1 : 0);
      if (d) { const hw = W / 2 / vila.z, lo = Wd.X.vilaX0 - 260 + hw; vila.x = U.clamp(vila.x + d * (cam.mx < 0 ? -1 : 1) * 14, lo, Math.max(lo, Wd.X.vilaX1 + 120 - hw)); vila.auto = 0; vila.panned = true; }
    }
    padRead();
    if (hook.use) { ptr.down = hook.on; ptr.wx = hook.wx; ptr.wy = hook.wy; ptr.has = true; return; }
    ptr.down = input.down && !tapEat;
    if (input.down || input.inside) { cam.toWorld(input.x, input.y, sp); ptr.wx = sp.x; ptr.wy = sp.y; if (input.down) ptr.has = true; }
    // teclado: A/D (ou setas) anda, W/S/Espaço cava onde a ferramenta está; tem prioridade sobre o mouse enquanto apertado
    const K = input.keys || {}, kL = K.KeyA || K.ArrowLeft || VK.l, kR = K.KeyD || K.ArrowRight || VK.r, kd = K.KeyS || K.ArrowDown || K.Space || VK.dig || (S.opts.cavar === 'auto' && !kL && !kR && !input.down && !tapEat);   // Ajustes › Cavar sozinho: 'segurado' virtual quando o jogador está parado
    const kl = cam.mx < 0 ? kR : kL, kr = cam.mx < 0 ? kL : kR;   // ilha espelhada: direita na tela = -x no mundo
    // W / seta pra cima: o Kome pula (a pé, com ferramenta de mão); nas máquinas não faz nada
    if (input.keyPressed && (input.keyPressed('KeyW') || input.keyPressed('ArrowUp')) && P.ground && !locked() && (cur.kind === 'hand' || cur.kind === 'push' || cur.kind === 'jack')) {
      P.vy = -470; P.y -= 3; P.ground = false; sfx('whoosh', { vol: 0.35 });
      if (!FAST) parts.puff(P.x, P.y + 3, 3, 5, { c: PAL.sand });
    }
    if (pinch.on) { ptr.down = false; }
    if (kl !== kr) {
      // máquina de alcance (Bagger): o alvo anda a partir da RODA, não do corpo (senão o alvo caía atrás da roda e ela ia de ré)
      keyAim = null;
      // máquina rápida: o alvo vai mais longe (senão ela freava antes de pegar velocidade: ver travel())
      const bb = cur.kind === 'bagger' && T.bite ? T.bite(S.m) : null, base = bb && bb.x ? bb.x : P.x;
      const lead = (bb ? 260 : 140) + (cur.vmax ? cur.vmax * TAU(cur) * 0.7 + (cur.park || 0) * 0.55 : 0);
      ptr.wx = base + (kr ? 1 : -1) * lead; ptr.wy = heap.surf(ptr.wx) - (bb ? -6 : 4); ptr.down = true; ptr.has = true;
    }
    else if (kd) { keyAim = digAim(keyAim); ptr.wx = keyAim; ptr.wy = heap.surf(keyAim) - 4; ptr.down = true; ptr.has = true; }
    else keyAim = null;
    if (input.keyPressed && input.keyPressed('Space') && S.own.b0 && cur.kind === 'bagger') horn();
  }
  let keyAim = null;
  /* CAVAR (celular) / S / Espaço: onde cavar sem ponteiro. BUG v7 (dono: "aperto CAVAR e as máquinas vão de RÉ"): a mira era
     T.bite(S.m).x no instante do aperto e ficava presa enquanto segurava; a caçamba balança durante o ciclo (escavadeira −175..+239 px
     do corpo, pá de cabo −173..+504, trator +17..+114, britadeira +2..+5) e, apertando com a caçamba recolhida/despejando, a mira
     caía ATRÁS da máquina: parkClimb/parkAt (alvo = mira − park·0,55) davam ré e ficavam lá. Agora a mira nunca vem da caçamba:
     - a pé: na frente do Kome (alcance da ferramenta), presa: ele cava onde está;
     - máquinas de cabine: o barranco à frente (faceAhead), e só ANDA PRA FRENTE enquanto segura (abre o barranco → avança junto);
     - caminhão: sempre do lado da montanha;
     - Bagger: começa na roda e avança enquanto a roda morde pouco (abaixo da faixa boa), sem passar da roda + 60. */
  function digAim(a) {
    const k = cur.kind, dtA = U.clamp(S.time - (digAim.t || 0), 0, 0.1); digAim.t = S.time;
    if (k === 'hand' || k === 'push' || k === 'jack') return a === null ? P.x + P.face * (k === 'jack' ? 8 : cur.reach * (st.reach || 1)) : a;
    if (k === 'haul') return Math.max(a === null ? 0 : a, P.x + 200);
    if (k === 'bagger') {
      const b = T.bite ? T.bite(S.m) : null, bx = b && b.x === b.x ? b.x : P.x + 600;
      if (a === null) return bx;
      const band = S.m && S.m.band ? S.m.band[0] : 0.4, mk = (S.m && S.m.k) || 1;
      return (S.bite01 || 0) < band + 0.05 ? Math.min(a + 160 * mk * dtA, bx + 60 * mk) : a;
    }
    // máquinas de cabine (sempre de frente pra montanha, P.face = 1): barranco à frente; se onde mira já está quase raso
    // (menos de 60% do raio da cratera acima do chão da máquina), a mira avança devagar: ela vai entrando no barranco
    const front = faceAhead(P.x, 16, 1400) + 10, park = cur.park || 60;
    a = Math.max(a === null ? P.x + park * 0.55 + 24 : a, front);
    if (heap.height(a) - heap.height(P.x) < cur.r * 0.6) a = Math.min(a + Math.max(40, VMAX(cur) * 0.12) * dtA, Math.max(front, P.x + park + 160));
    return a;
  }
  /* ---- celular: joystick transparente, botão de cavar, tela cheia, zoom com pinça (e rodinha do mouse no PC) ---- */
  const VK = { l: false, r: false, dig: false }, pinch = { on: false, d0: 0, z0: 1 };
  function goFull() {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* */ } }).catch(() => {});
  }
  function setZoomMul(v) { S.zoomMul = U.clamp(v, 0.55, 1.9); }
  function mobileInit() {
    const cv = stage.cv;
    // pinça com dois dedos
    const tdist = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    cv.addEventListener('touchstart', e => { if (e.touches.length === 2) { pinch.on = true; pinch.d0 = tdist(e); pinch.z0 = S.zoomMul || 1; } }, { passive: true });
    cv.addEventListener('touchmove', e => { if (pinch.on && e.touches.length === 2) setZoomMul(pinch.z0 * tdist(e) / Math.max(1, pinch.d0)); }, { passive: true });
    cv.addEventListener('touchend', e => { if (e.touches.length < 2) pinch.on = false; }, { passive: true });
    cv.addEventListener('wheel', e => { e.preventDefault(); setZoomMul((S.zoomMul || 1) * (e.deltaY > 0 ? 0.92 : 1.08)); }, { passive: false });
    if (!MOBILE) return;
    document.body.classList.add('k-mob');
    document.addEventListener('pointerdown', function once() { goFull(); document.removeEventListener('pointerdown', once); }, { once: true });
    // HUD maior no celular: a camada do HUD ganha zoom pra ficar ~1 px lógico = 1 px de tela
    // em pé: o jogo vira uma faixa no meio da tela, então o HUD sai do palco e usa a tela inteira (faixas de cima e de baixo)
    const R0 = UI.root, home = R0 && R0.parentNode, homeNext = R0 && R0.nextSibling;
    let hudFix = null, portFix = false;
    if (R0) { const ol = R0.layout; R0.layout = () => { ol(); if (portFix) R0.classList.add('k-portrait', 'k-narrow'); }; }
    // o stage chama o layout original direto no resize (tira o retrato): recoloca logo depois
    if (stage.on) stage.on('resize', () => { if (portFix && UI.root) UI.root.classList.add('k-portrait', 'k-narrow'); });
    const fitHud = () => {
      const R = UI.root; if (!R) return;
      portFix = innerHeight > innerWidth * 1.1;
      // no celular o HUD mora numa camada fixa do tamanho da tela (nunca é cortado junto com o palco)
      if (!hudFix) { hudFix = document.createElement('div'); hudFix.className = 'k-hudfix'; document.body.appendChild(hudFix); }
      if (R.parentNode !== hudFix) hudFix.appendChild(R);
      R.style.zoom = ''; R.style.width = R.style.height = '100%';
      document.body.classList.toggle('k-tight', !portFix && innerWidth < 760);   // deitado e estreito: barra de compras compacta
      document.body.classList.toggle('k-pfix', portFix);
      R.layout && R.layout();
    };
    fitHud();
    // joystick (esquerda) e botão CAVAR (direita)
    const box = document.createElement('div'); box.className = 'k-vpad'; document.body.appendChild(box);
    box.innerHTML = '<div class="k-joy" role="button" aria-label="Andar (arraste pros lados)"><div class="k-joy-k"></div></div><div class="k-dig" role="button" aria-label="Cavar">CAVAR</div><div class="k-fullscr" role="button" title="Tela cheia" aria-label="Tela cheia"></div><div class="k-zb k-zout" role="button" aria-label="Afastar">−</div><div class="k-zb k-zin" role="button" aria-label="Aproximar">+</div>';
    const joy = box.querySelector('.k-joy'), knob = box.querySelector('.k-joy-k'), dig = box.querySelector('.k-dig'), full = box.querySelector('.k-fullscr');
    const zbs = [...box.querySelectorAll('.k-zb')];
    zbs.forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); setZoomMul((S.zoomMul || 1) * (b.classList.contains('k-zin') ? 1.15 : 1 / 1.15)); }));
    const syncZb = () => zbs.forEach(b => { b.style.top = full.style.top; b.style.visibility = full.style.visibility; });
    // posiciona joystick, CAVAR, tela cheia e a plaquinha medindo o HUD de verdade (cada celular tem um tamanho)
    const kids = sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent || getComputedStyle(e).position === 'fixed')
      .map(e => e.getBoundingClientRect()).filter(r => r.width > 2 && r.height > 2);
    const px = v => Math.round(v) + 'px';
    const place = (el, s, side, bottom) => { el.style.width = el.style.height = px(s); el.style.bottom = px(bottom); el.style[side] = ''; };
    function layoutPad() {
      const vh = innerHeight, vw = innerWidth;
      if (portFix && UI.root) UI.root.classList.add('k-portrait', 'k-narrow');
      const dock = kids('.k-zone-dock > :not(.k-spacer)'), top = kids('.k-zone-tl > *, .k-zone-tc > *, .k-zone-tr > *');
      const topB = top.reduce((m, r) => Math.max(m, r.bottom), 0);
      if (portFix) {
        document.body.classList.remove('k-zbl');
        // em pé: controles colados embaixo, barra de compras logo acima deles
        const s = U.clamp(Math.min(vw * 0.3, vh * 0.15), 92, 128), b = 18;
        place(joy, s, 'left', b); place(dig, s * 0.92, 'right', b + s * 0.04);
        // barra da montanha (centro) desce pra baixo dos blocos da esquerda/direita, que não cabem lado a lado
        const sideB = kids('.k-zone-tl > *, .k-zone-tr > *').reduce((m, r) => Math.max(m, r.bottom), 0);
        const tcH = kids('.k-zone-tc > *').reduce((m, r) => m + r.height + 8, 0);
        if (UI.root) { UI.root.style.setProperty('--k-pad-dock', px(b + s + 14)); UI.root.style.setProperty('--k-tc-top', px(sideB + 10)); }
        full.style.top = px(sideB + 10 + tcH + 6);
        const tipH = (document.querySelector('.k-tipcontrols') || {}).offsetHeight || 130;
        const dockT = kids('.k-zone-dock > :not(.k-spacer)').reduce((m, r) => Math.min(m, r.top), vh);
        const want = sideB + 10 + tcH + 50, fit = dockT - tipH - 10;
        document.body.style.setProperty('--k-tip-top', px(Math.min(want, fit)));
        { const tip = document.querySelector('.k-tipcontrols'); if (tip) tip.style.visibility = fit < want - 40 ? 'hidden' : ''; }   // não cabe entre os chips e a barra: a dica some (era só dica)
        // tela baixinha: enquanto a plaquinha existe, o botão de tela cheia some pra não ficar embaixo dela
        full.style.visibility = document.querySelector('.k-tipcontrols') && fit < want ? 'hidden' : '';
        return;
      }
      if (UI.root) UI.root.style.removeProperty('--k-pad-dock');
      // deitado: no vão entre o HUD de cima e a barra de compras
      const dockT = dock.reduce((m, r) => Math.min(m, r.top), vh);
      const L = r => r.left < vw * 0.3 && r.right < vw * 0.5, Rr = r => r.right > vw * 0.7 && r.left > vw * 0.5;   // a fileira de chips cruza o meio: é do centro
      const tl = top.filter(L).reduce((m, r) => Math.max(m, r.bottom), 0), tr = top.filter(Rr).reduce((m, r) => Math.max(m, r.bottom), 0);
      // zoom e tela cheia: no canto esquerdo, embaixo do combo (antes ficavam no meio, em cima dos chips); sem espaço, voltam pro centro
      const zl = dockT - tl - 68 >= 64; document.body.classList.toggle('k-zbl', zl);
      const sj = U.clamp(dockT - tl - 16 - (zl ? 52 : 0), 64, 88), sd = U.clamp(dockT - tr - 16, 64, 84);
      place(joy, sj, 'left', vh - dockT + 10);
      place(dig, sd, 'right', vh - dockT + 10);
      const tc = top.filter(r => !L(r) && !Rr(r)).reduce((m, r) => Math.max(m, r.bottom), 0);
      full.style.top = px(zl ? tl + 8 : tc + 6);
      document.body.style.setProperty('--k-tip-top', px(Math.max(topB, tc + (zl ? 0 : 46)) + 8));
    }
    const relayout = () => { fitHud(); layoutPad(); zbs && syncZb(); };
    // painel aberto (menu, árvore, ajustes, oficina…): esconde joystick, CAVAR e zoom pra não ficarem por cima
    setInterval(() => document.body.classList.toggle('k-panelopen', !!document.querySelector('.k-dim.k-show')), 150);
    relayout(); addEventListener('resize', () => setTimeout(relayout, 60)); setInterval(() => { layoutPad(); syncZb(); }, 1000); syncZb();
    let jid = -1;
    const jmove = e => { const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R0 = r.width / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R0) { dx *= R0 / d; dy *= R0 / d; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; VK.l = dx < -R0 * 0.3; VK.r = dx > R0 * 0.3; };
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); initAudio(); jmove(e); e.preventDefault(); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
    const jup = e => { if (e.pointerId !== jid) return; jid = -1; VK.l = VK.r = false; knob.style.transform = ''; };
    joy.addEventListener('pointerup', jup); joy.addEventListener('pointercancel', jup);
    // Ajustes › Jeito de cavar (guia A8): 'segurar' = hoje · 'alternar' = 1 toque liga, outro desliga · 'auto' = cava sozinho parado
    // (readPointer). Ligado aparece no botão: dourado + "CAVANDO". digSync só mexe no DOM quando muda; roda também quando o ajuste troca
    let digHeld = false;
    const digSync = () => { const m = S.opts.cavar || 'segurar';
      if (m !== 'alternar' && !digHeld && VK.dig) VK.dig = false;   // saiu do 'alternar' com ele ligado: desliga
      const lock = (m === 'alternar' && VK.dig) || m === 'auto', txt = lock ? 'CAVANDO' : 'CAVAR';
      dig.classList.toggle('on', digHeld); dig.classList.toggle('k-dig-lock', lock); if (dig.textContent !== txt) dig.textContent = txt; };
    setInterval(digSync, 300);
    dig.addEventListener('pointerdown', e => { const alt = S.opts.cavar === 'alternar'; if (alt) VK.dig = !VK.dig; else { VK.dig = true; digHeld = true; dig.setPointerCapture(e.pointerId); } digSync(); initAudio(); if (S.own.b0 && cur.kind === 'bagger') horn(); e.preventDefault(); });
    const dup = () => { if (S.opts.cavar === 'alternar') return; VK.dig = false; digHeld = false; digSync(); };
    dig.addEventListener('pointerup', dup); dig.addEventListener('pointercancel', dup);
    full.addEventListener('pointerdown', e => { e.preventDefault(); if (document.fullscreenElement) document.exitFullscreen(); else goFull(); });
  }
  // plaquinha de controles nos primeiros 30 s de jogo (ideia do Ronaldinho); some sozinha e não volta
  let tipEl = null, tipT = 0;
  function tipTick(dt) {
    if (S.time > 31 || (S.stats && S.stats.tipDone)) { if (tipEl) { tipEl.style.opacity = '0'; setTimeout(() => { if (tipEl) { tipEl.remove(); tipEl = null; } }, 600); S.stats.tipDone = 1; } return; }
    if (!tipEl) {
      const touch = matchMedia && matchMedia('(pointer: coarse)').matches;
      tipEl = document.createElement('div'); tipEl.className = 'k-tipcontrols';
      tipEl.innerHTML = touch
        ? '<b>Como jogar</b><span>Segure o dedo onde quer cavar</span><span>Compre ferramentas e upgrades embaixo</span>'
        : '<b>Como jogar</b><span><kbd>Mouse</kbd> segure onde quer cavar</span><span><kbd>A</kbd><kbd>D</kbd> anda · <kbd>W</kbd> pula · <kbd>S</kbd><kbd>Espaço</kbd> cava</span><span>Controle de videogame: aperte um botão pra entrar o Jogador 2</span>';
      document.body.appendChild(tipEl);
      requestAnimationFrame(() => { if (tipEl) tipEl.style.opacity = '1'; });
    }
    tipT += dt; if (tipEl) tipEl.style.transform = 'translateX(-50%) translateY(' + (Math.sin(tipT * 2) * 2).toFixed(1) + 'px)';
  }
  function frame(dt) {
    const t0 = performance.now();
    if (!FAST && !S.stats.cs_intro && !cs && S.time < 3 && !/nointro/.test(location.search)) { S.stats.cs_intro = 1; csPlay('intro'); }
    if (!FAST) tipTick(dt);
    if (!FAST && UI.root && UI.root.__cs !== !!cs) { UI.root.__cs = !!cs; UI.root.style.visibility = cs ? 'hidden' : ''; if (tipEl) tipEl.style.visibility = cs ? 'hidden' : ''; }
    readPointer();
    fx.update(dt);
    const sdt = dt * (fx.timeScale === undefined ? 1 : fx.timeScale) * (G.devSpeed || 1);   // ?dev: acelerar o tempo
    if (sdt > 0) update(sdt);
    HUD.update(dt);
    saveT += dt; if (saveT >= 10) { saveT = 0; saveNow(); }
    S.perf.upd += (performance.now() - t0 - S.perf.upd) * 0.05;
  }
  // telas cheias e opacas (Cidade, Fábrica, Oficina) cobrem o canvas: não desenha a montanha escondida atrás (o jogo continua rodando)
  const covered = () => !!((G.City && G.City.isOpen && G.City.isOpen()) || (G.Fab && G.Fab.isOpen && G.Fab.isOpen()) || (G.Ofi && G.Ofi.isOpen && G.Ofi.isOpen()));
  function draw() { if (!FAST && covered()) return; const t0 = performance.now(); adaptRes(t0); render(); S.perf.ren += (performance.now() - t0 - S.perf.ren) * 0.05; }
  /* RESOLUÇÃO ADAPTATIVA: se o quadro fica lento por ~3 s seguidos (média > 24 ms, ou seja < ~42 quadros/s), a resolução interna do
     canvas desce um degrau (2 → 5/3 → 4/3 pixels por unidade). Degraus em que 3×dpr é inteiro: o fundo em pixel art fica igual.
     Só desce (sobe de novo ao recarregar); não conta com tela coberta, aba escondida, cutscene ou logo depois de mudar. */
  const RES = { last: 0, avg: 16, slow: 0, hold: 3, steps: [2, 5 / 3, 4 / 3] };
  function adaptRes(now) {
    const R = RES, dt = R.last ? now - R.last : 16; R.last = now;
    if (R.off || !stage || !stage.setMaxDpr || document.hidden || cs || dt > 1500) { R.slow = 0; return; }   // pausa longa (aba, alerta) não conta
    if ((R.hold -= dt / 1000) > 0) { R.avg = 16; return; }
    R.avg += (dt - R.avg) * 0.05;
    R.slow = R.avg > 24 ? R.slow + dt / 1000 : 0;
    if (R.slow < 3) return;
    const nx = R.steps.find(v => v < stage.dpr - 0.01);
    R.slow = 0; R.hold = 3;
    if (nx) { stage.setMaxDpr(nx); console.info('[kome] resolução adaptativa: ' + nx.toFixed(2)); }
  }

  // recarga depois de viagem/modo: mantém ?nointro (testes) e ?dev (o admin tem save próprio; sem ele a viagem caía no save de verdade)
  const reQ = () => { const q = location.search, o = []; if (/nointro/.test(q)) o.push('nointro'); if (/[?&]dev\b/.test(q)) o.push('dev'); return o.length ? '?' + o.join('&') : ''; };
  function boot() {
    // celular: começa em 5/3 pixels por unidade (canvas ~30% menor que em 2: no Pixel 5 deitado 2133x900 em vez de 2560x1080;
    // a tela tem ~2,0 pixels reais por unidade, a diferença quase não aparece). ?dpr=2 (ou __kome.res(2)) volta pro máximo.
    const dprQ = +(location.search.match(/[?&]dpr=([\d.]+)/) || [])[1];
    stage = E.Stage({ width: W, height: H, bg: PAL.sky, maxDpr: dprQ || (MOB0 ? 5 / 3 : 2), fit: MOB0 ? (aw, ah) => (aw / ah >= 1.6 ? 'cover' : 'contain') : 'contain' });
    if (Wd.setSize) Wd.setSize(W, H);   // cenário desenha na mesma largura lógica do jogo
    setTimeout(() => { try { mobileInit(); } catch (e) { console.warn('[kome] celular', e); } }, 0);
    g = stage.g; input = E.Input(stage);
    cam = E.Camera(W, H); parts = E.Particles(1600); floaters = E.Floaters(120); fx = E.ScreenFX(stage);
    G.cam = cam;
    save = E.Save(window.KOME_DEV || /[?&]dev\b/.test(location.search) ? 'kome-admin-v4' : 'kome-no-japao-v4', { version: SAVE_V, migrate, defaults: () => ({}) });   // admin tem save separado (não estraga o progresso de verdade)
    // sistemas por tempo (fase 0 do PLANO-100H): cada camada nova registra aqui o seu tick/offline
    G.Sim = E.Sim ? E.Sim() : null;
    if (G.Sim && G.Items) G.Sim.add('itens', G.Items.sim);
    if (!/fresh/.test(location.search)) { try { const pre = save.load(); S.mount = (pre && pre.mount | 0) || 1; S.island = (pre && pre.island) | 0; S.shape = (pre && pre.shape) || ''; } catch (e) { /* */ } }
    buildWorld();
    computeStats();
    let had = false;
    if (/fresh/.test(location.search)) save.clear(); else had = loadState();   // ?fresh = começa do zero (testes)
    // tempo fora: sistemas com offline(dt) andam até 8 h (nenhum ainda; a fábrica da fase 1 é o primeiro). Resultado em S.away
    if (had && G.Sim) { const sec = Math.min((Math.max(8, G.Amuletos ? G.Amuletos.val('offCap') : 0) + (G.City && G.City.offH ? G.City.offH() : 0)) * 3600, save.offlineAtLoad || 0); S.away = { sec, res: G.Sim.catchUp(sec) }; }   // amuleto Preguiça Boa: teto 24 h
    S.heapArea = heap.area; S.footX = scanFoot();
    cur = TOOLS[S.tool];
    setTool(S.tool);
    if (!had) { P.x = WL.START_X; P.y = heap.surf(P.x); }
    S.camX = P.x + 30; camTick(0.016); cam.snapTo(cam.tx, cam.ty, cur.zoom);
    if (heap.prewarm) { try { heap.prewarm(g); } catch (e) { /* */ } }
    HUD.init({ newMountain: pickMountain, ended: () => S.ended, wear, closet: () => S.closet, look: () => S.look, stage, buyTool, buyNode, buyHouse, horn, nodeState, nodeCost, toolCost, houseCost, stats: () => st, setOpt, openHome: tab => G.Home && G.Home.open(tab), playAs, twinReady: () => !!(G.Ind && (G.Ind.run().giant | 0) >= 4), twinPlaying: () => !!S.twinPlay, playing: () => cur,
      exportStr: () => { saveNow(); return save.exportStr(); },
      importStr: s => { if (!save.importStr(s)) return false; save.save(); location.reload(); return true; },
      reset: () => { save.clear(); saveNow = () => {}; location.reload(); } });
    if (UI) UI.sound = !S.opts.mute;
    // chip "Vila" <-> "Montanha" no topo (junto do chip das ilhas e da Fábrica)
    if (HUD.chip) {
      const vc = HUD.chip({ id: 'vila', icon: 'house', label: 'Vila', order: 10, tone: '#FFE3EE', show: false, onClick: () => vilaGo(!vila.on) });
      const tick = () => { if (vc) vc.set({ label: vila.on ? 'Montanha' : 'Vila', icon: vila.on ? 'mount' : 'house', show: !!(S.stats.tipDone || S.time > 31) }); };
      setInterval(tick, 300); tick();
      // chip "Só falta a casa" (montanha acabada antes da casa): fica até a casa ficar pronta; toca = compra a etapa (ou diz quanto falta)
      const hc = HUD.chip({ id: 'socasa', icon: 'house', label: 'Só falta a casa', order: 2, tone: '#FFE9A8', show: false, onClick: () => { const i = soCasaInfo(); if (i && !i.can && G.Home && G.Home.open('casa')) return; buyHouse(); } });
      let flyEl = null;
      const htick = () => {
        const on = !!(S.soCasa && !S.ended && S.house < D.HOUSE.length), i = on ? soCasaInfo() : null;
        if (hc) hc.set(on ? { show: true, prio: 10, hint: 'etapa ' + i.n + ' de ' + i.of + (i.lock ? ' · precisa: ' + i.lock : i.can ? ' · construir!' : ' · ¥ ' + U.fmt(i.c)),
          tip: 'A montanha acabou! Termine a casa pra zerar o jogo. ' + i.line, act: i.can ? 'Construir' : 'Ver a casa' } : { show: false, prio: 0 });
        if (!flyEl || !flyEl.isConnected) flyEl = document.querySelector('.k-flyer');
        if (flyEl) flyEl.classList.toggle('k-pulse', on);   // a "setinha": o cartão da Casa pulsa enquanto ela é o que falta
      };
      setInterval(htick, 500); htick();
      // chip "Ver o Pátio": aparece depois do final, com alguma turma no Pátio da Frota (ele mora depois da estátua do Kome-Oh)
      const pc = HUD.chip({ id: 'verpatio', icon: 'paw', label: 'Ver o Pátio', order: 16, tone: '#E8F4D8', show: false, onClick: () => patioTour() });
      const ptick = () => { if (pc) pc.set({ show: !ptour && patioHas() }); };
      setInterval(ptick, 700); ptick();
    }
    if (G.Ind) G.Ind.init({ sfx, save: () => saveNow(), recompute: () => computeStats(),
      visit: (x, z, y, dur) => { visit = { x, t: 0, dur: dur || 3.5, z, y, far: true }; } });   // câmera vai mostrar a Bagger Gêmea na vaga dela
    if (G.Topo) G.Topo.init({ sfx });
    if (G.Events) G.Events.init({ sfx, fast: () => FAST, ips: () => Math.max(1, S.ips || 0), pay: v => credit(v, 2, false),
      banner: (e, txt) => { sfx('fanfare'); ui(() => UI.banner(e.n.toUpperCase() + '!', txt, { icon: e.icon || 'star', tone: 'gold', dur: 3 })); } });
    if (G.Faixas) G.Faixas.init({ fast: () => FAST, save: () => saveNow(), busy: () => !!cs || S.dayEnd > 0 || !!S.endOpen || PORTRAIT() || (G.Home && G.Home.isOpen()) || (G.IslandsUI && G.IslandsUI.isOpen()) });
    if (G.Evolucoes) G.Evolucoes.init({ sfx, fast: () => FAST, save: () => saveNow(), recompute: () => computeStats(), busy: () => !!cs || S.dayEnd > 0 || !!S.endOpen || PORTRAIT() || (G.Home && G.Home.isOpen()) || (G.IslandsUI && G.IslandsUI.isOpen()) });
    if (G.Amuletos) G.Amuletos.init({ sfx, fast: () => FAST, save: () => saveNow(), recompute: () => computeStats(), playing: () => cur, heap: () => heap, ui,
      busy: () => !!cs || S.dayEnd > 0 || !!S.endOpen || PORTRAIT() || (G.Home && G.Home.isOpen()) || (G.IslandsUI && G.IslandsUI.isOpen()) || (G.CookieUI && G.CookieUI.isOpen && G.CookieUI.isOpen()) || S.cele.t >= 0 && S.cele.t < S.cele.dur });
    if (G.Patio) G.Patio.init({ sfx, fast: () => FAST, credit: v => credit(v, 1, false), recompute: () => computeStats(),
      ach: a => { sfx('chirin'); ui(() => UI.achievement(a.n, { sub: a.d + ' · +1% no Arroz do Coração', icon: a.icon, kicker: 'Conquista' })); },
      banner: () => { sfx('fanfare'); ui(() => UI.banner('PÁTIO DA FROTA ABRIU!', 'compre várias de cada máquina: toque em Pátio, no topo', { icon: 'star', tone: 'gold', dur: 4.5 })); },
      away: (sec, v) => ui(() => UI.banner('Enquanto você estava fora', 'a frota cavou ¥' + U.fmt(v) + ' em ' + U.fmtTime(sec), { icon: 'yen', tone: 'gold', dur: 6 })) });
    if (G.Tatu) G.Tatu.init({ heap: () => heap, parts: () => parts, pay: (v, x, y) => pay(v, x, y, 1),
      bought: x => { sfx('fanfare'); ui(() => UI.banner('TATUZÃO!', 'ele vai furar a montanha e cada anel paga', { icon: 'star', tone: 'gold', dur: 3.5 })); visit = { x: x - 300, t: 0, dur: 3.5 }; } });
    if (G.Fab) G.Fab.init({ save: () => saveNow(),
      banner: () => { sfx('fanfare'); ui(() => UI.banner('O galpão KOME PACK abriu!', 'toque em Fábrica, no topo da tela', { icon: 'star', tone: 'gold', dur: 4 })); },
      toast: (t, sub) => ui(() => UI.toast(t, { icon: 'yen', tone: 'gold', sub })) });
    if (G.City) G.City.init({ save: () => saveNow(), fast: () => FAST, recompute: () => computeStats(),
      banner: () => { sfx('fanfare'); ui(() => UI.banner('A CIDADE ABRIU!', 'os vizinhos pagam ¥ por entrega: toque em Cidade, no topo', { icon: 'house', tone: 'gold', dur: 4.5 })); },
      toast: (t, sub) => ui(() => UI.toast(t, { icon: 'house', tone: 'gold', sub })) });
    if (G.Islands) G.Islands.init({ sfx, save: () => saveNow(), recompute: () => computeStats(), fast: () => FAST, gift: giftSacks,
      busy: () => !!cs || S.dayEnd > 0 || !!S.endOpen || (G.Home && G.Home.isOpen()),
      onEvent: e => { if (!FAST && e.erupt) quake(0.5); if (!FAST && e.frost) sfx('whoosh'); },
      // viagem: reescreve o save e recarrega; testes (?nointro) continuam sem cutscene na chegada
      travel: (next, gain) => { saveNow(); const d = save.data || save.load(); G.Islands.makeSave(d, next, gain); save.save(); saveNow = () => {}; location.href = location.pathname + reQ(); } });
    // modos de partida (modos.js): reescreve o save (retrato/volta) e recarrega, igual à viagem
    if (G.Modos) G.Modos.init({ sfx, fast: () => FAST, save: () => saveNow(), busy: () => !!cs || S.dayEnd > 0 || !!S.endOpen || PORTRAIT() || (G.Home && G.Home.isOpen()) || (G.IslandsUI && G.IslandsUI.isOpen()),
      rewrite: fn => { saveNow(); const d = save.data || save.load(); fn(d); save.save(); saveNow = () => {}; location.href = location.pathname + reQ(); } });
    setMirror();
    if (G.IslandsUI) G.IslandsUI.init({ sfx, save: () => saveNow(), play: (id, then) => csPlay(id, then), pickMountain, busy: () => !!cs || S.dayEnd > 0 || !!S.endOpen || (G.Home && G.Home.isOpen()) });
    // chegou numa ilha nova: cutscene da chegada (com o cenário da ilha) ou só o aviso nos testes
    if (G.Islands) { const ai = G.Islands.arrival(); if (ai) setTimeout(() => { if (!FAST && !/nointro/.test(location.search)) csPlay('chegada', () => welcome(ai)); else welcome(ai); }, 900); }
    // save antigo que já passou do final antes da Volta ao Japão existir: mostra a cutscene uma vez
    if (S.ended && !S.stats.cs_ilhas && !(S.island | 0) && !/nointro/.test(location.search)) setTimeout(() => endgameIntro(), 2500);
    if (G.Inf) G.Inf.init({ sfx, save: () => saveNow(), recompute: () => computeStats(), playing: () => cur, busy: () => !!cs || S.dayEnd > 0 || !!S.endOpen || (G.Home && G.Home.isOpen()) });
    if (G.Goals) G.Goals.init({ sfx, recompute: () => computeStats(), pay: v => credit(v, 2, false), quiet: () => FAST || !!cs || !!S.endOpen, badge: () => G.Home && G.Home.noteNew() });
    if (G.Missoes) G.Missoes.init({ sfx, pay: v => credit(v, 2, false), fastPay: v => { S.money += v; }, fast: () => FAST, quiet: () => FAST || !!cs || !!S.endOpen });   // Jornada (missoes.js)
    if (G.Carta) G.Carta.init({ sfx, had: () => had, fast: () => FAST, save: () => saveNow(), recompute: () => computeStats(), gift: giftSacks,
      busy: () => !!cs || S.dayEnd > 0 || !!S.endOpen || PORTRAIT() || (G.Home && G.Home.isOpen()) || (G.IslandsUI && G.IslandsUI.isOpen()) || (S.cele.t >= 0 && S.cele.t < S.cele.dur) });
    if (G.Escada) G.Escada.init({ sfx, recompute: () => computeStats(), quiet: () => FAST || !!cs || !!S.endOpen, badge: () => G.Home && G.Home.noteNew() });
    G.drawAccAt = drawAccAt;   // Casa e guarda-roupa usam
    // preço estável: degrau do recorde de ¥/s (só muda quando você bate um recorde ~78% maior). Antes usava o ¥/s do momento e o preço mudava a cada abertura
    const priceStep = () => { const b = Math.max(10, S.stats.bestIps || 0); return Math.pow(10, Math.floor(Math.log10(b) * 4) / 4); };
    // preço travado: só sobe quando você COMPRA algo (Oficina, Casa, lojas). Abrir e fechar nunca muda o preço
    G.priceIps = () => { if (!S.stats.pb) S.stats.pb = priceStep(); return S.stats.pb; };
    G.priceBump = () => { S.stats.pb = Math.max(S.stats.pb || 0, priceStep()); };
    if (G.Home) G.Home.init({ W: () => W, H: () => H, dpr: () => stage.dpr, canvasRect: () => stage.cv.getBoundingClientRect(), sfx, save: () => saveNow(), wear, badge: n => HUD.homeBadge && HUD.homeBadge(n),
      busy: () => !!cs || S.dayEnd > 0 || !!S.endOpen || (S.cele.t >= 0 && S.cele.t < S.cele.dur) });
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
    if (save.persistent === false) setTimeout(() => ui(() => UI.toast('Este navegador não está guardando o progresso', { icon: 'x', tone: 'bad', sub: 'use Ajustes › Salvar › Baixar arquivo' })), 2500);
    window.addEventListener('beforeunload', () => saveNow());
    loop = E.Loop({ update: frame, render: draw, input, maxDt: 0.05 });
    fpsApply(); loop.start();
    if (S.ended) S.endT = S.time;
  }

  /* ---- API pública e ganchos de teste ---- */
  G.Game = { playAs, playIndex: () => (S.play >= 0 && S.play < S.tool ? S.play : S.tool), vila: vilaGo, on: (ev, fn) => { nListen++; return em.on(ev, fn); }, buyTool, buyNode, buyHouse, setTool, stats: () => st, nodeState, nodeCost, toolCost, houseCost, pay, aim, tapAll, saveNow, horn,
    reset: () => { save.clear(); saveNow = () => {}; location.reload(); } };   // admin: apaga o save e começa do zero
  window.__kome = {
    S, P, data: D, buyTool, buyNode, buyHouse, tapAll, aim: () => { const a = aim(); return { x: a.x, y: a.y }; },
    setTool(i) { setTool(i); S.cele.t = -1; cam.snapTo(P.x, P.y - 60, cur.zoom); return cur.id; },
    playAs(i, twin) { S.cele.t = -1; const ok = playAs(i, twin); cam.snapTo(P.x, P.y - 60, cur.zoom); return ok && cur.id; },
    paused: () => !!cs || !!S.endOpen || !!(G.Home && G.Home.isOpen()) || !!(G.IslandsUI && (G.IslandsUI.isOpen() || G.IslandsUI.coaching())) || PORTRAIT(),   // robô: pausa de propósito não é travamento
    addMoney(v) { S.money += v; return S.money; },
    pop(v, crit, kind) { credit(v, kind | 0, !!crit); },   // prints: estoura um "+¥" de pagamento
    vila(on, x, z) { const ok = vilaGo(on !== false, x, z); return ok; }, vilaK: () => vila.k, vilaHold(k) { vila.hold = k === null ? undefined : k; },
    // step(seg, dt=1/30): avança a simulação sem desenhar (determinístico o bastante pro autoplayer)
    step(sec, h) { h = h || 1 / 30; FAST = true; const n = Math.round(sec / h); try { for (let i = 0; i < n; i++) update(h); } finally { FAST = false; } return S.time; },
    play(id) { csPlay(id); },
    dbg() { return { lx: LX.x | 0, near: !!parkAt.near, face: parkAt.face | 0, keyAim, budget: S.budget | 0, wantsLoad: S.m && S.m.wantsLoad, px: P.x | 0, py: P.y | 0, wx: ptr.wx | 0, wy: ptr.wy | 0, h: heap.height(ptr.wx) | 0, hk: heap.height(P.x + P.face * 30) | 0, stun: S.stun || 0, down: ptr.down }; },
    newMountain() { S.ended = true; return newMountain(); },
    // setIsland(n): troca de ilha sem viajar (prints e testes): materiais, formato, cenário e lado da montanha
    setIsland(n) { S.island = n | 0; S.mount = 1; S.shape = ''; buildWorld(); S.heapArea = heap.area; S.footX = scanFoot(); S.sacks.length = 0; setMirror(); computeStats(); setTool(S.tool); P.x = WL.START_X; P.y = heap.surf(P.x); S.camX = P.x + 30; camTick(1); cam.snapTo(cam.tx, cam.ty, cur.zoom); return G.Islands.island().id; },
    islandEvent(on) { if (G.Islands) G.Islands.forceEvent(on); },
    feel: () => ({ cold: FEEL.cold, hot: FEEL.hot, beach: FEEL.beach, idle: FEEL.idle }),
    hold(wx, wy, on) { hook.use = true; hook.on = on !== false; hook.wx = wx; hook.wy = wy; ptr.down = hook.on; ptr.wx = wx; ptr.wy = wy; ptr.has = true; },
    stats: () => st, nodeState: id => nodeState(D.nodeById[id]), nodeCost: id => nodeCost(D.nodeById[id]),
    reset() { save.clear(); saveNow = () => {}; location.reload(); },
    save: () => saveNow(), exportStr: () => save.exportStr(),
    heapCache(v) { if (v !== undefined) HEAP_CACHE = !!v; return HEAP_CACHE; },
    refillSpot: () => Object.assign({ front: workFront() }, refillSpot()), refill: () => refillHouse(),   // testes: recarga da casa na frente da máquina   // testes: liga/desliga a montanha guardada
    res(v) { RES.off = true; if (v) stage.setMaxDpr(v); return stage.dpr; },   // testes de desempenho: resolução fixa (desliga a adaptativa)
    patioTour: () => patioTour(), patioTourT: t => { if (ptour && typeof t === 'number') ptour.t = t; return !!ptour; },   // testes/prints do Ver o Pátio
    view() { if (celeCard && celeCard.close) { celeCard.close(); celeCard = null; } S.stamp = 0; S.camX = P.x + 30 / cur.zoom; camTick(1); cam.snapTo(cam.tx, cam.ty, cur.zoom); },
    get heap() { return heap; }, get cam() { return cam; }, get tool() { return cur; }, get m() { return S.m; }, get loop() { return loop; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
