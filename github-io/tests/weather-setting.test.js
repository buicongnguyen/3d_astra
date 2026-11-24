// Settings > Display > Weather (2026-11-25): default On, old saves load with it On, Off drops only the
// storm look from the view (night and dusk stay), and the sim never reads it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaults, normalize } from "../src/settings.js";
import { viewLook, missionLook, WEATHER_LOOKS } from "../src/mission-looks.js";

test("Weather defaults to On, saves from before it load On, and only booleans are kept", () => {
  assert.equal(defaults().weather, true);
  assert.equal(defaults(true).weather, true);
  assert.equal(normalize({ version: 1, quality: "eco" }, true).weather, true);
  assert.equal(normalize({ version: 1, weather: false }).weather, false);
  assert.equal(normalize({ version: 1, weather: "off" }).weather, true);
  assert.equal(normalize(null).weather, true);
});

test("Weather Off drops the storm look and keeps night and dusk", () => {
  const sim = (look, time = 30) => ({ time, missionDef: { id: "x" }, rules: { look } });
  assert.deepEqual([...WEATHER_LOOKS], ["storm"]);
  assert.equal(viewLook(sim("storm"), { weather: true })?.name, "storm");
  assert.equal(viewLook(sim("storm"), {})?.name, "storm");
  assert.equal(viewLook(sim("storm"), { weather: false }), null);
  assert.equal(viewLook(sim("night"), { weather: false })?.name, "night");
  assert.equal(viewLook(sim("dusk"), { weather: false })?.name, "dusk");
  // The campaign storms (m10 in full, m06's gathering storm) go too.
  for (const id of ["m10-obsidian-storm", "m06-copper-harvest"]) {
    const s = { time: 120, missionDef: { id } };
    assert.equal(missionLook(s).name, "storm");
    assert.equal(viewLook(s, { weather: false }), null);
  }
});

test("the simulation never reads the Weather setting or the mission looks", () => {
  for (const file of ["../src/simulation.js", "../src/sim/vision.js", "../src/sim/combat.js", "../src/sim/movement.js"]) {
    const text = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.ok(!/mission-looks|settings\.weather|viewLook/.test(text), file);
  }
});
