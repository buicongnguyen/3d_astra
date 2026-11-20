# W1-E results: Boss engine II and the Iron Sovereign

Status: **done**, with one note (break rate is a pooled figure, it swings with the share). Branch `r2/w1e-boss-engine`, port 4236.

## Before and after
| Item | Before | After |
|---|---|---|
| `npm test` | 710 tests, 695 pass, 15 skipped | 725 tests (+15), 709 pass, 1 fail (the W0-B test below), 15 skipped |
| `baselines:diff` (missions-standard, defence) | identical | identical (re-run at the end) |
| `check:missions --only m03` Story / Standard / Veteran vs baseline rows | n/a | identical, all three |
| m03 golden pin, `bosses.test.js`, `tests/boss.mjs` | pass | pass |
| render `battle-eco` / `boss-battle-eco` | 107 / 116 | 107 / 116 |
| `boss-sovereign-eco` (limit 120) | n/a | 113 draws |
| `defence-boss-eco` (limit 125) | n/a | 116 draws (with the harness fix below) |
| `ironvanguard.glb` | sha 560b541a... | identical |

## Tuning (Sovereign numbers are new, the Vanguard is untouched)
Brief values 12,000 HP, 4 + 4 Drones, share 0.08 failed: the 8-unit force died to the Drones, and no attack ever broke (towers deal about 250 in a 3 s warning, not 600). Final: **10,000 HP + 300 shield, 2 Drones at 2/3 and 1/3, break share 0.0165** (about 170 of 10,300).

| Field sandbox, Standard | Result |
|---|---|
| 6 Rangers + 2 Breakers | dead at 134 s, 4 of 8 alive (criterion 90 to 200 s, 3 or more: met) |
| 12 Rangers + 4 Breakers | dead at 53 s, 12 of 16 alive (expected 50 to 110 s: met) |

Neighbouring values, 6R + 2B: 10,000 HP / 2 Drones 114 s, 6 alive; 10,500 / 2: 145 s, 3 alive; 11,000 / 2: boss alive at 400 s (a cliff: the force loses its Rangers to the Drones, keep HP at 10,000).

| Route sandbox, d-crossroads, 10 towers at tiers 2 and 3 | Warnings | Broken | Rate |
|---|---:|---:|---:|
| west road, share 0.0165 | 8 | 6 | 75% |
| mideast road, share 0.0165 | 21 | 3 | 14% |
| pooled | 29 | 9 | **31%** (target 25 to 60%: met pooled) |

The rate is a cliff: breaking opens a 6 s window, towers then kill faster, so there are fewer attacks. Share 0.017 or more gave 14 to 18% on both roads, 0.03 gave 0%. The boss walked 38 of 202 s on the earlier run, stops to attack and resumes, a leak costs 10 lives, nobody leaked in the sandbox.

## Acceptance
All met: m03 / check:defence unchanged (baselines:diff, m03 rows identical on 3 difficulties); field sandbox; route sandbox; draws 113 and 116; boss bar text 11 px or more at 390x844 and the bar rises above `--defence-bar-h` (`tests/sovereign.mjs`, PASS); `golden-w1e.test.js` (re-recorded after the tuning, first record of this package); test count +15; CI matrix entry `r2-w1e` (script `test:sovereign`).

## Seam requests and integrator changes
1. `tests/content-seams.test.js` line 278 assumes no registered statuses; with `stunned` registered it fails (1 !== 0). Compare against the count before the fixture.
2. `tests/render-budget.mjs` (W0-A's harness): `assert.equal(field.units, scenario.wave)` must be `scenario.wave + (scenario.boss ? 1 : 0)` or `defence-boss-eco` fails its own assert.
3. Append-only merges: `src/sim/content/index.js`, `balance.json`, `manifest.json`, `vi.json`, `render-budget.mjs`, `package.json`, `pages.yml`.

## Deviations and notes
- `tests/bosses.test.js` data test caps at 30% of health + shield (120) and covers every attack.
- `stunned` also has `noCast`. Strafe is field-only. Route mode stops walking while the next attack's target is in reach.
- Light gun 10 per 1 s at 14 m, radius 2.4, scale 1.9 (not in the brief). Stomp uses the breaker weapon look.
- Stun icon waits for W1-B's status plugin. Screenshot: `w1e/boss-sovereign-eco-scene.png`.
