// W11 LAN play: a page whose player commands a team other than 0 shows the match from its own side.
// The whole interface (selection, orders, fog, minimap, HUD, sounds) reads "the player" as team 0, so
// instead of teaching it about seats, this page swaps the team labels of the state the interface reads
// between team 0 and its own team, and swaps them back before every tick, hash and save (session.js).
//
// swapTeams(sim, a, b) is an involution: doing it twice gives back exactly the state it started from
// (each step only exchanges two values), so the shared simulation every page hashes is never changed by
// it. What is swapped: each entity's team (and its per-team sight bits), the per-team arrays (players,
// fog, intel, known cores, wave clocks, scouting), the faction of each team, capture-point owners, the LAN
// sides, and the result (told from team 0's side). Entity ids and positions have no team in them.
const PER_TEAM = ["players", "visible", "explored", "intel", "knownCores", "waveAt", "scoutIndex"];

export function swapTeams(sim, a, b) {
  if (a === b || !sim) return sim;
  const sw = (t) => (t === a ? b : t === b ? a : t);
  const both = (1 << a) | (1 << b);
  const bits = (m) => (Number.isInteger(m) && ((m >> a) & 1) !== ((m >> b) & 1) ? m ^ both : m);
  for (const e of sim.entities) {
    if (e.team === a || e.team === b) e.team = sw(e.team);
    if (e.seenBy !== undefined) e.seenBy = bits(e.seenBy);
    if (e.airSeenBy !== undefined) e.airSeenBy = bits(e.airSeenBy);
  }
  for (const key of PER_TEAM) {
    const list = sim[key];
    if (Array.isArray(list) && list.length > Math.max(a, b)) [list[a], list[b]] = [list[b], list[a]];
  }
  if (sim.factions && typeof sim.factions === "object") {
    const fa = sim.factions[a], fb = sim.factions[b];
    sim.factions[a] = fb;
    sim.factions[b] = fa;
  }
  for (const p of Object.values(sim.skirmishPoints || {})) {
    if (Number.isInteger(p.owner)) p.owner = sw(p.owner);
    if (Number.isInteger(p.taker)) p.taker = sw(p.taker);
  }
  if (sim.lan) {
    const s = sim.lan.sides;
    if (s.length > Math.max(a, b)) {
      if (sim.result === "victory" || sim.result === "defeat") { if (s[a] !== s[b]) sim.result = sim.result === "victory" ? "defeat" : "victory"; }
      [s[a], s[b]] = [s[b], s[a]];
    }
    sim.lan.humans = sim.lan.humans.map(sw).sort((x, y) => x - y);
  }
  return sim;
}

// The new events of a tick as this page sees them: their team swapped like the state, and a message meant
// for another person dropped (sim.message tags LAN messages with the team they are for).
export function viewEvents(events, from, a, b) {
  const sw = (t) => (t === a ? b : t === b ? a : t);
  for (let i = events.length - 1; i >= from; i--) {
    const e = events[i];
    if (Number.isInteger(e.team) && a !== b) e.team = sw(e.team);
    if (e.type === "message" && Number.isInteger(e.team) && e.team !== 0) events.splice(i, 1);
  }
}

// The perspective hooks for LanSession: identity for team 0, else the swap both ways.
export function perspectiveFor(team) {
  if (!team) return null;
  return { team, toCanonical: (sim) => swapTeams(sim, 0, team), toView: (sim) => swapTeams(sim, 0, team) };
}
