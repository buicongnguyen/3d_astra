# Unit and building art audit (round 2)

The owner asked whether the unit models should look better. This audit renders all 36 models in
`public/models/manifest.json` and scores each one. No model was changed. The goal is to choose which ones to redo.

## How the sheets were made

- three r185 in headless Chromium (Playwright, SwiftShader). Models were loaded straight from `public/models/*.glb`.
- The game's look was copied: the `riverlands` hemisphere and sun (`visual-style.json`), the `look-grade.js` Neutral+grade
  tone map, the warm Fresnel rim on painted parts, `addTeamRim` on Team parts, and RoomEnvironment reflections at 0.6
  on metal parts (High quality, `view.js applyReflections`).
- Team colours work as in `view.js`: only `Team*` materials take the team colour (`settings.js PRESETS`), and `TeamGlow*`
  takes the faction glow (`story/world.js`). Meridian is mint, Ashfall coral, Sunward gold, Veil violet and Wardens blue.
- The game zoom matches `view.js`. The orthographic camera sits at offset (25, 51, 43) with default zoom 38, on a
  390×844 phone with renderer pixel ratio 1.6. The readability scale is min(1.25, max(1, 28 px / height)). Bosses
  are drawn at 1.5× (`boss-presence-view.js`) and flyers at 3.2 m.
- To re-render, run `node docs/aaa/results/round2/art-audit/render/run.mjs` from `github-io`. It serves on 127.0.0.1:4238
  while it runs. If Playwright's own Chromium is missing, set `AUDIT_CHROME`.

| Sheet | What it shows |
|---|---|
| [a1-core.png](a1-core.png) | (a) The 13 core models up close, in mint, coral and blue, each with a real-size phone inset |
| [a2-faction.png](a2-faction.png) | (a) The 12 faction models in their own colour and in mint |
| [a3-air-round2.png](a3-air-round2.png) | (a) The 4 flyers, the carrier, the 2 bosses and the 4 round-2 additions |
| [b-phone-zoom.png](b-phone-zoom.png) | (b) Four phone screens at real game zoom: ground units, buildings, flyers plus a mixed four-colour fight, and the bosses with a tank for scale |
| [c-infantry-factions.png](c-infantry-factions.png) | (c) The six shared infantry and vehicles in all five faction colours, next to two of each faction's own models |

## Overall verdict

**The core roster is serviceable and close to finished. Most of the weak models are the faction models and the
Sovereign boss.**

1. **Colour.** About 60 % of every core model's surface is near-black armour or dark-brown undercarriage. The team
   colour is the only bright surface. The result reads as dark grey military, not the vivid, warm Mario Kart 8 bar.
   Warm light secondaries (cream, sand or light warm grey armour, with dark kept only for joints and tracks) would lift
   the whole army without new geometry.
2. **Shared-infantry sameness.** Worker, ranger, medic and engineer use one robot body and differ only by a hand
   tool. On the phone (about 49 px tall) they are close to indistinguishable. Worker and engineer even share the yellow
   hard hat. Only the vanguard (shield) and antitank (tube) read on their own.
3. **Faction identity is paint only.** Sheet (c) shows a Veil ranger and a Wardens ranger as the same model in a
   different colour. A faction's own identity rests on 2 swaps out of 6 to 8 unit types. Several faction models
   (wagon, waystation, rider roof, walker, drone) are almost all Team paint. When the player picks a different
   colour (sheet a2, mint column), they lose the faction look completely: a mint wagon is just a bus.
4. **Budget headroom is unused where it matters most.** Drone uses 35 % of its budget, scorcher 43 %, wagon 44 %,
   walker 45 %, and the faction buildings 53 to 60 %. These are also the most primitive-looking models (spheres, flat
   discs, slab roofs). The core infantry and vehicles sit at 87 to 100 %.
5. **Bosses.** Iron Sovereign is the biggest object on screen (about 2.6 tanks tall and much wider) and the least
   finished: a flat brick-red box on stick legs with one material. Iron Vanguard reads well but has voxel-port finish.
6. HQ is 4,720 triangles, which is 118 % of the 4k building band. The core 13 have no budget in the manifest, so the
   STAGE_2 bands are used here (marked *).

## Scores (1 = poor, 5 = great)

Sil = silhouette at game zoom · Fac = faction identity · Det = detail vs budget headroom (low = crude while budget is
unused) · Col = colour and vividness against the MK8 bar · Team = team-colour readability · Fin = looks finished ·
**All** = overall. px = drawn height in CSS px on a 390×844 phone at zoom 38.

