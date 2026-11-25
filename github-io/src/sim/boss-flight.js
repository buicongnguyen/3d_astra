import { hyp } from "../data.js";
import { BOSSES, warningSeconds, inZone } from "./bosses.js";

// Flying bosses (W9, the Ember Drake; docs/aaa/BOSSES.md "Boss engine IV"). A boss whose balance.json entry
// has `flight` runs this cycle instead of stepBoss's, so every walking boss plays exactly as before. It
// reuses the walking bosses' parts: the aim (bossAim), the danger zones and their auto-evade, the rounds
// (bossRound), the light gun, stages, phases (bossSurge) and the exposed window.
//
// The cycle:
//   dormant (on its perch, on the ground) --hurt, approached or `restless` s--> takes off
//   tracking (in the air: only units that hit air can reach it) --pause--> warning --> attacking --> exposed
//   after every `every` attacks: landing (flies back to its perch) --> warning (the wing gust, a circle
//   round the perch) --> the gust (damage and a push out of the circle) --> perched (on the ground for
//   `perch` s: every unit can hit it, and it takes `taken.exposed`) --> takes off --> tracking.
// A phase change (spec.phases) waits until it is in the air and not landing.
//
// State: e.flying (true in the air, false on the perch), e.fly (its height, for shots), and on e.bs: born,
// breaths (attacks since the last perch), landing (the gust in hand). All of it exists only on a flying
// boss, which only a mission that fields one creates.
const RETARGET = 5;

