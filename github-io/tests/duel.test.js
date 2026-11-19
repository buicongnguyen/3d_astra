// The equal-cost duel harness (tests/lib/duel.mjs) that the round's unit gates use.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { duel, value, OFFSETS } from "./lib/duel.mjs";

// tests/balance.test.js's battle, as it is there: the harness at offset 0 must give the same numbers.
function balanceBattle(a, b, budget) {
  const s = new Simulation({ ai: false, map: "classic" });
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.tick(0.05);
  const army = (t, team, z) => Array.from({ length: Math.max(1, Math.round(budget / value(t))) }, (_, i) =>
    s.spawn(t, team, -30 + (i % 5) * 1.9, z + (team ? 1 : -1) * Math.floor(i / 5) * 1.9));
  const A = army(a, 0, -9), B = army(b, 1, 9);
  s.issue(A.map((u) => u.id), { type: "attackmove", x: -26, z: 14 });
  s.issue(B.map((u) => u.id), { type: "attackmove", x: -26, z: -14 });
  for (let t = 0; t < 150 && A.some((u) => u.hp > 0) && B.some((u) => u.hp > 0); t += 0.05) s.tick(0.05);
  const kept = (us) => us.reduce((n, u) => n + Math.max(0, u.hp + u.shield) / (u.maxHp + u.maxShield), 0) / us.length;
  return kept(A) - kept(B);
}

test("a duel is 10 battles: five offsets from both spawn sides, Rangers beat Breakers at equal cost", () => {
  const r = duel("ranger", "breaker", { watch: ({ a, b }) => [a.length, b.length] });
  assert.equal(r.battles.length, 10);
  assert.deepEqual(r.battles.map((b) => [b.offset, b.seat]), OFFSETS.flatMap((o) => [[o, 0], [o, 1]]));
  assert.ok(r.mean > 0, `Rangers should beat Breakers at equal cost (mean ${r.mean.toFixed(2)})`);
  assert.ok(r.wins >= 6, `Rangers won ${r.wins} of 10`);
  assert.equal(r.wins, r.battles.filter((b) => b.score > 0).length);
  assert.ok(Math.abs(r.mean - r.battles.reduce((n, b) => n + b.score, 0) / 10) < 1e-12);
  // Offset 0 is balance.test.js's own battle, from both sides.
  assert.equal(r.battles[0].score, balanceBattle("ranger", "breaker", 1000));
  assert.equal(r.battles[1].score, -balanceBattle("breaker", "ranger", 1000));
  // Each side spends the default budget of 1000: 7 Rangers (137.5 each) against 3 Breakers (287.5 each).
  for (const b of r.battles) assert.deepEqual(b.watch, [7, 3]);
});

test("mirrored sides: swapping the sides negates every battle, and a mirror match scores exactly 0", () => {
  const ab = duel("vanguard", "antitank", { offsets: [0, 8] }), ba = duel("antitank", "vanguard", { offsets: [0, 8] });
  for (let i = 0; i < ab.battles.length; i++) {
    const twin = ba.battles[i ^ 1]; // the same battle seen from the other side
    assert.equal(ab.battles[i].offset, twin.offset);
    assert.equal(ab.battles[i].score, -twin.score);
  }
  assert.ok(Math.abs(ab.mean + ba.mean) < 1e-12);
  assert.equal(ab.wins + ba.wins + ab.battles.filter((b) => b.score === 0).length, ab.battles.length);
  const mirror = duel("ranger", "ranger", { offsets: [4] });
  assert.equal(mirror.battles[0].score, -mirror.battles[1].score);
  assert.equal(mirror.mean, 0);
});

test("a mix of exact counts, the equal-cost budget it sets, factions that follow their side, and watch", () => {
  const healBall = [["ranger", 6], ["medic", 2]];
  const worth = 6 * value("ranger") + 2 * value("medic");
  const seen = [];
  const r = duel("vanguard", healBall, {
    offsets: [0], factions: ["ashfall", "meridian"],
    watch: ({ sim, a, b, deaths, seat }) => {
      seen.push({ seat, aTeam: a[0].team, aFaction: sim.factions[a[0].team], bFaction: sim.factions[b[0].team], a: a.length, b: b.map((u) => u.type).join(",") });
      // "The Medics died before 2 Rangers": the order units fell in.
      const medics = deaths.filter((d) => d.side === "b" && d.type === "medic"), rangers = deaths.filter((d) => d.side === "b" && d.type === "ranger");
      return { medicsFirst: medics.length === 2 && (rangers.length < 2 || medics[1].at <= rangers[1].at), sorted: deaths.every((d, i) => !i || deaths[i - 1].at <= d.at) };
    },
  });
  assert.equal(r.battles.length, 2);
  assert.deepEqual(seen.map((x) => [x.seat, x.aTeam, x.aFaction, x.bFaction]), [[0, 0, "ashfall", "meridian"], [1, 1, "ashfall", "meridian"]]);
  for (const x of seen) {
    assert.equal(x.a, Math.round(worth / value("vanguard")), "the single type is sized to the mix's value");
    assert.equal(x.b, "ranger,ranger,ranger,ranger,ranger,ranger,medic,medic");
  }
  for (const b of r.battles) {
    assert.equal(typeof b.watch.medicsFirst, "boolean");
    assert.equal(b.watch.sorted, true);
    assert.ok(b.seconds > 0 && b.seconds <= 150);
    assert.ok(b.kept.a >= 0 && b.kept.a <= 1 && b.kept.b >= 0 && b.kept.b <= 1);
    assert.equal(b.score, b.kept.a - b.kept.b);
    for (const d of b.deaths) assert.ok(D[d.type] && (d.side === "a" || d.side === "b"));
  }
  assert.throws(() => duel("no-such-unit", "ranger"), /unknown unit type/);
});
