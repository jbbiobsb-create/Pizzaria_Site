# KOME NO JAPÃO: GDD v4 (replaces v3 entirely)

**What changed from v3.**
- Tool ladder is now exactly 12 rungs (motocultivador and colheitadeira are gone; duas pás, empilhadeira, pá de cabo elétrica and caminhão de mineração are in).
- Old motorized machines never leave the screen: helper shibas pilot them (§5).
- Explicit VISUAL FEEDBACK RULE with a `see` field on every purchase (§8.1).
- Gamification layer: goal bars, 30 achievements, rotating missions, album, celebrations, welcome-back, end-of-run rank (§8.3).
- The three upgrade columns became one branching map, the **Árvore do Kome**, with 68 nodes in 5 branches (§6).
- New §14 "Motor de recompensa" (reward rules, applied through §3-8 and §11).
- Economy retuned: `P0` 0.15 → 0.20, new `A` values, Núcleo Koshihikari `val` 8 → 6. World layout, materials, Bagger rig, Mordida gauge, house stages, the corretor joke, events and save approach are kept.

**Sim.** All numbers were run through `/tmp/claude-0/-home-user-Pizzaria-Site/73bb5c4b-e898-5ba0-a571-a9a62e6621c9/scratchpad/sim/final4.py` (standalone; run with `python3 -I final4.py`, add `--js` to print the `TREE` literal). It is the single source of truth for costs: the `TREE` block in §6 is its printed output. Full purchase log: `/tmp/claude-0/-home-user-Pizzaria-Site/73bb5c4b-e898-5ba0-a571-a9a62e6621c9/scratchpad/sim/out4.txt`. The sim uses averaged layer mixes and average event rates, not the real heightfield, so re-run it against the real game before locking.

## 1. Pitch + pillars
- Kome, a chibi shiba, digs a mountain of rice from paw to **Bagger 293** to buy a house in Japan (¥160M). One active run takes about 75 min and ends.
- **Kome always digs.** His tool is the biggest bite on screen. Helpers and piloted machines peak at 39% of income (sim) and drop to about 20% when the Bagger arrives.
- **Nothing is ever replaced, only added.** Every purchase is a working sprite in one persistent world. Each machine Kome outgrows gets a shiba pilot and keeps digging.
- **Every purchase is visible.** No number-only upgrades (§8.1).
- **The camera only zooms out** (3.0 → 0.22). At minute 30 the mountain bar still reads 95%; that is the joke.
- **The Bagger is piloted, not idle.** It eats the last 45% of the mountain in about 10 min.
- **Free, offline, single-player, kid-safe.** No real money, no notifications, nothing that punishes stopping (§14).

## 2. Phases and screen
World, left to right, `WW=8400` (unchanged):

| x range | Zone |
|---|---|
| 0-900 | Colina da casa |
| 900-1700 | Pátio (buildings, garagem of parked machines, rail in the background) |
| 1800-8000 | Montanha (`MX0=1800, MX1=8000, MH=2600`), about 9.43M px² |
| 8000-8400 | Margin |

`COLW=4` gives 2100 columns. Kome starts at x=1920.

| # | Fase | Min (sim) | Tools | Zoom | Screen |
|---|---|---|---|---|---|
| 1 | Na pata | 0-11:49 | pata, hashi, tigela, pá, duas pás | 3.0-1.8 | Kome fills the screen with the tool in his paw. Barraquinha at the foot, first helpers (Goma, Kuro), Kakashi and crows. |
| 2 | Rodas | 11:49-29:16 | carrinho, trator | 1.45-1.1 | Kome climbs into his first cab. Kei-truck laps, silo, fábrica. The phase 1 pit is a dent. Terreno bought. |
| 3 | Motores | 29:16-49:03 | empilhadeira, escavadeira | 0.85-0.62 | First legacy machine gets a pilot: Goma on the tractor. Pallet stacks, esteira, train. Mochi cracks pink. |
| 4 | Mineração | 49:03-65:06 | pá de cabo, caminhão | 0.46-0.36 | Open-pit mine look: benches, haul road, Moega. Convoys bring Bagger parts; cranes weld in the pátio. Fundação, then Estrutura. |
| 5 | BAGGER 293 | 65:06-75:26 | bagger | 0.30-0.22 | The machine spans a third of the screen; Kome is 6 px in the cabin. Five legacy machines work around it. Telhado → Lago → Onsen. |

## 3. TOOLS
`P0 = 0.20 ¥/px²`. Remove `COST_MULT` and `VALUE_MULT`.

Dig speed: `k = pow/hard`. `k≥1` → 100%; `0.4≤k<1` → k; `k<0.4` → 0 with a "boing" and a "duro demais!" bubble that also says what is missing honestly ("precisa: Escavadeira").

`A` = px²/s at 100% hold (cycle average for cycle tools). `seat:'paw'` = Kome on foot with the tool in his paw; `seat:'cab'` = Kome sits in the cab (head and kasa visible through the window).

```js
const TOOLS=[
 {id:'pata',        name:'Pata do Kome',         cost:0,       A:15,  r:6,  pow:1,  zoom:3.0, spd:240,reach:14, seat:'paw',kind:'hand',  act:'patas frenéticas, 3 grãos por batida'},
 {id:'hashi',       name:'Hashi',                cost:120,     A:25,  r:8,  pow:1,  zoom:2.7, spd:250,reach:20, seat:'paw',kind:'hand',  act:'pega grão por grão absurdamente rápido, "tic-tic"'},
 {id:'tigela',      name:'Tigela',               cost:600,     A:44,  r:11, pow:1.3,zoom:2.4, spd:260,reach:22, seat:'paw',kind:'hand',  act:'enche e joga por cima do ombro em arco'},
 {id:'pa',          name:'Pá',                   cost:2800,    A:72,  r:15, pow:2,  zoom:2.1, spd:270,reach:24, seat:'paw',kind:'hand',  act:'swing com squash, torrões'},
 {id:'duaspas',     name:'Duas Pás',             cost:10000,   A:112, r:19, pow:2.5,zoom:1.8, spd:280,reach:26, seat:'paw',kind:'hand',  act:'uma em cada pata, alternando; a cada 8 golpes um giro-helicóptero'},
 {id:'carrinho',    name:'Carrinho de Mão',      cost:32000,   A:172, r:28, pow:3,  zoom:1.45,spd:300,reach:50, seat:'paw',kind:'push',  act:'enfia no barranco, enche, despeja; roda range'},
 {id:'trator',      name:'Trator',               cost:90000,   A:250, r:44, pow:4,  zoom:1.1, spd:420,reach:48, seat:'cab',kind:'trator',act:'lâmina empurra ondas de arroz, fumaça'},
 {id:'empilhadeira',name:'Empilhadeira',         cost:270000,  A:360, r:36, pow:5.5,zoom:.85, spd:400,reach:60, seat:'cab',kind:'fork',  cycle:1.55, act:'espeta os garfos na parede e arranca blocos de arroz prensado'},
 {id:'escav',       name:'Escavadeira Hidráulica',cost:800000, A:500, r:72, pow:8,  zoom:.62, spd:380,reach:120,seat:'cab',kind:'escav', act:'braço IK de 2 ossos morde e despeja'},
 {id:'pacabo',      name:'Pá de Cabo Elétrica',  cost:2700000, A:660, r:100,pow:9,  zoom:.46, spd:30, reach:260,seat:'cab',kind:'rope',  cycle:3.6,  act:'conchada gigante e lenta: iça, gira 90°, despeja'},
 {id:'caminhao',    name:'Caminhão de Mineração',cost:6500000, A:860, r:100,pow:11, zoom:.36, spd:260,reach:0,  seat:'cab',kind:'haul',  cycle:11.2, act:'Kome dirige; capataz Tetsu carrega com a pá de cabo; o iene sai na basculada'},
 {id:'bagger',      name:'Bagger 293',           cost:13000000/*=bg3; needs bg1+bg2*/,A:1900,r:110,pow:16,zoom:.26,spd:40,reach:560,seat:'cab',kind:'bagger',act:'roda de 18 caçambas, ver rig'}
];
```

Controls are always **pointer position + hold**, mouse and touch alike. What the pointer and the hold mean changes per rung, so each rung is a new verb:

| # | Tool | How it digs (the verb) | Pointer | Hold | Payout moment |
|---|---|---|---|---|---|
| 1 | Pata | Scratches a shallow bowl under the paws. | Kome walks to it | Paw flurry, 8 hits/s | Continuous, batched every 0.4 s |
| 2 | Hashi | Plucks single grains from a wider area at absurd speed. Precise and silly. | Walk + aim | 14 "tic"/s, grains fly into a tiny bowl | Continuous |
| 3 | Tigela | Scoops a bowlful and throws it over the shoulder in an arc. First visible "volume". | Walk + aim | Scoop-throw loop, 2.5/s | Each throw landing |
| 4 | Pá | Heavy swing with squash, clods fly. First tool that cuts Arroz Prensado. | Walk + aim | 1.6 swings/s | Each swing |
| 5 | Duas Pás | One shovel per paw, alternating left and right at double rhythm ("tchac-tchac"). Every 8th hit is a helicopter spin with 2× radius. | Walk + aim | 3.2 hits/s; the spin triggers itself | Each hit; spin is one bigger pop |
| 6 | Carrinho | Rams the barrow into the bank, it fills (bar on the barrow), Kome tips it behind him. | Push direction | Ram-fill-tip loop, 1.2 s | On tip |
| 7 | Trator | Blade pushes a wave of rice forward; the wave grows until it rolls over the blade. Kome in the cab. | Drive target X; Y sets blade height | Throttle | Continuous while the wave moves |
| 8 | Empilhadeira | Stabs the forks horizontally into the face, lifts out a 36×16 px block of pressed rice, reverses, drops it on a pallet. Four blocks = "PALETE!" | X = drive, Y = mast/fork height | Stab 0.35 s → lift 0.4 s → reverse 0.5 s → drop 0.3 s | One pop per block; a bigger pop per finished pallet |
| 9 | Escavadeira | Two-bone IK arm reaches up the face, bucket curls a bite and dumps it beside the tracks. | Bucket target (IK) | Curl-swing-dump loop, 2.0 s | On dump |
| 10 | Pá de Cabo | Huge slow scoop. The dipper crowds into the face and hoists up through it (1.6 s), the whole house swings 90° (0.9 s), the dipper door drops (0.5 s), swings back (0.6 s). | X = crawl target (max 30 px/s), Y = bite height | Run the cycle; consecutive full dippers speed the swing +5% each, up to +20% ("Balanço") | One large pop per dump (2,376 px² per full dipper) |
| 11 | Caminhão | Kome drives a Cat 797 class truck. Capataz Tetsu comes free with the truck and operates the pá de cabo Kome just left. See below. | Right of the truck = load at the face; left of the truck = haul to the Moega | Do the action the pointer side selects | One huge pop on the dump (about 9,600 px² per full load) |
| 12 | Bagger 293 | Bucket wheel grinds the face continuously. | X = crawl target, Y = boom angle | Spin the wheel | Stream of pops at the silo |

