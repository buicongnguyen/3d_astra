// Shared pieces of the signature shots (V4, 2026-11-26): the data, the faction palettes as ready colour arrays, sizes by what
// the player sees (with CSS-pixel floors) and a few pooled-particle helpers. Everything draws from the existing effect pools
// (src/fx.js glow, smoke and decals; the sprite batches of src/fx-sprites.js only when the optional Codex sheets are packed):
// no new draw call. Random numbers only through fx.rng (the per-match seeded generator).
//
// Two layers make each energy shape: a BODY drawn normal-blended (the smoke pool) in the faction colour, whose signature cell
// carries a dark rim (signature-cells.js), so the shape stays a solid outlined colour on snow, sand and lava; and a GLOW drawn
// additively (the glow pool) on top, which is the light on dark ground. On a phone both pools are one draw (src/fx.js phoneBatch).
import DATA from "./signature-shots.json" with { type: "json" };
import { CELL, STRETCH } from "./cells.js";
import { SIGNATURE_CELLS } from "./signature-cells.js";
import { SHEETS } from "../fx-sprites-data.js";

export { DATA };
const freeze = (c, a) => Object.freeze([c[0], c[1], c[2], a]);
// Per faction: `<key>` opaque, `<key>0` fully faded, `<key>Soft` half strength, `<key>Dim` faint, `<key>Solid` nearly opaque
// (shared arrays: pooled records only reference them).
export const PALETTES = Object.freeze(Object.fromEntries(Object.entries(DATA.palettes).map(([id, p]) => {
  const out = { id };
  for (const [key, c] of Object.entries(p)) {
    out[key] = freeze(c, 1); out[key + "0"] = freeze(c, 0); out[key + "Soft"] = freeze(c, 0.55); out[key + "Dim"] = freeze(c, 0.3); out[key + "Solid"] = freeze(c, 0.88);
  }
  // The dark underlay of a burst (normal blended).
  out.under = freeze(p.deep, 0.5); out.under0 = freeze(p.deep, 0);
  return [id, Object.freeze(out)];
})));

// How much of its cell's width a shape fills (visible diameter / quad width; for STRETCH cells the thickness).
export const FILL = Object.freeze({ glow: 0.42, puff: 0.8, ring: 0.8, streak: 0.3, flare: 0.5, band: 0.72,
  ...Object.fromEntries(SIGNATURE_CELLS.map((c) => [c.name, c.fill ?? 0.8])) });
// A size the player sees, in metres, never smaller than its CSS-pixel floor: `pair` is [metres, px]
// (src/fx-sprites-data.js `readable`); `quad` turns a visible size into the size of `cell`'s quad.
export const size = (fx, pair, k = 1) => Math.max(pair[0], pair[1] * (fx.view.unitsPerPixel || 0)) * k;
export const quad = (cell, visible) => visible / FILL[cell];

// The Codex flipbooks (codex-vfx3, docs/ASSET_PIPELINE.md): a look's sheet (or its impact, `<key>Hit`) when the atlas carries it
// and has loaded, else null (the procedural cells draw it). `SHEET` holds each sheet's placement data (head, ball, attach, rows).
export const SHEET = DATA.sheets;
export function sheet(fx, key) {
  if (!key || !fx.sprites?.ready || fx.sprites.failed) return null;
  return SHEETS[key] ? key : null;
}

// A pooled record at a world point (y includes the ground): the allocation-free path (src/fx.js emit).
export function put(fx, layer, x, y, z, anchor) { return fx.emit(layer, x, y, z, anchor, true); }

// A billboard of `cell` at a world point growing from visible size `v0` to `v1` over `life` s, starting `delay` s late.
export function shape(fx, layer, at, cell, v0, v1, life, c0, c1, anchor, delay = 0) {
  const p = put(fx, layer, at.x, at.y, at.z, anchor), name = cellName(cell);
  p.cell = cell; p.s0 = quad(name, v0); p.s1 = quad(name, v1); p.life = life; p.c0 = c0; p.c1 = c1; p.age = -delay; p.rot = fx.rng() * 6.28;
  return p;
}
const NAMES = Object.entries(CELL).reduce((a, [name, i]) => { a[i] = name; return a; }, []);
export const cellName = (cell) => NAMES[cell];

// A streak of `cell` flying from `a` to `b` (world points) in `flight` s, `length` m long and `thick` m thick (visible), `delay` s
// late: it starts with its tail at `a` and ends with its nose on `b` (never longer than the path).
export function flyStreak(fx, layer, a, b, flight, length, thick, cell, c0, c1, anchor, delay = 0) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, dist = Math.hypot(dx, dy, dz) || 1, ux = dx / dist, uy = dy / dist, uz = dz / dist;
  const len = Math.min(length, dist * 0.9), half = len / 2, k = (dist - len) / dist;
  const p = put(fx, layer, a.x + ux * half, a.y + uy * half, a.z + uz * half, anchor);
  p.vx = dx * k / flight; p.vy = dy * k / flight; p.vz = dz * k / flight; p.life = flight; p.age = -delay;
  p.mode = STRETCH; p.ax = ux; p.ay = uy; p.az = uz; p.length = len; p.cell = cell; p.s0 = p.s1 = quad(cellName(cell), thick); p.c0 = c0; p.c1 = c1; p.rot = 0;
  return p;
}
// A billboard of visible size `v` flying from `a` to `b` in `flight` s, `lead` m ahead of `a` at the start (a dart's head).
export function flyPoint(fx, layer, a, b, flight, v, cell, c0, c1, anchor, delay = 0, lead = 0) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, dist = Math.hypot(dx, dy, dz) || 1, k = Math.max(0, dist - lead) / dist;
  const p = put(fx, layer, a.x + dx / dist * lead, a.y + dy / dist * lead, a.z + dz / dist * lead, anchor);
  p.vx = dx * k / flight; p.vy = dy * k / flight; p.vz = dz * k / flight; p.life = flight; p.age = -delay;
  p.cell = cell; p.s0 = p.s1 = quad(cellName(cell), v); p.c0 = c0; p.c1 = c1; p.rot = fx.rng() * 6.28;
  return p;
}
// Sparks thrown from a world point: stretched streaks with gravity (additive).
export function sparksAt(fx, at, n, anchor, power, c0, c1, delay = 0, gravity = 14) {
  for (let i = 0, count = fx.count(n); i < count; i++) {
    const a = fx.rng() * 6.28, e = 0.3 + fx.rng() * 0.7, v = (4 + fx.rng() * 5) * power;
    const vx = Math.cos(a) * e * v, vy = (0.4 + fx.rng()) * v * 0.7, vz = Math.sin(a) * e * v, l = Math.hypot(vx, vy, vz) || 1;
    const p = put(fx, fx.glow, at.x, at.y, at.z, anchor);
    p.vx = vx; p.vy = vy; p.vz = vz; p.gravity = gravity; p.drag = 1.5; p.life = 0.2 + fx.rng() * 0.22; p.mode = STRETCH; p.ax = vx / l; p.ay = vy / l; p.az = vz / l;
    p.length = 0.34 * power; p.s0 = 0.08; p.s1 = 0.04; p.cell = CELL.streak; p.c0 = c0; p.c1 = c1; p.floor = fx.ground(at.x, at.z) + 0.05; p.age = -delay;
  }
}
// Runs `fn` `delay` s from now (the landing of a round).
export function later(fx, delay, fn) { fx.timeline.push({ at: fx.time + delay, run: fn }); }
