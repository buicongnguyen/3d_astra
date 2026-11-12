import test from 'node:test';
import assert from 'node:assert/strict';
import { Effects } from '../src/fx.js';

// A shot event carries the target's position when it was fired; the round takes
// weaponStyle.life seconds to fly, so the drawn round must meet the target where it is then.
const fx = (previous = new Map(), terrain = { plateaus: [] }) => ({ view: { terrain, previous } });

test('rounds lead a moving target by its last-tick velocity, capped at 3 m', () => {
  const target = { id: 9, x: 10, z: 0 };
  const sim = { get: (id) => (id === 9 ? target : null) };
  const slow = Effects.prototype.aim.call(fx(new Map([[9, { x: 10, z: -0.2 }]])), { weapon: 'tank', x: 0, z: 0, tx: 10, tz: 0, target: 9 }, sim);
  assert.ok(Math.abs(slow.land.z - 0.2 / 0.05 * 0.32) < 1e-9, `led by speed × flight time: ${slow.land.z}`);
  const fast = Effects.prototype.aim.call(fx(new Map([[9, { x: 10, z: -5 }]])), { weapon: 'tank', x: 0, z: 0, tx: 10, tz: 0, target: 9 }, sim);
  assert.ok(Math.abs(fast.land.z - 3) < 1e-9, `lead capped: ${fast.land.z}`);
  const still = Effects.prototype.aim.call(fx(), { weapon: 'tank', x: 0, z: 0, tx: 10, tz: 0, target: 9 }, sim);
  assert.equal(still.land.x, 10);
  assert.equal(still.land.z, 0);
});

test('the drawn round flies between the real heights of shooter and target on plateaus', () => {
  const terrain = { plateaus: [{}], heightAt: (x) => (x > 5 ? 2.4 : 0) };
  const shot = Effects.prototype.aim.call(fx(new Map(), terrain), { weapon: 'rifle', x: 0, z: 0, tx: 10, tz: 0 }, { get: () => null });
  assert.ok(shot.to.y > 3 && shot.to.lifted, `aim point on the plateau: ${shot.to.y}`);
  assert.ok(shot.from.y < 2 && shot.from.lifted, `muzzle on the low ground: ${shot.from.y}`);
  assert.ok(shot.land.y < 1, 'the impact point stays ground-relative (particles lift it once)');
});
