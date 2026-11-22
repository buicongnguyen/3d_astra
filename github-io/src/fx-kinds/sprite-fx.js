import { SHOT_SCALE } from "./cells.js";
// The recipes that play the weapon VFX sprites (src/fx-sprites.js) for each weapon class (AAA round 3, R3-FX). Each one returns
// true when it drew (the sprites have loaded) so the caller can skip the procedural fallback it replaces, and false when they
// have not (or never will): the old effects then run as before. View only; sizes in metres, never smaller than `px` CSS pixels.
import { OCCLUDED, ORIENTED } from "../fx-sprites.js";
import { IMPACT_SHEET, impactSize, readable, SHEETS, MUZZLE_ROW, TRACER_FRAMES, HEAD_FRAME } from "../fx-sprites-data.js";

const IMPACT_PX = 54;      // an impact cell is never smaller than this on screen (a tank shell's blast reads at 24-64 px)
const MIN_PX = { shell: 54, rocket: 54, artillery: 72, bomb: 80, firebomb: 70, missile: 46, flak: 56, beam: 40 };

// The four fireball sheets (VFX2) have their own palettes; only the firebomb is shaded (yellower) and flak greyed.
const TINT = { firebomb: [1, 0.92, 0.6], flak: [0.8, 0.8, 0.85] };
const upp = (fx) => fx.view.unitsPerPixel || 0.1;
export const spritesReady = (fx) => !!(fx.sprites && fx.sprites.ready);

// A blast of `kind` (shell | rocket | artillery | bomb | flak | beam) at `at` (y above the ground), starting after `delay` seconds.
export function spriteImpact(fx, kind, at, power, anchor, delay = 0, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const sheet = IMPACT_SHEET[kind];
  if (!sheet) return false;
  const heavy = ['shell', 'walker', 'rocket', 'artillery', 'bomb', 'firebomb'].includes(kind);
  const uncappedSize = readable(impactSize(kind, power) * scale, MIN_PX[kind] || IMPACT_PX, upp(fx)) * (heavy ? 1.22 : 1);
  const width = anchor?.targetWidth;
  const size = width ? Math.min(uncappedSize, width * (kind === "beam" ? 0.5 : kind === "flak" ? 1.1 : 2)) : uncappedSize;
  const p = sprites.take(sheet, at.x, at.y + size * (kind === "flak" || kind === "beam" ? 0 : 0.09), at.z, size, anchor, false);
  if (!p) return false;
  if (heavy) {
    p.mode = OCCLUDED; // Hulls and troops in front retain their silhouettes.
    p.a = 0.8;
    p.fps *= 1.25; // Same number of art frames, 20% shorter visible life.
  }
  p.age = -delay;
  const tint = TINT[kind]; // each blast its own colour: a rocket hot yellow-white, artillery dusty, a bomb deep red-orange
  if (tint) { p.r = tint[0]; p.g = tint[1]; p.b = tint[2]; }
  // The last frames are blurry grey smoke: end the one-shot a little early so it does not smear over units.
  if (kind !== "beam" && kind !== "flak") { p.count = Math.max(1, p.count - 3); p.fade = 0.22; }
  const bright = fx.allowFlash();
  if (!bright) { p.start = 3; p.count = Math.max(1, p.count - 3); p.a = Math.min(p.a, 0.85); } // reduced motion: no white flash frames, a calmer tint
  else if (heavy) p.hotCore = true;
  else if (kind === "flak") p.rot = (fx.rng() - 0.5) * 0.6;
  p.life = p.count / Math.max(1, p.fps); // the shortened or stepped one-shot ends on its last frame
  return true;
}

// The muzzle flash of a gun at `from` pointing along (ux, uy, uz): `row` is small | medium | large.
export function spriteMuzzle(fx, from, ux, uy, uz, row, anchor, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  if (!fx.allowFlash()) return true;
  const size = 1.1 * scale;
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
  p.s1 = size; p.life = life*0.7; p.a = alpha; p.fade = 0.75; p.vy = 0.3; p.drag = 1; p.rot = fx.rng() * 6.28; p.spin = (fx.rng() - 0.5) * 0.8;
  p.fps = 8 + fx.rng() * 4; // the puffs of one trail do not all cycle in step
  return true;
}

// A flame jet looping from the muzzle `from` along (ux, uy, uz) over `reach` metres, for `life` seconds.
export function spriteJet(fx, from, ux, uy, uz, reach, life, anchor, delay = 0) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  const size = Math.max(1, reach * 1.3);
  const inlet = SHEETS.flame.inlet, back = (0.5 - inlet) * size;
  const p = sprites.take("flame", from.x + ux * back, from.y + uy * back, from.z + uz * back, size, anchor, true);
  if (!p) return false;
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.life = life; p.age = -delay; p.fade = 0.3; p.a = 0.95;
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

