// Scorcher: a cone of flame puffs and embers sprayed at the target, a scorch where it lands.
import { CELL, STRETCH } from "./cells.js";
import { flare, glow, smokePuff, sparks, onLand } from "./common.js";
import { spriteJet, spritesReady } from "./sprite-fx.js";

const FLAME = [1, 0.72, 0.24, 0.95], FLAME_END = [0.7, 0.14, 0.04, 0], EMBER = [1, 0.7, 0.3, 1], EMBER_END = [1, 0.3, 0.05, 0], CORE = [1, 0.95, 0.75, 0.9];
export default {
  id: "flame",
  spawn(fx, ev, rng, a) {
    const { from, ux, uy, uz, sx, sz, anchor, len, travel } = a;
    flare(fx, from, 1.1, [1, 0.8, 0.4, 0.9], 0.1, anchor);
    const speed = Math.max(4, len / Math.max(0.12, travel * 1.6));
    // R3-FX: the flame-jet sheet loops along the cone for the whole burst (muzzle inlet at the nozzle); the procedural tongue and puffs stay, fewer.
    const jet = spriteJet(fx, from, ux, uy, uz, Math.min(len, 3.6), 0.7 + travel * 0.5, anchor);
    for (let i = 0, n = fx.count(jet ? 4 : 8); i < n; i++) {
      const spread = (rng() - 0.5) * 0.55, v = speed * (0.7 + rng() * 0.5);
      fx.particle(fx.glow, { lifted: true, x: from.x, y: from.y, z: from.z, vx: (ux + sx * spread) * v, vy: uy * v + (rng() - 0.5) * 0.8, vz: (uz + sz * spread) * v,
        drag: 1.6, life: 0.26 + rng() * 0.16, s0: 0.22, s1: 0.8 + rng() * 0.5, c0: FLAME, c1: FLAME_END, anchor, delay: i * 0.018, spin: (rng() - 0.5) * 2, rot: rng() * 6.28 });
    }
    for (let i = 0, n = fx.count(3); i < n; i++)
      fx.particle(fx.glow, { lifted: true, x: from.x, y: from.y, z: from.z, vx: (ux + (rng() - 0.5) * 0.5) * speed * 0.6, vy: 1.5 + rng() * 1.5, vz: (uz + (rng() - 0.5) * 0.5) * speed * 0.6,
        gravity: 4, drag: 1, life: 0.5 + rng() * 0.3, s0: 0.1, s1: 0.02, cell: CELL.flare, c0: EMBER, c1: EMBER_END, anchor, delay: i * 0.05, rot: rng() * 6.28 });
    smokePuff(fx, rng, from, ux * 1.2, uz * 1.2, anchor, 1.3, [0.18, 0.17, 0.16, 0.45], 0.8, 0.12);
    // R3-X: the cone's hot core, a tongue of flame that widens as it reaches out (two stretched glow quads), and a
    // few more embers drifting up out of it.
    const reach = Math.min(len, 3.6);
    for (const [w, col, life] of [[0.5, CORE, 0.16], [1.1, FLAME, 0.22]]) {
      const p = fx.emit(fx.glow, from.x + ux * reach * 0.5, from.y + uy * reach * 0.5, from.z + uz * reach * 0.5, anchor, true);
      p.mode = STRETCH; p.ax = ux; p.ay = uy; p.az = uz; p.length = reach; p.cell = CELL.streak; p.s0 = w * 0.4; p.s1 = w; p.life = life; p.c0 = col; p.c1 = FLAME_END; p.rot = rng() * 6.28;
    }
    for (let i = 0, n = fx.count(3); i < n; i++) {
      const k = 0.3 + rng() * 0.6, p = fx.emit(fx.glow, from.x + ux * reach * k, from.y + uy * reach * k, from.z + uz * reach * k, anchor, true);
      p.vx = (rng() - 0.5) * 0.8; p.vy = 1.2 + rng() * 1.2; p.vz = (rng() - 0.5) * 0.8; p.drag = 0.8; p.life = 0.7 + rng() * 0.4; p.s0 = 0.12; p.s1 = 0.03;
      p.cell = CELL.flare; p.c0 = EMBER; p.c1 = EMBER_END; p.age = -0.05 - i * 0.04;
    }
    // The landing as the hit lands (the target's hit flash waits `travel`).
    onLand(fx, a, () => {
      glow(fx, a.to, 1.6, [1, 0.6, 0.2, 0.8], 0.25, anchor);
      sparks(fx, rng, a.to, 3, anchor, 0.45, EMBER, EMBER_END);
      fx.scorch(a.land, 1.3, anchor);
    });
  },
};
