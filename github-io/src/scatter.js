import * as THREE from "three";
import { fnv1a, mulberry32 } from "./rng.js";
import { ROCKS } from "./data.js";
import { rimReach } from "./terrain.js";
import { themeFor, lookOf } from "./visual-style.js";
import { fogAware } from "./fog-aware.js";
import { wearGrid } from "./worn-paths.js";
import { landOf } from "./lands.js";

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
  ruinBlock: 0.9, ruinPillar: 1.5, ruinFloor: 0.05, lily: 0.02,
  // W9 lands: snow-capped pines, frosted tufts, snowy rocks, lava vents, palms and lagoon coral; and the Ancient ruins
  // family (any land): broken arches, carved stone heads, overgrown walls and fallen column drums.
  pine: 2.0, frost: 0.45, snowRock: 0.72, vent: 0.8, palm: 2.0, coral: 0.02,
  ruinArch: 1.62, stoneHead: 1.15, ruinWall: 0.95, brokenColumn: 0.55,
  // V1 terrain: reed clumps on the banks and basalt spires (volcano, highlands).
  reed: 0.95, spire: 1.9 };
export const MAX_SCALE = 1.25;
// Kinds a unit could visibly clip through: kept out of camps and thinned on low budgets.
export const SOLID = new Set(["rock", "bush", "sapling", "conifer", "cactus", "snag", "column", "shard", "ore", "ruinBlock", "ruinPillar", "log", "stump", "bones",
  "pine", "snowRock", "vent", "palm", "ruinArch", "stoneHead", "ruinWall", "brokenColumn", "spire"]);
// V1 terrain: kinds that grow in drifts (meadows and bare patches) instead of an even sprinkle.
export const MEADOW = new Set(["tuft", "flower", "fern", "frost"]);
// Groves along the playable edge (0.6-2 m in, where units seldom walk): tall kinds only on the far edges (north and
// west, away from the camera), low kinds all round. [tall kinds, low kinds, groves per 100 m of edge].
export const EDGE_GROVES = {
  classic: [["snag"], ["rock", "stump", "bones"], 7],
  riverlands: [["sapling", "conifer"], ["bush", "rock", "fern"], 9],
  basin: [["cactus"], ["bush", "rock", "ore"], 7],
  expanse: [["conifer", "sapling"], ["bush", "rock"], 9],
  dunes: [["cactus"], ["rock", "bones"], 6],
  woodlands: [["conifer", "sapling"], ["bush", "fern", "log"], 10],
  highlands: [["spire", "column"], ["rock", "shard"], 8],
  snowfield: [["pine"], ["snowRock", "frost"], 9],
  volcano: [["spire", "snag"], ["column", "cinder", "vent"], 8],
  archipelago: [["palm"], ["bush", "rock", "fern"], 8],
};
// Kinds that lie on open water (lily pads, lagoon coral); every other kind keeps to land.
export const WATER_KINDS = new Set(["lily", "coral"]);
// The Ancient ruins family (W9): any map may add it with maps.json `ruins` (a density multiplier, 1 = the
// standard hand); the three W9 lands carry it in their own recipes.
export const RUIN_KINDS = ["ruinArch", "stoneHead", "ruinWall", "brokenColumn"];
const RUIN_LIST = [["ruinArch", 7, ["grass", "dirt", "sand", "stone"]], ["stoneHead", 5, ["grass", "dirt", "sand", "stone"]],
  ["ruinWall", 16, ["grass", "dirt", "sand", "stone"]], ["brokenColumn", 16, ["grass", "dirt", "sand", "stone"]]]; // V1 terrain: a third more tries (the families now draw from their own streams; opt-in maps only)
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
  // W9 lands (src/lands.js). Snow: snow-capped pines in groves, frosted tufts, snowy rocks, ice crystals (the theme's
  // icy blooms) and old Builder stones half buried in the drifts.
  snowfield: { rim: 46, ruins: 1, list: [["frost", 1500, ["grass", "dirt"]], ["pine", 120, ["grass", "dirt"]], ["snowRock", 70, LAND], ["pebble", 380, ["dirt", "stone", "sand"]],
    ["shard", 40, ["stone", "dirt"]], ["stump", 14, ["grass", "dirt"]], ["ruinFloor", 6, ["grass", "dirt"]], ["ruinPillar", 6, ["grass", "dirt"]],
    ["ruinWall", 8, LAND], ["brokenColumn", 6, LAND], ["stoneHead", 2, LAND]] },
  // Volcano: glowing cinders and vents, basalt columns, charred snags, ember-lit obsidian shards, hardy ash tufts.
  volcano: { rim: 50, ruins: 1, list: [["tuft", 700, ["grass"]], ["cinder", 520, ["dirt", "stone", "grass"]], ["vent", 34, ["dirt", "stone"]], ["column", 90, ["stone", "dirt"]],
    ["snag", 40, ["grass", "dirt"]], ["shard", 60, ["stone"]], ["pebble", 420, LAND], ["rock", 50, LAND], ["ruinFloor", 6, ["dirt", "grass"]],
    ["ruinPillar", 6, ["dirt", "grass"]], ["ruinArch", 3, ["dirt", "grass"]], ["brokenColumn", 6, LAND]] },
  // Isles: palms on the beaches and in the grass, tropical tufts and flowers, bushes, coral heads in the lagoon,
  // and the sunken Builder town's arches and heads on every island.
  archipelago: { rim: 40, ruins: 1, list: [["tuft", 3600, ["grass"]], ["flower", 380, ["grass"]], ["fern", 300, ["grass"]], ["palm", 90, ["grass", "sand"]], ["bush", 50, ["grass"]],
    ["pebble", 380, ["sand", "dirt"]], ["rock", 36, LAND], ["coral", 160, ["water"]], ["lily", 120, ["water"]], ["ruinFloor", 6, ["grass", "sand", "dirt"]],
    ["ruinPillar", 6, ["grass", "sand"]], ["ruinArch", 5, ["grass", "sand"]], ["stoneHead", 4, ["grass", "sand"]], ["ruinWall", 8, ["grass", "sand", "dirt"]]] },
};

