// Building life (AAA round 3, R3-L): 2D decals on the buildings and gate details on the ground, one instanced
// draw (src/building-decals-view.js, atlas in src/building-decals-atlas.js). View only.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { VIEW_PLUGINS } from "../src/view-plugins.js";
import { BuildingDecalsView, WALL, MODE, nightOf } from "../src/building-decals-view.js";
import { CELL, CELL_COUNT, GRID } from "../src/building-decals-atlas.js";
import { DEFINITIONS as D } from "../src/data.js";

// A view with only what the plugin reads: a scene, entity roots with a model, box templates, colours.
function stage() {
  const scene = new THREE.Scene(), objects = new Map(), teamTemplates = new Map();
  for (const type of Object.keys(WALL)) for (const team of [0, 1]) {
    const g = new THREE.Group();
    const r = D[type].radius;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, 3, r * 1.6).translate(0, 1.5, 0), new THREE.MeshBasicMaterial()));
    teamTemplates.set(`${type}-${team}`, g);
  }
  const view = { scene, objects, teamTemplates, colors: [0x3fd6a8, 0xff6a50], motionLevel: 2, reducedMotion: { matches: false }, terrain: { heightAt: () => 0 }, mood: { state: { name: null, k: 0 } } };
  let id = 1;
  const sim = { entities: [], get(i) { return this.entities.find((e) => e.id === i); } };
  const add = (type, team, x, z, extra = {}) => {
    const e = { id: id++, type, kind: D[type].kind, team, x, z, radius: D[type].radius, hp: 100, complete: true, queue: [], trains: D[type].trains, ...extra };
    sim.entities.push(e);
    const root = new THREE.Group(), model = teamTemplates.get(`${type}-${team}`).clone(true);
    model.rotation.y = team === 0 ? 0 : Math.PI;
    root.add(model); root.userData.model = model; root.position.set(x, 0, z); root.visible = true;
    objects.set(e.id, root);
    return e;
  };
  return { view, sim, add, plugin: new BuildingDecalsView(view) };
}
const decalsOf = (p) => p.mesh.count - 108; // the first 108 slots are the track and dust pools

test("the atlas has one cell per id in an 8 x 4 grid, and every building type has wall decals", () => {
  assert.deepEqual(GRID, { cols: 8, rows: 4, cell: 128 });
  assert.equal(CELL_COUNT, 32);
  assert.deepEqual(Object.values(CELL).sort((a, b) => a - b), [...Array(32).keys()]);
  for (const type of ["hq", "barracks", "foundry", "relay", "tower", "workshop", "salvageyard", "waystation", "pylon", "veilrelay"])
    assert.ok(WALL[type]?.length >= 4, `${type} has decals`);
  assert.ok(VIEW_PLUGINS.at(-1) === BuildingDecalsView || VIEW_PLUGINS.includes(BuildingDecalsView), "registered");
});

test("one instanced mesh for every building: no shadows, under rings, nothing built before a building exists", () => {
  const { view, sim, add, plugin } = stage();
  plugin.update(sim, 0.016);
  assert.equal(plugin.mesh, null, "no building: nothing built");
  add("barracks", 0, 0, 0); add("foundry", 0, 12, 0); add("hq", 0, 0, -20); add("tower", 1, -20, 20);
  plugin.update(sim, 0.016);
  const meshes = view.scene.children.filter((o) => o.isInstancedMesh);
  assert.equal(meshes.length, 1, "one draw");
  const m = meshes[0];
  assert.equal(m.castShadow, false); assert.equal(m.receiveShadow, false);
  assert.ok(m.renderOrder < 3, "under the selection rings");
  assert.ok(decalsOf(plugin) > 40, `decals: ${decalsOf(plugin)}`);
  assert.equal(plugin.state.buildings, 4);
  // Every instance has a finite place.
  const p = new THREE.Vector3(), mat = new THREE.Matrix4();
  for (let i = 108; i < m.count; i++) { m.getMatrixAt(i, mat); p.setFromMatrixPosition(mat); assert.ok(Number.isFinite(p.x + p.y + p.z)); }
});