**Empilhadeira cut.** `digRect(x0,x1,h)`: columns in the fork's x-span lose 16 px from the top, and a block sprite slides out at fork height while the rice above settles with falling grains. This keeps the heightfield valid (no overhangs).

**Caminhão de mineração (why a truck is a dig tool).**
- Buying it promotes the rope shovel to loader: capataz Tetsu (a grey-muzzled shiba with a moustache) takes its cab and gets new dipper teeth, which is why `pow` rises to 11.
- **Load:** hold with the pointer on the mountain side. The truck backs up beside the shovel; Tetsu digs where the pointer is and pours into the bed. Each scoop adds 33% ±4% to the **Carga** gauge (the bed fills visibly and the suspension sags).
- **Haul:** move the pointer to the pátio side and hold. The truck drives to the **Moega móvel** (a hopper that sits 520 px from the face and relocates itself), raises the bed for 1.2 s and dumps. The yen pops here.
- **Skill, "Carga Coroada":** leave while the gauge is between 100% and 115% for ×1.25. Above 115% the extra spills on the road (no penalty beyond the wasted scoop). Below 100% pays pro rata. The gauge prints the honest miss: "97%: faltou 3% pra carga coroada".
- Cycle: 3 scoops × 2.0 s + 2.0 s drive + 1.2 s dump + 2.0 s back = 11.2 s. Released hold = the truck idles; nothing is lost.
- Without the `p4` node the shovel waits while Kome is away on the dump run. With `p4` two helper trucks keep it busy (§5).

**Bagger 293 rig (unchanged from v3).**
- Size about 1460×624 world px (6.5 px/m). Wheel r=110 with 18 buckets. Boom 560 px, pivot 330 px above the tracks, luff −18°..+32°.
- Total price is ¥29.3M (6.3 + 10 + 13), bought as `bg1`, `bg2` (tree nodes) and `bg3` (the tool button).
- Controls: pointer X = crawl target (max 40 px/s), pointer Y = boom angle, hold = spin the wheel (spool 0→100% in 2 s, pitch rises). Space or a HUD button = Buzina.
- `digCircle(cx,cy,r,area)`: columns inside the wheel's x-span lose height from the top, weighted by overlap. Rice above the wheel "falls into it" as particles.
- 18 buckets × 0.33 rev/s ≈ 6 "tchac"/s.
- **Mordida** `b` = buried fraction of the front semicircle (12 sample points):

| b | Effect |
|---|---|
| <0.3 | ×0.6, "caçambas vazias" |
| 0.3-0.4 | ×1 |
| 0.4-0.7 | **MORDIDA PERFEITA ×1.5**, buckets overflow |
| 0.7-0.85 | ×1 |
| >0.85 | Stall: RPM drops to 30%, shake |

- With keystone `bK` the perfect band is 0.35-0.75 at ×1.6, and three perfect seconds in a row have a 1 in 4 chance of "×3 NESTA MORDIDA" for the next second.
- The gauge is an arc drawn around the wheel. When just outside the band it prints the real figure: "92% da mordida perfeita".
- Flow, drawn as scrolling textures: buckets → boom conveyor → discharge bridge → Esteira Tronco → silos → train.
- Tracks auto-flatten the rice under them.

## 4. MATS + bolsões
Layer is chosen by **absolute depth below the original surface `OH[i]`**. `slope` is the avalanche threshold in px per column.

```js
const MATS=[
 {id:'solto',   name:'Arroz Solto',        d0:0,  d1:150, hard:1,  val:1,  slope:3.6,col:'#F6F1E4'}, // ≈0.90M px²
 {id:'prensado',name:'Arroz Prensado',     d0:150,d1:600, hard:2.5,val:1.6,slope:6,  col:'#E9DCBE'}, // ≈2.49M
 {id:'mochi',   name:'MOCHI DURO',         d0:600,d1:1e9, hard:8,  val:3.5,slope:9,  col:'#EFD9D2'}, // ≈4.41M
 {id:'koshi',   name:'Núcleo Koshihikari', ellipse:{cx:4900,cy:0,rx:1150,ry:900}, hard:24,val:6,slope:12,col:'#E8B93A'} // ≈1.63M, overrides mochi
];
const POCKETS={n:28, r:[35,90], mult:8 /*s4→10, s10→12*/, minDepth:60}; // ≈4% of volume → avg price ×1.28 (×1.36, ×1.44)
```

Resulting gates:

| Tool | pow | Prensado (2.5) | Mochi (8) | Núcleo (24) |
|---|---|---|---|---|
| pata, hashi | 1 | boing | boing | boing |
| tigela | 1.3 | 52% | boing | boing |
| pá | 2 | 80% | boing | boing |
| duas pás | 2.5 | 100% | boing | boing |
| carrinho | 3 | 100% | boing (0.375) | boing |
| trator | 4 | 100% | 50% | boing |
| empilhadeira | 5.5 | 100% | 69% | boing |
| escavadeira | 8 | 100% | 100% | boing |
| pá de cabo | 9 | 100% | 100% | boing (0.375) |
| caminhão | 11 | 100% | 100% | 46% |
| bagger | 16 (24 with `b3`) | 100% | 100% | 67% (100%) |

Pocket hit: a 0.4 s cue (rising "shiiing" + white flash on the pocket outline) comes first, then 60 ms hit-stop, gold spray and banner.

## 5. AUTOMATION
Two kinds of automation, both visible, both digging the real heightfield.

**On-foot helpers.** Each digs `HR × A(min(tier, escavadeira)) × hm` px²/s with `HR=0.08`. They work within ±6r of Kome's last dig point (same layer rules, Kome's `pow`).

**Piloted legacy machines.** Each motorized rung Kome has outgrown stays in the world. Until its pilot node is bought it is parked in the pátio garagem with a "PRECISA-SE PILOTO" sign and a "zzz" (the lure). With a pilot it digs `PR × A(machine) × pm` px²/s with `PR=0.25`, on its own bench so machines never crowd Kome:

| Machine | Pilot node | Pilot | Where it works | What you see |
|---|---|---|---|---|
| Trator | `p1` | Goma | Mountain foot, pushing toward the Moega/barraca | Waves of rice, blue smoke |
| Empilhadeira | `p2` | Kuro | Low bench beside the pátio | Pallet stacks growing; kei-truck takes them |
| Escavadeira | `p3` | Shiro | Bench 400 px right of the pátio edge | Arm loop, dumping into the esteira |
| Pá de cabo | `p4` | Tetsu + 2 helper trucks | The current main face | Two yellow trucks cycle face ↔ Moega while Kome's truck is away |
| Caminhão 797 | `p5` | Pochi (only the hard hat shows) | Joins the `p4` truck loop | Kome's old truck in the fleet |

Yen of all automation is `px × val × P0 × sell × hv × crit` (no combo, no sacks). Auto-yen pops are grey-white and small so Kome's pops stay the loudest.

AUTO is a view over the tree (`TREE.filter(n => n.branch==='equipe' || n.fx.pilot || n.fx.pm)`), in buy order from the sim:

| id | Name | ¥ | Tier | Effect | See |
|---|---|---|---|---|---|
| a1 | Shiba Ajudante | 1,500 | 4 | +1 helper | Goma digs with a bowl |
| a2 | Segundo Shiba | 5,800 | 5 | +1 helper | Kuro |
| a3 | Kakashi | 8,300 | 5 | no crows, `hv` ×1.2 | scarecrow in Kome's hat |
| a4 | Turma Shiba | 16,000 | 6 | +2 helpers | Shiro + Mame |
| e1 | Marmita (bentô) | 25,000 | 6 | `hm` ×1.25 | helpers eat onigiri and speed up |
| a11 | Shiba Novato | 38,000 | 7 | +1 helper | Pochi, the puppy |
| a5 | Kei-truck (keystone) | 76,000 | 7 | auto-collects sacks, `sack` ×1.33, `hv` ×1.3 | white kei-truck laps |
| a7 | Silo | 97,000 | 7 | unlocks offline | silo with level window |
| e3 | Apito do Capataz | 140,000 | 8 | `hv` ×1.15 | whistle shiba, synced digging |
| **p1** | **Piloto pro Trator** | 210,000 | 8 | tractor digs alone | Goma in the tractor |
| a6 | Pás pros Shibas | 240,000 | 8 | `hm` ×1.25 | bowls become shovels |
| a8 | Mais Shibas | 320,000 | 8 | +2 helpers | 7 shibas, work chant |
| **p2** | **Piloto pra Empilhadeira** | 590,000 | 9 | forklift digs alone | Kuro stacks pallets |
| a9 | Esteira | 1,200,000 | 9 | `hv` ×1.3 | conveyor to the silo |
| e4 | Capacetes | 1,300,000 | 10 | `hm` ×1.11 | hard hats and vests |
| e2a | Oficina | 1,400,000 | 10 | `pm` ×1.15 | workshop, fresh paint |
| **p3** | **Piloto pra Escavadeira** | 2,000,000 | 10 | excavator digs alone | Shiro on a bench |
| a10 | Capatazes | 3,000,000 | 10 | +1 helper | mini-excavator foreman |
| e5 | Rádio da Obra | 3,600,000 | 11 | `hv` ×1.15 | antenna, "copiado!" bubbles |
| e2b | Turno da Noite | 4,200,000 | 11 | `pm` ×1.13 | light towers, beacons |
| **p4** | **Frota da Pá de Cabo** | 4,700,000 | 11 | rope shovel digs between Kome's loads | two helper haul trucks |
| **p5** | **Piloto pro Caminhão** | 11,000,000 | 12 | 797 joins the fleet | Pochi drives |

- Helpers: 8 from nodes + 1 from house `h1` = 9 max. Synergy: Marmita + Fábrica de Onigiri gives `hm` ×1.08 more.
- **Auto share of income (sim, active run):** 5% with the first helper, 17% in the carrinho window, 25% with the tractor, **peak 39%** in the empilhadeira window (first pilot + shovels + 7 helpers), 37-38% through escavadeira, pá de cabo and caminhão, then 19-22% in the Bagger phase. Of that, piloted machines are about 15% of auto at `p1`, about 45% with four machines and about 55% in the Bagger phase.
- Casual (60% hold) peaks at 48% and lazy (30% hold) at 60%; that is the intended "the crew carries you" feel for idle players. The sim asserts ≤45% for the active run.
- `c6` Kome Workaholic: Kome digs at 40% with no combo when released.

## 6. UPGRADES: Árvore do Kome
One pannable node map instead of three columns. Kome's face is the centre node at (0,0). Five branches grow outward at 72° intervals; `pos` is in grid units (1 unit = 96 px on the map canvas; drag to pan, wheel or pinch to zoom 0.5-1.5).

| Branch | Direction | Nodes | What it is |
|---|---|---|---|
| Colheita | up | 12 | Kome's own dig: speed, reach, combo, Fúria |
| Comércio | right-up | 14 | Sell price chain, each a building or prop in the pátio |
| Equipe | right-down | 15 | On-foot helpers and chores (sacks, silo, esteira) |
| Máquinas | left-down | 15 | Pilots for old machines, workshop, Bagger parts and Bagger upgrades |
| Sorte & Eventos | left-up | 12 | Sacks, golden grain, pockets, onigiri, missions, visitors, landslide |

