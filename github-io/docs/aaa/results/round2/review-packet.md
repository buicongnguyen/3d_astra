# Owner review packet: AAA round 2, Waves 0 to 2

Index of the material to look at before deciding the owner questions (plan section 5). Paths are relative to this folder. Nothing here is deployed; the tree is `feat/aaa-round2`, tag `r2-wave-2`.

## 1. Screenshots

| What | Where | Viewports and modes |
|---|---|---|
| Title screen, before and after (wordmark, Baloo 2, three choice cards) | `w2c/before-title-*.png`, `w2c/after-title-*.png` | 1440x900 desktop, 390x844 portrait, 844x390 landscape |
| Battle and Defence with the warm grade and team rim, before and after | `w2c/before-battle-*`, `w2c/after-battle-*`, `w2c/before-defence-*`, `w2c/after-defence-*` | desktop (High), portrait and landscape (Eco) |
| The four map themes, before and after | `w2c/*-theme-{riverlands,highlands,dunes,basin}-{desktop,portrait}.png` | desktop High, portrait Eco |
| Night (m08) and storm (m10, m06 at 16:15), before and after | `w2c/*-m08-night-*`, `w2c/*-m10-storm-*`, `w2c/*-m06-storm-late-*` | desktop High and portrait Eco |
| Weapon looks contact sheet (16 looks, held clock), before and after | `w2e/weapons-before.png`, `w2e/weapons-after.png` | one camera (no Rampart: it was not in that tree) |
| Damage numbers and gold counter-hit flares | `w2e/battle-numbers-counter.png` | desktop |
| Rampart preview sheets (new model) | `w2a/rampart-game.png`, `w2a/rampart-hero.png` | game and hero views |
| Heroic tab: locked teaser, wave strip with elite chips, result badge | `w2b/defence-heroic-{locked,strip,result}-{desktop,portrait,landscape}.png` | 3 viewports |
| Title card, boss scale (3.0x a Battle tank), boss entrance with name card, campaign map with the m11c node | `w2f/{title-card,boss-scale,boss-entrance,campaign-map}-{desktop,portrait,landscape}.png` | 3 viewports |
| Wave 1 material (Gunner, Stalker, Sovereign, workshops, phones, Defence deck) | `w1a` to `w1f` folders | see `wave-1.md` |

3 viewports x 3 modes (battle, Defence, title) are covered by the `w2c` before and after sets. Night and storm shots exist on High (desktop) and Eco (portrait); the rim is on in both.

## 2. Not captured (gaps)

The plan asks for short captures of a Heroic all-elite finale with Stalkers, of the Outrider drill and of m11c's Gunners. No package produced a capture and the integrator has no capture tool, so these are not in the packet. Numbers stand in for them: Heroic finales are pinned by `tests/golden-w2b.test.js`, the drill duels by `tests/outrider.test.js` (`w2a.md`), the Gunners' pinned Scrappers by `tests/keystone-roads.test.js` (`w2f.md`). A 20 s capture of each is a round 3 first task if wanted.

## 3. Numbers to read with the pictures

See `wave-2.md` for every table (benches, CI timings, frame and think times). Per-package files: `w2a.md` to `w2f.md`.

## 4. Owner decision table (plan section 5, updated)

Defaults are what the tree builds today. "Learned" is what Waves 1 and 2 showed.

