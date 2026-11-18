/* Kome no Japão — islands.js
   A VOLTA AO JAPÃO (fim de jogo). Depois de terminar a casa, o Kome pode partir pra próxima ilha. É opcional: o jogador
   aceita quando quiser. Montanha, frota, árvore, casa e dinheiro zeram; ele ganha Sementes Douradas (raiz do total ganho)
   e gasta numa árvore permanente (D.SEEDS) que nunca zera. Roupas, quintal, conquistas e recordes ficam.
   Cada ilha é uma FICHA em D.ISLANDS: materiais, formato, tema, bolsões, evento próprio e o PERFIL DE CENA (scene: céu,
   fundo, chão, partículas, crista da montanha, lado da montanha, como o Kome sente o clima, música). O desenho mora em
   game-world.js (lê G.Islands.scene()); a interface (mapa, chip do HUD, tutorial) em islands-ui.js.
   Depois da 5ª ilha vem o Grande Final (Kome-Oh) e a Volta 2, 3... (S.stats.lap) com preços maiores.
   Estado: S.island (índice), S.stats.seeds / sl (árvore), isl (recordes e medalhas por ilha), lap, legend.
   A viagem reescreve o save e recarrega a página (mesmo caminho do "Importar"), então não deixa estado velho pra trás. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data, EG = D.ENDGAME;
  let api = null, S = null, panelPane = null;

  // materiais por ilha: Hokkaido tem faixas de arroz congelado entre as camadas
  const ICE = { id: 'gelo', name: 'Arroz Congelado', hard: 2.2, val: 2.2, slope: 7, col: '#DCEAF4', tex: 'pressed' };
  const mats = {
    hokkaido: () => [
      { id: 'solto', name: 'Arroz Solto', d0: 0, d1: 100, hard: 1, val: 1, slope: 3.6, col: '#F6F1E4', tex: 'loose' },
      Object.assign({}, ICE, { d0: 100, d1: 170 }),
      { id: 'prensado', name: 'Arroz Integral', d0: 170, d1: 380, hard: 2.5, val: 1.6, slope: 6, col: '#D8BF93', tex: 'pressed' },
      Object.assign({}, ICE, { id: 'gelo2', name: 'Gelo Eterno', d0: 380, d1: 470, hard: 6, val: 4, col: '#C9DDEC' }),
      { id: 'mochi', name: 'ARROZ NEGRO', d0: 470, d1: 1e9, hard: 8, val: 3.5, slope: 9, col: '#5A4565', tex: 'loose' },
      D.MATS[3],
    ],
    kyushu: () => D.MATS.map(m => m.id === 'mochi' ? Object.assign({}, m, { name: 'Arroz de Curry', col: '#E3A93A', val: 4.2 }) : m.id === 'solto' ? Object.assign({}, m, { name: 'Arroz Vulcânico', col: '#E6DCCB' }) : m),
    okinawa: () => D.MATS.map(m => m.id === 'prensado' ? Object.assign({}, m, { name: 'Arroz com Areia', col: '#E6D3A0', hard: 2, val: 1.4 }) : m),
    mochi: () => D.MATS.map(m => m.id === 'solto' ? Object.assign({}, m, { name: 'Arroz Mochigome', col: '#FFFDF6', val: 1.4 }) : m),
  };
  /* ---- as 5 ilhas (fichas) ----
     scene: mirror (montanha à ESQUERDA), sky [topo, base, força] tinge o céu do dia, far (fundo: fuji|peaks|volcano|sea|mochi),
     hills [longe, perto] + trees (densidade das matas), ground {grass, grassD, grassL, soil, soilD}, air (neve|cinza|brisa|pétalas),
     crest (cobertura da montanha: snow|ash|sand|mochi), tree (árvore do pátio), yard (enfeites do pátio), roofSnow (neve nos telhados),
     feel (cold|hot|beach|float: como o Kome sente), music (tema), sea/land (cores no mapa e na cena do barco).
     ev: evento próprio (a cada ~3 min, depois da Pá). map: posição no mapa (0..1). price: × no preço da ilha (padrão 1; ver priceMul). */
  D.ISLANDS = [
    { id: 'honshu', n: 'Honshu', d: 'a ilha grande, onde tudo começou', hook: 'o Fuji, a cidade e a montanha do vovô', shape: '', theme: '',
      mods: ['montanha clássica', 'preços normais'],
      ev: { id: 'hanami', n: 'Hanami!', sub: 'chuva de sakura: preço ×1,8', dur: 25, mult: 1.8, icon: 'star', air: 'petals' },
      map: [0.55, 0.57], land: '#9CC57A',
      scene: { mirror: false, sky: null, far: 'fuji', hills: [null, null], trees: [0.4, 0.25], ground: null, air: null, crest: null, tree: 'sakura', yard: null, feel: null, music: null } },
    { id: 'hokkaido', n: 'Hokkaido', d: 'neve; o arroz congela em camadas', hook: 'neve até o pescoço e arroz que congela', shape: 'classica', theme: 'inverno', gold: 1,
      mods: ['faixas de Arroz Congelado e Gelo Eterno', 'neve em tudo', 'o Kome sente frio'],
      ev: { id: 'nevasca', n: 'Nevasca!', sub: 'a face congelou: cada cavada vale ×2,5', dur: 25, mult: 2.5, icon: 'star', air: 'snow', frost: 1 },
      map: [0.79, 0.14], land: '#EEF4F8',
      scene: { mirror: false, sky: ['#BFD6EA', '#EEF4FA', 0.55], far: 'peaks', hills: ['#5C7D6A', '#EAF1F6'], trees: [0.75, 0.1], treeCol: '#3E5E4C',
        ground: { grass: '#F1F6FA', grassD: '#BFD2E2', grassL: '#FFFFFF', soil: '#B9A584', soilD: '#9A8566' },
        air: 'snow', airN: 90, crest: 'snow', tree: 'pine', yard: 'neve', roofSnow: true, feel: 'cold', music: 'hokkaido' } },
    { id: 'kyushu', n: 'Kyushu', d: 'vulcão; bolsões de curry valem muito mais', hook: 'o Sakurajima fumaça e a montanha é de curry', shape: 'vulcao', theme: 'outono', gold: 1.8, price: 1.25,
      mods: ['montanha virada pro outro lado', 'bolsões dourados ×1,8', 'cinza caindo do céu'],
      ev: { id: 'erupcao', n: 'Erupção de curry!', sub: 'o vulcão cuspiu sacos de curry dourado: toque neles!', dur: 20, mult: 1.5, icon: 'bolt', gift: 4, air: 'ash', erupt: 1 },
      map: [0.25, 0.74], land: '#B9A07A',
      scene: { mirror: true, sky: ['#F49A6A', '#FBD9A8', 0.6], far: 'volcano', hills: ['#6E6A4E', '#8C8E52'], trees: [0.3, 0.2], treeCol: '#4C5034',
        ground: { grass: '#8E9A4E', grassD: '#6C7638', grassL: '#B3BC6E', soil: '#8A6A4C', soilD: '#6C503A' },
        air: 'ash', airN: 55, crest: 'ash', tree: 'maple', yard: 'vulcao', feel: 'hot', music: 'kyushu' } },
    { id: 'okinawa', n: 'Okinawa', d: 'praia; areia misturada no arroz', hook: 'mar azul, terraços de arroz e shisas de guarda', shape: 'terraco', theme: 'verao', gold: 1.2,
      mods: ['montanha virada pro outro lado', 'terraços com areia', 'praia no pátio'],
      ev: { id: 'mare', n: 'Maré baixa!', sub: 'a areia mostrou tesouros enterrados: toque neles!', dur: 25, mult: 1.5, icon: 'chest', gift: 3, air: 'spray', tide: 1 },
      map: [0.11, 0.89], land: '#E9D9A6',
      scene: { mirror: true, sky: ['#5EC8E8', '#C8F1F6', 0.5], far: 'sea', hills: ['#5FA86A', '#E8D49A'], trees: [0.35, 0], treeCol: '#3E7A4A',
        ground: { grass: '#EBD7A0', grassD: '#CDB57C', grassL: '#FFF1C8', soil: '#D6BC86', soilD: '#B89C68' },
        air: 'spray', airN: 26, crest: 'sand', tree: 'palm', yard: 'praia', feel: 'beach', music: 'okinawa' } },
    { id: 'mochijima', n: 'Ilha Flutuante de Mochi', d: 'a última: tudo é mochi', hook: 'uma ilha que flutua no céu cor-de-rosa', shape: 'mochi', theme: 'primavera', gold: 1.5,
      mods: ['montanha de mochi (morango e matchá)', 'nuvens de mochi', 'pétalas o tempo todo'],
      ev: { id: 'fofa', n: 'Gravidade fofa!', sub: 'tudo quica: renda ×2 e pulos gigantes', dur: 22, mult: 2, icon: 'star', air: 'petals', grav: 0.4 },
      map: [0.2, 0.2], land: '#F6D3DC', sky: true,
      scene: { mirror: false, sky: ['#F79AC0', '#FFE3EE', 0.72], far: 'mochi', hills: ['#E7A9C2', '#BFE3A8'], trees: [0.35, 0.3], treeCol: '#F29CB4',
        ground: { grass: '#BFE6A6', grassD: '#94C77E', grassL: '#E6FAD6', soil: '#F2C9D2', soilD: '#DCA6B4' },
        air: 'petals', airN: 50, crest: 'mochi', tree: 'sakura', yard: 'mochi', feel: 'float', music: 'mochi' } },
  ];
  // árvore permanente das sementes douradas. SEM TETO (jogo-infinito.md + sementes.md): custo base × 1,45^nível pra sempre;
  // sem `max` = infinito. Ficam com fim só os que não fazem sentido infinitos: Mala de Viagem (3 ferramentas), compras únicas
  // (garagem, marco turbinado, livro, absurdos) e os que já dizem o teto no texto (cochilo até 100%, cama até 24 h).
  D.SEEDS = [
    { id: 'renda', n: 'Arroz Abençoado', d: '+15% de renda por nível', base: 2 },
    { id: 'preco', n: 'Amigo do Corretor', d: '-6% em todos os preços por nível', base: 3 },
    { id: 'ferr', n: 'Mala de Viagem', d: 'começa a ilha com Pá → Carrinho → Trator', max: 3, base: 6 },
    { id: 'grana', n: 'Poupança', d: 'começa a ilha com ¥1 mil, 10 mil, 100 mil… (depois do 5, +¥10 mi por nível)', base: 1 },
    { id: 'ajud', n: 'Turma do Kome', d: '+1 shiba ajudante nos níveis 1–3, depois +1 a cada 5 níveis', base: 4 },
    { id: 'ouro', n: 'Faro de Ouro', d: '+25% nos bolsões dourados por nível', base: 2 },
    // camada Cookie (docs/design/camada-cookie.md): galhos Pátio, Sorte, Coração e Poupança
    { id: 'garagem', n: 'Garagem Abençoada', d: 'o Pátio começa com 5 de cada máquina de mão', max: 1, base: 4, g: 'Pátio' },
    { id: 'desc_frota', n: 'Desconto de Frota', d: '-1% no preço do Pátio por nível', base: 3, g: 'Pátio' },
    { id: 'marco_turbo', n: 'Marco Turbinado', d: 'os marcos de 1 e 5 viram ×3', max: 1, base: 20, g: 'Pátio' },
    { id: 'sindicato', n: 'Shiba Sindicalizado', d: '+0,5% na frota por 10 unidades no total, por nível', base: 8, g: 'Pátio' },
    { id: 'faro_ev', n: 'Faro Dourado', d: 'eventos dourados 10% mais frequentes por nível (2% depois do 10)', base: 3, g: 'Sorte' },
    { id: 'livro', n: 'Livro de Receitas', d: 'abre a Tempestade de Sacos Dourados', max: 1, base: 6, g: 'Sorte' },
    { id: 'pote', n: 'Pote Fundo', d: '+0,1% por conquista por nível', base: 4, g: 'Coração' },
    { id: 'cochilo', n: 'Cochilo Produtivo', d: 'offline rende +10% por nível (até 100%)', max: 5, base: 2, g: 'Poupança' },
    { id: 'cama', n: 'Cama Grande', d: 'teto offline +4 h por nível (até 24 h)', max: 4, base: 3, g: 'Poupança' },
    // galho Absurdo: cada nó destrava uma máquina absurda no Pátio (D.PATIO.turmas, campo seed); req = nó anterior da cadeia
    // custos (19/11): com as ilhas de 30 min entram ~110 mil sementes por viagem (~0,55 mi por volta) → o robô guloso (compra o mais
    // barato primeiro) pega um a cada 1–2 voltas: voltas 2, 3, 4, 5, 7, 10. Antes 25…3.000 = todos nas 2–3 primeiras viagens.
    { id: 'absurdo15', n: 'Frota de Tatuzões', d: 'destrava a turma 15 no Pátio: tatuzões cavando em fila indiana', max: 1, base: 7e4, g: 'Absurdo' },
    { id: 'absurdo16', n: 'Kome-Oh em Série', d: 'destrava a turma 16: robôs gigantes de linha de montagem', max: 1, base: 1.4e5, g: 'Absurdo', req: 'absurdo15' },
    { id: 'absurdo17', n: 'Trem-Bala de Arroz', d: 'destrava a turma 17: 300 km/h de arroz', max: 1, base: 2.5e5, g: 'Absurdo', req: 'absurdo16' },
    { id: 'absurdo18', n: 'Foguete de Mochi', d: 'destrava a turma 18: o arroz vai pro espaço', max: 1, base: 4e5, g: 'Absurdo', req: 'absurdo17' },
    { id: 'absurdo19', n: 'Escavadeira do Monte Fuji', d: 'destrava a turma 19: a montanha vira pá', max: 1, base: 6e5, g: 'Absurdo', req: 'absurdo18' },
    { id: 'absurdo20', n: 'Portal Onigiri', d: 'destrava a turma 20: onigiri de outra dimensão', max: 1, base: 8.5e5, g: 'Absurdo', req: 'absurdo19' },
  ];
  const START_TOOL = [0, 3, 5, 7];

  // temas de música das ilhas (mesmo formato dos temas do audio.js)
  if (E.Music && E.Music.define) {
    try {
      E.Music.define('hokkaido', { label: 'Hokkaido', bpm: 58, lift: 0.05, dens: 0.45, rev: 0.55, kind: 'harp', flute: 'shaku', lead: 'shaku',
        keys: [['kumoi', 62, 4], ['insen', 62, 2], ['yo', 57, 2]], layers: { pad: [-1, 0.5], koto: [-1, 0.45], furin: [-1, 0.55], drip: [-1, 0.25], shaku: [0.3, 0.45], bass: [0.55, 0.4], kane: [0.8, 0.12] } });
      E.Music.define('kyushu', { label: 'Kyushu', bpm: 84, lift: 0.12, dens: 0.8, rev: 0.3, kind: 'koto', flute: 'shaku', heavy: true,
        keys: [['in', 57, 4], ['minyo', 57, 3], ['iwato', 57, 1]], layers: { pad: [-1, 0.4], koto: [-1, 0.5], don: [-1, 0.7], bass: [0.05, 0.62], shime: [0.25, 0.36], anvil: [0.45, 0.28], shaku: [0.5, 0.45], kane: [0.8, 0.14] } });
      E.Music.define('okinawa', { label: 'Okinawa', bpm: 100, lift: 0.1, swing: 0.1, dens: 0.82, rev: 0.25, kind: 'shami', flute: 'shinobue',
        keys: [['ryukyu', 60, 6], ['ryukyu', 55, 3], ['ryo', 60, 1]], layers: { pad: [-1, 0.3], shami: [-1, 0.42], koto: [-1, 0.35], shime: [0.1, 0.36], bass: [0.15, 0.55], clap: [0.3, 0.32], shaku: [0.4, 0.38], kane: [0.6, 0.16] } });
      E.Music.define('mochi', { label: 'Ilha de Mochi', bpm: 70, lift: 0.08, dens: 0.6, rev: 0.5, kind: 'harp', flute: 'shinobue',
        keys: [['yo', 64, 4], ['ryo', 64, 3], ['kumoi', 64, 1]], layers: { pad: [-1, 0.45], koto: [-1, 0.5], furin: [-1, 0.5], drip: [0.1, 0.3], shaku: [0.3, 0.4], bass: [0.5, 0.42], kane: [0.7, 0.16] } });
    } catch (e) { /* sem áudio */ }
  }

  const sl = () => { S = S || G.S; return S.stats.sl || (S.stats.sl = {}); };
  const lvl = id => sl()[id] | 0;
  const capped = s => !!s.max && lvl(s.id) >= s.max;   // sem max = sem teto
  const ajudN = L => Math.min(L, 3) + Math.floor(Math.max(0, L - 3) / 5);   // Turma do Kome: 1–3 = +1 cada; depois +1 a cada 5
  const granaOf = L => (L > 0 ? Math.pow(10, 2 + Math.min(L, 5)) * (1 + Math.max(0, L - 5)) : 0);   // Poupança: ×10 até o 5, depois +¥10 mi/nível
  const idx = () => (S = S || G.S, U.clamp(S.island | 0, 0, D.ISLANDS.length - 1));
  const isl = () => D.ISLANDS[idx()];
  const lap = () => (S = S || G.S, S.stats.lap | 0);
  const nextIdx = () => (idx() + 1) % D.ISLANDS.length;
  // SEMENTES DA VIAGEM (camada Cookie): campanha da ilha (raiz do que ganhou ATÉ o final) + Sementes do Pátio
  // = campanha × (ganho no Pátio / ganho da campanha)^0,15 (ficar ×100 mais no Pátio ≈ só ×2). Antes do final: o total.
  const seedsBase = () => (S = S || G.S, Math.floor(Math.sqrt(Math.max(0, S.stats.earnedEnd || S.earned) / 1e6)));
  const seedsPatio = () => { const e0 = S.stats.earnedEnd || 0, r = e0 > 0 ? Math.max(0, S.earned - e0) / e0 : 0; return r > 0 ? Math.floor(seedsBase() * Math.pow(r, EG.patioExp || 0.15)) : 0; };
  const gain = () => (S = S || G.S, Math.floor((S.stats.earnedEnd ? seedsBase() + seedsPatio() : seedsBase()) * (G.Faixas ? G.Faixas.seedMul() : 1)));   // faixa: ×1,5 por faixa
  const seedCost = s => Math.ceil(s.base * Math.pow(EG.seedGrow || 1.45, lvl(s.id)));
  const recs = () => (S.stats.isl || (S.stats.isl = {}));
  const rec = id => recs()[id] || null;
  const islandRun = () => (S = S || G.S, (S.island | 0) > 0 || lap() > 0);   // Honshu da primeira vez é a campanha: sem evento de ilha

  // efeitos permanentes (chamado por computeStats)
  function applyStats(s) {
    s.sell *= (1 + 0.15 * lvl('renda')) * (S.stats.legend ? EG.legend : 1);
    s.help += ajudN(lvl('ajud'));
    s.gold *= (1 + 0.25 * lvl('ouro')) * (isl().gold || 1);
  }
  // cada ilha mais cara (as sementes compensam). t = nº da viagem (0 = campanha, 1 = Hokkaido da 1ª volta, 5 = Honshu da volta 2…):
  // preço = D.ENDGAME.price.trip[t-1] (tabela medida com tools/longo.js) e, depois da tabela, + grow por viagem (sobe devagar:
  // a força das sementes também só sobe devagar). Antes era 1 + 0,4n + 0,15n² com n = ilha + volta: Honshu da volta 2 (n = 1)
  // saía mais barata que a ilha 4 da volta 1 (n = 4) e cada ilha do começo acabava em 14–19 min.
  const tripN = () => idx() + lap() * D.ISLANDS.length;
  const priceBase = t => { const P = EG.price, L = P.trip.length; return t <= 0 ? 1 : t <= L ? P.trip[t - 1] : P.trip[L - 1] + P.grow * (t - L); };
  // × price da ficha da ilha (D.ISLANDS[i].price, padrão 1): acerto fino medido (Kyushu rende mais com o curry ×1,8)
  const priceMul = () => { const t = tripN(); return Math.pow(0.94, lvl('preco')) * priceBase(t) * (t > 0 ? isl().price || 1 : 1); };
  const matsFor = () => (mats[isl().id] ? mats[isl().id]() : D.MATS);

  /* ---- medalhas: bronze = terminou; prata e ouro = terminou abaixo do tempo (D.ENDGAME.medal) ---- */
  const MEDALS = ['', 'bronze', 'prata', 'ouro'];
  function medalFor(i, sec) { const m = sec / 60; return m <= EG.medal.ouro[i] ? 3 : m <= EG.medal.prata[i] ? 2 : 1; }
  // chamado pelo game.js no final de cada ilha: guarda tempo/medalha e dá as sementes extras da medalha nova
  function onEnding(sec) {
    const i = idx(), id = D.ISLANDS[i].id, r = recs()[id] || (recs()[id] = { best: 0, medal: 0, n: 0 });
    const m = medalFor(i, sec), was = r.medal | 0, newBest = !r.best || sec < r.best;
    r.n = (r.n | 0) + 1; if (newBest) r.best = Math.round(sec);
    let bonus = 0;
    if (m > was) { for (let k = was + 1; k <= m; k++) bonus += EG.medal.seeds[MEDALS[k]] | 0; r.medal = m; S.stats.seeds = Math.floor(S.stats.seeds || 0) + bonus; S.stats.seedsAll = Math.floor(S.stats.seedsAll || 0) + bonus; }
    return { medal: m, was, bonus, best: r.best, newBest, sec, island: D.ISLANDS[i], last: i === D.ISLANDS.length - 1 };
  }

  function buy(s) {
    const c = seedCost(s);
    if (capped(s)) return false;
    if (s.req && !lvl(s.req)) { const r = D.SEEDS.find(x => x.id === s.req); UI.toast('Antes: ' + (r ? r.n : s.req), { icon: 'lock', tone: 'bad' }); return false; }
    if (Math.floor(S.stats.seeds || 0) < c) { UI.toast('Faltam ' + U.fmt(c - Math.floor(S.stats.seeds || 0)) + ' sementes', { icon: 'star', tone: 'bad' }); return false; }
    S.stats.seeds -= c; sl()[s.id] = lvl(s.id) + 1;
    api.sfx('pling'); api.recompute(); api.save(); fill(panelPane); if (G.IslandsUI) G.IslandsUI.refresh();
    return true;
  }
  function travel() {
    if (!S.ended) { UI.toast('Termine a casa nesta ilha primeiro', { icon: 'lock', sub: 'depois o barco te leva pra ' + D.ISLANDS[nextIdx()].n }); return; }
    const next = nextIdx(), g = gain(), to = D.ISLANDS[next], wrap = next === 0;
    UI.confirm((wrap ? 'Volta ' + (lap() + 2) + ' ao Japão! ' : '') + 'O Kome vai de barco pra ' + to.n + ' (' + to.d + '). Montanha, frota, árvore, casa e dinheiro recomeçam; você ganha ' + U.fmt(g) + ' Sementes Douradas' + (S.stats.earnedEnd && seedsPatio() > 0 ? ' (' + U.fmt(seedsBase()) + ' da ilha + ' + U.fmt(seedsPatio()) + ' do Pátio)' : '') + '. Roupas, quintal e conquistas vão junto.' + (wrap && G.Faixas ? ' ' + G.Faixas.nextTxt() : ''), () => {
      boat(to, () => api.travel(next, g));
    }, { title: 'Carta: ' + to.n + ' quer arroz!', yes: 'Partir', no: 'Ainda não' });
  }
  // monta o save da ilha nova (chamado por game.js com o objeto do save)
  function makeSave(d, next, g) {
    const keep = { v: d.v, tv: d.tv, closet: d.closet, look: d.look, home: d.home, opts: d.opts, day: d.day };
    const stats = d.stats || {};
    if (next === 0 && (d.island | 0) === D.ISLANDS.length - 1) stats.lap = (stats.lap | 0) + 1;   // deu a volta: Honshu de novo, mais caro
    stats.seeds = Math.floor(stats.seeds || 0) + g; stats.seedsAll = Math.floor(stats.seedsAll || 0) + g;
    stats.islandsDone = (stats.islandsDone | 0) + 1; stats.arrive = 1; stats.lv = {}; stats.run = {}; stats.patio = {}; stats.earnedEnd = 0;   // Pátio da Frota zera (prestígio)
    // ¥/s "com você na melhor máquina" é da ILHA (a ferramenta e a Oficina zeram): se ficasse, o R0 do próximo Pátio e a renda
    // garantida do Goma herdavam a Oficina do Pátio anterior e a economia crescia ×10^6 por viagem até estourar (1e308 = parede da volta 17)
    delete stats.topIps; delete stats.topWk;
    if (stats.fab) { stats.fab.slow = 0; stats.fab.pb = 0; }   // Fábrica: o layout fica, o ritmo de cavar medido (valor do item) é da ilha
    stats.earnedAll = (stats.earnedAll || 0) + (d.earned || 0);
    for (const k in d) delete d[k];
    Object.assign(d, keep, { stats, island: next, mount: 1, tool: START_TOOL[U.clamp((stats.sl && stats.sl.ferr) | 0, 0, 3)],
      tree: [], house: 0, money: granaOf((stats.sl && stats.sl.grana) | 0), earned: 0, ended: false, time: 0, dayT: 0, dayEarn: 0 });
    if (d.home) d.home.theme = D.ISLANDS[next].theme || d.home.theme;
    return d;
  }

  /* ---- evento próprio de cada ilha (nevasca, erupção, maré, gravidade fofa, hanami) ---- */
  let ev = null, evT = 0, nextEv = EG.ev.first;
  function evTick(dt) {
    if (!api || !islandRun()) return;
    if (ev) { evT -= dt; if (evT <= 0) { ev = null; nextEv = U.rnd(EG.ev.every[0], EG.ev.every[1]) * (G.Faixas ? G.Faixas.mult('evRaro') : 1); } return; }
    if (S.tool < EG.ev.minTool || (api.busy && api.busy())) return;
    if ((nextEv -= dt) > 0) return;
    ev = isl().ev; evT = ev.dur; S.stats.islEv = (S.stats.islEv | 0) + 1;
    if (!api.fast()) { api.sfx('fanfare'); UI.banner(ev.n, ev.sub, { icon: ev.icon, tone: 'gold', dur: 3 }); }
    if (ev.gift && api.gift) api.gift(ev.gift);
    if (api.onEvent) api.onEvent(ev);
  }
  const evMult = () => (ev ? ev.mult : 1);

  // perfil de cena da ilha atual (o evento pode engrossar as partículas)
  const DEF = D.ISLANDS[0].scene;
  function scene() { const i = isl(); return (i && i.scene) || DEF; }

  /* ---- cena do barco: o Kome atravessa o mar até a ilha nova (toque pula). A chegada (cutscene) toca depois da recarga ---- */
  function boat(to, done) {
    const cv = document.createElement('canvas'), W = 960, H = 540, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: 100000, objectFit: 'cover', background: '#9FD3F0' });
    document.body.appendChild(cv);
    const g = cv.getContext('2d'), Draw = E.Draw, PAL = E.PAL, LINE = PAL.line, T = 3.2;
    let t = 0, last = performance.now(), end = false;
    const finish = () => { if (end) return; end = true; done(); };
    cv.addEventListener('pointerdown', finish);
    api.sfx('whoosh');
    (function frame(now) {
      if (end) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = g.createLinearGradient(0, 0, 0, H * 0.6); sky.addColorStop(0, '#7EC4EC'); sky.addColorStop(1, '#D8F0FA');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      // ilha nova chegando pela direita
      const ix = W + 120 - t / T * 520, iy = H * 0.58;
      g.fillStyle = to.land || '#E8F0F6';
      g.strokeStyle = LINE; g.lineWidth = 2;
      g.beginPath(); g.moveTo(ix - 220, iy); g.quadraticCurveTo(ix - 120, iy - 60, ix - 40, iy - 120); g.lineTo(ix + 10, iy - 125); g.quadraticCurveTo(ix + 120, iy - 70, ix + 260, iy); g.closePath(); g.fill(); g.stroke();
      if (to.id === 'kyushu') { for (let i = 0; i < 4; i++) { const q = (t * 0.5 + i / 4) % 1; g.globalAlpha = 0.6 * (1 - q); Draw.circle(g, ix - 15 + q * 30, iy - 135 - q * 70, 10 + q * 20, '#C9C2B8', { ol: 0 }); } g.globalAlpha = 1; }
      // mar em faixas com ondas
      for (let b = 0; b < 4; b++) {
        const y0 = H * 0.58 + b * 34;
        g.fillStyle = ['#4FA3D9', '#3E8FC6', '#3580B4', '#2C6FA0'][b];
        g.beginPath(); g.moveTo(0, H); g.lineTo(0, y0);
        for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.03 + t * (2 + b) + b) * (3 + b));
        g.lineTo(W, H); g.closePath(); g.fill();
      }
      // barquinho balançando com vela de arroz
      const bx = 240 + Math.min(1, t / T) * 140, by = H * 0.62 + Math.sin(t * 3) * 6, rot = Math.sin(t * 2.2) * 0.06;
      g.save(); g.translate(bx, by); g.rotate(rot);
      g.fillStyle = '#9A6A44'; g.beginPath(); g.moveTo(-110, -10); g.lineTo(110, -10); g.lineTo(80, 34); g.lineTo(-80, 34); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#7A5034'; g.fillRect(-100, 2, 200, 6);
      Draw.box(g, -4, -150, 8, 142, '#7A5034', { r: 2 });
      g.fillStyle = '#FFF8EC'; g.beginPath(); g.moveTo(6, -146); g.quadraticCurveTo(80 + Math.sin(t * 4) * 6, -90, 6, -30); g.closePath(); g.fill(); g.stroke();
      Draw.circle(g, 32, -90, 16, PAL.red, { ol: 1.5 }); Draw.text(g, '米', 32, -89, { size: 18, col: '#FFF8EC', sw: 0, weight: 900 });
      E.drawShiba(g, -50, -10, t % 2 < 1.2 ? 'wag' : 'sit', t, { scale: 3, pal: (S.look && S.look.pal) || 'kome' });
      g.restore();
      // gaivotas
      for (let i = 0; i < 3; i++) { const x = (t * 60 + i * 260) % (W + 100) - 50, y = 90 + i * 30 + Math.sin(t * 3 + i) * 6; g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 10, y); g.quadraticCurveTo(x - 5, y - 6, x, y); g.quadraticCurveTo(x + 5, y - 6, x + 10, y); g.stroke(); }
      Draw.text(g, 'Rumo a ' + to.n + '…', W / 2, 70, { size: 38, col: '#FFF8EC', sw: 6 });
      Draw.text(g, to.hook || to.d, W / 2, 112, { size: 18, col: '#FFF8EC', sw: 4 });
      if (t >= T) { finish(); return; }
      requestAnimationFrame(frame);
    })(last);
  }

  /* ---- aba "Ilhas" na Casa: atalho pro mapa + a árvore de sementes (continua funcionando sem o mapa) ---- */
  function fill(pane) {
    if (!pane) return; panelPane = pane; pane.innerHTML = '';
    const col = UI.el('div', 'k-col', pane);
    if (G.IslandsUI) { const b = UI.button(col, { title: 'Abrir o mapa do Japão', sub: 'ilhas, medalhas e a próxima viagem', icon: 'star', tone: 'red', size: 'sm', onClick: () => G.IslandsUI.open() }); (b.el || b).style.width = '100%'; }
    UI.el('div', 'k-h', col, 'Você está em ' + isl().n + (lap() ? ' · volta ' + (lap() + 1) : ''));
    UI.el('div', 'k-homehint', col, isl().d + ' · ilhas concluídas: ' + (S.stats.islandsDone | 0));
    const nx = D.ISLANDS[nextIdx()];
    const b = UI.button(col, { title: 'Partir pra ' + nx.n, sub: S.ended ? '+' + U.fmt(gain()) + ' sementes · ' + nx.d : 'termine a casa primeiro · ' + nx.d, icon: 'star', tone: S.ended ? 'red' : '', size: 'sm', onClick: travel });
    (b.el || b).style.width = '100%'; if (!S.ended) (b.el || b).style.opacity = '0.6';
    UI.el('div', 'k-h', col, 'Sementes Douradas: ' + U.fmt(S.stats.seeds || 0));
    UI.el('div', 'k-homehint', col, 'nunca zeram; valem em todas as ilhas');
    for (const s of D.SEEDS) {
      const L = lvl(s.id), full = capped(s);
      const bt = UI.button(col, { title: s.n + ' · nível ' + L + (s.max ? '/' + s.max : ''), sub: (full ? 'completo · ' : U.fmt(seedCost(s)) + ' sementes · ') + s.d, icon: 'star', size: 'sm', onClick: () => buy(s) });
      (bt.el || bt).style.width = '100%'; if (full || Math.floor(S.stats.seeds || 0) < seedCost(s)) (bt.el || bt).style.opacity = '0.6';
    }
  }

  G.Islands = {
    init(a) { api = a; S = G.S; },
    sim: { seedCost, buy, gain },   // tools/longo.js
    // chegada numa ilha nova: game.js chama depois do boot (cutscene se não for teste, senão só o aviso)
    arrival() { if (!S.stats.arrive) return null; S.stats.arrive = 0; return isl(); },
    seedsBase, seedsPatio,
    applyStats, priceMul, matsFor, makeSave, fill, island: isl, index: idx, next: () => D.ISLANDS[nextIdx()], lap, gain, travel, buy, seedCost, lvl, capped,
    scene, evTick, evMult, event: () => ev,
    forceEvent(on) { if (on === false) { ev = null; return; } ev = isl().ev; evT = ev.dur; if (ev.gift && api && api.gift) api.gift(ev.gift); },
    eventLeft: () => evT, rec, medalFor, onEnding, MEDALS, islandRun,   // forceEvent: testes e atalho do ?dev
    go: n => boat(D.ISLANDS[n], () => api.travel(n, gain())),   // testes: viaja sem o cartão
  };
})();