Rules:
- A node needs **all** ids in `req` and `tier` tools owned. All nodes are one-shot. There are no lock-outs and no respec: everything can be bought in one run (the sim buys all 68).
- **Fog.** Bought nodes are full colour. Nodes whose `req` is met are lit with price, effect, `see` text and a fill bar. Nodes one step further are grey silhouettes showing only the name of what is missing ("precisa: Trator" or "precisa: Kei-truck"). Everything beyond is hidden. The Máquinas root appears as a silhouette from the trator on.
- **Sizes.** `size:0` small (28 px circle, +8% to +15% or a utility), `size:1` big (40 px rounded square), `size:2` keystone (56 px octagon with an animated border; changes the verb or the screen). Keystones: `c3` Patada Sísmica, `c7` Fúria do Kome, `s4` Faro de Shiba, `a5` Kei-truck, `m8` Trem de Arroz, `bK` Mordida Perfeita+.
- **Cross-links** (two parents from different sub-branches or branches): `m10` needs `m9` + `m11`; `e5` needs `a9` + `a10`; `bK` needs `b1` + `b2`; `b4` (Máquinas) needs `b2` + `a9` (Equipe).
- **Mutually enhancing pairs** (order is a real choice, both are always available eventually), drawn as a dotted gold line between the two nodes that lights when both are owned:

```js
const SYN=[
 {a:'e1', b:'m5',    fx:{hm:1.08},     see:'Marmita + Fábrica: bentô de fábrica, ajudantes +8%; marmitas viram caixinhas com logo'},
 {a:'s2', b:'combo1',fx:{critCombo:3}, see:'Grão Dourado + Ritmo de Taiko: cada crítico dá +3 de combo e uma batida de taiko'},
 {a:'a3', b:'s4',    fx:{crowPoint:1}, see:'Kakashi + Faro: corvos amansados circulam sobre o bolsão mais próximo'}
];
```

- **Power budget** is the v3 budget spread over more nodes: dig ×2.69 (1.3 × 1.15 × 1.1³ × 1.12 × 1.2), sell ×11.1 from the tree (1.5 × 1.15⁹ × 1.3² × 1.25) plus ×1.25 and ×1.3 from the house, sacks ×3.37, helper speed ×1.87 (+8% synergy), helper value ×2.68, pilots ×1.3.
- `fx` keys: `dig, sell, sack, hm, hv, pm, val` multiply; `help` adds; `crit` is the chance at ×5; `gold` is the pocket multiplier; `comboCap` the combo ceiling; `oni, mis, vis` are event income fractions (§8.2).

