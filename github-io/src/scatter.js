import * as THREE from "three";
import { ROCKS } from "./data.js";
import { themeFor, lookOf } from "./visual-style.js";
import { fogAware } from "./fog-aware.js";

// Map dressing: grass, flowers, pebbles, rocks, shrubs, small trees, Builder ruins and each
// map's own props. Everything is planned from a seed (never the simulation's state), merged
// into one vertex-coloured mesh and drawn with one material: one draw for all of it.
// Nothing here casts a shadow, blocks movement or takes part in picking. Props stay low (see
// HEIGHT) so they do not hide units, keep out of camps, roads, water and wall footprints, and
// are flattened under buildings and deposits the player has seen.

// Blocks per side. One mesh covers the whole map: every map's dressing is lighter than the
// instanced pebbles and grass it replaced, so it is one draw instead of two.
export const blocksPerSide = () => 1;
// Tallest point of each kind at scale 1 (world units); a Ranger is about 1.6 tall.
export const HEIGHT = { tuft: 0.6, fern: 0.5, flower: 0.55, pebble: 0.2, rock: 0.7, bush: 0.75, sapling: 1.9, conifer: 2.0,
  cactus: 1.45, bones: 0.5, mushroom: 0.4, log: 0.36, stump: 0.4, snag: 1.8, cinder: 0.26, column: 1.0, shard: 1.0, ore: 0.8,
  ruinBlock: 0.9, ruinPillar: 1.5, ruinFloor: 0.05, lily: 0.02 };
export const MAX_SCALE = 1.25;
// Kinds a unit could visibly clip through: kept out of camps and thinned on low budgets.
export const SOLID = new Set(["rock", "bush", "sapling", "conifer", "cactus", "snag", "column", "shard", "ore", "ruinBlock", "ruinPillar", "log", "stump", "bones"]);
const LAND = ["grass", "dirt", "sand", "stone"];
// Per map: [kind, tries per 96 x 96 of map, surfaces it grows on]; a try on the wrong
// surface is dropped, so real counts are lower. `rim` is the number of edge stones.
export const DRESSING = {
  classic: { rim: 46, ruins: 1, list: [["tuft", 1500, ["dirt"]], ["cinder", 260, ["dirt"]], ["pebble", 420, ["dirt"]], ["rock", 60, ["dirt"]],
    ["snag", 30, ["dirt"]], ["stump", 18, ["dirt"]], ["ruinFloor", 8, ["dirt"]], ["ruinPillar", 8, ["dirt"]], ["bones", 10, ["dirt"]]] },
  riverlands: { rim: 40, ruins: 1, list: [["tuft", 4200, ["grass"]], ["tuft", 500, ["dirt", "mud"]], ["flower", 420, ["grass"]], ["pebble", 600, ["dirt", "sand", "mud"]],
    ["rock", 50, LAND], ["bush", 70, ["grass"]], ["sapling", 56, ["grass"]], ["lily", 700, ["water"]], ["ruinFloor", 8, ["grass", "sand", "dirt"]], ["ruinPillar", 8, ["grass", "sand"]]] },
  basin: { rim: 50, ruins: 1, list: [["tuft", 2600, ["grass"]], ["tuft", 500, ["dirt", "sand"]], ["ore", 70, ["dirt", "sand"]], ["pebble", 560, ["dirt", "sand"]], ["rock", 60, LAND],
    ["flower", 200, ["grass"]], ["bush", 50, ["grass"]], ["cactus", 22, ["sand"]], ["ruinFloor", 9, LAND], ["ruinPillar", 10, LAND]] },
  expanse: { rim: 40, ruins: 1, list: [["tuft", 3800, ["grass"]], ["tuft", 400, ["dirt", "mud"]], ["flower", 380, ["grass"]], ["pebble", 500, ["dirt", "sand", "mud"]],
    ["rock", 50, LAND], ["bush", 50, ["grass"]], ["conifer", 70, ["grass"]], ["lily", 500, ["water"]], ["ruinFloor", 7, ["grass", "sand", "dirt"]], ["ruinPillar", 7, ["grass", "sand"]]] },
  dunes: { rim: 50, ruins: 1, list: [["tuft", 900, ["sand", "dirt"]], ["pebble", 520, ["sand", "dirt"]], ["rock", 80, ["sand", "dirt"]], ["cactus", 60, ["sand"]],
    ["bones", 18, ["sand"]], ["flower", 300, ["dirt"]], ["ruinFloor", 9, ["sand", "dirt"]], ["ruinPillar", 10, ["sand", "dirt"]]] },
  woodlands: { rim: 46, ruins: 1, list: [["tuft", 3200, ["grass"]], ["fern", 650, ["grass"]], ["flower", 420, ["grass"]], ["mushroom", 120, ["grass", "dirt"]],
    ["pebble", 400, ["dirt", "sand", "mud"]], ["rock", 36, LAND], ["bush", 80, ["grass"]], ["sapling", 80, ["grass"]], ["conifer", 44, ["grass"]],
    ["log", 22, ["grass", "dirt"]], ["stump", 24, ["grass", "dirt"]], ["lily", 600, ["water"]], ["ruinFloor", 6, ["grass", "dirt"]], ["ruinPillar", 6, ["grass"]]] },
  highlands: { rim: 50, ruins: 1, list: [["tuft", 2400, ["grass", "dirt"]], ["column", 110, ["stone", "dirt"]], ["shard", 130, ["stone", "dirt"]], ["pebble", 520, ["stone", "dirt"]],
    ["rock", 70, LAND], ["flower", 400, ["grass"]], ["ruinFloor", 8, ["stone", "dirt"]], ["ruinPillar", 8, ["stone", "dirt"]]] },
};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashId = (id) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

