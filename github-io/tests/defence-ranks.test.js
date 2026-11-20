// Frontier Defence 0.24: two ranks after each tower branch (effects, not only numbers), armour
// squad upgrades (Rank 2, then Assault or Bulwark), and tower survival (front-line crew health,
// steeper tiers, field repair once a tower has not been hit for a while).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { GARRISONS } from "../src/sim/defence.js";
import { DEFINITIONS as D } from "../src/data.js";
import { RANK_BONUS } from "../src/sim/tactics.js";
import { advance } from "./lib/sim.js";

const GORGE = DEFENCE_LEVELS[0], ROADS = DEFENCE_LEVELS.find((l) => l.id === "d-crossroads");
const make = (level = GORGE, difficulty = "standard") => new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level, difficulty });
const run = (s, seconds) => { advance(s, seconds, { steps: "round", events: "leave" }); };
// A gold tower with a branch on the level's first pad.
function branched(s, crew, branch, pad = GORGE.defence.pads[0].id) {
  s.players[0].alloy = 10000;
  assert.ok(s.command({ team: 0, type: "padBuild", pad, crew }));
  const t = s.towerOn(pad);
  assert.ok(s.command({ team: 0, type: "padUpgrade", building: t.id }));
  assert.ok(s.command({ team: 0, type: "padUpgrade", building: t.id }));
  assert.ok(s.command({ team: 0, type: "padBranch", building: t.id, branch }));
  return t;
}

test("every branch has two ranks with a cost and at least one effect beyond armour", () => {
  for (const [crew, g] of Object.entries(GARRISONS.crews))
    for (const [id, b] of Object.entries(g.branches)) {
      assert.equal(b.ranks?.length, 2, `${crew}/${id}`);
      for (const r of b.ranks) {
        assert.ok(r.cost >= 100 && r.cost <= 220, `${id}: cost ${r.cost}`);
        assert.ok(Object.keys(r).some((k) => !["cost", "hp"].includes(k)), `${id}: an effect`);
      }
    }
});

test("front-line crews carry more health, and the tiers climb more steeply", () => {
  const s = make(), hp = (crew, tier) => s.garrisonStats(crew, tier).maxHp;
  assert.equal(hp("ranger", 1), Math.round(D.tower.hp * GARRISONS.hp));
  for (const crew of ["scorcher", "tank"]) assert.ok(hp(crew, 1) >= hp("ranger", 1) * 1.45, `${crew}: ${hp(crew, 1)}`);
  assert.ok(hp("breaker", 1) > hp("ranger", 1));
  assert.ok(Math.abs(hp("ranger", 3) / hp("ranger", 1) - 1.75) < 0.01);
  assert.ok(Math.abs(hp("ranger", 2) / hp("ranger", 1) - 1.35) < 0.01);
});

test("ranks: bought in order after the branch, paid for, each adding its effect and armour", () => {
  const s = make(), pad = GORGE.defence.pads[0].id;
  s.players[0].alloy = 10000;
  s.command({ team: 0, type: "padBuild", pad, crew: "ranger" });
  const t = s.towerOn(pad);
  s.command({ team: 0, type: "padUpgrade", building: t.id });
  s.command({ team: 0, type: "padUpgrade", building: t.id });
  assert.equal(s.command({ team: 0, type: "padRank", building: t.id }), false, "no rank before a branch");
  s.command({ team: 0, type: "padBranch", building: t.id, branch: "marksman" });
  const ranks = GARRISONS.crews.ranger.branches.marksman.ranks, before = { hp: t.maxHp, damage: t.damage, range: t.range, mech: t.mechanical_bonus, alloy: s.players[0].alloy, spent: t.spent };
  assert.ok(!t.pierce && !t.branchRank);
  assert.ok(s.command({ team: 0, type: "padRank", building: t.id }));
  assert.equal(t.branchRank, 1);
  assert.equal(s.players[0].alloy, before.alloy - ranks[0].cost);
  assert.equal(t.spent, before.spent + ranks[0].cost, "a sale refunds part of it");
  assert.equal(t.pierce, 0.5);
  assert.equal(t.maxHp, Math.round(before.hp * ranks[0].hp));
  assert.equal(t.hp, t.maxHp, "the new armour comes whole");
  assert.ok(Math.abs(t.damage - before.damage * ranks[0].damage) < 1e-9);
  assert.ok(s.command({ team: 0, type: "padRank", building: t.id }));
  assert.equal(t.branchRank, 2);
  assert.equal(t.pierce, 1);
  assert.equal(t.range, before.range + 1);
  assert.ok(Math.abs(t.mechanical_bonus - before.mech * 2) < 1e-9);
  assert.equal(s.command({ team: 0, type: "padRank", building: t.id }), false, "two ranks only");
  // Not enough alloy: refused, nothing paid.
  const s2 = make(), v = branched(s2, "breaker", "cluster");
  s2.players[0].alloy = 10;
  assert.equal(s2.command({ team: 0, type: "padRank", building: v.id }), false);
  assert.equal(s2.players[0].alloy, 10);
});

