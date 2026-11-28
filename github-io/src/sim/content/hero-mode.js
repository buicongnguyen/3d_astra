// H3a/H3d Hero mode (HERO-COINS-PLAN.md, owner 2026-11-27): the player fights as one hero (a campaign hero or
// Skywing) while the steward (sim/steward.js) runs the base. The rules part; the camera, controls and HUD are
// src/hero-mode.js, the drawn projectiles and warning rings src/hero-mode-view.js.
//
// Commands (logged and replayed like any other, so a match in Hero mode replays tick for tick):
//   { type: "heroMode", team, id, on, scale, help }  enter (on) or leave; `scale` is the battle-time scale (0.4 /
//                                               0.5 / 0.75 / 1) the page runs the clock at; LAN matches always use 1;
//                                               `help` (H7 Settings > Hero > Dodge help, only when on): rifle rounds
//                                               at the hero fly at SHOTS.helped and the dodge is ready DODGE.helped
//   { type: "heroDrive", team, dx, dz }         the move stick (world x/z, length <= 1; 0, 0 stops)
//   { type: "heroFire", team, target, hold }    shoot `target` (hold: keep firing until a new heroFire), null stops
//   { type: "heroDodge", team, dx, dz }         the dodge dash (Skywing: a barrel roll) toward dx, dz
//   H8 fight feel (sim/hero-feel.js): heroFire may carry `head` (the page aimed at the head) or `barrel` (the index of
//   an explosive hazard, sim/hazards.js, in place of a target);
//   { type: "heroReload", team }               top the magazine up now (it reloads on its own when empty)
//   { type: "heroCrouch", team, on }           crouch on (true), off (false) or "auto" (phones): crouched while still
//                                               beside cover, dodgeable rounds and splash do half
//
// Battle time (H3d): the page slows the clock to `scale` (app/frame.js); the rules keep the hero quick in real
// time: it moves at HERO_TIME.real of its own speed in real time (never slower than its own speed in game time)
// and reloads at its own rate in real time. Both come from `scale` carried in the state, so they are deterministic.
//
// Dodging (H3d): a shot from an enemy at a driven hero is a real projectile (SHOTS m/s of game time, aimed with a
// part lead), checked on arrival: a miss when the hero has left the hit radius; splash still hurts near the impact.
// Every other shot stays an instant hit, so RTS balance is unchanged. The dash gives DODGE.seconds without damage.
//
// Cover (H6, sim/content/cover.js): entering Hero mode places the match's cover pieces once; a ground shot at the
// hero whose line meets a piece stops there (no hit, no splash). Lobbed shells (LOBBED) and shots to or from the
// air pass over.
//
// State: `sim.heroMode = { teams: { [team]: { id, scale, help? } }, shots: [...], n }`, made on the first entry and
// removed when no team is in Hero mode and no projectile is in flight; entity keys `driven` (the scale), `drive`,
// `trigger`, `vel`, `dash`, `dodgeUntil`, `dodgeReady`, `dodgeHelp` exist only on a driven hero. A match that never uses it
// saves and hashes exactly as before.
import { distance, hyp } from "../../data.js";
import { LOBBED } from "../cover.js";
import { MAG, HEAD, CROUCH, SCOPE_REACH, hasMagazine, magSize, reloadSeconds, headable, headBonus, coverDistance, nextSpread } from "../hero-feel.js";
import { blowHazard } from "../hazards.js";
import { SIGHT } from "./skywing.js";

