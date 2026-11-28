// H6 cover walls (HERO-COINS-PLAN.md, owner 2026-11-28: "make them cheaper and do it"). Pure rules, no DOM:
//   planCover(sim)    about 30 pieces (broken concrete walls, sandbag lines, crate stacks) placed by a seeded,
//                     deterministic search on the map, clear of roads, crossings, bases, build plots, deposits,
//                     capture points, the lanes between cores, every unit standing and each other; a piece that
//                     would cut any ground off from the rest of the nav grid is refused
//   coverCircles()    the pieces as static nav obstacles (circles flagged `cover`, so clearLine ignores them:
//                     normal RTS shots stay instant hits through cover)
//   coverBlock()      the first piece a straight ground shot from a to b crosses ({ t, x, z }) or null
// A piece is [kind, x, z, angle]: kind 0 wall, 1 sandbags, 2 crates; x, z its centre; angle (radians) the
// direction of its long side in the x/z plane. The list lives in the match state (sim.cover), so saves, hashes
// and replays carry it; the drawn mesh (src/cover-view.js) is built from the same list.
import { fnv1a, mulberry32 } from "../rng.js";
import { REFLECTIONS } from "../terrain.js";

const hyp = Math.hypot;
// Half length (along the angle), half depth, height (m), and the nav circles (offsets along the length, radius).
export const COVER_KINDS = Object.freeze([
  Object.freeze({ id: "wall", L: 1.7, W: 0.28, h: 1.45, at: [-1.15, 0, 1.15], r: 0.55 }),
  Object.freeze({ id: "sandbags", L: 1.6, W: 0.45, h: 0.85, at: [-1.05, 0, 1.05], r: 0.58 }),
  Object.freeze({ id: "crates", L: 1.0, W: 0.55, h: 1.75, at: [-0.5, 0.5], r: 0.7 }),
]);
// Placement: pieces per 128 m map (scaled by side, clamped), spacing, and the keep-outs (metres).
export const COVER = Object.freeze({ per128: 30, min: 22, max: 36, tries: 2000, spacing: 6, edge: 6, core: 20, building: 6, unit: 3.5, deposit: 6, point: 4, lane: 4, road: 3, crossing: 10, bank: 6, shore: 4, rock: 4, route: 7, pad: 6 });
// Weapons that arc over cover (lobbed shells) and are never stopped by it.
export const LOBBED = new Set(["breaker"]); // the Breaker's artillery lob (fx-kinds/weapon-class.js ARTILLERY)

const round = (v, k = 100) => Math.round(v * k) / k;
const segDist = (x, z, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return hyp(x - ax - t * dx, z - az - t * dz);
};

// The footprint corners of a piece, grown by `pad` metres, plus its centre.
function samples(p, pad) {
  const K = COVER_KINDS[p[0]], c = Math.cos(p[3]), s = Math.sin(p[3]), L = K.L + pad, W = K.W + pad;
  return [[p[1], p[2]], ...[[L, W], [L, -W], [-L, W], [-L, -W]].map(([u, v]) => [p[1] + c * u - s * v, p[2] + s * u + c * v])];
}

export function coverCircles(pieces) {
  const out = [];
  for (const p of pieces || []) {
    const K = COVER_KINDS[p[0]], c = Math.cos(p[3]), s = Math.sin(p[3]);
    for (const u of K.at) out.push({ x: p[1] + c * u, z: p[2] + s * u, radius: K.r, cover: true });
  }
  return out;
}

// The first crossing of segment a -> b with a piece's box (grown by `pad`), as { t (0..1), x, z, piece } or null.
// A piece the segment starts inside (a shooter crouched against it) does not stop it.
export function coverBlock(pieces, ax, az, bx, bz, pad = 0.05) {
  if (!pieces?.length) return null;
  const dx = bx - ax, dz = bz - az;
  let best = null;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i], K = COVER_KINDS[p[0]];
    // Cheap reject: the segment passes farther than the piece's reach.
    if (segDist(p[1], p[2], ax, az, bx, bz) > K.L + K.W + pad) continue;
    const c = Math.cos(p[3]), s = Math.sin(p[3]);
    const ox = ax - p[1], oz = az - p[2];
    const u0 = ox * c + oz * s, v0 = -ox * s + oz * c, du = dx * c + dz * s, dv = -dx * s + dz * c;
    const L = K.L + pad, W = K.W + pad;
    if (Math.abs(u0) <= L && Math.abs(v0) <= W) continue;
    let t0 = 0, t1 = 1, ok = true;
    for (const [o, d, h] of [[u0, du, L], [v0, dv, W]]) {
      if (Math.abs(d) < 1e-9) { if (Math.abs(o) > h) { ok = false; break; } continue; }
      let a = (-h - o) / d, b = (h - o) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) { ok = false; break; }
    }
    if (!ok || t0 > 1) continue;
    if (!best || t0 < best.t) best = { t: t0, x: round(ax + dx * t0), z: round(az + dz * t0), piece: i };
  }
  return best;
}

