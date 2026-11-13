// Frontier Defence, the small always-loaded part: the start-screen level list (with Endless, the
// Daily seed and the perks sheet since 0.21) and the hooks the rest of the app calls
// (A.defenceBegin, defenceTap, defenceHud, defenceResult, defenceHeading, defenceMission).
// The match interface itself (pads, crews, sheets, top-bar chips, result) is app/defence-ui.js,
// imported on first use so the first download grows little.
import "../defence-menu.css";
import { $ } from "./dom.js";
import { DEFENCE_LEVELS, defenceVariant } from "../defence/levels.js";
import { loadDefence, saveDefence, recordDefence, starsOf, levelOpen, PERKS, ownedPerks, starsFree, canBuyPerk, buyPerk, bestScore, recordScore, dayKey, dailySeed, endlessSeed } from "../defence/progress.js";
import { icon } from "../icons.js";
import { FACTIONS } from "../story/world.js";
import { DIFFICULTY_LABELS } from "../difficulty.js";
import { GARRISONS, starsFor } from "../sim/defence.js";
import { DEFINITIONS as D } from "../data.js";
import { hasPortrait, portrait } from "../portraits.js";
import { ACTION_KEYS } from "../hotkeys.js";
import { statTile, formatClock } from "../results-ui.js";
import { CROSSINGS } from "../terrain.js";

// What the lazy match interface uses from the main bundle (see app/defence-ui.js).
const DEPS = { $, GARRISONS, starsFor, D, hasPortrait, portrait, icon, ACTION_KEYS, DEFENCE_LEVELS, loadDefence, recordDefence, saveDefence, statTile, formatClock, DIFFICULTY_LABELS, FACTIONS, CROSSINGS, recordScore, bestScore, dayKey };

