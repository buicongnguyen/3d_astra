# Verification record

Date: 2026-09-07.

## Executed checks

- **17 simulation tests passed**, covering spending/refunds, population reservations, completed production, finite-resource conservation, partial-load delivery, placement rejection, construction completion/cancellation, A* clearance, queued commands, hidden enemy targeting, research, result transitions, AI growth, actual army combat, and unreachable movement recovery.
- The combat integration test trains four additional Rangers using normal costs, issues attack-move, and wins against the defending starting force by destroying its headquarters. It does not directly set enemy health.
- An active AI defeats an idle player through ordinary gathering, production, navigation, and combat.
- **Production build passed** with Three.js 0.185.1 and Vite 8.2.2.
- **Browser interaction suite passed** in installed Chrome 152, both against the development server and against the production build mounted at `/3d_astra/`.
- Browser checks cover all nine model loads, start, production/refund, mouse selection, context gathering and delivery, construction placement and completion, pause/resume, controls, control groups, victory/defeat screens, restart, and a 100-friendly-unit render scenario.
- **No JavaScript exceptions or HTTP asset errors** occurred in those browser runs.
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
- Desktop mouse/keyboard interaction; no touch-control scheme. Narrow or short windows display an explanatory overlay.
- No multiplayer, match saves, campaign, or persistent progression.
- Flat playable terrain, circular building footprints, coarse A* navigation, simple local separation, and a basic AI strategy. These are suitable for this initial map but not a production-scale RTS navigation system.
- Resources and terrain are simple original procedural meshes. Units use runtime articulated movement rather than full skeletal animation clips.
- Weapon effects use instantaneous beam tracers. Sound is a small set of synthesized interaction acknowledgments.
- Unknown enemies are hidden; previously seen enemy buildings remain as last-known minimap markers rather than detailed 3D ghosts.
- Vite reports the approximately 610 KB minified Three.js engine chunk as larger than its default 500 KB warning threshold. Its gzip size is approximately 155 KB; this is a size advisory, not a failed build.

## Deployment

The root GitHub Actions workflow repeats the simulation suite, production build, and browser suite before deploying the static artifact. Consult the repository's Actions tab for the exact commit and deployment outcome.
