import test from 'node:test';
import assert from 'node:assert/strict';
import { planScatter, buildBlocks, campSites, DRESSING, HEIGHT, MAX_SCALE, SOLID } from '../src/scatter.js';
import { createMapEdge, CLIFF } from '../src/map-edge.js';
import { Terrain } from '../src/terrain.js';
import { ROCKS } from '../src/data.js';
import maps from '../src/maps.json' with { type: 'json' };

const ids = Object.keys(maps);
const triangles = (terrain, props) => [...buildBlocks(terrain, props).values()].reduce((n, b) => n + b.mesher.vertices / 3, 0);

test('map dressing is seeded: the same map always gets the same props, without Math.random', () => {
  const random = Math.random;
  Math.random = () => { throw new Error('dressing must not use Math.random'); };
  try {
    for (const id of ids) {
      const terrain = new Terrain(id), a = planScatter(terrain), b = planScatter(new Terrain(id));
      assert.ok(a.length > 300, `${id}: dressed`);
      assert.deepEqual(a, b, `${id}: identical plans`);
      const first = buildBlocks(terrain, a).values().next().value.mesher, second = buildBlocks(terrain, b).values().next().value.mesher;
      assert.deepEqual(first.p.slice(0, 600), second.p.slice(0, 600), `${id}: identical geometry`);
      assert.ok(DRESSING[id], `${id}: has its own recipe`);
    }
  } finally { Math.random = random; }
});

test('dressing stays inside the map, off water, roads and walls, and clear of the camps', () => {
  for (const id of ids) {
    const terrain = new Terrain(id), camps = campSites(terrain);
    for (const p of planScatter(terrain)) {
      const reach = p.kind === 'ruinFloor' ? 3.05 : 0.75 * p.s;
      assert.ok(Math.abs(p.x) + reach <= terrain.half && Math.abs(p.z) + reach <= terrain.half, `${id}: ${p.kind} at ${p.x},${p.z} leaves the map`);
      const surface = terrain.at(p.x, p.z);
      if (p.kind === 'lily') assert.equal(surface, 'water');
      else assert.ok(!['water', 'ford', 'bridge', 'road'].includes(surface), `${id}: ${p.kind} on ${surface}`);
      // Every wall keeps its own footprint clear; fallen stones lean just outside it.
      for (const [x, z, r] of ROCKS) assert.ok(Math.hypot(p.x - x, p.z - z) >= r + 0.45, `${id}: ${p.kind} inside a wall`);
      if (SOLID.has(p.kind) || p.kind === 'ruinFloor')
        for (const [x, z] of camps) assert.ok(Math.hypot(p.x - x, p.z - z) >= 15, `${id}: ${p.kind} stands in a camp`);
    }
  }
});

test('no prop is tall enough to hide a unit, and built geometry respects the planned heights', () => {
  for (const kind of Object.keys(HEIGHT)) assert.ok(HEIGHT[kind] * MAX_SCALE <= 2.5, `${kind} is too tall`);
  for (const id of ids) {
    const terrain = new Terrain(id), props = planScatter(terrain);
    for (const p of props) assert.ok(p.s <= MAX_SCALE && HEIGHT[p.kind] !== undefined, `${id}: ${p.kind}`);
    const { mesher, props: records } = buildBlocks(terrain, props).values().next().value;
    assert.equal(records.length, props.length * 5);
    props.forEach((p, i) => {
      const start = records[i * 5 + 3], count = records[i * 5 + 4], limit = HEIGHT[p.kind] * p.s + 0.02 + terrain.heightAt(p.x, p.z);
      assert.ok(count > 0 && count % 3 === 0, `${id}: ${p.kind} has whole triangles`);
      for (let v = start; v < start + count; v++) {
        assert.ok(mesher.p[v * 3 + 1] <= limit, `${id}: ${p.kind} reaches ${mesher.p[v * 3 + 1].toFixed(2)} (limit ${limit.toFixed(2)})`);
        assert.ok(Math.abs(mesher.p[v * 3]) <= terrain.half && Math.abs(mesher.p[v * 3 + 2]) <= terrain.half, `${id}: ${p.kind} vertex outside the map`);
      }
    });
    assert.equal(mesher.p.length, mesher.n.length);
    assert.equal(mesher.p.length, mesher.c.length);
    assert.equal(mesher.w.length * 3, mesher.p.length);
    assert.ok(mesher.p.every(Number.isFinite) && mesher.c.every((v) => v >= 0 && Number.isFinite(v)));
  }
});

test('dressing costs fewer triangles than the instanced pebbles and grass it replaced, and thins on Eco', () => {
  for (const id of ids) {
    const terrain = new Terrain(id), area = (terrain.size / 96) ** 2;
    const before = (500 * 36 + 850 * 6) * area; // dodecahedron pebbles and cone grass, always drawn
    const eco = planScatter(terrain, 0.6), high = planScatter(terrain, 1);
    assert.ok(triangles(terrain, eco) <= before, `${id}: Eco dressing ${triangles(terrain, eco)} > ${before}`);
    assert.ok(triangles(terrain, high) <= before * 1.2, `${id}: High dressing ${triangles(terrain, high)}`);
    assert.ok(eco.length < high.length * 0.75, `${id}: Eco is thinner`);
    assert.equal(buildBlocks(terrain, high).size, 1, `${id}: one mesh, one draw`);
  }
});

test('the map edge is a skirt and an outland below the map; the playable top is untouched', () => {
  for (const id of ids) {
    const terrain = new Terrain(id), edge = createMapEdge(terrain), p = edge.geometry.attributes.position;
    assert.equal(edge.name, 'backdrop');
    assert.equal(edge.castShadow, false);
    let low = 0;
    for (let i = 0; i < p.count; i++) {
      assert.ok(p.getY(i) <= 1e-6, `${id}: nothing above the ground`);
      // Inside the map square there is only the river mouth's dip; all else is on or beyond the edge.
      const inside = Math.abs(p.getX(i)) < terrain.half - 1e-3 && Math.abs(p.getZ(i)) < terrain.half - 1e-3;
      assert.ok(!inside, `${id}: backdrop vertex inside the playable square`);
      low = Math.min(low, p.getY(i));
    }
    assert.equal(low, -CLIFF);
    assert.equal(p.count, edge.geometry.attributes.color.count);
  }
});
