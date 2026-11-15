# Short finishable incrementals: research for "Kome no Japão"

Evidence labels: **[web]** = found in this session's searches; **[mem]** = my own knowledge of the genre, not re-verified today; **[calc]** = my arithmetic/recommendation. No draft files were modified.

## 1. What Potato Please actually is

Reliable info exists, and it is not a classic clicker. **[web]**

- **Identity:** first-person 3D physics job-sim with incremental progression, by Golden Horn Studios. Released on Steam 3 Nov 2026 (12 days ago), $9.99. Tags: Simulation, Incremental, Physics, Job Simulator, Dark Humor, Dystopian.
- **Reception:** Very Positive, about 88-89% across roughly 1,000-2,450 reviews depending on the source. One critic score: Inven 75.
- **Premise:** you are a "comrade" on national service in a Soviet-style regime, peeling potatoes to feed the army. Black comedy, with letters from a son at the front, notes hidden inside potatoes, moral choices, a stray dog and cigarette breaks.
- **Core loop:** pick up a potato, peel it by hand with a bad razor knife (thin cuts waste less), drop it in a water bucket, deliver to the supply bureau, earn money and tool requests.
- **Progression ladder** (per the Inven review and store page):
  1. Razor knife and bucket, at 5-10 s per potato.
  2. Y-peeler, which is forgiving of clumsy input.
  3. Logistics: sacks and handcarts replace hand-to-bucket transport.
  4. Hand-cranked peelers.
  5. Automated machinery ("Peel-o-Matic", sucking potatoes from a pile), at dozens per second.
  6. A crane, after which you are a "Potato Commander" with almost no manual work.
- **Pacing:** slow at first, surging steeply near the end.
- **Length:** 2-4 h for most players, about 2 h rushed, about 5 h to one ending in the Inven review. It has multiple endings and no endless mode.
- **Praised:**
  - Tactile, physical feel of the manual verb.
  - The knife-to-factory sense of progression.
  - Relaxing loop, humor, and sound design.
  - Short and cheap.
- **Complained about** (these are the lessons for us):
  - Automation kills the core verb too early: "premise is dropped about an hour in", peeling becomes hauling burlap sacks, then "operating a crane for 5 minutes" and it ends.
  - Upgrades replace rather than build: a final skill tier upgrades a peeler that is already obsolete.
  - Once automated, "the game plays itself", and automation content stops right after the big unlocks.
  - Abrupt endings and no endless mode.
  - Physics bugs.
  - Satisfaction depends on the tool rather than on skill.
- **Not found:** exact upgrade counts, costs, or a developer postmortem. Do not assume any.

**Takeaway for Kome:** the user wants the Potato Please arc (humble manual verb, then absurd industrial scale). Its top complaint is exactly what our premise fixes: Kome pilots the Bagger, so the final tier stays a hands-on verb.

## 2. Patterns that make these games feel great

**Peer data**
- Median playtimes from nodal.gg **[web]**: Digseum 2.4 h, Nodebuster 3.9 h, To The Core 8.5 h.
- Nodebuster reviews praise the "ideal short length" and pacing that "never overstays its welcome". **[web]**
- A Game About Digging A Hole (about $5, a few hours) is praised for its upgrade loop and criticised for "precious little to buy" and a repetitive loop. **[web]**

