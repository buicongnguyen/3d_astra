# Game evaluation and executed improvement plan

Date: 2026-09-08. Evaluated baseline: `08e8406`.

## Evaluation

The browser prototype already supports a complete single-player RTS loop: resource collection, construction, production, army orders, AI attacks and match results. It also has usable desktop and touch controls. The main weaknesses were fixed army colors, a visually uniform battlefield, no meaningful water/crossing topology, and no persistent preferences. Decorative complexity needed to stay bounded because the existing 100-unit scene was already draw-call heavy.

| Priority | Improvement proposed after evaluation | Executed outcome |
|---|---|---|
| 1 | Let players distinguish and customize their army | Army settings with nine named colors, a paint preview, Gold/Violet high-contrast shortcut, different player/enemy colors, Apply/Cancel/defaults and saved preferences. Existing units, new units, team glow, selection health bars, command effects and minimap markers use the palette. Neutral materials and semantic resource/placement colors remain independent. |
| 2 | Give the world readable surface variety | Riverlands ground includes grass, dirt, sand, road, stone and wet-bank colors, with deterministic map queries shared with the minimap. The classic Ashen Frontier scenario remains selectable. |
| 3 | Make water affect tactics consistently | A lowered channel, animated ripples, two fixed bridges and a lighter central ford. Deep water blocks units; crossing decks and approaches reject construction. Navigation, local separation, spawning and building rules agree with terrain. Water does not block projectiles automatically. |
| 4 | Add environmental detail without excessive rendering cost | Original Blender trees, bushes, reeds, cargo crates and bridge assets; merged shared materials and instanced decoration. Trees sit outside the playable bounds; small internal vegetation is decorative. Bounded dust/spray/smoke particles and synthesized wind/river ambience. |
| 5 | Protect playability while polishing | Eco/High, decoration, water-motion, volume and mute settings; reduced-motion handling; original and new automated tests; code/logic review fixes; GitHub Pages deployment gates. |

This executes the practical settings/terrain/water/scenery release from [SETTINGS_AND_WORLD_PLAN.md](SETTINGS_AND_WORLD_PLAN.md). True elevation remains the separate follow-up defined in that plan. No engine migration was needed.

## How to use the release

- Before deployment, select **Meridian Riverlands** or **Ashen Frontier** in the briefing.
- Open **Settings** in the briefing or **Pause → Settings** during a match.
- Select different colors for your army and the enemy, then **Apply settings**. **Cancel** discards the draft. **Defaults** resets the draft and still requires Apply.
- Preferences survive reloads on the same browser when local storage is available. They are not account-synced, and they do not save the match.
- Cross the river at either bridge or the pale central ford. Keep the banks and crossing approaches clear of buildings.
- Adjust graphics, water/effect motion, decoration, ambience, mute and master volume in Settings. The existing header quality/mute shortcuts update the same preferences.

## Code and logic review: issues fixed

| Finding | Fix and evidence |
|---|---|
| The old map base sat above the lowered channel and obscured deep water. Input tests alone did not reveal the problem. | Lowered the Riverlands base below the channel. Inspected actual screenshots of both bridges and the ford. |
| Movement used a common clearance radius; large Breakers and local separation could violate the full water-edge footprint. | Size-aware A* endpoint/cell checks, swept movement and full-radius separation. Added a five-Breaker crossing test that checks every tick and verifies arrival. |
| A displaced unit's outward-motion check could accept a segment that initially traveled further into a circular obstacle. | Test the segment direction relative to the obstacle, rather than only comparing endpoint distances. Original escape/navigation regressions still pass. |
| Straight-line path tails could bypass terrain restrictions if they used only the projectile line test. | Movement tails use swept traversal. Water remains independent of projectile blocking. Navigation rebuilds preserve static water masks. |
| A paused settings dialog could accidentally resume an already paused game. | Save/restore the prior pause state and keep the pause menu behind the dialog. Native keyboard/touch Apply/Cancel checks exercise the behavior. |
| Palette edits could affect only newly spawned models or accidentally create per-unit material copies. | Update the existing team material registry and per-instance UI colors; preserve neutral materials. Browser tests confirm current and newly trained units have the saved paint. |
| Decorative particle bounds initially lay outside the world and could prevent particles from rendering. | Disable culling for the fixed 64-slot particle pool. Dispose its GPU resources on map changes. |
| Particle time advanced only on simulation-changing render frames, but used render delta. | Use elapsed simulation time for particles and pause animation with the match. |
| Old instancing buffers and water textures needed explicit disposal during scenario changes. | Dispose map-owned geometry/materials/textures and instance buffers; retain only shared Blender templates. Five restart/settings cycles keep reported GPU resource counts unchanged. |
| Volume zero still allowed a tiny synthesized tone; reduced motion was only sampled initially. | Silence tones at zero volume and respond to changes in the reduced-motion media query. |

