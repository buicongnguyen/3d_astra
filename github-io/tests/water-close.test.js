// Hero-view water (2026-11-28; src/water-close.js, src/water-close-view.js, src/environment-view.js waterLife): the
// tier rule, one program for every tier (the key never changes with the view), the swell in the vertex shader (no
// per-frame upload of the water's vertices), still water with motion off, and no new draw anywhere.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Terrain } from "../src/terrain.js";
import { waterTier, WATER_TIER, WATER_CLOSE, RINGS, RING, WASH, clearRings } from "../src/water-close.js";
import { WaterCloseView } from "../src/water-close-view.js";
import { gradeKey } from "../src/look-grade.js";

// EnvironmentView draws the sine normal map on a canvas: a stand-in 2D context is enough in Node.
globalThis.document ??= {
  createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }),
};
const { EnvironmentView, WATER_PROGRAM, SWELL } = await import("../src/environment-view.js");

const build = (id) => {
  const scene = new THREE.Scene(), env = new EnvironmentView(scene, new Terrain(id), new THREE.Group());
  env.configure({ waterMotion: true, detail: true });
  env.reducedMotion = { matches: false };
  return { scene, env };
};
// The shader three would compile for the water: the standard material's source through waterLife's patch.
const compiled = (material) => {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader);
  return shader;
};
// Everything in a scene that draws (a mesh, an instanced batch, points or lines).
const drawables = (root) => { let n = 0; root.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) n++; }); return n; };

test("the tier: RTS view 0 (the old water), phones and Eco 1, PCs 2; the governor's still steps drop to 1; lava never", () => {
  assert.equal(waterTier({ hero: false }), WATER_TIER.off);
  assert.equal(waterTier({ hero: false, touch: true }), WATER_TIER.off);
  assert.equal(waterTier({ hero: true }), WATER_TIER.full);
  assert.equal(waterTier({ hero: true, level: "calm" }), WATER_TIER.full);
  assert.equal(waterTier({ hero: true, touch: true }), WATER_TIER.lite);
  assert.equal(waterTier({ hero: true, eco: true }), WATER_TIER.lite);
  assert.equal(waterTier({ hero: true, level: "still" }), WATER_TIER.lite);
  assert.equal(waterTier({ hero: true, level: "rescue" }), WATER_TIER.lite);
  assert.equal(waterTier({ hero: true, lava: true }), WATER_TIER.off);
  assert.deepEqual(WATER_TIER, { off: 0, lite: 1, full: 2 });
});