// Connected regions of free cells (8 neighbours, no corner cutting: the route search's rule).
function label(blocked, n) {
  const comp = new Int32Array(n * n).fill(-1), stack = [];
  let id = 0;
  for (let s0 = 0; s0 < n * n; s0++) {
    if (blocked[s0] || comp[s0] >= 0) continue;
    comp[s0] = id;
    stack.push(s0);
    while (stack.length) {
      const c = stack.pop(), x = c % n, z = (c / n) | 0;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, nz = z + dz;
          if ((!dx && !dz) || nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
          const i = nz * n + nx;
          if (blocked[i] || comp[i] >= 0) continue;
          if (dx && dz && (blocked[z * n + nx] || blocked[nz * n + x])) continue;
          comp[i] = id;
          stack.push(i);
        }
    }
    id++;
  }
  return comp;
}
// The nav cells a set of circles would block (the grid's own rule: centre within radius + 0.65).
function cellsOf(nav, circles) {
  const out = [], n = nav.grid;
  for (const o of circles) {
    const [cx, cz] = nav.cellAt(o.x, o.z), reach = Math.ceil((o.radius + 0.65) / 2) + 1;
    for (let z = Math.max(0, cz - reach); z <= Math.min(n - 1, cz + reach); z++)
      for (let x = Math.max(0, cx - reach); x <= Math.min(n - 1, cx + reach); x++) {
        const p = nav.worldAt(x, z);
        if (hyp(p.x - o.x, p.z - o.z) < o.radius + 0.65) out.push(z * n + x);
      }
  }
  return out;
}
// True when blocking `cells` leaves every region of free ground in one piece (none split, none cut off).
export function keepsConnected(blocked, n, cells, before = label(blocked, n)) {
  const next = blocked.slice();
  for (const i of cells) next[i] = 1;
  const after = label(next, n), seen = new Map();
  for (let i = 0; i < n * n; i++) {
    if (before[i] < 0 || after[i] < 0) continue;
    const was = seen.get(before[i]);
    if (was === undefined) seen.set(before[i], after[i]);
    else if (was !== after[i]) return false;
  }
  // A region the pieces covered completely is gone: refused as well (it was ground someone could stand on).
  const left = new Set(seen.keys());
  for (let i = 0; i < n * n; i++) if (before[i] >= 0 && !left.has(before[i])) return false;
  return true;
}

// The spots a piece must keep clear of, gathered once from the match as it is now.
function keepouts(sim) {
  const T = sim.terrain, cores = [], buildings = [], units = [], walls = [];
  for (const e of sim.entities) {
    if (!(e.hp > 0)) continue;
    if (e.kind === "wall") walls.push(e);
    else if (e.kind === "building") { buildings.push(e); if (e.type === "hq") cores.push(e); }
    else if (e.kind === "unit" && !e.flying) units.push(e);
  }
  const lanes = [];
  for (let i = 0; i < cores.length; i++)
    for (let j = i + 1; j < cores.length; j++) if (cores[i].team !== cores[j].team) lanes.push([cores[i].x, cores[i].z, cores[j].x, cores[j].z]);
  const points = [...Object.values(sim.skirmishPoints || {}), ...Object.values(sim.mission?.points || {})];
  const def = sim.defence ? sim.defenceDef?.() : null;
  const routes = def ? Object.values(def.routes || {}) : [];
  return { T, cores, buildings, units, walls, lanes, points, def, routes };
}

