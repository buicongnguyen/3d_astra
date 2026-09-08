import { DEFINITIONS as D } from './data.js';
import './progression.css';

export function entryHTML(type) {
  const d = D[type];
  return `<h2>${d.name}</h2><p>${d.description}</p>
    <h3>Base stats · level 1</h3><dl><dt>HP / shield</dt><dd>${d.hp} / ${d.shield}</dd>
    <dt>Attack</dt><dd>${d.damage || 0}${d.damage ? ` per hit · every ${d.interval}s · range ${d.range}` : ' · cannot attack'}</dd>
    <dt>Cost</dt><dd>${d.cost[0]} alloy / ${d.cost[1]} energy</dd><dt>Time</dt><dd>${d.time}s</dd>
    ${d.pop ? `<dt>Supply / speed</dt><dd>${d.pop} / ${d.speed}</dd>` : ''}</dl>
    <p>Shields absorb damage before HP. They recharge at 4/s after five seconds without damage.</p>
    ${d.mechanical_bonus ? `<p>Deals ${d.mechanical_bonus}× damage to mechanical units: ${d.damage*d.mechanical_bonus} per hit before weapon research.</p>` : ''}
    ${d.counter ? `<p>Deals 1.6× damage to ${D[d.counter].name}s.</p>` : ''}
    ${d.support ? `<p>Restores ${d.support} HP each second within range ${d.range}. Requires a clear line. No resource cost. Does not refill shields, heal itself, finish construction or revive casualties.</p><p>Use <strong>Support → friendly target</strong> to follow an ally. Idle helpers automatically assist injured allies in range.</p>` : ''}
    ${d.required_level ? `<p>Requires level ${d.required_level} ${['medic','antitank'].includes(type) ? 'Barracks' : 'Foundry'}.</p>` : ''}
    ${d.kind === 'building' ? `<h3>Building functions</h3><ul>${(d.trains || []).map(k => `<li>${D[k].name}${D[k].required_level ? ` · level ${D[k].required_level}` : ''}: ${D[k].cost[0]} alloy / ${D[k].cost[1]} energy</li>`).join('')}${d.supply ? `<li>Provides ${d.supply} supply at level 1.</li>` : ''}${type === 'tower' ? '<li>Automatically attacks visible enemies.</li>' : ''}</ul>
    <h3>Building upgrades</h3><p>L2: +25% base HP, +25 shield, 1.2× production rate.<br>L3: +50% base HP, +50 shield, 1.4× production rate, total.</p><p>Towers gain 25% / 50% base attack; Relays gain 5 / 10 supply. Supply is capped at 100.</p>
    <p>Command core: L2 costs 200/100; L3 costs 350/175 alloy/energy.<br>Other buildings: L2 costs 100/50; L3 costs 200/100.<br>Upgrade time: 20s / 30s.</p><p>Other buildings require a completed Command core at the next level. Finish or cancel production first. Cancel an upgrade for a full refund; destruction gives no refund.</p>` : ''}
    <h3>Three technology stages</h3><ol><li>Establish an economy and mixed army.</li><li>Upgrade your core and production to L2; unlock Medics, Engineers and Anti-tank soldiers.</li><li>Reach L3 to unlock Battle tanks at the Foundry, with stronger defenses and faster production, then defeat enemy cores.</li></ol><p>These stages occur within any of the four skirmish stages; they are not separate campaign missions.</p>`;
}

export function createFieldGuide(onOpen,onClose) {
  const dialog = document.createElement('dialog');
  dialog.className = 'field-guide';
  dialog.setAttribute('aria-labelledby','guide-title');
  dialog.innerHTML = `<header><h2 id="guide-title">Field guide · 8 unit types</h2><label for="guide-entry">Unit or building</label><select id="guide-entry">${Object.keys(D).filter(k => D[k].kind).map(k => `<option value="${k}">${D[k].name}</option>`).join('')}</select></header><article id="guide-detail"></article><footer><button id="guide-close">Close field guide</button></footer>`;
  document.body.append(dialog);
  const pick = dialog.querySelector('select');
  const render = () => { dialog.querySelector('article').innerHTML = entryHTML(pick.value); dialog.querySelector('article').scrollTop = 0; };
  pick.onchange = render;
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('close',onClose);
  return type => { if (dialog.open) return; pick.value = D[type]?.kind ? type : 'hq'; render(); onOpen(); dialog.showModal(); };
}
