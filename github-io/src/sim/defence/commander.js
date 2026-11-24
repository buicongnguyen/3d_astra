// The commander hero (0.21).
// Split from sim/defence.js (AAA round 2, CW-A): the methods are unchanged and the mixin keeps its
// original key order (see ./index.js).
import { DEFINITIONS as D, hyp } from "../../data.js";
import GARRISONS from "../../defence/garrisons.json" with { type: "json" };
import { TEAM, SPAWN_CLEAR } from "./common.js";

export const commander = {
  // ---------------------------------------------------------------- Commander (0.21)
  // One hero on the field (defence.commander {x, z}): a gold-trimmed unit of the player's roster
  // that holds where it is sent, never chases, blocks the road, and comes back 20 s after it falls.
  spawnCommander() {
    const def = this.defenceDef(), c = GARRISONS.commander, at = def.commander, type = this.typeFor(TEAM, c.slot);
    const e = this.spawn(type, TEAM, at.x, at.z, true, true);
    e.hero = true;
    e.blocker = true;
    e.name = c.name;
    e.hp = e.maxHp = Math.round(D[type].hp * c.hp);
    this.setBaseHp(e);
    // Its own shield (owner, 2026-11-25: 500, was the tank's 100); it recharges like any unit shield.
    if (c.shield > 0) e.shield = e.maxShield = c.shield;
    e.damage = D[type].damage * c.damage;
    e.interval = D[type].interval * c.interval;
    e.speed = c.speed;
    e.stance = "hold";
    e.ability = null;
    const exit = def.exit;
    e.angle = Math.atan2(-(exit.x - at.x), -(exit.z - at.z));
    const h = this.defence.hero;
    if (h) { h.id = e.id; h.deadAt = null; }
    else this.defence.hero = { id: e.id, deadAt: null, barrageAt: 0, reinforceAt: 0 };
    return e;
  },
  commander() {
    const h = this.defence?.hero;
    return h ? this.get(h.id) || null : null;
  },
  stepCommander() {
    const h = this.defence.hero;
    if (this.get(h.id)) return;
    if (h.deadAt === null) {
      h.deadAt = this.time;
      this.events.push({ type: "commanderDown", team: TEAM, back: GARRISONS.commander.respawn });
    } else if (this.time >= h.deadAt + GARRISONS.commander.respawn - 1e-9) {
      const e = this.spawnCommander();
      this.events.push({ type: "commanderBack", id: e.id, team: TEAM, x: e.x, z: e.z });
    }
  },
  // Seconds until an ability is ready again (0: ready).
  commanderCooldown(ability) {
    const h = this.defence?.hero;
    return h ? Math.max(0, (ability === "barrage" ? h.barrageAt : h.reinforceAt) - this.time) : null;
  },
  heroMove(team, x, z) {
    const e = this.commander();
    if (!this.defence || this.result || team !== TEAM || !e || !Number.isFinite(x) || !Number.isFinite(z) || !this.nav.canStand(x, z, e.radius)) return false;
    // Never onto the spot where the waves come in: the column would wait behind it for ever.
    if (Object.values(this.defenceDef().routes).some((pts) => hyp(pts[0].x - x, pts[0].z - z) < SPAWN_CLEAR)) return false;
    e.orders = [{ type: "move", x, z }];
    e.path = [];
    e.stalled = 0;
    this.events.push({ type: "heroMove", id: e.id, team, x, z });
    return true;
  },
  // Barrage: the Breakers' shelling, called in by the commander. Reinforce: three Vanguards
  // dropped on the road who hold it for a while. Both within reach of the commander.
  heroCast(team, ability, x, z) {
    const e = this.commander(), h = this.defence?.hero, c = GARRISONS.commander;
    if (!this.defence || this.result || team !== TEAM || !e || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (ability === "barrage") {
      const a = c.barrage;
      if (this.time < h.barrageAt - 1e-9 || hyp(x - e.x, z - e.z) > a.range || this.hiddenTop({ x, z }, team)) return false;
      (this.strikes ||= []).push({ at: this.time + a.delay, x, z, team, by: e.id, damage: a.damage, radius: a.radius });
      h.barrageAt = this.time + a.cooldown * (this.hasPerk("gunnery") ? GARRISONS.perks.gunnery.cooldown : 1);
      this.events.push({ type: "ability", ability: "barrage", id: e.id, team, x: e.x, z: e.z, tx: x, tz: z, radius: a.radius, delay: a.delay });
      return true;
    }
    if (ability === "reinforce") {
      const a = c.reinforce, type = this.typeFor(team, a.slot), r = D[type].radius || 0.65;
      if (this.time < h.reinforceAt - 1e-9 || hyp(x - e.x, z - e.z) > a.range || !this.nav.canStand(x, z, r)) return false;
      if (Object.values(this.defenceDef().routes).some((pts) => hyp(pts[0].x - x, pts[0].z - z) < SPAWN_CLEAR)) return false;
      for (const p of this.ringSpots(x, z, r, a.count)) {
        const v = this.spawn(type, team, p.x, p.z, true, true);
        v.blocker = true;
        v.stance = "hold";
        v.expires = this.time + a.seconds;
        v.angle = e.angle;
      }
      h.reinforceAt = this.time + a.cooldown;
      this.events.push({ type: "ability", ability: "reinforce", id: e.id, team, x: e.x, z: e.z, tx: x, tz: z, radius: 2.5 });
      return true;
    }
    return false;
  },
};
