// The Stalker's Steady aim (AAA round 2, W1-C; the unit is `stalker` in balance.json, a Veil workshop
// unit). Nothing else of the Stalker is code: its target preference is the generic `prefers` list
// (sim/combat.js preferredEnemy), its cloak the Veil trait's re-cloak after 3 s without firing
// (sim/traits.js), its numbers are data. See docs/CONTENT_SEAMS.md for the module API.
//
// Steady aim is a registered ability, a generic timed buff: while it lasts the unit has +`range` metres
// of reach and `pierce` (the share of a target's shield its shots pass: 1 = all of it, sim/defence.js
// garrisonPierce, which combat.js already calls whenever an entity has `pierce`). When the buff ends
// both keys are put back: `range` gets its old value and `pierce`, which the Stalker does not have
// otherwise, is deleted, so the unit's keys are what they were before the cast.
//
// Every hook answers only for the Stalker's own ability and buff: in a match with no Stalker they
// return nothing and change nothing (no state, no tags), so no pin moves.

import { distance } from "../../data.js";

export const STEADY_AIM = "steadyaim";

export const marksman = {
  id: "marksman",
  abilities: {
    [STEADY_AIM]: {
      // The reach and the pierce come from the unit's ability data (balance.json), so tuning them is a
      // data edit. `e.range` is the unit's own: a running buff has already been taken off.
      use(sim, e, a) {
        return { change: { range: e.range + (a.range || 0), pierce: a.pierce ?? 1 } };
      },
    },
  },
  // A shot fired under Steady aim says so (the shot event's `tags`, read by the weapon looks and the labels).
  onHit(sim, e, t, tags) {
    if (e.buff?.id === STEADY_AIM) tags.push("pierce");
  },
  // Cast when something the unit prefers is within reach of the longer range: a shot at it is worth the
  // pierce. Every other ability is left to today's rules (undefined).
  autocast(sim, e, a) {
    if (a.id !== STEADY_AIM) return undefined;
    const prefers = e.prefers;
    if (!prefers) return false;
    const reach = e.range + (a.range || 0);
    for (const t of sim.entities) {
      if (t.hp <= 0 || t.kind !== "unit" || !prefers.includes(t.class)) continue;
      if (!sim.hostile(e.team, t.team) || !sim.isVisible(t, e.team)) continue;
      if (t.flying && !sim.canHit(e, t)) continue;
      if (distance(e, t) - t.radius <= reach + 0.00001) return true;
    }
    return false;
  },
};
