# R3-B: Squad orders (results)

Branch `r3/b-squad-orders` from `r3-base`, worktree `C:\Users\n\source\repos\3d_astra-r3-b`, port 4233.
Plan: `docs/aaa/AAA_ROUND3_PLAN.md`, R3-B. The owner's ask: Medics and Engineers ran ahead of a mixed group and were hit first.

## What the player gets

- **Group pace.** A move or attack-move of 2 or more units (sent by `src/app/orders.js` only, with Settings > Army > Group pace on, the default) carries `pace: "group"`. `sim/orders.js issue()` then gives formation slots (`src/sim/formation.js`) instead of the 1.9 m grid: front units (HP 250 or more, or melee) in the first rows, toughest first; ranged units behind; support and unarmed units 3.5 m behind the last fighter row, in the gaps of that row. Within a row slots go left to right in the order units stand, so no paths cross. `traits.js moveSpeed` caps each unit at the slowest ground fighter's speed while it is within 12 m of the squad centre; a unit hit in the last 3 s or between shots, a flyer, or a unit farther than 12 m walks at its own speed. A support unit that would pass the rearmost fighter walks at half the group pace.
- **Step aside.** A support unit that starts ahead of the fighters and in a fighter's lane first takes a short sideways move (routes follow the 2 m grid rows, so a slower unit in the same row was pushed ahead by the tank behind it and held the tank up by 36%).
- **Support trails.** When a group-paced support unit finishes its move, it takes a `support` order on the nearest fighter of its squad it can tend (Engineer: vehicles; Medic: infantry). Set lazily in `finish()`, only for flagged orders.
- **Follow tether** (`src/follow-tether-view.js`, a view plugin): while a selected Medic, Engineer or wagon has a Support order, team-colour dashes on the ground run to its target and march toward it, with a heart (healers) or wrench (Engineer) pip over the target. 1 draw call for the dashes plus 1 per pip kind, built only on first use. WebGL lines are 1 px, so the dashes are instanced flat bars instead of copying the rally `Line`. The card says "Following <name>".
- **Phone control groups.** `#group-strip` moves to the top of the "…" sheet on phones: All army, Fighters, Support (support units and flyers) chips, "+ Group N" to save the selection into the next free number, then the saved groups (tap to recall, hold 500 ms to save over one). PC keeps the console tabs unchanged (no smart chips, same text format `3N`).
- **Settings:** "Group pace" switch in the Army tab (on by default, `groupPace` in `settings.js`).
- **High-ground hint:** the first building placed on a plateau (once per browser) shows "High ground: +2 m range, +20% damage" in the notice line.

## Acceptance numbers

Sim (`tests/squad-orders.test.js`, Basin, 2 tanks + Medic + Engineer side by side, enemy tower 46 m ahead, goal 28 m ahead; `.tmp` script for the extra rows):

| Case | Arrival | Support vs tanks (distance to enemy) | Min spread |
|---|---|---|---|
| A lone tank (slowest unit, solo time) | 11.15 s | | |
| No flag (today) | 11.25 s | support up to **11.95 m ahead** of the tanks | 1.43 radii |
| Group pace, side by side | **11.25 s (+0.9%)** | support always **behind**, by at least 1.87 m (from 1 s on; never ahead) | **2.03 radii** |
| No flag, support 3 m ahead | 11.20 s | up to 13.13 m ahead | 1.80 radii |
| Group pace, support 3 m ahead | **11.20 s (+0.4%)** | behind the tanks from 1.25 s on (step aside) | 2.01 radii |

Criteria: Medic farther from the enemy than the tanks throughout (yes, side-by-side start), spread at least 1.5 unit radii (2.03), arrival within 10% of the slowest unit's solo time (+0.9%).
On arrival the Engineer follows the nearest tank; with a Ranger in the group the Medic follows the Ranger. A save mid-march reloads into the same hash.

Browser (`tests/squad-orders.mjs`, matrix `r3-b`, port 4233, all three viewports PASS):
- the player's move carries `pace: "group"` for all 4 units; with the setting off, none;
- the Medic stays behind the rear tank by at least 2.29 m on the march (1440x900, 390x844, 844x390);
- tether visible, 1 wrench pip, no heart, card title "Following Battle tank"; gone when deselected;
- phones: every strip chip 44x44 px or more, text 11 px or more, inside the screen and not covered, no sideways scroll; Fighters, Support, "+ Group", hold-to-save and recall all work; each choice closes the sheet;
- dock heights: portrait 214 px, landscape 236 px, identical before, with a saved group and with the strip removed.

