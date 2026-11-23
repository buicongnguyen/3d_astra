import balance from './balance.json' with {type:'json'};
import GARRISONS from './defence/garrisons.json' with {type:'json'};
// Every preview and match uses the core set, plus models for the factions taking part.
export const CORE_MODEL_TYPES = Object.freeze(['hq','relay','barracks','foundry','tower','worker','vanguard','ranger','breaker','tank','antitank','medic','engineer']);
function declaredModels(match, factions) {
  const types = new Set(CORE_MODEL_TYPES);
  const ids = Object.values(match.factions || (match.missionDef?.rules?.rosters ? match.missionDef.factions : {}) || {});
  for (const id of ids) {
    const faction = factions[id];
    for (const type of Object.values(faction?.swap || {})) types.add(type);
    if (faction?.building) types.add(faction.building);
  }
  // Expanded roster (AAA round 2, W1-A): the host building and the workshop units of every faction in play,
  // read from the `workshop` field (balance.json "workshops"), so a new workshop unit needs no edit here.
  // A match that names no faction plays Meridian.
  if (match.rules?.roster === 'expanded' || match.missionDef?.rules?.roster === 'expanded') {
    for (const id of ids.length ? ids : ['meridian']) {
      const host = balance.workshops?.hosts?.[id];
      if (host) types.add(host);
      for (const [type, d] of Object.entries(balance.definitions)) if (d.kind === 'unit' && d.workshop === id) types.add(type);
    }
  }
  // Everything the mission script can put on the field later: spawns, waves and unlocks, resolved for each roster in play.
  const def = match.missionDef, named = new Set(def?.rules?.unlock || []);
  const scan = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.spawn === 'string') named.add(o.spawn);
    if (o.truck) { named.add('carrier'); for (const type of Object.keys(o.truck.units || {})) named.add(type); }
    if (o.wave?.units) for (const type of Object.keys(o.wave.units)) named.add(type);
    if (Array.isArray(o.unlock)) for (const type of o.unlock) named.add(type);
    for (const v of Array.isArray(o) ? o : Object.values(o)) scan(v);
  };
  if (def) { scan(def.setup); scan(def.triggers); }
  // Frontier Defence: every wave group and every crew the pads can take (sim/defence.js).
  // A group of a mixed wave names its own faction: its slots resolve through that roster (0.21).
  // A carrier group's passengers (`carry`, 0.22) likewise; Endless brings carriers every fifth wave.
  for (const w of def?.defence?.waves || []) for (const g of w.groups) for (const type of [...Object.keys(g.units), ...Object.keys(g.carry || {})]) { named.add(type); const swapped = factions[g.faction]?.swap?.[type]; if (swapped) types.add(swapped); }
  // Elite Splitters (AAA round 2, W2-B): the children are the group faction's vanguard slot, which may be named by no wave group.
  for (const w of def?.defence?.waves || []) for (const g of w.groups) if (g.mods?.elite === 'splitter') { named.add('vanguard'); const swapped = factions[g.faction]?.swap?.vanguard; if (swapped) types.add(swapped); }
  // A Heroic finale boss (round 3) and its drops.
  const fin = def?.defence?.heroic?.finale; if (fin) for (const type of Object.keys(fin.units || {})) { named.add(type); for (const drop of balance.bosses?.[type]?.drops || []) named.add(typeof drop === 'string' ? drop : drop.type); }
  if (def?.defence?.endless) named.add('carrier');
  for (const crew of def?.defence?.crews || []) { const g = GARRISONS.crews[crew]; if (g) named.add(g.type || g.slot); }
  // The commander and the Vanguards it calls in (0.21).
  if (def?.defence?.commander) { named.add(GARRISONS.commander.slot); named.add(GARRISONS.commander.reinforce.slot); }
  for (const type of named) {
    if (balance.definitions[type]?.kind) types.add(type);
    for (const id of ids) { const swapped = factions[id]?.swap?.[type]; if (swapped) types.add(swapped); }
  }
  for (const entity of match.entities || []) if (entity.kind !== 'wall' && balance.definitions[entity.type]?.role !== 'Research') types.add(entity.type);
  return [...types];
}
// A saved or scripted flyer has a built-in airframe until its full model arrives.
export function modelsForMatch(match = {}, factions = balance.factions || {}) {
  return declaredModels(match, factions).filter(type => !balance.definitions[type]?.flying);
}
// Stream scripted and saved flyers plus any that the active rosters can train.
export function airModelsFor(match = {}, factions = balance.factions || {}) {
  const flyers = declaredModels(match, factions).filter(type => balance.definitions[type]?.flying);
  if (!match.missionDef || match.missionDef.rules?.air) {
    for (const id of Object.values(match.factions || {})) {
      if (factions[id]) flyers.push('kite', ...Object.values(factions[id].extra || {}).flat());
    }
  }
  return [...new Set(flyers)];
}
