// W6 replays (src/meta/replay.js, plan B3): a finished match replays from its constructor options and command
// log to the same final hash; a changed log drifts; another version is refused with a message; stored replays
// are capped (count and bytes) and survive full storage by dropping the oldest. Nothing is added to the
// simulation: options are remembered beside it, and the viewer's command lock is an unserialized function.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { resolveMission } from "../src/story/choices.js";
import { ObjectiveBot } from "../tools/playbot.mjs";
import { packLog, unpackLog, recordReplay, replayProblem, replayFeeder, runReplay, rememberOptions, optionsOf, replayOptions, REPLAY_VERSION } from "../src/meta/replay.js";
import { REPLAY_KEY, REPLAY_CAP, REPLAY_BYTES, storeReplay, loadReplays } from "../src/meta/history.js";
import { SAVE_VERSION } from "../src/snapshot.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";

// A scripted player: the same commands at the same ticks every time (as tests/save-replay.test.js).
function play(s, seconds) {
  const hq = s.own(0).find((e) => e.type === "hq");
  for (let i = 0; i < seconds * 20; i++) {
    if (s.ticks === 1) s.command({ team: 0, type: "harvest" });
    if (s.ticks % 400 === 10) s.command({ team: 0, type: "train", building: hq.id, unit: "worker" });
    if (s.ticks === 300) {
      const w = s.own(0).find((e) => e.type === "worker"), spot = s.findPlacement("barracks", 0, hq.x + 10, hq.z + 4);
      if (w && spot) s.command({ team: 0, type: "build", worker: w.id, building: "barracks", x: spot.x, z: spot.z });
    }
    if (s.ticks % 300 === 150) {
      const b = s.own(0).find((e) => e.type === "barracks" && e.complete);
      if (b) s.command({ team: 0, type: "train", building: b.id, unit: "ranger" });
      const army = s.own(0).filter((e) => e.kind === "unit" && e.damage > 0 && e.type !== "worker");
      if (army.length >= 4) s.command({ team: 0, type: "order", ids: army.map((e) => e.id), order: { type: "attackmove", x: 0, z: 0 } });
    }
    s.tick(0.05); s.events.length = 0;
  }
}
const built = (options) => rememberOptions(new Simulation(options), options);

test("a recorded skirmish replays to the same final hash, through JSON", () => {
  const options = { map: "riverlands", aiSpeed: "fast", enemyCount: 2, factions: { 0: "meridian", 1: "ashfall", 2: "veil" } };
  const s = built(options);
  play(s, 200);
  const replay = JSON.parse(JSON.stringify(recordReplay(s, { app: "1.2.3", at: 5 })));
  assert.equal(replay.v, REPLAY_VERSION);
  assert.equal(replay.save, SAVE_VERSION);
  assert.equal(replay.ticks, s.ticks);
  assert.equal(replay.hash, s.hash());
  assert.ok(replay.log.length >= 8, `${replay.log.length} commands`);
  assert.equal(replayProblem(replay, "1.2.3"), null);
  const r = runReplay(Simulation, replay);
  assert.equal(r.status, "ok");
  assert.equal(r.sim.hash(), s.hash());
  assert.ok(JSON.stringify(replay).length < 30_000, `compact: ${JSON.stringify(replay).length} bytes`);
});

test("a story mission on Veteran replays from its constructor options (its AI speed is adjusted when built)", () => {
  const def = resolveMission(MISSIONS[0], null), options = { difficulty: "veteran", map: def.map, enemyCount: def.enemies, aiSpeed: def.speed, alliance: def.alliance, playerBonus: def.bonus || null, mission: def };
  const s = built(options), bot = new ObjectiveBot(s, s.missionDef, {});
  for (let i = 0; i < 20 * 90 && !s.result; i++) { bot.step(); for (const e of s.events) bot.see(e); s.events.length = 0; s.tick(0.05); }
  const replay = recordReplay(s, { app: "x" });
  assert.equal(replay.options.aiSpeed, def.speed, "the options as given, not the adjusted speed");
  assert.equal(new Simulation(replayOptions(replay)).aiSpeed, new Simulation(options).aiSpeed);
  const r = runReplay(Simulation, JSON.parse(JSON.stringify(replay)));
  assert.equal(r.status, "ok");
});

