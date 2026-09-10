import './selection-status.css';
import {buildingActivity} from './activity.js';

const number = value => value >= 10000 ? `${(value / 1000).toFixed(value < 100000 ? 1 : 0)}k` : `${Math.ceil(value)}`;
const metric = (label, value, description) => `<div title="${description}"><dt>${label}</dt><dd>${value}</dd></div>`;
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
  return `<div class="entity-details"><div class="selection-heading"><h3 title="${group ? name : e.description}">${name}</h3>${e.kind==='building'&&!group?`<span class="selection-level">L${e.level}</span>`:''}</div>
    <dl class="unit-metrics" aria-label="Selected object stats">
    ${metric('HP',`${number(hp)}/${number(maxHp)}`,`Health ${Math.ceil(hp)} of ${maxHp}`)}
    ${metric('Shield',`${number(shield)}/${number(maxShield)}`,`Shield ${Math.ceil(shield)} of ${maxShield}`)}
    ${metric(group?'ATK*':'ATK',attack,group?'Attack of first selected unit. Open Info & stats for unit details.':'Attack damage per hit')}
    ${e.support&&!group?metric('Restore',`${e.support}/s`,'Health restored per second'):''}</dl>
    <div class="selection-activity" title="${status}">${status}</div></div>`;
}
