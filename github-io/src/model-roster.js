import balance from './balance.json' with {type:'json'};
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
  for (const entity of match.entities || []) if (entity.kind !== 'wall' && balance.definitions[entity.type]?.role !== 'Research') types.add(entity.type);
  return [...types];
}