```js
const TREE=[
 {id:'c1',n:'Patinhas Fortes',c:40,branch:'colheita',pos:{x:0.0,y:-1.2},req:[],tier:1,size:1,fx:{dig:1.3},
   see:'patas do Kome crescem 20% e ganham almofadinhas rosa; 5 grãos por batida em vez de 3'},
 {id:'c3',n:'Patada Sísmica',c:3000,branch:'colheita',pos:{x:0.0,y:-2.5},req:['c1'],tier:4,size:2,fx:{stomp:1,dig:1.15},
   see:'KEYSTONE: a cada 6 s cavando Kome pula e abre cratera de 3r, anel de poeira, shake 4 px'},
 {id:'c_spd',n:'Patas Ligeiras',c:1200,branch:'colheita',pos:{x:-1.0,y:-2.5},req:['c1'],tier:4,size:0,fx:{spd:1.2},
   see:'Kome corre com rastro de 3 afterimages e poeirinha nos pés'},
 {id:'cA',n:'Almofadinhas Calejadas',c:5100,branch:'colheita',pos:{x:0.0,y:-3.8},req:['c3'],tier:5,size:0,fx:{dig:1.1},
   see:'animação de uso 10% mais rapida; +2 grãos por batida no jato'},
 {id:'c_reach',n:'Braço Comprido',c:11000,branch:'colheita',pos:{x:-1.0,y:-3.8},req:['c_spd'],tier:6,size:0,fx:{reach:1.15},
   see:'cabo/braco/lança da ferramenta desenhado 15% mais longo'},
 {id:'c6',n:'Kome Workaholic',c:20000,branch:'colheita',pos:{x:1.0,y:-3.8},req:['c3'],tier:6,size:1,fx:{auto:0.4},
   see:'solto o dedo, Kome continua cavando sozinho com olheiras e uma gota de suor'},
 {id:'cB',n:'Diesel Premium',c:54000,branch:'colheita',pos:{x:0.0,y:-5.0},req:['cA'],tier:7,size:0,fx:{dig:1.1},
   see:'fumaça do escape vira azul e mais densa; motor sobe meio tom'},
 {id:'combo1',n:'Ritmo de Taiko',c:81000,branch:'colheita',pos:{x:1.0,y:-5.0},req:['c6'],tier:7,size:1,fx:{comboCap:1.75},
   see:'barra de combo ganha 2º segmento; taiko entra na música acima de x1,5'},
 {id:'cC',n:'Lâminas Afiadas',c:180000,branch:'colheita',pos:{x:0.0,y:-6.2},req:['cB'],tier:8,size:0,fx:{dig:1.1},
   see:'brilho "ting" percorre a lâmina/garfo/dente a cada 4 s; corte solta faíscas brancas'},
 {id:'c7',n:'Fúria do Kome',c:810000,branch:'colheita',pos:{x:1.0,y:-6.2},req:['combo1'],tier:9,size:2,fx:{furia:1.33},
   see:'KEYSTONE: 10 s em combo max -> 5 s de iene x2: Kome uiva, aura vermelha, tela com speedlines'},
 {id:'cD',n:'Turbo Intercooler',c:540000,branch:'colheita',pos:{x:0.0,y:-7.5},req:['cC'],tier:9,size:0,fx:{dig:1.12},
   see:'turbina visível no capô girando; apito de turbo ao segurar'},
 {id:'c8',n:'Combo Mestre',c:2600000,branch:'colheita',pos:{x:1.0,y:-7.5},req:['c7'],tier:10,size:1,fx:{comboCap:2},
   see:'barra de combo com 3º segmento arco-iris; números de iene pulsam no ritmo'},
 {id:'m1',n:'Barraquinha',c:250,branch:'comercio',pos:{x:1.2,y:-0.4},req:[],tier:2,size:1,fx:{sell:1.5},
   see:'barraca com noren, obaa-san e fila de 3 clientes no pátio'},
 {id:'m_a',n:'Balança Honesta',c:700,branch:'comercio',pos:{x:2.4,y:-0.8},req:['m1'],tier:3,size:0,fx:{sell:1.15},
   see:'balança de pratos na barraca, tilinta a cada venda'},
 {id:'m_b',n:'Noren Novo',c:8000,branch:'comercio',pos:{x:3.6,y:-1.2},req:['m_a'],tier:5,size:0,fx:{sell:1.15},
   see:'noren troca pra índigo com o rosto do Kome; fila cresce pra 5'},
 {id:'m_c',n:'Feira de Niigata',c:20000,branch:'comercio',pos:{x:4.8,y:-1.5},req:['m_b'],tier:6,size:0,fx:{sell:1.15},
   see:'bandeiras nobori ao longo do pátio balançando ao vento'},
 {id:'m5',n:'Fábrica de Onigiri',c:140000,branch:'comercio',pos:{x:5.9,y:-1.9},req:['m_c'],tier:7,size:1,fx:{sell:1.3},
   see:'fábrica no pátio; chaminé solta baforadas em forma de onigiri'},
 {id:'m_d',n:'Embalagem Kawaii',c:270000,branch:'comercio',pos:{x:7.1,y:-2.3},req:['m5'],tier:8,size:0,fx:{sell:1.15},
   see:'sacos e pops de iene passam a ter carinha sorrindo'},
 {id:'m7a',n:'Selo Premium',c:700000,branch:'comercio',pos:{x:6.3,y:-1.0},req:['m5'],tier:9,size:0,fx:{val:1.12},
   see:'camada prensada ganha brilho perolado; pops de prensado/mochi com selo vermelho'},
 {id:'m_e',n:'Ekiben de Estação',c:970000,branch:'comercio',pos:{x:6.8,y:-3.3},req:['m5'],tier:9,size:0,fx:{sell:1.15},
   see:'plataforma de estação com quiosque de ekiben ao lado do trilho'},
 {id:'m8',n:'Trem de Arroz',c:1600000,branch:'comercio',pos:{x:8.3,y:-2.7},req:['m_d'],tier:9,size:2,fx:{sell:1.3},
   see:'KEYSTONE: trem (loco + 3 vagões) cruza o fundo a cada 20 s; tocar o apito na passagem = +3 s de renda'},
 {id:'m7b',n:'Selo Ouro',c:1700000,branch:'comercio',pos:{x:7.4,y:-1.4},req:['m7a'],tier:10,size:0,fx:{val:1.12},
   see:'mochi ganha veios dourados; estilhacos de mochi brilham'},
 {id:'m_f',n:'Exportação',c:2300000,branch:'comercio',pos:{x:8.0,y:-3.7},req:['m_e'],tier:10,size:0,fx:{sell:1.15},
   see:'contêineres coloridos empilhados no pátio, guindaste portuário pequeno'},
 {id:'m9',n:'Destilaria de Sake',c:3400000,branch:'comercio',pos:{x:9.5,y:-3.1},req:['m8'],tier:10,size:0,fx:{sell:1.15},
   see:'destilaria com barris komodaru; tanuki bêbado dorme na porta'},
 {id:'m11',n:'Porto de Niigata',c:6500000,branch:'comercio',pos:{x:9.2,y:-4.0},req:['m_f'],tier:11,size:0,fx:{sell:1.15},
   see:'navio cargueiro no horizonte recebe o trem; gaivotas'},
 {id:'m10',n:'Marca "Kome no Japão"',c:42000000,branch:'comercio',pos:{x:10.7,y:-3.5},req:['m9','m11'],tier:12,size:1,fx:{sell:1.25},
   see:'outdoor gigante com o rosto do Kome; pops de iene viram dourados com logo'},
 {id:'a1',n:'Shiba Ajudante',c:1500,branch:'equipe',pos:{x:0.7,y:1.0},req:[],tier:4,size:1,fx:{help:1},
   see:'Goma chega cavando com tigela ao lado do Kome'},
 {id:'a2',n:'Segundo Shiba',c:5800,branch:'equipe',pos:{x:1.5,y:2.0},req:['a1'],tier:5,size:0,fx:{help:1},
   see:'Kuro (preto e canela) entra na fila'},
 {id:'a3',n:'Kakashi',c:8300,branch:'equipe',pos:{x:0.7,y:2.6},req:['a1'],tier:5,size:0,fx:{crows:0,hv:1.2},
   see:'espantalho com o chapéu do Kome; corvos fogem em revoada'},
 {id:'a4',n:'Turma Shiba',c:16000,branch:'equipe',pos:{x:2.2,y:3.0},req:['a2'],tier:6,size:0,fx:{help:2},
   see:'Shiro + Mame: 4 shibas trabalhando'},
 {id:'e1',n:'Marmita (bentô)',c:25000,branch:'equipe',pos:{x:3.0,y:2.4},req:['a2'],tier:6,size:0,fx:{hm:1.25},
   see:'shibas param 1 s pra comer onigiri e correm 25% mais rápido, com notinha músical'},
 {id:'a5',n:'Kei-truck',c:76000,branch:'equipe',pos:{x:1.4,y:3.6},req:['a3'],tier:7,size:2,fx:{autosack:1,sack:1.33,hv:1.3},
   see:'KEYSTONE: kei-truck branco vai e volta recolhendo os sacos sozinho e bascula na barraca'},
 {id:'a11',n:'Shiba Novato',c:38000,branch:'equipe',pos:{x:2.9,y:4.0},req:['a4'],tier:7,size:0,fx:{help:1},
   see:'Pochi, filhote de capacete grande demais'},
 {id:'a7',n:'Silo',c:97000,branch:'equipe',pos:{x:2.1,y:4.6},req:['a5'],tier:7,size:1,fx:{silo:1},
   see:'silo com visor de nível no pátio; libera renda offline'},
 {id:'a6',n:'Pás pros Shibas',c:240000,branch:'equipe',pos:{x:3.7,y:3.5},req:['e1'],tier:8,size:0,fx:{hm:1.25},
   see:'tigelas dos ajudantes viram pás; torrões maiores'},
 {id:'a8',n:'Mais Shibas',c:320000,branch:'equipe',pos:{x:3.7,y:5.1},req:['a11'],tier:8,size:0,fx:{help:2},
   see:'7 shibas; passam a cantar "wan-wan-ho!" em coro'},
 {id:'e3',n:'Apito do Capataz',c:140000,branch:'equipe',pos:{x:2.9,y:5.6},req:['a7'],tier:8,size:0,fx:{hv:1.15},
   see:'um shiba de apito marca o ritmo; ajudantes cavam sincronizados'},
 {id:'a9',n:'Esteira',c:1200000,branch:'equipe',pos:{x:3.6,y:6.7},req:['e3'],tier:9,size:1,fx:{hv:1.3},
   see:'esteira do pé da montanha ao silo com grãos rolando'},
 {id:'e4',n:'Capacetes',c:1300000,branch:'equipe',pos:{x:4.5,y:4.5},req:['a6'],tier:10,size:0,fx:{hm:1.11},
   see:'todos os ajudantes de capacete amarelo e colete refletivo'},
 {id:'a10',n:'Capatazes',c:3000000,branch:'equipe',pos:{x:4.4,y:6.1},req:['a8'],tier:10,size:0,fx:{help:1},
   see:'capataz em mini-escavadeira amarela'},
 {id:'e5',n:'Rádio da Obra',c:3600000,branch:'equipe',pos:{x:4.3,y:7.7},req:['a9','a10'],tier:11,size:0,fx:{hv:1.15},
   see:'antena no pátio; balões "copiado!" e enka baixinho no rádio'},
 {id:'p1',n:'Piloto pro Trator',c:210000,branch:'maquinas',pos:{x:-0.7,y:1.0},req:[],tier:8,size:1,fx:{pilot:'trator'},
   see:'Goma sobe no trator estacionado e empurra ondas sozinha (placa PRECISA-SE some)'},
 {id:'p2',n:'Piloto pra Empilhadeira',c:590000,branch:'maquinas',pos:{x:-1.5,y:2.0},req:['p1'],tier:9,size:1,fx:{pilot:'empilhadeira'},
   see:'Kuro pilota a empilhadeira e empilha paletes no pátio'},
 {id:'p3',n:'Piloto pra Escavadeira',c:2000000,branch:'maquinas',pos:{x:-2.2,y:3.0},req:['p2'],tier:10,size:1,fx:{pilot:'escav'},
   see:'Shiro opera a escavadeira num terraço próprio'},
 {id:'e2a',n:'Oficina',c:1400000,branch:'maquinas',pos:{x:-3.0,y:2.4},req:['p2'],tier:10,size:0,fx:{pm:1.15},
   see:'galpao-oficina; máquinas pilotadas ganham pintura nova e brilho'},
 {id:'bg1',n:'Projeto Bagger 1/3: Esteiras',c:6300000,branch:'maquinas',pos:{x:-2.1,y:4.6},req:['p3'],tier:11,size:1,fx:{part:1},
   see:'comboio traz as 3 esteiras; guindastes e soldadores no pátio'},
 {id:'p4',n:'Frota da Pá de Cabo',c:4700000,branch:'maquinas',pos:{x:-2.9,y:4.0},req:['p3'],tier:11,size:1,fx:{pilot:'pacabo'},
   see:'2 caminhões amarelos de shibas entram no ciclo; a pá de cabo nunca para'},
 {id:'e2b',n:'Turno da Noite',c:4200000,branch:'maquinas',pos:{x:-3.7,y:3.5},req:['e2a'],tier:11,size:0,fx:{pm:1.13},
   see:'torres de luz; faróis e giroflex nas máquinas pilotadas à noite'},
 {id:'bg2',n:'Projeto Bagger 2/3: Torre e Contrapeso',c:10000000,branch:'maquinas',pos:{x:-2.9,y:5.6},req:['bg1'],tier:11,size:1,fx:{part:1},
   see:'torre e contrapeso sobem; silhueta já tapa o sol da tarde'},
 {id:'b0',n:'Buzina',c:293,branch:'maquinas',pos:{x:-3.6,y:6.7},req:['bg2'],tier:12,size:0,fx:{horn:1},
   see:'botão BUZINA: onda de choque visível, corvos e shibas pulam'},
 {id:'p5',n:'Piloto pro Caminhão',c:11000000,branch:'maquinas',pos:{x:-3.7,y:5.1},req:['p4'],tier:12,size:1,fx:{pilot:'caminhao'},
   see:'o 797 do Kome entra na frota com Pochi no volante (só se vê o capacete)'},
 {id:'b1',n:'Roda Turbo',c:8400000,branch:'maquinas',pos:{x:-4.3,y:7.7},req:['b0'],tier:12,size:0,fx:{dig:1.2},
   see:'roda gira 20% mais rápido; caçambas viram borrão, "tchac" mais agudo'},
 {id:'b2',n:'Lança Longa',c:10000000,branch:'maquinas',pos:{x:-4.4,y:6.1},req:['b0'],tier:12,size:0,fx:{boom:1.3},
   see:'lança estica de 560 pra 730 px com treliça nova'},
 {id:'bK',n:'Mordida Perfeita+',c:14000000,branch:'maquinas',pos:{x:-5.9,y:8.1},req:['b1','b2'],tier:12,size:2,fx:{mordida:1},
   see:'KEYSTONE: faixa perfeita 0,35-0,75 e x1,6; arco fica dourado e 3 perfeitas seguidas disparam "x3 NESTA MORDIDA"'},
 {id:'b3',n:'Caçambas de Titânio',c:18000000,branch:'maquinas',pos:{x:-5.1,y:8.7},req:['b1'],tier:12,size:1,fx:{powMul:1.5,titan:1},
   see:'caçambas azul-titânio; o Núcleo Koshihikari solta lascas douradas a 100%'},
 {id:'b4',n:'Esteira Tronco Dupla',c:24000000,branch:'maquinas',pos:{x:-6.0,y:6.5},req:['b2','a9'],tier:12,size:0,fx:{sell:1.15},
   see:'segunda esteira paralela até os silos; fluxo de grãos dobra de espessura'},
 {id:'s1',n:'Sacos Maiores',c:840,branch:'sorte',pos:{x:-1.2,y:-0.4},req:[],tier:3,size:1,fx:{sack:1.5},
   see:'sprite do saco 30% maior com laço vermelho'},
 {id:'s2',n:'Grao Dourado',c:1100,branch:'sorte',pos:{x:-2.4,y:-0.8},req:['s1'],tier:3,size:1,fx:{crit:0.04,critMult:5},
   see:'grãos dourados no jato; pop crítico amarelo com "kin!"'},
 {id:'s3',n:'Onigiri da Sorte',c:2000,branch:'sorte',pos:{x:-2.1,y:-1.7},req:['s1'],tier:4,size:1,fx:{oni:0.08},
   see:'onigiri voador com asinhas cruza a tela a cada 45-70 s'},
 {id:'s4',n:'Faro de Shiba',c:9600,branch:'sorte',pos:{x:-3.6,y:-1.2},req:['s2'],tier:5,size:2,fx:{gold:10,glow:1},
   see:'KEYSTONE: bolsões brilham através da superfície; nariz do Kome fareja e aponta'},
 {id:'s5',n:'Sacos de Seda',c:23000,branch:'sorte',pos:{x:-3.9,y:-0.2},req:['s2'],tier:6,size:0,fx:{sack:1.3},
   see:'sacos roxos de seda; estouram com confete'},
 {id:'s6',n:'Mural Maior',c:49000,branch:'sorte',pos:{x:-3.3,y:-2.1},req:['s3'],tier:7,size:0,fx:{mis:0.08},
   see:'mural de missões de madeira no pátio; baús de missão maiores'},
 {id:'s7',n:'Peneira de Ouro',c:210000,branch:'sorte',pos:{x:-4.8,y:-1.5},req:['s4'],tier:8,size:0,fx:{crit:0.05},
   see:'críticos soltam chuva de 6 moedas; ajudantes também'},
 {id:'s8',n:'Sacos Dourados',c:290000,branch:'sorte',pos:{x:-5.1,y:-0.6},req:['s5'],tier:8,size:0,fx:{sack:1.3},
   see:'sacos dourados com brilho e raio de luz ao estourar'},
 {id:'s9',n:'Onigiri Duplo',c:430000,branch:'sorte',pos:{x:-4.4,y:-2.5},req:['s3'],tier:9,size:0,fx:{oni:0.12},
   see:'onigiris passam em dupla; o segundo é de ume com ponto vermelho'},
 {id:'s10',n:'Veio de Ouro',c:810000,branch:'sorte',pos:{x:-5.9,y:-1.9},req:['s7'],tier:9,size:0,fx:{gold:12},
   see:'bolsões ligados por veios dourados visíveis no corte da montanha'},
 {id:'s11',n:'Chá da Obaa-san',c:590000,branch:'sorte',pos:{x:-5.6,y:-2.9},req:['s9'],tier:9,size:0,fx:{vis:0.05},
   see:'mesinha de chá no pátio; visitantes ficam +5 s e pagam mais'},
 {id:'s12',n:'DESLIZAMENTO!',c:1200000,branch:'sorte',pos:{x:-6.3,y:-1.0},req:['s8'],tier:10,size:1,fx:{slide:1},
   see:'avalanche >40.000 px² vira evento: banner, câmera treme, iene x1,5 por 3 s'},
];
```

Purchases in a full run: 68 nodes + 11 tools + 6 house stages = **85, one per 53 s** in the active sim (max gap 144 s).

