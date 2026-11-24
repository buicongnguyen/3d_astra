import balance from "./balance.json" with { type: "json" };

// Role glyphs (owner idea, 2026-11-24): on phones a unit's 22 px 3D portrait is unreadable, so train tiles, the
// selection roster and the production queue show a bold weapon / role symbol instead (glyphs in icons.js).
// Base roles name their own glyph; a faction unit takes the glyph of the role it replaces (balance.json
// factions[].swap), unless OWN gives it a clearer one. Upgrade tiles get their own symbols too, so no glyph
// means two things (Overcharged weapons was the energy bolt, Reinforced plating the Shield wall shield).
const BASE = {
  worker: "pick", vanguard: "knife", ranger: "rifle", antitank: "rocket", medic: "cross", engineer: "wrench",
  breaker: "shell", tank: "tankside",
};
const OWN = {
  gunner: "mg", stalker: "sniper", carrier: "carrier", rampart: "tankside",
  ironvanguard: "tankside", ironsovereign: "tankside", ironsovereign2: "tankside",
  kite: "kite", hawk: "gunship", balloon: "balloon", glider: "glider", wyrm: "wyrm", wyrmling: "wyrm", acidhound: "hound", vaultsentinel: "sentinel",
};
const UPGRADE = { upgrade: "dmgup", upgrade2: "dmgup", plating: "armor", plating2: "armor", flak: "flak" };

const swapped = {};
for (const faction of Object.values(balance.factions || {}))
  for (const [base, unit] of Object.entries(faction.swap || {})) if (BASE[base]) swapped[unit] ??= BASE[base];

export const ROLE_ICON = Object.freeze({ ...BASE, ...swapped, ...OWN, ...UPGRADE });
// Healers keep the red cross (on their own tiles only; elsewhere red means "can't afford").
export const HEALER_GLYPH = "cross";

// The glyph for a unit or upgrade type; buildings and anything unmapped fall back to their data icon.
export function roleIcon(type) {
  return ROLE_ICON[type] ?? balance.definitions[type]?.icon ?? type;
}
export const isHealerGlyph = (type) => roleIcon(type) === HEALER_GLYPH;