test("a Frontier Defence level replays too: pads, a commander rank and an early wave call", () => {
  const level = DEFENCE_LEVELS[0], options = { map: level.map, enemyCount: 1, ai: false, mission: level, difficulty: "standard" };
  const s = built(options);
  for (let i = 0; i < 20 * 120 && !s.result; i++) {
    if (s.ticks === 5) s.command({ team: 0, type: "padBuild", pad: level.defence.pads[0].id, crew: "ranger" });
    if (s.ticks === 30) s.command({ team: 0, type: "padBuild", pad: level.defence.pads[1].id, crew: "breaker" });
    if (s.ticks === 60) s.command({ team: 0, type: "waveCall" });
    if (s.ticks === 900) s.command({ team: 0, type: "heroUpgrade" });
    s.tick(0.05); s.events.length = 0;
  }
  const replay = JSON.parse(JSON.stringify(recordReplay(s, { app: "x" })));
  assert.ok(replay.log.length >= 3, `${replay.log.length} commands`);
  const r = runReplay(Simulation, replay);
  assert.equal(r.status, "ok");
  assert.equal(r.sim.defence.wave, s.defence.wave);
});

test("a changed log drifts; the feeder applies each command on its own tick", () => {
  const s = built({ map: "riverlands" });
  play(s, 60);
  const replay = recordReplay(s, { app: "x" });
  const tampered = { ...replay, log: replay.log.map(([d, c], i) => (i === 1 ? [d + 40, c] : [d, c])) };
  assert.equal(runReplay(Simulation, tampered).status, "drift");
  const sim = new Simulation(replayOptions(replay)), feeder = replayFeeder(replay), seen = [];
  while (sim.ticks < replay.ticks) { feeder.feed(sim, (c) => { seen.push(sim.ticks); sim.command(c); }); sim.tick(0.05); }
  assert.deepEqual(seen, unpackLog(replay.log).map((c) => c.tick));
  assert.equal(feeder.left, 0);
  assert.equal(feeder.status(sim), "ok");
});

test("pack and unpack: delta ticks, team 0 left out, bad logs refused", () => {
  const log = [{ tick: 3, team: 0, type: "harvest" }, { tick: 3, team: 0, type: "autocast", on: true }, { tick: 40, team: 1, type: "harvest" }];
  const packed = packLog(structuredClone(log));
  assert.deepEqual(packed, [[3, { type: "harvest" }], [0, { type: "autocast", on: true }], [37, { team: 1, type: "harvest" }]]);
  assert.deepEqual(unpackLog(packed), log);
  assert.equal(unpackLog([[-1, {}]]), null);
  assert.equal(unpackLog([["x", {}]]), null);
  assert.equal(unpackLog([[1]]), null);
});

test("another version or a damaged replay is refused with a clear message", () => {
  const s = built({ map: "riverlands" });
  play(s, 5);
  const replay = recordReplay(s, { app: "0.19.1" });
  assert.match(replayProblem(replay, "0.20.0"), /recorded with version 0\.19\.1 and cannot be played in version 0\.20\.0/);
  assert.match(replayProblem({ ...replay, save: SAVE_VERSION + 1 }, "0.19.1"), /version/);
  assert.match(replayProblem({ ...replay, log: "junk" }, "0.19.1"), /damaged/);
  assert.match(replayProblem(null, "0.19.1"), /damaged/);
  assert.equal(recordReplay(new Simulation({ map: "riverlands" })), null, "a match whose options were not remembered (a loaded save) has no replay");
});

