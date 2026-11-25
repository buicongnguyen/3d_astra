// R3 map variety: six new Skirmish maps on optional maps.json fields (rivers, rocks, roads, deposits, symmetry,
// look, dressing, blurb, plateau mirror "quad"). The seven old maps (and the Defence maps) must build and
// play exactly as before: their terrain and match fingerprints were recorded on feat/aaa-round3 (6ef4261)
// before the engine grew those fields. Each new map is checked for determinism, symmetry, equal starts,
// clear ground under every deposit, camp and ring, and routes from every camp to all of them.
import test from "node:test";
import assert from "node:assert/strict";
import MAPS_JSON from "../src/maps.json" with { type: "json" };
import { Terrain, MAPS, reflect } from "../src/terrain.js";
import { Simulation } from "../src/simulation.js";
import { lookOf, themeFor } from "../src/visual-style.js";
import { flavourFor } from "../src/audio-logic.js";
import { crossingAt } from "../src/terrain-labels.js";
import { terrainFingerprint, matchFingerprint } from "./lib/map-fingerprint.mjs";

const OLD = {
  classic: { terrain: "f05de4ed", x1: "0806e98d", x2: "c09a1efe", x3: "c76fc4a6", ai90: "bc91a194" },
  riverlands: { terrain: "67ba5229", x1: "4bb4f2dd", x2: "a1baf9ce", x3: "87dac8d6", ai90: "de537b7f" },
  basin: { terrain: "4e2438a4", x1: "65dacecc", x2: "4c23cd49", x3: "68eaae55", ai90: "d83be270" },
  expanse: { terrain: "14ec7f8e", x1: "f492b49e", x2: "5cf06b5d", x3: "7d3c1878", ai90: "c2ca7d09" },
  // Hills mix (2026-11-25, owner: "some hills will be round, some will be rectangles"): the Dunes mesas
  // (discs, terrain ae19ad5a, ai90 c362f122) and the Woodlands bluffs (sharp boxes, terrain 1aaa104f) are
  // rounded boxes now. Their starts are unchanged; the Dunes 90 s AI match moved.
  dunes: { terrain: "385899e8", x1: "c593782e", x2: "9b7bef0e", x3: "d84260a3", ai90: "1ae4e355" },
  woodlands: { terrain: "3a446af1", x1: "e8dbe0a3", x2: "b7ae243b", x3: "d0f10431", ai90: "0a266283" },
  highlands: { terrain: "e7a6831b", x1: "654a2526", x2: "6213c64a", x3: "f6621fb4", ai90: "5595918a" },
};
const DEFENCE = { gorge: "ac9df034", bridges: "653c7ad6", switchback: "48d5e73f", fordwood: "54f79148", canyon: "d85e7204", longcrossing: "f4007a88", crossroads: "70449f4c" };
const NEW = ["heartland", "dryreach", "twinrivers", "ironback", "crownmesa", "steppe"];
const close = (a, b) => Math.abs(a - b) < 1e-9;

test("the old maps and the Defence maps build exactly as before (terrain fingerprints)", () => {
  for (const [id, pin] of Object.entries(OLD)) assert.equal(terrainFingerprint(id), pin.terrain, id);
  for (const [id, pin] of Object.entries(DEFENCE)) assert.equal(terrainFingerprint(id), pin, id);
});

test("the old maps start and play exactly as before (1-3 rivals, 90 s of AI play)", () => {
  for (const [id, pin] of Object.entries(OLD)) {
    const { terrain, ...match } = pin;
    assert.deepEqual(matchFingerprint(id), match, id);
  }
});

test("the old maps keep their old fields: no new optional field on them", () => {
  for (const id of Object.keys(OLD))
    for (const key of ["rivers", "rocks", "roads", "deposits", "symmetry", "look", "dressing", "blurb"]) assert.ok(!(key in MAPS_JSON[id]), `${id}.${key}`);
});

