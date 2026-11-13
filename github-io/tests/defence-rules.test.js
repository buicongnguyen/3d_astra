// Frontier Defence rules (src/sim/defence.js): no eliminations, pads and garrisons, payouts,
// lives, waves, medals, spawning and the save/replay guarantees every other match has.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { GARRISONS, starsFor } from "../src/sim/defence.js";
import { DEFINITIONS as D } from "../src/data.js";
import { modelsForMatch } from "../src/model-roster.js";

const [GORGE, BRIDGES] = DEFENCE_LEVELS;
const make = (level = GORGE, difficulty = "standard") => new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level, difficulty });
const run = (s, seconds) => { for (let i = 0; i < seconds * 20 && !s.result; i++) s.tick(0.05); };
const foes = (s) => s.entities.filter((e) => e.team === 1 && e.kind === "unit" && e.hp > 0);
// A level with one short wave, for exact checks.
const tiny = (units = { vanguard: 2 }, extra = {}) => ({ ...GORGE, id: "d-test", defence: { ...GORGE.defence, firstWave: 2, gap: 3, waves: [{ groups: [{ units, route: "main", every: 0.7 }], bonus: 10 }], ...extra } });

test("an ordinary match keeps its hash; defence state exists only in defence", () => {
  const s = new Simulation({ ai: false, factions: { 0: "meridian", 1: "meridian" } });
  for (let i = 0; i < 1200; i++) s.tick(0.05);
  assert.equal(s.hash(), "d071360b");
  assert.equal(s.defence, undefined);
  assert.ok(!s.serialize().includes('"defence"'));
});

test("a defence map has no bases, deposits or walls and nobody is eliminated", () => {
  for (const level of DEFENCE_LEVELS) {
    const s = make(level);
    assert.equal(s.entities.length, 0);
    assert.equal(s.resources.length, 0);
    assert.equal(s.nav.wallsSpawned, true);
    assert.equal(s.nav.obstacles.length, 0, "no phantom boulders");
    run(s, 5);
    assert.deepEqual(s.players.map((p) => p.eliminated), [false, false]);
    assert.equal(s.result, null);
    assert.ok(s.command({ team: 0, type: "padBuild", pad: level.defence.pads[0].id, crew: "ranger" }), "commands still accepted");
  }
});

test("build, upgrade and sell cost and refund what garrisons.json says", () => {
  const s = make(), p = s.players[0], start = p.alloy, pad = GORGE.defence.pads[0].id;
  const [c1, c2, c3] = GARRISONS.crews.ranger.cost;
  assert.ok(s.command({ team: 0, type: "padBuild", pad, crew: "ranger" }));
  const t = s.towerOn(pad);
  assert.equal(p.alloy, start - c1);
  assert.equal(t.type, "tower");
  assert.equal(t.crew, "ranger");
  assert.equal(t.tier, 1);
  assert.equal(t.shot, "ranger");
  assert.equal(t.range, D.ranger.range + GARRISONS.crews.ranger.range);
  assert.equal(s.command({ team: 0, type: "padBuild", pad, crew: "breaker" }), false, "one garrison per pad");
  const damage = t.damage;
  p.alloy = 1000;
  assert.ok(s.command({ team: 0, type: "padUpgrade", building: t.id }));
  assert.equal(p.alloy, 1000 - c2);
  assert.equal(t.tier, 2);
  assert.ok(t.damage > damage);
  assert.ok(s.command({ team: 0, type: "padUpgrade", building: t.id }));
  assert.equal(t.tier, 3);
  assert.equal(s.command({ team: 0, type: "padUpgrade", building: t.id }), false, "tier 3 is the top");
  const before = p.alloy;
  assert.ok(s.command({ team: 0, type: "padSell", building: t.id }));
  assert.equal(p.alloy, before + Math.floor((c1 + c2 + c3) * GARRISONS.sell));
  s.tick(0.05);
  assert.equal(s.towerOn(pad), null, "the pad is free again");
  p.alloy = 10;
  assert.equal(s.command({ team: 0, type: "padBuild", pad, crew: "ranger" }), false, "cannot build without alloy");
  assert.equal(s.command({ team: 1, type: "padBuild", pad, crew: "ranger" }), false, "only the defender builds");
  assert.equal(s.command({ team: 0, type: "padBuild", pad: "nowhere", crew: "ranger" }), false);
  assert.equal(s.command({ team: 0, type: "padBuild", pad, crew: "tank" }), false, "crews come from the level's list");
});