export const HERO_TIME = Object.freeze({ scales: Object.freeze([0.4, 0.5, 0.75, 1]), scale: 0.5, real: 0.8, ease: 0.3 });
// Real seconds (converted to game time with the scale): no damage for `seconds`, `cooldown` between dodges,
// `dash` metres covered.
// `helped`: the cooldown with Dodge help on (H7).
export const DODGE = Object.freeze({ seconds: 0.3, cooldown: 4, helped: 3, dash: 3.6 });
// Projectile speeds in m/s of game time (rifle rounds, rockets, shells), the extra hit radius around the hero,
// and the share of the hero's motion the shooter leads by. `helped`: rifle rounds with Dodge help on (H7).
export const SHOTS = Object.freeze({ fast: 28, helped: 20, rocket: 22, shell: 18, hit: 0.6, lead: 0.6, melee: 2.6 });
// Why a driven hero's trigger cannot fire (owner 2026-11-28: the reason shows as a small tag by the reticle). The sim says
// it with a `heroBlocked` event ({ id, team, reason }) on every BLOCKED_EVERY-th tick while the trigger waits (events are
// not saved; the tick count makes it deterministic, a few a second at most). The page adds its own reasons from its pick
// ("No target", "Hold to lock"), src/hero-mode.js.
export const BLOCKED = Object.freeze(["No target", "Out of range", "Reloading", "Hold to lock", "Blocked", "Switching weapon", "Not visible", "Stunned"]);
export const BLOCKED_EVERY = 6;
const HEAVY = new Set(["breaker", "tank", "antitank", "artillery", "mortar", "rocket", "lancer", "tower"]);

export const isDriven = (e) => !!e && e.driven !== undefined;
// H9: a Tank or Breaker Skywing has boarded (sim/content/skywing-board.js `rider`) is driven like a hero.
const heroic = (e) => !!e && (!!e.assist || (typeof e.hero === "string" && e.hero.length > 0) || e.rider !== undefined);
// H9: a driven vehicle (its hull turns with the move, its turret follows the aim: the page draws it).
const hull = (e) => e.rider !== undefined;
const scaleOf = (sim, scale) => (sim.lan ? 1 : HERO_TIME.scales.includes(scale) ? scale : HERO_TIME.scale);
// The hero's move factor in game time: HERO_TIME.real of its speed in real time, never below its own speed.
export const heroBoost = (scale) => Math.max(1, HERO_TIME.real / scale);
// The projectile speed for a shooter's weapon (`help`: Dodge help slows the rifle rounds).
export function shotSpeed(e, help = false) {
  const w = e.shot || e.type;
  if (w === "antitank" || w === "rocket" || w === "lancer") return SHOTS.rocket;
  return HEAVY.has(w) || e.splash_radius ? SHOTS.shell : help ? SHOTS.helped : SHOTS.fast;
}

// The commands the page sends to enter and leave (src/hero-mode.js): Hero mode and the steward together, so the
// computer runs the base while the player fights, and hands it back with every queue and order kept.
export const enterCommands = (team, id, scale = HERO_TIME.scale, help = false) => [{ team, type: "heroMode", id, on: true, scale, ...(help ? { help: true } : null) }, { team, type: "steward", on: true }];
export const leaveCommands = (team) => [{ team, type: "heroMode", on: false }, { team, type: "steward", on: false }];

function clean(sim) {
  const h = sim.heroMode;
  if (h && !Object.keys(h.teams).length && !h.shots.length) delete sim.heroMode;
}
export function release(e) {
  for (const key of ["driven", "drive", "trigger", "vel", "dash", "dodgeUntil", "dodgeReady", "dodgeHelp", "mag", "reloadAt", "spread", "crouch", "crouched"]) delete e[key];
}
// H8: a scoped Sniper (Skywing on foot, still: e.scope) reaches SCOPE_REACH m at a target inside the scope's cone.
function scoped(e, t) {
  if (!e.scope || e.weapon !== "sniper") return false;
  const b = Math.atan2(t.x - e.x, t.z - e.z) - (e.angle || 0);
  return Math.abs(Math.atan2(Math.sin(b), Math.cos(b))) <= (SIGHT.cone / 2) * (Math.PI / 180);
}

