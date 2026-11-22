# Frontier Command: AAA round 3 plan (refined)

Date: 2026-11-21. Base: `main` at `49deacc` (round 2 live as `2c6e064`, plus the larger plateaus and the art audit).
Integration branch: `feat/aaa-round3`, worktree `C:\Users\n\source\repos\3d_astra-r3`, tag `r3-base`.
Baseline: `npm test` 961 tests, 935 pass, 26 skipped, 0 fail.

This plan was refined by two independent reviews of the draft: a code review (22 corrections, all applied; see the appendix) and a game-design review (it cut low-value work and added a victory ceremony, a rank track, audio and first-minute hooks).

## 0. Where the game stands

Live evaluation after round 2 (three independent reviewers on the live site with software GL): **about 6.5 / 10**.

| Area | Score | Weakest parts |
|---|---|---|
| Campaign and story | ~7.1 | Night looks purple, not dark blue (5.5). The m06 storm only shows from 16:00. Openings are identical. The first 2 minutes are passive. Bosses were not seen. The map is cosmetic. |
| Frontier Defence | ~6.6 | No guided first build. Tier and crew are hard to read at a glance. Units are hard to read on orange ground. The landscape Actions panel covers a third of the map. |
| Skirmish and units | ~6.2 | **AI scores 4/10**: Field command never fields workshop units. Fights clump on bridges. Factions differ by tint only. There is no meta loop or replay reason. |

**Art audit** (`docs/aaa/results/round2/art-audit/README.md`):
- About 60% of every core model is near-black or dark-brown armour.
- The worst models are the Iron Sovereign, the Walker and the Drone.
- The shared infantry look alike on a phone.
- 7 units have no portrait.

**Design review verdict:** round 2 lifted the floor (AI, legibility, onboarding). What a reviewer remembers is missing:
- a win ceremony;
- a reason to replay (meta progression);
- a hook in the first minute of each mode;
- audio juice.

### 0.1 The owner's ideas from this session, checked

| Idea | Verdict | Package |
|---|---|---|
| Medic and Engineer run ahead of a mixed group and get hit first | **Real.** Their speed is 4.3, against 1.9–2.7 for heavies, and there is no group pace. **Fix:** a group order keeps the fighters' pace, and support units trail behind the fighters. | R3-B |
| Right-click a unit with a Medic or Engineer selected, and it follows | **Works today** (the `support` order), but nothing shows it. **Fix:** a tether line while the unit is selected, plus a heart or wrench pip over the unit being followed. | R3-B |
| Ctrl+1–9 control groups | **Work on the keyboard.** The group strip exists but is hidden on phones. **Fix:** show it on phones, with smart chips (All army, Fighters, Support) and hold-to-assign. | R3-B |
| Build on the highland for the advantage | **Works once explored.** The plateaus are now larger. **Fix:** a hint teaches the bonus the first time you build up there. | R3-B |
| Upgrade both armour-squad branches | **Assault and Bulwark exclude each other today.** **Fix:** a "Combined" step at 320 adds the other branch, with gold trim on the squad. | R3-C (+ K for trim) |
| Barracks level 3 is weak | **True:** it gives only +50% HP and +40% build speed. **Fix:** recruits from a level-3 Barracks start at rank 1 automatically, with a visible chevron (Expanded roster). | R3-C |
| Max army 100 | **Keep 100 as the default.** **Fix:** a skirmish Battle-rules option of 100 / 150, plus 200 on desktop only. | R3-C |
| Make each unit look better | **Yes:** a warm palette, distinct infantry and faction silhouettes, a redo of the worst three models, and all portraits. | R3-F, R3-J |

## 1. Goals and expected scores

| Area | Now | Target | Main levers |
|---|---|---|---|
| Skirmish and units | 6.2 | 7.3 | Field AI fields its whole roster (A); squad orders (B); army depth (C); warm, distinct art (F, J); readable battles (K); victory ceremony (V); rank track (R) |
| Campaign | 7.1 | 7.8 | Night and storm (D); openings and a living map (G); boss phase 2 and the Sovereign mission (H); early contact and costly bonus goals (I); ceremony (V) |
| Defence | 6.6 | 7.4 | Guided first build, badges and a landscape panel (E); Combined squads (C); a wave-1 hook (Q); ceremony and rank (V, R) |
| Overall | 6.5 | **7.5** | |

## 2. Rules for every package

Round 2's rules (`docs/aaa/AAA_ROUND2_PLAN.md` section 2) apply unless changed here. Read that section first. The rules most often missed are repeated below.

### 2.1 Worktree and git
- Create your worktree with:
  `git -c safe.directory='*' -C C:/Users/n/source/repos/3d_astra-r3 worktree add C:/Users/n/source/repos/3d_astra-r3-<id> -b r3/<id>-<slug> <base>`
  then run `npm ci` in `github-io/`.