## 7. HOUSE (¥160M)
```js
const HOUSE=[
 {id:'h1',n:'Terreno',                  c:200000,  tier:7, req:null, perk:{help:+1},  draw:'placa VENDIDO, corda, bandeirinha; um shiba novo sai do terreno',  cut:'house_terreno'},
 {id:'h2',n:'Fundação',                 c:3000000, tier:9, req:'h1', perk:{sell:1.25},draw:'laje, estacas, betoneira, pegada do Kome',                       cut:'house_fundacao'},
 {id:'h3',n:'Estrutura de Hinoki',      c:12000000,tier:11,req:'h2', perk:{offCap:4}, draw:'esqueleto de madeira, paredes shoji, engawa',                     cut:'house_estrutura'},
 {id:'h4',n:'Telhado Kawara',           c:28000000,tier:12,req:'h3', perk:{nightGlow:1},draw:'telhas azul-cinza, shachihoko, lanterna acesa à noite',         cut:'house_telhado'},
 {id:'h5',n:'Jardim com Lago de Carpas',c:48000000,tier:12,req:'h4', perk:{sell:1.3}, draw:'lago com nishikigoi nadando, tōrō, ponte, momiji',               cut:'house_lago'},
 {id:'h6',n:'Onsen',                    c:70000000,teaser:35000000,tier:12,req:'h5',perk:{end:1},draw:'rotenburo, vapor, capivara hóspede',                  cut:'ending_onsen'}
];
```
Total 161.2M (the flyer rounds to ¥160M).

Joke (kept): the flyer shows the Onsen at ¥35M until `h2` is bought. Then the corretor's letter (`carta_corretor`) says "o iene mudou :) o onsen subiu de ¥35M pra ¥70M". The real cost was always 70M. This is a scripted story beat, shown once, 20+ minutes before the Onsen is reachable; it is not a reward that fails to arrive (§14 rule 1), and no other price in the game ever changes.

## 8. Events, juice and gamification

### 8.1 VISUAL FEEDBACK RULE
**No purchase is number-only.** Every entry in `TOOLS`, `TREE`, `HOUSE`, `ACH` and `MISSIONS` carries a `see` (or `draw`) field, and the build fails a unit test if one is empty. When a purchase lands, its `see` change plays within 0.5 s, on screen, with the camera nudging toward it if it is off-screen. Three more rules:
1. The change is permanent and stays visible for the rest of the run (a sprite, a palette, a size, a speed), not only a one-off particle.
2. Strength reads without numbers: bigger crater, thicker and farther grain jet, deeper bass, more shake, faster animation.
3. Yen pops scale with **magnitude relative to current income**, so a big hit always looks big:

| Pop worth (seconds of current ¥/s) | Size | Colour | Extra |
|---|---|---|---|
| < 0.5 s | 12 px | white | none |
| 0.5-2 s | 16 px | pale yellow | small bounce |
| 2-10 s | 22 px | orange | bounce + 4 coins |
| 10-60 s | 30 px | gold | coin burst, counter "bump" |
| > 60 s | 40 px | rainbow outline | 60 ms hit-stop, banner |

**Per tool tier** (each row is also a camera zoom step, a bespoke sprite, a use animation and a use sound):

| # | Tool | Crater per action | Grain jet (count, distance) | Shake | Bass / sound | Use animation | Helper swap |
|---|---|---|---|---|---|---|---|
| 1 | Pata | 6 px scratch | 3 grains, 20 px | 0 | soft "pof" | 8 fps paw flurry | n/a |
| 2 | Hashi | 8 px pits | single grains, 30 px arc into bowl | 0 | "tic" (woodblock) | 14 fps pluck | n/a |
| 3 | Tigela | 11 px bowl | 8 grains, 60 px arc over shoulder | 0 | ceramic "clac" + rain of grains | scoop-throw | n/a |
| 4 | Pá | 15 px wedge | 12 grains + 2 clods, 80 px | 1 px | "tchac" 200 Hz | swing with squash | helpers: bowls |
| 5 | Duas Pás | 19 px, 38 px on spin | 2 × 12 grains, 90 px, both sides | 1 px, 3 on spin | "tchac-tchac" stereo | alternate + spin | bowls |
| 6 | Carrinho | 28 px notch | 30-grain pour on tip, 100 px | 2 px | squeaky wheel + "fwump" 150 Hz | ram-fill-tip | bowls → shovels with `a6` |
| 7 | Trator | 44 px blade cut | rolling wave sprite + 40 grains, 140 px | 3 px | diesel loop 90 Hz | wheels, blade, exhaust puffs | helpers push mini-barrows |
| 8 | Empilhadeira | 36×16 px block notch | block sprite + 20 grains, crumbs trail | 3 px on stab | electric whine + "ka-chunk" 80 Hz | mast and forks | mini-barrows |
| 9 | Escavadeira | 72 px bite | 80 grains from bucket, 200 px | 4 px | hydraulic hiss + 70 Hz thud | IK arm | capataz in mini-excavator (`a10`) |
| 10 | Pá de Cabo | 100 px arc | 200-grain waterfall on dump, 260 px | 6 px on dump | cable groan + 55 Hz boom | hoist-swing-dump | helpers wear hard hats (`e4`) |
| 11 | Caminhão | 100 px arc ×3 per load | bed pour: 400-grain sheet, dust cloud | 8 px on dump | V20 rumble 45 Hz + air horn | bed raise, suspension sag | helper trucks (`p4`) |
| 12 | Bagger 293 | continuous 110 px wheel | conveyor stream + falling face | 4 px constant, 12 px cap | 35 Hz drone + 6 "tchac"/s | wheel, boom, crawl | helpers in mini-tractors feed the wheel |

**Per upgrade node:** the `see` field of each of the 68 nodes in §6. **Per house stage:** the `draw` field in §7. **Per achievement:** one paper lantern is added to a string across the pátio (30 lanterns when complete) and a stamp lands in the Caderno. **Per mission:** the chest sprite on the mission chip opens and its coins fly to the ¥ counter.

### 8.2 Events
- **Combo:** count 0..30, `mult = 1 + (cap−1)×count/30`, cap ×1.5 (×1.75 with `combo1`, ×2 with `c8`). Decays after 0.45 s idle. Coin pitch +1 semitone per 5 counts. The multiplier is printed beside the bar ("×1,35").
- **Grão-surpresa:** while combo ≥ 10, every 8-20 s (uniform) a golden grain appears at a random spot inside Kome's reach for 4 s; digging it gives +10 combo and a pop worth 3 s of income.
- **Sacos (variable ratio):** the next sack arrives after `20 s × U(0.5,1.5)` of Kome digging. Value = gacha × 1.0 s of Kome's income × `ST.sack` × `U(0.8,1.2)`, so two sacks are never identical. Gacha: ×0.5 / ×1.2 / ×3 / ×10 at 20 / 55 / 20 / 5%. Tap to pop; expires in 12 s. Anticipation: the sack shakes for 1.0 s (1.5 s and harder for ×3, 2.5 s with a glow for ×10) before it bursts. The ×10 gets hit-stop and a banner.
- **Surpresa pra cima:** every 0.4 s yen batch of Kome has a 1 in 120 chance to be ×3 ("×3 NESTA PATADA / CONCHADA / MORDIDA"). About +1.7% income, not in the sim.
- **Onigiri da Sorte (`s3`):** every 45-70 s, worth 8 s of total income (12 s with `s9`), ×2 at night. A flute trill plays 1.5 s before it enters the screen.
- **Corvos (tier 5+):** every 60-90 s one lands on a loose sack and steals it after 6 s. Tap scares it. `a3` removes them.
- **Visitantes (tier 5+, every 180-240 s):**
  - Obaa-san: "cave N tigelas em 25 s" (N = 20 s of current rate), pays 15 s of income. If missed she says "quase! faltaram 12 tigelas" (the real number) and leaves a ×1.2 sack anyway.
  - Tanuki ladrão: tap him and he drops a ×3 sack.
  - Capivara turista (Bagger only): photo gives sell ×2 for 15 s.
- **Trem (`m8`):** every 20 s; tapping the whistle icon as it passes gives 3 s of income.
- **DESLIZAMENTO! (`s12`):** an avalanche moving more than 40,000 px² in 1 s gives yen ×1.5 for 3 s (30 s cooldown).
- **Fúria/TURBO (`c7`):** 10 s at max combo → a "3, 2, 1" count on the combo bar → 5 s of yen ×2. Kome howls and the buckets glow.
- **Mochi:** elastic wobble and "boing" on a bounce; pink shards when torn.
- **Day/night:** 6 min cycle, sky gradient and tint only, lit windows and headlights.
- **Tier purchase:** delivery truck, sparkle eyes, 1.5 s zoom tween, `tool_get` sting, one more music layer, and the old machine drives itself to the garagem.
- **Foreshadowing:** from the escavadeira on, a silhouette convoy carries the wheel across the background.
- **Unit ladder toasts** (1 px² = 40 grãos): tigela 3e3, saco 1.5e5, kei-truck 1.5e6, caçamba do 797 1.4e7, silo 3e7, Monte Fuji 3.77e8 (the whole mountain).
- **Shake:** capped at 12 px, with a toggle.
- **Refill guard:** if less than 4% remains and `h6` is unpaid, a train dumps 12% of new mochi-grade rice ("arroz importado").

Sim income fractions for these (active player): sacks 9.3% × `sack`, onigiri 8% (12%), visitors 3% (5% with `s11`), missions 5% (8% with `s6`), achievements +1% each.

### 8.3 Gamification layer
All of it is data: JS literals plus one `check(state)` per entry. No new art beyond icons, the lantern, the chest and the stamp.

**(a) Always-visible goal bars.** Three bars never leave the HUD (§11): next tool (bottom-left), next house stage (flyer, top-right), mountain (top-centre). Each shows "faltam ¥X" or "faltam X%" and an ETA at current income ("≈ 40 s"). Bars start visually at 12% (`shown = 0.12 + 0.88 × real`); the "faltam" number is always the exact real value.

**(b) Conquistas (30).** Each gives one **Selo** = +1% yen forever (max +30%), a lantern in the pátio and a stamp in the Caderno. A few add a cosmetic.

