// The Hero-view horizon (owner 2026-11-28; src/horizon-view.js, src/horizon-sky.js): a sky dome, far mountains or sea
// and the key art's planets, built only on the first Hero mode entry. The first tests below are the Calm sky's (today's
// blue sky, Settings > Hero > Sky "Calm"); the Vivid space sky (the default: src/horizon-vivid.js, src/sky-events.js,
// src/sky-war.js) and the victory fireworks follow. The browser side (screenshots, the RTS pixel guard, real WebGL
// draws) is in tests/skywing-land.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import MAPS from "../src/maps.json" with { type: "json" };
import { Terrain } from "../src/terrain.js";
import { createMapEdge } from "../src/map-edge.js";
import { LOOKS } from "../src/mission-looks.js";
import { HorizonView } from "../src/horizon-view.js";
import { VIEW_PLUGINS } from "../src/view-plugins.js";
import { HorizonSky, buildRing, buildPlanets, seaFor, skyFor, SKIES, LOOK_SKY, BODIES, ATLAS, TRIANGLES, DEPTHS, COMET, skyDir } from "../src/horizon-sky.js";
import { VIVID_BODIES, BAND, PHONE_FIT, phoneBody, stageOf, ORBIT, ringEl, SHEETS, sheetBytes, EVENT_SHEETS, EVENT_MESHES } from "../src/horizon-vivid.js";
import { skyPlan, skySeed, skyMode, pickEvent, EVENT_PICK, SKY_EVENTS, METEORS, SkyFlash, FLASH, blastSize, blastStrength, campaignMission } from "../src/sky-events.js";
import { ARMADA, armadaPlan, armadaPose, WAR, WAR_SLOTS, WAR_KIND, warPlan, warPose } from "../src/sky-war.js";
import { VictoryFireworks, fireworksPlan, fireworksFor, FIREWORKS } from "../src/victory-fireworks.js";
import { defaults, normalize, saveSettings, loadSettings } from "../src/settings.js";
import { landOf } from "../src/lands.js";

const DEG = Math.PI / 180;
// A view as the plugin sees it: a scene, a perspective hero camera (or not), a terrain with its backdrop, the look.
function fakeView({ id = "riverlands", hero = false, look = null, k = 1, settings = {}, reduced = false, motion = 2, level = "full", pitch = -13, sky = "calm" } = {}) {
  const terrain = new Terrain(id), scene = new THREE.Scene(), backdrop = createMapEdge(terrain);
  const camera = new THREE.PerspectiveCamera(56, 1.6, 0.3, 140);
  camera.position.set(0, 4, 0);
  camera.rotation.set(pitch * DEG, 0, 0, "YXZ");
  camera.updateMatrixWorld();
  scene.add(backdrop);
  return {
    scene, terrain, backdrop, camera, settings: { detail: true, heroSky: sky, ...settings },
    heroCameraOn: hero, mood: { state: { name: look, k: look ? k : 0, flash: 0 } },
    reducedMotion: { matches: reduced }, motionLevel: motion, closeLevel: level, softwareGL: false,
  };
}
const meshes = (scene) => { const out = []; scene.traverse((o) => { if (o.isMesh && o.name.startsWith("horizon")) out.push(o); }); return out; };
const visible = (scene) => { const out = []; scene.traverse((o) => { if (o.isMesh && o.name.startsWith("horizon")) { let v = true; for (let p = o; p; p = p.parent) v &&= p.visible; if (v) out.push(o.name); } }); return out.sort(); };

test("the horizon is a registered view plugin that builds nothing in the RTS view", async () => {
  assert.ok(VIEW_PLUGINS.includes(HorizonView), "registered");
  const v = fakeView({ hero: false }), plugin = new HorizonView(v);
  for (let i = 0; i < 5; i++) plugin.update({}, 0.016);
  assert.equal(plugin.loading, null, "the sky module is not even imported");
  assert.deepEqual(meshes(v.scene), [], "no horizon mesh in the RTS view");
  assert.equal(v.backdrop.material.userData.motion.hero.value, 0, "the backdrop keeps its own sky");
  assert.equal(plugin.state.draws, 0);
});

test("the first Hero mode entry builds it (3 draws landed, 1 looking down from the air), leaving puts the RTS view back", async () => {
  const v = fakeView({ hero: true }), plugin = new HorizonView(v);
  plugin.update({}, 0.016);
  await plugin.loading;
  plugin.update({}, 0.016);
  assert.ok(plugin.sky instanceof HorizonSky);
  plugin.sky.atlasReady = true; // (node has no image loader)
  plugin.update({}, 0.016);
  assert.deepEqual(visible(v.scene), ["horizon-dome", "horizon-planets", "horizon-ring"], "dome, ring and planets");
  assert.equal(plugin.state.draws, 3);
  assert.equal(v.backdrop.material.userData.motion.hero.value, 1, "the backdrop's far-plane sky steps aside");
  // Skywing in the air: the camera looks 52 degrees down and no sky shows, so only the dome (with nothing to fill) stays.
  v.camera.rotation.set(-52 * DEG, 0, 0, "YXZ"); v.camera.fov = 54; v.camera.updateMatrixWorld();
  plugin.update({}, 0.016);
  assert.deepEqual(visible(v.scene), ["horizon-dome"]);
  assert.equal(plugin.state.draws, 1);
  // Back to the RTS view: nothing drawn, the backdrop's sky back.
  v.heroCameraOn = false;
  plugin.update({}, 0.016);
  assert.deepEqual(visible(v.scene), []);
  assert.equal(plugin.state.draws, 0);
  assert.equal(v.backdrop.material.userData.motion.hero.value, 0);
});

