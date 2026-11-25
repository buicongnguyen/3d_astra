// The Field Guide 3D view's pure helpers (src/unit-viewer-math.js): camera fit, orbit clamps, zoom, double tap,
// colour cycle and which motion buttons a type gets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORBIT, fitDistance, clampOrbit, dragOrbit, pinchZoom, wheelZoom, orbitOffset, isDoubleTap, colourCycle, motionsFor } from "../src/unit-viewer-math.js";
import { DEFINITIONS as D } from "../src/data.js";

test("fitDistance keeps the whole sphere in view on wide and tall canvases", () => {
  for (const aspect of [2.4, 1.6, 1, 0.6, 0.4]) for (const radius of [0.6, 2, 7]) {
    const d = fitDistance(radius, 30, aspect, 1);
    const v = (30 * Math.PI) / 360, h = Math.atan(Math.tan(v) * aspect);
    // The sphere's angular radius seen from d is exactly the narrower half-angle (margin 1).
    assert.ok(Math.abs(Math.asin(radius / d) - Math.min(v, h)) < 1e-9);
  }
  assert.ok(fitDistance(1, 30, 0.5) > fitDistance(1, 30, 2), "a portrait canvas backs the camera off");
  assert.ok(fitDistance(2, 30, 1) > fitDistance(1, 30, 1), "bigger models (bosses) sit further away");
  assert.ok(Number.isFinite(fitDistance(0, 30, 0)), "degenerate input stays finite");
});

test("orbit clamps pitch and zoom and wraps yaw", () => {
  const o = clampOrbit({ yaw: 7, pitch: 5, zoom: 9 });
  assert.equal(o.pitch, ORBIT.maxPitch);
  assert.equal(o.zoom, ORBIT.maxZoom);
  assert.ok(o.yaw > -Math.PI && o.yaw <= Math.PI && Math.abs(Math.sin(o.yaw) - Math.sin(7)) < 1e-9);
  const low = clampOrbit({ yaw: 0, pitch: -2, zoom: 0.01 });
  assert.equal(low.pitch, ORBIT.minPitch, "never under the ground plate");
  assert.equal(low.zoom, ORBIT.minZoom);
  const dragged = dragOrbit(ORBIT.home, 100, -40);
  assert.ok(dragged.yaw < ORBIT.home.yaw, "dragging right turns the view");
  assert.ok(dragged.pitch < ORBIT.home.pitch, "dragging up lowers the camera");
  assert.equal(dragOrbit(ORBIT.home, 0, 100000).pitch, ORBIT.maxPitch);
});

test("pinch and wheel zoom stay inside the limits", () => {
  assert.ok(pinchZoom(1, 100, 200) < 1, "fingers apart: closer");
  assert.ok(pinchZoom(1, 200, 100) > 1, "fingers together: further");
  assert.equal(pinchZoom(1, 10, 100000), ORBIT.minZoom);
  assert.equal(pinchZoom(1, 100000, 1), ORBIT.maxZoom);
  assert.ok(wheelZoom(1, 100) > 1 && wheelZoom(1, -100) < 1);
  assert.equal(wheelZoom(ORBIT.maxZoom, 1e6), ORBIT.maxZoom);
  assert.equal(wheelZoom(ORBIT.minZoom, -1e6), ORBIT.minZoom);
});

test("orbitOffset puts the camera at the zoomed distance", () => {
  const [x, y, z] = orbitOffset({ yaw: 0.4, pitch: 0.3, zoom: 1.5 }, 10);
  assert.ok(Math.abs(Math.hypot(x, y, z) - 15) < 1e-9);
  assert.ok(y > 0, "above the horizon");
});

test("double tap needs two quick taps close together", () => {
  const a = { t: 1000, x: 50, y: 50 };
  assert.equal(isDoubleTap(a, { t: 1200, x: 60, y: 55 }), true);
  assert.equal(isDoubleTap(a, { t: 1000 + ORBIT.doubleTapMs + 1, x: 50, y: 50 }), false);
  assert.equal(isDoubleTap(a, { t: 1100, x: 200, y: 50 }), false);
  assert.equal(isDoubleTap(null, a), false);
});

test("colour cycle: yours, the enemy's, then each faction once", () => {
  const list = colourCycle([1, 2, 3, 4], [11, 12, 13, 14], [{ id: "meridian", short: "Meridian", color: 1, glow: 21 }, { id: "ashfall", short: "Ashfall", color: 5, glow: 25 }], 2);
  assert.deepEqual(list.map((c) => c.id), ["own", "enemy", "ashfall"]);
  assert.equal(list[1].color, 3, "the side the guide was opened for");
  assert.equal(list[0].glow, 11);
  assert.equal(colourCycle([1, 2], [1, 2], [], 0)[1].color, 2, "no side: team 1");
});

test("motion buttons follow the unit: walkers walk, hulls drive, flyers fly, buildings stand", () => {
  assert.deepEqual(motionsFor(D.ranger, { legs: true }), { walk: "Walk", fire: true });
  assert.deepEqual(motionsFor(D.tank, { hull: true }), { walk: "Drive", fire: true });
  assert.deepEqual(motionsFor(D.rider, { wheels: true, legs: true }), { walk: "Drive", fire: true });
  assert.equal(motionsFor(D.hawk, {}).walk, "Fly");
  assert.deepEqual(motionsFor(D.medic, { legs: true }), { walk: "Walk", fire: false });
  assert.deepEqual(motionsFor(D.hq, {}), { walk: null, fire: false });
  assert.deepEqual(motionsFor(D.tower, {}), { walk: null, fire: true });
});
