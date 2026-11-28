// The HUD overlay (src/activity-view.js) under the Hero camera (owner 2026-11-28: "the harvesting line ... in the sky"):
// a 2D line to a point behind a perspective camera is mirrored across the screen. View.project now reports `behind`,
// the 2D mining beam is not drawn under the Hero camera (the 3D shards show the work), and nothing is drawn from a
// point behind the lens. The RTS view still draws the beam.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";

function recorder() {
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => calls.push([k, ...a])), set: (t, k, v) => { t[k] = v; return true; } });
  return { ctx, calls };
}
globalThis.devicePixelRatio ??= 1;
globalThis.document ??= { createElement: () => ({ style: {}, setAttribute() {}, getContext: () => recorder().ctx }) };
const { ActivityView } = await import("../src/activity-view.js");

function setup(hero, behind) {
  const s = new Simulation({ ai: false });
  const w = s.own(0).find((e) => e.type === "worker"), r = s.resources[0];
  s.issue([w.id], { type: "gather", target: r.id });
  w.x = r.x + r.radius + 1; w.z = r.z;
  for (let i = 0; i < 4; i++) s.tick(0.05);
  const rec = recorder();
  const view = { container: { append() {} }, width: 800, height: 600, lowPower: false, reducedMotion: { matches: false }, settings: {}, motionLevel: 1,
    heroCameraOn: hero, project: (x, z) => ({ x: 400 + x, y: 300 + z, behind: behind && x === r.x }) };
  const a = new ActivityView(view);
  a.ctx = rec.ctx;
  a.draw(s, 0.016, new Set(), null);
  return rec.calls.filter((c) => c[0] === "lineTo").length;
}

test("the 2D mining beam: drawn in the RTS view, never under the Hero camera, never to a point behind the lens", () => {
  assert.ok(setup(false, false) >= 1, "RTS view: the beam is drawn");
  assert.equal(setup(true, false), 0, "Hero camera: no 2D beam (the 3D shards show the work)");
  assert.equal(setup(false, true), 0, "a deposit behind the camera: no mirrored line");
});
