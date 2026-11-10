import { distance } from "../data.js";

// What each team can see and remembers. Mixed into Simulation (see simulation.js).
export const vision = {
  isVisible(e, team = 0) {
    const [x, z] = this.nav.cellAt(e.x, e.z);
    return e.team === team || !!this.visible[team][z * this.terrain.grid + x];
  },
  isExplored(e, team = 0) {
    const [x, z] = this.nav.cellAt(e.x, e.z);
    return !!this.explored[team][z * this.terrain.grid + x];
  },
  updateVision() {
    for (let team = 0; team < this.players.length; team++) {
      this.visible[team].fill(0);
      for (const e of this.own(team)) {
        const [cx, cz] = this.nav.cellAt(e.x, e.z),
          sight = e.kind === "building" && !e.complete ? Math.min(e.vision, e.radius + 3) : e.vision,
          r = Math.ceil(sight / 2);
        for (let z = Math.max(0, cz - r); z <= Math.min(this.terrain.grid - 1, cz + r); z++)
          for (
            let x = Math.max(0, cx - r);
            x <= Math.min(this.terrain.grid - 1, cx + r);
            x++
          ) {
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