export const bossFlight = {
  stepDrake(e, spec, dt) {
    const f = spec.flight;
    const bs = (e.bs ??= { phase: "dormant", stage: 1, cycle: 0, post: { x: e.x, z: e.z }, born: this.time });
    const stage = 1 + (spec.stages || []).filter((s) => e.hp <= e.maxHp * s).length;
    if (stage > bs.stage) {
      bs.stage = stage;
      this.bossEvent(e, "bossStage", { stage });
    }
    if (bs.phase === "dormant") {
      e.moving = false;
      const restless = f.restless !== undefined && this.time - bs.born >= f.restless - 1e-9;
      if (!restless && !this.bossWakes(e, spec)) return;
      this.drakeTakeoff(e, f);
      bs.phase = "tracking";
      bs.next = this.time + (spec.first ?? 3);
      this.bossEvent(e, "bossWake");
      return;
    }
    // A phase change (spec.phases): in the air and not on its way down, it roars in place for `surge` s.
    const want = this.drakePhase(spec, bs.stage);
    if (want && want !== bs.set && e.flying && !bs.landing && bs.phase !== "landing" && bs.phase !== "surge") {
      this.bossSurge(e, spec, bs, want);
      return;
    }
    if (bs.phase === "surge") {
      e.attacking = false;
      if (this.time < bs.until - 1e-9) return;
      bs.phase = "tracking";
      bs.next = this.time + this.bossPause(spec, bs.stage);
      delete bs.aim;
      this.bossEvent(e, "bossArmored");
      return;
    }
    if (bs.phase === "perched") {
      if (this.time < bs.until - 1e-9) return;
      this.drakeTakeoff(e, f);
      bs.phase = "tracking";
      bs.next = this.time + this.bossPause(spec, bs.stage);
      delete bs.aim;
      this.bossEvent(e, "bossArmored");
      return;
    }
    if (bs.phase === "landing") {
      // Back to the perch; over it, the wing gust is marked round it.
      if (hyp(bs.post.x - e.x, bs.post.z - e.z) > 0.6) { this.move(e, bs.post, dt, 0.5); return; }
      e.x = bs.post.x; e.z = bs.post.z;
      this.drakeGustWarn(e, f.land, bs);
      return;
    }
    const attacks = this.bossAttacks(spec, bs), attack = bs.landing ? f.land : attacks[bs.cycle % attacks.length];
    if (bs.phase === "tracking") {
      if (bs.aim === undefined || this.ticks % RETARGET === 0) bs.aim = this.bossAim(e, spec, attack);
      this.drakeFly(e, spec, bs.aim, dt);
      this.bossGun(e, dt);
      if (this.time >= bs.next - 1e-9 && bs.aim && hyp(bs.aim.x - e.x, bs.aim.z - e.z) <= attack.range) this.bossWarn(e, attack, bs.aim);
      return;
    }
    const zone = this.bossZone(e);
    if (bs.phase === "warning" && !bs.landing) this.bossGun(e, dt);
    e.attacking = true;
    if (zone && zone.shape !== "circle") e.angle = zone.angle;
    else if (zone && !bs.landing) e.angle = Math.atan2(zone.x - e.x, zone.z - e.z);
    if (bs.phase === "warning" && this.time >= bs.until - 1e-9) {
      bs.phase = "attacking";
      bs.round = 0;
      bs.from = this.time;
      this.bossEvent(e, "bossAttack", { zone: bs.zone, attack: attack.id, area: zone ? { ...zone } : null });
    }
    if (bs.phase === "attacking") {
      const gap = attack.over / attack.rounds;
      while (bs.round < attack.rounds && this.time >= bs.from + bs.round * gap - 1e-9) {
        if (bs.landing) this.drakeGust(e, spec, attack, zone, bs.round++);
        else this.bossRound(e, spec, attack, this.bossZones(e), bs.round++);
      }
      if (bs.round < attack.rounds) return;
      this.clearZones(e.id);
      bs.zone = null;
      if (bs.landing) {
        // Down on the perch: every unit can reach it now, and it takes the open-core damage.
        delete bs.landing;
        e.flying = false;
        e.attacking = false;
        bs.phase = "perched";
        bs.until = this.time + f.perch;
        this.bossEvent(e, "bossLand", { seconds: f.perch });
        this.bossEvent(e, "bossExposed", { seconds: f.perch });
        return;
      }
      bs.phase = "exposed";
      bs.until = this.time + spec.exposed;
      this.bossEvent(e, "bossExposed", { seconds: spec.exposed });
    } else if (bs.phase === "exposed" && this.time >= bs.until - 1e-9) {
      e.attacking = false;
      bs.cycle++;
      bs.breaths = (bs.breaths ?? 0) + 1;
      delete bs.aim;
      if (bs.breaths >= f.every) {
        bs.breaths = 0;
        bs.phase = "landing";
        this.bossEvent(e, "bossLanding");
      } else {
        bs.phase = "tracking";
        bs.next = this.time + this.bossPause(spec, bs.stage);
      }
      this.bossEvent(e, "bossArmored");
    }
  },
  // The phase a stage asks for: the highest phases key at or below it (none before the first).
  drakePhase(spec, stage) {
    if (!spec.phases) return 0;
    let best = 0;
    for (const k of Object.keys(spec.phases)) if (+k <= stage && +k > best) best = +k;
    return best;
  },
  drakeTakeoff(e, f) {
    e.flying = true;
    e.fly = f.fly;
    this.bossEvent(e, "bossTakeoff");
  },
  // In the air: it hangs `hover` m short of the group it aims at (so Rangers below can reach it), never
  // further than `leash` from its perch, and flies home with nothing to fight.
  drakeFly(e, spec, aim, dt) {
    const post = e.bs.post, hover = spec.flight.hover ?? 6;
    let goal = null;
    if (aim) {
      const d = hyp(aim.x - e.x, aim.z - e.z);
      if (d > hover + 0.5) goal = { x: aim.x + ((e.x - aim.x) / d) * hover, z: aim.z + ((e.z - aim.z) / d) * hover };
    } else if (hyp(post.x - e.x, post.z - e.z) > 3) goal = post;
    if (!goal) { e.moving = false; return; }
    const off = hyp(goal.x - post.x, goal.z - post.z);
    if (off > spec.leash) goal = { x: post.x + ((goal.x - post.x) / off) * spec.leash, z: post.z + ((goal.z - post.z) / off) * spec.leash };
    if (hyp(goal.x - e.x, goal.z - e.z) > 0.8) this.move(e, goal, dt, 0.6);
    else e.moving = false;
  },
  // The wing gust's mark: a circle round the perch, with the same walk-out warning as every boss zone.
  // Its id is apart from the attacks' ids (they count by cycle), so a mark is never reused for it.
  drakeGustWarn(e, land, bs) {
    const at = this.time + warningSeconds(land);
    const zone = { id: e.id * 1000 + (bs.cycle % 1000) + 5e6, boss: e.id, team: e.team, attack: land.id, shape: "circle", angle: e.angle, from: this.time, at, until: at + land.over, x: bs.post.x, z: bs.post.z, radius: land.zone.radius };
    (this.dangerZones ||= []).push(zone);
    bs.landing = true;
    bs.zone = zone.id;
    bs.phase = "warning";
    bs.until = at;
    e.attacking = true;
    this.bossEvent(e, "bossWarn", { zone: { ...zone }, seconds: at - this.time, attack: land.id });
  },
  // One gust round: every hostile ground unit in the circle is hit and pushed `knock` m straight out (in
  // half-metre steps while the ground allows); buildings in it take the building share.
  drakeGust(e, spec, attack, zone, k) {
    if (!zone) return;
    const pushed = [];
    for (const t of this.entities) {
      if (t.hp <= 0 || t.flying || !this.hostile(e.team, t.team)) continue;
      const building = t.kind === "building";
      if ((t.kind !== "unit" && !building) || !inZone(zone, t, building ? t.radius : 0)) continue;
      this.applyDamage(t, attack.damage * (building ? attack.building ?? 1 : 1) * this.bossScale(spec, t), e.team, e.id);
      if (building || t.hp <= 0 || !attack.knock) continue;
      const dx = t.x - zone.x, dz = t.z - zone.z, d = hyp(dx, dz), a = d > 0.05 ? Math.atan2(dz, dx) : t.id * 2.39996;
      const ux = Math.cos(a), uz = Math.sin(a);
      let moved = 0;
      for (let step = 0.5; step <= attack.knock + 1e-9; step += 0.5) {
        const p = { x: t.x + ux * 0.5, z: t.z + uz * 0.5 };
        if (!this.nav.canStand(p.x, p.z, t.radius) || !this.nav.canTraverse(t, p, t.radius)) break;
        t.x = p.x; t.z = p.z; moved += 0.5;
      }
      if (moved > 0) { t.path = []; t.pathClock = 0; pushed.push(t.id); }
    }
    this.bossEvent(e, "bossGust", { zone: { ...zone }, ids: pushed, round: k });
  },
};

// The flying boss in a boss table entry (tests and tools).
export const flyingBosses = () => Object.entries(BOSSES).filter(([, s]) => s.flight).map(([id]) => id);