const rng = mulberry32;
const hashId = fnv1a;

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
  // Worn paths (worn-paths.js) stay clear of tufts, flowers and props: a 1 m wear grid over the map.
  // Tufts, flowers and pebbles keep off the whole track; solid props only off its trodden middle.
  const wn = Math.round(terrain.size), wear = wearGrid(terrain, wn), worn = (x, z, limit = 0.2) => wear[Math.min(wn - 1, Math.max(0, Math.floor(z + half))) * wn + Math.min(wn - 1, Math.max(0, Math.floor(x + half)))] > limit;
  // Defence maps have no boulder walls (sim: terrain.defence).
  const walls = terrain.defence ? [] : terrain.rocks || ROCKS;
  const nearWall = (x, z, pad) => walls.some(([wx, wz, wr]) => Math.hypot(x - wx, z - wz) < wr + pad);
  const nearCamp = (x, z) => camps.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < CAMP_RADIUS);
  const add = (kind, x, z, s, g = r) => props.push({ kind, x, z, s: Math.min(MAX_SCALE, s), a: g() * 6.2832, tone: g(), seed: (g() * 4294967296) >>> 0 });
  const clump = (x, z) => { const v = valueNoise(x * 0.085 + 13, z * 0.085 - 29) * 0.7 + valueNoise(x * 0.23 - 7, z * 0.23 + 3) * 0.3; return Math.min(1, Math.max(0, (v - 0.34) / 0.3)); };
  // maps.json `ruins` (W9): the Ancient ruins family on any land, at that multiple of the standard hand.
  const list = terrain.ruins > 0 ? [...recipe.list, ...RUIN_LIST.map(([kind, count, on]) => [kind, count * terrain.ruins, on])] : recipe.list;
  for (const [kind, count, on] of list) {
    // Each family has its own seeded stream (V1 terrain), so a change to one family never moves another.
    const g = rng(hashId(`${terrain.id}|${kind}|${count}|${on.join()}`) ^ 0x5ca77e2);
    // maps.json "dressing" (R3 map variety): a lighter hand for a map with more open ground than its look's own map.
    const solid = SOLID.has(kind), drift = MEADOW.has(kind), n = Math.round(count * area * (solid ? Math.min(1, budget + 0.15) : budget) * (terrain.dressing || 1) * (drift ? 1.15 : 1));
    const reach = half - (kind === "ruinFloor" ? 3.2 : 1.2);
    for (let i = 0; i < n; i++) {
      const x = (g() * 2 - 1) * reach, z = (g() * 2 - 1) * reach, s = 0.75 + g() * 0.5;
      if (!on.includes(terrain.at(x, z)) || terrain.cliff?.(x, z, 0.8) || terrain.onRamp?.(x, z, 0.8)) continue;
      if (!WATER_KINDS.has(kind) && worn(x, z, solid ? 0.55 : 0.2)) continue;
      // Meadow kinds gather in drifts: dense patches, thin between them (fewer triangles, a fuller look).
      if (drift && g() > 0.18 + 0.82 * clump(x, z)) continue;
      if (nearWall(x, z, kind === "ruinFloor" ? 2.6 : 0.7)) continue;
      if ((solid || kind === "ruinFloor") && nearCamp(x, z)) continue;
      // Paving rings are wide: every part of one must lie on land.
      if (kind === "ruinFloor" && [[2.6, 0], [-2.6, 0], [0, 2.6], [0, -2.6]].some(([dx, dz]) => !LAND.includes(terrain.at(x + dx, z + dz)))) continue;
      add(kind, x, z, s, g);
    }
  }
  // The ruins centrepiece (maps.json `centrepiece: "ruins"`, W9): a Builder ring on the plateau at the map's centre.
  props.push(...centrepieceProps(terrain));
  // V1 terrain: groves along the map's edge, rocks at plateau feet and reeds on the banks (all seeded, view only).
  props.push(...edgeGroves(terrain, budget), ...cliffFootRocks(terrain, budget), ...bankReeds(terrain, budget), ...shallowCoral(terrain, budget));
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

