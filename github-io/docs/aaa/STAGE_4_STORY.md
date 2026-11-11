# Stage 4: story delivery

Read [README.md](README.md) and `docs/WORLD.md` first. Goal: the story that exists on paper is staged, heard and shaped by the player. The writing (premise, cast, arcs, twelve missions) stays; this stage changes how it is told. Can start after stage 1. Release as 0.17.0 (scenes, voice), 0.18.0 (decisions, veterans), 0.19.0 (campaign map, endings).

**Today:** the mission engine (`src/sim/missions.js`) emits `say`, `objective`, `point`, `camera`, `ping`, `music` and `missionEnd` events; `src/mission-ui.js` shows the briefing overlay, dialogue lines with a rendered portrait, the Comms log and the debrief. Progress is `{ cleared: { [missionId]: { time, medal } } }` in `src/campaign.js`. The Commander never speaks and never chooses.

**Writing rules for new lines.** Keep each character's voice from the cast table in `docs/WORLD.md` ("How they speak"). A line is one or two sentences. The Commander never speaks; choices are written as orders ("Return the alloy"), not as dialogue. Every new line goes into `src/locales/story-vi.json` in the same change. List all new lines in a review file `docs/aaa/review/story-lines.md` for the owner to read before release.

## Package 4.1: staged scenes

**What a scene is.** A short scripted sequence (5 to 15 s) played by the client while the simulation is held. It changes nothing in the simulation, so saves and replays are unaffected; anything that must really happen (units arriving, a building switching sides) is done by ordinary mission actions before or after it.

**Data.** New file `src/story/scenes.js`:
```js
export const SCENES = {
  "relay-wakes": {
    letterbox: true, music: "wonder",
    beats: [
      { camera: { at: "riverRelay", zoom: 0.7, orbit: 25, seconds: 3 } },
      { fx: { type: "relayPulse", at: "riverRelay" }, sound: "relayWake" },
      { say: { who: "okoro", text: "It is answering. Commander, it is answering us." }, seconds: 3.5 },
      { camera: { at: "ashCamp", zoom: 1, seconds: 2.5 } },
      { fx: { type: "lightsOut", at: "ashCamp" } },
      { say: { who: "vale", text: "Their camp just went dark." }, seconds: 3 },
    ],
  },
};
```
A new mission action `{ scene: "relay-wakes" }` emits a `scene` event. The region names in this example are illustrative: use the mission's own `regions` (mission 1 has `oldRelay` and `ford`) and add regions where a scene needs one.

**Client** (new `src/app/scenes.js`, registered like the other `app/` modules)
- On a `scene` event: enter the `held` screen state (`src/app/screens.js`; add `scene` as a legal hold reason and unit-test the move table), hide the HUD, show letterbox bars (CSS, 9% top and bottom, none on 844x390 where height is short: there the HUD just fades), play the beats, then restore the camera to where the player had it and release.
- Camera beats ease position, zoom and an orbit angle; the fog of war is lifted only inside a disc around the scene's regions for the duration, and only for regions the mission lists in the scene (no accidental scouting).
- Skip: any key, a tap on "Skip" (44 px, bottom right), or Escape. Skipping still shows the lines in the Comms log. With `combatMotion` off the camera cuts instead of easing.
- A scene never plays twice in one match; a loaded save resumes after it.
- New effects in `src/fx.js` are named and small: `relayPulse` (ring and column of light), `lightsOut` (building lights fade), `beam` (a line to the sky), `mapGlow` (ground lines lighting between regions). One or two draws each.

**The six scenes** (ids and where they fire; write the beats from the twists in `docs/WORLD.md`):

| Scene | Mission and trigger | The moment |
|---|---|---|
| `relay-wakes` | 1, when the hold objective completes | The relay answers; the Ashfall camp across the river goes dark |
| `beam-to-orbit` | 3, when the north siphon dies | The beam points at the sky: Hale is feeding a sleeper fleet |
| `the-truce` | 4, at the truce trigger | Ashfall and Sunward columns turn and face the player together |
| `one-circuit` | 7, when the circuit map goes out | Lines of light join every relay on the map |
| `sol-crosses` | 9, at Sol's change of side | Sunward banners (emblems) switch to the player's allies |
| `echo-says-i` | 12, before the final objective | The Keystone lights; ECHO says "I" |

