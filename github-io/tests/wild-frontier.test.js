// AAA round 4, P1 "Wild frontier: the desert test" (sim/content/wild-frontier.js): the rules.
//  - opt-in: no rule (or another map) builds nothing; the rule on Amber Dunes builds the Spire (on the
//    crossroads ring, with its income, when capture points are on) and three nest guards (WILD_TEAM);
//  - wild guards: every side may fight them, they never pick targets through sim.hostile;
//  - the Sandstorm: only the holder, only when armed; 3 s warning, 18 s storm, 90 s cooldown, 15 s arming
//    for a new holder; enemies inside are Sandblind (reload x1.43) and see 4 m; the holder's units inside
//    are hidden from them;
//  - the nest: guards down opens it, one side alone for 30 s tames a Dune Wyrm, contest pauses, the cap
//    holds, the nest regrows its guards;
//  - Ambush: the ripple, then the burst under the target's old spot (a tank that drives off dodges it);
//  - the computer: Relaxed never calls weather or tames; Normal never before its plan's times;
//  - determinism: two runs agree, and a save reloads to the same hash.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { WILD, canTame, stormOn, spireOf } from "../src/sim/content/wild-frontier.js";
import { WILD_TEAM } from "../src/sim/constants.js";
import { run } from "./lib/sim.js";

const wild = (options = {}) => new Simulation({ map: "dunes", ai: false, rules: { wild: "on" }, ...options });
const step = (s, seconds) => { for (let i = 0; i < Math.round(seconds / 0.05); i++) s.tick(0.05); s.events.length = 0; };
const holdSpire = (s, team = 0) => { s.skirmishPoints.spire.owner = team; step(s, 0.5); s.wild.readyAt = s.time; };

test("opt-in: nothing without the rule or off Amber Dunes; the rule on Dunes builds the Spire and three guards", () => {
  const off = new Simulation({ map: "dunes", ai: false, capturePoints: true });
  assert.equal(off.wild, undefined);
  assert.ok(off.skirmishPoints.crossroads && !off.skirmishPoints.spire);
  const elsewhere = new Simulation({ map: "classic", ai: false, rules: { wild: "on" } });
  assert.equal(elsewhere.wild, undefined, "classic is not a Wild land");
  const s = wild({ capturePoints: true });
  assert.ok(!s.skirmishPoints.spire && s.wild.spire === "crossroads" && spireOf(s) === s.skirmishPoints.crossroads, "the crossroads ring is the Spire");
  assert.deepEqual(spireOf(s).gives, off.skirmishPoints.crossroads.gives, "and keeps its income");
  assert.deepEqual(Object.keys(s.skirmishPoints), Object.keys(off.skirmishPoints), "the same rings as without the rule, so the computer crews them as before");
  assert.equal(wild().skirmishPoints.spire.gives, undefined, "no capture points: no income");
  const guards = s.entities.filter((e) => e.team === WILD_TEAM);
  assert.equal(s.wild.nests.length, 4, "a home nest per camp and two Elder nests");
  assert.equal(guards.length, s.wild.nests.reduce((n, x) => n + (x.elder ? WILD.nest.elder_guards : WILD.nest.guards), 0));
  assert.ok(guards.every((e) => e.type === "wyrmling" && s.wild.nests.some((n) => Math.hypot(e.x - n.x, e.z - n.z) < 4)));
  assert.equal(s.hostile(0, WILD_TEAM), true);
  assert.equal(s.hostile(1, WILD_TEAM), true);
  assert.equal(s.hostile(WILD_TEAM, 0), false, "guards never target through hostile()");
  assert.equal(s.hostile(0, -1), false, "walls stay neutral");
  assert.equal(new Simulation({ map: "dunes", ai: false, enemyCount: 3, rules: { wild: "on" } }).wild.nests.length, 0, "three rivals: every corner is a camp");
});

test("Sandstorm: only the holder, only armed; warning, storm, cooldown and arming", () => {
  const s = wild();
  assert.equal(s.castWeather(0, 0, -10), false, "nobody holds the Spire");
  s.skirmishPoints.spire.owner = 0;
  step(s, 0.5);
  assert.ok(Math.abs(s.wild.readyAt - (s.time + WILD.spire.arm - 0.5)) < 0.6, "a new holder arms for 15 s");
  assert.equal(s.castWeather(0, 0, -10), false, "still arming");
  assert.equal(s.command({ team: 1, type: "weather", x: 0, z: -10 }), false, "not the holder");
  s.wild.readyAt = s.time;
  assert.equal(s.command({ team: 0, type: "weather", x: 0, z: -10 }), true);
  assert.equal(s.commandLog.at(-1).type, "weather");
  const storm = s.wild.storms[0];
  assert.ok(Math.abs(storm.at - s.time - WILD.spire.warn) < 1e-9 && Math.abs(storm.until - storm.at - WILD.sandstorm.duration) < 1e-9);
  assert.equal(s.castWeather(0, 10, 10), false, "recharging");
  step(s, WILD.spire.cooldown - 1);
  assert.equal(s.castWeather(0, 10, 10), false);
  step(s, 1.1);
  assert.equal(s.castWeather(0, 10, 10), true, "ready again after 90 s");
  assert.equal(s.castWeather(0, 1e4, 0), false, "never off the map");
  assert.equal(s.wild.stats.casts[0], 2);
});

