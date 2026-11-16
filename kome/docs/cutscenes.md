# Cutscene pipeline for Pixxel (Dave the Diver-style staging)

Nothing was modified. Draft read at `/tmp/claude-0/-home-user-Pizzaria-Site/73bb5c4b-e898-5ba0-a571-a9a62e6621c9/scratchpad/zip/engine.js` (plus `game.js`, `PIXXEL.md`).

## 1. Research findings

**Sourcing caveat:** web research gave little on Dave the Diver's actual staging. The sourced facts are in 1.1. The staging vocabulary in 1.2 is from my own recall of the game, not from pages I fetched. The timing numbers in section 4 are my synthesis of general animation practice, not measurements from DtD.

### 1.1 Sourced
- **Cutscenes were added late, to sell personality fast.** Mintrocket did not plan them at first; they borrowed from anime and film "to make a strong impact in a short amount of time" (tech4gamers interview).
- **They are short and built around one joke, surprise or over-the-top cooking moment.**
- **Variants fight repetition.** One reviewer counts two to four cutscenes per recurring event (new dish, upgrade), so the same animation does not repeat (The Pixels).
- **Repetition is the known enemy.** Hwang: "our game has repetition"; the balance is credited to a single cutscene director's feel (Inven Global). One critic reached for the skip button after about the second viewing (Epilogue Gaming). So: skip always, and never replay a full cutscene for a recurring event.
- **The humour comes from manga-style "pop-eyed reaction shots"** (Inven Global) and from over-the-top anime energy applied to mundane acts (GamesRadar, Yahoo).
- **Characters are frame-by-frame pixel sprites over non-pixel backgrounds**; the camera work used Unity Cinemachine (Minsuk Cha).
- **General timing guidance:** hold anticipation longer than is comfortable; a quick gesture is 6-8 frames; a reaction is 8-12 frames plus a hold; always hold on the aftermath of a physical gag; mark holds explicitly ("HOLD 2 BEATS").

### 1.2 Staging vocabulary (from recall, unverified)
1. **Mundane act, epic treatment.** Bancho slicing a fish gets a shonen-finisher treatment: dark background, glint on the blade, speed lines, a kanji slam, then a deadpan plated dish. The joke is the gap between stakes and treatment.
2. **Character intro freeze frame.** Mid-action freeze, desaturate or flat-colour background, name card slams in with a one-line descriptor, hold, then resume.
3. **Extreme close-up with detail escalation.** The camera punches in on eyes or hands and the sprite gets more detailed than gameplay art. For us: a dedicated 96 px "hi-res" Kome face.
4. **Speed lines and impact frames.** Radial lines for shock or focus, parallel lines for motion, a 1-2 frame white or inverted flash on the hit.
5. **Letterbox.** Bars slide in to say "this is cinema now"; they snap out for the punchline.
6. **Smash cut.** Hard cut with zero transition from maximum hype to a deadpan wide shot, usually silent.
7. **Reaction shot.** Pop eyes, sparkles, a radiant background, then cut back to normal.
8. **Big typography.** Chunky outlined text that slams in at 2-3x scale with a shake, often with Japanese text for flavour.
9. **Sound does half the work.** Music cuts out before the punchline; one dry sfx lands on the hit.

## 2. Design principles for our engine
- **Every shot is a pure function of local time `t`.** No accumulated state inside shots. This makes skip, scrub, replay and screenshot tests trivial (`Cutscene.seek(id, shotIndex, t)`).
- **A shot is a self-contained mini-scene** with its own camera, background, actors and overlays. It never touches gameplay state. Gameplay pauses and `onEnd` applies consequences.
- **Reuse engine pieces:** `drawShiba` poses, `sprite()`/`Pix` art, `Camera` maths, `Particles`, `Sfx.tone/noise`. The cutscene module owns one extra `Camera` and one `Particles` instance.
- **Three tiers per event, to respect repetition:**
  - `full`: first time only, 8-25 s.
  - `sting`: repeats, 1.2-2.5 s, usually the last shot of the full version.
  - `none`: just a toast.
