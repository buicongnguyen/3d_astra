# iPhone gesture interruption review — October 5, 2026

## Assessment

The report says touching the game sometimes switches to another app. The exact browser, iPhone model, iOS version and gesture location are not yet known, and this has not been reproduced on a physical iPhone.

The Three.js input handlers contain no external-app launch or deep-link action. The logo links back to the game and opens Pause during a match. An ordinary battlefield tap selects an object or issues a game order.

An iOS edge gesture is a plausible explanation if the touch starts near the bottom: Apple documents a horizontal bottom-edge swipe for switching apps and an upward swipe for the app switcher. Safari navigation or an embedded browser's own controls are different cases and need to be distinguished from switching apps. [Apple gesture guide](https://support.apple.com/guide/iphone/switch-between-open-apps-iph1a1f981ad/ios).

The game already used `touch-action: none` on the battlefield and minimap, pointer capture, pointer cancellation and pause on document visibility loss. CSS touch handling controls webpage panning and zooming; it does not give a webpage control over system app switching. [Pointer Events specification](https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property).

## Changes

- Bottom HUD tabs and the landscape battlefield reserve at least 16 CSS pixels at the bottom, or the device's bottom safe area plus 8 pixels, whichever is larger. Previously the inset could be zero in browser/embedded views. Safe areas are combined with margins rather than treated as a replacement for them. [WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
- The active battlefield has at least 12 pixels of side clearance, while retaining larger device safe areas in landscape. This provides an interior place to start camera drags.
- Tutorial target markers account for the battlefield's offset, so the added margins do not shift guidance away from the target.
- Root and body suppress scroll chaining where supported; the horizontal touch toolbar contains its scrolling. Battlefield/minimap long-press callouts are disabled. Settings and native selects remain usable.
- Window blur and page hiding now clear captured touches, drag boxes and held keys, and pause an active match. Returning requires Resume. Existing hidden-document handling uses the same cleanup.
- Pointer release checks the final position as well as movement events. A swipe cannot become an accidental order when the browser omits its final `pointermove`.

These changes reduce accidental edge interactions and protect game state after interruption. They do not prove the cause of the original report or promise to disable iOS gestures.

## Validation

- 203 unit/logic tests pass, including cancelled multi-touch, capture loss, late finger release after reset, normal taps, swipes without movement events, and fullscreen lifecycle handling.
- Production build succeeds.
- Chrome checks cover safe margins, non-navigating battlefield taps, focus/page-hide interruption, explicit resume, settings, and portrait/landscape layouts.
- The same gesture checks pass in Playwright WebKit on Windows. Its general gameplay check also passes for production/cancellation, gathering, construction, pause/help, rendered WebGL output and rotation.
- Existing Chrome mobile-control checks pass at 320×568, 390×844, 667×375, 844×390 and 768×1024.
- Tutorial entry, target-marker alignment, selection and exit pass at desktop, small-phone portrait and phone landscape sizes.
- Desktop WebKit does not emulate iOS's app switcher, browser toolbar or safe-area hardware. The installed Windows port also lacks `overscroll-behavior`; that CSS assertion is capability-gated, while layout and input assertions still run. Real Safari supports overscroll behavior starting in version 16. [WebKit release notes](https://webkit.org/blog/13152/webkit-features-in-safari-16-0/).

Run `npm run test:mobile-gestures` for Chromium, or set `TEST_BROWSER=webkit` to run it in WebKit. CI includes the Chromium gesture checks and the touch unit tests.

## Physical iPhone follow-up

### Fullscreen and home-screen mode

The start screen now has a **Full screen** button, also available during a match in **Pause**. Supported browsers request fullscreen for the whole document, retaining the HUD and settings. The label changes to **Exit full screen** when active and follows browser-controlled exits. Display changes resize the battlefield and clear interrupted gestures; using the pause-menu button leaves the match paused until Resume.

The request runs directly from the button tap. Unsupported or denied requests open a translated help dialog rather than failing silently. Double taps cannot issue overlapping fullscreen requests. This follows the browser's user-activation and permission requirements. [Fullscreen API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen).

For iPhone browsers that cannot fullscreen the page, the dialog explains: open the game in Safari → Share → Add to Home Screen → enable **Open as Web App** if available → launch from the new icon. A relative-scope web manifest and home-screen metadata support standalone launch under the GitHub Pages project path. No offline capability is promised. [Apple's home-screen web app instructions](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios).

Fullscreen/standalone mode removes browser controls where supported; it does **not** disable iOS app-switching gestures. Physical iPhone validation is still required.

Three fullscreen unit tests cover unsupported/denied requests, document-root targeting, duplicate taps, browser exits and the prefixed API. `npm run test:fullscreen` passes in Chrome (including real fullscreen entry/exit) and desktop WebKit (unsupported-path checks). Both cover 390×844, 320×568 and 844×390 layouts, English/Vietnamese guidance, and pause/resume. WebKit emulation does not prove fullscreen availability on an actual iPhone.

Pre-release code/logic review also corrected keyboard handling: Escape closes fullscreen help before a match starts, and pending fullscreen requests retain button focus using `aria-disabled` while the controller rejects duplicate activations. Fullscreen activation explicitly focuses its button so Safari also restores focus after closing help. Browser regressions verify these cases and navigation in the pause dialog.

### Device checks

1. Record the browser (including whether it is inside Facebook), iOS version, iPhone model, orientation and exact touch location.
2. Distinguish another app/app switcher from another Safari tab, back navigation, or a game reload.
3. Tap the center of the battlefield repeatedly; select units, give orders, use production/cancel and all dock tabs. None should navigate away.
4. Drag and pinch from inside the battlefield, then repeat near each edge. Compare Safari with the reporting embedded browser if applicable.
5. Deliberately switch apps and return. The match should remain paused with no stuck drag, zoom, held key or unintended order; Resume should restore normal controls.
6. Try Full screen from the start screen and pause menu. If unavailable, follow the Safari home-screen instructions, reopen from that icon and repeat the gesture checks in standalone mode.

If an ordinary center-screen tap still switches apps, obtain a screen recording of that exact interaction before treating it as a confirmed edge-gesture issue.
