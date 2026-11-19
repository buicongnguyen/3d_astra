// The view plugin seam (src/view-plugins.js, docs/VIEW_PLUGINS.md): WorldView calls each hook at its
// place, in registry order, and with no plugin it draws exactly as before. WorldView needs WebGL to
// be built, so these run its real methods on a view object with the parts they touch (three.js
// scene objects work headless); the browser proof is the held-clock render-budget screenshot.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { WorldView } from "../src/view.js";
import { ViewPlugins, VIEW_PLUGINS, HOOKS } from "../src/view-plugins.js";
import { Simulation } from "../src/simulation.js";

// Two fixture plugins writing every call to one log.
function fixtures(log, { scale = {}, frame = {} } = {}) {
  const make = (name) => class {
    constructor(view) { this.view = view; log.push(`${name} new`); }
    dress(root, e) { log.push(`${name} dress ${e.type}`); if (name === "A") { const badge = new THREE.Object3D(); badge.name = "badge"; root.add(badge); } }
    scaleFor(e) { log.push(`${name} scaleFor ${e.type}`); return scale[name]; }
    frameScaleFor(e, u, view) { log.push(`${name} frameScaleFor ${e.type} ${u === view.objects.get(e.id).userData}`); return frame[name]?.(); }
    event(ev, sim) { log.push(`${name} event ${ev.type} ${!!sim}`); }
    update(sim, dt) { log.push(`${name} update ${dt}`); }
    reset() { log.push(`${name} reset`); }
  };
  return [make("A"), make("B")];
}

// A WorldView with only what createEntity, update, event and reset touch, and a real ranger.
function staged(plugins, log = []) {
  const sim = new Simulation({ ai: false });
  sim.visible[0].fill(1); sim.explored[0].fill(1);
  const e = sim.spawn("ranger", 0, -20, 19);
  sim.entities = [e]; // the ranger alone on the field
  const template = new THREE.Group();
  template.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.7, 0.6), new THREE.MeshBasicMaterial()));
  const view = Object.create(WorldView.prototype);
  const stub = (name) => () => log.push(name);
  Object.assign(view, {
    teamTemplates: new Map([["ranger-0", template]]), contactShadowGeometries: new Map(), contactShadowMaterial: new THREE.MeshBasicMaterial(),
    lowPower: true, camera: new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 240), frameHeight: 800, defaultZoom: 38, mission: null,
    buildingTops: new Map(), colors: [0x3fa7ff, 0xff5a3a], scene: new THREE.Scene(), objects: new Map(), models: new Map(),
    settings: {}, reducedMotion: { matches: true }, cameraCue: false, contextLost: false, shake: { step() {}, add() {}, trauma: 0 }, hitStop: 0,
    motionLevel: 2, pulsing: [], lifeClock: 0, previous: new Map(), previousTime: -1, terrain: { heightAt: () => 0 }, fogClock: 1e9,
    effects: [], dying: [], resourceObjects: new Map(), flashBatch: [], flashBatchTime: -1, width: 800, height: 600, barScale: 1, barTall: 1, unitsPerPixel: 0.1,
    activity: { combat: { motion: false }, draw: stub("activity draw"), event: stub("activity event"), reset: stub("activity reset") },
    tactics: { update: stub("tactics update"), event: stub("tactics event"), reset: stub("tactics reset") },
    bosses: { dress() {}, event: stub("bosses event"), update() {}, reset: stub("bosses reset") }, fx: { update: stub("fx update") },
    renderer: { shadowMap: { enabled: false }, setViewport() {}, render: stub("render"), getPixelRatio: () => 1 },
    sun: { castShadow: false }, batches: { begin() {}, collect() {}, end() {} }, focusOn() {}, updateCamera() {}, defaultZoom: 38,
  });
  view.plugins = new ViewPlugins(view, plugins);
  return { sim, e, view, frame: (dt = 0.016) => view.update(sim, dt, new Set([e.id]), null) };
}

test("the registry is an append-only list of plugin classes, and a WorldView builds each once", () => {
  assert.ok(Array.isArray(VIEW_PLUGINS));
  for (const Plugin of VIEW_PLUGINS) assert.equal(typeof Plugin, "function");
  assert.equal(new Set(VIEW_PLUGINS).size, VIEW_PLUGINS.length, "one entry per plugin");
  assert.deepEqual(HOOKS, ["dress", "scaleFor", "frameScaleFor", "event", "update", "reset"]);
  const log = [], view = {};
  const host = new ViewPlugins(view, fixtures(log));
  assert.deepEqual(log, ["A new", "B new"]);
  assert.equal(host.list.length, 2);
  assert.ok(host.list.every((p) => p.view === view));
  // A plugin with only some hooks is called only for those.
  class Quiet { update() { log.push("quiet update"); } }
  const partial = new ViewPlugins(view, [Quiet]);
  assert.deepEqual(HOOKS.filter((h) => partial.with[h].length), ["update"]);
  assert.equal(partial.scaleFor({}), 1);
});

