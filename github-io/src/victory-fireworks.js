// Victory fireworks (a view plugin, docs/VIEW_PLUGINS.md; owner 2026-11-29): when the player wins a match in which
// Hero mode was used (or is still on at the end), fireworks burst over the battlefield in the team's colours for about
// 7 s. Each burst is a bright flash, a spreading spark shell and a falling glitter trail, all pooled glow particles
// of the combat effects (src/fx.js): +0 draws, nothing allocated per frame (the colours and the plan are made once).
//   - Seeded from the match seed (sky-events.js skySeed), so a match's fireworks are the same each time.
//   - Never on a defeat or a draw, never in a match Hero mode did not touch.
//   - Placed around where the camera looks, to its sides and beyond, high up: clear of the screen's middle, where the
//     victory ceremony (ceremony.js) swings the camera to the MVP and floats its tag. No camera shake.
//   - The results card pauses the battlefield (the view's time stops); the fireworks' particles go on in real time
//     behind it (Effects.advancePools).
//   - Reduced motion: a few still glows instead (no movement, no flicker).
import { skySeed, skyRandom } from "./sky-events.js";
import { CELL, BILLBOARD, STRETCH } from "./fx-kinds/cells.js";

export const FIREWORKS = Object.freeze({
  seconds: 7, bursts: [10, 13], height: [6, 10.5], side: [5, 13], sidePhone: [3.5, 8], beyond: [-4, 5],
  // Sparks and shells grow with the camera's distance (the RTS camera sits about 60 m away after a win): a burst
  // reads at any zoom. `near`: the distance at which they are drawn at their own size.
  near: 22, grow: [1, 3.2],
  sparks: { desktop: 28, phone: 16 }, glitter: { desktop: 12, phone: 7 }, speed: [6.5, 9], still: 4, stillLife: 6.5,
});
// The burst times and places of a match's fireworks (seconds from the win; side and beyond in metres from where the
// camera looks, `side` signed: left or right of the middle, never in it), and their colours (0 team, 1 team light,
// 2 gold, 3 white).
export function fireworksPlan(seed, { phone = false, reduced = false } = {}) {
  const r = skyRandom(seed, "fireworks"), F = FIREWORKS, side = phone ? F.sidePhone : F.side;
  const n = reduced ? F.still : F.bursts[0] + Math.floor(r() * (F.bursts[1] - F.bursts[0] + 1)), out = [];
  for (let i = 0; i < n; i++) {
    const at = reduced ? 0 : 0.2 + (i / n) * (F.seconds - 1.8) + r() * 0.5;
    const dir = i % 2 ? 1 : -1;
    out.push({ at, side: dir * (side[0] + r() * (side[1] - side[0])), beyond: F.beyond[0] + r() * (F.beyond[1] - F.beyond[0]), y: F.height[0] + r() * (F.height[1] - F.height[0]),
      color: [0, 1, 0, 2, 0, 3][i % 6], size: 0.8 + r() * 0.5 });
  }
  return out.sort((a, b) => a.at - b.at);
}
// Fireworks for this result? (victory only, Hero mode used in this very match).
export const fireworksFor = (sim, heroSim) => !!sim && sim.result === "victory" && heroSim === sim;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const rgba = (hex, a = 1) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, a];
const lighten = (c, k) => [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k, c[3]];

