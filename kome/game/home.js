/* Kome no Japão — home.js
   Casa do Kome (rodada de 16/11, etapa 3): botão "Casa" no HUD abre o quintal. O jogo pausa por baixo.
   Lá o jogador compra enfeites e bichinhos (só visual, preço = segundos da renda atual), troca de roupa e escolhe o tema
   de fundo (primavera/verão/outono/inverno), que também faz cair pétalas, folhas ou neve no jogo.
   Estado em S.homeData = { own:{id:1}, hide:{id:1}, theme, newCloth }. Liga-se por G.Home.init(api) em game.js. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data, PAL = E.PAL, Draw = E.Draw;
  let openTab = null, api = null, S = null, panel = null, open = false, t0 = 0, pond = null, koi = null, bf = null, ff = null, birds = null;
  const H0 = () => S.homeData || (S.homeData = { own: {}, hide: {}, theme: 'verao' });
  const has = id => !!(H0().own[id] && !H0().hide[id]);
  const cost = it => it.sec ? Math.max(50, Math.ceil(it.sec * Math.max(5, G.priceIps ? G.priceIps() : (S.ips || 0)) / 10) * 10) : 0;

  /* ---- coisas caindo do céu (tema) — tela inteira, leve, sem E.Particles ---- */
  const fall = [];
  function fallTick(dt, W, H, kind, rate) {
    if (!kind) { fall.length = 0; return; }
    const want = Math.round((kind === 'snow' ? 70 : 34) * rate);
    while (fall.length < want) fall.push({ x: Math.random() * W, y: -10 - Math.random() * H, s: 0.6 + Math.random() * 0.8, ph: Math.random() * 6.3, k: kind });
    if (fall.length > want) fall.length = want;
    for (const p of fall) {
      if (p.k !== kind) p.k = kind;
      const sp = kind === 'snow' ? 34 : kind === 'leaf' ? 52 : 40;
      p.ph += dt * (kind === 'snow' ? 1.2 : 2.4);
      p.y += sp * p.s * dt; p.x += (Math.sin(p.ph) * 22 + (kind === 'snow' ? 6 : 26)) * dt;
      if (p.y > H + 10 || p.x > W + 20) { p.y = -10; p.x = Math.random() * W * 1.1 - W * 0.1; }
    }
  }
  function fallDraw(g) {
    for (const p of fall) {
      g.save(); g.translate(p.x, p.y);
      if (p.k === 'snow') { g.fillStyle = '#FFFFFF'; g.globalAlpha = 0.85; g.beginPath(); g.arc(0, 0, 1.6 + p.s * 1.4, 0, 6.3); g.fill(); }
      else {
        g.rotate(p.ph); g.scale(1, Math.abs(Math.cos(p.ph * 0.7)) * 0.8 + 0.2);
        g.fillStyle = p.k === 'leaf' ? (p.s > 1 ? '#D8574E' : '#E8893A') : (p.s > 1 ? '#F6B6C8' : '#FBD3DE');
        g.strokeStyle = PAL.line; g.lineWidth = 0.8;
        g.beginPath(); g.ellipse(0, 0, 4.2 * p.s + 1.5, 2.4 * p.s + 0.8, 0, 0, 6.3); g.fill(); g.stroke();
      }
      g.restore();
    }
  }
  // chamado pelo render do jogo (coordenadas de tela lógicas)
  function worldFX(g, dt, W, H) {
    const th = D.themeById[H0().theme] || D.THEMES[0];
    if (open) return;
    fallTick(dt, W, H, th.fall, 0.6);
    if (!th.fall && !th.tint) return;
    if (th.tint) { g.fillStyle = th.tint; g.fillRect(0, 0, W, H); }
    fallDraw(g);
  }

  /* ---- VIDA NO QUINTAL: cada bicho tem um cerebrinho (anda até um ponto, para fazendo alguma coisa, anda de novo) ----
     posição em fração da largura visível (o quintal se ajeita quando o painel abre). */
  const brains = {};
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function brain(id, home, range, idles, spd) {
    let b = brains[id];
    if (!b) b = brains[id] = { f: home + (Math.random() * 2 - 1) * range * 0.5, tf: home, st: 'idle', T: Math.random() * 3, face: Math.random() < 0.5 ? -1 : 1, idle: idles[0], home, range, idles, spd };
    b.home = home; b.range = range; b.idles = idles; return b;
  }
  function think(dt) {
    for (const id in brains) {
      const b = brains[id]; b.T -= dt;
      if (b.st === 'walk') {
        const d = b.tf - b.f, s = b.spd * dt; b.face = d < 0 ? -1 : 1;
        if (Math.abs(d) <= s) { b.f = b.tf; b.st = 'idle'; b.idle = pick(b.idles); b.T = 2.5 + Math.random() * (b.idle === 'dormir' || b.idle === 'sleep' || b.idle === 'lie' ? 7 : 4); }
        else b.f += Math.sign(d) * s;
      } else if (b.T <= 0) { b.st = 'walk'; b.tf = b.home + (Math.random() * 2 - 1) * b.range; if (Math.abs(b.tf - b.f) < 0.03) b.tf = b.home + (b.f > b.home ? -1 : 1) * b.range * 0.7; }
    }
  }
  const PET_IDLE = ['parado', 'sentar', 'abanar', 'comer', 'feliz', 'parado', 'dormir', 'pular'];

  /* ---- cena do quintal ---- */
  function scene(g, t, W, H) {
    const N = E.Nature, th = D.themeById[H0().theme] || D.THEMES[0];
    // o painel cobre a direita: o quintal se arruma na parte visível (VW)
    let VW = W;
    if (panel && panel.isOpen && panel.el) { const r = panel.el.getBoundingClientRect(), cv = api.canvasRect(); if (cv && cv.width) VW = U.clamp((r.left - cv.left) / cv.width * W, W * 0.5, W); }
    const GY = Math.round(H * 0.7), k = U.clamp(VW / 700, 0.75, 1.35), X = f => VW * f, hx = X(0.42);
    const tod = th.id === 'outono' ? 0.6 : th.id === 'inverno' ? 0.42 : 0.36;
    if (N && N.sky) N.sky(g, W, GY + 40, { tod, t, stars: false }); else { g.fillStyle = '#9FD3F0'; g.fillRect(0, 0, W, H); }
    if (N && N.fuji) N.fuji(g, X(0.74), GY - 24, 1.3 * k, { tod, t });
    if (N && N.hills) N.hills(g, W, GY - 6, 0, { col: th.id === 'inverno' ? '#C9D6E2' : '#8DB46A', amp: 22, seed: 3, tod });
    if (has('passaros') && birds) birds.draw(g, VW, H, 0);
    if (N && N.ground) N.ground(g, 0, W, GY, { t, seed: 2, col: th.id === 'inverno' ? '#E8EEF4' : th.id === 'outono' ? '#B9A55A' : undefined, depth: H - GY + 4 });
    else { g.fillStyle = '#7BAE4E'; g.fillRect(0, GY, W, H - GY); }
    // fundo do quintal
    if (N) {
      if (has('bambu')) { N.tree(g, X(0.95), GY + 2, { kind: 'bamboo', seed: 4, t, s: 1.3 * k }); N.tree(g, X(0.99), GY + 4, { kind: 'bamboo', seed: 9, t, s: 1.15 * k }); }
      if (has('sakura')) N.tree(g, X(0.08), GY + 3, { kind: 'sakura', seed: 2, t, s: 1.35 * k });
      if (has('momiji')) N.tree(g, X(0.8), GY + 3, { kind: 'maple', seed: 6, t, s: 1.2 * k });
      if (has('koinobori')) N.koinobori(g, X(0.2), GY + 2, { t, s: k, h: 130 });
      if (has('torii')) N.torii(g, X(0.66), GY + 4, 1.05 * k, { t });
      if (has('sino')) { const sx = X(0.58), sy = GY - 104 * k, wd = PAL.wood || '#8B5A2B'; Draw.box(g, sx - 3, sy - 4, 6, GY - sy + 6, wd, { r: 2 }); Draw.box(g, sx - 3, sy - 6, 30, 6, wd, { r: 2 }); N.windchime(g, sx + 22, sy, { t, s: 1.1 * k }); }
    }
    // casa no estágio atual
    if (N && N.house) {
      if (S.house > 0) N.house(g, hx, GY + 2, { stage: S.house - 1, s: 1.35 * k, t, lit: false });
      else if (G.World && G.World.drawPlot) { G.World.drawPlot(g, hx, GY + 6, 2); Draw.text(g, 'À VENDA', hx + 30, GY - 70, { size: 12, col: PAL.red, sw: 0, weight: 900 }); }
    }
    // frente do quintal (mais perto = mais embaixo na tela)
    if (N) {
      if (has('lanterna')) N.lantern(g, X(0.24), GY + 12, 1.05 * k, { t, lit: 0.2 });
      if (has('pedras')) { N.rock(g, X(0.62), GY + 18, { seed: 4, w: 24, h: 14, moss: true }); N.rock(g, X(0.645), GY + 22, { seed: 7, w: 15, h: 9 }); }
      if (has('bonsai')) N.tree(g, X(0.53), GY + 16, { kind: 'bonsai', seed: 3, t, s: 0.95 * k });
      if (has('onsen')) N.onsen(g, X(0.9), GY + 40, { t, s: 0.85 * k, guest: has('capivara'), screen: false });
      if (has('lago') && pond) { pond.x = X(0.72); pond.y = GY + 76; pond.draw(g, t); }
      if (has('flores')) ['tanpopo', 'iris', 'ajisai', 'tulip', 'daisy'].forEach((f, i) => N.flower(g, X(0.1) + i * 13, GY + 26 + (i % 2) * 8, { kind: f, seed: i + 1, t, s: 1.15 * k }));
    }
    // enfeites e bichinhos vindos das fichas (conteudo/): pixel em texto, posição e escala da ficha
    for (const it of D.DECOR) {
      if (!it.fromCard || !has(it.id)) continue;
      if (it.anim && E.Anim && E.Assets && E.Assets.ready && E.Assets.ready(it.anim)) {   // arte animada (Pixxel Estúdio)
        const A = it._a || (it._a = E.Anim(it.anim, 'parado')), anda = it.kind === 'pet', hx0 = it.onde.x !== undefined ? it.onde.x : 0.5;
        const an = (E.Assets.get(it.anim) || {}).anims || {};
        const b = anda ? brain(it.id, hx0, 0.16, PET_IDLE.filter(n => an[n]), 0.05) : null;
        A.play(!anda ? (it.tagParado || 'parado') : b.st === 'walk' ? (it.tagAnda || 'andar') : b.idle); if (b) A.flip = b.face < 0; A.update(1 / 60);
        const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
        A.draw(g, Math.round(X(b ? b.f : hx0)), Math.round(GY + (it.onde.y || 0)), { scale: Math.max(1, Math.round((it.escala || 2) * k)) });
        g.imageSmoothingEnabled = sm; continue;
      }
      if (!it.sprite) continue;
      const cv = it.sprite(); if (!cv) continue;
      const hx1 = it.onde.x !== undefined ? it.onde.x : 0.5, bb = it.anda ? brain(it.id, hx1, 0.14, ['parado'], 0.05) : null, ox = X(bb ? bb.f : hx1);
      const sc = Math.max(1, Math.round((it.escala || 2) * k)), oy = GY + (it.onde.y || 0) + (bb && bb.st === 'walk' ? -Math.abs(Math.sin(t * 9 + hx1 * 7)) * 3 : 0);
      const px = ox, sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
      g.drawImage(cv, Math.round(px - cv.width * sc / 2), Math.round(oy - cv.height * sc), cv.width * sc, cv.height * sc); g.imageSmoothingEnabled = sm;
    }
    // amigos shiba (cada um no seu canto, trocando de pose) e o Kome na frente da casa
    const spots = [[0.17, 64], [0.31, 84], [0.6, 40]], poses = ['sit', 'wag', 'lie', 'sleep', 'sniff', 'scratch', 'stretch', 'yawn', 'eat', 'dance'];
    D.DECOR.filter(x => x.pal && has(x.id)).forEach((f, i) => {
      const sp = spots[i % spots.length], b = brain('shiba_' + f.id, sp[0], 0.12, poses, 0.06);
      const pose = b.st === 'walk' ? 'walk' : b.idle;
      E.drawShiba(g, X(b.f), GY + sp[1], pose, t + i, { scale: 1.8 * k, pal: f.pal, flip: b.face < 0 });
    });
    { const kb = brain('kome', 0.47, 0.08, ['sit', 'wag', 'sit', 'stretch', 'yawn', 'dance', 'sniff'], 0.05);
      const pose = kb.st === 'walk' ? 'walk' : kb.idle, kx = X(kb.f), ky = GY + 62, ks = 2.1 * k;
      E.drawShiba(g, kx, ky, pose, t, { scale: ks, pal: S.look.pal || 'kome', flip: kb.face < 0 });
      if (S.look.acc && G.drawAccAt && E.shibaAnchor) { const hd = E.shibaAnchor(pose, t, 'head'), fl = kb.face < 0 ? -1 : 1; G.drawAccAt(g, t, { x: kx + hd.x * ks * fl, y: ky + hd.y * ks, f: fl, sc: ks, a: 0 }, S.look.acc); } }
    if (has('borboletas') && bf) bf.draw(g);
    if (has('vagalumes') && ff) ff.draw(g, 0.9);
    if (th.tint) { g.fillStyle = th.tint; g.fillRect(0, 0, W, H); }
    fallDraw(g);
    Draw.text(g, 'Casa do Kome', VW / 2, 40, { size: 30, col: PAL.cream, sw: 5 });
    Draw.text(g, 'dia ' + (S.day || 1) + ' · ' + countOwned() + '/' + D.DECOR.length + ' no quintal', VW / 2, 70, { size: 15, col: PAL.cream, sw: 3 });
  }
  const countOwned = () => D.DECOR.filter(x => H0().own[x.id]).length;

  /* ---- painel ---- */
  function buildPanel() {
    panel = UI.panel({ title: 'Casa do Kome', icon: 'house', side: 'right', dim: false, onClose: () => { if (open) close(true); },
      tabs: [{ id: 'jardim', label: 'Jardim', icon: 'tree' }, { id: 'bichos', label: 'Bichinhos', icon: 'paw' }, { id: 'roupa', label: 'Roupas', icon: 'hat' }, { id: 'tema', label: 'Tema', icon: 'star' }, { id: 'caderno', label: 'Caderno', icon: 'book' }, { id: 'ilhas', label: 'Ilhas', icon: 'star' }, { id: 'armazem', label: 'Armazém', icon: 'rice' }] });
    panel.el.classList.add('k-homepanel');
    const back = UI.button(panel.body, { title: 'Voltar a cavar', icon: 'rice', size: 'sm', tone: 'red', onClick: () => close() });
    panel.body.insertBefore(back.el || back, panel.body.firstChild);
  }
  // ícone de roupa: rosto do Kome com a cor (ou com o acessório); bloqueada vira silhueta
  const iconCache = {};
  function clothIcon(it, ok) {
    const k = it.id + (ok ? '1' : '0'); if (iconCache[k]) return iconCache[k];
    const c = document.createElement('canvas'); c.width = c.height = 44; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    try {
      E.drawShibaHead(g, 22, 25, 0, { scale: 1.6, pal: it.kind === 'pal' ? it.id : 'kome', still: true });
      if (it.kind === 'acc' && G.drawAccAt) G.drawAccAt(g, 0, { x: 22, y: 25, f: 1, sc: 1.55, a: 0 }, it.id);
    } catch (e) { /* sem ícone */ }
    if (!ok) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(60,45,35,.82)'; g.fillRect(0, 0, 44, 44); }
    return (iconCache[k] = c);
  }
  function list(pane, items, onPick, state, iconFn) {
    pane.innerHTML = '';
    const wrap = UI.el('div', 'k-col', pane); wrap.style.padding = '6px 0';
    for (const it of items) {
      const st = state(it);
      const b = UI.button(wrap, { title: (st.on ? '✓ ' : '') + it.n, sub: st.sub, size: 'sm', icon: iconFn ? iconFn(it, st) : undefined, iconSize: iconFn ? 34 : undefined, onClick: () => { onPick(it, st); refresh(); } });
      const el = b.el || b; el.style.width = '100%';
      if (st.dim) el.style.opacity = '0.55';
      UI.tooltip && UI.tooltip(el, () => it.d || '');
    }
  }
  function buy(it) {
    const c = cost(it);
    if (it.needs && !H0().own[it.needs]) { UI.toast('Precisa: ' + D.decorById[it.needs].n, { icon: 'lock', tone: 'bad' }); return; }
    if (S.money < c) { UI.toast('Faltam ¥' + U.fmt(c - S.money), { icon: 'yen', tone: 'bad', sub: it.n }); return; }
    S.money -= c; H0().own[it.id] = 1; delete H0().hide[it.id]; if (G.priceBump) G.priceBump();
    api.sfx('pling'); UI.toast(it.n + ' chegou!', { icon: 'star', tone: 'gold', sub: it.d });
    api.save();
  }
  function refresh() {
    if (!panel || !panel.tabs) return;
    const T = panel.tabs, own = H0().own;
    if (G.Goals && T.pane('caderno') && !T.pane('caderno').firstChild) G.Goals.mountIn(T.pane('caderno'));
    if (G.Islands && T.pane('ilhas')) G.Islands.fill(T.pane('ilhas'));
    if (G.Items && T.pane('armazem')) G.Items.fill(T.pane('armazem'));
    const st = it => own[it.id] ? { on: !H0().hide[it.id], sub: H0().hide[it.id] ? 'guardado · toque pra pôr' : 'no quintal · toque pra guardar' }
      : { on: false, dim: S.money < cost(it) || (it.needs && !own[it.needs]), sub: '¥ ' + U.fmt(cost(it)) };
    const pick = it => { if (own[it.id]) { if (H0().hide[it.id]) delete H0().hide[it.id]; else H0().hide[it.id] = 1; api.save(); } else buy(it); };
    list(T.pane('jardim'), D.DECOR.filter(x => x.kind === 'decor'), pick, st);
    list(T.pane('bichos'), D.DECOR.filter(x => x.kind === 'pet'), pick, st);
    // roupas: os achados enterrados (mesma lista do guarda-roupa)
    const have = S.closet || [], look = S.look || {};
    const clothes = [{ id: 'kome', kind: 'pal', n: 'Kome clássico', d: 'chapéu de palha' }].concat(D.CLOSET);
    list(T.pane('roupa'), clothes, it => { if (it.id !== 'kome' && have.indexOf(it.id) < 0) return; api.wear(it.kind, it.id); if (G.HUD.refreshCloset) G.HUD.refreshCloset(); },
      it => { const ok = it.id === 'kome' || have.indexOf(it.id) >= 0, on = ok && (it.kind === 'pal' ? (look.pal || 'kome') === it.id : look.acc === it.id);
        return { on, dim: !ok, sub: ok ? (on ? 'vestindo' : 'toque pra vestir') : 'ache cavando bolsões de ouro' }; },
      it => clothIcon(it, it.id === 'kome' || have.indexOf(it.id) >= 0));
    const tp = T.pane('roupa'); if (tp && !tp.querySelector('.k-homehint')) UI.el('div', 'k-homehint', tp, have.length + '/' + D.CLOSET.length + ' achados');
    list(T.pane('tema'), D.THEMES, it => { const own2 = it.sec === 0 || own['th_' + it.id];
      if (!own2) { const c = cost(it); if (S.money < c) { UI.toast('Faltam ¥' + U.fmt(c - S.money), { icon: 'yen', tone: 'bad', sub: it.n }); return; } S.money -= c; own['th_' + it.id] = 1; api.sfx('pling'); }
      H0().theme = it.id; api.save(); },
      it => { const own2 = it.sec === 0 || own['th_' + it.id], on = H0().theme === it.id; return { on, dim: !own2 && S.money < cost(it), sub: on ? 'em uso · ' + it.d : own2 ? 'toque pra usar · ' + it.d : '¥ ' + U.fmt(cost(it)) + ' · ' + it.d }; });
  }

  function openHome(tab) {
    if (open || !api || api.busy()) return false;
    openTab = tab || null;
    if (!panel) buildPanel();
    open = true; t0 = 0;
    H0().newCloth = 0; H0().newAch = 0; badge(); if (G.Goals && panel && panel.tabs) G.Goals.mountIn(panel.tabs.pane('caderno'));
    const W = api.W(), H = api.H(), GY = Math.round(H * 0.74);
    if (!pond && E.Pond) { pond = E.Pond({ x: W * 0.78, y: GY + 58, w: 210, h: 46, seed: 3, reeds: 2 }); if (E.Koi) koi = E.Koi(pond, 7, { seed: 2, size: 0.6 }); }
    if (!bf && E.Nature && E.Nature.butterflies) bf = E.Nature.butterflies({ x0: W * 0.05, x1: W * 0.6, y0: GY - 120, y1: GY + 20, n: 5, seed: 2 });
    if (!ff && E.Nature && E.Nature.fireflies) ff = E.Nature.fireflies({ x0: W * 0.05, x1: W * 0.95, y0: GY - 140, y1: GY + 30, n: 14, seed: 3 });
    if (!birds && E.Nature && E.Nature.birds) birds = E.Nature.birds(5, { n: 6, y: 0.2 });
    document.body.classList.add('k-athome'); if (UI.root) UI.root.classList.add('k-athome');
    refresh(); panel.open(); api.sfx('whoosh');
    if (openTab && panel.tabs) { panel.tabs.set(openTab); refresh(); }
    return true;
  }
  function close(fromPanel) {
    if (!open) return;
    open = false;
    document.body.classList.remove('k-athome'); if (UI.root) UI.root.classList.remove('k-athome');
    if (!fromPanel && panel) panel.close();
    api.save();
  }
  function badge() { if (api && api.badge) api.badge(H0().newCloth || H0().newAch ? '!' : 0); }
  function tick(dt) {
    t0 += dt;
    const W = api.W(), H = api.H(), th = D.themeById[H0().theme] || D.THEMES[0];
    if (pond && has('lago')) { pond.update(dt); if (koi && has('carpas')) koi.update(dt); }
    if (bf) bf.update(dt); if (ff) ff.update(dt); if (birds) birds.update(dt);
    think(dt);
    fallTick(dt, W, H, th.fall, 1);
    if (Math.floor(t0 * 2) !== Math.floor((t0 - dt) * 2) && panel && panel.isOpen) refreshPrices();
  }
  // atualiza só se o dinheiro mudou de faixa (evita refazer o DOM toda hora)
  let lastMoney = -1;
  function refreshPrices() { if (S.money !== lastMoney) { lastMoney = S.money; refresh(); } }
  function draw(g, t) {
    const W = api.W(), H = api.H();
    g.save(); g.setTransform(api.dpr(), 0, 0, api.dpr(), 0, 0);
    // carpas só aparecem com o item comprado: lago sem carpas desenha sem elas
    if (koi && pond) { if (has('carpas')) { if (koi._saved) { koi.list.push.apply(koi.list, koi._saved); koi._saved = null; } } else if (koi.list.length) { koi._saved = koi.list.splice(0); } }
    scene(g, t, W, H);
    g.restore();
  }
  function clothFound() { H0().newCloth = 1; badge(); }
  function noteNew() { if (!open) { H0().newAch = 1; badge(); } }

  G.Home = {
    init(a) { api = a; S = G.S; badge(); },
    sim: { cost, buy },   // tools/longo.js
    open: openHome, close, tick, draw, worldFX, clothFound, noteNew,
    isOpen: () => open,
    data: H0,
  };
})();
