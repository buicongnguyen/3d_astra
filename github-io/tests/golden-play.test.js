// Golden gameplay pins (K1): the state hash (sim.hash(), the FNV-1a of the whole save) of whole
// matches played headless by the game's own players: the idle all-Meridian match (d071360b), the
// computer against itself, the DefenceBot and the campaign's ObjectiveBot. A clean-up that must not
// change behaviour leaves every pin as it is. A change meant to alter play updates the pins it
// moves and says which and why in docs/CHANGELOG.md.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { skirmishSides } from "../src/factions.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { MISSIONS } from "../src/story/missions.js";
import { resolveMission } from "../src/story/choices.js";
import { ObjectiveBot } from "../tools/playbot.mjs";
import { playDefence } from "../tools/defence-bot.mjs";

const TICK = 0.05;
// Plays `sim` on to `seconds` of game time (or the end of the match), calling `step` before each
// tick and `see` with each of its events after it, as the balance tools do; returns the state hash.
function run(sim, seconds, { step, see } = {}) {
  const end = Math.round(seconds / TICK);
  while (sim.ticks < end && !sim.result) {
    step?.();
    sim.tick(TICK);
    if (see) for (const e of sim.events) see(e);
    sim.events.length = 0;
  }
  return sim.hash();
}

// 1. The idle match: no AI, every side Meridian, 60 s. Pinned since before the faction framework
// (docs/BALANCE.md); every way of asking for that match must give it.
const IDLE = "d071360b";
test("the idle all-Meridian match after 60 s", async (t) => {
  const asked = {
    "default options": { ai: false },
    "both sides named Meridian": { ai: false, factions: { 0: "meridian", 1: "meridian" } },
    "skirmish sides Meridian against its mirror": { ai: false, factions: skirmishSides("meridian", "mirror", 1, "classic") },
  };
  for (const [name, options] of Object.entries(asked))
    await t.test(name, () => assert.equal(run(new Simulation(options), 60), IDLE));
});

// 2. The computer plays every side (aiPlayer), checked at 60, 180 and 300 s. A match that ends
// sooner keeps its final state, so a later pin repeats the last hash; `end` is how it ended.
const AI = {
  "classic x1 normal": { options: { map: "classic", enemyCount: 1, aiSpeed: "normal" }, at: { 60: "fef65c4f", 180: "39426dbc", 300: "6d992886" }, end: "defeat 231" },
  "highlands x2 relentless coalition": { options: { map: "highlands", enemyCount: 2, aiSpeed: "relentless", alliance: "coalition" }, at: { 60: "807ca1eb", 180: "5450ac4a", 300: "45ab65f9" }, end: "defeat 181" },
  "riverlands x2 fast": { options: { map: "riverlands", enemyCount: 2, aiSpeed: "fast" }, at: { 60: "30be65e6", 180: "d16fd4cd", 300: "3f77c63b" }, end: "running 300" },
  "basin x3 fast": { options: { map: "basin", enemyCount: 3, aiSpeed: "fast" }, at: { 60: "853fdf6c", 180: "8422f5d9", 300: "db45b921" }, end: "defeat 246" },
};
test("AI against AI", async (t) => {
  for (const [name, pin] of Object.entries(AI))
    await t.test(name, async (tt) => {
      const sim = new Simulation({ ...pin.options, aiPlayer: true });
      for (const [at, hash] of Object.entries(pin.at)) await tt.test(`${at} s`, () => assert.equal(run(sim, +at), hash));
      await tt.test("the end", () => assert.equal(`${sim.result || "running"} ${Math.round(sim.time)}`, pin.end));
    });
});

// 3. The DefenceBot (tools/defence-bot.mjs) plays a level to its end on Standard.
const DEFENCE = {
  "d-gorge": { options: {}, end: { result: "victory", stars: 3, lives: 20, hash: "d05fdf96" } },
  "d-bridges, demolishing a bridge": { level: "d-bridges", options: { demolish: true }, end: { result: "victory", stars: 3, lives: 18, hash: "b3595628" } },
  "d-crossroads": { options: {}, end: { result: "victory", stars: 2, lives: 15, hash: "23c88f85" } },
};
test("the DefenceBot on Standard", async (t) => {
  for (const [name, pin] of Object.entries(DEFENCE))
    await t.test(name, () => {
      const level = DEFENCE_LEVELS.find((l) => l.id === (pin.level || name));
      const r = playDefence(level, { difficulty: "standard", ...pin.options });
      assert.deepEqual({ result: r.result, stars: r.stars, lives: r.lives, hash: r.sim.hash() }, pin.end);
    });
});

// 4. The campaign's ObjectiveBot (tools/playbot.mjs) for the first 120 s, on Standard with the
// default decisions, as tools/mission-check.mjs plays it: the first mission, the Iron Vanguard boss
// (mission 3) and the air mission (6b).
const CAMPAIGN = { "m01-first-light": "a740365c", "m03-the-ashen-line": "9d9693b6", "m06b-wings-over-copper": "223ff814" };
test("the ObjectiveBot for 120 s", async (t) => {
  for (const [id, hash] of Object.entries(CAMPAIGN))
    await t.test(id, () => {
      const mission = resolveMission(MISSIONS.find((m) => m.id === id), null);
      const sim = new Simulation({ difficulty: "standard", map: mission.map, enemyCount: mission.enemies, aiSpeed: mission.speed, alliance: mission.alliance, playerBonus: mission.bonus || null, mission });
      const bot = new ObjectiveBot(sim, sim.missionDef, { decide: "default" });
      assert.equal(run(sim, 120, { step: () => bot.step(), see: (e) => bot.see(e) }), hash);
    });
});