- The base is the tag `r3-base` (Wave 1), `r3-wave-1` (Wave 2) or `r3-wave-2` (Wave 3).
- Do not remove any worktree; the integrator does that.
- Always call git as `git -c safe.directory='*'`.
- Stage files by path. Never `git add -A`, never `git stash` (the stash list is shared by every worktree).
- Commit only on your own branch. No push, no merge into main.
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### 2.2 Machine, temp files, ports
- Scratch files go only in your worktree's `github-io/.tmp/`. Delete them before hand-off.
- Stop servers by exact PID, never by process name.
- Every wait has a timeout.
- Apply the four-correction limit: after 4 failed fixes of the same problem, stop and report it.
- Ports by slot:

  | Slot | 1 | 2 | 3 | 4 | 5 | 6 | Integrator |
  |---|---|---|---|---|---|---|---|
  | Port | 4232 | 4233 | 4234 | 4235 | 4236 | 4237 | 4238 |

- Never use ports 4173, 4191, 4197, 4231, 4239, 5178 or 5198.
- Serve with `npx vite build`, then `npx vite preview --host 127.0.0.1 --strictPort --port <port>`.
- Before running tests, check that the page `<title>` reads "Frontier Command — Outpost Meridian".
- Always pass `TEST_URL`.
- For `test:ci-local`, set `CI_LOCAL_PORT=<port> CI_LOCAL_LANES=2`.
- Six agents share the machine:
  - `check:missions` with `--jobs 3 --only <ids>`, one difficulty at a time;
  - benches with `--jobs 3`.

### 2.3 Determinism
- These must hold unless your brief declares the move:
  - the idle fingerprint `d071360b`;
  - the 14 mission checksums in `tests/wings.test.js` (13 plus m11c);
  - every `tests/golden-*.test.js` pin;
  - `npm run baselines:diff -- --full`.
- **Create new state only when content uses it.**
  - Never add a top-level sim field: `tests/content-seams.test.js:444` lists the sim keys exactly.
  - Never add a field to an existing mission, Chronicle, Defence level or boss definition. Look and opening data go in a separate table keyed by id.
- Rules reach the hash only as non-default values in `options.rules` (`src/snapshot.js:61`, `src/app/rule-options.js`). A new option whose default is "no key" keeps every pin.
- No `Math.random` in sim code. Cosmetic randomness comes from a seeded generator in `src/rng.js`.

### 2.4 Balance and owner rules
- Do not edit:
  - existing `balance.json` entries;
  - existing Defence waves;
  - the Classic AI;
  - existing missions (except R3-I).
- New behaviour sits behind one of these:
  - a rule (`rules.roster === "expanded"`, `rules.aiPlan === "field"`, a new Battle-rules option);
  - new content;
  - a lazy flag set only by a UI-issued order.
- Owner rules:
  - Low micro: autocast; reward control, never require it.
  - One ability per unit.
  - No bunkers or barricades.
- Phones and PC both count:
  - check 1440×900, 390×844 and 844×390;
  - text at least 11 px, taps at least 44 px, no sideways scroll;
  - command-tile sub-lines at most 10 characters;
  - the fixed phone dock heights must not grow.
- No `system-ui` in any font stack.
- New UI strings go in `src/locales/vi.json`; story text goes in `src/locales/story-vi.json`. The Godot twin is frozen; do not sync it.
- Colour: vivid and warm. A night scene has a very dark blue sky (no purple).

### 2.5 Art
- Models come from `tools/blender/generate_<name>.py`, built on `frontier_kit.py`.
- Run Blender headless with the portable build: `C:\Users\n\source\repos\3D_claudeopus55\.tools\blender-4.5.9-windows-x64\blender.exe --background --python <script> -- <args>`.
- Budgets are in `docs/ASSET_PIPELINE.md`. A model may not have more materials than its nearest existing unit.
- Bosses are ported with `tools/port-boss-model.mjs` and `tools/boss-parts/*.json`, not with Blender.
- Every changed manifest entry gets `review: "pending owner review (round 3)"`.
- Render before/after contact sheets into your results folder.

### 2.6 Shared files
- **Append-only:** add at the end of the file and keep your block together:
  - `src/balance.json` (new definitions or keys);
  - `src/locales/vi.json` and `src/locales/story-vi.json`;
  - `public/models/manifest.json`;
  - `package.json` (scripts only);
  - `.github/workflows/pages.yml` (a matrix entry named `r3-<id>`);
  - `tests/render-budget.mjs` (new scenarios, plus `Object.assign(limits, {...})` lines);
  - `docs/CHANGELOG.md`, under `## Unreleased: AAA round 3`;
  - `docs/*.md` (a new `##` section at the end);
  - the registries `src/sim/content/index.js`, `src/view-plugins.js`, `src/app/rule-options.js` and `src/app/debug-hooks.js` (test hooks).
- **Line-range shares**, written in the matrix (section 4): edit only the named function or line.
- Any other file is exclusive to the package that owns it in that wave. If you need a file you do not own, write a **seam request** in your results file and ship without it.
- About 25 tests read source files as text. Insert new lines rather than reformatting existing ones. If a source-text test you don't own breaks, report the exact change for the integrator.

