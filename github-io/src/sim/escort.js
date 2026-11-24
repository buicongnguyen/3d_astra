import { clamp, hyp } from "../data.js";
import { KEEP, squadRole, freeStep } from "./formation.js";

// Support units stay behind the front (owner, 2026-11-24: "units do their own jobs", one squad order).
// A Medic, Engineer or Supply wagon walking with fighters never leads: it stands a few metres behind the
// rearmost nearby fighter, measured along the front direction (toward the nearest visible enemy, else
// where the fighters are heading), keeps their pace, heals or repairs from there, and falls back further
// when it is hurt. Only player orders reach this code (group-paced orders and the `escort` order the
// interface sends, src/app/orders.js), so AI and bot matches run as before. All state lives on the order
// copies (`escort`, `members`, `hx`, `hz`, `target`), so saves reload into the same walk.

// The spot behind the rearmost nearby fighter (m).
export const BEHIND = 3.5;
// A formation slot at least this far behind the rearmost fighter is safe to walk to (m).
export const SAFE = 3;
// A hurt support unit stands this far behind the fighters instead (m).
export const FALL_BACK = 10;
// Hurt: below this share of its health.
export const HURT = 0.4;
// Enemies within this distance of the followed fighter set the front direction (m).
export const THREAT = 20;
// A wounded fighter within this distance draws its healer up behind it (m).
export const PATIENT = 16;
// Idle support units within this distance of an ordered fighter come along (m).
export const ENLIST = 12;

export const isFighter = (e) => !!e && e.hp > 0 && e.kind === "unit" && e.complete && e.type !== "worker" && !e.flying && squadRole(e) !== "support";

// The visible enemy nearest to `u` within THREAT, or null.
function nearestThreat(sim, team, u) {
  let best = null, bestD = THREAT;
  for (const t of sim.entities) {
    if (!(t.hp > 0) || (t.kind !== "unit" && t.kind !== "building") || !sim.hostile(team, t.team)) continue;
    const d = hyp(t.x - u.x, t.z - u.z);
    if (d < bestD && sim.isVisible(t, team)) { best = t; bestD = d; }
  }
  return best;
}

// Which fighter a support unit follows: one it can heal or repair, ranged or heavy before melee (a Medic
// tending a Vanguard would close to its knife range), nearest first. Falls back to any fighter.
export function pickAnchor(sim, e, fighters) {
  let best = null, bestScore = Infinity;
  for (const f of fighters) {
    const score = hyp(f.x - e.x, f.z - e.z) + (sim.supportValid(e, f) ? 0 : 100) + (f.range <= 3 && f.maxHp < 250 ? 8 : 0);
    if (score < bestScore || (score === bestScore && f.id < best.id)) { best = f; bestScore = score; }
  }
  return best;
}

// Where a support unit stands now: {x, z, dx, dz, rear, hurt, anchor}, or null when no fighter is left.
export function escortPlan(sim, e, members, hx = 0, hz = -1, anchorId = null) {
  const fighters = [];
  for (const id of members || []) { const m = sim.get(id); if (isFighter(m) && m.team === e.team) fighters.push(m); }
  if (!fighters.length) return null;
  let anchor = anchorId != null ? sim.get(anchorId) : null;
  if (!isFighter(anchor) || !fighters.includes(anchor)) anchor = pickAnchor(sim, e, fighters);
  // The front direction: the nearest visible enemy, else the fighter's own target or destination,
  // else the order's heading.
  let dx = hx, dz = hz;
  const threat = nearestThreat(sim, e.team, anchor), o = anchor.orders?.[0], aim = o?.target != null ? sim.get(o.target) : null;
  if (threat) { dx = threat.x - anchor.x; dz = threat.z - anchor.z; }
  else if (aim && aim.hp > 0 && aim.team !== e.team) { dx = aim.x - anchor.x; dz = aim.z - anchor.z; }
  else if (o && Number.isFinite(o.x) && hyp(o.x - anchor.x, o.z - anchor.z) > 1) { dx = o.x - anchor.x; dz = o.z - anchor.z; }
  let len = hyp(dx, dz);
  if (len < 1e-6) { dx = 0; dz = -1; len = 1; }
  dx /= len; dz /= len;
  const along = (u) => u.x * dx + u.z * dz;
  let rear = along(anchor);
  for (const f of fighters) if (hyp(f.x - anchor.x, f.z - anchor.z) <= KEEP) rear = Math.min(rear, along(f));
  const hurt = e.hp < e.maxHp * HURT;
  // A wounded fighter it can mend: it steps up behind that one (still behind it, within reach) instead
  // of behind the rearmost line, so the healing reaches the front.
  let patient = null;
  if (!hurt) for (const f of fighters) {
    if (f.hp >= f.maxHp || !sim.supportValid(e, f) || hyp(f.x - e.x, f.z - e.z) > PATIENT) continue;
    if (!patient || f.hp / f.maxHp < patient.hp / patient.maxHp || (f.hp / f.maxHp === patient.hp / patient.maxHp && f.id < patient.id)) patient = f;
  }
  if (patient) { anchor = patient; rear = along(patient); }
  const shift = rear - (hurt ? FALL_BACK : BEHIND) - along(anchor);
  const limit = sim.terrain.half - 3;
  let x = clamp(anchor.x + dx * shift, -limit, limit), z = clamp(anchor.z + dz * shift, -limit, limit);
  // A spot in water or on a cliff slides toward the fighter until the unit can stand there.
  if (!sim.nav.canStand(x, z, e.radius)) {
    const sx = anchor.x - x, sz = anchor.z - z, d = hyp(sx, sz);
    for (let s = 0.5; s < d; s += 0.5) {
      if (sim.nav.canStand(x + (sx / d) * s, z + (sz / d) * s, e.radius)) { x += (sx / d) * s; z += (sz / d) * s; break; }
    }
  }
  return { x, z, dx, dz, rear, hurt, anchor, along };
}

