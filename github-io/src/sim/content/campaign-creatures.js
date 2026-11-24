// Creatures in the campaign (creature round, 2026-11-24): optional dens and a vault guardian, placed by a
// mission's setup and never on its critical path, so a player who leaves them alone plays the mission as
// it was. Built from the Wild frontier pieces (sim/content/wild-frontier.js): guards on WILD_TEAM that bite
// whatever comes near their den and never leave it, Wyrm taming, and the tamed Wyrm's Ambush.
//
// Setup steps (docs/MISSIONS.md):
//   { den: id, at, guard, count, countByDifficulty?, tame?, elder?, reward?: { alloy, energy }, aggro?, r? }
//       Guards of type `guard` around the den. When they are all down the den is "cleared" (its reward
//       paid at once), or, with `tame`, "open": the player's fighters alone in it for balance
//       campaign_creatures.den.tame seconds tame one creature of that type ("tamed"). Objective type
//       "den" ({ den: id }) is done when the den is cleared or tamed.
//   { guardian: type, at, tag, name? }
//       A dormant guardian on NEUTRAL: nobody fights it unless the player orders an attack on it. Hurt,
//       it wakes (WILD_TEAM) and fights within `leash` m of its post; at its difficulty's kneel share it
//       kneels for a few seconds (untouchable) and then joins the player (team 0) for the rest of the
//       mission. Objective type "guardian" ({ tag }) is done when it has joined.
// Events: guardianWake, guardianKneel, guardianJoin ({ id, x, z }); creature ({ kind: "acid" | "denClear" |
// "denOpen" | "tamed", x, z, ... }) for the view. State lives in mission.dens / mission.guardians, created
// only when a mission uses them, so every other match saves and hashes as before.
import balance from "../../balance.json" with { type: "json" };
import { DEFINITIONS as D, distance } from "../../data.js";
import { NEUTRAL, WILD_TEAM } from "../constants.js";
import { stepWyrms } from "./wild-frontier.js";

export const CREATURES = balance.campaign_creatures;
const THINK = 10;
const STEP_SECONDS = THINK * 0.05;
// Everything this module spawns takes ids from its own range (like the Wild frontier's guards), so every
// other entity keeps the id it has without the den: a player who ignores the den plays the same match.
const DEN_IDS = 2e6;

function withDenIds(sim, make) {
  const saved = sim.nextId;
  sim.nextId = sim.mission.denId ?? DEN_IDS;
  try { return make(); } finally { sim.mission.denId = sim.nextId; sim.nextId = saved; }
}
function standNear(sim, x, z, r) {
  if (sim.nav.canStand(x, z, r)) return { x, z };
  for (let ring = 1; ring <= 4; ring++)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, p = { x: x + Math.cos(a) * ring, z: z + Math.sin(a) * ring };
      if (sim.nav.canStand(p.x, p.z, r)) return p;
    }
  return { x, z };
}
const groundUnit = (t) => t.hp > 0 && t.kind === "unit" && !t.flying && t.team >= 0 && !t.cloaked;

// A creature's bite: armour bonus (Acid Hounds), then acid splash on ground units next to the target.
function bite(sim, g, t) {
  const d = D[g.type];
  const damage = g.damage * (t.mechanical && d.mechanical_bonus ? d.mechanical_bonus : 1) * (t.kind === "building" ? (d.building_bonus ?? 1) : 1);
  sim.applyDamage(t, damage, WILD_TEAM, g.id);
  g.cooldown = g.interval;
  sim.events.push({ type: "shot", weapon: g.type, unit: g.type, source: g.id, target: t.id, x: g.x, z: g.z, tx: t.x, tz: t.z, team: WILD_TEAM, heavy: false });
  if (d.splash_radius) {
    for (const o of sim.entities)
      if (o !== t && groundUnit(o) && distance(o, t) <= d.splash_radius) sim.applyDamage(o, damage * d.splash_damage, WILD_TEAM, g.id);
    if (d.acid) sim.events.push({ type: "creature", kind: "acid", x: t.x, z: t.z, r: d.splash_radius });
  }
}

