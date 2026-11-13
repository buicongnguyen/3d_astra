// Frontier Defence 0.21 "Defence complete" (src/sim/defence.js): the Tank emplacement and Scorcher
// flame trap, tier-3 branches, the commander and its abilities, perks (Defence menu only), bridge
// demolition with fuse, push and reroute, pontoons, mixed-faction waves, Endless and the Daily seed.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFENCE_LEVELS, defenceLevel, defenceVariant } from "../src/defence/levels.js";
import { GARRISONS, endlessWave, seedOf } from "../src/sim/defence.js";
import { DEFINITIONS as D } from "../src/data.js";
import { modelsForMatch } from "../src/model-roster.js";
import { loadDefence, saveDefence, buyPerk, canBuyPerk, starsFree, recordScore, bestScore, dailySeed, dayKey, endlessSeed, recordDefence, DEFENCE_KEY } from "../src/defence/progress.js";

const GORGE = defenceLevel("d-gorge"), BRIDGES = defenceLevel("d-bridges"), FORDWOOD = defenceLevel("d-fordwood"), LONG = defenceLevel("d-longcrossing");
const make = (level = GORGE, difficulty = "standard") => new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level, difficulty });
const run = (s, seconds) => { for (let i = 0; i < Math.round(seconds * 20) && !s.result; i++) s.tick(0.05); };
const foes = (s) => s.entities.filter((e) => e.team === 1 && e.kind === "unit" && e.hp > 0);
const rich = (s) => { s.players[0].alloy = 1e5; return s; };
// One short wave on a chosen route, for exact checks.
const tiny = (level, groups, extra = {}) => ({ ...level, id: "d-test", defence: { ...level.defence, firstWave: 2, gap: 3, waves: [{ groups, bonus: 10 }], ...extra } });
const memory = () => { const data = new Map(); return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), data }; };

test("the Tank emplacement and the Scorcher flame trap cost and hit what garrisons.json says", () => {
  const s = rich(make());
  assert.ok(s.command({ team: 0, type: "padBuild", pad: "g1", crew: "tank" }));
  assert.ok(s.command({ team: 0, type: "padBuild", pad: "g2", crew: "scorcher" }));
  const tank = s.towerOn("g1"), flame = s.towerOn("g2"), t = GARRISONS.crews.tank, f = GARRISONS.crews.scorcher;
  assert.equal(s.players[0].alloy, 1e5 - t.cost[0] - f.cost[0]);
  assert.equal(tank.shot, "tank");
  assert.equal(tank.damage, D.tank.damage * t.damage);
  assert.ok(tank.interval > D.tank.interval, "slow: heavy single shots");
  assert.ok(!tank.splash_radius, "single target");
  assert.equal(tank.mechanical_bonus, t.mech, "strong against machines");
  assert.equal(tank.counter, undefined, "no bonus against infantry swarms");
  assert.equal(flame.range, D.scorcher.range + f.range, "short range");
  assert.deepEqual(flame.burn, { dps: f.burn.dps, radius: f.burn.radius, seconds: f.burn.seconds, every: f.burn.every });
  assert.ok(flame.splash_radius > 0 && flame.counter === "melee", "made for swarms on foot");
  // A burning patch where the flame trap fires, as Burn line lays it, at most every `every` seconds.
  const foe = s.spawn("vanguard", 1, flame.x + 4, flame.z, true);
  flame.cooldown = 0;
  s.hit(flame, foe);
  assert.equal(s.zones.length, 1);
  assert.equal(s.zones[0].radius, f.burn.radius);
  s.hit(flame, foe);
  assert.equal(s.zones.length, 1, "one patch per burn interval");
  assert.ok(s.events.some((e) => e.type === "ability" && e.ability === "burnline"), "the Burn line fire effect plays");
});

