// Frontier Defence, the small always-loaded part: the start-screen level list and the hooks the
// rest of the app calls (A.defenceBegin, defenceTap, defenceHud, defenceResult, defenceHeading).
// The match interface itself (pads, crews, sheets, top-bar chips, result) is app/defence-ui.js,
// imported on first use so the first download grows little.
import "../defence-menu.css";
import { $ } from "./dom.js";
import { DEFENCE_LEVELS } from "../defence/levels.js";
import { loadDefence, saveDefence, recordDefence, starsOf, levelOpen } from "../defence/progress.js";
import { icon } from "../icons.js";
import { FACTIONS } from "../story/world.js";
import { DIFFICULTY_LABELS } from "../difficulty.js";
import { GARRISONS, starsFor } from "../sim/defence.js";
import { DEFINITIONS as D } from "../data.js";
import { hasPortrait, portrait } from "../portraits.js";
import { ACTION_KEYS } from "../hotkeys.js";
import { statTile, formatClock } from "../results-ui.js";

// What the lazy match interface uses from the main bundle (see app/defence-ui.js).
const DEPS = { $, GARRISONS, starsFor, D, hasPortrait, portrait, icon, ACTION_KEYS, DEFENCE_LEVELS, loadDefence, recordDefence, saveDefence, statTile, formatClock, DIFFICULTY_LABELS, FACTIONS };

export const DEFENCE_DIFFICULTY = {
  story: "Smaller waves and more alloy to start.",
  standard: "The waves as designed.",
  veteran: "Larger waves and tougher crews.",
};
const starRow = (n) => `<span class="stars" role="img" aria-label="${n} of 3 stars">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}">★</i>`).join("")}</span>`;

export function setupDefenceEntry(S, A) {
  const Z = S.screen;
  S.defenceProgress = loadDefence();
  let ui = null, loading = null;
  // The match interface, imported once; every later call is immediate.
  function load() {
    loading ??= import("./defence-ui.js").then((m) => (ui = m.createDefenceUI(S, A, DEPS)));
    return loading;
  }
  const level = () => DEFENCE_LEVELS[S.defencePick] || DEFENCE_LEVELS[0];

  function renderDefenceMenu() {
    const progress = S.defenceProgress = loadDefence(), l = level(), foe = FACTIONS[l.factions[1]];
    $("defence-setup").innerHTML = `<ol class="stage-list defence-levels" aria-label="Defence levels">${DEFENCE_LEVELS.map((d, i) => {
      const open = levelOpen(progress, i), stars = starsOf(progress, d.id), best = progress.levels[d.id];
      return `<li><button data-level="${i}" data-level-id="${d.id}"${i === S.defencePick ? ' aria-current="true"' : ""}${open ? "" : " disabled"}><b>${i + 1}</b><span><strong>${d.title}</strong><small>${FACTIONS[d.factions[1]]?.short || ""} · <span>${d.defence.waves.length} waves</span></small></span><em>${open ? starRow(stars) : icon("lock")}${best?.difficulty === "veteran" ? '<span class="veteran-mark" title="Veteran clear" aria-label="Veteran clear">V</span>' : ""}</em></button></li>`;
    }).join("")}</ol>`;
    $("briefing-title").textContent = `Defence · ${l.title}`;
    $("briefing-text").textContent = l.briefing.text;
    $("briefing-goal").textContent = l.objectives[0].text;
    $("briefing-rivals").textContent = foe ? `${foe.name} · ${l.defence.lives} lives` : `${l.defence.lives} lives`;
    $("difficulty-description").textContent = DEFENCE_DIFFICULTY[S.settings.campaignDifficulty] || "";
    if (!$("start").disabled && !S.loadFailed) $("start").textContent = "Start defence";
  }

  // The battlefield heading while a defence level is picked or played.
  function defenceHeading() {
    if (S.playMode !== "defence" && !S.sim?.defence) return false;
    const l = S.sim?.defence ? S.sim.missionDef : level(), i = DEFENCE_LEVELS.findIndex((d) => d.id === l.id);
    document.querySelector(".map-heading p").innerHTML = `${l.title.toUpperCase()} <span>·</span> ${DIFFICULTY_LABELS[S.sim?.difficulty || S.settings.campaignDifficulty].toUpperCase()}`;
    document.querySelector(".map-heading h1").innerHTML = `${l.title}<span>.</span>`;
    $("operation-label").textContent = `DEFENCE · LEVEL ${String(i + 1).padStart(2, "0")} / ${String(DEFENCE_LEVELS.length).padStart(2, "0")}`;
    return true;
  }

  Object.assign(A, {
    renderDefenceMenu,
    defenceHeading,
    defenceIndex: (id) => DEFENCE_LEVELS.findIndex((d) => d.id === id),
    defenceLoad: load,
    // A defence match began, restarted or was continued.
    defenceBegin: (resume = false) => load().then(() => ui.begin(resume)),
    defenceTap: (x, y) => (S.sim?.defence && ui ? ui.tap(x, y) : false),
    defenceHud: (selected) => {
      const on = !!S.sim?.defence && Z.started;
      document.documentElement.classList.toggle("in-defence", on);
      if (S.sim?.defence) { if (ui) ui.hud(selected); else load(); }
      else ui?.idle();
    },
    defenceResult: () => load().then(() => ui.result()),
  });
  return function bind() {};
}
