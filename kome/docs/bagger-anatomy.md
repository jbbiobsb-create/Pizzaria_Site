# Bagger 293 / mining machinery: visual anatomy for procedural side-view pixel art

Basis: Wikipedia specs for Bagger 293 and 288, a Cat 797F spec search, and the three reference images. Published figures are marked **[src]**. Everything else is my estimate, either measured off `images/1.webp` (a 3/4 perspective photo, so x-distances are approximate) or from general knowledge; treat those as drawing guides, not engineering data. I found no published wheel rpm, boom lengths or joint coordinates. Rope shovel and hydraulic excavator numbers are from memory, not verified this session.

## 1. Bagger 293 parts list (side view)

**Coordinate system:** metres, origin on the ground under the slew axis, +x toward the rear (counterweight/discharge side), -x toward the bucket wheel, +y up. Bounding box: x from -83 to +142 (225 m **[src]**), y from 0 to 96 (**[src]**). Normalised: u = (x+83)/225, v = y/96. Width is 46 m **[src]** (irrelevant in side view, but it is why the crawlers read as a deep band).

The silhouette is three masses: a toothed disc far left on a long horizontal boom; a pyramid of masts over a squat body at centre; a lower, flatter bridge to a small second machine on the right. In the photo the wheel end is the visual "head"; the masts are about 3x taller than the body.

### Key joints (x, y in m)

| ID | Joint | x | y |
|---|---|---|---|
| G | Ground under slew axis | 0 | 0 |
| C1 | Main crawler group extent | -17 to +17 | 0 to 5 |
| S0 | Slew ring (top of substructure) | 0 | 13 |
| P1 | Superstructure deck, front edge | -14 | 15 |
| P2 | Superstructure deck, rear edge | +16 | 15 |
| B0 | Wheel-boom pivot (hinge) | -9 | 26 |
| W | Bucket wheel centre (boom near horizontal) | -72 | 31 |
| Wt | Wheel front tip | -83 | 31 |
| H | Wheel-head pylon top (rope anchor on boom head) | -52 | 46 |
| M1b | Forward leaning mast, base | -6 | 28 |
| M1t | Forward leaning mast, top | -30 | 90 |
| M2b | Vertical tower, base | +3 | 28 |
| M2t | Vertical tower, top (highest point) | +3 | 96 |
| K0 | Counterweight boom root | +4 | 34 |
| K1 | Counterweight boom tip / ballast box end | +48 | 44 |
| Kc | Service crane on counterweight (jib top) | +40 | 70 |
| D0 | Discharge bridge pivot (under superstructure, rear) | +10 | 20 |
| D1 | Discharge bridge far end (on loading unit) | +108 | 24 |
| L | Loading unit centre | +118 | 0 to 30 |
| Lt | Loading unit small mast top | +110 | 38 |
| Le | Loading unit discharge boom tip | +142 | 14 |
| Cab1 | Main operator cabin (hangs under wheel boom, behind wheel) | -56 | 24 |
| Cab2 | Second cabin (front of superstructure) | -13 | 22 |

### Parts

