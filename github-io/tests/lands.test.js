// W9 new lands (roadmap 2026-11-25): Snow (Frostmere), Volcano (Ember Crown) and the Isles (Coral Isles), each its own
// land (palette, light, ground, dressing, life, music) and a Skirmish map on it, plus the Ancient ruins dressing and
// centrepiece. The checks of tests/maps-variety.test.js for the R3 maps run here on the three new maps: determinism,
// four-way symmetry, equal starts, clear ground under every deposit, camp and ring, and routes for the widest ground
// unit. Then the rules each land reuses: the frozen lake's ice fords wade slowly, lava is water (impassable, bridged),
// and the isles' plank bridges (lake strips of type "bridge") are walked at full speed.
import test from "node:test";
import assert from "node:assert/strict";
import MAPS_JSON from "../src/maps.json" with { type: "json" };
import CAMPAIGN_MAPS from "../src/campaign-maps.json" with { type: "json" };
import { Terrain, MAPS, reflect } from "../src/terrain.js";
import { Simulation } from "../src/simulation.js";
import { lookOf, themeFor, lightFor } from "../src/visual-style.js";
import { flavourFor } from "../src/audio-logic.js";
import { LANDS, landOf, LAND_IDS } from "../src/lands.js";
import { DRESSING, planScatter, RUIN_KINDS, centrepieceProps } from "../src/scatter.js";
import { LIFE } from "../src/ambient-life.js";
import { terrainFingerprint } from "./lib/map-fingerprint.mjs";
import vi from "../src/locales/vi.json" with { type: "json" };
import ko from "../src/locales/ko.json" with { type: "json" };

const NEW = ["snowfield", "volcano", "archipelago"];
const close = (a, b) => Math.abs(a - b) < 1e-9;

test("three new lands, each with its own Skirmish map in the picker (short EN name, VI and KO names and blurbs)", () => {
  assert.deepEqual(LAND_IDS, NEW);
  for (const id of NEW) {
    const m = MAPS_JSON[id], land = LANDS[id];
    assert.ok(m && land, id);
    assert.equal(MAPS[id], `${m.name} · ${m.size}×${m.size}`);
    assert.ok(m.size >= 96 && m.size <= 192 && m.size % 32 === 0, `${id} size`);
    assert.ok(m.name.length <= 15 && m.blurb && m.blurb.length <= 48, id);
    assert.equal(m.biome, land.biome, `${id}: the map's ground rule is its land's`);
    // Its own look: not borrowed, so the palette, light, music and dressing are new.
    assert.equal(lookOf(id), id);
    assert.ok(DRESSING[id] && LIFE[id], `${id}: own dressing and ambient life`);
    assert.notEqual(flavourFor(id), flavourFor("riverlands"), `${id}: own music flavour`);
    assert.ok(lightFor(id).time && !/night/i.test(lightFor(id).time), `${id}: a daylight time of day`);
    for (const text of [m.name, m.blurb]) {
      assert.ok(vi.messages[text], `${id}: VI for "${text}"`);
      assert.ok(ko.messages[text], `${id}: KO for "${text}"`);
    }
    assert.equal(landOf(new Terrain(id)), land);
  }
  // Old maps and campaign maps are on no new land unless they ask for one.
  for (const id of Object.keys(MAPS_JSON).filter((id) => !NEW.includes(id))) assert.equal(landOf(new Terrain(id)), null, id);
  for (const id of Object.keys(CAMPAIGN_MAPS)) if (!NEW.includes(CAMPAIGN_MAPS[id].look)) assert.equal(landOf(new Terrain(id)), null, id);
});

test("new lands build the same way every time", () => {
  for (const id of NEW) {
    assert.equal(terrainFingerprint(id), terrainFingerprint(id), id);
    for (const enemyCount of [1, 3]) assert.equal(new Simulation({ map: id, enemyCount, capturePoints: true }).hash(), new Simulation({ map: id, enemyCount, capturePoints: true }).hash(), `${id} x${enemyCount}`);
  }
});

