# W1-E results: Boss engine II and the Iron Sovereign

Status: **partial** (3 acceptance items unmet or not run, below). Branch `r2/w1e-boss-engine`, port 4236.

## Before and after
| Item | Before | After |
|---|---|---|
| `npm test` | 710 tests, 695 pass, 15 skipped | 725 tests (+15), 709 pass, 1 fail (below), 15 skipped |
| `baselines:diff` (missions-standard, defence) | identical | identical |
| m03 golden pin, `bosses.test.js` (existing 11 tests), Vanguard browser suite `boss.mjs` | pass | pass |
| render `battle-eco` / `boss-battle-eco` | 107 / 116 | 107 / 116 |
| `boss-sovereign-eco` (limit 120) | n/a | 113 draws |
| `defence-boss-eco` (limit 125) | n/a | 116 draws (patched unit-count assert, see seam request) |
| `ironvanguard.glb` | sha 560b541a... | identical |

## Acceptance
- m03 unchanged, `check:defence` identical (baselines:diff): **yes**. `check:missions --only m03` on Story and Veteran was not run separately (Standard is in the baseline diff; the 120 s golden pin holds).
- Field sandbox 6 Rangers + 2 Breakers, 90 to 200 s, 3 of 8 survive: **no**. With the brief's 4 + 4 Drones all 8 die and the boss lives at 600 s. Without drops: dead at 167 s, 3 of 8 survive. The Drones are what kills (light gun alone is not). 12 Rangers + 4 Breakers: dead at 109 s, 3 of 16 survive (expected 50 to 110 s: yes). Needs a decision: fewer or weaker drops, or lower HP.
- Route sandbox d-crossroads: it walks (38 s of 202), stops, resumes, leak costs 10: **yes**. Break rate target 25 to 60%: **no**, 21% (3 of 14) at share 0.015; the brief's 0.08 gave 0%, and 0.05, 0.03 also 0%. Towers deal about 250 in a warning, not 600. Shares 0.01 to 0.014 gave 90%. The share is outside the brief's 0.05 to 0.15 range.
- Draw budgets: yes (113 and 116). Boss bar labels 11 px at 390x844: **not run** (bar CSS reused; only `--defence-bar-h` added).
- `golden-w1e.test.js` (field and route, 30 and 90 s): yes. Test count +15: yes.

## Seam requests and integrator changes
1. `tests/content-seams.test.js` line 278 assumes no registered statuses; with `stunned` registered it fails (1 !== 0). Compare against the count before the fixture instead.
2. `tests/render-budget.mjs` is W0-A's harness: `assert.equal(field.units, scenario.wave)` fails for any Defence scenario with a boss; it should be `scenario.wave + (scenario.boss ? 1 : 0)`. `defence-boss-eco` fails until then.
3. Merge: `src/sim/content/index.js`, `balance.json`, `manifest.json`, `vi.json`, `render-budget.mjs` are append-only edits.

## Deviations and notes
- `tests/bosses.test.js` data test now checks every attack and caps at 30% of health + shield (120), not hp (95); Vanguard numbers pass both.
- `stunned` also has `noCast`. Strafe applies in field mode only. Route mode stops walking whenever the next attack's target is in reach.
- Light gun interval 1 s, range 14 (not given in the brief). Sovereign radius 2.4, scale 1.9.
- Not done: a browser suite for the Sovereign (`tests/boss.mjs` unchanged), Defence-bar placement check on phones, stun icon (W1-B's plugin draws it), CI matrix entry.
- Screenshot: `w1e/boss-sovereign-eco-scene.png`.
