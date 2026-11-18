import balance from "../balance.json" with { type: "json" };
import { distance, hyp } from "../data.js";
import { difficultyRules } from "../difficulty.js";

// Bosses (docs/aaa/BOSSES.md). A boss is an ordinary unit whose definition names an entry of
// balance.json `bosses` (`boss: "iron-vanguard"`); that entry is the whole behaviour, so a later
// boss is mostly data. Mixed into Simulation (see simulation.js); everything it keeps is on the
// boss (`e.bs`) and in `this.dangerZones`, both created only once a boss acts, so every other
// match saves and hashes exactly as before.
//
// The cycle: dormant (until it is hurt or approached) -> tracking (walks to the biggest
// group of enemies within its leash and fires its light gun; waits `pause`) -> warning (a danger
// zone is marked on the ground; nothing is hurt) -> attacking (rounds land in the zone) ->
// exposed (its core is open: it takes `taken.exposed` damage) -> tracking. Health stages (2/3,
// 1/3) shorten the pause; warnings never change, by stage or by difficulty.
//
// Danger zones (circle, cone, line) are known to the rules: units of a hostile team that stand
// in one, unless they are on Hold, step out by themselves (stepDangerZones, stepEvade).
//
// Events for the client: bossWake, bossWarn (with the zone), bossAttack, shot (one per round,
// `boss` set), bossExposed, bossArmored, bossStage, bossDefeated.
export const BOSSES = balance.bosses || {};
// The warning rule: a unit reacts in REACT seconds and walks out at ESCAPE_SPEED (the slowest
// common unit, a Battle tank); EVADE_MARGIN is how far outside the edge it stops.
export const REACT = 1, ESCAPE_SPEED = 2.5, EVADE_MARGIN = 0.5;
// The boss looks for its target four times a second.
const RETARGET = 5;
const DEG = Math.PI / 180;

// How far a unit may have to walk to leave a zone: the radius, the cone's half-width at its far
// end, or half a line's width.
export function escapeDistance(zone) {
  if (zone.shape === "circle") return zone.radius;
  if (zone.shape === "cone") return zone.length * Math.tan((zone.half ?? 15) * DEG);
  if (zone.shape === "line") return zone.width / 2;
  return 0;
}
// Seconds between the mark and the first round: never shorter than the walk out.
export const warningSeconds = (attack) => Math.max(attack.warning || 0, REACT + (escapeDistance(attack.zone) + EVADE_MARGIN) / ESCAPE_SPEED);

// A point in a cone or line zone's own frame: u along its heading from its origin, v across it.
function local(zone, p) {
  const s = Math.sin(zone.angle), c = Math.cos(zone.angle), dx = p.x - zone.x, dz = p.z - zone.z;
  return { u: dx * s + dz * c, v: dx * c - dz * s };
}
const halfWidth = (zone, u) => (zone.shape === "cone" ? Math.max(0, u) * Math.tan(zone.half) : zone.width / 2);
// Whether p is in the zone, its edge pushed out by `pad`.
export function inZone(zone, p, pad = 0) {
  if (zone.shape === "circle") return hyp(p.x - zone.x, p.z - zone.z) <= zone.radius + pad;
  const { u, v } = local(zone, p);
  return u >= -pad && u <= zone.length + pad && Math.abs(v) <= halfWidth(zone, u) + pad;
}
// Spots `clear` metres outside the zone for a unit at p, nearest first (ties keep their order).
export function zoneExits(zone, p, clear) {
  if (zone.shape === "circle") {
    const d = hyp(p.x - zone.x, p.z - zone.z), base = d > 0.01 ? Math.atan2(p.z - zone.z, p.x - zone.x) : Math.PI / 2 - (zone.angle || 0), r = zone.radius + clear, out = [];
    for (let k = 0; k < 16; k++) {
      const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
      out.push({ x: zone.x + Math.cos(a) * r, z: zone.z + Math.sin(a) * r });
    }
    return out;
  }
  const { u, v } = local(zone, p), s = Math.sin(zone.angle), c = Math.cos(zone.angle), side = v >= 0 ? 1 : -1;
  const at = (uu, vv) => ({ x: zone.x + uu * s + vv * c, z: zone.z + uu * c - vv * s });
  const w = halfWidth(zone, u) + clear;
  return [at(u, side * w), at(u, -side * w), at(zone.length + clear, v), at(-clear, v)]
    .map((q, i) => ({ q, i, d: hyp(q.x - p.x, q.z - p.z) })).sort((a, b) => a.d - b.d || a.i - b.i).map((o) => o.q);
}

