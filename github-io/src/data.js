import balance from './balance.json' with { type: 'json' };
export const MAP_SIZE = 96;
export const HALF = MAP_SIZE / 2;
export const CELL = 2;
export const GRID = MAP_SIZE / CELL;
export const MAX_POP = 100;
export const TEAMS = ["Meridian Expedition", "Crimson Collective"];
export const DEFINITIONS = balance.definitions;
export const BUILDINGS = ["relay", "barracks", "foundry", "tower", "hq"];
// Symmetric collision terrain: central chokepoints and two open flanks.
export const ROCKS = [
  [-9, -5, 3],
  [-12, -8, 2.8],
  [-15, -11, 2.4],
  [9, 5, 3],
  [12, 8, 2.8],
  [15, 11, 2.4],
  [-30, -9, 2.3],
  [-33, -11, 2],
  [30, 9, 2.3],
  [33, 11, 2],
  [-8, 34, 2.2],
  [-6, 37, 2.5],
  [8, -34, 2.2],
  [6, -37, 2.5],
];
// Plain square root, not Math.hypot: it is several times faster and, unlike hypot, gives the
// same last digit in every browser, which replays and saves rely on.
export const hyp = (x, z) => Math.sqrt(x * x + z * z);
export const distance = (a, b) => hyp(a.x - b.x, a.z - b.z);
export const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
export function cellAt(x, z) {
  return [
    clamp(Math.floor((x + HALF) / CELL), 0, GRID - 1),
    clamp(Math.floor((z + HALF) / CELL), 0, GRID - 1),
  ];
}
export function worldAt(x, z) {
  return { x: x * CELL - HALF + CELL / 2, z: z * CELL - HALF + CELL / 2 };
}
