/* Kome no Japão — islands.js
   Mudança de ilha (prestígio). Depois de terminar a casa, uma carta chama o Kome pra próxima ilha. É opcional: o jogador
   aceita quando quiser. Montanha, frota, árvore, casa e dinheiro zeram; ele ganha Sementes Douradas (raiz do total ganho)
   e gasta numa árvore permanente (D.SEEDS) que nunca zera. Roupas, quintal, conquistas e recordes ficam.
   Cada ilha muda algo: materiais (Hokkaido congela em camadas), formato, tema e bolsões.
   Estado: S.island (índice, vai no save como d.island) e S.stats.seeds / S.stats.sl (níveis da árvore de sementes).
   A viagem reescreve o save e recarrega a página (mesmo caminho do "Importar"), então não deixa estado velho pra trás. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data;
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
    kyushu: () => D.MATS.map(m => m.id === 'mochi' ? Object.assign({}, m, { name: 'Arroz de Curry', col: '#E3A93A', val: 4.2 }) : m),
    okinawa: () => D.MATS.map(m => m.id === 'prensado' ? Object.assign({}, m, { name: 'Arroz com Areia', col: '#E6D3A0', hard: 2, val: 1.4 }) : m),
    mochi: () => D.MATS.map(m => m.id === 'solto' ? Object.assign({}, m, { name: 'Arroz Mochigome', col: '#FFFDF6', val: 1.4 }) : m),
  };
  D.ISLANDS = [
    { id: 'honshu', n: 'Honshu', d: 'a ilha grande, onde tudo começou', shape: '', theme: '' },
    { id: 'hokkaido', n: 'Hokkaido', d: 'neve; o arroz congela em camadas', shape: 'classica', theme: 'inverno', gold: 1 },
    { id: 'kyushu', n: 'Kyushu', d: 'vulcão; bolsões de curry valem muito mais', shape: 'vulcao', theme: 'outono', gold: 1.8 },
    { id: 'okinawa', n: 'Okinawa', d: 'praia; areia misturada no arroz', shape: 'terraco', theme: 'verao', gold: 1.2 },
    { id: 'mochijima', n: 'Ilha Flutuante de Mochi', d: 'a última: tudo é mochi', shape: 'mochi', theme: 'primavera', gold: 1.5 },
  ];
  // árvore permanente das sementes douradas
  D.SEEDS = [
    { id: 'renda', n: 'Arroz Abençoado', d: '+15% de renda por nível', max: 20, base: 2 },
    { id: 'preco', n: 'Amigo do Corretor', d: '-6% em todos os preços por nível', max: 8, base: 3 },
    { id: 'ferr', n: 'Mala de Viagem', d: 'começa a ilha com Pá → Carrinho → Trator', max: 3, base: 6 },
    { id: 'grana', n: 'Poupança', d: 'começa a ilha com ¥1 mil, 10 mil, 100 mil…', max: 5, base: 1 },
    { id: 'ajud', n: 'Turma do Kome', d: '+1 shiba ajudante desde o minuto 1', max: 3, base: 4 },
    { id: 'ouro', n: 'Faro de Ouro', d: '+25% nos bolsões dourados por nível', max: 8, base: 2 },
  ];
  const START_TOOL = [0, 3, 5, 7];

  const sl = () => { S = S || G.S; return S.stats.sl || (S.stats.sl = {}); };
  const lvl = id => sl()[id] | 0;
  const isl = () => (S = S || G.S, D.ISLANDS[U.clamp(S.island | 0, 0, D.ISLANDS.length - 1)]);
  const gain = () => Math.floor(Math.sqrt(Math.max(0, S.earned) / 1e6));
  const seedCost = s => s.base * (lvl(s.id) + 1);

  // efeitos permanentes (chamado por computeStats)
  function applyStats(s) {
    s.sell *= 1 + 0.15 * lvl('renda');
    s.help += lvl('ajud');
    s.gold *= (1 + 0.25 * lvl('ouro')) * (isl().gold || 1);
  }
  const priceMul = () => { const n = D.ISLANDS.indexOf(isl()); return Math.pow(0.94, lvl('preco')) * (1 + 0.4 * n + 0.15 * n * n); };   // cada ilha mais cara (as sementes compensam)
  const matsFor = () => (mats[isl().id] ? mats[isl().id]() : D.MATS);

  function buy(s) {
    const c = seedCost(s);
    if (lvl(s.id) >= s.max) return;
    if ((S.stats.seeds | 0) < c) { UI.toast('Faltam ' + (c - (S.stats.seeds | 0)) + ' sementes', { icon: 'star', tone: 'bad' }); return; }
    S.stats.seeds -= c; sl()[s.id] = lvl(s.id) + 1;
    api.sfx('pling'); api.recompute(); api.save(); fill(panelPane);
  }
  function travel() {
    if (!S.ended) { UI.toast('Termine a casa nesta ilha primeiro', { icon: 'lock' }); return; }
    const next = Math.min(D.ISLANDS.length - 1, (S.island | 0) + 1), g = gain(), to = D.ISLANDS[next];
    UI.confirm('O Kome vai de barco pra ' + to.n + ' (' + to.d + '). Montanha, frota, árvore, casa e dinheiro recomeçam; você ganha ' + g + ' Sementes Douradas. Roupas, quintal e conquistas vão junto.', () => {
      boat(to, () => api.travel(next, g));
    }, { title: 'Carta: ' + to.n + ' quer arroz!', yes: 'Partir', no: 'Ainda não' });
  }
  // monta o save da ilha nova (chamado por game.js com o objeto do save)
  function makeSave(d, next, g) {
    const keep = { v: d.v, tv: d.tv, closet: d.closet, look: d.look, home: d.home, opts: d.opts, day: d.day };
    const stats = d.stats || {};
    stats.seeds = (stats.seeds | 0) + g; stats.seedsAll = (stats.seedsAll | 0) + g;
    stats.islandsDone = (stats.islandsDone | 0) + 1; stats.arrive = 1; stats.lv = {}; stats.run = {};
    stats.earnedAll = (stats.earnedAll || 0) + (d.earned || 0);
    for (const k in d) delete d[k];
    Object.assign(d, keep, { stats, island: next, mount: 1, tool: START_TOOL[U.clamp((stats.sl && stats.sl.ferr) | 0, 0, 3)],
      tree: [], house: 0, money: (stats.sl && stats.sl.grana) ? Math.pow(10, 2 + stats.sl.grana) : 0, earned: 0, ended: false, time: 0, dayT: 0, dayEarn: 0 });
    if (d.home) d.home.theme = D.ISLANDS[next].theme || d.home.theme;
    return d;
  }

  /* ---- cena do barco: o Kome atravessa o mar até a ilha nova (4 s, toque pula) ---- */
  function boat(to, done) {
    const cv = document.createElement('canvas'), W = 960, H = 540, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: 100000, objectFit: 'cover', background: '#9FD3F0' });
    document.body.appendChild(cv);
    const g = cv.getContext('2d'), Draw = E.Draw, PAL = E.PAL, LINE = PAL.line, T = 4.2;
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
      g.fillStyle = to.id === 'hokkaido' ? '#E8F0F6' : to.id === 'kyushu' ? '#B9A07A' : to.id === 'okinawa' ? '#E9D9A6' : '#F4D9DE';
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
      Draw.text(g, to.d, W / 2, 112, { size: 18, col: '#FFF8EC', sw: 4 });
      if (t >= T) { finish(); return; }
      requestAnimationFrame(frame);
    })(last);
  }

  /* ---- aba "Ilhas" na Casa ---- */
  function fill(pane) {
    if (!pane) return; panelPane = pane; pane.innerHTML = '';
    const col = UI.el('div', 'k-col', pane);
    UI.el('div', 'k-h', col, 'Você está em ' + isl().n);
    UI.el('div', 'k-homehint', col, isl().d + ' · ilhas concluídas: ' + (S.stats.islandsDone | 0));
    const nx = D.ISLANDS[(S.island | 0) + 1];
    if (nx) {
      const b = UI.button(col, { title: 'Partir pra ' + nx.n, sub: S.ended ? '+' + gain() + ' sementes · ' + nx.d : 'termine a casa primeiro · ' + nx.d, icon: 'star', tone: S.ended ? 'red' : '', size: 'sm', onClick: travel });
      (b.el || b).style.width = '100%'; if (!S.ended) (b.el || b).style.opacity = '0.6';
    } else UI.el('div', 'k-homehint', col, 'Última ilha! Agora é cavar pra sempre.');
    UI.el('div', 'k-h', col, 'Sementes Douradas: ' + (S.stats.seeds | 0));
    UI.el('div', 'k-homehint', col, 'nunca zeram; valem em todas as ilhas');
    for (const s of D.SEEDS) {
      const L = lvl(s.id), full = L >= s.max;
      const b = UI.button(col, { title: s.n + ' · nível ' + L + '/' + s.max, sub: (full ? 'completo · ' : seedCost(s) + ' sementes · ') + s.d, icon: 'star', size: 'sm', onClick: () => buy(s) });
      (b.el || b).style.width = '100%'; if (full || (S.stats.seeds | 0) < seedCost(s)) (b.el || b).style.opacity = '0.6';
    }
  }

  G.Islands = {
    init(a) {
      api = a; S = G.S;
      if (S.stats.arrive) { S.stats.arrive = 0; const i = isl(); setTimeout(() => { UI.banner('Bem-vindo a ' + i.n + '!', i.d, { icon: 'star', tone: 'gold', dur: 3.5 }); api.sfx('fanfare'); }, 1200); }
    },
    applyStats, priceMul, matsFor, makeSave, fill, island: isl, gain,
    go: n => boat(D.ISLANDS[n], () => api.travel(n, gain())),   // testes: viaja sem o cartão
  };
})();