test("new lands are symmetric for four camps: terrain, deposits and camps mirror on both axes", () => {
  for (const id of NEW) {
    const t = new Terrain(id), s = new Simulation({ map: id, enemyCount: 3 });
    for (let z = -t.half + 0.25; z < t.half; z += 1.5)
      for (let x = -t.half + 0.25; x < t.half; x += 1.5) {
        const look = (x, z) => { const a = t.at(x, z); return [["water", "ford", "bridge", "road", "mud"].includes(a) ? a : "land", t.canStand(x, z, 0.55), t.level(x, z), t.cliff(x, z), t.onRamp(x, z), t.inLakeFord(x, z)].join(); };
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
    const hq = [0, 1, 2, 3].map((team) => s.entities.find((e) => e.team === team && e.type === "hq"));
    assert.ok(Math.hypot(hq[0].x - hq[1].x, hq[0].z - hq[1].z) >= 90, `${id}: 1v1 distance`);
  }
});

test("new lands: deposits, camps and rings stand on clear, level ground, apart from each other", () => {
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
      assert.equal(s.entities.filter((e) => e.kind === "wall").length, 0, `${id}: no concrete walls`);
    }
});

test("new lands: every deposit, ring and camp is reachable from every camp, also by the widest vehicle", () => {
  for (const id of NEW) {
    const s = new Simulation({ map: id, enemyCount: 3, capturePoints: true }), nav = s.nav, { comp } = nav.regions();
    const regionOf = (x, z) => { const [cx, cz] = nav.cellAt(x, z), c = nav.nearest(cx, cz); return c ? comp[c[1] * nav.grid + c[0]] : -1; };
    const camps = s.entities.filter((e) => e.type === "hq"), home = regionOf(camps[0].x, camps[0].z - Math.sign(camps[0].z) * 6);
    const targets = [...s.resources, ...Object.values(s.skirmishPoints), ...camps.map((c) => ({ x: c.x, z: c.z - Math.sign(c.z) * 6 }))];
    assert.ok(home >= 0, id);
    for (const p of targets) assert.equal(regionOf(p.x, p.z), home, `${id}: ${p.x},${p.z} is connected to the camps`);
    for (const c of camps) {
      const from = { x: c.x, z: c.z - Math.sign(c.z) * 7 };
      for (const p of [...s.resources, ...Object.values(s.skirmishPoints)]) {
        const near = { x: p.x - Math.sign(p.x || 1) * 2.5, z: p.z };
        assert.ok(nav.path(from, near, 1.2).length > 0, `${id}: a Walker from team ${c.team} reaches ${p.x},${p.z}`);
      }
    }
  }
});

test("Frostmere: the frozen lake's ice roads are fords (slow, wadeable); the rest of the lake is open water", () => {
  const t = new Terrain("snowfield"), s = new Simulation({ map: "snowfield", enemyCount: 1 });
  const ice = { x: Math.cos(Math.PI / 4) * 18, z: Math.sin(Math.PI / 4) * 18 };
  assert.equal(t.at(ice.x, ice.z), "ford");
  assert.ok(t.canStand(ice.x, ice.z, 0.55) && t.inLakeFord(ice.x, ice.z) && s.inFord(ice));
  assert.equal(t.at(18, 0), "water");
  assert.ok(!t.canStand(18, 0, 0.55));
  // The ruin terrace is high ground with the crossroads ring on it.
  assert.equal(t.level(0, 0), 1);
  assert.ok(new Simulation({ map: "snowfield", capturePoints: true }).skirmishPoints.crossroads);
});

test("Ember Crown: lava channels are water (impassable) crossed only by bridges; lava pools block too", () => {
  const t = new Terrain("volcano");
  assert.equal(t.rivers.length, 2);
  for (const river of t.rivers) {
    assert.ok(river.crossings.every((c) => c.type === "bridge") && river.fords.length === 0, "no fords through lava");
    for (const c of river.crossings) assert.ok(t.canTraverse({ x: c.x, z: river.z - 6 }, { x: c.x, z: river.z + 6 }, 1.05), `a tank crosses at ${c.x},${river.z}`);
    assert.ok(!t.canStand(0, river.z, 0.55) && !t.canStand(-36, river.z, 0.55), "open lava between the bridges");
  }
  assert.ok(!t.canStand(-38, 0, 0.55) && !t.canStand(38, 0, 0.55), "lava pools");
  assert.equal(new Simulation({ map: "volcano", enemyCount: 1 }).inFord({ x: -18, z: 24 }), false, "a lava bridge is not a ford");
  assert.equal(t.level(0, 0), 1);
});