// The four camp sites (starting bases stand in mirrored quadrants) stay clear of solid props.
export function campSites(terrain) {
  const o = terrain.offset || 0;
  return [[-1, 1], [1, -1], [1, 1], [-1, -1]].map(([sx, sz]) => [sx * (25 + o), sz * (24 + o)]);
}
const CAMP_RADIUS = 15;

// Pure and seeded: the same map always gets the same dressing. `budget` thins it on Eco.
export function planScatter(terrain, budget = 1) {
  const recipe = DRESSING[lookOf(terrain.id)] || DRESSING.classic, r = rng(hashId(terrain.id) ^ 0x5ca77e2), half = terrain.half;
  const area = (terrain.size / 96) ** 2, camps = campSites(terrain), props = [];
  // Defence maps have no boulder walls (sim: terrain.defence).
  const walls = terrain.defence ? [] : ROCKS;
  const nearWall = (x, z, pad) => walls.some(([wx, wz, wr]) => Math.hypot(x - wx, z - wz) < wr + pad);
  const nearCamp = (x, z) => camps.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < CAMP_RADIUS);
  const add = (kind, x, z, s) => props.push({ kind, x, z, s: Math.min(MAX_SCALE, s), a: r() * 6.2832, tone: r(), seed: (r() * 4294967296) >>> 0 });
  for (const [kind, count, on] of recipe.list) {
    const solid = SOLID.has(kind), n = Math.round(count * area * (solid ? Math.min(1, budget + 0.15) : budget));
    const reach = half - (kind === "ruinFloor" ? 3.2 : 1.2);
    for (let i = 0; i < n; i++) {
      const x = (r() * 2 - 1) * reach, z = (r() * 2 - 1) * reach, s = 0.75 + r() * 0.5;
      if (!on.includes(terrain.at(x, z)) || terrain.cliff?.(x, z, 0.8) || terrain.onRamp?.(x, z, 0.8)) continue;
      if (nearWall(x, z, kind === "ruinFloor" ? 2.6 : 0.7)) continue;
      if ((solid || kind === "ruinFloor") && nearCamp(x, z)) continue;
      // Paving rings are wide: every part of one must lie on land.
      if (kind === "ruinFloor" && [[2.6, 0], [-2.6, 0], [0, 2.6], [0, -2.6]].some(([dx, dz]) => !LAND.includes(terrain.at(x + dx, z + dz)))) continue;
      add(kind, x, z, s);
    }
  }
  // A broken line of rocks and shrubs just inside the edge frames the map without hiding units.
  const rim = Math.round(recipe.rim * (terrain.size / 96) * Math.min(1, budget + 0.15));
  for (let i = 0; i < rim; i++) {
    const side = Math.floor(r() * 4), along = (r() * 2 - 1) * (half - 1), inset = half - 1.25 - r() * 0.4, s = 0.9 + r() * 0.35;
    const x = side === 0 ? -inset : side === 1 ? inset : along, z = side === 2 ? -inset : side === 3 ? inset : along;
    const kind = r() < 0.6 ? "rock" : terrain.at(x, z) === "grass" ? "bush" : "rock";
    if (!LAND.includes(terrain.at(x, z)) || nearCamp(x, z)) continue;
    add(kind, x, z, s);
  }
  // Fallen Builder stones lean against the old walls, where no unit can stand anyway.
  if (recipe.ruins) walls.forEach(([wx, wz, wr], i) => {
    for (let k = 0; k < 2; k++) {
      const a = r() * 6.2832, d = wr + 0.5 + r() * 0.3, x = wx + Math.cos(a) * d, z = wz + Math.sin(a) * d, s = 0.8 + r() * 0.4;
      if (Math.abs(x) > half - 1.2 || Math.abs(z) > half - 1.2 || !LAND.includes(terrain.at(x, z)) || (i + k) % 3 === 2 || nearWall(x, z, 0.46) || nearCamp(x, z)) continue;
      add("ruinBlock", x, z, s);
    }
  });
  return props;
}

