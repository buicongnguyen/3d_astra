// AAA round 3, R3-K (battle readability): wide-zoom type icons and group badges in the status atlas
// (src/status-view.js), the Combined squad's gold trim (src/army-readability-view.js), off-screen threat
// arrows (src/threat-arrows.js) and the three death looks (src/combat-feedback.js DeathLooks). All view
// only: nothing here writes the simulation, so every pin stays.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Simulation } from "../src/simulation.js";
import { StatusView, TYPE_CLASSES, TYPE_CELL0, DIGIT_CELL0, STAR_CELL, READ, wideZoom } from "../src/status-view.js";
import { ArmyReadabilityView } from "../src/army-readability-view.js";
import { ThreatArrows, edgePoint, THREAT } from "../src/threat-arrows.js";
import { DeathLooks, DEATH_LOOK, DEATH_CHAR, deathLookOf } from "../src/combat-feedback.js";
import { VIEW_PLUGINS } from "../src/view-plugins.js";

const stubCanvas = () => ({ width: 768, height: 288, getContext: () => new Proxy({}, { get: (_, name) => (name === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => {}), set: () => true }) });
function staged(zoom = 38) {
  const sim = new Simulation({ ai: false });
  sim.visible[0].fill(1); sim.explored[0].fill(1);
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 240);
  camera.position.set(0, 40, 30); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const view = { scene, camera, objects: new Map(), zoom, unitsPerPixel: 0.1, lowPower: true, colors: [0x3fa7ff, 0xff5a3a], feelEnabled: () => false, activity: { combat: { motion: false } } };
  const draw = (e, visible = true) => view.objects.set(e.id, { visible, position: new THREE.Vector3(e.x, 0, e.z), userData: { bar: { position: { y: 2.55 } }, readabilityScale: 1 } });
  return { sim, view, draw };
}
const withCanvas = (fn) => { const real = StatusView.makeCanvas; StatusView.makeCanvas = stubCanvas; try { fn(); } finally { StatusView.makeCanvas = real; } };

test("type icons show only at the widest zoom, one per unit in one draw, the tile tinted by team", () => withCanvas(() => {
  const { sim, view, draw } = staged(38);
  const tank = sim.spawn("tank", 0, 0, 10), rocket = sim.spawn("antitank", 1, 4, 10), medic = sim.spawn("medic", 0, 8, 10), hq = sim.entities.find((e) => e.kind === "building");
  sim.entities = [tank, rocket, medic, hq].filter(Boolean);
  for (const e of sim.entities) draw(e);
  const plugin = new StatusView(view);
  plugin.update(sim, 0.016);
  assert.equal(plugin.mesh, null, "default zoom: nothing built");
  view.zoom = 80; assert.equal(wideZoom(view), false); plugin.update(sim, 0.016);
  assert.equal(plugin.mesh, null, "zoom 80 is not the widest");
  view.zoom = 88; plugin.update(sim, 0.016);
  assert.ok(plugin.mesh?.visible, "the widest zoom draws the icons");
  assert.equal(view.scene.children.length, 1, "one mesh: one draw call");
  assert.equal(plugin.mesh.geometry.instanceCount, 3, "units only: the building has none");
  const cells = [0, 1, 2].map((i) => plugin.cell.array[i * 2]);
  assert.deepEqual(cells, ["armor", "antiarmor", "support"].map((c) => TYPE_CELL0 + TYPE_CLASSES.indexOf(c)));
  assert.equal(plugin.tint.array[3], 1, "type tiles use the team-colour mode");
  assert.ok(Math.abs(plugin.tint.array[0] - 0x3f / 255) < 1e-6 && Math.abs(plugin.tint.array[4] - 0xff / 255) < 1e-6, "player blue, enemy red");
  assert.ok(Math.abs(plugin.place.array[3] - READ.typePx * 0.1) < 1e-6, "16 px on screen");
  // A still frame changes nothing (no buffer upload in render-budget).
  const version = plugin.place.version;
  plugin.update(sim, 0.016);
  assert.equal(plugin.place.version, version);
  // Defence's Overview allows 96: there, 88 is not the widest.
  view.maxZoom = 96; plugin.update(sim, 0.016);
  assert.equal(plugin.mesh.visible, false);
  plugin.reset();
  assert.equal(view.scene.children.length, 0);
}));

