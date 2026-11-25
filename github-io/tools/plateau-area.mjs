// Plateau building room (hills mix, 2026-11-25): how much of each map's plateau tops a structure can stand
// on, from the terrain rules alone (Terrain.placement + the 2 m map-edge margin of sim placement).
//   top        m² of plateau top (0.5 m lattice, edge < 0)
//   build.<r>  m² where a structure of radius r may be centred on a plateau top (tower 1.5, barracks 2.5,
//              foundry 2.8)
//   fit.<r>    how many such structures fit side by side on the tops (greedy, 1.25 m apart as sim placement asks)
//   refusals   lattice points (1 m, the whole map) where a barracks is refused with "Keep cliffs and ramps clear."
//   topRefusals  the same, counting only points on a plateau top (room lost to the rim on the tops)
// Usage: node tools/plateau-area.mjs [--maps dunes,woodlands] [--json out.json]
import fs from "node:fs";
import { Terrain, ALL_MAPS } from "../src/terrain.js";

const args = process.argv.slice(2), arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const RADII = { tower: 1.5, barracks: 2.5, foundry: 2.8 }, CLIFF = "Keep cliffs and ramps clear.";
const ids = arg("--maps", Object.keys(ALL_MAPS).filter((id) => (ALL_MAPS[id].plateaus || []).length).join(",")).split(",");

export function measure(id) {
  const t = new Terrain(id), h = t.half, out = { map: id, plateaus: t.plateaus.length, shapes: [...new Set(t.plateaus.map((p) => p.shape))].join("+"), top: 0, build: {}, fit: {}, refusals: 0, topRefusals: 0 };
  const ok = (x, z, r) => t.level(x, z) === 1 && Math.abs(x) <= h - r - 2 && Math.abs(z) <= h - r - 2 && !t.placement(x, z, r);
  for (let z = -h + 0.25; z < h; z += 0.5) for (let x = -h + 0.25; x < h; x += 0.5) if (t.plateauAt(x, z) >= 0) out.top += 0.25;
  for (const [name, r] of Object.entries(RADII)) {
    let area = 0;
    const placed = [];
    for (let z = -h + 0.25; z < h; z += 0.5)
      for (let x = -h + 0.25; x < h; x += 0.5) {
        if (!ok(x, z, r)) continue;
        area += 0.25;
        if (placed.every(([px, pz]) => Math.hypot(x - px, z - pz) >= 2 * r + 1.25)) placed.push([x, z]);
      }
    out.build[name] = area;
    out.fit[name] = placed.length;
  }
  for (let z = -h + 0.5; z < h; z += 1) for (let x = -h + 0.5; x < h; x += 1) if (t.placement(x, z, RADII.barracks) === CLIFF) { out.refusals++; if (t.plateauAt(x, z) >= 0) out.topRefusals++; }
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const rows = ids.map(measure);
  for (const r of rows) console.log(JSON.stringify(r));
  if (arg("--json", null)) fs.writeFileSync(arg("--json"), JSON.stringify(rows, null, 1));
}