const CAMERA = new THREE.Vector3(25, 51, 43).normalize(); // view.js CAMERA_OFFSET

// Collects triangles for one block. Solid shapes get flat normals facing away from their
// centre; foliage is wound to face the (fixed) camera and lit like the ground it grows on.
class Mesher {
  constructor() { this.p = []; this.n = []; this.c = []; this.w = []; this.cx = 0; this.cy = 0; this.cz = 0; this.cos = 1; this.sin = 0; this.s = 1; this.x = 0; this.z = 0; this.y = 0; }
  place(x, z, s, a, y = 0) { this.x = x; this.z = z; this.y = y; this.s = s; this.cos = Math.cos(a); this.sin = Math.sin(a); this.centre(0, 0.2, 0); }
  centre(lx, ly, lz) { const v = this.at(lx, ly, lz); this.cx = v[0]; this.cy = v[1]; this.cz = v[2]; }
  at(lx, ly, lz) { return [this.x + (lx * this.cos - lz * this.sin) * this.s, this.y + ly * this.s, this.z + (lx * this.sin + lz * this.cos) * this.s]; }
  tri(a, b, c, ca, cb, cc, soft = false, wa = 0, wb = 0, wc = 0) {
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length; ny /= length; nz /= length;
    const outward = soft ? nx * CAMERA.x + ny * CAMERA.y + nz * CAMERA.z
      : nx * ((a[0] + b[0] + c[0]) / 3 - this.cx) + ny * ((a[1] + b[1] + c[1]) / 3 - this.cy) + nz * ((a[2] + b[2] + c[2]) / 3 - this.cz);
    if (outward < 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; [wb, wc] = [wc, wb]; nx = -nx; ny = -ny; nz = -nz; }
    if (soft) { nx *= 0.25; nz *= 0.25; ny = 0.95; }
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.c.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    this.w.push(wa, wb, wc);
  }
  quad(a, b, c, d, ca, cb, cc, cd, soft = false) { this.tri(a, b, c, ca, cb, cc, soft); this.tri(a, c, d, ca, cc, cd, soft); }
  // Tapered prism around local (ox, oz): n sides from radius r0 at y0 to r1 at y1, optional cap.
  prism(n, r0, r1, y0, y1, side, top, { ox = 0, oz = 0, tx = 0, tz = 0, cap = true, spin = 0, tilt = 0, sideTop = side } = {}) {
    const low = [], high = [];
    for (let i = 0; i < n; i++) {
      const a = spin + (i / n) * 6.2832, c = Math.cos(a), s = Math.sin(a);
      low.push(this.at(ox + c * r0, y0, oz + s * r0));
      high.push(this.at(ox + tx + c * r1, y1 + c * tilt, oz + tz + s * r1));
    }
    this.centre(ox + tx * 0.5, (y0 + y1) * 0.5, oz + tz * 0.5);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, shade = 0.82 + 0.18 * ((i * 7) % n) / n, a = mul(side, shade), b = mul(sideTop, shade);
      this.quad(low[i], low[j], high[j], high[i], a, a, b, b);
    }
    if (cap) {
      this.centre(ox + tx, y0, oz + tz);
      for (let i = 1; i < n - 1; i++) this.tri(high[0], high[i], high[i + 1], top, top, top);
    }
  }
  cone(n, r, y0, y1, base, tip, { ox = 0, oz = 0, tx = 0, tz = 0, spin = 0, sway = 0 } = {}) {
    const apex = this.at(ox + tx, y1, oz + tz);
    this.centre(ox, y0 - r, oz);
    for (let i = 0; i < n; i++) {
      const a = spin + (i / n) * 6.2832, b = spin + ((i + 1) / n) * 6.2832, shade = 0.84 + 0.16 * ((i * 3) % n) / n;
      this.tri(this.at(ox + Math.cos(a) * r, y0, oz + Math.sin(a) * r), this.at(ox + Math.cos(b) * r, y0, oz + Math.sin(b) * r), apex,
        mul(base, shade), mul(base, shade), tip, false, 0, 0, sway);
    }
  }
  get vertices() { return this.p.length / 3; }
}
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Vertex colours are linear; the theme table is sRGB.
export function scatterColors(id) {
  const theme = themeFor(id), out = {};
  for (const [key, value] of Object.entries(theme)) { const c = new THREE.Color(value); out[key] = [c.r, c.g, c.b]; }
  return out;
}

