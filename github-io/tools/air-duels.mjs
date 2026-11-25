// W7 equal-cost duels (docs/BALANCE.md "W7 depth"): each new air ability off and on (cast as a player's Auto-cast
// would, both sides), budget 1000, 10 battles each. Usage: node tools/air-duels.mjs
import { duel } from "../tests/lib/duel.mjs";
import { AIR_STRIKES, strafeAim, strafeLine, strafeVictims, bombTarget } from "../src/sim/content/air-strikes.js";
import { densest } from "../src/sim/content/ai-casts.js";
const cast = (s) => {
  if (s.ticks % 5) return;
  for (const e of s.entities) {
    if (e.hp <= 0 || !e.ability || !AIR_STRIKES.has(e.ability.id) || !s.abilityReady(e)) continue;
    const a = e.ability;
    if (a.id === "strafe") { const aim = strafeAim(s, e, a); if (aim && strafeVictims(s, e, a, strafeLine(e, a, aim)).length >= 2) s.useAbility(e); }
    else if (a.id === "bomb") { if (bombTarget(s, e, a)) s.useAbility(e); }
    else { const p = densest(s, e, a.range, 3, 3); if (p) s.useAbility(e, p); }
  }
};
const F = { hawk: "meridian", balloon: "ashfall", glider: "sunward" };
const rows = [];
const pairs = [["hawk", ["vanguard", "ranger", "antitank", "tank", "scrapper", "halo"]], ["balloon", ["vanguard", "ranger", "antitank", "tank", "scrapper"]], ["glider", ["vanguard", "ranger", "rider", "worker", "tank"]]];
for (const [air, foes] of pairs) for (const foe of foes) {
  const factions = [F[air], foe === "scrapper" ? "ashfall" : foe === "rider" ? "sunward" : foe === "halo" ? "wardens" : "meridian"];
  const off = duel(air, foe, { factions });
  const on = duel(air, foe, { factions, each: cast });
  rows.push({ air, foe, off: +off.mean.toFixed(2), on: +on.mean.toFixed(2), winsOff: off.wins, winsOn: on.wins });
  console.log(JSON.stringify(rows.at(-1)));
}
