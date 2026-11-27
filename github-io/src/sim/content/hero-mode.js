// H3a/H3d Hero mode (HERO-COINS-PLAN.md, owner 2026-11-27): the player fights as one hero (a campaign hero or
// Skywing) while the steward (sim/steward.js) runs the base. The rules part; the camera, controls and HUD are
// src/hero-mode.js, the drawn projectiles and warning rings src/hero-mode-view.js.
//
// Commands (logged and replayed like any other, so a match in Hero mode replays tick for tick):
//   { type: "heroMode", team, id, on, scale }  enter (on) or leave; `scale` is the battle-time scale (0.4 / 0.5 /
//                                               0.75 / 1) the page runs the clock at; LAN matches always use 1
//   { type: "heroDrive", team, dx, dz }         the move stick (world x/z, length <= 1; 0, 0 stops)
//   { type: "heroFire", team, target, hold }    shoot `target` (hold: keep firing until a new heroFire), null stops
//   { type: "heroDodge", team, dx, dz }         the dodge dash (Skywing: a barrel roll) toward dx, dz
//
// Battle time (H3d): the page slows the clock to `scale` (app/frame.js); the rules keep the hero quick in real
// time: it moves at HERO_TIME.real of its own speed in real time (never slower than its own speed in game time)
// and reloads at its own rate in real time. Both come from `scale` carried in the state, so they are deterministic.
//
// Dodging (H3d): a shot from an enemy at a driven hero is a real projectile (SHOTS m/s of game time, aimed with a
// part lead), checked on arrival: a miss when the hero has left the hit radius; splash still hurts near the impact.
// Every other shot stays an instant hit, so RTS balance is unchanged. The dash gives DODGE.seconds without damage.
//
// State: `sim.heroMode = { teams: { [team]: { id, scale } }, shots: [...], n }`, made on the first entry and
// removed when no team is in Hero mode and no projectile is in flight; entity keys `driven` (the scale), `drive`,
// `trigger`, `vel`, `dash`, `dodgeUntil`, `dodgeReady` exist only on a driven hero. A match that never uses it
// saves and hashes exactly as before.
import { distance, hyp } from "../../data.js";

export const HERO_TIME = Object.freeze({ scales: Object.freeze([0.4, 0.5, 0.75, 1]), scale: 0.5, real: 0.8, ease: 0.3 });
// Real seconds (converted to game time with the scale): no damage for `seconds`, `cooldown` between dodges,
// `dash` metres covered.
export const DODGE = Object.freeze({ seconds: 0.3, cooldown: 4, dash: 3.6 });
// Projectile speeds in m/s of game time (rifle rounds, rockets, shells), the extra hit radius around the hero,
// and the share of the hero's motion the shooter leads by.
export const SHOTS = Object.freeze({ fast: 28, rocket: 22, shell: 18, hit: 0.6, lead: 0.6, melee: 2.6 });
const HEAVY = new Set(["breaker", "tank", "antitank", "artillery", "mortar", "rocket", "lancer", "tower"]);

export const isDriven = (e) => !!e && e.driven !== undefined;
const heroic = (e) => !!e && (!!e.assist || (typeof e.hero === "string" && e.hero.length > 0));
const scaleOf = (sim, scale) => (sim.lan ? 1 : HERO_TIME.scales.includes(scale) ? scale : HERO_TIME.scale);
// The hero's move factor in game time: HERO_TIME.real of its speed in real time, never below its own speed.
export const heroBoost = (scale) => Math.max(1, HERO_TIME.real / scale);
// The projectile speed for a shooter's weapon.
export function shotSpeed(e) {
  const w = e.shot || e.type;
  if (w === "antitank" || w === "rocket" || w === "lancer") return SHOTS.rocket;
  return HEAVY.has(w) || e.splash_radius ? SHOTS.shell : SHOTS.fast;
}

