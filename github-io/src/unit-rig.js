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
//   bone 6  Skywing's left wing, bone 7 its right wing: aRig = (bone, hipY, hingeX, hingeY); folds about the axis
//           through the back (model Z) at the hinge, then leans with the body about the hip
//   bone 8  Skywing's arms and weapon: aRig = (bone, hipY, shoulderY, shoulderZ); raised about the shoulder line in
//           flight, then leans with the body
//   bone 9  not rigged (drawn as modelled)
// Per instance, aMotion = (stridePhase or distance, gaitAmp, pose, 1 + lean/pitch), written by the view.
// x is the stride phase for walkers, and the distance driven for wheeled units (a Rider, hulls).
// pose is the kneel blend for infantry and the squat depth for hulls. Skywing (src/skywing-view.js) never kneels:
// its pose is minus its flight blend (0 on the ground: wings folded, arms down; -1 in the air: wings spread as
// modelled, arms raised), so a kneel reads max(0, pose) and the flight max(0, -pose). The rest pose is (0, 0, 0, 1),
// which is also WebGL's value for an unbound vec4 attribute, so any draw without per-instance data
// (a portrait, a stray non-instanced copy) shows the model exactly as modelled.
// Every infantry type has the same two leg pivots (leg_L / leg_R at the hip): the Meridian troops with
// Boot/Leg_suit/Shin, the Gunner with Knee_pad, the faction walkers with Upper_leg/Knee/Shin/Boot.
// Creature round: the Acid Hound is a quadruped on the same two bones. Each `leg_*` empty is its own hip
// (and Knee_* mesh) per vertex; the suffix picks the phase (/_R\d*$/ = right, else left), so its
// diagonal pairs leg_L + leg_hindR_L and leg_R + leg_hindL_R trot together. The Vault Sentinel is a
// biped golem (the view sets its kneel when it yields; it is not a KNEELER).
export const RIG_INFANTRY = new Set(["ranger", "worker", "vanguard", "medic", "engineer", "antitank", "gunner",
  "scrapper", "shade", "stalker", "watcher", "rider", "walker", "bulwark", "acidhound", "vaultsentinel", "skywing"]);
