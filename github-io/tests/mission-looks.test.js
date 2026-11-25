import test from "node:test";
import assert from "node:assert/strict";
import { MISSIONS } from "../src/story/missions.js";
import { MISSION_LOOKS, LOOKS, missionLook, flashAt } from "../src/mission-looks.js";

const sim = (id, time = 0, extra = {}) => ({ missionDef: { id, ...extra }, time });
test("every table id is a real mission or Chronicle, and no existing mission carries a look field", () => {
  const ids = new Set(MISSIONS.map((m) => m.id));
  for (const id of Object.keys(MISSION_LOOKS)) if (!id.startsWith("cv1")) assert.ok(ids.has(id), id);
  // only new content (W2-F m11c, W9 The Long Night m08b) carries its own look
  assert.ok(MISSIONS.every((m) => !("look" in m) || ["m11c-hold-the-keystone-roads", "m08b-the-long-night"].includes(m.id)));
  assert.equal(MISSIONS.find((m) => m.id === "m08b-the-long-night").look, "night");
});
test("m08 and cv1 are night, m10 is storm, m06 gathers a storm from the start (full at 16:00)", () => {
  assert.equal(missionLook(sim("m08-the-quiet-vault")).name, "night");
  assert.equal(missionLook(sim("cv1-night-count")).name, "night");
  assert.equal(missionLook(sim("m10-obsidian-storm")).name, "storm");
  // R3-D: it was 0 until 16:00; now it builds over the first 90 s, then breaks in full at 16:00.
  assert.ok(missionLook(sim("m06-copper-harvest", 100)).k >= 0.7);
  assert.equal(missionLook(sim("m06-copper-harvest", 1000)).k, 1);
  assert.equal(missionLook(sim("m01-first-light")), null);
});
test("map variety: Gun Hill is a night battle and the Canyon Run a dusk drive (from the table, not a mission field)", () => {
  assert.equal(missionLook(sim("m06c-gun-hill")).name, "night");
  assert.equal(missionLook(sim("m04b-canyon-run")).name, "dusk");
  assert.equal(missionLook(sim("m06c-gun-hill", 200)).k, 1);
});
test("W9: river fog rolls over Cut the Draw from 3:30 and lifts by 6:30 (view only, from the table)", () => {
  assert.equal(missionLook(sim("m11-cut-the-draw", 100)).k, 0);
  assert.ok(missionLook(sim("m11-cut-the-draw", 300)).k > 0.8);
  assert.equal(missionLook(sim("m11-cut-the-draw", 300)).name, "fog");
  assert.equal(missionLook(sim("m11-cut-the-draw", 400)).k, 0);
  assert.ok(LOOKS.fog.fogFar < 1 && !LOOKS.fog.rain && !LOOKS.fog.flash, "fog closes in, with no rain or lightning");
});
test("new content may carry its own look; the table wins for existing ids", () => {
  assert.equal(missionLook(sim("new", 0, { look: "dusk" })).name, "dusk");
  assert.equal(missionLook(sim("m08-the-quiet-vault", 0, { look: "dusk" })).name, "night");
  assert.equal(missionLook({ missionDef: null, rules: { look: "night" }, time: 0 }).name, "night");
});
test("night sky is very dark blue and lightning is deterministic", () => {
  const n = parseInt(LOOKS.night.sky.slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  assert.ok(0.2126 * r + 0.7152 * g + 0.0722 * b < 20 && b > r && b > g);
  const hits = Array.from({ length: 600 }, (_, i) => flashAt(i / 2, LOOKS.storm.flash));
  assert.deepEqual(hits, Array.from({ length: 600 }, (_, i) => flashAt(i / 2, LOOKS.storm.flash)));
  assert.ok(hits.some((v) => v > 0.5));
  assert.equal(flashAt(5, null), 0);
});
