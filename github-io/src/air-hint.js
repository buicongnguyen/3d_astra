// The anti-air hint (0.18.3): the first enemy flyer the player can see while nothing of theirs can
// shoot it (no unit that hits air and no Flak; in Defence, no crew that hits air) says what can.
// app/ui-extras.js shows it once per match in the fight-hint slot. Pure: the simulation is passed
// in, so node:test covers it. Every text has an entry in src/locales/vi.json.
export const AIR_HINT_UNITS = "Flyers overhead! Towers cannot hit them yet. Train Rangers or Anti-tank soldiers, or research Flak at the Command core.";
export const AIR_HINT_CREWS = "Flyers on the road! Breaker crews cannot hit them. Ranger and Anti-tank crews can.";
export const AIR_HINT_CREWS_WATCHER = "Flyers on the road! Breaker crews cannot hit them. Ranger, Anti-tank and Watcher crews can.";

export function airHintText(sim, team = 0) {
  if (!sim.entities.some((e) => e.flying && e.hp > 0 && sim.hostile(team, e.team) && sim.isVisible(e, team))) return null;
  if (sim.players[team]?.flak || sim.entities.some((e) => e.team === team && e.hp > 0 && e.hits_air)) return null;
  if (sim.defence) return sim.defenceDef()?.crews?.includes("watcher") ? AIR_HINT_CREWS_WATCHER : AIR_HINT_CREWS;
  return AIR_HINT_UNITS;
}
