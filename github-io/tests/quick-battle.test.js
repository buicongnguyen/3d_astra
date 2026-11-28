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
import { QUICK, QUICK_SETUP, quickRival, quickRules, ARENA, arenaEnterAt, arenaMarchAt, arenaNextMarch } from "../src/sim/content/quick-battle.js";
import { restore } from "../src/snapshot.js";
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
  for (const text of ["Quick battle", "Ready base · 1 rival", "Enemy roster", "Scout Runner", "Bonus alloy", "Enemy scouts sighted! Meet them at your tower.", "Scout Runner caught: bonus alloy!",
    "Enemy army marches in", "The enemy army is marching on your base!", "Full army sandbox: try every unit and ability. The enemy army waits on its side and marches at 0:30."]) {
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

// Full army sandbox, the enemy army (owner 2026-11-28: "the enemy should have the unit at the map in their side and they will
// march to attack at given time. Currently they appear suddenly"). Before: eight groups of ten popped in 44 m from your core
// (25 m from theirs) on the rival's think at or after 0:25, 1:00, ... every 35 s, and attack-moved at once; first contact at
// 31.1-31.3 s with nobody playing (.tmp bench, all five factions). Now group 1 stands at the muster point on the rival's half
// from the start and marches at 0:30; later groups walk in from behind the rival core at the old wave times and march 20 s later.
const arenaSim = (player = "meridian") => new Simulation({ map: QUICK_SETUP.map, aiSpeed: QUICK_SETUP.aiSpeed, enemyCount: 1, alliance: QUICK_SETUP.alliance, capturePoints: true, factions: skirmishSides(player, quickRival(player), 1, QUICK_SETUP.map), rules: { quick: "arena" } });
const OLD_WAVE = (k) => ARENA.firstWave + k * ARENA.every; // when wave k used to appear (at the earliest)

test("Full army sandbox: the enemy army stands on its own side and marches on a clock, never sooner or bigger than before", () => {
  // The schedule: no group is on the map or marches sooner than its old wave appeared (group 1 stands from the start, on its side).
  assert.equal(ARENA.waves, 8);
  for (let k = 0; k < ARENA.waves; k++) {
    assert.ok(arenaMarchAt(k) >= OLD_WAVE(k), `group ${k + 1} marches at ${arenaMarchAt(k)} s, its wave came at ${OLD_WAVE(k)} s`);
    if (k) assert.equal(arenaEnterAt(k), OLD_WAVE(k), `group ${k + 1} walks in when its wave used to appear`);
  }
  for (const player of ["meridian", "ashfall", "sunward", "wardens", "veil"]) {
    const s = arenaSim(player), home = s.entities.find((e) => e.team === 0 && e.type === "hq"), rival = s.entities.find((e) => e.team === 1 && e.type === "hq");
    const near = (e, c) => Math.hypot(e.x - c.x, e.z - c.z);
    const seen = new Set(s.entities.map((e) => e.id));
    let group = 0, contact = null, marched = 0, ruleUnits = 0;
    while (s.time < 300 && !s.result) {
      s.tick(TICK);
      for (const e of s.entities) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        if (e.team !== 1 || e.kind !== "unit") continue;
        // Nothing of the rival's appears on your half after the start: the AI's trainees at its buildings, the groups at the muster
        // point (group 1) or behind the rival core.
        assert.ok(near(e, rival) < near(e, home), `${player}: ${e.type} appeared ${near(e, home).toFixed(1)} m from your core at ${s.time.toFixed(2)} s`);
        if (e.tag === "arena") { ruleUnits++; if (s.time > 1) assert.ok(near(e, home) > 60, `${player}: a later group walks in behind the rival core (${near(e, home).toFixed(1)} m)`); }
      }
      if (s.time < 1 && !group && s.entities.some((e) => e.tag === "arena")) {
        group = 1;
        const g = s.entities.filter((e) => e.tag === "arena");
        assert.equal(g.length, ARENA.squad.length * 2, `${player}: group 1 stands ready`);
        for (const e of g) assert.ok(near(e, home) >= ARENA.muster - 1 && near(e, rival) < near(e, home), `${player}: group 1 on the rival's half`);
        assert.deepEqual(arenaNextMarch(s), { at: ARENA.firstMarch, group: 1 }, "the HUD counts down to 0:30");
      }
      const k = s.players[1].arenaWaves || 0;
      if (k > marched) {
        marched = k;
        assert.ok(s.time >= arenaMarchAt(k - 1) - 1e-9 && s.time < arenaMarchAt(k - 1) + TICK + 1e-9, `${player}: group ${k} marched at ${s.time.toFixed(2)} s`);
        assert.ok(s.time >= OLD_WAVE(k - 1), "never before its old wave");
      }
      for (const ev of s.events) if (contact === null && ev.type === "shot" && s.get(ev.target)?.team === 0) contact = s.time;
      s.events.length = 0;
    }
    assert.ok(ruleUnits <= ARENA.waves * ARENA.squad.length * 2, `${player}: ${ruleUnits} units at most as before`);
    assert.ok(contact >= 31.1, `${player}: first contact at ${contact?.toFixed(1)} s (was 31.1 s)`);
  }
});

test("Full army sandbox: a saved match plays on exactly (the waiting group, the clock and the marches)", () => {
  const a = arenaSim("sunward");
  while (a.time < 50) { a.tick(TICK); a.events.length = 0; }
  const b = restore(Simulation, a.serialize());
  assert.ok(b, "restored");
  for (const s of [a, b]) while (s.time < 125) { s.tick(TICK); s.events.length = 0; }
  assert.equal(b.hash(), a.hash());
  assert.ok(a.players[1].arenaWaves >= 3, `groups marched: ${a.players[1].arenaWaves}`);
  // Two fresh runs agree tick for tick (no wall clock, no Math.random).
  const c = arenaSim("sunward");
  while (c.time < 125) { c.tick(TICK); c.events.length = 0; }
  assert.equal(c.hash(), a.hash());
});
