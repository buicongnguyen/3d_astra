import { reflect } from "./terrain.js";
import { MIDFIELD_DEPOSITS } from "./sim/constants.js";

// Worn paths (V1 terrain round, 2026-11-26): dirt tracks worn along the routes Harvesters and armies take, from
// each camp to its own crystals, to the nearest crystal fields and to the middle of the map. Planned from the map's
// data alone (camp sites, deposit layout, water, cliffs, ramps and roads), never from a match: the same map always
// gets the same tracks, painted once into the ground (ground-paint.js), worn into the ground detail's splat as dirt
// (ground-detail.js) and kept clear of tufts and flowers (scatter.js). View only: nothing here reaches the rules.

const cache = new Map();
export const PATH_WIDTH = { harvest: 2.0, field: 2.2, centre: 2.6 };

// The four camp sites (the starting Command cores stand in mirrored quadrants; scatter.js campSites).
const camps = (t) => { const o = t.offset || 0; return [[-1, 1], [1, -1], [1, 1], [-1, -1]].map(([sx, sz]) => ({ x: sx * (25 + o), z: sz * (24 + o), sx, sz })); };

// Crystal fields: the deposit layout of simulation.js grouped into clusters (their centres).
export function crystalFields(t) {
  const o = t.offset || 0, own = [], field = [];
  for (const c of camps(t)) {
    // Each camp's own alloy and energy, beside its core (shifted with the camp's offset).
    const pts = [[36, 18], [37, 22], [35, 26], [30, 34]].map(([x, z]) => [c.sx * (x + o), c.sz * (z + o)]);
    own.push({ camp: c, x: pts.reduce((a, p) => a + p[0], 0) / pts.length, z: pts.reduce((a, p) => a + p[1], 0) / pts.length });
  }
  if (t.deposits) for (const [, x0, z0] of t.deposits) for (const [x, z] of reflect(x0, z0, t.symmetry)) field.push([x, z]);
  else {
    for (const side of [1, -1]) {
      field.push([-31 * side, -25 * side], [-25 * side, -32 * side]);
      for (const [x, z] of MIDFIELD_DEPOSITS.map((d) => [d[1], d[2]])) field.push([x * side, z * side]);
    }
  }
  for (const [x, z] of t.sites || []) for (const side of [1, -1]) field.push([x * side, z * side], [(x + 4) * side, z * side], [(x + 2) * side, (z + 5) * side]);
  // Cluster deposits within 9 m of each other.
  const clusters = [];
  for (const [x, z] of field) {
    if (Math.abs(x) > t.half - 2 || Math.abs(z) > t.half - 2) continue;
    const near = clusters.find((c) => Math.hypot(c.x - x, c.z - z) < 9);
    if (near) { near.n++; near.x += (x - near.x) / near.n; near.z += (z - near.z) / near.n; }
    else clusters.push({ x, z, n: 1 });
  }
  return { own, fields: clusters };
}

// A* over 2 m cells. Cells a wide vehicle cannot stand on are walls; roads are cheap (tracks join them), plateau
// tops and banks cost a little more (tracks keep to the low, dry ground where they can).
function costGrid(t) {
  const n = t.grid, cost = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const x = (i % n) * 2 - t.half + 1, z = Math.floor(i / n) * 2 - t.half + 1;
    if (!t.canStand(x, z, 1.0)) { cost[i] = Infinity; continue; }
    const s = t.at(x, z);
    cost[i] = s === "road" ? 0.6 : s === "ford" ? 1.6 : 1;
    if (t.level(x, z)) cost[i] += 0.5;
    if (t.inWater(x, z, 2.6)) cost[i] += 0.8;
  }
  return cost;
}
function route(t, cost, from, to) {
  const n = t.grid, cell = 2, half = t.half;
  const idx = (x, z) => Math.max(0, Math.min(n - 1, Math.floor((z + half) / cell))) * n + Math.max(0, Math.min(n - 1, Math.floor((x + half) / cell)));
  const centre = (i) => [(i % n) * cell - half + 1, Math.floor(i / n) * cell - half + 1];
  // Snap the ends to the nearest open cell.
  const open = (p) => { let best = -1, d = Infinity; for (let i = 0; i < n * n; i++) if (cost[i] < Infinity) { const [x, z] = centre(i), e = (x - p[0]) ** 2 + (z - p[1]) ** 2; if (e < d) { d = e; best = i; } } return best; };
  const start = cost[idx(...from)] < Infinity ? idx(...from) : open(from), goal = cost[idx(...to)] < Infinity ? idx(...to) : open(to);
  if (start < 0 || goal < 0) return null;
  const g = new Float32Array(n * n).fill(Infinity), came = new Int32Array(n * n).fill(-1), closed = new Uint8Array(n * n);
  const [gx, gz] = centre(goal), h = (i) => { const [x, z] = centre(i); return Math.hypot(x - gx, z - gz) / cell * 0.6; };
  // A binary heap of [f, i].
  const heap = [];
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  g[start] = 0; push(h(start), start);
  const steps = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.length) {
    const [, i] = pop();
    if (closed[i]) continue;
    if (i === goal) break;
    closed[i] = 1;
    const cx = i % n, cz = (i / n) | 0;
    for (const [dx, dz, len] of steps) {
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= n || z >= n) continue;
      const j = z * n + x;
      if (cost[j] === Infinity || (dx && dz && (cost[cz * n + x] === Infinity || cost[z * n + cx] === Infinity))) continue;
      const next = g[i] + len * (cost[i] + cost[j]) / 2;
      if (next < g[j]) { g[j] = next; came[j] = i; push(next + h(j), j); }
    }
  }
  if (came[goal] < 0 && goal !== start) return null;
  const cells = [];
  for (let i = goal; i >= 0; i = came[i]) { cells.push(centre(i)); if (i === start) break; }
  cells.reverse();
  return cells;
}