```js
const ACH=[
 {id:'k01',n:'Primeira Patada',      cond:s=>s.dug>=100,               rw:'selo'},
 {id:'k02',n:'Mil Grãos',            cond:s=>s.grains>=1e3,            rw:'selo'},
 {id:'k03',n:'Hashi Ninja',          cond:s=>s.tool>=1&&s.bestCombo>=30,rw:'selo'},
 {id:'k04',n:'Primeiro Iene Suado',  cond:s=>s.earned>=1e3,            rw:'selo'},
 {id:'k05',n:'Estourador',           cond:s=>s.sacks>=10,              rw:'selo'},
 {id:'k06',n:'Sorte Grande',         cond:s=>s.sack10>=1,              rw:'selo + laço dourado nos sacos'},
 {id:'k07',n:'Patrão',               cond:s=>s.helpers>=1,             rw:'selo'},
 {id:'k08',n:'Espanta-Corvo',        cond:s=>s.crowsScared>=5||s.has('a3'),rw:'selo'},
 {id:'k09',n:'Garimpeiro',           cond:s=>s.pockets>=3,             rw:'selo'},
 {id:'k10',n:'Duas Mãos, Duas Pás',  cond:s=>s.spins>=25,              rw:'selo'},
 {id:'k11',n:'Combo de Mestre',      cond:s=>s.comboMaxSecs>=30,       rw:'selo'},
 {id:'k12',n:'Tirou a Carta',        cond:s=>s.tool>=6,                rw:'selo + chaveiro no retrovisor'},
 {id:'k13',n:'Dono de Terreno',      cond:s=>s.has('h1'),              rw:'selo'},
 {id:'k14',n:'Paleteiro',            cond:s=>s.pallets>=25,            rw:'selo'},
 {id:'k15',n:'Milionário',           cond:s=>s.earned>=1e6,            rw:'selo'},
 {id:'k16',n:'Primeiro Piloto',      cond:s=>s.pilots>=1,              rw:'selo'},
 {id:'k17',n:'Quebra-Mochi',         cond:s=>s.dugMochi>=1e5,          rw:'selo'},
 {id:'k18',n:'Amigo da Obaa-san',    cond:s=>s.obaaWins>=3,            rw:'selo'},
 {id:'k19',n:'Pega Ladrão',          cond:s=>s.tanuki>=3,              rw:'selo'},
 {id:'k20',n:'Balanço Perfeito',     cond:s=>s.fullDippersRow>=5,      rw:'selo'},
 {id:'k21',n:'Carga Coroada',        cond:s=>s.crowned>=5,             rw:'selo + bandeirinha no 797'},
 {id:'k22',n:'Frota Completa',       cond:s=>s.pilots>=5,              rw:'selo'},
 {id:'k23',n:'Engenheiro',           cond:s=>s.has('bg2'),             rw:'selo'},
 {id:'k24',n:'1 Shiba, 14.200 t',    cond:s=>s.tool>=11,               rw:'selo'},
 {id:'k25',n:'Mordida Perfeita',     cond:s=>s.perfectSecs>=60,        rw:'selo'},
 {id:'k26',n:'Coração de Ouro',      cond:s=>s.dugKoshi>=1e5,          rw:'selo'},
 {id:'k27',n:'Meia Montanha',        cond:s=>s.dugFrac>=.5,            rw:'selo'},
 {id:'k28',n:'Árvore Florida',       cond:s=>s.nodes>=40,              rw:'selo + sakura na árvore do menu'},
 {id:'k29',n:'Um Monte Fuji',        cond:s=>s.grains>=3.77e8*.9,      rw:'selo'},
 {id:'k30',n:'Casa no Japão',        cond:s=>s.has('h6'),              rw:'selo + moldura dourada no Caderno'}
];
```
The sim assumes 2 Selos per tool tier owned (26 by the ending), which matches the order above.

**(c) Missões (3 slots, rotating).** A finished or skipped slot refills after 20 s from the templates the current tier allows, never repeating the last two templates of that slot. Reward = seconds of **current** income, paid from a chest with a 1.2 s wobble; the chest rolls ×1 / ×1.5 / ×3 at 60 / 30 / 10%. Missions are optional and never expire; a "trocar" button swaps one for free every 60 s. `N` scales with current rates so a mission takes 45-90 s.

```js
const MISSIONS=[
 {id:'q01',t:1, txt:'Cave {N} tigelas de arroz',            n:s=>45*s.rate,     rw:10},
 {id:'q02',t:1, txt:'Segure o combo no máximo por {N} s',    n:()=>12,           rw:10},
 {id:'q03',t:3, txt:'Estoure {N} sacos',                     n:()=>3,            rw:8},
 {id:'q04',t:4, txt:'Cave {N} de Arroz Prensado',            n:s=>40*s.rate,     rw:12},
 {id:'q05',t:5, txt:'Ache um bolsão dourado',                n:()=>1,            rw:15},
 {id:'q06',t:5, txt:'Dê {N} giros-helicóptero',              n:()=>6,            rw:8,  tool:'duaspas'},
 {id:'q07',t:5, txt:'Espante ou ignore: deixe 0 sacos pros corvos por 60 s', n:()=>60, rw:8, until:'a3'},
 {id:'q08',t:7, txt:'Cause um deslizamento de {N} px²',      n:()=>20000,        rw:12},
 {id:'q09',t:8, txt:'Monte {N} paletes',                     n:()=>5,            rw:10, tool:'empilhadeira'},
 {id:'q10',t:9, txt:'Quebre {N} de MOCHI DURO',              n:s=>40*s.rate,     rw:15},
 {id:'q11',t:10,txt:'{N} conchadas cheias seguidas',         n:()=>4,            rw:12, tool:'pacabo'},
 {id:'q12',t:11,txt:'{N} cargas coroadas',                   n:()=>2,            rw:15, tool:'caminhao'},
 {id:'q13',t:12,txt:'{N} s de Mordida Perfeita',             n:()=>20,           rw:15, tool:'bagger'},
 {id:'q14',t:4, txt:'Compre qualquer melhoria da Árvore',    n:()=>1,            rw:8}
];
```
(14 templates; `tool` limits a template to that rung, `until` retires it.) Average: one mission per 2-2.5 min at about 10 s of income, which is the 5% (8% with `s6`) in the sim.

**(d) Caderno do Kome (album).** Four tabs, each entry a card that starts as a silhouette with a **question** and flips to the answer on unlock (§14 rule 8). Finishing a tab gives a cosmetic (kasa colours), never power.

```js
const ALBUM={
 tools:   TOOLS.map(t=>t.id),                                        // 12, unlock on purchase
 helpers: ['goma','kuro','shiro','mame','pochi','tetsu','obaasan','corretor'],
 visitors:['corvo','tanuki','capivara','onigiri_voador','trem','grao_surpresa'],
 facts:[
  {id:'f_trator', q:'Quantos shibas pesa um trator?',            a:'Um trator agrícola médio (75 cv) pesa uns 3.500 kg: 350 shibas de 10 kg.'},
  {id:'f_empilh', q:'Quanto arroz uma empilhadeira levanta?',     a:'Uma empilhadeira comum levanta 2.500 kg a 3 m: 16 mil tigelas de arroz de uma vez.'},
  {id:'f_escav',  q:'Quanto cabe na caçamba de uma escavadeira?', a:'Uma escavadeira de 22 t (classe Cat 320) leva cerca de 1 m³ por mordida.'},
  {id:'f_pacabo', q:'Quanto pesa UMA conchada da pá de cabo?',    a:'A P&H 4100XPC carrega ~109 t por conchada (até ~61 m³). A máquina pesa ~1.500 t e funciona na tomada, por um cabo.'},
  {id:'f_797',    q:'Quantos shibas cabem na caçamba de um 797?', a:'O Cat 797F carrega 363 t: 36.300 shibas, ou 2,4 milhões de tigelas. Motor de 4.000 hp, pneus de 4 m de altura, 68 km/h.'},
  {id:'f_797b',   q:'Quantas conchadas enchem o caminhão?',       a:'3 a 4 conchadas da P&H 4100 enchem um 797. No jogo: 3.'},
  {id:'f_bagger', q:'Quantos shibas pesa uma Bagger 293?',        a:'14.200 t = 1.420.000 shibas. Tem 96 m de altura e 225 m de comprimento.'},
  {id:'f_bagger2',q:'Quanto a Bagger 293 cava por dia?',          a:'240.000 m³ por dia com uma roda de 21 m e 18 caçambas de 15 m³. Foi construída em 1995 e precisa de 5 pessoas. No jogo: 1 shiba.'},
  {id:'f_fuji',   q:'Quantos grãos tem a montanha?',              a:'377 milhões. Você contou todos.'}
 ]
};
```
Real-machine numbers are from memory of public spec sheets and must be checked before shipping (§13).

**(e) Celebrations.** One function `celebrate(level, title, sub)`:

| Level | When | What plays |
|---|---|---|
| 1 | tree node, mission done | 0.6 s toast, 8 confetti, "pling" |
| 2 | achievement, keystone, pilot hired, new personal best | 1.5 s banner sliding from the top, 30 confetti, 3-note fanfare, lantern lights |
| 3 | new tool, house stage | 2.5 s full-width banner, 80 confetti, fanfare with the phase's instrument, slow-mo 0.3 s, then the cutscene or sting |
| 4 | Bagger boarded, ending | the cutscene itself |

Banners queue (max one at a time, 0.3 s apart) and never block input.

**(f) Welcome-back.** On load after ≥10 min away: a card "Enquanto você dormia" with the offline yen (§10) counted up over 1.5 s, the silos filled, missions still waiting, the next goal with "faltam ¥X", and a guaranteed ×3 **saco de boas-vindas** to pop. One button: "Bora cavar".

**(g) End-of-run stats and rank** (after `ending_onsen`):
- Time, grãos, "Montes Fuji", biggest sack, best combo time, perfect-bite seconds, crowned loads, pallets, achievements x/30, album x/35, a ¥/s sparkline of the whole run.
- Rank by active time: **S** ≤ 65 min "Shogun do Arroz", **A** ≤ 80 "Daimyō", **B** ≤ 100 "Samurai", **C** ≤ 140 "Fazendeiro", **D** otherwise "Filhote Dedicado". Every rank shows a happy Kome; personal best is saved and shown next time.

## 9. Economy simulation
Assumptions (active player):
- Hold 85% of the time; combo averages halfway to the cap (×1.25, ×1.375, ×1.5).
- Pockets as an average price factor (×1.28, ×1.36, ×1.44).
- Sacks +9.3% × `sack`, onigiri +8/12%, visitors +3/5%, missions +5/8%, Selos +2% per tool tier.
- Carga Coroada averages ×1.10; Mordida averages ×1.25 (×1.33 with `bK`).
- Layer mix per tier (volume factor, val): pata-tigela (1, 1), pá (.9, 1.3), duas pás (1, 1.5), carrinho (1, 1.6), trator (.8, 2.2), empilhadeira (.85, 2.6), escavadeira (1, 2.9), pá de cabo (1, 3.0), caminhão (1, 3.3), bagger (.9, 3.6) then (1, 4.2) with Titânio.
- Helpers `HR=0.08`, pilots `PR=0.25`.

