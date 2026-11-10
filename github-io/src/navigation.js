import { CELL, GRID, HALF, ROCKS, cellAt, worldAt, distance, hyp } from "./data.js";
import { Terrain } from "./terrain.js";

// Side of an obstacle bucket in metres (see near()).
const BUCKET = 8;
export class Navigation {
  constructor(terrain = new Terrain()) {
    this.terrain = terrain;
    this.grid = terrain.grid;
    this.blocked = new Uint8Array(this.grid * this.grid);
    // A finer view used only when no normal route exists: cells within 0.3 m of a footprint instead of 0.65 m,
    // so a slim body can find its way through a narrow gap between buildings (canTraverse still checks clearance).
    this.looseBlocked = new Uint8Array(this.grid * this.grid);
    this.revision = 0;
    this.wallsSpawned = false;
    this.obstacles = [];
    this.clearance = new Map();
    this.scratch = [];
    this.bucketed = -1;
  }
  // Obstacle lookups by area. Obstacles are filed by the 8 m bucket their centre is in; a query
  // returns those in the buckets a box touches, widened by the largest footprint, so callers
  // test a handful of candidates instead of every building and wall on the map. The callers'
  // own distance tests still decide, so results are exactly those of scanning the full list.
  bucketObstacles() {
    const half = this.terrain.half;
    this.bucketSide = Math.max(1, Math.ceil((half * 2) / BUCKET));
    this.buckets = Array.from({ length: this.bucketSide * this.bucketSide }, () => []);
    this.reach = 0;
    for (const o of this.obstacles) {
      this.buckets[this.bucketOf(o.z) * this.bucketSide + this.bucketOf(o.x)].push(o);
      if (o.radius > this.reach) this.reach = o.radius;
    }
    this.bucketed = this.obstacles.length;
  }
  bucketOf(v) {
    const i = Math.floor((v + this.terrain.half) / BUCKET);
    return i < 0 ? 0 : i >= this.bucketSide ? this.bucketSide - 1 : i;
  }
  near(x0, z0, x1, z1, pad) {
    if (this.bucketed !== this.obstacles.length) this.bucketObstacles();
    const m = this.reach + pad;
    const c0 = this.bucketOf(Math.min(x0, x1) - m), c1 = this.bucketOf(Math.max(x0, x1) + m),
      r0 = this.bucketOf(Math.min(z0, z1) - m), r1 = this.bucketOf(Math.max(z0, z1) + m);
    if (c0 === c1 && r0 === r1) return this.buckets[r0 * this.bucketSide + c0];
    if ((c1 - c0 + 1) * (r1 - r0 + 1) > 24) return this.obstacles;
    const out = this.scratch;
    out.length = 0;
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const bucket = this.buckets[r * this.bucketSide + c];
        for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
      }
    return out;
  }
  cellAt(x,z) { return this.terrain.cellAt(x,z); }
  worldAt(x,z) { return this.terrain.worldAt(x,z); }
  rebuild(entities) {
    this.revision++;
    // Concrete walls (where the boulders were) block until destroyed. Before the simulation
    // has spawned them, the boulder positions stand in.
    // Latched: once walls have been seen, destroyed ones must not bring the boulders back.
    if (entities.some((e) => e.kind === "wall")) this.wallsSpawned = true;
    this.obstacles = this.wallsSpawned ? [] : ROCKS.map(([x, z, r]) => ({ x, z, radius: r }));
    this.obstacles.push(
      ...entities.filter((e) => e.hp > 0 && (e.kind === "building" || e.kind === "wall")),
    );
    this.bucketObstacles();
    this.blocked.fill(0);
    this.looseBlocked.fill(0);
    this.clearance.clear();
    for (let z = 0; z < this.grid; z++)
      for (let x = 0; x < this.grid; x++) {
        const p = this.worldAt(x, z);
        if (
          !this.terrain.canStand(p.x, p.z, 0.65) ||
          this.near(p.x, p.z, p.x, p.z, 0.65).some((o) => distance(p, o) < o.radius + 0.65)
        )
          this.blocked[z * this.grid + x] = 1;
        if (
          !this.terrain.canStand(p.x, p.z, 0.3) ||
          this.near(p.x, p.z, p.x, p.z, 0.3).some((o) => distance(p, o) < o.radius + 0.3)
        )
          this.looseBlocked[z * this.grid + x] = 1;
      }
  }
  free(x, z, radius = 0.55, loose = false) {
    if (x < 0 || z < 0 || x >= this.grid || z >= this.grid) return false;
    const i = z * this.grid + x;
    if (loose) return !this.looseBlocked[i];
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
  nearest(x, z, radius = 0.55, loose = false) {
    if (this.free(x, z, radius, loose)) return [x, z];
    for (let r = 1; r < 10; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (
            Math.max(Math.abs(dx), Math.abs(dz)) === r &&
            this.free(x + dx, z + dz, radius, loose)
          )
            return [x + dx, z + dz];
        }
    return null;
  }
  path(from, to, radius = 0.55, loose = false) {
    if (![from.x, from.z, to.x, to.z].every(Number.isFinite)) return [];
    const start = this.nearest(...this.cellAt(from.x, from.z), radius, loose),
      end = this.nearest(...this.cellAt(to.x, to.z), radius, loose);
    if (!start || !end) return [];
    const s = start[1] * this.grid + start[0],
      goal = end[1] * this.grid + end[0];
    // Search buffers are kept between calls; a route search runs many times a second.
    const pool = (this.pool ??= { g: new Float32Array(this.grid * this.grid), parent: new Int32Array(this.grid * this.grid), closed: new Uint8Array(this.grid * this.grid) });
    const g = pool.g.fill(Infinity),
      parent = pool.parent.fill(-1),
      closed = pool.closed.fill(0);
    const heuristic = (id) =>
      hyp((id % this.grid) - end[0], Math.floor(id / this.grid) - end[1]);
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
          if ((!dx && !dz) || !this.free(x + dx, z + dz, radius, loose)) continue;
          if (
            dx &&
            dz &&
            (!this.free(x + dx, z, radius, loose) || !this.free(x, z + dz, radius, loose))
          )
            continue;
          const next = (z + dz) * this.grid + x + dx;
          if (closed[next]) continue;
          // Cell centres can both be clear while the segment between them clips an obstacle.
          if (
            !this.canTraverse(
              this.worldAt(x, z),
              this.worldAt(x + dx, z + dz),
              radius,
            )
          )
            continue;
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
  // Connected regions of ground a soldier-sized body can cross, cached until the next rebuild. Uses the
  // same cells and the same diagonal rule as the route search, so "connected here" means "a route exists".
  regions() {
    if (this.regionRevision === this.revision) return this.regionData;
    const n = this.grid, comp = new Int32Array(n * n).fill(-1);
    for (let s0 = 0, id = 0; s0 < n * n; s0++) {
      if (this.blocked[s0] || comp[s0] >= 0) continue;
      comp[s0] = id;
      const stack = [s0];
      while (stack.length) {
        const c = stack.pop(), x = c % n, z = (c / n) | 0;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, nz = z + dz;
            if ((!dx && !dz) || nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
            const i = nz * n + nx;
            if (this.blocked[i] || comp[i] >= 0) continue;
            if (dx && dz && (this.blocked[z * n + nx] || this.blocked[nz * n + x])) continue;
            comp[i] = id;
            stack.push(i);
          }
      }
      id++;
    }
    this.regionRevision = this.revision;
    return (this.regionData = { comp });
  }
  // Would a footprint of this radius at (x, z) cut off ground within `reach` metres that is connected to the
  // wider map right now? (Ground already isolated before the building does not count.)
  wouldSeal(x, z, radius, reach = 24) {
    const n = this.grid, { comp } = this.regions(), r2 = radius + 0.65;
    const covered = (i) => { const p = this.worldAt(i % n, (i / n) | 0); return hyp(p.x - x, p.z - z) < r2; };
    // The region around the site: the one holding the free cell nearest to it.
    let id = -1, near = Infinity;
    for (let i = 0; i < n * n; i++) {
      if (comp[i] < 0) continue;
      const p = this.worldAt(i % n, (i / n) | 0), d = hyp(p.x - x, p.z - z);
      if (d < near) { near = d; id = comp[i]; }
    }
    if (id < 0) return false;
    // Seed from a cell of that region well away from the site; everything near the site must stay reachable.
    let seed = -1;
    for (let i = 0; i < n * n && seed < 0; i++) {
      if (comp[i] !== id || covered(i)) continue;
      const p = this.worldAt(i % n, (i / n) | 0);
      if (hyp(p.x - x, p.z - z) > reach + 2) seed = i;
    }
    if (seed < 0) return false;
    const seen = new Uint8Array(n * n), stack = [seed], ok = (i) => !this.blocked[i] && !covered(i);
    seen[seed] = 1;
    while (stack.length) {
      const c = stack.pop(), cx = c % n, cz = (c / n) | 0;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, nz = cz + dz;
          if ((!dx && !dz) || nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
          const i = nz * n + nx;
          if (seen[i] || !ok(i)) continue;
          if (dx && dz && (!ok(cz * n + nx) || !ok(nz * n + cx))) continue;
          seen[i] = 1;
          stack.push(i);
        }
    }
    for (let i = 0; i < n * n; i++) {
      if (comp[i] !== id || seen[i] || covered(i)) continue;
      const p = this.worldAt(i % n, (i / n) | 0);
      if (hyp(p.x - x, p.z - z) < reach) return true;
    }
    return false;
  }
  clearLine(a, b, ignored) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    return !this.near(a.x, a.z, b.x, b.z, 0.2).some((o) => {
      if (
        (ignored !== undefined && o.id === ignored) ||
        distance(a, o) < o.radius + 0.2
      )
        return false;
      const t = Math.max(
        0,
        Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / (length2 || 1)),
      );
      return hyp(a.x + t * dx - o.x, a.z + t * dz - o.z) < o.radius;
    });
  }
  canStand(x, z, radius = 0.55) {
    return (
      Number.isFinite(x) &&
      Number.isFinite(z) &&
      Math.abs(x) < this.terrain.half - radius &&
      Math.abs(z) < this.terrain.half - radius &&
      this.terrain.canStand(x, z, radius) &&
      !this.near(x, z, x, z, radius).some(
        (o) => hyp(x - o.x, z - o.z) < o.radius + radius,
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
    return !this.near(a.x, a.z, b.x, b.z, radius).some((o) => {
      const clearance = o.radius + radius;
      // Allow a unit displaced into a footprint to move outward, never further in.
      if (distance(a, o) < clearance)
        return (a.x - o.x) * dx + (a.z - o.z) * dz < 0;
      const t = Math.max(
        0,
        Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / (length2 || 1)),
      );
      return hyp(a.x + t * dx - o.x, a.z + t * dz - o.z) < clearance;
    });
  }
}
