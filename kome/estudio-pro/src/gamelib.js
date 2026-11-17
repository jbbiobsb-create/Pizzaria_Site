/* ==========================================================================
   Pixxel Estúdio — gamelib.js  (coisas do jogo "Kome no Japão")
   Usa os próprios módulos do jogo (G.Tools, G.World, G.Scale, G.Props e as
   fichas de conteudo/) pra capturar máquinas, ferramentas, construções do
   pátio e adereços — animados, do jeito que aparecem no jogo — e abrir no
   estúdio pra editar por cima ou usar de base.
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, E = S.E, { h, clamp } = S;
  const G = () => window.KomeGame || {};

  const canvasOf = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
  // recorte comum de vários buffers (mantém o chão alinhado) + redução se passar do limite
  function cropAll(bufs, W, H, maxDim) {
    let bb = null; bufs.forEach(b => { const q = S.bboxOf(b, W, H); if (q) bb = bb ? { x: Math.min(bb.x, q.x), y: Math.min(bb.y, q.y), x2: Math.max(bb.x2, q.x + q.w), y2: Math.max(bb.y2, q.y + q.h) } : { x: q.x, y: q.y, x2: q.x + q.w, y2: q.y + q.h }; });
    if (!bb) return null; const w = bb.x2 - bb.x, hh = bb.y2 - bb.y;
    const out = bufs.map(b => { const o = new Uint32Array(w * hh); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) o[y * w + x] = b[(bb.y + y) * W + bb.x + x]; return o; });
    if (maxDim && Math.max(w, hh) > maxDim) { const k = maxDim / Math.max(w, hh); return out.map(o => S.pxScale(o, w, hh, k)).map(r => ({ buf: r.buf, w: r.w, h: r.h })); }
    return out.map(o => ({ buf: o, w, h: hh }));
  }
  const TOOL_PT = { pata: 'Pata', hashi: 'Hashi', tigela: 'Tigela', pa: 'Pá', duaspas: 'Duas pás', carrinho: 'Carrinho de mão', britadeira: 'Britadeira', trator: 'Trator carregadeira', empilhadeira: 'Empilhadeira', escav: 'Escavadeira', colheita: 'Colheitadeira', bagger: 'Bagger 293' };

  /* ---------------- máquinas e ferramentas (G.Tools) ---------------- */
  function captureTool(id, mode, n, o) {
    o = o || {}; const T = G().Tools[id]; if (!T) return null;
    const big = (T.w || 200) > 600, sc = big ? 0.5 : 1, W = Math.ceil(((T.w || 200) * 1.6 + 160) * sc), Hh = Math.ceil(((T.h || 150) * 1.4 + 80) * sc), gy = Hh - 12;
    const m = T.create({ pilot: o.pilot || 'kome', scale: sc, seed: 3 });
    const floor = () => gy;
    const inp = { x: W * 0.42, y: gy, face: 1, tx: null, ty: null, digging: mode === 'trabalhar', power: 1, speedMul: 1, vx: mode === 'andar' ? 40 : 0, floor, t: 0, parts: null, boost: 0, night: 0, zoom: 1 };
    if (mode === 'trabalhar') { inp.tx = W * 0.42 + (T.w || 120) * 0.55 * sc; inp.ty = gy - 4; }
    const dt = 1 / 30, [c, g] = canvasOf(W, Hh), bufs = [];
    let t = 0; const step = () => { t += dt; inp.t = t; if (mode === 'andar') inp.x += 40 * dt; T.update(m, dt, inp); };
    for (let i = 0; i < 45; i++) step(); // aquece
    const every = Math.max(1, Math.round((o.span || (mode === 'trabalhar' ? 2.4 : 1.2)) / dt / n));
    for (let f = 0; f < n; f++) { for (let i = 0; i < every; i++) step(); g.clearRect(0, 0, W, Hh); g.save(); if (mode === 'andar') g.translate(-(inp.x - W * 0.42), 0); try { T.draw(g, m); } catch (e) { } g.restore(); bufs.push(S.fromCanvas(c)); }
    return cropAll(bufs, W, Hh, 1000);
  }

  /* ---------------- pátio (G.World): construções e adereços ---------------- */
  const OWN = new Proxy({}, { get: () => true });
  const FAKE_S = { own: OWN, house: 3, tool: 3, tod: 0.4, time: 0, pilots: OWN, money: 0, combo: 0 };
  const RULER_PT = ['Fábrica', 'Torre', 'Vila', 'Poste', 'Torii', 'Sakura', 'Barraquinha', 'Casinha'];
  const PROPS_PT = ['Fila de clientes', 'Balança', 'Noboris', 'Ekiben', 'Caixotes', 'Saquê', 'Outdoor do Kome', 'Espantalho', 'Silo', 'Esteira', 'Shiba apontando', 'Antena', 'Oficina', 'Luzes', 'Mural', 'Mesinha'];
  function captureWorld(drawFn, n) {
    const W = 900, Hh = 620, gy = Hh - 20, [c, g] = canvasOf(W, Hh), bufs = [];
    if (G().World && G().World.setSize) try { G().World.setSize(W, Hh); } catch (e) { }
    for (let f = 0; f < n; f++) { g.clearRect(0, 0, W, Hh); g.save(); g.translate(0, gy); try { if (E.Nature) E.Nature.tod = 0.4; drawFn(g, W / 2, 0.3 + f * 0.25, FAKE_S); } catch (e) { } g.restore(); bufs.push(S.fromCanvas(c)); }
    return cropAll(bufs, W, Hh, 700);
  }
  // fichas do conteudo/ (embutidas no build)
  function fichaFrames(f) { const rows = s => s.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim()).map(l => l.trim()); const fr = (f.quadros && f.quadros.length ? f.quadros : [f.desenho]).map(rows); return fr.map(r => S.lettersToBuf(r, true)); }

  /* ---------------- aba da biblioteca ---------------- */
  let sec = 'maquinas';
  S.renderGameLib = function (opts, gal, card, close, rerender) {
    const g0 = G(); if (!g0.Tools) { gal.appendChild(h('div', { class: 'hint' }, 'Os módulos do jogo não estão nesta versão.')); return; }
    const SECS = { maquinas: 'Máquinas e ferramentas', patio: 'Pátio e construções', veiculos: 'Veículos e coletores', itens: 'Itens e ícones', fichas: 'Conteúdo (fichas)' };
    opts.append(h('div', { class: 'chips' }, ...Object.entries(SECS).map(([k, v]) => h('button', { class: 'chip' + (k === sec ? ' on' : ''), onclick: () => { sec = k; rerender(); } }, v))), h('div', { class: 'hint' }, 'Capturado dos próprios módulos do jogo, animado. "Abrir" cria um desenho com as tags; "Por cima" cola como camada.'));
    const jobs = [];
    if (sec === 'maquinas') Object.keys(g0.Tools).forEach(id => jobs.push(() => {
      const prev = captureTool(id, 'parado', 1); if (!prev) return null; const nm = TOOL_PT[id] || g0.Tools[id].name || id;
      return [S.toCanvas(prev[0].buf, prev[0].w, prev[0].h), nm + ' · ' + prev[0].w + '×' + prev[0].h, () => { S.toast('Capturando ' + nm + '…'); setTimeout(() => { const a = captureTool(id, 'trabalhar', 12) || [], b = captureTool(id, 'parado', 6) || []; const all = a.concat(b); if (!all.length) return; const W = Math.max(...all.map(x => x.w)), Hh = Math.max(...all.map(x => x.h)); const fit = all.map(x => { const o = new Uint32Array(W * Hh); for (let y = 0; y < x.h; y++) for (let xx = 0; xx < x.w; xx++) o[(Hh - x.h + y) * W + Math.floor((W - x.w) / 2) + xx] = x.buf[y * x.w + xx]; return { buf: o, w: W, h: Hh }; }); S.openFrames(fit, nm, { pad: 2, tipo: 'veículo', dur: 80, tags: [{ name: 'trabalhar', from: 0, to: a.length - 1, dir: 'frente', cor: S.tagColor(0) }, { name: 'parado', from: a.length, to: all.length - 1, dir: 'frente', cor: S.tagColor(1) }] }); }, 30); }];
    }));
    if (sec === 'patio' && g0.World) {
      (g0.World.RULER || []).forEach((o, i) => jobs.push(() => { const fr = captureWorld(o.draw, 1); if (!fr) return null; const nm = RULER_PT[i] || 'Construção ' + (i + 1); return [S.toCanvas(fr[0].buf, fr[0].w, fr[0].h), nm + ' · ' + fr[0].w + '×' + fr[0].h, () => S.openFrames(captureWorld(o.draw, 6), nm, { tipo: 'construção', dur: 150, tags: [{ name: 'parado', from: 0, to: 5, dir: 'frente', cor: S.tagColor(0) }] })]; }));
      (g0.World.props || []).forEach((o, i) => jobs.push(() => { const fr = captureWorld(o.draw, 1); if (!fr) return null; const nm = PROPS_PT[i] || 'Adereço ' + (i + 1); return [S.toCanvas(fr[0].buf, fr[0].w, fr[0].h), nm + ' · ' + fr[0].w + '×' + fr[0].h, () => S.openFrames(captureWorld(o.draw, 6), nm, { tipo: 'enfeite', dur: 150 })]; }));
    }
    if (sec === 'veiculos' && g0.Scale) Object.entries(g0.Scale).forEach(([id, sc]) => jobs.push(() => { const draw = (g, x, t) => sc.draw(g, x, 0, { face: 1, t, fill: 0.6 }); const fr = captureWorld(draw, 1); if (!fr) return null; const nm = { pickup: 'Pickup', keitruck: 'Kei truck', moega: 'Moega' }[id] || id; return [S.toCanvas(fr[0].buf, fr[0].w, fr[0].h), nm + ' · ' + fr[0].w + '×' + fr[0].h, () => S.openFrames(captureWorld(draw, 6), nm, { tipo: 'veículo', dur: 120 })]; }));
    if (sec === 'itens' && g0.Props) {
      ['sack:plain', 'sack:golden', 'sack:legendary', 'onigiri', 'coin', 'crate', 'pallet', 'sold', 'hardhat'].forEach(k => jobs.push(() => { const [nm, a] = k.split(':'); let s2; try { s2 = g0.Props.get(nm, a); } catch (e) { s2 = null; } const cv = s2 && (s2.cv || s2); if (!cv || !cv.width) return null; const b = S.fromCanvas(cv); return [cv, k.replace(':', ' ') + ' · ' + cv.width + '×' + cv.height, () => S.openFrames([{ buf: b, w: cv.width, h: cv.height }], k.replace(':', ' '), { tipo: 'objeto' })]; }));
      Object.keys(TOOL_PT).forEach(id => jobs.push(() => { let cv; try { cv = g0.Props.icon(id); cv = cv && (cv.cv || cv); } catch (e) { cv = null; } if (!cv || !cv.width) return null; const b = S.fromCanvas(cv); return [cv, 'ícone ' + (TOOL_PT[id] || id), () => S.openFrames([{ buf: b, w: cv.width, h: cv.height }], 'Ícone ' + (TOOL_PT[id] || id), { tipo: 'objeto', pad: 0 })]; }));
    }
    if (sec === 'fichas') (window.KomeConteudo || []).filter(f => f.desenho).forEach(f => jobs.push(() => { const fr = fichaFrames(f); return [S.toCanvas(fr[0].buf, fr[0].w, fr[0].h), (f.nome || f.id) + ' (' + f.tipo + ')', () => S.openFrames(fr, f.nome || f.id, { tipo: f.tipo })]; }));
    let i = 0; const step = () => { const t0 = performance.now(); while (i < jobs.length && performance.now() - t0 < 30) { let r = null; try { r = jobs[i](); } catch (e) { console.warn(e); } i++; if (r) gal.appendChild(card(r[0], r[1], [['Abrir', r[2]], ['Por cima', () => { const b = S.fromCanvas(r[0]); S.openFrames([{ buf: b, w: r[0].width, h: r[0].height }], r[1].split(' · ')[0], { asLayer: true }); }]])); } if (i < jobs.length && document.body.contains(gal)) requestAnimationFrame(step); }; step();
  };
})();
