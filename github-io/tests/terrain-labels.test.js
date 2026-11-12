// River crossings and high ground, as the player is told about them (src/terrain-labels.js), the
// painted roads that lead to the crossings (src/terrain.js) and a check that the high-ground rules
// win real fights (tools/high-ground-bench.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Terrain, TERRAIN, CROSSINGS } from '../src/terrain.js';
import { Simulation } from '../src/simulation.js';
import { HIGH_GROUND_TEXT, HIGH_GROUND_HINT, CROSSING_TEXT, onHighGround, crossingAt, shotSlope } from '../src/terrain-labels.js';
import { translate } from '../src/i18n.js';
import { fight } from '../tools/high-ground-bench.mjs';

const RIVER_MAPS = ['riverlands', 'expanse', 'woodlands'];

test('crossings: two bridges and a ford, named where the river and its banks are', () => {
  const t = new Terrain('riverlands');
  assert.equal(crossingAt(t, -22, 0)?.type, 'bridge');
  assert.equal(crossingAt(t, 22, 4.5)?.type, 'bridge', 'the bank at a bridge head');
  assert.equal(crossingAt(t, 0, -2)?.type, 'ford');
  assert.equal(crossingAt(t, -12, 0), null, 'open water');
  assert.equal(crossingAt(t, 0, 6), null, 'past the bank');
  assert.equal(crossingAt(new Terrain('classic'), 0, 0), null, 'no river');
  assert.equal(CROSSING_TEXT.ford, 'Ford: infantry and vehicles can cross');
});

test('painted roads reach the river only at a crossing, and no bare earth touches a bank elsewhere', () => {
  for (const id of RIVER_MAPS) {
    const t = new Terrain(id);
    for (let x = -t.half + 0.5; x < t.half; x += 0.25)
      for (const z of [-7.5, -6, -5.05, 5.05, 6, 7.5]) {
        const type = t.at(x, z), at = CROSSINGS.find((c) => Math.abs(x - c.x) < c.half + 2.5);
        if (type === 'road' && Math.abs(z) < 6.5) assert.ok(at, `${id}: road at the bank (${x}, ${z}) away from every crossing`);
        if (!at) assert.notEqual(type, 'dirt', `${id}: bare earth at the bank (${x}, ${z})`);
      }
    // Each crossing has a road leading to it from both banks.
    for (const c of CROSSINGS) for (const z of [-6, 6]) assert.equal(t.at(c.x, z), 'road', `${id}: road to the ${c.type} at x ${c.x}`);
  }
  // Maps without a river keep the straight diagonal road.
  assert.equal(new Terrain('basin').at(0, 0), 'road');
});

test('high ground: who is on it, which way a shot goes, and the words for it', () => {
  const s = new Simulation({ ai: false, map: 'dunes' }), p = s.terrain.plateaus[0];
  const top = s.spawn('ranger', 0, p.x, p.z), below = s.spawn('ranger', 1, p.x, p.z + p.r + 5);
  assert.equal(onHighGround(s.terrain, top), true);
  assert.equal(onHighGround(s.terrain, below), false);
  assert.equal(onHighGround(s.terrain, { kind: 'building', damage: 0, x: p.x, z: p.z }), false, 'a building that does not shoot');
  assert.equal(onHighGround(s.terrain, { kind: 'building', damage: 19, x: p.x, z: p.z }), true, 'a tower');
  assert.equal(onHighGround(new Terrain('classic'), { kind: 'unit', x: 0, z: 0 }), false);
  assert.equal(shotSlope(s.terrain, top.x, top.z, below.x, below.z), 1);
  assert.equal(shotSlope(s.terrain, below.x, below.z, top.x, top.z), -1);
  assert.equal(shotSlope(new Terrain('riverlands'), 0, 0, 5, 5), 0);
  assert.equal(HIGH_GROUND_TEXT, `High ground: +${TERRAIN.high_range} m range, +${Math.round((TERRAIN.high_damage - 1) * 100)}% damage, +${TERRAIN.high_vision} m sight`);
  for (const text of [HIGH_GROUND_TEXT, HIGH_GROUND_HINT, CROSSING_TEXT.ford, CROSSING_TEXT.bridge])
    assert.notEqual(translate(text, 'vi'), text, `Vietnamese for "${text}"`);
});

test('high ground wins an even fight that level ground leaves close', () => {
  for (const group of ['rangers', 'tanks'])
    for (const swap of [false, true]) {
      const hill = fight({ group, start: 'guard', gap: 6, side: 90, swap });
      const flat = fight({ group, start: 'guard', gap: 6, side: 90, swap, flat: true });
      const kept = (r) => r.left.high / r.startLife.high;
      assert.equal(hill.winner, 'high', `${group}${swap ? ' (teams swapped)' : ''}: the high side wins`);
      assert.ok(kept(hill) > 0.2 && kept(hill) > kept(flat) + 0.1, `${group}: high side keeps ${kept(hill).toFixed(2)} of its HP (level ground ${kept(flat).toFixed(2)})`);
      assert.ok(hill.hits.high.dmg > 0 && hill.hits.low.dmg > 0, 'both sides fired');
    }
});

test('campaign lines name the middle crossing a ford and the outer ones bridges', () => {
  const source = readFileSync(new URL('../src/story/missions.js', import.meta.url), 'utf8');
  for (const wrong of [/centre bridge/i, /middle bridge/i, /bridge in the middle/i, /(east|west) ford/i, /three fords/i, /two crossings/i])
    assert.doesNotMatch(source, wrong);
});
