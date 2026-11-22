// Shade (and the Stalker, longer and thinner): a beam from muzzle to target and a spark where it ends.
// R3-X: a short charge glow gathers at the muzzle for the shot's flight time (visual-style.json `life`), then the
// bright line snaps out to the target exactly when the hit lands (the target's hit flash waits that long), and
// fades from the muzzle forward (beamLine). Everything from the glow pool, through the allocation-free emit path.
import { CELL, STRETCH } from "./cells.js";
import { glow, sparks, fade } from "./common.js";
import { spriteBeamImpact, spriteBeamLine } from "./sprite-fx.js";

const HOT = [1, 1, 1, 1], HOT_DIM = [1, 1, 1, 0.4];
export const BEAM_SEGMENTS = 5;

// The charge: a glow that swells at the muzzle over `charge` seconds, a hot core inside it.
export function chargeGlow(fx, rng, from, c0, charge, anchor, size = 1) {
  const life = Math.max(0.04, charge);
  const g = fx.emit(fx.glow, from.x, from.y, from.z, anchor, true);
  g.s0 = 0.15 * size; g.s1 = 1.1 * size; g.life = life; g.c0 = fade(c0, 0.35); g.c1 = fade(c0, 0.95); g.rot = rng() * 6.28;
  const core = fx.emit(fx.glow, from.x, from.y, from.z, anchor, true);
  core.cell = CELL.flare; core.s0 = 0.1 * size; core.s1 = 0.7 * size; core.life = life; core.c0 = HOT_DIM; core.c1 = HOT; core.rot = rng() * 6.28;
}

// The line: BEAM_SEGMENTS stretched quads from the muzzle to the target, all lit at `delay`; the one at the muzzle
// fades first and the one at the target last, so the beam drains away from the muzzle forward.
export function beamLine(fx, rng, a, c0, width, life, delay) {
  const { from, to, ux, uy, uz, len, anchor } = a, seg = len / BEAM_SEGMENTS, c1 = fade(c0);
  for (let i = 0; i < BEAM_SEGMENTS; i++) {
    const k = (i + 0.5) / BEAM_SEGMENTS, p = fx.emit(fx.glow, from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k, anchor, true);
    p.mode = STRETCH; p.ax = ux; p.ay = uy; p.az = uz; p.length = seg * 1.04; p.cell = CELL.glow; p.s0 = width; p.s1 = width * 0.5;
    p.life = life * (0.45 + 0.55 * (i + 1) / BEAM_SEGMENTS); p.hold = 0.25; p.c0 = c0; p.c1 = c1; p.age = -delay; p.rot = rng() * 6.28;
  }
}

export default {
  id: "beam",
  spawn(fx, ev, rng, a) {
    const { to, anchor, style, travel } = a;
    const life = style.beamLife ?? 0.12, width = style.beamWidth ?? 0.2, c0 = a.color;
    chargeGlow(fx, rng, a.from, c0, travel, anchor, 0.9);
    // A hot white core over a coloured sheath.
    // R3-FX2: the cyan beam-line strip tiled along the ray with a start cap and an end flare (the procedural line is the fallback).
    if (!spriteBeamLine(fx, a.from, a.to, a.ux, a.uy, a.uz, "cyan", Math.max(width * 4, 1.1), Math.max(life, 0.28), anchor, travel)) {
      beamLine(fx, rng, a, HOT, width * 0.45, life, travel);
      beamLine(fx, rng, a, c0, width, life, travel);
    }
    // R3-FX: the beam-impact sheet (cyan-white flare and needle sparks) at the target, at the exact hit time.
    spriteBeamImpact(fx, { x: to.x, y: to.y - fx.ground(to.x, to.z), z: to.z }, c0, anchor, travel);
    glow(fx, to, 0.9, [c0[0], c0[1], c0[2], 0.7], 0.14, anchor, travel);
    sparks(fx, rng, to, 3, anchor, 0.5, HOT, fade(c0), travel);
  },
};