**Patterns**
1. **One strong physical verb, upgraded in feel as well as number.** Each tier should change radius, animation, sound and camera, the way Digging A Hole and Potato Please do. **[web/mem]**
2. **Camera zoom-out as the progress bar.** The same mountain looks huge with a paw and small with a Bagger. The draft already has per-tool `zoom` from 3.0 to 0.34; keep it and make it the star.
3. **Verb-changing phase shifts every 10-20 minutes.** Universal Paperclips shifts from clicking to pricing to drones to space; Cookie Clicker from clicking to buildings to synergies; Gnorp Apologue from hitting the rock yourself to gnorps doing it visibly. **[mem]** For us: dig, then carry and sell, then hire helpers, then drive vehicles, then pilot the megamachine.
4. **Automation must be visible in the world.** Every purchased automator is a sprite doing the job on screen (Gnorp, Rusty's Retirement). Menu-only "+10/s" is the weakest form. **[mem]**
5. **Short purchase cadence.** Something affordable every 20-90 s, a big unlock every 5-10 min, and always a visible next goal with a fill bar. The draft's `toolBtn` already has a progress bar. **[mem]**
6. **Costs exponential, production slower.** Classic ratios are 1.07 (AdVenture Capitalist) to 1.15 (Cookie Clicker) per repeat purchase; one cited example uses cost ×1.15 against production ×1.1. **[web]** Those are for 100+ purchase games. Short games use few, chunky purchases.
7. **Just-noticeable difference.** A change under about 20% is not felt (100 vs 120 is noticeable, 100 vs 101 is not). **[web]** No upgrade should be below +20%; prefer +50% to ×2.
8. **Juice that escalates.**
   - Batch number popups (the draft batches yen every 0.4 s, which is good).
   - Raise coin-sound pitch with combo.
   - Scale screen shake with tier, capped.
   - Particles proportional to grains.
   - Hit-stop on big events.
   - HUD counter "bump" animation.
9. **Diegetic goal always on screen.** Show the house price and a house silhouette that fills in, plus intermediate milestones.
10. **Offline progress is optional** in a 60-90 minute game. Autosave is mandatory. If included, cap it (for example 50% rate, 2 h maximum) with a "while you were away" popup.
11. **Prestige is not needed for the first run.** Nodebuster-likes use a run-based meta, but a single-arc game should end with a real ending and then unlock an endless or New Game+ mode. The absence of an endless mode was a Potato Please complaint. **[web]** The draft's "Montanha N ×6" suits this as post-credits.
12. **No dead waits.** Give an active option that beats idle by 2-5× at every moment: golden pockets, combo, sack gacha, flying onigiri (all already in the draft).

## 3. Numeric guidance (about 75 min, 10 tiers, 30-36 upgrades) **[calc]**

These are starting values. Tune them with a headless simulation.

**Tier ladder**

Rule: tier cost is about 4-5× the previous early and about 3.5× late. Income at arrival is about 3.2× the previous, of which roughly 2× comes from the tool and 1.6× from the 3-4 side upgrades bought in that window. Because cost grows a bit faster than income, the wait per tier lengthens gently.

| # | Tool | Cost ¥ | Income on arrival ¥/s | Target time in tier |
|---|---|---|---|---|
| 1 | Pata | 0 | 3 | 0:45 |
| 2 | Hashi | 120 | 8 | 1:30 |
| 3 | Tigela | 700 | 22 | 3 min |
| 4 | Pá | 4,000 | 70 | 5 min |
| 5 | Carrinho de mão | 20,000 | 220 | 7 min |
| 6 | Motocultivador / mini-trator | 90,000 | 700 | 8 min |
| 7 | Trator | 350,000 | 2,200 | 9 min |
| 8 | Escavadeira | 1,200,000 | 7,000 | 10 min |
| 9 | Colheitadeira / draga | 4,200,000 | 22,000 | 11 min |
| 10 | Bagger 293 | 15,000,000 | 80,000 to 150,000 | 8-10 min finale |
| End | Casa no Japão | about 38,000,000 | | |

- Total is about 65 min of tiers plus the finale, so 70-80 min.
- ¥38M is a plausible real Japanese house price, which is a nice touch. Verify if you want realism.
- Overall income growth is about 3×10⁴ to 5×10⁴.

**Side upgrades (30-36 in total, 3-4 per tier window)**
- Each costs 15-40% of the next tier's cost.
- Each gives +25% to ×2 on one axis: dig speed, radius, sell price, sack size, helper count, helper speed, golden-pocket chance, combo cap.
- Budget about 40-50% of a window's income for them.
- If repeatable, use at most 3-5 levels at cost ×1.8-2.2 per level and effect +30-50% per level. Do not use 1.07-1.15 curves; they need dozens of purchases to matter.
- Gate upgrades by tier so obsolete ones never appear. Make most of them global multipliers that carry over to later tools.

**Time to next purchase**
- Minutes 0-5: every 15-40 s.
- Minutes 5-30: every 40-90 s.
- Minutes 30-70: every 60-120 s.
- Never more than about 3 min with nothing affordable.
- First purchase within 45 s. First automation at minute 8-12.

**Manual vs automated income share**

| Minute | Manual share | Notes |
|---|---|---|
| 0-8 | 100% | |
| 10 | about 80% | First helper arrives |
| 30-35 | about 50% | |
| 50 | 25-30% | |
| Finale | Kome's piloting jumps back to 50-70% | Helpers and conveyors become the Bagger's support fleet |

- Keep active play at least 2× idle at all times.
- The draft's `HELPER_SHARE=.22` is fine early but should scale with upgrades.

**Problems in the current draft (game.js)**
- Tool cost ratios are erratic: 5.1, 4.4, 3.5, 3.0, 9.4 (trator), 5.6, then 1.2 (the bagger at 5.5M against the excavator at 4.5M). The climax is nearly free and the tractor is a wall.
- There are only 9 tiers.
- The last tier is named "Bagger 288"; the user asked for the **293**.
- The global `COST_MULT=16` hack signals that the curve was never tuned.

**Simulation:** write a 30-line greedy-buyer script and assert (a) no gap over 180 s, (b) total 60-90 min active, (c) under about 4 h for a lazy player.

## 4. Anti-patterns

- Automation that deletes the fun verb (Potato Please's top complaint). Automate the chores (hauling, selling, bagging), not the digging.
- Upgrades for obsolete tools, and upgrades that do nothing visible.
- An ending that arrives right after the best toy. Give at least 8-10 min with the Bagger, and add an endless mode after the credits.
- Dead waits or paywall-like walls, such as a single 9× cost jump.
- Increments below 20%, or dozens of tiny levels in a short game.
- Menu-only progress, where the numbers go up but the screen does not change.
- Too many currencies. Use two at most: grains, then yen.
- Clicking fatigue. Support hold-to-dig, and add auto-sell early.
- Unreadable number spam and uncapped screen shake. Batch popups and add a shake toggle (Potato Please patched in a shake-reduction option on player request).
- Forced prestige before the first ending.
- Losing the save. Use localStorage autosave every 10-15 s and on `visibilitychange`.
- A mountain that never visibly shrinks. Depletion must be real and legible.

## 5. Ten ideas for our theme

1. **The mountain is the progress bar.** One persistent, deformable rice mountain. Each tier zooms the camera out and reveals that the previous dig site was a small dent. Add a remaining-percentage HUD and the house silhouette behind the mountain, revealed as it shrinks.
2. **Pilotable Bagger 293 finale.** Kome sits in a tiny cabin (chibi shiba with a hard hat over the farmer hat). The player swings the boom with the mouse; the wheel's buckets scoop rice onto a conveyor that streams to the silos, and the yen counter goes wild. Real scale gags, from memory and worth verifying: about 96 m tall, 225 m long, 14,200 t, 18 buckets, about 240,000 m³/day. Show "= 4 bilhões de tigelas/dia" style conversions.
3. **Automate the chores, never the dig.** The order is: sell stall (auto-sell), then tanuki or cat helpers with bowls, then a kei-truck hauling sacks, then a conveyor belt, then silos, then a rice-cooker factory with value-add (rice to onigiri to sake) as sell-price multipliers. Every one is visible on screen.
4. **Absurd unit ladder for comedy.** The counter changes units: grãos, tigelas, sacos, kei-trucks, silos, "Monte Fujis de arroz". Milestone toasts in pt-BR, for example "Você colheu 1 piscina olímpica de arroz".
5. **House as a diegetic multi-stage goal.** A real-estate flyer is pinned to the HUD. Buy the terreno, then the fundação, then the paredes, then the telhado kawara, then the engawa and a koi pond. Each is a milestone purchase that draws onto the scene, so the endgame is 5 payments rather than one long wait. The koi pond doubles as a showcase for the reusable engine.
6. **Layer hardness as soft gates.** The draft has solto, prensado and MOCHI DURO. Make mochi nearly undiggable by hand tools so players feel the need for the next tier, then let the excavator and Bagger tear through it with huge payouts. This is the Digging A Hole depth-gating pattern.
7. **Active bonuses that scale with tier.** Golden rice pockets, flying onigiri, the sack gacha (x0.5, x1.2, x3, x10, already in the draft), and a combo meter that raises sound pitch. Add a rare "arroz dourado koshihikari" vein that is visible inside the mountain cross-section, so players dig toward it.
8. **Rival or NPC flavour for short narrative beats.** A crow or sparrow flock steals rice until you buy a kakashi (scarecrow) upgrade. An obaa-san customer's orders give timed bonus quests. A corretor de imóveis shiba sends increasingly smug letters as the house price inflates once, as a mid-game joke twist.
9. **Tier-purchase cutscenes of 3-5 seconds.** A delivery truck drops the new machine, Kome's eyes sparkle, the camera zooms out, and the music adds a layer (one instrument stem per tier, so the soundtrack is itself an incremental). The Bagger arrives in pieces on a convoy during the previous tier as foreshadowing.
10. **Post-ending endless mode and engine showcase.** After the house cutscene, show Kome on the engawa eating a bowl of rice and looking at the hole where the mountain was. Then unlock "Montanha 2" (the draft's ×6 prestige) plus a sandbox toggle. Add a results screen with stats (time, grains, biggest sack, Baggers' worth of rice) to encourage replays and speedruns.

## Sources

- https://store.steampowered.com/app/5266240/Potato_Please/
- https://steamcommunity.com/app/5266240/reviews/?browsefilter=toprated
- https://www.invenglobal.com/articles/28391/peeling-potatoes-in-potato-please-75
- https://www.gamespew.com/2026/09/potato-please-revealed/
- https://games.gg/potato-please/
- https://www.metacritic.com/game/potato-please/
- https://nodal.gg/game/digseum-3361470
- https://nodal.gg/game/nodebuster-3107330
- https://vaporlens.app/app/3107330/nodebuster.md
- https://mancunion.com/2025/05/08/nodebuster-review-a-short-and-sweet-incremental-game/
- https://opencritic.com/game/18097/a-game-about-digging-a-hole/reviews
- https://gamedeveloper.com/design/the-math-of-idle-games-part-i
- https://ericguan.substack.com/p/idle-game-design-principles

Draft inspected read-only: /tmp/claude-0/-home-user-Pizzaria-Site/73bb5c4b-e898-5ba0-a571-a9a62e6621c9/scratchpad/zip/game.js (TOOLS at lines 8-16, constants at lines 40-41).