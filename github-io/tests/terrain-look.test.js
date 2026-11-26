// V1 terrain (2026-11-26, view only): ground detail layers, worn paths, the surround below the map edge, the denser
// dressing and the stepping-stone fords. The rules never see any of it; these tests pin the contracts the art and the
// renderer rely on (file names and sizes, the land/layer table, the splat, the path plan, budgets, placement rules).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import MAPS_JSON from "../src/maps.json" with { type: "json" };
import CAMPAIGN_MAPS from "../src/campaign-maps.json" with { type: "json" };
import STYLE from "../src/visual-style.json" with { type: "json" };
import { Terrain } from "../src/terrain.js";
import { GROUND_LAYERS, LAYER_NAMES, LAYER_LOOK, SLOTS, SURFACE_CODE, buildSplat, usedSlots, layersFor, layerUrl, TILE_METRES, tileMetres, GROUND_DETAIL_STRENGTH, DESKTOP_GRASS_CAP } from "../src/ground-detail.js";
import { planPaths, wearGrid, crystalFields } from "../src/worn-paths.js";
import { SURROUND, LOWLAND, createMapEdge, CLIFF } from "../src/map-edge.js";
import { planScatter, edgeGroves, cliffFootRocks, bankReeds, EDGE_GROVES, MEADOW, HEIGHT, MAX_SCALE } from "../src/scatter.js";
import { lookOf } from "../src/visual-style.js";
import { landOf } from "../src/lands.js";

const ids = [...Object.keys(MAPS_JSON), ...Object.keys(CAMPAIGN_MAPS)];
const LOOKS = Object.keys(STYLE.themes);
const dir = new URL("../public/textures/ground/", import.meta.url);

