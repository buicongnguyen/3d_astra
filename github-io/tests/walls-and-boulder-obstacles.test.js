import test from "node:test";
import assert from "node:assert/strict";
import { Navigation } from "../src/navigation.js";
import { ROCKS } from "../src/data.js";

test("destroyed walls do not bring boulder obstacles back", () => {
  const nav = new Navigation();
  const [x, z, r] = ROCKS[0];
  const wall = { kind: "wall", hp: 100, x, z, radius: r };
  nav.rebuild([wall]);
  wall.hp = 0;
  nav.rebuild([]); // dead walls already filtered out of the entity list
  assert.equal(nav.obstacles.length, 0);
  nav.rebuild([wall]);
  assert.equal(nav.obstacles.length, 0);
});

test("without walls the ROCKS stand in", () => {
  const nav = new Navigation();
  nav.rebuild([]);
  assert.equal(nav.obstacles.length, ROCKS.length);
});
