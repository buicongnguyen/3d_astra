// The status core (AAA round 2, W0-B; docs/CONTENT_SEAMS.md): timed statuses such as Pinned or
// Stunned on any entity, registered by content modules (`statuses` in src/sim/content/*.js).
// State is created only when a status is first applied, so a match without statuses saves and hashes
// exactly as before:
//   e.fx = { [id]: until, [id + "Immune"]: until }   on an entity that has had a status
//   sim.fxOn = true                                   while any entity carries e.fx
// A status is active while its `until` is later than sim.time. Once a second the sweep deletes expired
// keys, then e.fx once it is empty, then sim.fxOn once no entity carries e.fx.
// Mixed into Simulation (see simulation.js).
import { STATUSES, STATUS_IDS } from "./content.js";
import { hyp } from "../data.js";
import { MAX_ZONES } from "./defence/common.js";

// Sweep every 20 ticks (one second at the 20 Hz step), counted on sim.ticks so it needs no clock.
const SWEEP_TICKS = 20;
const FLAG = { fire: "noFire", cast: "noCast" };

// A status definition by id, as registered ({ speed, reload, taken, noFire, noCast, icon, ... }).
export const statusInfo = (id) => STATUSES[id];

export const effects = {
  // Puts status `id` on `e` for `seconds` (never shortens one already running). With `immune`, the
  // entity then shrugs off this status for that many seconds after it ends; while immune (or still
  // under it with immunity pending) a new application is refused. Returns true when applied.
  applyStatus(e, id, seconds, { immune = 0 } = {}) {
    if (!STATUSES[id]) throw new Error(`Unknown status "${id}": register it in a content module's statuses`);
    if (!e || !(e.hp > 0) || !(seconds > 0)) return false;
    if (e.fx?.[`${id}Immune`] > this.time) return false;
    const fx = (e.fx ||= {});
    fx[id] = Math.max(fx[id] ?? 0, this.time + seconds);
    if (immune > 0) fx[`${id}Immune`] = fx[id] + immune;
    this.fxOn = true;
    return true;
  },
  hasStatus(e, id) {
    return !!e?.fx && e.fx[id] > this.time;
  },
  // Ends status `id` at once (its immunity, if any, stays). True when there was one to end.
  clearStatus(e, id) {
    if (!e?.fx || !(e.fx[id] > this.time)) return false;
    delete e.fx[id];
    if (!Object.keys(e.fx).length) delete e.fx;
    return true;
  },
  // The active statuses on `e`, in registration order (status icons read this).
  activeStatuses(e) {
    const fx = e?.fx;
    return fx ? STATUS_IDS.filter((id) => fx[id] > this.time) : [];
  },
  // The product of `kind` ("speed", "reload" or "taken") over the active statuses; 1 with none.
  statusFactor(e, kind) {
    const fx = e.fx;
    if (!fx) return 1;
    let factor = 1;
    for (const id of STATUS_IDS) if (fx[id] > this.time && STATUSES[id][kind] !== undefined) factor *= STATUSES[id][kind];
    return factor;
  },
  // False while an active status forbids the act ("fire": noFire, "cast": noCast).
  canAct(e, act) {
    const fx = e.fx, flag = FLAG[act];
    if (!flag) throw new Error(`canAct: unknown act "${act}"`);
    if (!fx) return true;
    for (const id of STATUS_IDS) if (fx[id] > this.time && STATUSES[id][flag]) return false;
    return true;
  },
  // H4 (sim/content.js contentStep), only while sim.fxOn is set.
  stepStatuses() {
    if (this.ticks % SWEEP_TICKS === 0) this.sweepStatuses();
  },
  sweepStatuses() {
    let any = false;
    for (const e of this.entities) {
      const fx = e.fx;
      if (!fx) continue;
      for (const key of Object.keys(fx)) if (!(fx[key] > this.time)) delete fx[key];
      if (Object.keys(fx).length) any = true;
      else delete e.fx;
    }
    if (!any) delete this.fxOn;
  },
};

// On-hit effects that any entity carrying the field can use (AAA round 2, CW-A; M1, code move only).
// They are the bodies of the Defence garrison helpers and write the same entity fields (slowUntil,
// slowBy, markedUntil, markTaken, burnAt) and the same zone and event, so no hash moves. The mixin
// (sim/defence/towers.js) keeps garrisonHit, garrisonPierce and garrisonBurst as thin wrappers
// because combat.js calls them by those names.
// Slow, mark (also around the target: slow_radius, mark_radius) and burning ground: `sim` is the
// Simulation, `e` the shooter, `t` the target.
export function applyHitEffects(sim, e, t) {
  if (t.kind === "unit" && e.slow) { t.slowUntil = sim.time + e.slow.seconds; t.slowBy = e.slow.factor; }
  if (t.kind === "unit" && e.beacon) { t.markedUntil = sim.time + e.beacon.seconds; t.markTaken = e.beacon.taken; }
  // Ranks (0.24): the slow or the mark also falls on the enemies near the target.
  if (t.kind === "unit" && (e.slow_radius || e.mark_radius))
    for (const u of sim.entities) {
      if (u === t || u.hp <= 0 || u.kind !== "unit" || u.flying || !sim.hostile(e.team, u.team)) continue;
      const d = hyp(u.x - t.x, u.z - t.z);
      if (e.slow_radius && d <= e.slow_radius) { u.slowUntil = sim.time + e.slow.seconds; u.slowBy = e.slow.factor; }
      if (e.mark_radius && e.beacon && d <= e.mark_radius) { u.markedUntil = sim.time + e.beacon.seconds; u.markTaken = e.beacon.taken; }
    }
  if (e.burn && sim.time >= (e.burnAt ?? 0) - 1e-9) {
    e.burnAt = sim.time + e.burn.every;
    (sim.zones ||= []).push({ x: t.x, z: t.z, radius: e.burn.radius, until: sim.time + e.burn.seconds, dps: e.burn.dps, team: e.team, by: e.id });
    if (sim.zones.length > MAX_ZONES) sim.zones.shift();
    sim.events.push({ type: "ability", ability: "burnline", id: e.id, team: e.team, x: e.x, z: e.z, tx: t.x, tz: t.z, radius: e.burn.radius, duration: e.burn.seconds });
  }
}
// A shot of a piercing rank: that share of the target's shield is set aside while the shot lands
// (`land()`), so it goes through to the hull; what was set aside comes back after.
export function pierceShield(e, t, land) {
  const kept = t.shield > 0 ? t.shield * e.pierce : 0;
  t.shield -= kept;
  land();
  t.shield += kept;
}
// A burst rank: the shots of a burst come `gap` seconds apart, then the full reload.
export function burstStep(e) {
  e.burstShot = (e.burstShot || 0) + 1;
  if (e.burstShot < e.burst.shots) e.cooldown = e.burst.gap;
  else e.burstShot = 0;
}