// The commands the page sends to enter and leave (src/hero-mode.js): Hero mode and the steward together, so the
// computer runs the base while the player fights, and hands it back with every queue and order kept.
export const enterCommands = (team, id, scale = HERO_TIME.scale) => [{ team, type: "heroMode", id, on: true, scale }, { team, type: "steward", on: true }];
export const leaveCommands = (team) => [{ team, type: "heroMode", on: false }, { team, type: "steward", on: false }];

function clean(sim) {
  const h = sim.heroMode;
  if (h && !Object.keys(h.teams).length && !h.shots.length) delete sim.heroMode;
}
function release(e) {
  for (const key of ["driven", "drive", "trigger", "vel", "dash", "dodgeUntil", "dodgeReady"]) delete e[key];
}

export const heroMode = {
  id: "heroMode",
  order: 46, // after Skywing (45): a dive has moved the hero before its projectiles are checked
  mixin: {
    // Enters (on) or leaves Hero mode for `team` with hero `id`. False when it cannot.
    setHeroMode(team, on, id, scale) {
      const h = this.heroMode, now = h?.teams[team];
      if (!on) {
        if (!now) return true;
        const e = this.get(now.id);
        // The hero stays where it was left: no old order or post walks it back.
        if (e) { release(e); e.orders = []; e.post = { x: e.x, z: e.z }; }
        delete h.teams[team];
        clean(this);
        return true;
      }
      const e = this.get(id);
      if (!e || e.team !== team || e.hp <= 0 || e.kind !== "unit" || !heroic(e)) return false;
      if (now && now.id !== id) { const old = this.get(now.id); if (old) release(old); }
      const k = scaleOf(this, scale);
      (this.heroMode ||= { teams: {}, shots: [], n: 0 }).teams[team] = { id, scale: k };
      e.driven = k;
      e.orders = [];
      e.path = [];
      return true;
    },
    heroModeOf(team = 0) {
      return this.heroMode?.teams[team] || null;
    },
    // One driven hero's tick, in place of its order behaviour (simulation.js stepEntity). Always true.
    stepDriven(e, dt) {
      const k = e.driven;
      // Reload at its own rate in real time: the clock runs at k.
      if (k < 1) e.cooldown -= dt * (1 / k - 1);
      const x0 = e.x, z0 = e.z;
      // A Skywing dive moves itself (sim/content/skywing.js).
      if (!e.swoop) {
        let vx = 0, vz = 0, speed = 0;
        if (e.dash && this.time < e.dash.until + 1e-9) { vx = e.dash.x; vz = e.dash.z; speed = DODGE.dash / (DODGE.seconds * k); }
        else {
          if (e.dash) delete e.dash;
          if (e.drive) { vx = e.drive.x; vz = e.drive.z; speed = this.moveSpeed(e) * heroBoost(k); }
        }
        if (speed > 0 && e.speed > 0 && (vx || vz)) this.heroStep(e, vx, vz, speed * dt);
      }
      e.vel = { x: (e.x - x0) / dt, z: (e.z - z0) / dt };
      const t = e.trigger ? this.get(e.trigger.target) : null;
      if (e.trigger && (!t || t.hp <= 0 || this.time > e.trigger.until)) delete e.trigger;
      else if (t) {
        e.angle = Math.atan2(t.x - e.x, t.z - e.z);
        const range = e.range + this.heightRange(e, t) + t.radius + 0.00001;
        const clear = e.flying || t.flying || this.nav.clearLine(e, t, t.id);
        if (distance(e, t) <= range && clear && this.attackable(e.team, t) && this.isVisible(t, e.team) && (!t.flying || this.canHit(e, t))) {
          e.attacking = true;
          if (e.cooldown <= 0 && !(e.fx && !this.canAct(e, "fire"))) {
            this.hit(e, t);
            if (!e.trigger.hold) delete e.trigger;
          }
        }
      } else if (e.moving) e.angle = Math.atan2(e.vel.x, e.vel.z);
      return true;
    },
    // A straight step for a driven hero: flyers inside the map, walkers only onto ground they can stand on
    // (sliding along a wall or bank on one axis when the straight step is blocked).
    heroStep(e, vx, vz, step) {
      const n = hyp(vx, vz) || 1, dx = (vx / n) * step, dz = (vz / n) * step;
      const limit = this.terrain.half - Math.max(1, e.radius + 0.1);
      const inside = (v) => Math.max(-limit, Math.min(limit, v));
      if (e.flying) { e.x = inside(e.x + dx); e.z = inside(e.z + dz); e.moving = true; return; }
      const ok = (x, z) => this.nav.canStand(x, z, e.radius) && this.nav.canTraverse(e, { x, z }, e.radius);
      for (const [x, z] of [[e.x + dx, e.z + dz], [e.x + dx, e.z], [e.x, e.z + dz]]) {
        const cx = inside(x), cz = inside(z);
        if ((cx !== e.x || cz !== e.z) && ok(cx, cz)) { e.x = cx; e.z = cz; e.moving = true; return; }
      }
    },
    // combat.js hit(): a shot from an enemy at a driven hero flies as a projectile. False for a shot that stays
    // instant (melee range).
    heroShot(e, target) {
      if (e.team === target.team || (e.range || 0) <= SHOTS.melee) return false;
      const h = this.heroMode;
      if (!h) return false;
      const speed = shotSpeed(e), d = distance(e, target), travel = Math.max(0.12, d / speed);
      const v = target.vel || { x: 0, z: 0 };
      const x = target.x + v.x * travel * SHOTS.lead, z = target.z + v.z * travel * SHOTS.lead;
      const dmg = this.shotValue(e, target, true);
      const splash = !target.flying && e.splash_radius ? { r: e.splash_radius, k: e.splash_damage } : null;
      const heavy = !!splash || HEAVY.has(e.shot || e.type);
      const n = ++h.n;
      h.shots.push({ n, by: e.id, team: e.team, target: target.id, sx: e.x, sz: e.z, x, z, t0: this.time, at: this.time + travel, dmg, ...(splash ? { splash } : null), ...(heavy ? { heavy: true } : null), weapon: e.shot || e.type, ...(target.flying ? { air: true } : null) });
      this.events.push({
        ...(e.flying ? { sAir: e.fly } : e.gun_height ? { sAir: e.gun_height - 0.4 } : null),
        ...(target.flying ? { tAir: target.fly } : null),
        type: "shot", weapon: e.shot || e.type, unit: e.type, source: e.id, target: target.id,
        x: e.x, z: e.z, tx: x, tz: z, team: e.team, heavy: ["breaker", "tank", "antitank"].includes(e.shot || e.type), slow: travel, heroShot: n,
      });
      if (this.factionFor(e.team).trait) e.shotAt = this.time;
      e.cooldown = e.interval * (e.fx ? this.statusFactor(e, "reload") : 1);
      return true;
    },
    // The dodge: a short dash with no damage, then a cooldown (both in real seconds).
    heroDodge(team, dx, dz) {
      const now = this.heroMode?.teams[team], e = now && this.get(now.id);
      if (!e || e.hp <= 0 || !isDriven(e) || this.time < (e.dodgeReady ?? -Infinity) - 1e-9) return false;
      const k = e.driven;
      let x = dx, z = dz, n = hyp(x, z);
      // No direction: away from the nearest projectile in flight, else to the hero's right.
      if (!(n > 0.01)) {
        const s = this.heroMode.shots.find((q) => q.target === e.id);
        const ax = s ? e.x - s.sx : Math.cos(e.angle || 0), az = s ? e.z - s.sz : -Math.sin(e.angle || 0);
        x = -az; z = ax; n = hyp(x, z) || 1;
      }
      e.dash = { x: x / n, z: z / n, until: this.time + DODGE.seconds * k };
      e.dodgeUntil = this.time + DODGE.seconds * k;
      e.dodgeReady = this.time + DODGE.cooldown * k;
      this.events.push({ type: "heroDodge", id: e.id, team, x: e.x, z: e.z, roll: !!e.flying, seconds: DODGE.seconds * k });
      return true;
    },
  },
  commands: {
    heroMode: {
      allowed: (sim, c) => (c.on ? Number.isInteger(c.id) && (c.scale === undefined || HERO_TIME.scales.includes(c.scale)) : true),
      run: (sim, c) => sim.setHeroMode(c.team, !!c.on, c.id, c.scale),
    },
    heroDrive: {
      allowed: (sim, c) => !!sim.heroMode?.teams[c.team] && Number.isFinite(c.dx) && Number.isFinite(c.dz),
      run: (sim, c) => {
        const e = sim.get(sim.heroMode.teams[c.team].id);
        if (!isDriven(e)) return false;
        const n = hyp(c.dx, c.dz);
        if (n < 0.05) delete e.drive;
        else { const k = n > 1 ? 1 / n : 1; e.drive = { x: c.dx * k, z: c.dz * k }; }
        return true;
      },
    },
    heroFire: {
      allowed: (sim, c) => !!sim.heroMode?.teams[c.team] && (c.target === null || Number.isInteger(c.target)),
      run: (sim, c) => {
        const e = sim.get(sim.heroMode.teams[c.team].id);
        if (!isDriven(e)) return false;
        const t = c.target === null ? null : sim.get(c.target);
        if (!t || !sim.hostile(e.team, t.team)) { delete e.trigger; return c.target === null; }
        // A single shot waits up to 1.5 real seconds for the reload; a held trigger until it is let go.
        e.trigger = { target: t.id, hold: !!c.hold, until: c.hold ? Infinity : sim.time + 1.5 * e.driven };
        return true;
      },
    },
    heroDodge: {
      allowed: (sim, c) => !!sim.heroMode?.teams[c.team] && (c.dx === undefined || Number.isFinite(c.dx)) && (c.dz === undefined || Number.isFinite(c.dz)),
      run: (sim, c) => sim.heroDodge(c.team, c.dx ?? 0, c.dz ?? 0),
    },
  },
  // Projectiles land: the hit is checked where the hero is now.
  step(sim) {
    const h = sim.heroMode;
    if (!h || !h.shots.length) return;
    const due = h.shots.filter((s) => sim.time >= s.at - 1e-9);
    if (!due.length) return;
    h.shots = h.shots.filter((s) => sim.time < s.at - 1e-9);
    for (const s of due) {
      const hero = sim.get(s.target), shooter = sim.get(s.by);
      const hit = !!hero && hero.hp > 0 && hyp(hero.x - s.x, hero.z - s.z) <= (hero.radius || 0.6) + SHOTS.hit;
      const dodged = hit && hero.dodgeUntil > sim.time;
      if (hit) sim.applyDamage(hero, s.dmg, s.team, s.by);
      // Splash near the impact: the shooter's own figures when it still stands, else the shot's damage.
      if (s.splash) {
        for (const t of [...sim.entities]) {
          if (t.hp <= 0 || t.flying || (hit && t === hero) || !sim.hostile(s.team, t.team)) continue;
          if (hyp(t.x - s.x, t.z - s.z) - (t.kind === "unit" ? 0 : t.radius || 0) >= s.splash.r) continue;
          sim.applyDamage(t, (shooter ? sim.shotValue(shooter, t, false) : s.dmg) * s.splash.k, s.team, s.by);
        }
      }
      sim.events.push({ type: "heroShotLand", n: s.n, x: s.x, z: s.z, hit: hit && !dodged, dodged, heavy: !!s.heavy, team: s.team, target: s.target, ...(s.air ? { air: true } : null) });
    }
    clean(sim);
  },
};
