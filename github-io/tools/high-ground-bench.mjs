// High-ground check (Stage 3): equal groups, one on a plateau top and one below, fight it out in
// the real simulation. Prints per-hit damage, reach, wins and the HP-weighted share for each
// scenario, next to a flat-ground control with the same positions.
//   node tools/high-ground-bench.mjs            (JSON with --json)
import { Simulation } from "../src/simulation.js";
import { TERRAIN } from "../src/terrain.js";
import { DEFINITIONS as D } from "../src/data.js";

const GROUPS = {
  rangers: ["ranger", "ranger", "ranger", "ranger"],
  tanks: ["tank", "tank", "tank"],
  mixed: ["ranger", "ranger", "ranger", "vanguard", "vanguard", "tank"],
};
// How the fight starts: both groups guard their spot (default stance), or the low group is
// sent up at the plateau (attack-move to its centre), or the high group comes down.
const STARTS = ["guard", "low-attacks", "high-attacks"];
const GAPS = [3, 6, 9]; // metres between the cliff foot and the low group
const SIDES = [90, 135, 45]; // degrees around the plateau where the fight happens (dunes disc, ramps at 0 and 180)

const life = (e) => Math.max(0, e.hp) + Math.max(0, e.shield || 0);

export function fight({ group, start, gap, side, flat = false, swap = false }) {
  const HT = swap ? 1 : 0, LT = swap ? 0 : 1;
  const s = new Simulation({ ai: false, map: "dunes" });
  const p = s.terrain.plateaus[0];
  if (flat) { s.terrain.plateaus = []; s.terrain.cellLevel.fill(0); s.terrain.cellDeep.fill(0); s.terrain.cellPlateau.fill(-1); }
  // The starting units are removed; buildings stay at the bases, far from the plateau.
  for (const e of s.entities) if (e.kind === "unit") { e.hp = 0; }
  s.entities = s.entities.filter((e) => e.hp > 0);
  const a = (side * Math.PI) / 180, nx = Math.cos(a), nz = Math.sin(a), tx = -nz, tz = nx;
  const high = [], low = [];
  GROUPS[group].forEach((type, i) => {
    const k = i - (GROUPS[group].length - 1) / 2;
    // High group 2.5 m inside the rim, low group `gap` m beyond the cliff foot, 1.8 m apart sideways.
    // Entities act in spawn order within a tick, so `swap` also swaps who is spawned (and acts) first.
    const hr = p.r - 2.5, lr = p.r + 1 + gap;
    const up = () => high.push(s.spawn(type, HT, p.x + nx * hr + tx * k * 1.8, p.z + nz * hr + tz * k * 1.8));
    const down = () => low.push(s.spawn(type, LT, p.x + nx * lr + tx * k * 1.8, p.z + nz * lr + tz * k * 1.8));
    if (swap) { down(); up(); } else { up(); down(); }
  });
  const all = [...high, ...low], startLife = { high: high.reduce((t, e) => t + life(e), 0), low: low.reduce((t, e) => t + life(e), 0) };
  if (start === "low-attacks") s.issue(low.map((e) => e.id), { type: "attackmove", x: p.x, z: p.z });
  if (start === "high-attacks") s.issue(high.map((e) => e.id), { type: "attackmove", x: p.x + nx * (p.r + 1 + gap), z: p.z + nz * (p.r + 1 + gap) });
  const hits = { high: { n: 0, dmg: 0 }, low: { n: 0, dmg: 0 } }, highIds = new Set(high.map((e) => e.id));
  let t = 0;
  for (; t < 120; t += 0.05) {
    const before = new Map(all.map((e) => [e.id, life(e)]));
    s.tick(0.05);
    for (const ev of s.events) if (ev.type === "shot") { const side = highIds.has(ev.source) ? "high" : "low"; hits[side].n++; }
    s.events.length = 0;
    for (const e of all) { const d = before.get(e.id) - life(e); if (d > 0) hits[highIds.has(e.id) ? "low" : "high"].dmg += d; }
    if (high.every((e) => e.hp <= 0) || low.every((e) => e.hp <= 0)) break;
  }
  const left = { high: high.reduce((x, e) => x + (e.hp > 0 ? life(e) : 0), 0), low: low.reduce((x, e) => x + (e.hp > 0 ? life(e) : 0), 0) };
  const winner = high.every((e) => e.hp <= 0) ? "low" : low.every((e) => e.hp <= 0) ? "high" : "none";
  return { winner, seconds: +t.toFixed(1), left, startLife, hits, aliveHigh: high.filter((e) => e.hp > 0).length, aliveLow: low.filter((e) => e.hp > 0).length };
}