test("Coral Isles: islands linked by fords (slow) and plank bridges (full speed); four camp isles cannot walk to each other without a crossing", () => {
  const t = new Terrain("archipelago"), s = new Simulation({ map: "archipelago", enemyCount: 1 });
  const ford = { x: Math.cos(Math.PI / 4) * 30, z: Math.sin(Math.PI / 4) * 30 }, bridge = { x: 30, z: 0 };
  assert.equal(t.at(ford.x, ford.z), "ford");
  assert.ok(t.inLakeFord(ford.x, ford.z) && s.inFord(ford));
  assert.equal(t.at(bridge.x, bridge.z), "bridge");
  assert.ok(t.canStand(bridge.x, bridge.z, 1.05) && !t.inLakeFord(bridge.x, bridge.z) && !s.inFord(bridge), "a plank bridge is walked at full speed");
  assert.ok(!t.canStand(30, 6, 0.55), "open water beside the bridge");
  // The bridge from the centre isle reaches the edge islet through two lakes.
  assert.ok(t.canTraverse({ x: 14, z: 0 }, { x: 74, z: 0 }, 1.05));
  // Mostly sea: at least two fifths of the map is water.
  let water = 0, n = 0;
  for (let z = -t.half + 0.5; z < t.half; z += 1) for (let x = -t.half + 0.5; x < t.half; x += 1) { n++; if (t.at(x, z) === "water") water++; }
  assert.ok(water / n > 0.38, `water share ${(water / n).toFixed(2)}`);
  // An older lake strip without a type is still a ford.
  assert.equal(new Terrain("mirrorlake").lakes[0].fords.every((f) => !f.bridge), true);
});

test("Ancient ruins: a dressing family any land can take (maps.json `ruins`), and a centrepiece on each new land's ruin terrace", () => {
  for (const kind of RUIN_KINDS) assert.ok(NEW.some((id) => DRESSING[id].list.some(([k]) => k === kind)), `${kind} is used`);
  for (const id of NEW) {
    const t = new Terrain(id), props = planScatter(t), centre = centrepieceProps(t);
    assert.ok(centre.length >= 10, `${id}: centrepiece of ${centre.length} pieces`);
    for (const p of centre) {
      assert.ok(props.some((q) => q.kind === p.kind && q.x === p.x && q.z === p.z), `${id}: the centrepiece is in the one scatter mesh`);
      // On the terrace's rim (no unit stands there) or its foot, never on a ramp or the ring's floor.
      assert.ok(!t.onRamp(p.x, p.z, 0.6), `${id}: ${p.kind} at ${p.x.toFixed(1)},${p.z.toFixed(1)} on a ramp`);
      if (p.kind !== "ruinFloor") assert.ok(Math.hypot(p.x, p.z) > 5.4, `${id}: ${p.kind} inside the ring`);
    }
  }
  // Any map may ask for the family: the same land with `ruins` gets more ruin pieces, and nothing else changes.
  const plain = new Terrain("riverlands"), ruined = Object.assign(new Terrain("riverlands"), { ruins: 1 });
  const count = (t) => planScatter(t).filter((p) => RUIN_KINDS.includes(p.kind)).length;
  assert.equal(count(plain), 0);
  assert.ok(count(ruined) >= 12, `riverlands with ruins: ${count(ruined)} pieces`);
});

test("a mission map can be drawn on a new land: `biome` gives the ground rule, `look` the land's colours and dressing", () => {
  // As a campaign-maps.json entry would read: Highridge's layout with { look: "snowfield", biome: "snow" }.
  const t = new Terrain("highridge"), snowy = Object.assign(Object.create(Terrain.prototype), t, { biome: "snow" });
  const surfaces = new Set();
  for (let z = -40; z < 40; z += 3) for (let x = -40; x < 40; x += 3) surfaces.add(snowy.ground(x, z));
  assert.deepEqual([...surfaces].sort(), ["dirt", "grass", "stone"]);
  for (const id of NEW) assert.equal(LANDS[id].biome, MAPS_JSON[id].biome);
  assert.equal(reflect(1, 2).length, 2);
});
