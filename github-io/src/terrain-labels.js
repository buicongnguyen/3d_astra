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
