/* Kome no Japão — industry.js
   Modo infinito (depois do final), tudo comprado na Oficina e zerado ao mudar de ilha (S.stats.run):
   - Bagger gêmea: uma segunda Bagger cavando atrás da primeira; renda ×2 e a câmera abre mais.
   - Fábrica no pé da montanha: esteira saindo do coletor, Komes empacotando, braço robô e robozinhos levando sacos.
     Cada nível +12% de renda e mais coisa na tela.
   - Cidade que compra: 5 lojas sobem de nível (+4% cada) e o jogador escolhe UMA cliente, que dá o bônus dela.
   - Especialização: nos marcos 10/25/50 da Oficina o jogador escolhe "mais rápida" ou "mais dourada" (S.stats.spec).
   G.Ind.init(api) em game.js; tick(dt, ctx) e drawBack/drawFront(g, t, ctx) no laço; applyStats(s) em computeStats. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data, PAL = E.PAL, Draw = E.Draw;
  let api = null, S = null;
  // Bagger Gigante: 50% maior, duas rodas, montada em 4 peças; uma cópia escura trabalha lá atrás (profundidade 2D)
  D.GIANT = [
    { n: 'Esteiras gigantes', d: 'a base: três esteiras do tamanho de prédios', sec: 300, mult: 1.2 },
    { n: 'Conveses e mastros', d: 'a casa de máquinas e os mastros', sec: 500, mult: 1.45 },
    { n: 'Lança e primeira roda', d: 'ela começa a cavar', sec: 800, mult: 1.8 },
    { n: 'Segunda roda', d: 'DUAS RODAS. renda ×2,5', sec: 1200, mult: 2.5 },
  ];
  D.SHOPS = [
    { id: 'konbini', n: 'Konbini', d: 'cliente: +5% de renda por nível', k: 'sell', r: 0.05 },
    { id: 'sushi', n: 'Restaurante de Sushi', d: 'cliente: +10% no valor do arroz por nível', k: 'val', r: 0.10 },
    { id: 'mochiya', n: 'Loja de Mochi', d: 'cliente: +8% no valor e combo mais forte', k: 'val', r: 0.08 },
    { id: 'sake', n: 'Destilaria de Sake', d: 'cliente: +15% nos bolsões dourados por nível', k: 'gold', r: 0.15 },
    { id: 'export', n: 'Exportadora', d: 'cliente: +8% de renda por nível (manda pro mundo)', k: 'sell', r: 0.08 },
  ];
  const run = () => { S = S || G.S; const r = S.stats.run || (S.stats.run = {}); r.shops = r.shops || {}; return r; };
  const ips = () => Math.max(10, G.priceIps ? G.priceIps() : (S.ips || 0));   // preço estável (não muda a cada abertura)
  const shopSum = () => Object.values(run().shops).reduce((a, b) => a + (b | 0), 0);
  const cost = {
    giant: () => { const p = D.GIANT[run().giant | 0]; return p ? Math.ceil(ips() * p.sec / 10) * 10 : 0; },
    fab: () => Math.ceil(ips() * 80 * Math.pow(1.25, run().fab | 0) / 10) * 10,
    shop: id => Math.ceil(ips() * 50 * Math.pow(1.2, run().shops[id] | 0) / 10) * 10,
  };

  function applyStats(s) {
    S = S || G.S; if (!S || !S.ended) return;
    const r = run();
    if (r.giant) s.sell *= D.GIANT[Math.min(4, r.giant) - 1].mult;
    s.sell *= 1 + 0.12 * (r.fab | 0);
    s.sell *= 1 + 0.04 * shopSum();
    const c = D.SHOPS.find(x => x.id === r.client), L = c ? r.shops[c.id] | 0 : 0;
    if (c && L) s[c.k] *= 1 + c.r * L;
    const sp = S.stats.spec || {}; let gold = 0;
    for (const id in sp) for (const ch of sp[id]) if (ch === 'd') gold++;
    s.gold *= 1 + 0.1 * gold;
  }
  // especialização: a Oficina chama ao bater um marco
  function specChoice(t, done) {
    const sp = S.stats.spec || (S.stats.spec = {}), arr = sp[t.id] || (sp[t.id] = []);
    UI.dialog({ kicker: 'Marco da ' + t.name, title: 'Pra onde ela vai?', text: 'Escolha um caminho (dá pra mudar na próxima ilha).',
      buttons: [
        { title: 'Mais rápida', sub: 'bônus desta máquina +50%', onClick: () => { arr.push('r'); done(); } },
        { title: 'Mais dourada', sub: '+10% em todos os bolsões dourados', onClick: () => { arr.push('d'); done(); } },
      ] });
  }
  const speedK = id => { const a = (S.stats.spec || {})[id] || []; return 1 + 0.5 * a.filter(c => c === 'r').length; };

  function pay(c, what, fn) {
    if (S.money < c) { UI.toast('Faltam ¥' + U.fmt(c - S.money), { icon: 'yen', tone: 'bad', sub: what }); return false; }
    S.money -= c; fn(); if (G.priceBump) G.priceBump(); api.recompute(); api.save(); api.sfx('pling'); return true;
  }
  // seções no painel da Oficina
  function fillPanel(col, refresh) {
    const r = run(), row = (o) => { const b = UI.button(col, Object.assign({ size: 'sm' }, o)); (b.el || b).style.width = '100%'; return b; };
    UI.el('div', 'k-h', col, 'Máquina gigante');
    const gp = Math.min(D.GIANT.length, r.giant | 0), part = D.GIANT[gp];   // nunca passa de 4 (save mexido não quebra a tela)
    UI.el('div', 'k-homehint', col, 'Bagger Gigante: ' + gp + '/4 peças' + (gp ? ' · renda ×' + String(D.GIANT[gp - 1].mult).replace('.', ',') : ''));
    if (part) row({ title: 'Peça ' + (gp + 1) + ': ' + part.n, sub: '¥ ' + U.fmt(cost.giant()) + ' · ' + part.d, icon: 'horn',
      onClick: () => pay(cost.giant(), part.n, () => { r.giant = gp + 1; if (api.visit) setTimeout(() => api.visit(lastRX - 300, 0.24, -420, 3.8), 300);
        if (r.giant === 4) { UI.banner('BAGGER GIGANTE!', 'duas rodas, 50% maior que a 293', { icon: 'horn', tone: 'gold', dur: 3.5 }); api.sfx('fanfare'); }
        else UI.banner(part.n + '!', 'peça ' + r.giant + ' de 4', { icon: 'gear', dur: 2 }); }) && refresh() });
    else {
      UI.el('div', 'k-homehint', col, '✓ Bagger Gêmea completa, cavando do outro lado da montanha');
      const line = UI.el('div', 'k-row', col); line.style.flexWrap = 'wrap'; line.style.gap = '4px';
      for (const [id, n] of [['kawaii', 'Pintura kawaii'], ['dino', 'Pintura dinossauro'], ['normal', 'Pintura de fábrica']]) {
        UI.button(line, { title: ((r.paint || 'kawaii') === id ? '✓ ' : '') + n, size: 'sm', onClick: () => { r.paint = id; api.save(); if (api.visit) api.visit(lastRX - 300, 0.24, -420, 2.5); refresh(); } });
      }
    }
    UI.el('div', 'k-h', col, 'Fábrica no pé da montanha · nível ' + (r.fab | 0));
    row({ title: 'Ampliar a fábrica', sub: '¥ ' + U.fmt(cost.fab()) + ' · +12% de renda · ' + nextFab(r.fab | 0), icon: 'gear', onClick: () => pay(cost.fab(), 'Fábrica', () => { r.fab = (r.fab | 0) + 1; }) && refresh() });
    UI.el('div', 'k-h', col, 'Cidade que compra');
    UI.el('div', 'k-homehint', col, 'cada nível de loja +4% de renda; a cliente escolhida ganha o bônus dela');
    for (const sh of D.SHOPS) {
      const L = r.shops[sh.id] | 0, on = r.client === sh.id;
      row({ title: (on ? '★ ' : '') + sh.n + ' · nível ' + L, sub: '¥ ' + U.fmt(cost.shop(sh.id)) + ' · ' + sh.d, icon: on ? 'star' : 'rice',
        onClick: () => pay(cost.shop(sh.id), sh.n, () => { r.shops[sh.id] = L + 1; if (!r.client) r.client = sh.id; }) && refresh() });
    }
    const owned = D.SHOPS.filter(sh => r.shops[sh.id]);
    if (owned.length > 1) {
      const line = UI.el('div', 'k-row', col); line.style.flexWrap = 'wrap'; line.style.gap = '4px';
      UI.el('div', 'k-homehint', col, 'trocar a cliente (de graça):');
      for (const sh of owned) UI.button(line, { title: (r.client === sh.id ? '✓ ' : '') + sh.n, size: 'sm', onClick: () => { r.client = sh.id; api.recompute(); api.save(); refresh(); } });
    }
  }
  const nextFab = L => L < 1 ? 'esteira' : L < 3 ? 'Komes empacotando' : L < 5 ? 'braço robô' : L < 7 ? 'robozinhos' : 'mais de tudo';

  /* ---- mundo ---- */
  let twin = null, belt = null, bt = 0, lastRX = 8420;
  const TI = { x: 0, y: 0, digging: true, zoom: 1, floor: null };
  function tick(dt, ctx) {
    S = S || G.S; if (!S.ended) return;
    const r = run();
    const gp = r.giant | 0;
    if (gp) {   // a gêmea trabalha do OUTRO lado da montanha, virada pra cá (a nossa continua sozinha na tela)
      if (!twin) twin = { m: G.Tools.bagger.create({ stage: 1 }) };
      const o = twin;
      o.m.stage = Math.min(3, gp); o.m.wheels = gp >= 4 ? 2 : 1;
      lastRX = ctx.rightX; TI.x = ctx.rightX; TI.y = 0; TI.floor = ctx.floor; TI.zoom = ctx.zoom; TI.digging = gp >= 3; TI.face = -1;
      if (o.m.x === undefined || Math.abs(o.m.x - TI.x) > 3000) o.m.x = TI.x;
      G.Tools.bagger.update(o.m, dt, TI);
    }
  }
  // gêmea: lado a lado com a primeira, um pouco atrás (menor, mais escura e mais alta = profundidade)
  // atrás: a cópia escura lá no fundo (maior ainda e mais alta), depois a Gigante (1,5×) logo atrás da 293
  // pintura da gêmea (filtro de cor por cima do desenho: rápido e sem redesenhar a máquina)
  const TWIN_PAINT = { kawaii: 'hue-rotate(300deg) saturate(1.5) brightness(1.08)', dino: 'hue-rotate(75deg) saturate(1.35) brightness(0.95)', normal: 'none' };
  // a gêmea (1,5×, duas rodas) do outro lado da montanha; sem cópia escura
  function drawBack(g, t) {
    if (!(twin && (run().giant | 0) && S.ended)) return;
    const m = twin.m, swapped = !!S.twinPlay;
    m.wheels = swapped ? 1 : 2; m.pilot = 'goma';
    const kk = swapped ? 1 : 1.5;
    g.save(); g.translate(m.x, 0); g.scale(kk, kk); g.translate(-m.x, 0);
    try { g.filter = swapped ? 'none' : TWIN_PAINT[G.twinPaint || run().paint || 'kawaii']; } catch (e) { /* navegador sem filter: cor normal */ }
    G.Tools.bagger.draw(g, m);
    try { g.filter = 'none'; } catch (e) { /* */ }
    g.restore();
  }

  /* ---- fábrica KOME PACK em pixel art (mesmo jeito das coisas do jardim: E.sprite + contorno + bevel) ----
     Coordenadas em "pixels de arte": chão em y=0, ancorada em AX no mundo, cada pixel vale K unidades de mundo. */
  const K = 4, AX = -520, SP = E.sprite;
  const PC = { wall: '#F0E6D2', beam: '#8E5E3C', roof: '#B5523B', roofD: '#8E3A2A', win: '#8FB6D3', lit: '#FFD67A', door: '#6B4A32',
    red: '#D8574E', cream: '#FFF8EC', steel: '#8A96A3', steelD: '#5E6A77', yel: '#E8B02E', belt: '#3A3A40', ora: '#E8893A', sack: '#EFE3C4', blue: '#5C7FA8' };
  const galpao = lit => SP('fab/galpao' + (lit ? 'L' : ''), 124, 80, P => {
    P.rect(4, 30, 116, 50, PC.wall);
    for (let x = 4; x < 120; x += 19) P.rect(x, 30, 3, 50, PC.beam);
    P.rect(4, 30, 116, 3, PC.beam);
    for (let i = 0; i < 4; i++) { const wx = 12 + i * 27; P.rect(wx, 40, 15, 11, lit ? PC.lit : PC.win); P.rect(wx + 7, 40, 1, 11, PC.beam); P.rect(wx, 45, 15, 1, PC.beam); }
    P.rect(48, 56, 26, 24, PC.door); for (let x = 50; x < 74; x += 4) P.rect(x, 57, 1, 23, '#4E3424');
    P.poly([[0, 31], [124, 31], [108, 8], [16, 8]], PC.roof);
    for (let x = 4; x < 122; x += 4) P.line(x, 30, x < 62 ? x + 8 : x - 8, 10, 1, PC.roofD);
    P.rect(40, 14, 44, 12, PC.cream); P.ell(50, 20, 4, 4, PC.red);
    for (const [x, w] of [[58, 2], [62, 3], [67, 3], [72, 3], [77, 3]]) P.rect(x, 17, w, 6, PC.red);
    P.set(50, 18, PC.cream).set(49, 20, PC.cream).set(51, 21, PC.cream);
    P.bevel(0.25, 0.22);
  });
  const chamine = () => SP('fab/chamine', 12, 46, P => { P.rect(2, 2, 8, 44, PC.steel); P.rect(1, 0, 10, 4, PC.steelD); P.rect(2, 10, 8, 3, PC.red); P.rect(2, 24, 8, 3, PC.red); P.bevel(0.3, 0.25); });
  const mesa = () => SP('fab/mesa', 36, 14, P => { P.rect(0, 0, 36, 4, '#C99A5B'); P.rect(2, 4, 3, 10, PC.beam); P.rect(31, 4, 3, 10, PC.beam); P.rect(2, 9, 32, 2, PC.beam); P.bevel(0.3, 0.25); });
  const saco = () => SP('fab/saco', 10, 11, P => { P.poly([[1, 10], [0, 4], [2, 1], [8, 1], [10, 4], [9, 10]], PC.sack); P.rect(4, 0, 2, 2, '#C9B48A'); P.rect(3, 5, 4, 3, PC.red); P.bevel(0.3, 0.25); });
  const fumaca = r => SP('fab/fum' + r, r * 2 + 2, r * 2 + 2, P => { P.ell(r + 1, r + 1, r, r, '#E8E8E8'); P.bevel(0.2, 0.15); });
  const esteira = f => SP('fab/est' + f, 92, 14, P => {
    P.rect(0, 2, 92, 5, PC.belt);
    for (let x = 2 + f * 2; x < 90; x += 8) P.rect(x, 3, 2, 3, '#55555C');
    P.rect(0, 7, 92, 2, PC.yel);
    for (const x of [4, 30, 58, 84]) P.rect(x, 9, 3, 5, PC.yel);
    P.bevel(0.25, 0.2);
  });
  const robo = (f, full) => SP('fab/robo' + f + (full ? 'S' : ''), 16, 22, P => {
    P.rect(1, 10, 14, 8, PC.blue); P.rect(4, 12, 6, 3, '#9FE0FF');
    for (const wx of [4, 11]) { P.ell(wx, 19, 2.5, 2.5, '#2A2A2E'); P.set(wx + (f ? 1 : 0), 19 - (f ? 0 : 1), '#8A8A90'); }
    P.rect(12, 6, 1, 4, PC.steelD); P.set(12, 5, f ? '#FF6B6B' : '#9FE0FF');
    if (full) { P.poly([[3, 10], [3, 4], [5, 2], [10, 2], [12, 4], [12, 10]], PC.sack); P.rect(6, 5, 3, 3, PC.red); }
    P.bevel(0.3, 0.25);
  });
  const braco = k => SP('fab/braco' + k, 100, 72, P => {
    const u = 0.5 - 0.5 * Math.cos(k / 12 * Math.PI * 2), tx = 90 - u * 66, ty = 54 - Math.sin(u * Math.PI) * 10, bx = 70, by = 64, L1 = 30, L2 = 30;
    const d = Math.min(L1 + L2 - 0.1, Math.hypot(tx - bx, ty - by)), a = Math.atan2(ty - by, tx - bx), c = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
    const ex = bx + Math.cos(a - c) * L1, ey = by + Math.sin(a - c) * L1;
    P.rect(bx - 6, by, 12, 8, PC.steel); P.rect(bx - 6, by + 6, 12, 2, PC.steelD);
    P.line(bx, by, ex, ey, 4, PC.ora).line(ex, ey, tx, ty, 3, PC.ora);
    P.ell(bx, by, 3, 3, PC.steelD).ell(ex, ey, 2.5, 2.5, PC.steelD);
    const open = u > 0.9 || u < 0.05;
    P.rect(tx - 4 - (open ? 1 : 0), ty + 1, 2, 5, '#3A3A40').rect(tx + 2 + (open ? 1 : 0), ty + 1, 2, 5, '#3A3A40');
    if (!open) { P.poly([[tx - 4, ty + 15], [tx - 4, ty + 8], [tx - 2, ty + 6], [tx + 2, ty + 6], [tx + 4, ty + 8], [tx + 4, ty + 15]], PC.sack); P.rect(tx - 1, ty + 9, 3, 2, PC.red); }
    P.bevel(0.3, 0.22);
  });
  const blitAt = (g, cv, x, y) => g.drawImage(cv, Math.round(x), Math.round(y) - cv.height);
  /* ---- o galpão TRABALHANDO (quando a Fábrica está aberta): porta aberta com luz, caixas saindo numa esteirinha,
     kei-truck que carrega, vai embora pelo pátio e volta, vapor da chaminé conforme a produção, luz acesa de noite.
     Tudo sai do relógio t (sem estado): ciclo de 16 s = 8 carregando, 2,5 saindo, 2,5 fora, 3 voltando de ré. ---- */
  const estCurta = f => SP('fab/estc' + f, 56, 14, P => {
    P.rect(0, 2, 56, 5, PC.belt);
    for (let x = 6 - f * 2; x < 54; x += 8) if (x >= 0) P.rect(x, 3, 2, 3, '#55555C');
    P.rect(0, 7, 56, 2, PC.yel);
    for (const x of [3, 26, 50]) P.rect(x, 9, 3, 5, PC.yel);
    P.bevel(0.25, 0.2);
  });
  const caixa = () => SP('fab/caixa', 9, 9, P => { P.rect(1, 1, 7, 7, '#D9A066'); P.rect(1, 1, 7, 2, '#EBBE86'); P.rect(4, 1, 1, 7, PC.cream); P.rect(2, 4, 2, 2, PC.red); P.rect(1, 7, 7, 1, '#B07C46'); });
  function working(g, t, act) {
    const night = S.tod > 0.62, T = 16, u = (t % T), a = Math.max(0.15, act);
    // porta aberta (por cima da porta fechada do desenho) com a luz de dentro
    g.fillStyle = PAL.line; g.fillRect(-217, -23, 22, 23);
    g.fillStyle = night ? '#FFD67A' : '#5A3E2A'; g.fillRect(-216, -22, 20, 22);
    g.fillStyle = night ? '#FFE9A8' : '#7A5638'; g.fillRect(-216, -22, 20, 4);
    g.fillStyle = night ? '#E8B02E' : '#3E2A1C'; g.fillRect(-216, -9, 20, 9);
    if (night) { g.globalAlpha = 0.22; g.fillStyle = '#FFD67A'; g.beginPath(); g.moveTo(-216, 0); g.lineTo(-196, 0); g.lineTo(-180, 14); g.lineTo(-236, 14); g.closePath(); g.fill(); g.globalAlpha = 1; }
    // vapor/fumaça da chaminé: mais e maior com a fábrica rendendo
    const n = 2 + Math.round(a * 6);
    for (let i = 0; i < n; i++) {
      const q = (t * (0.22 + a * 0.2) + i / n) % 1, rr = 2 + Math.round(q * (2 + a * 6));
      const px = Math.round(-116 + q * (10 + a * 16) + Math.sin(t * 1.3 + i * 2) * 3), py = Math.round(-72 - q * (26 + a * 34));
      g.globalAlpha = 0.85 * (1 - q); g.fillStyle = '#F4F2EA'; g.fillRect(px - rr, py - rr + 1, rr * 2, rr * 2 - 2); g.fillRect(px - rr + 1, py - rr, rr * 2 - 2, rr * 2); g.fillStyle = '#DDD9CC'; g.fillRect(px - rr + 1, py + rr - 2, rr * 2 - 2, 1);   // baforada em pixel (sem contorno)
    }
    g.globalAlpha = 1;
    // esteirinha da porta pra esquerda, com as caixas andando
    blitAt(g, estCurta(Math.floor(t * 8) % 4), -268, 0);
    const loading = u < 8;
    for (let i = 0; i < 4; i++) {
      const q = (t * 0.32 + i / 4) % 1; if (!loading && q > 0.72) continue;      // sem caminhão as caixas esperam na ponta
      blitAt(g, caixa(), -213 - q * 52, -11 + (q < 0.1 ? (0.1 - q) * 30 : 0));
    }
    // kei-truck (o mesmo sprite da tela da fábrica), de frente pra esquerda
    const tr = G.FabArt && G.FabArt.spr && G.FabArt.spr.truck; if (!tr) return;
    let dx = 0, al = 1, boxes = 0, moving = false;
    if (u < 8) boxes = Math.min(6, Math.floor(u / 8 * 7));
    else if (u < 10.5) { const k = (u - 8) / 2.5; dx = -U.ease.in(k) * 230; al = 1 - Math.max(0, k - 0.7) / 0.3; boxes = 6; moving = true; }
    else if (u < 13) al = 0;
    else { const k = (u - 13) / 3; dx = -(1 - U.ease.out(k)) * 230; al = Math.min(1, k / 0.25); moving = true; }
    if (al <= 0) return;
    const tx = -292 + dx, bob = moving ? Math.abs(Math.sin(t * 20)) * 0.6 : 0;
    g.globalAlpha = al;
    if (moving) for (let i = 0; i < 3; i++) { const q = (t * 2.2 + i / 3) % 1; g.fillStyle = 'rgba(214,196,160,' + (0.6 * (1 - q)).toFixed(2) + ')'; g.beginPath(); g.arc(tx + 24 + q * 14, -3 - q * 5, 2 + q * 3, 0, 6.3); g.fill(); }
    for (let i = 0; i < boxes; i++) blitAt(g, caixa(), tx + 2 + (i % 3) * 7, -13 - Math.floor(i / 3) * 7 - bob);
    if (loading && boxes < 6) { const hq = (u / 8 * 7) % 1; if (hq < 0.5) blitAt(g, caixa(), -268 - hq * 2 * 14, -12 - Math.sin(hq * 2 * Math.PI) * 10); }   // caixa pulando da esteira pra carroceria
    g.save(); g.translate(Math.round(tx), -bob); g.scale(-0.75, 0.75); g.drawImage(tr, -28, -31); g.restore();
    if (night && moving) { g.globalAlpha = al * 0.3; g.fillStyle = '#FFE9A8'; g.beginPath(); g.moveTo(tx - 20, -9); g.lineTo(tx - 60, -18); g.lineTo(tx - 60, 0); g.closePath(); g.fill(); }
    g.globalAlpha = 1;
  }
  function drawFront(g, t, ctx) {
    const fabOn = !!(G.Fab && G.Fab.on && G.Fab.on());   // a Fábrica (tela de cima) aberta já faz o galpão aparecer e trabalhar
    const L = Math.max(S.ended ? run().fab | 0 : 0, fabOn ? 1 : 0); if (L < 1) return;
    drawFactory(g, t, AX, 0, K, L, fabOn ? (G.Fab.activity ? G.Fab.activity() : 0.5) : -1);
  }
  // drawFactory(g, t, x, y, k, nível): desenha a fábrica em qualquer lugar (o jogo usa AX/K; demos e prints usam o que quiserem)
  function drawFactory(g, t, ax, ay, kk, L, act) {
    g.save(); g.translate(ax, ay); g.scale(kk, kk); const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
    const artOk = !!(E.Assets && E.Assets.ready && E.Assets.ready('fabrica_kome_pack'));   // galpão gerado já tem chaminé e fumaça
    if (!artOk) for (let i = 0; i < 5; i++) { const q = (t * 0.35 + i / 5) % 1, rr = 2 + Math.round(q * (3 + Math.min(4, L / 2))); g.globalAlpha = 0.85 * (1 - q); blitAt(g, fumaca(rr), -168 + q * 14 + Math.sin(t + i) * 2 - rr, -104 - q * 40 + rr); }
    g.globalAlpha = 1;
    if (!artOk) blitAt(g, chamine(), -174, -58);
    if (!(E.Assets && E.Assets.ready && E.Assets.ready('fabrica_kome_pack') && (E.Assets.draw(g, 'fabrica_kome_pack', S.tod > 0.62 ? E.Assets.get('fabrica_kome_pack').anims.noite.from : E.Assets.get('fabrica_kome_pack').anims.fumaca.from + (Math.floor(t * 6) % 6), -206, 2, { scale: 1 }), true))) blitAt(g, galpao(S.tod > 0.62), -268, 0);
    const pile = 2 + Math.min(10, L * 2);
    for (let i = 0; i < pile; i++) blitAt(g, saco(), -142 + (i % 2) * 9 - (i >> 2) * 2, -Math.floor(i / 4) * 8 - ((i >> 1) % 2) * 4);
    const nK = L >= 2 ? Math.min(3, L - 1) : 0;
    for (let i = 0; i < nK; i++) { const ph = (t * 1.3 + i * 0.7) % 2; E.drawShiba(g, -112 + i * 12, -3, ph < 1 ? 'dig' : 'wag', t + i, { scale: 0.5, pal: ['goma', 'kuro', 'shiro'][i] }); }
    blitAt(g, mesa(), -122, 0);
    blitAt(g, esteira(Math.floor(t * 8) % 4), -88, 0);
    for (let i = 0; i < 6; i++) { const q = (t * 0.25 + i / 6) % 1, x = Math.round(-6 - q * 80); g.fillStyle = PAL.line; g.fillRect(x - 1, -14, 7, 3); g.fillStyle = PC.cream; g.fillRect(x, -14, 5, 2); }
    if (act !== undefined && act >= 0) working(g, t, act);
    if (L >= 4) blitAt(g, braco(Math.floor(t * 6) % 12), -110, 0);
    if (L >= 6) {
      const n = Math.min(4, L - 5);
      for (let i = 0; i < n; i++) {
        const q = (t * 0.06 + i / n) % 1, go = q < 0.5, x = go ? -150 - q * 2 * 170 : -320 + (q - 0.5) * 2 * 170, f = Math.floor(t * 8 + i) % 2;
        g.save(); g.translate(Math.round(x), 0); if (go) g.scale(-1, 1); blitAt(g, robo(f, go), -8, 0); g.restore();
      }
    }
    g.imageSmoothingEnabled = sm; g.restore();
  }

  const zoomK = () => 1;   // a gêmea fica do outro lado: a câmera daqui não precisa abrir

  G.Ind = {
    init(a) { api = a; S = G.S; },
    sim: { cost, pay, run },   // tools/longo.js
    paintFilter: () => TWIN_PAINT[G.twinPaint || run().paint || 'kawaii'],
    showTwin: () => api.visit && api.visit(lastRX - 300, 0.24, -420, 3.8),   // câmera vai até a gêmea (compra de peça e testes)
    applyStats, fillPanel, tick, drawBack, drawFront, drawFactory, zoomK, specChoice, speedK, run,
  };
})();