### 2.7 Deliverables and definition of done
- A results file `docs/aaa/results/round3/<id>.md`:
  - before/after numbers;
  - screenshots in `docs/aaa/results/round3/<id>/`;
  - seam requests;
  - test changes for the integrator.
- A CHANGELOG subsection.
- A `tests/golden-r3<id>.test.js` pin for new sim content. Long points go behind `GOLDEN_FULL=1`.
- `npm test` green, with the test count up by your brief's number. Each package adds at most 10 s to `npm test`; long checks go into a tool plus a CI matrix entry.
- Your own browser suites green on your port, plus the CI groups your files affect.
- Render budget green for your scenarios plus `battle-eco`.
- `baselines:diff` identical, or only your declared change.
- Scratch files removed and servers stopped. Then hand back a short report: done/partial, the acceptance numbers, the pins that moved, and the seam requests.

## 3. The waves

| Wave | Slot 1 (4232) | Slot 2 (4233) | Slot 3 (4234) | Slot 4 (4235) | Slot 5 (4236) | Slot 6 (4237) |
|---|---|---|---|---|---|---|
| 1: feel and look | A Field AI | B Squad orders | C Army depth | D Night and storm | E Defence onboarding | F Warm kit |
| 2: showtime | G Openings and map | H Boss phase and the Sovereign | I Campaign pacing | J Models and portraits | K Battle readability | V Victory ceremony |
| 3: reasons to return | R Rank track | U Audio juice | Q First-minute hooks | | | |
| Clean-up | integrator | | | | | |

### Wave 1 (base `r3-base`)

#### R3-A: Field command fields its army
- **Player gets:** the Field command AI builds a real mixed army: its workshop units, counters to your army and anti-air when you fly. It never stalls on Highlands.
- **Files owned:**
  - `src/sim/ai-attack.js`, `src/sim/ai-counter.js`, `src/sim/content/field-command.js`;
  - `src/sim/content/workshops.js` (changes gated on `fieldPlan()`);
  - `src/ai-plan.js`;
  - `src/sim/ai.js` (every line except the pop-cap line 74, which R3-C owns);
  - new `src/sim/ai-census.js` and new `tools/ai-census-check.mjs`.
- **Work:**
  1. **Census.** Every few seconds, the AI counts its own army by role: front, ranged, anti-air, support, workshop.
     - It compares the count with a target mix per faction, stored in a new `balance.json` key `ai_mix`.
     - It trains toward the biggest shortfall.
     - Under Expanded it keeps at least one workshop unit per host once it can afford one.
     - It counters the enemy's census: anti-air against flyers, anti-armour against tanks.
     - Hook it into `updateAI`'s training choice with one guarded call (only when `fieldOn`, as at `ai.js:114,145`).
  2. **S7 stall breaker.** After about 4 minutes with no contact, attack-move on the nearest enemy building that has been seen (Highlands AI-vs-AI must end).
  3. **Scouting.** Extend what exists: the Kite spotter (`ai-counter.js:48`) and `scoutDestination`. Do not write a new scout system.
  4. **Deferred to round 4:** S5 harassment. Note that `aiWave` and `aiSecondGroup` also run in missions (`MISSION_FIELD`, `ai-attack.js:69`); every edit must be gated by `fieldPlan` and `!this.mission`.
- **Acceptance:**
  - `npm test` gets one census test: one faction, 300 s, Field Expanded on Dunes, at least 4 unit types and at least 1 workshop unit.
  - `tools/ai-census-check.mjs` runs the full matrix, with matrix entry `r3-a`:
    - all 5 factions at 600 s: at least 4 types each and at least 1 workshop unit;
    - Highlands Field vs Field ends before 30 minutes in 5 of 5 seeds.
  - The bench with `--rules '{"aiPlan":"field","roster":"expanded"}'` stays at 25–75% for the bot.
  - `perf:tick`/think measured with `--a r3-base` gets no more than 20% worse.
  - Declared pin moves: `golden-w2d` (180 s, and 600 s with `GOLDEN_FULL`), `golden-round2` "arena 300" and `tests/field-command.test.js`. Every other pin and baseline must stay identical.
  - +6 tests.

#### R3-B: Squad orders (the owner's control asks)
- **Player gets:**
  - a mixed group moves at the fighters' pace;
  - Medics and Engineers walk behind the fighters and keep them company;
  - a visible follow tether and pip;
  - control groups on phones;
  - a high-ground building hint.
- **Files owned:**
  - `src/sim/orders.js` (all except `enqueue`) and `src/sim/traits.js` (`moveSpeed` only);
  - `src/app/orders.js`, `src/app/selection.js`, `src/app/input-keyboard.js`;
  - `src/selection-view.js`, `src/desktop-dock.css`;
  - `src/mobile.css` and `src/landscape-hud.css` (the group-strip rules only);
  - `src/settings.js`, `src/settings-ui.js`;
  - new `src/sim/formation.js` and new view plugin `src/follow-tether-view.js`;
  - read-only: the support logic in `src/progression.js:154-190`.
