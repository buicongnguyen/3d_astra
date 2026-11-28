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
// 2026-11-23 (owner): m03 re-recorded for the Iron Vanguard's health, 32,000 to 11,000 (story 9,000); old f86e00b1.
// 2026-11-24 (campaign C1, pacing): m03 re-recorded for siphons at 4200 HP; old 57c186ff.
// Re-recorded 2026-11-25 (concise story lines): text only. The hash covers the mission definition, so the shorter say lines move it; with the old lines put back the run reproduces the old pin exactly (same waves, lives, result), so play is unchanged. Old m01 64473474, m03 b16d4a20, m06b 56d5c731, ca1 c9716b32, m02b 11165d27, m11c 17daacde.
// Re-recorded 2026-11-28 owner: player Harvesters go to work on their own (sendToWork). A newly trained Harvester sets off
// at once instead of waiting for the bot's next "harvest" (idle Harvester-seconds in 120 s: m01 16 to 5, m03 24 to 10,
// m06b 17 to 3, ca1 22 to 6; mined the same or more); with sendToWork switched off the run reproduces every old pin
// exactly. Old m01 67462110, m03 20f108f2, m06b dd931713, ca1 bd841655.
const OBJECTIVE = { "m01-first-light": "5543cb08", "m03-the-ashen-line": "a16f9981", "m06b-wings-over-copper": "359d84b3", "ca1-cold-berths": "dc833f02" };
test(`the ObjectiveBot for ${SECONDS} s`, async (t) => {
  for (const [id, hash] of Object.entries(OBJECTIVE))
    await t.test(id, () => pin(id, missionMatch(find(id)).run(SECONDS), hash));
});

// Hold the River (mission 2b) is played under the Frontier Defence rules: the DefenceBot calls and
// fights its first waves.
// Re-recorded 2026-11-24 (defence pads): short-reach crews reach further and gain more per tier (garrisons.json tier_range: Rangers and Tank post 14/15.5/17.5 m, Mortar 12/13.5/15.5, Flame trap 7/8.5/10) and far pads moved nearer the road (Gorge d1 d2 d4 g10, Bridges s8, Canyon d1 d2); docs/CHANGELOG.md "Defence pads".
const DEFENCE = { "m02b-hold-the-river": { wave: 4, lives: 20, hash: "336e99c8" },
  // W2-F m11c Hold the Keystone Roads (new mission; same run as golden-w2f.test.js): added by the Wave 2 integrator.
  // Re-recorded 2026-11-24 (defence pads): short-reach crews reach further and gain more per tier (garrisons.json tier_range: Rangers and Tank post 14/15.5/17.5 m, Mortar 12/13.5/15.5, Flame trap 7/8.5/10) and far pads moved nearer the road (Gorge d1 d2 d4 g10, Bridges s8, Canyon d1 d2); docs/CHANGELOG.md "Defence pads".
  "m11c-hold-the-keystone-roads": { wave: 2, lives: 20, hash: "90769bd0" } };
test(`the DefenceBot on a story mission for ${SECONDS} s`, async (t) => {
  for (const [id, end] of Object.entries(DEFENCE))
    await t.test(id, () => {
      const r = playDefence(resolveMission(find(id), null), { difficulty: "standard", limit: SECONDS });
      pin(id, { wave: r.wave, lives: r.lives, hash: r.sim.hash() }, end);
    });
});
