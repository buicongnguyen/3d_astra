// R3-H (AAA round 3): boss engine III (phases, ward, march in src/sim/bosses.js), the new boss
// `ironsovereign2` and the optional Act 3 mission "The Sovereign Walks" (src/story/sovereign-mission.js).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { BOSSES, warningSeconds, REACT, ESCAPE_SPEED, escapeDistance } from "../src/sim/bosses.js";
import { bossStatus, BOSS_STATES, SHIELDED_STATE } from "../src/boss-ui.js";
import { MISSIONS } from "../src/story/missions.js";
import { SCENES } from "../src/story/scenes.js";
import { isUnlocked } from "../src/campaign.js";
import { SOVEREIGN_WALKS as M } from "../src/story/sovereign-mission.js";

const SPEC = BOSSES["iron-sovereign-2"];
const tick = (s, seconds, seen = []) => { const end = s.time + seconds; while (s.time < end - 1e-9) { s.tick(0.05); seen.push(...s.events.map((e) => ({ ...e, at: s.time }))); s.events.length = 0; } return seen; };
// A field sandbox: the boss at (0, -10) on Classic, `relays` Ashfall relays tagged "ward" behind it, the
// player's camp as Classic has it (no AI).
export function sandbox({ relays = 3, difficulty = "standard" } = {}) {
  const mission = { id: "t-sov2", map: "classic", enemies: 1, rules: { ai: false, playerBase: true, enemyBase: true },
    setup: [
      ...[[-12, -20], [0, -26], [12, -20]].slice(0, relays).map(([x, z]) => ({ spawn: "relay", team: 1, at: { x, z }, tag: "ward", hp: 3000 })),
      { spawn: "ironsovereign2", team: 1, at: { x: 0, z: -10 }, tag: "boss", exact: true },
    ], objectives: [{ id: "boss", type: "destroyTag", tag: "boss" }], win: ["boss"] };
  const s = new Simulation({ map: "classic", enemyCount: 1, mission, difficulty });
  return { s, boss: s.tagged("boss")[0] };
}

test("ironsovereign2: its own unit and boss entry; the old Sovereign keeps none of engine III's data", () => {
  const d = D.ironsovereign2;
  assert.equal(d.boss, "iron-sovereign-2");
  assert.equal(d.name, D.ironsovereign.name);
  assert.ok(d.pop === 0 && !d.trains && d.hp > D.ironsovereign.hp);
  for (const key of ["phases", "ward", "march"]) {
    assert.ok(SPEC[key], key);
    for (const id of ["iron-vanguard", "iron-sovereign"]) assert.equal(BOSSES[id][key], undefined, `${id}.${key}`);
  }
  assert.deepEqual(SPEC.stages, [0.5]);
  assert.deepEqual(Object.keys(SPEC.phases), ["2"]);
  // Phase 2 keeps the owner's rules: warnings at least the walk out, no attack over 30% of a Ranger on
  // the hardest difficulty, one big attack every ~10-15 s, zones of one attack apart.
  for (const a of SPEC.phases[2].attacks) {
    assert.ok(["circle", "cone", "line"].includes(a.zone.shape));
    assert.ok(warningSeconds(a) >= REACT + escapeDistance(a.zone) / ESCAPE_SPEED - 1e-9, a.id);
    assert.ok(a.damage * a.rounds * Math.max(...Object.values(SPEC.damage)) <= (D.ranger.hp + D.ranger.shield) * 0.3 + 1e-9, a.id);
    assert.ok(a.count === undefined || (a.spread ?? 0) >= 2 * a.zone.radius + 0.5, a.id);
    for (const k of Object.values(SPEC.cadence)) {
      const cycle = SPEC.pause[1] * k + warningSeconds(a) + a.over + SPEC.exposed;
      assert.ok(cycle >= 9.5 && cycle <= 16, `${a.id}: ${cycle.toFixed(1)} s`);
    }
  }
  assert.ok(SPEC.phases[2].attacks.some((a) => a.zone.shape === "line"), "a new pattern: the rail sweep");
});

test("ward: each relay of its team counts; while one stands every hit is x0.15, and none once they fall", () => {
  const { s, boss } = sandbox();
  tick(s, 0.1);
  assert.equal(boss.bs.warded, 3);
  assert.ok(Math.abs(s.bossTaken(boss) - SPEC.taken.armored * SPEC.ward.taken) < 1e-9);
  assert.equal(bossStatus(s).state, SHIELDED_STATE);
  for (const r of s.tagged("ward")) r.hp = 0;
  tick(s, 0.2);
  assert.equal(boss.bs.warded, 0);
  assert.equal(s.bossTaken(boss), SPEC.taken.armored);
  assert.notEqual(bossStatus(s).state, SHIELDED_STATE);
});