1. **Main crawler groups.** 12 tracks **[src]**, three rows of four on the 288 **[src]**, each track 3.8 m wide **[src]**. Estimated about 15 m long and 4-5 m tall each. In side view draw 2 long crawler units end to end (x -17 to -1 and +1 to +17), each a rounded rectangle 16 x 4.5 m with 8-10 road wheels and visible track pads, plus a darker second row offset 1 px behind for depth. Above each is a triangular bogie/balance beam up to y = 9.
2. **Substructure.** A wide, squat trapezoid from the bogies (y 9) to the slew ring (y 13), 30 m wide at the bottom and 22 m at the top. The ring itself is a thin dark band 20 m in diameter. Everything above it rotates.
3. **Superstructure (machine house).** Stacked box decks from y 13 to 28, x -14 to +16. Three or four floors are visible as horizontal bands with railings, windows and stairs. It is the densest and darkest mass. Electrical houses are box containers on top.
4. **Forward leaning mast (M1).** A two-leg lattice A-frame leaning about 20 degrees toward the wheel, M1b to M1t, about 66 m long. Width is 4 m at the base, tapering to 2 m, with X-bracing every 6 m and a sheave block at the top.
5. **Vertical tower (M2).** A lattice column from M2b to M2t, about 5 m wide, with a sheave cluster and a small platform plus aviation light on top. Short horizontal ties link M1 and M2 at about y = 60 and 80.
6. **Rear strut.** A diagonal lattice leg from M2 at about (3, 70) down to the counterweight boom at (30, 40). It forms the back slope of the "pyramid".
7. **Bucket-wheel boom.** A lattice box girder from B0 to W, about 63 m long, 6 m deep at the root tapering to 4 m at the head, with Warren-truss diagonals and a conveyor running along its top chord. At rest it sits near horizontal, rising a few degrees toward the wheel.
8. **Wheel head.** A solid plated box at the boom tip (x -66 to -56, y 26 to 38) holding the drive, gearbox and chute; in the photo it reads as a light grey block right behind the wheel. A short pylon (H) stands on top for the stay ropes.
9. **Bucket wheel.** Diameter 21-21.6 m **[src]**, so r = 10.8. 18 buckets **[src]**, 20 degrees apart.
   - Rim: annulus from r 7.5 to 9.5. Inside is a plated disc/cone with 6-9 radial spokes or ribs and a hub of r = 1.5.
   - Buckets: scoop shapes on the rim, open mouth facing the direction of rotation, each roughly 3 m wide x 2.5 m deep, D-shaped or trapezoidal, with 3-4 teeth on the cutting lip. Capacity is cited as 15 m3 each for the 293 **[src]** and 6.6 m3 for the 288 **[src]**.
   - Cover: a guard/chute plate covers the upper rear quadrant, where buckets empty onto the boom conveyor.
   - Silhouette trick: an 18-tooth sawblade. In the photo it is a clear rust-orange gear shape.
10. **Counterweight boom.** A lattice girder from K0 to K1 rising about 12 degrees to the rear, 44 m long. The ballast box is a solid slab (x +30 to +48, y 38 to 48) carrying large white signboards. The luffing winch house sits on top at x +25 to +35. A small service crane (Kc) with a jib stands on the rear end; it is visible in the photo.
11. **Ropes (thin 1 px lines, drawn in bundles of 2-4 parallel lines).**
    - R1: M1t to H, the main wheel-boom suspension. This is the most visible fan, 3-4 lines.
    - R2: M1t to boom mid-point (-32, 32), a secondary stay.
    - R3: M1t to M2t, near-horizontal top tie.
    - R4: M2t to K1, the back stay to the counterweight tip.
    - R5: M2t to the winch house (+28, 46), the luffing rope fall with many parallel lines.
    - R6: M2 at (3, 75) to the counterweight boom mid-point (+18, 38).
    - Load path: winch, tower top, forward mast top, wheel head. Luffing pays R5 in or out, and the boom rotates about B0.
