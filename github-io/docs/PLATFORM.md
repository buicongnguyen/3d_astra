# Platform reach: home-screen app, iPhone readiness, app stores

Written 2026-11-26 (AAA roadmap "Platform reach", score 6.6: "never tested on a real iPhone; home-screen install and
app-store wrapping are open questions"). Nothing here was run on a real iPhone or iPad. Everything below
"What was verified" is **emulation** (Playwright WebKit with Apple device profiles on Windows); the
"10-minute checklist" is for a friend with a real device and is the final word.

## Home-screen app (PWA)

| Part | Where | Notes |
|---|---|---|
| Manifest | `public/manifest.webmanifest` | name "Frontier Command", short name "Frontier" (fits under an icon), `display: fullscreen` with `display_override` [fullscreen, standalone], `orientation: any`, theme `#030a1b`, background `#020713` (the boot splash), relative `id`/`start_url`/`scope` so it works under `/3d_astra/` |
| Icons | `public/icons/` | `icon-192.png`, `icon-512.png` (any), `maskable-512.png` (art inside the 80 % safe circle), `apple-touch-icon.png` 180 px. Original art: the game's own tank model and gold emblem rendered in Blender (`render_ui_art.py -- icons` -> `tools/icons/app-icon-art.png`), put on the boot-splash night blue by `npm run icons` (`tools/app-icons.mjs`) |
| iOS head tags | `index.html` | `apple-mobile-web-app-capable`, title "Frontier", status bar `black-translucent` (the game draws under a see-through status bar and keeps its controls clear with `env(safe-area-inset-*)`, which the CSS already used everywhere), `apple-touch-icon`, `viewport-fit=cover` |
| iOS launch screens | `public/icons/splash/*.jpg`, `tools/icons/ios-splash.json` | 18 iPhone/iPad sizes x portrait/landscape = 36 JPEGs (2.0 MB in all, 40-80 KB each), same look as the boot splash so the hand-over does not flash. `vite.config.js` (`ios-launch-screens`) writes one `<link rel="apple-touch-startup-image" media=...>` per image. A device not in the list just shows the background colour; add a row to the JSON and run `npm run icons` |
| Offline start | `tools/sw.template.js` (unchanged rules) | the app shell is precached on the first visit (now also `icons/icon-192.png` and `icons/apple-touch-icon.png`, 59 KB); models, music, voices, the Korean files and the FX atlases are still cached on first use; launch screens and the 512 icons are never precached (only the OS fetches them, once, at install) |
| Install app tile | `src/app/install.js`, `src/settings-ui.js` (Settings -> Display, first row) | **prompt** (Chrome/Edge/Samsung on Android and desktop fire `beforeinstallprompt`; the tile opens the browser's install dialog), **ios** (iPhone/iPad, no prompt exists: the tile opens a one-screen guide in place: picture of Share -> Add to Home Screen -> icon, three steps, a note for in-app browsers, Got it), **installed** / **none** (no tile: already running from the home screen, installed this visit, or a browser that cannot install). EN/VI/KO |
| Full screen | `src/app/modals.js`, Settings -> Display | unchanged rule: the button shows only where the Fullscreen API exists and the game is not installed. iPhone Safari has no element fullscreen, so the row now says "Install the app (above) to play without the browser bars"; an installed app (standalone on iOS, fullscreen on Android) says the bars are already gone. iPad keeps the button |

## What was verified (emulated, not real hardware)

`npm run test:iphone-audit` (Playwright WebKit 26, Windows) on iPhone SE (375x667), iPhone 13 (390x844),
iPhone 15 Pro Max (430x932) and iPad gen 7 (810x1080), each portrait and landscape; numbers in
`test-results/iphone-audit.json`.

| Check | Result (all 8) | How |
|---|---|---|
| Load | ready, no page errors, no failed requests, no sideways scroll | title screen with every model parsed |
| First tap | Start is 44-48 px tall; one tap starts the match and the canvas draws | Playwright `tap()` (touch events) |
| Audio unlock | no AudioContext before a gesture; it is created **and resumed inside the first `pointerup`** | Playwright's Windows WebKit has **no Web Audio at all**, so the suite installs a stand-in that, like iOS, stays "suspended" unless `resume()` runs inside a trusted gesture. Sound itself is not heard; real iPhone checklist step 2 |
| Full screen | iPhone (API removed, as on iOS): no button, the note points to Install app. iPad: button shown exactly when the API exists (this WebKit build reports none; iPadOS Safari has it) | Settings -> Display |
| Install tile | "ios" state on every device; the guide opens, has three steps and the picture, no text under 11 px, no sideways scroll | also `npm run test:pwa` |
| Safe areas, installed | with the iPhone 13 insets (portrait top 47 / bottom 34, landscape sides 47 / bottom 21) nothing tappable sits under the status bar, notch or home indicator on the title screen, the settings sheet or the match HUD; the top bar grows under the see-through status bar | `npm run test:pwa`: WebKit reports 0 insets on a desktop, so the built CSS/JS has `env(safe-area-inset-*)` replaced by those numbers, plus `navigator.standalone` and `display-mode: standalone` |
| Swipe gestures | the October fix holds: bottom strip clear, 20 px side guard, no history entries | `npm run test:iphone-gestures` (unchanged, green) |
| WebGL context loss | `WEBGL_lose_context`: the match holds ("Graphics were interrupted"), the clock stops, restore draws again (56-63 calls, real pixels, no GL error), Resume plays on | every device |
| Memory | 3 scene textures, 5.4 MB (largest 1024 px), shadow map 2048 px (16 MB), 7 GPU textures, ~62 geometries; drawing buffer at pixel ratio 1 on Eco (the touch default), 1.6 max on High | far below iOS Safari's per-tab limit (roughly 1-1.5 GB on recent iPhones; older 2-3 GB-RAM phones such as the SE 2 are the ones to watch) |

Not provable here: real touch latency and frame rate on an A-series GPU, thermal throttling, the silent switch
(Web Audio follows it; `<audio>` music does not), audio after a phone call ("interrupted" state, handled in
`app/sound.js` by resuming on the next gesture), iOS evicting a home-screen app's storage after weeks unused,
the in-app browsers (Facebook, Zalo, KakaoTalk), and the exact look of the launch screens. Screenshots of WebGL
from Playwright WebKit on Windows show the HUD over an empty battlefield (the GPU layer is not captured), while
`readPixels` confirms the scene draws.

Fix made by the audit: `app/sound.js` falls back to `webkitAudioContext` (iOS before 14.5 has only that).

## 10-minute checklist for a friend with a real iPhone

Send the link, ask for the iPhone model and iOS version, and a screenshot at any step that looks wrong.

1. **Safari, first load (1 min).** Open the game link in Safari. The title screen appears within ~10 s on Wi-Fi; nothing is cut off; double-tapping does not zoom.
2. **Sound (1 min).** Ringer switch ON (not silent). Tap anywhere, then Start. Music and clicks play. Flip the silent switch: game sound goes quiet (expected on iPhone).
3. **Touch (2 min).** Drag the map with one finger, pinch to zoom, twist two fingers. Swipe in from the left screen edge: the game must NOT go back a page. Swipe along the bottom bar: iOS may switch apps (that cannot be blocked); nothing in the game should start there.
4. **Rotate (1 min).** Turn the phone sideways and back during a match. On a notched iPhone, no button hides behind the notch or the rounded corners.
5. **Install (2 min).** Settings (gear) -> Display -> **Install app** shows the guide. Follow it: Share (or ••• -> Share) -> Add to Home Screen -> Add. Check the icon (tank in front of a gold triangle, label "Frontier"). Open it from the icon: a dark launch screen with the same art, then the game with no Safari bars; the clock/battery at the top are readable and do not cover buttons.
6. **Offline (1 min).** Close the app. Turn on Airplane mode. Open it from the icon: the title screen loads; a skirmish starts. Turn Airplane mode off again.
7. **Interruptions (1 min).** In a match, go to the home screen for 30 s and come back: the match is paused, sound returns after a tap. Lock and unlock the phone: same.
8. **Heat and speed (1 min).** Settings -> Display -> Show FPS on, Graphics quality High; play a big fight for a minute. Note the FPS and whether the phone gets hot. Switch back to Eco.

Report: model, iOS version, Safari or home-screen app, the step number of anything odd, a screenshot.

## App-store wrapping (assessment; recommendation only, no native projects added)

| | Google Play: TWA (PWABuilder or Bubblewrap) | Google Play / App Store: Capacitor |
|---|---|---|
| What it is | an Android app that opens the live site in Chrome without browser UI (Trusted Web Activity) | a native shell with the built game files inside, run in WKWebView (iOS) / Android System WebView |
| Work | PWABuilder takes the live URL and produces a signed AAB; add `/.well-known/assetlinks.json` at the **domain root** (`buicongnguyen.github.io`, i.e. the hub repo, not this one) for Digital Asset Links | `npx cap add ios/android`, copy `dist/`, turn the service worker off in the app build (files are local), status bar / haptics / Game Center plugins, icons and launch screens from `public/icons/`; iOS needs a Mac with Xcode (or a cloud Mac) |
| Updates | every site deploy reaches the app at once (it is the website) | a new store build for code changes; Apple guideline 2.5.2 forbids downloading new executable code, so the game must ship inside the bundle |
| Engine | real Chrome: same WebGL, audio and performance as the browser | system WebView: on iOS identical to Safari; on Android WebView is close to Chrome |
| Cost | $25 once (Google Play developer). New personal accounts must run a closed test with 12 testers for 14 days before production | Apple Developer Program $99/year (+ Google $25 once); a Mac or a cloud Mac |
| Review risk | low: a full offline-capable game passes the PWA-quality bar | Apple 4.2 "Minimum Functionality": apps that are just a website are rejected. A complete game with its files bundled, offline play, no browser UI, haptics and ideally Game Center leaderboards/achievements usually passes; a thin wrapper around the live URL does not. Also: privacy manifest and nutrition label (the game collects nothing), age rating, `NSLocalNetworkUsageDescription` if LAN play stays (an iPhone could only join, never host: the host is a Node server) |
| What changes in the game | nothing beyond assetlinks.json and a Play listing | an app-store build mode: no service worker, no "Install app" tile, no full-screen row, local base path, saves in the WebView's storage (persistent in an app, unlike Safari's 7-day rule for unvisited sites), external links open in Safari, optional Game Center bridge for the 25 achievements |

**Recommendation.**
1. **Now:** the home-screen PWA (done). It costs nothing, updates with every deploy and already plays offline.
2. **Next, if a store presence is wanted:** Google Play via PWABuilder TWA. About a day of work plus the 14-day closed test; $25. No code change in the game.
3. **iOS App Store only after** the real-iPhone checklist passes and a store build is worth $99/year: Capacitor with the game bundled, haptics and Game Center to clear guideline 4.2. Expect one review round trip. Not worth doing before the game's phone experience is confirmed on real hardware.

Owner decisions needed: whether to publish on Google Play (account, name, $25) and whether an iOS store build is wanted at all.
