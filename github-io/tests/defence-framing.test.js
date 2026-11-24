// Frontier Defence framing on phones (2026-11-24, app/defence/framing.js): the camera turns and zooms so every road
// and pad of a level fits the part of the screen no HUD covers. Checked here against three.js's own camera maths for
// every Defence level and story Defence mission at a portrait and a landscape clear area; the browser side (the HUD
// measured, the view applied, Follow and Overview) is in tests/defence.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { cameraBasis, toCamera, clearRect, frameRoutes, routeShape, followShift, focusShift, CAMERA_OFFSET, FRAME_MARGIN, MIN_PX_PER_METRE } from "../src/app/defence/framing.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { HOLD_THE_RIVER, HOLD_THE_VALLEY, HOLD_THE_ROADS } from "../src/story/defence-missions.js";

const LEVELS = [...DEFENCE_LEVELS, HOLD_THE_RIVER, HOLD_THE_VALLEY, HOLD_THE_ROADS];

// The game camera as view.js updateCamera builds it (no HUD cover): orthographic, zoom = frame height in world units.
function gameCamera({ yaw, zoom, focus }, width, height) {
  const aspect = width / height, cam = new THREE.OrthographicCamera((-zoom * aspect) / 2, (zoom * aspect) / 2, zoom / 2, -zoom / 2, 0.1, 240);
  const offset = new THREE.Vector3(...CAMERA_OFFSET).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const f = new THREE.Vector3(focus.x, 0, focus.z);
  cam.position.copy(f).add(offset);
  cam.lookAt(f);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}
const project = (cam, x, z, width, height) => { const p = new THREE.Vector3(x, 0, z).project(cam); return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height }; };

test("the camera basis matches three.js lookAt at every turn", () => {
  for (const yaw of [0, Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const cam = gameCamera({ yaw, zoom: 50, focus: { x: 0, z: 0 } }, 400, 400), b = cameraBasis(yaw);
    const r = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), u = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    for (const [mine, three] of [[b.right, r], [b.up, u]]) for (const [i, k] of ["x", "y", "z"].entries()) assert.ok(Math.abs(mine[i] - three[k]) < 1e-9, `yaw ${yaw}: ${mine} vs ${three.toArray()}`);
  }
});

test("the clear area: bands are cut away, small corner panels are left to the pan unless they always cover", () => {
  const base = { left: 0, top: 0, right: 390, bottom: 800 };
  const top = { left: 0, top: 0, right: 390, bottom: 45 }, dock = { left: 8, top: 660, right: 382, bottom: 800 }, corner = { left: 300, top: 600, right: 380, bottom: 650 };
  assert.deepEqual(clearRect(base, [top, dock, corner]), { left: 0, top: 45, right: 390, bottom: 660 });
  assert.deepEqual(clearRect(base, [top, dock, { ...corner, always: true }]), { left: 0, top: 45, right: 390, bottom: 600 });
  // A side dock in landscape cuts the right side, not the top.
  assert.deepEqual(clearRect({ left: 0, top: 45, right: 844, bottom: 390 }, [{ left: 650, top: 150, right: 844, bottom: 370 }]), { left: 0, top: 45, right: 650, bottom: 390 });
});

const SCREENS = {
  portrait: { width: 390, height: 600, clear: { left: 0, top: 50, right: 390, bottom: 560 } },
  landscape: { width: 844, height: 345, clear: { left: 0, top: 60, right: 650, bottom: 345 } },
};

for (const [name, s] of Object.entries(SCREENS)) {
  test(`${name}: every level's roads and pads fit the clear area, turned along its long side`, () => {
    for (const level of LEVELS) {
      const { points, samples, flow } = routeShape(level.defence);
      const frame = frameRoutes({ points, samples, flow, clear: s.clear, frameHeight: s.height, focusPx: { x: s.width / 2, y: s.height / 2 } });
      const cam = gameCamera({ yaw: frame.yaw, zoom: frame.zoom, focus: frame.focus }, s.width, s.height);
      for (const p of points) {
        const q = project(cam, p.x, p.z, s.width, s.height);
        assert.ok(q.x >= s.clear.left + FRAME_MARGIN - 1 && q.x <= s.clear.right - FRAME_MARGIN + 1 && q.y >= s.clear.top + FRAME_MARGIN - 1 && q.y <= s.clear.bottom - FRAME_MARGIN + 1, `${level.id} ${name}: (${p.x}, ${p.z}) at ${q.x.toFixed(1)}, ${q.y.toFixed(1)}`);
      }
      // Never further out than the usual (unturned) view would need, give or take the cost of a turn.
      const plain = frameRoutes({ points, flow, clear: s.clear, frameHeight: s.height, focusPx: { x: s.width / 2, y: s.height / 2 }, yaws: [0] });
      assert.ok(frame.zoom <= plain.zoom * 1.0001, `${level.id} ${name}: ${frame.zoom.toFixed(1)} vs unturned ${plain.zoom.toFixed(1)}`);
      // The opening view stops at a readable zoom and stays centred on the roads.
      assert.ok(frame.near.zoom <= s.height / MIN_PX_PER_METRE + 1e-9 && frame.near.zoom <= frame.zoom + 1e-9);
      // The roads' long side runs along the screen's long side (Three Roads fills its whole square basin: no long side).
      const b = cameraBasis(frame.yaw), cs = points.map((p) => toCamera(b, p.x, p.z));
      const w = Math.max(...cs.map((c) => c.x)) - Math.min(...cs.map((c) => c.x)), h = Math.max(...cs.map((c) => c.y)) - Math.min(...cs.map((c) => c.y));
      if (level.map !== "crossroads" && Math.max(w, h) > 1.3 * Math.min(w, h)) assert.equal(h > w, name === "portrait", `${level.id} ${name}: roads ${w.toFixed(0)} x ${h.toFixed(0)} m on screen`);
    }
  });
}

