// H1 Skywing, the assist hero (HERO-COINS-PLAN.md; owner 2026-11-27): an opt-in flying hero, bought with
// coins (src/meta/coins.js) before a story mission, skirmish or Defence level, who flies a Kite and carries
// two weapons the player switches between in the field:
//   sniper   a long-range precise shot, good against soldiers (weak against vehicles);
//   rocket   lock-on rockets that pick vehicles first and hit armour hard.
// Switching takes SWITCH_SECONDS (stow, then draw): no shot in between. The command is
// `{ type: "heroWeapon", team, id, weapon }`, logged and replayed like any other; `sim.heroWeapon(e)` reads it.
//
// Dive strike (the ability bar, cooldown 35 s): Skywing swoops on the thickest knot of ground enemies within
// reach (or the point given), blasts it with the weapon in hand (rocket: x1.5 on vehicles) and climbs back.
//
// Limits, so the army still matters: one Skywing per match (the command `skywing` is refused after the first
// call); it never captures a point or reaches an objective (flyers never capture; `e.assist` is left out of
// "reach", "enter", "army lost" and the squad-only side check); 50% damage to buildings and walls; downed,
// it comes back at home RETURN seconds later; losing it never fails anything. Not in LAN matches.
//
// State: entity keys `assist` (true), `weapon`, `weaponTo`/`weaponAt` (a switch in progress) and `swoop`
// (a dive in progress); `sim.skywing = { team, id, back? }` from the first call. A match without Skywing
// saves and hashes exactly as before. Skywing takes ids from its own range (as campaign heroes do), so every
// other entity keeps the id it would have had.
import { DEFINITIONS as D, distance } from "../../data.js";

export const SKYWING = Object.freeze({ type: "kite", hp: 480, shield: 120, speed: 6, vision: 22, buildings: 0.5, returnSeconds: 30, price: 60, switchSeconds: 1 });
export const SWITCH_SECONDS = SKYWING.switchSeconds;
export const RETURN_SECONDS = SKYWING.returnSeconds;
const IDS = 3.5e6;

// The two weapons: figures the entity takes while each is in hand (the rocket from the Anti-tank soldier x1.3).
export const WEAPONS = Object.freeze({
  sniper: { id: "sniper", name: "Sniper", damage: 30, interval: 1.8, range: 14, mechanical_bonus: 0.6, air_scale: 1, prefers: ["antiarmor", "ranged", "support", "melee"], shot: "ranger" },
  rocket: { id: "rocket", name: "Rocket", damage: Math.round(D.antitank.damage * 1.3), interval: D.antitank.interval, range: D.antitank.range, mechanical_bonus: D.antitank.mechanical_bonus, air_scale: D.antitank.air_scale, prefers: ["armor", "siege", "air"], shot: "antitank" },
});
export const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));
export const DEFAULT_WEAPON = "sniper";

// Dive strike: `strike` s after the cast the blast lands; `seconds` is the whole swoop.
export const DIVE_STRIKE = Object.freeze({ id: "skydive", name: "Dive strike", cooldown: 35, range: 16, radius: 3.5, damage: 70, armour: 1.5, strike: 1.1, seconds: 2.5, icon: "dive", order: 19, tint: [1, 0.85, 0.45],
  description: "Swoop on the thickest group of ground enemies within 16 m: 70 damage to each within 3.5 m with the weapon in hand (rockets: 1.5x to vehicles), half to buildings." });

export const isSkywing = (e) => !!e && e.assist === true;

function withIds(sim, make) {
  const saved = sim.nextId;
  sim.nextId = sim.skywing?.ids ?? IDS;
  try { return make(); } finally { sim.skywing.ids = sim.nextId; sim.nextId = saved; }
}

// The weapon's figures on the entity (damage, reach, target choice, the shot drawn).
function arm(e, weapon) {
  const w = WEAPONS[weapon] || WEAPONS[DEFAULT_WEAPON];
  e.weapon = w.id;
  e.damage = w.damage;
  e.interval = w.interval;
  e.range = w.range;
  e.mechanical_bonus = w.mechanical_bonus;
  e.air_scale = w.air_scale;
  e.prefers = [...w.prefers];
  e.shot = w.shot;
}

// Turns a fresh Kite into Skywing.
export function makeSkywing(e, weapon = DEFAULT_WEAPON) {
  e.assist = true;
  e.name = "Skywing";
  e.hp = e.maxHp = SKYWING.hp;
  e.shield = e.maxShield = SKYWING.shield;
  e.speed = SKYWING.speed;
  e.vision = SKYWING.vision;
  e.hits_air = true;
  e.building_bonus = SKYWING.buildings;
  e.pop = 0;
  e.ability = { ...DIVE_STRIKE };
  e.stance = "guard";
  arm(e, weapon);
  return e;
}

