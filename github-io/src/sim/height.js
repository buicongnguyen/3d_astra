import { TERRAIN } from "../terrain.js";

// High ground (Stage 3). Numbers in balance.json `terrain`. On a map without plateaus every
// function returns the neutral value, so such maps play exactly as before.
export const height = {
  levelOf(e) {
    return this.terrain.plateaus.length ? this.terrain.level(e.x, e.z) : 0;
  },
  // Firing down from a plateau hits harder, firing up hits softer.
  heightDamage(e, t) {
    if (!this.terrain.plateaus.length) return 1;
    const a = this.levelOf(e), b = this.levelOf(t);
    return a > b ? TERRAIN.high_damage : a < b ? TERRAIN.low_damage : 1;
  },
  // Extra reach for a shooter (unit or tower) on a plateau against a target below.
  heightRange(e, t) {
    return this.terrain.plateaus.length && this.levelOf(e) > this.levelOf(t) ? TERRAIN.high_range : 0;
  },
  // Straight concrete walls from the map data: one breakable 2 m piece per step along the line.
  spawnStraightWalls() {
    for (const w of this.terrain.walls) {
      const pieces = Math.max(1, Math.round(w.length / 2));
      for (let i = 0; i < pieces; i++) {
        const along = (i - (pieces - 1) / 2) * 2;
        const e = this.spawnWall(w.axis === "h" ? w.x + along : w.x, w.axis === "h" ? w.z : w.z + along, TERRAIN.wall_piece);
        e.axis = w.axis;
      }
    }
  },
};
