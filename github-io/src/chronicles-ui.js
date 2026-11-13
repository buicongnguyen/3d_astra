// Faction Chronicles on the start screen (0.20): four cards in the campaign map's footer (faction
// colour and emblem, lead portrait, three relay pips, a locked state that names the mission that
// opens it) and the same choices as a list section in the setup column, which stays the keyboard
// and screen-reader structure. Choosing a chronicle shows its three missions in that list.
// Pure HTML strings; app/briefing.js wires the clicks. Text 11 px or more and 44 px taps
// (src/chronicles.css).
import "./chronicles.css";
import { CHRONICLES, chronicleById, chronicleUnlocked, chronicleCount, chronicleDone, missionsOf, clearedIn, unlockedIn, bestIn, MISSIONS, missionIndex } from "./campaign.js";
import { FACTIONS } from "./story/world.js";
import { castPortrait, castName } from "./cast-portraits.js";
import { MAP_TEXT } from "./story/campaign-map.js";
import { icon } from "./icons.js";

const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// A faction's name in a header: "Sunward", "Veil" (FACTIONS short without the article).
export const sideName = (id) => (FACTIONS[id]?.short || id).replace(/^The /, "");
// The main mission that opens a chronicle, for "Clear ... to unlock".
const opener = (c) => MISSIONS[missionIndex(c.unlockAfter)]?.title || c.unlockAfter;
export const lockedText = (c) => `Clear ${opener(c)} to unlock`;

// The faction emblems of src/story/world.js as small flat glyphs (the 3D sprites live in emblems.js).
const GLYPH = {
  ashfall: `<path d="M12 2l3 6-3 2-3-2z"/><rect x="5" y="12" width="14" height="2.4" rx="1"/><rect x="6.5" y="15.6" width="11" height="2.4" rx="1"/><rect x="8" y="19.2" width="8" height="2.4" rx="1"/>`,
  sunward: `<path d="M6 10a6 6 0 0 1 12 0z"/><circle cx="12" cy="17" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 12.8v8.4M7.8 17h8.4" stroke="currentColor" stroke-width="1.6"/>`,
  wardens: `<circle cx="12" cy="5.5" r="3"/><circle cx="5.5" cy="17.5" r="3"/><circle cx="18.5" cy="17.5" r="3"/><path d="M12 5.5L5.5 17.5h13z" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  veil: `<path d="M3 6c3-1 6-1 9 1 3-2 6-2 9-1v13c-3-1-6-1-9 1-3-2-6-2-9-1z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 13q4 3 8 0" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
};
export const glyph = (id) => `<svg class="chron-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">${GLYPH[id] || ""}</svg>`;
const pips = (n, total) => `<span class="chron-pips" role="img" aria-label="${n} of ${total} cleared">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
const stateOf = (progress, c) => (chronicleDone(progress, c.id) ? "done" : chronicleUnlocked(progress, c.id) ? "open" : "locked");
const style = (c) => `--chron:${FACTIONS[c.faction]?.hex || "#92ebc5"};--chron-glow:${FACTIONS[c.faction]?.glow || "#ffffff"}`;

// The four cards in the campaign map's footer. Like the map's relay nodes they are pointer and
// touch shortcuts, hidden from assistive technology (the list section below is the real one).
export function chronicleCardsHTML({ progress, campaign = "main" }) {
  const card = (c) => {
    const state = stateOf(progress, c), n = chronicleCount(progress, c.id), total = c.missions.length;
    const lock = state === "locked" ? `<small class="chron-lock">${icon("lock")}<span>${esc(lockedText(c))}</span></small>` : "";
    return `<button class="chron-card ${state}${campaign === c.id ? " picked" : ""}" data-chronicle="${c.id}" style="${style(c)}" tabindex="-1" aria-hidden="true"${state === "locked" ? " disabled" : ""} title="${esc(state === "locked" ? lockedText(c) : c.title)}">
      <span class="chron-face">${castPortrait(c.lead, "small")}${glyph(c.faction)}</span>
      <span class="chron-words"><strong>${esc(c.title)}</strong><small translate="no">${esc(sideName(c.faction))}</small>${lock}</span>${pips(n, total)}</button>`;
  };
  return `<div class="cmap-chronicles chron-cards" data-campaign="${esc(campaign)}"><span class="cmap-label">${esc(MAP_TEXT.chronicles)}</span><div class="chron-row">${CHRONICLES.map(card).join("")}</div></div>`;
}

// The setup column: the four chronicles as a list section under the main campaign's acts.
export function chronicleListHTML({ progress, campaign = "main" }) {
  const row = (c) => {
    const state = stateOf(progress, c), n = chronicleCount(progress, c.id), total = c.missions.length;
    const sub = state === "locked" ? `<span class="chron-lock">${esc(lockedText(c))}</span>` : `<span translate="no">${esc(sideName(c.faction))}</span> · <span translate="no">${esc(castName(c.lead))}</span>`;
    return `<li><button class="chron-entry ${state}" data-chronicle="${c.id}" style="${style(c)}"${campaign === c.id ? ' aria-current="true"' : ""}${state === "locked" ? ` disabled title="${esc(lockedText(c))}"` : ""}><span class="chron-face">${castPortrait(c.lead, "small")}${glyph(c.faction)}</span><span><strong>${esc(c.title)}</strong><small>${sub}</small></span><em>${state === "locked" ? icon("lock") : pips(n, total)}</em></button></li>`;
  };
  return `<section class="act chron-section" aria-labelledby="act-chronicles"><h3 class="chron-title" id="act-chronicles"><strong>${esc(MAP_TEXT.chronicles)}</strong></h3><p class="chron-note">${esc(MAP_TEXT.chroniclesNote)}</p><ol class="stage-list chron-list" aria-label="${esc(MAP_TEXT.chronicles)}">${CHRONICLES.map(row).join("")}</ol></section>`;
}

// The setup column while a chronicle is chosen: its heading, its three missions and the way back.
// `card(mission, index)` draws a mission row the way the main campaign does (app/briefing.js).
export function chronicleMissionsHTML({ progress, campaign, card }) {
  const c = chronicleById(campaign);
  if (!c) return "";
  return `<section class="act chron-missions" style="${style(c)}" aria-labelledby="act-chronicle">
    <button class="secondary chron-back" data-campaign="main">${icon("arrow")}<span>Main campaign</span></button>
    <h3 class="chron-title" id="act-chronicle"><span>CHRONICLE</span> <strong>${esc(c.title)}</strong></h3>
    <p class="chron-lead">${castPortrait(c.lead, "small")}<span>${esc(c.summary)}</span></p>
    <ol class="stage-list" aria-label="Chronicle missions">${missionsOf(campaign).map(card).join("")}</ol></section>`;
}

// A mission row's state for any campaign: open, cleared and the best result.
export const rowState = (progress, campaign, index) => ({ open: unlockedIn(progress, campaign, index), done: clearedIn(progress, campaign, index), best: bestIn(progress, campaign, index) });

// Headers while a chronicle mission is picked or played.
export const chronicleLabel = (campaign, index) => `CHRONICLE · ${sideName(chronicleById(campaign)?.faction)} · ${index + 1}/${missionsOf(campaign).length}`;
export const chronicleTitle = (campaign, mission) => `${sideName(chronicleById(campaign)?.faction)} · ${mission.title}`;
