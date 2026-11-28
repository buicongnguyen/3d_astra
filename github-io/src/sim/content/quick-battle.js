// Quick battle (AAA round 3, R3-Q: first-minute hooks). A skirmish started from the title's one-tap
// "Quick battle" button carries the rule `quick: "on"` (src/quick-battle.js builds it; the rule never
// shows in the Battle rules row and a match without it never reads anything here, so no pin moves).
//
//   start    your outpost is already up: a Supply relay and a Sentinel tower facing the enemy,
//            two more Harvesters and a little alloy, so the first minute is about fighting, not
//            about waiting for the first buildings.
//   0:32+    a small enemy scout party (two Vanguards and a Ranger, in the rival faction's roster)
//            sets off 50 m out on the line between the cores and attack-moves on your core, so the
//            first fight comes at about 0:40. The tower, your starting squad and the core win it.
//
// It runs as an AI rule (H19) of the first rival: on its first think, and on its first think from
// QUICK.scoutAt on (the rival thinks every 2.5 to 4 s), so it needs no per-tick hook. State, only in
// a Quick battle: `quickBase` on your player record and `quickScouts` on the rival's, once each
// moment has happened (saved, so a restored match plays on exactly as it would have).
import { workshopUnitsOf } from "../../factions.js";

export const QUICK = Object.freeze({
  // When the scouts appear, and how far from your core (metres) along the line to the enemy core.
  scoutAt: 32,
  scoutDistance: 50,
  scouts: Object.freeze(["vanguard", "ranger", "vanguard"]),
  // The pre-built outpost: a building slot and metres from your core towards (+) or across (side) the enemy.
  base: Object.freeze([
    Object.freeze({ slot: "tower", ahead: 11, side: 0 }),
    Object.freeze({ slot: "relay", ahead: -2, side: 10 }),
  ]),
  workers: 2,
  alloy: 150,
});

// The Quick battle setup. Relaxed: the owner finds two rivals hard already, so this one is a fun,
// winnable first fight (tests/quick-battle-check.mjs: the test bot wins every faction pairing).
export const QUICK_SETUP = Object.freeze({ map: "riverlands", enemyCount: 1, aiSpeed: "relaxed", alliance: "ffa" });
// The rival (faction roster, 2026-11-24): the Quick battles rotate through the other factions so every
// army gets met, still Relaxed and still winnable (tests/quick-battle-check.mjs plays every pairing).
// The first one is Ashfall's raiders (Meridian when you command Ashfall), as before; `played` is how many
// Quick battles this profile has started (src/quick-battle.js keeps the count), so the choice is
// deterministic: Ashfall, Sunward, Wardens, Veil, then round again.
export const QUICK_RIVALS = Object.freeze(["ashfall", "sunward", "wardens", "veil", "meridian"]);
export function quickRivals(player) {
  const first = player === "ashfall" ? "meridian" : "ashfall";
  return [first, ...QUICK_RIVALS.filter((id) => id !== first && id !== player)];
}
export const quickRival = (player, played = 0) => {
  const list = quickRivals(player), n = Number.isFinite(played) && played > 0 ? Math.floor(played) : 0;
  return list[n % list.length];
};
// The rules a match is built with: the setup's own without `quick`, plus `quick` for a Quick battle.
export function quickRules(rules, quick) {
  const { quick: _drop, ...rest } = rules || {};
  if (quick) return { quick: quick === "arena" ? "arena" : "on" };
  return Object.keys(rest).length ? rest : null;
}

export const isQuick = (sim) => sim.rules?.quick === "on" && !sim.mission;
const PLAYER = 0, RIVAL = 1;
// A free spot for a unit of radius r at (x, z) or on small rings around it (world metres), or null.
function standAt(sim, x, z, r) {
  for (let ring = 0; ring <= 8; ring += 1) {
    const steps = ring ? 12 : 1;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2, px = x + Math.cos(a) * ring, pz = z + Math.sin(a) * ring;
      if (sim.nav.canStand(px, pz, r) && !sim.entities.some((e) => e.hp > 0 && e.kind !== "resource" && Math.hypot(e.x - px, e.z - pz) < (e.radius || 1) + r)) return { x: px, z: pz };
    }
  }
  return null;
}
const coreOf = (sim, team) => sim.entities.find((e) => e.team === team && e.type === "hq" && e.hp > 0);

