# R3-I: Campaign pacing (AAA round 3, Wave 2)

Branch `r3/i-pacing` from `r3-wave-1m` (13ffe3e), worktree `3d_astra-r3-i`, port 4234, 2026-11-21.

**Status: partial.** Items 1 and 3 are done. Item 2 (Fast against two rivals) is **not** done: nine easing forms were
measured and none moved the Fast 1v2 cells beyond noise, so no AI change ships (four-correction limit; owner options
below).

## 1. Missions restored after the south exits

The owner kept the south exits (R3-L). Every mission the objective bot won on `r3-base` wins again on every table, with
no medal below `r3-base`. `check:missions` (`--jobs 2/3`, one difficulty at a time, `--timeout 600/900`) passes all
five tables with no missed target.

| Mission | Change (mission data only) | Why |
|---|---|---|
| m03 The Ashen Line | Hale's camp guard 5 Vanguards + 3 Rangers -> 3 + 2; north-siphon counter-attack 4 + 3 -> 3 + 2; gold 720 -> 750 s | not won on Standard (running at 1260 s), bronze on Veteran; with both softenings the bot wins at 731 / 743 s |
| m04 Three-Way Dunes | Sunward's wave for the centre and its half of the 5:00 truce wave: 3 Vanguards + 2 Rangers -> 2 + 2 | Veteran defeat at 881 s; one of the two alone left Veteran at bronze |
| m09 A Debt in the Dunes | none; `tools/mission-check.mjs` window for m09 starts at 390 s, not 420 s | since the exits the bot reaches Sol's camp ~20 s sooner and wins the 3-minute hold at 405 s ("too early" for the old window): faster, not harder |
| m12 Frontier's End | its probe (below) at 1:00 | Standard defeat at 914 s on `r3-wave-1m`; with the probe it wins (gold); the probe at 1:10 cost the Story gold, at 1:00 all three are gold |

Objective bot, `r3-base` baseline / `r3-wave-1m` (before) / after:

**Standard**

| Mission | r3-base | r3-wave-1m | after |
|---|---|---|---|
| m01-first-light | 187 s gold | 187 s gold | 188 s gold |
| m02-first-contact | 525 s gold | 557 s silver | 367 s gold |
| m02b-hold-the-river | 239 s silver | 239 s silver | 239 s silver |
| m03-the-ashen-line | 604 s gold | running 1260 s | 731 s gold |
| m04-three-way-dunes | 443 s gold | 422 s gold | 425 s gold |
| m05-the-verdant-pact | 508 s gold | 508 s gold | 505 s gold |
| m06-copper-harvest | 655 s gold | 666 s gold | 634 s gold |
| m06b-wings-over-copper | 508 s gold | 506 s gold | 506 s gold |
| m07-copper-siege | 660 s bronze | 660 s bronze | 660 s bronze |
| m07b-hold-the-valley | 287 s silver | 287 s silver | 287 s silver |
| m08-the-quiet-vault | 469 s gold | 469 s gold | 469 s gold |
| m09-a-debt-in-the-dunes | 431 s gold | 405 s gold (missed the 420 s window) | 405 s gold (window 390 s) |
| m10-obsidian-storm | 538 s gold | 546 s gold | 453 s gold |
| m11-cut-the-draw | 502 s gold | 738 s gold | 490 s gold |
| m11c-hold-the-keystone-roads | 571 s gold | 571 s gold | 571 s gold |
| m12-frontiers-end | 772 s gold | defeat 914 s | 763 s gold |

**Veteran**

| Mission | r3-base | r3-wave-1m | after |
|---|---|---|---|
| m01-first-light | 187 s gold | 187 s gold | 188 s gold |
| m02-first-contact | 494 s gold | 399 s gold | 485 s gold |
| m02b-hold-the-river | 285 s silver | 285 s silver | 285 s silver |
| m03-the-ashen-line | 660 s gold | 1561 s bronze | 743 s gold |
| m04-three-way-dunes | 498 s gold | defeat 881 s | 503 s gold |
| m05-the-verdant-pact | 697 s silver | 443 s gold | 693 s silver (as r3-base) |
| m06-copper-harvest | 636 s gold | 654 s gold | 633 s gold |
| m06b-wings-over-copper | 508 s gold | 506 s gold | 506 s gold |
| m07-copper-siege | 660 s bronze | 660 s bronze | 660 s bronze |
| m07b-hold-the-valley | 321 s silver | 321 s silver | 321 s silver |
| m08-the-quiet-vault | 494 s gold | 494 s gold | 494 s gold |
| m09-a-debt-in-the-dunes | 409 s gold | 400 s gold | 394 s gold |
| m10-obsidian-storm | 738 s gold | 512 s gold | 470 s gold |
| m11-cut-the-draw | 388 s gold | 451 s gold | 382 s gold |
| m11c-hold-the-keystone-roads | 643 s silver | 643 s silver | 643 s silver |
| m12-frontiers-end | 714 s gold | 672 s gold | 735 s gold |

