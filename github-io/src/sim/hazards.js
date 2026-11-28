// H8 explosive crates and barrels (HERO-COINS-PLAN.md "H8 also includes", owner 2026-11-28). Pure rules, no DOM:
//   planHazards(sim, pieces)  a few spots (HAZARD.per128 a 128 m map, clamped) next to the match's cover pieces, by a
//                             seeded search of its own (the cover's own pieces and their order are untouched): beside a
//                             piece's end or face, on standing ground, clear of buildings, deposits, units and each other
//   hazardAt(list, x, z, r)   the intact hazard nearest (x, z) within r metres, as its index, or -1
//   blowHazard(sim, i, by)    the blast: HAZARD.damage to every hostile unit of `by`'s side within HAZARD.radius
//                             (buildings and walls by their edge, at HAZARD.buildings); never the hero's side, never
//                             the hero; a `hazardBlast` event for the view
// A hazard is [x, z, intact (1 or 0)], kept in the match state next to the cover (`sim.hazards`), so saves, hashes and
// replays carry it. Only the driven hero's shots set one off (sim/content/hero-mode.js heroFire `barrel`): RTS units
// never aim at them and nothing else reads the list, so normal play is unchanged. The drawn batch is hazard-view.js.
import { fnv1a, mulberry32 } from "../rng.js";
import { COVER_KINDS } from "./cover.js";

export const HAZARD = Object.freeze({ per128: 4, min: 3, max: 6, radius: 4, damage: 110, buildings: 0.5, size: 0.55, spacing: 12, building: 5, deposit: 4, unit: 3, aim: 1.4 });
const round = (v) => Math.round(v * 100) / 100;

// The spots beside a piece a hazard may stand on: off each end, then before and behind its middle.
function besides(p) {
  const K = COVER_KINDS[p[0]], c = Math.cos(p[3]), s = Math.sin(p[3]);
  const at = (u, v) => [p[1] + c * u - s * v, p[2] + s * u + c * v];
  return [at(K.L + 1.1, 0), at(-K.L - 1.1, 0), at(0, K.W + 1.1), at(0, -K.W - 1.1)];
}

export function planHazards(sim, pieces) {
  if (!pieces?.length) return [];
  const T = sim.terrain, rng = mulberry32(fnv1a(`hazard:${T.id}`));
  const want = Math.max(HAZARD.min, Math.min(HAZARD.max, Math.round((HAZARD.per128 * T.size) / 128)));
  const order = pieces.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const out = [];
  for (const i of order) {
    if (out.length >= want) break;
    const spots = besides(pieces[i]), first = Math.floor(rng() * spots.length);
    for (let k = 0; k < spots.length; k++) {
      const [x, z] = spots[(first + k) % spots.length];
      if (!sim.nav.canStand(x, z, HAZARD.size)) continue;
      if (out.some((h) => Math.hypot(h[0] - x, h[1] - z) < HAZARD.spacing)) continue;
      if (pieces.some((q) => q !== pieces[i] && Math.hypot(q[1] - x, q[2] - z) < COVER_KINDS[q[0]].L + 0.9)) continue;
      if (sim.entities.some((e) => e.hp > 0 && (e.kind === "building" || e.kind === "wall") && Math.hypot(e.x - x, e.z - z) < (e.radius || 1) + HAZARD.building)) continue;
      if (sim.entities.some((e) => e.hp > 0 && e.kind === "unit" && !e.flying && Math.hypot(e.x - x, e.z - z) < (e.radius || 0.6) + HAZARD.unit)) continue;
      if (sim.resources.some((r) => Math.hypot(r.x - x, r.z - z) < (r.radius || 1.5) + HAZARD.deposit)) continue;
      out.push([round(x), round(z), 1]);
      break;
    }
  }
  return out;
}

export function hazardAt(list, x, z, r = HAZARD.aim) {
  let best = -1, bd = r;
  for (let i = 0; i < (list?.length || 0); i++) {
    const h = list[i];
    if (!h[2]) continue;
    const d = Math.hypot(h[0] - x, h[1] - z);
    if (d <= bd) { best = i; bd = d; }
  }
  return best;
}

// The blast of hazard i, set off by the driven hero `by`. Returns how many it hit, or -1 when it was not there.
export function blowHazard(sim, i, by) {
  const h = sim.hazards?.[i];
  if (!h || !h[2] || !by) return -1;
  h[2] = 0;
  let hit = 0, kills = 0;
  for (const t of [...sim.entities]) {
    if (t.hp <= 0 || t === by || !sim.hostile(by.team, t.team) || t.flying) continue;
    if (t.kind !== "unit" && t.kind !== "building" && t.kind !== "wall") continue;
    const d = Math.hypot(t.x - h[0], t.z - h[1]) - (t.kind === "unit" ? 0 : t.radius || 0);
    if (d > HAZARD.radius) continue;
    sim.applyDamage(t, HAZARD.damage * (t.kind === "unit" ? 1 : HAZARD.buildings), by.team, by.id);
    hit++;
    if (t.hp <= 0) kills++;
  }
  sim.events.push({ type: "hazardBlast", i, x: h[0], z: h[1], radius: HAZARD.radius, team: by.team, by: by.id, hit, kills });
  return hit;
}