export const DEFENCE_DIFFICULTY = {
  story: "Smaller waves and more alloy to start.",
  standard: "The waves as designed.",
  veteran: "Larger waves and tougher crews.",
};
// The three ways to play a level (0.21): the designed ten waves, Endless, and the Daily seed.
const VARIANTS = [
  { id: "levels", label: "Levels", note: "Ten waves, stars" },
  { id: "endless", label: "Endless", note: "Waves forever" },
  { id: "daily", label: "Daily", note: "Today's seed" },
];
export const PERK_TEXT = {
  quartermaster: "Your first tower on each level costs 20% less.",
  reserves: "Every level starts with 2 more lives.",
  gunnery: "The commander's Barrage recharges 25% faster.",
};
const starRow = (n) => `<span class="stars" role="img" aria-label="${n} of 3 stars">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}">★</i>`).join("")}</span>`;
// "13 Nov" from YYYY-MM-DD, for the Daily seed label.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (day) => `${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

export function setupDefenceEntry(S, A) {
  const Z = S.screen;
  S.defenceProgress = loadDefence();
  S.defenceVariant ??= "levels";
  let ui = null, loading = null, perksOpen = false, made = null;
  // The match interface, imported once; every later call is immediate.
  function load() {
    loading ??= import("./defence-ui.js").then((m) => (ui = m.createDefenceUI(S, A, DEPS)));
    return loading;
  }
  const level = () => DEFENCE_LEVELS[S.defencePick] || DEFENCE_LEVELS[0];
  const seedFor = (l) => (S.defenceVariant === "daily" ? dailySeed(dayKey()) : endlessSeed(l.id));
  // The definition a Defence menu match is built from: the level, its variant and the perks owned.
  // Kept while nothing changes, so the briefing preview is not rebuilt for nothing.
  function defenceMission(l) {
    const perks = ownedPerks(S.defenceProgress || loadDefence()), variant = S.defenceVariant, seed = variant === "levels" ? 0 : seedFor(l);
    const key = `${l.id}|${variant}|${seed}|${perks.join(",")}`;
    if (made?.key !== key) made = { key, def: defenceVariant(l, { variant, seed, perks }) };
    return made.def;
  }

  function perksSheet(progress) {
    const free = starsFree(progress), owned = ownedPerks(progress);
    return `<section id="defence-perks" class="defence-perks"${perksOpen ? "" : " hidden"} aria-label="Perks">
      <p class="defence-perks-note">Stars buy small permanent perks. They apply to Defence levels only, never the campaign.</p>
      <ul>${Object.entries(PERKS).map(([id, p]) => {
        const have = owned.includes(id), can = canBuyPerk(progress, id);
        return `<li data-perk="${id}"${have ? ' class="owned"' : ""}><span><strong>${p.name}</strong><small>${PERK_TEXT[id]}</small></span><button type="button" data-buy-perk="${id}"${have || !can ? " disabled" : ""} aria-label="${have ? `${p.name}: owned` : `Buy ${p.name} for ${p.stars} stars`}">${have ? `${icon("check")}<span>Owned</span>` : `<span translate="no">★ ${p.stars}</span>`}</button></li>`;
      }).join("")}</ul>
      <p class="defence-perks-free"><span>Stars to spend</span> <b translate="no">${free}</b></p>
    </section>`;
  }

  function renderDefenceMenu() {
    const progress = S.defenceProgress = loadDefence(), variant = S.defenceVariant, day = dayKey();
    // Endless and the Daily seed run on any level that is open; a locked pick falls back to the first.
    if (!levelOpen(progress, S.defencePick ?? 0)) S.defencePick = 0;
    const l = level(), foe = FACTIONS[l.factions[1]];
    const rows = DEFENCE_LEVELS.map((d, i) => {
      const open = levelOpen(progress, i), stars = starsOf(progress, d.id), best = progress.levels[d.id], score = variant === "levels" ? 0 : bestScore(progress, variant, d.id, day);
      const mark = !open ? icon("lock") : variant === "levels" ? `${starRow(stars)}${best?.difficulty === "veteran" ? '<span class="veteran-mark" title="Veteran clear" aria-label="Veteran clear">V</span>' : ""}` : `<span class="defence-best"><span>Best</span> <i translate="no">${score}</i></span>`;
      return `<li><button data-level="${i}" data-level-id="${d.id}"${i === S.defencePick ? ' aria-current="true"' : ""}${open ? "" : " disabled"}><b>${i + 1}</b><span><strong>${d.title}</strong><small>${FACTIONS[d.factions[1]]?.short || ""} · <span>${d.defence.waves.length} waves</span></small></span><em>${mark}</em></button></li>`;
    }).join("");
    $("defence-setup").innerHTML = `<div class="defence-variants" role="group" aria-label="Defence mode">${VARIANTS.map((v) => `<button type="button" data-defence-variant="${v.id}" aria-pressed="${v.id === variant}"><strong>${v.label}</strong><small>${v.id === "daily" ? `<span translate="no">${dayLabel(day)}</span>` : v.note}</small></button>`).join("")}</div>
      <ol class="stage-list defence-levels" aria-label="Defence levels">${rows}</ol>
      <button type="button" id="defence-perks-toggle" class="defence-perks-toggle" aria-expanded="${perksOpen}" aria-controls="defence-perks">${icon("bolt")}<span>Perks</span><small><b translate="no">${starsFree(progress)}</b> <span>stars to spend</span></small></button>
      ${perksSheet(progress)}`;
    const best = variant === "levels" ? 0 : bestScore(progress, variant, l.id, day);
    $("briefing-title").textContent = variant === "levels" ? `Defence · ${l.title}` : `${variant === "daily" ? "Daily" : "Endless"} · ${l.title}`;
    $("briefing-text").textContent = variant === "levels" ? l.briefing.text : variant === "daily"
      ? "Today's waves, the same for every commander, from a seed of the date. They never stop: hold as many as you can."
      : "The waves never stop and grow with every one you hold. Your score is the number of waves held.";
    $("briefing-goal").textContent = variant === "levels" ? l.objectives[0].text : best ? `Best: ${best} waves held` : "Hold as many waves as you can";
    const lives = l.defence.lives + (ownedPerks(progress).includes("reserves") ? PERKS.reserves.lives : 0);
    $("briefing-rivals").textContent = foe ? `${foe.name} · ${lives} lives` : `${lives} lives`;
    $("difficulty-description").textContent = DEFENCE_DIFFICULTY[S.settings.campaignDifficulty] || "";
    if (!$("start").disabled && !S.loadFailed) $("start").textContent = variant === "endless" ? "Start endless" : variant === "daily" ? "Start daily" : "Start defence";
  }

  // The battlefield heading while a defence level is picked or played.
  function defenceHeading() {
    if (S.playMode !== "defence" && !S.sim?.defence) return false;
    const l = S.sim?.defence ? S.sim.missionDef : level(), i = DEFENCE_LEVELS.findIndex((d) => d.id === l.id);
    const variant = S.sim?.defence ? l.variant || "levels" : S.defenceVariant;
    document.querySelector(".map-heading p").innerHTML = `${l.title.toUpperCase()} <span>·</span> ${DIFFICULTY_LABELS[S.sim?.difficulty || S.settings.campaignDifficulty].toUpperCase()}`;
    document.querySelector(".map-heading h1").innerHTML = `${l.title}<span>.</span>`;
    $("operation-label").textContent = variant === "endless" ? "DEFENCE · ENDLESS" : variant === "daily" ? "DEFENCE · DAILY SEED" : `DEFENCE · LEVEL ${String(i + 1).padStart(2, "0")} / ${String(DEFENCE_LEVELS.length).padStart(2, "0")}`;
    return true;
  }

  Object.assign(A, {
    renderDefenceMenu,
    defenceHeading,
    defenceMission,
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
  return function bind() {
    // The variant switch and the perks sheet (the level buttons are app/briefing.js's).
    $("defence-setup").addEventListener("click", (event) => {
      if (Z.started) return;
      const v = event.target.closest("[data-defence-variant]"), toggle = event.target.closest("#defence-perks-toggle"), buy = event.target.closest("[data-buy-perk]");
      if (v && v.dataset.defenceVariant !== S.defenceVariant) { S.defenceVariant = v.dataset.defenceVariant; A.previewBattle(); }
      else if (toggle) { perksOpen = !perksOpen; renderDefenceMenu(); if (perksOpen) $("defence-perks")?.scrollIntoView({ block: "nearest" }); }
      else if (buy && !buy.disabled) {
        const before = S.defenceProgress;
        S.defenceProgress = buyPerk(loadDefence(), buy.dataset.buyPerk);
        if (S.defenceProgress !== before) { saveDefence(S.defenceProgress); A.tone?.(880, 0.12); }
        A.previewBattle();
      }
    });
  };
}
