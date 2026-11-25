// Field command smart casts (AAA round 2, W2-D, idea S6). `autocast` for computer teams only, and only
// under `rules.aiPlan === "field"` in a skirmish: every other unit, team or match gets `undefined`
// (today's rules). Barrage and Burn line aim at the densest cluster (as bossAim picks it); Shield wall
// when a siege unit targets the Vanguard; Lock-on with a vehicle within range + 3; Overdrive to chase or
// to escape below 35% health; Brace when 3 or more enemies approach; Triage when 2 or more allies are below 60%.
import { distance } from "../../data.js";
import { fieldPlan, sharpSide } from "../../ai-plan.js";

const foes = (sim, e, r, pick = () => true) => {
  const out = [];
  for (const t of sim.entities)
    if (t.hp > 0 && t.kind === "unit" && sim.hostile(e.team, t.team) && distance(e, t) <= r && sim.isVisible(t, e.team) && pick(t)) out.push(t);
  return out;
};

// The middle of the biggest group of ground enemies within `reach` (units inside `radius` of each other), or null.
export function densest(sim, e, reach, radius, min = 1) {
  const list = foes(sim, e, reach, (t) => !t.flying);
  let best = null, most = 0, near = Infinity;
  for (const c of list) {
    let n = 0;
    for (const o of list) if (distance(c, o) <= radius) n++;
    const d = distance(e, c);
    if (n > most || (n === most && d < near)) { best = c; most = n; near = d; }
  }
  if (!best || most < min) return null;
  let x = 0, z = 0;
  for (const o of list) if (distance(best, o) <= radius) { x += o.x; z += o.z; }
  return { x: x / most, z: z / most };
}

const SHARP_CLASSIC = new Set(["barrage", "burnline", "dash", "rush", "focus"]);

export const aiCasts = {
  id: "aiCasts",
  autocast(sim, e, a) {
    // W8: Fast and Relentless skirmish rivals cast sensibly under either AI plan. Under the Classic plan only the
    // aimed shells (Barrage, Burn line at the densest cluster) and the three W8 rules below; the other abilities keep
    // today's "cast in a fight" rule there, which keeps them up more often (difficulty check: holding them weakened it).
    const sharp = sharpSide(sim, e.team), field = fieldPlan(sim, e.team);
    if (!sharp && !field) return undefined;
    if (!field && !SHARP_CLASSIC.has(a.id)) return undefined;
    switch (a.id) {
      case "barrage": case "burnline": {
        const p = densest(sim, e, a.range, a.radius);
        return p && distance(e, p) <= a.range ? p : false;
      }
      case "shieldwall":
        return foes(sim, e, 16, (t) => t.class === "siege" || t.siege_range).some((t) => sim.get(t.orders?.[0]?.target)?.id === e.id || distance(e, t) <= t.range + 3);
      case "lockon":
        return foes(sim, e, e.range + 3, (t) => t.mechanical).length > 0;
      case "overdrive": {
        if (e.hp < e.maxHp * 0.35) return foes(sim, e, 14).length > 0;
        const t = foes(sim, e, e.range + 10)[0];
        return !!t && distance(e, t) > e.range;
      }
      case "brace":
        return foes(sim, e, e.range + 8).length >= 3;
      case "triage": {
        let n = 0;
        for (const t of sim.entities) if (t.team === e.team && t.id !== e.id && t.kind === "unit" && t.hp > 0 && t.hp < t.maxHp * 0.6 && distance(e, t) <= a.radius) n++;
        return n >= 2;
      }
      // W8 (sharp only; Field command at Normal keeps today's rules): Dash and Rush close on a target just out of
      // reach or carry a badly hurt unit out of a fight, like Overdrive; Rapid fire waits for armed enemies in range
      // (a tower counts), not a Harvester or a wall.
      case "dash": case "rush": {
        if (!sharp) return undefined;
        if (e.hp < e.maxHp * 0.35) return foes(sim, e, 14, (t) => t.damage > 0).length > 0;
        const t = foes(sim, e, e.range + 10, (t) => t.damage > 0)[0];
        return !!t && distance(e, t) > e.range + 1;
      }
      case "focus": {
        if (!sharp) return undefined;
        if (foes(sim, e, e.range + 1, (t) => t.damage > 0 && t.type !== "worker" && (!t.flying || !!e.hits_air)).length) return true;
        const t = e.orders?.[0]?.type === "attack" ? sim.get(e.orders[0].target) : null;
        return !!t && t.kind === "building" && t.damage > 0 && distance(e, t) - t.radius <= e.range + 1;
      }
      default: return undefined;
    }
  },
};
