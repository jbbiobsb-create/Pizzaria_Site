/* Kome no Japão — data.js
   TODOS os números de balanceamento do jogo num lugar só (window.KomeGame.Data). Só literais; nada de lógica de jogo.
   Fontes: docs/GDD.md §2, 3, 4, 6, 7, 8.2 e docs/GDD-ADENDO.md (britadeira, trator mais caro, coletor).
   Os campos `tier` de TREE/HOUSE estão na numeração do GDD (12 degraus); a britadeira entrou no degrau 7, então
   no fim do arquivo todo tier >= 7 ganha +1 (ver TIER_SHIFT_FROM). */
(function () {
  'use strict';
  const G = (window.KomeGame = window.KomeGame || {});
  const D = (G.Data = {});

  /* ---------------- mundo ---------------- */
  D.WORLD = {
    WW: 8400, COLW: 4, MX0: 1800, MX1: 8000, MH: 2600,
    SLOPE: 0.86,            // inclinação das faces (o talude de repouso do arroz solto é 3.6/4 = 0.9)
    START_X: 1840, SEED: 4293,
    GROUND_FRAC: 0.74,      // altura da tela (0..1) onde fica o chão
  };

  /* ---------------- economia ---------------- */
  D.ECON = {
    P0: 0.20,               // ¥ por px² de arroz solto
    COST_TOOL: 1,           // botões de ajuste do balanceamento (o playtest.js mede o efeito)
    COST_NODE: 1,
    COST_HOUSE: 1,
    HR: 0.08,               // ajudante a pé: fração do A do Kome (até a escavadeira)
    PR: 0.25,               // máquina antiga pilotada: fração do A dela
    ESTREIA_SEC: 3, ESTREIA_SPEED: 2,
    PAY_BATCH: 0.4,         // ferramentas contínuas pagam em lotes
    SURPRISE: 1 / 120, SURPRISE_MULT: 3,
    REFILL_AT: 0.04, REFILL_ADD: 0.12,
    // Renda que o GDD conta e a Fase 1 ainda não tem (missões, visitantes, selos +2%/degrau, conquistas +1% cada) entra
    // como um multiplicador por degrau. Foi afinado com tools/playtest.js --auto. Quando a Fase 2 ligar esses sistemas,
    // baixar estes números (o da Bagger já é baixo de propósito: a fase dela tem que durar ~10 min).
    EXTRA_BY_TOOL: [1.35, 1.4, 1.45, 1.75, 1.85, 2.0, 2.0, 2.2, 2.5, 2.2, 2.2, 2.6, 1.35],
    HAUL_SPEED: 1.35,       // ritmo do par pá de cabo + caminhão (ciclo de ~11 s como no GDD)
  };

  /* ---------------- escada de ferramentas (13 degraus) ----------------
     A = px²/s segurando 100%; r = raio da cratera; pow = força (k = pow/dureza); zoom da câmera; spd = px/s andando;
     reach = distância de trabalho; park = distância que a máquina estaciona do barranco; sfx/loop = som; pay = eventos de m.ev
     que pagam (vazio = lote contínuo); size = texto do cartão "tamanho real". */
  D.TOOLS = [
    { id: 'pata', name: 'Pata do Kome', cost: 0, A: 15, r: 6, pow: 1, zoom: 3.0, spd: 240, reach: 14, seat: 'paw', kind: 'hand', shake: 0, grains: 3, sfx: 'paw', pay: [],
      size: '44 px de shiba · 4 patas · 1 sonho', act: 'patas frenéticas, 3 grãos por batida' },
    { id: 'hashi', name: 'Hashi', cost: 120, A: 25, r: 8, pow: 1, zoom: 2.7, spd: 250, reach: 20, seat: 'paw', kind: 'hand', shake: 0, grains: 2, sfx: 'hashi', pay: [],
      size: '23 cm de bambu · grão por grão', act: 'pega grão por grão absurdamente rápido' },
    { id: 'tigela', name: 'Tigela', cost: 600, A: 44, r: 11, pow: 1.3, zoom: 2.4, spd: 260, reach: 22, seat: 'paw', kind: 'hand', shake: 0, grains: 8, sfx: 'bowl', pay: ['toss'],
      size: '1 tigela = 3.000 grãos', act: 'enche e joga por cima do ombro' },
    { id: 'pa', name: 'Pá', cost: 2800, A: 72, r: 15, pow: 2, zoom: 2.1, spd: 270, reach: 24, seat: 'paw', kind: 'hand', shake: 0.06, grains: 12, sfx: 'shovel', pay: ['toss'],
      size: '1 pazada = 9 tigelas', act: 'swing com squash, torrões' },
    { id: 'duaspas', name: 'Duas Pás', cost: 10000, A: 112, r: 19, pow: 2.5, zoom: 1.8, spd: 280, reach: 26, seat: 'paw', kind: 'hand', shake: 0.07, grains: 16, sfx: 'shovel', pay: ['hit'],
      size: '2 pás · 3,2 golpes por segundo', act: 'uma em cada pata; a cada 8 golpes um giro-helicóptero' },
    { id: 'carrinho', name: 'Carrinho de Mão', cost: 32000, A: 172, r: 28, pow: 3, zoom: 1.45, spd: 300, reach: 50, seat: 'paw', kind: 'push', shake: 0.14, grains: 30, sfx: 'barrow', pay: ['dump'],
      size: '80 litros · 1 roda que range', act: 'trombada no barranco, avalanche na caçamba' },
    { id: 'britadeira', name: 'Britadeira', cost: 55000, A: 210, r: 26, pow: 3.6, zoom: 1.28, spd: 230, reach: 26, seat: 'paw', kind: 'jack', shake: 0.1, grains: 10, sfx: 'thud', loop: 'tractor', pay: [],
      size: '30 kg · 15 pancadas por segundo', act: 'fura pra baixo, racha o arroz prensado' },
    { id: 'trator', name: 'Trator', cost: 110000, A: 250, r: 44, pow: 4, zoom: 1.1, spd: 420, reach: 48, park: 105, seat: 'cab', kind: 'trator', shake: 0.16, grains: 40, sfx: 'tractor', loop: 'tractor', pay: ['dump'],
      size: '3,5 t · 350 shibas de peso', act: 'carregadeira frontal empurra ondas de arroz' },
    { id: 'empilhadeira', name: 'Empilhadeira', cost: 270000, A: 360, r: 36, pow: 5.5, zoom: 0.85, spd: 400, reach: 60, park: 96, seat: 'cab', kind: 'fork', cycle: 1.55, shake: 0.18, grains: 20, sfx: 'forklift', loop: 'electric', pay: ['dump'],
      size: '4 t · garfos de 1,2 m', act: 'espeta os garfos e arranca blocos de arroz prensado' },
    { id: 'escav', name: 'Escavadeira Hidráulica', cost: 800000, A: 500, r: 72, pow: 8, zoom: 0.62, spd: 380, reach: 120, park: 196, seat: 'cab', kind: 'escav', shake: 0.24, grains: 80, sfx: 'excavator', loop: 'diesel', pay: ['dump'],
      size: '22 t · braço de 9 m', act: 'braço articulado morde e despeja' },
    { id: 'pacabo', name: 'Pá de Cabo Elétrica', cost: 2700000, A: 660, r: 100, pow: 9, zoom: 0.46, spd: 30, reach: 260, park: 262, seat: 'cab', kind: 'rope', cycle: 3.6, shake: 0.34, grains: 200, sfx: 'ropeshovel', loop: 'electric', pay: ['dump'],
      size: '1.400 t · caçamba de 60 m³', act: 'conchada gigante e lenta: iça, gira, despeja' },
    { id: 'caminhao', name: 'Caminhão de Mineração', cost: 6500000, A: 860, r: 100, pow: 11, zoom: 0.36, spd: 260, reach: 0, park: 262, seat: 'cab', kind: 'haul', cycle: 11.2, shake: 0.42, grains: 400, sfx: 'hauler', loop: 'truck', pay: ['dump'],
      size: '7,6 m de altura · 360 t de carga', act: 'Kome dirige; capataz Tetsu carrega com a pá de cabo' },
    { id: 'bagger', name: 'Bagger 293', cost: 13000000, A: 1300, r: 110, pow: 16, zoom: 0.26, spd: 40, reach: 560, seat: 'cab', kind: 'bagger', shake: 0.3, grains: 60, sfx: 'bagger', loop: 'bagger', pay: [], needs: ['bg1', 'bg2'],
      size: '96 m. 14.200 t. 1 shiba.', act: 'roda de 18 caçambas' },
  ];

  /* Mordida da Bagger: fração enterrada -> multiplicador (GDD §3) */
  D.MORDIDA = { empty: 0.3, lo: 0.4, hi: 0.7, stall: 0.85, mEmpty: 0.6, mPerfect: 1.5, loK: 0.35, hiK: 0.75, mPerfectK: 1.6, x3Chance: 0.25, x3After: 3 };
  D.HAUL = { crown: 1.25 };                    // carga coroada (100-115%)
  D.CART = { crownChance: 1 / 8, crownMult: 1.25 };

  /* ---------------- materiais e bolsões ---------------- */
  D.MATS = [
    { id: 'solto', name: 'Arroz Solto', d0: 0, d1: 150, hard: 1, val: 1, slope: 3.6, col: '#F6F1E4', tex: 'loose' },
    { id: 'prensado', name: 'Arroz Prensado', d0: 150, d1: 600, hard: 2.5, val: 1.6, slope: 6, col: '#E9DCBE', tex: 'pressed' },
    { id: 'mochi', name: 'MOCHI DURO', d0: 600, d1: 1e9, hard: 8, val: 3.5, slope: 9, col: '#EFD9D2', tex: 'mochi' },
    { id: 'koshi', name: 'Núcleo Koshihikari', ellipse: { cx: 4900, cy: 0, rx: 1150, ry: 900 }, hard: 24, val: 6, slope: 12, col: '#E8B93A', tex: 'gold' },
  ];
  D.POCKETS = { n: 28, r: [35, 90], mult: 8, minDepth: 60 };

  /* ---------------- combo, sacos, onigiri ---------------- */
  D.COMBO = { max: 30, cap: 1.5, gain: 2.5, idle: 0.45, decay: 12, furiaHold: 10, furiaSec: 5, furiaMult: 2 };
  D.SACK = { every: 20, jitter: [0.5, 1.5], life: 12, worthSec: 1.0, vary: [0.8, 1.2],
    gacha: [{ m: 0.5, p: 0.20, kind: 'plain', shake: 1.0 }, { m: 1.2, p: 0.55, kind: 'plain', shake: 1.0 }, { m: 3, p: 0.20, kind: 'golden', shake: 1.5 }, { m: 10, p: 0.05, kind: 'legendary', shake: 2.5 }] };
  D.ONIGIRI = { every: [45, 70], worthSec: 8, worthSec2: 12, life: 9 };
  D.STOMP = { every: 6, worthSec: 1.2, radMul: 3 };

  /* ---------------- coletor (pra onde o arroz vai), por degrau ---------------- */
  D.COLLECTOR = ['cesto', 'cesto', 'saco', 'barraca', 'barraca', 'barraca', 'kei', 'kei', 'silo', 'silo', 'moega', 'moega', 'moega'];
  D.PAY_DELAY = [0.3, 0.6];

  /* ---------------- casa ---------------- */
  D.HOUSE = [
    { id: 'h1', n: 'Terreno', c: 200000, tier: 7, perk: { help: 1 }, draw: 'placa VENDIDO, corda, bandeirinha; um shiba novo sai do terreno' },
    { id: 'h2', n: 'Fundação', c: 3000000, tier: 9, perk: { sell: 1.25 }, draw: 'laje, estacas, betoneira, pegada do Kome' },
    { id: 'h3', n: 'Estrutura de Hinoki', c: 12000000, tier: 11, perk: { offCap: 4 }, draw: 'esqueleto de madeira, paredes shoji, engawa' },
    { id: 'h4', n: 'Telhado Kawara', c: 28000000, tier: 12, perk: { nightGlow: 1 }, draw: 'telhas azul-cinza, lanterna acesa' },
    { id: 'h5', n: 'Jardim com Lago de Carpas', c: 48000000, tier: 12, perk: { sell: 1.3 }, draw: 'lago com nishikigoi, tōrō, ponte, momiji' },
    { id: 'h6', n: 'Onsen', c: 70000000, teaser: 35000000, tier: 12, perk: { end: 1 }, draw: 'rotenburo, vapor, capivara hóspede' },
  ];

  /* ---------------- árvore do Kome (68 nós, GDD §6) ---------------- */
  D.BRANCHES = {
    colheita: { name: 'Colheita', color: '#7DB34A', icon: 'paw' },
    comercio: { name: 'Comércio', color: '#E3BC62', icon: 'yen' },
    equipe: { name: 'Equipe', color: '#E8913A', icon: 'hat' },
    maquinas: { name: 'Máquinas', color: '#5B9BD5', icon: 'gear' },
    sorte: { name: 'Sorte', color: '#E48FA5', icon: 'star' },
  };
  D.SYN = [
    { a: 'e1', b: 'm5', fx: { hm: 1.08 }, see: 'Marmita + Fábrica: bentô de fábrica, ajudantes +8%' },
    { a: 's2', b: 'combo1', fx: { critCombo: 3 }, see: 'Grão Dourado + Ritmo de Taiko: cada crítico dá +3 de combo' },
    { a: 'a3', b: 's4', fx: { crowPoint: 1 }, see: 'Kakashi + Faro: corvos circulam sobre o bolsão mais próximo' },
  ];
  D.TREE = [
 {id:'c1',n:'Patinhas Fortes',c:40,branch:'colheita',pos:{x:0.0,y:-1.2},req:[],tier:1,size:1,fx:{dig:1.3},
   see:'patas do Kome crescem 20% e ganham almofadinhas rosa; 5 grãos por batida em vez de 3'},
 {id:'c3',n:'Patada Sísmica',c:3000,branch:'colheita',pos:{x:0.0,y:-2.5},req:['c1'],tier:4,size:2,fx:{stomp:1,dig:1.15},
   see:'KEYSTONE: a cada 6 s cavando Kome pula e abre cratera de 3r, anel de poeira, shake 4 px'},
 {id:'c_spd',n:'Patas Ligeiras',c:1200,branch:'colheita',pos:{x:-1.0,y:-2.5},req:['c1'],tier:4,size:0,fx:{spd:1.2},
   see:'Kome corre com rastro de 3 afterimages e poeirinha nos pés'},
 {id:'cA',n:'Almofadinhas Calejadas',c:5100,branch:'colheita',pos:{x:0.0,y:-3.8},req:['c3'],tier:5,size:0,fx:{dig:1.1},
   see:'animação de uso 10% mais rapida; +2 grãos por batida no jato'},
 {id:'c_reach',n:'Braço Comprido',c:11000,branch:'colheita',pos:{x:-1.0,y:-3.8},req:['c_spd'],tier:6,size:0,fx:{reach:1.15},
   see:'cabo/braco/lança da ferramenta desenhado 15% mais longo'},
 {id:'c6',n:'Kome Workaholic',c:20000,branch:'colheita',pos:{x:1.0,y:-3.8},req:['c3'],tier:6,size:1,fx:{auto:0.4},
   see:'solto o dedo, Kome continua cavando sozinho com olheiras e uma gota de suor'},
 {id:'cB',n:'Diesel Premium',c:54000,branch:'colheita',pos:{x:0.0,y:-5.0},req:['cA'],tier:7,size:0,fx:{dig:1.1},
   see:'fumaça do escape vira azul e mais densa; motor sobe meio tom'},
 {id:'combo1',n:'Ritmo de Taiko',c:81000,branch:'colheita',pos:{x:1.0,y:-5.0},req:['c6'],tier:7,size:1,fx:{comboCap:1.75},
   see:'barra de combo ganha 2º segmento; taiko entra na música acima de x1,5'},
 {id:'cC',n:'Lâminas Afiadas',c:180000,branch:'colheita',pos:{x:0.0,y:-6.2},req:['cB'],tier:8,size:0,fx:{dig:1.1},
   see:'brilho "ting" percorre a lâmina/garfo/dente a cada 4 s; corte solta faíscas brancas'},
 {id:'c7',n:'Fúria do Kome',c:810000,branch:'colheita',pos:{x:1.0,y:-6.2},req:['combo1'],tier:9,size:2,fx:{furia:1.33},
   see:'KEYSTONE: 10 s em combo max -> 5 s de iene x2: Kome uiva, aura vermelha, tela com speedlines'},
 {id:'cD',n:'Turbo Intercooler',c:540000,branch:'colheita',pos:{x:0.0,y:-7.5},req:['cC'],tier:9,size:0,fx:{dig:1.12},
   see:'turbina visível no capô girando; apito de turbo ao segurar'},
 {id:'c8',n:'Combo Mestre',c:2600000,branch:'colheita',pos:{x:1.0,y:-7.5},req:['c7'],tier:10,size:1,fx:{comboCap:2},
   see:'barra de combo com 3º segmento arco-iris; números de iene pulsam no ritmo'},
 {id:'m1',n:'Barraquinha',c:250,branch:'comercio',pos:{x:1.2,y:-0.4},req:[],tier:2,size:1,fx:{sell:1.5},
   see:'barraca com noren, obaa-san e fila de 3 clientes no pátio'},
 {id:'m_a',n:'Balança Honesta',c:700,branch:'comercio',pos:{x:2.4,y:-0.8},req:['m1'],tier:3,size:0,fx:{sell:1.15},
   see:'balança de pratos na barraca, tilinta a cada venda'},
 {id:'m_b',n:'Noren Novo',c:8000,branch:'comercio',pos:{x:3.6,y:-1.2},req:['m_a'],tier:5,size:0,fx:{sell:1.15},
   see:'noren troca pra índigo com o rosto do Kome; fila cresce pra 5'},
 {id:'m_c',n:'Feira de Niigata',c:20000,branch:'comercio',pos:{x:4.8,y:-1.5},req:['m_b'],tier:6,size:0,fx:{sell:1.15},
   see:'bandeiras nobori ao longo do pátio balançando ao vento'},
 {id:'m5',n:'Fábrica de Onigiri',c:140000,branch:'comercio',pos:{x:5.9,y:-1.9},req:['m_c'],tier:7,size:1,fx:{sell:1.3},
   see:'fábrica no pátio; chaminé solta baforadas em forma de onigiri'},
 {id:'m_d',n:'Embalagem Kawaii',c:270000,branch:'comercio',pos:{x:7.1,y:-2.3},req:['m5'],tier:8,size:0,fx:{sell:1.15},
   see:'sacos e pops de iene passam a ter carinha sorrindo'},
 {id:'m7a',n:'Selo Premium',c:700000,branch:'comercio',pos:{x:6.3,y:-1.0},req:['m5'],tier:9,size:0,fx:{val:1.12},
   see:'camada prensada ganha brilho perolado; pops de prensado/mochi com selo vermelho'},
 {id:'m_e',n:'Ekiben de Estação',c:970000,branch:'comercio',pos:{x:6.8,y:-3.3},req:['m5'],tier:9,size:0,fx:{sell:1.15},
   see:'plataforma de estação com quiosque de ekiben ao lado do trilho'},
 {id:'m8',n:'Trem de Arroz',c:1600000,branch:'comercio',pos:{x:8.3,y:-2.7},req:['m_d'],tier:9,size:2,fx:{sell:1.3},
   see:'KEYSTONE: trem (loco + 3 vagões) cruza o fundo a cada 20 s; tocar o apito na passagem = +3 s de renda'},
 {id:'m7b',n:'Selo Ouro',c:1700000,branch:'comercio',pos:{x:7.4,y:-1.4},req:['m7a'],tier:10,size:0,fx:{val:1.12},
   see:'mochi ganha veios dourados; estilhacos de mochi brilham'},
 {id:'m_f',n:'Exportação',c:2300000,branch:'comercio',pos:{x:8.0,y:-3.7},req:['m_e'],tier:10,size:0,fx:{sell:1.15},
   see:'contêineres coloridos empilhados no pátio, guindaste portuário pequeno'},
 {id:'m9',n:'Destilaria de Sake',c:3400000,branch:'comercio',pos:{x:9.5,y:-3.1},req:['m8'],tier:10,size:0,fx:{sell:1.15},
   see:'destilaria com barris komodaru; tanuki bêbado dorme na porta'},
 {id:'m11',n:'Porto de Niigata',c:6500000,branch:'comercio',pos:{x:9.2,y:-4.0},req:['m_f'],tier:11,size:0,fx:{sell:1.15},
   see:'navio cargueiro no horizonte recebe o trem; gaivotas'},
 {id:'m10',n:'Marca "Kome no Japão"',c:42000000,branch:'comercio',pos:{x:10.7,y:-3.5},req:['m9','m11'],tier:12,size:1,fx:{sell:1.25},
   see:'outdoor gigante com o rosto do Kome; pops de iene viram dourados com logo'},
 {id:'a1',n:'Shiba Ajudante',c:1500,branch:'equipe',pos:{x:0.7,y:1.0},req:[],tier:4,size:1,fx:{help:1},
   see:'Goma chega cavando com tigela ao lado do Kome'},
 {id:'a2',n:'Segundo Shiba',c:5800,branch:'equipe',pos:{x:1.5,y:2.0},req:['a1'],tier:5,size:0,fx:{help:1},
   see:'Kuro (preto e canela) entra na fila'},
 {id:'a3',n:'Kakashi',c:8300,branch:'equipe',pos:{x:0.7,y:2.6},req:['a1'],tier:5,size:0,fx:{crows:0,hv:1.2},
   see:'espantalho com o chapéu do Kome; corvos fogem em revoada'},
 {id:'a4',n:'Turma Shiba',c:16000,branch:'equipe',pos:{x:2.2,y:3.0},req:['a2'],tier:6,size:0,fx:{help:2},
   see:'Shiro + Mame: 4 shibas trabalhando'},
 {id:'e1',n:'Marmita (bentô)',c:25000,branch:'equipe',pos:{x:3.0,y:2.4},req:['a2'],tier:6,size:0,fx:{hm:1.25},
   see:'shibas param 1 s pra comer onigiri e correm 25% mais rápido, com notinha músical'},
 {id:'a5',n:'Kei-truck',c:76000,branch:'equipe',pos:{x:1.4,y:3.6},req:['a3'],tier:7,size:2,fx:{autosack:1,sack:1.33,hv:1.3},
   see:'KEYSTONE: kei-truck branco vai e volta recolhendo os sacos sozinho e bascula na barraca'},
 {id:'a11',n:'Shiba Novato',c:38000,branch:'equipe',pos:{x:2.9,y:4.0},req:['a4'],tier:7,size:0,fx:{help:1},
   see:'Pochi, filhote de capacete grande demais'},
 {id:'a7',n:'Silo',c:97000,branch:'equipe',pos:{x:2.1,y:4.6},req:['a5'],tier:7,size:1,fx:{silo:1},
   see:'silo com visor de nível no pátio; libera renda offline'},
 {id:'a6',n:'Pás pros Shibas',c:240000,branch:'equipe',pos:{x:3.7,y:3.5},req:['e1'],tier:8,size:0,fx:{hm:1.25},
   see:'tigelas dos ajudantes viram pás; torrões maiores'},
 {id:'a8',n:'Mais Shibas',c:320000,branch:'equipe',pos:{x:3.7,y:5.1},req:['a11'],tier:8,size:0,fx:{help:2},
   see:'7 shibas; passam a cantar "wan-wan-ho!" em coro'},
 {id:'e3',n:'Apito do Capataz',c:140000,branch:'equipe',pos:{x:2.9,y:5.6},req:['a7'],tier:8,size:0,fx:{hv:1.15},
   see:'um shiba de apito marca o ritmo; ajudantes cavam sincronizados'},
 {id:'a9',n:'Esteira',c:1200000,branch:'equipe',pos:{x:3.6,y:6.7},req:['e3'],tier:9,size:1,fx:{hv:1.3},
   see:'esteira do pé da montanha ao silo com grãos rolando'},
 {id:'e4',n:'Capacetes',c:1300000,branch:'equipe',pos:{x:4.5,y:4.5},req:['a6'],tier:10,size:0,fx:{hm:1.11},
   see:'todos os ajudantes de capacete amarelo e colete refletivo'},
 {id:'a10',n:'Capatazes',c:3000000,branch:'equipe',pos:{x:4.4,y:6.1},req:['a8'],tier:10,size:0,fx:{help:1},
   see:'capataz em mini-escavadeira amarela'},
 {id:'e5',n:'Rádio da Obra',c:3600000,branch:'equipe',pos:{x:4.3,y:7.7},req:['a9','a10'],tier:11,size:0,fx:{hv:1.15},
   see:'antena no pátio; balões "copiado!" e enka baixinho no rádio'},
 {id:'p1',n:'Piloto pro Trator',c:210000,branch:'maquinas',pos:{x:-0.7,y:1.0},req:[],tier:8,size:1,fx:{pilot:'trator'},
   see:'Goma sobe no trator estacionado e empurra ondas sozinha (placa PRECISA-SE some)'},
 {id:'p2',n:'Piloto pra Empilhadeira',c:590000,branch:'maquinas',pos:{x:-1.5,y:2.0},req:['p1'],tier:9,size:1,fx:{pilot:'empilhadeira'},
   see:'Kuro pilota a empilhadeira e empilha paletes no pátio'},
 {id:'p3',n:'Piloto pra Escavadeira',c:2000000,branch:'maquinas',pos:{x:-2.2,y:3.0},req:['p2'],tier:10,size:1,fx:{pilot:'escav'},
   see:'Shiro opera a escavadeira num terraço próprio'},
 {id:'e2a',n:'Oficina',c:1400000,branch:'maquinas',pos:{x:-3.0,y:2.4},req:['p2'],tier:10,size:0,fx:{pm:1.15},
   see:'galpao-oficina; máquinas pilotadas ganham pintura nova e brilho'},
 {id:'bg1',n:'Projeto Bagger 1/3: Esteiras',c:6300000,branch:'maquinas',pos:{x:-2.1,y:4.6},req:['p3'],tier:11,size:1,fx:{part:1},
   see:'comboio traz as 3 esteiras; guindastes e soldadores no pátio'},
 {id:'p4',n:'Frota da Pá de Cabo',c:4700000,branch:'maquinas',pos:{x:-2.9,y:4.0},req:['p3'],tier:11,size:1,fx:{pilot:'pacabo'},
   see:'2 caminhões amarelos de shibas entram no ciclo; a pá de cabo nunca para'},
 {id:'e2b',n:'Turno da Noite',c:4200000,branch:'maquinas',pos:{x:-3.7,y:3.5},req:['e2a'],tier:11,size:0,fx:{pm:1.13},
   see:'torres de luz; faróis e giroflex nas máquinas pilotadas à noite'},
 {id:'bg2',n:'Projeto Bagger 2/3: Torre e Contrapeso',c:10000000,branch:'maquinas',pos:{x:-2.9,y:5.6},req:['bg1'],tier:11,size:1,fx:{part:1},
   see:'torre e contrapeso sobem; silhueta já tapa o sol da tarde'},
 {id:'b0',n:'Buzina',c:293,branch:'maquinas',pos:{x:-3.6,y:6.7},req:['bg2'],tier:12,size:0,fx:{horn:1},
   see:'botão BUZINA: onda de choque visível, corvos e shibas pulam'},
 {id:'p5',n:'Piloto pro Caminhão',c:11000000,branch:'maquinas',pos:{x:-3.7,y:5.1},req:['p4'],tier:12,size:1,fx:{pilot:'caminhao'},
   see:'o 797 do Kome entra na frota com Pochi no volante (só se vê o capacete)'},
 {id:'b1',n:'Roda Turbo',c:8400000,branch:'maquinas',pos:{x:-4.3,y:7.7},req:['b0'],tier:12,size:0,fx:{dig:1.2},
   see:'roda gira 20% mais rápido; caçambas viram borrão, "tchac" mais agudo'},
 {id:'b2',n:'Lança Longa',c:10000000,branch:'maquinas',pos:{x:-4.4,y:6.1},req:['b0'],tier:12,size:0,fx:{boom:1.3},
   see:'lança estica de 560 pra 730 px com treliça nova'},
 {id:'bK',n:'Mordida Perfeita+',c:14000000,branch:'maquinas',pos:{x:-5.9,y:8.1},req:['b1','b2'],tier:12,size:2,fx:{mordida:1},
   see:'KEYSTONE: faixa perfeita 0,35-0,75 e x1,6; arco fica dourado e 3 perfeitas seguidas disparam "x3 NESTA MORDIDA"'},
 {id:'b3',n:'Caçambas de Titânio',c:18000000,branch:'maquinas',pos:{x:-5.1,y:8.7},req:['b1'],tier:12,size:1,fx:{powMul:1.5,titan:1},
   see:'caçambas azul-titânio; o Núcleo Koshihikari solta lascas douradas a 100%'},
 {id:'b4',n:'Esteira Tronco Dupla',c:24000000,branch:'maquinas',pos:{x:-6.0,y:6.5},req:['b2','a9'],tier:12,size:0,fx:{sell:1.15},
   see:'segunda esteira paralela até os silos; fluxo de grãos dobra de espessura'},
 {id:'s1',n:'Sacos Maiores',c:840,branch:'sorte',pos:{x:-1.2,y:-0.4},req:[],tier:3,size:1,fx:{sack:1.5},
   see:'sprite do saco 30% maior com laço vermelho'},
 {id:'s2',n:'Grao Dourado',c:1100,branch:'sorte',pos:{x:-2.4,y:-0.8},req:['s1'],tier:3,size:1,fx:{crit:0.04,critMult:5},
   see:'grãos dourados no jato; pop crítico amarelo com "kin!"'},
 {id:'s3',n:'Onigiri da Sorte',c:2000,branch:'sorte',pos:{x:-2.1,y:-1.7},req:['s1'],tier:4,size:1,fx:{oni:0.08},
   see:'onigiri voador com asinhas cruza a tela a cada 45-70 s'},
 {id:'s4',n:'Faro de Shiba',c:9600,branch:'sorte',pos:{x:-3.6,y:-1.2},req:['s2'],tier:5,size:2,fx:{gold:10,glow:1},
   see:'KEYSTONE: bolsões brilham através da superfície; nariz do Kome fareja e aponta'},
 {id:'s5',n:'Sacos de Seda',c:23000,branch:'sorte',pos:{x:-3.9,y:-0.2},req:['s2'],tier:6,size:0,fx:{sack:1.3},
   see:'sacos roxos de seda; estouram com confete'},
 {id:'s6',n:'Mural Maior',c:49000,branch:'sorte',pos:{x:-3.3,y:-2.1},req:['s3'],tier:7,size:0,fx:{mis:0.08},
   see:'mural de missões de madeira no pátio; baús de missão maiores'},
 {id:'s7',n:'Peneira de Ouro',c:210000,branch:'sorte',pos:{x:-4.8,y:-1.5},req:['s4'],tier:8,size:0,fx:{crit:0.05},
   see:'críticos soltam chuva de 6 moedas; ajudantes também'},
 {id:'s8',n:'Sacos Dourados',c:290000,branch:'sorte',pos:{x:-5.1,y:-0.6},req:['s5'],tier:8,size:0,fx:{sack:1.3},
   see:'sacos dourados com brilho e raio de luz ao estourar'},
 {id:'s9',n:'Onigiri Duplo',c:430000,branch:'sorte',pos:{x:-4.4,y:-2.5},req:['s3'],tier:9,size:0,fx:{oni:0.12},
   see:'onigiris passam em dupla; o segundo é de ume com ponto vermelho'},
 {id:'s10',n:'Veio de Ouro',c:810000,branch:'sorte',pos:{x:-5.9,y:-1.9},req:['s7'],tier:9,size:0,fx:{gold:12},
   see:'bolsões ligados por veios dourados visíveis no corte da montanha'},
 {id:'s11',n:'Chá da Obaa-san',c:590000,branch:'sorte',pos:{x:-5.6,y:-2.9},req:['s9'],tier:9,size:0,fx:{vis:0.05},
   see:'mesinha de chá no pátio; visitantes ficam +5 s e pagam mais'},
 {id:'s12',n:'DESLIZAMENTO!',c:1200000,branch:'sorte',pos:{x:-6.3,y:-1.0},req:['s8'],tier:10,size:1,fx:{slide:1},
   see:'avalanche >40.000 px² vira evento: banner, câmera treme, iene x1,5 por 3 s'},
  ];

  /* a britadeira entrou no degrau 7: os tiers do GDD de 7 pra cima sobem 1 */
  D.TIER_SHIFT_FROM = 7;
  for (const n of D.TREE) if (n.tier >= D.TIER_SHIFT_FROM) n.tier += 1;
  for (const h of D.HOUSE) if (h.tier >= D.TIER_SHIFT_FROM) h.tier += 1;
  D.toolIndex = {}; D.TOOLS.forEach((t, i) => { D.toolIndex[t.id] = i; });
  D.nodeById = {}; D.TREE.forEach(n => { D.nodeById[n.id] = n; });
})();
