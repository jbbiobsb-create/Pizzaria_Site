/* ==========================================================================
   Kome Engine v1.0 — core.js
   Base de tudo: utilitários (U), RNG, ruído, eventos, pool, tweens, Stage
   (canvas escalável), Input (ponteiro + teclado), Loop, Scenes, Save e timers.
   Zero dependências. Script clássico: carregue ANTES de qualquer outro módulo.
   ========================================================================== */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const E = (root.KomeEngine = root.KomeEngine || {});
  const doc = typeof document !== 'undefined' ? document : null;

  E.version = '1.0.0';

  /* ======================================================================
     U — utilitários de matemática, aleatório, easing, formatação e cor
     ====================================================================== */
  const TAU = Math.PI * 2;
  const DARK = [40, 20, 8, 255];      // marrom das sombras (#281408)
  const LIGHT = [255, 250, 230, 255]; // creme das luzes (#FFFAE6)
  const FMT_UNITS = ['', 'mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci'];
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
        const ex = Math.floor(Math.log10(n)), m = n / Math.pow(10, ex);
        return m.toFixed(2).replace('.', ',') + 'e' + (ex + i * 3);
      }
      let s = n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0);
      if (+s >= 1e3 && i < last) { i++; s = '1.00'; }          // 999.999 -> 1,00 mi (e não '1000 mil')
      else if (+s >= 100 && s.indexOf('.') >= 0) s = (+s).toFixed(0); // 99,96 -> 100
      else if (+s >= 10 && s.length > 4) s = (+s).toFixed(1);  // 9,999 -> 10,0
      return s.replace('.', ',') + ' ' + FMT_UNITS[i];
    },
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
    if (k < 1) return;
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
      const n = tweens.length; // tweens criados dentro de callbacks só andam no próximo frame
      for (let i = 0; i < n && i < tweens.length; i++) {
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
    clear() { for (let i = 0; i < tweens.length; i++) tweens[i].dead = true; tweens.length = 0; },
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
  function Stage(opts) {
    opts = opts || {};
    if (!doc) throw new Error('KomeEngine: E.Stage precisa de um documento (DOM)');
    const q = v => (typeof v === 'string' ? doc.querySelector(v) : v);
    const w = opts.width || 960, h = opts.height || 540;
    const fit = opts.fit || 'contain', maxDpr = opts.maxDpr || 2, pixelated = !!opts.pixelated;
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
        let s = fit === 'none' ? (opts.scale || 1) : fit === 'cover' ? Math.max(aw / w, ah / h) : Math.min(aw / w, ah / h);
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
  // E.Loop({update(dt), render(alpha, dt), fixed=0, maxDt=.05, input, maxSteps=5, onVisibility(hidden)}) -> loop
  function Loop(o) {
    o = o || {};
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
          Tween.update(dt);
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
      if (!sc) throw new Error('KomeEngine: cena "' + name + '" não existe');
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
      else if (typeof d === 'number' && (typeof t !== 'number' || t !== t)) target[k] = d; // NaN/Infinity viram null no JSON
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
