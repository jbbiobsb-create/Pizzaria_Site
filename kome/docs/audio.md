# Procedural WebAudio for "Kome no Japão": implementation recipes for `audio.js`

**Provenance:** written from working knowledge; I ran no WebSearch/WebFetch, so nothing here is cited to a source. All code is untested sketches. Numbers are starting points to tune by ear. Items worth a quick check before relying on them: `navigator.audioSession` availability on iOS, and `cancelAndHoldAtTime` support in Firefox.

**Existing draft** (`/tmp/claude-0/-home-user-Pizzaria-Site/73bb5c4b-e898-5ba0-a571-a9a62e6621c9/scratchpad/zip/engine.js`, line 269): `Sfx` is a single oscillator+gain `tone()` helper into one master gain (0.35), with no compressor, buses or voice limits. `game.js` calls `Sfx.init()`, `Sfx.dig(pitch, big)`, `Sfx.combo(n)`, `Sfx.coin()`, `Sfx.gold()`, `Sfx.buy()`, `Sfx.big()`, `Sfx.shake()`, `Sfx.pop()`, `Sfx.gate(key, ms)` and `Sfx.muted`. Keep these as thin aliases over `Sfx.play(name, opts)`.

---

## 0. Architecture

Three ideas drive everything else:

1. **Pre-render, then play buffers.** At init, render every SFX variant, every plucked-string note and every engine loop into `AudioBuffer`s (a JS sample loop or `OfflineAudioContext`). Runtime cost per sound is then 1 `AudioBufferSourceNode` + 1 `GainNode` (+ optional panner). This removes the "too many oscillators / node GC" problem, which matters because an incremental game fires dig sounds 10–20 times per second.
2. **Four buses:** `sfxBus`, `loopBus`, `musicBus` and a shared `reverbSend`, into `master`, then compressor, limiter, destination.
3. **Tune gameplay SFX to the music's current scale** (combo, coin, level-up). Clicking then sounds like playing along, which is the biggest anti-fatigue win.

```js
const Audio = (() => {
  let ac, master, comp, lim, sfxBus, loopBus, musicBus, rev, revSend;
  const NOISE = {};                       // shared white/pink/brown buffers
  function init() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC({ latencyHint: 'interactive' });
    master = ac.createGain(); master.gain.value = 0.8;
    comp = ac.createDynamicsCompressor();            // glue
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.25;
    lim = ac.createDynamicsCompressor();             // brickwall-ish
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20;
    lim.attack.value = 0.001; lim.release.value = 0.08;
    sfxBus = ac.createGain();  sfxBus.gain.value = 0.9;
    loopBus = ac.createGain(); loopBus.gain.value = 0.55;
    musicBus = ac.createGain(); musicBus.gain.value = 0.5;
    const musicLP = ac.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 7500; // anti-fatigue
    rev = ac.createConvolver(); rev.buffer = makeIR(1.6, 2.5);
    revSend = ac.createGain(); revSend.gain.value = 1;
    const revRet = ac.createGain(); revRet.gain.value = 0.22;
    revSend.connect(rev); rev.connect(revRet); revRet.connect(master);
    sfxBus.connect(master); loopBus.connect(master);
    musicBus.connect(musicLP); musicLP.connect(master);
    master.connect(comp); comp.connect(lim); lim.connect(ac.destination);
    NOISE.white = noiseBuf('white', 2); NOISE.pink = noiseBuf('pink', 2); NOISE.brown = noiseBuf('brown', 2);
    return ac;
  }
  function makeIR(sec, decay) {                       // cheap synthetic reverb IR (stereo)
    const n = sec * ac.sampleRate | 0, b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function noiseBuf(kind, sec) {
    const n = sec * ac.sampleRate | 0, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }
    return b;
  }
  // ...
})();
```

---

## 1. sfxr-style SFX: parameter model and offline renderer

Classic sfxr parameters, with useful ranges:

| Param | Meaning | Typical range |
|---|---|---|
| `wave` | `sq`, `saw`, `sin`, `tri`, `noise` | — |
| `f0`, `f1` | start and end frequency (exponential slide) | 60–8000 Hz |
| `a`, `s`, `d` | attack, sustain, decay (seconds) | a 0–0.02, s 0–0.3, d 0.02–0.8 |
| `punch` | sustain-start boost | 0–0.6 |
| `duty`, `dutySweep` | square duty and change per second | 0.1–0.5, ±0.5 |
| `vib`, `vibHz` | vibrato depth (fraction) and rate | 0–0.05, 4–30 Hz |
| `arp`, `arpT` | frequency multiplier applied at time `arpT` | 1.25, 1.335, 1.5, 2; 0.04–0.1 s |
| `lpf`, `lpfSweep` | one-pole low-pass cutoff and multiplier per second | 300–12000 Hz |
| `hpf` | one-pole high-pass cutoff | 0–3000 Hz |
| `vol` | output gain | 0.2–1 |

Archetypes:
- **Coin:** `sq`, short sustain, `arp` 1.335 (a fourth) or 1.5 at 0.06 s, decay 0.3.
- **Jump / power-up:** rising `f1 > f0`.
- **Hit:** noise with falling pitch and short decay.
- **Explosion:** noise, `f0` 200 falling to 40, decay 0.6, low-pass sweep down.
- **Blip:** `sq`, 30 ms.

