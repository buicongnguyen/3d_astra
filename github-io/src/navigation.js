import { CELL, GRID, HALF, ROCKS, cellAt, worldAt, distance } from "./data.js";

export class Navigation {
  constructor() {
    this.blocked = new Uint8Array(GRID * GRID);
    this.revision = 0;
    this.obstacles = [];
  }
  rebuild(entities) {
    this.revision++;
    this.obstacles = ROCKS.map(([x, z, r]) => ({ x, z, radius: r }));
    this.obstacles.push(
      ...entities.filter((e) => e.hp > 0 && e.kind === "building"),
    );
    this.blocked.fill(0);
    for (let z = 0; z < GRID; z++)
      for (let x = 0; x < GRID; x++) {
        const p = worldAt(x, z);
        if (this.obstacles.some((o) => distance(p, o) < o.radius + 0.65))
          this.blocked[z * GRID + x] = 1;
      }
  }
  free(x, z) {
    return (
      x >= 0 && z >= 0 && x < GRID && z < GRID && !this.blocked[z * GRID + x]
    );
  }
  nearest(x, z) {
    if (this.free(x, z)) return [x, z];
    for (let r = 1; r < 10; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (
            Math.max(Math.abs(dx), Math.abs(dz)) === r &&
            this.free(x + dx, z + dz)
          )
            return [x + dx, z + dz];
        }
    return null;
  }
  path(from, to) {
    if (![from.x, from.z, to.x, to.z].every(Number.isFinite)) return [];
    const start = this.nearest(...cellAt(from.x, from.z)),
      end = this.nearest(...cellAt(to.x, to.z));
    if (!start || !end) return [];
    const s = start[1] * GRID + start[0],
      goal = end[1] * GRID + end[0];
    const g = new Float32Array(GRID * GRID).fill(Infinity),
      parent = new Int32Array(GRID * GRID).fill(-1),
      closed = new Uint8Array(GRID * GRID);
    const heuristic = (id) =>
      Math.hypot((id % GRID) - end[0], Math.floor(id / GRID) - end[1]);
    const open = [s];
    g[s] = 0;
    for (
      let iteration = 0;
      open.length && iteration < GRID * GRID;
      iteration++
    ) {
      let best = 0;
      for (let i = 1; i < open.length; i++)
        if (
          g[open[i]] + heuristic(open[i]) <
          g[open[best]] + heuristic(open[best])
        )
          best = i;
      const current = open.splice(best, 1)[0];
      if (current === goal) {
        const nodes = [];
        let p = current;
        while (p !== s && p !== -1) {
          nodes.push(worldAt(p % GRID, Math.floor(p / GRID)));
          p = parent[p];
        }
        nodes.reverse();
        if (!nodes.length) nodes.push(worldAt(...end));
        const last = nodes[nodes.length - 1];
        if (this.canStand(to.x, to.z) && this.clearLine(last, to))
          nodes.push({ x: to.x, z: to.z });
        return nodes;
      }
      closed[current] = 1;
      const x = current % GRID,
        z = Math.floor(current / GRID);
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dz) || !this.free(x + dx, z + dz)) continue;
          if (dx && dz && (!this.free(x + dx, z) || !this.free(x, z + dz)))
            continue;
          const next = (z + dz) * GRID + x + dx;
          if (closed[next]) continue;
          const score = g[current] + (dx && dz ? Math.SQRT2 : 1);
          if (score < g[next]) {
            if (!Number.isFinite(g[next])) open.push(next);
            g[next] = score;
            parent[next] = current;
          }
        }
    }
    return [];
  }
  clearLine(a, b, ignored) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    return !this.obstacles.some((o) => {
      if (
        (ignored !== undefined && o.id === ignored) ||
        distance(a, o) < o.radius + 0.2
      )
        return false;
      const t = Math.max(
        0,
        Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / (length2 || 1)),
      );
      return Math.hypot(a.x + t * dx - o.x, a.z + t * dz - o.z) < o.radius;
    });
  }
  canStand(x, z, radius = 0.55) {
    return (
      Number.isFinite(x) &&
      Number.isFinite(z) &&
      Math.abs(x) < HALF - radius &&
      Math.abs(z) < HALF - radius &&
      !this.obstacles.some(
        (o) => Math.hypot(x - o.x, z - o.z) < o.radius + radius,
      )
    );
  }
  canTraverse(a, b, radius = 0.55) {
    if (
      ![a.x, a.z, b.x, b.z].every(Number.isFinite) ||
      Math.abs(b.x) >= HALF - radius ||
      Math.abs(b.z) >= HALF - radius
    )
      return false;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    return !this.obstacles.some((o) => {
      const clearance = o.radius + radius;
      // Allow a unit displaced into a footprint to move outward, never further in.
      if (distance(a, o) < clearance) return distance(b, o) < distance(a, o);
      const t = Math.max(
        0,
        Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / (length2 || 1)),
      );
      return Math.hypot(a.x + t * dx - o.x, a.z + t * dz - o.z) < clearance;
    });
  }
}