// Ranged shooters kneel to fire when they stand still.
export const KNEELERS = new Set(["ranger", "antitank", "gunner", "stalker", "watcher"]);
// W4 (2026-11-25): how each shooter sets itself to fire, standing still. kneel: the kneel blend it goes down to
// (1 = the full kneel; the heavy walkers only drop into a braced half-crouch, feet apart, knees bent); lean: the
// body's extra pitch at that pose (radians, + = hunched forward over the gun, - = rocked back under a launcher).
// Every KNEELER kneels fully; the gunner team hunches over its machine gun, the sniper settles over its scope.
export const STANCE = Object.freeze({
  ranger: Object.freeze({ kneel: 1, lean: 0 }), watcher: Object.freeze({ kneel: 1, lean: 0.04 }),
  gunner: Object.freeze({ kneel: 1, lean: 0.17 }), antitank: Object.freeze({ kneel: 1, lean: -0.06 }), stalker: Object.freeze({ kneel: 1, lean: 0.12 }),
  walker: Object.freeze({ kneel: 0.3, lean: 0.07 }), bulwark: Object.freeze({ kneel: 0.42, lean: 0.12 }),
});
// How the legs move: a Rider sits on its bike (legs still, wheels roll); the Walker, the Bulwark and the Sentinel
// stomp (heavy, no run); the Hound trots (runs, but its body never pitches: its legs would come off the body).
export const GAIT = { rider: "ride", walker: "stomp", bulwark: "stomp", vaultsentinel: "stomp", acidhound: "trot" };
// Hulls pitch on their suspension and roll their Wheels* (the Lance buggy is a wheeled hull, like the Scorcher).
// Unit review 2026-11-25: the Rampart (tracked, road wheels named Wheels), the Sunward Wagon and the Carrier
// truck drove with still wheels and a rigid body; they are hulls too.
export const RIG_HULL = new Set(["tank", "breaker", "scorcher", "lancer", "rampart", "wagon", "carrier"]);
export const isRigType = (type) => RIG_INFANTRY.has(type) || RIG_HULL.has(type);
export const REST_MOTION = [0, 0, 0, 1];
export const BONE = { body: 0, legL: 1, legR: 2, hull: 3, wheel: 5, wingL: 6, wingR: 7, arms: 8, none: 9 };
// Skywing's jet-wing (the model: tools/blender/generate_skywing.py): on the ground each wing turns FOLD radians
// about the axis through the back, so its tip points down the legs; in the air the arms raise RAISE radians about
// the shoulder line and move SHIFT to the right, so the weapon points ahead past the helmet.
export const SKYWING_POSE = Object.freeze({ fold: 1.36, raise: 1.18, shift: 0.14 });
// A kneeling Ranger: left foot planted forward (thigh forward, shin down), right knee on the ground.
// Hip angles are about +X (negative swings the foot forward); knee angles bend the shin back.
const glslFloat = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
const FOLD = glslFloat(SKYWING_POSE.fold), RAISE = glslFloat(SKYWING_POSE.raise), SHIFT = glslFloat(SKYWING_POSE.shift);
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
  if (bone > 5.5) {
    // Skywing: the wings fold on the ground (air 0) and spread in flight (air 1); the arms raise in flight.
    float air = max(0.0, -aMotion.z);
    if (bone < 7.5) {
      float a = (1.0 - air) * ${FOLD} * (bone < 6.5 ? 1.0 : -1.0), s = sin(a), c = cos(a);
      vec2 h = dir ? vec2(0.0) : vec2(aRig.z, aRig.w), q = p.xy - h;
      p.xy = h + vec2(q.x * c - q.y * s, q.x * s + q.y * c);
    } else {
      p = rigRot(p, dir ? vec2(0.0) : aRig.zw, -air * ${RAISE});
      if (!dir) p.x += air * ${SHIFT};
    }
    return rigRot(p, dir ? vec2(0.0) : vec2(aRig.y, 0.0), lean);
  }
  if (bone < 0.5) {
    p = rigRot(p, hip, lean);
    if (!dir) p.y -= max(0.0, aMotion.z) * aRig.y * 0.45;
  } else if (bone < 2.5) {
    bool left = bone < 1.5;
    float ph = aMotion.x + (left ? 0.0 : 3.14159265);
    float amp = aMotion.y, kneel = max(0.0, aMotion.z);
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
// Unit motion: barrels that move with the unit's state (view.js BarrelRig, turned about its trunnion).
// Elevation in radians from the modelled pose; `rest` is the barrel's length out of combat as a fraction
// of the modelled barrel. Owner 2026-11: the Breaker's gun must not droop when it is not fighting; it
// rests a little raised with the barrel run in (shorter), and to fire it runs out to full length and
// lifts. The Scorcher had the same droop (its nozzle carried 0.18 rad down, aimed into the sand at rest);
// unit review 2026-11-25: it now carries it level and lifts a little to burn. No pose may dip a barrel
// below its modelled line out of combat (tests/unit-rig.test.js).
export const BARREL_POSES = new Map([
  ["breaker", { move: 0.1, park: 0.1, fire: 0.24, rest: 0.74 }],
  ["scorcher", { move: 0.03, park: 0.03, fire: 0.14, rest: 1 }],
]);
// Owner 2026-11: each shot snaps the barrel in (SNAP.in seconds) then lets it run back out (SNAP.out),
// by SNAP.depth of its length at the deepest.
export const SNAP = Object.freeze({ in: 0.1, out: 0.4, depth: 0.22 });
// A barrel's state: `length` eases between rest and combat; `drawn` is that length with the shot snap.
export const newGun = (elevation = 0, length = 1) => ({ elevation, length, shot: Infinity, drawn: length });
// The view calls this on the unit's own shot event (not under reduced motion or with combat motion off).
export function fireBarrel(gun) { gun.shot = 0; }
// Per frame: ease `gun` toward the pose for the unit's state and play any shot snap. rich: the "Unit
// motion" setting (off = the modelled pose); instant: reduced motion (no tween and no snap, the pose
// is still shown).
export function stepBarrel(gun, pose, { moving, attacking, dt, rich, instant = false }) {
  const elevation = !rich ? 0 : attacking ? pose.fire : moving ? pose.move : pose.park;
  const length = !rich || attacking ? 1 : pose.rest;
  if (instant) { gun.elevation = elevation; gun.length = length; gun.shot = Infinity; }
  else if (dt > 0) {
    gun.elevation = approach(gun.elevation, elevation, 3, dt); gun.length = approach(gun.length, length, 5, dt);
    gun.shot += dt;
  }
  const t = gun.shot, dip = !rich ? 0 : t < SNAP.in ? t / SNAP.in : 1 - smooth(SNAP.in, SNAP.in + SNAP.out, t);
  gun.drawn = gun.length * (1 - SNAP.depth * dip);
  return gun;
}
// Pose a barrel rig about its trunnion (hinge = [y, z] in the rig's frame: the barrel's rear at mid
// height): raised by `elevation`, scaled along its own axis to `length` (the rear stays seated in the
// turret, so no gap opens), then pushed back along that axis by `kick` (recoil). Scale lives in the
// part's matrix, so the instanced batches draw it with no extra call.
export function poseBarrel(rig, hinge, elevation, length, kick) {
  const a = -elevation, c = Math.cos(a), s = Math.sin(a), ty = hinge[0], tz = hinge[1];
  rig.rotation.x = a;
  rig.scale.z = length;
  rig.position.set(0, ty - ty * c + length * tz * s + kick * s, tz - ty * s - length * tz * c - kick * c);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Per frame for a Ranger. `rig` holds the state, `motion` is the shared per-instance array.
// speed: ground speed from the fixed step (m/s); base: the type's top speed; scale: the model's
// drawn scale; legLength: hip height in model units; rich: the "Unit motion" setting (off = the
// classic swing: no knees, no run lean, no kneel, no flinch); stance: STANCE[type] (how it sets
// itself to fire; `kneels` alone means the full kneel). Besides `motion` and the returned lift, it
// leaves rig.tilt: the model's roll (radians) this frame, the flinch's sideways jerk and a stomp's sway.
export function stepInfantry(rig, motion, { speed, base, scale, legLength, moving, attacking, dt, rich, kneels = true, gait = "walk", stance = null }) {
  if (gait === "ride") return stepRide(rig, motion, { speed, moving, dt, rich, scale });
  const stomp = gait === "stomp", trot = gait === "trot";
  const run = rich && !stomp ? smooth(0.72, 0.95, speed / Math.max(0.1, base)) : 0;
  const amp = stomp ? 0.3 : trot ? (rich ? 0.42 + 0.18 * run : 0.46) : rich ? 0.36 + 0.24 * run : 0.46;
  const pace = Math.min(1, speed / 1.2);
  const set = stance || (kneels ? FULL_KNEEL : null);
  if (dt > 0) {
    rig.gait = approach(rig.gait, pace, 10, dt);
    if (pace === 0 && rig.gait < 0.03) rig.gait = 0;
    // Planted feet: one half-cycle covers exactly the ground a straight leg sweeps (2 L sin A).
    const reach = 2 * legLength * scale * Math.sin(amp);
    rig.phase = (rig.phase + (speed * dt * Math.PI) / Math.max(0.05, reach)) % (Math.PI * 200);
    rig.kneel = approach(rig.kneel, rich && set && attacking && !moving && speed < 0.05 ? set.kneel : 0, 15, dt);
    rig.lean = approach(rig.lean, trot ? 0 : run * 0.17 * rig.gait, 6, dt);
  }
  stepFlinch(rig, dt, rich);
  const swing = amp * rig.gait;
  motion[0] = rig.phase;
  motion[1] = swing;
  motion[2] = rig.kneel;
  const brace = set ? (rig.kneel / set.kneel) * set.lean : 0;
  // A trotting Hound barely pitches (its legs would come off the body); it rolls instead.
  motion[3] = 1 + rig.lean + rig.kneel * 0.12 + brace + (trot ? rig.flinch * 0.35 : rig.flinch);
  rig.tilt = rig.roll;
  // Body height: a straight stance leg lowers the hip by L (1 - cos(angle)); feet stay on the ground.
  const angle = swing * Math.sin(rig.phase);
  let lift = -legLength * scale * (1 - Math.cos(angle)) * 0.85;
  if (stomp && rich && rig.gait > 0) {
    // Heavy walk (W4): each footfall (the legs at full spread, |sin phase| = 1) lands with a dip of the body and a
    // nod, and the weight sways over the stance leg once a cycle. All of it rides the stride phase, which only
    // the ground actually covered advances, so a stopped walker stands still and the feet never slide.
    const beat = stompBeat(rig.phase), g = rig.gait;
    lift -= beat * STOMP.dip * legLength * scale * g;
    motion[3] += beat * STOMP.nod * g;
    rig.tilt += Math.cos(rig.phase) * STOMP.sway * g;
  }
  return lift;
}
const FULL_KNEEL = Object.freeze({ kneel: 1, lean: 0 });
// Heavy walk: dip (leg lengths) and nod (radians) at each footfall, sway (radians) over the stance leg, and
// beat: how much of the stride (radians of phase) after a footfall the dip lasts.
export const STOMP = Object.freeze({ dip: 0.05, nod: 0.035, sway: 0.04, beat: 0.9 });
// 0 between steps, rising to 1 and back within STOMP.beat radians of stride after each footfall.
export function stompBeat(phase) {
  const f = (((phase - Math.PI / 2) % Math.PI) + Math.PI) % Math.PI;
  return f < STOMP.beat ? Math.sin((f / STOMP.beat) * Math.PI) : 0;
}
// Hit flinch (W4, 2026-11-25): a damped spring per unit, kicked by the unit's own impact events (view.js event;
// the Field Guide's 3D view on Fire). rig.flinch is the body's pitch offset (- = jerked back) and rig.roll the
// model's sideways jerk, both radians; both spring back to 0. infantry / roll: the biggest jerk (radians) for a
// heavy hit; hull / hullRoll: a vehicle's rock on its suspension (stepHull's spring). hz, damping: the infantry spring.
export const FLINCH = Object.freeze({ infantry: 0.26, roll: 0.1, hull: 0.07, hullRoll: 0.05, hz: 3.2, damping: 0.45 });
// How hard a hit lands from the share of the unit's whole health (hp + shield) it took: a scratch still shows.
export const hitScale = (share) => Math.min(1, 0.3 + Math.max(0, share || 0) * 6);
// A spring released from rest with velocity v peaks near v / w x PEAK (damping about 0.4): the kick for a peak.
const PEAK = 0.62, HULL_W = 2 * Math.PI * 2.2, HULL_Z = 0.35;
// Kick `rig` for a hit that took `share` of its health from the direction `from` (radians, the world heading
// from the unit toward the shooter, the same convention as the unit's `angle`) while it faces `facing`.
// A hit from the front jerks it back, one from behind forward, one from the side rolls it away.
export function hitFlinch(rig, share, from, facing, kind = "infantry") {
  const k = hitScale(share), d = from - facing, along = Math.cos(d), across = Math.sin(d);
  if (kind === "hull") {
    rig.pitchV += -along * k * FLINCH.hull * (HULL_W / PEAK);
    rig.rollV = (rig.rollV || 0) + across * k * FLINCH.hullRoll * (HULL_W / PEAK);
  } else {
    const w = 2 * Math.PI * FLINCH.hz;
    rig.flinchV = (rig.flinchV || 0) - along * k * FLINCH.infantry * (w / PEAK);
    rig.rollV = (rig.rollV || 0) + across * k * FLINCH.roll * (w / PEAK);
  }
  return rig;
}
// One semi-implicit spring step of the flinch (pitch) and roll offsets; off (rich false) holds them at 0.
function stepFlinch(rig, dt, rich) {
  if (!rich || !Number.isFinite(rig.flinch)) { rig.flinch = 0; rig.flinchV = 0; rig.roll = 0; rig.rollV = 0; return; }
  if (!(dt > 0)) return;
  // Sub-steps of at most 1/60 s keep the spring's jerk the same size at 30 fps (a long step damps it away) and
  // let a slow frame (up to 0.25 s) settle it in real time.
  const w = 2 * Math.PI * FLINCH.hz, z = FLINCH.damping, n = Math.min(16, Math.ceil(dt * 60 - 1e-6)), h = Math.min(dt, 0.25) / n;
  rig.flinchV ||= 0; rig.roll ||= 0; rig.rollV ||= 0;
  for (let i = 0; i < n; i++) {
    rig.flinchV += (-(w * w) * rig.flinch - 2 * z * w * rig.flinchV) * h;
    rig.flinch += rig.flinchV * h;
    rig.rollV += (-(w * w) * rig.roll - 2 * z * w * rig.rollV) * h;
    rig.roll += rig.rollV * h;
  }
}
// A Rider: the legs stay on the pegs, the wheels roll with the ground covered, and it leans into speed.
function stepRide(rig, motion, { speed, moving, dt, rich, scale }) {
  if (dt > 0) {
    rig.phase = (rig.phase + (speed * dt) / Math.max(0.1, scale)) % 600;
    rig.lean = approach(rig.lean, rich && moving ? Math.min(1, speed / 6) * 0.08 : 0, 4, dt);
  }
  stepFlinch(rig, dt, rich);
  motion[0] = rig.phase;
  motion[1] = 0;
  motion[2] = 0;
  motion[3] = 1 + rig.lean + rig.flinch * 0.5;
  rig.tilt = rig.roll;
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
    // W4: sub-steps of at most 1/60 s, up to 0.25 s a frame (a hit's rock keeps its size at 30 fps and settles in
    // real time on a slow frame); a hit (hitFlinch) also rocks
    // the vehicle sideways on the same spring.
    const w = HULL_W, z = HULL_Z, n = Math.min(16, Math.ceil(dt * 60 - 1e-6)), h = Math.min(dt, 0.25) / n;
    rig.roll ||= 0; rig.rollV ||= 0;
    for (let i = 0; i < n; i++) {
      rig.pitchV += (-(w * w) * (rig.pitch - target) - 2 * z * w * rig.pitchV) * h;
      rig.pitch += rig.pitchV * h;
      rig.rollV += (-(w * w) * rig.roll - 2 * z * w * rig.rollV) * h;
      rig.roll += rig.rollV * h;
    }
    rig.squat = approach(rig.squat, rich && moving ? 0.035 : 0, 5, dt);
  }
  if (!rich) { rig.pitch = 0; rig.pitchV = 0; rig.roll = 0; rig.rollV = 0; }
  rig.tilt = rig.roll || 0;
  motion[0] = rig.phase;
  motion[1] = 0;
  motion[2] = rig.squat;
  motion[3] = 1 + rig.pitch;
  return rig.pitch;
}

// Recoil (view.js shot events; the Field Guide's 3D view plays the same): a cannon's barrel runs back along
// its axis for RECOIL.barrel seconds by up to RECOIL.travel; every shooter's body rocks back for RECOIL.body
// seconds by its kick size (rocket troops and hulls most, rifles barely).
export const RECOIL = Object.freeze({ barrel: 0.22, travel: 0.18, body: 0.16 });
export const barrelKick = (t) => Math.sin((t / RECOIL.barrel) * Math.PI) * RECOIL.travel;
export const bodyKick = (t, size) => Math.sin((t / RECOIL.body) * Math.PI) * size;
export const kickSize = (kind) => (kind === "rocket" ? 0.11 : kind === "cannon" ? 0.07 : 0.03);
// A turret rides its hull's pitch and squat about the hull pivot (hullPivot = [y, z]), then turns in the hull's frame.
export function poseTurretOnHull(turret, base, hullPivot, pitch, squat) {
  const [cy, cz] = hullPivot, oy = base.y - cy, oz = base.z - cz, c = Math.cos(pitch), s = Math.sin(pitch);
  turret.rotation.x = pitch;
  turret.position.set(base.x, cy + oy * c - oz * s - squat, cz + oy * s + oz * c);
}
// Unrigged leg pivots (legs = [{ node, base }]) swing in opposite phase with the stride.
export function swingLegs(legs, stride, gait) {
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    leg.node.quaternion.copy(leg.base);
    if (gait > 0) leg.node.rotateX(Math.sin(stride + i * Math.PI) * 0.46 * gait);
  }
}