// Ground enemies the dive may hit.
const groundFoe = (sim, e, t) => t.hp > 0 && (t.kind === "unit" || t.kind === "building" || t.kind === "wall") && !t.flying && sim.hostile(e.team, t.team);
// The point Skywing dives on: the seen ground enemy unit within reach with the most enemy units within the
// blast radius (ties: the nearer, then the lower id), or null.
export function diveSpot(sim, e, a = DIVE_STRIKE) {
  let best = null, bestN = 0, bestD = Infinity;
  const near = sim.entities.filter((t) => t.kind === "unit" && groundFoe(sim, e, t) && sim.isVisible(t, e.team) && distance(e, t) <= a.range + (t.radius || 0));
  for (const t of near) {
    let n = 0;
    for (const o of near) if (distance(o, t) <= a.radius) n++;
    const d = distance(e, t);
    if (n > bestN || (n === bestN && (d < bestD || (d === bestD && t.id < best.id)))) { best = t; bestN = n; bestD = d; }
  }
  return best ? { x: best.x, z: best.z, n: bestN } : null;
}

// The blast: every ground enemy within the radius (buildings and walls by their edge).
function blast(sim, e, s, a) {
  const rocket = e.weapon === "rocket";
  let hit = 0;
  for (const t of [...sim.entities]) {
    if (!groundFoe(sim, e, t)) continue;
    const d = distance(t, s) - (t.kind === "unit" ? 0 : t.radius || 0);
    if (d > a.radius) continue;
    const k = t.kind === "unit" ? (rocket && t.mechanical ? a.armour : 1) : SKYWING.buildings;
    sim.applyDamage(t, a.damage * k, e.team, e.id);
    hit++;
  }
  sim.events.push({ type: "skystrike", id: e.id, team: e.team, x: s.x, z: s.z, radius: a.radius, weapon: e.weapon, hit });
}

// Where Skywing starts and comes back: by the team's Command core, else the Defence commander, else the squad.
function home(sim, team) {
  const own = sim.own(team);
  const core = own.find((e) => e.type === "hq" && e.hp > 0 && e.complete) || own.find((e) => e.type === "hq" && e.hp > 0);
  if (core) return { x: core.x + (core.x > 0 ? -4 : 4), z: core.z + (core.z > 0 ? -4 : 4) };
  const lead = (sim.defence && sim.commander?.()) || own.find((e) => e.kind === "unit" && e.hp > 0 && !e.assist) || own[0];
  return lead ? { x: lead.x, z: lead.z } : { x: 0, z: 0 };
}

function spawnAt(sim, team, weapon) {
  const at = home(sim, team);
  const limit = sim.terrain.half - 2;
  const x = Math.max(-limit, Math.min(limit, at.x)), z = Math.max(-limit, Math.min(limit, at.z));
  const e = withIds(sim, () => sim.spawn(SKYWING.type, team, x, z, true, true));
  makeSkywing(e, weapon);
  sim.setBaseHp(e);
  e.post = { x, z };
  sim.skywing.id = e.id;
  return e;
}

