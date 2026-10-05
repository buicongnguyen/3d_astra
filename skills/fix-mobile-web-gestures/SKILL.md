---
name: fix-mobile-web-gestures
description: Diagnose and fix accidental navigation, edge-gesture conflicts, stuck touch input, and fullscreen behavior in mobile web apps, especially canvas/WebGL apps on iPhone Safari, Android Chrome, and embedded browsers. Use when taps or drags leave the app, controls conflict with screen edges, or fullscreen needs a mobile fallback. Does not modify native operating-system gestures.
---

# Fix mobile web gestures and fullscreen

Improve mobile input without breaking desktop controls, normal page scrolling, forms, accessibility, or the app's existing navigation. Adapt the fixes to the current framework and interaction model; do not transplant game-specific pause behavior into every app.

## Identify what actually happens

Inspect the current app, its input handlers, links and navigation calls, viewport configuration, layout, modal handling, and existing tests. Reuse existing fullscreen and gesture infrastructure where possible.

Distinguish these reports before choosing a fix:

| Observed result | Investigate |
| --- | --- |
| Another app or the app switcher appears after an edge swipe | OS gesture area and where the interaction begins |
| Previous page, browser tab, or an embedded browser closes | Browser navigation gestures, links, external-app URLs and host-browser controls |
| Page reloads, returns to its start screen, or loses the canvas | Actual navigation, errors, resource pressure, WebGL context loss and state restoration |
| Unit moves or an action fires after a drag/interruption | Gesture classification, capture cancellation and stale pointer state |

If needed, ask for browser, iPhone/iOS version, orientation, touch location, and what appears afterward. Continue code inspection while waiting. A normal center-screen tap opening another app is not evidence of an OS swipe conflict. State the suspected cause separately from a reproduced bug.

Fullscreen and CSS cannot disable iOS app switching. Never promise that they can. Check current official browser documentation when compatibility matters; feature-detect at runtime instead of assuming all iPhones or browsers behave alike.

## Keep controls away from gesture edges

- Use `viewport-fit=cover` with safe-area-aware positioning where the app draws edge to edge. Preserve user zoom rather than adding `user-scalable=no` as a workaround.
- Safe-area values may be zero in browsers and embedded views. Combine safe-area insets with a modest minimum interaction margin. For example, this game's starting values were `max(16px, calc(env(safe-area-inset-bottom, 0px) + 8px))` below controls and `max(12px, env(safe-area-inset-left, 0px))` at a drag surface's left edge; adapt both sides and sizes to the app. These are layout examples, not guarantees against OS gestures.
- Reserve space for browser bars, notches, landscape side panels and the home indicator. Prefer dynamic viewport sizing where appropriate; keep primary controls reachable when orientation or viewport height changes.
- Scope `touch-action: none`, selection suppression and `-webkit-touch-callout: none` to surfaces that own pan/pinch gestures, such as a game canvas. Keep native inputs and scrollable menus usable. A horizontal toolbar may use `touch-action: pan-x` and `overscroll-behavior-x: contain`.
- Apply root `overscroll-behavior: none` only when the app owns the entire viewport and browser scroll chaining is unwanted. Ordinary content pages still need normal scrolling. Do not install a global touch prevent-default handler.
- After adding canvas margins, review hit testing, selection rectangles, tooltips and tutorial markers. A projected point relative to the canvas must include the canvas rectangle offset when placed in a different DOM container.

## Make interrupted input harmless

- Separate mouse and touch behavior. Preserve existing left/right-click commands and keyboard shortcuts.
- Track pointers by ID and capture active drags. Latch the moved state once travel exceeds the app's threshold; returning near the start must not turn a swipe back into a tap.
- Recheck displacement using the final `pointerup` coordinates. Browsers can omit the last `pointermove`.
- A multi-touch gesture must not become a command when one finger lifts. Clear its multi-touch state only when the gesture ends or is cancelled.
- On `pointercancel`, unexpected capture loss, relevant viewport changes, and app interruption, discard active pointers, release their captures, clear pinch state, drag rectangles and held keys. Clear tracked IDs before releasing capture to avoid re-entrant cancellation. Ignore late releases from discarded pointers.
- Use a shared interruption handler for hidden-document visibility changes, `pagehide`, and relevant window `blur` events. Make it safe to call repeatedly. Bind/unbind listeners according to the framework lifecycle; do not accumulate duplicate handlers on remount.
- For a single-player simulation, pause an active match and require explicit Resume after returning. For multiplayer, reset local input and reconnect/resynchronize as needed; do not pretend to pause the remote match. For other apps, preserve drafts and follow their existing interruption behavior. Native pickers and transient focus changes must not discard work.

