# R3-F: Warm kit and distinct silhouettes (art 1): results

Branch `r3/f-warm-kit`, base `r3-base` (`5fad815`), worktree `C:\Users\n\source\repos\3d_astra-r3-f`, port 4237.
Status: **done**. Every changed model is flagged `review: "pending owner review (round 3)"` (owner decision O7).

## What changed

| Area | Change | Files |
|---|---|---|
| Palette (`frontier_kit.MATERIALS`) | `Armor` changes from `#59605f` gunmetal (metal 0.55, rough 0.46) to `#d6c6aa` glossy warm sand (metal 0.12, rough 0.25).<br>`Undercarriage` changes from `#23282a` to `#54463c` (warm umber), `Suit` from `#343a3a` to `#8a7666` (taupe), and `Concrete` from `#8d8a7e` to `#b9aa90`. `Steel` is slightly warmer.<br>`Team` and `TeamGlow` are unchanged. | `tools/blender/frontier_kit.py` |
| Bake class kept | The new armour sits at roughness 0.25, so `src/view.js reflects()` still sorts it with the reflective parts. Every role and faction paint does the same. As a result, no rigid group gains a baked mesh. | same |
| New kit materials | Role paints:<br>• `ArmorMedic` (white)<br>• `ArmorWorker` (yellow)<br>• `Cross` (red)<br>• `Cape` (green)<br>• `Safety` (orange)<br>Faction paints:<br>• `ArmorAshfall` (rust)<br>• `ArmorSunward` (canvas cream)<br>• `ArmorWardens` (ice white)<br>• `ArmorVeil` (mauve)<br>Lit windows:<br>• `Window` (warm, emissive 1.4, listed in `GLOWING`) | same |
| Shared infantry | **Medic:** white armour, a large white pack with red crosses on its top and back, a red cross on the helmet and on the shoulders.<br>**Worker:** yellow armour and hat, with a crystal on a cargo frame.<br>**Engineer:** an orange hard hat with a wide brim, and an A-frame tool rig with a crane jib and hook above the head. The orange jaws mean it no longer shares the worker's yellow.<br>**Ranger:** a green hood and flared cape, and a 1.9 m scoped rifle. Its glass lens became a team light. | `tools/blender/generate_assets.py` (`infantry`) |
| Buildings | The window glass on the HQ, the Barracks annex and the Foundry skylights now uses `Window`. | `generate_assets.py` |
| Faction models (Drone excluded) | Faction paint is set through `a.armor`. Accents per faction:<br>**Ashfall:**<br>• Scrapper: pauldron spikes and a second exhaust<br>• Scorcher: a ram bar with five spikes, plate spikes and a twin stack<br>• Salvage yard: two exhaust stacks and gantry spikes<br>**Sunward:**<br>• Rider: the parasol is replaced by a mast with a canvas sail, a Team stripe, a pennant, a tail fin and a Team fairing<br>• Wagon: a canvas roof with Team bands, a red roof cross and Team fins<br>• Waystation: a canvas roof with Team bands, two shade sails with Team edges, and ridge fins<br>**Wardens:**<br>• Walker: an ice-white carapace, a Team crest and brow band, and Team tower shields on the turning arms<br>• Pylon: four tower shields with Team stripes, and a crest<br>**Veil:**<br>• Shade and Watcher: a long mauve cloak and a hood drape<br>• Veil relay: a hooded canopy and a lit `Window` entrance | `tools/blender/generate_factions.py` |
| Meridian | **Gunner:** larger Team shoulder plates and a whip antenna on the loader. The ammo lid bevel was dropped to stay within 3,200 triangles.<br>**Workshop:** a roof antenna array. | `generate_gunner.py`, `generate_workshop.py` |
| Palette only | Stalker, Rampart, Carrier, Kite, Hawk, Balloon and Glider were regenerated with no geometry change. | their generators (only the review string changed) |
| Generator plumbing | `generate_factions.py` takes `-- <names>` and skips the Drone by default. It now updates manifest entries in place (keeping their order) and writes LF. `generate_assets.py` writes its manifest with LF and `review`. | |

The 8 core units were re-baked with `animate_units.py` (5 clips each, as before).
The `.blend` libraries in `assets/source/` were **not** recommitted: they are about 25 MB of binaries, and the generators rebuild them on any headless run.

## Acceptance numbers

### Armour luminance (target: at least +25%, team areas unchanged)

The numbers come from `render/run.mjs lum`.
- **How each model is rendered:** a 300×300 close-up in the game's look, with the riverlands grade, rim light and room reflections. Core models use Meridian mint; faction and other models use their own colour.
- **How pixels are sorted:** a second render from the same camera works as a class mask. It sorts pixels into Team paint, lit parts (glow, glass, lamps, windows, energy) and "armour/body" (everything else).
- **What is measured:** the mean linear luminance Y of each class, measured on the beauty render.
- **"Near-black":** the share of body pixels with L\* below 30.

