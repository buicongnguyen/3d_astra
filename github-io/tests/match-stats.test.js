import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { createMatchStats } from '../src/match-stats.js';
import { skirmishResultHTML, formatClock } from '../src/results-ui.js';
import { translate } from '../src/i18n.js';

const tickWith = (sim, stats) => { stats.before(sim); sim.tick(0.05); stats.after(sim); };

test('the tracker counts deaths, trained units and delivered cargo from events', () => {
  const sim = new Simulation({ enemyCount: 1 });
  const stats = createMatchStats();
  stats.before(sim);
  sim.events.push(
    { type: 'death', team: 0, building: false }, { type: 'death', team: 1, building: false }, { type: 'death', team: 1, building: false },
    { type: 'death', team: 0, building: true }, { type: 'death', team: 1, building: true },
    { type: 'spawn', team: 0 }, { type: 'spawn', team: 1 }, { type: 'built', team: 0 },
  );
  stats.after(sim);
  assert.deepEqual(stats.stats, { lost: 1, killed: 2, structuresLost: 1, structuresDestroyed: 1, trained: 1, built: 1, alloy: 0, energy: 0 });
  stats.reset();
  assert.equal(stats.stats.killed, 0);
});

test('gathered resources equal what Harvesters actually delivered', () => {
  const sim = new Simulation({ enemyCount: 1, ai: false });
  const stats = createMatchStats();
  const worker = sim.own(0).find((e) => e.type === 'worker');
  const alloy0 = sim.players[0].alloy;
  sim.command({ team: 0, type: 'harvest' });
  for (let i = 0; i < 20 * 90; i++) tickWith(sim, stats);
  const gained = sim.players[0].alloy - alloy0 + sim.players[0].energy - 150;
  assert.ok(worker);
  assert.ok(stats.stats.alloy > 0, 'some alloy was delivered');
  // Nothing was spent, so income seen by the tracker is exactly the bank change.
  assert.equal(stats.stats.alloy + stats.stats.energy, gained);
});

test('counting never changes the simulation: same hash with and without the tracker', () => {
  const a = new Simulation({ enemyCount: 1 }), b = new Simulation({ enemyCount: 1 });
  const stats = createMatchStats();
  for (let i = 0; i < 400; i++) { tickWith(a, stats); b.tick(0.05); }
  assert.equal(a.hash(), b.hash());
});

test('result card shows the stat tiles and the buttons for every outcome', () => {
  const stats = { killed: 7, lost: 3, structuresDestroyed: 2, alloy: 1200, energy: 340 };
  for (const result of ['victory', 'defeat', 'draw']) {
    const html = skirmishResultHTML({ result, seconds: 754, stats, emblem: 'e.webp', arrow: '' });
    assert.match(html, new RegExp(`data-result="${result}"`));
    assert.equal((html.match(/class="stat/g) || []).length, 6);
    assert.match(html, /<strong>12:34<\/strong><span>Operation time/);
    assert.match(html, /<strong>7<\/strong><span>Enemies defeated/);
    assert.match(html, /data-new-game/); assert.match(html, /data-restart/);
  }
  assert.equal(formatClock(61), '1:01');
});

test('every new results label has a Vietnamese translation', () => {
  for (const label of ['Enemies defeated', 'Units lost', 'Structures destroyed', 'Alloy gathered', 'Energy gathered', 'Operation time', 'Mission time', 'Best time', 'Operation successful', 'Operation failed', 'Operation concluded']) {
    assert.notEqual(translate(label, 'vi'), label, label);
    assert.notEqual(translate(label.toUpperCase(), 'vi'), label.toUpperCase(), label);
  }
});
