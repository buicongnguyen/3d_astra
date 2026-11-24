// Golden pin, R3-Q (AAA round 3, "First-minute hooks"): the new content only.
//  - Quick battle: Riverlands, Meridian against one Relaxed Ashfall rival under `rules.quick`, nobody
//    playing; hashes at 20 and 60 s (the outpost, the scouts at 0:32+ and their fight). The match saved
//    at 20 s and loaded plays on to the same 60 s hash (the scouts are not sent twice).
//  - First watch: Gorge Road's new-player variant with the Defence bot; hash at 60 s (the Scout Runner
//    out with wave 1 and caught).
// Pins are re-recorded only by the integrator, with a named reason (docs/TESTING.md, "Golden pins and
// baselines"); GOLDEN_RECORD=1 prints the values.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { skirmishSides } from "../src/factions.js";
import { QUICK_SETUP, quickRival } from "../src/sim/content/quick-battle.js";
import { firstWatchLevel } from "../src/defence/first-watch.js";
import { DefenceBot } from "../tools/defence-bot.mjs";
import { run, TICK } from "./lib/sim.js";
import { RECORD, pin } from "./lib/golden.mjs";

const PINS = {
  quick: { 20: "f4a9bba2", 60: "6b227e40" },
  // Re-recorded 2026-11-24 (defence pads): short-reach crews reach further and gain more per tier (garrisons.json tier_range: Rangers and Tank post 14/15.5/17.5 m, Mortar 12/13.5/15.5, Flame trap 7/8.5/10) and far pads moved nearer the road (Gorge d1 d2 d4 g10, Bridges s8, Canyon d1 d2); docs/CHANGELOG.md "Defence pads".
  firstWatch: { 60: "2b5708e9" },
};

const quickMatch = () => new Simulation({ map: QUICK_SETUP.map, aiSpeed: QUICK_SETUP.aiSpeed, enemyCount: QUICK_SETUP.enemyCount, alliance: QUICK_SETUP.alliance, capturePoints: true, factions: skirmishSides("meridian", quickRival("meridian"), 1, QUICK_SETUP.map), rules: { quick: "on" } });

test("golden R3-Q: Quick battle at 20 and 60 s, and a save at 20 s plays on to the same hash", () => {
  const sim = quickMatch();
  const at20 = run(sim, 20), saved = sim.serialize(), at60 = run(sim, 60);
  pin("r3q quick", { 20: at20, 60: at60 }, PINS.quick);
  const loaded = Simulation.load(saved);
  assert.ok(loaded, "the save loads");
  assert.equal(run(loaded, 60), at60, "a loaded Quick battle plays on exactly");
  if (!RECORD) assert.equal(loaded.entities.filter((e) => e.team === 1 && e.kind === "unit").length, sim.entities.filter((e) => e.team === 1 && e.kind === "unit").length);
});

test("golden R3-Q: First watch with the Defence bot at 60 s", () => {
  const level = firstWatchLevel(), hashes = [];
  for (let k = 0; k < 2; k++) {
    const sim = new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level, difficulty: "standard" });
    const bot = new DefenceBot(sim, {});
    hashes.push(run(sim, 60, { step: () => bot.step(TICK) }));
    if (!RECORD) assert.equal(sim.defence.runner?.done, "caught", "the bot's crews catch the runner");
  }
  assert.equal(hashes[0], hashes[1], "deterministic");
  pin("r3q firstWatch", { 60: hashes[0] }, PINS.firstWatch);
});
