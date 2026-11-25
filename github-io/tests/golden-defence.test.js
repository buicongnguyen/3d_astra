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
  // Re-recorded 2026-11-24 (defence pads): short-reach crews reach further and gain more per tier (garrisons.json tier_range: Rangers and Tank post 14/15.5/17.5 m, Mortar 12/13.5/15.5, Flame trap 7/8.5/10) and far pads moved nearer the road (Gorge d1 d2 d4 g10, Bridges s8, Canyon d1 d2); docs/CHANGELOG.md "Defence pads".
  "d-gorge": { options: {}, end: { result: "victory", stars: 3, lives: 20, towers: "r3r3r3b3s2r3b3s1a3b1t3s1b3", hash: "b8278e03" } },
  // Re-recorded 2026-11-24: sturdier support units (Medic 95 + 55 shield, Engineer 150, Supply wagon 340 health; owner request, docs/CHANGELOG.md "Support units hold the rear"); no behaviour change for AI orders.
  // Re-recorded 2026-11-24 (player-only support health): the Medic/Engineer/Supply wagon health buff now applies to team 0 only; computer sides keep 75 + 30, 100, 240 (owner rule: no stronger computer).
  // Re-recorded 2026-11-24 (defence pads): short-reach crews reach further and gain more per tier (garrisons.json tier_range: Rangers and Tank post 14/15.5/17.5 m, Mortar 12/13.5/15.5, Flame trap 7/8.5/10) and far pads moved nearer the road (Gorge d1 d2 d4 g10, Bridges s8, Canyon d1 d2); docs/CHANGELOG.md "Defence pads".
  "d-bridges, demolishing a bridge": { level: "d-bridges", options: { demolish: true }, end: { result: "victory", stars: 3, lives: 19, towers: "r3r3r3r3r3r3r3b2a3s1t1a1t1", hash: "0b34513b" } },
  "d-crossroads": { options: {}, long: true, end: { result: "victory", stars: 3, lives: 20, towers: "b3s3b3s3a3t3b3a3s3b3t3b3s2", hash: "a2c94153" } },
};
test("the DefenceBot on Standard", async (t) => {
  for (const [name, p] of Object.entries(LEVELS))
    await t.test(name, p.long ? LONG : {}, () => pin(name, outcome(playDefence(level(p.level || name), { difficulty: "standard", ...p.options })), p.end));
});

// Endless on Gorge Road with the level's own seed (as check:defence plays it), stopped once 12 waves
// are held: the generated waves, their growth and the bot's long game.
// Re-recorded 2026-11-24 (defence pads): short-reach crews reach further and gain more per tier (garrisons.json tier_range: Rangers and Tank post 14/15.5/17.5 m, Mortar 12/13.5/15.5, Flame trap 7/8.5/10) and far pads moved nearer the road (Gorge d1 d2 d4 g10, Bridges s8, Canyon d1 d2); docs/CHANGELOG.md "Defence pads".
const ENDLESS = { held: 12, wave: 12, lives: 20, hash: "c17298b4" };
test("Endless on Gorge Road to wave 12", LONG, () => {
  const gorge = level("d-gorge");
  const r = playDefence(defenceVariant(gorge, { variant: "endless", seed: seedOf(gorge.id) }), { limit: 6000, maxWaves: 12 });
  pin("d-gorge endless to wave 12", { held: r.held, wave: r.wave, lives: r.lives, hash: r.sim.hash() }, ENDLESS);
});