| Model | Role / owner | Tris / budget | px | Sil | Fac | Det | Col | Team | Fin | **All** | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| worker | shared | 3116 / 3200* (97 %) | 49 | 3 | 2 | 4 | 3 | 4 | 3 | **3** | Hard hat and drill read; the hat is the same as the engineer's |
| vanguard | shared | 2872 / 3200* (90 %) | 49 | 4 | 2 | 4 | 3 | 4 | 4 | **3** | The tall shield is the best infantry silhouette |
| ranger | shared | 2996 / 3200* (94 %) | 52 | 2 | 2 | 3 | 3 | 4 | 3 | **2** | Generic robot with a thin rifle, invisible at 52 px |
| medic | shared | 2820 / 3200* (88 %) | 49 | 2 | 2 | 3 | 3 | 4 | 3 | **2** | White helmet and a tiny orb; nothing says "healer" from above |
| engineer | shared | 2772 / 3200* (87 %) | 49 | 2 | 2 | 3 | 3 | 4 | 3 | **2** | Yellow hat plus wrench, which on the phone looks like the worker |
| antitank | shared | 3192 / 3200* (100 %) | 49 | 4 | 2 | 4 | 3 | 4 | 4 | **3** | The huge tube reads well |
| breaker | shared | 4520 / 4500* (100 %) | 50 | 3 | 2 | 4 | 3 | 4 | 4 | **3** | At phone size it reads as a smaller tank; twin barrels lost |
| tank | shared | 6264 / 6300* (99 %) | 62 | 4 | 2 | 4 | 3 | 4 | 4 | **4** | Solid; the hull's team stripe carries it |
| hq | shared | **4720 / 4000* (118 %)** | 121 | 4 | 2 | 4 | 3 | 4 | 4 | **4** | Good stepped octagon; over the band |
| barracks | shared | 2816 / 4000* (70 %) | 85 | 4 | 2 | 3 | 3 | 4 | 4 | **4** | Quonset hut reads instantly |
| foundry | shared | 3952 / 4000* (99 %) | 101 | 4 | 2 | 4 | 3 | 3 | 4 | **4** | Stacks read; team colour only on thin roof strips |
| relay | shared | 2776 / 4000* (69 %) | 91 | 4 | 2 | 3 | 3 | 3 | 4 | **4** | The cyan glass core is a nice accent |
| tower | shared | 2080 / 4000* (52 %) | 87 | 3 | 2 | 2 | 2 | 3 | 3 | **3** | Dark stub with thin team bands; spends half its budget; seen constantly in Defence |
| scrapper | Ashfall (vanguard) | 2852 / 3200 (89 %) | 52 | 3 | 3 | 4 | 3 | 3 | 3 | **3** | One big shoulder pad carries everything; shield is grey |
| scorcher | Ashfall (breaker) | 1928 / 4500 (43 %) | 62 | 3 | 3 | 1 | 4 | 3 | 2 | **2** | Toy blocks on wheels: warm, but crude and half the budget left |
| salvageyard | Ashfall building | 2132 / 4000 (53 %) | 91 | 3 | 3 | 2 | 3 | 3 | 2 | **2** | Crane gantry over a bare plate; sparse |
| rider | Sunward (ranger) | 2388 / 4500 (53 %) | 55 | 3 | 3 | 2 | 3 | 3 | 1 | **2** | Flat disc wheels, rider glued on, parasol roof; least finished unit |
| wagon | Sunward (medic) | 1984 / 4500 (44 %) | 57 | 3 | 2 | 1 | 3 | 4 | 2 | **2** | A box van under a team roof; reads as a bus, not a field medic |
| waystation | Sunward building | 2112 / 4000 (53 %) | 57 | 2 | 3 | 2 | 3 | 4 | 2 | **2** | Flat roof hides everything; low and featureless from the game camera |
| drone | Wardens (ranger) | 1568 / 4500 (35 %) | **32** | 2 | 3 | 1 | 3 | 5 | 2 | **2** | Ball in a ring; smallest ground unit on screen |
| walker | Wardens (tank) | 2836 / 6300 (45 %) | 90 | 3 | 3 | 1 | 3 | 5 | 2 | **2** | Cute ball on stilts; does not read as the heavy siege unit that replaces the tank |
| pylon | Wardens building | 2416 / 4000 (60 %) | 87 | 4 | 4 | 2 | 3 | 5 | 3 | **3** | Distinctive coil; plain base plate |
| shade | Veil (vanguard) | 2804 / 3200 (88 %) | 61 | 3 | 4 | 4 | 3 | 3 | 3 | **3** | The hood point reads; body is the core robot |
| watcher | Veil (antitank) | 2856 / 3200 (89 %) | 61 | 3 | 4 | 4 | 3 | 3 | 3 | **3** | Shade plus rifle: hard to tell apart from shade |
| veilrelay | Veil building | 2180 / 4000 (55 %) | 107 | 4 | 4 | 2 | 4 | 4 | 3 | **3** | Strong violet rings; bare plate |
| kite | shared flyer | 904 / 1500 (60 %) | 28 | 3 | 2 | 3 | 3 | 4 | 3 | **3** | Smallest unit; X shape reads mainly by its shadow |
| hawk | Meridian flyer | 1408 / 1500 (94 %) | 38 | 4 | 2 | 4 | 4 | 4 | 4 | **4** | Clean tilt-rotor |
| balloon | Ashfall flyer | 1308 / 1500 (87 %) | 94 | 5 | 3 | 4 | 4 | 5 | 3 | **4** | Best silhouette in the game; patch decals are crude |
| glider | Sunward flyer | 1080 / 1500 (72 %) | 43 | 4 | 3 | 3 | 3 | 4 | 3 | **3** | Readable wing, flat |
| carrier | Defence transport | 3368 / 4500 (75 %) | 55 | 4 | 2 | 3 | 4 | 4 | 4 | **4** | Good truck with a ribbed tarp |
| ironvanguard | boss | 2228 / 3000 (74 %) | 192 | 4 | 2 | 3 | 3 | 3 | 2 | **3** | Strong biped stance; voxel-port finish, dark brown body |
| ironsovereign | boss | 1904 / 2800 (68 %) | 163 | 2 | 2 | 2 | 2 | 3 | 1 | **1** | Flat brick-red slab on stick legs, one material; the biggest thing on screen |
| gunner | Meridian workshop | 3196 / 3200 (100 %) | 49 | 3 | 2 | 5 | 3 | 3 | 3 | **3** | Two identical crew in the same pose; the tripod reads |
| stalker | Veil workshop | 2724 / 3000 (91 %) | 56 | 4 | 4 | 4 | 4 | 4 | 4 | **4** | Hooded cloak plus long rifle: the model the rest should match |
| workshop | Meridian host building | 3640 / 4000 (91 %) | 91 | 3 | 3 | 4 | 3 | 4 | 4 | **4** | Busy but finished |
| rampart | Ashfall workshop | 5848 / 6300 (93 %) | 61 | 4 | 3 | 4 | 4 | 4 | 4 | **4** | The ram plough reads; warm orange |

