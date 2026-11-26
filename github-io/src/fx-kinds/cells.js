// The sprite cells and draw modes of the combat effects (src/fx.js), kept in their own module so the
// weapon kinds in this folder can use them without importing fx.js (which imports them).
// V4 signature shots (2026-11-26): the cells after `band` are painted by signature-cells.js (in this order) when the first battle
// starts; existing cells keep their index. The atlas is a grid of ATLAS_COLUMNS cells per row (src/fx.js atlas).
import { SIGNATURE_CELLS } from "./signature-cells.js";
export const CLASSIC_CELLS = 9;
export const CELLS = ["glow", "puff", "ring", "streak", "scorch", "flare", "cross", "wrench", "band", ...SIGNATURE_CELLS.map((c) => c.name)];
export const ATLAS_COLUMNS = 12, ATLAS_ROWS = Math.ceil(CELLS.length / ATLAS_COLUMNS);
export const CELL = Object.fromEntries(CELLS.map((name, i) => [name, i]));
export const BILLBOARD = 0, STRETCH = 1, GROUND = 2, FLAT = 3; // FLAT: on the ground, facing up (src/fx.js VERTEX)

// Ratio to the original Round A projectile art, applied after any readability floor.
export const SHOT_SCALE = 0.25;