test("never in the shadow pass, never picked, always on the far plane behind the battlefield", async () => {
  const v = fakeView({ hero: true }), sky = new HorizonSky(v, { atlasUrl: null });
  sky.update({}, 0, true);
  for (const m of meshes(v.scene)) {
    assert.equal(m.castShadow, false, m.name);
    assert.equal(m.receiveShadow, false, m.name);
    assert.equal(m.frustumCulled, false, m.name);
    const hits = [];
    m.raycast(new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)), hits);
    assert.equal(hits.length, 0, `${m.name} is never picked`);
  }
  assert.equal(sky.dome.material.depthWrite, false);
  assert.equal(sky.planets.material.depthWrite, false);
  assert.match(sky.planets.material.vertexShader, /p\.z = p\.w;/, "planets on the far plane");
  assert.match(sky.ring.material.vertexShader, /p\.z = p\.w \* aMist\.z;/, "ring layers just inside it");
  for (const d of DEPTHS) assert.ok(d < 1 && d >= 0.9999, `ring depth ${d}`);
  assert.equal(new Set(DEPTHS).size, DEPTHS.length, "each ring layer its own depth (no fighting)");
  // The dome after every opaque mesh (only the open sky runs it); the planets before every other transparent.
  assert.ok(sky.dome.renderOrder > sky.ring.renderOrder && sky.ring.renderOrder >= 1000);
  assert.ok(sky.planets.renderOrder <= -1000 && sky.planets.material.transparent);
  sky.dispose();
});

test("every land's ring stays in the triangle budget, follows the land and opens to the sea where the water runs out", () => {
  const styles = new Set();
  for (const id of Object.keys(MAPS)) {
    const t = new Terrain(id), g = buildRing(t), tris = g.userData.triangles;
    assert.ok(tris <= TRIANGLES.max, `${id}: ${tris} triangles`);
    // The isles are mostly sea with a few islands: fewer triangles is fine there.
    assert.ok(tris >= (skyFor(id).style === "isles" ? 500 : TRIANGLES.min), `${id}: ${tris} triangles`);
    assert.equal(g.attributes.position.count, tris * 3);
    for (const name of ["color", "aInfo", "aMist"]) assert.equal(g.attributes[name].count, tris * 3, `${id} ${name}`);
    // nothing reaches higher than 8 degrees (a far range, never a wall over the battlefield)
    const p = g.attributes.position.array;
    let top = -90;
    for (let i = 0; i < p.length; i += 3) top = Math.max(top, Math.asin(p[i + 1] / Math.hypot(p[i], p[i + 1], p[i + 2])) / DEG);
    assert.ok(top > 1 && top < 8, `${id}: top ${top.toFixed(2)} deg`);
    styles.add(skyFor(id).style);
  }
  assert.deepEqual([...styles].sort(), ["ash", "forest", "hills", "isles", "mesa", "peaks", "snow", "volcano"]);
  assert.deepEqual(seaFor(new Terrain("archipelago")), { bearing: 0, half: Math.PI, ice: false, all: true }, "the isles: sea all round");
  assert.equal(seaFor(new Terrain("twinrivers")).bearing, Math.PI / 2, "the rivers run out east: the sea opens there");
  assert.equal(seaFor(new Terrain("snowfield")).ice, true, "frozen lakes: an ice sheet");
  assert.equal(seaFor(new Terrain("volcano")), null, "lava makes no sea");
  assert.equal(seaFor(new Terrain("dunes")), null, "a dry map: mountains all round");
  for (const look of Object.keys(SKIES)) assert.ok(new THREE.Color(SKIES[look].zenith).b > new THREE.Color(SKIES[look].zenith).r, `${look}: a blue sky overhead`);
});

test("the planets are one mesh from one atlas: the key art's worlds, the ringed one the biggest, all inside a phone's sky", () => {
  const g = buildPlanets();
  assert.deepEqual(BODIES.map((b) => b.name).sort(), ["amber", "dunes", "ember", "ringed", "silver", "storm"]);
  const biggest = [...BODIES].sort((a, b) => b.w - a.w)[0];
  assert.equal(biggest.name, "ringed");
  for (const b of BODIES) {
    const [x, y, w, h] = ATLAS[b.name], aspect = (w - 2 * ATLAS.pad) / (h - 2 * ATLAS.pad), height = b.w / aspect;
    assert.ok(x + w <= ATLAS.size[0] && y + h <= ATLAS.size[1], b.name);
    // whole on a portrait phone's shoulder view (its sky reaches about 11.8 degrees) and above the far hills
    assert.ok(b.el + height / 2 <= 11.8 && b.el - height / 2 >= 0.4, `${b.name}: ${(b.el - height / 2).toFixed(1)}..${(b.el + height / 2).toFixed(1)}`);
  }
  // The ringed world's ring tip (77% down its cell) stands clear of the valley's hills (the ring is never cut).
  const ringed = BODIES.find((b) => b.name === "ringed"), h = ringed.w / 1.5, tip = ringed.el + h / 2 - 0.77 * h;
  for (const id of Object.keys(MAPS)) {
    const ring = buildRing(new Terrain(id)).attributes.position.array;
    let hills = -90;
    for (let i = 0; i < ring.length; i += 3) {
      const yaw = Math.atan2(ring[i], ring[i + 2]), off = yaw - (Math.PI * 3) / 4 + ringed.u * DEG, d = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
      if (d < (ringed.w / 2) * DEG) hills = Math.max(hills, Math.asin(ring[i + 1] / Math.hypot(ring[i], ring[i + 1], ring[i + 2])) / DEG);
    }
    assert.ok(hills < tip, `${id}: the hills under the ringed world reach ${hills.toFixed(2)}, its ring tip ${tip.toFixed(2)}`);
  }
  // 6 bodies (a quad each) and the nebula strip, one index buffer
  assert.equal(g.index.count / 3, BODIES.length * 2 + 16 * 2);
  const kinds = new Set(g.attributes.aKind.array);
  assert.deepEqual([...kinds].sort(), [0, 1], "bodies and the nebula in the same draw");
  // The atlas: 1024x512, small on disk (the bake writes it; read the WebP header for its size).
  const webp = readFileSync(new URL("../src/art/sky/sky-atlas.webp", import.meta.url));
  assert.equal(webp.toString("ascii", 0, 4), "RIFF");
  assert.ok(webp.length < 220_000, `${webp.length} bytes`);
  assert.deepEqual(ATLAS.size, [1024, 512]);
});

