// First-minute hooks (AAA round 3, R3-Q): Quick battle and First watch, headless.
//  - Quick battle: the setup (Riverlands, one Relaxed rival of another faction), the rule that is never
//    stored or shown, the ready outpost and the scouts, and a first fight by 45 s with nobody playing.
//  - First watch: new variant data only (Gorge Road and its other variants untouched), the roster, and
//    the Scout Runner (out with wave 1, unarmed, free to escape, bonus alloy when caught).
// The bot measurements (win rates, time to first combat with a player) are tests/quick-battle-check.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Simulation } from "../src/simulation.js";
import { RULE_OPTIONS } from "../src/app/rule-options.js";
import { activeRules } from "../src/app/rules-store.js";
import { QUICK, QUICK_SETUP, quickRival, quickRules } from "../src/sim/content/quick-battle.js";
import { DEFENCE_LEVELS, defenceVariant } from "../src/defence/levels.js";
import { firstWatch, firstWatchLevel, rosterOf, RUNNER } from "../src/defence/first-watch.js";
import { skirmishSides } from "../src/factions.js";
import { GARRISONS } from "../src/sim/defence.js";
import { DEFINITIONS as D } from "../src/data.js";
import { TICK } from "./lib/sim.js";
import { DefenceBot } from "../tools/defence-bot.mjs";

const firstShot = (s, e) => e.type === "shot" && (e.team === 0 || s.get(e.target)?.team === 0);

test("Quick battle: one gentle rival, a rule never stored or shown, a ready outpost and scouts by 0:45", () => {
  assert.deepEqual({ ...QUICK_SETUP }, { map: "riverlands", enemyCount: 1, aiSpeed: "relaxed", alliance: "ffa" });
  assert.equal(quickRival("meridian"), "ashfall");
  assert.equal(quickRival("ashfall"), "meridian");
  // Only the rule: the player's own battle rules stay theirs, and `quick` is never remembered or listed.
  assert.deepEqual(quickRules({ roster: "expanded", aiPlan: "field" }, true), { quick: "on" });
  assert.deepEqual(quickRules({ roster: "expanded", quick: "on" }, false), { roster: "expanded" });
  assert.equal(quickRules({ quick: "on" }, false), null);
  assert.equal(activeRules({ quick: "on" }), null);
  assert.ok(!RULE_OPTIONS.some((o) => o.id === "quick"));

  const s = new Simulation({ map: QUICK_SETUP.map, aiSpeed: QUICK_SETUP.aiSpeed, enemyCount: 1, capturePoints: true, factions: skirmishSides("meridian", quickRival("meridian"), 1, QUICK_SETUP.map), rules: { quick: "on" } });
  const count = (team, type) => s.entities.filter((e) => e.team === team && e.type === type && e.hp > 0).length;
  const [workers, alloy] = [count(0, "worker"), s.players[0].alloy];
  let combat = null, scouts = null;
  while (s.time < 46 && combat === null) {
    s.tick(TICK);
    if (s.ticks === 1) {
      assert.equal(count(0, "tower"), 1, "a Sentinel tower stands from the start");
      assert.equal(count(0, "relay"), 1, "and a Supply relay");
      assert.equal(count(0, "worker"), workers + QUICK.workers);
      assert.equal(s.players[0].alloy, alloy + QUICK.alloy);
    }
    for (const e of s.events) {
      if (e.type === "incoming" && e.quick) scouts = s.time;
      if (combat === null && firstShot(s, e)) combat = s.time;
    }
    s.events.length = 0;
  }
  assert.ok(scouts >= QUICK.scoutAt && scouts < QUICK.scoutAt + 4.1, `scouts set off at ${scouts}`);
  assert.ok(combat !== null && combat <= 45, `first combat at ${combat} s (limit 45)`);
  assert.equal(s.entities.filter((e) => e.team === 1 && e.type === "scrapper").length >= 2, true, "Ashfall scouts field their own Vanguards (Scrappers)");
});