// Straightens a cell route where a wide unit can walk straight, then rounds the corners (Chaikin, three times).
function smoothRoute(t, cells) {
  if (cells.length < 3) return cells;
  const kept = [cells[0]];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    while (j > i + 1 && !t.canTraverse({ x: cells[i][0], z: cells[i][1] }, { x: cells[j][0], z: cells[j][1] }, 1.0)) j--;
    kept.push(cells[j]);
    i = j;
  }
  let pts = kept;
  for (let pass = 0; pass < 3; pass++) {
    const next = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      next.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    next.push(pts.at(-1));
    pts = next;
  }
  return pts;
}

// The map's worn paths: [{ kind, width, points: [[x, z], ...], wear: [0..1 per point] }]. Pure and cached by map id.
export function planPaths(t) {
  if (t.defence) return [];
  const key = `${t.id}|${t.size}|${t.biome || ""}`;
  if (cache.has(key)) return cache.get(key);
  const { own, fields } = crystalFields(t), out = [], seen = new Set(), cost = costGrid(t);
  const add = (kind, from, to) => {
    const sig = `${kind}:${from.map(Math.round)}:${to.map(Math.round)}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    const cells = route(t, cost, from, to);
    if (!cells || cells.length < 3) return;
    const points = smoothRoute(t, cells);
    let total = 0;
    const along = points.map((p, k) => (k ? (total += Math.hypot(p[0] - points[k - 1][0], p[1] - points[k - 1][1])) : 0));
    // Worn hardest by the camp, lighter out in the field, fading in over the last metres at both ends.
    const wear = along.map((d) => Math.min(1, d / 4, (total - d) / 3) * (kind === "harvest" ? 0.9 : 0.55 + 0.35 * Math.max(0, 1 - d / 40)));
    out.push({ kind, width: PATH_WIDTH[kind], points, wear });
  };
  for (const c of camps(t)) {
    const home = [c.x - c.sx * 4, c.z - c.sz * 5]; // in front of the core, toward the map's middle
    const mine = own.find((o) => o.camp.sx === c.sx && o.camp.sz === c.sz);
    if (mine) add("harvest", home, [mine.x, mine.z]);
    // The two nearest crystal fields that are not this camp's own.
    const near = fields.filter((f) => Math.hypot(f.x - c.x, f.z - c.z) > 12).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z)).slice(0, 2);
    for (const f of near) add("field", home, [f.x, f.z]);
    add("centre", home, [0, 0]);
  }
  cache.set(key, out);
  return out;
}

// Wear per cell of an n x n grid over the map (row 0 at z = -half): 1 on a fresh track's middle, fading past its edge.
export function wearGrid(t, n, paths = planPaths(t)) {
  const grid = new Float32Array(n * n), m = t.size / n, half = t.half;
  for (const p of paths)
    for (let k = 1; k < p.points.length; k++) {
      const [ax, az] = p.points[k - 1], [bx, bz] = p.points[k], w = (p.wear[k - 1] + p.wear[k]) / 2, r = p.width / 2 + 0.5;
      if (w <= 0) continue;
      const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - r + half) / m)), x1 = Math.min(n - 1, Math.ceil((Math.max(ax, bx) + r + half) / m));
      const z0 = Math.max(0, Math.floor((Math.min(az, bz) - r + half) / m)), z1 = Math.min(n - 1, Math.ceil((Math.max(az, bz) + r + half) / m));
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const px = (x + 0.5) * m - half, pz = (z + 0.5) * m - half, s = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
          const d = Math.hypot(px - ax - s * dx, pz - az - s * dz), edge = 1 - Math.max(0, Math.min(1, (d - (p.width / 2 - 0.5)) / 1.0));
          const v = w * edge;
          if (v > grid[z * n + x]) grid[z * n + x] = v;
        }
    }
  return grid;
}
