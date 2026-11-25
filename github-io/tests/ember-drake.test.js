// The Ember Drake (W9, boss engine IV: src/sim/boss-flight.js, docs/aaa/BOSSES.md): a flying boss. It sleeps on
// its perch, flies when woken (only units that hit air reach it), marks each fire breath before it lands, lands on
// its perch after every second attack behind a wing-gust warning that pushes units out, and on the perch every
// unit can hit it at the open-core rate. Phases wait until it is airborne. Save and load in the air and on the
// perch play on in step. The mission (src/story/ember-mission.js) carries the boss, its scene and its lines.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { BOSSES, warningSeconds, inZone, REACT, ESCAPE_SPEED, escapeDistance } from "../src/sim/bosses.js";
import { flyingBosses } from "../src/sim/boss-flight.js";
import { bossStatus } from "../src/boss-ui.js";
import { MISSIONS } from "../src/story/missions.js";
import { SCENES } from "../src/story/scenes.js";
import { EMBER_ROOST } from "../src/story/ember-mission.js";

const SPEC = BOSSES["ember-drake"], F = SPEC.flight;
const field = (difficulty = "standard") => {
  const mission = { id: "t-drake", map: "classic", enemies: 1, rules: { ai: false, playerBase: true, enemyBase: true },
    setup: [{ spawn: "emberdrake", team: 1, at: { x: 0, z: -10 }, tag: "boss", exact: true }], objectives: [{ id: "boss", type: "destroyTag", tag: "boss" }], win: ["boss"] };
  const s = new Simulation({ map: "classic", enemyCount: 1, mission, difficulty });
  return { s, boss: s.tagged("boss")[0] };
};
const until = (s, cond, cap = 60, seen = []) => { for (let i = 0; i < cap * 20 && !cond(); i++) { s.tick(0.05); seen.push(...s.events.map((e) => ({ ...e, at: s.time }))); s.events.length = 0; } assert.ok(cond(), "condition reached"); return seen; };
const squad = (s, type, n, stance = "guard", at = { x: 0, z: 2 }) => {
  const units = [];
  for (let i = 0; i < n; i++) units.push(s.spawn(type, 0, at.x - 1.2 + (i % 3) * 1.2, at.z + Math.floor(i / 3) * 1.2));
  for (const u of units) { u.damage = 0; u.stance = stance; }
  return units;
};

test("data: the drake is the one flying boss; every attack (gust and phase attacks too) keeps the owner's rules", () => {
  assert.deepEqual(flyingBosses(), ["ember-drake"]);
  assert.equal(D.emberdrake.boss, "ember-drake");
  assert.ok(!D.emberdrake.flying, "the definition is a ground unit: the cycle lifts it (so its model loads with the match)");
  const worstOf = (a) => a.damage * a.rounds * Math.max(...Object.values(SPEC.damage));
  const all = [...SPEC.attacks, ...Object.values(SPEC.phases).flatMap((p) => p.attacks), F.land];
  for (const a of all) {
    assert.ok(warningSeconds(a) >= REACT + escapeDistance(a.zone) / ESCAPE_SPEED - 1e-9, `${a.id}: warning`);
    assert.ok(worstOf(a) <= (D.ranger.hp + D.ranger.shield) * 0.3 + 1e-9, `${a.id}: ${worstOf(a)}`);
  }
  assert.ok(warningSeconds(SPEC.attacks[0]) >= 1.5, "the fire breath is marked at least 1.5 s ahead");
  for (const [k, p] of Object.entries(SPEC.phases)) for (const a of p.attacks) for (const stage of [+k, 3]) for (const c of Object.values(SPEC.cadence)) {
    const cycle = SPEC.pause[stage - 1] * c + warningSeconds(a) + a.over + SPEC.exposed;
    assert.ok(cycle >= 9.5 && cycle <= 16, `${a.id} stage ${stage}: ${cycle.toFixed(1)} s`);
  }
  assert.ok(F.perch >= 6 && F.every >= 1 && F.land.knock > 0, "a real window on the perch, and the gust pushes");
});

test("the cycle: asleep on the ground, then in the air; breath marked first; it lands after every second breath", () => {
  const { s, boss } = field();
  s.tick(0.05);
  assert.equal(boss.bs.phase, "dormant");
  assert.ok(!boss.flying, "asleep on its perch");
  squad(s, "ranger", 6, "hold");
  const seen = until(s, () => boss.bs.phase === "perched", 60);
  assert.ok(boss.flying === false);
  const kinds = seen.filter((e) => e.type.startsWith("boss") && e.type !== "bossArmored").map((e) => e.type + (e.attack ? `:${e.attack}` : ""));
  assert.deepEqual(kinds.slice(0, 12), ["bossTakeoff", "bossWake", "bossWarn:fire-breath", "bossAttack:fire-breath", "bossExposed", "bossWarn:fire-breath", "bossAttack:fire-breath", "bossExposed", "bossLanding", "bossWarn:wing-gust", "bossAttack:wing-gust", "bossGust"]);
  const warn = seen.find((e) => e.type === "bossWarn"), attack = seen.find((e) => e.type === "bossAttack");
  assert.ok(Math.abs(attack.at - warn.at - warningSeconds(SPEC.attacks[0])) < 0.051, "the breath waits for its whole warning");
  assert.equal(warn.zone.shape, "line");
  const gust = seen.find((e) => e.type === "bossWarn" && e.attack === "wing-gust");
  assert.deepEqual([gust.zone.x, gust.zone.z], [0, -10], "the gust is marked round the perch");
  assert.ok(Math.abs(seen.find((e) => e.type === "bossAttack" && e.attack === "wing-gust").at - gust.at - warningSeconds(F.land)) < 0.051);
  assert.deepEqual([boss.x, boss.z], [0, -10], "it lands on its perch");
  // On the perch for `perch` seconds, then up again.
  const at = s.time;
  until(s, () => boss.bs.phase === "tracking", F.perch + 1);
  assert.ok(Math.abs(s.time - at - F.perch) < 0.051 && boss.flying === true);
});

