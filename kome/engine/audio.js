/* ==========================================================================
   Kome Engine v1.0 — audio.js
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
  const E = (root.KomeEngine = root.KomeEngine || {});
  if (!E.U) throw new Error('KomeEngine: carregue core.js antes de audio.js');
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
    G.master.connect(G.comp); G.comp.connect(G.lim); G.lim.connect(G.trim); G.trim.connect(pre); pre.connect(G.clip);
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
    D.noise(b, { a: 0.003, s: 0.02, d: 0.06, vol: 0.4, hp: 1800, lp: 5000, lp1: 3000 });
    D.grains(b, { n: 4 + Math.floor(D.rnd() * 4), t0: 0.005, t1: 0.1, f0: 6000, f1: 10000, vol: 0.25 });
    D.osc(b, { f: D.rr(140, 165), f1: 85, d: 0.06, vol: 0.45 });
    return b;
  });
  def('hashi', { v: 4, gate: 0.05, max: 4, jit: 1, peak: 0.36 }, D => {                   // hashi: "tic" de madeira + um grão
    const b = D.buf(0.18), t2 = D.rr(0.04, 0.055);
    D.osc(b, { wave: 'tri', f: 2100, d: 0.016, vol: 0.5, curve: 3 }); D.modal(b, 1050, [1, 2.7], [0.4, 0.15], [0.05, 0.03]);
    D.noise(b, { d: 0.006, vol: 0.3, hp: 5000 });
    D.osc(b, { at: t2, wave: 'tri', f: 2450, d: 0.016, vol: 0.4, curve: 3 }); D.modal(b, 1240, [1, 2.7], [0.3, 0.1], [0.05, 0.03], { at: t2 });
    D.osc(b, { at: D.rr(0.07, 0.085), f: 3800, f1: 3200, d: 0.012, vol: 0.15 });
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
    a.note(a.deg(5 + st), { vel: 0.75 }); a.note(a.deg(7 + st), { vel: 0.8, delay: 0.06 });
    if (sk.extra === 'kaching') a.play('kaching', { vol: 0.5, delay: 0.03 });
    else if (sk.extra === 'chu') a.drum('chu', { vel: 0.3 });
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
    a.note(a.deg(d, 1), { vel: 0.45 + 0.012 * n });
    if (n >= 30) { for (let i = 0; i < 8; i++) a.pluck(a.deg(14 - i, 1), { vel: 0.3, delay: 0.05 + i * 0.035 }); a.drum('ten', { vel: 0.5 }); }
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
    coin(n) { return quick('coin', semi(Math.floor((n || 0) / 5)), 1); },
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
