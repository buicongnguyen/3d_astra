// H5 close-view look pass: surface detail (close-detail.js), creature life, birds that react (bird-life.js,
// bird-view.js, public/models/birds.glb), unit decals (unit-decals-view.js), fish that wander (ambient-life.js) and the
// settings keys H7 wires (closeDetail, birdHint). View only: nothing here touches the simulation or its generator.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { planFlocks, roofFlock, BirdFlocks, birdPath, BIRD_BUDGET, BIRD_LIFE, NEVER, SPECIES } from "../src/bird-life.js";
import { BirdView } from "../src/bird-view.js";
import { drawDetailAtlas, closeDetailOn, closeDetailShader, tagCreatureLife, CLOSE_DETAIL, CREATURE_LIFE } from "../src/close-detail.js";
import { unitNumber, UNIT_DECALS } from "../src/unit-decals-view.js";
import { AmbientLife, FISH_TURN, GOOSE_LOOK } from "../src/ambient-life.js";
import { Terrain } from "../src/terrain.js";
import { defaults, normalize } from "../src/settings.js";
import { VIEW_PLUGINS } from "../src/view-plugins.js";
import { parseModel } from "./lib/glb.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const mapOf = (id) => {
  const t = new Terrain(id), tall = [];
  // A grove of tall props like the scatter's (bird-view.js reads view.scatter.tall).
  for (let i = 0; i < 30; i++) tall.push({ x: -30 + (i % 6) * 12, z: -30 + Math.floor(i / 6) * 13, h: 1.8 + (i % 3) * 0.2, kind: i % 2 ? "pine" : "conifer" });
  return { id: t.id, half: t.half, rivers: t.river ? (t.rivers?.length ? t.rivers : [{ z: 0 }]) : [], heightAt: (x, z) => t.heightAt(x, z), at: (x, z) => t.at(x, z), tall };
};

test("bird flocks are seeded per map, inside the map, within the budgets, on the right perches", () => {
  for (const id of ["riverlands", "woodlands", "classic", "expanse"]) {
    const map = mapOf(id);
    for (const touch of [false, true]) {
      const a = planFlocks(map, { touch }), b = planFlocks(map, { touch });
      assert.deepEqual(a, b, `${id}: same plan twice`);
      const budget = BIRD_BUDGET[touch ? "touch" : "pc"];
      assert.ok(a.length > 0 && a.length <= budget.flocks - budget.roofs, `${id} ${touch}: ${a.length} flocks`);
      for (const f of a) {
        assert.ok(SPECIES.includes(f.species));
        assert.ok(f.birds.length >= BIRD_LIFE.flock[0] && f.birds.length <= BIRD_LIFE.flock[1]);
        assert.ok(Math.abs(f.x) < map.half - 4 && Math.abs(f.z) < map.half - 4, `${id}: flock inside`);
        if (f.species === "duck") assert.equal(map.at(f.x, f.z), "water", "ducks on the water");
        if (f.species === "gull") assert.notEqual(map.at(f.x, f.z), "water", "gulls on the bank");
        if (f.species === "songbird") assert.equal(f.kind, "tree");
      }
      if (map.rivers.length) assert.ok(a.some((f) => f.species === "gull"), `${id}: gulls by the river`);
      assert.ok(a.some((f) => f.species === "songbird"), `${id}: songbirds in the woods`);
    }
  }
  // Every near bird fits the near budget: at most 20 on a PC, 10 on a phone.
  assert.ok(BIRD_BUDGET.pc.near <= 20 && BIRD_BUDGET.touch.near <= 10);
  assert.deepEqual(roofFlock(7, 1, 4, 2, 3), roofFlock(7, 1, 4, 2, 3), "roof flocks are seeded by building");
});

