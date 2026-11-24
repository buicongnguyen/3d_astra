import { clamp, hyp } from "../data.js";

// Group pace (AAA round 3, R3-B; docs/aaa/AAA_ROUND3_PLAN.md). A player's move or attack-move of two or
// more units carries `pace: "group"` (only src/app/orders.js sets it, and only with the Group pace
// setting on): the units take formation slots, fighters in front, ranged behind them and support units
// (Medics, Engineers, wagons, unarmed units) about 3.5 m behind the fighters, and walk at the slowest
// fighter's speed while they keep together. No test, bot or AI sends the flag, so every other order and
// every pinned match runs exactly as before. The per-order data lives on the order copies themselves
// (`squad`, `members`, `cap`, `hx`, `hz`, `trail`); the per-tick squad centre is a cache off the state.

// Rows: a front unit stands in the first rows, ranged units behind it, support units last.
export function squadRole(e) {
  if (e.support || !(e.damage > 0)) return "support";
  return !e.flying && (e.maxHp >= 250 || e.range <= 3) ? "front" : "ranged";
}

// Support units keep this far behind the rearmost nearby fighter while the group walks (m).
export const TRAIL = 1.2;
// Their slot behind the last fighter row (m).
const SUPPORT_GAP = 3.5;
// A unit farther than this from the squad centre walks at its own speed to catch up (m).
export const KEEP = 12;
// A support unit that would pass the fighters walks at this share of the group pace.
const HOLD_BACK = 0.5;
// A unit hit within this many seconds, or between shots, is in combat and walks at its own speed.
const COMBAT = 3;

// Slots for `units` (live, complete units) heading to `goal`: Map id -> {x, z}, with the pace data each
// order copy carries. The front row stands on the goal; every later row is further back along the
// heading from the group's centre to the goal.
export function formationSlots(sim, units, goal) {
  const n = units.length;
  let cx = 0, cz = 0;
  for (const e of units) { cx += e.x; cz += e.z; }
  cx /= n; cz /= n;
  let hx = goal.x - cx, hz = goal.z - cz;
  const len = hyp(hx, hz);
  if (len > 1e-6) { hx /= len; hz /= len; } else { hx = 0; hz = -1; }
  // Left-right across the heading.
  const px = -hz, pz = hx;
  const byHp = (a, b) => b.maxHp - a.maxHp || a.id - b.id;
  const front = units.filter((e) => squadRole(e) === "front").sort(byHp);
  const ranged = units.filter((e) => squadRole(e) === "ranged").sort(byHp);
  const support = units.filter((e) => squadRole(e) === "support").sort((a, b) => a.id - b.id);
  const cols = Math.max(3, Math.ceil(Math.sqrt(n)));
  const rows = [];
  for (const [list, kind] of [[front, "fight"], [ranged, "fight"], [support, "support"]])
    for (let i = 0; i < list.length; i += cols) rows.push({ units: list.slice(i, i + cols), kind });
  const slots = new Map(), limit = sim.terrain.half - 3;
  let back = 0, last = null;
  for (const row of rows) {
    const r = Math.max(...row.units.map((e) => e.radius || 0.6)), spacing = Math.max(1.9, 2 * r + 0.3);
    if (last) back += last.kind === "fight" && row.kind === "support" ? Math.max(SUPPORT_GAP, last.r + r + 1.2) : last.r + r + 0.6;
    const k = row.units.length;
    // Lanes across the heading. The first support row walks in the gaps of the last fighter row (and its
    // two edges), so fighters overtaking it pass beside it instead of pushing it ahead of them.
    let lanes = Array.from({ length: k }, (_, i) => (i - (k - 1) / 2) * spacing);
    if (row.kind === "support" && last?.kind === "fight" && k <= last.k + 1) {
      const gaps = Array.from({ length: last.k + 1 }, (_, j) => (j - last.k / 2) * last.spacing);
      lanes = gaps.sort((a, b) => Math.abs(b) - Math.abs(a) || a - b).slice(0, k).sort((a, b) => a - b);
    }
    // Within a row, slots go left to right in the order the units already stand, so no paths cross.
    row.units.sort((a, b) => a.x * px + a.z * pz - (b.x * px + b.z * pz) || a.id - b.id);
    row.units.forEach((e, i) => {
      const side = lanes[i];
      let x = clamp(goal.x - hx * back + px * side, -limit, limit), z = clamp(goal.z - hz * back + pz * side, -limit, limit);
      // A slot in water or on a cliff slides toward the goal until the unit can stand there.
      if (!e.flying && !sim.nav.canStand(x, z, e.radius)) {
        const dx = goal.x - x, dz = goal.z - z, d = hyp(dx, dz);
        let found = false;
        for (let s = 0.5; s < d; s += 0.5) {
          const sx = x + (dx / d) * s, sz = z + (dz / d) * s;
          if (sim.nav.canStand(sx, sz, e.radius)) { x = sx; z = sz; found = true; break; }
        }
        if (!found) { x = goal.x; z = goal.z; }
      }
      slots.set(e.id, { x, z });
    });
    last = { kind: row.kind, r, k, spacing };
  }
  // The group pace: the slowest ground fighter's own speed (no cap when the group has none).
  const fighters = units.filter((e) => squadRole(e) !== "support" && !e.flying && e.speed > 0);
  const cap = fighters.length ? Math.min(...fighters.map((e) => e.speed)) : 0;
  return { slots, cap, hx, hz, members: units.map((e) => e.id).sort((a, b) => a - b), squad: `${sim.ticks}:${Math.min(...units.map((e) => e.id))}`, fighters };
}