\* No budget in the manifest; the STAGE_2_FACTIONS.md band is used (infantry 3.2k, light vehicle 4.5k, heavy 6.3k,
building 4k).

## Ranked redo list (largest visible payoff first)

Every brief keeps the runtime contract (`tests/assets.test.js`): one attribute set with COLOR_0, Team plus TeamGlow
materials, single-sided materials, `leg_L*`/`leg_R*` pivots for non-mechanical units, `Turret_pivot`/`Turret_head`/barrel
parts where a rig exists, and no KHR_mesh_quantization.

### 1. Iron Sovereign (boss): 1904 → target 2,600 to 2,800 of 2,800
- **Silhouette:** a siege fortress, not a box. Build a tall stepped hull (a two-tier keep) on six jointed legs with
  knees above the hull line, so it reads as a walking castle from 45°. Add one long main cannon, two side sponsons and
  a smokestack. The glowing core should sit on top, visible from the camera.
- **Materials:** at least four: Team (hull panels only), warm sand or bronze armour, dark steel joints, Gold trim
  (already in the file, unused), and the BossCore glow.
- **Faction variants:** Team panels plus glow only; it fights as any enemy faction.
- **Motion:** leg lift with a visible knee bend, a hull bob of 0.1 m per step, a cannon recoil part, and a turret that
  turns (`BOSS_PARTS`).

### 2. Walker (Wardens' tank): 2836 → target 5,500 of 6,300
- **Silhouette:** it replaces the tank, so it must look heavier than one. Use a wide armoured cockpit pod (not a
  sphere) on two reverse-jointed legs with big feet, a shoulder-mounted twin cannon on a `Turret_head`, and a back
  radiator fin.
- **Colour:** cold Warden ice-white armour (a warm off-white, not grey) with blue Team on the pod and shoulders, and a
  cyan visor (TeamGlow).
- **Motion:** stomping gait with a body dip per step, turret yaw, and barrel recoil.

### 3. Drone (Wardens' ranger): 1568 → target 2,800 of 4,500, and scale up so it is 40 px or taller
- **Silhouette:** at 32 px it is the smallest ground unit. Make it a hovering sentry: a teardrop body with a
  downward sensor eye, two side gun pods and a halo ring turned vertical (so it reads from above). Raise it to about
  1.6 m.
