/* Pixxel — bundle gerado por tools/build.js em 2026-11-18. Não edite aqui: edite engine/*.js e rode o build.
   Módulos: core, pix, assets, shiba, fx, terrain, rig, audio, nature, ui, board, sim */

/* ===== engine/core.js ===== */
/* ==========================================================================
   Pixxel v1.0 — core.js
   Base de tudo: utilitários (U), RNG, ruído, eventos, pool, tweens, Stage
   (canvas escalável), Input (ponteiro + teclado), Loop, Scenes, Save e timers.
   Zero dependências. Script clássico: carregue ANTES de qualquer outro módulo.
   ========================================================================== */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const E = (root.Pixxel = root.Pixxel || {});
  root.KomeEngine = E;
  // E.reducedMotion: o sistema pediu menos movimento (acessibilidade). fx.flash e tremores devem respeitar.
  try { E.reducedMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { E.reducedMotion = false; }   // nome antigo (Kome Engine), mantido pra projetos que já usavam
  const doc = typeof document !== 'undefined' ? document : null;

  E.version = '1.0.0';

  /* ======================================================================
     U — utilitários de matemática, aleatório, easing, formatação e cor
     ====================================================================== */
  const TAU = Math.PI * 2;
  const DARK = [40, 20, 8, 255];      // marrom das sombras (#281408)
  const LIGHT = [255, 250, 230, 255]; // creme das luzes (#FFFAE6)
  // até vigintilhão (1e63); cada jogo pode continuar com U.addUnits([...]) (×1000 cada nome)
  const FMT_UNITS = ['', 'mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci',
    'undeci', 'duodeci', 'tredeci', 'quatordeci', 'quindeci', 'sexdeci', 'septendeci', 'octodeci', 'novendeci', 'viginti'];
  const colorCache = new Map();       // cache de mixCss/shade (strings -> string)
  const COLOR_CACHE_MAX = 4000;

  // bounce "out" clássico (Penner)
  function bounceOut(t) {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  }

  const ease = {
    // lin(t): linear
    lin: t => t,
    // in(t): cúbica acelerando
    in: t => t * t * t,
    // out(t): cúbica desacelerando (a do rascunho)
    out: t => 1 - Math.pow(1 - t, 3),
    // inOut(t): cúbica acelera e desacelera (a do rascunho)
    inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    // back(t): passa do alvo e volta (a do rascunho)
    back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
    // backIn(t): recua antes de ir
    backIn: t => 2.7 * t * t * t - 1.7 * t * t,
    // backInOut(t): recua, vai e passa do alvo
    backInOut: t => t < 0.5
      ? (Math.pow(2 * t, 2) * (3.5949 * 2 * t - 2.5949)) / 2
      : (Math.pow(2 * t - 2, 2) * (3.5949 * (t * 2 - 2) + 2.5949) + 2) / 2,
    // elastic(t): mola que balança no fim
    elastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1,
    // elasticIn(t): mola que balança no começo
    elasticIn: t => t <= 0 ? 0 : t >= 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (TAU / 3)),
    // bounce(t): quica no fim
    bounce: bounceOut,
    // bounceIn(t): quica no começo
    bounceIn: t => 1 - bounceOut(1 - t),
    // quadIn(t) / quadOut(t) / quadInOut(t): quadráticas
    quadIn: t => t * t,
    quadOut: t => 1 - (1 - t) * (1 - t),
    quadInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    // expoIn(t) / expoOut(t): exponenciais
    expoIn: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
    expoOut: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
    // sine(t): senoidal suave (inOut); sineIn / sineOut
    sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    sineIn: t => 1 - Math.cos((t * Math.PI) / 2),
    sineOut: t => Math.sin((t * Math.PI) / 2),
    // arc(t): 0 -> 1 -> 0 (pulo, pulso); não termina em 1
    arc: t => Math.sin(Math.PI * t),
  };

  // parse de 'rgb(...)'/'rgba(...)' -> [r,g,b,a255]
  function parseRgbFn(s) {
    const m = s.match(/-?[\d.]+/g);
    if (!m || m.length < 3) return [0, 0, 0, 255];
    return [+m[0] | 0, +m[1] | 0, +m[2] | 0, m.length > 3 ? Math.round(+m[3] * 255) : 255];
  }

  function cachePut(k, v) {
    if (colorCache.size >= COLOR_CACHE_MAX) colorCache.clear();
    colorCache.set(k, v);
    return v;
  }

  const hex2 = v => (v < 16 ? '0' : '') + v.toString(16);

  const U = {
    TAU,
    ease,

    /* ---------- matemática ---------- */
    // clamp(v,a,b): limita v ao intervalo [a,b]
    clamp: (v, a, b) => v < a ? a : v > b ? b : v,
    // lerp(a,b,t): interpolação linear
    lerp: (a, b, t) => a + (b - a) * t,
    // invLerp(a,b,v): onde v está entre a e b (0..1, sem limitar)
    invLerp: (a, b, v) => a === b ? 0 : (v - a) / (b - a),
    // remap(v,a,b,c,d): leva v de [a,b] para [c,d] (limitado)
    remap(v, a, b, c, d) {
      const t = a === b ? 0 : (v - a) / (b - a);
      return c + (d - c) * (t < 0 ? 0 : t > 1 ? 1 : t);
    },
    // smooth(t): smoothstep 0..1 (limitado)
    smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); },
    // damp(a,b,k,dt): aproxima a de b com suavização exponencial independente de fps
    damp: (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt)),
    // approach(a,b,step): anda de a até b no máximo `step`, sem passar
    approach: (a, b, step) => a < b ? Math.min(a + step, b) : Math.max(a - step, b),
    // sign(v): -1, 0 ou 1
    sign: v => v > 0 ? 1 : v < 0 ? -1 : 0,
    // wrap(v,a,b): dá a volta em [a,b)
    wrap(v, a, b) { const r = b - a; return r === 0 ? a : a + ((((v - a) % r) + r) % r); },
    // dist(x0,y0,x1,y1): distância entre dois pontos
    dist: (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0),
    // angLerp(a,b,t): interpola ângulos pelo caminho mais curto (radianos)
    angLerp(a, b, t) {
      let d = (b - a) % TAU;
      if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
      return a + d * t;
    },

    /* ---------- aleatório (Math.random; para determinismo use E.RNG) ---------- */
    // rnd(a,b): float em [a,b); rnd() = [0,1); rnd(a) = [0,a)
    rnd(a, b) {
      if (a === undefined) return Math.random();
      if (b === undefined) return Math.random() * a;
      return a + Math.random() * (b - a);
    },
    // irnd(a,b): inteiro em [a,b], inclusivo
    irnd: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
    // pick(arr): elemento aleatório
    pick: a => a[Math.floor(Math.random() * a.length)],
    // chance(p): true com probabilidade p (0..1)
    chance: p => Math.random() < p,
    // shuffle(arr): embaralha no lugar (Fisher-Yates) e devolve arr
    shuffle(arr, rnd) {
      const r = rnd || Math.random;
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1)), tmp = arr[i];
        arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    },

    /* ---------- formatação pt-BR ---------- */
    // fmtInt(n): inteiro com separador de milhar ('1.234.567')
    fmtInt(n) {
      n = Math.floor(+n || 0);
      const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return n < 0 ? '-' + s : s;
    },
    // fmt(n): número curto pt-BR: 1.234 / 12,3 mil / 4,56 mi / bi / tri / ... / deci; acima disso '1,23e36'
    fmt(n) {
      n = +n;
      if (n !== n) return '0';
      if (n < 0) return '-' + U.fmt(-n);
      if (n === Infinity) return '∞';
      n = Math.floor(n);
      if (n < 1e4) return U.fmtInt(n);
      const last = FMT_UNITS.length - 1;
      let i = 0;
      while (n >= 1e3 && i < last) { n /= 1e3; i++; }
      if (n >= 1e3) { // passou de deci: notação científica
        let ex = Math.floor(Math.log10(n)), m = n / Math.pow(10, ex);
        if (m >= 9.995) { m = 1; ex++; }                        // 9,999e36 -> 1,00e37 (e não '10,00e36')
        return m.toFixed(2).replace('.', ',') + 'e' + (ex + i * 3);
      }
      let s = n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0);
      if (+s >= 1e3) {                                          // 999.999 -> 1,00 mi (e não '1000 mil')
        if (i === last) return '1,00e' + (i * 3 + 3);           // 999,9 deci arredonda pra fora da tabela
        i++; s = '1.00';
      }
      else if (+s >= 100 && s.indexOf('.') >= 0) s = (+s).toFixed(0); // 99,96 -> 100
      else if (+s >= 10 && s.length > 4) s = (+s).toFixed(1);  // 9,999 -> 10,0
      return s.replace('.', ',') + ' ' + FMT_UNITS[i];
    },
    // addUnits(['arrozilhão', ...]): continua a escala de nomes depois do último (cada um ×1000)
    addUnits(list) { for (const u of list || []) if (FMT_UNITS.indexOf(u) < 0) FMT_UNITS.push(u); return FMT_UNITS.length; },
    unitIndex(n) { let i = 0; n = Math.abs(+n) || 0; while (n >= 1e3 && i < FMT_UNITS.length - 1) { n /= 1e3; i++; } return i; },
    // fmtTime(s): duração curta: '45s' / '3min 20s' / '1h 02min' / '2d 03h'
    fmtTime(s) {
      s = Math.max(0, Math.floor(+s || 0));
      const p2 = v => (v < 10 ? '0' : '') + v;
      if (s < 60) return s + 's';
      if (s < 3600) return Math.floor(s / 60) + 'min ' + p2(s % 60) + 's';
      if (s < 86400) return Math.floor(s / 3600) + 'h ' + p2(Math.floor((s % 3600) / 60)) + 'min';
      return Math.floor(s / 86400) + 'd ' + p2(Math.floor((s % 86400) / 3600)) + 'h';
    },
    // pct(f, casas=0): fração 0..1 -> '42%'
    pct: (f, d) => ((+f || 0) * 100).toFixed(d || 0).replace('.', ',') + '%',

    /* ---------- cor ---------- */
    // hex(h) -> [r,g,b,a255]: aceita '#rgb', '#rrggbb', '#rrggbbaa', 'rgb(a)(...)' ou array (devolve cópia)
    hex(h) {
      if (Array.isArray(h)) return [h[0], h[1], h[2], h.length > 3 ? h[3] : 255];
      h = String(h).trim();
      if (h.charCodeAt(0) !== 35 && /^rgba?\(/i.test(h)) return parseRgbFn(h);
      h = h.replace('#', '');
      if (h.length === 3 || h.length === 4) h = h.replace(/./g, '$&$&');
      const n = parseInt(h.slice(0, 6), 16) || 0;
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255];
    },
    // rgba(c,a) -> 'rgba(r,g,b,a)': cor (hex ou array) com alfa 0..1
    rgba(c, a) {
      const v = Array.isArray(c) ? c : U.hex(c);
      return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + (a === undefined ? (v.length > 3 ? v[3] / 255 : 1) : a) + ')';
    },
    // css(c) -> string CSS: string passa direto; [r,g,b,a] vira '#rrggbb' ou 'rgba(...)'
    css(c) {
      if (!Array.isArray(c)) return c;
      if (c.length > 3 && c[3] < 255) return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + +(c[3] / 255).toFixed(3) + ')';
      return '#' + hex2(c[0] & 255) + hex2(c[1] & 255) + hex2(c[2] & 255);
    },
    // mix(a,b,t) -> [r,g,b,255]: mistura duas cores (hex ou array)
    mix(a, b, t) {
      a = Array.isArray(a) ? a : U.hex(a);
      b = Array.isArray(b) ? b : U.hex(b);
      return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255];
    },
    // mixCss(a,b,t) -> '#rrggbb' (com cache quando a e b são strings)
    mixCss(a, b, t) {
      const cacheable = typeof a === 'string' && typeof b === 'string';
      let k;
      if (cacheable) { k = a + '|' + b + '|' + t; const hit = colorCache.get(k); if (hit) return hit; }
      const v = U.css(U.mix(a, b, t));
      return cacheable ? cachePut(k, v) : v;
    },
    // shade(c,k) -> css: k<0 escurece com marrom, k>0 clareia com creme (estilo Kome)
    shade(c, k) {
      const cacheable = typeof c === 'string';
      let key;
      if (cacheable) { key = c + '~' + k; const hit = colorCache.get(key); if (hit) return hit; }
      const v = U.css(k < 0 ? U.mix(c, DARK, -k) : U.mix(c, LIGHT, k));
      return cacheable ? cachePut(key, v) : v;
    },
  };
  E.U = U;

  /* ======================================================================
     hash / RNG — determinismo
     ====================================================================== */
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);

  // mistura de 32 bits (finalizador do murmur3)
  function mix32(h) {
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }

  // hash de string (FNV-1a) -> uint32
  function hashStr(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return mix32(h);
  }

  // E.hash(n, m=0) -> 0..1: hash determinístico de um número (inteiro ou fracionário); m é um segundo número opcional
  function hash(n, m) {
    f64[0] = +n;
    let h = mix32(u32[0] ^ Math.imul(u32[1], 0x9e3779b1) ^ 0x2545f491);
    if (m !== undefined) { f64[0] = +m; h = mix32(h ^ u32[0] ^ Math.imul(u32[1], 0x9e3779b1) ^ 0x68e31da4); }
    return h / 4294967296;
  }
  hash.str = hashStr; // E.hash.str(texto) -> uint32
  E.hash = hash;

  // E.RNG(seed) -> r(): gerador mulberry32 determinístico; seed pode ser número ou string
  function RNG(seed) {
    if (seed === undefined || seed === null) seed = (Math.random() * 4294967296) >>> 0;
    const seed0 = (typeof seed === 'string' ? hashStr(seed) : mix32(Math.floor(+seed) ^ ((+seed % 1) * 4294967296))) >>> 0;
    let a = seed0;
    // r(): float em [0,1)
    function r() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    r.seed = seed0;
    // r.range(a,b): float em [a,b)
    r.range = (lo, hi) => lo + r() * (hi - lo);
    // r.int(a,b): inteiro em [a,b], inclusivo
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    // r.pick(arr): elemento aleatório
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    // r.chance(p): true com probabilidade p
    r.chance = p => r() < p;
    // r.sign(): -1 ou 1
    r.sign = () => (r() < 0.5 ? -1 : 1);
    // r.gauss(): normal aproximada (média 0, desvio ~1)
    r.gauss = () => (r() + r() + r() + r() + r() + r() - 3) * 1.4142;
    // r.shuffle(arr): embaralha no lugar
    r.shuffle = arr => U.shuffle(arr, r);
    // r.fork(n): novo RNG independente derivado de (seed, n); não consome o estado deste
    r.fork = n => RNG(mix32(seed0 ^ Math.imul((typeof n === 'string' ? hashStr(n) : n | 0) + 1, 0x9e3779b1)));
    // r.reset(): volta ao começo da sequência
    r.reset = () => { a = seed0; return r; };
    return r;
  }
  E.RNG = RNG;

  /* ======================================================================
     Noise — value noise suave, saída 0..1
     ====================================================================== */
  // valor pseudoaleatório 0..1 num ponto inteiro da grade
  function lat(ix, iy, seed) {
    let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul((seed | 0) + 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }

  const Noise = {
    // n1(x, seed=0) -> 0..1: ruído suave 1D
    n1(x, seed) {
      const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
      const a = lat(i, 0, seed), b = lat(i + 1, 0, seed);
      return a + (b - a) * u;
    },
    // n2(x, y, seed=0) -> 0..1: ruído suave 2D
    n2(x, y, seed) {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const a = lat(ix, iy, seed), b = lat(ix + 1, iy, seed), c = lat(ix, iy + 1, seed), d = lat(ix + 1, iy + 1, seed);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    },
    // fbm1(x, oct=4, seed=0) -> 0..1: soma de oitavas 1D
    fbm1(x, oct, seed) {
      oct = oct || 4; seed = seed | 0;
      let s = 0, amp = 0.5, tot = 0;
      for (let o = 0; o < oct; o++) { s += Noise.n1(x, seed + o * 131) * amp; tot += amp; x *= 2; amp *= 0.5; }
      return s / tot;
    },
    // fbm2(x, y, oct=4, seed=0) -> 0..1: soma de oitavas 2D
    fbm2(x, y, oct, seed) {
      oct = oct || 4; seed = seed | 0;
      let s = 0, amp = 0.5, tot = 0;
      for (let o = 0; o < oct; o++) { s += Noise.n2(x, y, seed + o * 131) * amp; tot += amp; x *= 2; y *= 2; amp *= 0.5; }
      return s / tot;
    },
  };
  E.Noise = Noise;

  /* ======================================================================
     Emitter — eventos
     ====================================================================== */
  // E.Emitter() -> { on(ev,fn)->off, off(ev,fn), once(ev,fn)->off, emit(ev,a,b,c,d)->n, clear(ev?) }
  function Emitter() {
    let map = Object.create(null);
    const em = {
      // on(ev, fn) -> off(): escuta um evento; devolve a função que cancela
      on(ev, fn) {
        const l = map[ev];
        map[ev] = l ? l.concat(fn) : [fn]; // copia ao alterar: emit em andamento não é afetado
        return () => em.off(ev, fn);
      },
      // off(ev, fn): para de escutar
      off(ev, fn) {
        const l = map[ev];
        if (!l) return;
        const i = l.indexOf(fn);
        if (i < 0) return;
        if (l.length === 1) delete map[ev];
        else { const c = l.slice(); c.splice(i, 1); map[ev] = c; }
      },
      // once(ev, fn) -> off(): escuta só a próxima emissão
      once(ev, fn) {
        const off = em.on(ev, function (a, b, c, d) { off(); fn(a, b, c, d); });
        return off;
      },
      // emit(ev, a, b, c, d) -> quantos ouviram (até 4 argumentos, sem alocar)
      emit(ev, a, b, c, d) {
        const l = map[ev];
        if (!l) return 0;
        for (let i = 0; i < l.length; i++) l[i](a, b, c, d);
        return l.length;
      },
      // clear(ev?): remove os ouvintes de um evento, ou todos
      clear(ev) { if (ev === undefined) map = Object.create(null); else delete map[ev]; },
    };
    return em;
  }
  E.Emitter = Emitter;

  /* ======================================================================
     Pool — reaproveita objetos pra não alocar em caminho quente
     ====================================================================== */
  // E.Pool(make, reset) -> { get(...args), free(o), size (livres), made (criados), prealloc(n) }
  function Pool(make, reset) {
    const free = [];
    const pool = {
      made: 0,
      // get(a,b,c): pega um objeto livre (ou cria) e chama reset(o,a,b,c)
      get(a, b, c) {
        let o;
        if (free.length) o = free.pop(); else { o = make(); pool.made++; }
        if (reset) reset(o, a, b, c);
        return o;
      },
      // free(o): devolve o objeto ao pool
      free(o) { free.push(o); },
      // prealloc(n): cria n objetos de antemão
      prealloc(n) { for (let i = 0; i < n; i++) { free.push(make()); pool.made++; } return pool; },
    };
    Object.defineProperty(pool, 'size', { get: () => free.length });
    return pool;
  }
  E.Pool = Pool;

  /* ======================================================================
     Tween — gerenciador global de interpolações
     ====================================================================== */
  const tweens = [];
  let generation = 0; // muda a cada clear(): um update em andamento para de percorrer a lista antiga

  // resolve ease por nome ou função
  function resolveEase(e) {
    if (typeof e === 'function') return e;
    return ease[e] || ease.out;
  }

  function TweenItem(obj, props, dur, o) {
    this.obj = obj;
    this.keys = props ? Object.keys(props) : [];
    this.to = this.keys.map(k => +props[k]);
    this.from = new Array(this.keys.length);
    this.dur = dur > 0 ? dur : 0;
    this.t = 0;
    this.delay = (o && o.delay) || 0;
    this.ease = resolveEase(o && o.ease);
    this.onUpdate = (o && o.onUpdate) || null;
    this.onDone = (o && o.onDone) || null;
    this.repeat = (o && o.repeat) || 0;   // -1 = infinito
    this.yoyo = !!(o && o.yoyo);
    this.cycle = 0;
    this.started = false;
    this.dead = false;
    this.done = false;
  }
  // cancel(): para o tween onde está (não chama onDone)
  TweenItem.prototype.cancel = function () { this.dead = true; };
  // finish(): pula pro valor final e chama onDone
  TweenItem.prototype.finish = function () {
    if (this.dead) return;
    this.delay = 0; this.repeat = 0;
    this._step(this.dur - this.t + 1e-6);
  };
  TweenItem.prototype._apply = function (k) {
    const back = this.yoyo && (this.cycle & 1) === 1;
    const e = this.ease(back ? 1 - k : k), keys = this.keys, o = this.obj;
    for (let i = 0; i < keys.length; i++) o[keys[i]] = this.from[i] + (this.to[i] - this.from[i]) * e;
    if (this.onUpdate) this.onUpdate(o, k);
  };
  TweenItem.prototype._step = function (dt) {
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay > 0) return;
      dt = -this.delay; this.delay = 0;
    }
    if (!this.started) { // valores de partida lidos quando o tween começa de verdade
      this.started = true;
      for (let i = 0; i < this.keys.length; i++) this.from[i] = +this.obj[this.keys[i]] || 0;
    }
    this.t += dt;
    const k = this.dur > 0 ? Math.min(1, this.t / this.dur) : 1;
    this._apply(k);
    if (k < 1 || this.dead) return; // dead: cancelado/morto de dentro do próprio onUpdate
    if (this.repeat !== 0 && this.dur > 0) {
      if (this.repeat > 0) this.repeat--;
      this.t -= this.dur; this.cycle++;
      return;
    }
    this.dead = true; this.done = true;
    if (this.onDone) this.onDone(this.obj);
  };

  const Tween = {
    ease,
    // to(obj, {prop:valor}, dur, {ease, delay, onUpdate(obj,k), onDone(obj), repeat, yoyo}) -> handle{cancel(), finish(), done}
    to(obj, props, dur, opts) {
      const tw = new TweenItem(obj, props, dur, opts);
      tweens.push(tw);
      return tw;
    },
    // wait(dur, fn) -> handle: chama fn depois de dur segundos (no tempo do jogo)
    wait(dur, fn) {
      const tw = new TweenItem(null, null, dur, null);
      tw.onDone = fn || null;
      tweens.push(tw);
      return tw;
    },
    // update(dt): avança todos os tweens (o Loop chama sozinho)
    update(dt) {
      const n = tweens.length, gen = generation; // tweens criados dentro de callbacks só andam no próximo frame
      for (let i = 0; i < n && i < tweens.length && gen === generation; i++) {
        const tw = tweens[i];
        if (!tw.dead) tw._step(dt);
      }
      let j = 0;
      for (let i = 0; i < tweens.length; i++) if (!tweens[i].dead) tweens[j++] = tweens[i];
      tweens.length = j;
    },
    // killOf(obj): cancela todos os tweens de um objeto
    killOf(obj) { for (let i = 0; i < tweens.length; i++) if (tweens[i].obj === obj) tweens[i].dead = true; },
    // clear(): cancela tudo
    clear() { for (let i = 0; i < tweens.length; i++) tweens[i].dead = true; tweens.length = 0; generation++; },
  };
  Object.defineProperty(Tween, 'count', { get: () => tweens.length });
  E.Tween = Tween;

  /* ======================================================================
     Timers — E.every / E.cooldown (avançados na mão com tick(dt))
     ====================================================================== */
  // E.every(sec, fn) -> { tick(dt), reset(), sec, t }: chama fn a cada `sec` segundos (recupera atrasos, até 1000 por tick)
  function every(sec, fn) {
    const h = {
      sec, t: 0,
      tick(dt) {
        h.t += dt;
        let n = 0;
        while (h.t >= h.sec && h.sec > 0 && n++ < 1000) { h.t -= h.sec; fn(h); }
        if (h.t > h.sec) h.t = 0;
      },
      reset() { h.t = 0; },
    };
    return h;
  }

  // E.cooldown(sec) -> { ready(), use()->bool, tick(dt), reset(), frac (0..1; 1 = pronto), sec, left }
  function cooldown(sec) {
    const c = {
      sec, left: 0,
      // ready(): pode usar?
      ready() { return c.left <= 0; },
      // use(): se estiver pronto, começa a recarga e devolve true
      use() { if (c.left > 0) return false; c.left = c.sec; return true; },
      // tick(dt): avança a recarga
      tick(dt) { if (c.left > 0) c.left = Math.max(0, c.left - dt); },
      // reset(): fica pronto na hora
      reset() { c.left = 0; },
    };
    Object.defineProperty(c, 'frac', { get: () => (c.sec > 0 ? 1 - c.left / c.sec : 1) });
    return c;
  }
  E.every = every;
  E.cooldown = cooldown;
  E.Timer = { every, cooldown };

  /* ======================================================================
     Stage — canvas com tamanho lógico fixo, escalado pra caber na janela/pai
     Estrutura DOM:  host (tamanho já escalado, centralizado)
                       └ el (tamanho lógico, transform: scale)  <- camadas de UI entram aqui
                           └ canvas
     ====================================================================== */
  // E.Stage({canvas|parent, width=960, height=540, fit='contain'|'cover'|'none', maxDpr=2, bg, pixelated=false, integer=false, maxScale, margin=0}) -> stage
  //   stage.setMaxDpr(v) troca o teto depois (resolução adaptativa)
  function Stage(opts) {
    opts = opts || {};
    if (!doc) throw new Error('Pixxel: E.Stage precisa de um documento (DOM)');
    const q = v => (typeof v === 'string' ? doc.querySelector(v) : v);
    const w = opts.width || 960, h = opts.height || 540;
    const fit = opts.fit || 'contain', pixelated = !!opts.pixelated;
    let maxDpr = opts.maxDpr || 2;
    const em = Emitter();

    let cv = q(opts.canvas) || doc.createElement('canvas');
    const parent = q(opts.parent) || cv.parentNode || doc.body;
    const windowed = parent === doc.body || parent === doc.documentElement;

    // pai sem altura definida: o stage entra no fluxo e usa a altura da janela como limite (medido antes de mexer no DOM)
    const hadCv = cv.parentNode === parent, cvDisp = cv.style.display;
    if (hadCv) cv.style.display = 'none';
    const inFlow = !windowed && parent.clientHeight < 2;
    if (hadCv) cv.style.display = cvDisp;

    /* ---------- DOM ---------- */
    const host = doc.createElement('div');
    const el = doc.createElement('div');
    host.className = 'k-stage-host';
    el.className = 'k-stage';
    if (cv.parentNode) cv.parentNode.insertBefore(host, cv); else parent.appendChild(host);
    host.appendChild(el);
    el.appendChild(cv);

    if (!windowed && !inFlow && root.getComputedStyle && getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    host.style.cssText = 'position:' + (windowed ? 'fixed' : inFlow ? 'relative' : 'absolute') + ';left:0;top:0;overflow:visible;';
    el.style.cssText = 'position:relative;width:' + w + 'px;height:' + h + 'px;transform-origin:0 0;overflow:hidden;' +
      'touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;';
    cv.style.cssText += ';position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px;display:block;touch-action:none;' +
      (pixelated ? 'image-rendering:pixelated;image-rendering:crisp-edges;' : '');

    const g = cv.getContext('2d', { alpha: !opts.bg });
    const out = { x: 0, y: 0 };
    const stage = {
      cv, g, w, h, el, host, dpr: 1, scale: 1, bg: opts.bg || null, pixelated,
      // on('resize', fn(stage)) -> off
      on: em.on,
      // toStage(evt|{clientX,clientY}, out?) -> {x,y}: coordenadas do cliente -> coordenadas lógicas do stage
      toStage(evt, o) {
        o = o || out;
        const r = el.getBoundingClientRect();
        o.x = r.width > 0 ? ((evt.clientX - r.left) / r.width) * w : 0;
        o.y = r.height > 0 ? ((evt.clientY - r.top) / r.height) * h : 0;
        return o;
      },
      // toClient(x, y) -> {x,y}: coordenadas do stage -> coordenadas do cliente (pra posicionar DOM fora do stage)
      toClient(x, y) {
        const r = el.getBoundingClientRect();
        return { x: r.left + (x / w) * r.width, y: r.top + (y / h) * r.height };
      },
      // resize(): recalcula escala, posição e resolução (chamado sozinho em resize/rotação)
      resize() {
        const m = opts.margin || 0;
        const aw = Math.max(1, (windowed ? root.innerWidth : parent.clientWidth) - m * 2);
        const ah = Math.max(1, (windowed || inFlow ? root.innerHeight : parent.clientHeight) - m * 2);
        const f = typeof fit === 'function' ? fit(aw, ah) : fit;   // fit pode ser função (aw, ah) -> 'contain'|'cover'|'none'
        let s = f === 'none' ? (opts.scale || 1) : f === 'cover' ? Math.max(aw / w, ah / h) : Math.min(aw / w, ah / h);
        if (opts.maxScale) s = Math.min(s, opts.maxScale);
        if (opts.integer && s >= 1) s = Math.floor(s);
        if (!(s > 0) || !isFinite(s)) s = 1;
        stage.scale = s;
        host.style.width = w * s + 'px';
        host.style.height = h * s + 'px';
        if (inFlow) host.style.margin = m + 'px auto';
        else {
          host.style.left = Math.round((aw - w * s) / 2 + m) + 'px';
          host.style.top = Math.round((ah - h * s) / 2 + m) + 'px';
        }
        el.style.transform = 'scale(' + s + ')';
        // resolução interna: pixels reais na tela, em degraus de 0,25, entre 1 e maxDpr
        let dpr = pixelated ? (opts.pixelScale || 1) : Math.ceil((root.devicePixelRatio || 1) * s * 4 - 1e-6) / 4;
        dpr = Math.max(1, Math.min(maxDpr, dpr));
        const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
        if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
        stage.dpr = bw / w;
        g.imageSmoothingEnabled = !pixelated;
        em.emit('resize', stage);
        return stage;
      },
      // setMaxDpr(v): muda o teto da resolução interna (resolução adaptativa: celular lento desce um degrau) e refaz o tamanho
      setMaxDpr(v) { v = Math.max(1, +v || 2); if (v === maxDpr) return stage; maxDpr = v; return stage.resize(); },
      get maxDpr() { return maxDpr; },
      // begin(): setTransform(dpr) + limpa (com bg se houver); chamar no começo de cada render
      begin() {
        const d = stage.dpr;
        g.setTransform(d, 0, 0, d, 0, 0);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        if (stage.bg) { g.fillStyle = stage.bg; g.fillRect(0, 0, w, h); }
        else g.clearRect(0, 0, w, h);
        return g;
      },
      // layer(className?) -> div: cria uma camada DOM do tamanho do stage por cima do canvas (escala junto)
      layer(cls) {
        const d = doc.createElement('div');
        if (cls) d.className = cls;
        d.style.cssText = 'position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px;pointer-events:none;';
        el.appendChild(d);
        return d;
      },
      // destroy(): remove ouvintes (o DOM fica)
      destroy() {
        root.removeEventListener('resize', onResize);
        root.removeEventListener('orientationchange', onResize);
        if (root.visualViewport) root.visualViewport.removeEventListener('resize', onResize);
        if (ro) ro.disconnect();
        em.clear();
      },
    };

    /* ---------- ouvintes de tamanho ---------- */
    let pending = 0;
    function onResize() {
      stage.resize();
      // alguns navegadores móveis só atualizam innerWidth/Height um pouco depois da rotação
      clearTimeout(pending);
      pending = setTimeout(stage.resize, 250);
    }
    root.addEventListener('resize', onResize);
    root.addEventListener('orientationchange', onResize);
    if (root.visualViewport) root.visualViewport.addEventListener('resize', onResize);
    let ro = null;
    if (!windowed && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => stage.resize()); ro.observe(parent); }

    stage.resize();
    return stage;
  }
  E.Stage = Stage;

  /* ======================================================================
     Input — ponteiro unificado (mouse + touch + caneta) e teclado
     ====================================================================== */
  // E.Input(stage, {wheel=true, keys=true}) -> input
  function Input(stage, opts) {
    opts = opts || {};
    const em = Emitter();
    const target = stage.cv;
    const TAP_MS = 350, TAP_DIST = 12;
    let primary = -1;          // pointerId do ponteiro que manda (o primeiro a encostar)
    let downT = 0, moved = 0;
    const keysHit = [], keysUp = []; // códigos apertados/soltos neste frame (reaproveitados)

    const input = {
      x: stage.w / 2, y: stage.h / 2,     // posição em coords do stage
      dx: 0, dy: 0,                         // movimento acumulado neste frame
      downX: 0, downY: 0,                   // onde o ponteiro encostou
      down: false, pressed: false, released: false, tapped: false, // pressed/released/tapped valem por 1 frame
      inside: false,                        // ponteiro em cima do stage
      touch: false,                         // último ponteiro foi toque
      button: 0,                            // botão do mouse do último down (0 esq, 2 dir)
      pointers: 0,                          // quantos dedos/ponteiros encostados
      wheel: 0,                             // rolagem acumulada neste frame (+ pra baixo, em "cliques")
      keys: Object.create(null),            // keys[code] = true enquanto apertada (KeyboardEvent.code)
      anyKey: false,                        // alguma tecla foi apertada neste frame
      // on('down'|'up'|'move'|'tap'|'key'|'keyup'|'wheel', fn) -> off ; down/up/move/tap: fn(x,y,evt) ; key: fn(code,evt)
      on: em.on,
      // keyPressed(code): a tecla foi apertada neste frame?
      keyPressed(code) { return keysHit.indexOf(code) >= 0; },
      // keyReleased(code): a tecla foi solta neste frame?
      keyReleased(code) { return keysUp.indexOf(code) >= 0; },
      // axis(neg, pos): -1/0/1 a partir de duas teclas (ex.: axis('KeyA','KeyD'))
      axis(neg, pos) { return (input.keys[pos] ? 1 : 0) - (input.keys[neg] ? 1 : 0); },
      // endFrame(): zera as flags de 1 frame (o Loop chama se receber {input})
      endFrame() {
        input.pressed = input.released = input.tapped = input.anyKey = false;
        input.dx = input.dy = input.wheel = 0;
        keysHit.length = 0; keysUp.length = 0;
      },
      // reset(): solta tudo (usado quando a janela perde o foco)
      reset() {
        for (const k in input.keys) input.keys[k] = false;
        if (input.down) { input.down = false; input.released = true; }
        primary = -1; input.pointers = 0;
      },
      // destroy(): remove todos os ouvintes
      destroy() {
        for (let i = 0; i < subs.length; i++) subs[i][0].removeEventListener(subs[i][1], subs[i][2], subs[i][3]);
        subs.length = 0; em.clear();
      },
    };

    const subs = [];
    function listen(t, ev, fn, o) { t.addEventListener(ev, fn, o); subs.push([t, ev, fn, o]); }

    function moveTo(e) {
      const ox = input.x, oy = input.y;
      stage.toStage(e, input);
      input.dx += input.x - ox; input.dy += input.y - oy;
      input.inside = input.x >= 0 && input.y >= 0 && input.x <= stage.w && input.y <= stage.h;
    }

    /* ---------- ponteiro ---------- */
    listen(target, 'pointerdown', e => {
      input.pointers++;
      if (primary !== -1 && e.pointerId !== primary) return; // segundo dedo: conta mas não manda
      primary = e.pointerId;
      input.touch = e.pointerType === 'touch';
      const ox = input.x, oy = input.y;
      stage.toStage(e, input);
      if (!input.touch) { input.dx += input.x - ox; input.dy += input.y - oy; } // no toque o "pulo" até o dedo não é movimento
      input.inside = true;
      input.down = true; input.pressed = true; input.button = e.button || 0;
      input.downX = input.x; input.downY = input.y;
      downT = e.timeStamp; moved = 0;
      try { target.setPointerCapture(e.pointerId); } catch (err) { /* sem captura: seguimos pelo window */ }
      if (e.pointerType !== 'mouse' && e.cancelable) e.preventDefault();
      em.emit('down', input.x, input.y, e);
    });

    listen(root, 'pointermove', e => {
      if (primary !== -1 ? e.pointerId !== primary : e.pointerType === 'touch') return;
      if (primary === -1 && e.target !== target) { // mouse passeando fora do canvas (em cima de UI, por ex.)
        if (input.inside) { input.inside = false; }
        return;
      }
      const ox = input.x, oy = input.y;
      moveTo(e);
      moved += Math.abs(input.x - ox) + Math.abs(input.y - oy);
      em.emit('move', input.x, input.y, e);
    });

    function onUp(e) {
      input.pointers = Math.max(0, input.pointers - 1);
      if (e.pointerId !== primary) return;
      primary = -1;
      if (e.type !== 'pointercancel') moveTo(e);
      input.down = false; input.released = true;
      if (input.touch) input.inside = false;
      em.emit('up', input.x, input.y, e);
      if (e.type !== 'pointercancel' && e.timeStamp - downT < TAP_MS && moved < TAP_DIST) {
        input.tapped = true;
        em.emit('tap', input.x, input.y, e);
      }
      if (e.pointerType === 'mouse') input.pointers = 0;
    }
    listen(root, 'pointerup', onUp);
    listen(root, 'pointercancel', onUp);
    listen(target, 'pointerleave', e => { if (primary === -1 && e.pointerType !== 'touch') input.inside = false; });

    // sem menu de contexto, sem arrastar/selecionar, sem scroll/zoom por toque em cima do stage
    listen(stage.el, 'contextmenu', e => e.preventDefault());
    listen(target, 'dragstart', e => e.preventDefault());
    listen(target, 'touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    listen(target, 'touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });

    if (opts.wheel !== false) {
      listen(target, 'wheel', e => {
        const d = e.deltaMode === 1 ? e.deltaY / 3 : e.deltaMode === 2 ? e.deltaY : e.deltaY / 100;
        input.wheel += d;
        if (e.cancelable) e.preventDefault();
        em.emit('wheel', d, e);
      }, { passive: false });
    }

    /* ---------- teclado ---------- */
    function typing(e) {
      const t = e.target, n = t && t.tagName;
      return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || (t && t.isContentEditable);
    }
    if (opts.keys !== false) {
      listen(root, 'keydown', e => {
        if (typing(e)) return;
        const c = e.code || e.key;
        if (!input.keys[c]) { keysHit.push(c); input.anyKey = true; em.emit('key', c, e); }
        input.keys[c] = true;
      });
      listen(root, 'keyup', e => {
        const c = e.code || e.key;
        if (input.keys[c]) { keysUp.push(c); em.emit('keyup', c, e); }
        input.keys[c] = false;
      });
    }
    listen(root, 'blur', () => input.reset());
    if (doc) listen(doc, 'visibilitychange', () => { if (doc.hidden) input.reset(); });

    return input;
  }
  E.Input = Input;

  /* ======================================================================
     Loop — requestAnimationFrame com dt limitado e passo fixo opcional
     ====================================================================== */
  // E.Loop({update(dt), render(alpha, dt), fixed=0, maxDt=.05, input, maxSteps=5, tweens=true, onVisibility(hidden)}) -> loop
  //   tweens:false = este loop NÃO avança o E.Tween global (use num segundo loop na mesma página, senão os tweens andam 2x)
  function Loop(o) {
    o = o || {};
    const driveTweens = o.tweens !== false;
    const fixed = o.fixed || 0, maxDt = o.maxDt || 0.05, maxSteps = o.maxSteps || 5;
    const update = o.update || null, render = o.render || null, input = o.input || null;
    const raf = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : fn => setTimeout(() => fn(Date.now()), 16);
    const caf = root.cancelAnimationFrame ? root.cancelAnimationFrame.bind(root) : clearTimeout;
    let id = 0, last = 0, acc = 0;

    const loop = {
      paused: false,     // true: não chama update nem tweens (render continua)
      timeScale: 1,      // câmera lenta / acelerar
      time: 0,           // tempo de jogo acumulado (s)
      dt: 0,             // dt do último frame (já com timeScale e clamp)
      fps: 60,           // fps suavizado
      frame: 0,          // contador de frames
      running: false,
      // start(): começa (idempotente)
      start() {
        if (loop.running) return loop;
        loop.running = true; last = 0;
        id = raf(tick);
        return loop;
      },
      // stop(): para
      stop() { loop.running = false; caf(id); id = 0; return loop; },
      // step(dtReal): roda um frame na mão (testes, replays); respeita maxDt, timeScale e paused
      step(dtReal) {
        let dt = Math.min(dtReal, maxDt) * loop.timeScale, alpha = 1;
        if (loop.paused || !(dt > 0)) dt = 0;
        loop.dt = dt;
        if (!loop.paused) {
          if (driveTweens) Tween.update(dt);
          if (fixed > 0) {
            acc += dt;
            let n = 0;
            while (acc >= fixed && n < maxSteps) {
              if (update) update(fixed);
              acc -= fixed; loop.time += fixed;
              if (++n === 1 && input) input.endFrame(); // flags de 1 frame: só o primeiro passo vê
            }
            if (acc >= fixed) acc = 0; // não deixa virar bola de neve
            alpha = acc / fixed;
          } else {
            if (update) update(dt);
            loop.time += dt;
          }
        }
        if (render) render(alpha, dt);
        if (input && (!fixed || loop.paused)) input.endFrame();
        loop.frame++;
      },
    };

    function tick(ts) {
      if (!loop.running) return;
      id = raf(tick); // agenda antes: um erro no update não mata o jogo
      let dtReal = last ? (ts - last) / 1000 : 1 / 60;
      last = ts;
      if (dtReal > 0.25 || dtReal < 0) dtReal = 1 / 60; // voltou de aba oculta/debugger: sem salto de tempo
      else if (dtReal > 0) loop.fps += (Math.min(1 / dtReal, 1000) - loop.fps) * 0.08;
      loop.step(dtReal);
    }

    if (doc) {
      doc.addEventListener('visibilitychange', () => {
        last = 0; // o próximo frame conta como 1/60 s, não como o tempo todo que ficou oculto
        if (o.onVisibility) o.onVisibility(doc.hidden);
      });
    }
    return loop;
  }
  E.Loop = Loop;

  /* ======================================================================
     Scenes — pilha de cenas (go troca tudo; push/pop empilha, ex.: pausa)
     ====================================================================== */
  // E.Scenes.create() -> gerenciador de cenas independente (E.Scenes é o global)
  function SceneManager() {
    const defs = Object.create(null), stack = [], em = Emitter();
    const S = {
      current: null,     // cena do topo
      name: '',          // nome da cena do topo
      // on('change', fn(nome, cena)) -> off
      on: em.on,
      // add(nome, {enter(args), exit(), update(dt), render(g), pause(), resume()}) -> Scenes
      add(name, scene) { scene.name = scene.name || name; defs[name] = scene; return S; },
      // has(nome) -> bool
      has(name) { return !!defs[name]; },
      // go(nome, args): sai de todas as cenas da pilha e entra na nova
      go(name, args) {
        const sc = need(name);
        while (stack.length) { const s = stack.pop(); if (s.exit) s.exit(); }
        stack.push(sc); sync();
        if (sc.enter) sc.enter(args);
        return sc;
      },
      // push(nome, args): empilha por cima (a de baixo recebe pause() e continua sendo desenhada)
      push(name, args) {
        const sc = need(name), top = S.current;
        if (top && top.pause) top.pause();
        stack.push(sc); sync();
        if (sc.enter) sc.enter(args);
        return sc;
      },
      // pop(): tira a do topo (exit) e volta pra de baixo (resume)
      pop() {
        const s = stack.pop();
        if (!s) return null;
        if (s.exit) s.exit();
        sync();
        if (S.current && S.current.resume) S.current.resume();
        return s;
      },
      // update(dt): atualiza só a cena do topo
      update(dt) { const c = S.current; if (c && c.update) c.update(dt); },
      // render(g): desenha a pilha de baixo pra cima (cena com opaque:true esconde as de baixo)
      render(g) {
        let i = stack.length - 1;
        while (i > 0 && !stack[i].opaque) i--;
        for (i = Math.max(0, i); i < stack.length; i++) if (stack[i].render) stack[i].render(g);
      },
      // depth() -> tamanho da pilha
      depth() { return stack.length; },
      create: SceneManager,
    };
    function need(name) {
      const sc = defs[name];
      if (!sc) throw new Error('Pixxel: cena "' + name + '" não existe');
      return sc;
    }
    function sync() {
      S.current = stack.length ? stack[stack.length - 1] : null;
      S.name = S.current ? S.current.name : '';
      em.emit('change', S.name, S.current);
    }
    return S;
  }
  E.Scenes = SceneManager();

  /* ======================================================================
     Save — JSON em localStorage, à prova de falha
     Obs.: só o que o JSON entende. Typed arrays (Float32Array etc.) NÃO são
     serializados sozinhos: converta com Array.from() no beforeSave (ou antes de
     gravar em data) e reconstrua depois do load().
     ====================================================================== */
  const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);

  // completa `target` com as chaves que faltam de `def` (recursivo em objetos simples); conserta tipos quebrados
  function mergeDefaults(target, def) {
    for (const k in def) {
      const d = def[k], t = target[k];
      if (t === undefined || t === null && d !== null) target[k] = d;
      else if (isPlain(d)) { if (isPlain(t)) mergeDefaults(t, d); else target[k] = d; }
      else if (typeof d === 'number') { if (typeof t !== 'number' || t !== t) target[k] = d; } // NaN/Infinity viram null no JSON
      else if (Array.isArray(d)) { if (!Array.isArray(t)) target[k] = d; }
      else if ((typeof d === 'string' || typeof d === 'boolean') && typeof t !== typeof d) target[k] = d;
    }
    return target;
  }

  // armazenamento seguro: localStorage se funcionar, senão memória
  function safeStorage() {
    const mem = Object.create(null);
    let ls = null;
    try {
      ls = root.localStorage;
      const probe = '__kome_probe__';
      ls.setItem(probe, '1'); ls.removeItem(probe);
    } catch (e) { ls = null; }
    return {
      persistent: !!ls,
      get(k) { try { if (ls) return ls.getItem(k); } catch (e) { /* cai pra memória */ } return k in mem ? mem[k] : null; },
      set(k, v) { mem[k] = v; try { if (ls) { ls.setItem(k, v); return true; } } catch (e) { /* cota cheia etc. */ } return false; },
      del(k) { delete mem[k]; try { if (ls) ls.removeItem(k); } catch (e) { /* ignora */ } },
    };
  }

  // base64 <-> texto unicode
  function b64enc(s) {
    return root.btoa(encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (m, p) => String.fromCharCode(parseInt(p, 16))));
  }
  function b64dec(s) {
    const bin = root.atob(s);
    let out = '';
    for (let i = 0; i < bin.length; i++) { const c = bin.charCodeAt(i); out += '%' + (c < 16 ? '0' : '') + c.toString(16); }
    return decodeURIComponent(out);
  }

  // E.Save(key, {version=1, migrate(old, vAntiga)->novo, defaults(), beforeSave(data), autoSave=false}) -> save
  function Save(key, o) {
    o = o || {};
    const version = o.version || 1;
    const store = safeStorage();
    const BAK = key + '.bak';
    let timer = 0, lastT = 0;

    const fresh = () => {
      let d = null;
      try { d = o.defaults ? o.defaults() : {}; } catch (e) { d = {}; }
      return isPlain(d) ? d : {};
    };

    // texto JSON -> dados válidos (migrados + defaults), ou null
    function parse(raw) {
      if (!raw) return null;
      let d = null;
      try { d = JSON.parse(raw); } catch (e) { return null; }
      return normalize(d);
    }
    function normalize(d) {
      if (!isPlain(d)) return null;
      const v = +d.__v || 0;
      if (v < version && o.migrate) {
        try { const m = o.migrate(d, v); if (isPlain(m)) d = m; }
        catch (e) { if (root.console) console.warn('[kome] save: migrate falhou', e); return null; }
      }
      mergeDefaults(d, fresh());
      d.__v = version;
      if (typeof d.__t !== 'number') d.__t = Date.now();
      return d;
    }

    const sv = {
      key, version,
      data: null,
      persistent: store.persistent, // false = localStorage indisponível (salvando só na memória)
      isNew: true,                  // true se o último load() não achou save
      offlineAtLoad: 0,             // segundos fora, medidos no último load()
      isWiping: false,              // ponha true antes de um reset+reload pra o autoSave não regravar
      // load() -> data: lê, migra e completa com defaults; nunca lança
      load() {
        const raw = store.get(key);
        let d = parse(raw);
        if (d) { if (raw) store.set(BAK, raw); } // guarda o último save que abriu bem
        else {
          if (raw) store.set(key + '.corrupt', raw); // não joga fora o save estragado
          d = parse(store.get(BAK));
        }
        sv.isNew = !d;
        if (!d) { d = fresh(); d.__v = version; d.__t = Date.now(); }
        sv.data = d;
        lastT = d.__t;
        sv.offlineAtLoad = sv.offlineSeconds();
        return d;
      },
      // save() -> bool: grava agora (data.__t = agora, data.__v = versão)
      save() {
        clearTimeout(timer); timer = 0;
        if (!sv.data) return false;
        try {
          if (o.beforeSave) o.beforeSave(sv.data);
          sv.data.__t = lastT = Date.now();
          sv.data.__v = version;
          return store.set(key, JSON.stringify(sv.data));
        } catch (e) {
          if (root.console) console.warn('[kome] save: falhou', e);
          return false;
        }
      },
      // saveSoon(ms=1500): agenda um save; chamadas repetidas dentro da janela não adiam (no máx. 1 gravação por janela)
      saveSoon(ms) {
        if (timer) return;
        timer = setTimeout(sv.save, ms === undefined ? 1500 : ms);
      },
      // clear() -> data: apaga o save (e o backup) e volta aos defaults
      clear() {
        clearTimeout(timer); timer = 0;
        store.del(key); store.del(BAK); store.del(key + '.corrupt');
        const d = fresh(); d.__v = version; d.__t = Date.now();
        sv.data = d; sv.isNew = true; lastT = d.__t;
        return d;
      },
      // exportStr() -> string base64 do save atual (pra copiar/colar)
      exportStr() {
        try {
          if (o.beforeSave) o.beforeSave(sv.data);
          sv.data.__t = Date.now(); sv.data.__v = version;
          return b64enc(JSON.stringify(sv.data));
        } catch (e) { return ''; }
      },
      // importStr(s) -> bool: troca o save pelo conteúdo da string (base64 ou JSON puro); false se inválida
      importStr(s) {
        let d = null;
        try {
          s = String(s).trim();
          d = parse(s.charAt(0) === '{' ? s : b64dec(s.replace(/\s+/g, '')));
        } catch (e) { d = null; }
        if (!d) return false;
        sv.data = d; sv.isNew = false;
        lastT = d.__t;
        sv.offlineAtLoad = sv.offlineSeconds();
        sv.save();
        return true;
      },
      // offlineSeconds() -> segundos desde o último save/load (>= 0, mesmo se o relógio voltar)
      offlineSeconds() {
        const s = (Date.now() - lastT) / 1000;
        return s > 0 && isFinite(s) ? s : 0;
      },
    };

    if (o.autoSave && doc) { // grava ao sair/ocultar a aba
      const flush = () => { if (sv.data && !sv.isWiping) sv.save(); };
      root.addEventListener('pagehide', flush);
      doc.addEventListener('visibilitychange', () => { if (doc.hidden) flush(); });
    }
    return sv;
  }
  E.Save = Save;
})();


/* ===== engine/pix.js ===== */
/* ============================================================================
   Pixxel v1.0 — pix.js
   O "estilo Kome" pra tudo que não é o cachorro:
     E.LINE / E.LINE_CSS   contorno marrom escuro oficial
     E.PAL                 paleta quente e limitada
     E.Pix                 construtor de pixel art (contorno 4-vizinhos igual ao do Kome)
     E.sprite              cache de sprites Pix
     E.drawSprite          desenha um canvas com âncora / rotação / escala / flip
     E.Draw                primitivas vetoriais no MUNDO (máquinas gigantes) com o mesmo
                           contorno e as mesmas cores chapadas
   Depende de: core.js (E.U)
   ============================================================================ */
(function () {
  'use strict';
  const E = (window.Pixxel = window.Pixxel || {});
  if (!E.U) throw new Error('Pixxel: carregue core.js antes de pix.js');
  const U = E.U, TAU = Math.PI * 2;

  /* ======================================================================
     1. Contorno e paleta
     ====================================================================== */
  const LINE = [59, 40, 24, 255];
  const LINE_CSS = '#3B2818';
  const DARK = [40, 20, 8, 255];      // sombras = cor misturada com este marrom
  const LIGHT = [255, 250, 230, 255]; // luzes = cor misturada com este creme

  // Paleta oficial. Os valores do rascunho (art.js "C" e game.js) foram mantidos.
  const PAL = {
    line: LINE_CSS, ink: '#2A1A10', cream: '#FFFAEE', white: '#FFFFFF',
    // arroz e ouro
    rice: '#FFFDF6', riceS: '#E6DCC4', riceD: '#CFC2A2',
    gold: '#F3C94A', goldL: '#FFE68A', goldD: '#B4852A',
    press: '#E9DCBE', pressD: '#C9B78E',            // arroz prensado (camada dura)
    // madeira, palha, pano
    wood: '#A9763F', woodD: '#7A5228', woodL: '#CF9E63',
    sack: '#D8C49A', sackD: '#B89E6C',
    // tintas de máquina
    red: '#C8423A', redD: '#93302A', redL: '#E8776A',
    yel: '#EDB93A', yelD: '#B88A1E', yelL: '#F8DC7C',
    ora: '#E2742E', oraD: '#B0531C', oraL: '#F3A566',
    // metais e borracha
    steel: '#C3CBD4', steelD: '#808A96', steelL: '#E3E8EE',
    gray: '#8E949C', grayD: '#676D75', grayL: '#B4BAC2',
    blk: '#3A332D', blkL: '#5A524A',
    rust: '#B9652A', rustD: '#8A4A1E',
    glass: '#A8D8EA', glassD: '#6FAECB',
    // natureza
    grass: '#7F9E5C', grassD: '#5D7A40', grassL: '#A9C08A',
    leaf: '#6B8A4B', leafD: '#4F6142',
    sakura: '#F4B8C5', sakuraD: '#D98AA0', pink: '#D95763',
    water: '#6FB3D2', waterD: '#3F7FA6', waterL: '#B5E0EE',
    sky: '#9FD3E8', skyL: '#FBE8C8',
    sand: '#E9D3A8', stone: '#A39C8C', stoneD: '#77705F', stoneL: '#CFC8B6',
    // personagens e comida
    fur: '#D9A066', furS: '#A8773F',
    bowl: '#3F5E92', bowlL: '#6487C0',
    mochi: '#F8E8E2', mochiD: '#E2C4BA',
    // céu
    night: '#2B2A3A', sun: '#FFD36B',
  };

  /* ======================================================================
     2. Cores empacotadas (uint32 little-endian: 0xAABBGGRR). 0 = pixel vazio
     ====================================================================== */
  const packCache = new Map();

  // pack(c) -> uint32: aceita hex ou [r,g,b,a]; null/alfa 0 -> 0 (vazio)
  function pack(c) {
    if (c == null) return 0;
    if (typeof c === 'number') return c >>> 0;
    if (typeof c === 'string') {
      let v = packCache.get(c);
      if (v === undefined) {
        const a = U.hex(c);
        v = ((a[3] << 24) | (a[2] << 16) | (a[1] << 8) | a[0]) >>> 0;
        if (packCache.size >= 2000) packCache.clear();
        packCache.set(c, v);
      }
      return v;
    }
    const al = c.length > 3 ? c[3] : 255;
    return (((al & 255) << 24) | ((c[2] & 255) << 16) | ((c[1] & 255) << 8) | (c[0] & 255)) >>> 0;
  }

  // unpack(v) -> [r,g,b,a]
  function unpack(v) {
    return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  }

  // mixPacked(v, alvo[r,g,b], t) -> uint32: mistura mantendo o alfa
  function mixPacked(v, tg, t) {
    const r = v & 255, gg = (v >>> 8) & 255, b = (v >>> 16) & 255, a = v >>> 24;
    const R = Math.round(r + (tg[0] - r) * t), G = Math.round(gg + (tg[1] - gg) * t), B = Math.round(b + (tg[2] - b) * t);
    return ((a << 24) | (B << 16) | (G << 8) | R) >>> 0;
  }

  /* ======================================================================
     3. Pix — construtor de pixel art
     ====================================================================== */
  // E.Pix(w,h) -> P: tela de pixel art; todos os métodos de desenho são encadeáveis
  function Pix(w, h) {
    w = Math.max(1, w | 0); h = Math.max(1, h | 0);
    let buf = new Uint32Array(w * h);

    function put(x, y, v) {
      x = Math.round(x); y = Math.round(y);
      if (v && x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = v;
    }
    function disc(cx, cy, rx, ry, v) {
      if (!v || rx <= 0 || ry <= 0) return;
      const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry), x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) put(x, y, v);
      }
    }
    const xs = []; // interseções da varredura do poly (reaproveitado)
    const THIN = 1.5; // abaixo disso line/arc viram traço de 1px

    const P = {
      w, h,
      get buf() { return buf; },

      /* ---------- formas ---------- */
      // P.set(x,y,c): pinta um pixel
      set(x, y, c) { put(x, y, pack(c)); return P; },
      // P.get(x,y) -> [r,g,b,a] | null
      get(x, y) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= w || y >= h) return null;
        const v = buf[y * w + x];
        return v ? unpack(v) : null;
      },
      // P.rect(x,y,w,h,c): retângulo cheio
      rect(x, y, ww, hh, c) {
        const v = pack(c);
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) put(x + i, y + j, v);
        return P;
      },
      // P.rrect(x,y,w,h,r,c): retângulo com cantos arredondados de raio r
      rrect(x, y, ww, hh, r, c) {
        const v = pack(c);
        r = Math.max(0, Math.min(r, ww / 2, hh / 2));
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
          const px = i + 0.5, py = j + 0.5;
          const qx = px < r ? r - px : px > ww - r ? px - (ww - r) : 0;
          const qy = py < r ? r - py : py > hh - r ? py - (hh - r) : 0;
          if (qx * qx + qy * qy <= r * r + 0.01) put(x + i, y + j, v);
        }
        return P;
      },
      // P.ell(cx,cy,rx,ry,c): elipse cheia
      ell(cx, cy, rx, ry, c) { disc(cx, cy, rx, ry, pack(c)); return P; },
      // P.tri(ax,ay,bx,by,cx,cy,c): triângulo cheio
      tri(ax, ay, bx, by, cx, cy, c) {
        const v = pack(c);
        const x0 = Math.floor(Math.min(ax, bx, cx)), x1 = Math.ceil(Math.max(ax, bx, cx));
        const y0 = Math.floor(Math.min(ay, by, cy)), y1 = Math.ceil(Math.max(ay, by, cy));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
          const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
          const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
          if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) put(x, y, v);
        }
        return P;
      },
      // P.poly(pts,c): polígono cheio (côncavo ou convexo), pts = [[x,y],...]
      poly(pts, c) {
        const v = pack(c), n = pts.length;
        if (n < 3 || !v) return P;
        let y0 = Infinity, y1 = -Infinity;
        for (let i = 0; i < n; i++) { y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
        y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(h - 1, Math.ceil(y1));
        for (let y = y0; y <= y1; y++) {
          const py = y + 0.5; xs.length = 0;
          for (let i = 0, j = n - 1; i < n; j = i++) {
            const ay = pts[i][1], by = pts[j][1];
            if ((ay <= py && by > py) || (by <= py && ay > py)) xs.push(pts[i][0] + (py - ay) / (by - ay) * (pts[j][0] - pts[i][0]));
          }
          xs.sort((a, b) => a - b);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            const xa = Math.ceil(xs[k] - 0.5), xb = Math.floor(xs[k + 1] - 0.5);
            for (let x = xa; x <= xb; x++) put(x, y, v);
          }
        }
        return P;
      },
      // P.line(x0,y0,x1,y1,wd,c): linha grossa de pontas redondas; wd < 1.5 = linha de 1px conectada do pixel (x0,y0) ao pixel (x1,y1)
      //   (traço fino usa a convenção do set(): coordenada = índice do pixel; traço grosso/ell usam coordenada contínua, centro do pixel em +.5)
      line(x0, y0, x1, y1, wd, c) {
        const v = pack(c);
        if (wd < THIN) { // pincel de disco não pega pixel nenhum em coordenada inteira: anda pixel a pixel
          x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); // mesma convenção do set(): coordenada = índice do pixel
          const m = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let i = 0; i <= m; i++) { const t = m ? i / m : 0; put(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, v); }
          return P;
        }
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let i = 0; i <= n; i++) { const t = i / n; disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, wd / 2, wd / 2, v); }
        return P;
      },
      // P.ring(cx,cy,r,wd,c): anel de raio externo r e espessura wd
      ring(cx, cy, r, wd, c) {
        const v = pack(c), ri = Math.max(0, r - wd);
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = dx * dx + dy * dy;
          if (d <= r * r && d >= ri * ri) put(x, y, v);
        }
        return P;
      },
      // P.arc(cx,cy,r,a0,a1,wd,c): arco (radianos, sentido horário na tela) com espessura wd
      arc(cx, cy, r, a0, a1, wd, c) {
        const v = pack(c), n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r * 2));
        for (let i = 0; i <= n; i++) {
          const a = a0 + (a1 - a0) * i / n, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (wd < THIN) put(x, y, v);                        // arco fino: 1px, na convenção do set() (centro = índice do pixel)
          else disc(x, y, wd / 2, wd / 2, v);
        }
        return P;
      },
      // P.erase(x,y,w,h): apaga um retângulo (volta a ser transparente)
      erase(x, y, ww, hh) {
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
          const X = Math.round(x + i), Y = Math.round(y + j);
          if (X >= 0 && Y >= 0 && X < w && Y < h) buf[Y * w + X] = 0;
        }
        return P;
      },

      /* ---------- texturas e sombreamento ---------- */
      // P.dither(x,y,w,h,c,padrão='checker'|'25'|'75'|'hlines'|'vlines',{mask=false}): retícula; mask = só onde já existe pixel
      dither(x, y, ww, hh, c, pattern, opts) {
        const v = pack(c), pt = pattern || 'checker', mask = !!(opts && opts.mask);
        x = Math.round(x); y = Math.round(y);
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
          const X = x + i, Y = y + j;
          let on;
          if (pt === '25') on = (X & 1) === 0 && (Y & 1) === 0 && ((X >> 1) + (Y >> 1)) % 2 === 0 || ((X & 1) === 1 && (Y & 1) === 1 && ((X >> 1) + (Y >> 1)) % 2 === 1);
          else if (pt === '75') on = !((X & 1) === 0 && (Y & 1) === 0);
          else if (pt === 'hlines') on = (Y & 1) === 0;
          else if (pt === 'vlines') on = (X & 1) === 0;
          else on = ((X + Y) & 1) === 0;
          if (!on || X < 0 || Y < 0 || X >= w || Y >= h) continue;
          if (mask && !buf[Y * w + X]) continue;
          buf[Y * w + X] = v;
        }
        return P;
      },
      // P.shadeBelow(c,k=.28,depth?): escurece a borda de baixo/direita das manchas de cor c (volume automático)
      shadeBelow(c, k, depth) {
        const v = pack(c); if (!v) return P;
        if (k === undefined) k = 0.28;
        let x0 = w, x1 = -1, y0 = h, y1 = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (buf[y * w + x] === v) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (x1 < 0) return P;
        const d = depth || Math.max(1, Math.round(Math.min(x1 - x0 + 1, y1 - y0 + 1) * 0.16));
        const sh = k < 0 ? mixPacked(v, LIGHT, -k) : mixPacked(v, DARK, k);
        const src = buf.slice();
        const is = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] === v;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          if (src[y * w + x] !== v) continue;
          if (!is(x, y + d) || !is(x + d, y) || !is(x + Math.ceil(d * 0.7), y + Math.ceil(d * 0.7))) buf[y * w + x] = sh;
        }
        return P;
      },
      // P.bevel(hi=.32,lo=.26): 1px de luz em cima/esquerda e sombra embaixo/direita por dentro da silhueta
      bevel(hi, lo) {
        if (hi === undefined) hi = 0.32;
        if (lo === undefined) lo = 0.26;
        const src = buf.slice();
        const emp = (x, y) => x < 0 || y < 0 || x >= w || y >= h || !src[y * w + x];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const v = src[y * w + x]; if (!v) continue;
          if (emp(x, y - 1) || emp(x - 1, y)) { if (!(emp(x, y + 1) && emp(x + 1, y))) buf[y * w + x] = mixPacked(v, LIGHT, hi); }
          else if (emp(x, y + 1) || emp(x + 1, y)) buf[y * w + x] = mixPacked(v, DARK, lo);
        }
        return P;
      },
      // P.replace(c1,c2): troca todos os pixels de cor c1 por c2 (c2 null apaga)
      replace(c1, c2) {
        const a = pack(c1), b = pack(c2);
        if (a) for (let i = 0; i < buf.length; i++) if (buf[i] === a) buf[i] = b;
        return P;
      },
      // P.mask(fn(x,y,[r,g,b,a])->bool): mantém só os pixels em que fn devolve verdadeiro
      mask(fn) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const v = buf[y * w + x];
          if (v && !fn(x, y, unpack(v))) buf[y * w + x] = 0;
        }
        return P;
      },
      // P.mirrorX(): espelha a tela inteira na horizontal
      mirrorX() {
        for (let y = 0; y < h; y++) for (let x = 0; x < (w >> 1); x++) {
          const i = y * w + x, j = y * w + (w - 1 - x), t = buf[i];
          buf[i] = buf[j]; buf[j] = t;
        }
        return P;
      },
      // P.symX(): copia a metade esquerda espelhada na direita (pra sprites simétricos)
      symX() {
        for (let y = 0; y < h; y++) for (let x = 0; x < (w >> 1); x++) buf[y * w + (w - 1 - x)] = buf[y * w + x];
        return P;
      },
      // P.stamp(outroP,x,y,{flip=false}): carimba outro Pix (pixels vazios não cobrem)
      stamp(o, x, y, opts) {
        const ob = o.buf, flip = !!(opts && opts.flip);
        x = Math.round(x); y = Math.round(y);
        for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) {
          const v = ob[j * o.w + (flip ? o.w - 1 - i : i)];
          if (v) put(x + i, y + j, v);
        }
        return P;
      },
      // P.clone() -> novo Pix com os mesmos pixels
      clone() { const q = Pix(w, h); q.buf.set(buf); return q; },
      // P.pad(n=1) -> NOVO Pix com n px de margem vazia em volta (pro contorno não ser cortado quando a arte encosta na borda)
      pad(n) {
        n = n === undefined ? 1 : Math.max(0, n | 0);
        const q = Pix(w + n * 2, h + n * 2), qb = q.buf, qw = w + n * 2;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) qb[(y + n) * qw + x + n] = buf[y * w + x];
        return q;
      },
      // P.touchesEdge() -> bool: tem pixel pintado encostado na borda? (o contorno seria cortado ali)
      touchesEdge() {
        for (let x = 0; x < w; x++) if (buf[x] || buf[(h - 1) * w + x]) return true;
        for (let y = 0; y < h; y++) if (buf[y * w] || buf[y * w + w - 1]) return true;
        return false;
      },

      /* ---------- saída ---------- */
      // P.canvas(outline=true, lineColor=E.LINE) -> HTMLCanvasElement (contorno 4-vizinhos como o do Kome)
      canvas(outline, lineColor) {
        const out = outline === false ? buf : Pix.outline(buf, w, h, lineColor || LINE);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d'), img = g.createImageData(w, h);
        new Uint32Array(img.data.buffer).set(out);
        g.putImageData(img, 0, 0);
        return cv;
      },
    };
    return P;
  }

  // E.Pix.outline(buf,w,h,c) -> novo buffer com contorno 4-vizinhos (aceita Uint32Array ou o array legado de cores)
  Pix.outline = function (buf, w, h, c) {
    const typed = buf instanceof Uint32Array;
    const o = buf.slice(), v = typed ? pack(c) : c;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (buf[i]) continue;
      if ((x + 1 < w && buf[i + 1]) || (x > 0 && buf[i - 1]) || (y + 1 < h && buf[i + w]) || (y > 0 && buf[i - w])) o[i] = v;
    }
    return o;
  };
  Pix.pack = pack;
  Pix.unpack = unpack;

  /* ======================================================================
     4. sprite (cache) e drawSprite
     ====================================================================== */
  const spriteCache = Object.create(null);

  // E.sprite(nome,w,h,fn(P),outline=true) -> canvas cacheado
  function sprite(name, w, h, fn, outline) {
    let cv = spriteCache[name];
    if (!cv) {
      const P = Pix(w, h);
      fn(P);
      cv = spriteCache[name] = P.canvas(outline !== false);
    }
    return cv;
  }
  // E.sprite.clear(nome?): esvazia o cache (tudo, ou só um nome)
  sprite.clear = function (name) {
    if (name === undefined) { for (const k in spriteCache) delete spriteCache[k]; }
    else delete spriteCache[name];
  };
  // E.sprite.has(nome) -> bool ; E.sprite.get(nome) -> canvas | undefined
  sprite.has = name => !!spriteCache[name];
  sprite.get = name => spriteCache[name];
  // E.sprite.names() -> nomes de tudo que já foi desenhado (galeria de sprites)
  sprite.names = () => Object.keys(spriteCache);

  const NO = Object.freeze({}); // opções vazias compartilhadas (evita alocar por chamada)

  // E.drawSprite(g, cv, x, y, {ax=cv.width/2, ay=cv.height, rot=0, sx=1, sy=1, alpha=1, flip=false, smooth})
  //   smooth: true/false força; sem ele, pixel duro, menos quando o sprite é reduzido pra menos de 75% (|sx| × Draw.zoom),
  //   onde a redução suave evita o contorno picotado
  function drawSprite(g, cv, x, y, o) {
    o = o || NO;
    const ax = o.ax !== undefined ? o.ax : cv.width / 2, ay = o.ay !== undefined ? o.ay : cv.height;
    const sx = (o.sx !== undefined ? o.sx : 1) * (o.flip ? -1 : 1), sy = o.sy !== undefined ? o.sy : 1;
    const rot = o.rot || 0, al = o.alpha !== undefined ? o.alpha : 1;
    if (al <= 0) return;
    const sm = g.imageSmoothingEnabled, pa = g.globalAlpha;
    g.imageSmoothingEnabled = o.smooth !== undefined ? !!o.smooth : Math.min(Math.abs(sx), Math.abs(sy)) * Draw.zoom < 0.75;
    if (al !== 1) g.globalAlpha = pa * al;
    if (!rot && sx === 1 && sy === 1) g.drawImage(cv, x - ax, y - ay);
    else {
      g.save();
      g.translate(x, y);
      if (rot) g.rotate(rot);
      g.scale(sx, sy);
      g.drawImage(cv, -ax, -ay);
      g.restore();
    }
    g.imageSmoothingEnabled = sm;
    if (al !== 1) g.globalAlpha = pa;
  }

  /* ======================================================================
     5. Draw — primitivas vetoriais no mundo
     Convenções:
       - contorno = Draw.OL unidades de mundo pra FORA da forma (traço 2*OL atrás do preenchimento);
       - cores chapadas: base + faixa de luz em cima + faixa de sombra embaixo (nada de gradiente);
       - retângulos (box, lattice, track, window, sign) usam (x,y) = canto de cima/esquerda;
       - Draw.lod(zoom) uma vez por frame liga o nível de detalhe: miudezas (rebites, parafusos,
         garras do pneu) somem quando ficam menores que ~1px de tela, e Draw.minPx garante uma
         espessura mínima de contorno em pixels de tela quando a câmera afasta.
     ====================================================================== */
  const Draw = {
    OL: 2,            // espessura do contorno em unidades de mundo
    zoom: 1,          // zoom atual da câmera (informado por Draw.lod)
    minPx: 0,         // contorno mínimo em px de tela (0 = desliga); ex.: .6 pra Bagger vista de longe
    detailPx: 0.9,    // detalhes menores que isso (px de tela) não são desenhados
    FONT: "'Zen Maru Gothic','M PLUS Rounded 1c','Hiragino Maru Gothic ProN','Nunito',system-ui,sans-serif",
    LINE: LINE_CSS,
  };

  // Draw.lod(zoom, minPx?): informa o zoom da câmera (chamar 1x por frame antes de desenhar o mundo)
  Draw.lod = function (zoom, minPx) {
    Draw.zoom = zoom > 0 ? zoom : 1;
    if (minPx !== undefined) Draw.minPx = minPx;
    return Draw;
  };

  /* Draw.layer(g, key, x0, y0, x1, y1, sig, fn): pedaço PARADO de um desenho guardado numa tela de apoio na escala do aparelho.
     fn(c) desenha no retângulo (x0,y0)-(x1,y1) das coordenadas atuais de g; a imagem é refeita quando muda a escala/espelho
     da transformação, Draw.zoom/minPx ou `sig` (qualquer valor comparável com ===), e entra pixel com pixel (posição
     arredondada: no máximo meio pixel de diferença). Zoom andando (escala mudou 2 quadros seguidos) = desenha direto.
     Transformação com giro/escala desigual também desenha direto. Use pra peças com dezenas de traços que não mexem
     (ex.: estrutura do coletor), deixando por cima só o que anima. key: string ou objeto. */
  const LAYERS = new Map();
  Draw.layer = function (g, key, x0, y0, x1, y1, sig, fn) {
    const m = g.getTransform && g.getTransform();
    if (!m || m.b || m.c || !(m.d > 0) || Math.abs(Math.abs(m.a) - m.d) > m.d * 1e-6 || typeof document === 'undefined') { fn(g); return; }
    const k = m.d, mir = m.a < 0 ? 1 : 0;
    let L = LAYERS.get(key);
    if (!L) { L = { cv: null, k: 0, mir: 0, sig: undefined, z: 0, mp: 0, pk: 0, x0: 0, y0: 0, x1: 0, y1: 0 }; LAYERS.set(key, L); }
    if (!L.cv || L.k !== k || L.mir !== mir || L.sig !== sig || L.z !== Draw.zoom || L.mp !== Draw.minPx || L.x0 !== x0 || L.y0 !== y0 || L.x1 !== x1 || L.y1 !== y1) {
      if (L.k !== k && L.pk !== k) { L.pk = k; fn(g); return; }   // escala mudando: espera assentar
      const P = 2, w = Math.ceil((x1 - x0) * k) + P * 2, h = Math.ceil((y1 - y0) * k) + P * 2;
      if (!(w > 0 && h > 0) || w * h > 2e6) { fn(g); return; }
      if (!L.cv) L.cv = document.createElement('canvas');
      L.cv.width = w; L.cv.height = h;
      const c = L.cv.getContext('2d');
      c.setTransform(mir ? -k : k, 0, 0, k, (mir ? x1 * k : -x0 * k) + P, -y0 * k + P);
      c.imageSmoothingEnabled = g.imageSmoothingEnabled; c.lineJoin = g.lineJoin; c.lineCap = g.lineCap;
      fn(c);
      L.k = k; L.pk = k; L.mir = mir; L.sig = sig; L.z = Draw.zoom; L.mp = Draw.minPx; L.x0 = x0; L.y0 = y0; L.x1 = x1; L.y1 = y1;
    }
    const X = Math.round((mir ? m.a * x1 : m.a * x0) + m.e) - 2, Y = Math.round(m.d * y0 + m.f) - 2;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(L.cv, X, Y); g.restore();
  };
  // Draw.dropLayers(): solta todas as telas de apoio do Draw.layer (memória)
  Draw.dropLayers = function () { LAYERS.clear(); };

  /* ---------- helpers internos ---------- */
  function olOf(o) {
    const v = o.ol !== undefined ? o.ol : Draw.OL;
    if (v <= 0) return 0;
    const m = Draw.minPx / Draw.zoom;
    return v > m ? v : m;
  }
  function big(size) { return size * Draw.zoom >= Draw.detailPx; }
  function col2(c) { return typeof c === 'string' ? c : U.css(c); }
  function hiOf(c, k) { return U.shade(c, k === undefined ? 0.3 : k); }
  function loOf(c, k) { return U.shade(c, -(k === undefined ? 0.22 : k)); }

  function rrPath(g, x, y, w, h, r) {
    g.beginPath();
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.min(r, w / 2, h / 2);
    if (!(r > 0)) { g.rect(x, y, w, h); return; }
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function ptsPath(g, pts, close) {
    g.beginPath();
    for (let i = 0; i < pts.length; i++) { if (i) g.lineTo(pts[i][0], pts[i][1]); else g.moveTo(pts[0][0], pts[0][1]); }
    if (close) g.closePath();
  }
  // faixa paralela à polilinha, deslocada pro lado de cima (ou de baixo se side=-1)
  function sidePath(g, pts, off, side) {
    g.beginPath();
    for (let i = 0; i + 1 < pts.length; i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
      const L = Math.hypot(bx - ax, by - ay); if (L < 1e-6) continue;
      let nx = -(by - ay) / L, ny = (bx - ax) / L;
      if (ny > 0.0001 || (Math.abs(ny) <= 0.0001 && nx > 0)) { nx = -nx; ny = -ny; } // normal apontando pra cima (ou esquerda)
      g.moveTo(ax + nx * off * side, ay + ny * off * side);
      g.lineTo(bx + nx * off * side, by + ny * off * side);
    }
  }

  /* ---------- formas básicas ---------- */
  // Draw.beam(g, pts, w, col, {ol=Draw.OL, cap='round', hi, shade}): polilinha grossa com contorno, luz em cima e sombra embaixo
  Draw.beam = function (g, pts, w, col, o) {
    o = o || NO; col = col2(col);
    const ol = olOf(o), cap = o.cap || 'round';
    g.lineCap = cap; g.lineJoin = 'round';
    ptsPath(g, pts, false);
    if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = w + ol * 2; g.stroke(); }
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
    if (o.hi !== false && big(w * 0.4)) {
      g.lineWidth = w * 0.26;
      sidePath(g, pts, w * 0.25, 1);
      g.strokeStyle = typeof o.hi === 'string' ? o.hi : hiOf(col); g.stroke();
      if (o.shade !== false) {
        sidePath(g, pts, w * 0.27, -1);
        g.strokeStyle = typeof o.shade === 'string' ? o.shade : loOf(col); g.stroke();
      }
    }
  };

  // Draw.poly(g, pts, col, {ol, shade, hi, close=true}): polígono chapado com contorno; shade/hi = cor da faixa de baixo/cima (opcional)
  Draw.poly = function (g, pts, col, o) {
    o = o || NO; col = col2(col);
    const ol = olOf(o), close = o.close !== false;
    g.lineJoin = 'round'; g.lineCap = 'round';
    ptsPath(g, pts, close);
    if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = ol * 2; g.stroke(); }
    g.fillStyle = col; g.fill();
    if (o.shade || o.hi) {
      let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      }
      const hh = y1 - y0;
      g.save(); g.clip();
      if (o.shade) { g.fillStyle = o.shade === true ? loOf(col) : col2(o.shade); g.fillRect(x0, y1 - hh * (o.shadeK || 0.3), x1 - x0, hh); }
      if (o.hi) { g.fillStyle = o.hi === true ? hiOf(col) : col2(o.hi); g.fillRect(x0, y0, x1 - x0, hh * (o.hiK || 0.16)); }
      g.restore();
    }
  };

  // Draw.circle(g, x, y, r, col, {ol, hi=true, shade=true}): disco chapado com contorno, meia-lua de sombra e brilho
  Draw.circle = function (g, x, y, r, col, o) {
    o = o || NO; col = col2(col);
    const ol = olOf(o);
    if (ol > 0) { g.fillStyle = LINE_CSS; g.beginPath(); g.arc(x, y, r + ol, 0, TAU); g.fill(); }
    if (o.shade !== false && big(r * 0.3)) {
      g.fillStyle = typeof o.shade === 'string' ? o.shade : loOf(col);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.arc(x - r * 0.1, y - r * 0.12, r * 0.86, 0, TAU); g.fill();
    } else { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    if (o.hi !== false && big(r * 0.3)) {
      g.strokeStyle = typeof o.hi === 'string' ? o.hi : hiOf(col, 0.45);
      g.lineWidth = r * 0.16; g.lineCap = 'round';
      g.beginPath(); g.arc(x, y, r * 0.64, Math.PI * 1.12, Math.PI * 1.45); g.stroke();
    }
  };

  // Draw.ring(g, x, y, r, wd, col, {ol, hi=true}): anel de raio externo r e espessura wd
  Draw.ring = function (g, x, y, r, wd, col, o) {
    o = o || NO; col = col2(col);
    if (!(r > 0)) return;
    if (wd > r) wd = r;                       // mais grosso que o raio: vira disco
    const ol = olOf(o), rm = r - wd / 2;
    g.beginPath(); g.arc(x, y, rm, 0, TAU);
    if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = wd + ol * 2; g.stroke(); }
    g.strokeStyle = col; g.lineWidth = wd; g.stroke();
    if (o.hi !== false && big(wd * 0.4)) {
      g.lineCap = 'round'; g.lineWidth = wd * 0.3;
      g.strokeStyle = hiOf(col, 0.4);
      g.beginPath(); g.arc(x, y, rm + wd * 0.12, Math.PI * 1.08, Math.PI * 1.62); g.stroke();
      g.strokeStyle = loOf(col);
      g.beginPath(); g.arc(x, y, rm - wd * 0.12, Math.PI * 0.08, Math.PI * 0.62); g.stroke();
    }
  };

  // Draw.cable(g, a, b, {sag=0, lw=1.5, col=LINE, ol=0}): cabo de a=[x,y] até b com barriga 'sag' (unidades de mundo no meio do vão)
  Draw.cable = function (g, a, b, o) {
    o = o || NO;
    const sag = o.sag || 0, lw = o.lw || 1.5, m = Draw.minPx / Draw.zoom;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(a[0], a[1]);
    if (sag) g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag * 2, b[0], b[1]);
    else g.lineTo(b[0], b[1]);
    if (o.ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = lw + o.ol * 2; g.stroke(); }
    g.strokeStyle = o.col ? col2(o.col) : LINE_CSS;
    g.lineWidth = lw > m ? lw : m; g.stroke();
  };

  /* ---------- caixas e chapas ---------- */
  const STRIPE_A = PAL.yel, STRIPE_B = PAL.blk;

  // faixas de segurança diagonais dentro de um retângulo (recorta sozinho)
  function hazardFill(g, x, y, w, h, a, b, sw) {
    sw = sw || Math.max(3, h * 0.8);
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = a; g.fillRect(x, y, w, h);
    g.fillStyle = b;
    g.beginPath();
    for (let sx = x - h - sw * 2; sx < x + w + sw; sx += sw * 2) {
      g.moveTo(sx, y + h); g.lineTo(sx + sw, y + h); g.lineTo(sx + sw + h, y); g.lineTo(sx + h, y); g.closePath();
    }
    g.fill();
    g.restore();
  }

  // Draw.hazard(g, x, y, w, h, {a=amarelo, b=preto, sw, ol}): faixa zebrada de segurança com contorno
  Draw.hazard = function (g, x, y, w, h, o) {
    o = o || NO;
    const ol = olOf(o);
    if (ol > 0) { g.fillStyle = LINE_CSS; g.fillRect(x - ol, y - ol, w + ol * 2, h + ol * 2); }
    hazardFill(g, x, y, w, h, o.a || STRIPE_A, o.b || STRIPE_B, o.sw);
  };

  // Draw.box(g, x, y, w, h, col, {top, shade, ol, r=0, rivets=false, panels=0, stripes}): caixa chapada com luz no topo e sombra embaixo
  //   top/shade: cor da faixa (false desliga); panels: nº de painéis verticais; rivets: true ou espaçamento;
  //   stripes: true (caixa toda zebrada) | 'top' | 'bottom' | número (altura da faixa zebrada na base)
  Draw.box = function (g, x, y, w, h, col, o) {
    o = o || NO; col = col2(col);
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    const ol = olOf(o), r = o.r || 0;
    if (ol > 0) {
      g.fillStyle = LINE_CSS;
      if (r > 0) { rrPath(g, x - ol, y - ol, w + ol * 2, h + ol * 2, r + ol); g.fill(); }
      else g.fillRect(x - ol, y - ol, w + ol * 2, h + ol * 2);
    }
    const clip = r > 0;
    if (clip) { g.save(); rrPath(g, x, y, w, h, r); g.clip(); }
    g.fillStyle = col; g.fillRect(x, y, w, h);
    const th = Math.max(Math.min(h * 0.14, 7), Math.min(2, h * 0.3)), bh = Math.max(Math.min(h * 0.16, 9), Math.min(2, h * 0.3));
    if (o.stripes === true) hazardFill(g, x, y, w, h, o.stripeA || STRIPE_A, o.stripeB || STRIPE_B, o.stripeW);
    else {
      if (o.top !== false) { g.fillStyle = o.top ? col2(o.top) : hiOf(col); g.fillRect(x, y, w, th); }
      if (o.shade !== false) { g.fillStyle = o.shade ? col2(o.shade) : loOf(col); g.fillRect(x, y + h - bh, w, bh); }
      if (o.stripes) {
        const sh = typeof o.stripes === 'number' ? o.stripes : Math.max(4, Math.min(h * 0.22, 12));
        hazardFill(g, x, o.stripes === 'top' ? y : y + h - sh, w, sh, o.stripeA || STRIPE_A, o.stripeB || STRIPE_B, o.stripeW);
      }
    }
    // linhas de painel
    if (o.panels > 1 && big(w / o.panels * 0.5)) {
      const pw = Math.max(1, Math.min(ol || 1, 1.5)), step = w / o.panels;
      g.fillStyle = loOf(col, 0.36);
      for (let i = 1; i < o.panels; i++) g.fillRect(x + step * i - pw / 2, y + th, pw, h - th - bh * 0.4);
      if (big(pw)) {
        g.fillStyle = hiOf(col, 0.22);
        for (let i = 1; i < o.panels; i++) g.fillRect(x + step * i + pw / 2, y + th, pw * 0.7, h - th - bh);
      }
    }
    // rebites
    if (o.rivets) {
      const rr = Math.max(0.7, Math.min(1.5, h * 0.035));
      if (big(rr * 2.5)) {
        const sp = typeof o.rivets === 'number' ? Math.max(o.rivets, rr * 3) : Math.max(8, rr * 9);
        const n = Math.max(1, Math.floor((w - rr * 6) / sp)), gap = (w - rr * 6) / n;
        g.fillStyle = loOf(col, 0.45);
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const rx = x + rr * 3 + gap * i;
          g.moveTo(rx + rr, y + th + rr * 2.2); g.arc(rx, y + th + rr * 2.2, rr, 0, TAU);
          g.moveTo(rx + rr, y + h - bh - rr * 2.2); g.arc(rx, y + h - bh - rr * 2.2, rr, 0, TAU);
        }
        g.fill();
      }
    }
    if (clip) g.restore();
  };

  // Draw.window(g, x, y, w, h, {glare=true, r=1.5, ol, col, frame}): vidro com reflexo diagonal; frame = cor de moldura opcional
  Draw.window = function (g, x, y, w, h, o) {
    o = o || NO;
    const ol = olOf(o), r = o.r !== undefined ? o.r : Math.min(1.5, w * 0.2, h * 0.2), c = o.col ? col2(o.col) : PAL.glass;
    if (o.frame) {
      const fw = Math.max(1.5, Math.min(w, h) * 0.1);
      g.fillStyle = LINE_CSS; rrPath(g, x - fw - ol, y - fw - ol, w + (fw + ol) * 2, h + (fw + ol) * 2, r + fw + ol); g.fill();
      g.fillStyle = col2(o.frame); rrPath(g, x - fw, y - fw, w + fw * 2, h + fw * 2, r + fw); g.fill();
    }
    g.fillStyle = LINE_CSS; rrPath(g, x - ol, y - ol, w + ol * 2, h + ol * 2, r + ol); g.fill();
    g.save();
    rrPath(g, x, y, w, h, r); g.clip();
    g.fillStyle = c; g.fillRect(x, y, w, h);
    g.fillStyle = o.col ? loOf(c, 0.25) : PAL.glassD; g.fillRect(x, y + h * 0.62, w, h * 0.38);
    if (o.glare !== false && big(w * 0.2)) {
      g.fillStyle = 'rgba(255,255,255,.62)';
      const s = h * 0.55, a = x + w * 0.16, b = w * 0.16, c2 = w * 0.07;
      g.beginPath();
      g.moveTo(a + s, y); g.lineTo(a + s + b, y); g.lineTo(a + b, y + h); g.lineTo(a, y + h); g.closePath();
      g.moveTo(a + s + b + c2, y); g.lineTo(a + s + b + c2 * 2, y); g.lineTo(a + b + c2 * 2, y + h); g.lineTo(a + b + c2, y + h); g.closePath();
      g.fill();
    }
    g.restore();
  };

  /* ---------- treliças ---------- */
  // caminho das diagonais/montantes de uma treliça (nós: c(q) ± n*half(q))
  function trussWeb(g, ax, ay, dx, dy, nx, ny, d0, d1, N, cross, verts) {
    g.beginPath();
    for (let k = 0; k < N; k++) {
      const q0 = k / N, q1 = (k + 1) / N, h0 = d0 + (d1 - d0) * q0, h1 = d0 + (d1 - d0) * q1;
      const x0 = ax + dx * q0, y0 = ay + dy * q0, x1 = ax + dx * q1, y1 = ay + dy * q1;
      const s = k % 2 ? 1 : -1;
      if (cross || s < 0) { g.moveTo(x0 - nx * h0, y0 - ny * h0); g.lineTo(x1 + nx * h1, y1 + ny * h1); }
      if (cross || s > 0) { g.moveTo(x0 + nx * h0, y0 + ny * h0); g.lineTo(x1 - nx * h1, y1 - ny * h1); }
      if (verts && k > 0) { g.moveTo(x0 + nx * h0, y0 + ny * h0); g.lineTo(x0 - nx * h0, y0 - ny * h0); }
    }
    // montantes das pontas
    g.moveTo(ax + nx * d0, ay + ny * d0); g.lineTo(ax - nx * d0, ay - ny * d0);
    g.moveTo(ax + dx + nx * d1, ay + dy + ny * d1); g.lineTo(ax + dx - nx * d1, ay + dy - ny * d1);
  }
  function trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, off0, off1) {
    g.beginPath();
    if (off0 !== null) { g.moveTo(ax + nx * (d0 + off0), ay + ny * (d0 + off0)); g.lineTo(ax + dx + nx * (d1 + off0), ay + dy + ny * (d1 + off0)); }
    if (off1 !== null) { g.moveTo(ax - nx * (d0 + off1), ay - ny * (d0 + off1)); g.lineTo(ax + dx - nx * (d1 + off1), ay + dy - ny * (d1 + off1)); }
  }

  // Draw.truss(g, a, b, depth, w, col, {taper=.6, bays, cross=false, verticals=cross, joints=true, web, ol, hi}):
  //   viga treliçada entre a=[x,y] e b: dois banzos (espessura w) afastados 'depth' em a e depth*taper em b,
  //   alma em zigue-zague (Warren) ou em X (cross) com montantes; web = cor da alma (padrão: col mais escura)
  Draw.truss = function (g, a, b, depth, w, col, o) {
    o = o || NO; col = col2(col);
    const ax = a[0], ay = a[1], dx = b[0] - ax, dy = b[1] - ay, L = Math.hypot(dx, dy);
    if (L < 1e-6) return;
    let nx = -dy / L, ny = dx / L;
    if (ny > 0.0001 || (Math.abs(ny) <= 0.0001 && nx > 0)) { nx = -nx; ny = -ny; } // +n = lado de cima (ou esquerdo)
    const taper = o.taper !== undefined ? o.taper : 0.6, cross = !!o.cross;
    const d0 = depth / 2, d1 = depth * taper / 2, ol = olOf(o);
    const N = o.bays || Math.max(2, Math.round(L / Math.max(4, (d0 + d1) * (cross ? 1.15 : 0.85))));
    const verts = o.verticals !== undefined ? o.verticals : cross;
    const ww = Math.max(w * 0.55, Math.min(w, 1));
    const webCol = o.web ? col2(o.web) : loOf(col, 0.2);
    g.lineCap = 'round'; g.lineJoin = 'round';

    const detail = big(Math.min(d0 + d1, L / N) * 0.5);
    if (!detail) {
      // de muito longe: só a silhueta dos banzos
      trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, 0, 0);
      if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = w + ol * 2; g.stroke(); }
      g.strokeStyle = col; g.lineWidth = w; g.stroke();
      return;
    }
    // 1) contornos
    if (ol > 0) {
      g.strokeStyle = LINE_CSS;
      trussWeb(g, ax, ay, dx, dy, nx, ny, d0, d1, N, cross, verts);
      g.lineWidth = ww + ol * 2; g.stroke();
      trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, 0, 0);
      g.lineWidth = w + ol * 2; g.stroke();
    }
    // 2) alma (mais escura, fica "atrás")
    trussWeb(g, ax, ay, dx, dy, nx, ny, d0, d1, N, cross, verts);
    g.strokeStyle = webCol; g.lineWidth = ww; g.stroke();
    // 3) banzos
    trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, 0, 0);
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
    // 4) luz no banzo de cima, sombra no de baixo
    if (o.hi !== false && big(w * 0.4)) {
      g.lineWidth = w * 0.28;
      trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, w * 0.24, null);
      g.strokeStyle = hiOf(col); g.stroke();
      trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, null, w * 0.24);
      g.strokeStyle = loOf(col); g.stroke();
    }
    // 5) chapas de nó (parafusos)
    if (o.joints !== false && big(w * 0.35) && w >= 2.5) {
      const jr = w * 0.2;
      g.fillStyle = loOf(col, 0.5);
      g.beginPath();
      for (let k = 0; k <= N; k++) {
        const q = k / N, hh = d0 + (d1 - d0) * q, cx = ax + dx * q, cy = ay + dy * q;
        g.moveTo(cx + nx * hh + jr, cy + ny * hh); g.arc(cx + nx * hh, cy + ny * hh, jr, 0, TAU);
        g.moveTo(cx - nx * hh + jr, cy - ny * hh); g.arc(cx - nx * hh, cy - ny * hh, jr, 0, TAU);
      }
      g.fill();
    }
  };

  const latA = [0, 0], latB = [0, 0];
  const latO = { taper: 1, cross: true, verticals: true, bays: 0, ol: undefined, hi: undefined, joints: undefined, web: undefined };

  // Draw.lattice(g, x, y, w, h, cell, lw, col, {ol, cross=true, joints, web}): torre treliçada retangular (canto de cima/esquerda em x,y)
  //   com X em cada célula de ~'cell' de altura; se w > h a torre deita (células ao longo da largura)
  Draw.lattice = function (g, x, y, w, h, cell, lw, col, o) {
    o = o || NO;
    const vertical = h >= w, len = vertical ? h : w, dep = (vertical ? w : h) - lw;
    if (vertical) { latA[0] = x + w / 2; latA[1] = y + h; latB[0] = x + w / 2; latB[1] = y; }
    else { latA[0] = x; latA[1] = y + h / 2; latB[0] = x + w; latB[1] = y + h / 2; }
    latO.bays = Math.max(1, Math.round(len / Math.max(1, cell || dep)));
    latO.cross = o.cross !== false; latO.verticals = true;
    latO.ol = o.ol; latO.hi = o.hi; latO.joints = o.joints; latO.web = o.web;
    Draw.truss(g, latA, latB, Math.max(0, dep), lw, col, latO);
  };

  /* ---------- rodas, esteiras, pistões ---------- */
  // Draw.wheel(g, x, y, r, rot, {tire, hub, spokes=6, tread=true, ol}): pneu fora-de-estrada (r inclui as garras) com aro e parafusos
  Draw.wheel = function (g, x, y, r, rot, o) {
    o = o || NO;
    const tire = o.tire ? col2(o.tire) : PAL.blk, hub = o.hub ? col2(o.hub) : PAL.yel;
    const ol = olOf(o), spokes = o.spokes !== undefined ? o.spokes : 6;
    const tread = o.tread !== false && big(r * 0.2);
    const rb = tread ? r * 0.9 : r;   // raio do corpo do pneu
    g.save();
    g.translate(x, y);
    if (!big(r * 0.5)) { // longe demais: bolinha
      g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, r + ol, 0, TAU); g.fill();
      g.fillStyle = tire; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.fillStyle = hub; g.beginPath(); g.arc(0, 0, r * 0.45, 0, TAU); g.fill();
      g.restore(); return;
    }
    // garras (giram)
    if (tread) {
      const n = Math.max(8, Math.min(26, Math.round(r * 0.55))), step = TAU / n;
      const lw2 = r * Math.sin(step / 2) * 0.62, l0 = r * 0.78, ll = r - l0;
      g.rotate(rot);
      if (ol > 0) {
        g.fillStyle = LINE_CSS;
        for (let i = 0; i < n; i++) { g.fillRect(l0, -lw2 - ol, ll + ol, (lw2 + ol) * 2); g.rotate(step); }
        g.beginPath(); g.arc(0, 0, rb + ol, 0, TAU); g.fill();
      }
      g.fillStyle = hiOf(tire, 0.12);
      for (let i = 0; i < n; i++) { g.fillRect(l0, -lw2, ll, lw2 * 2); g.rotate(step); }
      g.rotate(-rot);
    } else if (ol > 0) { g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, rb + ol, 0, TAU); g.fill(); }
    // corpo do pneu: sombra embaixo, base, flanco mais claro
    g.fillStyle = loOf(tire, 0.3); g.beginPath(); g.arc(0, 0, rb, 0, TAU); g.fill();
    g.fillStyle = tire; g.beginPath(); g.arc(-r * 0.03, -r * 0.05, rb * 0.95, 0, TAU); g.fill();
    g.strokeStyle = hiOf(tire, 0.16); g.lineWidth = r * 0.07; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, r * 0.74, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    // aro
    const rr = r * 0.52;
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, rr + ol * 0.75, 0, TAU); g.fill();
    g.fillStyle = loOf(hub, 0.26); g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fill();
    g.fillStyle = hub; g.beginPath(); g.arc(-r * 0.025, -r * 0.035, rr * 0.9, 0, TAU); g.fill();
    g.fillStyle = loOf(hub, 0.2); g.beginPath(); g.arc(0, 0, rr * 0.66, 0, TAU); g.fill();
    // parafusos e cubo (giram)
    g.rotate(rot);
    if (spokes > 0 && big(r * 0.12)) {
      const br = Math.max(r * 0.05, 0.6), bd = rr * 0.5;
      g.fillStyle = LINE_CSS;
      g.beginPath();
      for (let i = 0; i < spokes; i++) { const a = i / spokes * TAU; g.moveTo(Math.cos(a) * bd + br, Math.sin(a) * bd); g.arc(Math.cos(a) * bd, Math.sin(a) * bd, br, 0, TAU); }
      g.fill();
      // raios finos entre o cubo e o aro
      g.strokeStyle = loOf(hub, 0.34); g.lineWidth = Math.max(0.6, r * 0.035);
      g.beginPath();
      for (let i = 0; i < spokes; i++) { const a = (i + 0.5) / spokes * TAU; g.moveTo(Math.cos(a) * rr * 0.3, Math.sin(a) * rr * 0.3); g.lineTo(Math.cos(a) * rr * 0.64, Math.sin(a) * rr * 0.64); }
      g.stroke();
    }
    g.rotate(-rot);
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, rr * 0.3 + ol * 0.5, 0, TAU); g.fill();
    g.fillStyle = hiOf(hub, 0.3); g.beginPath(); g.arc(0, 0, rr * 0.3, 0, TAU); g.fill();
    g.fillStyle = loOf(hub, 0.3); g.beginPath(); g.arc(0, 0, rr * 0.11, 0, TAU); g.fill();
    // brilho fixo no aro
    g.strokeStyle = hiOf(hub, 0.5); g.lineWidth = r * 0.05; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, rr * 0.8, Math.PI * 1.12, Math.PI * 1.45); g.stroke();
    g.restore();
  };

  function stadium(g, cx0, cx1, cy, R) {
    g.beginPath();
    g.moveTo(cx0, cy - R); g.lineTo(cx1, cy - R);
    g.arc(cx1, cy, R, -Math.PI / 2, Math.PI / 2);
    g.lineTo(cx0, cy + R);
    g.arc(cx0, cy, R, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
  }
  // rodinha de esteira com marca que gira
  function bogie(g, x, y, r, ang, col, ol, teeth) {
    if (teeth && big(r * 0.25)) {
      const n = teeth, tw = r * 0.2;
      g.save(); g.translate(x, y); g.rotate(ang);
      g.fillStyle = LINE_CSS;
      for (let i = 0; i < n; i++) { g.fillRect(r * 0.8, -tw, r * 0.36, tw * 2); g.rotate(TAU / n); }
      g.restore();
    }
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(x, y, r + ol * 0.6, 0, TAU); g.fill();
    g.fillStyle = loOf(col, 0.25); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x - r * 0.07, y - r * 0.1, r * 0.86, 0, TAU); g.fill();
    if (big(r * 0.4)) {
      const c = Math.cos(ang), s = Math.sin(ang), br = Math.max(0.5, r * 0.13), d = r * 0.52;
      g.fillStyle = LINE_CSS;
      g.beginPath();
      g.moveTo(x + c * d + br, y + s * d); g.arc(x + c * d, y + s * d, br, 0, TAU);
      g.moveTo(x - c * d + br, y - s * d); g.arc(x - c * d, y - s * d, br, 0, TAU);
      g.moveTo(x - s * d + br, y + c * d); g.arc(x - s * d, y + c * d, br, 0, TAU);
      g.moveTo(x + s * d + br, y - c * d); g.arc(x + s * d, y - c * d, br, 0, TAU);
      g.fill();
      g.fillStyle = hiOf(col, 0.4); g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.fill();
    }
  }
  // caminho com os riscos das sapatas ao redor do "estádio", do raio r0 ao r1
  function shoesPath(g, cx0, cx1, cy, R, r0, r1, phase, n) {
    const Ls = cx1 - cx0, arc = Math.PI * R, per = 2 * Ls + 2 * arc, sp = per / n;
    let s0 = phase % sp; if (s0 < 0) s0 += sp;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const s = s0 + k * sp;
      let px, py, nx, ny;
      if (s < Ls) { px = cx0 + s; py = cy; nx = 0; ny = -1; }
      else if (s < Ls + arc) { const a = -Math.PI / 2 + (s - Ls) / R; px = cx1; py = cy; nx = Math.cos(a); ny = Math.sin(a); }
      else if (s < 2 * Ls + arc) { px = cx1 - (s - Ls - arc); py = cy; nx = 0; ny = 1; }
      else { const a = Math.PI / 2 + (s - 2 * Ls - arc) / R; px = cx0; py = cy; nx = Math.cos(a); ny = Math.sin(a); }
      g.moveTo(px + nx * r0, py + ny * r0); g.lineTo(px + nx * r1, py + ny * r1);
    }
  }

  // Draw.track(g, x, y, w, h, phase, {col, wheels, belt, frame=true, ol}): esteira de trator dentro do retângulo (x,y,w,h);
  //   phase = distância rodada em unidades de mundo (as sapatas e as rodas andam com ela);
  //   col = cor do chassi/rodas, wheels = nº de roletes de apoio, belt = cor da esteira
  Draw.track = function (g, x, y, w, h, phase, o) {
    o = o || NO;
    const belt = o.belt ? col2(o.belt) : PAL.blk, col = o.col ? col2(o.col) : PAL.grayD, ol = olOf(o);
    if (w < h) w = h;
    const gh = h * 0.07, bt = h * 0.12, R = h / 2 - gh;
    const cx0 = x + h / 2, cx1 = x + w - h / 2, cy = y + h / 2, Ls = cx1 - cx0;
    phase = phase || 0;
    if (!big(h * 0.35)) { // longe: só a silhueta
      g.fillStyle = LINE_CSS; stadium(g, cx0, cx1, cy, h / 2 + ol); g.fill();
      g.fillStyle = belt; stadium(g, cx0, cx1, cy, h / 2); g.fill();
      g.fillStyle = loOf(belt, 0.4); stadium(g, cx0, cx1, cy, h / 2 - bt - gh); g.fill();
      return;
    }
    const per = 2 * Ls + TAU * R;
    const n = Math.max(8, Math.round(per / (h * 0.24))), shoeW = per / n * 0.46;
    g.lineCap = 'butt';
    // 1) contornos: garras + cinta
    if (ol > 0) {
      g.strokeStyle = LINE_CSS; g.lineWidth = shoeW + ol * 2;
      shoesPath(g, cx0, cx1, cy, R, R - 1, R + gh + ol, phase, n); g.stroke();
      g.fillStyle = LINE_CSS; stadium(g, cx0, cx1, cy, R + ol); g.fill();
    }
    // 2) cinta
    g.fillStyle = belt; stadium(g, cx0, cx1, cy, R); g.fill();
    // 3) sapatas (placas mais claras que andam) com fresta escura entre elas
    g.strokeStyle = hiOf(belt, 0.2); g.lineWidth = shoeW;
    shoesPath(g, cx0, cx1, cy, R, R - bt, R + gh, phase, n); g.stroke();
    g.strokeStyle = hiOf(belt, 0.36); g.lineWidth = shoeW * 0.3;
    shoesPath(g, cx0, cx1, cy, R, R + gh * 0.1, R + gh, phase + shoeW * 0.25, n); g.stroke();
    // 4) miolo escuro
    const Ri = R - bt;
    g.fillStyle = LINE_CSS; stadium(g, cx0, cx1, cy, Ri + ol * 0.5); g.fill();
    g.fillStyle = loOf(belt, 0.45); stadium(g, cx0, cx1, cy, Ri); g.fill();
    // 5) rodas
    const rBig = Math.max(0.05, Ri - Math.max(0.5, h * 0.02)), rw = Math.min(h * 0.17, Ri * 0.5), rt = h * 0.075;
    const steel = PAL.steelD;
    // roletes de retorno (em cima)
    const nTop = Math.max(0, Math.round(Ls / (h * 1.3)));
    for (let i = 0; i < nTop; i++) {
      const tx = cx0 + Ls * (i + 1) / (nTop + 1);
      bogie(g, tx, cy - Ri + rt, rt, phase / rt, steel, ol, 0);
    }
    // roletes de apoio (embaixo)
    const x0r = cx0 + rBig * 0.55, x1r = cx1 - rBig * 0.55;
    const nB = o.wheels !== undefined ? o.wheels : Math.max(0, Math.floor((x1r - x0r) / (rw * 2.25)) + 1);
    // 6) chassi entre as rodas
    if (o.frame !== false && Ls > h * 0.2) {
      const fh = h * 0.24, fy = cy - fh * 0.35;
      g.fillStyle = LINE_CSS; g.fillRect(cx0 - ol * 0.6, fy - ol * 0.6, Ls + ol * 1.2, fh + ol * 1.2);
      g.fillStyle = col; g.fillRect(cx0, fy, Ls, fh);
      g.fillStyle = hiOf(col, 0.28); g.fillRect(cx0, fy, Ls, fh * 0.26);
      g.fillStyle = loOf(col, 0.24); g.fillRect(cx0, fy + fh * 0.78, Ls, fh * 0.22);
    }
    for (let i = 0; i < nB; i++) {
      const bx = nB === 1 ? (x0r + x1r) / 2 : x0r + (x1r - x0r) * i / (nB - 1);
      bogie(g, bx, cy + Ri - rw, rw, phase / rw, steel, ol, 0);
    }
    // roda motriz (direita, com dentes) e roda guia (esquerda)
    bogie(g, cx1, cy, rBig, phase / R, col, ol, 9);
    bogie(g, cx0, cy, rBig, phase / R, col, ol, 0);
  };

  // Draw.piston(g, a, b, w, {col, rod, len, max, ol}): cilindro hidráulico de a=[x,y] até b; a camisa (largura w) fica presa em a,
  //   a haste cromada sai dela até b. len = comprimento fixo da camisa (padrão 55% de 'max' ou 60% da distância atual)
  Draw.piston = function (g, a, b, w, o) {
    o = o || NO;
    const col = o.col ? col2(o.col) : PAL.yel, rod = o.rod ? col2(o.rod) : PAL.steelL, ol = olOf(o);
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const len = Math.min(o.len || (o.max ? o.max * 0.55 : d * 0.6), d + w), rw = w * 0.42, hw = w / 2;
    let ang = Math.atan2(dy, dx), flip = 1;
    if (Math.cos(ang) < 0) flip = -1; // mantém a luz do lado de cima quando o cilindro aponta pra esquerda
    g.save();
    g.translate(a[0], a[1]); g.rotate(ang);
    if (flip < 0) g.scale(1, -1);
    // haste
    const r0 = Math.min(len * 0.5, d);
    if (d > r0) {
      g.fillStyle = LINE_CSS; g.fillRect(r0, -rw / 2 - ol, d - r0, rw + ol * 2);
      g.fillStyle = rod; g.fillRect(r0, -rw / 2, d - r0, rw);
      g.fillStyle = '#FFFFFF'; g.fillRect(r0, -rw * 0.32, d - r0, rw * 0.22);
      g.fillStyle = PAL.steelD; g.fillRect(r0, rw * 0.2, d - r0, rw * 0.3);
    }
    // olhal da haste
    const er = w * 0.42;
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(d, 0, er + ol, 0, TAU); g.fill();
    g.fillStyle = PAL.steelD; g.beginPath(); g.arc(d, 0, er, 0, TAU); g.fill();
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(d, 0, er * 0.38, 0, TAU); g.fill();
    // olhal da base
    const br = w * 0.56;
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, br + ol, 0, TAU); g.fill();
    g.fillStyle = loOf(col, 0.3); g.beginPath(); g.arc(0, 0, br, 0, TAU); g.fill();
    // camisa
    const b0 = w * 0.2;
    g.fillStyle = LINE_CSS; g.fillRect(b0 - ol, -hw - ol, len - b0 + ol * 2, w + ol * 2);
    g.fillStyle = col; g.fillRect(b0, -hw, len - b0, w);
    g.fillStyle = hiOf(col); g.fillRect(b0, -hw, len - b0, w * 0.24);
    g.fillStyle = loOf(col); g.fillRect(b0, hw - w * 0.24, len - b0, w * 0.24);
    // tampa (gaxeta) e anel traseiro
    const cw = Math.max(1.5, w * 0.3);
    g.fillStyle = LINE_CSS; g.fillRect(len - cw - ol * 0.5, -hw * 1.16 - ol, cw + ol, w * 1.16 + ol * 2);
    g.fillStyle = loOf(col, 0.34); g.fillRect(len - cw, -hw * 1.16, cw, w * 1.16);
    g.fillStyle = col; g.fillRect(len - cw, -hw * 1.16, cw, w * 0.3);
    if (big(w * 0.3)) { g.fillStyle = loOf(col, 0.3); g.fillRect(b0 + w * 0.5, -hw, Math.max(1, w * 0.14), w); }
    // pino da base
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, br * 0.36, 0, TAU); g.fill();
    g.restore();
  };

  /* ---------- luzes ---------- */
  const haloCache = new Map();
  function halo(col) {
    let cv = haloCache.get(col);
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = cv.height = 96;
      const c = cv.getContext('2d'), gr = c.createRadialGradient(48, 48, 2, 48, 48, 48);
      gr.addColorStop(0, U.rgba(col, 0.75)); gr.addColorStop(0.3, U.rgba(col, 0.36));
      gr.addColorStop(0.65, U.rgba(col, 0.1)); gr.addColorStop(1, U.rgba(col, 0));
      c.fillStyle = gr; c.fillRect(0, 0, 96, 96);
      if (haloCache.size >= 48) haloCache.clear();   // cor de luz animada (mixCss por frame) não pode vazar canvases
      haloCache.set(col, cv);
    }
    return cv;
  }

  // Draw.light(g, x, y, r, col, on, {ol, halo=4.5, add=false}): lâmpada de raio r; on = bool ou 0..1 (acesa tem halo suave)
  Draw.light = function (g, x, y, r, col, on, o) {
    o = o || NO; col = col2(col || PAL.red);
    const k = on === true ? 1 : on ? U.clamp(+on, 0, 1) : 0, ol = olOf(o);
    if (k > 0) {
      const hr = r * (o.halo || 4.5), pa = g.globalAlpha;
      g.globalAlpha = pa * k;
      if (o.add) g.globalCompositeOperation = 'lighter';
      g.drawImage(halo(col), x - hr, y - hr, hr * 2, hr * 2);
      if (o.add) g.globalCompositeOperation = 'source-over';
      g.globalAlpha = pa;
    }
    if (ol > 0) { g.fillStyle = LINE_CSS; g.beginPath(); g.arc(x, y, r + ol, 0, TAU); g.fill(); }
    if (k > 0) {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = hiOf(col, 0.55 * k); g.beginPath(); g.arc(x, y, r * 0.66, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.28, r * 0.28, 0, TAU); g.fill();
    } else {
      g.fillStyle = loOf(col, 0.62); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = loOf(col, 0.42); g.beginPath(); g.arc(x - r * 0.12, y - r * 0.15, r * 0.62, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - r * 0.28, y - r * 0.3, r * 0.2, 0, TAU); g.fill();
    }
  };

  /* ---------- passarelas ---------- */
  const railA = [0, 0], railB = [0, 0];
  const railO = { posts: 0, h: 6, col: undefined, lw: undefined, ol: undefined };

  // Draw.rail(g, a, b, {posts=6, h=6, col, lw=1.2, mid=true, ol}): guarda-corpo sobre a linha a->b (corrimão a 'h' de altura, montantes verticais)
  Draw.rail = function (g, a, b, o) {
    o = o || NO;
    const col = o.col ? col2(o.col) : PAL.yel, hh = o.h !== undefined ? o.h : 6, lw = o.lw || 1.2;
    const posts = Math.max(2, o.posts !== undefined ? o.posts : 6);
    const olv = o.ol !== undefined ? o.ol : Math.min(Draw.OL, lw), m = Draw.minPx / Draw.zoom, ol = olv > 0 ? Math.max(olv, m) : 0;
    const detail = big(hh * 0.35);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(a[0], a[1] - hh); g.lineTo(b[0], b[1] - hh);
    if (detail) {
      if (o.mid !== false) { g.moveTo(a[0], a[1] - hh * 0.5); g.lineTo(b[0], b[1] - hh * 0.5); }
      for (let i = 0; i < posts; i++) {
        const q = i / (posts - 1), px = a[0] + (b[0] - a[0]) * q, py = a[1] + (b[1] - a[1]) * q;
        g.moveTo(px, py); g.lineTo(px, py - hh);
      }
    }
    if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = lw + ol * 2; g.stroke(); }
    g.strokeStyle = col; g.lineWidth = lw; g.stroke();
  };

  // Draw.stairs(g, a, b, steps, {col, lw=2, rail=true, railH=7, railCol, stringer=true, ol}): escada em degraus entre a e b (qualquer ordem)
  Draw.stairs = function (g, a, b, steps, o) {
    o = o || NO;
    const col = o.col ? col2(o.col) : PAL.steel, lw = o.lw || 2, ol = olOf(o);
    let lo = a, hi = b;
    if (b[1] > a[1]) { lo = b; hi = a; }            // lo = ponta de baixo (y maior)
    const n = Math.max(1, steps | 0), sx = (hi[0] - lo[0]) / n, sy = (hi[1] - lo[1]) / n; // sy <= 0
    g.lineCap = 'round'; g.lineJoin = 'round';
    // longarina (viga inclinada por baixo dos degraus)
    if (o.stringer !== false) {
      const off = Math.max(lw, Math.abs(sy) * 0.55);
      g.beginPath(); g.moveTo(lo[0] + sx * 0.3, lo[1] + off * 0.3); g.lineTo(hi[0] - sx * 0.2, hi[1] + off);
      if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = lw * 1.3 + ol * 2; g.stroke(); }
      g.strokeStyle = loOf(col, 0.3); g.lineWidth = lw * 1.3; g.stroke();
    }
    // degraus (espelho + piso)
    if (big(Math.abs(sy) * 0.6 + Math.abs(sx) * 0.3)) {
      g.beginPath(); g.moveTo(lo[0], lo[1]);
      for (let i = 0; i < n; i++) {
        const x0 = lo[0] + sx * i, y1 = lo[1] + sy * (i + 1);
        g.lineTo(x0, y1); g.lineTo(x0 + sx, y1);
      }
    } else { g.beginPath(); g.moveTo(lo[0], lo[1]); g.lineTo(hi[0], hi[1]); }
    if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = lw + ol * 2; g.stroke(); }
    g.strokeStyle = col; g.lineWidth = lw; g.stroke();
    // corrimão
    if (o.rail !== false) {
      railA[0] = lo[0] + sx * 0.5; railA[1] = lo[1] + sy;
      railB[0] = hi[0] - sx * 0.5; railB[1] = hi[1];
      railO.posts = Math.max(2, Math.min(n, Math.ceil(n / 2) + 1)); railO.h = o.railH || 7;
      railO.col = o.railCol; railO.lw = Math.max(1, lw * 0.6); railO.ol = o.ol;
      Draw.rail(g, railA, railB, railO);
    }
  };

  /* ---------- texto e placas ---------- */
  const fontCache = new Map();
  function fontOf(size, weight, family) {
    if (family && family !== Draw.FONT) return weight + ' ' + size + 'px ' + family;
    const k = size * 1000 + weight;
    let f = fontCache.get(k);
    if (!f) {
      f = weight + ' ' + size + 'px ' + Draw.FONT;
      if (fontCache.size >= 300) fontCache.clear();  // tamanho animado (texto que "pula") gera muitas chaves
      fontCache.set(k, f);
    }
    return f;
  }

  // Draw.text(g, txt, x, y, {size=16, col='#FFFAEE', stroke=LINE_CSS, sw=4, align='center', font, weight=900, rot, baseline='middle', shadow=0, alpha})
  //   texto de jogo com traço grosso arredondado; shadow = deslocamento (px) de uma sombra dura embaixo
  // transformação com reflexo (determinante < 0): espelho do mundo ou scale(-1, 1) de máquina virada
  function mirrored(g) { if (!g.getTransform) return false; const m = g.getTransform(); return m.a * m.d - m.b * m.c < 0; }
  Draw.mirrored = mirrored;
  Draw.text = function (g, txt, x, y, o) {
    o = o || NO;
    const size = o.size || 16, sw = o.sw !== undefined ? o.sw : 4, stroke = o.stroke !== undefined ? o.stroke : LINE_CSS;
    const rot = o.rot || 0, pa = g.globalAlpha;
    g.font = fontOf(size, o.weight || 900, o.font);
    g.textAlign = o.align || 'center'; g.textBaseline = o.baseline || 'middle';
    g.lineJoin = 'round'; g.lineCap = 'round'; g.miterLimit = 2;
    if (o.alpha !== undefined) g.globalAlpha = pa * o.alpha;
    const fl = mirrored(g);   // mundo espelhado (ou máquina virada): o texto continua legível
    if (rot || fl) { g.save(); g.translate(x, y); if (fl) g.scale(-1, 1); if (rot) g.rotate(fl ? -rot : rot); x = 0; y = 0; }
    if (stroke && sw > 0) {
      g.strokeStyle = stroke; g.lineWidth = sw;
      if (o.shadow) g.strokeText(txt, x, y + o.shadow);
      g.strokeText(txt, x, y);
    }
    g.fillStyle = o.col ? col2(o.col) : '#FFFAEE';
    g.fillText(txt, x, y);
    if (rot || fl) g.restore();
    if (o.alpha !== undefined) g.globalAlpha = pa;
  };

  const fitCache = new Map();
  // tamanho de fonte (cacheado) pra um texto caber em maxW x maxH
  function fitSize(g, txt, maxW, maxH, weight, family) {
    const k = txt + '|' + Math.round(maxW * 4) + '|' + Math.round(maxH * 4) + '|' + weight + '|' + (family || '');
    let s = fitCache.get(k);
    if (s === undefined) {
      g.font = fontOf(100, weight, family);
      const tw = g.measureText(txt).width || 1;
      s = Math.max(1, Math.min(maxH, maxW / tw * 100));
      if (fitCache.size > 500) fitCache.clear();
      fitCache.set(k, s);
    }
    return s;
  }

  // Draw.sign(g, x, y, w, h, texto, {col, ink, r, border=true, weight=900, font, ol, rivets=false}): placa com moldura e texto que se ajusta sozinho
  Draw.sign = function (g, x, y, w, h, texto, o) {
    o = o || NO;
    const col = o.col ? col2(o.col) : PAL.cream, ink = o.ink ? col2(o.ink) : PAL.ink, ol = olOf(o);
    const r = o.r !== undefined ? o.r : Math.min(h * 0.18, 3);
    g.fillStyle = LINE_CSS; rrPath(g, x - ol, y - ol, w + ol * 2, h + ol * 2, r + ol); g.fill();
    g.fillStyle = loOf(col, 0.2); rrPath(g, x, y, w, h, r); g.fill();
    g.fillStyle = col; rrPath(g, x, y, w, h - Math.min(h * 0.12, 3), r); g.fill();
    const pad = Math.max(1, Math.min(h * 0.12, 3));
    if (o.border !== false && big(pad) && w > pad * 4 && h > pad * 4) {
      g.strokeStyle = ink; g.lineWidth = Math.max(0.5, pad * 0.35);
      rrPath(g, x + pad, y + pad, w - pad * 2, h - pad * 2.6, Math.max(0, r - pad * 0.5)); g.stroke();
    }
    if (o.rivets && big(pad)) {
      g.fillStyle = ink; const rr = pad * 0.4, e = pad * 2.1;
      g.beginPath();
      g.arc(x + e, y + e, rr, 0, TAU); g.moveTo(x + w - e + rr, y + e); g.arc(x + w - e, y + e, rr, 0, TAU);
      g.moveTo(x + e + rr, y + h - e * 1.2); g.arc(x + e, y + h - e * 1.2, rr, 0, TAU);
      g.moveTo(x + w - e + rr, y + h - e * 1.2); g.arc(x + w - e, y + h - e * 1.2, rr, 0, TAU);
      g.fill();
    }
    if (texto && big(h * 0.4)) {
      const weight = o.weight || 900, size = fitSize(g, texto, w - pad * 5, (h - pad * 3) * 0.78, weight, o.font);
      g.font = fontOf(size, weight, o.font);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = ink;
      const tx = x + w / 2, ty = y + (h - pad) / 2 + size * 0.04;
      if (mirrored(g)) { g.save(); g.translate(tx, ty); g.scale(-1, 1); g.fillText(texto, 0, 0); g.restore(); } else g.fillText(texto, tx, ty);
    }
  };

  /* ---------- texturas e sombra ---------- */
  const patCache = new Map();
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // Draw.pattern(g, nome, base, c2, c3, {size=48, n=170, shape='grain'|'dots'|'hatch'}) -> CanvasPattern cacheado (lado a lado sem emenda)
  //   'grain' = grãozinhos de arroz (c2 sombra, c3 luz); ladrilha perfeitamente; cache pelo nome
  Draw.pattern = function (g, name, base, c2, c3, o) {
    let p = patCache.get(name);
    if (p) return p;
    o = o || NO;
    const size = o.size || 48, n = o.n !== undefined ? o.n : 170, shape = o.shape || 'grain';
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d'), r = E.RNG(strHash(name));
    c.fillStyle = col2(base); c.fillRect(0, 0, size, size);
    const A = col2(c2 || loOf(base, 0.14)), B = col2(c3 || hiOf(base, 0.5));
    if (shape === 'hatch') {
      c.lineCap = 'round'; c.lineWidth = 1.4;
      const st = Math.max(4, Math.round(size / Math.max(1, Math.round(Math.sqrt(n)))));
      for (let i = -size; i < size * 2; i += st) {
        c.strokeStyle = (Math.round(i / st) & 1) ? A : B;
        c.beginPath(); c.moveTo(i, size); c.lineTo(i + size, 0); c.stroke();
      }
    } else {
      for (let i = 0; i < n; i++) {
        const x = r() * size, y = r() * size, a = r() * Math.PI, k = r();
        c.fillStyle = k < 0.55 ? A : B;
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { // repete nas bordas pra ladrilhar
          const X = x + ox * size, Y = y + oy * size;
          if (X < -6 || Y < -6 || X > size + 6 || Y > size + 6) continue;
          c.beginPath();
          if (shape === 'dots') c.arc(X, Y, 0.8 + k * 1.1, 0, TAU);
          else c.ellipse(X, Y, 2.3 + k * 0.9, 1.15, a, 0, TAU);
          c.fill();
        }
      }
    }
    p = g.createPattern(cv, 'repeat');
    p.canvas = cv;
    patCache.set(name, p);
    return p;
  };
  // Draw.pattern.clear(nome?): esvazia o cache de texturas
  Draw.pattern.clear = function (name) { if (name === undefined) patCache.clear(); else patCache.delete(name); };

  // Draw.shadow(g, x, y, rx, ry, alpha=.18): sombra elíptica no chão
  Draw.shadow = function (g, x, y, rx, ry, alpha) {
    g.fillStyle = alpha === undefined ? 'rgba(40,20,8,.18)' : 'rgba(40,20,8,' + alpha + ')';
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  };

  // Draw.rrect(g, x, y, w, h, r): só monta o caminho de um retângulo arredondado (pra fill/stroke/clip por conta própria)
  Draw.rrect = rrPath;

  /* ======================================================================
     6. Exporta
     ====================================================================== */
  E.LINE = LINE;
  E.LINE_CSS = LINE_CSS;
  E.PAL = PAL;
  E.Pix = Pix;
  E.sprite = sprite;
  // E.TEXT_PAL: letra -> cor pro desenho em texto (minúscula = tom escuro da mesma cor). '.' ou espaço = vazio.
  //   R vermelho  O laranja  Y amarelo/ouro  G verde  B azul  C céu/vidro  P rosa  V roxo  K madeira  S aço  A arroz/creme
  //   W branco  N preto/tinta  E pele/pelo do Kome  T palha/saco  M pedra
  const TEXT_PAL = {
    R: PAL.red, r: PAL.redD, O: PAL.ora, o: PAL.oraD, Y: PAL.gold, y: PAL.goldD, G: PAL.grass, g: PAL.grassD,
    B: PAL.bowlL, b: PAL.bowl, C: PAL.glass, c: PAL.glassD, P: PAL.sakura, p: PAL.sakuraD, V: '#8E6FB3', v: '#5E4A80',
    K: PAL.wood, k: PAL.woodD, S: PAL.steel, s: PAL.steelD, A: PAL.rice, a: PAL.riceS, W: PAL.white, w: PAL.steelL,
    N: PAL.blk, n: PAL.ink, E: PAL.fur, e: PAL.furS, T: PAL.sack, t: PAL.sackD, M: PAL.stone, m: PAL.stoneD,
  };
  E.TEXT_PAL = TEXT_PAL;
  // E.spriteText(nome, texto, {pal, outline=true, bevel=true, flip}) -> canvas cacheado
  //   Pixel art escrita como texto: cada linha é uma fileira e cada letra uma cor de E.TEXT_PAL (ou da 'pal' passada).
  //   Ganha contorno do traço do Kome e luz/sombra (3 tons) sozinho. Linhas vazias nas pontas são ignoradas.
  function spriteText(name, text, o) {
    o = o || {};
    const rows = String(text).split(/\r?\n/).map(l => l.replace(/\s+$/, ''));
    while (rows.length && !rows[0].trim()) rows.shift();
    while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
    const ind = Math.min.apply(null, rows.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
    const R = rows.map(l => l.slice(ind)), w = Math.max(1, ...R.map(l => l.length)), h = Math.max(1, R.length), pal = Object.assign({}, TEXT_PAL, o.pal || {});
    return sprite('txt/' + name, w + 2, h + 2, P => {
      for (let y = 0; y < h; y++) for (let x = 0; x < R[y].length; x++) {
        const ch = R[y][o.flip ? R[y].length - 1 - x : x], c = pal[ch];
        if (c) P.set(x + 1, y + 1, c);
      }
      if (o.bevel !== false && P.bevel) P.bevel(0.25, 0.2);
    }, o.outline !== false);
  }
  E.spriteText = spriteText;
  E.drawSprite = drawSprite;
  E.Draw = Draw;
})();


/* ===== engine/assets.js ===== */
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


/* ===== engine/shiba.js ===== */
/* Pixxel v1.0 · shiba.js
   O Kome (shiba chibi de chapéu kasa) desenhado em pixel art procedural numa grade 48x44.
   - E.ShibaPX      rasterizador original do rascunho (poses antigas pixel a pixel iguais) + poses novas
   - E.PALS         paletas {h,g,o,c,k,n,p}
   - E.drawShiba    desenha com os pés em (x,y), com cache de frames (aguenta 100+ shibas por frame)
   - E.drawShibaHead close de rosto com expressões para cutscenes
   - E.shibaAnchor  âncoras (pata, boca, cabeça, costas, topo do chapéu) por pose
   - E.shibaBelt    faixa (judô) amarrada na cintura de quem usa uma paleta: shibaBelt(nome, cor | {b,b2,bk} | null)
   - E.Actor        shiba com estado, objeto na pata e balão de fala
   Depende só de core.js. */
(function () {
  'use strict';
  const E = (window.Pixxel = window.Pixxel || {});
  if (!E.U) throw new Error('Pixxel: carregue core.js antes de shiba.js');
  const U = E.U;

  /* =====================================================================
     1. Rasterizador: buffer de índices de paleta (Uint8) reaproveitado
     ===================================================================== */
  const W = 48, H = 44, OY = 4;

  // índices de cor (0 = vazio). A paleta compilada é um Uint32Array indexado por eles.
  const FUR = 1, FURS = 2, FURD = 3, CREAM = 4, CREAMS = 5, EYE = 6, NOSE = 7, PINK = 8, BLUSH = 9,
    HAT = 10, HATS = 11, HATL = 12, LINE = 13, WHITE = 14, TEAR = 15, TEARL = 16, VEIN = 17, GOLD = 18,
    BELT = 19, BELTS = 20, BELTK = 21;   // faixa amarrada na cintura (camada nova; só existe se a paleta tiver b, ver shibaBelt)
  const NCOL = 32;

  const bodyBuf = new Uint8Array(W * H);
  // alvo atual das primitivas (trocado para o buffer do close de rosto quando preciso)
  let buf = bodyBuf, BW = W, BH = H, BOY = OY;
  let dry = false;                       // true = só calcula âncoras, não pinta

  function set(x, y, c) {
    if (dry) return;
    x = Math.round(x); y = Math.round(y + BOY);
    if (x >= 0 && y >= 0 && x < BW && y < BH && c) buf[y * BW + x] = c;
  }
  // ell/tri varrem pixels inteiros, então escrevem direto no buffer (mesmo resultado de set(), sem arredondar)
  function ell(cx, cy, rx, ry, c) {
    if (dry) return;
    let y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry), x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    if (y0 < -BOY) y0 = -BOY; if (y1 > BH - 1 - BOY) y1 = BH - 1 - BOY;
    if (x0 < 0) x0 = 0; if (x1 > BW - 1) x1 = BW - 1;
    // Mesmo teste do rascunho, pixel a pixel ((dx/rx)² + (dy/ry)² <= 1, com a MESMA aritmética), mas sem testar o miolo:
    // numa linha o teste é monótono dos dois lados do centro, então os pixels pintados formam um intervalo [a,b].
    const b8 = buf;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / ry, dy2 = dy * dy;
      if (dy2 > 1) continue;                               // linha inteira fora
      let a = x0, b = x1, dx;
      for (; a <= b; a++) { dx = (a + 0.5 - cx) / rx; if (dx * dx + dy2 <= 1) break; }
      for (; b > a; b--) { dx = (b + 0.5 - cx) / rx; if (dx * dx + dy2 <= 1) break; }
      const row = (y + BOY) * BW;
      for (let x = row + a, e = row + b; x <= e; x++) b8[x] = c;
    }
  }
  function rect(x, y, w, h, c) {
    if (dry) return;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c);
  }
  function triSide(px, py, qx, qy, rx, ry) { return (px - rx) * (qy - ry) - (qx - rx) * (py - ry); }
  function tri(ax, ay, bx, by, cx, cy, c) {
    if (dry) return;
    let minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    let minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    if (minY < -BOY) minY = -BOY; if (maxY > BH - 1 - BOY) maxY = BH - 1 - BOY;
    if (minX < 0) minX = 0; if (maxX > BW - 1) maxX = BW - 1;
    for (let y = minY; y <= maxY; y++) {
      const row = (y + BOY) * BW;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const d1 = triSide(px, py, ax, ay, bx, by), d2 = triSide(px, py, bx, by, cx, cy), d3 = triSide(px, py, cx, cy, ax, ay);
        const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) buf[row + x] = c;
      }
    }
  }
  function line(x0, y0, x1, y1, w, c) {
    if (dry) return;
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) { const t = i / n; ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, w / 2, c); }
  }

  // contorno 4-vizinhos + conversão índice -> RGBA empacotado, direto no Uint32 do ImageData.
  // under (opcional) = pixels que aparecem onde o sprite é vazio (a sombra do chão, já pronta em Uint32)
  function blit(src, w, h, lut, dst, under) {
    const ln = lut[LINE];
    let i = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
      const v = src[i];
      if (v) dst[i] = lut[v];
      else if ((x + 1 < w && src[i + 1]) || (x > 0 && src[i - 1]) || (y + 1 < h && src[i + w]) || (y > 0 && src[i - w])) dst[i] = ln;
      else dst[i] = under ? under[i] : 0;
    }
  }

  /* =====================================================================
     2. Paletas
     ===================================================================== */
  const PALS = {
    kome:  { h: '#E3BC62', g: '#B98A3A', o: '#D9A066', c: '#EBEBEB', k: '#2A1A10', n: '#2A1A10', p: '#D95763' },
    goma:  { h: '#C9CED6', g: '#8E96A3', o: '#B88E62', c: '#EFE0C4', k: '#2A1A10', n: '#2A1A10', p: '#E8707A' },
    kuro:  { h: '#E3BC62', g: '#B98A3A', o: '#34302C', c: '#C98A4A', k: '#F2E6C9', n: '#0E0C0B', p: '#E8707A' },
    shiro: { h: '#7FA7C9', g: '#4E7397', o: '#F1EADB', c: '#FFFFFF', k: '#2A1A10', n: '#2A1A10', p: '#E8707A' },
    /* novas (mesmo formato: h chapéu, g sombra do chapéu, o pelo, c creme, k olho, n focinho, p língua) */
    aka:    { h: '#E3BC62', g: '#B98A3A', o: '#C8663A', c: '#F6E7CF', k: '#2A1A10', n: '#2A1A10', p: '#E8707A' },
    cha:    { h: '#D9C7A0', g: '#A8946A', o: '#8E5E3C', c: '#E9D2AE', k: '#22140C', n: '#22140C', p: '#E0707A' },
    yuki:   { h: '#D8574E', g: '#A23A36', o: '#E6EEF5', c: '#FFFFFF', k: '#2B3A55', n: '#2B3A55', p: '#F08A96' },
    sakura: { h: '#F29CB4', g: '#C96A88', o: '#F2CDB6', c: '#FFF6EE', k: '#3A2018', n: '#3A2018', p: '#E8607A' },
    matcha: { h: '#8DB255', g: '#5F8236', o: '#D9A066', c: '#EBEBEB', k: '#2A1A10', n: '#2A1A10', p: '#D95763' },
    kin:    { h: '#C8423A', g: '#93302A', o: '#EDBE4A', c: '#FFF3C4', k: '#3A2408', n: '#3A2408', p: '#E8707A' },
    sumi:   { h: '#C8423A', g: '#93302A', o: '#5A5F6B', c: '#D9DDE3', k: '#16181D', n: '#16181D', p: '#E8707A' },
    momo:   { h: '#9ED9A8', g: '#6DAE7A', o: '#F6D3DC', c: '#FFF8F8', k: '#3A2018', n: '#3A2018', p: '#E8607A' },
    nihon:  { h: '#D8263A', g: '#A3182A', o: '#F8F4EC', c: '#FFFFFF', k: '#2A1A10', n: '#2A1A10', p: '#E8607A' },
  };

  const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  function pack(c) {
    return (LE ? (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0] : (c[0] << 24) | (c[1] << 16) | (c[2] << 8) | 255) >>> 0;
  }
  const hexc = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255]; };
  const mixc = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)).concat([255]);

  let palSeq = 0;
  // compila {h,g,o,c,k,n,p} -> {lut:Uint32Array, id}; as fórmulas de sombra são as do rascunho
  function compilePal(p) {
    if (p.__K) return p.__K;
    const fur = hexc(p.o), cream = hexc(p.c), hat = hexc(p.h);
    const lut = new Uint32Array(NCOL);
    lut[FUR] = pack(fur); lut[FURS] = pack(mixc(fur, [40, 20, 10], 0.28)); lut[FURD] = pack(mixc(fur, [40, 20, 10], 0.45));
    lut[CREAM] = pack(cream); lut[CREAMS] = pack(mixc(cream, fur, 0.35));
    lut[EYE] = pack(hexc(p.k)); lut[NOSE] = pack(hexc(p.n)); lut[PINK] = pack(hexc(p.p));
    lut[BLUSH] = pack(mixc(fur, hexc(p.p), 0.7));
    lut[HAT] = pack(hat); lut[HATS] = pack(hexc(p.g)); lut[HATL] = pack(mixc(hat, [255, 250, 230], 0.35));
    lut[LINE] = pack(mixc(fur, [20, 10, 5], 0.8)); lut[WHITE] = pack([255, 255, 255, 255]);
    lut[TEAR] = pack([98, 178, 232, 255]); lut[TEARL] = pack([205, 236, 255, 255]);
    lut[VEIN] = pack([214, 64, 54, 255]); lut[GOLD] = pack([255, 214, 92, 255]);
    const K = { lut, id: palSeq++, belt: 0 };
    if (p.b) {   // faixa (judô): b = cor, b2 = 2ª cor listrada (faixa coral), bk = nó
      const b = hexc(p.b);
      lut[BELT] = pack(b); lut[BELTS] = pack(p.b2 ? hexc(p.b2) : mixc(b, [40, 20, 10], 0.28)); lut[BELTK] = pack(p.bk ? hexc(p.bk) : mixc(b, [40, 20, 10], 0.5));
      K.belt = p.b2 ? 2 : 1;
    }
    try { Object.defineProperty(p, '__K', { value: K, enumerable: false, configurable: true }); } catch (e) { p.__K = K; }
    return K;
  }
  // resolve nome ou objeto de paleta
  // faixa por NOME de paleta (shibaBelt): o nome vira uma paleta derivada com b/b2/bk (id próprio = frames próprios no cache)
  const BELTON = Object.create(null), beltPals = Object.create(null);
  function getPal(p) {
    if (typeof p === 'string' || p == null) {
      const n = p || 'kome'; p = PALS[n] || PALS.kome;
      const bo = BELTON[n]; if (bo) { const key = n + '|' + bo.key; p = beltPals[key] || (beltPals[key] = Object.assign({}, p, bo.o)); }
    }
    return p;
  }
  // shibaBelt(nomeDaPaleta, cor | {b, b2, bk} | null): todo shiba desenhado com essa paleta (string) passa a usar a faixa
  //   amarrada na cintura (uma camada pintada depois da pose; as poses em si não mudam). null tira.
  function shibaBelt(pal, c) {
    const n = pal || 'kome';
    if (!c) { delete BELTON[n]; return; }
    const o = typeof c === 'string' ? { b: c } : { b: c.b, b2: c.b2 || null, bk: c.bk || null };
    if (!o.b) { delete BELTON[n]; return; }
    BELTON[n] = { key: o.b + '|' + (o.b2 || '') + '|' + (o.bk || ''), o };
  }
  // pinta a faixa no corpo já rasterizado: 2 colunas na altura do lombo (âncora 'back'), só por cima de pelo/creme,
  // + nó e duas pontas soltas pro lado do rabo (o contorno sai sozinho no blit)
  function beltPaint(kind) {
    const bx = Math.round(A.backX) - 1, by = Math.round(A.backY);
    let top = 99;
    for (let x = bx; x <= bx + 1; x++) for (let y = by - 3; y <= by + 10; y++) {
      const yy = y + OY; if (yy < 0 || yy >= H || x < 0 || x >= W) continue;
      const i = yy * W + x, c = bodyBuf[i];
      if (c >= FUR && c <= CREAMS) { bodyBuf[i] = kind === 2 ? ((((y >> 1) + (x - bx)) & 1) ? BELTS : BELT) : (x === bx ? BELT : BELTS); if (y < top) top = y; }
    }
    if (top === 99) return;
    const put = (x, y, c) => { const yy = y + OY; if (yy >= 0 && yy < H && x >= 0 && x < W) bodyBuf[yy * W + x] = c; };
    const ky = top + 2;
    put(bx - 1, ky, BELTK); put(bx - 1, ky + 1, BELTK);
    put(bx - 2, ky + 2, BELT); put(bx - 3, ky + 3, BELT); put(bx - 1, ky + 2, BELTS); put(bx - 1, ky + 3, BELTS);
  }

  /* =====================================================================
     3. Estado de desenho (opções da chamada atual) e âncoras capturadas
     ===================================================================== */
  const ShibaPX = { W, H, OY, quiet: false, tilt: 0, look: null, hatOn: true, mouthOverride: null, eyesOverride: null, mouth: [0, 0] };
  const S = { fast: 0 };                                   // parâmetros extras de pose (drive: orelhas pra trás)
  // âncoras em coordenadas da grade, preenchidas a cada pose()
  const A = { pawX: 0, pawY: 0, headX: 0, headY: 0, mouthX: 0, mouthY: 0, hatX: 0, hatY: 0, backX: 0, backY: 0, holdX: 0, holdY: 0, hasHold: false, paw2X: 0, paw2Y: 0, hasPaw2: false };

  /* =====================================================================
     4. Peças: perna, rabo, vida ociosa, cabeça  (porte fiel do rascunho)
     ===================================================================== */
  /* leg: do quadril ao pé, grossa, com patinha creme */
  function leg(x0, y0, x1, y1, far) {
    line(x0, y0, x1, y1 - 1, 3.2, far ? FURD : FURS);
    line(x0, y0, x1, y1 - 1, 2.2, far ? FURS : FUR);
    rect(Math.round(x1) - 1, Math.round(y1) - 1, 3, 2, far ? CREAMS : CREAM);
    if (!far) { A.pawX = x1; A.pawY = y1 - 1; }           // a última pata "de perto" vira a âncora padrão
  }
  /* braço dobrado (ombro -> cotovelo -> pata) no mesmo traço da perna */
  function arm(x0, y0, ex, ey, x1, y1, far) {
    line(x0, y0, ex, ey, 3.2, far ? FURD : FURS);
    line(x0, y0, ex, ey, 2.2, far ? FURS : FUR);
    leg(ex, ey, x1, y1, far);
  }
  function tail(cx, cy, wag) {
    const a = wag;
    line(cx + 4, cy + 4, cx + 1 + a * 0.5, cy + 1, 3.5, FUR);
    ell(cx + a, cy, 4.8, 4.4, FUR); ell(cx + a - 0.9, cy - 0.7, 3.5, 3.1, CREAM);
    ell(cx + a + 0.8, cy + 0.8, 2.7, 2.4, FUR); ell(cx + a + 1.1, cy + 1.1, 1.1, 1, FURS);
    set(cx + a - 2.6, cy - 2.2, WHITE);
  }
  /* vida ociosa: tudo derivado do tempo (sem estado salvo). Piscada simples, dupla ou lenta;
     tremida de orelha; inclinada de cabeça; olhar que passeia; rajadas de rabo */
  const hsh = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const LF = { blink: false, half: false, tw: 0, tilt: 0, look: null, wagK: 0 };
  const lookArr = [0, 0];
  function life(t) {
    LF.blink = false; LF.half = false; LF.tw = 0; LF.tilt = 0; LF.look = null; LF.wagK = 0;
    if (t < 2) return LF;
    if (ShibaPX.quiet) { LF.blink = (t % 3.7) < 0.12; return LF; }
    const bw = Math.floor(t / 3.1), d = t - bw * 3.1 - (0.4 + hsh(bw) * 2.2), kind = hsh(bw + 0.5);
    if (kind < 0.14) { LF.blink = d >= 0.08 && d < 0.5; LF.half = (d >= 0 && d < 0.08) || (d >= 0.5 && d < 0.62); }
    else LF.blink = (d >= 0 && d < 0.11) || (kind > 0.7 && d >= 0.24 && d < 0.35);
    const ew = Math.floor(t / 4.3), ed = t - ew * 4.3 - (0.5 + hsh(ew + 9.1) * 3.2);
    LF.tw = hsh(ew + 3.3) < 0.55 && ed >= 0 && ed < 0.32 ? (Math.floor(ed / 0.08) % 2 ? 1 : -1) : 0;
    const hw = Math.floor(t / 7.7), ho = t - hw * 7.7, hs = 1 + hsh(hw + 5.7) * 4.5;
    LF.tilt = hsh(hw + 1.9) < 0.3 && ho >= hs && ho < hs + 1.4 ? (hsh(hw + 2.2) < 0.5 ? 1 : -1) : 0;
    const gw = Math.floor(t / 5.3), go = t - gw * 5.3, gs = 0.6 + hsh(gw + 7.7) * 3;
    if (hsh(gw + 4.1) < 0.45 && go >= gs && go < gs + 1.2) {
      lookArr[0] = hsh(gw + 6.6) < 0.5 ? -1 : 1; lookArr[1] = hsh(gw + 8.8) < 0.3 ? -1 : 0; LF.look = lookArr;
    }
    const ww = Math.floor(t / 6.1), wo = t - ww * 6.1, ws = 0.5 + hsh(ww + 2.7) * 3.6;
    LF.wagK = hsh(ww + 0.9) < 0.5 && wo >= ws && wo < ws + 1.6 ? Math.sin((wo - ws) / 1.6 * Math.PI) : 0;
    return LF;
  }

  const EYES = ['open', 'half', 'happy', 'wide', 'spiral', 'squint', 'closed', 'wet', 'shock', 'sparkle', 'tight', 'sad', 'angry'];
  const MOUTHS = ['closed', 'open', 'smile', 'tongue', 'yawn', 'grit', 'teeth', 'frown', 'gasp', 'smug', 'none'];

  /* head(hx,hy,eyes,mouth,ears,hat,tilt,tw,look): a cabeça de perfil com chapéu kasa.
     eyes: ver EYES · mouth: ver MOUTHS · ears: 'up'|'back'|'none' */
  function head(hx, hy, eyes, mouth, ears, hatOpt, tilt, tw, look) {
    if (eyes === undefined) eyes = 'open';
    if (mouth === undefined) mouth = 'closed';
    if (ears === undefined) ears = 'up';
    if (tilt === undefined) tilt = ShibaPX.tilt || 0;
    if (tw === undefined) tw = 0;
    const hat = hatOpt !== false && ShibaPX.hatOn !== false;
    const MO = ShibaPX.mouthOverride || (mouth === 'grit' ? 'smile' : mouth);
    if (ShibaPX.eyesOverride) eyes = ShibaPX.eyesOverride;
    A.headX = hx; A.headY = hy; A.mouthX = hx + 8; A.mouthY = hy + 5; A.hatX = hx - 1 + tilt * 0.5; A.hatY = hat ? hy - 14 : hy - 8;
    // orelha de trás
    if (ears === 'none') { /* sem orelhas: quem chama desenha as suas (ex.: roll, caídas pela gravidade) */ }
    else if (ears === 'back') { tri(hx - 6, hy - 3, hx - 11, hy - 6, hx - 3, hy - 6, FURS); }
    else { tri(hx - 6 + tilt, hy - 6, hx - 4 + tilt, hy - 13, hx - 1, hy - 7, FURS); tri(hx - 5 + tilt, hy - 7, hx - 4 + tilt, hy - 11, hx - 2, hy - 7, CREAMS); }
    ell(hx, hy, 8.6, 8.2, FUR);
    ell(hx + 0.5, hy + 4.6, 6.4, 3.6, CREAM);
    ell(hx + 5.6, hy + 3.4, 4.6, 3.2, CREAM);
    rect(hx - 2, hy - 4, 2, 1, CREAM); rect(hx + 2, hy - 4, 2, 1, CREAM);
    ell(hx - 2.6, hy + 2.6, 2.2, 1.3, BLUSH);
    // olho
    let ex = hx + 2, ey = hy - 1;
    const lk = ShibaPX.look || look;
    if (lk && (eyes === 'open' || eyes === 'wide')) { ex += lk[0]; ey += lk[1]; }
    if (!dry) { ShibaPX.mouth[0] = hx + 8; ShibaPX.mouth[1] = hy + 5 + OY; }   // global do rascunho: só o desenho de verdade atualiza
    if (eyes === 'open') { rect(ex - 1, ey - 1, 3, 4, EYE); rect(ex, ey, 1, 1, WHITE); rect(ex - 1, ey - 1, 1, 1, WHITE); }
    else if (eyes === 'half') { rect(ex - 1, ey + 1, 3, 2, EYE); rect(ex - 1, ey, 3, 1, LINE); set(ex, ey + 1, WHITE); }
    else if (eyes === 'happy') { set(ex - 1, ey + 2, EYE); set(ex, ey + 1, EYE); set(ex + 1, ey + 1, EYE); set(ex + 2, ey + 2, EYE); }
    else if (eyes === 'wide') { rect(ex - 1, ey - 2, 3, 5, EYE); rect(ex - 1, ey - 2, 1, 2, WHITE); set(ex + 1, ey + 1, WHITE); }
    else if (eyes === 'spiral') { rect(ex - 2, ey - 1, 4, 1, EYE); rect(ex + 1, ey, 1, 3, EYE); rect(ex - 2, ey + 2, 3, 1, EYE); set(ex - 2, ey, EYE); set(ex - 1, ey + 1, EYE); }
    else if (eyes === 'squint') { rect(ex - 1, ey, 3, 2, EYE); set(ex + 1, ey, WHITE); set(ex - 1, ey - 2, LINE); set(ex, ey - 2, LINE); set(ex + 1, ey - 1, LINE); set(ex + 2, ey - 1, LINE); }
    /* ---- olhos novos ---- */
    else if (eyes === 'wet') {            // olhão molhado de choro: brilho grande em cima, água embaixo
      rect(ex - 2, ey - 2, 4, 5, EYE); rect(ex - 2, ey - 2, 2, 2, WHITE); set(ex + 1, ey, WHITE);
      rect(ex - 2, ey + 2, 4, 1, TEARL); set(ex - 1, ey - 3, LINE); set(ex, ey - 4, LINE); set(ex + 1, ey - 4, LINE);
    }
    else if (eyes === 'shock') {          // olho arregalado: branco grande com pupila pequena
      rect(ex - 2, ey - 2, 4, 5, WHITE); rect(ex - 1, ey - 3, 2, 1, WHITE); rect(ex - 1, ey + 3, 2, 1, WHITE);
      rect(ex, ey, 1, 2, EYE);
    }
    else if (eyes === 'sparkle') {        // olho brilhando
      rect(ex - 2, ey - 2, 4, 5, EYE); rect(ex - 1, ey - 2, 2, 2, WHITE); set(ex - 2, ey - 1, WHITE); set(ex + 1, ey + 1, WHITE); set(ex - 1, ey + 2, GOLD);
    }
    else if (eyes === 'tight') {          // > apertado de esforço/alegria
      set(ex - 1, ey - 1, EYE); set(ex, ey, EYE); set(ex + 1, ey + 1, EYE); set(ex, ey + 2, EYE); set(ex - 1, ey + 3, EYE);
    }
    else if (eyes === 'sad') {            // olho caído com sobrancelha triste
      rect(ex - 1, ey, 3, 3, EYE); set(ex - 1, ey, WHITE); set(ex, ey + 1, WHITE);
      set(ex - 2, ey - 1, LINE); set(ex - 1, ey - 2, LINE); set(ex, ey - 2, LINE); set(ex + 1, ey - 3, LINE);
    }
    else if (eyes === 'angry') {          // olho aberto com sobrancelha brava
      rect(ex - 1, ey - 1, 3, 4, EYE); set(ex, ey + 1, WHITE);
      set(ex - 2, ey - 3, LINE); set(ex - 1, ey - 3, LINE); set(ex, ey - 2, LINE); set(ex + 1, ey - 2, LINE); set(ex + 2, ey - 1, LINE);
    }
    else { rect(ex - 1, ey + 2, 4, 1, EYE); }
    // focinho e boca
    rect(hx + 9, hy + 1, 2, 2, NOSE); set(hx + 8, hy + 1, NOSE); set(hx + 9, hy + 1, CREAMS);
    if (MO === 'open') { rect(hx + 6, hy + 5, 4, 2, LINE); rect(hx + 7, hy + 6, 2, 2, PINK); }
    else if (MO === 'smile') { set(hx + 6, hy + 4, LINE); set(hx + 7, hy + 5, LINE); set(hx + 8, hy + 5, LINE); set(hx + 9, hy + 4, LINE); set(hx + 7, hy + 6, PINK); set(hx + 8, hy + 6, PINK); }
    else if (MO === 'tongue') { rect(hx + 6, hy + 5, 4, 1, LINE); rect(hx + 7, hy + 6, 2, 2, PINK); }
    else if (MO === 'yawn') { rect(hx + 5, hy + 3, 5, 5, LINE); rect(hx + 6, hy + 5, 3, 3, PINK); }
    else if (MO === 'grit' || MO === 'teeth') { rect(hx + 6, hy + 5, 4, 1, LINE); set(hx + 7, hy + 6, WHITE); set(hx + 9, hy + 6, WHITE); }
    /* ---- bocas novas ---- */
    else if (MO === 'frown') { set(hx + 6, hy + 6, LINE); set(hx + 7, hy + 5, LINE); set(hx + 8, hy + 5, LINE); set(hx + 9, hy + 6, LINE); }
    else if (MO === 'gasp') { rect(hx + 6, hy + 4, 4, 4, LINE); rect(hx + 7, hy + 5, 2, 3, PINK); }
    else if (MO === 'smug') { set(hx + 5, hy + 5, LINE); set(hx + 6, hy + 6, LINE); set(hx + 7, hy + 6, LINE); set(hx + 8, hy + 5, LINE); set(hx + 9, hy + 4, LINE); set(hx + 10, hy + 4, LINE); }
    else if (MO === 'none') { /* sem boca */ }
    else { set(hx + 7, hy + 5, LINE); set(hx + 8, hy + 6, LINE); set(hx + 9, hy + 5, LINE); }
    // chapéu: kasa cônico de lavrador de arroz
    if (hat) { tri(hx - 9, hy - 6, hx + 8, hy - 7, hx - 1 + tilt * 0.5, hy - 14, HAT); line(hx - 9, hy - 6, hx + 8, hy - 7, 1.4, HATS); line(hx - 1 + tilt * 0.5, hy - 14, hx - 3, hy - 7, 1, HATL); set(hx - 1 + tilt * 0.5, hy - 14, HATS); }
    // orelha da frente por cima do chapéu
    if (ears === 'none') { /* nada */ }
    else if (ears !== 'back') { tri(hx + 1 + tilt, hy - 7, hx + 4 + tilt + tw, hy - 14, hx + 7, hy - 6, FUR); tri(hx + 2.5 + tilt, hy - 7, hx + 4 + tilt + tw * 0.8, hy - 11.5, hx + 5.6, hy - 7, CREAM); }
    else tri(hx - 1, hy - 5, hx - 7, hy - 8, hx + 2, hy - 7, FUR);
  }

  /* headX(hx,hy,o): a MESMA cabeça de head(), mas carimbada virada/rodada em volta do centro (hx,hy).
     o = { eyes, mouth, ears, hat, tilt, tw, look (os mesmos de head) · flipX, flipY: espelha · rot: radianos, horário na tela }
     Desenha a cabeça num buffer temporário e copia pixel a pixel (vizinho mais próximo), então serve pra qualquer pose
     com a cabeça de ponta-cabeça (roll), de lado, olhando pra trás (flipX)... Sem rot o carimbo é exato (sem serrilhado).
     As âncoras (headX/Y, mouthX/Y, hatX/Y) e ShibaPX.mouth saem já transformadas. */
  const HXW = 40, HXC = 20, headXBuf = new Uint8Array(HXW * HXW);
  function headX(hx, hy, o) {
    o = o || {};
    const fx = o.flipX ? -1 : 1, fy = o.flipY ? -1 : 1, rot = o.rot || 0, co = Math.cos(rot), si = Math.sin(rot);
    // sem rotação o pivô cai num canto de pixel (carimbo 1:1); com rotação fica no centro fracionário
    const px = rot ? hx : Math.round(hx), py = rot ? hy : Math.round(hy);
    const sb = buf, sw = BW, sh = BH, so = BOY;
    if (!dry) { headXBuf.fill(0); buf = headXBuf; BW = HXW; BH = HXW; BOY = 0; }
    head(HXC, HXC, o.eyes, o.mouth, o.ears, o.hat, o.tilt, o.tw, o.look);
    buf = sb; BW = sw; BH = sh; BOY = so;
    // âncoras: do espaço da cabeça (centro HXC) pro da pose
    const ax = (x, y) => px + (x - HXC) * fx * co - (y - HXC) * fy * si, ay = (x, y) => py + (x - HXC) * fx * si + (y - HXC) * fy * co;
    const mx = A.mouthX, my = A.mouthY, tx = A.hatX, ty = A.hatY;
    A.headX = px; A.headY = py; A.mouthX = ax(mx, my); A.mouthY = ay(mx, my); A.hatX = ax(tx, ty); A.hatY = ay(tx, ty);
    if (dry) return;
    ShibaPX.mouth[0] = A.mouthX; ShibaPX.mouth[1] = A.mouthY + OY;
    const R = HXC - 1, x0 = Math.max(0, Math.floor(px - R)), x1 = Math.min(BW - 1, Math.ceil(px + R));
    const y0 = Math.max(-BOY, Math.floor(py - R)), y1 = Math.min(BH - 1 - BOY, Math.ceil(py + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - px, dy = y + 0.5 - py;
      const u = Math.floor(HXC + (dx * co + dy * si) * fx), v = Math.floor(HXC + (-dx * si + dy * co) * fy);
      if (u < 0 || v < 0 || u >= HXW || v >= HXW) continue;
      const c = headXBuf[v * HXW + u];
      if (c) buf[(y + BOY) * BW + x] = c;
    }
  }

  /* =====================================================================
     5. Poses
     ===================================================================== */
  const s = Math.sin;
  const back = (x, y) => { A.backX = x; A.backY = y; };
  const hold = (x, y) => { A.holdX = x; A.holdY = y; A.hasHold = true; };

  // estado da passada das poses em pé (era um closure no rascunho)
  const LG = { ph: 0, amp: 0, lift: 0, fy: 37, tuck: 0, fly: 0, by: 0, air: false };
  function stepLeg(base, off, far, hipX) {
    const a = s(LG.ph + off), x = base + a * LG.amp, y = LG.fy - Math.max(0, Math.cos(LG.ph + off)) * LG.lift - LG.tuck - LG.fly;
    leg(hipX, 29 + LG.by, LG.air ? hipX + (far ? -2 : 2) : x, y, far);
  }

  /* ---------- poses novas (mesma construção das antigas) ---------- */

  // drive: sentado ereto, as duas patas no volante, quicando com o motor; S.fast deita as orelhas
  function poseDrive(t, eyesO) {
    const fast = S.fast > 0.5;
    const rum = s(t * 31) * 0.4 + s(t * 7.3) * (fast ? 0.8 : 0.45), by = rum, st = s(t * 2.3) * 1.1;
    tail(11, 27 + by * 0.4, fast ? s(t * 26) * 1.4 : s(t * 6) * 0.9);
    ell(18, 31.5, 7.5, 5, FURS); leg(18, 33, 25, 37, false);
    ell(21, 28 + by * 0.4, 8, 7, FUR); ell(26, 28 + by * 0.4, 4, 5.4, CREAM);
    back(19, 21 + by * 0.4);
    const gy = 25.5 + by * 0.6;
    leg(27, 26 + by * 0.5, 37.5, gy - 1.5 - st, true);
    head(30, 15.5 + by, fast ? 'happy' : eyesO, fast ? 'tongue' : 'smile', fast ? 'back' : 'up', true, 0, fast ? 0 : LF.tw);
    leg(28, 27.5 + by * 0.5, 38, gy + 1.5 + st, false);
    A.pawX = 38; A.pawY = gy; hold(39, gy - 0.5);
  }

  // push: corpo inclinado pra frente, patas da frente esticadas na altura do peito, patas de trás andando
  function posePush(t, extra) {
    const ph = t * 9.5, bob = Math.abs(s(ph)) * 0.9, by = -bob;
    const fA = 12 + s(ph + Math.PI) * 3.6, fB = 16.5 + s(ph) * 3.6;
    tail(8, 21 + by, s(ph) * 1.2);
    leg(16, 29 + by, fA, 37 - Math.max(0, Math.cos(ph + Math.PI)) * 2.6, true);
    leg(20, 29 + by, fB, 37 - Math.max(0, Math.cos(ph)) * 2.6, false);
    ell(18.5, 27 + by, 7, 6, FUR); ell(24, 22.5 + by, 7.2, 6.4, FUR);
    ell(22.5, 29.5 + by, 5, 2.4, CREAM); ell(28, 24.5 + by, 3.2, 4.4, CREAM);
    back(19, 19 + by);
    const sh = s(ph * 2) * 0.5;                            // tranco do esforço nos braços
    leg(31, 20.5 + by, 41 + sh, 20.5 + by, true);
    head(29.5, 11 + by, 'squint', 'teeth', 'back', true);
    leg(28, 26.5 + by, 41.5 + sh, 26.5 + by, false);
    A.pawX = 41.5 + sh; A.pawY = 23 + by; hold(43 + sh, 23 + by);
    if (extra) { const k = (t * 2.2) % 1; if (k < 0.6) { set(19 - k * 8, 6 + by + k * 5, TEARL); set(18 - k * 8, 5 + by + k * 5, WHITE); } }
  }

  // carry: andando nas patas de trás, patas da frente levantadas segurando a carga em cima do chapéu
  function poseCarry(t, eyesO) {
    const ph = t * 9.5, bob = Math.abs(s(ph)) * 1.0, by = 2.2 - bob;
    tail(15, 28 + by, s(ph) * 1.4);
    leg(21, 31 + by, 20 + s(ph + Math.PI) * 2.6, 37 - Math.max(0, Math.cos(ph + Math.PI)) * 2.2, true);
    leg(26, 31 + by, 27 + s(ph) * 2.6, 37 - Math.max(0, Math.cos(ph)) * 2.2, false);
    ell(23.5, 26 + by, 6.6, 7.8, FUR); ell(25.5, 28 + by, 3.4, 5.2, CREAM);
    back(18, 22 + by);
    const hy = 15 + by, py = 1.5 + by * 0.5;
    leg(20, 23 + by, 13.5, py + 1, true);
    leg(29, 23 + by, 37, py + 1, false);
    head(25, hy, eyesO, 'smile', 'up', true, 0, 0);
    A.pawX = 37; A.pawY = py; hold(25, py - 1.5);
  }

  // cheer: pulinho de comemoração com as duas patas pra cima
  function poseCheer(t) {
    const k = Math.abs(s(t * 7)), hop = k * 3.2, by = 2 - hop, air = Math.max(0, hop - 1.4) * 1.3, up = s(t * 14);
    tail(15, 28 + by, s(t * 24) * 1.8);
    leg(21, 31 + by, 19.5 - air * 0.4, 37 - air, true); leg(26, 31 + by, 27.5 + air * 0.4, 37 - air, false);
    ell(23.5, 26 + by, 6.6, 8.2, FUR); ell(25.5, 28 + by, 3.4, 5.4, CREAM);
    back(18, 21 + by);
    leg(20, 22 + by, 13.5 - k, 11.5 + by - k * 1.5 + up * 0.6, true);
    leg(29, 22 + by, 37 + k, 10.5 + by - k * 1.5 - up * 0.6, false);
    head(25, 13.5 + by, 'happy', 'open', 'up', true, Math.round(s(t * 7) * 0.8));
    A.pawX = 37 + k; A.pawY = 9.5 + by - k * 1.5;
  }

  // point: em pé nas patas de trás, braço esticado apontando pra frente
  function posePoint(t, eyesO) {
    const br = s(t * 2.2) * 0.5, by = -br * 0.5, jab = Math.max(0, s(t * 5)) * 1.2;
    tail(14, 27 + by * 0.5, s(t * 6) * 1.2 + s(t * 27) * 1.6 * LF.wagK);
    leg(21, 30 + by, 19.5, 37, true); leg(26, 30 + by, 27.5, 37, false);
    ell(23.5, 25 + by, 6.6, 8.6, FUR); ell(25.5, 27 + by, 3.4, 5.6, CREAM);
    back(18, 20 + by);
    arm(20, 21.5 + by, 16.5, 25 + by, 19.5, 29 + by, true);
    head(26, 11.5 + by, eyesO, 'open', 'up', true, 0, LF.tw);
    leg(28.5, 22.5 + by, 39.5 + jab, 22 + by, false);
    A.pawX = 40 + jab; A.pawY = 21 + by; hold(41 + jab, 21 + by);
  }

  // wave: em pé, dando tchau com a pata da frente
  function poseWave(t) {
    const br = s(t * 2.2) * 0.5, by = -br * 0.5, sw = s(t * 11), a = 0.72 + sw * 0.42;
    tail(14, 27 + by * 0.5, s(t * 20) * 1.6);
    leg(21, 30 + by, 19.5, 37, true); leg(26, 30 + by, 27.5, 37, false);
    ell(23.5, 25 + by, 6.6, 8.6, FUR); ell(25.5, 27 + by, 3.4, 5.6, CREAM);
    back(18, 20 + by);
    arm(20, 21.5 + by, 16.5, 25 + by, 19.5, 29 + by, true);
    head(25.5, 11.5 + by, 'happy', 'open', 'up', true, Math.round(sw * 0.7));
    const ex = 34.5, ey = 22 + by, px = ex + Math.cos(a) * 7.5, py = ey - Math.sin(a) * 7.5;
    arm(28.5, 22.5 + by, ex, ey, px, py + 1, false);
    A.pawX = px; A.pawY = py;
  }

  // base sentada comum a think/cry (igual à pose 'sit' do rascunho, sem a pata de perto)
  function sitBase(t, br, wag) {
    tail(11, 27, wag);
    ell(18, 31.5, 7.5, 5, FURS); leg(18, 33, 22, 37, false);
    ell(21, 28 - br * 0.25, 8, 7 + br * 0.45, FUR); ell(26, 28 - br * 0.25, 4 + br * 0.3, 5.4 + br * 0.35, CREAM);
    back(18, 21 - br * 0.5);
    leg(25, 29, 25, 37, true);
  }

  // think: sentado, pata no queixo, olhando pra cima, reticências
  function poseThink(t, extra) {
    const br = s(t * 2.2) * 0.7, hy = 16 - br * 0.7, cyc = t % 4.6, shut = cyc > 3.6 && cyc < 4.2;
    sitBase(t, br, s(t * 3) * 0.7);
    lookArr[0] = 1; lookArr[1] = -1;
    head(30, hy, shut ? 'closed' : 'open', 'closed', 'up', true, 1, 0, lookArr);
    arm(27.5, 28.5, 33, 30.5, 36.5, hy + 9.5, false);
    A.pawX = 36.5; A.pawY = hy + 8.5;
    if (extra) {                                           // "..." aparecendo um a um acima do focinho
      const n = Math.floor(t * 2.2) % 4;
      if (n > 0) rect(38, 5, 2, 2, WHITE);
      if (n > 1) rect(41.5, 3, 2, 2, WHITE);
      if (n > 2) rect(45, 1, 2, 2, WHITE);
    }
  }

  // cry: sentado, cabeça baixa, olhão molhado e lágrima escorrendo
  function poseCry(t, extra) {
    const sob = Math.abs(s(t * 8)) * 0.8, br = s(t * 8) * 0.5, hy = 17.4 + sob;
    sitBase(t, br, 0);
    leg(29, 29, 29.5, 37, false);
    head(30, hy, 'wet', s(t * 8) > 0 ? 'frown' : 'open', 'back', true, 0, 0);
    // lágrima: fio descendo pela bochecha + gota caindo
    const k = (t * 1.7) % 1, tx = 31;
    rect(tx, hy + 2, 1, 4, TEAR); set(tx, hy + 2 + ((t * 9) % 4), TEARL);
    set(tx, hy + 6 + k * 13, TEAR); set(tx, hy + 5 + k * 13, TEARL);
    if (extra && k > 0.8) { set(tx - 2, 36, TEARL); set(tx + 2, 36, TEARL); }
  }

  // gasp: choque. Olho arregalado, orelha pra trás, pelo arrepiado, boca aberta, rabo em pé
  function poseGasp(t, extra) {
    const tr = Math.round(s(t * 43)) * 0.5, by = -1.5;
    // rabo eriçado: a bolota de sempre, com uma coroa de tufos curtinhos espetados em volta (estilo susto de desenho animado)
    const tcx = 10, tcy = 16.5 + by;
    for (let i = 0; i < 6; i++) {
      const a = -3.25 + i * 0.62, r1 = 7.3 - (i & 1) * 0.9, c0 = Math.cos(a), s0 = Math.sin(a);
      tri(tcx + Math.cos(a - 0.34) * 4.3, tcy + Math.sin(a - 0.34) * 4.3, tcx + c0 * r1, tcy + s0 * r1, tcx + Math.cos(a + 0.34) * 4.3, tcy + Math.sin(a + 0.34) * 4.3, FUR);
    }
    tail(tcx, tcy, 0);
    leg(15, 29 + by, 12.5, 37, true); leg(19, 29 + by, 17.5, 37, false);
    // pelo arrepiado nas costas
    for (let i = 0; i < 3; i++) { const x = 15.5 + i * 3.6; tri(x - 1.7, 21.5 + by, x - 0.7, 18 + by + (i & 1) * 0.7, x + 1.8, 21.2 + by, FUR); }
    ell(21, 26 + by, 10.5, 6.6, FUR); ell(21, 30 + by, 7.5, 2.8, CREAM); ell(29, 25 + by, 3.6, 4.6, CREAM);
    back(20, 19 + by);
    leg(26, 29 + by, 28.5, 37, true); leg(29, 29 + by, 33, 37, false);
    const hx = 32 + tr, hy = 14.5 + by;
    // tufos na nuca
    tri(hx - 7, hy - 1, hx - 12, hy + 0.5, hx - 7.5, hy + 3, FUR); tri(hx - 6, hy + 3, hx - 11, hy + 5.5, hx - 5, hy + 6.5, FUR);
    head(hx, hy, 'shock', 'gasp', 'back', true);
    if (extra) {
      const f = Math.floor(t * 10) % 2;
      line(44 + f, 3.5, 46 + f, 1, 1, WHITE); line(45.5 + f, 9, 47.5, 8, 1, WHITE); line(42, 1.5 - f, 42.5, -1.5, 1, WHITE);
    }
  }

  // proud: peito estufado, patas na cintura, olho fechado feliz, queixo pra cima
  function poseProud(t, extra) {
    const br = s(t * 2.4) * 0.6, by = -Math.max(0, br) * 0.4;
    tail(14, 26.5, s(t * 9) * 1.5);
    leg(21, 30, 19, 37, true); leg(26, 30, 28, 37, false);
    ell(23.5, 25 + by, 6.6, 8.6, FUR); ell(26.4, 25.5 + by, 4.3 + br * 0.3, 6.2, CREAM);
    back(17.5, 20 + by);
    arm(20, 21.5 + by, 15.5, 25 + by, 19.5, 29.5 + by, true);
    head(25, 11 + by, 'happy', 'smile', 'up', true, -1);
    arm(29, 22 + by, 33.5, 25.5 + by, 30, 30 + by, false);
    A.pawX = 30; A.pawY = 29 + by;
    if (extra) {                          // brilho de orgulho piscando
      const f = Math.floor(t * 5) % 4, sx = 39, sy = 5;
      if (f < 3) { set(sx, sy, WHITE); if (f > 0) { set(sx - 1, sy, GOLD); set(sx + 1, sy, GOLD); set(sx, sy - 1, GOLD); set(sx, sy + 1, GOLD); } if (f === 2) { set(sx - 2, sy, GOLD); set(sx + 2, sy, GOLD); set(sx, sy - 2, GOLD); set(sx, sy + 2, GOLD); } }
      const g2 = (f + 2) % 4; if (g2 < 2) { set(43, 12, WHITE); if (g2) { set(42, 12, GOLD); set(44, 12, GOLD); set(43, 11, GOLD); set(43, 13, GOLD); } }
    }
  }

  // climb: de perfil, subindo escada (a escada fica à direita), patas alternando pra cima
  function poseClimb(t) {
    const ph = t * 7, a = s(ph), up = Math.max(0, a), dn = Math.max(0, -a), by = -Math.abs(a) * 1.1 + 1;
    tail(15, 30 + by, s(t * 8) * 1.1);
    leg(20.5, 31.5 + by, 29, 36.5 - dn * 4.5, true);
    leg(22, 32 + by, 30, 36.5 - up * 4.5, false);
    ell(22.5, 25.5 + by, 6.2, 8.8, FUR); ell(26, 26.5 + by, 3.1, 6.2, CREAM);
    back(17, 21 + by);
    leg(26.5, 20.5 + by, 36, 9.5 - up * 5 + by * 0.3, true);
    leg(27.5, 22 + by, 36.5, 10.5 - dn * 5 + by * 0.3, false);
    lookArr[0] = 0; lookArr[1] = -1;
    head(24, 12.5 + by, 'open', 'smile', 'up', true, 0, 0, lookArr);
    A.pawX = 36.5; A.pawY = 9.5 - dn * 5 + by * 0.3;
  }

  /* ---------- poses de DUAS PATAS (hold2 / swing2 / lean) ----------
     Em pé nas patas de trás, as duas patas da frente juntas segurando algo (cabo, tigela, punho). Feitas pra ferramenta:
     o braço e a inclinação do corpo podem vir de fora, contínuos, sem rodar o sprite (drawShiba/shibaAnchor com
     o.arm, o.arm2, o.lean; aí o frame sai exato, fora do cache):
       arm  = ângulo do braço de perto, em radianos no sentido do canvas (0 = pra frente, + = pra baixo, −π/2 = pra cima,
              −2.4 = por cima do ombro, pra trás)
       arm2 = ângulo do braço de trás (padrão: igual ao arm, as duas patas no mesmo cabo; diferente = moinho)
       lean = −1 (arqueado pra trás, tomando impulso) .. 0 (ereto) .. 1 (curvado pra frente, fazendo força)
     Sem parâmetro: hold2 = segurando na altura do peito · swing2 = patas por cima da cabeça (armando o golpe) ·
     lean = empurrando, corpo inclinado e patas de trás andando.
     Âncoras: 'paw' = pata de perto, 'paw2' = pata de trás, 'hold' = entre as duas. */
  const TWO = { arm: NaN, arm2: NaN, lean: NaN };
  function poseTwo(t, eyesO, kind) {
    const br = s(t * 2.2) * 0.5, by = -br * 0.5;
    let arm, lean;
    if (kind === 'swing2') { arm = -2.35 + s(t * 2.6) * 0.12; lean = -0.55; }
    else if (kind === 'lean') { arm = 0.05 + s(t * 19) * 0.03; lean = 1; }
    else { arm = 0.12 + br * 0.08; lean = 0; }
    if (TWO.arm === TWO.arm) arm = TWO.arm;
    if (TWO.lean === TWO.lean) lean = TWO.lean < -1 ? -1 : TWO.lean > 1 ? 1 : TWO.lean;
    const arm2 = TWO.arm2 === TWO.arm2 ? TWO.arm2 : arm;
    const la = lean * 0.4, co = Math.cos(la), si = Math.sin(la);
    const hx0 = 23 - lean * 1.2, hy0 = 30.5 + by + Math.abs(lean) * 0.6;
    // ponto (dx,dy) do corpo ereto, medido do quadril, inclinado por 'la' em volta do quadril
    const rx = (dx, dy) => hx0 + dx * co - dy * si, ry = (dx, dy) => hy0 + dx * si + dy * co;
    // patas de trás: plantadas, a de trás recua quando ele curva (apoio); 'lean' anda
    if (kind === 'lean') {
      const ph = t * 9.5, fA = 13 + s(ph + Math.PI) * 3.4, fB = 18.5 + s(ph) * 3.4;
      tail(rx(-8.5, -4), ry(-8.5, -4), s(ph) * 1.2);
      leg(hx0 - 2, hy0, fA, 37 - Math.max(0, Math.cos(ph + Math.PI)) * 2.4, true);
      leg(hx0 + 2.5, hy0, fB, 37 - Math.max(0, Math.cos(ph)) * 2.4, false);
    } else {
      tail(rx(-9, -3.5), ry(-9, -3.5), s(t * 6) * 1.1 + s(t * 27) * 1.6 * LF.wagK);
      leg(hx0 - 2, hy0, 19.5 - Math.max(0, lean) * 3.5 + Math.max(0, -lean) * 1, 37, true);
      leg(hx0 + 2.5, hy0, 27.5 + Math.max(0, lean) * 1.2 - Math.max(0, -lean) * 1.5, 37, false);
    }
    // braço de trás: nasce atrás do peito (desenhado antes do corpo), a pata aparece na frente
    const reach = a => 10.5 + Math.max(0, -Math.sin(a)) * 11 + Math.max(0, -Math.cos(a)) * Math.max(0, -Math.sin(a)) * 6;
    const sfx = rx(1.5, -8.5), sfy = ry(1.5, -8.5), L2 = reach(arm2) - 0.5;
    const p2x = sfx + Math.cos(arm2) * L2, p2y = sfy + Math.sin(arm2) * L2;
    leg(sfx, sfy, p2x, p2y + 1, true);
    // corpo: quadril + peito (duas bolotas no eixo inclinado), barriga creme
    ell(rx(0.5, -3.5), ry(0.5, -3.5), 6.6, 5.8, FUR);
    ell(rx(1, -9.5), ry(1, -9.5), 6.2, 6.4, FUR);
    ell(rx(2.6, -4), ry(2.6, -4), 3.4, 4.2, CREAM);
    ell(rx(3.2, -9.5), ry(3.2, -9.5), 3, 4, CREAM);
    back(rx(-5, -10), ry(-5, -10));
    // braço de perto: ombro na frente do peito
    const snx = rx(4.5, -8), sny = ry(4.5, -8), L1 = reach(arm);
    const p1x = snx + Math.cos(arm) * L1, p1y = sny + Math.sin(arm) * L1;
    const behindHead = Math.sin(arm) < -0.55 && Math.cos(arm) < 0.35;   // patas por cima/atrás da cabeça: braço passa por trás
    if (behindHead) leg(snx, sny, p1x, p1y + 1, false);
    // cabeça: vai junto com o tronco; olha pra cima quando as patas estão no alto
    const hdx = rx(3, -19.5) + Math.max(0, lean) * 1.2, hdy = ry(3, -19.5);
    const up = Math.sin(arm) < -0.6;
    if (up) { lookArr[0] = 0; lookArr[1] = -1; }
    const effort = lean > 0.55 || kind === 'swing2';
    head(hdx, hdy, effort ? 'squint' : eyesO, effort ? 'grit' : kind === 'hold2' ? 'smile' : 'open', lean > 0.6 ? 'back' : 'up', true, 0,
      effort ? 0 : LF.tw, up ? lookArr : null);
    if (!behindHead) leg(snx, sny, p1x, p1y + 1, false);
    A.pawX = p1x; A.pawY = p1y; A.paw2X = p2x; A.paw2Y = p2y; A.hasPaw2 = true;
    hold((p1x + p2x) / 2, (p1y + p2y) / 2);
  }

  /* ---------- pose(): despacha; as poses antigas são o código do rascunho ---------- */
  let LIFE_T = null;   // cache em laço: a vida ociosa (piscada, orelha) usa o t de verdade, o corpo usa o t dentro do ciclo
  function pose(mode, t, extra) {
    life(LIFE_T === null ? t : LIFE_T);
    A.hasHold = false; A.hasPaw2 = false; A.pawX = 32; A.pawY = 36; A.backX = 20; A.backY = 19.5;
    const eyesO = LF.blink ? 'closed' : LF.half ? 'half' : 'open';
    if (mode === 'roll') {
      /* REDESENHADA a pedido do dono (a do rascunho, parada, parecia um cachorro morto): de barriga pra cima pedindo carinho.
         Corpo em banana que balança de um lado pro outro, quatro patas dobradas pedalando, rabo abanando, chapéu torto. */
      const rock = s(t * 5.5), rx = rock * 1.2, up = rock * 1.1, k = t * 13;
      tail(7 + rx * 0.6, 29.5 - up, s(t * 30) * 1.9);
      // corpo em banana: quadril e peito levantados, lombo redondo apoiado no chão, barrigão creme pra cima
      ell(19 + rx, 33, 8.2, 4, FURS);
      ell(13.5 + rx, 30.6 - up, 6.2, 5, FUR);
      ell(24.5 + rx, 30 + up * 0.7, 6.6, 5.4, FUR);
      ell(19 + rx, 32, 7.8, 4, FUR);
      ell(18.5 + rx, 28.4 - up * 0.15, 7.8, 2.7, CREAM);
      ell(24.5 + rx, 27.6 + up * 0.6, 3.2, 2.6, CREAM);
      // patas pro alto, dobradas no punho, pedalando alternadas (cada uma na sua fase)
      const paw = (hx0, hy0, ph, far) => {
        const a = s(k + ph), b = Math.cos(k + ph), kx = hx0 + a * 1.5, ky = hy0 - 5.6 - b * 0.8;
        arm(hx0, hy0, kx, ky, kx - 2.6 - a * 1.1, ky - 3 + b * 1.8, far);
      };
      paw(11.5 + rx, 28.4 - up, 0, true); paw(21 + rx, 27.4 + up * 0.4, 1.6, true);
      paw(15.5 + rx, 28 - up * 0.8, Math.PI, false); paw(24.5 + rx, 27 + up * 0.6, Math.PI + 1.6, false);
      /* cabeça DE PONTA-CABEÇA (ele está de costas no chão): cocuruto apoiado no chapéu amassado, queixo e focinho pro alto.
         É a cabeça de sempre carimbada com flipY (headX); orelhas, língua e chapéu são desenhados aqui porque obedecem à gravidade. */
      const hx = Math.round(32.6 + rx * 0.5), hy = Math.round(25.6 + up * 0.7);
      ell(hx - 1.5, hy + 0.6, 8.6, 8.2, FURD);                                   // sombra do pescoço: separa a cabeça do peito
      const ej = s(t * 5.5 - 0.9) * 1.1;                                         // orelhas moles, balançam atrasadas
      tri(hx - 7, hy + 4, hx - 2, hy + 6, hx - 5.5 + ej, hy + 11, FURS);         // orelha de trás, caída pro chão
      headX(hx, hy, { eyes: 'happy', mouth: 'open', ears: 'none', hat: false, flipY: true });
      // chapéu kasa amassado embaixo do cocuruto (cone de ponta pra baixo), escorregando com o balanço
      const kx = hx + 1.5 - rock * 1.2, ky = hy + 6;
      tri(kx - 8, ky, kx + 9, ky + 0.6, kx, 37.2, HAT); line(kx - 8, ky, kx + 9, ky + 0.6, 1.4, HATS); line(kx - 2.5, ky + 1.6, kx - 0.5, 36.4, 1, HATL); set(kx, 37, HATS);
      // orelha da frente por cima do chapéu, pendurada
      tri(hx + 1, hy + 5, hx + 7, hy + 4.4, hx + 4.4 + ej, hy + 10.6, FUR); line(hx + 3.2, hy + 7, hx + 4.2 + ej, hy + 9.4, 1, FURS);
      // língua mole escapando da boca e caindo pela frente do focinho, pro lado do chão
      const lg = Math.floor(t * 6) % 2;
      rect(hx + 9, hy - 7, 2, 1, PINK); rect(hx + 10, hy - 6, 2, 2 + lg, PINK);
      A.hatX = kx; A.hatY = ky;
      back(19.5 + rx, 35);
      if (extra) {
        // risquinhos de movimento perto das patas + coraçãozinho subindo
        const f = Math.floor(t * 9) % 3;
        if (f < 2) { set(5 + f, 14 + f, WHITE); set(18, 11 - f, WHITE); }
        const hk = (t * 0.9) % 1, hxx = 24 + Math.round(s(t * 4) * 1.2), hyy = 10 - hk * 8;
        if (hk < 0.75) { set(hxx - 1, hyy, PINK); set(hxx + 1, hyy, PINK); rect(hxx - 1, hyy + 1, 3, 1, PINK); set(hxx, hyy + 2, PINK); }
      }
      return;
    }
    if (mode === 'bow' || mode === 'stretch') {
      const stz = mode === 'stretch', w = stz ? s(t * 3) * 0.8 : s(t * 24) * 1.8;
      tail(11, 15, w);
      leg(15, 25, 14, 37, true); leg(19, 25, 19.5, 37, false);
      ell(18, 23, 7.5, 5.5, FUR); ell(25, 28, 7, 5, FUR); ell(22, 26.5, 5, 4, FUR);
      ell(25, 31, 5, 2.4, CREAM); ell(31, 30, 3.2, 3.4, CREAM);
      leg(27, 32, 35, 37, true); leg(30, 32, 38, 37, false);
      if (stz) head(36, 26 + s(t * 2.4) * 0.8, 'closed', 'yawn', 'back', true);
      else head(36, 26 + Math.abs(s(t * 6)) * 0.6, 'happy', 'tongue', undefined, true);
      back(19, 17.5);
      return;
    }
    if (mode === 'scratch' || mode === 'yawn' || mode === 'howl') {
      const br = s(t * 2) * 0.35;
      tail(11, 27, s(t * 5) * 0.9);
      ell(18, 31.5, 7.5, 5, FURS); if (mode !== 'scratch') leg(18, 33, 22, 37, false);
      ell(21, 28 + br, 8, 7, FUR); ell(26, 28 + br, 4, 5.4, CREAM);
      leg(25, 29, 25, 37, true); leg(29, 29, 29.5, 37, false);
      if (mode === 'scratch') { const k = s(t * 30); head(30, 17 + br, 'happy', 'tongue', undefined, true, -1); leg(17, 30, 21 + k * 1.3, 16 - k * 0.9, true); }
      else if (mode === 'howl') head(29, 13 + br, 'closed', 'open', 'back', true);
      else { const yw = (t % 2.6) < 1.5; head(30, 16 + br + (yw ? -1 : 0), yw ? 'closed' : eyesO, yw ? 'yawn' : 'smile', undefined, true); }
      back(18, 21 + br);
      return;
    }
    if (mode === 'sleep') {
      const br = s(t * 1.6) * 0.8;
      tail(34, 33.5, 0);
      ell(21, 31 - br * 0.35, 12.5, 5.6 + br * 0.5, FUR); ell(21, 34 + br, 9, 2.4, CREAM);
      head(33, 28 + br * 0.5, 'closed', 'closed', 'back', true);
      back(20, 25.5 - br * 0.8); A.pawX = 38; A.pawY = 36;
      return;
    }
    if (mode === 'dance' || mode === 'dance2') {
      const hop = Math.abs(s(t * (mode === 'dance2' ? 11 : 8))) * (mode === 'dance2' ? 3 : 1.6), up = s(t * 8);
      const by = -hop;
      tail(15, 27 + by, s(t * 22) * 1.6);
      leg(21, 30 + by, 20, 37, true); leg(26, 30 + by, 27, 37, false);
      ell(23.5, 25 + by, 6.6, 8.6, FUR); ell(25.5, 27 + by, 3.4, 5.6, CREAM);
      leg(20, 21 + by, 15 - up * 1.5, 14 + by + up * 2, true);
      head(25, 12 + by, 'happy', 'open', undefined, true, Math.round(up));
      leg(28, 21 + by, 34 + up * 1.5, 15 + by - up * 2, false);
      back(18, 20 + by);
      return;
    }
    if (mode === 'sit' || mode === 'wag' || mode === 'sign') {
      const br = s(t * 2.2) * 0.7, wag = mode === 'wag' ? s(t * 30) * 2 : s(t * 5) * 0.9 + s(t * 27) * 2 * LF.wagK;
      tail(11, 27, wag);
      ell(18, 31.5, 7.5, 5, FURS); leg(18, 33, 22, 37, false);
      ell(21, 28 - br * 0.25, 8, 7 + br * 0.45, FUR); ell(26, 28 - br * 0.25, 4 + br * 0.3, 5.4 + br * 0.35, CREAM);
      leg(25, 29, 25, 37, true);
      if (mode === 'sign') { leg(29, 27, 37, 22 + s(t * 6), false); }
      else leg(29, 29, 29.5, 37, false);
      head(30, 16 - br * 0.7, mode === 'wag' ? 'happy' : eyesO, mode === 'wag' ? 'tongue' : mode === 'sign' ? 'open' : LF.wagK > 0.3 ? 'tongue' : 'smile', undefined, true, ShibaPX.tilt || LF.tilt, LF.tw, LF.look);
      back(18, 21 - br * 0.5);
      return;
    }
    if (mode === 'lie') {
      /* deitado de esfinge, acordado: patas pra frente, cabeça erguida */
      const br = s(t * 2) * 0.6, wag = s(t * 4) * 0.7 + s(t * 27) * 1.8 * LF.wagK;
      tail(9, 28, wag);
      ell(20, 31.5 - br * 0.3, 12, 5.2 + br * 0.4, FUR); ell(15, 33, 6, 3.6, FURS); ell(22, 34.4, 8.5, 2.2, CREAM);
      rect(11, 35, 5, 2, CREAM);
      line(29, 34.5, 37, 35.5, 3, FUR); rect(36, 34, 4, 3, CREAM);
      ell(29, 28.5 - br * 0.3, 4, 5, CREAM);
      head(31, 20 - br * 0.5, eyesO, LF.wagK > 0.3 ? 'tongue' : 'smile', undefined, true, ShibaPX.tilt || LF.tilt, LF.tw, LF.look);
      back(19, 26 - br * 0.5); A.pawX = 38; A.pawY = 35;
      return;
    }
    /* poses novas */
    if (mode === 'drive') return poseDrive(t, eyesO);
    if (mode === 'push') return posePush(t, extra);
    if (mode === 'carry') return poseCarry(t, eyesO);
    if (mode === 'cheer') return poseCheer(t);
    if (mode === 'point') return posePoint(t, eyesO);
    if (mode === 'wave') return poseWave(t);
    if (mode === 'think') return poseThink(t, extra);
    if (mode === 'cry') return poseCry(t, extra);
    if (mode === 'gasp') return poseGasp(t, extra);
    if (mode === 'proud') return poseProud(t, extra);
    if (mode === 'climb') return poseClimb(t);
    if (mode === 'hold2' || mode === 'swing2' || mode === 'lean') return poseTwo(t, eyesO, mode);

    // em pé e em movimento
    let ph = 0, amp = 0, lift = 0, bob = 0, stretch = 0, ears = 'up', mouth = 'smile', eyes = eyesO, headDY = 0, tw = 0, tilt = ShibaPX.tilt || 0, look = null, tailW = s(t * 7) * 1.3, tailY = 0, gal = 0, bodyRY = 0;
    if (mode === 'walk') { ph = t * 9.5; amp = 3.5; lift = 2.7; bob = Math.abs(s(ph)) * 1.15; headDY = s(ph * 2 + 1.2) * 0.55; tailW = s(ph) * 1.5; tailY = -Math.abs(Math.cos(ph)) * 0.8; tw = LF.tw; }
    else if (mode === 'run') { ph = t * 16; amp = 5; lift = 2.6; gal = 1; bob = Math.max(0, s(ph - 0.5)) * 3.2; stretch = 1 + Math.max(0, s(ph - 0.5)) * 1.3; ears = 'back'; mouth = 'tongue'; headDY = -s(ph - 0.5) * 0.8; tailW = s(ph) * 0.9; }
    else if (mode === 'jump') { amp = 0; lift = 0; stretch = 1; }
    else if (mode === 'dig') { ph = t * 22; headDY = 3 + s(ph * 0.5) * 0.7; mouth = 'open'; bob = -0.6 + s(ph) * 0.35; tailW = s(t * 24) * 1.6; ears = s((LIFE_T === null ? t : LIFE_T) * 3) > 0.6 ? 'back' : 'up'; }
    else if (mode === 'sniff') { ph = t * 5; amp = 1.6; lift = 1; headDY = 4 + s(t * 14) * 0.5; mouth = 'closed'; tailW = s(t * 9) * 1.1; tw = LF.tw; }
    else if (mode === 'surprise') { bob = 1.5; eyes = 'wide'; mouth = 'open'; }
    else if (mode === 'dizzy') { bob = s(t * 4) * 0.6; eyes = 'spiral'; mouth = 'tongue'; ears = 'back'; }
    else if (mode === 'sword') { bob = s(t * 3) * 0.4; eyes = 'squint'; mouth = 'grit'; }
    else if (mode === 'swordrun') { ph = t * 16; amp = 4.2; lift = 2.2; bob = Math.abs(s(ph)) * 1.4; stretch = 1.5; ears = 'back'; mouth = 'grit'; eyes = 'squint'; }
    else if (mode === 'windup') { bob = -2; headDY = 1; eyes = 'squint'; mouth = 'grit'; ears = 'back'; }
    else if (mode === 'slash') { stretch = 2; eyes = 'squint'; mouth = 'grit'; ears = 'back'; }
    else if (mode === 'eat') { const c = s(t * 9); headDY = 9 + Math.max(0, c) * 1.4; mouth = c > 0.1 ? 'open' : 'closed'; eyes = 'happy'; ears = 'back'; }
    else if (mode === 'pant') { const pp = s(t * 12); bob = pp * 0.3; bodyRY = pp * 0.5; mouth = pp > -0.2 ? 'tongue' : 'open'; eyes = (t % 2.4) < 1.5 ? 'happy' : eyesO; headDY = 0.6 + pp * 0.35; tailW = s(t * 10) * 1.4; }
    else { bob = s(t * 2.2) * 0.5; bodyRY = s(t * 2.2) * 0.35; tw = LF.tw; if (!tilt) tilt = LF.tilt; look = LF.look; tailW = s(t * 5) * 1 + s(t * 27) * 1.9 * LF.wagK; if (LF.wagK > 0.3) mouth = 'tongue'; }
    const by = -bob;
    if (mode === 'eat') tailW = s(t * 24) * 1.8;
    tail(10 - stretch, 18 + by + tailY, tailW);
    const air = mode === 'jump' || mode === 'slash', fy = 37, jumpTuck = air ? 3 : 0, flyUp = gal ? bob * 0.75 : 0;
    LG.ph = ph; LG.amp = amp; LG.lift = lift; LG.fy = fy; LG.tuck = jumpTuck; LG.fly = flyUp; LG.by = by; LG.air = air;
    if (mode === 'dig' || mode === 'eat') { leg(15, 29, 15, 37, true); leg(19, 29, 19, 37, false); }
    else if (gal) { stepLeg(14, 0.45, true, 15); stepLeg(18, 0, false, 19); }
    else { stepLeg(14, Math.PI, true, 15); stepLeg(18, 0, false, 19); }
    ell(21, 26 + by - bodyRY * 0.4, 10.5 + stretch, 6.6 + bodyRY * 0.5, FUR); ell(21, 30 + by, 7.5, 2.8, CREAM); ell(29, 25 + by, 3.6, 4.6 + bodyRY * 0.3, CREAM);
    if (mode === 'dig') { const a = s(ph); leg(27, 28, 31 + a * 2.4, 37 - Math.max(0, a) * 2.4, true); leg(30, 28, 33 - a * 2.4, 37 - Math.max(0, -a) * 2.4, false); }
    else if (mode === 'eat') { leg(27, 28, 28, 37, true); leg(30, 28, 31, 37, false); }
    else if (gal) { stepLeg(27, Math.PI + 0.45, true, 26); stepLeg(31, Math.PI, false, 29); }
    else { stepLeg(26, 0, true, 26); stepLeg(30, Math.PI, false, 29); }
    head(33 + stretch * (gal ? 0.6 : 1) + (mode === 'eat' ? 2 : 0), 15 + by + headDY, eyes, mouth, ears, true, tilt, tw, look);
    back(20, 19.5 + by);
    if (mode === 'eat' && extra && s(t * 9) > 0.6) { set(40 + (t * 13 % 3), 35, CREAM); set(38 + (t * 7 % 4), 36, CREAMS); }
    if (mode === 'dig' && extra) { for (let i = 0; i < 7; i++) { const k = (t * 7 + i * 0.27) % 1; set(36 + k * 9, 36 - k * 10 + k * k * 13, i % 2 ? FURD : FURS); } }
    if (mode === 'pant' && extra && s(t * 12) > 0.7) { set(45, 22 + by, WHITE); set(46, 20 + by, WHITE); }
  }

  const SHIBA_POSES = ['sit', 'wag', 'sign', 'lie', 'stand', 'walk', 'run', 'jump', 'dig', 'sniff', 'surprise', 'dizzy',
    'sword', 'swordrun', 'windup', 'slash', 'eat', 'pant', 'roll', 'bow', 'stretch', 'scratch', 'yawn', 'howl', 'sleep',
    'dance', 'dance2', 'shake',
    'drive', 'push', 'carry', 'cheer', 'point', 'think', 'gasp', 'cry', 'proud', 'climb', 'wave',
    'hold2', 'swing2', 'lean'];
  const POSE_ID = Object.create(null);
  SHIBA_POSES.forEach((p, i) => { POSE_ID[p] = i; });
  // poses que não ficam com sombra no chão (penduradas ou dentro de veículo)
  const NO_SHADOW = { climb: 1, drive: 1 };

  /* =====================================================================
     6. Saída para canvas
     ===================================================================== */
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let img = null, img32 = null, tmpCv = null, tmpG = null;
  const shadowCv = [null, null], shadow32 = [null, null];   // sombra do chão (normal e 'sleep'): canvas e pixels prontos
  function ensureIO() {
    if (img) return;
    tmpCv = mkCanvas(W, H); tmpG = tmpCv.getContext('2d');
    img = tmpG.createImageData(W, H); img32 = new Uint32Array(img.data.buffer);
    for (let k = 0; k < 2; k++) {
      const c = shadowCv[k] = mkCanvas(W, H), g = c.getContext('2d');
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(23, 38.4 + OY, k ? 14 : 12, 1.4, 0, 0, Math.PI * 2); g.fill();
      shadow32[k] = new Uint32Array(g.getImageData(0, 0, W, H).data.buffer);   // lido uma única vez, na inicialização
    }
  }
  // rasteriza a pose no ImageData compartilhado (com contorno); under = sombra embutida (ou null)
  function raster(mode, t, K, under) {
    buf = bodyBuf; BW = W; BH = H; BOY = OY; dry = false;
    bodyBuf.fill(0);
    pose(mode === 'shake' ? 'stand' : mode, t, true);
    if (K.belt) beltPaint(K.belt);
    blit(bodyBuf, W, H, K.lut, img32, under);
  }
  // riscos de tremida da pose 'shake' (igual ao rascunho)
  function shakeMarks(g, t) {
    g.fillStyle = 'rgba(29,27,24,.35)'; const k = Math.floor(t * 12) % 2;
    g.fillRect(4 + k, 22, 1, 4); g.fillRect(2 + k, 26, 1, 3); g.fillRect(43 - k, 20, 1, 4); g.fillRect(45 - k, 24, 1, 3);
  }
  // ShibaPX.frame(cv, mode, t, pal): desenha um frame 48x44 (com sombra) no canvas dado. API do rascunho.
  function frame(cv, mode, t, pal) {
    ensureIO();
    raster(mode, t, compilePal(pal));
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(23, 38.4 + OY, mode === 'sleep' ? 14 : 12, 1.4, 0, 0, Math.PI * 2); g.fill();
    tmpG.putImageData(img, 0, 0);
    const ox = mode === 'shake' ? Math.round(Math.sin(t * 52) * 1.6) : 0;
    g.drawImage(tmpCv, ox, 0);
    if (mode === 'shake') shakeMarks(g, t);
  }
  // caminho rápido usado pelo cache: a sombra já vai dentro do buffer, então é 1 putImageData e pronto.
  // Só a pose 'shake' (sprite deslocado, sombra parada) usa o caminho com composição.
  function frameFast(cv, g, mode, t, K, shadow) {
    const sh = shadow && !NO_SHADOW[mode];
    if (mode !== 'shake') { raster(mode, t, K, sh ? shadow32[mode === 'sleep' ? 1 : 0] : null); g.putImageData(img, 0, 0); return; }
    raster(mode, t, K, null);
    const ox = Math.round(Math.sin(t * 52) * 1.6);
    g.clearRect(0, 0, W, H);
    g.putImageData(img, ox, 0);
    if (sh) { g.globalCompositeOperation = 'destination-over'; g.drawImage(shadowCv[0], 0, 0); g.globalCompositeOperation = 'source-over'; }
    shakeMarks(g, t);
  }
  // ShibaPX.still(pal, mode='sit', scale=1) -> dataURL de um frame parado (ícones de UI)
  function still(pal, mode, scale) {
    if (mode === undefined) mode = 'sit';
    const m0 = ShibaPX.mouth[0], m1 = ShibaPX.mouth[1], sl = ShibaPX.look, st = ShibaPX.tilt;
    ShibaPX.look = null; ShibaPX.tilt = 0;
    const c = mkCanvas(W, H); frame(c, mode, 0.5, getPal(pal));
    ShibaPX.mouth[0] = m0; ShibaPX.mouth[1] = m1; ShibaPX.look = sl; ShibaPX.tilt = st;
    return c.toDataURL();
  }
  ShibaPX.frame = frame; ShibaPX.still = still;

  /* =====================================================================
     7. Cache de frames + drawShiba
     ===================================================================== */
  /* Chave numérica: (t quantizado a 1/30 s) * 2^25 + bits de opções. A "vida ociosa" depende só de t,
     então dois shibas com a mesma paleta/pose/opções no mesmo t quantizado dividem o canvas.
     Anel de canvases 48x44: as chaves antigas (t passado) saem sozinhas; um frame que volta a ser usado quando
     já está velho ganha vida nova (refresh). É isso que faz uma multidão na mesma pose/paleta, cada um na sua
     fase, custar quase só o shiba "da frente": os outros reaproveitam os frames que ele já rasterizou. */
  const KEY_MUL = 33554432, TQ_MAX = 134217727;          // tq acima disso não cabe na chave (2^53): desenha sem cache
  let CACHE_N = 1024, CACHE_FPS = 30;   // 1024 x 48x44 ≈ 8,6 MB (cabe a multidão + os laços de fundo)
  let slotKey = new Float64Array(CACHE_N).fill(NaN), slotCv = new Array(CACHE_N).fill(null), slotG = new Array(CACHE_N).fill(null);
  let slotSeq = new Float64Array(CACHE_N), cacheSeq = 0;   // "idade" de cada slot (nº de ordem da última inserção/refresh)
  const cacheMap = new Map();
  let cacheCur = 0;
  const stats = { hits: 0, misses: 0, exact: 0 };
  let exactCv = null, exactG = null;
  const NOOPTS = {};
  /* Poses que se repetem EXATAMENTE (tudo do corpo sai de sin/cos de uma fase só): o frame é guardado por fase dentro do
     ciclo + estado da vida ociosa (piscada/meia piscada, tremida de orelha), não pelo t absoluto. Uma multidão andando ou
     correndo, cada um no seu t, passa a reaproveitar ~20 frames por paleta em vez de rasterizar 1 frame novo por shiba a
     cada 1/30 s. walk: fase 9,5t · run: fase 16t (o resto dessas poses só usa a piscada/orelha). Desenho igual. */
  const LOOP = { walk: 2 * Math.PI / 9.5, run: 2 * Math.PI / 16 };
  /* Laço APROXIMADO (só com drawShiba.loose ligado: o jogo liga pra shibas de fundo — ajudantes, pilotos da frota, Pátio —
     e desliga pro Kome e a máquina dele): poses com frequências misturadas (dig/drive/sit/climb/wave) viram um laço de
     período p (escolhido pra emenda ficar com ~1 px de salto) a fps quadros/s; o que não fecha no laço (orelha do dig,
     cabeça torta/olhar/rabo feliz do sit) entra na chave como estado, como a piscada. Frota e Pátio se refazem a ~15 qps,
     então 15 quadros por segundo de laço não perdem nada. Medido: ~7 falhas de cache por quadro -> ~0 no pós-final. */
  const LOOSE = {
    dig: { p: 2 * Math.PI / 11, fps: 30, ex: t => (s(t * 3) > 0.6 ? 1 : 0) },
    drive: { p: 3.04, fps: 15 }, sit: { p: 2.513, fps: 15, life: 1 }, climb: { p: 0.897, fps: 15 }, wave: { p: 2.856, fps: 15 },
  };
  let looseOn = false;
  const LOOP_KEY = TQ_MAX + 1;                             // chaves de laço ficam acima de qualquer tq absoluto (cabe em 2^53)
  const idOf = (arr, v) => { const i = arr.indexOf(v); return i < 0 ? 15 : i + 1; };

  // t são: número finito (NaN/undefined/Infinity viram 0)
  function saneT(t) { t = +t; return t === t && t !== Infinity && t !== -Infinity ? t : 0; }
  // o desenho pedido cai fora do cache? (opções contínuas, globais do rascunho ligados, paletas demais, t gigante)
  function isExact(o, K, t) {
    return !!(o.exact || o.arm != null || o.arm2 != null || o.lean != null || o.tilt || o.look || ShibaPX.tilt || ShibaPX.look || ShibaPX.quiet || K.id > 255 || Math.abs(t) * CACHE_FPS > TQ_MAX);
  }
  // drawShiba.frameT(t, opts?, pose?) -> o t que realmente é desenhado (quantizado a 1/fps quando o frame vem do cache;
  //   com a pose, nas poses em laço devolve um t com a mesma fase do frame guardado)
  function frameT(t, o, mode) {
    t = saneT(t); o = o || NOOPTS;
    if (isExact(o, compilePal(typeof o.pal === 'object' && o.pal ? o.pal : getPal(o.pal)), t)) return t;
    const lp = mode !== undefined ? LOOP[mode] : undefined;
    if (lp !== undefined) { const N = Math.max(1, Math.round(lp * CACHE_FPS)); let ph = (t / lp) % 1; if (ph < 0) ph += 1; return t + (Math.round(ph * N) / N - ph) * lp; }
    return Math.round(t * CACHE_FPS) / CACHE_FPS;
  }

  // frame velho que voltou a ser usado: troca de lugar com o slot que seria o próximo a sair e vira o mais novo
  function refreshSlot(i) {
    const j = cacheCur; cacheCur = (cacheCur + 1) % CACHE_N;
    if (j !== i) {
      const cv = slotCv[j], cg = slotG[j], key = slotKey[j], sq = slotSeq[j];
      slotCv[j] = slotCv[i]; slotG[j] = slotG[i]; slotKey[j] = slotKey[i];
      slotCv[i] = cv; slotG[i] = cg; slotKey[i] = key; slotSeq[i] = sq;
      cacheMap.set(slotKey[j], j);
      if (key === key) cacheMap.set(key, i);               // NaN = slot vazio
    }
    slotSeq[j] = ++cacheSeq;
    return j;
  }

  // devolve o canvas 48x44 do frame pedido (do cache, ou rasterizado agora). NÃO guarde: é reaproveitado.
  // parâmetros contínuos das poses de duas patas (o.arm, o.arm2, o.lean); null limpa
  function twoSet(o) {
    TWO.arm = o && o.arm != null ? +o.arm : NaN; TWO.arm2 = o && o.arm2 != null ? +o.arm2 : NaN; TWO.lean = o && o.lean != null ? +o.lean : NaN;
  }
  function frameCanvas(mode, t, o) {
    ensureIO();
    t = saneT(t);
    const K = compilePal(typeof o.pal === 'object' && o.pal ? o.pal : getPal(o.pal));
    const hat = o.hat !== false, shadow = o.shadow !== false;
    const mouth = o.mouth || null, eyes = o.eyes || null, fast = o.fast ? 1 : 0;
    let pid = POSE_ID[mode];
    if (pid === undefined) { mode = 'stand'; pid = POSE_ID.stand; }
    // globais do rascunho: hatOn/mouthOverride/eyesOverride vêm sempre das opções (como no drawShiba original);
    // tilt/look globais, se o jogo os ligar, continuam valendo (compatibilidade) e desviam do cache
    const gH = ShibaPX.hatOn, gM = ShibaPX.mouthOverride, gE = ShibaPX.eyesOverride, gT = ShibaPX.tilt, gL = ShibaPX.look, gF = S.fast;
    let cv;
    if (isExact(o, K, t)) {
      if (!exactCv) { exactCv = mkCanvas(W, H); exactG = exactCv.getContext('2d'); }
      ShibaPX.hatOn = hat; ShibaPX.mouthOverride = mouth; ShibaPX.eyesOverride = eyes; ShibaPX.tilt = o.tilt || gT || 0; ShibaPX.look = o.look || gL || null; S.fast = fast; twoSet(o);
      frameFast(exactCv, exactG, mode, t, K, shadow);
      stats.exact++; cv = exactCv;
    } else {
      let lp = LOOP[mode];
      const LZ = lp === undefined && looseOn ? LOOSE[mode] : undefined;
      let tq, tr;
      if (LZ) {                                              // laço aproximado (fundo): ver LOOSE
        lp = LZ.p; life(t);
        const N = Math.max(1, Math.round(lp * LZ.fps));
        let ph = (t / lp) % 1; if (ph < 0) ph += 1;
        const fi = Math.round(ph * N) % N;
        let st = (LF.blink ? 1 : LF.half ? 2 : 0) + ((LF.tw + 1) << 2) + ((LZ.ex ? LZ.ex(t) : 0) << 4);
        if (LZ.life) st += ((LF.tilt + 1) << 5) + ((LF.look ? 1 + (LF.look[0] > 0 ? 2 : 0) + (LF.look[1] ? 1 : 0) : 0) << 7) + (Math.round(LF.wagK * 4) << 10);
        tq = LOOP_KEY + fi * 8192 + st;
        tr = (fi / N) * lp;
      } else if (lp !== undefined) {
        life(t);                                             // vida ociosa no t de verdade: entra na chave
        const N = Math.max(1, Math.round(lp * CACHE_FPS));
        let ph = (t / lp) % 1; if (ph < 0) ph += 1;
        const fi = Math.round(ph * N) % N;
        tq = LOOP_KEY + fi * 16 + (LF.blink ? 1 : LF.half ? 2 : 0) + ((LF.tw + 1) << 2);
        tr = (fi / N) * lp;
      } else { tq = Math.round(t * CACHE_FPS); tr = tq / CACHE_FPS; }
      const bits = K.id | (pid << 8) | (hat ? 16384 : 0) | (shadow ? 32768 : 0) | ((mouth ? idOf(MOUTHS, mouth) : 0) << 16) | ((eyes ? idOf(EYES, eyes) : 0) << 20) | (fast << 24);
      const key = tq * KEY_MUL + bits;
      let hit = cacheMap.get(key);
      if (hit !== undefined) {
        stats.hits++;
        if (cacheSeq - slotSeq[hit] > (CACHE_N >> 2)) hit = refreshSlot(hit);
        return slotCv[hit];
      }
      const i = cacheCur; cacheCur = (cacheCur + 1) % CACHE_N;
      if (!slotCv[i]) { slotCv[i] = mkCanvas(W, H); slotG[i] = slotCv[i].getContext('2d'); }
      else cacheMap.delete(slotKey[i]);
      slotKey[i] = key; slotSeq[i] = ++cacheSeq; cacheMap.set(key, i);
      ShibaPX.hatOn = hat; ShibaPX.mouthOverride = mouth; ShibaPX.eyesOverride = eyes; ShibaPX.tilt = 0; ShibaPX.look = null; S.fast = fast;
      if (lp !== undefined) LIFE_T = t;
      frameFast(slotCv[i], slotG[i], mode, tr, K, shadow);
      LIFE_T = null;
      stats.misses++; cv = slotCv[i];
    }
    ShibaPX.hatOn = gH; ShibaPX.mouthOverride = gM; ShibaPX.eyesOverride = gE; ShibaPX.tilt = gT; ShibaPX.look = gL; S.fast = gF; twoSet(null);
    return cv;
  }

  // drawShiba(g,x,y,pose,t,{face=1,scale=1,squash=0,rot=0,pal='kome',hat=true,mouth,eyes,alpha=1,shadow=true,fast,exact,smooth,arm,arm2,lean}): pés em (x,y)
  //   arm/arm2/lean: só nas poses de duas patas (hold2, swing2, lean), contínuos; ver poseTwo
  //   smooth: true/false força; sem ele, pixel duro em tamanho normal e redução suave quando o shiba fica minúsculo
  //   (scale × zoom da câmera informado em E.Draw.lod < .75), senão o contorno de 1px some aos pedaços
  function drawShiba(g, x, y, mode, t, o) {
    o = o || NOOPTS;
    const cv = frameCanvas(mode, t, o);
    const sc = o.scale || 1, face = o.face || 1, sq = o.squash || 0;
    const smooth = o.smooth !== undefined ? !!o.smooth : sc * (E.Draw ? E.Draw.zoom : 1) < 0.75;
    g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot);
    g.scale(face * sc * (1 + sq * 0.6), sc * (1 - sq)); g.imageSmoothingEnabled = smooth;
    if (o.alpha !== undefined && o.alpha < 1) g.globalAlpha *= o.alpha;
    g.drawImage(cv, -23, -(38.4 + 4)); g.restore();
  }
  // drawShiba.clear(): esvazia o cache de frames ; drawShiba.stats -> {hits, misses, exact}
  drawShiba.clear = function () { cacheMap.clear(); slotKey.fill(NaN); };
  drawShiba.stats = stats;
  // drawShiba.loose (get/set): liga o laço aproximado das poses de fundo (ver LOOSE); o jogo desliga pro Kome e a máquina dele
  Object.defineProperty(drawShiba, 'loose', { get() { return looseOn; }, set(v) { looseOn = !!v; } });
  drawShiba.frameT = frameT;
  // drawShiba.cacheSize -> frames guardados agora ; drawShiba.cacheMax (get/set, 64..4096): limite de canvases 48x44 do cache
  //   (cada um ~8 KB; padrão 1024 = ~8,6 MB). Aumente se tiver muitos shibas fora de fase na MESMA pose/paleta: quem vem atrás reaproveita
  //   os frames de quem vai na frente enquanto eles ainda estiverem no anel.
  Object.defineProperty(drawShiba, 'cacheSize', { get() { return cacheMap.size; } });
  Object.defineProperty(drawShiba, 'cacheMax', {
    get() { return CACHE_N; },
    set(v) {
      v = Math.max(64, Math.min(4096, v | 0));
      if (v === CACHE_N) return;
      CACHE_N = v; cacheMap.clear(); cacheCur = 0;
      slotKey = new Float64Array(v).fill(NaN); slotCv = new Array(v).fill(null); slotG = new Array(v).fill(null); slotSeq = new Float64Array(v);
    },
  });
  // drawShiba.fps (get/set): quadros de animação por segundo guardados no cache (padrão 30; 20 economiza mais)
  Object.defineProperty(drawShiba, 'fps', { get() { return CACHE_FPS; }, set(v) { v = Math.max(1, Math.min(120, v | 0)); if (v !== CACHE_FPS) { CACHE_FPS = v; drawShiba.clear(); } } });

  // shibaCanvas(pose,t,opts) -> canvas 48x44 NOVO (cópia), pra ícones/sprites que você quer guardar
  function shibaCanvas(mode, t, o) {
    const src = frameCanvas(mode, t === undefined ? 0.5 : t, o || NOOPTS), c = mkCanvas(W, H);
    c.getContext('2d').drawImage(src, 0, 0); return c;
  }

  /* =====================================================================
     8. Âncoras
     ===================================================================== */
  const PAW = { x: 9, y: -6 }, MOUTH = { x: 11, y: -18 }, HEAD = { x: 10, y: -26 };
  // grade -> local (origem nos pés, sem escala, face=1): centro do pixel
  const GX = -22.5, GY = -37.9;
  // shibaAnchor(pose,t,nome:'paw'|'paw2'|'mouth'|'head'|'back'|'hatTop'|'hold'|'eye', out?, {hat,fast,arm,arm2,lean}?) -> {x,y} local (multiplique x por face)
  //   t exato; pra colar algo num shiba desenhado pelo cache use t = drawShiba.frameT(t) (o Actor já faz isso)
  function shibaAnchor(mode, t, name, out, o) {
    out = out || { x: 0, y: 0 };
    const b0 = buf, w0 = BW, h0 = BH, o0 = BOY, gH = ShibaPX.hatOn, gF = S.fast;
    if (o) { ShibaPX.hatOn = o.hat !== false; S.fast = o.fast ? 1 : 0; }
    twoSet(o);
    buf = bodyBuf; BW = W; BH = H; BOY = OY; dry = true;
    pose(mode === 'shake' || POSE_ID[mode] === undefined ? 'stand' : mode, saneT(t), false);
    dry = false; buf = b0; BW = w0; BH = h0; BOY = o0; ShibaPX.hatOn = gH; S.fast = gF; twoSet(null);
    let x, y;
    if (name === 'mouth') { x = A.mouthX; y = A.mouthY; }
    else if (name === 'head') { x = A.headX; y = A.headY; }
    else if (name === 'hatTop') { x = A.hatX; y = A.hatY; }
    else if (name === 'back') { x = A.backX; y = A.backY; }
    else if (name === 'eye') { x = A.headX + 2; y = A.headY; }
    else if (name === 'paw2') { x = A.hasPaw2 ? A.paw2X : A.pawX; y = A.hasPaw2 ? A.paw2Y : A.pawY; }
    else if (name === 'hold') { x = A.hasHold ? A.holdX : A.pawX; y = A.hasHold ? A.holdY : A.pawY; }
    else { x = A.pawX; y = A.pawY; }
    out.x = x + GX; out.y = y + GY;
    return out;
  }

  /* =====================================================================
     9. Close de rosto (cutscenes)
     ===================================================================== */
  const HW = 44, HH = 38, HCX = 18, HCY = 19;       // grade do close e centro da cabeça nela
  const headBuf = new Uint8Array(HW * HH);
  let himg = null, himg32 = null;
  const headCache = new Map();
  const EXPRS = ['normal', 'happy', 'shock', 'determined', 'cry', 'smug', 'sleepy', 'angry', 'love', 'sad'];

  function star(x, y, big) {
    set(x, y, WHITE); set(x - 1, y, GOLD); set(x + 1, y, GOLD); set(x, y - 1, GOLD); set(x, y + 1, GOLD);
    if (big) { set(x - 2, y, GOLD); set(x + 2, y, GOLD); set(x, y - 2, GOLD); set(x, y + 2, GOLD); set(x, y, WHITE); }
  }
  function drop(x, y) { set(x, y - 1, TEARL); rect(x - 1, y, 3, 2, TEAR); set(x, y + 2, TEAR); set(x - 1, y, TEARL); }
  function heart(x, y) { rect(x - 2, y - 1, 2, 2, PINK); rect(x + 1, y - 1, 2, 2, PINK); rect(x - 2, y, 5, 2, PINK); rect(x - 1, y + 2, 3, 1, PINK); set(x, y + 3, PINK); set(x - 2, y - 1, WHITE); }

  // rasteriza o close no headBuf; fr = quadro de animação 0..7, blink = piscada
  function headPose(expr, fr, blink, hat) {
    const hx = HCX, hy = HCY, f2 = fr & 1, f4 = fr & 3;
    let eyes = blink ? 'closed' : 'open', mouth = 'smile', ears = 'up', tilt = 0;
    if (expr === 'happy') { eyes = 'happy'; mouth = 'open'; }
    else if (expr === 'shock') { eyes = 'shock'; mouth = 'gasp'; ears = 'back'; }
    else if (expr === 'determined') { eyes = blink ? 'squint' : 'angry'; mouth = 'teeth'; }
    else if (expr === 'cry') { eyes = 'wet'; mouth = f2 ? 'frown' : 'open'; ears = 'back'; }
    else if (expr === 'smug') { eyes = 'half'; mouth = 'smug'; tilt = 1; }
    else if (expr === 'sleepy') { eyes = fr < 6 ? 'closed' : 'half'; mouth = fr < 3 ? 'yawn' : 'closed'; ears = 'back'; }
    else if (expr === 'angry') { eyes = 'squint'; mouth = 'teeth'; ears = 'back'; }
    else if (expr === 'love') { eyes = 'sparkle'; mouth = 'tongue'; }
    else if (expr === 'sad') { eyes = blink ? 'closed' : 'sad'; mouth = 'frown'; ears = 'back'; }
    // ombros / peito pra não ficar cabeça solta
    ell(hx - 4, hy + 17, 12, 8.5, FUR); ell(hx + 3, hy + 16, 5.5, 6.5, CREAM);
    if (expr === 'shock') {                               // pelo arrepiado
      tri(hx - 7, hy - 2, hx - 13, hy - 2.5, hx - 8, hy + 2, FUR); tri(hx - 7, hy + 2, hx - 13, hy + 3.5, hx - 6, hy + 6, FUR);
      tri(hx - 12, hy + 12, hx - 17, hy + 9, hx - 10, hy + 9, FUR); tri(hx - 14, hy + 15, hx - 19, hy + 14, hx - 14, hy + 11, FUR);
    }
    const gH = ShibaPX.hatOn, gM = ShibaPX.mouthOverride, gE = ShibaPX.eyesOverride, gL = ShibaPX.look;
    ShibaPX.hatOn = hat; ShibaPX.mouthOverride = null; ShibaPX.eyesOverride = null; ShibaPX.look = null;
    head(hx, hy, eyes, mouth, ears, true, tilt, 0, null);
    ShibaPX.hatOn = gH; ShibaPX.mouthOverride = gM; ShibaPX.eyesOverride = gE; ShibaPX.look = gL;
    // enfeites de expressão, em pixels
    if (expr === 'happy') {
      set(hx - 4, hy + 2, PINK); set(hx - 2, hy + 2, PINK); set(hx - 3, hy + 3, PINK); set(hx - 1, hy + 3, PINK);
      star(hx + 15, hy - 9 + f2, f4 < 2); star(hx + 20, hy + 1 - f2, f4 >= 2); star(hx - 14, hy - 4, f4 === 1);
    } else if (expr === 'shock') {
      drop(hx + 13, hy - 9 + f4); line(hx + 17, hy - 3, hx + 21, hy - 5, 1, WHITE); line(hx + 17, hy + 2, hx + 22, hy + 2, 1, WHITE); line(hx + 16, hy + 7, hx + 20, hy + 9, 1, WHITE);
    } else if (expr === 'determined') {
      star(hx + 14, hy - 8, f2 === 0);
      ell(hx + 15.5 + f2, hy + 6.5, 1.6 + f2 * 0.5, 1.2, WHITE); if (f4 > 1) set(hx + 19 + f2, hy + 5, WHITE);   // bufada pelo focinho
    } else if (expr === 'cry') {
      const tx = hx + 1;
      rect(tx, hy + 2, 1, 5, TEAR); set(tx, hy + 2 + f4, TEARL); rect(tx - 1, hy + 7, 2, 2, TEAR); set(tx - 1, hy + 7, TEARL);
      drop(tx, hy + 11 + f4 * 2); drop(hx + 13, hy - 6 + f4);
    } else if (expr === 'smug') {
      star(hx + 15, hy - 7, f4 < 2); set(hx - 4, hy + 2, PINK); set(hx - 2, hy + 2, PINK);
    } else if (expr === 'sleepy') {
      const zy = hy - 6 - f4;
      rect(hx + 13, zy, 3, 1, WHITE); set(hx + 14, zy + 1, WHITE); rect(hx + 13, zy + 2, 3, 1, WHITE);
      rect(hx + 18, zy - 6, 4, 1, WHITE); set(hx + 20, zy - 5, WHITE); set(hx + 19, zy - 4, WHITE); rect(hx + 18, zy - 3, 4, 1, WHITE);
      if (fr >= 3) { ell(hx + 12, hy + 4, 1.6 + (fr & 1) * 0.6, 1.6 + (fr & 1) * 0.6, TEARL); }      // bolha no nariz
    } else if (expr === 'angry') {
      const vx = hx + 13, vy = hy - 11 + f2;
      rect(vx, vy + 1, 2, 1, VEIN); rect(vx + 1, vy, 1, 2, VEIN); rect(vx + 4, vy, 1, 2, VEIN); rect(vx + 4, vy + 1, 2, 1, VEIN);
      rect(vx, vy + 4, 2, 1, VEIN); rect(vx + 1, vy + 4, 1, 2, VEIN); rect(vx + 4, vy + 4, 2, 1, VEIN); rect(vx + 4, vy + 4, 1, 2, VEIN);
      rect(hx + 17, hy + 7, 3 + f2 * 2, 1, WHITE);
    } else if (expr === 'love') {
      heart(hx + 15, hy - 8 - f4); heart(hx + 21, hy + 2 - ((fr + 2) & 3));
      set(hx - 4, hy + 2, PINK); set(hx - 2, hy + 2, PINK); set(hx - 3, hy + 3, PINK); set(hx - 1, hy + 3, PINK);
    } else if (expr === 'sad') {
      for (let i = 0; i < 3; i++) rect(hx + 13 + i * 3, hy - 13 + ((i + f2) & 1), 1, 5 + (i & 1) * 2, TEAR);  // nuvem de desânimo
    }
  }

  // drawShibaHead(g,x,y,t,{scale=6,expr='normal',pal='kome',face=1,hat=true,alpha=1,rot=0,still=false}): close de rosto centrado em (x,y)
  function drawShibaHead(g, x, y, t, o) {
    o = o || NOOPTS; t = saneT(t);
    ensureIO();
    if (!himg) { himg = tmpG.createImageData(HW, HH); himg32 = new Uint32Array(himg.data.buffer); }
    const expr = o.expr || 'normal', ei = Math.max(0, EXPRS.indexOf(expr));
    const K = compilePal(typeof o.pal === 'object' && o.pal ? o.pal : getPal(o.pal));
    const hat = o.hat !== false;
    const fr = o.still ? 0 : Math.floor(t * (expr === 'sleepy' ? 2.5 : 8)) & 7;
    life(t);
    const blink = !o.still && (LF.blink || LF.half) ? 1 : 0;
    const key = K.id * 4096 + ei * 64 + fr * 4 + blink * 2 + (hat ? 1 : 0);
    let cv = headCache.get(key);
    if (!cv) {
      buf = headBuf; BW = HW; BH = HH; BOY = 0; dry = false;
      headBuf.fill(0);
      headPose(EXPRS[ei], fr, blink, hat);
      buf = bodyBuf; BW = W; BH = H; BOY = OY;
      blit(headBuf, HW, HH, K.lut, himg32);
      cv = mkCanvas(HW, HH); cv.getContext('2d').putImageData(himg, 0, 0);
      if (headCache.size > 400) headCache.clear();
      headCache.set(key, cv);
    }
    const sc = o.scale || 6, face = o.face || 1;
    let dx = 0, dy = 0;
    if (!o.still) {
      if (expr === 'shock') { dx = Math.round(s(t * 61)) * 0.5; dy = Math.round(s(t * 47)) * 0.5; }
      else if (expr === 'cry' || expr === 'sad') dy = Math.round(Math.abs(s(t * 8)) * 1.2);
      else if (expr === 'happy' || expr === 'love') dy = -Math.round(Math.abs(s(t * 7)) * 1.5);
      else if (expr === 'angry' || expr === 'determined') dx = Math.round(s(t * 40)) * 0.34;
      else dy = Math.round(s(t * 2.2) * 0.8);
    }
    g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot);
    g.scale(face * sc, sc); g.imageSmoothingEnabled = false;
    if (o.alpha !== undefined && o.alpha < 1) g.globalAlpha *= o.alpha;
    g.drawImage(cv, -HCX - 1.5 + dx, -HCY - 0.5 + dy); g.restore();
  }
  drawShibaHead.exprs = EXPRS;

  /* =====================================================================
     10. Balão de fala no estilo Kome
     ===================================================================== */
  const BUBBLE_FONT = "'Zen Maru Gothic','M PLUS Rounded 1c','Trebuchet MS',system-ui,sans-serif";
  function rrPath(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  const sharedBubble = { text: null, lines: null, size: 11, maxW: 150 };
  // layout de balão: quebra o texto em linhas (cacheado no próprio objeto B)
  function layoutBubble(g, B) {
    g.font = '900 ' + B.size + 'px ' + BUBBLE_FONT;
    const words = String(B.text).split(/\s+/), lines = []; let cur = '', wmax = 0;
    for (let i = 0; i < words.length; i++) {
      const tryL = cur ? cur + ' ' + words[i] : words[i];
      if (cur && g.measureText(tryL).width > B.maxW) { lines.push(cur); cur = words[i]; } else cur = tryL;
    }
    if (cur) lines.push(cur);
    for (let i = 0; i < lines.length; i++) wmax = Math.max(wmax, g.measureText(lines[i]).width);
    B.lines = lines; B.w = Math.ceil(wmax) + B.size * 1.5; B.h = Math.ceil(lines.length * B.size * 1.25 + B.size * 0.9);
  }
  // drawBubble(g,x,y,texto|B,{size=11,maxW=150,k=1 (0..1 pop),side=1,col,ink}): balão creme com a ponta em (x,y)
  function drawBubble(g, x, y, text, o) {
    o = o || NOOPTS;
    let B = text;
    if (typeof text !== 'object') {                       // texto solto: usa um layout compartilhado
      B = sharedBubble; const size = o.size || 11, maxW = o.maxW || 150;
      if (B.text !== text || B.size !== size || B.maxW !== maxW) { B.text = text; B.size = size; B.maxW = maxW; B.lines = null; }
    }
    if (!B.lines) layoutBubble(g, B);
    const k = o.k === undefined ? 1 : o.k, side = o.side || 1, ink = o.ink || '#2a1a10', col = o.col || '#FFFAE6';
    if (k <= 0) return;
    const w = B.w, h = B.h, bx = -w * 0.5 + side * w * 0.22, by = -h - 9, r = Math.min(9, h / 2);
    g.save(); g.translate(x, y); g.scale(k, k);
    g.lineJoin = 'round'; g.lineWidth = 2;
    // sombra dura
    g.fillStyle = ink; rrPath(g, bx, by + 3, w, h, r); g.fill();
    // corpo + ponta
    g.fillStyle = col; g.strokeStyle = ink;
    rrPath(g, bx, by, w, h, r); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(side * 3 - 5, by + h - 1); g.lineTo(0, -1); g.lineTo(side * 3 + 5, by + h - 1); g.fill();
    g.beginPath(); g.moveTo(side * 3 - 5, by + h); g.lineTo(0, -1); g.lineTo(side * 3 + 5, by + h); g.stroke();
    g.fillStyle = col; g.fillRect(side * 3 - 4, by + h - 2.5, 8, 2.6);
    // texto
    g.font = '900 ' + B.size + 'px ' + BUBBLE_FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#3B2818';
    const lh = B.size * 1.25, y0 = by + h / 2 - (B.lines.length - 1) * lh / 2 + 0.5;
    for (let i = 0; i < B.lines.length; i++) {
      const ln = B.shown !== undefined && B.shown < B.count ? clipLine(B, i) : B.lines[i];
      if (ln) g.fillText(ln, bx + w / 2, y0 + i * lh);
    }
    g.restore();
  }
  // corta a linha i pelo número de letras já "digitadas" (B.shown)
  function clipLine(B, i) {
    let left = Math.floor(B.shown);
    for (let j = 0; j < i; j++) left -= B.lines[j].length + 1;
    return left <= 0 ? '' : B.lines[i].slice(0, left);
  }

  /* =====================================================================
     11. Actor
     ===================================================================== */
  const anchorTmp = { x: 0, y: 0 };
  const drawOpts = { face: 1, scale: 1, squash: 0, rot: 0, pal: 'kome', hat: true, mouth: null, eyes: null, alpha: 1, shadow: true, fast: 0, smooth: undefined };
  const bubbleOpts = { k: 1, side: 1 };                  // reaproveitados: nada de alocar por frame
  const anchorOpts = { hat: true, fast: 0, pal: 'kome' };

  /* Actor(opts) -> shiba com estado.
     campos: x,y,face,pose,t,pal,scale,squash,rot,vx,vy,hat,alpha,eyes,mouth,fast,shadow,visible,timeScale,
             hold ({cv,ax,ay,rot,scale,behind,anchor} ou canvas), autoPose (anda/corre/para sozinho pela vx)
     métodos: say(texto,seg,{size,maxW,typing}), shutUp(), hop(força), update(dt), draw(g), anchor(nome,out)->{x,y} no mundo */
  function Actor(opts) {
    const a = {
      // t começa numa fase aleatória de uma janela curta (2..6 s): cada shiba pisca/anda no seu tempo, mas uma multidão
      // na mesma pose/paleta ainda reaproveita os frames uns dos outros no cache (fases muito espalhadas não cabem nele)
      x: 0, y: 0, face: 1, pose: 'sit', t: 2 + Math.random() * 4, pal: 'kome', scale: 1, squash: 0, rot: 0, vx: 0, vy: 0,
      hat: true, alpha: 1, eyes: null, mouth: null, fast: 0, shadow: true, visible: true, timeScale: 1,
      hold: null, autoPose: false, idlePose: 'stand', walkSpeed: 20, runSpeed: 150,
      gravity: 0, ground: 0, z: 0, vz: 0,                 // z = altura do pulinho (hop), separado de y
      bubble: null,
      // say(texto, seg=2.5, {size=11, maxW=150, typing=true}): abre o balão de fala
      say(text, sec, o) {
        o = o || NOOPTS;
        a.bubble = { text: String(text), lines: null, size: o.size || 11, maxW: o.maxW || 150, age: 0, dur: sec === undefined ? 2.5 : sec,
          count: String(text).length, shown: o.typing === false ? 1e9 : 0, cps: o.cps || 40 };
        return a;
      },
      // shutUp(): fecha o balão já
      shutUp() { a.bubble = null; return a; },
      // hop(v=120): pulinho com squash na aterrissagem
      hop(v) { if (a.z === 0) a.vz = v === undefined ? 120 : v; return a; },
      // update(dt): avança tempo, posição, pulinho, balão
      update(dt) {
        a.t += dt * a.timeScale;
        a.x += a.vx * dt; a.y += a.vy * dt;
        if (a.vx > 1) a.face = 1; else if (a.vx < -1) a.face = -1;
        if (a.autoPose) { const v = Math.abs(a.vx); a.pose = v > a.runSpeed ? 'run' : v > a.walkSpeed ? 'walk' : a.idlePose; }
        if (a.vz !== 0 || a.z > 0) {
          a.z += a.vz * dt; a.vz -= 620 * dt;
          if (a.z <= 0) { a.z = 0; a.vz = 0; a.squash = 0.22; }
        }
        if (a.squash !== 0) { a.squash = U.damp ? U.damp(a.squash, 0, 14, dt) : a.squash * Math.max(0, 1 - dt * 14); if (Math.abs(a.squash) < 0.004) a.squash = 0; }
        const B = a.bubble;
        if (B) { B.age += dt; B.shown += B.cps * dt; if (B.age > B.dur) a.bubble = null; }
      },
      // anchor(nome, out?) -> {x,y} em coordenadas de mundo (considera face, escala, squash e rot), no mesmo t do frame desenhado
      anchor(name, out) {
        const ao = anchorOpts; ao.hat = a.hat; ao.fast = a.fast; ao.pal = a.pal;
        out = shibaAnchor(a.pose, frameT(a.t, ao, a.pose), name, out, ao);
        const lx = out.x * a.face * a.scale * (1 + a.squash * 0.6), ly = out.y * a.scale * (1 - a.squash);
        const c = Math.cos(a.rot), sn = Math.sin(a.rot);
        out.x = a.x + lx * c - ly * sn; out.y = a.y - a.z + lx * sn + ly * c;
        return out;
      },
      // draw(g): desenha o shiba, o objeto na pata e o balão
      draw(g) {
        if (!a.visible) return;
        const o = drawOpts;
        o.face = a.face; o.scale = a.scale; o.squash = a.squash; o.rot = a.rot; o.pal = a.pal; o.hat = a.hat; o.mouth = a.mouth; o.eyes = a.eyes;
        o.alpha = a.alpha; o.shadow = a.shadow && a.z === 0; o.fast = a.fast; o.smooth = a.smooth;
        const h = a.hold, y = a.y - a.z;
        if (a.z > 0 && a.shadow) {                         // sombra fica no chão durante o pulinho
          const k = 1 / (1 + a.z * 0.03);
          g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(a.x, a.y, 12 * a.scale * k, 1.4 * a.scale * k, 0, 0, U.TAU || Math.PI * 2); g.fill();
        }
        if (h && h.behind) a.drawHold(g, h, y);
        drawShiba(g, a.x, y, a.pose, a.t, o);
        if (h && !h.behind) a.drawHold(g, h, y);
        if (a.bubble) a.drawBubble(g);
      },
      // drawHold(g, hold, y): desenha o sprite preso à âncora (padrão 'hold' = pata)
      drawHold(g, h, y) {
        const ao = anchorOpts; ao.hat = a.hat; ao.fast = a.fast; ao.pal = a.pal;
        // âncora no t do frame que o cache desenha (senão o objeto treme 1px em relação à pata)
        const cv = h.cv || h, p = shibaAnchor(a.pose, frameT(a.t, ao, a.pose), h.anchor || 'hold', anchorTmp, ao), hs = h.scale || 1;
        g.save(); g.translate(a.x, y); if (a.rot) g.rotate(a.rot);
        g.scale(a.face * a.scale * (1 + a.squash * 0.6), a.scale * (1 - a.squash));
        g.translate(p.x + (h.dx || 0), p.y + (h.dy || 0)); if (h.rot) g.rotate(h.rot);
        g.imageSmoothingEnabled = false; if (a.alpha < 1) g.globalAlpha *= a.alpha;
        g.drawImage(cv, -(h.ax === undefined ? cv.width / 2 : h.ax) * hs, -(h.ay === undefined ? cv.height / 2 : h.ay) * hs, cv.width * hs, cv.height * hs);
        g.restore();
      },
      // drawBubble(g): balão acima da cabeça, com pop de entrada/saída
      drawBubble(g) {
        const B = a.bubble; if (!B) return;
        const p = a.anchor('hatTop', anchorTmp);
        const kin = Math.min(1, B.age / 0.18), kout = Math.min(1, (B.dur - B.age) / 0.12);
        const k = kout < 1 ? Math.max(0, kout) : (U.ease && U.ease.back ? U.ease.back(kin) : kin);
        bubbleOpts.k = k; bubbleOpts.side = a.face;
        drawBubble(g, p.x + a.face * 4 * a.scale, p.y - 3 * a.scale, B, bubbleOpts);
      },
    };
    if (opts) for (const k in opts) a[k] = opts[k];
    return a;
  }

  /* =====================================================================
     12. Exporta
     ===================================================================== */
  E.ShibaPX = ShibaPX;
  E.PALS = PALS;
  E.SHIBA_POSES = SHIBA_POSES;
  E.SHIBA_EYES = EYES;
  E.SHIBA_MOUTHS = MOUTHS;
  E.SHIBA_EXPRS = EXPRS;
  E.drawShiba = drawShiba;
  E.shibaCanvas = shibaCanvas;
  E.drawShibaHead = drawShibaHead;
  E.drawBubble = drawBubble;
  E.PAW = PAW; E.MOUTH = MOUTH; E.HEAD = HEAD;
  E.shibaAnchor = shibaAnchor;
  E.shibaBelt = shibaBelt;
  E.Actor = Actor;
})();


/* ===== engine/fx.js ===== */
/* =====================================================================
   Pixxel v1.0 · fx.js
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
  const E = (window.Pixxel = window.Pixxel || {});
  if (!E.U) throw new Error('Pixxel: carregue core.js antes de fx.js');
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
      mx: 1,                       // espelho horizontal do mundo: -1 = +x do mundo vai pra ESQUERDA da tela (simulação intacta)
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
        g.scale(z * c.mx, z);
        g.translate(-c.x, -c.y);
        return c;
      },
      // unapply(g): desfaz o apply (volta pra coordenadas de tela sem precisar de save/restore)
      unapply(g) {
        const z = c.z * (1 + c.zp);
        g.translate(c.x, c.y);
        g.scale(1 / (z * c.mx), 1 / z);
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
        out.x = (sx - vw / 2) / (c.z * c.mx) + c.x; out.y = (sy - vh / 2) / c.z + c.y;
        return out;
      },
      // toScreen(wx,wy,out?) -> {x,y}: mundo -> tela (ignora o tremor)
      toScreen(wx, wy, out) {
        out = out || { x: 0, y: 0 };
        out.x = (wx - c.x) * c.z * c.mx + vw / 2; out.y = (wy - c.y) * c.z + vh / 2;
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
          c.x = anchor.wx - (anchor.sx - vw / 2) / (c.z * c.mx); c.y = anchor.wy - (anchor.sy - vh / 2) / c.z;
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
      // add(x,y,txt,{c='#FFFAEE',size=16,life=1.1,vy=-46,vx=0,stroke=LINE,pop=1,sw,rot,shake=0,delay=0,ui=false}): cria um texto que sobe
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
        f.rot = o.rot === undefined ? (Math.random() * 2 - 1) * 0.07 : o.rot; f.shake = o.shake || 0; f.ui = !!o.ui;   // ui: x,y já em coords de TELA (não segue a câmera)
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
          if (cam && !f.ui) {
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
      flash(col, dur, a) { if (E.reducedMotion) return fx; flash.col = col || CREAM; flash.dur = dur || 0.25; flash.t = 0; flash.a = a === undefined ? 0.85 : a; return fx; },
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


/* ===== engine/terrain.js ===== */
/* Pixxel v1.0 — terrain.js
   Terreno granular: a montanha de arroz (E.Heap), pilhas pequenas que assentam (E.Pile) e grãos voando (E.Grains).
   Depende de core.js e pix.js.

   COORDENADAS (importante):
     - "mundo": x pra direita, y pra baixo; a base da montanha fica em y = heap.y0 (padrão 0), pra cima é negativo.
     - "altura" (alt): distância ACIMA da base, positiva pra cima. alt = heap.y0 - yMundo.
     heap.h / heap.h0 / matAt(i, alt) / pocketAt(x, alt) / bolsões {x, y: alt} / elipse {cx, cy: alt} usam ALTURA.
     surf(x) / digCircle(cx, cy, ...) / bite() / draw() / Grains usam Y DE MUNDO.

   Seções: 1 texturas de grão · 2 Heap (dados, camadas, cavar, avalanche, desenho) · 3 Pile · 4 Grains */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const E = (root.Pixxel = root.Pixxel || {});
  if (!E.U) throw new Error('Pixxel: carregue core.js antes de terrain.js');
  if (!E.PAL) throw new Error('Pixxel: carregue pix.js antes de terrain.js');
  const U = E.U, PAL = E.PAL, TAU = Math.PI * 2, NO = Object.freeze({});
  const LINE = PAL.line || '#3B2818';
  const BROWN = '#4A2E14';
  const doc = root.document;

  /* ======================================================================
     1. Texturas de grão (gerador próprio; não usa Draw.pattern)
        Cada material tem ladrilhos sem emenda:
          'g'  grãos de verdade em 3 camadas (vãos escuros, grãos médios, grãos claros com brilho)   4 texels por px de mundo
          's'  textura macia pra longe (manchas + pontinhos), sem moiré
          'ca' / 'cb'  grãos grandes e ensolarados da crista (fundo transparente; denso / esparso)
        O mesmo ladrilho 'g' serve o LOD perto (escala 1/4) e o LOD médio (escala 1/2, grão com o dobro do tamanho).
     ====================================================================== */
  const TG = 256, TS = 128;
  const texCache = new Map();
  const PM = typeof DOMMatrix !== 'undefined' ? new DOMMatrix() : null;

  // tons de um material: vão entre grãos, sombra, base, luz, brilho
  function tonesOf(kind, col, c2, c3) {
    const gold = kind === 'gold', mochi = kind === 'mochi';
    const dark = gold ? '#5A3206' : mochi ? '#9A4E58' : BROWN;
    return {
      gap: U.mixCss(col, dark, kind === 'pressed' ? 0.34 : gold ? 0.5 : mochi ? 0.5 : 0.38),
      low: c2 || U.mixCss(col, gold ? '#7A4A0C' : dark, gold ? 0.26 : mochi ? 0.14 : 0.11),
      mid: col,
      top: c3 || U.mixCss(col, gold ? '#FFF3B0' : '#FFFFFF', gold ? 0.5 : 0.66),
      hi: gold ? '#FFFBE0' : '#FFFFFF',
      shadow: gold ? 'rgba(70,36,4,.38)' : 'rgba(60,36,14,.28)',
    };
  }

  // elipse preenchida repetida nas bordas do ladrilho (pra emendar)
  function wfill(c, T, x, y, rx, ry, a) {
    const m = rx + 2;
    for (let ox = -T; ox <= T; ox += T) {
      const X = x + ox; if (X < -m || X > T + m) continue;
      for (let oy = -T; oy <= T; oy += T) {
        const Y = y + oy; if (Y < -m || Y > T + m) continue;
        c.beginPath(); c.ellipse(X, Y, rx, ry, a, 0, TAU); c.fill();
      }
    }
  }
  // um grão: sombra de contato, barriga escura, corpo (deslocado pra luz, que vem de cima-esquerda) e brilho
  function grain(c, T, x, y, L, W, a, body, under, hi, shadow) {
    if (shadow) { c.fillStyle = shadow; wfill(c, T, x + L * 0.06, y + W * 0.32, L * 0.5, W * 0.5, a); }
    c.fillStyle = under; wfill(c, T, x, y, L * 0.5, W * 0.5, a);
    c.fillStyle = body; wfill(c, T, x - L * 0.03, y - W * 0.13, L * 0.455, W * 0.365, a);
    if (hi) { c.fillStyle = hi; wfill(c, T, x - L * 0.08, y - W * 0.2, L * 0.2, W * 0.11, a); }
  }
  function grainPass(c, T, r, n, L, W, spread, body, under, hi, shadow, hiChance) {
    for (let i = 0; i < n; i++) {
      const k = 0.85 + r() * 0.35;
      const a = spread >= 3 ? r() * Math.PI : (r() - 0.5) * 2 * spread;
      grain(c, T, r() * T, r() * T, L * k, W * (0.9 + r() * 0.25), a, body, under, hi && r() < hiChance ? hi : null, shadow);
    }
  }
  function star4(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s);
    c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.fill();
  }
  // linha ondulada horizontal que emenda (período inteiro)
  function wavy(c, T, y, amp, m, ph, x0, x1) {
    c.beginPath();
    for (let x = x0; x <= x1; x += 4) {
      const Y = y + amp * Math.sin((x / T) * TAU * m + ph);
      if (x === x0) c.moveTo(x, Y); else c.lineTo(x, Y);
    }
    c.stroke();
  }

  function tileGrains(c, T, r, kind, tn) {
    c.fillStyle = tn.gap; c.fillRect(0, 0, T, T);
    if (kind === 'pressed') {
      // (17/11) grão legível como o do arroz solto, só mais apertado e deitado; antes era uma massa borrada
      grainPass(c, T, r, 1000, 13, 5.6, 0.5, tn.low, U.mixCss(tn.low, tn.gap, 0.6), null, null, 0);
      grainPass(c, T, r, 560, 13.2, 5.8, 0.45, tn.mid, tn.low, tn.top, tn.shadow, 0.55);
      grainPass(c, T, r, 210, 13.5, 6, 0.4, tn.top, tn.mid, tn.hi, tn.shadow, 1);
      c.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 50; i++) wfill(c, T, r() * T, r() * T, 1.5, 1, (r() - 0.5) * 0.4);
      c.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const y = (k + 0.2 + r() * 0.6) * (T / 5), m = 1 + ((r() * 3) | 0), ph = r() * TAU, amp = 1.5 + r() * 2.5;
        for (let oy = -T; oy <= T; oy += T) {
          let x = -8;
          while (x < T + 8) { // traços quebrados: estrato não é régua
            const len = 40 + r() * 120;
            c.strokeStyle = U.rgba(tn.gap, 0.55); c.lineWidth = 1.3; wavy(c, T, y + oy, amp, m, ph, x, Math.min(T + 8, x + len));
            c.strokeStyle = U.rgba(tn.top, 0.55); c.lineWidth = 1; wavy(c, T, y + oy + 1.9, amp, m, ph, x, Math.min(T + 8, x + len));
            x += len + 6 + r() * 26;
          }
        }
      }
    } else {
      const gold = kind === 'gold';
      // polido (15/11): grãos um pouco maiores e menos amontoados, cada um com sombra, corpo e brilho legíveis
      grainPass(c, T, r, 900, 13, 6, 9, tn.low, U.mixCss(tn.low, tn.gap, 0.6), null, null, 0);
      grainPass(c, T, r, 470, 13.5, 6.2, 9, tn.mid, tn.low, tn.top, tn.shadow, 0.6);
      grainPass(c, T, r, gold ? 260 : 190, 14, 6.5, 9, tn.top, tn.mid, tn.hi, tn.shadow, 1);
      // pontinho de luz na ponta de alguns grãos (o "brilho de arroz cozido")
      c.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 70; i++) wfill(c, T, r() * T, r() * T, 1.6, 1.1, r() * Math.PI);
      if (gold) { c.fillStyle = '#FFFFFF'; for (let i = 0; i < 16; i++) star4(c, 10 + r() * (T - 20), 10 + r() * (T - 20), 3.5 + r() * 4.5); }
    }
  }
  function tileMochi(c, T, r, tn) {
    c.fillStyle = tn.mid; c.fillRect(0, 0, T, T);
    // manchas largas (massa lisa, sem grão)
    for (let i = 0; i < 26; i++) {
      c.fillStyle = U.rgba(i & 1 ? tn.low : tn.top, 0.3);
      wfill(c, T, r() * T, r() * T, 22 + r() * 30, 9 + r() * 12, (r() - 0.5) * 0.7);
    }
    // rachaduras de esticar: linha escura com beirada clara
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < 9; i++) {
      const x = r() * T, y = r() * T, a = (r() - 0.5) * 1.1, L = 34 + r() * 50;
      const dx = Math.cos(a) * L, dy = Math.sin(a) * L, bx = (r() - 0.5) * 16, by = (r() - 0.5) * 16;
      for (let ox = -T; ox <= T; ox += T) for (let oy = -T; oy <= T; oy += T) {
        const X = x + ox, Y = y + oy;
        if (X < -90 || X > T + 90 || Y < -90 || Y > T + 90) continue;
        c.strokeStyle = U.rgba(tn.top, 0.9); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(X, Y + 1.8); c.quadraticCurveTo(X + dx * 0.5 + bx, Y + dy * 0.5 + by + 1.8, X + dx, Y + dy + 1.8); c.stroke();
        c.strokeStyle = U.rgba(tn.gap, 0.8); c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(X, Y); c.quadraticCurveTo(X + dx * 0.5 + bx, Y + dy * 0.5 + by, X + dx, Y + dy); c.stroke();
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(X + dx * 0.55 + bx * 0.5, Y + dy * 0.55 + by * 0.5); c.lineTo(X + dx * 0.55 - dy * 0.22, Y + dy * 0.55 + dx * 0.22); c.stroke();
      }
    }
    // covinhas: elipse escura com meia-lua clara embaixo
    for (let i = 0; i < 30; i++) {
      const x = r() * T, y = r() * T, s = 4 + r() * 5, a = (r() - 0.5) * 0.5;
      c.fillStyle = tn.top; wfill(c, T, x + 0.6, y + 1.8, s, s * 0.6, a);
      c.fillStyle = tn.low; wfill(c, T, x, y, s, s * 0.6, a);
      c.fillStyle = U.mixCss(tn.low, tn.gap, 0.45); wfill(c, T, x - 0.4, y - 0.7, s * 0.62, s * 0.3, a);
    }
    // brilho de superfície lisa: cápsula branca + pontinho
    for (let i = 0; i < 24; i++) {
      const x = r() * T, y = r() * T, L = 8 + r() * 14;
      c.fillStyle = 'rgba(255,255,255,.85)';
      wfill(c, T, x, y, L, 2.1, -0.42);
      wfill(c, T, x + L * 1.25, y - L * 0.56, 2.2, 1.9, 0);
    }
  }
  function tileSoft(c, T, r, kind, tn) {
    c.fillStyle = U.mixCss(tn.mid, tn.low, kind === 'mochi' ? 0.1 : kind === 'loose' ? 0.2 : 0.4); c.fillRect(0, 0, T, T);
    const nb = kind === 'mochi' ? 26 : 70;
    for (let i = 0; i < nb; i++) { c.fillStyle = U.rgba(tn.gap, 0.1); wfill(c, T, r() * T, r() * T, 5 + r() * 10, 3 + r() * 5, (r() - 0.5) * 0.8); }
    for (let i = 0; i < nb; i++) { c.fillStyle = U.rgba(tn.top, 0.2); wfill(c, T, r() * T, r() * T, 4 + r() * 9, 2.5 + r() * 4, (r() - 0.5) * 0.8); }
    if (kind === 'pressed') {
      c.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const y = (k + 0.5) * (T / 6), m = 1 + (k % 3), ph = r() * TAU;
        c.strokeStyle = U.rgba(tn.gap, 0.28); wavy(c, T, y, 1.6, m, ph, 0, T);
        c.strokeStyle = U.rgba(tn.top, 0.3); wavy(c, T, y + 1.2, 1.6, m, ph, 0, T);
      }
    } else if (kind === 'mochi') {
      for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(255,255,255,.5)'; wfill(c, T, r() * T, r() * T, 4 + r() * 4, 1, -0.42); }
      for (let i = 0; i < 10; i++) { c.fillStyle = U.rgba(tn.gap, 0.3); wfill(c, T, r() * T, r() * T, 6 + r() * 8, 0.7, (r() - 0.5)); }
    }
    if (kind !== 'mochi') {
      const ns = kind === 'gold' ? 80 : 46;
      for (let i = 0; i < ns; i++) { c.fillStyle = U.rgba(tn.hi, 0.55 + r() * 0.4); wfill(c, T, r() * T, r() * T, 0.9 + r() * 0.7, 0.8, 0); }
      for (let i = 0; i < 40; i++) { c.fillStyle = U.rgba(tn.gap, 0.22); wfill(c, T, r() * T, r() * T, 1.2, 0.8, 0); }
    }
  }
  function tileCrest(c, T, r, kind, tn, dense) {
    const flat = kind === 'pressed';
    const L = flat ? 15 : 15.5, W = flat ? 5.4 : 7.2, sp = flat ? 0.3 : 9;
    // sem sombra por grão aqui: somadas viravam um véu cinza que andava junto com a superfície ("a sombra cavando")
    if (dense) grainPass(c, T, r, 300, L * 0.9, W * 0.9, sp, tn.mid, tn.low, tn.top, null, 0.5);
    grainPass(c, T, r, dense ? 330 : 150, L, W, sp, tn.top, tn.mid, tn.hi, null, 1);
  }

  // textura(g, kind, col, c2, c3, variante) -> CanvasPattern cacheado
  function texture(g, kind, col, c2, c3, variant) {
    const key = kind + '|' + col + '|' + (c2 || '') + '|' + (c3 || '') + '|' + variant;
    let p = texCache.get(key);
    if (p) return p;
    // 'g2' = mesmo ladrilho de grãos com o dobro de resolução (8 texels por px de mundo), pra zoom alto em tela densa (celular)
    const hd = variant.length === 3 || variant === 'g2', base = hd ? variant.slice(0, -1) : variant, T = base === 's' ? TS : TG;
    const cv = doc.createElement('canvas'); cv.width = cv.height = hd ? T * 2 : T;
    const c = cv.getContext('2d');
    if (hd) c.scale(2, 2);
    let hsh = 2166136261; for (let i = 0; i < key.length; i++) { hsh ^= key.charCodeAt(i); hsh = Math.imul(hsh, 16777619); }
    const r = E.RNG(hsh >>> 0), tn = tonesOf(kind, col, c2, c3);
    if (base === 's') tileSoft(c, T, r, kind, tn);
    else if (base === 'ca' || base === 'cb') tileCrest(c, T, r, kind, tn, base === 'ca');
    else if (kind === 'mochi') tileMochi(c, T, r, tn);
    else tileGrains(c, T, r, kind, tn);
    p = g.createPattern(cv, 'repeat');
    p.canvas = cv;
    texCache.set(key, p);
    return p;
  }
  function useTex(g, p, scale) {
    if (PM && p.setTransform) { PM.a = PM.d = scale; p.setTransform(PM); }
    g.fillStyle = p;
  }

  // nível de detalhe pela escala S (px de dispositivo por unidade de mundo): A opaco + B por cima com alfa (crossfade)
  let LA = 'g', LAs = 0.25, LB = 'g', LBs = 0.25, LBa = 0, LNear = 1;
  function pickLod(S) {
    const q = Math.pow(2, Math.max(0, Math.round(Math.log2(1 / S))));
    if (S >= 4.2) { LA = 'g2'; LAs = 0.125; LBa = 0; }                    // bem de perto: textura em dobro de resolução (sem borrar)
    else if (S >= 2.55) { LA = 'g'; LAs = 0.25; LBa = 0; }
    else if (S >= 2.25) { LA = 'g'; LAs = 0.5; LB = 'g'; LBs = 0.25; LBa = (S - 2.25) / 0.3; }
    else if (S >= 0.85) { LA = 'g'; LAs = 0.5; LB = 's'; LBs = q; LBa = U.clamp((1.7 - S) / 0.85, 0, 1) * 0.18; }   // menos textura macia: grão continua nítido // médio: grão graúdo, acalmado pela textura macia
    else if (S >= 0.65) { LA = 's'; LAs = q; LB = 'g'; LBs = 0.5; LBa = ((S - 0.65) / 0.2) * 0.58; }
    else { LA = 's'; LAs = q; LBa = 0; }
    LNear = U.clamp((S - 2.25) / 0.3, 0, 1); // 1 = grãos no tamanho real
  }
  function matTex(g, m, variant) {
    const t = m._tx || (m._tx = {});
    return t[variant] || (t[variant] = texture(g, m.tex, m.col, m.col2, m.col3, variant));
  }
  // preenche o caminho atual com a textura do material no LOD corrente (com crossfade)
  function fillMat(g, m) {
    useTex(g, matTex(g, m, LA), LAs); g.fill();
    if (LBa > 0.01) { const pa = g.globalAlpha; g.globalAlpha = pa * LBa; useTex(g, matTex(g, m, LB), LBs); g.fill(); g.globalAlpha = pa; }
  }
  function scaleOf(g) { const m = g.getTransform(); return Math.sqrt(m.a * m.a + m.b * m.b) || 1; }

  const GOLD_MAT = { id: '_gold', tex: 'gold', col: PAL.gold || '#F3C94A', col2: null, col3: null, _tx: null };
  const TEX_BY_INDEX = ['loose', 'pressed', 'mochi'];

  /* ======================================================================
     2. Heap — a montanha de arroz (heightfield em colunas)
     ====================================================================== */
  // E.Heap({width, colW=4, x0=0, y0=0, repose=3.6, relaxIters=2, minK=0.4, flowRate=0.3, layers?, onPocket?(p)}) -> heap
  function Heap(opts) {
    opts = opts || NO;
    const colW = opts.colW || 4;
    const n = Math.max(2, Math.ceil((opts.width || 960) / colW));
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0;
    const h = new Float32Array(n), h0 = new Float32Array(n);
    const act = new Float32Array(n);       // atividade recente de avalanche por coluna (pra desenhar grãos rolando)
    const pk = new Uint8Array(n);          // coluna cruza algum bolsão?
    // ruído fixo dos grãos da crista: 2 por coluna x (posição, altura, ângulo, tamanho)
    const gr = new Float32Array(n * 8);
    { const r = E.RNG(opts.seed || 90210); for (let i = 0; i < gr.length; i++) gr[i] = r(); }
    // rascunhos de desenho (sem alocar por frame)
    const px = new Float32Array(n + 8), py = new Float32Array(n + 8), ph = new Float32Array(n + 8), th = new Float32Array(n + 8);
    const pc = new Int32Array(n + 8);
    const GMAX = Math.min(n * 2, 1400);
    const gX = new Float32Array(GMAX), gY = new Float32Array(GMAX), gA = new Float32Array(GMAX), gL = new Float32Array(GMAX), gW = new Float32Array(GMAX);
    const gM = new Uint8Array(GMAX);

    let layers = [], bands = [], ells = [];
    let layVer = 0;                        // muda quando camadas/bolsões/forma original mudam (refaz a montanha guardada)
    let rA = n, rB = -1;                   // faixa ativa da avalanche (vazia = parada)
    let relaxAcc = 0, sweep = 0, peakDirty = true, lastT = -1;
    const peakOut = { x: 0, h: 0, i: 0 };
    const res = { got: 0, val: 0, gold: 0, hard: 1, blocked: 0, hardMat: null, pocket: null, fell: 0, byMat: {} };

    const heap = {
      n, colW, x0, y0, h, h0, act,
      total: 0,          // área original (px²)
      area: 0,           // área atual (px²)
      maxH: 0,           // maior altura original
      repose: opts.repose !== undefined ? opts.repose : 3.6,
      relaxIters: opts.relaxIters || 2,
      flowRate: opts.flowRate || 0.3,
      minK: opts.minK !== undefined ? opts.minK : 0.4,  // pow/hard abaixo disso = "duro demais" (não cava)
      pockets: [],
      layers,
      flow: 0,           // área que escorreu na última relax() (px²)
      flowX: 0,          // x médio de onde escorreu (mundo)
      onPocket: opts.onPocket || null,

      /* ---------- geração ---------- */
      // generate(fn(x)->altura): preenche a montanha a partir de uma função do x de mundo (centro da coluna)
      generate(fn) {
        for (let i = 0; i < n; i++) { const v = fn(x0 + (i + 0.5) * colW, i); h[i] = h0[i] = v > 0 ? v : 0; }
        return reset0();
      },
      // fromArray(arr): alturas originais vindas de um array (uma por coluna)
      fromArray(arr) {
        for (let i = 0; i < n; i++) { const v = +arr[i] || 0; h[i] = h0[i] = v > 0 ? v : 0; }
        return reset0();
      },
      // restore(): volta a montanha ao estado original (bolsões voltam a ficar escondidos)
      restore() {
        h.set(h0); heap.area = heap.total; act.fill(0); rA = n; rB = -1; peakDirty = true;
        for (let k = 0; k < heap.pockets.length; k++) { heap.pockets[k].found = false; heap.pockets[k].flash = 0; }
        return heap;
      },

      /* ---------- consultas ---------- */
      // col(x) -> índice da coluna (limitado a 0..n-1)
      col(x) { const i = Math.floor((x - x0) / colW); return i < 0 ? 0 : i >= n ? n - 1 : i; },
      // colX(i) -> x de mundo do centro da coluna
      colX(i) { return x0 + (i + 0.5) * colW; },
      // height(x) -> altura atual em x (interpolada entre colunas)
      height(x) {
        const u = (x - x0) / colW - 0.5;
        if (u <= 0) return h[0]; if (u >= n - 1) return h[n - 1];
        const i = u | 0, f = u - i;
        return h[i] + (h[i + 1] - h[i]) * f;
      },
      // surf(x) -> y de MUNDO da superfície (negativo pra cima)
      surf(x) { return y0 - heap.height(x); },
      // alt(yMundo) -> altura acima da base
      alt(y) { return y0 - y; },
      // slope(x) -> inclinação (dAltura/dx; positivo = sobe pra direita)
      slope(x) {
        const i = heap.col(x), a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1;
        return (h[b] - h[a]) / ((b - a) * colW || 1);
      },
      // peak() -> {x, h, i} do ponto mais alto atual (objeto reaproveitado)
      peak() {
        if (peakDirty) {
          let m = -1, mi = 0;
          for (let i = 0; i < n; i++) if (h[i] > m) { m = h[i]; mi = i; }
          peakOut.i = mi; peakOut.h = m; peakOut.x = x0 + (mi + 0.5) * colW; peakDirty = false;
        }
        return peakOut;
      },
      // remaining() -> área que resta (px²)
      remaining() { return heap.area; },
      // frac() -> 0..1 do que resta em relação ao original
      frac() { return heap.total > 0 ? heap.area / heap.total : 0; },
      // dugDepth(x) -> quanto já foi cavado em x (altura original - atual; negativo = empilhado)
      dugDepth(x) { const i = heap.col(x); return h0[i] - h[i]; },

      /* ---------- camadas ---------- */
      // setLayers([{id,name,hard,val,slope,col,col2,col3,tex, top (fração da altura original) | d0,d1 (profundidade abaixo da superfície original) | ellipse:{cx,cy,rx,ry}}])
      //   ordem: da superfície pro fundo; elipses passam por cima das faixas. tex: 'loose'|'pressed'|'mochi'|'gold'
      setLayers(defs) {
        layers = heap.layers = []; bands = []; ells = [];
        for (let k = 0; k < defs.length; k++) {
          const d = defs[k], m = Object.assign({}, d);
          m.index = k; m.id = d.id !== undefined ? d.id : 'm' + k;
          m.hard = d.hard || 1; m.val = d.val !== undefined ? d.val : 1;
          m.slope = d.slope || 0; m.col = d.col || PAL.rice; m.col2 = d.col2 || null; m.col3 = d.col3 || null;
          m.isEllipse = !!d.ellipse;
          m.tex = d.tex || (m.isEllipse ? 'gold' : TEX_BY_INDEX[Math.min(bands.length, 2)]);
          m.lo = new Float32Array(n); m.hi = new Float32Array(n); m._tx = null;
          m.tone = tonesOf(m.tex, m.col, m.col2, m.col3);
          layers.push(m); (m.isEllipse ? ells : bands).push(m);
        }
        if (!bands.length) { heap.setLayers([{ id: 'solto', name: 'Arroz Solto', top: 1, col: '#F6F1E4' }].concat(defs)); return heap; }
        rebuild();
        return heap;
      },
      // matAt(i, alt) -> camada (objeto com id,hard,val,slope,col...) na coluna i e altura alt
      matAt,
      // matAtX(x, alt) -> camada no x de mundo
      matAtX(x, alt) { return matAt(heap.col(x), alt); },
      // topMat(x) -> camada exposta na superfície em x
      topMat(x) { const i = heap.col(x); return matAt(i, h[i] - 0.01); },

      /* ---------- bolsões ---------- */
      // addPocket({x, y (altura), r, mult=8, kind='gold'}) -> bolsão (ganha .found e .flash)
      addPocket(p) {
        p.mult = p.mult !== undefined ? p.mult : 8; p.kind = p.kind || 'gold'; p.found = !!p.found; p.flash = 0;
        const sh = p.shape = new Float32Array(12), r = E.RNG(((p.x * 31 + p.y * 17) | 0) + 7);
        for (let k = 0; k < 12; k++) sh[k] = 0.82 + r() * 0.3;
        p.seed = r();
        heap.pockets.push(p); layVer++;
        const a = heap.col(p.x - p.r * 1.15), b = heap.col(p.x + p.r * 1.15);
        for (let i = a; i <= b; i++) pk[i] = 1;
        return p;
      },
      // clearPockets(): remove todos os bolsões
      clearPockets() { heap.pockets.length = 0; pk.fill(0); layVer++; return heap; },
      // pocketAt(x, alt) -> bolsão que contém o ponto, ou null
      pocketAt,

      /* ---------- cavar / depositar ---------- */
      // dig(cx, area, rad, {pow=1, onTake(i, areaTirada, yTopoMundo)}) -> {got, val, gold, hard, blocked, hardMat, pocket, byMat}
      //   perfil parabólico; cada coluna perde do topo, pesando a dureza (k = pow/hard: >=1 100%, minK..1 = k, <minK nada)
      //   ATENÇÃO: o objeto devolvido é reaproveitado a cada chamada (copie o que for guardar)
      dig(cx, area, rad, o) {
        o = o || NO; clearRes();
        const pow = o.pow || 1, i0 = heap.col(cx - rad), i1 = heap.col(cx + rad);
        let ws = 0;
        for (let i = i0; i <= i1; i++) { const d = (x0 + (i + 0.5) * colW - cx) / rad; if (d > -1 && d < 1) ws += 1 - d * d; }
        if (!(ws > 0) || !(area > 0)) return res;
        for (let i = i0; i <= i1; i++) {
          const d = (x0 + (i + 0.5) * colW - cx) / rad;
          if (d <= -1 || d >= 1 || h[i] <= 0) continue;
          takeCol(i, (area * (1 - d * d)) / ws / colW, pow, 0, o.onTake);
        }
        return finish(i0, i1);
      },
      // digCircle(cx, cy, r, area, {pow, onTake}) -> igual ao dig + {fell}: corte da roda de caçambas (cy em Y DE MUNDO)
      //   colunas dentro do vão da roda perdem do topo, pesado pela sobreposição; nunca abaixo do fundo do círculo.
      //   fell = área que estava ACIMA da roda e "caiu dentro" (pra soltar partículas)
      digCircle(cx, cy, r, area, o) {
        o = o || NO; clearRes();
        const pow = o.pow || 1, i0 = heap.col(cx - r), i1 = heap.col(cx + r), ac = y0 - cy;
        let ws = 0;
        for (let i = i0; i <= i1; i++) {
          const dx = x0 + (i + 0.5) * colW - cx, q = r * r - dx * dx;
          th[i - i0] = q > 0 ? h[i] - (ac - Math.sqrt(q)) : 0;
          if (th[i - i0] > 0) ws += th[i - i0];
        }
        if (!(ws > 0) || !(area > 0)) return res;
        for (let i = i0; i <= i1; i++) {
          const ov = th[i - i0];
          if (!(ov > 0)) continue;
          const dx = x0 + (i + 0.5) * colW - cx, s = Math.sqrt(Math.max(0, r * r - dx * dx));
          const before = h[i], floor = Math.max(0, ac - s);
          takeCol(i, (area * ov) / ws / colW, pow, floor, o.onTake);
          const above = before - (ac + s);
          if (above > 0) res.fell += Math.min(before - h[i], above) * colW;
        }
        return finish(i0, i1);
      },
      // digRect(xa, xb, depth, {pow, onTake}) -> igual ao dig: tira 'depth' px do topo de cada coluna do vão (garfo da empilhadeira)
      digRect(xa, xb, depth, o) {
        o = o || NO; clearRes();
        const pow = o.pow || 1, i0 = heap.col(Math.min(xa, xb)), i1 = heap.col(Math.max(xa, xb));
        for (let i = i0; i <= i1; i++) if (h[i] > 0) takeCol(i, depth, pow, 0, o.onTake);
        return finish(i0, i1);
      },
      // bite(cx, cy, r, dir=1, amostras=12) -> 0..1: fração enterrada do semicírculo da frente da roda (cy em Y de mundo)
      bite(cx, cy, r, dir, samples) {
        const ns = samples || 12; let b = 0;
        for (let k = 0; k < ns; k++) {
          const a = -Math.PI / 2 + ((k + 0.5) / ns) * Math.PI;
          const x = cx + Math.cos(a) * r * (dir < 0 ? -1 : 1), y = cy + Math.sin(a) * r;
          if (y > y0 - heap.height(x)) b++;
        }
        return b / ns;
      },
      // add(x, area, rad=colW*2) -> deposita área em volta de x (perfil parabólico); a avalanche assenta depois
      add(x, area, rad) {
        rad = rad || colW * 2;
        const i0 = heap.col(x - rad), i1 = heap.col(x + rad);
        let ws = 0;
        for (let i = i0; i <= i1; i++) { const d = (x0 + (i + 0.5) * colW - x) / rad; if (d > -1 && d < 1) ws += 1 - d * d; }
        if (!(ws > 0)) { h[heap.col(x)] += area / colW; }
        else for (let i = i0; i <= i1; i++) { const d = (x0 + (i + 0.5) * colW - x) / rad; if (d > -1 && d < 1) h[i] += (area * (1 - d * d)) / ws / colW; }
        heap.area += area; markDirty(i0, i1);
        return heap;
      },
      // wake(xa?, xb?): acorda a avalanche numa faixa (ou em tudo) depois de mexer em heap.h na mão
      wake(xa, xb) {
        if (xa === undefined) markDirty(0, n - 1); else markDirty(heap.col(xa), heap.col(xb));
        let s = 0; for (let i = 0; i < n; i++) s += h[i];
        heap.area = s * colW;
        return heap;
      },

      /* ---------- avalanche ---------- */
      // relax(dt) -> área que escorreu: desliza grão das colunas mais altas que o talude de repouso (por material) permite
      relax(dt) {
        const dtt = dt === undefined ? 1 / 60 : dt;
        // decaimento da atividade e do flash dos bolsões
        const dec = Math.exp(-dtt * 5);
        if (heap._actHot) {
          let hot = false;
          for (let i = heap._a0; i <= heap._a1; i++) { const v = act[i] * dec; act[i] = v < 0.02 ? 0 : v; if (act[i]) hot = true; }
          if (!hot) { heap._actHot = false; heap._a0 = n; heap._a1 = -1; }
        }
        heap.flow = 0;
        if (rB < rA) return 0;
        relaxAcc += heap.relaxIters * dtt * 60;
        let it = relaxAcc | 0; relaxAcc -= it; if (it > 6) it = 6;
        let fx = 0;
        const rate = heap.flowRate, defS = heap.repose;
        for (let k = 0; k < it; k++) {
          const a = rA > 0 ? rA - 1 : 0, b = rB < n - 1 ? rB : n - 2;
          let mA = n, mB = -1;
          sweep ^= 1;
          for (let j = a; j <= b; j++) {
            const i = sweep ? j : b - (j - a);
            const d = h[i] - h[i + 1];
            if (d > defS || d < -defS) {
              const hc = d > 0 ? i : i + 1;
              let m = defS;
              if (layers.length) { const mt = matAt(hc, h[hc] - 0.5); if (mt.slope) m = mt.slope; }
              let t = (d > 0 ? d : -d) - m;
              if (t > 0.002) {
                t *= rate;
                if (d > 0) { h[i] -= t; h[i + 1] += t; } else { h[i] += t; h[i + 1] -= t; }
                if (heap.divert) {                         // grãos de verdade: parte do arroz sai do mapa e rola como partícula
                  const r = d > 0 ? i + 1 : i, tk = heap.divert(r, t * colW) / colW;
                  if (tk > 0) { h[r] -= tk; heap.area -= tk * colW; }
                }
                act[i] += t; act[i + 1] += t * 0.5;
                heap.flow += t * colW; fx += t * colW * (i + 1);
                if (i < mA) mA = i; if (i + 1 > mB) mB = i + 1;
              }
            }
          }
          if (mB < 0) { rA = n; rB = -1; break; }
          rA = mA; rB = mB;
        }
        if (heap.flow > 0) {
          heap.flowX = x0 + (fx / heap.flow) * colW; peakDirty = true;
          heap._actHot = true;
          if (rA - 1 < heap._a0) heap._a0 = Math.max(0, rA - 1);
          if (rB + 1 > heap._a1) heap._a1 = Math.min(n - 1, rB + 1);
        }
        return heap.flow;
      },
      // settle(maxIters=4000): roda a avalanche até parar (carregar save, gerar terreno já assentado)
      settle(maxIters) {
        let k = maxIters || 4000;
        while (rB >= rA && k-- > 0) heap.relax(1 / 60);
        return heap;
      },
      // moving -> true se a avalanche ainda está escorrendo
      get moving() { return rB >= rA; },
      _actHot: false, _a0: n, _a1: -1,

      /* ---------- desenho ---------- */
      // draw(g, view{x0,x1,y0,y1}, time, {outline=true, sparkle=true, grains=true, pockets='all'|'found'|'hint'|false, haze:{col,a0,a1}|0, scale, ol, cache=false})
      //   corte em camadas com grãos, crista ensolarada, sombra nos buracos, bolsões dourados, brilhos e contorno. g já com a câmera aplicada.
      //   cache:true = montanha guardada numa tela de apoio na escala da tela; só refaz as colunas que mudaram (cavar, avalanche),
      //   a faixa nova quando a câmera anda e tudo quando muda zoom/espelho/opções/camadas. Brilhos, flash e grãos rolando ficam vivos.
      //   Com zoom andando (ou câmera girando no tremor) desenha direto. Não mexe em nada da simulação.
      draw,
      // dropCache(): solta a tela de apoio do cache (libera memória; a próxima draw com cache refaz tudo)
      dropCache() { if (BK.cv) { BK.cv.width = BK.cv.height = 0; } BK.cv = null; BK.g = null; BK.sig = ''; BK.w = BK.h = 0; return heap; },
      // cacheStats -> {bakes: retângulos refeitos desde o início, w, h, K}
      get cacheStats() { return { bakes: BK.n, w: BK.w, h: BK.h, K: BK.K }; },
      // prewarm(g): gera as texturas agora (evita o engasgo do primeiro frame)
      prewarm(g) {
        const vs = ['g', 's', 'ca', 'cb'];
        for (let k = 0; k < layers.length; k++) for (let v = 0; v < 4; v++) if (layers[k].tex !== 'mochi' || v < 2) matTex(g, layers[k], vs[v]);
        matTex(g, GOLD_MAT, 'g'); matTex(g, GOLD_MAT, 's');
        return heap;
      },

      /* ---------- save ---------- */
      // serialize({full=false}) -> string compacta (Uint16 em base64; só a faixa que mudou em relação ao original)
      serialize(o) {
        let a = 0, b = n;
        if (!(o && o.full)) {
          while (a < n && Math.abs(h[a] - h0[a]) < 0.02) a++;
          while (b > a && Math.abs(h[b - 1] - h0[b - 1]) < 0.02) b--;
        }
        let mx = 1; for (let i = a; i < b; i++) if (h[i] > mx) mx = h[i];
        const q = 65535 / mx, u8 = new Uint8Array((b - a) * 2);
        for (let i = a; i < b; i++) { const v = Math.round(h[i] * q); u8[(i - a) * 2] = v & 255; u8[(i - a) * 2 + 1] = v >> 8; }
        let s = '';
        for (let i = 0; i < u8.length; i += 4096) s += String.fromCharCode.apply(null, u8.subarray(i, i + 4096));
        let found = '';
        for (let k = 0; k < heap.pockets.length; k++) found += heap.pockets[k].found ? '1' : '0';
        return 'KH1|' + n + '|' + a + '|' + b + '|' + mx.toFixed(3) + '|' + found + '|' + btoa(s);
      },
      // deserialize(dado) -> true se carregou: aceita a string do serialize() ou um array de alturas. Chame depois de generate()/addPocket()
      deserialize(d) {
        try {
          if (typeof d === 'string') {
            const p = d.split('|');
            if (p[0] !== 'KH1' || +p[1] !== n) return false;
            const a = +p[2], b = +p[3], mx = +p[4], bin = atob(p[6]);
            if (!(a >= 0 && b <= n && bin.length === (b - a) * 2)) return false;
            h.set(h0);
            for (let i = a; i < b; i++) h[i] = ((bin.charCodeAt((i - a) * 2) | (bin.charCodeAt((i - a) * 2 + 1) << 8)) * mx) / 65535;
            for (let k = 0; k < heap.pockets.length && k < p[5].length; k++) heap.pockets[k].found = p[5][k] === '1';
          } else if (d && d.length === n) { for (let i = 0; i < n; i++) h[i] = Math.max(0, +d[i] || 0); }
          else return false;
        } catch (e) { return false; }
        heap.wake();
        peakDirty = true;
        return true;
      },
    };

    /* ---------- internos: dados ---------- */
    function reset0() {
      let s = 0, m = 0;
      for (let i = 0; i < n; i++) { s += h0[i]; if (h0[i] > m) m = h0[i]; }
      heap.total = heap.area = s * colW; heap.maxH = m;
      act.fill(0); rA = n; rB = -1; peakDirty = true;
      if (!layers.length) heap.setLayers(opts.layers || [{ id: 'solto', name: 'Arroz Solto', top: 1, col: '#F6F1E4' }]); else rebuild();
      return heap;
    }
    // profundidade da fronteira entre camadas com ondulação suave (não fica uma diagonal reta "colada");
    // mesma função dos dois lados da fronteira, então não abre buraco nem sobrepõe
    function bdepth(i, d) {
      if (!d || !E.Noise || !E.Noise.n1) return d || 0;
      const A = Math.min(34, d * 0.12);
      return Math.max(0, d + (E.Noise.n1(i * colW * 0.006 + d * 0.0137, 77) - 0.5) * 2 * A + (E.Noise.n1(i * colW * 0.031 + d, 31) - 0.5) * A * 0.35);
    }
    // intervalo [lo, hi] (em altura) de cada camada em cada coluna
    function rebuild() {
      layVer++;
      for (let b = 0; b < bands.length; b++) {
        const m = bands[b], nx = bands[b + 1], lo = m.lo, hi = m.hi;
        const byDepth = m.d0 !== undefined || m.d1 !== undefined;
        for (let i = 0; i < n; i++) {
          const H = h0[i];
          let t, l;
          if (byDepth) { t = H - bdepth(i, m.d0 || 0); l = m.d1 !== undefined ? H - bdepth(i, m.d1) : 0; }
          else { t = H * (m.top !== undefined ? m.top : 1); l = nx ? (nx.d0 !== undefined ? H - bdepth(i, nx.d0) : H * (nx.top !== undefined ? nx.top : 0)) : 0; }
          if (b === 0) t = 1e9;                  // o que for empilhado acima da superfície original é da 1ª camada
          if (b === bands.length - 1 || l < 0) l = 0;
          if (t < l) t = l;
          lo[i] = l; hi[i] = t;
        }
      }
      for (let e = 0; e < ells.length; e++) {
        const m = ells[e], el = m.ellipse;
        for (let i = 0; i < n; i++) {
          const dx = (x0 + (i + 0.5) * colW - el.cx) / el.rx, q = 1 - dx * dx;
          if (q > 0) { const s = el.ry * Math.sqrt(q); m.lo[i] = Math.max(0, el.cy - s); m.hi[i] = Math.max(0, el.cy + s); }
          else { m.lo[i] = 0; m.hi[i] = 0; }
        }
      }
    }
    function matAt(i, alt) {
      for (let e = ells.length - 1; e >= 0; e--) { const m = ells[e]; if (alt < m.hi[i] && alt >= m.lo[i]) return m; }
      for (let b = 0; b < bands.length; b++) if (alt >= bands[b].lo[i]) return bands[b];
      return bands[bands.length - 1];
    }
    // fundo do trecho contínuo do material m que contém 'alt' na coluna i
    function segBot(i, alt, m) {
      let bot = m.lo[i];
      if (!m.isEllipse) for (let e = 0; e < ells.length; e++) { const t = ells[e].hi[i]; if (t > bot && t <= alt) bot = t; }
      return bot;
    }
    function pocketAt(x, alt) {
      const P = heap.pockets;
      for (let k = 0; k < P.length; k++) { const p = P[k], dx = x - p.x, dy = alt - p.y; if (dx * dx + dy * dy < p.r * p.r) return p; }
      return null;
    }
    function clearRes() {
      res.got = res.val = res.gold = res.blocked = res.fell = 0; res.hard = 1; res.hardMat = null; res.pocket = null;
      for (let k = 0; k < layers.length; k++) res.byMat[layers[k].id] = 0;
    }
    // tira até 'budget' px (medidos em dureza 1) do topo da coluna i, sem passar de floorAlt
    function takeCol(i, budget, pow, floorAlt, onTake) {
      let hh = h[i], guard = 0;
      const start = hh, xc = x0 + (i + 0.5) * colW, minK = heap.minK, hasP = pk[i];
      while (budget > 1e-5 && hh > floorAlt + 1e-4 && guard++ < 500) {
        const m = matAt(i, hh - 0.01), k = pow / m.hard;
        if (k < 1 && 1 / k > res.hard) res.hard = 1 / k;
        if (k < minK) { res.blocked += budget * colW; res.hardMat = m; break; }
        const eff = k >= 1 ? 1 : k;
        let bot = segBot(i, hh - 0.01, m); if (bot < floorAlt) bot = floorAlt;
        let can = hh - bot; if (hasP && can > 6) can = 6;
        let t = budget * eff; if (t > can) t = can;
        if (!(t > 0)) break;
        const p = hasP ? pocketAt(xc, hh - t * 0.5) : null;
        hh -= t; budget -= t / eff;
        const a = t * colW;
        res.got += a; res.byMat[m.id] += a;
        if (p) {
          res.gold += a; res.val += a * m.val * p.mult;
          if (!p.found) { p.found = true; p.flash = 1; res.pocket = p; if (heap.onPocket) heap.onPocket(p); }
          else if (!res.pocket) res.pocket = p;
        } else res.val += a * m.val;
      }
      if (hh !== start) { h[i] = hh; if (onTake) onTake(i, (start - hh) * colW, y0 - start); }
    }
    function finish(i0, i1) {
      if (res.got > 0) { heap.area -= res.got; markDirty(i0, i1); }
      return res;
    }
    function markDirty(i0, i1) {
      if (i0 < rA) rA = i0; if (i1 > rB) rB = i1;
      peakDirty = true;
    }

    /* ---------- internos: desenho ---------- */
    let M = 0, smooth = false;
    // caminho da superfície entre as amostras ka..kb, deslocado dy pra baixo; cont = continua o caminho atual
    function surfPath(g, ka, kb, dy, cont) {
      if (cont) g.lineTo(px[ka], py[ka] + dy); else g.moveTo(px[ka], py[ka] + dy);
      if (smooth && kb - ka > 1) {
        for (let k = ka + 1; k < kb; k++) g.quadraticCurveTo(px[k], py[k] + dy, (px[k] + px[k + 1]) * 0.5, (py[k] + py[k + 1]) * 0.5 + dy);
        g.lineTo(px[kb], py[kb] + dy);
      } else for (let k = ka + 1; k <= kb; k++) g.lineTo(px[k], py[k] + dy);
    }
    function bodyPath(g, dy) {
      g.beginPath(); surfPath(g, 0, M - 1, dy, false);
      g.lineTo(px[M - 1], y0); g.lineTo(px[0], y0); g.closePath();
    }
    function ellipsesPath(g, ng, sx, sy, kx, ky, only) {
      g.beginPath();
      for (let q = 0; q < ng; q++) {
        if (only >= 0 && gM[q] !== only) continue;
        const a = gA[q], rx = gL[q] * kx, ry = gW[q] * ky, x = gX[q] + sx * gL[q], y = gY[q] + sy * gW[q];
        g.moveTo(x + rx * Math.cos(a), y + rx * Math.sin(a));
        g.ellipse(x, y, rx, ry, a, 0, TAU);
      }
    }
    function pocketPath(g, p, k) {
      const sh = p.shape, N = sh.length, cy = y0 - p.y;
      g.beginPath();
      for (let j = 0; j <= N; j++) {
        const a0 = (j / N) * TAU, a1 = ((j + 1) / N) * TAU, r0 = p.r * sh[j % N] * k, r1 = p.r * sh[(j + 1) % N] * k;
        const xA = p.x + Math.cos(a0) * r0, yA = cy + Math.sin(a0) * r0 * 0.86, xB = p.x + Math.cos(a1) * r1, yB = cy + Math.sin(a1) * r1 * 0.86;
        if (j === 0) g.moveTo((xA + xB) * 0.5, (yA + yB) * 0.5);
        else g.quadraticCurveTo(xA, yA, (xA + xB) * 0.5, (yA + yB) * 0.5);
      }
      g.closePath();
    }
    function sparkle(g, x, y, s) {
      const t = s * 0.22;
      g.fillRect(x - s, y - t, s * 2, t * 2); g.fillRect(x - t, y - s, t * 2, s * 2);
    }

    // amostra a superfície na vista (px/py/ph/pc, M, KA..KB, STEP, smooth). false = nada da montanha à vista
    let STEP = 1, KA = 0, KB = 0, I0 = 0, I1 = 0;
    function sample(view, S) {
      let i0 = view ? Math.floor((view.x0 - x0) / colW) - 2 : 0, i1 = view ? Math.ceil((view.x1 - x0) / colW) + 2 : n - 1;
      if (i0 < 0) i0 = 0; if (i1 > n - 1) i1 = n - 1;
      if (i1 - i0 < 1) return false;
      /* amostragem (decima colunas quando afastado: >= ~1,6 px de dispositivo por vértice) */
      const step = Math.max(1, Math.floor(1.6 / (colW * S)));
      i0 -= i0 % step;
      M = 0;
      let anyH = false, ka = -1, kb = -1;
      for (let i = i0; i <= i1; i += step) {
        let s = 0, c = 0;
        for (let j = i; j < i + step && j < n; j++) { s += h[j]; c++; }
        s /= c;
        pc[M] = i + (c >> 1); px[M] = x0 + (i + c * 0.5) * colW; ph[M] = s; py[M] = y0 - s;
        if (s > 0.05) { anyH = true; if (ka < 0) ka = M; kb = M; }
        M++;
      }
      if (!anyH || M < 2) return false;
      KA = Math.max(0, ka - 1); KB = Math.min(M - 1, kb + 1); STEP = step; I0 = i0; I1 = i1;
      smooth = step === 1 && colW * S > 2.5;
      return true;
    }

    function draw(g, view, time, o) {
      o = o || NO;
      const S = o.scale || scaleOf(g);
      time = time || 0;
      const dtDraw = lastT < 0 ? 0 : Math.min(0.1, Math.max(0, time - lastT)); lastT = time;
      if (o.cache && view && drawCached(g, view, time, o, S, dtDraw)) return;
      if (!drawStatic(g, view, time, o, S, dtDraw, true)) return;
      drawLive(g, view, time, o, S, dtDraw, false);
    }

    // parte parada da montanha (corpo, camadas, crista, grãos, contorno, bolsões sem brilho): só depende de h, h0, camadas, bolsões
    // achados, escala e opções. live = brilho/flash dos bolsões junto (desenho direto, ordem de sempre)
    function drawStatic(g, view, time, o, S, dt, live) {
      if (!sample(view, S)) return false;
      const vy0 = view ? view.y0 : y0 - heap.maxH * 1.5 - 200;
      pickLod(S);
      const ka = KA, kb = KB, step = STEP, i0 = I0, i1 = I1;
      const ol = o.outline === false ? 0 : Math.max(o.ol || 1.25, 1.25 / S);
      const pxw = 1 / S; // 1 px de dispositivo em unidades de mundo

      /* grãos individuais da crista (só de perto): calculados uma vez, usados no contorno e no preenchimento */
      let ng = 0;
      const gAlpha = o.grains === false ? 0 : U.clamp((S - 1.25) / 0.5, 0, 1);
      if (gAlpha > 0) {
        const gk = 1 + (1 - LNear) * 0.7; // no LOD médio o grão da textura dobra; a crista acompanha
        for (let i = Math.max(1, i0); i <= i1 && i < n - 1 && ng < GMAX - 2; i++) {
          if (h[i] < 0.6) continue;
          const mt = matAt(i, h[i] - 0.01);
          if (mt.tex === 'mochi') continue;
          const flat = mt.tex === 'pressed';
          const sl = Math.atan2(-(h[i + 1] - h[i - 1]), colW * 2);
          for (let j = 0; j < 2; j++) {
            const b = (i * 2 + j) * 4, fx = gr[b];
            const u = i + fx - 0.5, ia = u | 0, f = u - ia;
            const alt = h[ia] + (h[ia + 1] - h[ia]) * f;
            const W = (flat ? 1.15 : 1.5) * (0.85 + gr[b + 3] * 0.4) * gk;
            gX[ng] = x0 + (i + fx) * colW; gY[ng] = y0 - alt - W * (gr[b + 1] * 0.75 - 0.25);
            gA[ng] = sl + (gr[b + 2] - 0.5) * (flat ? 0.5 : 1.9);
            gL[ng] = (flat ? 3.6 : 3.3) * (0.85 + gr[b + 3] * 0.4) * gk; gW[ng] = W; gM[ng] = mt.index;
            ng++;
          }
        }
      }

      /* 1. contorno primeiro (o corpo cobre a metade de dentro): silhueta = linha da superfície + grãos que saem dela */
      g.lineJoin = 'round'; g.lineCap = 'round';
      if (ol > 0) {
        g.strokeStyle = LINE; g.lineWidth = ol * 2;
        g.beginPath(); surfPath(g, ka, kb, 0, false); g.stroke();
        if (ng) { g.globalAlpha = gAlpha; g.lineWidth = ol * 1.7; ellipsesPath(g, ng, 0, 0, 0.5, 0.5, -1); g.stroke(); g.globalAlpha = 1; }
      }

      /* 2. corpo, recortado pela superfície */
      g.save();
      bodyPath(g, 0); g.clip();

      // faixas (da superfície pro fundo)
      for (let b = 0; b < bands.length; b++) {
        const m = bands[b], lo = m.lo, hi = m.hi;
        let vis = false;
        for (let k = 0; k < M; k++) { const c = pc[k]; if (hi[c] - lo[c] > 0.01 && lo[c] < ph[k]) { vis = true; break; } }
        if (!vis) continue;
        g.beginPath();
        if (b === 0) { g.moveTo(px[0], vy0 - 20); g.lineTo(px[M - 1], vy0 - 20); }
        else { g.moveTo(px[0], y0 - hi[pc[0]]); for (let k = 1; k < M; k++) g.lineTo(px[k], y0 - hi[pc[k]]); }
        for (let k = M - 1; k >= 0; k--) g.lineTo(px[k], y0 - lo[pc[k]] + (b < bands.length - 1 ? pxw : 0));
        g.closePath();
        fillMat(g, m);
      }
      // divisas entre faixas: acompanham a superfície original
      for (let b = 1; b < bands.length; b++) {
        const m = bands[b], hi = m.hi;
        g.beginPath(); g.moveTo(px[0], y0 - hi[pc[0]]);
        for (let k = 1; k < M; k++) g.lineTo(px[k], y0 - hi[pc[k]]);
        g.strokeStyle = U.rgba(m.tone.gap, 0.75); g.lineWidth = Math.max(1.1, 1.5 * pxw); g.stroke();
        g.beginPath(); g.moveTo(px[0], y0 - hi[pc[0]] + Math.max(1.4, 1.8 * pxw));
        for (let k = 1; k < M; k++) g.lineTo(px[k], y0 - hi[pc[k]] + Math.max(1.4, 1.8 * pxw));
        g.strokeStyle = U.rgba(m.tone.top, 0.6); g.lineWidth = Math.max(0.8, pxw); g.stroke();
      }
      // regiões em elipse (núcleo)
      for (let e = 0; e < ells.length; e++) {
        const m = ells[e], el = m.ellipse;
        if (view && (el.cx + el.rx < view.x0 || el.cx - el.rx > view.x1)) continue;
        g.beginPath(); g.ellipse(el.cx, y0 - el.cy, el.rx, el.ry, 0, 0, TAU);
        fillMat(g, m);
        g.strokeStyle = U.rgba(m.tone.gap, 0.9); g.lineWidth = Math.max(2, 2.4 * pxw); g.stroke();
        g.beginPath(); g.ellipse(el.cx, y0 - el.cy, Math.max(1, el.rx - Math.max(3, 3.4 * pxw)), Math.max(1, el.ry - Math.max(3, 3.4 * pxw)), 0, 0, TAU);
        g.strokeStyle = U.rgba(m.tone.hi, 0.55); g.lineWidth = Math.max(1.2, 1.4 * pxw); g.stroke();
      }

      // peso da profundidade: dois degraus de tom chapado abaixo da superfície atual (mais escuro e apertado lá embaixo)
      const dk = Math.max(1, 0.7 * pxw);
      g.fillStyle = 'rgba(74,46,20,.045)';
      bodyPath(g, 18 * dk); g.fill();
      bodyPath(g, 46 * dk); g.fill();
      bodyPath(g, 105 * dk); g.fill();
      // sombra na base
      const bs = Math.max(10, Math.min(60, heap.maxH * 0.03));
      g.fillStyle = 'rgba(74,46,20,.09)';
      g.fillRect(px[0], y0 - bs, px[M - 1] - px[0], bs); g.fillRect(px[0], y0 - bs * 0.45, px[M - 1] - px[0], bs * 0.45);

      // bolsões dourados
      if (o.pockets !== false && heap.pockets.length) drawPockets(g, view, time, S, o.pockets || 'all', dt, live);

      // crista: grãos maiores e ensolarados nos primeiros px abaixo da superfície, por material
      const cT = 9 * (1 + (1 - LNear) * 0.6);
      if (S >= 0.65) {
        const hdC = S >= 4.2, cScale = hdC ? 0.125 : LNear > 0.5 ? 0.25 : 0.5, ca = S < 0.85 ? (S - 0.65) / 0.2 : 1;
        for (let L = 0; L < layers.length; L++) {
          const m = layers[L], lo = m.lo, hi = m.hi;
          let vis = false;
          for (let k = 0; k < M; k++) { const c = pc[k]; if (ph[k] > lo[c] + 0.01 && ph[k] - cT * 2 < hi[c] && hi[c] > lo[c]) { vis = true; break; } }
          if (!vis) continue;
          for (let pass = 0; pass < 2; pass++) {
            const a0 = pass * cT, a1 = a0 + cT;
            g.beginPath();
            for (let k = 0; k < M; k++) { const c = pc[k]; let t = ph[k] - a0; if (t > hi[c]) t = hi[c]; const y = y0 - t; if (k) g.lineTo(px[k], y); else g.moveTo(px[k], y); }
            for (let k = M - 1; k >= 0; k--) {
              const c = pc[k]; let t = ph[k] - a0; if (t > hi[c]) t = hi[c];
              let bt = ph[k] - a1; if (bt < lo[c]) bt = lo[c]; if (bt > t) bt = t;
              g.lineTo(px[k], y0 - bt);
            }
            g.closePath();
            g.globalAlpha = ca;
            if (m.tex === 'mochi') { g.fillStyle = pass ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.34)'; g.fill(); }
            else { useTex(g, matTex(g, m, (pass ? 'cb' : 'ca') + (hdC ? '2' : '')), cScale); g.fill(); }
          }
        }
        g.globalAlpha = 1;
      }
      if (S < 0.85) { // de longe: uma faixa clara chapada segura a leitura da crista
        g.globalAlpha = S < 0.65 ? 1 : 1 - (S - 0.65) / 0.2;
        g.fillStyle = 'rgba(255,253,244,.34)';
        g.beginPath(); surfPath(g, 0, M - 1, 0, false);
        for (let k = M - 1; k >= 0; k--) g.lineTo(px[k], py[k] + 7 * pxw);
        g.closePath(); g.fill();
        g.globalAlpha = 1;
      }

      // oclusão: buracos e pés de barranco ficam mais escuros (faixa chapada de espessura variável)
      {
        const w = 6;
        let sum = 0, cnt = 0, any = false;
        for (let k = 0; k < Math.min(M, w); k++) { sum += ph[k]; cnt++; }
        const cap = Math.max(22, 16 * pxw);
        for (let k = 0; k < M; k++) {
          if (k + w < M) { sum += ph[k + w]; cnt++; }
          if (k - w - 1 >= 0) { sum -= ph[k - w - 1]; cnt--; }
          const c = pc[k];
          let t = (sum / cnt - ph[k]) * 1.5;
          const dug = (h0[c] - ph[k]) * 0.12; if (dug > t) t = dug > 9 ? 9 : dug;
          t = t < 0 ? 0 : t > cap ? cap : t;
          th[k] = t; if (t > 0.3) any = true;
        }
        if (any) {
          g.fillStyle = 'rgba(64,38,16,.06)';
          for (let pass = 0; pass < 2; pass++) {
            const kk = pass ? 0.45 : 1;
            g.beginPath(); surfPath(g, 0, M - 1, 0, false);
            for (let k = M - 1; k >= 0; k--) g.lineTo(px[k], py[k] + th[k] * kk);
            g.closePath(); g.fill();
          }
        }
      }

      // filete de luz ao longo da crista (por dentro do contorno)
      {
        const rim = Math.max(0.9, 1.5 * pxw);
        g.strokeStyle = 'rgba(255,254,246,.55)'; g.lineWidth = (ol + rim) * 1.6;
        g.beginPath(); surfPath(g, ka, kb, 0, false); g.stroke();
      }

      // névoa de distância (opcional): tinge o corpo, mais forte no alto
      if (o.haze) {
        const hz = o.haze, col = hz.col || PAL.sky, a0 = hz.a0 !== undefined ? hz.a0 : 0.04, a1 = hz.a1 !== undefined ? hz.a1 : 0.3;
        const top = y0 - heap.maxH, N = 6;
        for (let k = 0; k < N; k++) { // degraus chapados, sem gradiente liso
          g.fillStyle = U.rgba(col, a0 + ((a1 - a0) * (k + 0.5)) / N);
          const ya = y0 + ((top - y0) * k) / N, yb = k === N - 1 ? vy0 - 50 : y0 + ((top - y0) * (k + 1)) / N;
          g.fillRect(px[0], yb, px[M - 1] - px[0], ya - yb);
        }
      }
      g.restore();

      /* 3. grãos da crista por cima (barriga, corpo, brilho), em lote por material */
      if (ng) {
        g.globalAlpha = gAlpha;
        for (let L = 0; L < layers.length; L++) {
          const m = layers[L]; let c = 0;
          for (let q = 0; q < ng; q++) if (gM[q] === L) c++;
          if (!c) continue;
          g.fillStyle = m.tone.mid; ellipsesPath(g, ng, 0, 0, 0.5, 0.5, L); g.fill();
          g.fillStyle = m.tone.top; ellipsesPath(g, ng, -0.03, -0.13, 0.44, 0.35, L); g.fill();
          g.fillStyle = m.tone.hi; ellipsesPath(g, ng, -0.08, -0.2, 0.2, 0.11, L); g.fill();
        }
        g.globalAlpha = 1;
      }
      return true;
    }

    // parte viva (depois de sample() na vista atual): grãos rolando, brilhinhos e, se pockets, brilho/flash dos bolsões
    function drawLive(g, view, time, o, S, dt, pockets) {
      const step = STEP, pxw = 1 / S, ol = o.outline === false ? 0 : Math.max(o.ol || 1.25, 1.25 / S);
      if (pockets && o.pockets !== false && heap.pockets.length) livePockets(g, view, time, S, o.pockets || 'all', dt);
      /* 4. grãos rolando onde a avalanche está escorrendo */
      if (heap._actHot && S > 0.12 && o.rolling !== false) {   // rolling:false quando o jogo usa E.SlideFX
        const big = S >= 0.9, rs = big ? 1 : 1.3 * pxw;
        g.fillStyle = PAL.rice; g.strokeStyle = LINE; g.lineWidth = Math.max(0.45, 0.8 * pxw);
        g.beginPath();
        let cnt = 0;
        for (let k = 1; k < M - 1 && cnt < 260; k++) {
          const c = pc[k], a = act[c];
          if (a < 0.12) continue;
          const dir = ph[k + 1] < ph[k - 1] ? 1 : -1, hsh = gr[c * 8 + 5];
          const nn = a > 1.2 ? 2 : 1;
          for (let j = 0; j < nn; j++) {
            const f = (time * (2.2 + hsh * 1.6) + hsh * 7 + j * 0.5) % 1;
            const x = px[k] + dir * (f - 0.5) * colW * step * 2.4;
            const kx = k + (dir * (f - 0.5) > 0 ? dir : 0), y = (kx >= 0 && kx < M ? (py[k] + py[kx]) * 0.5 : py[k]) - Math.abs(Math.sin(f * Math.PI * 2)) * (big ? 2.4 : 2.5 * pxw) - rs - (big ? 0 : ol * 1.3);
            if (big) { const an = f * 9 * dir; g.moveTo(x + 1.7 * Math.cos(an), y + 1.7 * Math.sin(an)); g.ellipse(x, y, 1.7, 0.85, an, 0, TAU); }
            else g.rect(x - rs, y - rs, rs * 2, rs * 2);
            cnt++;
          }
        }
        if (cnt) { if (big) g.stroke(); g.fill(); }
      }

      /* 5. brilhinhos */
      if (o.sparkle !== false) {
        const vw = px[M - 1] - px[0];
        const slot = Math.pow(2, Math.ceil(Math.log2(Math.max(8, vw / 30))));
        const s0 = Math.floor(px[0] / slot), s1 = Math.ceil(px[M - 1] / slot);
        g.fillStyle = '#FFFFFF';
        for (let s = s0; s <= s1; s++) {
          const r1 = E.hash(s * 3 + 1), r2 = E.hash(s * 3 + 2), r3 = E.hash(s * 3 + 3);
          const tw = Math.sin(time * (1.6 + r2 * 2.4) + r1 * 40);
          if (tw < 0.55) continue;
          const x = (s + r1) * slot;
          if (x < px[0] || x > px[M - 1]) continue;
          const alt = heap.height(x);
          if (alt < 3) continue;
          const sz = ((tw - 0.55) / 0.45) * (1.6 + r3 * 1.8) * Math.max(pxw, 0.55);
          sparkle(g, x, y0 - alt + (2 + r3 * 14) * Math.max(pxw, 0.6), sz);
        }
      }
    }

    /* ---------- montanha guardada (o.cache): o corpo vai pra uma tela de apoio na escala da tela (1 pixel = 1 pixel, sem
       reamostrar) e só os retângulos das colunas que mudaram são refeitos; vivos por cima: brilhos, flash, grãos rolando.
       Refaz tudo quando muda escala/espelho/opções/camadas; câmera andando = copia o que já tem e desenha só a faixa nova. */
    const BK = { cv: null, g: null, K: 0, mir: 0, sig: '', bx: 0, by: 0, ox: 0, oy: 0, w: 0, h: 0, hs: null, fd: '', lastK: 0, n: 0, stale: false, fc: 0 };
    const BV = { x0: 0, x1: 0, y0: 0, y1: 0 };
    function bakeMargin(K) { const step = Math.max(1, Math.floor(1.6 / (colW * K))); return (8 * step + 4) * colW + 24 / K; }
    function foundSig() { let f = ''; for (let k = 0; k < heap.pockets.length; k++) f += heap.pockets[k].found ? '1' : '0'; return f; }
    // refaz o retângulo (pixels da tela de apoio) com o h atual
    function bakeRect(o, rx, ry, rw, rh) {
      if (rx < 0) { rw += rx; rx = 0; } if (ry < 0) { rh += ry; ry = 0; }
      if (rx + rw > BK.w) rw = BK.w - rx; if (ry + rh > BK.h) rh = BK.h - ry;
      if (rw <= 0 || rh <= 0) return;
      const c = BK.g, K = BK.K, E2 = bakeMargin(K);
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(rx, ry, rw, rh);
      c.save(); c.beginPath(); c.rect(rx, ry, rw, rh); c.clip();
      c.setTransform(K, 0, 0, K, BK.bx - BK.ox, BK.by - BK.oy);
      BV.x0 = (rx + BK.ox - BK.bx) / K - E2; BV.x1 = (rx + rw + BK.ox - BK.bx) / K + E2;
      BV.y0 = (ry + BK.oy - BK.by) / K - E2; BV.y1 = (ry + rh + BK.oy - BK.by) / K + E2;
      drawStatic(c, BV, 0, o, K, 0, false);
      c.restore();
      BK.n++;
    }
    function drawCached(g, view, time, o, S, dt) {
      const m = g.getTransform();
      if (m.b || m.c || !(m.d > 0)) return false;
      const K = m.d;
      if (Math.abs(Math.abs(m.a) - K) > K * 1e-7 || K * colW < 0.05) return false;
      const mir = m.a < 0 ? 1 : 0;
      const stable = K === BK.lastK; BK.lastK = K;
      if (K !== BK.K && !stable) return false;            // zoom ainda andando: desenha direto até assentar
      // pedaço da montanha que aparece (mundo)
      const padW = 10 + 6 / K, top = y0 - Math.max(1, heap.peak().h) - padW, bot = y0 + padW;
      const ax0 = Math.max(view.x0, x0 - padW), ax1 = Math.min(view.x1, x0 + n * colW + padW), ay0 = Math.max(view.y0, top), ay1 = Math.min(view.y1, bot);
      if (ax1 <= ax0 || ay1 <= ay0) return false;          // nada à vista: o caminho direto sai cedo
      const hz = o.haze, sig = K + '|' + mir + '|' + (o.outline === false ? 0 : o.ol || 1) + '|' + (o.grains === false ? 0 : 1) + '|' + (o.pockets === false ? 0 : o.pockets || 'all') + '|' +
        (hz ? (hz.col || '') + ',' + hz.a0 + ',' + hz.a1 : '') + '|' + layVer + '|' + n;
      const vw = view.x1 - view.x0, vh = view.y1 - view.y0;
      // janela desejada (mundo), do tamanho da vista + folga, presa à montanha
      const wantW = Math.min(vw * 1.3, x0 + n * colW + padW - (x0 - padW)), wantH = Math.min(vh * 1.2, bot - top);
      const cw = Math.ceil(wantW * K) + 4, ch = Math.ceil(wantH * K) + 4;
      const cx = (view.x0 + view.x1) / 2, cy = (view.y0 + view.y1) / 2;
      let full = sig !== BK.sig || !BK.cv || cw > BK.w || ch > BK.h || cw < BK.w * 0.7 || ch < BK.h * 0.6;
      if (full) {
        if (!BK.cv) { BK.cv = doc.createElement('canvas'); BK.g = BK.cv.getContext('2d'); }
        BK.w = BK.cv.width = cw; BK.h = BK.cv.height = Math.ceil(ch * 1.06) + 24;   // folga em altura: o pico crescer 1 px não refaz tudo
        BK.K = K; BK.mir = mir; BK.sig = sig;
        BK.bx = mir ? Math.ceil(m.e) - m.e : m.e - Math.floor(m.e); BK.by = m.f - Math.floor(m.f);
        if (!BK.hs || BK.hs.length !== n) BK.hs = new Float32Array(n);
      }
      // janela atual em mundo
      const wx0 = (BK.ox - BK.bx) / K, wy0 = (BK.oy - BK.by) / K, wx1 = wx0 + BK.w / K, wy1 = wy0 + BK.h / K;
      const inside = !full && ax0 >= wx0 && ax1 <= wx1 && ay0 >= wy0 && ay1 <= wy1;
      // colunas cavadas: refaz em quadros alternados (a 30 qps; a máquina, os grãos e o brilho continuam a 60 por cima).
      // Cavando sem parar era 1 retângulo refeito por quadro, o maior custo da montanha no pós-final.
      BK.fc = (BK.fc + 1) | 0;
      if (!full && (BK.fc & 1 || BK.stale)) {
        // colunas que mudaram desde a última vez (inclusive as da folga, que mexem na sombra de dentro)
        const E2 = bakeMargin(K), hs = BK.hs;
        let c0 = Math.floor((wx0 - E2 - x0) / colW), c1 = Math.ceil((wx1 + E2 - x0) / colW);
        if (c0 < 0) c0 = 0; if (c1 > n - 1) c1 = n - 1;
        let ra = -1, rb = -1, lo = 1e9, hi = -1e9, tot = 0;
        const runs = [];
        for (let i = c0; i <= c1 + 1; i++) {
          const ch2 = i <= c1 && h[i] !== hs[i];
          if (ch2) {
            if (ra >= 0 && i - rb > 24) { runs.push(ra, rb, lo, hi); tot += rb - ra; ra = -1; }
            if (ra < 0) { ra = i; lo = 1e9; hi = -1e9; }
            rb = i;
            const a = h[i] < hs[i] ? h[i] : hs[i], b = h[i] > hs[i] ? h[i] : hs[i];
            if (a < lo) lo = a; if (b > hi) hi = b;
            hs[i] = h[i];
          } else if (ra >= 0 && (i > c1 || i - rb > 24)) { runs.push(ra, rb, lo, hi); tot += rb - ra; ra = -1; }
        }
        // muita coisa mexendo ao mesmo tempo (avalanche larga, restore): desenha direto enquanto durar e refaz tudo quando acalmar
        if (tot * colW > (wx1 - wx0) * 0.6) { BK.stale = true; return false; }
        if (BK.stale) { BK.stale = false; full = true; }
        else {
          const stepK = Math.max(1, Math.floor(1.6 / (colW * K))), dk = Math.max(1, 0.7 / K), deep = Math.max(105 * dk, 22, 16 / K, 30) + 12 + 6 / K, fx = E2 + colW;
          for (let r = 0; r < runs.length; r += 4) {
            // a sombra de oclusão usa a média das vizinhas: o retângulo pega a altura mais alta em volta
            let lo2 = runs[r + 2], hi2 = runs[r + 3];
            const ia = Math.max(0, runs[r] - 8 * stepK - 2), ib = Math.min(n - 1, runs[r + 1] + 8 * stepK + 2);
            for (let i = ia; i <= ib; i++) { if (h[i] > hi2) hi2 = h[i]; if (h[i] < lo2) lo2 = h[i]; }
            const xa = x0 + runs[r] * colW - fx, xb = x0 + (runs[r + 1] + 1) * colW + fx;
            const ya = y0 - hi2 - padW, yb = y0 - lo2 + deep;
            const rx = Math.floor(K * xa + BK.bx) - BK.ox, ry = Math.floor(K * ya + BK.by) - BK.oy;
            bakeRect(o, rx, ry, Math.ceil(K * xb + BK.bx) - BK.ox - rx, Math.ceil(K * yb + BK.by) - BK.oy - ry);
          }
        }
        // bolsão achado agora: refaz o retângulo dele
        const fd = foundSig();
        if (!full && fd !== BK.fd) {
          for (let k = 0; k < heap.pockets.length; k++) {
            if (fd[k] === BK.fd[k]) continue;
            const p = heap.pockets[k], rr = p.r * 1.3 + 8 + 6 / K;
            const rx = Math.floor(K * (p.x - rr) + BK.bx) - BK.ox, ry = Math.floor(K * (y0 - p.y - rr) + BK.by) - BK.oy;
            bakeRect(o, rx, ry, Math.ceil(K * rr * 2) + 2, Math.ceil(K * rr * 2) + 2);
          }
          BK.fd = fd;
        }
      }
      if (full || !inside) {
        // nova janela: centrada na vista, presa à montanha
        let nx0 = cx - BK.w / K / 2, ny0 = cy - BK.h / K / 2;
        const lx0 = x0 - padW, lx1 = x0 + n * colW + padW + 2 / K, b2 = bot + 2 / K;   // +2 px: o arredondamento pra baixo não corta a borda
        if (nx0 + BK.w / K > lx1) nx0 = lx1 - BK.w / K; if (nx0 < lx0) nx0 = lx0;
        if (ny0 + BK.h / K > b2) ny0 = b2 - BK.h / K; if (ny0 < top) ny0 = top;
        const nox = Math.floor(K * nx0 + BK.bx), noy = Math.floor(K * ny0 + BK.by);
        const dx = BK.ox - nox, dy = BK.oy - noy;
        if (!full && Math.abs(dx) < BK.w * 0.75 && Math.abs(dy) < BK.h * 0.75) {
          // câmera andou: copia o que já está pronto e desenha só as faixas novas
          const c = BK.g;
          c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'copy'; c.drawImage(BK.cv, dx, dy); c.globalCompositeOperation = 'source-over';
          BK.ox = nox; BK.oy = noy;
          if (dx > 0) bakeRect(o, 0, 0, dx, BK.h); else if (dx < 0) bakeRect(o, BK.w + dx, 0, -dx, BK.h);
          if (dy > 0) bakeRect(o, 0, 0, BK.w, dy); else if (dy < 0) bakeRect(o, 0, BK.h + dy, BK.w, -dy);
        } else {
          BK.ox = nox; BK.oy = noy;
          bakeRect(o, 0, 0, BK.w, BK.h);
          BK.hs.set(h); BK.fd = foundSig();
        }
      }
      // carimba só o pedaço que aparece, pixel com pixel (translação inteira, sem suavizar)
      const cvw = g.canvas.width, cvh = g.canvas.height;
      const D = Math.round(mir ? BK.bx + m.e - BK.ox : BK.ox - BK.bx + m.e), Dy = Math.round(BK.oy - BK.by + m.f);
      let u0 = mir ? D - cvw : -D, u1 = mir ? D : cvw - D, v0 = -Dy, v1 = cvh - Dy;
      if (u0 < 0) u0 = 0; if (v0 < 0) v0 = 0; if (u1 > BK.w) u1 = BK.w; if (v1 > BK.h) v1 = BK.h;
      if (u1 > u0 && v1 > v0) {
        g.save(); g.setTransform(mir ? -1 : 1, 0, 0, 1, D, Dy); g.imageSmoothingEnabled = false;
        g.drawImage(BK.cv, u0, v0, u1 - u0, v1 - v0, u0, v0, u1 - u0, v1 - v0);
        g.restore();
      }
      if (sample(view, S)) drawLive(g, view, time, o, S, dt, true);
      return true;
    }

    function drawPockets(g, view, time, S, mode, dt, live) {
      const P = heap.pockets, pxw = 1 / S;
      for (let k = 0; k < P.length; k++) {
        const p = P[k];
        if (live && p.flash > 0) p.flash = Math.max(0, p.flash - dt * 1.6);
        if (mode === 'found' && !p.found) continue;
        if (view && (p.x + p.r * 1.2 < view.x0 || p.x - p.r * 1.2 > view.x1 || y0 - p.y + p.r < view.y0 || y0 - p.y - p.r > view.y1)) continue;
        // só o que ainda está enterrado aparece (o recorte do corpo cuida do resto)
        if (p.y - p.r > heap.height(p.x) + p.r) continue;
        const pa = mode === 'hint' && !p.found ? 0.4 : 1;
        g.globalAlpha = pa;
        pocketPath(g, p, 1);
        fillMat(g, GOLD_MAT);
        g.strokeStyle = PAL.goldD || '#B4852A'; g.lineWidth = Math.max(1.6, 2 * pxw); g.stroke();
        pocketPath(g, p, 1 - Math.min(0.3, Math.max(3.2 * pxw, 3) / p.r));
        g.strokeStyle = 'rgba(255,246,190,.75)'; g.lineWidth = Math.max(1, 1.2 * pxw); g.stroke();
        if (live) pocketFx(g, p, k, time, pxw);
        g.globalAlpha = 1;
      }
    }
    // brilhos que piscam em posições que trocam + flash de quando foi achado
    function pocketFx(g, p, k, time, pxw) {
      const pa = g.globalAlpha;
      g.fillStyle = '#FFFFFF';
      for (let j = 0; j < 3; j++) {
        const ph0 = time * (0.7 + j * 0.23) + p.seed * 9 + j * 2.1, cyc = Math.floor(ph0), f = ph0 - cyc;
        const a = E.hash(cyc * 7 + j + k * 13) * TAU, rr = E.hash(cyc * 11 + j * 5 + k) * p.r * 0.72;
        const sz = Math.sin(f * Math.PI) * Math.max(2.2 * pxw, Math.min(5, p.r * 0.11));
        sparkle(g, p.x + Math.cos(a) * rr, y0 - p.y + Math.sin(a) * rr * 0.8, sz);
      }
      if (p.flash > 0) {
        g.globalAlpha = p.flash;
        pocketPath(g, p, 1 + (1 - p.flash) * 0.25);
        g.strokeStyle = '#FFFFFF'; g.lineWidth = Math.max(3, 4 * pxw) * (0.5 + p.flash); g.stroke();
      }
      g.globalAlpha = pa;
    }
    // só a parte viva dos bolsões (montanha guardada), recortada pelo corpo da vista atual
    function livePockets(g, view, time, S, mode, dt) {
      const P = heap.pockets, pxw = 1 / S;
      let clip = false;
      for (let k = 0; k < P.length; k++) {
        const p = P[k];
        if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 1.6);
        if (mode === 'found' && !p.found) continue;
        if (view && (p.x + p.r * 1.2 < view.x0 || p.x - p.r * 1.2 > view.x1 || y0 - p.y + p.r < view.y0 || y0 - p.y - p.r > view.y1)) continue;
        if (p.y - p.r > heap.height(p.x) + p.r) continue;
        if (!clip) { g.save(); bodyPath(g, 0); g.clip(); clip = true; }
        g.globalAlpha = mode === 'hint' && !p.found ? 0.4 : 1;
        pocketFx(g, p, k, time, pxw);
      }
      if (clip) { g.globalAlpha = 1; g.restore(); }
    }

    if (opts.layers) heap.setLayers(opts.layers);
    return heap;
  }
  E.Heap = Heap;

  /* ======================================================================
     3. Pile — pilha pequena que assenta dentro de um recipiente (caçamba, carrinho, visor do silo)
     ====================================================================== */
  // E.Pile({cap=100, cols=20, slope=.05, max=1.2, col='#F6F1E4', tex='loose', seed}) -> pile
  //   volume em unidades livres (cap = cheio e plano). Perfil interno em colunas que escorrem: o monte cresce onde cai e assenta.
  function Pile(opts) {
    opts = opts || NO;
    const cols = opts.cols || 20;
    const u = new Float32Array(cols), d = new Float32Array(cols);   // alturas (1 = topo do recipiente) reais e mostradas
    const gr = new Float32Array(cols * 4);
    { const r = E.RNG(opts.seed || 4242); for (let i = 0; i < gr.length; i++) gr[i] = r(); }
    const mat = { tex: opts.tex || 'loose', col: opts.col || '#F6F1E4', col2: opts.col2 || null, col3: opts.col3 || null, _tx: null };
    mat.tone = tonesOf(mat.tex, mat.col, mat.col2, mat.col3);
    const sxs = new Float32Array(cols + 2), sys = new Float32Array(cols + 2);
    let live = false;

    function relax(iters) {
      const s = pile.slope * (20 / cols), bias = pile.tilt * s * 2;
      let moved = 0;
      for (let k = 0; k < iters; k++) {
        for (let j = 0; j < cols - 1; j++) {
          const i = k & 1 ? cols - 2 - j : j, df = u[i] - u[i + 1] + bias;
          if (df > s) { let t = (df - s) * 0.35; if (t > u[i]) t = u[i]; u[i] -= t; u[i + 1] += t; moved += t; }
          else if (df < -s) { let t = (-df - s) * 0.35; if (t > u[i + 1]) t = u[i + 1]; u[i] += t; u[i + 1] -= t; moved += t; }
        }
      }
      return moved;
    }
    const pile = {
      cap: opts.cap || 100,
      max: opts.max || 1.2,          // quanto passa do cheio antes de derramar (carga coroada)
      slope: opts.slope || 0.05,     // desnível máximo entre colunas vizinhas (em fração da altura), pra 20 colunas
      tilt: 0,                       // -1..1: inclina o repouso (caçamba basculando, freada)
      v: 0, cols, u, mat,
      // frac -> 0..max (1 = cheio)
      get frac() { return pile.v / pile.cap; },
      // add(v, at=.5 (0..1 ao longo da largura), spread=.16) -> quanto coube (o resto derramou)
      add(v, at, spread) {
        const room = pile.cap * pile.max - pile.v;
        if (v > room) v = room;
        if (!(v > 0)) return 0;
        at = at === undefined ? 0.5 : at; spread = spread || 0.16;
        const c = at * cols - 0.5, rad = Math.max(1, spread * cols);
        let ws = 0;
        for (let i = 0; i < cols; i++) { const q = (i - c) / rad; if (q > -1 && q < 1) ws += 1 - q * q; }
        const dm = (v / pile.cap) * cols;
        if (!(ws > 0)) u[U.clamp(Math.round(c), 0, cols - 1)] += dm;
        else for (let i = 0; i < cols; i++) { const q = (i - c) / rad; if (q > -1 && q < 1) u[i] += (dm * (1 - q * q)) / ws; }
        pile.v += v;
        relax(3);
        return v;
      },
      // take(v, at?) -> quanto saiu: tira do topo (em volta de 'at', ou das colunas mais altas)
      take(v, at) {
        if (v > pile.v) v = pile.v;
        if (!(v > 0)) return 0;
        let need = (v / pile.cap) * cols, guard = 0;
        while (need > 1e-6 && guard++ < 40) {
          let ws = 0;
          if (at !== undefined) { for (let i = 0; i < cols; i++) { const q = (i + 0.5) / cols - at; ws += u[i] > 0 ? 1 / (1 + q * q * 40) : 0; } }
          else for (let i = 0; i < cols; i++) ws += u[i];
          if (!(ws > 0)) break;
          let got = 0;
          for (let i = 0; i < cols; i++) {
            if (u[i] <= 0) continue;
            const q = (i + 0.5) / cols - at, w = at !== undefined ? 1 / (1 + q * q * 40) : u[i];
            let t = (need * w) / ws; if (t > u[i]) t = u[i];
            u[i] -= t; got += t;
          }
          need -= got;
          if (got < 1e-7) break;
        }
        pile.v -= v; if (pile.v < 1e-6) { pile.v = 0; u.fill(0); }
        relax(2);
        return v;
      },
      // set(frac): define o volume direto (monte já assentado)
      set(f) {
        u.fill(0); pile.v = 0;
        if (f > 0) { pile.add(f * pile.cap, 0.5, 0.3); relax(60); }
        d.set(u);
        return pile;
      },
      // clear(): esvazia
      clear() { u.fill(0); d.fill(0); pile.v = 0; return pile; },
      // update(dt): continua assentando e anima a superfície mostrada (opcional, mas é o que dá vida)
      update(dt) {
        live = true;
        relax(2);
        const k = 1 - Math.exp(-dt * 16);
        for (let i = 0; i < cols; i++) d[i] += (u[i] - d[i]) * k;
      },
      // topAt(at, hmax) -> altura do monte (px) na posição 0..1 (pra pousar grãos em cima)
      topAt(at, hmax) { return (live ? d : u)[U.clamp(Math.floor(at * cols), 0, cols - 1)] * hmax; },
      // draw(g, x (centro), y (fundo), w, hmax, {outline=true, grains=true, scale, clip=true}): monte com grão, crista clara e contorno
      draw(g, x, y, w, hmax, o) {
        if (pile.v <= 0) return;
        o = o || NO;
        const S = o.scale || scaleOf(g), a = live ? d : u, xl = x - w / 2, cw = w / cols, pxw = 1 / S;
        let any = false;
        for (let i = 0; i < cols; i++) { sxs[i] = xl + (i + 0.5) * cw; sys[i] = y - a[i] * hmax; if (a[i] * hmax > 0.3) any = true; }
        if (!any) return;
        const ol = o.outline === false ? 0 : Math.max(o.ol || 1, 1.25 / S);
        const top = g2 => {
          g2.moveTo(xl, y - a[0] * hmax);
          for (let i = 0; i < cols - 1; i++) g2.quadraticCurveTo(sxs[i], sys[i], (sxs[i] + sxs[i + 1]) * 0.5, (sys[i] + sys[i + 1]) * 0.5);
          g2.lineTo(xl + w, y - a[cols - 1] * hmax);
        };
        pickLod(S);
        g.lineJoin = 'round'; g.lineCap = 'round';
        if (ol > 0) { g.strokeStyle = LINE; g.lineWidth = ol * 2; g.beginPath(); top(g); g.stroke(); }
        g.save();
        g.beginPath(); top(g); g.lineTo(xl + w, y); g.lineTo(xl, y); g.closePath(); g.clip();
        fillMat(g, mat);
        // fundo mais escuro, crista ensolarada
        g.fillStyle = 'rgba(74,46,20,.10)';
        g.beginPath(); g.moveTo(xl, y); for (let i = 0; i < cols; i++) g.lineTo(sxs[i], Math.min(y, sys[i] + Math.max(7, hmax * 0.3))); g.lineTo(xl + w, y); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(xl, y); for (let i = 0; i < cols; i++) g.lineTo(sxs[i], Math.min(y, sys[i] + Math.max(14, hmax * 0.6))); g.lineTo(xl + w, y); g.closePath(); g.fill();
        if (S >= 0.65 && mat.tex !== 'mochi') {
          const cT = Math.min(hmax * 0.22, 7 * (1 + (1 - LNear) * 0.6));
          g.beginPath(); top(g);
          for (let i = cols - 1; i >= 0; i--) g.lineTo(sxs[i], sys[i] + cT);
          g.closePath(); useTex(g, matTex(g, mat, 'ca'), LNear > 0.5 ? 0.25 : 0.5); g.fill();
        }
        g.strokeStyle = 'rgba(255,254,246,.9)'; g.lineWidth = (ol + Math.max(0.8, 1.3 * pxw)) * 2;
        g.beginPath(); top(g); g.stroke();
        g.restore();
        // grãos soltos na crista
        if (o.grains !== false && S >= 1.25 && mat.tex !== 'mochi') {
          const tn = mat.tone, gk = 1 + (1 - LNear) * 0.5;
          for (let pass = 0; pass < 4; pass++) {
            g.beginPath();
            for (let i = 1; i < cols - 1; i++) {
              if (a[i] * hmax < 1.5) continue;
              const b = i * 4, L = 3.2 * (0.85 + gr[b + 3] * 0.4) * gk, W = L * 0.45;
              const gx = xl + (i + gr[b]) * cw, gy = sys[i] + (sys[i + (gr[b] > 0.5 ? 1 : -1)] - sys[i]) * Math.abs(gr[b] - 0.5) - W * (gr[b + 1] * 0.6 - 0.2);
              const an = Math.atan2(sys[i + 1] - sys[i - 1], cw * 2) + (gr[b + 2] - 0.5) * 1.8;
              const kx = pass < 2 ? 0.5 : pass === 2 ? 0.44 : 0.2, ky = pass < 2 ? 0.5 : pass === 2 ? 0.35 : 0.11;
              const ox = pass === 2 ? -0.03 * L : pass === 3 ? -0.08 * L : 0, oy = pass === 2 ? -0.13 * W : pass === 3 ? -0.2 * W : 0;
              g.moveTo(gx + ox + L * kx * Math.cos(an), gy + oy + L * kx * Math.sin(an));
              g.ellipse(gx + ox, gy + oy, L * kx, W * ky, an, 0, TAU);
            }
            if (pass === 0) { if (ol > 0) { g.strokeStyle = LINE; g.lineWidth = ol * 1.7; g.stroke(); } }
            else { g.fillStyle = pass === 1 ? tn.mid : pass === 2 ? tn.top : tn.hi; g.fill(); }
          }
        }
      },
    };
    if (opts.frac) pile.set(opts.frac);
    return pile;
  }
  E.Pile = Pile;

  /* ======================================================================
     4. Grains — grãos voando; com deposit, somam na montanha onde pousam ("pilha que assenta")
     ====================================================================== */
  // E.Grains(particles|null, heap, {max=700, g=900, drag=.4, col, onLand(x, y, gold, vol)}) -> grains
  //   Grãos com deposit (ou sem Particles) usam o simulador interno (precisam pousar certinho na superfície);
  //   grãos só decorativos vão pro E.Particles recebido, se houver (shape 'grain').
  function Grains(particles, heap, opts) {
    opts = opts || NO;
    const MAX = opts.max || 700, G = opts.g !== undefined ? opts.g : 900, DRAG = opts.drag !== undefined ? opts.drag : 0.4;
    const X = new Float32Array(MAX), Y = new Float32Array(MAX), VX = new Float32Array(MAX), VY = new Float32Array(MAX);
    const R = new Float32Array(MAX), VR = new Float32Array(MAX), LIFE = new Float32Array(MAX), VOL = new Float32Array(MAX), SZ = new Float32Array(MAX);
    const FL = new Uint8Array(MAX); // 1 ouro, 2 deposita, 4 já quicou
    const usePs = !!(particles && particles.add);
    const cRice = opts.col || PAL.rice, cRiceS = PAL.riceD || '#CFC2A2', cGold = PAL.gold, cGoldD = PAL.goldD;
    const PS = { x: 0, y: 0, vx: 0, vy: 0, g: G, life: 2.5, r: 0, vr: 0, w: 3, h: 1.4, c: cRice, shape: 'grain', land: true, drag: DRAG, fade: 0.2 };
    let n = 0;

    const grains = {
      heap, particles: particles || null,
      onLand: opts.onLand || null,
      // count -> grãos vivos no simulador interno
      get count() { return n; },
      // emit(x, y, n, {vx=0, vy=-120, spread=60, gold=false, deposit=false, vol=0 (área total que os n grãos carregam), size=1, life=4})
      emit(x, y, cnt, o) {
        o = o || NO;
        const vx = o.vx || 0, vy = o.vy !== undefined ? o.vy : -120, sp = o.spread !== undefined ? o.spread : 60;
        const dep = !!o.deposit && !!heap, vol = dep && o.vol ? o.vol / cnt : 0, fl = (o.gold ? 1 : 0) | (dep ? 2 : 0);
        if (usePs && !dep && !o.internal) {
          for (let k = 0; k < cnt; k++) {
            const s = (o.size || 1) * (0.8 + Math.random() * 0.5);
            PS.x = x + (Math.random() - 0.5) * 4; PS.y = y - Math.random() * 3;
            PS.vx = vx + (Math.random() - 0.5) * sp; PS.vy = vy + (Math.random() - 0.5) * sp * 0.8;
            PS.life = o.life || 2.5; PS.r = Math.random() * TAU; PS.vr = (Math.random() - 0.5) * 16;
            PS.w = 3.2 * s; PS.h = 1.5 * s; PS.c = o.gold ? cGold : cRice;
            particles.add(PS); // o Particles copia os campos: o molde é reaproveitado
          }
          return grains;
        }
        for (let k = 0; k < cnt; k++) {
          let i = n;
          if (n < MAX) n++;
          else { // cheio: recicla um aleatório, sem perder o volume que ele carregava
            i = (Math.random() * MAX) | 0;
            if ((FL[i] & 2) && VOL[i] > 0 && heap) heap.add(X[i], VOL[i]);
          }
          X[i] = x + (Math.random() - 0.5) * 4; Y[i] = y - Math.random() * 3;
          VX[i] = vx + (Math.random() - 0.5) * sp; VY[i] = vy + (Math.random() - 0.5) * sp * 0.8;
          R[i] = Math.random() * TAU; VR[i] = (Math.random() - 0.5) * 18;
          LIFE[i] = o.life || 4; VOL[i] = vol; SZ[i] = (o.size || 1) * (0.8 + Math.random() * 0.5); FL[i] = fl;
        }
        return grains;
      },
      // update(dt): gravidade, arrasto, quique e pouso (com deposit: heap.add onde pousou)
      update(dt) {
        const dr = Math.exp(-DRAG * dt), y0 = heap ? heap.y0 : 0;
        for (let i = 0; i < n; i++) {
          VY[i] += G * dt; VX[i] *= dr;
          X[i] += VX[i] * dt; Y[i] += VY[i] * dt; R[i] += VR[i] * dt; LIFE[i] -= dt;
          let dead = LIFE[i] <= 0;
          if (!dead && VY[i] > 0) {
            const fy = heap ? heap.surf(X[i]) : y0;
            if (Y[i] >= fy) {
              if (!(FL[i] & 4) && VY[i] > 90 && Math.random() < 0.45) { // um quique curto, descendo o barranco
                const sl = heap ? heap.slope(X[i]) : 0;
                FL[i] |= 4; Y[i] = fy - 0.5; VY[i] *= -0.22 - Math.random() * 0.12; VX[i] = VX[i] * 0.4 - sl * 60; VR[i] *= 0.6;
              } else dead = true;
            }
          }
          if (dead) {
            if ((FL[i] & 2) && VOL[i] > 0 && heap) heap.add(X[i], VOL[i], heap.colW * 1.6);
            if (grains.onLand) grains.onLand(X[i], Y[i], !!(FL[i] & 1), VOL[i]);
            n--;
            if (i < n) { X[i] = X[n]; Y[i] = Y[n]; VX[i] = VX[n]; VY[i] = VY[n]; R[i] = R[n]; VR[i] = VR[n]; LIFE[i] = LIFE[n]; VOL[i] = VOL[n]; SZ[i] = SZ[n]; FL[i] = FL[n]; i--; }
          }
        }
      },
      // draw(g, view?, scale?): grãos com barriga escura e corpo claro (de longe viram pontinhos)
      draw(g, view, scale) {
        if (!n) return;
        const S = scale || scaleOf(g), big = S >= 0.9, mn = 1.1 / S;
        for (let pass = 0; pass < 4; pass++) {
          const gold = pass >= 2 ? 1 : 0, body = pass & 1;
          if (!big && !body) continue;
          let c = 0;
          g.beginPath();
          for (let i = 0; i < n; i++) {
            if ((FL[i] & 1) !== gold) continue;
            const x = X[i], y = Y[i];
            if (view && (x < view.x0 - 8 || x > view.x1 + 8 || y < view.y0 - 8 || y > view.y1 + 8)) continue;
            if (big) {
              const L = 1.75 * SZ[i], W = 0.85 * SZ[i], a = R[i];
              if (body) { g.moveTo(x - 0.12 + L * 0.86 * Math.cos(a), y - 0.22 + L * 0.86 * Math.sin(a)); g.ellipse(x - 0.12, y - 0.22, L * 0.86, W * 0.7, a, 0, TAU); }
              else { g.moveTo(x + (L + 0.35) * Math.cos(a), y + (L + 0.35) * Math.sin(a)); g.ellipse(x, y, L + 0.35, W + 0.35, a, 0, TAU); }
            } else { const s = Math.max(mn, 1.2 * SZ[i]); g.rect(x - s * 0.5, y - s * 0.5, s, s); }
            c++;
          }
          if (!c) continue;
          g.fillStyle = gold ? (body ? cGold : cGoldD) : body ? cRice : big ? LINE : cRiceS;
          if (big && !body) g.globalAlpha = gold ? 1 : 0.8;
          g.fill();
          g.globalAlpha = 1;
        }
      },
      // floor(x) -> y de mundo do chão (pra passar como floorFn no particles.update)
      floor(x) { return heap ? heap.surf(x) : 0; },
      // clear(): some com todos (sem depositar)
      clear() { n = 0; return grains; },
      // flush(): pousa todos agora (deposita o que carregavam); útil antes de salvar
      flush() {
        for (let i = 0; i < n; i++) if ((FL[i] & 2) && VOL[i] > 0 && heap) heap.add(X[i], VOL[i]);
        n = 0; return grains;
      },
    };
    return grains;
  }
  E.Grains = Grains;

  /* ======================================================================
     5. SlideFX: grãos de verdade descendo a encosta durante a avalanche
     ====================================================================== */
  // E.SlideFX(heap, {max=240, g=900, onLand(x, y, speed, mat), carry=.45, grainMass=6, active()}) -> { update(dt, view{x0,x1}), draw(g, zoom=1), list, flush() }
  //   Com carry > 0 ele instala heap.divert: uma fração do arroz que escorrega SAI do mapa de altura e vira grão de verdade,
  //   que rola e, quando para (ou sai da tela), devolve a massa pro mapa onde parou (heap.add). Assim dá pra ver o arroz
  //   descer e se acumular no pé. Só empresta enquanto update() está rodando e dentro da vista; flush() devolve tudo.
  //   Nasce grão onde a coluna está escorrendo (heap.act), na cor do material exposto; ele rola pela superfície
  //   ganhando velocidade no íngreme, dá pulinhos, perde força no plano e some. onLand avisa quando cai de um pulo forte
  //   (o jogo põe poeira/som ali).
  function SlideFX(heap, o) {
    o = o || NO;
    const max = o.max || 240, G = o.g || 900, list = [], free = [], carry = o.carry === undefined ? 0.45 : o.carry, GM = o.grainMass || 6;
    let spawnAcc = 0, lastUpd = 0, vx0 = -1e9, vx1 = 1e9;
    const pool = new Map();                                  // coluna -> massa emprestada esperando virar grão
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const cols = [];
    function grainPath(g, p, r) {
      if (p.clump) { for (let j = 0; j < 3; j++) { const an = p.rot + j * 2.1; g.moveTo(p.x + Math.cos(an) * r * 0.55 + r * 0.55, p.y - r + Math.sin(an) * r * 0.45); g.arc(p.x + Math.cos(an) * r * 0.55, p.y - r + Math.sin(an) * r * 0.45, r * 0.55, 0, TAU); } }
      else { g.moveTo(p.x + r * Math.cos(p.rot), p.y - r * 0.6 + r * Math.sin(p.rot)); g.ellipse(p.x, p.y - r * 0.6, r, r * 0.5, p.rot, 0, TAU); }
    }
    function giveBack(x, m) { if (m > 0) heap.add(x, m, heap.colW * 2); }
    if (carry > 0) heap.divert = (i, area) => {
      if (now() - lastUpd > 200 || list.length >= max || (o.active && !o.active())) return 0;          // sem update recente (jogo acelerado/pausado): não empresta
      const x = heap.colX(i); if (x < vx0 || x > vx1) return 0;
      const take = area * carry; pool.set(i, (pool.get(i) || 0) + take); return take;
    };
    const colOf = m => (m && m.col) || PAL.rice;
    function spawn(i, mass) {
      if (list.length >= max) { if (mass) giveBack(heap.colX(i), mass); return; }
      const x = heap.colX(i) + (Math.random() - 0.5) * heap.colW * 2, y = heap.surf(x);
      const m = heap.topMat ? heap.topMat(x) : null, clump = m && m.hard >= 2 && Math.random() < 0.35;
      const p = free.pop() || {};
      p.x = x; p.y = y - 1; p.vx = (Math.random() - 0.5) * 20; p.vy = 0; p.air = false; p.t = 0; p.still = 0;
      p.r = clump ? 2.6 + Math.random() * 2.2 : 1.5 + Math.random() * 0.8; p.rot = Math.random() * 6.3; p.c = colOf(m); p.m = m; p.clump = clump; p.mass = mass || 0;
      if (p.mass > GM * 2.5) { p.clump = true; p.r = Math.min(6, 2.4 + Math.sqrt(p.mass) * 0.35); }
      list.push(p);
    }
    return {
      list,
      // flush(): devolve pro mapa toda massa que está rolando ou esperando (antes de salvar / trocar de montanha)
      flush() { for (const [i, m] of pool) giveBack(heap.colX(i), m); pool.clear(); for (const p of list) giveBack(p.x, p.mass); list.length = 0; },
      update(dt, v) {
        lastUpd = now(); if (v) { vx0 = v.x0; vx1 = v.x1; }
        // massa emprestada vira grão (ou volta pro mapa se for pouquinha)
        for (const [i, m] of pool) { if (m >= GM) { spawn(i, m); pool.delete(i); } else if (Math.random() < dt * 4) { giveBack(heap.colX(i), m); pool.delete(i); } }
        // nascer: proporcional à atividade das colunas visíveis (só enfeite, sem massa)
        if (heap._actHot && v) {
          const a0 = Math.max(heap._a0, heap.col(v.x0)), a1 = Math.min(heap._a1, heap.col(v.x1)), act = heap.act;
          const step = Math.max(1, Math.round((a1 - a0) / 220));
          spawnAcc += dt * 60;
          if (spawnAcc >= 1) {
            spawnAcc = 0;
            for (let i = a0; i <= a1; i += step) { const a = act[i]; if (a > 0.25 && Math.random() < Math.min(0.3, a * 0.03) * step) spawn(i, 0); }
          }
        }
        for (let k = list.length - 1; k >= 0; k--) {
          const p = list[k]; p.t += dt;
          if (p.air) {
            p.vy += G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 0.2 * dt;
            const sy = heap.surf(p.x);
            if (p.y >= sy) {
              const hit = p.vy;
              p.y = sy;
              if (hit > 140 && o.onLand) o.onLand(p.x, sy, hit, p.m);
              if (hit > 90 && !p.clump) { p.vy = -hit * 0.32; } else { p.air = false; p.vy = 0; }
            }
          } else {
            const sl = heap.slope(p.x);                         // + = sobe pra direita: rola pra esquerda
            const a = -sl / (1 + sl * sl) * G * (p.clump ? 0.8 : 1);
            p.vx += a * dt; p.vx *= 1 - (Math.abs(sl) < 0.35 ? 4 : 1.1) * dt;    // atrito: forte no plano
            const nx = p.x + p.vx * dt, ny = heap.surf(nx);
            // a superfície caiu mais que a "parábola" do grão: ele sai voando (borda convexa)
            if (ny - p.y > Math.abs(p.vx) * dt * 1.8 + 1.5) { p.air = true; p.vy = Math.abs(p.vx) * 0.15; }
            else if (Math.abs(sl) > 1.2 && Math.random() < dt * 3) { p.air = true; p.vy = -40 - Math.random() * 70; }   // pulinho na encosta
            p.x = nx; if (!p.air) p.y = ny;
          }
          p.rot += p.vx * dt * (p.clump ? 0.06 : 0.25);
          p.still = Math.abs(p.vx) < 10 && !p.air ? p.still + dt : 0;
          if (p.still > 0.35 || p.t > 6 || (v && (p.x < v.x0 - 200 || p.x > v.x1 + 200))) { giveBack(p.x, p.mass); list[k] = list[list.length - 1]; list.pop(); free.push(p); }
        }
      },
      draw(g, z) {
        if (!list.length) return;
        const k = Math.max(1, 0.9 / (z || 1));                // longe: grão um pouco maior pra continuar visível
        g.save(); g.lineJoin = 'round'; g.strokeStyle = LINE; g.lineWidth = Math.max(0.5, 0.7 * k);
        // grãos parados de vez (sem sumir): em lote por cor, 1 preenchimento + 1 contorno por cor (eram 2 chamadas por grão:
        // ~150 grãos = ~300 desenhos por quadro). Só muda a ordem de quem se sobrepõe.
        cols.length = 0;
        for (let i = 0; i < list.length; i++) { const p = list[i]; if (!(p.still > 0) && cols.indexOf(p.c) < 0) cols.push(p.c); }
        g.globalAlpha = 1;
        for (let c = 0; c < cols.length; c++) {
          g.beginPath();
          for (let i = 0; i < list.length; i++) { const p = list[i]; if (p.c === cols[c] && !(p.still > 0)) grainPath(g, p, p.r * k); }
          g.fillStyle = cols[c]; g.fill(); g.stroke();
        }
        // os que estão sumindo (alfa próprio), um a um
        for (let i = 0; i < list.length; i++) {
          const p = list[i]; if (!(p.still > 0)) continue;
          g.globalAlpha = Math.max(0, 1 - p.still / 0.35);
          g.fillStyle = p.c; g.beginPath(); grainPath(g, p, p.r * k); g.fill(); g.stroke();
        }
        g.restore();
      },
    };
  }
  E.SlideFX = SlideFX;

  // E.Terrain: utilitários expostos (gerador de textura de grão pra outros módulos usarem o mesmo arroz)
  //   E.Terrain.texture(g, 'loose'|'pressed'|'mochi'|'gold', col, col2?, col3?, 'g'|'s'|'ca'|'cb') -> CanvasPattern (ladrilho em .canvas)
  //   E.Terrain.fill(g, {tex, col}, escala?) preenche o caminho atual com o LOD certo pra escala
  E.Terrain = {
    texture,
    fill(g, mat, scale) { pickLod(scale || scaleOf(g)); fillMat(g, mat); },
    clearCache() { texCache.clear(); },
  };
})();


/* ===== engine/rig.js ===== */
/* Pixxel — rig.js
   Máquinas articuladas "de verdade": esqueleto de peças com juntas, IK, juntas com mola (peso e overshoot),
   pistões que esticam, cabos com polias, mastros telescópicos, chassi com suspensão, esteira transportadora
   e escapamento em pulsos. Tudo no estilo Kome (contorno LINE, cores chapadas da E.PAL).
   Depende de: core.js, pix.js.

   Índice
     1. Spring / Joint      mola amortecida; junta com limites, vazão hidráulica e batente
     2. ik2 / ik3           IK de dois ossos; lança + braço + caçamba com ângulo da caçamba controlado
     3. Rig                 esqueleto hierárquico (peças, z, sprites, pistões/links entre peças, world())
     4. Rig.* (desenho)     pin, plate (braço chapado afinado), bucket, pulley, mound
     5. Rope                cabo por polias (tangentes), barriga, polias que giram com o cabo pago
     6. Telescope           mastro/cilindro telescópico em estágios
     7. Chassis             rodas num chão f(x): inclinação da carroceria + compressão da suspensão
     8. Exhaust             fumaça de escapamento em pulsos
     9. Conveyor            esteira transportadora em polilinha com roletes, marcas e montinhos de carga

   Receita de um braço articulado (ver demos/rig.html pras máquinas completas):
     const rig = E.Rig(), J = { boom: E.Joint(-.6, {k:22, d:7.5, min:-1.3, max:0, speed:1.3}), stick: E.Joint(1.5, {k:34, d:9}) };
     rig.part('casa',  { draw: g => Draw.box(g, -40, -40, 80, 40, PAL.yel, {r:5}) });
     rig.part('lanca', { parent:'casa',  x:30, y:-12, z:2, joint:J.boom,  draw: g => { Rig.plate(g, [[0,0,6],[30,-13,10],[80,0,5]], PAL.yel); Rig.pin(g,0,0,3); } });
     rig.part('braco', { parent:'lanca', x:80, y:0,   z:3, joint:J.stick, draw: g => Rig.plate(g, [[-12,-2,4],[3,-1,7],[50,0,4]], PAL.yel) });
     rig.piston('p1', { a:['casa',44,-4],   b:['lanca',32,-6],  w:6, z:2.5 });  rig.calibrate('p1', [['lanca', J.boom.min, J.boom.max]]);
     rig.piston('p2', { a:['lanca',31,-21], b:['braco',-12,-2], w:5, z:3.5 });  rig.calibrate('p2', [['braco', .4, 2.5]]);
     // por frame: alvo no espaço do modelo -> IK -> alvos das juntas (as molas dão o peso e o atraso entre elas)
     const ik = E.ik2(30, -12, alvoX, alvoY, 80, 50, 1, tmp);  J.boom.set(ik.a1);  J.stick.set(ik.rel);
     rig.update(dt);  rig.draw(g, x, y, { face, rot: chassi.tilt });
   Regras de ouro: pino (Rig.pin) em toda junta; braço = Rig.plate afinado, nunca um Draw.beam só; todo movimento passa por
   E.Joint/E.Spring (rigidez diferente por junta = atraso entre elas); o "segundo braço" é a mesma peça mais escura com z atrás. */
(function () {
  'use strict';
  const E = (window.Pixxel = window.Pixxel || {});
  if (!E.U) throw new Error('Pixxel: carregue core.js antes de rig.js');
  if (!E.Draw) throw new Error('Pixxel: carregue pix.js antes de rig.js');

  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;
  const TAU = Math.PI * 2, PI = Math.PI, NO = Object.freeze({});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const olW = o => {                                   // contorno efetivo (respeita Draw.OL e Draw.minPx)
    const v = o && o.ol !== undefined ? o.ol : Draw.OL;
    if (v <= 0) return 0;
    const m = (Draw.minPx || 0) / (Draw.zoom || 1);
    return v > m ? v : m;
  };
  const shadeCache = new Map();                        // U.shade com cache (strings prontas, zero alocação por frame)
  function sh(c, k) {
    const key = c + '|' + k;
    let v = shadeCache.get(key);
    if (v === undefined) { v = U.shade(c, k); shadeCache.set(key, v); }
    return v;
  }
  function mixc(a, b, t) {
    const key = a + '>' + b + '|' + t;
    let v = shadeCache.get(key);
    if (v === undefined) { v = U.mixCss(a, b, t); shadeCache.set(key, v); }
    return v;
  }

  /* ======================================================================
     1. Spring / Joint
     ====================================================================== */
  // integra uma mola amortecida em subpassos estáveis (Euler semi-implícito)
  function stepSpring(s, target, dt) {
    if (!(dt > 0)) return;
    const hMax = Math.min(1 / 120, 0.4 / Math.sqrt(s.k > 1 ? s.k : 1));
    let n = Math.ceil(dt / hMax); if (n > 12) n = 12;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      s.v += ((target - s.x) * s.k - s.v * s.d) * h;
      s.x += s.v * h;
    }
  }

  // E.Spring(v, {k=120, d=14}) -> { x, v, target, k, d, update(dt)->x, kick(impulso), snap(x) }: mola amortecida (balanço de carroceria, antena, carga pendurada)
  function Spring(v, o) {
    o = o || NO;
    const s = {
      x: v || 0, v: 0, target: v || 0,
      k: o.k !== undefined ? o.k : 120, d: o.d !== undefined ? o.d : 14,
      // update(dt) -> x: avança a mola em direção a target
      update(dt) { stepSpring(s, s.target, dt); return s.x; },
      // kick(impulso): soma velocidade (tranco)
      kick(imp) { s.v += imp; return s; },
      // snap(x): teleporta e zera a velocidade
      snap(x) { s.x = s.target = x; s.v = 0; return s; },
    };
    return s;
  }

  // E.Joint(ang, {k=60, d=11, min, max, speed=Infinity, bounce=.2}) -> junta com peso: acelera, passa um pouco do ponto e assenta
  //   target = onde você quer; speed = "vazão hidráulica" (rad/s máx. do alvo interno); min/max = batentes (bate e quica 'bounce');
  //   campos: x (ângulo atual), v, target, goal, hit (velocidade da batida no batente neste frame, senão 0), moving
  //   amortecimento: zeta = d / (2*sqrt(k)); ~.7 dá um overshoot leve, 1 = sem overshoot
  function Joint(ang, o) {
    o = o || NO;
    const j = {
      x: ang || 0, v: 0, target: ang || 0, goal: ang || 0,
      k: o.k !== undefined ? o.k : 60, d: o.d !== undefined ? o.d : 11,
      min: o.min !== undefined ? o.min : -Infinity, max: o.max !== undefined ? o.max : Infinity,
      speed: o.speed !== undefined ? o.speed : Infinity, bounce: o.bounce !== undefined ? o.bounce : 0.2,
      hit: 0, moving: false,
      // update(dt) -> x
      update(dt) {
        if (j.target < j.min) j.target = j.min; else if (j.target > j.max) j.target = j.max;
        const step = j.speed * dt, dg = j.target - j.goal;
        j.goal = Math.abs(dg) <= step ? j.target : j.goal + (dg > 0 ? step : -step);
        stepSpring(j, j.goal, dt);
        j.hit = 0;
        if (j.x < j.min) { j.hit = -j.v; j.x = j.min; j.v = -j.v * j.bounce; }
        else if (j.x > j.max) { j.hit = j.v; j.x = j.max; j.v = -j.v * j.bounce; }
        j.moving = Math.abs(j.v) > 0.02 || Math.abs(j.goal - j.x) > 0.004;
        return j.x;
      },
      // set(alvo): define o alvo (respeita os limites)
      set(t) { j.target = clamp(t, j.min, j.max); return j; },
      // snap(ang): teleporta
      snap(a) { j.x = j.target = j.goal = clamp(a, j.min, j.max); j.v = 0; return j; },
      // kick(impulso): tranco na junta
      kick(imp) { j.v += imp; return j; },
    };
    return j;
  }

  /* ======================================================================
     2. IK
     ====================================================================== */
  // E.ik2(ax, ay, tx, ty, L1, L2, bend=1, out?) -> {ex,ey, bx,by, a1,a2, rel, reach, clamped}
  //   a1/a2 = ângulos ABSOLUTOS dos dois ossos (rel = a2-a1, pra usar como rot do filho num Rig);
  //   (bx,by) cotovelo, (ex,ey) ponta alcançada; reach = distância pedida / (L1+L2); alcance travado em [|L1-L2|, L1+L2];
  //   bend=1 dobra o cotovelo pra cima quando o alvo está à direita (anti-horário na tela), -1 pro outro lado
  function ik2(ax, ay, tx, ty, L1, L2, bend, out) {
    out = out || {};
    if (bend === undefined) bend = 1;
    const dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy), sum = L1 + L2;
    const dc = clamp(d, Math.abs(L1 - L2) * 1.001 + 1e-4, sum * 0.9995);
    const base = d > 1e-6 ? Math.atan2(dy, dx) : 0;
    const alpha = Math.acos(clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1));
    const a1 = base - bend * alpha;
    const bx = ax + Math.cos(a1) * L1, by = ay + Math.sin(a1) * L1;
    const ex = ax + Math.cos(base) * dc, ey = ay + Math.sin(base) * dc;
    const a2 = Math.atan2(ey - by, ex - bx);
    let rel = a2 - a1;
    while (rel > PI) rel -= TAU;
    while (rel < -PI) rel += TAU;
    out.a1 = a1; out.a2 = a2; out.rel = rel; out.bx = bx; out.by = by; out.ex = ex; out.ey = ey;
    out.reach = sum > 0 ? d / sum : 0; out.clamped = dc !== d;
    return out;
  }

  // E.ik3(ax, ay, tx, ty, L1, L2, L3, tip, bend=1, out?) -> {a1,a2,a3, bx,by, wx,wy, ex,ey, rel2, rel3, reach, clamped}
  //   lança + braço + caçamba: a PONTA da caçamba vai em (tx,ty) chegando com o ângulo absoluto 'tip' (você controla a báscula);
  //   (bx,by) = pino lança/braço, (wx,wy) = pino da caçamba; rel2/rel3 = ângulos relativos ao osso anterior
  function ik3(ax, ay, tx, ty, L1, L2, L3, tip, bend, out) {
    out = out || {};
    const c = Math.cos(tip), s = Math.sin(tip);
    ik2(ax, ay, tx - c * L3, ty - s * L3, L1, L2, bend, out);
    out.wx = out.ex; out.wy = out.ey;
    out.ex = out.wx + c * L3; out.ey = out.wy + s * L3;
    out.a3 = tip; out.rel2 = out.rel;
    let r3 = tip - out.a2;
    while (r3 > PI) r3 -= TAU;
    while (r3 < -PI) r3 += TAU;
    out.rel3 = r3;
    return out;
  }

  /* ======================================================================
     3. Rig
     ====================================================================== */
  const IDENT = [1, 0, 0, 1, 0, 0];
  const pa = [0, 0], pb = [0, 0], pistO = { col: null, rod: null, len: 0, max: 0, ol: undefined };

  // E.Rig() -> rig: esqueleto hierárquico de peças.
  //   Espaços: LOCAL da peça (origem no pino dela) -> MODELO (o rig antes de x,y/face/escala; onde se faz IK) -> MUNDO.
  //   Peça sem parent desenha direto no espaço do modelo (é assim que pistões e cabos ligam duas peças).
  function Rig() {
    const parts = [], order = [], byName = Object.create(null), drives = [];
    const R = [1, 0, 0, 1, 0, 0];           // matriz raiz (modelo -> mundo)
    const tmp = { x: 0, y: 0, rot: 0 };

    function need(name) {
      const p = typeof name === 'string' ? byName[name] : name;
      if (!p) throw new Error('Pixxel.Rig: peça "' + name + '" não existe');
      return p;
    }
    // matriz modelo da peça = pai * T(x,y) * R(rot) * S(sx,sy)
    function poseOne(p) {
      const c = Math.cos(p.rot), s = Math.sin(p.rot), P = p.parent ? p.parent.m : IDENT, m = p.m;
      const la = c * p.sx, lb = s * p.sx, lc = -s * p.sy, ld = c * p.sy;
      m[0] = P[0] * la + P[2] * lb; m[1] = P[1] * la + P[3] * lb;
      m[2] = P[0] * lc + P[2] * ld; m[3] = P[1] * lc + P[3] * ld;
      m[4] = P[0] * p.x + P[2] * p.y + P[4]; m[5] = P[1] * p.x + P[3] * p.y + P[5];
      p.vis = p.visible && (p.parent ? p.parent.vis : true);
    }
    function poseChain(p) { if (p.parent) poseChain(p.parent); poseOne(p); }
    function anchor(a, out) {                // [peça, lx, ly] -> ponto no modelo
      const p = a[0], m = p.m, lx = a[1] || 0, ly = a[2] || 0;
      out[0] = m[0] * lx + m[2] * ly + m[4]; out[1] = m[1] * lx + m[3] * ly + m[5];
      return out;
    }
    function resolveAnchor(a) { return [need(a[0]), a[1] || 0, a[2] || 0]; }
    function drawLink(g, p, rg, t) {
      anchor(p.a, pa); anchor(p.b, pb);
      pa[0] += p.dx; pa[1] += p.dy; pb[0] += p.dx; pb[1] += p.dy;
      p.length = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (p.max > p.min) p.ext = clamp((p.length - p.min) / (p.max - p.min), 0, 1);
      p.render(g, pa, pb, p, rg, t);
    }
    function renderPiston(g, a, b, p) {
      pistO.col = p.col; pistO.rod = p.rod; pistO.ol = p.ol;
      pistO.len = p.len || (p.min ? Math.max(p.min - p.w * 0.9, p.min * 0.6) : 0);
      pistO.max = p.max || 0;
      if (!pistO.len && !pistO.max) pistO.len = undefined;
      Draw.piston(g, a, b, p.w, pistO);
    }

    const rig = {
      parts, time: 0,
      x: 0, y: 0, face: 1, scale: 1, rot: 0,     // pose do último solve/draw

      // part(nome, {parent, x, y, rot=0, z=0, draw(g, part, rig, t), sprite, ax, ay, sx=1, sy=1, visible=true, joint, update(part,dt,rig), data}) -> part
      //   o pai precisa existir antes; sx/sy fazem parte da transformação (os filhos herdam); joint = E.Joint que comanda part.rot no rig.update
      part(name, o) {
        o = o || NO;
        if (byName[name]) throw new Error('Pixxel.Rig: peça "' + name + '" duplicada');
        const p = {
          name, parent: o.parent ? need(o.parent) : null,
          x: o.x || 0, y: o.y || 0, rot: o.rot || 0, z: o.z || 0,
          sx: o.sx !== undefined ? o.sx : 1, sy: o.sy !== undefined ? o.sy : 1,
          draw: o.draw || null, sprite: o.sprite || null, ax: o.ax, ay: o.ay,
          visible: o.visible !== false, vis: true, joint: o.joint || null, update: o.update || null,
          data: o.data || null, m: [1, 0, 0, 1, 0, 0], idx: parts.length,
        };
        if (p.joint) p.rot = p.joint.x;
        parts.push(p); order.push(p); byName[name] = p;
        poseOne(p);
        return p;
      },
      // set(nome, {rot, x, y, z, visible, ...}) -> part: altera campos da peça
      set(name, props) { const p = need(name); for (const k in props) p[k] = props[k]; return p; },
      // get(nome) -> part | undefined
      get(name) { return byName[name]; },
      // has(nome) -> bool
      has(name) { return !!byName[name]; },

      // link(nome, {a:[peça,lx,ly], b:[peça,lx,ly], z, dx, dy, render(g, a, b, part, rig, t)}) -> part
      //   elemento esticado entre dois pontos de peças diferentes (desenha no espaço do modelo); part.length = distância atual
      link(name, o) {
        const p = rig.part(name, { z: o.z, visible: o.visible });
        p.a = resolveAnchor(o.a); p.b = resolveAnchor(o.b);
        p.dx = o.dx || 0; p.dy = o.dy || 0; p.render = o.render;
        p.length = 0; p.min = o.min || 0; p.max = o.max || 0; p.ext = 0;
        p.draw = drawLink;
        return p;
      },
      // piston(nome, {a:[peça,lx,ly] (camisa), b:[peça,lx,ly] (haste), w=5, z, col, rod, len, min, max, dx, dy, ol}) -> part
      //   cilindro hidráulico que estica sozinho conforme as juntas mexem; part.length / part.ext (0..1 depois de calibrate ou min/max)
      piston(name, o) {
        const p = rig.link(name, o);
        p.w = o.w || 5; p.col = o.col || PAL.yel; p.rod = o.rod || PAL.steelL; p.len = o.len || 0; p.ol = o.ol;
        p.render = renderPiston;
        return p;
      },
      // calibrate(nome, [[peça, rotMin, rotMax], ...], passos=10) -> {min, max}: varre as juntas, mede o curso do pistão/link
      //   e fixa min/max (a camisa passa a ter comprimento constante = um pouco menos que o mínimo)
      calibrate(name, sweeps, steps) {
        const p = need(name), n = steps || 10, ps = sweeps.map(s => need(s[0])), keep = ps.map(q => q.rot);
        let mn = Infinity, mx = 0;
        (function rec(i) {
          if (i === ps.length) {
            poseChain(p.a[0]); poseChain(p.b[0]);
            anchor(p.a, pa); anchor(p.b, pb);
            const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
            if (d < mn) mn = d; if (d > mx) mx = d;
            return;
          }
          for (let k = 0; k <= n; k++) { ps[i].rot = U.lerp(sweeps[i][1], sweeps[i][2], k / n); rec(i + 1); }
        })(0);
        ps.forEach((q, i) => { q.rot = keep[i]; });
        rig.pose();
        p.min = mn; p.max = mx;
        return { min: mn, max: mx };
      },
      // drive(nome, prop, mola): liga um E.Spring/E.Joint a um campo da peça (ex.: 'y' numa cabine que balança); atualizado no rig.update
      drive(name, prop, spring) { drives.push({ p: need(name), prop, s: spring }); return spring; },

      // update(dt): avança juntas/molas ligadas às peças e chama part.update
      update(dt) {
        rig.time += dt;
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          if (p.joint) p.rot = p.joint.update(dt);
          if (p.update) p.update(p, dt, rig);
        }
        for (let i = 0; i < drives.length; i++) { const d = drives[i]; d.p[d.prop] = d.s.update(dt); }
      },
      // pose(): recalcula as matrizes de todas as peças no espaço do modelo (sem mexer na raiz)
      pose() { for (let i = 0; i < parts.length; i++) poseOne(parts[i]); return rig; },
      // solve(x, y, face=1, scale=1, rot=0): calcula tudo sem desenhar (depois world() responde no mundo)
      solve(x, y, face, scale, rot) {
        face = face === undefined ? 1 : face; scale = scale === undefined ? 1 : scale; rot = rot || 0;
        rig.x = x || 0; rig.y = y || 0; rig.face = face; rig.scale = scale; rig.rot = rot;
        const c = Math.cos(rot), s = Math.sin(rot);
        R[0] = c * face * scale; R[1] = s * face * scale; R[2] = -s * scale; R[3] = c * scale; R[4] = rig.x; R[5] = rig.y;
        return rig.pose();
      },
      // draw(g, x, y, {face=1, scale=1, rot=0, t}): resolve e desenha as peças por ordem de z (empate = ordem de criação)
      //   face pode ser fracionário (-1..1) pra animar uma virada
      draw(g, x, y, o) {
        o = o || NO;
        rig.solve(x, y, o.face, o.scale, o.rot);
        const t = o.t !== undefined ? o.t : rig.time;
        // ordenação por inserção (estável e quase O(n) quando já está em ordem)
        for (let i = 1; i < order.length; i++) {
          const p = order[i]; let k = i - 1;
          while (k >= 0 && (order[k].z > p.z || (order[k].z === p.z && order[k].idx > p.idx))) { order[k + 1] = order[k]; k--; }
          order[k + 1] = p;
        }
        g.save();
        g.transform(R[0], R[1], R[2], R[3], R[4], R[5]);
        for (let i = 0; i < order.length; i++) {
          const p = order[i], m = p.m;
          if (!p.vis || (!p.draw && !p.sprite)) continue;
          g.save();
          g.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
          if (p.sprite) {
            g.imageSmoothingEnabled = false;
            const cv = p.sprite;
            g.drawImage(cv, -(p.ax !== undefined ? p.ax : cv.width / 2), -(p.ay !== undefined ? p.ay : cv.height));
          }
          if (p.draw) p.draw(g, p, rig, t);
          g.restore();
        }
        g.restore();
      },

      // model(nome, lx=0, ly=0, out?) -> {x,y,rot}: ponto local da peça no espaço do MODELO (sempre atual; use pra IK e âncoras)
      model(name, lx, ly, out) {
        const p = need(name), m = p.m; out = out || {};
        poseChain(p);
        lx = lx || 0; ly = ly || 0;
        out.x = m[0] * lx + m[2] * ly + m[4]; out.y = m[1] * lx + m[3] * ly + m[5];
        out.rot = Math.atan2(m[1], m[0]);
        return out;
      },
      // world(nome, lx=0, ly=0, out?) -> {x,y,rot}: ponto local da peça no MUNDO (usa x,y/face/escala do último solve/draw)
      world(name, lx, ly, out) {
        out = rig.model(name, lx, ly, out);
        const mx = out.x, my = out.y, p = byName[typeof name === 'string' ? name : name.name].m;
        out.x = R[0] * mx + R[2] * my + R[4]; out.y = R[1] * mx + R[3] * my + R[5];
        out.rot = Math.atan2(R[1] * p[0] + R[3] * p[1], R[0] * p[0] + R[2] * p[1]);
        return out;
      },
      // toModel(wx, wy, out?) -> {x,y}: ponto do mundo -> espaço do modelo (ex.: alvo do mouse pra IK)
      toModel(wx, wy, out) {
        out = out || {};
        const det = R[0] * R[3] - R[1] * R[2] || 1e-9, dx = wx - R[4], dy = wy - R[5];
        out.x = (R[3] * dx - R[2] * dy) / det; out.y = (-R[1] * dx + R[0] * dy) / det;
        return out;
      },
      // toLocal(nome, wx, wy, out?) -> {x,y}: ponto do mundo -> espaço local da peça
      toLocal(name, wx, wy, out) {
        const p = need(name), m = p.m;
        poseChain(p);
        out = rig.toModel(wx, wy, out);
        const det = m[0] * m[3] - m[1] * m[2] || 1e-9, dx = out.x - m[4], dy = out.y - m[5];
        out.x = (m[3] * dx - m[2] * dy) / det; out.y = (-m[1] * dx + m[0] * dy) / det;
        return out;
      },
      // dist(nomeA, lxA, lyA, nomeB, lxB, lyB) -> distância entre dois pontos de peças (espaço do modelo)
      dist(a, ax, ay, b, bx, by) {
        rig.model(a, ax, ay, tmp); const x0 = tmp.x, y0 = tmp.y;
        rig.model(b, bx, by, tmp);
        return Math.hypot(tmp.x - x0, tmp.y - y0);
      },
    };
    return rig;
  }

  /* ======================================================================
     4. Rig.* — peças prontas de desenho (coordenadas locais; mesmo contorno e cores chapadas do Draw)
     ====================================================================== */
  // Rig.pin(g, x, y, r, {col=aço, ol}): pino de articulação (disco de aço com miolo escuro)
  Rig.pin = function (g, x, y, r, o) {
    o = o || NO;
    const col = o.col || PAL.steel, ol = olW(o) * 0.6;
    g.fillStyle = LINE; g.beginPath(); g.arc(x, y, r + ol, 0, TAU); g.fill();
    g.fillStyle = sh(col, -0.3); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x - r * 0.12, y - r * 0.14, r * 0.8, 0, TAU); g.fill();
    g.fillStyle = LINE; g.beginPath(); g.arc(x, y, Math.max(0.5, r * 0.36), 0, TAU); g.fill();
  };

  // caminho da união de cápsulas afinadas entre os nós [x,y,r] (grow = engorda)
  function platePath(g, pts, grow) {
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], r = p[2] + grow;
      g.moveTo(p[0] + r, p[1]); g.arc(p[0], p[1], r, 0, TAU);
      if (i + 1 < pts.length) {
        const q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
        if (L < 1e-6) continue;
        const r2 = q[2] + grow, nx = -dy / L, ny = dx / L;
        // mesmo sentido dos arcos (horário), senão a regra nonzero abre um buraco onde eles se cruzam
        g.moveTo(p[0] - nx * r, p[1] - ny * r); g.lineTo(q[0] - nx * r2, q[1] - ny * r2);
        g.lineTo(q[0] + nx * r2, q[1] + ny * r2); g.lineTo(p[0] + nx * r, p[1] + ny * r); g.closePath();
      }
    }
  }
  function plateEdge(g, pts, k, side) {     // faixa paralela à linha dos nós, a k*raio do centro
    g.beginPath();
    for (let i = 0; i + 1 < pts.length; i++) {
      const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      let nx = dy / L, ny = -dx / L;
      if (ny > 0) { nx = -nx; ny = -ny; }
      nx *= side; ny *= side;
      g.moveTo(p[0] + nx * p[2] * k, p[1] + ny * p[2] * k); g.lineTo(q[0] + nx * q[2] * k, q[1] + ny * q[2] * k);
    }
  }
  // Rig.plate(g, pts, col, {ol, hi=true, shade=true, side=1}): braço/lança de chapa. pts = [[x,y,raio], ...] (2+ nós);
  //   a largura varia de nó a nó (grosso no meio, fino nas pontas = nada de "vara"); side=-1 troca o lado da luz
  Rig.plate = function (g, pts, col, o) {
    o = o || NO;
    const ol = olW(o), side = o.side || 1;
    g.lineJoin = 'round';
    if (ol > 0) { platePath(g, pts, ol); g.fillStyle = LINE; g.fill(); }
    platePath(g, pts, 0); g.fillStyle = col; g.fill();
    if (o.hi === false && o.shade === false) return;
    let rm = 0;
    for (let i = 0; i < pts.length; i++) if (pts[i][2] > rm) rm = pts[i][2];
    g.save(); platePath(g, pts, 0); g.clip();
    g.lineCap = 'butt';
    if (o.shade !== false) { plateEdge(g, pts, 0.78, -side); g.strokeStyle = typeof o.shade === 'string' ? o.shade : sh(col, -0.22); g.lineWidth = rm * 0.5; g.stroke(); }
    if (o.hi !== false) { plateEdge(g, pts, 0.8, side); g.strokeStyle = typeof o.hi === 'string' ? o.hi : sh(col, 0.3); g.lineWidth = rm * 0.4; g.stroke(); }
    g.restore();
  };

  // Rig.mound(g, x, y, hw, h, {col=arroz, shade, ol, grains=true}): montinho (de arroz) com base em (x,y), meia-largura hw e altura h
  Rig.mound = function (g, x, y, hw, h, o) {
    o = o || NO;
    const col = o.col || PAL.rice, lo = o.shade || PAL.riceS, ol = olW(o) * 0.8;
    g.beginPath();
    g.moveTo(x - hw, y); g.bezierCurveTo(x - hw * 0.72, y - h * 1.32, x + hw * 0.72, y - h * 1.32, x + hw, y); g.closePath();
    if (ol > 0) { g.strokeStyle = LINE; g.lineWidth = ol * 2; g.lineJoin = 'round'; g.stroke(); }
    g.fillStyle = lo; g.fill();
    g.beginPath();
    g.moveTo(x - hw, y); g.bezierCurveTo(x - hw * 0.74, y - h * 1.3, x + hw * 0.3, y - h * 1.36, x + hw * 0.52, y); g.closePath();
    g.fillStyle = col; g.fill();
    if (o.grains !== false && hw > 3) {
      g.fillStyle = PAL.riceD;
      g.fillRect(x + hw * 0.3, y - h * 0.3, hw * 0.16, Math.max(0.7, h * 0.07));
      g.fillRect(x - hw * 0.1, y - h * 0.52, hw * 0.14, Math.max(0.7, h * 0.07));
      g.fillRect(x - hw * 0.55, y - h * 0.2, hw * 0.14, Math.max(0.7, h * 0.07));
      g.fillStyle = PAL.white;
      g.fillRect(x - hw * 0.34, y - h * 0.72, hw * 0.26, Math.max(0.8, h * 0.09));
    }
  };

  const BK_LOADER = [[-7, -22], [5, -27], [10, -23], [34, 3], [31, 8], [5, 9], [-4, 6], [-8, -2]];
  const BK_EXC = [[-5, -3], [-1, -12], [9, -17], [20, -14], [27, -5], [29, 2], [22, 3], [5, 4], [-3, 3]];
  const bkPts = [], bkO = { ol: undefined }, moundO = { col: null, shade: null, ol: undefined }, pulO = { col: null };
  // Rig.bucket(g, s, {kind='loader'|'excavator', col, load=0..1, teeth=true, cargo=cor, ol}): caçamba de perfil com o pino em (0,0)
  //   loader: comprimento ~s, boca pra cima/frente (+x); excavator: eixo x = pino -> dente (comprimento s), boca do lado +y
  Rig.bucket = function (g, s, o) {
    o = o || NO;
    const exc = o.kind === 'excavator', src = exc ? BK_EXC : BK_LOADER, k = s / (exc ? 29 : 34);
    const col = o.col || PAL.yel, load = o.load || 0, ol = olW(o);
    while (bkPts.length < src.length) bkPts.push([0, 0]);
    bkPts.length = src.length;
    for (let i = 0; i < src.length; i++) { bkPts[i][0] = src[i][0] * k; bkPts[i][1] = src[i][1] * k; }
    // carga aparecendo pela boca (atrás da chapa lateral)
    if (load > 0.02) {
      const a = exc ? src[7] : src[2], b = exc ? src[5] : src[3];   // boca: do fundo/topo até o dente
      const ax = a[0] * k, ay = a[1] * k, bx = b[0] * k, by = b[1] * k, L = Math.hypot(bx - ax, by - ay);
      let nx = (by - ay) / L, ny = -(bx - ax) / L;
      if (exc) { nx = -nx; ny = -ny; }
      const hgt = L * 0.42 * load, mx = (ax + bx) / 2, my = (ay + by) / 2;
      g.beginPath(); g.moveTo(ax, ay);
      g.quadraticCurveTo(mx + nx * hgt * 2 - (bx - ax) * 0.12, my + ny * hgt * 2 - (by - ay) * 0.12, bx - (bx - ax) * 0.06, by - (by - ay) * 0.06);
      g.lineTo(mx - nx * L * 0.2, my - ny * L * 0.2); g.closePath();
      g.lineJoin = 'round'; g.strokeStyle = LINE; g.lineWidth = ol * 1.6; g.stroke();
      g.fillStyle = o.cargo || PAL.rice; g.fill();
      g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx + nx * hgt * 1.5 + (bx - ax) * 0.2, my + ny * hgt * 1.5 + (by - ay) * 0.2, bx - (bx - ax) * 0.06, by - (by - ay) * 0.06); g.closePath();
      g.fillStyle = o.cargoShade || PAL.riceS; g.fill();
    }
    // dentes
    if (o.teeth !== false) {
      const t = exc ? src[5] : src[3], tx = t[0] * k, ty = t[1] * k;
      g.beginPath();
      if (exc) { g.moveTo(tx - 4 * k, ty - 4 * k); g.lineTo(tx + 5 * k, ty + 4 * k); g.lineTo(tx - 5 * k, ty + 1 * k); }
      else { g.moveTo(tx - 4 * k, ty - 2 * k); g.lineTo(tx + 7 * k, ty + 3 * k); g.lineTo(tx - 3 * k, ty + 4 * k); }
      g.closePath();
      g.lineJoin = 'round'; g.strokeStyle = LINE; g.lineWidth = ol * 2; g.stroke();
      g.fillStyle = PAL.steel; g.fill();
    }
    bkO.ol = o.ol; Draw.poly(g, bkPts, col, bkO);
    // volume: sombra na barriga, luz na borda de cima, reforço da boca
    g.save();
    g.beginPath(); for (let i = 0; i < bkPts.length; i++) { if (i) g.lineTo(bkPts[i][0], bkPts[i][1]); else g.moveTo(bkPts[0][0], bkPts[0][1]); }
    g.closePath(); g.clip();
    g.lineCap = 'butt';
    if (exc) {
      g.strokeStyle = sh(col, -0.24); g.lineWidth = 5 * k;
      g.beginPath(); g.moveTo(-1 * k, -12 * k); g.quadraticCurveTo(12 * k, -20 * k, 22 * k, -13 * k); g.quadraticCurveTo(28 * k, -8 * k, 30 * k, 0); g.stroke();
      g.strokeStyle = sh(col, 0.3); g.lineWidth = 2.4 * k;
      g.beginPath(); g.moveTo(-3 * k, 2.4 * k); g.lineTo(26 * k, 2 * k); g.stroke();
    } else {
      g.strokeStyle = sh(col, -0.24); g.lineWidth = 6 * k;
      g.beginPath(); g.moveTo(-9 * k, -4 * k); g.quadraticCurveTo(-6 * k, 8.5 * k, 6 * k, 8.5 * k); g.lineTo(32 * k, 8 * k); g.stroke();
      g.strokeStyle = sh(col, 0.3); g.lineWidth = 3 * k;
      g.beginPath(); g.moveTo(-7 * k, -21 * k); g.lineTo(5 * k, -26 * k); g.lineTo(10.5 * k, -22 * k); g.lineTo(34 * k, 4 * k); g.stroke();
    }
    g.restore();
  };

  // Rig.pulley(g, x, y, r, rot, {col=amarelo, holes=4, ol}): polia/roldana com furos que giram (rot em radianos)
  Rig.pulley = function (g, x, y, r, rot, o) {
    o = o || NO;
    const col = o.col || PAL.yel, ol = olW(o) * 0.75, holes = o.holes !== undefined ? o.holes : 4;
    g.fillStyle = LINE; g.beginPath(); g.arc(x, y, r + ol, 0, TAU); g.fill();
    g.fillStyle = sh(col, -0.26); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x - r * 0.07, y - r * 0.09, r * 0.88, 0, TAU); g.fill();
    g.strokeStyle = sh(col, -0.3); g.lineWidth = Math.max(0.6, r * 0.1);
    g.beginPath(); g.arc(x, y, r * 0.78, 0, TAU); g.stroke();
    if (holes > 0 && r * (Draw.zoom || 1) > 2.5) {
      const hr = r * 0.17, hd = r * 0.46;
      g.fillStyle = LINE; g.beginPath();
      for (let i = 0; i < holes; i++) {
        const a = rot + i / holes * TAU, hx = x + Math.cos(a) * hd, hy = y + Math.sin(a) * hd;
        g.moveTo(hx + hr, hy); g.arc(hx, hy, hr, 0, TAU);
      }
      g.fill();
    }
    g.fillStyle = LINE; g.beginPath(); g.arc(x, y, r * 0.24 + ol * 0.4, 0, TAU); g.fill();
    g.fillStyle = PAL.steelL; g.beginPath(); g.arc(x, y, r * 0.2, 0, TAU); g.fill();
  };

  /* ======================================================================
     5. Rope — cabo que passa por polias
     ====================================================================== */
  // E.Rope({pts:[{x,y,r=0,over=1,sag}], lw=1.5, col=LINE, sag=0, pulleys=true, pulleyCol, fixed='end'|'start'}) -> rope
  //   pts: primeiro e último são as pontas (r=0) ou tambores (r>0); os do meio são polias de raio r.
  //   over=1: o cabo passa por CIMA da polia quando vai da esquerda pra direita; -1 por baixo.
  //   (indo da direita pra esquerda inverte: over=-1 passa por cima.)
  //   Mexa em rope.pts[i].x/.y a cada frame e chame update(dt): calcula as tangentes, o comprimento (rope.length),
  //   o cabo pago desde o início (rope.payout) e gira cada polia pelo cabo que passou nela (pts[i].rot).
  //   fixed='end': o cabo corre a partir do tambor (pts[0]) e a ponta final está presa na carga; 'start' é o contrário.
  //   sag: barriga (unidades no meio do vão) pros vãos frouxos; pts[i].sag vale pro vão que sai do ponto i. rope.sway = mola de balanço lateral.
  function Rope(o) {
    o = o || NO;
    const src = o.pts || [], n = src.length;
    const pts = src.map(p => ({ x: p.x || 0, y: p.y || 0, r: p.r || 0, over: p.over === undefined ? 1 : p.over, sag: p.sag, rot: 0,
      ix: 0, iy: 0, ox: 0, oy: 0, a0: 0, sweep: 0, seg: 0, down: 0, pdown: NaN }));
    const rope = {
      pts, lw: o.lw || 1.5, col: o.col || LINE, sag: o.sag || 0, ol: o.ol || 0,
      pulleys: o.pulleys !== false, pulleyCol: o.pulleyCol || PAL.yel, fixed: o.fixed || 'end',
      length: 0, length0: NaN, payout: 0, speed: 0,
      sway: Spring(0, { k: o.swayK !== undefined ? o.swayK : 50, d: o.swayD !== undefined ? o.swayD : 4 }),
      pvx: 0, plx: NaN,
      // solve(): recalcula tangentes e comprimentos (sem girar polias)
      solve() {
        let total = 0;
        for (let i = 0; i + 1 < n; i++) {
          const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1e-6;
          const c = p.over * p.r - q.over * q.r, th = Math.acos(clamp(c / L, -1, 1));
          const b = Math.atan2(dy, dx) - th, nx = Math.cos(b), ny = Math.sin(b);
          p.ox = p.x + p.over * p.r * nx; p.oy = p.y + p.over * p.r * ny;
          q.ix = q.x + q.over * q.r * nx; q.iy = q.y + q.over * q.r * ny;
          p.seg = Math.hypot(q.ix - p.ox, q.iy - p.oy);
          total += p.seg;
        }
        for (let i = 1; i + 1 < n; i++) {
          const p = pts[i];
          if (!(p.r > 0)) { p.sweep = 0; continue; }
          const a0 = Math.atan2(p.iy - p.y, p.ix - p.x), a1 = Math.atan2(p.oy - p.y, p.ox - p.x);
          let sw = p.over > 0 ? a1 - a0 : a0 - a1;
          sw = ((sw % TAU) + TAU) % TAU;
          if (sw > TAU * 0.8) sw = 0;          // quase zero dando a volta: não abraça
          p.a0 = a0; p.sweep = sw;
          total += sw * p.r;
        }
        // comprimento a jusante de cada ponto (pra girar as polias)
        let acc = 0;
        for (let i = n - 1; i >= 0; i--) {
          const p = pts[i];
          if (i < n - 1) acc += p.seg;
          p.down = acc;
          if (i > 0 && i < n - 1) acc += p.sweep * p.r;
        }
        rope.length = total;
        return rope;
      },
      // update(dt): solve + gira polias pelo cabo que passou + balanço
      update(dt) {
        rope.solve();
        if (rope.length0 !== rope.length0) rope.length0 = rope.length;
        const prev = rope.payout;
        rope.payout = rope.length - rope.length0;
        rope.speed = dt > 0 ? (rope.payout - prev) / dt : 0;
        const fromStart = rope.fixed !== 'start';
        for (let i = 0; i < n; i++) {
          const p = pts[i];
          const run = fromStart ? p.down : rope.length - p.down;
          if (p.pdown === p.pdown && p.r > 0) p.rot += (fromStart ? 1 : -1) * p.over * (run - p.pdown) / p.r;
          p.pdown = run;
        }
        const last = pts[n - 1];
        if (last && dt > 0) {
          const vx = rope.plx === rope.plx ? (last.x - rope.plx) / dt : 0;
          rope.sway.kick(-(vx - rope.pvx) * 0.05);
          rope.pvx = vx; rope.plx = last.x;
        }
        rope.sway.update(dt);
        return rope;
      },
      // draw(g): cabo (com barriga/balanço) e as polias por cima
      draw(g) {
        if (n < 2) return;
        const m = (Draw.minPx || 0) / (Draw.zoom || 1), lw = rope.lw > m ? rope.lw : m, sway = rope.sway.x;
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(pts[0].ox, pts[0].oy);
        for (let i = 0; i + 1 < n; i++) {
          const p = pts[i], q = pts[i + 1], sag = p.sag !== undefined ? p.sag : rope.sag;
          const sw = sway * Math.min(1, p.seg / 60);
          if (sag || Math.abs(sw) > 0.05) g.quadraticCurveTo((p.ox + q.ix) / 2 + sw * 2, (p.oy + q.iy) / 2 + sag * 2, q.ix, q.iy);
          else g.lineTo(q.ix, q.iy);
          if (i + 2 < n && q.r > 0 && q.sweep > 0) g.arc(q.x, q.y, q.r, q.a0, q.a0 + (q.over > 0 ? q.sweep : -q.sweep), q.over < 0);
        }
        if (rope.ol > 0) { g.strokeStyle = LINE; g.lineWidth = lw + rope.ol * 2; g.stroke(); }
        g.strokeStyle = rope.col; g.lineWidth = lw; g.stroke();
        if (rope.pulleys) for (let i = 0; i < n; i++) { const p = pts[i]; if (p.r > 0 && p.draw !== false) { pulO.col = p.col || rope.pulleyCol; Rig.pulley(g, p.x, p.y, p.r + lw * 0.9, p.rot, pulO); } }
      },
    };
    rope.solve();
    return rope;
  }

  /* ======================================================================
     6. Telescope — mastro/cilindro telescópico
     ====================================================================== */
  // E.Telescope({stages=2, len=40, w=8, overlap=.2, taper=.74, col, cols, rod, sequential=false}) -> tel
  //   estágio 0 é o de fora (fixo na base); cada estágio seguinte desliza pra fora. tel.ext = 0..1 (ou passe no draw).
  //   draw(g, x, y, ang, ext?) desenha a partir da base (x,y) apontando pra 'ang' (-PI/2 = pra cima);
  //   tip(x, y, ang, out?) -> {x,y} ponta; stage(i, x, y, ang, out?) -> topo do estágio i; length() comprimento atual; max
  //   sequential: estende um estágio de cada vez (cilindro de basculante); cols = cores por estágio; rod = cor do último (haste cromada)
  function Telescope(o) {
    o = o || NO;
    const n = Math.max(1, o.stages || 2), len = o.len || 40, w = o.w || 8, ov = o.overlap !== undefined ? o.overlap : 0.2;
    const taper = o.taper || 0.74, col = o.col || PAL.yel, seq = !!o.sequential;
    const collar = Math.max(2, w * 0.34), step0 = collar * 1.25, step1 = len * (1 - ov);
    const cols = [];
    for (let i = 0; i < n; i++) cols.push(o.cols && o.cols[i] ? o.cols[i] : i === n - 1 && n > 1 && o.rod !== false ? (o.rod || PAL.steelL) : i === 0 ? col : mixc(col, PAL.steel, Math.min(0.75, 0.38 * i)));
    const boxO = { ol: undefined, top: undefined, shade: undefined };
    const tel = {
      stages: n, len, w, ext: 0, max: (n - 1) * step1 + len, min: (n - 1) * step0 + len,
      // offset(i, ext?) -> distância da base até o início do estágio i
      offset(i, ext) {
        ext = clamp(ext === undefined ? tel.ext : ext, 0, 1);
        let off = 0;
        for (let k = 1; k <= i; k++) off += U.lerp(step0, step1, seq ? clamp(ext * (n - 1) - (k - 1), 0, 1) : ext);
        return off;
      },
      // length(ext?) -> comprimento total atual
      length(ext) { return tel.offset(n - 1, ext) + len; },
      // tip(x, y, ang, out?, ext?) -> {x,y}
      tip(x, y, ang, out, ext) { return tel.stage(n - 1, x, y, ang, out, ext); },
      // stage(i, x, y, ang, out?, ext?) -> {x,y}: topo do estágio i
      stage(i, x, y, ang, out, ext) {
        out = out || {};
        const d = tel.offset(i, ext) + len;
        out.x = x + Math.cos(ang) * d; out.y = y + Math.sin(ang) * d;
        return out;
      },
      // draw(g, x, y, ang, ext?)
      draw(g, x, y, ang, ext) {
        boxO.ol = o.ol;
        g.save(); g.translate(x, y); g.rotate(ang);
        if (Math.cos(ang) < -0.01) g.scale(1, -1);
        for (let i = n - 1; i >= 0; i--) {
          const wi = w * Math.pow(taper, i), off = tel.offset(i, ext), c = cols[i];
          Draw.box(g, off, -wi / 2, len, wi, c, boxO);
          if (i < n - 1 || n === 1) Draw.box(g, off + len - collar, -wi * 0.62, collar, wi * 1.24, sh(c, -0.12), boxO);   // colar/gaxeta
          else Draw.box(g, off + len - collar * 0.7, -wi * 0.6, collar * 0.7, wi * 1.2, sh(c, -0.2), boxO);                 // cabeça
        }
        g.restore();
      },
    };
    return tel;
  }

  /* ======================================================================
     7. Chassis — rodas no terreno, inclinação e suspensão
     ====================================================================== */
  // E.Chassis({wheels:[{x, r, travel=5}], floor(x)->y, k=150, d=13, tiltK=110, tiltD=11, squat=.0016, face=1}) -> ch
  //   update(dt, x, face?): apoia cada roda no chão (encosta no ponto mais alto embaixo dela), tira daí a altura e a inclinação
  //   da carroceria (com molas: atrasa, afunda e balança) e a compressão de cada suspensão.
  //   Saída: ch.x, ch.y, ch.tilt (use em rig.draw(g, ch.x, ch.y, {rot: ch.tilt, face})), ch.vx, ch.ax,
  //          ch.wheels[i] = {lx, ly (posição no MODELO pra peça da roda), rot, comp (>0 comprimida), wx, wy (mundo)}
  //   squat: quanto a aceleração empina/mergulha a carroceria; ch.load = peso extra (afunda 'load' unidades);
  //   ch.bias = inclinação extra em rad (>0 = nariz pra baixo: carga pendurada na frente);
  //   bump(v) tranco vertical, nod(v) tranco de inclinação (ex.: caçamba bateu no monte)
  function Chassis(o) {
    o = o || NO;
    const floorF = typeof o.floor === 'function' ? o.floor : () => o.floor || 0;
    const wheels = (o.wheels || []).map(w => ({ x: w.x || 0, r: w.r || 10, travel: w.travel !== undefined ? w.travel : 5,
      lx: w.x || 0, ly: -(w.r || 10), rot: 0, comp: 0, wx: 0, wy: 0 }));
    let iL = 0, iR = 0;
    for (let i = 0; i < wheels.length; i++) { if (wheels[i].x < wheels[iL].x) iL = i; if (wheels[i].x > wheels[iR].x) iR = i; }
    const ch = {
      wheels, floor: floorF, x: 0, y: 0, tilt: 0, vx: 0, ax: 0, face: o.face || 1, load: 0, bias: 0,
      squat: o.squat !== undefined ? o.squat : 0.0016,
      heave: Spring(0, { k: o.k !== undefined ? o.k : 150, d: o.d !== undefined ? o.d : 13 }),
      lean: Spring(0, { k: o.tiltK !== undefined ? o.tiltK : 110, d: o.tiltD !== undefined ? o.tiltD : 11 }),
      started: false,
      // bump(v): tranco vertical (v>0 afunda)
      bump(v) { ch.heave.kick(v); return ch; },
      // nod(v): tranco de inclinação (rad/s; v>0 gira no sentido horário da tela)
      nod(v) { ch.lean.kick(v); return ch; },
      // update(dt, x, face?)
      update(dt, x, face) {
        if (face !== undefined) ch.face = face;
        const f = ch.face < 0 ? -1 : 1;
        let dx = ch.started ? x - ch.x : 0;
        if (Math.abs(dx) > 240) dx = 0;                        // teleporte: não vira velocidade
        const vx = dt > 0 ? dx / dt : 0;
        ch.ax = dt > 0 ? U.lerp(ch.ax, (vx - ch.vx) / dt, 0.35) : 0;
        ch.vx = vx; ch.x = x;
        for (let i = 0; i < wheels.length; i++) {
          const w = wheels[i], cx = x + f * w.x, r = w.r;
          let cy = Infinity;
          for (let k = -2; k <= 2; k++) {                      // a roda apoia no calombo mais alto embaixo dela
            const ox = k * 0.36 * r, y = floorF(cx + ox) - Math.sqrt(r * r - ox * ox);
            if (y < cy) cy = y;
          }
          w.wx = cx; w.wy = cy;
          w.rot += f * dx / r;
        }
        let Y = 0, T = 0;
        if (wheels.length) {
          const a = wheels[f > 0 ? iL : iR], b = wheels[f > 0 ? iR : iL];   // a = mais à esquerda no mundo
          const ya = a.wy + a.r, yb = b.wy + b.r, span = b.wx - a.wx;
          if (span > 1e-3) { T = Math.atan2(yb - ya, span); Y = ya + (x - a.wx) * (yb - ya) / span; }
          else Y = ya;
        }
                T += f * ch.bias;
        if (!ch.started) { ch.heave.snap(Y + ch.load); ch.lean.snap(T); ch.started = true; }
        ch.heave.target = Y + ch.load; ch.lean.target = T;
        ch.lean.kick(-ch.ax * ch.squat * dt);
        ch.y = ch.heave.update(dt); ch.tilt = ch.lean.update(dt);
        const c = Math.cos(ch.tilt), s = Math.sin(ch.tilt);
        for (let i = 0; i < wheels.length; i++) {
          const w = wheels[i], ddx = w.wx - ch.x, ddy = w.wy - ch.y;
          const ly = -ddx * s + ddy * c;
          w.comp = clamp(-w.r - ly, -w.travel, w.travel);
          w.lx = w.x; w.ly = -w.r - w.comp;
        }
        return ch;
      },
    };
    return ch;
  }

  /* ======================================================================
     8. Exhaust — escapamento em pulsos
     ====================================================================== */
  // E.Exhaust({max=28, col, size=3, rate=5, rise=34, wind=0, life=1.3, ol=true}) -> ex
  //   update(dt, x, y, power=0, dirX=0, dirY=-1): solta baforadas ritmadas na boca do cano (x,y no mundo); power 0..1 acelera o
  //   ritmo, engrossa e escurece a fumaça. ex.pulse = 1 no instante da baforada e decai (use pra tremer capô/tampa do cano).
  //   burst(n, power?) solta n de uma vez (arrancada). draw(g) desenha no mundo (chame fora do rig).
  function Exhaust(o) {
    o = o || NO;
    const max = o.max || 28, F = 8;                       // x, y, vx, vy, idade, vida, tamanho, tom
    const D = new Float32Array(max * F);
    const col = o.col || PAL.grayL, colD = o.colD || PAL.gray;
    // E.Exhaust.tint = [cor, corEscura] troca a cor de TODAS as fumaças (ex.: upgrade Diesel Premium deixa azul); null volta ao normal
    let tones, tonesL, tonesO, tintNow;
    function retint() {
      const t = Exhaust.tint, c1 = t ? t[0] : col, c2 = t ? t[1] : colD;
      tones = [0, 1, 2, 3].map(i => mixc(c1, c2, i / 3)); tonesL = tones.map(c => sh(c, 0.35)); tonesO = tones.map(c => mixc(c, LINE, 0.45)); tintNow = t;
    }
    retint();
    let head = 0, acc = 0, lx = 0, ly = 0, ldx = 0, ldy = -1, lpow = 0;
    function spawn(x, y, dx, dy, power) {
      const i = head * F; head = (head + 1) % max;
      const sp = 26 + 70 * power + Math.random() * 14;
      D[i] = x; D[i + 1] = y;
      D[i + 2] = dx * sp + (Math.random() - 0.5) * 12; D[i + 3] = dy * sp + (Math.random() - 0.5) * 8;
      D[i + 4] = 0; D[i + 5] = ex.life * (0.75 + Math.random() * 0.5) * (1 + power * 0.35);
      D[i + 6] = ex.size * (0.8 + Math.random() * 0.45) * (1 + power * 0.8);
      D[i + 7] = Math.min(3, Math.round(power * 3 + Math.random() * 0.8));
    }
    const ex = {
      size: o.size || 3, rate: o.rate || 5, rise: o.rise !== undefined ? o.rise : 34, wind: o.wind || 0,
      life: o.life || 1.3, pulse: 0, count: 0, ol: o.ol !== false,
      // update(dt, x, y, power=0, dirX=0, dirY=-1)
      update(dt, x, y, power, dx, dy) {
        if (Exhaust.tint !== tintNow) retint();
        power = clamp(power || 0, 0, 1);
        lx = x; ly = y; ldx = dx || 0; ldy = dy === undefined ? -1 : dy; lpow = power;
        ex.pulse = Math.max(0, ex.pulse - dt * 7);
        acc += dt * ex.rate * (1 + power * 2.4);
        while (acc >= 1) { acc -= 1; spawn(x, y, ldx, ldy, power); ex.pulse = 1; }
        const drag = Math.exp(-2.6 * dt);
        let cnt = 0;
        for (let i = 0; i < max * F; i += F) {
          if (!(D[i + 5] > 0)) continue;
          D[i + 4] += dt;
          if (D[i + 4] >= D[i + 5]) { D[i + 5] = 0; continue; }
          D[i + 2] = D[i + 2] * drag + ex.wind * dt; D[i + 3] = D[i + 3] * drag - ex.rise * dt;
          D[i] += D[i + 2] * dt; D[i + 1] += D[i + 3] * dt;
          cnt++;
        }
        ex.count = cnt;
      },
      // burst(n, power=1): baforada grossa (arrancada, esforço)
      burst(n, power) { for (let i = 0; i < n; i++) spawn(lx, ly, ldx, ldy, power === undefined ? 1 : power); ex.pulse = 1; },
      // clear()
      clear() { D.fill(0); ex.count = 0; },
      // draw(g)
      draw(g) {
        const ol = ex.ol ? Math.max(0.7, olW(NO) * 0.45) : 0;
        for (let pass = 0; pass < 3; pass++) {              // 3 passes (contorno, base, luz) pra fumaça fundir numa nuvem só
          if (pass === 0 && !ol) continue;
          for (let k = 0; k < max; k++) {
            const i = ((head + k) % max) * F;               // do mais velho pro mais novo
            if (!(D[i + 5] > 0)) continue;
            const u = D[i + 4] / D[i + 5], tone = D[i + 7] | 0;
            const grow = 0.55 + 1.7 * (1 - (1 - u) * (1 - u)), fade = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
            const r = D[i + 6] * grow * (0.35 + 0.65 * fade);
            if (r < 0.3) continue;
            const x = D[i], y = D[i + 1];
            g.beginPath();
            if (pass === 0) { g.fillStyle = tonesO[tone]; g.arc(x, y, r + ol, 0, TAU); }
            else if (pass === 1) { g.fillStyle = tones[tone]; g.arc(x, y, r, 0, TAU); }
            else { g.fillStyle = tonesL[tone]; g.arc(x - r * 0.22, y - r * 0.26, r * 0.55, 0, TAU); }
            g.fill();
          }
        }
      },
    };
    return ex;
  }

  /* ======================================================================
     9. Conveyor — esteira transportadora
     ====================================================================== */
  const cvP = { x: 0, y: 0, nx: 0, ny: -1, ang: 0 };
  const legA = [[0, 0], [0, 0]], legO = { ol: undefined, cap: 'butt' };

  // E.Conveyor(pts, {w=10, speed=60, col, frame, items=true, legs=true, floor, rollers, accel=3, cargo, cargoShade, maxV=2.2, drawItem}) -> cv
  //   pts = [[x,y], ...] linha de centro da correia (do carregamento até a ponta de despejo). speed em unidades/s (negativo inverte).
  //   put(v=1, s=0): põe um montinho de volume v a s unidades do início (funde com o vizinho se cair em cima);
  //   onDrop(fn(v, x, y, vx, vy)): chamado quando um montinho cai da ponta; end() -> {x,y} ponto de queda; start() -> {x,y} de carga;
  //   running (liga/desliga com rampa), v (velocidade atual), phase, load (volume em cima), count, length, pointAt(s) -> {x,y,nx,ny,ang};
  //   floor (número ou fn(x)->y) = onde os pés de apoio encostam; drawItem(g, x, y, v, ang, item) troca o desenho da carga;
  //   draw(g, t) desenha tudo; ou em camadas: drawBack(g) (pés/estrutura), drawBelt(g), drawItems(g)
  function Conveyor(pts, o) {
    o = o || NO;
    const w = o.w || 10, belt = o.col || PAL.blk, frame = o.frame || PAL.yel;
    const bt = Math.max(1.4, w * 0.2), R = w / 2, ri = R - bt;
    const n = pts.length, segs = [];
    let length = 0;
    for (let i = 0; i + 1 < n; i++) {
      const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dy) || 1e-6;
      segs.push({ x: pts[i][0], y: pts[i][1], ux: dx / L, uy: dy / L, len: L, s0: length });
      length += L;
    }
    const per = 2 * length + TAU * R;
    const tickGap = per / Math.max(6, Math.round(per / (o.tread || Math.max(7, w * 0.8))));
    const rollGap = length / Math.max(1, Math.round(length / (o.rollers || w * 1.9)));
    const floorF = o.floor === undefined ? null : typeof o.floor === 'function' ? o.floor : () => o.floor;
    const framePts = pts.map((p, i) => {                 // longarina logo abaixo da correia
      const s = segs[Math.min(i, segs.length - 1)], s2 = segs[Math.max(0, i - 1)];
      let nx = -(s.uy + s2.uy), ny = s.ux + s2.ux; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      if (ny < 0) { nx = -nx; ny = -ny; }
      return [p[0] + nx * R * 1.3, p[1] + ny * R * 1.3];
    });
    const legs = [];
    if (o.legs !== false && floorF) {
      const gap = o.legGap || 70;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], k = Math.max(1, Math.round(s.len / gap));
        for (let j = i === 0 ? 0 : 1; j <= k; j++) {
          const d = s.len * j / k, edge = (i === 0 && j === 0) || (i === segs.length - 1 && j === k);
          const d2 = edge ? (j === 0 ? Math.min(R * 1.6, s.len / 2) : s.len - Math.min(R * 1.6, s.len / 2)) : d;
          legs.push([s.x + s.ux * d2, s.y + s.uy * d2 + R * 1.2]);
        }
      }
    }
    const items = [], free = [], drops = [];

    // ponto na linha de centro a s unidades do início (extrapola nas pontas)
    function pointAt(s, out) {
      out = out || cvP;
      let k = 0;
      while (k < segs.length - 1 && s > segs[k].s0 + segs[k].len) k++;
      const sg = segs[k], d = s - sg.s0;
      out.x = sg.x + sg.ux * d; out.y = sg.y + sg.uy * d;
      out.nx = sg.uy; out.ny = -sg.ux;                    // normal do lado da carga (pra cima)
      if (out.ny > 0) { out.nx = -out.nx; out.ny = -out.ny; }
      out.ang = Math.atan2(sg.uy, sg.ux);
      return out;
    }
    // ponto no laço da correia: u anda por cima (0..L), dá a volta no tambor final, volta por baixo e fecha no tambor inicial
    function loopAt(u, out) {
      u = ((u % per) + per) % per;
      const arc = PI * R, a = segs[0], z = segs[segs.length - 1];
      if (u < length) { pointAt(u, out); return out; }
      if (u < length + arc) {
        const th = (u - length) / R, b = Math.atan2(z.uy, z.ux) - PI / 2 + th;
        out.x = pts[n - 1][0]; out.y = pts[n - 1][1]; out.nx = Math.cos(b); out.ny = Math.sin(b);
        return out;
      }
      if (u < 2 * length + arc) { pointAt(length - (u - length - arc), out); out.nx = -out.nx; out.ny = -out.ny; return out; }
      const th = (u - 2 * length - arc) / R, b = Math.atan2(a.uy, a.ux) + PI / 2 + th;
      out.x = pts[0][0]; out.y = pts[0][1]; out.nx = Math.cos(b); out.ny = Math.sin(b);
      return out;
    }
    function beltPath(g) {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) g.lineTo(pts[i][0], pts[i][1]);
    }
    function drop(it, atEnd) {
      const sg = atEnd ? segs[segs.length - 1] : segs[0], dir = atEnd ? 1 : -1;
      const p = atEnd ? pts[n - 1] : pts[0];
      const x = p[0] + sg.ux * dir * R * 0.9, y = p[1] + sg.uy * dir * R * 0.9 - R * 0.4;
      const vx = sg.ux * cv.v, vy = sg.uy * cv.v;
      for (let i = 0; i < drops.length; i++) drops[i](it.v, x, y, vx, vy, it);
      cv.dropped += it.v;
    }

    const cv = {
      pts, w, speed: o.speed !== undefined ? o.speed : 60, running: true, v: 0, phase: 0, length, load: 0, count: 0, dropped: 0,
      accel: o.accel || 3, items, showItems: o.items !== false, maxV: o.maxV || 2.2,
      cargo: o.cargo || PAL.rice, cargoShade: o.cargoShade || PAL.riceS, drawItem: o.drawItem || null,
      pointAt,
      // put(v=1, s=0) -> item: carrega um montinho
      put(v, s) {
        v = v === undefined ? 1 : v; s = s || 0;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (Math.abs(it.s - s) < w * 0.75 && it.v + v <= cv.maxV) { it.v += v; it.pop = 0.55; return it; }
        }
        const it = free.pop() || { s: 0, v: 0, pop: 0, seed: 0 };
        it.s = s; it.v = v; it.pop = 0; it.seed = Math.random();
        items.push(it);
        return it;
      },
      // onDrop(fn(v, x, y, vx, vy, item)) -> cv
      onDrop(fn) { drops.push(fn); return cv; },
      // end(out?) -> {x,y}: ponto onde a carga cai (frente do tambor final)
      end(out) {
        out = out || {};
        const z = segs[segs.length - 1];
        out.x = pts[n - 1][0] + z.ux * R * 0.9; out.y = pts[n - 1][1] + z.uy * R * 0.9 - R * 0.4;
        return out;
      },
      // start(out?) -> {x,y}: ponto de carregamento (em cima da correia, no começo)
      start(out) { out = out || {}; pointAt(0); out.x = cvP.x + cvP.nx * R; out.y = cvP.y + cvP.ny * R; return out; },
      // clear(): tira toda a carga
      clear() { while (items.length) free.push(items.pop()); cv.load = 0; cv.count = 0; },
      // update(dt): anda a correia (rampa de partida/parada) e a carga; despeja o que chega na ponta
      update(dt) {
        cv.v = U.damp(cv.v, cv.running ? cv.speed : 0, cv.accel, dt);
        const ds = cv.v * dt;
        cv.phase += ds;
        let load = 0;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.s += ds;
          if (it.pop < 1) it.pop = Math.min(1, it.pop + dt * 5);
          if (it.s > length || it.s < 0) {
            drop(it, it.s > length);
            items[i] = items[items.length - 1]; items.pop(); free.push(it);
            continue;
          }
          load += it.v;
        }
        cv.load = load; cv.count = items.length;
      },
      // drawBack(g): pés de apoio e longarina
      drawBack(g) {
        legO.ol = o.ol;
        if (floorF) {
          for (let i = 0; i < legs.length; i++) {
            const l = legs[i], fy = floorF(l[0]);
            if (fy - l[1] < 2) continue;
            legA[0][0] = l[0]; legA[0][1] = l[1]; legA[1][0] = l[0]; legA[1][1] = fy;
            Draw.beam(g, legA, Math.max(2.4, w * 0.3), PAL.steelD, legO);
            Draw.box(g, l[0] - w * 0.45, fy - 2.2, w * 0.9, 2.2, PAL.grayD, legO);
            if (fy - l[1] > w * 2.4) Draw.box(g, l[0] - w * 0.3, l[1] + (fy - l[1]) * 0.45, w * 0.6, 2, PAL.grayD, legO);
          }
        }
        Draw.beam(g, framePts, R, frame, o);
      },
      // drawBelt(g): correia (laço), roletes, tambores e marcas andando
      drawBelt(g) {
        const ol = olW(o);
        g.lineCap = 'round'; g.lineJoin = 'round';
        beltPath(g);
        if (ol > 0) { g.strokeStyle = LINE; g.lineWidth = w + ol * 2; g.stroke(); }
        g.strokeStyle = belt; g.lineWidth = w; g.stroke();
        g.strokeStyle = sh(belt, -0.5); g.lineWidth = ri * 2; g.stroke();
        // roletes de apoio
        const rr = Math.max(1, ri - 0.6), rot = cv.phase / rr;
        for (let s = rollGap; s < length - rollGap * 0.5; s += rollGap) {
          pointAt(s);
          const x = cvP.x, y = cvP.y;
          g.fillStyle = PAL.steelD; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
          g.fillStyle = PAL.steel; g.beginPath(); g.arc(x - rr * 0.15, y - rr * 0.18, rr * 0.72, 0, TAU); g.fill();
          g.fillStyle = LINE; g.beginPath(); g.arc(x + Math.cos(rot + s) * rr * 0.5, y + Math.sin(rot + s) * rr * 0.5, Math.max(0.5, rr * 0.24), 0, TAU); g.fill();
        }
        // tambores das pontas (o final é o motriz)
        for (let e = 0; e < 2; e++) {
          const p = e ? pts[n - 1] : pts[0], a = cv.phase / R;
          g.fillStyle = LINE; g.beginPath(); g.arc(p[0], p[1], ri + 0.4, 0, TAU); g.fill();
          g.fillStyle = sh(frame, -0.2); g.beginPath(); g.arc(p[0], p[1], ri - 0.3, 0, TAU); g.fill();
          g.fillStyle = e ? frame : PAL.steel; g.beginPath(); g.arc(p[0] - ri * 0.1, p[1] - ri * 0.12, ri * 0.78, 0, TAU); g.fill();
          g.strokeStyle = LINE; g.lineWidth = Math.max(0.7, ri * 0.22); g.lineCap = 'round';
          g.beginPath();
          g.moveTo(p[0] - Math.cos(a) * ri * 0.6, p[1] - Math.sin(a) * ri * 0.6); g.lineTo(p[0] + Math.cos(a) * ri * 0.6, p[1] + Math.sin(a) * ri * 0.6);
          g.moveTo(p[0] + Math.sin(a) * ri * 0.6, p[1] - Math.cos(a) * ri * 0.6); g.lineTo(p[0] - Math.sin(a) * ri * 0.6, p[1] + Math.cos(a) * ri * 0.6);
          g.stroke();
        }
        // marcas da correia (taliscas): andam por cima, dão a volta e voltam por baixo
        g.lineCap = 'butt';
        g.strokeStyle = sh(belt, 0.34); g.lineWidth = Math.max(1, w * 0.14);
        g.beginPath();
        const u0 = ((cv.phase % tickGap) + tickGap) % tickGap;
        for (let u = u0; u < per; u += tickGap) {
          loopAt(u, cvP);
          g.moveTo(cvP.x + cvP.nx * (ri + 0.2), cvP.y + cvP.ny * (ri + 0.2));
          g.lineTo(cvP.x + cvP.nx * (R + 0.9), cvP.y + cvP.ny * (R + 0.9));
        }
        g.stroke();
      },
      // drawItems(g): montinhos de carga
      drawItems(g) {
        if (!cv.showItems) return;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          pointAt(it.s);
          const k = Math.sqrt(it.v), e = it.pop < 1 ? U.ease.back(it.pop) : 1;
          const hop = Math.max(0, Math.cos((it.s / rollGap) * TAU)) ; // passa em cima do rolete: pulinho
          const j = hop * hop * hop * hop * Math.min(1, Math.abs(cv.v) / 40) * 0.9;
          const x = cvP.x + cvP.nx * (R + 0.4), y = cvP.y + cvP.ny * (R + 0.4) - j;
          if (cv.drawItem) { cv.drawItem(g, x, y, it.v, cvP.ang, it); continue; }
          const hw = Math.min(w * 1.25, w * 0.62 * k) * (0.6 + 0.4 * e), h = hw * 0.8 * e * (1 + j * 0.05);
          g.save(); g.translate(x, y); g.rotate(cvP.ang * 0.55 * (Math.abs(cvP.ang) > PI / 2 ? 0 : 1));
          moundO.col = cv.cargo; moundO.shade = cv.cargoShade; moundO.ol = o.ol; Rig.mound(g, 0, 0, hw, h, moundO);
          g.restore();
        }
      },
      // draw(g, t): tudo na ordem certa
      draw(g) { cv.drawBack(g); cv.drawBelt(g); cv.drawItems(g); },
    };
    return cv;
  }

  /* ---------- exporta ---------- */
  E.Spring = Spring;
  E.Joint = Joint;
  E.ik2 = ik2;
  E.ik3 = ik3;
  E.Rig = Rig;
  E.Rope = Rope;
  E.Telescope = Telescope;
  E.Chassis = Chassis;
  E.suspension = Chassis;      // apelido do contrato ("E.suspension(...)")
  E.Exhaust = Exhaust;
  E.Conveyor = Conveyor;
})();


/* ===== engine/audio.js ===== */
/* ==========================================================================
   Pixxel v1.0 — audio.js
   Todo o som do jogo, 100% sintetizado (nenhum arquivo de áudio):
     E.Audio  contexto, cadeia master (compressor + limiter + clip suave), buses e volumes
     E.Sfx    efeitos com nome, variantes, limite de vozes, gate e "skins" de timbre
     E.Loops  motores e ambiências contínuos, com regime (rate) e volume sem clique
     E.Music  trilha generativa japonesa (koto, shakuhachi, taiko, shamisen, baixo, pad)
   Depende só de core.js. Tudo vira no-op se não houver AudioContext ou se o áudio
   ainda não foi destravado por um gesto do usuário; nada aqui lança exceção.

   Como funciona por dentro: quase todo som é pré-renderizado em JS para um
   Float32Array (kit DSP abaixo) e tocado como AudioBufferSource. A síntese nunca
   fala com "o" contexto: ela recebe um grafo G (ao vivo ou OfflineAudioContext),
   então E.Audio.renderSfx/renderLoop/renderMusic produzem exatamente o que toca.
   ========================================================================== */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const E = (root.Pixxel = root.Pixxel || {});
  if (!E.U) throw new Error('Pixxel: carregue core.js antes de audio.js');
  const U = E.U, TAU = Math.PI * 2;
  const doc = typeof document !== 'undefined' ? document : null;
  const AC = root.AudioContext || root.webkitAudioContext || null;
  const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext || null;
  const NOOPTS = Object.freeze({});

  const clamp = U.clamp;
  const hashStr = (E.hash && E.hash.str) || (s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; });
  // mtof(midi) -> Hz
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // semitons -> razão de frequência
  const semi = s => Math.pow(2, s / 12);

  /* ======================================================================
     DSP — kit de síntese offline (escreve em Float32Array)
     Cada função SOMA no buffer `out`. Tempos em segundos, frequências em Hz.
     ====================================================================== */

  // filtro de estado variável (TPT): estável com varredura de corte
  function SVF(sr) { this.sr = sr; this.ic1 = 0; this.ic2 = 0; this.a1 = 0; this.a2 = 0; this.a3 = 0; this.k = 1; }
  SVF.prototype.set = function (f, q) {
    const g = Math.tan(Math.PI * Math.min(Math.max(f, 10), this.sr * 0.45) / this.sr);
    this.k = 1 / (q || 0.707);
    this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
    return this;
  };
  // run(x, tipo): tipo 0 = passa-baixa, 1 = passa-banda (pico unitário), 2 = passa-alta
  SVF.prototype.run = function (x, type) {
    const v3 = x - this.ic2, v1 = this.a1 * this.ic1 + this.a2 * v3, v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    return type === 0 ? v2 : type === 1 ? this.k * v1 : x - this.k * v1 - v2;
  };

  // DSP(sr, seed) -> D: kit de síntese determinístico (mesma seed = mesmo som)
  function DSP(sr, seed) {
    let st = (seed >>> 0) || 0x9E3779B9;
    // rnd() -> 0..1 (mulberry32 local, rápido)
    function rnd() {
      st = (st + 0x6D2B79F5) | 0;
      let t = Math.imul(st ^ (st >>> 15), 1 | st);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    const D = { sr, rnd };
    // rr(a,b) -> aleatório em [a,b)
    D.rr = (a, b) => a + (b - a) * rnd();
    // buf(seg) -> Float32Array zerado
    D.buf = sec => new Float32Array(Math.max(16, Math.ceil(sec * sr)));

    // gerador de ruído colorido: devolve função () -> amostra
    function noiseGen(color) {
      if (color === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0;
        return () => { const w = rnd() * 2 - 1; b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; return (b0 + b1 + b2 + w * 0.1848) * 0.25; };
      }
      if (color === 'brown') { let last = 0; return () => { last = (last + 0.02 * (rnd() * 2 - 1)) / 1.02; return last * 3.5; }; }
      return () => rnd() * 2 - 1;
    }
    D.noiseGen = noiseGen;

    // envelope ASD: ataque linear, sustain (com punch), decay em potência
    function env(i, nA, nS, nD, curve, punch) {
      if (i < nA) return i / nA;
      if (i < nA + nS) return 1 + punch * (1 - (i - nA) / nS);
      const x = 1 - (i - nA - nS) / nD;
      return x <= 0 ? 0 : curve === 2 ? x * x : Math.pow(x, curve);
    }

    /* osc(out, o): oscilador com envelope.
       o: {wave:'sin'|'tri'|'sq'|'saw', f, f1 (freq final), slide (seg do deslize; padrão = duração),
           path:[[t,f],...] (trajeto de frequência por pontos), at, a, s, d, vol, curve, punch,
           vib (fração), vibHz, duty, fm:{ratio,index,decay}, arp, arpT, lp, lp1 (passa-baixa de 1 polo, varrendo)} */
    D.osc = function (out, o) {
      const at = Math.floor((o.at || 0) * sr), a = Math.max(o.a || 0, 0.001), s = o.s || 0, d = o.d === undefined ? 0.1 : o.d;
      const nA = a * sr, nS = s * sr, nD = Math.max(1, d * sr), n = Math.min(out.length - at, Math.ceil(nA + nS + nD));
      if (n <= 0) return out;
      const f0 = o.f, f1 = o.f1 || f0, slideN = Math.max(1, (o.slide || (a + s + d)) * sr), k = f1 !== f0 ? Math.pow(f1 / f0, 1 / slideN) : 1;
      const wave = o.wave || 'sin', vol = o.vol === undefined ? 0.5 : o.vol, curve = o.curve || 2, punch = o.punch || 0;
      const vib = o.vib || 0, vibW = TAU * (o.vibHz || 6) / sr, duty = o.duty || 0.5;
      const fm = o.fm, fmR = fm ? fm.ratio : 0, fmI = fm ? fm.index : 0, fmD = fm ? 1 / ((fm.decay || d) * sr) : 0;
      const arpN = o.arp ? (o.arpT || 0.05) * sr : Infinity, arp = o.arp || 1;
      const path = o.path; let seg = 0;
      let lpF = o.lp || 0; const lpK = o.lp && o.lp1 ? Math.pow(o.lp1 / o.lp, 1 / n) : 1;
      let f = path ? path[0][1] : f0, ph = o.phase || 0, mph = 0, lp = 0, lpA = lpF ? 1 - Math.exp(-TAU * Math.min(lpF, sr * 0.45) / sr) : 0;
      for (let i = 0; i < n; i++) {
        if (path) {
          const t = i / sr;
          while (seg < path.length - 2 && t >= path[seg + 1][0]) seg++;
          const p0 = path[seg], p1 = path[seg + 1] || p0, u = p1[0] > p0[0] ? clamp((t - p0[0]) / (p1[0] - p0[0]), 0, 1) : 1;
          f = p0[1] * Math.pow(p1[1] / p0[1], u);
        } else if (i < slideN) f *= k;
        let ff = f; if (vib) ff *= 1 + vib * Math.sin(vibW * i); if (i >= arpN) ff *= arp;
        let p = ph;
        if (fm) { mph += ff * fmR / sr; p += fmI * Math.max(0, 1 - i * fmD) * Math.sin(TAU * mph) / TAU; p -= Math.floor(p); }
        ph += ff / sr; if (ph >= 1) ph -= 1;
        let v = wave === 'sin' ? Math.sin(TAU * p) : wave === 'tri' ? 1 - 4 * Math.abs(p - 0.5) : wave === 'sq' ? (p < duty ? 1 : -1) : 2 * p - 1;
        if (lpA) { if (lpK !== 1 && (i & 15) === 0) { lpF = o.lp * Math.pow(lpK, i); lpA = 1 - Math.exp(-TAU * Math.min(lpF, sr * 0.45) / sr); } lp += (v - lp) * lpA; v = lp; }
        out[at + i] += v * env(i, nA, nS, nD, curve, punch) * vol;
      }
      return out;
    };

    /* noise(out, o): ruído filtrado com envelope.
       o: {color:'white'|'pink'|'brown', at, a, s, d, vol, curve, punch, q,
           lp, lp1, hp, hp1, bp, bp1 (cortes; o par X/X1 varre exponencialmente ao longo do som), am (Hz), amDepth} */
    D.noise = function (out, o) {
      const at = Math.floor((o.at || 0) * sr), a = Math.max(o.a || 0, 0.0008), s = o.s || 0, d = o.d === undefined ? 0.1 : o.d;
      const nA = a * sr, nS = s * sr, nD = Math.max(1, d * sr), n = Math.min(out.length - at, Math.ceil(nA + nS + nD));
      if (n <= 0) return out;
      const gen = noiseGen(o.color || 'white'), vol = o.vol === undefined ? 0.5 : o.vol, curve = o.curve || 2, punch = o.punch || 0, q = o.q || 0.707;
      const f1 = o.bp ? new SVF(sr) : o.hp ? new SVF(sr) : null, t1 = o.bp ? 1 : 2;
      const a0 = o.bp || o.hp || 0, a1 = o.bp ? (o.bp1 || o.bp) : (o.hp1 || o.hp || 0);
      const f2 = o.lp ? new SVF(sr) : null, b0 = o.lp || 0, b1 = o.lp1 || o.lp || 0;
      const sweepA = a1 !== a0, sweepB = b1 !== b0;
      if (f1) f1.set(a0, o.bp ? q : 0.707); if (f2) f2.set(b0, 0.707);
      const amW = o.am ? TAU * o.am / sr : 0, amD = o.amDepth === undefined ? 1 : o.amDepth;
      for (let i = 0; i < n; i++) {
        if ((i & 15) === 0) {
          const u = i / n;
          if (sweepA) f1.set(a0 * Math.pow(a1 / a0, u), o.bp ? q : 0.707);
          if (sweepB) f2.set(b0 * Math.pow(b1 / b0, u), 0.707);
        }
        let v = gen();
        if (f1) v = f1.run(v, t1);
        if (f2) v = f2.run(v, 0);
        if (amW) v *= 1 - amD * (0.5 + 0.5 * Math.cos(amW * i));
        out[at + i] += v * env(i, nA, nS, nD, curve, punch) * vol;
      }
      return out;
    };

    /* modal(out, f, ratios, gains, decays, {at, vol, a}): soma de senoides amortecidas (sinos, metal, madeira).
       decays = tempo (seg) pra cair 60 dB em cada parcial */
    D.modal = function (out, f, ratios, gains, decays, o) {
      o = o || NOOPTS;
      const at = Math.floor((o.at || 0) * sr), vol = o.vol === undefined ? 1 : o.vol, nA = Math.max(8, (o.a || 0.001) * sr);
      for (let p = 0; p < ratios.length; p++) {
        const fp = f * ratios[p]; if (fp > sr * 0.45) continue;
        const dec = decays[p] === undefined ? decays[decays.length - 1] : decays[p];
        const n = Math.min(out.length - at, Math.ceil(dec * sr)), w = TAU * fp / sr, k = Math.exp(-6.9 / (dec * sr)), g = gains[p] * vol, ph = rnd() * TAU;
        let e = 1;
        for (let i = 0; i < n; i++) { out[at + i] += g * e * Math.sin(w * i + ph) * (i < nA ? i / nA : 1); e *= k; }
      }
      return out;
    };

    // grains(out, {n, t0, t1, f0, f1, d0, d1, vol, q}): n estalinhos de grão (ruído passa-banda curtíssimo) espalhados em [t0,t1]
    D.grains = function (out, o) {
      const g = { color: 'white', at: 0, a: 0.0006, d: 0.006, vol: 0.2, bp: 8000, q: o.q || 2 };
      for (let i = 0; i < o.n; i++) {
        g.at = D.rr(o.t0, o.t1); g.bp = D.rr(o.f0, o.f1); g.d = D.rr(o.d0 || 0.004, o.d1 || 0.009); g.vol = (o.vol || 0.2) * D.rr(0.5, 1);
        D.noise(out, g);
      }
      return out;
    };

    /* voice(out, o): fonte tipo "voz" (serra + ruído) passando por formantes em paralelo. Latidos, uivos, coro.
       o: {at, path:[[t,f]...], a, s, d, vol, vib, vibHz, breath (0..1), am (Hz), amDepth, formants:[[f,q,ganho],...]} */
    D.voice = function (out, o) {
      const dur = (o.a || 0.01) + (o.s || 0) + (o.d || 0.1), n = Math.ceil(dur * sr), tmp = new Float32Array(n);
      D.osc(tmp, { wave: o.wave || 'saw', path: o.path, f: o.f, a: o.a, s: o.s, d: o.d, vol: 1, vib: o.vib, vibHz: o.vibHz, curve: o.curve });
      if (o.breath) D.noise(tmp, { color: 'pink', a: o.a, s: o.s, d: o.d, vol: o.breath * 2, hp: 600 });
      if (o.am) { const w = TAU * o.am / sr, dp = o.amDepth === undefined ? 0.6 : o.amDepth; for (let i = 0; i < n; i++) tmp[i] *= 1 - dp * (0.5 + 0.5 * Math.sin(w * i)); }
      const at = Math.floor((o.at || 0) * sr), vol = o.vol === undefined ? 0.5 : o.vol, m = Math.min(n, out.length - at);
      for (let k = 0; k < o.formants.length; k++) {
        const F = o.formants[k], fl = new SVF(sr).set(F[0], F[1]), g = F[2] * vol;
        for (let i = 0; i < m; i++) out[at + i] += fl.run(tmp[i], 1) * g;
      }
      return out;
    };

    // filter(buf, tipo 'lp'|'bp'|'hp', f, q, f1, loop): filtra no lugar (f -> f1 varrendo). loop=true aquece o filtro
    // com uma volta inteira antes, pra um buffer periódico continuar periódico (sem estalo na emenda)
    D.filter = function (b, type, f, q, f1, loop) {
      const fl = new SVF(sr).set(f, q || 0.707), t = type === 'lp' ? 0 : type === 'bp' ? 1 : 2, n = b.length, sw = f1 && f1 !== f;
      if (loop) for (let i = 0; i < n; i++) fl.run(b[i], t);
      for (let i = 0; i < n; i++) { if (sw && (i & 15) === 0) fl.set(f * Math.pow(f1 / f, i / n), q || 0.707); b[i] = fl.run(b[i], t); }
      return b;
    };
    // sat(buf, drive): saturação suave tanh (gera harmônicos que alto-falante pequeno reproduz)
    D.sat = function (b, drive) { const k = 1 / Math.tanh(drive); for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * drive) * k; return b; };
    // gain(buf, g)
    D.gain = function (b, g) { for (let i = 0; i < b.length; i++) b[i] *= g; return b; };
    // mix(out, src, at, g): soma src em out a partir de `at` segundos
    D.mix = function (out, src, at, g) {
      const o = Math.floor((at || 0) * sr), n = Math.min(src.length, out.length - o); g = g === undefined ? 1 : g;
      for (let i = 0; i < n; i++) out[o + i] += src[i] * g;
      return out;
    };
    // wrap(out, src, at, g): soma src em out dando a volta no fim (pra montar loops exatos)
    D.wrap = function (out, src, at, g) {
      const N = out.length; let o = Math.floor(at * sr) % N; if (o < 0) o += N; g = g === undefined ? 1 : g;
      for (let i = 0; i < src.length; i++) { out[o] += src[i] * g; if (++o >= N) o = 0; }
      return out;
    };
    // fold(buf, n) -> Float32Array(n): dobra a sobra do fim sobre o começo com crossfade de potência igual (loop sem emenda)
    D.fold = function (b, n) {
      const out = b.subarray(0, n).slice(), xf = b.length - n;
      for (let i = 0; i < xf; i++) { const u = i / xf; out[i] = out[i] * Math.sin(u * Math.PI / 2) + b[n + i] * Math.cos(u * Math.PI / 2); }
      return out;
    };
    // peak(buf) -> pico absoluto
    D.peak = function (b) { let p = 0; for (let i = 0; i < b.length; i++) { const v = b[i] < 0 ? -b[i] : b[i]; if (v > p) p = v; } return p; };
    /* finish(buf, pico=0.5, loop=false) -> buf: tira NaN e DC, normaliza no pico pedido e arredonda as pontas
       (o som nunca começa nem termina num degrau = sem clique) */
    D.finish = function (b, peak, loop) {
      const n = b.length; let x1 = 0, y1 = 0; const R = 1 - TAU * 18 / sr;
      if (!loop) for (let i = 0; i < n; i++) { let x = b[i]; if (x !== x || x === Infinity || x === -Infinity) x = 0; y1 = x - x1 + R * y1; x1 = x; b[i] = y1; }
      else { let m = 0; for (let i = 0; i < n; i++) { if (b[i] !== b[i]) b[i] = 0; m += b[i]; } m /= n; for (let i = 0; i < n; i++) b[i] -= m; }
      const p = D.peak(b); if (p > 1e-6) D.gain(b, (peak === undefined ? 0.5 : peak) / p);
      if (!loop) {
        const fo = Math.min(n >> 1, Math.floor(0.006 * sr)), fi = Math.min(n >> 2, Math.floor(0.0007 * sr));
        for (let i = 0; i < fo; i++) b[n - 1 - i] *= i / fo;
        for (let i = 0; i < fi; i++) b[i] *= i / fi;
      }
      return b;
    };
    return D;
  }

  /* ======================================================================
     Instrumentos pré-renderizados: corda dedilhada (Karplus-Strong), percussão, notas de recompensa
     ====================================================================== */
  const KS = {
    koto: { dur: 2.2, decay: 0.9972, bright: 0.72, pick: 0.13, click: 0.25, nz: 0.55 },
    shami: { dur: 0.9, decay: 0.991, bright: 0.95, pick: 0.07, click: 0.5, buzz: 2.4, nz: 0.7 },
    bass: { dur: 1.5, decay: 0.9965, bright: 0.2, pick: 0.3, click: 0, nz: 0.06 },
    harp: { dur: 1.6, decay: 0.996, bright: 0.45, pick: 0.25, click: 0.05, nz: 0.2 },
  };
  /* renderKS(D, midi, tipo) -> {data, rate}: corda Karplus-Strong. `rate` corrige a afinação
     (o atraso inteiro desafina; toca-se o buffer com playbackRate = rate) */
  function renderKS(D, midi, kind) {
    const P = KS[kind] || KS.koto, sr = D.sr, f = mtof(midi), N = Math.max(2, Math.round(sr / f - 0.5));
    const dur = P.dur * (midi > 76 ? 0.7 : 1), len = Math.floor(dur * sr), o = new Float32Array(len);
    const d = new Float32Array(N), e = new Float32Array(N); let lp = 0;
    for (let i = 0; i < N; i++) { lp += ((D.rnd() * 2 - 1) - lp) * P.bright; e[i] = lp; }
    const pk = Math.max(1, Math.floor(N * P.pick));                       // posição da palheta (pente)
    // excitação = forma da corda puxada (triângulo no ponto da palheta: fundamental firme) + ruído filtrado (brilho, vida)
    for (let i = 0; i < N; i++) d[i] = (1 - P.nz) * ((i < pk ? i / pk : (N - i) / (N - pk)) - 0.5) * 1.6 + P.nz * (e[i] - e[(i - pk + N) % N]) * 1.5;
    let idx = 0, prev = 0;
    for (let i = 0; i < len; i++) { const cur = d[idx]; o[i] = cur; d[idx] = P.decay * 0.5 * (cur + prev); prev = cur; if (++idx >= N) idx = 0; }
    if (P.click) D.noise(o, { d: 0.012, vol: P.click * D.peak(o), bp: kind === 'shami' ? 3000 : 4200, q: 1.5 });   // unha / bachi
    if (P.buzz) D.sat(o, P.buzz);                                         // sawari do shamisen
    D.finish(o, 0.8);
    const fade = Math.floor(0.05 * sr); for (let i = 0; i < fade; i++) o[len - 1 - i] *= i / fade;
    return { data: o, rate: f * (N + 0.5) / sr };
  }

  // renderDrum(D, tipo) -> Float32Array: taiko e percussão da trilha
  function renderDrum(D, kind) {
    let b;
    switch (kind) {
      case 'don':                                                         // ō-daiko
        b = D.buf(0.9);
        D.osc(b, { f: 122, f1: 52, slide: 0.09, a: 0.002, s: 0.02, d: 0.7, vol: 0.9, punch: 0.3, curve: 2.4 });
        D.osc(b, { f: 180, f1: 90, slide: 0.05, d: 0.15, vol: 0.4 });
        D.noise(b, { d: 0.03, vol: 0.5, lp: 900 });
        D.noise(b, { d: 0.25, vol: 0.06, bp: 260, q: 3, color: 'brown' });
        D.sat(b, 1.5); return D.finish(b, 0.85);
      case 'chu':                                                         // chū-daiko
        b = D.buf(0.5);
        D.osc(b, { f: 190, f1: 108, slide: 0.06, d: 0.36, vol: 0.9, curve: 2.2 });
        D.noise(b, { d: 0.022, vol: 0.4, lp: 1500 }); D.sat(b, 1.3); return D.finish(b, 0.7);
      case 'ten':                                                         // shime-daiko
        b = D.buf(0.2);
        D.osc(b, { f: 420, f1: 330, slide: 0.03, d: 0.12, vol: 0.7, curve: 2.5 });
        D.noise(b, { d: 0.045, vol: 0.55, bp: 1800, q: 1.5 }); return D.finish(b, 0.6);
      case 'ka':                                                          // aro
        b = D.buf(0.07);
        D.noise(b, { d: 0.022, vol: 0.7, bp: 2600, q: 8 }); D.osc(b, { wave: 'sq', f: 1150, d: 0.01, vol: 0.2, lp: 4000 });
        D.modal(b, 820, [1, 2.3], [0.25, 0.1], [0.04, 0.03]); return D.finish(b, 0.5);
      case 'chan': case 'chiki': {                                        // atarigane aberto / abafado
        const dec = kind === 'chan' ? 0.2 : 0.045; b = D.buf(dec + 0.03);
        D.modal(b, 2217, [1, 1.414, 2.0, 2.83], [0.5, 0.4, 0.3, 0.12], [dec, dec * 0.9, dec * 0.7, dec * 0.5]);
        D.noise(b, { d: 0.006, vol: 0.2, hp: 4000 }); return D.finish(b, 0.4);
      }
      case 'clap':                                                        // hyōshigi
        b = D.buf(0.12);
        D.osc(b, { wave: 'tri', f: 1450, d: 0.05, vol: 0.5, curve: 3 }); D.osc(b, { wave: 'tri', f: 2150, d: 0.045, vol: 0.4, curve: 3 });
        D.noise(b, { d: 0.008, vol: 0.4, hp: 1500 }); D.modal(b, 760, [1], [0.3], [0.07]);
        D.filter(b, 'hp', 700); return D.finish(b, 0.55);
      case 'furin': {                                                     // sino de vento
        const f = D.rr(2100, 3300); b = D.buf(2.3);
        D.modal(b, f, [1, 2.76, 5.4, 8.93], [1, 0.5, 0.25, 0.1], [2.2, 1.4, 0.8, 0.4]);
        D.noise(b, { d: 0.004, vol: 0.2, hp: 5000 }); return D.finish(b, 0.4);
      }
      case 'drop':                                                        // suikinkutsu
        b = D.buf(0.7);
        D.osc(b, { f: 1750, f1: 2400, slide: 0.04, d: 0.5, vol: 0.6, curve: 3.5 });
        D.modal(b, 2650, [1, 1.52], [0.2, 0.08], [0.45, 0.3], { at: 0.01 }); return D.finish(b, 0.45);
      case 'anvil':                                                       // batida de metal (temas de máquina)
        b = D.buf(0.5);
        D.modal(b, 430, [1, 1.59, 2.31, 3.13, 4.27, 5.6], [1, 0.7, 0.5, 0.35, 0.25, 0.12], [0.4, 0.3, 0.22, 0.15, 0.1, 0.07]);
        D.noise(b, { d: 0.01, vol: 0.5, bp: 3200, q: 1 }); D.osc(b, { f: 160, f1: 90, d: 0.06, vol: 0.5 }); return D.finish(b, 0.55);
      default: return D.buf(0.05);
    }
  }

  /* renderInst(D, inst, midi) -> Float32Array: uma nota do instrumento de recompensa (as "skins" A..G do GDD §14) */
  function renderInst(D, inst, midi) {
    const f = mtof(midi); let b;
    switch (inst) {
      case 'kalimba':
        b = D.buf(0.8);
        D.osc(b, { f, a: 0.002, d: 0.75, vol: 0.8, curve: 3.2 }); D.osc(b, { f: f * 5.42, d: 0.07, vol: 0.2, curve: 2 });
        D.osc(b, { f: f * 2, d: 0.3, vol: 0.12, curve: 3 }); D.noise(b, { d: 0.006, vol: 0.12, bp: 2500, q: 1 });
        return D.finish(b, 0.6);
      case 'marimba':
        b = D.buf(0.5);
        D.osc(b, { f, a: 0.001, d: 0.42, vol: 0.9, curve: 3.5 }); D.osc(b, { f: f * 4, d: 0.09, vol: 0.28, curve: 2.5 });
        D.osc(b, { f: f * 10.1, d: 0.02, vol: 0.1 }); D.noise(b, { d: 0.004, vol: 0.15, lp: 3000 });
        return D.finish(b, 0.6);
      case 'bell':
        b = D.buf(1.5);
        D.modal(b, f, [1, 2.76, 5.4, 8.93], [1, 0.45, 0.2, 0.08], [1.4, 0.9, 0.5, 0.25]);
        D.osc(b, { f: f * 0.5, d: 0.5, vol: 0.15, curve: 3 }); D.noise(b, { d: 0.004, vol: 0.15, hp: 4000 });
        return D.finish(b, 0.55);
      case 'fmbell':                                                      // sino FM do grão dourado
        b = D.buf(0.9);
        D.osc(b, { f, a: 0.002, d: 0.8, vol: 0.8, curve: 3, fm: { ratio: 3.5, index: 2, decay: 0.35 } });
        D.osc(b, { f: f * 2.01, d: 0.4, vol: 0.12, curve: 3 });
        return D.finish(b, 0.55);
      case 'brass': {                                                     // ataque de metais
        b = D.buf(0.55);
        const o = { wave: 'saw', f, a: 0.025, s: 0.14, d: 0.3, vol: 0.4, punch: 0.25, curve: 2 };
        D.osc(b, o); o.f = f * 1.006; D.osc(b, o); o.f = f * 0.5; o.vol = 0.3; D.osc(b, o); o.f = f * 1.5; o.vol = 0.12; D.osc(b, o);
        D.filter(b, 'lp', Math.min(5200, f * 7), 1.2, Math.max(700, f * 1.6));
        return D.finish(b, 0.6);
      }
      case 'orch': {                                                      // batida de orquestra + coro "ah"
        b = D.buf(1.0);
        const o = { wave: 'saw', f, a: 0.004, s: 0.06, d: 0.5, vol: 0.3, punch: 0.4 };
        const rs = [0.5, 1, 1.5, 2, 3];
        for (let i = 0; i < rs.length; i++) { o.f = f * rs[i] * 0.996; D.osc(b, o); o.f = f * rs[i] * 1.005; D.osc(b, o); }
        D.filter(b, 'lp', 6500, 0.9, 900);
        D.noise(b, { d: 0.05, vol: 0.5, lp: 3000 }); D.osc(b, { f: 110, f1: 55, d: 0.3, vol: 0.5 });
        const fr = [[820, 7, 1], [1180, 8, 0.6], [2900, 9, 0.25]];
        D.voice(b, { f, path: [[0, f], [1, f]], a: 0.07, s: 0.25, d: 0.6, vol: 0.9, vib: 0.008, vibHz: 5.4, breath: 0.08, formants: fr });
        D.voice(b, { f: f * 0.5, path: [[0, f * 0.5], [1, f * 0.5]], a: 0.07, s: 0.25, d: 0.6, vol: 0.6, vib: 0.007, vibHz: 5, formants: fr });
        return D.finish(b, 0.6);
      }
      default: return D.buf(0.05);
    }
  }
  const KS_INST = { koto: 1, shami: 1, bass: 1, harp: 1 };

  /* ======================================================================
     Grafo de áudio (serve pro contexto ao vivo e pro OfflineAudioContext)
     ====================================================================== */
  const settings = { muted: false, volume: 0.8, sfxVol: 1, musicVol: 0.6 };
  const BUS = { sfx: 0.9, loop: 0.5, music: 0.3, rev: 0.25 };   // música ~9 dB abaixo dos efeitos (não cansa)
  const bufCache = new Map();        // 'sr|chave' -> AudioBuffer (AudioBuffer não pertence a um contexto: serve pros dois)
  const rawCache = new Map();        // 'sr|chave' -> dado auxiliar (ex.: rate do Karplus-Strong)
  let L = null;                      // grafo ao vivo
  let failed = false;                // não existe AudioContext: tudo vira no-op

  // makeIR(ctx): resposta ao impulso sintética, estéreo, que escurece com o tempo (sala de madeira)
  function makeIR(ctx) {
    const sr = ctx.sampleRate, n = Math.floor(1.7 * sr), key = sr + '|ir';
    if (bufCache.has(key)) return bufCache.get(key);
    const ir = ctx.createBuffer(2, n, sr); bufCache.set(key, ir);
    for (let c = 0; c < 2; c++) {
      const D = DSP(sr, 0xC0FFEE + c * 977), d = ir.getChannelData(c), pre = Math.floor(0.012 * sr); let lp = 0;
      for (let i = pre; i < n; i++) {
        const u = (i - pre) / (n - pre), a = 0.9 - 0.75 * u;               // passa-baixa fecha ao longo da cauda
        lp += ((D.rnd() * 2 - 1) - lp) * a;
        d[i] = lp * Math.pow(1 - u, 2.6) * (i < pre + 0.03 * sr && D.rnd() < 0.02 ? 3 : 1);
      }
    }
    return ir;
  }

  // buildGraph(ctx, offline) -> G: monta buses, reverb e cadeia master num contexto qualquer
  function buildGraph(ctx, offline) {
    const G = { ctx, sr: ctx.sampleRate, offline: !!offline, voices: [], lastT: Object.create(null), lastVar: Object.create(null), tones: 0 };
    const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    G.unlockAt = 0;
    G.master = gain(offline ? 0.8 : (settings.muted ? 0 : settings.volume));
    G.comp = ctx.createDynamicsCompressor();                               // cola
    G.comp.threshold.value = -16; G.comp.knee.value = 12; G.comp.ratio.value = 4; G.comp.attack.value = 0.004; G.comp.release.value = 0.25;
    G.lim = ctx.createDynamicsCompressor();                                // limiter
    G.lim.threshold.value = -3; G.lim.knee.value = 0; G.lim.ratio.value = 20; G.lim.attack.value = 0.001; G.lim.release.value = 0.08;
    G.trim = gain(0.62);                                                   // compensa o ganho automático dos compressores
    G.clip = ctx.createWaveShaper();                                       // última rede: nunca passa de ±1
    const curve = new Float32Array(1025);
    for (let i = 0; i < 1025; i++) { const x = (i - 512) / 512 * 1.5, ax = Math.abs(x); curve[i] = ax < 0.8 ? x : Math.sign(x) * (0.8 + 0.19 * Math.tanh((ax - 0.8) / 0.19)); }
    G.clip.curve = curve;
    const pre = gain(1 / 1.5);                                             // WaveShaper mapeia [-1,1]: abre faixa até ±1.5
    G.sfx = gain(BUS.sfx * (offline ? 1 : settings.sfxVol));
    G.loop = gain(BUS.loop * (offline ? 1 : settings.sfxVol));
    G.music = gain(BUS.music * (offline ? 1 : settings.musicVol));
    G.duck = gain(1);                                                      // ducking da música (não briga com o volume)
    G.musicLP = ctx.createBiquadFilter(); G.musicLP.type = 'lowpass'; G.musicLP.frequency.value = 7500;   // anti-fadiga
    G.rev = ctx.createConvolver(); G.rev.buffer = makeIR(ctx);
    G.revSend = gain(1); G.revRet = gain(BUS.rev);
    G.revSend.connect(G.rev); G.rev.connect(G.revRet); G.revRet.connect(G.master);
    G.sfx.connect(G.master); G.loop.connect(G.master);
    G.music.connect(G.duck); G.duck.connect(G.musicLP); G.musicLP.connect(G.master);
    // "sem agudos": tudo passa por um passa-baixa suave antes do compressor (o dono pediu som mais fofo, sem nada estridente)
    G.soft = ctx.createBiquadFilter(); G.soft.type = 'lowpass'; G.soft.frequency.value = 2600; G.soft.Q.value = 0.5;
    G.shelf = ctx.createBiquadFilter(); G.shelf.type = 'highshelf'; G.shelf.frequency.value = 1800; G.shelf.gain.value = -6;
    G.master.connect(G.shelf); G.shelf.connect(G.soft); G.soft.connect(G.comp); G.comp.connect(G.lim); G.lim.connect(G.trim); G.trim.connect(pre); pre.connect(G.clip);
    if (!offline && ctx.createAnalyser) {
      G.analyser = ctx.createAnalyser(); G.analyser.fftSize = 2048; G.analyser.smoothingTimeConstant = 0.75;
      G.clip.connect(G.analyser);
    }
    G.clip.connect(ctx.destination);
    return G;
  }

  /* cached(G, chave, canais, fn(D)->Float32Array|[L,R]) -> AudioBuffer: renderiza uma vez por sample rate e guarda */
  function cached(G, key, seed, fn) {
    const k = G.sr + '|' + key; let ab = bufCache.get(k);
    if (ab) return ab;
    let data;
    try { data = fn(DSP(G.sr, seed)); } catch (err) { data = new Float32Array(16); warn('falha ao renderizar ' + key, err); }
    const chans = Array.isArray(data) ? data : [data];
    ab = G.ctx.createBuffer(chans.length, chans[0].length, G.sr);
    for (let c = 0; c < chans.length; c++) ab.getChannelData(c).set(chans[c]);
    bufCache.set(k, ab);
    return ab;
  }
  let warned = 0;
  function warn(msg, err) { if (warned++ < 5 && root.console) console.warn('[kome] audio: ' + msg, err || ''); }

  // ksBuf(G, midi, tipo) -> {buf, rate}: nota de corda em cache
  const ksOut = { buf: null, rate: 1 };
  function ksBuf(G, midi, kind) {
    const key = 'ks:' + kind + ':' + midi, rk = G.sr + '|' + key;
    const ab = cached(G, key, hashStr(key), D => { const r = renderKS(D, midi, kind); rawCache.set(rk, r.rate); return r.data; });
    ksOut.buf = ab; ksOut.rate = rawCache.get(rk) || 1;
    return ksOut;
  }
  // drumBuf(G, tipo, variante) -> AudioBuffer
  function drumBuf(G, kind, v) { const key = 'drum:' + kind + ':' + (v || 0); return cached(G, key, hashStr(key), D => renderDrum(D, kind)); }
  // instBuf(G, inst, midi) -> AudioBuffer (instrumentos não-KS)
  function instBuf(G, inst, midi) { const key = 'inst:' + inst + ':' + midi; return cached(G, key, hashStr(key), D => renderInst(D, inst, midi)); }
  // noiseLoop(G) -> AudioBuffer de ruído rosa em loop (sopro do shakuhachi)
  function noiseLoop(G) {
    return cached(G, 'pinkloop', 4242, D => { const n = Math.floor(1.5 * D.sr), xf = Math.floor(0.1 * D.sr), b = new Float32Array(n + xf), g = D.noiseGen('pink'); for (let i = 0; i < b.length; i++) b[i] = g(); return D.fold(b, n); });
  }

  /* ======================================================================
     E.Audio — contexto, volumes, mute, destrava, ducking
     ====================================================================== */
  const audioEv = E.Emitter ? E.Emitter() : { on() { return () => {}; }, emit() {} };
  // ready() -> true se o contexto ao vivo existe e está rodando
  // (logo depois de um unlock() o contexto ainda está "suspended" por alguns ms: já aceita som, pra não perder o primeiro clique)
  function ready() { return !!L && (L.ctx.state === 'running' || (L.unlockAt > 0 && Date.now() - L.unlockAt < 1500)); }
  const now = () => (L ? L.ctx.currentTime : 0);

  function applyVolumes(tc) {
    if (!L) return;
    const t = L.ctx.currentTime; tc = tc || 0.03;
    L.master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume, t, tc);
    L.sfx.gain.setTargetAtTime(BUS.sfx * settings.sfxVol, t, tc);
    L.loop.gain.setTargetAtTime(BUS.loop * settings.sfxVol, t, tc);
    L.music.gain.setTargetAtTime(BUS.music * settings.musicVol, t, tc);
    persistSoon();
  }

  let persistKey = null, persistT = 0;
  function persistSoon() {
    if (!persistKey || persistT) return;
    persistT = setTimeout(() => { persistT = 0; try { root.localStorage.setItem(persistKey, JSON.stringify(settings)); } catch (err) { /* sem storage: segue */ } }, 400);
  }

  let onFlush = [];                   // Loops e Music registram aqui o que fazer quando o áudio destrava
  function flush() { if (!ready()) return; for (let i = 0; i < onFlush.length; i++) { try { onFlush[i](); } catch (err) { warn('flush', err); } } audioEv.emit('unlock'); }

  let suspendT = 0;
  const Audio = {
    // init() -> bool: cria o contexto e o grafo (idempotente). Chame num gesto do usuário; devolve false se não há áudio
    init() {
      if (L) return true;
      if (failed || !AC) { failed = true; return false; }
      try {
        let ctx; try { ctx = new AC({ latencyHint: 'interactive' }); } catch (err) { ctx = new AC(); }
        L = buildGraph(ctx, false);
        if (ctx.addEventListener) ctx.addEventListener('statechange', flush);
        if (ctx.state === 'running') flush();
      } catch (err) { failed = true; L = null; warn('sem AudioContext', err); return false; }
      return true;
    },
    // unlock(): init + resume + "chute" silencioso do iOS. Pode chamar em todo gesto
    unlock() {
      if (!Audio.init()) return false;
      const ctx = L.ctx;
      try {
        if (ctx.state !== 'running' && !settings.muted) { L.unlockAt = Date.now(); const p = ctx.resume(); if (p && p.then) p.then(flush, () => {}); flush(); }
        if (!L.kicked) { L.kicked = true; const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); }
        if (root.navigator && root.navigator.audioSession) root.navigator.audioSession.type = 'playback';
      } catch (err) { /* navegador chato: fica mudo, não quebra */ }
      return true;
    },
    // suspend(): pausa o contexto (economiza bateria); resume(): volta
    suspend() { if (L && L.ctx.state === 'running') { try { L.ctx.suspend(); } catch (err) { /* ok */ } } },
    resume() { if (L && L.ctx.state !== 'running' && !settings.muted) { try { const p = L.ctx.resume(); if (p && p.then) p.then(flush, () => {}); } catch (err) { /* ok */ } } },
    // ctx / master: AudioContext e GainNode master (null antes do init)
    get ctx() { return L ? L.ctx : null; },
    get master() { return L ? L.master : null; },
    // ready: true quando dá pra ouvir (contexto criado e rodando)
    get ready() { return ready(); },
    // available: false se o navegador não tem Web Audio
    get available() { return !!AC && !failed; },
    // muted (get/set): silencia tudo com rampa; suspende o contexto depois de meio segundo mudo
    get muted() { return settings.muted; },
    set muted(v) {
      v = !!v; if (v === settings.muted) return;
      settings.muted = v; clearTimeout(suspendT);
      if (v) { applyVolumes(0.03); suspendT = setTimeout(() => { if (settings.muted) Audio.suspend(); }, 500); }
      else { Audio.resume(); applyVolumes(0.05); }
      audioEv.emit('mute', v);
    },
    // volume / sfxVol / musicVol (get/set 0..1)
    get volume() { return settings.volume; }, set volume(v) { settings.volume = clamp(+v || 0, 0, 1); applyVolumes(); },
    get sfxVol() { return settings.sfxVol; }, set sfxVol(v) { settings.sfxVol = clamp(+v || 0, 0, 1); applyVolumes(); },
    get musicVol() { return settings.musicVol; }, set musicVol(v) { settings.musicVol = clamp(+v || 0, 0, 1); applyVolumes(); },
    // autoInit: se true (padrão), o primeiro toque/tecla na página já chama unlock()
    autoInit: true,
    // persist(chave='kome.audio'): carrega e passa a gravar {muted, volume, sfxVol, musicVol} no localStorage
    persist(key) {
      persistKey = key || 'kome.audio';
      try { const o = JSON.parse(root.localStorage.getItem(persistKey) || 'null'); if (o) { for (const k in settings) if (typeof o[k] === typeof settings[k]) settings[k] = o[k]; applyVolumes(); } } catch (err) { /* ok */ }
      return Audio;
    },
    // duck(profundidade=0.5, volta=0.9): abaixa a música um instante pra um som importante aparecer
    duck(depth, rel) {
      if (!ready()) return;
      const t = L.ctx.currentTime, g = L.duck.gain; depth = depth === undefined ? 0.5 : depth;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(1 - depth, t + 0.04); g.setTargetAtTime(1, t + 0.15, (rel || 0.9) / 3);
    },
    // analyser: AnalyserNode na saída (pra medidores/visualizadores); null antes do init
    get analyser() { return L ? L.analyser || null : null; },
    // voices: quantas vozes de sfx estão soando agora
    get voices() { return L ? L.voices.length : 0; },
    // on('unlock'|'mute', fn) -> off
    on(ev, fn) { return audioEv.on(ev, fn); },
    // prewarm(nomes?): renderiza sfx/loops em fatias ociosas pra não engasgar no primeiro uso
    prewarm(names) { prewarm(names); },
    // mtof(midi) -> Hz ; DSP(sr, seed) -> kit de síntese (pra quem define som próprio)
    mtof, DSP,
  };

  if (doc && root.addEventListener) {
    const kick = () => { if (L || Audio.autoInit) Audio.unlock(); };
    ['pointerdown', 'touchend', 'keydown'].forEach(ev => root.addEventListener(ev, kick, { passive: true, capture: true }));
    doc.addEventListener('visibilitychange', () => { if (!L) return; if (doc.hidden) Audio.suspend(); else Audio.resume(); });
  }

  /* ======================================================================
     E.Sfx — motor: definições, vozes, gate, api de composição
     ====================================================================== */
  const DEFS = Object.create(null);   // nome -> {render, play, v, gate, max, vol, peak, jit, rev, duck, prio, sub, weight}
  const MAX_VOICES = 28;
  // skins de recompensa (GDD §14, tabela de rotação): o mesmo evento troca de timbre a cada fase
  const SKINS = [
    { id: 'A', inst: 'kalimba', label: 'kalimba' },
    { id: 'B', inst: 'koto', label: 'koto' },
    { id: 'C', inst: 'shami', label: 'shamisen' },
    { id: 'D', inst: 'marimba', label: 'marimba + caixa', extra: 'kaching' },
    { id: 'E', inst: 'bell', label: 'sino + taiko', extra: 'chu' },
    { id: 'F', inst: 'brass', label: 'metais' },
    { id: 'G', inst: 'orch', label: 'orquestra + coro' },
  ];
  // escada de ferramentas do GDD §3/§8.1 (12 degraus): nome do som, grave do impacto (Hz) e peso padrão
  const TOOLS = [
    { id: 'paw', sub: 0, w: 0 }, { id: 'hashi', sub: 0, w: 0 }, { id: 'bowl', sub: 0, w: 0 },
    { id: 'shovel', sub: 200, w: 0.3 }, { id: 'shovel2', sub: 200, w: 0.35 }, { id: 'barrow', sub: 150, w: 0.45 },
    { id: 'tractor', sub: 90, w: 0.55 }, { id: 'forklift', sub: 80, w: 0.6 }, { id: 'excavator', sub: 70, w: 0.7 },
    { id: 'ropeshovel', sub: 55, w: 0.8 }, { id: 'hauler', sub: 45, w: 0.9 }, { id: 'bagger', sub: 35, w: 1 },
  ];
  let skin = 0, toolTier = 3;
  const gates = Object.create(null);

  function skinOf(o) {
    let s = o.skin !== undefined ? o.skin : o.variant !== undefined ? o.variant : skin;
    if (typeof s === 'string') s = Math.max(0, 'ABCDEFG'.indexOf(s.toUpperCase()));
    return SKINS[((s | 0) % SKINS.length + SKINS.length) % SKINS.length];
  }
  // escala corrente da trilha (pra afinar moeda/combo com a música); padrão: yo em Ré
  const tune = { scale: [0, 2, 5, 7, 9], root: 62 };
  // degMidi(grau, escala, raiz) -> midi (graus negativos descem oitava)
  function degMidi(deg, scale, rootMidi) { const n = scale.length, o = Math.floor(deg / n); return rootMidi + 12 * o + scale[deg - o * n]; }

  function voiceDone(G, v) {
    if (--v.n > 0 || v.dead) return;
    v.dead = true;
    try { v.tail.disconnect(); if (v.send) v.send.disconnect(); } catch (err) { /* já solto */ }
    const i = G.voices.indexOf(v); if (i >= 0) G.voices.splice(i, 1);
  }
  // steal(G, v): cala uma voz em 15 ms (sem clique) pra abrir vaga
  function steal(G, v) {
    const t = G.ctx.currentTime, g = v.g.gain;
    try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.015); } catch (err) { /* ok */ }
    const i = G.voices.indexOf(v); if (i >= 0) G.voices.splice(i, 1);
  }

  /* api passada pras funções de E.Sfx.define(nome, fn(api, opts)). Um objeto só, reaproveitado (uso síncrono).
     Todos os tempos `delay` são relativos ao início do som. */
  const api = {
    G: null, v: null, t: 0, pitch: 1, name: '', opts: NOOPTS,
    // ctx / out / sr: contexto, nó de saída desta voz e sample rate (pra montar nós na mão)
    get ctx() { return this.G.ctx; }, get out() { return this.v.g; }, get sr() { return this.G.sr; },
    // rnd() -> 0..1 (fixo em render offline, pra testes reproduzíveis)
    rnd() { return this.G.offline ? 0.5 : Math.random(); },
    // src(audioBuffer, {rate=1, vol=1, delay=0, pan=0, exact=false}): toca um AudioBuffer nesta voz
    src(ab, o) {
      o = o || NOOPTS;
      const G = this.G, v = this.v, ctx = G.ctx, s = ctx.createBufferSource(); s.buffer = ab;
      const rate = (o.rate || 1) * (o.exact ? 1 : this.pitch); s.playbackRate.value = rate;
      let node = s;
      if (o.vol !== undefined && o.vol !== 1) { const g = ctx.createGain(); g.gain.value = o.vol; node.connect(g); node = g; }
      if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); node.connect(p); node = p; }
      node.connect(v.g); v.n++;
      s.onended = () => { try { node.disconnect(); } catch (err) { /* ok */ } voiceDone(G, v); };
      s.start(this.t + (o.delay || 0));
      return s;
    },
    // buf(chave, fn(D)->Float32Array, opts): renderiza (uma vez, com cache) e toca um som próprio
    buf(key, fn, o) { return this.src(cached(this.G, 'user:' + key, hashStr(key), fn), o); },
    // tone(f, d, tipo='square', v=.2, slide=0, delay=0): oscilador ao vivo com envelope sem clique
    tone(f, d, type, vol, slide, delay) {
      const G = this.G, v = this.v, ctx = G.ctx, t = this.t + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
      d = Math.max(0.01, d || 0.1); vol = vol === undefined ? 0.2 : vol; f = Math.max(20, f * this.pitch);
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.005 + d);
      o.connect(g); g.connect(v.g); v.n++;
      o.onended = () => { try { g.disconnect(); } catch (err) { /* ok */ } voiceDone(G, v); };
      o.start(t); o.stop(t + d + 0.03);
    },
    // noise(d, f=1200, v=.2, q=1, delay=0): rajada de ruído passa-banda ao vivo
    noise(d, f, vol, q, delay) {
      const G = this.G, v = this.v, ctx = G.ctx, t = this.t + (delay || 0), s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      d = Math.max(0.01, d || 0.1); vol = vol === undefined ? 0.2 : vol;
      s.buffer = cached(G, 'white1s', 99, D => { const b = D.buf(1), gen = D.noiseGen('white'); for (let i = 0; i < b.length; i++) b[i] = gen(); return b; });
      fl.type = 'bandpass'; fl.frequency.value = (f || 1200) * this.pitch; fl.Q.value = q || 1;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.003 + d);
      s.connect(fl); fl.connect(g); g.connect(v.g); v.n++;
      s.onended = () => { try { g.disconnect(); } catch (err) { /* ok */ } voiceDone(G, v); };
      s.start(t, this.rnd() * 0.5); s.stop(t + d + 0.03);
    },
    // note(midi, {inst (padrão = skin atual), vel=.7, delay=0, pan}): nota afinada de um instrumento de recompensa
    note(midi, o) {
      o = o || NOOPTS;
      const inst = o.inst || skinOf(this.opts).inst, G = this.G; midi = Math.round(midi);
      tmpSrc.vol = o.vel === undefined ? 0.7 : o.vel; tmpSrc.delay = o.delay || 0; tmpSrc.pan = o.pan || 0; tmpSrc.exact = false;
      if (KS_INST[inst]) { const k = ksBuf(G, midi, inst); tmpSrc.rate = k.rate; return this.src(k.buf, tmpSrc); }
      tmpSrc.rate = 1; return this.src(instBuf(G, inst, midi), tmpSrc);
    },
    // pluck(midi, {vel, delay, kind='koto'}): corda dedilhada (koto, shami, bass, harp)
    pluck(midi, o) { o = o || NOOPTS; tmpNote.inst = o.kind || 'koto'; tmpNote.vel = o.vel; tmpNote.delay = o.delay; tmpNote.pan = o.pan; return this.note(midi, tmpNote); },
    // drum(tipo, {vel=.7, delay=0, rate=1}): don, chu, ten, ka, chan, chiki, clap, furin, drop, anvil
    drum(kind, o) {
      o = o || NOOPTS;
      tmpSrc.vol = o.vel === undefined ? 0.7 : o.vel; tmpSrc.delay = o.delay || 0; tmpSrc.pan = o.pan || 0; tmpSrc.rate = o.rate || 1; tmpSrc.exact = false;
      return this.src(drumBuf(this.G, kind, 0), tmpSrc);
    },
    // deg(grau, oitava=1) -> midi na escala corrente da trilha (0 = tônica)
    deg(d, oct) { return degMidi(d, tune.scale, tune.root) + 12 * (oct === undefined ? 1 : oct); },
    // play(nome, opts): dispara outro som registrado (voz separada), com delay relativo a este
    play(name, o) {
      o = o || NOOPTS;
      tmpPlay.pitch = (o.pitch || 1) * this.pitch; tmpPlay.vol = (o.vol === undefined ? 1 : o.vol) * (this.opts.vol === undefined ? 1 : this.opts.vol);
      tmpPlay.pan = o.pan !== undefined ? o.pan : this.opts.pan; tmpPlay.delay = o.delay || 0; tmpPlay.weight = o.weight !== undefined ? o.weight : this.opts.weight;
      tmpPlay.skin = this.opts.skin; tmpPlay.variant = this.opts.variant; tmpPlay.exact = o.exact;
      return playOn(this.G, name, tmpPlay, this.t, true);
    },
  };
  const tmpSrc = { rate: 1, vol: 1, delay: 0, pan: 0, exact: false };
  const tmpNote = { inst: 'koto', vel: 0.7, delay: 0, pan: 0 };
  const tmpPlay = { pitch: 1, vol: 1, pan: 0, delay: 0, weight: undefined, skin: undefined, variant: undefined, exact: false };

  /* playOn(G, nome, opts, t0, nested) -> voz|null: toca um som num grafo (ao vivo ou offline) */
  function playOn(G, name, o, t0, nested) {
    const def = DEFS[name]; if (!G || !def) return null;
    o = o || NOOPTS;
    if (nested) o = Object.assign({}, o);                                 // tmpPlay é reaproveitado: som aninhado guarda a sua cópia
    const ctx = G.ctx, tNow = ctx.currentTime, t = Math.max(tNow, t0 || 0) + (o.delay || 0);
    if (!G.offline) {
      if (def.gate && !nested) { const last = G.lastT[name]; if (last !== undefined && t - last < def.gate && t >= last) return null; G.lastT[name] = t; }
      let same = 0, oldest = null;
      for (let i = 0; i < G.voices.length; i++) { const w = G.voices[i]; if (w.name === name) { same++; if (!oldest || w.t0 < oldest.t0) oldest = w; } }
      if (same >= (def.max || 4)) steal(G, oldest);
      if (G.voices.length >= MAX_VOICES) { let w = G.voices[0]; for (let i = 1; i < G.voices.length; i++) { const c = G.voices[i]; if (c.prio < w.prio || (c.prio === w.prio && c.t0 < w.t0)) w = c; } steal(G, w); }
    }
    // voz: ganho (+ pan) -> bus de sfx (+ mandada de reverb)
    const jit = G.offline || o.exact ? 0 : 1;
    const g = ctx.createGain(); g.gain.value = (def.vol === undefined ? 1 : def.vol) * (o.vol === undefined ? 1 : o.vol) * (1 + jit * (Math.random() * 0.2 - 0.1));
    let tail = g;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); tail = p; }
    tail.connect(G.sfx);
    const v = { name, g, tail, send: null, n: 0, t0: t, prio: def.prio || 0, dead: false };
    if (def.rev) { v.send = ctx.createGain(); v.send.gain.value = def.rev; tail.connect(v.send); v.send.connect(G.revSend); }
    G.voices.push(v);
    // a api é um objeto só: guarda o estado de quem chamou (sons aninhados) e restaura no fim
    const pG = api.G, pv = api.v, pt = api.t, pp = api.pitch, pn = api.name, po = api.opts;
    api.G = G; api.v = v; api.t = t; api.name = name; api.opts = o;
    api.pitch = (o.pitch || 1) * (jit ? semi((Math.random() * 2 - 1) * (def.jit === undefined ? 0.5 : def.jit)) : 1);
    try {
      if (def.render) {
        const nv = def.v || 1; let vi = 0;
        if (nv > 1) {
          if (G.offline || o.exact) vi = ((o.variant | 0) % nv + nv) % nv;
          else { do { vi = Math.floor(Math.random() * nv); } while (vi === G.lastVar[name]); G.lastVar[name] = vi; }
        }
        const key = 'sfx:' + name + ':' + vi;
        api.src(cached(G, key, hashStr(key), D => D.finish(def.render(D, vi), def.peak === undefined ? 0.5 : def.peak)));
      }
      if (def.sub) {
        const w = o.weight !== undefined ? o.weight : def.weight || 0;
        if (w > 0.01) { tmpSrc.rate = 1; tmpSrc.vol = Math.min(1.6, w); tmpSrc.delay = def.subAt || 0; tmpSrc.pan = 0; tmpSrc.exact = true; api.src(subBuf(G, def.sub), tmpSrc); }
      }
      if (def.play) def.play(api, o);
    } catch (err) { warn('som "' + name + '"', err); }
    api.G = pG; api.v = pv; api.t = pt; api.pitch = pp; api.name = pn; api.opts = po;
    if (v.n === 0) { v.n = 1; voiceDone(G, v); }
    if (def.duck && !G.offline && !nested) Audio.duck(def.duck, 0.9);
    return v;
  }

  // subBuf(G, hz) -> AudioBuffer: o "grave do impacto" de uma ferramenta (fica mais fundo e longo a cada degrau)
  function subBuf(G, hz) {
    return cached(G, 'sub:' + hz, hz, D => {
      const d = 0.1 + 14 / hz, b = D.buf(d + 0.06);
      D.osc(b, { f: hz * 1.9, f1: hz, slide: 0.05, a: 0.004, s: 0.03, d, vol: 0.9, punch: 0.3, curve: 2.2 });
      D.osc(b, { f: hz * 2, d: d * 0.5, vol: 0.2, curve: 2 });
      D.noise(b, { color: 'brown', d: 0.05, vol: 0.3, lp: hz * 4 });
      D.sat(b, 1.7); return D.finish(b, 0.7);
    });
  }

  // def(nome, meta, render): atalho interno pra registrar um som pré-renderizado
  function def(name, meta, render) { const d = meta || {}; if (typeof render === 'function') d.render = render; DEFS[name] = d; return d; }
  // comp(nome, meta, play): atalho interno pra som composto (função que usa a api)
  function comp(name, meta, play) { const d = meta || {}; d.play = play; DEFS[name] = d; return d; }

  /* ======================================================================
     E.Sfx — biblioteca de sons
     ====================================================================== */

  /* ---------- escada de ferramentas (GDD §8.1): cada degrau tem corpo próprio + grave mais fundo ---------- */
  def('paw', { v: 4, gate: 0.04, max: 4, jit: 2, peak: 0.36 }, D => {                     // patinha no arroz: "pof" seco e macio
    const b = D.buf(0.2);
    D.noise(b, { a: 0.004, s: 0.015, d: 0.05, vol: 0.3, hp: 900, lp: 2800, lp1: 1600 });      // mais abafado (antes chiava)
    D.grains(b, { n: 2 + Math.floor(D.rnd() * 3), t0: 0.005, t1: 0.08, f0: 2800, f1: 4500, vol: 0.1 });
    D.osc(b, { f: D.rr(140, 165), f1: 85, d: 0.06, vol: 0.45 });
    return b;
  });
  def('hashi', { v: 4, gate: 0.05, max: 4, jit: 1, peak: 0.36 }, D => {                   // hashi: "tic" de madeira + um grão
    const b = D.buf(0.18), t2 = D.rr(0.04, 0.055);
    D.osc(b, { wave: 'tri', f: 1400, d: 0.014, vol: 0.35, curve: 3 }); D.modal(b, 700, [1, 2.7], [0.3, 0.1], [0.04, 0.025]);   // "toc" de madeira mais grave
    D.noise(b, { d: 0.005, vol: 0.12, hp: 2500, lp: 6000 });
    D.osc(b, { at: t2, wave: 'tri', f: 1600, d: 0.014, vol: 0.25, curve: 3 }); D.modal(b, 820, [1, 2.7], [0.2, 0.08], [0.04, 0.025], { at: t2 });
    return b;
  });
  def('bowl', { v: 3, gate: 0.06, max: 4, jit: 1, peak: 0.4, rev: 0.15 }, D => {          // tigela: raspada + "clac" de cerâmica + chuva de grãos
    const b = D.buf(0.5), k = D.rr(0.95, 1.06);
    D.noise(b, { a: 0.02, s: 0.05, d: 0.08, vol: 0.35, bp: 2500, bp1: 5500, q: 0.9 });
    D.modal(b, 1320 * k, [1, 2.19, 3.75], [0.32, 0.16, 0.07], [0.28, 0.2, 0.1], { at: 0.09 });
    D.noise(b, { at: 0.09, d: 0.005, vol: 0.2, hp: 3000 });
    D.grains(b, { n: 9, t0: 0.14, t1: 0.36, f0: 5000, f1: 9000, vol: 0.12 });
    return b;
  });
  def('shovel', { v: 4, gate: 0.07, max: 4, jit: 1.2, peak: 0.45, sub: 200, weight: 0.3 }, D => {   // pá: "tchac" + anel de metal + arroz voando
    const b = D.buf(0.48);
    D.noise(b, { a: 0.004, s: 0.05, d: 0.09, vol: 0.5, bp: 900, bp1: 2600, q: 0.8 });
    D.modal(b, D.rr(1080, 1180), [1, 2.336], [0.14, 0.09], [0.1, 0.07]);
    D.osc(b, { f: 200, f1: 95, d: 0.09, vol: 0.4 });
    D.noise(b, { at: 0.17, a: 0.03, d: 0.22, vol: 0.2, hp: 3000 });
    D.grains(b, { n: 6, t0: 0.2, t1: 0.4, f0: 5000, f1: 9000, vol: 0.1 });
    return b;
  });
  comp('shovel2', { gate: 0.08, max: 3, weight: 0.35 }, (a, o) => {                       // duas pás: "tchac-tchac" em estéreo
    a.play('shovel', { pan: -0.45, weight: o.weight === undefined ? 0.35 : o.weight });
    a.play('shovel', { pan: 0.45, delay: 0.085, pitch: 1.07, vol: 0.9, weight: (o.weight === undefined ? 0.35 : o.weight) * 0.8 });
  });
  const barrow = D => {                                                                   // carrinho: roda rangendo + "fwump" + arroz despejando
    const b = D.buf(0.65), k = D.rr(0.94, 1.04);
    D.osc(b, { path: [[0, 1500 * k], [0.08, 1950 * k], [0.16, 1600 * k]], vib: 0.04, vibHz: 28, a: 0.02, s: 0.09, d: 0.05, vol: 0.13 });
    D.osc(b, { at: 0.08, f: 150, f1: 70, d: 0.15, vol: 0.6, punch: 0.3 }); D.noise(b, { at: 0.08, d: 0.1, vol: 0.4, lp: 500 });
    D.osc(b, { at: 0.085, wave: 'tri', f: 320, f1: 180, d: 0.06, vol: 0.3 });
    D.noise(b, { at: 0.14, a: 0.05, s: 0.12, d: 0.3, vol: 0.22, hp: 2000 });
    return b;
  };
  def('barrow', { v: 3, gate: 0.09, max: 3, jit: 1, peak: 0.5, sub: 150, subAt: 0.08, weight: 0.45 }, barrow);
  def('cart', { v: 3, gate: 0.09, max: 3, jit: 1, peak: 0.5, sub: 150, subAt: 0.08, weight: 0.3 }, barrow);
  def('tractor', { v: 3, gate: 0.12, max: 3, jit: 0.8, peak: 0.5, sub: 90, weight: 0.55 }, D => {   // trator: dois "pon" de diesel + lâmina raspando + onda de arroz
    const b = D.buf(0.75);
    for (let i = 0; i < 2; i++) { const at = i * D.rr(0.085, 0.1); D.osc(b, { at, f: 98, f1: 55, d: 0.055, vol: 0.7 }); D.noise(b, { at, color: 'brown', d: 0.04, vol: 0.5, lp: 500 }); D.noise(b, { at, d: 0.008, vol: 0.12, bp: 1400, q: 1.2 }); }
    D.noise(b, { a: 0.02, s: 0.14, d: 0.2, vol: 0.32, bp: 700, bp1: 1500, q: 1 });
    D.noise(b, { at: 0.1, color: 'pink', a: 0.1, s: 0.1, d: 0.38, vol: 0.5, hp: 2500 });
    return b;
  });
  def('forklift', { v: 3, gate: 0.12, max: 3, jit: 0.8, peak: 0.5, sub: 80, subAt: 0.34, weight: 0.6 }, D => {   // empilhadeira: zumbido elétrico + "ka-chunk"
    const b = D.buf(0.7), t = D.buf(0.4);
    D.osc(t, { wave: 'saw', f: 280, f1: 520, slide: 0.26, a: 0.03, s: 0.2, d: 0.08, vol: 0.5 }); D.osc(t, { wave: 'saw', f: 421, f1: 782, slide: 0.26, a: 0.03, s: 0.2, d: 0.08, vol: 0.3 });
    D.filter(t, 'bp', 900, 2.5, 1700); D.mix(b, t, 0, 0.5);
    D.noise(b, { at: 0.27, d: 0.02, vol: 0.4, bp: 2500, q: 1.5 }); D.modal(b, 700, [1, 1.83, 2.9], [0.2, 0.12, 0.06], [0.08, 0.06, 0.04], { at: 0.27 });
    D.osc(b, { at: 0.34, f: 125, f1: 60, d: 0.13, vol: 0.7, punch: 0.3 }); D.noise(b, { at: 0.34, d: 0.06, vol: 0.4, lp: 700 });
    D.modal(b, 310, [1, 1.59, 2.4], [0.15, 0.1, 0.06], [0.18, 0.12, 0.08], { at: 0.34 });
    return b;
  });
  def('excavator', { v: 3, gate: 0.15, max: 3, jit: 0.7, peak: 0.5, sub: 70, subAt: 0.3, weight: 0.7 }, D => {   // escavadeira: chiado hidráulico + mordida de 70 Hz + arroz caindo
    const b = D.buf(0.95), t = D.buf(0.4);
    D.osc(t, { wave: 'saw', f: 380, f1: 640, slide: 0.3, a: 0.03, s: 0.22, d: 0.08, vol: 0.5 }); D.osc(t, { wave: 'saw', f: 571, f1: 962, slide: 0.3, a: 0.03, s: 0.22, d: 0.08, vol: 0.4 });
    D.filter(t, 'bp', 760, 5, 1280); D.mix(b, t, 0, 0.35);
    D.noise(b, { a: 0.02, s: 0.24, d: 0.12, vol: 0.14, hp: 3500 });
    D.osc(b, { at: 0.3, f: 115, f1: 50, d: 0.17, vol: 0.8, punch: 0.3 }); D.noise(b, { at: 0.3, d: 0.1, vol: 0.45, lp: 500 });
    D.modal(b, 240, [1, 1.59, 2.31], [0.12, 0.08, 0.05], [0.3, 0.2, 0.12], { at: 0.3 });
    D.noise(b, { at: 0.32, color: 'pink', a: 0.05, d: 0.5, vol: 0.55, hp: 2200 });
    return b;
  });
  def('ropeshovel', { v: 2, gate: 0.2, max: 2, jit: 0.6, peak: 0.52, sub: 55, subAt: 0.7, weight: 0.8, rev: 0.15 }, D => {   // pá de cabo: cabo gemendo subindo + estrondo de 55 Hz + cachoeira
    const b = D.buf(1.9), t = D.buf(0.8);
    D.osc(t, { wave: 'saw', path: [[0, 108], [0.5, 150], [0.75, 170]], vib: 0.02, vibHz: 5, a: 0.15, s: 0.4, d: 0.2, vol: 0.6 });
    D.noise(t, { color: 'brown', a: 0.15, s: 0.4, d: 0.2, vol: 0.8 });
    const g = D.buf(0.8); const fs = [210, 318, 467];
    for (let i = 0; i < 3; i++) { const c = t.slice(); D.filter(c, 'bp', fs[i], 14, fs[i] * 1.4); D.mix(g, c, 0, 1 - i * 0.25); }
    D.mix(b, g, 0, 1.2);
    D.osc(b, { at: 0.7, f: 95, f1: 40, d: 0.32, vol: 0.9, punch: 0.4 }); D.noise(b, { at: 0.7, d: 0.14, vol: 0.5, lp: 450 });
    D.modal(b, 150, [1, 1.59, 2.31, 3.13], [0.15, 0.1, 0.07, 0.04], [0.6, 0.4, 0.3, 0.2], { at: 0.7 });
    D.noise(b, { at: 0.72, color: 'pink', a: 0.1, s: 0.3, d: 0.75, vol: 0.6, hp: 1500 });
    return b;
  });
  def('hauler', { v: 2, gate: 0.25, max: 2, jit: 0.5, peak: 0.52, sub: 45, subAt: 0.1, weight: 0.9, rev: 0.15 }, D => {   // caminhão gigante: ronco de 45 Hz + lençol de arroz
    const b = D.buf(1.9);
    D.noise(b, { color: 'brown', a: 0.1, s: 0.5, d: 0.6, vol: 0.9, lp: 160 });
    D.osc(b, { wave: 'saw', f: 45, a: 0.08, s: 0.6, d: 0.5, vol: 0.35, lp: 220, vib: 0.01, vibHz: 9 });
    D.osc(b, { at: 0.1, f: 85, f1: 36, d: 0.36, vol: 0.8, punch: 0.3 });
    D.noise(b, { at: 0.15, color: 'pink', a: 0.2, s: 0.5, d: 0.95, vol: 0.75, hp: 1500 });
    D.noise(b, { at: 0.2, color: 'brown', a: 0.2, s: 0.4, d: 0.7, vol: 0.4, bp: 300, q: 0.8 });
    return b;
  });
  def('bagger', { v: 4, gate: 0.1, max: 4, jit: 1, peak: 0.5, sub: 35, weight: 1, rev: 0.35 }, D => {   // Bagger 293: caçamba batendo ("tchac" de aço) + arroz + 35 Hz
    const b = D.buf(0.95), f0 = D.rr(170, 240);
    D.modal(b, f0, [1, 1.59, 2.31, 3.13, 4.27], [0.3, 0.18, 0.14, 0.09, 0.06], [0.7, 0.5, 0.35, 0.2, 0.12]);
    D.noise(b, { d: 0.012, vol: 0.35, hp: 3000 }); D.noise(b, { d: 0.05, vol: 0.3, bp: 900, q: 0.8 });
    D.noise(b, { color: 'pink', a: 0.05, d: 0.36, vol: 0.5, hp: 2500 });
    return b;
  });

  /* ---------- impactos, metal, máquinas ---------- */
  def('thud', { v: 3, gate: 0.05, peak: 0.5 }, D => { const b = D.buf(0.3); D.osc(b, { f: D.rr(105, 125), f1: 50, d: 0.2, vol: 0.8, punch: 0.3 }); D.noise(b, { d: 0.07, vol: 0.4, lp: 450 }); return b; });
  def('clank', { v: 4, gate: 0.06, peak: 0.45, rev: 0.25 }, D => {
    const b = D.buf(0.8); D.modal(b, D.rr(180, 235), [1, 1.59, 2.31, 3.13, 4.27], [1, 0.6, 0.45, 0.3, 0.2], [0.7, 0.5, 0.35, 0.2, 0.12]);
    D.noise(b, { d: 0.012, vol: 0.8, hp: 3000 }); D.osc(b, { f: 130, f1: 70, d: 0.06, vol: 0.6 }); return b;
  });
  def('metal', { v: 4, gate: 0.05, peak: 0.42, rev: 0.2 }, D => {
    const b = D.buf(0.6); D.modal(b, D.rr(480, 600), [1, 1.47, 2.09, 2.56, 3.4, 4.3], [1, 0.8, 0.6, 0.5, 0.3, 0.2], [0.5, 0.42, 0.3, 0.25, 0.16, 0.1]);
    D.noise(b, { d: 0.008, vol: 1, hp: 4000 }); return b;
  });
  def('hydraulic', { v: 2, gate: 0.15, max: 2, peak: 0.36 }, D => {                        // braço movendo: gemido subindo, cai e solta o "psst"
    const b = D.buf(1.05), t = D.buf(0.75), k = D.rr(0.92, 1.08);
    D.osc(t, { wave: 'saw', path: [[0, 380 * k], [0.5, 700 * k], [0.62, 690 * k], [0.74, 420 * k]], a: 0.05, s: 0.55, d: 0.14, vol: 0.5 });
    D.osc(t, { wave: 'saw', path: [[0, 571 * k], [0.5, 1052 * k], [0.62, 1037 * k], [0.74, 631 * k]], a: 0.05, s: 0.55, d: 0.14, vol: 0.4 });
    D.filter(t, 'bp', 760 * k, 5, 1300 * k); D.mix(b, t, 0, 1);
    D.noise(b, { a: 0.05, s: 0.5, d: 0.1, vol: 0.05, hp: 3500 });
    D.noise(b, { at: 0.72, a: 0.005, d: 0.2, vol: 0.5, hp: 4500 }); D.osc(b, { at: 0.72, f: 90, f1: 50, d: 0.08, vol: 0.5 });
    return b;
  });
  def('steam', { v: 3, gate: 0.1, peak: 0.3 }, D => { const b = D.buf(0.5); D.noise(b, { a: 0.005, s: 0.05, d: 0.4, vol: 0.5, hp: 4500, hp1: 2500, curve: 3 }); return b; });
  def('horn', { gate: 0.3, max: 2, peak: 0.42, rev: 0.3, duck: 0.3, jit: 0 }, D => {       // buzina de caminhão de entrega (duas notas)
    const b = D.buf(0.75), o = { wave: 'saw', f: 311, a: 0.03, s: 0.5, d: 0.15, vol: 0.4, vib: 0.004, vibHz: 6 };
    D.osc(b, o); o.f = 370; D.osc(b, o); o.f = 313; o.vol = 0.2; D.osc(b, o); o.f = 185; D.osc(b, o);
    D.filter(b, 'lp', 900, 1.5, 1700); return b;
  });
  def('hornBig', { gate: 0.5, max: 1, peak: 0.5, rev: 0.5, duck: 0.5, jit: 0, prio: 2 }, D => {   // buzina da Bagger: tríade grave que abre devagar
    const b = D.buf(2.0), o = { wave: 'saw', f: 92, a: 0.12, s: 1.4, d: 0.3, vol: 0.4, vib: 0.003, vibHz: 4 };
    D.osc(b, o); o.f = 116; D.osc(b, o); o.f = 138; D.osc(b, o); o.f = 92.6; o.vol = 0.25; D.osc(b, o); o.f = 46; D.osc(b, o);
    D.filter(b, 'lp', 700, 1.4, 1900); D.sat(b, 1.4); return b;
  });
  def('beep', { gate: 0.1, max: 2, peak: 0.26, jit: 0 }, D => { const b = D.buf(0.32); D.osc(b, { wave: 'sq', f: 1050, a: 0.004, s: 0.26, d: 0.03, vol: 0.5, lp: 3000 }); return b; });
  comp('reverse', { gate: 0.5, max: 1 }, a => { for (let i = 0; i < 3; i++) a.play('beep', { delay: i * 0.6, exact: true }); });   // ré do caminhão: 3 bipes
  def('engineStart', { gate: 0.5, max: 1, peak: 0.5, jit: 0.5, prio: 1 }, D => {           // motor de arranque "ruh-ruh-ruh" e o diesel pegando
    const b = D.buf(1.9);
    for (let i = 0; i < 5; i++) { const at = i * 0.13; D.osc(b, { at, wave: 'saw', f: 140, f1: 190, a: 0.02, s: 0.05, d: 0.05, vol: 0.2, lp: 1200 }); D.noise(b, { at, a: 0.02, s: 0.05, d: 0.05, vol: 0.2, bp: 900, q: 1.5 }); }
    let at = 0.66, gap = 0.11;
    for (let i = 0; i < 16; i++) {                                                        // pulsos acelerando até a marcha lenta
      const amp = 0.5 + 0.5 * Math.min(1, i / 5) * D.rr(0.85, 1);
      D.osc(b, { at, f: 100, f1: 52, d: 0.05, vol: 0.8 * amp }); D.noise(b, { at, color: 'brown', d: 0.035, vol: 0.5 * amp, lp: 500 }); D.noise(b, { at, d: 0.008, vol: 0.12 * amp, bp: 1400, q: 1.2 });
      at += gap; gap = Math.max(0.062, gap * 0.9);
    }
    const n = b.length, f0 = Math.floor(1.6 * D.sr); for (let i = f0; i < n; i++) b[i] *= 1 - (i - f0) / (n - f0);
    return b;
  });
  def('squeak', { v: 2, gate: 0.12, max: 2, peak: 0.2, jit: 1 }, D => {                    // roda do carrinho (uma volta)
    const b = D.buf(0.24), k = D.rr(0.94, 1.03);
    D.osc(b, { path: [[0, 1500 * k], [0.08, 1950 * k], [0.16, 1600 * k]], vib: 0.04, vibHz: 28, a: 0.02, s: 0.1, d: 0.06, vol: 0.5 }); return b;
  });
  def('dump', { v: 2, gate: 0.3, max: 2, peak: 0.42, rev: 0.15 }, D => {                   // arroz despejando ("shaaa") + clunk de madeira
    const b = D.buf(1.3);
    D.noise(b, { color: 'pink', a: 0.06, s: 0.3, d: 0.85, vol: 0.6, hp: 2000, lp: 6000, lp1: 9000 });
    D.osc(b, { wave: 'tri', f: 320, f1: 180, d: 0.06, vol: 0.3 }); D.noise(b, { color: 'brown', a: 0.1, s: 0.2, d: 0.5, vol: 0.3, lp: 300 });
    D.grains(b, { n: 14, t0: 0.5, t1: 1.2, f0: 5000, f1: 9000, vol: 0.08 }); return b;
  });
  def('groan', { v: 2, gate: 0.4, max: 1, peak: 0.4, rev: 0.3 }, D => {                    // deixa da pá de cabo: cabo gemendo e subindo
    const b = D.buf(1.15), t = D.buf(1.1);
    D.osc(t, { wave: 'saw', path: [[0, 95], [0.9, 160]], vib: 0.025, vibHz: 4.5, a: 0.2, s: 0.6, d: 0.25, vol: 0.5 });
    D.noise(t, { color: 'brown', a: 0.2, s: 0.6, d: 0.25, vol: 0.9 });
    const fs = [143, 211, 318, 467];
    for (let i = 0; i < 4; i++) { const c = t.slice(); D.filter(c, 'bp', fs[i], 18, fs[i] * 1.5); D.mix(b, c, 0, 1 - i * 0.2); }
    return b;
  });
  def('zip', { v: 2, gate: 0.15, peak: 0.34 }, D => { const b = D.buf(0.3); D.noise(b, { a: 0.01, s: 0.16, d: 0.08, vol: 0.5, bp: 900, bp1: 4200, q: 2.5, am: 95, amDepth: 0.9 }); D.noise(b, { at: 0.2, d: 0.02, vol: 0.4, bp: 2200, q: 2 }); return b; });   // cinta do palete
  def('crash', { v: 2, gate: 0.2, max: 2, peak: 0.55, rev: 0.3, duck: 0.4, prio: 1 }, D => {
    const b = D.buf(1.4);
    D.noise(b, { a: 0.002, s: 0.05, d: 0.8, vol: 0.7, lp: 5000, lp1: 300, curve: 2.5 }); D.noise(b, { color: 'brown', a: 0.002, s: 0.1, d: 0.9, vol: 0.7, lp: 200 });
    D.osc(b, { f: 120, f1: 38, d: 0.45, vol: 0.8, punch: 0.4 });
    for (let i = 0; i < 4; i++) D.modal(b, D.rr(300, 900), [1, 1.59, 2.31, 3.13], [0.15, 0.1, 0.07, 0.04], [0.35, 0.25, 0.2, 0.1], { at: D.rr(0.05, 0.6) });
    D.sat(b, 1.4); return b;
  });
  def('stomp', { v: 2, gate: 0.2, max: 2, peak: 0.6, duck: 0.5, rev: 0.2, prio: 2 }, D => {   // Patada Sísmica
    const b = D.buf(0.9);
    D.osc(b, { f: 92, f1: 34, slide: 0.25, a: 0.003, s: 0.05, d: 0.55, vol: 0.9, punch: 0.5 }); D.noise(b, { d: 0.25, vol: 0.5, lp: 400 });
    D.noise(b, { color: 'pink', a: 0.05, d: 0.6, vol: 0.5, hp: 2500 }); D.osc(b, { f: 184, f1: 70, d: 0.2, vol: 0.25 });
    D.sat(b, 1.6); return b;
  });
  def('rumble', { v: 2, gate: 0.5, max: 2, peak: 0.5, prio: 1 }, D => {                    // tremor longo (deslizamento, Bagger chegando)
    const b = D.buf(2.4);
    D.noise(b, { color: 'brown', a: 0.4, s: 0.8, d: 1.1, vol: 1, lp: 130 }); D.osc(b, { wave: 'saw', f: 32, a: 0.4, s: 0.8, d: 1.1, vol: 0.25, lp: 110, vib: 0.03, vibHz: 3 });
    D.noise(b, { color: 'brown', a: 0.5, s: 0.6, d: 1.1, vol: 0.4, bp: 320, q: 0.7, am: 7, amDepth: 0.6 });
    D.sat(b, 1.5); return b;
  });

  /* ---------- recompensas (afinadas com a escala da trilha; timbre = skin) ---------- */
  comp('coin', { gate: 0.06, max: 3, vol: 0.75, rev: 0.12, jit: 0 }, (a, o) => {            // iene: "cha-rin" de duas notas
    const sk = skinOf(o), st = o.step | 0;
    a.note(a.deg(5 + st, 0), { inst: 'marimba', vel: 0.6 }); a.note(a.deg(7 + st, 0), { inst: 'marimba', vel: 0.65, delay: 0.07 });
    if (sk.extra === 'kaching') a.play('kaching', { vol: 0.5, delay: 0.03 });
    else if (sk.extra === 'chu') a.drum('chu', { vel: 0.3 });
  });
  comp('coinS', { gate: 0.35, max: 1, vol: 0.38, rev: 0.15, jit: 0 }, (a, o) => {         // ganho pequeno: uma notinha só, baixinha
    a.note(a.deg(7 + (o.step | 0), 0), { inst: 'marimba', vel: 0.35 });
  });
  comp('coins', { gate: 0.15, max: 2, vol: 0.7, rev: 0.15, jit: 0 }, a => {                 // chuva de moedas
    for (let i = 0; i < 7; i++) a.note(a.deg(5 + ((i * 3) % 7)), { vel: 0.4 + 0.05 * i, delay: i * 0.055 + a.rnd() * 0.01, pan: (i % 2 ? 1 : -1) * 0.3 });
  });
  def('kaching', { gate: 0.1, peak: 0.4, jit: 0.3 }, D => {                                // caixa registradora
    const b = D.buf(0.6);
    D.noise(b, { d: 0.03, vol: 0.5, bp: 3000, q: 1.2 }); D.osc(b, { f: 180, f1: 110, d: 0.05, vol: 0.4 });
    D.modal(b, 2480, [1, 1.51, 2.7], [0.5, 0.25, 0.1], [0.4, 0.3, 0.15], { at: 0.07 }); D.modal(b, 3120, [1, 1.51], [0.4, 0.2], [0.35, 0.25], { at: 0.15 });
    return b;
  });
  comp('combo', { gate: 0.07, max: 4, vol: 0.7, rev: 0.12, jit: 0 }, (a, o) => {            // escada do combo: sobe um grau da escala por nível
    const n = clamp(o.n | 0, 0, 30), d = Math.min(14, n >> 1);
    a.note(a.deg(Math.min(7, d >> 1), 0), { inst: 'marimba', vel: 0.3 + 0.006 * n });       // "pom" de marimba, grave e fofo; sobe devagar
    if (n >= 30) { for (let i = 0; i < 5; i++) a.note(a.deg(7 - i, 0), { inst: 'marimba', vel: 0.28, delay: 0.06 + i * 0.07 }); a.drum('don', { vel: 0.35 }); }
  });
  comp('gold', { gate: 0.1, max: 2, vol: 0.8, rev: 0.4, duck: 0.3, jit: 0, prio: 1 }, a => {   // grão dourado / crítico
    a.note(a.deg(5), { inst: 'fmbell', vel: 0.6 }); a.note(a.deg(7), { inst: 'fmbell', vel: 0.65, delay: 0.06 }); a.note(a.deg(9), { inst: 'fmbell', vel: 0.75, delay: 0.12 });
    a.play('sparkle', { vol: 0.5, delay: 0.1 });
  });
  def('shing', { v: 2, gate: 0.2, max: 2, peak: 0.36, rev: 0.4 }, D => {                   // deixa do bolsão dourado: "shiiing" subindo
    const b = D.buf(0.9);
    D.noise(b, { a: 0.3, s: 0.05, d: 0.4, vol: 0.4, bp: 3000, bp1: 9000, q: 5 });
    D.osc(b, { f: 2000, f1: 6000, a: 0.3, s: 0.05, d: 0.3, vol: 0.08 });
    D.modal(b, 5274, [1, 1.5, 2.01], [0.3, 0.15, 0.1], [0.5, 0.4, 0.3], { at: 0.33 }); return b;
  });
  def('sparkle', { v: 4, gate: 0.08, max: 3, peak: 0.3, rev: 0.4, jit: 1 }, D => {
    const b = D.buf(0.9), fs = [2093, 2349, 2794, 3136, 3520, 4186, 4699];
    for (let i = 0; i < 6; i++) D.modal(b, fs[Math.floor(D.rnd() * fs.length)], [1, 2.01], [0.3, 0.08], [0.35, 0.2], { at: i * 0.05 + D.rr(0, 0.03) });
    D.noise(b, { a: 0.05, d: 0.5, vol: 0.03, hp: 6000 }); return b;
  });
  comp('pling', { gate: 0.08, max: 3, vol: 0.65, rev: 0.25, jit: 0 }, a => { a.note(a.deg(7), { vel: 0.6 }); a.note(a.deg(10), { vel: 0.7, delay: 0.07 }); });   // comemoração nível 1
  comp('buy', { gate: 0.1, max: 2, vol: 0.8, rev: 0.2, jit: 0 }, a => {                     // compra: "kachi" de madeira + quinta de koto + "cha"
    a.drum('clap', { vel: 0.6 });
    a.pluck(a.deg(5), { vel: 0.7, delay: 0.03 }); a.pluck(a.deg(8), { vel: 0.8, delay: 0.1 });
    a.buf('cha', D => { const b = D.buf(0.09); D.noise(b, { d: 0.06, vol: 0.5, hp: 4000 }); return D.finish(b, 0.25); }, { delay: 0.17 });
  });
  comp('unlock', { gate: 0.2, max: 2, vol: 0.8, rev: 0.3, duck: 0.3, jit: 0, prio: 1 }, a => {   // algo novo destravou: trinco + subida de koto + brilho
    a.drum('clap', { vel: 0.5 }); a.drum('ka', { vel: 0.5, delay: 0.05 });
    for (let i = 0; i < 4; i++) a.pluck(a.deg(5 + i), { vel: 0.5 + i * 0.08, delay: 0.1 + i * 0.06 });
    a.play('sparkle', { vol: 0.6, delay: 0.3 }); a.drum('furin', { vel: 0.35, delay: 0.34 });
  });
  comp('levelup', { gate: 0.4, max: 1, vol: 0.85, rev: 0.3, duck: 0.4, jit: 0, prio: 2 }, a => {   // jingle de subir de nível (~1,1 s)
    const run = [5, 7, 8, 9, 10];
    for (let i = 0; i < run.length; i++) a.pluck(a.deg(run[i]), { vel: 0.55 + i * 0.05, delay: i * 0.08 });
    const ch = [10, 12, 14];
    for (let i = 0; i < 3; i++) { a.pluck(a.deg(ch[i]), { vel: 0.7, delay: 0.46 + i * 0.025 }); a.note(a.deg(ch[i]), { vel: 0.35, delay: 0.46 + i * 0.025 }); }
    a.drum('ten', { vel: 0.5, delay: 0.32 }); a.drum('ten', { vel: 0.6, delay: 0.4 }); a.drum('don', { vel: 0.5, delay: 0.46 });
    a.drum('furin', { vel: 0.35, delay: 0.5 });
  });
  comp('fanfare', { gate: 0.4, max: 1, vol: 0.85, rev: 0.35, duck: 0.45, jit: 0, prio: 2 }, a => {   // fanfarra de 3 notas no instrumento da fase
    a.note(a.deg(5), { vel: 0.7 }); a.note(a.deg(7), { vel: 0.75, delay: 0.14 });
    a.note(a.deg(10), { vel: 0.85, delay: 0.28 }); a.note(a.deg(7), { vel: 0.5, delay: 0.3 }); a.note(a.deg(12), { vel: 0.55, delay: 0.32 });
    a.drum('chu', { vel: 0.45 }); a.drum('chu', { vel: 0.5, delay: 0.14 }); a.drum('don', { vel: 0.7, delay: 0.28 });
    a.play('sparkle', { vol: 0.4, delay: 0.3 });
  });

  /* ---------- sacos, interface, eventos ---------- */
  def('sack', { v: 3, gate: 0.15, max: 2, peak: 0.34, jit: 1 }, D => {                     // deixa do saco: papel/juta farfalhando
    const b = D.buf(0.4);
    for (let i = 0; i < 4; i++) D.noise(b, { at: i * D.rr(0.06, 0.09), a: 0.01, s: 0.02, d: 0.05, vol: D.rr(0.25, 0.5), bp: D.rr(2200, 4800), q: 1.2 });
    D.grains(b, { n: 16, t0: 0, t1: 0.33, f0: 3000, f1: 7000, vol: 0.2, d0: 0.002, d1: 0.005 }); return b;
  });
  def('shake', { v: 4, gate: 0.07, max: 3, peak: 0.3, jit: 2 }, D => {                     // saco sacudindo
    const b = D.buf(0.1);
    D.noise(b, { a: 0.004, d: 0.035, vol: 0.4, bp: 1500, bp1: 2200, q: 1, lp: 4000 }); D.noise(b, { d: 0.045, vol: 0.3, bp: 500, q: 1 });
    D.grains(b, { n: 3, t0: 0.005, t1: 0.05, f0: 4000, f1: 7000, vol: 0.15 }); return b;
  });
  def('pop', { v: 3, gate: 0.08, max: 3, peak: 0.5, rev: 0.2, jit: 1 }, D => {             // saco estourando + chuva de arroz
    const b = D.buf(0.62);
    D.osc(b, { f: 380, f1: 950, slide: 0.05, a: 0.001, s: 0.02, d: 0.04, vol: 0.7, punch: 0.4 }); D.noise(b, { d: 0.05, vol: 0.6, lp: 2500 });
    D.noise(b, { at: 0.03, a: 0.01, s: 0.05, d: 0.4, vol: 0.3, hp: 3000 });
    D.grains(b, { n: 8, t0: 0.1, t1: 0.5, f0: 5000, f1: 9000, vol: 0.15 }); return b;
  });
  def('whoosh', { v: 3, gate: 0.08, max: 3, peak: 0.34, jit: 1.5 }, D => { const b = D.buf(0.42); D.noise(b, { a: 0.12, s: 0.02, d: 0.26, vol: 0.5, bp: 500, bp1: 2600, q: 1.6 }); D.noise(b, { color: 'pink', a: 0.12, d: 0.26, vol: 0.3, lp: 900 }); return b; });
  def('splash', { v: 3, gate: 0.1, max: 3, peak: 0.42, rev: 0.25, jit: 1 }, D => {
    const b = D.buf(0.7);
    D.noise(b, { a: 0.004, s: 0.03, d: 0.3, vol: 0.6, lp: 3200, lp1: 700 }); D.noise(b, { a: 0.02, s: 0.03, d: 0.45, vol: 0.25, hp: 2200 });
    D.osc(b, { f: 160, f1: 70, d: 0.1, vol: 0.4 });
    for (let i = 0; i < 6; i++) { const f = D.rr(450, 1300); D.osc(b, { at: D.rr(0.07, 0.5), f, f1: f * 1.7, d: D.rr(0.025, 0.05), vol: D.rr(0.1, 0.25) }); }
    return b;
  });
  def('drip', { v: 3, gate: 0.08, max: 3, peak: 0.36, rev: 0.6, jit: 2 }, D => { const b = D.buf(0.6), k = D.rr(0.9, 1.15); D.osc(b, { f: 1750 * k, f1: 2400 * k, slide: 0.04, d: 0.5, vol: 0.6, curve: 3.5 }); D.modal(b, 2650 * k, [1, 1.52], [0.2, 0.08], [0.45, 0.3], { at: 0.01 }); return b; });
  def('error', { gate: 0.15, max: 1, peak: 0.26, jit: 0 }, D => {                          // não dá: duas notas descendo
    const b = D.buf(0.3); D.osc(b, { wave: 'sq', f: 196, a: 0.003, s: 0.06, d: 0.02, vol: 0.5, lp: 1200 }); D.osc(b, { at: 0.11, wave: 'sq', f: 147, a: 0.003, s: 0.09, d: 0.04, vol: 0.5, lp: 1200 }); return b;
  });
  def('click', { v: 3, gate: 0.03, max: 3, peak: 0.26, jit: 0.6 }, D => { const b = D.buf(0.06); D.osc(b, { wave: 'tri', f: 1800, d: 0.015, vol: 0.5, curve: 3 }); D.modal(b, 900, [1, 2.4], [0.4, 0.1], [0.04, 0.02]); D.noise(b, { d: 0.004, vol: 0.2, hp: 3000 }); return b; });
  def('hover', { v: 2, gate: 0.04, max: 2, peak: 0.12, jit: 0.6 }, D => { const b = D.buf(0.05); D.osc(b, { f: 1400, a: 0.003, d: 0.03, vol: 0.5, curve: 2.5 }); return b; });
  def('typing', { v: 4, gate: 0.03, max: 3, peak: 0.16, jit: 1.5 }, D => { const b = D.buf(0.05); D.osc(b, { wave: 'sq', f: D.rr(780, 980), a: 0.002, s: 0.012, d: 0.02, vol: 0.5, lp: 2600, duty: 0.3 }); return b; });   // letrinha de diálogo
  def('knock', { v: 2, gate: 0.2, max: 2, peak: 0.42, jit: 0.6 }, D => {                   // deixa do baú de missão: toc-toc
    const b = D.buf(0.36);
    for (let i = 0; i < 2; i++) { const at = i * 0.15; D.osc(b, { at, f: 300, f1: 190, d: 0.05, vol: 0.6 }); D.modal(b, 520, [1, 1.8, 2.9], [0.4, 0.2, 0.08], [0.09, 0.06, 0.04], { at }); D.noise(b, { at, d: 0.006, vol: 0.3, lp: 2500 }); }
    return b;
  });
  def('hanko', { v: 2, gate: 0.15, max: 2, peak: 0.45, jit: 0.6 }, D => {                  // carimbo: "pon"
    const b = D.buf(0.25); D.osc(b, { f: 250, f1: 140, d: 0.1, vol: 0.8, punch: 0.3 }); D.noise(b, { d: 0.03, vol: 0.4, lp: 1200 }); D.modal(b, 510, [1, 2.2], [0.2, 0.08], [0.1, 0.06]); return b;
  });
  def('boing', { v: 2, gate: 0.1, max: 2, peak: 0.36, jit: 1.5 }, D => { const b = D.buf(0.5); D.osc(b, { path: [[0, 170], [0.08, 380], [0.45, 210]], vib: 0.16, vibHz: 15, a: 0.004, s: 0.05, d: 0.4, vol: 0.6 }); D.osc(b, { path: [[0, 340], [0.08, 760], [0.45, 420]], vib: 0.16, vibHz: 15, d: 0.3, vol: 0.12 }); return b; });   // mochi
  comp('taiko', { gate: 0.05, max: 3, vol: 0.9, rev: 0.25, jit: 0.4 }, a => { a.drum('don', { vel: 0.9 }); });
  comp('taikoRoll', { gate: 0.6, max: 1, vol: 0.9, rev: 0.3, duck: 0.4, jit: 0, prio: 2 }, a => {   // deixa da Fúria: rufar acelerando
    let t = 0, gap = 0.2;
    for (let i = 0; i < 18 && t < 1.5; i++) { a.drum(i % 2 ? 'chu' : 'don', { vel: 0.3 + 0.5 * (t / 1.5), delay: t, rate: i % 2 ? 1 : 1.04 }); t += gap; gap = Math.max(0.06, gap * 0.88); }
    a.drum('don', { vel: 1, delay: 1.58 });
  });
  def('bell', { gate: 0.1, max: 2, peak: 0.4, rev: 0.5, jit: 0.3 }, D => {                 // sino de templo pequeno (rin)
    const b = D.buf(2.6); D.modal(b, 622, [1, 2.76, 5.4, 8.93, 1.004], [1, 0.45, 0.2, 0.08, 0.5], [2.5, 1.6, 0.9, 0.45, 2.4]); D.noise(b, { d: 0.006, vol: 0.2, bp: 2500, q: 1 }); return b;
  });
  comp('chime', { gate: 0.1, max: 3, vol: 0.8, rev: 0.6, jit: 1.5 }, a => { a.drum('furin', { vel: 0.8 }); });   // fūrin
  def('chirin', { gate: 0.15, max: 2, peak: 0.36, rev: 0.5, jit: 0.3 }, D => {             // deixa de conquista: sininho "chi-rin"
    const b = D.buf(1.3); D.modal(b, 2637, [1, 2.76, 5.4], [1, 0.4, 0.15], [0.5, 0.3, 0.15]); D.modal(b, 3136, [1, 2.76, 5.4], [1, 0.4, 0.15], [1.1, 0.7, 0.3], { at: 0.09 });
    D.noise(b, { d: 0.004, vol: 0.2, hp: 5000 }); return b;
  });
  def('trill', { gate: 0.5, max: 1, peak: 0.34, rev: 0.5, jit: 0 }, D => {                 // deixa do Onigiri da Sorte: trinado de flauta
    const b = D.buf(1.35), path = []; const f = 1175;                                      // alterna Ré6 / Mi6 acelerando
    let t = 0, gap = 0.11; for (let i = 0; t < 1.2; i++) { path.push([t, i % 2 ? f * 1.122 : f], [t + gap * 0.8, i % 2 ? f * 1.122 : f]); t += gap; gap = Math.max(0.05, gap * 0.9); }
    D.osc(b, { path, a: 0.08, s: 0.95, d: 0.25, vol: 0.5, vib: 0.004, vibHz: 5 }); D.osc(b, { wave: 'tri', path, a: 0.08, s: 0.95, d: 0.25, vol: 0.12 });
    D.noise(b, { color: 'pink', a: 0.05, s: 0.95, d: 0.25, vol: 0.5, bp: 2350, q: 5 }); D.noise(b, { color: 'pink', a: 0.01, d: 0.07, vol: 0.5, bp: 2350, q: 2 });
    return b;
  });
  def('whistle', { gate: 0.5, max: 1, peak: 0.4, rev: 0.45, jit: 0 }, D => {               // apito do trem
    const b = D.buf(1.1), o = { wave: 'sq', f: 440, a: 0.04, s: 0.75, d: 0.25, vol: 0.3, vib: 0.004, vibHz: 6, lp: 1800, duty: 0.4 };
    D.osc(b, o); o.f = 554; D.osc(b, o); o.f = 659; o.vol = 0.2; D.osc(b, o);
    D.noise(b, { color: 'pink', a: 0.02, s: 0.75, d: 0.25, vol: 0.4, bp: 1300, q: 1.5 }); return b;
  });

  /* ---------- vozes: o Kome e a bicharada ---------- */
  const WAN = [[750, 4, 1], [1250, 5, 0.9], [2500, 6, 0.4]];
  def('bark', { v: 3, gate: 0.08, max: 3, peak: 0.45, jit: 1.2, rev: 0.12 }, D => {        // "wan!"
    const b = D.buf(0.22), k = D.rr(0.95, 1.08);
    D.voice(b, { path: [[0, 430 * k], [0.03, 640 * k], [0.14, 400 * k]], a: 0.008, s: 0.05, d: 0.11, vol: 0.6, breath: 0.12, formants: WAN });
    D.noise(b, { d: 0.012, vol: 0.2, bp: 1800, q: 1 }); return b;
  });
  def('bark2', { v: 2, gate: 0.12, max: 2, peak: 0.48, jit: 1, rev: 0.12 }, D => {         // "wan-wan!" mais grosso (cachorrão)
    const b = D.buf(0.5), fm = [[560, 4, 1], [980, 5, 0.9], [2100, 6, 0.35]];
    for (let i = 0; i < 2; i++) { const at = i * 0.2, k = i ? 0.96 : 1; D.voice(b, { at, path: [[0, 300 * k], [0.03, 440 * k], [0.16, 270 * k]], a: 0.008, s: 0.06, d: 0.13, vol: 0.6, breath: 0.15, formants: fm }); D.noise(b, { at, d: 0.014, vol: 0.2, bp: 1400, q: 1 }); }
    return b;
  });
  def('yip', { v: 3, gate: 0.06, max: 3, peak: 0.36, jit: 1.5 }, D => { const b = D.buf(0.12); D.voice(b, { path: [[0, 700], [0.02, 1000], [0.07, 760]], a: 0.005, s: 0.02, d: 0.06, vol: 0.6, formants: [[1100, 4, 1], [2100, 5, 0.6], [3200, 6, 0.3]] }); return b; });
  def('whine', { v: 2, gate: 0.2, max: 2, peak: 0.3, jit: 1, rev: 0.15 }, D => {           // "kuuun..."
    const b = D.buf(0.75); D.voice(b, { wave: 'tri', path: [[0, 760], [0.18, 1180], [0.4, 1080], [0.68, 640]], a: 0.06, s: 0.4, d: 0.25, vol: 0.7, vib: 0.02, vibHz: 7, formants: [[1150, 3, 1], [2300, 4, 0.5]] }); return b;
  });
  def('howl', { gate: 0.5, max: 1, peak: 0.4, jit: 0.5, rev: 0.4, prio: 1 }, D => {        // "auuuuu!" (Fúria)
    const b = D.buf(1.7); D.voice(b, { path: [[0, 330], [0.3, 640], [1.1, 610], [1.6, 430]], a: 0.12, s: 1.1, d: 0.4, vol: 0.7, vib: 0.012, vibHz: 5.5, breath: 0.06, formants: [[620, 5, 1], [1050, 6, 0.7], [2400, 7, 0.2]] }); return b;
  });
  def('yawn', { gate: 0.5, max: 1, peak: 0.3, jit: 0.5, rev: 0.15 }, D => {                // bocejo ("fuaaa~")
    const b = D.buf(1.1); D.voice(b, { path: [[0, 300], [0.35, 560], [1.0, 250]], a: 0.2, s: 0.4, d: 0.45, vol: 0.6, breath: 0.4, vib: 0.01, vibHz: 4, formants: [[700, 3, 1], [1200, 4, 0.7], [2600, 5, 0.2]] }); return b;
  });
  def('caw', { v: 2, gate: 0.2, max: 2, peak: 0.36, jit: 1, rev: 0.2 }, D => {             // corvo
    const b = D.buf(0.6);
    for (let i = 0; i < 2; i++) D.voice(b, { at: i * 0.27, path: [[0, 560], [0.05, 640], [0.2, 480]], a: 0.01, s: 0.12, d: 0.1, vol: 0.6, am: 68, amDepth: 0.85, breath: 0.2, formants: [[1250, 4, 1], [1900, 5, 0.8], [3100, 5, 0.4]] });
    return b;
  });

  /* ---------- compatibilidade com o rascunho: tone/noise crus e dig genérico ---------- */
  comp('_tone', { max: 12, jit: 0 }, (a, o) => a.tone(o.f, o.d, o.type, o.v, o.slide, 0));
  comp('_noise', { max: 8, jit: 0 }, (a, o) => a.noise(o.d, o.f, o.v, o.q, 0));

  // gate(k, ms) -> bool: true no máximo uma vez a cada `ms` por chave (relógio de parede; funciona sem áudio)
  function gate(k, ms) {
    const n = root.performance ? root.performance.now() : Date.now();
    if (gates[k] !== undefined && n - gates[k] < ms) return false;
    gates[k] = n; return true;
  }
  const tmpOpts = { pitch: 1, vol: 1, pan: 0, delay: 0, weight: undefined, n: 0, step: 0, skin: undefined, variant: undefined, exact: false };
  function quick(name, pitch, vol, weight, n) {
    tmpOpts.pitch = pitch || 1; tmpOpts.vol = vol === undefined ? 1 : vol; tmpOpts.pan = 0; tmpOpts.delay = 0; tmpOpts.weight = weight; tmpOpts.n = n | 0; tmpOpts.step = 0;
    return ready() ? playOn(L, name, tmpOpts, 0) : null;
  }

  const Sfx = {
    // init(): igual a E.Audio.unlock() (nome do rascunho)
    init() { return Audio.unlock(); },
    // muted (get/set): espelho de E.Audio.muted
    get muted() { return settings.muted; }, set muted(v) { Audio.muted = v; },
    /* play(nome, {pitch=1, vol=1, pan=0, delay=0, weight, skin|variant, n, step, exact}) -> voz|null
       pitch = multiplicador de velocidade; weight = peso do grave (ferramentas); skin = timbre A..G (0..6) só deste toque;
       variant = variante pré-renderizada (sons com variantes); exact = sem variação aleatória */
    play(name, opts) { return ready() ? playOn(L, name, opts, 0) : null; },
    /* define(nome, fn(api, opts) | {render(D, variante)->Float32Array, play(api,opts), v, gate, max, vol, peak, jit, rev, duck, prio, sub, weight})
       registra (ou troca) um som. Forma função: monta o som com a api (api.tone, api.noise, api.note, api.pluck, api.drum, api.buf, api.play).
       Forma objeto: `render` é pré-renderizado com o kit DSP e fica em cache; v = nº de variantes */
    define(name, d) {
      if (typeof d === 'function') DEFS[name] = { play: d, jit: 0 };
      else if (d && typeof d === 'object') DEFS[name] = Object.assign({}, d);
      bufCache.forEach((_, k) => { if (k.indexOf('|sfx:' + name + ':') > 0) bufCache.delete(k); });
      return Sfx;
    },
    // names() -> lista dos sons registrados
    names() { const out = []; for (const k in DEFS) if (k[0] !== '_') out.push(k); return out; },
    // has(nome) -> bool
    has(name) { return !!DEFS[name]; },
    // setSkin(n|'A'..'G'): troca o timbre das recompensas (moeda, combo, pling, fanfarra); getSkin() -> índice
    setSkin(n) { skin = SKINS.indexOf(skinOf({ skin: n })); return Sfx; },
    getSkin() { return skin; },
    // skins() -> [{id, inst, label}]
    skins() { return SKINS; },
    // tools() -> os 12 degraus [{id, sub (Hz), w (peso padrão)}] ; setTool(n|id): ferramenta usada por dig()
    tools() { return TOOLS; },
    setTool(t) { toolTier = toolIndex(t); return Sfx; },
    /* digTool(degrau 0..11 | id, {pitch, weight, vol, pan}): som de cavar da ferramenta. weight 0..1.5 pesa o grave */
    digTool(t, opts) { return Sfx.play(TOOLS[toolIndex(t)].id, opts); },
    // tone(f, d, tipo='square', v=.2, slide=0, delay=0): bip cru do rascunho
    tone(f, d, type, v, slide, delay) { if (ready()) playOn(L, '_tone', { f, d, type, v, slide, delay: delay || 0, exact: true }, 0); },
    // noise(d, f=1200, v=.2, q=1, delay=0): rajada de ruído do rascunho
    noise(d, f, v, q, delay) { if (ready()) playOn(L, '_noise', { d, f, v, q, delay: delay || 0, exact: true }, 0); },
    gate,
    // dig(pitch=1, heavy=0): cavada com a ferramenta atual (setTool); heavy 0..1 soma peso no grave
    dig(pitch, heavy) { const T = TOOLS[toolTier]; return quick(T.id, pitch, 1, T.w + (heavy || 0) * 0.5); },
    // combo(n): nota da escada do combo (n = 0..30); no 30 solta o glissando
    combo(n) { return quick('combo', 1, 1, undefined, n); },
    // coin(combo=0): moeda; sobe 1 semitom a cada 5 de combo (GDD §8.2)
    // (sobe um GRAU da escala a cada 10 de combo, sem sair do tom; antes subia em semitom e desafinava)
    // coinSoft(combo): ganho pequeno, uma nota baixa (no máximo ~3 por segundo)
    coinSoft(n) { if (!ready()) return null; tmpOpts.pitch = 1; tmpOpts.vol = 1; tmpOpts.pan = 0; tmpOpts.delay = 0; tmpOpts.weight = undefined; tmpOpts.n = n | 0; tmpOpts.step = Math.min(3, Math.floor((n || 0) / 10)); return playOn(L, 'coinS', tmpOpts, 0); },
    coin(n) { if (!ready()) return null; tmpOpts.pitch = 1; tmpOpts.vol = 0.7; tmpOpts.pan = 0; tmpOpts.delay = 0; tmpOpts.weight = undefined; tmpOpts.n = n | 0; tmpOpts.step = Math.min(3, Math.floor((n || 0) / 10)); return playOn(L, 'coin', tmpOpts, 0); },
    // gold() buy() big() shake() pop(): atalhos do rascunho
    gold() { return quick('gold'); },
    buy() { return quick('buy'); },
    big() { return quick('stomp'); },
    shake() { return quick('shake'); },
    pop() { return quick('pop'); },
  };
  function toolIndex(t) {
    if (typeof t === 'string') { for (let i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === t) return i; return 3; }
    return clamp(t | 0, 0, TOOLS.length - 1);
  }

  /* ======================================================================
     E.Loops — motores e ambiências contínuos (buffers em loop sem emenda)
     ====================================================================== */
  const LOOPS = Object.create(null);  // nome -> {render(D)->Float32Array|[L,R], vol, rate:[a,b], lp:[a,b], gain:[a,b]}
  const liveLoops = [];
  // loopDef(nome, meta, render): registra um loop. rate/lp/gain = [valor em regime 0, valor em regime 1]
  function loopDef(name, meta, render) { meta.render = render; LOOPS[name] = meta; }

  // bed(D, n, o) -> Float32Array(n): cama de ruído contínua e sem emenda (o = opções de D.noise)
  function bed(D, n, o) {
    const b = new Float32Array(n + Math.floor(0.2 * D.sr));
    o.a = 0.001; o.s = b.length / D.sr; o.d = 0.001; D.noise(b, o);
    return D.fold(b, n);
  }
  // pulses(D, out, o): trem de explosões de motor, escrito dando a volta (loop exato). O jitter é o que dá vida
  function pulses(D, out, o) {
    const tmp = D.buf(o.dec * 1.7 + 0.02);
    for (let i = 0; i < o.n; i++) {
      tmp.fill(0);
      const amp = (1 + (D.rnd() * 2 - 1) * (o.ampJit || 0)) * (o.accEvery && i % o.accEvery === 0 ? 1 + o.acc : 1);
      D.osc(tmp, { f: o.f0 * D.rr(0.97, 1.03), f1: o.f1, slide: o.dec * 0.6, a: 0.002, d: o.dec, vol: 0.9 * amp, curve: 2.5 });
      if (o.nz) D.noise(tmp, { color: 'brown', d: o.dec * 0.7, vol: o.nz * amp, lp: o.nzLp || 500 });
      if (o.tk) D.noise(tmp, { d: 0.008, vol: o.tk * amp, bp: 1400, q: 1.2 });
      D.wrap(out, tmp, i / o.hz + (D.rnd() * 2 - 1) * (o.jit || 0), 1);
    }
    return out;
  }
  // tones(D, out, lista [[tipo, Hz, ganho]...]): osciladores contínuos com nº inteiro de ciclos no loop (sem emenda)
  function tones(D, out, list) {
    const n = out.length, dur = n / D.sr;
    for (let k = 0; k < list.length; k++) {
      const w = list[k][0], cyc = Math.max(1, Math.round(list[k][1] * dur)), g = list[k][2], inc = cyc / n; let p = 0;
      if (w === 'sin') { const wv = TAU * inc; for (let i = 0; i < n; i++) out[i] += g * Math.sin(wv * i); }
      else if (w === 'sq') for (let i = 0; i < n; i++) { out[i] += p < 0.5 ? g : -g; p += inc; if (p >= 1) p -= 1; }
      else if (w === 'tri') for (let i = 0; i < n; i++) { out[i] += g * (1 - 4 * Math.abs(p - 0.5)); p += inc; if (p >= 1) p -= 1; }
      else for (let i = 0; i < n; i++) { out[i] += g * (2 * p - 1); p += inc; if (p >= 1) p -= 1; }
    }
    return out;
  }
  const add = (out, src, g) => { for (let i = 0; i < out.length; i++) out[i] += src[i] * g; return out; };

  loopDef('tractor', { vol: 1, rate: [0.8, 2.2], lp: [600, 3200], gain: [0.6, 1] }, D => {      // diesel de 1 cilindro: "pon-pon-pon"
    const n = Math.round(8 / 14 * D.sr), b = new Float32Array(n);
    pulses(D, b, { hz: 14, n: 8, f0: 95, f1: 55, dec: 0.05, nz: 0.5, nzLp: 500, tk: 0.15, jit: 0.002, ampJit: 0.12 });
    add(b, bed(D, n, { vol: 0.07, bp: 2200, q: 0.8, am: 14, amDepth: 0.8 }), 1);
    return D.sat(b, 1.2);
  });
  loopDef('diesel', { vol: 1, rate: [0.75, 1.9], lp: [500, 3400], gain: [0.6, 1] }, D => {      // diesel de 4 cilindros (escavadeira, empilhadeira a diesel)
    const n = Math.round(16 / 26 * D.sr), b = new Float32Array(n);
    pulses(D, b, { hz: 26, n: 16, f0: 80, f1: 50, dec: 0.034, nz: 0.4, nzLp: 450, tk: 0.08, jit: 0.001, ampJit: 0.06, accEvery: 4, acc: 0.15 });
    add(b, bed(D, n, { color: 'brown', vol: 0.3, lp: 180 }), 1); add(b, bed(D, n, { vol: 0.03, bp: 2600, q: 0.8, am: 26, amDepth: 0.6 }), 1);
    return D.sat(b, 1.2);
  });
  loopDef('truck', { vol: 1, rate: [0.7, 1.8], lp: [450, 3600], gain: [0.6, 1] }, D => {        // caminhão gigante: ronco liso de V20 + sub + turbo
    const n = Math.round(24 / 36 * D.sr), b = new Float32Array(n);
    pulses(D, b, { hz: 36, n: 24, f0: 70, f1: 45, dec: 0.028, nz: 0.35, nzLp: 400, jit: 0.0008, ampJit: 0.04 });
    tones(D, b, [['sin', 36, 0.45], ['sin', 18, 0.3], ['sin', 2800, 0.012], ['sin', 2812, 0.008]]);
    add(b, bed(D, n, { color: 'brown', vol: 0.25, bp: 300, q: 0.8 }), 1);
    return D.sat(b, 1.5);
  });
  loopDef('hydraulic', { vol: 0.7, rate: [0.8, 1.7], lp: [2500, 6500], gain: [0.5, 1] }, D => { // bomba hidráulica: gemido de duas serras em quinta
    const n = 2 * D.sr, xf = Math.floor(0.2 * D.sr), t = new Float32Array(n + xf);
    tones(D, t, [['saw', 380, 0.5], ['saw', 570, 0.4]]);
    D.filter(t, 'bp', 760, 5);
    const b = D.fold(t, n);
    for (let i = 0; i < n; i++) b[i] *= 0.8 + 0.2 * Math.sin(TAU * 3 * i / n);
    add(b, bed(D, n, { vol: 0.05, hp: 3500 }), 1);
    return b;
  });
  loopDef('electric', { vol: 0.6, rate: [0.6, 1.8], lp: [1200, 5200], gain: [0.5, 1] }, D => {  // motor elétrico (empilhadeira)
    const n = D.sr, b = new Float32Array(n);
    tones(D, b, [['saw', 240, 0.3], ['sq', 480, 0.12], ['sin', 960, 0.1], ['sin', 1440, 0.05], ['sin', 60, 0.3], ['sq', 120, 0.08]]);
    D.filter(b, 'lp', 2400, 0.8, 0, true); tones(D, b, [['sin', 60, 0.2]]);
    for (let i = 0; i < n; i++) b[i] *= 0.85 + 0.15 * Math.sin(TAU * 8 * i / n);
    add(b, bed(D, n, { vol: 0.02, hp: 3000 }), 1);
    return b;
  });
  loopDef('conveyor', { vol: 0.7, rate: [0.7, 1.5], lp: [1500, 7000], gain: [0.5, 1] }, D => {  // esteira: motores elétricos + roletes + arroz
    const n = 2 * D.sr, b = new Float32Array(n), h = new Float32Array(n), tk = D.buf(0.03);
    tones(D, h, [['sq', 50, 0.5], ['sq', 100, 0.3]]); D.filter(h, 'lp', 380, 0.8, 0, true); tones(D, h, [['sin', 50, 0.3]]); add(b, h, 0.5);
    add(b, bed(D, n, { vol: 0.2, bp: 1300, q: 1.2, am: 11, amDepth: 0.7 }), 1);
    add(b, bed(D, n, { color: 'pink', vol: 0.25, hp: 2800 }), 1);
    for (let i = 0; i < 11; i++) { tk.fill(0); D.noise(tk, { d: 0.012, vol: D.rr(0.1, 0.2), bp: D.rr(1800, 2600), q: 3 }); D.wrap(b, tk, i * 2 / 11 + D.rr(-0.01, 0.01), 1); }
    return b;
  });
  loopDef('rice', { vol: 0.7, rate: [0.8, 1.3], lp: [3000, 11000], gain: [0.3, 1] }, D => {     // cascata de arroz (produção automática)
    const n = 3 * D.sr, b = bed(D, n, { color: 'pink', vol: 0.5, hp: 2800 });
    for (let i = 0; i < n; i++) b[i] *= 0.7 + 0.2 * Math.sin(TAU * 2 * i / n) + 0.1 * Math.sin(TAU * 5 * i / n + 1);
    D.grains(b, { n: 260, t0: 0, t1: 2.97, f0: 4500, f1: 10000, vol: 0.2 });
    return b;
  });
  loopDef('bagger', { vol: 1, rate: [0.92, 1.08], lp: [1800, 5000], gain: [0.5, 1] }, D => {    // Bagger 293: drone de 31 Hz + aço gemendo devagar + esteira + caçambas
    const sr = D.sr, n = 8 * sr, xf = Math.floor(0.5 * sr), out = [new Float32Array(n), new Float32Array(n)];
    const sub = new Float32Array(n); tones(D, sub, [['saw', 31, 0.4], ['saw', 31.25, 0.4], ['sin', 62, 0.35]]);
    D.filter(sub, 'lp', 140, 0.8, 0, true); tones(D, sub, [['sin', 31, 0.25], ['sin', 62, 0.2]]); D.sat(sub, 1.8);
    const hum = new Float32Array(n); tones(D, hum, [['sq', 50, 0.5], ['sq', 100, 0.3]]); D.filter(hum, 'lp', 380, 0.8, 0, true);
    const rattle = bed(D, n, { vol: 0.05, bp: 1300, q: 1.2, am: 11, amDepth: 0.7 }), river = bed(D, n, { color: 'pink', vol: 0.11, hp: 2800 });
    const fr = [87, 143, 211, 318, 467], fg = [0.5, 0.4, 0.35, 0.25, 0.15], clank = D.buf(0.75);
    for (let c = 0; c < 2; c++) {
      const o = out[c], src = new Float32Array(n + xf), gen = D.noiseGen('brown'), acc = new Float32Array(n + xf);
      for (let i = 0; i < src.length; i++) src[i] = gen();
      for (let k = 0; k < 5; k++) {                                       // 5 ressonadores inarmônicos, cada um com seu LFO lento
        const fl = new SVF(sr), lf = (1 + ((k + c) % 3)) / 8, la = (1 + ((k * 2 + c) % 4)) / 8, p1 = D.rnd() * TAU, p2 = D.rnd() * TAU, pan = (k + c) % 2 ? 1 : 0.55;
        let amp = 0;
        for (let i = 0; i < src.length; i++) {
          if ((i & 63) === 0) { const t = i / sr; fl.set(fr[k] * (1 + 0.04 * Math.sin(TAU * lf * t + p1)), 42); amp = fg[k] * pan * (0.6 + 0.4 * Math.sin(TAU * la * t + p2)); }
          acc[i] += fl.run(src[i], 1) * amp;
        }
      }
      {                                                                   // um guincho de aço por volta
        const fl = new SVF(sr), a0 = Math.floor((3 + c * 0.07) * sr), m = Math.floor(1.8 * sr);
        for (let i = 0; i < m; i++) { if ((i & 31) === 0) fl.set(620 - 80 * i / m, 60); acc[a0 + i] += fl.run(src[a0 + i], 1) * 0.5 * Math.sin(Math.PI * i / m) * (c ? 0.6 : 1); }
      }
      add(o, D.fold(acc, n), 26);
      add(o, sub, 0.5); add(o, hum, 0.1);
      add(o, rattle, 1);
      for (let i = 0; i < n; i += 64) { const a = 0.7 + 0.3 * Math.sin(TAU * 3 * i / n + c * 2), m = Math.min(n, i + 64); for (let j = i; j < m; j++) o[j] += river[j] * a; }
    }
    for (let i = 0; i < 12; i++) {                                        // caçambas mordendo, alternando os lados
      clank.fill(0);
      D.modal(clank, D.rr(170, 240), [1, 1.59, 2.31, 3.13, 4.27], [0.3, 0.18, 0.14, 0.09, 0.06], [0.7, 0.5, 0.35, 0.2, 0.12]);
      D.noise(clank, { d: 0.012, vol: 0.2, hp: 3000 }); D.noise(clank, { color: 'pink', a: 0.05, d: 0.3, vol: 0.12, hp: 2500 });
      const at = i * 8 / 12 + D.rr(-0.03, 0.03), pan = i % 2 ? 0.75 : 0.25, g = D.rr(0.35, 0.55);
      D.wrap(out[0], clank, at, g * (1 - pan)); D.wrap(out[1], clank, at, g * pan);
    }
    return out;
  });
  loopDef('wind', { vol: 0.8, rate: [0.85, 1.25], lp: [700, 5000], gain: [0.35, 1] }, D => {    // vento em rajadas
    const sr = D.sr, n = 8 * sr, xf = Math.floor(0.5 * sr), out = [];
    for (let c = 0; c < 2; c++) {
      const b = new Float32Array(n + xf), gen = D.noiseGen('pink'), fl = new SVF(sr), p1 = D.rnd() * TAU, p2 = D.rnd() * TAU, p3 = D.rnd() * TAU;
      for (let i = 0; i < b.length; i++) {
        const u = i / n;
        if ((i & 31) === 0) fl.set(520 * Math.pow(2, 0.9 * Math.sin(TAU * u + p1) + 0.45 * Math.sin(TAU * 3 * u + p2)), 1.6);
        const x = gen();
        b[i] = (fl.run(x, 1) * 1.6 + x * 0.12) * (0.55 + 0.3 * Math.sin(TAU * 2 * u + p3) + 0.15 * Math.sin(TAU * 5 * u + p1));
      }
      out.push(D.fold(b, n));
    }
    return out;
  });
  loopDef('water', { vol: 0.7, rate: [0.85, 1.25], lp: [2500, 9000], gain: [0.45, 1] }, D => {  // riacho: chiado + bolhinhas
    const sr = D.sr, n = 6 * sr, out = [], blip = D.buf(0.08);
    for (let c = 0; c < 2; c++) {
      const b = bed(D, n, { color: 'pink', vol: 0.3, hp: 700, lp: 5000 });
      for (let i = 0; i < n; i++) b[i] *= 0.75 + 0.25 * Math.sin(TAU * 4 * i / n + c * 2);
      out.push(b);
    }
    for (let i = 0; i < 70; i++) {
      blip.fill(0); const f = D.rr(450, 1700), pan = D.rnd();
      D.osc(blip, { f, f1: f * D.rr(1.3, 1.9), a: 0.004, d: D.rr(0.02, 0.06), vol: D.rr(0.05, 0.2) });
      const at = D.rr(0, 6); D.wrap(out[0], blip, at, 1 - pan); D.wrap(out[1], blip, at, pan);
    }
    return out;
  });
  loopDef('rain', { vol: 0.7, rate: [0.9, 1.15], lp: [2500, 11000], gain: [0.35, 1] }, D => {   // chuva: chiado + telhado + pingos
    const sr = D.sr, n = 5 * sr, out = [];
    for (let c = 0; c < 2; c++) {
      const b = bed(D, n, { vol: 0.2, hp: 2500, lp: 9000 }); add(b, bed(D, n, { color: 'pink', vol: 0.35, bp: 500, q: 0.7 }), 1);
      D.grains(b, { n: 170, t0: 0, t1: 4.97, f0: 2500, f1: 8000, vol: 0.25, d0: 0.003, d1: 0.012 });
      out.push(b);
    }
    return out;
  });
  loopDef('cicadas', { vol: 0.5, rate: [0.92, 1.1], lp: [5000, 12000], gain: [0.4, 1] }, D => { // cigarras de verão: chiado + "miiin-min-min" + higurashi
    const sr = D.sr, n = 8 * sr, b = bed(D, n, { vol: 0.5, bp: 6500, q: 3, am: 75, amDepth: 0.7 });
    for (let i = 0; i < n; i++) b[i] *= 0.45 + 0.3 * Math.sin(TAU * i / n) + 0.15 * Math.sin(TAU * 3 * i / n + 1);
    const m1 = bed(D, n, { vol: 1, bp: 4600, q: 22, am: 110, amDepth: 0.85 }), m2 = bed(D, n, { vol: 0.6, bp: 6900, q: 20, am: 110, amDepth: 0.85 });
    for (let i = 0; i < n; i++) {                                         // sílabas: uma longa e três curtas a cada 4 s
      const t = (i / sr) % 4; let e = 0;
      if (t < 1.4) e = Math.sin(Math.PI * t / 1.4); else if (t < 3.2) { const u = ((t - 1.4) % 0.6) / 0.6; e = u < 0.7 ? Math.sin(Math.PI * u / 0.7) * 0.8 : 0; }
      b[i] += (m1[i] + m2[i]) * e * e * 2.2;
    }
    const k = D.buf(1.9), path = [];                                      // higurashi: "kana-kana-kana" descendo e desacelerando
    D.osc(k, { path: [[0, 3900], [1.8, 3400]], a: 0.1, s: 1.2, d: 0.6, vol: 0.2 });
    let t = 0, gap = 0.07; while (t < 1.9) { path.push(t); t += gap; gap *= 1.07; }
    for (let i = 0, j = 0; i < k.length; i++) { const tt = i / sr; while (j < path.length - 1 && tt >= path[j + 1]) j++; const u = (tt - path[j]) / ((path[j + 1] || 2) - path[j]); k[i] *= Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 2); }
    D.wrap(b, k, 5.6, 1);
    return b;
  });
  loopDef('crickets', { vol: 0.45, rate: [0.9, 1.1], lp: [5000, 12000], gain: [0.4, 1] }, D => { // noite: suzumushi "riiin" + grilo em trincas
    const sr = D.sr, n = 8 * sr, b = bed(D, n, { color: 'brown', vol: 0.06, lp: 300 }), ch = D.buf(0.05);
    for (let i = 0; i < n; i++) {
      const t = i / sr, ph = (t % 2) / 2, e = ph < 0.6 ? Math.pow(Math.sin(Math.PI * ph / 0.6), 0.7) : 0;
      b[i] += Math.sin(TAU * 4200 * t + 2 * Math.sin(TAU * 3 * t)) * e * (0.5 - 0.5 * Math.cos(TAU * 13 * t)) * 0.22;
      b[i] += Math.sin(TAU * 8400 * t) * e * (0.5 - 0.5 * Math.cos(TAU * 13 * t)) * 0.03;
    }
    for (let p = 0; p < 7; p++) for (let j = 0; j < 3; j++) { ch.fill(0); D.osc(ch, { f: 3100, f1: 3250, a: 0.008, s: 0.012, d: 0.02, vol: 0.16 }); D.wrap(b, ch, 0.5 + p * 8 / 7 + j * 0.075, 1); }
    return b;
  });

  // finishLoop(D, canais, pico): tira NaN e DC e normaliza os canais juntos
  function finishLoop(D, data, peak) {
    const ch = Array.isArray(data) ? data : [data]; let p = 0;
    for (let c = 0; c < ch.length; c++) { const b = ch[c]; let m = 0; for (let i = 0; i < b.length; i++) { if (b[i] !== b[i]) b[i] = 0; m += b[i]; } m /= b.length; for (let i = 0; i < b.length; i++) b[i] -= m; p = Math.max(p, D.peak(b)); }
    if (p > 1e-6) for (let c = 0; c < ch.length; c++) D.gain(ch[c], peak / p);
    return ch.length > 1 ? ch : ch[0];
  }
  const loopBuf = (G, name) => cached(G, 'loop:' + name, hashStr('loop:' + name), D => finishLoop(D, LOOPS[name].render(D), 0.5));

  // LoopHandle: o que E.Loops.start devolve
  function LoopHandle(name, o) {
    this.name = name; this.vol = o.vol === undefined ? 1 : o.vol; this.rate = o.rate === undefined ? 0.5 : o.rate;
    this.playing = true; this.G = null; this.src = null; this.g = null; this.f = null;
  }
  function loopMap(h, out) {
    const d = LOOPS[h.name], r = h.rate;
    out.rate = d.rate ? U.lerp(d.rate[0], d.rate[1], r) : 1;
    out.lp = d.lp ? Math.max(80, U.lerp(d.lp[0], d.lp[1], r)) : 18000;
    out.vol = h.vol * (d.vol === undefined ? 1 : d.vol) * (d.gain ? Math.max(0, U.lerp(d.gain[0], d.gain[1], r)) : 1);
    return out;
  }
  const lm = { rate: 1, lp: 18000, vol: 1 };
  // startLoopOn(G, h, fade): liga o loop num grafo
  function startLoopOn(G, h, fade) {
    if (h.src || !h.playing || !LOOPS[h.name]) return;
    const ctx = G.ctx, t = ctx.currentTime, ab = loopBuf(G, h.name);
    loopMap(h, lm);
    h.G = G; h.src = ctx.createBufferSource(); h.src.buffer = ab; h.src.loop = true; h.src.playbackRate.value = lm.rate;
    h.f = ctx.createBiquadFilter(); h.f.type = 'lowpass'; h.f.frequency.value = lm.lp; h.f.Q.value = 0.5;
    h.g = ctx.createGain(); h.g.gain.setValueAtTime(0, t); h.g.gain.linearRampToValueAtTime(lm.vol, t + (fade === undefined ? 0.35 : fade));
    h.src.connect(h.f); h.f.connect(h.g); h.g.connect(G.loop);
    h.src.start(t, G.offline ? 0 : Math.random() * ab.duration);          // fase aleatória: dois loops iguais não batem juntos
  }
  // set({vol, rate}, tc=0.15): muda volume e regime (0 = marcha lenta, 1 = tudo) deslizando, sem clique
  LoopHandle.prototype.set = function (o, tc) {
    if (o) { if (o.vol !== undefined) this.vol = Math.max(0, o.vol); if (o.rate !== undefined) this.rate = clamp(o.rate, -0.2, 1.6); }
    if (!this.src || !this.playing) return this;
    const t = this.G.ctx.currentTime; tc = tc || 0.15; loopMap(this, lm);
    this.src.playbackRate.setTargetAtTime(lm.rate, t, tc); this.f.frequency.setTargetAtTime(lm.lp, t, tc);
    this.g.gain.cancelScheduledValues(t); this.g.gain.setTargetAtTime(lm.vol, t, tc);
    return this;
  };
  // stop(fade=0.5): desliga com fade e solta os nós
  LoopHandle.prototype.stop = function (fade) {
    if (!this.playing) return;
    this.playing = false;
    const i = liveLoops.indexOf(this); if (i >= 0) liveLoops.splice(i, 1);
    if (!this.src) return;
    const t = this.G.ctx.currentTime, src = this.src, g = this.g, f = this.f; fade = fade === undefined ? 0.5 : Math.max(0.02, fade);
    try {
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade);
      src.onended = () => { try { g.disconnect(); f.disconnect(); } catch (err) { /* ok */ } };
      src.stop(t + fade + 0.03);
    } catch (err) { /* ok */ }
    this.src = null;
  };

  const Loops = {
    /* start(nome, {vol=1, rate=0.5}) -> handle {set({vol,rate}, tc), stop(fade), playing, name}
       rate é o "regime": 0 = marcha lenta/calmo, 1 = tudo/forte. Antes do áudio destravar o handle fica pendente e liga sozinho */
    start(name, o) {
      const h = new LoopHandle(name, o || NOOPTS);
      if (!LOOPS[name]) { h.playing = false; return h; }
      liveLoops.push(h);
      if (ready()) startLoopOn(L, h);
      return h;
    },
    // stopAll(fade=0.5): desliga todos
    stopAll(fade) { for (let i = liveLoops.length - 1; i >= 0; i--) liveLoops[i].stop(fade); },
    // names() -> nomes dos loops ; active() -> handles ligados
    names() { return Object.keys(LOOPS); },
    active() { return liveLoops; },
    // define(nome, {render(D)->Float32Array|[L,R] (loop exato), vol, rate:[a,b], lp:[a,b], gain:[a,b]}): registra um loop próprio
    define(name, d) { LOOPS[name] = Object.assign({}, d); bufCache.forEach((_, k) => { if (k.endsWith('|loop:' + name)) bufCache.delete(k); }); return Loops; },
    // buffer(nome) -> AudioBuffer do loop (um ciclo exato), pra inspecionar/exportar; null sem áudio
    buffer(name) { const G = L || offlineGraph(1); return G && LOOPS[name] ? loopBuf(G, name) : null; },
    // helpers pra quem escreve render de loop: bed (cama de ruído sem emenda), pulses (trem de pulsos), tones (osciladores de ciclo inteiro)
    bed, pulses, tones,
  };
  onFlush.push(() => { for (let i = 0; i < liveLoops.length; i++) startLoopOn(L, liveLoops[i]); });

  /* ======================================================================
     E.Music — trilha generativa
     Forma: seções de 8 compassos com motivos A / A' / B que persistem, mudam um pouco ou renascem a cada seção
     (repetição com variação). Camadas entram e saem com a intensidade. Agendamento: setInterval de 25 ms que
     agenda tudo o que cai nos próximos 100 ms no relógio do AudioContext.
     ====================================================================== */
  const SCALES = {
    yo: [0, 2, 5, 7, 9], ryo: [0, 2, 4, 7, 9], minyo: [0, 3, 5, 7, 10], ryukyu: [0, 4, 5, 7, 11], hirajoshi: [0, 2, 3, 7, 8],
    kumoi: [0, 2, 3, 7, 9], in: [0, 1, 5, 7, 8], insen: [0, 1, 5, 7, 10], iwato: [0, 1, 5, 6, 10],
  };
  const PROG_MAJ = [[0, 0, 3, 2], [0, 4, 2, 3], [0, 2, 3, 0], [0, 3, 4, 2]], PROG_MIN = [[0, 0, 2, 3], [0, 3, 2, 0], [0, 4, 3, 0]];
  const euclid = (k, n, rot) => { const a = []; for (let i = 0; i < n; i++) a.push(((i + (rot || 0)) * k) % n < k); return a; };
  const mask = s => { const a = []; for (let i = 0; i < 16; i++) a.push(s[i] === 'x'); return a; };
  const MEL_MASKS = [euclid(5, 16), euclid(7, 16), euclid(6, 16, 1), mask('x...x.x.x...x...'), mask('x..x..x.x...x.x.'), mask('x.x...x.x..x....'), mask('x...x...x.x.x...'), mask('..x.x.x...x.x...')];
  const MARKOV = [-3, 0.04, -2, 0.14, -1, 0.28, 0, 0.08, 1, 0.26, 2, 0.13, 3, 0.04, 4, 0.03];
  const LAYER_REV = { pad: 0.2, koto: 0.35, shaku: 0.5, bass: 0.04, shime: 0.14, don: 0.25, shami: 0.2, kane: 0.2, furin: 0.6, drip: 0.7, clap: 0.2, anvil: 0.3 };
  const FLUTES = {
    shaku: { att: 0.12, breath: 0.16, vib: 18, scoop: 70, oct: 0, every: 2 },   // shakuhachi: sopro, ataque lento, notas longas
    shinobue: { att: 0.035, breath: 0.07, vib: 9, scoop: 25, oct: 12, every: 1 }, // flauta de festival: aguda e ligeira
  };
  const THEMES = Object.create(null);
  /* tema = dados puros. layers: nome -> [limiar de intensidade, ganho]. keys: [escala, raiz midi, peso].
     Outros jogos registram o seu com E.Music.define(nome, {...}) */
  THEMES.campo = { label: 'Campo', bpm: 76, lift: 0.14, swing: 0, dens: 0.75, rev: 0.3, kind: 'koto', flute: 'shaku',
    keys: [['yo', 62, 5], ['ryo', 55, 3], ['minyo', 59, 2]], progs: PROG_MAJ, pad: { oct: -12, wave: 'triangle', lp: 1100 },
    layers: { pad: [-1, 0.4], koto: [-1, 0.6], furin: [-1, 0.4], bass: [0.15, 0.6], shaku: [0.3, 0.5], shime: [0.38, 0.36], don: [0.58, 0.6], shami: [0.6, 0.26], kane: [0.82, 0.14] } };
  THEMES.trabalho = { label: 'Trabalho', bpm: 88, lift: 0.12, swing: 0.03, dens: 0.8, rev: 0.25, kind: 'koto', flute: 'shaku',
    keys: [['minyo', 64, 5], ['yo', 57, 3], ['minyo', 59, 2]], progs: PROG_MIN, pad: { oct: -12, wave: 'triangle', lp: 1000 },
    layers: { pad: [-1, 0.36], koto: [-1, 0.6], bass: [0.05, 0.62], shime: [0.2, 0.36], clap: [0.25, 0.3], shami: [0.45, 0.28], shaku: [0.45, 0.45], don: [0.5, 0.62], kane: [0.85, 0.14] } };
  THEMES.maquinas = { label: 'Máquinas', bpm: 96, lift: 0.12, swing: 0, dens: 0.82, rev: 0.22, kind: 'shami', flute: 'shaku', bassDrive: 0.5,
    keys: [['minyo', 64, 5], ['minyo', 59, 3], ['yo', 57, 2]], progs: PROG_MIN, pad: { oct: -24, wave: 'sawtooth', lp: 420 },
    layers: { pad: [-1, 0.34], koto: [-1, 0.5], bass: [-1, 0.66], shime: [0.15, 0.36], don: [0.35, 0.66], anvil: [0.45, 0.3], shami: [0.55, 0.26], shaku: [0.65, 0.42], kane: [0.8, 0.14] } };
  THEMES.bagger = { label: 'Bagger 293', bpm: 72, lift: 0.11, swing: 0, dens: 0.7, rev: 0.4, kind: 'koto', flute: 'shaku', heavy: true,
    keys: [['minyo', 57, 5], ['in', 57, 2], ['yo', 62, 2]], progs: PROG_MIN, pad: { oct: -24, wave: 'sawtooth', lp: 300 },
    layers: { pad: [-1, 0.5], don: [-1, 0.75], bass: [-1, 0.7], koto: [0.1, 0.55], anvil: [0.25, 0.32], shami: [0.35, 0.28], shaku: [0.45, 0.5], shime: [0.55, 0.36], kane: [0.85, 0.14] } };
  THEMES.noite = { label: 'Noite', bpm: 60, lift: 0.06, swing: 0, dens: 0.55, rev: 0.45, kind: 'koto', flute: 'shaku', lead: 'shaku',
    keys: [['hirajoshi', 57, 5], ['kumoi', 57, 3], ['in', 57, 1]], progs: PROG_MIN, pad: { oct: -12, wave: 'triangle', lp: 900 },
    layers: { pad: [-1, 0.42], koto: [-1, 0.5], furin: [-1, 0.35], drip: [0.1, 0.35], shaku: [0.25, 0.5], bass: [0.4, 0.5] } };
  THEMES.festa = { label: 'Festa', bpm: 112, lift: 0.1, swing: 0.08, dens: 0.85, rev: 0.25, kind: 'koto', flute: 'shinobue', matsuri: true, fills: 0.55,
    keys: [['ryo', 55, 5], ['yo', 62, 3], ['ryukyu', 60, 1]], progs: PROG_MAJ, pad: { oct: -12, wave: 'triangle', lp: 1300 },
    layers: { pad: [-1, 0.28], koto: [-1, 0.55], shime: [-1, 0.4], bass: [0.1, 0.6], shaku: [0.15, 0.4], don: [0.2, 0.65], clap: [0.3, 0.32], kane: [0.45, 0.18], shami: [0.5, 0.28] } };
  THEMES.calma = { label: 'Calma', bpm: 54, lift: 0.05, swing: 0, dens: 0.42, rev: 0.5, kind: 'harp', flute: 'shaku', lead: 'shaku',
    keys: [['kumoi', 62, 4], ['yo', 62, 3], ['insen', 62, 2]], progs: PROG_MAJ, pad: { oct: -12, wave: 'triangle', lp: 950 },
    layers: { pad: [-1, 0.5], koto: [-1, 0.5], furin: [-1, 0.45], drip: [-1, 0.35], shaku: [0.35, 0.45], bass: [0.6, 0.4] } };

  const musicEv = E.Emitter ? E.Emitter() : { on() { return () => {}; }, emit() {} };
  const evQ = [];                     // fila {t, ev, a, b} de eventos de batida (despachados quando o relógio chega)
  let evFree = [];

  /* makePlayer(G, tema, seed, t0, I0) -> player: um "músico" tocando um tema num grafo. A trilha ao vivo usa um
     (dois durante o crossfade); o render offline usa outro, com a mesma lógica */
  function makePlayer(G, name, seed, t0, I0) {
    const th = THEMES[name] || THEMES.campo, ctx = G.ctx, rng = E.RNG(seed);
    const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const P = { G, name, th, I: I0, target: I0, bpm: th.bpm * (1 + th.lift * I0), nextT: t0, step: 0, bar: 0, sec: -1, dying: false, dieT: 0,
      barT: t0, scale: SCALES.yo, root: 62, keyName: 'yo', intensityFn: null, primary: false };
    P.out = gain(0); P.out.connect(G.music);
    P.rev = gain(th.rev); P.rev.connect(G.revSend);
    const layers = {}, names = Object.keys(th.layers);
    for (let i = 0; i < names.length; i++) {
      const n = names[i], Lr = { name: n, thr: th.layers[n][0], vol: th.layers[n][1], on: false, offBar: -9, g: gain(0) };
      Lr.g.connect(P.out);
      const rv = LAYER_REV[n] || 0; if (rv) { Lr.send = gain(rv); Lr.g.connect(Lr.send); Lr.send.connect(P.rev); }
      layers[n] = Lr;
    }
    const fl = FLUTES[th.flute] || FLUTES.shaku;
    let keyIdx = 0, keyLeft = 0, prog = th.progs[0], chord = 0, lastPadRoot = -99, padInv = false, pad = null;
    let A = null, A2 = null, B = null, phrase = null, layout = ['A', 'A2', 'B', 'A2'], breather = false, breathIn = rng.int(6, 10);
    let dens = th.dens, weatherIn = rng.int(3, 5), shimeM = euclid(3, 8), donM = [], kaneM = euclid(9, 16), ost = [0, -1, 2, 0, -1, 4, 2, -1];
    const d2m = deg => degMidi(deg, P.scale, P.root);
    const hum = () => (rng() - 0.5) * 0.016;
    const act = n => { const Lr = layers[n]; return !!Lr && (Lr.on || P.bar - Lr.offBar < 1); };

    /* ---- vozes ---- */
    // corda (koto/shami/bass/harp) -> camada
    function pluck(Lr, midi, t, vel, kind, bend) {
      const k = ksBuf(G, midi, kind), s = ctx.createBufferSource(), g = gain(vel);
      s.buffer = k.buf; s.playbackRate.setValueAtTime(k.rate, Math.max(0, t));
      if (bend) { s.playbackRate.setValueAtTime(k.rate, t + 0.06); s.playbackRate.linearRampToValueAtTime(k.rate * semi(bend), t + 0.22); }   // "oshide" do koto
      s.connect(g); g.connect(Lr.g); s.onended = () => { try { g.disconnect(); } catch (err) { /* ok */ } };
      s.start(Math.max(0, t));
    }
    function drum(Lr, kind, t, vel, rate) {
      const s = ctx.createBufferSource(), g = gain(vel); s.buffer = drumBuf(G, kind, 0); if (rate) s.playbackRate.value = rate;
      s.connect(g); g.connect(Lr.g); s.onended = () => { try { g.disconnect(); } catch (err) { /* ok */ } };
      s.start(Math.max(0, t));
    }
    // flauta de bambu: onda com 2º harmônico forte + sopro (ruído rosa em passa-banda), "scoop" de afinação, vibrato que chega depois
    function flute(Lr, midi, t, dur, vel) {
      t = Math.max(0, t);
      if (!G.fluteWave) G.fluteWave = ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.3, 0.13, 0.05, 0.02]));
      const f = mtof(midi + fl.oct), o = ctx.createOscillator(), env = gain(0), lfo = ctx.createOscillator(), lg = gain(0);
      const nz = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = gain(0), end = t + dur;
      o.setPeriodicWave(G.fluteWave); o.frequency.value = f;
      o.detune.setValueAtTime(-fl.scoop, t); o.detune.linearRampToValueAtTime(0, t + 0.12);
      if (dur > 0.5) { o.detune.setValueAtTime(0, end - 0.2); o.detune.linearRampToValueAtTime(-40, end + 0.05); }
      lfo.frequency.value = 4.8 + rng() * 0.6; lg.gain.setValueAtTime(0, t + 0.3); lg.gain.linearRampToValueAtTime(fl.vib, t + 0.9); lfo.connect(lg); lg.connect(o.detune);
      nz.buffer = noiseLoop(G); nz.loop = true; bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 2, 7000); bp.Q.value = 5;
      ng.gain.setValueAtTime(fl.breath * 9, t); ng.gain.exponentialRampToValueAtTime(fl.breath * 3, t + 0.07);     // "muraiki": sopro forte no ataque
      nz.connect(bp); bp.connect(ng); ng.connect(env); o.connect(env);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(vel, t + fl.att); env.gain.setTargetAtTime(vel * 0.8, t + fl.att, 0.3); env.gain.setTargetAtTime(0, end, 0.08);
      env.connect(Lr.g);
      o.onended = () => { try { env.disconnect(); lg.disconnect(); } catch (err) { /* ok */ } };
      o.start(t); lfo.start(t); nz.start(t, rng() * 1.2); o.stop(end + 0.6); lfo.stop(end + 0.6); nz.stop(end + 0.6);
    }
    // pad tipo shō: 3 vozes (tônica, +2, +4 graus), cada uma dois osciladores desafinados; troca com crossfade longo
    function padChord(rootDeg, t) {
      const Lr = layers.pad; if (!Lr) return;
      releasePad(t, 1.1);
      const pd = th.pad, g = gain(0), lp = ctx.createBiquadFilter(), oscs = [];
      lp.type = 'lowpass'; lp.frequency.value = pd.lp; lp.Q.value = 0.4;
      g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(1, t, 0.8);
      const degs = padInv ? [rootDeg + 2, rootDeg + 4, rootDeg + 5] : [rootDeg, rootDeg + 2, rootDeg + 4]; padInv = !padInv;
      for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) {
        const o = ctx.createOscillator(), og = gain(pd.wave === 'sawtooth' ? 0.085 : 0.12);
        o.type = pd.wave; o.frequency.value = mtof(d2m(degs[i]) + pd.oct); o.detune.value = (k ? 5 : -5) + (rng() - 0.5) * 3;
        o.connect(og); og.connect(lp); o.start(t); oscs.push(o);
      }
      lp.connect(g); g.connect(Lr.g);
      pad = { g, oscs };
    }
    function releasePad(t, tc) {
      if (!pad) return;
      const p = pad; pad = null;
      p.g.gain.cancelScheduledValues(t); p.g.gain.setTargetAtTime(0, t, tc);
      p.oscs[0].onended = () => { try { p.g.disconnect(); } catch (err) { /* ok */ } };
      for (let i = 0; i < p.oscs.length; i++) p.oscs[i].stop(t + tc * 6);
    }

    /* ---- composição ---- */
    function markov() { let r = rng(), i = 0; for (; i < MARKOV.length - 2; i += 2) { r -= MARKOV[i + 1]; if (r < 0) break; } return MARKOV[i]; }
    function fixLens(m, cap) {
      m.last = -1; let prev = -1;
      for (let s = 0; s < 32; s++) if (m.deg[s] >= 0) { if (prev >= 0) m.len[prev] = Math.min(cap, s - prev); prev = s; m.last = s; }
      if (prev >= 0) m.len[prev] = Math.min(cap, 32 - prev);
      return m;
    }
    function newMotif() {
      const m = { deg: new Int8Array(32).fill(-1), len: new Uint8Array(32), last: -1 }, mk = rng.pick(MEL_MASKS), rot = rng.int(0, 3) * 2;
      let deg = rng.pick([2, 3, 5, 5, 7]), leap = 0;
      for (let s = 0; s < 32; s++) {
        if (!mk[(s + (s >= 16 ? rot : 0)) % 16] || rng() > 0.84) continue;
        const st = leap ? (leap > 0 ? -1 : 1) : markov(); leap = Math.abs(st) >= 3 ? st : 0;     // depois de um salto, volta por grau conjunto
        deg += st; if (deg < 0) deg = -deg; if (deg > 11) deg = 22 - deg;
        m.deg[s] = deg;
      }
      if (m.deg[0] < 0 && rng() < 0.7) m.deg[0] = deg;
      return fixLens(m, 8);
    }
    function mutate(src, strength) {
      const m = { deg: src.deg.slice(), len: src.len.slice(), last: src.last }, ops = 1 + (rng() < strength ? 1 : 0);
      for (let k = 0; k < ops; k++) {
        const op = rng.int(0, 4), notes = []; for (let s = 0; s < 32; s++) if (m.deg[s] >= 0) notes.push(s);
        if (notes.length < 2) break;
        if (op === 0) { const d = rng.sign(); for (let i = 0; i < notes.length; i++) m.deg[notes[i]] = clamp(m.deg[notes[i]] + d, 0, 11); }                    // transpõe
        else if (op === 1) { const h = notes.length >> 1; for (let i = 0; i < h; i++) { const a = notes[i], b = notes[notes.length - 1 - i], x = m.deg[a]; m.deg[a] = m.deg[b]; m.deg[b] = x; } }   // inverte a ordem das alturas
        else if (op === 2 && notes.length > 3) m.deg[rng.pick(notes)] = -1;                                                                                    // tira uma nota
        else if (op === 3) { const s = rng.pick(notes); if (s + 2 < 32 && m.deg[s + 2] < 0) m.deg[s + 2] = clamp(m.deg[s] + rng.sign(), 0, 11); }             // dobra em duas colcheias
        else { for (let i = 0; i < notes.length; i++) if (notes[i] >= 16) m.deg[notes[i]] = Math.min(11, m.deg[notes[i]] + (m.deg[notes[i]] < 7 ? 5 : 0)); }   // 2ª metade uma oitava acima
      }
      return fixLens(m, 8);
    }
    // frase da flauta: o contorno do motivo em notas longas (pergunta do koto, resposta do sopro)
    function phraseFrom(src) {
      const m = { deg: new Int8Array(32).fill(-1), len: new Uint8Array(32), last: -1 }; let k = 0, lastS = -9;
      const gap = fl.every > 1 ? 4 : 2;
      for (let s = 0; s < 32; s++) if (src.deg[s] >= 0 && (k++ % fl.every) === 0) { const q = s & ~1; if (q - lastS >= gap) { m.deg[q] = src.deg[s]; lastS = q; } }
      return fixLens(m, fl.every > 1 ? 12 : 6);
    }
    function newSection(t) {
      P.sec++;
      if (keyLeft-- <= 0) {                                               // muda de escala/tom a cada 9-14 seções (4-6 min), sempre por notas comuns
        if (P.sec > 0 && th.keys.length > 1) { let tot = 0, r, i; for (i = 0; i < th.keys.length; i++) if (i !== keyIdx) tot += th.keys[i][2]; r = rng() * tot; for (i = 0; i < th.keys.length; i++) { if (i === keyIdx) continue; r -= th.keys[i][2]; if (r < 0) break; } keyIdx = Math.min(i, th.keys.length - 1); }
        const K = th.keys[keyIdx]; P.keyName = K[0]; P.scale = SCALES[K[0]] || SCALES.yo; P.root = K[1];
        keyLeft = keyIdx === 0 ? rng.int(9, 14) : rng.int(3, 6);            // escalas "de passagem" ficam pouco (fadiga)
        lastPadRoot = -99;
      }
      if (P.sec === 0 || rng() < 0.7) prog = rng.pick(th.progs);
      if (!A) { A = newMotif(); B = newMotif(); }
      else {
        let r = rng(); if (r > 0.75) A = newMotif(); else if (r > 0.4) A = mutate(A, 0.5);
        r = rng(); if (r > 0.6) B = newMotif(); else if (r > 0.3) B = mutate(B, 0.5);
      }
      A2 = mutate(A, 0.3); phrase = phraseFrom(rng() < 0.6 ? A : B);
      layout = rng() < 0.6 ? ['A', 'A2', 'B', 'A2'] : ['A', 'B', 'A2', rng() < 0.5 ? 'A' : null];
      if (rng() < 0.3) layout[3] = null;                                  // "ma": compassos 7-8 só de silêncio, pad e sino
      breather = false;
      if (--breathIn <= 0 && P.sec > 0) { breather = true; breathIn = rng.int(7, 11); }   // seção de respiro a cada 3-5 min
      if (--weatherIn <= 0) { weatherIn = rng.int(3, 5); dens = clamp(dens + rng.range(-0.15, 0.15), Math.max(0.3, th.dens - 0.25), Math.min(0.95, th.dens + 0.15)); P.rev.gain.setTargetAtTime(clamp(th.rev + rng.range(-0.08, 0.08), 0.1, 0.6), t, 2); }
      shimeM = rng() < 0.5 ? euclid(rng.pick([5, 7]), 16, rng.int(0, 3)) : euclid(3, 8, rng.int(0, 2)).concat(euclid(3, 8, rng.int(0, 2)));
      donM.length = 0; for (let i = 0; i < 16; i++) donM.push(false);
      if (th.matsuri) { donM[0] = donM[4] = true; if (rng() < 0.5) donM[14] = true; }
      else if (th.heavy) { donM[0] = true; if (rng() < 0.6) donM[10] = true; if (rng() < 0.3) donM[8] = true; }
      else { donM[0] = donM[8] = true; if (rng() < 0.6) donM[rng() < 0.5 ? 11 : 14] = true; }
      kaneM = euclid(9, 16, rng.int(0, 3));
      for (let i = 0; i < 8; i++) ost[i] = rng() < 0.68 ? rng.pick([0, 0, 2, 4, 2, 5]) : -1; ost[0] = 0;
      if (P.primary) qEvent(t, 'section', P.sec, P.keyName);
    }

    function onBar(bar, t) {
      P.barT = t;
      if (P.intensityFn) P.target = clamp(P.intensityFn(t), 0, 1);
      P.I += (P.target - P.I) * 0.45;                                     // intensidade só anda nos compassos
      P.bpm += (th.bpm * (1 + th.lift * P.I) - P.bpm) * 0.3;
      if (bar % 8 === 0) newSection(t);
      chord = prog[bar % 4];
      for (let i = 0; i < names.length; i++) {                            // liga/desliga camadas com histerese e fade
        const Lr = layers[names[i]];
        let want = P.I >= (Lr.on ? Lr.thr - 0.07 : Lr.thr);
        if (breather && Lr.name !== 'pad' && Lr.name !== 'koto' && Lr.name !== 'furin' && Lr.name !== 'drip') want = false;
        if (want !== Lr.on || bar === 0) {
          Lr.on = want; if (!want) Lr.offBar = bar;
          if (bar === 0) Lr.g.gain.setValueAtTime(want ? Lr.vol : 0, t); else Lr.g.gain.setTargetAtTime(want ? Lr.vol : 0, t, want ? 0.5 : 0.9);
        }
      }
      if (chord !== lastPadRoot || bar % 4 === 0) { padChord(chord, t); lastPadRoot = chord; }
      const barLen = 60 / P.bpm * 4;
      if (act('furin') && rng() < (breather ? 0.5 : 0.2)) drum(layers.furin, 'furin', t + rng() * barLen, 0.25 + rng() * 0.3, 0.8 + rng() * 0.4);
      if (bar % 8 === 0 && act('koto') && !breather && P.I > 0.3 && rng() < 0.3) for (let i = 0; i < 6; i++) pluck(layers.koto, d2m(11 - i), t + i * 0.035 - 0.21, 0.22 + i * 0.03, th.kind);   // "sararin" abrindo a seção
      if (P.primary) { tune.scale = P.scale; let r = P.root; while (r < 57) r += 12; while (r > 68) r -= 12; tune.root = r; qEvent(t, 'bar', bar, P.I); }
    }

    function onStep(s, bar, t) {
      const I = P.I, slot = (bar % 8) >> 1, cur = layout[slot], ms = s + 16 * (bar % 2), six = 60 / P.bpm / 4;
      const acc = s === 0 ? 1 : s === 8 ? 0.85 : s % 4 === 0 ? 0.7 : 0.5, last = bar % 8 === 7;
      if (P.primary && s % 4 === 0) qEvent(t, 'beat', s >> 2, bar);
      const shakuOn = act('shaku'), answers = shakuOn && (slot === 1 || (th.lead === 'shaku' && slot === 3) || (th.flute === 'shinobue' && slot >= 2));
      /* melodia: koto (ou shamisen/harpa) */
      if (act('koto')) {
        if (breather) { if ((s === 0 || s === 8) && rng() < 0.45) pluck(layers.koto, d2m(rng.pick([0, 2, 4, 5, 7])) + 12, t + hum(), 0.22, th.kind); }
        else if (cur && !(answers && I < 0.7 && th.flute !== 'shinobue')) {
          const m = cur === 'A' ? A : cur === 'A2' ? A2 : B; let dg = m.deg[ms];
          if (dg >= 0 && rng() < 0.5 + 0.5 * dens + 0.1 * I) {
            const fin = last && slot === 3 && ms === m.last;
            if (fin) dg = Math.round(dg / 5) * 5;                         // a última nota da seção repousa na tônica
            const vel = acc * (0.5 + 0.35 * I) * (0.85 + rng() * 0.3), tt = t + hum(), midi = d2m(dg);
            if (rng() < 0.12 && dg > 0) pluck(layers.koto, d2m(dg - 1), tt - 0.045, vel * 0.5, th.kind);                  // apojatura
            pluck(layers.koto, midi, tt, fin ? vel * 1.15 : vel, th.kind, m.len[ms] >= 4 && rng() < 0.08 ? rng.pick([1, 2]) : 0);
            if (I > 0.6 && cur === 'A2' && acc >= 0.7) pluck(layers.koto, midi + 12, tt + 0.008, vel * 0.45, th.kind);   // dobra de oitava
          }
        }
      }
      /* flauta: responde o koto com o contorno do motivo */
      if (shakuOn && answers && !breather) {
        const dg = phrase.deg[ms];
        if (dg >= 0) flute(layers.shaku, d2m(Math.min(dg, 9)), t + hum(), Math.max(0.18, phrase.len[ms] * six * 0.9), (0.55 + 0.25 * I) * (0.85 + rng() * 0.3));
      }
      /* baixo */
      if (act('bass') && !breather) {
        const b0 = d2m(chord) - 24;
        if (s === 0) pluck(layers.bass, b0, t, 0.8, 'bass');
        else if (s === 8 && I > 0.3) pluck(layers.bass, b0, t, 0.6, 'bass');
        else if (th.bassDrive !== undefined && I > th.bassDrive && s % 2 === 0) pluck(layers.bass, (s % 8 === 6 ? d2m(chord + 3) : s % 4 === 2 ? d2m(chord + 2) : d2m(chord)) - 24, t + hum(), 0.45, 'bass');
      }
      /* percussão */
      const fill = last && I > (th.fills || 0.8) && s >= 8 && act('shime');
      if (act('shime') && (fill || shimeM[s])) drum(layers.shime, 'ten', t + hum(), fill ? 0.25 + 0.6 * (s - 8) / 7 : acc * 0.8 * (0.85 + rng() * 0.3));
      if (act('don')) {
        if (donM[s]) drum(layers.don, 'don', t, s === 0 ? 0.9 : 0.7, th.heavy ? 0.84 : 1);
        if (th.matsuri && (s === 8 || s === 10 || s === 12)) drum(layers.don, 'ka', t + hum(), 0.6);
        if (fill && s === 15) drum(layers.don, 'chu', t, 0.8);
      }
      if (act('clap') && (s === 4 || s === 12 || (s === 14 && bar % 2 === 1))) drum(layers.clap, 'clap', t + hum(), s === 14 ? 0.5 : 0.8);
      if (act('anvil') && (s === 4 || s === 12 || (s === 7 && bar % 4 === 3))) drum(layers.anvil, 'anvil', t + hum(), s === 7 ? 0.45 : 0.8, bar % 2 ? 1 : 0.89);
      if (act('kane') && kaneM[s]) drum(layers.kane, s % 4 === 0 ? 'chan' : 'chiki', t + hum(), 0.5 + 0.4 * acc);
      if (act('shami') && s % 2 === 0 && ost[s >> 1] >= 0 && !breather) pluck(layers.shami, d2m(chord + ost[s >> 1]) - 12, t + hum(), 0.4 + 0.3 * acc, 'shami');
      if (act('drip') && rng() < 0.035) drum(layers.drip, 'drop', t + rng() * six, 0.3 + rng() * 0.4, semi(rng.pick(P.scale)) * rng.pick([0.5, 0.75, 1]));
    }

    // advance(até): agenda todos os passos (semicolcheias) que começam antes de `até`
    P.advance = function (until) {
      while (P.nextT < until) {
        if (P.step === 0) onBar(P.bar, P.nextT);
        onStep(P.step, P.bar, P.nextT);
        const six = 60 / P.bpm / 4;
        P.nextT += six * (1 + (P.step % 2 ? -1 : 1) * th.swing);
        if (++P.step === 16) { P.step = 0; P.bar++; }
      }
    };
    // nextBar() -> tempo do próximo compasso
    P.nextBar = () => P.nextT + (16 - P.step) % 16 * (60 / P.bpm / 4);
    // fadeIn(seg) / fadeOut(seg): entrada e saída do tema inteiro
    P.fadeIn = (t, sec) => { P.out.gain.cancelScheduledValues(t); P.out.gain.setValueAtTime(0, t); P.out.gain.linearRampToValueAtTime(1, t + Math.max(0.02, sec)); };
    P.fadeOut = (t, sec) => {
      sec = Math.max(0.05, sec); P.dying = true; P.dieT = t + sec;
      P.out.gain.cancelScheduledValues(t); P.out.gain.setValueAtTime(P.out.gain.value, t); P.out.gain.linearRampToValueAtTime(0, t + sec);
      releasePad(t, sec / 3);
    };
    P.dispose = () => { try { P.out.disconnect(); P.rev.disconnect(); for (let i = 0; i < names.length; i++) { const Lr = layers[names[i]]; Lr.g.disconnect(); if (Lr.send) Lr.send.disconnect(); } } catch (err) { /* ok */ } };
    P.scaleMidi = d2m;
    P.layerOn = n => !!layers[n] && layers[n].on;
    return P;
  }

  function qEvent(t, ev, a, b) { const e = evFree.pop() || { t: 0, ev: '', a: 0, b: 0 }; e.t = t; e.ev = ev; e.a = a; e.b = b; evQ.push(e); }

  const LOOK_MS = 25, AHEAD = 0.1;
  let players = [], primary = null, pendingTheme = null, timer = 0, mTarget = 0.2, lastTheme = 'campo';
  function tick() {
    if (!ready()) return;
    const t = L.ctx.currentTime;
    for (let i = players.length - 1; i >= 0; i--) {
      const p = players[i];
      if (p.dying && t > p.dieT + 0.1) { p.dispose(); players.splice(i, 1); continue; }
      if (p.dying && t > p.dieT - 0.05) continue;
      if (p.nextT < t - 0.2) p.nextT = t + 0.05;                         // aba ficou em 2º plano: pula, não dispara rajada
      p.advance(t + AHEAD);
    }
    while (evQ.length && evQ[0].t <= t) { const e = evQ.shift(); musicEv.emit(e.ev, e.a, e.b); evFree.push(e); }
    if (!players.length && !pendingTheme) { clearInterval(timer); timer = 0; }
  }
  function launch(name, fade) {
    if (!THEMES[name]) name = 'campo';
    const t = L.ctx.currentTime; let t0 = t + 0.08;
    if (primary) {                                                        // entra no próximo compasso do tema antigo, se estiver perto
      const nb = primary.nextBar(); if (nb - t < Math.min(2.5, Math.max(fade, 0.5)) && nb > t0) t0 = nb;
      primary.primary = false; primary.fadeOut(t0, fade);
    }
    const seed = Music.seed !== null && Music.seed !== undefined ? Music.seed + players.length * 7919 + hashStr(name) : ((Date.now() ^ (Math.random() * 4294967296)) >>> 0);
    const p = makePlayer(L, name, seed, t0, primary ? primary.I : mTarget);
    p.target = mTarget; p.primary = true; p.fadeIn(t0, primary ? fade : Math.min(fade, 1.2));
    players.push(p); primary = p; lastTheme = name; evQ.length = 0;
    if (!timer) timer = setInterval(tick, LOOK_MS);
    musicEv.emit('theme', name);
    tick();
  }

  const Music = {
    // start(tema='campo', {intensity, fade=1}): começa a trilha (se já toca outro tema, faz crossfade). Antes de destravar fica pendente
    start(name, o) {
      name = name || lastTheme;
      if (o && o.intensity !== undefined) Music.setIntensity(o.intensity);
      if (primary && primary.name === name) return Music;
      if (!ready()) { pendingTheme = name; lastTheme = name; return Music; }
      pendingTheme = null; launch(name, o && o.fade !== undefined ? o.fade : primary ? 2 : 1);
      return Music;
    },
    // stop(fade=1.5): para com fade
    stop(fade) {
      pendingTheme = null;
      if (!primary) return Music;
      if (L) primary.fadeOut(L.ctx.currentTime, fade === undefined ? 1.5 : fade);
      primary.primary = false; primary = null;
      return Music;
    },
    // setIntensity(0..1): 0 = só pad e koto; 1 = taiko, shamisen, sininho e viradas. Anda suave, de compasso em compasso
    setIntensity(v) { mTarget = clamp(+v || 0, 0, 1); for (let i = 0; i < players.length; i++) players[i].target = mTarget; return Music; },
    // setTheme(tema, crossfade=2): troca de tema com crossfade, entrando no compasso
    setTheme(name, crossfade) {
      if (!THEMES[name]) return Music;
      if (!primary) { if (pendingTheme || !ready()) { pendingTheme = name; lastTheme = name; } else launch(name, 1); return Music; }
      if (primary.name !== name) launch(name, crossfade === undefined ? 2 : crossfade);
      return Music;
    },
    // playing / theme / bpm / intensity (a que está soando) / bar / key (escala atual)
    get playing() { return !!primary || !!pendingTheme; },
    get theme() { return primary ? primary.name : pendingTheme || lastTheme; },
    get bpm() { return primary ? primary.bpm : (THEMES[lastTheme] || THEMES.campo).bpm; },
    get intensity() { return primary ? primary.I : mTarget; },
    get targetIntensity() { return mTarget; },
    get bar() { return primary ? primary.bar : 0; },
    get key() { return primary ? primary.keyName : 'yo'; },
    // seed: null = cada sessão diferente (padrão); número = mesma música sempre (testes)
    seed: null,
    // themes() -> nomes ; define(nome, tema): registra tema novo (veja THEMES.campo como modelo) ; get(nome) -> dados do tema
    themes() { return Object.keys(THEMES); },
    define(name, th) { THEMES[name] = Object.assign({}, THEMES.campo, th); return Music; },
    get(name) { return THEMES[name] || null; },
    scales: SCALES,
    // scaleMidi(grau, oitava=0) -> nota midi na escala que está tocando (pra afinar efeitos com a música)
    scaleMidi(deg, oct) { return degMidi(deg, tune.scale, tune.root) + 12 * (oct || 0); },
    // layerOn(nome) -> bool: a camada (koto, shaku, bass, shime, don, shami, kane...) está soando?
    layerOn(n) { return primary ? primary.layerOn(n) : false; },
    // quantDelay(div=2) -> segundos até a próxima subdivisão (div por tempo): Sfx.play('fanfare', {delay: Music.quantDelay()}) cai no ritmo
    quantDelay(div) {
      if (!primary || !ready()) return 0;
      const step = 60 / primary.bpm / (div || 2), t = L.ctx.currentTime, d = (primary.barT - t) % step;
      return d < 0 ? d + step : d;
    },
    // on('beat'|'bar'|'section'|'theme', fn) -> off. beat(tempo 0..3, compasso), bar(compasso, intensidade), section(n, escala)
    on(ev, fn) { return musicEv.on(ev, fn); },
  };
  onFlush.push(() => { if (pendingTheme && !primary) { const n = pendingTheme; pendingTheme = null; launch(n, 1); } });

  /* ======================================================================
     Render offline e análise (testes, demo, exportar som)
     ====================================================================== */
  const PRE = 0.25;                   // silêncio antes do som nos renders de sfx
  function offlineGraph(sec, sr) {
    if (!OAC) return null;
    sr = sr || (L ? L.sr : 44100);
    try { return buildGraph(new OAC(2, Math.max(1, Math.ceil(sec * sr)), sr), true); } catch (err) { return null; }
  }
  function renderGraph(G) {
    return new Promise(resolve => {
      try {
        const p = G.ctx.startRendering();
        if (p && p.then) p.then(resolve, () => resolve(null)); else G.ctx.oncomplete = e => resolve(e.renderedBuffer);
      } catch (err) { resolve(null); }
    });
  }
  // renderSfx(nome, {seconds=3.5, ...opts de play}) -> Promise<AudioBuffer|null>: o som passando pela cadeia master inteira
  Audio.renderSfx = function (name, o) {
    o = o || NOOPTS; const G = offlineGraph((o.seconds || 3.2) + PRE);
    if (!G || !DEFS[name]) return Promise.resolve(null);
    playOn(G, name, o, PRE);                                              // (o compressor do Chrome precisa de um instante pra assentar)
    return renderGraph(G).then(ab => {                                    // corta o silêncio inicial
      if (!ab) return null;
      const off = Math.floor(PRE * ab.sampleRate) - 64, out = G.ctx.createBuffer(ab.numberOfChannels, ab.length - off, ab.sampleRate);
      for (let c = 0; c < ab.numberOfChannels; c++) out.getChannelData(c).set(ab.getChannelData(c).subarray(off));
      return out;
    });
  };
  // renderLoop(nome, seg=4, {rate, vol}) -> Promise<AudioBuffer|null>
  Audio.renderLoop = function (name, sec, o) {
    const G = offlineGraph(sec || 4);
    if (!G || !LOOPS[name]) return Promise.resolve(null);
    const h = new LoopHandle(name, o || NOOPTS); startLoopOn(G, h, 0.05);
    return renderGraph(G);
  };
  // renderMusic(tema, seg=20, {intensity: número | fn(t)->0..1, seed=1}) -> Promise<AudioBuffer|null>
  Audio.renderMusic = function (name, sec, o) {
    o = o || NOOPTS; sec = sec || 20; const G = offlineGraph(sec);
    if (!G || !THEMES[name]) return Promise.resolve(null);
    const fn = typeof o.intensity === 'function' ? o.intensity : null, I0 = fn ? clamp(fn(0), 0, 1) : o.intensity === undefined ? 0.5 : o.intensity;
    const saveScale = tune.scale, saveRoot = tune.root;
    const p = makePlayer(G, name, o.seed === undefined ? 1 : o.seed, 0.05, I0);
    p.intensityFn = fn; p.fadeIn(0, 0.05);
    const restore = () => { tune.scale = saveScale; tune.root = saveRoot; };
    if (G.ctx.suspend && G.ctx.resume) {                                  // agenda aos poucos, como ao vivo (render longo não pesa)
      p.advance(1.1);
      for (let k = 1; k < sec; k++) G.ctx.suspend(k).then(() => { p.advance(k + 1.1); G.ctx.resume(); }, () => {});
    } else p.advance(sec);
    return renderGraph(G).then(ab => { restore(); return ab; });
  };

  // fft(re, im): FFT radix-2 no lugar (tamanho potência de 2)
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let x = re[i]; re[i] = re[j]; re[j] = x; x = im[i]; im[i] = im[j]; im[j] = x; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len >> 1; k++) {
          const a = i + k, b = a + (len >> 1), xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  Audio.fft = fft;
  // mono(audioBuffer) -> Float32Array com a média dos canais
  Audio.mono = function (ab) {
    const n = ab.length, out = new Float32Array(n), nc = ab.numberOfChannels;
    for (let c = 0; c < nc; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / nc; }
    return out;
  };
  /* analyze(audioBuffer) -> {peak, rms, dur, centroid (Hz), nan, clipped, silent, dc}
     peak = maior amostra de qualquer canal; dur = até a última amostra acima de -60 dB; rms sobre essa duração */
  Audio.analyze = function (ab) {
    const r = { peak: 0, rms: 0, dur: 0, centroid: 0, nan: 0, clipped: false, silent: true, dc: 0 };
    if (!ab) { r.nan = 1; return r; }
    const sr = ab.sampleRate, m = Audio.mono(ab), n = m.length; let last = 0, sum = 0, dc = 0;
    for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) { const v = d[i]; if (v !== v || v === Infinity || v === -Infinity) { r.nan++; continue; } const a = v < 0 ? -v : v; if (a > r.peak) r.peak = a; if (a > 0.001 && i > last) last = i; } }
    for (let i = 0; i <= last; i++) { sum += m[i] * m[i]; dc += m[i]; }
    r.dur = (last + 1) / sr; r.rms = Math.sqrt(sum / (last + 1)); r.dc = dc / (last + 1);
    r.clipped = r.peak >= 0.999; r.silent = r.peak < 0.003;
    const N = 2048, re = new Float32Array(N), im = new Float32Array(N); let num = 0, den = 0;
    for (let o = 0; o + N <= Math.max(N, last + 1) && o + N <= n; o += N) {
      for (let i = 0; i < N; i++) { re[i] = m[o + i] * (0.5 - 0.5 * Math.cos(TAU * i / N)); im[i] = 0; }
      fft(re, im);
      for (let k = 1; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k]; num += p * k * sr / N; den += p; }
    }
    r.centroid = den > 0 ? num / den : 0;
    return r;
  };

  // prewarm(nomes?): pré-renderiza sfx (todas as variantes) e loops em fatias de ~8 ms
  function prewarm(names) {
    if (!L) return;
    const jobs = [], list = names || Sfx.names();
    for (let i = 0; i < list.length; i++) {
      const nm = list[i], d = DEFS[nm];
      if (d && d.render) for (let v = 0; v < (d.v || 1); v++) { const key = 'sfx:' + nm + ':' + v; jobs.push(() => cached(L, key, hashStr(key), D => D.finish(d.render(D, v), d.peak === undefined ? 0.5 : d.peak))); }
      if (d && d.sub) jobs.push(() => subBuf(L, d.sub));
      if (LOOPS[nm]) jobs.push(() => loopBuf(L, nm));
    }
    ['don', 'chu', 'ten', 'ka', 'chan', 'chiki', 'clap', 'furin', 'drop', 'anvil'].forEach(k => jobs.push(() => drumBuf(L, k, 0)));
    const run = () => { const t0 = Date.now(); while (jobs.length && Date.now() - t0 < 8) { try { jobs.shift()(); } catch (err) { /* ok */ } } if (jobs.length) setTimeout(run, 16); };
    setTimeout(run, 0);
  }

  E.Audio = Audio;
  E.Sfx = Sfx;
  E.Loops = Loops;
  E.Music = Music;
})();


/* ===== engine/nature.js ===== */
/* ============================================================================
   Pixxel v1.0 — nature.js
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
  const E = (window.Pixxel = window.Pixxel || {});
  if (!E.U) throw new Error('Pixxel: carregue core.js antes de nature.js');
  if (!E.Pix) throw new Error('Pixxel: carregue pix.js antes de nature.js');
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


/* ===== engine/ui.js ===== */
/* ==========================================================================
   Pixxel v1.0 · ui.js — HUD em DOM por cima do canvas (par do pixxel.css)
   Depende só de core.js. Se pix.js estiver carregado, os ícones embutidos são
   pixel art (E.UI.icons); sem ele, viram glifos de texto (nunca emoji).
   Índice:
     1. base (DOM, relógio próprio, som opcional)      9. missões, metas
     2. ícones                                        10. álbum
     3. mount / zonas                                 11. ajustes (linha, toggle, slider)
     4. pílula, número rolante                        12. sparkline, taxa, medidor radial
     5. barra, meta                                   13. árvore (grafo de nós com pan/zoom)
     6. botão                                         14. export
     7. painel, abas, diálogo, confirmar
     8. banner, toast, conquista, celebração, tooltip
   ========================================================================== */
(function () {
  'use strict';
  const E = (window.Pixxel = window.Pixxel || {});
  if (!E.U) throw new Error('Pixxel: carregue core.js antes de ui.js');
  const U = E.U, doc = document, TAU = Math.PI * 2;
  const INK = '#2a1a10', CREAM = '#fffaee', YEL = '#ffe9a8', GOLD = '#f3c94a';
  const UI = { root: null, sound: true, fmt: U.fmt };

  /* ======================================================================
     1. Base
     ====================================================================== */
  // h(tag, classe?, pai?, texto?) -> elemento
  function h(tag, cls, parent, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  // par(p): resolve o pai de um componente (elemento, handle com .el, ou a raiz atual)
  function par(p) { return p ? (p.el && p.el.nodeType ? p.el : p) : UI.root; }
  function need() { if (!UI.root) throw new Error('Pixxel: chame E.UI.mount(stage) antes'); return UI.root; }

  /* relógio próprio: só roda enquanto existe algo animando (número rolando, árvore aberta) */
  const ticks = [];
  let raf = 0, lastNow = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    for (let i = ticks.length - 1; i >= 0; i--) if (ticks[i](dt, now / 1000) === false) ticks.splice(i, 1);
    if (ticks.length) raf = requestAnimationFrame(frame);
  }
  // tick(fn(dt,t)): registra uma animação; fn devolve false pra sair
  function tick(fn) {
    ticks.push(fn);
    if (!raf) { lastNow = performance.now(); raf = requestAnimationFrame(frame); }
    return fn;
  }

  // E.UI.sfx(nome, opts): toca um som da engine se audio.js existir e E.UI.sound estiver ligado (nunca quebra)
  function sfx(name, o) {
    if (!UI.sound || !E.Sfx || !E.Sfx.play) return;
    try { E.Sfx.play(name, o); } catch (e) { /* áudio é opcional */ }
  }

  // pressable(el): estado .k-press confiável no toque (o :active do iOS falha) + pulinho .k-pop ao soltar
  function pressable(el, pop) {
    const up = () => {
      if (!el.classList.contains('k-press')) return;
      el.classList.remove('k-press');
      if (pop) { el.classList.remove('k-pop'); void el.offsetWidth; el.classList.add('k-pop'); }
    };
    el.addEventListener('pointerdown', e => { if (e.button) return; el.classList.add('k-press'); });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', () => el.classList.remove('k-press'));
    el.addEventListener('pointercancel', () => el.classList.remove('k-press'));
    if (pop) el.addEventListener('animationend', e => { if (e.animationName === 'k-pop') el.classList.remove('k-pop'); });
  }
  // replay(el, classe): reinicia uma animação CSS de classe
  function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function setText(el, s) { if (el.__t !== s) { el.__t = s; el.textContent = s; } }

  /* ======================================================================
     2. Ícones
     ====================================================================== */
  /* conjunto embutido: 16x16 desenhado com Pix (contorno incluso). Cada entrada é fn(P, C); pode devolver fn(Q) com traços SEM contorno. */
  const ICON_DEFS = {
    yen(P, C) {
      P.ell(8, 8, 6.6, 6.6, C.gold).arc(8, 8, 5, 3.3, 4.9, 1, C.goldL).arc(8, 8, 5, 0.2, 1.9, 1, C.goldD);
      const k = '#7A5A14';
      P.set(6, 4, k).set(10, 4, k).set(6, 5, k).set(10, 5, k).set(7, 6, k).set(9, 6, k).rect(8, 7, 1, 5, k).rect(6, 8, 5, 1, k).rect(6, 10, 5, 1, k);
    },
    rice(P, C) {
      P.line(5.6, 11.4, 11.2, 5.2, 6.6, C.riceD).line(5.2, 11, 10.8, 4.8, 6, C.riceS).line(4.9, 10.5, 10.3, 4.5, 4.6, C.rice);
      P.line(5, 8, 8, 4, 1, C.white).set(3, 12, C.riceD).set(4, 13, C.riceD).set(4, 12, C.riceS);
    },
    sack(P, C) {
      P.rrect(2, 6, 12, 9, 3, C.sack).rect(6, 4, 4, 2, C.sackD).poly([[4, 1], [12, 1], [10, 4], [6, 4]], C.sack);
      P.rect(11, 8, 2, 6, C.sackD).rect(4, 13, 8, 1, C.sackD).rect(6, 5, 4, 1, C.red);
      P.ell(7.5, 10, 2.4, 2.4, C.red).set(7, 9, C.redL).rect(3, 8, 1, 3, C.cream);
    },
    gear(P, C) {
      const d = '#5A524A';
      P.rect(7, 1, 2, 14, C.steelD).rect(1, 7, 14, 2, C.steelD);
      P.line(3.5, 3.5, 12.5, 12.5, 2.4, C.steelD).line(12.5, 3.5, 3.5, 12.5, 2.4, C.steelD);
      P.ell(8, 8, 5, 5, C.steel).arc(8, 8, 3.6, 3.4, 5, 1, C.steelL).arc(8, 8, 3.8, 0.3, 1.8, 1, C.steelD).ell(8, 8, 2, 2, d);
    },
    sound(P, C) { speaker(P, C); return Q => Q.arc(6.5, 7.5, 4.5, -0.7, 0.7, 1, C.line).arc(6.5, 7.5, 7, -0.75, 0.75, 1, C.line); },
    mute(P, C) { speaker(P, C); return Q => Q.line(11, 6, 14.6, 9.6, 2, C.red).line(14.6, 6, 11, 9.6, 2, C.red); },
    music(P, C) {
      P.rect(6, 3, 1, 9, C.bowl).rect(12, 2, 1, 9, C.bowl).poly([[6, 2], [13, 1], [13, 4], [6, 5]], C.bowl);
      P.ell(4.5, 12, 2.4, 2, C.bowl).ell(10.5, 11, 2.4, 2, C.bowl).set(4, 11, C.bowlL).set(10, 10, C.bowlL);
    },
    tree(P, C) {
      P.rect(7, 10, 2, 5, C.wood).rect(8, 11, 1, 4, C.woodD).set(6, 14, C.wood).set(9, 14, C.woodD);
      P.ell(8, 6.3, 6, 5, C.grass).ell(5, 8, 3, 2.6, C.grass).ell(11, 8, 3, 2.6, C.grass);
      P.ell(6.3, 4.4, 2.6, 1.8, C.grassL).dither(8, 8, 6, 3, C.grassD, 'checker', { mask: true }).rect(4, 10, 8, 1, C.grassD);
      P.set(5, 6, C.sakura).set(10, 4, C.sakura).set(11, 7, C.sakura).set(7, 8, C.sakura);
    },
    trophy(P, C) {
      P.ring(3.6, 5, 2.6, 1.2, C.goldD).ring(12.4, 5, 2.6, 1.2, C.goldD);
      P.rect(4, 2, 8, 5, C.gold).ell(8, 6.5, 4, 3.4, C.gold).rect(7, 10, 2, 2, C.goldD).rect(5, 12, 6, 2, C.gold).rect(5, 13, 6, 1, C.goldD);
      P.rect(5, 3, 1, 4, C.goldL).rect(10, 3, 1, 5, C.goldD).rect(4, 2, 8, 1, C.goldL);
    },
    book(P, C) {
      P.rrect(2, 2, 12, 12, 1.5, C.red).rect(2, 2, 2, 12, C.redD).rect(12, 3, 1, 10, C.redD).rect(4, 12, 9, 1, C.cream);
      P.rect(6, 4, 5, 4, C.cream).ell(8.5, 6.6, 1.3, 1, C.redL).set(7, 5, C.redL).set(8, 4, C.redL).set(9, 5, C.redL);
    },
    lock(P, C) {
      P.arc(8, 6.2, 3, Math.PI, TAU, 2, C.steel).rect(4.5, 6, 2, 2, C.steel).rect(9.5, 6, 2, 2, C.steel);
      P.rrect(3, 7, 10, 7, 2, C.gold).rect(4, 8, 8, 1, C.goldL).rect(11, 9, 1, 4, C.goldD).rect(4, 12, 8, 1, C.goldD);
      P.ell(8, 10, 1.3, 1.3, C.line).rect(7.5, 10, 1, 2, C.line);
    },
    check(P, C) { P.line(3.5, 8.5, 6.5, 11.5, 3, C.grass).line(6.5, 11.5, 12.5, 4.5, 3, C.grass).line(3, 8, 6, 11, 1, C.grassL).line(7, 10, 12, 4, 1, C.grassL); },
    star(P, C) {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.1 : 7; pts.push([8 + Math.cos(a) * r, 8.6 + Math.sin(a) * r]); }
      P.poly(pts, C.gold).line(8, 3, 6, 7, 1, C.goldL).set(4, 7, C.goldL).line(10, 10, 11, 13, 1, C.goldD).set(9, 11, C.goldD);
    },
    clock(P, C) {
      P.ell(8, 8, 6.6, 6.6, C.red).ell(8, 8, 5, 5, C.cream).arc(8, 8, 4.4, 0.2, 1.9, 1, C.riceS);
      P.rect(8, 4, 1, 5, C.line).rect(8, 8, 3, 1, C.line).set(8, 3, C.redD);
    },
    paw(P, C) {
      const p = C.sakuraD, l = C.sakura;
      P.ell(8, 10.6, 3.8, 3.2, p).ell(3.4, 7.4, 1.7, 2, p).ell(6.3, 4, 1.7, 2.1, p).ell(9.9, 4, 1.7, 2.1, p).ell(12.7, 7.4, 1.7, 2, p);
      P.rect(6, 9, 3, 1, l).set(6, 3, l).set(9, 3, l).set(3, 6, l).set(12, 6, l);
    },
    chest(P, C) {
      P.rrect(2, 6, 12, 8, 1, C.wood).rrect(2, 3, 12, 5, 2.5, C.woodL).rect(2, 7, 12, 1, C.woodD).rect(2, 13, 12, 1, C.woodD);
      P.rect(4, 3, 1, 11, C.gold).rect(11, 3, 1, 11, C.gold).rect(7, 6, 2, 4, C.gold).set(7, 8, C.line).set(8, 8, C.line).rect(7, 6, 2, 1, C.goldL);
    },
    house(P, C) {
      P.rect(3, 8, 10, 6, C.cream).rect(11, 8, 2, 6, C.riceS).rect(7, 10, 2, 4, C.wood).rect(4, 10, 2, 2, C.glass).rect(10, 10, 2, 2, C.glass);
      P.poly([[8, 1], [15, 8], [1, 8]], C.bowl).line(8, 2, 3, 7, 1, C.bowlL).rect(2, 7, 12, 1, '#2F4670');
    },
    x(P, C) { P.line(4, 4, 12, 12, 3, C.red).line(12, 4, 4, 12, 3, C.red).line(4, 4, 6, 6, 1, C.redL).line(11, 4, 10, 5, 1, C.redL); },
    swap(P, C) {
      P.rect(3, 4, 8, 2, C.water).poly([[10, 1.5], [14.5, 5], [10, 8.5]], C.water);
      P.rect(5, 10, 8, 2, C.ora).poly([[6, 7.5], [1.5, 11], [6, 14.5]], C.ora);
    },
    horn(P, C) {
      P.poly([[2, 6], [6, 6], [11, 2], [11, 14], [6, 10], [2, 10]], C.yel).rect(2, 6, 4, 1, C.yelL).line(7, 5, 10, 3, 1, C.yelL).rect(6, 9, 5, 1, C.yelD).rect(10, 3, 1, 10, C.yelD);
      P.rect(3, 11, 2, 3, C.red);
      return Q => Q.set(13, 4, C.line).set(14, 3, C.line).set(13, 8, C.line).set(14, 8, C.line).set(13, 12, C.line).set(14, 13, C.line);
    },
    hat(P, C) {
      P.poly([[8, 3], [15, 11], [1, 11]], C.sack).rect(1, 11, 14, 2, C.sackD).line(8, 4, 4, 10, 1, C.cream).line(9, 5, 12, 10, 1, C.sackD).rect(7, 2, 2, 2, C.wood);
      P.rect(1, 11, 14, 1, C.sack).rect(5, 13, 1, 2, C.red).rect(10, 13, 1, 2, C.red);
    },
    bolt(P, C) { P.poly([[9, 1], [3, 9], [7, 9], [6, 15], [13, 6], [9, 6], [11, 1]], C.gold).line(9, 2, 5, 8, 1, C.goldL).line(8, 13, 11, 8, 1, C.goldD); },
  };
  function speaker(P, C) {
    P.rect(2, 6, 3, 4, C.steel).poly([[5, 6], [8, 3], [8, 13], [5, 10]], C.steelL).rect(7, 4, 1, 9, C.steelD).rect(2, 9, 3, 1, C.steelD).rect(2, 6, 3, 1, C.steelL);
  }
  /* sem pix.js: glifos de texto simples (nada de emoji) */
  const GLYPH = { yen: '¥', rice: '•', sack: '$', gear: '⚙', sound: '♪', mute: '×', music: '♫', tree: '♣', trophy: '★', book: '▤', lock: '▣',
    check: '✓', star: '★', clock: '◷', paw: '●', chest: '▣', house: '⌂', x: '×', swap: '⇄', horn: '◄', hat: '▲', bolt: 'ϟ' };
  const iconCache = Object.create(null);

  // srcIcon(icon) -> canvas-fonte | null: aceita nome embutido ou um canvas de sprite
  function srcIcon(icon) {
    if (!icon) return null;
    if (typeof icon !== 'string') return icon.getContext ? icon : null;
    if (iconCache[icon]) return iconCache[icon];
    const def = ICON_DEFS[icon];
    if (!def || !E.Pix || !E.PAL) return null;
    const P = E.Pix(16, 16), post = def(P, E.PAL), cv = P.canvas(true);
    if (typeof post === 'function') {                     // segundo passe sem contorno (traços finos: ondas de som)
      const Q = E.Pix(16, 16);
      post(Q, E.PAL);
      cv.getContext('2d').drawImage(Q.canvas(false), 0, 0);
    }
    return (iconCache[icon] = cv);
  }
  // silhouette(canvas) -> canvas chapado em marrom (névoa da árvore, cartas trancadas)
  const silCache = new WeakMap();
  function silhouette(src, col) {
    let s = silCache.get(src);
    if (!s) {
      s = doc.createElement('canvas'); s.width = src.width; s.height = src.height;
      const g = s.getContext('2d');
      g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col || '#1a110a'; g.fillRect(0, 0, s.width, s.height);
      silCache.set(src, s);
    }
    return s;
  }

  // E.UI.icon(spriteCanvas|nome, size=24) -> <canvas> nítido (pixels ampliados por fator inteiro; o navegador só reduz)
  function icon(src, size) {
    const s = srcIcon(src);
    if (!s) return null;
    size = size || 24;
    const sw = s.width, sh = s.height, m = Math.max(sw, sh);
    const k = Math.max(1, Math.min(Math.ceil(size * 3 / m), Math.floor(384 / m) || 1));
    const cv = doc.createElement('canvas');
    cv.width = sw * k; cv.height = sh * k; cv.className = 'k-ico' + (k === 1 ? ' k-ico-px' : '');
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(s, 0, 0, sw * k, sh * k);
    cv.style.width = Math.round(size * sw / m) + 'px';
    cv.style.height = Math.round(size * sh / m) + 'px';
    return cv;
  }
  // iconEl(icon, size) -> elemento: canvas/nome embutido vira ícone pixelado; outro texto vira glifo; nó DOM passa direto
  function iconEl(ic, size) {
    if (ic === undefined || ic === null || ic === '') return null;
    if (ic.nodeType && !ic.getContext) return ic;
    const c = icon(ic, size);
    if (c) return c;
    if (typeof ic !== 'string') return null;
    const s = h('span', 'k-ico k-ico-txt', null, GLYPH[ic] || ic);
    s.style.fontSize = Math.round((size || 24) * 0.82) + 'px';
    s.style.width = s.style.height = (size || 24) + 'px';
    return s;
  }
  // E.UI.defineIcon(nome, fn(P, PAL)): acrescenta/troca um ícone 16x16 do conjunto embutido
  function defineIcon(name, fn) { ICON_DEFS[name] = fn; delete iconCache[name]; }
  // E.UI.badge(el, n): bolinha vermelha com contador no canto (n=0/null tira; n=true vira só um ponto)
  function badge(el, n) {
    el = par(el);
    let b = el.__badge;
    if (!n) { if (b) { b.remove(); el.__badge = null; el.__badgeV = 0; } return; }
    if (el.__badgeV === n) return;
    if (b) b.remove();
    b = el.__badge = h('span', 'k-badge' + (n === true ? ' k-dot' : ''), el, n === true ? '' : String(n));
    el.__badgeV = n;
  }

  /* ======================================================================
     3. mount / zonas
     ====================================================================== */
  // E.UI.mount(stage, {parent?}) -> root: camada DOM por cima do canvas (é um <div>; ganha zone(), stage, layout())
  function mount(stage, o) {
    o = o || {};
    let root;
    if (stage && stage.layer) root = stage.layer('k-ui');
    else root = h('div', 'k-ui', o.parent || (stage && stage.el) || doc.body);
    root.style.width = ''; root.style.height = '';
    root.el = root; root.stage = stage || null; root.zones = {};
    // root.zone('tl'|'tc'|'tr'|'ml'|'mr'|'bl'|'bc'|'br'|'dock') -> div âncora (flex) naquela posição
    root.zone = name => root.zones[name] || (root.zones[name] = h('div', 'k-zone k-zone-' + name, root.hud));
    root.hud = h('div', 'k-layer k-l1', root);            // HUD fixo
    root.over = h('div', 'k-layer k-l2', root);           // painéis
    root.fx = h('div', 'k-layer k-l3', root);             // banners, toasts, conquistas
    root.top = h('div', 'k-layer k-l4', root);            // celebração, tooltip
    root.toasts = h('div', 'k-toasts', root.fx);
    root.achs = h('div', 'k-achs', root.fx);
    // root.layout(): reavalia retrato/paisagem e a área de toque extra (chamado sozinho no resize do stage)
    root.layout = () => {
      const w = stage ? stage.w : root.clientWidth, hh = stage ? stage.h : root.clientHeight;
      const s = stage ? stage.scale : 1;
      root.classList.toggle('k-portrait', hh > w);
      root.classList.toggle('k-narrow', w < 700);
      root.style.setProperty('--k-hitpad', U.clamp((44 / s - 44) / 2, 0, 12).toFixed(1) + 'px');
    };
    if (stage && stage.on) stage.on('resize', root.layout);
    root.layout();
    root.addEventListener('contextmenu', e => e.preventDefault());
    UI.root = root;
    return root;
  }
  // E.UI.spacer(pai): elemento elástico pra empurrar vizinhos numa zona flex (ex.: barra de baixo)
  function spacer(parent) { return h('div', 'k-spacer', par(parent)); }

  /* ======================================================================
     4. Pílula e número rolante
     ====================================================================== */
  // E.UI.roll(el, {fmt=U.fmt, speed=10, value=0}) -> {set(v, instant?), value, shown}: número que rola até o alvo
  function roll(el, o) {
    o = o || {};
    const fmt = o.fmt || U.fmt, speed = o.speed || 10;
    let cur = +o.value || 0, target = cur, active = false, lastTxt = null;
    function paint() { const s = fmt(cur); if (s !== lastTxt) { lastTxt = s; el.textContent = s; } }
    function step(dt) {
      const d = target - cur;
      if (Math.abs(d) <= Math.max(1e-3, Math.abs(target) * 2e-4)) { cur = target; paint(); active = false; return false; }
      cur += d * (1 - Math.exp(-speed * dt));
      paint();
    }
    paint();
    return {
      set(v, instant) {
        v = +v || 0;
        if (v === target && !instant) return;
        target = v;
        if (instant) { cur = v; paint(); return; }
        if (!active) { active = true; tick(step); }
      },
      get value() { return target; },
      get shown() { return cur; },
    };
  }

  // E.UI.pill(root, {id, icon, label, small, value, big, sm, tone:'gold', roll=true, fmt}) -> {el, set(v, instant?), bump(), gain(txt, crit?), small(txt), value}
  function pill(root, o) {
    o = o || {};
    const el = h('div', 'k-pill' + (o.big ? ' k-big' : '') + (o.sm ? ' k-sm' : '') + (o.tone ? ' k-' + o.tone : ''), par(root));
    if (o.id) el.id = o.id;
    const ic = iconEl(o.icon, o.big ? 30 : o.sm ? 16 : 22);
    if (ic) el.appendChild(ic);
    if (o.label) h('span', 'k-pre', el, o.label);
    const num = h('span', 'k-num', el);
    const sm = h('small', null, el, o.small || '');
    const r = o.roll === false ? null : roll(num, { fmt: o.fmt, value: +o.value || 0, speed: o.speed });
    if (!r) num.textContent = o.value === undefined ? '0' : o.value;
    el.addEventListener('animationend', e => { if (e.animationName === 'k-bump') el.classList.remove('k-bump'); });
    const api = {
      el,
      // set(v, instant?): número rola até v; texto entra direto
      set(v, instant) { if (r && typeof v === 'number') r.set(v, instant); else setText(num, String(v)); },
      // bump(): pulinho (dinheiro entrou)
      bump() { replay(el, 'k-bump'); },
      // gain(txt, crit?): "+¥120" subindo da pílula
      gain(txt, crit) {
        const g = h('span', 'k-gain' + (crit ? ' k-crit' : ''), el, txt);
        g.style.left = (45 + Math.random() * 35) + '%';
        g.addEventListener('animationend', () => g.remove());
      },
      // small(txt): troca o sufixo pequeno
      small(t) { setText(sm, t); },
      get value() { return r ? r.value : num.textContent; },
    };
    return api;
  }

  /* ======================================================================
     5. Barra e meta
     ====================================================================== */
  // E.UI.bar(root, {label, icon, endowed=0, tone, size:'sm'|'lg', w, fluid, ticks:[frac|{at,color}], near=.9, value}) -> {el, set(frac, label?, {left, value}?), tone(t), frac}
  function bar(root, o) {
    o = o || {};
    const el = h('div', 'k-bar' + (o.size ? ' k-' + o.size : '') + (o.fluid ? ' k-fluid' : '') + (o.tone ? ' k-tone-' + o.tone : ''), par(root));
    if (o.w) el.style.width = o.w + 'px';
    const lab = h('div', 'k-bar-lab', el);
    const nameWrap = h('span', null, lab);
    const ic = iconEl(o.icon, 16);
    if (ic) nameWrap.appendChild(ic);
    const name = h('span', null, nameWrap, o.label || '');
    const left = h('span', 'k-bar-left', lab);
    const track = h('div', 'k-bar-track', el);
    const fill = h('i', 'k-bar-fill', track);
    const val = h('span', 'k-bar-val', track, o.value || '');
    const endowed = o.endowed || 0, nearAt = o.near === undefined ? 0.9 : o.near;
    if (o.ticks) for (const t of o.ticks) {
      const at = typeof t === 'number' ? t : t.at;
      const k = h('span', 'k-bar-tick' + (t.color ? ' k-color' : ''), track);
      k.style.left = ((endowed + (1 - endowed) * at) * 100) + '%';
      if (t.color) k.style.background = t.color;
    }
    let lastQ = -1, lastState = 0, curTone = o.tone || '', frac = 0;
    const showLab = () => { lab.style.display = (name.textContent || left.textContent || ic) ? '' : 'none'; };
    const api = {
      el,
      // set(frac 0..1, label?, {left:'faltam ¥X', value:'×1,35'}?)
      set(f, label, extra) {
        f = U.clamp(+f || 0, 0, 1); frac = f;
        const q = Math.round((endowed + (1 - endowed) * f) * 1000);
        if (q !== lastQ) { lastQ = q; fill.style.width = q / 10 + '%'; }
        const st = f >= 1 ? 2 : f >= nearAt ? 1 : 0;
        if (st !== lastState) { lastState = st; el.classList.toggle('k-near', st === 1); el.classList.toggle('k-full', st === 2); }
        let ch = false;
        if (label !== undefined && label !== null && name.__t !== label) { setText(name, label); ch = true; }
        if (extra) {
          if (extra.left !== undefined && left.__t !== extra.left) { setText(left, extra.left); ch = true; }
          if (extra.value !== undefined) setText(val, extra.value);
        }
        if (ch) showLab();
      },
      // tone('gold'|'green'|'red'|'blue'|'sack'|'pink'|'fury'|''): troca a cor do preenchimento
      tone(t) { if (t === curTone) return; if (curTone) el.classList.remove('k-tone-' + curTone); if (t) el.classList.add('k-tone-' + t); curTone = t; },
      get frac() { return frac; },
    };
    showLab();
    api.set(o.frac || 0);
    return api;
  }

  // E.UI.goal(root, {label, icon, endowed=.12, unit='¥', pct=false, ...bar}) -> {el, bar, set(tem, precisa, taxaPorSeg?)}: barra de meta com "faltam X · ≈ 40s"
  function goal(root, o) {
    o = Object.assign({ endowed: 0.12 }, o);
    const b = bar(root, o), unit = o.unit === undefined ? '¥' : o.unit;
    let lastT = -1e9, lastDone = false;
    return {
      el: b.el, bar: b,
      set(have, needV, rate) {
        const f = needV > 0 ? U.clamp(have / needV, 0, 1) : 1, done = f >= 1;
        const now = performance.now();
        if (now - lastT < 200 && done === lastDone) { b.set(f); return; }      // texto a 5 Hz, largura todo frame
        lastT = now; lastDone = done;
        let s;
        if (done) s = o.done || 'pronto!';
        else if (o.pct) s = 'faltam ' + U.pct(1 - f, 1);
        else {
          s = 'faltam ' + unit + U.fmt(Math.ceil(needV - have));
          if (rate > 0) s += ' · ≈ ' + U.fmtTime(Math.ceil((needV - have) / rate));
        }
        b.set(f, undefined, { left: s });
      },
    };
  }
  // E.UI.goals(root) -> {el, add(opts) -> goal}: coluna de barras de meta sempre visíveis
  function goals(root) {
    const el = h('div', 'k-goals', par(root));
    return { el, add: o => goal(el, o) };
  }

  /* ======================================================================
     6. Botão
     ====================================================================== */
  // E.UI.button(root, {icon (canvas|nome|texto), iconSize, title, sub, onClick, progress, badge, state, tone:'primary'|'green'|'red'|'dark',
  //   size:'sm'|'lg', accent (cor da faixa lateral), vertical, center, w, sound='click'}) -> {el, set({title,sub,progress,state:'can'|'off'|'',badge,icon,left}), pop()}
  const ICON_NAMES = { gear: 'Ajustes', close: 'Fechar', mute: 'Som', tree: 'Árvore', house: 'Casa', horn: 'Buzina' };
  function button(root, o) {
    o = o || {};
    const el = h('button', 'k-btn' + (o.size ? ' k-' + o.size : '') + (o.tone ? ' k-' + o.tone : '') + (o.vertical ? ' k-vert' : '') +
      (o.center ? ' k-center' : '') + (o.cls ? ' ' + o.cls : ''), par(root));
    el.type = 'button';
    { const lab = o.label || o.title || (o.icon && ICON_NAMES[o.icon]) || o.icon; if (lab) el.setAttribute('aria-label', String(lab)); }
    if (o.w) el.style.width = o.w + 'px';
    if (o.accent) { el.classList.add('k-accent'); el.style.setProperty('--k-accent', o.accent); }
    const icoSize = o.iconSize || (o.size === 'sm' ? 20 : 32);
    const icoBox = h('span', 'k-btn-ico', el);
    const txt = h('span', 'k-btn-t', el);
    const title = h('span', null, txt), sub = h('small', null, txt), left = h('span', 'k-btn-left', txt);
    let bp = null, bpFill = null, lastQ = -1, state = '', curIcon;
    function setIcon(ic) {
      if (ic === curIcon) return;
      curIcon = ic;
      icoBox.textContent = '';
      const e = iconEl(ic, icoSize);
      if (e) icoBox.appendChild(e);
      icoBox.style.display = e ? '' : 'none';
    }
    const api = {
      el,
      set(s) {
        if (s.title !== undefined) setText(title, s.title);
        if (s.sub !== undefined) setText(sub, s.sub);
        if (s.left !== undefined) setText(left, s.left);
        if (s.icon !== undefined) setIcon(s.icon);
        if (s.progress !== undefined && s.progress !== null) {
          if (!bp) { bp = h('span', 'k-btn-bp', el); bpFill = h('i', null, bp); el.classList.add('k-has-bp'); }
          const q = Math.round(U.clamp(s.progress, 0, 1) * 1000);
          if (q !== lastQ) { lastQ = q; bpFill.style.width = q / 10 + '%'; }
        }
        if (s.state !== undefined && s.state !== state) {
          if (state) el.classList.remove('k-' + state);
          state = s.state || '';
          if (state) el.classList.add('k-' + state);
        }
        if (s.badge !== undefined) badge(el, s.badge);
        return api;
      },
      // pop(): pulinho de confirmação (compra feita)
      pop() { replay(el, 'k-pop'); },
      get state() { return state; },
    };
    setIcon(o.icon);
    if (!o.title && !o.sub) { txt.style.display = 'none'; if (!o.vertical) el.classList.add('k-icon'); }
    api.set({ title: o.title || '', sub: o.sub || '', progress: o.progress, state: o.state, badge: o.badge });
    pressable(el, true);
    el.addEventListener('click', e => {
      if (state === 'off') { sfx('error'); replay(el, 'k-nope'); if (o.onOff) o.onOff(api, e); return; }
      if (o.sound !== 'none') sfx(o.sound || 'click');
      if (o.onClick) o.onClick(api, e);
    });
    return api;
  }
  // E.UI.flyer(root, {art (canvas|nó), title, sub, onClick}) -> botão vertical tipo panfleto (casa: arte em cima, preço e barra embaixo)
  function flyer(root, o) {
    o = Object.assign({ vertical: true, cls: 'k-flyer', iconSize: 44 }, o);
    o.icon = o.art || o.icon;
    return button(root, o);
  }

  /* ======================================================================
     7. Painel, abas, diálogo, confirmar
     ====================================================================== */
  const openPanels = [];
  doc.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !openPanels.length) return;
    const p = openPanels[openPanels.length - 1];
    if (p.dismiss) p.close();
  });

  // E.UI.tabs(pai, {tabs:[{id,label,icon,badge}], value, onChange(id)}) -> {el, panes, set(id), pane(id) -> div, badge(id,n), value}
  function tabs(parent, o) {
    parent = par(parent);
    const el = h('div', 'k-tabs', parent), panes = h('div', 'k-panes', parent);
    const btn = {}, pane = {};
    let value = null;
    const api = {
      el, panes,
      set(id, silent) {
        if (id === value || !btn[id]) return;
        if (value !== null) { btn[value].classList.remove('k-sel'); pane[value].classList.remove('k-sel'); }
        value = id;
        btn[id].classList.add('k-sel'); pane[id].classList.add('k-sel');
        if (!silent && o.onChange) o.onChange(id);
      },
      pane: id => pane[id],
      badge(id, n) { if (btn[id]) badge(btn[id], n); },
      get value() { return value; },
    };
    for (const t of o.tabs) {
      const b = btn[t.id] = h('button', 'k-tab', el);
      b.type = 'button';
      const ic = iconEl(t.icon, 18);
      if (ic) b.appendChild(ic);
      h('span', null, b, t.label);
      if (t.badge) badge(b, t.badge);
      pane[t.id] = h('div', 'k-pane', panes);
      b.addEventListener('click', () => { sfx('click'); api.set(t.id); });
    }
    api.set(o.value || o.tabs[0].id, true);
    return api;
  }

  // E.UI.panel({title, icon, wide, full, bare, side:'right'|'left'|'bottom', tabs:[...], dim=true, dismiss=true, onClose, onOpen, cls})
  //   -> {el, body, head, tabs, open(), close(), toggle(), isOpen, setTitle(t), destroy()}
  function panel(o) {
    o = o || {};
    const root = need();
    const dim = h('div', 'k-dim' + (o.side ? ' k-side-' + o.side : '') + (o.dim === false ? ' k-nodim' : '') + (o.bare ? ' k-deep' : ''), root.over);
    const el = h('div', 'k-panel' + (o.wide ? ' k-wide' : '') + (o.full || o.bare ? ' k-full' : '') + (o.bare ? ' k-bare' : '') + (o.cls ? ' ' + o.cls : ''), dim);
    let head = null, titleEl = null;
    const dismiss = o.dismiss !== false;
    if (o.title !== undefined || dismiss) {
      head = h('div', 'k-panel-head', el);
      const h2 = h('h2', null, head);
      const ic = iconEl(o.icon, 26);
      if (ic) h2.appendChild(ic);
      titleEl = h('span', null, h2, o.title || '');
      if (dismiss) {
        const x = h('button', 'k-x', head); x.type = 'button'; x.setAttribute('aria-label', 'fechar'); h('i', null, x);
        pressable(x);
        x.addEventListener('click', () => { sfx('click'); api.close(); });
      }
    }
    const body = h('div', 'k-panel-body', el);
    let timer = 0;
    const api = {
      el, body, head, dim, isOpen: false, dismiss, tabs: null,
      open() {
        if (api.isOpen) return api;
        clearTimeout(timer);
        api.isOpen = true; openPanels.push(api);
        dim.classList.add('k-show'); void dim.offsetWidth; dim.classList.add('k-on');
        sfx('whoosh', { vol: 0.5 });
        if (o.onOpen) o.onOpen(api);
        return api;
      },
      close() {
        if (!api.isOpen) return api;
        api.isOpen = false;
        const i = openPanels.indexOf(api); if (i >= 0) openPanels.splice(i, 1);
        dim.classList.remove('k-on');
        timer = setTimeout(() => dim.classList.remove('k-show'), 300);
        if (o.onClose) o.onClose(api);
        return api;
      },
      toggle() { return api.isOpen ? api.close() : api.open(); },
      setTitle(t) { if (titleEl) setText(titleEl, t); },
      destroy() { api.close(); clearTimeout(timer); dim.remove(); },
    };
    if (dismiss) dim.addEventListener('pointerdown', e => { if (e.target === dim) api.close(); });
    if (o.tabs) api.tabs = tabs(body, { tabs: o.tabs, value: o.tab, onChange: o.onTab });
    return api;
  }

  // E.UI.dialog({kicker, title, text, art (canvas|nó), big:{label, value, prefix, icon}, rows:[{icon,label,value}],
  //   buttons:[{title, sub, icon, tone, onClick, keep}], dismiss=false, onClose}) -> painel (já aberto) + {big: roll}
  //   cartão modal genérico: boas-vindas, "bom ponto pra parar", placar final. Botões sempre do mesmo tamanho.
  function dialog(o) {
    o = o || {};
    const p = panel({ dismiss: !!o.dismiss, cls: 'k-dialog', onClose: o.onClose });
    const b = p.el;
    b.removeChild(p.body);
    if (o.art) { const a = h('div', 'k-dialog-art', b); a.appendChild(o.art.nodeType && !o.art.getContext ? o.art : iconEl(o.art, o.artSize || 64)); }
    if (o.kicker) h('div', 'k-kicker', b, o.kicker);
    if (o.title) h('h2', null, b, o.title);
    if (o.text) h('p', null, b, o.text);
    if (o.big) {
      const box = h('div', 'k-dialog-big', b);
      h('small', null, box, o.big.label || '');
      const line = h('b', null, box);
      const ic = iconEl(o.big.icon, 28);
      if (ic) line.appendChild(ic);
      if (o.big.prefix) h('span', null, line, o.big.prefix);
      const n = h('span', null, line);
      p.big = roll(n, { speed: 3.2, fmt: o.big.fmt });
      if (typeof o.big.value === 'number') setTimeout(() => p.big.set(o.big.value), 350); else n.textContent = o.big.value;
    }
    if (o.rows && o.rows.length) {
      const rows = h('div', 'k-dialog-rows', b);
      for (const r of o.rows) stat(rows, r);
    }
    b.appendChild(p.body);
    p.body.style.display = 'none';                        // corpo extra opcional: p.body.style.display = '' pra usar
    const btns = h('div', 'k-dialog-btns', b);
    for (const bt of (o.buttons || [{ title: 'OK', tone: 'primary' }])) {
      button(btns, Object.assign({ center: true }, bt, { onClick(api, e) { if (!bt.keep) p.close(); if (bt.onClick) bt.onClick(api, e); } }));
    }
    p.destroyOnClose = true;
    const close0 = p.close;
    p.close = () => { close0(); setTimeout(() => p.dim.remove(), 320); return p; };
    return p.open();
  }
  // E.UI.confirm(texto, onYes, {title, yes='Sim', no='Agora não', onNo, danger}) -> diálogo com dois botões iguais
  function confirm(text, onYes, o) {
    o = o || {};
    return dialog({
      title: o.title || 'Tem certeza?', text, dismiss: true,
      buttons: [{ title: o.no || 'Agora não', onClick: o.onNo }, { title: o.yes || 'Sim', tone: o.danger ? 'red' : 'primary', onClick: onYes }],
    });
  }
  // E.UI.stat(pai, {icon, label, value}) -> {el, set(v)}: linha "rótulo ........ valor" (placar, recordes)
  function stat(parent, o) {
    const el = h('div', 'k-stat', par(parent));
    const l = h('span', null, el);
    const ic = iconEl(o.icon, 18);
    if (ic) l.appendChild(ic);
    h('span', null, l, o.label);
    const v = h('b', null, el, o.value === undefined ? '' : o.value);
    return { el, set(x) { setText(v, String(x)); } };
  }

  /* ======================================================================
     8. Banner, toast, conquista, celebração, tooltip
     ====================================================================== */
  const banQ = [];
  let banBusy = false;
  function banNext() {
    if (banBusy || !banQ.length) return;
    banBusy = true;
    const b = banQ.shift(), root = need();
    const el = h('div', 'k-banner' + (b.level >= 3 ? ' k-ribbon' : '') + (b.tone ? ' k-' + b.tone : ''), root.fx);
    const ic = iconEl(b.icon, b.level >= 3 ? 46 : 34);
    if (ic) el.appendChild(ic);
    const t = h('div', 'k-ban-t', el);
    h('div', null, t, b.text);
    if (b.sub) h('small', null, t, b.sub);
    void el.offsetWidth; el.classList.add('k-in');
    sfx(b.sound || (b.level >= 3 ? 'fanfare' : 'chime'));
    setTimeout(() => {
      el.classList.remove('k-in'); el.classList.add('k-out');
      setTimeout(() => { el.remove(); if (b.onDone) b.onDone(); setTimeout(() => { banBusy = false; banNext(); }, 300); }, 320);
    }, b.dur * 1000);
  }
  // E.UI.banner(texto, sub, {dur, level=2 (1 = toast, 2 = desce do topo, 3 = faixa de lado a lado), icon, tone:'gold', sound, onDone})
  //   fila: um por vez, 0,3 s entre eles; nunca bloqueia o toque
  function banner(text, sub, o) {
    o = o || {};
    const level = o.level || 2;
    if (level <= 1) return toast(text, { icon: o.icon, sub, dur: o.dur || 1.4 });
    banQ.push({ text, sub, level, icon: o.icon, tone: o.tone, sound: o.sound, onDone: o.onDone, dur: o.dur || (level >= 3 ? 2.5 : 1.5) });
    banNext();
  }

  const toastQ = [];
  let toastN = 0;
  function toastNext() {
    while (toastN < 3 && toastQ.length) {
      const t = toastQ.shift(), root = need();
      const el = h('div', 'k-toast' + (t.tone ? ' k-' + t.tone : ''), root.toasts);
      const ic = iconEl(t.icon, 22);
      if (ic) el.appendChild(ic);
      h('span', null, el, t.text);
      if (t.sub) h('small', null, el, t.sub);
      toastN++;
      setTimeout(() => {
        el.classList.add('k-out');
        setTimeout(() => { el.remove(); toastN--; toastNext(); }, 230);
      }, t.dur * 1000);
    }
  }
  // E.UI.toast(texto, {icon, sub, dur=2.2, tone:'light'|'gold'|'bad'}): fila de avisos curtos (3 visíveis, acima da barra de baixo)
  function toast(text, o) {
    o = o || {};
    toastQ.push({ text, icon: o.icon, sub: o.sub, tone: o.tone, dur: o.dur || 2.2 });
    toastNext();
  }

  const achQ = [];
  let achN = 0;
  function achNext() {
    while (achN < 2 && achQ.length) {
      const a = achQ.shift(), root = need();
      const el = h('div', 'k-ach', root.achs);
      const seal = h('div', 'k-ach-seal', el);
      const ic = iconEl(a.icon || 'paw', 28);
      if (ic) seal.appendChild(ic);
      const t = h('div', 'k-ach-t', el);
      h('small', null, t, a.kicker || 'Conquista!');
      h('b', null, t, a.title);
      if (a.sub) h('i', null, t, a.sub);
      achN++;
      setTimeout(() => sfx('bell'), 480);                // o "chirin" bate junto com o carimbo
      setTimeout(() => {
        el.classList.add('k-out');
        setTimeout(() => { el.remove(); achN--; achNext(); }, 300);
      }, (a.dur || 3.4) * 1000);
    }
  }
  // E.UI.achievement(título, {sub, icon='paw', kicker='Conquista!', dur=3.4}): cartão que entra pela direita com o selo carimbando (0,6 s)
  function achievement(title, o) {
    o = o || {};
    achQ.push({ title, sub: o.sub, icon: o.icon, kicker: o.kicker, dur: o.dur });
    achNext();
  }

  // E.UI.celebrate({title, sub, kicker, icon, iconSize=72, seal='novo!', dur=2.6, block=false, hint, onDone}) -> {el, close()}
  //   cartão de título carimbado com raios girando (o confete é do canvas: ScreenFX.confetti). block=true espera o toque.
  function celebrate(o) {
    if (typeof o === 'string') o = { title: o, sub: arguments[1] };
    const root = need();
    const el = h('div', 'k-celebrate' + (o.block ? ' k-block' : ''), root.top);
    h('div', 'k-rays', el);
    const card = h('div', 'k-cel-card', el);
    const ic = iconEl(o.icon, o.iconSize || 64);
    if (ic) h('div', 'k-cel-icon', card).appendChild(ic);
    if (o.kicker) h('div', 'k-cel-kicker', card, o.kicker);
    const title = h('div', 'k-cel-title', card);
    let n = 0;
    for (const word of String(o.title || '').split(' ')) {         // letra a letra, sem quebrar no meio da palavra
      const w = h('span', null, title); w.style.whiteSpace = 'nowrap'; w.style.animation = 'none';
      for (const ch of word) { const s = h('span', null, w, ch); s.style.animationDelay = (0.22 + n++ * 0.028) + 's'; }
      title.appendChild(doc.createTextNode(' '));
    }
    if (o.sub) h('div', 'k-cel-sub', card, o.sub);
    if (o.seal !== false) {
      const seal = h('div', 'k-cel-seal', card);
      const pi = iconEl('paw', 26);
      if (pi) seal.appendChild(pi);
      h('span', null, seal, o.seal || 'novo!');
    }
    if (o.block) h('div', 'k-cel-hint', el, o.hint || 'toque pra continuar');
    sfx('taiko');
    let closed = false, timer = 0;
    const api = {
      el,
      close() {
        if (closed) return;
        closed = true; clearTimeout(timer);
        el.classList.add('k-out');
        setTimeout(() => { el.remove(); if (o.onDone) o.onDone(); }, 300);
      },
    };
    if (o.block) el.addEventListener('click', api.close);
    else timer = setTimeout(api.close, (o.dur || 2.6) * 1000);
    return api;
  }

  // E.UI.tooltip(el, htmlFn|texto, {hold=2.4}): dica; mouse = ao passar, toque = ao encostar (some sozinha), não bloqueia o clique
  function tooltip(el, htmlFn, o) {
    el = par(el); o = o || {};
    const root = need();
    let tip = root.__tip, timer = 0;
    if (!tip) tip = root.__tip = h('div', 'k-tip', root.top);
    function show() {
      const html = typeof htmlFn === 'function' ? htmlFn(el) : htmlFn;
      if (!html) return;
      tip.innerHTML = html;
      tip.__owner = el;
      const rr = root.getBoundingClientRect(), r = el.getBoundingClientRect(), s = rr.width / root.offsetWidth || 1;
      const cx = (r.left + r.width / 2 - rr.left) / s, top = (r.top - rr.top) / s, bot = (r.bottom - rr.top) / s;
      const tw = tip.offsetWidth, th = tip.offsetHeight, W = root.offsetWidth;
      const x = U.clamp(cx - tw / 2, 6, W - tw - 6), below = top - th - 10 < 4;
      tip.style.left = x + 'px';
      tip.style.top = (below ? bot + 10 : top - th - 10) + 'px';
      tip.style.setProperty('--k-tip-x', U.clamp(cx - x, 12, tw - 12) + 'px');
      tip.classList.toggle('k-below', below);
      tip.classList.add('k-on');
    }
    function hide() { clearTimeout(timer); if (tip.__owner === el) tip.classList.remove('k-on'); }
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(); });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      show(); clearTimeout(timer);
      timer = setTimeout(hide, (o.hold || 2.4) * 1000);
    });
    return { show, hide };
  }

  /* ======================================================================
     9. Missões
     ====================================================================== */
  // E.UI.missions(root, {slots=3, title='Missões', collapsed=false, onClaim(i), onTap(i)}) -> {el, set(i, {icon, text, frac, count, done, empty}), collapse(bool), collapsed}
  //   chips com mini barra; missão pronta vira baú balançando pra tocar; a setinha recolhe em ícones
  function missions(root, o) {
    o = o || {};
    const el = h('div', 'k-missions', par(root));
    const head = h('div', 'k-missions-head', el);
    h('i', null, head); h('span', null, head, o.title === undefined ? 'Missões' : o.title);
    const listEl = h('div', 'k-missions-list', el);
    const slots = [];
    const api = {
      el, collapsed: false,
      set(i, s) {
        const m = slots[i];
        if (!m) return;
        const done = !!s.done, empty = !!s.empty;
        if (done !== m.done) {
          m.done = done; m.el.classList.toggle('k-done', done);
          m.icon = null;
          if (done) { sfx('thud', { vol: 0.5 }); replay(m.el, 'k-new'); }
        }
        if (empty !== m.empty) { m.empty = empty; m.el.classList.toggle('k-empty', empty); }
        const ic = done ? 'chest' : empty ? 'clock' : s.icon;
        if (ic !== m.icon) {
          m.icon = ic;
          if (m.ico) m.ico.remove();
          m.ico = iconEl(ic, 18);
          if (m.ico) m.el.insertBefore(m.ico, m.el.firstChild);
        }
        const text = done ? (s.doneText || 'Abrir o baú!') : s.text;
        if (text !== undefined && text !== m.text) {
          if (m.text !== undefined && !done && !empty) replay(m.el, 'k-new');
          m.text = text; m.t.textContent = text;
        }
        setText(m.n, done || empty ? '' : (s.count || ''));
        const q = Math.round(U.clamp(s.frac || 0, 0, 1) * 100);
        if (q !== m.q) { m.q = q; m.fill.style.width = q + '%'; }
      },
      collapse(b) { api.collapsed = !!b; el.classList.toggle('k-collapsed', api.collapsed); },
    };
    for (let i = 0; i < (o.slots || 3); i++) {
      const m = { el: h('div', 'k-mis k-empty', listEl), done: false, empty: true, q: -1 };
      m.t = h('span', 'k-mis-t', m.el); m.n = h('span', 'k-mis-n', m.el);
      m.fill = h('i', null, h('span', 'k-mis-bar', m.el));
      m.el.addEventListener('click', () => {
        if (m.done) { sfx('unlock'); if (o.onClaim) o.onClaim(i); } else if (o.onTap) o.onTap(i);
      });
      slots.push(m);
    }
    head.addEventListener('click', () => { sfx('click'); api.collapse(!api.collapsed); });
    if (o.collapsed) api.collapse(true);
    return api;
  }

  /* ======================================================================
     10. Álbum
     ====================================================================== */
  // E.UI.album(pai, {items:[{id, name, icon, q (pergunta), a (resposta), unlocked, isNew}], cols=4, iconSize=36, onOpen(item)})
  //   -> {el, unlock(id), set(id, patch), count() -> {have, total}}: cartas que começam silhueta + pergunta e viram a resposta
  function album(parent, o) {
    const el = h('div', 'k-album', par(parent));
    if (o.cols) el.style.setProperty('--k-cols', o.cols);
    const cards = {};
    function fill(c) {
      const it = c.item;
      c.el.classList.toggle('k-locked', !it.unlocked);
      c.name.textContent = it.unlocked ? it.name : (it.hint || '???');
      c.text.textContent = it.unlocked ? (it.a || it.desc || '') : (it.q || '');
      c.text.style.display = c.text.textContent ? '' : 'none';
      c.lock.style.display = it.unlocked ? 'none' : '';
      if (c.neu) { c.neu.remove(); c.neu = null; }
      if (it.unlocked && it.isNew) c.neu = h('span', 'k-new', c.el, 'novo!');
    }
    for (const it of o.items) {
      const c = cards[it.id] = { item: it, el: h('div', 'k-card', el) };
      const art = h('div', 'k-card-art', c.el);
      const ic = iconEl(it.icon || 'star', o.iconSize || 36);
      if (ic) art.appendChild(ic);
      c.name = h('b', null, c.el); c.text = h('span', null, c.el);
      c.lock = h('span', 'k-card-lock', c.el);
      const li = iconEl('lock', 14);
      if (li) c.lock.appendChild(li);
      fill(c);
      c.el.addEventListener('click', () => {
        if (!it.unlocked) { sfx('error', { vol: 0.5 }); replay(c.el, 'k-nope'); return; }
        if (it.isNew) { it.isNew = false; fill(c); }
        sfx('click');
        if (o.onOpen) o.onOpen(it);
      });
    }
    const api = {
      el,
      // unlock(id): vira a carta (pergunta -> resposta)
      unlock(id) {
        const c = cards[id];
        if (!c || c.item.unlocked) return;
        c.item.unlocked = true; c.item.isNew = true;
        replay(c.el, 'k-flip'); sfx('unlock');
        setTimeout(() => fill(c), 290);
      },
      set(id, patch) { const c = cards[id]; if (c) { Object.assign(c.item, patch); fill(c); } },
      count() { let have = 0; for (const it of o.items) if (it.unlocked) have++; return { have, total: o.items.length }; },
    };
    return api;
  }

  /* ======================================================================
     11. Ajustes: linha, toggle, slider
     ====================================================================== */
  // E.UI.row(pai, {icon, label, sub}) -> {el, ctl}: linha de ajustes; pendure o controle em .ctl
  function row(parent, o) {
    const el = h('div', 'k-setrow', par(parent));
    const ic = iconEl(o.icon, 24);
    if (ic) el.appendChild(ic);
    const t = h('div', 'k-setrow-t', el);
    h('span', null, t, o.label || '');
    if (o.sub) h('small', null, t, o.sub);
    return { el, ctl: h('div', 'k-setrow-c', el) };
  }
  // E.UI.toggle(pai, {icon, iconOff, label, sub, value=false, onChange(v)}) -> {el, value, set(v, silent?)}; sem label devolve só a chave
  function toggle(parent, o) {
    o = o || {};
    const r = o.label ? row(parent, o) : null;
    const el = h('button', 'k-toggle', r ? r.ctl : par(parent));
    el.type = 'button'; el.setAttribute('role', 'switch'); if (o.label) el.setAttribute('aria-label', o.label);
    h('i', null, el);
    let value = false;
    const api = {
      el: r ? r.el : el, ctl: el,
      set(v, silent) {
        v = !!v;
        el.classList.toggle('k-on', v); el.setAttribute('aria-checked', v);
        if (v === value) return;
        value = v;
        if (!silent && o.onChange) o.onChange(v);
      },
      get value() { return value; },
    };
    el.addEventListener('click', () => { api.set(!value); sfx('click', { pitch: value ? 1.2 : 0.85 }); });
    api.set(!!o.value, true);
    return api;
  }
  // E.UI.slider(pai, {icon, label, sub, min=0, max=1, step=0, value, w, fmt(v)->texto, onChange(v), onEnd(v)}) -> {el, value, set(v, silent?)}
  function slider(parent, o) {
    o = o || {};
    const r = o.label ? row(parent, o) : null, host = r ? r.ctl : par(parent);
    const el = h('div', 'k-slider', host);
    if (o.w) el.style.width = o.w + 'px';
    const fill = h('i', null, h('div', 'k-slider-track', el)), knob = h('div', 'k-slider-knob', el);
    const out = o.fmt === false ? null : h('span', 'k-slider-val', host);
    const min = o.min || 0, max = o.max === undefined ? 1 : o.max, step = o.step || 0;
    const fmt = o.fmt || (v => Math.round((v - min) / (max - min) * 100) + '%');
    let value = min;
    const api = {
      el: r ? r.el : el, ctl: el,
      set(v, silent) {
        v = U.clamp(+v || 0, min, max);
        if (step) v = min + Math.round((v - min) / step) * step;
        const f = (v - min) / (max - min || 1);
        fill.style.width = (f * 100) + '%';
        knob.style.left = 'calc(13px + ' + f + ' * (100% - 26px))';
        if (out) setText(out, fmt(v));
        if (v === value) return;
        value = v;
        if (!silent && o.onChange) o.onChange(v);
      },
      get value() { return value; },
    };
    function at(e) {
      const rc = el.getBoundingClientRect(), s = rc.width / el.offsetWidth || 1;
      const f = U.clamp(((e.clientX - rc.left) / s - 13) / (el.offsetWidth - 26), 0, 1);
      const before = value;
      api.set(min + f * (max - min));
      if (step && value !== before) sfx('click', { vol: 0.4 });
    }
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); el.classList.add('k-drag'); at(e); e.preventDefault(); });
    el.addEventListener('pointermove', e => { if (el.classList.contains('k-drag')) at(e); });
    const end = () => { if (!el.classList.contains('k-drag')) return; el.classList.remove('k-drag'); if (o.onEnd) o.onEnd(value); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    value = NaN; api.set(o.value === undefined ? min : o.value, true);
    return api;
  }

  /* ======================================================================
     12. Sparkline, taxa, medidor radial
     ====================================================================== */
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, cls, parent) { const e = doc.createElementNS(SVGNS, tag); if (cls) e.setAttribute('class', cls); if (parent) parent.appendChild(e); return e; }

  // E.UI.sparkline(pai, {w=64, h=14, max=60 (amostras), color, fill, size:'lg'}) -> {el, push(v), set(arr), last}
  function sparkline(parent, o) {
    o = o || {};
    const w = o.w || 64, hh = o.h || 14, cap = o.max || 60;
    const el = svg('svg', 'k-spark' + (o.size ? ' k-' + o.size : ''), par(parent));
    el.setAttribute('viewBox', '0 0 ' + w + ' ' + hh); el.setAttribute('width', w); el.setAttribute('height', hh);
    const area = svg('path', 'k-spark-area', el), line = svg('path', 'k-spark-line', el), dot = svg('circle', 'k-spark-dot', el);
    dot.setAttribute('r', o.size === 'lg' ? 3.5 : 2.5);
    if (o.color) line.style.stroke = o.color;
    if (o.fill) area.style.fill = o.fill;
    const data = [];
    function draw() {
      const n = data.length;
      if (!n) { line.setAttribute('d', ''); area.setAttribute('d', ''); dot.style.display = 'none'; return; }
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < n; i++) { if (data[i] < lo) lo = data[i]; if (data[i] > hi) hi = data[i]; }
      if (o.zero !== false) lo = Math.min(lo, 0);
      const span = hi - lo || 1, pad = 2.5;
      let d = '', x = 0, y = 0;
      for (let i = 0; i < n; i++) {
        x = n === 1 ? w - pad : pad + (i / (n - 1)) * (w - pad * 2);
        y = hh - pad - ((data[i] - lo) / span) * (hh - pad * 2);
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      line.setAttribute('d', d);
      area.setAttribute('d', d + 'L' + x.toFixed(1) + ' ' + hh + 'L' + pad + ' ' + hh + 'Z');
      dot.style.display = ''; dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1));
    }
    const api = {
      el,
      push(v) { data.push(+v || 0); if (data.length > cap) data.shift(); draw(); },
      set(arr) { data.length = 0; for (let i = Math.max(0, arr.length - cap); i < arr.length; i++) data.push(+arr[i] || 0); draw(); },
      get last() { return data.length ? data[data.length - 1] : 0; },
      data,
    };
    if (o.data) api.set(o.data); else draw();
    return api;
  }

  // E.UI.rate(root, {label='¥/s', icon, lines:[texto|fn()->texto], every=8, w=64, max=60}) -> {el, set(v), push(v), lines(arr), spark}
  //   pílula pequena com sparkline + linha de competência que alterna ("+40% vs 5 min atrás", "recorde: ¥81k/s")
  function rate(root, o) {
    o = o || {};
    const el = h('div', 'k-rate', par(root));
    const p = pill(el, { sm: true, icon: o.icon, label: o.label === undefined ? '¥/s' : o.label, fmt: o.fmt });
    const sp = sparkline(p.el, { w: o.w || 64, h: 14, max: o.max || 60 });
    const lineEl = h('div', 'k-rate-line', el);
    let lines = o.lines || [], idx = 0, timer = 0;
    function show() {
      if (!lines.length) { lineEl.textContent = ''; return; }
      const l = lines[idx % lines.length], s = typeof l === 'function' ? l() : l;
      idx++;
      if (!s) return;
      lineEl.textContent = s; replay(lineEl, 'k-swap');
    }
    timer = setInterval(() => { if (el.isConnected) show(); else clearInterval(timer); }, (o.every || 8) * 1000);
    show();
    return { el, pill: p, spark: sp, set: v => p.set(v), push: v => sp.push(v), lines(a) { lines = a || []; idx = 0; show(); }, next: show };
  }

  // E.UI.gauge(pai, {size=72, label, sweep=270 (graus), zones:[[de,ate]] (0..1, faixa verde), needle=false, over=false (texto branco, pra cima do canvas), tone (cor)})
  //   -> {el, set(frac, texto?), hot(bool)}: medidor radial (RPM, carga, mordida)
  function gauge(parent, o) {
    o = o || {};
    const size = o.size || 72, sweep = (o.sweep || 270) * Math.PI / 180, R = 38, a0 = Math.PI / 2 + (TAU - sweep) / 2;
    const el = h('div', 'k-gauge' + (o.over ? ' k-over' : ''), par(parent));
    const s = svg('svg', null, el);
    s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('width', size); s.setAttribute('height', size);
    const pt = (f, r) => (50 + Math.cos(a0 + sweep * f) * r).toFixed(2) + ' ' + (50 + Math.sin(a0 + sweep * f) * r).toFixed(2);
    const arc = (f0, f1, r) => 'M' + pt(f0, r) + 'A' + r + ' ' + r + ' 0 ' + (sweep * (f1 - f0) > Math.PI ? 1 : 0) + ' 1 ' + pt(f1, r);
    const len = R * sweep;
    const mk = (cls, w) => { const p = svg('path', cls, s); p.setAttribute('d', arc(0, 1, R)); p.setAttribute('stroke-width', w); return p; };
    mk('k-g-out', 19); mk('k-g-track', 13);
    const fill = mk('k-g-fill', 13);
    fill.setAttribute('stroke-dasharray', len.toFixed(2) + ' ' + (len * 2).toFixed(2));
    if (o.tone) fill.style.stroke = o.tone;
    if (o.zones) for (const z of o.zones) { const p = svg('path', 'k-g-zone', s); p.setAttribute('d', arc(z[0], z[1], R + 8)); p.setAttribute('stroke-width', 4); if (z[2]) p.style.stroke = z[2]; }
    let needle = null;
    if (o.needle) {
      needle = svg('g', 'k-g-needle', s);
      svg('path', null, needle).setAttribute('d', 'M50 46 L' + (50 + R - 4) + ' 50 L50 54 Z');
      const hub = svg('circle', 'k-g-hub', s); hub.setAttribute('cx', 50); hub.setAttribute('cy', 50); hub.setAttribute('r', 6);
    }
    const v = h('div', 'k-gauge-v', el);
    const fs = o.needle ? 0.19 : 0.26;
    let lastLen = -1;
    v.style.top = Math.round(size * (o.needle ? 0.72 : 0.5)) + 'px';
    if (!o.needle) v.style.transform = 'translateY(-50%)';
    if (o.needle) el.classList.add('k-needle');
    const l = o.label ? h('div', 'k-gauge-l', el, o.label) : null;
    let lastQ = -1, hot = false;
    const api = {
      el, label: l,
      set(f, text) {
        f = U.clamp(+f || 0, 0, 1);
        const q = Math.round(f * 500);
        if (q !== lastQ) {
          lastQ = q;
          fill.style.strokeDashoffset = (len * (1 - f)).toFixed(2);
          fill.style.visibility = f < 0.004 ? 'hidden' : '';
          if (needle) needle.style.transform = 'rotate(' + ((a0 + sweep * f) * 180 / Math.PI).toFixed(1) + 'deg)';
        }
        if (text !== undefined) {
          text = String(text);
          if (text.length !== lastLen) { lastLen = text.length; v.style.fontSize = Math.round(size * Math.min(fs, 0.92 / Math.max(1, text.length))) + 'px'; }
          setText(v, text);
        }
      },
      hot(b) { b = !!b; if (b !== hot) { hot = b; el.classList.toggle('k-hot', b); } },
    };
    api.set(o.frac || 0, o.text);
    return api;
  }

  /* ======================================================================
     13. Árvore — grafo de nós com pan/zoom, névoa e cartão de compra
     ====================================================================== */
  const DASH_OPEN = [7, 6], DASH_FOG = [3, 7], DASH_SYN = [2, 7], DASH_KEY = [9, 7], DASH_NONE = [];
  const NODE_R = [15, 21, 29];

  // E.UI.tree(pai, {nodes:[{id,n,c,branch,pos:{x,y},req:[ids],size:0|1|2,desc,see,icon}], branches:{id:{name,color,icon}},
  //   owned(id)->bool, affordable(node)->bool, visible(node)->bool?, locked(node)->texto|null ("precisa: Trator"), money()->n, progress(node)->0..1,
  //   fmtCost(c)->texto, onBuy(node)->false cancela, onSelect(node), synergies:[{a,b}], center:{icon,label}, unit=96, zoomMin=.5, zoomMax=1.5, zoom=1, chips=true, plain})
  //   -> {el, refresh(), focus(id,{zoom,instant}), select(id|null), home(), cheapest(branch?) -> node, selected, destroy()}
  function tree(parent, o) {
    o = o || {};
    const el = h('div', 'k-tree' + (o.plain ? ' k-plain' : ''), par(parent));
    const cv = h('canvas', 'k-tree-cv', el), g = cv.getContext('2d');
    const UNIT = o.unit || 96, ZMIN = o.zoomMin || 0.5, ZMAX = o.zoomMax || 1.5;
    const branches = o.branches || {};
    const fmtCost = o.fmtCost || (c => '¥ ' + U.fmt(c));
    const FONT = (window.getComputedStyle ? getComputedStyle(el).fontFamily : '') || 'sans-serif';
    const F_NAME = '900 11px ' + FONT, F_SMALL = '900 9.5px ' + FONT, F_BIG = '900 13px ' + FONT, F_Q = '900 16px ' + FONT;
    const stageOf = () => (UI.root && UI.root.stage) || null;

    /* ---------- dados ---------- */
    const list = [], byId = Object.create(null);
    let x0 = -UNIT, x1 = UNIT, y0 = -UNIT, y1 = UNIT;
    for (const d of o.nodes || []) {
      const br = branches[d.branch] || {}, size = d.size || 0;
      const N = {
        d, id: d.id, x: d.pos.x * UNIT, y: d.pos.y * UNIT, size, r: NODE_R[size] || NODE_R[0],
        col: br.color || GOLD, colD: U.shade(br.color || GOLD, -0.3), colL: U.shade(br.color || GOLD, 0.55),
        ico: srcIcon(d.icon) || srcIcon(br.icon), st: 'hidden', can: false, prog: 0,
        pop: 0, rev: 1, name: d.n || d.id, price: fmtCost(d.c), need: '', wName: 0, wPrice: 0, wNeed: 0, reqs: null, ph: Math.random() * TAU,
      };
      list.push(N); byId[d.id] = N;
      if (N.x < x0) x0 = N.x; if (N.x > x1) x1 = N.x; if (N.y < y0) y0 = N.y; if (N.y > y1) y1 = N.y;
    }
    for (const N of list) N.reqs = (N.d.req || []).map(id => byId[id]).filter(Boolean);
    const syn = (o.synergies || []).map(s => ({ a: byId[s.a], b: byId[s.b] })).filter(s => s.a && s.b);
    const center = o.center === false ? null : Object.assign({ r: 32 }, o.center);
    const centerIco = center ? srcIcon(center.icon) : null;
    list.sort((a, b) => a.y - b.y);

    /* ---------- estado dos nós ---------- */
    const isOwned = id => !!(o.owned && o.owned(id));
    let first = true;
    function refresh() {
      for (const N of list) N._own = isOwned(N.id);
      for (const N of list) { let ok = true; for (const r of N.reqs) if (!r._own) ok = false; N._ok = ok; N._lock = !N._own && o.locked ? o.locked(N.d) : null; }
      for (const N of list) {
        let st;
        if (N._own) st = 'owned';
        else if (N._ok && !N._lock) st = 'open';
        else {
          let near = N._ok;                                   // trancado por ferramenta: mostra a silhueta
          for (const r of N.reqs) if (r._own || (r._ok && !r._lock)) near = true;
          st = near ? 'fog' : 'hidden';
        }
        if (o.visible) { const v = o.visible(N.d); if (v === false) st = 'hidden'; else if (v === true && st === 'hidden') st = 'fog'; }
        if (st === 'fog') {
          if (N._lock) N.need = N._lock;
          else { let s = ''; for (const r of N.reqs) if (!r._own) s += (s ? ' + ' : '') + r.name; N.need = 'precisa: ' + s; }
          N.wNeed = 0;
        }
        if (st !== N.st) { if (!first && N.st !== 'owned') N.rev = st === 'owned' ? 1 : 0; N.st = st; }
      }
      first = false;
      afford();
      if (o.chips !== false) updateChips();
      if (sel) fillCard();
      wake();
    }
    function afford() {
      const m = o.money ? o.money() : 0;
      for (const N of list) {
        if (N.st !== 'open') { N.can = false; continue; }
        N.can = o.affordable ? !!o.affordable(N.d) : o.money ? m >= N.d.c : true;
        N.prog = o.progress ? o.progress(N.d) : o.money ? U.clamp(m / (N.d.c || 1), 0, 1) : N.can ? 1 : 0;
      }
    }
    // cheapest(branch?) -> nó aberto mais barato (de um ramo, ou de todos)
    function cheapest(branch) {
      let best = null;
      for (const N of list) if (N.st === 'open' && (!branch || N.d.branch === branch) && (!best || N.d.c < best.d.c)) best = N;
      return best;
    }

    /* ---------- câmera ---------- */
    const cam = { x: 0, y: 0, z: o.zoom || 1, tx: 0, ty: 0, tz: o.zoom || 1, vx: 0, vy: 0, follow: false, ax: 0, ay: 0, awx: 0, awy: 0, anchor: false };
    let W = 0, H = 0, ratio = 1, running = false, dead = false, time = 0, affT = 0, cardT = 0;
    function resize() {
      W = el.clientWidth; H = el.clientHeight;
      if (!W || !H) return;
      const st = stageOf();
      ratio = U.clamp((window.devicePixelRatio || 1) * (st ? st.scale : 1), 1, 2);
      const bw = Math.round(W * ratio), bh = Math.round(H * ratio);
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      wake();
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(el);
    const offStage = stageOf() && stageOf().on ? stageOf().on('resize', resize) : null;
    function wake() { if (!running && !dead) { running = true; tick(run); } }
    const portrait = () => H > W;
    // deslocamento do "centro útil" quando o cartão está aberto (o nó focado não fica embaixo dele)
    const offX = () => (sel && !portrait() && W > 560 ? -138 : 0);
    const offY = () => (sel && portrait() ? -Math.min(110, H * 0.16) : 16);
    // focus(id|node, {zoom, instant}): leva a câmera até um nó
    function focus(id, f) {
      const N = typeof id === 'string' ? byId[id] : id;
      f = f || {};
      if (f.zoom) cam.tz = U.clamp(f.zoom, ZMIN, ZMAX);
      const z = cam.tz;
      cam.tx = (N ? N.x : 0) - offX() / z; cam.ty = (N ? N.y : 0) - offY() / z;
      cam.follow = true; cam.anchor = false; cam.vx = cam.vy = 0;
      if (f.instant) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
      wake();
    }
    const home = () => { select(null); cam.tz = o.zoom || 1; focus(null); };

    /* ---------- cartão de detalhe (DOM) ---------- */
    const card = h('div', 'k-tree-card', el);
    const cHead = h('div', 'k-tree-card-head', card), cIco = h('div', 'k-tree-card-ico', cHead), cT = h('div', 'k-tree-card-t', cHead);
    const cKind = h('small', null, cT), cName = h('b', null, cT);
    const cDesc = h('div', 'k-tree-card-desc', card), cSee = h('div', 'k-tree-card-see', card);
    const cGoal = goal(card, { fluid: true, size: 'sm', label: '' });
    const cBuy = button(card, { title: 'Comprar', icon: 'yen', iconSize: 22, center: true, sound: 'none', onClick: () => buy(sel) });
    const cX = h('button', 'k-x', card); cX.type = 'button'; h('i', null, cX);
    cX.addEventListener('click', () => { sfx('click'); select(null); });
    let sel = null;
    const KIND = ['Melhoria', 'Melhoria grande', 'Keystone'];
    function fillCard() {
      const N = sel, d = N.d, br = branches[d.branch] || {};
      card.style.setProperty('--k-accent', N.st === 'fog' ? '#8a7f70' : N.col);
      cIco.textContent = ''; cIco.classList.toggle('k-key', N.size === 2);
      const fog = N.st === 'fog';
      const ic = fog && N.ico ? icon(silhouette(N.ico), 30) : iconEl(N.ico || 'star', 30);
      if (ic) { if (fog) ic.style.opacity = 0.45; cIco.appendChild(ic); }
      setText(cKind, (br.name ? br.name + ' · ' : '') + KIND[N.size]);
      setText(cName, fog && o.fogNames === false ? '???' : N.name);
      setText(cDesc, fog ? N.need : (d.desc || ''));
      setText(cSee, fog ? (d.q || 'Ainda encoberto. Compre o que falta pra revelar.') : (d.see || ''));
      cardT = 0; liveCard();
    }
    function liveCard() {
      const N = sel;
      if (!N) return;
      if (N.st === 'owned') { cGoal.el.style.display = 'none'; cBuy.set({ title: 'Já é seu!', sub: '', icon: 'check', state: 'off' }); }
      else if (N.st === 'fog') { cGoal.el.style.display = 'none'; cBuy.set({ title: 'Trancado', sub: '', icon: 'lock', state: 'off' }); }
      else {
        cGoal.el.style.display = N.can ? 'none' : '';
        if (o.money) cGoal.set(o.money(), N.d.c, o.rate ? o.rate() : 0); else cGoal.bar.set(N.prog);
        cBuy.set({ title: N.can ? 'Comprar' : 'Ainda não dá', sub: N.price, icon: 'yen', state: N.can ? 'can' : 'off' });
      }
    }
    // select(id|node|null): abre/fecha o cartão de um nó
    function select(id) {
      const N = id ? (typeof id === 'string' ? byId[id] : id) : null;
      if (N === sel) return;
      sel = N && N.st !== 'hidden' ? N : null;
      if (sel) { fillCard(); replay(card, 'k-on'); if (o.onSelect) o.onSelect(sel.d); }
      else card.classList.remove('k-on');
      wake();
    }
    function buy(N) {
      if (!N || N.st !== 'open') return;
      afford();
      if (!N.can) { sfx('error'); return; }
      if (o.onBuy && o.onBuy(N.d) === false) return;
      sfx('buy');
      N.pop = 1; addBurst(N.x, N.y, N.col);
      refresh();
      cBuy.pop();
    }

    /* ---------- atalhos de ramo ---------- */
    const chipEls = {};
    let chipsEl = null;
    if (o.chips !== false) {
      chipsEl = h('div', 'k-tree-chips', el);
      for (const id in branches) {
        const b = branches[id], c = h('button', 'k-tree-chip', chipsEl);
        c.type = 'button'; c.style.setProperty('--k-accent', b.color || GOLD);
        const dot = h('i', null, c), ic = iconEl(b.icon, 14);
        if (ic) dot.appendChild(ic);
        h('span', null, c, b.name || id);
        chipEls[id] = { el: c, n: h('small', null, c) };
        c.addEventListener('click', () => {
          sfx('click');
          let N = cheapest(id);
          if (!N) for (const M of list) if (M.d.branch === id && M.st !== 'hidden' && (!N || Math.hypot(M.x, M.y) > Math.hypot(N.x, N.y))) N = M;
          if (N) { select(N); focus(N); }
        });
      }
    }
    function updateChips() {
      for (const id in chipEls) {
        let have = 0, tot = 0, can = false;
        for (const N of list) if (N.d.branch === id) { tot++; if (N.st === 'owned') have++; if (N.can) can = true; }
        const c = chipEls[id];
        setText(c.n, have + '/' + tot);
        c.el.classList.toggle('k-can', can); c.el.classList.toggle('k-done', have === tot);
      }
    }
    /* botões de zoom (pinça e roda também funcionam) */
    const zb = h('div', 'k-tree-zoom', el);
    button(zb, { title: '+', center: true, onClick: () => zoomBy(1.3) });
    button(zb, { title: '−', center: true, onClick: () => zoomBy(1 / 1.3) });
    button(zb, { icon: 'paw', iconSize: 22, onClick: home });
    function zoomBy(k, sx, sy) {
      cam.tz = U.clamp(cam.tz * k, ZMIN, ZMAX);
      cam.ax = sx === undefined ? W / 2 : sx; cam.ay = sy === undefined ? H / 2 : sy;
      cam.awx = cam.x + (cam.ax - W / 2) / cam.z; cam.awy = cam.y + (cam.ay - H / 2) / cam.z;
      cam.anchor = true; cam.follow = false;
      wake();
    }

    /* ---------- ponteiro: arrastar, pinça, toque ---------- */
    const ptr = new Map(), lp = { x: 0, y: 0 };
    let moved = 0, downT = 0, pinch = 0, hover = null, mx = 0, my = 0;
    function local(e) {
      const r = cv.getBoundingClientRect();
      lp.x = r.width ? (e.clientX - r.left) * W / r.width : 0; lp.y = r.height ? (e.clientY - r.top) * H / r.height : 0;
      return lp;
    }
    function hit(sx, sy) {
      const wx = cam.x + (sx - W / 2) / cam.z, wy = cam.y + (sy - H / 2) / cam.z, slack = 12 / cam.z;
      let best = null, bd = 1e9;
      for (const N of list) {
        if (N.st === 'hidden') continue;
        const dd = Math.hypot(N.x - wx, N.y - wy);
        if (dd < N.r + slack && dd < bd) { bd = dd; best = N; }
      }
      return best;
    }
    function two() { let a = null, b = null; for (const p of ptr.values()) { if (!a) a = p; else b = p; } mx = (a.x + b.x) / 2; my = (a.y + b.y) / 2; return Math.hypot(a.x - b.x, a.y - b.y); }
    cv.addEventListener('pointerdown', e => {
      if (e.button) return;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro sintético */ }
      const p = local(e);
      ptr.set(e.pointerId, { x: p.x, y: p.y });
      if (ptr.size === 1) { moved = 0; downT = performance.now(); cam.vx = cam.vy = 0; cam.follow = false; cam.anchor = false; cam.tz = cam.z; }
      else if (ptr.size === 2) { pinch = two(); moved = 99; }
      el.classList.add('k-grab');
      wake(); e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      const p = local(e), q = ptr.get(e.pointerId);
      if (!q) {
        const N = hit(p.x, p.y);
        if (N !== hover) { hover = N; cv.style.cursor = N ? 'pointer' : ''; wake(); }
        return;
      }
      const dx = p.x - q.x, dy = p.y - q.y;
      q.x = p.x; q.y = p.y;
      if (ptr.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) {
          cam.x -= dx / cam.z; cam.y -= dy / cam.z;
          cam.vx = U.lerp(cam.vx, -dx / cam.z * 60, 0.5); cam.vy = U.lerp(cam.vy, -dy / cam.z * 60, 0.5);
        }
      } else if (ptr.size === 2) {
        const pmx = mx, pmy = my, d = two();
        if (pinch > 0) {
          const wx = cam.x + (pmx - W / 2) / cam.z, wy = cam.y + (pmy - H / 2) / cam.z;
          cam.z = cam.tz = U.clamp(cam.z * d / pinch, ZMIN, ZMAX);
          cam.x = wx - (mx - W / 2) / cam.z; cam.y = wy - (my - H / 2) / cam.z;
        }
        pinch = d;
      }
      wake();
    });
    function up(e) {
      if (!ptr.has(e.pointerId)) return;
      const p = local(e);
      ptr.delete(e.pointerId);
      if (ptr.size === 1) { moved = 99; return; }
      if (ptr.size) return;
      el.classList.remove('k-grab');
      if (e.type === 'pointerup' && moved <= 6 && performance.now() - downT < 500) {
        const N = hit(p.x, p.y);
        if (!N) select(null);
        else if (N === sel && N.st === 'open' && N.can) buy(N);                  // tocar de novo compra
        else {
          sfx(N.st === 'fog' ? 'click' : 'pop', { vol: 0.6 });
          N.pop = Math.max(N.pop, 0.45);
          select(N);
          const sx = (N.x - cam.x) * cam.z + W / 2, sy = (N.y - cam.y) * cam.z + H / 2;
          const underCard = portrait() ? sy > H - 250 : sx > W - 300 && sy > H - 300;
          if (underCard || sx < 70 || sx > W - 70 || sy < 110 || sy > H - 60) focus(N);
        }
      }
      wake();
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (hover) { hover = null; cv.style.cursor = ''; } });
    cv.addEventListener('wheel', e => { const p = local(e); zoomBy(Math.exp(-U.clamp(e.deltaY, -240, 240) * 0.0022), p.x, p.y); e.preventDefault(); }, { passive: false });

    /* ---------- efeitos ---------- */
    const bursts = [];
    for (let i = 0; i < 6; i++) bursts.push({ x: 0, y: 0, t: 1, col: GOLD });
    function addBurst(x, y, col) { let b = bursts[0]; for (const c of bursts) if (c.t > b.t) b = c; b.x = x; b.y = y; b.t = 0; b.col = col; }

    /* ---------- desenho ---------- */
    function shape(x, y, r, size, rot) {
      g.beginPath();
      if (size === 1) {
        const k = r * 0.42;
        g.moveTo(x - r + k, y - r); g.arcTo(x + r, y - r, x + r, y + r, k); g.arcTo(x + r, y + r, x - r, y + r, k);
        g.arcTo(x - r, y + r, x - r, y - r, k); g.arcTo(x - r, y - r, x + r, y - r, k); g.closePath();
      } else if (size === 2) {
        for (let i = 0; i < 8; i++) { const a = (rot || 0) + Math.PI / 8 + i * Math.PI / 4; if (i) g.lineTo(x + Math.cos(a) * r * 1.06, y + Math.sin(a) * r * 1.06); else g.moveTo(x + Math.cos(a) * r * 1.06, y + Math.sin(a) * r * 1.06); }
        g.closePath();
      } else g.arc(x, y, r, 0, TAU);
    }
    function label(txt, x, y, col, w) {
      g.lineWidth = w || 3.5; g.strokeStyle = INK; g.strokeText(txt, x, y);
      g.fillStyle = col; g.fillText(txt, x, y);
    }
    const SX = x => (x - cam.x) * cam.z + W / 2, SY = y => (y - cam.y) * cam.z + H / 2;
    function edgePass(pass) {
      const z = cam.z;
      for (const N of list) {
        if (N.st === 'hidden') continue;
        const bx = SX(N.x), by = SY(N.y);
        const n = N.reqs.length || (center ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const R = N.reqs[i];
          if (R && R.st === 'hidden') continue;
          const ax = R ? SX(R.x) : SX(0), ay = R ? SY(R.y) : SY(0);
          if (Math.max(ax, bx) < -20 || Math.min(ax, bx) > W + 20 || Math.max(ay, by) < -20 || Math.min(ay, by) > H + 20) continue;
          const st = N.st, a = N.rev;
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + (bx - ax) * a, ay + (by - ay) * a);
          if (pass === 0) {
            if (st === 'fog') continue;
            g.lineWidth = (st === 'owned' ? 8 : 6.5) * z; g.strokeStyle = INK; g.setLineDash(DASH_NONE); g.stroke();
          } else if (st === 'owned') {
            g.lineWidth = 4 * z; g.strokeStyle = N.col; g.setLineDash(DASH_NONE); g.stroke();
          } else if (st === 'open') {
            g.lineWidth = 2.5 * z; g.strokeStyle = N.can ? YEL : N.colL; g.setLineDash(DASH_OPEN); g.lineDashOffset = -time * 16; g.stroke();
          } else {
            g.lineWidth = 2 * z; g.strokeStyle = 'rgba(255,250,238,.3)'; g.setLineDash(DASH_FOG); g.lineDashOffset = 0; g.stroke();
          }
        }
      }
      g.setLineDash(DASH_NONE); g.lineDashOffset = 0;
    }
    function drawIcon(src, x, y, s) {
      if (!src) return;
      const m = Math.max(src.width, src.height), w = src.width / m * s, hh = src.height / m * s;
      g.drawImage(src, Math.round(x - w / 2), Math.round(y - hh / 2), Math.round(w), Math.round(hh));
    }
    function drawNode(N, dt) {
      const z = cam.z, st = N.st;
      if (N.rev < 1) N.rev = Math.min(1, N.rev + dt * 2.6);
      if (N.pop > 0) N.pop = Math.max(0, N.pop - dt * 2.2);
      const x = SX(N.x), y0n = SY(N.y), pad = 90 * z;
      if (x < -pad || x > W + pad || y0n < -pad || y0n > H + pad) return;
      const rv = U.ease.back(N.rev), pp = Math.sin(N.pop * Math.PI) * 0.3;
      const bob = st === 'open' && N.can ? Math.sin(time * 3.2 + N.ph) * 2.2 * z : 0;
      const y = y0n + bob, r = N.r * z * rv * (1 + pp) * (N === hover ? 1.06 : 1);
      if (r < 1) return;
      const key = N.size === 2, lw = Math.max(1.5, 2.6 * z);
      // halo de "dá pra comprar": um pulso suave a cada 3 s
      if (st === 'open' && N.can) {
        const ph = (time * 0.33 + N.ph * 0.05) % 1, k = ph < 0.4 ? Math.sin(ph / 0.4 * Math.PI) : 0;
        g.globalAlpha = 0.25 + 0.4 * k; shape(x, y, r + (5 + 5 * k) * z, N.size); g.fillStyle = GOLD; g.fill(); g.globalAlpha = 1;
      }
      // keystone: aro tracejado girando
      if (key && st !== 'fog') {
        g.beginPath(); g.arc(x, y, r + 9 * z, 0, TAU);
        g.lineWidth = 5.5 * z; g.strokeStyle = INK; g.stroke();
        g.lineWidth = 2.6 * z; g.strokeStyle = st === 'owned' ? GOLD : CREAM; g.setLineDash(DASH_KEY); g.lineDashOffset = time * 14; g.stroke();
        g.setLineDash(DASH_NONE); g.lineDashOffset = 0;
      }
      if (st === 'fog') {
        shape(x, y, r, N.size); g.fillStyle = 'rgba(42,26,16,.72)'; g.fill();
        g.lineWidth = lw; g.strokeStyle = 'rgba(255,250,238,.42)'; g.setLineDash(DASH_FOG); g.stroke(); g.setLineDash(DASH_NONE);
        if (N.ico) { g.globalAlpha = 0.5; drawIcon(silhouette(N.ico, '#0d0805'), x, y, r * 1.15); g.globalAlpha = 1; }
        g.font = F_Q; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (z > 0.6) { g.fillStyle = 'rgba(255,250,238,.6)'; g.fillText('?', x, y + 1); }
      } else {
        // sombra dura + corpo + luz
        shape(x, y + 3.5 * z, r, N.size); g.fillStyle = INK; g.fill();
        g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
        shape(x, y, r, N.size);
        g.fillStyle = st === 'owned' ? N.col : N.can ? YEL : CREAM; g.fill();
        g.save(); g.clip();
        g.fillStyle = st === 'owned' ? N.colD : 'rgba(42,26,16,.12)'; g.globalAlpha = st === 'owned' ? 0.55 : 1;
        g.fillRect(x - r * 1.2, y + r * 0.55, r * 2.4, r);
        g.globalAlpha = 0.4; g.fillStyle = '#fff'; g.fillRect(x - r * 1.2, y - r * 1.1, r * 2.4, r * 0.42); g.globalAlpha = 1;
        // preenchimento de progresso (quanto falta) subindo por dentro
        if (st === 'open' && !N.can && N.prog > 0) { g.globalAlpha = 0.5; g.fillStyle = N.col; g.fillRect(x - r * 1.2, y + r * 1.1 - r * 2.2 * N.prog, r * 2.4, r * 2.2 * N.prog); g.globalAlpha = 1; }
        g.restore();
        shape(x, y, r, N.size); g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
        drawIcon(N.ico, x, y, r * (N.size === 0 ? 1.25 : 1.2));
        if (st === 'owned') {                                   // selinho de comprado
          const cx = x + r * 0.74, cy = y - r * 0.74, cr = Math.max(4, 6.5 * z);
          g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fillStyle = '#7f9e5c'; g.fill(); g.lineWidth = Math.max(1.2, 2 * z); g.strokeStyle = INK; g.stroke();
          g.beginPath(); g.moveTo(cx - cr * 0.45, cy); g.lineTo(cx - cr * 0.1, cy + cr * 0.38); g.lineTo(cx + cr * 0.5, cy - cr * 0.36);
          g.lineWidth = Math.max(1.2, 1.9 * z); g.strokeStyle = '#fff'; g.stroke();
        }
      }
      if (N === sel) {                                          // cantoneiras de seleção girando devagar
        const rr = r + (key ? 15 : 8) * z + Math.sin(time * 5) * 1.5 * z;
        g.lineWidth = 6 * z; g.strokeStyle = INK;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < 4; i++) { const a = time * 0.9 + i * Math.PI / 2; g.beginPath(); g.arc(x, y, rr, a, a + 0.75); g.stroke(); }
          g.lineWidth = 3 * z; g.strokeStyle = '#fff';
        }
      }
    }
    function drawLabel(N) {
      const z = cam.z, st = N.st;
      if (st === 'hidden' || N.rev < 0.6) return;
      const x = SX(N.x), y = SY(N.y) + (N.r + (N.size === 2 ? 12 : 5)) * z + 3;
      if (x < -80 || x > W + 80 || y < -30 || y > H + 30) return;
      const big = N.size > 0 || N === sel || N === hover;
      if (z < 0.62 && !big && !N.can) return;
      g.textAlign = 'center'; g.textBaseline = 'top';
      if (st === 'fog') {
        if (z < 0.8 && N !== sel && N !== hover) return;
        g.font = F_SMALL; g.globalAlpha = 0.8; label(N.need, x, y, '#d9cdb6', 3); g.globalAlpha = 1;
        return;
      }
      g.font = N.size === 2 ? F_BIG : F_NAME;
      label(N.name, x, y, st === 'owned' ? N.colL : '#fff');
      if (st === 'open') {
        g.font = F_SMALL;
        if (!N.wPrice) N.wPrice = g.measureText(N.price).width;
        const w = N.wPrice + 12, hh = 15, py = y + (N.size === 2 ? 17 : 14);
        g.beginPath(); g.moveTo(x - w / 2 + 7, py); g.arcTo(x + w / 2, py, x + w / 2, py + hh, 7); g.arcTo(x + w / 2, py + hh, x - w / 2, py + hh, 7);
        g.arcTo(x - w / 2, py + hh, x - w / 2, py, 7); g.arcTo(x - w / 2, py, x + w / 2, py, 7); g.closePath();
        g.fillStyle = INK; g.save(); g.translate(0, 2); g.fill(); g.restore();
        g.fillStyle = N.can ? YEL : CREAM; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
        g.fillStyle = INK; g.fillText(N.price, x, py + 2.5);
      }
    }
    function draw(dt) {
      const z = cam.z;
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      g.clearRect(0, 0, W, H);
      g.lineCap = 'round'; g.lineJoin = 'round'; g.imageSmoothingEnabled = false;
      // papel pontilhado do mapa + anéis de distância
      const step = UNIT / 2 * z, ox = ((W / 2 - cam.x * z) % step + step) % step, oy = ((H / 2 - cam.y * z) % step + step) % step;
      g.fillStyle = 'rgba(255,250,238,.1)';
      const ds = Math.max(1.5, 2.2 * z);
      g.beginPath();
      for (let yy = oy; yy < H; yy += step) for (let xx = ox; xx < W; xx += step) g.rect(xx - ds / 2, yy - ds / 2, ds, ds);
      g.fill();
      const cx = SX(0), cy = SY(0);
      g.strokeStyle = 'rgba(255,250,238,.07)'; g.lineWidth = 2;
      for (let i = 1; i <= 5; i++) { g.beginPath(); g.arc(cx, cy, i * UNIT * 1.3 * z, 0, TAU); g.stroke(); }
      // arestas: passe de contorno, depois o de cor (as junções ficam limpas)
      edgePass(0); edgePass(1);
      // sinergias: pontilhado dourado que acende quando os dois lados são seus
      for (const s of syn) {
        if (s.a.st === 'hidden' || s.b.st === 'hidden') continue;
        const lit = s.a.st === 'owned' && s.b.st === 'owned';
        g.beginPath(); g.moveTo(SX(s.a.x), SY(s.a.y)); g.lineTo(SX(s.b.x), SY(s.b.y));
        if (lit) { g.lineWidth = 6 * z; g.strokeStyle = INK; g.stroke(); }
        g.setLineDash(DASH_SYN); g.lineDashOffset = lit ? -time * 10 : 0;
        g.lineWidth = (lit ? 3.4 : 2.4) * z; g.strokeStyle = lit ? GOLD : 'rgba(243,201,74,.45)'; g.stroke();
        g.setLineDash(DASH_NONE);
      }
      // centro: o rosto do Kome
      if (center) {
        const r = center.r * z * (1 + Math.sin(time * 2) * 0.025);
        g.beginPath(); g.arc(cx, cy + 4 * z, r, 0, TAU); g.fillStyle = INK; g.fill();
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fillStyle = YEL; g.fill(); g.lineWidth = 3 * z; g.strokeStyle = INK; g.stroke();
        g.beginPath(); g.arc(cx, cy, r - 5 * z, 0, TAU); g.fillStyle = CREAM; g.fill(); g.lineWidth = 2 * z; g.stroke();
        drawIcon(centerIco, cx, cy + (center.dy || 0) * z, r * (center.scale || 1.5));
        if (center.label && z > 0.6) { g.font = F_BIG; g.textAlign = 'center'; g.textBaseline = 'top'; label(center.label, cx, cy + r + 6, YEL); }
      }
      for (const N of list) if (N.st !== 'hidden') drawNode(N, dt);
      g.imageSmoothingEnabled = true;
      for (const N of list) drawLabel(N);
      // explosão de compra: anel + raios
      for (const b of bursts) {
        if (b.t >= 1) continue;
        b.t = Math.min(1, b.t + dt * 1.9);
        const e = U.ease.out(b.t), x = SX(b.x), y = SY(b.y), r = (26 + 70 * e) * z;
        g.globalAlpha = 1 - b.t;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.lineWidth = (9 * (1 - e) + 1) * z; g.strokeStyle = '#fff'; g.stroke();
        g.lineWidth = 4 * z * (1 - e) + 1; g.strokeStyle = b.col;
        for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + 0.3; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); g.lineTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2); g.stroke(); }
        g.globalAlpha = 1;
      }
    }

    /* ---------- laço ---------- */
    function run(dt, t) {
      if (dead || !el.isConnected) { running = false; return false; }
      if (!el.offsetWidth) { running = false; return false; }           // escondida (painel fechado): dorme; o ResizeObserver acorda
      if (!W) resize();
      time = t;
      // zoom suave ancorado no cursor
      if (Math.abs(cam.tz - cam.z) > 0.001) {
        cam.z = U.damp(cam.z, cam.tz, 14, dt);
        if (cam.anchor) { cam.x = cam.awx - (cam.ax - W / 2) / cam.z; cam.y = cam.awy - (cam.ay - H / 2) / cam.z; }
      } else { cam.z = cam.tz; cam.anchor = false; }
      if (cam.follow) {
        cam.x = U.damp(cam.x, cam.tx, 9, dt); cam.y = U.damp(cam.y, cam.ty, 9, dt);
        if (Math.abs(cam.x - cam.tx) + Math.abs(cam.y - cam.ty) < 0.4) cam.follow = false;
      } else if (!ptr.size) {
        cam.x += cam.vx * dt; cam.y += cam.vy * dt;                        // inércia
        const k = Math.exp(-5 * dt); cam.vx *= k; cam.vy *= k;
        // limites elásticos
        const m = 60, lx0 = x0 - m, lx1 = x1 + m, ly0 = y0 - m, ly1 = y1 + m;
        if (cam.x < lx0) cam.x = U.damp(cam.x, lx0, 10, dt); else if (cam.x > lx1) cam.x = U.damp(cam.x, lx1, 10, dt);
        if (cam.y < ly0) cam.y = U.damp(cam.y, ly0, 10, dt); else if (cam.y > ly1) cam.y = U.damp(cam.y, ly1, 10, dt);
      }
      affT -= dt;
      if (affT <= 0) { affT = 0.2; afford(); if (o.chips !== false) updateChips(); }
      cardT -= dt;
      if (sel && cardT <= 0) { cardT = 0.2; liveCard(); }
      draw(dt);
    }

    refresh();
    resize();
    const start = o.focus ? byId[o.focus] : (o.startCheapest !== false ? cheapest() : null);
    if (start) focus(start, { instant: true }); else focus(null, { instant: true });

    return {
      el, refresh, focus, select, home, cheapest: br => { const N = cheapest(br); return N ? N.d : null; }, zoomBy,
      // openAt(id?): recentra (no nó aberto mais barato, se não passar id); chamar ao abrir o painel
      openAt(id) { refresh(); resize(); const N = id ? byId[id] : cheapest(); focus(N || null, { instant: true }); },
      // count() -> {have, total, can}
      count() { let have = 0, can = 0; for (const N of list) { if (N.st === 'owned') have++; if (N.can) can++; } return { have, total: list.length, can }; },
      get selected() { return sel ? sel.d : null; },
      state: id => (byId[id] ? byId[id].st : null),
      destroy() { dead = true; if (ro) ro.disconnect(); if (offStage) offStage(); el.remove(); },
    };
  }

  /* ======================================================================
     14. Export
     ====================================================================== */
  // E.UI.loadFont(): pede a Zen Maru Gothic ao Google Fonts sem travar a página (offline o fallback do pixxel.css assume)
  function loadFont() {
    if (doc.getElementById('k-font')) return;
    const l = h('link'); l.id = 'k-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=swap';
    l.media = 'print'; l.onload = () => { l.media = 'all'; };              // não bloqueia a primeira pintura
    doc.head.appendChild(l);
  }

  Object.assign(UI, {
    mount, spacer, pill, roll, bar, goal, goals, button, flyer, panel, tabs, dialog, confirm, stat,
    banner, toast, achievement, celebrate, tooltip, missions, album, row, toggle, slider,
    sparkline, rate, gauge, tree, icon, iconEl, defineIcon, badge, sfx, loadFont, el: h,
    // E.UI.icons() -> nomes do conjunto embutido
    icons: () => Object.keys(ICON_DEFS),
    // E.UI.iconSrc(nome) -> canvas-fonte 16x16 (pra desenhar o mesmo ícone dentro do canvas do jogo)
    iconSrc: srcIcon,
  });
  E.UI = UI;
})();


/* ===== engine/board.js ===== */
/* ============================================================================
   Pixxel v1.0 — board.js
   E.Board: SEGUNDA TELA, vista de cima, em grid (fábrica, cidade, mapa de regiões...). Tela cheia por cima do jogo,
   com canvas próprio, barra de ferramentas embaixo e botão de voltar. Feita pro celular DEITADO (toque) e pro mouse.
     const b = E.Board({
       cols: 8, rows: 6, title: 'Fábrica', back: 'Montanha',
       tools: [{ id: 'esteira', label: 'Esteira', icon: 'belt' }, ...],   // botões da barra (icon = ícone do E.UI, opcional)
       floor(c, r) -> cor do ladrilho (padrão: grama em xadrez)
       drawCell(g, c, r, x, y, s, t)  -> desenha o que tem na célula (x,y = canto, s = lado em px)
       draw(g, view, t)               -> desenho livre por cima (view = {x, y, s, cols, rows, w, h})
       onTap(c, r), onDrag(cells, done)  -> cells = [[c,r]...] em caminho contínuo (4 vizinhos), done no fim
       onTool(id), onOpen(), onClose()
     });
     b.open() · b.close() · b.isOpen() · b.tool (id ativo ou null) · b.setTool(id) · b.sel ([c,r] ou null)
     b.cellAt(px, py) -> [c,r] ou null · b.view · b.toast(txt) · b.el (raiz DOM) · b.bar (barra, pra pôr mais coisas)
   Sem ferramenta ativa, arrastar move a vista (quando o grid não cabe). Toque = selecionar.
   Depende de: core.js (E.UI é opcional, só pros ícones)
   ============================================================================ */
(function () {
  'use strict';
  const E = (window.Pixxel = window.Pixxel || {});
  const LINE = '#3B2818';
  let css = false;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = [
      '.px-board{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:#6E9E4A;opacity:0;pointer-events:none;transform:scale(.97);transition:opacity .18s,transform .18s;touch-action:none;font-family:var(--k-font,system-ui,sans-serif)}',
      '.px-board.px-open{opacity:1;pointer-events:auto;transform:none}',
      '.px-board-top{display:flex;align-items:center;gap:8px;padding:6px 10px;padding-left:max(10px,env(safe-area-inset-left));padding-right:max(10px,env(safe-area-inset-right));background:#FFF8EC;border-bottom:3px solid ' + LINE + '}',
      '.px-board-top b{font-size:17px;color:' + LINE + ';flex:1}',
      '.px-board-wrap{flex:1;position:relative;min-height:0}',
      '.px-board canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}',
      '.px-board-bar{display:flex;gap:6px;padding:6px 10px;padding-bottom:max(6px,env(safe-area-inset-bottom));background:#FFF8EC;border-top:3px solid ' + LINE + ';overflow-x:auto}',
      '.px-board-btn{min-height:40px;min-width:44px;padding:4px 12px;border:3px solid ' + LINE + ';border-radius:12px;background:#FFF1D6;color:' + LINE + ';font-family:inherit;font-weight:800;font-size:14px;display:flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer}',
      '.px-board-btn canvas,.px-board-btn .k-ico{position:static!important;flex:none}',
      '.px-board-btn.px-on{background:#F3C94A;transform:translateY(1px)}',
      '.px-board-back{background:#F6B6B0}',
      '.px-board-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:#FFF8EC;border:3px solid ' + LINE + ';border-radius:12px;padding:4px 12px;font-weight:800;font-size:14px;color:' + LINE + ';opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap}',
      '.px-board-toast.px-on{opacity:1}',
    ].join('\n');
    document.head.appendChild(s);
  }
  const el = (tag, cls, parent, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (parent) parent.appendChild(e); return e; };
  function icon(name, size) {
    const UI = E.UI; if (!UI || !UI.icon || !name) return null;
    try { const c = UI.icon(name, size || 22); return c && c.nodeType ? c : null; } catch (e) { return null; }
  }

  function Board(o) {
    o = o || {}; style();
    const cols = o.cols || 8, rows = o.rows || 6;
    const root = el('div', 'px-board'), top = el('div', 'px-board-top', root);
    const back = el('button', 'px-board-btn px-board-back', top, '← ' + (o.back || 'Voltar'));
    el('b', '', top, o.title || '');
    const wrap = el('div', 'px-board-wrap', root), cv = el('canvas', '', wrap), toastEl = el('div', 'px-board-toast', wrap);
    const bar = el('div', 'px-board-bar', root);
    document.body.appendChild(root);
    const B = { el: root, bar, cols, rows, tool: null, sel: null, view: { x: 0, y: 0, s: 40, cols, rows, w: 0, h: 0 }, pan: { x: 0, y: 0 } };
    const btns = {};
    (o.tools || []).forEach(tl => {
      const b = el('button', 'px-board-btn', bar); const ic = icon(tl.icon); if (ic) b.appendChild(ic); el('span', '', b, tl.label);
      b.onclick = () => B.setTool(B.tool === tl.id ? null : tl.id); btns[tl.id] = b;
    });
    back.onclick = () => B.close();
    B.setTool = id => { B.tool = id || null; for (const k in btns) btns[k].classList.toggle('px-on', k === B.tool); if (o.onTool) o.onTool(B.tool); };
    let tT = 0;
    B.toast = txt => { toastEl.textContent = txt; toastEl.classList.add('px-on'); clearTimeout(tT); tT = setTimeout(() => toastEl.classList.remove('px-on'), 1600); };

    // layout: célula do maior tamanho que cabe (mín. 40 px pra dar toque); se não couber, a vista rola
    function layout(w, h) {
      const pad = 12, s = Math.max(40, Math.floor(Math.min((w - pad * 2) / cols, (h - pad * 2) / rows)));
      const gw = cols * s, gh = rows * s;
      const minX = Math.min(pad, w - gw - pad), minY = Math.min(pad, h - gh - pad);
      if (gw + pad * 2 <= w) B.pan.x = 0; else B.pan.x = Math.max(minX - (w - gw) / 2, Math.min(pad - (w - gw) / 2, B.pan.x));
      if (gh + pad * 2 <= h) B.pan.y = 0; else B.pan.y = Math.max(minY - (h - gh) / 2, Math.min(pad - (h - gh) / 2, B.pan.y));
      Object.assign(B.view, { s, x: Math.round((w - gw) / 2 + B.pan.x), y: Math.round((h - gh) / 2 + B.pan.y), w, h });
    }
    B.cellAt = (px, py) => { const v = B.view, c = Math.floor((px - v.x) / v.s), r = Math.floor((py - v.y) / v.s); return c >= 0 && r >= 0 && c < cols && r < rows ? [c, r] : null; };

    const floor = o.floor || ((c, r) => ((c + r) & 1 ? '#8DBE5C' : '#82B454'));
    let raf = 0;
    function frame() {
      if (!B.isOpen()) { raf = 0; return; }
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(100, wrap.clientWidth), h = Math.max(80, wrap.clientHeight);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      layout(w, h);
      const g = cv.getContext('2d'), t = performance.now() / 1000, v = B.view;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
      g.fillStyle = '#6E9E4A'; g.fillRect(0, 0, w, h);
      // moldura de madeira
      g.fillStyle = '#9A6A44'; g.fillRect(v.x - 8, v.y - 8, cols * v.s + 16, rows * v.s + 16);
      g.strokeStyle = LINE; g.lineWidth = 3; g.strokeRect(v.x - 8, v.y - 8, cols * v.s + 16, rows * v.s + 16);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = v.x + c * v.s, y = v.y + r * v.s;
        g.fillStyle = floor(c, r); g.fillRect(x, y, v.s, v.s);
        if (o.drawCell) { try { o.drawCell(g, c, r, x, y, v.s, t); } catch (e) { /* célula com erro não derruba a tela */ } }
      }
      g.strokeStyle = 'rgba(59,40,24,.18)'; g.lineWidth = 1;
      for (let c = 1; c < cols; c++) { g.beginPath(); g.moveTo(v.x + c * v.s + 0.5, v.y); g.lineTo(v.x + c * v.s + 0.5, v.y + rows * v.s); g.stroke(); }
      for (let r = 1; r < rows; r++) { g.beginPath(); g.moveTo(v.x, v.y + r * v.s + 0.5); g.lineTo(v.x + cols * v.s, v.y + r * v.s + 0.5); g.stroke(); }
      if (o.draw) { try { o.draw(g, v, t); } catch (e) { /* idem */ } }
      // rastro do arraste e seleção pulsando
      if (drag && drag.on && drag.cells.length) { g.fillStyle = 'rgba(243,201,74,.45)'; for (const [c, r] of drag.cells) g.fillRect(v.x + c * v.s + 2, v.y + r * v.s + 2, v.s - 4, v.s - 4); }
      if (B.sel) { const [c, r] = B.sel, p = 2 + Math.sin(t * 6) * 1.5; g.strokeStyle = '#FFF3B0'; g.lineWidth = 3; g.strokeRect(v.x + c * v.s + p, v.y + r * v.s + p, v.s - p * 2, v.s - p * 2); g.strokeStyle = LINE; g.lineWidth = 1.5; g.strokeRect(v.x + c * v.s + p - 2, v.y + r * v.s + p - 2, v.s - p * 2 + 4, v.s - p * 2 + 4); }
      raf = requestAnimationFrame(frame);
    }

    // entrada: toque = selecionar; arrastar com ferramenta = caminho de células; arrastar sem ferramenta = mover a vista
    let drag = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function stepTo(cells, to) {   // completa o caminho com vizinhos de 4 lados (esteira não anda na diagonal)
      let [c, r] = cells[cells.length - 1];
      while (c !== to[0] || r !== to[1]) { if (c !== to[0]) c += Math.sign(to[0] - c); else r += Math.sign(to[1] - r); cells.push([c, r]); }
    }
    cv.addEventListener('pointerdown', e => { const p = pos(e); drag = { p0: p, last: p, cell: B.cellAt(p[0], p[1]), on: false, cells: [] }; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* */ } });
    cv.addEventListener('pointermove', e => {
      if (!drag) return; const p = pos(e);
      if (!drag.on && Math.hypot(p[0] - drag.p0[0], p[1] - drag.p0[1]) > 8) { drag.on = true; if (B.tool && drag.cell) drag.cells = [drag.cell.slice()]; }
      if (!drag.on) return;
      if (B.tool) { const c = B.cellAt(p[0], p[1]); if (c && drag.cells.length) { const l = drag.cells[drag.cells.length - 1]; if (l[0] !== c[0] || l[1] !== c[1]) { stepTo(drag.cells, c); if (o.onDrag) o.onDrag(drag.cells, false); } } }
      else { B.pan.x += p[0] - drag.last[0]; B.pan.y += p[1] - drag.last[1]; }
      drag.last = p;
    });
    const up = () => {
      if (!drag) return; const d = drag; drag = null;
      if (!d.on) { if (d.cell) { B.sel = d.cell; if (o.onTap) o.onTap(d.cell[0], d.cell[1]); } else B.sel = null; }
      else if (B.tool && d.cells.length && o.onDrag) o.onDrag(d.cells, true);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; });

    B.isOpen = () => root.classList.contains('px-open');
    B.open = () => { if (B.isOpen()) return B; root.classList.add('px-open'); if (!raf) raf = requestAnimationFrame(frame); if (o.onOpen) o.onOpen(); return B; };
    B.close = () => { if (!B.isOpen()) return B; root.classList.remove('px-open'); drag = null; if (o.onClose) o.onClose(); return B; };
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && B.isOpen()) B.close(); });
    return B;
  }
  E.Board = Board;
})();


/* ===== engine/sim.js ===== */
/* ============================================================================
   Pixxel v1.0 — sim.js
   E.Sim: sistemas que rodam por TEMPO, separados do desenho. Base pra ganho offline, fábrica e cidade
   funcionarem fora da tela, e pra simuladores de balanço rodarem rápido em headless.
     const sim = E.Sim();
     sim.add('fabrica', { tick(dt) {...}, offline(dt) { ...; return { yen: 10 } } });
     sim.tick(dt)                 -> chama tick(dt) de todos (no loop do jogo)
     sim.catchUp(secs, {maxStep}) -> tempo fora: chama offline(dt) em passos de até maxStep s (padrão 60),
                                     soma os números que cada sistema devolve -> { fabrica: { yen: 600 }, ... }
     sim.list()                   -> ids registrados
   Sistema sem offline() simplesmente não anda enquanto o jogo está fechado (nada estraga quando você sai).
   Depende de: core.js
   ============================================================================ */
(function () {
  'use strict';
  const E = (window.Pixxel = window.Pixxel || {});
  function Sim() {
    const list = [];
    const merge = (into, r) => { for (const k in r) if (typeof r[k] === 'number') into[k] = (into[k] || 0) + r[k]; };
    const sim = {
      add(id, sys) { const i = list.findIndex(s => s.id === id); const s = Object.assign({ id }, sys); if (i >= 0) list[i] = s; else list.push(s); return sim; },
      get: id => list.find(s => s.id === id) || null,
      list: () => list.map(s => s.id),
      tick(dt) { for (let i = 0; i < list.length; i++) { const s = list[i]; if (s.tick) { try { s.tick(dt); } catch (e) { console.warn('[pixxel] sim ' + s.id, e); } } } },
      catchUp(secs, o) {
        const max = (o && o.maxStep) || 60, out = {};
        let left = Math.max(0, +secs || 0);
        while (left > 0) {
          const d = Math.min(max, left); left -= d;
          for (const s of list) if (s.offline) { try { const r = s.offline(d); if (r) merge(out[s.id] || (out[s.id] = {}), r); } catch (e) { console.warn('[pixxel] sim offline ' + s.id, e); } }
        }
        return out;
      },
    };
    return sim;
  }
  E.Sim = Sim;
})();

