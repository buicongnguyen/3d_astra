# Logic and code review — desktop and mobile

Subsequent settings/Riverlands review and fixes: [EVALUATION_AND_RELEASE.md](EVALUATION_AND_RELEASE.md). The original mobile review below is retained as historical context.

Reviewed 2026-09-08. Scope: simulation, navigation, browser input, rendering lifecycle, responsive HUD, tests, and GitHub Pages deployment. Changes preserve the original Three.js/Blender project and the deferred Godot plan.

## Findings and fixes

| Severity | Finding and player impact | Resolution | Regression coverage |
|---|---|---|---|
| High | Narrow/short screens were covered by a blocking overlay, and commands required right-click/keyboard input. Mobile users could not play. | Removed the overlay. Added touch command controls, compact panels, portrait/landscape layouts, safe-area spacing, scrollable dialogs, and construction confirmation. | Touch integration suite at five phone/tablet sizes; actual taps, pans, pinch, cancellation, selection and construction. |
| High | Production reserved supply when queued but did not recheck supply at completion. Destroying a relay could allow queued units to bypass the current cap. | Hold completed units until capacity exists; show Awaiting supply. Research has no population requirement. | Destroy supply during production, verify blocked queue, restore supply, verify spawn; research while over cap. |
| High | Line checks compared an omitted ignored ID with rocks' missing IDs, accidentally skipping all rocks. Active movement routes could also outlive a newly placed obstacle. | Only skip an explicitly ignored ID. Navigation revisions invalidate routes; swept movement checks prevent crossing obstacle footprints. | Rock line/segment checks; place an obstacle across a live route and verify arrival without penetration. |
| Medium | An absent original builder could retain the construction lock while another worker waited at the site. | A lock requires an active builder within working range. A nearby worker can take over. | Construction handover test. |
| Medium | Invalid target kinds, friendly attack targets, nonfinite positions and unbounded queued orders could reach simulation logic. | Validate orders and positions, deduplicate unit IDs, bound order queues to 32, and validate worker/combat targets again during execution. | Invalid order/target/coordinate tests, duplicate IDs and queue limit. |
| Medium | Rendering and FPS used the same clamped delta, overstating FPS on slow hardware and slowing simulation at moderately low frame rates. | Measure FPS from wall time. Permit up to five fixed simulation ticks per render frame; retain a bound after long stalls. | Code inspection plus desktop render sample; no claim of real-phone performance. |
| Medium | Touch availability alone classified a mouse-controlled Windows computer as a phone. | Detect the primary pointer for initial controls and graphics; switch when an actual touch occurs. Narrow mouse windows can use the compact HUD. | Desktop browser on a host reporting ten touch points while its primary pointer is fine; touch-emulated contexts. |
| Medium | High device pixel ratios and dynamic shadows raise rendering cost substantially on phones. | Eco mode caps pixel ratio at 1, uses contact shadows, and disables shadow maps. High mode remains available. ResizeObserver updates the camera and renderer when the HUD changes. | Retina touch emulation verifies pixel ratio, graphics toggles, viewport rotation, and asset/error checks. |
| Low | Queue cancellation could still refund resources after the match ended. | Completed matches reject new orders, production, building and cancellation mutations. | Terminal-state mutation regression test. |

## Input design and code structure

- `touch-controls.js` owns pointer capture and gesture state. A drag/pinch never becomes a command tap; pointer cancellation, lost capture, rotation, pause and hidden tabs clear gesture state.
- DOM controls retain native button interaction. Canvas disables browser touch scrolling/zooming so gestures control the game. Panels can still scroll.
- Mouse input keeps left-click selection/box selection, right-click commands, wheel zoom, hotkeys and control groups. Touch input uses tap selection/context commands, an explicit box mode, queue toggle, force-selection buttons and command-panel tabs.
- Construction previews do not charge resources. On touch, **Build here** validates placement again before spending, so an invalid or stale preview cannot create a structure.
- The existing stable queue IDs/DOM updates remain intact; progress refreshes cannot detach a cancellation button mid-click.
- The simulation remains independent of Three.js and DOM input. All assets remain local to the static build; no server or runtime CDN was introduced.

## Verification and remaining limits

See [VERIFICATION.md](VERIFICATION.md) for executed checks and hardware scope. The Pages workflow gates deployment on simulation, desktop browser, and Chromium mobile interaction tests.

No unresolved release-blocking issue was found in the reviewed flows. This is a prototype review, not a proof of correctness. Navigation uses a coarse grid and common movement clearance, circular footprints, and pairwise unit separation. Combat target scans and separation are quadratic as armies grow; spatial indexing and more instancing remain the next performance work. Large battles and device thermal/memory limits require physical phone profiling.

Mobile browser emulation does not certify physical iOS Safari or Android Chrome. Browser chrome, virtual keyboards, notches and device-specific GPU drivers should receive a real-device acceptance pass. No multiplayer, saved matches or offline service worker is included.

## Implementation references

- [MDN: touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) — canvas gesture ownership versus browser scrolling.
- [MDN: pinch zoom with Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures) — tracking simultaneous pointers.
- [MDN: pointercancel](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event) — interruption handling.
- [Three.js responsive rendering](https://threejs.org/manual/en/responsive.html) — matching renderer and camera to display size.
