// The recipes that play the weapon VFX sprites (src/fx-sprites.js) for each weapon class (AAA round 3, R3-FX). Each one returns
// true when it drew (the sprites have loaded) so the caller can skip the procedural fallback it replaces, and false when they
// have not (or never will): the old effects then run as before. View only; sizes in metres, never smaller than `px` CSS pixels.
import { ORIENTED } from "../fx-sprites.js";
import { IMPACT_SHEET, IMPACT_EXTRA, impactSize, readable, SHEETS, MUZZLE_ROW, TRACER_FRAMES, HEAD_FRAME } from "../fx-sprites-data.js";

const IMPACT_PX = 54;      // an impact cell is never smaller than this on screen (a tank shell's blast reads at 24-64 px)
const MIN_PX = { shell: 54, rocket: 54, artillery: 72, bomb: 80, firebomb: 70, missile: 46, flak: 44, beam: 40 };

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
  const heavy = ['shell', 'rocket', 'artillery', 'bomb', 'firebomb'].includes(kind);
  const size = readable(impactSize(kind, power) * scale, MIN_PX[kind] || IMPACT_PX, upp(fx)) * (heavy ? 1.5 : 1);
  const p = sprites.take(sheet, at.x, at.y + size * (kind === "flak" || kind === "beam" ? 0 : 0.2), at.z, size, anchor, false);
  if (!p) return false;
  p.age = -delay;
  const tint = TINT[kind]; // each blast its own colour: a rocket hot yellow-white, artillery dusty, a bomb deep red-orange
  if (tint) { p.r = tint[0]; p.g = tint[1]; p.b = tint[2]; }
  // The last frames are blurry grey smoke: end the one-shot a little early so it does not smear over units.
  if (kind !== "beam" && kind !== "flak") { p.count = Math.max(1, p.count - 3); p.fade = 0.22; }
  const bright = fx.allowFlash();
  if (!bright) { p.start = 3; p.count = Math.max(1, p.count - 3); p.a = 0.85; } // reduced motion: no white flash frames, a calmer tint
  else if (heavy) p.hotCore = true;
  else if (kind === "flak") p.rot = (fx.rng() - 0.5) * 0.6;
  p.life = p.count / Math.max(1, p.fps); // the shortened or stepped one-shot ends on its last frame
  const extra = IMPACT_EXTRA[kind];
  if (extra && bright) {
    const q = sprites.take(extra[0], at.x, at.y + size * extra[1] * 0.2, at.z, size * extra[1], anchor, false);
    if (q) { q.age = -delay; q.count = Math.max(1, q.count - 3); q.fade = 0.22; q.life = q.count / Math.max(1, q.fps); }
  }
  return true;
}

// The muzzle flash of a gun at `from` pointing along (ux, uy, uz): `row` is small | medium | large.
export function spriteMuzzle(fx, from, ux, uy, uz, row, anchor, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  if (!fx.allowFlash()) return true;
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

// ---- VFX2 (heavy-read effects): tracers, beam lines, heal beam, stomp, projectile heads.

// A streak flying muzzle -> aim (the tracer-streak sheet, warm or cyan, its four poses cycling), the muzzle spark at the muzzle and
// the hit spark where it lands, exactly `travel` seconds later. The streak is about 12-16 screen px thick, whatever the zoom.
export function spriteTracer(fx, from, to, ux, uy, uz, travel, anchor, cyan = false, delay = 0) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1;
  const size = Math.max(6, 100 * upp(fx)), sheet = SHEETS.tracer;
  const p = sprites.take("tracer", from.x, from.y, from.z, size, anchor, true);
  if (!p) return false;
  const life = Math.max(0.06, travel);
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.vx = (to.x - from.x) / life; p.vy = (to.y - from.y) / life; p.vz = (to.z - from.z) / life;
  p.start = cyan ? TRACER_FRAMES.cyan : TRACER_FRAMES.warm; p.count = 4; p.loop = true; p.fps = 20; p.life = life; p.age = -delay; p.fade = 0.08; p.sy = 1.6; // thickness: about 14 CSS px
  // Two fainter copies follow a moment behind, so the dash leaves a short trail that is on screen for several frames.
  for (let k = 1; k <= 2; k++) {
    const t = sprites.take("tracer", from.x, from.y, from.z, size, anchor, true);
    if (!t) break;
    t.mode = ORIENTED; t.ax = ux; t.ay = uy; t.az = uz; t.vx = p.vx; t.vy = p.vy; t.vz = p.vz; t.start = p.start; t.count = 4; t.loop = true; t.fps = 20;
    t.life = life; t.age = -delay - k * Math.max(0.035, (0.25 - life) / 2); t.fade = 0.2; t.sy = 1.6; t.a = k === 1 ? 0.6 : 0.35;
  }
  // The muzzle spark sits at (0.23, 0.5) of its cell.
  if (!fx.allowFlash()) return true;
  const back = (0.5 - sheet.muzzleAt) * size;
  const m = sprites.take("tracer", from.x + ux * back, from.y + uy * back, from.z + uz * back, size * 0.8, anchor, true);
  if (m) { m.mode = ORIENTED; m.ax = ux; m.ay = uy; m.az = uz; m.start = TRACER_FRAMES.muzzle; m.count = 4; m.age = -delay; }
  return true;
}