test("march: it wakes at once and walks a road toward the player's core, stopping short of it", () => {
  const { s, boss } = sandbox({ relays: 0 });
  // Nobody of the player's within reach: clear the camp's units so nothing stops the walk.
  for (const e of s.own(0)) if (e.kind === "unit") e.hp = 0;
  const seen = tick(s, 0.1);
  assert.ok(seen.some((e) => e.type === "bossWake"), "wakes without being approached");
  assert.ok(boss.bs.road.length > 3);
  const core = s.own(0).find((e) => e.type === "hq"), d0 = Math.hypot(boss.x - core.x, boss.z - core.z);
  tick(s, 20);
  const d1 = Math.hypot(boss.x - core.x, boss.z - core.z);
  assert.ok(d1 < d0 - 8, `walked toward the core: ${d0.toFixed(1)} -> ${d1.toFixed(1)}`);
  const [x, z] = boss.bs.road.at(-1);
  assert.ok(Math.hypot(x - core.x, z - core.z) >= SPEC.march.stop - 1e-9, "the road ends short of the core");
});

test("phase 2: at half health it surges (cancels its attack, stands for 4 s), then uses the new attacks and drops 2 drones", () => {
  const { s, boss } = sandbox({ relays: 0 });
  // An enemy group to aim at, on Hold so the zones and attacks run as they would.
  for (let i = 0; i < 6; i++) { const u = s.spawn("ranger", 0, -3 + i * 1.2, 2); u.stance = "hold"; u.damage = 0; u.hp = u.maxHp = 1e6; }
  tick(s, 6);
  boss.hp = boss.maxHp * 0.49;
  const seen = tick(s, 0.1);
  assert.ok(seen.some((e) => e.type === "bossStage" && e.stage === 2));
  const surge = seen.find((e) => e.type === "bossSurge");
  assert.ok(surge && surge.seconds === SPEC.phases[2].surge);
  assert.equal(boss.bs.phase, "surge");
  assert.equal(bossStatus(s).state, BOSS_STATES.surge);
  assert.ok(!(s.dangerZones || []).some((z) => z.boss === boss.id), "the attack in hand is cancelled");
  assert.equal(seen.filter((e) => e.type === "bossDrop").reduce((n, e) => n + e.ids.length, 0), 2);
  tick(s, SPEC.phases[2].surge - 0.2);
  assert.equal(boss.bs.phase, "surge", "it stands for the whole surge");
  const later = tick(s, 25);
  const warns = later.filter((e) => e.type === "bossWarn").map((e) => e.attack);
  assert.ok(warns.length >= 2, `attacks after the surge: ${warns}`);
  assert.deepEqual(warns.slice(0, 2), SPEC.phases[2].attacks.map((a) => a.id), "the new pattern, from its first attack");
});

test("a save in the middle of the surge and of a warded fight loads and plays on in step", () => {
  const { s, boss } = sandbox({ relays: 2 });
  for (let i = 0; i < 4; i++) { const u = s.spawn("ranger", 0, -2 + i * 1.3, 2); u.stance = "hold"; }
  tick(s, 5);
  boss.hp = boss.maxHp * 0.49;
  tick(s, 1);
  assert.equal(boss.bs.phase, "surge");
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
  tick(s, 12); tick(copy, 12);
  assert.equal(copy.hash(), s.hash());
});

test("The Sovereign Walks: optional Act 3 after m11c, opens with Cut the Draw, Okoro briefs, relays then the boss", () => {
  const i = MISSIONS.indexOf(M);
  assert.equal(MISSIONS[i - 1].id, "m11c-hold-the-keystone-roads");
  assert.equal(MISSIONS[i + 1].id, "m12-frontiers-end");
  assert.deepEqual([M.id, M.act, M.optional, M.map], ["m11d-the-sovereign-walks", 3, true, "expanse"]);
  assert.ok(M.briefing.lines.every((l) => l.who === "okoro"), "Okoro speaks the briefing");
  assert.equal(isUnlocked({ cleared: { "m11-cut-the-draw": { time: 600, medal: "gold" } } }, i), true);
  assert.equal(isUnlocked({ cleared: {} }, i), false);
  assert.deepEqual(M.win, ["relays", "sovereign"]);
  assert.ok(M.objectives.find((o) => o.id === "sovereign").hidden && M.triggers.some((t) => t.when.objective === "relays" && t.do.some((a) => a.reveal === "sovereign")));
  assert.ok(M.triggers.some((t) => t.when.bossStage === 2 && t.do.some((a) => a.music === "battle")), "the music rises at phase 2");
  assert.ok(SCENES["sovereign-walks"], "its entrance scene is registered");
  assert.ok(!("look" in M) && !("intro" in M), "look and intro data stay in their own tables");
  // Gentle by rule: an AI that never attacks on its own and no time limit.
  assert.equal(M.rules.ai, "home");
  assert.ok(!M.lose.some((l) => l.type === "time"));
});
