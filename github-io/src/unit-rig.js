import * as THREE from "three";

// "Shader bones" (view only, prototype): a few rigid groups of a unit model bend in the vertex shader
// instead of being separate scene nodes, so a Ranger's legs draw in its body batch (two fewer
// instanced draws per infantry type, and two fewer in the shadow pass) and still walk, kneel and lean.
//
// Per vertex, aRig = (bone, pivotY, kneeY, pivotZ), fixed at load from the pivot the part sat under:
//   bone 0  infantry body: leans about the hip (pivotY, pivotZ) and drops when kneeling
//   bone 1  left leg, bone 2 right leg: hip swing about (pivotY, pivotZ), knee bend below kneeY
//   bone 3  vehicle hull: pitches about (pivotY, pivotZ) and squats (tracks and wheels stay put)
//   bone 5  wheel: rolls about its own axle (pivotY, pivotZ) by distance x (1 / radius), kneeY holding 1 / radius
//   bone 9  not rigged (drawn as modelled)
// Per instance, aMotion = (stridePhase or distance, gaitAmp, pose, 1 + lean/pitch), written by the view.
// x is the stride phase for walkers, and the distance driven for wheeled units (a Rider, hulls).
// pose is the kneel blend for infantry and the squat depth for hulls. The rest pose is (0, 0, 0, 1),
// which is also WebGL's value for an unbound vec4 attribute, so any draw without per-instance data
// (a portrait, a stray non-instanced copy) shows the model exactly as modelled.
// Every infantry type has the same two leg pivots (leg_L / leg_R at the hip): the Meridian troops with
// Boot/Leg_suit/Shin, the Gunner with Knee_pad, the faction walkers with Upper_leg/Knee/Shin/Boot.
// Creature round: the Acid Hound is a quadruped on the same two bones. Each `leg_*` empty is its own hip
// (and Knee_* mesh) per vertex; the suffix picks the phase (/_R\d*$/ = right, else left), so its
// diagonal pairs leg_L + leg_hindR_L and leg_R + leg_hindL_R trot together. The Vault Sentinel is a
// biped golem (the view sets its kneel when it yields; it is not a KNEELER).
export const RIG_INFANTRY = new Set(["ranger", "worker", "vanguard", "medic", "engineer", "antitank", "gunner",
  "scrapper", "shade", "stalker", "watcher", "rider", "walker", "bulwark", "acidhound", "vaultsentinel"]);