12. **Operator cabins.** Cab1 is a glass box of about 3 x 3 m hanging below the wheel boom on a pendulum arm just behind the wheel, with a view of the cut. This is where Kome sits; exaggerate it to 5 x 5 m so he is readable. Cab2 sits on the front corner of the superstructure. Both have windows on 3 sides, tinted blue-green.
13. **Discharge bridge.** A long lattice conveyor bridge from D0 to D1, about 100 m long and 5 m deep, near horizontal, spanning the gap to the loading unit. A support pylon with a rope fan stands above it near the far end.
14. **Loading unit (Beladegeraet).** A separate small machine on its own 2-3 crawlers (x +104 to +130, y 0 to 4). It has a body about 20 m tall, a short lattice mast (Lt) and a short discharge boom to Le, which drops material onto the bench conveyor or pile. In the photo it looks like a mini-bagger about 30% of the main one's height.
15. **Walkways, stairs, railings.** Railings run along both chords of every boom (1 px line plus posts every 3 m). Zig-zag stairs climb the superstructure and the mast legs (a ladder line up M2). Catwalks run around the wheel head.
16. **Lights.** Floodlights at M1t, M2t, the wheel head, the cabs and along the boom at about 10 m spacing. Red aviation beacons at M2t and M1t. At night it reads as a string of lights.
17. **Signage.** Two or three white rectangular boards (6 x 3 m) on the counterweight box and the superstructure front (visible in the photo). Use "KOME" or "米" branding; avoid real logos.
18. **Power cable.** A cable reel on the substructure with a cable trailing on the ground (the machine is externally powered **[src]**). Good gag: an extension cord.

## 2. Colours

Hex values are my guesses from the photos.

| Element | Hex |
|---|---|
| Structure, lit | #9AA3A6 |
| Structure, mid | #6F7A80 |
| Structure, shadow | #454E55 |
| Lattice against sky (thin members read darker) | #3A4248 |
| Plated boxes / wheel head, lit | #B7BEC0 |
| Bucket wheel rim and buckets (rust) | #B5622A |
| Bucket highlight | #D98A3A |
| Bucket dark | #6E3A1C |
| Teeth | #2B2B2B |
| Crawlers | #4A4038 pads, #2E2925 gaps |
| Mud on crawlers | #7A6548 |
| Signboards | #F2F2EC with green #2E8B57 or blue #1F5FA8 mark |
| Cab glass | #7FC4C9, glint #E8FFFF |
| Railings | #C9CED0 (optionally safety yellow #E8B923) |
| Lights | #FFF3B0, beacon #FF3B30 |
| Ropes | #2F3437 |

