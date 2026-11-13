import { distance } from "../data.js";
import { TERRAIN } from "../terrain.js";

// What each team can see and remembers. Mixed into Simulation (see simulation.js).
export const vision = {
  isVisible(e, team = 0) {
    // A cloaked unit (sim/traits.js) is seen only by teams with a detector close to it.
    if (e.cloaked && e.team !== team && !((e.seenBy >> team) & 1)) return false;
    // A flyer is seen by any hostile team whose sight reaches it, even over a hidden plateau cell (sim/air.js).
    if (e.flying && (e.airSeenBy >> team) & 1 && e.team !== team) return true;
    const [x, z] = this.nav.cellAt(e.x, e.z);
    return e.team === team || !!this.visible[team][z * this.terrain.grid + x];
  },
  // A ground point on a deep plateau cell (TERRAIN.hidden_depth inside the rim) that `team` does
  // not see now. Barrage and Burn line refuse such points (sim/tactics.js); maps without
  // plateaus never have one.
  hiddenTop(point, team = 0) {
    const t = this.terrain;
    if (!t.plateaus.length) return false;
    const [x, z] = t.cellAt(point.x, point.z), i = z * t.grid + x;
    return !!t.cellDeep[i] && !this.visible[team][i];
  },
  isExplored(e, team = 0) {
    const [x, z] = this.nav.cellAt(e.x, e.z);
    return !!this.explored[team][z * this.terrain.grid + x];
  },
  updateVision() {
    const t = this.terrain, high = t.plateaus.length > 0;
    for (let team = 0; team < this.players.length; team++) {
      this.visible[team].fill(0);
      // Plateaus where this team has a unit: their tops are open to it from below too.
      const up = high ? new Set(this.own(team).filter((e) => e.kind === "unit").map((e) => t.plateauAt(e.x, e.z))) : null;
      for (const e of this.own(team)) {
        // A flyer looks down on every plateau top (it is never "low") but gets no high-ground bonus.
        const low = high && !t.level(e.x, e.z) && !e.flying;
        const [cx, cz] = this.nav.cellAt(e.x, e.z),
          sight = (e.kind === "building" && !e.complete ? Math.min(e.vision, e.radius + 3) : e.vision) + (high && !low && !e.flying ? TERRAIN.high_vision : 0),
          r = Math.ceil(sight / 2);
        for (let z = Math.max(0, cz - r); z <= Math.min(this.terrain.grid - 1, cz + r); z++)
          for (
            let x = Math.max(0, cx - r);
            x <= Math.min(this.terrain.grid - 1, cx + r);
            x++
          ) {
            const i = z * this.terrain.grid + x;
            // From below, a plateau top is hidden beyond its rim unless a friendly unit stands on it.
            if (low && t.cellDeep[i] && !up.has(t.cellPlateau[i])) continue;
            if (distance(e, this.nav.worldAt(x, z)) <= sight)
              this.visible[team][z * this.terrain.grid + x] = this.explored[team][
                z * this.terrain.grid + x
              ] = 1;
          }
      }
    }
    // Allied AIs pool what they see.
    if (this.coalition)
      for (let i = 0; i < this.visible[1].length; i++) {
        let seen = 0, known = 0;
        for (let team = 1; team < this.players.length; team++) { seen |= this.visible[team][i]; known |= this.explored[team][i]; }
        for (let team = 1; team < this.players.length; team++) { this.visible[team][i] = seen; this.explored[team][i] = known; }
      }
    this.updateAirSight();
  },
  updateKnownCores(team) {
    const known = this.knownCores[team];
    for (const e of this.entities)
      if (e.hp > 0 && e.type === "hq" && this.hostile(team, e.team) && this.isVisible(e, team))
        known.set(e.id, { id: e.id, team: e.team, x: e.x, z: e.z });
    for (const [id, remembered] of known)
      if (this.players[remembered.team].eliminated || (this.isVisible(remembered, team) && !this.get(id)))
        known.delete(id);
  },
  scoutDestination(team) {
    const points = [], limit = this.terrain.half - 8;
    const coordinates = [];
    for (let value = -limit; value < limit; value += 18) coordinates.push(value);
    coordinates.push(limit);
    // Search unknown territory, including the outer edges, in alternating rows.
    for (const [row, z] of coordinates.entries()) {
      const line = [];
      for (const x of coordinates)
        if (this.nav.canStand(x, z, 1.05)) line.push({ x, z });
      points.push(...(row % 2 ? line.reverse() : line));
    }
    const index = this.scoutIndex[team]++;
    return points.length ? points[(index + team * 3) % points.length] : null;
  },
};