```js
function renderSfx(p) {                         // returns AudioBuffer
  const sr = ac.sampleRate, n = Math.ceil((p.a + p.s + p.d) * sr) + 1;
  const buf = ac.createBuffer(1, n, sr), o = buf.getChannelData(0);
  const f1 = p.f1 || p.f0, fm = Math.pow(f1 / p.f0, 1 / n);
  let f = p.f0, ph = 0, hold = 0, lp = 0, hpx = 0, hpy = 0, duty = p.duty ?? 0.5, lpf = p.lpf || 20000;
  const hpA = p.hpf ? Math.exp(-2 * Math.PI * p.hpf / sr) : 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let ff = f * (1 + (p.vib || 0) * Math.sin(6.2832 * (p.vibHz || 6) * t));
    if (p.arp && t >= p.arpT) ff *= p.arp;
    f *= fm; ph += ff / sr;
    if (ph >= 1) { ph -= 1; hold = Math.random() * 2 - 1; }      // pitched sample-and-hold noise
    duty = Math.min(0.95, Math.max(0.05, duty + (p.dutySweep || 0) / sr));
    let s = p.wave === 'sq' ? (ph < duty ? 1 : -1) : p.wave === 'saw' ? 2 * ph - 1
          : p.wave === 'tri' ? 1 - 4 * Math.abs(ph - 0.5) : p.wave === 'noise' ? hold : Math.sin(6.2832 * ph);
    lpf *= Math.pow(p.lpfSweep || 1, 1 / sr);
    lp += (s - lp) * (1 - Math.exp(-6.2832 * Math.min(lpf, sr * 0.45) / sr)); s = lp;
    if (hpA) { hpy = hpA * (hpy + s - hpx); hpx = s; s = hpy; }
    let e = t < p.a ? t / p.a : t < p.a + p.s ? 1 + (p.punch || 0) * (1 - (t - p.a) / p.s)
          : Math.pow(Math.max(0, 1 - (t - p.a - p.s) / p.d), 2);
    o[i] = s * e * (p.vol ?? 0.5);
  }
  return buf;
}
// Layered sounds: mix several renders into one buffer at offsets
function mixBufs(parts) {               // parts: [{buf, at (s), gain}]
  const sr = ac.sampleRate, len = Math.max(...parts.map(p => (p.at || 0) * sr + p.buf.length)) | 0;
  const out = ac.createBuffer(1, len, sr), o = out.getChannelData(0);
  for (const p of parts) { const d = p.buf.getChannelData(0), off = (p.at || 0) * sr | 0, g = p.gain ?? 1;
    for (let i = 0; i < d.length; i++) o[off + i] += d[i] * g; }
  return out;
}
```

**Variation.** For every SFX, pre-render 3–5 variants with jittered parameters (`f0` ±6%, `d` ±15%). At play time choose a variant round-robin-random and never repeat the previous one. Also jitter `playbackRate` by ±2 semitones (`2 ** (rnd(-2, 2) / 12)`) and gain by ±2 dB. That gives effectively unlimited variation from a few buffers.

### Player with voice limits and gating

```js
const DEFS = {};                 // name -> {bufs:[], max:4, gate:0.04, vol:1, pan:0, rev:0, duck:0, prio:0}
const live = [];                 // active voices {name, src, g, t0, prio}
const lastT = {}, lastVar = {};
const MAX_VOICES = 24;
function play(name, o = {}) {
  if (!ac || ac.state !== 'running') return;
  const d = DEFS[name]; if (!d) return;
  const now = ac.currentTime;
  if (now - (lastT[name] || 0) < (d.gate || 0)) return;          // rate gate
  lastT[name] = now;
  let same = 0, oldest = null;
  for (const v of live) if (v.name === name) { same++; if (!oldest || v.t0 < oldest.t0) oldest = v; }
  if (same >= (d.max || 4)) steal(oldest);
  if (live.length >= MAX_VOICES) steal(live.reduce((a, b) => (a.prio - b.prio || a.t0 - b.t0) <= 0 ? a : b));
  let vi; do { vi = Math.random() * d.bufs.length | 0; } while (d.bufs.length > 1 && vi === lastVar[name]);
  lastVar[name] = vi;
  const src = ac.createBufferSource(); src.buffer = d.bufs[vi];
  const semis = (o.pitch || 0) + (o.detune ?? (Math.random() * 2 - 1) * (d.jit ?? 1.5));
  src.playbackRate.value = (o.rate || 1) * Math.pow(2, semis / 12);
  const g = ac.createGain(); g.gain.value = (d.vol ?? 1) * (o.vol ?? 1) * (0.85 + Math.random() * 0.3);
  let tail = g;
  if (o.pan != null && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = o.pan; g.connect(p); tail = p; }
  src.connect(g); tail.connect(sfxBus); if (d.rev) { const r = ac.createGain(); r.gain.value = d.rev; tail.connect(r); r.connect(revSend); }
  const v = { name, src, g, t0: now, prio: d.prio || 0 }; live.push(v);
  src.onended = () => { tail.disconnect(); const i = live.indexOf(v); if (i >= 0) live.splice(i, 1); };
  src.start(now + (o.delay || 0));
  if (d.duck) duck(d.duck, 0.9);
}
function steal(v) { if (!v) return; const t = ac.currentTime; v.g.gain.cancelScheduledValues(t);
  v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + 0.015); v.src.stop(t + 0.02); }
```

- **Auto-fire coalescing.** When automation produces 200 digs per second, do not play 200 sounds. Use the gate, and for the automated tiers switch to a continuous "rice cascade" loop whose gain and rate track production rate (section 3). Individual one-shots are for player clicks only.
- **Pan by screen position:** `pan = clamp((screenX / width) * 2 - 1, -0.7, 0.7)`.

---

## 2. Generative music

### 2.1 Scales (semitones from root)

| Scale | Semitones | Mood | Use |
|---|---|---|---|
| Yo (陽) | 0 2 5 7 9 | bright folk, no semitones | **default / farm** |
| Ryo (major pentatonic) | 0 2 4 7 9 | happy | festival, prosperity |
| Min'yō (minor pentatonic) | 0 3 5 7 10 | earthy, work-song | machine tiers |
| Ryūkyū | 0 4 5 7 11 | sunny Okinawan | ending / house bought |
| Hirajōshi | 0 2 3 7 8 | koto, bittersweet | night, quiet idle |
| Kumoi | 0 2 3 7 9 | gentler hirajōshi | dusk transition |
| In / Miyako-bushi | 0 1 5 7 8 | dark, urban shamisen | sparse, short interludes only |
| Insen | 0 1 5 7 10 | meditative | menus, shop |
| Iwato | 0 1 5 6 10 | tense | "oni" events only |

