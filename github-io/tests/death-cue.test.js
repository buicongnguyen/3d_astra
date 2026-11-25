// Readable deaths (src/death-cue-view.js): the plugin on a stand-in view (the browser suite tests/death-cue.mjs
// runs it in the game). Purely cosmetic: it reads the death event and the view's dying list, never the rules.
import test from "node:test";
import assert from "node:assert/strict";
import { DeathCueView, DEATH_CUE, addLostPing, LOST_PING, cueKind, floorSize, phoneShare } from "../src/death-cue-view.js";
import { VIEW_PLUGINS } from "../src/view-plugins.js";
import { CELL, FLAT, CELLS } from "../src/fx-kinds/cells.js";

function stage({ motion = true, reduced = false, level = 2, lowPower = true, kind = "infantry", team = 1 } = {}) {
  const spawned = [];
  const layer = (name) => ({ name });
  const fx = { glow: layer("glow"), smoke: layer("smoke"), particle(l, o) { const p = { layer: l.name, ...o }; spawned.push(p); return p; }, burst(l, n, at, o) { for (let i = 0; i < n; i++) spawned.push({ layer: l.name, ...o, puff: true }); } };
  const parts = [{ isMesh: true, visible: true, userData: {} }, { isMesh: true, visible: true, userData: { tint: [0.2, 0.18, 0.16] } }];
  const model = { position: { y: 0 }, rotation: { x: 0, y: 0, z: 0 }, traverse(fn) { parts.forEach(fn); } };
  const object = { position: { x: 3, y: 0, z: 4 }, visible: true, userData: { model } };
  const d = { id: 7, kind, team, x: 3, z: 4, age: 0, life: 2.4, tilt: 1, baseY: 0, object };
  const view = { fx, dying: [d], colors: [0x92ebc5, 0xef7660], unitsPerPixel: 0.06, lowPower, motionLevel: level, richMotion: true,
    activity: { combat: { motion } }, reducedMotion: { matches: reduced }, terrain: null };
  const cue = new DeathCueView(view);
  const ev = { type: "death", x: 3, z: 4, team, building: false, heavy: kind !== "infantry", core: false, seed: 7, direction: 0 };
  // One frame as WorldView runs it: updateDying sets the fall's pose afresh, then the plugins.
  const frame = (dt) => { d.age += dt; object.position.y = 0; model.rotation.z = 0; cue.update({ isVisible: () => true }, dt); };
  return { view, cue, d, ev, parts, spawned, object, model, frame };
}

test("the plugin is registered last and the band cell is new (existing cells keep their index)", () => {
  assert.ok(VIEW_PLUGINS.includes(DeathCueView), "registered (after the plugins that existed before it)");
  assert.deepEqual(CELLS.slice(0, 8), ["glow", "puff", "ring", "streak", "scorch", "flare", "cross", "wrench"]);
  assert.equal(CELL.band, 8);
  assert.equal(FLAT, 3);
});

test("which deaths get a cue: units only (no buildings, Command core or Kite Dive), and only with a dying model", () => {
  assert.equal(cueKind({ type: "death" }, { kind: "infantry" }), "infantry");
  assert.equal(cueKind({ type: "death", heavy: true }, { kind: "vehicle" }), "machine");
  assert.equal(cueKind({ type: "death" }, { kind: "air" }), "air");
  assert.equal(cueKind({ type: "death", building: true }, { kind: "building" }), null);
  assert.equal(cueKind({ type: "death", core: true }, { kind: "building" }), null);
  assert.equal(cueKind({ type: "death", dive: true }, { kind: "dive" }), null);
  assert.equal(cueKind({ type: "death" }, null), null, "fogged or off the view: nothing");
  assert.equal(cueKind({ type: "impact" }, { kind: "infantry" }), null);
});

test("sizes have a CSS-pixel floor, and the pop grows at phone zoom", () => {
  assert.equal(floorSize(2, 50, 0.02), 2);
  assert.equal(floorSize(2, 50, 0.06), 3);
  assert.equal(phoneShare(0.042), 0);
  assert.equal(phoneShare(0.1), 1);
});

test("a death flashes the model, opens a ring in the side's colour, leaves a ring where it fell and pops the soldier", () => {
  const { cue, ev, parts, spawned, object, frame } = stage();
  cue.event(ev, {});
  assert.equal(cue.live, 1);
  assert.equal(cue.spawned, 1);
  assert.ok(parts.every((p) => p.userData.tint[0] > 2), "white-hot at once");
  const rings = spawned.filter((p) => p.cell === CELL.band);
  assert.ok(rings.length >= 4, "ring and marker, each over a dark outline");
  assert.ok(rings.every((p) => p.layer === "smoke" && p.mode === FLAT && p.keep), "normal-blended, flat, never trimmed");
  const colour = rings.filter((p) => p.c0[0] > 0.5);
  assert.ok(colour.length >= 2 && colour.every((p) => Math.abs(p.c0[0] - 0xef / 255) < 1e-6), "the enemy's colour");
  assert.ok(colour.some((p) => p.s1 >= 52 * 0.06 - 1e-9), "the burst never under 52 CSS px");
  assert.ok(spawned.some((p) => p.layer === "glow" && p.cell === CELL.glow), "a bright core");
  frame(0.1);
  assert.ok(object.position.y > 0.1, "popped off its feet");
  frame(0.2);
  assert.equal(parts[0].userData.tint, undefined, "the as-modelled tint comes back");
  assert.deepEqual(parts[1].userData.tint, [0.2, 0.18, 0.16], "a wreck tint comes back");
  frame(0.1);
  assert.equal(cue.live, 0, "released after the pop");
});