test("rank effects: piercing shots pass the shield, bursts, spreading slows and marks, wider blasts", () => {
  const s = make(), t = branched(s, "ranger", "marksman");
  s.command({ team: 0, type: "padRank", building: t.id });
  s.command({ team: 0, type: "padRank", building: t.id });
  const foe = s.spawn("vanguard", 1, t.x + 4, t.z, true, true);
  foe.hp = foe.maxHp = 5000;
  foe.shield = foe.maxShield = 200;
  s.hit(t, foe);
  assert.equal(foe.shield, 200, "rank 2 marksman: every shot passes the shield");
  assert.ok(foe.hp < 5000);
  // Without the rank the shield takes the shot first.
  const s0 = make(), t0 = branched(s0, "ranger", "marksman"), f0 = s0.spawn("vanguard", 1, t0.x + 4, t0.z, true, true);
  f0.shield = f0.maxShield = 200;
  s0.hit(t0, f0);
  assert.ok(f0.shield < 200);

  // Rapid rank 1: two shots `gap` apart, then the full reload.
  const s1 = make(), r = branched(s1, "antitank", "rapid");
  s1.command({ team: 0, type: "padRank", building: r.id });
  const f1 = s1.spawn("vanguard", 1, r.x + 4, r.z, true, true);
  f1.hp = f1.maxHp = 9999;
  s1.hit(r, f1);
  assert.equal(r.cooldown, GARRISONS.crews.antitank.branches.rapid.ranks[0].burst.gap);
  s1.hit(r, f1);
  assert.equal(r.cooldown, r.interval);

  // Suppressor rank 2: the slow falls on the neighbours too.
  const s2 = make(), p = branched(s2, "ranger", "suppressor");
  s2.command({ team: 0, type: "padRank", building: p.id });
  s2.command({ team: 0, type: "padRank", building: p.id });
  const a = s2.spawn("vanguard", 1, p.x + 5, p.z, true, true), b = s2.spawn("vanguard", 1, p.x + 6.5, p.z, true, true), far = s2.spawn("vanguard", 1, p.x + 12, p.z, true, true);
  s2.hit(p, a);
  assert.ok(a.slowUntil > s2.time && b.slowUntil > s2.time && !(far.slowUntil > s2.time));
  assert.equal(b.slowBy, GARRISONS.crews.ranger.branches.suppressor.ranks[1].slow.factor);

  // Beacon rank 2: the mark spreads.
  const s3 = make(), w = branched(s3, "watcher", "beacon");
  s3.command({ team: 0, type: "padRank", building: w.id });
  s3.command({ team: 0, type: "padRank", building: w.id });
  const m1 = s3.spawn("vanguard", 1, w.x + 5, w.z, true, true), m2 = s3.spawn("vanguard", 1, w.x + 6.5, w.z, true, true);
  s3.hit(w, m1);
  assert.ok(m2.markedUntil > s3.time && m2.markTaken === GARRISONS.crews.watcher.branches.beacon.ranks[0].mark.taken);

  // Cluster: the blast grows per rank; Shrapnel adds a metre.
  const s4 = make(), c = branched(s4, "breaker", "cluster"), r0 = c.splash_radius;
  s4.command({ team: 0, type: "padRank", building: c.id });
  assert.ok(Math.abs(c.splash_radius - r0 * 1.2) < 1e-9);
  const s5 = make(), sh = branched(s5, "tank", "shrapnel"), q0 = sh.splash_radius;
  s5.command({ team: 0, type: "padRank", building: sh.id });
  assert.equal(sh.splash_radius, q0 + 1);
  // Inferno: hotter ground.
  const s6 = make(), f = branched(s6, "scorcher", "inferno"), dps = f.burn.dps;
  s6.command({ team: 0, type: "padRank", building: f.id });
  assert.ok(Math.abs(f.burn.dps - dps * 1.3) < 1e-9);
});