- **Keys:** D (MIDI 62) for yo, G (55/67) for ryo, A (57) for hirajōshi, E (52) for min'yō.
- **Pitch:** `freq = 440 * 2 ** ((midi - 69) / 12)`.
- **Scale-degree to MIDI:** `root + 12 * Math.floor(deg / 5) + scale[((deg % 5) + 5) % 5]`.
- **Fatigue rule:** semitone scales (in, iwato, hirajōshi) tire and sadden faster. Give yo, ryo and min'yō at least 75% of total time.
- **Free modulations** (four common tones each): yo on D ↔ ryo on G; yo on D ↔ min'yō on B or E. Change every 4–6 minutes, at a section boundary, after a 1–2 bar rest.

### 2.2 Timbres

**Koto, shamisen and bass: offline Karplus-Strong.** Do not build KS from a `DelayNode` feedback loop: a looped delay is at least 128 frames, so pitch tops out near 344 Hz. Render to a buffer and cache it by MIDI note.

```js
const ksCache = new Map();
function ks(midi, kind = 'koto') {
  const key = kind + midi; if (ksCache.has(key)) return ksCache.get(key);
  const P = { koto: { dur: 2.2, decay: 0.997, bright: 0.75, pick: 0.12 },
              shami: { dur: 0.8, decay: 0.990, bright: 0.95, pick: 0.08 },
              bass: { dur: 1.6, decay: 0.996, bright: 0.25, pick: 0.3 } }[kind];
  const sr = ac.sampleRate, f = 440 * 2 ** ((midi - 69) / 12), N = Math.round(sr / f - 0.5);
  const len = P.dur * sr | 0, buf = ac.createBuffer(1, len, sr), o = buf.getChannelData(0);
  const d = new Float32Array(N), e = new Float32Array(N); let lp = 0;
  for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * P.bright; e[i] = lp; }
  const pk = Math.max(1, N * P.pick | 0);                                  // pick-position comb
  for (let i = 0; i < N; i++) d[i] = e[i] - e[(i - pk + N) % N];
  let idx = 0, prev = 0, peak = 0;
  for (let i = 0; i < len; i++) { const cur = d[idx]; o[i] = cur; d[idx] = P.decay * 0.5 * (cur + prev); prev = cur; if (++idx >= N) idx = 0; if (Math.abs(cur) > peak) peak = Math.abs(cur); }
  const fade = 0.03 * sr | 0;
  for (let i = 0; i < len; i++) o[i] *= (0.8 / peak) * (i > len - fade ? (len - i) / fade : 1);
  const v = { buf, rate: f * (N + 0.5) / sr };       // exact-tuning correction for the integer delay
  ksCache.set(key, v); return v;
}
function pluck(midi, t, vel = 0.6, kind = 'koto', bendSemis = 0) {
  const k = ks(midi, kind), s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = k.buf; s.playbackRate.setValueAtTime(k.rate, t);
  if (bendSemis) { s.playbackRate.setValueAtTime(k.rate, t + 0.06);                 // koto "oshide" bend
    s.playbackRate.linearRampToValueAtTime(k.rate * 2 ** (bendSemis / 12), t + 0.22); }
  g.gain.value = vel; s.connect(g); g.connect(musicBus);
  const r = ac.createGain(); r.gain.value = 0.35; g.connect(r); r.connect(revSend);
  s.start(t); s.onended = () => g.disconnect();
}
```

- Lazy rendering costs about 1–3 ms per note, which is fine inside the scheduler's lookahead. Alternatively pre-warm about 20 notes in idle slices at init.
- Memory is about 2.2 s × 48k × 4 bytes ≈ 420 KB per koto note. Cap the cache at about 25 notes (~10 MB), or render at half length for notes above MIDI 76.
- **Shamisen:** add a 12 ms band-passed noise "bachi" slap (3 kHz, Q 2, gain 0.3) at note start. For the sawari buzz, soft-clip before output with `tanh(2.5 * x)`.
- **Koto ornaments:** grace note one scale degree below, 40 ms before the main note at velocity 0.4. Use a +1 or +2 semitone bend on about 8% of long notes. Octave-doubled "sararin" glissando (5–8 descending scale notes at 35 ms spacing) as a section opener.

**Shakuhachi** (live nodes; at most one voice at a time):
- Tone: sine at `f` plus triangle at `f` (gain 0.25) plus sine at `2f` (gain 0.08).
- Breath: pink noise through a band-pass at `f * 2`, Q 6, gain 0.12, plus a band-pass at `f`, Q 12, gain 0.1.
- Amp envelope: attack 90–160 ms, sustain, release 250 ms. Breath noise gets an extra 60 ms burst at onset (gain 0.35, exponential fall to 0.1): the "muraiki" chiff.
- Pitch scoop: start 60–80 cents flat and reach pitch in 120 ms (`detune.setValueAtTime(-70, t)`, `.linearRampToValueAtTime(0, t + 0.12)`). End-of-phrase fall: −40 cents over the last 200 ms.
- Vibrato: an LFO at 4.8 Hz into `detune`, depth ramping 0 → 18 cents starting 300 ms after onset ("yuri").
- Register: MIDI 62–81. Notes last 1.5–4 beats. Leave long silences between phrases.

**Taiko and percussion** (pre-render with `renderSfx` + `mixBufs`):

| Hit | Recipe |
|---|---|
| Ō-daiko "don" | sine 120 → 52 Hz (exp, 90 ms), amp decay 0.7 s; plus sine 180 → 90 Hz, decay 0.15 s, gain 0.4; plus noise LP 900 Hz, 25 ms, gain 0.5; soft-clip `tanh(1.5x)` |
| Chū-daiko | sine 190 → 110 Hz in 60 ms, decay 0.35 s; noise LP 1500 Hz, 20 ms |
| Shime-daiko "ten" | sine 420 → 330 Hz in 30 ms, decay 0.12 s; noise BP 1800 Hz Q 1.5, 45 ms, gain 0.6 |
| Rim "ka" | noise BP 2600 Hz Q 8, 22 ms; plus square 1150 Hz, 10 ms |
| Atarigane "chan/chiki" | squares 2217 + 3136 + 4435 Hz, HP 1500; open decay 0.18 s, muted 0.04 s |
| Hyōshigi clap | two triangle clicks at 1450 and 2150 Hz, decay 60 ms, HP 800 |
| Fūrin (wind chime) | sines at f × [1, 2.76, 5.40, 8.93], f = 2100–3300 Hz, gains [1, 0.5, 0.25, 0.1], decays [2.2, 1.4, 0.8, 0.4] s, reverb send 0.6; random every 8–25 s, very low gain |
| Suikinkutsu drop | sine 1800 → 2400 Hz (up-chirp, 40 ms), decay 0.5 s, heavy reverb |