// Width and height of a WebP file (lossy VP8, lossless VP8L or extended VP8X).
function webpSize(bytes) {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
  if (chunk === "VP8L") { const b = bytes.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (chunk === "VP8 ") return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  throw new Error(`unknown WebP chunk ${chunk}`);
}

// A paint grid as ground-paint.js decides it (no warp: close enough for the splat's contracts).
function gridOf(t, cells = 256) {
  const grid = new Uint8Array(cells * cells), bare = t.plateaus?.length ? Object.assign(Object.create(t), { plateaus: [] }) : t;
  for (let y = 0; y < cells; y++)
    for (let x = 0; x < cells; x++) {
      const wx = ((x + 0.5) / cells) * t.size - t.half, wz = ((y + 0.5) / cells) * t.size - t.half;
      grid[y * cells + x] = SURFACE_CODE[bare !== t && t.onRamp(wx, wz) ? bare.at(wx, wz) : t.at(wx, wz)] ?? 0;
    }
  return grid;
}

test("ground layers: the fourteen agreed files, 512 px (High) and 256 px (Eco, phones) WebP, every one in the land table", () => {
  assert.deepEqual(LAYER_NAMES, ["grass", "grass-dry", "dirt", "road", "stone", "mud", "sand", "hardpan", "snow", "ice", "basalt", "ash", "beach", "cliff"]);
  for (const [sub, side, each, all] of [["", 512, 120_000, 700_000], ["256/", 256, 40_000, 260_000]]) {
    const files = readdirSync(new URL(sub, dir)).filter((f) => f.endsWith(".webp")).sort();
    assert.deepEqual(files, LAYER_NAMES.map((n) => `${n}.webp`).sort(), `exactly the agreed names in public/textures/ground/${sub}`);
    let total = 0;
    for (const name of LAYER_NAMES) {
      const bytes = readFileSync(new URL(`${sub}${name}.webp`, dir));
      assert.deepEqual(webpSize(bytes), [side, side], `${sub}${name}.webp is ${side} x ${side}`);
      assert.ok(bytes.length < each, `${sub}${name}.webp ${bytes.length} bytes`);
      total += bytes.length;
    }
    assert.ok(total < all, `the ${side} px set is ${total} bytes`);
  }
  // The review's blend constants: k per layer never above 1.25; only grass, dry grass and basalt may turn.
  for (const name of LAYER_NAMES) {
    const look = LAYER_LOOK[name];
    assert.ok(look && look.k > 0 && look.k * GROUND_DETAIL_STRENGTH <= 1.25, `${name}: k ${look?.k}`);
    assert.equal(!!look.turn, ["grass", "grass-dry", "basalt"].includes(name), `${name}: turned second sample`);
  }
  assert.ok(LAYER_LOOK.ice.opacity <= 0.5 && LAYER_LOOK.road.k <= 0.5 && DESKTOP_GRASS_CAP <= 0.6);
  for (const look of LOOKS) {
    const row = GROUND_LAYERS[look];
    assert.ok(row, `${look}: a row in GROUND_LAYERS`);
    assert.deepEqual(Object.keys(row).sort(), [...SLOTS].sort(), `${look}: every slot`);
    for (const layer of Object.values(row)) assert.ok(LAYER_NAMES.includes(layer), `${look}: ${layer} is an agreed name`);
  }
  for (const id of ids) assert.equal(layersFor(id), GROUND_LAYERS[lookOf(id)], `${id} borrows its look's row`);
  assert.deepEqual([tileMetres(false, true), tileMetres(true, false), tileMetres(true, true)], [TILE_METRES.high, 6, 8]);
  assert.equal(TILE_METRES.high, 4);
  assert.match(layerUrl("grass"), /textures\/ground\/grass\.webp/);
  assert.match(layerUrl("grass", true), /textures\/ground\/256\/grass\.webp/);
  // The review's table: Frostmere's packed snow is snow and its rock faces stone; Ember Crown's black rock basalt.
  assert.equal(GROUND_LAYERS.snowfield.dirt, "snow");
  assert.equal(GROUND_LAYERS.snowfield.cliff, "stone");
  assert.equal(GROUND_LAYERS.volcano.stone, "basalt");
  assert.equal(GROUND_LAYERS.highlands.stone, "stone");
});

test("ground splat: weights sum to one, ramps are road, banks are wet, paths are dirt; a map uses at most seven layers", () => {
  for (const id of ["riverlands", "dunes", "twinrivers", "snowfield", "volcano", "archipelago", "highlands"]) {
    const t = new Terrain(id), cells = 256, grid = gridOf(t, cells), wear = wearGrid(t, 128);
    const splat = buildSplat(t, grid, cells, 128, wear), again = buildSplat(t, grid, cells, 128, wear);
    assert.deepEqual(splat.a, again.a, `${id}: deterministic`);
    for (let i = 0; i < splat.a.length; i += 4) {
      const sum = splat.a[i] + splat.a[i + 1] + splat.a[i + 2] + splat.a[i + 3] + splat.b[i] + splat.b[i + 1];
      assert.ok(Math.abs(sum - 255) <= 4, `${id}: weights at ${i / 4} sum to ${sum}`);
    }
    const at = (x, z) => { const n = splat.size, i = (Math.min(n - 1, Math.floor((z + t.half) / t.size * n)) * n + Math.min(n - 1, Math.floor((x + t.half) / t.size * n))) * 4; return { a: [...splat.a.slice(i, i + 4)], b: [...splat.b.slice(i, i + 4)] }; };
    for (const p of t.plateaus) for (const r of p.ramps) assert.ok(at(r.x, r.z).b[0] > 150, `${id}: ramp at ${r.x},${r.z} is road`);
    for (const river of t.rivers) {
      const gap = river.gaps[0], x = (gap[0] + gap[1]) / 2;
      assert.ok(at(x, river.z + 3.6).b[2] > 60, `${id}: the bank beside open water is wet`);
    }
    const slots = usedSlots(splat, t.plateaus.length);
    assert.ok(slots.length <= SLOTS.length && slots.includes("grass") === slots.includes("grass"), id);
    assert.equal(slots.includes("cliff"), t.plateaus.length > 0, `${id}: the cliff layer only where there are plateaus`);
  }
});

test("worn paths: seeded from map data, on ground a vehicle can use, kept clear by the dressing", () => {
  const random = Math.random;
  Math.random = () => { throw new Error("paths must not use Math.random"); };
  try {
    for (const id of ids) {
      const t = new Terrain(id), paths = planPaths(t);
      assert.deepEqual(paths, planPaths(new Terrain(id)), `${id}: identical plans`);
      assert.ok(paths.length >= 8, `${id}: ${paths.length} paths`);
      assert.ok(crystalFields(t).fields.length > 0, `${id}: crystal fields`);
      for (const p of paths) {
        assert.ok(p.points.length >= 3 && p.width >= 2 && p.width <= 3, `${id}: ${p.kind}`);
        for (const [x, z] of p.points) assert.ok(t.canStand(x, z, 0.3) || ["ford", "bridge", "road"].includes(t.at(x, z)), `${id}: ${p.kind} point ${x.toFixed(1)},${z.toFixed(1)} on ${t.at(x, z)}`);
        assert.ok(p.wear.every((w) => w >= 0 && w <= 1), `${id}: wear in 0..1`);
      }
      // Tufts, flowers and pebbles keep off the trodden ground.
      const wn = Math.round(t.size), wear = wearGrid(t, wn);
      for (const q of planScatter(t)) {
        // (Cliff-foot pebbles sit inside the cliff band beside a ramp, where nobody walks: not on the track.)
        if ((!MEADOW.has(q.kind) && q.kind !== "pebble") || !t.canStand(q.x, q.z, 0.55)) continue;
        const w = wear[Math.min(wn - 1, Math.floor(q.z + t.half)) * wn + Math.min(wn - 1, Math.floor(q.x + t.half))];
        assert.ok(w <= 0.2, `${id}: ${q.kind} on a worn path (${w.toFixed(2)})`);
      }
    }
  } finally { Math.random = random; }
  // Frontier Defence maps have no camps or deposits: no paths.
  assert.deepEqual(planPaths(new Terrain("gorge")), []);
});

test("the surround below the edge: a row for every land, one mesh, under the playable ground, the isles in a sea", () => {
  for (const look of LOOKS) assert.ok(SURROUND[look], `${look}: a surround`);
  for (const id of ids) {
    const t = new Terrain(id), edge = createMapEdge(t), p = edge.geometry.attributes.position, sky = edge.geometry.attributes.skyData;
    assert.equal(edge.name, "backdrop");
    assert.ok(p.count / 3 < 26000, `${id}: ${p.count / 3} triangles`);
    let far = 0;
    for (let i = 0; i < p.count; i++) {
      assert.ok(p.getY(i) <= 1e-6 && p.getY(i) >= -CLIFF - 1e-6, `${id}: y ${p.getY(i)}`);
      far = Math.max(far, Math.max(Math.abs(p.getX(i)), Math.abs(p.getZ(i))) - t.half);
    }
    assert.ok(far >= LOWLAND, `${id}: the lowland reaches ${LOWLAND} m out`);
    assert.equal(sky.count, p.count);
  }
  // The isles stand in a sea: shimmering water (kind 1) at sea level all round the lowland.
  const isles = createMapEdge(new Terrain("archipelago")), pos = isles.geometry.attributes.position, sky = isles.geometry.attributes.skyData;
  let water = 0;
  for (let i = 0; i < pos.count - 3; i++) if (sky.getX(i) === 1 && Math.abs(pos.getY(i) - SURROUND.archipelago.sea) < 1e-6) water++;
  assert.ok(water > 1000, `isles: ${water} sea vertices`);
  // Ember Crown's lava rivers glow (kind 2).
  const lava = createMapEdge(new Terrain("volcano")).geometry.attributes.skyData;
  let glowing = 0;
  for (let i = 0; i < lava.count; i++) if (lava.getX(i) === 2) glowing++;
  assert.ok(glowing > 500, `volcano: ${glowing} lava vertices`);
});

test("denser dressing: edge groves tall only on the far edges, rocks at plateau feet where no unit stands, reeds on banks", () => {
  for (const id of ids) {
    const t = new Terrain(id), spec = EDGE_GROVES[lookOf(id)], half = t.half;
    for (const q of edgeGroves(t)) {
      const inset = Math.min(half - Math.abs(q.x), half - Math.abs(q.z));
      assert.ok(inset >= 0.5 && inset <= 2.1, `${id}: ${q.kind} ${inset.toFixed(2)} m from the edge`);
      if (spec[0].includes(q.kind) && !spec[1].includes(q.kind)) assert.ok(q.z < -half + 2.2 || q.x < -half + 2.2, `${id}: tall ${q.kind} at ${q.x.toFixed(1)},${q.z.toFixed(1)} is on the north or west edge`);
    }
    for (const q of cliffFootRocks(t)) {
      assert.ok(!t.canStand(q.x, q.z, 0.55), `${id}: no unit stands where a cliff-foot rock is (${q.x.toFixed(1)},${q.z.toFixed(1)})`);
      assert.ok(HEIGHT[q.kind] * q.s <= 0.6, `${id}: cliff-foot ${q.kind} stays small`);
    }
    for (const q of bankReeds(t)) {
      assert.ok(!["water", "road", "ford", "bridge"].includes(t.at(q.x, q.z)) && !t.inWater(q.x, q.z, 0.2), `${id}: reed on ${t.at(q.x, q.z)}`);
      assert.ok(q.s <= MAX_SCALE && HEIGHT.reed * MAX_SCALE <= 2.5);
    }
    if (landOf(t) && !landOf(t).reeds) assert.equal(bankReeds(t).length, 0, `${id}: no reeds on lava or ice`);
  }
  assert.ok(bankReeds(new Terrain("riverlands")).length >= 15 && bankReeds(new Terrain("twinrivers")).length >= 60, "reeds on the river banks");
  assert.ok(cliffFootRocks(new Terrain("dunes")).length > 20, "the dunes mesas have rocks at their feet");
});

test("battle-start loading: the ground detail fetches nothing until a battle starts, and the worker keeps the layers", () => {
  const view = readFileSync(new URL("../src/view.js", import.meta.url), "utf8"), sprites = readFileSync(new URL("../src/fx-sprites.js", import.meta.url), "utf8");
  assert.match(sprites, /this\.view\.onBattleStart\?\.\(\)/, "the weapon sprites' start (battle start) calls onBattleStart");
  assert.match(view, /onBattleStart\(\) \{\s*this\.groundDetail\?\.start\(\);/);
  assert.match(view, /if \(this\.groundDetail\) this\.groundDetail\.started = false;/, "reset() clears it, so the title screen fetches nothing new");
  // The worker's rule for the layers: the regex literal on the line that names textures/ground, compiled as written.
  const sw = readFileSync(new URL("../tools/sw.template.js", import.meta.url), "utf8");
  const rule = sw.split("\n").find((line) => line.includes("textures\\/ground") && line.includes(".test(path)"))?.match(/\/\^textures.*?\$\//);
  assert.ok(rule, "the worker keeps textures/ground/*.webp on first fetch");
  const re = new RegExp(rule[0].slice(1, -1));
  assert.ok(re.test("textures/ground/grass-dry.webp?v=086aecc5b3") && re.test("textures/ground/road.webp") && re.test("textures/ground/256/snow.webp?v=1a2b") && !re.test("textures/ground/../x.js"));
  assert.ok(existsSync(new URL("../tools/ground-textures.py", import.meta.url)), "the generator is in the repo");
});
