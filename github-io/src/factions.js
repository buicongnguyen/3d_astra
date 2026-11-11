import balance from './balance.json' with {type:'json'};
import {BUILDINGS,DEFINITIONS as D} from './data.js';
export const FACTION_RULES = balance.factions;
const SLOT_BY_TYPE = Object.fromEntries(Object.values(FACTION_RULES).flatMap(faction => Object.entries(faction.swap).map(([slot,type]) => [type,slot])));
export const BASE_UNIT_SLOTS = Object.freeze(['worker','vanguard','ranger','breaker','tank','antitank','medic','engineer']);
export const CLASS_LABELS = {worker:'workers',melee:'melee infantry',ranged:'ranged infantry',siege:'siege units',armor:'armored units',antiarmor:'antiarmor infantry',support:'support units'};
export function normalizedFactions(explicit,mission,count) {
  const source={...(mission?.rules?.rosters ? mission.factions : {}),...explicit};
  return Object.fromEntries(Array.from({length:count+1},(_,team)=>[team,Object.hasOwn(FACTION_RULES,source[team])?source[team]:'meridian']));
}
// Skirmish "Enemy faction": Mirror keeps every rival on the Meridian roster; Mixed gives each rival a
// different faction, starting from one picked by the map so maps differ (no random numbers).
export const ENEMY_FACTIONS = {mirror:'Mirror',ashfall:'Ashfall Combine',sunward:'Sunward Caravan',wardens:'The Wardens',veil:'Veil Survey',mixed:'Mixed'};
const ENEMY_ORDER = ['ashfall','sunward','wardens','veil'];
export function skirmishFactions(choice,enemyCount,mapId='') {
  if(!Object.hasOwn(ENEMY_FACTIONS,choice)||choice==='mirror') return null;
  const start=[...mapId].reduce((n,c)=>n+c.charCodeAt(0),0)%ENEMY_ORDER.length;
  return Object.fromEntries(Array.from({length:enemyCount},(_,i)=>[i+1,choice==='mixed'?ENEMY_ORDER[(start+i)%ENEMY_ORDER.length]:choice]));
}
// The setup choice that produced a match's factions (used when a save is loaded).
export function enemyFactionOf(sim) {
  const ids=[...new Set(Object.entries(sim.factions).filter(([team])=>team>0).map(([,id])=>id))];
  return ids.length>1?'mixed':ids[0]==='meridian'||!ids.length?'mirror':ids[0];
}
// What colours and emblems follow: the story mission, or the factions of a skirmish.
export const matchLook = (mission,sim) => mission || (sim && Object.values(sim.factions).some(id=>id!=='meridian') ? {factions:sim.factions} : null);
export const factionRules = {
  factionFor(team) { return FACTION_RULES[this.factions[team]] || FACTION_RULES.meridian; },
  typeFor(team,slot) { return this.factionFor(team).swap[slot] || slot; },
  slotOf(type) { return SLOT_BY_TYPE[type] || type; },
  unitRoster(team) { return [...BASE_UNIT_SLOTS.filter(slot=>!this.factionFor(team).exclude?.includes(slot)).map(slot=>this.typeFor(team,slot)),...(this.unlocks?.[team]||[])]; },
  buildable(team=0) { const extra=this.factionFor(team).building;return extra?[...BUILDINGS,extra]:BUILDINGS; },
  // A mission lends a team units from another roster (rules.unlock, or the `unlock` action). Saved with the match.
  unlockUnits(team,types) {
    const add=(types||[]).filter(type=>D[type]?.kind==='unit'&&!this.unitRoster(team).includes(type));
    if(!add.length) return false;
    (this.unlocks||={})[team]=[...(this.unlocks[team]||[]),...add];
    for(const b of this.own(team)) if(D[b.type]?.trains) b.trains=this.resolvedTrains(team,D[b.type].trains);
    return true;
  },
  canTrain(team,type) { return D[type]?.role==='Research' || this.unitRoster(team).includes(type); },
  resolvedTrains(team,trains) {
    if(!trains) return trains;
    const mapped=trains.map(slot=>this.typeFor(team,slot)).filter(type=>this.canTrain(team,type));
    // Story unlocks (another faction's unit lent to this team) join the building that trains their slot.
    for(const type of this.unlocks?.[team]||[]) if(trains.includes(this.slotOf(type))&&!mapped.includes(type)) mapped.push(type);
    return mapped.length===trains.length&&mapped.every((type,i)=>type===trains[i])?trains:mapped;
  },
};