test("hooks run at their place in WorldView, in registry order", () => {
  const log = [];
  const { sim, e, view, frame } = staged(fixtures(log, { scale: { A: 2, B: 1.5 }, frame: { A: () => 1.25 } }), log);
  const bare = staged([]);
  // createEntity: the static scale after the readability clamp, the bar placed with it, then dress.
  log.length = 0;
  const root = view.createEntity(e), plain = bare.view.createEntity(bare.e);
  assert.deepEqual(log, ["A scaleFor ranger", "B scaleFor ranger", "A dress ranger", "B dress ranger"]);
  assert.equal(root.userData.readabilityScale, plain.userData.readabilityScale * 3);
  assert.equal(root.userData.bar.position.y, 2.55 * plain.userData.readabilityScale * 3);
  assert.ok(root.getObjectByName("badge"), "dress adds parts to the root");
  // update: the per-frame scale with the readability scale, the bar riding with it; update once a frame.
  log.length = 0;
  frame(0.016);
  assert.deepEqual(log.filter((l) => l.startsWith("A") || l.startsWith("B") || l === "tactics update" || l === "render"),
    ["A frameScaleFor ranger true", "B frameScaleFor ranger true", "tactics update", "A update 0.016", "B update 0.016", "render"]);
  const u = root.userData, rs = u.readabilityScale;
  assert.equal(u.model.scale.y, rs * 1.25);
  assert.equal(u.bar.position.y, 2.55 * rs * 1.25);
  // Back to 1: model and bar exactly as without the plugin.
  view.plugins.with.frameScaleFor[0].frameScaleFor = () => 1;
  frame(0.016);
  assert.equal(u.model.scale.y, rs);
  assert.equal(u.bar.position.y, 2.55 * rs);
  // event: after WorldView's own handling. reset: after everything else is reset.
  log.length = 0;
  view.event({ type: "incoming", team: 1 }, sim);
  assert.deepEqual(log, ["bosses event", "activity event", "tactics event", "A event incoming true", "B event incoming true"]);
  log.length = 0;
  view.reset();
  assert.deepEqual(log.slice(-2), ["A reset", "B reset"]);
  assert.ok(log.indexOf("activity reset") < log.indexOf("A reset"));
});

test("an empty registry changes nothing: factors exactly 1, no new state, the model and bar as before", () => {
  const { e, view, frame } = staged([]);
  assert.ok(HOOKS.every((h) => view.plugins.with[h].length === 0));
  assert.ok(Object.is(view.plugins.scaleFor(e), 1));
  assert.ok(Object.is(view.plugins.frameScaleFor(e, {}, view), 1));
  const root = view.createEntity(e), u = root.userData;
  const keys = Object.keys(u).sort();
  frame(0.016);
  frame(0);
  // The readability scale and bar height are the pre-seam formulas, and no plugin field appears.
  assert.equal(u.model.scale.x, u.readabilityScale);
  assert.equal(u.model.scale.y, u.readabilityScale);
  assert.equal(u.bar.position.y, 2.55 * u.readabilityScale);
  assert.equal(u.barRest, undefined);
  assert.ok(Object.keys(u).every((k) => keys.includes(k) || ["flash"].includes(k)), `new userData: ${Object.keys(u).filter((k) => !keys.includes(k))}`);
});

test("a flyer's vitals bar rides a per-frame scale from the craft's own top, above its fly height", () => {
  let k = 1.5;
  class Bigger { frameScaleFor(e) { return e.flying ? k : undefined; } }
  const { sim, view } = staged([Bigger]);
  view.airShadow = { geometry: new THREE.CircleGeometry(1, 20), material: new THREE.MeshBasicMaterial() }; // no canvas headless
  view.terrain.plateaus = [];
  const kite = sim.spawn("kite", 0, -18, 19);
  sim.entities = [kite];
  view.teamTemplates.set("kite-0", view.teamTemplates.get("ranger-0"));
  const u = view.createEntity(kite).userData, update = () => view.update(sim, 0.016, new Set([kite.id]), null);
  update();
  const lift = u.model.position.y, rs = u.readabilityScale;
  assert.ok(lift > 1, "the kite flies");
  assert.ok(Math.abs(u.bar.position.y - (u.air.top * rs * 1.5 + 0.7 + lift)) < 1e-9);
  assert.equal(u.model.scale.y, rs * 1.5);
  k = 1;
  update();
  assert.equal(u.bar.position.y, u.air.barY + u.model.position.y);
  assert.equal(u.barRest, undefined);
});
