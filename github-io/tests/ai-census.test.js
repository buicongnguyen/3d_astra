// Field command army census (AAA round 3, R3-A): sim/ai-census.js, the workshop floor, the S7 stall breaker,
// Kite scouting and the field economy. The long matrix (5 factions at 600 s, Highlands 5 pairings) is
// tools/ai-census-check.mjs (CI matrix entry r3-a).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { censusRole, MIX, ROLES } from "../src/sim/ai-census.js";
import { AI_SPEEDS, FIELD_PACE, fieldPace } from "../src/ai-plan.js";
import { censusRow } from "../tools/ai-census-check.mjs";

const field = (opts = {}) => new Simulation({ map: "classic", aiSpeed: "normal", capturePoints: true, rules: { aiPlan: "field", roster: "expanded" }, ...opts });

test("census: Field Expanded Ashfall on Dunes fields 4+ unit types and a workshop unit by 300 s", () => {
  const r = censusRow("ashfall", { secs: 300, map: "dunes", speed: "normal" });
  assert.ok(r.types >= 4, `types ${r.types} ${JSON.stringify(r.fielded)}`);
  assert.ok(r.workshop >= 1, `workshop ${r.workshop} ${JSON.stringify(r.fielded)}`);
});

test("census roles: every unit maps to one role; Harvesters, the Kite and bosses' research are left out", () => {
  const expect = { vanguard: "front", scrapper: "front", shade: "front", ranger: "ranged", rider: "ranged", drone: "ranged",
    breaker: "heavy", scorcher: "heavy", tank: "heavy", walker: "heavy", antitank: "antiarmor", watcher: "antiarmor",
    medic: "support", engineer: "support", wagon: "support", gunner: "workshop", stalker: "workshop", rampart: "workshop",
    hawk: "air", glider: "air", balloon: "air", kite: null, worker: null, upgrade: null, barracks: null };
  for (const [type, role] of Object.entries(expect)) assert.equal(censusRole(type), role, type);
  for (const type of Object.keys(D)) { const r = censusRole(type); assert.ok(r === null || ROLES.includes(r), type); }
});

test("ai_mix: every faction's shares are known roles, sum to at most 1, and the counter keys are numbers", () => {
  for (const f of ["default", "meridian", "ashfall", "sunward", "wardens", "veil"]) {
    const mix = { ...MIX.default, ...MIX[f] };
    for (const k of Object.keys(mix)) assert.ok(ROLES.includes(k), `${f}.${k}`);
    const sum = Object.values(mix).reduce((a, b) => a + b, 0);
    assert.ok(sum > 0.9 && sum <= 1 + 1e-9, `${f} ${sum}`);
  }
  assert.equal(MIX.wardens.support, 0, "the Wardens train no Medics or Engineers");
  for (const v of Object.values(MIX.counter)) assert.equal(typeof v, "number");
  assert.ok(MIX.stall.after >= 200 && MIX.stall.after <= 300, "about four minutes");
});

test("the Barracks trains toward the biggest shortfall; flyers seen draw anti-air; vehicles seen raise anti-armour", () => {
  const s = field();
  const b = s.own(1).find((e) => e.type === "barracks");
  b.level = 2;
  const census = (counts, extra = {}) => ({ counts: { front: 0, ranged: 0, heavy: 0, antiarmor: 0, support: 0, workshop: 0, air: 0, ...counts }, antiAir: 0, total: Object.values(counts).reduce((a, n) => a + n, 0), target: { ...MIX.default }, airFloor: 0, ...extra });
  // Ranged short: a Ranger even when the earlier pick was a Vanguard.
  assert.equal(s.aiCensusPick(1, b, census({ front: 4, ranged: 1, support: 1, antiarmor: 1 }), "vanguard"), "ranger");
  // Support short: a Medic.
  assert.equal(s.aiCensusPick(1, b, census({ front: 3, ranged: 4, antiarmor: 1 }), "ranger"), "medic");
  // Nothing short at this building: the earlier pick stands.
  assert.equal(s.aiCensusPick(1, b, census({ front: 2, ranged: 3, antiarmor: 2, support: 2 }), "vanguard"), "vanguard");
  // Flyers seen (floor 6) and 2 anti-air: units that hit air first.
  assert.equal(s.aiCensusPick(1, b, census({ front: 1, ranged: 2 }, { antiAir: 2, airFloor: 6 }), "vanguard"), "ranger");
  // The enemy census: 4 vehicles seen out of 5 raise the anti-armour share.
  for (let i = 0; i < 5; i++) s.intel[1].set(9000 + i, i < 4 ? "tank" : "ranger");
  const c = s.aiCensusOf(1, s.own(1), []);
  assert.equal(c.target.antiarmor, MIX.counter.antiarmor_vs_mech);
  // A Wardens Barracks never asks for the Medic it cannot train.
  const w = field({ factions: { 0: "meridian", 1: "wardens" } }), wb = w.own(1).find((e) => e.type === "barracks");
  wb.level = 2;
  assert.ok(!w.aiCensusOptions(1, wb).some((o) => o.role === "support"));
});

