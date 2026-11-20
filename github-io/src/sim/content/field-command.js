// Field command roles (AAA round 2, W2-D). `aiRules` entry, run after each AI think's production, only for
// a computer team under `rules.aiPlan === "field"` in a skirmish. A unit definition's `ai.role` places it:
//   back   holds 6 to 8 m behind the centre of the attack group (the units with an `aiw` order), on the home side
//   front  leads: sent ahead of the group, 4 m in front of its centre
//   line   holds with the main group (no order of its own)
// Units that are already ordered, hurt and retreating or not fighters are left alone. No state is kept.
import { DEFINITIONS as D, distance } from "../../data.js";
import { fieldPlan } from "../../ai-plan.js";

function place(sim, team, { army, hq }) {
  if (!hq || !fieldPlan(sim, team)) return;
  const group = army.filter((e) => e.orders.some((o) => o.aiw));
  if (group.length < 2) return;
  const lead = group.filter((e) => !D[e.type].ai?.role || D[e.type].ai.role === "line");
  const core = lead.length ? lead : group;
  const cx = core.reduce((n, e) => n + e.x, 0) / core.length, cz = core.reduce((n, e) => n + e.z, 0) / core.length;
  const goal = group[0].orders.find((o) => o.aiw), gx = goal.x ?? cx, gz = goal.z ?? cz;
  const dx = gx - cx, dz = gz - cz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  for (const e of army) {
    const role = D[e.type].ai?.role;
    if ((role !== "back" && role !== "front") || e.retreating || e.orders.length || !(e.damage > 0) || e.pointDuty) continue;
    const off = role === "back" ? -7 : 4, x = cx + ux * off, z = cz + uz * off;
    if (distance(e, { x, z }) < 3) continue;
    const spot = sim.nav.canStand(x, z, e.radius) ? { x, z } : sim.nav.nearest(x, z, e.radius);
    if (spot) sim.issue([e.id], { type: role === "front" ? "attackmove" : "move", x: spot.x, z: spot.z });
  }
}

export const fieldCommand = { id: "fieldCommand", aiRules: [{ id: "fieldCommand", run: place }] };
