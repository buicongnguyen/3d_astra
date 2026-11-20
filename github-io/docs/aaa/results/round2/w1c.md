# W1-C results: Veil Stalker and ability UI from data

Branch `r2/w1c-stalker` (base tag `r2-wave-0`), port 4234. Machine shared and busy: timings are indicative; every sim number below is deterministic.

## What was built
- `stalker` definition (balance.json, Veil workshop, Expanded only, level 2) with the numbers of the brief, `prefers`, `cloak`, `ai`, `intro`, and the ability Steady aim.
- `src/sim/content/marksman.js`: Steady aim as a registered timed buff (+3 m range, `pierce: 1`; both keys put back, `pierce` deleted), autocast on a preferred target within range + 3 m, the `pierce` tag on the shot (via `onHit`, not `hitScale`: main target only).
- Ability UI from data: `tactics-ui.js` (`abilityIcon`, `abilityAimed`, `abilityOrder`, `abilityTint`; ties by id), `tactics-card.js`, `ability-hints.js`, `tactics-view.js` (buff ring tint and the cast-flash tint handed to fx), `fx.js` (one table line: `|| e.tint`).
- Art: `tools/blender/generate_stalker.py`, `public/models/stalker.glb` (2,724 triangles, budget 3,000; 7 materials = the Ranger's: Cloak and Lens are new, kept on every team), manifest entry (`review: pending owner review (round 2)`, no faction/air), `weapons.stalker` (muzzle 2.5 m ahead, 1.4 m up, matches the model; a test checks it). Sheets in `w1c/`: `stalker-game.png` (with Watcher and Shade), `-greyscale`, `stalker-hero.png`, `stalker-back.png`, and `stalker-battle-eco-scene.png`.
- Vietnamese for name, role, description, intro, ability and all four hint forms.

## Acceptance
| Criterion | Number | Met |
|---|---|---|
| Heal-ball duel (6 Rangers + 2 Medics, equal cost): mean ≥ +0.15 | +0.199 | yes |
| ... at least 7 of 10 won | 7 | yes |
| ... Medics die before 2 Rangers in ≥ 6 of 10 | 7 | yes |
| Vanguard pack mean ≤ -0.2 | -0.33 (1,000) | yes |
| Shade pack mean ≤ -0.2 | -0.37 (Meridian seat), -0.86 (Veil mirror) | yes |
| Lone Stalker per tower (recorded) | 82.1 s, no damage taken | recorded |
| Riders (recorded) | -0.10 at 1,000 | recorded |
| `stalker-battle-eco` draws ≤ 125 | 121 p95 (battle-eco 107, identical to wave 0) | yes |
| `golden-w1c.test.js`: scripted sandbox, hashes at 30 and 60 s, one Steady aim cast | `5a9948a5`, `4678ef0e` | yes |
| `abilities` and `tactics-ui` browser suites green | both PASS (all 3 viewports) | yes |
| Golden pins identical | `npm run test:golden-full`: 55/55 (all existing pins unmoved) | yes |
| Test count +12 | 710 to 735 (+25: 18 in `stalker.test.js`, 6 in `tactics-ui.test.js`, 1 pin) | yes |
| `baselines:diff` identical | see "Baselines" below | see below |

Full duel table: `docs/BALANCE.md` section "Veil Stalker". No tuning was used. The heal-ball margin is thin (see there).

## Tests run
- `node --test tests/*.test.js`: 735 tests, 719 pass, 15 skipped (long pins), **1 fail**: `tests/content-seams.test.js` "module checks ..." asserts the real registry is empty after a refused list (`STATUSES + ABILITIES == 0`). Any registered content breaks it (every Wave 1 package). Not my file; the exact fix is `w1c/content-seams-test.patch` (compare against the real registry's counts). Verified: with the patch the file passes 0 fail.
- Render budget with asserts: draw budget and the first checks pass; the generic `noGrowth` restart check ("batches before/after restarts [74, 102, 102]") fails on `battle-eco` and on `stalker-battle-eco` alike. `battle-eco` has no Stalker and its draws are 107, as at wave 0. I could not A/B it against the base tree (the base build would not serve), so it is unconfirmed whether this is load-related or older; the integrator should re-run `RENDER_ONLY=battle-eco` on the wave-0 tag.
- `stalker-battle-eco` needed `triangles: 340000` on its scenario (315,302 against the mobile default of 315,000).

## Pins and baselines moved
None. The marksman module registers `onHit` and `autocast` in every match, both no-ops without a Stalker; a test proves a 90 s AI match hashes the same with and without the module.

## Seam requests and notes for the integrator
1. Apply `w1c/content-seams-test.patch` (above).
2. `src/field-guide.js` lists every definition with a `kind`, so the Stalker shows in the Field guide even in Classic. W1-A owns the file: filter `roster: "expanded"` unless the Expanded rule is on.
3. `src/app/abilities.js` (not mine): an ability with `aimed: true` in data gets its tile and group, but the aiming mode itself is hard-wired to Barrage. No unit needs it this round.
4. Card order: Steady aim has `order: 13`. Built-in abilities occupy 0 to 11; an ability with no `order` and no table entry sorts at 12. W1-B's Crossfire and W2-A's Ram should take 12 and 14 or their own unique values; equal orders fall back to id order.
5. The Stalker has no portrait (round 3) and no `hits_air` (the brief gives none): Kites and Hawks cannot be shot by it.

## Deviations from the brief
- The `pierce` tag is raised in `onHit` (main target only) instead of `hitScale`.
- The brief's "Kites ... detect within 8 m" is as in the code; the Shade-pack gate was measured on the Meridian seat as written, the Veil mirror is recorded as well.

Status: done, with the declared test change and the unconfirmed `noGrowth` render check above.