export const bosses = {
  livingBoss() {
    return this.entities.find((e) => e.boss && e.hp > 0) || null;
  },
  // Damage a boss takes: more while its core is open.
  bossTaken(e) {
    const spec = BOSSES[e.boss];
    return !spec ? 1 : e.bs?.phase === "exposed" ? spec.taken.exposed : spec.taken.armored;
  },
  // A boss's own difficulty table is the final factor against the player (Story = half), so the
  // general mission factor applyDamage adds for team 0 is divided out here.
  bossScale(spec, t) {
    const general = this.mission && t.team === 0 ? difficultyRules(this).damage : 1;
    return (spec.damage?.[this.difficulty] ?? 1) / general;
  },
  bossPause(spec, stage) {
    const pause = spec.pause[Math.min(stage, spec.pause.length) - 1];
    return pause * (spec.cadence?.[this.difficulty] ?? 1);
  },
  bossEvent(e, type, extra = null) {
    this.events.push({ type, id: e.id, boss: e.boss, name: e.name, x: e.x, z: e.z, team: e.team, ...extra });
  },
  bossZone(e) {
    return this.dangerZones?.find((z) => z.id === e.bs?.zone) || null;
  },
  stepBoss(e, dt) {
    const spec = BOSSES[e.boss];
    if (!spec) return;
    const bs = (e.bs ??= { phase: "dormant", stage: 1, cycle: 0, post: { x: e.x, z: e.z } });
    const stage = 1 + (spec.stages || []).filter((f) => e.hp <= e.maxHp * f).length;
    if (stage > bs.stage) { bs.stage = stage; this.bossEvent(e, "bossStage", { stage }); }
    if (bs.phase === "dormant") {
      if (!this.bossWakes(e, spec)) return;
      bs.phase = "tracking";
      bs.next = this.time + (spec.first ?? 3);
      this.bossEvent(e, "bossWake");
      return;
    }
    const attack = spec.attacks[bs.cycle % spec.attacks.length];
    if (bs.phase === "tracking") {
      if (bs.aim === undefined || this.ticks % RETARGET === 0) bs.aim = this.bossAim(e, spec, attack);
      const aim = bs.aim;
      this.bossMove(e, spec, attack, aim, dt);
      this.bossGun(e, dt);
      if (this.time >= bs.next - 1e-9 && aim && hyp(aim.x - e.x, aim.z - e.z) <= attack.range) this.bossWarn(e, attack, aim);
      return;
    }
    const zone = this.bossZone(e);
    // The light gun keeps firing while the big guns aim (the warning), never while they fire.
    if (bs.phase === "warning") this.bossGun(e, dt);
    e.attacking = true;
    if (zone) e.angle = zone.shape === "circle" ? Math.atan2(zone.x - e.x, zone.z - e.z) : zone.angle;
    if (bs.phase === "warning" && this.time >= bs.until - 1e-9) {
      bs.phase = "attacking";
      bs.round = 0;
      bs.from = this.time;
      this.bossEvent(e, "bossAttack", { zone: bs.zone });
    }
    if (bs.phase === "attacking") {
      const gap = attack.over / attack.rounds;
      while (bs.round < attack.rounds && this.time >= bs.from + bs.round * gap - 1e-9) this.bossRound(e, spec, attack, zone, bs.round++);
      if (bs.round < attack.rounds) return;
      this.clearZones(e.id);
      bs.zone = null;
      bs.phase = "exposed";
      bs.until = this.time + spec.exposed;
      this.bossEvent(e, "bossExposed", { seconds: spec.exposed });
    } else if (bs.phase === "exposed" && this.time >= bs.until - 1e-9) {
      e.attacking = false;
      bs.phase = "tracking";
      bs.cycle++;
      bs.next = this.time + this.bossPause(spec, bs.stage);
      delete bs.aim;
      this.bossEvent(e, "bossArmored");
    }
  },
  // The light gun (the definition's own weapon): steady, light pressure on the nearest enemy in reach.
  bossGun(e, dt) {
    if (!(e.damage > 0)) return;
    const t = this.enemy(e, e.range, true);
    if (t) this.fight(e, t, dt, false);
  },
  // A dormant boss wakes when it is hurt or when an enemy walks within `wake` metres (close enough
  // that the player sees it wake: troops see further than that). Being seen from afar does not wake it.
  bossWakes(e, spec) {
    if (e.hp < e.maxHp || e.shield < e.maxShield) return true;
    for (const t of this.entities)
      if (t.hp > 0 && t.kind === "unit" && !t.flying && this.hostile(e.team, t.team) && distance(e, t) <= spec.wake) return true;
    return false;
  },
  // The biggest group of enemy ground units it can see within `aggro` (the most units inside one
  // zone radius of a unit; ties go to the nearer group): the middle of that group. With no units
  // in reach, the nearest enemy building.
  bossAim(e, spec, attack) {
    const r = attack.cluster ?? attack.zone.radius ?? 4, units = [];
    for (const t of this.entities)
      if (t.hp > 0 && t.kind === "unit" && !t.flying && this.hostile(e.team, t.team) && distance(e, t) <= spec.aggro && this.isVisible(t, e.team)) units.push(t);
    if (units.length) {
      let best = null, most = 0, near = Infinity;
      for (const c of units) {
        let n = 0;
        for (const o of units) if (distance(c, o) <= r) n++;
        const d = distance(e, c);
        if (n > most || (n === most && d < near)) { best = c; most = n; near = d; }
      }
      let x = 0, z = 0;
      for (const o of units) if (distance(best, o) <= r) { x += o.x; z += o.z; }
      return { x: x / most, z: z / most, count: most };
    }
    let building = null, near = Infinity;
    for (const t of this.entities) {
      if (t.hp <= 0 || t.kind !== "building" || !this.hostile(e.team, t.team) || !this.isVisible(t, e.team)) continue;
      const d = distance(e, t) - t.radius;
      if (d <= spec.aggro && d < near) { building = t; near = d; }
    }
    return building ? { x: building.x, z: building.z, count: 0, building: building.id } : null;
  },
  // Walks to within reach of its target, never further than `leash` from where it stood at the
  // start; with nothing to fight it walks back.
  bossMove(e, spec, attack, aim, dt) {
    const post = e.bs.post;
    let goal = null;
    if (aim) {
      const d = hyp(aim.x - e.x, aim.z - e.z), want = Math.max(4, Math.min(attack.range, e.range) - 2);
      if (d > want) goal = { x: aim.x + ((e.x - aim.x) / d) * want, z: aim.z + ((e.z - aim.z) / d) * want };
    } else if (distance(e, post) > 3) goal = post;
    if (!goal) return;
    const off = hyp(goal.x - post.x, goal.z - post.z);
    if (off > spec.leash) goal = { x: post.x + ((goal.x - post.x) / off) * spec.leash, z: post.z + ((goal.z - post.z) / off) * spec.leash };
    if (distance(e, goal) > 1.5) this.move(e, goal, dt, 1.5);
  },
  // Marks the zone of the next attack on the target and starts the warning.
  bossWarn(e, attack, aim) {
    const z = attack.zone, angle = Math.atan2(aim.x - e.x, aim.z - e.z), bs = e.bs;
    const zone = { id: e.id * 1000 + (bs.cycle % 1000), boss: e.id, team: e.team, attack: attack.id, shape: z.shape, angle, from: this.time, at: this.time + warningSeconds(attack) };
    if (z.shape === "circle") Object.assign(zone, { x: aim.x, z: aim.z, radius: z.radius });
    else Object.assign(zone, { x: e.x, z: e.z, length: z.length, ...(z.shape === "cone" ? { half: (z.half ?? 15) * DEG } : { width: z.width }) });
    zone.until = zone.at + attack.over;
    (this.dangerZones ||= []).push(zone);
    bs.zone = zone.id;
    bs.phase = "warning";
    bs.until = zone.at;
    e.angle = angle;
    e.attacking = true;
    this.bossEvent(e, "bossWarn", { zone: { ...zone }, seconds: zone.at - zone.from, attack: attack.id });
  },
  // One round: everything hostile in the zone is hit (units by their centre, buildings by their
  // footprint); flyers are over it. The shot event draws a shell from one of the guns.
  bossRound(e, spec, attack, zone, k) {
    if (!zone) return;
    for (const t of this.entities) {
      if (t.hp <= 0 || t.flying || !this.hostile(e.team, t.team)) continue;
      const building = t.kind === "building";
      if ((t.kind !== "unit" && !building) || !inZone(zone, t, building ? t.radius : 0)) continue;
      this.applyDamage(t, attack.damage * (building ? attack.building ?? 1 : 1) * this.bossScale(spec, t), e.team, e.id);
    }
    const m = spec.muzzles?.[k % spec.muzzles.length] || [0, 2, 1], c = Math.cos(e.angle), s = Math.sin(e.angle);
    let tx = zone.x, tz = zone.z;
    if (zone.shape === "circle") {
      // A fixed spiral of landing spots across the circle.
      const a = k * 2.39996 + zone.angle, r = zone.radius * 0.85 * Math.sqrt((k + 0.5) / attack.rounds);
      tx += Math.cos(a) * r; tz += Math.sin(a) * r;
    } else {
      const u = (zone.length * (k + 1)) / (attack.rounds + 1), v = (k % 2 ? 1 : -1) * Math.min(1.2, halfWidth(zone, u) * 0.5);
      tx += u * Math.sin(zone.angle) + v * Math.cos(zone.angle); tz += u * Math.cos(zone.angle) - v * Math.sin(zone.angle);
    }
    this.events.push({ type: "shot", weapon: attack.weapon || "tank", source: e.id, target: null, x: e.x + m[0] * c + m[2] * s, z: e.z - m[0] * s + m[2] * c, tx, tz, team: e.team, heavy: true, sAir: m[1] - 0.4, boss: e.id, muzzle: k % 4 });
  },
  clearZones(bossId) {
    if (this.dangerZones) this.dangerZones = this.dangerZones.filter((z) => z.boss !== bossId);
  },
  // Called by applyDamage when a boss falls: its marks go with it.
  bossDown(e) {
    this.clearZones(e.id);
    if (e.bs) e.bs.phase = "defeated";
    this.bossEvent(e, "bossDefeated");
  },
  // Before the entities act (Simulation.tick): units in a hostile danger zone, unless on Hold,
  // get a spot just outside it; units out of every zone go back to their orders.
  stepDangerZones() {
    const zones = this.dangerZones;
    for (const u of this.entities) {
      if (u.hp <= 0 || u.kind !== "unit" || u.flying || u.boss) continue;
      let zone = null;
      if (u.stance !== "hold" && u.complete !== false)
        for (const z of zones) if (this.hostile(z.team, u.team) && inZone(z, u, u.radius + EVADE_MARGIN)) { zone = z; break; }
      if (!zone) { if (u.evade) this.endEvade(u); continue; }
      if (u.evade?.zone === zone.id) continue;
      this.startEvade(u, zone, 0);
    }
  },
  startEvade(u, zone, from) {
    const exits = zoneExits(zone, u, u.radius + EVADE_MARGIN + 0.3);
    for (let i = from; i < exits.length; i++) {
      const p = exits[i];
      if (!this.nav.canStand(p.x, p.z, u.radius) || !this.nav.canTraverse(u, p, u.radius)) continue;
      u.evade = { zone: zone.id, x: p.x, z: p.z, n: i };
      // A unit standing guard keeps its new spot as its post; one with orders picks them up after.
      if (!u.orders.length && u.post) u.post = { x: p.x, z: p.z };
      this.resetWorkerRoute(u);
      return;
    }
    if (u.evade) this.endEvade(u);
  },
  endEvade(u) {
    delete u.evade;
    this.resetWorkerRoute(u);
  },
  // A unit stepping out of a zone walks straight to its spot and does nothing else meanwhile.
  // Returns false once it is there (or blocked: it tries the next spot on the next tick).
  stepEvade(u, dt) {
    const ev = u.evade, dx = ev.x - u.x, dz = ev.z - u.z, d = hyp(dx, dz);
    if (d < 0.15) return false;
    const step = Math.min(d, this.moveSpeed(u) * dt), next = { x: u.x + (dx / d) * step, z: u.z + (dz / d) * step };
    if (!this.nav.canTraverse(u, next, u.radius)) {
      const zone = this.dangerZones?.find((z) => z.id === ev.zone);
      if (zone) this.startEvade(u, zone, ev.n + 1); else this.endEvade(u);
      return false;
    }
    u.x = next.x;
    u.z = next.z;
    u.angle = Math.atan2(dx, dz);
    u.moving = true;
    return true;
  },
};