**Pad / drone ("shō-like").** Per chord, use 3 voices, each 2 detuned triangles (±4 cents) through a low-pass at 900–1400 Hz. Attack 2.5 s, release 4 s. Modulate the cutoff slowly with an LFO at 0.05 Hz, ±300 Hz. Voice the chord as root, fifth, and ninth or fourth (stacked fifths and seconds are the shō sound). Gain 0.05–0.08 per voice. That is 6 oscillators total, the main permanent oscillator cost. Crossfade to a new voice set on chord change and stop the old set after its release.

### 2.3 Lookahead scheduler (Chris Wilson pattern)

A coarse JS timer wakes every ~25 ms and schedules every step that falls inside the next `ahead` seconds, using sample-accurate `ac.currentTime` times. Never use the timer's own time as a note time.

```js
const Music = (() => {
  let timer = 0, nextT = 0, step = 0, bar = 0, bpm = 76, intensity = 0, target = 0, theme, st;
  const LOOK = 25, AHEAD = 0.15;                 // ms, s (0.15 tolerates main-thread jank from canvas)
  function start(name) { theme = THEMES[name]; st = newState(theme); bpm = theme.bpm;
    nextT = ac.currentTime + 0.1; step = 0; bar = 0;
    clearInterval(timer); timer = setInterval(tick, LOOK); }
  function tick() {
    if (ac.state !== 'running') return;
    if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.05;   // resync after tab throttling: skip, don't burst
    while (nextT < ac.currentTime + AHEAD) {
      if (step === 0) onBar(bar, nextT);
      onStep(step, bar, nextT);
      const sixteenth = 60 / bpm / 4;
      const swing = (step % 2 ? -1 : 1) * sixteenth * (theme.swing || 0);  // 0..0.12
      nextT += sixteenth + swing;
      if (++step === 16) { step = 0; bar++; }
    }
  }
  function stop() { clearInterval(timer); }
  return { start, stop, setIntensity: v => { target = Math.max(0, Math.min(1, v)); }, /* ... */ };
})();
```

- **Hidden tab.** Browsers throttle `setInterval` to 1 Hz or slower, so music stutters. On `visibilitychange` to hidden, fade `musicBus` to 0 in 0.3 s and `ac.suspend()`. On visible, `ac.resume()` and let the scheduler resync.
- If background audio is ever wanted, drive `tick` from a Web Worker timer and raise `AHEAD` to 1.2 s.
- A UI playhead is not needed. To sync visuals to beats (a lantern pulse on "don"), push `{time, type}` to a queue and consume it in `requestAnimationFrame` when `ac.currentTime >= time`.

### 2.4 Composition engine: repetition with variation

Random notes from a scale sound aimless within about 2 minutes. Use this structure instead:

- **Form.** Sections of 8 bars. Each section has a **motif A** (2 bars) and a **motif B** (2 bars), laid out `A A' B A'` or `A B A' rest`.
- **Motif persistence.** At each new section: keep the motif unchanged 40% of the time, mutate 1–3 notes 35%, generate a new one 25%.
- **Chord per bar** (a bass or drone degree, as an index into the 5-note scale). Progressions, 4 bars looped twice:
  - yo and ryo: `[0,0,3,2]`, `[0,4,2,3]`, `[0,2,3,0]`, `[0,3,4,2]`
  - min'yō and hirajōshi: `[0,0,2,3]`, `[0,3,2,0]`, `[0,4,3,0]`
  - Any pentatonic note is consonant over any of these roots, so no chord-tone checking is needed.
  - Pad chord: scale indices `[r, r+2, r+4]` (pentatonic "thirds", giving sus and quartal colours), bass an octave down.
- **Rhythm templates.** Pick a mask per motif, then thin it by density:
  - Euclidean generator: `const euclid = (k, n, rot = 0) => Array.from({length: n}, (_, i) => ((i + rot) * k) % n < k);`
  - Melody: E(5,16), E(7,16), E(3,8)×2, E(5,8)×2, or hand masks `x...x.x.x...x...` and `x..x..x.x...x.x.`
  - Shime: E(3,8) (tresillo), E(5,16), E(7,16) rotated by 2.
  - Taiko don: steps 0 and 8, plus 60% chance at step 11 or 14. Classic matsuri "don-don-ka-ka": don at 0 and 4, ka at 8, 10, 12.
  - Kane: E(9,16) at intensity above 0.8.
- **Melody pitch: first-order Markov on scale-degree steps.**

| Step | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +4 (octave leap) |
|---|---|---|---|---|---|---|---|---|
| Prob. | 0.04 | 0.14 | 0.28 | 0.08 | 0.26 | 0.13 | 0.04 | 0.03 |

  - Range: degrees 0–11 (about 2.2 octaves from the root at koto register, MIDI 62–88). Reflect at the bounds.
  - After a leap of 3 or more, force the next step to be −1 or +1 in the opposite direction.
  - On strong beats (steps 0 and 8), 60% chance to snap to a chord tone (`r`, `r+2`, `r+4` mod 5).
  - Last note of a section: snap to the tonic (degree 0, 5 or 10), duration 4 beats or more.
- **Motif mutations.** Transpose all notes by ±1 degree; reverse the pitch order while keeping rhythm; drop one note; double one note into two eighths; or octave-shift the second half.
- **Call and response.** When the shakuhachi layer is active, the koto plays bars 1–2 and the shakuhachi answers in bars 3–4 with the koto motif's contour at half speed (every 2nd note, held).
- **Ma (間).** Per section, 30% chance that bars 7–8 have no melody, only pad and a fūrin. Every 3–5 minutes, schedule a "breather" section of 8 bars with pad plus sparse koto harmonics only, regardless of intensity. This is the strongest single anti-fatigue device.
- **Humanize.** Timing ±8 ms, velocity ±15%. Accent step 0 at 1.0, step 8 at 0.85, other on-beats at 0.7, off-beats at 0.5.