test("tier-3 branches: only at tier 3, once, for their cost, with their stat deltas", () => {
  for (const [crew, g] of Object.entries(GARRISONS.crews)) {
    assert.equal(Object.keys(g.branches).length, 2, `${crew}: two branches`);
    for (const [branch, b] of Object.entries(g.branches)) {
      const s = rich(make()), pad = "g3";
      s.command({ team: 0, type: "padBuild", pad, crew });
      const t = s.towerOn(pad);
      assert.equal(s.command({ team: 0, type: "padBranch", building: t.id, branch }), false, `${crew}: not before tier 3`);
      s.command({ team: 0, type: "padUpgrade", building: t.id });
      s.command({ team: 0, type: "padUpgrade", building: t.id });
      const plain = { ...t }, alloy = s.players[0].alloy;
      assert.ok(s.command({ team: 0, type: "padBranch", building: t.id, branch }), `${crew} ${branch}`);
      assert.equal(s.players[0].alloy, alloy - b.cost);
      assert.equal(t.branch, branch);
      assert.equal(t.spent, g.cost.reduce((a, c) => a + c, 0) + b.cost);
      assert.equal(s.command({ team: 0, type: "padBranch", building: t.id, branch: Object.keys(g.branches).find((k) => k !== branch) }), false, "one branch per tower");
      if (b.damage) assert.ok(Math.abs(t.damage - plain.damage * b.damage) < 1e-9, `${crew} ${branch} damage`);
      if (b.interval) assert.ok(Math.abs(t.interval - plain.interval * b.interval) < 1e-9);
      if (b.range) assert.equal(t.range, plain.range + b.range);
      if (b.reveal) assert.equal(t.reveal, plain.reveal + b.reveal);
      if (b.splash) assert.ok(Math.abs(t.splash_radius - plain.splash_radius * b.splash) < 1e-9);
      if (b.splash_radius) assert.equal(t.splash_radius, b.splash_radius);
      if (b.mech) assert.ok(Math.abs(t.mechanical_bonus - plain.mechanical_bonus * b.mech) < 1e-9);
      if (b.slow) assert.deepEqual(t.slow, b.slow);
      if (b.mark) assert.deepEqual(t.beacon, b.mark);
      if (b.burn?.dps) assert.ok(Math.abs(t.burn.dps - plain.burn.dps * b.burn.dps) < 1e-9);
      if (b.burn?.radius) assert.equal(t.burn.radius, plain.burn.radius + b.burn.radius);
      // Saved and loaded with its branch, and the sale refunds it too.
      const loaded = Simulation.load(s.serialize());
      assert.equal(loaded.hash(), s.hash());
      const before = s.players[0].alloy;
      s.command({ team: 0, type: "padSell", building: t.id });
      assert.equal(s.players[0].alloy, before + Math.floor(t.spent * GARRISONS.sell));
    }
  }
  const s = rich(make());
  s.command({ team: 0, type: "padBuild", pad: "g1", crew: "ranger" });
  const t = s.towerOn("g1");
  s.command({ team: 0, type: "padUpgrade", building: t.id }); s.command({ team: 0, type: "padUpgrade", building: t.id });
  assert.equal(s.command({ team: 0, type: "padBranch", building: t.id, branch: "cluster" }), false, "a branch of another crew");
  assert.equal(s.command({ team: 1, type: "padBranch", building: t.id, branch: "marksman" }), false, "only the owner");
});

test("Suppressor hits slow the target; a Beacon marks it to take more damage", () => {
  const s = rich(make());
  for (const [pad, crew, branch] of [["g1", "ranger", "suppressor"], ["g2", "watcher", "beacon"]]) {
    s.command({ team: 0, type: "padBuild", pad, crew });
    const t = s.towerOn(pad);
    s.command({ team: 0, type: "padUpgrade", building: t.id }); s.command({ team: 0, type: "padUpgrade", building: t.id });
    s.command({ team: 0, type: "padBranch", building: t.id, branch });
  }
  const foe = s.spawn("vanguard", 1, 0, 0, true), speed = s.moveSpeed(foe);
  s.hit(s.towerOn("g1"), foe);
  assert.ok(Math.abs(s.moveSpeed(foe) - speed * GARRISONS.crews.ranger.branches.suppressor.slow.factor) < 1e-9);
  run(s, GARRISONS.crews.ranger.branches.suppressor.slow.seconds + 0.1);
  assert.equal(s.moveSpeed(foe), speed, "the slow wears off");
  const other = s.spawn("vanguard", 1, 2, 0, true);
  s.hit(s.towerOn("g2"), other);
  assert.equal(other.markTaken, GARRISONS.crews.watcher.branches.beacon.mark.taken);
  assert.ok(other.markedUntil > s.time);
});

