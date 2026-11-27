import { mergeContentCommands } from "./sim/content.js";

// The one door for player actions. The interface (and later a replay, a save or a network
// peer) sends plain objects: { team, type, ...arguments }. Each command is checked against
// the sender's team before it touches the match, and accepted commands are logged with the
// tick they arrived on, so a match can be replayed exactly from its options and this log.
const ownUnit = (sim, team, id) => { const e = sim.get(id); return !!e && e.team === team && e.kind === "unit"; };
const ownBuilding = (sim, team, id) => { const e = sim.get(id); return !!e && e.team === team && e.kind === "building"; };

const COMMANDS = {
  order: {
    // A selection can hold things that are not the sender's to command; only its own units obey.
    allowed: (sim, c) => Array.isArray(c.ids) && c.ids.some((id) => ownUnit(sim, c.team, id)),
    run: (sim, c) => sim.issue(c.ids.filter((id) => ownUnit(sim, c.team, id)), c.order, !!c.append),
  },
  train: { allowed: (sim, c) => ownBuilding(sim, c.team, c.building), run: (sim, c) => sim.enqueue(c.building, c.unit) },
  cancelTrain: { allowed: (sim, c) => ownBuilding(sim, c.team, c.building), run: (sim, c) => sim.cancelQueue(c.building, c.index) },
  build: { allowed: (sim, c) => ownUnit(sim, c.team, c.worker), run: (sim, c) => sim.build(c.worker, c.building, c.x, c.z) },
  cancelBuild: { allowed: (sim, c) => ownBuilding(sim, c.team, c.building), run: (sim, c) => sim.cancelBuilding(c.building) },
  upgrade: { allowed: (sim, c) => ownBuilding(sim, c.team, c.building), run: (sim, c) => sim.upgradeBuilding(c.building, c.team) && (sim.veteranOrder(c.building), true) },
  cancelUpgrade: { allowed: (sim, c) => ownBuilding(sim, c.team, c.building), run: (sim, c) => sim.cancelLevel(c.building, c.team) },
  rally: {
    allowed: (sim, c) => Array.isArray(c.ids) && c.ids.length > 0 && c.ids.every((id) => ownBuilding(sim, c.team, id)),
    run: (sim, c) => {
      for (const id of c.ids) sim.get(id).rally = c.rally ? { ...c.rally } : null;
      return true;
    },
  },
  stance: {
    allowed: (sim, c) => Array.isArray(c.ids) && c.ids.some((id) => ownUnit(sim, c.team, id)),
    run: (sim, c) => sim.setStance(c.ids.filter((id) => ownUnit(sim, c.team, id)), c.stance),
  },
  ability: {
    allowed: (sim, c) => Array.isArray(c.ids) && c.ids.some((id) => ownUnit(sim, c.team, id)),
    run: (sim, c) => sim.castAbilities(c.ids.filter((id) => ownUnit(sim, c.team, id)), Number.isFinite(c.x) ? { x: c.x, z: c.z } : null),
  },
  // Lets the player's units use their abilities on their own, as the computer's do.
  autocast: { allowed: () => true, run: (sim, c) => ((sim.players[c.team].autocast = !!c.on), true) },
  harvest: { allowed: () => true, run: (sim, c) => (sim.assignHarvesters(c.team), true) },
  // Frontier Defence (sim/defence.js): crew a pad, raise or sell a garrison, send the next wave early.
  padBuild: { allowed: (sim, c) => !!sim.defence && typeof c.pad === "string" && typeof c.crew === "string", run: (sim, c) => sim.padBuild(c.team, c.pad, c.crew) },
  padUpgrade: { allowed: (sim, c) => !!sim.defence && ownBuilding(sim, c.team, c.building) && !!sim.get(c.building).crew, run: (sim, c) => sim.padUpgrade(c.team, c.building) },
  padSell: { allowed: (sim, c) => !!sim.defence && ownBuilding(sim, c.team, c.building) && !!sim.get(c.building).crew, run: (sim, c) => sim.padSell(c.team, c.building) },
  waveCall: { allowed: (sim) => !!sim.defence, run: (sim, c) => sim.waveCall(c.team) },
  // 0.21: a tier-3 branch, the commander's moves and abilities, and blowing a bridge.
  padBranch: { allowed: (sim, c) => !!sim.defence && ownBuilding(sim, c.team, c.building) && !!sim.get(c.building).crew && typeof c.branch === "string", run: (sim, c) => sim.padBranch(c.team, c.building, c.branch) },
  heroMove: { allowed: (sim, c) => !!sim.defence?.hero && Number.isFinite(c.x) && Number.isFinite(c.z), run: (sim, c) => sim.heroMove(c.team, c.x, c.z) },
  heroCast: { allowed: (sim, c) => !!sim.defence?.hero && typeof c.ability === "string" && Number.isFinite(c.x) && Number.isFinite(c.z), run: (sim, c) => sim.heroCast(c.team, c.ability, c.x, c.z) },
  demolish: { allowed: (sim, c) => !!sim.defence && Number.isFinite(c.crossing), run: (sim, c) => sim.demolish(c.team, c.crossing) },
  // 0.23: a crew anywhere in a build zone, and the armour squads (buy, send, Guard or Hold the road).
  zoneBuild: { allowed: (sim, c) => !!sim.defence && typeof c.zone === "string" && typeof c.crew === "string" && Number.isFinite(c.x) && Number.isFinite(c.z), run: (sim, c) => sim.zoneBuild(c.team, c.zone, c.x, c.z, c.crew) },
  armourBuy: { allowed: (sim) => !!sim.defence && !!sim.armourRules(), run: (sim, c) => sim.armourBuy(c.team) },
  armourMove: { allowed: (sim, c) => !!sim.defence && Number.isInteger(c.squad) && Number.isFinite(c.x) && Number.isFinite(c.z), run: (sim, c) => sim.armourMove(c.team, c.squad, c.x, c.z) },
  armourMode: { allowed: (sim, c) => !!sim.defence && Number.isInteger(c.squad) && typeof c.mode === "string", run: (sim, c) => sim.armourMode(c.team, c.squad, c.mode) },
  // 0.24: a branched tower's next rank, and a squad's Rank 2 then its branch (Assault or Bulwark).
  padRank: { allowed: (sim, c) => !!sim.defence && ownBuilding(sim, c.team, c.building) && !!sim.get(c.building).crew, run: (sim, c) => sim.padRank(c.team, c.building) },
  armourUpgrade: { allowed: (sim, c) => !!sim.defence && Number.isInteger(c.squad) && (c.branch === undefined || typeof c.branch === "string") && (c.combined === undefined || c.combined === true), run: (sim, c) => sim.armourUpgrade(c.team, c.squad, c.branch ?? null, c.combined === true) },
  // The Commander's answer to the decision a story mission is waiting for (sim/missions.js).
  // H3c: the computer runs this side's base and army while the player fights as the hero (sim/steward.js).
  steward: { allowed: (sim, c) => sim.humanTeam(c.team), run: (sim, c) => sim.setSteward(!!c.on, c.team) },
  decide: { allowed: (sim, c) => c.team === 0 && sim.canDecide?.(c.id, c.option), run: (sim, c) => sim.decide(c.id, c.option) },
};
// H17: content modules' commands join the table, checked, logged and replayed like these (a name clash throws).
mergeContentCommands(COMMANDS);

// Would `c` be accepted now? The same checks as the door, without running or logging it (a LAN page asks
// this before it queues an order for a later turn, src/net/lan-ui.js).
export function commandAllowed(sim, c) {
  const handler = COMMANDS[c?.type];
  return !sim.result && !!handler && Number.isInteger(c.team) && !!sim.players[c.team] && !sim.players[c.team].eliminated && !!handler.allowed(sim, c);
}

export const commands = {
  command(c) {
    const handler = COMMANDS[c?.type];
    if (this.result || !handler || !Number.isInteger(c.team) || !this.players[c.team] || this.players[c.team].eliminated) return false;
    if (!handler.allowed(this, c)) return false;
    this.commandLog.push({ tick: this.ticks, ...structuredClone(c) });
    if (this.steward?.[c.team]) this.stewardMark(c);
    return handler.run(this, c);
  },
};
