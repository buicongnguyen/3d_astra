import balance from "../balance.json" with { type: "json" };
import { DEFINITIONS as D, distance, hyp } from "../data.js";
import { difficultyRules } from "../difficulty.js";
import GARRISONS from "../defence/garrisons.json" with { type: "json" };

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
// `boss` set), bossExposed, bossArmored, bossStage, bossDefeated; boss engine II adds bossStomp,
// bossBroken and bossDrop.
//
// Boss engine II (AAA round 2, W1-E), every part optional data, so the Iron Vanguard plays exactly as
// before: `attacks[].count` and `spread` (N zones at once, each with its own warning), `target:
// "building"` (the best tower in reach), `stun` (buildings in the zone go silent), `strafe` (a
// sideways step between attacks), `break` (damage during a warning cancels the attack and opens the
// core), `drops` (units released at health stages) and route mode (a boss whose first order is a
// Defence route wakes at once, ignores its leash, walks the road with stepRoute and stops to attack).
// Everything new lives on `e.bs` and is created only when its data asks for it.
//
// Boss engine III (AAA round 3, R3-H), again optional data, so the Iron Vanguard and the Iron Sovereign
// play exactly as before: `phases` (keyed by a health stage: on reaching it the boss cancels its attack,
// stands still for `surge` seconds (phase "surge", event bossSurge) and then uses that phase's own
// `attacks`, starting with the first), `ward: { tag, taken }` (while any building of its own team with
// that tag stands, every hit on it is multiplied by `taken`; e.bs.warded counts them) and `march:
// { stop }` (a field boss that wakes at once and walks on the nearest hostile Command core, at its own
// speed, along a road found once at the wake (e.bs.road, e.bs.leg); it walks only while nothing is in
// its sights, its post going with it, and stops `stop` m short of the core).
export const BOSSES = balance.bosses || {};
// The warning rule: a unit reacts in REACT seconds and walks out at ESCAPE_SPEED (the slowest
// common unit, a Battle tank); EVADE_MARGIN is how far outside the edge it stops.
export const REACT = 1, ESCAPE_SPEED = 2.5, EVADE_MARGIN = 0.5;
// Units not on Hold step out by themselves, but only AUTO_REACT seconds after the mark appears:
// fast infantry still escapes, slow tanks near the centre get clipped, so moving them yourself
// is rewarded without being required (owner OK, 2026-11-19).
export const AUTO_REACT = 1.5;
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

