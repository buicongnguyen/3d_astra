// What the player is told about the ground: river crossings and high ground. Pure functions over
// the Terrain (src/terrain.js) and the height rules in balance.json, shared by the hover label,
// the selection card, the hint, the minimap and the 3D marks. Presentation only.
import { CROSSINGS, TERRAIN } from "./terrain.js";

const percent = (k) => Math.round((k - 1) * 100);
// "High ground: +2 m range, +20% damage, +3 m sight", from the live balance numbers.
export const HIGH_GROUND_TEXT = `High ground: +${TERRAIN.high_range} m range, +${percent(TERRAIN.high_damage)}% damage, +${TERRAIN.high_vision} m sight`;
// The same without sight, for narrow cards (phone landscape).
export const HIGH_GROUND_SHORT = `High ground: +${TERRAIN.high_range} m range, +${percent(TERRAIN.high_damage)}% damage`;
export const HIGH_GROUND_HINT = "High ground: your units here shoot farther, hit harder and see farther.";
// Deep on a plateau (sim/vision.js: low units can't see those cells unless their side has a unit up there).
export const HIDDEN_TEXT = "Hidden from below";
export const HIDDEN_HINT = "Units deep on a plateau can't be seen from below. Enemies must climb the ramp to fight them.";
// Wading the ford (sim/traits.js inFord): slower, and abilities wait until the far bank.
export const FORD_TEXT = `In the ford: ${percent(TERRAIN.ford_speed)}% speed, no abilities`;
export const FORD_SHORT = "In the ford";
// Barrage or Burn line aimed at a deep plateau top nobody on the caster's side can see.
export const SIGHT_TEXT = "Can't see up there";
export const CROSSING_TEXT = {
  ford: "Ford: infantry and vehicles can cross",
  bridge: "Bridge: infantry and vehicles can cross",
};

// A unit, or a building that shoots (a tower), standing on a plateau top: it gets the high-ground
// bonuses against anything below (src/sim/height.js).
export function onHighGround(terrain, e) {
  if (!terrain?.plateaus?.length || !e || !(e.kind === "unit" || (e.kind === "building" && e.damage > 0))) return false;
  return terrain.level(e.x, e.z) === 1;
}

// Plateaus where a hostile unit or building that `team` can see now stands, as a Set of plateau
// indices. Only what the team already sees counts, so the mark below never leaks fog.
export function heldPlateaus(sim, team = 0) {
  const held = new Set(), t = sim.terrain;
  if (!t?.plateaus?.length) return held;
  for (const e of sim.entities) {
    if (e.hp <= 0 || e.team < 0 || !(e.kind === "unit" || e.kind === "building") || !sim.hostile(team, e.team) || !sim.isVisible(e, team)) continue;
    const [x, z] = t.cellAt(e.x, e.z), k = t.cellPlateau[z * t.grid + x];
    if (k >= 0) held.add(k);
  }
  return held;
}

// "Hidden from below", from the ground alone: `e` (a unit, or a tower) stands more than
// hidden_depth inside a plateau's rim, and no enemy `team` can see stands on that plateau.
// Units on the rim strip are high but visible from below. Whether an unseen enemy actually
// spots the unit is never asked: that would leak the fog. Pass `held` (heldPlateaus) when
// asking for many units in one frame.
export function hiddenFromBelow(sim, e, team = 0, held = null) {
  const t = sim?.terrain;
  if (!t?.plateaus?.length || !e || e.hp <= 0 || !(e.kind === "unit" || (e.kind === "building" && e.damage > 0))) return false;
  const [x, z] = t.cellAt(e.x, e.z), i = z * t.grid + x;
  if (!t.cellDeep[i]) return false;
  return !(held || heldPlateaus(sim, team)).has(t.cellPlateau[i]);
}

// What the selection card says about the ground under a selection: all on high ground, all
// wading the ford (sim/traits.js inFord), and all of the player's own units hidden from below.
export function selectionGround(sim, entities) {
  const high = entities.length > 0 && entities.every((u) => onHighGround(sim.terrain, u));
  const ford = !high && entities.length > 0 && !!sim.inFord && entities.every((u) => u.kind === "unit" && sim.inFord(u));
  let hidden = false;
  if (high && entities.every((u) => u.team === 0)) {
    const held = heldPlateaus(sim, 0);
    hidden = entities.every((u) => hiddenFromBelow(sim, u, 0, held));
  }
  return { high, ford, hidden };
}

// One minimap tick per ramp: across the ramp, 1.5 m out from the rim (world metres).
export function rampTicks(terrain) {
  const out = [], e = 0.05;
  for (const p of terrain?.plateaus || [])
    for (const r of p.ramps) {
      // The plateau's outward direction at the ramp (numerical gradient of Terrain.edge).
      const gx = terrain.edge(p, r.x + e, r.z) - terrain.edge(p, r.x - e, r.z), gz = terrain.edge(p, r.x, r.z + e) - terrain.edge(p, r.x, r.z - e), l = Math.hypot(gx, gz) || 1;
      const nx = gx / l, nz = gz / l, x = r.x + nx * 1.5, z = r.z + nz * 1.5;
      out.push({ x, z, x0: x - nz * r.half, z0: z + nx * r.half, x1: x + nz * r.half, z1: z - nx * r.half });
    }
  return out;
}

// The crossing at a ground point (the water and its banks, |z| < 5), or null.
export function crossingAt(terrain, x, z) {
  if (!terrain?.river || !Number.isFinite(x) || !Number.isFinite(z) || Math.abs(z) >= 5) return null;
  return CROSSINGS.find((c) => Math.abs(x - c.x) < c.half) || null;
}

// +1 for a shot fired down from a plateau, -1 for one fired up at it, 0 on level ground.
export function shotSlope(terrain, x, z, tx, tz) {
  if (!terrain?.plateaus?.length || ![x, z, tx, tz].every(Number.isFinite)) return 0;
  return Math.sign(terrain.level(x, z) - terrain.level(tx, tz));
}
