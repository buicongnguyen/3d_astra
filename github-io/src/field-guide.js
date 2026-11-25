import { AIR, CLASS_LABELS, HOST_FACTION, HOST_OF, workshopUnitsOf } from './factions.js';
import { DEFINITIONS as D } from './data.js';
import './progression.css';
import { MAPS, TERRAIN } from './terrain.js';
import { portrait } from './portraits.js';
import balance from './balance.json' with { type: 'json' };

const DRILL = balance.outrider_drill; // the Rider's page explains the Expanded-roster drill (src/sim/content/outrider.js)
const WILD = balance.wild_frontier; // the Wild frontier creatures' pages (round 4, src/sim/content/wild-frontier.js)

// Wild frontier (AAA round 4, P1), from the live balance numbers: the Spire and the nest, on every creature page.
export const WILD_GUIDE = `<h3>Wild frontier</h3><p>A Battle rule for the dry lands: Amber Dunes, Dry Reach, Golden Heart and Copper Basin. Hold the Weather Spire near the centre to call a Sandstorm with the one Sandstorm button: after a ${WILD.spire.warn} s warning that every side sees, enemies inside fire 30% slower and see only ${WILD.sandstorm.sight} m for ${WILD.sandstorm.duration} s, and your units inside are hidden from them. It recharges in ${WILD.spire.cooldown} s; a new holder waits ${WILD.spire.arm} s.</p><p>Clear the ${WILD.nest.guards} Wyrmlings at the nest, then keep only your units in it for ${WILD.nest.tame} s to tame a Dune Wyrm (at most ${WILD.nest.cap} per side). The nest regrows its guards ${WILD.nest.regrow} s later. Relaxed rivals never use the Spire or the nest; Normal rivals only late in a match.</p>`;

// Campaign creatures (creature round, src/sim/content/campaign-creatures.js), from the live balance numbers.
const DEN = balance.campaign_creatures.den, GUARDIAN = balance.campaign_creatures.guardian;
export const CAMPAIGN_GUIDE = {
  acidhound: `<h3>Campaign creature</h3><p>Acid Hounds lair in dens off the main roads of some missions. A pack bites anything within ${DEN.aggro} m of its den and never leaves it. Clearing a den is always optional, and some dens hide salvage.</p>`,
  vaultsentinel: `<h3>Builder guardian</h3><p>It sleeps until you order an attack on it, then fights within ${GUARDIAN.leash} m of its post. At ${GUARDIAN.kneel.standard}% health (${GUARDIAN.kneel.veteran}% on Veteran) it kneels, and a few seconds later it joins your squad for the rest of the mission. The test is optional.</p>`,
};
const CAMPAIGN_WYRM = `<p>In the campaign, Dune Wyrm nests wait off the roads in Three-Way Dunes and A Debt in the Dunes. Clear the Wyrmlings, then keep your troops in the nest for ${DEN.tame} s. Taming one is always optional.</p>`;
// Plateaus (Stage 3), from the live balance numbers (balance.json "terrain").
export const HIGH_GROUND_GUIDE = `Plateaus are raised rock reached by ramps. A unit or tower on top gets +${TERRAIN.high_range} m range, +${Math.round((TERRAIN.high_damage - 1) * 100)}% damage and +${TERRAIN.high_vision} m sight against targets below; shooting up at it does ${Math.round((1 - TERRAIN.low_damage) * 100)}% less damage. A gold ▲ marks units on high ground, and units deep on a plateau stay hidden from below until you climb it.`;

// Flyers (0.18, src/sim/air.js), from the live balance numbers (balance.json "air").
export const AIR_GUIDE = `<p>Flyer: it flies straight over water, walls and cliffs, and passes over ground units. Only Rangers, Anti-tank soldiers and other units that hit air can shoot it; Sentinel towers can after the Anti-air guns research at the Command core (×${AIR.flak_bonus} damage to flyers). Splash, Barrage and burning ground never reach it. It sees plateau tops from low ground and opens a plateau it flies over to your whole side. It cannot take capture points. You field at most ${(AIR.cap_by_level || [AIR.cap])[0]} flyers at a level 1 Command core, ${AIR.cap_by_level?.[1] ?? AIR.cap} at level 2 and ${AIR.cap_by_level?.[2] ?? AIR.cap} at level 3, counting those in production; computer opponents field at most ${AIR.cap}.</p>`;

