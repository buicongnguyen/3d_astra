# R3-W: Wings and rockets: results

Branch `r3/w-wings-rockets`, base `r3/f-warm-kit` (`629b19e`), worktree `C:\Users\n\source\repos\3d_astra-r3-w`, port 4233.
Status: **done**. One known issue is not caused by this package (see "Render budget").

The owner asked: "the anti-tank bullet, can we make the shape of the bullet more clear with a cheap price so it makes the fight more beautiful? About the air units, why limit to only 4 units? And make air units more beautiful too."

## What changed

| Part | Change | Files |
|---|---|---|
| Rocket body | A finned rocket of 26 triangles with a faction band, a red nose and a self-lit flickering flame. Every rocket in flight is drawn by **one** `InstancedMesh` (48 slots). It is hidden while no rocket flies, has no shadow and allocates nothing per frame. | `src/fx-kinds/rocket-body.js` (new) |
| Rocket flight | The flight takes 0.45 s (was 0.24) along a slight arc (5% of the range, at most 0.7 m), rolling at 13 rad/s. It scales up to 1.8× so it is never shorter than about 24 CSS px at phone zoom. A pooled glow sprite follows the nozzle as the flame halo, and stretched smoke segments form a ribbon. The new kind `rocket` is used by `antitank` (`visual-style.json`: `look: "rocket"`, `life` 0.45). The hit sound delay (`audio-logic.js` `HIT.rocket`) follows `life`, as the audio test requires. | `src/fx-kinds/rocket.js` (new), `src/fx.js`, `src/visual-style.json`, `src/audio-logic.js` |
| Shaped impact | **On armour** (the target is `mechanical`): a white-hot star flash, the heavy hit at power 0.8, nine sparks thrown back toward the shooter's side, three metal chips and a ring. **Soft** (infantry, buildings: 20 damage): a small flash and the hit at power 0.45. A killing shot (target gone or dead when the event is drawn) keeps the old quick 0.24 s flight, so the rocket lands before the wreck falls. | `src/fx.js` `rocketImpact` |
| Hawk pods, Watcher rail | The Hawk's pod rockets show a small (0.6×) body on their straight path, in the same draw. The Watcher rail is unchanged. Both were checked in `tests/weapon-looks.test.js` (every kind is deterministic and draws only from the pools). | `src/fx-kinds/pods.js` |
| Motion off, quiet | Unchanged: with combat motion off, a weapon kind never runs. You see the brief static tracer and the immediate hit, as before. | |
| Air cap | New keys `air.cap_by_level` [4, 6, 8] and `air.ai_cap_by_level` [2, 3, 4] (`cap` 4 and `ai_cap` 2 are kept). `sim.airCap(team)` returns the player's cap by their best complete Command core level. A computer team (team > 0, or team 0 under `aiPlayer`) keeps `AIR.cap` unless `fieldPlan()` holds (Field plan, skirmish, no mission). `orders.js:124` is the only line changed there. | `src/sim/air.js`, `src/sim/orders.js`, `src/balance.json` |
| Air strings | The message is still "Air limit reached: N flyers at once." with the current N. Flyer tiles add "Air limit: 3 of 6 flyers; 8 with a level 3 Command core" to their title (the hud signature re-renders when the count changes). The field guide names 4 / 6 / 8. Three new `vi.json` patterns. | `src/app/hud.js`, `src/field-guide.js`, `src/locales/vi.json` |
| Flyer motion | Flyers bank into turns (Kite 0.42, Hawk 0.38, Glider 0.62 rad at most), lift the nose on a climb and dip it on a descent (at most 0.3 rad). The Balloon only sways (±0.05 rad). Everything eases back to level with combat motion off or reduced motion. | `src/air-motion.js` (new), `src/view.js` (the flyer block: 3 lines) |
| Air life | A view plugin draws, in **one** premultiplied instanced draw: rotor and fan blur discs in the craft's tilted rotor plane, the Glider's propeller disc, blinking red (left) and green (right) wing lights, a white tail strobe, and engine, fan or burner glow. A night look makes the lights 1.5 to 2× larger and stronger (`mission-looks.js` `glow`), and rotor blur darkens with the scene. Wing-tip contrails above 4.2 m/s come from the effects' smoke pool. The blob shadow shrinks as the craft rides higher (rims, climbs). Still frames re-send nothing. | `src/air-life-view.js` (new), `src/view-plugins.js` |
| Flyer models | **Kite:** warm Hazard edging on the leading edges, and a longer tail with a third bow. **Hawk:** team end plates on the stabiliser (a twin tail) and a dorsal intake. **Balloon:** a crown vent cap, four team streamers and a Hazard pennant. **Glider:** upturned team winglets and a Hazard sun disc. No new materials. Rotor pivots are unchanged, and the manifest is updated in place with `review: "pending owner review (round 3)"`. | `tools/blender/generate_air.py`, `public/models/{kite,hawk,balloon,glider}.glb`, `manifest.json` |
| Still-frame uploads | The effect layers, the rocket bodies and the air life keep their GPU buffers on a frame with `dt` 0 when the count is unchanged. A paused game or a frozen benchmark scene with rockets in flight then re-sends nothing. Before, active effects re-sent every frame. | `src/fx.js` `Layer.update` |

