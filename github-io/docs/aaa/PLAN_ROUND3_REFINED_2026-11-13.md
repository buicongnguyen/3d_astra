# Round 3 plan, refined after logic and code review (2026-11-13, at 0.15.1)

> **Status 2026-11-13: finished (0.16.0–0.19.0).** Each item's state and what was left out is
> recorded in [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md), "Round 3".

This refines [PLAN_ROUND3_2026-11-13.md](PLAN_ROUND3_2026-11-13.md). The goals and the owner's decisions
are unchanged: Defence in the campaign and as a mode, new light music, air units, more campaigns
and endings.

Three reviews read the code behind every item:
- simulation rules;
- the Defence mode;
- story, factions and music.

This file records what they found, what changed, and the order of work. Paths are relative to
`github-io/`.

## 1. What the review changed

### Facts that were wrong or missing in the first plan

| # | Finding | Consequence |
|---|---|---|
| F1 | Only plateau cells more than 5 m inside the rim are hidden from below (`hidden_depth`, `sim/vision.js:35`). Towers can stand 3.5 m from the edge. | **Rim pads** are close and visible; **deep pads** are hidden but reach less. Each pad is marked. This trade-off is kept. |
| F2 | Ground spotters already work: one friendly unit on a plateau opens it to the whole team. | No new sim code for spotters. Only the AI and the hint need work. |
| F3 | A flyer over low ground counts as "low", and a flyer over a deep cell would be **invisible to everyone below** (`isVisible` works per cell). | Air needs the `low` fix and its own seen-by mask, `airSeenBy`. |
| F4 | Barrage and Burn line can target fogged plateau tops (`sim/tactics.js:73`). | Add a sight check for deep plateau cells only, so flat maps behave as before. |
| F5 | Bridges are 10 m wide (`CROSSINGS half: 5`), not narrow. The ford doesn't slow anyone. | Kill zones come from the ford slow-down and per-map crossings. |
| F6 | Bridge demolition can be deterministic: `terrain.water` rectangles plus `nav.rebuild`. It must be re-applied in `snapshot.restore`, or a loaded match walks over a blown bridge. | Moved to 0.21. Allowed only in Defence maps and missions that turn it on, never in Skirmish (the AI can't answer it). |
| F7 | Pontoons "by engineers": the Wardens have no engineers. | Pontoons become a Defence wave behaviour (`bridger` units). |
| F8 | In a Defence match, **both teams are eliminated on the first tick**: there's no HQ (`settle`, `simulation.js:382`). Wall entities also fall back to phantom ROCKS (`navigation.js:63`). | Defence maps skip bases, deposits and rocks. `settle` gets a defence branch. |
| F9 | Waves on `attackmove` chase any target within 12 m, so they leave the route. | A new **route order** that fires only within the unit's own range and never chases. |
| F10 | The tower level code needs HQ tech, takes 20–30 s, and rebuilds stats from `D[type]`. | Defence tiers are instant and stored on the tower (`crew`, `tier`). They don't go through `upgradeBuilding`. |
| F11 | `e.garrison` already means "mission guard". | Use `e.crew`. |
| F12 | `modelsForMatch` scans only `setup` and `triggers`. | It must also scan the `defence` waves, or models are missing. |
| F13 | Each health bar is one draw. A wave under fire adds about 100 draws. Story buildings carry a sprite emblem each. | In Defence, show bars on the 12 weakest enemies only and no emblems on crewed towers. The budget test spawns damaged units. |
| F14 | At the maximum zoom of 88, a full valley doesn't fit in portrait, and a 3 m pad is about 29 px. | Routes run along the screen's vertical. Default zoom about 70, with an Overview toggle up to 96. Pads are picked by the nearest pad within 26 px (a 52 px target). |
| F15 | `production-ui.css:10` uses `system-ui` (a house-rule breach) and a 9 px line height. Nothing on the root says "Eco" or "reduced motion". | Fix in 0.16. Add a `:root.motion-off` class that every animated effect obeys. |
| F16 | Campaign progress is dropped on load and on every win, except `cleared` (`campaign.js:23-61`). Unlocks go by position. The checker's targets go by position. | Fix first in 0.19a, before any mission is inserted. |
| F17 | Continue uses today's mission data, not the saved one (`match-flow.js:211`). A save taken while a choice card is open would lose the card. | Fixed together with decisions. |
| F18 | Paused screens suspend audio, so scenes and choice cards would be silent. | Add a `scene` screen with an audio exception. |
| F19 | Recorded music: decode it, then loop with `AudioBufferSourceNode` (a media element leaves a gap on iOS). Store exact loop points (AAC adds silence at the start). Put files in `public/music/`, or the service worker precaches them. Keep `fc-music` in the worker's cache list. | Built into 0.16. |
| F20 | Hold the River, Hold the Valley and Wings over Copper need 0.17 and 0.18. 0.19 was too big. | Split into **0.19a** (decisions, endings, campaign map, progress fixes) and **0.19b** (scenes, reworks, new missions). |
| F21 | Stage 4 and the plan disagreed on the decision missions and the ending rule. "Across the Mountains" doesn't exist in the studio folder. | One rule, section 2. The studio tracks are dropped; a new set is generated. |
| F22 | Watcher is a Veil unit. Walker is a Wardens unit. Towers already detect cloaks. | Defence crews come from the player's roster. A Watcher post gets a bigger reveal reach. |
| F23 | The draw-budget numbers were inconsistent: battle-eco has a limit of 120 and measures 107. | The Defence wave budget is ≤ 120 on the phone view, under the same harness as battle-eco. |
| F24 | `tools/playbot.mjs` hard-codes Meridian unit names. | Map them through `typeFor`/slots in 0.16; chronicles and faction choice need it. |
| F25 | Defence maps would show up in Skirmish. There are already three modes, so Defence is the fourth. | Filter them out of Skirmish. Update `MODES`, `initialMode` and `readSave`. |

### Cuts and simplifications

- **Terraces:** cut (engine assumes two heights). Single plateaus and ramps give the climb.
- **Ember balloon wind drift:** cut (needs a deterministic wind system).
- **Towers hit air:** only after the **Flak** research, which is one Foundry research, stored lazily.
- **Ford "no cover":** dropped; cover doesn't exist yet.
- **Chronicles:** 3 missions each instead of 4, led by cast who already have portraits. A finished
  chronicle adds **lines** to the finale; an ally squad is added only if the checker passes with
  and without it.
- **Mixed-faction Defence waves:** 0.21 (needs a coalition setup).
- **Barrage from towers:** cut (abilities belong to units).
- **Music:** I choose the takes by measured scores and the owner can swap them. "Adaptive only" in
  Settings turns recorded music off. The listen page stays in the experiments folder.
- **Air models:** shipped from our Blender kit; the owner refines them later, as agreed.

## 2. Story rules (one version)

- Three decisions, in **m03** (the alloy), **m05** (the pact) and **m10** (the Veil). They're kept by
  mission id, not number.
- Each option is either *merciful* or *firm*. A missing answer uses the option marked `default`.
- **Ending:** two or more merciful choices give **"The Open Frontier"** (shared Keystone, the
  factions sign a truce). Otherwise it's **"The Meridian Line"** (Meridian holds the frontier
  alone). Neither is good or bad.