// Your price and training time (balance.json player_cost / player_time, the Kite): the guide is read by the
// person, so without a match it shows the player price; in a match, the price for `team`.
const priceOf = (sim, team, type) => sim?.trainCost ? sim.trainCost(team, type) : D[type].player_cost ?? D[type].cost;
const timeOf = (sim, team, type) => sim?.trainTime ? sim.trainTime(team, type) : D[type].player_time ?? D[type].time;
export function entryHTML(type, sim = null, team = 0) {
  const base = D[type], d = sim && base.trains ? {...base,trains:sim.resolvedTrains(team,base.trains)} : base;
  const cost = priceOf(sim, team, type), price = (k) => { const c = priceOf(sim, team, k); return `${c[0]} alloy / ${c[1]} energy`; };
  return `<div class="guide-hero">${portrait(type)}<h2>${d.name}</h2></div><p>${d.description}</p>
    <h3>Base stats · level 1</h3><dl><dt>HP / shield</dt><dd>${d.player_hp ?? d.hp} / ${d.player_shield ?? d.shield}</dd>
    <dt>Attack</dt><dd>${d.damage || 0}${d.damage ? ` per hit · every ${d.interval}s · range ${d.range}` : ' · cannot attack'}</dd>
    <dt>Cost</dt><dd>${cost[0]} alloy / ${cost[1]} energy</dd><dt>Time</dt><dd>${timeOf(sim, team, type)}s</dd>
    ${d.pop ? `<dt>Supply / speed</dt><dd>${d.pop} / ${d.speed}</dd>` : ''}</dl>
    <p>Shields absorb damage before HP. They recharge at 4/s after five seconds without damage.</p>
    ${d.kind==='building'||d.mechanical?'<p>Below 35% HP, completed buildings and vehicles show fire and smoke. Repairs clear it. This is a damage warning, not extra damage over time.</p>':''}
    ${type === 'worker' ? '<p>Harvesters gather up to 10 resources, deliver them to a completed friendly Command core, then resume gathering. When a deposit runs out, they deliver any remaining cargo and switch to a reachable explored deposit of the same type within 30 world units. Queued orders take priority. If no replacement or completed core is available, a message explains what to do; carried resources are preserved.</p>' : ''}
    ${d.kind === 'unit' && d.damage && type !== 'worker' ? '<p>Automatically attacks visible enemies in weapon range with a clear line of fire when idle or using Attack-move. Move orders override combat so you can retreat or kite; units do not stop to fire until they arrive or receive another combat order. Attack-move pursues nearby enemies and resumes its route afterward. A direct attack order keeps its chosen target. A normal Move command cancels the current attack; queued Move commands wait their turn. Moving never resets the weapon cooldown.</p>' : ''}
    ${d.mechanical_bonus ? `<p>Deals ${d.mechanical_bonus}× damage to mechanical units: ${d.damage*d.mechanical_bonus} per hit before weapon research.</p>` : ''}
    ${d.counter ? `<p>Deals ${d.counter_bonus || 1.6}× damage to ${CLASS_LABELS[d.counter]}.</p>` : ''}
    ${d.splash_radius ? `<p>Splash: enemies within ${d.splash_radius} m of the target take ${Math.round(d.splash_damage*100)}% damage.</p>` : ''}
    ${d.support ? `<p>Restores ${d.support} HP each second within range ${d.range}. Requires a clear line. No resource cost. Does not refill shields, heal itself, finish construction or revive casualties.</p><p>Use <strong>Support → friendly target</strong> to follow an ally. Idle helpers automatically assist injured allies in range.</p>` : ''}
    ${d.facing ? `<h3>Facing armour</h3><p>Shots from the front do ${d.facing.front}× damage and shots from behind ${d.facing.rear}×; shots from the side do full damage. Flank it.</p>` : ''}
    ${DRILL.types.includes(type) && sim?.ruleOn?.('roster') === 'expanded' ? `<h3>Expanded roster: Outrider drill</h3><p>When a melee or flame unit comes within ${DRILL.near} m, the Rider steps back ${DRILL.back} m and keeps shooting, at most once every ${DRILL.every} s. It never steps on Hold.</p>` : ''}
    ${d.ward ? `<h3>Ward plate</h3><p>Your other units within ${d.ward.radius} m of it take ${Math.round((1 - d.ward.taken) * 100)}% less damage. Wards do not stack.</p>` : ''}
    ${d.creature ? (CAMPAIGN_GUIDE[type] || WILD_GUIDE) : ''}${type === 'wyrm' ? CAMPAIGN_WYRM : ''}
    ${d.flying ? AIR_GUIDE : ''}
    ${d.hits_air && !d.flying ? '<p>Hits air: it can shoot flyers.</p>' : ''}
    ${d.required_level && !d.workshop ? `<p>Requires level ${d.required_level} ${d.flying ? 'Command core' : ['medic','antitank'].includes(sim?.slotOf(type) || type) ? 'Barracks' : 'Foundry'}.</p>` : ''}
    ${d.workshop && D[HOST_OF[d.workshop]] ? `<p>Expanded roster: trained at the ${D[HOST_OF[d.workshop]].name}, level ${d.required_level || 1}.</p>` : ''}
    ${d.kind === 'building' && workshopUnitsOf(HOST_FACTION[type]).length ? `<h3>Expanded roster</h3><ul>${workshopUnitsOf(HOST_FACTION[type]).map(k => `<li>${D[k].name}${D[k].required_level ? ` · level ${D[k].required_level}` : ''}: ${price(k)}</li>`).join('')}</ul>` : ''}
    ${d.kind === 'building' ? `<h3>Building functions</h3><ul>${(d.trains || []).map(k => `<li>${D[k].name}${D[k].required_level ? ` · level ${D[k].required_level}` : ''}: ${price(k)}</li>`).join('')}${d.supply ? `<li>Provides ${d.supply} supply at level 1.</li>` : ''}${type === 'tower' ? '<li>Automatically attacks visible enemies.</li>' : ''}</ul>
    <h3>Building upgrades</h3><p>L2: +25% base HP, +25 shield, 1.2× production rate.<br>L3: +50% base HP, +50 shield, 1.4× production rate, total.</p><p>Towers gain 50% / 100% base attack and 1 / 2 m range; Relays gain 5 / 10 supply. Supply is capped at 100.</p>
    <p>Command core: L2 costs 200/100; L3 costs 350/175 alloy/energy.<br>Sentinel tower: L2 costs 75/25; L3 costs 150/50.<br>Other buildings: L2 costs 100/50; L3 costs 200/100.<br>Upgrade time: 20s / 30s.</p><p>Other buildings require a completed Command core at the next level. Finish or cancel production first. Cancel an upgrade for a full refund; destruction gives no refund.</p>` : ''}
    <h3>High ground</h3><p>${HIGH_GROUND_GUIDE}</p>
    <h3>Three technology stages</h3><ol><li>Establish an economy and mixed army.</li><li>Upgrade your core and production to L2; unlock Medics, Engineers and Anti-tank soldiers.</li><li>Reach L3 to unlock Battle tanks at the Foundry, with stronger defenses and faster production, then defeat enemy cores.</li></ol><p>These stages occur within any of the ${Object.keys(MAPS).length} skirmish maps; they are not separate campaign missions. Select 1-3 AI enemies in the briefing. Multiple enemies fight free-for-all. A faction loses all remaining forces and production when its last Command core is destroyed.</p>`;
}

