// Campaign-only battlefields (src/campaign-maps.json, "campaign": true): a large plateau with ramps where the
// player can raise a Sentinel tower that shoots down at attackers. They are not Skirmish maps and no old map or
// fingerprint changes (tests/maps-variety.test.js pins those).
import test from "node:test";
import assert from "node:assert/strict";
import CAMPAIGN from "../src/campaign-maps.json" with { type: "json" };
import { Terrain, MAPS, MAP_BLURBS, TERRAIN } from "../src/terrain.js";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { lookOf, themeFor } from "../src/visual-style.js";
import { flavourFor } from "../src/audio-logic.js";

const IDS = Object.keys(CAMPAIGN);
// The biggest hill of a map and the camp of the player (team 0).
const hillOf = (t) => t.plateaus.reduce((a, b) => (b.r > a.r ? b : a));
const startOf = (id) => { const s = new Simulation({ map: id, enemyCount: 1, ai: false }); return { s, hq: s.entities.find((e) => e.type === "hq" && e.team === 0) }; };

test("campaign maps exist, are flagged and stay out of Skirmish", () => {
  // Mirror Lake (2026-11 map variety): the first map with a lake, an island hill in the middle of it.
  assert.deepEqual(IDS.sort(), ["gunhills", "highridge", "mirrorlake"]);
  for (const id of IDS) {
    assert.equal(CAMPAIGN[id].campaign, true, id);
    assert.ok(!(id in MAPS) && !(id in MAP_BLURBS), `${id} must not be in the Skirmish picker`);
    assert.equal(new Terrain(id).id, id, "still buildable by id");
    assert.ok(["highlands", "dunes", "riverlands"].includes(lookOf(id)), `${id} look`);
    assert.equal(themeFor(id), themeFor(CAMPAIGN[id].look));
    assert.equal(flavourFor(id), flavourFor(CAMPAIGN[id].look));
  }
});

test("each campaign map has a plateau at least 24 m across with two or more ramps", () => {
  for (const id of IDS) {
    const t = new Terrain(id), hill = hillOf(t);
    assert.ok(hill.r * 2 >= 24, `${id} hill ${hill.r * 2} m`);
    assert.ok(hill.ramps.length >= 2, `${id} ramps`);
    for (const ramp of hill.ramps) assert.ok(t.canStand(ramp.x, ramp.z, 0.5), `${id} ramp at (${ramp.x.toFixed(1)}, ${ramp.z.toFixed(1)}) walkable`);
  }
});

test("camps, deposits and the hill top are on open ground, and both camps can walk up", () => {
  for (const id of IDS) {
    const { s, hq } = startOf(id), t = s.terrain, hill = hillOf(t);
    assert.equal(t.level(hq.x, hq.z), 0, `${id} camp on the flat`);
    for (const r of s.resources) assert.ok(t.canStand(r.x, r.z, 0.5) && !t.cliff(r.x, r.z, 1.5), `${id} deposit ${r.type} at (${r.x}, ${r.z})`);
    const worker = s.entities.find((e) => e.type === "worker" && e.team === 0);
    assert.ok(s.nav.path(worker, { x: hill.x, z: hill.z }, 0.55).length, `${id} worker can climb the hill`);
    const enemy = s.entities.find((e) => e.type === "hq" && e.team === 1);
    assert.equal(s.nav.path(worker, { x: enemy.x, z: enemy.z + 6 }, 0.55).length > 0, true, `${id} the camps connect`);
  }
});

test("the player can place and start a Sentinel tower on the plateau (and not on its cliff or ramps)", () => {
  for (const id of IDS) {
    const { s } = startOf(id), t = s.terrain, hill = hillOf(t);
    const worker = s.entities.find((e) => e.type === "worker" && e.team === 0);
    // The top of a hill is out of sight from below until one of ours stands on it (sim/vision).
    assert.equal(s.placement("tower", 0, hill.x, hill.z), "Explore this area before building.", `${id} hidden top`);
    worker.x = hill.x + 3; worker.z = hill.z + 3; s.updateVision();
    assert.equal(s.placement("tower", 0, hill.x, hill.z), "", `${id} top is buildable`);
    assert.equal(s.placement("tower", 0, hill.x + hill.r - 1, hill.z), "Keep cliffs and ramps clear.", `${id} cliff`);
    const ramp = hill.ramps[0];
    assert.equal(s.placement("tower", 0, ramp.x, ramp.z), "Keep cliffs and ramps clear.", `${id} ramp`);
    s.players[0].alloy = 9999; s.players[0].energy = 9999;
    const tower = s.build(worker.id, "tower", hill.x, hill.z);
    assert.ok(tower && tower.type === "tower" && t.level(tower.x, tower.z) === 1, `${id} tower stands on the plateau`);
  }
});

test("a tower on the hill out-ranges and out-damages an identical tower below", () => {
  for (const id of IDS) {
    const s = new Simulation({ map: id, enemyCount: 1, ai: false }), t = s.terrain, hill = hillOf(t);
    const up = s.spawn("tower", 0, hill.x, hill.z), down = s.spawn("tower", 1, hill.x, hill.z + hill.r + 6);
    assert.equal(t.level(up.x, up.z), 1); assert.equal(t.level(down.x, down.z), 0);
    assert.equal(s.heightRange(up, down), TERRAIN.high_range);
    assert.equal(s.heightRange(down, up), 0);
    up.shield = down.shield = 0;
    const base = up.damage;
    let before = down.hp; s.hit(up, down);
    assert.ok(Math.abs(before - down.hp - base * TERRAIN.high_damage) < 1e-9, `${id} extra damage down`);
    before = up.hp; s.hit(down, up);
    assert.ok(Math.abs(before - up.hp - down.damage * TERRAIN.low_damage) < 1e-9, `${id} less damage up`);
    assert.ok(base * TERRAIN.high_damage > down.damage * TERRAIN.low_damage);
  }
});

test("in play the hill tower hits an attacker the lower tower cannot answer", () => {
  for (const id of IDS) {
    const s = new Simulation({ map: id, enemyCount: 1, ai: false }), t = s.terrain, hill = hillOf(t);
    // A tower four metres inside the rim (in sight of the flat) and its twin on the flat just beyond the extra reach.
    const ux = hill.x, uz = hill.z + hill.r - 4;
    const up = s.spawn("tower", 0, ux, uz);
    const gap = D.tower.range + TERRAIN.high_range - 0.5;
    const down = s.spawn("tower", 1, ux, uz + gap + D.tower.radius);
    assert.equal(t.level(down.x, down.z), 0, `${id} low tower on the flat`);
    up.shield = down.shield = 0;
    const hp = [up.hp, down.hp];
    for (let i = 0; i < 80; i++) s.tick(0.1);
    assert.ok(down.hp < hp[1], `${id} the low tower was hit from the hill`);
    assert.equal(up.hp, hp[0], `${id} the hill tower was never hit back`);
  }
});