// Ranged shooters kneel to fire when they stand still.
export const KNEELERS = new Set(["ranger", "antitank", "gunner", "stalker", "watcher"]);
// How the legs move: a Rider sits on its bike (legs still, wheels roll); the Walker, the Bulwark and the Sentinel
// stomp (heavy, no run); the Hound trots (runs, but its body never pitches: its legs would come off the body).
export const GAIT = { rider: "ride", walker: "stomp", bulwark: "stomp", vaultsentinel: "stomp", acidhound: "trot" };
// Hulls pitch on their suspension and roll their Wheels* (the Lance buggy is a wheeled hull, like the Scorcher).
export const RIG_HULL = new Set(["tank", "breaker", "scorcher", "lancer"]);
export const isRigType = (type) => RIG_INFANTRY.has(type) || RIG_HULL.has(type);
export const REST_MOTION = [0, 0, 0, 1];
export const BONE = { body: 0, legL: 1, legR: 2, hull: 3, wheel: 5, none: 9 };
// A kneeling Ranger: left foot planted forward (thigh forward, shin down), right knee on the ground.
// Hip angles are about +X (negative swings the foot forward); knee angles bend the shin back.
const GLSL = /* glsl */ `
attribute vec4 aRig;
attribute vec4 aMotion;
vec3 rigRot(vec3 p, vec2 c, float a) {
  float s = sin(a), co = cos(a);
  vec2 q = p.yz - c;
  return vec3(p.x, c.x + q.x * co - q.y * s, c.y + q.x * s + q.y * co);
}
// dir = true for normals: the same rotations about the origin, no translation.
vec3 rigApply(vec3 p, bool dir) {
  float bone = aRig.x;
  if (bone > 8.5) return p;
  float lean = aMotion.w - 1.0;
  vec2 hip = dir ? vec2(0.0) : vec2(aRig.y, aRig.w);
  if (bone < 0.5) {
    p = rigRot(p, hip, lean);
    if (!dir) p.y -= aMotion.z * aRig.y * 0.45;
  } else if (bone < 2.5) {
    bool left = bone < 1.5;
    float ph = aMotion.x + (left ? 0.0 : 3.14159265);
    float amp = aMotion.y, kneel = aMotion.z;
    float hipA = mix(-sin(ph) * amp, left ? -1.1 : 0.1, kneel);
    float kneeA = mix(max(0.0, cos(ph)) * amp * 1.5, left ? 1.95 : 1.5, kneel);
    float below = smoothstep(aRig.z + 0.06, aRig.z - 0.06, position.y);
    p = rigRot(p, dir ? vec2(0.0) : vec2(aRig.z, aRig.w), kneeA * below);
    p = rigRot(p, hip, hipA);
    if (!dir) p.y -= kneel * aRig.y * 0.45;
  } else if (bone < 3.5) {
    p = rigRot(p, hip, lean);
    if (!dir) p.y -= aMotion.z;
  } else if (bone < 5.5) {
    p = rigRot(p, hip, aMotion.x * aRig.z);
  }
  return p;
}
`;
export function rigShader(shader) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${GLSL}`)
    .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal = rigApply(objectNormal, true);")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed = rigApply(transformed, false);");
}
// Patches a material in place for rigged parts: its own patch (rim, team rim) runs first, and the
// program cache key gains "|rig", so rigged and plain parts never share a program by mistake.
// Call it last: later patches that replace customProgramCacheKey would drop the "|rig".
export function addRig(material) {
  const before = material.onBeforeCompile, key = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (before !== THREE.Material.prototype.onBeforeCompile) before.call(material, shader, renderer);
    rigShader(shader);
  };
  material.customProgramCacheKey = () => `${key.call(material)}|rig`;
  return material;
}
// The shadow pass draws rigged batches with this depth material, so shadows kneel and stride too.
let depth = null;
export function rigDepthMaterial() {
  if (!depth) {
    depth = new THREE.MeshDepthMaterial();
    depth.name = "RigDepth";
    depth.onBeforeCompile = rigShader;
    depth.customProgramCacheKey = () => "rig-depth";
  }
  return depth;
}
// Load time: tag a geometry (already in model space) with one bone for all of its vertices.
export function tagBone(geometry, bone, pivotY = 0, kneeY = 0, pivotZ = 0) {
  const n = geometry.getAttribute("position").count, data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) data.set([bone, pivotY, kneeY, pivotZ], i * 4);
  geometry.setAttribute("aRig", new THREE.BufferAttribute(data, 4));
  return geometry;
}
// Blend toward a target independent of frame rate: x += (target - x) * (1 - exp(-k dt)).
export const approach = (x, target, k, dt) => x + (target - x) * (1 - Math.exp(-k * dt));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Per frame for a Ranger. `rig` holds the state, `motion` is the shared per-instance array.
// speed: ground speed from the fixed step (m/s); base: the type's top speed; scale: the model's
// drawn scale; legLength: hip height in model units; rich: the "Unit motion" setting (off = the
// classic swing: no knees, no run lean, no kneel, no flinch).
export function stepInfantry(rig, motion, { speed, base, scale, legLength, moving, attacking, dt, rich, kneels = true, gait = "walk" }) {
  if (gait === "ride") return stepRide(rig, motion, { speed, moving, dt, rich, scale });
  const stomp = gait === "stomp", trot = gait === "trot";
  const run = rich && !stomp ? smooth(0.72, 0.95, speed / Math.max(0.1, base)) : 0;
  const amp = stomp ? 0.3 : trot ? (rich ? 0.42 + 0.18 * run : 0.46) : rich ? 0.36 + 0.24 * run : 0.46;
  const pace = Math.min(1, speed / 1.2);
  if (dt > 0) {
    rig.gait = approach(rig.gait, pace, 10, dt);
    if (pace === 0 && rig.gait < 0.03) rig.gait = 0;
    // Planted feet: one half-cycle covers exactly the ground a straight leg sweeps (2 L sin A).
    const reach = 2 * legLength * scale * Math.sin(amp);
    rig.phase = (rig.phase + (speed * dt * Math.PI) / Math.max(0.05, reach)) % (Math.PI * 200);
    rig.kneel = approach(rig.kneel, rich && kneels && attacking && !moving && speed < 0.05 ? 1 : 0, 15, dt);
    rig.flinch = Math.max(0, rig.flinch - dt * 4.5);
    rig.lean = approach(rig.lean, trot ? 0 : run * 0.17 * rig.gait, 6, dt);
  }
  const swing = amp * rig.gait;
  motion[0] = rig.phase;
  motion[1] = swing;
  motion[2] = rig.kneel;
  const flinch = rich ? Math.sin(rig.flinch * Math.PI) * (trot ? 0.08 : 0.22) : 0;
  motion[3] = 1 + rig.lean + rig.kneel * 0.12 - flinch;
  // Body height: a straight stance leg lowers the hip by L (1 - cos(angle)); feet stay on the ground.
  const angle = swing * Math.sin(rig.phase);
  return -legLength * scale * (1 - Math.cos(angle)) * 0.85;
}
// A Rider: the legs stay on the pegs, the wheels roll with the ground covered, and it leans into speed.
function stepRide(rig, motion, { speed, moving, dt, rich, scale }) {
  if (dt > 0) {
    rig.phase = (rig.phase + (speed * dt) / Math.max(0.1, scale)) % 600;
    rig.lean = approach(rig.lean, rich && moving ? Math.min(1, speed / 6) * 0.08 : 0, 4, dt);
    rig.flinch = Math.max(0, rig.flinch - dt * 4.5);
  }
  motion[0] = rig.phase;
  motion[1] = 0;
  motion[2] = 0;
  motion[3] = 1 + rig.lean - (rich ? Math.sin(rig.flinch * Math.PI) * 0.12 : 0);
  return 0;
}
// Load time: wheels inside one merged mesh (a hull's road wheels, a Rider's two wheels). Vertices are
// grouped into islands (welded by position); round islands are wheels; every island turns about the
// nearest wheel's axle, so hubs and spokes roll with their tyre. aRig = (wheel, axleY, 1 / radius, axleZ).
// Returns the wheels found ({ c: [y, z], r }); none: the geometry is left untagged. `known` wheels (from
// the type's main wheel part) replace this geometry's own, so hubs, rims and spokes share the tyre's axle
// and radius (a Rider's spokes have no round island of their own).
export function tagWheels(geometry, known = null) {
  const fallback = known;
  const pos = geometry.getAttribute("position"), n = pos.count;
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const weld = new Map();
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
    if (weld.has(key)) unite(i, weld.get(key)); else weld.set(key, i);
  }
  const index = geometry.index;
  const tri = index ? index.count : n;
  for (let t = 0; t < tri; t += 3) {
    const a = index ? index.getX(t) : t, b = index ? index.getX(t + 1) : t + 1, c = index ? index.getX(t + 2) : t + 2;
    unite(a, b); unite(b, c);
  }
  const islands = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let box = islands.get(r);
    if (!box) islands.set(r, (box = { min: [Infinity, Infinity], max: [-Infinity, -Infinity] }));
    const y = pos.getY(i), z = pos.getZ(i);
    box.min[0] = Math.min(box.min[0], y); box.max[0] = Math.max(box.max[0], y);
    box.min[1] = Math.min(box.min[1], z); box.max[1] = Math.max(box.max[1], z);
  }
  const wheels = [];
  for (const box of islands.values()) {
    const dy = box.max[0] - box.min[0], dz = box.max[1] - box.min[1];
    box.c = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2];
    if (dy > 0.08 && Math.abs(dy - dz) < 0.2 * Math.max(dy, dz)) wheels.push({ c: box.c, r: Math.max(dy, dz) / 2 });
  }
  // Concentric islands (tyre, rim, hub) are one wheel: they share the axle and the outer radius,
  // so spokes and tyre turn together.
  for (const w of wheels) for (const o of wheels) if (Math.hypot(w.c[0] - o.c[0], w.c[1] - o.c[1]) < 0.06) w.r = Math.max(w.r, o.r);
  // Known wheels (from the type's main wheel part) win over this geometry's own islands.
  if (fallback?.length) wheels.splice(0, wheels.length, ...fallback);
  if (!wheels.length) return wheels;
  const data = new Float32Array(n * 4);
  const owner = new Map();
  for (const [root, box] of islands) {
    let best = null, d = Infinity;
    for (const w of wheels) { const e = Math.hypot(w.c[0] - box.c[0], w.c[1] - box.c[1]); if (e < d) { d = e; best = w; } }
    owner.set(root, d <= best.r * 0.6 ? best : null);
  }
  for (let i = 0; i < n; i++) {
    const w = owner.get(find(i));
    data.set(w ? [BONE.wheel, w.c[0], 1 / w.r, w.c[1]] : [BONE.none, 0, 0, 0], i * 4);
  }
  geometry.setAttribute("aRig", new THREE.BufferAttribute(data, 4));
  return wheels;
}
// Per frame for a tracked hull: a damped spring pitches the hull back on acceleration and forward on
// braking; moving, it squats a little on its suspension. Returns the pitch (radians) and squat (model units).
export function stepHull(rig, motion, { speed, moving, dt, rich, scale = 1 }) {
  if (dt > 0) {
    rig.phase = (rig.phase + (speed * dt) / Math.max(0.1, scale)) % 600; // wheels roll with the ground covered
    const vs = approach(rig.vs, speed, 8, dt);
    const accel = (vs - rig.vs) / dt;
    rig.vs = vs;
    const target = rich ? Math.max(-0.07, Math.min(0.07, -accel * 0.03)) : 0;
    // Spring: f = 2.2 Hz, damping 0.35 (a visible rock that settles in under a second).
    const w = 2 * Math.PI * 2.2, z = 0.35, h = Math.min(dt, 0.05);
    rig.pitchV += (-(w * w) * (rig.pitch - target) - 2 * z * w * rig.pitchV) * h;
    rig.pitch += rig.pitchV * h;
    rig.squat = approach(rig.squat, rich && moving ? 0.035 : 0, 5, dt);
  }
  if (!rich) { rig.pitch = 0; rig.pitchV = 0; }
  motion[0] = rig.phase;
  motion[1] = 0;
  motion[2] = rig.squat;
  motion[3] = 1 + rig.pitch;
  return rig.pitch;
}
