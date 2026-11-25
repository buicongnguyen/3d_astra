// Home-screen install (Platform reach, 2026-11-26; docs/PLATFORM.md). Settings → Display shows an
// "Install app" tile in exactly one of these states:
//   prompt     Chrome / Edge / Samsung Internet (Android and desktop) offered beforeinstallprompt: the tile
//              opens the browser's own install dialog
//   ios        Safari (or another browser) on iPhone / iPad, which has no install prompt: the tile opens a
//              one-screen "Share → Add to Home Screen" guide inside the sheet
//   installed  running from the home screen (display-mode standalone / fullscreen, navigator.standalone) or
//              installed during this visit (appinstalled): no tile
//   none       any other browser (Firefox desktop, desktop Safari without a prompt): no tile
// The browser fires beforeinstallprompt once, early, so the listener is added when this module loads.

export function installState({ standalone = false, installed = false, prompt = false, ios = false } = {}) {
  if (standalone || installed) return "installed";
  if (prompt) return "prompt";
  if (ios) return "ios";
  return "none";
}

// iPadOS Safari reports a Mac; a Mac has no touch points.
export const isIOS = (nav = {}) => /iPhone|iPad|iPod/.test(nav.userAgent || "") || (nav.platform === "MacIntel" && (nav.maxTouchPoints || 0) > 1);

// Running as an installed app. "fullscreen" is what the manifest asks for; Android shows it, iOS uses standalone.
export function isStandalone(win = globalThis) {
  const media = (q) => typeof win.matchMedia === "function" && win.matchMedia(q).matches;
  return media("(display-mode: standalone)") || media("(display-mode: fullscreen)") || win.navigator?.standalone === true;
}

export function createInstall(win = globalThis) {
  let deferred = null, installed = false;
  const listeners = new Set();
  const changed = () => { for (const fn of listeners) fn(); };
  win.addEventListener?.("beforeinstallprompt", (event) => {
    // Keep the browser's mini-bar away; the Settings tile offers the install instead.
    event.preventDefault();
    deferred = event;
    changed();
  });
  win.addEventListener?.("appinstalled", () => { installed = true; deferred = null; changed(); });
  return {
    state: () => installState({ standalone: isStandalone(win), installed, prompt: !!deferred, ios: isIOS(win.navigator) }),
    onChange: (fn) => listeners.add(fn),
    // The browser's own dialog. A prompt can be shown once; a dismissed one may come back later as a new event.
    async prompt() {
      const event = deferred;
      if (!event) return "unavailable";
      deferred = null;
      try {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice?.outcome === "accepted") installed = true;
        return choice?.outcome || "dismissed";
      } catch {
        return "dismissed";
      } finally {
        changed();
      }
    },
  };
}
