// H3c, the steward (src/sim/steward.js): the computer runs the player's base and army at Normal pace
// while the player fights as the hero. It builds an economy and towers under fire, never orders a
// hero, leaves units the player just ordered alone, keeps the player's rules, stays home in story
// missions and crews pads in Defence.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { fieldPlan, sharpSide, AI_SPEEDS } from "../src/ai-plan.js";
import { restore } from "../src/snapshot.js";
import { STEWARD_KEEP } from "../src/sim/steward.js";

const TICK = 0.05;
const run = (s, seconds, each) => { for (let i = 0, n = Math.round(seconds / TICK); i < n && !s.result; i++) { s.tick(TICK); each?.(); s.events.length = 0; } };
const own = (s, type) => s.own(0).filter((e) => e.type === type);
const units = (s) => s.own(0).filter((e) => e.kind === "unit" && e.type !== "worker");

test("off by default: no steward state, and the command door turns it on and off", () => {
  const s = new Simulation({ map: "classic", ai: false });
  assert.equal("steward" in s, false);
  const before = s.hash();
  assert.equal(s.command({ team: 0, type: "steward", on: true }), true);
  assert.equal(s.stewardOn(0), true);
  assert.equal(s.command({ team: 0, type: "steward", on: false }), true);
  assert.equal("steward" in s, false, "the last team off removes the state");
  assert.equal(s.hash(), before, "on then off at once leaves the match as it was");
  assert.equal(s.command({ team: 1, type: "steward", on: true }), false, "only a human side");
  const bench = new Simulation({ map: "classic", aiPlayer: true });
  assert.equal(bench.setSteward(true, 0), false, "a side the computer already plays has none");
});

test("the steward builds an economy: Harvesters, a Supply relay, a Barracks and fighters", () => {
  const s = new Simulation({ map: "classic", ai: false });
  s.setSteward(true);
  const workers0 = own(s, "worker").length;
  run(s, 180);
  assert.ok(own(s, "worker").length >= workers0 + 3, `workers ${own(s, "worker").length}`);
  assert.ok(own(s, "relay").length >= 1, "a Supply relay");
  assert.ok(own(s, "barracks").some((b) => b.complete), "a Barracks");
  assert.ok(units(s).length >= 3, `army ${units(s).length}`);
  assert.ok(own(s, "worker").some((w) => w.carry > 0 || w.orders.some((o) => o.type === "gather" || o.type === "deliver")), "Harvesters at work");
});

test("Normal pace whatever the rivals play at, and the match speed is put back after each think", () => {
  const s = new Simulation({ map: "classic", aiSpeed: "relentless" });
  const seen = [];
  const think = s.updateAI.bind(s);
  s.updateAI = (team) => { if (team === 0) seen.push({ speed: s.aiSpeed, think: s.pace.think, human: s.humanTeam(0), field: fieldPlan(s, 0), sharp: sharpSide(s, 0) }); return think(team); };
  s.setSteward(true);
  run(s, 12);
  assert.ok(seen.length >= 4, `thinks ${seen.length}`);
  for (const v of seen) assert.deepEqual(v, { speed: "normal", think: AI_SPEEDS.normal.think, human: true, field: false, sharp: false });
  assert.equal(s.aiSpeed, "relentless");
  assert.equal(s.pace.think, AI_SPEEDS.relentless.think);
});

test("under attack it raises a Sentinel tower", () => {
  const s = new Simulation({ map: "classic", ai: false });
  s.setSteward(true);
  run(s, 60);
  const hq = own(s, "hq")[0];
  s.players[0].alloy += 400;
  const raiders = [0, 1, 2].map((i) => s.spawn("ranger", 1, hq.x + 6 + i, hq.z + 6));
  s.issue(raiders.map((e) => e.id), { type: "attack", target: hq.id });
  run(s, 30, () => { if (raiders.some((e) => e.hp > 0)) hq.hitAt = s.time; });
  assert.ok(own(s, "tower").length >= 1, `towers ${own(s, "tower").length}`);
});

test("it never orders a hero, an assist unit or a 'hero' tagged unit", () => {
  const s = new Simulation({ map: "classic", ai: false });
  const hq = s.own(0).find((e) => e.type === "hq");
  const heroes = [s.spawn("ranger", 0, hq.x + 5, hq.z), s.spawn("vanguard", 0, hq.x - 5, hq.z), s.spawn("ranger", 0, hq.x, hq.z + 5)];
  heroes[0].hero = "vale"; heroes[1].assist = true; heroes[2].hero = true;
  s.setSteward(true);
  run(s, 40);
  // A raid at the core: the steward answers it with everyone else.
  const raiders = [0, 1, 2, 3].map((i) => s.spawn("ranger", 1, hq.x + 8 + i, hq.z - 8));
  s.issue(raiders.map((e) => e.id), { type: "attack", target: hq.id });
  let ordered = 0;
  run(s, 30, () => { for (const h of heroes) if (h.hp > 0 && h.orders.length) ordered++; });
  assert.equal(ordered, 0, "no hero ever got an order");
  assert.ok(units(s).some((e) => !heroes.includes(e) && e.orders.some((o) => o.type === "attack")) || raiders.every((e) => e.hp <= 0), "the rest defended");
});

