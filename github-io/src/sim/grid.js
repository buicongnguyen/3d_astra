// A per-tick 8 m spatial grid over the entity list (AAA round 2, CW-C, K5). It answers "which entities could be
// within `reach` of this point" as indices into sim.entities, in ENTITY ORDER (ascending), so a caller that
// walks the candidates and applies the very same tests as the all-pairs scan it replaces picks the same target,
// ties included. It only prunes: every caller still runs its exact tests on live positions.
//
// State lives in a module WeakMap keyed by the Simulation: nothing is added to the hashed snapshot or to any
// entity. The grid is built lazily (first query of a tick) and reused until the tick, the list or its length
// changes. Positions move after the build, so each query widens its window by a slack that bounds how far any
// entity can travel in one tick (see slackFor); a window larger than the map falls back to the plain scan.
const CELL = 8;
// Below this many entities the plain scan is as cheap as the grid; tests may lower it (setGridMinimum).
let MIN_ENTITIES = 40;
export const setGridMinimum = (n) => { const old = MIN_ENTITIES; MIN_ENTITIES = n; return old; };

class Grid {
  constructor() {
    this.half = 0; this.side = 1; this.start = new Int32Array(2); this.items = new Int32Array(0);
    this.xs = new Float64Array(0); this.zs = new Float64Array(0); this.count = 0; this.maxRadius = 0;
  }
  cell(v) { const i = Math.floor((v + this.half) / CELL); return i < 0 ? 0 : i >= this.side ? this.side - 1 : i; }
  // Files list[i] (for i < count, by position) in its cell. Within a cell, indices ascend.
  build(list, half, count = list.length, accept = null) {
    this.half = half; this.side = Math.max(1, Math.ceil((half * 2) / CELL)); this.count = count;
    const cells = this.side * this.side;
    if (this.start.length < cells + 1) this.start = new Int32Array(cells + 1);
    if (this.xs.length < count) { this.xs = new Float64Array(count * 2); this.zs = new Float64Array(count * 2); this.items = new Int32Array(count * 2); this.where = new Int32Array(count * 2); }
    const start = this.start, where = this.where;
    start.fill(0, 0, cells + 1);
    let maxRadius = 0;
    for (let i = 0; i < count; i++) {
      const e = list[i];
      this.xs[i] = e.x; this.zs[i] = e.z;
      if (e.radius > maxRadius) maxRadius = e.radius;
      const c = this.cell(e.z) * this.side + this.cell(e.x);
      where[i] = c;
      start[c + 1]++;
    }
    for (let c = 0; c < cells; c++) start[c + 1] += start[c];
    // Counting sort by cell; a second cursor array is avoided by filling from the end of each run.
    const fill = this.fill && this.fill.length >= cells ? this.fill : (this.fill = new Int32Array(cells));
    for (let c = 0; c < cells; c++) fill[c] = start[c];
    for (let i = 0; i < count; i++) this.items[fill[where[i]]++] = i;
    this.maxRadius = maxRadius;
  }
  // Writes the indices of every entry whose build-time position lies in the cells touched by the square of
  // half-width `reach` around (x, z) into `out`, ascending, and returns how many. -1: too wide, scan instead.
  gather(x, z, reach, out, above = -1) {
    if (!(reach < this.half)) return -1;
    const c0 = this.cell(x - reach), c1 = this.cell(x + reach), r0 = this.cell(z - reach), r1 = this.cell(z + reach);
    if ((c1 - c0 + 1) * (r1 - r0 + 1) > (this.side * this.side) >> 1) return -1;
    let n = 0;
    const start = this.start, items = this.items;
    for (let r = r0; r <= r1; r++) {
      const base = r * this.side;
      for (let c = c0; c <= c1; c++)
        for (let k = start[base + c], end = start[base + c + 1]; k < end; k++) {
          const id = items[k];
          if (id > above) out[n++] = id;
        }
    }
    // Entity order: cells were visited by position, so the ids need ordering (insertion sort for the usual
    // few dozen, the typed array sort beyond that).
    if (n > 64) out.subarray(0, n).sort();
    else for (let i = 1; i < n; i++) { const v = out[i]; let j = i - 1; while (j >= 0 && out[j] > v) { out[j + 1] = out[j]; j--; } out[j + 1] = v; }
    return n;
  }
}

const STATE = new WeakMap(); // Simulation -> { grid, list, size, tick, time }
const BUFFERS = [new Int32Array(256), new Int32Array(256), new Int32Array(256), new Int32Array(256)];
let turn = 0;
function buffer(min) {
  const k = turn++ & 3;
  if (BUFFERS[k].length < min) BUFFERS[k] = new Int32Array(Math.max(min, BUFFERS[k].length * 2));
  return BUFFERS[k];
}
// The buffer of the latest near() call (valid until three more calls have been made).
export let IDS = BUFFERS[0];

function stateFor(sim) {
  const list = sim.entities;
  let st = STATE.get(sim);
  if (st && st.list === list && st.size === list.length && st.ticks === sim.ticks && st.time === sim.time) return st;
  if (!st) STATE.set(sim, (st = { grid: new Grid(), list: null, size: -1, ticks: -1, time: -1, last: -Infinity, slack: 0 }));
  // `gap` bounds the tick being played: the previous build was no later than the previous tick's start.
  const gap = sim.time - (st.last > -Infinity ? st.last : 0);
  st.grid.build(list, sim.terrain.half);
  let fastest = 0;
  for (let i = 0; i < list.length; i++) { const s = list[i].speed; if (s > fastest) fastest = s; }
  // One tick moves an entity by at most speed x dt (x2 for speed factors); separation shoves a unit at most
  // 4 x dt per neighbour, and a crowd of 8 neighbours is far beyond any real pile. 0.5 m of margin on top.
  st.slack = fastest * 2 * gap + 32 * gap + 0.5;
  st.list = list; st.size = list.length; st.ticks = sim.ticks; st.time = sim.time; st.last = sim.time;
  return st;
}

// Indices (into sim.entities, ascending) of every entity that could be within `reach` of (x, z) right now,
// or -1 when the plain scan should run instead (small scenes, a huge reach). Read the indices from IDS.
export function near(sim, x, z, reach) {
  const list = sim.entities;
  if (list.length < MIN_ENTITIES || !Number.isFinite(x + z + reach)) return -1;
  const st = stateFor(sim), g = st.grid;
  const out = buffer(list.length);
  const n = g.gather(x, z, reach + g.maxRadius + st.slack + 0.001, out);
  if (n >= 0) IDS = out;
  return n;
}

// For separate(): a grid of the given units alone, with the live drift of the pushes so far tracked by the caller.
const SEPARATE = new WeakMap();
export function unitGrid(sim, units) {
  let g = SEPARATE.get(sim);
  if (!g) SEPARATE.set(sim, (g = new Grid()));
  g.build(units, sim.terrain.half);
  return g;
}
export { Grid };