test("in the air only units that hit air reach it; on the perch everyone does, at the open-core rate", () => {
  const { s, boss } = field();
  const tank = s.spawn("vanguard", 0, 0, -2), ranger = s.spawn("ranger", 0, 1, -2);
  until(s, () => boss.flying === true, 5);
  assert.equal(s.canHit(tank, boss), false, "a Vanguard cannot hit it flying");
  assert.equal(s.canHit(ranger, boss), true, "a Ranger can");
  assert.equal(s.bossTaken(boss), SPEC.taken.armored);
  until(s, () => boss.bs.phase === "perched", 60);
  assert.equal(s.canHit(tank, boss), true, "on the perch a Vanguard can");
  assert.equal(s.bossTaken(boss), SPEC.taken.exposed);
  const st = bossStatus(s);
  assert.equal(st.state, "LANDED");
});

test("the wing gust: units on Hold in the circle are hit and pushed out; Guard units step out in time", () => {
  const { s, boss } = field();
  boss.damage = 0;
  s.applyDamage(boss, 1, 0, null); // wake it from afar: hurt it
  until(s, () => boss.flying === true, 1);
  // Straight to the landing.
  boss.bs.breaths = F.every - 1;
  boss.bs.phase = "exposed"; boss.bs.until = s.time;
  until(s, () => boss.bs.phase === "warning" && boss.bs.landing, 20);
  const holders = squad(s, "ranger", 3, "hold", { x: 1.5, z: -8.5 }), guards = squad(s, "ranger", 3, "guard", { x: -1.5, z: -12 });
  const before = holders.map((u) => Math.hypot(u.x, u.z + 10));
  const seen = until(s, () => boss.bs.phase === "perched", 6);
  const gust = seen.find((e) => e.type === "bossGust");
  assert.ok(gust.ids.length >= holders.length - 1, "the holders were pushed");
  holders.forEach((u, i) => assert.ok(Math.hypot(u.x, u.z + 10) >= before[i] + 1, `pushed out ${before[i].toFixed(1)} -> ${Math.hypot(u.x, u.z + 10).toFixed(1)}`));
  assert.ok(holders.every((u) => u.hp + u.shield < D.ranger.hp + D.ranger.shield), "and hit");
  assert.ok(guards.every((u) => u.hp + u.shield === D.ranger.hp + D.ranger.shield), "Guard units stepped out of the circle");
});

test("restless: it wakes on its own after `restless` seconds, and stays over its perch with nothing in reach", () => {
  const { s, boss } = field();
  until(s, () => boss.bs?.phase === "tracking", F.restless + 1);
  assert.ok(Math.abs(s.time - F.restless) < 0.11);
  for (let i = 0; i < 200; i++) s.tick(0.05);
  assert.ok(Math.hypot(boss.x, boss.z + 10) <= 3.01, "home over the perch");
});

test("phases wait for the air: a stage reached on the perch surges at take-off", () => {
  const { s, boss } = field();
  squad(s, "ranger", 3, "hold", { x: 7, z: 0 });
  until(s, () => boss.bs?.phase === "perched", 60);
  boss.hp = boss.maxHp * 0.6;
  const seen = until(s, () => boss.bs.phase === "surge", F.perch + 1);
  assert.ok(seen.some((e) => e.type === "bossStage" && e.stage === 2));
  assert.equal(boss.flying, true);
  assert.equal(boss.bs.set, 2);
  until(s, () => boss.bs.phase === "tracking", 5);
});

test("save and load in the air, mid-breath and on the perch: the same match, tick for tick", () => {
  for (const phase of ["warning", "perched"]) {
    const { s, boss } = field();
    squad(s, "ranger", 6, "hold");
    until(s, () => boss.bs?.phase === phase, 60);
    const copy = Simulation.load(s.serialize());
    assert.equal(copy.hash(), s.hash(), `${phase}: same state`);
    for (let i = 0; i < 240; i++) { s.tick(0.05); copy.tick(0.05); }
    assert.equal(copy.hash(), s.hash(), `${phase}: still in step 12 s later`);
  }
});

test("The Ember Roost: an optional Act 3 mission after Crown Hill with the drake, its scene and stage lines", () => {
  const m = MISSIONS.find((x) => x.id === "m10e-the-ember-roost");
  assert.equal(m, EMBER_ROOST);
  assert.ok(m.optional && m.act === 3 && m.map === "highlands");
  const ids = MISSIONS.map((x) => x.id);
  assert.equal(ids.indexOf(m.id), ids.indexOf("m10b-crown-hill") + 1);
  const triggers = JSON.stringify(m.triggers);
  assert.match(triggers, /"spawn":"emberdrake"/);
  assert.ok(SCENES["ember-drake"]?.beats.some((b) => b.title?.text === "Ember Drake"));
  for (const stage of [2, 3]) assert.ok(m.triggers.some((t) => t.when.bossStage === stage), `stage ${stage} line`);
  assert.ok(m.triggers.some((t) => t.when.tagDead === "drake"));
});