test("group badges: the lowest Ctrl+number group over the player's units at close zoom, display only", () => withCanvas(() => {
  const { sim, view, draw } = staged(38);
  const a = sim.spawn("ranger", 0, 0, 10), b = sim.spawn("tank", 0, 3, 10), foe = sim.spawn("ranger", 1, 6, 10);
  sim.entities = [a, b, foe];
  for (const e of sim.entities) draw(e);
  const plugin = new StatusView(view);
  plugin.update(sim, 0.016);
  assert.equal(plugin.mesh, null, "no groups linked: nothing");
  view.controlGroups = new Map([["3", [a.id, b.id, foe.id]], ["1", [b.id]]]);
  plugin.update(sim, 0.016);
  assert.equal(plugin.mesh.geometry.instanceCount, 2, "the enemy in a stale group shows none");
  assert.deepEqual([plugin.cell.array[0], plugin.cell.array[2]], [DIGIT_CELL0 + 2, DIGIT_CELL0 + 0], "a: group 3, b: group 1 (the lowest)");
  assert.ok(READ.groupPx * 0.62 >= 11, "the digit is at least 11 px tall");
  const map = plugin.groupOf, size = map.size;
  plugin.update(sim, 0.016);
  assert.equal(plugin.groupOf, map); assert.equal(map.size, size, "unchanged groups are not rebuilt");
  view.zoom = READ.groupZoom + 4; plugin.update(sim, 0.016);
  assert.equal(plugin.mesh.visible, false, "badges are a close-zoom aid");
  // A Defence Combined squad tank carries the gold star at any zoom.
  view.zoom = 60; view.controlGroups = null; sim.defence = {}; b.combined = true;
  plugin.update(sim, 0.016);
  assert.equal(plugin.mesh.geometry.instanceCount, 1);
  assert.equal(plugin.cell.array[0], STAR_CELL);
}));

test("Combined squads stand on one instanced gold trim (one draw), nothing outside Defence, nothing re-sent while still", () => {
  const { sim, view, draw } = staged(70);
  const t1 = sim.spawn("tank", 0, 0, 10), t2 = sim.spawn("tank", 0, 3, 10), t3 = sim.spawn("tank", 0, 6, 10);
  sim.entities = [t1, t2, t3];
  for (const e of sim.entities) draw(e);
  t1.combined = t2.combined = true;
  const plugin = new ArmyReadabilityView(view);
  plugin.update(sim, 0.016);
  assert.equal(plugin.gold, null, "skirmish: never built");
  sim.defence = {};
  plugin.update(sim, 0.016);
  assert.ok(plugin.gold?.visible);
  assert.equal(plugin.gold.geometry.instanceCount, 2, "the two Combined tanks, not the plain one");
  assert.equal(view.scene.children.length, 1);
  assert.equal(plugin.gold.castShadow, false, "no shadow draw");
  const version = plugin.goldPlace.version;
  plugin.update(sim, 0.016);
  assert.equal(plugin.goldPlace.version, version, "a still frame uploads nothing");
  assert.equal(plugin.goldMaterial.uniforms.uPulse.value, 0.5, "reduced motion: the glow holds still");
  t2.hp = 0; plugin.update(sim, 0.016);
  assert.equal(plugin.gold.geometry.instanceCount, 1);
  plugin.reset();
  assert.equal(view.scene.children.length, 0);
});

test("threat arrows: an off-screen hit on the player's unit puts one arrow on the edge, hits that way share it, then it fades", () => {
  const out = {};
  edgePoint(400, 300, 0, 0, 800, 600, out); assert.equal(out.inside, true);
  edgePoint(1600, 300, 30, 30, 770, 570, out);
  assert.equal(out.inside, false); assert.equal(out.x, 770); assert.equal(out.y, 300); assert.equal(out.angle, 0);
  edgePoint(400, -900, 30, 30, 770, 570, out);
  assert.equal(out.y, 30); assert.ok(Math.abs(out.angle + Math.PI / 2) < 1e-9);
  const { sim, view } = staged(38);
  Object.assign(view, { width: 800, height: 600, drawHeight: 600, coverTop: 0 });
  const arrows = new ThreatArrows(view);
  arrows.event({ type: "impact", team: 0, x: 0, z: 0 }, sim);
  assert.equal(arrows.live, 0, "in view: no arrow");
  arrows.event({ type: "impact", team: 1, x: 200, z: 0 }, sim);
  arrows.event({ type: "impact", team: 0, building: true, x: 200, z: 0 }, sim);
  assert.equal(arrows.live, 0, "enemy hits and buildings: none");
  arrows.event({ type: "impact", team: 0, x: 200, z: 0 }, sim);
  arrows.event({ type: "impact", team: 0, x: 204, z: 3 }, sim);
  assert.equal(arrows.live, 1, "two hits that way share one arrow");
  arrows.event({ type: "death", team: 0, x: -200, z: 0 }, sim);
  assert.equal(arrows.live, 2);
  assert.ok(arrows.slots.some((s) => s.on && s.lost), "a unit lost out of view flares its arrow");
  arrows.update(sim, 0.016);
  assert.equal(arrows.visible, 2, "both drawn (headless: no DOM is built)");
  assert.equal(arrows.layer, null);
  sim.time += THREAT.hold + 0.1;
  arrows.update(sim, 0.016);
  assert.equal(arrows.live, 0, "gone a few seconds after the last hit");
  for (let i = 0; i < 9; i++) { sim.time += 0.01; arrows.event({ type: "impact", team: 0, x: 300 * Math.cos(i * 0.7), z: 300 * Math.sin(i * 0.7) }, sim); }
  assert.ok(arrows.live <= THREAT.slots, "never more than four");
});

