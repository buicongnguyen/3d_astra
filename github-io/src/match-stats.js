// Read-only match statistics for the results screen. Everything here is counted from the
// events the simulation already emits; nothing is stored in the simulation, so state hashes,
// saves and replays are untouched. The tracker lives in the client and resets with each match.
//
// Alloy and energy "gathered" are counted when a Harvester delivers its cargo: the carried
// amount is read from the unit just before the tick that delivers it.
export function createMatchStats() {
  let carry = new Map();
  let seen = 0;
  const fresh = () => ({ lost: 0, killed: 0, structuresLost: 0, structuresDestroyed: 0, trained: 0, built: 0, alloy: 0, energy: 0 });
  let stats = fresh();
  return {
    get stats() { return { ...stats }; },
    reset() { stats = fresh(); carry = new Map(); seen = 0; },
    // Call right before sim.tick(): remembers which Harvesters hold cargo and where the event list ends.
    before(sim) {
      carry.clear();
      for (const e of sim.entities) if (e.team === 0 && e.carry > 0) carry.set(e.id, e.carry);
      seen = sim.events.length;
    },
    // Call right after sim.tick(): reads the events that tick added.
    after(sim) {
      for (let i = seen; i < sim.events.length; i++) {
        const ev = sim.events[i];
        if (ev.type === "death") {
          const structure = !!ev.building;
          if (ev.team === 0) structure ? stats.structuresLost++ : stats.lost++;
          else structure ? stats.structuresDestroyed++ : stats.killed++;
        } else if (ev.team === 0 && ev.type === "deliver") {
          const amount = carry.get(ev.seed) || 0;
          if (ev.resource === "energy") stats.energy += amount; else stats.alloy += amount;
        } else if (ev.team === 0 && ev.type === "spawn") stats.trained++;
        else if (ev.team === 0 && ev.type === "built") stats.built++;
      }
      seen = sim.events.length;
    },
  };
}
