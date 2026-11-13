import balance from './balance.json' with {type:'json'};
import {BUILDINGS,DEFINITIONS as D} from './data.js';
export const FACTION_RULES = balance.factions;
const SLOT_BY_TYPE = Object.fromEntries(Object.values(FACTION_RULES).flatMap(faction => Object.entries(faction.swap).map(([slot,type]) => [type,slot])));
export const BASE_UNIT_SLOTS = Object.freeze(['worker','vanguard','ranger','breaker','tank','antitank','medic','engineer']);
export const CLASS_LABELS = {worker:'workers',melee:'melee infantry',ranged:'ranged infantry',siege:'siege units',armor:'armored units',antiarmor:'antiarmor infantry',support:'support units',air:'flyers'};
// Air (0.18): every side can train the Kite scout; a faction's own flyer is listed under `extra`
// (balance.json factions.<id>.extra = { building: [types] }) and joins that building's list.
// Story missions keep their rosters unless their rules say `air: true` (or unlock a flyer).
export const AIR = balance.air;
export const AIR_SLOTS = Object.freeze(['kite']);
export const extraUnits = (faction) => Object.values(faction?.extra || {}).flat();
const TRAINS_OF = new Map(Object.entries(D).filter(([,d]) => d.trains).map(([type,d]) => [d.trains,type]));
// Where each faction-only unit is trained (a story unlock of a Balloon goes to the Foundry).
const EXTRA_HOME = Object.fromEntries(Object.values(FACTION_RULES).flatMap(f => Object.entries(f.extra||{}).flatMap(([building,types]) => types.map(type => [type,building]))));
export function normalizedFactions(explicit,mission,count) {
  const source={...(mission?.rules?.rosters ? mission.factions : {}),...explicit};
  return Object.fromEntries(Array.from({length:count+1},(_,team)=>[team,Object.hasOwn(FACTION_RULES,source[team])?source[team]:'meridian']));
}
// Skirmish "Your faction": the army the player commands (team 0). Training and the campaign stay Meridian.
export const PLAYER_FACTIONS = {meridian:'Meridian Expedition',ashfall:'Ashfall Combine',sunward:'Sunward Caravan',wardens:'The Wardens',veil:'Veil Survey'};
export const isPlayerFaction = (id) => Object.hasOwn(PLAYER_FACTIONS,id);
// The player's side in a line of text: "Meridian holds the valley", "Wardens command is online".
const SIDE_NAMES = {ashfall:'Ashfall',sunward:'Sunward',wardens:'Wardens',veil:'Veil'};
export const openingLine = (id) => SIDE_NAMES[id] ? `${SIDE_NAMES[id]} command is online. Assign Harvesters to the amber alloy deposits.` : 'Meridian is online. Assign Harvesters to the amber alloy deposits.';
export const victoryLine = (id) => SIDE_NAMES[id] ? `Enemy command has been eliminated. ${SIDE_NAMES[id]} command holds the valley.` : 'Enemy command has been eliminated. Meridian holds the valley.';
// Skirmish "Enemy faction": Mirror gives every rival the player's own faction; Mixed gives each rival a
// different faction other than the player's, starting from one picked by the map so maps differ (no random numbers).
export const ENEMY_FACTIONS = {mirror:'Mirror',meridian:'Meridian Expedition',ashfall:'Ashfall Combine',sunward:'Sunward Caravan',wardens:'The Wardens',veil:'Veil Survey',mixed:'Mixed'};
const ENEMY_ORDER = ['ashfall','sunward','wardens','veil'];
// The rivals' factions ({1:id, 2:id, ...}), or null when every rival is Meridian (the match then saves as before).
export function skirmishFactions(choice,enemyCount,mapId='',player='meridian') {
  const own=isPlayerFaction(player)?player:'meridian';
  if(!Object.hasOwn(ENEMY_FACTIONS,choice)) choice='mirror';
  const order=own==='meridian'?ENEMY_ORDER:[...ENEMY_ORDER,'meridian'].filter(id=>id!==own);
  const start=[...mapId].reduce((n,c)=>n+c.charCodeAt(0),0)%order.length;
  const pick=(i)=>choice==='mixed'?order[(start+i)%order.length]:choice==='mirror'?own:choice;
  const rivals=Array.from({length:enemyCount},(_,i)=>[i+1,pick(i)]);
  return rivals.every(([,id])=>id==='meridian')?null:Object.fromEntries(rivals);
}
// Every side of a skirmish: the player's faction on team 0 and the rivals' choice.
export const skirmishSides = (player,choice,enemyCount,mapId='') => ({0:isPlayerFaction(player)?player:'meridian',...skirmishFactions(choice,enemyCount,mapId,player)});
// The setup choices that produced a match's factions (used when a save is loaded).
export const playerFactionOf = (sim) => isPlayerFaction(sim?.factions?.[0]) ? sim.factions[0] : 'meridian';
export function enemyFactionOf(sim) {
  const own=playerFactionOf(sim);
  const ids=[...new Set(Object.entries(sim.factions).filter(([team])=>team>0).map(([,id])=>id))];
  return ids.length>1?'mixed':!ids.length||ids[0]===own?'mirror':ids[0];
}
// What colours and emblems follow: the story mission, or the factions of a skirmish.
export const matchLook = (mission,sim) => mission || (sim && Object.values(sim.factions).some(id=>id!=='meridian') ? {factions:sim.factions} : null);
export const factionRules = {
  factionFor(team) { return FACTION_RULES[this.factions[team]] || FACTION_RULES.meridian; },
  typeFor(team,slot) { return this.factionFor(team).swap[slot] || slot; },
  slotOf(type) { return SLOT_BY_TYPE[type] || type; },
  unitRoster(team) { return [...BASE_UNIT_SLOTS.filter(slot=>!this.factionFor(team).exclude?.includes(slot)).map(slot=>this.typeFor(team,slot)),...(this.airAllowed() ? [...AIR_SLOTS,...extraUnits(this.factionFor(team))] : []),...(this.unlocks?.[team]||[])]; },
  airAllowed() { return !this.missionDef || !!this.missionDef.rules?.air; },
  buildable(team=0) { const extra=this.factionFor(team).building;return extra?[...BUILDINGS,extra]:BUILDINGS; },
  // A mission lends a team units from another roster (rules.unlock, or the `unlock` action). Saved with the match.
  unlockUnits(team,types) {
    const add=(types||[]).filter(type=>D[type]?.kind==='unit'&&!this.unitRoster(team).includes(type));
    if(!add.length) return false;
    (this.unlocks||={})[team]=[...(this.unlocks[team]||[]),...add];
    for(const b of this.own(team)) if(D[b.type]?.trains) b.trains=this.resolvedTrains(team,D[b.type].trains);
    return true;
  },
  canTrain(team,type) { return D[type]?.role==='Research' ? type!=='flak'||this.airAllowed() : this.unitRoster(team).includes(type); },
  resolvedTrains(team,trains) {
    if(!trains) return trains;
    const mapped=trains.map(slot=>this.typeFor(team,slot)).filter(type=>this.canTrain(team,type));
    // The faction's own flyer joins the building named in `extra` (the definition lists hold Meridian's).
    for(const type of this.airAllowed() ? this.factionFor(team).extra?.[TRAINS_OF.get(trains)]||[] : []) if(!mapped.includes(type)) mapped.push(type);
    // Story unlocks (another faction's unit lent to this team) join the building that trains their slot.
    for(const type of this.unlocks?.[team]||[]) if((trains.includes(this.slotOf(type))||EXTRA_HOME[type]===TRAINS_OF.get(trains))&&!mapped.includes(type)) mapped.push(type);
    return mapped.length===trains.length&&mapped.every((type,i)=>type===trains[i])?trains:mapped;
  },
};
