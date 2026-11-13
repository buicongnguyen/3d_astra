import { DEFINITIONS as D, distance, hyp } from "../data.js";
import { AIR } from "../factions.js";

// Air rules (0.18 "Wings"). A flyer is a unit whose definition says `flying: true`
// (balance.json; Kite scout, Hawk gunship, Ember balloon, Swift glider):
//   movement   it flies straight to its goal inside the map bounds: no route, no footprints, no water,
//              and it is pushed apart only from other flyers (sim/movement.js)
//   targeting  only units with `hits_air` shoot it, and Sentinel towers once the team has Flak
//              (×AIR.flak_bonus); line of fire, high-ground and splash rules skip it (sim/combat.js)
//   vision     it sees plateau tops from low ground and opens a plateau it flies over to its side;
//              enemies below see it whenever it is within their sight (`airSeenBy`, sim/vision.js)
//   limits     AIR.cap flyers per team, alive plus queued; flyers never take capture points
// Everything here runs only for flyers, so a match without them keeps its state and hash.
export const air = {
  // Can `e` (a unit or a tower) shoot `t`?
  canHit(e, t) {
    return !t?.flying || !!e.hits_air || (e.kind === "building" && !!this.players[e.team]?.flak);
  },
  // One straight step towards `goal`, clamped inside the map. True on arrival.
  flyStep(e, goal, dt, tolerance) {
    const dx = goal.x - e.x, dz = goal.z - e.z, d = hyp(dx, dz);
    if (d < tolerance) { e.moving = false; return true; }
    const step = Math.min(d, this.moveSpeed(e) * dt), limit = this.terrain.half - Math.max(1, e.radius + 0.1);
    e.x = Math.max(-limit, Math.min(limit, e.x + (dx / d) * step));
    e.z = Math.max(-limit, Math.min(limit, e.z + (dz / d) * step));
    e.angle = Math.atan2(dx, dz);
    e.moving = true;
    e.stalled = 0;
    return false;
  },
  // Flyers of `team` alive and in its production queues.
  airCount(team) {
    let n = 0;
    for (const e of this.entities) {
      if (e.team !== team || e.hp <= 0) continue;
      if (e.flying) n++;
      if (e.queue) for (const q of e.queue) if (D[q.type]?.flying) n++;
    }
    return n;
  },
  // Which hostile teams see each flyer from below: one bit per team with a unit or building whose
  // sight reaches it. A flyer over a deep plateau cell is then still seen by the army underneath
  // (vision is per cell, and the cell itself may be hidden from below). Allied AIs share it.
  updateAirSight() {
    for (const f of this.entities) {
      if (!f.flying || f.hp <= 0) continue;
      let seen = 0;
      for (const o of this.entities) {
        if (o.team === f.team || o.team < 0 || o.hp <= 0 || (seen >> o.team) & 1 || !this.hostile(o.team, f.team)) continue;
        const sight = o.kind === "building" && !o.complete ? Math.min(o.vision, o.radius + 3) : o.vision;
        if (sight > 0 && distance(o, f) <= sight) seen |= 1 << o.team;
      }
      if (this.coalition && seen >> 1) for (let t = 1; t < this.players.length; t++) seen |= 1 << t;
      f.airSeenBy = seen;
    }
  },
};
export { AIR };
