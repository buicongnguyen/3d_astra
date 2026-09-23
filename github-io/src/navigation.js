import { CELL, GRID, HALF, ROCKS, cellAt, worldAt, distance } from "./data.js";
import { Terrain } from "./terrain.js";

export class Navigation {
  constructor(terrain = new Terrain()) {
    this.terrain = terrain;
    this.grid = terrain.grid;
    this.blocked = new Uint8Array(this.grid * this.grid);
    this.revision = 0;
    this.obstacles = [];
    this.clearance = new Map();
  }
  cellAt(x,z) { return this.terrain.cellAt(x,z); }
  worldAt(x,z) { return this.terrain.worldAt(x,z); }
  rebuild(entities) {
    this.revision++;
    this.obstacles = ROCKS.map(([x, z, r]) => ({ x, z, radius: r }));
    this.obstacles.push(
      ...entities.filter((e) => e.hp > 0 && e.kind === "building"),
    );
    this.blocked.fill(0);
    this.clearance.clear();
    for (let z = 0; z < this.grid; z++)
      for (let x = 0; x < this.grid; x++) {
        const p = this.worldAt(x, z);
        if (
          !this.terrain.canStand(p.x, p.z, 0.65) ||
          this.obstacles.some((o) => distance(p, o) < o.radius + 0.65)
        )
          this.blocked[z * this.grid + x] = 1;
      }
  }
  free(x, z, radius = 0.55) {
    if (x < 0 || z < 0 || x >= this.grid || z >= this.grid) return false;
    const i = z * this.grid + x;
    if (this.blocked[i]) return false;
    if (radius <= 0.65) return true;
    // Vehicle clearance scans every obstacle; cache it per radius until the next rebuild.
    let cache = this.clearance.get(radius);
    if (!cache)
      this.clearance.set(radius, (cache = new Int8Array(this.grid * this.grid).fill(-1)));
    if (cache[i] < 0) {
      const p = this.worldAt(x, z);
      cache[i] = this.canStand(p.x, p.z, radius) ? 1 : 0;
    }
    return cache[i] === 1;
  }
  nearest(x, z, radius = 0.55) {
    if (this.free(x, z, radius)) return [x, z];
    for (let r = 1; r < 10; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (
            Math.max(Math.abs(dx), Math.abs(dz)) === r &&
            this.free(x + dx, z + dz, radius)
          )
            return [x + dx, z + dz];
        }
    return null;
  }
  path(from, to, radius = 0.55) {
    if (![from.x, from.z, to.x, to.z].every(Number.isFinite)) return [];
    const start = this.nearest(...this.cellAt(from.x, from.z), radius),
      end = this.nearest(...this.cellAt(to.x, to.z), radius);
    if (!start || !end) return [];
    const s = start[1] * this.grid + start[0],
      goal = end[1] * this.grid + end[0];
    const g = new Float32Array(this.grid * this.grid).fill(Infinity),
      parent = new Int32Array(this.grid * this.grid).fill(-1),
      closed = new Uint8Array(this.grid * this.grid);
    const heuristic = (id) =>
      Math.hypot((id % this.grid) - end[0], Math.floor(id / this.grid) - end[1]);
    // Binary min-heap keyed by f = g + h. Improved nodes are pushed again and
    // stale entries are skipped once closed (lazy deletion).
    const heapIds = [],
      heapKeys = [];
    const push = (id, key) => {
      let i = heapIds.length;
      heapIds.push(id);
      heapKeys.push(key);
      while (i > 0) {
        const up = (i - 1) >> 1;
        if (heapKeys[up] <= key) break;
        heapIds[i] = heapIds[up];
        heapKeys[i] = heapKeys[up];
        i = up;
      }
      heapIds[i] = id;
      heapKeys[i] = key;
    };
    const pop = () => {
      const top = heapIds[0],
        id = heapIds.pop(),
        key = heapKeys.pop();
      if (heapIds.length) {
        let i = 0;
        for (;;) {
          const l = 2 * i + 1,
            r = l + 1;
          let m = i,
            mKey = key;
          if (l < heapIds.length && heapKeys[l] < mKey) (m = l), (mKey = heapKeys[l]);
          if (r < heapIds.length && heapKeys[r] < mKey) m = r;
          if (m === i) break;
          heapIds[i] = heapIds[m];
          heapKeys[i] = heapKeys[m];
          i = m;
        }
        heapIds[i] = id;
        heapKeys[i] = key;
      }
      return top;
    };
    g[s] = 0;
    push(s, heuristic(s));
    for (let iteration = 0; heapIds.length && iteration < this.grid * this.grid; ) {
      const current = pop();
      if (closed[current]) continue;
      iteration++;
      if (current === goal) {
        const nodes = [];
        let p = current;
        while (p !== s && p !== -1) {
          nodes.push(this.worldAt(p % this.grid, Math.floor(p / this.grid)));
          p = parent[p];
        }
        nodes.reverse();
        if (!nodes.length) nodes.push(this.worldAt(...end));
        const last = nodes[nodes.length - 1];
        if (
          this.canStand(to.x, to.z, radius) &&
          this.canTraverse(last, to, radius)
        )
          nodes.push({ x: to.x, z: to.z });
        return nodes;
      }
      closed[current] = 1;
      const x = current % this.grid,
        z = Math.floor(current / this.grid);
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dz) || !this.free(x + dx, z + dz, radius)) continue;
          if (
            dx &&
            dz &&
            (!this.free(x + dx, z, radius) || !this.free(x, z + dz, radius))
          )
            continue;
          const next = (z + dz) * this.grid + x + dx;
          if (closed[next]) continue;
          const score = g[current] + (dx && dz ? Math.SQRT2 : 1);
          if (score < g[next]) {
            g[next] = score;
            parent[next] = current;
            push(next, score + heuristic(next));
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
      Math.abs(x) < this.terrain.half - radius &&
      Math.abs(z) < this.terrain.half - radius &&
      this.terrain.canStand(x, z, radius) &&
      !this.obstacles.some(
        (o) => Math.hypot(x - o.x, z - o.z) < o.radius + radius,
      )
    );
  }
  canTraverse(a, b, radius = 0.55) {
    if (
      ![a.x, a.z, b.x, b.z].every(Number.isFinite) ||
      Math.abs(b.x) >= this.terrain.half - radius ||
      Math.abs(b.z) >= this.terrain.half - radius
    )
      return false;
    if (!this.terrain.canTraverse(a, b, radius)) return false;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    return !this.obstacles.some((o) => {
      const clearance = o.radius + radius;
      // Allow a unit displaced into a footprint to move outward, never further in.
      if (distance(a, o) < clearance)
        return (a.x - o.x) * dx + (a.z - o.z) * dz < 0;
      const t = Math.max(
        0,
        Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / (length2 || 1)),
      );
      return Math.hypot(a.x + t * dx - o.x, a.z + t * dz - o.z) < clearance;
    });
  }
}
