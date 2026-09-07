# Verification record

Updated: 2026-09-08. Initial asset/deployment verification: 2026-09-07.

## Executed checks

- **25 simulation tests passed**, covering spending/refunds, population reservations, completed production, finite-resource conservation, partial-load delivery, placement rejection, construction completion/cancellation, A* clearance, queued commands, hidden enemy targeting, research, result transitions, AI growth, actual army combat, and unreachable movement recovery. New regressions cover lost supply, research over capacity, rock collision checks, live route invalidation, escape from displaced clearance, invalid/bounded orders, builder handover, and terminal-state mutation rejection.
- The combat integration test trains four additional Rangers using normal costs, issues attack-move, and wins against the defending starting force by destroying its headquarters. It does not directly set enemy health.
- An active AI defeats an idle player through ordinary gathering, production, navigation, and combat.
- **Production build passed** with Three.js 0.185.1 and Vite 8.2.2.
- **Browser interaction suite passed** in installed Chrome 152, both against the development server and against the production build mounted at `/3d_astra/`.
- Browser checks cover all nine model loads, start, production/refund, mouse selection, context gathering and delivery, construction placement and completion, pause/resume, controls, control groups, victory/defeat screens, restart, and a 100-friendly-unit render scenario.
- **No JavaScript exceptions or HTTP asset errors** occurred in those browser runs.
- **Chromium touch integration passed** against the production build mounted at `/3d_astra/`: 390 × 844, 844 × 390, 320 × 568, 667 × 375 and 768 × 1024. Tests use native touch taps and Chromium multitouch dispatch for drag/pinch/cancel/box gestures. Coverage includes selection, gathering/delivery, construction preview/confirmation/completion, production/refund, queue/attack-move mode, graphics toggling, pause/help, rotation, minimap/home, restart and HUD hit testing.
- The mobile suite also passed with **forced SwiftShader software rendering**. This is a correctness check under slower rendering, not a mobile FPS measurement.
- **Playwright WebKit 26.0 passed** a separate touch smoke check on Windows: all models, simulation advancement, production/cancellation, selection/gathering, construction mode/cancel, pause/help, portrait/landscape and minimap. GPU readback verified nonuniform game pixels, positive draw calls, and no GL errors or context loss. No JavaScript or HTTP errors occurred. Windows WebKit screenshots did not composite the 3D canvas, so this does not count as Safari visual acceptance. Multitouch gesture dispatch was tested in Chromium, not WebKit; physical iOS remains unverified.
- Portrait and landscape screenshots were inspected. No document overflow or blocked primary controls was found at the tested sizes. Touch panels scroll when content exceeds the available height.
- A slower GitHub runner exposed production-queue buttons being recreated during progress updates. Queue items now retain stable IDs and DOM nodes. A browser regression check verifies the button survives progress updates before clicking it.
- The complete interaction suite also passed with **forced SwiftShader software rendering** on Windows. That 100-friendly-unit sample measured approximately 116.6 ms median and 133.3 ms p95 frame intervals. Hardware acceleration is needed for smooth play at that scale.
- Screenshots of the briefing and gameplay were inspected for layout, unit visibility, model appearance, selection feedback, and HUD readability at 1440 × 960.
- Official portable **Blender 4.5.3 LTS** ran the asset generator successfully. All nine GLB exports and the editable `.blend` asset library were generated locally.

## Performance smoke test

| Condition | Measured result |
|---|---|
| OS / CPU | Windows / Intel Core i7-14700KF |
| GPU reported by WebGL | NVIDIA GeForce RTX 4080 SUPER, ANGLE D3D11 |
| Browser | Headless Chrome 152 |
| Viewport / pixel ratio | 1440 × 960 / 1 |
| Scene | 100 friendly units + 7 opposing units, normal terrain/buildings |
| Sample | 100 animation frames, first 11 omitted from statistics |
| Median frame interval | 16.7 ms |
| 95th percentile frame interval | 16.8 ms |
| Draw calls / triangles | 1,769 / 189,308 in the sampled scene |

This is a short rendering and simulation smoke test on a powerful desktop, not a guarantee for other hardware or every combat scenario. The draw-call count is the main remaining optimization opportunity for larger battles; articulated units still use multiple mesh parts.

## Prototype limitations

- One faction, one map, one AI difficulty, and a compact skirmish. Match duration and balance are initial values, not a finished competitive ruleset.
- Touch and mouse controls are implemented, but physical iOS and Android hardware has not been tested. Touch emulation cannot measure phone battery, thermals, browser chrome, notches or GPU-driver behavior. Use Eco graphics on constrained hardware.
- No multiplayer, match saves, campaign, or persistent progression.
- Flat playable terrain, circular building footprints, coarse A* navigation, simple local separation, and a basic AI strategy. These are suitable for this initial map but not a production-scale RTS navigation system.
- Resources and terrain are simple original procedural meshes. Units use runtime articulated movement rather than full skeletal animation clips.
- Weapon effects use instantaneous beam tracers. Sound is a small set of synthesized interaction acknowledgments.
- Unknown enemies are hidden; previously seen enemy buildings remain as last-known minimap markers rather than detailed 3D ghosts.
- Vite reports the approximately 610 KB minified Three.js engine chunk as larger than its default 500 KB warning threshold. Its gzip size is approximately 155 KB; this is a size advisory, not a failed build.

## Deployment

The root GitHub Actions workflow repeats the simulation suite, production build, desktop browser suite and mobile touch suite before deploying the static artifact. Consult the repository's Actions tab for the exact commit and deployment outcome. `npm run test:webkit` provides an optional second-engine smoke check after installing Playwright WebKit.