| Group | Models | Body Y before | Body Y after | Change | Near-black before | Near-black after | Team Y before → after |
|---|---|---|---|---|---|---|---|
| Core 13 | worker … tower | 0.089 | 0.340 | **+284%** | 57% | 24% | 0.249 → 0.246 |
| Faction 11 (no Drone) | scrapper … veilrelay | 0.126 | 0.279 | **+121%** | 45% | 22% | 0.134 → 0.096 (see below) |
| Others 9 | workshop units, carrier, flyers | 0.122 | 0.263 | **+116%** | 49% | 29% | 0.218 → 0.220 |
| All 33 | | 0.110 | 0.299 | **+171%** | 51% | 25% | |

The full per-model table is in [f/luminance.json](f/luminance.json).

**Team areas.** The `Team` material itself is unchanged everywhere, and so is the team-pixel luminance on all 13 core models and the 9 others. On 7 faction models the team area changed **on purpose**:
- The Wagon, Waystation and Walker were "almost all Team paint" (art audit, point 3). Their big roof or shell is now faction paint, with Team kept on bands, fins, shields and crests, so the faction look survives a player's colour choice.
- The Rider lost its Team parasol and gained a Team sail stripe, pennant and fairing.
- The Pylon and Veil relay gained faction-paint shields and canopies.
- The Scrapper's spikes shade its Team pauldron slightly (−12%).

**Per-model exceptions.**
- The Scorcher's body Y fell from 0.208 to 0.179. Its yellow plates are now partly rust, and a dark second stack was added. Its near-black share still fell, from 36% to 29%.
- The Rampart is almost unchanged (0.110 → 0.112): it already wore its own rust paint.

### 24 px infantry thumbnail test (fresh reviewer agents, image only)

The sheets show the six shared infantry × three team colours (mint, coral, blue), shuffled with a fixed seed.
- **Tile size:** each unit is 24×24 px from the game camera, shown at actual size and enlarged 4× (nearest-neighbour).
- **Brief:** each fresh reviewer got only the image path, the six type names and each type's game role (for example "heals nearby soldiers"). It got no visual hints and no key.
- **Key:** [f/render/thumbs-key.json](f/render/thumbs-key.json).

| Sheet | Correct | Confidence high / medium / low | Reviewer's notes |
|---|---|---|---|
| [After](f/thumbs-after.png) | **18 / 18** | 6 / 10 / 2 | Worker "easiest: all yellow"; Medic "mostly white"; Engineer "orange tool block"; Vanguard "shield block"; Anti-tank "diagonal launcher". Weakest calls: Ranger vs Anti-tank (rifle and tube are 1–2 px), and the Engineer orange against the coral team. |
| [Before](f/thumbs-before.png) (control, a separate fresh reviewer) | 18 / 18 | 7 / 5 / 6 | "Worker vs Engineer is the main failure: both have the same yellow head, those six are close to a guess." Ranger vs Anti-tank "fragile". |

**Result.**
- **Requirement met:** every type was named correctly.
- **Biggest gain:** Worker and Engineer went from low confidence (described as "close to a guess") to high and medium.
- **Weak spots that remain:** Ranger against Anti-tank, and the Medic dropping from high to medium confidence, because the white body is closer to the sand armour than the old white helmet was to gunmetal.
- **Suggestions for R3-J or K:** the Ranger cape could take a Team hem, and the wide-zoom type icons (R3-K) cover the far zoom.

### Budgets and draws

**Triangles** (manifest, all within budget):

| Model | Before → after | Budget |
|---|---|---|
| worker | 3116 → 2996 | 3.2k |
| ranger | 2996 → 3076 | 3.2k |
| medic | 2820 → 2928 | 3.2k |
| engineer | 2772 → 2940 | 3.2k |
| scorcher | 1928 → 2336 | 4500 |
| salvageyard | 2132 → 2140 | 4000 |
| rider | 2388 → 2496 | 4500 |
| wagon | 1984 → 2224 | 4500 |
| waystation | 2112 → 2104 | 4000 |
| walker | 2836 → 3268 | 6300 |
| pylon | 2416 → 2800 | 4000 |
| shade | 2804 → 2844 | 3200 |
| watcher | 2856 → 2836 | 3200 |
| veilrelay | 2180 → 2248 | 4000 |
| gunner | 3196 → 3192 | 3200 |
| workshop | 3640 → 3736 | 4000 |

All other models keep their triangle counts. The HQ stays at 4,720, which is over its 4k band (unchanged).

**Materials:** no model has more than before, except the Wagon (4 → 6, still fewer than the Medic's 8 and the Breaker's 7). A new test pins the limits.

**Render budget** (`tests/render-budget.mjs --record`, all 20 scenarios, RTX 4080, before `r3f-before` → after `r3f-after`):

| Scenario group | Draw calls |
|---|---|
| High scenarios | −2 (main + shadow pass) |
| Every Eco scenario | −1 |