**Story, Standard mercy, Standard firm:** no result or medal differs from `r3-base` (on `r3-wave-1m` mercy had m02 /
m05 silver, m03 running, m12 defeat; firm m02 silver, m03 running, m12 defeat). Passive players survive everywhere;
generic bots meet their targets.

Passive-player losses (a player who only harvests) against `r3-base`: Standard m02 1 -> 0, everything else equal;
Veteran m07 1 -> 0, m10 1 -> 0, m11 3 -> 2, m12 2 -> 1, m03 0 -> 1 (the first real wave at 2:27, not a probe).

## 2. Fast against two rivals (not eased: partial)

`npm run check:difficulty`, 6-map form (`--maps classic,riverlands,dunes,basin,expanse,highlands`, thresholds
12/16/20/24, capture points, 2400 s cap, 24 matches per cell). `r3-base` measured from its extracted `src/`. "After" is
identical to `r3-wave-1m`: this package ships no AI or skirmish change (every skirmish golden pin holds).

| Classic AI, bot wins of 24 | r3-base | r3-wave-1m = after | gate (>= base - 1) |
|---|---|---|---|
| 1v1 Relaxed / Normal / Fast / Relentless | 23 / 20 / 15 / 14 | 24 / 22 / 18 / 17 | pass |
| 1v2 Relaxed / Normal / Fast / Relentless | 11 / 9 / 7 / 2 | 13 / 8 / **3** / 7 | Fast fails |

| Field + Expanded, bot wins of 24 | r3-base | r3-wave-1m = after | gate |
|---|---|---|---|
| 1v1 Relaxed / Normal / Fast / Relentless | 24 / 23 / 18 / 16 | 24 / 22 / 20 / 16 | pass |
| 1v2 Relaxed / Normal / Fast / Relentless | 16 / 10 / 15 / 11 | 18 / 17 / **10** / 12 | Fast fails |

Easing forms tried (Fast, coalition, skirmish only; Fast 1v2 cells, bot wins of 24, Classic / Field):

| Form | Classic | Field |
|---|---|---|
| `r3-base` | 7 | 15 |
| `r3-wave-1m` (no change) | 3 | 10 |
| first joint offensive +30 s (and the raid with it) | 5 | 11 |
| +45 s | 6 | 10 |
| +60 s | 3 | 10 |
| no first raid | 6 | 8 |
| no first raid, +30 s | 2 | not run |
| first raid of 2, first offensive commits 40% (not 70%) | 3 | 12 |
| same, no first raid | 4 | 10 |
| army cap [6, 4] for Fast allies (not [10, 5]) | 3 | 10 |
| allies' Barracks and Foundry rally 7 m behind their core | 3 | 7 |
| diagnosis, not an AI change: the player's new fighters walk 9 m in front of the core | 3 | 10 |

A second sample (thresholds 10/14/18/22) of the most promising form: Classic 4 / 4 / 4 and Field 10 / 5 / 7 for no
change / +30 s / +45 s, so the delay does not ease (Field measured worse). The classic and riverlands maps are lost by
the bot before 3:30 in every form, `r3-base` included; the other maps swing by several matches on any change (a
knife-edge early fight decides a whole row, `wave-1.md` open item 6). Traces (riverlands and classic, Field, threshold
12) show what the exits changed: on `r3-base` the bot's first 6-7 fighters stood north of its Barracks, between the camp
and the rivals, and broke the raider's 75 s harassment; now they come out south, behind the camp, and lose that fight.
Delaying or thinning the raid lets the bot survive the opening but the untouched rival then grows larger, so the later
attack fails instead.

**Owner options:** (a) accept Fast 1v2 as harder since the exits (Normal and Relentless 1v2 got easier: Field 10 -> 17
and 11 -> 12, Classic Relentless 2 -> 7); (b) a player-side change in R3-L's code, e.g. a default rally point in front
of the camp for new fighters (the diagnosis above did not move the bot, so it would need its own measurement); (c) a
larger, non-Fast-only softening of two allied rivals, which this package may not make.

## 3. Pacing

### First contact (objective bot, Standard; `node tools/first-contact.mjs --cap 300` before, `--cap 120` after)

"Contact" is the first enemy hit on anything of the player's; "warn" the first `incoming` warning. After: damage taken
and losses before 2:00. Story and Veteran give the same contact times (probes are not scaled), with no loss before 2:00
(Veteran m10: 9 damage).