test("units the player ordered keep the order until it is done, then the steward takes them", () => {
  const s = new Simulation({ map: "classic", ai: false });
  const hq = s.own(0).find((e) => e.type === "hq");
  const scout = s.spawn("ranger", 0, hq.x + 4, hq.z);
  const early = s.spawn("ranger", 0, hq.x - 4, hq.z);
  // An order given before the steward came on, inside the KEEP window, counts too.
  s.command({ team: 0, type: "order", ids: [early.id], order: { type: "move", x: hq.x - 30, z: hq.z } });
  run(s, 2);
  s.setSteward(true);
  s.command({ team: 0, type: "order", ids: [scout.id], order: { type: "move", x: 0, z: 0 } });
  const goal = { ...scout.orders[0] };
  const raiders = [0, 1, 2, 3].map((i) => s.spawn("ranger", 1, hq.x + 8 + i, hq.z - 8));
  s.issue(raiders.map((e) => e.id), { type: "attack", target: hq.id });
  let kept = true;
  run(s, 12, () => { if (scout.orders.length && (scout.orders[0].x !== goal.x || scout.orders[0].type !== "move")) kept = false; });
  assert.ok(kept, "the player's move was never replaced");
  assert.ok(early.playerAt !== undefined && s.stewardMay(early) === false, "the earlier order is kept as well");
  // Done and past the window: the steward's again.
  scout.orders = []; scout.path = [];
  run(s, STEWARD_KEEP);
  assert.equal(s.stewardMay(scout), true);
  assert.equal(scout.playerAt, undefined);
  // Off: every mark is cleared and nothing the player queued is touched.
  s.command({ team: 0, type: "order", ids: [scout.id], order: { type: "move", x: 10, z: 10 } });
  s.setSteward(false);
  assert.equal(scout.orders[0].type, "move");
  assert.ok(s.own(0).every((e) => e.playerAt === undefined));
});

test("the player keeps the player's rules: air cap by core level, autocast switch, player prices", () => {
  const s = new Simulation({ map: "classic", ai: false });
  s.setSteward(true);
  const hq = s.own(0).find((e) => e.type === "hq");
  hq.level = 3; hq.supply = 60;
  const capOn = s.airCap(0);
  s.setSteward(false);
  assert.equal(capOn, s.airCap(0), "the same cap with or without the steward");
  assert.ok(capOn > 4, `core level 3 cap ${capOn}, not the computer's flat 4`);
  // Autocast and the other computer-side rules key on "team > 0 || sim.aiPlayer" (sim/tactics.js, sim/air.js,
  // content/signatures.js, kite-dive.js, air-strikes.js): the steward never sets aiPlayer, so they keep the player's side.
  s.setSteward(true);
  let during = null;
  const think = s.updateAI.bind(s);
  s.updateAI = (team) => { if (team === 0) during ??= { aiPlayer: !!s.aiPlayer, human: s.humanTeam(0), cap: s.airCap(0), autocast: s.players[0].autocast }; return think(team); };
  run(s, 3);
  assert.deepEqual(during, { aiPlayer: false, human: true, cap: capOn, autocast: new Simulation({ map: "classic", ai: false }).players[0].autocast });
  const plain = new Simulation({ map: "classic", ai: false });
  for (const t of ["kite", "ranger", "medic"]) assert.deepEqual(s.trainCost(0, t), plain.trainCost(0, t), t);
});

test("story missions: economy and home defence only, the army never marches out", () => {
  const def = MISSIONS.find((m) => m.id.startsWith("m03"));
  const s = new Simulation({ map: def.map, enemyCount: def.enemies, aiSpeed: def.speed, mission: def });
  assert.ok(s.own(0).some((e) => e.type === "hq"), "the mission has a player core");
  const workers0 = own(s, "worker").length, units0 = units(s).length;
  s.setSteward(true);
  let marched = 0;
  run(s, 200, () => { for (const e of s.own(0)) if (!e.tag && e.kind === "unit" && e.orders.some((o) => o.type === "attackmove")) marched++; });
  assert.equal(marched, 0, "no attack-move by the steward");
  assert.ok(own(s, "worker").length > workers0 || units(s).length > units0, "the base grew");
  assert.equal(s.aiHome === true, def.rules?.ai === "home", "the mission's own flag is put back");
});

test("Defence: it crews free pads and upgrades towers, and never calls a wave", () => {
  const level = DEFENCE_LEVELS[0];
  const s = new Simulation({ map: level.map, enemyCount: level.enemies || 1, ai: false, mission: level });
  s.setSteward(true);
  const called = s.defence.called;
  run(s, 25);
  const towers = s.entities.filter((e) => e.crew && e.hp > 0 && e.team === 0);
  assert.ok(towers.length >= 1, `towers ${towers.length}`);
  assert.equal(s.defence.called, called);
});

test("saves and replays keep the steward in step", () => {
  const s = new Simulation({ map: "classic" });
  s.command({ team: 0, type: "steward", on: true });
  run(s, 30);
  const copy = restore(Simulation, s.serialize());
  assert.ok(copy?.stewardOn(0));
  run(s, 20); run(copy, 20);
  assert.equal(copy.hash(), s.hash());
  // A replay from the options and the command log plays the same match.
  const replay = new Simulation({ map: "classic" }), log = [...s.commandLog];
  while (replay.ticks < s.ticks) { for (const c of log.filter((c) => c.tick === replay.ticks)) { const { tick, ...cmd } = c; replay.command(cmd); } replay.tick(TICK); replay.events.length = 0; }
  assert.equal(replay.hash(), s.hash());
});

test("the strip reads in English, Vietnamese and Korean", async () => {
  const { translate } = await import("../src/i18n.js");
  const STEWARD_TEXT = "AI running your base"; // src/steward-ui.js (it imports CSS, so it is not loaded in Node)
  assert.equal(translate(STEWARD_TEXT, "vi"), "AI đang điều hành căn cứ của bạn");
  assert.equal(translate(STEWARD_TEXT, "ko"), "AI가 기지를 운영하는 중");
});