## Add fullscreen only where it helps

- Put an accessible Full screen button where it fits the current UI. A start screen and pause/settings menu can avoid crowding a phone toolbar. Translate its text and help using the app's existing language system.
- Call the Fullscreen API directly from the user's click/tap handler, before unrelated asynchronous work consumes activation. Target the app container that includes its HUD and dialogs, or the document root if overlays live outside the container.
- Feature-detect request/exit methods and enabled state; use prefixed methods only where needed by the supported browsers. Handle unsupported calls, synchronous errors, and promise rejection without unhandled errors.
- Serialize requests to ignore rapid duplicate activation. Keep the focused button enabled natively while pending if disabling it would lose focus: use `aria-disabled` plus an actual handler guard, and expose pending state visually. `aria-disabled` alone does not prevent activation.
- Explicitly focus the initiating button when necessary: Safari may not focus a tapped/clicked button. Restore a visible, connected focus target after fallback help closes.
- Update the label and `aria-pressed` from actual fullscreen state and change events, including browser-controlled exits. Keep layout and the rendering viewport synchronized. Entering or leaving fullscreen must not unexpectedly resume an already-paused activity.
- Reuse the existing accessible dialog for fallback help. Make Escape close it even before an app/game starts, retain focus within it, and restore focus afterward. Prioritize the dialog over background gameplay shortcuts. Check that the close/return control fits small portrait and landscape screens.
- On unsupported iPhone browsers, offer Safari → Share → Add to Home Screen → enable Open as Web App if shown → launch from the new icon. For an embedded browser, first explain opening the page in Safari. Explain that OS gestures still apply; do not automatically navigate away from an active session.
- If standalone launch is useful and authorized by the task, merge a web manifest and appropriate home-screen metadata with the app's existing setup. Resolve `id`, `start_url`, `scope`, icons and asset paths for the actual deployment subpath. Do not overwrite an existing PWA configuration, add an offline service worker, or claim offline support just to add fullscreen. Detect standalone mode so the help does not repeatedly tell an installed user to install again.

## Validate the changed behavior

Use the project's existing tests and a small set of relevant regressions. Do not rerun broad suites without a change, failure, or unresolved concern; complete required release checks when publishing.

- Input: normal tap once; swipe without a final move event; pinch followed by lifting one finger; cancellation/capture loss; late release after reset; fresh input after returning; desktop mouse unchanged.
- Fullscreen: supported enter/exit, browser-controlled exit, unavailable/denied request, rapid double tap, pending focus, Escape before startup, focus restoration, and preserved pause state.
- Layout: smallest supported portrait size, a typical phone, landscape and desktop. Check actual touch-target geometry, safe margins, readable instructions, and native forms/menu scrolling.
- If offsets changed, compare marker/selection position with the real canvas rectangle. Check the deployed subpath if manifest or asset paths changed.
- Use Chromium and WebKit where available. Capability-gate CSS assertions when the test port lacks a feature, without skipping relevant input/layout checks. Desktop WebKit is not a physical iPhone and cannot validate the system app switcher, browser chrome or hardware safe areas.
- Ask for a physical-device follow-up when the original OS interaction remains unverified. Report exactly what was reproduced, fixed and tested; distinguish local changes, a pushed commit, and a verified live deployment.

Creating or applying this skill does not itself authorize committing or publishing another project. Follow the user's current scope and any existing authorization; reuse the target app's repository, branch, hosting and release checks when publishing is requested.

## Primary references

- [Apple: switch between open apps](https://support.apple.com/guide/iphone/switch-between-open-apps-iph1a1f981ad/ios)
- [Apple: turn a website into an iPhone app](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios)
- [WebKit: safe-area layout](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [Pointer Events: touch-action boundaries](https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property)
- [MDN: requestFullscreen and user activation](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
