/* =====================================================================
   Kome Engine v1.0 · fx.js
   Câmera, partículas, textos flutuantes e efeitos de tela.

   - E.Camera     câmera 2D: follow suave, zoom em escala logarítmica (não treme em zoom minúsculo),
                  shake por trauma (ruído suave, não aleatório por frame), limites, fit, parallax
   - E.Particles  partículas em typed arrays (sem alocar por frame, swap-remove), 13 formas,
                  chão com quique/pouso, desenho em lotes por cor
   - E.Floaters   textos "+¥123" que sobem, com pop e contorno no estilo Kome
   - E.ScreenFX   flash, fade, barras de cinema, vinheta, linhas de velocidade, hitstop, confete,
                  anel de impacto e íris

   Depende de core.js (pix.js é opcional: só usa E.PAL / E.Draw.FONT se existirem).
   ===================================================================== */
(function () {
  'use strict';
  const E = (window.KomeEngine = window.KomeEngine || {});
  if (!E.U) throw new Error('KomeEngine: carregue core.js antes de fx.js');
  const U = E.U, Noise = E.Noise;
  const TAU = Math.PI * 2, HALF_PI = Math.PI / 2;
  const LINE = E.LINE_CSS || '#3B2818';
  const INK = '#2A1A10', CREAM = '#FFFAEE', DEEP = '#1E120A';
  const PAL = E.PAL || { gold: '#F3C94A', goldL: '#FFE68A', goldD: '#B4852A', red: '#C8423A', yel: '#EDB93A', ora: '#E2742E',
    grass: '#7F9E5C', water: '#6FB3D2', sakura: '#F4B8C5', sakuraD: '#D98AA0', waterL: '#B5E0EE', rice: '#FFFDF6', riceS: '#E6DCC4', sand: '#E9D3A8' };
  const FONT = (E.Draw && E.Draw.FONT) || "'Zen Maru Gothic','M PLUS Rounded 1c','Hiragino Maru Gothic ProN','Nunito',system-ui,sans-serif";
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const fontCache = new Map();
  // fonte de jogo (peso 900) cacheada por tamanho inteiro
  function fontOf(size) {
    size = Math.max(1, Math.round(size));
    let f = fontCache.get(size);
    if (!f) { f = '900 ' + size + 'px ' + FONT; fontCache.set(size, f); }
    return f;
  }
  // valor fixo ou sorteado: número passa direto, [a,b] sorteia no intervalo, undefined vira d
  function val(v, d) {
    if (v === undefined || v === null) return d;
    return typeof v === 'number' ? v : v[0] + Math.random() * (v[1] - v[0]);
  }

  /* ======================================================================
     1. Camera
     ====================================================================== */
  // E.Camera(vw, vh) -> cam: câmera centrada em (x,y) com zoom z; (vw,vh) = tamanho lógico da tela
  function Camera(vw, vh) {
    const anchor = { on: false, sx: 0, sy: 0, wx: 0, wy: 0 };
    const pv = { x0: 0, x1: 0, y0: 0, y1: 0, z: 1 };   // vista da camada de parallax (reaproveitada)
    let vox = 0, voy = 0, vzp = 0;                      // velocidades das molas (kick e punch)
    const c = {
      x: 0, y: 0, z: 1, tz: 1, vw, vh,
      tx: 0, ty: 0, auto: false,   // alvo automático (fit/moveTo); follow() desliga
      k: 6, zk: 2.2,               // rigidez do movimento e do zoom (1/s)
      minZ: 0.02, maxZ: 40,
      bounds: null,                // {x0,x1,y0,y1} em mundo; a vista nunca sai daí (lado ausente = sem limite)
      shake: 0,                    // legado: amplitude em px de tela, decai sozinha
      trauma: 0,                   // 0..1; o tremor é trauma² (pancada grande treme MUITO mais que pequena)
      maxShake: 16, maxRoll: 0.03, shakeFreq: 26, traumaDecay: 1.3,
      snap: 0,                     // >0: arredonda a translação pra 1/snap px de tela (use stage.dpr com pixel art parada)
      sx: 0, sy: 0, roll: 0,       // tremor atual (px de tela, rad); calculado no update
      ox: 0, oy: 0,                // deslocamento do kick (px de tela), volta sozinho com mola
      zp: 0,                       // soco de zoom (fração), volta sozinho com mola
      time: 0,

      // follow(tx,ty,dt,k=6): aproxima o centro do ponto (tx,ty); suavização independente de fps
      follow(tx, ty, dt, k) {
        k = k === undefined ? c.k : k;
        c.auto = false; anchor.on = false; c.tx = tx; c.ty = ty;
        chase(dt, k);
        return c;
      },
      // moveTo(x,y,k?): define um alvo e deixa o update levar a câmera até lá
      moveTo(x, y, k) { c.tx = x; c.ty = y; c.auto = true; anchor.on = false; if (k) c.k = k; return c; },
      // zoomTo(z,k?): zoom alvo (suave, em escala log); k = rigidez (padrão 2.2); k=Infinity pula direto
      zoomTo(z, k) {
        c.tz = U.clamp(z, c.minZ, c.maxZ);
        if (k === Infinity) c.z = c.tz; else if (k) c.zk = k;
        return c;
      },
      // zoomAt(z,sx,sy,k?): zoom mantendo o ponto de tela (sx,sy) parado (roda do mouse, pinça)
      zoomAt(z, sx, sy, k) {
        const w = c.toWorld(sx, sy, anchor);
        anchor.wx = w.x; anchor.wy = w.y; anchor.sx = sx; anchor.sy = sy; anchor.on = true; c.auto = false;
        return c.zoomTo(z, k);
      },
      // fit(x0,y0,x1,y1,margin=0,instant=false): enquadra o retângulo de mundo (margem em px de tela)
      fit(x0, y0, x1, y1, margin, instant) {
        margin = margin || 0;
        const w = Math.max(1e-6, Math.abs(x1 - x0)), h = Math.max(1e-6, Math.abs(y1 - y0));
        const aw = Math.max(1, vw - margin * 2), ah = Math.max(1, vh - margin * 2);
        c.tz = U.clamp(Math.min(aw / w, ah / h), c.minZ, c.maxZ);
        c.tx = (x0 + x1) / 2; c.ty = (y0 + y1) / 2; c.auto = true; anchor.on = false;
        if (instant) c.snapTo();
        return c;
      },
      // snapTo(x?,y?,z?): pula direto pro alvo (ou pros valores dados), sem suavizar
      snapTo(x, y, z) {
        if (x !== undefined) c.tx = x;
        if (y !== undefined) c.ty = y;
        if (z !== undefined) c.tz = U.clamp(z, c.minZ, c.maxZ);
        c.x = c.tx; c.y = c.ty; c.z = c.tz; anchor.on = false;
        clampBounds();
        return c;
      },
      // apply(g): aplica a transformação mundo -> tela (não faz save; use begin/end ou save/restore por fora)
      apply(g) {
        const z = c.z * (1 + c.zp);
        let px = vw / 2 + c.sx + c.ox, py = vh / 2 + c.sy + c.oy;
        if (c.snap > 0 && !c.roll) {
          // arredonda a posição final da origem do mundo, não o centro: sprites param de "nadar"
          const s = c.snap;
          px = Math.round((px - c.x * z) * s) / s + c.x * z;
          py = Math.round((py - c.y * z) * s) / s + c.y * z;
        }
        g.translate(px, py);
        if (c.roll) g.rotate(c.roll);
        g.scale(z, z);
        g.translate(-c.x, -c.y);
        return c;
      },
      // unapply(g): desfaz o apply (volta pra coordenadas de tela sem precisar de save/restore)
      unapply(g) {
        const z = c.z * (1 + c.zp);
        g.translate(c.x, c.y);
        g.scale(1 / z, 1 / z);
        if (c.roll) g.rotate(-c.roll);
        g.translate(-(vw / 2 + c.sx + c.ox), -(vh / 2 + c.sy + c.oy));
        return c;
      },
      // begin(g) / end(g): save + apply / restore
      begin(g) { g.save(); return c.apply(g); },
      end(g) { g.restore(); return c; },
      // toWorld(sx,sy,out?) -> {x,y}: tela -> mundo (ignora o tremor, pra clique não tremer junto)
      toWorld(sx, sy, out) {
        out = out || { x: 0, y: 0 };
        out.x = (sx - vw / 2) / c.z + c.x; out.y = (sy - vh / 2) / c.z + c.y;
        return out;
      },
      // toScreen(wx,wy,out?) -> {x,y}: mundo -> tela (ignora o tremor)
      toScreen(wx, wy, out) {
        out = out || { x: 0, y: 0 };
        out.x = (wx - c.x) * c.z + vw / 2; out.y = (wy - c.y) * c.z + vh / 2;
        return out;
      },
      // view(out?, pad=0) -> {x0,x1,y0,y1}: retângulo de mundo visível (pad em unidades de mundo)
      view(out, pad) {
        out = out || { x0: 0, x1: 0, y0: 0, y1: 0 };
        const hw = vw / 2 / c.z + (pad || 0), hh = vh / 2 / c.z + (pad || 0);
        out.x0 = c.x - hw; out.x1 = c.x + hw; out.y0 = c.y - hh; out.y1 = c.y + hh;
        return out;
      },
      // visible(x,y,r=0) -> bool: o círculo de mundo aparece na tela? (pra não desenhar o que está fora)
      visible(x, y, r) {
        r = r || 0;
        const hw = vw / 2 / c.z + r, hh = vh / 2 / c.z + r;
        return x > c.x - hw && x < c.x + hw && y > c.y - hh && y < c.y + hh;
      },
      // update(dt): zoom suave, alvo automático, limites, tremor e molas; chamar 1x por frame
      update(dt) {
        c.time += dt;
        // zoom em escala log: de 0.2 pra 2 leva o mesmo "tempo visual" que de 2 pra 20, sem solavanco
        if (c.z !== c.tz) {
          const r = c.tz / c.z;
          if (r > 0.9995 && r < 1.0005) c.z = c.tz;
          else c.z *= Math.pow(r, 1 - Math.exp(-c.zk * dt));
        }
        if (anchor.on) {
          c.x = anchor.wx - (anchor.sx - vw / 2) / c.z; c.y = anchor.wy - (anchor.sy - vh / 2) / c.z;
          if (c.z === c.tz) anchor.on = false;
        } else if (c.auto) chase(dt, c.k);
        clampBounds();
        // tremor: ruído suave amostrado no tempo (coerente entre frames, mesma força em qualquer zoom)
        if (c.trauma > 0 || c.shake > 0) {
          const t2 = c.trauma * c.trauma, amt = t2 * c.maxShake + c.shake * 0.7, ft = c.time * c.shakeFreq;
          c.sx = (Noise.n1(ft, 11) * 2 - 1) * amt;
          c.sy = (Noise.n1(ft, 29) * 2 - 1) * amt;
          c.roll = (Noise.n1(ft, 47) * 2 - 1) * c.maxRoll * t2;
          c.trauma = Math.max(0, c.trauma - c.traumaDecay * dt);
          c.shake *= Math.pow(0.02, dt); if (c.shake < 0.05) c.shake = 0;
        } else { c.sx = c.sy = c.roll = 0; }
        // molas: kick (deslocamento) e punch (zoom)
        if (c.ox || c.oy || vox || voy) {
          vox += (-c.ox * 190 - vox * 17) * dt; voy += (-c.oy * 190 - voy * 17) * dt;
          c.ox += vox * dt; c.oy += voy * dt;
          if (Math.abs(c.ox) + Math.abs(c.oy) < 0.02 && Math.abs(vox) + Math.abs(voy) < 0.5) c.ox = c.oy = vox = voy = 0;
        }
        if (c.zp || vzp) {
          vzp += (-c.zp * 260 - vzp * 15) * dt; c.zp += vzp * dt;
          if (Math.abs(c.zp) < 0.0004 && Math.abs(vzp) < 0.004) c.zp = vzp = 0;
        }
        return c;
      },
      // kick(dx,dy): empurrão em px de tela que volta com mola (recuo de tiro, pancada com direção)
      kick(dx, dy) { c.ox += dx; c.oy += dy; return c; },
      // punch(k=.06): soco de zoom (aproxima k e volta com mola); negativo afasta
      punch(k) { vzp += (k === undefined ? 0.06 : k) * 16; return c; },
      // addTrauma(v): soma trauma (0..1); .2 batidinha, .5 pancada, 1 terremoto
      addTrauma(v) { c.trauma = Math.min(1, c.trauma + v); return c; },
      // parallax(g, fator, fn(g, view), fz=fator): desenha fn com a câmera aplicada em fração (0 = colado na tela, 1 = mundo)
      //   view = retângulo visível nas coordenadas da camada; fz controla quanto do zoom a camada sente
      parallax(g, f, fn, fz) {
        const zf = Math.pow(c.z * (1 + c.zp), fz === undefined ? f : fz);
        g.save();
        g.translate(vw / 2 + (c.sx + c.ox) * f, vh / 2 + (c.sy + c.oy) * f);
        if (c.roll) g.rotate(c.roll * f);
        g.scale(zf, zf);
        g.translate(-c.x * f, -c.y * f);
        const hw = vw / 2 / zf, hh = vh / 2 / zf;
        pv.x0 = c.x * f - hw; pv.x1 = c.x * f + hw; pv.y0 = c.y * f - hh; pv.y1 = c.y * f + hh; pv.z = zf;
        fn(g, pv);
        g.restore();
        return c;
      },
      // resize(vw,vh): troca o tamanho lógico da tela
      resize(w, h) { vw = c.vw = w; vh = c.vh = h; return c; },
    };

    // anda até (tx,ty); quando falta menos de 1/50 de px de tela, encosta (sem rastejar pra sempre)
    function chase(dt, k) {
      const a = 1 - Math.exp(-k * dt), eps = 0.02 / c.z;
      const dx = c.tx - c.x, dy = c.ty - c.y;
      c.x = Math.abs(dx) < eps ? c.tx : c.x + dx * a;
      c.y = Math.abs(dy) < eps ? c.ty : c.y + dy * a;
      clampBounds();
    }
    // segura a vista dentro de bounds; se a vista for maior que o limite, centraliza
    function clampBounds() {
      const b = c.bounds;
      if (!b) return;
      const hw = vw / 2 / c.z, hh = vh / 2 / c.z;
      const x0 = b.x0 === undefined || b.x0 === null ? -Infinity : b.x0, x1 = b.x1 === undefined || b.x1 === null ? Infinity : b.x1;
      const y0 = b.y0 === undefined || b.y0 === null ? -Infinity : b.y0, y1 = b.y1 === undefined || b.y1 === null ? Infinity : b.y1;
      if (x1 - x0 <= hw * 2) { if (isFinite(x0 + x1)) c.x = (x0 + x1) / 2; else if (isFinite(x0)) c.x = Math.max(c.x, x0 + hw); else if (isFinite(x1)) c.x = Math.min(c.x, x1 - hw); }
      else c.x = U.clamp(c.x, x0 + hw, x1 - hw);
      if (y1 - y0 <= hh * 2) { if (isFinite(y0 + y1)) c.y = (y0 + y1) / 2; else if (isFinite(y0)) c.y = Math.max(c.y, y0 + hh); else if (isFinite(y1)) c.y = Math.min(c.y, y1 - hh); }
      else c.y = U.clamp(c.y, y0 + hh, y1 - hh);
    }
    return c;
  }
  E.Camera = Camera;

  /* ======================================================================
     2. Particles
     Dados em um Float32Array intercalado (STRIDE floats por partícula) + arrays paralelos pequenos.
     Remoção por troca com a última (sem splice). Desenho: counting sort por (cor, nível de alfa, contorno)
     e um único fill por lote.
     ====================================================================== */
  const X = 0, Y = 1, VX = 2, VY = 3, GR = 4, LIFE = 5, DECAY = 6, R = 7, VR = 8, PW = 9, PH = 10, DRAG = 11, GROW = 12,
    FADE = 13, BOUNCE = 14, SWAY = 15, PHASE = 16, SC = 17, FLIP = 18, AGE = 19, STRIDE = 20;
  const SHAPES = ['grain', 'star', 'puff', 'rect', 'spark', 'petal', 'leaf', 'ring', 'smoke', 'drop', 'dot', 'coin', 'text'];
  const SH = {}; SHAPES.forEach((s, i) => { SH[s] = i; });
  const S_GRAIN = 0, S_STAR = 1, S_PUFF = 2, S_RECT = 3, S_SPARK = 4, S_PETAL = 5, S_LEAF = 6, S_RING = 7, S_SMOKE = 8, S_DROP = 9,
    S_DOT = 10, S_COIN = 11, S_TEXT = 12;
  //                 grain star puff rect spark petal leaf ring smoke drop dot coin text
  const DEF_G =     [900,  900, -14, 900, 900,  60,   90,  0,   -34,  900, 900, 900, 0];
  const DEF_HK =    [0.47, 1,   1,   1,   0.34, 0.6,  0.48, 0,  1,    1,   1,   1,   1];   // h padrão = w * isto (ring: 2 fixo)
  const BATCH =     [1,    1,   0,   1,   1,    1,    1,   0,   0,    1,   1,   0,   0];
  const F_LAND = 1, F_REST = 2, F_RESTING = 4, F_OL = 8;
  const ALV = 8;                                   // níveis de alfa por lote
  const SKIP = 0xFFFFFFFF;

  // variáveis do "carimbo" de formas (transformação manual, sem save/restore por partícula)
  let _x = 0, _y = 0, _c = 1, _s = 0, _fy = 1;
  const mx = (px, py) => _x + px * _c - py * _fy * _s;
  const my = (px, py) => _y + px * _s + py * _fy * _c;

  const COIN = { shape: 'coin', c: PAL.gold, speed: [140, 330], spread: 0.55, w: [3.2, 4.2], g: 760, life: [1.6, 2.4], vr: [7, 14],
    land: 'rest', bounce: 0.45, fade: 0.3 };
  const SPARK = { shape: 'spark', c: [PAL.goldL, PAL.yel, PAL.ora, CREAM], speed: [120, 420], spread: Math.PI, w: [3, 6], g: 520, life: [0.25, 0.6],
    drag: 1.6, land: true, bounce: 0.4, fade: 0.25, jitter: 1, r: 0 };
  const SPLASH = { shape: 'drop', c: PAL.waterL, speed: [90, 260], spread: 0.75, w: [1.2, 2.2], g: 760, life: [0.5, 0.9], land: true, fade: 0.2,
    jitter: 2, r: 0 };

  // E.Particles(max=1200) -> ps
  function Particles(max) {
    max = max || 1200;
    const D = new Float32Array(max * STRIDE);
    const shape = new Uint8Array(max), col = new Uint16Array(max), flags = new Uint8Array(max);
    const ext = new Array(max).fill(null);         // {onLand, txt} só pra quem precisa
    const key = new Uint32Array(max), order = new Uint16Array(max > 65535 ? 0 : max), order32 = max > 65535 ? new Uint32Array(max) : null;
    const ord = order32 || order;
    let cnt = new Int32Array(1024);
    let colors = [], colorId = new Map(), shades = [], lights = [];
    const view = { x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0, c: '', shape: '', txt: null, bounced: false }; // visão passada pro onLand
    const tmp = {};                                // molde reaproveitado pelos helpers
    let n = 0;

    function colorOf(c) {
      if (typeof c !== 'string') c = U.css(c);
      let id = colorId.get(c);
      if (id === undefined) {
        if (colors.length >= 4000 && n === 0) { colors = []; shades = []; lights = []; colorId = new Map(); }
        id = colors.length; colors.push(c); shades.push(null); lights.push(null); colorId.set(c, id);
      }
      return id;
    }
    function kill(i) {
      const l = --n;
      if (i !== l) {
        D.copyWithin(i * STRIDE, l * STRIDE, l * STRIDE + STRIDE);
        shape[i] = shape[l]; col[i] = col[l]; flags[i] = flags[l]; ext[i] = ext[l];
      }
      ext[l] = null;
    }
    // copia opts pro molde (uma vez por chamada de helper)
    function mold(o) {
      for (const k in tmp) tmp[k] = undefined;
      if (o) for (const k in o) tmp[k] = o[k];
      return tmp;
    }
    // sorteia os campos que aceitam [min,max] ou lista de cores e adiciona
    function addFrom(o, x, y, vx, vy) {
      const c = o && o.c, isList = c && typeof c !== 'string' && typeof c[0] === 'string';
      tmp.x = x; tmp.y = y; tmp.vx = vx; tmp.vy = vy;
      tmp.c = isList ? c[(Math.random() * c.length) | 0] : c;
      if (o) {
        tmp.w = val(o.w, undefined); tmp.h = val(o.h, undefined); tmp.life = val(o.life, undefined);
        tmp.r = o.r === undefined ? Math.random() * TAU : val(o.r, 0);
        tmp.vr = o.vr === undefined ? undefined : typeof o.vr === 'number' ? (Math.random() * 2 - 1) * o.vr : val(o.vr, 0);
        tmp.decay = val(o.decay, undefined); tmp.grow = val(o.grow, undefined);
      } else tmp.r = Math.random() * TAU;
      ps.add(tmp);
    }

    const ps = {
      max,
      ol: 1.1,          // espessura do contorno (unidades de mundo) das partículas com ol:true
      time: 0,
      // add(p) -> bool: {x,y,vx,vy,g,life,decay,r,vr,w,h,c,shape,land,bounce,drag,grow,fade,sway,flip,ol,txt,onLand(p)}
      //   land: true (some ao tocar o chão) | 'rest' (fica deitada no chão até a vida acabar); bounce 0..1 quica antes
      //   fade: quanto de vida (no fim) leva pra sumir (0 = sem transparência); grow: escala por segundo
      //   sway: balanço lateral (px/s) ; flip: giro "de papel" (rad/s) pra rect/petal/leaf ; ol: contorno marrom
      add(p) {
        if (n >= max) return false;
        const i = n++, o = i * STRIDE;
        const sh = p.shape ? SH[p.shape] || 0 : 0;
        const w = p.w === undefined ? 3 : p.w;
        D[o + X] = p.x || 0; D[o + Y] = p.y || 0; D[o + VX] = p.vx || 0; D[o + VY] = p.vy || 0;
        D[o + GR] = p.g === undefined ? DEF_G[sh] : p.g;
        D[o + LIFE] = p.life === undefined ? 1 : p.life; D[o + DECAY] = p.decay === undefined ? 1 : p.decay;
        D[o + R] = p.r || 0; D[o + VR] = p.vr || 0;
        D[o + PW] = w; D[o + PH] = p.h === undefined ? (sh === S_RING ? 2 : sh === S_GRAIN && w === 3 ? 1.4 : w * DEF_HK[sh]) : p.h;
        D[o + DRAG] = p.drag || 0; D[o + GROW] = p.grow || 0;
        D[o + FADE] = p.fade === undefined ? (sh === S_PUFF || sh === S_SMOKE ? 0 : sh === S_RING ? 0.3 : 0.625) : p.fade;
        D[o + BOUNCE] = p.bounce || 0; D[o + SWAY] = p.sway || 0; D[o + PHASE] = Math.random() * TAU;
        D[o + SC] = 1; D[o + FLIP] = p.flip || 0; D[o + AGE] = 0;
        shape[i] = sh; col[i] = colorOf(p.c || '#fffdf6');
        flags[i] = (p.land ? F_LAND : 0) | (p.land === 'rest' ? F_REST : 0) | (p.ol ? F_OL : 0);
        ext[i] = p.onLand || p.txt !== undefined ? { onLand: p.onLand || null, txt: p.txt === undefined ? null : String(p.txt) } : null;
        return true;
      },
      // update(dt, floorFn?): física; floorFn(x) -> y do chão (só pra quem tem land)
      update(dt, floorFn) {
        ps.time += dt;
        for (let i = n - 1; i >= 0; i--) {
          const o = i * STRIDE, f = flags[i];
          D[o + AGE] += dt;
          const life = (D[o + LIFE] -= dt * D[o + DECAY]);
          if (life <= 0) { kill(i); continue; }
          if (f & F_RESTING) continue;
          let vy = D[o + VY] + D[o + GR] * dt, vx = D[o + VX];
          const dr = D[o + DRAG];
          if (dr) { const k = dr * dt < 1 ? 1 - dr * dt : 0; vx *= k; vy *= k; }
          const sw = D[o + SWAY];
          const x = (D[o + X] += (sw ? vx + Math.sin(D[o + PHASE] + D[o + AGE] * 3.1) * sw : vx) * dt);
          let y = (D[o + Y] += vy * dt);
          D[o + R] += D[o + VR] * dt;
          const gw = D[o + GROW];
          if (gw && (D[o + SC] += gw * dt) <= 0) { kill(i); continue; }
          if ((f & F_LAND) && floorFn && vy > 0) {
            const fy = floorFn(x);
            if (y >= fy) {
              const b = D[o + BOUNCE], e = ext[i];
              if (b > 0 && vy > 70) {                 // quica: perde energia, freia e gira menos
                y = D[o + Y] = fy; vy = -vy * b; vx *= 0.72; D[o + VR] *= -0.55;
              } else {
                if (e && e.onLand) {
                  view.x = x; view.y = fy; view.vx = vx; view.vy = vy; view.w = D[o + PW]; view.h = D[o + PH];
                  view.c = colors[col[i]]; view.shape = SHAPES[shape[i]]; view.txt = e.txt;
                  e.onLand(view);
                }
                if (f & F_REST) {                     // deita no chão e espera a vida acabar
                  flags[i] = f | F_RESTING; D[o + Y] = fy; D[o + VX] = D[o + VY] = D[o + VR] = 0;
                  const sh = shape[i];
                  if (sh !== S_GRAIN && sh !== S_RECT) D[o + R] = 0;
                  if (D[o + FLIP]) { D[o + FLIP] = 0; D[o + PHASE] = 0; D[o + PH] *= 0.55; }   // papel/pétala: deita de lado
                  continue;
                }
                kill(i); continue;
              }
            }
          }
          D[o + VX] = vx; D[o + VY] = vy;
        }
      },
      // draw(g, view?): desenha tudo (coordenadas de mundo); view {x0,x1,y0,y1} opcional pula o que está fora
      draw(g, vw) {
        if (!n) return;
        const cull = !!vw, x0 = cull ? vw.x0 - 24 : 0, x1 = cull ? vw.x1 + 24 : 0, y0 = cull ? vw.y0 - 24 : 0, y1 = cull ? vw.y1 + 24 : 0;
        const nk = colors.length * ALV * 2;
        if (cnt.length < nk + 2) cnt = new Int32Array(nk * 2 + 2);
        cnt.fill(0, 0, nk + 2);
        let under = 0, over = 0, m = 0;
        // 1) chave de lote por partícula
        for (let i = 0; i < n; i++) {
          const o = i * STRIDE, sh = shape[i];
          if (cull) { const x = D[o + X], y = D[o + Y]; if (x < x0 || x > x1 || y < y0 || y > y1) { key[i] = SKIP; continue; } }
          if (!BATCH[sh]) { key[i] = SKIP; if (sh === S_PUFF || sh === S_SMOKE) under++; else over++; continue; }
          const fd = D[o + FADE], a = fd > 0 ? D[o + LIFE] / fd : 1;
          const lv = a >= 1 ? ALV - 1 : (a * ALV) | 0;
          const k = (col[i] * ALV + lv) * 2 + ((flags[i] & F_OL) ? 1 : 0);
          key[i] = k; cnt[k + 1]++; m++;
        }
        const pa = g.globalAlpha;
        // 2) fumaça e poeira por baixo
        if (under) drawUnder(g, pa);
        // 3) lotes: um caminho e um fill por (cor, alfa, contorno)
        if (m) {
          for (let k = 0; k < nk; k++) cnt[k + 1] += cnt[k];
          for (let i = 0; i < n; i++) { const k = key[i]; if (k !== SKIP) ord[cnt[k]++] = i; }
          g.lineJoin = 'round'; g.lineWidth = ps.ol * 2; g.strokeStyle = LINE;
          let cur = SKIP;
          for (let j = 0; j < m; j++) {
            const i = ord[j], k = key[i];
            if (k !== cur) {
              if (cur !== SKIP) { if (cur & 1) g.stroke(); g.fill(); }
              cur = k;
              g.fillStyle = colors[(k >> 1) / ALV | 0];
              g.globalAlpha = pa * (((k >> 1) % ALV) + 1) / ALV;
              g.beginPath();
            }
            stamp(g, i);
          }
          if (cur !== SKIP) { if (cur & 1) g.stroke(); g.fill(); }
        }
        // 4) anéis, moedas e textos por cima
        if (over) drawOver(g, pa);
        g.globalAlpha = pa;
      },
      // clear(): remove tudo
      clear() { for (let i = 0; i < n; i++) ext[i] = null; n = 0; },
      // each(fn(x,y,i)): percorre as posições (debug, colisão simples)
      each(fn) { for (let i = 0; i < n; i++) fn(D[i * STRIDE + X], D[i * STRIDE + Y], i); },

      /* ---------- helpers de emissão ---------- */
      // burst(x,y,n,{c,speed=[80,340],shape='star',up=120,...campos do add}): explosão pra todos os lados
      //   c pode ser uma lista de cores; w, h, life, decay, grow aceitam [min,max]; vr = giro máximo
      burst(x, y, count, o) {
        const m = mold(o), sp = o && o.speed, up = o && o.up !== undefined ? o.up : 120;
        if (m.shape === undefined) m.shape = 'star';
        if (m.g === undefined && m.shape === 'star') m.g = 500;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * TAU, s = val(sp, 80 + Math.random() * 260);
          addFrom(o, x, y, Math.cos(a) * s, Math.sin(a) * s - up);
        }
        return ps;
      },
      // spray(x,y,n,{dir=-PI/2,spread=.6,speed=[160,420],jitter=3,...campos do add}): jato num cone
      spray(x, y, count, o) {
        const m = mold(o), sp = o && o.speed, dir = o && o.dir !== undefined ? o.dir : -HALF_PI,
          spread = o && o.spread !== undefined ? o.spread : 0.6, jit = o && o.jitter !== undefined ? o.jitter : 3;
        if (m.shape === undefined) m.shape = 'grain';
        for (let i = 0; i < count; i++) {
          // dois sorteios somados: mais partículas no meio do cone do que nas bordas
          const a = dir + (Math.random() + Math.random() - 1) * spread, s = val(sp, 160 + Math.random() * 260);
          addFrom(o, x + (Math.random() * 2 - 1) * jit, y + (Math.random() * 2 - 1) * jit, Math.cos(a) * s, Math.sin(a) * s);
        }
        return ps;
      },
      // puff(x,y,n,size=8,{c,speed,up,life}): nuvenzinha de poeira de desenho animado (cresce e encolhe)
      puff(x, y, count, size, o) {
        size = size || 8;
        const c = (o && o.c) || PAL.sand, sp = (o && o.speed) || size * 5, up = o && o.up !== undefined ? o.up : size * 2;
        mold(null); tmp.shape = 'puff'; tmp.c = c; tmp.drag = 3.2;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * TAU, s = sp * (0.35 + Math.random() * 0.65);
          tmp.x = x + Math.cos(a) * size * 0.4; tmp.y = y + Math.sin(a) * size * 0.2;
          tmp.vx = Math.cos(a) * s * 1.5; tmp.vy = Math.sin(a) * s * 0.5 - up;
          tmp.w = size * (0.45 + Math.random() * 0.55);
          tmp.life = val(o && o.life, 0.45 + Math.random() * 0.35);
          ps.add(tmp);
        }
        return ps;
      },
      // coins(x,y,n,{speed,c,...}): moedas pulando (quicam e deitam no chão se o update receber floorFn)
      coins(x, y, count, o) { return ps.spray(x, y, count, preset(COIN, o)); },
      // sparks(x,y,n,{dir,spread=PI,speed,c,...}): faíscas (riscos que seguem a velocidade)
      sparks(x, y, count, o) { return ps.spray(x, y, count, preset(SPARK, o)); },
      // splash(x,y,n,{c,speed}): respingo de água pra cima + anel
      splash(x, y, count, o) {
        const c = (o && o.c) || PAL.waterL;
        mold(null); tmp.shape = 'ring'; tmp.x = x; tmp.y = y; tmp.c = c; tmp.w = 2; tmp.grow = 5; tmp.life = 0.4; tmp.h = 1.6;
        ps.add(tmp);
        return ps.spray(x, y, count, preset(SPLASH, o));
      },
      // sparkle(x,y,n,{c,r=12}): brilhos que piscam no lugar (ouro, item raro)
      sparkle(x, y, count, o) {
        const c = (o && o.c) || PAL.goldL, rad = (o && o.r) || 12;
        mold(null); tmp.shape = 'star'; tmp.g = 0; tmp.fade = 0.4;
        for (let i = 0; i < count; i++) {
          tmp.c = typeof c === 'string' ? c : c[(Math.random() * c.length) | 0];
          tmp.x = x + (Math.random() * 2 - 1) * rad; tmp.y = y + (Math.random() * 2 - 1) * rad;
          tmp.vx = 0; tmp.vy = -8 - Math.random() * 14; tmp.w = 2 + Math.random() * 3; tmp.r = 0; tmp.vr = 0;
          tmp.life = 0.35 + Math.random() * 0.45; tmp.grow = -1.4;
          ps.add(tmp);
        }
        return ps;
      },
    };
    Object.defineProperty(ps, 'count', { get: () => n });
    // junta um preset com as opções do usuário num objeto reaproveitado
    const pr = {};
    function preset(base, o) {
      for (const k in pr) pr[k] = undefined;
      for (const k in base) pr[k] = base[k];
      if (o) for (const k in o) pr[k] = o[k];
      return pr;
    }

    /* ---------- carimbo de uma forma de lote no caminho atual ---------- */
    function stamp(g, i) {
      const o = i * STRIDE, sc = D[o + SC], w = D[o + PW] * sc, h = D[o + PH] * sc, r = D[o + R];
      const x = D[o + X], y = D[o + Y];
      switch (shape[i]) {
        case S_GRAIN:
          g.moveTo(x + Math.cos(r) * w, y + Math.sin(r) * w);
          g.ellipse(x, y, w, h, r, 0, TAU);
          break;
        case S_DOT:
          g.moveTo(x + w, y); g.arc(x, y, w, 0, TAU);
          break;
        case S_RECT: {
          const fl = D[o + FLIP];
          _x = x; _y = y; _c = Math.cos(r); _s = Math.sin(r); _fy = fl ? Math.cos(D[o + PHASE] + D[o + AGE] * fl) : 1;
          const a = w / 2, b = h / 2;
          g.moveTo(mx(-a, -b), my(-a, -b)); g.lineTo(mx(a, -b), my(a, -b)); g.lineTo(mx(a, b), my(a, b)); g.lineTo(mx(-a, b), my(-a, b));
          g.closePath();
          break;
        }
        case S_STAR: {                                // estrela de 4 pontas com lados côncavos (brilho)
          _x = x; _y = y; _c = Math.cos(r); _s = Math.sin(r); _fy = 1;
          const q = w * 0.3;
          g.moveTo(mx(w, 0), my(w, 0)); g.lineTo(mx(q, q), my(q, q)); g.lineTo(mx(0, w), my(0, w)); g.lineTo(mx(-q, q), my(-q, q));
          g.lineTo(mx(-w, 0), my(-w, 0)); g.lineTo(mx(-q, -q), my(-q, -q)); g.lineTo(mx(0, -w), my(0, -w)); g.lineTo(mx(q, -q), my(q, -q));
          g.closePath();
          break;
        }
        case S_SPARK: {                               // risco afilado na direção da velocidade
          const vx = D[o + VX], vy = D[o + VY], sp = Math.sqrt(vx * vx + vy * vy);
          if (sp > 1) { _c = vx / sp; _s = vy / sp; } else { _c = Math.cos(r); _s = Math.sin(r); }
          _x = x; _y = y; _fy = 1;
          const len = w * (1 + sp * 0.012);
          g.moveTo(mx(h * 0.8, 0), my(h * 0.8, 0)); g.lineTo(mx(0, -h), my(0, -h)); g.lineTo(mx(-len, 0), my(-len, 0)); g.lineTo(mx(0, h), my(0, h));
          g.closePath();
          break;
        }
        case S_PETAL: {                               // pétala de sakura: gota com entalhe na ponta
          const fl = D[o + FLIP];
          _x = x; _y = y; _c = Math.cos(r); _s = Math.sin(r); _fy = fl ? Math.cos(D[o + PHASE] + D[o + AGE] * fl) : 1;
          g.moveTo(mx(-w, 0), my(-w, 0));
          g.quadraticCurveTo(mx(-w * 0.1, -h * 1.7), my(-w * 0.1, -h * 1.7), mx(w, -h * 0.42), my(w, -h * 0.42));
          g.lineTo(mx(w * 0.62, 0), my(w * 0.62, 0)); g.lineTo(mx(w, h * 0.42), my(w, h * 0.42));
          g.quadraticCurveTo(mx(-w * 0.1, h * 1.7), my(-w * 0.1, h * 1.7), mx(-w, 0), my(-w, 0));
          break;
        }
        case S_LEAF: {                                // folha pontuda nas duas pontas
          const fl = D[o + FLIP];
          _x = x; _y = y; _c = Math.cos(r); _s = Math.sin(r); _fy = fl ? Math.cos(D[o + PHASE] + D[o + AGE] * fl) : 1;
          g.moveTo(mx(-w, 0), my(-w, 0));
          g.quadraticCurveTo(mx(-w * 0.15, -h * 2), my(-w * 0.15, -h * 2), mx(w, 0), my(w, 0));
          g.quadraticCurveTo(mx(-w * 0.15, h * 2), my(-w * 0.15, h * 2), mx(-w, 0), my(-w, 0));
          break;
        }
        case S_DROP: {                                // gota: cabeça redonda na frente, rabo pra trás
          const vx = D[o + VX], vy = D[o + VY], sp = Math.sqrt(vx * vx + vy * vy);
          const a = sp > 1 ? Math.atan2(vy, vx) : HALF_PI, tail = w * (1.6 + Math.min(2.4, sp * 0.008));
          g.moveTo(x - Math.cos(a) * tail, y - Math.sin(a) * tail);
          g.arc(x, y, w, a - HALF_PI, a + HALF_PI);
          g.closePath();
          break;
        }
      }
    }

    /* ---------- formas especiais ---------- */
    // poeira (puff) e fumaça (smoke): duas bolinhas chapadas (sombra + base), sem gradiente
    function drawUnder(g, pa) {
      let last = -1;
      for (let pass = 0; pass < 2; pass++) {
        last = -1;
        for (let i = 0; i < n; i++) {
          const sh = shape[i];
          if (sh !== S_PUFF && sh !== S_SMOKE) continue;
          const o = i * STRIDE, life = D[o + LIFE], age = D[o + AGE], x = D[o + X], y = D[o + Y];
          let rad = D[o + PW] * D[o + SC], a = 1;
          if (sh === S_PUFF) {
            // estoura rápido, segura, e murcha no fim (some encolhendo, não ficando transparente)
            const tin = age < 0.12 ? age / 0.12 : 1;
            rad *= (0.55 + 0.45 * (1 - (1 - tin) * (1 - tin)) + age * 0.25) * (life < 0.32 ? life / 0.32 : 1);
            a = 0.92;
          } else {
            // fumaça: bolota quase opaca que incha (grow) e se desfaz encolhendo
            rad *= (age < 0.15 ? 0.4 + 4 * age : 1) * (life < 0.45 ? 0.25 + life / 0.6 : 1);
            a = 0.82 * (life < 0.45 ? 0.35 + life / 0.69 : 1);
          }
          const fd = D[o + FADE]; if (fd > 0 && life < fd) a *= life / fd;
          if (rad < 0.3 || a <= 0.01) continue;
          const ci = col[i];
          if (ci !== last) {
            last = ci;
            if (pass === 0) g.fillStyle = shades[ci] || (shades[ci] = U.shade(colors[ci], -0.22));
            else g.fillStyle = colors[ci];
          }
          g.globalAlpha = pa * a;
          g.beginPath();
          if (pass === 0) g.arc(x, y, rad, 0, TAU);
          else g.arc(x - rad * 0.14, y - rad * 0.16, rad * 0.8, 0, TAU);
          g.fill();
        }
      }
    }
    // anéis, moedas e textos
    function drawOver(g, pa) {
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const sh = shape[i];
        if (sh !== S_RING && sh !== S_COIN && sh !== S_TEXT) continue;
        const o = i * STRIDE, life = D[o + LIFE], x = D[o + X], y = D[o + Y], sc = D[o + SC], fd = D[o + FADE];
        const a = fd > 0 ? Math.min(1, life / fd) : 1, ci = col[i];
        g.globalAlpha = pa * a;
        if (sh === S_RING) {
          const rad = D[o + PW] * sc, lw = Math.max(0.4, D[o + PH] * Math.min(1, life * 2.2));
          if (flags[i] & F_OL) { g.strokeStyle = LINE; g.lineWidth = lw + ps.ol * 2; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.stroke(); }
          g.strokeStyle = colors[ci]; g.lineWidth = lw;
          g.beginPath(); g.arc(x, y, rad, 0, TAU); g.stroke();
        } else if (sh === S_COIN) {
          const rad = D[o + PW] * sc, rest = flags[i] & F_RESTING;
          const face = rest ? 1 : Math.abs(Math.cos(D[o + R]));
          const rx = rest ? rad : Math.max(rad * 0.2, rad * face), ry = rest ? rad * 0.36 : rad, cy = rest ? y - ry : y;
          g.beginPath(); g.ellipse(x, cy, rx, ry, 0, 0, TAU);
          g.lineWidth = ps.ol * 2; g.strokeStyle = LINE; g.stroke();
          g.fillStyle = shades[ci] || (shades[ci] = U.shade(colors[ci], -0.3)); g.fill();
          // face um pouco deslocada: sobra uma lua de sombra embaixo/direita (volume com cor chapada)
          g.fillStyle = colors[ci];
          g.beginPath(); g.ellipse(x - rx * 0.1, cy - ry * 0.1, rx * 0.86, ry * 0.86, 0, 0, TAU); g.fill();
          if (face > 0.45) {
            g.fillStyle = lights[ci] || (lights[ci] = U.shade(colors[ci], 0.55));
            g.beginPath(); g.ellipse(x - rx * 0.34, cy - ry * 0.36, rx * 0.26, ry * 0.2, -0.6, 0, TAU); g.fill();
            if (!rest) {                              // furo quadrado de moeda antiga
              g.fillStyle = shades[ci];
              const q = rad * 0.24; g.fillRect(x - q * face, cy - q, q * 2 * face, q * 2);
            }
          }
        } else {
          const e = ext[i];
          if (!e || e.txt === null) continue;
          const size = D[o + PW], r = D[o + R];
          g.save(); g.translate(x, y); if (r) g.rotate(r); if (sc !== 1) g.scale(sc, sc);
          g.font = fontOf(size); g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = Math.max(2, size * 0.3); g.strokeStyle = LINE; g.strokeText(e.txt, 0, 0);
          g.fillStyle = colors[ci]; g.fillText(e.txt, 0, 0);
          g.restore();
        }
      }
    }
    return ps;
  }
  Particles.SHAPES = SHAPES;
  E.Particles = Particles;

  /* ======================================================================
     3. Floaters — textos que sobem ("+¥123", "OURO!")
     ====================================================================== */
  const TIERS = [   // tamanho/cor por ordem de grandeza: quanto maior o número, mais ele grita
    { v: 1e2, size: 14, c: CREAM, stroke: LINE },
    { v: 1e4, size: 17, c: PAL.goldL, stroke: LINE },
    { v: 1e6, size: 21, c: PAL.gold, stroke: LINE },
    { v: 1e9, size: 26, c: '#FFB24A', stroke: '#5A2A10' },
    { v: Infinity, size: 32, c: '#FF7A5A', stroke: '#4A1410' },
  ];
  // E.Floaters(max=160) -> fl
  function Floaters(max) {
    max = max || 160;
    const list = [];
    let n = 0;
    const sp = { x: 0, y: 0 }, st = { size: 16, c: CREAM, stroke: LINE, pop: 1, shake: 0 };
    const fl = {
      list,
      // add(x,y,txt,{c='#FFFAEE',size=16,life=1.1,vy=-46,vx=0,stroke=LINE,pop=1,sw,rot,shake=0,delay=0}): cria um texto que sobe
      //   pop: força do estouro de entrada (0 = sem) ; shake: tremidinha (px) pra valores absurdos ; stroke:null = sem contorno
      add(x, y, txt, o) {
        let f;
        if (n < list.length) f = list[n++];
        else if (n < max) { f = {}; list.push(f); n++; }
        else f = list[0];                               // cheio: recicla um dos que já estão na tela
        o = o || NO;
        f.x = x; f.y = y; f.txt = String(txt);
        f.c = o.c || CREAM; f.size = o.size || 16;
        f.life = f.life0 = o.life || 1.1; f.vy = o.vy === undefined ? -46 : o.vy; f.vx = o.vx || 0;
        f.stroke = o.stroke === undefined ? LINE : o.stroke; f.sw = o.sw || 0;
        f.pop = o.pop === undefined ? 1 : +o.pop; f.age = -(o.delay || 0);
        f.rot = o.rot === undefined ? (Math.random() * 2 - 1) * 0.07 : o.rot; f.shake = o.shake || 0;
        return f;
      },
      // style(valor, out?) -> {size,c,stroke,pop,shake}: estilo pelo tamanho do número (pequeno creme, grande dourado, absurdo vermelho)
      style(v, out) {
        out = out || st;
        v = Math.abs(v);
        let i = 0; while (v >= TIERS[i].v) i++;
        const T = TIERS[i];
        out.size = T.size; out.c = T.c; out.stroke = T.stroke; out.pop = 1 + i * 0.25; out.shake = i >= 4 ? 1.5 : 0;
        return out;
      },
      // money(x,y,valor,{prefix='+¥',...opts do add}): atalho "+¥1,2 mil" já com o estilo do valor
      money(x, y, v, o) {
        const s = fl.style(v, st);
        if (o) for (const k in o) if (k !== 'prefix') s[k] = o[k];
        const f = fl.add(x, y, ((o && o.prefix) !== undefined ? o.prefix : '+¥') + U.fmt(v), s);
        st.life = st.vy = st.vx = st.rot = st.sw = st.delay = undefined;
        return f;
      },
      // update(dt)
      update(dt) {
        for (let i = n - 1; i >= 0; i--) {
          const f = list[i];
          f.age += dt;
          if (f.age < 0) continue;
          f.life -= dt;
          if (f.life <= 0) { n--; list[i] = list[n]; list[n] = f; continue; }
          f.y += f.vy * dt; f.x += f.vx * dt;
          f.vy *= Math.max(0, 1 - 1.5 * dt);            // sobe rápido e vai parando
        }
      },
      // draw(g, cam?): com cam, desenha em coords de TELA (chamar fora do cam.apply; texto nítido e do mesmo tamanho em
      //   qualquer zoom); sem cam, desenha nas coordenadas atuais do contexto
      draw(g, cam) {
        if (!n) return;
        const pa = g.globalAlpha;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineCap = 'round'; g.miterLimit = 2;
        for (let i = 0; i < n; i++) {
          const f = list[i];
          if (f.age < 0) continue;
          let x = f.x, y = f.y;
          if (cam) {
            cam.toScreen(x, y, sp); x = sp.x + cam.sx * 0.5; y = sp.y + cam.sy * 0.5;
            if (x < -200 || x > cam.vw + 200 || y < -60 || y > cam.vh + 60) continue;
          }
          // estouro: nasce pequeno, passa do tamanho e assenta; no fim murcha um pouco e some
          let k = 1;
          if (f.pop > 0) {
            const t = f.age / 0.24;
            k = t < 1 ? 0.35 + 0.65 * U.ease.back(t) + Math.sin(t * Math.PI) * 0.22 * f.pop : 1;
          }
          const end = f.life / (f.life0 * 0.3);
          if (end < 1) k *= 0.82 + 0.18 * end;
          if (f.shake) { x += (Math.random() * 2 - 1) * f.shake; y += (Math.random() * 2 - 1) * f.shake; }
          const size = f.size, sw = f.sw || Math.max(3, size * 0.26);
          g.globalAlpha = pa * (end < 1 ? Math.max(0, end) : 1);
          g.save(); g.translate(x, y); if (f.rot) g.rotate(f.rot * Math.min(1, f.age * 6)); g.scale(k, k);
          g.font = fontOf(size);
          if (f.stroke) {
            g.strokeStyle = f.stroke; g.lineWidth = sw;
            g.strokeText(f.txt, 0, size * 0.1);        // sombra dura: o mesmo traço um pouco mais embaixo
            g.strokeText(f.txt, 0, 0);
          }
          g.fillStyle = f.c; g.fillText(f.txt, 0, 0);
          g.restore();
        }
        g.globalAlpha = pa;
      },
      // clear()
      clear() { n = 0; },
    };
    Object.defineProperty(fl, 'count', { get: () => n });
    return fl;
  }
  const NO = Object.freeze({});
  E.Floaters = Floaters;

  /* ======================================================================
     4. ScreenFX — efeitos por cima de tudo, em coordenadas de tela
     ====================================================================== */
  const CONFETTI = [PAL.red, PAL.yel, PAL.grass, PAL.water, PAL.sakura, CREAM, PAL.ora, PAL.goldL];
  // E.ScreenFX(stage | {w,h}) -> fx
  function ScreenFX(stage) {
    let W = (stage && stage.w) || 960, H = (stage && stage.h) || 540;
    const hash = E.hash || (v => { const s = Math.sin(v * 127.1) * 43758.5453; return s - Math.floor(s); });
    const flash = { a: 0, t: 0, dur: 0.25, col: CREAM };
    const fade = { a: 0, from: 0, to: 0, t: 1, dur: 0, col: DEEP, cb: null };
    const lb = { k: 0, to: 0, h: 60 };
    const vig = { k: 0, to: 0, cv: null };
    const sl = { k: 0, on: false, dir: null, col: CREAM, col2: null, n: 64, x: 0, y: 0, inner: 0.36, alpha: 0.9, t: 0 };
    const iris = { active: false, r: 0, from: 0, to: 0, t: 1, dur: 0.6, x: 0, y: 0, cb: null, max: 0 };
    const rings = [];
    for (let i = 0; i < 8; i++) rings.push({ on: false, x: 0, y: 0, t: 0, dur: 0.5, r: 160, col: CREAM, w: 14 });
    let conf = null;                                   // E.Particles do confete (criado no primeiro uso)
    let hit = 0, slow = 1, slowT = 0, last = 0;

    const fx = {
      realTime: true,   // true: anima pelo relógio real (continua durante hitstop / timeScale 0); false: usa o dt recebido
      // flash(cor='#FFFAEE', dur=.25, alfa=.85): clarão que some
      flash(col, dur, a) { flash.col = col || CREAM; flash.dur = dur || 0.25; flash.t = 0; flash.a = a === undefined ? 0.85 : a; return fx; },
      // fade(to, dur=.5, cb, cor): escurece (to=1) ou clareia (to=0) a tela; cb quando termina
      fade(to, dur, cb, col) {
        fade.from = fade.a; fade.to = U.clamp(+to, 0, 1); fade.t = 0; fade.dur = dur === undefined ? 0.5 : dur; fade.cb = cb || null;
        if (col) fade.col = col;
        if (fade.dur <= 0) { fade.a = fade.to; fade.t = 1; fade.cb = null; if (cb) cb(); }
        return fx;
      },
      // letterbox(on, h=60): barras de cinema deslizando
      letterbox(on, h) { lb.to = on ? 1 : 0; if (h) lb.h = h; return fx; },
      // vignette(k): vinheta marrom suave (0 desliga; .25 sutil; .6 dramática)
      vignette(k) { vig.to = Math.max(0, k || 0); return fx; },
      // speedlines(on, {dir, col, col2, n=64, x, y, inner=.36, alpha=.9}): linhas de anime; sem dir = radiais em volta de (x,y);
      //   com dir (rad) = riscos passando nessa direção
      speedlines(on, o) {
        sl.on = !!on;
        if (on) {
          o = o || NO;
          sl.dir = o.dir === undefined ? null : o.dir; sl.col = o.col || CREAM; sl.col2 = o.col2 || null; sl.n = o.n || 64;
          sl.x = o.x === undefined ? W / 2 : o.x; sl.y = o.y === undefined ? H / 2 : o.y;
          sl.inner = o.inner === undefined ? 0.36 : o.inner; sl.alpha = o.alpha === undefined ? 0.9 : o.alpha;
        }
        return fx;
      },
      // hitstop(seg=.08) -> timeScale: congela o jogo por um instante (use: loop.timeScale = fx.timeScale todo frame)
      hitstop(sec) { hit = Math.max(hit, sec === undefined ? 0.08 : sec); return fx.timeScale; },
      // slowmo(escala=.3, seg=.6): câmera lenta que volta suave pro normal
      slowmo(scale, sec) { slow = scale === undefined ? 0.3 : scale; slowT = sec === undefined ? 0.6 : sec; return fx; },
      // confetti(n=90, {x,y,colors,speed}): chuva de confete do topo; com x,y = canhão a partir do ponto
      confetti(count, o) {
        if (!conf) conf = Particles(700);
        count = count || 90; o = o || NO;
        const cols = o.colors || CONFETTI, cannon = o.x !== undefined;
        for (let i = 0; i < count; i++) {
          const a = cannon ? -HALF_PI + (Math.random() + Math.random() - 1) * 1.1 : 0, s = cannon ? (o.speed || 520) * (0.4 + Math.random() * 0.6) : 0;
          cp.x = cannon ? o.x : Math.random() * W; cp.y = cannon ? o.y : -10 - Math.random() * H * 0.45;
          cp.vx = cannon ? Math.cos(a) * s : (Math.random() * 2 - 1) * 60; cp.vy = cannon ? Math.sin(a) * s : 40 + Math.random() * 140;
          cp.c = cols[(Math.random() * cols.length) | 0];
          cp.w = 5 + Math.random() * 5; cp.h = 3 + Math.random() * 3;
          cp.r = Math.random() * TAU; cp.vr = (Math.random() * 2 - 1) * 5; cp.flip = 5 + Math.random() * 8; cp.sway = 30 + Math.random() * 50;
          cp.life = 2.6 + Math.random() * 1.8;
          conf.add(cp);
        }
        return fx;
      },
      // shock(x,y,{r=170,col,dur=.5,w=14}): anel de impacto abrindo (coords de tela)
      shock(x, y, o) {
        o = o || NO;
        let rg = rings[0];
        for (let i = 0; i < rings.length; i++) { if (!rings[i].on) { rg = rings[i]; break; } if (rings[i].t > rg.t) rg = rings[i]; }
        rg.on = true; rg.x = x; rg.y = y; rg.t = 0; rg.dur = o.dur || 0.5; rg.r = o.r || 170; rg.col = o.col || CREAM; rg.w = o.w || 14;
        return fx;
      },
      // iris(open, x=centro, y=centro, dur=.6, cb): transição em círculo; open=false fecha no ponto, open=true abre a partir dele
      iris(open, x, y, dur, cb) {
        iris.x = x === undefined ? W / 2 : x; iris.y = y === undefined ? H / 2 : y;
        iris.max = Math.sqrt(Math.max(iris.x, W - iris.x) ** 2 + Math.max(iris.y, H - iris.y) ** 2) + 8;
        iris.from = iris.active ? iris.r : open ? 0 : iris.max; iris.to = open ? iris.max : 0;
        iris.t = 0; iris.dur = dur || 0.6; iris.cb = cb || null; iris.active = true; iris.r = iris.from;
        return fx;
      },
      // impact(x,y,k=1): combo de pancada: clarão + anel + hitstop proporcionais a k
      impact(x, y, k) {
        k = k === undefined ? 1 : k;
        fx.flash(CREAM, 0.12 + 0.1 * k, Math.min(0.9, 0.35 + 0.3 * k));
        fx.shock(x, y, { r: 110 + 90 * k, w: 8 + 8 * k });
        return fx.hitstop(0.04 + 0.06 * k);
      },
      // update(dt): avança os efeitos (por padrão pelo relógio real; ver realTime)
      update(dt) {
        const t = now();
        let rd = fx.realTime && last ? (t - last) / 1000 : dt;
        last = t;
        if (!(rd >= 0) || rd > 0.1) rd = Math.min(Math.max(dt, 1 / 60), 0.1);
        if (hit > 0) hit = Math.max(0, hit - rd);
        if (slowT > 0) slowT -= rd; else if (slow !== 1) { slow = U.damp(slow, 1, 5, rd); if (slow > 0.995) slow = 1; }
        if (flash.a > 0) { flash.t += rd; if (flash.t >= flash.dur) flash.a = 0; }
        if (fade.t < 1) {
          fade.t = Math.min(1, fade.t + rd / Math.max(1e-4, fade.dur));
          fade.a = U.lerp(fade.from, fade.to, U.ease.inOut(fade.t));
          if (fade.t >= 1) { const cb = fade.cb; fade.cb = null; if (cb) cb(); }
        }
        lb.k = approach(lb.k, lb.to, rd / 0.5);
        vig.k = U.damp(vig.k, vig.to, 5, rd); if (Math.abs(vig.k - vig.to) < 0.003) vig.k = vig.to;
        sl.k = approach(sl.k, sl.on ? 1 : 0, rd / (sl.on ? 0.16 : 0.28)); sl.t += rd;
        if (iris.active && iris.t < 1) {
          iris.t = Math.min(1, iris.t + rd / iris.dur);
          // fechando: desacelera perto do fim (a bolinha "segura" no personagem); abrindo: arranca devagar
          const e = iris.to === 0 ? U.ease.out(iris.t) : U.ease.in(iris.t);
          iris.r = U.lerp(iris.from, iris.to, e);
          if (iris.t >= 1) { if (iris.to > 0) iris.active = false; const cb = iris.cb; iris.cb = null; if (cb) cb(); }
        }
        for (let i = 0; i < rings.length; i++) { const rg = rings[i]; if (rg.on && (rg.t += rd / rg.dur) >= 1) rg.on = false; }
        if (conf && conf.count) conf.update(rd);
        return fx;
      },
      // draw(g): desenha por cima de tudo, em coordenadas de tela (depois do mundo e do HUD de canvas)
      draw(g) {
        if (conf && conf.count) conf.draw(g);
        drawRings(g);
        if (sl.k > 0.001) drawSpeed(g);
        if (vig.k > 0.003) drawVignette(g);
        if (flash.a > 0) {
          const k = 1 - flash.t / flash.dur;
          g.globalAlpha = flash.a * k * k; g.fillStyle = flash.col; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
        }
        if (lb.k > 0.001) {
          const h = Math.round(lb.h * U.ease.out(lb.k));
          g.fillStyle = DEEP; g.fillRect(0, 0, W, h); g.fillRect(0, H - h, W, h);
          g.fillStyle = LINE; g.fillRect(0, h - 2, W, 2); g.fillRect(0, H - h, W, 2);
        }
        if (iris.active) drawIris(g);
        if (fade.a > 0.002) { g.globalAlpha = fade.a; g.fillStyle = fade.col; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
      },
      // clear(): desliga tudo na hora
      clear() {
        flash.a = 0; fade.a = fade.to = 0; fade.t = 1; fade.cb = null; lb.k = lb.to = 0; vig.k = vig.to = 0; sl.k = 0; sl.on = false;
        iris.active = false; iris.cb = null; hit = 0; slow = 1; slowT = 0;
        for (let i = 0; i < rings.length; i++) rings[i].on = false;
        if (conf) conf.clear();
        return fx;
      },
      // resize(w,h): se o tamanho lógico mudar
      resize(w, h) { W = w; H = h; vig.cv = null; return fx; },
    };
    // timeScale: 0 durante hitstop, <1 em câmera lenta, senão 1 ; busy: alguma transição de tela cheia em andamento
    Object.defineProperty(fx, 'timeScale', { get: () => (hit > 0 ? 0 : slow) });
    Object.defineProperty(fx, 'busy', { get: () => fade.t < 1 || (iris.active && iris.t < 1) });
    Object.defineProperty(fx, 'letterboxK', { get: () => U.ease.out(lb.k) });
    const cp = { shape: 'rect', g: 300, drag: 1.5, fade: 0.5 };

    function approach(a, b, step) { return a < b ? Math.min(b, a + step) : Math.max(b, a - step); }

    function drawRings(g) {
      for (let i = 0; i < rings.length; i++) {
        const rg = rings[i];
        if (!rg.on) continue;
        const e = U.ease.out(rg.t), rad = rg.r * (0.12 + 0.88 * e), lw = rg.w * Math.pow(1 - rg.t, 1.4) + 0.5;
        g.globalAlpha = Math.min(1, (1 - rg.t) * 2.2);
        g.beginPath(); g.arc(rg.x, rg.y, rad, 0, TAU);
        g.strokeStyle = LINE; g.lineWidth = lw + 4; g.stroke();
        g.strokeStyle = rg.col; g.lineWidth = lw; g.stroke();
        if (rg.t > 0.12) {                               // segundo anel, mais fino, correndo atrás
          const t2 = (rg.t - 0.12) / 0.88, r2 = rg.r * 0.72 * U.ease.out(t2);
          g.globalAlpha = (1 - t2) * 0.7; g.lineWidth = lw * 0.4 + 0.5;
          g.beginPath(); g.arc(rg.x, rg.y, r2, 0, TAU); g.stroke();
        }
      }
      g.globalAlpha = 1;
    }

    // linhas de velocidade: desenhadas "em 2" (14 poses por segundo) como em anime
    function drawSpeed(g) {
      const k = U.ease.out(sl.k), fr = Math.floor(sl.t * 14);
      g.globalAlpha = sl.alpha * Math.min(1, sl.k * 1.6);
      if (sl.dir === null) {
        const cx = sl.x, cy = sl.y, R = Math.sqrt(W * W + H * H) * 0.62 + Math.abs(cx - W / 2) + Math.abs(cy - H / 2);
        const rx = W * sl.inner, ry = H * sl.inner * 1.15;
        for (let pass = 0; pass < (sl.col2 ? 2 : 1); pass++) {
          g.fillStyle = pass ? sl.col2 : sl.col;
          g.beginPath();
          for (let i = pass; i < sl.n; i += sl.col2 ? 2 : 1) {
            const h1 = hash(i * 7.31 + fr * 13.7), h2 = hash(i * 3.17 + fr * 5.9 + 40), h3 = hash(i * 11.3 + fr * 2.3 + 90);
            const a = (i + h1 * 0.9) / sl.n * TAU, wd = (0.003 + h2 * h2 * 0.017) * (0.6 + 0.4 * k);
            const tip = (0.85 + h3 * 0.8) / k;         // entra de fora pra dentro quando liga
            const ca = Math.cos(a), sa = Math.sin(a);
            g.moveTo(cx + ca * rx * tip, cy + sa * ry * tip);
            g.lineTo(cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R);
            g.lineTo(cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R);
            g.closePath();
          }
          g.fill();
        }
      } else {
        const ca = Math.cos(sl.dir), sa = Math.sin(sl.dir), span = Math.sqrt(W * W + H * H), half = span / 2;
        const perp = (Math.abs(sa) * W + Math.abs(ca) * H) / 2;   // meia largura da tela atravessada pelos riscos
        for (let pass = 0; pass < (sl.col2 ? 2 : 1); pass++) {
          g.fillStyle = pass ? sl.col2 : sl.col;
          g.beginPath();
          for (let i = pass; i < sl.n; i += sl.col2 ? 2 : 1) {
            const h1 = hash(i * 7.31 + 3), h2 = hash(i * 3.17 + 40), h3 = hash(i * 11.3 + 90);
            // mais riscos nas bordas, o meio fica livre pro personagem
            const u = (h1 < 0.5 ? -1 : 1) * (0.1 + 0.9 * Math.sqrt(h1 < 0.5 ? h1 * 2 : (h1 - 0.5) * 2)) * perp;
            const len = (120 + h2 * 380) * (0.4 + 0.6 * k), th = (1.4 + h3 * h3 * 5) * k, sp = 1500 + h2 * 1700;
            const d = ((sl.t * sp + h3 * (span + 500)) % (span + 500)) - half - 250;
            const px = W / 2 + ca * d - sa * u, py = H / 2 + sa * d + ca * u;
            g.moveTo(px + ca * len * 0.5, py + sa * len * 0.5);
            g.lineTo(px - sa * th, py + ca * th);
            g.lineTo(px - ca * len * 0.5, py - sa * len * 0.5);
            g.lineTo(px + sa * th, py - ca * th);
            g.closePath();
          }
          g.fill();
        }
      }
      g.globalAlpha = 1;
    }

    // vinheta: gradiente radial marrom cacheado em 1/4 da resolução
    function drawVignette(g) {
      if (!vig.cv) {
        const cv = document.createElement('canvas'), s = 4;
        cv.width = Math.ceil(W / s); cv.height = Math.ceil(H / s);
        const c = cv.getContext('2d'), w = cv.width, h = cv.height;
        c.translate(w / 2, h / 2); c.scale(1, h / w);
        const gr = c.createRadialGradient(0, 0, w * 0.3, 0, 0, w * 0.74);
        gr.addColorStop(0, 'rgba(42,22,10,0)'); gr.addColorStop(0.55, 'rgba(42,22,10,.32)'); gr.addColorStop(1, 'rgba(34,16,8,.95)');
        c.fillStyle = gr; c.fillRect(-w, -w, w * 2, w * 2);
        vig.cv = cv;
      }
      const sm = g.imageSmoothingEnabled;
      g.imageSmoothingEnabled = true;
      g.globalAlpha = Math.min(1, vig.k);
      g.drawImage(vig.cv, 0, 0, W, H);
      g.globalAlpha = 1; g.imageSmoothingEnabled = sm;
    }

    function drawIris(g) {
      g.fillStyle = DEEP;
      if (iris.r < 0.6) { g.fillRect(0, 0, W, H); return; }
      g.beginPath(); g.rect(0, 0, W, H); g.arc(iris.x, iris.y, iris.r, 0, TAU, true); g.fill('evenodd');
      g.beginPath(); g.arc(iris.x, iris.y, iris.r, 0, TAU);
      g.strokeStyle = LINE; g.lineWidth = 7; g.stroke();
      g.strokeStyle = CREAM; g.lineWidth = 2.5; g.stroke();
    }
    return fx;
  }
  E.ScreenFX = ScreenFX;
})();
