// Golden gameplay pins, story (K1). The first 120 s of campaign and Chronicle missions on Standard
// with the default decisions, played as tools/mission-check.mjs plays them: the ObjectiveBot
// (tools/playbot.mjs), or the DefenceBot for a mission under the Frontier Defence rules. A clean-up
// that must not change behaviour leaves every pin as it is.
//
// Pins are re-recorded only by the integrator, with a named reason (docs/TESTING.md, "Golden pins
// and baselines"). GOLDEN_RECORD=1 prints the values.
import test from "node:test";
import { MISSIONS } from "../src/story/missions.js";
import { CHRONICLES } from "../src/story/chronicles.js";
import { resolveMission } from "../src/story/choices.js";
import { playDefence } from "../tools/defence-bot.mjs";
import { missionMatch } from "./lib/sim.js";
import { pin } from "./lib/golden.mjs";

const SECONDS = 120;
const find = (id) => [...MISSIONS, ...CHRONICLES.flatMap((c) => c.missions)].find((m) => m.id === id);

// The ObjectiveBot: the first mission, the Iron Vanguard boss (mission 3), the air mission (6b) and
// the Ashfall Chronicle's first mission (its faction roster).
// R3-I (round 3, campaign pacing): m01 re-recorded for its first-contact probe, m03 for its retune; old 03e8cb2b / 59c479c0.
const OBJECTIVE = { "m01-first-light": "64473474", "m03-the-ashen-line": "f86e00b1", "m06b-wings-over-copper": "56d5c731", "ca1-cold-berths": "c9716b32" };
test(`the ObjectiveBot for ${SECONDS} s`, async (t) => {
  for (const [id, hash] of Object.entries(OBJECTIVE))
    await t.test(id, () => pin(id, missionMatch(find(id)).run(SECONDS), hash));
});

// Hold the River (mission 2b) is played under the Frontier Defence rules: the DefenceBot calls and
// fights its first waves.
const DEFENCE = { "m02b-hold-the-river": { wave: 4, lives: 20, hash: "4c430aeb" },
  // W2-F m11c Hold the Keystone Roads (new mission; same run as golden-w2f.test.js): added by the Wave 2 integrator.
  "m11c-hold-the-keystone-roads": { wave: 2, lives: 20, hash: "a929add0" } };
test(`the DefenceBot on a story mission for ${SECONDS} s`, async (t) => {
  for (const [id, end] of Object.entries(DEFENCE))
    await t.test(id, () => {
      const r = playDefence(resolveMission(find(id), null), { difficulty: "standard", limit: SECONDS });
      pin(id, { wave: r.wave, lives: r.lives, hash: r.sim.hash() }, end);
    });
});