```js
function newMotif(th) { const mask = pick(th.melMasks), notes = []; let deg = pick([0, 2, 3, 5]);
  for (let s = 0; s < 32; s++) if (mask[s % 16] && Math.random() < 0.8) { deg = clampReflect(deg + markovStep(), 0, 11); notes.push({ s, deg, len: 2 }); }
  return notes; }
function onBar(bar, t) {
  intensity += (target - intensity) * 0.35;                 // slew: only changes on barlines
  bpm += ((theme.bpm * (1 + 0.14 * intensity)) - bpm) * 0.25;
  const sec = bar % 8; if (sec === 0) newSection();
  st.root = st.prog[bar % 4]; padChord(st.root, t);
  st.cur = sectionLayout(st)[sec >> 1];                      // 'A' | 'A2' | 'B' | null
}
function onStep(s, bar, t) {
  const I = intensity, h = () => (Math.random() - 0.5) * 0.016;
  if (st.cur) for (const n of st.motifs[st.cur]) if (n.s === s + 16 * (bar % 2) && Math.random() < 0.55 + 0.45 * I)
    pluck(deg2midi(n.deg), t + h(), accent(s) * (0.35 + 0.3 * I), 'koto');
  if (I > 0.15 && (s === 0 || (s === 8 && I > 0.3))) pluck(deg2midi(st.root) - 24, t, 0.5, 'bass');
  if (I > 0.35 && st.shime[s]) drum('ten', t + h(), accent(s) * 0.5);
  if (I > 0.55 && st.don[s]) drum('don', t, 0.8);
  if (I > 0.55 && s % 2 === 0 && st.ost[s >> 1] != null) pluck(deg2midi(st.ost[s >> 1]) - 12, t + h(), 0.3, 'shami');
  if (I > 0.8 && st.kane[s]) drum(s % 4 === 0 ? 'chan' : 'chiki', t + h(), 0.25);
}
```

### 2.5 Intensity layers

`Music.setIntensity(0..1)` comes from gameplay, for example `clamp(0.15 * toolTier / maxTier * 4 + 0.5 * comboFrac + 0.2 * automationFrac, 0, 1)`. Smooth it in game code as well, with a time constant of about 5 s.

| Intensity | Active layers | Notes |
|---|---|---|
| 0.00–0.15 | pad drone, fūrin, koto at 55% density | paw / chopsticks era, idle |
| 0.15–0.35 | plus bass pluck on beat 1 (and 3), koto denser | bowl / shovel |
| 0.35–0.55 | plus shime-daiko euclid, shakuhachi answers | wheelbarrow / tractor |
| 0.55–0.80 | plus ō-daiko don, shamisen 8th-note ostinato, koto octave doubling on A' | excavator / trucks |
| 0.80–1.00 | plus kane, taiko fills at bar 8 (16ths crescendo), tempo +14% | Bagger 293 / frenzy / combo max |

- Layers fade in and out over 1–2 bars via per-layer `GainNode`s (`setTargetAtTime(v, t, 0.8)`); do not hard-switch them.
- Use hysteresis: enable at the threshold, disable at threshold − 0.07.
- **Stingers.** For a tool purchase, the gold sack or buying the house, quantize the stinger to the next 8th note (`nextT`) and play it in the current scale so it lands musically.
- **Themes:**

| Theme | Scale and key | BPM | Character |
|---|---|---|---|
| `inaka` | yo on D | 76 | default farm |
| `kikai` | min'yō on E | 88 | machines: heavier don, shamisen lead |
| `matsuri` | ryo on G | 104 | frenzy / bonus, swing 0.08 |
| `yoru` | hirajōshi on A | 60 | night / away screen, no drums |
| `ie` | ryūkyū on C | 92 | ending: house bought |

  Crossfade themes over 2 bars at a section boundary.

### 2.6 Fatigue checklist

- Music sits about 8–10 dB below SFX. Music bus low-pass at 7.5 kHz. Nothing sustained in the 2–5 kHz band.
- No element repeats identically more than 4 times. Per-note velocity and timing are humanized.
- Rests are built in (ma bars and breather sections). The key or scale rotates every 4–6 minutes. The pad voicing inverts on each chord repeat.
- Slow global "weather": every 90–150 s, random-walk `melDensity` (0.45–0.9) and the reverb send (0.2–0.4), and choose the lead (koto 70%, shamisen 15%, koto with shakuhachi 15%).
- Ship separate music and SFX volume sliders, with music defaulting to about 60%.

---

## 3. Sound-design recipes

All one-shots are pre-rendered with `renderSfx` / `mixBufs`, 3–4 variants each. Format: layers → DEFS settings.

### Hand tools

**`dig_paw`** (paw in rice grains; dry, granular, soft):
- Body: noise, f0 5000 → 3000, a 0.003, s 0.02, d 0.05, hpf 1800, vol 0.35.
- Grains: 4–7 micro-clicks, each noise f0 7000–10000, d 0.004–0.008, at random offsets 0–90 ms, gain 0.15–0.3.
- Thump: sine 150 → 85 Hz, d 0.05, vol 0.18.
- DEFS: gate 0.045, max 4, jit 2.5.

**`dig_hashi`** (chopsticks click):
- Click 1: triangle 2100 Hz, a 0, s 0.002, d 0.014, plus noise f0 6000, d 0.006.
- Click 2 at 40–55 ms: triangle 2450 Hz, same shape, gain 0.8.
- Single rice "tik" at 70 ms: sine 3800 → 3200, d 0.01, gain 0.3.
- DEFS: gate 0.06, jit 1.

**`dig_bowl`** (ceramic scoop):
- Swoosh: noise f0 2500 → 5500 (rising), a 0.02, s 0.05, d 0.08, hpf 1200, vol 0.3.
- Ting at 90 ms: sines 1320, 2890 and 4950 Hz (ratios 1 : 2.19 : 3.75), gains 0.3, 0.15, 0.06, d 0.28, 0.2, 0.1.
- DEFS: reverb 0.15.