test("Classic, Expanded alone and missions never consult the census", () => {
  const calls = { n: 0 }, proto = Simulation.prototype, orig = proto.aiCensusOf;
  proto.aiCensusOf = function (...a) { calls.n++; return orig.apply(this, a); };
  try {
    for (const rules of [null, { roster: "expanded" }, { aiPlan: "classic" }]) {
      const s = new Simulation({ map: "classic", aiSpeed: "normal", capturePoints: true, aiPlayer: true, ...(rules ? { rules } : {}) });
      for (let i = 0; i < 60 * 20; i++) { s.tick(0.05); s.events.length = 0; }
    }
    assert.equal(calls.n, 0);
    const s = field();
    for (let i = 0; i < 10 * 20; i++) { s.tick(0.05); s.events.length = 0; }
    assert.ok(calls.n > 0, "Field command does");
  } finally { proto.aiCensusOf = orig; }
  // The field economy applies only to the Field plan's speeds and leaves Relaxed alone.
  assert.equal(fieldPace("relaxed", AI_SPEEDS.relaxed), AI_SPEEDS.relaxed);
  const p = fieldPace("normal", { ...AI_SPEEDS.normal, ...AI_SPEEDS.normal.skirmish });
  assert.equal(p.workers, AI_SPEEDS.normal.workers + FIELD_PACE.normal.add.workers);
  assert.deepEqual(p.techAt, AI_SPEEDS.normal.techAt.map((n) => n * FIELD_PACE.normal.scale.techAt));
});

test("S7: after four minutes without contact the free army attack-moves on the nearest enemy building seen", () => {
  const s = field({ ai: false });
  s.time = MIX.stall.from + 1;
  const hq = s.own(1).find((e) => e.type === "hq");
  const units = Array.from({ length: MIX.stall.min_units }, (_, i) => s.spawn("ranger", 1, hq.x - 8 + (i % 4), hq.z + 6 + Math.floor(i / 4)));
  const relay = s.spawn("relay", 0, -10, 10);
  relay.complete = true;
  s.intel[1].set(relay.id, "relay");
  for (const e of s.own(1)) { delete e.hitAt; delete e.shotAt; }
  // Contact a minute ago: no stall.
  units[0].shotAt = s.time - 60;
  assert.equal(s.aiBreakStall(1, s.own(1), hq, units), false);
  units[0].shotAt = s.time - MIX.stall.after - 1;
  assert.equal(s.aiBreakStall(1, s.own(1), hq, units), true);
  // (issue() spreads a group's destinations around the point.)
  for (const u of units) assert.ok(u.orders[0].type === "attackmove" && u.orders[0].aiw && Math.hypot(u.orders[0].x - relay.x, u.orders[0].z - relay.z) < 5, JSON.stringify(u.orders[0]));
  // Too early in the match: never.
  const t = field({ ai: false });
  t.time = MIX.stall.from - 1;
  assert.equal(t.aiBreakStall(1, t.own(1), t.own(1).find((e) => e.type === "hq"), units), false);
});

test("scouting: an idle Kite flies the search pattern; an armed or busy flyer is left alone", () => {
  const s = field({ ai: false });
  const hq = s.own(1).find((e) => e.type === "hq");
  const kite = s.spawn("kite", 1, hq.x, hq.z + 8), hawk = s.spawn("hawk", 1, hq.x + 3, hq.z + 8);
  s.aiScout(1, [kite, hawk]);
  assert.equal(kite.orders[0]?.type, "move");
  assert.equal(hawk.orders.length, 0);
  const first = { x: kite.orders[0].x, z: kite.orders[0].z };
  s.aiScout(1, [kite]);
  assert.deepEqual({ x: kite.orders[0].x, z: kite.orders[0].z }, first, "a Kite on its way keeps its point");
});

test("Expanded: under Field command a host keeps one workshop unit even when no want entry asks for it", () => {
  const run = (rules) => {
    const s = new Simulation({ map: "classic", aiSpeed: "normal", factions: { 0: "meridian", 1: "veil" }, capturePoints: true, rules });
    const hq = s.own(1).find((e) => e.type === "hq");
    hq.level = 2;
    const relay = s.spawn("veilrelay", 1, hq.x + 12, hq.z - 2);
    relay.complete = true; relay.level = 2;
    s.players[1].alloy = 5000; s.players[1].energy = 5000;
    s.time = 300;
    s.contentAi(1, { own: s.own(1), army: [], workers: s.own(1).filter((e) => e.type === "worker"), hq, pace: { ...s.pace, upgradeAt: 1e9 }, afford: (c) => s.canPay(1, c), role: "balanced" });
    return relay.queue.map((q) => q.type);
  };
  assert.deepEqual(run({ roster: "expanded", aiPlan: "field" }), ["stalker"]);
  assert.deepEqual(run({ roster: "expanded" }), [], "Classic AI: the Stalker's own want list (nothing before 600 s)");
});

test("a free fighter near a visible enemy fighter joins the fight; one in an attack or retreating does not", () => {
  const s = field({ ai: false });
  const a = s.spawn("ranger", 1, 0, 0), b = s.spawn("ranger", 1, 2, 0), c = s.spawn("ranger", 1, 4, 0), far = s.spawn("ranger", 1, -40, -40);
  b.orders = [{ type: "attackmove", x: 30, z: 30, aiw: 1 }];
  c.retreating = true;
  const foe = s.spawn("vanguard", 0, 10, 0);
  s.updateVision();
  assert.ok(s.isVisible(foe, 1));
  s.aiJoinFight(1, [a, b, c, far]);
  assert.equal(a.orders[0]?.type, "attackmove");
  assert.equal(Math.round(a.orders[0].x), Math.round(foe.x));
  assert.equal(b.orders[0].aiw, 1);
  assert.equal(c.orders.length, 0);
  assert.equal(far.orders.length, 0);
});
