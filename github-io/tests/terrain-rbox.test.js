// Rounded-box plateaus ("rbox", hills mix 2026-11-25, owner: "some hills will be round, some will be
// rectangles"): the signed edge distance with arc corners, snapping to the 2 m nav/vision grid, side and
// angle ramps, the point and quad mirrors, and, for every plateau of every map, that a structure sits on
// the top and that the top is reached up a ramp or is flagged decorative ("decor") and out of reach.
import test from "node:test";
import assert from "node:assert/strict";
import MAPS_JSON from "../src/maps.json" with { type: "json" };
import { Terrain, ALL_MAPS, TERRAIN, RBOX_CORNER, plateauEdge, rimReach } from "../src/terrain.js";
import { Simulation } from "../src/simulation.js";

const close = (a, b, e = 1e-9) => Math.abs(a - b) < e;
// A flat map carrying just these raw plateaus (built the way maps.json plateaus are).
function withPlateaus(raw) {
  const t = new Terrain("classic");
  t.plateaus = raw; t.walls = [];
  t.buildHeights();
  return t;
}

test("rbox edge: negative inside, zero on the sides, arcs of radius `corner` at the corners", () => {
  const p = { shape: "rbox", x: 10, z: -4, w: 24, d: 16, corner: 5 };
  assert.equal(plateauEdge(p, 10, -4), -8, "the centre is half the short side in");
  assert.equal(plateauEdge(p, 22, -4), 0, "east side");
  assert.equal(plateauEdge(p, 10, 4), 0, "south side");
  assert.equal(plateauEdge(p, 25, -4), 3, "3 m out of the east side");
  // The corner arc: centre (10 + 12 - 5, -4 + 8 - 5) = (17, -1), radius 5.
  const a = Math.PI / 4, cx = 17, cz = -1;
  assert.ok(close(plateauEdge(p, cx + Math.cos(a) * 5, cz + Math.sin(a) * 5), 0), "on the arc");
  assert.ok(close(plateauEdge(p, cx + Math.cos(a) * 7, cz + Math.sin(a) * 7), 2), "2 m out of the arc");
  // The sharp box corner is outside a rounded box by (sqrt 2 - 1) corner.
  assert.ok(close(plateauEdge(p, 22, 4), Math.SQRT2 * 5 - 5));
  assert.ok(plateauEdge({ ...p, shape: "box" }, 22, 4) === 0, "a box keeps its sharp corner");
  // Corner 0 is the box exactly, at any point.
  for (const [x, z] of [[0, 0], [30, 9], [12, -11], [-3, 3]]) assert.equal(plateauEdge({ ...p, corner: 0 }, x, z), plateauEdge({ ...p, shape: "box" }, x, z));
  // rimReach: half a side straight out, the arc on a diagonal.
  assert.equal(rimReach(p, 1, 0), 12);
  assert.equal(rimReach(p, 0, -1), 8);
  const diag = rimReach({ shape: "rbox", x: 0, z: 0, w: 20, d: 20, corner: 4 }, Math.SQRT1_2, Math.SQRT1_2);
  assert.ok(close(diag, 6 * Math.SQRT2 + 4, 1e-9), `diagonal reach ${diag}`);
  assert.equal(rimReach({ shape: "disc", x: 0, z: 0, r: 7 }, 0.6, 0.8), 7);
});

test("rbox sides snap to the 2 m grid (cell edges), mirrored copies exactly; corner at least 3 m and at most half a side", () => {
  const t = withPlateaus([{ shape: "rbox", x: -17.5, z: -58, w: 25, d: 17, corner: 1, mirror: true }]);
  const [p, q] = t.plateaus;
  for (const v of [p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2]) assert.equal(Math.abs(v) % 2, 0, `side at ${v}`);
  assert.deepEqual([q.x, q.z, q.w, q.d, q.corner], [-p.x, -p.z, p.w, p.d, p.corner], "the mirror copy");
  assert.equal(p.corner, RBOX_CORNER, "corner raised to 3 m");
  assert.equal(withPlateaus([{ shape: "rbox", x: 0, z: 0, w: 8, d: 30, corner: 9 }]).plateaus[0].corner, 4, "at most half the short side");
  // The cliff band falls on cell edges: every 2 m cell is wholly on the top or wholly off it along a side.
  const g = withPlateaus([{ shape: "rbox", x: 0, z: 0, w: 20, d: 12, corner: 3 }]);
  assert.equal(g.cellLevel[g.cellIndex(9, 0)], 1);
  assert.equal(g.cellLevel[g.cellIndex(11, 0)], 0);
  assert.equal(g.level(9.99, 0), 1);
  assert.equal(g.level(10.01, 0), 0);
});

