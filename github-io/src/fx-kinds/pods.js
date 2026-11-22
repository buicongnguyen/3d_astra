// Hawk gunship (R3-X). At a flyer: two small glowing missiles leave the pods and corkscrew to the target on thin
// curling smoke ribbons, meeting it in a sharp air burst (src/fx-kinds/ordnance.js, the ordnance mesh: one draw
// for every round in flight). At the ground: a strafing run, a burst of tracers whose strikes walk up to the
// target, each kicking a dust spurt; the last lands on the target exactly when the hit does.
import { CELL, STRETCH } from "./cells.js";
import { flare, smokePuff } from "./common.js";
import { launch } from "./ordnance.js";
import { spriteImpact, spriteMuzzle } from "./sprite-fx.js";
import { CLASS_LOOK } from "./weapon-class.js";

const TRACER = [1, 0.9, 0.55, 1], TRACER_END = [1, 0.7, 0.35, 0.7], SPURT_FLASH = [1, 0.85, 0.5, 0.9], SPURT_END = [1, 0.5, 0.2, 0];

function missiles(fx, ev, rng, a) {
  const { from, ux, uz, anchor } = a;
  for (let i = 0, n = fx.count(2); i < n; i++) {
    const side = (i ? 1 : -1) * 0.32;
    flare(fx, { x: from.x + a.sx * side, y: from.y, z: from.z + a.sz * side }, 0.7, [1, 0.9, 0.7, 0.95], 0.07, anchor);
    smokePuff(fx, rng, { x: from.x + a.sx * side, y: from.y, z: from.z + a.sz * side }, -ux * 1.2, -uz * 1.2, anchor, 1.1, [0.6, 0.58, 0.55, 0.45], 0.6);
    // Opposite phases: the two ribbons braid around each other on the way in.
    launch(fx, "missile", a, ev, { side, phase: i ? Math.PI : 0 });
  }
}

function strafe(fx, ev, rng, a) {
  const { from, to, land, anchor, travel } = a, look = CLASS_LOOK.strafe;
  const n = Math.max(2, Math.round(look.rounds * (fx.view.lowPower ? 0.75 : 1))), gap = Math.min(look.gap, travel / (n + 1)), flight = travel - (n - 1) * gap;
  const dx = to.x - from.x, dz = to.z - from.z, h = Math.hypot(dx, dz) || 1, walk = Math.min(look.walk, h * 0.6);
  for (let i = 0; i < n; i++) {
    // Strike i lands `back` metres short of the target, on the line from the gunship; the last on the target.
    const back = walk * (1 - i / (n - 1)), delay = i * gap;
    const tx = to.x - (dx / h) * back + (rng() - 0.5) * 0.4, tz = to.z - (dz / h) * back + (rng() - 0.5) * 0.4, ty = i === n - 1 ? to.y : fx.ground(tx, tz) + 0.15;
    const vx = (tx - from.x) / flight, vy = (ty - from.y) / flight, vz = (tz - from.z) / flight, l = Math.hypot(vx, vy, vz) || 1;
    const m = fx.emit(fx.glow, from.x, from.y, from.z, anchor, true);
    m.cell = CELL.flare; m.s0 = 0.55; m.s1 = 0.65; m.life = 0.05; m.c0 = TRACER; m.c1 = SPURT_END; m.age = -delay;
    const p = fx.emit(fx.glow, from.x, from.y, from.z, anchor, true);
    p.vx = vx; p.vy = vy; p.vz = vz; p.mode = STRETCH; p.ax = vx / l; p.ay = vy / l; p.az = vz / l; p.length = Math.min(1.8, l * flight);
    p.s0 = p.s1 = 0.11; p.life = flight; p.cell = CELL.streak; p.c0 = a.color || TRACER; p.c1 = TRACER_END; p.age = -delay; p.rot = rng() * 6.28;
    // The strike: a spark flick where it hits and a dust spurt off the ground (the last one under the target, at `travel`).
    // Delayed pooled sprites, no timer or closure per round.
    // R3-FX: the muzzle-flash sheet on each burst, and the needle sparks of the beam-impact sheet where each round strikes.
    spriteMuzzle(fx, from, a.ux, a.uy, a.uz, "small", anchor, 1.1);
    spriteImpact(fx, "beam", { x: tx, y: ty - fx.ground(tx, tz), z: tz }, 1, anchor, delay + flight, i === n - 1 ? 0.7 : 0.45);
    const last = i === n - 1, s = fx.emit(fx.glow, tx, ty, tz, anchor, true);
    s.s0 = last ? 0.9 : 0.7; s.s1 = last ? 1.1 : 0.9; s.life = 0.08; s.c0 = SPURT_FLASH; s.c1 = SPURT_END; s.age = -(delay + flight);
    const d = fx.emit(fx.smoke, last ? land.x : tx, fx.ground(last ? land.x : tx, last ? land.z : tz) + 0.25, last ? land.z : tz, anchor, true);
    d.cell = CELL.puff; d.vy = 1.6; d.drag = 2.4; d.life = 0.8; d.s0 = 0.35; d.s1 = 1.4; d.c0 = fx.dustColor(0.55); d.c1 = fx.dustColor(0); d.age = -(delay + flight); d.spin = 0.6;
  }
}

export default {
  id: "pods",
  spawn(fx, ev, rng, a) { return ev.tAir ? missiles(fx, ev, rng, a) : strafe(fx, ev, rng, a); },
};
