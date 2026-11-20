// Facing armour (AAA round 2, W2-A; docs/CONTENT_SEAMS.md). A target whose definition says
// `facing: { front, rear }` takes `front` x damage from shots that arrive within its front arc and
// `rear` x from shots that arrive from behind; shots from the side are unchanged. The Rampart is the
// first unit with it (balance.json), and any later unit gets the rule by writing the same field.
//
// How it reads the geometry: the target's heading is `e.angle` (sim/combat.js sets it to
// atan2(dx, dz), so the heading vector is (sin, cos)); the shot arrives from the attacker's side. The
// dot product of the two unit vectors is above FRONT (0.55, about 57 degrees either side of the
// heading) for a front hit and below -FRONT for a rear hit. The shot's own target tags the shot
// "front" or "rear" (the shot event's `tags`, read by the weapon looks and the labels). It applies to
// direct hits and to splash victims (the hitScale hook is called for both); strikes, zones and boss
// zones never go through hit(), so they are untouched.
//
// Inert for everything that is not a facing target: the hook answers undefined (a factor of exactly
// 1), keeps no state and adds no tag.

export const FRONT = 0.55;

// "front", "rear" or "side" for a shot from attacker `e` at target `t` (a pure function of positions
// and the target's heading, so tests and the field guide can ask it too).
export function arc(e, t) {
  const dx = e.x - t.x, dz = e.z - t.z, d = Math.hypot(dx, dz);
  if (d < 1e-6) return "side";
  const dot = (Math.sin(t.angle || 0) * dx + Math.cos(t.angle || 0) * dz) / d;
  return dot > FRONT ? "front" : dot < -FRONT ? "rear" : "side";
}

export const facing = {
  id: "facing",
  hitScale(sim, e, t, tags) {
    const f = t.facing;
    if (!f) return undefined;
    const side = arc(e, t);
    if (side === "side") return undefined;
    tags.push(side);
    return f[side];
  },
};
