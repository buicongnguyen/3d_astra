import { SHOT_SCALE, CELL, STRETCH } from "./cells.js";
// The recipes that play the weapon VFX sprites (src/fx-sprites.js) for each weapon class (AAA round 3, R3-FX). Each one returns
// true when it drew (the sprites have loaded) so the caller can skip the procedural fallback it replaces, and false when they
// have not (or never will): the old effects then run as before. View only; sizes in metres, never smaller than `px` CSS pixels.
import { OCCLUDED, ORIENTED } from "../fx-sprites.js";
import { IMPACT_SHEET, impactSize, readable, SHEETS, MUZZLE_ROW, TRACER_FRAMES, HEAD_FRAME } from "../fx-sprites-data.js";

const IMPACT_PX = 54;      // an impact cell is never smaller than this on screen (a tank shell's blast reads at 24-64 px)
const MIN_PX = { shell: 54, rocket: 54, artillery: 72, bomb: 80, firebomb: 70, missile: 46, flak: 44, beam: 40 };

// The four fireball sheets (VFX2) have their own palettes; only the firebomb is shaded (yellower) and flak greyed.
const TINT = { firebomb: [1, 0.92, 0.6], flak: [0.8, 0.8, 0.85] };
const upp = (fx) => fx.view.unitsPerPixel || 0.1;
// Rounds keep the full painted VFX2 look at a fixed thin screen size: the bullet core is 2.25 CSS px, a shell or rocket body 2.5 px
// (its art fills about a quarter of the cell height), whatever the zoom.
export const TRACER_MIN_PX = 4, TRACER_LENGTH_PX = 34, TRACER_ALPHA = 0.95, HEAD_CELL_PX = 20, HEAD_LENGTH_PX = 30;
// Two fainter copies follow each bullet, so it reads as a moving streak; phones keep one.
// A streak starts with its tail at the muzzle and ends with its nose on the target, so it shows the true attack distance.
function fitFlight(p, size, from, to, ux, uy, uz) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1, half = Math.min(p.sx * size, dist) / 2, k = (dist - 2 * half) / dist;
  p.x = from.x + ux * half; p.y = from.y + uy * half; p.z = from.z + uz * half;
  p.vx *= k; p.vy *= k; p.vz *= k;
  return { x: p.x, y: p.y, z: p.z };
}
function tracerTrail(fx, p, size, anchor, from, ux, uy, uz, delay) {
  p.r = (p.r ?? 1) * 2; p.g = (p.g ?? 1) * 2; p.b = (p.b ?? 1) * 1.25; // lifts the painted streak to a bright, slightly orange gold
  for (let k = 1, n = fx.view.lowPower ? 1 : 2; k <= n; k++) {
    const t = fx.sprites.take("tracer", from.x, from.y, from.z, size, anchor, true);
    if (!t) break;
    t.mode = ORIENTED; t.ax = ux; t.ay = uy; t.az = uz; t.vx = p.vx; t.vy = p.vy; t.vz = p.vz; t.start = p.start; t.count = 4; t.loop = true; t.fps = 20;
    t.life = p.life; t.age = -delay - k * 0.035; t.fade = 0.2; t.sx = p.sx; t.sy = p.sy; t.r = p.r; t.g = p.g; t.b = p.b; t.a = k === 1 ? 0.5 : 0.28; t.snap = true;
  }
}
// A bright additive core rides on every bullet, so a short flight is still seen as a hot streak.
const BULLET_CORE_PX = 7, BULLET_CORE_LENGTH_PX = 36;
function bulletCore(fx, from, p, ux, uy, uz, anchor, delay, color) {
  const u = upp(fx), w = BULLET_CORE_PX * u, c = color ? [Math.min(1, .7 + color[0]), Math.min(1, .7 + color[1]), Math.min(1, .7 + color[2]), 1] : [1, .82, .42, 1];
  fx.particle(fx.glow, { lifted: true, x: from.x, y: from.y, z: from.z, vx: p.vx, vy: p.vy, vz: p.vz, mode: STRETCH, ax: ux, ay: uy, az: uz, length: Math.min(BULLET_CORE_LENGTH_PX * u, p.shotLength), s0: w, s1: w, life: p.life, cell: CELL.streak, c0: c, c1: c, anchor, delay });
}
export const spritesReady = (fx) => !!(fx.sprites && fx.sprites.ready);