- **Work:**
  1. **Group pace.** A player move or attack-move of 2 or more units carries `pace: "group"`. Only `app/orders.js` sets it; no test, bot or AI does.
     - With the flag, `issue()` replaces today's 1.9 m grid (`sim/orders.js:80-87`) with formation slots: fighters in front (highest HP first), ranged behind them, support behind that.
     - `moveSpeed` caps each unit at the slowest fighter's speed while it is within 12 m of the group centre.
     - Units return to normal speed in combat.
     - Without the flag, nothing changes.
  2. **Support trails.** In a group order, each Medic or Engineer gets a slot about 3–4 m behind the fighters. On arrival it takes a `support` order on the nearest fighter, so it keeps healing or repairing. Set this lazily, only on that order.
  3. **Tether.** While a support unit with a `support` order is selected, show a dashed team-colour line to its target, copying the rally route line at `selection-view.js:211-237`, as a view plugin. Add a heart or wrench pip over the target and a card line "Following <name>".
  4. **Phone groups.** Show the existing `#group-strip` (`renderGroupStrip`/`useGroup` in `app/selection.js:41-60`) on phones.
     - Add three smart chips: All army, Fighters, Support/Air.
     - Hold a numbered chip for 500 ms to assign the current selection.
     - Keep the text format that `tests/hotkeys.mjs:94` and `tests/status-layout.mjs:137` assert.
     - Remove the `.group-strip` exemption at `tests/layout-f.mjs:51`, so it meets the 44 px rule.
     - It must not grow the fixed docks.
  5. **Settings.** A "Group pace" switch, on by default. When off, the flag isn't sent.
  6. **High-ground hint.** The first time a building is placed on a plateau, the message queue says "High ground: +2 m range, +20% damage".
- **Acceptance:**
  - Sim test: 2 tanks, 1 medic and 1 engineer under `pace:"group"`. The medic's distance to the enemy stays larger than the tanks' throughout, the arrival spread is at least 1.5 × the unit radius, and the group arrives within 10% of the slowest unit's solo time.
  - Every pin and baseline stays identical.
  - Browser suite `tests/squad-orders.mjs` (matrix `r3-b`) at 3 viewports: 44 px chips, no dock growth, the tether visible.
  - +8 tests.

#### R3-C: Army depth (Barracks level 3, Combined squads, army size)
- **Files owned:**
  - new `src/sim/content/barracks-veterans.js` (registered at the end of `sim/content/index.js`);
  - `src/sim/defence/armour.js`;
  - `src/defence/garrisons.json` (a new key `armour.combined`);
  - `src/app/defence/sheets.js` (the `armourSheet` function only) and `src/app/defence/input.js` (the squad buttons only);
  - `src/commands.js`;
  - `src/simulation.js` (the new `maxPop()` and its use at line 270) and `src/sim/ai.js:74` only;
  - `src/app/rule-options.js` (append) and the Battle-rules row in `src/app/briefing.js` (the rules part only).
- **Work:**
  1. **Veteran intake.** Under the Expanded roster, infantry trained at a Barracks of level 3 or more start at rank 1.
     - Use the promote logic and `RANK_BONUS` in `sim/tactics.js:9,48`, through an `onSpawn` content hook.
     - The production card says "Recruits arrive as veterans".
     - There is no research.
  2. **Combined squad** (Defence). After its branch, a squad can buy "Combined" for 320, which adds the other branch's effect.
     - Add `armourCombinedCost(squad)` and the command argument `combined: true` (`commands.js:57` already accepts branch strings).
     - **Leave `armourNextUpgrade` unchanged.** `tools/defence-bot.mjs:135-141` reads it, so the bot never buys Combined and `check:defence` keeps its numbers.
     - Decide the leash as max(Assault 4, default 9) = 9, and document it.
     - Set a lazy `e.combined = true` flag for the view; R3-K draws the gold trim.
     - Don't use the word "Elite": it already names wave affixes.
  3. **Army size.** A Battle-rules option `pop` with the values "100" (default, so no key is stored), "150" and "200".
     - Offer "200" only on desktop; hide it on touch devices.
     - `sim.maxPop()` reads `rules.pop`; the AI cap line uses it.
     - Add a render-budget scenario `battle-200` with its own limit.
- **Acceptance:**
  - A sim test that veterans start at rank 1 under Expanded at Barracks level 3 and not under Classic.
  - A Combined test: both effects active, cost 320, not buyable before a branch, and the bot never buys it.
  - A pop test: under cap 150, both the player and the AI stop at 150.
  - Every pin, baseline and `check:defence` result stays identical.
  - New vi strings added.
  - +8 tests.

#### R3-D: Night and storm looks
- **Player gets:**
  - the owner's night: a very dark blue sky, black-blue ground and void, moon and stars, warm glow on lights;
  - an m06 storm that builds from the start instead of at 16:00;
  - a storm sound bed.
