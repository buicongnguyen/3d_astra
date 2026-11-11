import { DEFINITIONS as D, distance } from "../data.js";

// Veterancy, stances and unit abilities. Mixed into Simulation (see simulation.js).

// Experience needed for ranks 1 to 3. A kill is worth the victim's population (a building 2).
export const RANK_XP = [3, 8, 16];
// Each rank adds this share of base damage and health.
export const RANK_BONUS = 0.08;
export const STANCES = ["guard", "hold", "aggressive"];
// How often computer-controlled (and auto-cast) units look for a moment to use an ability.
const AUTOCAST_EVERY = 0.5;

// What each ability does. Numbers live in balance.json under the unit's `ability`.
// A timed ability changes the unit's own figures for `duration` and puts them back after.
const TIMED = {
  // Vanguard: brace behind the shield. Takes less damage, moves slower.
  shieldwall: (e, a) => ({ guard: a.damage_taken, speed: e.speed * a.speed }),
  // Ranger: rapid fire.
  focus: (e, a) => ({ interval: e.interval * a.interval }),
  // Battle tank: engine and guns past their limits.
  overdrive: (e, a) => ({ speed: e.speed * a.speed, damage: a.damage }),
  // Anti-tank soldier: guided shots reach further and bite harder into vehicles.
  lockon: (e, a) => ({ range: e.range + a.range, mech: a.mechanical }),
};

export const tactics = {
  // Called when `victim` dies to a hit from entity `by`. Only fighting units earn ranks.
  creditKill(by, victim) {
    const e = by === null ? null : this.get(by);
    if (!e || e.kind !== "unit" || e.type === "worker" || !e.damage || victim.kind === "wall") return;
    e.xp = (e.xp || 0) + (victim.kind === "building" ? 2 : victim.pop || 1);
    while ((e.rank || 0) < RANK_XP.length && e.xp >= RANK_XP[e.rank || 0]) {
      e.rank = (e.rank || 0) + 1;
      const before = e.maxHp;
      e.maxHp = Math.round(D[e.type].hp * (1 + RANK_BONUS * e.rank));
      // A promotion patches the unit up: the added health plus a quarter of the bar.
      e.hp = Math.min(e.maxHp, e.hp + (e.maxHp - before) + e.maxHp * 0.25);
      this.events.push({ type: "promote", id: e.id, rank: e.rank, x: e.x, z: e.z, team: e.team });
    }
  },
  rankFactor(e) {
    return (1 + RANK_BONUS * (e.rank || 0)) * (e.buff?.damage || 1);
  },
  // guard (default): answer threats near the post. hold: never leave the spot. aggressive: chase freely.
  setStance(ids, stance) {
    if (!STANCES.includes(stance)) return false;
    for (const id of ids) {
      const e = this.get(id);
      if (e?.kind === "unit" && e.damage > 0 && e.type !== "worker") e.stance = stance;
    }
    return true;
  },
  abilityReady(e) {
    return !!e?.ability && e.hp > 0 && e.kind === "unit" && this.time >= (e.abilityAt || 0);
  },
  // Uses the unit's ability if it is ready. `point` is needed by aimed abilities (Barrage).
  // Returns true when it was used.
  useAbility(e, point = null) {
    if (!this.abilityReady(e)) return false;
    const a = e.ability;
    if (TIMED[a.id]) {
      this.endBuff(e);
      const change = TIMED[a.id](e, a), undo = {};
      for (const key of ["speed", "interval", "range"]) if (change[key] !== undefined) { undo[key] = e[key]; e[key] = change[key]; }
      e.buff = { id: a.id, until: this.time + a.duration, undo, guard: change.guard, damage: change.damage, mech: change.mech };
    } else if (a.id === "barrage") {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z) || distance(e, point) > a.range) return false;
      (this.strikes ||= []).push({ at: this.time + a.delay, x: point.x, z: point.z, team: e.team, by: e.id, damage: a.damage, radius: a.radius });
    } else if (a.id === "triage" || a.id === "fortify") {
      // Medics mend people, Engineers mend machines and buildings; neither treats itself.
      const fits = (t) => t.id !== e.id && t.team === e.team && t.hp > 0 && t.hp < t.maxHp && distance(e, t) <= a.radius + (t.radius || 0) &&
        (a.id === "triage" ? t.kind === "unit" && !t.mechanical : t.mechanical || (t.kind === "building" && t.complete));
      const patients = this.entities.filter(fits);
      if (!patients.length) return false;
      for (const t of patients) t.hp = Math.min(t.maxHp, t.hp + a.heal);
    } else return false;
    e.abilityAt = this.time + a.cooldown;
    this.events.push({ type: "ability", ability: a.id, id: e.id, team: e.team, x: e.x, z: e.z, tx: point?.x, tz: point?.z, radius: a.radius, duration: a.duration, delay: a.delay });
    return true;
  },
  endBuff(e) {
    if (!e.buff) return;
    Object.assign(e, e.buff.undo);
    e.buff = null;
  },
  // Player command: every selected unit whose ability is ready uses it.
  castAbilities(ids, point = null) {
    let used = 0;
    for (const id of ids) if (this.useAbility(this.get(id), point)) used++;
    return used > 0;
  },
  stepTactics(dt) {
    for (const e of this.entities) if (e.buff && this.time >= e.buff.until) this.endBuff(e);
    if (this.strikes?.length) {
      const due = this.strikes.filter((s) => this.time >= s.at);
      if (due.length) this.strikes = this.strikes.filter((s) => this.time < s.at);
      for (const s of due) {
        const eventStart = this.events.length;
        for (const t of this.entities)
          if (t.hp > 0 && this.hostile(s.team, t.team) && distance(t, s) - (t.kind === "unit" ? 0 : t.radius) <= s.radius)
            this.applyDamage(t, s.damage * (t.kind === "unit" ? 1 : 0.5), s.team, s.by);
        this.events.push({ type: "strike", x: s.x, z: s.z, radius: s.radius, team: s.team, victims: this.events.slice(eventStart).filter(e => e.type === "death" && !e.building).map(e => ({x:e.x,z:e.z,team:e.team})) });
      }
    }
    this.castClock = (this.castClock ?? 0) - dt;
    if (this.castClock > 0) return;
    this.castClock = AUTOCAST_EVERY;
    for (const e of this.entities) {
      if (!this.abilityReady(e) || !(e.team > 0 ? this.aiEnabled : this.players[e.team]?.autocast)) continue;
      const a = e.ability;
      if (a.id === "triage" || a.id === "fortify") {
        // Worth it only when someone nearby is badly hurt.
        if (this.entities.some((t) => t.team === e.team && t.id !== e.id && t.hp > 0 && t.hp < t.maxHp * 0.6 && distance(e, t) <= a.radius)) this.useAbility(e);
      } else if (a.id === "barrage") {
        const t = this.enemy(e, a.range);
        if (t) this.useAbility(e, { x: t.x, z: t.z });
      } else if (e.attacking || this.time - (e.hitAt ?? -9) < 1) this.useAbility(e);
    }
  },
};