test("Sandstorm area: enemies inside reload slower and see 4 m; the holder's units inside are hidden from them", () => {
  const s = wild();
  holdSpire(s, 0);
  const at = { x: 10, z: -20 };
  const foe = s.spawn("ranger", 1, at.x + 2, at.z, true, true), out = s.spawn("ranger", 1, at.x + 30, at.z, true, true);
  const mine = s.spawn("vanguard", 0, at.x - 5, at.z + 1, true, true);
  // Nobody walks: the checks below are about sight, not a chase.
  for (const e of [foe, out, mine]) e.stance = "hold";
  s.castWeather(0, at.x, at.z);
  step(s, 2.5);
  assert.equal(s.hasStatus(foe, "sandblind"), false, "nothing during the warning");
  step(s, 1.2);
  assert.ok(stormOn(s, foe, 1), "the storm is on the foe");
  assert.equal(s.hasStatus(foe, "sandblind"), true);
  assert.equal(s.hasStatus(out, "sandblind"), false, "outside: untouched");
  assert.equal(s.hasStatus(mine, "sandblind"), false, "the holder's own units: untouched");
  assert.ok(Math.abs(s.statusFactor(foe, "reload") - WILD.sandstorm.reload) < 1e-9, "fire 30% slower");
  s.updateVision();
  assert.equal(s.isVisible(mine, 1), false, "the holder's unit 7 m from the foe is hidden");
  mine.x = foe.x - 3; mine.z = foe.z;
  s.updateVision();
  assert.equal(s.isVisible(mine, 1), true, "within 4 m it is seen");
  step(s, WILD.sandstorm.duration);
  s.updateVision();
  assert.equal(s.wild.storms.length, 0, "the storm is over");
  assert.equal(s.hasStatus(foe, "sandblind"), false);
});

test("the nest: guards bite, clearing it opens it, one side alone for 30 s tames a Dune Wyrm; contest pauses; the cap holds; it regrows", () => {
  const s = wild(), n = s.wild.nests.find((x) => !x.elder);
  // This test follows one nest: the others stand empty.
  for (const other of s.wild.nests) if (other !== n) { for (const id of other.guards) s.get(id).hp = 0; other.guards = []; other.state = "regrow"; other.regrowAt = 1e9; }
  s.settle();
  const scout = s.spawn("ranger", 0, n.x + 5, n.z + 5, true, true);
  const hp = scout.hp;
  step(s, 3);
  assert.ok(scout.hp < hp, "the guards bite a unit inside their reach");
  for (const e of s.entities) if (e.team === WILD_TEAM) s.applyDamage(e, 1e4, 0, scout.id);
  step(s, 0.6);
  assert.equal(n.state, "open");
  assert.equal(s.players[0].kills > 0, true, "guards count as kills");
  scout.hp = scout.maxHp; scout.x = n.x + 1; scout.z = n.z; scout.orders = []; scout.post = { x: scout.x, z: scout.z };
  step(s, 12);
  assert.equal(n.taker, 0);
  const rival = s.spawn("vanguard", 1, n.x - 1, n.z, true, true);
  rival.stance = "hold"; scout.stance = "hold";
  rival.damage = scout.damage = 0.0001;
  const paused = n.since;
  step(s, 5);
  assert.ok(Math.abs(n.since - paused) < 1e-9, "contested: the taming pauses");
  rival.hp = 0; s.settle();
  step(s, WILD.nest.tame - paused + 1);
  const wyrms = s.entities.filter((e) => e.type === "wyrm");
  assert.equal(wyrms.length, 1);
  assert.equal(wyrms[0].team, 0);
  assert.equal(n.state, "regrow");
  assert.equal(canTame(s, 0), true, "a second Wyrm may join");
  s.spawn("wyrm", 0, n.x + 12, n.z, true, true);
  assert.equal(canTame(s, 0), false, "two Wyrms per side");
  step(s, WILD.nest.regrow + 1);
  assert.equal(n.state, "guarded");
  assert.equal(s.entities.filter((e) => e.team === WILD_TEAM && e.hp > 0).length, WILD.nest.guards);
});