- **Motion:** keep `hover`. Add a slow ring spin (a `spin_*` pivot) and an eye pulse (TeamGlow).

### 4. Shared infantry pass: ranger, medic, engineer, worker (each to about 3.1k of 3.2k)
- **Problem:** one body plus a hand tool. Fix it with role silhouettes that read from above:
  - **ranger:** long rifle carried diagonally across the chest, and a backpack antenna.
  - **medic:** a big white backpack with a cross, an arm-mounted heal emitter and a white helmet stripe.
  - **engineer:** a tool backpack with a crane arm or welding mask, and an orange hazard vest instead of the
    worker's hat.
  - **worker:** keep the hard hat; add a cargo frame on the back with a crystal.
- **Faction kits:** add an optional per-faction accessory set as separate meshes, swapped by roster (no new rig).
  Examples: Ashfall scrap pauldrons and a rag scarf, Sunward wide-brim hat and sash, Wardens visor plate, Veil hood
  tip. This is where shared units gain faction identity.
- **Colour:** move Armor from near-black to warm light grey or sand. Keep Undercarriage dark.

### 5. Rider (Sunward's ranger): 2388 → target 4,000 of 4,500
- **Silhouette:** a proper desert trike or sand-bike: a long low frame, a fat front tyre and two rear tyres with
  treads (not flat discs), the rider leaning forward, a fluttering pennant and a saddle-bag. Drop the parasol roof,
  which hides the rider from the game camera.
- **Colour:** sand-and-brass bodywork, with Team on the fairing and pennant.
- **Motion:** wheel spin pivots, a lean into turns, and a pennant flutter.

### 6. Wagon (Sunward's medic): 1984 → target 3,800 of 4,500
- **Silhouette:** a caravan ambulance. Use a canvas hoop-roof (ribbed like the carrier tarp) in cream with a Team
  stripe and a big red-cross or crescent panel on the roof (visible from above), lanterns at the corners and spoked
  wheels.
- **Team colour:** Team only on the stripe and panels, so the cream canvas keeps the Sunward look in any player colour.

### 7. Scorcher (Ashfall's breaker): 1928 → target 4,000 of 4,500
- **Silhouette:** a scrap flame-crawler: half-tracks, a riveted fuel tank on the back with pipes to a nozzle turret,
  a dozer blade made from a welded sign, and a chimney.
- **Colour:** rust, brass and soot as secondaries, with Team on armour plates. Add a pilot flame (Flame or Energy
  material).
- **Motion:** turret rig plus nozzle recoil, and a flickering pilot flame (`flicker_*`).

### 8. Faction host buildings: salvageyard, waystation (→ about 3,600 of 4,000), plus the pylon and veilrelay bases
- **Silhouette:** fill the bare plates.
  - **Salvageyard:** scrap heaps, a crusher and a hanging magnet.
  - **Waystation:** an open caravanserai with a raised roof edge so the stalls and wells show from 45°, plus a
    windmill.
  - **Pylon and veilrelay:** a footprint ring of pipes or crystals.
- **Colour:** secondaries that belong to the faction (Ashfall rust, Sunward terracotta and canvas) so identity
  survives a player colour change.

### 9. Tower (Defence staple): 2080 → target 3,600 of 4,000
- **Silhouette:** a wider base with buttresses, a lighter warm-concrete shaft, a bigger turret head with a team-coloured
  shield plate, and an ammo drum.
- **Colour:** replace the near-black shaft with warm concrete and keep a dark band only at the top.
- **Motion:** keep the turret rig and add a muzzle flash socket.

### 10. Iron Vanguard (boss): 2228 → target 2,900 of 3,000
- **Silhouette:** keep the stance. Bevel the voxel blocks (chamfer the outer edges), add shoulder armour with Team
  panels, and add exhaust stacks on the back.
- **Colour:** lift the body from dark brown to gunmetal with bronze trim.
- **Motion:** arm recoil and core pulse are already present; add a torso twist.

Honourable mentions: **watcher** needs a silhouette apart from shade (a long scope rifle on a bipod, a kneeling stance).
**gunner** crew should take two different poses (one loader, one gunner). **kite** could take a brighter tail ribbon so
it reads at 28 px.

## Missing portraits

`src/portraits.js PORTRAIT_ORDER` has 29 cells (atlas `src/art/portraits.webp`, rendered by
`tools/blender/render_ui_art.py`). Seven manifest models have **no portrait**:

**carrier, ironvanguard, ironsovereign, gunner, stalker, workshop, rampart.**

`portrait()` returns an empty string for them. Add them to the atlas when they are approved. `tests/assets.test.js`
pins the order, so append them after `glider`.
