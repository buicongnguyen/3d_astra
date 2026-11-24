// Creature round (sim/content/campaign-creatures.js): optional creature dens and the Vault Sentinel in the campaign.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS, resolveMission } from "../src/campaign.js";
import { DEFINITIONS as D } from "../src/data.js";
import { WILD_TEAM, NEUTRAL } from "../src/sim/constants.js";
import balance from "../src/balance.json" with { type: "json" };

const byId = (id) => MISSIONS.find((m) => m.id === id);
const start = (id, difficulty = "standard", def = byId(id)) => { const s = new Simulation({ map: def.map, enemyCount: def.enemies, difficulty, mission: resolveMission(def, null) }); s.tick(0.05); return s; };
const run = (s, seconds) => { for (let i = 0; i < seconds * 20 && !s.result; i++) { s.tick(0.05); if (s.mission.pending) s.decide(s.mission.pending.id, s.missionDef.decisions[s.mission.pending.id].options[0].id); } };
const fighters = (s) => s.own(0).filter((e) => e.kind === "unit" && e.damage > 0 && e.type !== "worker");
const DENS = [["m02-first-contact", "houndDen", "acidhound", 4, null], ["m04-three-way-dunes", "wyrmNest", "wyrmling", 3, "wyrm"], ["m09-a-debt-in-the-dunes", "elderNest", "wyrmling", 5, "wyrm"]];

test("each den stands on its mission's map with its guards on the wild side, far from the player's camp and every deposit", () => {
  for (const [id, den, guard, count] of DENS) {
    const s = start(id), d = s.mission.dens[den], core = s.own(0).find((e) => e.type === "hq");
    assert.equal(d.state, "guarded", id);
    assert.equal(d.guards.length, count, `${id}: ${count} guards`);
    for (const gid of d.guards) { const g = s.get(gid); assert.equal(g.type, guard); assert.equal(g.team, WILD_TEAM); assert.ok(gid >= 2e6, "guards take ids from the den range"); }
    assert.ok(Math.hypot(d.x - core.x, d.z - core.z) >= 25, `${id}: the den is away from the camp`);
    for (const r of s.resources) assert.ok(Math.hypot(r.x - d.x, r.z - d.z) >= d.aggro + 3, `${id}: no deposit inside the den's reach`);
    // Optional: never a win objective.
    const o = byId(id).objectives.find((x) => x.type === "den" && x.den === den);
    assert.ok(o?.optional && !byId(id).win.includes(o.id), `${id}: the den objective is optional`);
  }
});

test("a den left alone changes no other entity: the same ids, and the guards never leave it", () => {
  for (const [id, den] of DENS) {
    const def = byId(id), plain = { ...def, setup: def.setup.filter((s) => !s.den) };
    const a = start(id), b = start(id, "standard", plain);
    const ids = (s) => s.entities.filter((e) => e.id < 2e6).map((e) => `${e.id}:${e.type}`).join(",");
    assert.equal(ids(a), ids(b), `${id}: every other entity keeps its id`);
    const d = a.mission.dens[den], homes = d.guards.map((g) => ({ ...a.get(g).lair }));
    run(a, 30);
    d.guards.forEach((g, i) => { const e = a.get(g); if (e) assert.ok(Math.hypot(e.x - d.x, e.z - d.z) <= d.aggro + 3, `${id}: a guard stays by its den`); assert.ok(homes[i]); });
  }
});

