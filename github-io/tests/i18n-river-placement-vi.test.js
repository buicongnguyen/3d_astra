import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Terrain } from "../src/terrain.js";
import MAPS from "../src/maps.json" with { type: "json" };

test("river placement error has a Vietnamese translation key", () => {
  const id = Object.keys(MAPS).find((k) => MAPS[k].river);
  const msg = new Terrain(id).placement(10, 0, 1);
  assert.ok(msg);
  const vi = JSON.parse(readFileSync(new URL("../src/locales/vi.json", import.meta.url), "utf8"));
  const flat = JSON.stringify(vi);
  assert.ok(flat.includes(JSON.stringify(msg)), `vi.json lacks key: ${msg}`);
});