- The ending changes the finale's last objective and its lines. Ending cards: Vale, Sol, Hale,
  Maren, ECHO.
- Every new line goes into `story-vi.json` in the same change, and is listed in
  `docs/aaa/review/story-lines.md`.

## 3. Releases

Each release goes through: unit tests, the full local browser matrix (two lanes on preview port
4231 with `--host 127.0.0.1`), the mission and bench checks it affects, a CHANGELOG entry, one push,
then CI success and a check of the live version.

### 0.16 "Hold the Line": foundations

| # | Work | Main files | Checks |
|---|---|---|---|
| 16.1 | **Choose your army in Skirmish.** Picker. Team 0 faction merged into the factions. `playerFactionOf`. Mirror means the player's faction; Mixed leaves it out. Neutral opening and defeat lines. Team-0 emblem by faction. Tutorial forced to Meridian. Playbot unit names by slot. | `main.js`, `factions.js`, `app/match-flow.js`, `app/shell.js`, `simulation.js:142,404`, `view.js:970`, `tools/playbot.mjs`, settings | Unit: each faction starts and plays. Bench: each faction plays the Normal bot. Browser: the picker at 3 viewports. Vietnamese. |
| 16.2 | **Terrain rules you can see.** Ford −40% speed and no abilities in the ford. Barrage and Burn line need sight of deep plateau cells. A terrain-based "hidden from below" mark (no fog leak). A first-time hint. Ramp kill-zone marks on the ground and minimap. | `sim/traits.js:98`, `sim/tactics.js:60,73`, `selection-status.js`, `tactics-view.js`, `app/minimap.js`, `ui-extras.js` | Unit tests per rule. Sim hash `d071360b` unchanged. High-ground bench still favours the high side. Faction bench and missions on river maps re-run. |
| 16.3 | **Abilities you discover, and motion-off.** Ready abilities pulse. A first-time hint per ability. Barrage target ring and incoming whistle. A `:root.motion-off` class (Eco, combat motion off, reduced motion). The `system-ui` fix. | `app/hud.js`, `tactics-view.js`, `sfx-bank.js`, `app/preferences.js`, `production-ui.css` | Browser: pulse and hint; no animation under motion-off. 11 px / 44 px. |
| 16.4 | **Recorded music.** `RecordedMusic` on the music bus, decoded and looped at exact points from `public/music/manifest.json`. Loads after the first tap. Title, campaign and defence cues; victory and defeat stings. Setting: Recorded + adaptive / Adaptive only / Off. Crossfade rule: the adaptive score rules in battle; recorded music plays on menus, briefings, the campaign map and Defence between waves. Service worker: cache music on first play, keep `fc-music`. | `src/music-recorded.js` (new), `audio.js`, `audio-logic.js` (`musicPlan`), `app/sound.js`, `settings*.js`, `tools/sw.template.js`, `tools/first-visit.mjs`, `public/music/` | Unit: `musicPlan`; files ≤ 2 MB. Browser: nothing fetched before the first tap; nothing fetched under Adaptive only; the precache list has no audio. First visit unchanged. |