test("crews follow the player's roster, and a garrison is saved as differences only", () => {
  const veil = { ...GORGE, factions: { 0: "veil", 1: "ashfall" } };
  const s = make(veil);
  assert.equal(s.crewType("antitank"), "watcher");
  assert.equal(s.crewType("watcher"), "watcher");
  assert.ok(s.command({ team: 0, type: "padBuild", pad: "g1", crew: "watcher" }));
  assert.equal(s.towerOn("g1").reveal, GARRISONS.crews.watcher.reveal);
  const saved = JSON.parse(s.serialize()).state.entities[0];
  assert.equal(saved.crew, "watcher");
  assert.equal(saved.radius, undefined, "unchanged tower fields are not stored");
  assert.ok(modelsForMatch(make()).includes("watcher") && modelsForMatch(make()).includes("scrapper") && modelsForMatch(make()).includes("scorcher"));
  assert.ok(modelsForMatch(make(BRIDGES)).includes("rider") && modelsForMatch(make(BRIDGES)).includes("wagon"));
});

test("a kill pays a tenth of the unit's cost; a leak pays nothing and costs a life", () => {
  const s = make(tiny({ vanguard: 2 }));
  run(s, 3.2);
  const [a, b] = foes(s);
  assert.ok(a && b, "the wave arrived");
  const alloy = s.players[0].alloy;
  s.applyDamage(a, 9999, 0, null);
  s.tick(0.05);
  const bounty = Math.ceil((D[a.type].cost[0] + D[a.type].cost[1]) / 10);
  assert.equal(s.players[0].alloy, alloy + bounty);
  assert.equal(s.defence.bounty, bounty);
  // Walk the other one to the exit.
  const exit = GORGE.defence.exit;
  b.x = exit.x; b.z = exit.z;
  const lives = s.defence.lives, cash = s.players[0].alloy;
  s.tick(0.05);
  assert.equal(s.defence.lives, lives - 1);
  assert.equal(s.players[0].alloy, cash + 10, "only the wave bonus, no bounty for a leak");
  assert.equal(foes(s).length, 0);
});

test("a heavy machine leaking costs two lives", () => {
  const s = make(tiny({ tank: 1 }));
  run(s, 3);
  const [tank] = foes(s);
  assert.ok(D[tank.type].pop >= 3);
  Object.assign(tank, GORGE.defence.exit);
  delete tank.r;
  s.tick(0.05);
  assert.equal(s.defence.lives, 18);
});

test("the last wave beaten wins with a medal by lives; no lives left loses", () => {
  const s = make(tiny({ vanguard: 1 }));
  run(s, 3);
  for (const e of foes(s)) s.applyDamage(e, 9999, 0, null);
  run(s, 1);
  assert.equal(s.result, "victory");
  assert.equal(s.mission.medal, "gold");
  assert.equal(starsFor(s.mission.medal), 3);
  assert.equal(s.mission.objectives.hold.state, "done");
  const silver = make(tiny({ vanguard: 1 }));
  run(silver, 3);
  silver.defence.lives = 12;
  for (const e of foes(silver)) s.applyDamage(e, 9999, 0, null);
  run(silver, 1);
  assert.equal(silver.mission.medal, "silver");
  const bronze = make(tiny({ vanguard: 1 }));
  run(bronze, 3);
  bronze.defence.lives = 3;
  for (const e of foes(bronze)) s.applyDamage(e, 9999, 0, null);
  run(bronze, 1);
  assert.equal(bronze.mission.medal, "bronze");
  const lost = make(tiny({ vanguard: 3 }));
  lost.defence.lives = 1;
  run(lost, 60);
  assert.equal(lost.result, "defeat");
  assert.equal(lost.defence.lives, 0);
});

test("waves trickle in one at a time on their lanes, spaced and never stacked", () => {
  const s = make(tiny({ vanguard: 12 }, { lane: 2.4 }));
  const seen = new Map();
  for (let i = 0; i < 20 * 12; i++) {
    s.tick(0.05);
    const fresh = foes(s).filter((e) => !seen.has(e.id));
    assert.ok(fresh.length <= 1, "at most one unit appears per tick");
    for (const e of fresh) {
      for (const [, other] of seen) if (s.get(other.id)) assert.ok(Math.hypot(e.x - other.x, e.z - other.z) >= e.radius + other.radius - 1e-6, "spawned clear of others");
      seen.set(e.id, e);
    }
  }
  assert.equal(seen.size, 12);
  assert.ok(new Set([...seen.values()].map((e) => e.id % 5)).size > 1);
});

