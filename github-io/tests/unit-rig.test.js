import test from "node:test";
import assert from "node:assert/strict";
import { stepInfantry, stepHull, REST_MOTION } from "../src/unit-rig.js";
import { normalize, defaults } from "../src/settings.js";

const infantry = () => ({ phase: 0, gait: 0, kneel: 0, flinch: 0, lean: 0 });
const hull = () => ({ vs: 0, pitch: 0, pitchV: 0, squat: 0 });

test("unit rig: a still, idle Ranger keeps the rest pose (0, 0, 0, 1)", () => {
  const rig = infantry(), motion = new Float32Array(4);
  for (let i = 0; i < 30; i++) stepInfantry(rig, motion, { speed: 0, base: 4.2, scale: 1, legLength: 0.95, moving: false, attacking: false, dt: 1 / 60, rich: true });
  assert.deepEqual(Array.from(motion), REST_MOTION);
});

test("unit rig: firing in place kneels within 0.2 s; Unit motion off never kneels", () => {
  const args = { speed: 0, base: 4.2, scale: 1, legLength: 0.95, moving: false, attacking: true, dt: 1 / 60 };
  const on = infantry(), off = infantry(), m = new Float32Array(4);
  for (let i = 0; i < 12; i++) { stepInfantry(on, m, { ...args, rich: true }); stepInfantry(off, m, { ...args, rich: false }); }
  assert.ok(on.kneel > 0.9, `kneel ${on.kneel}`);
  assert.equal(off.kneel, 0);
});

test("unit rig: the stride is planted (half a cycle covers 2 L sin A of ground)", () => {
  const rig = infantry(), m = new Float32Array(4), dt = 1 / 60, speed = 2;
  for (let i = 0; i < 120; i++) stepInfantry(rig, m, { speed, base: 4.2, scale: 1.2, legLength: 0.95, moving: true, attacking: false, dt, rich: true });
  const start = rig.phase;
  stepInfantry(rig, m, { speed, base: 4.2, scale: 1.2, legLength: 0.95, moving: true, attacking: false, dt, rich: true });
  const amp = 0.36; // walking (speed / base below the run band)
  const expected = (speed * dt * Math.PI) / (2 * 0.95 * 1.2 * Math.sin(amp));
  assert.ok(Math.abs(rig.phase - start - expected) < 1e-9);
});

test("unit rig: a hull pitches nose-up when it pulls away and settles at cruise", () => {
  const rig = hull(), m = new Float32Array(4);
  let min = 0;
  for (let i = 0; i < 20; i++) min = Math.min(min, stepHull(rig, m, { speed: 2.5, moving: true, dt: 1 / 60, rich: true }));
  assert.ok(min < -0.02, `pitch ${min}`);
  for (let i = 0; i < 300; i++) stepHull(rig, m, { speed: 2.5, moving: true, dt: 1 / 60, rich: true });
  assert.ok(Math.abs(rig.pitch) < 0.005);
});

test("settings: Unit motion defaults on and survives a save", () => {
  assert.equal(defaults().unitMotion, true);
  assert.equal(normalize({ version: 1, unitMotion: false }).unitMotion, false);
  assert.equal(normalize({ version: 1 }).unitMotion, true);
});

test("rigged batches: growing frees only the old pose buffer, never the shared vertex data", async () => {
  const THREE = await import("three");
  const { EntityBatches } = await import("../src/entity-batches.js");
  const { tagBone } = await import("../src/unit-rig.js");
  const geometry = tagBone(new THREE.BoxGeometry(1, 1, 1), 0, 0.95, 0.47, 0);
  const material = new THREE.MeshStandardMaterial();
  const batches = new EntityBatches(new THREE.Scene());
  const parts = Array.from({ length: 40 }, () => { const m = new THREE.Mesh(geometry, material); m.updateMatrixWorld(); return m; });
  const released = [];
  batches.begin();
  batches.add(parts[0]);
  let wrapper = [...batches.batches.values()][0].geometry;
  const watch = (g) => g.addEventListener("dispose", () => released.push(Object.keys(g.attributes).concat(g.index ? ["index"] : [])));
  watch(wrapper);
  for (let i = 1; i < 40; i++) {
    batches.add(parts[i]);
    const now = [...batches.batches.values()][0].geometry;
    if (now !== wrapper) { wrapper = now; watch(now); }
  }
  batches.end();
  assert.equal(released.length, 2, "16 -> 32 -> 64: two old wrappers released");
  for (const names of released) assert.deepEqual(names, ["aMotion"]);
  assert.ok(geometry.getAttribute("position") && geometry.getAttribute("aRig"), "the template keeps its vertex data");
  const batch = [...batches.batches.values()][0];
  assert.equal(batch.geometry.getAttribute("aMotion"), batch.motion);
  assert.equal(batch.motion.count, 64);
});
