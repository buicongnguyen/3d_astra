# R3-J: Models and portraits (art 2): results

Branch `r3/j-models`, base tag `r3-wave-1m` (`13ffe3e`), worktree `C:\Users\n\source\repos\3d_astra-r3-j`, port 4235.
Status: **done**. Every changed model is flagged `review: "pending owner review (round 3)"` (owner decision O7). No sim file, balance entry or stat changed.

## What changed

| Area | Change | Files |
|---|---|---|
| Sentinel drone | **Before:** a team-coloured ball inside a steel ring, with a gunmetal thruster.<br>**After:** an ice-white shell (`ArmorWardens`) carrying the Wardens marks of the Walker and Pylon:<br>• a team crest fin<br>• a team brow band<br>• two small tower shields with team stripes beside the twin emitters<br>• team tail fins<br>• a steel halo on three struts<br>• a steel thruster cone with the team light<br>It keeps the `hover` pivot and the `Barrel_emitters` aim/recoil rig, and has the same four materials (Team, TeamGlow, Steel, faction paint). | `tools/blender/generate_factions.py` (`drone()` only), `public/models/drone.glb` |
| Iron Sovereign | Re-ported with `tools/port-boss-model.mjs` and the new palette `sovereign3` (set in `tools/boss-parts/ironsovereign.json`). The changes:<br>• **Hull:** brass `#e6a838`, was dark oxblood `#9b3a2e`. With the old hull, the coral (hostile) team struts read as one red block with it.<br>• **Fittings:** gold becomes crimson.<br>• **Feet and gun bores:** the kit's warm umber `#54463c`, was near-black violet.<br>• **Steel:** the kit's warm steel.<br>• **Core:** white-hot.<br>Geometry, node names, the LegsA/LegsB regroup and each material's metal/roughness class are unchanged, so the baked groups and draws are the same. The round-2 `sovereign` palette is kept. The Iron Vanguard port is still byte-identical (checked with `cmp`). | `tools/port-boss-model.mjs` (one palette added), `tools/boss-parts/ironsovereign.json`, `public/models/ironsovereign.glb` |
| Lit windows | A `Window` material (emissive, R3-D's `/^Window/` night-glow contract) on the four buildings that had no light at all:<br>• **Shield pylon:** four control slits round the spine<br>• **Salvage yard:** an operator cab on the right gantry post, lit on two sides<br>• **Waystation:** three lit counter hatches<br>• **Field workshop:** two side windows per wall<br>The Relay and Tower keep their floodlight `Lamp`s, which R3-D's night glow also matches. Adding windows to them would mean a full core rebuild for one more draw each. | `generate_factions.py` (`salvageyard`, `waystation`, `pylon`: appended lines), `generate_workshop.py` |
| Portrait atlas | Re-rendered from the round-3 models: every old cell was stale after R3-F, except the drone, which is also new now. It grows from 29 to **37 cells (4 × 10, 768 × 1920)**:<br>• **Seven new cells:** `carrier`, `ironvanguard`, `gunner`, `stalker`, `ironsovereign`, `workshop`, `rampart`.<br>• **One reserved cell:** `ironsovereign2`. `render_ui_art.py` renders it from `ironsovereign.glb` (`SAME_MODEL`).<br>These types now show portraits instead of icons wherever `hasPortrait()` is asked: the selection card, command tiles, the Defence intel bar and the "new enemy" card. Every `kind: unit` or `kind: building` definition now has a cell, including the Wave 1 Workshop units (Gunner, Stalker, Rampart), the flyers and the Carrier. | `src/portraits.js` (`PORTRAIT_ORDER`, `PORTRAIT_ROWS`), `src/portraits.css` (4 × 10 sizes), `tools/blender/render_ui_art.py` (portrait list), `src/art/portraits.webp`, `src/art/portrait-mask.webp` |
| Walker | Not refined. After R3-F it reads well: an ice-white carapace, a team crest, tower shields and a halo (see the review in this file's sheets). | — |

## Sheets (in `j/`)

- [contact-models.png](j/contact-models.png): before/after close-ups of the Drone, Sovereign, Pylon, Salvage yard, Waystation and Workshop. Each is shown in its own side's colour, with a back view and the mint player colour. Rendered in R3-F's game look (`f/render/sheet.html`).
- [contact-portraits.png](j/contact-portraits.png): the old and new atlas through the runtime CSS (atlas plus team mask multiplied, alternating mint and coral).
- [luminance.json](j/luminance.json): R3-F's luminance measure for the six changed models.
- To reproduce: `AUDIT_CHROME=<chrome.exe> node docs/aaa/results/round3/j/render/run.mjs [contact] [lum] [atlas]`. Before that, copy the base models into `.tmp/before-models/` and the base atlas into `.tmp/before-art/`.

## Numbers

### Luminance (300 px close-up, own side's colour, mean linear Y per class)

| Model | Body Y before → after | Body near-black before → after | Lit-part pixels before → after | Note |
|---|---|---|---|---|
| Iron Sovereign | 0.052 → **0.144** (×2.8) | 70% → 49% | 571 → 571 (Y 0.53 → 0.72) | Team area unchanged (0.105) |
| Drone | 0.290 → **0.633** | 14% → 2% | 582 → 645 | Team pixels 4,341 → 2,099 on purpose: team paint moves from the whole shell to the crest, band, stripes and fins (like R3-F's Walker) |
| Pylon | 0.384 → 0.384 | 6% → 6% | 356 → **475** | +Window |
| Salvage yard | 0.216 → 0.218 | 18% → 17% | 50 → **185** | +Window |
| Waystation | 0.473 → 0.473 | 9% → 9% | 49 → **473** | +Window |
| Workshop | 0.276 → 0.276 | 9% → 9% | 261 → **402** | +Window |

### Budgets

| Model | Triangles before → after | Budget | Materials before → after |
|---|---|---|---|
| drone | 1,568 → 2,516 | 4,500 | 4 → 4 |
| ironsovereign | 1,904 → 1,904 | 2,800 | 6 → 6 (Gold renamed Crimson) |
| pylon | 2,800 → 2,976 | 4,000 | 5 → 6 |
| salvageyard | 2,140 → 2,140 (the cab replaces filler fixtures) | 4,000 | 7 → 8 |
| waystation | 2,104 → 2,148 | 4,000 | 6 → 7 |
| workshop | 3,736 → 3,912 | 4,000 | 5 → 6 |

- **Material rule:** each building is still at or under its nearest existing building, the HQ (9) and Barracks (9).
- **Atlas size:** `portraits.webp` grew from 135 KB to 192 KB and `portrait-mask.webp` from 44 KB to 62 KB.

### Render budget

All 26 scenarios pass. Run on an RTX 4080 SUPER (D3D11) with `tests/render-budget.mjs`; before = `r3-wave-1m` (`--record r3j-before`), after = this branch with assertions on.

| Scenario | Draws before → after | Triangles before → after |
|---|---|---|
| `battle-eco` | 107 → 107 | 283,738 → 283,738 |
| `three-factions-eco` | 182 → 182 (limit 185) | 282,018 → 284,862 (the Drone) |
| `battle-expanded-eco` | 114 → **115** (limit 125) | 291,282 → 291,634 (the Workshop window: one draw per building type on screen) |
| `boss-sovereign-eco` | 113 → 113 | 285,620 → 285,620 |
| `night-base-high`, `storm-base-high` | 142 → 142 | unchanged |

- **Other scenarios:** the other 21 are identical in draws, shadow draws and triangles.
- **Limits:** no limit was changed.

### Tests

| Check | Result |
|---|---|
| `npm test` | 1,031 tests, 1,004 pass, 27 skipped, 0 fail. The base `r3-wave-1m` had 1,027, so this package adds **+4**. |
| `tests/assets.test.js` | Green, with the small changes listed below. |
| New `tests/r3j-models-portraits.test.js` | 4 tests:<br>1. **Portrait cells:** every unit and building definition has a cell, and `ironsovereign2` is reserved last. The Blender list, the WebP dimensions and the CSS sizes all match the order.<br>2. **Drone:** Wardens paint, `hover`, the rig, four materials and the budget.<br>3. **Sovereign:** the `sovereign3` palette is warm and bright with umber dark, the bake classes are unchanged, the parts are present and the budget holds.<br>4. **Buildings:** every building has a lit `Window*` or `Lamp*`, and the four new windows are present. |
| Pins | No sim file changed. The idle fingerprint, the 14 mission checksums and the golden pins pass in `npm test`. |
| Browser suites, port 4235 | See "Browser suites" at the end. |

## Test changes for the integrator

1. **`tests/assets.test.js`** (portrait test, line ~87): the cell count is now 37 (was 29), and the flyer slice is `order.slice(25, 29)` (was `slice(25)`).
2. **`tests/assets.test.js`** (R3-F faction test):
   - the Drone is no longer excluded from "wears its faction paint";
   - the material limits are now salvageyard 8, waystation 7, pylon 6 and workshop 6 (each +1 for `Window`).
3. **`tests/portraits.mjs`**: the expected atlas height and `background-size` now come from the order length (`768 × 192·rows`, `400% rows·100%`), so they no longer hard-code 1536 and 800%.

## Seam requests

1. **R3-H, `ironsovereign2`:** its cell is reserved, so no action is needed. `PORTRAIT_ORDER` already ends with `"ironsovereign2"`, and its cell holds the Sovereign render.
   - **If H's merge also appends `ironsovereign2` to `PORTRAIT_ORDER`:** keep only one entry, the one in this branch.
   - **If the second Sovereign gets its own model:** change `SAME_MODEL` in `render_ui_art.py` and re-render with `render_ui_art.py -- src/art portraits`.
   - **If H's `ironsovereign2` definition has no `kind: "unit"`:** test 1 ignores it, but the reserved cell still works through `hasPortrait()`.
2. **R3-H, the Sovereign's look:** the model's materials are now `Armor` (brass), `Crimson` (was `Gold`), `Undercarriage`, `Team`, `Steel` and `BossCore`.
   - No runtime code reads `Gold`: `boss-view.js` animates nodes, not materials.
   - If H tints boss parts by material name, use the new name.
3. **R3-D, night glow:** four more buildings now carry `Window`: pylon, salvageyard, waystation and workshop. Every building now has `Window*` or `Lamp*`.
4. **For the integrator:** `docs/ASSET_PIPELINE.md` has a new section, "Round 3 models and portraits (R3-J)". It updates the stale "4 × 8 atlas" figure in "Interface art" without editing that paragraph.
   - When adding a unit type later, append it to both portrait lists and update the 3 CSS sizes if the row count grows.
5. **`src/portraits.css`** is not named in the brief, but it is the atlas's own stylesheet and only `src/portraits.js` imports it. I changed only its three sizes and three positions.

## Browser suites (port 4235)

All suites passed on the built game (`TEST_URL=http://127.0.0.1:4235/`):

| Suite | Result | Why it ran |
|---|---|---|
| `portraits` | PASS (6.0 s) | 37 cells populated in both layers at 3 viewports |
| `model-loading` | PASS | |
| `factions` | PASS (22.8 s) | Drone and faction buildings |
| `sovereign` | PASS | |
| `ui-quality` | PASS | Portraits in the selection card and command tiles |

**`baselines:diff` (fast set):**
- `defence` is identical.
- `missions-standard` differs. This difference already exists at the base: the integrator left the five mission tables failing on purpose for R3-I (`wave-1.md`, "Baselines").
- This package changes no file under `src/` other than the two portrait files and the two atlas images, so it cannot move play.

The scratch files in `.tmp/` were removed and the preview server was stopped.
