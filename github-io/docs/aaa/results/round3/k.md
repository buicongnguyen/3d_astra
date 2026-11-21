# R3-K: Battle readability (results)

Branch `r3/k-readability` from `r3-wave-1m`, worktree `C:\Users\n\source\repos\3d_astra-r3-k`, port 4236.
Plan: `docs/aaa/AAA_ROUND3_PLAN.md`, R3-K. Status: **done**, with one seam request (group badges need a one-line link in `main.js` to show in play).

## What the player gets

| Feature | How it reads | Cost | Where |
|---|---|---|---|
| **Type icons at the widest zoom** | Within 2 of the widest zoom (88, or a Defence Overview's 96), each visible unit carries a 16 px team-coloured tile with its class glyph: hammer (Harvester), blade (melee), round (ranged), shell (siege), cross (support), tank (armour), rocket (anti-armour), wings (air), truck (transport). The body is the team colour deepened to 60% so the pale glyph reads on light team colours. Gone at any closer zoom. | The status-icon atlas and its draw (one instanced quad): +1 draw only when nothing else used it | `src/status-view.js` |
| **Group badges** | At zoom 56 or less, each of the player's units in a Ctrl+number group shows the group's number (the lowest if it is in several) on a navy tile with a warm rim, left of any status icons. 19 px tile, digit at least 11 px tall, "Arial Black" stack (no system-ui). Display only: no button, nothing on the phone dock (owner rule). | Same atlas draw | `src/status-view.js` |
| **Combined squads in gold** | A Frontier Defence squad bought Combined (`e.combined`, R3-C) stands on a gold trim ring (2.45 m, eight bright notches) with a soft warm glow that breathes; a gold star sits in the icon row. Steady glow with reduced motion or combat motion off. | +1 draw (one instanced quad for all rings, no shadow) plus the atlas draw for the stars | `src/army-readability-view.js`, `src/status-view.js` |
| **Off-screen threat arrows** | A hit on one of the player's units outside the view puts a 40 px warm red arrow on the battlefield's edge (30 px inset, under the top cover, above the dock), pointing at it, for 2.6 s after the last hit with a 0.6 s fade. Hits within 16 m or 0.42 rad share an arrow; at most four. A unit lost out of view flares its arrow gold. They pulse with motion on, hold still with reduced motion. | 0 draws: a pooled DOM layer inside `#world` (`pointer-events: none`), built on the first off-screen hit; transform and opacity written only when they change | `src/threat-arrows.js` (new) |
| **Three death looks** | **Blast** (shells, rockets, bombs, barrages, splash): thrown 1.4 m back along the shot with a hop, landing flat; vehicles hop 1.05 m, roll and turn, with a secondary fireball. **Seared** (beams, rails, pulses, flame, hose): a flash in the weapon's own colour, rising embers and ash; the soldier is charred where it stands (per-instance tint) and crumples after a stiff shudder; a wreck shudders and settles lower. **Ballistic** (rifles, bursts, pellets, melee): the fall or hop as before, with a dust kick. Buildings, flyers and bosses keep their own falls. With motion off: no throw, hop or shudder (the end poses only). | 0 draws: every effect from the existing pools in `src/fx.js` | `src/combat-feedback.js` (`DeathLooks`, `deathLookOf`), `src/view.js` `beginDeath` / `updateDying` |

The killing shot's event follows the death event in the same frame (`sim/combat.js` pushes the shot after `applyDamage`), so `beginDeath` leaves `look: 0` and the `DeathLooks` plugin settles it in `update()`, once every event of the frame is in. Barrages (`strike`, also pushed after the deaths) and splash shells count through per-frame zones; otherwise the last shot within 4 s names the killer.

## Numbers

### Draw calls (render budget, RTX 4080 SUPER, D3D11)

"Before" is the `r3-wave-1m` build (exported to `.tmp/base`, built there and served on 4236), measured with the same new scenarios (`--record r3k-before`).

| Scenario | Before | After | Extra | Triangles after | Uploads after |
|---|---|---|---|---|---|
| `battle-eco` (zoom 30) | 107 | 107 | 0 | 283,738 | 0 |
| `gunner-battle-eco` (status icons already on) | 117 | 117 | 0 | 275,602 | 0 |
| `defence-big-eco` (zoom 92, not the widest) | 93 | 93 | 0 | 167,777 | 0 |
| `large-map-high` (zoom 105: past the widest) | 217 | 218 | +1 | 375,755 | 0 |
| **`wide-battle-eco`** (new: battle-eco at zoom 88) | 148 | **149** | +1 | 351,538 | 0 |
| **`groups-battle-eco`** (new: battle-eco, 3 groups of 8) | 107 | **108** | +1 | 283,786 | 0 |
| **`combined-defence-eco`** (new: Three Roads, both squads Combined) | 93 | **95** | +2 | 167,793 | 0 |

No shadow draw anywhere (none of the new meshes casts). Every other scenario of the full run is unchanged in draws and passes; the full `render-budget.mjs` run on 4236 is green (the first run stopped on `wide-battle-eco`'s triangle line, which the whole-map view passes on the base build too: 351,390; the scenario now carries `triangles: 380000`). Limits: `wide-battle-eco` 152, `groups-battle-eco` 111, `combined-defence-eco` 97 (base + 4). `noGrowth` passes on the new skirmish scenarios (`[109, 109, 109]`, `[97, 101, 101]`).

### Tests and pins

- `npm test`: 1,032 tests, 1,005 pass, 27 skipped, 0 fail (+5: `tests/r3k-readability.test.js`, about 0.1 s).
- Pins: none moved and none declared. All golden pins, `d071360b` and the 14 mission checksums run in `npm test` and pass. Nothing reads or writes the simulation: the plugins read entities and events, and `view.js` adds two fields to its own dying record.
- `npm run baselines:diff -- --jobs 3` (fast set): `defence` identical (189 s). `missions-standard` DIFFERS from the stored round-2 baseline, but **the untouched `r3-wave-1m` export (`.tmp/base`) gives the same diff line for line** (m01 time 143 -> 138, m03 objective bot "running at 1260 s", and 9 more), so the stored baseline predates Wave 1's merge; this package changes nothing in it (no sim file is touched). The integrator should re-record `missions-standard` on the Wave 1 base (`npm run baselines:diff -- --record --only missions-standard`) or check which Wave 1 package moved it (m03's objective bot no longer winning in 1,200 s may be worth a look).
- Browser suites green on 4236: `readability` (new, 3 viewports + Defence), `gunner` (status icons share the atlas), `visual-combat`, `feel`, `army-depth`, `air`.

## Screenshots (`docs/aaa/results/round3/k/`)

| File | What |
|---|---|
| `wide-before-{desktop,portrait,landscape}.png` / `wide-after-*.png` | The wide-zoom pairs: two 28-unit armies at the widest zoom with the icons held off (same build, same frame) and on. |
| `groups-*.png` | Groups 1, 2 and 4 badged at close zoom. |
| `threat-arrow-*.png` | A hit on a Ranger 60 m out of view: the arrow on the edge (portrait is under reduced motion). |
| `death-looks-*.png` | A shell (blast), a Stalker beam (seared) and a rifle (ballistic) killing three units, 0.25 s in. |
| `combined-desktop.png` | Three Roads: a squad bought Combined, its gold trim and stars. |

Regenerate: `SHOTS=1 TEST_URL=http://127.0.0.1:4236/ npm run test:readability` (the committed PNGs are quantized to 256 colours to keep the folder at about 3 MB).

## Seam requests

1. **`src/main.js` (no Wave 2 owner), one line after the WorldView is made (line 132):**
   ```js
   S.view.controlGroups = S.groups;
   ```
   `S.groups` is the app's Ctrl+number Map (`"1".."9"` to id arrays); it is mutated in place and cleared on a new match, never replaced, so one link is enough. Until it lands, the group badges are built and tested (node and browser, where the test links a Map) but do not show in play. The view reads it only at close zoom and rebuilds its id map only when a group array is replaced or changes length.

2. **Integrator (not a code seam):** `missions-standard` differs from its stored baseline on the base tag itself (above).

## Test changes for the integrator

- New: `tests/r3k-readability.test.js` (5 tests), `tests/readability.mjs` (browser suite), `package.json` `test:readability`, `.github/workflows/pages.yml` matrix entry `r3-k`.
- `tests/render-budget.mjs`: three scenarios appended to the list, a `groups` / `combined` set-up block before "Data-driven units" (view-only fields), one `Object.assign(limits, …)` line.
- No existing test edited. `tests/gunner.test.js` still reads `plugin.cell.array` as `[cell, alpha]` (kept), and the status cells keep indices 0 to 3.

## Files

- Owned: `src/status-view.js` (atlas now 8 x 3 cells: 4 status, 9 types, 9 digits, the star; an `iTint` attribute; capacity 96 to 512), `src/army-readability-view.js` (gold trim), `src/combat-feedback.js` (death looks, appended), `src/view.js` (`beginDeath`: the record's `id` and `look`; `updateDying`: the vehicle and infantry branches).
- New: `src/threat-arrows.js`, `tests/r3k-readability.test.js`, `tests/readability.mjs`, this file and `k/`.
- Append-only: `src/view-plugins.js` (`ThreatArrows`, `DeathLooks`), `tests/render-budget.mjs`, `package.json`, `.github/workflows/pages.yml`, `docs/CHANGELOG.md`, `docs/TESTING.md`.
- No new UI strings (the arrows and badges carry no text), so no `vi.json` change.
