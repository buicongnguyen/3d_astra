// The content seams (AAA round 2, W0-B; src/sim/content.js, docs/CONTENT_SEAMS.md): the registry,
// the dispatcher and the twenty guarded call sites H1 to H20. Fixture modules are injected through
// the dispatcher's test hook (setContentModules) and taken out again after each test, so every
// other test file and every golden pin runs with the shipped (empty) registry.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { CONTENT } from "../src/sim/content/index.js";
import { setContentModules, contentModules, SPAWN, HIT_SCALE, ON_HIT, TAKEN, ON_DEATH, STEP, FIGHT, AUTOCAST, TOWER_AIM, AI_RULES, STATUSES, ABILITIES, BUFF_PROTECTED } from "../src/sim/content.js";

const TICK = 0.05;
const run = (s, seconds) => { const end = s.ticks + Math.round(seconds / TICK); while (s.ticks < end && !s.result) { s.tick(TICK); s.events.length = 0; } return s.hash(); };
// Runs `fn` with `modules` registered, then restores the previous list even when `fn` throws.
function withModules(modules, fn) {
  const restore = setContentModules(modules);
  try { return fn(); } finally { restore(); }
}
// The classic map without AI: units spawned near its centre fight on open, flat ground.
const field = () => new Simulation({ ai: false });
const see = (s) => { s.updateVision(); return s; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

test("the shipped registry: unique ids and step orders, and every hook list matches it", () => {
  assert.equal(contentModules(), CONTENT);
  const ids = CONTENT.map((m) => m.id), orders = CONTENT.filter((m) => m.step).map((m) => m.order);
  assert.equal(new Set(ids).size, ids.length, "module ids are unique");
  assert.equal(new Set(orders).size, orders.length, "step orders are unique");
  for (const [list, hook] of [[SPAWN, "onSpawn"], [HIT_SCALE, "hitScale"], [ON_HIT, "onHit"], [TAKEN, "taken"], [ON_DEATH, "onDeath"], [STEP, "step"], [FIGHT, "fight"], [AUTOCAST, "autocast"], [TOWER_AIM, "towerAim"]])
    assert.equal(list.length, CONTENT.filter((m) => m[hook]).length, hook);
  assert.equal(AI_RULES.length, CONTENT.flatMap((m) => m.aiRules || []).length);
});

test("H2/H18: no rules (absent, null or empty) gives no field and a byte-identical save", () => {
  const plain = run(new Simulation({ ai: false }), 5);
  for (const rules of [undefined, null, {}]) {
    const s = new Simulation({ ai: false, rules });
    assert.equal("rules" in s, false, JSON.stringify(rules));
    run(s, 5);
    assert.equal(s.hash(), plain);
    assert.equal(JSON.parse(s.serialize()).options.rules, undefined);
  }
});

test("H2/H18: rules round-trip through save and load, and ruleOn reads them before the mission's", () => {
  const options = { map: "riverlands", enemyCount: 2, aiSpeed: "fast", aiPlayer: true, rules: { roster: "expanded" } };
  const a = new Simulation(options);
  assert.deepEqual(a.rules, { roster: "expanded" });
  assert.notEqual(a.rules, options.rules, "a copy, not the caller's object");
  assert.equal(a.ruleOn("roster"), "expanded");
  assert.equal(a.ruleOn("aiPlan"), undefined);
  run(a, 30);
  const saved = a.serialize(), b = Simulation.load(saved);
  assert.deepEqual(JSON.parse(saved).options.rules, { roster: "expanded" });
  assert.equal(JSON.parse(saved).state.rules, undefined, "stored once, with the options");
  assert.deepEqual(b.rules, { roster: "expanded" });
  assert.equal(b.hash(), a.hash());
  assert.equal(run(b, 30), run(a, 30));
  // Missions answer from their own rules; a skirmish rule of the same name wins.
  const m = new Simulation({ ai: false });
  m.missionDef = { rules: { air: true, roster: "classic" } };
  assert.equal(m.ruleOn("air"), true);
  m.rules = { roster: "expanded" };
  assert.equal(m.ruleOn("roster"), "expanded");
});

test("H3: spawn hooks see every spawn after the faction traits, in module order", () => {
  const seen = [];
  withModules([
    { id: "a", onSpawn: (sim, e) => seen.push(`a:${e.type}:${e.vision}`) },
    { id: "b", onSpawn: (sim, e) => seen.push(`b:${e.type}`) },
  ], () => {
    const s = new Simulation({ ai: false, factions: { 0: "veil", 1: "meridian" } });
    const before = seen.length;
    const r = s.spawn("ranger", 0, 0, 0, true, true);
    assert.ok(before > 10, "the camps' spawns are seen too");
    assert.deepEqual(seen.slice(before), [`a:ranger:${r.vision}`, "b:ranger"]);
    assert.equal(r.vision, D.ranger.vision + 3, "the Veil trait ran before the hook");
  });
});

test("H4: step hooks run once per tick in their own order, whatever the list order", () => {
  const calls = [];
  withModules([
    { id: "late", order: 20, step: () => calls.push("late") },
    { id: "early", order: 10, step: () => calls.push("early") },
  ], () => {
    const s = new Simulation({ ai: false });
    s.tick(TICK);
    s.tick(TICK);
    assert.deepEqual(calls, ["early", "late", "early", "late"]);
  });
  assert.throws(() => setContentModules([{ id: "x", order: 1, step() {} }, { id: "y", order: 1, step() {} }]), /order 1 is already used/);
  assert.throws(() => setContentModules([{ id: "x", step() {} }]), /numeric order/);
  assert.equal(STEP.length, 0, "a refused list changes nothing");
});

test("H7/H8: a damage factor is the last factor; only the shot's own target tags the shot", () => {
  const order = [];
  const module = {
    id: "fixture-hit",
    hitScale(sim, e, t, tags) { if (t.type === "vanguard") { tags.push(`hit-${t.id}`); return 2; } return undefined; },
    onHit(sim, e, t, tags) { order.push(["onHit", t.hp]); tags.push("after"); },
  };
  const damageTo = (modules) => withModules(modules, () => {
    const s = field(), shooter = s.spawn("breaker", 0, 0, 0), main = s.spawn("vanguard", 1, 6, 0), close = s.spawn("vanguard", 1, 7, 0.5), plain = s.spawn("ranger", 1, 6, 0.8);
    for (const t of [main, close, plain]) t.shield = 0;
    s.hit(shooter, main);
    const shot = s.events.find((ev) => ev.type === "shot");
    return { main: main.maxHp - main.hp, near: close.maxHp - close.hp, plain: plain.maxHp - plain.hp, shot, mainId: main.id };
  });
  const base = damageTo([]), doubled = damageTo([module]);
  assert.ok(base.main > 0 && base.near > 0 && base.plain > 0, "the breaker's blast reached all three");
  assert.ok(near(doubled.main, base.main * 2));
  assert.ok(near(doubled.near, base.near * 2), "splash victims get the factor too");
  assert.equal(doubled.plain, base.plain, "a factor of undefined counts as 1");
  assert.deepEqual(doubled.shot.tags, [`hit-${doubled.mainId}`, "after"], "the splash victim's tag is dropped");
  assert.equal("tags" in base.shot, false, "no tags key without tags");
  assert.ok(order.length === 1 && order[0][1] < D.vanguard.hp, "onHit runs once, after the direct hit landed");
});

test("H8: every shot event carries the shooter's type; events stay out of the save", () => {
  const s = field();
  const rider = s.spawn("rider", 0, 0, 0), ranger = s.spawn("ranger", 0, 0, 2), tower = s.spawn("tower", 0, -2, 0), foe = s.spawn("vanguard", 1, 6, 0);
  foe.hp = foe.maxHp = 10000;
  const before = s.serialize();
  for (const e of [rider, ranger, tower]) s.hit(e, foe);
  const shots = s.events.filter((ev) => ev.type === "shot");
  assert.deepEqual(shots.map((ev) => [ev.weapon, ev.unit]), [[D.rider.shot || "rider", "rider"], ["ranger", "ranger"], [D.tower.shot || "tower", "tower"]]);
  assert.equal(D.rider.shot, "ranger", "the Rider fires the Ranger's shot, so only `unit` tells them apart");
  const withEvents = s.serialize();
  s.events.length = 0;
  assert.equal(s.serialize(), withEvents, "events are derived: the save is the same with or without them");
  assert.notEqual(withEvents, before, "the hits themselves are saved");
});

test("H12/H13: taken factors scale damage; death hooks run once, after the faction traits", () => {
  const deaths = [];
  withModules([
    { id: "armour", taken: (sim, t, team, by) => (t.type === "tank" ? 0.5 : undefined) },
    { id: "obituary", onDeath: (sim, t, team, by) => deaths.push({ type: t.type, hp: t.hp, team, by, salvaged: sim.events.some((ev) => ev.type === "salvage"), deathEvent: sim.events.some((ev) => ev.type === "death") }) },
  ], () => {
    const s = see(new Simulation({ ai: false, factions: { 0: "meridian", 1: "ashfall" } }));
    const yard = s.spawn("salvageyard", 1, 0, -6), tank = s.spawn("tank", 0, 0, 0), killer = s.spawn("ranger", 1, 0, 4);
    tank.shield = 0;
    s.applyDamage(tank, 100, 1, killer.id);
    assert.equal(tank.maxHp - tank.hp, 50);
    s.applyDamage(tank, 1e6, 1, killer.id);
    assert.equal(deaths.length, 1);
    assert.deepEqual(deaths[0], { type: "tank", hp: tank.hp, team: 1, by: killer.id, salvaged: true, deathEvent: false });
    assert.ok(yard.hp > 0);
  });
});

test("H20: a fight hook moves its own unit type and leaves every other unit's path as it was", () => {
  const drill = { id: "fixture-drill", fight(sim, e, t) { if (e.type !== "rider") return undefined; e.x -= 0.1; e.moving = true; return true; } };
  // A battle without Riders plays the same with or without the module.
  const battle = (withRider) => {
    const s = field();
    for (let i = 0; i < 3; i++) s.spawn("ranger", 0, i * 2, 0);
    if (withRider) s.spawn("rider", 0, 0, 3);
    for (let i = 0; i < 3; i++) s.spawn("vanguard", 1, 9 + i * 2, 0);
    return s;
  };
  const plain = run(battle(false), 15);
  assert.equal(withModules([drill], () => run(battle(false), 15)), plain);
  withModules([drill], () => {
    const s = battle(true), rider = s.own(0).find((e) => e.type === "rider"), x = rider.x;
    let shots = 0;
    for (let i = 0; i < 40; i++) { s.tick(TICK); shots += s.events.filter((ev) => ev.type === "shot" && ev.unit === "rider").length; s.events.length = 0; }
    assert.ok(rider.x < x - 1, "the Rider stepped away every tick it had a target");
    assert.equal(shots, 0, "a handled tick does not fire");
  });
});

test("H16: autocast answers: false holds, true casts, a point aims, undefined keeps today's rules", () => {
  const cast = (answer) => {
    const asked = [];
    return withModules([{ id: "caster", autocast: (sim, e, a) => { asked.push(a.id); return e.type === "ranger" ? answer : undefined; } }], () => {
      const s = field();
      s.players[0].autocast = true;
      const r = s.spawn("ranger", 0, 0, 0), foe = s.spawn("vanguard", 1, 6, 0);
      foe.hp = foe.maxHp = 10000;
      for (let i = 0; i < 20; i++) s.tick(TICK);
      return { used: s.events.some((ev) => ev.type === "ability" && ev.id === r.id), asked };
    });
  };
  assert.equal(cast(undefined).used, true, "today's rule: a Ranger in a fight uses Focus");
  assert.equal(cast(false).used, false);
  assert.equal(cast(true).used, true);
  assert.ok(cast(undefined).asked.includes("focus"));
  // A point goes to useAbility: the Breaker's Barrage lands where the module says.
  let aimed = null;
  withModules([{ id: "aimer", autocast: (sim, e, a) => (a.id === "barrage" ? (aimed = { x: e.x + 5, z: e.z + 1 }) : undefined) }], () => {
    const s = field();
    s.players[0].autocast = true;
    s.spawn("breaker", 0, 0, 0);
    s.spawn("vanguard", 1, 9, 0).hp = 10000;
    for (let i = 0; i < 20; i++) s.tick(TICK);
    assert.equal(s.strikes?.length, 1);
    assert.deepEqual([s.strikes[0].x, s.strikes[0].z], [aimed.x, aimed.z], "the module's point, not the nearest enemy");
  });
});

test("H6: a tower with `aim` asks the modules first; null means no target, undefined the usual pick", () => {
  const farthest = { id: "fixture-aim", towerAim(sim, e) {
    if (e.aim === "none") return null;
    if (e.aim !== "far") return undefined;
    const foes = sim.entities.filter((t) => t.hp > 0 && sim.hostile(e.team, t.team) && t.kind === "unit" && Math.hypot(t.x - e.x, t.z - e.z) <= e.range);
    return foes.sort((a, b) => Math.hypot(b.x - e.x, b.z - e.z) - Math.hypot(a.x - e.x, a.z - e.z))[0] ?? null;
  } };
  let asked = 0;
  const counting = { id: "count", towerAim: () => { asked++; return undefined; } };
  withModules([counting, farthest], () => {
    const s = field(), t = s.spawn("tower", 0, 0, 0), near = s.spawn("vanguard", 1, 4, 0), far = s.spawn("vanguard", 1, 10, 0);
    see(s);
    assert.equal(s.defenseTarget(t), near, "no aim field: today's nearest-first rule, modules not asked");
    assert.equal(asked, 0);
    t.aim = "far";
    assert.equal(s.defenseTarget(t), far);
    t.aim = "none";
    assert.equal(s.defenseTarget(t), null);
    t.aim = "other";
    assert.equal(s.defenseTarget(t), near, "every module answered undefined");
    assert.equal(asked, 3, "modules answer in list order");
  });
});

test("H17: a registered command is checked, logged and replays from the command log", () => {
  const boost = { id: "fixture-boost", commands: { fixtureBoost: {
    allowed: (sim, c) => sim.get(c.unit)?.team === c.team,
    run: (sim, c) => { sim.get(c.unit).speed += 1; return true; },
  } } };
  withModules([boost], () => {
    const play = (log) => {
      const s = new Simulation({ map: "classic", aiSpeed: "fast" }), r = s.own(0).find((e) => e.type === "ranger");
      let next = 0;
      while (s.ticks < 600) {
        if (!log && s.ticks === 100) { assert.equal(s.command({ team: 0, type: "fixtureBoost", unit: r.id }), true); s.command({ team: 0, type: "order", ids: [r.id], order: { type: "move", x: 0, z: 0 } }); }
        if (!log && s.ticks === 120) assert.equal(s.command({ team: 1, type: "fixtureBoost", unit: r.id }), false, "refused: not team 1's unit");
        while (log && next < log.length && log[next].tick === s.ticks) { const { tick, ...c } = log[next++]; s.command(c); }
        s.tick(TICK);
        s.events.length = 0;
      }
      return s;
    };
    const a = play(null);
    assert.equal(a.commandLog.filter((c) => c.type === "fixtureBoost").length, 1, "the refused one is not logged");
    assert.equal(play(structuredClone(a.commandLog)).hash(), a.hash());
  });
  assert.equal(new Simulation({ ai: false }).command({ team: 0, type: "fixtureBoost", unit: 1 }), false, "gone with its module");
  assert.throws(() => setContentModules([{ id: "x", commands: { train: { allowed() {}, run() {} } } }]), /command "train" already exists/);
  assert.throws(() => setContentModules([{ id: "x", commands: { c: { allowed() {}, run() {} } } }, { id: "y", commands: { c: { allowed() {}, run() {} } } }]), /command "c" already exists/);
});

test("H1: module mixins join the Simulation; a clash with any method throws; they leave with the module", () => {
  withModules([{ id: "fixture-mixin", mixin: { fixtureCount(type) { return this.entities.filter((e) => e.type === type).length; } } }], () => {
    assert.equal(new Simulation({ ai: false }).fixtureCount("worker"), 8);
  });
  assert.equal(Simulation.prototype.fixtureCount, undefined);
  assert.throws(() => setContentModules([{ id: "x", mixin: { spawn() {} } }]), /method "spawn" already exists/);
  assert.throws(() => setContentModules([{ id: "x", mixin: { hitScale() {} } }]), /method "hitScale" already exists/);
  assert.throws(() => setContentModules([{ id: "x", mixin: { f() {} } }, { id: "y", mixin: { f() {} } }]), /method "f" already exists/);
  assert.equal(typeof Simulation.prototype.spawn, "function", "a refused list leaves the built-ins alone");
});

test("module checks: unknown fields, duplicate ids, built-in ability ids and bad statuses throw", () => {
  assert.throws(() => setContentModules([{ id: "x", onspawn() {} }]), /unknown field "onspawn"/);
  assert.throws(() => setContentModules([{ id: "x" }, { id: "x" }]), /id used twice/);
  assert.throws(() => setContentModules([{ onSpawn() {} }]), /needs a string id/);
  assert.throws(() => setContentModules([{ id: "x", abilities: { focus: { use() {} } } }]), /ability "focus" already exists/);
  assert.throws(() => setContentModules([{ id: "x", abilities: { a: {} } }]), /needs use/);
  assert.throws(() => setContentModules([{ id: "x", statuses: { pinnedImmune: {} } }]), /may not end in "Immune"/);
  assert.throws(() => setContentModules([{ id: "x", statuses: { slow: { speed: -1 } } }]), /factor/);
  assert.throws(() => setContentModules([{ id: "x", statuses: { slow: { sped: 0.5 } } }]), /unknown field "sped"/);
  assert.throws(() => setContentModules([{ id: "x", statuses: { a: {} } }, { id: "y", statuses: { a: {} } }]), /registered twice/);
  assert.throws(() => setContentModules([{ id: "x", aiRules: [{ id: "r", run() {} }, { id: "r", run() {} }] }]), /listed twice/);
  assert.equal(Object.keys(STATUSES).length + Object.keys(ABILITIES).length, 0);
});

// A Steady-aim-like buff: longer range (a key every unit has) and pierce (a key a Ranger lacks).
const STEADY = { id: "fixture-steady", abilities: { steady: { use: (sim, e, a) => ({ change: { range: e.range + 3, pierce: 1 }, damage: 1.2 }) } } };
const steadyRanger = (s, x = 0) => { const r = s.spawn("ranger", 0, x, 0); r.ability = { id: "steady", duration: 8, cooldown: 35 }; return r; };

test("H15: a registered timed buff puts every key back and deletes the keys it added", () => {
  withModules([STEADY], () => {
    // `twin` never casts, so its keys are what the Ranger's would be without the buff.
    const s = field(), r = steadyRanger(s), twin = steadyRanger(s, 3), range = r.range;
    assert.equal(s.useAbility(r), true);
    assert.equal(r.range, range + 3);
    assert.equal(r.pierce, 1);
    assert.equal(s.rankFactor(r), 1.2, "damage rides on the buff like Overdrive's");
    assert.equal(r.abilityAt, s.time + 35);
    assert.ok(s.events.some((ev) => ev.type === "ability" && ev.ability === "steady"));
    run(s, 8.1);
    assert.equal(r.range, range);
    assert.equal("pierce" in r, false, "a key the unit did not have is deleted, not set to undefined");
    const bookkeeping = (k) => !["abilityAt", "buff"].includes(k);
    assert.deepEqual(Object.keys(r).sort().filter(bookkeeping), Object.keys(twin).sort().filter(bookkeeping));
    assert.equal(r.buff, null, "the buff slot ends empty, as for every built-in timed ability");
    assert.equal(s.useAbility(r), false, "on cooldown");
  });
});

test("H15: a save mid-buff reloads to the same hash and the added key still goes at the end", () => {
  withModules([STEADY], () => {
    const s = field(), r = steadyRanger(s), foe = s.spawn("vanguard", 1, 8, 0);
    // A target that cannot hurt back, so the Ranger fights the whole time and lives.
    Object.assign(foe, { hp: 5000, maxHp: 5000, damage: 0 });
    see(s);
    s.useAbility(r);
    run(s, 3);
    const b = Simulation.load(s.serialize()), rb = b.get(r.id);
    assert.equal(b.hash(), s.hash());
    assert.equal(rb.pierce, 1);
    assert.equal(run(b, 6), run(s, 6));
    assert.equal("pierce" in rb, false);
  });
});

test("H15 and D1: a buff never saves or restores health, so a promotion during it keeps its health", () => {
  withModules([STEADY, { id: "greedy", abilities: { grow: { use: (sim, e) => ({ change: { maxHp: e.maxHp * 2 } }) } } }], () => {
    const s = field(), r = steadyRanger(s);
    // A ranger with health of its own (as the Defence commander or an armour squad gets, sim/tactics.js setBaseHp).
    r.hp = r.maxHp = 200;
    s.setBaseHp(r);
    assert.equal(r.baseHp, 200);
    s.useAbility(r);
    s.creditKill(r.id, { kind: "unit", pop: 3 });
    assert.equal(r.rank, 1);
    assert.equal(r.maxHp, Math.round(200 * 1.08));
    run(s, 8.1);
    assert.equal(r.buff, null);
    assert.equal(r.maxHp, 216, "the promotion survives the end of the buff");
    assert.equal(r.baseHp, 200);
    const g = s.spawn("ranger", 0, 4, 0);
    g.ability = { id: "grow", duration: 5, cooldown: 30 };
    assert.throws(() => s.useAbility(g), /may not change "maxHp"/);
    for (const key of ["hp", "maxHp", "baseHp", "shield", "maxShield", "rank", "xp", "abilityAt", "buff", "fx"]) assert.ok(BUFF_PROTECTED.has(key), key);
  });
});

test("H15: an ability with no change is instant: cooldown and event, no buff; false means not now", () => {
  let fired = 0;
  withModules([{ id: "fixture-instant", abilities: { flare: { use: (sim, e, a, point) => (point ? (fired++, {}) : false) } } }], () => {
    const s = field(), r = s.spawn("ranger", 0, 0, 0);
    r.ability = { id: "flare", cooldown: 20 };
    assert.equal(s.useAbility(r), false, "use() said no: no cooldown");
    assert.equal(r.abilityAt, undefined);
    assert.equal(s.useAbility(r, { x: 3, z: 4 }), true);
    assert.equal(fired, 1);
    assert.equal("buff" in r, false);
    assert.equal(r.abilityAt, 20);
    const ev = s.events.find((e) => e.type === "ability");
    assert.deepEqual([ev.ability, ev.tx, ev.tz], ["flare", 3, 4]);
  });
});

test("H19: AI rules run after production, once per AI think, with the AI's own picture", () => {
  const calls = [];
  withModules([{ id: "fixture-ai", aiRules: [{ id: "watch", run: (sim, team, ctx) => calls.push({ team, keys: Object.keys(ctx).sort(), army: ctx.army.length, afford: ctx.afford([0, 0]) }) }] }], () => {
    const s = new Simulation({ map: "classic", aiSpeed: "fast" });
    run(s, 10);
  });
  assert.ok(calls.length >= 5, `${calls.length} thinks`);
  assert.ok(calls.every((c) => c.team === 1), "team 0 is the player");
  assert.deepEqual(calls[0].keys, ["afford", "army", "hq", "own", "pace", "role", "workers"]);
  assert.equal(calls[0].army, 3);
  assert.equal(calls[0].afford, true);
});

test("H5: a unit with `prefers` ranks by the list, then distance, then entity order", () => {
  const s = field();
  const r = s.spawn("ranger", 0, 0, 0);
  const vanguard = s.spawn("vanguard", 1, 3, 0), ranger = s.spawn("ranger", 1, 5, 0), medic = s.spawn("medic", 1, 8, 0), medic2 = s.spawn("medic", 1, 0, 8), antitank = s.spawn("antitank", 1, -6, 0);
  see(s);
  assert.equal(s.enemy(r, 10), vanguard, "no prefers: the nearest, as before");
  r.prefers = ["support", "antiarmor", "ranged"];
  assert.equal(s.enemy(r, 10), medic, "support first, the earlier medic on an equal distance");
  assert.equal(s.enemy(r, 7), antitank, "out of reach does not count: antiarmor next");
  medic.hp = medic2.hp = 0;
  assert.equal(s.enemy(r, 10), antitank);
  antitank.hp = 0;
  assert.equal(s.enemy(r, 10), ranger, "ranged before an unlisted class");
  ranger.hp = 0;
  assert.equal(s.enemy(r, 10), vanguard, "unlisted classes come last, nearest first");
  assert.equal(s.enemy(r, 2), null, "the radius still holds");
  // The same checks as enemy(): an enemy hidden in the fog is never picked.
  const far = field(), p = far.spawn("ranger", 0, 0, 0), hidden = far.spawn("medic", 1, 30, 0);
  see(far);
  p.prefers = ["support"];
  assert.equal(far.isVisible(hidden, 0), false);
  assert.equal(far.enemy(p, 40), null);
});

test("with no-op hooks of every kind registered, an AI-against-AI match keeps its golden hash", () => {
  const noop = {
    id: "noop", order: 1,
    onSpawn() {}, hitScale: () => 1, onHit() {}, taken: () => undefined, onDeath() {}, step() {}, fight: () => undefined,
    autocast: () => undefined, towerAim: () => undefined, aiRules: [{ id: "noop", run() {} }], mixin: { fixtureNoop() {} },
  };
  withModules([noop], () => {
    const sim = new Simulation({ map: "classic", enemyCount: 1, aiSpeed: "normal", aiPlayer: true });
    assert.equal(run(sim, 180), "39426dbc", "the golden pin of classic x1 normal at 180 s");
  });
});

test("after a 300 s AI-against-AI match the sim and entity keys are the same as before the seams, and nobody carries fx", () => {
  const sim = new Simulation({ map: "classic", enemyCount: 1, aiSpeed: "normal", aiPlayer: true });
  run(sim, 300);
  assert.equal(sim.entities.filter((e) => "fx" in e).length, 0);
  assert.equal("fxOn" in sim || "rules" in sim, false);
  assert.deepEqual(Object.keys(sim).sort(), ["aiClock", "aiEnabled", "aiPlayer", "aiSpeed", "aiTurn", "aiWar", "capturePointsOn", "castClock", "coalition", "commandLog", "difficulty", "enemyCount", "entities", "events", "explored", "factions", "intel", "knownCores", "lookup", "lookupFor", "lookupSize", "nav", "nextId", "nextQueueId", "pace", "playerBonus", "players", "pointDue", "resources", "result", "routeBudget", "scoutIndex", "skirmishPoints", "terrain", "tickEvents", "ticks", "time", "visible", "visionClock", "waveAt"]);
  assert.deepEqual([...new Set(sim.entities.flatMap((e) => Object.keys(e)))].sort(), ["ability", "abilityAt", "angle", "attacking", "buff", "builder", "carry", "carryType", "class", "complete", "cooldown", "cost", "counter", "counter_bonus", "damage", "description", "escape", "escapeAt", "escapeTried", "firing", "hitAt", "hitBy", "hits_air", "hops", "hp", "icon", "id", "interval", "kind", "level", "levelJob", "level_damage", "level_range", "maxHp", "maxShield", "moveSample", "moving", "name", "nextHitEffect", "orders", "path", "pathClock", "pathRevision", "pop", "post", "progress", "queue", "radius", "rally", "range", "rank", "requires", "resource", "retreating", "role", "shield", "shieldDelay", "speed", "squeeze", "stalled", "supply", "target", "team", "time", "trains", "type", "vision", "wait", "work", "working", "x", "xp", "z"]);
});