test("death looks: blast, seared or ballistic by the killing weapon, settled after the frame's events, from the pools", () => {
  assert.equal(deathLookOf({ kind: "rifle" }), DEATH_LOOK.ballistic);
  assert.equal(deathLookOf({ kind: "cannon" }), DEATH_LOOK.blast);
  assert.equal(deathLookOf({ kind: "rocket", look: "rocket" }), DEATH_LOOK.ballistic);
  assert.equal(deathLookOf({ kind: "rocket", look: "rail" }), DEATH_LOOK.ballistic, "the precision rail has no burning payload");
  assert.equal(deathLookOf({ kind: "rifle", look: "beam" }), DEATH_LOOK.ballistic);
  assert.equal(deathLookOf({ kind: "rifle", look: "flame" }), DEATH_LOOK.seared);
  assert.equal(deathLookOf(null), DEATH_LOOK.ballistic);
  const { sim } = staged();
  const calls = [];
  const fx = { glow: {}, smoke: {}, motion: false, count: (n) => n, particle: () => calls.push("particle"), burst: () => calls.push("burst"),
    addDebris: () => calls.push("debris"), dust: () => calls.push("dust"), explosion: () => calls.push("explosion") };
  const part = { isMesh: true, userData: {} }, body = (kind) => ({ visible: true, userData: { model: { traverse: (f) => f(part) } } });
  const view = { fx, dying: [] }, looks = new DeathLooks(view);
  const die = (id, kind, x = 0, z = 0) => { const d = { id, look: 0, kind, x, z, team: 0, object: body(kind) }; view.dying.push(d); return d; };
  // The death event comes first, the killing shot after it (sim/combat.js): the look waits for update().
  const a = die(11, "infantry");
  looks.event({ type: "shot", weapon: "scorcher", unit: "scorcher", target: 11, tx: 0, tz: 0 }, sim);
  const b = die(12, "vehicle", 20, 0);
  looks.event({ type: "shot", weapon: "tank", unit: "tank", target: 12, tx: 20, tz: 0, heavy: true }, sim);
  const c = die(13, "infantry", 40, 0); // shot by a rifle a second ago
  looks.event({ type: "shot", weapon: "ranger", unit: "ranger", target: 13 }, { time: sim.time - 1 });
  const s = die(14, "infantry", 60, 2); // caught by a Barrage this frame
  looks.event({ type: "shot", weapon: "ranger", unit: "ranger", target: 14 }, { time: sim.time - 1 });
  looks.event({ type: "strike", x: 60, z: 0, radius: 4 }, sim);
  const h = die(15, "building", 80, 0);
  looks.update(sim, 0.016);
  assert.deepEqual([a.look, b.look, c.look, s.look, h.look], [DEATH_LOOK.seared, DEATH_LOOK.blast, DEATH_LOOK.ballistic, DEATH_LOOK.blast, DEATH_LOOK.ballistic]);
  assert.equal(part.userData.tint, DEATH_CHAR, "the seared soldier is charred (per-instance tint, no new draw)");
  assert.ok(calls.includes("explosion") && calls.includes("debris") && calls.includes("burst"), "effects come from the pools");
  assert.deepEqual(looks.counts.slice(1), [1, 2, 1]);
  assert.equal(looks.last.size, 0, "settled deaths forget their shots");
  // Registered after every earlier plugin (append-only registry).
  assert.ok(VIEW_PLUGINS.includes(ThreatArrows) && VIEW_PLUGINS.includes(DeathLooks));
});
