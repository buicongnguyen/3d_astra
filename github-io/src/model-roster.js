import balance from './balance.json' with {type:'json'};
import GARRISONS from './defence/garrisons.json' with {type:'json'};
// Boot stays fixed as factions grow: only a match asks for additional models.
export const CORE_MODEL_TYPES = Object.freeze(['hq','relay','barracks','foundry','tower','worker','vanguard','ranger','breaker','tank','antitank','medic','engineer']);
export function modelsForMatch(match = {}, factions = balance.factions || {}) {
  const types = new Set(CORE_MODEL_TYPES);
  const ids = Object.values(match.factions || (match.missionDef?.rules?.rosters ? match.missionDef.factions : {}) || {});
  for (const id of ids) {
    const faction = factions[id];
    for (const type of Object.values(faction?.swap || {})) types.add(type);
    if (faction?.building) types.add(faction.building);
  }
  // Everything the mission script can put on the field later: spawns, waves and unlocks, resolved for each roster in play.
  const def = match.missionDef, named = new Set(def?.rules?.unlock || []);
  const scan = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.spawn === 'string') named.add(o.spawn);
    if (o.wave?.units) for (const type of Object.keys(o.wave.units)) named.add(type);
    if (Array.isArray(o.unlock)) for (const type of o.unlock) named.add(type);
    for (const v of Array.isArray(o) ? o : Object.values(o)) scan(v);
  };
  if (def) { scan(def.setup); scan(def.triggers); }
  // Frontier Defence: every wave group and every crew the pads can take (sim/defence.js).
  for (const w of def?.defence?.waves || []) for (const g of w.groups) for (const type of Object.keys(g.units)) named.add(type);
  for (const crew of def?.defence?.crews || []) { const g = GARRISONS.crews[crew]; if (g) named.add(g.type || g.slot); }
  for (const type of named) {
    if (balance.definitions[type]?.kind) types.add(type);
    for (const id of ids) { const swapped = factions[id]?.swap?.[type]; if (swapped) types.add(swapped); }
  }
  for (const entity of match.entities || []) if (entity.kind !== 'wall' && balance.definitions[entity.type]?.role !== 'Research') types.add(entity.type);
  return [...types];
}
