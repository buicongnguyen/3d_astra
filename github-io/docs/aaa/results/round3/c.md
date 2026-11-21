# R3-C: Army depth (results)

Branch `r3/c-army-depth` from `r3-base`, worktree `C:\Users\n\source\repos\3d_astra-r3-c`, port 4234.
Plan: `docs/aaa/AAA_ROUND3_PLAN.md`, R3-C, owner decisions O2, O3, O4.

## What the player gets

| Feature | Where | Gate |
|---|---|---|
| **Veteran intake.** Fighting recruits from a Barracks the player raised to level 3 arrive at rank 1 (+8% damage and health, 3 xp, the gold chevron). Medics and the Sunward wagon do not fight and arrive as they are. No research. | Skirmish | Expanded roster (`rules.roster === "expanded"`) and a lazy `b.veterans` flag set by the player's `upgrade` command (2 to 3) |
| **Combined squad.** After its branch a squad buys "Combined" for 320: the other branch is added (hp, damage, reload and anti-machine factors multiply, the best mending, leash back to the squad's own 9 m). Kept by a refit. Tanks carry the lazy `e.combined = true`. | Frontier Defence | A new command argument (`armourUpgrade` with `combined: true`), never sent by the Defence bot |
| **Army size.** Battle rules "Army size: 100 / 150 / 200". 100 is the default and stores no key. 200 is offered only when the device is not touch-first (`S.touchInput`); a 200 remembered from a desktop visit falls back to 150 on a touch device. | Skirmish | Rule `pop` (`sim.maxPop()`) |

Screenshots (`docs/aaa/results/round3/c/`):
- `veterans-desktop.png`: four recruits from a level-3 Barracks, each with the rank-1 chevron.
- `army-depth-rules-desktop.png`, `army-depth-rules-portrait.png`: the Army size row (three choices on the desktop, two on a phone).
- `army-depth-combined-{desktop,portrait,landscape}.png`: the squad sheet with the Combined tile (320).
- `army-depth-combined-done-{portrait,landscape}.png`: after the purchase, "Combined" with a check.
- `battle-200.png`: the render-budget scenario `battle-200` (200 units, desktop High).

## Decisions taken here (owner may change)

1. **The computer does not get veteran intake.** The plan's acceptance asks for every pin to stay identical, but the Expanded AI raises its Barracks to level 3 by about 10 minutes. With veterans for every side, the long pin `golden-expanded` "expanded meridian 600" moved (`ff066aef` became `2bbd6dc1`; measured, then reverted). The flag is therefore set only by a player's `upgrade` command, so AI-against-AI pins and benches are unchanged. To give the AI veterans too: drop `!!b.veterans &&` in `veteranIntake` (`src/sim/content/barracks-veterans.js`) and set the flag in the AI's level-up, then the integrator re-records that one pin.
2. **Which Barracks trained a unit.** Production does not pass the building to `onSpawn`, and `economy.js` is not R3-C's file. The hook checks whether the unit stands exactly on one of the exit-ring spots `exitPoint()` tries around each level-3 Barracks (same loop, same float steps). Two neighbouring Barracks of different levels are never confused (tested). If `exitPoint()` ever changes its ring, `tests/army-depth.test.js` fails at once.
3. **"Infantry"** means every fighting Barracks recruit: Vanguard, Ranger and Anti-tank plus the faction swaps (Scrapper, Rider, Shade, Watcher, and the Wardens' Drone, which takes the Ranger's slot). Medic and wagon excluded: they earn no ranks.
4. **Combined leash = 9** (O3): the Combined step sets the branch leash bonus to 0, so a squad that took Assault (13 m) comes down to 9 m, and a Bulwark squad stays at 9 m. The mending is the better of the two (Bulwark's 5%/s).
5. The two new Defence methods (`armourCombinedCost`, `armourCombine`) live in `src/sim/defence/armour.js` as the export `combinedSquads` and join the Simulation through R3-C's content module mixin, because `tests/mixins.test.js` pins the Defence mixin's 83 keys in order.

## Acceptance

| Criterion | Result |
|---|---|
| Veterans start at rank 1 under Expanded at Barracks level 3, not under Classic | Pass: `tests/army-depth.test.js` tests 1 to 3 (Ranger and Vanguard rank 1, xp 3, maxHp ×1.08 rounded; Medic none; Classic none; level 1 none; computer-levelled none; neighbouring level-1 Barracks none) |
| Combined: both effects, cost 320, not before a branch, bot never buys it | Pass: tests 4 to 6 (Assault then Combined: Assault's damage ×1.35, reload ×0.8, anti-machine ×1.3, and Bulwark's ×1.7 hp and 5% mending, leash 9, alloy −320; Bulwark then Combined likewise; refused before a branch, after Rank 2 alone and a second time; refit keeps it; `playDefence` on d-crossroads fields squads and none is Combined; `tools/defence-bot.mjs` never mentions it) |
| Pop: under cap 150 both the player and the AI stop at 150 | Pass: test 8 (player maximum 150, AI maximum between 147 and 150, enqueue refused at 150); test 9: at 100 supply the AI raises no relay under the default, at least one under 150 |
| Every pin, baseline and `check:defence` result identical | Pass: `npm test` all pins; `npm run test:golden-full` 87 of 87 (the 82 earlier ones unchanged plus 5 new); `npm run baselines:diff` identical, including `defence` (the `check:defence` table) |
| New vi strings | 7 added at the end of `messages` in `src/locales/vi.json` |
| +8 tests | +14 (961 → 975; pass 935 → 948; skipped 26 → 27, the new long pin) |

## Numbers

| Check | Before | After |
|---|---|---|
| `npm test` | 961 tests, 935 pass, 26 skipped, 0 fail | 975 tests, 948 pass, 27 skipped, 0 fail |
| `npm run test:golden-full` | 82 pass | 87 pass (5 new R3-C pins) |
| `npm run baselines:diff` (fast set: defence, missions-standard) | recorded | identical (missions-standard 167 s, defence 94 s) |
| `npm run baselines:diff -- --full` | recorded | 7 of 8 identical (story, standard, mercy, firm, chronicles, defence, bench-classic). `missions-veteran` reported m12 "did not finish" in 601 s of wall clock on the shared machine. Re-run alone (`mission-check --difficulty veteran --only m12-frontiers-end --timeout 1400`), it matches the baseline exactly: victory, 714 s, DDad, 54 lost, gold. This is the known m12 Veteran timeout, not a change in play |
| Browser suites on 4234 | | `army-depth`, `workshops`, `defence`, `defence-zones`, `defence-deck`, `ui-quality`: all PASS |
| `npm run test:army-depth` (3 viewports) | (new) | PASS, 13.3 s |
| render budget `battle-eco` | 107 draws | 107 draws (limit 120) |
| render budget `battle-200` (new) | | 248 draws (135 main, 113 shadow), 1.79 M triangles, 433 composes, CPU 3.7 ms median. Limits: 260 draws, 1.9 M triangles, 460 composes |

New tests: `tests/army-depth.test.js` (9 tests, about 4.5 s) and `tests/golden-r3c.test.js` (4 fast pins, about 3 s, plus one long pin under `GOLDEN_FULL=1`):

| Pin | Value |
|---|---|
| `r3c veterans 60`, `90` (Expanded sandbox, player orders the Barracks to level 3, veterans fight; a save at 40 s replays to the same hash) | `803cfa1c`, `feecd5f4` |
| `r3c combined 120` (d-crossroads: buy, Rank 2, Assault, Combined; the command log replays) | `3002bfed` |
| `r3c pop150 180` (Classic AI against AI under pop 150) | `04c72406` |
| `r3c pop200 60`, `150` (two AI armies at 190 supply each under pop 200; 150 s is long) | `ffd27339`, `8fd584f3` |

An AI-against-AI match never passes 100 supply on its own (probe: at most 52 on Highlands ×2 Relentless by 900 s), so the pop-200 pin starts from scripted armies near 200.

UI checks: the Army size row has 44 px taps, no text under 11 px and no sideways scroll at 1440×900, 390×844 and 844×390; the Combined tile is 44 px or more, its sub-line is "320" (3 characters), and the squad sheet keeps six tiles (the same count as the branch choice before it), so the phone dock does not grow.

## Seam requests

1. **R3-K (gold trim):** draw the Combined squad's gold trim from `e.combined === true` (set on each squad tank, kept by refits, saved). The `armourUpgrade` event carries `combined: true` for a one-off flourish.
2. **Production card note (`src/app/hud.js`, not R3-C's):** the plan says the Barracks card reads "Recruits arrive as veterans". The text helper is ready: `veteranNote(sim, b)` in `src/sim/content/barracks-veterans.js` returns "Recruits arrive as veterans" (level 3, or being raised to it by the player), "Level 3: recruits arrive as veterans" (lower level, Expanded) or "" (Classic, other buildings). Both strings are in `vi.json`. Proposed one-line change in `hud.js` `updateUI`, the `command-hint` assignment:
   ```js
   e?.kind === "building"
     ? veteranNote(S.sim, e)
   ```
   in place of `e?.kind === "building" ? ''`, with `import { veteranNote } from "../sim/content/barracks-veterans.js";`.
3. **Defence sheet key (`sheet()` in `src/app/defence/sheets.js`, R3-E's part):** the sheet key does not name Combined, so after a purchase R3-C's click handler clears the marker key to redraw the card. Cleaner, if R3-E agrees: add `${lead?.combined ? "+c" : ""}` after `${lead?.squadBranch || ""}` in the squad key in `sheet()` and the same in `armourSheet`'s `data-key`; the manual redraw in `input.js` can then go.
4. **Relay description** (`balance.json` relay, "Army capacity is capped at 100") and `field-guide.js` ("Supply is capped at 100") stay as they are (existing entries); they are true at the default. If the owner wants, the integrator can append "(150 or 200 with Army size)".

## Test changes for the integrator

None: no existing test was edited, and no source-text test broke.

## Files

- New: `src/sim/content/barracks-veterans.js`, `tests/army-depth.test.js`, `tests/golden-r3c.test.js`, `tests/army-depth.mjs`, this file and its screenshots.
- Owned edits: `src/simulation.js` (`maxPop()` and its use in `population()`), `src/sim/ai.js` line 74, `src/sim/defence/armour.js`, `src/defence/garrisons.json` (`armour.combined`), `src/commands.js` (`upgrade` and `armourUpgrade`), `src/app/defence/sheets.js` (`armourSheet`), `src/app/defence/input.js` (`armourAct`), `src/app/briefing.js` (rules row).
- Appends: `src/sim/content/index.js`, `src/app/rule-options.js`, `src/locales/vi.json`, `tests/render-budget.mjs`, `package.json` (`test:army-depth`), `.github/workflows/pages.yml` (`r3-c`), `docs/CHANGELOG.md`.