test("a startle lifts a flock off in a ripple, nearest first; quiet brings it back down bird by bird", () => {
  const plan = [{ species: "crow", kind: "ground", x: 0, y: 0, z: 0, birds: Array.from({ length: 6 }, (_, i) => ({ ox: i * 0.8 - 2, oy: 0, oz: 0, size: 1, phase: 0 })) }];
  const flocks = new BirdFlocks(plan), f = flocks.flocks[0];
  assert.equal(flocks.startle(30, 0, 10, 1), 0, "out of reach: nothing");
  assert.equal(f.state, "perched");
  assert.equal(flocks.startle(-6, 0, BIRD_LIFE.reach.shot, 2), 1);
  assert.equal(f.state, "flying");
  const starts = f.birds.map((b) => b.start);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] > starts[i - 1], "the farther bird leaves later");
  assert.equal(starts[0], 2, "the nearest bird leaves at once");
  const p = {};
  assert.equal(birdPath(f, f.birds[5], starts[5] - 0.01, p).flying, false, "still perched before its turn");
  assert.equal(birdPath(f, f.birds[5], starts[5] + 1, p).flying, true);
  assert.ok(birdPath(f, f.birds[0], 2 + BIRD_LIFE.takeoff + 0.5, p).y > f.y + 2, "up in the air");
  // More shots keep it up; then it lands once quiet, one bird after another, and perches again.
  flocks.startle(-6, 0, BIRD_LIFE.reach.shot, 6);
  flocks.step(6 + BIRD_LIFE.quiet - 0.1);
  assert.equal(f.state, "flying");
  const t = 6 + BIRD_LIFE.quiet;
  flocks.step(t);
  assert.equal(f.state, "landing");
  const lands = f.birds.map((b) => b.landAt);
  for (let i = 1; i < lands.length; i++) assert.ok(lands[i] > lands[i - 1], "one after another");
  flocks.step(lands.at(-1) + BIRD_LIFE.land + 0.01);
  assert.equal(f.state, "perched");
  assert.ok(f.birds.every((b) => b.start === NEVER && b.landAt === NEVER));
  assert.equal(birdPath(f, f.birds[2], 100, p).flying, false);
});

test("crows circle over the latest fight; other birds circle over their own perch", () => {
  const mk = (species) => ({ species, kind: "ground", x: 0, y: 0, z: 0, birds: [{ ox: 0, oy: 0, oz: 0, size: 1, phase: 0.2 }] });
  const flocks = new BirdFlocks([mk("crow"), mk("gull")]);
  flocks.fought(20, 10, 1);
  flocks.startle(1, 0, 15, 1.5);
  assert.deepEqual([flocks.flocks[0].cx, flocks.flocks[0].cz], [20, 10]);
  assert.deepEqual([flocks.flocks[1].cx, flocks.flocks[1].cz], [0, 0]);
});

// A staged view for the bird plugin (three.js objects work headless): fog hidden everywhere but x < 0.
function birdStage(hint) {
  const t = new Terrain("riverlands");
  const view = { scene: new THREE.Scene(), terrain: t, settings: { birdHint: hint, detail: true }, motionLevel: 2, reducedMotion: { matches: false }, fogTexture: null, objects: new Map(), scatter: { tall: [] }, lifeShare: 1 };
  const sim = { entities: [], isVisible: (p) => p.x < 0, get: () => null };
  const plugin = new BirdView(view);
  plugin.update(sim, 0.016);
  return { view, sim, plugin };
}
test("birds: hidden enemies startle birds only with the fog hint on (Settings birdHint, default on); one card draw", () => {
  assert.equal(defaults().birdHint, true);
  for (const hint of [true, false]) {
    const { view, sim, plugin } = birdStage(hint);
    assert.equal(view.scene.children.filter((o) => o.isMesh).length, 1, "one card draw in the RTS view");
    const east = plugin.flocks.flocks.find((f) => f.x > 5), west = plugin.flocks.flocks.find((f) => f.x < -5);
    plugin.event({ type: "shot", x: east.x + 1, z: east.z, tx: east.x + 1, tz: east.z }, sim);
    assert.equal(east.state, hint ? "flying" : "perched", `hint ${hint}: a shot in the fog`);
    assert.equal(east.fog, hint, "marked as a fog startle");
    plugin.event({ type: "shot", x: west.x + 1, z: west.z, tx: west.x + 1, tz: west.z }, sim);
    assert.equal(west.state, "flying", "a seen shot always startles");
    plugin.update(sim, 0.016);
    assert.equal(plugin.uniforms.uHint.value, hint ? 1 : 0);
    plugin.reset();
    assert.equal(view.scene.children.length, 0, "reset removes everything");
  }
  // Reduced motion: birds stay on their perches.
  const { view, sim, plugin } = birdStage(true);
  view.reducedMotion.matches = true;
  plugin.update(sim, 0.016);
  const f = plugin.flocks.flocks[0];
  plugin.event({ type: "shot", x: f.x, z: f.z, tx: f.x, tz: f.z }, sim);
  assert.equal(f.state, "perched");
});