// One guard (or an awake guardian): the nearest ground unit within `reach` of its home, else walk home.
function fightNear(sim, g, home, reach, dt, think) {
  let t = g.wildTarget != null ? sim.get(g.wildTarget) : null;
  const valid = (u) => !!u && groundUnit(u) && distance(u, home) <= reach + u.radius;
  if (think || !valid(t)) {
    t = null;
    let best = Infinity;
    for (const u of sim.entities) {
      if (!valid(u)) continue;
      const d = distance(g, u);
      if (d < best) { best = d; t = u; }
    }
    g.wildTarget = t ? t.id : null;
  }
  if (t) {
    if (distance(g, t) <= g.range + t.radius + g.radius * 0.5 + 0.00001) {
      g.attacking = true;
      g.angle = Math.atan2(t.x - g.x, t.z - g.z);
      if (g.cooldown <= 0) bite(sim, g, t);
    } else sim.move(g, sim.approach(g, t, Math.max(1, g.range * 0.7)), dt);
    return true;
  }
  g.attacking = false;
  if (distance(g, g.lair) > 1) sim.move(g, g.lair, dt, 1);
  return false;
}

function spawnGuards(sim, den, count) {
  withDenIds(sim, () => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.4, spot = standNear(sim, den.x + Math.cos(a) * 2.4, den.z + Math.sin(a) * 2.4, D[den.guard].radius);
      const g = sim.spawn(den.guard, WILD_TEAM, spot.x, spot.z, true, true);
      g.stance = "hold";
      g.lair = { x: spot.x, z: spot.z };
      g.angle = a;
      den.guards.push(g.id);
    }
  });
}

function stepDen(sim, den) {
  if (den.state === "guarded") {
    den.guards = den.guards.filter((id) => sim.get(id));
    if (den.guards.length) return;
    if (!den.tame) {
      den.state = "cleared";
      const r = den.reward || {};
      for (const [type, amount] of Object.entries(r)) { sim.players[0][type] += amount; sim.missionBank(0, type, amount); }
      sim.events.push({ type: "creature", kind: "denClear", den: den.id, x: den.x, z: den.z });
      return;
    }
    den.state = "open";
    sim.events.push({ type: "creature", kind: "denOpen", den: den.id, x: den.x, z: den.z });
    // The Wild frontier's own line (already in every catalog).
    if (den.tame === "wyrm") sim.message("The Wyrm nest is clear: hold it for 30 seconds to tame a Dune Wyrm.");
    return;
  }
  if (den.state !== "open") return;
  // Only the player tames; any other fighter in the nest pauses it.
  let mine = false, other = false;
  for (const e of sim.entities) {
    if (e.hp <= 0 || e.kind !== "unit" || !(e.damage > 0) || e.type === "worker" || e.flying || e.team < 0 || distance(e, den) > den.r) continue;
    if (e.team === 0) mine = true; else other = true;
  }
  if (!mine) { den.since = 0; den.taker = null; return; }
  den.taker = 0;
  if (other) return;
  den.since += STEP_SECONDS;
  if (den.since + 1e-9 < CREATURES.den.tame) return;
  const spot = standNear(sim, den.x, den.z, D[den.tame].radius);
  const made = withDenIds(sim, () => sim.spawn(den.tame, 0, spot.x, spot.z, true, true));
  if (den.elder) {
    made.elder = true;
    made.name = den.tame === "wyrm" ? "Elder Wyrm" : `Elder ${D[den.tame].name}`;
    made.maxHp = made.hp = Math.round(made.maxHp * CREATURES.den.elder_hp);
    made.damage *= CREATURES.den.elder_damage;
  }
  den.state = "tamed";
  den.taker = null;
  sim.events.push({ type: "creature", kind: "tamed", den: den.id, id: made.id, team: 0, x: spot.x, z: spot.z });
  if (den.tame === "wyrm") sim.message(made.elder ? "The Elder Wyrm joins your expedition." : "A Dune Wyrm joins your expedition.");
}