// The warm hit spark of a rifle round (the tracer sheet), centred on `at` (y above the ground).
export function spriteSpark(fx, at, anchor, delay = 0, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  if (!fx.allowFlash()) return true;
  const p = sprites.take("tracer", at.x, at.y + 0.3, at.z, Math.max(4.4, 90 * upp(fx)) * scale, anchor, false);
  if (!p) return false;
  p.start = TRACER_FRAMES.hit; p.count = 4; p.age = -delay;
  return true;
}

// A beam line: the seamless strip tiled along from -> to with a start cap and an end flare, from `delay` for `life` seconds.
// `kind` is "cyan" (Stalker, Shade) or "magenta" (rail). Width in metres, never under 20 screen px.
export function spriteBeamLine(fx, from, to, ux, uy, uz, kind, width, life, anchor, delay, tint = null) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1, w = Math.max(width, 20 * upp(fx));
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

// The heal beam (a green strip tiled along the connection) with sparkle crosses rising along it, offset in time.
export function spriteHealBeam(fx, from, to, ux, uy, uz, anchor, tint, life = 0.8) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1, w = Math.max(0.9, 24 * upp(fx));
  const line = sprites.take("healBeam", (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2, 1, anchor, true);
  if (!line) return false;
  line.mode = ORIENTED; line.ax = ux; line.ay = uy; line.az = uz; line.sx = len; line.sy = w; line.tiles = Math.max(1, len / (w * 8)); line.scrollSpeed = fx.motion ? -1.4 : 0;
  line.life = life; line.fade = 0.4; line.a = 0.95;
  if (tint) { line.r = tint[0]; line.g = tint[1]; line.b = tint[2]; }
  const size = readable(3.6, 70, upp(fx));
  for (let i = 0, n = fx.view.lowPower ? 2 : 3; i < n; i++) {
    const k = (i + 0.5) / n, q = sprites.take("heal", from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + size * 0.25, from.z + (to.z - from.z) * k, size, anchor, true);
    if (q) { q.life = life; q.age = -i * 0.12; q.fade = 0.35; q.fps *= 0.9; if (tint) { q.r = tint[0]; q.g = tint[1]; q.b = tint[2]; } }
  }
  return true;
}

// The walker's foot contact (walker-stomp, one-shot): cracks and dust flat at its feet when it fires.
export function spriteStomp(fx, at, anchor, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  const size = readable(8 * scale, 90, upp(fx));
  const p = sprites.take("stomp", at.x, at.y + size * 0.1, at.z, size, anchor, false);
  return !!p;
}

// The head of a round in flight (shell, rocket or missile art, pointing along its heading), drawn this frame only.
export function spriteHead(fx, kind, x, y, z, ux, uy, uz, size) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const p = sprites.take("heads", x, y, z, Math.max(size, 22 * upp(fx)), null, true);
  if (!p) return false;
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.start = HEAD_FRAME[kind] ?? 0; p.count = 1; p.fps = 0; p.once = true; p.life = 1; p.fade = 0.0001; p.age = 0;
  return true;
}
