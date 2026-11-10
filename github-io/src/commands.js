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
  upgrade: { allowed: (sim, c) => ownBuilding(sim, c.team, c.building), run: (sim, c) => sim.upgradeBuilding(c.building, c.team) },
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
};

export const commands = {
  command(c) {
    const handler = COMMANDS[c?.type];
    if (this.result || !handler || !Number.isInteger(c.team) || !this.players[c.team] || this.players[c.team].eliminated) return false;
    if (!handler.allowed(this, c)) return false;
    this.commandLog.push({ tick: this.ticks, ...structuredClone(c) });
    return handler.run(this, c);
  },
};