test("it follows the look: a very dark blue night with stars, comet and violet nebula; a grey storm dims the planets", () => {
  const sky = (look, k = 1, id = "riverlands") => { const v = fakeView({ hero: true, look, k, id }), s = new HorizonSky(v, { atlasUrl: null }); s.update({}, 0, true, { mode: "calm" }); return s.uniforms; };
  const day = sky(null), night = sky("night"), storm = sky("storm"), dusk = sky("dusk");
  const z = night.uZenith.value;
  assert.ok(z.b > z.r && z.b > z.g && z.r + z.g + z.b < 0.05, `night overhead is very dark blue ${z.getHexString()}`);
  assert.ok(day.uZenith.value.b > 0.4, `day overhead is a vivid blue ${day.uZenith.value.getHexString()}`);
  assert.equal(day.uStars.value, 0, "no stars by day");
  assert.equal(night.uStars.value, 1);
  assert.equal(day.uNebula.value, 0, "no nebula by day");
  assert.ok(night.uNebula.value > 0.5 && storm.uNebula.value > 0 && storm.uNebula.value < night.uNebula.value, "the nebula at night, faint in a storm");
  assert.ok(night.uComet.value > day.uComet.value && day.uComet.value > 0, "the comet clear at night, faint by day");
  assert.ok(storm.uPlanets.value < 0.4 && night.uPlanets.value === 1, "planets dim behind the storm, full at night");
  assert.ok(storm.uCloud.value > 0.5 && day.uCloud.value <= 0.25, "very little cloud by day, heavy in a storm");
  assert.equal(night.uDay.value, 0, "planets in full colour at night");
  assert.ok(day.uDay.value === 1, "hazed like a daytime moon by day");
  assert.ok(night.uEdgeK.value === 1 && night.uEdgeLo.value.equals(new THREE.Color(LOOKS.night.edge.low)), "the silhouettes take the night's edge colours");
  assert.equal(day.uGlow.value.r > day.uGlow.value.b, true, "a warm sun glow by day");
  assert.equal(night.uGlow.value.getHex(), 0, "no sun glow at night");
  assert.ok(dusk.uGlow.value.r > day.uGlow.value.r, "a stronger glow at dusk");
  // the horizon is the backdrop's own haze (the hero fog colour), tinted by the look
  const v = fakeView({ hero: true, look: "night" }), s = new HorizonSky(v, { atlasUrl: null });
  s.update({}, 0, true, { mode: "calm" });
  assert.ok(s.uniforms.uHorizon.value.equals(v.backdrop.material.userData.sky.horizon));
  // a ramped look blends in
  const half = sky("night", 0.5).uZenith.value;
  assert.ok(half.b < day.uZenith.value.b && half.b > night.uZenith.value.b);
  for (const k of Object.keys(LOOK_SKY)) if (k !== "day") assert.ok(Object.hasOwn(LOOKS, k), `${k} is a mission look`);
});

test("clouds drift, stars twinkle and the comet shimmers only while motion is allowed", () => {
  const run = (opts) => { const v = fakeView({ hero: true, ...opts }), s = new HorizonSky(v, { atlasUrl: null }); for (let i = 0; i < 30; i++) s.update({}, 0.05, true); return s.uniforms.uTime.value; };
  assert.ok(run({}) > 1.4, "drifts");
  assert.equal(run({ reduced: true }), 0, "reduced motion: still");
  assert.equal(run({ motion: 0 }), 0, "the governor's still steps: still");
  const v = fakeView({ hero: true }), s = new HorizonSky(v, { atlasUrl: null });
  for (let i = 0; i < 10; i++) s.update({}, 0, true);
  assert.equal(s.uniforms.uTime.value, 0, "paused (dt 0): still");
  // The comet sits at a fixed place on the sky, its tail rising to one side.
  const head = skyDir(COMET.u, COMET.el), tail = s.uniforms.uCometTail.value;
  assert.ok(s.uniforms.uCometHead.value.distanceTo(head) < 1e-9);
  assert.ok(Math.abs(tail.dot(head)) < 1e-6 && tail.y > 0.5, "the tail lies on the sky and rises");
});

test("software WebGL (no GPU, CI's SwiftShader) keeps the old sky: nothing is loaded", () => {
  const v = fakeView({ hero: true }), plugin = new HorizonView(v);
  v.softwareGL = true;
  for (let i = 0; i < 3; i++) plugin.update({}, 0.016);
  assert.equal(plugin.loading, null);
  assert.equal(plugin.state.draws, 0);
  assert.equal(v.backdrop.material.userData.motion.hero.value, 0);
});

test("Settings > Decorative vegetation Off and the governor's rescue step", async () => {
  const v = fakeView({ hero: true, settings: { detail: false } }), plugin = new HorizonView(v);
  plugin.update({}, 0.016);
  assert.equal(plugin.loading, null, "Off: nothing is loaded");
  assert.equal(plugin.state.draws, 0);
  v.settings.detail = true;
  plugin.update({}, 0.016);
  await plugin.loading;
  plugin.sky.atlasReady = true;
  v.closeLevel = "rescue";
  plugin.update({}, 0.016);
  assert.deepEqual(visible(v.scene), ["horizon-dome"], "rescue keeps only the dome");
  v.closeLevel = "full";
  plugin.forceOff = true;
  plugin.update({}, 0.016);
  assert.deepEqual(visible(v.scene), [], "forceOff (A/B timing) hides it all");
});

