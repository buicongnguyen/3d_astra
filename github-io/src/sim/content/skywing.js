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
// Land / walk / take off (owner 2026-11-28; Hero mode first): the command
// `{ type: "skywingLand", team, id, land: true|false, x?, z? }` (logged and replayed like any other).
//   land     a glide of LAND.land seconds down to a clear spot under the point given (Hero mode: the reticle; at
//            most LAND.reach m away, else under Skywing), or the nearest clear spot within LAND.search m when that
//            one is blocked (nav.canStand: buildings, walls, water, cliffs). On touchdown `flying` turns false:
//            Skywing is a ground unit (routes, pushes, plateau sight) that every ground weapon can target, and its
//            Sniper reaches LAND.sniperRange m further (it shoots from a steady stance).
//   take off a climb of LAND.takeoff seconds, still on the ground for targeting (ground weapons keep hitting it),
//            then `flying` again; landing again waits LAND.cooldown seconds.
//   Dive strike only in the air. Times are real seconds in Hero mode (x the battle-time scale, as the dodge).
// State: entity keys `assist` (true), `weapon`, `weaponTo`/`weaponAt` (a switch in progress), `swoop`
// (a dive in progress), and after a first landing `landed` (on the ground, also while taking off), `skyland`
// (a glide or climb in progress) and `skyReady` (the next landing allowed); `sim.skywing = { team, id, back? }`
// from the first call. A match without Skywing (or one that never lands it) saves and hashes exactly as before. Skywing takes ids from its own range (as campaign heroes do), so every
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

// Land / take off (owner 2026-11-28): seconds in real time (x the Hero mode battle-time scale), metres.
// walk: its speed on foot (a Ranger walks 4.2 m/s; in the air it flies SKYWING.speed).
export const LAND = Object.freeze({ land: 1, takeoff: 1.5, cooldown: 3, reach: 6, search: 6, sniperRange: 2, walk: 4.6 });
// Landed sight (owner 2026-11-28, PART D): `vision` m all round by the ground rules (no seeing over cliffs); after
// standing still `still` s (real seconds x battle time: no move, no dash) the scope adds `scope` m in a `cone`-degree
// cone along its facing; on high ground `high` m more in all (in place of the terrain's usual high-ground bonus).
export const SIGHT = Object.freeze({ vision: 18, scope: 26, cone: 70, still: 1, high: 4 });

export const isSkywing = (e) => !!e && e.assist === true;
// Skywing on the ground (also while it climbs away on a take-off).
export const isLanded = (e) => isSkywing(e) && e.landed === true;

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
  // Standing, the Sniper shoots from a steady stance and reaches a little further (land / walk, 2026-11-28).
  e.range = w.range + (e.landed && w.id === "sniper" ? LAND.sniperRange : 0);
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

