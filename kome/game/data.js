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
  // FINAL: a casa pronta E a montanha cavada até END_DUG (antes acabava na compra do onsen, com ~80% cavado)
  D.END_DUG = 0.95;
  /* PÁTIO DA FROTA (camada Cookie, docs/design/camada-cookie.md, APROVADA; game/patio.js). Abre no final de cada ilha.
     Custos em segundos da renda do final da ilha (R0), rendimento em R0/s. Preço sobe ×grow por unidade. Marcos ×2 em `at`,
     preço = custo-base × mk[i]. Zera na viagem (prestígio). Offline: off × renda, até offMax s. */
  // EVENTOS DOURADOS (game/eventos.js; tipos e pesos vêm da planilha, tipo 'evento'): a cada every s de jogo, life s na tela
  D.EVENTOS = { every: [180, 480], life: 15 };
  D.PATIO = {
    grow: 1.15, off: 0.5, offMax: 8 * 3600, plateau: 240, minRun: 1800,
    at: [1, 5, 25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
    mk: [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e12, 5e14, 5e16, 5e18, 5e20, 5e22],
    turmas: [
      { id: 'pata', n: 'Turma da Pata', c: 10, r: 0.5 }, { id: 'hashi', n: 'Brigada do Hashi', c: 65, r: 2.2 },
      { id: 'tigela', n: 'Clube da Tigela', c: 420, r: 9.2 }, { id: 'pa', n: 'Sindicato da Pá', c: 2.8e3, r: 40 },
      { id: 'duaspas', n: 'Dupla Dinâmica', c: 1.8e4, r: 170 }, { id: 'carrinho', n: 'Esquadrilha do Carrinho', c: 1.2e5, r: 735 },
      { id: 'britadeira', n: 'Banda da Britadeira', c: 7.5e5, r: 3.2e3 }, { id: 'trator', n: 'Comboio de Tratores', c: 4.9e6, r: 1.4e4 },
      { id: 'empilhadeira', n: 'Balé das Empilhadeiras', c: 3.2e7, r: 5.8e4 }, { id: 'colheita', n: 'Fila de Colheitadeiras', c: 2.1e8, r: 2.5e5 },
      { id: 'escav', n: 'Escavadeiras Coreografadas', c: 1.3e9, r: 1.1e6 }, { id: 'caminhao', n: 'Caravana de Caminhões', c: 8.8e9, r: 4.7e6 },
      { id: 'pacabo', n: 'Pás de Cabo no Horizonte', c: 5.7e10, r: 2.0e7 }, { id: 'bagger', n: 'Frota Bagger', c: 3.7e11, r: 8.6e7 },
      // MÁQUINAS ABSURDAS 15–20 (mesma série: custo 10 × 6,5^i, rende 0,5 × 4,3^i): travadas até o nó `seed` (galho Absurdo de
      // D.SEEDS, islands.js); `tool` = G.Tools da cena de chegada (game/absurdas.js); id = PA.ABSURD do patio-arte.js
      { id: 'tatus', n: 'Frota de Tatuzões', c: 2.4e12, r: 3.7e8, seed: 'absurdo15', tool: 'tbm' },
      { id: 'komeohs', n: 'Kome-Oh em Série', c: 1.56e13, r: 1.59e9, seed: 'absurdo16', tool: 'komeoh' },
      { id: 'trembala', n: 'Trem-Bala de Arroz', c: 1.0e14, r: 6.8e9, seed: 'absurdo17', tool: 'trembala' },
      { id: 'foguete', n: 'Foguete de Mochi', c: 6.6e14, r: 2.9e10, seed: 'absurdo18', tool: 'foguete' },
      { id: 'fuji', n: 'Escavadeira do Monte Fuji', c: 4.3e15, r: 1.3e11, seed: 'absurdo19', tool: 'fuji' },
      { id: 'portal', n: 'Portal Onigiri', c: 2.8e16, r: 5.4e11, seed: 'absurdo20', tool: 'portal' },
    ],
  };
  // TATUZÃO (game/tatuzao.js): vende depois do final; price em segundos de renda; cada anel paga ringSec s da renda de agora
  D.TATU = { price: 900, ringSec: 1.2, minH: 330 };
  D.ECON = {
    P0: 0.20,               // ¥ por px² de arroz solto
    COST_TOOL: 1.47,          // botões de ajuste do balanceamento (o playtest.js mede o efeito)
    COST_NODE: 1.47,
    COST_HOUSE: 1.47,
    HR: 0.08,               // ajudante a pé: fração do A do Kome (até a escavadeira)
    PR: 0.25,               // máquina antiga pilotada: fração do A dela
    ESTREIA_SEC: 3, ESTREIA_SPEED: 2,
    PAY_BATCH: 0.4,         // ferramentas contínuas pagam em lotes
    SURPRISE: 1 / 120, SURPRISE_MULT: 3,
    REFILL_AT: 0.04, REFILL_ADD: 0.12,
    // SÓ FALTA A CASA (montanha acabada antes da casa): a montanha só cresce de novo se o dinheiro + a renda não pagam o resto da
    // casa (e a ferramenta que ela pede) em HOUSE_WAIT s, por HOUSE_GRACE s seguidos. Recarga longe do núcleo dourado (raio REFILL_RAD)
    HOUSE_WAIT: 150, HOUSE_GRACE: 10, REFILL_RAD: 900,
    // Renda que o GDD conta e a Fase 1 ainda não tem (missões, visitantes, selos +2%/degrau, conquistas +1% cada) entra
    // como um multiplicador por degrau. Foi afinado com tools/playtest.js --auto. Quando a Fase 2 ligar esses sistemas,
    // baixar estes números (o da Bagger já é baixo de propósito: a fase dela tem que durar ~10 min).
    EXTRA_BY_TOOL: [1.35, 1.4, 1.45, 1.75, 1.85, 2.0, 2.667, 3.8, 5.714, 7.5, 9.0, 11.36, 14.53, 12.82],
    // BOOST[i]: quanto a renda no degrau i cresceu com a escada nova (16/11); preços comprados nesse degrau sobem igual
    BOOST: [1, 1, 1, 1, 1, 1, 1.333, 1.727, 2.597, 3.0, 4.09, 5.165, 5.59, 9.5],
    HAUL_SPEED: 1.35,       // ritmo do par pá de cabo + caminhão (ciclo de ~11 s como no GDD)
  };

  /* ---------------- escada de ferramentas (13 degraus) ----------------
     A = px²/s segurando 100%; r = raio da cratera; pow = força (k = pow/dureza); zoom da câmera; spd = px/s andando;
     reach = distância de trabalho; park = distância que a máquina estaciona do barranco; sfx/loop = som; pay = eventos de m.ev
     que pagam (vazio = lote contínuo); size = texto do cartão "tamanho real".
     MÁQUINAS: vmax = px/s de viagem (dono 19/11: "o tamanho tem que cobrir o terreno grande": ~1 tela da máquina (1150/zoom px)
     em ~3,5 s), tau = s de inércia (0 → vmax; máquina grande pesa na arrancada/freada, não andando devagar). Caminhão: vmax/tau
     = a pá do Tetsu chegando no barranco (a viagem até a moega é o ciclo, fica no machines-mine.js). */
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
    { id: 'trator', name: 'Trator', cost: 110000, A: 250, r: 44, pow: 4, zoom: 1.1, spd: 420, reach: 48, park: 105, vmax: 300, tau: 0.25, seat: 'cab', kind: 'trator', shake: 0.16, grains: 40, sfx: 'tractor', loop: 'tractor', pay: ['dump'],
      size: '3,5 t · 350 shibas de peso', act: 'carregadeira frontal empurra ondas de arroz' },
    { id: 'empilhadeira', name: 'Empilhadeira', cost: 170000, A: 280, r: 36, pow: 5.5, zoom: 0.85, spd: 400, reach: 60, park: 96, vmax: 380, tau: 0.3, seat: 'cab', kind: 'fork', cycle: 1.55, shake: 0.18, grains: 20, sfx: 'forklift', loop: 'electric', pay: ['dump'],
      size: '4 t · garfos de 1,2 m', act: 'espeta os garfos e arranca blocos de arroz prensado' },
    { id: 'colheita', name: 'Colheitadeira', cost: 270000, A: 360, r: 40, pow: 4.8, zoom: 0.95, spd: 320, reach: 90, park: 86, vmax: 340, tau: 0.35, seat: 'cab', kind: 'trator', cycle: 5.9, shake: 0.14, grains: 30, sfx: 'tractor', loop: 'tractor', pay: ['dump'],
      size: '9 t · plataforma de 4 m', act: 'molinete puxa, tanque enche, tubo despeja' },
    { id: 'escav', name: 'Escavadeira Hidráulica', cost: 800000, A: 500, r: 72, pow: 10, zoom: 0.62, spd: 380, reach: 120, park: 196, vmax: 520, tau: 0.5, seat: 'cab', kind: 'escav', shake: 0.24, grains: 80, sfx: 'excavator', loop: 'diesel', pay: ['dump'],
      size: '22 t · braço de 9 m', act: 'braço articulado morde e despeja' },
    { id: 'caminhao', name: 'Caminhão de Mineração', cost: 2700000, A: 660, r: 100, pow: 11, zoom: 0.36, spd: 260, reach: 0, park: 262, vmax: 520, tau: 0.5, seat: 'cab', kind: 'haul', cycle: 11.2, shake: 0.42, grains: 400, sfx: 'hauler', loop: 'truck', pay: ['dump'],
      size: '7,6 m de altura · 360 t de carga', act: 'Kome dirige; o Tetsu enche com a escavadeira' },
    { id: 'pacabo', name: 'Pá de Cabo Elétrica', cost: 6500000, A: 860, r: 100, pow: 12.5, zoom: 0.46, spd: 30, reach: 260, park: 262, vmax: 700, tau: 1.1, seat: 'cab', kind: 'rope', cycle: 3.6, shake: 0.34, grains: 200, sfx: 'ropeshovel', loop: 'electric', pay: ['dump'],
      size: '1.400 t · caçamba de 60 m³', act: 'conchada gigante e lenta: iça, gira, despeja' },
    // Bagger A e casas h4-h6 x1,5 (15/11): partida termina com ~85-92% da montanha cavada
    { id: 'bagger', name: 'Bagger 293', cost: 6000000, A: 1950, r: 110, pow: 16, zoom: 0.31, spd: 40, reach: 560, vmax: 1000, tau: 1.3, seat: 'cab', kind: 'bagger', shake: 0.3, grains: 60, sfx: 'bagger', loop: 'bagger', pay: [], needs: ['bg1', 'bg2'],
      size: '96 m. 14.200 t. 1 shiba.', act: 'roda de 18 caçambas' },
  ];

  /* Mordida da Bagger: fração enterrada -> multiplicador (GDD §3) */
  D.MORDIDA = { empty: 0.3, lo: 0.4, hi: 0.7, stall: 0.85, mEmpty: 0.6, mPerfect: 1.5, loK: 0.35, hiK: 0.75, mPerfectK: 1.6, x3Chance: 0.25, x3After: 3 };
  D.HAUL = { crown: 1.25 };                    // carga coroada (100-115%)
  D.CART = { crownChance: 1 / 8, crownMult: 1.25 };

  /* ---------------- materiais e bolsões ---------------- */
  D.MATS = [
    { id: 'solto', name: 'Arroz Solto', d0: 0, d1: 150, hard: 1, val: 1, slope: 3.6, col: '#F6F1E4', tex: 'loose' },
    { id: 'prensado', name: 'Arroz Integral', d0: 150, d1: 600, hard: 2.5, val: 1.6, slope: 6, col: '#D8BF93', tex: 'pressed' },
    { id: 'mochi', name: 'ARROZ NEGRO', d0: 600, d1: 1e9, hard: 8, val: 3.5, slope: 9, col: '#5A4565', tex: 'loose' },   // id 'mochi' fica (saves antigos); era mochi rosa, parecia rocha
    { id: 'koshi', name: 'Núcleo Koshihikari', ellipse: { cx: 4900, cy: 0, rx: 1150, ry: 900 }, hard: 24, val: 6, slope: 12, col: '#E8B93A', tex: 'gold' },
  ];
  D.POCKETS = { n: 28, r: [35, 90], mult: 8, minDepth: 60 };
  // ITENS (fase 0 do PLANO-100H; game/items.js): cada material da montanha vira um item no Armazém. 1 saco = ITEM_AREA px².
  // Material de ilha sem item aqui vira item automático. Produtos da fábrica (onigiri, mochi...) entram aqui na fase 1.
  D.ITEM_AREA = 100;
  D.ITEMS = [
    { id: 'arroz', n: 'Arroz solto', d: 'o de todo dia', val: 1, mat: 'solto', icon: 'rice' },
    { id: 'integral', n: 'Arroz integral', d: 'prensado, mais firme', val: 1.6, mat: 'prensado', icon: 'rice' },
    { id: 'negro', n: 'Arroz negro', d: 'do fundo da montanha', val: 3.5, mat: 'mochi', icon: 'rice' },
    { id: 'koshi', n: 'Koshihikari', d: 'o núcleo dourado', val: 6, mat: 'koshi', icon: 'star' },
    // produtos da Fábrica (Cardápio): entram no Armazém como contador quando a fábrica faz
    { id: 'cozido', n: 'Arroz Cozido', d: 'fofinho, ainda soltando vapor', val: 2, icon: 'rice', fab: true },
    { id: 'onigiri', n: 'Onigiri', d: 'o triângulo que move o Japão', val: 4, icon: 'onigiri', fab: true },
    { id: 'mochi', n: 'Mochi', d: "batido no pilão com muito esforço e um 'yoisho!'", val: 12, icon: 'star', fab: true },
    { id: 'mochi_dourado', n: 'Mochi Dourado', d: 'dizem que dá sorte. dizem que dá MUITA sorte', val: 48, icon: 'star', fab: true },
  ];

  /* ---------------- FÁBRICA (docs/design/fabrica.md, aprovada; game/fabrica.js) ----------------
     Valores em "× 1 item cru". Cada item que a Doca puxa vale (renda de cavar/s × pct) / (itens/s da doca): assim a fábrica
     acompanha o jogo do começo ao fim. O cru já foi pago ao cavar: vender paga só o que o produto vale A MAIS (val - base).
     Preços em segundos de renda (G.priceIps). */
  D.FAB = {
    beltSpeed: 2, priceK: 3.0,   // priceK: calibrado no tools/fabrica-sim.js (a tabela abaixo é a da spec)
    // doca: price/costGrow = preço do nível (price × costGrow^nível, em s de renda × priceK). É ela que manda na fatia da renda.
    dock: { pct0: 0.025, pctLvl: 0.035, pctMax: 0.25, items0: 1, itemsGrow: 1.4, price: 55, costGrow: 1.25 },   // items0 1 = a Panela grátis dá conta sozinha
    // nível de máquina = tapa-buraco (resposta do designer de 17/11): preço = min(preço da máquina, cap) × base × cost^nível.
    // cost 1,25 e base 0,45: o 1º nível custa ~56% da máquina e sempre tem um nível comprável em ≤ 180 s; cap 45: o Pilão não
    // cobra 6× mais que a Panela por nível. Conferir com `node tools/fabrica-sim.js --runs 8`.
    lvl: { speed: 0.25, cost: 1.25, base: 0.45, cap: 45, max: 10 },
    selo: { val: 0.5, cost: 3 },   // Selo de Qualidade (sem teto): +50% no valor por estrela; níveis daquela máquina ×3 por estrela
    unlock: { pilao: 1000, dourado: 20 },   // 1000 onigiris ≈ 12–15 min (era 600 com o preço-base inflado do começo; ver PASSAGEM)
    items: { raw: { val: 1, base: 1 }, gold: { val: 6, base: 6 }, cozido: { val: 2, base: 1 }, onigiri: { val: 4, base: 1 },
      mochi: { val: 12, base: 2 }, mochid: { val: 48, base: 8 } },
    machines: {
      panela: { len: 1, price: 40, recipes: [{ in: { raw: 1 }, out: 'cozido', time: 1.0 }] },
      moldadora: { len: 1, price: 45, recipes: [{ in: { cozido: 1 }, out: 'onigiri', time: 1.0 }] },
      pilao: { len: 2, price: 240, recipes: [{ in: { cozido: 2 }, out: 'mochi', time: 3.5 }, { in: { cozido: 2, gold: 1 }, out: 'mochid', time: 4.5 }] },
      divisor: { len: 1, price: 0, recipes: [] },
    },
  };

  /* ---------------- combo, sacos, onigiri ---------------- */
  D.COMBO = { max: 30, cap: 1.5, gain: 2.5, idle: 0.45, decay: 12, furiaHold: 10, furiaSec: 5, furiaMult: 2 };
  D.SACK = { every: 20, jitter: [0.5, 1.5], life: 12, worthSec: 1.0, vary: [0.8, 1.2],
    gacha: [{ m: 0.5, p: 0.20, kind: 'plain', shake: 1.0 }, { m: 1.2, p: 0.55, kind: 'plain', shake: 1.0 }, { m: 3, p: 0.20, kind: 'golden', shake: 1.5 }, { m: 10, p: 0.05, kind: 'legendary', shake: 2.5 }] };
  D.ONIGIRI = { every: [45, 70], worthSec: 8, worthSec2: 12, life: 9 };
  D.STOMP = { every: 6, worthSec: 1.2, radMul: 3 };

  /* ---------------- coletor (pra onde o arroz vai), por degrau ---------------- */
  D.COLLECTOR = ['cesto', 'cesto', 'saco', 'barraca', 'barraca', 'barraca', 'kei', 'kei', 'kei', 'silo', 'silo', 'moega', 'moega', 'moega'];
  D.PAY_DELAY = [0.3, 0.6];

  /* ---------------- casa ---------------- */
  D.HOUSE = [
    { id: 'h1', n: 'Terreno', c: 200000, tier: 7, perk: { help: 1 }, draw: 'placa VENDIDO, corda, bandeirinha; um shiba novo sai do terreno' },
    { id: 'h2', n: 'Fundação', c: 3000000, tier: 10, perk: { sell: 1.25 }, draw: 'laje, estacas, betoneira, pegada do Kome' },
    { id: 'h3', n: 'Estrutura de Hinoki', c: 9000000, tier: 12, perk: { offCap: 4 }, draw: 'esqueleto de madeira, paredes shoji, engawa' },
    { id: 'h4', n: 'Telhado Kawara', c: 75000000, tier: 13, perk: { nightGlow: 1 }, draw: 'telhas azul-cinza, lanterna acesa' },
    { id: 'h5', n: 'Jardim com Lago de Carpas', c: 115000000, tier: 13, perk: { sell: 1.3 }, draw: 'lago com nishikigoi, tōrō, ponte, momiji' },
    { id: 'h6', n: 'Onsen', c: 105000000, teaser: 55000000, tier: 13, perk: { end: 1 }, draw: 'rotenburo, vapor, capivara hóspede' },
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
 {id:'c_spd',n:'Patas Ligeiras',c:1200,branch:'colheita',pos:{x:-1.0,y:-2.5},req:['c1'],tier:4,size:0,fx:{spd:1.2,dig:1.15},
   see:'Kome corre com rastro de 3 afterimages e poeirinha nos pés'},
 {id:'cA',n:'Almofadinhas Calejadas',c:5100,branch:'colheita',pos:{x:0.0,y:-3.8},req:['c3'],tier:5,size:0,fx:{dig:1.1},
   see:'animação de uso 10% mais rapida; +2 grãos por batida no jato'},
 {id:'c_reach',n:'Braço Comprido',c:11000,branch:'colheita',pos:{x:-1.0,y:-3.8},req:['c_spd'],tier:6,size:0,fx:{reach:1.15},
   see:'cabo/braco/lança da ferramenta desenhado 15% mais longo'},
 {id:'c6',n:'Kome Workaholic',c:20000,branch:'colheita',pos:{x:1.0,y:-3.8},req:['c3'],tier:6,size:1,fx:{auto:0.4},
   see:'solto o dedo, Kome continua cavando sozinho com olheiras e uma gota de suor'},
 {id:'cB',n:'Diesel Premium',c:54000,branch:'colheita',pos:{x:0.0,y:-5.0},req:['cA'],tier:7,size:0,fx:{dig:1.1},
   see:'fumaça do escape vira azul e mais densa; motor sobe meio tom'},
 {id:'c6b',n:'Workaholic II',c:320000,branch:'colheita',pos:{x:2.0,y:-4.4},req:['c6'],tier:9,size:0,fx:{auto:0.7},
   see:'quando você solta, o Kome cava sozinho a 70%; duas gotas de suor'},
 {id:'c6c',n:'Kome Incansável',c:4500000,branch:'colheita',pos:{x:2.0,y:-6.2},req:['c6b'],tier:12,size:1,fx:{auto:1},
   see:'cava sozinho no ritmo cheio, de faixa na cabeça'},
 {id:'combo1',n:'Ritmo de Taiko',c:81000,branch:'colheita',pos:{x:1.0,y:-5.0},req:['c6'],tier:7,size:1,fx:{comboCap:1.75},
   see:'barra de combo ganha 2º segmento; taiko entra na música acima de x1,5'},
 {id:'cC',n:'Lâminas Afiadas',c:180000,branch:'colheita',pos:{x:0.0,y:-6.2},req:['cB'],tier:8,size:0,fx:{dig:1.1},
   see:'brilho "ting" percorre a lâmina/garfo/dente a cada 4 s; corte solta faíscas brancas'},
 {id:'c7',n:'Fúria do Kome',c:810000,branch:'colheita',pos:{x:1.0,y:-6.2},req:['combo1'],tier:10,size:2,fx:{furia:1.33},
   see:'KEYSTONE: 10 s em combo max -> 5 s de iene x2: Kome uiva, aura vermelha, tela com speedlines'},
 {id:'cD',n:'Turbo Intercooler',c:540000,branch:'colheita',pos:{x:0.0,y:-7.5},req:['cC'],tier:10,size:0,fx:{dig:1.12},
   see:'turbina visível no capô girando; apito de turbo ao segurar'},
 {id:'c8',n:'Combo Mestre',c:2600000,branch:'colheita',pos:{x:1.0,y:-7.5},req:['c7'],tier:11,size:1,fx:{comboCap:2},
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
 {id:'m7a',n:'Selo Premium',c:700000,branch:'comercio',pos:{x:6.3,y:-1.0},req:['m5'],tier:10,size:0,fx:{val:1.12},
   see:'camada integral ganha brilho perolado; pops de integral/negro com selo vermelho'},
 {id:'m_e',n:'Ekiben de Estação',c:970000,branch:'comercio',pos:{x:6.8,y:-3.3},req:['m5'],tier:10,size:0,fx:{sell:1.15},
   see:'plataforma de estação com quiosque de ekiben ao lado do trilho'},
 {id:'m8',n:'Trem de Arroz',c:1600000,branch:'comercio',pos:{x:8.3,y:-2.7},req:['m_d'],tier:10,size:2,fx:{sell:1.3},
   see:'KEYSTONE: trem (loco + 3 vagões) cruza o fundo a cada 20 s; tocar o apito na passagem = +3 s de renda'},
 {id:'m7b',n:'Selo Ouro',c:1700000,branch:'comercio',pos:{x:7.4,y:-1.4},req:['m7a'],tier:11,size:0,fx:{val:1.12},
   see:'mochi ganha veios dourados; estilhacos de mochi brilham'},
 {id:'m_f',n:'Exportação',c:2300000,branch:'comercio',pos:{x:8.0,y:-3.7},req:['m_e'],tier:11,size:0,fx:{sell:1.15},
   see:'contêineres coloridos empilhados no pátio, guindaste portuário pequeno'},
 {id:'m9',n:'Destilaria de Sake',c:3400000,branch:'comercio',pos:{x:9.5,y:-3.1},req:['m8'],tier:11,size:0,fx:{sell:1.15},
   see:'destilaria com barris komodaru; tanuki bêbado dorme na porta'},
 {id:'m11',n:'Porto de Niigata',c:6500000,branch:'comercio',pos:{x:9.2,y:-4.0},req:['m_f'],tier:12,size:0,fx:{sell:1.15},
   see:'navio cargueiro no horizonte recebe o trem; gaivotas'},
 {id:'m10',n:'Marca "Kome no Japão"',c:42000000,branch:'comercio',pos:{x:10.7,y:-3.5},req:['m9','m11'],tier:13,size:1,fx:{sell:1.25},
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
 {id:'a9',n:'Esteira',c:1200000,branch:'equipe',pos:{x:3.6,y:6.7},req:['e3'],tier:10,size:1,fx:{hv:1.3},
   see:'esteira do pé da montanha ao silo com grãos rolando'},
 {id:'e4',n:'Capacetes',c:1300000,branch:'equipe',pos:{x:4.5,y:4.5},req:['a6'],tier:11,size:0,fx:{hm:1.11},
   see:'todos os ajudantes de capacete amarelo e colete refletivo'},
 {id:'a10',n:'Capatazes',c:3000000,branch:'equipe',pos:{x:4.4,y:6.1},req:['a8'],tier:11,size:0,fx:{help:1},
   see:'capataz em mini-escavadeira amarela'},
 {id:'e5',n:'Rádio da Obra',c:3600000,branch:'equipe',pos:{x:4.3,y:7.7},req:['a9','a10'],tier:12,size:0,fx:{hv:1.15},
   see:'antena no pátio; balões "copiado!" e enka baixinho no rádio'},
 {id:'p1',n:'Piloto pro Trator',c:210000,branch:'maquinas',pos:{x:-0.7,y:1.0},req:[],tier:8,size:1,fx:{pilot:'trator'},
   see:'Goma sobe no trator estacionado e empurra ondas sozinha (placa PRECISA-SE some)'},
 {id:'p1b',n:'Piloto pra Colheitadeira',c:380000,branch:'maquinas',pos:{x:0.2,y:2.0},req:['p1'],tier:10,size:1,fx:{pilot:'colheita'},
   see:'um shiba assume a colheitadeira no pátio'},
 {id:'p2',n:'Piloto pra Empilhadeira',c:590000,branch:'maquinas',pos:{x:-1.5,y:2.0},req:['p1'],tier:10,size:1,fx:{pilot:'empilhadeira'},
   see:'Kuro pilota a empilhadeira e empilha paletes no pátio'},
 {id:'p3',n:'Piloto pra Escavadeira',c:2000000,branch:'maquinas',pos:{x:-2.2,y:3.0},req:['p2'],tier:11,size:1,fx:{pilot:'escav'},
   see:'Shiro opera a escavadeira num terraço próprio'},
 {id:'e2a',n:'Oficina',c:1400000,branch:'maquinas',pos:{x:-3.0,y:2.4},req:['p2'],tier:11,size:0,fx:{pm:1.15},
   see:'galpao-oficina; máquinas pilotadas ganham pintura nova e brilho'},
 {id:'bg1',n:'Projeto Bagger 1/3: Esteiras',c:6300000,branch:'maquinas',pos:{x:-2.1,y:4.6},req:['p3'],tier:12,size:1,fx:{part:1},
   see:'comboio traz as 3 esteiras; guindastes e soldadores no pátio'},
 {id:'p4',n:'Piloto pro Caminhão',c:4700000,branch:'maquinas',pos:{x:-2.9,y:4.0},req:['p3'],tier:12,size:1,fx:{pilot:'caminhao'},
   see:'2 caminhões amarelos de shibas entram no ciclo; a pá de cabo nunca para'},
 {id:'e2b',n:'Turno da Noite',c:4200000,branch:'maquinas',pos:{x:-3.7,y:3.5},req:['e2a'],tier:12,size:0,fx:{pm:1.13},
   see:'torres de luz; faróis e giroflex nas máquinas pilotadas à noite'},
 {id:'bg2',n:'Projeto Bagger 2/3: Torre e Contrapeso',c:8500000,branch:'maquinas',pos:{x:-2.9,y:5.6},req:['bg1'],tier:12,size:1,fx:{part:1},
   see:'torre e contrapeso sobem; silhueta já tapa o sol da tarde'},
 {id:'b0',n:'Buzina',c:293,branch:'maquinas',pos:{x:-3.6,y:6.7},req:['bg2'],tier:13,size:0,fx:{horn:1},
   see:'botão BUZINA: onda de choque visível, corvos e shibas pulam'},
 {id:'p5',n:'Frota da Pá de Cabo',c:11000000,branch:'maquinas',pos:{x:-3.7,y:5.1},req:['p4'],tier:13,size:1,fx:{pilot:'pacabo'},
   see:'o 797 do Kome entra na frota com Pochi no volante (só se vê o capacete)'},
 {id:'b1',n:'Roda Turbo',c:8400000,branch:'maquinas',pos:{x:-4.3,y:7.7},req:['b0'],tier:13,size:0,fx:{dig:1.2},
   see:'roda gira 20% mais rápido; caçambas viram borrão, "tchac" mais agudo'},
 {id:'b2',n:'Lança Longa',c:10000000,branch:'maquinas',pos:{x:-4.4,y:6.1},req:['b0'],tier:13,size:0,fx:{boom:1.3},
   see:'lança estica de 560 pra 730 px com treliça nova'},
 {id:'bK',n:'Mordida Perfeita+',c:14000000,branch:'maquinas',pos:{x:-5.9,y:8.1},req:['b1','b2'],tier:13,size:2,fx:{mordida:1},
   see:'KEYSTONE: faixa perfeita 0,35-0,75 e x1,6; arco fica dourado e 3 perfeitas seguidas disparam "x3 NESTA MORDIDA"'},
 {id:'b3',n:'Caçambas de Titânio',c:18000000,branch:'maquinas',pos:{x:-5.1,y:8.7},req:['b1'],tier:13,size:1,fx:{powMul:1.5,titan:1},
   see:'caçambas azul-titânio; o Núcleo Koshihikari solta lascas douradas a 100%'},
 {id:'b4',n:'Esteira Tronco Dupla',c:24000000,branch:'maquinas',pos:{x:-6.0,y:6.5},req:['b2','a9'],tier:13,size:0,fx:{sell:1.15},
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
 {id:'s9',n:'Onigiri Duplo',c:430000,branch:'sorte',pos:{x:-4.4,y:-2.5},req:['s3'],tier:10,size:0,fx:{oni:0.12},
   see:'onigiris passam em dupla; o segundo é de ume com ponto vermelho'},
 {id:'s10',n:'Veio de Ouro',c:810000,branch:'sorte',pos:{x:-5.9,y:-1.9},req:['s7'],tier:10,size:0,fx:{gold:12},
   see:'bolsões ligados por veios dourados visíveis no corte da montanha'},
 {id:'s11',n:'Chá da Obaa-san',c:590000,branch:'sorte',pos:{x:-5.6,y:-2.9},req:['s9'],tier:10,size:0,fx:{vis:0.05},
   see:'mesinha de chá no pátio; visitantes ficam +5 s e pagam mais'},
 {id:'s12',n:'DESLIZAMENTO!',c:1200000,branch:'sorte',pos:{x:-6.3,y:-1.0},req:['s8'],tier:11,size:1,fx:{slide:1},
   see:'avalanche >40.000 px² vira evento: banner, câmera treme, iene x1,5 por 3 s'},
  ];

  /* a britadeira entrou no degrau 7: os tiers do GDD de 7 pra cima sobem 1 */
  D.TIER_SHIFT_FROM = 7;
  for (const n of D.TREE) if (n.tier >= D.TIER_SHIFT_FROM) n.tier += 1;
  for (const h of D.HOUSE) if (h.tier >= D.TIER_SHIFT_FROM) h.tier += 1;
  /* achados enterrados (adendo §7): saem dos bolsões de ouro; só enfeite, sem efeito no jogo */
  D.CLOSET = [
    { id: 'kin', kind: 'pal', n: 'Kome Dourado', d: 'pelo dourado e chapéu vermelho' },
    { id: 'sakura', kind: 'pal', n: 'Kome Sakura', d: 'chapéu rosa de cerejeira' },
    { id: 'matcha', kind: 'pal', n: 'Kome Matcha', d: 'chapéu verde de chá' },
    { id: 'yuki', kind: 'pal', n: 'Kome da Neve', d: 'pelo branquinho e gorro vermelho' },
    { id: 'sumi', kind: 'pal', n: 'Kome Carvão', d: 'pelo cinza de mineiro' },
    { id: 'oculos', kind: 'acc', n: 'Óculos Escuros', d: 'estilo de operador de Bagger' },
    { id: 'cachecol', kind: 'acc', n: 'Cachecol Vermelho', d: 'balança quando ele corre' },
    { id: 'flor', kind: 'acc', n: 'Flor de Sakura', d: 'presa atrás da orelha' },
    { id: 'aka', kind: 'pal', n: 'Kome Ruivo', d: 'pelo vermelho-raposa' },
    { id: 'cha', kind: 'pal', n: 'Kome Chocolate', d: 'pelo marrom e chapéu de palha velho' },
    { id: 'coroa', kind: 'acc', n: 'Coroa de Ouro', d: 'rei da montanha de arroz' },
    { id: 'bandana', kind: 'acc', n: 'Bandana Azul', d: 'de quem cava o dia inteiro' },
    { id: 'gorro', kind: 'acc', n: 'Gorro de Lã', d: 'quentinho, com pompom' },
    { id: 'laco', kind: 'acc', n: 'Laço Vermelho', d: 'fofura máxima' },
    { id: 'capa', kind: 'acc', n: 'Capa de Herói', d: 'tremula quando ele corre' },
    // só aparecem enterradas na ilha delas (coleção longa)
    { id: 'kuro', kind: 'pal', n: 'Kome de Hokkaido', d: 'pelo preto e caramelo (só em Hokkaido)', island: 1 },
    { id: 'goma', kind: 'pal', n: 'Kome do Vulcão', d: 'pelo cinza de cinzas (só em Kyushu)', island: 2 },
    { id: 'shiro', kind: 'pal', n: 'Kome da Praia', d: 'pelo branquinho e chapéu azul (só em Okinawa)', island: 3 },
    { id: 'momo', kind: 'pal', n: 'Kome Mochi', d: 'pelo rosinha e chapéu de matchá (só na Ilha de Mochi)', island: 4 },
    // prêmio do Grande Final (volta ao Japão completa): não aparece cavando
    { id: 'nihon', kind: 'pal', n: 'Kome Hinomaru', d: 'branco com o sol vermelho: deu a volta ao Japão', prize: 1 },
  ];
  // casa do Kome (etapa 3): enfeites, bichinhos e temas. Só visual; preço = segundos da renda atual (sec × ¥/s), então sempre dá pra comprar algo.
  D.DECOR = [
    { id: 'flores', kind: 'decor', n: 'Canteiro de flores', d: 'tanpopo, íris e ajisai', sec: 30 },
    { id: 'lanterna', kind: 'decor', n: 'Lanterna de pedra', d: 'acende sozinha à noite', sec: 45 },
    { id: 'pedras', kind: 'decor', n: 'Pedras com musgo', d: 'jardim zen', sec: 40 },
    { id: 'bonsai', kind: 'decor', n: 'Bonsai', d: 'o Kome poda todo domingo', sec: 70 },
    { id: 'sino', kind: 'decor', n: 'Sino de vento', d: 'fūrin que canta na brisa', sec: 60 },
    { id: 'sakura', kind: 'decor', n: 'Cerejeira', d: 'pétalas caindo o ano todo', sec: 110 },
    { id: 'momiji', kind: 'decor', n: 'Bordo vermelho', d: 'momiji de outono', sec: 110 },
    { id: 'bambu', kind: 'decor', n: 'Bambuzal', d: 'balança com o vento', sec: 90 },
    { id: 'koinobori', kind: 'decor', n: 'Koinobori', d: 'carpas de pano no mastro', sec: 130 },
    { id: 'lago', kind: 'decor', n: 'Lago', d: 'com vitórias-régias', sec: 200 },
    { id: 'torii', kind: 'decor', n: 'Torii', d: 'portal vermelho no quintal', sec: 240 },
    { id: 'onsen', kind: 'decor', n: 'Onsen', d: 'banho quente de pedras', sec: 320 },
    { id: 'carpas', kind: 'pet', n: 'Carpas', d: 'nadam no lago (precisa do Lago)', sec: 150, needs: 'lago' },
    { id: 'borboletas', kind: 'pet', n: 'Borboletas', d: 'visitam as flores', sec: 50 },
    { id: 'passaros', kind: 'pet', n: 'Passarinhos', d: 'revoada no céu', sec: 60 },
    { id: 'vagalumes', kind: 'pet', n: 'Vaga-lumes', d: 'piscam no quintal', sec: 90 },
    { id: 'capivara', kind: 'pet', n: 'Capivara', d: 'de molho no onsen (precisa do Onsen)', sec: 200, needs: 'onsen' },
    { id: 'goma', kind: 'pet', n: 'Amigo Goma', d: 'shiba cinza que vem brincar', sec: 160, pal: 'goma' },
    { id: 'kuro', kind: 'pet', n: 'Amiga Kuro', d: 'shiba preta e caramelo', sec: 220, pal: 'kuro' },
    { id: 'shiro', kind: 'pet', n: 'Amigo Shiro', d: 'shiba branco de chapéu azul', sec: 280, pal: 'shiro' },
  ];
  D.decorById = {}; D.DECOR.forEach(x => { D.decorById[x.id] = x; });
  // temas de fundo: valem pra casa e pro jogo (o que cai do céu e a cor do dia)
  D.THEMES = [
    { id: 'verao', n: 'Verão', d: 'céu limpo', sec: 0, fall: null, tint: null },
    { id: 'primavera', n: 'Primavera', d: 'pétalas de sakura caindo', sec: 90, fall: 'petal', tint: 'rgba(255,200,220,0.10)' },
    { id: 'outono', n: 'Outono', d: 'folhas de momiji no vento', sec: 120, fall: 'leaf', tint: 'rgba(255,160,60,0.12)' },
    { id: 'inverno', n: 'Inverno', d: 'neve fofinha', sec: 150, fall: 'snow', tint: 'rgba(200,225,255,0.16)' },
  ];
  D.themeById = {}; D.THEMES.forEach(x => { D.themeById[x.id] = x; });
  // aplica o BOOST: ferramenta do degrau i+1 é paga no degrau i; nós e casas de tier t ficam à venda a partir do degrau t-1
  (function () {
    const B = D.ECON.BOOST, b = i => { const k = Math.max(0, Math.min(B.length - 1, i)); return B[k] * (k >= 7 ? 1.12 : 1); };   // 1,12: segura o meio da partida no ritmo antigo
    D.TOOLS.forEach((t, i) => { if (i > 0) t.cost = Math.round(t.cost * b(i - 1)); });
    D.TREE.forEach(n => { if (n.tier) { n.c = Math.round(n.c * b(n.tier - 1)); } });
    D.HOUSE.forEach(h => { const k = b(h.tier - 1); h.c = Math.round(h.c * k); if (h.teaser) h.teaser = Math.round(h.teaser * k); });
  })();
  // fim de jogo (volta ao Japão): números das ilhas. Medalhas por tempo (min) em cada ilha, na ordem de D.ISLANDS
  // (Honshu é a campanha). Eventos de ilha: um por ilha, a cada `every` s depois da `minTool`. Preço das ilhas: `price` (por viagem,
  // ver abaixo; volta 2+ continua contando viagem). `legend` = renda extra pra sempre depois do Grande Final.
  D.ENDGAME = {
    seedGrow: 1.45, patioExp: 0.15,   // camada Cookie: custo das sementes ×1,45/nível; Sementes do Pátio ^0,15
    // medalhas (min) por ilha, item 6 (19/11), da régua de 100 h (docs/medicoes/longo100-item6.txt): ouro = o quartil mais rápido do
    // robô guloso naquela ilha (desafio de verdade), prata = mediana do robô + ~35% (confortável). Os tempos do robô ficam iguais
    // em todas as voltas (preço por viagem), então não encolhe por volta. Honshu (0) vale pra Honshu das voltas 2+ (~30–37 min):
    // a campanha (60–90 min, nota S/A/B/C própria) fica no bronze e a Honshu da volta 2 é a chance de prata/ouro.
    medal: { ouro: [31, 28, 24, 29, 33], prata: [45, 40, 35, 40, 47], seeds: { bronze: 0, prata: 2, ouro: 5 } },
    ev: { every: [170, 240], first: 120, minTool: 3 },
    // preço das ilhas (islands.js · priceMul) pela viagem t (1 = Hokkaido da 1ª volta … 5 = Honshu da volta 2): trip[t-1], depois
    // + grow por viagem; × 0,94^Amigo do Corretor. A campanha (t = 0) fica 1. Item 6 (19/11): antes 1 + 0,4n + 0,15n² (n = ilha +
    // volta) dava ilhas de 14–19 min na volta 1–7 (dinheiro inicial + sementes compravam tudo em 2 min e o resto era só cavar).
    price: { trip: [3.5, 17, 27, 32, 38], grow: 0.3 },
    legend: 2,
  };
  /* ---------------- CIDADE (docs/design/cidade.md; sistema game/cidade.js) ----------------
     A fábrica manda `share` dos onigiris/mochis vendidos pra Despensa da Vila (o resto vende na doca como sempre; Despensa
     cheia = vende tudo na doca: nada se perde). Pedidos pagam ORDER_PAY × o valor do produto na doca; lojas compram o que passa
     de SHOP_LINE da despensa por SHOP_PAY ×. Tempos em segundos de jogo. cap e pedido = segundos do ritmo que chega na despensa. */
  D.CITY = {
    share: 0.4,                          // fatia "Vila" da Doca de Venda (onigiri, mochi, mochi dourado)
    start: { arroz: 30 },                // presente da abertura: 1ª entrega na hora
    OPEN_EARN: 5000,                     // a Cidade abre CEDO: quando você já ganhou isso no total (ou no 1º produto da fábrica)
    ARROZ_RATE: 0.5, ARROZ_SEC: 0.12,    // a montanha manda sacos pra Despensa (por s); saco vale ARROZ_SEC s da renda → entregue ×ORDER_PAY ≈ 7% de bônus (era 50%)
    BUILD_RENDA: 1,                      // cada prédio pronto: +1% de renda pra sempre (soma no Arroz do Coração, igual à amizade)
    ITEMS: {
      arroz: { nome: 'saco', plural: 'sacos', capMin: 60, qMin: 8 },
      onigiri: { nome: 'onigiri', plural: 'onigiris', capMin: 40, qMin: 6 },
      mochi: { nome: 'mochi', plural: 'mochis', capMin: 12, qMin: 3 },
      mochid: { nome: 'mochi dourado', plural: 'mochis dourados', capMin: 4, qMin: 1 },
    },
    CAP_SEC: 300,                        // teto da despensa: 5 min do que chega
    ORDER_SEC: [70, 110],                // pedido ≈ 90 s do que chega daquele item
    ORDER_PAY: 1.2, ORDER_GAP: 90, SENTO_GAP: 0.5, FAV_CHANCE: 0.6,
    HEART_LV: [4, 9, 15, 22, 30, 40], HEART_STEP: 10,  // corações por nível de amizade (depois do último: +HEART_STEP)
    BUILD_SEC: [150, 1800],              // obra (UMA de cada vez: um carpinteiro só): 1º prédio 2,5 min → 30 min a partir do 10º
    SHOP_EVERY: 6, SHOP_LINE: 0.55, SHOP_PAY: 1.1,
    FEST_NEED: 150, FEST_SEC: 240, FEST_HEART: 2, TEMPLO_FEST: 1.5,
    LOTS: 10, LOTS2: 6,                  // 1º quarteirão (6 casas + 4 terrenos) e o 2º, que abre quando o 1º lota
    RES: [   // moradores: id, nome, paleta do shiba, chapéu, prato favorito, lote, arte da casa, profissão, falas, 2 prédios dos sonhos
      { id: 'kiku', nome: 'Vó Kiku', pal: 'goma', hat: false, fav: 'mochi', lot: 0, art: 'cid_casa_kiku', job: 'aposentada, rainha do karaokê',
        fala: ['No meu tempo o mochi era batido na mão!', 'Kome, tá comendo direito?', 'Hoje tem karaokê, hein.'], build: ['chaya', 'mochiya'] },
      { id: 'taro', nome: 'Taro', pal: 'aka', hat: true, fav: 'onigiri', lot: 1, art: 'cid_casa_taro', job: 'entregador de bicicleta',
        fala: ['Pedalei 40 km hoje. Fome.', 'Onigiri é combustível.', 'Corrida até a praça?'], build: ['onigiriya', 'sento'] },
      { id: 'hana', nome: 'Hana', pal: 'sakura', hat: false, fav: 'mochi', lot: 3, art: 'cid_casa_hana', job: 'florista, planeja piqueniques',
        fala: ['As cerejeiras vão abrir!', 'Piquenique sem mochi não existe.', 'Trouxe flores pra rua.'], build: ['casa_kuro', 'chaya'] },
      { id: 'genji', nome: 'Sr. Genji', pal: 'sumi', hat: true, fav: 'onigiri', lot: 4, art: 'cid_casa_genji', job: 'pescador (o peixe sempre cresce na história)',
        fala: ['Pesquei um atum DESTE tamanho.', 'Onigiri de salmão, só pra constar.', 'O mar tá calmo hoje.'], build: ['bentoya', 'templo'] },
      { id: 'yuki', nome: 'Yuki', pal: 'yuki', hat: false, fav: 'onigiri', lot: 6, art: 'cid_casa_yuki', job: 'streamer, joga até as 4 da manhã',
        fala: ['Live de 12 horas, preciso de onigiri.', 'GG, Kome.', 'Bati meu recorde de speedrun!'], build: ['fliperama', 'konbini'] },
      { id: 'momo', nome: 'Momo', pal: 'momo', hat: false, fav: 'mochi', lot: 7, art: 'cid_casa_momo', job: 'confeiteira perfeccionista',
        fala: ['Esse mochi tá 2% fora do ponto.', 'Sonho com uma loja só minha.', 'Doce é ciência.'], build: ['mochiya', 'casa_kuro'] },
      { id: 'kuro', nome: 'Kuro', pal: 'kuro', hat: false, fav: 'onigiri', lot: -1, art: 'cid_casa_kuro', job: 'músico de rua',
        fala: ['Compus uma música pro onigiri.', 'Toco na praça no festival!', 'A rua tem ritmo.'], build: ['fliperama', 'sento'] },
      { id: 'matcha', nome: 'Monge Matcha', pal: 'matcha', hat: true, fav: 'mochid', lot: -1, art: 'cid_templo', job: 'monge do templo, ri de tudo',
        fala: ['Paz, Kome. E mochi dourado.', 'O sino toca no festival.', 'Respira... e come.'], build: ['templo', 'bentoya'] },
    ],
    // TUDO construído (9 prédios): venda +15%, cavar +8%, renda +9% (+1%/nível de amizade), combo 25% mais lento, +2 h fora ≈ ×1,35 no máximo (era ≈ ×1,8)
    BUILD: {   // o que a amizade abre (1 de 2 por nível): loja = compra o que sobra · heart = +1 ♥ nos pedidos daquele prato · gap = pedidos mais rápidos · mora = morador novo
      // perk = bônus NO JOGO PRINCIPAL (G.City.applyStats/offH): sell/dig = +% · combo = combo cai X% mais devagar · offH = +h de tempo fora. fx = a frase
      onigiriya: { nome: 'Onigiri-ya', art: 'lojinha_onigiri', loja: ['onigiri'], perk: { sell: 0.02 }, fx: 'Arroz vende +2% · compra o onigiri que sobra' },
      mochiya: { nome: 'Mochiya', art: 'loja_mochiya', loja: ['mochi', 'mochid'], perk: { sell: 0.02 }, fx: 'Arroz vende +2% · compra o mochi que sobra' },
      bentoya: { nome: 'Bentô-ya', art: 'cid_bentoya', loja: ['onigiri', 'mochi'], perk: { sell: 0.02 }, fx: 'Arroz vende +2% · monta bentô com o que sobra' },
      konbini: { nome: 'Konbini', art: 'loja_konbini', loja: ['onigiri', 'mochi', 'mochid'], perk: { sell: 0.04 }, fx: 'Arroz vende +4% · compra de tudo que sobra' },
      chaya: { nome: 'Casa de Chá', art: 'cid_chaya', heart: 'mochi', perk: { offH: 2 }, fx: 'Rende +2 h a mais com o jogo fechado' },
      fliperama: { nome: 'Fliperama', art: 'cid_fliperama', heart: 'onigiri', perk: { combo: 0.25 }, fx: 'Combo de cavar cai 25% mais devagar' },
      sento: { nome: 'Sentô', art: 'cid_sento', gap: 1, perk: { dig: 0.05 }, fx: 'Cava +5% de arroz · pedidos 2× mais rápidos' },
      casa_kuro: { nome: 'Casa nova', art: 'cid_casa_kuro', mora: 'kuro', perk: { dig: 0.03 }, fx: 'Kuro toca música: cava +3% de arroz' },
      templo: { nome: 'Templo', art: 'cid_templo', mora: 'matcha', fest: 1, perk: { sell: 0.05 }, fx: 'Arroz vende +5% · festival enche +50%' },
    },
    SEASONS: [
      { nome: 'Primavera', fest: 'Hanami', tree: 'sakura', grass: '#8FAE62', sub: 'piquenique debaixo das cerejeiras' },
      { nome: 'Verão', fest: 'Hanabi', tree: 'round', grass: '#7F9E5C', sub: 'fogos de artifício na praça' },
      { nome: 'Outono', fest: 'Tsukimi', tree: 'maple', grass: '#A3A35A', sub: 'lua cheia e colheita' },
      { nome: 'Inverno', fest: 'Shōgatsu', tree: 'pine', grass: '#DCE4E8', sub: 'ano-novo com mochitsuki' },
    ],
  };

  /* ---------------- MISSÕES (game/missoes.js: jornada, missões rápidas, missões da ilha) ----------------
     Só NÚMEROS aqui (os textos e as condições moram na tabela do missoes.js). Prêmio em SEGUNDOS da renda de agora
     (¥/s), com piso em ienes. Nada expira, nada falha. Metas do playtest --auto continuam valendo (final 60–90 min):
     se a campanha encurtar, baixar `jornada.sec` / `cap.sec` primeiro. */
  D.MISSOES = {
    piso: 30,                              // prêmio mínimo em ¥ (começo do jogo, renda ~0)
    jornada: { sec: 4, cap: { sec: 10, renda: 0.01 },   // passo comum · último passo do capítulo: mais ¥ e +1% de renda pra sempre
      seeds: 2, rr: 1 },                   // passos do pós-final marcados com `seeds`/`rr` na tabela: sementes / 1 troca grátis de amuletos
    lado: { n: 3, sec: 6 },                // 3 missões rápidas ativas (igual antes: 6 s de renda)
    ilha: { n: 3, from: 1, dig: 1.10, dur: 300, max: 900, sec: 10 },   // da 2ª ilha em diante: +10% de arroz cavado por 5 min (soma tempo, não força; teto 15 min) + ¥
  };

  // Jornada (missoes.js): passos em ordem; cada um paga SEC segundos da renda MÉDIA de 1 min (sem prêmios nem Cidade), piso PISO,
  // e NUNCA mais que capNext × o preço da próxima ferramenta (ou etapa da casa). Antes pagava 1–5 MIN do ¥/s do momento e virava
  // bola de neve (Bagger em 5 min). Passos já feitos na 1ª vez (save antigo) são pulados sem pagar.
  D.MISSOES = { piso: 25, secDef: 15, capNext: 0.08, sec: { casa: 20, arvore: 20, pa: 20, motor: 25, casa3: 25, cad: 25, escav: 25,
    bagger: 25, ilha: 30, viajar: 30, patio: 25, fab: 25, oficina: 25, cidade: 25, predio: 25, faixa: 30, evo: 30 } };

  D.toolIndex = {}; D.TOOLS.forEach((t, i) => { D.toolIndex[t.id] = i; });
  D.nodeById = {}; D.TREE.forEach(n => { D.nodeById[n.id] = n; });
})();