test("the simulation is untouched: remembered options live beside it, and a function lock is never serialized", () => {
  const s = built({ map: "riverlands" }), before = s.hash();
  assert.ok(optionsOf(s));
  assert.ok(!Object.keys(s).some((k) => /option|replay/i.test(k)), "no new field on the simulation");
  s.command = () => false;
  assert.equal(s.hash(), before, "an own command function does not reach the state or its hash");
});

test("stored replays: at most three, the newest kept, too big refused, full storage drops the oldest", () => {
  const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const r = (at, size = 10) => ({ v: 1, at, options: {}, ticks: 1, hash: "x", log: [[0, { type: "harvest", pad: "x".repeat(size) }]] });
  for (let i = 1; i <= 5; i++) assert.ok(storeReplay(`r${i}`, r(i), storage));
  assert.equal(REPLAY_CAP, 3);
  assert.deepEqual(Object.keys(loadReplays(storage)).sort(), ["r3", "r4", "r5"]);
  assert.equal(storeReplay("big", r(9, REPLAY_BYTES), storage), null);
  assert.ok(!("big" in loadReplays(storage)));
  // A quota that fits two big replays: the oldest goes to make room.
  for (let i = 3; i <= 5; i++) storeReplay(`r${i}`, r(i, 4000), storage);
  const limit = 2 * JSON.stringify(r(9, 4000)).length + 60;
  const small = { getItem: storage.getItem, setItem: (k, v) => { if (v.length > limit) throw new Error("quota"); store.set(k, v); } };
  assert.deepEqual(storeReplay("r6", r(6, 4000), small), ["r6", "r5"]);
  assert.deepEqual(Object.keys(loadReplays(storage)).sort(), ["r5", "r6"]);
  store.set(REPLAY_KEY, "{bad");
  assert.deepEqual(loadReplays(storage), {});
  const blocked = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };
  assert.equal(storeReplay("x", r(1), blocked), null);
});

// Follow action (src/meta/replay-follow.js, re-score 2026-11-25b): the replay camera aims at the busiest knot of
// units that fired in the last few seconds, else at the player's army; it keeps its fight while that fight is
// still most of the action, and it only reads the simulation (the hash is untouched).
test("follow action aims at the fight, else the army, and keeps its fight", async () => {
  const { actionTarget, FIGHT_SECONDS } = await import("../src/meta/replay-follow.js");
  const sim = new Simulation({ seed: 7 });
  const hash = sim.hash();
  const army = sim.own(0).filter((e) => e.kind === "unit" && e.type !== "worker");
  const calm = actionTarget(sim);
  assert.equal(sim.hash(), hash, "it only reads the simulation");
  const mid = army.reduce((a, e) => ({ x: a.x + e.x / army.length, z: a.z + e.z / army.length }), { x: 0, z: 0 });
  assert.ok(calm && !calm.fight && Math.hypot(calm.x - mid.x, calm.z - mid.z) < 16, "no fighting: the player's army");
  // Two fights: three shooters far east, five far west; the bigger one wins.
  const east = [0, 1, 2].map((i) => sim.spawn("ranger", 1, 30 + i, -30)), west = [0, 1, 2, 3, 4].map((i) => sim.spawn("ranger", 1, -30 - i, 30));
  for (const e of [...east, ...west]) e.shotAt = sim.time;
  const fight = actionTarget(sim);
  assert.ok(fight.fight && fight.x < -25 && fight.z > 25 && fight.count === 5, `the bigger fight: ${JSON.stringify(fight)}`);
  // Kept while it is still most of the action: one more shooter east does not swing the camera.
  sim.spawn("ranger", 1, 33, -30).shotAt = sim.time;
  assert.ok(actionTarget(sim, fight).x < -25, "the camera keeps its fight");
  // The west fight goes quiet: the camera moves east.
  for (const e of west) e.shotAt = sim.time - FIGHT_SECONDS - 1;
  assert.ok(actionTarget(sim, fight).x > 25, "a quiet fight hands over to the live one");
});
