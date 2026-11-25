// Air abilities (W7 depth, 2026-11-25): the three faction flyers that had none get one active ability
// each that fits their role. Numbers live in balance.json under each unit's `ability`.
//   Hawk gunship (Meridian)  Strafing run  an instant line attack: from the Hawk through the nearest group of
//                                          ground enemies within `range` m (or the point a player gives), every
//                                          hostile ground unit within `width` m of the `length` m line takes
//                                          `damage`, vehicles only `armour` of it. Buildings are not hit.
//   Ember balloon (Ashfall)  Signal flare  a light on the nearest group of enemies within `range` m (or below the
//                                          balloon when there is none): for `duration` s the balloon's side sees
//                                          the ground within `radius` m (sim/vision.js), hidden units there are
//                                          revealed (sim/traits.js) and enemies there take `taken` x damage (the
//                                          Watcher's mark fields; a stronger mark is never lowered).
//   Swift glider (Sunward)   Bomb drop     on the nearest ground enemy within `range` m, Harvesters first:
//                                          `damage` within `radius` m, `worker` x to Harvesters, `soft` x to
//                                          buildings and walls.
// None of them needs a point: the tile casts at once, and says "No target" when nothing is in reach.
//
// Players: these cast on their own when the side's Auto-cast is on (phones by default). Computer sides
// (owner rule "never make Relaxed or Normal harder"): only where the AI plays sharp (src/ai-plan.js
// sharpSide: a skirmish at the Fast or Relentless speed, not Defence, not a story mission or chronicle).
// On Relaxed and Normal, in missions, chronicles and Defence, computer Hawks, balloons and gliders fight
// exactly as before.
//
// State: none until a cast. A Signal flare adds `sim.flares` ([{ x, z, radius, until, team, taken }], at most
// MAX_FLARES), deleted again when the last one burns out, so a match without one saves and hashes as before.
import { distance } from "../../data.js";
import { sharpSide } from "../../ai-plan.js";
import { densest } from "./ai-casts.js";

export const STRAFE = "strafe", FLARE = "flare", BOMB = "bomb";
export const AIR_STRIKES = new Set([STRAFE, FLARE, BOMB]);
export const MAX_FLARES = 8;

const computerSide = (sim, e) => (sim.lan ? !sim.lan.humans.includes(e.team) : e.team > 0 || !!sim.aiPlayer);
// True when this unit's side may cast its air ability on its own now (players: their Auto-cast decides).
export const airAutocastAllowed = (sim, e) => !computerSide(sim, e) || sharpSide(sim, e.team);

const groundFoe = (sim, e, t) => t.hp > 0 && t.kind === "unit" && !t.flying && sim.hostile(e.team, t.team);
const validPoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.z);

// Distance from (px, pz) to the segment a-b.
function segmentDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const k = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + dx * k), pz - (az + dz * k));
}

// ---- Strafing run
// Where the run aims: the player's point when it is in reach, else the middle of the biggest seen group of
// ground enemies within range, else null.
export function strafeAim(sim, e, a = e.ability, point = null) {
  if (!a || a.id !== STRAFE) return null;
  if (validPoint(point) && distance(e, point) <= a.range + 2) return { x: point.x, z: point.z };
  return densest(sim, e, a.range, 3);
}
// The line of the run toward `aim`: { ax, az, bx, bz }.
export function strafeLine(e, a, aim) {
  const dx = aim.x - e.x, dz = aim.z - e.z, l = Math.hypot(dx, dz) || 1;
  return { ax: e.x, az: e.z, bx: e.x + (dx / l) * a.length, bz: e.z + (dz / l) * a.length };
}
// The hostile ground units on the line.
export function strafeVictims(sim, e, a, line) {
  const out = [];
  for (const t of sim.entities)
    if (groundFoe(sim, e, t) && segmentDistance(t.x, t.z, line.ax, line.az, line.bx, line.bz) <= a.width + (t.radius || 0) * 0.5) out.push(t);
  return out;
}

// ---- Signal flare
export function flareAim(sim, e, a = e.ability, point = null) {
  if (!a || a.id !== FLARE) return null;
  if (validPoint(point) && distance(e, point) <= a.range) return { x: point.x, z: point.z };
  return densest(sim, e, a.range, 3) || { x: e.x, z: e.z };
}
// Marks every hostile unit inside the flare. A stronger running mark (a Watcher's) is left alone; an equal one
// keeps its later end; a weaker one gives way to the flare's.
function markInside(sim, f) {
  for (const t of sim.entities) {
    if (t.hp <= 0 || t.kind !== "unit" || !sim.hostile(f.team, t.team) || distance(t, f) > f.radius) continue;
    const running = t.markedUntil > sim.time, taken = t.markTaken || 1;
    if (running && taken > f.taken) continue;
    t.markedUntil = running && taken === f.taken ? Math.max(t.markedUntil, sim.time + 0.3) : sim.time + 0.3;
    t.markTaken = f.taken;
  }
}