export function bench() {
  const rows = [];
  for (const group of Object.keys(GROUPS))
    for (const start of STARTS) {
      const sum = { hill: { win: 0, lose: 0, draw: 0, share: 0, kept: 0 }, flat: { win: 0, lose: 0, draw: 0, share: 0, kept: 0 } }, n = GAPS.length * SIDES.length * 2;
      for (const gap of GAPS)
        for (const side of SIDES)
          for (const swap of [false, true])
            for (const flat of [false, true]) {
              const r = fight({ group, start, gap, side, flat, swap }), k = flat ? "flat" : "hill";
              sum[k][r.winner === "high" ? "win" : r.winner === "low" ? "lose" : "draw"]++;
              // HP-weighted outcome: 50% is even, 100% the high side won without a scratch, 0% it was wiped out unhurt.
              sum[k].share += (1 + r.left.high / r.startLife.high - r.left.low / r.startLife.low) / 2;
              sum[k].kept += r.left.high / r.startLife.high;
            }
      for (const k of ["hill", "flat"]) { sum[k].share = +(sum[k].share / n).toFixed(3); sum[k].kept = +(sum[k].kept / n).toFixed(3); }
      rows.push({ group, start, runs: n, ...sum });
    }
  return rows;
}

// Run directly (a test imports fight() without running the bench).
if (process.argv[1]?.replace(/\\/g, "/").endsWith("tools/high-ground-bench.mjs")) {
  const rows = bench();
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 1));
  else {
    console.log(`terrain: high_range +${TERRAIN.high_range} m, high_damage x${TERRAIN.high_damage}, low_damage x${TERRAIN.low_damage}, high_vision +${TERRAIN.high_vision} m`);
    for (const type of ["ranger", "tank"]) console.log(`${type}: ${D[type].damage} per hit level, ${(D[type].damage * TERRAIN.high_damage).toFixed(1)} firing down, ${(D[type].damage * TERRAIN.low_damage).toFixed(1)} firing up; range ${D[type].range} m (${D[type].range + TERRAIN.high_range} m from a plateau)`);
    console.log("group     start         runs | on a plateau: W-L-D  outcome  kept | flat control: W-L-D  outcome  kept   (outcome: HP-weighted, 50% = even; kept: high side HP left)");
    for (const r of rows)
      console.log(`${r.group.padEnd(9)} ${r.start.padEnd(13)} ${String(r.runs).padStart(4)} | ${`${r.hill.win}-${r.hill.lose}-${r.hill.draw}`.padStart(19)}  ${(r.hill.share * 100).toFixed(0).padStart(6)}% ${(r.hill.kept * 100).toFixed(0).padStart(4)}% | ${`${r.flat.win}-${r.flat.lose}-${r.flat.draw}`.padStart(19)}  ${(r.flat.share * 100).toFixed(0).padStart(6)}% ${(r.flat.kept * 100).toFixed(0).padStart(4)}%`);
    const hill = rows.reduce((t, r) => t + r.hill.share, 0) / rows.length, flat = rows.reduce((t, r) => t + r.flat.share, 0) / rows.length;
    console.log(`overall HP-weighted outcome for the high side: ${(hill * 100).toFixed(1)}% (flat control ${(flat * 100).toFixed(1)}%)`);
  }
}