const SHAPES = {
  tuft(m, p, C, r) {
    const blades = 4 + (p.seed & 1), tip = mul(mix(C.leaf, C.leafAlt, 0.7 + p.tone * 0.3), 1.12), base = mul(C.leaf, 0.42);
    for (let i = 0; i < blades; i++) {
      const a = i * 1.45 + r() * 0.7, h = 0.36 + r() * 0.24, lean = 0.2 + r() * 0.16, c = Math.cos(a), s = Math.sin(a), w = 0.12;
      m.tri(m.at(c * 0.05 - s * w, 0, s * 0.05 + c * w), m.at(c * 0.05 + s * w, 0, s * 0.05 - c * w), m.at(c * (0.05 + lean), h, s * (0.05 + lean)),
        base, base, tip, true, 0, 0, h * m.s);
    }
  },
  fern(m, p, C, r) {
    const tip = mix(C.leaf, C.leafAlt, 0.5 + p.tone * 0.5), base = mul(C.leaf, 0.7);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.257 + r() * 0.4, c = Math.cos(a), s = Math.sin(a), reach = 0.3 + r() * 0.16;
      m.tri(m.at(-s * 0.09, 0.02, c * 0.09), m.at(s * 0.09, 0.02, -c * 0.09), m.at(c * reach, 0.2 + r() * 0.14, s * reach), base, base, tip, true, 0, 0, 0.2 * m.s);
    }
  },
  flower(m, p, C, r) {
    const bloom = [C.bloomA, C.bloomB, C.bloomC][p.seed % 3], heart = mix(bloom, [1, 1, 0.8], 0.55), stem = mul(C.leaf, 0.8);
    const count = 3 + (p.seed >> 3) % 3;
    for (let i = 0; i < count; i++) {
      const ox = (r() - 0.5) * 1.1, oz = (r() - 0.5) * 1.1, h = 0.3 + r() * 0.18, d = 0.17 + r() * 0.07, w = h * m.s;
      m.tri(m.at(ox - 0.035, 0, oz), m.at(ox + 0.035, 0, oz), m.at(ox, h, oz), stem, stem, stem, true, 0, 0, w);
      // Four petals around a pale heart, tipped a little toward the camera.
      const top = m.at(ox, h + 0.02, oz), q = (dx, dz, dy = 0) => [top[0] + dx * m.s, top[1] + dy * m.s, top[2] + dz * m.s], spin = r() * 1.57;
      for (let k = 0; k < 4; k++) {
        const a = spin + k * 1.5708, c = Math.cos(a), s = Math.sin(a);
        m.tri(q(0, 0, 0.03), q((c - s * 0.55) * d, (s + c * 0.55) * d), q((c + s * 0.55) * d, (s - c * 0.55) * d), heart, bloom, bloom, true, w, w, w);
      }
    }
  },
  pebble(m, p, C, r, top = null) {
    const rad = 0.1 + r() * 0.09, base = mul(C.rock, 0.72 + p.tone * 0.3);
    m.cone(4, rad, 0, 0.07 + r() * 0.09, base, top || mul(C.rock, 1.25), { tx: (r() - 0.5) * rad, tz: (r() - 0.5) * rad, spin: r() * 3 });
  },
  cinder(m, p, C, r) { SHAPES.pebble(m, p, { ...C, rock: mul(C.rock, 0.7) }, r, mix(C.bloomA, C.bloomB, p.tone)); },
  rock(m, p, C, r) {
    const rad = 0.34 + r() * 0.22, h = 0.3 + r() * 0.3, side = mul(C.rock, 0.78 + p.tone * 0.2);
    m.prism(5, rad, rad * (0.5 + r() * 0.2), 0, h, mul(side, 0.8), mul(C.rock, 1.3), { tx: (r() - 0.5) * 0.2, tz: (r() - 0.5) * 0.2, spin: r() * 3, tilt: 0.06, sideTop: side });
    if (r() < 0.6) m.prism(4, rad * 0.5, rad * 0.25, 0, h * 0.55, mul(side, 0.85), mul(C.rock, 1.2), { ox: rad * 0.95, oz: (r() - 0.5) * 0.4, spin: r() * 3, sideTop: side });
  },
  ore(m, p, C, r) {
    SHAPES.rock(m, p, C, r);
    for (let i = 0; i < 2; i++) m.cone(3, 0.09, 0.25, 0.55 + r() * 0.2, mul(C.accent, 0.8), mix(C.accent, [1, 1, 1], 0.45), { ox: (r() - 0.5) * 0.3, oz: (r() - 0.5) * 0.3, tx: (r() - 0.5) * 0.2, spin: r() * 3 });
  },
  bush(m, p, C, r) {
    const blobs = 2 + (p.seed & 1), light = mix(C.leaf, C.leafAlt, 0.5 + p.tone * 0.5);
    for (let i = 0; i < blobs; i++) {
      const ox = i ? (r() - 0.5) * 0.7 : 0, oz = i ? (r() - 0.5) * 0.7 : 0, rad = (i ? 0.26 : 0.36) + r() * 0.08, h = rad * 1.5;
      m.prism(5, rad * 0.8, rad, 0, h * 0.45, mul(C.leaf, 0.55), light, { ox, oz, cap: false, spin: r() * 3, sideTop: mul(C.leaf, 0.9) });
      m.cone(5, rad, h * 0.45, h, mul(C.leaf, 0.95), light, { ox, oz, spin: r() * 3, sway: 0.12 });
    }
    if (p.seed % 5 === 0) { // a few bushes are in bloom
      const top = m.at(0, 0.56, 0), d = 0.07 * m.s;
      m.tri([top[0] - d, top[1], top[2] - d], [top[0] + d, top[1], top[2] - d], [top[0], top[1], top[2] + d], C.bloomA, C.bloomA, C.bloomA, true);
    }
  },
  sapling(m, p, C, r) {
    const h = 1.35 + r() * 0.5, rad = 0.36 + r() * 0.1, light = mix(C.leaf, C.leafAlt, 0.45 + p.tone * 0.55);
    m.prism(3, 0.07, 0.05, 0, h * 0.5, mul(C.wood, 0.8), C.wood, { cap: false, sideTop: C.wood });
    m.cone(5, rad, h * 0.62, h * 0.34, mul(C.leaf, 0.7), mul(C.leaf, 0.55), { spin: 0.3 });
    m.cone(5, rad, h * 0.62, h, mul(C.leaf, 0.95), light, { spin: 0.3, tx: (r() - 0.5) * 0.1, sway: 0.16 });
  },
  conifer(m, p, C, r) {
    const h = 1.5 + r() * 0.5, light = mix(C.leaf, C.leafAlt, 0.3 + p.tone * 0.4);
    m.prism(3, 0.07, 0.05, 0, h * 0.3, mul(C.wood, 0.8), C.wood, { cap: false, sideTop: C.wood });
    m.cone(5, 0.44, h * 0.22, h * 0.68, mul(C.leaf, 0.62), mul(C.leaf, 0.95), { spin: 0.2 });
    m.cone(5, 0.31, h * 0.52, h, mul(C.leaf, 0.75), light, { spin: 0.8, sway: 0.12 });
  },
  cactus(m, p, C, r) {
    const h = 0.85 + r() * 0.5, skin = mul(C.leaf, 0.9), lit = mix(C.leaf, C.leafAlt, 0.5);
    m.prism(4, 0.15, 0.13, 0, h, mul(skin, 0.8), lit, { spin: 0.78, sideTop: skin });
    const side = r() < 0.5 ? 1 : -1, arm = h * (0.35 + r() * 0.2);
    m.prism(4, 0.08, 0.08, arm, arm + 0.02, skin, lit, { ox: side * 0.2, cap: false, spin: 0.78 });
    m.prism(4, 0.085, 0.075, arm, arm + h * 0.38, mul(skin, 0.8), lit, { ox: side * 0.3, spin: 0.78, sideTop: skin });
    m.cone(4, 0.06, h, h + 0.09, C.bloomA, mix(C.bloomA, [1, 1, 1], 0.4), { spin: 0.3 });
  },
  bones(m, p, C, r) {
    const bone = mix(C.ruin, [1, 1, 1], 0.2), dark = mul(C.ruin, 0.7);
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 0.3, h = 0.4 - Math.abs(i - 1) * 0.08;
      m.quad(m.at(-0.36, 0, z), m.at(-0.3, 0, z + 0.07), m.at(-0.04, h, z + 0.07), m.at(-0.1, h, z), dark, dark, bone, bone, true);
      m.quad(m.at(0.36, 0, z), m.at(0.3, 0, z + 0.07), m.at(0.04, h, z + 0.07), m.at(0.1, h, z), dark, dark, bone, bone, true);
    }
    m.quad(m.at(-0.04, 0.03, -0.5), m.at(0.04, 0.03, -0.5), m.at(0.04, 0.03, 0.5), m.at(-0.04, 0.03, 0.5), bone, bone, bone, bone, true);
  },
  mushroom(m, p, C, r) {
    const cap = [C.bloomB, C.bloomA, C.bloomC][p.seed % 3], count = 2 + (p.seed >> 2) % 2;
    for (let i = 0; i < count; i++) {
      const ox = (r() - 0.5) * 0.4, oz = (r() - 0.5) * 0.4, h = 0.12 + r() * 0.1;
      m.prism(3, 0.03, 0.03, 0, h, mul(C.ruin, 0.8), C.ruin, { ox, oz, cap: false });
      m.cone(5, 0.11 + r() * 0.04, h, h + 0.1, mul(cap, 0.85), mix(cap, [1, 1, 1], 0.5), { ox, oz });
    }
  },
  log(m, p, C, r) {
    // A fallen trunk along local x, mossy on top.
    const length = 0.9 + r() * 0.5, rad = 0.15, n = 5, bark = mul(C.wood, 0.85), moss = mix(C.wood, C.leaf, 0.6), ends = [[], []];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 + 0.3;
      ends[0].push(m.at(-length / 2, rad * 0.9 + Math.sin(a) * rad, Math.cos(a) * rad));
      ends[1].push(m.at(length / 2, rad * 0.9 + Math.sin(a) * rad, Math.cos(a) * rad));
    }
    m.centre(0, rad, 0);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, up = ends[0][i][1] + ends[0][j][1] > 2 * (m.y + rad * 0.9 * m.s) ? moss : bark;
      m.quad(ends[0][i], ends[0][j], ends[1][j], ends[1][i], up, up, up, up);
    }
    const cut = mix(C.wood, [1, 0.9, 0.7], 0.45);
    for (const end of ends) for (let i = 1; i < n - 1; i++) m.tri(end[0], end[i], end[i + 1], cut, cut, cut);
  },
  stump(m, p, C, r) {
    m.prism(6, 0.22, 0.17, 0, 0.2 + r() * 0.14, mul(C.wood, 0.75), mix(C.wood, [1, 0.9, 0.7], 0.45), { spin: r() * 3, sideTop: C.wood });
  },
  snag(m, p, C, r) {
    const h = 1.2 + r() * 0.55, lean = (r() - 0.5) * 0.3, char = mul(C.wood, 0.9), ember = mix(C.wood, C.bloomA, 0.5);
    m.prism(3, 0.1, 0.035, 0, h, mul(char, 0.75), ember, { tx: lean, sideTop: char });
    for (let i = 0; i < 2; i++) {
      const y = h * (0.45 + i * 0.22), side = i ? -1 : 1, x = lean * (y / h);
      m.tri(m.at(x, y - 0.05, 0), m.at(x, y + 0.05, 0), m.at(x + side * (0.3 + r() * 0.15), y + 0.3, (r() - 0.5) * 0.2), char, char, ember, true);
    }
  },
  column(m, p, C, r) {
    // A cluster of basalt columns: hexagonal, stepped, pale on top.
    const count = 3 + (p.seed & 1), stone = mul(C.stone, 0.8 + p.tone * 0.2);
    for (let i = 0; i < count; i++) {
      const a = i * 2.1, d = i ? 0.42 : 0, h = 0.22 + r() * 0.72;
      m.prism(6, 0.25, 0.25, 0, h, mul(stone, 0.62), mix(C.stone, [1, 1, 1], 0.28), { ox: Math.cos(a) * d, oz: Math.sin(a) * d, sideTop: stone });
    }
  },
  shard(m, p, C, r) {
    const glow = [C.bloomA, C.bloomB, C.bloomC][p.seed % 3];
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + r(), h = (i ? 0.4 : 0.75) + r() * 0.22, d = i ? 0.2 : 0;
      m.cone(3, 0.11, 0, h, mul(glow, 0.5), mix(glow, [1, 1, 1], 0.5), { ox: Math.cos(a) * d, oz: Math.sin(a) * d, tx: Math.cos(a) * d * 0.9, tz: Math.sin(a) * d * 0.9, spin: r() * 3 });
    }
  },
  ruinBlock(m, p, C, r) {
    const w = 0.42 + r() * 0.2, h = 0.34 + r() * 0.5, stone = mul(C.ruin, 0.78 + p.tone * 0.16);
    m.prism(4, w, w * 0.94, 0, h, mul(stone, 0.6), mix(C.ruin, [1, 1, 1], 0.2), { spin: 0.785, tilt: 0.05, sideTop: stone });
    // The Lattice inlay still holds a little light.
    const y = h + 0.012, g = C.glow;
    m.centre(0, 0, 0);
    m.quad(m.at(-w * 0.45, y, -0.04), m.at(w * 0.45, y, -0.04), m.at(w * 0.45, y, 0.04), m.at(-w * 0.45, y, 0.04), g, g, g, g, true);
  },
  ruinPillar(m, p, C, r) {
    const h = 0.7 + r() * 0.62, stone = mul(C.ruin, 0.8 + p.tone * 0.15), g = C.glow;
    m.prism(6, 0.4, 0.4, 0, 0.12, mul(stone, 0.6), mul(C.ruin, 0.95), { sideTop: mul(stone, 0.8) });
    m.prism(6, 0.27, 0.24, 0.12, h, mul(stone, 0.66), mix(C.ruin, [1, 1, 1], 0.25), { tilt: 0.12, sideTop: stone });
    m.prism(6, 0.285, 0.285, h * 0.5, h * 0.5 + 0.05, g, g, { cap: false });
  },
  ruinFloor(m, p, C, r) {
    // A broken ring of Builder paving, flat on the ground: units walk straight over it.
    const R = 1.7 + r() * 0.7, n = 12, y = 0.035, stone = mul(C.ruin, 0.72 + p.tone * 0.12), g = C.glow;
    const ring = (a, d) => m.at(Math.cos(a) * d, y / m.s, Math.sin(a) * d);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832, b = a + 6.2832 / n * 0.9, shade = mul(stone, 0.85 + r() * 0.3);
      if (r() < 0.3) continue;
      m.quad(ring(a, R - 0.34), ring(b, R - 0.34), ring(b, R), ring(a, R), shade, shade, shade, shade, true);
      if (r() < 0.6) m.quad(ring(a, R - 0.52), ring(b, R - 0.52), ring(b, R - 0.44), ring(a, R - 0.44), g, g, g, g, true);
    }
    const d = 0.3;
    m.quad(ring(0, d), ring(1.57, d), ring(3.14, d), ring(4.71, d), g, g, g, g, true);
  },
  lily(m, p, C, r) {
    const pad = mix(C.leaf, C.leafAlt, p.tone), rad = 0.2 + r() * 0.1, y = -0.058 / m.s, centre = m.at(0, y, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 6) * 6.2832, b = ((i + 1) / 6) * 6.2832;
      m.tri(centre, m.at(Math.cos(a) * rad, y, Math.sin(a) * rad), m.at(Math.cos(b) * rad, y, Math.sin(b) * rad), mul(pad, 0.8), pad, pad, true);
    }
    if (p.seed % 3 === 0) {
      const d = 0.06;
      m.tri(m.at(-d, y + 0.02, -d), m.at(d, y + 0.02, -d), m.at(0, y + 0.02, d), C.bloomC, C.bloomC, C.bloomA, true);
    }
  },
};