- **Weathering:** rust streaks under joints (#8A4B2A at 30% alpha), dust fading upward from the crawlers, and a darker grease ring at the slew ring and wheel hub.
- **Collage variants:** the iron-ore machines in `3.png` are fully red-dust coated (#A8482A). The trucks and shovels are Cat yellow (#F2B01E) with black (#1E1E1E) and dark shadows (#B47A12).
- **What reads at small scale (around 200 px long):** (1) the orange toothed wheel, (2) the masts-and-ropes triangle, (3) the long horizontal boom, (4) the dark crawler band, (5) the white sign. Lattice should be alternating diagonals in 1 px, not filled. Skip railings below about 300 px length. Keep the wheel a contrasting warm colour against cool grey.

## 3. Motion

- **Bucket wheel:** no published rpm found. My estimate is about 2.5 rpm (one turn per 24 s), which gives roughly 45 bucket dumps per minute, about 0.75 per second. For game feel, run 1.5-2x faster with a slight lurch per bite. Buckets dig moving upward through the face at the front or lower-front, carry over the top, and empty on the rear-upper side into the chute.
- **Material path:** wheel, chute, boom conveyor (toward +x), transfer at the slew centre, discharge bridge conveyor (toward +x), loading unit, drop off Le onto a pile or bench conveyor. Animate as marching dots or lumps at about 4-5 m/s along the top chords (my estimate). Spill grains at each transfer and under the wheel.
- **Slewing:** the superstructure swings the wheel sideways across the face in arcs, slowly (my estimate: tens of metres per minute at the wheel). In side view, fake it as a wheel-boom foreshortening of about 5% plus parallax, or ignore it.
- **Luffing:** the boom pivots at B0. The wheel centre can range from below ground level to about 50 m up (my estimate). Ropes R1/R5 change length and the counterweight boom stays fixed. A 4-8 degree bob looks alive.
- **Crawl:** 2-10 m/min, i.e. 0.1-0.6 km/h **[src]**. Track pads creep visibly; turning radius about 50 m and max grade 1:18 (288 **[src]**).
- **Animations that sell it:** rice grains cascading off each bucket lip; a spray arc at the dig point; a conveyor stream with small bounce; the whole machine shuddering 1 px every bite; ropes vibrating; blinking beacons; dust or steam puffs at the crawlers; tiny Kome visible in Cab1 with ears flapping; birds perched on the ropes scattering at start-up; the mountain's face receding in terraced arcs (the wheel cuts scalloped benches); a camera zoom-out reveal with a human and pickup at 1-2 px for scale.

## 4. Scale facts for comedy

- **Bagger 293** (TAKRAF SRs 8000, RWE Hambach mine): 96 m tall, 225 m long, 46 m wide, 14,200 t **[src]**. Shares the Guinness record for tallest terrestrial vehicle with the 288 **[src]**.
- **Output:** 240,000 m3 of soil per day, about 218,880 t **[src]**. The 288's equivalent in coal fills 2,400 coal wagons a day **[src]**.
- **Wheel:** 21+ m in diameter (about a 7-storey building, my comparison), 18 buckets **[src]**.
- **Crew:** 5 **[src]**. Kome does it alone.
- **Power:** 16.56 MW, externally supplied **[src]**. It plugs into the wall.
- **Speed:** 0.1-0.6 km/h **[src]**, slower than a walking shiba.
- **Cost and build:** about US$100 million, about 10 years **[src]**.
- **Bagger 288:** 13,500 t, 220 m long, ground pressure 1.71 bar **[src]**. Its 2001 move covered 22 km in about 3 weeks with a crew of 70, cost nearly DM 15 million, and crossed an autobahn, a river and a railway; grass was seeded to protect the terrain **[src]**.
- **Unverified comparisons from general knowledge:** the Statue of Liberty with pedestal is 93 m, so the Bagger is taller; 225 m is about two football pitches.
- **Rice maths for the game (my arithmetic):** 240,000 m3/day at about 0.85 t/m3 bulk rice is about 200,000 t/day. At 150 g per bowl that is about 1.4 billion bowls a day.

## 5. Other machines

Human = 1.7 m. Figures marked **[src]** came from the 797F search; the rest are from general knowledge and unverified.

**Cat 797F haul truck.**
- Size: 15.1 m long **[src]**, 9.5 m wide **[src]**, 6.5 m to the top of the cab ROPS **[src]**, about 7.7 m to the canopy, 15.7 m with the body raised **[src]**.
- Payload 363 t **[src]**; gross weight about 624 t **[src]**.
- Tyres 59/80R63 **[src]**, about 4.0 m in diameter, so a human reaches under the hub. Two axles, about 7.2 m wheelbase; rear duals read as one fat wheel.
- Silhouette: a wedge dump body with a long canopy projecting forward over the cab; a tiny cab on the left deck; a diagonal stair across the radiator grille; the body floor sloping up to the rear with no tailgate.
- Proportion: tyre about 60% of the cab height; a person is about a quarter of the truck's height.
- Colour: yellow with black tyres, grey rims and a grey-dusted body.

**P&H 4100XPC electric rope shovel.**
- About 1,500 t; dipper about 55-60 m3 (roughly 100 t per pass, loading a 797 in 3-4 passes).
- Boom about 21 m, fixed at about 45 degrees, with twin point sheaves at the tip about 20-21 m up.
- Silhouette: a big boxy machinery house of about 14 x 9 m (taller than long is wrong; keep it a squat box) on a slew ring over two crawlers of about 11 x 2.5 m. An A-frame gantry on the roof holds the stay ropes to the boom tip. A dipper handle (stick) crosses through the boom at mid-height on a saddle block. The dipper hangs from hoist ropes, with a front lip of teeth and a bottom door that swings open to dump. The cab is high on the front-right corner. A trailing power cable runs along the ground.
- Motion: crowd (handle slides out), hoist (ropes pull the dipper up through the face), swing, door trip.
- Colour: yellow, white or red house; dark boom.

**Hydraulic mining excavator (Cat 6090 FS / Liebherr R9800).**
- 6090 FS: about 980 t, 52 m3 face-shovel bucket, twin engines. R9800: about 800 t, 42-47 m3 bucket.
- Size: body about 10 m tall at the cab roof; crawlers about 11 m long and 2.5-3 m tall; upper structure about 10-12 m long.
- Silhouette: a scaled-up excavator. Twin crawlers, a big engine house with handrails and stairs, the cab raised on a riser at front-left (eye level about 8 m). A thick two-piece boom and stick with fat hydraulic cylinders; face-shovel bucket opening forward and upward with a clam-shell bottom dump, or a backhoe variant.
- Proportion: a human is about a sixth of its height; a pickup fits under the counterweight.
- Colour: Cat yellow and black, or Liebherr white/grey with yellow.
- The small yellow excavator in `3.png` (third image) is a normal 30-50 t backhoe: about 3.5 m tall at the cab, 3.5 m crawlers, 6 m boom plus 3 m stick.

**Compact farm tractor (Kubota-type, 25-40 hp).**
- About 3.0 m long, 1.4 m wide, 2.3 m tall with ROPS bar; rear tyres about 1.1-1.2 m in diameter, fronts about 0.65 m.
- Silhouette: a small bonnet, a big rear wheel with chevron lugs, an open seat, a roll bar and an exhaust stack. The seat is about 1.0 m up, so a seated human's head is at about 1.9 m.
- Colour: orange or red body (#E8632B), grey rims. Kome fits naturally here.

**Pickup truck (Hilux / F-150 class).**
- About 5.3-5.9 m long, 1.8-1.95 m tall, 1.9-2.0 m wide; wheels about 0.8 m in diameter; wheelbase about 3.1-3.7 m.
- Silhouette: three boxes (bonnet, cab, bed). Mine-spec: white, with an orange whip flag on a 3-4 m pole, a roof beacon and reflective stripes.
- Scale: next to a 797F it sits below the tyre top (see `2.png`, where the pickup is about half the tyre height). Next to the Bagger it is about 2% of the height, i.e. 2 px when the Bagger is 96 px tall.

**Relative heights for one consistent scale (m):** human 1.7; pickup 1.9; tractor 2.3; 797F 7.7 (15.7 raised); hydraulic excavator 10; rope shovel 21; Bagger wheel 21.6; Bagger 96.

Sources:
- [Bagger 293 (Wikipedia)](https://en.wikipedia.org/wiki/Bagger_293)
- [Bagger 288 (Wikipedia)](https://en.wikipedia.org/wiki/Bagger_288)
- [Cat 797F tech spec (Zeppelin)](https://www.zeppelin.cz/fileadmin/helios_files/JPG/ToM/OHT/797F/797F_AEHQ5884-09_Tech_Spec_12-2023.pdf)
- [Cat 797F (cat.com)](https://www.cat.com/en_IN/products/new/equipment/off-highway-trucks/mining-trucks/18093014.html)
- [Cat 797F (Ritchie Specs)](https://www.ritchiespecs.com/model/caterpillar-797f-rock-truck)
- [Cat 797F (Lectura Specs)](https://www.lectura-specs.com/en/model/construction-machinery/rigid-dump-trucks-caterpillar/797f-11691916)
- [Cat 797F spec sheet (Peterson Cat)](https://www.petersoncat.com/sites/default/files/products/documents/1495808649.pdf)
- [Cat 797F (Toromont Cat)](https://www.toromontcat.com/mining/equipment/details/406-equipment/470-off-highway-trucks/715-mining-trucks/18093014)
- Reference images: `/tmp/claude-0/-home-user-Pizzaria-Site/73bb5c4b-e898-5ba0-a571-a9a62e6621c9/images/1.webp`, `2.png`, `3.png` (same directory)