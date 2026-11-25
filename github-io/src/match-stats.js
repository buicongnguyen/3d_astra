// Read-only match statistics for the results screen. Everything here is counted from the
// events the simulation already emits; nothing is stored in the simulation, so state hashes,
// saves and replays are untouched. The tracker lives in the client and resets with each match.
//
// Alloy and energy "gathered" are counted when a Harvester delivers its cargo: the carried
// amount is read from the unit just before the tick that delivers it.
//
// R3-V: the MVP (most damage plus healing on the player's side) and the last enemy kill, for the
// victory ceremony. Damage is read the same way: each hostile's health and shield just before a
// tick, compared just after it; the drop goes to the unit that hit it on that tick (its hitBy and
// hitAt, which the simulation already keeps). Healing is a Medic, Engineer or Supply wagon whose
// support cooldown restarted on that tick (sim support: one heal of e.support per cooldown).
export function createMatchStats() {
  let carry = new Map();
  let seen = 0;
  // W6 (replay value): kites trained, Kite Dives landed, creatures tamed and abilities used, for achievements and
  // challenges (src/meta/record.js). Counted from the same events; nothing reaches the simulation.
  const fresh = () => ({ lost: 0, killed: 0, structuresLost: 0, structuresDestroyed: 0, trained: 0, built: 0, alloy: 0, energy: 0, kites: 0, dives: 0, tamed: 0, abilities: 0 });
  let stats = fresh();
  // R3-V: per-unit credit on the player's side (id -> record), and the snapshot of one tick.
  let credit = new Map();
  let lastKill = null;
  const hostiles = [], values = [], healers = [], cooldowns = [];
  let hostileCount = 0, healerCount = 0;
  // The player's live entities at the start of the tick (never sim.get, so the sim's own lookup cache is left alone).
  const own = new Map();
  const value = (e) => Math.max(0, e.hp || 0) + Math.max(0, e.shield || 0);
  function record(e, sim) {
    let r = credit.get(e.id);
    if (!r) {
      r = { id: e.id, type: e.type, name: e.name || e.type, kind: e.kind, crew: e.crew || null, crewType: e.crew && sim.crewType ? sim.crewType(e.crew, 0) : null, damage: 0, healing: 0, kills: 0, x: e.x, z: e.z };
      credit.set(e.id, r);
    }
    r.x = e.x; r.z = e.z; r.name = e.name || r.name;
    return r;
  }
  return {
    get stats() { return { ...stats }; },
    reset() { stats = fresh(); carry = new Map(); seen = 0; credit = new Map(); lastKill = null; hostileCount = healerCount = 0; own.clear(); },
    // Call right before sim.tick(): remembers which Harvesters hold cargo and where the event list ends.
    before(sim) {
      carry.clear();
      hostileCount = healerCount = 0;
      own.clear();
      for (const e of sim.entities) {
        if (e.team === 0) {
          if (e.hp > 0) own.set(e.id, e);
          if (e.carry > 0) carry.set(e.id, e.carry);
          if (e.support && e.hp > 0) { healers[healerCount] = e; cooldowns[healerCount++] = e.cooldown || 0; }
        } else if (e.hp > 0) { hostiles[hostileCount] = e; values[hostileCount++] = value(e); }
      }
      seen = sim.events.length;
    },
    // Call right after sim.tick(): reads the events that tick added.
    after(sim) {
      for (let i = seen; i < sim.events.length; i++) {
        const ev = sim.events[i];
        if (ev.type === "death") {
          if (ev.dive && ev.team === 0) stats.dives++;
          const structure = !!ev.building;
          if (ev.team === 0) structure ? stats.structuresLost++ : stats.lost++;
          else {
            structure ? stats.structuresDestroyed++ : stats.killed++;
            if (Number.isFinite(ev.x)) lastKill = { x: ev.x, z: ev.z, time: sim.time, building: structure, core: !!ev.core };
          }
        } else if (ev.team === 0 && ev.type === "deliver") {
          const amount = carry.get(ev.seed) || 0;
          if (ev.resource === "energy") stats.energy += amount; else stats.alloy += amount;
        } else if (ev.team === 0 && ev.type === "spawn") {
          stats.trained++;
          for (const e of sim.entities) if (e.id === ev.seed) { if (e.type === "kite") stats.kites++; break; }
        } else if (ev.team === 0 && ev.kind === "tamed" && (ev.type === "wild" || ev.type === "creature")) stats.tamed++;
        else if (ev.team === 0 && ev.type === "ability") stats.abilities++;
        else if (ev.team === 0 && ev.type === "built") stats.built++;
      }
      seen = sim.events.length;
      // R3-V: damage dealt this tick, credited to the player's unit that landed it.
      for (let i = 0; i < hostileCount; i++) {
        const t = hostiles[i], drop = values[i] - value(t);
        hostiles[i] = null;
        if (!(drop > 0) || t.hitAt !== sim.time || t.hitBy == null) continue;
        const by = own.get(t.hitBy);
        if (!by) continue;
        const r = record(by, sim);
        r.damage += drop;
        if (!(t.hp > 0) && t.kind !== "wall") r.kills++;
      }
      for (let i = 0; i < healerCount; i++) {
        const h = healers[i];
        healers[i] = null;
        if ((h.cooldown || 0) > cooldowns[i] && h.hp > 0) record(h, sim).healing += h.support;
      }
      hostileCount = healerCount = 0;
      own.clear();
    },
    // The player's unit with the most damage plus healing (ties: the earlier unit), or null.
    mvp() {
      let best = null;
      for (const r of credit.values()) {
        const score = r.damage + r.healing;
        if (score > 0 && (!best || score > best.score || (score === best.score && r.id < best.id))) best = { ...r, score };
      }
      return best;
    },
    get lastKill() { return lastKill; },
  };
}