// The clear spot nearest (x, z) where Skywing can stand: the point itself, else rings out to LAND.search m (half a
// metre apart, 16 directions each, in a fixed order, so replays agree), or null.
export function landSpot(sim, e, x, z) {
  const r = e.radius || 0.8, ok = (px, pz) => sim.nav.canStand(px, pz, r);
  if (ok(x, z)) return { x, z };
  for (let d = 0.5; d <= LAND.search + 1e-9; d += 0.5) {
    let best = null, bd = Infinity;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      if (!ok(px, pz)) continue;
      // Of the free directions on the nearest ring, the one closest to Skywing (less of a sideways glide).
      const q = Math.hypot(px - e.x, pz - e.z);
      if (q < bd - 1e-9) { best = { x: px, z: pz }; bd = q; }
    }
    if (best) return best;
  }
  return null;
}
// The point a landing aims at: the one given (at most LAND.reach m from Skywing, pulled in along the line), else
// under Skywing.
function landAim(e, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return { x: e.x, z: e.z };
  const dx = point.x - e.x, dz = point.z - e.z, d = Math.hypot(dx, dz);
  if (d <= LAND.reach) return { x: point.x, z: point.z };
  return { x: e.x + (dx / d) * LAND.reach, z: e.z + (dz / d) * LAND.reach };
}
const smooth = (t) => t * t * (3 - 2 * t);

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
    // Lands Skywing (land) or takes it off. False when it cannot: a landing needs it in the air, not diving, past
    // its cooldown and a clear spot near the point; a take-off needs it on the ground. Neither starts while the
    // other is under way.
    skywingLand(e, land, point = null) {
      if (!isSkywing(e) || e.hp <= 0 || e.skyland) return false;
      const k = e.driven ?? 1;
      if (land) {
        if (!e.flying || e.swoop || this.time < (e.skyReady ?? -Infinity) - 1e-9) return false;
        const aim = landAim(e, point), spot = landSpot(this, e, aim.x, aim.z);
        if (!spot) return false;
        e.skyland = { phase: "land", fx: e.x, fz: e.z, x: spot.x, z: spot.z, t0: this.time, at: this.time + LAND.land * k };
        e.orders = [];
        e.path = [];
        if (spot.x !== e.x || spot.z !== e.z) e.angle = Math.atan2(spot.x - e.x, spot.z - e.z);
        this.events.push({ type: "skywingLand", id: e.id, team: e.team, phase: "land", x: spot.x, z: spot.z, seconds: LAND.land * k });
        return true;
      }
      if (e.flying || !e.landed) return false;
      e.skyland = { phase: "takeoff", t0: this.time, at: this.time + LAND.takeoff * k };
      e.orders = [];
      e.path = [];
      this.events.push({ type: "skywingLand", id: e.id, team: e.team, phase: "takeoff", x: e.x, z: e.z, seconds: LAND.takeoff * k });
      return true;
    },
    // A glide or climb in progress, in place of the entity's own step (simulation.js stepEntity). Always true.
    stepSkyland(e, dt) {
      const s = e.skyland, x0 = e.x, z0 = e.z;
      if (s.phase === "land") {
        const t = Math.min(1, (this.time - s.t0) / Math.max(1e-6, s.at - s.t0)), f = smooth(t);
        e.x = s.fx + (s.x - s.fx) * f;
        e.z = s.fz + (s.z - s.fz) * f;
        e.moving = e.x !== x0 || e.z !== z0;
        if (this.time >= s.at - 1e-9) {
          e.x = s.x; e.z = s.z;
          delete e.skyland;
          e.flying = false;
          e.landed = true;
          e.speed = LAND.walk;
          e.vision = SIGHT.vision;
          e.stillAt = this.time;
          e.post = { x: e.x, z: e.z };
          arm(e, e.weapon);
          this.events.push({ type: "skywingLanded", id: e.id, team: e.team, x: e.x, z: e.z });
        }
      } else if (this.time >= s.at - 1e-9) {
        delete e.skyland;
        delete e.landed;
        e.flying = true;
        e.speed = SKYWING.speed;
        e.vision = SKYWING.vision;
        delete e.stillAt; delete e.scope;
        e.skyReady = this.time + LAND.cooldown * (e.driven ?? 1);
        e.post = { x: e.x, z: e.z };
        arm(e, e.weapon);
        this.events.push({ type: "skywingAirborne", id: e.id, team: e.team, x: e.x, z: e.z });
      }
      if (e.driven !== undefined) e.vel = { x: (e.x - x0) / dt, z: (e.z - z0) / dt };
      return true;
    },
    // The scope's sight cone for `team` (sim/vision.js, at the vision step): cells within SIGHT.scope m (+ the
    // high-ground bonus) whose bearing is within half the cone of Skywing's facing, by the same plateau rule.
    scopeVision(team, e, low, up, bonus) {
      const t = this.terrain, g = t.grid, sight = SIGHT.scope + bonus, half = (SIGHT.cone / 2) * (Math.PI / 180);
      const [cx, cz] = this.nav.cellAt(e.x, e.z), r = Math.ceil(sight / 2), fa = e.angle || 0;
      for (let z = Math.max(0, cz - r); z <= Math.min(g - 1, cz + r); z++) for (let x = Math.max(0, cx - r); x <= Math.min(g - 1, cx + r); x++) {
        const i = z * g + x;
        if (low && t.cellDeep[i] && !up.has(t.cellPlateau[i])) continue;
        const wx = x * 2 - t.half + 1, wz = z * 2 - t.half + 1, d = Math.hypot(wx - e.x, wz - e.z);
        if (d > sight) continue;
        const b = Math.atan2(wx - e.x, wz - e.z) - fa;
        if (d > 2 && Math.abs(Math.atan2(Math.sin(b), Math.cos(b))) > half) continue;
        this.visible[team][i] = this.explored[team][i] = 1;
      }
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
    skywingLand: {
      allowed: (sim, c) => { const e = sim.get(c.id); return isSkywing(e) && e.team === c.team && typeof c.land === "boolean" && (c.x === undefined || Number.isFinite(c.x)) && (c.z === undefined || Number.isFinite(c.z)); },
      run: (sim, c) => sim.skywingLand(sim.get(c.id), c.land, c.x === undefined || c.z === undefined ? null : { x: c.x, z: c.z }),
    },
    heroWeapon: {
      allowed: (sim, c) => { const e = sim.get(c.id); return isSkywing(e) && e.team === c.team && !!WEAPONS[c.weapon]; },
      run: (sim, c) => sim.switchHeroWeapon(sim.get(c.id), c.weapon),
    },
  },
  abilities: {
    skydive: {
      use(sim, e, a, point) {
        // Only in the air (land / walk, 2026-11-28): the button greys with a reason while Skywing is down.
        if (e.swoop || !e.flying || e.skyland) return false;
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
    if (!e.flying || e.skyland) return false;
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
    // On foot: the scope comes up after standing still (no move, no dash) for SIGHT.still real seconds.
    if (e.landed && !e.skyland) {
      if (e.moving || e.dash || e.drive) { e.stillAt = sim.time; if (e.scope) delete e.scope; }
      else if (!e.scope && sim.time >= (e.stillAt ?? sim.time) + SIGHT.still * (e.driven ?? 1) - 1e-9) e.scope = true;
    } else if (e.scope) delete e.scope;
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
    if (sim.defence && !e.orders.length && !e.swoop && e.driven === undefined) {
      s.clock = (s.clock ?? 0) - dt;
      if (s.clock <= 0) {
        s.clock = 1;
        let best = null, bd = Infinity;
        for (const t of sim.entities) if (t.hp > 0 && t.kind === "unit" && sim.hostile(e.team, t.team) && sim.isVisible(t, e.team) && sim.canHit(e, t)) { const d = distance(e, t); if (d < bd) { best = t; bd = d; } }
        if (best) e.orders = [{ type: "attack", target: best.id }];
        if (e.flying && !e.skyland && sim.abilityReady(e) && diveSpot(sim, e)?.n >= 2) sim.useAbility(e);
      }
    }
  },
};
