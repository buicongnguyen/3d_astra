// Golden gameplay pins, Frontier Defence (K1). The DefenceBot (tools/defence-bot.mjs, as
// `npm run check:defence` plays it) on Standard: the final state hash, result, stars, lives and the
// towers standing at the end, and Endless on Gorge Road to wave 12. A clean-up that must not change
// behaviour leaves every pin as it is.
//
// Pins are re-recorded only by the integrator, with a named reason (docs/TESTING.md, "Golden pins
// and baselines"). GOLDEN_RECORD=1 prints the values; GOLDEN_FULL=1 adds the long runs (Three Roads,
// Endless): `npm run test:golden-full`.
import test from "node:test";
import { DEFENCE_LEVELS, defenceVariant } from "../src/defence/levels.js";
import { seedOf } from "../src/sim/defence.js";
import { playDefence } from "../tools/defence-bot.mjs";
import { LONG, pin } from "./lib/golden.mjs";

const level = (id) => DEFENCE_LEVELS.find((l) => l.id === id);
const outcome = (r) => ({ result: r.result, stars: r.stars, lives: r.lives, towers: r.towers, hash: r.sim.hash() });

// The DefenceBot plays a level to its end on Standard. `towers` lists each crewed tower standing at
// the end: crew initial, tier, branch initial and rank (tools/defence-bot.mjs).
const LEVELS = {
  "d-gorge": { options: {}, end: { result: "victory", stars: 3, lives: 20, towers: "r3mr3r3b3s1r3b3s1a3b2t3s1b1", hash: "3f391c5e" } },
  // Re-recorded 2026-11-24: sturdier support units (Medic 95 + 55 shield, Engineer 150, Supply wagon 340 health; owner request, docs/CHANGELOG.md "Support units hold the rear"); no behaviour change for AI orders.
  "d-bridges, demolishing a bridge": { level: "d-bridges", options: { demolish: true }, end: { result: "victory", stars: 3, lives: 18, towers: "r3r3r3r3r3r3r3b1a3s1t1a2t1", hash: "f50677e3" } },
  "d-crossroads": { options: {}, long: true, end: { result: "victory", stars: 2, lives: 15, towers: "b3s3b3s3a3t3b3a3s3b3t3s1b3", hash: "c77144f6" } },
};
test("the DefenceBot on Standard", async (t) => {
  for (const [name, p] of Object.entries(LEVELS))
    await t.test(name, p.long ? LONG : {}, () => pin(name, outcome(playDefence(level(p.level || name), { difficulty: "standard", ...p.options })), p.end));
});

// Endless on Gorge Road with the level's own seed (as check:defence plays it), stopped once 12 waves
// are held: the generated waves, their growth and the bot's long game.
const ENDLESS = { held: 12, wave: 12, lives: 20, hash: "5167e811" };
test("Endless on Gorge Road to wave 12", LONG, () => {
  const gorge = level("d-gorge");
  const r = playDefence(defenceVariant(gorge, { variant: "endless", seed: seedOf(gorge.id) }), { limit: 6000, maxWaves: 12 });
  pin("d-gorge endless to wave 12", { held: r.held, wave: r.wave, lives: r.lives, hash: r.sim.hash() }, ENDLESS);
});