The carrier was named in the brief's model list, but it is a ground truck. It was left unchanged.

## Numbers

### Draws and triangles

Measured with `tests/render-budget.mjs` on an RTX 4080 SUPER (D3D11), phone Eco scenarios. "Before" is `629b19e` built from `.tmp/base`, with the same scenarios.

| Scenario | Draws before | Draws after | Triangles before | Triangles after | Uploads after |
|---|---|---|---|---|---|
| `battle-eco` | 106 | 106 | 283,334 | 283,334 | 0 |
| `air-battle-eco` (8 flyers) | 115 | 116 (+1 air life) | 292,742 | 293,168 | 0 |
| **`air-battle`** (new: 16 flyers of all four types, 6 rockets in flight) | 123 | **125** (+1 rocket bodies, +1 air life) | 302,594 | 303,838 | 0 (base: 8) |

- **Rockets:** +1 draw (budget +2). **Air visuals:** +1 draw (budget +3). The shadow pass is unchanged (0 shadow draws on Eco, and neither new mesh casts a shadow).
- **Limit:** `Object.assign(limits, {'air-battle':135})`.
- **Rocket body:** 26 triangles (156 for the six in flight).
- **Flyer triangles** (budget 1,500):

  | Model | Before | After |
  |---|---|---|
  | Kite | 904 | 950 |
  | Hawk | 1,408 | 1,444 |
  | Balloon | 1,308 | 1,400 |
  | Glider | 1,080 | 1,148 |

- **Materials:** Kite 7, Hawk 6, Balloon 8, Glider 9, the same as before.

### Pins

- **`npm test`:** 970 tests, 944 pass, 0 fail, 26 skipped. That is +7 tests (`tests/r3w-wings-rockets.test.js`) against 963 before.
- **Pins:** no golden pin, mission checksum or idle fingerprint moved. That is as expected:
  - computer teams outside the Field plan keep `AIR.cap`;
  - the Field AI's own `room()` (`ai-counter.js`) still checks `AIR.cap`.
- **Changed tests:**
  - `tests/air.test.js`: the cap test now covers 4 / 6 / 8. Its old body set a level 3 core and expected 4.
  - `tests/weapon-looks.test.js`: the Effects root has 5 children (the rocket-body mesh) instead of 4.
- `baselines:diff -- --full`: see the line at the end.

## Render budget: a known issue that is not from this package

`render-budget.mjs` fails `noGrowth` on `battle-eco` with the same numbers on the **unchanged base build** (`629b19e`): `batches before/after restarts [73, 101, 101]`. That is +28 batches on the first restart, and 6 are allowed. `air-battle` shows the same (`[90, 118, 118]`). Every check before it passes for `air-battle`: draws, triangles, composes and uploads. It needs a look by the integrator or R3-F (it is probably the warm kit's new materials on restart). This package did not touch it.

## Screenshots (`w/`)

| File | What |
|---|---|
| [rocket-close.png](w/rocket-close.png) | Three rockets 0.22 s after firing, desktop close zoom: before (a streak and a glow) and after (finned bodies, flame halo, ribbon). |
| [rocket-phone.png](w/rocket-phone.png) | The same at phone zoom (390×844). Before, the rounds had already hit by 0.24 s. After, three bodies are in flight. |
| [rocket-hit.png](w/rocket-hit.png) | The hit on three tanks: before, after (armour impact), and the smaller burst on Vanguards. |
| [air-day.png](w/air-day.png), [air-night.png](w/air-night.png) | Flyers banking through a turn by day and at night: rotor blur, nav lights and engine glow. |
| [air-phone-after.png](w/air-phone-after.png) | Flyers at phone zoom. |
| [flyers-contact-before-after.png](w/flyers-contact-before-after.png) | The `preview_air.py` sheet before (top) and after (bottom). |

The probe that made them was a scratch script in `.tmp/` (deleted).

## Seam requests

- **W1 (R3-A, `sim/ai-counter.js`):** to let the Field AI use the larger cap, line 54 `room()` should read `this.airCount(team) < this.airCap(team)`. Line 59 should read `count(...) < this.aiAirCap(team)` instead of `AIR.ai_cap`. Both helpers are in `sim/air.js`, and both return the old values unless `fieldPlan()` holds, so the Classic AI and missions cannot move. The Field pins (`golden-w2d`, `golden-round2` arena, `field-command.test.js`) may move. That is R3-A's call (owner decision O6).
- **W2 (integrator):** `render-budget` `noGrowth` fails on the base build (see above).

## Test changes for the integrator

- **New:** `tests/r3w-wings-rockets.test.js` (7 tests, about 0.3 s).
- **Edited:**
  - `tests/air.test.js` (the cap test)
  - `tests/weapon-looks.test.js` (5 root children)
  - `tests/render-budget.mjs`:
    - a `rockets: n` set-up block after the air spawns
    - the `air-battle` scenario
    - the limit line