test("rbox ramps: on a side at `at`, or where an angle's ray leaves the box; walkable through the cliff band", () => {
  const t = withPlateaus([{ shape: "rbox", x: 0, z: 20, w: 24, d: 16, corner: 5, ramps: [{ side: "east", at: 2, width: 7 }, { side: "north", at: -4, width: 7 }, { angle: 45, width: 7 }] }]);
  const p = t.plateaus[0], [east, north, diag] = p.ramps;
  assert.deepEqual([east.x, east.z], [12, 22]);
  assert.deepEqual([north.x, north.z], [-4, 12]);
  assert.ok(close(t.edge(p, diag.x, diag.z), 0, 1e-9) && diag.x > 0 && diag.z > p.z && close(diag.x - p.x, diag.z - p.z, 1e-9), "the diagonal ramp is on the corner arc");
  for (const r of p.ramps) {
    assert.equal(t.canStand(r.x, r.z, 0.55), true, "a ramp crosses the cliff");
    assert.equal(t.placement(r.x, r.z, 1), "Keep cliffs and ramps clear.");
  }
  assert.equal(t.canStand(12, 14, 0.55), false, "the rest of the side is a cliff");
  assert.equal(t.canStand(-12, 20, 0.55), false, "the west side has no ramp");
  assert.ok(close(t.heightAt(0, 20), TERRAIN.plateau_height) && t.heightAt(16, 20) === 0);
});

test("rbox mirrors: the point mirror and the quad copies keep side and angle ramps in place", () => {
  const raw = { shape: "rbox", x: -30, z: 20, w: 20, d: 12, corner: 4, ramps: [{ side: "north", at: 3, width: 7 }, { side: "east", at: -1, width: 7 }, { angle: 150, width: 7 }] };
  const point = withPlateaus([{ ...raw, mirror: true }]).plateaus, quad = withPlateaus([{ ...raw, mirror: "quad" }]).plateaus;
  assert.equal(point.length, 2);
  assert.equal(quad.length, 4);
  const sorted = (rs) => rs.map((r) => [r.x, r.z].map((v) => +v.toFixed(9))).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const flip = (p, sx, sz) => sorted(p.ramps.map((r) => ({ x: r.x * sx, z: r.z * sz })));
  const base = point[0];
  assert.deepEqual(sorted(point[1].ramps), flip(base, -1, -1), "point mirror");
  assert.deepEqual(sorted(quad[1].ramps), flip(base, -1, -1), "quad: point mirror");
  assert.deepEqual(sorted(quad[2].ramps), flip(base, -1, 1), "quad: x mirror");
  assert.deepEqual(sorted(quad[3].ramps), flip(base, 1, -1), "quad: z mirror");
  for (const [p, sx, sz] of [[quad[1], -1, -1], [quad[2], -1, 1], [quad[3], 1, -1]])
    for (const [x, z] of [[-35, 24], [-21, 15], [-40, 26]]) assert.ok(close(plateauEdge(p, x * sx, z * sz), plateauEdge(base, x, z)), "same shape mirrored");
});

test("map data: rbox sides already on the 2 m grid, corners of 3 m or more, side ramps on the straight part", () => {
  let n = 0;
  for (const [id, m] of Object.entries(ALL_MAPS))
    for (const p of m.plateaus || []) {
      if (p.shape !== "rbox") continue;
      n++;
      for (const v of [p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2]) assert.equal(Math.abs(v) % 2, 0, `${id}: side at ${v} is snapped in the data`);
      assert.ok(p.corner >= RBOX_CORNER && p.corner <= Math.min(p.w, p.d) / 2, `${id}: corner ${p.corner}`);
      for (const r of p.ramps || []) {
        if (typeof r.angle === "number") continue;
        const side = r.side === "north" || r.side === "south" ? p.w : p.d;
        assert.ok(Math.abs(r.at || 0) + r.width / 2 <= side / 2 - p.corner, `${id}: ${r.side} ramp at ${r.at} clear of the corner arcs`);
      }
    }
  assert.ok(n >= 6, `${n} rounded boxes`);
});

