// Kite Dive (2026-11-24; owner: "the kite should see a larger distance ... The kite can suicide into
// vehicles?"). The Kite scout (balance.json definitions.kite.ability) gets one MANUAL ability: it crashes
// into the nearest enemy vehicle within `range` m and is lost.
//   vehicle   a living enemy ground unit with `mechanical: true` (Tank, Walker, Breaker, Scorcher, Supply
//             wagon, Sentinel drone, Rampart, Lancer, Bulwark, Carrier, the iron bosses...). Flyers,
//             infantry, buildings and walls are never the target.
//   damage    `damage` to the vehicle; every other enemy within `radius` m of it (ground only) takes
//             `splash` of that, and infantry and buildings only `soft` of the splash. Two Kites leave a
//             Battle tank (520 + 100 shield) on 100 health; three destroy it even through Composite plating.
//   no target nothing happens and the Kite stays (the tile reads "No vehicle near", tactics-ui.js).
//
// Sight: every player's Kite sees `vision` (32 m, about twice a soldier). A computer side's Kite sees that far
// only where it may dive (Fast or Relentless skirmish); on Relaxed and Normal, in story missions, chronicles
// and Defence it keeps `ai_vision` (18 m, the old sight), so the computer's scouting there is exactly as
// before (owner rule: never make Relaxed or Normal harder; the difficulty gate with the Field plan lost a
// Relaxed match when every computer Kite saw 32 m). Farsight (Veil) still adds its 3 m on top.
//
// Never auto-cast for a player: the Auto-cast setting would throw scouts away, so the hook answers false
// for every human side. A computer side dives only in a skirmish at the Fast or Relentless AI speed (the
// signature rule, sim/content/signatures.js); on Relaxed and Normal, in story missions, chronicles and
// Defence its Kites only scout, as before.
//
// State: none until a Kite dives. The dive is instant (one tick): the damage, then the Kite's death
// event (marked `dive`), then the ability event with the target point for the view (streak + blast).
import { DEFINITIONS as D, distance } from "../../data.js";
import { signatureAutocastAllowed } from "./signatures.js";

export const DIVE = "dive";

// True for an enemy vehicle `e` may dive into.
export const diveVictim = (sim, e, t) =>
  t.hp > 0 && t.kind === "unit" && t.mechanical && !t.flying && sim.hostile(e.team, t.team) && sim.isVisible(t, e.team);

// The nearest enemy vehicle within the dive's reach of `e` (ties: the first in sim.entities), or null.
export function diveTarget(sim, e, a = e.ability) {
  if (!a || a.id !== DIVE) return null;
  let best = null, bd = Infinity;
  for (const t of sim.entities) {
    if (!diveVictim(sim, e, t)) continue;
    const d = distance(e, t);
    if (d <= a.range + (t.radius || 0) && d < bd) { best = t; bd = d; }
  }
  return best;
}

const computerSide = (sim, e) => e.team > 0 || !!sim.aiPlayer;

export const kiteDive = {
  id: "kiteDive",
  onSpawn(sim, e) {
    const d = D[e.type];
    if (!(d?.ai_vision < d?.vision) || !computerSide(sim, e) || signatureAutocastAllowed(sim, e)) return;
    e.vision -= d.vision - d.ai_vision;
  },
  abilities: {
    [DIVE]: {
      use(sim, e, a) {
        const t = diveTarget(sim, e, a);
        if (!t) return false;
        const at = { x: t.x, z: t.z };
        // The splash first (everyone near the vehicle, the vehicle itself excluded), then the vehicle.
        const splash = a.damage * (a.splash ?? 0);
        if (splash > 0)
          for (const o of sim.entities) {
            if (o === t || o.hp <= 0 || o.flying || o.team === e.team || !sim.hostile(e.team, o.team)) continue;
            if (o.kind !== "unit" && o.kind !== "building" && o.kind !== "wall") continue;
            if (distance(o, at) - (o.kind === "unit" ? 0 : o.radius || 0) > a.radius) continue;
            sim.applyDamage(o, splash * (o.kind === "unit" && o.mechanical ? 1 : a.soft ?? 1), e.team, e.id);
          }
        sim.applyDamage(t, a.damage, e.team, e.id);
        // The Kite is spent: no kill credit for anyone, no refund (it was not shot down).
        e.shield = 0;
        e.hp = 0;
        e.orders = [];
        sim.events.push({ type: "death", x: e.x, z: e.z, team: e.team, building: false, heavy: true, core: false, seed: e.id, direction: Math.atan2(at.x - e.x, at.z - e.z), dive: true, tx: at.x, tz: at.z });
        // An instant ability's `at` becomes the ability event's tx/tz (sim/content.js contentAbility).
        return { at };
      },
    },
  },
  autocast(sim, e, a) {
    if (a.id !== DIVE) return undefined;
    // Players: never (manual only, whatever the Auto-cast setting says).
    if (!computerSide(sim, e)) return false;
    if (!signatureAutocastAllowed(sim, e)) return false;
    return !!diveTarget(sim, e, a);
  },
};
