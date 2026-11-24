// Either/or doctrines (2026-11-24, faction depth pass; owner approved "either/or upgrades and an energy
// sink, keeping matches short"). At level 2, the Command core, the Barracks and the Foundry each offer
// two upgrades for the rest of the match; picking one locks the other. They are paid mostly in energy
// (balance.json `doctrines`), take effect at once (no queue: a phone match is short) and change how the
// army plays:
//   Command core  grid     Harvesters bring back `energy` x energy        (sim/economy.js delivery)
//                 reserve  a fighter lost returns `refund` of its alloy    (onDeath below)
//   Barracks      rations  infantry move `speed` x faster                  (unit speed, now and on spawn)
//                 drill    Barracks recruits arrive `ranks` rank higher    (onSpawn below)
//   Foundry       engines  vehicles move `speed` x faster                  (unit speed, now and on spawn)
//                 crews    vehicles out of combat for `delay` s mend `rate` of their health a second (step)
// The interface shows both tiles side by side on the building's production card (research-tiles.js
// doctrineTiles): one tap picks, no sub-menu.
//
// State: `players[team].doctrine = { hq: "grid", ... }`, created on the first pick, so a match without a
// pick saves and hashes exactly as before. Every hook returns at once for a team without a doctrine.
//
// Computer sides (difficulty guard, owner rule "never make Relaxed or Normal harder"): only a skirmish
// AI at the Fast or Relentless speed picks doctrines (aiRules below). Relaxed and Normal AIs, and every
// story mission and chronicle, play as before.
import balance from "../../balance.json" with { type: "json" };
import { DEFINITIONS as D } from "../../data.js";
import { RANK_XP, RANK_BONUS } from "../tactics.js";
import { onExitRing } from "./barracks-veterans.js";

export const DOCTRINES = balance.doctrines;
export const DOCTRINE_BUILDINGS = Object.keys(DOCTRINES);
export const DOCTRINE_AI_SPEEDS = new Set(["fast", "relentless"]);
// Energy a computer side keeps after a pick: enough for its heavy unit (a Tank or Walker costs 150), so a doctrine never delays it.
const AI_ENERGY_SPARE = 250;

export const doctrineOf = (sim, team, building) => sim.players[team]?.doctrine?.[building] ?? null;
// The option data a team runs for a building, or null.
export const doctrineData = (sim, team, building) => {
  const id = doctrineOf(sim, team, building);
  return id ? DOCTRINES[building].options[id] : null;
};

// Who each doctrine touches. Infantry: on foot, not Harvesters. Vehicles: machines on the ground (drones too).
export const infantry = (e) => e.kind === "unit" && !e.mechanical && !e.flying && !e.boss && e.type !== "worker" && e.team >= 0;
export const vehicle = (e) => e.kind === "unit" && !!e.mechanical && !e.flying && !e.boss && e.team >= 0;
const speedTarget = { barracks: infantry, foundry: vehicle };

// Scales a unit's speed, and the speed a running buff will put back when it ends (sim/tactics.js endBuff).
function scaleSpeed(e, factor) {
  e.speed *= factor;
  if (e.buff?.undo && e.buff.undo.speed !== undefined) e.buff.undo.speed *= factor;
}
// The speed factor a team's doctrines give unit `e` (1 for none).
function speedFactor(sim, e) {
  let f = 1;
  for (const building of ["barracks", "foundry"]) {
    const o = doctrineData(sim, e.team, building);
    if (o?.speed && speedTarget[building](e)) f *= o.speed;
  }
  return f;
}

// Why `team` cannot pick `pick` at building `id` now ("" when it can). Messages are for the player's side.
export function doctrineBlock(sim, team, id, pick) {
  const b = sim.get(id), spec = b && DOCTRINES[b.type], o = spec?.options?.[pick];
  if (!b || b.team !== team || b.kind !== "building" || !spec || !o) return "Invalid choice.";
  if (!b.complete) return `Finish building the ${b.name} first.`;
  if (doctrineOf(sim, team, b.type)) return `${b.name} doctrine already chosen.`;
  if ((b.level || 1) < spec.level) return `Upgrade ${b.name} to level ${spec.level} to choose ${o.name}.`;
  if (!sim.canPay(team, o.cost)) return `${sim.resourceShortage(o.cost, team)} to train/research ${o.name}.`;
  return "";
}