test("the commander: a gold-trimmed hero that moves, holds, shells, reinforces and comes back", () => {
  const s = make(GORGE), hero = s.commander(), c = GARRISONS.commander;
  assert.ok(hero?.hero && hero.blocker && hero.stance === "hold" && hero.ability === null);
  assert.equal(hero.type, s.typeFor(0, c.slot));
  assert.equal(hero.maxHp, Math.round(D[hero.type].hp * c.hp));
  assert.deepEqual([hero.x, hero.z], [GORGE.defence.commander.x, GORGE.defence.commander.z]);
  assert.ok(modelsForMatch(s).includes("tank") && modelsForMatch(s).includes("vanguard"));
  const start = GORGE.defence.routes.main[0];
  assert.equal(s.command({ team: 0, type: "heroMove", x: start.x + 2, z: start.z }), false, "never onto the spawn spot");
  const post = GORGE.defence.routes.main[5];
  assert.ok(s.command({ team: 0, type: "heroMove", x: post.x, z: post.z }));
  run(s, 25);
  assert.ok(Math.hypot(hero.x - post.x, hero.z - post.z) < 1.5, "walked to its post");
  // Barrage: a strike within reach, then the cooldown.
  assert.equal(s.command({ team: 0, type: "heroCast", ability: "barrage", x: hero.x + c.barrage.range + 1, z: hero.z }), false, "out of reach");
  assert.ok(s.command({ team: 0, type: "heroCast", ability: "barrage", x: hero.x + 5, z: hero.z }));
  assert.equal(s.strikes.at(-1).damage, c.barrage.damage);
  assert.ok(Math.abs(s.commanderCooldown("barrage") - c.barrage.cooldown) < 1e-9);
  assert.equal(s.command({ team: 0, type: "heroCast", ability: "barrage", x: hero.x + 5, z: hero.z }), false, "cooling down");
  // Reinforce: three Vanguards that hold the road for 20 s, then leave.
  assert.ok(s.command({ team: 0, type: "heroCast", ability: "reinforce", x: hero.x + 3, z: hero.z }));
  const guards = s.entities.filter((e) => e.team === 0 && e.blocker && !e.hero);
  assert.equal(guards.length, c.reinforce.count);
  assert.ok(guards.every((g) => g.type === s.typeFor(0, "vanguard") && g.stance === "hold"));
  assert.ok(Math.abs(s.commanderCooldown("reinforce") - c.reinforce.cooldown) < 1e-9);
  run(s, c.reinforce.seconds + 0.2);
  assert.equal(s.entities.filter((e) => e.team === 0 && e.blocker && !e.hero).length, 0, "the Vanguards leave after 20 s");
  run(s, c.barrage.cooldown);
  assert.equal(s.commanderCooldown("barrage"), 0);
  // Killed: back at its post 20 s later, cooldowns kept.
  s.applyDamage(hero, 1e6, 1, null);
  run(s, 1);
  assert.equal(s.commander(), null);
  assert.ok(s.events.some((e) => e.type === "commanderDown"));
  run(s, c.respawn - 1.2);
  assert.equal(s.commander(), null, "not before 20 s");
  run(s, 0.5);
  const back = s.commander();
  assert.ok(back && back.id !== hero.id && back.x === GORGE.defence.commander.x);
  assert.ok(s.events.some((e) => e.type === "commanderBack"));
});

test("a blocker holds a wave unit in front of it; the column shoots it instead of walking past", () => {
  const level = tiny(GORGE, [{ units: { vanguard: 1 }, route: "main", every: 0.7 }]);
  const s = make(level);
  run(s, 2.2);
  const [foe] = foes(s), hero = s.commander();
  const pts = level.defence.routes.main;
  // Put the commander right in the way, a little down the first leg.
  hero.x = foe.x + (pts[1].x - pts[0].x) * 0.12; hero.z = foe.z + (pts[1].z - pts[0].z) * 0.12;
  hero.orders = [];
  run(s, 3);
  assert.ok(Math.hypot(foe.x - hero.x, foe.z - hero.z) < hero.radius + foe.radius + 0.6, "stopped at the commander");
  assert.ok(hero.hp < hero.maxHp || foe.hp < foe.maxHp, "they fight");
});

