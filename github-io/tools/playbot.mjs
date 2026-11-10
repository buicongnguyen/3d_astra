// A steady, unspectacular player for balance checks: it builds an economy, keeps supply ahead,
// trains a mixed army that guards the base, and (optionally) marches once it is strong.
// It plays only through sim.command, exactly as the interface does.
// Usage: const bot = new PlayBot(sim, { attackAt: 14 }); call bot.step() once per tick.
import { DEFINITIONS as D } from "../src/data.js";

export class PlayBot {
  constructor(sim, { team = 0, attackAt = Infinity, workers = 10, towers = 2 } = {}) {
    Object.assign(this, { sim, team, attackAt, workers, towers, placed: 0 });
    sim.command({ team, type: "autocast", on: true });
  }
  own(type) { return this.sim.own(this.team).filter((e) => e.type === type); }
  build(type, near, reach = 14) {
    const s = this.sim, builder = this.own("worker").find((w) => !w.orders.some((o) => o.type === "build"));
    if (!builder || s.placement(type, this.team, 1e9, 1e9) === undefined) return false;
    for (let i = 0; i < 16; i++) {
      const angle = (this.placed++ * 2.4) % (Math.PI * 2), r = 9 + (i % 4) * 3;
      const spot = s.findPlacement(type, this.team, near.x + Math.cos(angle) * r, near.z + Math.sin(angle) * r, reach);
      if (spot && s.command({ team: this.team, type: "build", worker: builder.id, building: type, x: spot.x, z: spot.z })) return true;
    }
    return false;
  }
  step() {
    const s = this.sim, team = this.team;
    if (s.result || s.ticks % 40 !== 1) return;
    const p = s.players[team], hq = this.own("hq").find((e) => e.complete);
    s.command({ team, type: "harvest" });
    if (!hq) return;
    const pop = s.population(team), can = (type) => s.canPay(team, D[type].cost);
    const sites = s.own(team).filter((e) => e.kind === "building" && !e.complete).length;
    const done = (type) => this.own(type).filter((e) => e.complete);
    if (this.own("worker").length < this.workers && !hq.queue.length && !hq.levelJob) s.command({ team, type: "train", building: hq.id, unit: "worker" });
    if (!sites) {
      if (pop.cap - pop.used - pop.reserved < 4 && can("relay")) this.build("relay", hq);
      else if (!this.own("barracks").length && can("barracks")) this.build("barracks", hq);
      else if (done("barracks").length && !this.own("foundry").length && can("foundry") && s.time > 150) this.build("foundry", hq);
      else if (done("barracks").length && this.own("tower").length < this.towers && can("tower") && s.time > 90) this.build("tower", hq);
      else if (done("barracks").length === 1 && p.alloy > 500) this.build("barracks", hq);
    }
    // Tech when rich, so later units unlock.
    if (hq.level < 3 && p.alloy > 450 && s.time > 240 && !hq.queue.length) s.command({ team, type: "upgrade", building: hq.id });
    for (const b of [...done("barracks"), ...done("foundry")]) {
      if (b.levelJob) continue;
      if (b.level < hq.level && p.alloy > 400 && !b.queue.length) { s.command({ team, type: "upgrade", building: b.id }); continue; }
      if (b.queue.length >= 2) continue;
      const army = s.own(team).filter((e) => e.kind === "unit" && e.type !== "worker");
      const count = (type) => army.filter((e) => e.type === type).length;
      const wish = b.type === "foundry"
        ? [b.level >= 3 && count("tank") <= count("breaker") ? "tank" : "breaker", b.level >= 2 && count("engineer") < 1 ? "engineer" : null, "breaker"]
        : [b.level >= 2 && count("medic") < 2 && army.length > 6 ? "medic" : null, count("ranger") <= count("vanguard") * 1.5 ? "ranger" : "vanguard", "vanguard"];
      const unit = wish.find((type) => type && b.level >= (D[type].required_level || 1) && can(type));
      if (unit) s.command({ team, type: "train", building: b.id, unit });
    }
    const fighters = s.own(team).filter((e) => e.kind === "unit" && e.damage > 0 && e.type !== "worker");
    if (fighters.length >= this.attackAt && !fighters.some((e) => e.orders.length)) {
      const target = [...s.knownCores[team].values()][0];
      if (target) s.command({ team, type: "order", ids: fighters.map((e) => e.id), order: { type: "attackmove", x: target.x, z: target.z } });
    }
  }
}