test("field repair: nothing while the tower is being hit, then a share a second once it has been left alone", () => {
  const s = make(), pad = GORGE.defence.pads[0].id;
  s.players[0].alloy = 1000;
  s.command({ team: 0, type: "padBuild", pad, crew: "ranger" });
  const t = s.towerOn(pad), foe = s.spawn("vanguard", 1, 60, 60, true, true), r = GARRISONS.repair;
  foe.stance = "hold";
  run(s, 1);
  const hurt = (amount) => s.applyDamage(t, amount, 1, foe.id);
  t.shield = 0;
  hurt(600);
  const low = t.hp;
  // Hit again every 2 s for 10 s: never mended in between.
  for (let k = 0; k < 5; k++) { run(s, 2); t.shield = 0; hurt(1); }
  assert.ok(t.hp <= low - 5 + 1e-6, `no repair while under fire (${t.hp.toFixed(1)} vs ${low.toFixed(1)})`);
  const hit = t.hp;
  run(s, r.delay - 0.2);
  assert.equal(t.hp, hit, "not before the delay");
  run(s, 1.2);
  assert.ok(t.hp > hit, "mending after the delay");
  run(s, 1);
  const a = t.hp;
  run(s, 1);
  assert.ok(Math.abs(t.hp - a - t.maxHp * r.rate) < 1e-6, `${r.rate * 100}% a second`);
  run(s, 40);
  assert.equal(t.hp, t.maxHp, "up to full, never past it");
  assert.ok(s.time < (GORGE.defence.firstWave ?? 30) + 40 + 30);
});

test("armour upgrades: Rank 2, then Assault or Bulwark once, kept through a refit", () => {
  const s = make(ROADS);
  s.players[0].alloy = 5000;
  assert.ok(s.command({ team: 0, type: "armourBuy" }));
  const squad = s.armourSquads()[0].squad, a = GARRISONS.armour, units = () => s.armourUnits(squad);
  const base = units().map((e) => ({ hp: e.maxHp, damage: e.damage, interval: e.interval, leash: e.leash }));
  assert.equal(s.command({ team: 0, type: "armourUpgrade", squad, branch: "bulwark" }), false, "no branch before Rank 2");
  assert.equal(s.armourNextUpgrade(squad).kind, "rank");
  let alloy = s.players[0].alloy;
  assert.ok(s.command({ team: 0, type: "armourUpgrade", squad }));
  assert.equal(s.players[0].alloy, alloy - a.rank2.cost);
  units().forEach((e, i) => {
    assert.equal(e.squadRank, 2);
    assert.equal(e.maxHp, Math.round(base[i].hp * a.rank2.hp));
    assert.equal(e.hp, e.maxHp);
    assert.ok(Math.abs(e.damage - base[i].damage * a.rank2.damage) < 1e-9);
    assert.equal(e.mend, a.rank2.repair);
  });
  assert.equal(s.command({ team: 0, type: "armourUpgrade", squad }), false, "Rank 2 once");
  assert.equal(s.command({ team: 0, type: "armourUpgrade", squad, branch: "charge" }), false);
  alloy = s.players[0].alloy;
  assert.ok(s.command({ team: 0, type: "armourUpgrade", squad, branch: "bulwark" }));
  assert.equal(s.players[0].alloy, alloy - a.branches.bulwark.cost);
  for (const [i, e] of units().entries()) {
    assert.equal(e.squadBranch, "bulwark");
    assert.equal(e.maxHp, Math.round(Math.round(base[i].hp * a.rank2.hp) / a.rank2.hp * a.rank2.hp * a.branches.bulwark.hp));
    assert.equal(e.mend, a.branches.bulwark.repair);
  }
  assert.equal(s.command({ team: 0, type: "armourUpgrade", squad, branch: "assault" }), false, "one branch only");
  assert.equal(s.armourNextUpgrade(squad), null);
  // A tank lost, the wave ends: the refit tank comes with the squad's rank and branch.
  const [keep, lost] = units(), want = keep.maxHp;
  lost.hp = 0;
  for (const e of s.entities) if (e.team === 1) e.hp = 0;
  s.startWave();
  s.defence.queue.length = 0;
  run(s, 1);
  assert.ok(s.defence.cleared >= 1);
  const now = units();
  assert.equal(now.length, 2);
  for (const e of now) { assert.equal(e.squadRank, 2); assert.equal(e.squadBranch, "bulwark"); assert.equal(e.maxHp, want); assert.equal(e.hp, e.maxHp); }

  // Assault: harder, faster guns, a longer leash, stronger against machines.
  const s2 = make(ROADS);
  s2.players[0].alloy = 5000;
  s2.command({ team: 0, type: "armourBuy" });
  const [t0] = s2.armourUnits(1), b0 = { damage: t0.damage, interval: t0.interval, leash: t0.leash, mech: t0.mechanical_bonus || 1 };
  s2.command({ team: 0, type: "armourUpgrade", squad: 1 });
  s2.command({ team: 0, type: "armourUpgrade", squad: 1, branch: "assault" });
  const as = a.branches.assault;
  assert.ok(Math.abs(t0.damage - b0.damage * a.rank2.damage * as.damage) < 1e-9);
  assert.ok(Math.abs(t0.interval - b0.interval * as.interval) < 1e-9);
  assert.equal(t0.leash, b0.leash + as.leash);
  assert.ok(Math.abs(t0.mechanical_bonus - b0.mech * as.mech) < 1e-9);
  assert.equal(t0.mend, a.rank2.repair);
});