test("one program for every tier: the key carries the program, lava and the grade, never the view or the tier", () => {
  const { env } = build("riverlands"), m = env.water.material;
  assert.equal(m.customProgramCacheKey(), `${WATER_PROGRAM}|0|${gradeKey()}`);
  for (const tier of [0, 1, 2]) { WATER_CLOSE.tier.value = tier; assert.equal(m.customProgramCacheKey(), `${WATER_PROGRAM}|0|${gradeKey()}`); }
  WATER_CLOSE.tier.value = 0;
  const { env: lava } = build("volcano");
  assert.equal(lava.water.material.customProgramCacheKey(), `${WATER_PROGRAM}|1|${gradeKey()}`);
  assert.equal(lava.lava, true);
  // The patch finds every place it writes to in three's standard shader (a three upgrade that moves one fails here).
  const s = compiled(m);
  assert.match(s.vertexShader, /transformed\.z \+= sin\(transformed\.x \* 1\.5 \+ transformed\.y \* 2\.0 \+ uWaterTime \* 1\.6\) \* uWaterSwell;\n#include <project_vertex>/);
  for (const bit of ["uniform float uWaterTier;", "vec3 wNoiseD(vec2 p)", "wSlope = nA.yz", "roughnessFactor = mix(roughnessFactor, 0.13, wK);", "outgoingLight = mix(outgoingLight, sky,", "directLight.direction", "#include <opaque_fragment>"])
    assert.ok(s.fragmentShader.includes(bit), bit);
  assert.ok(s.fragmentShader.indexOf("normal = normalize(mix(normal,") > s.fragmentShader.indexOf("#include <normal_fragment_maps>"), "the ripple normal after the normal map");
  assert.ok(s.fragmentShader.indexOf("float kSky") < s.fragmentShader.indexOf("#include <opaque_fragment>"), "the sky before the output");
  // The view switches the look with shared uniforms, not a recompile.
  for (const [name, u] of [["uWaterTier", WATER_CLOSE.tier], ["uWaterRings", WATER_CLOSE.rings], ["uWaterWash", WATER_CLOSE.wash], ["uWaterHorizon", WATER_CLOSE.horizon]]) assert.equal(s.uniforms[name], u, name);
  assert.equal(WATER_CLOSE.rings.value.length, RINGS);
  assert.equal(SWELL, 0.018, "the swell's height as the CPU wave had it");
});

test("the swell runs on the GPU: no water vertex is rewritten or uploaded per frame; the clock moves the look", () => {
  const { env } = build("twinrivers"), p = env.water.geometry.attributes.position, before = p.array.slice(), version = p.version;
  const sim = { time: 10, entities: [], isVisible: () => true };
  for (let i = 0; i < 30; i++) { sim.time += 1 / 20; env.update(sim, 1 / 20); }
  assert.equal(p.version, version, "no position upload");
  assert.deepEqual(p.array, before, "no vertex moved on the CPU");
  assert.ok(Math.abs(env.waterTime.value - sim.time) < 1e-9, "the water clock follows the match");
  assert.ok(env.normalTexture.offset.x > 0, "the normal map still scrolls in the RTS view");
});

test("motion off (reduced motion, Animate water Off, the governor's still step): the water clock stops", () => {
  for (const off of [(e) => { e.reducedMotion = { matches: true }; }, (e) => { e.settings.waterMotion = false; }, (e) => { e.still = true; }]) {
    const { env } = build("riverlands"), sim = { time: 5, entities: [], isVisible: () => true };
    env.update(sim, 0.05);
    const t = env.waterTime.value, offset = env.normalTexture.offset.x;
    off(env);
    for (let i = 0; i < 10; i++) { sim.time += 0.05; env.update(sim, 0.05); }
    assert.equal(env.waterTime.value, t, "still water");
    assert.equal(env.normalTexture.offset.x, offset, "nothing scrolls");
  }
});

// A view stand-in for the plugin: Hero camera on, one river map, a unit wading the ford ahead.
function heroView({ hero = true, motion = true, touch = false, eco = false, level = "full" } = {}) {
  const { scene, env } = build("riverlands");
  Object.defineProperty(env, "motion", { get: () => motion });
  const v = { heroCameraOn: hero, environment: env, lowPower: eco, closeLevel: level, terrain: env.terrain, heroEye: new THREE.Vector3(0, 4, -12), objects: new Map(), scene };
  scene.fog = new THREE.Fog(0x88aacc, 30, 100);
  scene.background = new THREE.Color(0x335577);
  const plugin = new WaterCloseView(v);
  plugin.touch = touch;
  const unit = { id: 7, kind: "unit", hp: 100, x: 0.5, z: 0.5, moving: true, radius: 0.5 };
  const sim = { time: 0, entities: [unit], isVisible: () => true, get: () => null, heroMode: null };
  return { v, env, plugin, sim, scene };
}
const liveRings = (t) => WATER_CLOSE.rings.value.filter((r) => t - r.z >= 0 && t - r.z <= RING.life).length;

test("the plugin: tier 0 in the RTS view; in Hero mode wading rings start at the ford, one per unit per beat", () => {
  clearRings();
  const rts = heroView({ hero: false });
  rts.env.waterTime.value = 3; rts.plugin.update(rts.sim);
  assert.equal(WATER_CLOSE.tier.value, 0);
  assert.equal(liveRings(3), 0, "no ring in the RTS view");
  const { env, plugin, sim } = heroView();
  for (let i = 0; i < 8; i++) { env.waterTime.value = 10 + i * 0.1; plugin.update(sim); }
  assert.equal(WATER_CLOSE.tier.value, 2);
  assert.equal(liveRings(10.7), 2, "a ring every RING.every s (about)");
  assert.equal(plugin.state.rings, 2);
  // A unit standing still or on dry ground starts none.
  sim.entities[0].moving = false;
  for (let i = 0; i < 10; i++) { env.waterTime.value = 11 + i * 0.1; plugin.update(sim); }
  assert.ok(liveRings(11.9) <= 1, "the old rings fade");
  // Phones and Eco: the light tier.
  assert.equal((() => { const h = heroView({ touch: true }); h.plugin.update(h.sim); return WATER_CLOSE.tier.value; })(), 1);
  assert.equal((() => { const h = heroView({ eco: true }); h.plugin.update(h.sim); return WATER_CLOSE.tier.value; })(), 1);
});

test("still water in Hero mode: no ring starts, none is left half-spread, no downwash", () => {
  const { env, plugin, sim } = heroView();
  for (let i = 0; i < 6; i++) { env.waterTime.value = 20 + i * 0.1; plugin.update(sim); }
  assert.ok(liveRings(20.5) > 0);
  const still = heroView({ motion: false });
  WATER_CLOSE.wash.value.z = 1;
  still.env.waterTime.value = 20.5;
  still.plugin.lastT = 20.4; // it was running a frame ago
  still.plugin.update(still.sim);
  assert.equal(liveRings(20.5), 0);
  assert.equal(WATER_CLOSE.wash.value.z, 0);
  assert.equal(WATER_CLOSE.tier.value, 2, "the look stays (still water, not the RTS water)");
});

test("Skywing's downwash: over water and low, scaled by height; none landed or high", () => {
  const { v, env, plugin, sim } = heroView();
  const sky = { id: 3, assist: true, hp: 100, flying: true, x: 0, z: 0 };
  sim.get = (id) => (id === 3 ? sky : null);
  sim.heroMode = { teams: [{ id: 3 }] };
  // A flyer's root stays on the ground; its drawn flight height is userData.air.y (view.js stepFlyer).
  const model = { position: new THREE.Vector3(0, 0, 0), userData: { skywing: { f: 1 }, air: { y: WASH.low - 0.5 } } };
  v.objects.set(3, model);
  env.waterTime.value = 30;
  plugin.update(sim);
  assert.equal(WATER_CLOSE.wash.value.z, 1, "full strength at the low height");
  assert.deepEqual([WATER_CLOSE.wash.value.x, WATER_CLOSE.wash.value.y, WATER_CLOSE.wash.value.w], [0, 0, WASH.radius]);
  model.userData.air.y = (WASH.low + WASH.high) / 2; env.waterTime.value = 30.1; plugin.update(sim);
  assert.ok(WATER_CLOSE.wash.value.z > 0.3 && WATER_CLOSE.wash.value.z < 0.7, "half way up, about half");
  model.userData.air.y = WASH.high + 1; env.waterTime.value = 30.2; plugin.update(sim);
  assert.equal(WATER_CLOSE.wash.value.z, 0, "too high");
  model.userData.air.y = 1; model.userData.skywing.f = 0; env.waterTime.value = 30.3; plugin.update(sim);
  assert.equal(WATER_CLOSE.wash.value.z, 0, "landed");
  model.userData.skywing.f = 1; sky.z = 30; model.position.z = 30; env.waterTime.value = 30.4; plugin.update(sim);
  assert.equal(WATER_CLOSE.wash.value.z, 0, "over dry ground");
});

test("+0 draws: the water is one mesh with one material, and the Hero look adds nothing to the scene", () => {
  for (const id of ["riverlands", "twinrivers", "archipelago", "snowfield"]) {
    const { scene, env } = build(id);
    assert.ok(env.water.isMesh && !Array.isArray(env.water.material), id);
    assert.equal(env.water.castShadow, false, `${id}: no shadow pass for the water`);
    const n = drawables(scene);
    env.update({ time: 3, entities: [], isVisible: () => true }, 0.05);
    assert.equal(drawables(scene), n, `${id}: nothing new drawn`);
    const h = heroView(), m = drawables(h.scene);
    for (let i = 0; i < 5; i++) { h.env.waterTime.value = 40 + i * 0.2; h.plugin.update(h.sim); }
    assert.equal(drawables(h.scene), m, "the plugin builds nothing");
  }
  // The Hero view's per-map inputs: the bank colour from the theme, ice fords on a frozen land only.
  build("snowfield");
  assert.equal(WATER_CLOSE.ice.value, 1);
  build("riverlands");
  assert.equal(WATER_CLOSE.ice.value, 0);
  assert.ok(WATER_CLOSE.bank.value.getHSL({}).l < 0.25, "the bank in the water is shaded");
});
