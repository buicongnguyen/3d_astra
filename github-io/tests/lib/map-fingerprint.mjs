// Map fingerprints (R3 map variety): one FNV-1a hash of everything a map's terrain answers (surface,
// standing, building rules, render height, level, cliffs, ramps, water, plateaus, walls) sampled on a
// 0.5 m lattice, and the state hash of fresh matches on it. Recorded from the tree before the map
// engine grew optional fields, so the old maps are proven to build and play exactly as before.
import { Terrain } from "../../src/terrain.js";
import { Simulation } from "../../src/simulation.js";
import { fnv1a } from "../../src/rng.js";
import { run, aiMatch } from "./sim.js";

export function terrainFingerprint(id) {
  const t = new Terrain(id), parts = [JSON.stringify({ water: t.water, plateaus: t.plateaus, walls: t.walls, size: t.size, river: t.river })];
  for (let z = -t.half; z <= t.half; z += 0.5) {
    let row = "";
    for (let x = -t.half; x <= t.half; x += 0.5)
      row += `${t.at(x, z)[0]}${t.canStand(x, z) ? 1 : 0}${t.canStand(x, z, 1.6) ? 1 : 0}${t.placement(x, z, 1.5).length}${t.heightAt(x, z).toFixed(4)}${t.level(x, z)}${t.plateaus.length ? `${t.cliff(x, z) ? 1 : 0}${t.onRamp(x, z) ? 1 : 0}` : ""}|`;
    parts.push(row);
  }
  const lv = [...t.cellLevel].join(""), deep = [...t.cellDeep].join("");
  return fnv1a(parts.join("\n") + lv + deep).toString(16).padStart(8, "0");
}

// The start of a match with 1, 2 and 3 rivals (camps, deposits, walls, points), and 90 s of the computer
// playing every side 1v1 on Normal.
export function matchFingerprint(id) {
  const out = {};
  for (const enemyCount of [1, 2, 3]) out[`x${enemyCount}`] = new Simulation({ map: id, enemyCount, capturePoints: true }).hash();
  out.ai90 = run(aiMatch({ map: id, enemyCount: 1, aiSpeed: "normal", capturePoints: true }), 90);
  return out;
}