// Expanded-only definitions (roster: "expanded") are listed only while the Roster rule is Expanded (AAA round 2, integration).
const guideOptions = (expanded) => Object.keys(D).filter(k => D[k].kind && !D[k].boss && (expanded || D[k].roster !== "expanded")).map(k => `<option value="${k}">${D[k].name}</option>`).join("");

export function createFieldGuide(onOpen,onClose,getSim = () => null) {
  const dialog = document.createElement('dialog');
  dialog.className = 'field-guide';
  dialog.setAttribute('aria-labelledby','guide-title');
  dialog.innerHTML = `<header><h2 id="guide-title">Field guide · units and buildings</h2><label for="guide-entry">Unit or building</label><select id="guide-entry">${guideOptions(false)}</select></header><article id="guide-detail"></article><footer><button id="guide-close">Close field guide</button></footer>`;
  document.body.append(dialog);
  let team = 0;
  const pick = dialog.querySelector('select');
  const render = () => { dialog.querySelector('article').innerHTML = entryHTML(pick.value,getSim(),team); dialog.querySelector('article').scrollTop = 0; };
  pick.onchange = render;
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('close',onClose);
  return (type,side = 0) => { if (dialog.open) return; team = side; pick.innerHTML = guideOptions(getSim()?.ruleOn?.("roster") === "expanded"); pick.value = D[type]?.kind && !D[type].boss ? type : 'hq'; /* bosses are not trained: no entry (docs/aaa/BOSSES.md) */ render(); onOpen(); dialog.showModal(); };
}
