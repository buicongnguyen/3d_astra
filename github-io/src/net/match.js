// W11 LAN play: the battle a host sets up, turned into the Simulation options every page builds the match
// from (the host sends the options themselves, so every page builds exactly the same match).
//   duel  1v1: the host (team 0) against the guest (team 1), no computer side.
//   coop  two people (teams 0 and 1, allies) against one or two computer allies (teams 2 and 3).
import { isPlayerFaction } from "../factions.js";
import { AI_SPEEDS } from "../ai-plan.js";

export const LAN_MODES = ["duel", "coop"];
export const DEFAULT_SETUP = Object.freeze({ mode: "duel", map: "riverlands", factions: ["meridian", "ashfall"], aiFaction: "sunward", aiCount: 1, aiSpeed: "normal" });

// A setup from the lobby (or a message), checked: unknown values fall back to the defaults.
export function cleanSetup(setup = {}, maps = null) {
  const d = DEFAULT_SETUP;
  const mode = LAN_MODES.includes(setup.mode) ? setup.mode : d.mode;
  const map = typeof setup.map === "string" && (!maps || Object.hasOwn(maps, setup.map)) ? setup.map : d.map;
  const f = Array.isArray(setup.factions) ? setup.factions : [];
  const factions = [0, 1].map((i) => (isPlayerFaction(f[i]) ? f[i] : d.factions[i]));
  const aiFaction = isPlayerFaction(setup.aiFaction) ? setup.aiFaction : d.aiFaction;
  const aiCount = setup.aiCount === 2 ? 2 : 1;
  const aiSpeed = Object.hasOwn(AI_SPEEDS, setup.aiSpeed) ? setup.aiSpeed : d.aiSpeed;
  return { mode, map, factions, aiFaction, aiCount, aiSpeed };
}

// The Simulation options of a setup. Capture points are on, as in every skirmish; no other battle rules.
export function lanOptions(setup) {
  const s = cleanSetup(setup);
  const enemyCount = s.mode === "duel" ? 1 : 1 + s.aiCount;
  const factions = { 0: s.factions[0], 1: s.factions[1] };
  for (let team = 2; team <= enemyCount; team++) factions[team] = s.aiFaction;
  const sides = s.mode === "duel" ? [0, 1] : [0, 0, ...Array.from({ length: s.aiCount }, () => 1)];
  return { map: s.map, enemyCount, aiSpeed: s.aiSpeed, alliance: "ffa", factions, capturePoints: true, lan: { humans: [0, 1], sides } };
}

// The two people's seats are teams 0 and 1 in both modes.
export const LAN_SEATS = [0, 1];
