// Faction signature abilities (2026-11-24, faction depth pass; owner: "one signature ability per faction
// unit, no micro chores"). The three faction-own units that had no ability get one each, and every one
// casts on its own (auto-cast) so a phone player never has to press anything:
//   Supply wagon (Sunward)  Spur on       allies within `radius` m move `speed` x faster for `duration` s
//                                         (the "spurred" status). Sunward is the fast, road-running side.
//   Sentinel drone (Wardens) Shield link  at once, itself and allies within `radius` m regain `shield`
//                                         shield (never above their maximum). Wardens hold the line.
//   Shade (Veil)            Shadow strike for `duration` s the Shade moves `speed` x faster, and its first
//                                         hit deals `contact` extra damage, once per cast. Veil strikes
//                                         from hiding: it casts on its own only while hidden.
// Numbers live in balance.json under each unit's `ability`, so tuning them is a data edit.
//
// Computer sides (difficulty guard, owner rule "never make Relaxed or Normal harder"): a computer team
// casts these only in a skirmish at the Fast or Relentless AI speed. On Relaxed and Normal, and in every
// story mission and chronicle, its wagons, drones and Shades fight exactly as before.
//
// Every hook answers only for these three abilities (or the Shade's own buff); a match with none of the
// units runs nothing new and keeps its state hash. State: the lazy status keys (sim/effects.js) on spurred
// units, and the Shade's lazy `lunge` flag while its buff runs (deleted when the buff ends, sim/content.js).
import balance from "../../balance.json" with { type: "json" };
import { distance } from "../../data.js";

export const SPUR = "spurs", SHIELD_LINK = "shieldlink", SHADOW_STRIKE = "shadowstrike";
const SPUR_DATA = balance.definitions.wagon.ability;
// The AI speeds whose computer sides use the signature abilities.
export const SIGNATURE_AI_SPEEDS = new Set(["fast", "relentless"]);

// True when this unit's side may cast its signature ability on its own now.
export function signatureAutocastAllowed(sim, e) {
  const computer = e.team > 0 || !!sim.aiPlayer;
  if (!computer) return true;
  return !sim.mission && !sim.defence && SIGNATURE_AI_SPEEDS.has(sim.aiSpeed);
}

const groundAlly = (sim, e, t) => t.team === e.team && t.hp > 0 && t.kind === "unit" && !t.flying && !t.boss;
const seenFoe = (sim, e, t) => t.hp > 0 && (t.kind === "unit" || t.kind === "building") && sim.hostile(e.team, t.team) && sim.isVisible(t, e.team);

export const signatures = {
  id: "signatures",
  statuses: {
    // Spur on: faster for a few seconds. Drawn with the horseshoe.
    spurred: { speed: SPUR_DATA.speed, icon: "horseshoe", label: "Spurred", tint: SPUR_DATA.tint },
  },
  abilities: {
    [SPUR]: {
      // Instant: every friendly ground unit within reach (the wagon too) is spurred.
      use(sim, e, a) {
        let n = 0;
        for (const t of sim.entities) if (groundAlly(sim, e, t) && distance(e, t) <= a.radius + (t.radius || 0) && sim.applyStatus(t, "spurred", a.duration)) n++;
        return n > 0 ? {} : false;
      },
    },
    [SHIELD_LINK]: {
      // Instant: shield back for itself and every ally within reach that has a shield to fill.
      use(sim, e, a) {
        let n = 0;
        for (const t of sim.entities) {
          if (t.team !== e.team || t.hp <= 0 || t.kind !== "unit" || !(t.maxShield > 0) || t.shield >= t.maxShield) continue;
          if (t.id !== e.id && distance(e, t) > a.radius + (t.radius || 0)) continue;
          t.shield = Math.min(t.maxShield, t.shield + a.shield);
          n++;
        }
        return n > 0 ? {} : false;
      },
    },
    [SHADOW_STRIKE]: {
      // A timed buff: faster, and the `lunge` flag the first hit clears.
      use(sim, e, a) {
        return { change: { speed: e.speed * (a.speed || 1.4), lunge: 1 } };
      },
    },
  },
  // Shadow strike's first contact: extra damage on the target, once per cast, and the shot says so.
  onHit(sim, e, t, tags) {
    if (e.buff?.id !== SHADOW_STRIKE || !e.lunge) return;
    e.lunge = 0;
    tags.push(SHADOW_STRIKE);
    if (t.hp > 0) sim.applyDamage(t, e.ability?.contact ?? 0, e.team, e.id);
  },
  autocast(sim, e, a) {
    if (a.id !== SPUR && a.id !== SHIELD_LINK && a.id !== SHADOW_STRIKE) return undefined;
    if (!signatureAutocastAllowed(sim, e)) return false;
    if (a.id === SPUR) {
      // Three or more fighters around the wagon, and an enemy in sight within 16 m: a charge or a getaway.
      let fighters = 0, foe = false;
      for (const t of sim.entities) {
        if (!foe && seenFoe(sim, e, t) && !t.flying && distance(e, t) <= 16) foe = true;
        if (groundAlly(sim, e, t) && t.id !== e.id && t.damage > 0 && t.type !== "worker" && distance(e, t) <= a.radius + (t.radius || 0)) fighters++;
        if (foe && fighters >= 3) return true;
      }
      return false;
    }
    if (a.id === SHIELD_LINK) {
      // Two or more shields within reach (its own counts) below half.
      let low = 0;
      for (const t of sim.entities) {
        if (t.team !== e.team || t.hp <= 0 || t.kind !== "unit" || !(t.maxShield > 0) || t.shield >= t.maxShield * 0.5) continue;
        if (t.id === e.id || distance(e, t) <= a.radius + (t.radius || 0)) { if (++low >= 2) return true; }
      }
      return false;
    }
    // Shadow strike: hidden, with an enemy ground unit in sight within 9 m.
    if (!e.cloaked) return false;
    for (const t of sim.entities)
      if (t.kind === "unit" && !t.flying && seenFoe(sim, e, t) && distance(e, t) <= 9) return true;
    return false;
  },
};
