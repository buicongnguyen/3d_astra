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
//
// Second tier (W7 depth, 2026-11-25): once a building's first doctrine is chosen and the building reaches
// level 3 (balance.json `doctrines.<building>.tier2`), it offers a second either/or pair that changes how
// the side fights rather than adding a few per cent:
//   Command core  wing      flyers move `speed` x faster and their abilities recharge in `cooldown` x the time
//                 bastion   towers and the Command core deal `tower` x damage; every building takes `armour` x
//   Barracks      dugin     infantry on Hold stance take `hold` x damage (set Hold where the line must stand)
//                 shock     infantry deal `building` x damage to buildings and walls
//   Foundry       heavy     vehicles take `armour` x damage and move `speed` x (slower): a tough, slow line
//                 overclock vehicle abilities recharge in `cooldown` x the time
// State: `players[team].doctrine2 = { hq: "wing", ... }`, created on the first tier-2 pick (no key before).
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
// The second tier: the pick and its data (null before it).
export const doctrine2Of = (sim, team, building) => sim.players[team]?.doctrine2?.[building] ?? null;
export const doctrine2Data = (sim, team, building) => {
  const id = doctrine2Of(sim, team, building);
  return id ? DOCTRINES[building].tier2.options[id] : null;
};
// Which tier option `pick` of building type `building` belongs to: { tier: 1 | 2, o, spec } or null.
export function doctrineOption(building, pick) {
  const spec = DOCTRINES[building];
  if (!spec || typeof pick !== "string") return null;
  if (Object.hasOwn(spec.options, pick)) return { tier: 1, o: spec.options[pick], spec };
  if (spec.tier2 && Object.hasOwn(spec.tier2.options, pick)) return { tier: 2, o: spec.tier2.options[pick], spec: spec.tier2 };
  return null;
}

// Who each doctrine touches. Infantry: on foot, not Harvesters. Vehicles: machines on the ground (drones too).
export const infantry = (e) => e.kind === "unit" && !e.mechanical && !e.flying && !e.boss && e.type !== "worker" && e.team >= 0;
export const vehicle = (e) => e.kind === "unit" && !!e.mechanical && !e.flying && !e.boss && e.team >= 0;
export const flyer = (e) => e.kind === "unit" && !!e.flying && !e.boss && e.team >= 0;
const WHO = { infantry, vehicle, flyer };
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
  if (sim.players[e.team]?.doctrine2)
    for (const building of DOCTRINE_BUILDINGS) {
      const o = doctrine2Data(sim, e.team, building);
      if (o?.speed && WHO[o.who]?.(e)) f *= o.speed;
    }
  return f;
}

// Why `team` cannot pick `pick` at building `id` now ("" when it can). Messages are for the player's side.
export function doctrineBlock(sim, team, id, pick) {
  const b = sim.get(id), found = b && doctrineOption(b.type, pick);
  if (!b || b.team !== team || b.kind !== "building" || !found) return "Invalid choice.";
  const { tier, o, spec } = found;
  if (!b.complete) return `Finish building the ${b.name} first.`;
  if (tier === 1 && doctrineOf(sim, team, b.type)) return `${b.name} doctrine already chosen.`;
  if (tier === 2 && !doctrineOf(sim, team, b.type)) return `Choose the first ${b.name} doctrine first.`;
  if (tier === 2 && doctrine2Of(sim, team, b.type)) return `${b.name} second doctrine already chosen.`;
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
      const b = this.get(id), { tier, o } = doctrineOption(b.type, pick);
      this.pay(team, o.cost);
      (this.players[team][tier === 2 ? "doctrine2" : "doctrine"] ||= {})[b.type] = pick;
      // Speed doctrines reach the army already in the field.
      const who = tier === 2 ? WHO[o.who] : speedTarget[b.type];
      if (o.speed && who) for (const e of this.entities) if (e.team === team && e.hp > 0 && who(e)) scaleSpeed(e, o.speed);
      this.events.push({ type: "research", team, x: b.x, z: b.z });
      this.events.push({ type: "doctrine", team, building: b.type, pick, ...(tier === 2 ? { tier } : null), x: b.x, z: b.z });
      this.message(o.notice, team);
      return true;
    },
    // sim/tactics.js useAbility (only once the side has a tier-2 doctrine): the recharge factor for `e`.
    doctrineCooldown(e) {
      let f = 1;
      for (const building of DOCTRINE_BUILDINGS) {
        const o = doctrine2Data(this, e.team, building);
        if (o?.cooldown && WHO[o.who]?.(e)) f *= o.cooldown;
      }
      return f;
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
  // Tier 2: Shock troops (infantry against buildings and walls), Bastion (towers and the core hit harder).
  hitScale(sim, e, t) {
    const d2 = e.team >= 0 ? sim.players[e.team]?.doctrine2 : null;
    if (!d2) return 1;
    if (d2.barracks === "shock" && (t.kind === "building" || t.kind === "wall") && infantry(e)) return DOCTRINES.barracks.tier2.options.shock.building;
    if (d2.hq === "bastion" && e.kind === "building") return DOCTRINES.hq.tier2.options.bastion.tower;
    return 1;
  },
  // Tier 2: Bastion (buildings), Dig in (infantry on Hold), Heavy armour (vehicles) take less damage.
  taken(sim, t) {
    const d2 = t.team >= 0 ? sim.players[t.team]?.doctrine2 : null;
    if (!d2) return 1;
    if (d2.hq === "bastion" && t.kind === "building") return DOCTRINES.hq.tier2.options.bastion.armour;
    if (d2.barracks === "dugin" && t.stance === "hold" && infantry(t)) return DOCTRINES.barracks.tier2.options.dugin.hold;
    if (d2.foundry === "heavy" && vehicle(t)) return DOCTRINES.foundry.tier2.options.heavy.armour;
    return 1;
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
        // The second tier, at a level 3 building whose first doctrine is in.
        for (const b of own) {
          const spec = DOCTRINES[b.type]?.tier2;
          if (!spec || !b.complete || (b.level || 1) < spec.level || !doctrineOf(sim, team, b.type) || doctrine2Of(sim, team, b.type)) continue;
          const pick = aiPick2(b.type, role), o = spec.options[pick];
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

// The second tier for a computer side: it never sets Hold stance, so its infantry take Shock troops; raiders
// fly (Strike wing), everyone else builds a Bastion; sieges go Heavy armour, the rest Overclock.
export function aiPick2(building, role) {
  if (building === "hq") return role === "raider" ? "wing" : "bastion";
  if (building === "barracks") return "shock";
  return role === "siege" ? "heavy" : "overclock";
}
