/* ============================================================================
   Pixxel v1.1 — assets.js
   Carrega o que sai do Pixxel Estúdio e toca as animações no jogo.
     E.Assets.add(id, def)            registra (o .pixxel.js exportado chama isso sozinho)
     E.Assets.fromSheet(id, png, json) carrega spritesheet + JSON (formato Aseprite também serve)
     E.Assets.get(id) -> asset | null ; E.Assets.ready(id) -> bool ; E.Assets.list()
     E.Assets.whenReady(fn)           chama quando tudo que foi registrado carregou
     E.Anim(id, tag='parado')         -> anim { tag, frame, t, done, flip, play(tag, restart), update(dt), draw(g, x, y, o) }
     E.Assets.draw(g, id, frame, x, y, o) desenha um quadro com âncora nos pés
   def = { img: dataURL|url|HTMLImageElement, w, h, frames: [dur ms...], anims: {nome: {from, to, dir}},
           tipo, altura, ancora: 'pés'|'centro' }
   Desenho: pés em (x,y), escala o.scale (padrão 1), o.flip espelha, o.alpha.
   Depende de: core.js (opcional pix.js pra E.drawSprite)
   ============================================================================ */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const E = (root.Pixxel = root.Pixxel || {});
  const store = Object.create(null), waiting = [];
  let pending = 0;

  function finish() { pending = Math.max(0, pending - 1); if (!pending) while (waiting.length) { try { waiting.shift()(); } catch (e) { console.error(e); } } }
  function loadImg(src, cb) {
    if (typeof Image === 'undefined') return cb(null);
    if (src && src.tagName) { if (src.complete) cb(src); else src.onload = () => cb(src); return; }
    const im = new Image(); im.onload = () => cb(im); im.onerror = () => { console.warn('Pixxel.Assets: não carregou', String(src).slice(0, 60)); cb(null); }; im.src = src;
  }

  const Assets = {
    // add(id, def): registra e começa a carregar a imagem
    add(id, def) {
      const a = store[id] = Object.assign({ id, ok: false, cols: 0, frames: [100], anims: {}, ancora: 'pés' }, def);
      if (!a.anims || !Object.keys(a.anims).length) a.anims = { parado: { from: 0, to: a.frames.length - 1, dir: 'forward' } };
      pending++;
      loadImg(def.img, im => { a.image = im; if (im) { a.cols = Math.max(1, Math.floor(im.width / a.w)); a.ok = true; } finish(); });
      return a;
    },
    // fromSheet(id, pngUrl, json): json = objeto ou url; aceita o JSON do Estúdio e o do Aseprite (hash ou array)
    fromSheet(id, png, json) {
      const go = j => {
        const fr = Array.isArray(j.frames) ? j.frames : Object.values(j.frames), f0 = fr[0].frame;
        const anims = {}; ((j.meta && j.meta.frameTags) || []).forEach(t => anims[t.name] = { from: t.from, to: t.to, dir: t.direction || 'forward' });
        const px = (j.meta && j.meta.pixxel) || {};
        return Assets.add(id, { img: png, w: f0.w, h: f0.h, frames: fr.map(f => f.duration || 100), rects: fr.map(f => f.frame), anims, tipo: px.tipo, altura: px.altura });
      };
      if (typeof json === 'string') { pending++; fetch(json).then(r => r.json()).then(j => { go(j); finish(); }).catch(e => { console.warn(e); finish(); }); return null; }
      return go(json);
    },
    get: id => store[id] || null,
    ready: id => !!(store[id] && store[id].ok),
    list: () => Object.keys(store),
    whenReady(fn) { if (!pending) fn(); else waiting.push(fn); },
    // rect(a, frame) -> {x,y,w,h} na imagem
    rect(a, f) { if (a.rects) return a.rects[f]; return { x: (f % a.cols) * a.w, y: Math.floor(f / a.cols) * a.h, w: a.w, h: a.h }; },
    // draw(g, id, frame, x, y, {scale=1, flip, alpha=1, ancora}) — pés em (x,y)
    draw(g, id, f, x, y, o) {
      const a = typeof id === 'string' ? store[id] : id; if (!a || !a.ok) return;
      o = o || {}; const r = Assets.rect(a, f | 0), s = o.scale || 1, w = r.w * s, h = r.h * s, anc = o.ancora || a.ancora;
      const dx = Math.round(x - w / 2), dy = Math.round(anc === 'centro' ? y - h / 2 : y - h);
      g.save(); if (o.alpha != null) g.globalAlpha *= o.alpha; g.imageSmoothingEnabled = s < 1;
      if (o.flip) { g.translate(dx + w, dy); g.scale(-1, 1); g.drawImage(a.image, r.x, r.y, r.w, r.h, 0, 0, w, h); }
      else g.drawImage(a.image, r.x, r.y, r.w, r.h, dx, dy, w, h);
      g.restore();
    },
  };

  // E.Anim(id, tag) -> tocador de animação por tag (forward | reverse | pingpong), respeita a duração de cada quadro
  function Anim(id, tag) {
    const A = {
      id, tag: null, frame: 0, t: 0, done: false, flip: false, speed: 1, loop: true, dir: 1,
      get asset() { return store[id]; },
      play(t, restart) { const a = store[id]; if (!a) return A; if (!a.anims[t]) t = Object.keys(a.anims)[0]; if (A.tag === t && !restart) return A; A.tag = t; const an = a.anims[t]; A.frame = an.dir === 'reverse' ? an.to : an.from; A.t = 0; A.done = false; A.dir = an.dir === 'reverse' ? -1 : 1; return A; },
      update(dt) {
        const a = store[id]; if (!a || !a.ok) return A; if (!A.tag) A.play(tag || 'parado'); const an = a.anims[A.tag]; if (!an || A.done) return A;
        A.t += dt * 1000 * A.speed;
        let guard = 0;
        while (A.t >= (a.frames[A.frame] || 100) && guard++ < 64) {
          A.t -= a.frames[A.frame] || 100; let nf = A.frame + A.dir;
          if (nf > an.to || nf < an.from) {
            if (an.dir === 'pingpong') { A.dir = -A.dir; nf = A.frame + A.dir; if (an.from === an.to) nf = an.from; }
            else if (!A.loop) { A.done = true; break; } else nf = A.dir > 0 ? an.from : an.to;
          }
          A.frame = Math.max(an.from, Math.min(an.to, nf));
        }
        return A;
      },
      draw(g, x, y, o) { Assets.draw(g, id, A.frame, x, y, Object.assign({ flip: A.flip }, o || {})); return A; },
    };
    if (tag) A.tag = null, A.play(tag);
    return A;
  }

  E.Assets = Assets;
  E.Anim = Anim;
})();
