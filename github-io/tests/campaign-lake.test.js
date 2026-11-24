// Mirror Lake (2026-11 map variety): the first map with real standing water. src/terrain.js reads a map's
// "lakes" (a round lake, optionally a ring round an island, with wadeable ford strips); maps without lakes build
// exactly as before (tests/maps-variety.test.js pins the Skirmish and Defence fingerprints).
import test from "node:test";
import assert from "node:assert/strict";
import MAPS_JSON from "../src/maps.json" with { type: "json" };
import DEFENCE from "../src/defence/maps.json" with { type: "json" };
import CAMPAIGN from "../src/campaign-maps.json" with { type: "json" };
import { Terrain } from "../src/terrain.js";
import { Simulation } from "../src/simulation.js";

const LAKE = CAMPAIGN.mirrorlake.lakes[0];
const polar = (deg, d) => [Math.cos((deg * Math.PI) / 180) * d, Math.sin((deg * Math.PI) / 180) * d];

test("only Mirror Lake has a lake; every other map's Terrain has none", () => {
  for (const id of [...Object.keys(MAPS_JSON), ...Object.keys(DEFENCE), "highridge", "gunhills"]) assert.deepEqual(new Terrain(id).lakes, [], id);
  const t = new Terrain("mirrorlake");
  assert.equal(t.lakes.length, 1);
  assert.equal(t.river, false, "no river: river systems (fish, bridges, labels) stay off");
  assert.equal(t.lakes[0].fords.length, 4);
});

test("open water blocks, fords wade, the island top and the shore are dry", () => {
  const t = new Terrain("mirrorlake"), mid = (LAKE.island + LAKE.r) / 2;
  for (const deg of [0, 90, 180, 270]) {
    const [x, z] = polar(deg, mid);
    assert.equal(t.at(x, z), "water", `${deg}°`);
    assert.equal(t.canStand(x, z, 0.5), false, `${deg}° water blocks`);
  }
  for (const f of LAKE.fords) {
    const [x, z] = polar(f.angle, mid);
    assert.equal(t.at(x, z), "ford", `${f.angle}° ford`);
    assert.ok(t.canStand(x, z, 0.55), `${f.angle}° ford wadeable`);
    // The strip's edge: a unit wider than what is left of the strip touches water.
    const [ex, ez] = [x + Math.cos(((f.angle + 90) * Math.PI) / 180) * (f.width / 2 - 0.3), z + Math.sin(((f.angle + 90) * Math.PI) / 180) * (f.width / 2 - 0.3)];
    assert.equal(t.canStand(ex, ez, 0.55), false, `${f.angle}° ford edge`);
  }
  assert.equal(t.level(0, 0), 1, "the island is a hill");
  assert.ok(t.canStand(0, 0, 0.55));
  const [sx, sz] = polar(0, LAKE.r + 1.5);
  assert.equal(t.at(sx, sz), "sand", "a sandy shore");
  assert.ok(t.canStand(sx, sz, 0.55));
  // A straight walk across open water is refused; along a ford it is allowed.
  assert.equal(t.canTraverse({ x: -LAKE.r - 3, z: 0 }, { x: -LAKE.island + 0.5 - 2, z: 0 }), false);
  const [a, b] = [polar(135, LAKE.r + 2), polar(135, LAKE.island + 0.3)];
  assert.ok(t.canTraverse({ x: a[0], z: a[1] }, { x: b[0], z: b[1] }), "ford to the ramp foot");
});

test("nothing is built on the shore or in the water, and the drawn bed is cut only under open water", () => {
  const t = new Terrain("mirrorlake");
  assert.equal(t.placement(...polar(10, LAKE.r + 1), 2), "Keep river banks and crossing approaches clear.");
  assert.equal(t.placement(...polar(135, LAKE.r - 2), 1), "Keep river banks and crossing approaches clear.");
  assert.equal(t.placement(...polar(10, LAKE.r + 6), 2), "");
  assert.equal(t.lakeBed(...polar(0, (LAKE.island + LAKE.r) / 2)), 0.5);
  assert.equal(t.lakeBed(...polar(135, (LAKE.island + LAKE.r) / 2)), 0, "fords are level");
  assert.equal(t.lakeBed(...polar(0, LAKE.r + 2)), 0, "dry ground beyond a metre out");
  assert.ok(t.lakeBed(...polar(0, LAKE.r + 0.5)) > 0 && t.lakeBed(...polar(0, LAKE.r + 0.5)) < 0.5, "the bank eases down");
});

test("both camps reach the island by a ford and each other round the lake; deposits stand on dry ground", () => {
  const s = new Simulation({ map: "mirrorlake", enemyCount: 1, ai: false }), t = s.terrain;
  for (const team of [0, 1]) {
    const worker = s.entities.find((e) => e.type === "worker" && e.team === team);
    const path = s.nav.path(worker, { x: 0, z: 0 }, 0.55);
    assert.ok(path.length, `team ${team} reaches the island`);
    assert.ok(path.every((p) => t.canStand(p.x, p.z, 0.3)), `team ${team} path stays out of the water`);
  }
  // Round the lake, with the island fords closed: still a way between the camps.
  const dry = new Simulation({ map: "mirrorlake", enemyCount: 1, ai: false });
  dry.terrain.lakes[0].fords = [];
  dry.nav.rebuild(dry.entities);
  const w = dry.entities.find((e) => e.type === "worker" && e.team === 0), enemy = dry.entities.find((e) => e.type === "hq" && e.team === 1);
  assert.ok(dry.nav.path(w, { x: enemy.x - 6, z: enemy.z + 6 }, 0.55).length, "the camps connect round the shore");
  assert.equal(dry.nav.path(w, { x: 0, z: 0 }, 0.55).length, 0, "without fords the island is cut off");
  for (const r of s.resources) assert.ok(t.canStand(r.x, r.z, 0.5) && !t.inWater(r.x, r.z, r.radius + 1), `deposit ${r.type} at (${r.x}, ${r.z})`);
  assert.ok(s.resources.filter((r) => t.level(r.x, r.z) === 1).length === 2, "the island holds two deposits worth taking");
});