test("perks apply only to the Defence menu's levels and are bought with stars", () => {
  const plain = make(GORGE), perked = make(defenceVariant(GORGE, { perks: ["quartermaster", "reserves", "gunnery"] }));
  assert.equal(perked.defence.lives, plain.defence.lives + GARRISONS.perks.reserves.lives);
  assert.equal(perked.defenceStatus().maxLives, 22);
  const cost = GARRISONS.crews.ranger.cost[0], alloy = perked.players[0].alloy;
  assert.ok(perked.command({ team: 0, type: "padBuild", pad: "g1", crew: "ranger" }));
  assert.equal(perked.players[0].alloy, alloy - Math.round(cost * 0.8), "the first tower is a fifth cheaper");
  assert.ok(perked.command({ team: 0, type: "padBuild", pad: "g2", crew: "ranger" }));
  assert.equal(perked.players[0].alloy, alloy - Math.round(cost * 0.8) - cost, "only the first");
  const hero = perked.commander();
  perked.command({ team: 0, type: "heroCast", ability: "barrage", x: hero.x + 3, z: hero.z });
  assert.ok(Math.abs(perked.commanderCooldown("barrage") - GARRISONS.commander.barrage.cooldown * GARRISONS.perks.gunnery.cooldown) < 1e-9);
  // A campaign mission's defence block never carries perks: the plain level plays as designed.
  assert.equal(plain.hasPerk("reserves"), false);
  const before = plain.players[0].alloy;
  plain.command({ team: 0, type: "padBuild", pad: "g1", crew: "ranger" });
  assert.equal(plain.players[0].alloy, before - cost);
  // Buying: stars earned minus stars spent.
  let p = recordDefence({ levels: {} }, "d-gorge", { stars: 3, lives: 20 });
  p = recordDefence(p, "d-bridges", { stars: 2, lives: 12 });
  assert.equal(starsFree(p), 5);
  assert.ok(canBuyPerk(p, "gunnery"));
  p = buyPerk(p, "gunnery");
  assert.equal(starsFree(p), 0);
  assert.equal(buyPerk(p, "reserves"), p, "not enough stars left");
  assert.equal(buyPerk(p, "gunnery"), p, "bought once");
  const store = memory();
  saveDefence(p, store);
  assert.deepEqual(loadDefence(store).perks, ["gunnery"]);
  store.setItem(DEFENCE_KEY, JSON.stringify({ levels: {}, perks: ["gunnery", "gunnery", "cheat"] }));
  assert.deepEqual(loadDefence(store).perks, ["gunnery"], "unknown and repeated perks are dropped");
});

test("demolition: Defence river levels only, never the ford, a 3 s fuse, then water and a path around", () => {
  // Not on a valley, not on a river map whose defence block leaves bridges off (campaign, Skirmish).
  assert.equal(rich(make(GORGE)).command({ team: 0, type: "demolish", crossing: -22 }), false);
  const off = rich(make({ ...BRIDGES, defence: { ...BRIDGES.defence, bridges: false } }));
  assert.equal(off.command({ team: 0, type: "demolish", crossing: -22 }), false);
  const skirmish = new Simulation({ map: "riverlands", ai: false });
  assert.equal(skirmish.command({ team: 0, type: "demolish", crossing: -22 }), false);
  assert.equal(skirmish.crossings, undefined);
  const s = make(BRIDGES), alloy = s.players[0].alloy;
  assert.equal(s.command({ team: 0, type: "demolish", crossing: 0 }), false, "the ford cannot be blown");
  assert.equal(s.command({ team: 1, type: "demolish", crossing: -22 }), false, "only the defender");
  assert.equal(s.crossings, undefined, "nothing is stored until a bridge is blown");
  assert.ok(s.command({ team: 0, type: "demolish", crossing: -22 }));
  assert.equal(s.players[0].alloy, alloy - GARRISONS.demolish.cost);
  assert.equal(s.crossings[-22].state, "fuse");
  assert.ok(s.events.some((e) => e.type === "fuse" && e.x === -22));
  assert.equal(s.terrain.at(-22, 0), "bridge", "still standing during the fuse");
  assert.equal(s.command({ team: 0, type: "demolish", crossing: -22 }), false, "already lit");
  run(s, GARRISONS.demolish.fuse - 0.1);
  assert.equal(s.crossings[-22].state, "fuse");
  run(s, 0.15);
  assert.equal(s.crossings[-22].state, "blown");
  assert.equal(s.terrain.at(-22, 0), "water");
  assert.equal(s.nav.canTraverse({ x: -22, z: -6 }, { x: -22, z: 6 }, 0.6), false, "nobody walks over it");
  const path = s.nav.path({ x: -22, z: -12 }, { x: -22, z: 12 }, 0.6);
  assert.ok(path.length && path.some((p) => Math.abs(p.z) < 3 && Math.abs(p.x - -22) > 4), "the way round goes over another crossing");
});