test("hidden, unfinished and destroyed buildings: decals follow fog, construction and death", () => {
  const { view, sim, add, plugin } = stage();
  const b = add("barracks", 0, 0, 0), enemy = add("foundry", 1, 30, 0);
  plugin.update(sim, 0.016);
  const both = decalsOf(plugin);
  view.objects.get(enemy.id).visible = false; // fogged
  plugin.update(sim, 0.016);
  const one = decalsOf(plugin);
  assert.ok(one < both && one > 0, "the fogged building's decals go");
  b.complete = false; b.progress = 0.3;
  plugin.update(sim, 0.016);
  assert.equal(decalsOf(plugin), 1, "a building going up shows only its blueprint grid");
  assert.equal(plugin.data.getY(108), MODE.blueprint);
  b.hp = 0;
  plugin.update(sim, 0.016);
  assert.equal(decalsOf(plugin), 0, "removed with the building");
});

test("training lights the bar and speeds the runway lights; a unit coming out flashes the door and leaves dust", () => {
  const { sim, add, plugin } = stage();
  const b = add("barracks", 0, 0, 0);
  plugin.update(sim, 0.016);
  const rec = plugin.records.get(b.id);
  assert.equal(rec.bar.length, 1); assert.equal(rec.chase.length, 8); assert.equal(rec.door.length, 1);
  assert.equal(plugin.data.getW(rec.chase[0]), 0, "idle: lights at rest");
  b.queue.push({ type: "vanguard", elapsed: D.vanguard.time * 0.5 });
  plugin.update(sim, 0.016);
  assert.ok(Math.abs(plugin.data.getW(rec.bar[0]) - 0.5) < 1e-6, "the bar shows half");
  const half = plugin.data.getW(rec.chase[0]);
  b.queue[0].elapsed = D.vanguard.time * 0.9;
  plugin.update(sim, 0.016);
  assert.ok(plugin.data.getW(rec.chase[0]) > half && half > 0, "faster near completion");
  const u = { id: 99, type: "vanguard", kind: "unit", team: 0, x: 0, z: 5, radius: 0.6, hp: 100 };
  sim.entities.push(u);
  plugin.event({ type: "spawn", x: 0, z: 5, team: 0, seed: 99 }, sim);
  assert.equal(plugin.data.getW(rec.door[0]), Math.fround(plugin.clock), "door flash at the exit time");
  assert.equal(plugin.data.getY(96), MODE.dust, "a dust puff from the pool");
  // It walks off south: tracks appear behind it.
  for (let k = 1; k <= 4; k++) { u.z = 5 + k; plugin.update(sim, 0.05); }
  assert.ok(plugin.trackNext >= 3, `tracks laid: ${plugin.trackNext}`);
});

test("motion off or reduced motion holds every animation still; night looks strengthen the light pools", () => {
  const { view, sim, add, plugin } = stage();
  add("barracks", 0, 0, 0);
  plugin.update(sim, 0.1);
  const t = plugin.uniforms.uTime.value;
  assert.ok(t > 0); assert.equal(plugin.uniforms.uStill.value, 0);
  view.motionLevel = 0;
  plugin.update(sim, 0.1);
  assert.equal(plugin.uniforms.uTime.value, t, "the clock stops");
  assert.equal(plugin.uniforms.uStill.value, 1);
  view.motionLevel = 2; view.reducedMotion.matches = true;
  plugin.update(sim, 0.1);
  assert.equal(plugin.uniforms.uTime.value, t);
  view.reducedMotion.matches = false; view.settings = { combatMotion: false };
  plugin.update(sim, 0.1);
  assert.equal(plugin.uniforms.uTime.value, t, "combat motion off (Settings) holds it too");
  view.settings = {};
  assert.equal(nightOf(null), 0);
  assert.equal(nightOf({ name: "night", k: 1 }), 1);
  assert.ok(nightOf({ name: "dusk", k: 1 }) < nightOf({ name: "storm", k: 1 }));
  view.mood.state = { name: "night", k: 0.5 };
  plugin.update(sim, 0.1);
  assert.equal(plugin.uniforms.uNight.value, 0.5);
  plugin.reset();
  assert.equal(view.scene.children.filter((o) => o.isInstancedMesh).length, 0, "reset removes the mesh");
});

test("gate details lie in front of the south face, for both facings", () => {
  const { sim, add, plugin } = stage();
  const own = add("barracks", 0, 0, 0), enemy = add("barracks", 1, 40, 0);
  plugin.update(sim, 0.016);
  const m = plugin.mesh, mat = new THREE.Matrix4(), p = new THREE.Vector3();
  for (const b of [own, enemy]) {
    const chase = plugin.records.get(b.id).chase;
    for (const s of chase) { m.getMatrixAt(s, mat); p.setFromMatrixPosition(mat); assert.ok(p.z > b.z + 1, `runway light south of ${b.team}`); assert.ok(Math.abs(p.x - b.x) < 4); }
  }
});
