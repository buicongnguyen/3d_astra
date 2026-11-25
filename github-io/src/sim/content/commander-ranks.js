// Commander ranks (Frontier Defence, 2026-11-25; owner request: "build it with the two ranks or even
// more so that it can be similar to other unit in the defence play"). The Field commander is bought up
// like a tower: Rank 2 and Rank 3 (GARRISONS.commander.ranks), then one of two branches, Artillery or
// Rally (commander.branches), each with two ranks. The figures each step sets are read by
// commanderStats (src/sim/defence/commander.js), which spawnCommander and heroCast use, so a commander
// that falls comes back with every rank it had.
//
// State: lazy keys on `defence.hero` (created on the first purchase): `rank` (2 or 3), `branch` and
// `branchRank` (1 or 2). The live commander carries `heroRank` (1 to 5) and `heroBranch` for the
// view's trim. A match where nothing is bought keeps exactly the state it had before (the golden pins
// and check:defence, whose DefenceBot buys no commander rank unless asked, do not move).
//
// Kept apart from the `commander` mixin, whose keys tests/mixins.test.js pins, as R3-C did for the
// Combined armour step.
import { DEFINITIONS as D } from "../../data.js";
import GARRISONS from "../../defence/garrisons.json" with { type: "json" };
import { commanderStats, commanderLevel } from "../defence/commander.js";

const TEAM = 0;

// The commander's next step, or null when it has the top rank of its branch:
//   { kind: "rank", rank, cost }                 Rank 2 or Rank 3
//   { kind: "branch", costs: { id: cost } }      a branch's first rank, one of the two
//   { kind: "branchRank", branch, rank, cost }   the branch's second rank
export function nextCommanderStep(h) {
  const c = GARRISONS.commander, rank = h?.rank || 1;
  if (!h || !c.ranks) return null;
  if (rank - 1 < c.ranks.length) return { kind: "rank", rank: rank + 1, cost: c.ranks[rank - 1].cost };
  if (!c.branches) return null;
  if (!h.branch) return { kind: "branch", costs: Object.fromEntries(Object.entries(c.branches).map(([id, b]) => [id, b.ranks[0].cost])) };
  const ranks = c.branches[h.branch].ranks, at = h.branchRank || 0;
  return at < ranks.length ? { kind: "branchRank", branch: h.branch, rank: at + 1, cost: ranks[at].cost } : null;
}

export const commanderRanks = {
  id: "commander-ranks",
  mixin: {
    commanderNextUpgrade() {
      return this.defence?.hero ? nextCommanderStep(this.defence.hero) : null;
    },
    // Rank 2, Rank 3 (no branch given), then a branch by id, then the branch's next rank (no branch
    // given, or its own id). Bought while the commander is down too: it comes back with it.
    commanderUpgrade(team, branch = null) {
      const h = this.defence?.hero, next = h ? nextCommanderStep(h) : null;
      if (!this.defence || this.result || team !== TEAM || !next) return false;
      if (next.kind === "branch" ? !GARRISONS.commander.branches[branch] : branch && branch !== next.branch) return false;
      const cost = next.kind === "branch" ? next.costs[branch] : next.cost;
      if (this.players[team].alloy < cost) { this.message(`Need ${Math.ceil(cost - this.players[team].alloy)} more alloy.`, team); return false; }
      this.players[team].alloy -= cost;
      const from = commanderStats(h);
      if (next.kind === "rank") h.rank = next.rank;
      else if (next.kind === "branch") { h.branch = branch; h.branchRank = 1; }
      else h.branchRank = next.rank;
      const to = commanderStats(h), e = this.commander();
      if (e) {
        // Health grows by what the step adds, and so does its health before veteran ranks (baseHp),
        // so a later promotion keeps it (as sim/defence/armour.js armourBoost).
        if (to.hp !== from.hp) {
          const max = Math.round((e.maxHp / from.hp) * to.hp);
          e.hp = Math.min(max, e.hp + Math.max(0, max - e.maxHp));
          e.maxHp = max;
          this.setBaseHp(e, Math.round(((e.baseHp ?? D[e.type].hp * from.hp) / from.hp) * to.hp));
        }
        if (to.shield !== from.shield) { e.maxShield = to.shield; e.shield = Math.min(to.shield, (e.shield || 0) + to.shield - from.shield); }
        e.heroRank = commanderLevel(h);
        if (h.branch) e.heroBranch = h.branch;
      }
      this.events.push({ type: "heroUpgrade", rank: commanderLevel(h), ...(h.branch ? { branch: h.branch } : {}), team, ...(e ? { id: e.id, x: e.x, z: e.z } : {}) });
      return true;
    },
  },
  commands: {
    // The commander's next rank, or (`branch`) its branch.
    heroUpgrade: {
      allowed: (sim, c) => !!sim.defence?.hero && (c.branch === undefined || typeof c.branch === "string"),
      run: (sim, c) => sim.commanderUpgrade(c.team, c.branch ?? null),
    },
  },
};
