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

test('combat kills the small creatures it reaches, the governor thins the rest, birds survive', async () => {
  const THREE = await import('three');
  const { AmbientLife } = await import('../src/ambient-life.js');
  const life = new AmbientLife(new THREE.Scene(), new Terrain('riverlands'));
  const group = (name) => life.groups.find((g) => g.name === name);
  const butterflies = group('butterflies'), fish = group('fish'), birds = group('birds');
  const total = life.aliveCount, target = butterflies.rows[3], targetColor = [...butterflies.geometry.attributes.aColor.array.slice(3 * 3, 3 * 3 + 3)];
  const killed = life.disturb(target.x, target.z, 1);
  assert.ok(killed >= 1, 'a blast on a butterfly kills it');
  assert.equal(life.aliveCount, total - killed);
  assert.equal(butterflies.geometry.instanceCount, butterflies.alive, 'dead ones are no longer drawn');
  assert.ok(!butterflies.rows.slice(0, butterflies.alive).includes(target), 'the dead butterfly moved past the live ones');
  const at = butterflies.rows.indexOf(target), colors = butterflies.geometry.attributes.aColor.array;
  assert.deepEqual([...colors.slice(at * 3, at * 3 + 3)], targetColor, 'its buffers moved with it');
  const f = fish.rows[0], [fx, fz] = fish.at(f, life.uniforms.uTime.value);
  assert.ok(life.disturb(fx, fz, 0.5) >= 1, 'fish are hit where they swim now');
  life.disturb(birds.rows[0].x, birds.rows[0].z, 50);
  assert.equal(birds.alive, birds.rows.length, 'birds fly above the battle');
  life.setShare(0.5);
  assert.equal(birds.geometry.instanceCount, Math.ceil(birds.alive / 2));
  assert.equal(birds.shadow.instanceCount, birds.geometry.instanceCount, 'shadows follow their birds');
  life.setShare(0);
  assert.equal(life.root.visible, false, 'rescue hides all ambient life');
  life.setShare(1);
  assert.equal(life.root.visible, true);
});
