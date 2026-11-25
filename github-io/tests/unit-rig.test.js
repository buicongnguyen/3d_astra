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

test("unit rig: the Breaker's idle gun rests raised and run in; it runs out and lifts to fire, eased", async () => {
  const { BARREL_POSES, stepBarrel, poseBarrel } = await import("../src/unit-rig.js");
  const pose = BARREL_POSES.get("breaker"), dt = 1 / 60;
  // Owner 2026-11: never droops when not fighting (idle or on the move), shorter than in combat.
  assert.ok(pose.park > 0 && pose.move > 0 && pose.fire > pose.park, JSON.stringify(pose));
  assert.ok(pose.rest < 1);
  const gun = { elevation: pose.park, length: pose.rest };
  for (const moving of [false, true]) {
    for (let i = 0; i < 120; i++) stepBarrel(gun, pose, { moving, attacking: false, dt, rich: true });
    assert.ok(gun.elevation >= pose.park - 1e-9 && gun.length < 1, `moving ${moving}: ${JSON.stringify(gun)}`);
  }
  const idle = { ...gun };
  // No pop: one frame moves only a little, and the gun reaches its firing pose within a second or so.
  stepBarrel(gun, pose, { moving: false, attacking: true, dt, rich: true });
  assert.ok(gun.length - idle.length < 0.03 && gun.elevation - idle.elevation < 0.01, JSON.stringify(gun));
  for (let i = 0; i < 90; i++) stepBarrel(gun, pose, { moving: false, attacking: true, dt, rich: true });
  assert.ok(gun.length > 0.98 && gun.length > idle.length && gun.elevation > idle.elevation + 0.1, JSON.stringify(gun));
  // Reduced motion: the pose still changes, without the tween.
  stepBarrel(gun, pose, { moving: false, attacking: false, dt, rich: true, instant: true });
  assert.deepEqual(gun, { elevation: pose.park, length: pose.rest });
  // Unit motion off: the modelled barrel (level, full length).
  stepBarrel(gun, pose, { moving: true, attacking: false, dt, rich: false, instant: true });
  assert.deepEqual(gun, { elevation: 0, length: 1 });
  // The trunnion stays put whatever the elevation and length, so the barrel stays seated in the turret.
  const THREE = await import("three");
  const rig = new THREE.Object3D(), hinge = [1.4, 0.49];
  for (const [e, l] of [[0.1, 0.74], [0.24, 1], [-0.18, 1]]) {
    poseBarrel(rig, hinge, e, l, 0);
    rig.updateMatrix();
    const p = new THREE.Vector3(0, hinge[0], hinge[1]).applyMatrix4(rig.matrix);
    assert.ok(Math.abs(p.y - hinge[0]) < 1e-9 && Math.abs(p.z - hinge[1]) < 1e-9, `${e} ${l}: ${p.toArray()}`);
    // The muzzle (1.4 units ahead) rises with a positive elevation.
    const m = new THREE.Vector3(0, hinge[0], hinge[1] + 1.4).applyMatrix4(rig.matrix);
    assert.equal(Math.sign(m.y - hinge[0]), Math.sign(e));
  }
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

test("unit rig: every infantry type is rigged; only ranged shooters kneel; Rider rides, Walker stomps", async () => {
  const { RIG_INFANTRY, KNEELERS, GAIT, RIG_HULL } = await import("../src/unit-rig.js");
  const fs = await import("node:fs");
  const balance = JSON.parse(fs.readFileSync(new URL("../src/balance.json", import.meta.url), "utf8")).definitions;
  for (const t of ["ranger", "worker", "vanguard", "medic", "engineer", "antitank", "gunner", "scrapper", "shade", "stalker", "watcher", "rider", "walker"]) assert.ok(RIG_INFANTRY.has(t), t);
  for (const t of KNEELERS) assert.ok(balance[t].range >= 9, `${t} is a ranged shooter`);
  for (const t of ["worker", "medic", "engineer", "vanguard", "rider", "walker"]) assert.ok(!KNEELERS.has(t), `${t} does not kneel`);
  assert.equal(GAIT.rider, "ride"); assert.equal(GAIT.walker, "stomp");
  for (const t of ["tank", "breaker", "scorcher"]) assert.ok(RIG_HULL.has(t), t);
});

test("unit rig: a riding Rider keeps its legs still and rolls by distance; a stomping Walker never runs", () => {
  const ride = infantry(), m = new Float32Array(4);
  for (let i = 0; i < 60; i++) stepInfantry(ride, m, { speed: 6.4, base: 6.4, scale: 1, legLength: 1.15, moving: true, attacking: false, dt: 1 / 60, rich: true, gait: "ride" });
  assert.equal(m[1], 0, "no leg swing");
  assert.ok(Math.abs(m[0] - 6.4) < 1e-6, "x = metres driven");
  const stomp = infantry();
  for (let i = 0; i < 60; i++) stepInfantry(stomp, m, { speed: 1.9, base: 1.9, scale: 1, legLength: 1.8, moving: true, attacking: true, dt: 1 / 60, rich: true, gait: "stomp", kneels: false });
  assert.ok(Math.abs(m[1] - 0.3 * stomp.gait) < 1e-6, "fixed stomp swing");
  assert.ok(Math.abs(stomp.lean) < 1e-9, "no run lean");
});

test("unit rig (creature round): the Acid Hound trots on diagonal pairs; the Vault Sentinel stomps and kneels only when the view says", async () => {
  const { RIG_INFANTRY, KNEELERS, GAIT } = await import("../src/unit-rig.js");
  const fs = await import("node:fs");
  for (const t of ["acidhound", "vaultsentinel"]) { assert.ok(RIG_INFANTRY.has(t), t); assert.ok(!KNEELERS.has(t), `${t} is not a kneeler`); }
  assert.equal(GAIT.acidhound, "trot"); assert.equal(GAIT.vaultsentinel, "stomp");
  const nodes = (name) => {
    const data = fs.readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
    return JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString()).nodes;
  };
  // view.js tags each leg_* subtree with its own hip and knee; the suffix picks the phase (as in view.js).
  const right = (n) => /_R(\d*)$/.test(n);
  const hound = nodes("acidhound"), legs = hound.filter((n) => n.name.startsWith("leg_"));
  assert.equal(legs.length, 4);
  const at = (name) => legs.find((n) => n.name === name).translation; // glTF: +Z is the front
  const same = (a, b) => right(a) === right(b);
  // Diagonals share a phase: front left with hind right, front right with hind left.
  assert.ok(same("leg_L", "leg_hindR_L") && same("leg_R", "leg_hindL_R") && !same("leg_L", "leg_R"));
  assert.ok(at("leg_L")[2] > 0 && at("leg_hindR_L")[2] < 0 && Math.sign(at("leg_L")[0]) === -Math.sign(at("leg_hindR_L")[0]), "leg_L and leg_hindR_L are diagonal");
  for (const leg of legs) assert.ok(leg.children.some((i) => /^Knee/.test(hound[i].name)), `${leg.name}: a Knee_* mesh marks the bend`);
  const sentinel = nodes("vaultsentinel"), hips = sentinel.filter((n) => n.name.startsWith("leg_"));
  assert.deepEqual(hips.map((n) => n.name).sort(), ["leg_L", "leg_R"]);
  for (const hip of hips) assert.ok(hip.children.some((i) => /^Knee/.test(sentinel[i].name)), `${hip.name}: Knee_cap`);
  // A trotting hound runs (wider swing) but its body never pitches.
  const rig = infantry(), m = new Float32Array(4);
  for (let i = 0; i < 90; i++) stepInfantry(rig, m, { speed: 7, base: 7, scale: 1, legLength: 0.58, moving: true, attacking: false, dt: 1 / 60, rich: true, gait: "trot", kneels: false });
  assert.ok(Math.abs(m[1] - 0.6 * rig.gait) < 1e-6, "full trot swing");
  assert.ok(Math.abs(rig.lean) < 1e-9 && m[3] === 1, "no run lean");
});

test("unit rig: wheels are found as round islands; concentric rim and tyre share one axle and radius", async () => {
  const THREE = await import("three");
  const { mergeGeometries } = await import("three/addons/utils/BufferGeometryUtils.js");
  const { tagWheels, BONE } = await import("../src/unit-rig.js");
  const wheel = (z, r) => new THREE.CylinderGeometry(r, r, 0.2, 12).rotateZ(Math.PI / 2).translate(0.8, 0.5, z);
  const g = mergeGeometries([wheel(1, 0.4), wheel(1, 0.25), wheel(-1, 0.4), new THREE.BoxGeometry(0.1, 0.1, 1.2).translate(0, 1.5, 0)]);
  const wheels = tagWheels(g);
  assert.equal(new Set(wheels.map((w) => w.c[1].toFixed(2))).size, 2);
  const a = g.getAttribute("aRig"), seen = new Set();
  for (let i = 0; i < a.count; i++) seen.add(`${a.getX(i)}|${a.getZ(i).toFixed(3)}|${a.getW(i).toFixed(2)}`);
  assert.ok(seen.has(`${BONE.wheel}|2.500|1.00`) && seen.has(`${BONE.wheel}|2.500|-1.00`), [...seen].join(" "));
  assert.ok(seen.has(`${BONE.none}|0.000|0.00`), "the box is not a wheel");
  assert.equal(seen.size, 3);
});