export const heroMode = {
  id: "heroMode",
  order: 46, // after Skywing (45): a dive has moved the hero before its projectiles are checked
  mixin: {
    // Enters (on) or leaves Hero mode for `team` with hero `id`. False when it cannot.
    setHeroMode(team, on, id, scale, help = false) {
      const h = this.heroMode, now = h?.teams[team];
      if (!on) {
        if (!now) return true;
        // H9: Skywing steps out of the vehicle it drives first (sim/content/skywing-board.js).
        if (this.skywing?.aboard === now.id) this.skywingLeave?.(team);
        const e = this.get(now.id);
        // The hero stays where it was left: no old order or post walks it back.
        if (e) { release(e); e.orders = []; e.post = { x: e.x, z: e.z }; }
        delete h.teams[team];
        clean(this);
        return true;
      }
      const e = this.get(id);
      if (!e || e.team !== team || e.hp <= 0 || e.kind !== "unit" || !heroic(e)) return false;
      if (now && now.id !== id) { if (this.skywing?.aboard === now.id) this.skywingLeave?.(team); const old = this.get(now.id); if (old) release(old); }
      const k = scaleOf(this, scale);
      (this.heroMode ||= { teams: {}, shots: [], n: 0 }).teams[team] = { id, scale: k, ...(help ? { help: true } : null) };
      e.driven = k;
      if (help) e.dodgeHelp = true; else delete e.dodgeHelp;
      // H6: the match's cover pieces, placed the first time a hero is driven.
      this.enableCover?.();
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
      // H8: the spread (moving or dashing widens it, standing tightens it) and the crouch beside cover, in real time.
      const real = dt / k, moving = e.x !== x0 || e.z !== z0 || !!e.dash;
      e.spread = nextSpread(e.spread, moving, real);
      const crouched = !!e.crouch && !e.flying && !e.skyland && !moving && e.spread <= CROUCH.still && coverDistance(this.cover, e.x, e.z) <= CROUCH.near;
      if (crouched !== !!e.crouched) { if (crouched) e.crouched = true; else delete e.crouched; this.events.push({ type: "heroCrouched", id: e.id, on: crouched }); }
      // An explosive hazard under the reticle (H8): fired at like a target, set off by the hit.
      if (e.trigger?.barrel !== undefined) { this.heroBarrel(e); return true; }
      // H9: a driven vehicle's shot at a ground point (the Breaker's lob, a Tank's shell where nothing stands).
      if (e.trigger?.point) { this.heroPointShot(e); if (hull(e) && e.moving) e.angle = Math.atan2(e.vel.x, e.vel.z); return true; }
      const t = e.trigger ? this.get(e.trigger.target) : null;
      if (e.trigger && (!t || t.hp <= 0 || this.time > e.trigger.until)) delete e.trigger;
      else if (t) {
        if (!hull(e)) e.angle = Math.atan2(t.x - e.x, t.z - e.z);
        // H9: a Breaker shells buildings from its siege range (as combat.js fight does).
        let range = (t.kind !== "unit" && e.siege_range ? e.siege_range : e.range) + this.heightRange(e, t) + t.radius + 0.00001;
        if (scoped(e, t)) range = Math.max(range, SCOPE_REACH + t.radius + 0.00001);
        const clear = e.flying || t.flying || this.nav.clearLine(e, t, t.id);
        // The first rule that stops the shot, for the reticle's tag.
        const why = distance(e, t) > range ? "Out of range" : !this.isVisible(t, e.team) ? "Not visible" : !clear ? "Blocked"
          : !this.attackable(e.team, t) || (t.flying && !this.canHit(e, t)) ? "No target" : null;
        if (why) this.heroBlocked(e, why);
        else {
          e.attacking = true;
          if (e.cooldown > 0 || (e.fx && !this.canAct(e, "fire"))) this.heroWaiting(e);
          if (e.cooldown <= 0 && !(e.fx && !this.canAct(e, "fire"))) {
            const head = !!e.trigger.head && !hull(e) && hasMagazine(e) && headable(t) && (e.spread || 0) <= HEAD.spread;
            const before = t.hp + (t.shield || 0), d = distance(e, t), base = e.damage;
            if (head) e.damage = base * headBonus(e);
            this.hit(e, t);
            e.damage = base;
            this.heroAfterShot(e, t, head, before, d);
            if (e.trigger && !e.trigger.hold) delete e.trigger;
          }
        }
      } else if (e.moving) e.angle = Math.atan2(e.vel.x, e.vel.z);
      if (t && hull(e) && e.moving) e.angle = Math.atan2(e.vel.x, e.vel.z);
      return true;
    },
    // The reticle's tag: why the trigger waits (BLOCKED), as an event every BLOCKED_EVERY-th tick.
    heroBlocked(e, reason) {
      if (this.ticks % BLOCKED_EVERY === 0) this.events.push({ type: "heroBlocked", id: e.id, team: e.team, reason });
    },
    // In reach and in sight but not ready: a weapon switch, a magazine reload or a status (a stun) that keeps it silent.
    // The plain gap between two shots says nothing.
    heroWaiting(e) {
      if (e.fx && !this.canAct(e, "fire")) this.heroBlocked(e, "Stunned");
      else if (e.weaponTo) this.heroBlocked(e, "Switching weapon");
      else if (this.time < (e.reloadAt ?? -Infinity) - 1e-9) this.heroBlocked(e, "Reloading");
    },
    // H9: a driven vehicle's shot at a ground point (e.trigger.point): in its reach (the Breaker's siege range), the
    // round lands at once, as every RTS shot does: the weapon's damage to the enemy standing on the point (a body
    // within 0.3 m of it) and its splash share to every other enemy on the ground within its splash radius.
    heroPointShot(e) {
      const p = e.trigger.point;
      if (this.time > e.trigger.until) { delete e.trigger; return; }
      const d = distance(e, p);
      if (d > (e.siege_range || e.range || 0) + 0.05) { this.heroBlocked(e, "Out of range"); return; }
      e.attacking = true;
      if (e.cooldown > 0 || (e.fx && !this.canAct(e, "fire"))) { this.heroWaiting(e); return; }
      const foe = (t) => t.hp > 0 && !t.flying && (t.kind === "unit" || t.kind === "building" || t.kind === "wall") && this.hostile(e.team, t.team);
      let direct = null, best = 0.3;
      for (const t of this.entities) {
        if (!foe(t)) continue;
        const edge = hyp(t.x - p.x, t.z - p.z) - (t.radius || 0.6);
        if (edge <= best + 1e-9) { direct = t; best = edge; }
      }
      const before = direct ? direct.hp + (direct.shield || 0) : 0;
      if (direct) this.applyDamage(direct, this.shotValue(e, direct, true), e.team, e.id);
      if (e.splash_radius) for (const t of [...this.entities]) {
        if (t === direct || !foe(t)) continue;
        if (hyp(t.x - p.x, t.z - p.z) - (t.kind === "unit" ? 0 : t.radius || 0) >= e.splash_radius) continue;
        this.applyDamage(t, this.shotValue(e, t, false, e.splash_damage), e.team, e.id);
      }
      if (this.factionFor(e.team).trait) e.shotAt = this.time;
      this.events.push({ type: "shot", weapon: e.shot || e.type, unit: e.type, source: e.id, target: direct?.id ?? null, x: e.x, z: e.z, tx: p.x, tz: p.z, team: e.team, heavy: true, point: true });
      e.cooldown = e.interval * (e.fx ? this.statusFactor(e, "reload") : 1);
      delete e.trigger;
      this.heroAfterShot(e, direct, false, before, d);
    },
    // H8: after each shot of the driven hero: the magazine (an empty one reloads on its own), the hit marker and kill
    // notice (events only: the page draws them), and a challenge's own count (sim/content/hero-challenges.js).
    heroAfterShot(e, t, head, before, d) {
      if (t) {
        const kill = t.hp <= 0, dealt = Math.max(0, before - Math.max(0, t.hp) - Math.max(0, t.shield || 0));
        this.events.push({ type: "heroHit", id: e.id, team: e.team, target: t.id, unit: t.type, name: t.name || null, x: t.x, z: t.z, air: !!t.flying, dmg: Math.round(dealt), head: !!head, kill, d: Math.round(d * 10) / 10 });
        if (this.challenge) this.challengeShot?.(e, t, d, kill);
      }
      if (!hasMagazine(e)) return;
      const size = magSize(e), left = (e.mag ?? size) - 1;
      if (left <= 0) {
        e.cooldown = e.cooldown * MAG.fire + reloadSeconds(e, size);
        e.mag = size;
        e.reloadAt = this.time + e.cooldown * (e.driven || 1);
        this.events.push({ type: "heroReload", id: e.id, auto: true, seconds: e.cooldown });
      } else {
        e.cooldown *= MAG.fire;
        e.mag = left;
      }
    },
    // H8: the driven hero tops its magazine up. False when it is full, a blade, or reloading already.
    heroReload(e) {
      if (!isDriven(e) || !hasMagazine(e) || e.hp <= 0) return false;
      const size = magSize(e), missing = size - (e.mag ?? size);
      if (missing <= 0 || this.time < (e.reloadAt ?? -Infinity) - 1e-9) return false;
      e.cooldown = Math.max(e.cooldown, reloadSeconds(e, missing));
      e.mag = size;
      e.reloadAt = this.time + e.cooldown * (e.driven || 1);
      this.events.push({ type: "heroReload", id: e.id, auto: false, seconds: e.cooldown });
      return true;
    },
    // H8: a shot at an explosive hazard (e.trigger.barrel): in reach, seen and a clear line, then the blast.
    heroBarrel(e) {
      const i = e.trigger.barrel, h = this.hazards?.[i];
      if (!h || !h[2] || this.time > e.trigger.until) { delete e.trigger; return; }
      const at = { x: h[0], z: h[1] };
      e.angle = Math.atan2(at.x - e.x, at.z - e.z);
      let range = e.range + 0.6;
      if (scoped(e, at)) range = Math.max(range, SCOPE_REACH);
      const seen = !!this.visible[e.team]?.[this.terrain.cellIndex(at.x, at.z)];
      if (distance(e, at) > range) { this.heroBlocked(e, "Out of range"); return; }
      if (!seen) { this.heroBlocked(e, "Not visible"); return; }
      if (!(e.flying || this.nav.clearLine(e, at))) { this.heroBlocked(e, "Blocked"); return; }
      e.attacking = true;
      if (e.cooldown > 0 || (e.fx && !this.canAct(e, "fire"))) { this.heroWaiting(e); return; }
      this.events.push({ ...(e.flying ? { sAir: e.fly } : null), type: "shot", weapon: e.shot || e.type, unit: e.type, source: e.id, target: null, x: e.x, z: e.z, tx: at.x, tz: at.z, team: e.team, heavy: (e.shot || e.type) === "antitank", barrel: i });
      e.cooldown = e.interval * (e.fx ? this.statusFactor(e, "reload") : 1);
      delete e.trigger;
      blowHazard(this, i, e);
      if (this.challenge) this.challengeLoud?.(e);
      this.heroAfterShot(e, null, false, 0, distance(e, at));
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
      const speed = shotSpeed(e, !!target.dodgeHelp), d = distance(e, target);
      let travel = Math.max(0.12, d / speed);
      const v = target.vel || { x: 0, z: 0 };
      let x = target.x + v.x * travel * SHOTS.lead, z = target.z + v.z * travel * SHOTS.lead;
      // H6: a ground shot whose line meets a cover piece stops at it (sooner, with no hit and no splash).
      const block = !e.flying && !target.flying && !LOBBED.has(e.shot || e.type) ? this.coverShot?.(e, { x, z }) : null;
      if (block) { x = block.x; z = block.z; travel = Math.max(0.05, travel * block.t); }
      const dmg = this.shotValue(e, target, true);
      const splash = !target.flying && e.splash_radius ? { r: e.splash_radius, k: e.splash_damage } : null;
      const heavy = !!splash || HEAVY.has(e.shot || e.type);
      const n = ++h.n;
      h.shots.push({ n, by: e.id, team: e.team, target: target.id, sx: e.x, sz: e.z, x, z, t0: this.time, at: this.time + travel, dmg, ...(splash ? { splash } : null), ...(heavy ? { heavy: true } : null), weapon: e.shot || e.type, ...(target.flying ? { air: true } : null), ...(block ? { blocked: true } : null) });
      this.events.push({
        ...(e.flying ? { sAir: e.fly } : e.gun_height ? { sAir: e.gun_height - 0.4 } : null),
        ...(target.flying ? { tAir: target.fly } : null),
        type: "shot", weapon: e.shot || e.type, unit: e.type, source: e.id, target: target.id,
        x: e.x, z: e.z, tx: x, tz: z, team: e.team, heavy: ["breaker", "tank", "antitank"].includes(e.shot || e.type), slow: travel, heroShot: n, ...(block ? { blocked: true } : null),
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
      e.dodgeReady = this.time + (e.dodgeHelp ? DODGE.helped : DODGE.cooldown) * k;
      this.events.push({ type: "heroDodge", id: e.id, team, x: e.x, z: e.z, roll: !!e.flying, seconds: DODGE.seconds * k });
      return true;
    },
  },
  commands: {
    heroMode: {
      allowed: (sim, c) => (c.on ? Number.isInteger(c.id) && (c.scale === undefined || HERO_TIME.scales.includes(c.scale)) && (c.help === undefined || typeof c.help === "boolean") : true),
      run: (sim, c) => sim.setHeroMode(c.team, !!c.on, c.id, c.scale, c.help === true),
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
      allowed: (sim, c) => !!sim.heroMode?.teams[c.team] && (c.target === null || Number.isInteger(c.target) || (c.target === undefined && Number.isInteger(c.barrel)) || (c.target === undefined && Number.isFinite(c.x) && Number.isFinite(c.z))) && (c.head === undefined || typeof c.head === "boolean"),
      run: (sim, c) => {
        const e = sim.get(sim.heroMode.teams[c.team].id);
        if (!isDriven(e)) return false;
        // H9: a driven vehicle fires at a ground point (one shot, waiting up to 1.5 real seconds for the reload).
        if (c.target === undefined && c.barrel === undefined) {
          if (!hull(e)) return false;
          e.trigger = { point: { x: c.x, z: c.z }, hold: false, until: sim.time + 1.5 * e.driven };
          return true;
        }
        // H8: an explosive hazard (sim/hazards.js): one shot, waiting up to 1.5 real seconds for the reload.
        if (c.target === undefined) {
          const h = sim.hazards?.[c.barrel];
          if (!h || !h[2]) return false;
          e.trigger = { barrel: c.barrel, hold: false, until: sim.time + 1.5 * e.driven };
          return true;
        }
        const t = c.target === null ? null : sim.get(c.target);
        if (!t || !sim.hostile(e.team, t.team)) { delete e.trigger; return c.target === null; }
        // A single shot waits up to 1.5 real seconds for the reload; a held trigger until it is let go.
        e.trigger = { target: t.id, hold: !!c.hold, until: c.hold ? Infinity : sim.time + 1.5 * e.driven, ...(c.head ? { head: true } : null) };
        return true;
      },
    },
    heroReload: {
      allowed: (sim, c) => !!sim.heroMode?.teams[c.team],
      run: (sim, c) => sim.heroReload(sim.get(sim.heroMode.teams[c.team].id)),
    },
    heroCrouch: {
      allowed: (sim, c) => !!sim.heroMode?.teams[c.team] && (c.on === true || c.on === false || c.on === "auto"),
      run: (sim, c) => {
        const e = sim.get(sim.heroMode.teams[c.team].id);
        if (!isDriven(e)) return false;
        if (c.on) e.crouch = c.on; else { delete e.crouch; delete e.crouched; }
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
      const hit = !s.blocked && !!hero && hero.hp > 0 && hyp(hero.x - s.x, hero.z - s.z) <= (hero.radius || 0.6) + SHOTS.hit;
      const dodged = hit && hero.dodgeUntil > sim.time;
      // H8: crouched behind cover, half (sim/hero-feel.js CROUCH).
      const cover = hero?.crouched ? CROUCH.taken : 1;
      if (hit) sim.applyDamage(hero, s.dmg * cover, s.team, s.by);
      // Splash near the impact: the shooter's own figures when it still stands, else the shot's damage.
      if (s.splash && !s.blocked) {
        for (const t of [...sim.entities]) {
          if (t.hp <= 0 || t.flying || (hit && t === hero) || !sim.hostile(s.team, t.team)) continue;
          if (hyp(t.x - s.x, t.z - s.z) - (t.kind === "unit" ? 0 : t.radius || 0) >= s.splash.r) continue;
          sim.applyDamage(t, (shooter ? sim.shotValue(shooter, t, false) : s.dmg) * s.splash.k * (t.crouched ? CROUCH.taken : 1), s.team, s.by);
        }
      }
      sim.events.push({ type: "heroShotLand", n: s.n, x: s.x, z: s.z, hit: hit && !dodged, dodged, heavy: !!s.heavy, team: s.team, target: s.target, ...(s.air ? { air: true } : null), ...(s.blocked ? { blocked: true } : null) });
    }
    clean(sim);
  },
};