test("with no towers the wave walks its road to the exit with hardly any route searches", () => {
  for (const level of DEFENCE_LEVELS) {
    const s = make(level);
    let searches = 0;
    const path = s.nav.path.bind(s.nav);
    s.nav.path = (...a) => { searches++; return path(...a); };
    run(s, 70);
    assert.ok(s.defence.leaked > 0, `${level.id}: the first wave reached the exit`);
    assert.ok(searches < 10, `${level.id}: ${searches} route searches`);
    // A route order never chases: every unit is still near its road.
    for (const e of foes(s)) {
      const pts = level.defence.routes[e.orders[0].route];
      const off = Math.min(...pts.slice(1).map((b, i) => { const a = pts[i], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((e.x - a.x) * dx + (e.z - a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(e.x - a.x - t * dx, e.z - a.z - t * dz); }));
      assert.ok(off < 4, `${e.type} ${off.toFixed(1)} m off the road`);
    }
  }
});

test("waves do not leave the road to chase a tower; they shoot what is in range", () => {
  const s = make();
  s.players[0].alloy = 5000;
  for (const pad of GORGE.defence.pads.filter((p) => !p.high)) s.command({ team: 0, type: "padBuild", pad: pad.id, crew: "ranger" });
  run(s, 60);
  assert.ok(s.defence.bounty > 0, "towers killed something");
  for (const e of foes(s)) assert.equal(e.orders[0]?.type, "route");
});

test("towers heal at the end of a wave and the countdown to the next starts", () => {
  const s = make(GORGE);
  s.players[0].alloy = 5000;
  s.command({ team: 0, type: "padBuild", pad: "g1", crew: "breaker" });
  const t = s.towerOn("g1");
  t.hp = 100;
  run(s, 32);
  for (const e of foes(s)) s.applyDamage(e, 9999, 0, null);
  s.defence.queue.length = 0;
  run(s, 0.2);
  assert.equal(s.defence.cleared, 1);
  assert.equal(t.hp, t.maxHp);
  assert.ok(Math.abs(s.defence.nextAt - s.time - GORGE.defence.gap) < 0.2);
  const alloy = s.players[0].alloy;
  assert.ok(s.command({ team: 0, type: "waveCall" }));
  assert.equal(s.defence.wave, 2);
  assert.ok(s.players[0].alloy > alloy, "calling early pays a bonus");
  assert.equal(s.command({ team: 0, type: "waveCall" }), false, "not while the wave is still arriving");
});

test("a destroyed garrison frees its pad", () => {
  const s = make();
  s.command({ team: 0, type: "padBuild", pad: "g2", crew: "ranger" });
  s.applyDamage(s.towerOn("g2"), 99999, 1, null);
  s.tick(0.05);
  assert.equal(s.towerOn("g2"), null);
  assert.ok(s.command({ team: 0, type: "padBuild", pad: "g2", crew: "ranger" }));
});

test("difficulty scales the waves and the starting alloy", () => {
  const counts = {};
  for (const difficulty of ["story", "standard", "veteran"]) {
    const s = make(GORGE, difficulty);
    counts[difficulty] = { alloy: s.players[0].alloy };
    s.startWave();
    counts[difficulty].wave = s.defence.queue.length;
  }
  assert.ok(counts.story.wave < counts.standard.wave && counts.standard.wave < counts.veteran.wave, JSON.stringify(counts));
  assert.ok(counts.story.alloy > counts.standard.alloy);
});

test("a save taken mid-wave loads to the same state and plays on identically", () => {
  const s = make(BRIDGES);
  s.command({ team: 0, type: "padBuild", pad: "s2", crew: "ranger" });
  s.command({ team: 0, type: "padBuild", pad: "n3", crew: "breaker" });
  run(s, 36);
  assert.ok(foes(s).length > 0 && s.defence.active, "mid-wave");
  const loaded = Simulation.load(s.serialize());
  assert.equal(loaded.hash(), s.hash());
  run(s, 20);
  run(loaded, 20);
  assert.equal(loaded.hash(), s.hash());
});

test("replaying the command log gives the same match", () => {
  const s = make(GORGE, "veteran");
  const plan = [[1, { type: "padBuild", pad: "g1", crew: "ranger" }], [40, { type: "padBuild", pad: "r1", crew: "breaker" }], [200, { type: "waveCall" }], [400, { type: "padBuild", pad: "g3", crew: "antitank" }]];
  for (let tick = 0; tick < 1600 && !s.result; tick++) {
    for (const [at, c] of plan) if (at === tick) s.command({ team: 0, ...c });
    if (tick === 900) { const t = s.towerOn("g1"); if (t) s.command({ team: 0, type: "padUpgrade", building: t.id }); }
    s.tick(0.05);
  }
  const replay = make(GORGE, "veteran"), log = s.commandLog;
  for (let tick = 0; tick < 1600 && !replay.result; tick++) {
    for (const c of log) if (c.tick === replay.ticks) { const { tick: _, ...command } = c; replay.command(command); }
    replay.tick(0.05);
  }
  assert.ok(log.length >= 5);
  assert.equal(replay.hash(), s.hash());
});