- **Why draws fell:** the Ranger's `Glass` lens was its own draw; it is now a team light.
- **Tolerance:** this is within the ±2 allowed.
- **Triangles on screen:** up by 0–1.4% in battles and up to 3% in `defence-wave-eco` (the Scorcher's spikes).
- **Limits:** every scenario stays under its limit. For example, `battle-eco` went from 107 to 106 draws (limit 120) and `three-factions-eco` from 182 to 181 (limit 185).

### Tests

| Check | Result |
|---|---|
| `npm test` | 963 tests: 937 pass, 26 skipped, 0 fail. The base had 961; this package adds 2. |
| `tests/assets.test.js` | Green, with two new tests (below) |
| `baselines:diff` | See the last line of this file |

The two new tests in `tests/assets.test.js`:
1. **Warm kit:**
   - every `Armor*` paint has linear luminance ≥ 0.17 (the old gunmetal was 0.11), is warm (red ≥ blue) and keeps the reflective bake class;
   - `Undercarriage` stays dark but not black;
   - the four role paints are present;
   - the Engineer has lost the worker yellow.
2. **Factions and windows:**
   - every faction model except the Drone wears its faction paint;
   - `hq`, `barracks`, `foundry` and `veilrelay` have an emissive `Window*` material;
   - the per-model material limits hold;
   - every changed manifest entry is flagged round 3.

## Test changes for the integrator

- `tests/assets.test.js:90`: the faction-review assertion now accepts `'approved by owner 2026-11-11'` or `'pending owner review (round 3)'`. Faction entries keep the old approval as `approved: "owner 2026-11-11 (round-2 shape)"`.
- `tests/stalker.test.js:288` (not owned by R3-F): the expected review string changed from `round 2` to `round 3` because the Stalker was re-painted. This is a one-word change.

## Stale portrait atlas cells (for R3-J)

Every existing cell in `src/art/portraits.webp` is stale except the **drone**:
- Core: `worker`, `vanguard`, `ranger`, `breaker`, `medic`, `engineer`, `tank`, `antitank`, `hq`, `relay`, `barracks`, `foundry`, `tower`.
- Faction models: `scrapper`, `scorcher`, `salvageyard`, `rider`, `wagon`, `waystation`, `walker`, `pylon`, `shade`, `watcher`, `veilrelay`.
- Flyers (palette only, minor change): `kite`, `hawk`, `balloon`, `glider`.

The 7 missing cells (carrier, ironvanguard, ironsovereign, gunner, stalker, workshop, rampart) should be rendered from the new GLBs. The bosses are unchanged.

## Seam requests

1. **R3-D, night glow:** the lit windows are kit material `Window` (sRGB `#ffcf7a`, emissive 1.4). In the GLBs it appears as `Window` on `hq`, `barracks`, `foundry` and `veilrelay`.
   - These meshes keep their own draw: they are emissive, so `bakeFinishes` leaves them out.
   - The view does not pulse or boost them today. R3-D's night boost can match `/^Window/` exactly as it matches `TeamGlow*` and `Energy*`.
2. **R3-J, Drone:** `generate_factions.py` now gives every builder `a.armor`; for Wardens this is `ArmorWardens`, ice white.
   - The Drone builder still uses it on `Lower_thruster`, so rebuilding the Drone with `-- drone` gives it the Wardens paint automatically.
   - `generate_assets.py -- --factions` skips the Drone unless `drone` is in the arguments.
3. **R3-J, Walker:** the Walker now reads heavier (ice-white shell, crest, tower shields; 3,268 of 6,300 triangles). R3-J may still want the audit's cockpit-pod rebuild.
4. **R3-J or K, Ranger:** a Team hem on the Ranger cape, or the R3-K wide-zoom icons, would close the remaining Ranger/Anti-tank gap at 24 px.
5. **Godot twin:** frozen. Its copies of the models were not touched.

## How to reproduce

From `github-io`:

```sh
B=<blender 4.5.9>
cp public/models/*.glb public/models/manifest.json .tmp/before-models/   # from r3-base, for the "before" column
$B --background --python tools/blender/generate_assets.py               # 13 core models + manifest
$B --background --python tools/blender/animate_units.py                 # re-bake the 8 unit clips
$B --background --python tools/blender/generate_factions.py             # 11 faction models (Drone skipped)
for g in gunner stalker workshop rampart carrier air; do $B --background --python tools/blender/generate_$g.py; done
git checkout -- assets/source                                           # keep the committed .blend libraries
AUDIT_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" node docs/aaa/results/round3/f/render/run.mjs   # sheets + luminance (port 4237)
```

Sheets:
- [f/contact-core.png](f/contact-core.png)
- [f/contact-faction.png](f/contact-faction.png): includes each model "after" in a mint player colour.
- [f/contact-other.png](f/contact-other.png)
- [f/phone-before-after.png](f/phone-before-after.png): real phone zoom.
- [f/thumbs-before.png](f/thumbs-before.png) and [f/thumbs-after.png](f/thumbs-after.png)

**baselines:diff:** `npm run baselines:diff`: missions-standard and defence both identical. `npm test`: green. The view-only change leaves every pin and the idle fingerprint untouched.
