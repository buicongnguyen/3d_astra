import { distance, hyp } from "../data.js";
import { SQUEEZE } from "./constants.js";

// Getting a unit from A to B: routes, stuck handling and separation. Mixed into Simulation (see simulation.js).
export const movement = {
  approach(e, target, margin = 1.4) {
    const angle = Math.atan2(e.z - target.z, e.x - target.x),
      r = (target.radius || 0) + margin;
    return {
      x: target.x + Math.cos(angle) * r,
      z: target.z + Math.sin(angle) * r,
    };
  },
  // Nearest clear ground for a unit that is wedged against (or inside) a building, wall or the
  // bank: the grid keeps a wider margin than a unit's body, so a unit hugging a footprint can
  // stand legally yet start its route in a blocked cell. Rings widen from the side facing away
  // from the nearest obstacle; null when nothing is clear within a few metres.
  escapePoint(e, goal = null) {
    let near = null, best = Infinity;
    for (const o of this.nav.obstacles) {
      const d = hyp(e.x - o.x, e.z - o.z) - o.radius;
      if (d < best) { best = d; near = o; }
    }
    const base = near ? Math.atan2(e.z - near.z, e.x - near.x) || 0 : 0;
    let tried = 0;
    for (let r = 0.5; r <= 5; r += 0.5)
      for (let k = 0; k < 16; k++) {
        const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8), x = e.x + Math.cos(a) * r, z = e.z + Math.sin(a) * r;
        if (!this.nav.canStand(x, z, e.radius)) continue;
        const [cx, cz] = this.nav.cellAt(x, z);
        if (!this.nav.free(cx, cz, e.radius)) continue;
        // The hop is a straight line: it may leave the footprint it is in, never cut through another one.
        if (!this.nav.canTraverse(e, { x, z }, e.radius)) continue;
        // With a goal, only a spot that has a route to it counts: hopping toward an unreachable goal
        // would just reset the stall clock the order logic uses to give up. Few candidates are tried.
        if (goal && (++tried > 8 || !this.nav.path({ x, z }, goal, e.radius).length)) { if (tried > 8) return null; continue; }
        return { x, z };
      }
    return null;
  },
  startEscape(e, out) {
    e.escape = { x: out.x, z: out.z, until: this.time + 2 }; // a blocked hop must not repeat forever
    e.path = [];
    e.moving = true;
  },
  move(e, goal, dt, tolerance = 0.5) {
    if (distance(e, goal) < tolerance) {
      e.moving = false;
      e.path = [];
      e.escape = null;
      return true;
    }
    if (e.escape) {
      // A short straight hop out of a tight spot, ignoring the footprint it is leaving.
      const dx = e.escape.x - e.x, dz = e.escape.z - e.z, d = hyp(dx, dz);
      if (d < 0.2 || this.time > e.escape.until) { e.escape = null; e.path = []; e.pathClock = 0; e.stalled = 0; e.moveSample = null; }
      else {
        const step = Math.min(d, e.speed * dt);
        e.x += (dx / d) * step;
        e.z += (dz / d) * step;
        e.angle = Math.atan2(dx, dz);
        e.moving = true;
        return false;
      }
    }
    if (!this.nav.canStand(e.x, e.z, e.radius) && this.time >= (e.escapeAt || 0)) {
      const out = this.escapePoint(e);
      if (out) { this.startEscape(e, out); return false; }
      e.escapeAt = this.time + 0.5; // nothing clear nearby: do not rescan every frame
    }
    // Measure progress across frames. A fixed per-frame threshold falsely
    // marked healthy movement as stuck on high-refresh-rate displays.
    if (e.moveSample && distance(e, e.moveSample) < 0.1)
      e.stalled = (e.stalled || 0) + dt;
    else {
      e.stalled = 0;
      e.moveSample = { x: e.x, z: e.z };
    }
    if (e.stalled > 1.5 && !e.escapeTried) {
      // Stalled: one hop to clear ground that HAS a route to the goal before giving up. A goal no spot
      // can reach (a walled-in target) finds no hop, so the order logic's stall clock keeps running.
      e.escapeTried = true;
      // (A unit that does have a route, ending beside an unreachable target, is not wedged: no hop.)
      const out = this.nav.path(e, goal, e.radius).length ? null : this.escapePoint(e, goal);
      if (out) { this.startEscape(e, out); return false; }
    }
    if (e.stalled > 6) {
      e.escapeTried = false;
      this.finish(e);
      this.message(
        `${e.name} cannot reach its destination. Order cleared.`,
        e.team,
      );
      return false;
    }
    e.pathClock -= dt;
    if ((e.pathClock <= 0 || e.pathRevision !== this.nav.revision) && this.routeBudget <= 0) {
      // No search slot left this tick: a unit with a current route keeps following it, any
      // other waits a moment. A large group therefore sets off over a few ticks, not in one hitch.
      if (!e.path.length || e.pathRevision !== this.nav.revision) {
        e.moving = false;
        return false;
      }
    } else if (e.pathClock <= 0 || e.pathRevision !== this.nav.revision) {
      this.routeBudget--;
      e.path = this.nav.path(e, goal, e.radius);
      // No route for the full body: squeeze a big unit through a narrow gap on a slim one instead of
      // leaving it sealed in beside the buildings (it may clip a corner, which beats staying stuck).
      e.squeeze = false;
      if (!e.path.length) {
        // A slim body on the finer grid: a gap that cannot hold a whole 2 m cell centre can still pass it.
        e.path = this.nav.path(e, goal, Math.min(e.radius, SQUEEZE), true);
        e.squeeze = e.path.length > 0;
      }
      e.pathClock = 1.3 + (e.id % 7) * 0.08;
      e.pathRevision = this.nav.revision;
    }
    if (!e.path.length) {
      e.moving = false;
      return false;
    }
    let next = e.path[0];
    if (distance(e, next) < 0.3) {
      e.path.shift();
      next = e.path[0];
    }
    if (!next) {
      e.moving = false;
      return distance(e, goal) < 2.1 || !this.nav.canStand(goal.x, goal.z, e.radius);
    }
    const dx = next.x - e.x,
      dz = next.z - e.z,
      d = hyp(dx, dz),
      step = Math.min(d, e.speed * dt);
    if (d < 0.0001) {
      e.path.shift();
      return false;
    }
    const nextPosition = { x: e.x + (dx / d) * step, z: e.z + (dz / d) * step };
    if (!this.nav.canTraverse(e, nextPosition, e.squeeze ? SQUEEZE : e.radius)) {
      e.moving = false;
      e.path = [];
      e.pathClock = 0;
      // The first step crosses a footprint (the unit hugs a building, in a blocked grid cell). First try
      // a slim-body route on the finer grid (it holds for a moment so the unit can actually follow it);
      // otherwise hop to clear ground that has a route to the goal, at most four times per order.
      if (!e.squeeze) {
        const slim = this.nav.path(e, goal, Math.min(e.radius, SQUEEZE), true);
        if (slim.length) { e.path = slim; e.squeeze = true; e.pathClock = 1.2; return false; }
      }
      if ((e.hops || 0) < 4) {
        const out = this.escapePoint(e, goal);
        if (out) { this.startEscape(e, out); e.hops = (e.hops || 0) + 1; }
      }
      return false;
    }
    e.escapeTried = false;
    e.x = nextPosition.x;
    e.z = nextPosition.z;
    e.angle = Math.atan2(dx, dz);
    e.moving = true;
    return false;
  },
  resetWorkerRoute(e) {
    e.path = [];
    e.hops = 0;
    e.squeeze = false;
    e.pathClock = 0;
    e.stalled = 0;
    e.moveSample = null;
  },
  // Units that overlap push each other apart, as far as the ground allows.
  separate(dt) {
    const units = this.entities.filter((e) => e.hp > 0 && e.kind === "unit");
    for (let i = 0; i < units.length; i++)
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i],
          b = units[j],
          dx = a.x - b.x,
          dz = a.z - b.z,
          min = (a.radius + b.radius) * 0.9;
        // Cheap reject for the vast majority of pairs, with a margin so the exact test below decides ties.
        if (dx * dx + dz * dz > min * min * 1.001 + 1e-9) continue;
        const d = hyp(dx, dz);
        if (d >= min) continue;
        const nx = d > 0.001 ? dx / d : 1,
          nz = d > 0.001 ? dz / d : 0,
          push = Math.min((min - d) * 0.5, dt * 2);
        if (this.nav.canStand(a.x + nx * push, a.z + nz * push, a.radius)) {
          a.x += nx * push;
          a.z += nz * push;
        }
        if (this.nav.canStand(b.x - nx * push, b.z - nz * push, b.radius)) {
          b.x -= nx * push;
          b.z -= nz * push;
        }
      }
  },
};