// Unit vector from your core towards the rival's, and the one across it.
function axes(sim) {
  const home = coreOf(sim, PLAYER), rival = coreOf(sim, RIVAL);
  if (!home || !rival) return null;
  const dx = rival.x - home.x, dz = rival.z - home.z, l = Math.hypot(dx, dz) || 1;
  return { home, rival, fx: dx / l, fz: dz / l, sx: -dz / l, sz: dx / l };
}

function buildOutpost(sim) {
  const a = axes(sim);
  if (!a) return;
  for (const b of QUICK.base) {
    const type = sim.typeFor(PLAYER, b.slot);
    const x = a.home.x + a.fx * b.ahead + a.sx * b.side, z = a.home.z + a.fz * b.ahead + a.sz * b.side;
    const spot = sim.findPlacement(type, PLAYER, x, z, 8);
    if (spot) sim.spawn(type, PLAYER, spot.x, spot.z, true, true);
  }
  for (let i = 0; i < QUICK.workers; i++) {
    const p = standAt(sim, a.home.x - a.fx * 6 + a.sx * (i * 2 - 1) * 1.5, a.home.z - a.fz * 6 + a.sz * (i * 2 - 1) * 1.5, 0.7);
    if (p) sim.spawn("worker", PLAYER, p.x, p.z);
  }
  sim.players[PLAYER].alloy += QUICK.alloy;
  sim.nav.rebuild(sim.entities);
  sim.updateVision();
  sim.message("Quick battle: your outpost is ready. Enemy scouts are on their way.");
}

function sendScouts(sim) {
  const a = axes(sim);
  if (!a) return;
  const ids = [];
  let at = null;
  QUICK.scouts.forEach((slot, i) => {
    const off = (i - (QUICK.scouts.length - 1) / 2) * 2.2;
    const x = a.home.x + a.fx * QUICK.scoutDistance + a.sx * off, z = a.home.z + a.fz * QUICK.scoutDistance + a.sz * off;
    const p = standAt(sim, x, z, 0.9);
    if (!p) return;
    const e = sim.spawn(slot, RIVAL, p.x, p.z);
    e.angle = Math.atan2(-a.fx, -a.fz);
    ids.push(e.id);
    at ||= p;
  });
  if (!ids.length) return;
  sim.issue(ids, { type: "attackmove", x: a.home.x, z: a.home.z });
  sim.events.push({ type: "incoming", team: PLAYER, x: at.x, z: at.z, count: ids.length, quick: true });
  sim.message("Enemy scouts sighted! Meet them at your tower.");
}

