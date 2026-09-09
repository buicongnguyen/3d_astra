import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { MAPS } from '../src/terrain.js';
import { distance } from '../src/data.js';

function advance(s, seconds, dt = 0.05) {
  for (let i = 0; i < Math.ceil(seconds / dt); i++) s.tick(dt);
}
const workers = (s, team = 0) => s.own(team).filter(e => e.type === 'worker');

test('crowded starting deposits keep every faction harvesting for five minutes on all maps', () => {
  for (const map of Object.keys(MAPS)) {
    const s = new Simulation({ ai: false, map, enemyCount: 3 });
    const all = [];
    for (let team = 0; team < 4; team++) {
      const ws = workers(s, team);
      const r = s.resources.filter(r => r.type === 'alloy')
        .sort((a, b) => distance(ws[0], a) - distance(ws[0], b))[0];
      r.amount = 10000;
      s.issue(ws.map(w => w.id), { type: 'gather', target: r.id });
      all.push(...ws);
    }
    const deliveries = new Map(all.map(w => [w.id, 0]));
    for (let i = 0; i < 6000; i++) {
      const cargo = all.map(w => w.carry);
      s.tick(0.05);
      all.forEach((w, j) => {
        if (cargo[j] > 0 && w.carry === 0) deliveries.set(w.id, deliveries.get(w.id) + 1);
      });
    }
    for (const w of all) {
      assert.ok(deliveries.get(w.id) >= 5, `${map}, team ${w.team}, worker ${w.id} keeps delivering`);
      assert.ok(['gather', 'deliver'].includes(w.orders[0]?.type), `${map}: no lost work orders`);
    }
    assert.ok(!s.events.some(e => e.text?.includes('cannot reach')), map);
  }
});

test('long movement and harvesting remain active at 30, 60, 144 and 240 FPS', () => {
  for (const fps of [30, 60, 144, 240]) {
    const s = new Simulation({ ai: false, map: 'highlands' });
    const w = workers(s)[0];
    const r = s.resources[0];
    w.x = -20; w.z = 54;
    s.issue([w.id], { type: 'gather', target: r.id });
    advance(s, 40, 1 / fps);
    assert.ok(s.players[0].alloy > 450, `${fps} FPS delivers after a long approach`);
    assert.ok(w.orders.length, `${fps} FPS keeps the work order`);
    const tank = s.spawn('tank', 0, 0, 35);
    s.issue([tank.id], { type: 'move', x: 35, z: 35 });
    advance(s, 18, 1 / fps);
    assert.ok(distance(tank, { x: 35, z: 35 }) < 2, `${fps} FPS slow vehicle arrives`);
  }
});

test('depleted deposits deliver partial cargo and switch to the same resource without creating resources', () => {
  const s = new Simulation({ ai: false });
  const w = workers(s)[0], r = s.resources[0];
  r.amount = 3;
  const initial = s.resources.reduce((sum, r) => sum + r.amount, 0);
  s.issue([w.id], { type: 'gather', target: r.id });
  advance(s, 45);
  assert.equal(r.amount, 0);
  assert.ok(s.players[0].alloy > 453);
  assert.equal(s.get(w.resource).type, 'alloy');
  assert.equal(s.players[0].energy, 150);
  assert.equal(initial - s.resources.reduce((sum, r) => sum + r.amount, 0),
    s.players[0].alloy - 450 + w.carry);
});

test('depletion respects queued movement and does not search unexplored or distant deposits', () => {
  for (const queued of [false, true]) {
    const s = new Simulation({ ai: false });
    const w = workers(s)[0], r = s.resources[0];
    r.amount = 3;
    if (!queued) {
      // A nearby unexplored alloy, a distant explored alloy, and nearby energy.
      s.resources = [r];
      s.resource('alloy', -12, 38, 100);
      s.resource('alloy', 20, 38, 100);
      s.resource('energy', -30, 34, 100);
      s.visionClock = 1000;
      s.explored[0].fill(0);
      const [x, z] = s.nav.cellAt(20, 38);
      s.explored[0][z * s.terrain.grid + x] = 1;
    }
    s.issue([w.id], { type: 'gather', target: r.id });
    if (queued) s.issue([w.id], { type: 'move', x: -16, z: 12 }, true);
    advance(s, 35);
    assert.equal(s.players[0].alloy, 453);
    assert.equal(w.carry, 0);
    assert.equal(w.orders.length, 0);
    if (queued) assert.ok(distance(w, { x: -16, z: 12 }) < 2);
    else assert.equal(s.events.filter(e => e.text?.includes('No reachable nearby alloy')).length, 1);
  }
});

test('missing completed core preserves cargo and explains delivery requirements', () => {
  const s = new Simulation({ ai: false });
  const w = workers(s)[0], hq = s.own(0).find(e => e.type === 'hq');
  hq.complete = false;
  w.carry = 7; w.carryType = 'alloy';
  s.issue([w.id], { type: 'deliver' });
  advance(s, 1);
  assert.equal(w.carry, 7);
  assert.equal(s.players[0].alloy, 450);
  assert.equal(s.events.filter(e => e.text?.includes('completed Command core')).length, 1);
  hq.complete = true;
  s.issue([w.id], { type: 'deliver' });
  advance(s, 10);
  assert.equal(w.carry, 0);
  assert.equal(s.players[0].alloy, 457);
});