// ---- Bomb drop
// The nearest seen ground enemy within reach, Harvesters first; null when none.
export function bombTarget(sim, e, a = e.ability) {
  if (!a || a.id !== BOMB) return null;
  let worker = null, wd = Infinity, unit = null, ud = Infinity;
  for (const t of sim.entities) {
    if (!groundFoe(sim, e, t) || !sim.isVisible(t, e.team)) continue;
    const d = distance(e, t) - (t.radius || 0);
    if (d > a.range) continue;
    if (t.type === "worker" && d < wd) { worker = t; wd = d; }
    if (d < ud) { unit = t; ud = d; }
  }
  return worker || unit;
}

// What a tile needs to know: whether the ability has something to hit now (Signal flare always has: below the balloon).
export function airTarget(sim, e, a = e.ability) {
  if (!a) return null;
  if (a.id === STRAFE) { const aim = strafeAim(sim, e, a); return aim && strafeVictims(sim, e, a, strafeLine(e, a, aim)).length ? aim : null; }
  if (a.id === BOMB) return bombTarget(sim, e, a);
  if (a.id === FLARE) return flareAim(sim, e, a);
  return null;
}

export const airStrikes = {
  id: "airStrikes",
  order: 43,
  mixin: {
    // sim/vision.js updateVision (only while a flare burns): each flare opens its ground to its side.
    flareVision() {
      const t = this.terrain, g = t.grid;
      for (const f of this.flares) {
        if (f.until <= this.time) continue;
        const [cx, cz] = this.nav.cellAt(f.x, f.z), r = Math.ceil(f.radius / 2), seen = this.visible[f.team], known = this.explored[f.team];
        if (!seen) continue;
        for (let z = Math.max(0, cz - r); z <= Math.min(g - 1, cz + r); z++)
          for (let x = Math.max(0, cx - r); x <= Math.min(g - 1, cx + r); x++) {
            const wx = x * 2 - t.half + 1, wz = z * 2 - t.half + 1;
            if (Math.hypot(f.x - wx, f.z - wz) <= f.radius) seen[z * g + x] = known[z * g + x] = 1;
          }
      }
    },
    // sim/traits.js (Veil's hidden units, only while a flare burns): the teams whose flare lights `e`.
    flareSeen(e) {
      let seen = 0;
      for (const f of this.flares) if (f.until > this.time && f.team !== e.team && this.hostile(f.team, e.team) && distance(f, e) <= f.radius) seen |= 1 << f.team;
      return seen;
    },
  },
  abilities: {
    [STRAFE]: {
      use(sim, e, a, point) {
        const aim = strafeAim(sim, e, a, point);
        if (!aim) return false;
        const line = strafeLine(e, a, aim), victims = strafeVictims(sim, e, a, line);
        if (!victims.length) return false;
        for (const t of victims) sim.applyDamage(t, a.damage * (t.mechanical ? a.armour ?? 1 : 1), e.team, e.id);
        return { at: { x: line.bx, z: line.bz } };
      },
    },
    [FLARE]: {
      use(sim, e, a, point) {
        const at = flareAim(sim, e, a, point);
        if (!at) return false;
        const f = { x: at.x, z: at.z, radius: a.radius, until: sim.time + a.duration, team: e.team, taken: a.taken };
        (sim.flares ||= []).push(f);
        if (sim.flares.length > MAX_FLARES) sim.flares.shift();
        markInside(sim, f);
        return { at };
      },
    },
    [BOMB]: {
      use(sim, e, a) {
        const t = bombTarget(sim, e, a);
        if (!t) return false;
        const at = { x: t.x, z: t.z };
        for (const o of sim.entities) {
          if (o.hp <= 0 || o.flying || !sim.hostile(e.team, o.team)) continue;
          if (o.kind !== "unit" && o.kind !== "building" && o.kind !== "wall") continue;
          if (distance(o, at) - (o.kind === "unit" ? 0 : o.radius || 0) > a.radius) continue;
          const k = o.kind === "unit" ? (o.type === "worker" ? a.worker ?? 1 : a.troops ?? 1) : a.soft ?? 1;
          sim.applyDamage(o, a.damage * k, e.team, e.id);
        }
        return { at };
      },
    },
  },
  // Flares: keep marking what stands in the light; the list goes when the last one burns out.
  step(sim) {
    if (!sim.flares) return;
    sim.flares = sim.flares.filter((f) => f.until > sim.time);
    if (!sim.flares.length) { delete sim.flares; return; }
    for (const f of sim.flares) markInside(sim, f);
  },
  autocast(sim, e, a) {
    if (!AIR_STRIKES.has(a.id)) return undefined;
    if (!airAutocastAllowed(sim, e)) return false;
    if (a.id === STRAFE) {
      const aim = strafeAim(sim, e, a);
      return !!aim && strafeVictims(sim, e, a, strafeLine(e, a, aim)).length >= 2;
    }
    if (a.id === BOMB) return !!bombTarget(sim, e, a);
    // Flare: a seen group of three or more within reach.
    return densest(sim, e, a.range, 3, 3) || false;
  },
};