**`dig_shovel`:**
- Stab/scrape: noise f0 900 → 2600, a 0.005, s 0.06, d 0.09, lpf 5000, vol 0.4.
- Metal ring: sines 1130 and 2640 Hz, d 0.09, gain 0.15.
- Thud: sine 110 → 60, d 0.09, gain 0.35.
- Toss at 180 ms: noise f0 6000, hpf 3000, a 0.03, d 0.2, gain 0.2 (rice landing).

**`barrow_squeak`** (triggered once per wheel revolution while moving):
- Sine 1500 → 1950 → 1600 Hz over 0.16 s (two-segment sweep), vib 0.04 at 28 Hz, a 0.02, d 0.05, vol 0.12.
- Every other revolution use a variant at ×0.94 pitch.

**`barrow_dump`:** noise f0 3000 → 6000, a 0.05, s 0.25, d 0.4, hpf 2000 (the rice "shaaa"), plus a wooden clunk (triangle 320 → 180, d 0.06).

### Engine loops

Render each as a seamless loop buffer; play with one `BufferSource` and a biquad filter. For a seamless loop, render `L + 0.1` s and crossfade the last 0.1 s into the first 0.1 s with equal-power fades.

**Tractor diesel (single-cylinder Kubota-style "pon-pon-pon").** One loop is 8 firing pulses at a base 14 Hz firing rate, so L = 8/14 s. Each pulse has:
- sine thump 95 → 55 Hz, decay 45 ms, gain 0.9;
- brown noise LP 500 Hz, decay 30 ms, gain 0.5;
- an exhaust "tk": noise BP 1400 Hz, 8 ms, gain 0.15.

Jitter pulse amplitude ±12% and timing ±2 ms; that jitter is the "alive" quality. Add a mechanical rattle bed: white noise BP 2200 Hz Q 0.8, gain 0.04, amplitude-modulated at the firing rate. `setRate(r)`: `playbackRate = 0.8 + 1.4 * r` (idle about 11 Hz, full rev about 31 Hz); post-filter low-pass cutoff `600 + 2400 * r`; gain `0.5 + 0.3 * r`.

**Excavator** = a diesel loop plus a hydraulic layer.
- Diesel: 4-cylinder feel. 16 pulses per loop at base 26 Hz, less amplitude jitter (6%), every 4th pulse +15%. Thump 80 → 50 Hz. Add continuous brown noise LP 180 Hz, gain 0.2.
- Hydraulic whine (live nodes, only while the arm moves): saw at `f` plus saw at `1.503f`, into a band-pass at `2f` (Q 5), gain 0.05; `f` = 380 Hz at rest, up to 720 Hz under load, glided with `setTargetAtTime(f, t, 0.12)`. Add white noise HP 3500, gain 0.02.
- On stop: pitch falls to 0.6f in 150 ms, then a "psst" (noise HP 4500, a 0.005, d 0.14, vol 0.2).
- Bucket servo "eeee-unk": on stop, add a thunk (sine 90 → 50, d 0.08).

**Haul truck (giant dump truck).**
- Diesel: 24 pulses per loop at base 36 Hz, jitter 4% (smooth V12-like rumble). Add a sub sine at half the firing rate (18 Hz base; use 36 Hz on phone speakers, with harmonics from `tanh` saturation so it stays audible).
- Turbo: sine at `2800 + 3500 * r` Hz, gain `0.004 + 0.02 * r²`, slight vibrato.
- Tire/gravel: brown noise BP 300 Hz, gain ∝ speed.
- `truck_beep` (reversing, comedic): square 1050 Hz, 0.4 s on / 0.4 s off, LP 3000, gain 0.08.
- `truck_dump`: 1.2 s rising hydraulic whine, then a long rice avalanche (pink noise HP 1500, a 0.2, s 0.8, d 1.2) plus a low rumble.
- `truck_horn`: saws at 311 and 370 Hz, LP 1500, 0.5 s.

**Bagger 293** (the star: huge, slow, metallic, slightly ridiculous). Render it as one 8–12 s stereo loop through `OfflineAudioContext` so runtime cost is a single buffer source. Layers:

1. **Sub drone:** saws at 31 and 31.3 Hz (beating), plus sine at 62 Hz, into LP 140 Hz, gain 0.5. Add `tanh` saturation so phones can reproduce it.
2. **Metallic groan (signature):** brown noise into 5 parallel band-pass resonators at 87, 143, 211, 318 and 467 Hz (inharmonic), Q 35–50, gains 0.5, 0.4, 0.35, 0.25, 0.15. Each resonator frequency is modulated by its own LFO at 0.07–0.19 Hz, ±3–5%; each gain by an LFO at 0.05–0.11 Hz between 0.2 and 1. The result is a slow, whale-like steel-stress moan. Add an occasional "screech" by sweeping one resonator from 620 to 540 Hz over 1.8 s, about once per loop.
3. **Conveyor hum:** squares at 50 and 100 Hz, LP 380 Hz, gain 0.12 (electric motors). Roller rattle: white noise BP 1300 Hz Q 1.2, gain 0.05, amplitude-modulated by an 11 Hz saw LFO at depth 0.6.
4. **Bucket clanks** (one-shots scheduled outside the loop so they sync to the wheel animation, one per bucket crossing the dig point):
   - `bagger_clank` = sines at f0 × [1, 1.59, 2.31, 3.13, 4.27], f0 = 170–240 Hz, gains [1, 0.6, 0.45, 0.3, 0.2], decays [0.7, 0.5, 0.35, 0.2, 0.12] s;
   - plus a noise click (f0 3000, d 0.012);
   - plus a rice-scoop hiss (noise HP 2500, a 0.05, d 0.35, gain 0.25).
   - Reverb 0.4; pan follows wheel position; gate 0.12.
5. **Rice river:** pink noise HP 2800, gain 0.1, amplitude-modulated by slow random (LP-filtered noise at 3 Hz), continuous on the conveyor.
6. **`bagger_horn`** (on purchase, and when Kome honks): saws at 92, 116 and 138 Hz (a low triad), LP 900 → 1800 opening over 0.3 s, 1.6 s long with a 0.25 s release, reverb 0.5, duck 0.5. Follow it with a tiny Kome "wan!" (bark: saw 520 → 380 Hz in 70 ms through BP 1200 Q 3, with a 10 ms noise onset) for the scale joke.