// Infantry deaths (W4, 2026-11-25; view.js updateDying, the plain "ballistic" look). Each fallen trooper picks one
// of three falls from its id, so a squad cut down together does not drop in step: "back" (thrown back off its
// feet, the old fall), "knees" (the legs give, it drops to its knees through the kneel pose, then slumps forward
// onto its face) and "twist" (spun half round by the hit, it topples onto its side). After the fall it lies still,
// then sinks into the ground over FALL.sink seconds and is gone at `life`. animate false (combat motion off or
// reduced motion): the fall's last pose at once and no sink (same end state, nothing moves).
export const FALLS = Object.freeze(["back", "knees", "twist"]);
// depth: how far it sinks (world units); shrink: the share of its size it loses meanwhile (a back-fallen rifle points
// up a metre: sinking alone left it standing out of the sand).
export const FALL = Object.freeze({ life: 2.4, ecoLife: 1.8, sink: 0.7, depth: 1.3, shrink: 0.7 });
export const fallFor = (seed) => FALLS[((Math.imul((seed | 0) + 0x9e37, 0x85ebca6b) >>> 13) % 3 + 3) % 3];
// Writes out = { pitch, roll, yaw, kneel, drop, size } for a fall of `kind` at age t (seconds) and returns it.
// pitch: rotation.x (+ = forward onto the face), roll: rotation.z, yaw: extra turn, kneel: the rig's kneel blend,
// drop: how far the body has sunk (world units), size: its scale factor (1 until it sinks), side: +1 / -1 (which
// way a twist or roll goes).
export function infantryFall(out, kind, t, life, animate, side = 1) {
  const T = animate ? t : 1e3, e = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
  out.pitch = 0; out.roll = 0; out.yaw = 0; out.kneel = 0;
  if (kind === "knees") { out.kneel = e(T / 0.28); out.pitch = e((T - 0.3) / 0.55) * 1.38; }
  else if (kind === "twist") { out.yaw = side * e(T / 0.5) * 0.9; out.roll = side * e((T - 0.12) / 0.55) * 1.42; out.pitch = -e(T / 0.5) * 0.18; }
  else out.pitch = -e(T / 0.5) * 1.45;
  const sink = animate ? e((t - (life - FALL.sink)) / FALL.sink) : 0;
  out.drop = sink * FALL.depth; out.size = 1 - sink * FALL.shrink;
  return out;
}

