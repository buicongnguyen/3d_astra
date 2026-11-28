import { fnv1a, mulberry32 } from "./rng.js";

// H5 birds that react (the logic; src/bird-view.js draws them). Pure and seeded: the same map always gets the same
// flocks, and the reactions follow only the battle's events and positions, so a replay shows the same birds. It never
// reads or advances the simulation's generator, and it never writes to the simulation.
//
//   Flocks perch: gulls on the river banks, crows on rocks and open ground, and more crows on the roofs of finished
//   buildings (added as they are seen). How many follows Settings > Hero > Birds (BIRD_LEVELS): Few (the default) is a
//   couple of small flocks, Many the full cast, Off none. (Songbirds, ducks and the hawk near Skywing were removed on
//   2026-11-28: the owner saw them blink and draw as spiky shards; their models stay out of birds.glb.)
//   A shot, a blast or a unit coming close startles a flock: ONE event per flock, and each bird's take-off time is that
//   event's time plus a delay that grows with its distance from the source, so they lift off in a ripple, nearest
//   first. They climb and circle (crows that take off after a fight circle over it instead of their perch: the centre
//   is fixed at take-off, so a flying bird never jumps), and once it has been quiet for a while they glide back down,
//   one after another; a landing flock is not startled again until it has perched (a bird never snaps back to its
//   perch in mid-air). Every bird's flight is a closed-form path of the event
//   times (birdPath below; bird-view.js runs the same maths in its vertex shader), so the CPU never moves a bird.
//   Fog-of-war hint (Settings birdHint, on by default): birds startled by something the player cannot see still take
//   off, and flying birds are drawn above the fog, giving away hidden movement. With it off, only what the player can
//   see startles birds, and birds over fog stay hidden.

export const SPECIES = Object.freeze(["crow", "gull", "songbird", "duck", "goose", "hawk"]);
export const SPECIES_ID = Object.freeze(Object.fromEntries(SPECIES.map((s, i) => [s, i])));
// Budgets: flocks on a map (roof flocks included), birds per flock, and birds drawn with the detailed model at once
// (Hero mode). Many: the full cast; Few (the default): one gull and one crow flock and one roof flock of 3-5 birds.
export const BIRD_BUDGET = Object.freeze({ pc: { flocks: 18, roofs: 4, near: 20 }, touch: { flocks: 11, roofs: 2, near: 10 } });
export const BIRD_FEW = Object.freeze({ flocks: 3, roofs: 1, flock: [3, 5], gulls: 1, crows: 1 });
// Settings > Hero > Birds.
export const BIRD_LEVELS = Object.freeze(["off", "few", "many"]);
// Few keeps the device's whole near budget, so every bird close to the Hero camera is a model (a flat card that close
// reads as a shard).
export const birdBudget = (touch, level = "few") => level === "many" ? BIRD_BUDGET[touch ? "touch" : "pc"] : { ...BIRD_FEW, near: BIRD_BUDGET[touch ? "touch" : "pc"].near };
export const BIRD_LIFE = Object.freeze({
  flock: [4, 7],
  // Startle reach (m) of a shot's muzzle, a heavy round's landing, a unit walking by (perched birds only).
  reach: { shot: 15, blast: 22, unit: 5.5 },
  ripple: 0.08,       // s of take-off delay per metre from the source
  takeoff: 1.6,       // s from the perch to the circle
  land: 2.6,          // s from the circle back to the perch
  quiet: 6,           // s without a new startle before a flock lands
  minFlight: 7,       // s a startled flock stays up at least
  stagger: 0.35,      // s between two birds' landings
  circle: [5, 9],     // circle radius (m)
  climb: [3.5, 6],    // circle height above the perch (m): low enough to stay in the Hero camera's view
  speed: 5.2,         // m/s along the circle
  fightAge: 12,       // s a fight stays "the latest" for the crows
  fightReach: 45,     // m a crow flock flies to circle over a fight
});
export const NEVER = 1e9;