test("Gorge Road in landscape turns a quarter so the road runs across the screen; spawn on the left", () => {
  const level = DEFENCE_LEVELS.find((l) => l.id === "d-gorge"), s = SCREENS.landscape, { points, flow } = routeShape(level.defence);
  const frame = frameRoutes({ points, flow, clear: s.clear, frameHeight: s.height, focusPx: { x: s.width / 2, y: s.height / 2 } });
  assert.notEqual(frame.yaw, 0);
  const cam = gameCamera(frame, s.width, s.height), from = project(cam, flow[0].from.x, flow[0].from.z, s.width, s.height), to = project(cam, flow[0].to.x, flow[0].to.z, s.width, s.height);
  assert.ok(from.x < to.x, `spawn ${from.x.toFixed(0)} left of exit ${to.x.toFixed(0)}`);
});

test("a corner panel over the roads: the view slides within its slack so nothing sits under it", () => {
  const level = DEFENCE_LEVELS.find((l) => l.id === "d-gorge"), s = SCREENS.landscape, { points, samples, flow } = routeShape(level.defence);
  const base = { points, samples, flow, clear: s.clear, frameHeight: s.height, focusPx: { x: s.width / 2, y: s.height / 2 } };
  const plain = frameRoutes(base), cam = gameCamera(plain, s.width, s.height);
  // A minimap-sized panel right over the spawn.
  const spawn = project(cam, flow[0].from.x, flow[0].from.z, s.width, s.height), avoid = [{ left: spawn.x - 60, top: spawn.y - 40, right: spawn.x + 60, bottom: spawn.y + 40 }];
  const moved = frameRoutes({ ...base, avoid }), cam2 = gameCamera(moved, s.width, s.height);
  const under = samples.filter((p) => { const q = project(cam2, p.x, p.z, s.width, s.height); return q.x > avoid[0].left && q.x < avoid[0].right && q.y > avoid[0].top && q.y < avoid[0].bottom; });
  assert.equal(under.length, 0, `${under.length} road points under the panel`);
  assert.ok(moved.zoom <= plain.zoom * 1.25 + 1e-9);
});

test("Follow keeps still while the wave front is in the middle, then moves just enough", () => {
  const clear = { left: 0, top: 0, right: 400, bottom: 800 };
  assert.deepEqual(followShift({ x: 200, y: 400 }, clear), { x: 0, y: 0 });
  assert.deepEqual(followShift({ x: 310, y: 400 }, clear), { x: 0, y: 0 }); // 110 px right of the middle, inside the 120 px zone
  const s = followShift({ x: 390, y: 50 }, clear);
  assert.ok(Math.abs(s.x - 70) < 1e-9 && Math.abs(s.y - -110) < 1e-9, JSON.stringify(s));
  // focusShift moves the focus so that point comes to the middle (checked with three.js).
  const yaw = Math.PI / 2, zoom = 50, w = 400, h = 800, cam = gameCamera({ yaw, zoom, focus: { x: 3, z: -4 } }, w, h);
  const p = project(cam, 10, 6, w, h), d = focusShift(yaw, p.x - w / 2, p.y - h / 2, h / zoom);
  const moved = gameCamera({ yaw, zoom, focus: { x: 3 + d.x, z: -4 + d.z } }, w, h), q = project(moved, 10, 6, w, h);
  assert.ok(Math.abs(q.x - w / 2) < 1e-6 && Math.abs(q.y - h / 2) < 1e-6, JSON.stringify(q));
});