function stepGuardian(sim, g, dt, think) {
  const s = g.guardian, c = CREATURES.guardian;
  if (s.state === "dormant") {
    if (g.hp < g.maxHp) {
      s.state = "awake";
      g.team = WILD_TEAM;
      sim.events.push({ type: "guardianWake", id: g.id, x: g.x, z: g.z });
    }
    return;
  }
  if (s.state === "awake") {
    const share = (c.kneel[sim.difficulty] ?? c.kneel.standard) / 100;
    if (g.hp / g.maxHp < share) {
      s.state = "kneel";
      s.until = sim.time + c.kneel_seconds;
      s.floor = Math.max(1, g.hp);
      g.team = NEUTRAL;
      g.knelt = true;
      g.attacking = false;
      g.wildTarget = null;
      // Nobody keeps hitting a guardian on its knees.
      for (const e of sim.entities) {
        if (e.target === g.id) e.target = null;
        if (e.orders?.length && e.orders.some((o) => o.target === g.id)) e.orders = e.orders.filter((o) => o.target !== g.id);
      }
      sim.events.push({ type: "guardianKneel", id: g.id, x: g.x, z: g.z });
      return;
    }
    fightNear(sim, g, s.post, c.leash, dt, think);
    return;
  }
  if (s.state === "kneel") {
    g.hp = Math.max(g.hp, s.floor);
    if (sim.time + 1e-9 < s.until) return;
    s.state = "joined";
    g.team = 0;
    g.knelt = false;
    g.stance = "guard";
    g.hp = Math.max(g.hp, Math.round(g.maxHp * c.join_hp));
    g.post = { x: g.x, z: g.z };
    delete g.lair;
    sim.events.push({ type: "guardianJoin", id: g.id, x: g.x, z: g.z });
    if (g.type === "vaultsentinel") sim.message("The Vault Sentinel rises and joins your squad.");
  }
}

export const campaignCreatures = {
  id: "campaignCreatures",
  order: 42, // after doctrines (41; both arrived on 2026-11-24)
  mixin: {
    // A den setup step (see the header).
    initDen(step) {
      const m = this.mission, place = this.missionPlace(step.at);
      const den = { id: step.den, x: place.x, z: place.z, r: step.r ?? CREATURES.den.r, guard: step.guard, tame: step.tame || null, elder: !!step.elder,
        reward: step.reward || null, aggro: step.aggro ?? CREATURES.den.aggro, state: "guarded", guards: [], taker: null, since: 0 };
      (m.dens ||= {})[den.id] = den;
      spawnGuards(this, den, step.countByDifficulty?.[this.difficulty] ?? step.count ?? 3);
    },
    // A guardian setup step (see the header).
    initGuardian(step) {
      const m = this.mission, place = this.missionPlace(step.at), d = D[step.guardian];
      const spot = standNear(this, place.x, place.z, d.radius);
      const g = withDenIds(this, () => this.spawn(step.guardian, NEUTRAL, spot.x, spot.z, true, true));
      g.stance = "hold";
      g.lair = { x: spot.x, z: spot.z };
      g.angle = step.facing ?? 0;
      if (step.tag) g.tag = step.tag;
      if (step.name) g.name = step.name;
      g.guardian = { state: "dormant", post: { x: spot.x, z: spot.z } };
      (m.guardians ||= []).push(g.id);
    },
    denDone(id) {
      const den = this.mission?.dens?.[id];
      return !!den && (den.state === "cleared" || den.state === "tamed");
    },
  },
  step(sim, dt) {
    const m = sim.mission;
    if (!m || (!m.dens && !m.guardians) || sim.result) return;
    const think = sim.ticks % THINK === 0;
    if (m.dens) {
      for (const den of Object.values(m.dens)) {
        if (den.state === "guarded")
          for (const id of den.guards) {
            const g = sim.get(id);
            if (!g) continue;
            if (!fightNear(sim, g, den, den.aggro, dt, think) && distance(g, g.lair) <= 1 && g.hp < g.maxHp) g.hp = Math.min(g.maxHp, g.hp + g.maxHp * CREATURES.den.regen * dt);
          }
        if (think) stepDen(sim, den);
      }
      // A tamed Wyrm dives and bursts up under enemy vehicles, as on the Wild frontier.
      if (!sim.wild) stepWyrms(sim, { creature: "wyrm" }, think);
    }
    for (const id of m.guardians || []) {
      const g = sim.get(id);
      if (g?.guardian) stepGuardian(sim, g, dt, think);
    }
  },
};