test("a blown bridge survives save and load: same hash, still water, same path", () => {
  const s = make(BRIDGES);
  s.command({ team: 0, type: "demolish", crossing: 22 });
  run(s, 36);
  const loaded = Simulation.load(s.serialize());
  assert.equal(loaded.hash(), s.hash());
  assert.equal(loaded.terrain.at(22, 0), "water");
  assert.equal(loaded.nav.canTraverse({ x: 22, z: -6 }, { x: 22, z: 6 }, 0.6), false);
  assert.deepEqual(loaded.nav.path({ x: 22, z: -12 }, { x: 22, z: 12 }, 0.6), s.nav.path({ x: 22, z: -12 }, { x: 22, z: 12 }, 0.6));
  run(s, 30); run(loaded, 30);
  assert.equal(loaded.hash(), s.hash());
});

test("units on the span are thrown to the nearer bank and hurt; columns on that road turn aside", () => {
  const s = make(BRIDGES);
  const north = s.spawn("vanguard", 1, -22, -1, true), south = s.spawn("vanguard", 1, -21, 1.5, true), mine = s.spawn("tank", 0, -24, 0.5, true);
  // A column still north of the river on the west road, and one already over it.
  const coming = s.spawn("vanguard", 1, -20, -20, true), over = s.spawn("vanguard", 1, -22, 14, true);
  coming.orders = [{ type: "route", route: "west", leg: 3 }];
  over.orders = [{ type: "route", route: "west", leg: 4 }];
  const hp = north.hp + north.shield;
  s.command({ team: 0, type: "demolish", crossing: -22 });
  run(s, GARRISONS.demolish.fuse + 0.05);
  assert.ok(north.z <= -3 - north.radius, `north bank ${north.z}`);
  assert.ok(south.z >= 3 + south.radius && mine.z >= 3 + mine.radius, "south bank (sign of z)");
  for (const e of [north, south, mine]) assert.ok(s.terrain.canStand(e.x, e.z, e.radius), "on solid ground");
  assert.ok(north.hp + north.shield <= hp - GARRISONS.demolish.damage + 1e-6, "hurt");
  assert.equal(coming.orders[0].route, "ford", "the nearest open crossing");
  assert.equal(over.orders[0].route, "west", "already across: carries on");
});

test("the last open crossing a level's roads use can never be blown", () => {
  // A river level whose roads use only the two bridges.
  const two = { ...BRIDGES, defence: { ...BRIDGES.defence, crossings: { west: -22, east: 22 } } };
  const s = rich(make(two));
  assert.ok(s.command({ team: 0, type: "demolish", crossing: -22 }));
  assert.equal(s.command({ team: 0, type: "demolish", crossing: 22 }), false, "refused while the other is lit");
  run(s, 4);
  assert.equal(s.command({ team: 0, type: "demolish", crossing: 22 }), false, "refused: the road would seal");
  assert.ok(s.events.some((e) => e.type === "message" && /last way across/.test(e.text)));
  // With the ford in the level's roads, both bridges may go.
  const t = rich(make(BRIDGES));
  assert.ok(t.command({ team: 0, type: "demolish", crossing: -22 }));
  assert.ok(t.command({ team: 0, type: "demolish", crossing: 22 }));
});