// `map`: { id, half, rivers: [{ z }], heightAt(x, z), at(x, z) -> surface, tall: [{ x, z, h, kind }] } (tall props from
// the scatter). Returns the flocks (no roof flocks: those come with the buildings, addRoof).
export function planFlocks(map, { touch = false, level = "few" } = {}) {
  if (level === "off") return [];
  const budget = birdBudget(touch, level), size = budget.flock || BIRD_LIFE.flock, r = mulberry32(fnv1a(`birds|${map.id}`));
  const cap = (species) => level === "many" ? Infinity : budget[species === "gull" ? "gulls" : "crows"];
  const flocks = [], half = map.half, inside = (x, z, m = 6) => Math.abs(x) < half - m && Math.abs(z) < half - m;
  const ground = (x, z) => map.heightAt?.(x, z) ?? 0;
  const add = (species, kind, x, y, z, spread) => {
    if (flocks.length >= budget.flocks - budget.roofs || flocks.filter((f) => f.species === species).length >= cap(species)) return;
    const n = size[0] + Math.floor(r() * (size[1] - size[0] + 1));
    const birds = [];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = spread * Math.sqrt(r());
      birds.push({ ox: Math.cos(a) * d, oy: kind === "tree" ? -r() * 0.35 : 0, oz: Math.sin(a) * d, size: 0.88 + r() * 0.26, phase: r() });
    }
    flocks.push({ species, kind, x, y, z, birds });
  };
  // Gulls on the banks of each river.
  for (const [i, river] of (map.rivers || []).entries()) {
    for (let k = 0; k < 2; k++) {
      const x = (r() * 2 - 1) * (half - 12), side = r() < 0.5 ? -1 : 1;
      for (let step = 3; step < 9; step++) {
        const z = river.z + side * step;
        if (inside(x, z) && map.at?.(x, z) !== "water" && map.at?.(x, z) !== "ford") { add("gull", "bank", x, ground(x, z), z, 1.8); break; }
      }
    }
    if (i > 2) break;
  }
  // Crows on open ground and rocks.
  for (let k = 0, tries = 0; k < 3 && tries < 40; tries++) {
    const x = (r() * 2 - 1) * (half - 10), z = (r() * 2 - 1) * (half - 10), s = map.at?.(x, z);
    if (s === "water" || s === "ford" || s === "bridge" || flocks.some((f) => Math.hypot(f.x - x, f.z - z) < 14)) continue;
    add("crow", "ground", x, ground(x, z), z, 2.2);
    k++;
  }
  return flocks.map((f, i) => ({ ...f, id: i }));
}

// A roof flock of crows for a finished building (bird-view.js asks once per building, up to the budget).
export function roofFlock(id, x, y, z, radius, most = 5) {
  const r = mulberry32(fnv1a(`roof|${id}`)), n = Math.min(most, 3 + Math.floor(r() * 3)), birds = [];
  for (let i = 0; i < n; i++) birds.push({ ox: (r() * 2 - 1) * radius * 0.45, oy: 0, oz: (r() * 2 - 1) * radius * 0.3, size: 0.88 + r() * 0.26, phase: r() });
  return { species: "crow", kind: "roof", x, y, z, birds };
}