export const doctrines = {
  id: "doctrines",
  order: 41,
  mixin: {
    // Picks doctrine `pick` for the building type of `id`. True when it was taken.
    pickDoctrine(team, id, pick) {
      if (this.result) return false;
      const why = doctrineBlock(this, team, id, pick);
      if (why) { this.message(why, team); return false; }
      const b = this.get(id), o = DOCTRINES[b.type].options[pick];
      this.pay(team, o.cost);
      (this.players[team].doctrine ||= {})[b.type] = pick;
      // Speed doctrines reach the army already in the field.
      if (o.speed) for (const e of this.entities) if (e.team === team && e.hp > 0 && speedTarget[b.type]?.(e)) scaleSpeed(e, o.speed);
      this.events.push({ type: "research", team, x: b.x, z: b.z });
      this.events.push({ type: "doctrine", team, building: b.type, pick, x: b.x, z: b.z });
      this.message(o.notice, team);
      return true;
    },
  },
  commands: {
    doctrine: {
      allowed: (sim, c) => { const b = sim.get(c.building); return !!b && b.team === c.team && b.kind === "building" && typeof c.pick === "string"; },
      run: (sim, c) => sim.pickDoctrine(c.team, c.building, c.pick),
    },
  },
  onSpawn(sim, e) {
    if (e.kind !== "unit" || e.team < 0 || !sim.players[e.team]?.doctrine) return;
    const f = speedFactor(sim, e);
    if (f !== 1) scaleSpeed(e, f);
    // Drill: a fighter standing on a Barracks' exit ring was just trained there (as sim/content/barracks-veterans.js).
    const drill = doctrineData(sim, e.team, "barracks");
    if (!drill?.ranks || e.boss || e.type === "worker" || !e.damage || e.flying) return;
    if (!sim.entities.some((b) => b.team === e.team && b.hp > 0 && b.type === "barracks" && b.trains?.includes(e.type) && onExitRing(b, e.x, e.z))) return;
    const rank = Math.min(RANK_XP.length, (e.rank || 0) + drill.ranks);
    if (rank === (e.rank || 0)) return;
    e.rank = rank;
    e.xp = Math.max(e.xp || 0, RANK_XP[rank - 1]);
    e.maxHp = Math.round((e.baseHp ?? D[e.type].hp) * (1 + RANK_BONUS * rank));
    e.hp = e.maxHp;
  },
  // Reserves: a fighter lost pays back part of its alloy.
  onDeath(sim, t) {
    if (t.kind !== "unit" || t.team < 0 || !t.damage || t.type === "worker" || t.boss) return;
    const o = doctrineData(sim, t.team, "hq");
    if (!o?.refund) return;
    const amount = Math.round((D[t.type]?.cost?.[0] || 0) * o.refund);
    if (amount > 0) sim.players[t.team].alloy += amount;
  },
  // Repair crews: vehicles mend themselves once out of combat.
  step(sim, dt) {
    for (let team = 0; team < sim.players.length; team++) {
      const o = doctrineData(sim, team, "foundry");
      if (!o?.rate) continue;
      for (const e of sim.entities)
        if (e.team === team && e.hp > 0 && e.hp < e.maxHp && vehicle(e) && sim.time - Math.max(e.hitAt ?? -99, e.shotAt ?? -99) >= o.delay)
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * o.rate * dt);
    }
  },
  aiRules: [
    {
      id: "doctrines",
      // A Fast or Relentless skirmish AI takes one doctrine per levelled building once it has energy to spare.
      run(sim, team, { own, afford, role }) {
        if (sim.mission || sim.defence || !DOCTRINE_AI_SPEEDS.has(sim.aiSpeed)) return;
        for (const b of own) {
          const spec = DOCTRINES[b.type];
          if (!spec || !b.complete || (b.level || 1) < spec.level || doctrineOf(sim, team, b.type)) continue;
          const pick = aiPick(b.type, role);
          const o = spec.options[pick];
          if (!o || sim.players[team].energy < o.cost[1] + AI_ENERGY_SPARE || !afford(o.cost)) continue;
          sim.pickDoctrine(team, b.id, pick);
        }
      },
    },
  ],
};

// What a computer side picks: raiders run (rations, reserves), sieges dig in (crews), everyone else
// takes the grid, the drill and the engines.
export function aiPick(building, role) {
  if (building === "hq") return role === "raider" ? "reserve" : "grid";
  if (building === "barracks") return role === "raider" ? "rations" : "drill";
  return role === "siege" ? "crews" : "engines";
}
