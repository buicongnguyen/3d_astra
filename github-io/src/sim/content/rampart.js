// The Rampart's Ram (AAA round 2, W2-A; the unit is `rampart` in balance.json, an Ashfall workshop
// unit). The rest of the Rampart is data: its facing armour is the generic facing module, its wall
// bonus the `wall_bonus` field read below, its numbers balance.json.
//
// Ram is a registered ability, a generic timed buff: for its `duration` the unit moves `speed` x
// faster, and the first shot that lands during the buff (the "first contact") deals `contact` extra
// damage, once per cast. There is no push-back (movement is shared code). The buff carries a flag key
// `ram` that the first contact clears; the flag is not on the unit before the cast and is deleted
// when the buff ends, so afterwards the unit's keys are what they were (sim/content.js).
//
// Autocast: when an enemy building or a group of three or more enemy ground units is within 10 m.
//
// Every hook answers only for a unit that has the ability, the buff or the field: in a match with no
// Rampart they return nothing and change nothing (no state, no tags), so no pin moves.

import { distance } from "../../data.js";

export const RAM = "ram";

export const rampart = {
  id: "rampart",
  abilities: {
    // The speed factor and the contact damage come from the unit's ability data (balance.json).
    [RAM]: {
      use(sim, e, a) {
        return { change: { speed: e.speed * (a.speed || 2), ram: 1 } };
      },
    },
  },
  // x2 (the unit's `wall_bonus`) against walls: kind "wall" is not a building, so building_bonus misses it.
  hitScale(sim, e, t) {
    return e.wall_bonus && t.kind === "wall" ? e.wall_bonus : undefined;
  },
  // The first contact of a cast: extra damage on the target, once, and the shot says so.
  onHit(sim, e, t, tags) {
    if (e.buff?.id !== RAM || !e.ram) return;
    e.ram = 0;
    tags.push(RAM);
    if (t.hp > 0) sim.applyDamage(t, e.ability?.contact ?? 0, e.team, e.id);
  },
  autocast(sim, e, a) {
    if (a.id !== RAM) return undefined;
    let group = 0;
    for (const t of sim.entities) {
      if (t.hp <= 0 || t.flying || (t.kind !== "unit" && t.kind !== "building") || !sim.hostile(e.team, t.team) || !sim.isVisible(t, e.team)) continue;
      if (t.kind === "building") { if (distance(e, t) - t.radius <= 10) return true; }
      else if (distance(e, t) <= 10 && ++group >= 3) return true;
    }
    return false;
  },
};