| Mission | r3-base contact / warn | r3-wave-1m contact / warn | after contact / warn | after: damage, losses before 2:00 |
|---|---|---|---|---|
| m01 First Light | 136 / 130 | 136 / 130 | 78 / 70 (1 scout) | 0, none |
| m02 First Contact | 221 / 215 | 221 / 215 | 77 / 70 | 0, none |
| m03 The Ashen Line | 221 / 215 | 215 / 235 | 205 / 235 (no probe) | n/a |
| m04 Three-Way Dunes | 290 / 292 | 283 / 284 | 77 / 70 (1 scout) | 0, none |
| m05 The Verdant Pact | 228 / 235 | 229 / 235 | 77 / 70 (1 scout) | 0, none |
| m06 Copper Harvest | 252 / 193 | 240 / 185 | 77 / 70 | 4, none |
| m06b Wings over Copper | 122 / 100 | 122 / 100 | 122 / 100 (unchanged) | n/a |
| m07 Copper Siege | 203 / 200 | 204 / 200 | 75 / 70 | 0, none |
| m08 The Quiet Vault | 0 (no base) | 0 | 0 (unchanged) | n/a |
| m09 A Debt in the Dunes | 156 / 150 | 156 / 150 | 77 / 70 | 0, none |
| m10 Obsidian Storm | 219 / 235 | 213 / 235 | 76 / 70 | 4, none |
| m11 Cut the Draw | 213 / 235 | 214 / 235 | 77 / 70 | 0, none |
| m12 Frontier's End | 232 / 235 | 232 / 235 | 67 / 60 | 0, none |

The probe: `{ when: { time: 70 }, do: [say, { wave: { team, units: { vanguard: 1 or 2 }, from: { x, z }, target: { x, z }, probe: true } }] }`
appended to each mission's triggers (existing trigger indices unchanged, so saves keep their fired triggers). It is
sent from about 60 m out toward a spot 12-16 m in front of the Command core and meets the guard at about 1:15.
`src/sim/missions.js`: a `probe` wave is not scaled by difficulty, and its `incoming` event carries `probe: true` so a
`{ event: "incoming" }` trigger (the "first attack" lines) waits for the first real wave; the interface still warns.
Ashfall light infantry everywhere except m10 (a Warden sentry pair). Sunward's light unit as a probe killed a passive
player's guard and Barracks in m04, so m04 and m05 use one Ashfall scout. m03 has none: its guard chased the scouts
out of the towers' cover and a passive player then lost 7 units to the first wave; without the probe m03 is silver at
731 s, hence gold 750 s.

### Optional objectives done before 1:00

Only m03's "Build two Sentinel towers" (done at 0:00: the camp starts with two). It is now "Have four Sentinel towers
standing" (two towers' cost); Okoro's line says "Four towers up". The objective bot builds four anyway, so results did
not move. No other optional objective is done before 1:00 (`m01` relay and `m02` Foundry are required objectives).

## Pins moved (declared)

| Pin | Old | New |
|---|---|---|
| `tests/wings.test.js` mission checksums | m01 d21a5cc5, m02 18aa4673, m03 088cf8e2, m04 fcb1de84, m05 0b2a52ee, m06 95b936e7, m07 093c6020, m09 590328c3, m10 a063d27e, m11 5e2127e3, m12 bc7f1bbe | 704a79da, bd4705a7, 74d794d9, 37f5e2f5, 7fb6c6de, 3fc2796d, 5150bb0e, 3f6f6e86, 981e1315, 81571e1d, ecf29c01 |
| `golden-story` m01 / m03 | 03e8cb2b / 59c479c0 | 64473474 / f86e00b1 |
| baselines `missions-story`, `missions-standard`, `missions-veteran`, `missions-standard-mercy`, `missions-standard-firm` | `r3-base` rows (left failing by Wave 1b) | re-recorded on this branch |
| skirmish pins | none moved (no AI change) | |

Unchanged: m02b, m08, m11c checksums, `d071360b`, every other golden (`test:golden-full` 93/93 incl. the new file),
`baselines` chronicles and defence identical.

## Tests

- `npm test`: 1033 tests, 1006 pass, 27 skipped, 0 fail (+6: `tests/golden-r3i.test.js`, about 5 s on a quiet machine).
- `npm run test:golden-full`: 93/93.
- `check:missions`: all five tables pass. `npm run baselines:diff -- --full`: all 8 baselines identical (the five missions tables as re-recorded here; chronicles, defence, bench-classic untouched).
- Browser suites on 4234 (`npx vite build`, preview, title checked, `TEST_URL`): `test:missions` PASS (desktop, portrait, landscape, 53 s), `test:tactics-ui` PASS (three viewports, 30 s), `test:story` PASS (55 s): the CI "story" and "story-audio" groups that `src/story/missions.js` reaches. No UI or CSS change, so no render-budget scenario of mine (no draw change).

## Test changes for the integrator

- `tests/story-scenes.test.js`: the m04 truce trigger's expected Sunward wave is `{ vanguard: 2, ranger: 2 }` (was 3 + 2), with a comment. Data test, not source text.
- `tools/mission-check.mjs`: `MISSION_TARGETS["m09-a-debt-in-the-dunes"] = { win: [390, 1200] }` (one entry with a comment).
- `tests/wings.test.js`, `tests/golden-story.test.js`: pins above, with a reason comment.

## Seam requests

- None needed to ship. For owner option (b) above: a default rally in front of the camp for the player's new fighters would sit in `src/sim/economy.js` `updateProduction` (R3-L's file).

## New files

- `tools/first-contact.mjs`: the first-contact table (docs/TESTING.md, "First contact").
- `tests/golden-r3i.test.js`: 6 tests (probes in data, unscaled and not "the first attack", no cost before 2:00, m03 towers, probe roads and lines, m04 120 s pin `ded7f19b`).