test("reflect() gives each mirror once", () => {
  assert.deepEqual(reflect(3, 4), [[3, 4], [-3, -4]]);
  assert.deepEqual(reflect(3, 4, "quad"), [[3, 4], [-3, -4], [-3, 4], [3, -4]]);
  assert.deepEqual(reflect(5, 0, "quad"), [[5, 0], [-5, 0]]);
  assert.deepEqual(reflect(0, 0, "quad"), [[0, 0]]);
});

test("six new maps, offered in the Skirmish picker with a short name and the size, within 96-192 m", () => {
  for (const id of NEW) {
    const m = MAPS_JSON[id];
    assert.ok(m, id);
    assert.equal(MAPS[id], `${m.name} · ${m.size}×${m.size}`);
    assert.ok(m.size >= 96 && m.size <= 192 && m.size % 32 === 0, `${id} size ${m.size}`);
    assert.ok(m.name.length <= 15, `${id} name "${m.name}" is short`);
    assert.ok(m.blurb && m.blurb.length <= 48, `${id} blurb`);
    // Drawn in an existing land's colours, music and dressing.
    assert.ok(["classic", "riverlands", "basin", "expanse", "dunes", "woodlands", "highlands"].includes(lookOf(id)), id);
    assert.equal(themeFor(id), themeFor(m.look));
    assert.equal(flavourFor(id), flavourFor(m.look));
  }
});

test("new maps build the same way every time", () => {
  for (const id of NEW) {
    assert.equal(terrainFingerprint(id), terrainFingerprint(id), id);
    for (const enemyCount of [1, 3]) assert.equal(new Simulation({ map: id, enemyCount, capturePoints: true }).hash(), new Simulation({ map: id, enemyCount, capturePoints: true }).hash(), `${id} x${enemyCount}`);
  }
});

test("new maps are symmetric for four camps: terrain, deposits and camps mirror on both axes", () => {
  for (const id of NEW) {
    const t = new Terrain(id), s = new Simulation({ map: id, enemyCount: 3 });
    for (let z = -t.half + 0.25; z < t.half; z += 1.5)
      for (let x = -t.half + 0.25; x < t.half; x += 1.5) {
        // What play reads: water, crossings, roads (Sunward's bonus), banks, standing, height, cliffs and ramps.
        // The ground's colour patches (grass, sand, dirt) are paint only and need not mirror.
        const look = (x, z) => { const a = t.at(x, z); return [["water", "ford", "bridge", "road", "mud"].includes(a) ? a : "land", t.canStand(x, z, 0.55), t.level(x, z), t.cliff(x, z), t.onRamp(x, z)].join(); };
        const here = look(x, z);
        assert.equal(look(-x, z), here, `${id} x-mirror at ${x},${z}`);
        assert.equal(look(x, -z), here, `${id} z-mirror at ${x},${z}`);
      }
    const key = (r) => `${r.type}:${r.amount}`;
    for (const r of s.resources)
      for (const [sx, sz] of [[-1, 1], [1, -1]])
        assert.ok(s.resources.some((o) => key(o) === key(r) && close(o.x, r.x * sx) && close(o.z, r.z * sz)), `${id}: ${key(r)} at ${r.x},${r.z} has its mirror`);
    for (const e of s.entities.filter((e) => e.team === 0))
      for (const team of [1, 2, 3])
        assert.ok(s.entities.some((o) => o.team === team && o.type === e.type && close(Math.abs(o.x), Math.abs(e.x)) && close(Math.abs(o.z), Math.abs(e.z))), `${id}: team ${team} has the ${e.type}`);
  }
});

