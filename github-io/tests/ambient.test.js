import test from 'node:test';
import assert from 'node:assert/strict';
import { Governor, LEVELS } from '../src/governor.js';
import { planLife, LIFE } from '../src/ambient-life.js';
import { Terrain } from '../src/terrain.js';

// Feed `seconds` of frames; frame(scale) returns [intervalSeconds, workMs] for the current render scale.
function run(governor, seconds, frame, state) {
  let t = 0;
  while (t < seconds) {
    const [interval, work] = frame(state.scale);
    governor.sample(interval, work, true);
    t += interval;
  }
}
function governed() {
  const state = { scale: 1, motion: 2, changes: [] };
  const governor = new Governor({ onChange: (level, index) => { state.scale = level.scale; state.motion = level.motion; state.changes.push(index); } });
  return { governor, state };
}

test('governor keeps full motion on smooth frames and ignores a 30 Hz display cap', () => {
  for (const frame of [() => [1 / 60, 4], () => [1 / 30, 4]]) {
    const { governor, state } = governed();
    run(governor, 20, frame, state);
    assert.equal(governor.current.name, 'full');
    assert.deepEqual(state.changes, []);
  }
});

test('governor calms, then stills cosmetic motion, and keeps a render-scale drop only when it helps', () => {
  // GPU-bound: frame time follows the pixels drawn, so a smaller render scale really helps.
  let { governor, state } = governed();
  run(governor, 4 + 3, () => [0.05 * state.scale ** 2, 5], state);
  assert.equal(state.motion, 0, 'tiny things hold still before resolution is touched');
  run(governor, 8, () => [0.05 * state.scale ** 2, 5], state);
  assert.equal(governor.current.name, 'rescue');
  assert.equal(state.scale, 0.8);
  // CPU-bound: a smaller render scale changes nothing, so it is undone and never retried.
  ({ governor, state } = governed());
  run(governor, 20, () => [0.045, 30], state);
  assert.equal(state.scale, 1, 'useless resolution drop is undone');
  assert.equal(governor.current.name, 'still');
  assert.equal(governor.scaleTried, true);
  run(governor, 10, () => [0.045, 30], state);
  assert.equal(state.scale, 1, 'and not retried');
});

test('governor recovers after smooth play and ignores hitches, pauses and the start-up grace', () => {
  const { governor, state } = governed();
  run(governor, 8, () => [0.05, 20], state);
  assert.ok(governor.level < LEVELS.length - 1);
  run(governor, 40, () => [1 / 60, 3], state);
  assert.equal(governor.current.name, 'full');
  const fresh = governed();
  fresh.governor.reset();
  for (let i = 0; i < 100; i++) fresh.governor.sample(0.4, 50, true); // loading hitches
  for (let i = 0; i < 200; i++) fresh.governor.sample(0.05, 50, false); // paused
  run(fresh.governor, 2.9, () => [0.05, 50], fresh.state); // still inside the grace period
  assert.deepEqual(fresh.state.changes, []);
});

test('ambient life is seeded, scales with area and budget, and stays inside every map', () => {
  for (const id of Object.keys(LIFE)) {
    const terrain = new Terrain(id), half = terrain.half;
    const full = planLife(terrain, 1), light = planLife(terrain, 0.6);
    assert.deepEqual(planLife(terrain, 1), full, `${id} plan is deterministic`);
    assert.ok(light.motes.length <= full.motes.length && light.butterflies.length <= full.butterflies.length, `${id} budget thins the cast`);
    for (const b of full.birds) {
      if (b.mode === 0) assert.ok(Math.max(Math.abs(b.x), Math.abs(b.z)) + b.radius <= half - 3, `${id} bird circle inside`);
      assert.ok(b.y > 6, `${id} birds fly above buildings`);
    }
    for (const f of full.butterflies.concat(full.dragonflies))
      assert.ok(Math.max(Math.abs(f.x) + f.rx, Math.abs(f.z) + f.rz) + 0.5 <= half - 1, `${id} flutter inside`);
    for (const f of full.fish) {
      assert.ok(terrain.river && Math.abs(f.z) + 0.5 < 3 && Math.abs(f.x) < half - 2, `${id} fish swim in the river`);
      assert.equal(terrain.at(f.x, f.z) === 'water' || terrain.at(f.x, f.z) === 'bridge' || terrain.at(f.x, f.z) === 'ford', true);
    }
    for (const m of full.motes) assert.ok(Math.max(Math.abs(m.x), Math.abs(m.z)) + 5.2 <= half - 1, `${id} motes inside`);
    for (const b of full.butterflies) assert.ok(!['water', 'stone'].includes(terrain.at(b.x, b.z)), `${id} butterflies over land`);
  }
  assert.equal(planLife(new Terrain('classic')).fish.length, 0, 'no fish without a river');
  assert.ok(planLife(new Terrain('woodlands')).butterflies.length > planLife(new Terrain('riverlands')).butterflies.length);
});
