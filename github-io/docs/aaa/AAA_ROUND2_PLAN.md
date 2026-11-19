# Frontier Command: AAA round 2 plan (refined)

Branch `feat/aaa-round2` (base `13b327c`), integration worktree `C:\Users\n\source\repos\3d_astra-zones`, game in `github-io/`. Paths below are relative to `github-io/` unless they start with a drive letter. `.github/workflows/pages.yml` sits at the repo root, one level up.

Input: `docs/aaa/AAA_ROUND2_EVALUATION.md` (score 5.4/10, ideas U, M, C, D, S, P, K). Read the section of each idea your package carries before you start.

This plan merges three candidate plans ("player", "engineering", "owner") and three reviews. The "player" plan is the base. The safety machinery comes from "engineering". The practical CI and harness fixes come from "owner". Every code fact below was checked in the tree at `13b327c` (file and line are given where it matters).

Nothing in this round is deployed. The owner says "deploy" later.

The integrator commits this plan to `feat/aaa-round2` before Wave 0, so every worktree carries it. If yours does not, read it from `C:\Users\n\source\repos\3d_astra-zones\github-io\docs\aaa\AAA_ROUND2_PLAN.md`.

---

## 1. Goals and expected scores

### 1.1 Goals

1. **Fix what is broken first.** The promotion bug (D1, `src/sim/tactics.js:42`) strips health from the Defence commander and the armour squads. Fix it in Wave 0 and measure the effect.
2. **A safety net before content.** Golden gameplay pins (K1) over AI-against-AI play, Defence and story bots, plus stored baselines of every bot table. After that, nothing can move existing play unnoticed.
3. **Seams, then fan-out.** Wave 0 adds small, guarded hook points to the hot files. Wave 1 and Wave 2 packages then add content in their own new files and only append to registries. That is what lets 6 agents work at once.
4. **New ways to fight that you can see.**
   - Three workshop units, each a new style: the Meridian **Gunner team** (suppression, holds a line against rushes), the Veil **Stalker** (cloaked sniper that hunts support), the Ashfall **Rampart** (ram tank with facing armour, so flanking pays).
   - A fourth faction style without a new model: the Sunward **Outrider drill** (U8 slice 1), Riders that step back from melee and flame and keep shooting.
   - Workshop hosts for all five factions (three with their first unit this round), behind a new skirmish rule "Roster: Classic / Expanded". The Wardens get no new unit on purpose: they are the strongest faction (71% in the Classic bench), so their unit waits for the Expanded bench (round 3, U4 rule).
   - An opt-in AI plan, "Field command", that fields Tanks, Walkers, flyers and the workshop units and uses abilities with intent.
   - Outside skirmish: Veil Stalkers march in the Heroic challenges of the Veil levels, and m11c lends the player two Gunner teams, so the new units are seen without the Expanded rule.
   - Boss engine II with the first ported Tank_game_3D road boss, the Iron Sovereign (engine, model and sandbox this round; its Heroic finale, the Atlas Launcher and HP sizing are round 3's first slice, see section 6).
   - About 17 distinct weapon looks instead of 6, and counter hits you can read.
5. **Frontier Defence gets peaks and polish.** Fast-forward, tower targeting, trait chips, a new-enemy card, phone stats as text, then 7 Heroic challenges with gold elites and all-elite finales. Stars rise from 21 to 28.
6. **The campaign is staged and grows.** Mission title cards, real boss presence in m03, night in m08 "night 38", a storm in m10 "Obsidian Storm", and a new optional Act 3 mission, m11c "Hold the Keystone Roads", which brings the commander, zones, armour and the first Gunner teams into the story.
7. **Phones first-class.** At least 70% of the screen is battlefield in portrait and landscape (today 50% and 53%). Armies stay readable at strategic zoom. Every new screen passes 11 px text and 44 px taps.
8. **AAA first impression.** A wordmark and a self-hosted display font with Vietnamese glyphs, a warm colour grade, a team rim light on every render tier (phones included) and a lighter fog: the owner's vivid "Mario Kart 8" bar.
9. **Leave the code healthier.** A clean-up wave splits `sim/defence.js` and `app/defence-ui.js`, adds a spatial grid and a shared rng, flattens AI spikes, converts source-text tests and refreshes the docs. All behaviour-neutral.
10. **Existing balance stays put.** `d071360b`, the 13 mission checksums, `check:missions`, `check:defence` and the Classic faction bench do not move, except D1's measured, approved shift. Everything that would change today's skirmish or campaign play goes to the owner-decision list (section 5).

### 1.2 Expected scores after the round

Scores assume the owner flips the Roster and AI-plan defaults at deploy (decisions O1 and O2). The number in brackets is the score if both stay Classic.

| Area | Now | After | Why |
|---|---:|---:|---|
| Campaign | 5.5 | 6.0 | m11c Keystone Roads breaks Act 3's run of base missions, brings the Defence package into the story and lends the first Gunner teams. Title cards on all 27 missions, boss presence in m03, night and storm looks. Heroes, new bosses in missions and side operations are round 3, built on this round's toolbox. |
| Story | 6.5 | 6.8 | "Night 38" is finally night and "Obsidian Storm" has a storm. Acts, days and places are on screen. The boss is introduced by name. m11c has story beats. |
| Battle gameplay | 5.5 | 6.3 | Suppression and Pinned, facing armour, target preference, kiting drill, elites, tower targeting. Stun, multi-zone and road-walking bosses are built and tested, and reach players with round 3's boss finales. |
| Unit variety and styles | 4.0 | 5.5 (5.1) | 3 workshop units and the Outrider drill (4 new rules for 4 factions), workshop hosts for 5 factions, 6 elite affixes, Stalker columns in Heroic and Gunners in m11c by default, an AI that fields 6+ types, about 17 weapon looks. |
| Frontier Defence | 6.0 | 6.9 | D1 fix, ×2/×3 speed, targeting, chips, new-enemy card, phone stats and framing, 7 Heroic challenges with elite finales, +7 stars. Road-boss finales are round 3. |
| Skirmish, AI and maps | 4.5 | 5.3 (4.8) | Field command AI (spends energy, defends expansions, casts with sense), Expanded roster. The map engine is round 3; maps and win modes round 4. |
| Presentation and feel | 5.0 | 6.5 | Phone battlefield 70%+, readable armies, title and brand, grade and rim on every tier, night and storm, weapon looks, counter hits, boss presence, title cards. |
| Code health | 6.5 | 7.3 | K1 pins and baselines, content and view seams, split Defence files, spatial grid, shared rng, flatter AI ticks, converted tests, fresh docs. |
| **Overall** | **5.4** | **≈6.3 (6.1)** | |

---

## 2. Rules for every package

Every package brief in section 3 assumes these rules. Read this section fully before starting.

### 2.1 Worktree, branch and node_modules

- Create your worktree from the wave's base:
  - Wave 0: `feat/aaa-round2`.
  - Later waves: the tag of the previous wave, `r2-wave-0`, `r2-wave-1` or `r2-wave-2`.
- Command (Git Bash), with `<id>` such as `w1b` and `<slug>` such as `gunner`:
  ```
  git -c safe.directory='*' -C C:/Users/n/source/repos/3d_astra-zones worktree add C:/Users/n/source/repos/3d_astra-r2-<id> -b r2/<id>-<slug> <base>
  cd C:/Users/n/source/repos/3d_astra-r2-<id>/github-io && npm ci
  ```
- Run `npm ci` in your own worktree. Do not junction `node_modules` from another folder: a shared `.vite` cache breaks other previews, and removing a worktree can delete shared files.
- Do not remove any worktree, yours included. The integrator removes yours after the merge.
- Never touch another package's worktree.

### 2.2 Git

- Always call git as `git -c safe.directory='*' ...`.
- Stage files explicitly by path. Never `git add -A`, `git add .` or `git commit -a`. Never commit `test-results/`, `share-images/` or `.tmp/`.
- **Never `git stash`.** The stash list is shared by every worktree of this repo.
- Commit only on your own branch `r2/<id>-<slug>`. No push. No merge to `main`. No deploy.
- End every commit message with this trailer line:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- Small, reviewable commits. A determinism-sensitive change gets its own commit (for example "seams" then "D1").

### 2.3 Temp files, processes and machine load

- Scratch scripts, probes, logs and screenshots go only in `github-io/.tmp/` (git-ignored) of your own worktree. Delete your own scratch files before you hand off. Screenshots the owner should see go in your results file folder (section 2.9).
- Six agents share one machine:
  - `check:missions`: use `--jobs 3` and `--only <ids>` for what you touched. Run one difficulty at a time (the tool kills runs after 4 minutes; Veteran m12 times out today, as before).
  - Benches: at most `--jobs 3`. Full 120-match round robins are run only by W2-A, W2-D and the integrator. Other packages run the sample size their brief gives.
  - `test:ci-local`: at most 2 lanes (`CI_LOCAL_LANES=2`).
- **Timing gates** (W0-B tick time, W2-D think p99, W2-E fx update, CW-C tick p95, CW-D think p99) are noisy with six agents on one machine. Measure them only as an interleaved A/B in one process: `node tools/perf-ab.mjs --a <base src> --b <your src> --scene <name> --runs 7` (W0-B writes it; base and head alternate, the median of 7 is reported). Your number is indicative. The pass or fail is the integrator's re-run of the same command on a quiet machine (no agent running) during the integration step. Browser-side timings (W2-E) use the median of 5 held-clock render-budget runs, also re-measured by the integrator.
- Every wait or poll has a timeout. No endless `until` loops.
- Stop servers by their exact PID (`kill <pid>`, or `taskkill //PID <pid> //T //F` on Windows). Never kill by process name: other sessions run vite and serve on this machine.
- Four-correction limit: if the same failure survives 4 fix attempts, stop and report it in your results file.

### 2.4 Ports and browser tests

| Package letter | Port |
|---|---|
| A | 4232 |
| B | 4233 |
| C | 4234 |
| D | 4235 |
| E | 4236 |
| F | 4237 |
| Integrator | 4238 |

- Never use 4173, 4191, 4197, 4231, 4239, 5178 or 5198.
- Serve a build, never a dev server:
  ```
  npx vite build
  npx vite preview --host 127.0.0.1 --strictPort --port <port> &   # note the PID
  curl -s http://127.0.0.1:<port>/ | grep -o '<title>[^<]*'          # must read "Frontier Command — Outpost Meridian"
  TEST_URL=http://127.0.0.1:<port>/ npm run test:<suite>
  ```
- `tests/render-budget.mjs` defaults to port 4193: always pass `TEST_URL`. Run only your scenarios plus `battle-eco` with `RENDER_ONLY=<names>`.
- `tests/ci-local.mjs` defaults to port 4231, which is taken: always set `CI_LOCAL_PORT=<your port>` and `CI_LOCAL_LANES=2`. It starts its own preview, so stop yours first.

### 2.5 Determinism

- `d071360b`, the 13 mission checksums (`tests/wings.test.js`) and, from Wave 0 on, every `tests/golden-*.test.js` pin must hold. Only the integrator re-records a pin, and only with a reason a package declared.
- **New state only when content uses it.**
  - A new field on a new unit definition is free: entities are stored as differences from their definition (`src/snapshot.js` `slim`).
  - A new field on the Simulation or on an existing entity changes the hash. Create it lazily, only when new content runs.
  - Caches stay off the hashed state: a module-level `WeakMap`, or the `DERIVED` set in `src/snapshot.js`.
  - Fields on events are free: `events` and `tickEvents` are in `DERIVED` (`snapshot.js:9`).
- **Never add a field to an existing mission, Chronicle or Defence level definition.** `serialize()` writes the whole `missionDef` into `options.mission` (`snapshot.js:59`), so a new field on d-crossroads (or m08, or ca1) moves that content's checksum and every pin that plays it. Data about existing content (names of zones, looks, intro labels) lives in a separate table keyed by its id, in its own export or file. New content (Heroic variants, m11c) may carry any field.
- Every seam is guarded by a field or a registry that no existing content has. Put a new factor last in its product: multiplying by exactly 1 leaves IEEE results unchanged. Registered modules exist in every match once merged, so every hook must itself be a no-op (no state, factor exactly 1) unless its own content or rule is present.
- Seam ids in this plan are **H1 to H20** (W0-B), so they never clash with the evaluation's skirmish ideas S1 to S19.
- No `Math.random` in sim code. Deterministic order everywhere (entity order, then id).
- Before your first edit, record your own "before" numbers (the golden pins, plus any check your brief lists). Compare after every commit.

### 2.6 Balance and AI

- Do not edit existing entries of `src/balance.json`, the waves of the 7 designed Defence levels, the 15 story missions, the Chronicles, or the Classic AI's behaviour.
- New units and the new AI live behind skirmish rules (`rules.roster === "expanded"`, `rules.aiPlan === "field"`), in new Defence variants, or in new missions.
- AI changes are gated by `!this.mission` as well as their rule, so the campaign never changes.
- `check:missions` and `check:defence` must still meet every target. If a target fails because of your change, do not retune existing content: report it.
- **Units added in an earlier wave of this round** (`workshop`, `gunner`, `stalker` after Wave 1) count as existing for everyone except W2-A. W2-A may change only their economy fields (`cost`, `time`, `pop`, `required_level`, `ai`) to keep the Expanded bench in its band, and must list every change with its bench reason. Their combat fields (HP, shield, damage, interval, range, `suppress`, `prefers`, abilities) are frozen after Wave 1, because W2-B's Heroic waves and the sandbox pins use them.
- **Equal-cost duel gates** use `tests/lib/duel.mjs` (W0-A): 5 spawn offsets × both spawn sides = 10 battles, each scored like `tests/balance.test.js` (share of value kept, first side minus second). A gate states the mean of the 10 and how many of the 10 are won. Never gate on a single layout: single layouts flip with the spawn side.

### 2.7 Owner rules (checklist)

- **Low micro.** Every new ability autocasts. Reward control, never require it.
- **One ability per unit.** No second ability on a unit that already has one. Passive traits (suppression, facing, target preference) are not abilities.
- **No bunkers, no barricades.**
- **Phones.** Check 1440×900, 390×844 and 844×390. Text at least 11 px, taps at least 44×44 px, no sideways scroll. Keep command-tile sub-lines to 10 characters or fewer. Fixed phone dock heights must not grow (`tests/ui-quality.mjs` checks this).
- **Fonts.** No `system-ui` in any font stack (CI Linux falls back to wider DejaVu Sans). Check tight layouts with an Arial-first build. Font files live under `src/fonts/` and are imported from CSS (`@font-face` with a relative `url()`), so vite hashes them and the service-worker precache, which is built from vite's output (`vite.config.js:16`), carries them offline. Never put fonts in `public/`.
- **Draw budget.** Phone scenarios stay within about 100 to 150 draw calls. Each new scenario has its own limit (section 2.8).
- **Strings.** Every new UI string goes in `src/locales/vi.json` (`messages` map is case-insensitive; `patterns` are regexes). Story text goes in `src/locales/story-vi.json`. Write regex patterns with the Edit tool, not shell heredocs (they lose doubled backslashes). The Godot twin is frozen (owner, 2026-11-10): do not sync it.
- **Art.**
  - New models come from a new `tools/blender/generate_<name>.py` built on `tools/blender/frontier_kit.py`: stylised low-poly, flat colour, vivid and warm, grey `COLOR_0`, `Team` materials, single-sided, the attribute set `POSITION`, `NORMAL`, `TEXCOORD_0`, `COLOR_0`.
  - Run headless with the portable Blender: `C:\Users\n\source\repos\3D_claudeopus55\.tools\blender-4.5.9-windows-x64\blender.exe --background --python tools/blender/generate_<name>.py -- <args>`.
  - Budgets (`docs/ASSET_PIPELINE.md`): infantry 2.8k to 3.2k triangles, Breaker 4.5k, Battle tank 6.3k, structures 2.1k to 4.7k. No more materials than the nearest existing unit (Ranger for infantry, Battle tank for vehicles).
  - Every definition in `balance.json` needs `public/models/<type>.glb` that passes the runtime contract in `tests/assets.test.js`.
  - Every Expanded-only definition (the workshop units and the Field workshop building) carries `"roster": "expanded"`. `tests/progression.test.js` (rewritten by W0-B) counts only definitions without it (21 units, 9 buildings), so new units never touch its count lines. Its shield rule becomes `d.shield > 0 || type === "scrapper" || d.workshop === "ashfall"` (Ashfall's style allows a shield-less unit, the Rampart).
  - A unit with an ability needs the Vietnamese of its 4 hint forms (`tests/abilities.test.js` checks every unit ability), plus `name` and `description` (`tests/i18n.test.js`).
  - A new manifest entry carries `name`, `file`, `triangles`, `budget` and `review: "pending owner review (round 2)"`. Do **not** set `faction` or `air` on it: `tests/assets.test.js` counts those exactly.
  - Bosses are ported with `tools/port-boss-model.mjs` from `C:\Users\n\source\repos\Tank_game_3D\public\models\`.
  - Render a preview sheet of every new model into your results folder.

### 2.8 Shared files

**Append-only files.** Add new entries at the end of their section, keep your block contiguous, never edit or reorder existing entries. The integrator keeps both sides on a conflict.

| File | What you may append |
|---|---|
| `src/balance.json` | New `definitions`, new `bosses` entries, new top-level keys at the end (W2-A alone may also edit the economy fields of the Wave-1 unit blocks, section 2.6) |
| `src/locales/vi.json`, `src/locales/story-vi.json` | New entries |
| `public/models/manifest.json` | New `assets` entries |
| `package.json` | New `scripts` entries only |
| `.github/workflows/pages.yml` (repo root) | A new matrix entry at the end of `include` (name it after your package, for example `r2-w1d`; its `scripts` run as `npm run test:<script>`). `tests/ci-matrix.test.js` fails if a new browser suite is left out. |
| `tests/render-budget.mjs` | New scenario lines at the end of `scenarios`; limits as a **new line** `Object.assign(limits, { "<name>": <n> });` directly after `const limits = {...}`. Never edit the `limits` line itself (it is one line, line 55). |
| `docs/CHANGELOG.md` | Your own `### <id>: <title>` under the `## Unreleased: AAA round 2` heading (W0-A creates it at the top; W0-B, which works in parallel, creates the same heading line and the integrator keeps one) |
| `docs/MISSIONS.md`, `docs/BALANCE.md`, `docs/TESTING.md` | Your own `##` section at the end |
| `src/visual-style.json` | In Wave 1 only: new keys at the end of `weapons` (W2-E owns the whole file in Wave 2) |
| Registries created in this round | `src/sim/content/index.js`, `src/view-plugins.js` (Wave 0), `src/app/rule-options.js`, `src/defence/traits.js` (Wave 1): new entries at the end |

**Everything else** a package touches is in its "Files owned" list and is exclusive for that wave. If you need a file you do not own, do not edit it. Write a **seam request** in your results file (what you need, where, why) and ship without that part.

**Source-text tests.** About 25 test files read source files as text (for example `tests/story-scenes.test.js`, `tests/player-faction.test.js`, `tests/choices.test.js`). Insert seams as new lines and do not reformat existing code, so their regexes keep matching. If a source-text test you do not own breaks because of your edit, do not edit it: write the exact change in your results file. The integrator applies it at merge.

### 2.9 Tests, pins and deliverables

Every package runs, before hand-off:

1. `npm test` (about 609 tests, about 50 s; it includes `d071360b` and the golden pins).
2. `npm run baselines:diff` (from W0-A). Identical, unless your brief declares a moved baseline with its reason. Wave 0 packages do not have it yet: they compare their own before and after records in `.tmp/`.
3. `npm run check:missions` for the missions your brief names (packages that touch sim, gating or AI).
4. `npm run check:defence` (Defence packages; it takes about 100 s today).
5. Your render-budget scenarios plus `battle-eco`.
6. Your own browser suites and the CI groups your files affect, on your port.

Every content package delivers:

- **Its own pin file** `tests/golden-<id>.test.js` (new) with hashes of its new content. Later waves then protect it, so the pin must not depend on content a later package adds:
  - Unit packages of Wave 1 cannot train their units in their own worktree (W1-A, the roster, is parallel), so they pin a **scripted sandbox** (`ai: false`, spawned units, a fixed fight, hashes at 30 and 60 s).
  - A pin that plays an AI under Expanded uses a **faction-isolated** setup, where no later package adds content for those factions (section W1-A and "Integration after Wave 1").
  - Long points (300 s and more) sit behind `GOLDEN_FULL=1` (section 2.10).
- **A results file** `docs/aaa/results/round2/<id>.md` (new) with every acceptance number before and after, bench tables, seam requests, test changes for the integrator, and links to screenshots in `docs/aaa/results/round2/<id>/`.
- **Its CHANGELOG subsection** and any doc section its brief names.
- A test count that grows by at least the number its brief gives.

### 2.10 CI time budget

The CI build job has a 10-minute cap (`pages.yml` line 18) and runs `npm ci`, `npm test`, `npm run check:defence` and `npm run build`. The cap applies to the GitHub runner, which is slower than this machine (plan for 2 vCPU). Nobody triggers the workflow this round: it runs only on a push to `main` or a manual dispatch, and either one runs the `deploy` job.

| Item | Today | Rule for this round |
|---|---|---|
| `npm test` | about 50 s | The golden pins are split into 3 files so they run in parallel. Each package adds at most 10 s of unit tests. Only the fast pin points (60 and 180 s, short Defence and story runs) run in `npm test`. |
| Long pins | none | 300 s points, save-reload runs, Endless to wave 12, the Expanded and Field command AI runs and `golden-round2` run only with `GOLDEN_FULL=1`: script `test:golden-full` (W0-A) in a new browser-job matrix entry `golden-full` (30-minute cap, off the build job). |
| `check:defence` | about 100 s | Unchanged in the build job. W2-B's Heroic rows run behind `--heroic` in script `test:defence-heroic-check` and a matrix entry `r2-w2b`, not in the build job. |
| Build job total | well under 10 min | Must stay at **7 minutes or less measured on 2 cores** (Windows: `cmd //c "start /affinity 0x3 /wait /b npm run ci:build-job"`, script from W0-A that runs test, check:defence and build). The integrator measures it after each wave. |
| Browser groups | 23 groups, 30-minute cap each | New suites go in new matrix entries. The integrator may fold small entries into existing groups after a wave. Any group over 20 minutes (on 2 cores) is split. |

### 2.11 Definition of done

A package is done when all of these hold:

- `npm test` green, with the test-count increase from its brief.
- Its own browser suites green on its port, plus the CI groups it affects.
- `baselines:diff` identical (or only the declared change).
- Render budget green for its scenarios and `battle-eco`.
- Every acceptance criterion in its brief met and written down with numbers.
- Its results file, CHANGELOG subsection and golden pin file are committed.
- Scratch files removed and servers stopped.

---

## 3. The waves

| Wave | Packages | What the player gets |
|---|---|---|
| **0** (foundation, merged first) | W0-A safety net and client seams; W0-B sim seams and D1 | The commander and armour squads keep their health on promotion. Everything else is plumbing. |
| **1** | W1-A Roster and workshops; W1-B Gunner team; W1-C Stalker and ability-UI data; W1-D Phones first-class; W1-E Boss engine II and the Iron Sovereign; W1-F Defence command deck | An "Expanded" roster with Gunners and Stalkers; phones get the battlefield back; Defence gets ×2/×3, targeting, chips and phone stats; the boss engine learns to walk Defence roads. |
| **2** | W2-A Rampart, facing and the Outrider drill; W2-B Defence peaks; W2-C First impression and story light; W2-D Field command AI; W2-E Battle feel; W2-F Campaign showtime | Flanking pays and Sunward cavalry kites; Heroic challenges with elites and Stalker columns; a title that looks like a shipped game, a warm grade, night and storm; an AI that fields everything; every weapon looks different; title cards, boss presence and the Keystone Roads mission. |
| **Clean-up** | CW-A to CW-F | Nothing visible: faster ticks and a cleaner codebase, proven identical. |

### Cross-package contracts

These names are fixed. A package reads a field defensively until the package that writes it is merged.

| Contract | Written by | Read by |
|---|---|---|
| `sim.rules` (only when non-empty), `sim.ruleOn(id)` = `this.rules?.[id] ?? this.missionDef?.rules?.[id]` | W0-B | All |
| `S.rules` passed by `createSim` (`...(S.rules ? { rules: S.rules } : {})`), test hook `window.__frontier.rules` | W0-A (one guarded line and the hook), W1-A (setup UI) | render-budget harness, browser suites |
| `rules.roster === "expanded"` | W1-A (setup), W0-B (save/load) | W1-A, W2-A, W2-D |
| `rules.aiPlan === "field"` | W2-D | W2-D |
| `D[type].roster = "expanded"` on every Expanded-only definition | W1-A (workshop), W1-B, W1-C, W2-A | W1-A (gating), `tests/progression.test.js` (W0-B) |
| Content module API in `src/sim/content/index.js` (section W0-B), including the `fight` hook (H20) | W0-B | W1-A, W1-B, W1-C, W1-E, W1-F, W2-A, W2-B, W2-D |
| Status kinds through `registerStatus` and `e.fx` | W0-B core; `pinned` by W1-B; `stunned` by W1-E | `src/status-view.js` (W1-B) draws every status that has an `icon` |
| `D[type].workshop = "<faction>"` plus the existing `required_level` | W1-B, W1-C, W2-A | W1-A (training and host levelling) |
| `D[type].ai = { role, want: [{ if?, n }], max }` (section W1-A) | W1-B, W1-C, W2-A | W1-A (training), W2-D (placement) |
| `D[type].intro` (one line, with its Vietnamese in `vi.json`) | W1-B, W1-C, W2-A | W1-D |
| Ability data `icon`, `aimed`, `order`, `tint` on `D[type].ability` (today an unknown ability already falls back to the `bolt` icon, last place, not aimed) | units | W1-C (tactics UI, buff rings, ability flash) |
| Shot event `unit` (the shooter's type, always) and `tags` array (`"pinned"`, `"rear"`, `"front"`, `"pierce"`, only when non-empty) | W0-B (fields), W1-B, W1-C, W2-A (tags) | W2-E (`weapons[ev.unit] ?? weapons[ev.weapon]`, labels) |
| View plugin API in `src/view-plugins.js` (section W0-A) | W0-A | W1-B, W1-D, W2-B, W2-E, W2-F |
| `D[type].leak_lives`, `sim.spawnOnRoute(type, team, routeId, leg, at)` | W1-E | W1-E, W2-B (Splitter) |
| Boss definitions with `defence_tuned: true` | W1-E | round 3 (finales and sizing) |
| Wave group `mods` (elite affixes) and preview entries `elite` | W2-B | W1-F chips (already reads `entry.elite`) |
| CSS custom property `--defence-bar-h` on `:root` (the Defence bar's height while it sits at the foot of a portrait phone screen, else unset) | W1-F | W1-D (every bottom-band element stacks above it) |
| Look of a mission, Chronicle or level: a table in `src/mission-looks.js` keyed by id; a data field `look: "night" \| "storm" \| "dusk"` only on new content (Heroic variants, m11c) | W2-C (table), W2-B and W2-F (new content) | W2-C |
| Zone names of Three Roads: a separate export `ZONE_NAMES` keyed by level id, never a level field | CW-F | `app/defence/*` |
| CSS custom property `--font-display` | W2-C | W2-F (with a fallback) |

---

### Wave 0: foundation (2 packages, merged before anything else)

> **Status (integrator, 2026-11-19): part of Wave 0 is already on `feat/aaa-round2`** (commits `8e2ff6b`, `1da6220`, `98c0471`, merged before this plan was final). Read them before you start:
> - **K1, first cut:** `tests/golden-play.test.js` (33 subtests: idle `d071360b` built three ways, the 4 AI-against-AI configs at 60/180/300 s, `playDefence` on d-gorge / d-bridges demolish / d-crossroads, ObjectiveBot 120 s on m01, m03, m06b). The 7 duplicated `d071360b` asserts are already removed from the other test files. **W0-A** splits this file into the three `golden-*.test.js` files of its brief (keep every existing pin value), adds the missing pins (riverlands ×3 Sunward vs Mixed, dunes Ashfall vs Veil, save-reload, Endless to wave 12, m02b, ca1), the `GOLDEN_FULL` split and `tests/lib/*`, then deletes `golden-play.test.js`.
> - **D1 is done**, with a different mechanism than commit 2 below: a lazy `e.baseHp`, set by `setBaseHp()` (`src/sim/tactics.js`) only on entities that can earn ranks **and** whose health differs from `D[type].hp` (commander, armour boosts, wave units and carrier passengers with a group `hp` factor, mission spawns with `hp`). Plain units never get the field; every AI-against-AI pin and ObjectiveBot pin, `d071360b` and the 13 checksums are unchanged; only the 3 Defence pins moved (recorded). `tests/defence-ranks.test.js` holds the D1 cases (commander 936 → 1,011, Bulwark 1,193 → 1,288, old-save squads, towers never rank). **W0-B skips its commit 2** (keep the `baseHp` mechanism; do not replace it with the ratio rule) and does commit 1 (the seams) only. The before/after tables are in `docs/CHANGELOG.md`; the check baselines before and after D1 are in the integration worktree's `github-io/.tmp/baselines/`.

#### W0-A · Safety net, baseline tools and the view seam

| Port | Ideas | Size | Worktree / branch | Base |
|---|---|---|---|---|
| 4232 | K1 (pins and tools; the long baselines are recorded by the integrator), part of K11 (`tests/lib/sim.js`, `tests/lib/duel.mjs`), view seam | M+S | `3d_astra-r2-w0a`, `r2/w0a-safety-net` | `feat/aaa-round2` |

Scope note: the ability-UI data seam moved to W1-C (an unknown ability already renders with the `bolt` icon, so Wave 1 does not depend on it), and recording the slow baselines moved to the integrator, after Wave 0 merges (they then include D1 and are recorded once).

**Player-facing result.** None directly. Every later change can be proven neutral, and visual features land as plugins instead of colliding in `src/view.js` (the most-edited file).

**Design.**

1. **Golden pins (K1).** Record them at the base, before any other change. Three files that `node --test` runs in parallel:

   | File | Pins |
   |---|---|
   | `tests/golden-skirmish.test.js` | AI against AI (`aiPlayer: true`), `sim.hash()` at 60, 180 and 300 s: (1) classic ×1 Normal; (2) highlands ×2 Relentless coalition; (3) riverlands ×2 Fast; (4) basin ×3 Fast; (5) riverlands ×3 Normal, player Sunward, rivals Mixed; (6) dunes ×1 Normal, Ashfall against Veil. Plus a save at 180 s that reloads and ticks to 300 s with the same hash. |
   | `tests/golden-defence.test.js` | `playDefence` (`tools/defence-bot.mjs`) on Standard: d-gorge, d-bridges with demolish, d-crossroads (final hash, stars, lives, towers). Endless on d-gorge to wave 12. |
   | `tests/golden-story.test.js` | ObjectiveBot for 120 s on m01, m03 (boss), m06b (air) and m02b (Defence rules); Chronicle ca1 for 120 s. |

   - Shared helpers: `tests/lib/sim.js` (one `run(sim, seconds)`, `aiMatch(opts)`, `hashesAt(sim, [60, 180, 300])`) and `tests/lib/golden.mjs` (`GOLDEN_RECORD=1` prints the values instead of asserting; `GOLDEN_FULL=1` adds the long points).
   - Move the 7 duplicated `d071360b` asserts into `golden-skirmish.test.js`. They are in `tests/air.test.js`, `chronicles.test.js`, `defence-rules.test.js`, `factions.test.js`, `player-faction.test.js`, `terrain-height.test.js` and `wings.test.js`. Remove only that assert; every other check stays.
   - Each file header says: pins are re-recorded only by the integrator, with a named reason.
   - Split by cost: the 60 and 180 s points, the Defence runs on d-gorge and d-bridges and the 120 s story runs run in `npm test`; the 300 s points, the save-reload run, d-crossroads and Endless to wave 12 run only with `GOLDEN_FULL=1`. The `npm test` part runs in 30 s or less. A 300 s AI run measured 0.5 to 1.4 s.
   - Script `test:golden-full` (`GOLDEN_FULL=1 node --test tests/golden-*.test.js`) and a new `pages.yml` matrix entry `golden-full` that runs it. Script `ci:build-job` (`npm test && npm run check:defence && npm run build`) for the integrator's 2-core timing (section 2.10).
2. **Baseline tools** (W0-A builds and proves them; the integrator records the full set after Wave 0, section "After Wave 0").
   - `tools/mission-check.mjs` gains `--json` (one object per mission and run, no wall-clock fields).
   - `tools/faction-bench.mjs` and `tools/skirmish-bench.mjs` gain `--jobs N` (forked workers; rows sorted so the JSON equals a single-process run) and `--rules '<json>'` (passed to `new Simulation({ rules })`; ignored until W0-B merges). `skirmish-bench` gains `--json`.
   - New `tools/baseline-diff.mjs` and script `npm run baselines:diff`: re-runs the fast baselines (`defence.json`, and `missions-standard.json` rows) and diffs them against `docs/aaa/results/round2/baseline/`. `--full` runs all of them. It reports a missing baseline file as "not recorded yet", not as a failure, so it works before the integrator's recording.
   - W0-A proves each tool on a subset only: `check:missions --json --only m01-first-light,m03-the-ashen-line,m06b-wings-over-copper` twice (byte-identical), `bench:factions --json --jobs 3` on 10 matches equal to the single-process run, and `check:defence --json` twice.
3. **Duel harness** `tests/lib/duel.mjs` (new): the equal-cost battle of `tests/balance.test.js` generalised. `duel(sideA, sideB, { budget, factions, offsets: [0, 4, 8, -4, -8], rules, watch })` where a side is a type or a mix `[[type, n], ...]`; it plays every offset from both spawn sides (10 battles) and returns `{ mean, wins, battles: [...] }`, plus optional per-battle facts from `watch` (for example "the Medics died before 2 Rangers"). `tests/balance.test.js` keeps its own copy (not owned here).
4. **Render-budget harness made data-driven** (`tests/render-budget.mjs`). Today scenario spawning is inline code (about lines 93 to 143). Add scenario fields:
   - `spawn: [{ type, team, count, near: [x, z] }]`, `boss: "<type>"` (`true` still means the Iron Vanguard), `variant` (passed to `defenceVariant`), `status: { id, count }` (applies a status to N units, for icon draws).
   - **Every type a scenario can put on screen is preloaded** before the frozen scene: the union of `spawn[].type`, `air`, `boss` and the boss's `drops`, through `view.preloadModels` (`view.js:499`). Today only `air` and the Iron Vanguard are, and a type without a template draws as the `FallbackFlyer` wing (`view.js:1050`), which would measure the wrong draws.
   - `rules`: the harness sets `window.__frontier.rules = scenario.rules` before `f.restart()` and clears it after. This needs two guarded lines that W0-A owns in Wave 0: `src/main.js` `createSim` passes `...(S.rules ? { rules: S.rules } : {})` to the Simulation (ignored until W0-B merges; W1-A then owns the line), and `src/app/debug-hooks.js` gets `get rules()` / `set rules(r)` on `S.rules`. W0-A tests only that the line is inert without rules; the first real `rules` scenario is W1-A's.
   - Add the comment and first line of the limits convention: `Object.assign(limits, {});` right after `const limits`.
   - Existing scenarios must give identical p95 draws.
5. **View plugin seam** (`src/view.js`, new `src/view-plugins.js`).
   - `src/view-plugins.js` exports an append-only array of plugin classes. `WorldView` builds each once with `new Plugin(view)`; a plugin may use `view.fx`, `view.shake`, `view.scene` and `view.camera`.
   - Optional hooks, each called in array order:
     - `dress(root, e)` at the end of `createEntity`;
     - `scaleFor(e)`: a static multiplier applied **after** the readability clamp at `view.js:1100` and **before** the health bar is placed at `view.js:1138`, so it may exceed `FEEL.maxModelScale`;
     - `frameScaleFor(e, u, view)`: a per-frame multiplier applied with `u.readabilityScale` at `view.js:1523`; the bar height follows it;
     - `event(ev, sim)` in `WorldView.event`;
     - `update(sim, dt)` once per frame in `WorldView.update`;
     - `reset()` in `WorldView.reset`.
   - With an empty array, every frame is identical (multiplying by exactly 1).
   - Document it in `docs/VIEW_PLUGINS.md` (new).

**Files owned.** New: `tests/golden-skirmish.test.js`, `tests/golden-defence.test.js`, `tests/golden-story.test.js`, `tests/lib/sim.js`, `tests/lib/golden.mjs`, `tests/lib/duel.mjs`, `tests/duel.test.js`, `tools/baseline-diff.mjs`, `src/view-plugins.js`, `tests/view-plugins.test.js`, `docs/VIEW_PLUGINS.md`. Existing: the 7 pin files listed above, `tools/mission-check.mjs`, `tools/faction-bench.mjs`, `tools/skirmish-bench.mjs`, `tests/render-budget.mjs` (harness), `src/view.js`, `src/main.js` (the one guarded `rules` line), `src/app/debug-hooks.js` (the `rules` hook).

**Shared append-only.** `package.json` (`baselines:diff`, `test:golden-full`, `ci:build-job`), `.github/workflows/pages.yml` (matrix entry `golden-full`), `docs/CHANGELOG.md` (creates `## Unreleased: AAA round 2`), `docs/TESTING.md` (section "Golden pins and baselines": what each pin covers, what `d071360b` really pins, the `GOLDEN_FULL` split, the duel harness).

**Art.** None.

**Tests.** The three golden files; `tests/view-plugins.test.js` (hook order with a fixture plugin; an empty registry changes nothing); `tests/duel.test.js` (10 battles, mirrored sides, the Ranger-beats-Breaker case of `balance.test.js` gives a positive mean); bench `--jobs 3` equals single-process on a 10-match subset; `createSim` without `S.rules` passes no `rules` key.

**Acceptance.**
- `npm test` green; at least 609 + 25 tests; `grep -l d071360b tests/*.js` lists exactly one file.
- The `npm test` part of the golden files runs in 30 s or less; `test:golden-full` in 3 minutes or less.
- Each tool reproduces byte-identically on its subset (above).
- Render budget p95 identical in all 12 existing scenarios (the preload change must not move them: their types are already loaded).
- A held-clock screenshot of `battle-eco` is pixel-identical before and after the view seam.
- All 23 CI browser groups green (`CI_LOCAL_PORT=4232 CI_LOCAL_LANES=2 npm run test:ci-local -- --fast`).

**Risks.** Slow pins: the `GOLDEN_FULL` split keeps `npm test` fast; if the `npm test` part still passes 30 s, move the d-bridges run behind it too. The harness preload could hide a real loading bug: model loading has its own suite (`model-loading`), which is unchanged.

#### W0-B · Sim seams, status core and the D1 promotion fix

| Port | Ideas | Size | Worktree / branch | Base |
|---|---|---|---|---|
| 4233 | D1, core of M1 (status effects, hooks), the rules option, the Classic-roster count test | M+S | `3d_astra-r2-w0b`, `r2/w0b-sim-seams` | `feat/aaa-round2` |

Scope note: `src/rng.js` (K3) moved to CW-B, which replaces the copies anyway; Wave 0 carries only what Wave 1 depends on.

**Player-facing result.** In Frontier Defence the commander and the armour squads keep their bonus health when they rank up. The commander goes 936 → 1,011 after one promotion (today 936 → 562) and ends a Three Roads bot run at about 1,161 at rank 3 (today 645). Nothing else changes.

**Design.** Two commits: commit 1 adds the seams (behaviour-neutral), commit 2 applies D1.

*Commit 1: seams.*

1. **Content registry.** `src/sim/content/index.js` exports an append-only array of modules (empty in this package). `src/sim/content.js` (new) is a mixin dispatcher that reads the array once at import and builds one list per hook. A module is a plain object; every field is optional:

   | Field | Meaning |
   |---|---|
   | `id`, `order` | Unique id; `order` sorts `step` hooks (a test enforces unique orders) |
   | `mixin` | Extra Simulation methods (a name clash throws at import) |
   | `onSpawn(sim, e)` | After `spawn()` |
   | `hitScale(sim, e, t, tags)` | Returns a damage factor for attacker `e` on target `t`; may push a tag |
   | `onHit(sim, e, t)` | After a direct hit is applied |
   | `taken(sim, t, team, by)` | Returns a damage factor in `applyDamage` |
   | `onDeath(sim, t, team, by)` | When `t` dies, after `traitDeath` |
   | `step(sim, dt)` | Once per tick, after `stepTraits` |
   | `fight(sim, e, t, dt)` | At the start of `combat.fight()`, after its validity checks: return `true` when the module moved or handled the unit this tick (for example a kiting step back), anything else to fall through |
   | `statuses` | `{ id: { speed, reload, taken, noFire, noCast, icon } }` |
   | `abilities` | `{ id: { use(sim, e, a, point) → { change, guard?, damage?, mech? } \| false } }`: a generic timed buff. Its undo map records, per `change` key, either the old value or "absent"; when the buff ends, a key that was absent is **deleted** (never set to `undefined`), so the Stalker's `pierce` is gone after Steady aim and the entity's keys equal its keys before the cast |
   | `autocast(sim, e, a)` | Returns `undefined` (fall through to today's rules), `false` (do not cast), `true` (cast with no point) or `{ x, z }` (cast at that point) |
   | `towerAim(sim, e)` | For towers with `e.aim`: returns a target, `null` or `undefined` |
   | `commands` | `{ type: { allowed, run } }` merged into `COMMANDS` (a clash throws) |
   | `aiRules` | `[{ id, run(sim, team, ctx) }]`, run in order after AI production |

2. **Status core** `src/sim/effects.js` (new mixin).
   - `applyStatus(e, id, seconds, { immune } = {})`, `hasStatus(e, id)`, `statusFactor(e, "speed" | "reload" | "taken")`, `canAct(e, "fire" | "cast")`.
   - State is a lazy `e.fx = { [id]: until }` (plus `[id + "Immune"]: until`), created on the first status. Statuses are active while `until > time`. A 1-second sweep deletes expired keys and removes `e.fx` when empty; it runs only once `sim.fxOn` is set (created by the first `applyStatus`).
3. **Call sites.** One guarded line each, inserted as new lines (no reformatting):

   | # | Where | Seam | Inert because |
   |---|---|---|---|
   | H1 | `simulation.js:436` mixin line | add `content` and `effects` mixins and module mixins | methods unused |
   | H2 | `simulation.js` constructor | option `rules`: `if (rules && Object.keys(rules).length) this.rules = { ...rules }`; `ruleOn(id)` | field absent |
   | H3 | `simulation.js` `spawn()` end | `if (SPAWN.length) this.contentSpawn(e)` | list empty |
   | H4 | `simulation.js` `tick()` after `stepTraits` | `if (STEP.length \|\| this.fxOn) this.contentStep(dt)` | |
   | H5 | `combat.js:7` `enemy()` first line | `if (e.prefers) return this.preferredEnemy(e, radius, clearShot)` | no definition has `prefers` |
   | H6 | `combat.js:31` `defenseTarget()` first line | `if (e.aim) { const t = this.aimedTarget(e); if (t !== undefined) return t; }` | no `aim` |
   | H7 | `combat.js` `hit()` damage product | `* (HIT_SCALE.length ? this.hitScale(e, t) : 1)` as the last factor; tags collected in a module-level scratch array | list empty |
   | H8 | `combat.js` `hit()` | after `apply(target)`: `if (ON_HIT.length) this.contentHit(e, target)`. The `shot` event gets `unit: e.type` always (hash-neutral: events are `DERIVED`) and `tags` only when non-empty | |
   | H9 | `combat.js` `hit()` cooldown | `e.cooldown = e.interval * (e.fx ? this.statusFactor(e, "reload") : 1)` | no `fx` |
   | H10 | `combat.js` `fight()` | `if (e.cooldown <= 0 && !(e.fx && !this.canAct(e, "fire"))) this.hit(e, t)` (a stunned tower still faces its target, but is silent) | |
   | H11 | `sim/traits.js:103` `moveSpeed()` | `if (e.fx) speed *= this.statusFactor(e, "speed")` before the ford factor | |
   | H12 | `progression.js` `applyDamage` after the Mark line | `if (TAKEN.length) damage *= this.takenScale(t, team, by)`; `if (t.fx) damage *= this.statusFactor(t, "taken")` | |
   | H13 | `progression.js` death branch after `traitDeath` | `if (ON_DEATH.length) this.contentDeath(t, team, by)` | |
   | H14 | `tactics.js` `abilityReady()` | `&& !(e.fx && !this.canAct(e, "cast"))` | |
   | H15 | `tactics.js` `useAbility()` before `TIMED` | registered abilities first (generic timed buff) | no registered ids |
   | H16 | `tactics.js` autocast loop, after the team check | ask `this.contentAutocast(e, a)` first; on `true` or a point, cast; on `false`, skip; on `undefined`, run today's rules | returns `undefined` |
   | H17 | `commands.js` `COMMANDS` | merge module commands at import | none |
   | H18 | `snapshot.js` `serialize()` options | `...(this.rules ? { rules: this.rules } : {})`; load passes it back | field absent |
   | H19 | `sim/ai.js`, right after `this.aiAirTrain(team, hq, army, pace, afford)` | `if (AI_RULES.length) this.contentAi(team, { own, army, workers, hq, pace, afford, role })` | list empty |
   | H20 | `combat.js` `fight()`, right after the validity checks (before the range test) | `if (FIGHT.length && this.contentFight(e, t, dt)) return true;` | list empty; modules answer only for their own units (W2-A's Outrider drill) |

   - `preferredEnemy` (H5) is a full, generic implementation: the same visibility, hostility, `canHit` and `clearShot` checks as `enemy()`; candidates rank by their class's position in `e.prefers` (classes not listed come last), then by distance, then entity order. Units without `prefers` never reach it.
   - `aimedTarget` (H6) returns the first module `towerAim` answer, else `undefined`.
4. **`tests/progression.test.js` rewrite** (blocks Wave 1 otherwise: its count lines 13 to 18 would break in W1-A, W1-B and W1-C at once). Count only the Classic roster (definitions without `roster: "expanded"`): 21 non-boss units, 9 buildings, 4 flyers, 1 `defence` unit. Every definition with a `kind` keeps a description and a model. The shield rule becomes `d.shield > 0 || type === "scrapper" || d.workshop === "ashfall"`. With no Expanded definition in the tree yet, the test passes unchanged in substance; a fixture definition with `roster: "expanded"` proves the filter.
5. **`tools/perf-ab.mjs`** (new): `--a <src dir> --b <src dir> --scene <name> --runs 7` imports both trees' `Simulation`, runs the named fixed scene (first scenes: `riverlands-x2-300` AI-against-AI, `crossroads-wave-120`), alternating A and B in one process, and prints the median, p95 and p99 tick time of each. Section 2.3 explains who uses it.
6. **`docs/CONTENT_SEAMS.md`** (new): how to add a unit, a status, an ability, a tower rule, a command, a fight behaviour or an AI rule as a module. One worked example.

*Commit 2: D1, ratio rule, Defence only, no new field.*

- In `creditKill` (`tactics.js:42`), with `oldRank = e.rank - 1` and `standard = Math.round(D[e.type].hp * (1 + RANK_BONUS * oldRank))`:
  - if `this.defence` is set **and** `e.maxHp !== standard`: `e.maxHp = Math.round(e.maxHp * (1 + RANK_BONUS * e.rank) / (1 + RANK_BONUS * oldRank))`;
  - otherwise: today's formula, unchanged.
- This keeps every unit's own factor: the commander (×1.8), armour squads and their Bulwark upgrade, group `hp` factors (Story hull, Endless growth, cargo). It adds no state. Skirmish and base-building missions take today's path by construction.
- Worked numbers: commander 936 → 1,011 → 1,086 → 1,161 (ranks 1 to 3); Bulwark tank 1,193 → 1,288; a plain Ranger is unchanged.
- Report only (do not fix): the same bug class in `progression.js:61` (building levels recompute from base HP, so a mission tower with `hp: 3500` loses it on level-up) and mission `hp` spawns at `sim/missions.js:100` (none can rank today: the only unit is Okoro, an Engineer with 0 damage).

**Files owned.** `src/sim/tactics.js`, `src/sim/combat.js`, `src/sim/traits.js`, `src/progression.js`, `src/simulation.js`, `src/commands.js`, `src/snapshot.js`, `src/sim/ai.js` (one call only); new `src/sim/content.js`, `src/sim/content/index.js`, `src/sim/effects.js`, `tools/perf-ab.mjs`, `docs/CONTENT_SEAMS.md`, `tests/content-seams.test.js`, `tests/effects.test.js`. Tests: `tests/defence-ranks.test.js`, `tests/progression.test.js`, `tests/terrain-labels.test.js`, `tests/choices.test.js`, `tests/mission-ui.test.js`, `tests/story-scenes.test.js` (these read `simulation.js` as text; edit only if a seam line breaks a regex). `tests/wings.test.js`, `chronicles.test.js` and `player-faction.test.js` also read `simulation.js` but belong to W0-A: note any change for the integrator.

**Shared append-only.** `docs/CHANGELOG.md`, `docs/BALANCE.md` (section "D1: promotion keeps health factors", with the before and after table).

**Art.** None.

**Tests.** At least 25 new.
- A fixture module (test-only, injected through the dispatcher's test hook) exercises every hook. Step order is deterministic.
- Status lifetimes and immunity; a save mid-status reloads to an identical hash; no entity has `fx` after a 300 s AI run.
- `rules` absent gives a byte-identical `serialize()`; `rules` present round-trips through save and load.
- After a 300 s AI-against-AI run, `Object.keys(sim)` and every entity's keys equal the base.
- A registered timed buff that adds a key absent before (fixture: `pierce`) leaves no such key after it ends; a key that existed gets its old value back.
- The `fight` hook: a fixture module that answers `true` for one fixture type moves it, and every other unit's path is unchanged.
- Every `shot` event carries `unit`; `serialize()` output is byte-identical with and without it (events are derived).
- `tests/progression.test.js` rewrite: same counts as today; a fixture `roster: "expanded"` definition is left out of the counts.
- A registered command replays from the command log. A mixin or command clash throws.
- `preferredEnemy` ranks by list, then distance; a unit without `prefers` is unchanged.
- D1 cases: commander 936 → 1,011; Bulwark 1,193 → 1,288; armourBoost after a rank keeps the boost; a skirmish Ranger is unchanged; outside Defence the old formula runs.

**Acceptance.**
- Before editing, record in `.tmp/` the hashes of the 6 W0-A skirmish setups, the 3 `playDefence` runs and `check:defence --json` at the base.
- Commit 1: all identical; `d071360b` and the 13 checksums hold; headless tick time on a 300 s riverlands ×2 run within +3% of the base (`tools/perf-ab.mjs`, interleaved, median of 7; the integrator confirms it on a quiet machine).
- Commit 2: skirmish hashes and the m01, m03, m06b and ca1 story hashes still identical. The m02b story run is a Defence-rules mission (`this.defence` is set; its wave 7 tanks carry a group `hp: 1.3`, and Story and Veteran scale group HP by 0.75 and 1.05, `defence-missions.js:47`, `sim/defence.js:524-525,587`), so D1 may move it: record its before and after hash and declare it. A before/after table in the results file and `docs/BALANCE.md` for `check:defence --json` (every level and difficulty: result, stars, lives, towers lost, commander max HP at the end, Endless waves), `tools/chronicle-check.mjs --only ca3-scrapyard-gorge,cw3-hold-the-river`, and `check:missions --only m02b-hold-the-river,m07b-hold-the-valley` on all three difficulties.
- Every `check:defence` target still met (bot stars, passive loses, no single-crew 3★, Endless at least 15 waves). If one fails, do not retune: report it (decision O4).
- Test count +25 or more.

**Risks.** This package touches the hottest sim files. Mitigation: no content, a guard on every seam, measured before and after, and the integrator runs W0-A's pins on the merged tree. D1 also lets enemy units with a group `hp` factor keep it when they promote, which makes some Defence runs slightly harder: measured and reported.

#### After Wave 0 (integrator)

1. Merge W0-A, then W0-B. Apply the test changes both results files list.
2. Run every pin. The skirmish pins and the story pins except m02b must be identical. Re-record, with the reason "D1": `golden-defence.test.js` (all rows) and the m02b row of `golden-story.test.js`. Any other moved pin is a bug: revert W0-B's commit 2 and reopen it.
3. **Record the baselines once, on the merged tree** (so they include D1), one at a time and at `--jobs 3`, into `docs/aaa/results/round2/baseline/`: `missions-story.json`, `missions-standard.json`, `missions-veteran.json` (Veteran m12 times out today, as before: the row records the timeout), `missions-standard-mercy.json`, `missions-standard-firm.json`, `chronicles.json` (`tools/chronicle-check.mjs`), `defence.json` (`check:defence --json`), `bench-classic.json` (`bench:factions --json`, 120 matches). Run `npm run baselines:diff -- --full` right after: identical.
4. Run the timing gates of Wave 0 on a quiet machine (W0-B's `perf-ab` run).
5. Run the full suite (section 3, "Integration after each wave"). Tag `r2-wave-0`.

---

### Wave 1: the toolbox and the first new fighting styles (6 packages)

Merge order: W1-B, W1-C, W1-E, W1-A, W1-F, W1-D (units before the roster, roster before the UI).

#### W1-A · Roster setting and faction workshops

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4232 | U1, the client half of the rules channel, workshop AI with host levelling | M+S | `3d_astra-r2-w1a`, `r2/w1a-roster` | W0-A (`rules` line in `createSim`, harness `rules`), W0-B (`rules`, content modules, AI rules) |

**Player-facing result.** The skirmish setup gains a "Battle rules" row with "Roster: Classic / Expanded". Under Expanded each faction building becomes a workshop for signature units: Meridian builds a new **Field workshop**, and the Ashfall Salvage yard, Sunward Waystation, Wardens Pylon and Veil relay train workshop units too. This round fills three of them (Gunner team W1-B, Stalker W1-C, Rampart W2-A). The Sunward and Wardens hosts are wired but empty: Sunward gets its new style this round as the Outrider drill (W2-A, no host needed), and the Wardens, the strongest faction at 71%, get a unit in round 3 once the Expanded bench shows where they stand. The AI uses the workshops as well, including levelling the hosts. Classic plays exactly as today, and stays the default until the owner decides (O1).

**Design.**
- **Data** (append to `balance.json`):
  - New top-level `workshops: { hosts: { meridian: "workshop", ashfall: "salvageyard", sunward: "waystation", wardens: "pylon", veil: "veilrelay" }, max_tiles: 2 }`.
  - New definition `workshop`: building, cost [150, 50], time 18 s, 700 HP, 40 shield, radius 2.2, vision 12, `requires: "foundry"`, `icon: "foundry"`, `roster: "expanded"`, no `trains` field. It levels to 3 like every building (`progression.js`).
  - Workshop units are definitions with `workshop: "<faction>"`, `roster: "expanded"` and the existing `required_level` (W1-B, W1-C, W2-A write them).
- **Rules** (`src/factions.js`, under `this.ruleOn("roster") === "expanded"` only):
  - `workshopUnits(faction)`: every definition whose `workshop` equals the faction, in definition order, at most `max_tiles`.
  - `unitRoster(team)` adds them; `canTrain` follows.
  - `buildable(team)` adds `workshop` for Meridian.
- **Host training without hashed changes in Classic.** New `src/sim/content/workshops.js` (content module):
  - `onSpawn`: under Expanded, a host building of a team whose faction has workshop units gets `e.trains = workshopUnits(faction)`. Today the faction buildings have no `trains`, so Classic entities keep identical keys.
  - The existing production card and level locks then work: `app/hud.js:219` shows PRODUCTION when `e.trains` is set, and `research-tiles.js` already shows "Needs L2" from `required_level`. Neither file needs an edit.
- **Workshop AI** (an `aiRules` entry in the same module, Expanded only, `!sim.mission`):
  - Meridian: build the Field workshop once a Foundry is complete and alloy allows (a 12-angle ring search around the core, like `sim/ai.js` does).
  - **Host levelling.** The Classic AI levels only the Barracks and the Foundry (`sim/ai.js:101`, `["barracks","foundry"].includes(e.type)`), so without this rule no AI could ever train the Stalker (`required_level: 2` at the Veil relay) or the Rampart (level 3 at the Salvage yard). The rule raises each complete, idle host one level at a time up to the highest `required_level` among its faction's workshop units, never above `this.techLevel(team)` (the core's level, as for the Barracks), once `this.time > pace.upgradeAt` and `afford(this.levelCost(b))` (`this.upgradeBuilding(b.id, team)`, the same call `sim/ai.js` uses).
  - Every faction: each complete, idle host trains its units by their `ai` data.
  - The `ai` vocabulary: `{ role: "line" | "back" | "front", want: [{ if?, n }], max }`. `want` entries are read in order; the first whose `if` holds gives the wanted count. `if` keys: `seenInfantry` (share of the seen army, from `sim.intel[team]`), `seenSupport` (count), `seenAntiarmor` (count), `seenTowers` (count), `after` (seconds). An entry with no `if` always holds.
- **Setup UI.**
  - New append-only registry `src/app/rule-options.js`: `[{ id, label, help, values: [{ id, label }], default }]`. First entry: `roster` (Classic, Expanded), with a one-line help text.
  - `src/app/briefing.js` renders the "Battle rules" row into `#skirmish-setup` at bind time (do **not** edit `src/app/shell.js`: W1-D owns it this wave). Segmented controls, 44 px tall, a small "New" badge.
  - `src/app/state.js` holds `S.rules`; `src/app/preferences.js` remembers it; `src/main.js` `createSim` (W0-A's guarded line) passes only non-default values, for skirmish only. Loading a save restores `S.rules` from its options.
- **Field guide** (`src/field-guide.js`): "Trained at <host> (level N), Expanded roster" for workshop units.
- **Models** (`src/model-roster.js`): when `rules.roster` is Expanded, declare the hosts and workshop units of the factions in play (generic, by the `workshop` field, so W2-A's Rampart needs no edit here).

**Files owned.** `src/factions.js`, `src/model-roster.js`, `src/field-guide.js`, `src/app/briefing.js`, `src/app/state.js`, `src/app/preferences.js`, `src/main.js`, `tests/model-roster.test.js`, `tests/faction-rules.test.js`, `tests/player-faction.test.js`, `tests/review-2026-10b-00.test.js`, `tests/review-2026-10d-07.test.js`; new `src/app/rule-options.js`, `src/sim/content/workshops.js`, `tools/blender/generate_workshop.py`, `public/models/workshop.glb`, `tests/workshops.test.js`, `tests/workshops.mjs`, `tests/golden-w1a.test.js`.

**Shared append-only.** `balance.json`, `vi.json`, `manifest.json`, `src/sim/content/index.js`, `tests/render-budget.mjs`, `package.json`, `pages.yml`, `docs/CHANGELOG.md`, `docs/BALANCE.md`.

**Art.** `workshop.glb`: a crane-arm hangar with an open bay, warm teal and amber Meridian paint, `Team` trim, a glowing bay light. At most 4,000 triangles and 5 materials.

**Tests.** At least 12 unit tests and 1 browser suite.
- Classic: rosters and buildables of all 5 factions deep-equal today's; the 15 missions and 12 Chronicles keep their rosters and build menus; Classic entity keys unchanged after 300 s.
- Expanded: Meridian can build the workshop; a fixture definition with `workshop` trains at its host only from its `required_level`; rules persist in saves.
- AI: under Expanded, a fixture unit with `ai.want` is trained by a 900 s AI match; the Field workshop gets built.
- Host levelling: a fixture workshop unit with `required_level: 3` makes the AI raise its host to level 3 and train it within 1,200 s; a host is never raised above the core's level; Classic hosts are never levelled.
- `tests/workshops.mjs` (browser, 3 viewports): open skirmish with Expanded, build a workshop through the test hooks, tiles at least 44 px, text at least 11 px, dock height unchanged.

**Acceptance.**
- `baselines:diff` and all golden pins identical.
- New scenario `battle-expanded-eco` (`rules: { roster: "expanded" }`, workshops on both sides, army 60 of existing types): 125 draws or fewer. It is the first `rules` scenario of the harness.
- `golden-w1a.test.js`: an Expanded AI-against-AI hash at 180 s (`GOLDEN_FULL`: 600 s) on a **faction-isolated** setup that no later package of this round changes: Wardens against Wardens with a fixture Wardens workshop unit injected by the test (the Wardens get no real workshop unit this round).
- Test count +12 or more.

**Risks.** Gating leaking into campaign or Chronicles (tested). Phone card overflow (measured with an Arial-first build). The real units arrive with W1-B and W1-C; their training is checked after the merge and by W2-A.

#### W1-B · Gunner team (Meridian line-holder)

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4233 | U2 | M | `3d_astra-r2-w1b`, `r2/w1b-gunner` | W0-A (plugins, duel harness), W0-B (modules, statuses) |

**Player-facing result.** A two-soldier tripod machine-gun team. Its sweeping tracer stream shreds and pins infantry rushes: pinned enemies move at half speed, reload slower and cannot use abilities, then shrug it off. It holds a line against Vanguards, Scrappers and Shades with no orders. Rangers and Drones out-trade it, and Breakers, Tanks and Scorchers crush it.

**Why the numbers changed after review.** With the first draft (110/30 HP, class `ranged`, single target) the Gunners lost every equal-cost duel: a red-team probe measured -0.87 against a Scrapper swarm (5 Gunners against 17 Scrappers, all Gunners dead in 5.1 s) and -0.85 against Vanguards, because class `ranged` hands every melee unit its ×1.6 counter bonus. The design below was probed by the refiner (2026-11-19, the `balance.test.js` harness at 5 offsets × 2 sides, pinning emulated as ×0.5 speed and ×1.5 reload, no Crossfire, no `noCast`):

| Matchup (mean of 10) | Budget 1,000 | Budget 1,500 | Budget 2,000 |
|---|---:|---:|---:|
| Gunner vs Scrapper | +0.06 | +0.61 | +0.84 |
| Gunner vs Vanguard | +0.14 | +0.56 | +0.67 |
| Gunner vs Shade | +0.10 | +0.53 | +0.69 |
| Gunner vs Ranger | -0.47 | -0.42 | -0.39 |
| Gunner vs Breaker | -0.86 | -0.88 | -0.88 |
| Gunner vs Tank | -0.90 | -0.92 | -0.94 |

**Design.**
- **Definition `gunner`:** 125 HP and 35 shield, speed 3.6, 4 damage every 0.25 s (16 dps), range 11, **`counter: "melee"`, `counter_bonus: 1.6`**, **`splash_radius: 1.8`, `splash_damage: 0.5`** (the existing splash path, `combat.js:110`: the stream sweeps), `mechanical_bonus: 0.25`, `building_bonus: 0.5`, **class `siege`**, no anti-air, cost [125, 40], pop 2, time 16 s, `workshop: "meridian"`, `roster: "expanded"`, `required_level: 1`. For scale: a Ranger is 95/25, speed 4.2, 12.4 dps at range 10, [100, 25], pop 1.
  - Class `siege` is deliberate: Rangers, Riders and Drones (`counter: "siege"`) are its infantry answer, melee units get no counter bonus on it, and the AI already scores siege targets first (`ai-attack.js:236`), so enemy fire goes to the gun. No new class string is added (`class` is read only by `combat.js:87`, `ai-attack.js:236-237` and the fight hint in `app/ui-extras.js:26`).
  - Tuning range if a gate misses (combat fields are frozen after Wave 1, section 2.6): HP 115 to 135, `splash_damage` 0.4 to 0.6, `pin_at` 5 to 7. Nothing else.
- **Suppression** (`suppress: { per_hit: 1, radius: 2, pin_at: 6, decay: 2, seconds: 3, immune: 4 }` on the definition; module `src/sim/content/suppression.js`):
  - `onHit`: the target **and every other hostile non-mechanical ground combat unit within 2 m of it** (not Harvesters, buildings, bosses or flyers) gain `per_hit` points; points decay 2 per second (kept in a separate lazy field `e.sup = { pts, at }`, created on the first hit; `e.fx` holds only status timers). Candidates are visited in entity order.
  - At 6 points the unit gets status `pinned` for 3 s (`speed 0.5`, `reload 1.5`, `noCast`, `icon: "pin"`), then 4 s of immunity with points reset.
  - The shot event is tagged `"pinned"` on the hit that pins its target.
- **Ability Crossfire** (registered ability): suppression ×2 for 6 s, cooldown 35 s, `icon: "rapid"`, `tint: [1, 0.78, 0.35]`. Autocast when 3 or more non-mechanical enemies are in range.
- **AI data:** `ai: { role: "line", want: [{ if: { seenInfantry: 0.6 }, n: 2 }, { n: 1 }], max: 2 }`.
- **Intro line:** `intro: "Gunner team: its fire pins infantry rushes. Pinned units slow down and cannot use abilities. Rangers and vehicles beat it."`
- **Status icons** `src/status-view.js` (view plugin, new): one InstancedMesh with a 4-cell canvas atlas (pin, stun, mark, emp) above every unit with an active status that has an `icon`. 1 draw while any icon shows, 0 otherwise. Created lazily.
- **Look:** append `weapons.gunner` to `src/visual-style.json`: the rifle kind with a fast, short, warm tracer (W2-E gives it a true MG stream).

**Files owned (all new).** `src/sim/content/suppression.js`, `src/status-view.js`, `tools/blender/generate_gunner.py`, `public/models/gunner.glb`, `tests/gunner.test.js`, `tests/gunner.mjs`, `tests/golden-w1b.test.js`.

**Shared append-only.** `balance.json`, `vi.json`, `manifest.json`, `src/sim/content/index.js`, `src/view-plugins.js`, `src/visual-style.json` (`weapons`), `tests/render-budget.mjs`, `package.json` (`test:gunner`), `pages.yml` (entry `r2-w1b`), `docs/BALANCE.md`, `docs/CHANGELOG.md`.

**Art.** `gunner.glb`: two figures, a tripod MG with a `BarrelRig` that recoils, an ammo box, warm teal fatigues, `Team` armbands. **One `leg_L`/`leg_R` pivot pair** (the runtime contract in `tests/assets.test.js`): the second figure's legs are parented to the same two pivots, so the team steps as one rig. At most 3,200 triangles; no more materials than the Ranger.

**Tests.** At least 10 unit tests: accumulation and decay; the 2 m spread of points; the Pinned effects; immunity; no unit pinned longer than 3 s at a time; vehicles, bosses and flyers immune; Crossfire doubles points; the autocast rule; a save mid-pin reloads to an identical hash; absent from every Classic roster. One browser suite, `tests/gunner.mjs` (390×844 and 844×390): at the phone start zoom the Gunner is at least 28 px tall (the `tests/feel.mjs` rule), and the pin icon draws.

**Acceptance.**
- Duels with `tests/lib/duel.mjs` (section 2.6, recorded in `docs/BALANCE.md`): at a 1,500 budget, Gunners beat Scrapper, Vanguard and Shade swarms each with a mean of +0.3 or more and at least 7 of 10 battles won; they lose to Rangers (mean -0.25 or lower) and to Breakers and Tanks (mean -0.5 or lower). Record the 1,000 and 2,000 budgets too, and how much longer Scrappers take to reach the line than against an equal-cost Ranger group (recorded, not a gate).
- Over 60 s of steady fire a target is pinned at most 3/7 of the time.
- `gunner-battle-eco` (60 units, 8 Gunners pinning, status icons on): 125 draws or fewer.
- `golden-w1b.test.js`: a scripted sandbox (`ai: false`, 8 Gunners against a Scrapper swarm and 4 Rangers, Meridian against Ashfall, hashes at 30 and 60 s).
- Golden pins and baselines identical. Test count +10 or more.

**Risks.** Pin lock-down: immunity and the 3/7 test bound it. Splash plus suppression on clumps could make Gunners too strong in the Expanded bench: W2-A may raise its cost or `required_level` (economy fields only). Training is only possible after W1-A merges; this package tests with spawned units.

#### W1-C · Stalker (Veil cloaked sniper) and ability UI from data

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4234 | U7, the ability-UI data seam (moved from W0-A) | M+S | `3d_astra-r2-w1c`, `r2/w1c-stalker` | W0-A (duel harness), W0-B (`prefers` is generic, H5) |

**Player-facing result.** A hooded long-rifle sniper that hides again 3 s after each shot and picks off Medics, Anti-tank teams and Rangers first. It breaks heal-balls with no orders. Kites (they detect cloaks within 8 m), towers and cores (9 m) and anything that closes to 4 m reveal it; Vanguards and Shades, which counter ranged units, are the answer. New abilities of this round (Crossfire, Steady aim, Ram) show their own icons and tints.

**Why the numbers changed after review.** The red team found the first-draft gates fragile: Veil Stalkers beat an equal-value Rider pack (+0.40), and the heal-ball duel flipped with the spawn side (+0.40 against -0.75). A refiner probe (2026-11-19, Veil against Meridian, cloak on, `prefers` emulated, 5 offsets × 2 sides) gave:

| Matchup (mean of 10, Stalkers' view) | Draft 75/20, 85 dmg, 17 m | Final 85/25, 95 dmg, 18 m |
|---|---:|---:|
| 6 Rangers + 2 Medics (heal-ball) | +0.09, won 6/10, Medics first 3/10 | +0.26, won 8/10, Medics first 7/10 |
| Rider pack | -0.05 | -0.01 |
| Vanguard pack | -0.55 | -0.32 |
| Shade pack | -0.42 | -0.30 |

**Design.**
- **Definition `stalker`:** 85 HP and 25 shield, speed 3.9, vision 18 (+3 from the Veil trait), 95 damage every 4.5 s (21.1 dps), range 18, `mechanical_bonus: 0.3`, `building_bonus: 0.4`, `cloak: true` (the existing Veil re-cloak after 3 s without firing, `sim/traits.js`), class `ranged`, cost [150, 60], pop 2, time 18 s, `workshop: "veil"`, `roster: "expanded"`, `required_level: 2`. Tuning range if a gate misses: damage 85 to 100, HP 75 to 90, range 17 to 18.
- **Target preference** `prefers: ["support", "antiarmor", "ranged"]`: data only, through the W0-B seam. Two shots kill a Medic (75 HP + 30 shield) or a Ranger (95 + 25).
- **Ability Steady aim** (module `src/sim/content/marksman.js`): +3 m range and `pierce: 1` for 8 s through the existing pierce path (`combat.js` calls `garrisonPierce` when `e.pierce` is set), cooldown 35 s, `icon: "crosshair"`, `tint: [0.84, 0.56, 1]`. Autocast when a preferred target is within range + 3. Shot tagged `"pierce"` while active.
- **AI data:** `ai: { role: "back", want: [{ if: { seenSupport: 2 }, n: 2 }, { if: { seenAntiarmor: 3 }, n: 2 }, { if: { after: 600 }, n: 1 }], max: 3 }`.
- **Intro line:** `intro: "Stalker: a hidden sniper that shoots healers and anti-tank teams first. Kites, towers and anything within 4 m reveal it."`
- **Look:** append `weapons.stalker`: a long-life, thin violet-white trail (W2-E gives it a beam kind).
- **Ability UI from data** (moved from W0-A; so new units need no edits to shared UI tables). Today an unknown ability already renders safely (`tactics-card.js:16` uses `ABILITY_ICONS[id] || "bolt"`, `ability-hints.js:32` puts it last), so W1-B's Crossfire works with the bolt icon until this merges.
  - `src/tactics-ui.js`: icon `a.icon ?? ABILITY_ICONS[id]`, aimed `a.aimed ?? AIMED.has(id)`, order `a.order ?? ABILITY_ORDER.indexOf(id)`.
  - `src/tactics-card.js` and `src/ability-hints.js` use those helpers instead of the tables.
  - `src/tactics-view.js`: buff ring tint `BUFF_TINT[id] ?? <the unit's ability>.tint ?? GOLD`.
  - `src/fx.js` (the ability flash table at line 542 only): falls back to the casting unit's `ability.tint`.
  - Today's 12 abilities keep their exact icons, order and tints.

**Files owned.** New: `src/sim/content/marksman.js`, `tools/blender/generate_stalker.py`, `public/models/stalker.glb`, `tests/stalker.test.js`, `tests/golden-w1c.test.js`. Existing (ability UI): `src/tactics-ui.js`, `src/tactics-card.js`, `src/ability-hints.js`, `src/tactics-view.js`, `src/fx.js` (one table line), `tests/tactics-ui.test.js`.

**Shared append-only.** `balance.json`, `vi.json`, `manifest.json`, `src/sim/content/index.js`, `src/visual-style.json` (`weapons`), `tests/render-budget.mjs`, `docs/BALANCE.md`, `docs/CHANGELOG.md`.

**Art.** `stalker.glb`: violet hood and cloak, a long barrel with a bipod, a green lens, `Team` trim, leg pivots. At most 3,000 triangles.

**Tests.** At least 12: preference order with ties by distance; a Medic is chosen over a nearer Vanguard; two shots kill a Medic; re-cloak 3 s after firing; a Kite at 8 m reveals it; Steady aim gives range and pierce and reverts with no `pierce` key left; a save mid-cloak and mid-buff reloads to an identical hash; units without `prefers` are unchanged; ability-UI fallbacks with a fixture ability (icon, aimed, order, tint); today's 12 abilities unchanged.

**Acceptance.**
- Duels with `tests/lib/duel.mjs`, Veil Stalkers against Meridian, 10 battles each (section 2.6): against the heal-ball (6 Rangers and 2 Medics, equal cost) a mean of +0.15 or more, at least 7 of 10 won, and the Medics die before 2 Rangers in at least 6 of 10; against Vanguard and Shade packs a mean of -0.2 or lower. Riders are recorded, not gated (they have no counter against class `ranged`).
- A lone Stalker needs about 85 s per tower (×0.4): record it.
- `stalker-battle-eco`: 125 draws or fewer.
- `golden-w1c.test.js`: a scripted sandbox (`ai: false`, Veil Stalkers against a heal-ball, hashes at 30 and 60 s, one Steady aim cast).
- The `abilities` and `tactics-ui` suites green; golden pins and baselines identical. Test count +12 or more.

**Risks.** Out-ranging towers (18 m against 13 m) is bounded by ×0.4 against buildings. Cloak only works for Veil teams by design. The heal-ball result moves with the layout: the gate is the mean of 10, never one layout.

#### W1-D · Phones first-class

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4235 | P1, P3 (unit scale and the 28 px rule), unit intro cards (new) | M+S | `3d_astra-r2-w1d`, `r2/w1d-phones` | W0-A (plugins) |

**Player-facing result.** On a phone the battle fills at least 70% of the screen in portrait and landscape. The dock collapses to its tab strip when nothing is selected, the touch row becomes Army, Workers and "…", dialogue is a one-line chip, hints sit in the dock band, and the Eco badge is gone. At strategic zoom units grow, so armies stay readable. The first time you meet a new unit with a special rule, a one-line card explains it.

**Design.**
- **P1, five points** (phones only; desktop layout unchanged):
  1. The dock collapses to its 56 px tab strip when nothing is selected.
  2. The 7-button touch row (`#select-workers`, `#select-army`, `#box-select`, `#queue-orders`, `#clear-selection`, `#zoom-in`, `#zoom-out` in `src/app/shell.js`) becomes Army, Workers and a "…" sheet (Box select, Queue, Clear). +/- are hidden on phones: pinch already zooms. **Every one of the 7 ids stays in the DOM with its element type and `data-*` attributes**: Box select, Queue and Clear move into the "…" sheet, and +/- are hidden with CSS, not removed. Their handlers live in files W1-D does not own (`input-pointer.js:330-353`, `selection.js:84-105`, `match-flow.js:113-114`, `input-keyboard.js:46`) and must keep working unchanged; `tests/phones.mjs` clicks each id once.
  3. Dialogue shows as a one-line chip at the bottom left that expands on tap and clears when a scene starts (`src/mission-ui.js`).
  4. The fight and counter hint (`#fight-hint`, `src/app/ui-extras.js`) sits in the dock band.
  5. The Eco/High badge (`#quality`) is hidden on touch devices (CSS only).
- **Bottom-band contract with W1-F** (both work in parallel). In portrait the Defence bar sits at the foot of the battlefield, just above the dock (`defence-ui.css:82`). W1-F sets `--defence-bar-h` on `:root` (its height plus its 8 px gap) while the bar shows there, and leaves it unset otherwise. Every bottom-band element of W1-D (dialogue chip, hint, intro card) sets `bottom: calc(var(--dock-height) + var(--tabs-height) + var(--safe-bottom) + var(--defence-bar-h, 0px) + 8px)`. Story Defence missions (m02b, m07b, later m11c) show both: the integrator checks them with `elementFromPoint` after the merge.
- **P3, unit scale** (`src/army-readability-view.js`, view plugin `frameScaleFor`): view-only scale 1.0 at zoom 40, rising linearly to 1.6 at zoom 90 and above, for units only (not buildings or bosses, which W2-F scales). Collision radii and picking do not change. Group pips are round 3.
- **Unit intro cards** (`src/unit-intros.js`, new; shown by `ui-extras.js`):
  - The first time ever that a unit type with `D[type].intro` is on screen (own or enemy), the hint slot shows its intro line (localised). Remembered in `localStorage` key `frontier-command.unit-intros.v1`, with try/catch like `ability-hints.js`.
  - It waits its turn behind other hints and never covers the dock or a decision.

**Files owned.** `src/app/shell.js`, `src/app/hud.js`, `src/app/command-card.js`, `src/touch-controls.js`, `src/mission-ui.js`, `src/mission-ui.css`, `src/app/ui-extras.js`, `src/ui-extras.css`, `src/mobile.css`, `src/landscape-hud.css`, `src/hud-readability.css`, `src/desktop-dock.css` (only if needed), `tests/ui-quality.mjs`, `tests/feel.mjs`, `tests/mobile.mjs`, `tests/mobile-controls.mjs`, `tests/mobile-gestures.mjs`, `tests/layout-f.mjs`, `tests/status-layout.mjs`, `tests/ui-extras.mjs`, `tests/touch-controls.test.js`, `tests/client-2026-11.test.js`, `tests/review-2026-10d-02.test.js`, `tests/mission-ui.test.js`; new `src/army-readability-view.js`, `src/unit-intros.js`, `tests/unit-intros.test.js`, `tests/phones.mjs`.

**Shared append-only.** `vi.json`, `src/view-plugins.js`, `package.json`, `pages.yml`, `docs/CHANGELOG.md`.

**Art.** None.

**Tests.**
- `tests/phones.mjs`: battlefield share by an `elementFromPoint` grid (20 × 40 points) at 390×844 and 844×390, in skirmish and in a campaign mission, with nothing selected and with one unit selected; each of the 7 touch-row ids still works; with `--defence-bar-h: 64px` set by hand, the chip and hint sit above it.
- `tests/feel.mjs`: the 28 px rule extended to 844×390.
- `tests/unit-intros.test.js`: shown once per type, persisted, storage failures ignored (fixture definition with `intro`).
- The mobile, mobile-controls, mobile-gestures, ui-quality, status-layout, ui-extras and layout-f (portrait, landscape, landscape-vi, portrait-vi) suites updated where they assert the old layout.

**Acceptance.**
- Battlefield share at least 70% at 390×844 and at 844×390 with nothing selected, and at least 60% with a unit selected (today 50% and 53%).
- The 11 px and 44 px audit passes on 1440×900, 390×844 and 844×390, with no sideways scroll. Desktop layout groups unchanged.
- On Three Roads at zoom 92 a tank is at least 14 px tall on a phone (today 7 to 10).
- Every render scenario within ±1 draw of its baseline.
- Golden pins identical (view only).

**Risks.** Layout suites expecting the old layout: this package owns them and updates their expectations, with the 70% figure as the gate. Defence screens are W1-F's; the integrator measures the Defence share after the merge.

#### W1-E · Boss engine II and the Iron Sovereign

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4236 | C1 slice 1 (no flying bosses, no `shieldedBy`, no team-0 boss), D8 engine part, one port | M | `3d_astra-r2-w1e`, `r2/w1e-boss-engine` | W0-B (statuses) |

Scope note: the Atlas Launcher port, `tools/boss-size.mjs` and both Heroic boss finales moved to round 3's first slice ("Boss Roads I", section 6). This package and W2-B each had more than one session of work; the engine and one boss are a working, tested first slice.

**Player-facing result.** The engine for walking road bosses, and the first new boss from the owner's Tank_game_3D: the **Iron Sovereign**, a six-legged siege fortress that stomps the strongest tower and stuns it, fires a three-shell spread, marches down a Defence road and stops to fight. Players meet it in round 3's Heroic finale on Three Roads; this round it is playable in the test sandbox and the render scenarios.

**Design** (all optional fields; the Iron Vanguard's data and path stay as they are).
- **Engine** (`src/sim/bosses.js`):
  - `attacks[].count` and `spread`: N zones at once, each with its own warning, each at least `warningSeconds`. Zones of one attack never overlap (`spread ≥ 2 × radius + 0.5`), and a unit takes at most 36 damage from one attack in total (30% of a Ranger's 120). A unit test sums it.
  - `target: "building"`: the highest-tier tower in range, then the most expensive; with no building in reach, the biggest unit group (today's `bossAim` pick).
  - `stun: { seconds }`: buildings in the zone get status `stunned` (`noFire`, `icon: "stun"`), registered by a new module `src/sim/content/boss-status.js`.
  - `strafe: { distance }`: a sideways step between attacks, checked with `nav.canStand`.
  - **Route mode:** a boss whose first order is a Defence `route` wakes at once, ignores its leash, walks with `this.stepRoute(e, o, dt)` (so blockers hold it, like any column) and stops to attack while a target is in reach. The boss still returns early in `stepEntity` (`simulation.js:322`), so `stepRoute` runs only when the boss calls it.
  - **Break the attack:** `break: { share }` on the boss: damage taken during a warning of at least `share` × (max HP + max shield) cancels that attack and opens the core for 6 s. A reward, never required. A fixed 600 would fire almost every cycle in Defence (10 tier-2 and tier-3 towers deal about 200 effective dps through ×0.65 armour, about 600 in a 3 s warning), so it is a share: start at 0.08 (about 984 for the Sovereign) and tune it in 0.05 to 0.15 so that 10 tier-2 and tier-3 towers on d-crossroads break 25 to 60% of its attacks in the route sandbox. Record the rate.
  - `drops: [{ at: 0.667, type, n }, ...]` at health stages: units spawn beside the boss; in Defence with `spawnOnRoute`, so they walk the boss's road. The model roster for drops is round 3's (the boss is in no playable content yet); the render harness preloads drop types (W0-A).
  - `boss-ui.js` and `boss-view.js` become generic: a parts table per boss id (legs, turret, launchers, light gun, core), the bar for any boss, its Defence placement on phones (`boss-ui.css`).
- **Defence seams** (`src/sim/defence.js`, behaviour-neutral):
  - Leak cost: `const cost = e.leak_lives ?? ((e.pop || 1) >= 3 ? 2 : 1)`.
  - `spawnOnRoute(type, team, routeId, leg, at)`: spawns a unit at `at` with a normal route order from that leg.
  - Boss groups spawn exactly the listed count: in `waveUnits`, `D[type].boss ? n : waveCount(...)` (today `waveCount` could make 2 on Veteran).
- **Definition** (Defence Standard scale; the campaign scales later with mission `hp`; the HP is the D8 estimate, sized with the bot in round 3):

  | Boss | Definition | Attacks |
  |---|---|---|
  | `ironsovereign` | 12,000 HP, 300 shield, speed 1.2, a 10-damage light gun, `leak_lives: 10`, `defence_tuned: true`, `break: { share: 0.08 }` | **Stomp**: one 5 m circle on the best tower within 14 m, 1 round of 30 (units), buildings ×5 (150), stun 4 s. **Three-shell spread**: 3 circles of 3.5 m, `spread` 7.5 m, 3 rounds of 10. Strafe 4 m. Drops 4 Drones at 2/3 and 1/3. |

**Port.** `tools/port-boss-model.mjs` gains `--parts <map.json>` and a palette per boss. `ironsovereign.glb` from `boss-walker.glb` (1,904 triangles; `Leg0L` to `Leg2R`, `Chassis`, `Cannon`, `LightGun`, `Core`), at or under 2,800 triangles (1.25 × the Iron Vanguard's 2,228) and about 7 draws on screen. `ironvanguard.glb` stays byte-identical. The parts-map format is documented in `docs/aaa/BOSSES.md` so round 3 ports the Atlas with data only.

**Files owned.** `src/sim/bosses.js`, `src/sim/defence.js` (the three seams only), `src/boss-view.js`, `src/boss-ui.js`, `src/boss-ui.css`, `tools/port-boss-model.mjs`, `tests/bosses.test.js`, `tests/boss.mjs`, `tests/defence-intel.test.js`, `tests/assets.test.js` (only if the six-legged model needs a contract exception), `tests/story-scenes.test.js` (reads `sim/defence.js`), `docs/aaa/BOSSES.md`; new `src/sim/content/boss-status.js`, `tests/boss-engine.test.js`, `tests/boss-route.test.js`, `tests/golden-w1e.test.js`, `public/models/ironsovereign.glb`.

**Shared append-only.** `balance.json` (1 definition, 1 `bosses` entry), `vi.json`, `manifest.json`, `src/sim/content/index.js`, `tests/render-budget.mjs`, `package.json`, `pages.yml` (only if a new suite), `docs/BALANCE.md`, `docs/CHANGELOG.md`.

**Tests.** At least 15: multi-zone warnings each at least the walk-out; the 36 cap summed per unit; building target picks the top tier; a stunned tower is silent for exactly 4 s; strafe stays on the nav grid; the route walk is deterministic and stops and resumes; a leak costs 10 lives; break-the-attack at the share, and not below it; drops at 2/3 and 1/3 walk the route; a save mid-warning and mid-route reloads to an identical hash; no boss state in a match without a boss; a carrier still costs 2 lives (existing test).

**Acceptance.**
- m03 unchanged: the golden m03 pin, `check:missions --only m03-the-ashen-line` (3 difficulties) and the existing `bosses.test.js` all identical.
- `check:defence --json` identical (no designed level has a boss).
- Sandbox on Standard (field fight, no towers): **6 Rangers and 2 Breakers** (about 110 raw dps, about 115 s against 12,300 HP and shield before any losses) kill the Sovereign in 90 to 200 s, and at least 3 of the 8 survive. Record the 12 Rangers and 4 Breakers time too (expected about 50 to 110 s: 219 raw dps × about 0.96 for armour and the exposed cycle against 12,300 HP and shield, which matches m03's note that 32,000 HP takes about 2 minutes for 24 to 27 units).
- Route sandbox on d-crossroads (the Sovereign alone on a road, 10 towers at tiers 2 and 3): it walks, stops to attack, resumes, and the break rate is recorded.
- `boss-sovereign-eco` (phone, 60 units and the Sovereign): 120 draws or fewer. `defence-boss-eco` (d-gorge, the Sovereign on the road, 10 towers, a 60-unit wave): 125 or fewer.
- Boss bar labels at least 11 px at 390×844.
- `golden-w1e.test.js`: the field sandbox and the route sandbox hashes at 30 and 90 s.

**Risks.** Node names differ from the quad-mech: the parts map is data, and a missing part only loses its animation. The break share may need its whole range: record the measured rate either way.

#### W1-F · Defence command deck

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4237 | D2, D3, D4, the Defence part of P3 (phone framing) | 3×S + S | `3d_astra-r2-w1f`, `r2/w1f-defence-deck` | W0-B (`aim` seam, commands) |

**Player-facing result.**
- Fast-forward ×2 (×3 on PC) with a 44 px toggle and **Shift+Space** (Space pauses).
- A targeting button on every tower: Nearest, First, Strongest, Air.
- Trait chips on the wave strip (armoured, flying, cloaked, healer, carrier, heavy shield, elite, boss).
- A Kingdom Rush-style card the first time an enemy type appears, with its traits and 2 crews that counter it.
- Tower stats as text on phones: dps, range, ×vs armour, hits air, next-tier deltas.
- On phones Defence opens at road zoom and follows the wave front; the Defence bar is compact.

**Design.**
- **D2** (`src/app/frame.js`, `src/governor.js`): `S.accumulator += dt * speed`, where `speed` is 1, 2 or 3 (3 only on a fine pointer). At most 6 ticks per frame. Defence matches only (`sim.defence`), including the story Defence missions. Scenes and decisions force ×1. On a touch device whose frame time stays over budget for 2 s, the governor drops to ×1 with a toast. The sim still ticks at 0.05 s, so hashes per tick are identical.
  - **State:** module-local in `frame.js` (`let speed = 1`, exported `setSpeed`/`getSpeed`), reset to 1 when a match starts. Not in `app/state.js` (W1-A's this wave).
  - **Key: Shift+Space.** Every letter is taken: `src/hotkeys.json` holds most, and `G` toggles the grid overlay in `src/app/input-keyboard.js:92` (not in `hotkeys.json`; it stays as it is). The Space branch (`input-keyboard.js:72`) checks `e.shiftKey && S.sim?.defence` first and cycles the speed instead of pausing. A `speed` entry with key `Shift+Space` is added to `hotkeys.json` for the help list.
- **D3** (new module `src/sim/content/tower-aim.js`): command `padAim { building, aim }` with `aim` in `near` (today's rule), `first` (most route progress, from the route order's leg and fraction), `strong` (most HP plus shield), `air` (flyers first; offered only to crews that hit air). Units still rank before Harvesters and buildings, with the same range, height, visibility and clear-line checks as `defenseTarget`. `e.aim` exists only once changed. The DefenceBot never sends it.
- **D4** (`src/app/defence-ui.js`, new append-only `src/defence/traits.js`):
  - `traits.js` exports `[{ id, label, test(entry, D) }]` chip predicates: armoured (`mechanical`), flying, cloaked (`cloak`), healer (`heals`), carrier, heavy shield (shield ≥ 100), elite (`entry.elite`), boss (`D[type].boss`). Chips are 12 px.
  - New-enemy card: the first time a type appears in a wave (`progress.seen`, added to the Defence progress only once something is recorded), a card shows its traits and 2 counter crews (a small table in `traits.js`, for example armoured → antitank, tank; flying → ranger, antitank; cloaked → watcher). It closes after 6 s or on a tap and never covers the dock or a decision.
  - Tower sheet: dps, range, ×vs armour, hits air (yes or no) and the next tier's deltas, as text, read from `garrisonStats`.
- **Phone framing:** on phones Defence opens at zoom `min(cam.zoom, 55)` over the first spawn and follows the wave (pans to the front of the leading units; pauses 6 s after a manual pan).
- **The Defence bar on phones** (one row, at most 56 px tall in portrait). Today it holds 6 controls on Three Roads (lives, wave, commander, armour, call, overview: `defence-ui.js:314-319`). This package adds one, not two:
  - The Overview button becomes a **view** button that cycles Follow → Overview → Free (default Follow on phones, Free on desktop), so "Follow wave" needs no button of its own.
  - The speed toggle is the seventh control.
  - On phones the wave chip drops its "Wave" word (the number stays, with its title text) and the Call button keeps its icon only (as today at 420 px and below).
  - Width check at 390×844: 2 chips of about 50 and 60 px, 5 buttons of 44 px, 6 gaps of 4 px and 6 px of padding come to about 360 px, right at the 358 px a 390 px screen leaves inside its 16 px gutters (gaps of 3 px give 354 px). If the measured bar does not fit in 358 px, the speed toggle moves into the pause sheet instead and the bar keeps 6 controls; record which one shipped.
  - While the bar sits at the foot of a portrait phone screen, set `--defence-bar-h` on `:root` (bottom-band contract with W1-D, section W1-D).

**Files owned.** `src/app/frame.js`, `src/governor.js`, `src/app/defence-ui.js`, `src/defence-ui.css`, `src/defence/progress.js`, `src/hotkeys.json`, `src/app/input-keyboard.js`, `tests/defence.mjs`, `tests/defence-progress.test.js`, `tests/hotkeys.mjs`, `tests/review-2026-10-02.test.js`, `tests/review-2026-10b-01.test.js`, `tests/choices.test.js` (reads `frame.js`); new `src/sim/content/tower-aim.js`, `src/defence/traits.js`, `tests/defence-deck.test.js`, `tests/defence-deck.mjs`, `tests/golden-w1f.test.js`.

**Shared append-only.** `vi.json`, `src/sim/content/index.js`, `package.json`, `pages.yml`, `docs/CHANGELOG.md`.

**Art.** None.

**Tests.** At least 15.
- **Determinism through the real frame loop** (browser, in `tests/defence-deck.mjs`; a headless sim ignores client speed, so a unit test would prove nothing): play d-gorge at ×3 through `frame.js` with the Call button pressed twice until `sim.time` passes 60 s, then hold the clock; read the command log, the tick count and the hash; replay the same log headlessly to the same tick in Node: the hashes are equal. The same at ×2.
- Unit tests: scenes force ×1; the speed resets to 1 at a new match; the governor fallback with a mocked frame time; each aim mode picks the expected target in a fixture; `padAim` replays; no `aim` field without the command; each chip predicate; the new-enemy card shows once per type and the record persists; old Defence progress loads unchanged; Shift+Space cycles the speed in Defence and Space still pauses.
- `tests/defence-deck.mjs` (3 viewports): tower sheet readable at 390×844 with no hover, 11 px and 44 px audit, the 28 px unit rule in Defence at the new phone zoom, the view button cycles its 3 states, the bar width check above.

**Acceptance.**
- `check:defence --json` identical to the post-W0 baseline. Golden pins identical.
- `defence-big-eco` still 112 draws or fewer (speed does not change draws).
- The Defence bar at most 56 px tall in portrait on 390×844, no sideways scroll, every control at least 44 × 44 px.
- `golden-w1f.test.js`: a d-gorge playDefence run with `padAim` commands (`first` and `strong`), hashes at waves 3 and 6.
- Test count +15 or more.

**Risks.** Fast-forward stutter on phones: the tick cap and the governor guard it, and the ×1 = ×2 = ×3 hash test proves determinism. The combined Defence battlefield share (with W1-D's dock) is measured by the integrator.

#### Integration after Wave 1

Besides the standard steps (end of section 3):
- Expanded checks: Gunner and Stalker train at their hosts and levels (the Veil relay reaches level 2 through W1-A's host levelling); under the Classic AI with Expanded roster, both are fielded in at least half of 12 AI-against-AI matches longer than 8 minutes where their faction plays (bench `--rules '{"roster":"expanded"}'`). Record it; W2-A turns it into a test.
- Defence battlefield share on phones at least 70% (W1-D's dock plus W1-F's bar), measured with `tests/phones.mjs` in a Defence level.
- Story Defence layout: m02b at 390×844 with a dialogue line, a hint and the Defence bar showing: no overlap (`elementFromPoint` on each element's centre), every control reachable.
- Record `baseline/bench-expanded.json`.
- Record **`tests/golden-expanded.test.js`** (new, integrator, `GOLDEN_FULL`): Expanded AI-against-AI with real units on two faction-isolated setups, Meridian against Meridian (Gunners) and Veil against Veil (Stalkers), hashes at 300 and 600 s. Wave 2 touches neither faction's Expanded play (the Rampart is Ashfall, the drill Sunward), so the only pre-declared re-record is W2-A changing an economy field of `gunner`, `stalker` or `workshop`.
- Timing gates of Wave 1 (none are declared) and the build job time on 2 cores.

---

### Wave 2: more ways to fight, peaks and showtime (6 packages)

Merge order: W2-A, W2-D, W2-B, W2-E, W2-C, W2-F.

#### W2-A · Rampart ram tank, facing armour and the Outrider drill

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4232 | U6, M2 (Rampart only), U8 slice 1 (Riders, kiting only), Expanded integration and bench | M+S | `3d_astra-r2-w2a`, `r2/w2a-rampart` | Wave 1, W0-B's `fight` hook (H20) |

Scope note: the portrait re-render moved to round 3 to make room for U8, so that Sunward gets a new fighting style this round. Until then the four new types show no portrait, as the troop carrier does today (`portrait()` returns an empty string for a type outside `PORTRAIT_ORDER`, `src/portraits.js:14`).

**Player-facing result.**
- Ashfall's welded plough tank leads a Scrapper swarm head-on, shrugs off frontal fire, cracks walls and towers, and takes ×1.5 from behind. Flanking finally pays, and "REAR" hits show it.
- Under the Expanded roster, Sunward Riders fight as outriders: when a melee or flame unit closes to 4 m they step 3 m back and keep shooting. Hit-and-run cavalry with no kiting micro.

**Design.**
- **Definition `rampart`:** 650 HP, no shield (the Ashfall style; `tests/progression.test.js` allows it through `workshop === "ashfall"`), speed 3.0, 34 damage every 1.3 s at range 4, `building_bonus: 2`, mechanical, class `armor`, cost [250, 90], pop 4, time 28 s, `workshop: "ashfall"`, `roster: "expanded"`, `required_level: 3` (W1-A's host levelling raises the Salvage yard to 3), `shot: "tank"`.
- **Facing** (`src/sim/content/facing.js`, a `hitScale` hook on targets with `facing: { front: 0.6, rear: 1.5 }`): the dot product of the target's heading with the direction to the attacker; above 0.55 is front, below -0.55 is rear, otherwise ×1. Tags the shot `"front"` or `"rear"`. It applies to direct hits and splash, not to strikes or boss zones.
- **Wall bonus:** ×2 against `kind: "wall"` (a `hitScale` hook in `src/sim/content/rampart.js`).
- **Ability Ram** (registered ability, same module): speed ×2 for 2.5 s; the first contact deals 80 extra damage, once per cast. No push-back (shared-movement risk). Cooldown 30 s, `icon: "bolt"`. Autocast when an enemy building or a group of 3 or more is within 10 m.
- **AI data:** `ai: { role: "front", want: [{ if: { seenTowers: 1 }, n: 2 }, { if: { after: 480 }, n: 1 }], max: 2 }`.
- **Intro line:** `intro: "Rampart: tough from the front, weak from behind. Hit it from the side or rear."`
- **Outrider drill, slice 1** (U8; module `src/sim/content/outrider.js`, data in a new top-level `balance.json` key `outrider_drill: { faction: "sunward", types: ["rider"], near: 4, back: 3, every: 1.5, threat_range: 5 }`; existing definitions are not edited):
  - Applies only when `sim.ruleOn("roster") === "expanded"` and the unit's team plays Sunward, on Guard, Aggressive or an attack-move (never on Hold: Hold means hold).
  - Through the `fight` hook (H20): when a hostile ground unit whose `range` is at most `threat_range` (melee and flame: Vanguard, Scrapper, Shade, Scorcher) is within `near` m and the unit's last step is `every` s old, the Rider steps `back` m straight away from it. The step target is checked with `nav.canTraverse` (as `stepEvade` does, `sim/bosses.js:284`); if blocked it tries ±35°, and if both fail it fights as today. While stepping (at most 0.6 s) the hook returns `true` (it moves and does not fire), then normal fighting resumes.
  - State is a lazy `e.drill = { at }` on the Riders that have stepped, under Expanded only.
  - It is a passive behaviour, not an ability: the Rider keeps its one ability (Dash).
  - Slice 2 (round 3): Gliders, and `move_fire 0.6` (firing on the move), which needs a movement-path change.
- **Field guide** (`src/field-guide.js`, nobody else owns it in Wave 2): the Rider's page gains "Expanded roster: Outrider drill" with one line; the Rampart's page its facing rule.
- **Expanded integration test** (`tests/expanded-roster.test.js`): every workshop unit with a definition trains at its host and level under Expanded and is absent under Classic; the AI's `want` rules fire for each of the three units in fixture situations; the drill is inert under Classic and for non-Sunward teams.
- **Bench tuning, if needed:** only the economy fields of `gunner`, `stalker`, `workshop` and `rampart`, and the `outrider_drill` numbers (section 2.6). List each change, its reason and the pins it re-records (`golden-expanded` if a Meridian or Veil field changes).

**Files owned.** `src/field-guide.js`; the economy fields of the `gunner`, `stalker` and `workshop` blocks in `balance.json`; new `src/sim/content/facing.js`, `src/sim/content/rampart.js`, `src/sim/content/outrider.js`, `tools/blender/generate_rampart.py`, `public/models/rampart.glb`, `tests/rampart.test.js`, `tests/facing.test.js`, `tests/outrider.test.js`, `tests/expanded-roster.test.js`, `tests/golden-w2a.test.js`.

**Shared append-only.** `balance.json` (`rampart`, `outrider_drill`), `vi.json`, `manifest.json`, `src/sim/content/index.js`, `tests/render-budget.mjs`, `docs/BALANCE.md`, `docs/CHANGELOG.md`. Not `visual-style.json`: W2-E styles the Rampart.

**Art.** `rampart.glb`: a plough blade, side plates, exhaust stacks, rust-orange Ashfall paint, `Team` trim, `TurretRig` and `BarrelRig`. At most 6,300 triangles; no more materials than the Battle tank. The drill has no art (W2-E's dust wake covers Ram; the step reuses the walk).

**Tests.** At least 18: front, side and rear by geometry; an Anti-tank shot from behind deals 2.5× the frontal damage; units without `facing` unchanged; Ram's bonus once per cast; ×2 on walls; tags present; a save mid-Ram reloads to an identical hash; drill: steps away from a Scrapper at 4 m, not from a Ranger, not on Hold, never into water or a cliff (fixture next to the ford), at most once per 1.5 s, no step under Classic or for a Meridian Rider, a save mid-step reloads to an identical hash; the integration test above.

**Acceptance.**
- A Rampart hit only from the rear dies at least 1.8× faster than one hit only from the front.
- Drill duels (`tests/lib/duel.mjs`, Sunward Riders with `rules: { roster: "expanded" }` against the same duel without it, 10 battles): against Vanguard, Scrapper and Shade packs the mean rises by +0.25 or more; against Rangers it moves by no more than ±0.05. In a 600 s Expanded soak no Sunward Rider stalls (`e.stalled` above 3) more often than under Classic.
- Expanded round robin (`bench:factions --rules '{"roster":"expanded"}' --jobs 3`, 120 matches): no faction below 25% or above 75%, Ashfall at or above its Classic 40%, Sunward at or above its Classic 38%.
- Each workshop unit fielded in at least 50% of Expanded AI-against-AI matches longer than 8 minutes where its faction plays.
- `battle-expanded-full-eco` (Gunners, Stalkers and Ramparts, army 60): 150 draws or fewer.
- `golden-w2a.test.js`: a Rampart sandbox (flank fight with one Ram) and a drill sandbox (Expanded, Sunward Riders against Scrappers), hashes at 30 and 60 s.
- Classic baselines identical. Test count +18 or more.

**Risks.** AI-against-AI is often decided by the first fight at about 2 minutes, so a unit may rarely appear: the "fielded in matches over 8 minutes" rule measures it fairly. If a faction leaves the 25 to 75% band, tune only the economy fields and the drill numbers, and record it. Kiting is movement outside the order system, the kind of behaviour the owner watches for: the nav checks, the 1.5 s cadence and the stall soak bound it, and the whole drill sits behind the Expanded rule.

#### W2-B · Defence peaks: elites and Heroic challenges

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4233 | D6, D13 (Heroic, elite finales), Stalker columns in Heroic | M+M | `3d_astra-r2-w2b`, `r2/w2b-heroic` | Wave 1 (W1-E `spawnOnRoute`, W1-F chips, W1-C Stalker) |

Scope note: the two boss finales (Atlas on Gorge, Sovereign on Three Roads), the Atlas port and the boss sizing tool moved to round 3's first slice ("Boss Roads I"). Each `check:defence` pass takes about 100 s, and tuning 7 Heroic levels plus 2 boss fights did not fit one session. Heroic's spec keeps a `finale` slot per level so round 3 adds a boss with data only.

**Player-facing result.** Clearing a level opens its **Heroic** challenge: 6 hard waves with gold-ringed elites that change which crew is right, ending in an all-elite wave. On the two Veil levels, cloaked Stalker snipers walk with the columns and pick at your crews. 5 lives, fixed alloy, +1 star each, so stars rise from 21 to 28. The menu teases each finale before it opens.

**Design.**
- **Elites** (wave-group field `mods: { elite: "<affix>" }`; module `src/sim/content/elites.js`):
  - `startWave` copies `g.mods` into each queued spawn; `spawnQueued` applies them (lazy fields on the new unit only).
  - Every elite: ×1.6 HP, `e.elite = affix`, bounty ×3 (bounty line reads `e.bounty_x ?? 1`), a gold ring.
  - Six affixes:

    | Affix | Effect | Answered by |
    |---|---|---|
    | Plated | Shield ×2.5, recharges after 2 s | Pierce ranks, Anti-tank |
    | Swift | +35% speed, -20% HP | Suppressor slow |
    | Splitter | On death, 2 units of the vanguard slot of its group's faction (Scrapper for Ashfall, Shade for Veil, and so on, resolved like a wave slot) continue on its road (`spawnOnRoute`) | Cluster splash |
    | Volatile | On death, 40 damage within 2.5 m to towers and blockers | Rim pads, range |
    | Banner | Allies within 7 m take ×0.8 (a `taken` hook, refreshed every 0.5 s, does not stack) | Kill it first (Marksman) |
    | Mender | Heals allies within 7 m by 40 every 6 s (a `step` hook) | Barrage |

  - `wavePreview` entries for elite groups get their own key and an `elite` field (the W1-F chip reads it).
  - Append affix chips to `src/defence/traits.js`. Gold ring: `src/elite-view.js` (view plugin, one InstancedMesh, 1 draw, lazy).
  - **Models for what spawns later** (`src/model-roster.js`, owned here in Wave 2): today the roster declares only types named in wave groups (`model-roster.js:26`), so Splitter children would draw as `FallbackFlyer` wings on a level whose roster never names them (for example Shades on a Veil level whose waves list only tanks). Declare the child type of every Splitter group, and the `drops` of any boss a level names. A test asserts that every type a Heroic variant can spawn is declared.
- **Heroic** (`src/defence/heroic.js` with one spec per level; `defenceVariant(level, { variant: "heroic" })` in `src/defence/levels.js`; Heroic levels are new content, so they may carry new fields, while the designed levels get none):
  - Waves 5 to 10 of the designed level at Standard scale. In each wave the 2 largest groups get an affix from that level's table. Wave 6 is the finale: all-elite on all 7 levels. Each spec has an empty `finale` slot for round 3's bosses.
  - Affix tables: Gorge Plated, Swift; Bridges Swift, Volatile; Switchback Banner, Mender; Fordwood Splitter, Swift; Canyon Plated, Banner; Long Crossing Volatile, Splitter; Three Roads Mender, Plated, Banner.
  - **Stalker columns** on d-canyon and d-longcrossing (the two Veil levels): from Heroic wave 2, one group per wave adds 2 to 3 `stalker`. They cloak (Veil trait) and are revealed by pad towers within 9 m (`reveal_building`), by anything within 4 m, and for 3 s after each shot. The new-enemy card (W1-F) introduces them; the "cloaked" chip names the Watcher crew. Tune their count only.
  - Lives 5, fixed starting alloy (Standard alloy + 400, then tuned per level), no early-call bonus.
  - Opens after the first clear of that level. A "Heroic" tab in `src/app/defence-entry.js` beside Levels, Endless and Daily, showing a locked teaser of the finale.
  - `src/defence/progress.js` records `heroic: { [levelId]: { won, lives } }`, added only once something is recorded. `totalStars` counts +1 per Heroic win. A Heroic badge in the result (`src/app/defence-ui.js` `result()`).
- **Checks** (`tools/defence-check.mjs`): Heroic rows (bot wins, passive loses, single-crew greedy) behind a new `--heroic` flag, so the build job's `check:defence` stays as it is (section 2.10). Script `test:defence-heroic-check` and a matrix entry `r2-w2b` run them in CI. Add `--jobs` if the Heroic run passes 4 minutes. `tools/defence-bot.mjs` only if the bot must see cloaked Stalkers differently (it must not change for designed levels).

**Files owned.** `src/sim/defence.js`, `src/defence/levels.js`, `src/app/defence-entry.js`, `src/app/defence-ui.js`, `src/defence-menu.css`, `src/defence-ui.css`, `src/defence/progress.js`, `src/model-roster.js`, `tools/defence-check.mjs`, `tools/defence-bot.mjs`, `tests/defence.mjs`, `tests/defence-data.test.js`, `tests/defence-progress.test.js`, `tests/defence-intel.test.js`, `tests/defence-complete.test.js`, `tests/model-roster.test.js`; new `src/sim/content/elites.js`, `src/elite-view.js`, `src/defence/heroic.js`, `tests/elites.test.js`, `tests/defence-heroic.test.js`, `tests/defence-heroic.mjs`, `tests/golden-w2b.test.js`.

**Shared append-only.** `balance.json` (`elites` top-level key), `vi.json`, `src/view-plugins.js`, `src/sim/content/index.js`, `src/defence/traits.js`, `tests/render-budget.mjs`, `package.json`, `pages.yml`, `docs/MISSIONS.md` ("Heroic challenges"), `docs/CHANGELOG.md`.

**Art.** None (the ring is generated; the Stalker model is W1-C's).

**Tests.** At least 15: one rules test per affix; Splitter children keep the road and are their group faction's vanguard-slot type; Banner does not stack; designed levels contain no `mods` and no new field (a data test); Heroic is built deterministically; every type a Heroic variant can spawn is declared by the model roster; star accounting; old progress loads; a save mid-elite reloads to an identical hash; `tests/defence-heroic.mjs` (3 viewports): the Heroic tab, the teaser, the result badge, 11 px and 44 px.

**Acceptance.**
- Designed levels and Endless: `check:defence --json` identical to the post-Wave-1 baseline (the Heroic rows run only with `--heroic`).
- Heroic on Standard: the bot wins 7 of 7 with at least 2 of 5 lives left; a passive player loses by wave 3; a greedy single-crew player loses on at least 5 of 7 levels.
- `defence-heroic-eco` (d-longcrossing Heroic wave 6, elites, Stalkers and the gold rings): 125 draws or fewer.
- `golden-w2b.test.js`: Heroic playDefence on d-gorge and d-longcrossing (final hash, lives, stars); `GOLDEN_FULL`: all 7.
- The CI build job at 7 minutes or less on 2 cores (section 2.10).
- Test count +15 or more.

**Risks.** Bot tuning takes iterations: tune only Heroic alloy, affix counts and Stalker counts, never designed waves or the bot's play on designed levels. Order of work: elites, then Heroic on all 7 levels, then the Stalker columns. If the Stalker columns break the bot target after 2 passes, ship those two levels without them and list it.

#### W2-C · First impression and story light

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4234 | P12 (trimmed: no diorama, no UI sounds), P9, C3 | M+S+S | `3d_astra-r2-w2c`, `r2/w2c-first-impression` | Wave 1 |

**Player-facing result.** The game opens on a FRONTIER COMMAND wordmark and emblem in warm display type (English and Vietnamese), over the key art, with three big choices (Campaign, Skirmish, Frontier Defence) and buttons that press. Every battle looks warmer and more saturated, armies carry a team-coloured rim, and the Ashen fog lifts from near-black. Mission 8 "night 38" and the Night Count Chronicle play at night; mission 10 "Obsidian Storm" and the last 4 minutes of mission 6 have a storm with lightning.

**Design.**
- **Brand (P12, trimmed).**
  - A wordmark SVG (`src/art/wordmark.svg`).
  - One self-hosted OFL display font (Baloo 2 recommended, decision O7), subset to woff2 of 60 KB or less with Vietnamese glyphs, in **`src/fonts/`**, declared with `@font-face` in `src/ui-theme.css` (a relative `url()`, so vite hashes it and the service-worker precache carries it; `public/` files are neither hashed nor precached, `vite.config.js:16`), exposed as `--font-display` and used for headings only. `font-display: swap`. Body text and tiles keep today's stacks (CI font-width risk). No `system-ui`.
  - Title layout in `src/app/shell.js` and `src/app/screens.js`: the three choices as large cards, the setup form in a sheet, pressed and hover states (`src/start-screen.css`, `src/ui-theme.css`). Keep W1-A's Battle rules row mounted.
- **P9 grade and rim** (no extra pass, 0 draws).
  - New `src/look-grade.json` (per theme: saturation +12%, warm shadows, a soft S-curve) applied by new `src/look-grade.js` as a `CustomToneMapping` chunk set up from `src/view.js`.
  - A Fresnel rim term in `bakedMaterial()` (`src/view.js:107`), tinted by the instance team colour, on **every tier**: strength 0.35 on High and 0.25 on Eco. Phones default to Eco (pixel ratio 1, no shadows), so a High-only rim would leave the default phone look without it. It is one term in the existing shader (0 draws); the SwiftShader frame gate below covers its cost.
  - Fog override for `classic` from `#190f24` to about `#3a2a4a`, set in `look-grade.json` and applied in `view.js` `tintFog` (`src/visual-style.json` is W2-E's this wave; do not edit it).
  - The "Balanced" render tier (P2) is not in this round: it needs a shadow-map path, a governor step-down and two new budget scenarios, `view.js` has no other owner this wave, and this package is full. It is round 3's first presentation item; the rim and grade on Eco carry the phone look until then.
- **C3 mission looks** (new `src/mission-looks.js`, read by `src/environment-view.js` and `src/view.js`).
  - A table keyed by mission, Chronicle or level id: `night` for m08 and cv1 (very dark blue sky, black-blue water, moonlight, brighter team glows and lamps: the owner's night bar), `storm` for m10 and for m06 from 16:00 (dark clouds, lightning as a sky and light flash on a schedule from `sim.time`, no new meshes). New content may carry its own `look` field instead (the table wins for existing ids). Existing missions, Chronicles and levels get **no** `look` field: it would sit in `missionDef` and move their checksums (section 2.5).
  - Eco gets only a palette swap, no new lights.

**Files owned.** `src/app/shell.js`, `src/app/screens.js`, `src/app/briefing.js`, `src/start-screen.css`, `src/ui-theme.css`, `index.html`, `src/view.js`, `src/environment-view.js`, `tests/screens.test.js`, `tests/review-2026-10d-05.test.js`, `tests/review-2026-10d-07.test.js`, `tests/player-faction.test.js`; new `src/fonts/*`, `src/art/wordmark.svg`, `src/look-grade.js`, `src/look-grade.json`, `src/mission-looks.js`, `tests/look-grade.test.js`, `tests/mission-looks.test.js`, `tests/title.mjs`, `tests/night.mjs`.

**Shared append-only.** `vi.json`, `package.json`, `pages.yml`, `tests/render-budget.mjs` (`night-battle-eco`), `docs/CHANGELOG.md`.

**Art.** Wordmark and font only. Before and after screenshots of 4 themes, m08, m10 and d-gorge go in the results folder.

**Tests.** Title on 3 viewports: no text under 11 px, taps at least 44 px, no sideways scroll, `document.fonts.check` passes for the display font, no `system-ui`. The built service worker's precache list contains the font's hashed file, and the title renders with the display font offline (the `offline` suite). Look table entries exist; Eco adds no light; m08 sky luminance under a threshold; the grade chunk compiles on SwiftShader; the rim is on in Eco and High.

**Acceptance.**
- `tools/first-visit.mjs`: +80 KB or less.
- Every render-budget scenario has identical p95 draws (grade and rim add 0). `night-battle-eco`: 120 or fewer.
- The SwiftShader start-scene frame and the `battle-eco` frame within +10% of the baseline (rim on Eco included; the integrator confirms on a quiet machine).
- The 13 mission checksums and `check:missions --only m06-copper-harvest,m08-the-quiet-vault,m10-obsidian-storm` identical.
- Screenshots in the results folder for the owner's taste review (O7).

**Risks.** Night hurts readability: team glows stay bright and W1-D's unit scale helps; the owner reviews the screenshots. The grade is one JSON table, so the owner can tune it without code.

#### W2-D · Field command AI plan (opt-in)

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4235 | S1, S2, S6 (inside a new opt-in plan) | 3×S | `3d_astra-r2-w2d`, `r2/w2d-field-command` | Wave 1 (real Gunner and Stalker; Rampart by fixture) |

**Player-facing result.** A new Battle rule, "AI plan: Classic / Field command". A Field command opponent builds Tanks, Walkers and flyers, spends its energy, builds and uses its workshop units, defends every core and ring, and uses abilities with intent (Barrage on clumps, Shield wall against siege, and so on). Classic stays the default until the owner decides (O2).

**Design** (every path gated by `this.ruleOn("aiPlan") === "field" && !this.mission`; Classic code paths unchanged).
- **S1, spend what it earns** (`sim/ai-counter.js`, `sim/economy.js`, `sim/ai.js`):
  - `counterChoice` keeps the heavy slot (Tank or the faction's swap) unless the enemy has 2 or more towers or more than 60% infantry; Breakers only while they number fewer than Tanks + 2.
  - Harvesters: 1 in 6 to energy when energy is above 400 and alloy below 200; 1 in 3 when energy is below 100 (today always 1 in 4, `economy.js:238`).
  - Above 500 energy, the Barracks holds alloy for the Foundry upgrade and the next energy-heavy unit (Tank, Walker, Hawk, Balloon).
- **S2, defend every core and ring** (`sim/ai.js`, `sim/expand.js`, `sim/points.js`): a threat list per complete core (each with its own `defendRadius`) and per held ring; the nearest home or point-duty group answers each threat.
- **S6, smart casts** (new module `src/sim/content/ai-casts.js`, `autocast` for AI teams only):
  - Barrage and Burn line aim at the densest cluster (reuse `bossAim`'s pick);
  - Shield wall when a siege unit targets the Vanguard;
  - Lock-on when a vehicle is within range + 3;
  - Overdrive to chase, or to escape below 35% health;
  - Brace when 3 or more enemies approach;
  - Triage when 2 or more allies are below 60%.
- **Roles** (new module `src/sim/content/field-command.js`, `aiRules`): units with `ai.role` take their place: `front` leads the attack group, `back` holds 6 to 8 m behind the army centre, `line` holds with the main group.
- **Setup:** append the `aiPlan` option (Classic, Field command) to `src/app/rule-options.js`, with a one-line help text.
- **Workshop units:** W1-A's host levelling and training already serve Field command; edit `src/sim/content/workshops.js` only for placement by `ai.role`, behind the rule.

**Files owned.** `src/sim/ai.js`, `src/sim/ai-counter.js`, `src/sim/ai-attack.js`, `src/sim/economy.js`, `src/sim/expand.js`, `src/sim/points.js`, `src/ai-plan.js`, `src/sim/content/workshops.js` (AI part, only if needed), `tests/ai-attack.test.js`, `tests/ai-economy.test.js`, `tests/ai-plan.test.js`, `tests/ai-rules-091.test.js`, `tests/ai-soak.test.js`, `tests/expansion.test.js`, `tests/opponents.test.js`; new `src/sim/content/ai-casts.js`, `src/sim/content/field-command.js`, `tests/field-command.test.js`, `tests/golden-w2d.test.js`.

**Shared append-only.** `src/app/rule-options.js`, `balance.json` (`ai_plans` key if you need tables), `vi.json`, `src/sim/content/index.js`, `docs/BALANCE.md` (section "Field command"), `docs/CHANGELOG.md`.

**Art.** None.

**Tests.** At least 10: a Normal Field command AI against a turtling PlayBot fields at least 1 Tank or Walker by 600 s (4 factions × 2 maps); 6 Rangers hitting a Highlands expansion draw at least 4 defenders within 15 s; Barrage lands on at least 3 enemies on average; each cast rule in a fixture; Classic is inert (hashes identical with the rule absent).

**Acceptance.**
- Classic: `bench-classic.json`, the golden pins and `check:missions` identical.
- Field command, 12 bench matches (3 maps × Normal and Fast × 2 seats): a Tank or Walker by 600 s in at least 10 of 12; median unspent energy at 900 s below 600 (today 1,000 to 3,000); at least 5 distinct combat types by 900 s in at least 10 of 12 with the Classic roster, and at least 6 with the Expanded roster.
- A Field command round robin and a Field command plus Expanded round robin recorded (120 matches each, `--jobs 3`).
- PlayBot win rate against Field command at Normal measured and recorded (target band 35 to 75%; outside it, report for O2 and do not tune Classic).
- AI think p99 at 7.5 ms or less on desktop (today 7.1), measured with `tools/perf-ab.mjs` (interleaved, median of 7) and confirmed by the integrator on a quiet machine.
- `golden-w2d.test.js`: Field command AI-against-AI with the Classic roster, Meridian against Ashfall, hashes at 180 s (`GOLDEN_FULL`: 600 s).

**Risks.** The combined Field command and Rampart behaviour is first seen at integration: the integrator runs the combined table. Every behaviour sits behind the rule check.

#### W2-E · Battle feel: weapon looks and counter hits

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4236 | P4, P5 (without the health-bar gold flash) | M+S | `3d_astra-r2-w2e`, `r2/w2e-battle-feel` | W0-B (shot `unit`), Wave 1 (shot tags from W1-B), contract with W2-A |

**Player-facing result.**
- Scorchers spray flame cones and embers; Shades flash white-violet beams; Drones fire twin blue pulses; Scrappers spit 3-pellet sparks; Hawks launch pod rockets with smoke; Gliders drop bombs; Riders fire twin tracers; Vanguards fire 3-round bursts; Walkers fire twin heavy rounds; Watchers fire a green rail; Balloons drop fire bombs; the Iron Vanguard hoses heavy orange shoulder tracers.
- Gunners get a true machine-gun stream, Stalkers a violet beam, the Rampart a short plough cannon with a dust wake; the Sovereign's light gun gets its own look.
- Shared weapons carry faction tints (Veil green, Ashfall orange, Wardens blue, Sunward dust).
- Ability moments: Brace shockwave, decloak shimmer, Rush and Ram dust wake, Overdrive exhaust, Crossfire muzzle storm, Steady aim glint.
- Counter hits flare gold with a crisp "crit" sound; resisted hits puff grey. Damage numbers for bosses and Defence (a setting), with REAR, PINNED and PIERCE tags.

**Design.**
- New `src/fx-kinds/` (a registry plus one file per kind) used by `fx.shot()` and `fx.hit()`. Every kind draws from the existing pools: fx stays at 4 draws (`tests/fx-buffers.test.js`). **Every kind takes its random numbers from an injected `rng` argument** (`kind.spawn(pool, ev, rng)`); `fx.js` passes `Math.random` until CW-B swaps in the per-match seeded generator, so CW-B's pixel-identical check covers the new kinds without touching them.
- **Weapon keys.** The shot's `weapon` (`e.shot || e.type`) cannot tell units apart: Rider, Drone, Hawk and Glider all carry `shot: "ranger"`, Walker `shot: "tank"`, Watcher `shot: "antitank"`, Balloon `shot: "breaker"`, and the Rampart `shot: "tank"`. So `weaponStyle(ev)` in `src/visual-style.js` looks up `STYLE.weapons[ev.unit] ?? STYLE.weapons[ev.weapon] ?? STYLE.weapons.rifle`, using the `unit` field W0-B adds to every shot event. `weaponStyle` keeps its signature, so its callers at `view.js:1287` and `:1298` (W2-C's file this wave) need no edit. Faction tints are applied in `weaponStyle` too.
- `src/visual-style.json` `weapons`: an explicit style for every armed type, keyed by unit type (`rider`, `drone`, `hawk`, `glider`, `walker`, `watcher`, `balloon`, `rampart`, `ironsovereign`, …); the existing weapon keys stay for anything not listed.
- `src/counter-hit-view.js` (view plugin): a hit is effective when `D[source].counter === D[target].class` or the mechanical bonus applies (view-only rule).
- `src/combat-feedback.js`: pooled damage numbers summed per 0.14 s (as in Tank_game_3D `hit-feedback.ts`) and tag labels from shot `tags`. **The numbers come from per-frame deltas** of each visible entity's `hp + shield` (a `Map` in the plugin, cleared on `reset()`; increases are heals and are ignored), which also covers splash, burn, strikes and boss zones. The `impact` event carries no amount and fires at most every 0.2 s per target, and `progression.js` has no owner this wave, so no sim field is added. Setting "Damage numbers: Bosses & Defence / All / Off" (`src/settings.js`, `src/settings-ui.js`), default Bosses & Defence (O8).
- New weapon voices in `src/sfx-bank.js` and `src/audio-logic.js` (flame, laser, pellet, pod rocket, MG, crit), within today's voice caps.

**Files owned.** `src/fx.js`, `src/visual-style.json`, `src/visual-style.js`, `src/combat-feedback.js`, `src/sfx-bank.js`, `src/sfx.js`, `src/audio-logic.js`, `src/settings.js`, `src/settings-ui.js`, `tests/battle-fx.test.js`, `tests/visual-combat.mjs`, `tests/audio.test.js`, `tests/visual-style.test.js`, `tests/fx-buffers.test.js`, `tests/music-plan.test.js`, `tests/audio-weight.test.js`, `tests/tactics-ui.test.js` (reads `settings.js`); new `src/fx-kinds/*`, `src/counter-hit-view.js`, `tests/weapon-looks.test.js`.

**Shared append-only.** `src/view-plugins.js`, `vi.json`, `docs/CHANGELOG.md`.

**Art.** Effects only. A contact sheet of held-clock shots per weapon in the results folder.

**Tests.** `tests/weapon-looks.test.js` enumerates every armed definition (including the workshop units, `rampart` and the Sovereign's light gun) and builds a synthetic shot event for each with `unit` set: 0 fall back to the rifle look unless listed as rifle on purpose (Ranger, Harvester), and no two of Rider, Drone, Hawk and Glider share a style. Damage numbers from synthetic hp deltas (a heal shows nothing). Tag labels from synthetic events. Each fx kind draws the same particles twice with the same seeded `rng`. `visual-combat`: flare count on counter hits. The setting is saved, and its strings are in `vi.json`.

**Acceptance.**
- fx draws stay at 4; every render-budget scenario's p95 draws unchanged (±0).
- fx update costs at most +0.2 ms in `battle-eco` (median of 5 held-clock runs; the integrator confirms on a quiet machine).
- Audio voice caps hold (`tests/audio.test.js`).
- Golden pins identical (view and audio only).

**Risks.** More particles on phones: every kind reuses the pools, scaled by the governor, with half the particles in Eco.

#### W2-F · Campaign showtime: title cards, boss presence and Hold the Keystone Roads

| Port | Ideas | Size | Worktree / branch | Needs |
|---|---|---|---|---|
| 4237 | Mission title cards (new), P8, C9 | 3×S | `3d_astra-r2-w2f`, `r2/w2f-showtime` | Wave 1, W0-B D1 |

**Player-facing result.**
- Every mission, Chronicle and Defence level opens on a cinematic card: "ACT I · LANDFALL — DAY 1 — FIRST LIGHT", with the place.
- In m03 the Iron Vanguard stands about 2.5 tanks tall, its feet throw dust and shake the ground, a name card opens its entrance, the music swells to full battle, and when its fall ends the mission, 1.2 s of slow motion plays before the debrief. The presence plugin works for any boss, so round 3's road bosses get it for free.
- A new optional Act 3 mission between m11 and m12, **m11c "Hold the Keystone Roads"**: on Three Roads, with build zones, an armour cap of 2, the commander and carriers, 10 waves of Ashfall and Wardens, a Walker-led column in wave 8 and story beats between waves. The commander takes the field in the story for the first time, and before wave 4 Meridian's first two **Gunner teams** reach the keystone: the new unit's story debut, outside the Expanded rule.

**Design.**
- **Title cards.** `src/story/mission-intros.js`: act and day labels per id, falling back to the mission's title and `briefing.place` (labels in `story-vi.json`). `src/app/title-card.js` and `src/title-card.css`: non-blocking, 2.6 s, skipped by a tap, a short fade under reduced motion, never over the dock or a decision; started from `src/app/match-flow.js`. Uses `var(--font-display, <today's heading stack>)`.
- **P8 boss presence.**
  - `src/boss-presence-view.js` (view plugin): `scaleFor` ×1.5 for bosses (exempt from `maxModelScale` through the W0-A seam); footfall dust through `view.fx.dust` and a local shake through `view.shake` on leg steps.
  - `src/boss-ui.js`: a name card on `bossWake`.
  - `src/app/scenes.js` and `src/story/scenes.js`: new scene beats `title` (name card) and `shake`; the old dialogue line clears when a scene starts. The m03 entrance scene gains a title beat (scene data is not part of the mission checksum).
  - `src/audio.js`: the combat layer floor is 1 while a boss is awake (uses the existing battle mood; a recorded boss stem is P14, round 4).
  - `src/app/ui-extras.js` `beginBeat`/`stepBeat` (`ui-extras.js:177-192`, called from `frame.js:116` and `:143`): when the result tick has a `bossDefeated` event, the end beat focuses on the boss, holds 1.2 s at ×0.3, then the debrief. A boss falling mid-match gets the name card "<name> destroyed" and a shake, no slow motion. Do not add an accumulator scale to `frame.js`.
- **C9 m11c.**
  - `HOLD_THE_ROADS` in `src/story/defence-missions.js`, shaped like m02b and m07b: map `crossroads`, `zones`, `armour: { cap: 2 }`, `commander`, carrier groups copied from `src/defence/levels.js` d-crossroads; 10 waves of Ashfall and Wardens (`factions` per group), a Walker-led column in wave 8; beats on `waveStart`; `check: { story: 3, standard: 2, veteran: 1 }`. It is new content, so it may carry `look: "dusk"` (W2-C reads it).
  - **Lent Gunners:** the `waveStart: 4` trigger says Vale's line ("Two Gunner teams from the Field workshop, Commander. Put them where the Scrappers bunch up.") and spawns `{ spawn: "gunner", team: 0, count: 2, at: <keystone> }` through the existing mission `spawn` action (`sim/missions.js:289`); they stand on Guard and the player may move them. The model roster declares them through the mission scan (`model-roster.js`, `o.spawn`). They count in m11c's tuning.
  - The Rampart (W2-A, parallel this wave) does not appear in m11c this round: its definition is not in this package's tree. Round 3 adds an Ashfall Rampart column to wave 9 with a re-pinned m11c checksum.
  - Inserted in `src/story/missions.js` after m11 with `optional: true`.
  - `src/campaign.js` `isUnlocked`: a mission opens when the nearest earlier **non-optional** mission is cleared, so a profile with m11 cleared keeps m12 open. An optional mission counts for medals, not for endings.
  - The campaign map lays the node out automatically (`mapLayout`, Act 3 gets 4 nodes); check the 44 px node fits on the shortest phone board.

**Files owned.** `src/app/match-flow.js`, `src/app/ui-extras.js`, `src/ui-extras.css`, `src/app/scenes.js`, `src/scenes.css`, `src/story/scenes.js`, `src/boss-ui.js`, `src/boss-ui.css`, `src/boss-view.js`, `src/audio.js`, `src/story/missions.js`, `src/story/defence-missions.js`, `src/campaign.js`, `src/story/campaign-map.js` (only if needed), `tests/wings.test.js`, `tests/story.mjs`, `tests/boss.mjs`, `tests/missions-data.test.js`, `tests/story-scenes.test.js`, `tests/story-vi.test.js`, `tests/ui-extras.mjs`, `tests/campaign.mjs`; new `src/story/mission-intros.js`, `src/app/title-card.js`, `src/title-card.css`, `src/boss-presence-view.js`, `tests/showtime.mjs`, `tests/keystone-roads.test.js`, `tests/golden-w2f.test.js`.

**Shared append-only.** `story-vi.json`, `vi.json`, `src/view-plugins.js`, `tests/render-budget.mjs`, `package.json`, `pages.yml`, `docs/MISSIONS.md` ("m11c Hold the Keystone Roads"), `docs/CHANGELOG.md`.

**Art.** None.

**Tests.** At least 12: title-card labels for every mission id; the card skips on tap and respects reduced motion; the end beat on `bossDefeated`; the boss scale is 1.5 and the bar sits above it; m11c data checks (pads and zones clear of the roads, like `tests/missions-data.test.js`); the unlock regression (m12 stays open for an "m11 cleared" profile; m11c opens after m11); old progress loads; m11c checksum recorded.

**Acceptance.**
- The 13 existing mission checksums identical; the m11c checksum recorded in `tests/wings.test.js`; golden pins identical.
- `check:missions --only m11c-hold-the-keystone-roads` meets 3, 2 and 1 stars on Story, Standard and Veteran; a passive player loses; the lent Gunners pin at least one Scrapper group in the Standard bot run (recorded from the events).
- `golden-w2f.test.js`: m11c ObjectiveBot 120 s on Standard (`GOLDEN_FULL`: the whole mission).
- At zoom 30 the boss stands at least 2.3× a Battle tank's screen height.
- When the boss's death ends m03, the debrief opens 1.4 s or more after it.
- The title card covers no control (`elementFromPoint`) on 3 viewports.
- `boss-battle-eco` 120 draws or fewer (today 116).

**Risks.** m11c tuning takes bot iterations: tune only m11c's own waves and alloy. If it does not meet its targets after 3 passes, keep the title cards and P8, and ship m11c behind `optional: true` with the gap listed (the owner decides).

#### Integration after Wave 2

Besides the standard steps:
- Combined tables: Expanded roster with Field command (round robin), and the PlayBot win rate at default Normal under both.
- Record `tests/golden-round2.test.js` (new, integrator, `GOLDEN_FULL`): an Expanded plus Field command AI-against-AI run (4 factions including Ashfall with Ramparts and Sunward with the drill, 300 s), Heroic d-gorge and Heroic d-longcrossing playDefence hashes, m11c ObjectiveBot 120 s. This protects the round's content during clean-up.
- Story Defence layout check again on m11c (dialogue, hints, Defence bar, lent Gunners selected).
- The timing gates of Wave 2 (W2-D think p99, W2-E fx update, W2-C frame) on a quiet machine, and the build job time on 2 cores.
- The owner review packet (see below).

---

### Clean-up wave (6 packages, behaviour-neutral, disjoint files)

Base: tag `r2-wave-2`. Ports A to F as in section 2.4.

Global acceptance for every clean-up package:
- Every golden pin (K1, all `golden-*` files, `golden-round2`), `d071360b`, the 14 checksums (13 plus m11c), `baselines:diff --full` and the Classic, Expanded and Field command bench samples are byte-identical.
- Render-budget p95 unchanged.
- The test count may grow, never fall.
- No new UI strings. Only CW-D removes from `vi.json`. Only CW-F edits docs, the CHANGELOG and the version; the others write notes in their results file.
- A source-text test belongs to the package that owns the source file it reads; CW-E takes the rest.

Each clean-up package delivers its results file and a pin-identical proof (the before and after hashes and tables). None changes what the player sees, so none has art.

#### CW-A · Split `sim/defence.js` and move the Defence effects (code move only)

| Port | Ideas | Size | Worktree / branch | Base |
|---|---|---|---|---|
| 4232 | K7, M1 (code move only), K4 (`endlessWave` memo) | M | `3d_astra-r2-cwa`, `r2/cwa-defence-split` | `r2-wave-2` |

**Player-facing result.** None. Round 3's commanders, heroes and towers get clear homes instead of a 1,200-line file.

**Design.**
- Move the 81 methods of `src/sim/defence.js`, unchanged, into `src/sim/defence/{index,waves,towers,route,commander,armour,crossings}.js`. `index.js` builds the mixin in the original key order and keeps every named export (including `seeded` and `seedOf`). A re-export shim at `src/sim/defence.js` keeps all imports working.
- Move the bodies of the slow, mark, pierce, burst and burn helpers into `src/sim/effects.js` as functions that write **the same entity fields** (`slowUntil`, `slowBy`, `markedUntil`, …). No field is renamed, so no hash moves. **The mixin keeps the same method names as thin wrappers** (`garrisonHit`, `garrisonPierce`, `garrisonBurst` and the others), because their call sites are `this.garrisonPierce`, `this.garrisonHit` and `this.garrisonBurst` in `combat.js:104-132`, which CW-C owns in this wave.
- `seeded` and `seedOf` stay where they are (moved with their methods, unchanged). CW-B creates `src/rng.js` in parallel, so switching the Defence copy to it is a one-line follow-up in round 3's first code commit, after CW-B's equality test has run on the merged tree.
- Memoise `endlessWave` and `palette` off the sim (a module `WeakMap` keyed by the level definition).

**Files owned.** `src/sim/defence.js`, `src/sim/defence/*` (new), `src/sim/effects.js`, `tests/chronicles.test.js`, `tests/story-scenes.test.js` (both read `sim/defence.js` as text); new `tests/mixins.test.js`.

**Shared append-only.** None (notes go in the results file).

**Tests.** A mixin name-collision test over every mixin; `Object.keys` of the Defence mixin equal the base list in order; every existing Defence test passes unchanged.

**Acceptance.** The global clean-up acceptance; `check:defence --json` identical, Heroic rows included; no new file over 450 lines.

**Risks.** Key order decides which method wins on a clash: the order test and the collision test guard it.

#### CW-B · Shared rng and seeded cosmetic randomness

| Port | Ideas | Size | Worktree / branch | Base |
|---|---|---|---|---|
| 4233 | K3, K16 | S+S | `3d_astra-r2-cwb`, `r2/cwb-rng` | `r2-wave-2` |

**Player-facing result.** None. Before and after screenshots for art passes become exact.

**Design.**
- Create `src/rng.js` (moved here from W0-B): `mulberry32(seed)` and `fnv1a(text)`, with a test that they equal the copies in `src/scatter.js` and the `seeded` and `seedOf` exports of `src/sim/defence.js` (read through CW-A's re-export shim, which keeps them).
- Replace the rng and hash copies in `src/scatter.js`, `src/ambient-life.js`, `src/audio-logic.js`, `src/audio-synth.js`, `src/map-edge.js`, `src/music.js`, `src/sfx.js` and `src/snapshot.js` with imports from `src/rng.js`.
- Feed the 58 `Math.random` calls in `src/fx.js`, the ones in `src/ambience.js` and `src/audio-logic.js`, the module generator at `src/view.js:84`, and the `rng` argument of every W2-E kind in `src/fx-kinds/*` from a per-match seeded generator, reset in `WorldView.reset()`.

**Files owned.** The files listed above, new `src/rng.js`, `src/fx-kinds/*`, `tests/scatter.test.js`, `tests/ambient.test.js`, `tests/review-2026-10d-00.test.js` (reads `view.js`); new `tests/rng.test.js`, `tests/cosmetic-seed.test.js`.

**Shared append-only.** None.

**Tests.** `src/rng.js` equals every copy it replaces, and the Defence copy; the new hash import gives identical results on 1,000 sample strings and on every save fixture; no `Math.random` left in `fx.js`, `src/fx-kinds/*`, `view.js` or `scatter.js` (a test).

**Acceptance.** The global clean-up acceptance; held-clock screenshots pixel-identical across two runs of the same scene; scatter and Daily seed fixtures identical.

**Risks.** `snapshot.js` holds the state hash: the equality test runs before the switch.

#### CW-C · Spatial grid and fast paths

| Port | Ideas | Size | Worktree / branch | Base |
|---|---|---|---|---|
| 4234 | K5, K4 (vision and allocation parts) | M+S | `3d_astra-r2-cwc`, `r2/cwc-grid` | `r2-wave-2` |

**Player-facing result.** None. Bigger battles stay smooth on phones.

**Design.**
- A per-tick 8 m grid (`src/sim/grid.js`, new), kept in a module `WeakMap` and rebuilt once per tick, off the hashed state. Used by `combat.enemy`, `preferredEnemy`, `defenseTarget`, attacker scans and splash. Candidates are visited in entity order, so ties pick the same target.
- `separate()` last, with a margin of at least 2 × the largest radius × 0.9 plus the largest push; keep it only if the pins match.
- In Defence, skip team 0's vision loop (`src/sim/vision.js:56` overwrites it with `fill(1)`).
- Allocation-free `cellAt`, `canTraverse` and `canStand` (`src/terrain.js`, `src/navigation.js`).
- `tools/perf-ab.mjs` (W0-B's) gains the scenes below and p50 and max columns; no second perf tool. Script `perf:tick` runs it on the base tag against the working tree.

**Files owned.** `src/sim/combat.js`, `src/sim/movement.js`, `src/sim/vision.js`, `src/terrain.js`, `src/navigation.js`, `tools/perf-ab.mjs`, `tests/terrain-labels.test.js`, `tests/review-2026-10d-09.test.js` (both read `terrain.js`); new `src/sim/grid.js`, `tests/spatial-grid.test.js`.

**Shared append-only.** `package.json` (`perf:tick`).

**Tests.** The grid returns the same target as the all-pairs scan on 1,000 random fixtures (seeded), `preferredEnemy` included; every golden pin.

**Acceptance.** The global clean-up acceptance; skirmish tick p95 at least 20% lower (3 rivals, 120 units, riverlands, 300 s); Defence tick at least 30% lower (Three Roads, 120-unit wave). Both measured as interleaved A/B (`perf-ab`, median of 7) and confirmed by the integrator on a quiet machine.

**Risks.** A changed candidate order would move ties: the order rule and the fixture test guard it.

#### CW-D · Flatter AI ticks and dead code

| Port | Ideas | Size | Worktree / branch | Base |
|---|---|---|---|---|
| 4235 | K6, K2 | M+S | `3d_astra-r2-cwd`, `r2/cwd-ai-dead-code` | `r2-wave-2` |

**Player-facing result.** None. Fewer hitches during big waves.

**Design.**
- Hoist the repeated `own(team)` and filter scans in AI think into one pass per think, and cache building-site candidates and probes for the duration of a think. The think cadence does not change (that would change decisions).
- Remove, each only if unused: `TEAMS` and the legacy 96 m constants and helpers in `src/data.js` (`MAP_SIZE`, `HALF`, `CELL`, `GRID`, `cellAt`, `worldAt`), `disposeEmblems` (`src/emblems.js`), `BANK_NAMES` (`src/sfx-bank.js`), `paintTerrain` and its import (`src/environment-view.js`), the 7 dead CSS selectors, and about 86 stale `vi.json` messages, each checked by search. Drop `export` from module-internal names in the files it owns.
- A reverse i18n test: every `vi.json` message still matches a string in the source.

**Files owned.** `src/sim/ai.js`, `src/sim/ai-counter.js`, `src/sim/ai-attack.js`, `src/sim/economy.js`, `src/sim/expand.js`, `src/sim/points.js`, `src/sim/content/field-command.js`, `src/sim/content/workshops.js`, `src/data.js`, `src/emblems.js`, `src/environment-view.js`, `src/sfx-bank.js`, the CSS files that hold the dead selectors, `src/locales/vi.json` (removals only), `tests/i18n.test.js`, `tests/i18n-coverage.test.js`, `tests/review-2026-10d-14.test.js`, `tests/review-2026-10e-vi.test.js`; new `tests/i18n-reverse.test.js`.

**Shared append-only.** None.

**Tests.** The reverse i18n test; AI think timings recorded before and after with the same seeds (`tools/perf-ab.mjs`, run only: CW-C owns the file).

**Acceptance.** The global clean-up acceptance; AI think p99 at 5 ms or less and max at 12 ms or less on desktop (today 7.1 ms and 26 ms), interleaved A/B, confirmed by the integrator on a quiet machine; screenshot diff 0 on the 6 standard viewports after the CSS removals.

**Risks.** A message still reached through a pattern: the reverse test and a search per string guard it.

#### CW-E · Convert source-text tests

| Port | Ideas | Size | Worktree / branch | Base |
|---|---|---|---|---|
| 4236 | K11 | M | `3d_astra-r2-cwe`, `r2/cwe-tests` | `r2-wave-2` |

**Player-facing result.** None. Client refactors and a formatter become possible.

**Design.** Rewrite the remaining source-text tests (those that read a file no other clean-up package owns) against pure modules or the browser harness. Fold the 32 `review-YYYY-MM-*` files into tests named by feature. Replace the 22 local `run()` copies with `tests/lib/sim.js`.

**Files owned.** `tests/*` and `tests/lib/*`, except the test files owned by CW-A, CW-B, CW-C, CW-D and CW-F.

**Shared append-only.** `package.json` (only if a script name changes; keep `test` as is).

**Tests.** The converted tests themselves; `npm test` wall time within +10%.

**Acceptance.** The global clean-up acceptance; the test count does not fall; no regex-on-source test left in its scope; `tests/ci-matrix.test.js` still green.

**Risks.** A conversion that tests less than before: each converted test names the behaviour it now checks in its title.

#### CW-F · Break up `app/defence-ui.js`, docs and version

| Port | Ideas | Size | Worktree / branch | Base |
|---|---|---|---|---|
| 4237 | K8, K18 | M+S | `3d_astra-r2-cwf`, `r2/cwf-defence-ui-docs` | `r2-wave-2` |

**Player-facing result.** None. New towers and levels stop needing edits to UI constants, and the docs match the game.

**Design.**
- Split the `createDefenceUI` closure into `src/app/defence/{pads-view,sheets,bar,input,result}.js`. Import `dressKey` from `view.js` instead of copying its formula. Move `ZONE_NAME` into `src/defence/levels.js` as **a separate export** `ZONE_NAMES = { "d-crossroads": { ... } }`, keyed by level id, **never as a field of the level**: `roads` lives inside the level's `defence` block, and `serialize()` writes the whole `missionDef` into `options.mission` (`snapshot.js:59`), so a new level field would move the golden-defence pin and every Three Roads hash. Remove `TIER_NAMES`. A test that every branch and rank has a text line, and one that `serialize()` of a d-crossroads match is byte-identical before and after.
- Docs: `ROADMAP.md` as one status table; refreshed counts in VISION, WORLD, TESTING and README; Tank stats in HEAVY_WEAPONS and EXPANSION_STAGES; the boss HP in BALANCE (32,000); what `d071360b` pins; IMPLEMENTATION_PROGRESS closed or carried forward; the NAVAL_PLAN Godot rule (twin frozen); `docs/ARCHITECTURE.md` updated for the content and view seams; the round's CHANGELOG subsections consolidated (a 0.25.0 label only if the owner approves, O17) and the `package.json` version to match.

**Files owned.** `src/app/defence-ui.js`, `src/app/defence/*` (new), `src/defence/levels.js`, `docs/*.md`, `docs/CHANGELOG.md`, `package.json` (version line only), `tests/defence.mjs` (selectors only); new `tests/defence-text.test.js`.

**Shared append-only.** None.

**Tests.** The text-line test; the Defence browser suites on 3 viewports.

**Acceptance.** The global clean-up acceptance; Defence screens screenshot diff 0 on 3 viewports; every count in the refreshed docs checked against the code (list the checks in the results file).

**Risks.** The closure shares state between its parts: pass one small state object, do not add globals.

---

### Integration after each wave (integrator, port 4238)

1. Wait until every package of the wave has handed off. Never merge while a test lane is running.
2. In `C:\Users\n\source\repos\3d_astra-zones` on `feat/aaa-round2`, merge each branch with `git -c safe.directory='*' merge --no-ff r2/<id>-<slug>`, in the wave's merge order.
3. Append-only conflicts: keep both sides (by hand or `git merge-file --union`), then check that every JSON file parses and has no duplicate keys (a small script in `.tmp/`), and that `src/sim/content/index.js`, `src/view-plugins.js`, `src/app/rule-options.js` and `src/defence/traits.js` keep one entry per package.
4. Apply the test changes and seam requests listed in the results files.
5. `npx vite build` with visible output, then the full suite:
   - `npm test`, then `npm run test:golden-full`;
   - `CI_LOCAL_PORT=4238 CI_LOCAL_LANES=3 npm run test:ci-local` (slow), then `-- --fast`;
   - `check:missions` on Story, Standard and Veteran, plus Standard with `--decide mercy` and `--decide firm`, one at a time;
   - `tools/chronicle-check.mjs`;
   - `check:defence --json` (and `--heroic` from Wave 2);
   - `test:render-budget`;
   - `npm run baselines:diff -- --full`;
   - `bench:factions` Classic (row-identical to the baseline), plus the new tables of that wave.
6. With no agent running: the declared timing gates of the wave (`tools/perf-ab.mjs`, base tag against the merged tree, median of 7; browser timings as the median of 5), and the CI build job on 2 cores (`npm run ci:build-job` under `start /affinity 0x3`): at most 7 minutes. Never trigger the GitHub workflow (a dispatch runs the deploy job).
7. If one package breaks the suite after merging, revert only its merge commit and reopen it in a follow-up worktree.
8. Re-record a pin or baseline only where a package declared it, with the reason in the commit message.
9. Write `docs/aaa/results/round2/wave-<N>.md` (what merged, every table, the CI time) and tag `r2-wave-<N>`. The next wave branches from that tag.
10. Remove the merged worktrees (only this round's `3d_astra-r2-*` ones).
11. After Wave 2, build the owner review packet: screenshots of 3 viewports × 3 modes, the night and storm shots (Eco and High, rim on), the title, the weapon contact sheet, a short capture of a Heroic all-elite finale with Stalkers, of the Outrider drill, of m11c's Gunners and of m03, preview sheets of the new models, and the owner-decision table (section 5).

---

## 4. File-conflict matrices

Append-only files (section 2.8) and new files are not listed. A dot means "owns". Abbreviations: `app/` = `src/app/`, `sim/` = `src/sim/`, a bare name = `src/<name>`.

### Wave 0

| Non-append file | W0-A | W0-B |
|---|:-:|:-:|
| `view.js`, `main.js` (one guarded line), `app/debug-hooks.js` (the `rules` hook) | ● | |
| `tests/render-budget.mjs` (harness), `tools/mission-check.mjs`, `tools/faction-bench.mjs`, `tools/skirmish-bench.mjs` | ● | |
| Tests: `air`, `chronicles`, `defence-rules`, `factions`, `player-faction`, `terrain-height`, `wings` | ● | |
| `sim/tactics.js`, `sim/combat.js`, `sim/traits.js`, `progression.js` | | ● |
| `simulation.js`, `commands.js`, `snapshot.js`, `sim/ai.js` (one call) | | ● |
| Tests: `defence-ranks`, `progression` (the Classic-roster rewrite), `terrain-labels`, `choices`, `mission-ui`, `story-scenes` | | ● |

### Wave 1

| Non-append file | A | B | C | D | E | F |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `factions.js`, `model-roster.js`, `field-guide.js` | ● | | | | | |
| `app/briefing.js`, `app/state.js`, `app/preferences.js`, `main.js` | ● | | | | | |
| Tests: `model-roster`, `faction-rules`, `player-faction`, `review-2026-10b-00`, `review-2026-10d-07` | ● | | | | | |
| `tactics-ui.js`, `tactics-card.js`, `ability-hints.js`, `tactics-view.js`, `fx.js` (one table line); test `tactics-ui` | | | ● | | | |
| `app/shell.js`, `app/hud.js`, `app/command-card.js`, `touch-controls.js`, `mission-ui.js` (+css), `app/ui-extras.js` (+css) | | | | ● | | |
| `mobile.css`, `landscape-hud.css`, `hud-readability.css`, `desktop-dock.css` | | | | ● | | |
| Tests: `ui-quality`, `feel`, `mobile*`, `layout-f`, `status-layout`, `ui-extras`, `touch-controls`, `client-2026-11`, `review-2026-10d-02`, `mission-ui` | | | | ● | | |
| `sim/bosses.js`, `sim/defence.js`, `boss-view.js`, `boss-ui.js` (+css), `tools/port-boss-model.mjs`, `docs/aaa/BOSSES.md` | | | | | ● | |
| Tests: `bosses`, `boss.mjs`, `defence-intel`, `assets`, `story-scenes` | | | | | ● | |
| `app/frame.js`, `governor.js`, `app/defence-ui.js`, `defence-ui.css`, `defence/progress.js`, `hotkeys.json`, `app/input-keyboard.js` | | | | | | ● |
| Tests: `defence.mjs`, `defence-progress`, `hotkeys.mjs`, `review-2026-10-02`, `review-2026-10b-01`, `choices` | | | | | | ● |
| Nobody: `view.js`, `sim/combat.js`, `sim/tactics.js`, `simulation.js`, `progression.js`, `commands.js`, `snapshot.js`, `sim/ai*.js`, `story/*`, `campaign.js`, `defence/levels.js`, `app/defence-entry.js`, `app/debug-hooks.js`, `portraits.js`, `visual-style.js`, `input-pointer.js`, `selection.js`, `app/match-flow.js` | — | — | — | — | — | — |

W1-B adds only new files and append-only entries. Shared CSS variable: `--defence-bar-h`, written by F and read by D (section W1-D).

| Append-only file | Appenders in Wave 1 |
|---|---|
| `balance.json` | A, B, C, E |
| `vi.json` | all |
| `manifest.json` | A, B, C, E |
| `sim/content/index.js` | A, B, C, E, F |
| `view-plugins.js` | B, D |
| `visual-style.json` `weapons` | B, C |
| `app/rule-options.js` | created by A |
| `defence/traits.js` | created by F |
| `tests/render-budget.mjs` | A, B, C, E |
| `package.json`, `pages.yml` | A, B, D, E, F |
| `docs/BALANCE.md` | A, B, C, E |

### Wave 2

| Non-append file | A | B | C | D | E | F |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `field-guide.js`; in `balance.json`, the economy fields of the `gunner`, `stalker` and `workshop` blocks (not append-only) | ● | | | | | |
| `sim/defence.js`, `defence/levels.js`, `app/defence-entry.js`, `app/defence-ui.js`, `defence-menu.css`, `defence-ui.css`, `defence/progress.js`, `model-roster.js` | | ● | | | | |
| `tools/defence-check.mjs`, `tools/defence-bot.mjs`; tests: `defence.mjs`, `defence-data`, `defence-progress`, `defence-intel`, `defence-complete`, `model-roster` | | ● | | | | |
| `app/shell.js`, `app/screens.js`, `app/briefing.js`, `start-screen.css`, `ui-theme.css`, `index.html` | | | ● | | | |
| `view.js`, `environment-view.js`; tests: `screens`, `review-2026-10d-05`, `review-2026-10d-07`, `player-faction` | | | ● | | | |
| `sim/ai.js`, `sim/ai-counter.js`, `sim/ai-attack.js`, `sim/economy.js`, `sim/expand.js`, `sim/points.js`, `ai-plan.js`, `sim/content/workshops.js` | | | | ● | | |
| Tests: `ai-attack`, `ai-economy`, `ai-plan`, `ai-rules-091`, `ai-soak`, `expansion`, `opponents` | | | | ● | | |
| `fx.js`, `visual-style.json`, `visual-style.js`, `combat-feedback.js`, `sfx-bank.js`, `sfx.js`, `audio-logic.js`, `settings.js`, `settings-ui.js` | | | | | ● | |
| Tests: `battle-fx`, `visual-combat`, `audio`, `visual-style`, `fx-buffers`, `music-plan`, `audio-weight`, `tactics-ui` | | | | | ● | |
| `app/match-flow.js`, `app/ui-extras.js` (+css), `app/scenes.js`, `scenes.css`, `story/scenes.js`, `boss-ui.js` (+css), `boss-view.js`, `audio.js` | | | | | | ● |
| `story/missions.js`, `story/defence-missions.js`, `campaign.js`, `story/campaign-map.js` | | | | | | ● |
| Tests: `wings`, `story.mjs`, `boss.mjs`, `missions-data`, `story-scenes`, `story-vi`, `ui-extras.mjs`, `campaign.mjs` | | | | | | ● |
| Nobody: `sim/combat.js`, `sim/tactics.js`, `simulation.js`, `progression.js`, `commands.js`, `snapshot.js`, `main.js`, `app/frame.js`, `app/hud.js`, `factions.js`, `sim/bosses.js`, `portraits.js`, `tactics-ui.js`, `tools/port-boss-model.mjs` | — | — | — | — | — | — |

| Append-only file | Appenders in Wave 2 |
|---|---|
| `balance.json` | A (plus the economy fields above), B, D |
| `vi.json` | all |
| `story-vi.json` | F |
| `manifest.json` | A |
| `sim/content/index.js` | A, B, D |
| `view-plugins.js` | B, E, F |
| `app/rule-options.js` | D |
| `defence/traits.js` | B |
| `tests/render-budget.mjs` | A, B, C, F |
| `package.json`, `pages.yml` | B, C, F |
| `docs/MISSIONS.md` | B, F |
| `docs/BALANCE.md` | A, D |

### Clean-up wave

| Non-append file | CW-A | CW-B | CW-C | CW-D | CW-E | CW-F |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `sim/defence.js` → `sim/defence/*`, `sim/effects.js` | ● | | | | | |
| `rng.js` (new), `scatter.js`, `ambient-life.js`, `audio-logic.js`, `audio-synth.js`, `map-edge.js`, `music.js`, `sfx.js`, `snapshot.js`, `ambience.js`, `fx.js`, `fx-kinds/*`, `view.js` | | ● | | | | |
| `sim/combat.js`, `sim/movement.js`, `sim/vision.js`, `terrain.js`, `navigation.js`, `tools/perf-ab.mjs` | | | ● | | | |
| `sim/ai*.js`, `sim/economy.js`, `sim/expand.js`, `sim/points.js`, `sim/content/field-command.js`, `sim/content/workshops.js`, `data.js`, `emblems.js`, `environment-view.js`, `sfx-bank.js`, dead-selector CSS files, `vi.json` (removals) | | | | ● | | |
| `tests/*` not owned by another CW package, `tests/lib/*` | | | | | ● | |
| `app/defence-ui.js` → `app/defence/*`, `defence/levels.js`, `docs/*.md`, `docs/CHANGELOG.md`, `package.json` version | | | | | | ● |

---

## 5. Owner decisions

None of these blocks the round: each has a default that the plan builds.

| # | Decision | Ideas | Built default | Recommendation |
|---|---|---|---|---|
| O1 | Default Roster for new skirmish setups | U1, U2, U6, U7, U8 | Classic | **Flip to Expanded at deploy** if the Wave 2 gates hold: every faction 25 to 75% in the Expanded round robin (Ashfall and Sunward at or above their Classic scores), every workshop unit fielded in at least 50% of long matches. It is one constant in `rule-options.js`; benches and the sim default stay Classic. Expanded also switches on the Sunward Outrider drill. |
| O2 | Default AI plan | S1, S2, S6 | Classic | **Flip to Field command together with O1** if the PlayBot win rate at Normal is 35 to 75%. Old saves keep their plan. Story missions never use it. |
| O3 | Fix the undefended-expansion exploit in the Classic AI too | S2 | Classic unchanged | **Yes.** It is exploit-grade (an expansion lost 1,274 HP with 0 defenders). Re-record the Classic bench in round 3. |
| O4 | Accept D1's measured Defence shift | D1 | Applied (approved bug fix) | **Accept**, including enemy hull units that now keep their factor. If a `check:defence` target fails, keep the fix and retune only that level in a named follow-up. |
| O5 | Heroic lives and alloy | D13 | 5 lives, fixed alloy | **5 lives** (friendly to phone play). 3 lives is a one-number change in `heroic.js`. A 1-life "Iron" tier comes later. |
| O6 | Names | U2, U6, U7, U8, U1, C1 | Gunner team, Stalker, Rampart, Outrider drill, Field workshop, Iron Sovereign | Keep. All are data strings. |
| O7 | Display font, wordmark and grade strength | P12, P9 | Baloo 2, headings only; +12% saturation | Approve after the screenshot set. The grade is one JSON table. |
| O8 | Damage numbers default | P5 | Bosses & Defence | Keep. |
| O9 | m11c "Hold the Keystone Roads" status | C9 | Optional Act 3 mission | Optional: it never locks m12, counts for medals, not for endings. |
| O10 | Signature abilities for the 7 units without one | U11 | Not built | **Yes in round 3, Expanded roster first** (Drone EMP, Shade Smoke, Kite Crash dive); Classic after a bench run. Re-check m06 and m09 to m12. |
| O11 | Zones and armour on the 6 older levels | D5 | Not built | **Round 3 as opt-in "Open field" variants**, first item of round 3's Defence list; promote the 3 river levels into the designed levels after play. Not put on Heroic this round: the zone layouts are a level-design pass of their own (2 to 4 zones per level, clear of the roads, with data tests), W2-B is at capacity, and zones change the bot's strength, so Heroic's first tuning would have to be redone. |
| O12 | Harder Veteran, Endless escalation, Daily modifiers | D16 | Not built | Veteran bounty ×0.8: yes. Endless escalation as a new "Elite Endless" variant, so today's Endless stays. |
| O13 | Heroes plan F1 to F8, the corrected cast (Vale, Okoro, Sol; Hale only in the finale) and enemy hero names | C5, C21, D11 | Not built | Approve. Heroes keep one active power plus a passive aura (upgrades, never a second active). Defence commanders named as archetypes (Siege engineer, Sky marshal). Use `e.heroId` (`e.hero` is the Defence commander's flag, `sim/defence.js:796`). |
| O14 | Area cover after the bunker and barricade veto | M7 | Not built | **No.** Concealment brush (M6) on new maps instead. |
| O15 | Edits to existing missions | C11, C19, C20 | Untouched | Round 5. Start with C20.4 (air back in m09 to m11) and C20.1 (m10 storm cells) once C4 exists; re-pin with `--decide` runs. |
| O16 | Facing armour on the existing Tank and Walker | M2 | Rampart and bosses only | Round 3, after an Expanded bench run (it makes the Walker's "flanking is the answer" text true). |
| O17 | Release label | K18 | CHANGELOG consolidated, no number | Label it 0.25.0 at deploy. |
| O18 | Naval map size and island alloy | S17, C13 | — | 192 to 224 m, not 256 m; island deposits ×1.5. |
| O19 | Ending rule once new decisions or captures exist | C15, C21 | — | Keep "majority of decisions"; a capture counts as mercy only as a tie-breaker. |
| O20 | War Council framing | U12 | — | "Salvaged prints"; ship the skirmish Custom army first. |
| O21 | Mines (round 3) | M3, U5 | — | Revealed mines defuse themselves (no new targeting micro), plus a first-encounter card for mines. |
| O22 | The Gunner team's counters | U2 | Class `siege`: Rangers, Riders and Drones out-trade it; melee rushes lose to it | Keep. It gives the unit one clear job (stop rushes) and an infantry answer, so it never becomes a must-build. The alternative, a new class nobody counters, leaves only vehicles as its answer. |
| O23 | Kiting behaviour on the existing Rider | U8 | Expanded roster only | Keep it behind Expanded. Making it Classic (or a Waystation research for Classic) changes today's Sunward bench: decide after the Expanded bench. |

---

## 6. Later roadmap

### 6.1 What this round leaves out, and why

Every idea the reviews named is either in a package above or listed here with its reason and its round.

| Item | Round | Why not this round |
|---|---|---|
| Boss Roads I: Atlas Launcher port, `tools/boss-size.mjs`, Heroic boss finales (Sovereign on Three Roads, Atlas on Gorge) | 3, first slice | Capacity: W1-E and W2-B were each more than one session. This round lands the engine, the Sovereign and Heroic's empty `finale` slot, so slice 1 of round 3 is data, a port and bot sizing. |
| D11 Defence commander choice with Tank_game weapons (the owner's "hero with a special weapon") | 3, headline | `app/defence-entry.js` and `app/defence-ui.js` belong to W1-F and W2-B in both waves, so no package could own the picker or the in-match levels; `garrisons.json` `commander` → `commanders` touches data every Defence level reads (a pin risk best taken once K1 exists); the Sky marshal's Storm Kite needs flying-boss rendering (C1 slice 2). The line zone the Rail lance needs already exists in `sim/bosses.js`, so D11 starts round 3 with no engine work. |
| D5 zones and armour on the 6 older levels (also on Heroic) | 3 | A level-design pass of its own, it changes the bot's strength, and W2-B is full (O11). |
| P2 "Balanced" render tier (phone default) | 3, first presentation item | Needs a shadow-map path, a governor step-down and 2 budget scenarios inside `view.js`, which W2-C owns and fills this round. Mitigation now: the rim and the grade run on Eco too. |
| Portraits for workshop, Gunner, Stalker and Rampart | 3 | Traded for U8 in W2-A (a fighting style for Sunward is worth more than four pictures). The four types show no portrait until then, like the troop carrier. |
| Wardens workshop unit | 3 | The Wardens are the strongest faction (71% Classic). U4 Bulwark ships only if the Expanded bench shows the Wardens rise no more than 3 points; that bench comes from this round. |
| U8 slice 2: Gliders and `move_fire` | 3 | Firing on the move needs a change in the shared movement path; slice 1 (Riders, kiting) proves the behaviour first. |
| Rampart in m11c and in Heroic | 3 | The Rampart is built in parallel (W2-A) with m11c (W2-F) and Heroic (W2-B), so neither tree has its definition. |
| Switch the Defence `seeded`/`seedOf` copy to `src/rng.js` | 3 (first code commit) | CW-A and CW-B run in parallel; the one-line switch follows CW-B's equality test on the merged tree. |
| D14 level rule variants (Night Gorge, Sandstorm Canyon, Tidal Fordwood, Two-gate Long Crossing) | 3 | Needs C3 looks (W2-C, this round) and `defence/levels.js`, which W2-B owns this round. |
| D17 Endless field-order cards | 3 | Touches Endless and `app/defence-ui.js` (W1-F and W2-B this round). No balance change; it did not fit. |
| S3 AI scouting, S5 harassment and two-pronged attacks, S7 big-map AI (Highlands AI-against-AI stalls at the 30-minute cap) | 3, inside Field command | All three need S2 (W2-D, this round) and change AI behaviour, so they go behind the Field command plan first, like S1, S2 and S6. S7 is the fix for the Highlands stall. |
| S9 map engine | 3 (moved from 4) | It edits `terrain.js`, the `simulation.js` constructor, the river code in `view.js` and `environment-view.js`, all owned this round, and it must reproduce the 7 maps byte-identically, which needs this round's K1 pins. It is the gate for maps and naval, so it moves forward one round. |
| C12 side operations against other factions (gap 5: Ashfall is the enemy in all 15 missions) | 3 and 4 | Round 3: "Grey Wall" (Wardens as team 1, a Walker line with Pylon shields, flank up a ramp; finale boss from `boss-laser.glb`) and "Night Count" (Veil: C3 night, cloaked Shades and Stalkers, the player gets Watchers and Kites, find 4 relays), then "op-atlas" after Boss Roads I. Round 4: "Caravan Run" (Sunward; needs a new `intercept` objective) and "op-rail". This round builds what they need: night, Stalkers, the boss engine. |
| D15 levels 8 to 10 | 4 and 5 | Iron Causeway (Wardens, Sovereign finale) and Skyfall Relay (Sunward air, Sky Wraith, with the jet as second boss) in round 4, after D6 (this round), D7 and Boss Roads (round 3). Harbour Landing (amphibious carriers, Atlas finale) in round 5 with naval. |
| Naval (S17, C13; the owner's top unbuilt idea) | 4 (A0) and 5 (A1) | Dependency chain: S9 map engine (round 3) → S17 A0, a hover transport and Skimmer with islands as capture points, which reuses M1 cargo (round 4) → S17 A1 sea nav grid, Port, Gunboat, Ferry and auto-ferry AI (round 5) → C13 "Glass Lake" and D15 "Harbour Landing" (round 5). Each step needs the one before it; S9 is the reason it cannot start this round. |

### 6.2 The owner's Tank_game_3D bosses

All 10 unused boss models have a slot. Triangle counts and node names were read from the files.

| Model | Boss | Round and place |
|---|---|---|
| `boss-quad-mech.glb` | Iron Vanguard | Done (m03) |
| `boss-walker.glb` | Iron Sovereign | 2 (engine, model, sandbox); 3 (Three Roads Heroic finale, then C7 "The Sovereign Walks"); 4 (Iron Causeway) |
| `boss-missile-truck.glb` | Atlas Launcher | 3 (Boss Roads I: Gorge Heroic finale, "op-atlas") |
| `boss-helicopter.glb` | Sky Wraith (flying; only anti-air hurts it until it lands) | 3 (Boss Roads II, C1 flying bosses); 4 (Skyfall Relay) |
| `boss-rail.glb` | Rail Titan (a 45 m line) | 3 (Boss Roads II); 4 ("op-rail") |
| `boss-spider.glb` (2,800 triangles, 4+ legs) | Rift Stalker: drops Scrappers at 75, 50 and 25% (W1-E's `drops`) | 3 (Boss Roads II, a Defence road boss) |
| `boss-laser.glb` (1,900 triangles, tracked, `Laser emitter`, `LightGun`) | Lance Warden: a sweeping beam on the line zone | 3 (C12 "Grey Wall" finale, Wardens) |
| `boss-quadcopter.glb` | Storm Kite (the Sky marshal's mount) | 3 (D11) |
| `boss-missile.glb` (2,828 triangles, tracked, `MissilePod`) | Ember Battery: a tracked salvo boss, 5 circles | 3 (D16 Endless, a boss every 10th wave, with the Sovereign and the Atlas; O12) |
| `boss-jet.glb` (660 triangles) | Sky Lance: strafing runs along a line | 4 (Skyfall Relay second boss, once flying bosses exist) |
| `boss-siege-mech.glb` | Siege Marshal | 5 (C11 finale) |

### 6.3 Round 3: the owner's direct asks, and the rest of the arsenal

Headline (built on this round's seams, bosses, statuses and roster):

1. **Boss Roads I** (first slice, section 6.1): Atlas port, boss sizing, the two Heroic boss finales.
2. **Defence commander choice with Tank_game weapons** (D11): Siege engineer (Walker base: Rail lance line, Workshop) and Sky marshal (Storm Kite from `boss-quadcopter.glb`: Missile salvo, Flare), in-match levels, unlocked by stars (O13).
3. **Open-field variants** (D5 as opt-in challenges on 6 levels; O11), and D14 rule variants.
4. **Side operations and heroes**: a non-gating operations framework (`src/story/operations.js`, diamond nodes, stored by id) with "Grey Wall" and "Night Count", and C5 hero rules with `e.heroId` (Vale, Okoro, Sol; one power each).
5. **"The Sovereign Walks"** (C7): C1 slice 2 (`shieldedBy` relays, a team-0 boss, `follow`), Okoro as hero, the rebuilt Iron Vanguard as an allied boss.
6. **Boss Roads II**: C1 flying bosses (Sky Wraith), the Rail Titan and the Rift Stalker, as a Defence challenge on 4 levels; boss finales on the remaining 5 Heroic levels.
7. **More fighting styles**: the Wardens' unit (U4 under its bench rule), U8 slice 2, Longshot howitzer (U3), Sapper with mines (U5 + M3, O21), the Rampart in m11c and Heroic.
8. **AI** (behind Field command): S3 scouting, S5 harassment, S7 big-map AI; S8 Recruit and Warlord levels, S4 doctrines; the owner's choices from O2, O3 and O10.
9. **Defence**: D17 field-order cards, D7 tower-defence enemies (with the group `abilities` flag), D9 barracks blockers (Heroic and Endless first), D10 Signal relay, D12 commander tree, D16 (O12, with the Endless boss rotation).
10. **Presentation**: P2 Balanced render tier (phone default) first, the four portraits, P13 results and wave ceremonies (with the landscape debrief fix), the live title diorama and P15 UI sound kit, P3 group pips, P7 battle camera and threat arrows, P6 varied deaths, C2 objective models, C16 allied colours.
11. **Maps**: S9 map engine.
12. **Code**: the Defence rng switch, K9 split `view.js` (after the plugin seam has drained it), K10 instanced rings and bars, K12 lint and one format commit, K13 shared UI checks and WebKit in CI, K14 smaller main chunk, K15 message ids, K17 CSS layers.

### 6.4 Round 4: maps, modes and depth

1. S10 four purpose-built maps, S11 map objectives (watchtower, supply drop, a neutral boss camp), S12 win modes.
2. Naval A0 (S17 quick: hover transport and Skimmer, islands as capture points) with M1 cargo.
3. D15 Iron Causeway and Skyfall Relay; C12 "Caravan Run" and "op-rail".
4. S15 match seed, daily battle and mutators (the first `sim.rng`), S13 AI ally, S14 Last Stand.
5. U10 Wings II flyers (Aegis, Wraith), U11 for Classic (O10), M5 fall back and quick-select, M6 brush and explosive props, M8 weather with P10 visual weather, C4 hazards library.
6. U12 Custom army, U13 experimentals, M4 doctrine powers, P14 recorded music and voice tones (owner listening pass), P11 painted fog, P16 idle personality, P17 tower models, S18 achievements, S19 replay viewer.

### 6.5 Round 5: story finale and naval

1. C6 "Breaking Camp", C8 "Forty Lights", C10 "Two Keys", C11 "The Grey Coat" finale (O15), C14 campaign fork, C15 visible consequences, C17 Camp, Archive and Armory, C18 veterans, C19 Chronicles, C20 rewrites, C21 yield and capture.
2. S17 naval A1 (O18), C13 "Glass Lake", D15 "Harbour Landing", U9 Caravan truck, S16 Frontier War conquest.
3. A test on a real phone (Stage 6.1, open since 0.9) before any public release.

---

## Appendix: review fixes applied

| Review finding | Fix in this plan |
|---|---|
| Expanded as the default before the owner agrees; roster and AI coupled in one flag | Two rules, Roster and AI plan, both Classic by default; flips are O1 and O2 with measured gates |
| The Defence route-walker line is unnecessary | Verified: a boss returns early in `stepEntity` (`simulation.js:322`). Instead W1-E adds a leak-cost seam (`stepDefence` would otherwise leak a boss for 2 lives) and the boss calls `stepRoute` itself |
| `e.shieldRate ?? 4` would break faction shield auras | Dropped. `simulation.js:316` already applies `4 * dt * (e.shieldRate \|\| 1)` with the aura multiplier from `sim/traits.js` |
| `beginBeat` placed in `match-flow.js` | It is in `app/ui-extras.js:177`, called from `frame.js:116`; W2-F owns `ui-extras.js` and reuses `stepBeat` (no new accumulator scale) |
| Workshop tiles placed in `production-ui.js` | Tiles come from `e.trains` (`app/hud.js:219`, `research-tiles.js` level locks); the host gets `trains` from a spawn hook only under Expanded |
| Wardens' building | It is `pylon` (`balance.json` factions) |
| `test:ci-local` defaults to taken port 4231 | `CI_LOCAL_PORT` and `CI_LOCAL_LANES` set everywhere |
| Render-budget `limits` is one line | `Object.assign(limits, {...})` lines |
| Oversized packages | AI v2 split and moved to Wave 2 (S4 and S8 to round 3); Heroic boss finales moved to round 3 (second review); diorama and UI sounds out of W2-C; ceremonies out of W2-F |
| Campaign got staging only; m08 and m10 looks deferred | C3 in W2-C, C9 m11c in W2-F |
| Phones too late | P1 and P3 in Wave 1, Defence framing and bar in W1-F |
| D1 scope | Ratio rule with no new field, gated to Defence matches; mission `hp` spawns and building levels reported only |
| CW-A "M1 move" changed hashed fields | Code move only, same entity fields |
| CI time not budgeted | Section 2.10, measured by the integrator each wave |
| Source-text tests break across owners | Owners listed per wave; non-owners write the change in their results file |
| No onboarding for new mechanics | Unit intro cards (W1-D), data from each unit package |
| Hard-coded ability icon, order and aimed tables | Data seam in W1-C (moved from W0-A in the second review) |
| Missing tactics seam table | Full seam table H1 to H20 in W0-B |
| Portrait atlas conflicts | No package touches the atlas this round; the four portraits are round 3 |

---

## Changes after review

The second red-team review found 13 blocking problems, 8 missing items and 18 improvements. All blocking problems are fixed; every missing item is either added or deferred with its reason in section 6.1; all 18 improvements are taken.

**Blocking problems fixed.**

| # | Problem | Fix |
|---|---|---|
| 1 | `tests/progression.test.js` counts all units and buildings and requires a shield, so W1-A, W1-B, W1-C and W2-A could not pass `npm test` | W0-B rewrites it in Wave 0: it counts only definitions without the new `roster: "expanded"` flag, and its shield rule allows `workshop === "ashfall"` (section 2.7, W0-B item 4) |
| 2 | No AI levels workshop hosts, so the Stalker (L2) and the Rampart (L3) could never be trained | W1-A's AI rule levels each host up to its units' highest `required_level` (capped by the core's level); a fixture unit at level 3 tests it |
| 3 | The Gunner lost every equal-cost duel at the drafted numbers | Redesigned and probed: class `siege`, `counter: "melee"` ×1.6, a 1.8 m sweep (`splash_damage` 0.5), suppression to everything within 2 m, 125/35 HP. Gates at a 1,500 budget with the probe table in W1-B; Rangers are now its stated infantry answer (O22) |
| 4 | The Sovereign sandbox window contradicted its HP | 6 Rangers and 2 Breakers in 90 to 200 s; the 12 + 4 time is recorded (expected 50 to 110 s) |
| 5 | Shot events cannot tell Rider, Drone, Hawk, Glider (and others) apart | W0-B adds `unit: e.type` to every shot event (hash-neutral); W2-E looks up `weapons[unit] ?? weapons[weapon]` inside `weaponStyle`, so `view.js` needs no edit |
| 6 | `G` already toggles the grid | Fast-forward is Shift+Space; the grid keeps `G` |
| 7 | The Defence bar could not fit 8 controls in one row | Follow merged into a 3-state view button; 7 controls with a measured width check and a pause-sheet fallback for the speed toggle |
| 8 | `ZONE_NAME` as a level field and `look` on existing content would move checksums and pins | New rule in section 2.5 (no new fields on existing missions or levels); `ZONE_NAMES` is a separate export; looks of existing ids live in the `mission-looks.js` table |
| 9 | The render harness could not pass `rules` or draw unloaded types | W0-A owns one guarded `rules` line in `main.js` plus a test hook, and the harness preloads every type a scenario spawns |
| 10 | Splitter children would draw as fallback wings on levels that never name them | Children are the group faction's vanguard-slot type, and W2-B owns `model-roster.js` in Wave 2 to declare them |
| 11 | W0-A, W1-E and W2-B did not fit one session | W0-A: tools and fast pins only (the integrator records the long baselines once, after Wave 0), ability-UI seam to W1-C. W1-E: engine and the Sovereign only. W2-B: elites and Heroic with elite finales. Atlas, sizing and boss finales are round 3's first slice |
| 12 | The m02b story pin can move with D1 | Listed in the D1 re-record set with its reason; every other pin must hold |
| 13 | CW-A moving the garrison helpers would break CW-C's call sites | CW-A keeps the method names on the mixin as thin wrappers |

**Missing items.** Added: the Sunward Outrider drill (U8 slice 1, in W2-A in place of the portrait re-render); new units outside the opt-in rule (Stalker columns in two Heroic levels, two lent Gunner teams in m11c); the rim light on Eco. Deferred with reasons in section 6.1: the Wardens' unit, the Rampart in m11c and Heroic, D5, D11, D14, D17, S3, S5, S7, all three D15 levels, named C12 operations, P2 and the naval chain (S9 moved forward to round 3). Section 6.2 gives every one of the 10 unused Tank_game_3D bosses a round.

**Improvements taken.** Seam ids renamed H1 to H20 (H20 is the new `fight` hook the drill needs); Stalker retuned and probed (85/25, 95 damage, 18 m) with gates as means of 10 mirrored battles and Riders recorded only; a shared duel harness (`tests/lib/duel.mjs`); W2-A alone may change only the economy fields of Wave-1 units; faction-isolated Expanded pins (a Wardens fixture for W1-A, sandbox pins for unit packages, `golden-expanded` after Wave 1) with pre-declared re-records; timing gates as interleaved A/B runs (`tools/perf-ab.mjs`), judged by the integrator on a quiet machine; the CI rule measured on 2 cores, with long pins behind `GOLDEN_FULL` in their own matrix entry and the Heroic checks off the build job; the break-the-attack threshold as a share of max HP, with its rate recorded; every touch-row id kept in the DOM; a bottom-band contract (`--defence-bar-h`) between W1-D and W1-F; the timed-buff undo deletes keys that were absent; damage numbers from per-frame HP deltas; the display font in `src/fonts/` (rule in section 2.7); `src/fx-kinds/*` in CW-B's scope with an injected rng; the fast-forward determinism test through the real frame loop; speed state kept module-local in `frame.js`; one leg-pivot pair for the two-figure Gunner; a Gunner browser suite for the 28 px rule; `src/rng.js` moved to CW-B.

**Effect on the scores.** Overall ≈6.3 (6.1 if the owner keeps both defaults Classic), down 0.1 from the first refinement: the two road-boss finales move to round 3, while Sunward gains a style and the new units now appear outside the opt-in rule.