test("bridge builders stop at the bank and raise a pontoon in 20 s; the work is lost if they all fall", () => {
  const level = tiny(BRIDGES, [{ units: { vanguard: 2 }, route: "west", every: 0.7, tag: "bridger" }, { units: { vanguard: 2 }, route: "west", every: 0.7, delay: 1 }], { startBlown: [-22] });
  const s = make(level, "standard");
  assert.equal(s.crossings[-22].state, "blown");
  run(s, 3.5);
  const builders = foes(s).filter((e) => e.bridger), walkers = foes(s).filter((e) => !e.bridger);
  assert.equal(builders.length, 2);
  assert.ok(walkers.every((e) => e.orders[0].route === "ford"), "the others take the ford");
  // Walk to the bank, then 20 s of work.
  for (let i = 0; i < 20 * 40 && s.crossings[-22].progress === 0; i++) s.tick(0.05);
  assert.ok(s.crossings[-22].progress > 0, "building started");
  assert.ok(builders.some((e) => Math.abs(e.z + 5.2) < 2 && Math.abs(e.x + 22) < 4) && builders.every((e) => e.z < -3), "waiting at the north bank");
  run(s, 10);
  assert.equal(s.crossings[-22].state, "blown");
  // Kill both builders: the work resets.
  for (const e of builders) s.applyDamage(e, 1e6, 0, null);
  run(s, 0.2);
  assert.equal(s.crossings[-22].progress, 0);
  // A second try, left alone, finishes at 20 s: the crossing wades like the ford.
  const again = make(level, "standard");
  run(again, 3.5);
  for (let i = 0; i < 20 * 40 && again.crossings[-22].progress === 0; i++) again.tick(0.05);
  const started = again.time;
  for (let i = 0; i < 20 * 25 && again.crossings[-22].state !== "pontoon"; i++) again.tick(0.05);
  assert.equal(again.crossings[-22].state, "pontoon");
  assert.ok(Math.abs(again.time - started - GARRISONS.demolish.pontoon) < 0.2, `${(again.time - started).toFixed(2)} s`);
  assert.equal(again.terrain.at(-22, 0), "ford");
  assert.ok(again.nav.canTraverse({ x: -22, z: -6 }, { x: -22, z: 6 }, 0.6));
  const wader = again.spawn("vanguard", 1, -22, 0, true);
  assert.ok(again.inFord(wader), "slow like the ford");
  const loaded = Simulation.load(again.serialize());
  assert.equal(loaded.hash(), again.hash());
  assert.equal(loaded.terrain.at(-22, 0), "ford");
});

test("mixed-faction waves resolve each group with its own roster, deterministically", () => {
  const s = make(FORDWOOD);
  const wave = FORDWOOD.defence.waves[2];
  assert.equal(s.waveType(wave.groups[0], "ranger"), "drone", "Warden drones in an Ashfall level");
  assert.equal(s.waveType(wave.groups[1], "vanguard"), "scrapper", "Ashfall's own roster");
  s.defence.wave = 2;
  s.startWave();
  assert.ok(s.defence.queue.some((q) => q.type === "drone") && s.defence.queue.some((q) => q.type === "scrapper"));
  assert.ok(modelsForMatch(make(FORDWOOD)).includes("drone") && modelsForMatch(make(FORDWOOD)).includes("walker"));
  assert.ok(modelsForMatch(make(LONG)).includes("rider") && modelsForMatch(make(LONG)).includes("shade"));
  const levels = DEFENCE_LEVELS.filter((l) => l.defence.waves.some((w) => w.groups.some((g) => g.faction)));
  assert.ok(levels.length >= 2, "two levels at least");
  const a = make(LONG, "veteran"), b = make(LONG, "veteran");
  for (const sim of [a, b]) { sim.players[0].alloy = 5000; for (const pad of ["l3", "l6", "l13", "l15"]) sim.command({ team: 0, type: "padBuild", pad, crew: "breaker" }); for (let i = 0; i < 4; i++) { sim.defence.nextAt = sim.time; run(sim, 30); } }
  assert.equal(a.hash(), b.hash());
});