test("Ambush: the Wyrm dives, the ground ripples for 1.5 s, it bursts up under the tank's old spot; a tank that drives off dodges", () => {
  for (const dodge of [false, true]) {
    const s = wild();
    const w = s.spawn("wyrm", 0, -20, -10, true, true), t = s.spawn("tank", 1, -8, -14, true, true);
    s.updateVision();
    step(s, 0.6);
    assert.ok(w.burrow, "it dived on its own (autocast, no button)");
    assert.equal(s.isVisible(w, 1), false, "hidden under the sand");
    const hp = t.hp + t.shield;
    if (dodge) { t.x += 8; }
    step(s, D.wyrm.ability.delay + 0.1);
    assert.equal(w.burrow, undefined);
    assert.ok(Math.hypot(w.x + 8, w.z + 14) < 3, "it came up at the marked spot");
    if (dodge) assert.equal(t.hp + t.shield, hp, "the tank that moved off is untouched");
    else assert.ok(hp - (t.hp + t.shield) >= D.wyrm.ability.damage - 1, "150 damage under the tank");
    assert.ok(w.abilityAt > s.time + 10, "then it recharges");
  }
});

test("the computer: Relaxed never calls weather or tames; Normal waits for its plan's times", () => {
  const relaxed = new Simulation({ map: "dunes", aiSpeed: "relaxed", rules: { wild: "on" } });
  holdSpire(relaxed, 1);
  for (let i = 0; i < 4; i++) relaxed.spawn("vanguard", 0, -2 + i, -6, true, true);
  relaxed.time = 1200;
  step(relaxed, 30);
  assert.equal(relaxed.wild.stats.casts[1], 0, "Relaxed holds the Spire but never calls a storm");
  assert.equal(canTame(relaxed, 1), false, "and never tames");
  assert.equal(canTame(relaxed, 0), true, "the player always may");
  const normal = new Simulation({ map: "dunes", aiSpeed: "normal", rules: { wild: "on" } });
  assert.equal(canTame(normal, 1), false, "Normal: not before its nest time");
  normal.time = WILD.ai.normal.nest + 1;
  assert.equal(canTame(normal, 1), true);
});

test("determinism: two runs agree, and a save reloads to the same hash (AI against AI, Fast, capture points)", () => {
  const make = () => new Simulation({ map: "dunes", aiSpeed: "fast", aiPlayer: true, capturePoints: true, rules: { wild: "on" } });
  const a = make(), b = make();
  run(a, 240);
  run(b, 240);
  assert.equal(a.hash(), b.hash());
  const saved = Simulation.load(a.serialize());
  assert.equal(saved.hash(), a.hash());
  run(a, 300);
  run(saved, 300);
  assert.equal(saved.hash(), a.hash());
});

test("the rule never leaves Amber Dunes: rulesForMap drops it on any other battlefield (no key in that match's save or hash)", async () => {
  const { rulesForMap } = await import("../src/app/rules-store.js");
  assert.deepEqual(rulesForMap({ wild: "on" }, "dunes"), { wild: "on" });
  assert.equal(rulesForMap({ wild: "on" }, "classic"), null);
  assert.deepEqual(rulesForMap({ wild: "on", pop: "150" }, "classic"), { pop: "150" });
  assert.equal(rulesForMap({ wild: "off" }, "dunes"), null, "Off is the default: no key");
});

test("wild guards never rank up, and the computer's counter-build never counts them", () => {
  const s = wild({ ai: true, aiSpeed: "fast" });
  const g = s.entities.find((e) => e.team === WILD_TEAM), victim = s.spawn("ranger", 0, g.x + 1, g.z, true, true);
  s.applyDamage(victim, 1e4, WILD_TEAM, g.id);
  assert.equal(g.rank, undefined);
  s.visible[1].fill(1);
  const seen = s.observeEnemies(1);
  assert.ok(![...seen.values()].includes("wyrmling"));
});

test("nests: mirrored home nests stay clear of the camps' deposits, also on a rich map; an Elder Wyrm is stronger", () => {
  for (const rules of [{ wild: "on" }, { wild: "on", economy: "rich" }]) {
    const s = new Simulation({ map: "dunes", ai: false, rules }), [a, b] = s.wild.nests.filter((n) => !n.elder);
    assert.ok(a && b, "two home nests");
    assert.ok(Math.abs(a.x + b.x) < 1e-9 && Math.abs(a.z + b.z) < 1e-9, "mirror images");
    for (const n of [a, b]) assert.ok(s.resources.every((r) => Math.hypot(r.x - n.x, r.z - n.z) > WILD.nest.aggro), "Harvesters never wake the guards");
  }
  const s = wild(), n = s.wild.nests.find((x) => x.elder);
  assert.equal(n.guards.length, WILD.nest.elder_guards);
  for (const other of s.wild.nests) { for (const id of other.guards) s.get(id).hp = 0; other.guards = []; other.state = other === n ? "open" : "regrow"; other.regrowAt = 1e9; }
  s.settle();
  const u = s.spawn("ranger", 0, n.x + 1, n.z, true, true);
  u.stance = "hold";
  step(s, WILD.nest.tame + 1);
  const elder = s.entities.find((e) => e.type === "wyrm");
  assert.ok(elder?.elder && elder.maxHp > D.wyrm.hp && elder.damage > D.wyrm.damage);
  const back = Simulation.load(s.serialize());
  assert.equal(back.get(elder.id).elder, true, "saved");
  assert.equal(back.hash(), s.hash());
});
