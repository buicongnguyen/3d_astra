# AAA round 3, Wave 3 integration (tag `r3-wave-3`)

Integrator, port 4238 (4234 for side-by-side builds), worktree `3d_astra-r3` on `feat/aaa-round3`, base `f8ff598`
(`r3-wave-2-final`), 2026-11-22. Six branches, merged in the order the coordinator released them.

## Merge log

Each merge was `git merge --no-ff`. After each merge, every JSON file was parsed and scanned for duplicate keys
(only the old `"Next idle Harvester"` and `"Sector 07"` in `vi.json`, same values, from before round 3), and
`npx vite build` plus `npm test` ran.

| # | Branch (tip) | Merge commit | Conflicts | Resolution | `npm test` after |
|---|---|---|---|---|---|
| 1 | `r3/phone-hud` (8fac378) | 6290dd6 | none (the branch had merged `f8ff598`) | — | 1075, 0 fail |
| 2 | `r3/r-rank` (723c153) | 7d0da63 | none | — | 1081, 0 fail |
| 3 | `r3/u-audio` (70c52e5) | 5761cf1 | `pages.yml`, `CHANGELOG.md`, `package.json`, `vi.json`, `ko.json` | union, R then U; one comma each in `package.json`, `vi.json`, `ko.json` | 1086 (with 3e259ce), 0 fail |
| 4 | `r3/x-weapon-fx` (1c17a3c, with the shell pass) | da2833f | `CHANGELOG.md` | union | 1095, 0 fail |
| 5 | `r3/q-hooks` (cce0ca3) | 2a3ec24 | `pages.yml`, `CHANGELOG.md`, `package.json`, `debug-hooks.js`, `vi.json`, `ko.json`, `main.js` | union; `main.js` SETUP and BIND end `…, "defence", "rank", "quick-battle"`, so Quick battle (it wraps `createSim`, `newGame`, `defenceMission`, `defenceHud`) stays last | 1099, 0 fail |
| 6 | `r3/map-variety` (72abe8d) | 3ff2738 | none (the branch had merged `eb40f86`) | — | 1111, 0 fail |

CI matrix entries added by the merges: `r3-r` (rank), `r3-u` (audio-juice), `r3-q` (quick-battle,
quick-battle-check). R3-X, the phone HUD and the map variety add no browser suite (unit tests and
`tools/phone-hud-audit.mjs` only), so they need no entry.

## Seams and fixes