export class VictoryFireworks {
  constructor(view, { clock = now } = {}) {
    this.view = view;
    view.fireworks = this; // tests and probes
    this.clock = clock;
    this.firedFor = null;
    this.reset();
  }
  reset() {
    this.plan = null; this.next = 0; this.t = 0; this.last = null; this.rng = null; this.palette = null;
    this.state = { on: false, bursts: 0, planned: 0, still: false, particles: 0 };
  }
  // Starts the show for `sim` (colours from the view's team palette, places around the camera's look).
  start(sim) {
    const v = this.view, reduced = !!v.reducedMotion?.matches, phone = !!v.fx?.touchTier, seed = skySeed(sim);
    this.firedFor = sim;
    this.plan = fireworksPlan(seed, { phone, reduced });
    this.rng = skyRandom(seed, "fireworks-sparks");
    const team = rgba(v.colors?.[0] ?? 0x92ebc5);
    const base = [team, lighten(team, 0.45), rgba(0xffd98a), rgba(0xffffff)];
    // [flash, spark start, spark end, glitter start, glitter end] per colour, made once.
    this.palette = base.map((c) => [lighten(c, 0.7), lighten(c, 0.25), [c[0], c[1], c[2], 0], lighten(c, 0.5), [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 0]]);
    this.next = 0; this.t = 0; this.last = this.clock();
    Object.assign(this.state, { on: true, bursts: 0, planned: this.plan.length, still: reduced });
  }
  update(sim, dt) {
    const v = this.view, fx = v.fx;
    if (!fx || !sim) return;
    if (this.firedFor !== sim && fireworksFor(sim, v.horizon?.heroSim)) this.start(sim);
    if (!this.plan || this.firedFor !== sim) { this.state.on = false; return; }
    // Real time: the results card pauses the view (dt 0), the show goes on behind it.
    const t = this.clock(), real = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    this.t += real;
    while (this.next < this.plan.length && this.plan[this.next].at <= this.t) this.burst(this.plan[this.next++]);
    if (!(dt > 0)) fx.advancePools(real);
    if (this.next >= this.plan.length && this.t > FIREWORKS.seconds + 3) this.state.on = false;
  }
  // Where a burst goes: around where the camera looks (the RTS focus or the hero's look), to its side and beyond.
  place(b, out) {
    const v = this.view, cam = v.camera, f = v.heroCameraOn && v.heroLook ? v.heroLook : { x: v.focus?.x ?? 0, z: v.focus?.z ?? 0 };
    let fx = 0, fz = -1;
    if (cam) { fx = f.x - cam.position.x; fz = f.z - cam.position.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l; }
    // right = forward turned a quarter (screen right)
    out.x = f.x + -fz * b.side + fx * b.beyond; out.z = f.z + fx * b.side + fz * b.beyond; out.y = b.y;
    return out;
  }
  burst(b) {
    const v = this.view, fx = v.fx, glow = fx.glow, pal = this.palette[b.color], r = this.rng, phone = fx.touchTier;
    const at = this.place(b, this.at || (this.at = { x: 0, y: 0, z: 0 }));
    this.state.bursts++;
    const cam = v.camera?.position, far = cam ? Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z) : FIREWORKS.near;
    const k = Math.min(FIREWORKS.grow[1], Math.max(FIREWORKS.grow[0], far / FIREWORKS.near)), ks = Math.sqrt(k);
    // (pooled records, fields set in place: nothing is allocated; `keep`: the effects' particle trim, which thins
    // combat effects to the units on screen, never drops them)
    const glowAt = (x, y, z, s0, s1, life, c0, c1) => { const p = fx.emit(glow, x, y, z, null); p.cell = CELL.glow; p.mode = BILLBOARD; p.s0 = s0; p.s1 = s1; p.life = life; p.c0 = c0; p.c1 = c1; p.keep = true; return p; };
    if (this.state.still) {
      // Reduced motion: a still glow that fades in and out, nothing moving.
      const p = glowAt(at.x, at.y, at.z, 3.2 * b.size * k, 3.2 * b.size * k, FIREWORKS.stillLife, pal[1], pal[2]);
      p.fadeIn = 0.8; p.hold = 0.7;
      return;
    }
    // The flash.
    glowAt(at.x, at.y, at.z, 3.6 * b.size * k, 5.2 * b.size * k, 0.38, pal[0], pal[2]);
    // The spark shell: streaks flying out on a sphere, slowing, drooping, fading from bright to the team colour.
    const n = Math.round((phone ? FIREWORKS.sparks.phone : FIREWORKS.sparks.desktop) * b.size);
    for (let i = 0; i < n; i++) {
      const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z), sp = (FIREWORKS.speed[0] + r() * (FIREWORKS.speed[1] - FIREWORKS.speed[0])) * b.size * ks;
      const ux = Math.cos(a) * s, uy = z * 0.85 + 0.15, uz = Math.sin(a) * s, l = Math.hypot(ux, uy, uz) || 1;
      const p = fx.emit(glow, at.x, at.y, at.z, null);
      p.keep = true;
      p.vx = (ux / l) * sp; p.vy = (uy / l) * sp; p.vz = (uz / l) * sp; p.drag = 1.25; p.gravity = 2.6; p.life = 1.4 + r() * 0.5; p.hold = 0.35;
      p.mode = STRETCH; p.ax = ux / l; p.ay = uy / l; p.az = uz / l; p.length = 0.7 * b.size * k; p.s0 = 0.16 * k; p.s1 = 0.07 * k; p.cell = CELL.streak; p.c0 = pal[1]; p.c1 = pal[2];
    }
    // The glitter: small sparks that start late and fall slowly, twinkling out.
    const g = Math.round((phone ? FIREWORKS.glitter.phone : FIREWORKS.glitter.desktop) * b.size);
    for (let i = 0; i < g; i++) {
      const a = r() * Math.PI * 2, rad = (2 + r() * 3.5) * b.size * ks;
      const p = glowAt(at.x + Math.cos(a) * rad, at.y + (r() - 0.3) * rad * 0.8, at.z + Math.sin(a) * rad, 0.22 * k, 0.1 * k, 1.6 + r() * 0.9, pal[3], pal[4]);
      p.vy = (-0.6 - r() * 0.8) * ks; p.gravity = 0.6; p.drag = 0.4; p.hold = 0.2;
      p.age = -(0.45 + r() * 0.6); // starts once the shell has spread
    }
  }
}
