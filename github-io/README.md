# Frontier Command — browser edition

An original single-player 3D RTS: establish an economy, build an outpost, produce an army, and destroy the opposing Command core. Built with Three.js, Vite, and eleven original Blender-generated entity models.

The [progression update](PROGRESSION_PLAN.md) matches the [Godot edition](https://buicongnguyen.github.io/3d_astra_godot/): eight unit types, rechargeable shields, building information and three upgrade levels. Select any entity and open **Info & stats** in Selection. Upgrade your Command core to L2, then Barracks L2 for Medics or Foundry L2 for Engineers. Use **Support → friendly target** to heal infantry or repair buildings, Breakers and Battle tanks. Barracks L2 also unlocks Anti-tank soldiers; Foundry L3 unlocks Battle tanks. See [heavy weapon stats](docs/HEAVY_WEAPONS.md).

The **Riverlands** update adds saved army colors, graphics/audio settings, varied ground, a river with two bridges and a shallow ford, and original Blender scenery. Choose Riverlands or the classic Ashen Frontier in the briefing. Open **Settings** there or through **Pause → Settings** during play. See [the evaluation and release review](EVALUATION_AND_RELEASE.md).

## Play locally

Requires Node.js 22.12+ (or a compatible newer release).

```sh
npm ci
npm run dev
```

Open the printed localhost URL in a browser with WebGL 2 support. Tap or click **Deploy expedition** to start. Phones, tablets, and desktop layouts share the same game. The game pauses when the tab is hidden.

You start with a Command core, Barracks, four Harvesters, two Rangers, one Vanguard, 450 alloy, and 150 energy. This browser prototype deliberately gives you an initial production building and defenders so that you can learn the controls immediately.

## Controls

### Phones and tablets

| Action | Touch input |
|---|---|
| Select a unit or structure | Tap it |
| Select all workers / combat units | Workers / Army toolbar button |
| Move, gather, attack, or resume construction | Select units, then tap terrain or the target |
| Pan the camera | Drag one finger |
| Zoom / pan together | Pinch / move two fingers; + and − also zoom |
| Select a group | Tap Box, then drag a rectangle; Box also lets taps add to selection |
| Queue commands | Turn on Queue before issuing orders |
| Construct | Workers → Actions → structure → tap location → Build here |
| Train units | Tap a production building → Actions → unit |
| Cancel production | Select its building → Selection → tap the queued unit |
| Move / attack-move / stop | Selection panel buttons |
| Camera overview / focus base | Map tab / home button |
| Rally point | Select a production building, then tap terrain |
| Pause / help / graphics | Header buttons; Eco / High toggles graphics quality |

The command panel sits below the battlefield in portrait and beside it in landscape. Scroll a panel if needed on a short screen. Phones default to **Eco** rendering: capped pixel density and simple contact shadows. The first actual touch enables the touch controls on a hybrid device; merely having a touchscreen does not replace the mouse layout.

### Mouse and keyboard

| Action | Input |
|---|---|
| Select one entity | Left-click |
| Select a group | Drag a selection box |
| Add/remove selection | Shift + click |
| Select all units of a type | Double-click a friendly unit |
| Move, attack, gather, construct, deliver | Right-click the appropriate target |
| Queue an order | Shift + right-click |
| Attack-move | F, then click terrain |
| Stop | X |
| Pan | WASD, arrow keys, middle-mouse drag; left/right/top screen edges |
| Zoom | Mouse wheel |
| Focus base | H or minimap home button |
| Save / recall a control group | Ctrl + 1–9 / 1–9 |
| Toggle placement grid | G |
| Pause / resume | Space |
| Cancel current mode / pause | Escape |
| Controls | ? or the help button |
| Minimap camera / order | Left-click / right-click |
| Rally point | Select a production building, then right-click terrain |

### Economy and combat

- Riverlands deep water blocks land units. Use the bridges or pale central ford; buildings must stay clear of water, banks and crossing approaches. Surface types currently have equal movement speeds.
- Army colors affect paint and team markers, not unit statistics. Preferences save locally; matches are not saved. Eco/High, decoration, water motion, ambience, mute and master volume share one settings model.

- Harvesters collect amber **alloy** or blue **energy**, carry up to 10, deliver to a completed Command core, and repeat.
- Select a Harvester to expose construction actions. Click a structure, then an unobstructed visible location. One nearby Harvester builds at a time.
- A Supply relay adds 10 population capacity, up to 100. Queued units reserve population immediately. If a relay is destroyed, completed production waits for sufficient supply; the queue shows **Awaiting supply**. Research can continue while over capacity.
- Select a Command core, Barracks, or Foundry to queue production. Click an item in its queue to cancel for a full refund.
- Cancel unfinished structures from their selection panel for a 75% refund. Enemy destruction provides no refund.
- Vanguards counter Rangers; Rangers counter Breakers; Breakers deal splash damage to clustered infantry.
- The Foundry researches a one-time 10% combat-unit damage upgrade.
- Destroy all enemy Command cores to win. Losing all yours causes defeat. Simultaneous destruction is a draw.
- Enemy visibility governs targeting and minimap markers. The AI uses the same costs and commands, with no free reinforcements.

## Build and GitHub Pages

```sh
npm run build
npm run preview
```

The deployable site is **`dist/`**, not the source directory. Vite emits relative asset URLs, so the build works at a repository subpath such as `/3d_astra/`.

The repository-root workflow `.github/workflows/pages.yml` runs simulation tests, builds the site, runs browser interaction checks against that build, and deploys only `github-io/dist/`. Set the repository's Pages source to **GitHub Actions**. Push to `main` using the SSH origin to deploy subsequent changes.

The published game has no server-side code, runtime CDN imports, paid model services, analytics, or account requirements. This release does not include multiplayer or saved matches.

## Blender assets

Exported models are committed in `public/models/`; Blender is **not required** to run, build, or deploy the web game.

- Editable source: `assets/source/frontier-library.blend`.
- Generator: `tools/blender/generate_assets.py`.
- Asset inventory: `public/models/manifest.json`.
- Riverlands scenery: `public/models/environment.glb`, `environment-manifest.json`, `assets/source/riverlands-library.blend`, and `tools/blender/generate_environment.py`. All scenery is original; no external textures/audio services are required.
- Generated and verified with official **Blender 4.5.3 LTS**, using background Python execution. No Blender MCP connection was used.
- Coordinates use meters, ground-level origins, and glTF Y-up export.
- All eleven entity models are original procedural geometry. Material names `Team` and `TeamGlow` control team colors.
- Six unit GLBs include five rigid-part Blender clips each, with editable `animated-*.blend` sources. This renderer keeps its runtime articulated leg motion and body movement; the Godot renderer evaluates the clips.

To regenerate from any working directory:

```sh
blender --background --python /absolute/path/to/github-io/tools/blender/generate_assets.py
blender --background --python /absolute/path/to/github-io/tools/blender/animate_units.py
```

For the portable Blender downloaded on the initial development machine, from the repository root in PowerShell:

```powershell
& '.tools/blender-4.5.3-windows-x64/blender.exe' --background --python 'github-io/tools/blender/generate_assets.py'
```

The `.tools/` directory is ignored and is not uploaded to GitHub.

## Architecture

| File | Responsibility |
|---|---|
| `src/data.js` | Unit/building definitions, map constants, terrain obstacles |
| `src/balance.json` | Balance data matching the Godot edition |
| `src/progression.js` | Building levels, shields, support rules and requirement messages |
| `src/field-guide.js` | Accessible unit and building reference dialog |
| `src/navigation.js` | Grid A*, building clearance, line-of-fire checks |
| `src/simulation.js` | Economy, queues, construction, unit orders, combat, AI, visibility, outcomes |
| `src/view.js` | Three.js rendering, Blender model loading, effects, fog, camera |
| `src/main.js` | Browser input, selection, command UI, minimap, match flow |
| `src/touch-controls.js` | Pointer capture, tap/pan/pinch/box gesture lifecycle and cancellation |
| `src/style.css`, `src/mobile.css` | Desktop and compact portrait/landscape interfaces |

Simulation uses a fixed 20 Hz tick. Visibility updates four times per second; AI strategy updates every 2.5 seconds. Model parts are merged by material where possible, while preserving animated leg pivots. Tests opt into a local diagnostic hook with `?test=1`; ordinary players do not expose that hook.

## Verify

```sh
npm test
npm run build
# With the dev server or preview already running:
npm run test:browser
npm run test:mobile
npm run test:improvements
# Optional second-engine smoke check after npx playwright install webkit:
npm run test:webkit
```

Browser tests use installed Chrome on Windows, or Playwright Chromium elsewhere (`npx playwright install chromium`). Override `CHROME_PATH` if necessary. Set `TEST_URL` to test a production server or deployed URL. Screenshots and performance results go into the ignored `test-results/` directory.

See `VERIFICATION.md` for recorded results and prototype limitations, and `CODE_REVIEW.md` for the logic/code review and fixes. Automated touch tests use browser emulation; physical iOS and Android devices have not been verified.
