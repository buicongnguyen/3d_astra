import test from "node:test";
import assert from "node:assert/strict";
import { FACTIONS } from "../src/story/world.js";
import { hasEmblem } from "../src/emblems.js";

test("every story faction has an emblem glyph", () => {
  for (const id of Object.keys(FACTIONS)) assert.ok(hasEmblem(id), `${id} has a glyph`);
  assert.equal(hasEmblem("nobody"), false);
});