export const skywing = {
  id: "skywing",
  order: 45, // after campaign heroes (44)
  mixin: {
    // Calls Skywing in for `team` (once per match). False when it cannot come.
    callSkywing(team = 0, weapon = DEFAULT_WEAPON) {
      if (this.skywing || this.lan || this.result || !this.players[team] || this.players[team].eliminated || !this.humanTeam(team) || !WEAPONS[weapon]) return false;
      this.skywing = { team };
      const e = spawnAt(this, team, weapon);
      this.events.push({ type: "skywing", id: e.id, team, x: e.x, z: e.z });
      this.message("Skywing has joined the battle.", team);
      return true;
    },
    // The weapon in hand (during a switch: the one being stowed), or null for anything but Skywing.
    heroWeapon(e) {
      return isSkywing(e) ? e.weapon || DEFAULT_WEAPON : null;
    },
    // Starts a switch to `weapon` (SWITCH_SECONDS without a shot, then the new figures). Switching back to
    // the weapon in hand during a switch cancels it.
    switchHeroWeapon(e, weapon) {
      if (!isSkywing(e) || e.hp <= 0 || !WEAPONS[weapon]) return false;
      if (weapon === e.weapon) { if (e.weaponTo) { delete e.weaponTo; delete e.weaponAt; } return true; }
      if (e.weaponTo === weapon) return true;
      e.weaponTo = weapon;
      e.weaponAt = this.time + SWITCH_SECONDS;
      e.cooldown = Math.max(e.cooldown, SWITCH_SECONDS);
      this.events.push({ type: "heroWeapon", id: e.id, team: e.team, weapon, x: e.x, z: e.z });
      return true;
    },
  },
  commands: {
    skywing: {
      allowed: (sim, c) => !sim.skywing && !sim.lan && (c.weapon === undefined || !!WEAPONS[c.weapon]),
      run: (sim, c) => sim.callSkywing(c.team, c.weapon ?? DEFAULT_WEAPON),
    },
    heroWeapon: {
      allowed: (sim, c) => { const e = sim.get(c.id); return isSkywing(e) && e.team === c.team && !!WEAPONS[c.weapon]; },
      run: (sim, c) => sim.switchHeroWeapon(sim.get(c.id), c.weapon),
    },
  },
  abilities: {
    skydive: {
      use(sim, e, a, point) {
        if (e.swoop) return false;
        let s = null;
        if (point && Number.isFinite(point.x) && Number.isFinite(point.z) && distance(e, point) <= a.range && sim.entities.some((t) => t.kind === "unit" && groundFoe(sim, e, t) && distance(t, point) <= a.radius)) s = { x: point.x, z: point.z };
        else s = diveSpot(sim, e, a);
        if (!s) return false;
        e.swoop = { x: s.x, z: s.z, hit: sim.time + a.strike, end: sim.time + a.seconds };
        e.orders = [];
        e.post = { x: s.x, z: s.z };
        return { at: { x: s.x, z: s.z } };
      },
    },
  },
  autocast(sim, e, a) {
    if (a.id !== DIVE_STRIKE.id) return undefined;
    return diveSpot(sim, e, a)?.n >= 2 ? true : false;
  },
  onDeath(sim, t) {
    if (!isSkywing(t) || !sim.skywing || sim.skywing.id !== t.id) return;
    sim.skywing.back = sim.time + RETURN_SECONDS;
    delete sim.skywing.id;
    sim.events.push({ type: "heroDown", hero: "skywing", x: t.x, z: t.z, at: sim.skywing.back });
    sim.message(`Skywing is down: back in ${RETURN_SECONDS} seconds.`, t.team);
  },
  step(sim, dt) {
    const s = sim.skywing;
    if (!s || sim.result) return;
    if (s.back !== undefined) {
      if (sim.time < s.back - 1e-9 || sim.players[s.team]?.eliminated) return;
      delete s.back;
      const e = spawnAt(sim, s.team, DEFAULT_WEAPON);
      sim.events.push({ type: "heroBack", hero: "skywing", id: e.id, x: e.x, z: e.z });
      sim.message("Skywing is back on the field.", s.team);
      return;
    }
    const e = sim.get(s.id);
    if (!e || e.hp <= 0) return;
    // A weapon switch finishing.
    if (e.weaponTo && sim.time >= e.weaponAt - 1e-9) { arm(e, e.weaponTo); delete e.weaponTo; delete e.weaponAt; }
    // A dive: down to the point, the blast, then the climb (the view eases the height).
    if (e.swoop) {
      const w = e.swoop;
      if (!w.done) {
        const dx = w.x - e.x, dz = w.z - e.z, d = Math.hypot(dx, dz), step = e.speed * 2 * dt;
        if (d > 0.05) { const k = Math.min(1, step / d); e.x += dx * k; e.z += dz * k; e.angle = Math.atan2(dx, dz); e.moving = true; }
        if (sim.time >= w.hit - 1e-9) { w.done = true; blast(sim, e, w, e.ability || DIVE_STRIKE); }
      }
      if (sim.time >= w.end - 1e-9) delete e.swoop;
    }
    // Frontier Defence has no unit orders: Skywing hunts the nearest seen enemy and dives on its own.
    if (sim.defence && !e.orders.length && !e.swoop) {
      s.clock = (s.clock ?? 0) - dt;
      if (s.clock <= 0) {
        s.clock = 1;
        let best = null, bd = Infinity;
        for (const t of sim.entities) if (t.hp > 0 && t.kind === "unit" && sim.hostile(e.team, t.team) && sim.isVisible(t, e.team) && sim.canHit(e, t)) { const d = distance(e, t); if (d < bd) { best = t; bd = d; } }
        if (best) e.orders = [{ type: "attack", target: best.id }];
        if (sim.abilityReady(e) && diveSpot(sim, e)?.n >= 2) sim.useAbility(e);
      }
    }
  },
};
