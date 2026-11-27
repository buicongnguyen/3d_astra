// Frontier Defence, the small always-loaded part: the start-screen level list (with Endless, the
// Daily seed and the perks sheet since 0.21) and the hooks the rest of the app calls
// (A.defenceBegin, defenceTap, defenceHud, defenceResult, defenceHeading, defenceMission).
// The match interface itself (pads, crews, sheets, top-bar chips, result) is app/defence-ui.js,
// imported on first use so the first download grows little.
import "../defence-menu.css";
import { $ } from "./dom.js";
import { DEFENCE_LEVELS, ZONE_NAMES, defenceVariant } from "../defence/levels.js";
import { hasHeroic, HEROIC_LIVES, HEROIC_WAVES } from "../defence/heroic.js";
import { loadDefence, saveDefence, recordDefence, recordHeroic, heroicOpen, heroicWon, starsOf, levelOpen, PERKS, ownedPerks, starsFree, canBuyPerk, buyPerk, bestScore, recordScore, dayKey, dailySeed, endlessSeed } from "../defence/progress.js";
import { guideWanted, recordGuided } from "../defence/progress.js";
import { boardOf, recordRun, endlessScore } from "../defence/progress.js";
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
const DEPS = { recordHeroic, $, GARRISONS, starsFor, D, hasPortrait, portrait, icon, ACTION_KEYS, DEFENCE_LEVELS, loadDefence, recordDefence, saveDefence, statTile, formatClock, DIFFICULTY_LABELS, FACTIONS, CROSSINGS, recordScore, bestScore, dayKey, ZONE_NAMES };
// AAA round 3, R3-E: the guided first build and the next-star hint.
Object.assign(DEPS, { guideWanted, recordGuided, hasHeroic });
// W10: the Endless leaderboard (the result card records a run and shows the board).
Object.assign(DEPS, { boardOf, recordRun, endlessScore, boardHtml: (runs, place) => boardHtml(runs, place) });

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
  { id: "heroic", label: "Heroic", note: "Elite waves" },
  // W10: the Endless top ten of the picked map; Start plays Endless there.
  { id: "records", label: "Records", note: "Endless top 10" },
];
// The commander a run ended with: its branch, else its rank (W10 leaderboard).
const commanderLabel = (run) => (run.branch ? GARRISONS.commander.branches[run.branch]?.name || run.branch : run.rank > 1 ? GARRISONS.commander.ranks[run.rank - 2]?.name || `Rank ${run.rank}` : "Rank 1");
// The Endless top ten of one map as a table (the Records tab and the Endless result); `place` (1 to 10) marks the new run.
export function boardHtml(runs, place = 0) {
  if (!runs.length) return `<p class="defence-board-empty">No Endless runs on this map yet. Play Endless to set the first record.</p>`;
  return `<table class="defence-board"><thead><tr><th scope="col">#</th><th scope="col">Waves held</th><th scope="col">Score</th><th scope="col">Hero</th><th scope="col">Date</th></tr></thead><tbody>${runs.map((r, i) => `<tr${i + 1 === place ? ' class="new" aria-current="true"' : ""}><td translate="no">${i + 1}</td><td translate="no">${r.wave}</td><td translate="no">${r.score}</td><td data-branch="${r.branch || "none"}">${commanderLabel(r)}</td><td translate="no">${r.date}</td></tr>`).join("")}</tbody></table>`;
}
// What a locked Heroic shows (the finale is teased, not named: round 3 puts a boss there).
export const HEROIC_TEASER = "Clear this level once to open its Heroic challenge: six hard waves, gold elites with affixes, and an all-elite finale. +1 star.";
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
  const records = () => S.defenceVariant === "records";
  // The definition a Defence menu match is built from: the level, its variant and the perks owned.
  // Kept while nothing changes, so the briefing preview is not rebuilt for nothing.
  function defenceMission(l) {
    const progress = S.defenceProgress || loadDefence(), perks = ownedPerks(progress);
    // A locked or missing Heroic plays the designed level (the Start button is held back by the menu).
    // The Records tab (W10) starts Endless on the picked map.
    const picked = S.defenceVariant === "records" ? "endless" : S.defenceVariant;
    const variant = picked === "heroic" && !heroicOpen(progress, l.id) ? "levels" : picked, seed = variant === "levels" || variant === "heroic" ? 0 : seedFor(l);
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
    const l = level(), foe = FACTIONS[l.factions[1]], locked = variant === "heroic" && !heroicOpen(progress, l.id);
    const rows = DEFENCE_LEVELS.map((d, i) => {
      const open = levelOpen(progress, i), stars = starsOf(progress, d.id), best = progress.levels[d.id], score = variant === "levels" || variant === "heroic" ? 0 : variant === "records" ? boardOf(progress, d.id)[0]?.score || 0 : bestScore(progress, variant, d.id, day);
      const hOpen = heroicOpen(progress, d.id), hWon = heroicWon(progress, d.id);
      const mark = !open ? icon("lock") : variant === "heroic" ? `<span class="heroic-mark${hWon ? " won" : ""}" role="img" aria-label="${hWon ? "Heroic cleared" : hOpen ? "Heroic open" : "Heroic locked"}">${hWon ? "★" : hOpen ? icon("bolt") : icon("lock")}</span>` : variant === "levels" ? `${starRow(stars)}${best?.difficulty === "veteran" ? '<span class="veteran-mark" title="Veteran clear" aria-label="Veteran clear">V</span>' : ""}` : `<span class="defence-best"><span>Best</span> <i translate="no">${score}</i></span>`;
      return `<li><button data-level="${i}" data-level-id="${d.id}"${i === S.defencePick ? ' aria-current="true"' : ""}${open ? "" : " disabled"}><b>${i + 1}</b><span><strong>${d.title}</strong><small><span>${FACTIONS[d.factions[1]]?.short || ""}</span> · <span>${variant === "heroic" && hasHeroic(d.id) ? HEROIC_WAVES : d.defence.waves.length} waves</span></small></span><em>${mark}</em></button></li>`;
    }).join("");
    $("defence-setup").innerHTML = `<div class="defence-variants" role="group" aria-label="Defence mode">${VARIANTS.map((v) => `<button type="button" data-defence-variant="${v.id}" aria-pressed="${v.id === variant}"><strong>${v.label}</strong><small>${v.id === "daily" ? `<span>${dayLabel(day)}</span>` : v.note}</small></button>`).join("")}</div>
      <ol class="stage-list defence-levels" aria-label="Defence levels">${rows}</ol>
      ${records() ? `<section class="defence-records" aria-label="Endless top 10"><h3><span>Endless top 10</span> · <span>${l.title}</span></h3>${boardHtml(boardOf(progress, l.id))}</section>` : ""}
      <button type="button" id="defence-perks-toggle" class="defence-perks-toggle" aria-expanded="${perksOpen}" aria-controls="defence-perks">${icon("bolt")}<span>Perks</span><small><b translate="no">${starsFree(progress)}</b> <span>stars to spend</span></small></button>
      ${perksSheet(progress)}`;
    const best = variant === "levels" || variant === "heroic" ? 0 : bestScore(progress, variant === "records" ? "endless" : variant, l.id, day);
    $("briefing-title").textContent = variant === "levels" ? `Defence · ${l.title}` : `${variant === "daily" ? "Daily" : variant === "heroic" ? "Heroic" : "Endless"} · ${l.title}`;
    $("briefing-text").textContent = variant === "levels" ? l.briefing.text : variant === "records" ? "The ten best Endless runs on this map, kept in this browser. Start to play Endless here and set a new one." : variant === "heroic" ? (locked ? HEROIC_TEASER : defenceMission(l).briefing.text) : variant === "daily"
      ? "Today's waves, the same for every commander, from a seed of the date. They never stop: hold as many as you can."
      : "The waves never stop and grow with every one you hold. Your score is the number of waves held.";
    $("briefing-goal").textContent = variant === "heroic" ? (locked ? "Locked: clear the level first" : `Hold the Heroic ${HEROIC_WAVES} waves`) : variant === "levels" ? l.objectives[0].text : best ? `Best: ${best} waves held` : "Hold as many waves as you can";
    const lives = (variant === "heroic" ? HEROIC_LIVES : l.defence.lives) + (ownedPerks(progress).includes("reserves") ? PERKS.reserves.lives : 0);
    $("briefing-rivals").textContent = foe ? `${foe.name} · ${lives} lives` : `${lives} lives`;
    $("difficulty-description").textContent = DEFENCE_DIFFICULTY[S.settings.campaignDifficulty] || "";
    if (!$("start").disabled && !S.loadFailed) $("start").textContent = variant === "endless" || variant === "records" ? "Start endless" : variant === "daily" ? "Start daily" : variant === "heroic" ? (locked ? "Locked" : "Start Heroic") : "Start defence";
    // A locked Heroic cannot be started: the variant stays visible for its teaser.
    if (variant === "heroic" && !S.loadFailed) $("start").setAttribute("aria-disabled", String(locked)); else $("start").removeAttribute("aria-disabled");
    A.renderSkywing?.(); // H1/H2: the Skywing row (src/skywing-ui.js) after the menu was redrawn
  }

  // The battlefield heading while a defence level is picked or played.
  function defenceHeading() {
    if (S.playMode !== "defence" && !S.sim?.defence) return false;
    const l = S.sim?.defence ? S.sim.missionDef : level(), i = DEFENCE_LEVELS.findIndex((d) => d.id === l.id);
    const variant = S.sim?.defence ? l.variant || "levels" : S.defenceVariant;
    document.querySelector(".map-heading p").innerHTML = `${l.title.toUpperCase()} <span>·</span> ${DIFFICULTY_LABELS[S.sim?.difficulty || S.settings.campaignDifficulty].toUpperCase()}`;
    document.querySelector(".map-heading h1").innerHTML = `${l.title}<span>.</span>`;
    $("operation-label").textContent = variant === "heroic" ? "DEFENCE · HEROIC" : variant === "endless" || variant === "records" ? "DEFENCE · ENDLESS" : variant === "daily" ? "DEFENCE · DAILY SEED" : `DEFENCE · LEVEL ${String(i + 1).padStart(2, "0")} / ${String(DEFENCE_LEVELS.length).padStart(2, "0")}`;
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
    // Carrier moments from the frame loop (app/frame.js): only once the interface is loaded.
    defenceEvent: (event) => (S.sim?.defence && ui ? ui.event(event) : undefined),
  });
  return function bind() {
    // The variant switch and the perks sheet (the level buttons are app/briefing.js's).
    // A locked Heroic cannot start (renderDefenceMenu sets aria-disabled on Start): stop the click before match-flow sees it.
    $("start").addEventListener("click", (event) => { if ($("start").getAttribute("aria-disabled") === "true") { event.stopImmediatePropagation(); event.preventDefault(); } }, true);
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
