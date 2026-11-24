// Preferences (applyPreferences), the settings sheet and the sound button. Language, theme, quality and full
// screen live in the sheet only (2026-11-24: the title-bar and pause-menu copies are gone).
import { $ } from "./dom.js";
import { SettingsUI } from "../settings-ui.js";
import { icon } from "../icons.js";
import { localizeDOM, loadLocale, loadStory } from "../i18n.js";
import { motionOffFor, saveSettings } from "../settings.js";
import { teamColors } from "../faction-colors.js";
import { saveRules } from "./rules-store.js";
import { getTheme, setTheme } from "../theme-switch.js";

// True while `:root.motion-off` is set (Eco graphics, combat motion off, or reduced motion): JS
// effects check it the way CSS animations obey the class.
export const motionOff = () => typeof document !== "undefined" && document.documentElement.classList.contains("motion-off");

export function setupPreferences(S, A) {
  const Z = S.screen;
  const localization = localizeDOM(document.body, S.settings.language);

  // A language's catalogs (UI and story) arrive in their own files; the page is translated again
  // once they are in. Story text is plain text nodes, so open briefings, objectives and the Comms log follow.
  function syncStoryLanguage() {
    const lang = S.settings.language;
    if (lang === 'en') return;
    Promise.all([loadLocale(lang), loadStory(lang)]).then(() => { if (S.settings.language === lang) localization.apply(lang); }, () => {});
  }

  // `:root.motion-off`: decorative CSS animation stops (style.css); updated live on every settings
  // change and when the system's reduced-motion preference changes.
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function syncMotion() {
    document.documentElement.toggleAttribute("data-large-ui", S.settings.uiScale > 100);
    document.documentElement.style.setProperty("--interface-scale", String((S.settings.uiScale || 100) / 100));
    const root = document.documentElement;
    root.dataset.reducedMotion = S.settings.reducedMotion || "system";
    root.classList.toggle("motion-off", motionOffFor(S.settings, reducedMotion.matches));
    // Phase 2 display choices that are pure CSS: reading-text size and the desktop minimap corner.
    root.dataset.textSize = S.settings.textSize || "s";
    root.classList.toggle("minimap-right", S.settings.minimapSide === "right");
  }

  // The sheet applies every change at once (a slider up to once a frame), so the costly steps run only when a
  // setting they read changed: re-translating the page on a language change, re-tinting the world when
  // anything but the cheap keys below changed.
  const CHEAP = new Set(["masterVolume", "musicVolume", "sfxVolume", "muted", "quietMode", "music", "panSpeed", "edgeScroll", "confirmRestart", "autocast", "groupPace", "showFps",
    "cameraAngle", "cameraTurn", "zoomSpeed", "minimapSide", "alerts", "frameCap", "haptics", "textSize"]);
  let applied = null, storageWarned = false;
  function applyPreferences(value) {
    const before = applied;
    applied = S.settings = value;
    const changed = (key) => !before || before[key] !== value[key];
    syncMotion();
    if (changed("language")) {
      localization.apply(S.settings.language);
      syncStoryLanguage();
    }
    S.muted = S.settings.muted;
    S.audio?.applySettings(S.settings);
    $("fps").hidden = !S.settings.showFps;
    if (!before || Object.keys(value).some((key) => !CHEAP.has(key) && changed(key))) S.view?.applySettings(S.settings);
    A.syncAutocast(false);
    $("audio").innerHTML = icon(S.muted ? "muted" : "volume");
    $("audio").setAttribute("aria-label", S.muted ? "Enable sound" : "Mute sound");
    $("audio").title = S.muted ? "Enable sound" : "Mute sound";
    document.documentElement.style.setProperty(
      "--team-friendly",
      teamColors(S.settings, S.look)[0],
    );
    document.documentElement.style.setProperty(
      "--team-hostile",
      teamColors(S.settings, S.look)[1],
    );
    if (!saveSettings(S.settings) && !storageWarned && (storageWarned = true))
      A.notice(
        "Settings applied for this session. Browser storage is unavailable.",
      );
  }

  const settingsUI = new SettingsUI({
    get: () => S.settings,
    apply: applyPreferences,
    soundTest: name => A.playSoundTest(name),
    extras: {
      // This match's clock speed (app/frame.js): ×1 / ×2 / ×3, never stored.
      speed: { available: () => Z.started && !S.sim.result, get: () => A.getSpeed?.() ?? 1, set: (n) => { A.setMatchSpeed?.(n); A.updateUI(); } },
      fullscreen: { supported: () => A.fullscreenInfo?.supported() ?? false, standalone: () => A.fullscreenInfo?.standalone() ?? false, active: () => A.fullscreenInfo?.active() ?? false, toggle: (button) => A.fullscreenInfo?.toggle(button) },
      theme: { get: getTheme, set: setTheme },
      help: () => A.showHelp(),
    },
    enter: () => {
      const state = Z.hold();
      S.keys.clear();
      S.touchControls?.reset();
      S.drag = null;
      S.pointer.inside = false;
      A.clearMode();
      S.ambience?.update(S.settings, false, false);
      return state;
    },
    leave: (state) => {
      Z.release(state, { held: !!S.sim.result });
      if (document.hidden) Z.holdIfStarted();
      A.updateUI();
    },
  });

  // The skirmish battle rules chosen on the setup screen (S.rules, app/rule-options.js) are remembered
  // between visits in their own key; the settings record keeps a fixed set of keys.
  const rememberRules = () => saveRules(S.rules);
  // A quarter turn of the camera (Page Up / Page Down), stored like the sheet's Turn row.
  function turnCamera(step) {
    if (S.sim?.defence) { A.notice("Frontier Defence frames the roads itself."); return; }
    const turn = (((S.settings.cameraTurn || 0) + step * 90) % 360 + 360) % 360;
    applyPreferences({ ...S.settings, cameraTurn: turn });
  }
  Object.assign(A, { settingsUI, localization, applyPreferences, motionOff, rememberRules, turnCamera });
  return function bind() {
    syncStoryLanguage();
    syncMotion();
    reducedMotion.addEventListener("change", syncMotion);

    $("briefing-settings").onclick = () => settingsUI.open();

    $("audio").onclick = () => {
      A.unlockAudio();
      S.muted = !S.muted;
      applyPreferences({ ...S.settings, muted: S.muted });
      $("audio").innerHTML = icon(S.muted ? "muted" : "volume");
      $("audio").title = S.muted ? "Enable sound" : "Mute sound";
      $("audio").setAttribute("aria-label", $("audio").title);
    };
  };
}
