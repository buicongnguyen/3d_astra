// AAA round 3, R3-D: night and storm looks (view only). The browser side is tests/night-storm.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import GRADE from "../src/look-grade.json" with { type: "json" };
import STYLE from "../src/visual-style.json" with { type: "json" };
import { LOOKS, MISSION_LOOKS, missionLook, rampAt, flashAt, WEATHER } from "../src/mission-looks.js";
import { gradeFor, gradeChunk } from "../src/look-grade.js";
import { edgeColor, tintEdge } from "../src/map-edge.js";
import { NightSky, piecesFor, starField } from "../src/night-sky.js";
import { MissionLook, NIGHT_GLOW } from "../src/mission-look-view.js";
import { stormLevel } from "../src/ambience.js";

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const sim = (id, time = 0) => ({ missionDef: { id }, time });

test("m06's storm gathers over the first 90 s, holds, and breaks in full at 16:00", () => {
  const k = (t) => missionLook(sim("m06-copper-harvest", t)).k;
  assert.equal(k(0), 0.35);
  assert.ok(k(30) > 0.45 && k(30) < 0.55, `k(30) ${k(30)}`);
  assert.equal(k(90), 0.75);
  assert.equal(k(600), 0.75);
  assert.equal(k(2000), 1);
  for (let t = 0; t < 1100; t += 5) assert.ok(k(t + 5) >= k(t), `k falls at ${t}`);
  assert.equal(rampAt([[10, 0.2], [20, 1]], 0), 0.2);
  assert.ok(Math.abs(rampAt([[10, 0.2], [20, 1]], 15) - 0.6) < 1e-12);
  // the table still holds only existing ids or the Chronicle (no field on any mission definition)
  // Map variety (2026-11-24): Gun Hill (m06c) at night and Canyon Run (m04b) at dusk joined the table.
  assert.deepEqual(Object.keys(MISSION_LOOKS).sort(), ["cv1-night-count", "m04b-canyon-run", "m06-copper-harvest", "m06c-gun-hill", "m08-the-quiet-vault", "m10-obsidian-storm", "m10e-the-ember-roost"]);
});

test("the night grade has blue-black shadows and less saturation; other looks fall back to the theme", () => {
  const day = gradeFor("classic"), night = gradeFor("classic", GRADE, "night"), storm = gradeFor("classic", GRADE, "storm");
  assert.ok(night.shadowTint[2] > 0 && night.shadowTint[0] < 0, "night shadows lean blue, not warm");
  assert.ok(night.shadowTint[1] >= night.shadowTint[0], "green over red: no purple");
  assert.ok(night.saturation < day.saturation);
  assert.ok(storm.shadowTint[2] > storm.shadowTint[0]);
  assert.deepEqual(gradeFor("classic", GRADE, "dusk"), day);
  assert.notEqual(gradeChunk(night), gradeChunk(day));
});

test("night colours carry no purple, and the map edge of every theme turns black-blue at night", () => {
  for (const key of ["sky", "fog", "ambient", "bounce", "sun"]) {
    const [r, g, b] = rgb(LOOKS.night[key]);
    assert.ok(b > r && g >= r, `night ${key} ${LOOKS.night[key]}`);
  }
  const lo = new THREE.Color(LOOKS.night.edge.low), hi = new THREE.Color(LOOKS.night.edge.high);
  for (const [id, theme] of Object.entries(STYLE.themes)) for (const key of ["cliff", "cliffDeep", "outland", "outlandNear", "sky", "dirt"]) {
    if (!theme[key]) continue;
    const c = new THREE.Color(theme[key]), [r, g, b] = edgeColor([c.r, c.g, c.b], [lo.r, lo.g, lo.b], [hi.r, hi.g, hi.b], 1);
    assert.ok(b > r && g >= r && 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.1, `${id}.${key} at night: ${[r, g, b].map((v) => v.toFixed(3))}`);
  }
  // k = 0 puts the day colours back exactly
  const geometry = new THREE.BufferGeometry(), day = new Float32Array([0.8, 0.3, 0.1, 0.2, 0.1, 0.05]);
  geometry.setAttribute("color", new THREE.BufferAttribute(day.slice(), 3));
  const mesh = new THREE.Mesh(geometry);
  tintEdge(mesh, LOOKS.night.edge, 1);
  assert.ok(geometry.attributes.color.array[2] > geometry.attributes.color.array[0]);
  tintEdge(mesh, null, 0);
  assert.deepEqual([...geometry.attributes.color.array], [...day]);
});

