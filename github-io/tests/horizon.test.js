// The Hero-view horizon (owner 2026-11-28; src/horizon-view.js, src/horizon-sky.js): a sky dome, far mountains or sea
// and the key art's planets, built only on the first Hero mode entry. The browser side (screenshots, the RTS pixel guard,
// real WebGL draws) is in tests/skywing-land.mjs.
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

const DEG = Math.PI / 180;
// A view as the plugin sees it: a scene, a perspective hero camera (or not), a terrain with its backdrop, the look.
function fakeView({ id = "riverlands", hero = false, look = null, k = 1, settings = {}, reduced = false, motion = 2, level = "full", pitch = -13 } = {}) {
  const terrain = new Terrain(id), scene = new THREE.Scene(), backdrop = createMapEdge(terrain);
  const camera = new THREE.PerspectiveCamera(56, 1.6, 0.3, 140);
  camera.position.set(0, 4, 0);
  camera.rotation.set(pitch * DEG, 0, 0, "YXZ");
  camera.updateMatrixWorld();
  scene.add(backdrop);
  return {
    scene, terrain, backdrop, camera, settings: { detail: true, ...settings },
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
  const sky = (look, k = 1, id = "riverlands") => { const v = fakeView({ hero: true, look, k, id }), s = new HorizonSky(v, { atlasUrl: null }); s.update({}, 0, true); return s.uniforms; };
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
  s.update({}, 0, true);
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
