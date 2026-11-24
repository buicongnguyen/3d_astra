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
});

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, m) => (v > m ? m : v < -m ? -m : v);

// One frame for flyer state `a` (needs nothing but the fields set here): `yaw` is the model's heading, `y` its
// altitude this frame. Writes a.bank and a.pitch (radians) and returns `a`.
export function airMotion(a, type, yaw, y, dt, lively) {
  if (a.lastYaw === undefined) { a.lastYaw = yaw; a.lastY = y; a.bank = 0; a.pitch = 0; a.sway = (a.clock || 0) * 0.7; }
  if (!(dt > 0)) return a;
  const kind = Object.hasOwn(AIR_MOTION.bank, type) ? type : "other";
  let bank = 0, pitch = 0;
  if (lively) {
    const turn = wrap(yaw - a.lastYaw) / dt, climb = (y - a.lastY) / dt;
    // A turn to the left (heading increasing; the craft faces +Z, so its left is +X) rolls it into the turn:
    // the left wing dips, which is a negative roll about the nose (rotation.z, applied last in "YXZ" order).
    bank = clamp(-turn * AIR_MOTION.bank[kind], AIR_MOTION.bankMax[kind]);
    pitch = clamp(-climb * AIR_MOTION.climb, AIR_MOTION.pitchMax);
    if (kind === "balloon") { a.sway += dt * AIR_MOTION.swayRate; bank = Math.sin(a.sway) * AIR_MOTION.sway; }
  }
  a.bank += (bank - a.bank) * Math.min(1, dt * AIR_MOTION.bankRate);
  a.pitch += (pitch - a.pitch) * Math.min(1, dt * AIR_MOTION.pitchRate);
  a.lastYaw = yaw; a.lastY = y;
  return a;
}