test("a Rank 2 squad mends after the delay; a squad without it does not", () => {
  const s = make(ROADS);
  s.players[0].alloy = 5000;
  s.command({ team: 0, type: "armourBuy" });
  s.command({ team: 0, type: "armourBuy" });
  s.command({ team: 0, type: "armourUpgrade", squad: 1 });
  const [up] = s.armourUnits(1), [plain] = s.armourUnits(2);
  for (const e of [up, plain]) { e.hp = e.maxHp / 2; e.hitAt = s.time; }
  const was = [up.hp, plain.hp];
  run(s, GARRISONS.repair.delay + 2);
  assert.ok(up.hp > was[0] + up.maxHp * GARRISONS.armour.rank2.repair);
  assert.equal(plain.hp, was[1]);
});

test("new state appears only on first use; ranks and armour upgrades survive a save and replay exactly", () => {
  const fresh = make(ROADS);
  run(fresh, 2);
  const text = fresh.serialize();
  for (const key of ["branchRank", "squadRank", "squadBranch", "burstShot", "mend", "pierce"]) assert.ok(!text.includes(`"${key}"`), key);

  const s = make(ROADS, "veteran"), pad = ROADS.defence.pads[0].id;
  s.players[0].alloy = 4000;
  const plan = [
    [1, { type: "padBuild", pad, crew: "antitank" }],
    [3, { type: "padUpgrade" }],
    [4, { type: "padUpgrade" }],
    [5, { type: "padBranch", branch: "rapid" }],
    [6, { type: "padRank" }],
    [20, { type: "armourBuy" }],
    [30, { type: "armourUpgrade", squad: 1 }],
    [500, { type: "padRank" }],
    [520, { type: "armourUpgrade", squad: 1, branch: "assault" }],
  ];
  const save = { at: 300 };
  for (let tick = 0; tick < 1400 && !s.result; tick++) {
    for (const [at, c] of plan) if (at === tick) s.command({ team: 0, ...c, ...(c.type.startsWith("pad") && c.type !== "padBuild" ? { building: s.towerOn(pad).id } : {}) });
    if (tick === save.at) save.text = s.serialize();
    s.tick(0.05);
  }
  const t = s.towerOn(pad);
  assert.equal(t?.branchRank, 2, "the plan ran");
  assert.ok(s.armourUnits(1).every((e) => e.squadBranch === "assault"));
  const loaded = Simulation.load(save.text);
  assert.ok(loaded);
  assert.equal(loaded.towerOn(pad).branchRank, 1);
  assert.equal(loaded.towerOn(pad).burst.shots, 2);
  for (let tick = save.at; tick < 1400 && !loaded.result; tick++) {
    for (const c of s.commandLog) if (c.tick === loaded.ticks) { const { tick: _, ...command } = c; loaded.command(command); }
    loaded.tick(0.05);
  }
  assert.equal(loaded.hash(), s.hash());
  const replay = make(ROADS, "veteran");
  replay.players[0].alloy = 4000;
  for (let tick = 0; tick < 1400 && !replay.result; tick++) {
    for (const c of s.commandLog) if (c.tick === replay.ticks) { const { tick: _, ...command } = c; replay.command(command); }
    replay.tick(0.05);
  }
  assert.equal(replay.hash(), s.hash());
});

