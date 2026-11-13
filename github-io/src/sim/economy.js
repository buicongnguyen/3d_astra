import { DEFINITIONS as D, distance } from "../data.js";
import { MINERS_PER_DEPOSIT } from "./constants.js";

// Harvesting, construction work and unit production. Mixed into Simulation (see simulation.js).
export const economy = {
  resumeGathering(e, o) {
    // Explicit queued commands take priority over automatic reassignment.
    if (e.orders.length > 1) { this.finish(e); return; }
    let resource = this.get(e.resource);
    if (!resource && !o.resourceType) { this.finish(e); return; }
    if (!resource || resource.kind !== "resource") {
      resource = this.resources
        .filter(r => r.amount > 0 && r.type === o.resourceType &&
          this.isExplored(r, e.team) && distance(e, r) <= 30)
        .sort((a, b) => distance(e, a) - distance(e, b))
        .find(r => {
          const goal = this.approach(e, r, 0.8);
          const path = this.nav.path(e, goal, e.radius);
          return path.length && distance(path.at(-1), r) <= r.radius + 1.4;
        });
    }
    if (!resource) {
      this.message(`No reachable nearby ${o.resourceType || "resource"} deposit. Assign this Harvester to another deposit.`, e.team);
      this.finish(e);
      return;
    }
    e.resource = resource.id;
    o.type = "gather";
    o.target = resource.id;
    o.resourceType = resource.type;
    this.resetWorkerRoute(e);
  },
  updateWorker(e, o, dt) {
    const t = this.get(o.target);
    if (o.type === "repair") {
      if (!this.repair(e, t, dt)) this.finish(e);
      return;
    }
    if (o.type === "build") {
      if (!t || t.kind !== "building" || t.team !== e.team || t.complete) {
        this.finish(e);
        return;
      }
      if (distance(e, t) > t.radius + 2.2) {
        this.move(e, this.approach(e, t), dt);
        return;
      }
      e.moving = false;
      // One active builder per construction site.
      const activeBuilder = this.get(t.builder);
      if (
        activeBuilder &&
        activeBuilder.id !== e.id &&
        activeBuilder.orders[0]?.type === "build" &&
        activeBuilder.orders[0]?.target === t.id &&
        distance(activeBuilder, t) <= t.radius + 2.2
      )
        return;
      t.builder = e.id;
      e.working = true;
      t.progress = Math.min(1, t.progress + dt / t.time);
      t.hp = Math.min(t.maxHp, t.hp + (dt * t.maxHp) / t.time);
      if (t.progress >= 1) {
        t.complete = true;
        this.events.push({ type: "built", x: t.x, z: t.z, team: t.team, radius: t.radius, seed: t.id });
        this.message(`${t.name} is operational.`, e.team);
        this.finish(e);
      }
      return;
    }
    if (o.type === "gather") {
      if (!t || t.kind !== "resource") {
        e.resource = o.target;
        if (e.carry > 0) { o.type = "deliver"; this.resetWorkerRoute(e); }
        else this.resumeGathering(e, o);
        return;
      }
      e.resource = t.id;
      o.resourceType = t.type;
      if (e.carry >= 10 || (e.carry > 0 && e.carryType !== t.type)) {
        o.type = "deliver";
        this.resetWorkerRoute(e);
        return;
      }
      if (distance(e, t) > t.radius + 1.4) {
        // Arrival tolerance must end inside the harvesting radius (0.8 + 0.2 < 1.4).
        this.move(e, this.approach(e, t, 0.8), dt, 0.2);
        return;
      }
      e.moving = false;
      this.resetWorkerRoute(e);
      e.angle = Math.atan2(t.x - e.x, t.z - e.z);
      // A deposit has room for a few Harvesters; the rest wait their turn, and after a short
      // wait move to a free deposit of the same kind if one is near.
      if (t.crewTick !== this.ticks) {
        t.crewLast = t.crewTick === this.ticks - 1 ? t.crew : 0;
        t.crewTick = this.ticks;
        t.crew = 0;
      }
      if (t.crew >= MINERS_PER_DEPOSIT) {
        e.wait = (e.wait || 0) + dt;
        if (e.wait > 1.5) {
          e.wait = 0;
          const busy = (r) => (r.crewTick >= this.ticks - 1 ? Math.max(r.crew, r.crewLast || 0) : 0);
          const free = this.resources
            .filter((r) => r.id !== t.id && r.type === t.type && r.amount > 0 && this.isExplored(r, e.team) && distance(r, t) < 30 && busy(r) < MINERS_PER_DEPOSIT)
            .sort((a, b) => distance(e, a) - distance(e, b))[0];
          if (free) {
            o.target = free.id;
            e.resource = free.id;
          }
        }
        return;
      }
      t.crew++;
      e.wait = 0;
      e.working = true;
      e.work += dt;
      if (e.work >= 0.7) {
        e.work -= 0.7;
        const amount = Math.min(2, t.amount, 10 - e.carry);
        e.carry += amount;
        e.carryType = t.type;
        t.amount -= amount;
      }
      return;
    }
    if (o.type === "deliver") {
      const depots = this.own(e.team)
        .filter((b) => b.type === "hq" && b.complete)
        .sort((a, b) => distance(e, a) - distance(e, b));
      const depot = depots[0];
      if (!depot) {
        this.message("Harvester needs a completed Command core to deliver cargo. Finish or build one, then order delivery.", e.team);
        this.finish(e);
        return;
      }
      if (distance(e, depot) > depot.radius + 2.2) {
        this.move(e, this.approach(e, depot), dt);
        return;
      }
      if (e.carryType) {
        this.players[e.team][e.carryType] += e.carry;
        this.missionBank(e.team, e.carryType, e.carry);
      }
      if (e.carry > 0) this.events.push({ type: "deliver", x: e.x, z: e.z, tx: depot.x, tz: depot.z, team: e.team, resource: e.carryType, seed: e.id });
      e.carry = 0;
      e.carryType = null;
      this.resumeGathering(e, o);
    }
  },
  // Where a freshly trained unit appears: the nearest clear ground around the building, widening
  // ring by ring so a building boxed in by neighbours still releases its units (beyond the wall if it
  // must). Spots with a route to the rally point or the Command core are preferred, so a unit does
  // not appear in a sealed pocket.
  exitPoint(b, d) {
    const hq = this.own(b.team).find((e) => e.type === "hq"), goal = b.rally || hq || b;
    const free = [];
    for (let r = b.radius + 2.5; r <= b.radius + 16 && free.length < 8; r += 1.5)
      for (let i = 0; i < 28; i++) {
        const angle = (i / 28) * Math.PI * 2 + r * 0.7, c = { x: b.x + Math.cos(angle) * r, z: b.z + Math.sin(angle) * r };
        if (this.nav.canStand(c.x, c.z, d.radius) &&
          !this.entities.some((e) => e.hp > 0 && e.kind === "unit" && distance(c, e) < e.radius + d.radius + 0.2)) {
          free.push(c);
          if (free.length >= 8) break;
        }
      }
    return free.find((c) => this.nav.path(c, goal, d.radius).length) || free[0] || null;
  },
  updateProduction(b, dt) {
    if (!b.complete || b.levelJob || !b.queue.length) return;
    const q = b.queue[0],
      d = D[q.type];
    q.elapsed += dt*(1+0.2*(b.level-1));
    if (q.elapsed < d.time) return;
    if (["upgrade", "plating", "upgrade2", "plating2", "flak"].includes(q.type)) this.events.push({type:"research",team:b.team,x:b.x,z:b.z});
    // Flak (sim/air.js): towers shoot flyers. Stored only once researched.
    if (q.type === "flak") {
      this.players[b.team].flak = true;
      b.queue.shift();
      this.message("Flak guns fitted. Sentinel towers now shoot flyers.", b.team);
      return;
    }
    if (q.type === "upgrade") {
      this.players[b.team].upgrade = true;
      b.queue.shift();
      this.message(
        "Overcharged weapons online. Combat damage increased by 10%.",
        b.team,
      );
      return;
    }
    if (q.type === "upgrade2" || q.type === "plating2") {
      this.players[b.team][q.type] = true;
      b.queue.shift();
      this.message(q.type === "upgrade2" ? "Overcharged weapons II online. Combat damage is now 19% above base." : "Reinforced plating II fitted. Combat units take 19% less damage.", b.team);
      return;
    }
    if (q.type === "plating") {
      this.players[b.team].plating = true;
      b.queue.shift();
      this.message("Reinforced plating fitted. Combat units take 12% less damage.", b.team);
      return;
    }
    // Supply lost after enqueueing must not let completed units bypass the cap.
    const population = this.population(b.team);
    if (population.used + d.pop > population.cap) {
      q.blocked = "Awaiting supply";
      return;
    }
    q.blocked = null;
    const pos = this.exitPoint(b, d);
    if (!pos) {
      q.blocked = "Exit blocked";
      return;
    }
    b.queue.shift();
    const u = this.spawn(q.type, b.team, pos.x, pos.z);
    this.events.push({ type: "spawn", x: pos.x, z: pos.z, team: b.team, seed: u.id });
    // A rally point on a deposit sends new Harvesters straight to work.
    const deposit = b.rally?.target && this.get(b.rally.target);
    if (u.type === "worker" && deposit?.kind === "resource") this.issue([u.id], { type: "gather", target: deposit.id });
    else if (b.rally) this.issue([u.id], { type: "move", x: b.rally.x, z: b.rally.z });
    this.message(`${d.name} ready.`, b.team);
  },
  // Sends a team's idle Harvesters to the nearest explored deposits, one in four to energy.
  assignHarvesters(team = 0) {
    const workers = this.own(team).filter((e) => e.type === "worker" && !e.tag);
    for (let i = 0; i < workers.length; i++) {
      const w = workers[i];
      if (w.orders.length) continue;
      const type = i % 4 === 0 ? "energy" : "alloy";
      const deposit = this.resources
        .filter((r) => r.amount > 0 && r.type === type && this.isExplored(r, team))
        .sort((a, b) => distance(w, a) - distance(w, b))[0];
      if (deposit) this.issue([w.id], { type: "gather", target: deposit.id });
    }
  },
};
