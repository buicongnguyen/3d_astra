# Stage 6: ship quality

Read [README.md](README.md) first. Last stage. Goal: the game holds up on real devices, installs like an app, and is ready for the multiplayer work that follows. Release as 1.0.0 when packages 6.1 and 6.2 are done.

**Today:** all phone checks use browser emulation; `public/manifest.webmanifest` and a service worker (`tools/sw.template.js`) exist; the frame governor (`src/governor.js`) lowers quality under load; `docs/INTERNET_MULTIPLAYER_PLAN.md` describes an authoritative-server design that is not started.

## Package 6.1: real-device round

This package needs the owner's devices. The agent prepares the tools and fixes what the round finds.

**Prepare**
1. A hidden diagnostics panel (`?diag`, or five taps on the version text in settings): device pixel ratio, canvas size, renderer string, quality tier, governor level and its last five changes, frame time median and 95th percentile over the last 10 s, draw calls, triangles, JS heap if available, audio context state, service-worker state, safe-area insets. A "Copy report" button puts it on the clipboard as text.
2. A fixed benchmark (`?bench`): loads a scripted 3-enemy mixed-faction battle with a storm, runs 60 s with the camera on the fight, then shows the diagnostics summary. Deterministic, so two devices can be compared.
3. A checklist in `docs/aaa/DEVICE_CHECKLIST.md` for the owner: install to home screen, rotate mid-match, take a call or switch apps for a minute and return, lock and unlock, play with a notch in both orientations, low-power mode, 20 minutes of play for heat, headphones and speaker, airplane mode after first load.

**The owner runs** the benchmark and checklist on an iPhone (Safari) and a mid-range Android phone (Chrome), and pastes the reports.

**Fix** what the reports show. Likely areas, in the order to look:
- Frame time over 20 ms median in the benchmark: resolution first (governor), then shadows, then effect counts. Do not cut art before these.
- Audio not resuming after an interruption: `src/app/sound.js` resume on `visibilitychange`, `pageshow` and the next gesture.
- Layout under the notch or home bar: `env(safe-area-inset-*)` in the HUD stylesheets.
- Gestures taken by the browser (edge swipe, pull to refresh, double-tap zoom): `src/touch-controls.js` already handles pinch, pan and taps; verify on the device, do not rewrite.
- Memory reloads on iOS after long play: check texture and geometry counts across match restarts.

**Done when** both devices hold the benchmark at or under 20 ms median frame time at their automatic quality, and every checklist line is ticked or has a written reason.

## Package 6.2: install and first-run polish

- **Manifest and icons:** maskable and monochrome icons generated from the emblem by `tools/blender/render_ui_art.py` (192, 512, 180 for iOS), splash colours matching the loading screen, `display: standalone`, `orientation: any`, shortcuts for Continue and Daily battle.
- **Install prompt:** after the player's first finished match (not before), a small dismissible card: on Android and desktop Chrome use the `beforeinstallprompt` event; on iOS show the two-step "Share, then Add to Home Screen" hint. Never shown again after dismissal or install.
- **Update flow:** the existing update notice from the service worker is checked on a real installed copy; an update never interrupts a match.
- **First visit:** measure bytes and time to a usable menu on a throttled connection (Chrome "Fast 4G") and record them. Target: menu usable in under 4 s, first match start in under 8 s. If missed, defer the environment model and the non-core unit models until after the menu is interactive (package 2.0 already loads faction models per match).
- **Save safety:** campaign progress, achievements and settings get an "Export" and "Import" pair in settings (a JSON file), because browsers can clear site data.
- **Accessibility pass:** every dialog traps focus and restores it, every icon button has a label, colour is never the only signal for team or state (emblems, shapes and patterns back it up), text contrast at least 4.5:1 on the HUD. Add a colour-blind preset pair to the army colours.

**Tests.** `tests/offline.mjs` extended for the manifest and icons; a browser test for the install card logic with the event mocked; export and import round trip unit-tested; `tests/ui-quality.mjs` extended with the contrast check.

## Package 6.3: multiplayer hand-over

Multiplayer itself is the project after 1.0 and needs a hosting decision from the owner (the plan uses a separate Node.js service; GitHub Pages cannot host it). This package only makes the client ready, with no server.

1. **Session adapter** (`src/session/`): `LocalSession` wraps today's direct use of the simulation; everything in `src/app/` reads state and sends commands through the session, and nothing assumes "the player is team 0" (use `session.team`). This is the separation step from `docs/INTERNET_MULTIPLAYER_PLAN.md`.
2. **Hot-seat proof:** a hidden test mode where two `LocalSession`s on different teams drive one simulation from two browser tabs through a `BroadcastChannel`, commands only. If both tabs stay on the same `sim.hash()` for a ten-minute bot match, the command layer is proven sufficient for lockstep or for server authority.
3. Update `docs/INTERNET_MULTIPLAYER_PLAN.md` with what now exists, what the server must do, and the open decisions (hosting, accounts or invite codes only, cost).

**Tests.** A unit test that no file under `src/app/` contains a literal team-0 assumption outside the session (a simple source check with an allow-list), and a browser test of the two-tab hash match.

## Stage 6 exit check, and the 1.0 bar

- Real-device reports for one iPhone and one Android phone are in `docs/aaa/review/`.
- First-visit numbers are in the changelog.
- A full campaign run by the bot at Standard on the release build, both endings.
- `docs/ROADMAP.md` shows every package of this plan as done, dropped (with the reason) or moved to after 1.0.
