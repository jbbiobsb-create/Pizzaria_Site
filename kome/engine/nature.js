/* ============================================================================
   Kome Engine v1.0 — nature.js
   Kit de cenário japonês, todo procedural e no estilo Kome:
     E.Nature   céu com hora do dia, sol, lua, estrelas, nuvens, Fuji, morros com névoa,
                chão, árvores (pine/sakura/maple/bamboo/bonsai/round), moita, capim, flores,
                pedras, torii, tōrō, ponte, cercas, arrozal, barraquinha, casa em 6 estágios,
                onsen, koinobori, fūrin, pétalas, vaga-lumes, pássaros, borboletas
     E.Pond     lago orgânico com borda de pedras, cáusticas, ondinhas e vitórias-régias
     E.Koi      carpas vistas de cima (corpo em cadeia de espinha) que fogem, comem e nunca saem do lago
   Convenções: pés/base em (x,y); y cresce pra baixo; `t` em segundos anima (vento, luz, água).
   Sprites estáticos são pixel art (Pix) cacheada; o que precisa dobrar/ondular é vetorial com o mesmo contorno.
   Ordem de um frame com hora do dia:  sky -> celestial -> fuji/hills -> mundo -> grade() -> fireflies
   Depende de: core.js, pix.js   (fx.js é opcional: sakuraPetals usa E.Particles)
   ============================================================================ */
