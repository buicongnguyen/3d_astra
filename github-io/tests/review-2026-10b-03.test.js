import test from "node:test";
import assert from "node:assert/strict";
import { Navigation } from "../src/navigation.js";

test("A* edges between cell centres never clip an obstacle for the unit radius", () => {
  const nav = new Navigation();
  nav.rebuild([]);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const half = nav.terrain.half - 4;
  let bad = 0;
  for (const radius of [0.95, 0.55]) {
    for (let i = 0; i < 150; i++) {
      const from = { x: (rnd() * 2 - 1) * half, z: (rnd() * 2 - 1) * half };
      const to = { x: (rnd() * 2 - 1) * half, z: (rnd() * 2 - 1) * half };
      const path = nav.path(from, to, radius);
      for (let k = 1; k < path.length; k++)
        if (!nav.canTraverse(path[k - 1], path[k], radius)) bad++;
    }
  }
  assert.equal(bad, 0);
});

test("breaker route near the wall at (8,-34) has no edge canTraverse rejects", () => {
  const nav = new Navigation();
  nav.rebuild([]);
  const path = nav.path({ x: 18, z: -31 }, { x: -34, z: -18 }, 0.95);
  assert.ok(path.length > 0);
  for (let k = 1; k < path.length; k++)
    assert.ok(nav.canTraverse(path[k - 1], path[k], 0.95), `edge ${k} clips an obstacle`);
});