// A battlefield view stub with what MissionLook and NightSky read.
function stubView({ lowPower = false, calm = false } = {}) {
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, 240), terrainRoot = new THREE.Group();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0x123f63, 105, 190);
  camera.position.set(25, 51, 43); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const backdrop = new THREE.Mesh(new THREE.BufferGeometry());
  backdrop.name = "backdrop";
  backdrop.geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array([0.8, 0.3, 0.1]), 3));
  terrainRoot.add(backdrop);
  scene.add(terrainRoot);
  const glass = new THREE.MeshStandardMaterial({ name: "Windows.001", emissive: 0xffc070, emissiveIntensity: 0.6 });
  const template = new THREE.Group();
  template.add(new THREE.Mesh(new THREE.BoxGeometry(), glass));
  return {
    scene, camera, terrainRoot, lowPower, motionLevel: calm ? 0 : 2, reducedMotion: { matches: false },
    terrain: { id: "classic", half: 48 }, focus: new THREE.Vector3(), width: 800, height: 600,
    renderer: { getPixelRatio: () => 1, toneMappingExposure: 1 },
    baseLight: { sky: "#123f63", fog: "#0b2236", ambient: "#a9d4ff", bounce: "#7a6a3a", sun: "#fff0d6", ambientI: 1, sunI: 2, exposure: 1 },
    ambientLight: new THREE.HemisphereLight(), sun: new THREE.DirectionalLight(),
    fogUniforms: { uFogColor: { value: new THREE.Color() } }, tintFog() {}, regrade() {},
    pulsing: [], teamTemplates: new Map([["hq-0", template]]), glass,
  };
}

test("night adds a moon and stars, a storm adds rain and (High only) cloud shade: one draw each, at most 6", () => {
  assert.deepEqual(piecesFor(LOOKS.night), ["moon", "stars"]);
  assert.deepEqual(piecesFor(LOOKS.storm), ["rain", "clouds"]);
  assert.deepEqual(piecesFor(LOOKS.storm, true), ["rain"]);
  assert.deepEqual(piecesFor(LOOKS.dusk), []);
  for (const def of Object.values(LOOKS)) assert.ok(piecesFor(def).length <= 6);
  for (const [look, lowPower, want] of [["night", false, ["moon", "stars"]], ["storm", false, ["rain", "clouds"]], ["storm", true, ["rain"]]]) {
    const view = stubView({ lowPower }), sky = new NightSky(view);
    sky.update(LOOKS[look], 1, 10, false);
    assert.deepEqual(sky.shown.sort(), [...want].sort(), `${look} ${lowPower ? "eco" : "high"}`);
    let drawables = 0;
    sky.root.traverse((o) => { if (o.isMesh || o.isPoints || o.isLineSegments) drawables++; });
    assert.equal(drawables, want.length, "one drawable per piece");
    sky.update(null, 0, 10, false);
    assert.deepEqual(sky.shown, [], "a day frame shows none");
    sky.dispose();
  }
  // the stars lie on the void, outside the playable square and under the map's top
  const { positions } = starField(48, 400);
  for (let i = 0; i < positions.length; i += 3) {
    assert.ok(Math.max(Math.abs(positions[i]), Math.abs(positions[i + 2])) > 48, "star over the map");
    assert.ok(positions[i + 1] < 0);
  }
});

test("motion-off turns the lightning off and holds the sky still; glows reach Window* lamps by name", () => {
  const def = LOOKS.storm, flashTime = Array.from({ length: 400 }, (_, i) => i / 4).find((t) => flashAt(t, def.flash) > 0.6);
  assert.ok(flashTime !== undefined);
  const lively = new MissionLook(stubView()), calm = new MissionLook(stubView({ calm: true }));
  lively.update(sim("m10-obsidian-storm", flashTime));
  assert.ok(lively.state.flash > 0.5 && WEATHER.flash > 0.5, "a strike flashes with motion on");
  assert.equal(WEATHER.name, "storm");
  calm.update(sim("m10-obsidian-storm", flashTime));
  assert.equal(calm.state.flash, 0);
  assert.equal(WEATHER.flash, 0, "no flash with motion off");
  const frozen = calm.sky.pieces.rain.material.uniforms.uTime.value;
  calm.update(sim("m10-obsidian-storm", flashTime + 3));
  assert.equal(calm.sky.pieces.rain.material.uniforms.uTime.value, frozen, "rain held still");
  // the name contract: Window*/Lamp* emissive materials, not glass or team paint
  for (const name of ["Windows", "Windows.001", "Window_Hall", "Lamp", "Lamps.002"]) assert.ok(NIGHT_GLOW.test(name), name);
  for (const name of ["Glass", "TeamGlow", "Energy", "Baked"]) assert.ok(!NIGHT_GLOW.test(name), name);
  const view = stubView(), look = new MissionLook(view);
  look.update(sim("m08-the-quiet-vault", 5));
  assert.ok(Math.abs(view.glass.emissiveIntensity - 0.6 * LOOKS.night.glow) < 1e-9, "windows glow brighter at night");
  assert.ok(view.scene.getObjectByName("sky-moon")?.visible && view.scene.getObjectByName("sky-stars")?.visible);
  look.update({ missionDef: { id: "m01-first-light" }, time: 5 });
  assert.equal(view.glass.emissiveIntensity, 0.6, "and back by day");
  assert.equal(WEATHER.name, null);
});

test("the storm bed follows the rain and is silent when muted, with ambience off or paused", () => {
  const on = { muted: false, ambient: true, masterVolume: 1 };
  assert.equal(stormLevel(on, true, 0), 0);
  assert.ok(stormLevel(on, true, 1) > stormLevel(on, true, 0.4) && stormLevel(on, true, 0.4) > 0);
  assert.equal(stormLevel({ ...on, muted: true }, true, 1), 0);
  assert.equal(stormLevel({ ...on, ambient: false }, true, 1), 0);
  assert.equal(stormLevel(on, false, 1), 0);
  assert.ok(stormLevel({ ...on, masterVolume: 0.5 }, true, 1) < stormLevel(on, true, 1));
});
