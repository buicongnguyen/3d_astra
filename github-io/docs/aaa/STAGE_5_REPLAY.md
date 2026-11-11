# Stage 5: reasons to return

Read [README.md](README.md) first. Needs stage 2 (factions). Goal: a player who has finished the campaign has things left to do. Everything here is local to the browser; there are no accounts or servers. Release as 0.20.0.

**Today:** skirmish has four speeds, seven maps, one to three enemies and two alliance modes; missions have medals and best times; `src/match-stats.js` collects per-match numbers for the results screen; the command log of a match can replay it exactly (`src/commands.js`, `src/snapshot.js`).

## Package 5.1: achievements

- New pure module `src/achievements.js`: a table of about 30 achievements `{ id, name, text, hidden?, check(context) }` and a store in localStorage (`frontier-achievements-v1`: `{ [id]: unlockedAtISO }`). `context` is built at match end from `sim`, `match-stats`, campaign progress and the match options; a few are checked live from simulation events (for example "Destroy a Command core with a Barrage").
- Spread: campaign progress (acts, all gold, all Veteran, both endings, each decision both ways), skill (win without losing a unit, win under 6 minutes on Normal, hold all capture points for 2 minutes), factions (beat each one, beat a mixed three), discovery (use every ability, reach rank 3, win in a storm), a few hidden ones tied to the story.
- Interface: a toast on unlock (never over the dock or minimap; queue, one at a time), a row in the results screen, and an "Achievements" dialog from the start screen with progress count and locked entries shown as text only (hidden ones as "?").
- No achievement may depend on wall-clock time or on anything outside the simulation and its stats.

**Tests.** Unit test every `check` with a minimal context, and the store (corrupt data, private mode). Browser: toast placement and the dialog at three viewports.

## Package 5.2: mission challenges

- Each mission gets up to three optional challenges beyond `timeUnder`, declared in mission data as optional objectives with new types (add to `src/sim/missions.js` and `docs/MISSIONS.md`):
  - `noLoss` `{ kind: "unit" | "building", max }`: at most `max` of the player's units or buildings lost.
  - `noBuild` `{ building }`: the player never finishes a building of that type (for example no towers).
  - `armyCap` `{ pop }`: the player's used population never exceeds `pop`.
  - `ability` `{ id, count }`: the ability is used at least `count` times.
- Challenges show in the objectives panel as optional, in the debrief, and as three small pips on the campaign map node. Completing all three on a mission is worth a cosmetic reward (package 5.4).
- Choose challenges that suit each mission's design (read its `design` string); the objective bot need not complete them, but each must be possible: state how in the challenge's `design` note.

**Tests.** Unit tests for each type including save and load mid-mission. `npm run check:missions` unaffected (challenges are optional).

## Package 5.3: skirmish options and the daily battle

- Skirmish setup gains, beside the enemy faction from package 2.6: **personality** (Faction default, Rush, Raider, Turtle, Evasive), **capture points** (off, on), **weather** (Clear, Changing, from package 3.3), **starting resources** (Low 300/100, Standard, High 900/400), and **map mirror** (flip the map through the origin so bases swap, a free variant).
- **Daily battle:** a button on the start screen. The date (UTC, `YYYY-MM-DD`) seeds a pure function that picks map, enemy count, factions, speed and options; the same day gives everyone the same battle. The client reads the date once when the menu opens and passes the resulting options to the simulation, so the simulation still never reads a clock. Local best time and medal per day are kept for the last 30 days (`frontier-daily-v1`).
- **Share a setup:** the skirmish options are encoded in the URL hash (`#s=<base64 json>`, validated against the allowed values on load; anything invalid is ignored). A "Copy link" button next to Start.
- The setup screen must stay inside the three viewports: group the options under a collapsed "More options" section on phones.

**Tests.** Unit: the daily picker is deterministic and only returns valid options; hash round trip and rejection of bad input. Browser: `tests/new-game.mjs` and `tests/layout-f.mjs` extended.

## Package 5.4: rewards and the replay viewer

**Rewards.** Cosmetic only, never power.
- Unlockable army colours (four new entries in `PRESETS`, `src/settings.js`), banner shapes for the player's emblem (`src/emblems.js`: three alternative Meridian glyph frames), and a title shown on the results screen. Unlocked by medals (all gold in an act), challenge sets, and achievement counts. Locked entries in settings show how to unlock them.

**Replay viewer.**
- At match end, keep `{ options, commandLog, version, hashEvery600Ticks }` in memory, and store the last three in localStorage if under 300 KB each (`frontier-replays-v1`). A replay made by another game version is listed but disabled.
- "Watch replay" on the results screen and in a "Replays" list: build a fresh `Simulation` with the same options, feed the command log by tick, and render with a spectator HUD: play and pause, speeds 1×, 2×, 4×, 8×, a timeline scrubber (seek forward by simulating; seek backward by restarting from tick 0 or the nearest stored snapshot taken every 60 s of replay), fog toggle (player's view or everything), and the resource and army numbers of all teams.
- While watching, the hash checkpoints are compared; a mismatch stops the replay with a clear message (it means the rules changed).
- No orders can be given in a replay; the command card is hidden.

**Tests.** Unit: record then replay gives the same final hash; a tampered log is detected. Browser (`tests/replay.mjs`, new): play 60 s with scripted commands, end the match, watch the replay, scrub, change speed; three viewports.

## Stage 5 exit check

- Everything works offline and in private mode (storage failures are silent).
- No new control is under 44 px on phones or text under 11 px.
- All storage keys are listed in `docs/ARCHITECTURE.md` with their shape and version rule.