// ---------------------------------------------------------------- Promotions keep extra health (D1)
// A promotion used to rebuild health from the type's own figure, dropping the commander's factor,
// the armour upgrades and the tougher waves' factors. Ranks now build on `baseHp`, which a unit
// carries only when its health is not its type's.
// Kills of one-population units, enough for `ranks` more ranks.
const promote = (s, e, ranks = 1) => {
  const want = (e.rank || 0) + ranks;
  while ((e.rank || 0) < want) s.creditKill(e.id, { kind: "unit", pop: 1 });
};
const ranked = (hp, rank) => Math.round(hp * (1 + RANK_BONUS * rank));

test("a promotion keeps the commander's extra health, rank on rank, through a save", () => {
  const s = make(), hero = s.commander(), base = Math.round(D[hero.type].hp * GARRISONS.commander.hp);
  assert.equal(hero.maxHp, base);
  assert.equal(hero.baseHp, base);
  hero.hp = 500;
  promote(s, hero);
  assert.equal(hero.rank, 1);
  assert.equal(hero.maxHp, ranked(base, 1));
  // The patch-up is as before: the added health plus a quarter of the bar.
  assert.equal(hero.hp, Math.min(hero.maxHp, 500 + (hero.maxHp - base) + hero.maxHp * 0.25));
  promote(s, hero, 2);
  assert.equal(hero.maxHp, ranked(base, 3));
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.commander().baseHp, base);
  assert.equal(copy.commander().maxHp, ranked(base, 3));
  // A commander who falls comes back at rank 0 with the full factor.
  hero.hp = 0;
  run(s, GARRISONS.commander.respawn + 1);
  const back = s.commander();
  assert.ok(back && back.id !== hero.id && !back.rank);
  assert.equal(back.maxHp, base);
  assert.equal(back.baseHp, base);
});

test("an armour tank keeps its upgrades through a promotion, and a promotion before an upgrade keeps it too", () => {
  const s = make(ROADS), a = GARRISONS.armour;
  s.players[0].alloy = 5000;
  s.command({ team: 0, type: "armourBuy" });
  const [tank, other] = s.armourUnits(1), plain = Math.round(D[tank.type].hp * a.hp);
  // A tank of the plain squad has its type's health: no baseHp.
  assert.equal(tank.maxHp, plain);
  assert.ok(!("baseHp" in tank));
  // Other: promoted at once, then upgraded. Its next rank builds on the upgraded base.
  promote(s, other);
  assert.equal(other.maxHp, ranked(plain, 1));
  s.command({ team: 0, type: "armourUpgrade", squad: 1 });
  s.command({ team: 0, type: "armourUpgrade", squad: 1, branch: "bulwark" });
  const bulwark = tank.maxHp;
  assert.equal(bulwark, Math.round(Math.round(plain * a.rank2.hp) / a.rank2.hp * a.rank2.hp * a.branches.bulwark.hp));
  assert.equal(tank.baseHp, bulwark);
  promote(s, tank);
  assert.equal(tank.maxHp, ranked(bulwark, 1), "Bulwark health kept");
  assert.equal(other.baseHp, bulwark);
  promote(s, other);
  assert.equal(other.maxHp, ranked(bulwark, 2));
});