- **Skip everywhere.** Click or space advances a `hold: 'click'` shot or fast-forwards the current shot to its end. Hold Esc or a long press for 0.5 s skips everything. `onEnd` must run identically on skip.
- **Text is canvas text** in a pixel font with a 1 px `LINE` (#3B2818) outline, rendered in screen space. No emoji.

## 3. Declarative format

```js
Pixxel.Cutscene.define('bagger_reveal', {
  tier: 'full', sting: 'bagger_sting',     // sting = short version for replays
  letterbox: true,                         // default for all shots
  music: 'duck',                           // 'duck' | 'stop' | 'keep' | track id
  shots: [
    {
      id: 'wide',
      dur: 3.2,                            // seconds; omitted = longest track
      hold: 'auto',                        // 'auto' | 'click' | 'min:0.8' (click allowed after 0.8s)
      in:  { type: 'cut' },                // cut | fade | flash | wipe | iris | smash
      out: { type: 'smash' },              // smash = cut + kill audio + 2 frames of black
      bg:  { kind: 'sky', pal: 'dawn' },   // or a function (g, t, shot)
      cam: [                               // keyframes; values interpolate, ease applies arriving at the key
        { t: 0,   x: 0,   y: -40, z: 4 },
        { t: 2.6, x: 0,   y: -300, z: 0.35, ease: 'inOutCubic' },
        { t: 2.6, shake: 10 },             // shake is an impulse that decays
      ],
      layers: [                            // back to front; parallax 0 = fixed, 1 = world
        { draw: 'mountain', parallax: 0.6 },
        { draw: 'bagger293', x: 0, y: 0, parallax: 1, tracks: { wheelRot: [{t:0,v:0},{t:3.2,v:2}] } },
      ],
      actors: [
        { id: 'kome', kind: 'shiba', pal: 'kome',
          keys: [
            { t: 0,   x: -200, y: 0, pose: 'sit', face: 1, scale: 1 },
            { t: 1.0, pose: 'surprise', mouth: 'open', squash: 0.25, ease: 'outBack' },
          ] },
      ],
      fx: [                                // time-triggered one-shots and overlays
        { t: 1.0, type: 'speedlines', mode: 'radial', dur: 0.6, focus: 'kome' },
        { t: 1.0, type: 'flash', color: '#fff', dur: 0.08 },
        { t: 1.0, type: 'freeze', dur: 0.12 },         // hitstop: actor/layer time stops, fx continue
        { t: 1.2, type: 'burst', particle: 'star', n: 30, at: 'kome' },
        { t: 0,   type: 'letterbox', to: 1, dur: 0.3 },
        { t: 0,   type: 'tint', color: '#000', a: 0.5 },
        { t: 0,   type: 'desat', a: 1 },               // for freeze-frame intros
      ],
      text: [
        { t: 1.3, kind: 'title', text: 'BAGGER 293', sub: '14.200 toneladas de exagero',
          anim: 'slam', at: 'center', dur: 1.6 },
        { t: 0.2, kind: 'caption', text: 'Isso não cabe na garagem.', at: 'bottom', type: 28 /*chars/s*/ },
        { t: 0.5, kind: 'bubble', who: 'kome', text: '...au?' },
        { t: 0,   kind: 'card', text: 'TRÊS SEMANAS DEPOIS', full: true },  // black full-screen card
      ],
      sfx: [ { t: 1.0, id: 'big' }, { t: 1.3, id: 'slam' }, { t: 0, id: 'musicStop' } ],
    },
  ],
  onEnd: 'unlockBagger',                   // key into a handlers table, or a function
});
```

Field rules:
- **Keyframes** hold the previous value for any field they omit. `pose`, `mouth`, `face` are stepped; `x, y, z, scale, rot, squash, alpha` are interpolated.
- **`at`** accepts `'center' | 'top' | 'bottom' | actorId | {x,y}`. Text is in screen space; actors and layers are in world space.
- **`freeze`** stops the shot's "performance clock" (`tp`) while the "wall clock" (`t`) keeps running for text and fx. Implement as `tp = t - sum(freeze time elapsed before t)`.
- **`draw`** strings resolve through a registry: `Cutscene.registerDrawable('bagger293', (g, props, tp) => ...)`. Game art registers itself, so other Kome projects (a koi pond, say) bring their own drawables and reuse the format unchanged.
- **Variants:** `shots` may be a function `(ctx) => [...]`, or a shot may have `variants: [shotA, shotB]`, picked by `seenCount % n`.

### Transition catalogue
| type | implementation | use |
|---|---|---|
| `cut` | nothing | default; most comedy cuts |
| `smash` | cut + stop all sfx/music + optional 2 black frames (0.033 s) | hype to deadpan |
| `flash` | white rect, alpha 1 to 0 over 0.12 s | impact, reveal |
| `fade` | black alpha over 0.3-0.5 s | time passing, endings |
| `wipe` | diagonal bar sweeps over 0.25 s (hard pixel edge, 8 px steps) | scene change, shop |
| `iris` | circular clip closing on an actor, 0.4 s, pause at r=24 px for 0.3 s | ending gag |
| `whip` | camera x offset +/- 2 screens in 0.12 s with horizontal smear lines | pan between subjects |

### Text animation catalogue
- **`slam`**: scale 3 to 1 in 0.12 s (`outExpo`), then an 8 px shake decaying over 0.2 s; plays sfx `slam`.
- **`type`**: typewriter at 28 chars/s with a blip every 2 chars; a click completes it instantly.
- **`pop`**: scale 0 to 1.15 to 1 in 0.18 s (`outBack`).
- **`stamp`**: rotated -8 degrees, alpha 0 to 1 in 1 frame, red box (for "VENDIDO", "NEGADO").
- **`count`**: number rolls up over `dur`, with digit shake at the end (for prices).

## 4. Minimal runtime API

```js
Pixxel.Cutscene = {
  define(id, def), registerDrawable(name, fn), registerFx(name, fn), handlers: {},
  play(id, {tier, ctx, onEnd}),   // returns false if already seen and no sting exists
  playing,                        // boolean; game loop checks this to pause the sim
  update(dt), draw(g, vw, vh),    // call from the main loop
  input(type),                    // 'advance' | 'skipHold' | 'skipRelease'
  skip(), seek(id, shotIdx, t),   // seek is for debug and thumbnails
  seen: {},                       // persisted in the save: id -> count
};
```

Core loop sketch (around 120 lines when fully written):

```js
function update(dt){
  if(!cur) return;
  const s = cur.shots[cur.i];
  cur.t += dt;
  fireCues(s, cur.prevT, cur.t);                       // sfx + bursts crossing (prevT, t]
  cur.prevT = cur.t;
  const done = cur.t >= s._dur;
  if(done && (s.hold==='auto' || cur.advance)) next();
  if(cur.skipHeld && (cur.skipT += dt) > 0.5) finish(true);
}
function draw(g,vw,vh){
  const s = cur.shots[cur.i], t = Math.min(cur.t, s._dur), tp = perfTime(s,t);
  const c = sampleCam(s.cam, t);                       // {x,y,z,shake}
  g.save(); drawBg(g,s,tp);
  for(const L of s.layers) drawLayer(g,L,c,tp);        // parallax transform per layer
  applyCam(g,c,vw,vh);
  for(const a of s.actors) drawActor(g, sampleKeys(a.keys,tp), tp);
  particles.draw(g); g.restore();
  for(const f of s.fx) drawFx(g,f,t,vw,vh);            // speedlines, tint, flash, letterbox
  for(const x of s.text) drawText(g,x,t,vw,vh);
  drawTransition(g, cur, vw, vh); drawSkipHint(g, cur);
}
```

Implementation notes:
- `sampleKeys(keys, t)`: find the bracketing pair; interpolate numerics with `EASE[k1.ease||'outCubic']`; stepped fields take the last key at or before `t`.
- Camera shake: sum over shake keys of `amp * exp(-6*(t-t0))`, applied as a deterministic pseudo-random offset (`hsh(floor(t*60))`), not `Math.random`, so seek and replay are stable.
- **Speed lines, radial:** 40-60 triangles from outside the screen toward the focus, leaving an empty ellipse around it; re-randomise every 3 frames; colour white or `LINE` at alpha 0.85. **Parallel:** 20 horizontal bars with random length and y, scrolling at 1800 px/s.
- **Letterbox:** two black rects, height `0.12*vh * k`, `k` eased over 0.3 s.
- **Impact frame:** one frame with a white background and all sprites filled with `LINE` (silhouette via `globalCompositeOperation='source-atop'` on an offscreen canvas), then normal.
- **Cue firing on skip:** when skipping, do not fire the skipped sfx; play one `pop` only.
- **Easings to add to `U`:** `linear, inQuad, outQuad, inOutCubic, outCubic, outExpo, outBack (s=1.7), outElastic, outBounce, step`.
- **New Sfx needed** (all doable with the existing `tone`/`noise`):
  - `slam`: noise 0.12 s at 180 Hz plus tone 70 Hz.
  - `whoosh`: noise sweep.
  - `blip`: tone 880 Hz, 0.02 s.
  - `sting`: three ascending triangle notes.
  - `record`: saw tone sliding down 0.3 s, for the "record scratch".
  - `choir`: three stacked detuned sine notes held 1.5 s, for majestic reveals.
  - `sad`: descending trombone, four saw notes.

## 5. Timing rules of thumb (at 60 fps)

| beat | duration | note |
|---|---|---|
| Establishing shot | 1.2-2.0 s | long enough to read one idea |
| Minimum readable shot | 0.5 s | below that it is a flash, not a shot |
| Anticipation before a gag or hit | 0.25-0.4 s | wind-up pose, camera eases in 5-10% |
| Punch-in zoom | 0.10-0.15 s, `outExpo` | never a linear zoom for comedy |
| Hitstop / freeze on impact | 0.08-0.15 s | pair with flash and shake |
| Shake | 6-12 px, decaying over 0.25 s | 20 px or more only for the Bagger |
| Reaction pose pop | 0.12 s `outBack` + hold 0.6 s | squash 0.25 on entry |
| Hold after the punchline | 0.7-1.0 s of silence | do nothing; the stillness is the joke |
| Deadpan beat ("...") | 0.8-1.2 s | one blink at around 0.5 s sells it |
| Title card slam | in 0.12 s, hold 1.2-1.6 s, out 0.15 s | hold = 0.35 s + 0.06 s per character |
| Caption reading time | 0.5 s + 0.055 s per character, minimum 1.2 s | then allow click |
| Majestic reveal pan/tilt | 3-5 s, `inOutCubic` | the only place slow motion is allowed |
| Smash cut | 0 frames, audio killed | follow with a 0.5 s static wide shot |
| Sting (repeat tier) | 1.2-2.5 s total | pose + title + sfx |
| Full cutscene | 8-25 s; the ending may reach 35 s | one joke per cutscene, one tag at most |

Structural rules:
- **Setup, escalation, break.** Two beats establish a pattern; the third breaks it.
- **Contrast in scale and tempo:** fast after slow, tiny after huge, silent after loud.
- **Cut on the pose, not during the movement.**
- **Music stops 0.2-0.3 s before the punchline**; one dry sfx lands on it.
- **Comic motion uses `outBack`/`outExpo`** (snappy with overshoot); **majestic motion uses `inOutCubic`.** Never use `linear` except for scrolling.
- **Text never exceeds two lines of about 28 characters**; the punchline goes on its own card or caption.

## 6. Storyboards (pt-BR)

Shorthand: `ECU` extreme close-up, `CU` close-up, `WS` wide shot, `LB` letterbox. New art needed is flagged at the end.

### (a) `intro` — full, about 22 s, plays on a new game
1. **Card** (1.4 s, fade in): black, type `"Em algum lugar do interior..."`. Sfx: wind noise.
2. **WS shack** (2.0 s): Kome in pose `sleep` beside an empty bowl. A phone on the ground vibrates (2 px shake, `blip` x2). Kome's ear twitches.
3. **CU phone screen** (click-hold, minimum 1.2 s): listing with a pixel photo of a house with a cherry tree. Type: `"CASA NO JAPÃO — 3 quartos, 1 cerejeira, 0 vizinhos."`
4. **ECU Kome's eyes** (0.9 s, LB in): punch-in 0.12 s, sparkles in the eyes, pink radial background, `choir`. Pose `surprise`, `mouth:'open'`, tail in pose `wag`.
5. **CU price** (1.8 s): text anim `count` rolling up to `¥ 88.000.000` with digit shake; `slam` at the end. Music stops.
6. **CU Kome's wallet** (1.2 s, smash in): a single coin and a moth (particle). Caption: `"Saldo: ¥ 12. E um botão."` Sfx `sad`.
7. **WS Kome sitting** (1.0 s, silent): deadpan, one blink. Hold.
8. **Slow tilt up** (3.5 s, `inOutCubic`, z 2 to 0.3): behind him, the rice mountain rises out of frame. `choir` crescendo, shake 4 at the end.
9. **CU Kome, low angle** (1.6 s): pose `howl` then `sword` holding chopsticks, parallel speed lines. Title slam: `"KOME NO JAPÃO"`, sub: `"um grão de cada vez"`.
10. **Smash to WS** (hold click): tiny Kome picks up one grain with a paw. `pop`. Caption: `"Faltam 87.999.999 e uns quebrados."` Iris out to gameplay.

`onEnd`: start the tutorial. No sting.

### (b) `first_machine` — full, about 12 s (first purchase of the walk-behind tractor); sting for later machines
1. **WS shop** (1.5 s, wipe in): Kome puts down a bag of yen in front of a shiba seller (pal `kuro`, no hat). Bubble from the seller: `"Tem certeza? Ele morde."`
2. **CU tarp** (0.4 s anticipation, LB in): the tarp trembles, `shake` sfx.
3. **Flash reveal** (0.12 s flash + 0.12 s freeze + radial speed lines): the tarp flies off (rect particles). Bottom-up camera on a ridiculously small tractor treated like a mecha, glint on the bodywork. Title slam: `"TRATORZINHO"`, sub: `"1 cavalo. Talvez meio."`
4. **ECU Kome** (0.8 s): eyes shining, drooling a little (`mouth:'tongue'`).
5. **Smash to WS** (1.2 s, silent): Kome climbs on, turns the key. Sfx: weak tone 60 Hz, `"pof... pof..."`. A puff of smoke. Hold 0.8 s.
6. **WS** (1.5 s): it jolts and shoots out of frame (whip, parallel speed lines), leaving the hat hanging in the air; the hat falls. Caption: `"Agora vai."`

**Sting** (1.8 s, for each new machine): flash, low-angle machine with radial speed lines, title slam `"{NOME}"` plus a comic sub from the data table, `buy` sfx. Sub lines per machine:
- Carrinho de mão: `"Tecnologia de ponta. De uma ponta só."`
- Escavadeira: `"Agora o braço forte não é o seu."`
- Caminhão fora de estrada: `"O pneu custa mais que a sua casa. A que você não tem."`
- Pá elétrica: `"A conta de luz vem depois."`

### (c) `bagger_reveal` — full, about 28 s, the centrepiece
1. **Card** (1.2 s): black, `"Entrega para: Sr. Kome"`. Sfx: a truck horn far away (low tone).
2. **WS Kome signing a clipboard** (1.6 s): delivery shiba (pal `shiro`). Bubble: `"Assina aqui. E aqui. E mais 14.200 vezes."`
3. **Ground shot** (1.5 s): the rice grains on the ground jump in rhythm (shake 3, 6, 10 with `big` at 0.5 s intervals). The bowl walks by itself. Kome's ears go down. This is anticipation by escalation.
4. **CU Kome** (1.0 s): a shadow covers him progressively from left to right (tint). He looks up slowly. Music stops.
5. **The tilt** (5.0 s, LB, `inOutCubic`): the camera starts on the crawler tracks (each link bigger than Kome), rises up the lattice structure, past walkways with lights blinking, cables, the counterweight, along the boom, and ends on the bucket wheel against the sun. Parallax across 3 layers; `choir` at maximum; the wheel turns slowly. No text.
6. **Freeze + title** (2.2 s): background desaturated, title slam with shake 20: `"BAGGER 293"`. Sub lines pop one by one at 0.5 s intervals: `"96 m de altura"`, `"14.200 toneladas"`, `"0 vagas de estacionamento"`.
7. **Extreme WS** (2.0 s, smash, silent): the whole machine fits in frame. Kome is 2 px. An arrow labelled `"você"` points at the pixel. Hold 1.0 s.
8. **Stair montage** (3 quick shots of 0.7 s each, whip between them): Kome climbing stairs with pose `walk`; then pose `yawn` on a landing with a sign `"andar 12 de 31"`; then being carried up by a small lift he had not seen, face deadpan.
9. **Interior cabin CU** (1.8 s): giant lever, giant chair, Kome's feet do not reach the floor. He puts on a tiny helmet over the rice hat. Bubble: `"...au."`
10. **ECU paw on the red button** (0.35 s anticipation, then flash + 0.15 s freeze).
11. **WS wheel bites the mountain** (3.0 s): shake 16, hundreds of `grain` particles, the yen counter spinning in the corner (`count`). Caption: `"Colheita: 240.000 m³ por dia. Hashi: aposentado."`
12. **Tag** (1.2 s, smash): the chopsticks in a tiny glass museum case with a plaque `"2024–2024"`. `pop`. Iris out.

**Sting** (after prestige): shots 6 + 11 compressed to 2.5 s.

### (d) `mochi_layer` — full, about 13 s (first time a tool hits the mochi layer)
1. **WS gameplay angle** (1.2 s): the excavator digs normally, cheerful music.
2. **CU bucket** (0.3 s anticipation, then impact): sfx: low rubber `"BOING"` (tone slide 120 to 300 Hz). The bucket sinks in, stretches the white layer like gum, and rebounds. Freeze 0.12 s on maximum stretch. Music stops with `record`.
3. **CU Kome** (0.9 s): pose `surprise`, hat spinning. Deadpan blink.
4. **Rule of three** (3 shots of 0.6 s, smash between them):
   - Shovel: it sticks, and Kome hangs from the handle, horizontal.
   - Excavator: the mochi stretches and launches the excavator out of frame (whip).
   - Dynamite: muffled `"puf"`; the mochi inflates into a perfect bubble and deflates intact.
5. **Title card** (1.6 s): flat pink background, slam: `"CAMADA DE MOCHI"`, sub: `"Dureza: irritante."`
6. **CU Kome chewing a piece** (1.5 s): pose `eat`, jaw stuck. Caption: `"Nem mastigando."`
7. **WS** (click-hold): Kome looks at the horizon, where there is a silhouette of something even bigger with a blinking light. Caption: `"Vai precisar de algo... desproporcional."` This points the player at the next purchase.

**Sting:** shot 2 only + stamp `"GRUDOU"`, 1.2 s.

### (e) `buy_house` — full, about 32 s, the ending
1. **WS bank counter** (1.5 s, fade in): Kome pushes a wheelbarrow of yen. Banker shiba with glasses (pal `goma`).
2. **Rule of three with a counter** (3 shots of 0.7 s): wheelbarrow dumped; truck dumped; the Bagger's bucket wheel coming through the bank wall and dumping. On each, the `count` number rises with `coin`.
3. **CU banker** (1.2 s, silent): covered in notes up to the glasses. Deadpan. Bubble: `"...débito ou crédito?"`
4. **ECU stamp** (0.3 s anticipation, flash, freeze): text anim `stamp`: `"VENDIDO"`. Sfx `slam`.
5. **Card** (1.2 s): `"14 horas de voo depois"`. Sfx: aeroplane (noise sweep).
6. **Slow pan** (4.0 s, LB, `inOutCubic`): a Japanese street at dusk, lanterns, falling petals (rect particles in pink), soft music. Kome walks with a small bundle on a stick, pose `walk`.
7. **WS house** (2.5 s): the house from the listing, the cherry tree. Kome stops. Pose `sit`. Tail in `wag`. No text. Hold. This is the one sincere beat of the game; let it breathe.
8. **CU key in the lock** (0.8 s): `pop`. The door slides open.
9. **Interior** (1.6 s): empty room with tatami. Kome goes in, spins, pose `roll` on the floor, then `sleep`. Caption: `"Casa: comprada."`
10. **Smash to pantry CU** (1.4 s, silent): Kome opens the rice bin. Empty. One grain falls. `blip`.
11. **CU Kome** (1.0 s): slow blink. Bubble: `"..."`
12. **Window shot** (2.5 s, tilt up): outside the window, behind the cherry tree, the outline of a new rice mountain, bigger, with snow on top. `choir` with one wrong note.
13. **Title slam** (hold click): `"FIM"`, then a small pop below: `"(do começo)"`. Iris on Kome's face, pause at the small circle; he looks at the camera, then it closes.

`onEnd`: unlock prestige and show the stats screen (time, grains, machines).

### (f) `prestige_twist` — full, about 15 s (when the player confirms prestige); sting for later loops
1. **WS garden** (1.5 s): Kome drinks tea on the veranda. A postman shiba delivers a letter. Sfx: bicycle bell.
2. **CU letter** (click-hold, minimum 1.5 s): type: `"IPTU do Japão: ¥ 880.000.000. Vence ontem."`
3. **ECU Kome** (0.7 s): the tea cup cracks (1 px line, `blip`). Music stops.
4. **WS** (1.0 s, silent): Kome folds the letter calmly, puts on the hat.
5. **Low-angle hero shot** (1.8 s, LB, radial speed lines): Kome in pose `sword` holding golden chopsticks, wind in the scarf. Title slam: `"NEW GAME +"`, sub: `"Arroz dourado. Boleto também."`
6. **Smash to extreme WS** (1.6 s): the mountain is now golden and three times bigger; in the background the folded Bagger waits under a tarp far too small for it. Caption: `"Bônus: hashi de ouro (+{X}% por grão)."`
7. **Tag** (1.0 s): tiny Kome picks up one golden grain. `gold` sfx. Cut to gameplay.

**Sting** (loop 2 onward, 2.0 s): shot 5 with the sub line varied by loop:
- `"Agora é o condomínio."`
- `"Reforma do telhado."`
- `"A cerejeira pegou cupim."`
- `"O vizinho que não existia abriu um processo."`

## 7. Art and code to-do implied by the storyboards
- **New ShibaPX capability:** a `hires` face sprite (about 96x96) with states `sparkle | deadpan | shock | chew`, for the ECUs. The ECUs are the highest-value art in the list.
- **New drawables:** `phoneListing`, `wallet`, `shopCounter`, `tarp`, `tratorzinho`, `bagger293` (multi-part: tracks, lattice, boom, wheel with rotation prop, cabin, lights), `cabinInterior`, `mochiLayer` (stretch prop 0..1), `bankCounter`, `japanStreet`, `house`, `pantry`, `letter`, `goldMountain`.
- **Bagger scale check:** Kome is about 44 px in a world where 1 px = 1 unit. A Bagger 293 that reads as majestic should be at least about 2400 px long by 1000 px tall in world units, so the full-machine shot needs camera z of about 0.3 or lower. The current `Camera` handles this; cache the machine parts as sprites so that zoom stays cheap. The Bagger figures (96 m, 14,200 t, 240,000 m³/day) are from memory; verify before shipping the copy.
- **Save data:** `cutscenesSeen: {id: count}`; a settings toggle "Pular cutscenes repetidas" (default on, which selects the sting tier).
- **Debug:** `?cs=bagger_reveal&shot=5&t=2.0` in the URL calls `Cutscene.seek`, for iterating on a single shot.

## Sources
- https://tech4gamers.com/dave-the-diver-interview-mintrocket/
- https://www.invenglobal.com/articles/22933/the-joy-of-dave-the-diver
- https://gamesradar.com/dave-the-diver-players-cant-get-over-how-extra-its-cutscenes-are (headline only; body not retrievable)
- https://the-pixels.com/?p=139778
- https://epiloguegaming.com/the-shallow-depths-of-dave-the-diver/
- https://softwareengineeringdaily.com/articles/developing-dave-the-diver-with-jaeho-hwang-and-minsuk-cha/
- https://playbooks.com/skills/dylantarre/animation-principles/timing-mastery
- https://playbooks.com/skills/dylantarre/animation-principles/anticipation-payoff
- https://www.thepromptindex.com/skill/1944-storyboard-comedy-timing