test("First watch: new data for level 1 only, the roster, and a Scout Runner that pays alloy and costs no lives", () => {
  const gorge = DEFENCE_LEVELS[0];
  assert.equal(gorge.id, "d-gorge");
  assert.equal(gorge.defence.runner, undefined, "the designed level is not edited");
  assert.equal(gorge.defence.preview, undefined);
  const fw = firstWatchLevel();
  assert.deepEqual(fw.defence.runner, { ...RUNNER });
  assert.equal(fw.id, "d-gorge", "stars still count for Gorge Road");
  assert.equal(fw.defence.waves, gorge.defence.waves, "the designed waves, untouched");
  for (const variant of ["endless", "daily", "heroic"]) {
    const v = defenceVariant(gorge, { variant, seed: 7 });
    assert.equal(firstWatch(v), v, `${variant} stays as it is`);
  }
  assert.equal(firstWatch(DEFENCE_LEVELS[1]), DEFENCE_LEVELS[1], "other levels stay as they are");
  assert.deepEqual(rosterOf(gorge).map((r) => `${r.slot}:${r.wave}`), ["vanguard:1", "ranger:2", "breaker:4", "kite:5", "tank:7", "balloon:7"]);

  // Nobody builds: the runner sets off with wave 1, unarmed, and runs through without costing a life.
  const s = new Simulation({ map: fw.map, enemyCount: 1, ai: false, mission: fw, difficulty: "standard" });
  const phases = [];
  while (s.time < 90 && !phases.includes("escaped")) {
    s.tick(TICK);
    for (const e of s.events) if (e.type === "runner") phases.push(e.phase);
    s.events.length = 0;
    const r = s.entities.find((u) => u.runner);
    if (r) assert.equal(r.damage, 0, "the runner never shoots");
    if (s.defence.runner && !phases.includes("escaped") && !s.entities.some((u) => u.id === s.defence.runner.id)) phases.push("escaped");
  }
  assert.deepEqual(phases, ["out", "escaped"]);
  assert.equal(s.defence.lives, 20, "an escaped runner costs no lives");

  // The Defence bot's crews catch it: the bounty is the rider's times RUNNER.bounty.
  const c = new Simulation({ map: fw.map, enemyCount: 1, ai: false, mission: fw, difficulty: "standard" });
  const bot = new DefenceBot(c, {});
  let caught = null;
  while (c.time < 60 && caught === null) {
    bot.step(TICK);
    c.tick(TICK);
    for (const e of c.events) if (e.type === "bounty" && c.defence.runner?.done === "caught" && caught === null) caught = e.amount;
    c.events.length = 0;
  }
  const worth = Math.ceil((D.rider.cost[0] + D.rider.cost[1]) * GARRISONS.bounty) * RUNNER.bounty;
  assert.equal(caught, worth, `caught for ${worth} alloy`);
  assert.equal(c.defence.runner.done, "caught");

  // The title slot and the strings: one direct button, its words in both catalogs.
  const vi = JSON.parse(readFileSync(new URL("../src/locales/vi.json", import.meta.url), "utf8")).messages;
  const ko = JSON.parse(readFileSync(new URL("../src/locales/ko.json", import.meta.url), "utf8")).messages;
  for (const text of ["Quick battle", "Ready base · 1 rival", "Enemy roster", "Scout Runner", "Bonus alloy", "Enemy scouts sighted! Meet them at your tower.", "Scout Runner caught: bonus alloy!"]) {
    assert.ok(vi[text] && ko[text], text);
  }
  const css = readFileSync(new URL("../src/quick-battle.css", import.meta.url), "utf8");
  assert.ok(!/system-ui/.test(css), "no system-ui");
  for (const [, size] of css.matchAll(/font:\s*\d+\s+(\d+)px/g)) assert.ok(Number(size) >= 11, `font ${size}px`);
  for (const [, size] of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(size) >= 11, `font-size ${size}px`);
});

// Full army fairness (review 2026-11-25: one real-time Meridian run lost an attack-move at 0:03 while
// the others won). Headless, every faction's Full army is worth about the same and an attack-move of
// the whole army onto the rival core at 0:03 or 0:10 (an app tap on an unseen core is an attack-move)
// wins for every faction (.tmp bench: 42-54 s for Meridian, 30-54 s for the others).
test("Full army: every faction's army is worth about the same and an early attack-move wins", () => {
  const worth = (e) => (D[e.type]?.cost?.[0] || 0) + (D[e.type]?.cost?.[1] || 0);
  const values = {};
  for (const player of ["meridian", "ashfall", "sunward", "wardens", "veil"]) for (const at of [3, 10]) {
    const s = new Simulation({ map: QUICK_SETUP.map, aiSpeed: QUICK_SETUP.aiSpeed, enemyCount: 1, alliance: QUICK_SETUP.alliance, capturePoints: true, factions: skirmishSides(player, quickRival(player), 1, QUICK_SETUP.map), rules: { quick: "arena" } });
    const army = () => s.entities.filter((e) => e.team === 0 && e.kind === "unit" && e.hp > 0 && e.type !== "worker");
    while (s.time < at) { s.tick(TICK); s.events.length = 0; }
    // The free Skywing (2026-11-28) is an extra to try, not the faction's army.
    values[player] = army().filter((e) => !e.assist).reduce((n, e) => n + worth(e), 0);
    const core = s.entities.find((e) => e.team === 1 && e.type === "hq");
    s.command({ team: 0, type: "order", ids: army().map((e) => e.id), order: { type: "attackmove", x: core.x, z: core.z } });
    while (s.time < 90 && !s.result) { s.tick(TICK); s.events.length = 0; }
    assert.equal(s.result, "victory", `${player} vs ${quickRival(player)}, attack-move at ${at} s: ${s.result || "no result"} at ${Math.round(s.time)} s`);
  }
  const all = Object.values(values), low = Math.min(...all), high = Math.max(...all);
  assert.ok(high / low < 1.15, `army values within 15%: ${JSON.stringify(values)}`);
});