// A blast of `kind` (shell | rocket | artillery | bomb | flak | beam) at `at` (y above the ground), starting after `delay` seconds.
export function spriteImpact(fx, kind, at, power, anchor, delay = 0, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const heavy = ['shell', 'walker', 'rocket', 'artillery', 'bomb', 'firebomb'].includes(kind);
  const sheet = IMPACT_SHEET[kind];
  if (!sheet) return false;
  const uncappedSize = readable(impactSize(kind, power) * scale, MIN_PX[kind] || IMPACT_PX, upp(fx)) * (heavy && kind !== "walker" ? 1.5 : 1) * SHOT_SCALE;
  const width = anchor?.targetWidth;
  const maxWidths = anchor?.direct || kind === "beam" ? 0.5 : kind === "flak" ? 1.1 : 2;
  const size = width ? Math.min(uncappedSize, width * maxWidths) : uncappedSize;
  const p = sprites.take(sheet, at.x, at.y, at.z, size, anchor, false);
  if (!p) return false;
  if (heavy) {
    p.mode = OCCLUDED; // Hulls and troops in front retain their silhouettes.
    p.a = 0.8;
    p.splash = true;
    p.rot = (fx.rng() - 0.5) * 0.8;
    p.fps = 50; // Three bright poses within 60 ms, cooling into smoke by 160 ms.
  }
  if (kind === "missile" && anchor?.direct) {
    // A guided hit on one flyer uses only the small painted spark at contact.
    p.count = 4;
    p.fps = 80;
    p.priorityHit = true;
    p.a = fx.allowFlash() ? 0.8 : 0.35;
    p.life = 0.05;
    return true;
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
  const size = readable(2.7 * scale, 30, upp(fx)) * SHOT_SCALE;
  const inlet = SHEETS.muzzle.inlet, back = (0.5 - inlet) * size;
  const p = sprites.take("muzzle", from.x + ux * back, from.y + uy * back, from.z + uz * back, size, anchor, true);
  if (!p) return false;
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.start = (MUZZLE_ROW[row] ?? 1) * 4; p.count = 4; p.life = 0.05; p.fps = 80;
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
  // The painted tongue runs from the muzzle to the target, so the fire always matches the real attack distance.
  const inlet = SHEETS.flame.inlet, size = Math.max(0.8, reach / (0.95 - inlet)), back = (0.5 - inlet) * size;
  const thick = Math.min(1.25, Math.max(0.55, reach * 0.34, 14 * upp(fx)));
  const p = sprites.take("flame", from.x + ux * back, from.y + uy * back, from.z + uz * back, size, anchor, true);
  if (!p) return false;
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.sy = thick / (size * 0.6); p.life = life; p.age = -delay; p.fade = 0.3; p.a = 0.95;
  return true;
}

// A small red fire tongue at a gun's muzzle for one round (the Bulwark): stopping short of its target, gone in 0.1 s.
export function spriteFlameFlick(fx, from, ux, uy, uz, anchor, delay = 0, dist = 2) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  const size = Math.min(1.5, Math.max(0.8, dist * 0.9)), back = (0.5 - SHEETS.flame.inlet) * size;
  const p = sprites.take("flame", from.x + ux * back, from.y + uy * back, from.z + uz * back, size, anchor, true);
  if (!p) return false;
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.sy = 0.7; p.start = 5; p.count = 4; p.loop = true; p.snap = true; p.fps = 40; p.life = 0.1; p.age = -delay; p.fade = 0.45; p.a = 1;
  p.r = 1.35; p.g = 0.36; p.b = 0.18;
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
// the hit spark where it lands, exactly `travel` seconds later. The live dimensions are quartered after the screen-space floor.
export function spriteTracer(fx, from, to, ux, uy, uz, travel, anchor, cyan = false, delay = 0, dimensions = null) {
  const sprites = fx.sprites;
  if (!sprites?.ready || !fx.motion) return false;
  const size = Math.max(6, 100 * upp(fx)) * SHOT_SCALE, sheet = SHEETS.tracer;
  const shotLength = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) * 0.7; // a round never looks longer than its flight
  const p = sprites.take("tracer", from.x, from.y, from.z, size, anchor, true);
  if (!p) return false;
  const life = Math.max(0.06, travel);
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.vx = (to.x - from.x) / life; p.vy = (to.y - from.y) / life; p.vz = (to.z - from.z) / life;
  p.start = cyan ? TRACER_FRAMES.cyan : TRACER_FRAMES.warm; p.count = 4; p.loop = true; p.fps = 20; p.life = life; p.age = -delay; p.fade = 0.08; p.sx = Math.min(TRACER_LENGTH_PX * upp(fx), shotLength) / size; p.sy = TRACER_MIN_PX * upp(fx) / (size * 0.15); p.a = TRACER_ALPHA; p.snap = true; p.shotLength = shotLength;
  if (dimensions) {
    // Specialised weapons used a shorter procedural round in Round A.
    p.sx = Math.min(Math.max(dimensions.length * SHOT_SCALE, TRACER_LENGTH_PX * upp(fx)), shotLength) / size;
    // In the weapon's own colour (lifted so dark tints still read).
    if (dimensions.color) { p.r = Math.min(1, 0.25 + dimensions.color[0]); p.g = Math.min(1, 0.25 + dimensions.color[1]); p.b = Math.min(1, 0.25 + dimensions.color[2]); }
    const start = fitFlight(p, size, from, to, ux, uy, uz);
    tracerTrail(fx, p, size, anchor, start, ux, uy, uz, delay);
    bulletCore(fx, start, p, ux, uy, uz, anchor, delay, dimensions.color);
    return true;
  }
  const start = fitFlight(p, size, from, to, ux, uy, uz);
  tracerTrail(fx, p, size, anchor, start, ux, uy, uz, delay);
  bulletCore(fx, start, p, ux, uy, uz, anchor, delay);
  // The muzzle spark sits at (0.23, 0.5) of its cell.
  if (!fx.allowFlash()) return true;
  const back = (0.5 - sheet.muzzleAt) * size;
  const m = sprites.take("tracer", from.x + ux * back, from.y + uy * back, from.z + uz * back, size * 0.8, anchor, true);
  if (m) { m.a = SHOT_SCALE; m.mode = ORIENTED; m.ax = ux; m.ay = uy; m.az = uz; m.start = TRACER_FRAMES.muzzle; m.count = 4; m.age = -delay; m.fps = 80; m.life = 0.05; }
  return true;
}

