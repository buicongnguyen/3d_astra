// W11 LAN play: the rules for a match that several people command (src/net/ runs the network side).
// A match built with the option `lan: { humans, sides }` keeps it as `sim.lan`:
//   humans  the teams people command (never a computer turn, the player's prices and autocast switch);
//   sides   one side id per team: teams on one side are allies (no fire between them, shared sight),
//           teams on different sides are at war. 1v1 = sides [0, 1]; co-op = [0, 0, 1, 1] (two people
//           against one or two computer allies).
// Without the option none of this runs, so every single-player match plays, saves and hashes as before.
import { WILD_TEAM } from "./constants.js";

// The option, checked and normalised: plain arrays of integers (it is saved and hashed with the match).
export function lanSeats(lan, enemyCount = 1) {
  const teams = (Number.isInteger(enemyCount) ? Math.min(3, Math.max(1, enemyCount)) : 1) + 1;
  const humans = [...new Set((Array.isArray(lan?.humans) ? lan.humans : [0, 1]).filter((t) => Number.isInteger(t) && t >= 0 && t < teams))].sort((a, b) => a - b);
  if (!humans.includes(0)) humans.unshift(0);
  const given = Array.isArray(lan?.sides) ? lan.sides : null;
  const sides = Array.from({ length: teams }, (_, team) => (given && Number.isInteger(given[team]) ? given[team] : team));
  return { humans, sides };
}

// At war: different sides. Wild creatures (WILD_TEAM) are fair game for every side, as in sim.hostile.
export function lanHostile(lan, a, b) {
  return a !== b && a >= 0 && (b >= 0 ? lan.sides[a] !== lan.sides[b] : b === WILD_TEAM);
}

// The match result, told from team 0's side (as every result is): null while two sides still stand.
// A person whose ally still stands keeps watching; the side falls with its last team.
export function lanResult(lan, alive) {
  const standing = new Set();
  alive.forEach((on, team) => { if (on) standing.add(lan.sides[team]); });
  if (standing.size > 1) return null;
  if (!standing.size) return "draw";
  return standing.has(lan.sides[0]) ? "victory" : "defeat";
}

// The result as one team sees it (the page of a person on another side reads "defeat" as a win).
export function resultFor(lan, result, team) {
  if (!lan || !result || result === "draw" || lan.sides[team] === lan.sides[0]) return result;
  return result === "victory" ? "defeat" : "victory";
}

// Allies pool what they see (after every team's own sight is drawn, as a coalition of AIs does).
export function lanPoolVision(sim) {
  const { sides } = sim.lan, groups = new Map();
  sides.forEach((side, team) => { if (team < sim.players.length) groups.set(side, [...(groups.get(side) || []), team]); });
  for (const teams of groups.values()) {
    if (teams.length < 2) continue;
    const seen = teams.map((t) => sim.visible[t]), known = teams.map((t) => sim.explored[t]);
    for (let i = 0; i < seen[0].length; i++) {
      let s = 0, k = 0;
      for (let j = 0; j < teams.length; j++) { s |= seen[j][i]; k |= known[j][i]; }
      for (let j = 0; j < teams.length; j++) { seen[j][i] = s; known[j][i] = k; }
    }
  }
}