function valid(sim, k, p, placed) {
  const { T } = k, K = COVER_KINDS[p[0]], [, x, z] = p, limit = T.half - COVER.edge;
  for (const q of placed) if (hyp(q[1] - x, q[2] - z) < COVER.spacing) return false;
  for (const [sx, sz] of samples(p, 1.2)) {
    if (Math.abs(sx) > limit || Math.abs(sz) > limit) return false;
    if (!T.canStand(sx, sz, 0.9)) return false;
  }
  if (T.plateaus.length && (T.onRamp(x, z, 4) || T.cliff(x, z, K.L + 2.5))) return false;
  // Roads, bridges, fords and water stay open: a ring of probes around the piece.
  for (let i = 0; i < 9; i++) {
    const a = (i * Math.PI) / 4, r = i === 8 ? 0 : K.L + COVER.road;
    const s = T.at(x + Math.cos(a) * r, z + Math.sin(a) * r);
    if (s === "road" || s === "bridge" || s === "ford" || s === "water") return false;
  }
  for (const river of T.rivers) {
    if (Math.abs(z - river.z) < COVER.bank) return false;
    for (const c of river.crossings) if (hyp(x - c.x, z - river.z) < c.half + COVER.crossing) return false;
  }
  for (const l of T.lakes) { const d = hyp(x - l.x, z - l.z); if (d < l.r + COVER.shore + K.L && d > l.inner - COVER.shore - K.L) return false; }
  for (const [rx, rz, r] of T.rocks || []) if (hyp(x - rx, z - rz) < r + COVER.rock + K.L) return false;
  for (const e of k.walls) if (hyp(x - e.x, z - e.z) < (e.radius || 1) + COVER.rock + K.L) return false;
  for (const e of k.cores) if (hyp(x - e.x, z - e.z) < COVER.core) return false;
  for (const e of k.buildings) if (hyp(x - e.x, z - e.z) < e.radius + COVER.building + K.L) return false;
  for (const e of k.units) if (hyp(x - e.x, z - e.z) < e.radius + COVER.unit + K.L) return false;
  for (const r of sim.resources) if (hyp(x - r.x, z - r.z) < (r.radius || 1.5) + COVER.deposit + K.L) return false;
  for (const q of k.points) if (hyp(x - q.x, z - q.z) < (q.r || 5) + COVER.point + K.L) return false;
  for (const [ax, az, bx, bz] of k.lanes) if (segDist(x, z, ax, az, bx, bz) < COVER.lane + K.L) return false;
  if (k.def) {
    for (const pts of k.routes)
      for (let i = 1; i < pts.length; i++) if (segDist(x, z, pts[i - 1].x, pts[i - 1].z, pts[i].x, pts[i].z) < COVER.route + K.L) return false;
    for (const pts of k.routes) if (pts[0] && hyp(x - pts[0].x, z - pts[0].z) < 12) return false;
    if (k.def.exit && hyp(x - k.def.exit.x, z - k.def.exit.z) < (k.def.exit.r || 4) + 8) return false;
    for (const pad of k.def.pads || []) if (hyp(x - pad.x, z - pad.z) < COVER.pad + K.L) return false;
    for (const zone of k.def.zones || []) for (const [sx, sz] of samples(p, 3)) if (sim.inZone?.(zone, sx, sz)) return false;
  }
  return true;
}

// The match's cover pieces, placed now. Seeded by the map, so the same map and setup give the same pieces.
export function planCover(sim) {
  const T = sim.terrain, nav = sim.nav, n = nav.grid;
  const rng = mulberry32(fnv1a(`cover:${T.id}`));
  const want = Math.max(COVER.min, Math.min(COVER.max, Math.round((COVER.per128 * T.size) / 128)));
  const k = keepouts(sim), placed = [];
  // Missions and Defence levels are not mirrored maps: one piece at a time there.
  const mirrors = T.defence || sim.mission ? [[1, 1]] : REFLECTIONS[T.symmetry === "quad" ? "quad" : "point"];
  const blocked = nav.blocked.slice();
  let regions = label(blocked, n);
  for (let attempt = 0; attempt < COVER.tries && placed.length < want; attempt++) {
    const roll = rng(), kind = roll < 0.4 ? 0 : roll < 0.75 ? 1 : 2;
    const x = round((rng() * 2 - 1) * (T.half - COVER.edge)), z = round((rng() * 2 - 1) * (T.half - COVER.edge));
    const a = Math.floor(rng() * 12) * (Math.PI / 12);
    // The piece and its mirror images (a skirmish map's own symmetry), so no side gets more cover.
    const group = [];
    for (const [sx, sz] of mirrors) {
      const px = round(x * sx || 0), pz = round(z * sz || 0);
      if (group.some((g) => g[1] === px && g[2] === pz)) continue;
      group.push([kind, px, pz, round(Math.atan2(sz * Math.sin(a), sx * Math.cos(a)), 1000)]);
    }
    if (placed.length + group.length > want + 1) continue;
    if (!group.every((p, i) => valid(sim, k, p, [...placed, ...group.slice(0, i)]))) continue;
    const cells = cellsOf(nav, coverCircles(group));
    if (!keepsConnected(blocked, n, cells, regions)) continue;
    for (const i of cells) blocked[i] = 1;
    regions = label(blocked, n);
    placed.push(...group);
  }
  return placed;
}
