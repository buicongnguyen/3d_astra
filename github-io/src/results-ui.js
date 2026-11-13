// Shared pieces of the results screens (skirmish result and mission debrief).
import { victoryLine } from "./factions.js";
const pad = (n) => String(n).padStart(2, "0");
export const formatClock = (seconds) => `${Math.floor(seconds / 60)}:${pad(Math.floor(seconds % 60))}`;
const whole = (n) => String(Math.round(n || 0));

// One tile per number: value large, label small. Labels are plain English so the Vietnamese
// catalogue (src/locales/vi.json) can translate them; they are shown upper-case by CSS.
export function statTile(value, label, tone = "") {
  return `<div class="stat${tone ? ` ${tone}` : ""}"><strong>${value}</strong><span>${label}</span></div>`;
}

// The match counters collected by match-stats.js, as tiles.
export function matchStatTiles(stats, { extra = [], structures = true } = {}) {
  const s = stats || {};
  return [
    ...extra,
    statTile(whole(s.killed), "Enemies defeated"),
    statTile(whole(s.lost), "Units lost", s.lost ? "loss" : ""),
    structures ? statTile(whole(s.structuresDestroyed), "Structures destroyed") : "",
    statTile(whole(s.alloy), "Alloy gathered", "alloy"),
    statTile(whole(s.energy), "Energy gathered", "energy"),
  ].join("");
}

// Skirmish result: outcome banner, the stat grid and the three buttons.
export function skirmishResultHTML({ result, seconds, stats, emblem, arrow, sub, faction = "meridian" }) {
  const win = result === "victory", draw = result === "draw";
  const kind = win ? "won" : draw ? "draw" : "lost";
  const eyebrow = draw ? "Operation concluded" : win ? "Operation successful" : "Operation failed";
  const title = win ? "The frontier is yours." : draw ? "Mutual destruction." : "Your outpost has fallen.";
  const text = win ? victoryLine(faction) : draw ? "All Command cores were destroyed." : "An enemy destroyed your Command core. Regroup and try a different approach.";
  return `<div class="result-card ${kind}" data-result="${result}">
    <div class="result-banner"><div class="result-emblem ${win ? "" : "loss"}"><img src="${emblem}" alt="" width="92" height="92"></div>
      <div class="result-headline"><span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${title}</h2><p>${text}</p></div></div>
    <div class="result-grid">${matchStatTiles(stats, { extra: [statTile(formatClock(seconds), "Operation time", "time")] })}</div>
    <div class="result-actions"><button class="primary" data-new-game>New game / choose map ${arrow}</button><button class="secondary" data-restart>Replay this map</button>${sub || ""}</div>
  </div>`;
}