test("endless waves come from the seed alone and never end in victory; the daily seed is the date", () => {
  const def = defenceVariant(GORGE, { variant: "endless", seed: 1234 }).defence;
  assert.deepEqual(endlessWave(def, 7), endlessWave(def, 7));
  assert.notDeepEqual(endlessWave(def, 7), endlessWave({ ...def, endless: { seed: 99 } }, 7));
  const size = (n) => endlessWave(def, n).groups.reduce((a, g) => a + Object.values(g.units).reduce((x, y) => x + y * (D[y] ? 1 : 1), 0) * (D[Object.keys(g.units)[0]].pop || 1), 0);
  assert.ok(size(30) > size(10) && size(10) > size(1), "the waves grow");
  for (const n of [0, 5, 40]) for (const g of endlessWave(def, n).groups) { assert.ok(def.routes[g.route]); for (const slot of Object.keys(g.units)) assert.ok(D[slot]?.kind === "unit"); }
  const s = make(defenceVariant(GORGE, { variant: "endless", seed: 1234 }));
  assert.equal(s.waveTotal(), Infinity);
  assert.equal(s.defenceStatus().waves, null);
  s.players[0].alloy = 9000;
  for (const pad of ["g1", "g3", "g4", "g6"]) s.command({ team: 0, type: "padBuild", pad, crew: "ranger" });
  s.defence.wave = 11;
  s.defence.nextAt = s.time;
  run(s, 1);
  assert.equal(s.defence.wave, 12, "past the designed ten");
  const t = make(defenceVariant(GORGE, { variant: "endless", seed: 1234 }));
  t.players[0].alloy = 9000;
  for (const pad of ["g1", "g3", "g4", "g6"]) t.command({ team: 0, type: "padBuild", pad, crew: "ranger" });
  t.defence.wave = 11; t.defence.nextAt = t.time;
  run(s, 60); run(t, 61);
  assert.equal(s.hash(), t.hash(), "the same seed plays the same");
  s.defence.lives = 0;
  run(s, 0.1);
  assert.equal(s.result, "defeat");
  assert.ok(s.events.some((e) => e.type === "missionEnd" && e.endless && e.score === s.defence.cleared));
  // Daily: one seed per calendar day, the same for everyone.
  assert.equal(dailySeed("2026-11-13"), dailySeed("2026-11-13"));
  assert.notEqual(dailySeed("2026-11-13"), dailySeed("2026-11-14"));
  assert.equal(dayKey(new Date(2026, 10, 3)), "2026-11-03");
  assert.equal(endlessSeed("d-gorge"), seedOf("d-gorge"));
  // Best scores, kept locally per level (and per day for the daily).
  let p = recordScore({ levels: {} }, "endless", "d-gorge", 14);
  p = recordScore(p, "endless", "d-gorge", 9);
  p = recordScore(p, "daily", "d-bridges", 6, "2026-11-13");
  assert.equal(bestScore(p, "endless", "d-gorge"), 14);
  assert.equal(bestScore(p, "daily", "d-bridges", "2026-11-13"), 6);
  assert.equal(bestScore(p, "daily", "d-bridges", "2026-11-14"), 0);
  for (let d = 1; d <= 9; d++) p = recordScore(p, "daily", "d-gorge", d, `2026-12-0${d}`);
  assert.equal(Object.keys(p.daily).length, 7, "a week of daily scores is kept");
  const store = memory();
  saveDefence(p, store);
  assert.deepEqual(loadDefence(store), p);
});

test("the 0.17 levels and every older defence block still play as before (no commander, no crossings)", () => {
  const old = { ...GORGE, defence: { ...GORGE.defence } };
  delete old.defence.commander;
  const s = make(old);
  assert.equal(s.entities.length, 0);
  assert.equal(s.defence.hero, undefined);
  run(s, 40);
  assert.equal(s.crossings, undefined);
  assert.equal(s.zones, undefined);
  const saved = JSON.parse(s.serialize()).state;
  assert.ok(!("crossings" in saved) && !("hero" in saved.defence) && !("firstBuilt" in saved.defence));
});