| Time | Tool | ¥/s at buy → end of window | Bought in window (wait s) | Next tool wait | Auto % (max) | Dug % |
|---|---|---|---|---|---|---|
| 0:00 | pata | 3 → 6 | c1 9 | 19 s | 0 | 0.0 |
| 0:28 | hashi | 11 → 16 | m1 24 | 38 s | 0 | 0.0 |
| 1:30 | tigela | 28 → 39 | m_a 25, s1 26, s2 33 | 71 s | 0 | 0.0 |
| 4:05 | pá | 77 → 98 | c_spd 16, a1 20, s3 24, c3 36 | 102 s | 5 | 0.1 |
| 7:23 | duas pás | 203 → 285 | cA 25, a2 26, m_b 35, a3 32, s4 35 | 113 s | 8 | 0.3 |
| 11:49 | carrinho | 475 → 626 | c_reach 23, a4 34, c6 39, m_c 39, s5 39, e1 41 | 144 s | 17 | 0.8 |
| 17:48 | trator | 1,020 → 1,895 | a11 38, s6 46, cB 50, a5 65, combo1 63, a7 71, m5 102, h1 110 | 143 s | 25 | 1.9 |
| 29:16 | empilhadeira | 3,486 → 5,903 | e3 40, cC 50, p1 54, s7 51, a6 56, m_d 59, s8 56, a8 59 | 135 s | 39 | 4.9 |
| 38:36 | escavadeira | 10,778 → 29,198 | s9 40, cD 50, p2 50, s11 47, m7a 57, c7 58, s10 48, m_e 54, a9 59, m8 71 | 93 s | 38 | 9.6 |
| 49:03 | pá de cabo | 36,875 → 81,782 | s12 32, e4 36, e2a 37, m7b 44, p3 47, m_f 50, c8 50, a10 54, h2 53, m9 48 | 80 s | 37 | 20.3 |
| 57:54 | caminhão | 116,321 → 151,260 | e5 31, e2b 34, p4 39, bg1 48, m11 49, bg2 66, h3 79 | 86 s | 37 | 32.2 |
| 65:06 | **bagger** | 237,752 → 729,463 | b0 1, b1 35, b2 36, p5 40, bK 49, b3 60, b4 61, h4 63, m10 93, h5 86, h6 96 | END 75:26 | 20 | 45.9 |

Node ids are those of §6; the number after each is the wait in seconds since the previous purchase.

Results:

| Run | Finish | Purchases | Max gap | Bagger arrives | Mountain at Bagger | Bagger phase | Dug at end | Max auto % |
|---|---|---|---|---|---|---|---|---|
| Active (85% hold) | 75.4 min | 85 (1 per 53 s) | 144 s | 65.1 min | 46% dug | 10.3 min | 91% | 39% |
| Casual (60% hold) | 97.3 min | 85 (1 per 69 s) | 190 s | 83.7 min | 47% dug | 13.6 min | 92% | 48% |
| Lazy (30% hold, no combo or taps) | 164.1 min | 85 (1 per 116 s) | 396 s | 139.0 min | 62% dug | 25.1 min | 130% | 60% |

- Total spend ¥377.0M against ¥377.4M earned in the active run.
- Asserts in `final4.py`, all passing for the active run: 60-90 min, max gap ≤180 s, Bagger phase ≥9 min, ≤50% dug when the Bagger arrives, 85-95% dug at the ending, auto share ≤45%, 45-60 s per purchase.
- Lazy play ends at 130% dug, so the refill guard (§8.2) fires about three times for a player who mostly idles. That is acceptable but worth watching.
- Tuning knobs, in order: `G12` (cost base of the tier-12 nodes), Bagger `A`, `PR`, `HR`, per-node `frac` in `final4.py`.

## 10. Ending, infinite mode, offline, save
- **Ending (`ending_onsen`):** night and fireworks. Kome in the onsen with a towel and a bowl of gohan, the capivara beside him, the Bagger parked like a dog house with the five legacy machines lined up beside it, a crater where the mountain was. Then the stats and rank screen (§8.3 g).
- **Montanha N (infinite, no forced prestige):** button "Chegou outra montanha". Keeps tools, tree, house, Selos and album. New seed; prices and values ×6^(n−1). Cosmetic goals at ×6 each: Garagem do Bagger, Portão Torii, Casa de Chá, Castelo de Arroz. About 15 min per mountain.
- **Modo Jardim** (post-ending sandbox): place any `Art.prop`. This is the engine showcase.
- **Offline (needs `a7` Silo):** `min(away, 1 h [4 h with h3]) × autoYen/s × 0.10`. It never digs the mountain. One hour away is worth about 2.5 min of play. Shown in the welcome-back card.
- **Selos de pata (daily return, optional and small):** the first session of a calendar day stamps a paw print on a 7-box card and gives a sack worth `10 s × min(streak,7)` of income. A missed day is covered automatically by a freeze (one banked per 7 stamps, max 2). If a streak does break, the card silently keeps the old count greyed and two consecutive days restore it. The UI only ever shows stamps collected; it never says what was lost and never counts down.
- **Bom ponto pra parar:** see §14 rule 10.
- **Save:** localStorage key `kome-no-japao-v4`.
  - Shape: `{v:4, money, grains, tool, tree:[ids], house:[ids], n, seed, h:<base64 Uint16 of h×16>, sack, ach:[ids], mis:[{id,p,n}×3], album:[ids], streak:{n,last,frz,old}, best:{time,rank,ips}, stats:{dug,dugMochi,dugKoshi,earned,gold,time,sess,bestSack,sacks,sack10,perfectSecs,crowned,pallets,spins,pockets,comboMaxSecs,bestCombo}, seen:[cutscene ids], opts:{mute,music,shake,hints}, t:Date.now()}`.
  - About 6.5 KB.
  - Autosave every 10 s, on `visibilitychange` and on `beforeunload`.
  - Export/import as a string; reset behind a confirm.
  - Migration: a v3 or v2 save is discarded with a toast.

## 11. HUD/UI (DOM overlay over the canvas)
Landscape logical size 960×540. Portrait switches to 540×960 with the same anchors.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ¥ 1.234.567          [ Montanha 54,1% ▓▓▓▓░░░ faltam 54,1% ]   [flyer] ▣ ⚙│
│ ¥/s 81k ▁▂▃▅▆ +40%                (banners / visitor timers)    casa      │
│ combo ▓▓▓░ ×1,35                                                          │
│ ◈ missão 1 ▓▓░                                                            │
│ ◈ missão 2 ▓░░                                                            │
│ ◈ missão 3 ▓▓▓                                                            │
│                                                                           │
│ [tool: next + bar + faltam]  [slot][slot][slot]        [BUZINA] [ÁRVORE•] │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Top-left (8,8):**
  - `¥` counter at 28 px.
  - `¥/s` at 14 px with a 64×14 **sparkline** of the last 5 min (one sample per 5 s) and a competence line that alternates every 8 s: "+40% vs 5 min atrás", "recorde: ¥81k/s", the unit line ("= 3 kei-trucks").
  - 120×8 combo bar with the multiplier printed; gold during Fúria.
  - **Mission chips**, 3 × (150×22): icon, short text, mini bar; a finished chip becomes a wobbling chest to tap. A small arrow collapses them to three 22 px icons (default collapsed in portrait).
- **Top-centre:** "Montanha 54,1%" bar, 240×10, with layer-colour ticks and "faltam". Banners (§8.3 e) and visitor timers appear below it.
- **Top-right:**
  - Flyer da casa, 104×76: the silhouette fills per stage, shows the next stage's price, "faltam ¥X" and a fill bar, pulses when affordable, tap to pay.
  - Caderno button (▣, 36 px) with a badge for new stamps: tabs Conquistas, Álbum, Selos de pata, Recordes.
  - Gear: mute sfx, mute music, shake, hints, export/import, reset.
- **Bottom bar (h 64):**
  - Left: `toolBtn`, 200×56, current tool icon, next tool name, price, "faltam ¥X ≈ 40 s" and bar.
  - Centre: 3 quick-shop slots, 150×56, the 3 cheapest lit nodes with fill bars and their branch colour, so most small nodes are bought without opening the map.
  - Right: BUZINA (Bagger phase only) and "ÁRVORE" with a badge counting affordable nodes.
- **Árvore panel:** full-screen pannable map over a dimmed game that keeps running. Opens centred on the cheapest lit node. Tap a node for a card (name, price, effect, `see`, "faltam ¥X"); tap again to buy. Branch shortcuts along the top edge.
- **World-space UI:** Mordida arc and RPM on the wheel, Carga gauge on the truck bed, dipper fill on the rope shovel, yen pops, "duro demais!" bubble, "PRECISA-SE PILOTO" signs.
- **Touch:**
  - Pointer events only, `touch-action:none`.
  - Hold = dig toward the finger. Every rung uses only position + hold.
  - Tap sacks, onigiri, chests and crows with a hit radius of at least 40 px on screen.
  - All buttons at least 44 px. In portrait the bottom bar wraps to 2 rows and mission chips are icons.
  - Cutscenes: tap advances, hold 0.5 s skips.
- Canvas text and drawn icons only; no emoji.
- Nothing in the HUD blinks to demand attention except affordable goals (one soft pulse every 3 s).

## 12. Art assets + cutscenes
Everything goes through `Art.prop(name,{pal,scale,t})` with the Kome palette and the 1 px `#3B2818` outline.

**Characters**
- Kome. Poses: sit, dig, pluck, scoop, swing, dual-swing, spin, push, drive (cab), pilot (hard hat over the kasa), surprise, sparkle-eyes, yawn, sleep, onsen. Plus a 96 px hi-res face for close-ups and the tree centre node.
- Helpers Goma, Kuro, Shiro, Mame, Pochi (palette swaps; bowl, shovel, hard-hat, driver variants) and capataz Tetsu (grey muzzle, moustache).
- Obaa-san shiba; Corretor shiba (suit, hanko, smug); tanuki; corvo; capivara; nishikigoi (3 palettes, procedural swim).

**Machines (each rung is bespoke: sprite, use animation, sound, zoom step)**
- Paw tools: hashi, tigela, pá, duas pás (mirrored pair), carrinho.
- Trator (blade, exhaust); Empilhadeira (mast, forks, block and pallet sprites); Escavadeira (2-bone arm + bucket).
- Pá de cabo elétrica (crawler base, revolving house, boom, dipper handle, dipper with door, hoist cables as lines, trailing power cable).
- Caminhão de mineração (chassis, 6 wheels of 4 m, tilting bed with fill mask, ladder, Kome in the tiny cab); Moega móvel.
- Kei-truck, mini-escavadeira, mini-trator, helper haul truck, delivery truck, convoy lowboy, crane, train (loco + 3 hoppers).
- "PRECISA-SE PILOTO" sign, garagem slots.
- **Bagger 293 rig, 14 parts:** crawlers ×3, undercarriage, turntable, tower, boom lattice, wheel, bucket, counterweight arm, cables (lines), discharge bridge, cabin, conveyor texture. Static parts are pre-rendered offscreen.

**Buildings and props**
- Barraquinha (noren ×2, scale, queue); Kakashi; nobori banners; mural de missões; mesinha de chá.
- Silo; Esteira; Esteira Tronco (single, double); Fábrica de Onigiri; station platform + ekiben kiosk; containers + port crane; Destilaria (komodaru); rail line; cargo ship; billboard; oficina; light towers; antenna; lantern string (30).
- House in 6 layers (per §7); lago de carpas; onsen.
- Sack ×4 skins (plain, silk, gold, welcome); chest; onigiri ×2; letter and flyer; stamp, paw-print card.

**Scenery and FX**
- Sky gradients ×4, far mountains, village silhouette.
- Rice surface shading per layer; pocket glints and veins.
- FX: grains, clods, blocks, puffs, stars, mochi shards, speedlines, steam, fireworks, sakura, confetti.

