// Readable armies at strategic zoom (src/army-readability-view.js, W1-D, idea P3): a view plugin that grows
// units from 1.0 at zoom 40 to 1.6 at zoom 90 and above. View only: the plugin never reads or writes the
// simulation, and below zoom 40 it returns nothing, so every frame is drawn as before.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { WorldView } from "../src/view.js";
import { ViewPlugins, VIEW_PLUGINS } from "../src/view-plugins.js";
import { ArmyReadabilityView, ARMY_SCALE, armyScale } from "../src/army-readability-view.js";
import { Simulation } from "../src/simulation.js";

test("the scale is 1 up to zoom 40, linear to 1.6 at zoom 90, and 1.6 beyond", () => {
  assert.deepEqual(ARMY_SCALE, { from: 40, to: 90, max: 1.6 });
  for (const zoom of [0, 20, 30, 38, 40]) assert.equal(armyScale(zoom), 1, `zoom ${zoom}`);
  assert.ok(Math.abs(armyScale(65) - 1.3) < 1e-12, "halfway");
  assert.ok(Math.abs(armyScale(90) - 1.6) < 1e-12);
  for (const zoom of [92, 105, 400]) assert.equal(armyScale(zoom), 1.6, `zoom ${zoom}`);
  let last = 1;
  for (let zoom = 40; zoom <= 100; zoom += 2.5) { const k = armyScale(zoom); assert.ok(k >= last, "never shrinks as zoom grows"); last = k; }
  assert.equal(armyScale(Number.NaN), 1, "an unknown zoom leaves the size alone");
});

test("the plugin is registered, scales units only, and says nothing at the default zoom", () => {
  assert.ok(VIEW_PLUGINS.includes(ArmyReadabilityView));
  const plugin = new ArmyReadabilityView({ zoom: 92 });
  const view = (zoom) => ({ zoom });
  assert.equal(plugin.frameScaleFor({ kind: "unit" }, {}, view(92)), 1.6);
  assert.equal(plugin.frameScaleFor({ kind: "unit" }, {}, view(38)), undefined, "default zoom: not returned at all");
  assert.equal(plugin.frameScaleFor({ kind: "unit" }, {}, view(40)), undefined);
  assert.equal(plugin.frameScaleFor({ kind: "building" }, {}, view(92)), undefined, "buildings keep their size");
  assert.equal(plugin.frameScaleFor({ kind: "unit", boss: true }, {}, view(92)), undefined, "bosses are W2-F's");
  assert.equal(plugin.scaleFor, undefined, "no static scale");
});

// A WorldView with only what createEntity and update touch (as tests/view-plugins.test.js does).
function staged(plugins, zoom, type = "tank") {
  const sim = new Simulation({ ai: false });
  sim.visible[0].fill(1); sim.explored[0].fill(1);
  const e = sim.spawn(type, 0, -20, 19);
  sim.entities = [e];
  const template = new THREE.Group();
  template.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.7, 0.6), new THREE.MeshBasicMaterial()));
  const view = Object.create(WorldView.prototype), stub = () => {};
  Object.assign(view, {
    teamTemplates: new Map([[`${type}-0`, template]]), contactShadowGeometries: new Map(), contactShadowMaterial: new THREE.MeshBasicMaterial(),
    lowPower: true, camera: new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 240), frameHeight: 800, defaultZoom: 38, zoom, mission: null,
    buildingTops: new Map(), colors: [0x3fa7ff, 0xff5a3a], scene: new THREE.Scene(), objects: new Map(), models: new Map(),
    settings: {}, reducedMotion: { matches: true }, cameraCue: false, contextLost: false, shake: { step() {}, add() {}, trauma: 0 }, hitStop: 0,
    motionLevel: 2, pulsing: [], lifeClock: 0, previous: new Map(), previousTime: -1, terrain: { heightAt: () => 0 }, fogClock: 1e9,
    effects: [], dying: [], resourceObjects: new Map(), flashBatch: [], flashBatchTime: -1, width: 800, height: 600, barScale: 1, barTall: 1, unitsPerPixel: 0.1,
    activity: { combat: { motion: false }, draw: stub, event: stub, reset: stub }, tactics: { update: stub, event: stub, reset: stub },
    bosses: { dress() {}, event: stub, update() {}, reset: stub }, fx: { update: stub },
    renderer: { shadowMap: { enabled: false }, setViewport() {}, render: stub, getPixelRatio: () => 1 },
    sun: { castShadow: false }, batches: { begin() {}, collect() {}, end() {} }, focusOn() {}, updateCamera() {},
  });
  view.plugins = new ViewPlugins(view, plugins);
  return { e, view, frame: () => view.update(sim, 0.016, new Set([e.id]), null) };
}

test("on a real WorldView a unit grows with the zoom, its bar rides with it, and the default zoom is as before", () => {
  const bare = staged([], 38), at92 = staged([ArmyReadabilityView], 92), at38 = staged([ArmyReadabilityView], 38);
  const u0 = bare.view.createEntity(bare.e).userData, u92 = at92.view.createEntity(at92.e).userData, u38 = at38.view.createEntity(at38.e).userData;
  bare.frame(); at92.frame(); at38.frame();
  const rs = u0.readabilityScale;
  assert.equal(u92.readabilityScale, rs, "the clamp is untouched: the plugin scales per frame, not at creation");
  assert.equal(u92.model.scale.y, rs * 1.6);
  assert.equal(u92.model.scale.x, rs * 1.6);
  assert.equal(u92.bar.position.y, u0.bar.position.y * 1.6, "the vitals bar rides with the model");
  // Default zoom: exactly the unscaled frame, no new state.
  assert.equal(u38.model.scale.y, u0.model.scale.y);
  assert.equal(u38.bar.position.y, u0.bar.position.y);
  assert.equal(u38.barRest, undefined);
  // The simulation entity is the same object it was: the plugin only reads it.
  assert.equal(at92.e.radius, bare.e.radius);
  // Zooming back out restores the size.
  at92.view.zoom = 38;
  at92.frame();
  assert.equal(u92.model.scale.y, rs);
});

test("a building on the same view keeps its size at strategic zoom", () => {
  const at92 = staged([ArmyReadabilityView], 92, "barracks"), bare = staged([], 92, "barracks");
  const a = at92.view.createEntity(at92.e).userData, b = bare.view.createEntity(bare.e).userData;
  at92.frame(); bare.frame();
  assert.equal(a.model.scale.y, b.model.scale.y);
});
