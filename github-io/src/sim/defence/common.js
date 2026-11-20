// Shared constants and route geometry of the Defence mixin (split from sim/defence.js, CW-A: code move only).
import { hyp } from "../../data.js";
import { CROSSINGS } from "../../terrain.js";

export const TEAM = 0, FOE = 1;
// Seconds between spawn attempts when the spawn spot is still crowded.
export const RETRY = 0.25;
// A route leg is done within this distance of its corner, or once the unit is past its end.
export const CORNER = 1.5;
// Burning ground kept at once (as in sim/tactics.js); the oldest goes first.
export const MAX_ZONES = 16;
// Half-width of the river's water (terrain water rectangles) and where a bridger waits on the bank.
export const WATER = 3, BANK = 5.2;
// The commander is not sent within this many metres of a route's start (the spawn spot).
export const SPAWN_CLEAR = 10;
// The units that hold a wave up this tick (the commander and Reinforce Vanguards), per simulation.
// Kept outside the simulation so it is never saved or hashed.
export const BLOCKERS = new WeakMap();
// Troop carriers (0.22): seconds from the stop to the passengers stepping out, and from the last
// one out to the empty carrier driving on. A carrier waiting this long for room drops the rest
// where it stands.
export const UNLOAD = 0.6, DEPART = 1, UNLOAD_MAX = 5;
// Build zones (0.23): metres a zone tower keeps from a road's centre line (half a lane, the widest
// wave body and the tower itself, with room to spare: the fixed pads keep the same) and from any
// other pad or tower.
export const ZONE_CLEAR = 4.5, ZONE_GAP = 5;
// Distance from (x, z) to the segment a-b.
export function segmentDistance(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return hyp(x - a.x - t * dx, z - a.z - t * dz);
}

// Where a unit walks on a route: its own lane, offset sideways from the centre line. At a corner
// the offset follows the bisector, so lanes do not cross.
export function lanePoint(pts, i, lane) {
  const p = pts[i], a = pts[i - 1] || p, b = pts[i + 1] || p;
  const n1 = normal(a, p), n2 = normal(p, b);
  let nx = n1.x + n2.x, nz = n1.z + n2.z;
  const l = hyp(nx, nz);
  if (l < 1e-6) { nx = n1.x; nz = n1.z; } else { nx /= l; nz /= l; }
  // Keep the lane width on both legs (the bisector is longer at a corner), within reason.
  const scale = Math.min(1.6, 1 / Math.max(0.6, nx * n1.x + nz * n1.z || 1));
  return { x: p.x + nx * lane * scale, z: p.z + nz * lane * scale };
}
export function normal(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l = hyp(dx, dz);
  return l < 1e-6 ? { x: 0, z: 0 } : { x: -dz / l, z: dx / l };
}
// The leg (index of its end point) of the route segment nearest to a point.
export function nearestLeg(pts, p) {
  let best = 1, bestD = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    const d = hyp(p.x - a.x - t * dx, p.z - a.z - t * dz);
    if (d < bestD - 1e-9) { best = i; bestD = d; }
  }
  return best;
}
export const sideOf = (z) => (z >= 0 ? 1 : -1);
export const crossing = (x) => CROSSINGS.find((c) => c.x === x) || null;
export const starsFor = (medal) => ({ gold: 3, silver: 2, bronze: 1 })[medal] || 0;
