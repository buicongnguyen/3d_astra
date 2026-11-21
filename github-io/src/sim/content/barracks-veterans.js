// Veteran intake (AAA round 3, R3-C; owner decision O4). Under the Expanded roster (skirmish rule
// `roster: "expanded"`), every fighting recruit a Barracks of level 3 or more trains arrives at rank 1:
// the same rank a unit earns with its first kills (sim/tactics.js RANK_XP, RANK_BONUS), so it starts
// with +8% damage and health, the gold chevron over its head (tactics-view.js) and the 3 experience
// that rank needs. Medics (and the Sunward wagon) do not fight and earn no ranks, so they arrive as
// they are. There is no research: levelling the Barracks to 3 is the whole price.
//
// Which building trained the unit: production (sim/economy.js updateProduction) puts a new unit on
// exitPoint(b, d), a point of a fixed ring of spots around its building. The hook asks each of the
// team's level-3 Barracks whether the unit stands exactly on one of its ring spots, worked out with
// the same arithmetic, so two neighbouring Barracks of different levels are never confused.
//
// Whose Barracks: a Barracks the side's commander ordered to level 3 (the `upgrade` command,
// src/commands.js, which calls veteranOrder and sets the lazy flag `b.veterans`). The computer levels
// its Barracks without a command, so its recruits arrive as before: the Expanded AI pins
// (tests/golden-expanded.test.js "expanded meridian 600") and the benches stay exactly as they were.
// Dropping the `b.veterans` test in veteranIntake gives the AI veterans too (and moves that pin).
//
// State: `b.veterans` on a Barracks the player ordered to level 3, and the recruit's own `rank` and
// `xp` (keys every veteran already has). A match without the Expanded roster, or without such a
// Barracks, never changes anything: the hook returns at once.
import { DEFINITIONS as D } from "../../data.js";
import { RANK_XP, RANK_BONUS } from "../tactics.js";
import { combinedSquads } from "../defence/armour.js";
import { EXIT_ORDER } from "../economy.js";

export const VETERAN_LEVEL = 3;

// True when (x, z) is one of the spots exitPoint() tries around building `b` (economy.js: the same
// loop, the same float steps, so a match is exact). Since R3-L the spots follow EXIT_ORDER (south first).
export function onExitRing(b, x, z) {
  for (let r = b.radius + 2.5; r <= b.radius + 16; r += 1.5)
    for (const dir of EXIT_ORDER) if (b.x + dir.x * r === x && b.z + dir.z * r === z) return true;
  return false;
}

// A unit that can earn ranks (as sim/tactics.js earnsRanks) and that a Barracks trains.
const recruit = (e) => e.kind === "unit" && !e.boss && e.type !== "worker" && !!e.damage && !e.flying;

// Whether this side's Barracks recruits arrive as veterans now: Expanded roster and a level-3 Barracks.
// The production card reads it for its note ("Recruits arrive as veterans").
export function veteranIntake(sim, b) {
  return !!b && b.type === "barracks" && !!b.veterans && b.complete && (b.level || 1) >= VETERAN_LEVEL && sim.ruleOn("roster") === "expanded";
}
// What the production card says about a Barracks under the Expanded roster: "Recruits arrive as
// veterans" once it is level 3 (or is being raised to it by its commander), "" otherwise.
export function veteranNote(sim, b) {
  if (!b || b.type !== "barracks" || sim.ruleOn("roster") !== "expanded") return "";
  return veteranIntake(sim, b) || (b.veterans && b.levelJob) ? "Recruits arrive as veterans" : b.level < VETERAN_LEVEL ? "Level 3: recruits arrive as veterans" : "";
}

export const barracksVeterans = {
  id: "barracks-veterans",
  mixin: {
    // R3-C's other sim change rides on this module: the Combined armour-squad step (Frontier Defence),
    // armourCombinedCost(squad) and armourCombine(team, squad), from src/sim/defence/armour.js.
    ...combinedSquads,
    // The `upgrade` command (src/commands.js) after an accepted order: a Barracks ordered from level 2
    // to 3 under the Expanded roster gets the lazy flag. Kept when the order is cancelled; it only
    // counts once the Barracks stands at level 3.
    veteranOrder(id) {
      const b = this.get(id);
      if (b?.type === "barracks" && b.levelJob && b.level === VETERAN_LEVEL - 1 && this.ruleOn("roster") === "expanded") b.veterans = true;
    },
  },
  onSpawn(sim, e) {
    if (e.kind !== "unit" || e.rank || sim.ruleOn("roster") !== "expanded" || !recruit(e)) return;
    for (const b of sim.entities) {
      if (b.team !== e.team || b.hp <= 0 || !veteranIntake(sim, b) || !b.trains?.includes(e.type)) continue;
      if (!onExitRing(b, e.x, e.z)) continue;
      // As a first promotion (sim/tactics.js creditKill), on a unit that has taken no damage yet.
      e.rank = 1;
      e.xp = RANK_XP[0];
      e.maxHp = Math.round((e.baseHp ?? D[e.type].hp) * (1 + RANK_BONUS));
      e.hp = e.maxHp;
      return;
    }
  },
};
