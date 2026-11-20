// Suppression and the Gunner team (AAA round 2, W1-B; docs/CONTENT_SEAMS.md, docs/BALANCE.md
// "Gunner team"). A unit whose definition carries `suppress` pins infantry with its fire:
//   suppress: { per_hit, radius, pin_at, decay, seconds, immune }
// Each direct hit gives `per_hit` suppression points to the target and to every other hostile
// infantry unit within `radius` m of it (not Harvesters, vehicles, flyers, bosses or buildings),
// visited in entity order. Points decay by `decay` a second. At `pin_at` points a unit is Pinned for
// `seconds` (half speed, ×1.5 reload, no abilities), its points reset, and it then shrugs suppression
// off for `immune` seconds, so no unit is ever pinned for more than `seconds` at a time (at most
// seconds / (seconds + immune) = 3/7 of the time under steady fire).
//
// State, created only when a suppressing unit hits someone:
//   t.sup = { pts, at }   points and the time they were last updated (decay is worked out lazily)
//   t.fx.pinned...        the status core's timers (sim/effects.js)
// The Gunner's ability, Crossfire, is a timed buff that adds `crossfire: 2` (points ×2) and takes it
// away again; it autocasts when 3 or more infantry enemies are in range.
//
// Every hook is a no-op for a unit without `suppress` or an ability other than Crossfire, so every
// match without a Gunner plays exactly as before.
import { distance } from "../../data.js";

// Who can be suppressed: infantry on the ground (Medics and Engineers included: a pinned Medic cannot
// cast Triage). Not Harvesters (they flee, they do not fight), vehicles and drones (`mechanical`),
// flyers, bosses, buildings or walls.
export const suppressible = (u) =>
  u.kind === "unit" && u.hp > 0 && !u.mechanical && !u.flying && !u.boss && u.class !== "worker";

// Points on `u` now, after the decay since they were last touched (0 without any).
export const suppressionPoints = (sim, u, decay) => {
  const sup = u.sup;
  if (!sup) return 0;
  return Math.max(0, sup.pts - decay * (sim.time - sup.at));
};

// Gives `amount` points to `u`; pins it at `pin_at`. Returns true when this pinned it.
function suppress(sim, e, u, amount, spec) {
  // Pinned, or shrugging it off afterwards: nothing builds up (points were reset at the pin).
  if (u.fx && (u.fx.pinned > sim.time || u.fx.pinnedImmune > sim.time)) return false;
  const pts = suppressionPoints(sim, u, spec.decay) + amount;
  if (pts < spec.pin_at) {
    if (u.sup) { u.sup.pts = pts; u.sup.at = sim.time; }
    else u.sup = { pts, at: sim.time };
    return false;
  }
  if (!sim.applyStatus(u, "pinned", spec.seconds, { immune: spec.immune })) return false;
  if (u.sup) { u.sup.pts = 0; u.sup.at = sim.time; }
  else u.sup = { pts: 0, at: sim.time };
  return true;
}

export const suppression = {
  id: "suppression",
  statuses: {
    // Pinned: half speed, reloads 50% slower, cannot use an ability. Drawn with the pin icon.
    pinned: { speed: 0.5, reload: 1.5, noCast: true, icon: "pin", label: "Pinned", tint: [1, 0.72, 0.3] },
  },
  onHit(sim, e, t, tags) {
    const spec = e.suppress;
    // Only a shot at a unit suppresses; a gun firing at a building pins nobody standing near it.
    if (!spec || t.kind !== "unit") return;
    const amount = spec.per_hit * (e.crossfire || 1), reach2 = spec.radius * spec.radius;
    // The target, then everyone else within reach of it, in entity order (centre to centre).
    for (const u of sim.entities) {
      if (u !== t) {
        if (u.team === e.team) continue;
        const dx = u.x - t.x, dz = u.z - t.z;
        if (dx * dx + dz * dz > reach2) continue;
      }
      if (!suppressible(u) || !sim.hostile(e.team, u.team)) continue;
      if (suppress(sim, e, u, amount, spec) && u === t) tags.push("pinned");
    }
  },
  abilities: {
    // Crossfire: suppression ×2 for the ability's duration. `crossfire` is a key the Gunner does not
    // have, so it is deleted again when the buff ends.
    crossfire: { use: () => ({ change: { crossfire: 2 } }) },
  },
  autocast(sim, e, a) {
    if (a.id !== "crossfire") return undefined;
    let near = 0;
    for (const t of sim.entities) {
      if (!suppressible(t) || !sim.hostile(e.team, t.team) || !sim.isVisible(t, e.team)) continue;
      if (distance(e, t) - t.radius <= e.range && ++near >= 3) return true;
    }
    return false;
  },
};
