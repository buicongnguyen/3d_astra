// Preferences (applyPreferences), the settings dialog, language row, and the quality and sound buttons.
import { $ } from "./dom.js";
import { SettingsUI } from "../settings-ui.js";
import { icon } from "../icons.js";
import { localizeDOM, loadLocale, loadStory } from "../i18n.js";
import { palette, saveSettings } from "../settings.js";
import { teamColors } from "../faction-colors.js";

export function setupPreferences(S, A) {
  const Z = S.screen;
  const localization = localizeDOM(document.body, S.settings.language);

  // Vietnamese story text arrives in its own file; the page is translated again once it is in.
  // Story text is plain text nodes, so open briefings, objectives and the Comms log follow.
  function syncStoryLanguage() {
    if (S.settings.language !== 'vi') return;
    Promise.all([loadLocale(), loadStory()]).then(() => { if (S.settings.language === 'vi') localization.apply('vi'); }, () => {});
  }

  const languageRow = document.createElement('label');

  function applyPreferences(value) {
    S.settings = value;
    localization.apply(S.settings.language);
    syncStoryLanguage();
    $('language').value = S.settings.language;
    S.muted = S.settings.muted;
    S.audio?.applySettings(S.settings);
    $("fps").hidden = !S.settings.showFps;
    S.view?.applySettings(S.settings);
    A.syncAutocast(false);
    $("quality").textContent = S.settings.quality === "eco" ? "Eco" : "High";
    $("audio").innerHTML = icon(S.muted ? "muted" : "volume");
    $("audio").setAttribute("aria-label", S.muted ? "Enable sound" : "Mute sound");
    $("audio").title = S.muted ? "Enable sound" : "Mute sound";
    document.documentElement.style.setProperty(
      "--team-friendly",
      palette(S.settings)[0],
    );
    document.documentElement.style.setProperty(
      "--team-hostile",
      teamColors(S.settings, S.mission)[1],
    );
    if (!saveSettings(S.settings))
      A.notice(
        "Settings applied for this session. Browser storage is unavailable.",
      );
  }

  const settingsUI = new SettingsUI({
    get: () => S.settings,
    apply: applyPreferences,
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

  Object.assign(A, { settingsUI, localization, applyPreferences });
  return function bind() {
    syncStoryLanguage();

    languageRow.className = 'language-choice menu-only';

    languageRow.title = 'Language / Ngôn ngữ';

    languageRow.innerHTML = `${icon('globe')}<span class="visually-hidden" translate="no">Language / Ngôn ngữ</span><select id="language" aria-label="Language / Ngôn ngữ" translate="no"><option value="en">English</option><option value="vi">Tiếng Việt</option></select>`;

    document.querySelector('.top-actions').prepend(languageRow);

    $('language').value = S.settings.language;

    $('language').onchange = () => applyPreferences({...S.settings, language: $('language').value});

    document
      .querySelector(".top-actions")
      .insertAdjacentHTML(
        "afterbegin",
        '<button id="quality" class="icon-button quality-button" aria-label="Toggle graphics quality" title="Toggle graphics quality">Eco</button>',
      );

    $("briefing-settings").onclick = () => settingsUI.open();

    $("quality").onclick = () => {
      if (!S.view) return;
      applyPreferences({ ...S.settings, quality: S.view.lowPower ? "high" : "eco" });
      $("quality").textContent = S.view.lowPower ? "Eco" : "High";
      A.notice(
        S.view.lowPower
          ? "Eco graphics: reduced resolution and simple shadows."
          : "High graphics: detailed shadows and higher resolution.",
      );
    };

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
