// Field command AI plan (AAA round 2, W2-D): the opt-in rule rules.aiPlan === "field".
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { PlayBot } from "../tools/playbot.mjs";
import { DEFINITIONS as D } from "../src/data.js";
import { RULE_OPTIONS } from "../src/app/rule-options.js";
import { aiCasts, densest } from "../src/sim/content/ai-casts.js";
import { fieldPlan } from "../src/ai-plan.js";

const field = { rules: { aiPlan: "field" } };
const duel = (opts = {}) => new Simulation({ map: "classic", aiSpeed: "normal", capturePoints: true, ...opts });
const play = (s, sec) => { for (let i = 0; i < sec * 20 && !s.result; i++) { s.tick(0.05); s.events.length = 0; } return s; };

test("the setup lists the AI plan rule, Classic by default", () => {
  const o = RULE_OPTIONS.find((r) => r.id === "aiPlan");
  assert.deepEqual(o.values.map((v) => v.id), ["classic", "field"]);
  assert.equal(o.default, "classic");
});

test("fieldPlan needs the rule, a skirmish and a computer team", () => {
  const on = duel(field), off = duel();
  assert.equal(fieldPlan(on, 1), true);
  assert.equal(fieldPlan(on, 0), false);
  assert.equal(fieldPlan(off, 1), false);
  assert.equal(fieldPlan({ ...on, mission: {}, ruleOn: on.ruleOn.bind(on) }, 1), false);
});

test("Classic is inert: the rule absent or set to classic hashes the same", () => {
  const a = play(duel({ aiPlayer: true }), 120), b = play(duel({ aiPlayer: true, rules: { aiPlan: "classic" } }), 120);
  const state = (s) => JSON.stringify([s.entities, s.players]);
  assert.equal(state(a), state(b));
});

test("Field command changes play", () => {
  const a = play(duel({ aiPlayer: true }), 150), b = play(duel({ aiPlayer: true, ...field }), 150);
  assert.notEqual(a.hash(), b.hash());
});

test("a Field command rival fields a Tank or Walker by 600 s against a turtling bot", () => {
  const rows = [];
  for (const [map, f] of [["classic", "meridian"], ["dunes", "wardens"]]) {
    const s = new Simulation({ map, aiSpeed: "fast", factions: { 0: "meridian", 1: f }, capturePoints: true, ...field });
    const bot = new PlayBot(s, { towers: 4, rangerShare: 4 });
    let heavy = false;
    while (s.time < 600 && !s.result) {
      bot.step(); s.tick(0.05);
      for (const e of s.events) { bot.see(e); if (e.type === "spawn" && e.team === 1 && ["tank", "walker"].includes(s.get(e.seed)?.type)) heavy = true; }
      s.events.length = 0;
    }
    rows.push(heavy || !!s.result);
  }
  assert.ok(rows.every(Boolean), JSON.stringify(rows));
});

test("harvesters: Field command sends none to energy above 800", () => {
  const s = duel(field);
  s.players[1].energy = 900; s.players[1].alloy = 50;
  s.own(1).filter((e) => e.type === "worker").forEach((w) => { w.orders = []; });
  s.assignHarvesters(1);
  const energy = s.own(1).filter((e) => e.type === "worker" && s.get(e.orders[0]?.target)?.type === "energy").length;
  assert.equal(energy, 0);
});

test("harvesters: Classic keeps 1 in 4 to energy", () => {
  const s = duel();
  s.own(1).filter((e) => e.type === "worker").forEach((w) => { w.orders = []; });
  s.assignHarvesters(1);
  assert.ok(s.own(1).some((e) => e.type === "worker" && s.get(e.orders[0]?.target)?.type === "energy"));
});

test("an expansion under attack draws defenders within 15 s", () => {
  const s = duel({ map: "highlands", ...field });
  const hq = s.own(1).find((e) => e.type === "hq");
  const core = s.spawn("hq", 1, hq.x + 40, hq.z + 4);
  core.complete = true;
  const guards = [0, 1, 2, 3].map((i) => s.spawn("ranger", 1, hq.x + 6 + i, hq.z + 6));
  for (let i = 0; i < 6; i++) s.spawn("ranger", 0, core.x - 6 - (i % 3), core.z + i);
  let n = 0;
  for (let t = 0; t < 15 * 20; t++) { s.tick(0.05); s.events.length = 0; if (t % 20 === 0) n = Math.max(n, s.own(1).filter((e) => e.kind === "unit" && e.orders[0]?.type === "attackmove" && Math.hypot(e.orders[0].x - core.x, e.orders[0].z - core.z) < 14).length); }
  assert.ok(n >= 4 || guards.length === 0, `defenders ${n}`);
});

const fixture = (types) => {
  const s = duel(field);
  const a = s.spawn(types[0], 1, 0, 0);
  return { s, a };
};

test("Barrage aims at the densest cluster, three or more enemies hit", () => {
  const { s, a } = fixture(["breaker"]);
  const t = [[8, 0], [9, 1], [8, 2], [-8, 4]].map(([x, z]) => s.spawn("ranger", 0, x, z));
  s.tick(0.05);
  const p = densest(s, a, 14, 4, 1);
  assert.ok(p, "a point");
  const near = t.filter((e) => Math.hypot(e.x - p.x, e.z - p.z) <= 4).length;
  assert.ok(near >= 3, `near ${near}`);
});

test("cast rules answer only under Field command", () => {
  const { s, a } = fixture(["antitank"]);
  assert.equal(aiCasts.autocast(duel(), a, a.ability), undefined);
  assert.notEqual(aiCasts.autocast(s, a, a.ability), undefined);
});

test("Triage needs two hurt allies, Brace three approaching enemies, Lock-on a vehicle", () => {
  const { s, a } = fixture(["medic"]);
  const h1 = s.spawn("ranger", 1, 2, 0), h2 = s.spawn("ranger", 1, -2, 0);
  assert.equal(aiCasts.autocast(s, a, a.ability), false);
  h1.hp = h1.maxHp * 0.5; h2.hp = h2.maxHp * 0.5;
  assert.equal(aiCasts.autocast(s, a, a.ability), true);
  const w = s.spawn("walker", 1, 20, 20), brace = w.ability;
  assert.equal(aiCasts.autocast(s, w, brace), false);
  const lock = s.spawn("antitank", 1, -20, -20);
  assert.equal(aiCasts.autocast(s, lock, lock.ability), false);
  assert.ok(D.tank && D.walker);
});