Battlefield share (`tests/phones.mjs`) is unchanged: portrait 70.1% / 60.8%, landscape 71.4% / 60.5% (nothing selected / one unit). A first version put the strip on the battlefield beside the touch row; it cost 2.0 to 3.4 points and failed the 70% / 60% floors, which is why the strip lives in the "…" sheet.

## Pins and baselines

- `npm test`: 961 tests before (935 pass, 26 skipped), **970 after (944 pass, 26 skipped, 0 fail)**: +9 tests in `tests/squad-orders.test.js`.
- Every golden pin, `d071360b` and the 14 mission checksums are unchanged (they run in `npm test`). No pin moved; none is declared.
- Why nothing can move: the flag is only written by `src/app/orders.js` (a test scans `src/` and `tools/` for it); without it `issue()` takes the old grid branch and `moveSpeed` returns `e.speed` as before (`e.orders?.[0]?.squad === undefined`). No sim field, no balance entry, no mission or definition field was added; the squad cache is a module `WeakMap` off the hashed state.
- `npm run baselines:diff -- --jobs 3` (fast set): `missions-standard` identical (418 s), `defence` identical (130 s). The `--full` set (five mission tables, Chronicles, the 120-match bench) was not run on the shared machine: no tool can send the flag (source scan test), so those tables cannot move; the integrator's full run confirms.
- Render budget `battle-eco`: green, 107 draw calls, 0 buffer uploads (the tether builds nothing until it is first shown).
- Browser suites green on 4233 after the final build: `squad-orders`, `phones`, `layout-f`, `ui-quality`, `hotkeys`, `status-layout`, `selection`, `mobile`, `mobile-controls`, `pc-controls`, `ui-extras`.

## Screenshots (`docs/aaa/results/round3/b/`)

- `group-march-desktop.png`, `group-march-portrait.png`, `group-march-landscape.png`: the group 4 s into the march, tanks in front, Medic and Engineer behind.
- `tether-desktop.png`, `tether-portrait.png`, `tether-landscape.png`: the Engineer's tether and wrench pip on the tank it follows.
- `phone-chips-portrait.png`, `phone-chips-landscape.png`: the "…" sheet with the smart chips, "+ Group 2" and group 1.

Regenerate: `SHOTS=1 TEST_URL=http://127.0.0.1:4233/ npm run test:squad-orders`.

## Files

Owned: `src/sim/orders.js` (`issue` lines, `finish`, new `squadFormation`, `squadSlot`, `squadFollow`; `enqueue` untouched), `src/sim/traits.js` (`moveSpeed`), new `src/sim/formation.js`, `src/app/orders.js`, `src/app/selection.js`, `src/selection-view.js` (one line in `updateRing`), `src/settings.js`, `src/settings-ui.js`, `src/mobile.css`, `src/landscape-hud.css` (group-strip rules at the end only), new `src/follow-tether-view.js`.
Append-only: `src/view-plugins.js`, `src/app/debug-hooks.js` (`commandAt` hook), `src/locales/vi.json`, `package.json` (`test:squad-orders`), `.github/workflows/pages.yml` (`r3-b`), `docs/CHANGELOG.md`, `docs/TESTING.md`.
Not touched although listed: `src/app/input-keyboard.js`, `src/desktop-dock.css` (PC strip unchanged).

## Seam requests and notes for the integrator

1. **`src/selection-status.js` (no Wave 1 owner):** two inserted lines so a unit on a Support order shows "Following <name>" instead of "support". If the integrator prefers, drop them; the tether still works.
2. **`tests/layout-f.mjs:51`:** the `.group-strip` exemption was removed as the plan asks (a one-line test change; the strip now meets 44 px).
3. **Existing bug, not mine (`src/ui-theme.css:484`):** in portrait the "…" sheet's "Clear selection" row is 20 px tall, because `.touch-controls #clear-selection { flex: 1 1 0 }` beats the sheet's `height: 44px` in the column. It is the same before and after this package. Fix: exclude the sheet, e.g. `.compact-ui:not(.in-briefing) #touch-sheet > #clear-selection { flex: none; }`.
4. Group pace also applies to the player's moves in campaign missions and Frontier Defence (player orders only, so no checksum moves). The smart chips are hidden in Frontier Defence.