(function () {
  'use strict';
  const E = (window.KomeEngine = window.KomeEngine || {});
  if (!E.U) throw new Error('KomeEngine: carregue core.js antes de nature.js');
  if (!E.Pix) throw new Error('KomeEngine: carregue pix.js antes de nature.js');
  const U = E.U, C = E.PAL, D = E.Draw, TAU = Math.PI * 2, PI = Math.PI;
  const LINE = E.LINE_CSS, NO = Object.freeze({});
  const sh = U.shade, hash = E.hash;
  const Nature = { tod: 0.5, windPower: 1 };

  /* ======================================================================
     1. Vento e utilitários de desenho
     ====================================================================== */
  // Nature.wind(t, x=0) -> ~-1..1.6: vento com rajadas que viajam pelo mundo (use pra balançar qualquer coisa)
  function wind(t, x) {
    x = x || 0;
    const gust = E.Noise.n1(t * 0.33 + x * 0.0021, 91);
    return (Math.sin(t * 1.25 + x * 0.011) * 0.5 + Math.sin(t * 2.3 + x * 0.023 + 1.7) * 0.22 + (gust - 0.42) * 1.3) * Nature.windPower;
  }

  // abre um bloco de desenho local: origem em (x,y), escala s, espelho opcional (fechar com g.restore())
  function at(g, x, y, s, flip) {
    g.save(); g.translate(x, y);
    if (s !== 1 || flip) g.scale(flip ? -s : s, s);
    g.imageSmoothingEnabled = s * D.zoom < 0.75;
  }
  // desenha um sprite com a base/centro em (x,y)
  function blit(g, cv, x, y) { g.drawImage(cv, x - cv.width / 2, y - cv.height); }
  function sprite(name, w, h, fn, ol) { return E.sprite('nat/' + name, w, h, fn, ol); }

  // opções reaproveitadas pras chamadas internas entre props (nada de objeto novo por frame); quem recebe lê tudo antes de chamar outro prop
  const SO = { t: 0, s: 1, seed: 0, kind: undefined, lit: undefined, shadow: undefined, w: undefined, h: undefined, moss: undefined, col: undefined, flip: undefined, n: undefined };
  function so(t, s, seed, kind, lit, shadow) {
    SO.t = t; SO.s = s; SO.seed = seed; SO.kind = kind; SO.lit = lit; SO.shadow = shadow; SO.w = SO.h = SO.moss = SO.col = SO.flip = SO.n = undefined;
    return SO;
  }
  // volume de 3 tons num retângulo Pix: base, sombra à direita/embaixo, luz em cima/esquerda
  function vol(P, x, y, w, h, base, dark, light) {
    P.rect(x, y, w, h, base);
    if (w > 3) P.rect(x + w - Math.max(1, Math.round(w * 0.22)), y, Math.max(1, Math.round(w * 0.22)), h, dark);
    if (h > 2) P.rect(x, y + h - 1, w, 1, dark);
    P.rect(x, y, w, 1, light);
    if (w > 3) P.rect(x, y, 1, h - 1, light);
  }
  // galho curvo (bézier quadrática) com espessura w0 -> w1
  function limb(P, L, col, ox, oy, dx, shrink) {
    const x0 = L[0], y0 = L[1], cx = L[2], cy = L[3], x1 = L[4], y1 = L[5];
    const n = Math.ceil((Math.abs(x1 - x0) + Math.abs(y1 - y0) + Math.abs(cx - x0) + Math.abs(cy - y0)) * 1.3) + 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t, r = Math.max(0.55, (L[6] + (L[7] - L[6]) * t) / 2 - shrink);
      P.ell(ox + u * u * x0 + 2 * u * t * cx + t * t * x1 + dx, oy + u * u * y0 + 2 * u * t * cy + t * t * y1, r, r, col);
    }
  }

  /* ======================================================================
     2. Hora do dia: paleta do céu, tinta do cenário, brilhos
     ====================================================================== */
  const TOD_K = [0, 0.5, 0.75, 1];
  const TOD_C = {
    top:    ['#7CC0E4', '#62AEDD', '#4E5A96', '#141629'],
    mid:    ['#B4DEEC', '#9FD3E8', '#D9778A', '#232A4C'],
    bot:    ['#FBE3C4', '#DDF0EE', '#FFC46E', '#46527F'],
    haze:   ['#E6EEE2', '#D2E8EE', '#F0B09A', '#39446A'],
    tint:   ['#FFF1DE', '#FFFDF4', '#FFCDAA', '#6676B4'],
    cloud:  ['#FFFFFF', '#FFFFFF', '#FFDCC6', '#5C6893'],
    cloudS: ['#E6E2EA', '#D3E3EE', '#E48E90', '#3C466E'],
    sun:    ['#FFE9A8', '#FFD36B', '#FF9A52', '#FF7A4A'],
  };
  const SKY_BANDS = 16, todCache = new Map();

  // Nature.light(tod) -> {top,mid,bot,haze,tint,cloud,cloudS,sun,night(0..1),bands[]}: cores da hora (0 manhã, .5 tarde, .75 pôr do sol, 1 noite)
  function light(tod) {
    if (tod === undefined) tod = Nature.tod;
    const q = Math.round(U.clamp(tod, 0, 1) * 96);
    let st = todCache.get(q);
    if (st) return st;
    const v = q / 96;
    let i = 0;
    while (i < 2 && v > TOD_K[i + 1]) i++;
    const f = U.smooth((v - TOD_K[i]) / (TOD_K[i + 1] - TOD_K[i]));
    st = { tod: v, night: U.smooth((v - 0.8) / 0.18), dusk: 1 - Math.min(1, Math.abs(v - 0.75) / 0.2), bands: [] };
    for (const k in TOD_C) st[k] = U.mixCss(TOD_C[k][i], TOD_C[k][i + 1], f);
    for (let b = 0; b < SKY_BANDS; b++) {
      const u = (b + 0.5) / SKY_BANDS;
      st.bands.push(u < 0.55 ? U.mixCss(st.top, st.mid, u / 0.55) : U.mixCss(st.mid, st.bot, (u - 0.55) / 0.45));
    }
    todCache.set(q, st);
    return st;
  }

  const STARS = [];
  (function () { const r = E.RNG(4242); for (let i = 0; i < 110; i++) STARS.push(r(), r() * r(), r(), r() * TAU); })();

  // Nature.sky(g, w, h, {tod=0..1, stars=true, t=0}): céu em faixas com a cor da hora; também define Nature.tod pro resto do kit
  function sky(g, w, h, o) {
    o = o || NO;
    if (o.tod !== undefined) Nature.tod = o.tod;
    const st = light(Nature.tod), bh = h / SKY_BANDS;
    for (let b = 0; b < SKY_BANDS; b++) { g.fillStyle = st.bands[b]; g.fillRect(0, Math.floor(b * bh), w, Math.ceil(bh) + 1); }
    if (o.stars !== false && st.night > 0.02) {
      const t = o.t || 0, pa = g.globalAlpha;
      g.fillStyle = '#FFF8DC';
      for (let i = 0; i < STARS.length; i += 4) {
        const big = STARS[i + 2] > 0.86, tw = 0.55 + 0.45 * Math.sin(t * (1 + STARS[i + 2] * 2.5) + STARS[i + 3]);
        const x = Math.round(STARS[i] * w), y = Math.round(STARS[i + 1] * h * 0.9);
        g.globalAlpha = pa * st.night * tw * (big ? 1 : 0.75);
        g.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
        if (big && tw > 0.8) { g.fillRect(x - 1, y, 4, 1); g.fillRect(x, y - 1, 1, 4); }
      }
      g.globalAlpha = pa;
    }
  }

  // Nature.sun(g, x, y, r, {tod, t=0}): sol chapado com halo em degraus e raios girando devagar
  function sun(g, x, y, r, o) {
    o = o || NO;
    const st = light(o.tod), t = o.t || 0, pa = g.globalAlpha, c = st.sun;
    g.fillStyle = c;
    g.globalAlpha = pa * 0.075;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = t * 0.07 + i * TAU / 10, a2 = a + 0.1, R = r * (3 + 0.5 * Math.sin(t * 0.9 + i * 2.1));
      g.moveTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2);
      g.lineTo(x + Math.cos(a - 0.03) * R, y + Math.sin(a - 0.03) * R);
      g.lineTo(x + Math.cos(a2 + 0.03) * R, y + Math.sin(a2 + 0.03) * R);
      g.lineTo(x + Math.cos(a2) * r * 1.2, y + Math.sin(a2) * r * 1.2);
    }
    g.fill();
    for (let i = 3; i >= 1; i--) {
      g.globalAlpha = pa * (0.07 + 0.045 * (3 - i));
      g.beginPath(); g.arc(x, y, r * (1 + i * 0.42 + 0.04 * Math.sin(t * 1.3 + i)), 0, TAU); g.fill();
    }
    g.globalAlpha = pa;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = sh(c, 0.5);
    g.beginPath(); g.arc(x - r * 0.12, y - r * 0.14, r * 0.74, 0, TAU); g.fill();
  }

  // Nature.moon(g, x, y, r, {t=0, alpha=1}): lua cheia creme com crateras e halo frio
  function moon(g, x, y, r, o) {
    o = o || NO;
    const pa = g.globalAlpha, al = o.alpha === undefined ? 1 : o.alpha, t = o.t || 0;
    g.fillStyle = '#C9D6FF';
    for (let i = 3; i >= 1; i--) {
      g.globalAlpha = pa * al * 0.06;
      g.beginPath(); g.arc(x, y, r * (1 + i * 0.5 + 0.05 * Math.sin(t * 0.8 + i)), 0, TAU); g.fill();
    }
    g.globalAlpha = pa * al;
    g.fillStyle = '#E3DAC0'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = '#FFF6D8'; g.beginPath(); g.arc(x - r * 0.1, y - r * 0.1, r * 0.86, 0, TAU); g.fill();
    g.fillStyle = '#E9DFC2';
    g.beginPath(); g.arc(x - r * 0.3, y - r * 0.25, r * 0.2, 0, TAU);
    g.moveTo(x + r * 0.42, y + r * 0.08); g.arc(x + r * 0.25, y + r * 0.08, r * 0.17, 0, TAU);
    g.moveTo(x - r * 0.05, y + r * 0.45); g.arc(x - r * 0.18, y + r * 0.45, r * 0.13, 0, TAU);
    g.moveTo(x + r * 0.2, y - r * 0.45); g.arc(x + r * 0.12, y - r * 0.45, r * 0.08, 0, TAU);
    g.fill();
    g.globalAlpha = pa;
  }

  const CEL = { tod: 0, t: 0, alpha: 1 };
  // Nature.celestial(g, w, horizon, {tod, t, r=18}): põe sol e lua no arco do céu conforme a hora (nasce à esquerda, se põe à direita)
  function celestial(g, w, horizon, o) {
    o = o || NO;
    const tod = o.tod === undefined ? Nature.tod : o.tod, r = o.r || 18, t = o.t || 0;
    if (tod < 0.9) {
      const k = tod / 0.75;                                     // 0 nascendo .. 1 encostando no horizonte
      const sx = w * (0.16 + 0.62 * k), sy = horizon - (Math.sin((0.16 + 0.84 * k) * PI) * 0.78 + 0.02) * horizon + (tod > 0.75 ? (tod - 0.75) * horizon * 3 : 0);
      CEL.tod = tod; CEL.t = t; CEL.alpha = 1;
      sun(g, sx, sy, r * (1 + 0.25 * light(tod).dusk), CEL);
    }
    if (tod > 0.8) {
      const k = U.smooth((tod - 0.8) / 0.2);
      const mx = w * 0.26, my = horizon * (1.05 - 0.84 * k);
      CEL.t = t; CEL.alpha = k;
      moon(g, mx, my, r * 0.9, CEL);
      queueGlow(g, mx, my, r * 3, '#DCE6FF', k * 0.2);                 // o luar volta a brilhar depois de grade()
    }
  }

  /* ---------- tinta do cenário + brilhos ---------- */
  const haloCache = new Map();
  function halo(col) {
    let cv = haloCache.get(col);
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const q = cv.getContext('2d'), gr = q.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, U.rgba(col, 0.95)); gr.addColorStop(0.25, U.rgba(col, 0.5)); gr.addColorStop(0.6, U.rgba(col, 0.14)); gr.addColorStop(1, U.rgba(col, 0));
      q.fillStyle = gr; q.fillRect(0, 0, 64, 64);
      haloCache.set(col, cv);
    }
    return cv;
  }
  // Nature.glow(g, x, y, r, col='#FFD98A', alpha=1): halo aditivo (lanterna, janela, vaga-lume); desenhe DEPOIS de grade()
  function glow(g, x, y, r, col, alpha) {
    const pa = g.globalAlpha, op = g.globalCompositeOperation;
    g.globalAlpha = pa * (alpha === undefined ? 1 : alpha);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(halo(col || '#FFD98A'), x - r, y - r, r * 2, r * 2);
    g.globalCompositeOperation = op; g.globalAlpha = pa;
  }
  // fila de brilhos dos objetos acesos (em px de tela): entram ao desenhar, saem em grade()/glows()
  const GQ = 96, gq = new Float32Array(GQ * 4), gqCol = new Array(GQ).fill('');
  let gqN = 0;
  function queueGlow(g, x, y, r, col, a) {
    if (a <= 0.01) return;
    const m = g.getTransform(), i = (gqN++ % GQ) * 4;
    gq[i] = m.a * x + m.c * y + m.e; gq[i + 1] = m.b * x + m.d * y + m.f;
    gq[i + 2] = r * Math.hypot(m.a, m.b); gq[i + 3] = a; gqCol[i >> 2] = col;
  }
  // Nature.glows(g): descarrega os halos dos objetos acesos desenhados neste frame (grade() já chama)
  function glows(g) {
    const n = Math.min(gqN, GQ);
    gqN = 0;
    if (!n) return;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < n; i++) glow(g, gq[i * 4], gq[i * 4 + 1], gq[i * 4 + 2], gqCol[i], gq[i * 4 + 3]);
    g.restore();
  }
  let grad = null, gradG = null, gradTop = 0, gradFade = 0, gradTint = '';
  // Nature.grade(g, w, h, {tod, horizon, top=100, fade=80, x=0, y=0, strength=1}): tinge o cenário com a luz da hora (multiply) e acende os halos.
  //   horizon = y da linha do chão; a tinta vale inteira até `top` acima dela (altura dos objetos mais altos) e some nos `fade` seguintes,
  //   porque o céu já vem na cor certa. Sem horizon, tinge o retângulo todo (cenas sem céu).
  function grade(g, w, h, o) {
    o = o || NO;
    const st = light(o.tod), x = o.x || 0, y = o.y || 0, k = o.strength === undefined ? 1 : o.strength;
    const tint = k >= 1 ? st.tint : U.mixCss('#FFFFFF', st.tint, k);
    g.save();
    g.globalCompositeOperation = 'multiply';
    if (o.horizon !== undefined) {
      const top = o.horizon - (o.top === undefined ? 100 : o.top), fade = o.fade === undefined ? 80 : o.fade;
      if (gradG !== g || gradTop !== top || gradFade !== fade || gradTint !== tint) {
        grad = g.createLinearGradient(0, top - fade, 0, top);
        grad.addColorStop(0, '#FFFFFF'); grad.addColorStop(1, tint);
        gradG = g; gradTop = top; gradFade = fade; gradTint = tint;
      }
      g.fillStyle = grad;
    } else g.fillStyle = tint;
    g.fillRect(x, y, w, h);
    g.restore();
    glows(g);
  }
  // acesso padrão das luzes: acende sozinho quando escurece
  function litOf(o) { return o.lit !== undefined ? (o.lit === true ? 1 : +o.lit || 0) : U.smooth((Nature.tod - 0.66) / 0.14); }

  /* ======================================================================
     3. Fundo: nuvens, Fuji, morros, chão
     ====================================================================== */
  // Nature.clouds(seed, {n=7}) -> { list, update(dt), draw(g, w, h, camX=0) }: nuvens gordinhas de base reta, com parallax e cor da hora
  function clouds(seed, o) {
    o = o || NO;
    const rn = E.RNG(seed === undefined ? 7 : seed), n = o.n || 7, list = [];
    for (let i = 0; i < n; i++) {
      const puffs = [], m = rn.int(3, 5);
      let x = 0;
      for (let k = 0; k < m; k++) {
        const edge = k === 0 || k === m - 1, r = rn.range(8, 13) * (edge ? 0.8 : 1.25);
        puffs.push(x + r * 0.75, r); x += r * 1.3;
      }
      const far = rn();
      list.push({ x: (i + rn.range(0, 0.7)) / n, y: 0.06 + far * 0.36, s: 1.5 - far * 0.85, v: rn.range(2.5, 6), w: x, puffs, ph: rn.range(0, TAU) });
    }
    let drift = 0;
    const cl = {
      list,
      // update(dt): avança o vento das nuvens
      update(dt) { drift += dt; },
      // draw(g, w, h, camX=0, {tod}): desenha na área (w,h) do céu
      draw(g, w, h, camX, oo) {
        const st = light(oo && oo.tod), pa = g.globalAlpha;
        camX = camX || 0;
        for (let i = 0; i < list.length; i++) {
          const c = list[i], s = c.s, span = w + c.w * s + 40;
          const x = U.wrap(c.x * span + (drift * c.v - camX * 0.12) * s, 0, span) - c.w * s - 20;
          const y = c.y * h + Math.sin(drift * 0.25 + c.ph) * 2, p = c.puffs;
          g.globalAlpha = pa * (0.55 + 0.45 * Math.min(1, s));
          g.fillStyle = st.cloudS;                                   // sombra: base reta + gomos
          g.beginPath(); D.rrect(g, x, y - 4 * s, c.w * s, 8 * s, 4 * s); g.fill();
          g.beginPath();
          for (let k = 0; k < p.length; k += 2) { g.moveTo(x + (p[k] + p[k + 1]) * s, y); g.arc(x + p[k] * s, y, p[k + 1] * s, 0, PI, true); }
          g.fill();
          g.fillStyle = st.cloud;                                    // luz: gomos menores, pra cima e pra esquerda
          g.beginPath();
          for (let k = 0; k < p.length; k += 2) {
            const r = p[k + 1] * s * 0.86, cx = x + p[k] * s - 1.4 * s, cy = y - 1.2 * s;
            g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, PI, true);
          }
          g.fill();
          g.beginPath(); D.rrect(g, x + 3 * s, y - 3.4 * s, (c.w - 8) * s, 4.4 * s, 2.2 * s); g.fill();
        }
        g.globalAlpha = pa;
      },
    };
    return cl;
  }

  let fujiBody = null, fujiSnow = null, fujiShade = null;
  function fujiPaths() {
    fujiBody = new Path2D('M-165 0 Q-72 -26 -25 -100 L-16 -106 L-8 -102 L1 -107 L10 -103 L19 -106 L26 -100 Q72 -26 165 0 Z');
    fujiSnow = new Path2D('M-90 -130 L-90 -62 L-47 -60 L-40 -71 L-33 -57 L-25 -75 L-16 -59 L-7 -77 L2 -60 L11 -75 L20 -58 L28 -71 L36 -57 L44 -63 L90 -60 L90 -130 Z');
    fujiShade = new Path2D('M3 -108 L9 -86 L1 -66 L15 -40 L7 -16 L12 0 L170 0 L170 -120 Z');
  }
  // Nature.fuji(g, x, y, s=1, {snow=true, alpha=1, tod, t=0}): Monte Fuji (base em x,y; ~330*s de largura, 107*s de altura) com névoa na base
  function fuji(g, x, y, s, o) {
    o = o || NO; s = s || 1;
    if (!fujiBody) fujiPaths();
    const st = light(o.tod), t = o.t || 0, pa = g.globalAlpha;
    const body = U.mixCss(U.mixCss('#5F7FB8', st.haze, 0.42), st.top, 0.18), snow = U.mixCss('#FFFDF6', st.haze, 0.2 + 0.25 * st.night);
    g.save(); g.translate(x, y); g.scale(s, s);
    if (o.alpha !== undefined) g.globalAlpha = pa * o.alpha;
    g.fillStyle = body; g.fill(fujiBody);
    g.save(); g.clip(fujiBody);
    if (o.snow !== false) { g.fillStyle = snow; g.fill(fujiSnow); }
    g.fillStyle = U.rgba(st.top, 0.3); g.fill(fujiShade);
    g.fillStyle = st.haze;                                           // névoa de distância em degraus
    g.globalAlpha *= 0.3; g.fillRect(-170, -34, 340, 34);
    g.fillRect(-170, -22, 340, 22); g.fillRect(-170, -10, 340, 10);
    g.restore();
    g.fillStyle = st.cloud; g.globalAlpha *= 0.85;                    // faixa de nuvem cruzando a encosta
    const dx = Math.sin(t * 0.05) * 14;
    g.beginPath();
    D.rrect(g, -84 + dx, -41, 58, 6, 3); D.rrect(g, -62 + dx, -45, 30, 6, 3);
    D.rrect(g, 30 - dx * 0.6, -30, 64, 6, 3); D.rrect(g, 46 - dx * 0.6, -34, 26, 6, 3);
    g.fill();
    g.restore(); g.globalAlpha = pa;
  }

  // Nature.hills(g, w, baseY, camX, {col, amp=40, freq=.006, parallax=.3, seed=1, haze=0, tod, trees=0, bottom, step=6}):
  //   faixa de morros de ruído com 3 tons; haze 0..1 mistura a cor com a névoa da hora (camadas distantes mais claras e azuladas)
  function hills(g, w, baseY, camX, o) {
    o = o || NO;
    const st = light(o.tod), amp = o.amp === undefined ? 40 : o.amp, fr = o.freq || 0.006, seed = o.seed === undefined ? 1 : o.seed;
    const ox = (camX || 0) * (o.parallax === undefined ? 0.3 : o.parallax), step = o.step || 6, hz = o.haze || 0;
    const col = hz ? U.mixCss(o.col || C.grass, st.haze, hz) : (o.col || C.grass);
    const bottom = o.bottom === undefined ? baseY + 260 : o.bottom, N = E.Noise;
    const hy = x => baseY - amp * (N.fbm1((x + ox) * fr, 3, seed) * 1.25 - 0.12);
    const x0 = -step - (ox % step);
    if (o.trees) {                                                   // mata na crista: bolinhas escuras
      g.fillStyle = sh(col, -0.16);
      g.beginPath();
      const sp = 9, i0 = Math.floor(ox / sp) - 1, i1 = Math.ceil((ox + w) / sp) + 1;
      for (let i = i0; i <= i1; i++) {
        if (hash(i, seed) > o.trees) continue;
        const wx = i * sp + hash(i, seed + 3) * sp, r = 3.5 + hash(i, seed + 5) * 4, sx = wx - ox;
        g.moveTo(sx + r, hy(sx) - r * 0.5); g.arc(sx, hy(sx) - r * 0.5, r, 0, TAU);
      }
      g.fill();
    }
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x0, bottom);
    for (let x = x0; x <= w + step; x += step) g.lineTo(x, hy(x));
    g.lineTo(w + step, bottom); g.closePath(); g.fill();
    g.fillStyle = sh(col, -0.1);                                     // dobra sombreada mais abaixo
    g.beginPath(); g.moveTo(x0, bottom);
    for (let x = x0; x <= w + step; x += step) g.lineTo(x, hy(x) + amp * (0.3 + 0.35 * N.n1((x + ox) * fr * 2.3, seed + 9)) + 4);
    g.lineTo(w + step, bottom); g.closePath(); g.fill();
    g.strokeStyle = sh(col, 0.2); g.lineWidth = 2; g.lineJoin = 'round';   // luz na crista
    g.beginPath();
    for (let x = x0; x <= w + step; x += step) { if (x === x0) g.moveTo(x, hy(x) + 1.2); else g.lineTo(x, hy(x) + 1.2); }
    g.stroke();
  }

  const gpat = new Map();
  function grassPattern(g, col) {
    let p = gpat.get(col);
    if (!p) {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32;
      const q = cv.getContext('2d'), rn = E.RNG('gp' + col);
      for (let i = 0; i < 26; i++) {
        const x = rn.int(1, 61), y = rn.int(3, 30), lightTick = rn.chance(0.4);
        q.fillStyle = lightTick ? sh(col, 0.22) : sh(col, -0.2);
        q.fillRect(x, y - 2, 1, 3); q.fillRect(x + 1, y - 3, 1, 2);
        if (rn.chance(0.5)) q.fillRect(x - 1, y - 1, 1, 2);
      }
      p = g.createPattern(cv, 'repeat'); gpat.set(col, p);
    }
    return p;
  }
  // Nature.ground(g, x0, x1, y, {col=grama, tufts=true, depth=160, t=0, seed=0, texture=true}): chão com crista clara, textura de capim e tufos no vento
  function ground(g, x0, x1, y, o) {
    o = o || NO;
    const col = o.col || C.grass, depth = o.depth || 160, w = x1 - x0;
    g.fillStyle = col; g.fillRect(x0, y, w, depth);
    g.fillStyle = sh(col, -0.1); g.fillRect(x0, y + depth * 0.42, w, depth * 0.58);
    g.fillStyle = sh(col, -0.2); g.fillRect(x0, y + depth * 0.74, w, depth * 0.26);
    if (o.texture !== false) { g.fillStyle = grassPattern(g, col); g.fillRect(x0, y + 3, w, depth - 3); }
    g.fillStyle = sh(col, 0.3); g.fillRect(x0, y, w, 2.5);
    g.fillStyle = sh(col, -0.42); g.fillRect(x0, y - 1.2, w, 1.2);
    if (o.tufts !== false) {
      const sp = 26, seed = o.seed || 0, t = o.t || 0;
      for (let i = Math.floor(x0 / sp); i <= Math.ceil(x1 / sp); i++) {
        if (hash(i, seed + 11) > 0.62) continue;
        const tx = i * sp + hash(i, seed + 12) * 20;
        if (tx > x0 + 4 && tx < x1 - 4) { so(t, 1, i * 7 + seed); SO.col = col; grassTuft(g, tx, y + 1, SO); }
      }
    }
  }

  const TUFT_O = { seed: 0, t: 0, s: 1, col: null, n: 0 };
  // Nature.grassTuft(g, x, y, {seed=0, t=0, s=1, col, n}): tufo de capim com lâminas que dobram no vento
  function grassTuft(g, x, y, o) {
    o = o || TUFT_O;
    const seed = o.seed || 0, s = o.s || 1, col = o.col || C.grass, n = o.n || 5 + ((hash(seed, 1) * 3) | 0);
    const wv = wind(o.t || 0, x), ph = hash(seed, 2) * TAU, t = o.t || 0;
    g.lineCap = 'round';
    for (let pass = 0; pass < 3; pass++) {
      g.strokeStyle = pass === 0 ? sh(col, -0.5) : pass === 1 ? sh(col, -0.14) : sh(col, 0.22);
      g.lineWidth = (pass === 0 ? 3 : 1.5) * s;
      g.beginPath();
      for (let k = 0; k < n; k++) {
        if (pass && (k & 1) !== pass - 1) continue;
        const a = (k / (n - 1) - 0.5) * 1.5 + (hash(seed, k + 5) - 0.5) * 0.3, len = (6 + hash(seed, k + 20) * 7) * s;
        const bx = x + (k - (n - 1) / 2) * 1.6 * s, bend = (wv * 0.42 + Math.sin(t * 2.6 + ph + k) * 0.12) * len;
        g.moveTo(bx, y);
        g.quadraticCurveTo(bx + Math.sin(a) * len * 0.45 + bend * 0.25, y - len * 0.6, bx + Math.sin(a) * len + bend, y - Math.cos(a) * len + Math.abs(bend) * 0.25);
      }
      g.stroke();
    }
  }

  /* ======================================================================
     4. Flora: copas em gomos (sprites compartilhados), troncos por semente, balanço por gomo
     ====================================================================== */
  const FOL = {
    round:   { d: C.grassD, b: C.grass, l: C.grassL },
    roundB:  { d: sh(C.leafD, -0.12), b: C.grassD, l: C.grass },
    pine:    { d: sh(C.leafD, -0.3), b: C.leafD, l: C.leaf },
    pineB:   { d: sh(C.leafD, -0.45), b: sh(C.leafD, -0.2), l: C.leafD },
    sakura:  { d: C.sakuraD, b: C.sakura, l: sh(C.sakura, 0.6), d1: C.white, d2: C.pink },
    sakuraB: { d: sh(C.sakuraD, -0.22), b: C.sakuraD, l: C.sakura, d1: C.sakura, d2: sh(C.sakuraD, -0.3) },
    maple:   { d: C.redD, b: C.red, l: C.ora, d1: C.yel, d2: C.redL },
    maple2:  { d: C.oraD, b: C.ora, l: C.yel, d1: C.yelL, d2: C.red },
    mapleB:  { d: sh(C.redD, -0.3), b: C.redD, l: C.red, d1: C.red, d2: C.redD },
    bush:    { d: C.leafD, b: C.leaf, l: C.grass },
    azalea:  { d: C.leafD, b: C.leaf, l: C.grass, d1: C.sakura, d2: C.pink },
  };

  // gomo de folhagem em 3 tons: shape 'round' | 'bloom' (flores) | 'star' (momiji) | 'pad' (almofada de pinheiro)
  function clump(pal, shape, r, v) {
    const key = 'cl/' + pal + shape + r + '.' + v, f = FOL[pal], pad = shape === 'pad';
    const ry = pad ? Math.max(3, Math.round(r * 0.5)) : Math.round(r * 0.84);
    const W = r * 2 + 8, H = ry * 2 + 8;
    return sprite(key, W, H, P => {
      const rn = E.RNG(key), cx = W / 2, cy = H / 2, bl = [[0, pad ? 1 : 0, r * 0.8, ry * 0.82]];
      const n = pad ? 5 : r > 9 ? 5 : 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rn.range(-0.35, 0.35) + (pad ? 0.3 : 0), k = rn.range(0.5, 0.64);
        bl.push([Math.cos(a) * r * (1 - k), Math.sin(a) * ry * (1 - k) * (pad ? 0.7 : 1), r * k, ry * k * (pad ? 1.25 : 1)]);
      }
      for (const b of bl) P.ell(cx + b[0], cy + b[1], b[2], b[3], f.d);
      if (shape === 'star') for (let i = 0; i < 12; i++) {                // pontas de folha de bordo
        const a = i / 12 * TAU + rn.range(-0.15, 0.15), q0 = r * 0.72, q1 = r + rn.range(0.5, 2.2), wv = 0.2;
        P.tri(cx + Math.cos(a - wv) * q0, cy + Math.sin(a - wv) * q0 * ry / r, cx + Math.cos(a + wv) * q0, cy + Math.sin(a + wv) * q0 * ry / r,
          cx + Math.cos(a) * q1, cy + Math.sin(a) * q1 * ry / r, i % 3 ? f.d : f.b);
      }
      for (const b of bl) P.ell(cx + b[0] - 0.9, cy + b[1] - 1.3, b[2] - 1.1, b[3] - 1.6, f.b);
      for (const b of bl) if (b[1] <= ry * 0.12) P.ell(cx + b[0] - b[2] * 0.26, cy + b[1] - b[3] * 0.44, b[2] * 0.52, b[3] * 0.3, f.l);
      if (pad) {
        const cut = Math.round(cy + ry * 0.42);
        P.erase(0, cut + 1, W, H);
        for (let x = 0; x < W; x++) {
          if (P.get(x, cut)) P.set(x, cut, f.d);
          if (x % 2 === 0) for (let y = 0; y < cut; y++) if (P.get(x, y)) { P.set(x, y - 1, rn.chance(0.5) ? f.b : f.d); break; }   // agulhas
        }
        for (let i = 0; i < r; i++) { const x = rn.int(3, W - 4), y = rn.int(3, cut - 1); if (P.get(x, y)) P.set(x, y, rn.chance(0.5) ? f.d : f.l); }
      } else {
        const dots = Math.round(r * (shape === 'round' ? 0.9 : 1.6));
        for (let i = 0; i < dots; i++) {
          const a = rn.range(0, TAU), q = Math.sqrt(rn()) * 0.82, x = Math.round(cx + Math.cos(a) * r * q), y = Math.round(cy + Math.sin(a) * ry * q);
          if (!P.get(x, y)) continue;
          if (shape === 'round') { const up = y < cy; P.set(x, y, up ? f.l : f.d); P.set(x + 1, y + (up ? 0 : 1), up ? f.l : f.d); }
          else P.set(x, y, rn.chance(0.55) ? f.d1 : y > cy ? f.d2 : f.l);
        }
      }
    });
  }

  const treeCache = new Map();
  // monta a receita de uma árvore: tronco (canvas próprio da semente) + lista de gomos com fase de balanço
  function buildTree(kind, seed) {
    const rn = E.RNG('tree' + kind + seed), limbs = [], clumps = [], j = () => rn.range(-2, 2);
    let bark = [sh(C.woodD, -0.3), C.woodD, C.wood], flex = 0.03, trunkFlex = 1, pot = false;
    const add = (pal, shape, r, x, y, back) => clumps.push({ cv: clump(pal, shape, r, rn.int(0, 3)), x: x + j(), y: y + j() * 0.7, ph: rn.range(0, TAU), amp: rn.range(0.5, 1.1) * (r / 12), back: !!back });
    if (kind === 'round') {
      const H = rn.int(38, 50), le = rn.range(-5, 5);
      limbs.push([0, 0, le * 0.2, -H * 0.5, le, -H, 9, 5.5], [0, -1, -4, -2, -7, 0, 4.5, 2], [0, -1, 4, -2, 7, 0, 4.5, 2],
        [le * 0.6, -H * 0.6, le - 8, -H * 0.8, le - 13, -H - 2, 3.6, 2], [le * 0.8, -H * 0.7, le + 8, -H * 0.86, le + 13, -H - 4, 3.6, 2]);
      add('roundB', 'round', 14, le - 13, -H - 9, 1); add('roundB', 'round', 13, le + 14, -H - 7, 1); add('roundB', 'round', 12, le, -H - 24, 1);
      add('round', 'round', 12, le - 17, -H - 1); add('round', 'round', 12, le + 17, -H - 2); add('round', 'round', 11, le + 7, -H + 5);
      add('round', 'round', 14, le - 3, -H - 6); add('round', 'round', 11, le - 10, -H - 17); add('round', 'round', 11, le + 11, -H - 16);
      add('round', 'round', 14, le + 1, -H - 22);
      flex = 0.032;
    } else if (kind === 'sakura') {
      const H = rn.int(28, 36), le = rn.range(-4, 4);
      bark = [sh(C.woodD, -0.5), sh(C.woodD, -0.22), C.wood];
      limbs.push([0, 0, -3, -H * 0.5, le, -H, 10, 6.5], [0, -1, -5, -2, -8, 0, 5, 2], [0, -1, 5, -2, 8, 0, 5, 2],
        [le, -H, le - 10, -H - 7, le - 24, -H - 13, 5, 2], [le, -H, le + 2, -H - 12, le + 5, -H - 22, 5, 2], [le, -H + 4, le + 12, -H - 3, le + 24, -H - 11, 4.6, 2]);
      add('sakuraB', 'bloom', 13, le - 14, -H - 22, 1); add('sakuraB', 'bloom', 13, le + 16, -H - 21, 1); add('sakuraB', 'bloom', 12, le + 2, -H - 32, 1);
      add('sakura', 'bloom', 12, le - 27, -H - 11); add('sakura', 'bloom', 12, le + 27, -H - 10); add('sakura', 'bloom', 11, le - 2, -H - 9);
      add('sakura', 'bloom', 13, le + 13, -H - 13); add('sakura', 'bloom', 13, le - 13, -H - 17); add('sakura', 'bloom', 11, le - 20, -H - 27);
      add('sakura', 'bloom', 11, le + 21, -H - 26); add('sakura', 'bloom', 14, le + 4, -H - 27);
      flex = 0.028;
    } else if (kind === 'maple') {
      const H = rn.int(32, 42), le = rn.range(6, 11);
      bark = [sh(C.woodD, -0.4), sh(C.woodD, -0.1), C.woodL];
      limbs.push([0, 0, le * 0.1, -H * 0.55, le, -H, 6.5, 3.5], [0, -1, -3, -1, -5, 0, 3.5, 1.6], [0, -1, 3, -1, 5, 0, 3.5, 1.6],
        [le * 0.5, -H * 0.6, le - 9, -H * 0.76, le - 15, -H - 4, 3, 1.6], [le, -H, le + 8, -H - 5, le + 14, -H - 11, 3, 1.6]);
      add('mapleB', 'star', 13, le, -H - 13, 1); add('mapleB', 'star', 10, le - 13, -H - 16, 1);
      add('maple', 'star', 10, le - 17, -H - 5); add('maple2', 'star', 11, le + 13, -H - 13); add('maple', 'star', 10, le + 2, -H - 2);
      add('maple2', 'star', 8, le + 21, -H - 3); add('maple', 'star', 12, le - 4, -H - 14); add('maple2', 'star', 9, le - 9, -H - 24); add('maple', 'star', 9, le + 6, -H - 25);
      flex = 0.045;
    } else if (kind === 'pine') {
      const H = rn.int(52, 64), s = 1;
      bark = [sh(C.rustD, -0.35), C.rustD, C.rust];
      limbs.push([0, 0, -9 * s, -H * 0.3, 2 * s, -H * 0.52, 9.5, 7], [2 * s, -H * 0.52, 11 * s, -H * 0.74, 3 * s, -H, 7, 4],
        [0, -1, -5, -2, -8, 0, 5, 2], [0, -1, 5, -2, 8, 0, 5, 2],
        [-4 * s, -H * 0.32, -13 * s, -H * 0.34, -21 * s, -H * 0.43, 3.6, 2], [4 * s, -H * 0.55, 15 * s, -H * 0.56, 23 * s, -H * 0.62, 3.6, 2],
        [7 * s, -H * 0.76, -2 * s, -H * 0.78, -10 * s, -H * 0.84, 3, 1.8]);
      add('pineB', 'pad', 13, 6 * s, -H * 0.66 - 6, 1); add('pineB', 'pad', 12, -8 * s, -H - 2, 1);
      add('pine', 'pad', 15, -23 * s, -H * 0.43 - 6); add('pine', 'pad', 14, 25 * s, -H * 0.62 - 6);
      add('pine', 'pad', 12, -12 * s, -H * 0.84 - 5); add('pine', 'pad', 10, 16 * s, -H * 0.88 - 4); add('pine', 'pad', 14, 4 * s, -H - 6);
      flex = 0.018;
    } else if (kind === 'bonsai') {
      bark = [sh(C.rustD, -0.35), C.rustD, C.rust]; pot = true; trunkFlex = 0; flex = 0.012;
      limbs.push([0, -9, -6, -15, 1, -21, 4.4, 3], [1, -21, 7, -25, 3, -31, 3, 2], [-1, -15, -6, -16, -10, -19, 2.2, 1.5], [3, -24, 8, -24, 11, -26, 2, 1.4]);
      add('pine', 'pad', 8, -11, -22); add('pine', 'pad', 7, 12, -29); add('pine', 'pad', 8, 2, -35);
      for (const c of clumps) c.amp *= 0.6;
    } else {                                                           // moitas: 'bush' | 'azalea'
      const n = rn.int(3, 4), az = kind === 'azalea';
      for (let i = 0; i < n; i++) {
        const r = rn.int(7, 10) + (i === 1 ? 2 : 0);
        add(az ? 'azalea' : 'bush', az ? 'bloom' : 'round', r, (i - (n - 1) / 2) * 9, -r * 0.62 - (i === 1 ? 3 : 0), i === 0 || i === n - 1);
      }
      flex = 0.02;
    }
    let trunk = null, ax = 0, ay = 0, half = 12;
    if (limbs.length) {
      let mx = 12, top = 10;
      for (const L of limbs) { mx = Math.max(mx, Math.abs(L[0]) + 6, Math.abs(L[4]) + 4, Math.abs(L[2]) + 5); top = Math.max(top, -L[5] + 4, -L[3] + 4); }
      const TW = Math.ceil(mx) * 2 + 4, TH = Math.ceil(top) + 4, P = E.Pix(TW, TH), ox = TW / 2, oy = TH - 2;
      for (const L of limbs) limb(P, L, bark[0], ox, oy, 0, 0);
      for (const L of limbs) limb(P, L, bark[1], ox, oy, -0.8, 0.9);
      for (const L of limbs) if (L[6] >= 4.4) limb(P, L, bark[2], ox, oy, -L[6] * 0.24, L[6] * 0.36);
      for (let i = 0; i < 7; i++) { const L = limbs[0], y = oy + rn.range(L[5] * 0.9, -3), x = ox + rn.range(-2, 2) + L[4] * (oy - y) / -L[5] * 0.6; if (P.get(x, y)) P.set(x, y, bark[0]); }
      if (pot) {
        P.rrect(ox - 11, oy - 9, 22, 9, 3, C.bowl).rect(ox - 12, oy - 10, 24, 2, C.bowlL).rect(ox - 10, oy - 3, 20, 2, sh(C.bowl, -0.3))
          .rect(ox - 9, oy - 1, 4, 2, sh(C.bowl, -0.3)).rect(ox + 5, oy - 1, 4, 2, sh(C.bowl, -0.3)).rect(ox - 9, oy - 11, 18, 1, C.leaf).rect(ox - 8, oy - 7, 2, 3, C.bowlL);
      }
      P.erase(0, oy + 1, TW, 3);
      trunk = P.canvas(); ax = ox; ay = oy + 1; half = mx;
    }
    let sw = half * 0.5;
    for (const c of clumps) sw = Math.max(sw, Math.abs(c.x) * 0.75 + 6);
    clumps.sort((a, b) => (b.back - a.back) || (a.y - b.y));
    return { trunk, ax, ay, clumps, flex, trunkFlex, sw: Math.min(sw, 30) };
  }
  function treeRec(kind, seed) {
    const k = kind + '|' + seed;
    let r = treeCache.get(k);
    if (!r) { if (treeCache.size > 400) treeCache.clear(); r = buildTree(kind, seed); treeCache.set(k, r); }
    return r;
  }
  function drawRec(g, x, y, rec, s, t, flip, shadow) {
    const wv = wind(t, x), sk = wv * rec.flex * (flip ? -1 : 1), cl = rec.clumps, gust = 0.5 + Math.abs(wv);
    if (shadow) D.shadow(g, x, y + 1, rec.sw * s, 3.4 * s, 0.2);
    at(g, x, y, s, flip);
    let trunkDone = !rec.trunk;
    for (let i = 0; i < cl.length; i++) {
      const c = cl[i];
      if (!trunkDone && !c.back) {
        trunkDone = true;
        g.save(); g.transform(1, 0, -sk * rec.trunkFlex, 1, 0, 0); g.drawImage(rec.trunk, -rec.ax, -rec.ay); g.restore();
      }
      g.drawImage(c.cv, c.x - c.y * sk + Math.sin(t * 1.9 + c.ph) * c.amp * gust - c.cv.width / 2, c.y + Math.cos(t * 1.4 + c.ph * 1.7) * c.amp * 0.5 - c.cv.height / 2);
    }
    g.restore();
  }

  // Nature.tree(g, x, y, {kind:'pine'|'sakura'|'maple'|'bamboo'|'bonsai'|'round', s=1, seed=0, t=0, flip, shadow=true}):
  //   árvore única por semente; tronco inclina e cada gomo da copa balança com fase própria
  function tree(g, x, y, o) {
    o = o || NO;
    const kind = o.kind || 'round', seed = o.seed || 0;
    if (kind === 'bamboo') return bamboo(g, x, y, o);
    drawRec(g, x, y, treeRec(FOL[kind] || kind === 'bonsai' ? kind : 'round', seed), o.s || 1, o.t || 0,
      o.flip !== undefined ? !!o.flip : hash(seed, 77) < 0.5, o.shadow !== false);
  }
  // Nature.bush(g, x, y, {kind:'bush'|'azalea', s=1, seed=0, t=0, shadow=true}): moita gordinha (azalea = florida)
  function bush(g, x, y, o) {
    o = o || NO;
    drawRec(g, x, y, treeRec(o.kind === 'azalea' ? 'azalea' : 'bush', o.seed || 0), o.s || 1, o.t || 0, hash(o.seed || 0, 78) < 0.5, o.shadow !== false);
  }

  function leafSpray(v) {
    return sprite('bleaf' + v, 18, 13, P => {
      const rn = E.RNG('bl' + v);
      for (let i = 0; i < 4; i++) {
        const a = -0.9 + i * 0.5 + rn.range(-0.12, 0.12), len = rn.range(9, 13), tx = 2 + Math.cos(a) * len, ty = 6 + Math.sin(a) * len * 0.75;
        const nx = -Math.sin(a) * 1.5, ny = Math.cos(a) * 1.5, mx = 2 + Math.cos(a) * len * 0.45, my = 6 + Math.sin(a) * len * 0.34;
        P.tri(2, 6, mx + nx, my + ny, tx, ty, i % 2 ? C.leaf : C.grass).tri(2, 6, mx - nx, my - ny, tx, ty, i % 2 ? C.grass : C.grassL);
      }
    });
  }
  // touceira de bambu: colmos vetoriais que vergam no vento, com nós e ramos de folhas
  function bamboo(g, x, y, o) {
    const seed = o.seed || 0, s = o.s || 1, t = o.t || 0, n = 4 + ((hash(seed, 3) * 3) | 0);
    if (o.shadow !== false) D.shadow(g, x, y + 1, (n * 4 + 6) * s, 3.2 * s, 0.2);
    at(g, x, y, s, false);
    g.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const back = k % 2 === 0, bx = (k - (n - 1) / 2) * 6.5 + (hash(seed, k + 10) - 0.5) * 4, H = 62 + hash(seed, k + 20) * 44;
      const wv = wind(t, x + bx * 9), tip = (hash(seed, k + 30) - 0.5) * 16 + wv * H * 0.11 + Math.sin(t * 1.3 + k * 2.1) * 1.5;
      const cxm = bx + tip * 0.15, cym = -H * 0.55, col = back ? C.leaf : C.grass;
      g.beginPath(); g.moveTo(bx, 0); g.quadraticCurveTo(cxm, cym, bx + tip, -H);
      g.strokeStyle = LINE; g.lineWidth = 5; g.stroke();
      g.strokeStyle = col; g.lineWidth = 3; g.stroke();
      g.beginPath(); g.moveTo(bx - 0.8, -1); g.quadraticCurveTo(cxm - 0.8, cym, bx + tip - 0.6, -H + 1);
      g.strokeStyle = back ? C.grass : C.grassL; g.lineWidth = 0.9; g.stroke();
      const nodes = Math.floor(H / 11);
      for (let i = 1; i <= nodes; i++) {
        const q = i / (nodes + 0.3), u = 1 - q, px = u * u * bx + 2 * u * q * cxm + q * q * (bx + tip), py = 2 * u * q * cym + q * q * -H;
        g.fillStyle = LINE; g.fillRect(px - 2.2, py - 0.5, 4.4, 1);
        if (q > 0.42) {
          const lf = leafSpray((i + k) % 3), fl = (i + k) % 2 === 0, lx = Math.sin(t * 2.2 + i + k) * (0.6 + Math.abs(wv)) + wv * 2;
          g.save(); g.translate(px + lx * q, py - 1); g.scale(fl ? -1 : 1, 1); g.rotate((fl ? -1 : 1) * wv * 0.12 - 0.15); g.drawImage(lf, 0, -7); g.restore();
        }
      }
      const lf = leafSpray(k % 3), r = -1.2 + wv * 0.25;
      g.save(); g.translate(bx + tip, -H + 1); g.rotate(r); g.drawImage(lf, -1, -7); g.rotate(0.7); g.drawImage(lf, -1, -7); g.restore();
    }
    g.restore();
  }

  /* ---------- flores ---------- */
  const FLOWERS = {
    daisy: { h: 11, w: 11, fn(P) { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P.ell(5.5 + Math.cos(a) * 2.9, 5.5 + Math.sin(a) * 2.9, 1.6, 1.6, i > 0 && i < 4 ? C.riceS : C.white); } P.ell(5.5, 5.5, 1.9, 1.9, C.yel).set(5, 5, C.yelL).set(6, 6, C.yelD); } },
    tulip: { h: 12, w: 9, fn(P) { P.rrect(2, 2, 5, 6, 2, C.red).rect(2, 1, 1, 2, C.red).rect(4, 1, 1, 2, C.red).rect(6, 1, 1, 2, C.red).rect(3, 3, 1, 4, C.redL).rect(6, 3, 1, 4, C.redD).rect(3, 7, 3, 1, C.redD); } },
    tanpopo: { h: 8, w: 9, fn(P) { P.ell(4.5, 4.5, 3.3, 3.3, C.yel); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.3; P.set(4 + Math.round(Math.cos(a) * 3.4), 4 + Math.round(Math.sin(a) * 3.4), C.yel); } P.ell(3.8, 3.6, 1.6, 1.3, C.yelL).rect(4, 6, 3, 1, C.yelD).set(6, 5, C.yelD); } },
    iris: { h: 15, w: 11, fn(P) { P.ell(2.8, 6.4, 2.4, 1.9, C.bowl).ell(8.2, 6.4, 2.4, 1.9, C.bowl).ell(5.5, 3.2, 2.1, 2.8, C.bowlL).rect(5, 1, 1, 3, C.glass).rect(5, 5, 1, 3, C.yel).set(2, 6, C.bowlL).set(8, 6, C.bowlL).rect(4, 8, 3, 1, C.bowl); } },
    higanbana: { h: 16, w: 15, fn(P) { for (let i = 0; i < 8; i++) { const a = -PI * 0.96 + i * PI * 0.92 / 7, ex = 7 + Math.cos(a) * 6, ey = 7 + Math.sin(a) * 5.4; P.line(7, 7, ex, ey, 1, C.red).set(ex + (ex < 7 ? -1 : 1), ey - 1, C.redL); } P.ell(7.5, 7.2, 2.6, 2, C.red).set(7, 6, C.redL).rect(6, 8, 3, 1, C.redD); } },
    ajisai: { h: 9, w: 15, fn(P, v) { const a = v ? C.sakuraD : C.bowlL, b = v ? C.sakura : C.glass, c = v ? C.pink : C.bowl; P.ell(7.5, 6.5, 6, 5, a); P.shadeBelow(a, 0.25, 2); for (let y = 2; y < 11; y += 2) for (let x = 2 + (y & 2); x < 13; x += 3) if (P.get(x, y)) P.set(x, y, y < 6 ? b : c); P.set(5, 3, C.white).set(8, 4, C.white); } },
  };
  // Nature.flower(g, x, y, {kind:'daisy'|'tulip'|'tanpopo'|'iris'|'higanbana'|'ajisai', seed=0, t=0, s=1}): flor com caule que dobra no vento
  function flower(g, x, y, o) {
    o = o || NO;
    const kind = FLOWERS[o.kind] ? o.kind : 'daisy', F = FLOWERS[kind], seed = o.seed || 0, s = o.s || 1, t = o.t || 0, v = hash(seed, 4) < 0.5 ? 0 : 1;
    const head = sprite('fl' + kind + v, F.w, F.w - (kind === 'ajisai' ? 2 : 0), P => F.fn(P, v));
    const H = F.h * (0.85 + hash(seed, 5) * 0.35), bend = (wind(t, x) * 0.2 + Math.sin(t * 2.4 + seed) * 0.05) * H, lean = (hash(seed, 6) - 0.5) * 3;
    at(g, x, y, s, false);
    g.lineCap = 'round';
    if (kind === 'ajisai') {                                            // folhas largas na base
      g.fillStyle = LINE; g.beginPath(); g.ellipse(-5, -3, 5.6, 3.2, -0.4, 0, TAU); g.ellipse(5, -3, 5.6, 3.2, 0.4, 0, TAU); g.fill();
      g.fillStyle = C.leaf; g.beginPath(); g.ellipse(-5, -3, 4.5, 2.1, -0.4, 0, TAU); g.ellipse(5, -3, 4.5, 2.1, 0.4, 0, TAU); g.fill();
    }
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(lean, -H * 0.55, lean + bend, -H);
    g.moveTo(lean * 0.5, -H * 0.35); g.quadraticCurveTo(lean + 3, -H * 0.5, lean + 4.5 + bend * 0.4, -H * 0.42);
    if (kind !== 'tanpopo') { g.moveTo(lean * 0.4, -H * 0.25); g.quadraticCurveTo(lean - 3, -H * 0.36, lean - 4 + bend * 0.3, -H * 0.3); }
    g.strokeStyle = LINE; g.lineWidth = 3; g.stroke();
    g.strokeStyle = C.leaf; g.lineWidth = 1.3; g.stroke();
    g.drawImage(head, lean + bend - head.width / 2, -H - head.height * 0.62 + Math.sin(t * 2.1 + seed * 3) * 0.4);
    g.restore();
  }

  /* ---------- pedras ---------- */
  function rockSprite(w, h, seed, moss) {
    w = Math.max(5, Math.round(w)); h = Math.max(4, Math.round(h));
    return sprite('rock' + w + 'x' + h + '.' + seed + (moss ? 'm' : ''), w + 4, h + 4, P => {
      const rn = E.RNG('rock' + seed), cx = (w + 4) / 2, by = h + 2, lx = rn.range(-0.2, 0.2) * w;
      const draw = (c, dx, dy, k) => {
        P.ell(cx + dx, by - h * 0.48 + dy, w / 2 - k, h * 0.56 - k, c);
        P.ell(cx + lx + dx, by - h * 0.74 + dy, w * 0.3 - k, h * 0.28 - k * 0.6, c);
        P.ell(cx - lx * 1.6 + dx, by - h * 0.3 + dy, w * 0.36 - k, h * 0.3 - k * 0.6, c);
      };
      draw(C.stoneD, 0, 0, 0); draw(C.stone, -0.8, -1, 1.2);
      P.ell(cx + lx - w * 0.12, by - h * 0.8, w * 0.2, Math.max(1, h * 0.11), C.stoneL);
      P.erase(0, by, w + 4, 4);
      for (let i = 0; i < w * 0.5; i++) { const x = rn.int(2, w + 1), y = rn.int(2, by - 1); if (P.get(x, y)) P.set(x, y, rn.chance(0.6) ? C.stoneD : C.stoneL); }
      if (w > 12) { const x = Math.round(cx + rn.range(-0.2, 0.25) * w); P.line(x, by - h * 0.55, x + rn.int(-2, 2), by - h * 0.2, 1, C.stoneD); }
      if (moss) for (let x = 1; x < w + 3; x++) {
        if (hash(x, seed) > 0.72 || x > cx + w * 0.22) continue;
        for (let y = 0; y < by; y++) if (P.get(x, y)) { const n = 1 + ((hash(x, seed + 1) * 3) | 0); P.set(x, y, C.grassL); for (let k = 1; k <= n; k++) if (P.get(x, y + k)) P.set(x, y + k, k === n ? C.leaf : C.grass); break; }
      }
    });
  }
  // Nature.rock(g, x, y, {w=22, h=14, seed=0, moss=false, shadow=true, s=1}): pedra arredondada em 3 tons, com musgo opcional
  function rock(g, x, y, o) {
    o = o || NO;
    const w = o.w || 22, h = o.h || 14, s = o.s || 1, cv = rockSprite(w, h, o.seed || 0, !!o.moss);
    if (o.shadow !== false) D.shadow(g, x, y + 0.5, w * 0.56 * s, 2.6 * s, 0.2);
    at(g, x, y, s, hash(o.seed || 0, 9) < 0.5); blit(g, cv, 0, 2); g.restore();
  }

  /* ======================================================================
     5. Construções pequenas: torii, tōrō, chōchin, ponte, cercas, arrozal, barraquinha
     ====================================================================== */
  function toriiSprite() {
    return sprite('torii', 92, 82, P => {
      const gy = 80, cx = 46, curve = x => Math.round(3.4 * Math.pow(Math.abs(x - cx) / 42, 2.2));
      for (const sd of [-1, 1]) {
        const bx = cx + sd * 23, tx = cx + sd * 20;
        P.poly([[bx - 3.5, gy], [bx + 3.5, gy], [tx + 3, 16], [tx - 3, 16]], C.red);
        P.line(bx + 2.4, gy - 1, tx + 2, 17, 1.6, C.redD).line(bx - 3, gy - 1, tx - 3, 17, 1, C.redL);
        P.rect(bx - 5, gy - 7, 10, 7, C.blk).rect(bx - 5, gy - 7, 10, 1, C.blkL).rect(bx + 3, gy - 6, 2, 6, sh(C.blk, -0.35));
      }
      P.rect(cx - 33, 31, 66, 6, C.red).rect(cx - 33, 31, 66, 1, C.redL).rect(cx - 33, 36, 66, 1, C.redD);
      for (const sd of [-1, 1]) P.rect(cx + sd * 27 - 1, 30, 3, 8, C.redD).rect(cx + sd * 15 - 1, 30, 3, 8, C.redD);
      P.rect(cx - 5, 19, 10, 12, C.goldD).rect(cx - 4, 20, 8, 10, C.ink).rect(cx - 2, 22, 4, 1, C.gold).rect(cx - 1, 22, 1, 6, C.gold).rect(cx - 3, 25, 6, 1, C.gold).rect(cx + 1, 27, 2, 1, C.gold);
      for (let x = 5; x < 87; x++) {
        const c = curve(x);
        if (x >= 9 && x < 83) { P.rect(x, 15 - c, 1, 5, C.red); P.set(x, 15 - c, C.redL); P.set(x, 19 - c, C.redD); }
        P.rect(x, 10 - c, 1, 5, C.blk); P.set(x, 10 - c, C.blkL); P.set(x, 14 - c, sh(C.blk, -0.35));
      }
    });
  }
  // Nature.torii(g, x, y, s=1, {t=0, rope=true, shadow=true}): portal torii vermelho (84 de largura, 74 de altura) com shimenawa balançando
  function torii(g, x, y, s, o) {
    o = o || NO; s = s || 1;
    const t = o.t || 0, wv = wind(t, x);
    if (o.shadow !== false) { D.shadow(g, x - 23 * s, y + 1, 9 * s, 2.6 * s, 0.2); D.shadow(g, x + 23 * s, y + 1, 9 * s, 2.6 * s, 0.2); }
    at(g, x, y, s, false);
    blit(g, toriiSprite(), 0, 2);
    if (o.rope !== false) {
      const sag = 5 + Math.sin(t * 1.7) * 0.5, dx = wv * 1.5;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(-19, -42); g.quadraticCurveTo(dx, -42 + sag * 2, 19, -42);
      g.strokeStyle = LINE; g.lineWidth = 4.2; g.stroke();
      g.strokeStyle = C.sack; g.lineWidth = 2.2; g.stroke();
      for (let i = -1; i <= 1; i++) {                                    // shide: papel em zigue-zague
        const px = i * 10 + dx * 0.6, py = -42 + sag * (1 - i * i * 0.28) + 1, a = wv * 0.35 + Math.sin(t * 3 + i * 1.7) * 0.18;
        g.save(); g.translate(px, py); g.rotate(a);
        g.fillStyle = LINE; g.fillRect(-2.6, 0, 4.2, 4.6); g.fillRect(-1, 3, 4.2, 4.6); g.fillRect(-2.6, 6, 4.2, 4.6);
        g.fillStyle = C.rice; g.fillRect(-1.8, 0.4, 2.6, 3.4); g.fillRect(-0.2, 3.4, 2.6, 3.4); g.fillRect(-1.8, 6.4, 2.6, 3.4);
        g.restore();
      }
    }
    g.restore();
  }

  function toroSprite(lit) {
    return sprite('toro' + (lit ? 'L' : ''), 34, 58, P => {
      const S = C.stone, Sd = C.stoneD, Sl = C.stoneL, o = 3, cx = 17;
      vol(P, 7, 49 + o, 20, 4, S, Sd, Sl); vol(P, 10, 46 + o, 14, 3, S, Sd, Sl);
      vol(P, 14, 27 + o, 6, 19, S, Sd, Sl); P.rect(13, 35 + o, 8, 2, Sd).rect(13, 35 + o, 8, 1, S);
      vol(P, 8, 23 + o, 18, 4, S, Sd, Sl); P.rect(11, 27 + o, 12, 1, Sd);
      vol(P, 10, 12 + o, 14, 11, S, Sd, Sl);
      P.rect(13, 14 + o, 8, 7, lit ? C.goldL : C.ink);
      if (lit) P.rect(14, 15 + o, 6, 5, '#FFF8D2'); else P.rect(13, 14 + o, 8, 2, sh(C.ink, -0.3));
      P.rect(16, 14 + o, 2, 7, lit ? C.gold : Sd).rect(13, 17 + o, 8, 1, lit ? C.gold : Sd);
      P.poly([[3, 12 + o], [31, 12 + o], [28, 9 + o], [21, 5 + o], [13, 5 + o], [6, 9 + o]], S);
      P.rect(2, 10 + o, 2, 2, S).rect(30, 10 + o, 2, 2, S).set(1, 9 + o, S).set(32, 9 + o, S);
      P.rect(4, 11 + o, 26, 1, Sd).line(21, 6 + o, 28, 10 + o, 1.6, Sd).line(13, 5 + o, 6, 9 + o, 1, Sl).rect(13, 5 + o, 8, 1, Sl);
      P.ell(cx, 3.4 + o, 2.4, 2.4, S).rect(16, o - 1, 2, 2, S).set(16, 2 + o, Sl).set(18, 4 + o, Sd);
      for (const m of [[5, 9], [7, 8], [8, 8], [11, 6], [12, 6], [9, 49], [10, 49], [11, 48], [14, 45]]) P.set(m[0], m[1] + o, C.grass);
      P.set(6, 9 + o, C.grassL).set(10, 48 + o, C.grassL);
    });
  }
  // Nature.lantern(g, x, y, s=1, {lit, t=0, shadow=true}): tōrō de pedra com musgo; aceso tem janela dourada e halo que tremula (lit padrão: acende à noite)
  function lantern(g, x, y, s, o) {
    o = o || NO; s = s || 1;
    const lit = litOf(o), t = o.t || 0;
    if (o.shadow !== false) D.shadow(g, x, y + 1, 13 * s, 3 * s, 0.2);
    at(g, x, y, s, false); blit(g, toroSprite(lit > 0.4), 0, 2); g.restore();
    if (lit > 0.05) queueGlow(g, x, y - 36 * s, (30 + Math.sin(t * 9) * 1.5 + Math.sin(t * 23) * 1) * s, '#FFC766', lit * 0.85);
  }

  function chochinSprite(col, lit) {
    return sprite('cho' + col + (lit ? 'L' : ''), 14, 19, P => {
      const b = lit ? U.mixCss(col, C.yel, 0.35) : col;
      P.ell(7, 9.5, 5, 6, b);
      for (let y = 5; y <= 14; y += 3) for (let x = 1; x < 13; x++) if (P.get(x, y)) P.set(x, y, sh(col, -0.25));
      P.rect(3, 6, 1, 6, sh(b, 0.35));
      if (lit) P.ell(7, 9.5, 2.3, 3.4, C.yelL);
      P.rect(4, 2, 6, 2, C.blk).rect(4, 15, 6, 2, C.blk).rect(4, 2, 6, 1, C.blkL).rect(6, 17, 2, 1, C.gold);
    });
  }
  // Nature.chochin(g, x, y, {t=0, lit, s=1, col=vermelho, seed=0}): lanterna de papel pendurada em (x,y), balança no vento
  function chochin(g, x, y, o) {
    o = o || NO;
    const lit = litOf(o), t = o.t || 0, s = o.s || 1, sd = o.seed || 0, a = wind(t, x) * 0.22 + Math.sin(t * 2.3 + sd * 1.9) * 0.07;
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s); g.imageSmoothingEnabled = false;
    g.fillStyle = LINE; g.fillRect(-0.5, 0, 1, 3);
    g.drawImage(chochinSprite(o.col || C.red, lit > 0.4), -7, 1);
    g.restore();
    if (lit > 0.05) queueGlow(g, x - Math.sin(a) * 11 * s, y + 11 * s, 20 * s, '#FF9A52', lit * 0.75);
  }

  // Nature.bridgeY(px, x, w, arch) -> altura do tabuleiro (negativa) no ponto px de uma ponte que começa em x: pra andar por cima
  function bridgeY(px, x, w, arch) {
    const u = U.clamp((px - x - w / 2) / (w / 2), -1, 1);
    return -(arch === undefined ? w * 0.2 : arch) * (1 - u * u);
  }
  // Nature.bridge(g, x, y, w, {arch=w*.2, drop=6, shadow=true}): ponte vermelha arqueada (taikobashi) de x a x+w, com corrimão e giboshi dourados
  function bridge(g, x, y, w, o) {
    o = o || NO;
    w = Math.max(30, Math.round(w));
    const arch = Math.round(o.arch === undefined ? w * 0.2 : o.arch), drop = o.drop === undefined ? 6 : o.drop;
    const H = arch + 18 + drop, gy = arch + 15;
    const cv = sprite('bridge' + w + '.' + arch + '.' + drop, w + 6, H, P => {
      const dy = xx => Math.round(gy + bridgeY(xx, 0, w, arch)) - 1;
      for (const u of [0.24, 0.76]) {                                     // estacas
        const px = Math.round(w * u) + 3, y0 = dy(w * u) + 4;
        P.rect(px - 2, y0, 4, gy + drop - y0, C.woodD).rect(px - 2, y0, 1, gy + drop - y0, C.wood).rect(px + 1, y0, 1, gy + drop - y0, sh(C.woodD, -0.3));
      }
      for (let i = 0; i <= w; i++) {
        const X = i + 3, yt = dy(i);
        P.rect(X, yt + 4, 1, 2, sh(C.woodD, -0.2)).rect(X, yt, 1, 4, C.red).set(X, yt, C.redL).set(X, yt + 3, C.redD);
        P.rect(X, yt - 9, 1, 2, C.red).set(X, yt - 9, C.redL).set(X, yt - 5, C.redD);
      }
      const n = Math.max(3, Math.round(w / 15));
      for (let k = 0; k <= n; k++) {
        const i = Math.round(k / n * w), X = i + 3, yt = dy(i), end = k === 0 || k === n, hh = end ? 13 : 11;
        P.rect(X - 1, yt - hh, 3, hh + (end ? 5 : 1), C.red).rect(X + 1, yt - hh, 1, hh, C.redD).rect(X - 1, yt - hh, 1, hh, C.redL);
        P.ell(X + 0.5, yt - hh - 1.3, 2, 2, C.gold).set(X, yt - hh - 3, C.gold).set(X, yt - hh - 2, C.goldL).rect(X - 1, yt - hh, 3, 1, C.goldD);
      }
    });
    if (o.shadow !== false) D.shadow(g, x + w / 2, y + 1.5, w * 0.5, 3, 0.16);
    g.imageSmoothingEnabled = D.zoom < 0.75;
    g.drawImage(cv, x - 3, y - gy);
  }

  // Nature.fence(g, x0, x1, y, {kind:'bamboo'|'wood'}): cerca de x0 a x1 (bambu amarrado yotsume-gaki, ou tábuas escuras)
  function fence(g, x0, x1, y, o) {
    o = o || NO;
    const len = Math.max(8, Math.round(x1 - x0)), kind = o.kind === 'wood' ? 'wood' : 'bamboo';
    const cv = sprite('fence' + kind + len, len + 2, 26, P => {
      if (kind === 'bamboo') {
        for (const ry of [8, 16]) P.rect(1, ry, len, 3, C.sack).rect(1, ry, len, 1, sh(C.sack, 0.4)).rect(1, ry + 2, len, 1, C.sackD);
        for (let x = 3; x < len - 2; x += 7) {
          const top = 3 + ((hash(x, 5) * 3) | 0);
          P.rect(x, top, 3, 24 - top, C.grass).rect(x, top, 1, 24 - top, C.grassL).rect(x + 2, top, 1, 24 - top, C.leaf).rect(x, top, 3, 1, C.grassL);
          P.rect(x, 12, 3, 1, C.leafD).rect(x - 1, 8, 5, 3, C.blk).rect(x - 1, 16, 5, 3, C.blk).set(x, 8, C.blkL).set(x, 16, C.blkL);
        }
      } else {
        for (let x = 1; x < len; x += 5) {
          const top = 5 + ((hash(x, 6) * 2) | 0), wd = Math.min(4, len - x + 1);
          P.rect(x, top, wd, 24 - top, C.wood).rect(x, top, 1, 24 - top, C.woodL).rect(x + wd - 1, top, 1, 24 - top, C.woodD).rect(x, top, wd, 1, C.woodL);
          if (hash(x, 7) < 0.3) P.set(x + 1, 12 + ((hash(x, 8) * 8) | 0), C.woodD);
        }
        P.rect(1, 8, len, 2, C.woodD).rect(1, 8, len, 1, sh(C.woodD, 0.25)).rect(1, 18, len, 2, C.woodD);
        for (let x = 1; x < len; x += 30) vol(P, Math.min(x, len - 3), 2, 4, 22, sh(C.woodD, -0.1), sh(C.woodD, -0.4), C.wood);
        vol(P, len - 3, 2, 4, 22, sh(C.woodD, -0.1), sh(C.woodD, -0.4), C.wood);
      }
    });
    g.imageSmoothingEnabled = D.zoom < 0.75;
    g.drawImage(cv, x0 - 1, y - 24);
  }

  // Nature.paddy(g, x, y, w, h=18, {t=0, seed=0}): arrozal alagado (canto de cima/esquerda em x,y): taipas de terra, água que reflete o céu e mudas no vento
  function paddy(g, x, y, w, h, o) {
    o = o || NO; h = h || 18;
    const t = o.t || 0, st = light(), seed = o.seed || 0, earth = U.mixCss(C.woodD, C.sand, 0.25);
    g.fillStyle = LINE; g.fillRect(x - 5, y - 3.5, w + 10, h + 9.5);
    g.fillStyle = earth; g.fillRect(x - 4, y - 2.5, w + 8, h + 7.5);
    g.fillStyle = sh(earth, 0.25); g.fillRect(x - 4, y - 2.5, w + 8, 1.5);
    g.fillStyle = U.mixCss(C.water, st.mid, 0.45); g.fillRect(x, y, w, h);
    g.fillStyle = U.mixCss(C.waterD, st.top, 0.3); g.fillRect(x, y + h * 0.62, w, h * 0.38);
    g.fillStyle = U.rgba(st.cloud, 0.55);                              // reflexos do céu andando devagar
    for (let i = 0; i < w / 22; i++) {
      const rx = x + U.wrap(hash(i, seed) * w + t * (3 + hash(i, seed + 1) * 4), 0, w - 12), ry = y + 2 + hash(i, seed + 2) * (h - 5), rw = 5 + hash(i, seed + 3) * 9 + Math.sin(t * 1.5 + i) * 2;
      g.fillRect(rx, ry, rw, 1);
    }
    g.fillStyle = sh(earth, -0.3); g.fillRect(x, y, w, 1.5);          // sombra da taipa de trás
    const rows = Math.max(2, Math.floor(h / 6));
    for (let r = 0; r < rows; r++) {
      const ry = y + 4.5 + r * (h - 5) / (rows - 1 || 1), sp = 7 + r * 1.5, sc = 0.36 + r * 0.1;
      for (let px = x + 4 + (r % 2) * sp * 0.5; px < x + w - 3; px += sp) {
        g.fillStyle = U.rgba(C.waterD, 0.55); g.fillRect(px - 2.5 * sc, ry, 5 * sc, 1);
        TUFT_O.seed = px * 3 + r; TUFT_O.t = t; TUFT_O.s = sc; TUFT_O.col = C.grassL; TUFT_O.n = 3;
        grassTuft(g, px, ry, TUFT_O);
      }
    }
    TUFT_O.n = 0; TUFT_O.col = null; TUFT_O.s = 1;
    g.fillStyle = sh(earth, -0.22); g.fillRect(x - 4, y + h + 3, w + 8, 2);
    g.fillStyle = C.grass; g.fillRect(x - 4, y + h, w + 8, 1.6);
    g.fillStyle = C.grassL; g.fillRect(x - 4, y + h, w + 8, 0.7);
  }

  function stallSprite(col) {
    return sprite('stall' + col, 78, 72, P => {
      const cr = C.cream, dk = sh(C.woodD, -0.5);
      P.rect(12, 22, 54, 26, dk).rect(12, 38, 54, 2, C.woodD);
      P.rect(16, 30, 4, 8, C.bowl).rect(17, 28, 2, 2, C.bowlL).rect(22, 32, 3, 6, C.red).rect(27, 29, 4, 9, C.goldD).rect(28, 30, 1, 6, C.gold)
        .rect(34, 33, 6, 5, C.sackD).rect(43, 30, 3, 8, C.leaf).rect(48, 31, 5, 7, C.riceS).rect(55, 29, 4, 9, C.oraD).rect(56, 30, 1, 5, C.ora);
      vol(P, 10, 14, 3, 34, C.woodD, sh(C.woodD, -0.3), C.wood); vol(P, 65, 14, 3, 34, C.woodD, sh(C.woodD, -0.3), C.wood);
      P.rect(10, 50, 58, 19, C.wood).rect(10, 50, 58, 2, C.woodD).rect(10, 67, 58, 2, C.woodD);
      for (let x = 16; x < 68; x += 8) P.rect(x, 52, 1, 15, C.woodD).rect(x + 1, 52, 1, 15, C.woodL);
      vol(P, 7, 46, 64, 4, C.woodL, C.wood, sh(C.woodL, 0.4));
      for (const x of [14, 23]) P.tri(x, 46, x + 8, 46, x + 4, 39, C.rice).rect(x + 1, 44, 6, 2, C.rice).rect(x + 2, 43, 4, 3, '#2E3B2A').set(x + 3, 41, C.riceS);
      for (const x of [36, 41]) P.rect(x, 37, 1, 9, C.woodL).ell(x + 0.5, 39, 2, 2, C.sakura).ell(x + 0.5, 42, 2, 2, C.white).ell(x + 0.5, 45, 2, 2, C.grassL);
      P.ell(55, 44, 6, 3, C.bowl).rect(50, 42, 10, 1, C.bowlL).ell(55, 41.5, 4, 1.5, C.rice);
      P.rect(9, 5, 60, 2, C.woodD);
      for (let x = 3; x < 75; x++) {
        const y0 = x < 10 ? Math.round(24 - (x - 3) / 7 * 17) : x > 67 ? Math.round(24 - (74 - x) / 7 * 17) : 7, st2 = Math.floor((x - 3) / 8) % 2, c = st2 ? cr : col;
        P.rect(x, y0, 1, 24 - y0, c).set(x, y0, sh(c, 0.4)).rect(x, 21, 1, 3, sh(c, -0.18));
        const q = (x - 3) % 8, dp = q === 0 || q === 7 ? 2 : q === 1 || q === 6 ? 4 : 5, c2 = st2 ? col : cr;
        P.rect(x, 24, 1, dp, c2).set(x, 24 + dp - 1, sh(c2, -0.2));
      }
    });
  }
  // Nature.nobori(g, x, y, {t=0, col=vermelho, h=58, s=1}): bandeira vertical de feira num mastro de bambu, pano ondulando
  function nobori(g, x, y, o) {
    o = o || NO;
    const t = o.t || 0, col = o.col || C.red, H = o.h || 58, s = o.s || 1, wv = wind(t, x), bw = 11, bh = H * 0.62;
    at(g, x, y, s, false);
    g.lineCap = 'round';
    g.strokeStyle = LINE; g.lineWidth = 3.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -H); g.moveTo(-1, -H + 2); g.lineTo(bw + 2, -H + 2); g.stroke();
    g.strokeStyle = C.sack; g.lineWidth = 1.6; g.stroke();
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath(); g.moveTo(1.5, -H + 3); g.lineTo(bw + 1, -H + 3);
      for (let i = 1; i <= 6; i++) { const q = i / 6; g.lineTo(bw + 1 + Math.sin(t * 4 - q * 4) * (1 + Math.abs(wv)) * 1.6 * q + wv * 2 * q, -H + 3 + bh * q); }
      g.lineTo(1.5 + wv * 0.8, -H + 3 + bh); g.closePath();
      if (!pass) { g.strokeStyle = LINE; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke(); g.fillStyle = col; g.fill(); }
      else { g.save(); g.clip(); g.fillStyle = sh(col, -0.2); g.fillRect(0, -H + 3 + bh - 5, bw + 8, 6); g.fillStyle = C.cream; g.fillRect(4, -H + 8, 5, 5); g.fillRect(5.5, -H + 16, 2, 12); g.fillRect(3.5, -H + 21, 6, 2); g.restore(); }
    }
    g.restore();
  }
  // Nature.stall(g, x, y, {t=0, lit, col=vermelho, lanterns=true, s=1}): barraquinha de feira com toldo listrado, onigiri e dango no balcão, chōchin balançando
  function stall(g, x, y, o) {
    o = o || NO;
    const s = o.s || 1, t = o.t || 0, col = o.col || C.red;
    if (o.shadow !== false) D.shadow(g, x, y + 1, 36 * s, 4 * s, 0.2);
    at(g, x, y, s, false);
    blit(g, stallSprite(col), 0, 3);
    if (litOf(o) > 0.3) { g.fillStyle = 'rgba(255,214,130,.28)'; g.fillRect(-27, -47, 54, 24); }
    g.restore();
    if (o.lanterns !== false) {
      const lt = o.lit; chochin(g, x - 30 * s, y - 41 * s, so(t, s, 1, undefined, lt)); chochin(g, x + 30 * s, y - 41 * s, so(t, s, 2, undefined, lt));
    }
    if (litOf(o) > 0.05) queueGlow(g, x, y - 34 * s, 44 * s, '#FFC766', litOf(o) * 0.5);
  }

  /* ---------- koinobori e fūrin ---------- */
  const KX = new Float32Array(12), KY = new Float32Array(12);
  function carp(g, x, y, L, col, t, ph, wv) {
    const N = 10, blow = U.clamp(0.72 + wv * 0.4, 0.2, 1), droop = (1 - blow) * 1.1, ca = Math.cos(droop), sa = Math.sin(droop);
    for (let i = 0; i <= N; i++) {
      const q = i / N, wob = Math.sin(t * 7 - q * 5 + ph) * (1.2 + 3.2 * blow) * q;
      KX[i] = x + (ca * L * q - sa * wob * 0.3); KY[i] = y + sa * L * q + wob * ca;
    }
    const hw = q => L * (q < 0.12 ? 0.11 + q * 0.5 : q < 0.82 ? 0.17 - (q - 0.12) * 0.1 : 0.1 + (q - 0.82) * 0.55);
    g.beginPath();
    for (let i = 0; i <= N; i++) { const yy = KY[i] - hw(i / N); if (i) g.lineTo(KX[i], yy); else g.moveTo(KX[i], yy); }
    g.lineTo(KX[N] - L * 0.08, KY[N]);
    for (let i = N; i >= 0; i--) g.lineTo(KX[i], KY[i] + hw(i / N));
    g.closePath();
    g.strokeStyle = LINE; g.lineWidth = 2.4; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = col; g.fill();
    g.save(); g.clip();
    g.fillStyle = C.cream;                                             // barriga clara
    g.beginPath(); g.moveTo(KX[0], KY[0] + L * 0.04);
    for (let i = 1; i <= 8; i++) g.lineTo(KX[i], KY[i] + hw(i / N) * 0.35);
    for (let i = 8; i >= 0; i--) g.lineTo(KX[i], KY[i] + L * 0.3);
    g.fill();
    g.strokeStyle = sh(col, 0.45); g.lineWidth = 1;                    // escamas
    g.beginPath();
    for (let i = 3; i <= 8; i++) for (let k = -1; k <= 0; k++) { const r = L * 0.05, cx = KX[i], cy = KY[i] + k * r * 1.5 - (i % 2) * r * 0.7; g.moveTo(cx, cy - r); g.arc(cx - r * 0.2, cy, r, -PI / 2, PI / 2); }
    g.stroke();
    g.fillStyle = sh(col, -0.3); g.fillRect(KX[9] - 1, KY[9] - L * 0.3, L * 0.3, L * 0.6);
    g.fillStyle = C.cream; g.fillRect(KX[0] - 1, KY[0] - L * 0.3, L * 0.07, L * 0.6);
    g.restore();
    const ex = KX[1] + L * 0.02, ey = KY[1] - L * 0.03;
    g.fillStyle = LINE; g.beginPath(); g.arc(ex, ey, L * 0.062, 0, TAU); g.fill();
    g.fillStyle = C.white; g.beginPath(); g.arc(ex, ey, L * 0.045, 0, TAU); g.fill();
    g.fillStyle = C.ink; g.beginPath(); g.arc(ex + L * 0.008, ey, L * 0.022, 0, TAU); g.fill();
  }
  // Nature.koinobori(g, x, y, {t=0, h=104, s=1}): mastro com cata-vento, fitas e três carpas de pano (preta, vermelha, azul) nadando no vento
  function koinobori(g, x, y, o) {
    o = o || NO;
    const t = o.t || 0, H = o.h || 104, s = o.s || 1, wv = wind(t, x) + 0.35;
    if (o.shadow !== false) D.shadow(g, x, y + 1, 7 * s, 2.4 * s, 0.2);
    at(g, x, y, s, false);
    g.lineCap = 'round';
    g.strokeStyle = LINE; g.lineWidth = 4.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -H); g.stroke();
    g.strokeStyle = C.woodL; g.lineWidth = 2.6; g.stroke();
    g.strokeStyle = C.wood; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0.9, 0); g.lineTo(0.9, -H); g.stroke();
    const cols = [C.red, C.yel, C.bowlL, C.grass, C.cream];              // fukinagashi: fitas
    for (let k = 0; k < 5; k++) {
      g.beginPath(); g.moveTo(2, -H + 9 + k * 1.6);
      for (let i = 1; i <= 6; i++) { const q = i / 6, bl = U.clamp(0.6 + wv * 0.45, 0.2, 1); g.lineTo(2 + 30 * q * bl, -H + 9 + k * 1.6 + (1 - bl) * 26 * q + Math.sin(t * 8 - q * 5 + k * 0.9) * 3 * q); }
      g.strokeStyle = LINE; g.lineWidth = 2.8; g.stroke(); g.strokeStyle = cols[k]; g.lineWidth = 1.5; g.stroke();
    }
    carp(g, 2, -H + 62, 30, C.bowlL, t, 3.1, wv); carp(g, 2, -H + 45, 38, C.red, t, 1.7, wv); carp(g, 2, -H + 26, 46, C.blk, t, 0, wv);
    const a = t * (2.5 + wv * 5);                                        // yaguruma: cata-vento
    g.strokeStyle = LINE; g.lineWidth = 3;
    g.beginPath(); for (let i = 0; i < 6; i++) { g.moveTo(0, -H - 3); g.lineTo(Math.cos(a + i * TAU / 6) * 6.5, -H - 3 + Math.sin(a + i * TAU / 6) * 6.5); } g.stroke();
    g.strokeStyle = C.gold; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = LINE; g.beginPath(); g.arc(0, -H - 3, 2.8, 0, TAU); g.fill();
    g.fillStyle = C.goldL; g.beginPath(); g.arc(0, -H - 3, 1.8, 0, TAU); g.fill();
    g.restore();
  }

  // Nature.windchime(g, x, y, {t=0, s=1, seed=0, col}): fūrin de vidro pendurado em (x,y); o sino balança e o papel (tanzaku) rodopia no vento
  function windchime(g, x, y, o) {
    o = o || NO;
    const t = o.t || 0, s = o.s || 1, sd = o.seed || 0, wv = wind(t, x);
    const a = wv * 0.12 + Math.sin(t * 2.1 + sd) * 0.05, a2 = wv * 0.55 + Math.sin(t * 3.3 + sd * 2) * 0.22;
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(a);
    g.fillStyle = LINE; g.fillRect(-0.5, 0, 1, 5);
    g.beginPath(); g.moveTo(-6.2, 12.2); g.lineTo(-6.2, 9); g.quadraticCurveTo(-6, 3.6, 0, 3.6); g.quadraticCurveTo(6, 3.6, 6.2, 9); g.lineTo(6.2, 12.2); g.closePath();
    g.fillStyle = LINE; g.fill();
    g.beginPath(); g.moveTo(-5, 11.2); g.lineTo(-5, 9); g.quadraticCurveTo(-4.8, 4.8, 0, 4.8); g.quadraticCurveTo(4.8, 4.8, 5, 9); g.lineTo(5, 11.2); g.closePath();
    g.fillStyle = o.col || C.glass; g.fill();
    g.fillStyle = C.waterL; g.fillRect(-3.6, 6, 1.4, 3.4);
    g.fillStyle = C.red; g.fillRect(0.4, 7.4, 2.2, 1.6); g.fillRect(2.6, 6.8, 1, 1); g.fillStyle = C.pink; g.fillRect(-1.6, 9.2, 1.4, 1);
    g.fillStyle = C.glassD; g.fillRect(-5, 10.2, 10, 1);
    g.translate(0, 9); g.rotate(a2 - a);
    g.fillStyle = LINE; g.fillRect(-0.5, 0, 1, 9);
    g.fillStyle = C.goldD; g.fillRect(-1.2, 2.6, 2.4, 1.6);
    g.fillStyle = LINE; g.fillRect(-3.2, 8.4, 6.4, 15.2);
    g.fillStyle = C.cream; g.fillRect(-2.2, 9.4, 4.4, 13.2);
    g.fillStyle = C.red; g.fillRect(-2.2, 10.6, 4.4, 1.4);
    g.fillStyle = C.bowlL; g.fillRect(-0.6, 14, 1.2, 6);
    g.restore();
  }

  /* ======================================================================
     6. Casa japonesa em estágios (0 terreno .. 5 mansão) + jardim + onsen
     ====================================================================== */
  const HW = 224, HH = 174, HGY = 170, HCX = 112;
  const TILE = C.steelD, TILE_D = C.grayD, TILE_L = C.steel;
  const HOUSE_NAMES = ['Terreno', 'Fundação', 'Estrutura de hinoki', 'Telhado kawara', 'Casa pronta com jardim', 'Mansão com onsen'];

  // telhado de telhas kawara visto de frente: beiral curvo, fiadas, cumeeira e shachihoko dourados
  function tileRoof(P, cx, eaveY, half, rise, ridgeHalf, o) {
    const NR = Math.round(half / 5);
    for (let row = 0; row <= rise; row++) {
      const hw = Math.round(ridgeHalf + (half - ridgeHalf) * Math.pow(1 - row / rise, 1.55)), y = eaveY - row, course = row % 5 === 0;
      P.rect(cx - hw, y, hw * 2, 1, course ? TILE_D : TILE);
      if (!course) for (let k = -NR; k <= NR; k++) { const x = Math.round(cx + hw * k / (NR + 0.5)); P.set(x, y, TILE_L); if (row % 5 > 1) P.set(x + 1, y, TILE_D); }
      else P.rect(cx - hw, y - 0, 1, 1, TILE_D);
    }
    P.rect(cx - half - 1, eaveY + 1, half * 2 + 2, 2, TILE_D);
    for (let x = cx - half + 1; x < cx + half; x += 4) P.set(x, eaveY + 1, C.grayL);
    for (const sd of [-1, 1]) P.line(cx + sd * half, eaveY + 1, cx + sd * (half + 5), eaveY - 3, 2, TILE_D).set(cx + sd * (half + 5), eaveY - 4, TILE_L);
    P.rect(cx - half + 5, eaveY + 3, half * 2 - 10, 2, C.woodD);
    for (let x = cx - half + 6; x < cx + half - 5; x += 4) P.set(x, eaveY + 3, C.woodL);
    if (o.flat) { P.rect(cx - ridgeHalf, eaveY - rise - 1, ridgeHalf * 2, 1, TILE_D); return; }
    const ry = eaveY - rise - 4;
    P.rect(cx - ridgeHalf - 2, ry, ridgeHalf * 2 + 4, 4, TILE_D).rect(cx - ridgeHalf - 2, ry, ridgeHalf * 2 + 4, 1, C.grayL);
    for (let x = cx - ridgeHalf; x < cx + ridgeHalf; x += 3) P.set(x, ry + 2, sh(TILE_D, -0.3));
    for (const sd of [-1, 1]) {
      const ex = cx + sd * (ridgeHalf + 2);
      vol(P, ex - 3, ry - 3, 6, 8, C.gray, TILE_D, C.grayL);
      if (o.shachi) P.rect(ex - 2, ry - 7, 4, 4, C.gold).line(ex, ry - 6, ex - sd * 3, ry - 12, 2, C.gold).set(ex - sd * 4, ry - 13, C.goldL).set(ex - sd * 3, ry - 13, C.gold).set(ex + sd, ry - 6, C.ink).rect(ex - 2, ry - 4, 4, 1, C.goldD).set(ex - sd, ry - 9, C.goldL);
    }
    if (o.gable) {                                                     // frontão no meio da água
      const gy0 = eaveY - 3, gh = Math.round(rise * 0.5);
      P.tri(cx - gh - 3, gy0, cx + gh + 3, gy0, cx, gy0 - gh - 3, TILE_D).tri(cx - gh, gy0, cx + gh, gy0, cx, gy0 - gh, TILE)
        .tri(cx - gh + 4, gy0, cx + gh - 4, gy0, cx, gy0 - gh + 4, C.cream).rect(cx - gh + 4, gy0 - 1, gh * 2 - 8, 1, C.riceD)
        .rect(cx - 2, gy0 - 8, 4, 5, o.lit ? C.goldL : C.ink).rect(cx - 3, gy0 - 9, 6, 1, C.woodD).rect(cx - gh - 3, gy0, gh * 2 + 6, 1, TILE_D);
    }
  }
  function shoji(P, x, y, w, h, lit, shadowDog) {
    P.rect(x - 1, y - 1, w + 2, h + 2, C.woodD).rect(x, y, w, h, lit ? '#FFE7A0' : C.rice);
    if (lit) P.rect(x + 2, y + 2, w - 4, h - 4, '#FFF3C4'); else P.rect(x, y + Math.round(h * 0.62), w, h - Math.round(h * 0.62), C.riceS);
    if (lit && shadowDog) {                                            // silhueta de shiba atrás do papel
      const sx = x + Math.round(w * 0.5), sy = y + h - 1, cs = '#D9A860';
      P.ell(sx, sy - 7, 5, 5, cs).tri(sx - 5, sy - 9, sx - 2, sy - 11, sx - 5, sy - 15, cs).tri(sx + 5, sy - 9, sx + 2, sy - 11, sx + 5, sy - 15, cs).rect(sx - 4, sy - 3, 8, 4, cs);
    }
    const kc = lit ? C.goldD : C.wood, nv = Math.max(2, Math.round(w / 6));
    for (let i = 1; i < nv; i++) P.rect(x + Math.round(i * w / nv), y, 1, h, kc);
    for (let j = 6; j < h - 2; j += 7) P.rect(x, y + j, w, 1, kc);
    P.rect(x + Math.round(w / 2), y, 1, h, C.woodD);
  }
  // um pavimento: reboco creme, lambri de madeira, pilares e os vãos [x0,x1,tipo]
  function wallFloor(P, bays, yT, yB, o) {
    const x0 = bays[0][0], x1 = bays[bays.length - 1][1], w = x1 - x0, wy = yB - 10, dk = sh(C.woodD, -0.55);
    P.rect(x0, yT, w, yB - yT, C.cream).rect(x0, yT, w, 5, C.riceD).rect(x0, yT + 5, w, 2, C.riceS);
    P.rect(x0, wy, w, 10, C.wood).rect(x0, wy, w, 1, C.woodL);
    for (let x = x0 + 2; x < x1; x += 4) P.rect(x, wy + 1, 1, 9, C.woodD);
    for (const b of bays) {
      const a = b[0] + 2, bw = b[1] - b[0] - 3, ty = b[2];
      if (ty === 'shoji') shoji(P, a + 1, yT + 9, bw - 2, wy - yT - 11, o.lit, b[3]);
      else if (ty === 'door') {
        P.rect(a, yT + 9, bw, yB - yT - 9, o.lit ? '#8A5A2E' : dk);
        if (o.open) { shoji(P, a + 1, yT + 10, Math.round(bw * 0.42), yB - yT - 11, o.lit); if (o.lit) P.rect(a + Math.round(bw * 0.5), yB - 9, bw - Math.round(bw * 0.5), 9, '#B07A3C'); }
        else { shoji(P, a + 1, yT + 10, bw - 2, yB - yT - 11, o.lit); }
      } else if (ty === 'round') {
        const mx = (b[0] + b[1]) / 2 + 0.5, my = (yT + wy) / 2 + 3, r = Math.min(10, (wy - yT) / 2 - 4);
        P.ell(mx, my, r + 1.5, r + 1.5, C.woodD).ell(mx, my, r, r, o.lit ? '#FFE7A0' : C.rice);
        if (o.lit) P.ell(mx, my, r - 2, r - 2, '#FFF3C4');
        P.rect(mx - r, my, r * 2, 1, o.lit ? C.goldD : C.wood).rect(mx - 0.5, my - r, 1, r * 2, o.lit ? C.goldD : C.wood)
          .line(mx - r + 2, my + r - 3, mx + 2, my - 3, 1, C.woodD).line(mx - 1, my, mx + 4, my - 5, 1, C.woodD).set(mx + 5, my - 6, C.sakuraD).set(mx + 2, my - 4, C.sakuraD).set(mx - 3, my + 3, C.sakuraD);
      } else P.rect(b[0], yT + 18, b[1] - b[0], 2, C.woodD).rect(b[0], yT + 18, b[1] - b[0], 1, C.wood);
    }
    for (const b of bays) for (const px of [b[0], b[1]]) P.rect(px - 1, yT, 3, yB - yT, C.woodD).rect(px - 1, yT + 5, 1, yB - yT - 5, C.wood);
    P.rect(x0 - 2, yT, w + 4, 3, C.woodD).rect(x0 - 1, yB - 2, w + 2, 2, sh(C.woodD, -0.3));
  }
  function engawa(P, x0, x1, y, col) {
    const gy = HGY;
    P.rect(x0 + 3, y + 3, x1 - x0 - 6, gy - y - 3, sh(C.woodD, -0.6));
    for (let x = x0 + 4; x < x1 - 4; x += 17) P.rect(x, y + 3, 3, gy - y - 4, C.woodD).rect(x, y + 3, 1, gy - y - 4, C.wood).rect(x - 1, gy - 2, 5, 2, C.stone).rect(x - 1, gy - 2, 5, 1, C.stoneL);
    P.rect(x1 - 7, y + 3, 3, gy - y - 4, C.woodD).rect(x1 - 8, gy - 2, 5, 2, C.stone);
    P.rect(x0, y, x1 - x0, 4, col).rect(x0, y, x1 - x0, 1, sh(col, 0.4)).rect(x0, y + 3, x1 - x0, 1, sh(col, -0.3));
    for (let x = x0 + 9; x < x1; x += 11) P.set(x, y + 1, sh(col, -0.25)).set(x, y + 2, sh(col, -0.25));
  }
  function slab(P, rebar) {
    const gy = HGY;
    P.rect(48, gy - 4, 128, 4, C.stoneD).rect(48, gy - 4, 128, 1, C.stone);                      // sapata
    P.rect(52, gy - 12, 120, 9, C.stone).rect(52, gy - 12, 120, 3, C.stoneL).rect(52, gy - 5, 120, 1, C.stoneD);
    for (let x = 82; x < 170; x += 30) P.rect(x, gy - 9, 1, 5, C.stoneD);
    for (let i = 0; i < 30; i++) { const x = 54 + ((hash(i, 3) * 116) | 0), y = gy - 9 + ((hash(i, 4) * 5) | 0); P.set(x, y, hash(i, 5) < 0.5 ? C.stoneD : C.stoneL); }
    P.rect(126, gy - 8, 5, 3, C.stoneD).rect(127, gy - 5, 3, 1, C.stoneD).rect(124, gy - 10, 2, 2, C.stoneD).rect(127, gy - 11, 2, 2, C.stoneD).rect(130, gy - 11, 2, 2, C.stoneD).rect(132, gy - 9, 2, 2, C.stoneD);   // pegada do Kome
    P.rect(49, gy - 15, 3, 15, C.wood).rect(49, gy - 15, 1, 15, C.woodL).rect(172, gy - 15, 3, 15, C.wood).rect(174, gy - 15, 1, 15, C.woodD);
    if (rebar) for (const x of [58, 84, 100, 124, 140, 166]) P.rect(x, gy - 21, 1, 9, C.rust).rect(x + 2, gy - 19, 1, 7, C.rustD).set(x, gy - 21, C.ora);
  }
  function scaffold(P, x, yTop) {
    const gy = HGY, b = C.sack, bd = C.sackD;
    for (const px of [x, x + 16]) P.rect(px, yTop, 3, gy - yTop, b).rect(px + 2, yTop, 1, gy - yTop, bd).rect(px, yTop, 1, gy - yTop, sh(b, 0.4));
    for (let y = gy - 20; y > yTop + 4; y -= 22) {
      P.rect(x - 3, y, 25, 2, b).rect(x - 3, y + 1, 25, 1, bd).rect(x - 2, y - 2, 23, 2, C.woodL).rect(x - 2, y - 1, 23, 1, C.wood);
      P.rect(x - 1, y - 1, 5, 4, C.blk).rect(x + 15, y - 1, 5, 4, C.blk);
      P.line(x + 2, y + 2, x + 16, y + 20, 1, bd);
    }
  }
  function ladder(P, x0, y0, x1, y1) {
    P.line(x0, y0, x1, y1, 2, C.wood).line(x0 + 7, y0, x1 + 7, y1, 2, C.wood);
    for (let q = 0.08; q < 1; q += 0.11) { const lx = x0 + (x1 - x0) * q, ly = y0 + (y1 - y0) * q; P.rect(lx, ly, 8, 1, C.woodL).rect(lx, ly + 1, 8, 1, C.woodD); }
  }
  const BAYS1 = [[58, 84, 'shoji'], [84, 100, 'wall'], [100, 124, 'door'], [124, 140, 'wall'], [140, 166, 'shoji', true]];
  const BAYS2 = [[68, 92, 'shoji'], [92, 132, 'round'], [132, 156, 'shoji']];

  function houseSprite(stage, lit, floors) {
    return sprite('house' + stage + (lit ? 'L' : '') + floors, HW, HH, P => {
      const gy = HGY, cx = HCX, yB = gy - 12, yT = yB - 46;
      if (stage === 0) {                                                 // terreno: chão limpo, estacas, corda
        P.ell(cx, gy - 1, 76, 2.6, C.sand).rect(cx - 70, gy - 2, 140, 1, sh(C.sand, 0.3));
        for (let i = 0; i < 14; i++) P.set(cx - 66 + ((hash(i, 1) * 132) | 0), gy - 1, C.sackD);
        for (const x of [cx - 74, cx - 26, cx + 26, cx + 74]) P.rect(x - 1, gy - 15, 3, 15, C.woodL).rect(x + 1, gy - 15, 1, 15, C.wood).rect(x - 1, gy - 15, 3, 3, C.red).rect(x - 1, gy - 15, 3, 1, C.redL);
        for (let k = 0; k < 3; k++) for (let i = 0; i <= 48; i++) { const q = i / 48; P.set(cx - 74 + k * 50 + i * (k === 1 ? 52 : 48) / 48 - (k === 1 ? 2 : 0), gy - 11 + Math.round(Math.sin(q * PI) * 2.6), i % 6 < 3 ? C.cream : C.sack); }
        P.line(cx + 50, gy - 2, cx + 56, gy - 24, 2, C.wood).rect(cx + 53, gy - 27, 7, 3, C.woodD).poly([[cx + 46, gy - 1], [cx + 54, gy - 1], [cx + 53, gy - 9], [cx + 48, gy - 9]], C.steel).rect(cx + 48, gy - 9, 5, 1, C.steelL).rect(cx + 52, gy - 8, 1, 7, C.steelD);
        P.ell(cx + 40, gy - 2, 7, 3.5, C.sackD).ell(cx + 39, gy - 3, 5, 2.4, C.sack);
        return;
      }
      if (stage <= 2) slab(P, stage === 1);
      if (stage === 1) {                                                 // fundação: gabarito, sacos, areia, madeira
        for (const x of [42, 180]) P.rect(x, gy - 20, 2, 20, C.woodL).rect(x + 1, gy - 20, 1, 20, C.wood).rect(x - 4, gy - 18, 10, 2, C.woodL).rect(x - 4, gy - 17, 10, 1, C.wood);
        for (let x = 44; x < 180; x++) if (x % 5 < 3) P.set(x, gy - 17, C.red);
        for (const b of [[4, 0], [14, 0], [9, -6]]) P.rrect(b[0], gy - 7 + b[1], 11, 7, 2, C.sack).rect(b[0] + 1, gy - 2 + b[1], 9, 1, C.sackD).rect(b[0] + 3, gy - 5 + b[1], 5, 1, C.red).rect(b[0] + 1, gy - 7 + b[1], 9, 1, sh(C.sack, 0.4));
        P.ell(202, gy - 1, 14, 7, C.sand).erase(186, gy, 34, 6).ell(199, gy - 4, 6, 2.5, sh(C.sand, 0.4)).rect(192, gy - 2, 20, 2, sh(C.sand, -0.2));
        P.rect(206, gy - 10, 1, 9, C.wood).poly([[203, gy - 14], [210, gy - 14], [209, gy - 9], [204, gy - 9]], C.steel);
        return;
      }
      if (stage === 2) {                                                 // estrutura de hinoki: pilares, vigas, tesoura do telhado
        const H1 = C.woodL, H0 = sh(C.woodL, 0.45), H2 = C.wood, ridge = yT - 36;
        const stick = (x, y, w, h) => P.rect(x, y, w, h, H1).rect(x, y, w > h ? w : 1, w > h ? 1 : h, H0).rect(w > h ? x : x + w - 1, w > h ? y + h - 1 : y, w > h ? w : 1, w > h ? 1 : h, H2);
        engawa(P, 48, 176, yB, H1);
        for (let x = 46; x <= 178; x += 12) P.line(x, yT + 2, cx + (x - cx) * 0.5, ridge + 1, 1.6, H2);
        for (const sd of [-1, 1]) P.line(cx + sd * 70, yT + 4, cx + sd * 36, ridge, 3, H1).line(cx + sd * 70, yT + 3, cx + sd * 36, ridge - 1, 1, H0);
        for (const f of [0.36, 0.7]) { const hw = 36 + 34 * (1 - f); stick(cx - hw, yT - 36 * f, hw * 2, 2); }
        stick(cx - 38, ridge - 2, 76, 3);
        for (const b of BAYS1) { stick(b[0] - 1, yT, 3, yB - yT); stick(b[1] - 1, yT, 3, yB - yT); }
        stick(54, yT - 1, 116, 4); stick(58, yT + 13, 108, 2); stick(58, yB - 12, 108, 2);
        P.line(86, yB - 13, 98, yT + 15, 1.6, H2).line(138, yB - 13, 126, yT + 15, 1.6, H2);
        shoji(P, 62, yT + 17, 19, 15, false);
        scaffold(P, 24, yT - 14); ladder(P, 180, gy - 1, 166, yT + 2);
        for (let k = 0; k < 3; k++) P.rect(184 + k * 2, gy - 4 - k * 4, 30 - k * 4, 4, H1).rect(184 + k * 2, gy - 4 - k * 4, 30 - k * 4, 1, H0).rect(184 + k * 2, gy - 1 - k * 4, 30 - k * 4, 1, H2).rect(184 + k * 2, gy - 4 - k * 4, 2, 4, C.sand);
        return;
      }
      // 3+: casa fechada
      const two = floors >= 2, done = stage >= 4;
      engawa(P, 48, 176, yB, done ? C.woodL : C.wood);
      wallFloor(P, BAYS1, yT, yB, { lit, open: done });
      if (done) vol(P, cx - 12, gy - 5, 24, 5, C.stone, C.stoneD, C.stoneL);
      if (two) {
        tileRoof(P, cx, yT + 3, 72, 16, 50, { flat: true });
        const yB2 = yT - 12, yT2 = yB2 - 36;
        wallFloor(P, BAYS2, yT2, yB2, { lit });
        P.rect(62, yB2 - 7, 100, 1, C.woodD).rect(62, yB2 - 1, 100, 2, C.woodD);
        for (let x = 63; x < 162; x += 5) P.rect(x, yB2 - 6, 1, 5, C.wood);
        tileRoof(P, cx, yT2 + 3, 60, 34, 28, { shachi: true, gable: true, lit });
      } else tileRoof(P, cx, yT + 3, 72, 38, 36, { shachi: true, gable: true, lit });
      if (!done) { scaffold(P, 180, yT - 22); ladder(P, 24, gy - 1, 44, yT + 2); P.rect(196, gy - 7, 7, 7, C.steel).rect(196, gy - 7, 7, 1, C.steelL).rect(202, gy - 6, 1, 6, C.steelD).rect(197, gy - 9, 5, 1, C.blk); }
    });
  }

  function capySprite() {
    return sprite('capy', 30, 26, P => {
      const B = C.wood, o = 7;
      P.rrect(2, 6 + o, 20, 12, 5, B).rrect(12, 2 + o, 15, 12, 4, B).rect(14, 1 + o, 3, 2, C.woodD);
      P.shadeBelow(B, 0.24, 2);
      P.rect(15, 3 + o, 8, 1, C.woodL).rect(25, 5 + o, 2, 2, sh(C.woodD, -0.5)).rect(19, 7 + o, 3, 1, C.ink).set(18, 6 + o, C.ink).set(22, 6 + o, C.ink)
        .rect(20, 10 + o, 2, 1, C.sakuraD).set(25, 10 + o, C.ink).set(24, 11 + o, C.ink);
      P.ell(19.5, o - 1, 3.4, 3.2, C.yel).rect(18, o - 3, 2, 1, C.yelL).rect(20, o + 1, 2, 1, C.yelD).rect(19, o - 5, 1, 1, C.leafD).rect(20, o - 6, 2, 1, C.leaf);
    });
  }
  // Nature.onsen(g, x, y, {t=0, s=1, guest=true, screen=true}): rotenburo de pedras com vapor, bica de bambu (shishi-odoshi) e uma capivara de molho com yuzu
  function onsen(g, x, y, o) {
    o = o || NO;
    const t = o.t || 0, s = o.s || 1, RX = 38, RY = 8.5;
    at(g, x, y, s, false);
    if (o.screen !== false) fence(g, -40, 44, -2, NO);
    for (let i = 0; i < 9; i++) {                                         // pedras de trás
      const a = PI + (i + 0.5) / 9 * PI, w = 10 + hash(i, 21) * 9;
      blit(g, rockSprite(w, 6 + hash(i, 22) * 6, 300 + i, hash(i, 23) < 0.3), Math.cos(a) * (RX + 3), 5 + Math.sin(a) * (RY + 1) + 3);
    }
    g.fillStyle = LINE; g.beginPath(); g.ellipse(0, 5, RX + 1.2, RY + 1.2, 0, 0, TAU); g.fill();
    const wc = U.mixCss(C.waterL, C.grassL, 0.25);
    g.fillStyle = wc; g.beginPath(); g.ellipse(0, 5, RX, RY, 0, 0, TAU); g.fill();
    g.save(); g.clip();
    g.fillStyle = U.mixCss(C.water, C.grass, 0.25); g.beginPath(); g.ellipse(0, 9, RX * 0.8, RY * 0.7, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(40,60,70,.3)'; g.fillRect(-RX, -5, RX * 2, 4);
    g.fillStyle = 'rgba(255,255,255,.6)';
    for (let i = 0; i < 5; i++) { const rx = U.wrap(hash(i, 31) * 60 + t * (2 + i), 0, 60) - 30, ry = 3 + hash(i, 32) * 8; g.fillRect(rx, ry, 5 + Math.sin(t * 2 + i) * 2, 0.9); }
    g.restore();
    if (o.guest !== false) {                                             // capivara hóspede
      const bob = Math.sin(t * 1.4) * 0.6, cv = capySprite();
      g.save(); g.beginPath(); g.rect(-30, -30, 60, 37.5 + bob * 0.3); g.clip();
      g.drawImage(cv, -6, -13 + bob);
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(8, 7.6, 15 + Math.sin(t * 1.4) * 1.5, 2.2, 0, 0, TAU); g.stroke();
    }
    for (let i = 0; i < 2; i++) {                                        // yuzu boiando
      const yx = -20 + i * 9, yy = 7 + i * 3 + Math.sin(t * 1.8 + i * 2) * 0.6;
      g.fillStyle = LINE; g.beginPath(); g.arc(yx, yy, 3.4, 0, TAU); g.fill();
      g.fillStyle = C.yel; g.beginPath(); g.arc(yx, yy, 2.4, 0, TAU); g.fill();
      g.fillStyle = C.yelL; g.fillRect(yx - 1.4, yy - 1.4, 1.2, 1.2);
    }
    for (let i = 0; i < 7; i++) {                                        // pedras da frente
      const a = (i + 0.5) / 7 * PI, w = 11 + hash(i, 41) * 10;
      blit(g, rockSprite(w, 7 + hash(i, 42) * 5, 340 + i, hash(i, 43) < 0.35), Math.cos(a) * (RX + 2), 5 + Math.sin(a) * (RY + 2) + 4);
    }
    // shishi-odoshi: o bambu enche devagar, tomba de uma vez e volta
    const cyc = (t * 0.32) % 1, ang = cyc < 0.8 ? -0.42 + cyc * 0.3 : cyc < 0.86 ? U.lerp(-0.18, 0.55, U.ease.quadIn((cyc - 0.8) / 0.06)) : U.lerp(0.55, -0.42, U.ease.out((cyc - 0.86) / 0.14));
    const px = -47, py = -9;
    g.lineCap = 'round';
    g.strokeStyle = LINE; g.lineWidth = 3.6; g.beginPath(); g.moveTo(px - 3, 2); g.lineTo(px - 3, py - 1); g.moveTo(px + 3, 2); g.lineTo(px + 3, py - 1); g.moveTo(px - 14, -19); g.lineTo(px - 2, -17); g.stroke();
    g.strokeStyle = C.sack; g.lineWidth = 1.8; g.stroke();
    if (cyc < 0.8) { g.strokeStyle = C.waterL; g.lineWidth = 1.1; g.beginPath(); g.moveTo(px - 1.5, -16.5); g.quadraticCurveTo(px + 0.5, -15, px + 1, py - 3 + ang * 6); g.stroke(); }
    g.save(); g.translate(px, py); g.rotate(ang);
    g.strokeStyle = LINE; g.lineWidth = 5.4; g.beginPath(); g.moveTo(-9, 0); g.lineTo(12, 0); g.stroke();
    g.strokeStyle = C.grass; g.lineWidth = 3.4; g.stroke();
    g.strokeStyle = C.grassL; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-9, -1); g.lineTo(12, -1); g.stroke();
    g.fillStyle = LINE; g.fillRect(-2, -2.2, 1, 4.4); g.fillRect(5, -2.2, 1, 4.4);
    if (cyc >= 0.8 && cyc < 0.93) { g.fillStyle = C.waterL; g.fillRect(12, -1, 5, 1.6); g.fillRect(15, 0, 1.4, 6); }
    g.restore();
    const pa = g.globalAlpha;                                            // vapor
    g.fillStyle = '#FFFFFF';
    for (let i = 0; i < 9; i++) {
      const q = (t * (0.16 + hash(i, 51) * 0.1) + hash(i, 52)) % 1, sx = -26 + hash(i, 53) * 52 + Math.sin(t * 0.9 + i * 1.7 + q * 4) * 5 + wind(t, x) * q * 9;
      g.globalAlpha = pa * Math.sin(q * PI) * 0.42;
      const r = 2.5 + q * 4.5 + hash(i, 54) * 2;
      g.beginPath(); g.arc(sx, 2 - q * 46, r, 0, TAU); g.arc(sx + r * 0.7, 3 - q * 46 + r * 0.3, r * 0.6, 0, TAU); g.fill();
    }
    g.globalAlpha = pa;
    g.restore();
  }

  let gPond = null, gKoi = null, gT = 0;
  // jardim da casa: momiji, tōrō, laguinho com carpas e pontezinha (o lago é um E.Pond de verdade em miniatura)
  function gardenBack(g, x, y, s, t, lit) {
    tree(g, x - 122 * s, y, so(t, s, 5, 'maple'));
    lantern(g, x - 92 * s, y, s * 0.8, so(t, 1, 0, undefined, lit));
  }
  function gardenFront(g, x, y, s, t) {
    if (!gPond) { gPond = Pond({ x: 0, y: 0, w: 74, h: 19, seed: 12, pads: 2, reeds: 0, stones: 0.8 }); gKoi = Koi(gPond, 4, { seed: 5, size: 0.42 }); }
    const dt = U.clamp(t - gT, 0, 0.05); gT = t;
    gPond.update(dt); gKoi.update(dt);
    g.save(); g.translate(x - 104 * s, y + 17 * s); g.scale(s, s);
    gPond.draw(g, t);
    g.restore();
    so(t, s, 4); SO.w = 13; SO.h = 8; SO.moss = true; rock(g, x - 60 * s, y + 9 * s, SO);
    flower(g, x - 146 * s, y + 12 * s, so(t, s, 3, 'iris')); flower(g, x - 139 * s, y + 14 * s, so(t, s, 8, 'iris'));
  }

  const PEN = [C.red, C.yel, C.cream, C.bowlL, C.grassL];
  // Nature.house(g, x, y, {stage=0..5, s=1, t=0, lit, floors, garden, onsen, sign='VENDIDO'}): casa japonesa em estágios de obra.
  //   0 terreno com placa · 1 fundação com betoneira · 2 estrutura de hinoki · 3 paredes + telhado kawara · 4 casa pronta com engawa, noren e jardim · 5 mansão de 2 andares com onsen
  //   floors/garden/onsen forçam cada parte (padrão: floors 2 e onsen no 5, jardim a partir do 4); lit acende janelas (padrão: à noite)
  function house(g, x, y, o) {
    o = o || NO;
    const stage = U.clamp(o.stage | 0, 0, 5), s = o.s || 1, t = o.t || 0, lit = stage >= 3 ? litOf(o) : 0;
    const floors = o.floors || (stage >= 5 ? 2 : 1), wv = wind(t, x);
    const garden = o.garden !== undefined ? o.garden : stage >= 4, hasOnsen = o.onsen !== undefined ? o.onsen : stage >= 5;
    if (stage > 0) D.shadow(g, x, y + 1.5, 74 * s, 4.5 * s, 0.16);
    if (garden) gardenBack(g, x, y, s, t, o.lit);
    at(g, x, y, s, false);
    blit(g, houseSprite(stage, lit > 0.4, floors), 0, HH - HGY);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (stage === 0) {
      // bandeirolas na corda entre o poste da placa e a estaca
      const ax = -40, ay = -44, bx = 74, by = -15;
      g.strokeStyle = LINE; g.lineWidth = 1; g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 16, bx, by); g.stroke();
      for (let i = 1; i <= 9; i++) {
        const q = i / 10, u = 1 - q, px = u * u * ax + 2 * u * q * (ax + bx) / 2 + q * q * bx, py = u * u * ay + 2 * u * q * ((ay + by) / 2 + 16) + q * q * by;
        const fl = Math.sin(t * 6 + i * 1.3) * (0.8 + Math.abs(wv)) + wv * 2.2;
        g.beginPath(); g.moveTo(px - 3, py); g.lineTo(px + 3, py + 0.6); g.lineTo(px + fl, py + 7.5); g.closePath();
        g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke(); g.fillStyle = PEN[i % 5]; g.fill();
      }
      // placa
      g.save(); g.translate(-40, 0); g.rotate(wv * 0.012);
      g.strokeStyle = LINE; g.lineWidth = 4.4; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-12, -40); g.moveTo(12, 0); g.lineTo(12, -40); g.stroke();
      g.strokeStyle = C.wood; g.lineWidth = 2.4; g.stroke();
      D.box(g, -24, -40, 48, 19, C.cream, { ol: 1.2, r: 2, shade: C.riceS, top: C.white });
      D.text(g, o.sign || 'VENDIDO', 0, -30, { size: 9.5, col: C.red, sw: 0, weight: 900 });
      g.restore();
    } else if (stage === 1) {
      // betoneira girando e tremendo
      const mx = -76 + Math.sin(t * 31) * 0.3, my = Math.sin(t * 27) * 0.25;
      g.strokeStyle = LINE; g.lineWidth = 3.6; g.beginPath(); g.moveTo(mx - 9, -2); g.lineTo(mx - 3, -13); g.lineTo(mx + 8, -2); g.moveTo(mx - 14, -8); g.lineTo(mx - 4, -11); g.stroke();
      g.strokeStyle = C.yelD; g.lineWidth = 1.8; g.stroke();
      g.save(); g.translate(mx, -15 + my); g.rotate(-0.5);
      g.beginPath(); g.moveTo(-9, -5); g.quadraticCurveTo(-11, 0, -9, 5); g.lineTo(5, 7); g.lineTo(10, 4); g.lineTo(10, -4); g.lineTo(5, -7); g.closePath();
      g.strokeStyle = LINE; g.lineWidth = 2.4; g.stroke(); g.fillStyle = C.yel; g.fill();
      g.save(); g.clip();
      g.fillStyle = C.yelD;
      for (let k = 0; k < 4; k++) { const sy = ((t * 9 + k * 4.5) % 18) - 9; g.fillRect(-10, sy, 16, 1.6); }
      g.fillStyle = C.yelL; g.fillRect(-10, -6.5, 20, 2);
      g.fillStyle = C.blk; g.fillRect(8, -4, 3, 8);
      g.restore(); g.restore();
      g.fillStyle = LINE; g.beginPath(); g.arc(mx - 9, -2.5, 3.2, 0, TAU); g.arc(mx + 8, -2.5, 3.2, 0, TAU); g.fill();
      g.fillStyle = C.blkL; g.beginPath(); g.arc(mx - 9, -2.5, 2, 0, TAU); g.arc(mx + 8, -2.5, 2, 0, TAU); g.fill();
    } else if (stage === 2) {
      // balde pendurado na viga, balançando
      const a = wv * 0.14 + Math.sin(t * 1.9) * 0.06;
      g.save(); g.translate(40, -60); g.rotate(a);
      g.fillStyle = LINE; g.fillRect(-0.5, 0, 1, 26);
      g.beginPath(); g.moveTo(-5, 26); g.lineTo(5, 26); g.lineTo(4, 34); g.lineTo(-4, 34); g.closePath();
      g.strokeStyle = LINE; g.lineWidth = 2; g.stroke(); g.fillStyle = C.steel; g.fill(); g.fillStyle = C.steelL; g.fillRect(-4.4, 26.6, 8.8, 1.4);
      g.restore();
    }
    if (stage >= 4) {
      // noren na porta
      for (let k = 0; k < 3; k++) {
        const nx = -10.5 + k * 7, sw2 = wv * 1.6 + Math.sin(t * 2.8 + k * 1.4) * 0.7;
        g.beginPath(); g.moveTo(nx, -50); g.lineTo(nx + 6.6, -50); g.lineTo(nx + 6.6 + sw2, -36); g.lineTo(nx + sw2, -36); g.closePath();
        g.strokeStyle = LINE; g.lineWidth = 1.6; g.stroke(); g.fillStyle = C.bowl; g.fill();
        g.fillStyle = C.bowlL; g.fillRect(nx + 0.6, -49.4, 5.4, 1.2);
        if (k === 1) { g.fillStyle = C.cream; g.beginPath(); g.arc(nx + 3.3 + sw2 * 0.5, -43, 2, 0, TAU); g.fill(); }
      }
      g.fillStyle = LINE; g.fillRect(-13, -52, 26, 2);
    }
    g.restore();
    if (stage >= 3) {
      const lt = o.lit;
      chochin(g, x - 17 * s, y - 55 * s, so(t, s, 3, undefined, lt));
      if (stage >= 4) { chochin(g, x + 17 * s, y - 55 * s, so(t, s, 4, undefined, lt)); windchime(g, x + 58 * s, y - 57 * s, so(t, s * 0.8, 2)); tree(g, x - 46 * s, y - 12 * s, so(t, s * 0.62, 2, 'bonsai', undefined, false)); }
      if (lit > 0.05) {
        queueGlow(g, x - 41 * s, y - 36 * s, 34 * s, '#FFC766', lit * 0.7); queueGlow(g, x + 41 * s, y - 36 * s, 34 * s, '#FFC766', lit * 0.7);
        if (stage >= 4) queueGlow(g, x, y - 26 * s, 30 * s, '#FFB45A', lit * 0.55);
        if (floors >= 2) { queueGlow(g, x, y - 88 * s, 30 * s, '#FFC766', lit * 0.7); queueGlow(g, x - 32 * s, y - 86 * s, 24 * s, '#FFC766', lit * 0.5); queueGlow(g, x + 32 * s, y - 86 * s, 24 * s, '#FFC766', lit * 0.5); }
      }
    }
    if (garden) gardenFront(g, x, y, s, t);
    if (hasOnsen) onsen(g, x + 132 * s, y + 6 * s, so(t, s, 0));
  }

  /* ======================================================================
     7. Vida: pétalas, vaga-lumes, pássaros, borboletas
     ====================================================================== */
  const PET = { x: 0, y: 0, vx: 0, vy: 0, g: 4, life: 9, r: 0, vr: 0, w: 3, c: C.sakura, shape: 'petal', sway: 26, flip: 6, fade: 0.2, drag: 0.4 };
  const PET_C = [C.sakura, C.sakura, C.sakuraD, sh(C.sakura, 0.55)];
  let petAcc = 0;
  // Nature.sakuraPetals(particles, view{x0,x1,y0,y1}, dt, rate=6, from{x,y,r}?): solta pétalas (E.Particles, shape 'petal') no topo da vista
  //   ou, com `from`, da copa de uma árvore; rate = pétalas por segundo
  function sakuraPetals(ps, view, dt, rate, from) {
    if (!ps || !ps.add) return;
    petAcc += dt * (rate === undefined ? 6 : rate);
    while (petAcc >= 1) {
      petAcc -= 1;
      if (from) { const a = Math.random() * TAU, q = Math.sqrt(Math.random()) * (from.r || 20); PET.x = from.x + Math.cos(a) * q; PET.y = from.y + Math.sin(a) * q * 0.6; }
      else { PET.x = view.x0 - 60 + Math.random() * (view.x1 - view.x0 + 60); PET.y = view.y0 - 4; }
      PET.vx = 10 + Math.random() * 22 + wind(petAcc * 7, PET.x) * 8; PET.vy = 9 + Math.random() * 13;
      PET.r = Math.random() * TAU; PET.vr = (Math.random() - 0.5) * 5; PET.w = 2.4 + Math.random() * 1.4; PET.life = 7 + Math.random() * 4;
      PET.c = PET_C[(Math.random() * 4) | 0];
      ps.add(PET);
    }
  }

  // Nature.fireflies({x0,x1,y0,y1, n=14, seed=1}) -> { update(dt), draw(g, alpha?) }: vaga-lumes que vagam e piscam (desenhe depois de grade();
  //   alpha padrão = quanto é noite)
  function fireflies(o) {
    o = o || NO;
    const n = o.n || 14, seed = o.seed === undefined ? 1 : o.seed, x0 = o.x0 || 0, x1 = o.x1 === undefined ? 480 : o.x1, y0 = o.y0 === undefined ? -60 : o.y0, y1 = o.y1 || 0, N = E.Noise;
    let t = 0;
    return {
      update(dt) { t += dt; },
      draw(g, alpha) {
        const al = alpha === undefined ? light().night : alpha, pa = g.globalAlpha;
        if (al <= 0.02) return;
        for (let i = 0; i < n; i++) {
          const sp = 0.05 + hash(i, seed) * 0.05, x = x0 + N.n1(t * sp + i * 13.7, seed) * (x1 - x0) + Math.sin(t * 1.7 + i) * 3;
          const y = y0 + N.n1(t * sp * 1.3 + i * 7.3, seed + 5) * (y1 - y0) + Math.cos(t * 1.3 + i * 2) * 2.5;
          const b = Math.pow(Math.max(0, Math.sin(t * (1.1 + hash(i, seed + 2)) + i * 2.4)), 1.6) * al;
          if (b < 0.03) continue;
          glow(g, x, y, 9 + b * 5, '#D6F26A', b * 0.9);
          g.globalAlpha = pa * Math.min(1, b); g.fillStyle = '#FFFFDC'; g.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); g.globalAlpha = pa;
        }
      },
    };
  }

  // Nature.birds(seed, {n=6, y=.22, speed=34}) -> { update(dt), draw(g, w, h, camX=0) }: revoada distante em V batendo asa e planando
  function birds(seed, o) {
    o = o || NO;
    const rn = E.RNG(seed === undefined ? 3 : seed), n = o.n || 6, list = [], speed = o.speed || 34, by = o.y === undefined ? 0.22 : o.y;
    for (let i = 0; i < n; i++) { const k = Math.ceil(i / 2), sd = i % 2 ? 1 : -1; list.push({ dx: -k * 13 + rn.range(-3, 3), dy: sd * k * 7 + rn.range(-2, 2), ph: rn.range(0, TAU), sz: rn.range(3.6, 5) }); }
    let t = rn.range(0, 40);
    return {
      update(dt) { t += dt; },
      draw(g, w, h, camX) {
        const fx = U.wrap(t * speed - (camX || 0) * 0.15, -120, w + 160), fy = h * (by + (E.Noise.n1(t * 0.05, 3) - 0.5) * 0.16), pa = g.globalAlpha;
        g.globalAlpha = pa * (0.8 - 0.35 * light().night);
        g.strokeStyle = LINE; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.5;
        g.beginPath();
        for (let i = 0; i < n; i++) {
          const b = list[i], x = fx + b.dx, y = fy + b.dy + Math.sin(t * 1.1 + b.ph) * 2.5;
          const glide = Math.sin(t * 0.5 + b.ph) > 0.55, f = glide ? -0.25 : Math.sin(t * 9 + b.ph), s = b.sz;
          g.moveTo(x - s, y - f * s * 0.8); g.quadraticCurveTo(x - s * 0.5, y - f * s * 0.2 - s * 0.35, x, y);
          g.quadraticCurveTo(x + s * 0.5, y - f * s * 0.2 - s * 0.35, x + s, y - f * s * 0.8);
        }
        g.stroke();
        g.globalAlpha = pa;
      },
    };
  }

  const BF_C = [C.yelL, C.white, C.sakura, C.waterL, C.ora];
  // Nature.butterflies({x0,x1,y0,y1, n=5, seed=1}) -> { list, update(dt), draw(g) }: borboletas que esvoaçam dentro da área
  function butterflies(o) {
    o = o || NO;
    const rn = E.RNG(o.seed === undefined ? 1 : o.seed), n = o.n || 5, x0 = o.x0 || 0, x1 = o.x1 === undefined ? 480 : o.x1, y0 = o.y0 === undefined ? -50 : o.y0, y1 = o.y1 === undefined ? -6 : o.y1, list = [];
    for (let i = 0; i < n; i++) list.push({ x: rn.range(x0, x1), y: rn.range(y0, y1), tx: rn.range(x0, x1), ty: rn.range(y0, y1), vx: 0, vy: 0, ph: rn.range(0, TAU), c: BF_C[i % 5], wait: 0 });
    let t = 0;
    return {
      list,
      update(dt) {
        t += dt;
        for (let i = 0; i < n; i++) {
          const b = list[i], dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1;
          if (d < 6 || (b.wait -= dt) < -5) { b.tx = rn.range(x0, x1); b.ty = rn.range(y0, y1); b.wait = 0; }
          b.vx = U.damp(b.vx, dx / d * 26 + wind(t, b.x) * 9, 2.5, dt); b.vy = U.damp(b.vy, dy / d * 18 + Math.sin(t * 7 + b.ph) * 22, 4, dt);
          b.x += b.vx * dt; b.y += b.vy * dt;
        }
      },
      draw(g) {
        for (let i = 0; i < n; i++) {
          const b = list[i], f = Math.abs(Math.sin(t * 13 + b.ph)), wx = 0.6 + f * 3, tilt = U.clamp(b.vx * 0.012, -0.4, 0.4);
          g.save(); g.translate(b.x, b.y); g.rotate(tilt);
          g.fillStyle = LINE; g.beginPath(); g.ellipse(-wx * 0.5 - 0.4, -1.2, wx * 0.5 + 0.9, 3.1, 0, 0, TAU); g.ellipse(wx * 0.5 + 0.4, -1.2, wx * 0.5 + 0.9, 3.1, 0, 0, TAU); g.fill();
          g.fillStyle = b.c; g.beginPath(); g.ellipse(-wx * 0.5 - 0.4, -1.2, wx * 0.5, 2.1, 0, 0, TAU); g.ellipse(wx * 0.5 + 0.4, -1.2, wx * 0.5, 2.1, 0, 0, TAU); g.fill();
          g.fillStyle = LINE; g.fillRect(-0.6, -2.6, 1.2, 4);
          g.restore();
        }
      },
    };
  }

  /* ======================================================================
     8. Pond — lago orgânico visto de cima (ou achatado, num cenário de lado)
     ====================================================================== */
  let causticCv = null, causticPat = null;
  function caustics(g) {
    if (!causticPat) {
      const S = 128, rn = E.RNG(77);
      causticCv = document.createElement('canvas'); causticCv.width = causticCv.height = S;
      const q = causticCv.getContext('2d');
      q.strokeStyle = '#FFFFFF'; q.lineCap = 'round';
      for (let i = 0; i < 34; i++) {
        const x = rn.range(0, S), y = rn.range(0, S), rx = rn.range(9, 22), ry = rx * rn.range(0.5, 0.9), a0 = rn.range(0, TAU), a1 = a0 + rn.range(2.2, 5.2);
        q.lineWidth = rn.range(1, 2.2);
        for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) { q.beginPath(); q.ellipse(x + ox, y + oy, rx, ry, rn.seed % 3, a0, a1); q.stroke(); }
      }
      causticPat = g.createPattern(causticCv, 'repeat');
    }
    return causticPat;
  }

  // E.Pond({x, y, w=320, h=180, seed=1, pads, reeds=2, stones=1}) -> pond: lago com centro em (x,y) e contorno orgânico.
  //   update(dt) · draw(g,t) (desenha tudo, inclusive as carpas ligadas por E.Koi) · drawUnder(g,t)/drawOver(g,t) (camadas separadas)
  //   ripple(x,y,{size,scare=true}) toque: ondinha + susto nas carpas · feed(x,y,n=4) ração · contains(x,y) · rho(x,y) 0 centro..1 borda
  function Pond(o) {
    o = o || NO;
    const w = o.w || 320, h = o.h || 180, seed = o.seed === undefined ? 1 : o.seed, rn = E.RNG('pond' + seed);
    const tilt = o.tilt !== undefined ? o.tilt : h / w >= 0.45 ? 1 : U.clamp(h / w * 1.9, 0.3, 1);   // lago achatado = visto de lado: simula de cima e desenha amassado
    const FH = h / tilt, hw = w / 2, hh = FH / 2, sf = U.clamp(Math.min(w, FH) / 150, 0.34, 1.2), aspect = 1;
    const NA = 128, RT = new Float32Array(NA + 1);
    {
      const a = [rn.range(0.03, 0.08), rn.range(0.03, 0.07), rn.range(0.02, 0.05), rn.range(0.01, 0.03)], ph = [rn.range(0, TAU), rn.range(0, TAU), rn.range(0, TAU), rn.range(0, TAU)];
      let mx = 0;
      for (let i = 0; i <= NA; i++) { const th = i / NA * TAU; let r = 1; for (let k = 0; k < 4; k++) r += a[k] * Math.cos((k + 2) * th + ph[k]); RT[i] = r; if (r > mx) mx = r; }
      for (let i = 0; i <= NA; i++) RT[i] /= mx;
    }
    function rad(th) { let q = (th / TAU) % 1; if (q < 0) q += 1; q *= NA; const i = q | 0; return RT[i] + (RT[i + 1] - RT[i]) * (q - i); }
    function rho(lx, ly) { const u = lx / hw, v = ly / hh; return Math.hypot(u, v) / rad(Math.atan2(v, u)); }
    function mkPath(k, grow, dy) {
      const p = new Path2D();
      for (let i = 0; i < NA; i++) { const th = i / NA * TAU, x = Math.cos(th) * (RT[i] * hw * k + grow), y = Math.sin(th) * (RT[i] * hh * k + grow * aspect) + dy; if (i) p.lineTo(x, y); else p.moveTo(x, y); }
      p.closePath(); return p;
    }
    const pathW = mkPath(1, 0, 0), pathBank = mkPath(1, 3.2 * sf + 1, 0), pathBankOL = mkPath(1, 3.2 * sf + 2.3, 0);
    const pathMid = mkPath(0.76, 0, hh * 0.05), pathDeep = mkPath(0.47, 0, hh * 0.1), pathSh = mkPath(1, 0, 4.5 * sf), pathShore = mkPath(1, -1.6, 0);

    // pedras da borda
    const stones = [], dens = o.stones === undefined ? 1 : o.stones;
    for (let th = rn.range(0, 0.3); th < TAU - 0.05;) {
      const big = rn.chance(0.14), sw = (big ? rn.range(17, 24) : rn.range(9, 15)) * sf + 2, shh = sw * rn.range(0.52, 0.72), r = rad(th);
      if (rn() < dens) stones.push({ cv: rockSprite(sw, shh, 500 + stones.length + seed * 31, rn.chance(0.3)), x: Math.cos(th) * (r * hw + sw * 0.22), y: Math.sin(th) * (r * hh + shh * 0.2) * tilt + shh * 0.5 + 1, fl: rn.chance(0.5) });
      th += sw * 0.86 / Math.hypot(Math.sin(th) * hw, Math.cos(th) * hh);
    }
    stones.sort((a, b) => a.y - b.y);
    // vitórias-régias
    const pads = [], nPads = o.pads === undefined ? Math.round(w * h / 5600) + 1 : o.pads;
    for (let tries = 0; pads.length < nPads && tries < 200; tries++) {
      const th = rn.range(0, TAU), q = rn.range(0.25, 0.8), r = rad(th), px = Math.cos(th) * r * hw * q, py = Math.sin(th) * r * hh * q, pr = rn.range(6.5, 10.5) * sf;
      let ok = true;
      for (const c of pads) if (Math.hypot(c.x - px, (c.y - py) / aspect) < c.r + pr + 2) ok = false;
      if (ok) pads.push({ x: px, y: py, r: pr, a: rn.range(0, TAU), ph: rn.range(0, TAU), fl: rn.chance(0.5), fc: rn.chance(0.3) ? 1 : 0 });
    }
    pads.sort((a, b) => a.y - b.y);
    const pebbles = [];
    for (let i = 0; i < 12; i++) { const th = rn.range(0, TAU), q = rn.range(0.1, 0.8), r = rad(th); pebbles.push(Math.cos(th) * r * hw * q, Math.sin(th) * r * hh * q, rn.range(3, 8) * sf); }
    const reeds = [], nReeds = o.reeds === undefined ? 2 : o.reeds;
    for (let i = 0; i < nReeds; i++) { const th = -PI * (0.18 + (i + rn.range(0.1, 0.9)) / nReeds * 0.64), r = rad(th) * 0.95; reeds.push(Math.cos(th) * r * hw, Math.sin(th) * r * hh * tilt, rn.int(4, 6), rn.range(0, 99)); }

    const RN = 40, rip = new Float32Array(RN * 5); let ripI = 0;            // x,y,idade,vida,tamanho
    const FN = 32, food = new Float32Array(FN * 4);                         // x,y,vida,fase
    const SN = 6, scares = new Float32Array(SN * 3); let scI = 0;           // x,y,tempo restante
    let amb = 2;

    function ring(lx, ly, size, life, delay) {
      const i = (ripI++ % RN) * 5;
      rip[i] = lx; rip[i + 1] = ly; rip[i + 2] = -(delay || 0); rip[i + 3] = life || 1.5; rip[i + 4] = size || 24 * sf;
    }
    const pond = {
      x: o.x || 0, y: o.y || 0, w, h, fh: FH, tilt, seed, t: 0, koi: null, scale: sf, food, scares, FOOD_N: FN, SCARE_N: SN,
      // rho(x,y) -> 0 no centro .. 1 na borda (coords de mundo)
      rho(x, y) { return rho(x - pond.x, (y - pond.y) / tilt); },
      // contains(x,y) -> bool
      contains(x, y) { return rho(x - pond.x, (y - pond.y) / tilt) < 1; },
      // ripple(x, y, {size, scare=true}) -> bool: toque na água; devolve false se foi fora do lago
      ripple(x, y, oo) {
        const lx = x - pond.x, ly = (y - pond.y) / tilt;
        if (rho(lx, ly) > 1) return false;
        const size = (oo && oo.size) || 30 * sf;
        ring(lx, ly, size, 1.7, 0); ring(lx, ly, size * 0.8, 1.5, 0.22); ring(lx, ly, size * 0.55, 1.3, 0.45);
        if (!oo || oo.scare !== false) { const i = (scI++ % SN) * 3; scares[i] = lx; scares[i + 1] = ly; scares[i + 2] = 1.3; }
        return true;
      },
      // feed(x, y, n=4) -> bool: joga ração; as carpas vêm comer
      feed(x, y, n) {
        const lx = x - pond.x, ly = (y - pond.y) / tilt;
        if (rho(lx, ly) > 1) return false;
        n = n || 4;
        for (let k = 0; k < n; k++) {
          let slot = -1, old = 1e9;
          for (let i = 0; i < FN; i++) if (food[i * 4 + 2] < old) { old = food[i * 4 + 2]; slot = i; }
          const a = Math.random() * TAU, d = Math.random() * 11 * sf + 2;
          let fx = lx + Math.cos(a) * d, fy = ly + Math.sin(a) * d * aspect;
          const q = rho(fx, fy); if (q > 0.84) { fx *= 0.84 / q; fy *= 0.84 / q; }
          food[slot * 4] = fx; food[slot * 4 + 1] = fy; food[slot * 4 + 2] = 24 + Math.random() * 4; food[slot * 4 + 3] = Math.random() * TAU;
          ring(fx, fy, 7 * sf, 0.9, k * 0.06);
        }
        return true;
      },
      // randomPoint(rnd, maxRho, out{x,y}) -> out: ponto local aleatório dentro do lago
      randomPoint(r, maxRho, out) {
        const th = r() * TAU, q = Math.sqrt(r()) * (maxRho || 0.8), rr = rad(th);
        out.x = Math.cos(th) * rr * hw * q; out.y = Math.sin(th) * rr * hh * q; return out;
      },
      _ring: ring, _rho: rho, _path: pathW,
      // update(dt): ondinhas, ração, sustos e uma gota ocasional
      update(dt) {
        pond.t += dt;
        for (let i = 0; i < RN * 5; i += 5) if (rip[i + 3] > 0) { rip[i + 2] += dt; if (rip[i + 2] > rip[i + 3]) rip[i + 3] = 0; }
        for (let i = 0; i < FN * 4; i += 4) if (food[i + 2] > 0) food[i + 2] -= dt;
        for (let i = 0; i < SN * 3; i += 3) if (scares[i + 2] > 0) scares[i + 2] -= dt;
        if ((amb -= dt) <= 0) { amb = 1.6 + Math.random() * 3; const th = Math.random() * TAU, q = Math.random() * 0.8, r = rad(th); ring(Math.cos(th) * r * hw * q, Math.sin(th) * r * hh * q, (6 + Math.random() * 8) * sf, 1.1, 0); }
      },
      // drawUnder(g, t): margem, água em degraus de profundidade, fundo, sombra da margem e cáusticas
      drawUnder(g, t) {
        const st = light();
        g.save(); g.translate(pond.x, pond.y); g.scale(1, tilt);
        g.fillStyle = LINE; g.fill(pathBankOL);
        g.fillStyle = sh(C.woodD, -0.2); g.fill(pathBank);
        g.save(); g.clip(pathW);
        g.fillStyle = C.water; g.fillRect(-hw - 2, -hh - 2, w + 4, FH + 4);
        g.fillStyle = U.mixCss(C.water, C.waterD, 0.5); g.fill(pathMid);
        g.fillStyle = U.mixCss(C.waterD, C.bowl, 0.25); g.fill(pathDeep);
        g.fillStyle = 'rgba(30,60,90,.22)';
        g.beginPath();
        for (let i = 0; i < pebbles.length; i += 3) { g.moveTo(pebbles[i] + pebbles[i + 2], pebbles[i + 1]); g.ellipse(pebbles[i], pebbles[i + 1], pebbles[i + 2], pebbles[i + 2] * 0.6 * aspect, 0, 0, TAU); }
        g.fill();
        g.strokeStyle = 'rgba(22,44,72,.34)'; g.lineWidth = 9 * sf; g.stroke(pathSh);
        const pa = g.globalAlpha, pat = caustics(g);
        g.fillStyle = pat;
        g.save(); g.scale(sf * 1.1, sf * 1.1 * aspect);
        const ox = (t * 5) % 128, oy = (t * 3) % 128, k = 1 / (sf * 1.1), W2 = (w + 4) * k, H2 = (FH + 4) * k;
        g.globalAlpha = pa * (0.1 + 0.04 * Math.sin(t * 0.7));
        g.translate(ox, oy); g.fillRect(-W2 / 2 - ox, -H2 / 2 - oy, W2, H2);
        g.translate(-ox * 2.3 + 40, -oy * 1.7 + 70); g.globalAlpha = pa * (0.08 + 0.04 * Math.sin(t * 0.9 + 2));
        g.fillRect(-W2 / 2 + ox * 1.3 - 40, -H2 / 2 + oy * 0.7 - 70, W2, H2);
        g.restore(); g.globalAlpha = pa;
        g.fillStyle = U.rgba(st.mid, 0.14); g.fillRect(-hw, -hh, w, hh * 0.9);     // céu refletido no lado de trás
        g.restore(); g.restore();
      },
      // drawOver(g, t): reflexos, ondinhas, ração, vitórias-régias, pedras da borda e juncos
      drawOver(g, t) {
        const pa = g.globalAlpha;
        g.save(); g.translate(pond.x, pond.y);
        g.save(); g.scale(1, tilt);
        g.save(); g.clip(pathW);
        g.fillStyle = 'rgba(255,255,255,.4)';                                   // reflexos: tracinhos de luz
        for (let i = 0; i < 14; i++) {
          const q = hash(i, seed + 60), lx = (U.wrap(hash(i, seed + 61) + t * 0.012 * (0.5 + q), 0, 1) - 0.5) * w * 0.86, ly = (hash(i, seed + 62) - 0.5) * FH * 0.8;
          const lw = (5 + q * 12) * sf * (0.7 + 0.3 * Math.sin(t * 1.2 + i * 2));
          g.fillRect(lx - lw / 2, ly, lw, Math.max(0.8, 1.1 * sf)); if (i % 3 === 0) g.fillRect(lx - lw * 0.2, ly + 2.2 * sf, lw * 0.5, Math.max(0.7, sf * 0.9));
        }
        g.strokeStyle = 'rgba(214,240,246,.75)'; g.lineWidth = 1.2; g.stroke(pathShore);
        g.lineWidth = 1.3;
        for (let i = 0; i < RN * 5; i += 5) {
          if (rip[i + 3] <= 0 || rip[i + 2] < 0) continue;
          const q = rip[i + 2] / rip[i + 3], R = rip[i + 4] * (0.2 + q * 0.9), a = Math.pow(1 - q, 1.4);
          g.globalAlpha = pa * a * 0.3; g.strokeStyle = '#1E466E';
          g.beginPath(); g.ellipse(rip[i], rip[i + 1] + 1.2, R, R, 0, 0, TAU); g.stroke();
          g.globalAlpha = pa * a * 0.85; g.strokeStyle = '#EBFAFF';
          g.beginPath(); g.ellipse(rip[i], rip[i + 1], R, R, 0, 0, TAU); g.stroke();
        }
        for (let i = 0; i < FN * 4; i += 4) {
          if (food[i + 2] <= 0) continue;
          const a = Math.min(1, food[i + 2] / 2), fx = food[i] + Math.sin(t * 1.3 + food[i + 3]) * 0.8, fy = food[i + 1] + Math.cos(t * 1.7 + food[i + 3]) * 0.5, r = Math.max(1.1, 1.7 * sf);
          g.globalAlpha = pa * a;
          g.strokeStyle = 'rgba(235,250,255,.6)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(fx, fy, r * 2.2 + Math.sin(t * 3 + food[i + 3]) * 0.6, (r * 2.2) * aspect, 0, 0, TAU); g.stroke();
          g.fillStyle = LINE; g.beginPath(); g.arc(fx, fy, r + 0.8, 0, TAU); g.fill();
          g.fillStyle = C.wood; g.beginPath(); g.arc(fx, fy, r, 0, TAU); g.fill();
          g.fillStyle = C.woodL; g.fillRect(fx - r * 0.6, fy - r * 0.6, r * 0.7, r * 0.7);
        }
        g.globalAlpha = pa;
        g.restore();
        for (let i = 0; i < pads.length; i++) {                               // vitórias-régias boiando
          const p = pads[i], bx = p.x + Math.sin(t * 0.6 + p.ph) * 1.4 * sf, by = p.y + Math.cos(t * 0.8 + p.ph * 1.3) * 0.9 * sf, r = p.r * (1 + Math.sin(t * 1.1 + p.ph) * 0.02), a = p.a + Math.sin(t * 0.35 + p.ph) * 0.12;
          g.fillStyle = 'rgba(20,45,70,.26)'; g.beginPath(); g.ellipse(bx + 1.5 * sf, by + 2.4 * sf, r, r * aspect, 0, 0, TAU); g.fill();
          g.save(); g.translate(bx, by); g.scale(1, aspect);
          g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a + 0.28, a + TAU - 0.28); g.closePath();
          g.strokeStyle = LINE; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
          g.fillStyle = C.leaf; g.fill();
          g.save(); g.clip();
          g.fillStyle = C.grass; g.beginPath(); g.arc(-r * 0.18, -r * 0.22, r * 0.86, 0, TAU); g.fill();
          g.strokeStyle = C.leafD; g.lineWidth = 0.7; g.beginPath();
          for (let k = 1; k < 6; k++) { const va = a + 0.28 + k * (TAU - 0.56) / 6; g.moveTo(Math.cos(va) * r * 0.2, Math.sin(va) * r * 0.2); g.lineTo(Math.cos(va) * r * 0.86, Math.sin(va) * r * 0.86); }
          g.stroke();
          g.restore(); g.restore();
        }
        g.restore();
        for (let i = 0; i < pads.length; i++) {                               // flores de lótus (em pé: fora do achatamento)
          const p = pads[i];
          if (!p.fl) continue;
          const bx = p.x + Math.sin(t * 0.6 + p.ph) * 1.4 * sf, by = (p.y + Math.cos(t * 0.8 + p.ph * 1.3) * 0.9 * sf) * tilt, r = p.r;
          const fy2 = by - r * 0.25 * tilt + Math.sin(t * 1.6 + p.ph) * 0.4, pr = Math.max(2, r * 0.42), c1 = p.fc ? C.white : C.sakura, c2 = p.fc ? C.riceS : C.sakuraD;
          for (let pass = 0; pass < 2; pass++) {
            g.fillStyle = pass ? c1 : LINE;
            g.beginPath();
            for (let k = 0; k < 6; k++) { const pa2 = k * TAU / 6 + Math.sin(t * 0.5 + p.ph) * 0.1, ex = bx + Math.cos(pa2) * pr * 0.75, ey = fy2 + Math.sin(pa2) * pr * 0.6 * (0.6 + 0.4 * tilt); g.moveTo(ex + pr * 0.6, ey); g.ellipse(ex, ey, pr * 0.6 + (pass ? 0 : 0.9), pr * 0.46 + (pass ? 0 : 0.9), pa2, 0, TAU); }
            g.fill();
          }
          g.fillStyle = c2; g.beginPath(); g.arc(bx, fy2, pr * 0.62, 0, TAU); g.fill();
          g.fillStyle = C.yel; g.beginPath(); g.arc(bx, fy2, pr * 0.4, 0, TAU); g.fill();
          g.fillStyle = C.yelL; g.fillRect(bx - pr * 0.25, fy2 - pr * 0.25, pr * 0.3, pr * 0.3);
        }
        g.imageSmoothingEnabled = D.zoom < 0.75;
        for (let i = 0; i < stones.length; i++) {
          const s = stones[i];
          if (s.fl) { g.save(); g.translate(s.x, 0); g.scale(-1, 1); g.drawImage(s.cv, -s.cv.width / 2, s.y - s.cv.height + 2); g.restore(); }
          else g.drawImage(s.cv, s.x - s.cv.width / 2, s.y - s.cv.height + 2);
        }
        g.lineCap = 'round';
        for (let i = 0; i < reeds.length; i += 4) {                            // juncos na margem de trás
          const rx = reeds[i], ry = reeds[i + 1], n = reeds[i + 2], sd = reeds[i + 3], wv = wind(t, pond.x + rx);
          for (let pass = 0; pass < 2; pass++) {
            g.strokeStyle = pass ? C.leaf : LINE; g.lineWidth = (pass ? 1.4 : 3.2) * Math.max(0.6, sf);
            g.beginPath();
            for (let k = 0; k < n; k++) { const bx = rx + (k - n / 2) * 3.4 * sf, len = (16 + hash(k, sd) * 16) * sf, bend = (wv * 0.25 + Math.sin(t * 1.8 + k + sd) * 0.05) * len + (hash(k, sd + 1) - 0.5) * 6 * sf; g.moveTo(bx, ry); g.quadraticCurveTo(bx + bend * 0.2, ry - len * 0.6, bx + bend, ry - len); }
            g.stroke();
          }
          for (let k = 0; k < n; k += 2) {                                     // taboas
            const bx = rx + (k - n / 2) * 3.4 * sf, len = (16 + hash(k, sd) * 16) * sf, bend = (wv * 0.25 + Math.sin(t * 1.8 + k + sd) * 0.05) * len + (hash(k, sd + 1) - 0.5) * 6 * sf;
            g.strokeStyle = LINE; g.lineWidth = 4.4 * sf; g.beginPath(); g.moveTo(bx + bend * 0.72, ry - len * 0.8); g.lineTo(bx + bend * 0.94, ry - len * 0.96); g.stroke();
            g.strokeStyle = C.woodD; g.lineWidth = 2.6 * sf; g.stroke();
          }
        }
        g.restore();
      },
      // draw(g, t): desenha o lago inteiro; se houver carpas (E.Koi) ligadas, elas entram na camada certa (embaixo das vitórias-régias)
      draw(g, t) {
        if (t === undefined) t = pond.t;
        pond.drawUnder(g, t);
        if (pond.koi) { pond.koi._paint(g, t); pond.koi._drawn = true; }
        pond.drawOver(g, t);
      },
    };
    return pond;
  }

  /* ======================================================================
     9. Koi — carpas vistas de cima, corpo em cadeia de espinha
     ====================================================================== */
  const KS = 10, KPROF = [0.6, 0.94, 1, 0.97, 0.88, 0.75, 0.6, 0.44, 0.3, 0.18];
  const BX = new Float32Array(KS), BY = new Float32Array(KS), NX = new Float32Array(KS), NY = new Float32Array(KS), WD = new Float32Array(KS);
  const KOI_KINDS = ['kohaku', 'sanke', 'showa', 'ogon', 'asagi', 'tancho', 'bekko', 'kigoi'];

  // receita de cores de uma variedade: base, nadadeiras, manchas [posição na espinha, lado -1..1, raio em larguras, cor, alongamento]
  function koiPattern(kind, rn) {
    const W = C.rice, R = rn.chance(0.3) ? C.ora : C.red, K = C.blk, pt = [];
    const v = { kind, base: W, fin: 'rgba(255,253,246,.9)', dorsal: C.riceD, sheen: 0.22, net: false, patches: pt };
    const reds = n => { for (let k = 0; k < n; k++) pt.push([0.7 + k * (7.4 / n) + rn.range(-0.3, 0.5), rn.range(-0.4, 0.4), rn.range(0.78, 1.2), R, rn.range(1.1, 1.6)]); };
    const spots = (n, c) => { for (let k = 0; k < n; k++) pt.push([rn.range(1.6, 8.6), rn.range(-0.85, 0.85), rn.range(0.2, 0.42), c, 1.2]); };
    if (kind === 'kohaku') reds(rn.int(3, 4));
    else if (kind === 'sanke') { reds(3); spots(rn.int(4, 6), K); }
    else if (kind === 'showa') {
      v.base = K; v.fin = 'rgba(90,82,74,.92)'; v.dorsal = sh(K, -0.3); v.sheen = 0.1;
      reds(3);
      for (let k = 0; k < 4; k++) pt.push([0.2 + k * 2.4 + rn.range(0, 0.8), (k % 2 ? 1 : -1) * rn.range(0.35, 0.8), rn.range(0.55, 0.85), W, 1.3]);
    } else if (kind === 'ogon') { v.base = C.gold; v.fin = 'rgba(255,230,138,.92)'; v.dorsal = C.goldD; v.sheen = 0.55; for (let k = 0; k < 4; k++) pt.push([1.4 + k * 1.9, 0, 0.34, C.goldL, 2.4]); }
    else if (kind === 'kigoi') { v.base = C.yel; v.fin = 'rgba(248,220,124,.92)'; v.dorsal = C.yelD; v.sheen = 0.4; pt.push([0.4, 0, 0.5, C.yelL, 1.2]); }
    else if (kind === 'asagi') {
      v.base = U.mixCss(C.bowlL, C.steel, 0.3); v.fin = 'rgba(226,116,46,.92)'; v.dorsal = C.bowl; v.net = true; v.sheen = 0.12;
      pt.push([0.1, 0, 1.05, C.steelL, 1.1], [0.9, 0.95, 0.42, C.ora, 1.2], [0.9, -0.95, 0.42, C.ora, 1.2]);
      for (let k = 2; k <= 7; k++) pt.push([k, 1.08, 0.36, C.ora, 2], [k, -1.08, 0.36, C.ora, 2]);
    } else if (kind === 'tancho') pt.push([0.72, 0, 0.64, C.red, 1]);
    else spots(rn.int(6, 9), K);                                        // bekko
    v.sheenCss = 'rgba(255,255,255,' + v.sheen + ')';
    return v;
  }

  // E.Koi(pond, n=8, {seed=1, size=1, kinds, sfx=false}) -> { list, update(dt), draw(g,t), add(kind) }: carpas que vagam, desviam da borda,
  //   fogem do toque (pond.ripple) e vêm comer (pond.feed); nunca saem do lago. Fica ligado ao lago: pond.draw() já desenha as carpas.
  function Koi(pond, n, o) {
    o = o || NO;
    const rn = E.RNG('koi' + (o.seed === undefined ? 1 : o.seed)), size = o.size || 1, kinds = o.kinds || KOI_KINDS, list = [], tmp = { x: 0, y: 0 };
    const hw = pond.w / 2, hh = pond.fh / 2, food = pond.food, scares = pond.scares, N = E.Noise;
    const koi = {
      list, _drawn: false,
      // add(kind?) -> peixe: põe mais uma carpa no lago
      add(kind) {
        const L = (26 + rn.range(0, 12)) * size, a = rn.range(0, TAU), f = {
          kind: kind || kinds[list.length % kinds.length], x: 0, y: 0, a, av: 0, speed: 0, len: L, wid: L * 0.125, seg: L * 0.76 / (KS - 1),
          cruise: L * rn.range(0.5, 0.75), ph: rn.range(0, TAU), finPh: rn.range(0, TAU), swim: 1, fear: 0, gulp: 0, ripCd: 0, seed: rn.range(0, 999),
          sp: new Float32Array(KS * 2), pat: null,
        };
        f.pat = koiPattern(f.kind, rn);
        pond.randomPoint(rn, 0.7, tmp); f.x = tmp.x; f.y = tmp.y; f.speed = f.cruise;
        for (let i = 0; i < KS; i++) { f.sp[i * 2] = f.x - Math.cos(a) * f.seg * i; f.sp[i * 2 + 1] = f.y - Math.sin(a) * f.seg * i; }
        list.push(f);
        return f;
      },
      // update(dt): direção (vagar + borda + fuga + comida + espaço entre peixes), velocidade e a cadeia da espinha
      update(dt) {
        const t = pond.t;
        for (let i = 0; i < list.length; i++) {
          const f = list[i], wa = f.a + (N.n1(t * 0.32 + f.seed, 5) - 0.5) * 2.8;
          let dx = Math.cos(wa), dy = Math.sin(wa), fear = 0, eat = 0;
          const q = pond._rho(f.x, f.y);
          if (q > 0.48) {                                                  // desvia da margem
            const k = U.smooth((q - 0.48) / 0.36) * 3.4, ix = -f.x / (hw * hw), iy = -f.y / (hh * hh), il = Math.hypot(ix, iy) || 1;
            dx += ix / il * k; dy += iy / il * k;
          }
          const fleeR = Math.max(46, f.len * 2.6);
          for (let s = 0; s < pond.SCARE_N * 3; s += 3) {                 // foge do toque
            if (scares[s + 2] <= 0) continue;
            const ex = f.x - scares[s], ey = f.y - scares[s + 1], d = Math.hypot(ex, ey);
            if (d < fleeR) { const k = (1 - d / fleeR) * Math.min(1, scares[s + 2] / 0.5); dx += ex / (d || 1) * k * 6; dy += ey / (d || 1) * k * 6; if (k > fear) fear = k; }
          }
          if (fear < 0.15) {                                               // procura a ração mais próxima
            let best = 1e9, bi = -1;
            for (let p = 0; p < pond.FOOD_N * 4; p += 4) { if (food[p + 2] <= 0) continue; const d = Math.hypot(food[p] - f.x, food[p + 1] - f.y); if (d < best) { best = d; bi = p; } }
            if (bi >= 0) {
              const hx = f.x + Math.cos(f.a) * f.wid, hy = f.y + Math.sin(f.a) * f.wid, d = Math.hypot(food[bi] - hx, food[bi + 1] - hy);
              if (d < f.wid * 1.3 + 1.5) {
                food[bi + 2] = 0; f.gulp = 0.45; pond._ring(food[bi], food[bi + 1], 9 * pond.scale, 0.8, 0);
                if (o.sfx && E.Sfx && E.Sfx.play) E.Sfx.play('drip', { vol: 0.35, pitch: 0.9 + Math.random() * 0.4 });
              } else { dx += (food[bi] - f.x) / (best || 1) * 2.6; dy += (food[bi + 1] - f.y) / (best || 1) * 2.6; eat = U.clamp(1.2 - best / (f.len * 6), 0.25, 1); }
            }
          }
          for (let j = 0; j < list.length; j++) {                         // não trombam
            if (j === i) continue;
            const ex = f.x - list[j].x, ey = f.y - list[j].y, d = Math.hypot(ex, ey), rr = (f.len + list[j].len) * 0.3;
            if (d < rr && d > 0.01) { const k = (1 - d / rr) * (eat ? 0.5 : 1.2); dx += ex / d * k; dy += ey / d * k; }
          }
          f.fear = U.damp(f.fear, fear, fear > f.fear ? 14 : 1.6, dt);
          let diff = (Math.atan2(dy, dx) - f.a) % TAU;
          if (diff > PI) diff -= TAU; else if (diff < -PI) diff += TAU;
          const maxT = 1.5 + f.fear * 7 + eat * 1.6;
          f.av = U.damp(f.av, U.clamp(diff * 3.4, -maxT, maxT), 5 + f.fear * 6, dt);
          f.a += f.av * dt;
          const ts = f.cruise * (0.7 + 0.5 * N.n1(t * 0.2 + f.seed * 3, 9)) * (1 + f.fear * 4 + eat * 1.1) * (f.gulp > 0 ? 0.4 : 1);
          f.speed = U.damp(f.speed, ts, ts > f.speed ? 6 : 1.3, dt);
          f.x += Math.cos(f.a) * f.speed * dt; f.y += Math.sin(f.a) * f.speed * dt;
          const q2 = pond._rho(f.x, f.y);
          if (q2 > 0.9) { f.x *= 0.9 / q2; f.y *= 0.9 / q2; }           // trava dura: nunca sai da água
          f.swim = U.damp(f.swim, 0.5 + f.speed / f.cruise * 0.5 + Math.abs(f.av) * 0.22, 4, dt);
          f.ph += dt * (3.4 + f.speed * 5 / f.len); f.finPh += dt * (2.2 + f.speed * 0.05);
          if (f.gulp > 0) f.gulp -= dt;
          if ((f.ripCd -= dt) <= 0 && Math.abs(f.av) > 2.6 && f.speed > f.cruise * 1.5) { f.ripCd = 0.45; pond._ring(f.x, f.y, f.len * 0.55, 0.9, 0); }
          const sp = f.sp;
          sp[0] = f.x; sp[1] = f.y;
          for (let k = 1; k < KS; k++) {
            const ex = sp[k * 2] - sp[k * 2 - 2], ey = sp[k * 2 + 1] - sp[k * 2 - 1], d = Math.hypot(ex, ey) || 1;
            sp[k * 2] = sp[k * 2 - 2] + ex / d * f.seg; sp[k * 2 + 1] = sp[k * 2 - 1] + ey / d * f.seg;
          }
        }
      },
      // draw(g, t): só as carpas (recortadas na água). Não desenha de novo se pond.draw() já desenhou neste frame.
      draw(g, t) {
        if (koi._drawn) { koi._drawn = false; return; }
        koi._paint(g, t === undefined ? pond.t : t);
      },
      _paint(g, t) {
        g.save(); g.translate(pond.x, pond.y); g.scale(1, pond.tilt); g.clip(pond._path);
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.fillStyle = 'rgba(16,36,60,.26)';
        const so = 3.2 * pond.scale + size * 1.5;
        for (let i = 0; i < list.length; i++) { solve(list[i]); g.save(); g.translate(so * 0.7, so); bodyPath(g, list[i]); g.fill(); g.restore(); }
        for (let i = 0; i < list.length; i++) paintKoi(g, list[i]);
        g.restore();
      },
    };
    for (let i = 0; i < (n === undefined ? 8 : n); i++) koi.add();
    pond.koi = koi;
    return koi;
  }

  // calcula a espinha ondulada (BX,BY), normais e larguras de um peixe nos buffers compartilhados
  function solve(f) {
    const sp = f.sp;
    for (let i = 0; i < KS; i++) {
      const a = i === 0 ? 0 : i - 1, b = i === KS - 1 ? i : i + 1;
      let dx = sp[a * 2] - sp[b * 2], dy = sp[a * 2 + 1] - sp[b * 2 + 1];
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const off = Math.sin(f.ph - i * 0.72) * f.wid * 0.62 * Math.pow(i / (KS - 1), 1.35) * f.swim;
      NX[i] = -dy; NY[i] = dx;
      BX[i] = sp[i * 2] - dy * off; BY[i] = sp[i * 2 + 1] + dx * off;
      WD[i] = f.wid * KPROF[i] * (i === 0 && f.gulp > 0 ? 1.12 : 1);
    }
  }
  function bodyPath(g, f) {
    const hx = -NY[0], hy = NX[0], k = WD[0] * 1.85;                     // direção da cabeça
    g.beginPath();
    g.moveTo(BX[0] + NX[0] * WD[0], BY[0] + NY[0] * WD[0]);
    for (let i = 1; i < KS; i++) g.lineTo(BX[i] + NX[i] * WD[i], BY[i] + NY[i] * WD[i]);
    for (let i = KS - 1; i >= 0; i--) g.lineTo(BX[i] - NX[i] * WD[i], BY[i] - NY[i] * WD[i]);
    g.bezierCurveTo(BX[0] - NX[0] * WD[0] + hx * k, BY[0] - NY[0] * WD[0] + hy * k, BX[0] + NX[0] * WD[0] + hx * k, BY[0] + NY[0] * WD[0] + hy * k, BX[0] + NX[0] * WD[0], BY[0] + NY[0] * WD[0]);
    g.closePath();
  }
  function fin(g, bx, by, ang, len, wd, col, ol) {
    const cx = bx + Math.cos(ang) * len * 0.5, cy = by + Math.sin(ang) * len * 0.5;
    g.beginPath(); g.ellipse(cx, cy, len * 0.5 + ol, wd + ol, ang, 0, TAU); g.fillStyle = LINE; g.fill();
    g.beginPath(); g.ellipse(cx, cy, len * 0.5, wd, ang, 0, TAU); g.fillStyle = col; g.fill();
  }
  function paintKoi(g, f) {
    solve(f);
    const v = f.pat, L = f.len, ol = Math.max(0.7, L * 0.03), ha = Math.atan2(NX[0], -NY[0]);
    // cauda: leque com entalhe, atrasada em relação ao corpo
    const e = KS - 1, ta = Math.atan2(BY[e] - BY[e - 1], BX[e] - BX[e - 1]) + Math.sin(f.ph - KS * 0.72 - 0.5) * 0.5 * f.swim, tl = L * 0.27;
    g.beginPath(); g.moveTo(BX[e], BY[e]);
    g.quadraticCurveTo(BX[e] + Math.cos(ta + 0.95) * tl * 0.55, BY[e] + Math.sin(ta + 0.95) * tl * 0.55, BX[e] + Math.cos(ta + 0.5) * tl, BY[e] + Math.sin(ta + 0.5) * tl);
    g.lineTo(BX[e] + Math.cos(ta) * tl * 0.62, BY[e] + Math.sin(ta) * tl * 0.62);
    g.lineTo(BX[e] + Math.cos(ta - 0.5) * tl, BY[e] + Math.sin(ta - 0.5) * tl);
    g.quadraticCurveTo(BX[e] + Math.cos(ta - 0.95) * tl * 0.55, BY[e] + Math.sin(ta - 0.95) * tl * 0.55, BX[e], BY[e]);
    g.strokeStyle = LINE; g.lineWidth = ol * 2; g.stroke(); g.fillStyle = v.fin; g.fill();
    // nadadeiras peitorais (remam) e ventrais
    const flap = Math.sin(f.finPh) * 0.3, turn = U.clamp(f.av * 0.12, -0.35, 0.35), a2 = Math.atan2(NX[2], -NY[2]), a5 = Math.atan2(NX[5], -NY[5]);
    for (let sd = -1; sd <= 1; sd += 2) {
      fin(g, BX[2] + NX[2] * WD[2] * 0.8 * sd, BY[2] + NY[2] * WD[2] * 0.8 * sd, a2 + sd * (2.15 + flap * sd + turn), L * 0.2, L * 0.052, v.fin, ol);
      fin(g, BX[5] + NX[5] * WD[5] * 0.8 * sd, BY[5] + NY[5] * WD[5] * 0.8 * sd, a5 + sd * 2.55, L * 0.11, L * 0.03, v.fin, ol);
    }
    // corpo
    bodyPath(g, f);
    g.strokeStyle = LINE; g.lineWidth = ol * 2; g.stroke();
    g.fillStyle = v.base; g.fill();
    g.save(); g.clip();
    const pt = v.patches;
    for (let k = 0; k < pt.length; k++) {
      const p = pt[k], i0 = Math.min(KS - 2, p[0] | 0), fr = Math.min(1, p[0] - i0), w = WD[i0] + (WD[i0 + 1] - WD[i0]) * fr;
      const px = BX[i0] + (BX[i0 + 1] - BX[i0]) * fr + (NX[i0] + (NX[i0 + 1] - NX[i0]) * fr) * w * p[1], py = BY[i0] + (BY[i0 + 1] - BY[i0]) * fr + (NY[i0] + (NY[i0 + 1] - NY[i0]) * fr) * w * p[1];
      g.fillStyle = p[3]; g.beginPath(); g.ellipse(px, py, p[2] * f.wid * p[4], p[2] * f.wid, Math.atan2(NX[i0], -NY[i0]), 0, TAU); g.fill();
    }
    if (v.net) {                                                         // rede de escamas do asagi
      g.strokeStyle = 'rgba(227,232,238,.6)'; g.lineWidth = Math.max(0.5, L * 0.016);
      g.beginPath();
      for (let i = 2; i <= 8; i++) for (let s = -1; s <= 1; s++) {
        const cx = BX[i] + NX[i] * WD[i] * s * 0.5 - NY[i] * (s === 0 ? 0 : f.seg * 0.5), cy = BY[i] + NY[i] * WD[i] * s * 0.5 + NX[i] * (s === 0 ? 0 : f.seg * 0.5), an = Math.atan2(NX[i], -NY[i]), r = f.wid * 0.3;
        g.moveTo(cx + Math.cos(an + 1.9) * r, cy + Math.sin(an + 1.9) * r); g.arc(cx, cy, r, an + 1.9, an + 4.38);
      }
      g.stroke();
    }
    bodyPath(g, f);                                                      // volume: borda escura por dentro + brilho no dorso
    g.strokeStyle = 'rgba(40,20,8,.2)'; g.lineWidth = f.wid * 0.62; g.stroke();
    g.strokeStyle = v.dorsal; g.lineWidth = f.wid * 0.3;
    g.beginPath(); g.moveTo(BX[3], BY[3]); for (let i = 4; i <= 6; i++) g.lineTo(BX[i], BY[i]); g.stroke();
    g.strokeStyle = v.sheenCss; g.lineWidth = f.wid * 0.42;
    g.beginPath(); g.moveTo(BX[0] - NY[0] * f.wid * 0.5 + NX[0] * f.wid * 0.25, BY[0] + NX[0] * f.wid * 0.5 + NY[0] * f.wid * 0.25);
    for (let i = 1; i <= 3; i++) g.lineTo(BX[i] + NX[i] * WD[i] * 0.3, BY[i] + NY[i] * WD[i] * 0.3);
    g.stroke();
    g.restore();
    // olhos
    const hx = Math.cos(ha), hy = Math.sin(ha), er = Math.max(0.6, L * 0.028);
    g.fillStyle = LINE;
    g.beginPath();
    g.arc(BX[0] + hx * WD[0] * 0.55 + NX[0] * WD[0] * 0.78, BY[0] + hy * WD[0] * 0.55 + NY[0] * WD[0] * 0.78, er, 0, TAU);
    g.arc(BX[0] + hx * WD[0] * 0.55 - NX[0] * WD[0] * 0.78, BY[0] + hy * WD[0] * 0.55 - NY[0] * WD[0] * 0.78, er, 0, TAU);
    g.fill();
    if (f.gulp > 0) {                                                    // boquinha abrindo ao comer
      const q = f.gulp / 0.45, pa = g.globalAlpha;
      g.globalAlpha = pa * q * 0.8; g.strokeStyle = '#FFFFFF'; g.lineWidth = 1;
      g.beginPath(); g.arc(BX[0] + hx * WD[0] * 2.1, BY[0] + hy * WD[0] * 2.1, f.wid * (1.4 - q) * 0.8 + 1, 0, TAU); g.stroke();
      g.globalAlpha = pa;
    }
  }

  /* ======================================================================
     10. Exporta
     ====================================================================== */
  Object.assign(Nature, {
    wind, light, sky, sun, moon, celestial, glow, glows, grade, clouds, fuji, hills, ground, grassTuft,
    tree, bush, flower, rock, torii, lantern, chochin, bridge, bridgeY, fence, paddy, stall, nobori, house, onsen,
    koinobori, windchime, sakuraPetals, fireflies, birds, butterflies,
    TREE_KINDS: ['pine', 'sakura', 'maple', 'bamboo', 'bonsai', 'round'], FLOWER_KINDS: Object.keys(FLOWERS), KOI_KINDS, HOUSE_NAMES,
  });
  E.Nature = Nature;
  E.Pond = Pond;
  E.Koi = Koi;
})();