test("new maps: every camp starts as far from the centre and from its rivals as its mirror", () => {
  for (const id of NEW) {
    const s = new Simulation({ map: id, enemyCount: 3 }), hq = [0, 1, 2, 3].map((team) => s.entities.find((e) => e.team === team && e.type === "hq"));
    const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), r = hq.map((h) => Math.hypot(h.x, h.z));
    for (const v of r) assert.ok(close(v, r[0]), `${id} centre distances ${r}`);
    assert.ok(close(d(hq[0], hq[1]), d(hq[2], hq[3])) && close(d(hq[0], hq[2]), d(hq[1], hq[3])) && close(d(hq[0], hq[3]), d(hq[1], hq[2])), id);
    // The 1v1 rival is the far corner: at least 90 m away on every map.
    assert.ok(d(hq[0], hq[1]) >= 90, `${id} 1v1 distance ${d(hq[0], hq[1])}`);
  }
});

test("new maps: deposits, camps and rings stand on clear, level ground, apart from each other", () => {
  for (const id of NEW)
    for (const enemyCount of [1, 2, 3]) {
      const s = new Simulation({ map: id, enemyCount, capturePoints: true }), t = s.terrain;
      for (const r of s.resources) {
        assert.ok(t.canStand(r.x, r.z, r.radius) && !t.onRamp(r.x, r.z, r.radius + 1), `${id}: deposit ${r.x},${r.z} on clear ground`);
        assert.ok(!t.riverNear(r.z, 6), `${id}: deposit ${r.x},${r.z} off the banks`);
        for (const o of s.resources) if (o !== r) assert.ok(Math.hypot(o.x - r.x, o.z - r.z) >= 3.4, `${id}: deposits ${r.x},${r.z} and ${o.x},${o.z} overlap`);
        for (const b of s.entities.filter((e) => e.kind === "building")) assert.ok(Math.hypot(b.x - r.x, b.z - r.z) >= b.radius + r.radius + 1, `${id}: deposit ${r.x},${r.z} under the ${b.type}`);
      }
      for (const e of s.entities.filter((e) => e.team >= 0)) assert.ok(t.canStand(e.x, e.z, e.radius) && !t.level(e.x, e.z), `${id}: ${e.type} of team ${e.team} on open low ground`);
      for (const b of s.entities.filter((e) => e.kind === "building")) assert.equal(t.placement(b.x, b.z, b.radius), "", `${id}: ${b.type} placement`);
      const rings = Object.values(s.skirmishPoints);
      assert.ok(rings.length >= (enemyCount === 1 ? 3 : 1), `${id} x${enemyCount}: ${rings.length} capture points`);
      for (const p of rings) assert.ok(t.canStand(p.x, p.z, 1.5), `${id}: ring ${p.x},${p.z}`);
      assert.equal(s.entities.filter((e) => e.kind === "wall").length, 0, `${id}: no concrete walls (natural terrain only)`);
    }
});

test("new maps: every deposit, ring and camp is reachable from every camp, also by the widest vehicle", () => {
  for (const id of NEW) {
    const s = new Simulation({ map: id, enemyCount: 3, capturePoints: true }), nav = s.nav, { comp } = nav.regions();
    const regionOf = (x, z) => { const [cx, cz] = nav.cellAt(x, z), c = nav.nearest(cx, cz); return c ? comp[c[1] * nav.grid + c[0]] : -1; };
    const camps = s.entities.filter((e) => e.type === "hq"), home = regionOf(camps[0].x + 0, camps[0].z - 6);
    const targets = [...s.resources, ...Object.values(s.skirmishPoints), ...camps.map((c) => ({ x: c.x, z: c.z - Math.sign(c.z) * 6 }))];
    assert.ok(home >= 0, id);
    for (const p of targets) assert.equal(regionOf(p.x, p.z), home, `${id}: ${p.x},${p.z} is connected to the camps`);
    // A Walker (1.2 m, the widest ground unit) finds a route from each camp's front to every deposit and ring.
    for (const c of camps) {
      const from = { x: c.x, z: c.z - Math.sign(c.z) * 7 };
      for (const p of [...s.resources, ...Object.values(s.skirmishPoints)]) {
        const near = { x: p.x - Math.sign(p.x || 1) * 2.5, z: p.z };
        assert.ok(nav.path(from, near, 1.2).length > 0, `${id}: a Walker from team ${c.team} reaches ${p.x},${p.z}`);
      }
    }
  }
});

