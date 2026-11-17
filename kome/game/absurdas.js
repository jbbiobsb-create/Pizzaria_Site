/* Kome no Japão — absurdas.js  (camada Cookie: as 6 MÁQUINAS ABSURDAS do Pátio, turmas 15–20)
   Os números moram em D.PATIO.turmas (data.js: c, r, seed = nó da árvore, tool = G.Tools da cena); a trava e a compra, no
   patio.js (unlocked/patio()); os nós (galho Absurdo, 25 → 3.000 sementes), em D.SEEDS (islands.js).
   Aqui: a CENA CURTA DE CHEGADA quando um nó Absurdo é comprado. Camada própria por cima de tudo (canvas + DOM), com relógio
   próprio; o jogo NÃO pausa por baixo e nada depende da cena terminar (pular, fechar ou nunca ver dá no mesmo).
   - Frota de Tatuzões: 3 tbm em modo 'transport' em fila · Kome-Oh: modo 'combine' · Trem-Bala, Foguete, Fuji, Portal: 'chegada'.
   - Sons: os que as máquinas já têm (trembala.audio, fuji.sound/stopSound, portal toca sozinho + silence, foguete toca sozinho;
     ao fechar, tudo é parado). Mudo (S.opts.mute / E.Audio.muted) cala tudo.
   - REGRA DE OURO: no modo acelerado (FAST: playtest/longo/step) a cena é pulada (o nó só fica marcado como visto).
   API: G.Absurdas.check(fast) (o patio.js chama no tick) · play(turmaId) (testes/prints/?dev&absurda=tatus) · skip() · isOpen(). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.U || !G.Data || !G.Data.PATIO) return;
  const U = E.U, PAL = E.PAL, Draw = E.Draw, D = G.Data;
  const ABS = D.PATIO.turmas.filter(t => t.seed);
  const W = 960, H = 540;   // a cena é composta em 960×540 e escalada pro tamanho da tela
  const lv = id => { const S = G.S; return S && S.stats && S.stats.sl ? S.stats.sl[id] | 0 : 0; };
  const muted = () => !!((G.S && G.S.opts && G.S.opts.mute) || (E.Audio && E.Audio.muted));
  let seen = null, queue = [], cur = null;

  /* ---- vigia: nó Absurdo novo -> fila de cenas (FAST: só marca) ---- */
  function check(fast) {
    if (!G.S || !G.S.stats) return;
    if (!seen) { seen = {}; for (const t of ABS) if (lv(t.seed)) seen[t.id] = 1; return; }   // o que já vinha no save não toca
    for (const t of ABS) if (!seen[t.id] && lv(t.seed)) { seen[t.id] = 1; if (!fast && !document.hidden) queue.push(t.id); }
    if (fast) { queue.length = 0; if (cur) close(); return; }
    if (!cur && queue.length) play(queue.shift());
  }

  /* ---- cenário (montanha de arroz, chão, morros) ---- */
  function heapFor(kind) {
    if (!E.Heap) return null;
    if (kind === 'trem') {
      const h = E.Heap({ width: 7600, colW: 8, x0: -3800, y0: 0, seed: 11 });
      h.generate(x => { const u = (x + 250) / 2600, k = 1 - u * u; return k > 0 ? 1180 * Math.pow(k, 0.75) + 30 * Math.sin(x * 0.011) + 14 * Math.sin(x * 0.031) : 0; });
      return h;
    }
    if (kind === 'robo') {
      const F = 520, h = E.Heap({ width: 3200, colW: 8, x0: F, y0: 0, seed: 5 });
      h.generate(x => { const d = x - F; return d > 0 ? Math.min(1250, d * 0.62 + 30 * Math.sin(d * 0.01) + 10 * Math.sin(d * 0.045)) : 0; });
      return h;
    }
    if (kind === 'monte') {
      const MW = 2800, MX0 = 700, MH = 1400, h = E.Heap({ width: MW * 2 + 2000, colW: 8, x0: -MW - 1000, y0: 0, seed: 11 });
      h.generate(x => { const d = x - MX0; if (d <= 0) return 0; const u = Math.min(1, d / (MW * 0.55)), k = d > MW ? 0 : 1;
        return k * (MH * Math.pow(Math.sin(u * Math.PI / 2), 1.3) + 26 * Math.sin(x * 0.011)) * (d > MW * 0.8 ? Math.max(0, 1 - (d - MW * 0.8) / (MW * 0.2)) : 1); });
      return h;
    }
    return null;
  }
  // cada máquina: como criar, quanto dura, como mexer a câmera e como tocar/calar o som
  const SCN = {
    tbm: {
      dur: 7.5, heap: null,
      make(T, sc) {
        const gap = (T.w || 900) * 1.25;
        sc.list = [0, 1, 2].map(i => { const m = T.create({ pilot: i ? (i === 1 ? 'goma' : 'kome') : 'kome', scale: 1, mode: 'transport' });
          const inp = { x: -i * gap, y: 0, face: 1, tx: 60000, ty: 0, digging: true, power: 1, speedMul: 3, vx: 0, floor: () => 0, load: 0, t: 0, parts: sc.parts, boost: 1, night: 0, zoom: 0.24 };
          return { m, inp }; });
        sc.cam = { x: -gap, y: 0, z: 0.24 }; sc.gy = 0.8;
      },
      step(T, sc, dt) { for (const o of sc.list) { o.inp.t = sc.t; T.update(o.m, dt, o.inp); } sc.cam.x = sc.list[1].m.x + 120; },
      draw(T, sc, g) { for (let i = sc.list.length - 1; i >= 0; i--) T.draw(g, sc.list[i].m); E.drawShiba(g, sc.list[0].m.x + 520, 0, 'cheer', sc.t, { scale: 1.4, face: -1, pal: 'kome' }); },
    },
    komeoh: {
      dur: 9.6, heap: 'robo',
      make(T, sc) {
        sc.m = T.create({ mode: 'combine', x: 0 });
        sc.inp = { x: 0, y: 0, face: 1, floor: x => Math.min(0, sc.heap ? sc.heap.surf(x) : 0), tx: null, ty: null, digging: false, boost: 0, parts: sc.parts, night: 0, dumpX: null, speedMul: 1 };
        sc.cam = { x: 220, y: -520 + H * 0.31 / 0.22, z: 0.22 }; sc.gy = 0.86;
      },
      step(T, sc, dt) {
        T.update(sc.m, dt, sc.inp); const m = sc.m, c = sc.cam;
        let fx = m.x + 220, fy = -520 + H * 0.31 / 0.22, zz = 0.22;
        if (m.mode === 'combine' && m.combine) { fx = m.combine.fx; zz = m.combine.zoom; fy = m.combine.fy + H * 0.36 / zz; }
        const k = Math.min(1, dt * 3); c.x += (fx - c.x) * k; c.y += (fy - c.y) * k; c.z += (zz - c.z) * k;
      },
      draw(T, sc, g) { T.draw(g, sc.m); },
      dark: sc => sc.m.dark || 0,
    },
    trembala: {
      heap: 'trem', x: 1800, dig: 11200,
      snd: (T, m, on) => { if (T.audio) T.audio(m, on); },
      stop: (T, m) => { if (T.audio) T.audio(m, false); },
    },
    foguete: {
      heap: 'monte', dig: 9000, opts: () => ({ sound: !muted() }),
      stop: (T, m, inp) => { m.sound = false; try { T.update(m, 0.001, inp); } catch (e) { /* */ } },
    },
    fuji: {
      heap: 'monte', dig: 9000,
      snd: (T, m, on) => { if (T.sound) T.sound(m, { mute: !on }); },
      stop: (T, m) => { if (T.stopSound) T.stopSound(m); },
    },
    portal: {
      heap: 'monte', dig: 9000, opts: () => ({ sfx: !muted() }),
      stop: (T, m) => { if (T.silence) T.silence(m); },
    },
  };
  // máquinas com modo 'chegada' (mesmo roteiro: a máquina dona da câmera m.cam, montanha do lado +x)
  for (const id of ['trembala', 'foguete', 'fuji', 'portal']) {
    const s = SCN[id];
    s.make = (T, sc) => {
      sc.m = T.create(Object.assign({ pilot: 'kome', mode: 'chegada' }, s.opts ? s.opts() : {}));
      sc.inp = { x: s.x || 0, y: 0, face: 1, digging: true, speedMul: 1, floor: x => (sc.heap ? -sc.heap.height(x) : 0), parts: sc.parts, night: 0, view: sc.view };
      sc.cam = { x: 0, y: -300, z: 0.2 }; sc.gy = 0.5;
      const ce = T.meta && T.meta.chegadaT ? T.meta.chegadaT : 9;
      sc.dur = Math.min(14, ce + 1.6);
    };
    s.step = (T, sc, dt) => {
      sc.inp.view = sc.view; T.update(sc.m, dt, sc.inp);
      if (s.snd) s.snd(T, sc.m, !muted());
      if (sc.heap && T.dig) { try { T.dig(sc.m, sc.heap, s.dig * dt); } catch (e) { /* */ } }
      const c = sc.m.cam; if (c) { sc.cam.x = c.x; sc.cam.y = c.y; sc.cam.z = c.z; }
    };
    s.draw = (T, sc, g) => T.draw(g, sc.m);
  }

  /* ---- a camada (DOM + canvas) ---- */
  let ov = null;
  function build() {
    if (ov) return ov;
    const css = document.createElement('style');
    css.textContent = '.k-abs{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(18,12,8,.78);'
      + 'font-family:"Zen Maru Gothic","Nunito","Trebuchet MS",system-ui,sans-serif;color:#FFF6DC;user-select:none;-webkit-user-select:none;touch-action:none;opacity:0;transition:opacity .25s}'
      + '.k-abs.on{opacity:1}.k-abs-kick{font-size:14px;letter-spacing:.18em;font-weight:900;color:#FFD86A;text-shadow:0 2px 0 #3B2818}'
      + '.k-abs-name{font-size:26px;font-weight:900;text-shadow:0 3px 0 #3B2818,0 0 12px rgba(255,200,80,.5);text-align:center;padding:0 12px}'
      + '.k-abs canvas{display:block;border:4px solid #3B2818;border-radius:16px;box-shadow:0 6px 0 #3B2818,0 0 40px rgba(255,210,90,.25);background:#9FD3F0}'
      + '.k-abs-row{display:flex;gap:12px;align-items:center;font-size:13px;opacity:.85}'
      + '.k-abs-skip{font:inherit;font-weight:900;font-size:15px;min-height:40px;min-width:96px;padding:6px 16px;border-radius:14px;border:3px solid #3B2818;background:#FFE9A8;color:#2A1A10;box-shadow:0 3px 0 #3B2818;cursor:pointer}';
    document.head.appendChild(css);
    const el = document.createElement('div'); el.className = 'k-abs';
    const kick = document.createElement('div'); kick.className = 'k-abs-kick'; kick.textContent = 'MÁQUINA ABSURDA NOVA!';
    const name = document.createElement('div'); name.className = 'k-abs-name';
    const cv = document.createElement('canvas');
    const row = document.createElement('div'); row.className = 'k-abs-row';
    const tip = document.createElement('span'); tip.textContent = 'toque pra pular · Esc';
    const btn = document.createElement('button'); btn.className = 'k-abs-skip'; btn.textContent = 'Pular';
    row.appendChild(tip); row.appendChild(btn);
    el.appendChild(kick); el.appendChild(name); el.appendChild(cv); el.appendChild(row);
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); skip(); });
    addEventListener('keydown', e => { if (cur && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); skip(); } }, true);
    ov = { el, name, cv, g: cv.getContext('2d') };
    return ov;
  }
  function fit() {
    const o = ov, dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(240, Math.min(innerWidth - 32, (innerHeight - 130) * W / H, 1100)), h = w * H / W;
    o.cv.style.width = Math.round(w) + 'px'; o.cv.style.height = Math.round(h) + 'px';
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (o.cv.width !== pw || o.cv.height !== ph) { o.cv.width = pw; o.cv.height = ph; }
    o.k = pw / W;
  }

  function play(id) {
    const t = ABS.find(x => x.id === id), T = t && G.Tools && G.Tools[t.tool], cfg = t && SCN[t.tool];
    if (!t || !T || !cfg || !document.body) return false;
    if (cur) close();
    const o = build();
    const sc = { id, t: 0, turma: t, T, cfg, parts: E.Particles ? E.Particles(1200) : null, view: { x0: 0, x1: 0, y0: 0, y1: 0 }, dur: cfg.dur || 9, raf: 0, last: 0 };
    try { sc.heap = heapFor(cfg.heap); cfg.make(T, sc); } catch (e) { console.warn('[kome] absurda', e); return false; }
    cur = sc;
    o.name.textContent = t.n;
    if (!o.el.parentNode) document.body.appendChild(o.el);
    fit(); requestAnimationFrame(() => o.el.classList.add('on'));
    try { if (!muted() && E.Sfx && E.Sfx.play) E.Sfx.play('fanfare', { vol: 0.7 }); } catch (e) { /* sem áudio */ }
    sc.last = performance.now();
    const frame = now => {
      if (cur !== sc) return;
      const dt = Math.min(1 / 20, Math.max(0, (now - sc.last) / 1000)); sc.last = now;
      try { tick(sc, dt); render(sc); } catch (e) { console.warn('[kome] absurda', e); close(); return; }
      if (sc.t >= sc.dur) { close(); return; }
      sc.raf = requestAnimationFrame(frame);
    };
    sc.raf = requestAnimationFrame(frame);
    return true;
  }
  function tick(sc, dt) {
    // passos fixos (as máquinas são estáveis em 1/60)
    sc.acc = (sc.acc || 0) + dt;
    while (sc.acc >= 1 / 60) { sc.acc -= 1 / 60; sc.t += 1 / 60; sc.cfg.step(sc.T, sc, 1 / 60); if (sc.heap) sc.heap.relax(1 / 60); if (sc.parts) sc.parts.update(1 / 60, () => 0); }
  }
  function render(sc) {
    const o = ov, g = o.g; fit();
    const k = o.k, c = sc.cam, gy = H * (sc.gy || 0.5), m = sc.m;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, o.cv.width, o.cv.height);
    const shake = m && m.shakeK > 0 ? m.shakeK * m.shakeK * 20 : 0;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.save();
    g.translate(W / 2 + (Math.random() - 0.5) * shake, gy + (Math.random() - 0.5) * shake); g.scale(c.z, c.z); g.translate(-c.x, -c.y);
    const v = sc.view; v.x0 = c.x - W / 2 / c.z; v.x1 = c.x + W / 2 / c.z; v.y0 = c.y - gy / c.z; v.y1 = c.y + (H - gy) / c.z;
    if (Draw.lod) Draw.lod(c.z);
    // céu, morros, montanha, chão
    g.fillStyle = PAL.sky; g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    g.fillStyle = U.mixCss(PAL.sky, PAL.skyL, 0.5); g.fillRect(v.x0, -900, v.x1 - v.x0, 910);
    g.fillStyle = U.mixCss(PAL.grassL, PAL.sky, 0.55); g.beginPath(); g.moveTo(v.x0, 10);
    for (let x = v.x0; x <= v.x1 + 64; x += 64) g.lineTo(x, -420 - 200 * Math.sin(x * 0.0007 + 1) - 60 * Math.sin(x * 0.002));
    g.lineTo(v.x1 + 64, 10); g.closePath(); g.fill();
    const dk = sc.cfg.dark ? sc.cfg.dark(sc) : 0;
    if (dk > 0.01) { g.fillStyle = 'rgba(30,24,60,' + (0.62 * dk).toFixed(3) + ')'; g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0); }
    if (sc.heap) sc.heap.draw(g, v, sc.t);
    g.fillStyle = '#C7A26A'; g.fillRect(v.x0, 0, v.x1 - v.x0, Math.max(10, v.y1));
    g.fillStyle = PAL.grass; g.fillRect(v.x0, 0, v.x1 - v.x0, 12);
    sc.cfg.draw(sc.T, sc, g);
    if (sc.parts) sc.parts.draw(g, v);
    g.restore();
    if (Draw.lod) Draw.lod(1);
    if (m && m.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, m.flash * 0.75).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
    // barrinha do tempo
    g.fillStyle = 'rgba(59,40,24,.55)'; g.fillRect(0, H - 6, W, 6);
    g.fillStyle = '#FFD86A'; g.fillRect(0, H - 6, W * Math.min(1, sc.t / sc.dur), 6);
  }
  function stopSound(sc) {
    const s = sc.cfg;
    try { if (s.stop) s.stop(sc.T, sc.m, sc.inp); } catch (e) { /* */ }
  }
  function close() {
    const sc = cur; if (!sc) return;
    cur = null; cancelAnimationFrame(sc.raf); stopSound(sc);
    if (ov) { ov.el.classList.remove('on'); const el = ov.el; setTimeout(() => { if (!cur && el.parentNode) el.parentNode.removeChild(el); }, 260); }
    const UI = E.UI;
    if (UI && UI.banner && UI.root) { try { UI.banner(sc.turma.n.toUpperCase() + ' CHEGOU!', 'nova turma no Pátio da Frota · ' + (G.Patio && G.Patio.on && G.Patio.on() ? 'já dá pra comprar' : 'abre no fim da ilha'), { icon: 'star', tone: 'gold', dur: 3.2 }); } catch (e) { /* */ } }
    if (queue.length) setTimeout(() => { if (!cur && queue.length) play(queue.shift()); }, 400);
  }
  function skip() { if (cur) close(); }

  G.Absurdas = { check, play, skip, isOpen: () => !!cur, list: () => ABS.map(t => t.id), SCN };
  // demo: ?dev&absurda=tatus (toca a cena da turma, sem precisar do nó)
  const qa = /[?&]absurda=([a-z]+)/.exec(location.search || '');
  if (qa) { const go = () => (G.S && document.body ? setTimeout(() => play(qa[1]), 600) : setTimeout(go, 200)); go(); }
})();