// A support unit standing ahead of the fighters, in a fighter's lane, first steps aside so the fighters
// can pass it (routes follow the 2 m grid rows, so a slower unit in the same row would be pushed ahead).
// Returns the point beside it, or null when it is already behind the fighters or out of their lanes.
export function stepAside(sim, e, squad) {
  const { hx, hz, fighters } = squad, px = -hz, pz = hx;
  if (!fighters.length) return null;
  const along = (u) => u.x * hx + u.z * hz, across = (u) => u.x * px + u.z * pz;
  const rear = Math.min(...fighters.map(along)), lat = across(e);
  if (along(e) <= rear - TRAIL) return null;
  const clear = (l) => fighters.every((f) => along(f) > along(e) || Math.abs(l - across(f)) >= e.radius + f.radius + 0.6);
  if (clear(lat)) return null;
  // The nearest clear lane, on the side away from the fighters' middle first.
  const mid = fighters.reduce((n, f) => n + across(f), 0) / fighters.length, away = lat >= mid ? 1 : -1;
  for (const shift of [2, 4, 6, 8]) for (const sign of [away, -away]) {
    const l = lat + sign * shift, x = e.x + px * sign * shift, z = e.z + pz * sign * shift;
    if (clear(l) && Math.abs(x) < sim.terrain.half - 3 && Math.abs(z) < sim.terrain.half - 3 && sim.nav.canStand(x, z, e.radius)) return { x, z };
  }
  return null;
}

// One squad's centre and its rearmost fighter line this tick. Cached per simulation and tick, off the
// hashed state; computed on the first member's turn, so a continuous run and a reloaded one agree.
const CACHE = new WeakMap();
export function squadInfo(sim, o) {
  let c = CACHE.get(sim);
  if (!c || c.tick !== sim.ticks) CACHE.set(sim, (c = { tick: sim.ticks, map: new Map() }));
  let info = c.map.get(o.squad);
  if (info) return info;
  const live = [];
  for (const id of o.members) {
    const m = sim.get(id);
    if (m && m.hp > 0 && m.orders?.[0]?.squad === o.squad) live.push(m);
  }
  let cx = 0, cz = 0;
  for (const m of live) { cx += m.x; cz += m.z; }
  if (live.length) { cx /= live.length; cz /= live.length; }
  // The rearmost fighter that keeps with the group, measured along the heading.
  let rear = Infinity;
  for (const m of live) if (squadRole(m) !== "support" && !m.flying && hyp(m.x - cx, m.z - cz) <= KEEP) rear = Math.min(rear, m.x * o.hx + m.z * o.hz);
  info = { n: live.length, cx, cz, rear };
  c.map.set(o.squad, info);
  return info;
}

// The speed a unit on a group order walks at (traits.js moveSpeed): its own speed when it is in combat,
// flies, or is far from the group; otherwise the group pace, and a support unit that would pass the
// fighters slows further so it stays behind them.
// The unit escort.js is moving behind the fighters this step (it walks at its own speed); not state.
let FREE = null;
export function freeStep(e) { FREE = e; }
export function groupSpeed(sim, e, o) {
  if (e === FREE || e.flying || !(o.cap > 0)) return e.speed;
  // (A support unit's cooldown is its healing beat, not a shot: it keeps the pace while it mends.)
  if ((e.cooldown > 0 && !e.support) || sim.time - (e.hitAt ?? -99) < COMBAT) return e.speed;
  const info = squadInfo(sim, o);
  if (info.n < 2 || hyp(e.x - info.cx, e.z - info.cz) > KEEP) return e.speed;
  let speed = Math.min(e.speed, o.cap);
  if (o.trail && !o.aside && info.rear < Infinity &&e.x * o.hx + e.z * o.hz > info.rear - TRAIL) speed = Math.min(speed, o.cap * HOLD_BACK);
  return speed;
}