`setRate(r)` for the Bagger changes pitch only slightly, because a huge machine does not rev: `playbackRate = 0.92 + 0.16 * r`; loop gain `0.35 + 0.4 * r`; clank interval comes from the game. Sidechain-duck the music 2–3 dB while the Bagger loop is active (see ducking, section 4).

### Loop API

```js
class Loop {
  constructor(buf, { vol = 0.5, lp = 20000 } = {}) { this.buf = buf; this.vol = vol; this.lp0 = lp; this.on = false; }
  start(fade = 0.4) { if (this.on || !ac) return; this.on = true; const t = ac.currentTime;
    this.src = ac.createBufferSource(); this.src.buffer = this.buf; this.src.loop = true;
    this.f = ac.createBiquadFilter(); this.f.type = 'lowpass'; this.f.frequency.value = this.lp0;
    this.g = ac.createGain(); this.g.gain.setValueAtTime(0, t); this.g.gain.linearRampToValueAtTime(this.vol, t + fade);
    this.src.connect(this.f); this.f.connect(this.g); this.g.connect(loopBus);
    this.src.start(t, Math.random() * this.buf.duration); }          // random phase so 2 loops don't flam
  setRate(r, tc = 0.15) { if (!this.on) return; const t = ac.currentTime, m = this.map ? this.map(r) : { rate: 0.8 + 1.4 * r, lp: 600 + 2400 * r, vol: this.vol * (0.6 + 0.4 * r) };
    this.src.playbackRate.setTargetAtTime(m.rate, t, tc); this.f.frequency.setTargetAtTime(m.lp, t, tc); this.g.gain.setTargetAtTime(m.vol, t, tc); }
  stop(fade = 0.5) { if (!this.on) return; this.on = false; const t = ac.currentTime, { src, g, f } = this;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade);
    src.stop(t + fade + 0.02); src.onended = () => { g.disconnect(); f.disconnect(); }; }
}
// Loops.get('tractor').start(); Loops.get('tractor').setRate(0.7); Loops.get('tractor').stop();
```

- **Engine realism.** Add inertia in game code: `rate += (targetRate - rate) * dt * 2.5`. Give a short rev blip on click (`setRate(min(1, r + 0.3))`, then decay back).
- **Budget.** At most 3 loops audible at once. When many machines are owned, play only the top 2 tiers plus one "rice cascade" loop whose gain = `log10(1 + riceRate) / k`.

### UI and reward sounds

**`coin`** (yen "charin"):
- Square 988 Hz (B5) for 0.05 s, then `arp` 1.335 → 1319 Hz (E6), d 0.32, duty 0.5, vol 0.25, lpf 6000.
- Sparkle layer: sine 3951 Hz, d 0.2, gain 0.08.
- Better: play it at `Music.scaleFreq(deg)` so successive coins climb the current scale and wrap after 8.
- DEFS: gate 0.08, max 3.

**`combo(n)`:** a koto pluck at scale degree `n` (0 up to about 14) of the current music scale, velocity `0.4 + 0.02n`. At the maximum combo, play a two-octave "sararin" glissando plus the shime hit.

**`gold`** (golden grain / crit):
- 3-note rising arpeggio of sines with a slight FM bell (mod ratio 3.5, index 2 → 0): degrees 0, 2, 4 an octave up at 60 ms spacing, d 0.6.
- Shimmer: noise HP 6000, a 0.05, d 0.5, gain 0.06.
- DEFS: reverb 0.4, duck 0.3.

**`buy`:** wooden "kachi" (hyōshigi clap) plus a rising fifth of koto plucks (D5, A5, 70 ms apart), then a cash "cha" (noise HP 4000, d 0.05).

**`buy_big`** (new tool tier):
- Ō-daiko don;
- a gong: sines 110 × [1, 1.48, 2.09, 2.72, 3.4, 4.1], decays 3.5 → 1 s, with ±0.4% detuned copies so it beats;
- a koto ascending run (6 scale notes, 55 ms spacing).
- DEFS: duck 0.6, reverb 0.5.

**`levelup` jingle** (about 1.1 s, quantized to the next 8th note): koto notes on scale degrees `0, 2, 3, 4, 5(octave)` at 80 ms spacing, then a chord `[5, 7, 9]` strummed at 25 ms offsets, with a shime "ten-ten" under the last two and a fūrin on the last.

**`sack_shake`:** noise f0 1500 → 2200, a 0.004, d 0.03, lpf 4000, vol 0.2, plus burlap rub (noise f0 500, d 0.04, gain 0.15). DEFS: gate 0.07.

**`sack_pop`:**
- Pop: sine 380 → 950 Hz in 0.05 s, d 0.03, punch 0.4, vol 0.5.
- Burst: noise f0 2000, lpf 2500, d 0.05, gain 0.5.
- Rice shower at 30 ms: noise f0 7000, hpf 3000, a 0.01, s 0.05, d 0.4, gain 0.3.
- 6 random grain ticks between 100 and 450 ms.
- DEFS: reverb 0.2.

**`stomp` / `big`** (Patada Sísmica): sine 90 → 35 Hz, d 0.5, punch 0.5; noise LP 400, d 0.25; debris hiss 0.6 s. DEFS: duck 0.5.