// The Ancient ruins centrepiece (W9): the terrace at the map's centre (a plateau with ramps, the crossroads capture
// ring on its top: high ground and a ring, both existing rules) dressed as a Builder shrine. Arches, pillars, walls
// and stone heads stand on its rim, inside the cliff band where no unit stands; carved heads watch from its foot
// between the ramps; a ring of paving lies flat under the capture ring. Seeded from the map id, view only, and
// part of the one scatter mesh (no extra draw).
export function centrepieceProps(terrain) {
  if (terrain.centrepiece !== "ruins" || !terrain.plateaus?.length) return [];
  const k = terrain.plateauAt(0, 0), p = terrain.plateaus[k];
  if (k < 0) return [];
  const r = rng(hashId(terrain.id) ^ 0x7e3b1e), out = [], half = terrain.half, land = ["grass", "dirt", "sand", "stone"];
  const place = (kind, x, z, s, a) => out.push({ kind, x, z, s: Math.min(MAX_SCALE, s), a, tone: r(), seed: (r() * 4294967296) >>> 0 });
  const clear = (x, z, pad) => !terrain.onRamp(x, z, pad) && Math.abs(x) < half - 2 && Math.abs(z) < half - 2;
  // Distance from the centre to the rim along angle a.
  const reach = (a) => (p.shape === "disc" ? p.r : rimReach(p, Math.cos(a), Math.sin(a)));
  const RIM = ["ruinArch", "ruinPillar", "ruinWall", "ruinArch", "stoneHead", "ruinWall", "ruinPillar", "ruinArch"];
  const n = Math.max(12, Math.round((2 * Math.PI * reach(0)) / 2.6));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.2832 + 0.13, d = reach(a) - 0.72, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!clear(x, z, 0.6) || !terrain.cliff(x, z)) continue;
    // Arches and walls run along the rim (local x along the tangent); heads and pillars face outward (local +z).
    const kind = RIM[i % RIM.length], along = kind === "ruinArch" || kind === "ruinWall";
    place(kind, x, z, 0.92 + r() * 0.16, along ? a + Math.PI / 2 : a - Math.PI / 2);
  }
  // Carved heads and fallen drums at the foot, between the ramps, gazing out over the approaches.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.2832 + 0.39, d = reach(a) + 1.9, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!clear(x, z, 1.2) || terrain.cliff(x, z, 0.4) || !land.includes(terrain.at(x, z)) || terrain.inWater(x, z, 0.9)) continue;
    place(i % 2 ? "stoneHead" : "brokenColumn", x, z, 1 + r() * 0.15, a - Math.PI / 2);
  }
  if (land.includes(terrain.at(0, 0))) place("ruinFloor", 0, 0, 1.2, r() * 6.2832);
  return out;
}

