import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { SAVE_VERSION } from '../src/snapshot.js';

const run = (s, seconds) => { for (let i = 0; i < seconds * 20; i++) { s.tick(0.05); s.events.length = 0; } };

// A scripted player: the same commands at the same ticks every time.
function play(s, seconds) {
  const hq = s.own(0).find((e) => e.type === 'hq');
  for (let i = 0; i < seconds * 20; i++) {
    if (s.ticks === 1) s.command({ team: 0, type: 'harvest' });
    if (s.ticks % 400 === 10) s.command({ team: 0, type: 'train', building: hq.id, unit: 'worker' });
    if (s.ticks === 300) {
      const w = s.own(0).find((e) => e.type === 'worker'), spot = s.findPlacement('barracks', 0, hq.x + 10, hq.z + 4);
      if (w && spot) s.command({ team: 0, type: 'build', worker: w.id, building: 'barracks', x: spot.x, z: spot.z });
    }
    if (s.ticks % 300 === 150) {
      const b = s.own(0).find((e) => e.type === 'barracks' && e.complete);
      if (b) s.command({ team: 0, type: 'train', building: b.id, unit: s.ticks % 600 === 150 ? 'vanguard' : 'ranger' });
      const army = s.own(0).filter((e) => e.kind === 'unit' && e.damage > 0 && e.type !== 'worker');
      if (army.length >= 4) s.command({ team: 0, type: 'order', ids: army.map((e) => e.id), order: { type: 'attackmove', x: 0, z: 0 } });
    }
    s.tick(0.05); s.events.length = 0;
  }
}

test('a saved match loads into the same state and then plays out identically', () => {
  for (const options of [{ map: 'classic', aiSpeed: 'fast' }, { map: 'highlands', enemyCount: 3, alliance: 'coalition', aiSpeed: 'relentless' }]) {
    const a = new Simulation(options);
    play(a, 240);
    const saved = a.serialize(), b = Simulation.load(saved);
    assert.ok(b, 'save loads');
    assert.equal(b.hash(), a.hash(), 'loaded state matches');
    assert.ok(saved.length < 400_000, `save is compact: ${saved.length} bytes`);
    for (let step = 0; step < 6; step++) {
      run(a, 30); run(b, 30);
      assert.equal(b.hash(), a.hash(), `${options.map}: in step ${30 * (step + 1)} s after loading`);
    }
  }
});

test('a match replays exactly from its options and command log', () => {
  const a = new Simulation({ map: 'riverlands', aiSpeed: 'normal' });
  play(a, 300);
  assert.ok(a.commandLog.length > 8, 'commands were logged');
  const b = new Simulation({ map: 'riverlands', aiSpeed: 'normal' });
  const log = structuredClone(a.commandLog);
  let next = 0;
  while (b.ticks < a.ticks) {
    while (next < log.length && log[next].tick === b.ticks) { const { tick, ...c } = log[next++]; b.command(c); }
    b.tick(0.05); b.events.length = 0;
  }
  assert.equal(next, log.length);
  assert.equal(b.hash(), a.hash());
});

test('commands are refused unless the sender owns what they act on', () => {
  const s = new Simulation({ ai: false });
  const mine = s.own(0).find((e) => e.type === 'worker'), theirs = s.own(1).find((e) => e.type === 'worker');
  const myCore = s.own(0).find((e) => e.type === 'hq'), theirCore = s.own(1).find((e) => e.type === 'hq');
  assert.equal(s.command({ team: 0, type: 'order', ids: [theirs.id], order: { type: 'move', x: 0, z: 0 } }), false);
  assert.equal(theirs.orders.length, 0);
  assert.equal(s.command({ team: 0, type: 'train', building: theirCore.id, unit: 'worker' }), false);
  assert.equal(theirCore.queue.length, 0);
  assert.equal(s.command({ team: 0, type: 'rally', ids: [theirCore.id], rally: { x: 0, z: 0 } }), false);
  assert.equal(s.command({ team: 5, type: 'harvest' }), false);
  assert.equal(s.command({ team: 0, type: 'nonsense' }), false);
  assert.equal(s.commandLog.length, 0, 'refused commands are not logged');
  // A mixed selection: only the sender's own unit moves.
  assert.ok(s.command({ team: 0, type: 'order', ids: [mine.id, theirs.id], order: { type: 'move', x: 0, z: 0 } }) !== false);
  assert.equal(mine.orders[0]?.type, 'move'); assert.equal(theirs.orders.length, 0);
  assert.equal(s.command({ team: 0, type: 'train', building: myCore.id, unit: 'worker' }), true);
});

test('a save from another version or a damaged save is refused, not half-loaded', () => {
  const s = new Simulation({ ai: false });
  const data = JSON.parse(s.serialize());
  assert.equal(data.version, SAVE_VERSION);
  assert.equal(Simulation.load(JSON.stringify({ ...data, version: SAVE_VERSION + 1 })), null);
  assert.equal(Simulation.load('{"broken'), null);
  assert.equal(Simulation.load('null'), null);
});
