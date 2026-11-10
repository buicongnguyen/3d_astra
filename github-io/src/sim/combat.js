import { distance, hyp } from "../data.js";
import { LEASH } from "./constants.js";

// Target choice, guarding, firing and damage delivery. Mixed into Simulation (see simulation.js).
export const combat = {
  enemy(e, radius = e.vision, clearShot = false) {
    let best = null,
      bestD = radius;
    for (const t of this.entities) {
      if (t.hp <= 0) continue;
      // Cheap squared-distance prune first: it rejects nearly every candidate before the
      // costlier hostile/fog checks, with the same bound as the exact test below.
      const lim = bestD + t.radius + 0.00001,
        dx = t.x - e.x,
        dz = t.z - e.z;
      if (lim < 0 || dx * dx + dz * dz > lim * lim) continue;
      if (!this.hostile(e.team, t.team) || !this.isVisible(t, e.team)) continue;
      const d = distance(e, t) - t.radius;
      if (d <= bestD + 0.00001 && (!clearShot || this.nav.clearLine(e, t, t.id))) {
        best = t;
        bestD = d;
      }
    }
    return best;
  },
  // Static defenses shoot the nearest combat or support unit first, then Harvesters, and
  // buildings last, so a tower is never busy with a wall while troops destroy it.
  defenseTarget(e) {
    let best = null, bestRank = 3, bestD = Infinity;
    for (const t of this.entities) {
      if (t.hp <= 0) continue;
      const lim = e.range + t.radius + 0.00001,
        dx = t.x - e.x,
        dz = t.z - e.z;
      if (dx * dx + dz * dz > lim * lim) continue;
      if (!this.hostile(e.team, t.team) || !this.isVisible(t, e.team)) continue;
      const d = distance(e, t) - t.radius;
      if (d > e.range + 0.00001) continue;
      const rank = t.kind !== "unit" ? 2 : t.type === "worker" ? 1 : 0;
      if ((rank < bestRank || (rank === bestRank && d < bestD)) && this.nav.clearLine(e, t, t.id)) {
        best = t;
        bestRank = rank;
        bestD = d;
      }
    }
    return best;
  },
  // Whoever damaged this unit in the last few seconds, if still a valid enemy.
  attacker(e) {
    if (this.time - (e.hitAt ?? -9) > 4) return null;
    const t = this.get(e.hitBy);
    return t && t.hp > 0 && this.hostile(e.team, t.team) ? t : null;
  },
  // An idle fighter guards the spot it was left on. It answers whoever shot it and chases
  // enemies it can see, but only within a leash of that spot, and then walks back.
  holdPost(e, dt) {
    e.post ??= { x: e.x, z: e.z };
    let t = this.attacker(e) || this.enemy(e, e.vision);
    if (t && (distance(e.post, t) - t.radius > e.vision + LEASH || (e.postSkip?.id === t.id && this.time < e.postSkip.until))) t = null;
    if (t && e.stalled > 3) {
      e.postSkip = { id: t.id, until: this.time + 8 };
      e.stalled = 0;
      e.path = [];
      t = null;
    }
    if (t) {
      // An unseen shooter (longer range than this unit's sight) is closed on until it is seen.
      if (this.isVisible(t, e.team) ? this.fight(e, t, dt) : (this.move(e, this.approach(e, t, Math.max(1.2, e.range * 0.7)), dt), true)) return;
    }
    if (distance(e, e.post) > 1.5) this.move(e, e.post, dt, 1.2);
  },
  hit(e, target) {
    // Counter and anti-vehicle multipliers depend on each victim, including splash victims.
    const apply = (t, scale = 1) =>
      this.applyDamage(
        t,
        this.attackValue(e) * scale *
          (e.counter === t.type ? e.counter_bonus || 1.6 : 1) *
          (t.mechanical ? e.mechanical_bonus || 1 : 1),
        e.team,
        e.id,
      );
    apply(target);
    // Area weapons (balance.json splash_radius / splash_damage share) also hit nearby enemies.
    if (e.splash_radius)
      for (const t of this.entities)
        if (t.id !== target.id && this.hostile(e.team, t.team) && distance(t, target) - (t.kind === "unit" ? 0 : t.radius) < e.splash_radius)
          apply(t, e.splash_damage);
    this.events.push({
      type: "shot",
      weapon: e.type,
      source: e.id,
      x: e.x,
      z: e.z,
      tx: target.x,
      tz: target.z,
      team: e.team,
      heavy: ["breaker", "tank", "antitank"].includes(e.type),
    });
    e.cooldown = e.interval;
  },
  fight(e, t, dt, chase = true) {
    if (
      !e.damage ||
      !t ||
      !Number.isFinite(t.hp) ||
      t.hp <= 0 ||
      !this.attackable(e.team, t) ||
      !this.isVisible(t, e.team)
    )
      return false;
    const inRange = distance(e, t) <= e.range + t.radius + 0.00001;
    if (inRange && this.nav.clearLine(e, t, t.id)) {
      e.attacking = true;
      e.angle = Math.atan2(t.x - e.x, t.z - e.z);
      e.moving = false;
      if (e.cooldown <= 0) this.hit(e, t);
    } else if (chase && e.kind === "unit") {
      if (this.noFiringPosition(e, t)) return false;
      if (!inRange) {
        this.move(e, this.approach(e, t, Math.max(1.2, e.range * 0.7)), dt);
        return true;
      }
      // In range but screened by a rock or building: walk around to a clear shot
      // instead of pressing into the obstacle until the order times out.
      const goal = this.firingPosition(e, t);
      if (!goal) return false;
      // Arriving still screened, or 3 s without progress (an unreachable spot), fails this
      // candidate before the generic 6 s stall could cancel the whole order.
      if (this.move(e, goal, dt) || e.stalled > 3) {
        goal.failed = true;
        e.stalled = 0;
        e.moveSample = null;
      }
    }
    return true;
  },
  noFiringPosition(e, t) {
    const f = e.firing;
    return !!f?.exhausted && f.target === t.id && f.revision === this.nav.revision &&
      hyp(f.tx - t.x, f.tz - t.z) < 1;
  },
  // The nearest standable point with a clear shot on rings around the target, widest ring
  // first; each failed candidate moves on to the next ring. Returns null once every ring
  // failed, so an attack ends (attack-move passes on) instead of waiting forever.
  firingPosition(e, t) {
    const cached = e.firing;
    let attempt = 0;
    if (
      cached?.target === t.id &&
      cached.revision === this.nav.revision &&
      hyp(cached.tx - t.x, cached.tz - t.z) < 1
    ) {
      if (cached.exhausted) return null;
      if (!cached.failed) return cached;
      attempt = cached.attempt + 1;
    }
    const rings = [0.7, 0.45, 0.2];
    let best = null;
    for (; attempt < rings.length && !best; attempt += best ? 0 : 1) {
      const r = t.radius + Math.max(1.2, e.range * rings[attempt]);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2,
          p = { x: t.x + Math.cos(a) * r, z: t.z + Math.sin(a) * r };
        if (!this.nav.canStand(p.x, p.z, e.radius) || !this.nav.clearLine(p, t, t.id)) continue;
        if (!best || distance(e, p) < distance(e, best)) best = p;
      }
    }
    e.firing = { ...best, target: t.id, tx: t.x, tz: t.z, revision: this.nav.revision, attempt, exhausted: !best };
    return best ? e.firing : null;
  },
};
