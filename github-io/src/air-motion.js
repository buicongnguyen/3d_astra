import * as THREE from "three";
// Flyer motion by maths (AAA round 3, R3-W): banking into turns, nose up on a climb (down on a descent), and the
// balloon's slow sway. View only, pure numbers on the flyer's own state (view.js prepareFlyer `air`), no
// allocation. The view applies the result as the model's roll (rotation.z) and an extra pitch (rotation.x) on
// top of its forward-flight nose-down; with motion off or reduced motion every angle eases back to level.
export const AIR_MOTION = Object.freeze({
  // radians of bank per radian-per-second of turn, the cap, and how fast the bank follows (1/s)
  // (roster 2026-11-24: the Veil moth glides into deep banks; the Halo ring hovers nearly level)
  bank: { kite: 0.32, hawk: 0.3, glider: 0.42, balloon: 0, moth: 0.45, halo: 0.2, other: 0.3 },
  bankMax: { kite: 0.42, hawk: 0.38, glider: 0.62, balloon: 0, moth: 0.6, halo: 0.26, other: 0.38 },
  bankRate: 4,
  // radians of pitch per metre-per-second of climb (nose up is negative rotation.x), the cap, the follow rate
  climb: 0.22, pitchMax: 0.3, pitchRate: 5,
  // the balloon swings gently under its envelope instead of banking
  sway: 0.05, swayRate: 0.9,
  // W4 (2026-11-25): the nose dips as a flyer speeds up and lifts as it brakes (radians per m/s^2, per kind, and the
  // cap); braking from cruise into a hover is the flare. Kites and Hawks never land (the sim keeps every flyer
  // aloft), so the flare is the stop over a spot. speedRate: how fast the measured speed follows (1/s).
  accel: { kite: 0.05, hawk: 0.06, glider: 0.035, balloon: 0, moth: 0.04, halo: 0.05, other: 0.045 },
  accelMax: 0.16, speedRate: 3,
});

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, m) => (v > m ? m : v < -m ? -m : v);

// One frame for flyer state `a` (needs nothing but the fields set here): `yaw` is the model's heading, `y` its
// altitude this frame, (x, z) its ground position (optional: without them there is no speed-up dip or flare).
// Writes a.bank and a.pitch (radians) and returns `a`.
export function airMotion(a, type, yaw, y, dt, lively, x = 0, z = 0) {
  if (a.lastYaw === undefined) { a.lastYaw = yaw; a.lastY = y; a.bank = 0; a.pitch = 0; a.sway = (a.clock || 0) * 0.7; }
  if (a.lastX === undefined) { a.lastX = x; a.lastZ = z; a.vs = 0; }
  if (!(dt > 0)) return a;
  const kind = Object.hasOwn(AIR_MOTION.bank, type) ? type : "other";
  // Ground speed, smoothed (frame-to-frame steps are uneven); a jump of more than 2 m is a teleport, not flight.
  const step = Math.hypot(x - a.lastX, z - a.lastZ), vs = a.vs + ((step > 2 ? a.vs : step / dt) - a.vs) * Math.min(1, dt * AIR_MOTION.speedRate);
  const accel = (vs - a.vs) / dt;
  a.vs = vs; a.lastX = x; a.lastZ = z;
  let bank = 0, pitch = 0;
  if (lively) {
    const turn = wrap(yaw - a.lastYaw) / dt, climb = (y - a.lastY) / dt;
    // A turn to the left (heading increasing; the craft faces +Z, so its left is +X) rolls it into the turn:
    // the left wing dips, which is a negative roll about the nose (rotation.z, applied last in "YXZ" order).
    bank = clamp(-turn * AIR_MOTION.bank[kind], AIR_MOTION.bankMax[kind]);
    pitch = clamp(-climb * AIR_MOTION.climb + clamp(accel * AIR_MOTION.accel[kind], AIR_MOTION.accelMax), AIR_MOTION.pitchMax);
    if (kind === "balloon") { a.sway += dt * AIR_MOTION.swayRate; bank = Math.sin(a.sway) * AIR_MOTION.sway; }
  }
  a.bank += (bank - a.bank) * Math.min(1, dt * AIR_MOTION.bankRate);
  a.pitch += (pitch - a.pitch) * Math.min(1, dt * AIR_MOTION.pitchRate);
  a.lastYaw = yaw; a.lastY = y;
  return a;
}

// A flyer's rotors (spin_*: props turn about Z, lift rotors about Y) and the balloon's burner flame (flicker_*),
// found once per model; poseAirParts turns and flickers them from the flyer's clock (a.clock, seconds).
const AXIS_Y = new THREE.Vector3(0, 1, 0), AXIS_Z = new THREE.Vector3(0, 0, 1), SPIN = new THREE.Quaternion();
export function airParts(model, a = { spins: [], flames: [] }) {
  model.traverse((o) => {
    if (o.name.startsWith("spin_")) a.spins.push({ node: o, base: o.quaternion.clone(), axis: /^spin_prop/.test(o.name) ? AXIS_Z : AXIS_Y, rate: /^spin_prop/.test(o.name) ? 34 : 26 });
    else if (o.name.startsWith("flicker_")) a.flames.push({ node: o, base: o.scale.y });
  });
  return a;
}
export function poseAirParts(a, lively) {
  for (const s of a.spins) s.node.quaternion.copy(s.base).multiply(SPIN.setFromAxisAngle(s.axis, lively ? (a.clock * s.rate) % (Math.PI * 2) : 0.6));
  for (const f of a.flames) f.node.scale.y = f.base * (lively ? 0.82 + 0.22 * Math.sin(a.clock * 17) + 0.1 * Math.sin(a.clock * 31 + 1.3) : 1);
}