| Commit | Change |
|---|---|
| 3e259ce | **R3-U ↔ R3-X:** Shade's sound class is `beam`, like its look: `VOICE_CLASS.silenced` `tracer` → `beam` in `audio-logic.js` (Shade is the only `silenced` voice). Its landings now add the medium impact layer.<br>**R3-R ↔ R3-U:** a rank up plays the existing `promote` chime 1.6 s after the rank toast (`rank-ui.js` `matchEnded`, after the victory stinger), only while the results screen is still shown. |
| bb1dc5d | **`tests/language.mjs` at 844×390** (pre-existing at `r3-wave-2-final`). Cause: the label was not visibly cut. c09e9a6 made the landscape Campaign Full screen card icon-only by clipping its `<span>` to 1 px, and the suite (rightly) counts a clipped box with overflow as cut; it skips only `.visually-hidden`. Fix: the menu card `#fullscreen` now carries an `aria-hidden` shown label plus a `.visually-hidden` copy (`shell.js`, and `modals.js` when the label toggles to "Exit full screen"). Landscape Campaign hides only the shown label (`display: none`), so screen readers keep the name and nothing is clipped. The pause menu's text buttons keep their single label (`fullscreen.mjs` reads their text). language, fullscreen, layout-f and cover-ui pass. |
| eb40f86 | **R3-Q ↔ R3-U (optional):** First watch's Scout Runner sounds: caught → the `capture` chime, escaped → the `lost` tone (`soundFor` `runner`). Quick battle's scouts (`incoming`, `quick: true`) already sound the alarm. **R3-Q ↔ R3-R:** Quick battle wins already earn XP (it is a Skirmish; `recordMatch` counts every match end), so no change. |
| fe7bd13 | **`tests/terrain.mjs` "portrait: drawn on top (1.64)"**, see below. |
| 78e867d | **Twin Rivers bridges instanced**, see below. |
| e4f661b | **Korean font** re-cut once on the merged `ko.json`: `python tools/subset-korean-font.py NotoSansKR[wght].ttf`, source google/fonts `ofl/notosanskr` (Noto Sans KR 2.004, variable). 796 characters; `noto-sans-kr-chars.txt` is unchanged (R3-R's cut already covered U's and Q's strings). The tool's woff2 output is not byte-stable (two runs on the same input differ by a few bytes), so the binary is the one cut on the final tree, not one picked from a branch. `tests/i18n-ko.test.js` (every Hangul character covered) passes. |
| f94c774 | **Render budget lines for the phone HUD**, see below. |
| f204026 | **Map count in three browser suites** (`stages`, `new-game`, `boundary-fx` expected 7): R3 map variety updated the unit tests but not these. They now count `src/maps.json` (13). |
| 103207f | **Nothing drawn past the map edge** (`boundary-fx`, two real view bugs the new maps exposed):<br>• `view.reset()` now empties the entity batches. Switching the title map from Obsidian Highlands to Golden Heart left Highlands' HQ instances drawn at (-61, 60), outside the 128 m map, until the new match's first update (before the new maps, the next map was always as big, so it never showed).<br>• Plateau rock that runs to the map edge (Twin Rivers' two ridges, `z` 24 to 80) is clamped inside it; its face stood 0.84 m past the edge. |
| 0e465de | **Landscape boss bar under the phone HUD's top band** (`boss`): it sat at `top: 6px`, under the touch row that the HUD moved into the top band from 840 px wide, so it was invisible. It now starts at `--view-cover-top + 6px` (y 51 to 87 at 844×390), clear of the idle buttons and the side dock. |
| 061d127 | **320×568 title screen** (`mobile-controls`): the rank chip and Quick battle (128 px together) pushed Battlefield under the pinned Start. On portrait phones up to 600 px tall the hero keeps the brand only (its flavour line hides; Campaign is unchanged) and the rank chip, which is information rather than an action, moves to the end of the setup. Quick battle, the four modes, Battlefield and Start are on the first screen. **Owner check:** the rank chip is below the fold on these small phones only. |
| 4d848a5 | **`defence-zones` landscape road tap**: the spot it picked was 5 px below the Defence bar's Armour chip, which the phone HUD now places in the battlefield. A phone tap snaps to a button that close (touch adjustment), so the tap selected the Armour chip. The suite now picks spots 16 px clear of every control (it still checks that nothing covers the spot). |
| 7844906 | **`audio-juice` burst check** (CI-like only): the bark gate runs on the audio clock, and at 20× CPU twelve selections outlast its 0.25 s gap, so two chirps are correct. The test reads the clock: one chirp when the burst is quicker than the gap, one or two otherwise. The at-most-two-a-second check is unchanged. |

### Terrain suite: root cause

The Ranger was spawned straight below the Dunes plateau's centre, where the east ramp and the west ramp are
the same distance away, and the tap was aimed at the exact centre. The route therefore flipped on the last bits
of the picked point:

| Order target | Route | End |
|---|---|---|
| (-22.000000016, 4.0000004), the portrait tap since the phone HUD (taller canvas, different projection) | west ramp | (-32.2, 7.3) on the ramp's upper slope, height 1.64, order dropped after a 6 s stall |
| (-21.99, 4) or the desktop tap (-21.999999999, 4) | east ramp | (-21.1, 4.8), height 2.4 |
| (-22.01, 4) | west ramp | stalls as above |

The drawing itself was right (`y` equals the ground height in every case). The phone HUD did not cause a
gameplay change; it only moved the tapped point by 1e-8 m. The test now spawns the Ranger in front of the east
ramp, so the route no longer depends on float noise, and every check is kept (picking, the climb, drawn on top,
the ▲ marks, the card line, the reach rings). All three viewports pass.

Open sim item (not fixed here: any movement change would move pins): a unit that reaches a plateau ramp from its
side can stall on the ramp's side edge (`canTraverse` refuses the step, the slim route and the hops do not get it
round the corner) and drops the order after 6 s. Seen on both ramps (a spawn 3 m east of the centre stalls on the
east ramp at height 1.79).

### Twin Rivers bridges

Maps with several rivers draw their bridges as one `InstancedMesh` per bridge mesh, placed exactly like the clones
(the source's rotation at the crossing, scale 1). Maps with one river keep their clones, which Frontier Defence
hides when a bridge is blown (`EnvironmentView.bridges`). `twinrivers-high`: **237 → 207 draws** (main 132 → 117,
shadow 105 → 90), the same 447,840 triangles, no buffer uploads. Before/after screenshots of a bridge look
identical. No pin can move (view only).

### Render budget and the phone HUD

The first full render-budget run on the merged tree failed `three-rivals-eco`. Every scenario was then recorded on
`f8ff598` (base) and on `6290dd6` (base + phone HUD only), both built from `git archive` and served on 4234:

- Desktop scenes are identical.
- Mobile scenes gain draws because the phone canvas now runs under the top bar and the dock: +4 in most
  (battle-eco 107 → 111, air-battle-eco 117 → 121, groups-battle-eco 108 → 112, battle-expanded-full-eco 149 → 153),
  +14 with three rivals (146 → 160, triangles 303,222 → 324,494) and +16 with three factions (182 → 198).
- The HUD results file said "draw calls unchanged" but the render budget was not run there.

Six lines were over: they are now measured + 3 (`three-rivals-eco` 163, `three-factions-eco` 201,
`air-battle-eco` 124, `battle-expanded-full-eco` 156, `groups-battle-eco` 115, `weapons-mix-eco` 135), and
`three-rivals-eco`'s triangle line is 330,000. **Owner decision:** keep this (more battlefield on phones, the HUD
pass's point), or crop the frustum under the opaque part of the dock to win back roughly 4 to 16 draws on phones.

## Tests on the final tree

| Check | Result |
|---|---|
| `npx vite build` (output visible) | clean; index JS 1,016 KB / 340 KB gzip (the usual chunk-size note only) |
| `npm test` | **1111 tests: 1083 pass, 28 skipped, 0 fail**. That is 1075 at `r3-wave-2-final`, plus R 6, U 5, X 9, Q 4 and map variety 12. |
| `npm run test:golden-full` | **99 / 99** |
| `npm run check:defence` | PASS (every level meets its star target, endless at the cap) |
| `baselines:diff --full` | **all 8 identical** (five mission tables, Chronicles, Defence, bench-classic); nothing re-recorded |
| Render budget (RTX 4080 SUPER, all 32 scenarios) | PASS with the six HUD lines above. Desktop: base-high 140, river-overview-high 169, large-map-high 218, twinrivers-high 207. Mobile: battle-eco 111, three-rivals-eco 160, three-factions-eco 198, wide-battle-eco 149, groups-battle-eco 112, combined-defence-eco 95, weapons-mix-eco 132, battle-200 247. |
| `test:ci-local --fast` (full matrix, 2 lanes, port 4238) | **74 / 75**; the one failure, defence-zones, is fixed in 4d848a5 and passes (twice at full speed, once CI-like) |
| `test:ci-local` CI-like (20× CPU, software GL, 2 lanes) | see below |

### test:ci-local, CI-like (CI_LOCAL_PORT 4238, CI_LOCAL_LANES 2, 20× CPU)

The machine was quiet (CPU load about 2 to 30 %), so the real 20× run was used, not `--fast`.

- **Run 1** (HEAD f94c774, unit tests included: 1111, 0 fail). It finished 69 of 75 suites before the 3-hour cap.
  - Passed: 57 suites.
  - Real failures, all fixed afterwards:
    - stages, new-game and boundary-fx (map count, then the two edge bugs);
    - mobile-controls (320×568 title);
    - boss (landscape bar);
  - Page-load or step timeouts that pass in run 2: settings/improvements, settings/campaign, scenes/story, r3-k/readability and r3-m/cover-ui.
- **Run 2** (HEAD 4d848a5, `--no-unit`). It re-ran the groups that failed or had not been reached: settings, scenes, maps, mobile, bosses, defence, r3-g, r3-h, r3-k, r3-m, r3-q, r3-r, r3-u and r3-v.
  - **20 / 25 passed.**
  - audio-juice: fixed in 7844906; it now passes CI-like.
  - defence-zones: a tap timeout in the lane run. Run alone, CI-like, it passes (379 s).
  - **openings, ceremony and sovereign-walks fail the same way CI-like on `r3-wave-2-final` (f8ff598)**, built and run from that commit's own tree:
    - openings: "the match clock waits" (0.1 s);
    - ceremony: the "slow" phase is missed by the 40 ms poll;
    - sovereign-walks: a 30 s step timeout.
  - So these three come from Wave 2, not Wave 3. Every Wave 3 change is view or UI code and moves no clock. They pass at full speed. Owners G, V and H should make these checks tolerant of slow machines (a follow-up).

All 75 suites pass at full speed. Under CI-like load, every suite passes or fails exactly as it did at `r3-wave-2-final`.

## Pins

- **Unchanged:** the idle fingerprint `d071360b`, the 14 mission checksums, every `tests/golden-*.test.js` pin and
  all 8 baselines (`baselines:diff --full`: identical). No Wave 3 package declared a pin move.
- **New pins:** `golden-r3q` (Quick battle `{20: f4a9bba2, 60: 6b227e40}`, First watch `{60: ceb63cce}`); the map
  variety's `maps-variety.test.js` (old-map fingerprints, determinism, symmetry).
- **New maps and baselines:** the six maps are Skirmish maps; the baseline tables (missions, Chronicles, Defence,
  bench-classic) do not include Skirmish maps, so they add no rows.

## Notes

- **Flaky wall-clock check:** `binary-heap pathfinding … quickly` (Highlands) failed once in R3 map variety's run
  while benches loaded the machine and passes alone. It did not fail in any run here. Left unchanged.
- The `r3/map-variety` engine fields are opt-in per map; the seven old maps keep their fingerprints.

## Open items

1. Owner: the phone HUD's render-budget cost (above).
2. Sim: ramp side-approach stall (above). Fixing it moves pins, so it needs its own package.
3. CI-like (20× CPU) timing in three Wave 2 suites: openings (the match clock reads 0.1), ceremony (a 40 ms poll misses the slow phase) and sovereign-walks (a 30 s step timeout). They fail the same way on `r3-wave-2-final` and pass at full speed.
4. From Wave 2, still open: a darker palette for `ironsovereign2`; G's story-scene strip under the dock on phones;
   fold `SOVEREIGN_SCENES` into `SCENES`; the two old `vi.json` duplicates.
