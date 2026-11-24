// Ward plates (faction roster, 2026-11-24): the Wardens' Bulwark (balance.json `bulwark`, a Wardens
// workshop unit) carries `ward: { radius, taken }`. Every other unit of its team within `radius` m takes
// `taken` x damage. Wards never stack (one factor however many Bulwarks stand near) and a Bulwark does
// not ward itself. Passive: no ability, no state. A match with no ward unit alive returns 1 at once
// (one filter of the entity list per tick, cached), so no pin moves.
const WARDS = new WeakMap();
function wards(sim) {
  let c = WARDS.get(sim);
  if (!c || c.tick !== sim.ticks || c.entities !== sim.entities) {
    c = { tick: sim.ticks, entities: sim.entities, list: sim.entities.filter((e) => e.ward && e.hp > 0 && e.kind === "unit") };
    WARDS.set(sim, c);
  }
  return c.list;
}

// The ward factor on `t` (1 when no friendly ward covers it).
export function wardFactor(sim, t) {
  if (t.kind !== "unit") return 1;
  const list = wards(sim);
  if (!list.length) return 1;
  for (const w of list) if (w !== t && w.team === t.team && Math.hypot(w.x - t.x, w.z - t.z) <= w.ward.radius) return w.ward.taken;
  return 1;
}

export const ward = {
  id: "ward",
  taken(sim, t) {
    return wardFactor(sim, t);
  },
};