// The warm hit spark of a rifle round (the tracer sheet), centred on `at` (y above the ground).
export function spriteSpark(fx, at, anchor, delay = 0, scale = 1) {
  if (!fx.sprites?.ready) return false;
  const size = Math.min(Math.max(4.4,90*upp(fx))*SHOT_SCALE*scale, (anchor?.targetWidth || 3)*.5);
  const p = fx.sprites.take("tracer",at.x,at.y,at.z,size,anchor,false);
  if (!p) return false;
  p.a = fx.allowFlash() ? .8 : .35;
  p.priorityHit = true;
  p.start = TRACER_FRAMES.hit; p.count = 4; p.fps = 80; p.life = .05; p.age = -delay;
  return true;
}

export function spriteSupport(fx, from, to, dir, len, anchor, tint, repair) {
  if (!fx.sprites?.ready || !fx.motion) return false;
  const strip = repair ? "beamCyan" : "healBeam";
  const line = fx.sprites.take(strip,(from.x+to.x)/2,(from.y+to.y)/2,(from.z+to.z)/2,1,anchor,true);
  if (!line) return false;
  line.mode=ORIENTED; line.ax=dir.x/len; line.ay=dir.y/len; line.az=dir.z/len;
  line.sx=len; line.sy=Math.min(.16,anchor.targetWidth*.15,Math.max(.9,24*upp(fx))*SHOT_SCALE);
  line.tiles=Math.max(1,len/(8*line.sy)); line.scrollSpeed=-1.4; line.life=.34;
  line.a=.55; line.r=tint[0]; line.g=tint[1]; line.b=tint[2];
  if (!repair) {
    const size=Math.min(anchor.targetWidth*.72,readable(3.6,70,upp(fx))*SHOT_SCALE);
    const mark=fx.sprites.take("heal",to.x,to.y+.3,to.z,size,anchor,true);
    if(mark){mark.life=.34;mark.a=.45;mark.fade=.45;}
  }
  return true;
}

// A beam line: the seamless strip tiled along from -> to with a start cap and an end flare, from `delay` for `life` seconds.
// `kind` is "cyan" (Stalker, Shade) or "magenta" (rail). Beam width is measured in world metres.
export function spriteBeamLine(fx, from, to, ux, uy, uz, kind, width, life, anchor, delay, tint = null) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) || 1, w = Math.max(width,20 * upp(fx)) * SHOT_SCALE;
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
  const size = readable(8 * scale,90,upp(fx)) * SHOT_SCALE;
  const p = sprites.take("stomp", at.x, at.y, at.z, size, anchor, false);
  return !!p;
}

// The head of a round in flight (shell, rocket or missile art, pointing along its heading), drawn this frame only.
export function spriteHead(fx, kind, x, y, z, ux, uy, uz, size, anchor, scale = 1) {
  const sprites = fx.sprites;
  if (!sprites?.ready) return false;
  const cell = HEAD_CELL_PX * scale * upp(fx);
  const p = sprites.take("heads", x, y, z, cell, anchor, true);
  if (!p) return false;
  p.sx = HEAD_LENGTH_PX / HEAD_CELL_PX; p.r = 1.8; p.g = 1.05; p.b = 0.55; // a hot orange round
  p.mode = ORIENTED; p.ax = ux; p.ay = uy; p.az = uz; p.a = TRACER_ALPHA; p.start = HEAD_FRAME[kind] ?? 0; p.count = 1; p.fps = 0; p.once = true; p.life = 1; p.fade = 0.0001; p.age = 0;
  return true;
}