test("H5 modules use no Math.random and never the simulation or its generator", () => {
  for (const f of ["bird-life", "bird-view", "close-detail", "close-look-view", "unit-decals-view", "ambient-life", "building-decals-view"]) {
    const src = code(read(`../src/${f}.js`));
    assert.doesNotMatch(src, /Math\.random/, f);
    assert.doesNotMatch(src, /from "\.\/sim\//, `${f} imports nothing from the simulation`);
    assert.doesNotMatch(src, /sim\.(rng|random)|\.rng\(/, `${f} never draws from the simulation's generator`);
  }
  // The plugins only read the simulation: no assignment to sim or entity fields.
  for (const f of ["bird-view", "close-look-view", "unit-decals-view"]) assert.doesNotMatch(code(read(`../src/${f}.js`)), /\b(sim|e)\.[a-zA-Z]+\s*=[^=]/, f);
  for (const P of ["CloseLookView", "UnitDecalsView", "BirdView"]) assert.ok(VIEW_PLUGINS.some((c) => c.name === P), `${P} registered`);
});

test("the close-detail atlas is drawn by code, seeded, tiny and centred on neutral", () => {
  const a = drawDetailAtlas(), b = drawDetailAtlas();
  assert.deepEqual(a, b);
  assert.equal(a.length, 128 * 128 * 4, "64 KB");
  for (let c = 0; c < 4; c++) {
    let sum = 0; for (let i = c; i < a.length; i += 4) sum += a[i];
    const mean = sum / (128 * 128);
    assert.ok(Math.abs(mean - 128) < 24, `channel ${c} mean ${mean.toFixed(1)}`);
  }
});

test("Close-up detail: auto on PCs, governor-led on phones, forced on / off; the shader patch is guarded by its uniform", () => {
  assert.equal(defaults().closeDetail, "auto");
  assert.equal(normalize({ version: 1, closeDetail: "off" }).closeDetail, "off");
  assert.equal(normalize({ version: 1, closeDetail: "bogus" }).closeDetail, "auto");
  assert.equal(normalize({ version: 1, birdHint: false }).birdHint, false);
  assert.equal(closeDetailOn("auto", { touch: false }), true);
  assert.equal(closeDetailOn("auto", { touch: true, level: "full" }), true);
  assert.equal(closeDetailOn("auto", { touch: true, level: "calm" }), false);
  assert.equal(closeDetailOn("auto", { touch: true, eco: true }), false);
  assert.equal(closeDetailOn("on", { touch: true, level: "calm" }), true);
  assert.equal(closeDetailOn("on", { level: "rescue" }), false);
  assert.equal(closeDetailOn("off", {}), false);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  assert.equal(closeDetailShader(shader), true);
  assert.equal(shader.uniforms.uCdAmount, CLOSE_DETAIL.amount, "shared uniform");
  assert.match(shader.fragmentShader, /if \( cdK > 0\.004 \)/, "skipped while off");
  assert.match(shader.vertexShader, /abs\( aLife\.w - 0\.5 \) < 0\.01/, "creature life only on tagged creatures");
});

test("creature life tags the head, tail and chest of a detail template once per geometry", () => {
  const g = new THREE.BoxGeometry(0.6, 0.8, 2, 2, 2, 10).translate(0, 0.6, 0);
  const t = new THREE.Group(); t.add(new THREE.Mesh(g));
  assert.equal(tagCreatureLife(t), 1);
  assert.equal(tagCreatureLife(t), 0, "once");
  const life = g.getAttribute("aLife"), pos = g.getAttribute("position");
  let front = 0, back = 0;
  for (let i = 0; i < pos.count; i++) {
    assert.equal(life.getW(i), 0.5);
    if (pos.getZ(i) > 0.9) { assert.ok(life.getX(i) >= 1, "head at the front"); front++; }
    if (pos.getZ(i) < -0.9) { assert.ok(life.getY(i) > 0.9, "tail at the back"); back++; }
  }
  assert.ok(front && back);
  assert.ok(CREATURE_LIFE.has("acidhound") && !CREATURE_LIFE.has("vaultsentinel"));
});

test("unit numbers are stable two-digit numbers; at most 24 units wear decals", () => {
  assert.deepEqual(unitNumber(7), [0, 7]);
  assert.deepEqual(unitNumber(42), [4, 2]);
  assert.deepEqual(unitNumber(100), [0, 1]);
  for (let id = 1; id < 500; id++) { const [a, b] = unitNumber(id); assert.ok(a >= 0 && a <= 9 && b >= 0 && b <= 9 && a * 10 + b >= 1); }
  assert.equal(UNIT_DECALS.units, 24);
});

test("fish wander with a turn limit and keep to their river lane", () => {
  const terrain = new Terrain("riverlands");
  const life = new AmbientLife(new THREE.Scene(), terrain, { fogTexture: null });
  const g = life.fish;
  assert.ok(g && g.alive > 5);
  const before = g.rows.map((f) => f.h);
  const dt = 1 / 30;
  for (let s = 0; s < 1800; s++) {
    const prev = g.rows.map((f) => f.h);
    life.update(dt, { isCamera: false, top: 1, bottom: -1 }, 600);
    g.rows.forEach((f, i) => {
      const d = Math.abs(Math.atan2(Math.sin(f.h - prev[i]), Math.cos(f.h - prev[i])));
      assert.ok(d <= FISH_TURN * dt + 1e-9, `turn ${d}`);
      assert.ok(Math.abs(f.pz - f.lane) < 2.6, `in its lane: ${f.pz - f.lane}`);
      assert.ok(Math.abs(f.px) < terrain.half - 2, "inside the map");
    });
  }
  assert.ok(g.rows.some((f, i) => Math.abs(f.h - before[i]) > 0.3), "they do turn");
  const [x, z] = g.at(g.rows[0]);
  assert.ok(life.disturb(x, z, 0.4) >= 1, "a blast hits a fish where it swims now");
});

test("birds.glb: six families, one mesh each with the wing/head attribute, within the near-bird triangle budget", async () => {
  const { scene } = await parseModel(readFileSync(new URL("../public/models/birds.glb", import.meta.url)));
  const found = new Map();
  scene.traverse((o) => { if (o.isMesh) found.set(o.name, o); });
  for (const s of SPECIES) {
    const m = found.get(s);
    assert.ok(m, `${s} mesh`);
    const g = m.geometry, tris = (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    assert.ok(g.getAttribute("_bird") && g.getAttribute("color") && g.getAttribute("normal"), `${s} attributes`);
    assert.ok(tris >= 900 && tris <= 3000, `${s}: ${tris} triangles`);
    assert.ok(Array.isArray(m.userData.hinge) && Array.isArray(m.userData.neck), `${s} pivots`);
    assert.ok(tris * BIRD_BUDGET.pc.near <= 60000, `${s}: a full near set stays under 60k triangles`);
  }
});

// The Expanse geese V: the cards in the RTS view; in Hero mode birds.glb's goose_lod in their place (one draw either way,
// same instance rows), at most 400 triangles a goose so the 14 geese stay under 6k triangles on a phone.
test("geese V: birds.glb goose_lod swaps in for the cards in Hero mode only, one draw, within the triangle budget", async () => {
  const { scene } = await parseModel(readFileSync(new URL("../public/models/birds.glb", import.meta.url)));
  let lod = null;
  scene.traverse((o) => { if (o.isMesh && o.name === "goose_lod") lod = o; });
  assert.ok(lod, "goose_lod mesh in birds.glb");
  const g = lod.geometry, tris = (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  assert.ok(tris >= 200 && tris <= 400, `goose_lod: ${tris} triangles`);
  const side = g.getAttribute("_bird");
  assert.ok(side && g.getAttribute("color") && g.getAttribute("normal"), "goose_lod attributes");
  const sides = new Set(); for (let i = 0; i < side.count; i++) sides.add(side.getX(i));
  assert.ok(sides.has(-1) && sides.has(1) && sides.has(0), "both wings and the body are tagged (the wings flap from _bird)");
  assert.ok(Array.isArray(lod.userData.hinge) && Array.isArray(lod.userData.neck), "pivots");
  assert.equal(GOOSE_LOOK.length, 4);

  const life = new AmbientLife(new THREE.Scene(), new Terrain("expanse"), { fogTexture: null });
  const birds = life.groups.find((r) => r.name === "birds"), shown = () => life.root.children.filter((m) => m.visible).map((m) => m.name);
  assert.equal(life.plan.look, "goose");
  assert.equal(birds.rows.length, 14, "two Vs of seven");
  const before = shown();
  assert.equal(life.gooseModel(null), false, "the RTS view keeps the cards");
  assert.ok(!life.geese, "no goose mesh until a model is handed over");
  assert.equal(life.gooseModel(lod), true);
  const mesh = life.geese.mesh;
  assert.equal(mesh.name, "life:geese");
  assert.deepEqual(shown(), [...before.filter((n) => n !== "life:birds"), "life:geese"], "a swap: the same number of draws");
  assert.equal(mesh.castShadow, false);
  for (const name of ["aA", "aB", "aC"]) assert.equal(mesh.geometry.getAttribute(name), birds.geometry.getAttribute(name), `${name} shared with the cards`);
  assert.equal(mesh.geometry.instanceCount, 14, "every goose");
  assert.ok(mesh.geometry.instanceCount * tris <= 6000, `the V stays under 6k triangles: ${mesh.geometry.instanceCount * tris}`);
  life.setShare(0.5);
  assert.equal(mesh.geometry.instanceCount, 7, "the governor thins the model like the cards");
  life.setShare(1);
  assert.equal(life.gooseModel(null), false);
  assert.deepEqual(shown(), before, "leaving Hero mode hands the cards back");
  // A map without geese never builds one.
  const other = new AmbientLife(new THREE.Scene(), new Terrain("riverlands"), { fogTexture: null });
  assert.equal(other.gooseModel(lod), false);
  assert.ok(!other.geese);

  // BirdView: the RTS view never fetches birds.glb for the geese; Hero mode does, and Detail/governor rules hold.
  const view = { scene: new THREE.Scene(), terrain: new Terrain("expanse"), settings: { birdHint: true, detail: true }, motionLevel: 2, reducedMotion: { matches: false }, fogTexture: null, objects: new Map(), scatter: { tall: [] }, lifeShare: 1, life: new AmbientLife(new THREE.Scene(), new Terrain("expanse"), { fogTexture: null }) };
  const plugin = new BirdView(view);
  let loads = 0;
  plugin.load = () => { loads++; };
  const sim = { entities: [], isVisible: () => true, get: () => null };
  for (let i = 0; i < 5; i++) plugin.update(sim, 0.3);
  assert.equal(loads, 0, "RTS view: birds.glb not fetched");
  assert.equal(plugin.state.geese, 0);
  view.heroSaved = true; Object.defineProperty(view, "heroCameraOn", { get: () => !!view.heroSaved }); view.heroEye = new THREE.Vector3();
  plugin.update(sim, 0.3);
  assert.ok(loads >= 1, "Hero mode loads birds.glb");
  plugin.models = new Map([["goose_lod", lod]]);
  plugin.update(sim, 0.3);
  assert.equal(plugin.state.geese, 14, "Hero mode: the V flies as the goose model");
  view.lifeShare = 0.5; plugin.update(sim, 0.3);
  assert.equal(plugin.state.geese, 0, "a thinned frame budget hands the cards back");
  view.lifeShare = 1; view.heroSaved = null; plugin.update(sim, 0.3);
  assert.equal(plugin.state.geese, 0, "leaving Hero mode hands the cards back");
});