### 0.17 "Frontier Defence": the mode

| # | Work | Main files |
|---|---|---|
| 17.1 | **Defence rules** (`src/sim/defence.js`, created lazily):<br>• a mission-shaped definition with a `defence` block: lives, alloy, routes, exit, pads, crews, waves, camera, medals by lives;<br>• maps flagged `defence` skip bases, deposits and rocks; `settle` and `missionResult` branches;<br>• a route order with lane offsets that never chases;<br>• a trickle spawn queue;<br>• kill payout (one tenth of the unit's cost), leaks cost lives (2 for heavy units);<br>• crewed towers: `tower` + `crew` + `tier`, stats from `src/defence/garrisons.json`, instant tiers 1–3, sell for 60%, full heal after each wave;<br>• commands `padBuild`, `padUpgrade`, `padSell`, `waveCall`;<br>• fog off for the player in Defence;<br>• `modelsForMatch` scans the waves. | `src/sim/defence.js`, `simulation.js`, `sim/missions.js`, `commands.js`, `model-roster.js`, `maps.json` |
| 17.2 | **Two maps and two levels.** *Gorge Road* (valley): the route climbs past rims, with rim and deep pads, and ends up a ramp. *Twin Bridges* (river): the riverlands river, with routes over the bridges and the ford, which slows units. 10 waves each, one enemy faction per level. | `maps.json`, `src/defence/levels.js` |
| 17.3 | **Defence UI.**<br>• A fourth title button, a level list with stars, and progress (`frontier-defence-v1`).<br>• Pads drawn as one instanced draw with a hidden/rim mark.<br>• Crews as batched clones on the towers; tier trims through `userData.tint`.<br>• A pad sheet in the command tiles; Upgrade and Sell.<br>• Lives, wave and countdown chips; Call wave; Overview zoom.<br>• Flame tier look in `src/defence-ui.css`: borders, a tier-3 glow, a 6-span ember burst; all off under motion-off.<br>• Health bars capped at the 12 weakest enemies.<br>• Loaded lazily. | `src/app/defence-ui.js`, `src/defence-ui.css`, `src/defence/progress.js`, `view.js`, `app/shell.js`, `screens.js`, `state.js`, `savegame.js`, `hud.js`, `vi.json` |
| 17.4 | **Bot and budget.**<br>• `tools/defence-check.mjs` with a `DefenceBot`: it must reach the target stars, an empty field must lose, and one tower type alone must not get 3 stars.<br>• A `defence-wave-eco` render-budget scenario (120 enemies, half of them damaged, 10 towers): ≤ 120 draws.<br>• Data tests: pads stand on solid ground, keep clear of the route, and never seal it.<br>• The `tests/defence.mjs` browser suite, added to the CI matrix. | `tools/`, `tests/` |

### 0.18 "Wings": air

| # | Work |
|---|---|
| 18.1 | **Air rules.**<br>• `flying` and `hits_air` in `balance.json` (hits_air: ranger, rider, drone, antitank, watcher; every faction has two or more).<br>• Flyers move straight within bounds, separate only from flyers, and skip the line-of-fire, height and splash rules.<br>• Targeting and attack orders refuse flyers without `hits_air`.<br>• The vision `low` fix, `airSeenBy`, and flyers see plateau tops.<br>• Air cap 4 (alive plus queued), with population cost. Flyers can't capture.<br>• Flak research (towers hit air, ×1.5).<br>• AI: an air count in what it has seen, the anti-air answer, Flak after 2 flyers, a Kite sent ahead of attacks. |
| 18.2 | **Four models from `tools/blender/frontier_kit.py`:** Kite scout (everyone, Barracks L2: detects cloaks within a short reach), Hawk gunship (Meridian, Foundry L3), Ember balloon (Ashfall, splash bomber), Swift glider (Sunward, raider).<br>• ≤ 1,500 triangles each; review sheets in `docs/aaa/review/`.<br>• Fly height in the view; blob shadow and bob; shot events at altitude.<br>• Portraits appended to the atlas; sounds. |
| 18.3 | **Air in Defence:** spotter and balloon waves on both maps. The bot must still reach its stars. |

Checks: `d071360b` unchanged; air unit tests (targeting, cap, vision over a plateau, save and load);
faction bench inside its bands; render budget.

### 0.19a "Choices": decisions, endings, campaign map

| # | Work |
|---|---|
| 19a.1 | **Progress fixes first** (`campaign.js`): keep every field; a mission opens if it's cleared or the one before is; checker targets keyed by mission id; Continue uses `sim.missionDef`; a mission-by-id lookup. |
| 19a.2 | **Decisions:**<br>• `decisions` in the mission data and a `{decide:id}` action, held in `mission.pending`;<br>• a `decide` command (logged and replayed) and lazy `sim.flags`;<br>• `if` filters, resolved before the match by `resolveMission(def, progress)` and live for choices made in the match;<br>• a choice card (portrait, prompt, two orders, keys 1 and 2, 44 px), restored when a save loads;<br>• the bot answers default or mercy. |
| 19a.3 | **Two endings:** `endingFor(progress)`, the finale's variants, epilogue cards, `endingsSeen`. |
| 19a.4 | **Campaign map screen:** acts, relays lighting up, endings seen, a slot for chronicles. Works at 3 viewports. |

Checks: decisions replay to the same hash; both endings reachable in the checker (m07, m09 and m12 on
both branches); older progress loads; the story-strings tool covers decisions and endings.

### 0.19b "Story you see": scenes and 15 missions

| # | Work |
|---|---|
| 19b.1 | **Scenes** (`src/story/scenes.js`): letterbox, eased camera moves only to explored places, lines, effects and waits; a `scene` screen with audio. Six big moments. Skippable; motion-off respected. |
| 19b.2 | **Rework m02, m06, m09, m10 and m11:** a bridge assault, a storm-free copper fight that uses the ford, a high-ground hold, Wardens and Veil earlier. |
| 19b.3 | **Three new missions,** making 15: *Hold the River* (Defence rules on Twin Bridges), *Hold the Valley* (Defence rules on Gorge Road), *Wings over Copper* (the first air raid). Hard-coded "12" in tests updated. |

Checks: the mission checker on all 15 at three difficulties (Veteran m12 judged by playing it, as
before); a story-lines review file.

### 0.20 "Chronicles"

| # | Work |
|---|---|
| 20.1 | **Four chronicles of 3 missions each,** played as that faction (`factions:{0:…}`), on existing maps and the two Defence maps. Each has its own form of address and portrait lead. Continue, header and debrief work per campaign. |
| 20.2 | **A finished chronicle adds its lines to the finale.** |

### 0.21 "Defence complete"

| # | Work |
|---|---|
| 21.1 | Two more crews (Tank emplacement, Scorcher flame trap) and tier-3 branches (Breaker Cluster/Guided, Ranger Marksman/Suppressor, Anti-tank Heavy/Rapid). |
| 21.2 | **A commander on the field:** a hero unit that walks the valley, with Barrage and Reinforce. Four more levels, making 6. Stars buy small perks. |
| 21.3 | **Bridge demolition and pontoons** (Defence only): `sim.crossings`, re-applied on load; a 3 s fuse that pushes units to the bank; it can never close the last crossing; `bridger` wave units rebuild a bridge in 20 s unless killed. |
| 21.4 | Mixed-faction waves (coalition), endless mode and a daily seed with a local best score. |

## 4. Speed rules (every release)

- **Phone battle draw calls:** at most 10% above today's numbers.
- **Defence wave:** ≤ 120 draws on the phone view.
- **First download:** the code grows by at most 10%. Defence UI, air models and music load on first use.
- **Effects:** capped pools that follow the governor and motion-off.
- **Measuring:** draw counts only; fps on this shared machine is noise.

## 5. Working method

- One agent per big item, each in its own worktree (`..\3d_astra-wt\<name>`, `node_modules`
  junction), owning its files.
- I review each agent's screenshots and diff, merge, run the full matrix, push once per release,
  and watch CI.
- No dev server: `vite build` plus `vite preview --host 127.0.0.1 --port 4231 --strictPort`.
- Kill processes only by exact PID or port. Remove only my own worktrees (unlink the junction first).