// The Iron Sovereign's two leg tripods (boss-view.js; W4 2026-11-25: in real play its 0.8 m/s march only moved
// them a few centimetres, so they read as frozen). Tripod A lifts and swings forward while the stride phase
// runs 0..PI and lands at PI (the dust and camera thump in boss-presence-view.js fall on the same multiples of
// PI); tripod B does the same half a cycle later. On the ground a tripod slides back exactly as fast as the body
// moves on, so its feet stay planted: half a cycle covers PI / rate metres of ground (view.js: stride +=
// speed x dt x rate), so the sweep is +/- half of that in model units (divide by the model's scale), up to maxSweep.
// Writes out = { az, ay, bz, by } (model-unit offsets of tripods A and B) and the body's dip at each landing.
// maxSweep: the sweep's cap (model units): further out, the rigid tripods' hips leave the dome (at the 0.8 m/s march
// the planted sweep is about 0.64, so the feet slip a little, a fifth of a step, rather than the legs come apart).
export const TRIPOD = Object.freeze({ lift: 0.22, dip: 0.05, beat: 0.8, maxSweep: 0.5 });
// A tripod's fore-aft offset: an eased swing forward (-amp to +amp) in the air, a straight-line slide back on the ground.
function tripodZ(stride, amp) {
  const s = ((stride % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return s < Math.PI ? -Math.cos(s) * amp : amp - (2 * amp * (s - Math.PI)) / Math.PI;
}
export function stepTripods(out, stride, gait, rate, scale) {
  const g = Math.min(1, gait * 4), amp = Math.min(TRIPOD.maxSweep, Math.PI / rate / 2 / Math.max(0.05, scale)) * g;
  out.az = tripodZ(stride, amp); out.bz = tripodZ(stride + Math.PI, amp);
  out.ay = Math.max(0, Math.sin(stride)) * TRIPOD.lift * g; out.by = Math.max(0, -Math.sin(stride)) * TRIPOD.lift * g;
  const f = ((stride % Math.PI) + Math.PI) % Math.PI;
  out.dip = f < TRIPOD.beat ? Math.sin((f / TRIPOD.beat) * Math.PI) * TRIPOD.dip * g : 0;
  return out;
}