test("clearing the Acid Hound den pays its salvage; hounds splash acid and bite vehicles harder", () => {
  const s = start("m02-first-contact"), d = s.mission.dens.houndDen, army = fighters(s);
  const alloy = s.players[0].alloy;
  army.forEach((e, i) => { e.x = d.x + 7 + (i % 3); e.z = d.z + Math.floor(i / 3); });
  s.updateVision();
  s.issue(army.map((e) => e.id), { type: "attackmove", x: d.x, z: d.z });
  let acid = false;
  for (let i = 0; i < 1200 && d.state === "guarded"; i++) { s.tick(0.05); acid ||= s.events.some((e) => e.type === "creature" && e.kind === "acid"); }
  assert.equal(d.state, "cleared");
  assert.ok(acid, "a bite splashes acid");
  run(s, 1);
  assert.ok(s.players[0].alloy >= alloy + 150 - 1, "the 150 alloy cache is paid");
  assert.equal(s.missionStatus().find((o) => o.id === "hounds").state, "done");
  assert.ok(D.acidhound.mechanical_bonus > 1 && D.acidhound.splash_radius > 0);
});

test("a cleared Wyrm nest held for 30 s tames a Wyrm for the player; the Elder nest an Elder Wyrm", () => {
  for (const [id, den, , , tame] of DENS.filter((d) => d[4])) {
    const s = start(id), d = s.mission.dens[den];
    for (const g of d.guards) s.get(g).hp = 0;
    run(s, 1);
    assert.equal(d.state, "open", id);
    const army = fighters(s);
    army.forEach((e, i) => { e.x = d.x + (i % 2); e.z = d.z + Math.floor(i / 2) * 0.8; e.orders = []; e.post = { x: e.x, z: e.z }; });
    run(s, balance.campaign_creatures.den.tame - 2);
    assert.equal(d.state, "open", `${id}: not before the taming time`);
    run(s, 4);
    assert.equal(d.state, "tamed", id);
    const w = s.own(0).find((e) => e.type === tame);
    assert.ok(w, `${id}: a ${tame} joins`);
    assert.equal(!!w.elder, !!d.elder);
    if (d.elder) assert.equal(w.maxHp, Math.round(D.wyrm.hp * balance.campaign_creatures.den.elder_hp));
  }
});

test("the Vault Sentinel sleeps on no side, wakes only when attacked, kneels at its share and joins the squad", () => {
  for (const [difficulty, share] of [["story", 40], ["standard", 40], ["veteran", 20]]) {
    const s = start("m08-the-quiet-vault", difficulty), g = s.tagged("sentinel")[0];
    assert.equal(g.team, NEUTRAL);
    const squad = fighters(s);
    squad.forEach((e, i) => { e.x = g.x + 5 + (i % 4); e.z = g.z + 5 + Math.floor(i / 4); e.orders = []; e.post = null; });
    for (const e of s.entities) if (e.team === 1 && e.kind === "unit") e.hp = 0;
    s.updateVision();
    run(s, 4);
    assert.equal(g.hp, g.maxHp, `${difficulty}: an idle squad never fights the sleeping guardian`);
    s.issue(squad.map((e) => e.id), { type: "attack", target: g.id });
    run(s, 1);
    assert.equal(g.team, WILD_TEAM, `${difficulty}: hurt, it wakes`);
    g.hp = Math.round(g.maxHp * (share - 1) / 100);
    run(s, 0.6);
    assert.equal(g.guardian.state, "kneel", difficulty);
    assert.equal(g.team, NEUTRAL, "nobody fights it on its knees");
    assert.ok(squad.every((e) => !e.orders.some((o) => o.target === g.id)), "attack orders on it are dropped");
    const hp = g.hp;
    run(s, balance.campaign_creatures.guardian.kneel_seconds + 0.6);
    assert.equal(g.team, 0, `${difficulty}: it joins`);
    assert.ok(g.hp >= hp && g.hp >= Math.round(g.maxHp * balance.campaign_creatures.guardian.join_hp) - 1);
    assert.equal(s.missionStatus().find((o) => o.id === "sentinel").state, "done");
    assert.ok(s.events.some((e) => e.type === "guardianJoin"));
  }
});

test("missions with creatures save and load mid-den and play on identically", () => {
  const s = start("m04-three-way-dunes");
  run(s, 20);
  const saved = s.serialize(), copy = Simulation.load(saved);
  run(s, 20); run(copy, 20);
  assert.equal(copy.hash(), s.hash());
});
