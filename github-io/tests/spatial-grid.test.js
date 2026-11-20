// The per-tick spatial grid (src/sim/grid.js, CW-C) must return exactly what the all-pairs scans it replaced
// returned, in the same order: target choice (enemy, preferredEnemy, defenseTarget), splash and separation.
// Every check runs the same fixture with the grid forced on (minimum 0) and forced off (minimum infinite, the
// plain scan), over seeded random scenes, and compares the answers entity for entity.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS } from "../src/data.js";
import { setGridMinimum, near, IDS } from "../src/sim/grid.js";

const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const UNITS = Object.keys(DEFINITIONS).filter((k) => DEFINITIONS[k].kind === "unit" && DEFINITIONS[k].damage > 0);
const BUILDS = ["hq", "barracks", "tower", "foundry", "relay"].filter((k) => DEFINITIONS[k]);
const WORKERS = Object.keys(DEFINITIONS).filter((k) => DEFINITIONS[k].type === "worker" || k === "worker");

// A random crowd on a map: units of every team (some dead, some flying, some with a target preference), buildings,
// a fog that shows a random share of cells. The same seed gives the same scene.
function scene(seed, { count = 90, map = "classic" } = {}) {
  const r = rng(seed), sim = new Simulation({ ai: false, map, enemyCount: 2 }), half = sim.terrain.half - 4;
  const at = () => (r() * 2 - 1) * half;
  for (let i = 0; i < count; i++) {
    const team = Math.floor(r() * 3), pool = r() < 0.2 ? BUILDS : r() < 0.1 && WORKERS.length ? WORKERS : UNITS;
    const type = pool[Math.floor(r() * pool.length)];
    const e = sim.spawn(type, team, at(), at(), true);
    if (r() < 0.12) e.hp = 0;
    if (r() < 0.1 && e.kind === "unit") { e.flying = true; e.fly = 3; e.hits_air = r() < 0.5; }
    if (r() < 0.2 && e.kind === "unit") e.prefers = r() < 0.5 ? ["support", "ranged"] : ["armor", "antiarmor", "melee"];
    if (r() < 0.08 && e.kind === "unit") e.radius = 0.5 + r() * 2.5;
    if (r() < 0.1 && e.kind === "unit") e.splash_radius = 2 + r() * 4, e.splash_damage = 0.5;
  }
  sim.nav.rebuild(sim.entities);
  for (const team of sim.visible.keys()) for (let i = 0; i < sim.visible[team].length; i++) sim.visible[team][i] = r() < 0.7 ? 1 : 0;
  // Positions were set directly, not by a tick: a new tick number tells the grid to file them afresh.
  sim.ticks++;
  sim.time += 0.05;
  return sim;
}
const ids = (t) => (t ? t.id : null);
// preferredEnemy needs a preference list; give one for the call, then put the unit back as it was.
const withPrefers = (e, fn) => { const had = e.prefers; e.prefers ??= ["support", "ranged"]; try { return fn(); } finally { e.prefers = had; if (had === undefined) delete e.prefers; } };
const both = (sim, fn) => {
  const out = {};
  for (const [name, min] of [["grid", 0], ["scan", Infinity]]) {
    const old = setGridMinimum(min);
    try { out[name] = fn(); } finally { setGridMinimum(old); }
  }
  return out;
};

test("the grid picks the same target as the all-pairs scan on 1,000 seeded fixtures (enemy, preferredEnemy, defenseTarget)", () => {
  let checks = 0, found = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const sim = scene(seed, { count: 60 + (seed % 5) * 20, map: seed % 3 ? "classic" : "riverlands" }), r = rng(seed * 7);
    const live = sim.entities.filter((e) => e.hp > 0);
    for (let k = 0; k < 4; k++) {
      const e = live[Math.floor(r() * live.length)], radius = 2 + r() * 30, clear = r() < 0.5;
      const run = () => ({
        enemy: ids(sim.enemy(e, radius, clear)),
        preferred: ids(withPrefers(e, () => sim.preferredEnemy(e, radius, clear))),
        ...(e.kind === "building" || e.range ? { defence: ids(sim.defenseTarget(e)) } : null),
      });
      const { grid, scan } = both(sim, run);
      assert.deepEqual(grid, scan, `seed ${seed}, entity ${e.id} (${e.type}), radius ${radius.toFixed(2)}`);
      checks++;
      if (grid.enemy !== null) found++;
    }
  }
  assert.equal(checks, 4000);
  assert.ok(found > 400, `most fixtures should find a target (${found})`);
});

