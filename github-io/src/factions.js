import balance from './balance.json' with {type:'json'};
import {BUILDINGS,DEFINITIONS as D} from './data.js';
export const FACTION_RULES = balance.factions;
export const BASE_UNIT_SLOTS = Object.freeze(['worker','vanguard','ranger','breaker','tank','antitank','medic','engineer']);
export const CLASS_LABELS = {worker:'workers',melee:'melee infantry',ranged:'ranged infantry',siege:'siege units',armor:'armored units',antiarmor:'antiarmor infantry',support:'support units'};
export function normalizedFactions(explicit,mission,count) {
  const source={...(mission?.rules?.rosters ? mission.factions : {}),...explicit};
  return Object.fromEntries(Array.from({length:count+1},(_,team)=>[team,Object.hasOwn(FACTION_RULES,source[team])?source[team]:'meridian']));
}
export const factionRules = {
  factionFor(team) { return FACTION_RULES[this.factions[team]] || FACTION_RULES.meridian; },
  typeFor(team,slot) { return this.factionFor(team).swap[slot] || slot; },
  slotOf(type) {
    for(const faction of Object.values(FACTION_RULES)) for(const [slot,actual] of Object.entries(faction.swap)) if(actual===type) return slot;
    return type;
  },
  unitRoster(team) { return BASE_UNIT_SLOTS.filter(slot=>!this.factionFor(team).exclude?.includes(slot)).map(slot=>this.typeFor(team,slot)); },
  buildable(team=0) { const extra=this.factionFor(team).building;return extra?[...BUILDINGS,extra]:BUILDINGS; },
  canTrain(team,type) { return D[type]?.role==='Research' || this.unitRoster(team).includes(type); },
  resolvedTrains(team,trains) {
    if(!trains) return trains;
    const mapped=trains.map(slot=>this.typeFor(team,slot)).filter(type=>this.canTrain(team,type));
    return mapped.length===trains.length&&mapped.every((type,i)=>type===trains[i])?trains:mapped;
  },
};
