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
    if (usePlace()) {
      try {
        openPlace(tab); open = true;
        H0().newCloth = 0; H0().newAch = 0; badge();
        document.body.classList.add('k-athome'); if (UI.root) UI.root.classList.add('k-athome');
        api.sfx('whoosh');
        return true;
      } catch (e) { if (window.console) console.warn('[kome] casa: cena falhou, abrindo o painel antigo', e); if (P) { P.broken = true; hidePlace(); } }
    }
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
    if (P && P.on) hidePlace();
    if (!fromPanel && panel && panel.isOpen) panel.close();
    api.save();
  }
  function badge() { if (api && api.badge) api.badge(H0().newCloth || H0().newAch ? '!' : 0); }
  function tick(dt) {
    t0 += dt;
    if (P && P.on) { try { tickPlace(dt); } catch (e) { fail(e); } return; }
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
    if (P && P.on) { try { drawPlace(); } catch (e) { fail(e); } return; }
    const W = api.W(), H = api.H();
    g.save(); g.setTransform(api.dpr(), 0, 0, api.dpr(), 0, 0);
    // carpas só aparecem com o item comprado: lago sem carpas desenha sem elas
    if (koi && pond) { if (has('carpas')) { if (koi._saved) { koi.list.push.apply(koi.list, koi._saved); koi._saved = null; } } else if (koi.list.length) { koi._saved = koi.list.splice(0); } }
    scene(g, t, W, H);
    g.restore();
  }
  function clothFound() { H0().newCloth = 1; badge(); }
  function noteNew() { if (!open) { H0().newAch = 1; badge(); } }

  /* =====================================================================================================================
     CASA COMO LUGAR ("menos lista, mais cena"): o quintal em tela cheia num palco próprio de 960×540 (como a Oficina),
     enfeites nos lugares deles, bichos andando, carpas, Kome à toa, luz da hora de verdade. Loja, guarda-roupa, tema,
     caderno, ilhas e armazém viram CARTÕES flutuantes; embaixo, uma varanda (engawa) com abas quadradas.
     Tocar num enfeite abre o cartão dele; comprar põe ele no quintal com um "pop". As regras são as de sempre:
     buy() / cost() / api.wear / tema / G.Goals.mountIn / G.Islands.fill / G.Items.fill. Nenhum número nem chave de save mudou.
     Se algo estourar (ou com ?casa=lista), cai no painel antigo da direita.
     ===================================================================================================================== */
  const PW = 960, PH = 540, GY = 300, INK = '#3B2818';
  const NT = () => E.Nature;
  const TABS = [{ id: 'jardim', n: 'Jardim' }, { id: 'bichos', n: 'Bichos' }, { id: 'roupa', n: 'Roupas' }, { id: 'tema', n: 'Tema' },
    { id: 'caderno', n: 'Caderno' }, { id: 'ilhas', n: 'Ilhas' }, { id: 'armazem', n: 'Armazém' }];
  const TITLES = { jardim: 'Jardim', bichos: 'Bichinhos', roupa: 'Guarda-roupa', tema: 'Tema do quintal', caderno: 'Caderno', ilhas: 'Ilhas', armazem: 'Armazém' };
  const BAR = { y: 454, w: 82, h: 78, gap: 8 };
  const barX = i => i < 0 ? 16 : Math.round((PW - (TABS.length * BAR.w + (TABS.length - 1) * BAR.gap)) / 2 + 40) + i * (BAR.w + BAR.gap);
  let P = null;
  // onde cada enfeite mora no quintal (âncora = pé do desenho; w×h = área de toque acima da âncora)
  function sino(g, x, y, t) { const sy = y - 108, wd = PAL.wood || '#8B5A2B'; Draw.box(g, x - 3, sy - 4, 6, y - sy + 4, wd, { r: 2 }); Draw.box(g, x - 3, sy - 6, 30, 6, wd, { r: 2 }); NT().windchime(g, x + 22, sy, { t, s: 1.15 }); }
  const SPOTS = {
    sakura: { x: 70, y: 4, w: 150, h: 170, d: (g, x, y, t) => NT().tree(g, x, y, { kind: 'sakura', seed: 2, t, s: 1.45 }) },
    koinobori: { x: 184, y: 2, w: 70, h: 150, d: (g, x, y, t) => NT().koinobori(g, x, y, { t, s: 1.05, h: 136 }) },
    sino: { x: 640, y: 3, w: 56, h: 124, d: sino },
    torii: { x: 724, y: 4, w: 120, h: 112, d: (g, x, y, t) => NT().torii(g, x, y, 1.05, { t }) },
    momiji: { x: 826, y: 3, w: 130, h: 150, d: (g, x, y, t) => NT().tree(g, x, y, { kind: 'maple', seed: 6, t, s: 1.25 }) },
    bambu: { x: 924, y: 3, w: 80, h: 180, d: (g, x, y, t) => { NT().tree(g, x - 14, y, { kind: 'bamboo', seed: 4, t, s: 1.35 }); NT().tree(g, x + 18, y + 2, { kind: 'bamboo', seed: 9, t, s: 1.2 }); } },
    lanterna: { x: 266, y: 26, w: 44, h: 74, d: (g, x, y, t) => NT().lantern(g, x, y, 1.1, { t }) },
    flores: { x: 96, y: 46, w: 96, h: 44, d: (g, x, y, t) => ['tanpopo', 'iris', 'ajisai', 'tulip', 'daisy'].forEach((f, i) => NT().flower(g, x - 32 + i * 16, y - 7 + (i % 2) * 8, { kind: f, seed: i + 1, t, s: 1.25 })) },
    bonsai: { x: 362, y: 30, w: 56, h: 56, d: (g, x, y, t) => NT().tree(g, x, y, { kind: 'bonsai', seed: 3, t, s: 1 }) },
    pedras: { x: 600, y: 36, w: 64, h: 32, d: (g, x, y) => { NT().rock(g, x - 8, y - 4, { seed: 4, w: 26, h: 15, moss: true }); NT().rock(g, x + 17, y, { seed: 7, w: 16, h: 10 }); } },
    onsen: { x: 884, y: 80, w: 150, h: 86, d: (g, x, y, t) => NT().onsen(g, x, y, { t, s: 0.88, guest: has('capivara'), screen: false }) },
    lago: { x: 694, y: 116, w: 244, h: 62, d: (g, x, y, t) => { if (P && P.pond) { P.pond.x = x; P.pond.y = y - 30; P.pond.draw(g, t); } } },
  };
  const spotOf = id => SPOTS[id === 'carpas' ? 'lago' : id === 'capivara' ? 'onsen' : id] || null;
  const FRIEND = [[0.2, 74], [0.37, 110], [0.6, 92]];
  const friends = () => D.DECOR.filter(x => x.pal);
  const friendSpot = id => { const i = friends().findIndex(x => x.id === id); return i < 0 ? null : FRIEND[i % FRIEND.length]; };

  /* ---- ícones (canvas 112×112, mostrado a 56–60 px) feitos com a MESMA arte do quintal ---- */
  const icoCache = {};
  function mk(n) { const c = document.createElement('canvas'); c.width = c.height = n || 112; return c; }
  function smallPet(g, id) {
    if (id === 'passaros') { g.fillStyle = '#9FD3F0'; g.beginPath(); g.arc(56, 56, 44, 0, 6.3); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
      g.lineWidth = 4; g.lineCap = 'round'; [[40, 50, 1], [66, 40, 0.8], [70, 68, 0.7]].forEach(([x, y, s]) => { g.beginPath(); g.moveTo(x - 12 * s, y - 5 * s); g.quadraticCurveTo(x - 5 * s, y - 8 * s, x, y); g.quadraticCurveTo(x + 5 * s, y - 8 * s, x + 12 * s, y - 5 * s); g.stroke(); }); return; }
    if (id === 'vagalumes') { g.fillStyle = '#28305A'; g.beginPath(); g.arc(56, 56, 44, 0, 6.3); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
      [[40, 46], [64, 36], [72, 66], [46, 72], [58, 56]].forEach(([x, y], i) => { const r = g.createRadialGradient(x, y, 0, x, y, 12); r.addColorStop(0, 'rgba(214,242,106,.9)'); r.addColorStop(1, 'rgba(214,242,106,0)'); g.fillStyle = r; g.fillRect(x - 12, y - 12, 24, 24); g.fillStyle = '#FFFFDC'; g.fillRect(x - 2, y - 2, 4, 4); }); return; }
    if (id === 'borboletas') { [[42, 58, '#F6B6C8'], [72, 44, '#F3C94A']].forEach(([x, y, c]) => { g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 2.5;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { g.beginPath(); g.ellipse(x + sx * 9, y + sy * (sy < 0 ? 7 : 6), sy < 0 ? 10 : 7, sy < 0 ? 9 : 6, 0, 0, 6.3); g.fill(); g.stroke(); });
      g.fillStyle = INK; g.fillRect(x - 2, y - 10, 4, 22); }); return; }
    const ic = UI.icon && UI.icon('paw', 64); if (ic) g.drawImage(ic, 24, 24, 64, 64);
  }
  function itemIcon(it) {
    if (icoCache[it.id]) return icoCache[it.id];
    const c = mk(), g = c.getContext('2d'); let ok = true;
    try {
      const sp = spotOf(it.id);
      if (sp) { const sc = Math.min(100 / sp.w, 100 / sp.h); g.translate(56, 56 + sp.h * sc / 2); g.scale(sc, sc); sp.d(g, 0, 0, 0.5); }
      else if (it.pal) E.drawShibaHead(g, 56, 64, 0, { scale: 4.2, pal: it.pal, still: true });
      else if (it.fromCard && it.sprite && it.sprite()) { const cv = it.sprite(), sc = Math.max(1, Math.floor(Math.min(100 / cv.width, 100 / cv.height))); g.imageSmoothingEnabled = false; g.drawImage(cv, Math.round(56 - cv.width * sc / 2), Math.round(106 - cv.height * sc), cv.width * sc, cv.height * sc); }
      else if (it.fromCard && it.anim && E.Anim && E.Assets && E.Assets.ready && E.Assets.ready(it.anim)) { const A = E.Anim(it.anim, it.tagParado || 'parado'); A.update(0); g.imageSmoothingEnabled = false; A.draw(g, 56, 104, { scale: 3 }); }
      else { smallPet(g, it.id); ok = !it.fromCard; }
    } catch (e) { ok = false; }
    if (ok) icoCache[it.id] = c;
    return c;
  }
  function themeIcon(th) {
    const k = 'th_' + th.id; if (icoCache[k]) return icoCache[k];
    const c = mk(), g = c.getContext('2d');
    g.save(); g.beginPath(); g.arc(56, 56, 46, 0, 6.3); g.clip();
    g.fillStyle = th.id === 'inverno' ? '#BFD6EA' : th.id === 'outono' ? '#F2C98A' : th.id === 'primavera' ? '#BDE3F2' : '#8FCDF0'; g.fillRect(0, 0, 112, 112);
    g.fillStyle = th.id === 'inverno' ? '#E8EEF4' : th.id === 'outono' ? '#B9A55A' : PAL.grass || '#7BAE4E'; g.fillRect(0, 74, 112, 40);
    try { NT().tree(g, 56, 80, { kind: th.id === 'outono' ? 'maple' : th.id === 'primavera' ? 'sakura' : th.id === 'inverno' ? 'pine' : 'round', seed: 2, t: 0, s: 0.62, shadow: false }); } catch (e) { /* sem árvore */ }
    if (th.id === 'verao') { g.fillStyle = '#FFE58A'; g.beginPath(); g.arc(84, 28, 11, 0, 6.3); g.fill(); }
    for (let i = 0; i < 9 && th.fall; i++) { const x = 14 + (i * 37) % 86, y = 14 + (i * 23) % 60; g.fillStyle = th.fall === 'snow' ? '#FFFFFF' : th.fall === 'leaf' ? '#D8574E' : '#F6B6C8'; g.beginPath(); g.ellipse(x, y, 4, 3, i, 0, 6.3); g.fill(); }
    g.restore(); g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(56, 56, 46, 0, 6.3); g.stroke();
    return (icoCache[k] = c);
  }
  function tabIcon(id) {
    if (id === 'roupa') { const lk = S.look || {}; return clothIcon(lk.acc ? { id: lk.acc, kind: 'acc' } : { id: lk.pal || 'kome', kind: 'pal' }, true); }
    const k = 'tab_' + id; if (icoCache[k]) return icoCache[k];
    let c = null;
    try {
      if (id === 'jardim') c = itemIcon(D.decorById.bonsai);
      else if (id === 'bichos') { c = mk(); E.drawShibaHead(c.getContext('2d'), 56, 62, 0, { scale: 4, pal: 'shiro', still: true }); }
      else if (id === 'tema') c = themeIcon(D.themeById.primavera || D.THEMES[0]);
      else if (id === 'ilhas') { c = mk(); const g = c.getContext('2d'); g.fillStyle = '#6EC1E4'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.ellipse(56, 80, 46, 18, 0, 0, 6.3); g.fill(); g.stroke();
        g.fillStyle = '#F1D9A0'; g.beginPath(); g.ellipse(56, 76, 30, 10, 0, 0, 6.3); g.fill(); g.stroke(); NT().tree(g, 56, 76, { kind: 'pine', seed: 5, t: 0, s: 0.5, shadow: false }); }
      else c = UI.icon && UI.icon({ caderno: 'book', armazem: 'sack', voltar: 'rice' }[id] || 'star', 64);
    } catch (e) { c = null; }
    return c ? (icoCache[k] = c) : null;
  }

  /* ---- montar o palco ---- */
  function buildPlace() {
    const root = document.createElement('div'); root.className = 'kh-root';
    document.body.appendChild(root);
    const css = document.createElement('style');
    css.textContent = [
      '.kh-root{position:fixed;inset:0;z-index:55;background:#2a1a10;display:none}.kh-root.kh-open{display:block}',
      '.kh-card{position:absolute;z-index:5;background:#FFF6DE;border:3px solid #3B2818;border-radius:18px;box-shadow:0 6px 0 rgba(59,40,24,.5);font-family:var(--k-font,system-ui,sans-serif);font-weight:800;color:#3B2818;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;transition:left .3s cubic-bezier(.2,.9,.3,1),top .3s cubic-bezier(.2,.9,.3,1)}',
      '.kh-card *{box-sizing:border-box}',
      '.kh-card.kh-in{animation:khin .3s cubic-bezier(.2,1.5,.4,1) both}@keyframes khin{0%{transform:scale(.86) translateY(16px);opacity:0}100%{transform:none;opacity:1}}',
      '.kh-head{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 16px;background:#F3C94A;border-bottom:3px solid #3B2818;flex:none}',
      '.kh-title{flex:1;font-size:24px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.kh-x{width:46px;height:46px;flex:none;border-radius:12px;border:3px solid #3B2818;background:#FFF6DE;font:900 26px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 0 #3B2818;color:#3B2818;padding:0}',
      '.kh-x:active,.kh-btn:active,.kh-tile:active{transform:translateY(3px);box-shadow:0 1px 0 #3B2818}',
      '.kh-body{flex:1;min-height:0;overflow-y:auto;padding:10px;touch-action:pan-y;-webkit-overflow-scrolling:touch;font-size:17px}',
      '.kh-hint{font-size:17px;opacity:.78;margin:0 2px 8px}',
      '.kh-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.kh-tile{position:relative;display:flex;align-items:center;gap:6px;padding:5px 8px 5px 3px;border:3px solid #3B2818;border-radius:14px;background:#FFFDF4;box-shadow:0 3px 0 #3B2818;cursor:pointer;min-height:76px;text-align:left;font:inherit;color:inherit;width:100%}',
      '.kh-tile canvas{width:58px;height:58px;flex:none;image-rendering:auto}',
      '.kh-tile b{display:block;font-size:17px;line-height:1.08;font-weight:900}',
      '.kh-tile small{display:block;font-size:17px;line-height:1.1;font-weight:800;opacity:.72;margin-top:2px}',
      '.kh-tile.kh-sel{background:#FFE7A0;outline:3px solid #E39A2C;outline-offset:1px}',
      '.kh-tile.kh-dim{opacity:.58}',
      '.kh-tile.kh-on small{color:#2E7D4F;opacity:1}',
      '.kh-tile.kh-on::after{content:"✓";position:absolute;right:6px;top:4px;font-size:18px;font-weight:900;color:#2E7D4F}',
      '.kh-foot{flex:none;border-top:3px solid #3B2818;padding:9px 10px 10px 12px;background:#FBEFD0;display:flex;align-items:center;gap:10px;min-height:76px}',
      '.kh-foot .kh-txt{flex:1;min-width:0}.kh-foot b{font-size:19px;display:block;font-weight:900;line-height:1.1}.kh-foot span{font-size:17px;display:block;opacity:.8;line-height:1.15}',
      '.kh-btn{font:inherit;font-size:19px;font-weight:900;padding:8px 14px;min-height:52px;border:3px solid #3B2818;border-radius:14px;background:#8FD17E;color:#3B2818;box-shadow:0 4px 0 #3B2818;cursor:pointer;white-space:nowrap;flex:none}',
      '.kh-btn.kh-no{background:#E9DCC0;color:#7A6450}.kh-btn.kh-alt{background:#FFF6DE}',
      '.kh-big{display:flex;gap:12px;align-items:center}.kh-big canvas{width:84px;height:84px;flex:none;background:#FBEFD0;border:3px solid #3B2818;border-radius:14px}',
      '.kh-big b{font-size:22px;display:block;font-weight:900}.kh-big span{font-size:17px;display:block;opacity:.8}',
      '.kh-row{display:flex;gap:8px;margin-top:10px;justify-content:flex-end}',
      '.kh-pane{font-size:17px}',
    ].join('\n');
    document.head.appendChild(css);
    root.classList.add('kh-open');                 // visível na criação: o Stage mede o pai de verdade
    const stage = E.Stage({ parent: root, width: PW, height: PH, bg: '#2a1a10' });
    const input = E.Input(stage, { keys: false, wheel: false });
    root.classList.remove('kh-open');
    const N = NT();
    P = { root, stage, g: stage.g, input, ps: E.Particles ? E.Particles(400) : null, fl: E.Floaters ? E.Floaters(30) : null,
      t: 0, tab: null, card: null, cardEl: null, side: 'r', sel: null, prev: null, pops: {}, toast: null, hot: null, zones: [], boxes: [], titleX: PW / 2, todForce: null,
      pond: E.Pond ? E.Pond({ x: 694, y: GY + 86, w: 230, h: 52, seed: 3, reeds: 2 }) : null };
    if (P.pond && E.Koi) P.koi = E.Koi(P.pond, 7, { seed: 2, size: 0.6 });
    if (N.butterflies) P.bf = N.butterflies({ x0: 40, x1: 560, y0: GY - 110, y1: GY + 40, n: 5, seed: 2 });
    if (N.fireflies) P.ff = N.fireflies({ x0: 30, x1: 930, y0: GY - 130, y1: GY + 100, n: 16, seed: 3 });
    if (N.birds) P.birds = N.birds(5, { n: 6, y: 0.16 });
    input.on('down', (x, y) => { try { tap(x, y); } catch (e) { fail(e); } });
    input.on('move', (x, y) => { P.mx = x; P.my = y; });
    addEventListener('keydown', e => { if (!P || !P.on || e.key !== 'Escape') return; if (P.card) closeCard(); else close(); });
  }

  /* ---- hora do dia de verdade (relógio do PC): manhã, tarde, pôr do sol, noite com vaga-lumes e janelas acesas ---- */
  const TOD = [[0, 0.93], [5, 0.92], [6.5, 0.04], [11, 0.25], [15, 0.48], [17.5, 0.7], [19, 0.8], [21, 0.9], [24, 0.93]];
  function nowTod() {
    if (P.todForce !== null) return P.todForce;
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    for (let i = 1; i < TOD.length; i++) if (h <= TOD[i][0]) { const a = TOD[i - 1], b = TOD[i]; return a[1] + (b[1] - a[1]) * (h - a[0]) / (b[0] - a[0]); }
    return 0.3;
  }

  /* ---- toque ---- */
  const inR = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  function tap(x, y) {
    for (let i = P.zones.length - 1; i >= 0; i--) { const z = P.zones[i]; if (inR(x, y, z)) { z.fn(); return; } }
    for (let i = P.boxes.length - 1; i >= 0; i--) { const b = P.boxes[i]; if (inR(x, y, b)) { b.fn(); return; } }
    if (P.card) closeCard();
  }
  function say(s) { P.toast = { t: s, life: 2.2 }; }
  function anchorOf(id) {
    const sp = spotOf(id); if (sp) return { x: sp.x, y: GY + sp.y, h: sp.h };
    if (id === 'kome') { const b = brains.kome; return { x: PW * (b ? b.f : 0.49), y: GY + 96, h: 60 }; }
    const fs = friendSpot(id); if (fs) { const b = brains['shiba_' + id]; return { x: PW * (b ? b.f : fs[0]), y: GY + fs[1], h: 56 }; }
    const it = D.decorById[id]; if (it && it.fromCard) { const b = brains[id]; return { x: PW * (b ? b.f : (it.onde.x !== undefined ? it.onde.x : 0.5)), y: GY + (it.onde.y || 0), h: 50 }; }
    if (id === 'passaros') return { x: 480, y: 110, h: 40 };
    if (id === 'borboletas') return { x: 300, y: GY - 20, h: 40 };
    return { x: 480, y: GY + 40, h: 60 };
  }
  function popAt(id, txt) {
    P.pops[id] = 0; const a = anchorOf(id);
    if (P.ps) { P.ps.burst(a.x, a.y - a.h * 0.55, 28, { c: [PAL.gold || '#F3C94A', '#F6B6C8', '#FFF6DE', '#8FD17E'], shape: 'star', speed: [110, 320], life: [0.6, 1.1] }); P.ps.puff(a.x, a.y, 7, 11, { c: PAL.sand }); }
    if (P.fl && txt) P.fl.add(a.x, a.y - a.h - 12, txt, { size: 22, c: '#FFE58A', life: 1.4 });
    const kb = brains.kome; if (kb && id !== 'kome') { kb.st = 'idle'; kb.idle = 'dance'; kb.T = 2.4; kb.face = a.x < PW * kb.f ? -1 : 1; }
  }
  function poof(id) { const a = anchorOf(id); if (P.ps) P.ps.puff(a.x, a.y - a.h * 0.4, 10, 14, { c: '#FFF6DE' }); }
  function placeBuy(it) {
    const c = cost(it);
    if (it.needs && !H0().own[it.needs]) { say('Precisa: ' + D.decorById[it.needs].n); api.sfx('error'); return; }
    if (S.money < c) { say('Faltam ¥' + U.fmt(c - S.money) + ' pra ' + it.n); api.sfx('error'); return; }
    buy(it);
    if (H0().own[it.id]) popAt(it.id, it.n + '!');
  }
  function toggleHide(it) {
    if (H0().hide[it.id]) { delete H0().hide[it.id]; popAt(it.id); api.sfx('pling'); }
    else { poof(it.id); H0().hide[it.id] = 1; api.sfx('click'); }
    api.save();
  }

  /* ---- cartões (DOM dentro do palco: escalam junto com ele) ---- */
  function openCard(card) {
    const same = P.card && P.cardEl && P.card.type === card.type && P.card.id === card.id;
    P.card = card; if (!same) { P.sel = card.sel || null; P.prev = null; }
    if (card.type === 'tab') P.tab = card.id;
    renderCard(!same); api.sfx(same ? 'click' : 'whoosh');
  }
  function closeCard() { if (P.cardEl) P.cardEl.remove(); P.cardEl = null; P.card = null; P.tab = null; P.sel = null; P.prev = null; api.sfx('click'); }
  function el(tag, cls, parent, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (parent) parent.appendChild(e); return e; }
  function cvCopy(src, n) { const c = mk(n || 112); if (src) c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c; }
  function sideFor(id) { const a = id ? anchorOf(id) : null; return a && a.x > 470 ? 'l' : 'r'; }
  function renderCard(anim) {
    const card = P.card; if (!card) return;
    const keep = P.cardEl && !anim ? (P.cardEl.querySelector('.kh-body') || {}).scrollTop || 0 : 0;
    if (P.cardEl) P.cardEl.remove();
    const c = el('div', 'kh-card k-theme' + (anim ? ' kh-in' : ''), P.stage.el); P.cardEl = c;
    c.addEventListener('pointerdown', e => e.stopPropagation());
    const head = el('div', 'kh-head', c);
    el('div', 'kh-title', head, card.type === 'tab' ? TITLES[card.id] : card.title || '');
    const x = el('button', 'kh-x', head, '×'); x.setAttribute('aria-label', 'Fechar'); x.onclick = () => closeCard();
    if (card.type === 'tab') {
      const wide = card.id === 'caderno' || card.id === 'ilhas' || card.id === 'armazem', w = wide ? 470 : 404;
      if (['jardim', 'bichos', 'roupa', 'tema'].indexOf(card.id) >= 0 && P.sel) P.side = sideFor(card.id === 'jardim' || card.id === 'bichos' ? P.sel : null);
      else if (!P.sel) P.side = 'r';
      Object.assign(c.style, { width: w + 'px', height: '430px', top: '12px', left: (P.side === 'l' ? 12 : PW - w - 12) + 'px' });
      const body = el('div', 'kh-body', c);
      fillTab(card.id, body, c);
      body.scrollTop = keep;
    } else {
      fillProp(card, c);
      const a = anchorOf(card.id), w = 340; c.style.width = w + 'px';
      const h = c.offsetHeight || 190, sp = spotOf(card.id), top = a.y - (sp ? sp.h : a.h) - h - 12;
      c.style.left = Math.round(U.clamp(a.x - w / 2, 12, PW - w - 12)) + 'px';
      c.style.top = Math.round(top >= 12 ? top : U.clamp(a.y + 12, 12, 444 - h)) + 'px';
    }
  }
  function tileEl(grid, icon, name, sub, st, onClick, id) {
    const b = el('button', 'kh-tile' + (st.on ? ' kh-on' : '') + (st.dim ? ' kh-dim' : '') + (P.sel === id ? ' kh-sel' : ''), grid);
    b.appendChild(cvCopy(icon));
    const tx = el('div', '', b); el('b', '', tx, name); el('small', '', tx, sub);
    b.onclick = onClick;
    b.onpointerenter = () => { P.prev = id; }; b.onpointerleave = () => { if (P.prev === id) P.prev = null; };
    return b;
  }
  function foot(c, title, txt, btn, btnCls, onBtn) {
    const f = el('div', 'kh-foot', c), t = el('div', 'kh-txt', f); el('b', '', t, title); if (txt) el('span', '', t, txt);
    if (btn) { const b = el('button', 'kh-btn' + (btnCls ? ' ' + btnCls : ''), f, btn); b.onclick = onBtn; }
  }
  const shopSt = it => { const own = H0().own;
    if (own[it.id]) return H0().hide[it.id] ? { sub: 'guardado', on: false } : { sub: 'no quintal', on: true };
    const lock = it.needs && !own[it.needs];
    return { sub: lock ? 'precisa: ' + D.decorById[it.needs].n : '¥ ' + U.fmt(cost(it)), dim: lock || S.money < cost(it) }; };
  function fillTab(id, body, c) {
    const own = H0().own;
    if (id === 'jardim' || id === 'bichos') {
      const items = D.DECOR.filter(x => x.kind === (id === 'jardim' ? 'decor' : 'pet'));
      el('div', 'kh-hint', body, items.filter(x => own[x.id]).length + '/' + items.length + ' no quintal · toque pra ver onde fica');
      const grid = el('div', 'kh-grid', body);
      items.forEach(it => tileEl(grid, itemIcon(it), it.n, shopSt(it).sub, shopSt(it), () => { P.sel = it.id; api.sfx('click'); renderCard(); }, it.id));
      const it = P.sel && D.decorById[P.sel];
      if (!it) { foot(c, 'Seu quintal, do seu jeito', 'Só enfeite: não muda a renda. ¥ ' + U.fmt(S.money) + ' no bolso'); return; }
      if (own[it.id]) foot(c, it.n, it.d, H0().hide[it.id] ? 'Pôr no quintal' : 'Guardar', H0().hide[it.id] ? '' : 'kh-alt', () => { toggleHide(it); renderCard(); });
      else { const lock = it.needs && !own[it.needs], cc = cost(it);
        foot(c, it.n, it.d, lock ? 'Precisa: ' + D.decorById[it.needs].n : 'Comprar ¥' + U.fmt(cc), lock || S.money < cc ? 'kh-no' : '', () => { placeBuy(it); renderCard(); }); }
      return;
    }
    if (id === 'roupa') {
      const have = S.closet || [], look = S.look || {};
      const clothes = [{ id: 'kome', kind: 'pal', n: 'Kome clássico', d: 'chapéu de palha' }].concat(D.CLOSET);
      el('div', 'kh-hint', body, have.length + '/' + D.CLOSET.length + ' achados · toque pra vestir');
      const grid = el('div', 'kh-grid', body);
      const okOf = it => it.id === 'kome' || have.indexOf(it.id) >= 0;
      const onOf = it => okOf(it) && (it.kind === 'pal' ? (look.pal || 'kome') === it.id : look.acc === it.id);
      clothes.forEach(it => tileEl(grid, clothIcon(it, okOf(it)), okOf(it) ? it.n : '???', onOf(it) ? 'vestindo' : okOf(it) ? (it.kind === 'acc' ? 'acessório' : 'pelagem') : 'não achado', { on: onOf(it), dim: !okOf(it) }, () => {
        P.sel = it.id;
        if (okOf(it)) { api.wear(it.kind, it.id); if (G.HUD && G.HUD.refreshCloset) G.HUD.refreshCloset(); popAt('kome', 'que estilo!'); const kb = brains.kome; if (kb) { kb.st = 'idle'; kb.idle = 'dance'; kb.T = 2.2; } }
        else api.sfx('click');
        renderCard();
      }, it.id));
      const it = P.sel && clothes.find(q => q.id === P.sel);
      if (!it) foot(c, 'O Kome se arruma', 'Roupas aparecem cavando bolsões de ouro');
      else foot(c, okOf(it) ? it.n : 'Ainda não achado', okOf(it) ? it.d : (it.island || it.prize ? it.d : 'ache cavando bolsões de ouro'));
      return;
    }
    if (id === 'tema') {
      el('div', 'kh-hint', body, 'Vale pro quintal e pra montanha');
      const grid = el('div', 'kh-grid', body);
      const ownTh = it => it.sec === 0 || own['th_' + it.id];
      D.THEMES.forEach(it => tileEl(grid, themeIcon(it), it.n, H0().theme === it.id ? 'em uso' : ownTh(it) ? 'toque pra usar' : '¥ ' + U.fmt(cost(it)), { on: H0().theme === it.id, dim: !ownTh(it) && S.money < cost(it) }, () => {
        P.sel = it.id;
        if (ownTh(it)) { if (H0().theme !== it.id) { H0().theme = it.id; api.save(); api.sfx('pling'); popAt('kome'); } }
        else api.sfx('click');
        renderCard();
      }, it.id));
      const it = P.sel && D.themeById[P.sel];
      if (!it || ownTh(it)) { const cur = D.themeById[H0().theme] || D.THEMES[0]; foot(c, cur.n, cur.d); return; }
      const cc = cost(it);
      foot(c, it.n, it.d, 'Comprar ¥' + U.fmt(cc), S.money < cc ? 'kh-no' : '', () => {
        if (S.money < cc) { say('Faltam ¥' + U.fmt(cc - S.money) + ' pra ' + it.n); api.sfx('error'); return; }
        S.money -= cc; own['th_' + it.id] = 1; H0().theme = it.id; api.sfx('pling'); api.save(); popAt('kome', it.n + '!'); renderCard();
      });
      return;
    }
    // caderno / ilhas / armazém: o conteúdo é o de sempre (dono: goals.js, islands.js, items.js)
    const pane = el('div', 'kh-pane k-pane', body);
    if (id === 'caderno' && G.Goals) G.Goals.mountIn(pane);
    else if (id === 'ilhas' && G.Islands) G.Islands.fill(pane);
    else if (id === 'armazem' && G.Items) G.Items.fill(pane);
    if (!pane.firstChild) el('div', 'kh-hint', pane, 'Nada por aqui ainda.');
  }
  function fillProp(card, c) {
    const body = el('div', 'kh-body', c), big = el('div', 'kh-big', body);
    if (card.id === 'kome') {
      const lk = S.look || {}, cl = lk.acc ? D.CLOSET.find(q => q.id === lk.acc) : D.CLOSET.find(q => q.id === lk.pal);
      big.appendChild(cvCopy(tabIcon('roupa'), 88)); const t = el('div', '', big); el('b', '', t, 'Kome'); el('span', '', t, 'vestindo: ' + (cl ? cl.n : 'chapéu de palha'));
      const r = el('div', 'kh-row', body), b = el('button', 'kh-btn', r, 'Trocar roupa'); b.onclick = () => openCard({ type: 'tab', id: 'roupa' });
      return;
    }
    if (card.id === 'casa') {
      big.appendChild(cvCopy(tabIcon('caderno'), 88)); const t = el('div', '', big); el('b', '', t, S.house > 0 ? 'Casa do Kome' : 'Terreno à venda');
      el('span', '', t, S.house > 0 ? 'Fase ' + S.house + ' de 6 · melhora pela árvore de upgrades' : 'compre a casa na árvore de upgrades');
      const r = el('div', 'kh-row', body), b = el('button', 'kh-btn kh-alt', r, 'Abrir o caderno'); b.onclick = () => openCard({ type: 'tab', id: 'caderno' });
      return;
    }
    const it = D.decorById[card.id]; if (!it) return;
    big.appendChild(cvCopy(itemIcon(it), 88)); const t = el('div', '', big); el('b', '', t, it.n); el('span', '', t, it.d);
    const extra = it.id === 'lago' && has('carpas') ? D.decorById.carpas : it.id === 'onsen' && has('capivara') ? D.decorById.capivara : null;
    const r = el('div', 'kh-row', body);
    if (extra) { const b2 = el('button', 'kh-btn kh-alt', r, 'Guardar ' + extra.n.toLowerCase()); b2.onclick = () => { toggleHide(extra); closeCard(); }; }
    const b = el('button', 'kh-btn kh-alt', r, 'Guardar'); b.onclick = () => { toggleHide(it); closeCard(); };
  }

  /* ---- desenho do lugar ---- */
  function tile(x, y, w, h, sel, hot, icon, label) {
    const g = P.g, lift = sel ? -7 : hot ? -3 : 0;
    g.fillStyle = 'rgba(40,22,8,.38)'; Draw.rrect(g, x + 1, y + 5, w, h, 15); g.fill();
    g.fillStyle = INK; Draw.rrect(g, x - 3, y + lift - 3, w + 6, h + 6, 17); g.fill();
    g.fillStyle = sel ? '#F3C94A' : '#FFF3D6'; Draw.rrect(g, x, y + lift, w, h, 14); g.fill();
    g.fillStyle = sel ? '#D9A43A' : '#EBD9B0'; Draw.rrect(g, x, y + lift + h - 26, w, 26, 14); g.fill(); g.fillRect(x, y + lift + h - 26, w, 10);
    g.fillStyle = 'rgba(255,255,255,.55)'; Draw.rrect(g, x + 6, y + lift + 4, w - 12, 5, 2.5); g.fill();
    if (icon) { const s = 44; g.drawImage(icon, Math.round(x + w / 2 - s / 2), Math.round(y + lift + 7), s, s); }
    Draw.text(g, label, x + w / 2, y + lift + h - 13, { size: 17, col: INK, sw: 0, weight: 900 });
  }
  function deck(g) {
    const y = BAR.y - 10, wd = '#B9844E';
    g.fillStyle = INK; g.fillRect(0, y - 3, PW, PH - y + 3);
    g.fillStyle = wd; g.fillRect(0, y, PW, PH - y);
    g.fillStyle = '#D6A36B'; g.fillRect(0, y, PW, 6);
    g.fillStyle = '#93623A'; for (let i = 0; i < 6; i++) g.fillRect(0, y + 22 + i * 16, PW, 2);
    for (let x = 60; x < PW; x += 150) { g.fillRect(x, y + 6, 2, 16); g.fillRect(x + 75, y + 24, 2, 16); g.fillRect(x + 30, y + 40, 2, 16); }
  }
  function drawPlace() {
    const g = P.g, t = P.t, N = NT(), th = D.themeById[H0().theme] || D.THEMES[0], tod = nowTod();
    g.setTransform(P.stage.dpr, 0, 0, P.stage.dpr, 0, 0);
    // céu, Fuji, morros, chão
    N.sky(g, PW, GY + 40, { tod, t, stars: true });
    if (N.celestial) N.celestial(g, PW, GY - 20, { tod, t, r: 20 });
    N.fuji(g, 600, GY - 18, 1.35, { tod, t });
    if (has('passaros') && P.birds) P.birds.draw(g, PW, PH, 0);
    N.hills(g, PW, GY - 4, 0, { col: th.id === 'inverno' ? '#C9D6E2' : '#8DB46A', amp: 20, seed: 3, tod });
    N.ground(g, 0, PW, GY, { t, seed: 2, col: th.id === 'inverno' ? '#E8EEF4' : th.id === 'outono' ? '#B9A55A' : undefined, depth: PH - GY + 4 });
    // caminho de pedras da varanda até a casa
    g.fillStyle = 'rgba(59,40,24,.18)'; for (let i = 0; i < 6; i++) { const k = i / 5; g.beginPath(); g.ellipse(480 + Math.sin(i * 1.7) * 10, GY + 22 + k * 116, 15 + k * 8, 5 + k * 3, 0, 0, 6.3); g.fill(); }
    g.fillStyle = '#D9CDB4'; for (let i = 0; i < 6; i++) { const k = i / 5; g.beginPath(); g.ellipse(480 + Math.sin(i * 1.7) * 10, GY + 20 + k * 116, 14 + k * 8, 4.5 + k * 3, 0, 0, 6.3); g.fill(); }
    // tudo que fica no chão, em ordem de profundidade (mais embaixo = mais perto)
    const L = [], boxes = [], ghost = P.card && P.card.type === 'tab' && (P.card.id === 'jardim' || P.card.id === 'bichos') ? (P.prev || P.sel) : null;
    const showGhost = ghost && !has(ghost) ? ghost : null;
    for (const id in SPOTS) {
      const sp = SPOTS[id], vis = has(id);
      if (!vis && showGhost !== id) continue;
      const x = sp.x, y = GY + sp.y;
      L.push({ y, f: () => withPop(g, id, x, y, () => { if (!vis) { g.globalAlpha = 0.42 + 0.18 * Math.sin(t * 5); sp.d(g, x, y, t); g.globalAlpha = 1; ring(g, x, y, sp.w * 0.45, t); } else sp.d(g, x, y, t); }) });
      if (vis) boxes.push({ x: x - sp.w / 2, y: y - sp.h, w: sp.w, h: sp.h, id, z: y, fn: () => { openCard({ type: 'prop', id, title: D.decorById[id].n }); api.sfx('pling', { pitch: 1.3 }); } });
    }
    // casa no estágio atual
    { const hx = 470, hy = GY + 2;
      L.push({ y: hy, f: () => withPop(g, 'casa', hx, hy, () => {
        if (S.house > 0) N.house(g, hx, hy, { stage: S.house - 1, s: 1.55, t });
        else if (G.World && G.World.drawPlot) { G.World.drawPlot(g, hx, hy + 4, 2.2); Draw.text(g, 'À VENDA', hx + 34, hy - 78, { size: 18, col: PAL.red, sw: 3, weight: 900, stroke: '#FFF6DE' }); }
      }) });
      boxes.push({ x: hx - 120, y: hy - 190, w: 240, h: 190, id: 'casa', z: hy - 50, fn: () => { P.pops.casa = 0.2; openCard({ type: 'prop', id: 'casa', title: 'Casa' }); } }); }
    // bichos das fichas (conteudo/)
    for (const it of D.DECOR) {
      if (!it.fromCard || (!has(it.id) && showGhost !== it.id)) continue;
      const ghostOnly = !has(it.id), hx0 = it.onde.x !== undefined ? it.onde.x : 0.5;
      if (it.anim && E.Anim && E.Assets && E.Assets.ready && E.Assets.ready(it.anim)) {
        const A = it._a || (it._a = E.Anim(it.anim, 'parado')), anda = it.kind === 'pet', an = (E.Assets.get(it.anim) || {}).anims || {};
        const b = anda ? brain(it.id, hx0, 0.16, PET_IDLE.filter(n => an[n]), 0.05) : null, x = Math.round(PW * (b ? b.f : hx0)), y = Math.round(GY + (it.onde.y || 0)), sc = it.escala || 2;
        L.push({ y, f: () => withPop(g, it.id, x, y, () => {
          A.play(!anda ? (it.tagParado || 'parado') : b.st === 'walk' ? (it.tagAnda || 'andar') : b.idle); if (b) A.flip = b.face < 0;
          const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; if (ghostOnly) g.globalAlpha = 0.5; A.draw(g, x, y, { scale: sc }); g.globalAlpha = 1; g.imageSmoothingEnabled = sm; }) });
        if (!ghostOnly) boxes.push({ x: x - 22, y: y - 46, w: 44, h: 48, id: it.id, z: y, fn: () => petCard(it) });
        continue;
      }
      if (!it.sprite) continue;
      const cv = it.sprite(); if (!cv) continue;
      const bb = it.anda ? brain(it.id, hx0, 0.14, ['parado'], 0.05) : null, x = PW * (bb ? bb.f : hx0), sc = it.escala || 2;
      const y = GY + (it.onde.y || 0), oy = y + (bb && bb.st === 'walk' ? -Math.abs(Math.sin(t * 9 + hx0 * 7)) * 3 : 0);
      L.push({ y, f: () => withPop(g, it.id, x, y, () => { const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; if (ghostOnly) g.globalAlpha = 0.5; g.drawImage(cv, Math.round(x - cv.width * sc / 2), Math.round(oy - cv.height * sc), cv.width * sc, cv.height * sc); g.globalAlpha = 1; g.imageSmoothingEnabled = sm; }) });
      if (!ghostOnly) boxes.push({ x: x - cv.width * sc / 2, y: y - cv.height * sc, w: cv.width * sc, h: cv.height * sc, id: it.id, z: y, fn: () => petCard(it) });
    }
    // amigos shiba
    const poses = ['sit', 'wag', 'lie', 'sleep', 'sniff', 'scratch', 'stretch', 'yawn', 'eat', 'dance'];
    friends().forEach((f, i) => {
      if (!has(f.id) && showGhost !== f.id) return;
      const sp = FRIEND[i % FRIEND.length], b = brain('shiba_' + f.id, sp[0], 0.12, poses, 0.06), pose = b.st === 'walk' ? 'walk' : b.idle, x = PW * b.f, y = GY + sp[1];
      if (!has(f.id)) { L.push({ y, f: () => { g.globalAlpha = 0.45; E.drawShiba(g, PW * sp[0], y, 'sit', t, { scale: 2, pal: f.pal }); g.globalAlpha = 1; ring(g, PW * sp[0], y, 26, t); } }); return; }
      L.push({ y, f: () => withPop(g, f.id, x, y, () => E.drawShiba(g, x, y, pose, t + i, { scale: 2, pal: f.pal, flip: b.face < 0 })) });
      boxes.push({ x: x - 30, y: y - 52, w: 60, h: 56, id: f.id, z: y, fn: () => { b.st = 'idle'; b.idle = 'wag'; b.T = 2; petCard(f); } });
    });
    // o Kome (à toa: senta, deita, cochila, dança)
    { const kb = brain('kome', 0.49, 0.1, ['sit', 'wag', 'lie', 'sit', 'stretch', 'yawn', 'sleep', 'dance', 'sniff'], 0.05);
      const pose = kb.st === 'walk' ? 'walk' : kb.idle, kx = PW * kb.f, ky = GY + 96, ks = 2.3;
      L.push({ y: ky, f: () => withPop(g, 'kome', kx, ky, () => {
        E.drawShiba(g, kx, ky, pose, t, { scale: ks, pal: (S.look && S.look.pal) || 'kome', flip: kb.face < 0 });
        if (S.look && S.look.acc && G.drawAccAt && E.shibaAnchor) { const hd = E.shibaAnchor(pose, t, 'head'), fl = kb.face < 0 ? -1 : 1; G.drawAccAt(g, t, { x: kx + hd.x * ks * fl, y: ky + hd.y * ks, f: fl, sc: ks, a: 0 }, S.look.acc); } }) });
      boxes.push({ x: kx - 34, y: ky - 62, w: 68, h: 66, id: 'kome', z: ky + 1, fn: () => { kb.st = 'idle'; kb.idle = 'wag'; kb.T = 2.5; if (P.fl) P.fl.add(kx, ky - 70, 'au!', { size: 20, c: '#FFF6DE', life: 0.9 }); api.sfx('pling', { pitch: 1.5 }); openCard({ type: 'prop', id: 'kome', title: 'Kome' }); } }); }
    L.sort((a, b) => a.y - b.y); for (const d of L) d.f();
    // destaque do que está embaixo do ponteiro
    boxes.sort((a, b) => a.z - b.z); P.boxes = boxes;
    let hot = null; if (P.mx !== undefined && P.my < BAR.y - 12 && !P.input.touch) for (let i = boxes.length - 1; i >= 0; i--) if (inR(P.mx, P.my, boxes[i])) { hot = boxes[i]; break; }
    if (hot) { g.strokeStyle = 'rgba(255,246,222,.85)'; g.lineWidth = 3; g.setLineDash([7, 6]); g.lineDashOffset = -t * 20; Draw.rrect(g, hot.x - 4, hot.y - 4, hot.w + 8, hot.h + 8, 12); g.stroke(); g.setLineDash([]); }
    // luz da hora (multiplica) + halos das lanternas; depois o que brilha
    if (N.grade) N.grade(g, PW, BAR.y, { tod, horizon: GY });
    if (has('borboletas') && P.bf) P.bf.draw(g);
    if (has('vagalumes') && P.ff) P.ff.draw(g, Math.max(0.55, N.light ? N.light(tod).night : 0));
    if (th.tint) { g.fillStyle = th.tint; g.fillRect(0, 0, PW, PH); }
    fallDraw(g);
    if (P.ps) P.ps.draw(g); if (P.fl) P.fl.draw(g);
    // título (vai pro lado livre quando tem cartão aberto)
    const tx = !P.card || P.card.type !== 'tab' ? PW / 2 : P.side === 'l' ? 700 : 262; P.titleX += (tx - P.titleX) * 0.15;
    Draw.text(g, 'Casa do Kome', P.titleX, 34, { size: 30, col: PAL.cream, sw: 5 });
    Draw.text(g, '¥ ' + U.fmt(S.money) + ' · ' + countOwned() + '/' + D.DECOR.length + ' no quintal', P.titleX, 64, { size: 18, col: PAL.cream, sw: 4 });
    // varanda com as abas
    deck(g);
    const zones = [];
    const hov = i => P.mx !== undefined && !P.input.touch && P.my >= BAR.y - 6 && P.mx >= barX(i) && P.mx < barX(i) + BAR.w;
    tile(barX(-1), BAR.y, BAR.w, BAR.h, false, hov(-1), tabIcon('voltar'), 'Cavar');
    zones.push({ x: barX(-1) - 4, y: BAR.y - 10, w: BAR.w + 8, h: BAR.h + 18, fn: () => close() });
    TABS.forEach((tb, i) => {
      const x = barX(i), sel = P.card && P.card.type === 'tab' && P.card.id === tb.id;
      tile(x, BAR.y, BAR.w, BAR.h, sel, hov(i), tabIcon(tb.id), tb.n);
      zones.push({ x: x - 4, y: BAR.y - 10, w: BAR.w + 8, h: BAR.h + 18, fn: () => { if (sel) closeCard(); else openCard({ type: 'tab', id: tb.id }); } });
    });
    P.zones = zones;
    P.stage.cv.style.cursor = hot || (P.my >= BAR.y - 10 && P.mx !== undefined && zones.some(z => inR(P.mx, P.my, z))) ? 'pointer' : 'default';
    if (P.toast) {
      const o = P.toast, a = U.clamp(o.life * 3, 0, 1), tw = Math.max(200, o.t.length * 10.5 + 40);
      g.globalAlpha = a; g.fillStyle = INK; Draw.rrect(g, PW / 2 - tw / 2, BAR.y - 62, tw, 40, 14); g.fill(); Draw.text(g, o.t, PW / 2, BAR.y - 42, { size: 18, col: PAL.cream, sw: 0 }); g.globalAlpha = 1;
    }
  }
  function petCard(it) { openCard({ type: 'prop', id: it.id, title: it.n }); api.sfx('pling', { pitch: 1.3 }); }
  function ring(g, x, y, r, t) { g.strokeStyle = 'rgba(255,246,222,.9)'; g.lineWidth = 3; g.setLineDash([6, 6]); g.lineDashOffset = -t * 18; g.beginPath(); g.ellipse(x, y + 2, r, r * 0.28, 0, 0, 6.3); g.stroke(); g.setLineDash([]); }
  function withPop(g, id, x, y, fn) {
    const p = P.pops[id]; if (p === undefined) return fn();
    const e = Math.min(1, p / 0.5), s = Math.max(0.02, U.ease.back(e)), sq = 1 + Math.sin(e * Math.PI) * 0.12;
    g.save(); g.translate(x, y); g.scale(s / sq, s * sq); g.translate(-x, -y); fn(); g.restore();
  }
  function tickPlace(dt) {
    P.t += dt;
    for (const k in P.pops) { P.pops[k] += dt; if (P.pops[k] > 0.6) delete P.pops[k]; }
    if (P.ps) P.ps.update(dt); if (P.fl) P.fl.update(dt);
    if (P.pond && has('lago')) { P.pond.update(dt); if (P.koi) { syncKoi(P.koi); if (has('carpas')) P.koi.update(dt); } }
    if (P.bf) P.bf.update(dt); if (P.ff) P.ff.update(dt); if (P.birds) P.birds.update(dt);
    think(dt);
    const th = D.themeById[H0().theme] || D.THEMES[0]; fallTick(dt, PW, PH, th.fall, 1);
    if (P.toast) { P.toast.life -= dt; if (P.toast.life <= 0) P.toast = null; }
    // preços/estado do cartão acompanham o dinheiro (2× por segundo, só se mudou)
    if (P.card && Math.floor(P.t * 2) !== Math.floor((P.t - dt) * 2) && S.money !== P.lastMoney) { P.lastMoney = S.money; renderCard(false); }
  }
  // carpas só aparecem com o item comprado
  function syncKoi(k) { if (has('carpas')) { if (k._saved) { k.list.push.apply(k.list, k._saved); k._saved = null; } } else if (k.list.length) k._saved = k.list.splice(0); }
  function fail(e) {
    if (window.console) console.warn('[kome] casa: erro na cena, voltando pro painel antigo', e);
    const tab = P && P.tab; if (P) { P.broken = true; hidePlace(); }
    open = false; document.body.classList.remove('k-athome'); if (UI.root) UI.root.classList.remove('k-athome');
    try { openHome(tab || 'jardim'); } catch (e2) { /* nada */ }
  }
  function hidePlace() { if (!P) return; P.on = false; if (P.cardEl) P.cardEl.remove(); P.cardEl = null; P.card = null; P.tab = null; P.root.classList.remove('kh-open'); }
  const usePlace = () => !(P && P.broken) && !/[?&]casa=lista/.test(location.search || '') && E.Stage && E.Input && E.Nature && E.Nature.house;
  function openPlace(tab) {
    if (!P) buildPlace();
    P.root.classList.add('kh-open'); P.stage.resize(); P.on = true; P.lastMoney = S.money; P.side = 'r';
    tickPlace(0); drawPlace();                     // se a arte tiver erro, estoura aqui (antes de marcar a Casa como aberta)
    if (tab) openCard({ type: 'tab', id: tab });
  }

  G.Home = {
    init(a) { api = a; S = G.S; badge(); },
    sim: { cost, buy },   // tools/longo.js
    open: openHome, close, tick, draw, worldFX, clothFound, noteNew,
    isOpen: () => open,
    data: H0,
    // testes e prints: G.Home.place.tod(0.8) força a hora; .card('jardim'|'kome'|id); .sel(id); .step(s)
    place: {
      get on() { return !!(P && P.on); },
      tod: v => { if (P) P.todForce = v === undefined ? null : v; },
      card: id => { if (!P || !P.on) return; if (TABS.some(x => x.id === id)) openCard({ type: 'tab', id }); else openCard({ type: 'prop', id, title: (D.decorById[id] || {}).n || 'Kome' }); },
      sel: id => { if (P && P.card) { P.sel = id; renderCard(); } },
      close: () => P && P.card && closeCard(),
      step(sec) { for (let left = sec; left > 1e-6; left -= 1 / 30) tickPlace(Math.min(1 / 30, left)); drawPlace(); },
    },
  };
})();