// Smooth value noise (seedless) for drifts and groves.
const lattice = (x, z) => {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = lattice(ix, iz), b = lattice(ix + 1, iz), c = lattice(ix, iz + 1), d = lattice(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// V1 terrain: groves in the strip just inside the map's edge (0.6 to 2 m in). Tall kinds stand only on the north and
// west edges, the far side from the camera, so nothing tall ever stands between the camera and a unit; the south and
// east edges take low kinds. Clear of camps, water, roads, walls, cliffs and ramps like every other prop.
export function edgeGroves(terrain, budget = 1) {
  const spec = EDGE_GROVES[lookOf(terrain.id)], half = terrain.half;
  if (!spec) return [];
  const [tall, low, per100] = spec, r = rng(hashId(terrain.id) ^ 0x6e0de), out = [], camps = campSites(terrain);
  const walls = terrain.defence ? [] : terrain.rocks || ROCKS;
  const groves = Math.round((8 * half / 100) * per100 * Math.min(1, budget + 0.15));
  for (let g = 0; g < groves; g++) {
    const side = Math.floor(r() * 4), along = (r() * 2 - 1) * (half - 3), far = side === 0 || side === 3; // 0: north (-z), 3: west (-x)
    const members = 3 + Math.floor(r() * 4);
    for (let k = 0; k < members; k++) {
      const inset = 0.6 + r() * 1.4, slide = along + (r() - 0.5) * 6;
      const x = side === 1 ? half - inset : side === 3 ? -half + inset : slide, z = side === 0 ? -half + inset : side === 2 ? half - inset : slide;
      const kinds = far && r() < 0.65 ? tall : low, kind = kinds[Math.floor(r() * kinds.length)], s = 0.8 + r() * 0.35, a = r() * 6.2832, tone = r(), seed = (r() * 4294967296) >>> 0;
      // Leaning palms and wide crowns need more room than their trunk: nothing may cross the edge.
      const reach = (kind === "palm" ? 1.75 : kind === "conifer" || kind === "pine" || kind === "sapling" ? 0.95 : 0.75) * Math.min(MAX_SCALE, s);
      if (Math.abs(x) + reach > half || Math.abs(z) + reach > half) continue;
      if (!LAND.includes(terrain.at(x, z)) || terrain.cliff?.(x, z, 0.8) || terrain.onRamp?.(x, z, 0.8)) continue;
      if (walls.some(([wx, wz, wr]) => Math.hypot(x - wx, z - wz) < wr + 0.7)) continue;
      if (camps.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < CAMP_RADIUS)) continue;
      out.push({ kind, x, z, s: Math.min(MAX_SCALE, s), a, tone, seed });
    }
  }
  return out;
}

// V1 terrain: small rocks at every plateau's foot, inside the outer half of the cliff band (no unit can stand there:
// a unit's centre keeps 1 m plus its radius from the edge), never beside a ramp.
export function cliffFootRocks(terrain, budget = 1) {
  if (!terrain.plateaus?.length) return [];
  const r = rng(hashId(terrain.id) ^ 0xf007), out = [], half = terrain.half, land = landOf(terrain);
  const kind = land?.ice ? "snowRock" : "rock";
  for (const p of terrain.plateaus) {
    const perimeter = p.shape === "disc" ? 2 * Math.PI * p.r : 2 * (p.w + p.d), n = Math.round((perimeter / 1.7) * Math.min(1, budget + 0.2));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 + r() * 0.3, dx = Math.cos(a), dz = Math.sin(a), reach = p.shape === "disc" ? p.r : rimReach(p, dx, dz);
      const d = reach + 0.95 + r() * 0.25, x = p.x + dx * d, z = p.z + dz * d, s = 0.42 + r() * 0.22;
      if (r() < 0.35 || Math.abs(x) > half - 1.5 || Math.abs(z) > half - 1.5) continue;
      if (terrain.onRamp(x, z, 1.4) || terrain.inWater(x, z, 0.6) || terrain.at(x, z) === "road") continue;
      if ((terrain.defence ? [] : terrain.rocks || ROCKS).some(([wx, wz, wr]) => Math.hypot(x - wx, z - wz) < wr + 0.9)) continue;
      out.push({ kind: r() < 0.3 ? "pebble" : kind, x, z, s, a: r() * 6.2832, tone: r(), seed: (r() * 4294967296) >>> 0 });
    }
  }
  return out;
}

// V1 terrain: reed clumps along river banks (the mud band) and lake shores, in clusters, clear of every crossing.
// Not round lava or ice (src/lands.js `reeds`).
export function bankReeds(terrain, budget = 1) {
  const land = landOf(terrain);
  if (land && !land.reeds) return [];
  const r = rng(hashId(terrain.id) ^ 0x2eed), out = [], half = terrain.half;
  const walls = terrain.defence ? [] : terrain.rocks || ROCKS;
  const ok = (x, z) => Math.abs(x) < half - 1.5 && Math.abs(z) < half - 1.5 && ["mud", "sand", "grass", "dirt"].includes(terrain.at(x, z)) && !terrain.inWater(x, z, 0.25) && !terrain.onRamp?.(x, z, 1) &&
    !walls.some(([wx, wz, wr]) => Math.hypot(x - wx, z - wz) < wr + 0.9);
  const place = (x, z) => out.push({ kind: "reed", x, z, s: 0.8 + r() * 0.35, a: r() * 6.2832, tone: r(), seed: (r() * 4294967296) >>> 0 });
  for (const river of terrain.rivers || [])
    for (let x = -half + 2; x < half - 2; x += 1.1) {
      if (river.crossings.some((c) => Math.abs(x - c.x) < c.half + 4)) continue;
      if (valueNoise(x * 0.18 + river.z, river.z * 0.1) < 0.45 || r() > 0.75 * Math.min(1, budget + 0.2)) continue;
      for (const side of [-1, 1]) {
        const z = river.z + side * (3.25 + r() * 0.8), xx = x + (r() - 0.5) * 0.8;
        if (ok(xx, z)) place(xx, z);
      }
    }
  for (const lake of terrain.lakes || []) {
    const n = Math.round((2 * Math.PI * lake.r) / 1.2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832, d = lake.r + 0.35 + r() * 0.8, x = lake.x + Math.cos(a) * d, z = lake.z + Math.sin(a) * d;
      if (valueNoise(Math.cos(a) * 3 + lake.x, Math.sin(a) * 3 + lake.z) < 0.48 || r() > 0.8 * Math.min(1, budget + 0.2)) continue;
      if (lake.fords.some((f) => Math.cos(a) * f.dx + Math.sin(a) * f.dz > 0 && Math.abs(Math.cos(a) * f.dz - Math.sin(a) * f.dx) * d < f.half + 2)) continue;
      if (ok(x, z)) place(x, z);
    }
  }
  return out;
}

