// Shine pass (2026-11-28): Hero mode projectile looks, the 3D river fish and the crystal deposits.
//   - every shot at the hero maps to the battle's own look (tracer / rocket / shell) in its faction's colour;
//   - the fish is one low-poly 3D mesh of 40-60 triangles, one instanced draw for the whole river;
//   - every deposit shares the kit's geometry and materials (so the batches draw all of them in a few calls),
//     nothing casts a shadow, and the two kinds stay apart in colour and shape.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { heroShotLook, SHOT_LOOKS, OWN_LOOKS, HeroModeView } from "../src/hero-mode-view.js";
import { AmbientLife, fishGeometry, FISH_TRIANGLES } from "../src/ambient-life.js";
import { CrystalFieldKit, crystalGeometry, CRYSTAL_GLOW } from "../src/crystal-fields.js";
import { Terrain } from "../src/terrain.js";
import STYLE from "../src/visual-style.json" with { type: "json" };

test("a shot at the hero takes the look of its weapon class and its faction's colour", () => {
  const look = (weapon, unit, faction) => heroShotLook({ weapon }, unit, faction);
  assert.equal(look("ranger", "ranger").kind, "tracer", "a rifle round is a tracer");
  assert.equal(look("ranger", "kite").kind, "tracer", "Skywing's sniper round too");
  assert.equal(look("antitank", "antitank").kind, "rocket", "the Anti-tank rocket");
  assert.equal(look("tank", "tank").kind, "shell", "a tank shell");
  assert.equal(look("breaker", "breaker").kind, "shell", "the Breaker's lob");
  assert.equal(look("scorcher", "scorcher").kind, "shell", "a flamer's blob reads as a hot ball");
  assert.equal(look("drone", "drone").kind, "tracer", "pulses are tracers");
  // Shared weapons take the shooter's faction tint (visual-style.json tints); Meridian keeps the warm default.
  assert.deepEqual(look("ranger", "ranger", "veil").color, STYLE.tints.veil);
  assert.deepEqual(look("ranger", "ranger").color, STYLE.weapons.ranger.color);
  for (const k of ["tracer", "rocket", "shell"]) {
    assert.ok(SHOT_LOOKS[k].trail > 0 && SHOT_LOOKS[k].width > 0, `${k} has a trail`);
    assert.ok(OWN_LOOKS[k].trail >= SHOT_LOOKS[k].trail, `${k}: the hero's own round has the longer trail`);
  }
});

test("Hero mode projectiles: one ribbon draw (+ rocket bodies while a rocket flies), no draw at all in normal play", () => {
  const scene = new THREE.Scene(), terrain = new Terrain("classic");
  const shooter = (x, z) => ({ position: new THREE.Vector3(x, 0, z) });
  const objects = new Map([[1, shooter(10, 0)], [2, shooter(12, 3)], [3, shooter(14, -3)]]);
  const view = { scene, terrain, objects, heroCameraOn: false, reducedMotion: { matches: false } };
  const v = new HeroModeView(view);
  const sim = { time: 0, factions: ["meridian", "veil"], get: (id) => ({ 1: { type: "ranger" }, 2: { type: "antitank" }, 3: { type: "tank" } })[id] };
  v.update(sim, 0.016);
  assert.equal(scene.children.length, 0, "normal play builds nothing");
  sim.heroMode = { teams: {}, shots: [
    { n: 1, by: 1, team: 1, x: 0, z: 0, sx: 10, sz: 0, t0: 0, at: 0.5, weapon: "ranger" },
    { n: 2, by: 2, team: 1, x: 0, z: 0, sx: 12, sz: 3, t0: 0, at: 0.8, weapon: "antitank", heavy: true },
    { n: 3, by: 3, team: 1, x: 0, z: 0, sx: 14, sz: -3, t0: 0, at: 0.8, weapon: "tank", heavy: true },
  ] };
  sim.time = 0.3;
  v.update(sim, 0.016);
  assert.deepEqual({ ...v.drawn }, { tracer: 1, rocket: 1, shell: 1 }, "each kind drawn once");
  const ribbons = scene.getObjectByName("HeroShots");
  assert.equal(ribbons.geometry.instanceCount, 4, "tracer + shell + the rocket's flame and smoke: four ribbons in one draw");
  assert.equal(scene.getObjectByName("HeroRockets").count, 1, "one rocket body");
  // The tracer carries the Veil tint (team 1 is Veil here).
  const color = ribbons.geometry.getAttribute("aColor").array;
  assert.deepEqual([...color.slice(0, 3)].map((c) => +c.toFixed(2)), STYLE.tints.veil.slice(0, 3));
  sim.heroMode.shots = [];
  v.update(sim, 0.016);
  assert.equal(ribbons.visible, false, "nothing in the air: nothing drawn");
});

