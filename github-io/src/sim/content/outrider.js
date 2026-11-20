// The Outrider drill (AAA round 2, W2-A; U8 slice 1): Sunward Riders kite close-assault units. Under
// the skirmish rule `roster: "expanded"`, when a hostile ground unit whose `range` is at most
// `threat_range` (melee and flame: Vanguard, Scrapper, Shade, Scorcher) comes within `near` m of a
// Rider, the Rider steps `back` m straight away from it, then fights on. The numbers are the
// top-level balance.json key `outrider_drill` ({ faction, types, near, back, every, threat_range });
// the drill touches no existing definition.
//
// It is a passive behaviour, not an ability (the Rider keeps its one ability, Dash), and low micro: it
// needs no command. It runs through the `fight` hook (H20), that is only while the unit is fighting
// an enemy it can see, so it follows the order system instead of fighting it:
//   * never on Hold (Hold means hold); Guard, Aggressive and attack-move all kite;
//   * the step target is checked with nav.canStand and nav.canTraverse (as the boss strafe does,
//     sim/bosses.js); if the straight-back spot is blocked it tries 35 degrees either side, and when
//     all three fail the Rider fights as it does today (never into water, a cliff, a rock or a wall);
//   * at most one step per `every` seconds and at most MAX_STEP seconds long, while the hook returns
//     true (the Rider moves and does not fire); it keeps facing the threat while it backs away.
//
// State is the lazy `e.drill = { at, to?, until? }` on a Rider that has stepped, in an Expanded match
// that plays Sunward; it is saved with the unit, so a save mid-step reloads to the same hash. In every
// other match the hook returns at its first lines and nothing is created.

import balance from "../../balance.json" with { type: "json" };
import { DEFINITIONS as D, distance } from "../../data.js";

export const DRILL = balance.outrider_drill;
const TYPES = new Set(DRILL.types);
// A step never lasts longer than this, however the ground behaves.
export const MAX_STEP = 0.6;
const TURN = 0.61; // 35 degrees

// The nearest hostile ground unit within `near` m (edge to centre) that fights at close range, or null.
export function drillThreat(sim, e, near = DRILL.near) {
  let best = null, bestD = Infinity;
  for (const u of sim.entities) {
    if (u.hp <= 0 || u.kind !== "unit" || u.flying || !u.damage || u.class === "worker" || u.range > DRILL.threat_range) continue;
    if (!sim.hostile(e.team, u.team) || !sim.isVisible(u, e.team)) continue;
    const d = distance(e, u) - u.radius;
    if (d <= near && d < bestD) { best = u; bestD = d; }
  }
  return best;
}

// The first free spot `back` m away from the threat: straight back, then 35 degrees either side.
function spot(sim, e, from) {
  const base = Math.atan2(e.x - from.x, e.z - from.z);
  for (const turn of [0, TURN, -TURN]) {
    const p = { x: e.x + Math.sin(base + turn) * DRILL.back, z: e.z + Math.cos(base + turn) * DRILL.back };
    if (sim.nav.canStand(p.x, p.z, e.radius) && sim.nav.canTraverse(e, p, e.radius)) return p;
  }
  return null;
}

export const outrider = {
  id: "outrider",
  fight(sim, e, t, dt) {
    if (!TYPES.has(e.type) || e.stance === "hold" || sim.ruleOn("roster") !== "expanded" || sim.mission || sim.factionId(e.team) !== DRILL.faction) return undefined;
    const d = e.drill;
    if (d?.to) {
      // Stepping: one tick of the walk back, facing the threat; the step ends on arrival, on blocked
      // ground or after MAX_STEP seconds, and the next tick fights as usual.
      const dx = d.to.x - e.x, dz = d.to.z - e.z, len = Math.hypot(dx, dz), step = Math.min(len, sim.moveSpeed(e) * dt);
      const next = len > 1e-6 ? { x: e.x + (dx / len) * step, z: e.z + (dz / len) * step } : null;
      if (next && sim.time < d.until && len > 0.05 && sim.nav.canTraverse(e, next, e.radius)) {
        e.x = next.x; e.z = next.z; e.moving = true; e.attacking = false;
        const f = drillThreat(sim, e, DRILL.near + DRILL.back) || t;
        e.angle = Math.atan2(f.x - e.x, f.z - e.z);
        return true;
      }
      delete d.to; delete d.until;
      e.moving = false;
      return undefined;
    }
    if (d && sim.time - d.at < DRILL.every) return undefined;
    const threat = drillThreat(sim, e);
    if (!threat) return undefined;
    const to = spot(sim, e, threat);
    e.drill = { at: sim.time, ...(to ? { to, until: sim.time + MAX_STEP } : null) };
    return to ? this.fight(sim, e, t, dt) : undefined;
  },
};
