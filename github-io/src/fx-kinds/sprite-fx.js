// The recipes that play the weapon VFX sprites (src/fx-sprites.js) for each weapon class (AAA round 3, R3-FX). Each one returns
// true when it drew (the sprites have loaded) so the caller can skip the procedural fallback it replaces, and false when they
// have not (or never will): the old effects then run as before. View only; sizes in metres, never smaller than `px` CSS pixels.
import { ORIENTED } from "../fx-sprites.js";
import { IMPACT_SHEET, impactSize, readable, SHEETS, MUZZLE_ROW } from "../fx-sprites-data.js";

const IMPACT_PX = 54;      // an impact cell is never smaller than this on screen (a tank shell's blast reads at 24-64 px)
const MIN_PX = { shell: 54, rocket: 54, artillery: 72, bomb: 80, firebomb: 70, flak: 44, beam: 40 };

const TINT = { shell: [1, 0.97, 0.9], rocket: [1, 1, 0.82], artillery: [0.95, 0.88, 0.8], bomb: [1, 0.78, 0.66], firebomb: [1, 0.95, 0.5], flak: [0.8, 0.8, 0.85] };
const upp = (fx) => fx.view.unitsPerPixel || 0.1;
export const spritesReady = (fx) => !!(fx.sprites && fx.sprites.ready);

// A blast of `kind` (shell | rocket | artillery | bomb | flak | beam) at `at` (y above the ground), starting after `delay` seconds.
export function spriteImpact(fx, kind, at, power, anchor, delay = 0, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const sheet = IMPACT_SHEET[kind];
  if (!sheet) return false;
  const size = readable(impactSize(kind, power) * scale, MIN_PX[kind] || IMPACT_PX, upp(fx));
  const p = sprites.take(sheet, at.x, at.y + size * (kind === "flak" || kind === "beam" ? 0 : 0.2), at.z, size, anchor, false);
  if (!p) return false;
  p.age = -delay;
  const tint = TINT[kind]; // each blast its own colour: a rocket hot yellow-white, artillery dusty, a bomb deep red-orange
  if (tint) { p.r = tint[0]; p.g = tint[1]; p.b = tint[2]; }
  // The last frames are blurry grey smoke: end the one-shot a little early so it does not smear over units.
  if (kind !== "beam" && kind !== "flak") { p.count = Math.max(1, p.count - 3); p.fade = 0.22; }
  if (!fx.motion) { p.start = 2; p.count = Math.max(1, p.count - 2); p.a = 0.85; } // reduced motion: no white flash frames, a calmer tint
  else if (kind === "flak") p.rot = (fx.rng() - 0.5) * 0.6;
  p.life = p.count / Math.max(1, p.fps); // the shortened or stepped one-shot ends on its last frame
  return true;
}

// The muzzle flash of a gun at `from` pointing along (ux, uy, uz): `row` is small | medium | large.
export function spriteMuzzle(fx, from, ux, uy, uz, row, anchor, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  const size = readable(2.7 * scale, 30, upp(fx));
  const inlet = SHEETS.muzzle.inlet, back = (0.5 - inlet) * size;
  const p = sprites.take("muzzle", from.x + ux * back, from.y + uy * back, from.z + uz * back, size, anchor, true);
  if (!p) return false;
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.start = (MUZZLE_ROW[row] ?? 1) * 4; p.count = 4;
  return true;
}

// One puff of a smoke trail (loops the four trail frames, drifts up a little, thins out); `life` seconds.
export function spriteTrailPuff(fx, x, y, z, size, life, anchor, alpha = 0.8) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const p = sprites.take("smoke", x, y, z, size * 0.55, anchor, true);
  if (!p) return false;
  p.s1 = size; p.life = life; p.a = alpha; p.fade = 0.75; p.vy = 0.3; p.drag = 1; p.rot = fx.rng() * 6.28; p.spin = (fx.rng() - 0.5) * 0.8;
  p.fps = 8 + fx.rng() * 4; // the puffs of one trail do not all cycle in step
  return true;
}

// A flame jet looping from the muzzle `from` along (ux, uy, uz) over `reach` metres, for `life` seconds.
export function spriteJet(fx, from, ux, uy, uz, reach, life, anchor, delay = 0) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  const size = Math.max(reach * 2.1, readable(4, 96, upp(fx)));
  const inlet = SHEETS.flame.inlet, back = (0.5 - inlet) * size;
  const p = sprites.take("flame", from.x + ux * back, from.y + uy * back, from.z + uz * back, size, anchor, true);
  if (!p) return false;
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.life = life; p.age = -delay; p.fade = 0.3; p.a = 0.95;
  return true;
}

// Mint sparkles rising around a healed unit at `at` (y above the ground), tinted like the beam.
export function spriteHeal(fx, at, tint, anchor, life = 0.9) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const size = readable(8, 120, upp(fx));
  const p = sprites.take("heal", at.x, at.y + size * 0.2, at.z, size, anchor, false);
  if (!p) return false;
  p.life = life; p.fade = 0.35; p.r = tint[0] * 0.55; p.g = tint[1] * 0.9; p.b = tint[2] * 0.7; p.a = 1;
  if (!fx.motion) p.fps *= 0.5;
  return true;
}

// The cyan contact flare of a beam or rail at its target (y above the ground), exactly `delay` seconds after the shot (when the line
// lands), tinted toward the weapon's colour (the sheet is cyan-white, so a green rail shades it green and a cyan beam leaves it alone).
export function spriteBeamImpact(fx, at, c0, anchor, delay) {
  const sprites = fx.sprites;
  if (!spriteImpact(fx, "beam", at, 1, anchor, delay)) return false;
  const batch = sprites.batches.add, p = batch.items[batch.items.length - 1];
  if (c0 && p) { p.r = Math.min(1, 0.4 + c0[0]); p.g = Math.min(1, 0.4 + c0[1]); p.b = Math.min(1, 0.4 + c0[2]); }
  return true;
}