test("the hero's own round flies in the hero look only under the Hero camera", () => {
  const scene = new THREE.Scene(), view = { scene, terrain: new Terrain("classic"), objects: new Map(), heroCameraOn: false, reducedMotion: { matches: false } };
  const v = new HeroModeView(view);
  assert.equal(view.heroOwnShots, v, "the effects find it on the view");
  const sim = { time: 0, heroMode: { teams: { 0: { id: 7 } }, shots: [] }, factions: ["meridian"], get: () => null };
  const from = { x: 0, y: 3, z: 0 }, to = { x: 0, y: 1, z: 12 }, rocket = { kind: "rocket", life: 0.45 };
  const shot = { type: "shot", source: 7, team: 0, weapon: "antitank", unit: "kite" };
  assert.equal(v.take(shot, sim, from, to, rocket), false, "RTS camera: the effects draw it as always");
  view.heroCameraOn = true;
  assert.equal(v.take({ ...shot, source: 8 }, sim, from, to, rocket), false, "someone else's shot: unchanged");
  view.reducedMotion.matches = true;
  assert.equal(v.take(shot, sim, from, to, rocket), false, "reduced motion: the static effect");
  view.reducedMotion.matches = false;
  assert.equal(v.take(shot, sim, from, to, rocket), true);
  v.update(sim, 0.2);
  assert.equal(v.ownDrawn.rocket, 1, "the hero's rocket is drawn in the hero look");
  assert.equal(v.ownTaken.rocket, 1, "counted as taken over");
  assert.equal(scene.getObjectByName("HeroRockets").count, 1);
  v.update(sim, 0.3);
  assert.equal(v.ownCount, 0, "it is gone when the effects' hit lands (the style's flight time)");
});

test("the river fish: a 3D low-poly fish of 40-60 triangles, three kinds, one instanced draw", () => {
  const g = fishGeometry();
  const tris = g.attributes.position.count / 3;
  assert.equal(tris, FISH_TRIANGLES);
  assert.ok(tris >= 40 && tris <= 60, `${tris} triangles`);
  const box = new THREE.Box3().setFromBufferAttribute(g.attributes.position);
  assert.ok(box.max.y - box.min.y > 0.1, "it has a body, not a flat sprite");
  assert.ok(g.attributes.normal && g.attributes.aPaint, "shaded and painted per vertex");
  const life = new AmbientLife(new THREE.Scene(), new Terrain("riverlands"));
  const meshes = life.root.children.filter((c) => c.name === "life:fish");
  assert.equal(meshes.length, 1, "one draw for every fish");
  const fish = life.groups.find((q) => q.name === "fish"), kinds = new Set();
  const B = fish.geometry.attributes.aB.array;
  for (let i = 0; i < fish.rows.length; i++) kinds.add(B[i * 4 + 3]);
  assert.deepEqual([...kinds].sort(), [0, 1, 2], "silver, koi and carp all swim");
});

test("crystal deposits: shared kit parts, no shadows, two clear kinds", () => {
  const kit = new CrystalFieldKit();
  const a = kit.create("energy"), b = kit.create("energy"), c = kit.create("alloy");
  const parts = (g) => g.children.map((m) => [m.name, m.geometry, m.material]);
  assert.deepEqual(parts(a).map(([n, geo, mat]) => [n, geo.id, mat.id]), parts(b).map(([n, geo, mat]) => [n, geo.id, mat.id]), "two deposits share every part");
  const crystals = (g) => g.children.find((m) => m.name === "CrystalFieldCrystals");
  assert.notEqual(crystals(a).material, crystals(c).material, "each kind its own crystal material");
  assert.equal(a.children.find((m) => m.name === "CrystalFieldGlow").material, c.children.find((m) => m.name === "CrystalFieldGlow").material, "one glow material for both kinds (tinted per instance)");
  for (const g of [a, c]) for (const m of g.children) assert.equal(m.castShadow, false, `${m.name} casts no shadow`);
  // Three parts per deposit: with batching, all deposits draw in 2 crystal + 1 glow + 1 blob calls.
  assert.equal(new Set([a, b, c].flatMap((g) => g.children.map((m) => `${m.geometry.id}:${m.material.id}`))).size, 4);
  for (const kind of ["energy", "alloy"]) {
    const tris = crystalGeometry(kind).attributes.position.count / 3;
    assert.ok(tris < 300, `${kind}: ${tris} triangles`);
  }
  assert.ok(CRYSTAL_GLOW.energy[2] > CRYSTAL_GLOW.energy[0] && CRYSTAL_GLOW.alloy[0] > CRYSTAL_GLOW.alloy[2], "blue energy, orange alloy");
  // A mining hit flashes the crystals through the instance colour, then fades.
  CrystalFieldKit.flash(a, 1);
  CrystalFieldKit.step(a, 0.01);
  assert.ok(crystals(a).userData.tint[0] > 1.5);
  CrystalFieldKit.step(a, 1);
  assert.equal(crystals(a).userData.tint[0], 1);
});