test("the hills mix: round and rounded-box Skirmish maps both exist, and no sharp box is left", () => {
  const shapes = (id) => new Set((MAPS_JSON[id].plateaus || []).map((p) => p.shape));
  for (const id of ["dunes", "woodlands", "dryreach", "twinrivers", "ironback", "crownmesa"]) assert.ok(shapes(id).has("rbox"), `${id} has a rounded box`);
  for (const id of ["highlands", "heartland", "steppe"]) assert.deepEqual([...shapes(id)], ["disc"], `${id} stays round`);
  for (const id of Object.keys(MAPS_JSON)) assert.ok(!shapes(id).has("box"), `${id}: no sharp box`);
});

test("every plateau of every map: a structure sits on the top, and the top is reached up a ramp or is decorative and out of reach", () => {
  for (const [id, m] of Object.entries(ALL_MAPS)) {
    if (!(m.plateaus || []).length) continue;
    const s = new Simulation({ ai: false, map: id }), t = s.terrain;
    // Raw plateaus in order, each with its copies (mirror, quad), so a built plateau knows its flag.
    const flags = (m.plateaus || []).flatMap((p) => Array(p.mirror === "quad" ? 4 : p.mirror ? 2 : 1).fill(!!p.decor));
    assert.equal(flags.length, t.plateaus.length, id);
    t.plateaus.forEach((p, k) => {
      const where = `${id} plateau ${k} (${p.shape} at ${p.x}, ${p.z})`;
      assert.ok(p.ramps.length || flags[k] || m.defence, `${where}: has a ramp or is flagged decor`);
      assert.ok(!(p.ramps.length && flags[k]), `${where}: a decor plateau has no ramp`);
      assert.equal(t.level(p.x, p.z), 1, `${where}: its centre is on the top`);
      assert.ok(Math.abs(t.heightAt(p.x, p.z) - TERRAIN.plateau_height) < 1e-9, `${where}: drawn at plateau height`);
      // The top as the nav sees it: a 0.55 m unit standing at the deepest point found.
      const top = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dz]) => ({ x: p.x + dx, z: p.z + dz })).find((o) => t.canStand(o.x, o.z, 0.55) && t.plateauAt(o.x, o.z) === k);
      if (!p.ramps.length) {
        if (!top) return; // too small to stand on: decorative by size
        // Out of reach: no route from low ground 6 m outside any side.
        const out = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => { const r = rimReach(p, dx, dz) + 6; return { x: p.x + dx * r, z: p.z + dz * r }; }).find((o) => t.canStand(o.x, o.z, 0.55) && t.level(o.x, o.z) === 0);
        // (The route search heads for the nearest open cell when the goal can't be reached: it must end off this top.)
        const end = out && s.nav.path(out, top, 0.55).at(-1);
        if (end) assert.notEqual(t.plateauAt(end.x, end.z), k, `${where}: decor top is out of reach`);
        return;
      }
      assert.ok(top, `${where}: a unit can stand on the top`);
      for (const r of p.ramps) {
        // From 4 m below the ramp's foot, up to the top.
        const e = 0.05, gx = t.edge(p, r.x + e, r.z) - t.edge(p, r.x - e, r.z), gz = t.edge(p, r.x, r.z + e) - t.edge(p, r.x, r.z - e), l = Math.hypot(gx, gz);
        const foot = { x: r.x + (gx / l) * 5, z: r.z + (gz / l) * 5 };
        if (!t.canStand(foot.x, foot.z, 0.55)) continue; // a ramp foot in water or against another cliff (checked from the other ramps)
        const end = s.nav.path(foot, top, 0.55).at(-1);
        assert.ok(end && t.plateauAt(end.x, end.z) === k, `${where}: route up the ramp at (${r.x.toFixed(1)}, ${r.z.toFixed(1)})`);
      }
      // A tower (the smallest structure) fits on a ramped top somewhere: the top is buildable.
      let fits = false;
      for (let dz = -20; dz <= 20 && !fits; dz += 0.5) for (let dx = -32; dx <= 32 && !fits; dx += 0.5) {
        const x = p.x + dx, z = p.z + dz;
        if (t.plateauAt(x, z) === k && !t.placement(x, z, 1.5) && Math.abs(x) <= t.half - 3.5 && Math.abs(z) <= t.half - 3.5) fits = true;
      }
      assert.ok(fits, `${where}: a tower fits on the top`);
    });
  }
});