// The order an escorting support unit carries (a `support` order that follows the fighters).
export function escortOrder(sim, e, fighters, hx, hz) {
  const anchor = pickAnchor(sim, e, fighters);
  return anchor ? { type: "support", target: anchor.id, escort: true, members: fighters.map((f) => f.id).sort((a, b) => a - b), hx, hz } : null;
}

// Mixed into Simulation (simulation.js).
export const escort = {
  // One tick of an escort support order; false when no fighter is left to follow.
  escortStep(e, o, dt) {
    const plan = escortPlan(this, e, o.members, o.hx, o.hz, o.target);
    if (!plan) return false;
    if (plan.anchor.id !== o.target) o.target = plan.anchor.id;
    this.assist(e, this.supportTarget(e), dt);
    this.escortMove(e, plan, dt);
    return true;
  },
  // A support unit on a group-paced move: true when it holds behind the fighters this tick, false when
  // its formation slot is safely behind them (it then walks there as before, sim/formation.js).
  squadGuard(e, o, dt) {
    const plan = escortPlan(this, e, o.members, o.hx, o.hz);
    if (!plan) return false;
    if (!plan.hurt && plan.along(o) <= plan.rear - SAFE) return false;
    // The fighters have all arrived (or taken other orders): follow them from here on.
    if (!o.members.some((id) => { const f = this.get(id); return isFighter(f) && f.orders[0]?.squad === o.squad; })) { this.finish(e); return true; }
    this.assist(e, this.supportTarget(e), dt);
    this.escortMove(e, plan, dt);
    return true;
  },
  escortMove(e, plan, dt) {
    if (hyp(e.x - plan.x, e.z - plan.z) < 1.5) { e.moving = false; e.path = []; e.stalled = 0; return; }
    // The spot moves with the fighters: never let the stall clock clear the order, and re-route when
    // the spot has moved well away from the end of the current route.
    if (e.stalled > 4) { e.stalled = 0; e.escapeTried = false; e.path = []; e.pathClock = 0; }
    const end = e.path?.[e.path.length - 1];
    if (end && hyp(end.x - plan.x, end.z - plan.z) > 2.5) e.pathClock = 0;
    freeStep(e); // walks at its own speed, not the group pace, so it can keep behind and fall back
    try { this.move(e, plan, dt, 1.2); } finally { freeStep(null); }
  },
  // Player group orders: idle support units near the ordered fighters come along behind them.
  enlistSupport(ids, order) {
    const fighters = ids.map((id) => this.get(id)).filter(isFighter);
    if (fighters.length < 2) return;
    const team = fighters[0].team, chosen = new Set(ids);
    let cx = 0, cz = 0;
    for (const f of fighters) { cx += f.x; cz += f.z; }
    cx /= fighters.length; cz /= fighters.length;
    const goal = order.target != null ? this.get(order.target) : order;
    let hx = (goal?.x ?? cx) - cx, hz = (goal?.z ?? cz - 1) - cz;
    const len = hyp(hx, hz) || 1;
    hx /= len; hz /= len;
    for (const e of this.entities) {
      if (e.team !== team || e.kind !== "unit" || !e.support || !e.complete || !(e.hp > 0) || chosen.has(e.id)) continue;
      if (e.orders.length && !(e.orders[0].type === "support" && e.orders[0].escort)) continue;
      if (!fighters.some((f) => hyp(f.x - e.x, f.z - e.z) <= ENLIST)) continue;
      const o = escortOrder(this, e, fighters, hx, hz);
      if (!o) continue;
      e.orders = [o]; e.path = []; e.pathClock = 0; e.stalled = 0; e.working = false;
    }
  },
};