test("new river map: two rivers, each crossed by two bridges and two fords; fords slow, labels name them; a ridge splits each bank", () => {
  const t = new Terrain("twinrivers");
  assert.equal(t.rivers.length, 2);
  for (const river of t.rivers) {
    assert.deepEqual(river.crossings.map((c) => c.type), ["bridge", "ford", "ford", "bridge"]);
    for (const c of river.crossings) {
      assert.ok(t.canStand(c.x, river.z, 0.55), `crossing at ${c.x},${river.z} can be stood on`);
      assert.equal(crossingAt(t, c.x, river.z)?.type, c.type);
      assert.ok(t.canTraverse({ x: c.x, z: river.z - 6 }, { x: c.x, z: river.z + 6 }, 1.05), `a tank crosses at ${c.x},${river.z}`);
    }
    assert.ok(!t.canStand(-32, river.z, 0.55) && !t.canStand(0, river.z, 0.55) && !t.canStand(65, river.z, 0.55), "open water between the crossings");
    assert.match(t.placement(-32, river.z + 6, 1.5), /river banks/);
  }
  const s = new Simulation({ map: "twinrivers", enemyCount: 1 });
  assert.ok(s.inFord({ x: -16, z: 22 }) && s.inFord({ x: 16, z: -22 }) && !s.inFord({ x: -50, z: 22 }) && !s.inFord({ x: -16, z: 0 }));
  assert.equal(t.at(-50, 0), "road");
  // The ridge between the two camps on each bank runs from the river to the map edge: no way round it on land.
  for (let z = 23; z < t.half; z += 0.5) assert.ok(!t.canStand(-3.5, z, 0.55) && !t.canStand(-3.5, -z, 0.55), `ridge closed at ${z}`);
});

test("new maps: the shapes that make each style", () => {
  const sim = (id) => new Simulation({ map: id, enemyCount: 1 });
  const value = (s, filter) => s.resources.filter(filter).reduce((n, r) => n + r.amount, 0);
  const centre = (r) => Math.hypot(r.x, r.z) < 20;
  // Golden Heart: the rich heart is worth more than both camps' fields (all within 35 m of each core) together.
  const heart = sim("heartland");
  assert.ok(value(heart, centre) > 2 * value(heart, (r) => Math.hypot(r.x + 41, r.z - 40) < 35));
  // Dry Reach: smaller deposits, and less at home than on the old maps.
  assert.ok(sim("dryreach").resources.every((r) => r.amount <= 2000));
  // Crown Mesa: the rich deposits are on the mesa top.
  const mesa = sim("crownmesa");
  assert.ok(mesa.resources.filter(centre).length === 8 && mesa.resources.filter(centre).every((r) => mesa.terrain.level(r.x, r.z) === 1));
  // Ironback: one pass in the middle, a flank on each side, ridges you can climb.
  const iron = new Terrain("ironback");
  assert.ok(iron.canStand(0, 0, 1.2) && iron.cliff(-30, 4) && iron.cliff(-30, -4) && iron.canStand(-74, 0, 1.2) && iron.canStand(74, 0, 1.2));
  assert.ok(iron.level(-30, 0) === 1 && iron.plateaus.every((p) => p.ramps.length >= 2), "the ridges have tops you climb by ramps");
  // Open Steppe: closer camps than any other map of its size, no water, no walls.
  const steppe = sim("steppe"), hq = steppe.entities.find((e) => e.type === "hq" && e.team === 0);
  assert.ok(Math.hypot(hq.x, hq.z) < Math.hypot(37, 36) && !steppe.terrain.river);
});