No unresolved blocking issue was found in the tested release flows. This is a bounded prototype review, not a claim that every possible gameplay state is verified.

## Verification

- **33 Node tests:** all original simulation tests plus settings validation/storage recovery, river footprint and swept traversal, preserved navigation masks, movement-versus-projectile rules, worker income, army crossings, large-unit clearance, AI victory and player victory through normal combat.
- **Desktop interaction suite:** model loading, start, selection, gathering, building, production/refund, pause/help/groups, outcomes/restart and a 100-friendly-unit scene.
- **Touch suite:** actual taps and multitouch dispatch, construction confirmation, selection/panning/pinch/box/queue, camera/UI rotation and five phone/tablet dimensions.
- **New settings/environment suite:** desktop and touch Apply/Cancel, conflicting palettes, persistence across reload, classic/Riverlands switching, new unit paint inheritance, graphics/mute settings, pause restoration, reduced motion and repeated restarts. Includes portrait/landscape screenshots and GPU resource counters.
- All three browser suites are included in the GitHub Pages workflow. Diagnostic artifacts are saved on CI failure.
- The new settings/environment suite also passed with forced SwiftShader software rendering. Playwright WebKit 26.0 passed its additional input, simulation advancement and rendered-pixel checks on Windows; physical iOS Safari remains unverified.
- Tests run against the production build served at `/3d_astra/`; live-site checks follow successful deployment.

### Measured desktop sample

Same Windows / RTX 4080 SUPER / Chrome 152 / 1440 × 960 / 100 friendly + 7 enemy unit scenario used by the earlier release:

| Metric | Baseline | Riverlands |
|---|---:|---:|
| Median frame interval | 16.7 ms | 16.7 ms |
| p95 frame interval | 16.8 ms | approximately 16.7–16.8 ms |
| Draw calls | 1,769 | 1,813 |
| Triangles | 189,308 | 227,954 |

This is a short high-end desktop sample, not a phone performance guarantee. Original environment GLB size: **53,376 bytes**. Asset source and triangle counts are in `assets/source/riverlands-library.blend` and `public/models/environment-manifest.json`.

Visual review captures: [Riverlands](docs/preview.png), [desktop settings](docs/settings.png), [touch settings](docs/settings-mobile.png).

In the settings/restart test, reported geometry/texture counts stayed at **153 / 6** in the desktop context and **126 / 4** in the touch context before and after five cycles. Quality/history differs between contexts, so compare each context with itself.

## Remaining improvements

1. **Physical-device profiling:** test Android Chrome and iOS Safari, including thermal behavior, notches and audio. Current mobile coverage uses emulation. Windows WebKit is useful for engine smoke checks but does not certify iOS.
2. **Army-scale optimization:** introduce spatial indexing for target scans/local separation and further batch unit rendering before increasing the 100-population cap.
3. **Battlefield balance:** observe crossing congestion and AI behavior over more varied matches. Surface movement speeds intentionally remain equal in this release; adding road/mud speed modifiers needs travel-time path costs and balance tests.
4. **Material and animation polish:** richer baked surface wear, attack/death animations and more organic bank shapes. Current environment assets are deliberately small and stylized; the paint preview is a lightweight illustration, not a second live model renderer.
5. **True elevation:** terrain raycasting, height-aware grounding/fog, ramps and clear high-ground rules together. Keep ships, destructible bridges, dynamic weather and the Godot port as separate projects/features.

The settings, terrain and water implementation is complete for this release. Physical-phone certification, advanced elevation and the optional later features above are not represented as completed.
