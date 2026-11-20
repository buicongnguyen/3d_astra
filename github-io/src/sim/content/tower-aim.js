// Tower targeting (AAA round 2, W1-F, idea D3): what a crewed Frontier Defence tower shoots first.
//
// A tower picks its target by the `defenseTarget` rule (sim/combat.js): combat units before
// Harvesters before buildings, the nearest in each group. This module adds a choice on top, kept
// on the tower as `e.aim`, set by the command `padAim { building, aim }`:
//   near    (default; today's rule, the field is deleted again)
//   first   the unit with the least road left to walk (the one closest to leaking)
//   strong  the unit with the most health plus shield
//   air     flyers first (offered only to crews that hit air), then the nearest
// The choice only reorders the combat units a tower may already shoot: the reach, height, sight
// and clear-line checks are those of `defenseTarget`, and units still rank before Harvesters and
// buildings. `e.aim` exists only once a tower's aim was changed, so a match that never sends the
// command (the DefenceBot never does) is byte-identical to one without this module.
import { distance, hyp } from "../../data.js";

export const AIMS = ["near", "first", "strong", "air"];
const SPECIAL = new Set(["first", "strong", "air"]);

// Metres of road a hostile unit still has to walk to the exit: from where it stands to the end of
// its current leg, then the legs after it. Infinity for a unit that is not on a route (such a unit
// ranks last under "first"). Pure: reads the route order and the level only.
export function roadLeft(sim, t) {
  const o = t.orders?.[0];
  if (o?.type !== "route") return Infinity;
  const pts = sim.defenceDef?.()?.routes?.[o.route];
  if (!pts?.length) return Infinity;
  let i = Math.min(Math.max(o.leg, 1), pts.length - 1), left = hyp(pts[i].x - t.x, pts[i].z - t.z);
  for (; i < pts.length - 1; i++) left += hyp(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
  return left;
}

// The primary ordering key of a combat unit under a mode: smaller wins.
const KEY = {
  first: (sim, t) => roadLeft(sim, t),
  strong: (sim, t) => -(t.hp + (t.shield || 0)),
  air: (sim, t) => (t.flying ? 0 : 1),
};

export const towerAim = {
  id: "tower-aim",
  // `sim.roadLeft(unit)`: the same figure for the interface (the camera follows the front of a wave).
  mixin: {
    roadLeft(t) { return roadLeft(this, t); },
  },
  // H6: a tower with `aim` asks here first. `undefined` leaves the choice to the usual nearest-first rule.
  towerAim(sim, e) {
    const mode = e.aim;
    if (!SPECIAL.has(mode)) return undefined;
    const key = KEY[mode], plateau = sim.terrain.plateaus.length ? 2 : 0;
    let best = null, bestRank = 3, bestKey = Infinity, bestD = Infinity;
    for (const t of sim.entities) {
      if (t.hp <= 0) continue;
      // The same candidates as defenseTarget (sim/combat.js): in reach, hostile, seen, hittable, a clear shot.
      const lim = e.range + plateau + t.radius + 0.00001, dx = t.x - e.x, dz = t.z - e.z;
      if (dx * dx + dz * dz > lim * lim) continue;
      if (!sim.hostile(e.team, t.team) || !sim.isVisible(t, e.team)) continue;
      if (t.flying && !sim.canHit(e, t)) continue;
      const d = distance(e, t) - t.radius;
      if (d > e.range + sim.heightRange(e, t) + 0.00001) continue;
      if (!(t.flying || sim.nav.clearLine(e, t, t.id))) continue;
      const rank = t.kind !== "unit" ? 2 : t.type === "worker" ? 1 : 0;
      // Combat units are ordered by the mode, then by distance; Harvesters and buildings by distance only.
      const k = rank === 0 ? key(sim, t) : 0;
      if (rank < bestRank || (rank === bestRank && (k < bestKey || (k === bestKey && d < bestD)))) {
        best = t;
        bestRank = rank;
        bestKey = k;
        bestD = d;
      }
    }
    return best;
  },
  commands: {
    // A tower's aim: one of AIMS. "near" puts the tower back to the default and deletes the field, so
    // a tower that never left the default (or came back to it) carries no `aim` key at all.
    padAim: {
      allowed: (sim, c) => {
        if (!sim.defence || !AIMS.includes(c.aim)) return false;
        const t = sim.get(c.building);
        if (!t || t.team !== c.team || t.kind !== "building" || !t.crew) return false;
        return c.aim !== "air" || !!t.hits_air;
      },
      run: (sim, c) => {
        const t = sim.get(c.building);
        if (c.aim === "near") delete t.aim;
        else t.aim = c.aim;
        return true;
      },
    },
  },
};
