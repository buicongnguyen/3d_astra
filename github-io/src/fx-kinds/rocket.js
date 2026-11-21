// Anti-tank: a readable rocket (AAA round 3, R3-W). The owner asked for "the shape of the bullet more clear
// with a cheap price": a finned body with a hot tail flame (src/fx-kinds/rocket-body.js, one instanced draw
// for every rocket in flight) flies a slight arc in visual-style.json `life` seconds (0.45, slow enough to
// follow), rolling as it goes, with a short fading smoke ribbon from the smoke pool. The impact is shaped
// by what it hits: on armour a white-hot flash, a spray of sparks and metal debris; on infantry or a
// building a smaller burst (src/fx.js rocketImpact). View only: the simulation applied the damage when the
// shot event was raised; nothing here moves a pin.
import { flare, smokePuff } from "./common.js";

export const ROCKET = Object.freeze({
  arc: 0.05,       // arc height per metre of range (capped at `arcMax` metres)
  arcMax: 0.7,
  spin: 13,        // roll, radians per second
  trailGap: 0.03,  // seconds between two smoke-ribbon puffs
  haloGap: 0.03,   // seconds between two flame-halo sprites
  quick: 0.24,     // flight time of a shot that killed its target (the wreck is already falling)
});

// Is the shot's target armour (a machine)? Decides the impact shape. Unknown or dead targets count as soft.
export const armoured = (target) => !!(target && target.mechanical);

export default {
  id: "rocket",
  spawn(fx, ev, rng, a) {
    const { from, to, land, nx, nz, anchor, power } = a, sim = fx.frameSim;
    const target = ev.target != null ? sim?.get?.(ev.target) : null, alive = target && target.hp > 0;
    // A killing shot flies at the old speed, so it lands while the wreck is still there to be hit.
    const travel = alive ? a.travel : Math.min(a.travel, ROCKET.quick);
    flare(fx, from, 1, undefined, 0.07, anchor);
    fx.particle(fx.glow, { ...from, s0: 1.4, s1: 1.7, life: 0.09, c0: [1, 0.72, 0.35, 0.7], c1: [1, 0.4, 0.1, 0], anchor });
    // Back-blast: a puff of smoke thrown out behind the launcher.
    for (let i = 0, n = fx.count(3); i < n; i++)
      smokePuff(fx, rng, { x: from.x - nx * 1.2, y: from.y, z: from.z - nz * 1.2 }, -nx * (1.6 + i * 0.6), -nz * (1.6 + i * 0.6), anchor, 1.6, [0.62, 0.6, 0.56, 0.5], 0.8);
    const len = Math.hypot(to.x - from.x, to.z - from.z);
    fx.projectiles.push({ from, to, land, travel, age: 0, rocket: true, cannon: false, power, anchor, trail: 0, weapon: ev.weapon,
      body: 1, arc: Math.min(ROCKET.arcMax, len * ROCKET.arc), roll: rng() * 6.28, halo: null, step: 0, token: 0, color: a.color,
      impact: armoured(target) ? "armour" : "soft" });
  },
};
