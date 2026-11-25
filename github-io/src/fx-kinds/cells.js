// The sprite cells and draw modes of the combat effects (src/fx.js), kept in their own module so the
// weapon kinds in this folder can use them without importing fx.js (which imports them).
export const CELLS = ["glow", "puff", "ring", "streak", "scorch", "flare", "cross", "wrench", "band"];
export const CELL = Object.fromEntries(CELLS.map((name, i) => [name, i]));
export const BILLBOARD = 0, STRETCH = 1, GROUND = 2, FLAT = 3; // FLAT: on the ground, facing up (src/fx.js VERTEX)

// Ratio to the original Round A projectile art, applied after any readability floor.
export const SHOT_SCALE = 0.25;