// "Full army": a test-friendly battle. W7 (2026-11-25): shown as the "Full army sandbox" (a showcase to try every
// unit and ability, not a contest: the whole army takes the Relaxed rival's core in 30-55 s, and the owner rule
// "never make Relaxed or Normal harder" keeps the rival as it is). Your base already has a Barracks, Foundry, three
// Supply relays and a tower, and two of every ground unit stand ready.
// The enemy army (owner 2026-11-28: "they appear suddenly and go to attack"): eight mixed groups of ten, as before,
// but none appears near you. Group 1 stands in formation at the muster point on the rival's half of the map from the
// start (visible once scouted) and marches on your core at 0:30. Each later group walks in from behind the rival's
// core at the moment its wave used to appear (1:00, 1:35, ... every 35 s), forms up at the muster point and marches
// `gather` seconds later. The HUD counts down to every march (src/quick-battle.js). Same groups, same or later
// times, from further away: never harder (tests/quick-battle.test.js measures first contact and the attack-move).
// While a group waits it carries the tag "arena" (the AI never orders tagged units, sim/ai.js); marching drops it.
export const ARENA = Object.freeze({
  base: Object.freeze([
    Object.freeze({ slot: "barracks", ahead: 4, side: -14 }),
    Object.freeze({ slot: "foundry", ahead: 4, side: 14 }),
    Object.freeze({ slot: "relay", ahead: -8, side: 10 }),
    Object.freeze({ slot: "relay", ahead: -8, side: -10 }),
    Object.freeze({ slot: "relay", ahead: -14, side: 4 }),
    Object.freeze({ slot: "tower", ahead: 24, side: 0 }),
  ]),
  // Slots resolve through your faction (sim.typeFor); a slot your faction excludes (the Wardens have no
  // Medic or Engineer) is skipped. Then two of each of your faction's workshop units, and two of your
  // faction's own flyer (Hawks for Meridian; roster 2026-11-24, it was Hawks for every faction).
  army: Object.freeze(["vanguard", "ranger", "breaker", "medic", "engineer", "tank", "antitank"]),
  squad: Object.freeze(["vanguard", "ranger", "tank", "antitank", "breaker"]),
  hawks: 2, alloy: 350, firstWave: 25, every: 35, waves: 8,
  // muster: metres from your core towards the rival's where a group forms up (the cores stand about 69 m apart on
  // Riverlands, so 47 m is the rival's half). entry: metres behind the rival core where a later group walks in.
  muster: 47, entry: 11, firstMarch: 30, gather: 20,
});
// When group k (0-based) is on the map and when it marches (seconds of match time).
export const arenaEnterAt = (k) => (k <= 0 ? 0 : ARENA.firstWave + k * ARENA.every);
export const arenaMarchAt = (k) => (k <= 0 ? ARENA.firstMarch : arenaEnterAt(k) + ARENA.gather);
// The next march for the HUD: { at, group } or null once every group has marched (or outside the sandbox).
export function arenaNextMarch(sim) {
  const rival = sim?.players?.[RIVAL];
  if (!isArena(sim) || !rival || !sim.players[PLAYER]?.quickBase) return null;
  const k = rival.arenaWaves || 0;
  return k < ARENA.waves ? { at: arenaMarchAt(k), group: k + 1 } : null;
}
// Your Full army: the base slots your faction has, as your faction's units, then its workshop units.
export function arenaArmy(sim) {
  const faction = sim.factionFor(PLAYER), slots = ARENA.army.filter((slot) => !faction.exclude?.includes(slot));
  return [...slots.map((slot) => sim.typeFor(PLAYER, slot)), ...workshopUnitsOf(sim.factionId(PLAYER))];
}
// Your faction's own flyer (the first one its Command core trains), Hawks when it has none.
export const arenaFlyer = (sim) => sim.factionFor(PLAYER).extra?.hq?.[0] || "hawk";
// Skywing to try (owner 2026-11-28: "Skywing is hero mode"): the Full army sandbox brings it free (no coins), so
// Hero mode can be tried there. It takes ids from its own range (sim/content/skywing.js), so every other entity
// keeps the id it would have had.
export const isArena = (sim) => sim.rules?.quick === "arena" && !sim.mission;
function buildArena(sim) {
  const a = axes(sim);
  if (!a) return;
  for (const b of ARENA.base) {
    const type = sim.typeFor(PLAYER, b.slot), x = a.home.x + a.fx * b.ahead + a.sx * b.side, z = a.home.z + a.fz * b.ahead + a.sz * b.side;
    const spot = type && sim.findPlacement(type, PLAYER, x, z, 10);
    if (spot) sim.spawn(type, PLAYER, spot.x, spot.z, true, true);
  }
  sim.nav.rebuild(sim.entities);
  const types = arenaArmy(sim);
  types.forEach((type, i) => {
    for (let n = 0; type && n < 2; n++) {
      const ahead = 15 + n * 3, side = (i - (types.length - 1) / 2) * 3;
      const p = standAt(sim, a.home.x + a.fx * ahead + a.sx * side, a.home.z + a.fz * ahead + a.sz * side, 1);
      if (p) sim.spawn(type, PLAYER, p.x, p.z).angle = Math.atan2(a.fx, a.fz);
    }
  });
  const flyer = arenaFlyer(sim);
  for (let n = 0; n < ARENA.hawks; n++) {
    const side = n ? 5 : -5, x = a.home.x + a.fx * 11 + a.sx * side, z = a.home.z + a.fz * 11 + a.sz * side;
    sim.spawn(flyer, PLAYER, x, z, true, true).angle = Math.atan2(a.fx, a.fz);
  }
  sim.players[PLAYER].alloy += ARENA.alloy;
  sim.callSkywing(PLAYER);
  // Group 1 already stands at the muster point, in formation and facing you.
  enterArenaGroup(sim, a, true);
  sim.players[RIVAL].arenaIn = 1;
  sim.updateVision();
  sim.message("Full army sandbox: try every unit and ability. The enemy army waits on its side and marches at 0:30.");
}
// The muster slot of squad unit (i, n): five columns of two, the front row towards you.
function musterSlot(a, i, n) {
  const ahead = ARENA.muster + n * 3, side = (i - 2) * 3;
  return { x: a.home.x + a.fx * ahead + a.sx * side, z: a.home.z + a.fz * ahead + a.sz * side };
}
// A group comes onto the map: at its muster slots (group 1, at the start) or walking in from behind the rival core.
function enterArenaGroup(sim, a, standing) {
  ARENA.squad.forEach((slot, i) => {
    const type = sim.typeFor(RIVAL, slot);
    for (let n = 0; type && n < 2; n++) {
      const to = musterSlot(a, i, n);
      const back = ARENA.entry + n * 3, side = (i - 2) * 2.5;
      const from = standing ? to : { x: a.rival.x + a.fx * back + a.sx * side, z: a.rival.z + a.fz * back + a.sz * side };
      const p = standAt(sim, from.x, from.z, 1);
      if (!p) continue;
      const e = sim.spawn(type, RIVAL, p.x, p.z);
      e.angle = Math.atan2(-a.fx, -a.fz);
      e.tag = "arena";
      if (!standing) sim.issue([e.id], { type: "move", x: to.x, z: to.z });
    }
  });
}
// The waiting group marches: the tag goes (the rival's own AI may use the survivors later, as before) and the
// whole group attack-moves on your core, with the usual alarm.
function marchArenaGroup(sim, a) {
  const group = sim.entities.filter((e) => e.tag === "arena" && e.team === RIVAL && e.hp > 0);
  if (!group.length) return;
  for (const e of group) delete e.tag;
  sim.issue(group.map((e) => e.id), { type: "attackmove", x: a.home.x, z: a.home.z });
  const lead = group[0];
  sim.events.push({ type: "incoming", team: PLAYER, x: lead.x, z: lead.z, count: group.length, quick: true });
  sim.message("The enemy army is marching on your base!");
}
// Every tick of a sandbox match (a step hook, so a march starts exactly when the HUD clock reaches 0:00).
function arenaStep(sim) {
  if (!isArena(sim)) return;
  const you = sim.players[PLAYER], rival = sim.players[RIVAL];
  if (!you?.quickBase || !rival) return;
  const inside = rival.arenaIn || 0;
  if (inside < ARENA.waves && sim.time >= arenaEnterAt(inside) - 1e-9) {
    rival.arenaIn = inside + 1;
    const a = axes(sim);
    if (a) enterArenaGroup(sim, a, false);
  }
  const k = rival.arenaWaves || 0;
  if (k < (rival.arenaIn || 0) && sim.time >= arenaMarchAt(k) - 1e-9) {
    rival.arenaWaves = k + 1;
    const a = axes(sim);
    if (a) marchArenaGroup(sim, a);
  }
}

export const quickBattle = {
  id: "quick-battle",
  order: 38, // the Full army sandbox's groups (before every other step hook)
  step: arenaStep,
  aiRules: [{
    id: "quick-battle",
    run(sim, team) {
      if (team !== RIVAL) return;
      const you = sim.players[PLAYER], rival = sim.players[RIVAL];
      if (isArena(sim)) {
        if (!you.quickBase) { you.quickBase = true; buildArena(sim); }
        return;
      }
      if (!isQuick(sim)) return;
      if (!you.quickBase) { you.quickBase = true; buildOutpost(sim); }
      if (!rival.quickScouts && sim.time >= QUICK.scoutAt - 1e-9) { rival.quickScouts = true; sendScouts(sim); }
    },
  }],
};