**`deny`** (can't afford): square 196 Hz for 70 ms, a 30 ms gap, square 147 Hz for 110 ms, lpf 1200, vol 0.2.

**`ui_tick`** (hover / tab): triangle 1800 Hz, d 0.015, vol 0.1.

**`oni_hit`:** shime "ten" plus a descending iwato triplet on shamisen.

**`house_bought`** (ending fanfare): switch the theme to `ie`, play a taiko roll (accelerating dons 200 → 60 ms over 1.5 s, crescendo), the gong, a two-octave koto glissando up, and three fūrin.

---

## 4. Mixing, unlock and performance

**Gain staging.** Each one-shot's peak in its buffer should be 0.3–0.6. Bus gains are as in section 0. The compressor (−16 dB, 4:1) should show under 6 dB reduction in normal play; check `comp.reduction` in the console while spamming clicks. If it pumps constantly, lower `sfxBus`. `DynamicsCompressorNode` used as a limiter is imperfect, so the true safety is conservative bus gains. Avoid hard clipping at the destination; mobile speakers distort early.

**Ducking** (manual sidechain on the music bus):

```js
function duck(depth = 0.5, rel = 0.9) { const t = ac.currentTime, g = musicBus.gain, base = Audio.musicVol;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(base * (1 - depth), t + 0.04);
  g.setTargetAtTime(base, t + 0.15, rel / 3); }
```

Use it on `buy_big`, `gold`, `bagger_horn`, `stomp` and `levelup` (depth 0.3–0.6). Also apply a static −2 to −3 dB music offset while heavy loops are running.

**Frequency slotting.** Engines sit below 600 Hz with a little above 1 kHz. Music lives mostly in 200 Hz–4 kHz. Rice and grain SFX sit at 3–9 kHz. Coins and bells sit at 1–4 kHz and are short. Because rice sounds are high and frequent, keep them quiet (−10 dB relative to coins) or they hiss fatiguingly.

**Mobile autoplay unlock:**

```js
function unlock() {
  init();
  if (ac.state !== 'running') ac.resume();
  const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0); // iOS kick
  if (navigator.audioSession) try { navigator.audioSession.type = 'playback'; } catch (e) {}   // newer iOS Safari: ignore the silent switch
}
['pointerdown', 'touchend', 'keydown'].forEach(ev => addEventListener(ev, unlock, { passive: true }));  // keep attached: iOS can re-suspend
document.addEventListener('visibilitychange', () => { if (!ac) return;
  if (document.hidden) { ac.suspend(); } else if (!Audio.muted) ac.resume(); });
```

- iOS can put the context into `'interrupted'` after calls, Siri or tab switches. Keep the listeners attached permanently; `resume()` is idempotent.
- Start music only after a `resume()` promise resolves: `ac.resume().then(() => Music.start('inaka'))`.
- Show an "🔊 toque para ativar o som" hint if `ac.state !== 'running'` after first render.
- The context sample rate may be 44.1k or 48k; always use `ac.sampleRate`.

**Mute.** `master.gain.setTargetAtTime(muted ? 0 : 0.8, t, 0.03)`. After 0.3 s of mute, `ac.suspend()` to save battery. On unmute, `resume()` then ramp up. Persist `{muted, musicVol, sfxVol}` in `localStorage`. Keep the existing `Sfx.muted` property as a getter/setter.

**Performance pitfalls:**
- Pre-render buffers instead of live oscillators for anything frequent. Keep live oscillators to about 16 at most: pad 6, shakuhachi 5, hydraulic 3.
- Every `BufferSource` or `Oscillator` must be given `stop()`, and its downstream gain/panner disconnected in `onended`. A node left connected and running is never garbage-collected.
- Do not create more than about 30 nodes per second in steady state; the gates and voice caps enforce this.
- Never call `exponentialRampToValueAtTime(0, …)`; use 0.0001. Before a new ramp, call `cancelScheduledValues(t)` and `setValueAtTime(param.value, t)`. Do not rely on `cancelAndHoldAtTime` (Firefox support is doubtful).
- Use `setTargetAtTime` for all continuous control (rate, intensity, ducking). It is click-free and interruptible.
- No `ScriptProcessorNode`. `AudioWorklet` is not needed.
- Use one shared `ConvolverNode` with an IR of 1.6 s or less. On low-end phones, bypass the reverb when `navigator.hardwareConcurrency <= 4`, or replace it with two feedback delays (0.11 s and 0.17 s, feedback 0.35, LP 3 kHz).
- Rendering all SFX in JS at init takes roughly 50–150 ms. Do it lazily (render on first `play`, then cache) or in chunks with `setTimeout` or `requestIdleCallback`, to avoid a first-click hitch. KS notes render lazily inside the scheduler's lookahead.
- `OfflineAudioContext` rendering of the engine and Bagger loops is asynchronous (`await off.startRendering()`). Start it at unlock; a loop's `start()` before it is ready should just set a pending flag.
- Pass explicit times (`t`) to all scheduled starts. Never schedule in the past; clamp with `Math.max(t, ac.currentTime)`.
- Throttle Markov and motif generation to barlines. `tick()` must stay under 1 ms.

---

## 5. Suggested public API

```js
window.KomeAudio = {
  init, unlock,                       // idempotent
  Sfx: { play(name, opts /* {pitch (semitones), vol, pan, rate, delay, deg (scale degree)} */),
         gate(key, ms),               // legacy helper kept
         define(name, def),           // register custom sfxr params or layered recipe (engine reuse in other games)
         // legacy aliases: dig(p, big), combo(n), coin(), gold(), buy(), big(), shake(), pop()
         get muted() {}, set muted(v) {} },
  Music: { start(theme), stop(fade), setIntensity(x), setTheme(theme /* crossfade at section */),
           stinger(name), scaleFreq(deg), onBeat(cb) /* visual sync */, volume },
  Loops: { get(name) /* -> Loop {start, stop, setRate} */, define(name, renderFn, mapFn) },
  setVolume({ master, music, sfx }), mute(bool),
};
```

**Engine reusability.** Keep THEMES, the scale table, the SFX recipe table and the loop recipes as plain data objects. Another project, such as a koi-pond game, then only supplies a new theme (for example `{scale: 'hirajoshi', root: 57, bpm: 58, layers: {...}}`) and a few `Sfx.define` recipes (water plips: sine up-chirp 600 → 1400 Hz in 50 ms with reverb 0.5).

**Suggested mapping from draft tool tiers to audio:**

| Tool tier | Dig SFX | Loop | Intensity floor |
|---|---|---|---|
| paw | `dig_paw` | — | 0.00 |
| chopsticks | `dig_hashi` | — | 0.05 |
| bowl | `dig_bowl` | — | 0.12 |
| shovel | `dig_shovel` | — | 0.20 |
| wheelbarrow | `dig_shovel` + `barrow_squeak` / `barrow_dump` | — | 0.30 |
| tractor | chuff accent | `tractor` | 0.42 |
| excavator | hydraulic one-shot + thunk | `excavator` | 0.55 |
| haul truck | `truck_dump` | `truck` | 0.68 |
| Bagger 293 | `bagger_clank` per bucket | `bagger` | 0.80, music theme `kikai` |