// V1 terrain: coral heads gather in the isles' shallows, a ring a metre or three inside every lagoon shore (lands
// whose dressing has coral), in clusters, off the fords and bridges.
export function shallowCoral(terrain, budget = 1) {
  const recipe = DRESSING[lookOf(terrain.id)];
  if (!recipe?.list.some(([kind]) => kind === "coral")) return [];
  const r = rng(hashId(terrain.id) ^ 0xc0a1), out = [], half = terrain.half;
  for (const lake of terrain.lakes || []) {
    const n = Math.round(((2 * Math.PI * lake.r) / 2.2) * Math.min(1, budget + 0.2));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 + r() * 0.2, d = lake.r - 1.1 - r() * 2.2, x = lake.x + Math.cos(a) * d, z = lake.z + Math.sin(a) * d;
      if (valueNoise(Math.cos(a) * 4 + lake.x * 0.1, Math.sin(a) * 4 + lake.z * 0.1) < 0.5) continue;
      if (Math.abs(x) > half - 1.2 || Math.abs(z) > half - 1.2 || terrain.at(x, z) !== "water") continue;
      out.push({ kind: "coral", x, z, s: 0.8 + r() * 0.4, a: r() * 6.2832, tone: r(), seed: (r() * 4294967296) >>> 0 });
    }
  }
  return out;
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
  // A box from local (x0, y0, z0) to (x1, y1, z1) (W9 ruins): flat-shaded sides, a lit top, no bottom.
  box(x0, y0, z0, x1, y1, z1, side, top, sideTop = side) {
    this.centre((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const a = this.at(x0, y0, z0), b = this.at(x1, y0, z0), c = this.at(x1, y0, z1), d = this.at(x0, y0, z1);
    const e = this.at(x0, y1, z0), f = this.at(x1, y1, z0), g = this.at(x1, y1, z1), h = this.at(x0, y1, z1);
    const s0 = mul(side, 0.82), s1 = mul(sideTop, 0.82);
    this.quad(a, b, f, e, side, side, sideTop, sideTop); this.quad(c, d, h, g, s0, s0, s1, s1);
    this.quad(b, c, g, f, s0, s0, s1, s1); this.quad(d, a, e, h, side, side, sideTop, sideTop);
    this.quad(e, f, g, h, top, top, top, top);
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
  // ---- W9 lands -------------------------------------------------------------------------------------------
  // A fir in three tiers, each tier snow-laden toward its peak, on a short trunk.
  pine(m, p, C, r) {
    const h = 1.55 + r() * 0.42, snow = mix(C.foam, C.dust, 0.25), dark = mul(C.leaf, 0.62), light = mix(C.leaf, C.leafAlt, 0.35 + p.tone * 0.3);
    m.prism(3, 0.08, 0.06, 0, h * 0.24, mul(C.wood, 0.8), C.wood, { cap: false, sideTop: C.wood });
    const tiers = [[0.54, 0.16, 0.56], [0.42, 0.38, 0.8], [0.3, 0.6, 1]];
    // Each tier shades from dark needles at its rim to snow toward its peak: from the game camera every tier shows a
    // white shoulder above a green skirt (separate cap cones were hidden under the tier above).
    tiers.forEach(([rad, y0, y1], i) => {
      const spin = 0.3 + i * 0.7, top = mix(light, snow, i === 2 ? 0.92 : 0.8);
      m.cone(6, rad, h * y0, h * y1, dark, top, { spin, sway: 0.06 * (i + 1) });
    });
  },
  // Frosted grass: pale blades, blue-white at the tips.
  frost(m, p, C, r) {
    const tip = mix(C.foam, C.dust, 0.2 + p.tone * 0.3), base = mix(C.dirt, C.leaf, 0.3);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + r() * 0.8, h = 0.24 + r() * 0.18, lean = 0.16 + r() * 0.12, c = Math.cos(a), s = Math.sin(a), w = 0.1;
      m.tri(m.at(c * 0.04 - s * w, 0, s * 0.04 + c * w), m.at(c * 0.04 + s * w, 0, s * 0.04 - c * w), m.at(c * (0.04 + lean), h, s * (0.04 + lean)), base, base, tip, true, 0, 0, h * m.s * 0.5);
    }
  },
  // A rock under a cap of snow: its sides shade from rock to white toward the top.
  snowRock(m, p, C, r) {
    const rad = 0.36 + r() * 0.2, h = 0.32 + r() * 0.26, side = mul(C.rock, 0.78 + p.tone * 0.2), snow = mix(C.foam, C.dust, 0.2);
    m.prism(5, rad, rad * 0.55, 0, h, mul(side, 0.8), snow, { spin: r() * 3, tilt: 0.05, sideTop: mix(side, snow, 0.55) });
    if (r() < 0.5) m.prism(4, rad * 0.45, rad * 0.22, 0, h * 0.5, mul(side, 0.85), snow, { ox: rad * 0.9, oz: (r() - 0.5) * 0.4, spin: r() * 3, sideTop: side });
  },
  // A small lava vent: a basalt cone whose open mouth glows.
  vent(m, p, C, r) {
    const rad = 0.5 + r() * 0.18, h = 0.42 + r() * 0.24, basalt = mul(C.stone, 0.85 + p.tone * 0.2), glow = mix(C.bloomA, C.bloomB, 0.4 + p.tone * 0.4);
    m.prism(7, rad, rad * 0.42, 0, h, mul(basalt, 0.7), glow, { spin: r() * 3, sideTop: mix(basalt, C.bloomC, 0.35) });
    m.cone(5, rad * 0.3, h, h + 0.12, glow, mix(C.bloomB, [1, 1, 1], 0.5), { spin: r() * 3 });
  },
  // A palm: a leaning trunk in four rings and a crown of drooping fronds, a coconut or two.
  palm(m, p, C, r) {
    const h = 1.45 + r() * 0.35, lean = 0.28 + r() * 0.2, bark = mix(C.wood, C.dust, 0.3), ring = mul(bark, 0.75);
    let x = 0, y = 0;
    for (let i = 0; i < 4; i++) {
      const y1 = (h * (i + 1)) / 4, x1 = lean * ((i + 1) / 4) ** 1.6;
      m.prism(5, 0.1 - i * 0.012, 0.09 - i * 0.012, y, y1, i % 2 ? ring : bark, bark, { ox: x, tx: x1 - x, cap: i === 3, sideTop: bark });
      x = x1; y = y1;
    }
    const top = [x, h], frond = mix(C.leaf, C.leafAlt, 0.35 + p.tone * 0.3), dark = mul(C.leaf, 0.7);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.2832 + r() * 0.4, c = Math.cos(a), s = Math.sin(a), reach = 0.62 + r() * 0.2, droop = 0.22 + r() * 0.12, w = 0.11;
      const root = m.at(top[0], top[1], 0), mid = m.at(top[0] + c * reach * 0.55, top[1] + 0.06, s * reach * 0.55), tip = m.at(top[0] + c * reach, top[1] - droop, s * reach);
      const side = (k) => m.at(top[0] + c * reach * 0.5 - s * w * k, top[1] + 0.04, s * reach * 0.5 + c * w * k);
      m.tri(root, side(1), mid, dark, frond, frond, true, 0.15, 0.2, 0.2);
      m.tri(root, mid, side(-1), dark, frond, frond, true, 0.15, 0.2, 0.2);
      m.tri(side(1), tip, mid, frond, frond, frond, true, 0.2, 0.3, 0.2);
      m.tri(mid, tip, side(-1), frond, frond, frond, true, 0.2, 0.3, 0.2);
    }
    if (p.seed % 2) m.cone(4, 0.07, top[1] - 0.16, top[1] - 0.04, mul(C.wood, 0.8), C.wood, { ox: top[0] + 0.06, spin: 0.4 });
  },
  // Lagoon coral just under the surface, like the lily pads: flat rosettes in warm colours.
  coral(m, p, C, r) {
    const tint = [C.bloomA, C.bloomC, C.bloomB][p.seed % 3], y = -0.06 / m.s, rad = 0.16 + r() * 0.1;
    for (let k = 0; k < 2 + (p.seed % 2); k++) {
      const ox = (r() - 0.5) * 0.5, oz = (r() - 0.5) * 0.5, centre = m.at(ox, y, oz), shade = mix(tint, C.water, 0.55 + r() * 0.2);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.2832, b = ((i + 1) / 5) * 6.2832, d = rad * (0.75 + (i % 2) * 0.35);
        m.tri(centre, m.at(ox + Math.cos(a) * d, y, oz + Math.sin(a) * d), m.at(ox + Math.cos(b) * d, y, oz + Math.sin(b) * d), mix(tint, C.water, 0.3), shade, shade, true);
      }
    }
  },
  // ---- Ancient ruins (W9, any land) --------------------------------------------------------------------------
  // A Builder arch: two square pillars and a lintel with the Lattice inlay; some arches have lost a pillar's top
  // and half the lintel. Ivy (the land's leaf colour) trails over one pillar.
  ruinArch(m, p, C, r) {
    const stone = mul(C.ruin, 0.78 + p.tone * 0.16), lit = mix(C.ruin, [1, 1, 1], 0.2), dark = mul(stone, 0.62), g = C.glow, broken = p.seed % 3 === 0;
    const w = 0.62, t = 0.17, h = 1.24;
    m.box(-w - t, 0, -t, -w + t, h, t, dark, lit, stone);
    m.box(w - t, 0, -t, w + t, broken ? h * 0.55 : h, t, dark, lit, stone);
    m.box(-w - t - 0.05, h, -t - 0.03, broken ? 0.05 : w + t + 0.05, h + 0.3, t + 0.03, stone, lit, lit);
    m.centre(0, h + 0.15, 0);
    const x1 = broken ? -0.05 : w;
    m.quad(m.at(-w, h + 0.1, t + 0.035), m.at(x1, h + 0.1, t + 0.035), m.at(x1, h + 0.17, t + 0.035), m.at(-w, h + 0.17, t + 0.035), g, g, g, g, true);
    if (broken) m.box(0.5, 0, 0.3, 0.9, 0.22, 0.6, dark, stone, stone);
    const ivy = mix(C.leaf, C.leafAlt, 0.3 + p.tone * 0.4);
    for (let i = 0; i < 3; i++) {
      const y = 0.25 + i * 0.32;
      m.tri(m.at(-w - t - 0.02, y, t + 0.02), m.at(-w + t + 0.02, y + 0.1, t + 0.02), m.at(-w + (r() - 0.5) * 0.2, y + 0.34, t + 0.04), mul(C.leaf, 0.8), ivy, ivy, true, 0, 0, 0.05);
    }
  },
  // A carved stone head, half sunk in the ground, moss on its crown: a block with a brow ledge, dark eye slots,
  // a wedge nose and the Lattice line on its forehead.
  stoneHead(m, p, C, r) {
    const stone = mul(C.ruin, 0.72 + p.tone * 0.16), lit = mix(C.ruin, [1, 1, 1], 0.15), dark = mul(stone, 0.58), shadow = mul(stone, 0.35);
    const h = 0.88 + r() * 0.12;
    m.box(-0.34, 0, -0.3, 0.34, h, 0.3, dark, lit, stone);
    m.box(-0.38, h * 0.62, 0.22, 0.38, h * 0.7, 0.36, stone, lit, lit);
    m.centre(0, h * 0.5, 0.4);
    for (const side of [-1, 1]) m.quad(m.at(side * 0.08, h * 0.5, 0.305), m.at(side * 0.24, h * 0.5, 0.305), m.at(side * 0.24, h * 0.58, 0.305), m.at(side * 0.08, h * 0.58, 0.305), shadow, shadow, shadow, shadow, true);
    m.centre(0, h * 0.4, 0.2);
    m.tri(m.at(-0.07, h * 0.3, 0.3), m.at(0.07, h * 0.3, 0.3), m.at(0, h * 0.58, 0.4), stone, stone, lit);
    m.tri(m.at(-0.07, h * 0.3, 0.3), m.at(0, h * 0.58, 0.4), m.at(0, h * 0.3, 0.42), dark, lit, stone);
    m.tri(m.at(0.07, h * 0.3, 0.3), m.at(0, h * 0.3, 0.42), m.at(0, h * 0.58, 0.4), dark, stone, lit);
    m.quad(m.at(-0.2, h * 0.2, 0.305), m.at(0.2, h * 0.2, 0.305), m.at(0.2, h * 0.24, 0.305), m.at(-0.2, h * 0.24, 0.305), shadow, shadow, shadow, shadow, true);
    const g = C.glow;
    m.quad(m.at(-0.16, h * 0.8, 0.305), m.at(0.16, h * 0.8, 0.305), m.at(0.16, h * 0.84, 0.305), m.at(-0.16, h * 0.84, 0.305), g, g, g, g, true);
    const moss = mix(C.leaf, C.leafAlt, 0.4 + p.tone * 0.4);
    m.cone(5, 0.3, h, h + 0.12, mul(C.leaf, 0.8), moss, { spin: r() * 3 });
  },
  // A low overgrown wall: a broken run of blocks with a gap, ivy and grass along its top.
  ruinWall(m, p, C, r) {
    const stone = mul(C.ruin, 0.74 + p.tone * 0.16), lit = mix(C.ruin, [1, 1, 1], 0.18), dark = mul(stone, 0.6);
    const h0 = 0.46 + r() * 0.3;
    m.box(-0.95, 0, -0.16, -0.12, h0, 0.16, dark, lit, stone);
    m.box(0.12, 0, -0.16, 0.95, h0 * (0.55 + r() * 0.35), 0.16, dark, lit, stone);
    m.box(-0.5, h0, -0.13, -0.18, h0 + 0.14, 0.13, stone, lit, lit);
    const ivy = mix(C.leaf, C.leafAlt, 0.35 + p.tone * 0.4), base = mul(C.leaf, 0.75);
    for (let i = 0; i < 5; i++) {
      const x = -0.85 + i * 0.4, top = i < 2 ? h0 : h0 * 0.55;
      m.tri(m.at(x - 0.1, top - 0.24, 0.17), m.at(x + 0.12, top - 0.2, 0.17), m.at(x + (r() - 0.5) * 0.1, top + 0.1, 0.12), base, ivy, ivy, true, 0, 0, 0.06);
    }
  },
  // Fallen column drums: a fluted drum lying on its side and a broken stub upright beside it.
  brokenColumn(m, p, C, r) {
    const stone = mul(C.ruin, 0.76 + p.tone * 0.16), lit = mix(C.ruin, [1, 1, 1], 0.2), g = C.glow;
    const length = 0.75 + r() * 0.35, rad = 0.22, n = 6, ends = [[], []];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 + 0.26;
      ends[0].push(m.at(-length / 2, rad + Math.sin(a) * rad, Math.cos(a) * rad));
      ends[1].push(m.at(length / 2, rad + Math.sin(a) * rad, Math.cos(a) * rad));
    }
    m.centre(0, rad, 0);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, shade = i % 2 ? stone : mul(stone, 0.86);
      m.quad(ends[0][i], ends[0][j], ends[1][j], ends[1][i], shade, shade, shade, shade);
    }
    for (const end of ends) for (let i = 1; i < n - 1; i++) m.tri(end[0], end[i], end[i + 1], lit, lit, lit);
    m.prism(6, 0.24, 0.22, 0, 0.32 + r() * 0.16, mul(stone, 0.66), lit, { ox: 0.15, oz: 0.55, tilt: 0.06, sideTop: stone });
    m.prism(6, 0.25, 0.25, 0.14, 0.18, g, g, { ox: 0.15, oz: 0.55, cap: false });
  },
  // V1 terrain: a reed clump: thin tall blades, a few brown seed heads.
  reed(m, p, C, r) {
    const base = mul(mix(C.leaf, C.wood, 0.25), 0.7), tip = mix(C.leaf, C.leafAlt, 0.4 + p.tone * 0.4), head = mul(C.wood, 0.9);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + r() * 0.6, c = Math.cos(a), s = Math.sin(a), h = 0.55 + r() * 0.3, lean = 0.06 + r() * 0.12, w = 0.035;
      const ox = c * 0.1, oz = s * 0.1;
      m.tri(m.at(ox - s * w, 0, oz + c * w), m.at(ox + s * w, 0, oz - c * w), m.at(ox + c * lean, h, oz + s * lean), base, base, tip, true, 0, 0, h * m.s);
      if (i % 3 === 0) m.prism(3, 0.03, 0.025, h * 0.92, h * 0.92 + 0.14, head, head, { ox: ox + c * lean, oz: oz + s * lean, cap: false });
    }
  },
  // V1 terrain: a basalt spire: a tapered hexagonal column, a lighter broken top, a hairline glow on the volcano.
  spire(m, p, C, r) {
    const h = 1.2 + r() * 0.52, rock = mul(C.stone, 0.85 + p.tone * 0.2), lit = mix(C.stone, C.dust, 0.35);
    m.prism(6, 0.36, 0.14, 0, h, mul(rock, 0.62), lit, { spin: r() * 3, tilt: 0.08, sideTop: rock });
    if (p.seed % 2) m.prism(5, 0.2, 0.08, 0, h * 0.55, mul(rock, 0.7), lit, { ox: 0.32, oz: (r() - 0.5) * 0.3, spin: r() * 3, sideTop: rock });
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