test("the backdrop's hero uniform leaves its RTS shader exactly as it was", () => {
  const src = readFileSync(new URL("../src/map-edge.js", import.meta.url), "utf8");
  assert.match(src, /uEdgeHero > 0\.5 \? vec4\(0\.0, 0\.0, 2\.0, 1\.0\) : vec4\(skyData\.xy, 0\.999999, 1\.0\)/);
  assert.match(src, /\* \(1\.0 - uEdgeHero\);/);
  assert.equal(createMapEdge(new Terrain("classic")).material.userData.motion.hero.value, 0);
});

// ================================================================================================ the Vivid sky
// (owner 2026-11-28/29: "a dark, vivid, colourful space sky like the key art"; "beautiful, vivid, like a space war")
const fakeSim = (map = "riverlands", extra = {}) => ({ terrain: new Terrain(map), enemyCount: 1, difficulty: "standard", factions: { 0: "meridian", 1: "meridian" }, ...extra });
const pick = (o, ...keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
// Every sheet "loaded" (node has no images): stand-in textures, so the layers can show.
function artReady(sky) {
  sky.atlasReady = true;
  sky.uniforms.uMapReady.value = 1;
  for (const name of Object.keys(SHEETS)) { sky.vivid.textures[name] = { userData: { bytes: sheetBytes(name, sky.vivid.phone) }, dispose() {} }; sky.vivid.ready[name] = true; }
  sky.vivid.bind();
}
const vividView = (opts = {}) => { const v = fakeView({ hero: true, sky: "vivid", ...opts }), s = new HorizonSky(v, { atlasUrl: null }); artReady(s); return { v, s }; };

test("one sky event a match, picked from the match seed (a replay rebuilds the same seed): every event can come up", () => {
  const seeds = Object.keys(MAPS).flatMap((m) => [1, 2, 3].map((n) => skySeed(fakeSim(m, { enemyCount: n }))));
  for (const seed of seeds) assert.equal(pickEvent(seed), pickEvent(seed), "deterministic");
  assert.equal(skySeed(fakeSim("dunes")), skySeed(fakeSim("dunes")), "the same setup gives the same seed");
  assert.notEqual(skySeed(fakeSim("dunes")), skySeed(fakeSim("dunes", { difficulty: "veteran" })));
  assert.deepEqual([...new Set(seeds.map(pickEvent))].sort(), [...EVENT_PICK].sort(), "all five events appear across the matches");
  assert.deepEqual([...EVENT_PICK].sort(), Object.keys(SKY_EVENTS).sort(), "every event has its rules");
  for (const id of EVENT_PICK) if (SKY_EVENTS[id].mesh) assert.ok(EVENT_MESHES[SKY_EVENTS[id].mesh] && EVENT_SHEETS[id], `${id}: a mesh and its art`);
  // The plan: the seeded event, its meteors; a shower is meteors only (no event draw).
  const shower = seeds.find((s) => pickEvent(s) === "shower");
  assert.deepEqual(pick(skyPlan({ mode: "vivid", terrain: new Terrain("riverlands"), seed: shower }), "event", "meteors", "why"), { event: "shower", meteors: "shower", why: "seed" });
  assert.deepEqual(pick(skyPlan({ mode: "calm", seed: shower }), "event", "meteors", "war"), { event: null, meteors: "none", war: 0 }, "Calm: no event, no meteors, no war");
});

test("the volcano land always shows the shattered planet; Burning world shows it on every map (a shower still adds its meteors)", () => {
  const seeds = Array.from({ length: 40 }, (_, i) => `seed-${i}`);
  for (const id of Object.keys(MAPS)) {
    const t = new Terrain(id), lava = !!landOf(t)?.lava;
    for (const seed of seeds.slice(0, 6)) {
      const p = skyPlan({ mode: "vivid", terrain: t, seed });
      if (lava) assert.deepEqual(pick(p, "event", "why"), { event: "shattered", why: "volcano" }, `${id}: a burning world fits the volcano`);
      else assert.equal(p.event, pickEvent(seed), `${id}: the seeded pick`);
    }
  }
  assert.ok(Object.keys(MAPS).some((id) => landOf(new Terrain(id))?.lava), "a volcano map exists");
  for (const seed of seeds) {
    const p = skyPlan({ mode: "burning", terrain: new Terrain("riverlands"), seed });
    assert.equal(p.event, "shattered", "Burning world: the shattered planet every match");
    assert.equal(p.meteors, pickEvent(seed) === "shower" ? "shower" : "normal", "a meteor-shower pick keeps its shower");
    assert.equal(p.war, 1, "the far war strong in the Burning world");
  }
  assert.equal(skyPlan({ mode: "vivid", seed: seeds.find((s) => pickEvent(s) === "armada") }).war, 1, "strong in the Armada");
  assert.equal(skyPlan({ mode: "vivid", seed: seeds.find((s) => pickEvent(s) === "aurora") }).war, 0.45, "faint otherwise");
  // A campaign mission opens with the player's fleet landing; a Hero challenge or a Defence level does not.
  assert.equal(skyPlan({ mode: "vivid", seed: "x", campaign: true }).intro, "reinforcements");
  assert.equal(campaignMission({ missionDef: { id: "m01" }, terrain: {} }), true);
  assert.equal(campaignMission({ missionDef: { id: "c1", challenge: true }, terrain: {} }), false);
  assert.equal(campaignMission({ terrain: {} }), false, "a skirmish");
});

test("Settings > Hero > Sky: Vivid by default, Calm and Burning world, saved on this device; the view follows it", async () => {
  assert.equal(defaults().heroSky, "vivid");
  assert.equal(defaults(true).heroSky, "vivid", "phones too");
  assert.equal(normalize({ version: 1 }).heroSky, "vivid", "an old save gets Vivid");
  for (const mode of ["calm", "vivid", "burning"]) assert.equal(normalize({ version: 1, heroSky: mode }).heroSky, mode);
  assert.equal(normalize({ version: 1, heroSky: "neon" }).heroSky, "vivid");
  const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(saveSettings({ ...defaults(), heroSky: "burning" }, storage), true);
  assert.equal(loadSettings(false, storage).heroSky, "burning", "kept");
  assert.equal(skyMode({}), "vivid");
  assert.equal(skyMode({ heroSky: "calm" }), "calm");
  // The view reads it every frame: switching to Calm takes the Vivid layers away at once.
  const v = fakeView({ hero: true, sky: "vivid" }), plugin = new HorizonView(v);
  plugin.update(fakeSim(), 0.016);
  await plugin.loading;
  artReady(plugin.sky);
  plugin.update(fakeSim(), 0.016);
  assert.equal(plugin.state.mode, "vivid");
  assert.ok(plugin.state.bodies && plugin.state.orbit && !plugin.state.planets, "Vivid: its bodies and orbital layer, not the Calm planets");
  v.settings.heroSky = "calm";
  plugin.update(fakeSim(), 0.016);
  assert.deepEqual(visible(v.scene), ["horizon-dome", "horizon-planets", "horizon-ring"], "Calm: today's sky, nothing more");
  assert.equal(plugin.state.draws, 3);
});

test("placement: every body in the band the Hero camera sees, big ones at the sides of the key art's view, clear of its middle", () => {
  for (const b of VIVID_BODIES) {
    assert.ok(b.el >= BAND.low && b.el <= BAND.high, `${b.name}: centre ${b.el} in 5-15 degrees`);
    assert.ok(b.el + b.d / 2 <= BAND.pc + 0.3, `${b.name}: top ${(b.el + b.d / 2).toFixed(1)} inside a PC's sky`);
    // phones: smaller and lower, so they stay inside a landscape phone's 12 degrees
    const { el, d } = phoneBody(b);
    assert.ok(el - d / 2 >= -1 && el + d / 2 <= BAND.landscape && d >= b.d * 0.6, `${b.name}: phone ${(el - d / 2).toFixed(1)}..${(el + d / 2).toFixed(1)}`);
    // the key art's view (a PC shows +-40 degrees): nothing right over the middle
    if (Math.abs(b.u) < 45) assert.ok(Math.abs(b.u) - b.d / 2 >= 8 || b.sun, `${b.name} keeps clear of the middle`);
  }
  const big = VIVID_BODIES.filter((b) => b.d >= 12);
  assert.ok(big.length >= 2 && big.length <= 3, "one or two very large bodies a side");
  assert.ok(big.some((b) => Math.abs(b.u) < 45) && big.some((b) => Math.abs(b.u) > 120), "one in the key art's view, one behind");
  // Bigger than the Calm sky's: the ringed world's disc (Calm: 59% of a 16.5 degree cell).
  assert.ok(VIVID_BODIES.find((b) => b.name === "ringed").d > 16.5 * 0.594 * 1.25, "the ringed world bigger than today");
  for (const s of [stageOf(false), stageOf(true)]) assert.ok(s.el >= BAND.low && s.el + s.d / 2 <= BAND.pc && Math.abs(s.u) >= 20, `the event's stage ${JSON.stringify(s)}`);
  assert.ok(stageOf(true).el + stageOf(true).d / 2 <= BAND.landscape, "and on a phone");
  // The orbital ring: a wide low arch, its top inside the sky a PC sees, rising from the horizon at both sides.
  assert.ok(ringEl(ORBIT.apex) + ORBIT.height / 2 <= BAND.pc && ringEl(ORBIT.apex, PHONE_FIT.ringTop) + ORBIT.height / 2 <= BAND.landscape);
  assert.ok(ringEl(ORBIT.apex - ORBIT.half + 1) < 1 && ringEl(ORBIT.apex + ORBIT.half - 1) < 1, "its feet at the horizon");
  // The far war and the armada's ships low in the band, over the hills.
  for (const c of WAR.clusters) assert.ok(c.el[0] >= 4 && c.el[1] <= 12, JSON.stringify(c));
  assert.ok(ARMADA.el[0] >= 4 && ARMADA.el[1] <= 11);
});

test("draws: Vivid adds at most 3 over today's Calm sky (6 in all); looking down from the air only the dome; nothing in the RTS view", async () => {
  const v = fakeView({ hero: true, sky: "vivid" }), plugin = new HorizonView(v), sim = fakeSim();
  plugin.forceEvent = "shattered";
  plugin.update(sim, 0.016);
  await plugin.loading;
  artReady(plugin.sky);
  plugin.update(sim, 0.016);
  assert.deepEqual(visible(v.scene), ["horizon-bodies", "horizon-dome", "horizon-event", "horizon-meteors", "horizon-orbital", "horizon-ring"]);
  assert.equal(plugin.state.draws, 6, "dome, ring, bodies, orbital layer, meteors, event");
  // A meteor shower has no event mesh (its meteors are the event).
  plugin.forceEvent = "shower";
  plugin.update(sim, 0.016);
  assert.equal(plugin.state.draws, 5);
  assert.equal(plugin.sky.vivid.meteors.geometry.instanceCount, METEORS.shower.slots, "many meteors in a shower, one instanced draw");
  plugin.forceEvent = "aurora";
  plugin.update(sim, 0.016);
  assert.equal(plugin.sky.vivid.meteors.geometry.instanceCount, METEORS.normal.slots, "a few otherwise");
  // Skywing flying: the camera looks 52 degrees down and no sky shows: only the dome.
  v.camera.rotation.set(-52 * DEG, 0, 0, "YXZ"); v.camera.fov = 54; v.camera.updateMatrixWorld();
  plugin.update(sim, 0.016);
  assert.deepEqual(visible(v.scene), ["horizon-dome"]);
  assert.equal(plugin.state.draws, 1);
  v.heroCameraOn = false;
  plugin.update(sim, 0.016);
  assert.deepEqual(visible(v.scene), [], "the RTS view draws none of it");
  assert.equal(plugin.state.draws, 0);
  // Every Vivid layer is far, unpicked and out of the shadow pass, behind the battlefield.
  for (const m of meshes(v.scene)) {
    assert.ok(!m.castShadow && !m.receiveShadow && !m.frustumCulled, m.name);
    const hits = [];
    m.raycast(new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)), hits);
    assert.equal(hits.length, 0, `${m.name} is never picked`);
    if (/bodies|meteors|event|orbital/.test(m.name)) {
      assert.match(m.material.vertexShader, /p\.z = p\.w;/, `${m.name} on the far plane`);
      assert.equal(m.material.depthWrite, false, m.name);
    }
  }
});