// The live state of every flock: perched, flying (since its startle) or landing. The view copies the times of a flock
// into its birds' instance data whenever they change (`dirty`), and the shader does the rest.
export class BirdFlocks {
  constructor(flocks = []) {
    this.flocks = [];
    this.fight = { x: 0, z: 0, t: -NEVER };
    this.dirty = new Set();
    for (const f of flocks) this.add(f);
  }
  add(plan) {
    const f = { ...plan, id: this.flocks.length, state: "perched", t0: -NEVER, last: -NEVER, land: NEVER, sx: plan.x, sz: plan.z, fog: false };
    const r = mulberry32(fnv1a(`flock|${f.id}|${Math.round(plan.x * 10)}|${Math.round(plan.z * 10)}`));
    f.radius = BIRD_LIFE.circle[0] + r() * (BIRD_LIFE.circle[1] - BIRD_LIFE.circle[0]);
    f.climb = BIRD_LIFE.climb[0] + r() * (BIRD_LIFE.climb[1] - BIRD_LIFE.climb[0]);
    f.cx = plan.x; f.cz = plan.z;
    f.birds = plan.birds.map((b) => ({ ...b, start: NEVER, landAt: NEVER }));
    this.flocks.push(f);
    this.dirty.add(f.id);
    return f;
  }
  // A startle at (x, z) at time t: every flock within `reach` takes off (or stays up longer). `hidden`: the source is in
  // the fog of war (the view decides whether that counts, Settings birdHint). Returns the flocks startled.
  startle(x, z, reach, t, { hidden = false, perchedOnly = false } = {}) {
    let n = 0;
    for (const f of this.flocks) {
      const d = Math.hypot(f.x - x, f.z - z);
      if (d > reach) continue;
      if (f.state === "flying") { if (!perchedOnly) f.last = t; continue; }
      // A landing flock settles first: restarting its take-off would snap the birds still in the air back to the perch.
      if (f.state === "landing") continue;
      if (perchedOnly && f.state !== "perched") continue;
      // Take off: nearest bird first, a short random hesitation each (seeded per bird).
      let near = Infinity;
      for (const b of f.birds) near = Math.min(near, Math.hypot(f.x + b.ox - x, f.z + b.oz - z));
      for (const b of f.birds) {
        const db = Math.hypot(f.x + b.ox - x, f.z + b.oz - z);
        b.start = t + (db - near) * BIRD_LIFE.ripple + b.phase * 0.12;
        b.landAt = NEVER;
      }
      Object.assign(f, { state: "flying", t0: t, last: t, land: NEVER, sx: x, sz: z, fog: hidden });
      this.centre(f, t);
      this.dirty.add(f.id);
      n++;
    }
    return n;
  }
  // Where a flock circles, fixed when it takes off: crows over the latest fight when it is near enough, everyone else
  // over the perch. (Moving the centre of a flock in the air made every bird jump: the shader places them on it.)
  centre(f, t) {
    const fresh = t - this.fight.t < BIRD_LIFE.fightAge && Math.hypot(this.fight.x - f.x, this.fight.z - f.z) < BIRD_LIFE.fightReach;
    const cx = f.species === "crow" && fresh ? this.fight.x : f.x, cz = f.species === "crow" && fresh ? this.fight.z : f.z;
    if (cx !== f.cx || cz !== f.cz) { f.cx = cx; f.cz = cz; this.dirty.add(f.id); }
  }
  // A fight happened at (x, z): crows that are up drift over to circle it.
  fought(x, z, t) {
    this.fight.x = x; this.fight.z = z; this.fight.t = t;
  }
  // Once a second or so: flocks that have had their quiet land, one bird after another; landed flocks perch again.
  step(t) {
    for (const f of this.flocks) {
      if (f.state === "flying") {
        if (t - f.last >= BIRD_LIFE.quiet && t - f.t0 >= BIRD_LIFE.minFlight) {
          f.state = "landing"; f.land = t;
          f.birds.forEach((b, i) => { b.landAt = Math.max(t, b.start + BIRD_LIFE.takeoff) + i * BIRD_LIFE.stagger; });
          this.dirty.add(f.id);
        }
      } else if (f.state === "landing") {
        const done = f.birds.every((b) => t >= b.landAt + BIRD_LIFE.land);
        if (done) {
          f.state = "perched"; f.fog = false;
          for (const b of f.birds) { b.start = NEVER; b.landAt = NEVER; }
          this.dirty.add(f.id);
        }
      }
    }
  }
  get flying() { return this.flocks.filter((f) => f.state !== "perched").length; }
}

// Where one bird is at time t (the same maths as bird-view.js's vertex shader; tests and the near-model choice use it).
// Returns { x, y, z, flying } in `out`. `f` is the flock, `b` the bird.
export function birdPath(f, b, t, out = {}) {
  const px = f.x + b.ox, py = f.y + b.oy, pz = f.z + b.oz;
  const k1 = clamp01((t - b.start) / BIRD_LIFE.takeoff), k2 = clamp01((t - b.landAt) / BIRD_LIFE.land);
  if (k1 <= 0 || k2 >= 1) { out.x = px; out.y = py; out.z = pz; out.flying = false; return out; }
  const dir = b.phase < 0.5 ? 1 : -1, r = f.radius * (0.75 + 0.5 * fract(b.phase * 7.13));
  const a = b.phase * 6.2832 + dir * Math.max(0, t - b.start) * BIRD_LIFE.speed / r;
  const cx = f.cx + Math.cos(a) * r, cz = f.cz + Math.sin(a) * r, cy = f.y + f.climb + Math.sin(t * 0.7 + b.phase * 9) * 0.6;
  const e1 = ease(k1), e2 = ease(k2);
  let x = px + (cx - px) * e1, y = py + (cy - py) * e1 + Math.sin(k1 * Math.PI) * 1.2, z = pz + (cz - pz) * e1;
  x += (px - x) * e2; y += (py - y) * e2 + Math.sin(k2 * Math.PI) * 0.8; z += (pz - z) * e2;
  out.x = x; out.y = y; out.z = z; out.flying = true;
  return out;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fract = (v) => v - Math.floor(v);
const ease = (k) => k * k * (3 - 2 * k);