**Tests.** Unit: scene data validates (known cast ids, regions exist in the mission, total length under 20 s, every line has Vietnamese). Browser (`tests/scenes.mjs`, new): the scene holds the simulation clock, hides and restores the HUD, restores the camera within 0.5 m, can be skipped by key and by tap, never reveals fog outside its regions, and works at the three viewports. Fire scenes in-page with a test hook rather than playing the mission.

## Package 4.2: voice tones

**What.** No recorded speech. Each character has a short synthesised tone that plays per syllable-sized chunk while their line types out, in their own pitch and timbre. It works the same in English and Vietnamese.

**Work**
- `CAST` entries in `src/story/world.js` get `voice: { pitch: Hz, spread: semitones, wave: "triangle" | "square" | "sine" | "saw", rate: chunks per second, formant: Hz }`. Suggested characters: Vale low and even; Okoro higher with wide spread; Hale low, slow, narrow; Sol warm mid, quick; Maren soft sine, slow; ECHO two detuned sines, no spread until the finale where it gains spread.
- Pure logic in `src/audio-logic.js` (`voiceChunks(text, voice, seed)` returns times and pitches; deterministic from the text; pauses at punctuation); playback in `src/audio.js` through the effects bus, ducking music by 3 dB.
- Dialogue text reveals at the voice's rate (typewriter). A tap or key completes the line at once; a second advances. Reduced motion shows the full line immediately and plays a single tone.
- Setting "Character voices" (on by default) in the sound section of the settings dialog. Volume follows the effects volume.

**Tests.** Unit tests for `voiceChunks` (deterministic, pauses, length bounds). `tests/audio.mjs`: the setting works, tones stop when a line is skipped, nothing plays while muted. `npm run render:audio` renders one sample line per character to check levels.

## Package 4.3: Commander decisions