- **Files owned:** `src/mission-looks.js`, `src/mission-look-view.js`, `src/look-grade.js`, `src/look-grade.json`, `src/map-edge.js`, the sky/fog parts of `src/environment-view.js`, `src/ambience.js`, and new `src/night-sky.js`.
- **Work:**
  1. The night sky is already `#030818` (`mission-looks.js:20-23`). The purple comes from the grade: fog of war `#3a2a4a` and a warm `shadowTint` in `look-grade.json`. Add per-look grade overrides: night fog and shadow tint blue-black, and the outland/void tinted to match.
  2. Add a moon disc and star points (one draw each) to night looks.
  3. Boost the existing glow materials at night: `TeamGlow*`/`Energy*` today, plus `Window*` once R3-J's models land, through a name contract only.
  4. m06: in the look table (not the mission def) the storm onset moves from 960 s to a build from 0 to 90 s: clouds, fog and rain thicken over that time. The lightning stays on the existing deterministic `flashAt`.
  5. Add a storm ambience bed to `ambience.js`, silent in quiet mode.
  6. Every look that is night or storm (m08, m10, m06 and Chronicles with night looks) gets the same treatment.
- **Acceptance:**
  - A screenshot sheet: the m08 night sky has blue above red by more than 20 and luminance under 15%, with no purple (R − B below 0) across the whole frame average.
  - m06 at 0:30 and 3:00 shows rain and darkening.
  - m10 at 0:30.
  - Night and storm scenarios add at most 6 draws over the same map by day.
  - Motion-off disables flashes.
  - Pins identical (view only).
  - +5 tests.

#### R3-E: Defence onboarding and readability
- **Files owned:**
  - `src/app/defence/*` except `armourSheet` in `sheets.js` and the squad buttons in `input.js` (both R3-C);
  - `src/app/defence-entry.js`, `src/app/defence-ui.js`;
  - `src/defence-ui.css`, `src/defence-menu.css`;
  - the Defence rules in `src/landscape-hud.css`;
  - `src/defence/progress.js`.
- **Work:**
  1. **Guided first build.** On a profile with no Defence win, three steps: tap the glowing pad, pick a crew, call the wave. The coach marks point at the real elements. It is stored done in `defence/progress.js` and skippable. The existing "Crew the pads" hint (`sheets.js:132`) folds into it.
  2. **Badges.** Each tower already shows its crew model and tier tint (`pads-view.js:84-139`). Add a small crew icon plus tier pips readable at the phone zoom, instanced in at most 2 draws.
  3. **Unit contrast.** A dark ground ring under Defence enemies and friendly squads so they read on orange ground. Don't touch the look-grade rim; that is R3-D's file.
  4. **Landscape.** At 844×390 the Actions panel covers at most 22% of the view width, and it can collapse.
  5. **Next star.** The results screen names one concrete next-star hint.
- **Acceptance:**
  - `tests/defence-onboarding.mjs` (matrix `r3-e`): a fresh profile sees the guide, a second visit does not, and the panel coverage at 844×390 is at most 22%.
  - `check:defence` identical.
  - The Defence render scenario adds at most 3 draws.
  - +5 tests.

#### R3-F: Warm kit and distinct silhouettes (art 1)
- **Files owned:**
  - `tools/blender/frontier_kit.py`;
  - the generators of the core units, the shared infantry and the factions, including `generate_factions.py` (Walker, Rider, Wagon, Scorcher), but **not** the Drone or the bosses;
  - the GLBs they write;
  - their `manifest.json` entries.
- **Work:**
  1. **Palette.** Lift dark armour to warm mid tones and keep the team areas.
  2. **Faction silhouette accents**, on faction variants only:
     - Meridian: antenna and shoulder plates;
     - Ashfall: exhausts and spikes;
     - Wardens: tower shields and crests;
     - Sunward: sails and fins;
     - Veil: hoods and cloaks.
  3. **Distinct shared infantry:**
     - Medic: white with a red-cross pack;
     - Engineer: hard hat and tool frame;
     - Ranger: long rifle and cape;
     - Worker/Harvester: bright yellow.
  4. Add `Window*` emissive parts on buildings where they fit (the name contract with R3-D).
  5. Keep the triangle and material budgets.
- **Acceptance:**
  - Before/after contact sheets.
  - A **24 px thumbnail sheet** in which a fresh reviewer agent names every infantry type correctly.
  - Average armour luminance up at least 25%, with team areas unchanged.
  - `tests/assets.test.js` green.
  - Render budget within ±2 draws.
  - The unit portrait atlas will be re-rendered by R3-J; note any cell that needs it.
  - +2 tests.

### Wave 2 (base `r3-wave-1`)

#### R3-G: Openings and a living campaign map
- **Files owned:**
  - `src/story/mission-intros.js`, `src/app/scenes.js`, `src/app/title-card.js`;
  - `src/campaign-map-ui.js`, `src/campaign-map.css`, `src/story/campaign-map.js`;
  - `src/chronicles-ui.js`;
  - new `src/story/openings.js`.
