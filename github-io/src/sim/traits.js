import balance from '../balance.json' with {type:'json'};
import { DEFINITIONS as D, distance } from '../data.js';

// Faction traits and building auras. Numbers live in balance.json under `traits` and on each
// building's `aura`. Every hook is switched by the team's faction, so an all-Meridian match
// runs none of this and keeps its state hash.
export const TRAITS = balance.traits;
const ROAD = new Set(TRAITS.roads.surfaces);
// Auras and cloaks are refreshed four times a second, like vision.
const EVERY = 5;

// A completed building of `team` of one of `types` within `radius` of `e` (not `e` itself).
function nearOwn(sim, team, e, types, radius) {
  for (const b of sim.entities)
    if (b.team === team && b.hp > 0 && b.complete && b.id !== e.id && types.includes(b.type) && distance(b, e) <= radius) return true;
  return false;
}
function setRate(e, rate) {
  if (rate === 1) delete e.shieldRate;
  else e.shieldRate = rate;
}

export const TRAIT_HANDLERS = {
  // Ashfall: wrecks near a Salvage yard or an Ashfall core pay a share of their alloy cost.
  salvage: {
    death(sim, team, victim) {
      if (victim.kind !== 'building' && !(victim.kind === 'unit' && victim.mechanical)) return;
      if (!nearOwn(sim, team, victim, ['salvageyard', 'hq'], TRAITS.salvage.radius)) return;
      const amount = Math.round((D[victim.type]?.cost?.[0] || 0) * TRAITS.salvage.share);
      if (!amount) return;
      sim.players[team].alloy += amount;
      sim.events.push({ type: 'salvage', x: victim.x, z: victim.z, team, amount });
    },
  },
  // Sunward: the road bonus is in moveSpeed(); a Waystation speeds up shield recharge around it.
  roads: {
    tick(sim, team) {
      if (sim.ticks % EVERY) return;
      const a = D.waystation.aura;
      for (const e of sim.entities) if (e.team === team && e.hp > 0) setRate(e, nearOwn(sim, team, e, ['waystation'], a.radius) ? a.shield_rate : 1);
    },
  },
  // Wardens: idle units mend themselves; a Pylon strengthens the shields of buildings around it.
  selfrepair: {
    tick(sim, team, dt) {
      const { delay, rate } = TRAITS.selfrepair, aura = sim.ticks % EVERY ? null : D.pylon.aura;
      for (const e of sim.entities) {
        if (e.team !== team || e.hp <= 0) continue;
        if (e.kind === 'unit') {
          if (e.hp < e.maxHp && sim.time - Math.max(e.hitAt ?? -99, e.shotAt ?? -99) >= delay) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * rate * dt);
        } else if (aura && e.kind === 'building') {
          const base = (D[e.type].shield || 0) + 25 * (e.level - 1), on = nearOwn(sim, team, e, ['pylon'], aura.radius);
          const want = on ? base * aura.shield : base;
          if (e.maxShield !== want) { e.maxShield = want; e.shield = Math.min(e.shield, want); }
          setRate(e, on ? aura.shield_rate : 1);
        }
      }
    },
  },
  // Veil: Shades, and any Veil unit near a Veil relay, are hidden while they hold their fire.
  farsight: {
    spawn(sim, e) { e.vision += TRAITS.farsight.vision; },
    tick(sim, team) {
      if (sim.ticks % EVERY) return;
      const rule = TRAITS.farsight, relay = D.veilrelay.aura.radius;
      for (const e of sim.entities) {
        if (e.team !== team || e.hp <= 0 || e.kind !== 'unit') continue;
        const hidden = sim.time - (e.shotAt ?? -99) >= rule.cloak_delay && (e.cloak || nearOwn(sim, team, e, ['veilrelay'], relay));
        if (!hidden) { if (e.cloaked) sim.uncloak(e); continue; }
        // One bit per team that has a detector close enough.
        let seen = 0;
        for (const d of sim.entities) {
          if (d.hp <= 0 || d.team < 0 || d.team === team || (seen >> d.team) & 1 || !sim.hostile(team, d.team)) continue;
          const reach = d.kind === 'unit' ? rule.reveal_unit : d.complete && (d.type === 'tower' || d.type === 'hq' || d.type === 'veilrelay') ? (d.reveal || rule.reveal_building) : 0;
          if (reach && distance(d, e) <= reach) seen |= 1 << d.team;
        }
        // Allied AIs share what they detect, as they share vision.
        if (sim.coalition && seen >> 1) for (let t = 1; t < sim.players.length; t++) seen |= 1 << t;
        if (e.cloaked && seen & ~e.seenBy & 1) sim.events.push({ type: 'reveal', x: e.x, z: e.z, team: e.team });
        e.cloaked = true;
        e.seenBy = seen;
      }
    },
  },
};

export const traits = {
  stepTraits(dt) {
    for (let team = 0; team < this.players.length; team++) TRAIT_HANDLERS[this.factionFor(team).trait]?.tick?.(this, team, dt);
  },
  traitDeath(victim, killerTeam) {
    for (let team = 0; team < this.players.length; team++) TRAIT_HANDLERS[this.factionFor(team).trait]?.death?.(this, team, victim, killerTeam);
  },
  traitSpawn(e) {
    TRAIT_HANDLERS[this.factionFor(e.team).trait]?.spawn?.(this, e);
  },
  // Sunward units are quicker on roads and sand.
  moveSpeed(e) {
    return this.factionFor(e.team).trait === 'roads' && ROAD.has(this.terrain.at(e.x, e.z)) ? e.speed * TRAITS.roads.speed : e.speed;
  },
  damageDealt(team) {
    return this.factionFor(team).trait === 'farsight' ? TRAITS.farsight.damage : 1;
  },
  uncloak(e) {
    delete e.cloaked;
    delete e.seenBy;
  },
  // Per-team AI tempo: the match speed with the faction's personality applied (balance.json ai_personalities).
  personality(team) {
    return balance.ai_personalities[this.factionFor(team).ai] || null;
  },
  paceFor(team) {
    const p = this.personality(team);
    // A story mission is paced by its script: there a faction changes units, traits and buildings, not the clock.
    if (!p || this.mission) return this.pace;
    const pace = { ...this.pace };
    for (const [key, factor] of Object.entries(p.scale || {})) if (Number.isFinite(pace[key])) pace[key] *= factor;
    for (const [key, more] of Object.entries(p.add || {})) if (Number.isFinite(pace[key])) pace[key] = Math.max(key === 'minWave' ? 2 : 0, pace[key] + more);
    // Cheap rosters field more bodies under the same speed.
    if (p.army_scale && pace.army) pace.army = pace.army.map((n) => n * p.army_scale);
    return pace;
  },
};
