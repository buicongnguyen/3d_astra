// Frontier Defence road coverage: for every Defence level and Defence mission, every pad and every
// crew the level offers, how many metres of road (all routes, shared stretches counted once) a
// tower on that pad reaches, per tier. Reach is what the rules use (sim/combat.js defenseTarget):
// the tower's range, plus the target's radius, plus TERRAIN.high_range when the pad stands on a
// plateau and the road below does not. Pads far from the road are listed with their worst crew.
// Usage: node tools/defence-coverage.mjs [--json] [--level d-gorge] [--worst 12]
import { Simulation } from "../src/simulation.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { HOLD_THE_RIVER, HOLD_THE_VALLEY, HOLD_THE_ROADS } from "../src/story/defence-missions.js";
import { TERRAIN } from "../src/terrain.js";
import { segmentDistance } from "../src/sim/defence/common.js";

const STEP = 0.5, TARGET_RADIUS = 0.5;
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };

// Road samples every STEP metres, shared stretches once (keyed on a 0.5 m grid).
function roadSamples(routes) {
  const seen = new Set(), out = [];
  for (const pts of Object.values(routes))
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / STEP));
      for (let k = 0; k < n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n, key = `${Math.round(x * 2)},${Math.round(z * 2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x, z });
      }
    }
  return out;
}

export function measureLevel(level) {
  const sim = new Simulation({ map: level.map, enemyCount: level.enemies || 1, ai: false, mission: level, difficulty: "standard" });
  const def = sim.missionDef.defence, t = sim.terrain, plateaus = t.plateaus.length > 0;
  const road = roadSamples(def.routes).map((p) => ({ ...p, level: plateaus ? t.level(p.x, p.z) : 0 }));
  const total = road.length * STEP;
  const pads = def.pads.map((pad) => {
    const level = plateaus ? t.level(pad.x, pad.z) : 0;
    let gap = Infinity;
    for (const pts of Object.values(def.routes)) for (let i = 1; i < pts.length; i++) gap = Math.min(gap, segmentDistance(pad.x, pad.z, pts[i - 1], pts[i]));
    const crews = {};
    for (const crew of def.crews) {
      crews[crew] = [1, 2, 3].map((tier) => {
        const range = sim.garrisonStats(crew, tier).range;
        let n = 0;
        for (const p of road) {
          const reach = range + TARGET_RADIUS + (level > p.level ? TERRAIN.high_range : 0);
          if (Math.hypot(p.x - pad.x, p.z - pad.z) <= reach) n++;
        }
        return { range, metres: n * STEP };
      });
    }
    return { id: pad.id, high: pad.high || "", level, gap: Math.round(gap * 10) / 10, crews };
  });
  return { id: level.id, map: level.map, total, crews: def.crews, pads };
}

export function measureAll(filter = null) {
  return [...DEFENCE_LEVELS, HOLD_THE_RIVER, HOLD_THE_VALLEY, HOLD_THE_ROADS].filter((l) => !filter || l.id === filter).map(measureLevel);
}

// Run as a script (not when a test imports measureAll).
if (/defence-coverage\.mjs$/.test(process.argv[1] || "")) {
  const rows = measureAll(arg("level"));
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
  else {
    const worst = Number(arg("worst") || 3);
    for (const r of rows) {
      console.log(`\n${r.id} (${r.map}) road ${r.total} m, ${r.pads.length} pads`);
      for (const crew of r.crews) {
        const list = r.pads.map((p) => ({ p, t: p.crews[crew] })).sort((a, b) => a.t[0].metres - b.t[0].metres);
        const mean = (k) => Math.round(list.reduce((s, x) => s + x.t[k].metres, 0) / list.length);
        const ranges = list[0].t.map((x) => x.range).join("/");
        const low = list.slice(0, worst).map(({ p, t }) => `${p.id}${p.level ? "^" : ""}(gap ${p.gap}) ${t.map((x) => x.metres).join("/")}`).join("  ");
        console.log(`  ${crew.padEnd(9)} range ${ranges.padEnd(14)} mean ${mean(0)}/${mean(1)}/${mean(2)} m | worst ${low}`);
      }
    }
  }
}
