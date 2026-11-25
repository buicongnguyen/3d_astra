// Buildings on high ground (bug 2026-11-25: "on the higher land the building often does not
// show"). Everything drawn at a building site takes its height from one source, src/ground-y.js:
// the finished building and the one under construction (view.js entity roots), the build ghost
// (app/orders.js, app/input-pointer.js), the order marker and the rally flag. The ghost used a
// fixed 0.23 m and was drawn inside every plateau. The browser half is in tests/terrain.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { Terrain, TERRAIN, ALL_MAPS } from '../src/terrain.js';
import { DEFINITIONS as D } from '../src/data.js';
import { groundY, placeOnGround, GHOST_LIFT } from '../src/ground-y.js';

const H = TERRAIN.plateau_height;
const BUILDINGS = Object.keys(D).filter((k) => D[k].kind === 'building');
const PLATEAU_MAPS = Object.keys(ALL_MAPS).filter((id) => ALL_MAPS[id].plateaus?.length);
const stub = () => ({ position: { x: NaN, y: NaN, z: NaN, set(x, y, z) { Object.assign(this, { x, y, z }); } } });

// The terrain-valid site nearest a plateau's centre (0.5 m scan), or null when the type does not fit.
function siteOnTop(t, p, radius) {
  const reach = p.shape === 'disc' ? p.r : Math.max(p.w, p.d) / 2;
  let best = null;
  for (let dx = -reach; dx <= reach; dx += 0.5)
    for (let dz = -reach; dz <= reach; dz += 0.5) {
      const x = p.x + dx, z = p.z + dz;
      if (Math.abs(x) > t.half - radius - 2 || Math.abs(z) > t.half - radius - 2) continue;
      if (t.plateauAt(x, z) < 0 || t.placement(x, z, radius)) continue;
      const d = Math.hypot(dx, dz);
      if (!best || d < best.d) best = { x, z, d };
    }
  return best;
}

test('groundY is the render height: plateau top on high ground, 0 below and on flat maps', () => {
  const t = new Terrain('dunes'), p = t.plateaus[0];
  assert.equal(groundY(t, p.x, p.z), H);
  assert.equal(groundY(t, p.x + p.r + 5, p.z), 0);
  assert.equal(groundY(new Terrain('classic'), 3, 4), 0);
  assert.equal(groundY(null, 3, 4), 0);
  assert.equal(groundY(t, NaN, 0), 0);
});

test('every building type placed on any plateau sits on the top, footprint flat and clear of the cliff; the ghost is drawn above it', () => {
  let checked = 0;
  for (const id of PLATEAU_MAPS) {
    const t = new Terrain(id);
    t.plateaus.forEach((p, k) => {
      for (const type of BUILDINGS) {
        const r = D[type].radius, site = siteOnTop(t, p, r);
        if (!site) continue;
        const where = `${id} plateau ${k} ${type} at ${site.x},${site.z}`;
        assert.equal(t.level(site.x, site.z), 1, where);
        assert.ok(Math.abs(groundY(t, site.x, site.z) - H) < 1e-9, `${where}: drawn at the top (${groundY(t, site.x, site.z)})`);
        // The whole footprint (and 1 m round it) is the flat top: no building hangs over the cliff edge.
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, x = site.x + Math.cos(a) * (r + 1), z = site.z + Math.sin(a) * (r + 1);
          assert.equal(t.level(x, z), 1, `${where}: footprint edge ${i} on the top`);
          assert.ok(Math.abs(t.heightAt(x, z) - H) < 1e-9, `${where}: footprint edge ${i} flat (${t.heightAt(x, z)})`);
        }
        const ghost = placeOnGround(stub(), t, site.x, site.z, GHOST_LIFT);
        assert.ok(Math.abs(ghost.position.y - (H + GHOST_LIFT)) < 1e-9 && ghost.position.x === site.x && ghost.position.z === site.z, `${where}: ghost at ${ghost.position.y}`);
        checked++;
      }
    });
  }
  assert.ok(checked > 100, `checked ${checked} placements`);
});

test('on low ground the ghost and buildings stay where they were (flat maps unchanged)', () => {
  for (const id of ['classic', 'dunes']) {
    const t = new Terrain(id), x = t.plateaus.length ? t.plateaus[0].x : 10, z = t.plateaus.length ? t.plateaus[0].z + t.plateaus[0].r + 9 : 10;
    assert.equal(t.level(x, z), 0);
    assert.equal(placeOnGround(stub(), t, x, z, GHOST_LIFT).position.y, GHOST_LIFT, id);
    assert.equal(placeOnGround(stub(), t, x, z).position.y, 0, id);
  }
});

test('a building on a plateau, finished or under construction, is reachable up a ramp and keeps its height after save and load', () => {
  const s = new Simulation({ ai: false, map: 'dunes' }), t = s.terrain;
  const hq = s.own(0).find((e) => e.type === 'hq');
  const p = t.plateaus.slice().sort((a, b) => Math.hypot(a.x - hq.x, a.z - hq.z) - Math.hypot(b.x - hq.x, b.z - hq.z))[0];
  s.visible[0].fill(1); s.explored[0].fill(1);
  s.players[0].alloy = s.players[0].energy = 9999;
  const worker = s.own(0).find((e) => e.type === 'worker');
  const at = s.findPlacement('barracks', 0, p.x, p.z);
  assert.ok(at && t.level(at.x, at.z) === 1, `a Barracks site on top: ${JSON.stringify(at)}`);
  const b = s.build(worker.id, 'barracks', at.x, at.z);
  assert.ok(b, 'the Harvester takes the order (a route up a ramp exists)');
  assert.equal(b.complete, false);
  const tower = s.spawn('tower', 0, ...Object.values(s.findPlacement('tower', 0, p.x + 5, p.z)));
  const L = Simulation.load(s.serialize());
  for (const id of [b.id, tower.id]) {
    const e = L.get(id);
    assert.equal(L.terrain.level(e.x, e.z), 1, `${e.type} still on the top after load`);
    assert.equal(groundY(L.terrain, e.x, e.z), H);
  }
  assert.equal(L.get(b.id).complete, false);
});

// W14: capture-point rings (capture-view.js) were drawn at a fixed 0.1 m and deposits (view.js createResource)
// at 0 m, so on a plateau top they sank inside it. Both now take the ground height (the browser half, the
// crystals on Mirror Lake's island, is in tests/terrain.mjs).
test('capture rings sit 0.1 m above the ground under them, on a plateau top too', async () => {
  const { CaptureRings } = await import('../src/capture-view.js');
  const t = new Terrain('dunes'), p = t.plateaus[0], scene = { add() {}, remove() {} };
  const rings = new CaptureRings(scene);
  const points = { top: { x: p.x, z: p.z, r: 3 }, low: { x: p.x + p.r + 6, z: p.z, r: 3 } };
  rings.update({ terrain: t, mission: { points }, capture: {}, time: 0, entities: [] }, [0x44aaff, 0xff6644], true);
  assert.ok(Math.abs(rings.rings.get('top').position.y - (H + 0.1)) < 1e-9, `top ring at ${rings.rings.get('top').position.y}`);
  assert.ok(Math.abs(rings.rings.get('low').position.y - 0.1) < 1e-9, 'low ring unchanged');
  rings.clear();
});
