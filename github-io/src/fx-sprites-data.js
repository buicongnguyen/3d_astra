// Weapon VFX sprite sheets (AAA round 3, R3-FX): the data and the pure maths, no three.js.
// VFX sprite sheets: Codex/OpenAI, owner-commissioned (public/fx, packed by tools/pack-fx-atlas.py).
// All eleven 4x4 sheets live in ONE atlas (3 sheets across, 4 down), so a whole battle's sprites need one texture and
// two instanced draws (one per blend mode). Order and grid must match tools/pack-fx-atlas.py.
export const GRID_COLS = 3, GRID_ROWS = 4, CELLS_PER_SIDE = 4;
export const SHEET_NAMES = ["tank", "rocket", "artillery", "flak", "flame", "beam", "heal", "bomb", "smoke", "scorch", "muzzle"];
// frames and fps from codex-vfx/README.md; blend: "add" for bright sheets, "normal" for smoke, scorch and mixed fire/smoke blasts.
export const SHEETS = Object.freeze({
  tank: { index: 0, file: "tank-shell-impact", frames: 16, fps: 18, loop: false, blend: "normal" },
  rocket: { index: 1, file: "rocket-explosion", frames: 16, fps: 16, loop: false, blend: "normal" },
  artillery: { index: 2, file: "artillery-blast", frames: 16, fps: 14, loop: false, blend: "normal" },
  flak: { index: 3, file: "flak-burst", frames: 16, fps: 20, loop: false, blend: "normal" },
  flame: { index: 4, file: "flame-jet", frames: 8, fps: 16, loop: true, blend: "add", inlet: 0.09 },
  beam: { index: 5, file: "beam-impact", frames: 16, fps: 20, loop: false, blend: "add" },
  heal: { index: 6, file: "heal-sparkle", frames: 16, fps: 16, loop: true, blend: "normal" }, // normal, not additive: mint sparks must read on pale sand too,
  bomb: { index: 7, file: "air-bomb-blast", frames: 16, fps: 16, loop: false, blend: "normal" },
  smoke: { index: 8, file: "smoke-trail", frames: 4, fps: 12, loop: true, blend: "normal" },
  scorch: { index: 9, file: "scorch-decals", frames: 8, fps: 0, loop: false, blend: "normal" }, // frames 0-3 scorch marks, 4-7 craters
  muzzle: { index: 10, file: "muzzle-flash", frames: 12, fps: 20, loop: false, blend: "add", inlet: 0.12 }, // rows: small, medium, large
});
export const SCORCH_FRAMES = [0, 1, 2, 3], CRATER_FRAMES = [4, 5, 6, 7];
export const MUZZLE_ROW = Object.freeze({ small: 0, medium: 1, large: 2 });

// Which sheet a landing draws, by the weapon class (src/fx-kinds/weapon-class.js) of the round: the kinds src/fx.js hit() takes.
export const IMPACT_SHEET = Object.freeze({ shell: "tank", rocket: "rocket", artillery: "artillery", bomb: "bomb", firebomb: "bomb", flak: "flak", beam: "beam" });
// The weapon class -> impact kind (classes with no sprite impact map to nothing).
export const CLASS_IMPACT = Object.freeze({ shell: "shell", lob: "artillery", missile: "rocket", bomb: "bomb", flak: "flak", beam: "beam" });
export function impactKind(cls) { return CLASS_IMPACT[cls] || null; }
// Which sheet a class's flight/muzzle also uses: [muzzle row or null, trail?].
export const CLASS_FLIGHT = Object.freeze({
  shell: { muzzle: "large", trail: true }, lob: { muzzle: "large", trail: true }, missile: { muzzle: "medium", trail: true },
  flamer: { jet: true }, heal: { sparkle: true }, beam: { impact: true },
});

// Size of the whole cell in metres for one impact at hit power `power` (1 = a tank shell); the blast art fills about 70% of the cell.
export const IMPACT_SIZE = Object.freeze({ shell: 11, rocket: 10.5, artillery: 12.5, bomb: 14, firebomb: 12, flak: 8.5, beam: 8 });
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