| # | Decision | Built default | Learned in Waves 1 and 2 | Recommendation |
|---|---|---|---|---|
| O1 | Default Roster for new skirmish setups | Classic | Expanded bench (120 matches): Meridian 54%, Ashfall 37.5%, Sunward 68.8%, Wardens 52%, Veil 37.5%. Ashfall is below its Classic 40% (Ashfall vs Sunward 1 of 12). Fielding: only 5 of 36 AI matches lasted over 8 minutes (the Classic AI ends them early); the Field plan raises it (8 of 12 reach 6+ combat types). | **Do not flip yet.** The flip condition (Ashfall at or above Classic) is not met. Decide after the Field command plan is the default or Ashfall gets one more economy pass. |
| O2 | Default AI plan | Classic | PlayBot wins 86% against Field at Normal (Classic AI: 90%), above the 35 to 75% band; Classic is already above it, so the plan did not make the AI stronger than the baseline it replaces. | **Keep Classic default.** The band is a Classic-AI problem; do not tune Field against it. |
| O3 | Fix the undefended-expansion exploit in the Classic AI | Classic unchanged | Field command defends every core and held ring (S2) and holds the line in the benches. | Yes, in round 3 with a re-recorded Classic bench. |
| O4 | Accept D1's measured Defence shift | Applied | `check:defence` rows unchanged through Wave 2. | Accept. |
| O5 | Heroic lives and alloy | 5 lives, fixed alloy | Bot wins 7 of 7 with at least 2 lives left; Gorge is tight (2 left, alloy 4,660); passive player loses at wave 1. | 5 lives. Gorge alloy is the number to look at if it feels brutal. |
| O6 | Names | Gunner team, Stalker, Rampart, Outrider drill, Field workshop, Iron Sovereign | Unchanged. | Keep. |
| O7 | Display font, wordmark and grade strength | Baloo 2 (headings, HUD, dialogs), +12% saturation | Font also reached HUD and dialogs (wider than the old stack); night outland terrain is not tinted. | Approve after the `w2c` set. Grade is one JSON (`look-grade.json`). Possibly narrow the font in the HUD. |
| O8 | Damage numbers default | Bosses and Defence | Settings has All, Bosses and Defence, Off. | Keep. |
| O9 | m11c status | Optional Act 3 mission | Meets 3/3/2 stars (targets 3/2/1); it never locks m12. | Optional (keep). |
| O10 | Signature abilities for the 7 units without one | Not built | Gunner, Stalker, Rampart each have exactly one. | Yes in round 3, Expanded first. |
| O11 | Zones and armour on the 6 older levels | Not built | Unchanged. | Round 3, opt-in variants. |
| O12 | Harder Veteran, Endless escalation, Daily modifiers | Not built | Heroic exists as the hard mode. | Veteran bounty x0.8 yes; Elite Endless as a new variant. |
| O13 | Heroes plan F1 to F8 | Not built | Unchanged. | Approve. |
| O14 | Area cover after the bunker veto | Not built | Unchanged. | No; concealment brush instead. |
| O15 | Edits to existing missions | Untouched | The 13 checksums held through Wave 2. | Round 5. |
| O16 | Facing armour on Tank and Walker | Rampart and bosses only | Rampart hit from behind dies 2.5x faster; flanking now pays. | Round 3 after an Expanded bench. |
| O17 | Release label | CHANGELOG consolidated, no number | Version is still 0.19.1 in `package.json`. | Label 0.25.0 at deploy. |
| O18 to O21 | Naval map, ending rule, War Council framing, mines | Not built | Unchanged. | As in the plan. |
| O22 | Gunner team counters | Class `siege` | Gunners are in the story (m11c) and pin Scrapper groups. | Keep. |
| O23 | Kiting on the Rider | Expanded only | Drill duels: Vanguard +0.27, Scrapper +0.36, Shade +0.31, Ranger 0.00; Sunward goes from weakest to strongest Expanded faction (68.8%). | Keep behind Expanded; Sunward may now be too strong there, check before O1. |

## 5. New questions from Wave 2

| # | Question | Detail | Recommendation |
|---|---|---|---|
| O24 | Ashfall in the Expanded roster | 37.5% against a 40% Classic target; the Rampart economy was bench-tuned and the remaining gap is the Sunward matchup. | Accept for now, or one retune pass in round 3. Not retuned in the integration. |
| O25 | Field command win rate and Expanded fielding | 86% PlayBot win rate vs Field; 8 of 12 Expanded matches reach 6+ combat types (target 10 of 12). | Record only. |
| O26 | Night terrain tint | The outland terrain beyond the map edge stays bright at night. | Round 3 follow-up. |
| O27 | Phone Defence unit size | 27.7 px (portrait) and 20.3 px (landscape) against the 28 px rule, from Wave 1. | Owner picks the Defence zoom or accepts. |
