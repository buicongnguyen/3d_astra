import * as THREE from "three";

// "Shader bones" (view only, prototype): a few rigid groups of a unit model bend in the vertex shader
// instead of being separate scene nodes, so a Ranger's legs draw in its body batch (two fewer
// instanced draws per infantry type, and two fewer in the shadow pass) and still walk, kneel and lean.
//
// Per vertex, aRig = (bone, pivotY, kneeY, pivotZ), fixed at load from the pivot the part sat under:
//   bone 0  infantry body: leans about the hip (pivotY, pivotZ) and drops when kneeling
//   bone 1  left leg, bone 2 right leg: hip swing about (pivotY, pivotZ), knee bend below kneeY
//   bone 3  vehicle hull: pitches about (pivotY, pivotZ) and squats (tracks and wheels stay put)
//   bone 9  not rigged (drawn as modelled)
// Per instance, aMotion = (stridePhase, gaitAmp, pose, 1 + lean/pitch), written by the view (WorldView.stepRig).
// pose is the kneel blend for infantry and the squat depth for hulls. The rest pose is (0, 0, 0, 1),
// which is also WebGL's value for an unbound vec4 attribute, so any draw without per-instance data
// (a portrait, a stray non-instanced copy) shows the model exactly as modelled.
export const RIG_INFANTRY = new Set(["ranger"]);
export const RIG_HULL = new Set(["tank"]);
export const isRigType = (type) => RIG_INFANTRY.has(type) || RIG_HULL.has(type);
export const REST_MOTION = [0, 0, 0, 1];
export const BONE = { body: 0, legL: 1, legR: 2, hull: 3, none: 9 };
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
export function stepInfantry(rig, motion, { speed, base, scale, legLength, moving, attacking, dt, rich }) {
  const run = rich ? smooth(0.72, 0.95, speed / Math.max(0.1, base)) : 0;
  const amp = rich ? 0.36 + 0.24 * run : 0.46;
  const pace = Math.min(1, speed / 1.2);
  if (dt > 0) {
    rig.gait = approach(rig.gait, pace, 10, dt);
    if (pace === 0 && rig.gait < 0.03) rig.gait = 0;
    // Planted feet: one half-cycle covers exactly the ground a straight leg sweeps (2 L sin A).
    const reach = 2 * legLength * scale * Math.sin(amp);
    rig.phase = (rig.phase + (speed * dt * Math.PI) / Math.max(0.05, reach)) % (Math.PI * 200);
    rig.kneel = approach(rig.kneel, rich && attacking && !moving && speed < 0.05 ? 1 : 0, 15, dt);
    rig.flinch = Math.max(0, rig.flinch - dt * 4.5);
    rig.lean = approach(rig.lean, run * 0.17 * rig.gait, 6, dt);
  }
  const swing = amp * rig.gait;
  motion[0] = rig.phase;
  motion[1] = swing;
  motion[2] = rig.kneel;
  const flinch = rich ? Math.sin(rig.flinch * Math.PI) * 0.22 : 0;
  motion[3] = 1 + rig.lean + rig.kneel * 0.12 - flinch;
  // Body height: a straight stance leg lowers the hip by L (1 - cos(angle)); feet stay on the ground.
  const angle = swing * Math.sin(rig.phase);
  return -legLength * scale * (1 - Math.cos(angle)) * 0.85;
}
// Per frame for a tracked hull: a damped spring pitches the hull back on acceleration and forward on
// braking; moving, it squats a little on its suspension. Returns the pitch (radians) and squat (model units).
export function stepHull(rig, motion, { speed, moving, dt, rich }) {
  if (dt > 0) {
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
  motion[0] = 0;
  motion[1] = 0;
  motion[2] = rig.squat;
  motion[3] = 1 + rig.pitch;
  return rig.pitch;
}