- **Work:**
  1. **Openings.** One shared, parameterised fly-in (start pose, end pose and duration in 4–6 s, skippable), with a table keyed by mission id. Each mission picks a start that frames its own landmark: the bridge, the plateau, the enemy camp or the objective.
  2. **Campaign map.** Choice markers on nodes that hold a decision, and ending hints ("Open Frontier: 2+ merciful choices").
  3. **Chronicles** shown above the fold on desktop.
  4. **Dev hook** `__frontier.jumpBoss(id)` (append to `debug-hooks.js`).
- **Acceptance:**
  - All 15 missions have distinct openings: the camera start differs by at least 10 m or 20° between any two.
  - Pins identical.
  - `tests/openings.mjs` (matrix `r3-g`).
  - +5 tests.

#### R3-H: Boss phase 2 and "The Sovereign Walks"
- **Files owned:**
  - `src/sim/bosses.js`, `src/boss-view.js`, `src/boss-ui.js`, `src/boss-presence-view.js`;
  - new `src/story/sovereign-mission.js`;
  - one import line and one array entry in `src/story/missions.js`, like `HOLD_THE_ROADS` (`missions.js:9,1158`);
  - its own entries in `mission-intros.js` and `story/campaign-map.js` (as a seam request to R3-G, applied at integration);
  - `tools/boss-parts/` for the new boss.
- **Work:**
  1. Phase 2 uses the existing `stages` engine (`bosses.js:121`), on a **new** boss entry and unit type `ironsovereign2`. At 50% HP it gets a new attack pattern, a short scene beat, a music shift and drops.
     - The existing Sovereign keeps its pins (`golden-w1e`).
     - The Iron Vanguard gets an optional phase 2 only as a new entry used by new content.
  2. A new optional Act 3 mission "The Sovereign Walks": the Sovereign marches on the player's line, shielded by relays the player must break; Okoro speaks the briefing.
  3. Medal targets come from the bot.
- **Acceptance:**
  - `check:missions --only <new id>` wins on all difficulties.
  - A golden pin for the new mission and boss.
  - Screenshots of both phases.
  - Existing pins identical.
  - +5 tests.