**Mechanics**
- Mission action `{ decide: "m03-alloy" }` emits a `decision` event; the client holds the match and shows a choice card (the speaker's portrait, one sentence of prompt, two buttons with a one-line consequence each). The answer is sent as `sim.command({ team: 0, type: "decide", id, option })`, so it is in the command log and replays.
- The simulation stores answers in `sim.flags` (saved). A decision not yet answered blocks nothing in the rules; the engine simply waits for the command before running the rest of that trigger's actions.
- Mission data can branch on flags: any `setup` entry, trigger, objective, briefing or debrief line may carry `if: { flag: "m03-alloy", is: "return" }`. Document in `docs/MISSIONS.md`.
- At mission end, the flags set in that mission are written to campaign progress (`decisions: { [id]: option }` in `src/campaign.js`; old progress loads with none). A later mission starts with those flags (`Simulation` option `flags`). Replaying an earlier mission lets the player change a decision; the new answer replaces the old one from then on.
- A missing decision (the player jumped ahead, or an old save) uses the option marked `default: true`.

**The three decisions**

| Id | When | Options | Now | Later |
|---|---|---|---|---|
| `m03-alloy` | Mission 3, after the north siphon reveals the beam | **Return** the siphoned alloy to Ashfall's fleet / **Keep** it (default) | Return: −300 alloy. Keep: +300 alloy | Mission 7: with Return, Hale's battery arrives 45 s later and one Ashfall wave is removed, and Hale has a different line. Counts as *mercy* |
| `m04-oasis` | Mission 4, when the hold objective completes | Leave Sol the **east oasis** / **Hold all three** (default) | East: that point passes to Sunward. All: an extra Sunward wave | Mission 9: with East, Sol joins with 6 Riders and a Supply wagon at the start; otherwise 3 Riders at 3:00. Counts as *mercy* |
| `m10-relay` | Mission 10, when the Crown lights | **Spare** Maren's dark relay / **Break** it (default) | Spare: the Veil team stops attacking for the rest of the mission. Break: +1 capture point income | Mission 12: with Spare, the Veil stands down at 4:00 instead of at the Keystone, and Maren speaks in the finale. Counts as *mercy* |

Each option needs its lines (prompt, both button texts, the reaction, the changed later lines) written to the cast's voices and added to both story catalogues.

**Tests.** Unit: the decide command is logged and replays to the same hash; flags save and load; `if` filters apply to setup, triggers and lines; defaults apply when missing; progress migration. `tools/mission-check.mjs` runs missions 7, 9 and 12 under both values of their flag and both must meet the targets. Browser: the choice card at three viewports (44 px buttons, focus trapped, keys 1 and 2), Vietnamese.

## Package 4.4: veterans carry over

- At a mission win, the player's six highest-ranked surviving combat units with rank 1 or more (ties: most kills) are written to campaign progress: `veterans: [{ type, rank, kills, name }]`. Names come from a fixed list in `src/story/world.js` (30 short names, not gendered), assigned when a unit first reaches rank 1, deterministic from the unit id and mission id.
- The next mission spawns them beside the Command core (or with the fixed squad in no-base missions) at tick 0, with rank and name, unless the mission sets `rules.veterans: false`. A type the mission's roster does not allow is skipped and kept for later.
- Veterans that die are removed at mission end. Retrying a mission restores the list as it was when that mission was first entered. Veteran difficulty: a dead veteran is gone even on retry (state this on the difficulty selector).
- Interface: the name and rank show in the unit info panel and above the unit when selected; the debrief has a "Carried forward" row with portraits; the briefing lists who is coming. A veteran's death gives a one-line notice by name.
- `tools/mission-check.mjs` runs with no veterans (the baseline) and with six rank-2 veterans; the second must not win faster than 0.75× the first, or the bonus is too strong (reduce the rank stat bonus for carried units).

**Tests.** Unit: selection rule, name determinism, spawn placement is standable, removal on death, retry restore, progress migration. Browser: the three interface places at three viewports.

## Package 4.5: campaign map and archive

- **Campaign map** replaces the mission list in `src/app/briefing.js` (keep the list as the keyboard and screen-reader structure: the map nodes are the same buttons, positioned). An original drawn map of the frontier (inline SVG, built from data in `src/story/world.js`: seven regions matching the seven maps, twelve mission nodes, relay lines between them). Cleared missions light their relay line in the player's colour; the next mission pulses; locked ones are dim. Each node shows number, medal and Veteran mark. Selecting a node shows the existing briefing panel.
  - 1440x900: map left, panel right. 390x844: the map is a vertical path that scrolls inside its own box, panel below. 844x390: map left at 55% width, panel right.
  - Acts are bands of the map with their titles.
- **Archive** (new dialog from the start screen): Cast, Factions, Decisions made. Entries unlock as the player meets them (cast: first line heard; factions: first mission against them). Text comes from `src/story/world.js` (`character`, `goal`, portrait), shortened to two or three sentences for the player. Unseen entries show a silhouette and "Not met yet".

**Tests.** `tests/campaign.mjs` and `tests/layout-f.mjs` extended: sizes, no sideways scroll, keyboard order equals mission order, progress states, Vietnamese. Unlock logic unit-tested.

## Package 4.6: two endings

- After mission 12's debrief, an epilogue of five cards (portrait, two or three sentences each, the campaign map behind with every relay lit), then a credits card ("Made by" as the owner specifies) and a return to the menu.
- **Ending "The Garden"** (two or three *mercy* decisions): the Keystone is tuned; the Ashfall sleepers wake over a year; Hale signs the circuit; Maren reopens the highlands; ECHO chooses a name.
- **Ending "The Wall"** (none or one): the Keystone holds but the draw is rationed; Ashfall leaves orbit with half its people awake; Sol keeps the roads open; Maren keeps the highlands dark; ECHO says "I" and asks to be left counting.
- Both are honest outcomes of the player's choices, not a good and a bad ending. Cards per ending: Vale, Sol, Hale, Maren, ECHO.
- The archive records which ending was reached; the campaign map shows a small mark. Replaying with other choices can reach the other one.

**Tests.** Unit: ending selection from decisions, including defaults. Browser: the epilogue at three viewports, skippable, Vietnamese, returns to the menu with progress saved.

## Stage 4 exit check

- `docs/aaa/review/story-lines.md` lists every new line in English and Vietnamese, and the owner has read it.
- A full campaign can be completed by the bot down both decision paths.
- Old campaign progress from 0.9.4 loads and continues.
- Scenes, voices and the choice card all respect reduced motion, mute and the three viewports.