test("the governor: phones drop the far war at the first step; the rescue step drops the meteors, the event, the far war and the far ring", () => {
  const { v, s } = vividView();
  const plan = skyPlan({ mode: "vivid", seed: "g", force: "armada" });
  const run = (level, phone = false) => { v.closeLevel = level; s.vivid.phone = phone; s.update({}, 0.05, true, { mode: "vivid", plan, seed: "g" }); return pick(s.state, "ring", "bodies", "meteors", "event", "orbit", "war"); };
  assert.deepEqual(run("full"), { ring: true, bodies: true, meteors: true, event: true, orbit: true, war: 1 });
  assert.equal(run("calm", true).war, 0, "a phone drops the war at the first step");
  assert.equal(run("calm", false).war, 1, "a PC keeps it");
  assert.deepEqual(run("rescue"), { ring: false, bodies: true, meteors: false, event: false, orbit: true, war: 0 }, "rescue: meteors, event, war and far ring go first");
  // the Calm sky's rescue is as before (the dome only)
  s.update({}, 0.05, true, { mode: "calm", plan: skyPlan({ mode: "calm" }), seed: "g" });
  assert.deepEqual(visible(v.scene), ["horizon-dome"]);
});

test("reduced motion shows everything still: no pulse, scroll, meteors, shockwave, fire in the war or sky flash", () => {
  const plan = skyPlan({ mode: "vivid", seed: "r", force: "shattered" });
  const run = (reduced) => {
    const { s } = vividView({ reduced });
    for (let i = 0; i < 400; i++) s.update({}, 0.1, true, { mode: "vivid", plan, seed: "r" });
    return { time: s.uniforms.uTime.value, meteors: s.state.meteors, shock: s.uniforms.uShock.value.y, shocks: s.state.shocks, war: s.uniforms.uWar.value.slice() };
  };
  const live = run(false), still = run(true);
  assert.ok(live.time > 15 && live.meteors && live.shock === 1 && live.shocks >= 1, `lively: ${JSON.stringify({ ...live, war: 0 })}`);
  assert.equal(still.time, 0, "the clock stands still (no pulse, scroll or drift)");
  assert.equal(still.meteors, false, "no meteors");
  assert.equal(still.shock, 0, "no shockwave");
  for (let i = 0; i < WAR_SLOTS; i++) { const kind = still.war[i * 8 + 6], alpha = still.war[i * 8 + 3]; if (kind === WAR_KIND.beam || kind === WAR_KIND.bloom || kind === WAR_KIND.flak) assert.equal(alpha, 0, "no beams, blooms or flak"); }
  assert.ok([...Array(WAR_SLOTS).keys()].some((i) => still.war[i * 8 + 6] === WAR_KIND.ship && still.war[i * 8 + 3] > 0), "the far warships stay, still");
  // No sky flash under reduced motion, in the Calm sky or outside Hero mode.
  const view = fakeView({ hero: true, sky: "vivid", reduced: true }), plugin = new HorizonView(view);
  plugin.state.on = true;
  plugin.event({ type: "death", building: true, x: 2, z: 2 }, { isVisible: () => true });
  assert.equal(plugin.flash.flashes, 0, "reduced motion: no flash");
  view.reducedMotion.matches = false;
  plugin.planFor.mode = "calm";
  plugin.event({ type: "death", building: true, x: 2, z: 2 }, { isVisible: () => true });
  assert.equal(plugin.flash.flashes, 0, "Calm: no flash");
  plugin.state.on = false;
  plugin.planFor.mode = "vivid";
  plugin.event({ type: "death", building: true, x: 2, z: 2 }, { isVisible: () => true });
  assert.equal(plugin.flash.flashes, 0, "outside Hero mode: no flash");
  plugin.state.on = true;
  plugin.event({ type: "death", building: true, x: 2, z: 2 }, { isVisible: () => false });
  assert.equal(plugin.flash.flashes, 0, "a blast in the fog gives nothing away");
  plugin.event({ type: "death", building: true, x: 2, z: 2 }, { isVisible: () => true });
  assert.equal(plugin.flash.flashes, 1, "Vivid: a flash");
});