// ---- VFX2 (heavy-read effects): tracers, beam lines, heal beam, stomp, projectile heads.

// A streak flying muzzle -> aim (the tracer-streak sheet, warm or cyan, its four poses cycling), the muzzle spark at the muzzle and
// the hit spark where it lands, exactly `travel` seconds later. The streak is about 12-16 screen px thick, whatever the zoom.
export function spriteTracer(fx, from, to, ux, uy, uz, travel, anchor, cyan = false, delay = 0) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1;
  const size = Math.max(6, 100 * upp(fx)) * SHOT_SCALE, sheet = SHEETS.tracer;
  const p = sprites.take("tracer", from.x, from.y, from.z, size, anchor, true);
  if (!p) return false;
  const life = Math.max(0.06, travel);
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.vx = (to.x - from.x) / life; p.vy = (to.y - from.y) / life; p.vz = (to.z - from.z) / life;
  p.start = cyan ? TRACER_FRAMES.cyan : TRACER_FRAMES.warm; p.count = 4; p.loop = true; p.fps = 20; p.life = life; p.age = -delay; p.fade = 0.08; p.sy = 1.6; p.a = SHOT_SCALE;
  // The muzzle spark sits at (0.23, 0.5) of its cell.
  if (!fx.allowFlash()) return true;
  const back = (0.5 - sheet.muzzleAt) * size;
  const m = sprites.take("tracer", from.x + ux * back, from.y + uy * back, from.z + uz * back, size * 0.8, anchor, true);
  if (m) { m.a = SHOT_SCALE; m.mode = ORIENTED; m.ax = ux; m.ay = uy; m.az = uz; m.start = TRACER_FRAMES.muzzle; m.count = 4; m.age = -delay; }
  return true;
}

// The warm hit spark of a rifle round (the tracer sheet), centred on `at` (y above the ground).
export function spriteSpark(fx, at, anchor, delay = 0, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  if (!fx.allowFlash()) return true;
  const p = sprites.take("tracer", at.x, at.y + 0.3, at.z, Math.min(0.65 * scale, (anchor?.targetWidth || 1.3) * 0.5), anchor, false);
  if (!p) return false;
  p.a = SHOT_SCALE; p.start = TRACER_FRAMES.hit; p.count = 4; p.age = -delay;
  return true;
}

// A beam line: the seamless strip tiled along from -> to with a start cap and an end flare, from `delay` for `life` seconds.
// `kind` is "cyan" (Stalker, Shade) or "magenta" (rail). Beam width is measured in world metres.
export function spriteBeamLine(fx, from, to, ux, uy, uz, kind, width, life, anchor, delay, tint = null) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1, w = Math.min(width, 0.32);
  const strip = kind === "magenta" ? "beamMagenta" : "beamCyan", cap = kind === "magenta" ? "capMagenta" : "capCyan", end = kind === "magenta" ? "endMagenta" : "endCyan";
  const line = sprites.take(strip, (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2, 1, anchor, true);
  if (!line) return false;
  const ratio = SHEETS[strip].pw / SHEETS[strip].ph; // the strip is 8:1
  line.mode = ORIENTED; line.ax = ux; line.ay = uy; line.az = uz; line.sx = len; line.sy = w; line.tiles = Math.max(1, len / (w * ratio)); line.scrollSpeed = fx.motion ? -2.2 : 0;
  line.life = life; line.age = -delay; line.fade = 0.4; line.a = 0.95;
  if (tint) { line.r = tint[0]; line.g = tint[1]; line.b = tint[2]; }
  const c = sprites.take(cap, from.x, from.y, from.z, w * 2.6, anchor, true), e = sprites.take(end, to.x, to.y, to.z, w * 3.2, anchor, true);
  for (const q of [c, e]) if (q) { q.life = life; q.age = -delay; q.fade = 0.4; if (tint) { q.r = tint[0]; q.g = tint[1]; q.b = tint[2]; } }
  return true;
}

// The walker's foot contact (walker-stomp, one-shot): cracks and dust flat at its feet when it fires.
export function spriteStomp(fx, at, anchor, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  const size = 2.6 * scale;
  const p = sprites.take("stomp", at.x, at.y + size * 0.1, at.z, size, anchor, false);
  return !!p;
}

// The head of a round in flight (shell, rocket or missile art, pointing along its heading), drawn this frame only.
export function spriteHead(fx, kind, x, y, z, ux, uy, uz, size, anchor) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const p = sprites.take("heads", x, y, z, Math.max(size, 22 * upp(fx)) * SHOT_SCALE, anchor, true);
  if (!p) return false;
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.a = SHOT_SCALE; p.start = HEAD_FRAME[kind] ?? 0; p.count = 1; p.fps = 0; p.once = true; p.life = 1; p.fade = 0.0001; p.age = 0;
  return true;
}