**Cutscenes** (`KomeEngine.Cutscene.define`). Each shot is a pure function of `t`. "Full" plays the first time only and a sting plays on repeats. Always skippable; `onEnd` runs identically on skip.

| id | Length | Beats |
|---|---|---|
| `intro` | 12 s | Flyer "CASA NO JAPÃO ¥160.000.000" lands on Kome's face → pop-eye reaction → pan up the endless mountain → title slam "KOME NO JAPÃO" → deadpan "segure pra cavar". |
| `tool_get` | sting 1.5 s, 3 variants | Truck drops a crate → sparkle eyes with radial lines → name slam. Used for hashi, tigela, pá, carrinho. |
| `duaspas_get` | sting 2 s | Kome looks at the shovel, then at his other paw, then at the camera. Second shovel slides in. "DUAS." |
| `first_helper` | 5 s | Goma freeze-frame intro card "GOMA: trabalha por onigiri". |
| `trator_get` | 6 s | Shonen treatment of turning the ignition key → smash cut to the tractor at 3 km/h. |
| `first_pilot` | 4 s | Goma stares at the parked tractor, Kome tosses the keys in slow motion, she catches them in her mouth. Card "nada se aposenta aqui". Later pilots reuse a 1.5 s key-toss sting. |
| `empilhadeira_get` | sting 2.5 s | Forks rise into frame like a mecha launch, beeping reverse alarm, Kome in a too-big safety vest. |
| `escav_get` | sting 2.5 s | The arm unfolds in three impact frames, then pats Kome on the head. |
| `house_terreno` | 5 s | Corretor freeze-frame card → hanko slam (impact frame) → "VENDIDO". |
| `house_fundacao` + `carta_corretor` | 6 s | Concrete pour time-lapse → Kome's paw print → the letter with the price hike → Kome's deadpan hold. |
| `pacabo_get` | 4 s | A lineman shiba plugs a comically huge power plug into a wall socket; village lights dim; the dipper door drops with a clang. "P&H: funciona na tomada." |
| `caminhao_get` | 5 s | Kome climbs the truck ladder (short echo of the Bagger ladder gag), is a dot in the cab; Tetsu salutes from the shovel; air horn. "363 toneladas. 1 shiba." |
| `house_estrutura` | 5 s | Hinoki frame rises in beats to hammer sfx. |
| `bagger_part1`, `bagger_part2` | 3 s each | Convoy arrives, cranes lift, welding sparks; caption "1/3", "2/3". |
| `bagger_reveal` | 12 s; sting `bagger_sting` 2 s | Letterbox. Kome climbs an endless ladder → close-up of the hard hat going over the kasa → paw on the lever → music cuts → wide pull-back to zoom 0.22 with all five legacy machines tiny beside it → horn → title "BAGGER 293 / 96 m. 14.200 t. 1 shiba." |
| `house_telhado` | 4 s | Tiles click on one by one, shachihoko glint. |
| `house_lago` | 6 s | Water fills, koi jump in an arc across the moon, Kome claps. |
| `kome_boceja` | 2 s | Kome yawns and stretches; used by the "bom ponto pra parar" card. |
| `ending_onsen` | 20 s | See §10; credits roll over the crater. |
| `montanha2` | 4 s | A second mountain rises on the horizon; Kome's eye twitches. |

## 13. Risks / cut first
1. **Bagger rig, `digCircle` and Mordida** are still about 30% of the effort and the game's promise. Prototype first, on a flat test slope.
2. **Four new cycle tools** (empilhadeira, pá de cabo, caminhão, plus duas pás) each need a small state machine and bespoke art. The caminhão is the riskiest: two machines, a gauge and a drive loop under position + hold. Fallback: the truck auto-hauls when the gauge passes 100% and the skill becomes only "release in the crowned band".
3. **Legacy machines digging the real heightfield** on separate benches can carve odd shapes or collide with Kome's pit. Fallback: they dig a fixed lane with a simple ramp profile, or they only animate and remove volume from the far right flank.
4. **The sim averages layers and event rates.** Real pit geometry may shift tier value by ±20%; the new `A` values and the koshi `val` 6 were chosen so the averaged mixes hold. Port the sim to call the real `dig()` headlessly.
5. **68-node map on a phone.** Fallback: the quick-shop slots already cover most purchases; the map can open zoomed on one branch at a time.
6. **Lazy players dig 130%** of the mountain before the ending (three refills). If that reads badly, raise helper/pilot `hv` instead of volume.
7. **Real-machine facts** in the album are from memory (P&H 4100XPC payload and weight, 797F figures, Bagger 293 bucket size). Verify against manufacturer sheets.
8. **Tall faces with `slope` 9-12** may leave spires or starve the wheel. Fallback: one slope (3.6) for everything.
9. **Mobile portrait at zoom 0.22** gets small. Fallback: landscape only, with a rotate hint.

Cut order if short on time:
1. Modo Jardim
2. Selos de pata (daily stamps)
3. Album facts tab (keep tools and helpers)
4. Music layers (fall back to a tempo or pitch change)
5. Tanuki and capivara visitors
6. Day/night
7. Synergy pairs and Grão-surpresa
8. Escavadeira IK (fixed swing animation instead)
9. Cutscene variants (keep `intro`, `first_pilot`, `bagger_reveal`, `ending_onsen` and one generic sting)
10. Montanha N goals (keep only the ×6 loop)

Never cut: the 12 bespoke rungs, pilots on the old machines, the 3-part Bagger assembly, the Mordida gauge, Kome visible in every cab, the 6 house stages drawn in the world, the `see` change on every purchase.

## 14. Motor de recompensa
Rules for how rewards are scheduled and shown, with where each is applied. The game is free, offline and single-player, and children may play it.

| # | Rule and how it is applied | Where |
|---|---|---|
| 1 | **Structure is fixed, session rewards vary.** Tool, tree and house prices and all goal bars are deterministic. Session rewards are variable: sack timing `20 s × U(0.5,1.5)`, sack value gacha × `U(0.8,1.2)`, mission chest ×1/×1.5/×3, crit, 1-in-120 "×3 NESTA PATADA", onigiri every 45-70 s. A promised reward always arrives: sacks that expire are collected at ×0.5 by the kei-truck (before `a5` they fade with no message), a missed Obaa-san order still leaves a small sack. | §8.2, §8.3 c |
| 2 | **Anticipation 1-3 s with a fixed cue per reward type.** See the cue table below. | §4, §8.2, §8.3 |
| 3 | **Honest near-miss only.** Every "almost" prints a real measured number: "faltam ¥1.200 pra Pá", "92% da mordida perfeita", "97%: faltou 3% pra carga coroada", "faltaram 12 tigelas". No animation ever pretends a roll was close; the gacha shows only its result. | §3, §8.2, §11 |
| 4 | **Goal gradient and endowed progress.** Every bar appears 12% filled and always shows "faltam X" plus an ETA. Within each tool window node costs rise from about 12% to 60% of the next tool, so several cheap purchases land right after a tool and the tool itself is the last, longest wait (sim: waits inside a window grow, e.g. 23 → 41 s, then 144 s for the tool). | §6, §8.3 a, §9, §11 |
| 5 | **Combo with rising pitch and visible multiplier**, plus the Grão-surpresa at a random position. | §8.2 |
| 6 | **Habituation control.** No reward stimulus stays identical for more than about 20 min. See the rotation table below. | §2, §8.1 |
| 7 | **Competence over presence.** Sparkline of ¥/s, "+40% vs 5 min atrás", personal bests with a level 2 celebration, missions pay for doing (dig, combo, crowned loads), nothing pays for merely being logged in except the small paw stamp. | §8.3, §11 |
| 8 | **Curiosity hooks.** Every album card and every locked machine shows a question first and answers it on unlock ("Quantos shibas pesa uma Bagger 293?"). The next tool button shows the silhouette and one teaser line. | §8.3 d |
| 9 | **Autonomy.** Five branches open in parallel with lit nodes in several at once; synergy pairs make order matter without lock-outs; missions are optional and swappable; toggles for shake, sfx, music and hints; Modo Jardim. | §6, §8.3 c, §11 |
| 10 | **Session health, not coercion.** After 90 min of continuous play, or at a tool purchase or house stage once the session passes 45 min (at most once per 30 min), Kome yawns (`kome_boceja`) and a card offers "Bom ponto pra parar": it saves, shows what the silo will earn while away and promises the saco de boas-vindas. Buttons: "Guardar e descansar" and "Só mais um pouco" (equal size, no default). Declining has no cost and is not asked again for 30 min. | §8.3 f, §10 |

**Cue and anticipation table** (the cue always precedes the reward and is never played without it):

| Reward | Cue (sound + flash) | Anticipation |
|---|---|---|
| Sack | paper rustle + white outline flash | shakes 1.0 s (×3: 1.5 s; ×10: 2.5 s with glow) |
| Golden pocket | rising "shiiing" + outline flash | 0.4 s before hit-stop |
| Onigiri da Sorte | flute trill | 1.5 s before it enters |
| Mission chest | wooden knock ×2 | wobbles 1.2 s, multiplier wheel decelerates |
| Fúria | taiko roll | "3, 2, 1" on the combo bar |
| Pallet (empilhadeira) | strap "zip" | 4th block hovers 0.3 s |
| Rope shovel dump | cable groan rising | the 0.9 s swing |
| Truck dump | reverse beeper | bed rises 1.2 s |
| Mordida ×3 | wheel pitch jumps a fifth | 1 s of gold arc |
| Tool purchase | delivery truck horn | 1.5 s crate drop |
| House stage | hanko "pon" | 1-2 s build beat |
| Achievement | bell "chirin" | stamp descends 0.6 s |

**Rotation table** (reward sound set, particle palette and music layer change together; the longest any set lasts in the active sim is 16 min (set F), about 21 min casual; within F the tool and verb still change at 57:54):

| Set | Tools | Sim window | Coin / reward sound | Particle palette | Music layer added |
|---|---|---|---|---|---|
| A | pata, hashi, tigela | 0-4:05 | kalimba "plim" | white grains, pink sparkle | shakuhachi solo |
| B | pá, duas pás, carrinho | 4:05-17:48 | koto pluck | cream grains, yellow stars | + koto |
| C | trator | 17:48-29:16 | shamisen snap | grains + blue smoke | + shamisen, light taiko |
| D | empilhadeira | 29:16-38:36 | marimba + cash "ka-ching" | beige blocks, orange sparks | + electric bass |
| E | escavadeira | 38:36-49:03 | bell + low taiko | pink mochi shards | + full taiko |
| F | pá de cabo, caminhão | 49:03-65:06 | brass stab | dust clouds, amber sparks | + brass section |
| G | bagger | 65:06-end | orchestra hit + choir "ah" | gold flakes, steam | + choir; tempo +8 bpm |

Each tool also changes the verb itself (§3), which is the strongest reset.

**Excluded by design:** real-money purchases, paid or timed loot boxes, ads, push notifications, guilt or loss-threat messages, countdowns that expire rewards while away, fabricated near-misses, energy or wait timers, and anything that punishes stopping.
