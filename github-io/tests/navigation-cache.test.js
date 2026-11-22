import test from "node:test";
import assert from "node:assert/strict";
import { Navigation } from "../src/navigation.js";
import { Terrain, CROSSINGS } from "../src/terrain.js";

test("cached routes match uncached routes across blockage, rebuild and reopen", () => {
  const t = new Terrain("riverlands");
  const cached = new Navigation(t), plain = new Navigation(t, false);
  const from = {x: 3, z: -15}, to = {x: 3, z: 15};
  const closed = CROSSINGS.map(c => ({kind: "building", hp: 100, x: c.x, z: 0, radius: c.half + 2}));
  for (const obstacles of [[], closed, []]) {
    cached.rebuild(obstacles);
    plain.rebuild(obstacles);
    assert.equal(cached.pathCaches.size, 0);
    for (const radius of [0.3, 0.55, 1.2]) {
      for (const loose of [false, true]) {
        for (const [a, b] of [[from, to], [to, from]]) {
          const expected = plain.path(a, b, radius, loose);
          assert.equal(expected.length === 0, obstacles.length > 0);
          assert.deepEqual(cached.path(a, b, radius, loose), expected);
          assert.deepEqual(cached.path(a, b, radius, loose), expected);
        }
      }
    }
  }
});
