// Ability moments (AAA round 2, W2-E), drawn on top of the ability flash of src/fx.js `ability`:
//   moment(fx, e, rng, tint, anchor)      e is the ability event (x, z, tx, tz, radius ...)
// Brace shockwave, Rush and Ram dust wake, Overdrive exhaust, Crossfire muzzle storm, Steady aim glint,
// and the decloak shimmer (the `reveal` event, `shimmer` below). Pooled particles only, random numbers from `rng`.
import { CELL } from "./cells.js";
import { flare, ring, sparks, fade } from "./common.js";

const dustAt = (fx, rng, x, z, anchor, size, n = 1) => { for (let i = 0; i < n; i++) fx.dust({ x: x + (rng() - 0.5) * 0.8, y: 0.25, z: z + (rng() - 0.5) * 0.8 }, 1, anchor, size, 0.9); };

export const MOMENTS = {
  // Brace: the legs lock, a ground shockwave rolls out and a ring of dust lifts with it.
  brace(fx, e, rng, tint, anchor) {
    fx.decal({ x: e.x, z: e.z }, (e.radius || 3) * 3.4, 0.55, anchor, CELL.ring, [1, 0.9, 0.7, 0.8], fx.glow, 1, { hold: 0, y: 0.12 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; dustAt(fx, rng, e.x + Math.cos(a) * 1.6, e.z + Math.sin(a) * 1.6, anchor, 1.1); }
  },
  // Rush and Ram: a wake of dust, streaming behind the unit (the event has no heading: it puffs around the feet in a low arc).
  rush(fx, e, rng, tint, anchor) { dustAt(fx, rng, e.x, e.z, anchor, 1, 4); sparks(fx, rng, { x: e.x, y: 0.4, z: e.z }, 3, anchor, 0.5, [1, 0.8, 0.5, 1], [1, 0.5, 0.2, 0]); },
  ram(fx, e, rng, tint, anchor) { dustAt(fx, rng, e.x, e.z, anchor, 1.4, 5); },
  dash(fx, e, rng, tint, anchor) { dustAt(fx, rng, e.x, e.z, anchor, 0.8, 3); },
  // Overdrive: exhaust blasts from the back of the hull, a burst of orange sparks and dark smoke.
  overdrive(fx, e, rng, tint, anchor) {
    for (let i = 0; i < fx.count(4); i++)
      fx.particle(fx.smoke, { x: e.x + (rng() - 0.5), y: 1.3, z: e.z + (rng() - 0.5), vy: 1.2 + rng(), vx: (rng() - 0.5) * 0.8, vz: (rng() - 0.5) * 0.8, drag: 1.2, life: 0.8 + rng() * 0.3, s0: 0.3, s1: 1.4,
        cell: CELL.puff, c0: [0.14, 0.13, 0.13, 0.6], c1: [0.3, 0.29, 0.28, 0], anchor, spin: (rng() - 0.5), rot: rng() * 6.28, delay: i * 0.05 });
    sparks(fx, rng, { x: e.x, y: 1.2, z: e.z }, 6, anchor, 0.8, [1, 0.7, 0.3, 1], [1, 0.3, 0.05, 0]);
  },
  // Crossfire: a muzzle storm, a ring of flares flashing around the gun team.
  crossfire(fx, e, rng, tint, anchor) {
    for (let i = 0, n = fx.count(8); i < n; i++) {
      const a = i / n * Math.PI * 2 + rng() * 0.4;
      flare(fx, { x: e.x + Math.cos(a) * 0.9, y: 1.1 + rng() * 0.3, z: e.z + Math.sin(a) * 0.9 }, 0.55, [tint[0], tint[1], tint[2], 0.95], 0.12, anchor, i * 0.025);
    }
  },
  // Steady aim: a small cold glint at the Stalker's eye and a thin ring.
  steadyaim(fx, e, rng, tint, anchor) {
    flare(fx, { x: e.x, y: 1.5, z: e.z }, 1.1, [1, 0.95, 1, 1], 0.3, anchor);
    ring(fx, { x: e.x, y: 1.5, z: e.z }, 0.3, 1.4, [tint[0], tint[1], tint[2], 0.8], 0.4, anchor);
  },
};
// Decloak: a shimmer rising from the revealed unit, pale violet sheets that fade as they lift.
export function shimmer(fx, e, rng, tint, anchor) {
  for (let i = 0, n = fx.count(5); i < n; i++)
    fx.particle(fx.glow, { x: e.x + (rng() - 0.5) * 0.9, y: 0.2, z: e.z + (rng() - 0.5) * 0.9, vy: 2.2 + rng(), drag: 1.1, life: 0.55 + rng() * 0.2, s0: 0.5, s1: 0.2,
      cell: CELL.glow, c0: [tint[0], tint[1], tint[2], 0.5], c1: fade([tint[0], tint[1], tint[2]]), anchor, delay: i * 0.05, rot: rng() * 6.28 });
}