test("a tint set during the flash (the seared char) is the one kept", () => {
  const { cue, ev, parts, frame } = stage();
  cue.event(ev, {});
  const char = [0.24, 0.2, 0.18];
  parts[0].userData.tint = char; // DeathLooks.char runs before this plugin in the same frame
  frame(0.05);
  assert.ok(parts[0].userData.tint[0] > 1, "still flashing");
  frame(0.2);
  assert.equal(parts[0].userData.tint, char);
});

test("your own unit: a second ripple and a longer ring; machines: a dark puff and an extra tilt", () => {
  const own = stage({ team: 0, kind: "vehicle" });
  own.cue.event(own.ev, {});
  const bands = own.spawned.filter((p) => p.cell === CELL.band);
  assert.ok(bands.some((p) => p.delay === 0.12), "second ripple");
  assert.ok(bands.some((p) => p.life === DEATH_CUE.markerLife.own));
  assert.ok(own.spawned.some((p) => p.puff), "smoke puff");
  own.frame(0.1);
  assert.ok(own.model.rotation.z > 0.05, "tilted further");
  const enemy = stage({ team: 1, kind: "vehicle" });
  enemy.cue.event(enemy.ev, {});
  assert.ok(!enemy.spawned.some((p) => p.delay === 0.12));
  assert.ok(enemy.spawned.some((p) => p.life === DEATH_CUE.markerLife.enemy));
});

test("combat motion off or reduced motion: no flash, no pop, rings that do not open", () => {
  for (const opts of [{ motion: false }, { reduced: true }]) {
    const { cue, ev, parts, spawned, object, frame } = stage(opts);
    cue.event(ev, {});
    assert.ok(parts.every((p) => !(p.userData.tint?.[0] > 1)), "no flash");
    assert.ok(spawned.filter((p) => p.cell === CELL.band).every((p) => p.s0 >= p.s1), "rings hold their size");
    frame(0.1);
    assert.equal(object.position.y, 0, "no pop");
  }
});

test("the frame governor at still: no second ripple or puff, a shorter ring; Eco alone keeps the full cue", () => {
  const still = stage({ team: 0, kind: "vehicle", level: 0 });
  still.cue.event(still.ev, {});
  assert.ok(!still.spawned.some((p) => p.delay === 0.12 || p.puff));
  assert.ok(still.spawned.some((p) => p.life === DEATH_CUE.markerLife.eco));
  const eco = stage({ team: 0, kind: "vehicle", lowPower: true, level: 2 });
  eco.cue.event(eco.ev, {});
  assert.ok(eco.spawned.some((p) => p.delay === 0.12) && eco.spawned.some((p) => p.puff));
});

test("a flyer: the ring opens in the air; the ring on the ground comes when the wreck crashes", () => {
  const { cue, ev, d, spawned, frame } = stage({ kind: "air" });
  d.object.position.y = 0; d.object.userData.model.position.y = 4;
  cue.event(ev, {});
  const before = spawned.filter((p) => p.mode === FLAT).length;
  assert.equal(before, 0, "no ground ring yet");
  assert.ok(spawned.some((p) => p.cell === CELL.band && p.lifted && p.y >= 4));
  frame(0.5);
  d.crashed = true;
  frame(0.5);
  assert.ok(spawned.filter((p) => p.mode === FLAT).length >= 2, "the ring where it crashed");
  frame(0.1);
  assert.equal(cue.live, 0);
});

test("cue records are capped, pooled and dropped on reset; a body gone early releases its cue", () => {
  const { cue, view, d, ev, frame } = stage();
  for (let i = 0; i < DEATH_CUE.cap + 5; i++) cue.event(ev, {});
  assert.equal(cue.live, DEATH_CUE.cap);
  cue.reset();
  assert.equal(cue.live, 0);
  assert.equal(cue.spawned, 0);
  cue.event(ev, {});
  view.dying.length = 0; // the death cap disposed it
  frame(0.01);
  assert.equal(cue.live, 0);
  assert.ok(cue.free.length > 0);
  void d;
});

test("the minimap marks your own unit lost, once per place and moment, at most five", () => {
  const pings = [];
  const death = (x, z, team = 0) => ({ type: "death", x, z, team, building: false });
  assert.equal(addLostPing(pings, death(0, 0, 1), 1), false, "enemy deaths: no mark");
  assert.equal(addLostPing(pings, { ...death(0, 0), building: true }, 1), false, "buildings have their own alerts");
  assert.equal(addLostPing(pings, death(0, 0), 1), true);
  assert.equal(addLostPing(pings, death(2, 0), 1.5), false, "same place, same moment");
  assert.equal(addLostPing(pings, death(20, 0), 1.5), true, "elsewhere");
  assert.equal(addLostPing(pings, death(0, 0), 1 + LOST_PING.gap), true, "later");
  for (let i = 0; i < 8; i++) addLostPing(pings, death(40 + i * 10, 0), 3);
  assert.equal(pings.filter((p) => p.lost).length, LOST_PING.cap);
  pings.push({ x: 0, z: 0, at: 3 }); // an alert ping stays untouched
  addLostPing(pings, death(200, 0), 9);
  assert.equal(pings.filter((p) => !p.lost).length, 1);
});
