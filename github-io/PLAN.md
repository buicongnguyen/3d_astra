# Browser-first implementation plan

## Decision

Build Frontier Command in this isolated `github-io/` folder using Three.js, JavaScript modules, Vite, and original Blender-generated GLB models. Deploy the static production output on GitHub Pages. Defer Godot entirely; share Blender source models and design data when that project starts.

## Playable release scope

1. An original desert frontier battlefield, elevated RTS camera, bounded pan and zoom.
2. Click and box selection, Shift selection, queued right-click commands, control groups, stop, attack-move, and rally points.
3. Two finite resources with worker gathering and delivery.
4. Headquarters, relay, barracks, foundry, and tower with placement validation and construction.
5. Worker, Vanguard, Ranger, and Breaker with data-driven statistics and population accounting.
6. Production queues, cancellation/refunds, and one researched weapon upgrade.
7. Grid-based A* around buildings and terrain, group destination slots, and local separation.
8. Combat, counters, projectiles, deaths, AI economy, defense, and periodic attacks.
9. Fog of war, minimap, resource HUD, context commands, clear tutorial and action feedback.
10. Start, pause, victory/defeat/draw, and clean restart.

## Implementation order

- Build the simulation independently from rendering, with targeted tests for economy, commands, navigation, and match outcomes.
- Create original assets using a reproducible Blender Python script and export one GLB per entity plus the editable `.blend` library.
- Build a readable 3D scene and responsive command interface, then connect input and simulation.
- Test the complete game in a desktop browser, including resource gathering, production, placement, combat, restart, and asset loading.
- Build static assets with relative URLs; test hosting below a repository subpath.
- Commit source, lockfile, exported models, and deployment workflow. Push using SSH, enable Pages, and verify the public game.

## Browser constraints

- Mouse/keyboard desktop play and touch phone/tablet play use the same simulation. A compact HUD, tap commands, drag pan, pinch zoom, and touch construction confirmation replace the original small-screen overlay. See `CODE_REVIEW.md` for the September 2026 review and mobile work.
- Start with a compact 96 × 96 meter map and a 100-population cap per side.
- No multiplayer backend, paid services, runtime CDN dependencies, or remote model generation.
- Simplified articulated model motion in the first release; elaborate skeletal animation is deferred.
- Keep the simulation and pathfinding bounded; visibility/AI updates run on fixed intervals.
- Performance results must name test conditions. Do not imply a universal frame-rate guarantee.

## Acceptance

The deployed GitHub Pages URL loads without console errors or missing assets. The player can gather, build, produce a mixed army, defeat an active AI, and restart. Tests and build pass. Blender assets and their generator are committed. Known prototype limits and deployment instructions are documented.