test("near() lists candidates in ascending entity order and never misses one in reach", () => {
  const old = setGridMinimum(0);
  try {
    for (let seed = 1; seed <= 60; seed++) {
      const sim = scene(seed, { count: 120 }), r = rng(seed);
      for (let k = 0; k < 20; k++) {
        const x = (r() * 2 - 1) * 44, z = (r() * 2 - 1) * 44, reach = 1 + r() * 20, n = near(sim, x, z, reach);
        if (n < 0) continue;
        const got = Array.from(IDS.subarray(0, n));
        assert.deepEqual(got, [...got].sort((a, b) => a - b), "ascending entity order");
        const want = sim.entities.map((e, i) => [e, i]).filter(([e]) => Math.hypot(e.x - x, e.z - z) <= reach + e.radius).map(([, i]) => i);
        for (const i of want) assert.ok(got.includes(i), `entity ${i} in reach is listed (seed ${seed})`);
      }
    }
  } finally { setGridMinimum(old); }
});

test("splash hits the same victims with the grid as with the scan", () => {
  for (let seed = 1; seed <= 120; seed++) {
    const key = (sim) => sim.entities.map((e) => `${e.id}:${e.hp.toFixed(6)}:${e.shield.toFixed(6)}`).join(",");
    const results = {};
    for (const [name, min] of [["grid", 0], ["scan", Infinity]]) {
      const sim = scene(seed, { count: 80 }), shooters = sim.entities.filter((e) => e.hp > 0 && e.splash_radius && e.kind === "unit");
      const old = setGridMinimum(min);
      try {
        for (const e of shooters) {
          const t = sim.entities.find((o) => o.hp > 0 && !o.flying && o.team !== e.team && sim.hostile(e.team, o.team));
          if (t) { e.cooldown = 0; sim.hit(e, t); }
        }
      } finally { setGridMinimum(old); }
      results[name] = key(sim);
    }
    assert.equal(results.grid, results.scan, `seed ${seed}`);
  }
});

test("separation with the grid moves every unit exactly as the all-pairs loop does", () => {
  for (let seed = 1; seed <= 100; seed++) {
    // A tight crowd, so most units overlap a neighbour and pushes chain.
    const crowd = () => {
      const sim = scene(seed, { count: 110 }), r = rng(seed + 99);
      for (const e of sim.entities) if (e.kind === "unit") { e.x = (r() * 2 - 1) * 14; e.z = (r() * 2 - 1) * 14; }
      const boss = sim.entities.find((e) => e.kind === "unit" && !e.flying);
      if (seed % 4 === 0 && boss) boss.boss = true;
      return sim;
    };
    const a = crowd(), b = crowd();
    a.separate(0.05);
    const units = b.entities.filter((e) => e.hp > 0 && e.kind === "unit");
    for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) b.separatePair(units[i], units[j], 0.05);
    assert.deepEqual(a.entities.map((e) => [e.id, e.x, e.z]), b.entities.map((e) => [e.id, e.x, e.z]), `seed ${seed}`);
  }
});

test("a whole AI match plays to the same state hash with the grid on and with it off", () => {
  const play = (min) => {
    const old = setGridMinimum(min);
    try {
      const sim = new Simulation({ map: "riverlands", enemyCount: 3, aiSpeed: "fast", aiPlayer: true });
      for (let i = 0; i < 2400 && !sim.result; i++) { sim.tick(0.05); sim.events.length = 0; }
      return sim.hash();
    } finally { setGridMinimum(old); }
  };
  assert.equal(play(0), play(Infinity));
});

test("ties between equally distant targets resolve by entity order, whatever cell each stands in", () => {
  for (let rot = 0; rot < 8; rot++) {
    const sim = new Simulation({ ai: false, enemyCount: 2 }), shooter = sim.spawn("ranger", 0, 0, 0, true);
    // Eight foes on a ring of 9 m, spawned in an order that does not follow the grid's cell order.
    for (let k = 0; k < 8; k++) {
      const a = ((k * 3 + rot) % 8) * (Math.PI / 4);
      sim.spawn("vanguard", 1, Math.cos(a) * 9, Math.sin(a) * 9, true);
    }
    sim.nav.rebuild(sim.entities);
    sim.visible[0].fill(1);
    sim.ticks++; sim.time += 0.05;
    const { grid, scan } = both(sim, () => ({ enemy: ids(sim.enemy(shooter, 12)), preferred: ids(withPrefers(shooter, () => sim.preferredEnemy(shooter, 12))) }));
    assert.deepEqual(grid, scan, `rotation ${rot}`);
  }
});