test("the sky answers the battle: big and near blasts flash more, about 0.3 s up and 1.2 s down, one at a time, rate-limited", () => {
  assert.equal(blastSize({ type: "death", core: true }), 1);
  assert.ok(blastSize({ type: "death", building: true }) > blastSize({ type: "hazardBlast" }) && blastSize({ type: "hazardBlast" }) > blastSize({ type: "shot", weapon: "tank" }));
  assert.equal(blastSize({ type: "shot", weapon: "ranger" }), 0, "a rifle round is no blast");
  assert.equal(blastSize({ type: "death" }), 0, "a soldier falling is no blast");
  assert.ok(blastStrength(1, 5) > blastStrength(1, 40) && blastStrength(1, 40) > 0, "nearer is stronger");
  const f = new SkyFlash();
  assert.equal(f.trigger(0.8), true);
  f.advance(FLASH.rise);
  assert.ok(Math.abs(f.value() - 0.8) < 1e-9, "up in 0.3 s");
  f.advance(FLASH.fall / 2);
  assert.ok(f.value() > 0 && f.value() < 0.8, "falling");
  f.advance(FLASH.fall / 2 + 0.01);
  assert.equal(f.value(), 0, "gone after 1.2 s");
  // A heavy battle: blasts every 0.1 s start a flash at most every FLASH.gap seconds (a flicker, never a strobe).
  const g = new SkyFlash();
  let starts = 0;
  for (let i = 0; i < 100; i++) { if (g.trigger(0.3 + 0.6 * ((i * 0.7) % 1))) starts++; g.advance(0.1); }
  assert.ok(starts <= Math.ceil(10 / FLASH.gap) && starts >= 3, `${starts} flashes in 10 s`);
  const h = new SkyFlash();
  h.trigger(0.9); h.advance(FLASH.gap + 0.01);
  assert.equal(h.trigger(0.2), false, "never weaker than the glow still showing");
  assert.equal(new SkyFlash().trigger(0.01), false, "too faint to see");
  // The dome takes it as one warm uniform (+0 draws), the Calm sky never.
  const { s } = vividView();
  s.update({}, 0.016, true, { mode: "vivid", plan: skyPlan({ mode: "vivid", seed: "b" }), seed: "b", blast: 1 });
  assert.ok(s.uniforms.uBlast.value.r > s.uniforms.uBlast.value.b && s.uniforms.uBlast.value.r > 0.3, "warm orange");
  s.update({}, 0.016, true, { mode: "calm", plan: skyPlan({ mode: "calm" }), seed: "b", blast: 1 });
  assert.equal(s.uniforms.uBlast.value.r, 0);
  assert.match(s.dome.material.fragmentShader, /uBlast/);
});