// Triangles of every block, for tests and budgets.
export function buildBlocks(terrain, props, colors = scatterColors(terrain.id)) {
  const blocks = new Map(), half = terrain.half, per = blocksPerSide(terrain), span = terrain.size / per;
  for (const p of props) {
    const bx = Math.min(per - 1, Math.floor((p.x + half) / span)), bz = Math.min(per - 1, Math.floor((p.z + half) / span)), key = bz * per + bx;
    let block = blocks.get(key);
    if (!block) blocks.set(key, (block = { mesher: new Mesher(), props: [] }));
    const m = block.mesher, start = m.vertices;
    m.place(p.x, p.z, p.s, p.a, terrain.heightAt ? terrain.heightAt(p.x, p.z) : 0);
    SHAPES[p.kind](m, p, colors, rng(p.seed));
    block.props.push(p.x, p.z, p.kind === "ruinFloor" ? 2.4 : 0.45, start, m.vertices - start);
  }
  return blocks;
}

export class Scatter {
  constructor(scene, terrain, { budget = 1, fog } = {}) {
    this.root = new THREE.Group();
    this.root.name = "Scatter";
    scene.add(this.root);
    this.time = { value: 0 };
    // Grass tips, flower heads and treetops lean with the wind: one uniform, no CPU work.
    // The same patch sinks everything into the fog of war (fog-aware.js).
    this.material = fogAware(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), fog, {
      key: "sway", uniforms: { uSway: this.time }, declare: "attribute float sway; uniform float uSway;",
      vertex: `transformed.x += sin(uSway * 1.7 + position.x * 0.9 + position.z * 0.7) * sway * 0.16;
        transformed.z += cos(uSway * 1.3 + position.x * 0.6 - position.z * 0.8) * sway * 0.11;`,
    });
    this.blocks = [];
    this.triangles = 0;
    for (const { mesher, props } of buildBlocks(terrain, planScatter(terrain, budget)).values()) {
      const geometry = new THREE.BufferGeometry(), position = new THREE.BufferAttribute(new Float32Array(mesher.p), 3);
      geometry.setAttribute("position", position);
      geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(mesher.n), 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(mesher.c), 3));
      geometry.setAttribute("sway", new THREE.BufferAttribute(new Float32Array(mesher.w), 1));
      geometry.computeBoundingSphere();
      geometry.boundingSphere.radius += 0.5; // wind sway
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = "scatter";
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.root.add(mesh);
      this.triangles += mesher.vertices / 3;
      this.blocks.push({ mesh, position, props: new Float32Array(props), flat: null });
    }
    this.flattened = false;
  }
  // Wind runs on its own clock so a paused or frozen frame changes nothing.
  update(dt, moving) {
    if (moving && dt > 0) this.time.value = (this.time.value + Math.min(0.05, dt)) % 3600;
  }
  // Press down everything within `radius` of a building or deposit (rare: once per object).
  flatten(x, z, radius) {
    for (const block of this.blocks) {
      const sphere = block.mesh.geometry.boundingSphere;
      if (Math.hypot(sphere.center.x - x, sphere.center.z - z) > sphere.radius + radius) continue;
      const props = block.props, array = block.position.array;
      for (let i = 0; i < props.length; i += 5) {
        const dx = props[i] - x, dz = props[i + 1] - z, reach = radius + props[i + 2];
        if (dx * dx + dz * dz > reach * reach) continue;
        const start = props[i + 3] * 3, count = props[i + 4] * 3;
        if (!count || (array[start] === array[start + 3] && array[start + 3] === array[start + 6] && array[start + 1] === array[start + 4] && array[start + 2] === array[start + 5])) continue;
        block.flat ||= array.slice();
        // Collapse the prop to a point: degenerate triangles are never rasterised.
        for (let k = 3; k < count; k += 3) { array[start + k] = array[start]; array[start + k + 1] = array[start + 1]; array[start + k + 2] = array[start + 2]; }
        block.position.addUpdateRange(start, count);
        block.position.needsUpdate = true;
        this.flattened = true;
      }
    }
  }
  // A new match stands everything up again.
  restore() {
    if (!this.flattened) return;
    for (const block of this.blocks) {
      if (!block.flat) continue;
      block.position.array.set(block.flat);
      block.flat = null;
      block.position.clearUpdateRanges();
      block.position.needsUpdate = true;
    }
    this.flattened = false;
  }
  dispose() {
    this.root.removeFromParent();
    for (const block of this.blocks) block.mesh.geometry.dispose();
    this.material.dispose();
    this.blocks.length = 0;
  }
}
