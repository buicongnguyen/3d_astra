// Stage 3: plateaus, ramps, cliffs, high ground, plateau vision and straight walls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { Terrain, TERRAIN } from '../src/terrain.js';
import { DEFINITIONS as D } from '../src/data.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const disc = () => new Terrain('dunes').plateaus[0];

test('levels, mirror, cliffs and ramps', () => {
  const t = new Terrain('dunes'), p = disc();
  assert.equal(t.plateaus.length, 2, 'the mirrored copy exists');
  assert.equal(t.level(p.x, p.z), 1);
  assert.equal(t.level(-p.x, -p.z), 1, 'point mirror');
  assert.equal(t.level(p.x + p.r + 3, p.z), 0);
  assert.equal(t.canStand(p.x, p.z + p.r, 0.5), false, 'the rim is a cliff');
  const ramp = p.ramps[0];
  assert.equal(t.canStand(ramp.x, ramp.z, 0.5), true, 'a ramp crosses it');
  assert.equal(t.placement(ramp.x, ramp.z, 1), 'Keep cliffs and ramps clear.');
  assert.equal(t.placement(p.x, p.z + p.r, 1), 'Keep cliffs and ramps clear.');
  assert.ok(near(t.heightAt(p.x, p.z), TERRAIN.plateau_height) && t.heightAt(p.x + p.r + 4, p.z) === 0);
  const mid = t.heightAt(ramp.x, ramp.z);
  assert.ok(mid > 0.5 && mid < TERRAIN.plateau_height - 0.5, `ramp height ${mid}`);
});

test('no path crosses a cliff, and a path exists up each ramp', () => {
  const s = new Simulation({ ai: false, map: 'dunes' }), p = s.terrain.plateaus[0];
  const out = { x: p.x, z: p.z + p.r + 4 }, top = { x: p.x, z: p.z };
  const path = s.nav.path(out, top, 0.55);
  assert.ok(path.length, 'reachable through a ramp');
  const all = [out, ...path];
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1], b = all[i], steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3);
    for (let k = 0; k <= steps; k++) {
      const x = a.x + (b.x - a.x) * k / steps, z = a.z + (b.z - a.z) * k / steps;
      assert.ok(!s.terrain.cliff(x, z, 0) , `path point (${x.toFixed(1)}, ${z.toFixed(1)}) is on a cliff`);
    }
  }
});

test('high ground: more range and damage shooting down, less shooting up', () => {
  const s = new Simulation({ ai: false, map: 'dunes' }), p = s.terrain.plateaus[0];
  const up = s.spawn('ranger', 0, p.x, p.z), down = s.spawn('ranger', 1, p.x, p.z + p.r + 6);
  up.shield = down.shield = 0;
  assert.equal(s.heightRange(up, down), TERRAIN.high_range);
  assert.equal(s.heightRange(down, up), 0);
  let hp = down.hp; s.hit(up, down);
  assert.ok(near(hp - down.hp, D.ranger.damage * TERRAIN.high_damage));
  hp = up.hp; s.hit(down, up);
  assert.ok(near(hp - up.hp, D.ranger.damage * TERRAIN.low_damage));
  // A map without plateaus is neutral.
  const c = new Simulation({ ai: false }), a = c.spawn('ranger', 0, 0, 30), b = c.spawn('ranger', 1, 4, 30);
  assert.equal(c.heightDamage(a, b), 1);
  assert.equal(c.heightRange(a, b), 0);
});

test('a plateau top is hidden from below unless a friendly unit stands on it', () => {
  const s = new Simulation({ ai: false, map: 'dunes' }), p = s.terrain.plateaus[0];
  for (const e of s.own(0)) if (e.kind === 'unit') { e.x = -50; e.z = 50; }
  const watcher = s.spawn('ranger', 0, p.x, p.z + p.r + 3); watcher.vision = 30;
  s.updateVision();
  assert.equal(s.isVisible({ x: p.x, z: p.z }, 0), false, 'the centre of the top');
  assert.equal(s.isVisible({ x: p.x, z: p.z + p.r + 1 }, 0), true, 'the ground beside it');
  s.spawn('ranger', 0, p.x, p.z - 2);
  s.updateVision();
  assert.equal(s.isVisible({ x: p.x, z: p.z }, 0), true);
});

test('straight walls are lines of breakable pieces, saved and restored', () => {
  const s = new Simulation({ ai: false, map: 'dunes' }), walls = s.entities.filter((e) => e.axis);
  const w = s.terrain.walls[0], pieces = Math.round(w.length / 2);
  assert.equal(walls.length, pieces * 2, 'both mirrored lines');
  assert.ok(walls.filter((e) => e.z === w.z).every((e) => e.axis === 'h'));
  assert.equal(s.nav.canStand(w.x, w.z, 0.5), false, 'the line blocks the way');
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.entities.filter((e) => e.axis).length, walls.length);
  assert.equal(copy.hash(), s.hash());
});

test('maps without plateaus or walls keep their recorded hash', () => {
  const s = new Simulation({ ai: false, factions: { 0: 'meridian', 1: 'meridian' } });
  for (let i = 0; i < 1200; i++) s.tick(0.05);
  assert.equal(s.hash(), 'd071360b');
  assert.equal(new Terrain('classic').plateaus.length, 0);
});