test("Vivid colours: dark indigo to violet on every land, day or night; night and storm darker still; the land's warm or teal glow", () => {
  const sky = (look, id = "riverlands") => { const v = fakeView({ hero: true, look, id, sky: "vivid" }), s = new HorizonSky(v, { atlasUrl: null }); s.update({}, 0, true, { mode: "vivid", plan: skyPlan({ mode: "vivid", seed: "c" }), seed: "c" }); return s; };
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  for (const id of Object.keys(SKIES)) {
    const s = sky(null, id), z = s.uniforms.uVZenith.value, low = s.uniforms.uVLow.value;
    assert.ok(z.b > z.g && low.b > low.g && low.r > low.g, `${id}: indigo-violet ${z.getHexString()} / ${low.getHexString()}`);
    assert.ok(lum(z) > 0.001 && lum(z) < 0.02, `${id}: dark, not black`);
    assert.equal(s.uniforms.uVivid.value, 1);
  }
  const day = sky(null).uniforms, night = sky("night").uniforms, storm = sky("storm").uniforms;
  assert.ok(lum(night.uVZenith.value) < lum(day.uVZenith.value) && lum(storm.uVZenith.value) < lum(day.uVZenith.value), "night and storm darker");
  assert.ok(night.uNebK.value > day.uNebK.value && day.uNebK.value > 0, "the nebula strongest at night, a veil by day");
  assert.equal(sky(null, "dunes").state.band, "warm");
  assert.equal(sky(null, "riverlands").state.band, "teal");
  // The water in Hero view reflects this dome: its hue, as bright as the backdrop's own sky.
  const s = sky(null), W = s.water, back = s.view.backdrop.material.userData.sky;
  assert.ok(W.ready && Math.abs(lum(W.zenith) - lum(back.zenith)) < 1e-6 && W.zenith.b > W.zenith.g, `water zenith ${W.zenith.getHexString()}`);
});

test("the armada: 2-4 capital ships cross the far sky in 60-90 s, one or two land behind the hills and a landing flare blooms", () => {
  for (let n = 0; n < 30; n++) {
    const plan = armadaPlan(`a${n}`);
    assert.ok(plan.ships.length >= 2 && plan.ships.length <= 4);
    assert.deepEqual(plan, armadaPlan(`a${n}`), "seeded");
    const landers = plan.ships.filter((s) => s.land !== null);
    assert.ok(landers.length >= 1 && landers.length <= 2);
    for (const s of plan.ships) assert.ok(s.dur >= 60 && s.dur <= 90);
    let flare = 0, lowest = 99, seen = 0;
    for (let t = 0; t < plan.period; t += 0.25) {
      const p = armadaPose(plan, t);
      flare = Math.max(flare, p.flare.k);
      for (const [i, o] of p.ships.entries()) if (o.alpha > 0.02) { seen = Math.max(seen, i + 1); if (plan.ships[i].land !== null) lowest = Math.min(lowest, o.el); }
    }
    assert.ok(flare > 0.95, "the flare blooms");
    assert.ok(lowest < 0, "a lander sinks below the horizon (behind the hills)");
    assert.equal(seen, plan.ships.length, "every ship shows");
  }
  const still = armadaPose(armadaPlan("s"), ARMADA.still);
  assert.ok(still.ships.some((o) => o.alpha > 0.5), "a still sky holds ships in view");
  const fleet = armadaPlan("f", { reinforcements: true, fleet: "hauler" });
  assert.ok(fleet.ships.every((s) => s.type === "hauler") && fleet.ships.filter((s) => s.land !== null).length === 2, "reinforcements: the player's own ships, two landing");
});