test("a Rank 2 squad from a save made before baseHp existed keeps Bulwark through its next promotion", () => {
  const s = make(ROADS), a = GARRISONS.armour;
  s.players[0].alloy = 5000;
  s.command({ team: 0, type: "armourBuy" });
  s.command({ team: 0, type: "armourUpgrade", squad: 1 });
  // An older save: the same state without baseHp on the tanks.
  const data = JSON.parse(s.serialize());
  for (const e of data.state.entities) delete e.baseHp;
  const old = Simulation.load(JSON.stringify(data)), [tank] = old.armourUnits(1);
  assert.ok(!("baseHp" in tank) && tank.squadRank === 2);
  old.command({ team: 0, type: "armourUpgrade", squad: 1, branch: "bulwark" });
  const bulwark = Math.round(D[tank.type].hp * a.hp * a.rank2.hp * a.branches.bulwark.hp);
  assert.equal(tank.baseHp, bulwark);
  promote(old, tank);
  assert.equal(tank.maxHp, ranked(bulwark, 1));
});

test("tougher wave units and carried squads keep their health factor through a promotion", () => {
  const level = { ...GORGE, id: "d-test", defence: { ...GORGE.defence, firstWave: 1, gap: 3, waves: [{ groups: [{ units: { vanguard: 1 }, route: "main", hp: 1.5 }], bonus: 10 }] } };
  const s = make(level);
  run(s, 2);
  // The level's own faction picks the type (an Ashfall Scrapper for the Vanguard slot).
  const foe = s.entities.find((e) => e.team === 1 && e.kind === "unit");
  const tough = Math.round(D[foe.type].hp * 1.5);
  assert.equal(foe.maxHp, tough);
  assert.equal(foe.baseHp, tough);
  promote(s, foe);
  assert.equal(foe.maxHp, ranked(tough, 1));
  // A carrier's passengers step out with the carrier's factor.
  const carrier = s.spawn("carrier", 1, 0, 0, true, true);
  Object.assign(carrier, { cargo: ["vanguard", "vanguard"], cargoHp: 0.8, unloadAt: s.time - 10 });
  s.dropCargo(carrier);
  const weak = Math.round(D.vanguard.hp * 0.8);
  for (const u of s.entities.filter((e) => e.team === 1 && e.type === "vanguard" && e.id > carrier.id)) {
    assert.equal(u.baseHp, weak);
    promote(s, u);
    assert.equal(u.maxHp, ranked(weak, 1));
  }
});

test("towers never take ranks: a kill leaves a tower's tier health alone", () => {
  const s = make(), t = branched(s, "antitank", "heavy"), hp = t.maxHp;
  assert.ok(hp > D.tower.hp);
  s.creditKill(t.id, { kind: "unit", pop: 20 });
  assert.equal(t.maxHp, hp);
  assert.ok(!t.rank && !("baseHp" in t));
});

test("a plain unit promotes exactly as before and carries no baseHp", () => {
  const s = new Simulation({ ai: false }), u = s.spawn("ranger", 0, 0, 30);
  u.hp = 50;
  for (let rank = 1; rank <= 3; rank++) {
    const before = u.maxHp, hp = u.hp;
    promote(s, u);
    assert.equal(u.maxHp, ranked(D.ranger.hp, rank));
    assert.equal(u.hp, Math.min(u.maxHp, hp + (u.maxHp - before) + u.maxHp * 0.25));
  }
  assert.ok(!("baseHp" in u));
  // Nothing in an ordinary match carries it; on a Defence level of plain waves only the commander does.
  const m = new Simulation({ ai: true, aiPlayer: true });
  run(m, 120);
  assert.ok(!m.entities.some((e) => "baseHp" in e));
  const plainWaves = { ...GORGE, id: "d-test", defence: { ...GORGE.defence, waves: GORGE.defence.waves.map((w) => ({ ...w, groups: w.groups.map(({ hp, ...rest }) => rest) })) } };
  const p = make(plainWaves);
  run(p, 90);
  assert.ok(p.entities.some((e) => e.team === 1 && e.kind === "unit"), "a wave on the road");
  assert.deepEqual(p.entities.filter((e) => "baseHp" in e).map((e) => e.id), [p.commander().id]);
});
