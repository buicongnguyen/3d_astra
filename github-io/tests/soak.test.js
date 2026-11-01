import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";

// Randomised soak: seeded random player commands (move, attack, gather, train, build, upgrade, cancel,
// repair, stop) against live AI rivals, checking invariants as the match runs. The long version (all
// seven maps, 1-3 rivals, 6 minutes) lives in the review notes; this short one guards the same rules.
const SEED = 0;
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const problems = new Map(); const note = (k, d) => { if (!problems.has(k)) problems.set(k, { n: 0, first: d }); problems.get(k).n++; };
function hash(s) { let h = 2166136261; for (const e of s.entities) { for (const v of [e.id, e.x, e.z, e.hp]) { h ^= Math.round(v * 1000) | 0; h = Math.imul(h, 16777619); } } return h >>> 0; }
function run(map, enemyCount, seed, minutes, check) {
  const R = rng(seed + SEED), s = new Simulation({ map, enemyCount, aiSpeed: "normal" }); const staleSeen = new Map();
  const wedged = new Map();
  const buildKinds = ["relay", "barracks", "foundry", "tower"], trainable = ["worker", "vanguard", "ranger", "breaker", "medic", "engineer", "tank", "antitank"];
  for (let step = 0; step < minutes * 1200 && !s.result; step++) {
    if (step % 40 === 0) { // every 2 s: a burst of random commands
      s.players[0].alloy = Math.max(s.players[0].alloy, 300); s.players[0].energy = Math.max(s.players[0].energy, 150);
      const mine = s.own(0), units = mine.filter((e) => e.kind === "unit"), blds = mine.filter((e) => e.kind === "building");
      const pick = (a) => a[Math.floor(R() * a.length)];
      for (let k = 0; k < 3; k++) {
        const r = R(), u = units.length ? pick(units) : null, grp = units.filter(() => R() < 0.3).map((e) => e.id);
        try {
          if (r < 0.2 && grp.length) s.issue(grp, { type: "move", x: (R() - 0.5) * 80, z: (R() - 0.5) * 80 }, R() < 0.2);
          else if (r < 0.32 && grp.length) { const en = s.entities.filter((e) => e.team > 0 && e.hp > 0); if (en.length) s.issue(grp, { type: "attack", target: pick(en).id }); }
          else if (r < 0.42 && u) { const dep = pick(s.resources); s.issue(units.filter((x) => x.type === "worker").map((x) => x.id), { type: "gather", target: dep.id }); }
          else if (r < 0.52 && blds.length) { const b = pick(blds), t = pick(trainable); s.enqueue(b.id, t); }
          else if (r < 0.62) { const w = units.find((x) => x.type === "worker"); if (w) { const h = mine.find((e) => e.type === "hq"); if (h) { const kind = pick(buildKinds), a = R() * 6.28, site = s.findPlacement(kind, 0, h.x + Math.cos(a) * (8 + R() * 14), h.z + Math.sin(a) * (8 + R() * 14)); if (site) s.build(w.id, kind, site.x, site.z); } } }
          else if (r < 0.7 && blds.length) { const b = pick(blds); s.upgradeBuilding(b.id, 0); }
          else if (r < 0.76 && blds.length) { const b = pick(blds.filter((x) => !x.complete)); if (b) s.cancelBuilding(b.id); }
          else if (r < 0.86) { const dmg = blds.filter((x) => x.hp < x.maxHp && x.complete); if (dmg.length && units.length) s.issue(units.filter(() => R() < 0.4).map((x) => x.id), { type: "repair", target: pick(dmg).id }); }
          else if (r < 0.9 && grp.length) s.issue(grp, { type: "stop" });
          else if (r < 0.95 && blds.length) { const b = pick(blds); if (b.queue.length) s.cancelQueue?.(b.id, 0); }
          else if (grp.length) s.issue(grp, { type: "attackmove", x: (R() - 0.5) * 80, z: (R() - 0.5) * 80 });
        } catch (err) { note("EXCEPTION in command: " + String(err.stack).split("\n").slice(0, 3).join(" | "), `${map}/${enemyCount}/${seed}`); }
      }
    }
    try { s.tick(0.05); s.events.splice(0); /* the game loop drains events every frame */ } catch (err) { note("EXCEPTION in tick: " + String(err.stack).split("\n").slice(0, 3).join(" | "), `${map}/${enemyCount}/${seed} step ${step}`); return s; }
    if (check && step % 60 === 0) {
      const half = s.terrain.half;
      for (const e of s.entities) {
        const w = `${map}/${enemyCount}/${seed} t=${s.time.toFixed(0)} ${e.type}#${e.id}`;
        if (![e.x, e.z, e.hp].every(Number.isFinite)) note("non-finite position/hp", w);
        else if (Math.abs(e.x) > half + 0.01 || Math.abs(e.z) > half + 0.01) note("entity outside the map", w + ` at ${e.x.toFixed(1)},${e.z.toFixed(1)}`);
        if (e.hp > e.maxHp + 0.01) note("hp above maxHp", w);
        if (e.shield > e.maxShield + 0.01 || e.shield < -0.01) note("shield out of range", w);
        if (e.kind === "unit" && e.hp > 0) {
          if (e.carry < 0 || e.carry > 10.0001) note("carry out of range", w + ` carry=${e.carry}`);
          if (e.orders.length > 32) note("order list over 32", w);
          const stale = e.orders.some((o) => o.target !== undefined && o.type !== "patrol" && !s.get(o.target) && !s.resources.some((r) => r.id === o.target));
          if (stale) { staleSeen.set(e.id, (staleSeen.get(e.id) || 0) + 1); if (staleSeen.get(e.id) === 3) note("order keeps targeting a removed entity for 3+ s", w); } else staleSeen.delete(e.id);
          if (!s.nav.canStand(e.x, e.z, e.radius)) { const k = e.id; wedged.set(k, (wedged.get(k) || 0) + 1); if (wedged.get(k) === 4) note("unit overlapping a footprint/water for 4+ s", w + ` at ${e.x.toFixed(1)},${e.z.toFixed(1)} orders=${e.orders.length}`); } else wedged.delete(e.id);
        }
        if (e.kind === "building" && e.queue) for (const q of e.queue) if (!(q.elapsed >= 0) || q.elapsed > 1e4) note("bad queue elapsed", w);
      }
      for (const t of s.players) for (const r of ["alloy", "energy"]) if (!Number.isFinite(t[r]) || t[r] < -0.001) note("resource negative/NaN", `${map}/${enemyCount}/${seed} ${r}=${t[r]}`);
      if (s.events.length > 400) note("event queue grows (never drained)", `${s.events.length} events`);
    }
  }
  return s;
}

const report = () => [...problems].map(([k, v]) => `${k} (x${v.n}, first: ${v.first})`);
test("soak: 2.5 minutes of random commands on two maps keeps every invariant", () => {
  problems.clear();
  for (const map of ["classic", "highlands"]) run(map, 2, 11, 2.5, true);
  assert.deepEqual(report(), []);
});
test("soak: identical inputs give an identical match (the simulation is deterministic)", () => {
  problems.clear();
  assert.equal(hash(run("classic", 2, 5, 2, false)), hash(run("classic", 2, 5, 2, false)));
});