#### R3-I: Campaign pacing
- **Files owned:** the existing mission entries in `src/story/missions.js` (only R3-I may edit them) and `src/sim/missions.js`.
- **In scope:** the 13 main and side missions in `missions.js`. **Out of scope:** m02b and m11c in `defence-missions.js`.
- **Work:**
  1. A first contact at 60–100 s in every mission that has none in its first 2 minutes: a probing raid or a flyby.
  2. Optional objectives that are already done before 1:00 (for example m03's "two Sentinel towers") get a real cost: a forward position, a timer or a trade-off.
- **Acceptance:**
  - A time-to-first-contact table, before and after, from the bot.
  - `check:missions` wins on Standard and Veteran for every mission it won before.
  - Medal targets re-measured.
  - Declared moves:
    - the mission checksums of the missions it changes;
    - `golden-story` (m01, m03, m06b);
    - `baselines` missions-standard.
  - +4 tests.

#### R3-J: Models and portraits (art 2)
- **Files owned:**
  - the Drone generator;
  - the Iron Sovereign parts and port (`tools/boss-parts/ironsovereign.json`, `tools/port-boss-model.mjs` usage);
  - the Walker refinement, if R3-F's palette pass leaves it weak;
  - the portrait atlas: `src/portraits.js` (`PORTRAIT_ORDER`), `src/art/portraits.webp` and the portrait part of `tools/blender/render_ui_art.py`.
- **Work:**
  1. Rebuild the Drone and the Iron Sovereign in the round-3 palette, within budget.
  2. Re-render the **whole** unit portrait atlas, because R3-F changed the models. That includes the 7 missing cells: carrier, ironvanguard, ironsovereign, gunner, stalker, workshop and rampart.
  3. Add `Window*` parts on any buildings R3-F left without them.
- **Acceptance:**
  - Contact sheets.
  - Budgets met.
  - The assets test passes.
  - A test that every unit type has a portrait cell.
  - +3 tests.

#### R3-K: Battle readability
- **Files owned:**
  - `src/army-readability-view.js`, `src/combat-feedback.js`, `src/status-view.js`;
  - the `beginDeath` area of `src/view.js` (line ~1347);
  - new `src/threat-arrows.js`.
- **Work:**
  1. Wide-zoom type icons (only at the widest zoom), reusing the `status-view.js` instanced atlas.
  2. Group number badges over units at close zoom.
  3. Gold trim and glow on `e.combined` squads.
  4. Off-screen threat arrows when your units take damage outside the view.
  5. Three death variants by damage type, pooled.
- **Acceptance:**
  - At most 4 extra draws in the battle scenarios.
  - Wide-zoom screenshot pairs.
  - Pins identical.
  - +4 tests.

#### R3-V: Victory ceremony and MVP card (all modes)
- **Files owned:** `src/results-ui.js`, the results part of `src/app/match-flow.js`, `src/app/defence/result.js` (seam with R3-E's Wave 1 work, already merged), `src/match-stats.js`, and new `src/ceremony.js` and `src/ceremony.css`.
- **Work:**
  1. **On a win:**
     - about 1.2 s of slow motion on the last kill (skipped with motion-off);
     - the camera swings to the MVP unit (most damage plus healing);
     - a star or medal stamp lands with a sound sting;
     - a confetti burst in team colour;
     - the stats count up.
  2. **On a loss:** "So close" plus one concrete tip taken from the match statistics.
  3. Expose an `onMatchEnd` listener list for R3-R.
- **Acceptance:**
  - `tests/ceremony.mjs` (matrix `r3-v`) reaches the results screen in Skirmish, a mission and Defence.
  - It sees `.mvp-card` with a name and portrait, and a stamp event.
  - Screenshots at 3 viewports.
  - The docks don't grow.
  - Pins identical.
  - +4 tests.

### Wave 3 (base `r3-wave-2`)

#### R3-R: Commander rank and unlocks (meta)
- **Files owned:** new `src/profile-rank.js`, `src/rank-ui.js` and `src/rank.css`; the title-screen rank chip; the skirmish setup unlock pickers (appended as rule options that never reach the sim).
- **Work:**
  1. XP from every match: win, medals, Defence waves and stars.
  2. About 20 ranks unlock cosmetic or choice-widening items:
     - unit paint schemes (a tint applied through `instanceColor` on the player's team);
     - emblems;
     - title banners;
     - Daily modifiers.
  3. Stored in the profile (localStorage, in try/catch). No sim impact.
  4. A rank-up toast on the results screen, through R3-V's `onMatchEnd`.
- **Acceptance:**
  - A unit test of the XP formula.
  - A browser test: a fresh profile shows rank 1; after a scripted win, "Rank up! Unlocked: …" appears and the paint can be picked.
  - Pins identical.
  - +5 tests.

#### R3-U: Audio juice
- **Files owned:** `src/sfx-bank.js`, `src/sfx.js`, `src/audio-logic.js`, `src/audio-mix.js` and `src/music.js` (stingers).
- **Work:**
  1. Layered impacts by size (small, medium, heavy).
  2. A synthesised unit "voice" chirp on select and on order, per type, with randomised pitch, at most 2 per second.
  3. Stingers on a boss phase change and on victory.
  4. A low-HP warning pulse.
  5. Quiet mode mutes the barks.
- **Acceptance:** a test in which a 60 s scripted battle fires at least 12 distinct SFX ids, with barks rate-limited and silent in quiet mode. +4 tests.

#### R3-Q: First-minute hooks
- **Files owned:** the title menu entry (`src/app/screens.js`, `src/start-screen.css`), a new `src/quick-battle.js`, and new Defence level-1 data (a new variant, not an edit of an existing level).
- **Work:**
  1. **Skirmish "Quick battle":** one tap from the title, a small pre-built base, enemy scouts at about 0:40. It is a new rule, so the pins are safe.
  2. **Defence level 1:** a roster preview strip before wave 1, and a "Scout Runner" bonus target worth alloy (in the new variant data and the new-player flow only).
- **Acceptance:**
  - A bot measures time to first combat: 45 s or less in Quick battle, 60 s or less in Defence level 1.
  - A one-tap start at 390×844.
  - +4 tests.

### Clean-up wave (integrator)
1. After each wave:
   - merge in the order of the wave table, union-merging the append-only files and fixing JSON commas and duplicate keys;
   - run `npx vite build` with its output visible;
   - run `npm test`;
   - run `baselines:diff --full`;
   - re-record **only the declared pins**, giving the reason in `docs/aaa/results/round3/wave-<n>.md`;
   - run `test:golden-full`, `check:defence`, `check:missions` (changed missions), and `test:ci-local` with 2 lanes;
   - keep the CI build job at 7 minutes or less on 2 cores;
   - tag the wave.
2. Code clean-up, with no behaviour change (pins identical):
   - remove unused exports and dead code found by a scan;
   - fold duplicated helpers;
   - delete one-off tools nothing uses.
3. Docs:
   - `docs/CHANGELOG.md` "0.26.0: AAA round 3" (proposed);
   - `docs/aaa/results/round3/review-packet.md` with the owner decisions;
   - an `IMPLEMENTATION_PROGRESS.md` row.
4. Remove every round-3 worktree and merged branch. Check for junctions first, and remove only round-3 worktrees.
5. Re-evaluate with three fresh reviewers on a local build, and compare with section 1.
6. **No push.** Deploy only when the owner says "deploy".

## 4. File-conflict matrix

**Wave 1**

| File | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| `sim/ai.js` | all but line 74 | | line 74 | | | |
| `sim/ai-attack.js`, `ai-counter.js`, `content/field-command.js`, `content/workshops.js` | own | | | | | |
| `sim/orders.js` | | all but `enqueue` | | | | |
| `sim/traits.js` | | `moveSpeed` | | | | |
| `simulation.js` | | | `maxPop` + line 270 | | | |
| `commands.js`, `sim/defence/armour.js`, `garrisons.json` | | | own | | | |
| `app/defence/sheets.js` | | | `armourSheet` | | rest | |
| `app/defence/input.js` | | | squad buttons | | rest | |
| `landscape-hud.css` | | group strip | | | Defence rules | |
| `mobile.css`, `desktop-dock.css` | | own | | | | |
| `app/briefing.js` | | | rules row | | | |
| `mission-looks.js`, `look-grade.*`, `environment-view.js`, `ambience.js` | | | | own | | |
| `tools/blender/*`, `public/models/*` | | | | | | own (not the Drone or bosses) |
| `balance.json` | append `ai_mix` | | | | | |
| `sim/content/index.js`, `vi.json`, `pages.yml`, `render-budget.mjs`, `debug-hooks.js` | append | append | append | append | append | append |

**Wave 2:** `story/missions.js` belongs to I, except H's import line and array entry. `mission-intros.js` and `story/campaign-map.js` belong to G, and H's entries come as a seam request. `view.js` `beginDeath` belongs to K. `match-flow.js` results part belongs to V. `portraits.js` and the atlas belong to J.

## 5. Owner decisions taken by default (change any)

| # | Decision |
|---|---|
| O1 | Group pace is on by default, with a Settings switch. |
| O2 | Army size is 100 by default, with 150 as an option, and 200 on desktop only. |
| O3 | The Combined squad step costs 320, the leash is 9, and the Defence bot doesn't buy it (Defence balance unchanged). |
| O4 | Veteran intake at Barracks level 3 is Expanded-only, and the Field drill research is cut (low value). |
| O5 | Only R3-I may move mission checksums and `golden-story`. Every mission stays winnable. |
| O6 | Only R3-A may move the Field-AI pins (`golden-w2d`, `golden-round2` arena, `field-command.test.js`). |
| O7 | Art changes are flagged "pending owner review (round 3)". |
| O8 | Deferred: S5 AI harassment, surprise events, the D14 night Gorge variant and the allied Vanguard boss. |

## Appendix: corrections applied from the code review

| # | Correction | Where in this plan |
|---|---|---|
| 1 | Pins that move with the Field AI listed | O6, R3-A |
| 2 | `ai.js` split between A and C; `workshops.js` given to A | R3-A, R3-C, section 4 |
| 3 | Reuse the Kite spotter, `aiSecondGroup` and `field-command`; gate edits away from missions | R3-A |
| 4 | Five factions and the right bench flags | R3-A |
| 5 | Long census check moved out of `npm test` | R3-A |
| 6 | Pop-cap line handed to C | R3-C |
| 7 | The pop default stores no key, and no new top-level sim field | R3-C |
| 8 | Field drill research cut, so there are no `economy.js` or `enqueue` edits | R3-C |
| 9 | Combined step outside `armourNextUpgrade`, so the bot doesn't crash | R3-C |
| 10 | "Elite" renamed "Combined" | R3-C |
| 11 | Replace the 1.9 m grid only when the flag is set | R3-B |
| 12 | Correct follow-order name (`support`), `moveSpeed` in `traits.js`, tether as a view plugin | R3-B |
| 13 | Reuse the existing group strip and keep the text format tests assert | R3-B |
| 14 | The night look exists; fix the grade instead, and drop the duplicate weather view | R3-D |
| 15 | The late storm is m06, not m10; it is fixed in the view table | R3-D |
| 16 | "Night Gorge" cut, since it is not a level | O8 |
| 17 | Windows as a name contract owned by F and J | R3-D, R3-F, R3-J |
| 18 | Defence badges only, plus `progress.js` | R3-E |
| 19 | Portrait atlas owned by J, the Sovereign ported with the boss tools, and `generate_factions.py` owned by F | R3-F, R3-J |
| 20 | Phase 2 on a new boss entry, and the allied boss cut | R3-H |
| 21 | Sovereign mission in its own file | R3-H |
| 22 | Declared R3-I moves and scope | R3-I |

## Status (2026-11-22, tag `r3-final`)

Shipped on `feat/aaa-round3`, not pushed: wave 1 (A, B, C, D, E, F), wave 2 (G, H, I, J, K, V, plus L, W and M), wave 3 (R, U, Q, X), the phone HUD, six new Skirmish maps and the painted campaign map, Korean, the UI kit (with its final polish) and the copyright notice. CI robustness work (`r3/ci-robust`) is in with the kit. Deferred items are the ones in section 5 (O8). Open owner decisions: `docs/aaa/results/round3/review-packet.md`. Release notes: `docs/CHANGELOG.md` "0.26.0: AAA round 3" (proposed).
