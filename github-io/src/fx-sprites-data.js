// Weapon VFX sprite sheets (AAA round 3, R3-FX): the data and the pure maths, no three.js.
// VFX sprite sheets: Codex/OpenAI, owner-commissioned (public/fx, packed by tools/pack-fx-atlas.py).
// All eleven 4x4 sheets live in ONE atlas (3 sheets across, 4 down), so a whole battle's sprites need one texture and
// two instanced draws (one per blend mode). Order and grid must match tools/pack-fx-atlas.py.
import LAYOUT from "./fx-atlas-layout.json" with { type: "json" };
export { LAYOUT };
// Frame rectangles (normalised to the atlas, y from the top) come from tools/pack-fx-atlas.py; both tiers share the UVs.
export const SHEET_NAMES = ["tank", "rocket", "artillery", "bomb", "missile", "tracer", "stomp", "heal", "flame", "flak", "beam", "muzzle", "scorch", "smoke", "beamCyan", "beamMagenta", "healBeam", "capCyan", "endCyan", "capMagenta", "endMagenta", "heads"];
// frames and fps from codex-vfx/README.md and codex-vfx2/README.md; blend: "add" only where the README asks for a glow, else normal alpha
// (dark contours read on sand and grass). `strip` sheets are one seamless 8:1 strip that repeats along a ray.
const S = (name, fps, loop, blend = "normal", extra = {}) => ({ name, ...LAYOUT.items[name], file: name, frames: LAYOUT.items[name].count, fps, loop, blend, ...extra });
export const SHEETS = Object.freeze({
  tank: S("tank", 20, false), rocket: S("rocket", 16, false), artillery: S("artillery", 14, false), bomb: S("bomb", 16, false),
  missile: S("missile", 20, false), flak: S("flak", 20, false), flame: S("flame", 16, true, "normal", { inlet: 0.07 }),
  beam: S("beam", 20, false, "add"), heal: S("heal", 16, true), smoke: S("smoke", 12, true), scorch: S("scorch", 0, false),
  muzzle: S("muzzle", 20, false, "add", { inlet: 0.12 }), stomp: S("stomp", 16, false),
  // tracer-streak: 0-3 warm streak, 4-7 cyan streak (cycled while travelling), 8-11 muzzle spark, 12-15 hit spark.
  tracer: S("tracer", 20, false, "normal", { muzzleAt: 0.23 }),
  beamCyan: S("beamCyan", 0, true, "normal", { strip: true }), beamMagenta: S("beamMagenta", 0, true, "normal", { strip: true }), healBeam: S("healBeam", 0, true, "normal", { strip: true }),
  capCyan: S("capCyan", 16, true), endCyan: S("endCyan", 16, true), capMagenta: S("capMagenta", 16, true), endMagenta: S("endMagenta", 16, true),
  heads: S("heads", 0, false),
});
export const SCORCH_FRAMES = [0, 1, 2, 3], CRATER_FRAMES = [4, 5, 6, 7];
export const MUZZLE_ROW = Object.freeze({ small: 0, medium: 1, large: 2 });
export const TRACER_FRAMES = Object.freeze({ warm: 0, cyan: 4, muzzle: 8, hit: 12 });
export const HEAD_FRAME = Object.freeze({ shell: 0, rocket: 1, missile: 2 });

// Which sheet a landing draws, by the weapon class (src/fx-kinds/weapon-class.js) of the round: the kinds src/fx.js hit() takes.
export const IMPACT_SHEET = Object.freeze({ shell: "rocket", rocket: "rocket", artillery: "artillery", bomb: "artillery", firebomb: "rocket", missile: "flak", walker: "artillery", flak: "flak", beam: "beam" });
// The weapon class -> impact kind (classes with no sprite impact map to nothing).
export const CLASS_IMPACT = Object.freeze({ shell: "shell", lob: "artillery", missile: "rocket", bomb: "bomb", flak: "flak", beam: "beam" });
export function impactKind(cls) { return CLASS_IMPACT[cls] || null; }
// Which sheet a class's flight/muzzle also uses: [muzzle row or null, trail?].
export const CLASS_FLIGHT = Object.freeze({
  shell: { muzzle: "large", trail: true }, lob: { muzzle: "large", trail: true }, missile: { muzzle: "medium", trail: true },
  flamer: { jet: true }, heal: { sparkle: true }, beam: { impact: true },
});

// Size of the whole cell in metres for one impact at hit power `power` (1 = a tank shell); the blast art fills about 70% of the cell.
export const IMPACT_SIZE = Object.freeze({ shell: 11, walker: 12, rocket: 10.5, artillery: 10, bomb: 14, firebomb: 12, missile: 10, flak: 8.5, beam: 8 });
export function impactSize(kind, power = 1) { return (IMPACT_SIZE[kind] || 6) * (0.78 + 0.22 * Math.max(0.3, Math.min(1.6, power))); }

// The animation: which two frames to show (a, b) and how much of b, at `age` seconds. One-shots hold the last frame,
// loops wrap (b wraps to the first frame so the cycle cross-fades). `start` is the first frame, `count` how many.
// Writes into `out` ({a, b, mix}) and returns it: no allocation per sprite per frame.
export function frameAt(age, fps, start, count, loop, out, quant = 1) {
  const f = Math.max(0, age) * fps;
  if (count <= 1 || !(fps > 0)) { out.a = out.b = start; out.mix = 0; return out; }
  if (quant > 1) {
    const q = Math.floor(f / quant) * quant;
    out.a = start + Math.min(loop ? q % count : q, count - 1); out.b = out.a; out.mix = 0; return out;
  }
  if (loop) {
    const w = f % count, i = Math.floor(w);
    out.a = start + i; out.b = start + (i + 1) % count; out.mix = w - i; return out;
  }
  const w = Math.min(f, count - 1), i = Math.min(Math.floor(w), count - 1);
  out.a = start + i; out.b = start + Math.min(i + 1, count - 1); out.mix = w - i; return out;
}
// How long a one-shot of `count` frames at `fps` plays, seconds.
export const playTime = (count, fps) => count / Math.max(1e-6, fps);

// Sprite size never smaller than `px` CSS pixels (the camera is orthographic: world size = pixels x unitsPerPixel).
export const readable = (size, px, unitsPerPixel) => Math.max(size, px * (unitsPerPixel || 0));
// Decal cap and fade (pooled, flat on the ground).
export const DECAL = Object.freeze({ cap: 24, ecoCap: 12, life: 20, hold: 0.55, merge: 0.55 });
// Pool capacities (live caps scale with the quality budget).
export const POOL = Object.freeze({ normal: 220, add: 160 });
// Which atlas file a tier loads.
export const atlasFile = phone => (phone ? "fx-atlas-phone.webp" : "fx-atlas.webp");
export const cellPixels = phone => (phone ? 64 : 128);
export const atlasSize = phone => (phone ? [LAYOUT.width / 2, LAYOUT.height / 2] : [LAYOUT.width, LAYOUT.height]);