// What a building is worth when a boss picks "the most expensive": a Defence tower's crew at its tier,
// plus the definition's own cost.
const worth = (t) => (t.crew ? GARRISONS.crews[t.crew]?.cost?.[(t.tier || 1) - 1] ?? 0 : 0) + (D[t.type]?.cost?.[0] || 0) + (D[t.type]?.cost?.[1] || 0);

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
    if (!spec) return 1;
    const taken = e.bs?.phase === "exposed" ? spec.taken.exposed : spec.taken.armored;
    // Boss engine III: relays of its own team shield it (spec.ward).
    return spec.ward && e.bs?.warded ? taken * spec.ward.taken : taken;
  },
  // The attacks in use: the current phase's own (spec.phases, from its surge on), else the boss's.
  bossAttacks(spec, bs) {
    return (bs.set && spec.phases?.[bs.set]?.attacks) || spec.attacks;
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
  // Every zone of the boss's current attack, the aimed one first (a spread has several).
  bossZones(e) {
    return this.dangerZones?.filter((z) => z.boss === e.id) || [];
  },
  stepBoss(e, dt) {
    const spec = BOSSES[e.boss];
    if (!spec) return;
    const bs = (e.bs ??= { phase: "dormant", stage: 1, cycle: 0, post: { x: e.x, z: e.z } });
    const stage = 1 + (spec.stages || []).filter((f) => e.hp <= e.maxHp * f).length;
    if (stage > bs.stage) {
      bs.stage = stage;
      this.bossEvent(e, "bossStage", { stage });
      if (spec.phases?.[stage] && bs.phase !== "dormant") this.bossSurge(e, spec, bs, stage);
    }
    if (spec.ward) bs.warded = this.entities.filter((t) => t.tag === spec.ward.tag && t.hp > 0 && t.team === e.team && t.kind === "building").length;
    if (spec.drops) this.bossDrops(e, spec, bs);
    // Route mode: a boss sent down a Defence road wakes at once and walks it (bossMarch).
    const route = e.orders[0]?.type === "route" ? e.orders[0] : null;
    if (bs.phase === "dormant") {
      if (!route && !spec.march && !this.bossWakes(e, spec)) return;
      bs.phase = "tracking";
      bs.next = this.time + (spec.first ?? 3);
      if (spec.march && !route) this.bossRoad(e, spec, bs);
      this.bossEvent(e, "bossWake");
      return;
    }
    // A phase change (spec.phases): the boss plants itself, then tracks again with the new attacks.
    if (bs.phase === "surge") {
      e.attacking = false;
      e.moving = false;
      if (this.time < bs.until - 1e-9) return;
      bs.phase = "tracking";
      bs.next = this.time + this.bossPause(spec, bs.stage);
      delete bs.aim;
      this.bossEvent(e, "bossArmored");
      return;
    }
    const attacks = this.bossAttacks(spec, bs), attack = attacks[bs.cycle % attacks.length];
    if (bs.phase === "tracking") {
      if (bs.aim === undefined || this.ticks % RETARGET === 0) bs.aim = this.bossAim(e, spec, attack);
      const aim = bs.aim;
      if (route) this.bossMarch(e, attack, aim, route, dt);
      else {
        this.bossMove(e, spec, attack, aim, dt);
        this.bossGun(e, dt);
      }
      if (this.time >= bs.next - 1e-9 && aim && hyp(aim.x - e.x, aim.z - e.z) <= attack.range) this.bossWarn(e, attack, aim);
      return;
    }
    const zone = this.bossZone(e);
    // The light gun keeps firing while the big guns aim (the warning), never while they fire.
    if (bs.phase === "warning") this.bossGun(e, dt);
    // Break the attack: enough damage during the warning cancels it and opens the core (a reward).
    if (bs.phase === "warning" && bs.mark !== undefined) this.bossBreak(e, spec, bs);
    e.attacking = true;
    if (zone) e.angle = zone.shape === "circle" ? Math.atan2(zone.x - e.x, zone.z - e.z) : zone.angle;
    if (bs.phase === "warning" && this.time >= bs.until - 1e-9) {
      delete bs.mark;
      bs.phase = "attacking";
      bs.round = 0;
      bs.from = this.time;
      this.bossEvent(e, "bossAttack", { zone: bs.zone });
    }
    if (bs.phase === "attacking") {
      const gap = attack.over / attack.rounds;
      while (bs.round < attack.rounds && this.time >= bs.from + bs.round * gap - 1e-9) this.bossRound(e, spec, attack, this.bossZones(e), bs.round++);
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
      if (spec.strafe && !route) this.bossStrafe(e, spec, bs);
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
    if (attack.target === "building") {
      const tower = this.bossBuildingAim(e, attack);
      if (tower) return tower;
    }
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
    const post = e.bs.post, side = e.bs.strafe;
    let goal = null;
    // A sideways step between attacks (spec.strafe): done on arrival, or when the next pause is over.
    if (side) {
      if (distance(e, side) <= 1.5 || this.time >= e.bs.next) delete e.bs.strafe;
      else goal = side;
    }
    if (goal) { /* strafing */ }
    else if (aim) {
      const d = hyp(aim.x - e.x, aim.z - e.z), want = Math.max(4, Math.min(attack.range, e.range) - 2);
      if (d > want) goal = { x: aim.x + ((e.x - aim.x) / d) * want, z: aim.z + ((e.z - aim.z) / d) * want };
    } else if (distance(e, post) > 3) goal = post;
    // March (spec.march): with nothing in its sights and the boss at its post, it walks on, post and all.
    else if (e.bs.road) { this.bossWalk(e, dt); return; }
    if (!goal) return;
    const off = hyp(goal.x - post.x, goal.z - post.z);
    if (off > spec.leash) goal = { x: post.x + ((goal.x - post.x) / off) * spec.leash, z: post.z + ((goal.z - post.z) / off) * spec.leash };
    if (distance(e, goal) > 1.5) this.move(e, goal, dt, 1.5);
  },
  // Marks the zone of the next attack on the target and starts the warning. An attack with `count`
  // zones marks them all at once: the aimed one, then one `spread` metres to each side across the
  // line from the boss, every one with the same warning (at least the walk out, warningSeconds).
  bossWarn(e, attack, aim) {
    const z = attack.zone, angle = Math.atan2(aim.x - e.x, aim.z - e.z), bs = e.bs, count = attack.count ?? 1;
    const zones = [], across = { x: Math.cos(angle), z: -Math.sin(angle) };
    for (let k = 0; k < count; k++) {
      // Zone ids: the first keeps the single-zone id; later ones add k * 1e7 (unique, never reused by a cycle).
      const zone = { id: e.id * 1000 + (bs.cycle % 1000) + k * 1e7, boss: e.id, team: e.team, attack: attack.id, shape: z.shape, angle, from: this.time, at: this.time + warningSeconds(attack) };
      // 0, +1, -1, +2, -2 ...: the aimed zone in the middle of the spread.
      const off = k ? Math.ceil(k / 2) * (k % 2 ? 1 : -1) * (attack.spread ?? 0) : 0;
      if (z.shape === "circle") Object.assign(zone, { x: aim.x + across.x * off, z: aim.z + across.z * off, radius: z.radius });
      else Object.assign(zone, { x: e.x, z: e.z, length: z.length, ...(z.shape === "cone" ? { half: (z.half ?? 15) * DEG } : { width: z.width }) });
      zone.until = zone.at + attack.over;
      zones.push(zone);
    }
    (this.dangerZones ||= []).push(...zones);
    const zone = zones[0];
    bs.zone = zone.id;
    bs.phase = "warning";
    bs.until = zone.at;
    // Break the attack (spec.break): the health to beat during this warning.
    if (BOSSES[e.boss]?.break) bs.mark = e.hp + e.shield;
    e.angle = angle;
    e.attacking = true;
    this.bossEvent(e, "bossWarn", { zone: { ...zone }, seconds: zone.at - zone.from, attack: attack.id, ...(count > 1 ? { zones: zones.map((q) => ({ ...q })) } : null) });
  },
  // One round: everything hostile in a zone is hit (units by their centre, buildings by their
  // footprint); flyers are over it. The shot event draws a shell from one of the guns, one per zone.
  // A stunning attack (`stun`) also silences every building it hits.
  bossRound(e, spec, attack, zones, k) {
    for (let zi = 0; zi < zones.length; zi++) {
      const zone = zones[zi], stunned = [];
      for (const t of this.entities) {
        if (t.hp <= 0 || t.flying || !this.hostile(e.team, t.team)) continue;
        const building = t.kind === "building";
        if ((t.kind !== "unit" && !building) || !inZone(zone, t, building ? t.radius : 0)) continue;
        this.applyDamage(t, attack.damage * (building ? attack.building ?? 1 : 1) * this.bossScale(spec, t), e.team, e.id);
        if (building && attack.stun && t.hp > 0 && this.applyStatus(t, "stunned", attack.stun.seconds)) stunned.push(t.id);
      }
      if (attack.stun) this.bossEvent(e, "bossStomp", { zone: { ...zone }, ids: stunned, seconds: attack.stun.seconds });
      const n = k * zones.length + zi, m = spec.muzzles?.[n % spec.muzzles.length] || [0, 2, 1], c = Math.cos(e.angle), s = Math.sin(e.angle);
      let tx = zone.x, tz = zone.z;
      if (zone.shape === "circle") {
        // A fixed spiral of landing spots across the circle.
        const a = k * 2.39996 + zone.angle, r = zone.radius * 0.85 * Math.sqrt((k + 0.5) / attack.rounds);
        tx += Math.cos(a) * r; tz += Math.sin(a) * r;
      } else {
        const u = (zone.length * (k + 1)) / (attack.rounds + 1), v = (k % 2 ? 1 : -1) * Math.min(1.2, halfWidth(zone, u) * 0.5);
        tx += u * Math.sin(zone.angle) + v * Math.cos(zone.angle); tz += u * Math.cos(zone.angle) - v * Math.sin(zone.angle);
      }
      this.events.push({ type: "shot", weapon: attack.weapon || "tank", source: e.id, target: null, x: e.x + m[0] * c + m[2] * s, z: e.z - m[0] * s + m[2] * c, tx, tz, team: e.team, heavy: true, sAir: m[1] - 0.4, boss: e.id, muzzle: n % 4 });
    }
  },
  // target: "building": the highest-tier tower within the attack's range, then the most expensive,
  // then the nearest (entity order breaks the rest). Undefined when none is in reach: the caller
  // falls back to the biggest unit group.
  bossBuildingAim(e, attack) {
    let best = null, tier = -1, cost = -1, near = Infinity;
    for (const t of this.entities) {
      if (t.hp <= 0 || t.kind !== "building" || !this.hostile(e.team, t.team) || !this.isVisible(t, e.team)) continue;
      const d = distance(e, t);
      if (d > attack.range) continue;
      const rank = t.tier ?? 0, w = worth(t);
      if (rank > tier || (rank === tier && (w > cost || (w === cost && d < near)))) { best = t; tier = rank; cost = w; near = d; }
    }
    return best ? { x: best.x, z: best.z, count: 0, building: best.id } : null;
  },
  // Route mode, tracking: the boss stops while a target is within reach of its next attack (it waits
  // for its pause there, light gun firing) and walks its road otherwise. stepRoute also fires the
  // light gun on the move and lets a blocker hold it, like any column.
  bossMarch(e, attack, aim, o, dt) {
    if (aim && hyp(aim.x - e.x, aim.z - e.z) <= attack.range) {
      e.moving = false;
      this.bossGun(e, dt);
    } else this.stepRoute(e, o, dt);
  },
  // Health stages release units beside the boss (spec.drops: [{ at, type, n }], `at` a share of its
  // maximum health). In Defence they walk the boss's own road (spawnOnRoute); elsewhere they go
  // for what the boss is aiming at. The count of drops made is e.bs.drop, created with the first.
  bossDrops(e, spec, bs) {
    while ((bs.drop ?? 0) < spec.drops.length && e.hp <= e.maxHp * spec.drops[bs.drop ?? 0].at + 1e-9) {
      const d = spec.drops[(bs.drop = (bs.drop ?? 0) + 1) - 1], r = D[d.type]?.radius || 0.7, o = e.orders[0];
      const spots = this.ringSpots(e.x, e.z, r, d.n, e.radius + r + 0.6);
      while (spots.length < d.n) spots.push({ x: e.x, z: e.z });
      const ids = [];
      for (const p of spots.slice(0, d.n)) {
        let u;
        if (this.defence && o?.type === "route") {
          u = this.spawnOnRoute(d.type, e.team, o.route, o.leg, p);
          if (e.wave !== undefined) u.wave = e.wave;
        } else {
          u = this.spawn(d.type, e.team, p.x, p.z, true, true);
          if (bs.aim) u.orders = [{ type: "attackmove", x: bs.aim.x, z: bs.aim.z }];
        }
        ids.push(u.id);
      }
      this.bossEvent(e, "bossDrop", { unit: d.type, ids });
    }
  },
  // Break the attack: during a warning, health lost of at least share x (max health + max shield)
  // cancels the attack and opens the core for `seconds` (the reward is the exposed window).
  bossBreak(e, spec, bs) {
    const need = spec.break.share * (e.maxHp + e.maxShield);
    if (bs.mark - (e.hp + e.shield) < need - 1e-9) return;
    this.clearZones(e.id);
    bs.zone = null;
    delete bs.mark;
    bs.phase = "exposed";
    bs.until = this.time + (spec.break.seconds ?? 6);
    this.bossEvent(e, "bossBroken", { seconds: bs.until - this.time });
    this.bossEvent(e, "bossExposed", { seconds: bs.until - this.time });
  },
  // A sideways step between attacks (spec.strafe.distance metres, alternating sides): the first side
  // whose spot is standable and reachable; none when both are blocked.
  bossStrafe(e, spec, bs) {
    const d = spec.strafe.distance, across = { x: Math.cos(e.angle), z: -Math.sin(e.angle) }, side = bs.cycle % 2 ? 1 : -1;
    for (const s of [side, -side]) {
      const p = { x: e.x + across.x * d * s, z: e.z + across.z * d * s };
      if (this.nav.canStand(p.x, p.z, e.radius) && this.nav.canTraverse(e, p, e.radius)) { bs.strafe = p; return; }
    }
  },
  // Boss engine III, march: the road to the nearest hostile Command core, found once when it wakes
  // (rounded to centimetres, so a save reads back the same), ending `stop` metres short of the core.
  bossRoad(e, spec, bs) {
    let core = null, near = Infinity;
    for (const t of this.entities) {
      if (t.hp <= 0 || t.type !== "hq" || !this.hostile(e.team, t.team)) continue;
      const d = distance(e, t);
      if (d < near) { core = t; near = d; }
    }
    if (!core) return;
    // A camp packed with buildings may leave no lane as wide as the boss into the core's own cell: the
    // road is then found for an ordinary unit (it ends short of the camp anyway).
    const stop = spec.march.stop ?? 12, road = [];
    let path = this.nav.path(e, core, e.radius);
    if (!path.length) path = this.nav.path(e, core);
    for (const p of path) {
      if (hyp(p.x - core.x, p.z - core.z) < stop) break;
      road.push([Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]);
    }
    if (road.length) { bs.road = road; bs.leg = 0; }
  },
  // One step of the march: toward the next point of the road; its post comes with it.
  bossWalk(e, dt) {
    const bs = e.bs;
    while (bs.leg < bs.road.length && hyp(bs.road[bs.leg][0] - e.x, bs.road[bs.leg][1] - e.z) <= 1.5) bs.leg++;
    // A point it cannot get past (a building put down on the road since) is skipped.
    if (bs.leg < bs.road.length && e.stalled > 3) { bs.leg++; e.stalled = 0; }
    if (bs.leg >= bs.road.length) { e.moving = false; return; }
    const [x, z] = bs.road[bs.leg];
    this.move(e, { x, z }, dt, 1);
    bs.post = { x: e.x, z: e.z };
  },
  // Boss engine III, a phase change: the attack in hand is dropped and the boss stands for `surge` s.
  bossSurge(e, spec, bs, stage) {
    const phase = spec.phases[stage];
    this.clearZones(e.id);
    bs.zone = null;
    delete bs.mark;
    delete bs.strafe;
    delete bs.aim;
    bs.phase = "surge";
    bs.set = stage;
    bs.cycle = 0;
    bs.until = this.time + (phase.surge ?? 3);
    e.attacking = false;
    this.bossEvent(e, "bossSurge", { stage, seconds: phase.surge ?? 3 });
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
        for (const z of zones) if (this.hostile(z.team, u.team) && this.time >= z.from + AUTO_REACT - 1e-9 && inZone(z, u, u.radius + EVADE_MARGIN)) { zone = z; break; }
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
      // A spread has several zones: never step out of one into the next.
      if (this.dangerZones.length > 1 && this.dangerZones.some((o) => o.id !== zone.id && this.hostile(o.team, u.team) && inZone(o, p, u.radius + EVADE_MARGIN))) continue;
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
