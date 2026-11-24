import { PRESETS, TEAM_PALETTES, palette } from "./settings.js";
import { FACTIONS } from "./story/world.js";

// Team colours for the match on screen. A skirmish uses the player's two chosen colours and
// the spare presets. A story mission names the faction behind each enemy team
// (`mission.factions`, see src/story/missions.js), and each takes its faction's colour from
// src/story/world.js: Ashfall coral, Sunward gold, Veil violet, Wardens blue. The player's own
// colour always wins a clash, and no two teams ever share a colour.
export const factionOf = (mission, team) => FACTIONS[mission?.factions?.[team]] || null;

// The player's own team wears its faction's colour when the player commands another faction (a Faction
// Chronicle, or a skirmish "Your faction") and has kept the default colour: Ashfall's base is coral, not
// Meridian mint. A colour the player picked in Settings always wins.
const ownFaction = (settings, mission) => {
  const faction = factionOf(mission, 0);
  return faction && faction.id !== "meridian" && (settings.playerColor || "mint") === "mint" && PRESETS[faction.color] ? faction : null;
};

export function teamColors(settings, mission = null) {
  const base = palette(settings);
  if (Object.hasOwn(TEAM_PALETTES, settings.teamPalette) || !mission?.factions) return base;
  const own = ownFaction(settings, mission), first = own ? PRESETS[own.color] : base[0];
  const out = [first, null, null, null], used = new Set([first]);
  for (let team = 1; team < out.length; team++) {
    const wanted = PRESETS[factionOf(mission, team)?.color];
    if (wanted && !used.has(wanted)) { out[team] = wanted; used.add(wanted); }
  }
  // Teams without a faction, or whose colour the player is wearing, take the next free one.
  const spare = [...base, ...Object.values(PRESETS)];
  for (let team = 1; team < out.length; team++) {
    if (out[team]) continue;
    out[team] = spare.find((color) => !used.has(color));
    used.add(out[team]);
  }
  return out;
}

// The light each team's machines give off: a faction's own glow in a mission (so Wardens
// read as cold machines and Ashfall as embers even if a colour had to change), else the
// team colour.
export function teamGlows(settings, mission = null) {
  if (Object.hasOwn(TEAM_PALETTES, settings.teamPalette)) return palette(settings);
  const own = ownFaction(settings, mission);
  return teamColors(settings, mission).map((color, team) => (team > 0 ? factionOf(mission, team)?.glow : own?.glow) || color);
}
