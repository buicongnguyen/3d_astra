# R3-G results: openings and a living campaign map

Branch `r3/g-openings`, base `r3-wave-1m` (includes the merged R3-M cover). View and UI only: no sim, balance, mission, pin or baseline change. Port slot 4232.

## What changed

### 1. Mission openings (`src/story/openings.js`, `src/app/scenes.js`, `src/openings.css`)

- **One shared fly-in, a table keyed by mission id.** A row gives the landmark (`at`: a region of the mission, or `{ x, z }` for the three Defence missions, plus an optional `offset`), what it frames (`bridge`, `plateau`, `camp`, `road` or `objective`), the start zoom (× the view's default), a drift and the length. Nothing is added to a mission definition, so mission checksums and saves are untouched.
- **The move.** The camera starts on the landmark, wider than play, drifts a few metres while the act, title and place read in the letterbox (the title card's gold and white), then glides home with a smoothstep to exactly where the match starts (`focusHome`, or the Defence mission's own wide camera). The title fades at 78 % of the opening, before the camera lands.
- **Short and skippable.** 4.6 to 5.6 s (limits 4 to 6 in the table). Skip (44 px), a tap anywhere, Escape, Space or Enter end it at once and put the camera home. The match clock waits on the existing "scene" screen (music plays on), so nothing happens off-screen.
- **When it plays.** A campaign mission that has just begun (sim time ≤ 0.3 s, so not a resumed save), once per mission per page visit (a restart or a retry goes straight in), after any prompt opened at the match's start. Not for Chronicle missions, skirmish, Training or Frontier Defence levels. Browser suites (`?test`) see it only with `?opening`.
- **Calm.** Like the title cover: reduced motion or "Animate combat effects" off skip it. Eco graphics alone keep it (phones default to Eco, and a camera move draws nothing extra).
- **Fog of war.** The landmark is usually unexplored at the start. While the opening runs, the view draws the land without the fog (its fog texture is swapped for a clear one and the fog plane hidden). Units and buildings out of sight stay hidden, so no intel leaks. Everything is restored when the opening ends, and the simulation's explored map is never touched.
- **Phones.** For the opening, the strip under the (hidden) dock is drawn too, so the fly-in fills the letterbox. The HUD's own choice is restored afterwards.
- **Night.** The Quiet Vault opens on its vault gate by the map's far corner, so the very dark blue night sky and its moon fill the top of the frame (the R3-D seam request).

| Mission | Frames | Start (x, z) | Start zoom | Seconds |
|---|---|---|---|---|
| m01 First Light | objective (old relay) | 0, 10 | 55 | 4.6 |
| m02 First Contact | bridge (bridgehead) | −22, −14 | 49 | 4.6 |
| m02b Hold the River | bridge (east crossing) | 22, −18 | 44 → Defence 78 | 4.8 |
| m03 The Ashen Line | camp (Vanguard yard) | −4, −30 | 48 | 5.0 |
| m04 Three-Way Dunes | objective (centre oasis) | 2, −2 | 65 | 4.8 |
| m05 The Verdant Pact | bridge (north bridge) | −2, −14 | 49 | 5.0 |
| m06 Copper Harvest | objective (the seam) | −44, −18 | 53 | 4.8 |
| m06b Wings over Copper | camp (airfield yard) | 48, 6 | 53 | 4.8 |
| m07 Copper Siege | road (east road) | 8, 40 | 51 | 5.0 |
| m07b Hold the Valley | road (gorge entry) | −25.6, −38.3 | 42 → Defence 70 | 4.8 |
| m08 The Quiet Vault | objective (vault gate, moon) | −38, −38 | 61 | 5.4 |
| m09 A Debt in the Dunes | camp (Sol's camp) | 37, 36 | 53 | 4.8 |
| m10 Obsidian Storm | plateau (the Crown) | 14, −10 | 61 | 5.2 |
| m11 Cut the Draw | bridge | −12, 12 | 53 | 4.8 |
| m11c Hold the Keystone Roads | road (north fan) | 4, −44 | 46 → Defence 92 | 5.0 |
| m12 Frontier's End | objective (the Keystone) | 14, −26 | 61 | 5.6 |

**Acceptance: all 16 openings are distinct.** The campaign has 16 missions; the plan said 15. The closest two starts are 11.3 m apart (m02b and m10). Every pair passes "at least 10 m or 20°" on distance alone. Each opening starts at least 15 m from home.

Contact sheet (start frames, 1280×800, 1 s in): `g/openings-sheet.jpg`.

### 2. A living campaign map (`src/campaign-map-ui.js`, `src/story/campaign-map.js`, `src/campaign-map.css`)

- **Choice markers.** A gold hollow diamond (`.cmap-ahead`) marks every relay that still holds an unanswered decision (m03, m05, m10), locked ones too, so the player sees where choices come. Answered decisions keep their merciful (mint circle) or firm (gold diamond) mark. The new mark has its own class, so the `.cmap-choice` lists the older suites check are unchanged.
- **Ending hints.** Each ending names what leads there: "The Open Frontier · 2+ merciful choices" and "The Meridian Line · 0-1 merciful choices" (the rule of `endingFor`). A seen ending is still the button that replays its epilogue. The legend adds "Ahead" and counts the merciful choices made so far ("1 / 3 merciful"; it counts only answers given, while the ending also counts defaults).
- **Desktop: chronicles above the fold.** The endings, their hints and the legend share one line, and the four chronicle cards get the footer's full width below it. The names no longer break mid-word ("Ashfa ll", "Sunw ard" before). The chronicles end at 677 px of 900 (1440×900) and 553 px of 720 (1280×720). Below 820 px tall the board gives way first and the briefing paragraph steps aside.

### 3. Phone campaign layout (the cover-integration item)

| | Before (r3-wave-1m) | After |
|---|---|---|
| Portrait 390×844: missions fully above Start | 1 | **3** |
| Landscape 844×390: missions fully above Start | 2 | **3** |
| Endings on phones | two bare 44 px rings | short name + hint ("Open Frontier / 2+ merciful choices") |
| Chronicles on phones | portrait and pips only | portrait, faction name, pips |
| Landscape mode tabs | no icons | icon above the name, 46 px |
| Desktop 1440×900 / 1280×720 missions above Start | 7 / 4 | 7 / 4 |
| Text < 11 px, taps < 44 px, sideways scroll | none | none |

How: in the campaign view on phones the hero sizes to its content (portrait board 206–240 px, which keeps relays 44 px apart as `tests/story.mjs` asks), the "Command uplink" flavour strip steps aside (it is `aria-hidden` decoration and already hidden in the other views), the mode cards drop their sub-line and put the icon beside the name, and mission rows are 48 px instead of 60. In landscape the mission's name under the map steps aside (Start names the mission and the list marks it), so the board keeps relays 44 px apart above the two footer rows. **No control moved, grouped or hid**: every mode card, Training, Full screen, the difficulty buttons, Start, every relay node, ending and chronicle card is where it was, and still one tap away (`tests/cover-ui.mjs` green at all five viewports). Tablets keep their own layout (the rules are scoped to phones).

Screenshots in `g/`: `campaign-<viewport>-before.jpg` / `-after.jpg` for desktop, HD, tablet, portrait and landscape (`campaign-short-after.jpg` for 1280×720). Openings: `opening-m03-desktop.jpg`, `opening-m03-portrait.jpg`, `opening-m03-landscape.png`, `opening-m08-desktop.jpg` (night sky and moon), `opening-m02b-desktop.jpg`, and `openings-sheet.jpg` (all 16). jumpBoss: `jumpboss-desktop.png`.

### 4. Dev hook `__frontier.jumpBoss(id)`

`id` is a boss id (`"iron-vanguard"`, `"iron-sovereign"`) or a unit type. If the current match has that boss alive, it jumps there. Otherwise it starts the main-campaign mission that fields it (without its opening). Then it reveals the map, stands the player's army 12 m in front of the boss and looks at it. It resolves `{ id, type, mission, x, z }`, or `null` for an unknown boss or one no mission fields: today the Iron Sovereign appears only in Frontier Defence waves, so `jumpBoss("iron-sovereign")` gives `null` until R3-H's mission lands. Troops that close wake the boss as usual, so its entrance scene plays. `__frontier.playOpening()` plays the current mission's opening on demand.

## Tests

- **`npm test`: 1032 tests, 1005 pass, 0 fail, 27 skipped** (r3-wave-1m: 1027 tests, 1000 pass, 27 skipped). +5 tests in `tests/openings.test.js` (0.3 s):
  - every mission has a row on a real region;
  - distinctness;
  - the pose lands home without jumps;
  - gating and view-only;
  - the map's marks, hints, strings and the phone CSS rules.
- **New browser suite `tests/openings.mjs`** (`npm run test:openings`, `pages.yml` matrix entry `r3-g`), at 1440×900, 390×844 and 844×390:
  - the map's marks, hints, chronicle labels and rows above Start;
  - landscape icons, 11 px text, 44 px taps;
  - mission 3's opening: title, clock held, Skip or a tap, the camera lands home, no second opening on restart;
  - reduced motion;
  - `jumpBoss`.
- **Browser suites green on port 4232 (final build):** openings, cover-ui (all five viewports, nothing-hidden check), choices, chronicles, story, campaign, showtime (title cards with `?titlecard`, no opening), boss, ui-quality, phones, mobile, language, title.
- **Pins and baselines:** none moved. No sim, mission, balance, Defence or AI file changed, and `npm test` (all `golden-*` pins, the 14 mission checksums in `wings.test.js`, the idle fingerprint) is green. `npm run baselines:diff -- --full` shows only the differences already in the base tag `r3-wave-1m` (missions-story/standard rows that wave-1.md leaves failing on purpose for R3-I); the run stopped at its 15-minute cap after those groups.

## Seam requests

1. **R3-H (and the integrator), needed at merge.** `tests/openings.test.js` asks every mission in `MISSIONS` for an opening row. When "The Sovereign Walks" joins `missions.js`, add a row to `OPENINGS` in `src/story/openings.js`, for example `"<id>": { at: "<a region near the Sovereign's start>", frames: "camp", zoom: 1.4, drift: [0, 6], seconds: 5 }`. Keep it at least 10 m from every other start; the test prints the pair if it is too close. Its `MISSION_INTROS` row and map node come the same way.
2. **`src/app/briefing.js` (owner: none in Wave 2; integrator).** On phones the list shows the first three missions, not the picked one (mission 7 here). Scrolling the `[aria-current]` row into view inside the setup column when Campaign opens would put the mission you are about to start above Start.
3. **Story scenes on phones (optional, `scenes.js` is mine; not done to keep scope).** A story scene leaves the strip under the dock undrawn, the same flat band the opening had. The two lines that fix it for openings (`setCoverOpen(false)` while the scene plays, restore after) would apply to scenes too.
4. None for `match-flow.js`: the opening starts from the frame loop's `sceneTick`, so R3-V's results part is untouched.

## Notes

- No sim file, mission, balance entry, Defence wave or AI changed. The openings, the fog lift and `jumpBoss` are view and dev-hook code; `jumpBoss` changes a match's state only when called from a test.
- Difficulty is unchanged. An opening holds the clock, so the player loses no time.
- New strings: `vi.json` gets "Ahead" and the pattern "N / M merciful". `story-vi.json` gets the five map words (`MAP_TEXT`: decision ahead, two hints, two short ending names). The opening shows the title card's strings, which are already translated.
