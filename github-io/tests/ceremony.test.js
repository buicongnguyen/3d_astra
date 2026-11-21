// R3-V: the victory ceremony's pure parts (MVP credit, MVP card, the loss tip, the count-up and the
// onMatchEnd listener list). The browser side is tests/ceremony.mjs (CI matrix entry r3-v).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { createMatchStats } from '../src/match-stats.js';
import { translate } from '../src/i18n.js';
// ceremony.js adds the DOM side and its stylesheet; its pure parts live in ceremony-rules.js.
import { mvpCardHTML, lossTip, countFrames, countText, onMatchEnd, emitMatchEnd, matchEndListenerCount, portraitTypeOf, closeness, fallbackMvp } from '../src/ceremony-rules.js';

const has = (type) => ['ranger', 'antitank', 'tower', 'medic', 'vanguard'].includes(type);
const art = (m) => `<i class="portrait-art" data-type="${portraitTypeOf(m, has)}"></i>`;

const tickWith = (sim, stats) => { stats.before(sim); sim.tick(0.05); stats.after(sim); };

test('MVP credit: damage goes to the player unit that landed it, healing to the healer, and the hash never moves', () => {
  const a = new Simulation({ enemyCount: 1 }), b = new Simulation({ enemyCount: 1 });
  const stats = createMatchStats();
  const ranger = a.own(0).find((e) => e.kind === 'unit' && e.type !== 'worker' && e.damage > 0);
  const foe = a.entities.find((e) => e.team === 1 && e.kind === 'unit' && e.type !== 'worker');
  assert.ok(ranger && foe, 'a player fighter and an enemy unit exist');
  // A hit landed through the simulation's own damage path, from inside a tick.
  const tick = a.tick.bind(a);
  let hit = false;
  a.tick = (dt) => { tick(dt); if (!hit) { hit = true; a.applyDamage(foe, 30, 0, ranger.id); } };
  tickWith(a, stats);
  a.tick = tick;
  const mvp = stats.mvp();
  assert.equal(mvp?.id, ranger.id);
  assert.ok(mvp.damage >= 30 - 1e-9 && mvp.damage <= 30 + 1e-9, `credited ${mvp.damage}`);
  assert.equal(stats.stats.killed, 0);
  // Counting changes nothing: the same match run without the tracker hashes the same.
  b.tick(0.05); b.applyDamage(b.get(foe.id), 30, 0, ranger.id);
  for (let i = 0; i < 300; i++) { tickWith(a, stats); b.tick(0.05); }
  assert.equal(a.hash(), b.hash());
  stats.reset();
  assert.equal(stats.mvp(), null);
  assert.equal(stats.lastKill, null);
});

test('MVP card: name, portrait and the figures; a tower shows its crew; nothing without an MVP', () => {
  const html = mvpCardHTML({ id: 4, type: 'ranger', name: 'Ranger', kind: 'unit', damage: 1240.4, healing: 0, kills: 3 }, art);
  assert.match(html, /class="mvp-card"/);
  assert.match(html, /class="mvp-name">Ranger</);
  assert.match(html, /portrait-art" data-type="ranger"/);
  assert.match(html, /<b>1240<\/b> <span>damage<\/span>/);
  assert.match(html, /<b>3<\/b> <span>kills<\/span>/);
  assert.doesNotMatch(html, /healing/);
  assert.equal(portraitTypeOf({ type: 'tower', kind: 'building', crewType: 'antitank' }, has), 'antitank');
  assert.equal(portraitTypeOf({ type: 'mystery', kind: 'building' }, has), 'tower');
  assert.match(mvpCardHTML({ id: 1, type: 'medic', name: 'Medic', kind: 'unit', damage: 0, healing: 80, kills: 0 }), /<b>80<\/b> <span>healing/);
  assert.match(mvpCardHTML({ id: 1, type: 'vanguard', name: 'Vanguard', kind: 'unit', damage: 0, healing: 0, kills: 0 }), /Held the line/);
  assert.equal(mvpCardHTML(null), '');
  const sim = new Simulation({ enemyCount: 1 });
  const stand = fallbackMvp(sim);
  assert.ok(stand && stand.fallback && sim.get(stand.id).team === 0, 'a quiet win still names one of the player units');
});

test('loss tip: one concrete tip from the counters, in order, and every word has Vietnamese', () => {
  const cases = [
    [{ alloy: 300, energy: 0, trained: 20, lost: 2, killed: 2 }, 600, 'economy', /^You gathered 300 resources in 10 minutes\.$/],
    [{ alloy: 4000, energy: 900, trained: 3, lost: 2, killed: 2 }, 600, 'army', /^You trained 3 units\.$/],
    [{ alloy: 4000, energy: 900, trained: 30, lost: 12, killed: 5 }, 600, 'trades', /^You lost 12 units and defeated 5\.$/],
    [{ alloy: 4000, energy: 900, trained: 30, lost: 6, killed: 9, structuresLost: 4 }, 600, 'base', /^You lost 4 buildings\.$/],
    [{ alloy: 4000, energy: 900, trained: 30, lost: 6, killed: 9 }, 600, 'upgrades', /^The fight was close\.$/],
    [{ alloy: 10, trained: 0, lost: 0, killed: 0 }, 60, 'upgrades', /close/],
  ];
  for (const [stats, seconds, id, fact] of cases) {
    const tip = lossTip(stats, { seconds });
    assert.equal(tip.id, id, JSON.stringify(stats));
    assert.match(tip.fact, fact);
    for (const text of [tip.fact, tip.advice]) assert.notEqual(translate(text, 'vi'), text, text);
  }
  for (const text of ['So close.', 'Tip', 'damage', 'healing', 'kills', 'kill', 'Held the line', 'You held 4 of 10 waves.', 'You completed 1 of 3 objectives.', 'The enemy core was down to 34% health.', 'You trained 1 unit.', 'You gathered 90 resources in 1 minute.'])
    assert.notEqual(translate(text, 'vi'), text, text);
  // How close it was: an enemy core below full health is named in percent.
  const sim = new Simulation({ enemyCount: 1 });
  const core = sim.entities.find((e) => e.team === 1 && e.type === 'hq');
  assert.equal(closeness(sim), null, 'a full-health core says nothing');
  core.hp = core.maxHp * 0.34;
  assert.equal(closeness(sim), 'The enemy core was down to 34% health.');
});

test('count-up frames and the onMatchEnd listener list', () => {
  assert.deepEqual(countFrames('12'), { kind: 'int', to: 12 });
  assert.deepEqual(countFrames('3:41'), { kind: 'clock', to: 221 });
  assert.equal(countFrames('—'), null);
  assert.equal(countFrames('4/10'), null);
  assert.equal(countText({ kind: 'clock', to: 221 }, 0.5), '1:51');
  assert.equal(countText({ kind: 'int', to: 9 }, 1), '9');
  const heard = [];
  const before = matchEndListenerCount();
  const off = onMatchEnd((s) => heard.push(s.result));
  onMatchEnd(() => { throw new Error('a broken listener does not stop the others'); });
  const offLate = onMatchEnd((s) => heard.push(`late:${s.mode}`));
  const quiet = console.error; console.error = () => {};
  try { emitMatchEnd({ result: 'victory', mode: 'skirmish' }); } finally { console.error = quiet; }
  assert.deepEqual(heard, ['victory', 'late:skirmish']);
  assert.equal(off(), true);
  offLate();
  assert.equal(matchEndListenerCount(), before + 1, 'only the throwing listener is left');
  assert.equal(typeof onMatchEnd(null), 'function', 'a non-function is ignored');
});