test("the far space war: short beam dashes, round blooms and flak a few times a minute, a wreck now and then; never units", () => {
  const plan = warPlan("w"), out = new Float32Array(WAR_SLOTS * 8);
  let blooms = 0, flak = 0, wreck = 0, longest = 0, prev = 0;
  for (let t = 0; t < 300; t += 0.1) {
    warPose(plan, t, out, prev); prev = t;
    for (let i = 0; i < WAR_SLOTS; i++) {
      const o = i * 8, kind = out[o + 6], alpha = out[o + 3];
      if (kind === WAR_KIND.beam && alpha > 0) longest = Math.max(longest, out[o + 2]);
      if (kind === WAR_KIND.bloom && alpha > 0 && out[o + 4] === 0) blooms++;
      if (kind === WAR_KIND.flak && alpha > 0.99) flak++;
      if (kind === WAR_KIND.wreck && alpha > 0.5) wreck++;
    }
  }
  assert.ok(longest > 0 && longest <= 80 / 20, `beams are short dashes (${longest.toFixed(1)} degrees, 1/20 of a PC's sky width at most)`);
  assert.ok(blooms > 0 && flak > 0 && wreck > 0, JSON.stringify({ blooms, flak, wreck }));
  // Each slot pose is written in place: nothing allocated per frame, the same at the same time.
  const a = new Float32Array(WAR_SLOTS * 8), b = new Float32Array(WAR_SLOTS * 8);
  warPose(warPlan("w"), 123.4, a); warPose(warPlan("w"), 123.4, b);
  assert.deepEqual([...a], [...b]);
  // The sky is view only: none of it reaches the simulation (the modules never import it).
  for (const file of ["sky-war.js", "sky-events.js", "horizon-vivid.js", "victory-fireworks.js"]) assert.doesNotMatch(readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"), /from "\.\/sim\/|simulation\.js/, file);
});

test("victory fireworks: only on a win in a match Hero mode was used in, seeded, beside the middle; still glows under reduced motion", () => {
  const sim = { ...fakeSim(), result: "victory" };
  assert.equal(fireworksFor(sim, sim), true);
  assert.equal(fireworksFor({ ...sim, result: "defeat" }, sim), false, "never on a defeat");
  assert.equal(fireworksFor(sim, null), false, "not without Hero mode");
  assert.equal(fireworksFor(sim, { ...sim }), false, "Hero mode in another match does not count");
  const plan = fireworksPlan("x");
  assert.deepEqual(plan, fireworksPlan("x"), "seeded");
  assert.ok(plan.length >= FIREWORKS.bursts[0] && plan.at(-1).at <= FIREWORKS.seconds, `${plan.length} bursts in ${plan.at(-1).at.toFixed(1)} s`);
  for (const b of plan) assert.ok(Math.abs(b.side) >= FIREWORKS.side[0] && b.y >= FIREWORKS.height[0], "beside the middle, high");
  // In a view: pooled glow particles, started once; nothing on a defeat; still glows with reduced motion.
  const make = (result, reduced, hero) => {
    const particles = [], layer = { spawn: () => { const p = {}; particles.push(p); return p; } };
    const fx = { glow: layer, touchTier: false, emit: (l, x, y, z) => { const p = l.spawn(); Object.assign(p, { x, y, z, vx: 0, vy: 0, vz: 0, age: 0 }); return p; }, advancePools: () => {} };
    let now = 0;
    const s = { ...fakeSim(), result };
    const view = { fx, colors: [0x92ebc5], focus: { x: 0, z: 0 }, camera: { position: { x: 0, y: 30, z: 30 } }, reducedMotion: { matches: reduced }, horizon: { heroSim: hero ? s : null } };
    const fw = new VictoryFireworks(view, { clock: () => now });
    for (let i = 0; i < 120; i++) { now += 100; fw.update(s, 0); }
    return { fw, particles };
  };
  const win = make("victory", false, true);
  assert.equal(win.fw.state.bursts, win.fw.state.planned, "every burst went off (on real time, behind the paused results)");
  assert.ok(win.particles.length > 100 && win.particles.some((p) => Math.hypot(p.vx, p.vy, p.vz) > 5), "flash, spark shell and glitter");
  assert.ok(win.particles.every((p) => p.keep), "the effects' particle trim never thins them");
  assert.equal(make("defeat", false, true).particles.length, 0, "defeat: none");
  assert.equal(make("victory", false, false).particles.length, 0, "no Hero mode: none");
  const still = make("victory", true, true);
  assert.equal(still.particles.length, FIREWORKS.still, "reduced motion: a few glows");
  assert.ok(still.particles.every((p) => p.vx === 0 && p.vy === 0 && p.vz === 0 && p.life >= 5), "still");
});

test("a campaign mission opens with the player's fleet landing, then its own event; a new match starts the sky's clock again", async () => {
  const v = fakeView({ hero: true, sky: "vivid" }), plugin = new HorizonView(v), sim = { ...fakeSim(), missionDef: { id: "m01" } };
  plugin.update(sim, 0.016);
  await plugin.loading;
  artReady(plugin.sky);
  plugin.update(sim, 0.016);
  assert.equal(plugin.state.eventId, "armada", "reinforcements landing");
  assert.equal(plugin.state.intro, true);
  assert.equal(plugin.state.plan.fleet, "cruiser", "Meridian's own cruisers");
  plugin.sky.time = ARMADA.intro + 1;
  plugin.update(sim, 0.016);
  assert.equal(plugin.state.intro, false);
  assert.equal(plugin.state.eventId, pickEvent(skySeed(sim)), "then the mission's own seeded event");
  plugin.update({ ...sim }, 0.016);
  assert.ok(plugin.sky.time < 1 && plugin.state.intro, "a new match: the clock from 0, the fleet again");
});
