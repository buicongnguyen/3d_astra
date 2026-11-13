import { FACTIONS } from './story/world.js';
import './selection-status.css';
import {buildingActivity} from './activity.js';
import {icon} from './icons.js';
import {portrait, hasPortrait} from './portraits.js';
import {rankBadge} from './tactics-ui.js';
import {AIR_HINT, AIR_SHORT, AIR_TEXT, FORD_SHORT, FORD_TEXT, HIDDEN_HINT, HIDDEN_TEXT, HIGH_GROUND_SHORT, HIGH_GROUND_TEXT, selectionGround} from './terrain-labels.js';

const number = value => value >= 10000 ? `${(value / 1000).toFixed(value < 100000 ? 1 : 0)}k` : `${Math.ceil(value)}`;
const ratio = (value, max) => max > 0 ? Math.max(0, Math.min(1, value / max)).toFixed(3) : 0;
// Optional bar: a 3 px live underline (health shades green -> amber -> red, shield cyan).
const metric = (label, value, description, bar) => `<div title="${description}"${bar ? ` class="${bar[0]}" style="--v:${bar[1]}"` : ''}><dt>${label}</dt><dd>${value}</dd></div>`;
export function selectionStatus(sim, entities) {
  const e = entities[0], group = entities.length > 1;
  const hp = entities.reduce((n,u)=>n+u.hp,0), maxHp = entities.reduce((n,u)=>n+u.maxHp,0);
  const shield = entities.reduce((n,u)=>n+u.shield,0), maxShield = entities.reduce((n,u)=>n+u.maxShield,0);
  const attack = Number(sim.attackValue(e).toFixed(1));
  let status = e.carry ? `Cargo ${e.carry}/10 ${e.carryType}` : entities.some(u=>u.attacking) ? 'Attacking' : e.orders[0]?.type || (e.kind === 'building' ? 'Operational' : 'Standing by');
  if (!e.complete) status = buildingActivity(sim,e)?.label==='Needs Harvester'?'Needs Harvester':'';
  else if (e.levelJob) status = '';
  else if (!group && e.queue.length) {
    const q=e.queue[0];
    status=q.blocked || '';
  }
  const name = group ? `${entities.length} units selected` : e.name;
  const side = entities.every(u=>u.team===0) ? 'friendly' : 'hostile';
  // On a plateau top the activity line says what high ground gives (the status moves to its tooltip).
  // Wading the ford, the line says it is slower and has no abilities (terrain-labels.js selectionGround).
  const {high, ford, hidden, air} = selectionGround(sim, entities);
  // Flyers: the line names their class, Air (the status moves to its tooltip).
  const activity = air
    ? `<div class="selection-activity in-air" title="${AIR_HINT}${status ? ` · ${status}` : ''}"><span class="hg-long">${AIR_TEXT}</span><span class="hg-short">${AIR_SHORT}</span></div>`
    : high
    ? `<div class="selection-activity high-ground" title="${HIGH_GROUND_TEXT}${status ? ` · ${status}` : ''}"><span aria-hidden="true">▲ </span><span class="hg-long">${HIGH_GROUND_TEXT}</span><span class="hg-short">${HIGH_GROUND_SHORT}</span></div>`
    : ford
      ? `<div class="selection-activity in-ford" title="${FORD_TEXT}${status ? ` · ${status}` : ''}"><span class="hg-long">${FORD_TEXT}</span><span class="hg-short">${FORD_SHORT}</span></div>`
      : `<div class="selection-activity" title="${status}">${status}</div>`;
  // The player's own units deep on a plateau get a second line, in the room an enemy card gives
  // its faction line (player cards have none), so the card never grows past an enemy's.
  const hiddenLine = hidden ? `<div class="selection-hidden" title="${HIDDEN_HINT}">${icon('hidden')}<span>${HIDDEN_TEXT}</span></div>` : '';
  return `<div class="entity-details"><div class="selection-heading"><span class="sel-portrait ${side}" aria-hidden="true">${!group && hasPortrait(e.type) ? portrait(e.type, side) : icon(group ? 'people' : e.icon || e.type)}</span><h3 title="${group ? name : e.description}">${name}</h3>${e.kind==='building'&&!group?`<span class="selection-level">L${e.level}</span>`:''}${!group&&e.kind==='unit'?rankBadge(e.rank):''}</div>
    ${!group && e.team > 0 ? `<p class="selection-faction">${FACTIONS[sim.missionDef?.factions?.[e.team] || sim.factions?.[e.team]]?.name || ""}</p>` : ""}
    <dl class="unit-metrics" aria-label="Selected object stats">
    ${metric('HP',`${number(hp)}/${number(maxHp)}`,`Health ${Math.ceil(hp)} of ${maxHp}`,['hp',ratio(hp,maxHp)])}
    ${metric('Shield',`${number(shield)}/${number(maxShield)}`,`Shield ${Math.ceil(shield)} of ${maxShield}`,['sh',ratio(shield,maxShield)])}
    ${metric(group?'ATK*':'ATK',attack,group?'Attack of first selected unit. Open Info & stats for unit details.':'Attack damage per hit')}
    ${e.support&&!group?metric('Restore',`${e.support}/s`,'Health restored per second'):''}</dl>
    ${activity}${hiddenLine}</div>`;
}
