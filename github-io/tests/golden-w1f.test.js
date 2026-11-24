// Golden pin, W1-F (tower aim): the DefenceBot plays Gorge Road on Standard and a second player sets every
// tower's aim, `first` on the odd towers and `strong` on the even ones, every two seconds. The state hash
// is taken the moment wave 3 and wave 6 start. Pins are re-recorded only by the integrator, with a named
// reason (docs/TESTING.md, "Golden pins and baselines"); GOLDEN_RECORD=1 prints the values.
import test from "node:test";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { Simulation } from "../src/simulation.js";
import { DefenceBot } from "../tools/defence-bot.mjs";
import { pin } from "./lib/golden.mjs";

const GORGE = DEFENCE_LEVELS.find((l) => l.id === "d-gorge");
// Re-recorded 2026-11-24 (defence pads): short-reach crews reach further and gain more per tier (garrisons.json tier_range: Rangers and Tank post 14/15.5/17.5 m, Mortar 12/13.5/15.5, Flame trap 7/8.5/10) and far pads moved nearer the road (Gorge d1 d2 d4 g10, Bridges s8, Canyon d1 d2); docs/CHANGELOG.md "Defence pads".
const EXPECTED = { "wave 3": { hash: "5fb211bf", aimed: 4 }, "wave 6": { hash: "18600c1e", aimed: 8 } };

test("Gorge Road with padAim (first and strong): hashes at waves 3 and 6", () => {
  const sim = new Simulation({ map: GORGE.map, enemyCount: 1, ai: false, mission: GORGE, difficulty: "standard" });
  const bot = new DefenceBot(sim, {});
  const got = {};
  let clock = 0;
  for (let i = 0; i < 1500 * 20 && !sim.result && sim.defence.wave < 6; i++) {
    bot.step(0.05);
    if ((clock -= 0.05) <= 0) {
      clock = 2;
      sim.entities.filter((e) => e.team === 0 && e.crew && e.hp > 0).forEach((t, k) => sim.command({ team: 0, type: "padAim", building: t.id, aim: k % 2 ? "strong" : "first" }));
    }
    sim.tick(0.05);
    for (const n of [3, 6]) if (sim.defence.wave >= n && !got[`wave ${n}`]) got[`wave ${n}`] = { hash: sim.hash(), aimed: sim.entities.filter((e) => e.aim).length };
  }
  pin("w1f padAim d-gorge", got, EXPECTED);
});
