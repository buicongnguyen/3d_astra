import { DEFINITIONS as D, hyp, clamp } from "../data.js";
import { TOWERS_PER_SUPPORT } from "./constants.js";

// Orders, production queues and construction: the actions a team can take. Mixed into Simulation (see simulation.js).
export const orders = {
  issue(ids, order, append = false) {
    if (
      this.result ||
      ![
        "move",
        "attackmove",
        "patrol",
        "attack",
        "gather",
        "deliver",
        "build",
        "stop",
        "support",
        "repair",
      ].includes(order.type)
    )
      return;
    if (
      ["move", "attackmove", "patrol"].includes(order.type) &&
      ![order.x, order.z].every(Number.isFinite)
    )
      return;
    ids = [...new Set(ids)];
    let index = 0;
    const size = Math.ceil(Math.sqrt(ids.length));
    for (const id of ids) {
      const e = this.get(id);
      if (!e || e.kind !== "unit" || !e.complete) continue;
      if (order.type === 'patrol' && (e.type === 'worker' || !(e.damage > 0))) continue;
      const target = order.target ? this.get(order.target) : null;
      if (
        order.type === "attack" &&
        (!target || target.kind === "resource" || !this.attackable(e.team, target))
      )
        continue;
      if (order.type === "gather" && target?.kind !== "resource") continue;
      if (
        order.type === "build" &&
        (!target ||
          target.kind !== "building" ||
          target.team !== e.team ||
          target.complete)
      )
        continue;
      if (
        ["gather", "build", "deliver"].includes(order.type) &&
        e.type !== "worker"
      )
        continue;
      if (order.type === "repair" && !this.repairValid(e, target)) continue;
      if (
        target &&
        target.team !== undefined &&
        target.team !== e.team &&
        !this.isVisible(target, e.team)
      )
        continue;
      if (order.type === 'support' && !this.supportValid(e,target)) continue;
      if (order.type === 'attack' && e.support) {
        this.message(`${e.name} cannot attack. Use Support on a friendly target.`,e.team);
        continue;
      }
      const o = { ...order };
      // Capture the return point when this order starts, after earlier queued moves.
      if (o.type === 'patrol') o.origin = null;
      if (o.type === "gather") o.resourceType = target.type;
      if (["move", "attackmove", "patrol"].includes(o.type) && ids.length > 1) {
        o.x = clamp(o.x + ((index % size) - (size - 1) / 2) * 1.9, -this.terrain.half+3, this.terrain.half-3);
        o.z = clamp(
          o.z + (Math.floor(index / size) - (size - 1) / 2) * 1.9,
          -this.terrain.half+3,
          this.terrain.half-3,
        );
        index++;
      }
      if (["move", "attackmove", "patrol"].includes(o.type)) {
        // A center point inside the map can still leave a large vehicle outside it.
        const limit = this.terrain.half - Math.max(1, e.radius + 0.1);
        o.x = clamp(o.x, -limit, limit);
        o.z = clamp(o.z, -limit, limit);
      }
      if (!append || o.type === "stop") {
        e.working = false;
        e.orders = [];
        e.escape = null; e.hops = 0; e.escapeTried = false; e.escapeAt = 0; e.squeeze = false; // per-order movement state
        e.path = [];
        e.target = null;
        e.pathClock = 0;
        e.stalled = 0;
        e.moveSample = null;
        // A fresh command must reconsider a firing search that failed before repositioning.
        e.firing = null;
        e.attacking = false;
      }
      if (o.type !== "stop" && e.orders.length < 32) e.orders.push(o);
    }
  },
  enqueue(buildingId, type) {
    const b = this.get(buildingId),
      d = D[type];
    if (this.result || !b || !b.complete || !b.trains?.includes(type) || !this.canTrain(b.team,type) || !d)
      return false;
    const fail = (text) => {
      this.message(text, b.team);
      return false;
    };
    if (b.levelJob) return fail('Finish or cancel the building upgrade before training.');
    if (b.level < (d.required_level || 1)) return fail(`Upgrade ${b.name} to level ${d.required_level} to train ${d.name}.`);
    if (b.queue.length >= 5) return fail("Production queue is full.");
    if (
      type === "upgrade" &&
      (this.players[b.team].upgrade ||
        this.own(b.team).some((e) => e.queue.some((q) => q.type === "upgrade")))
    )
      return fail("Weapon upgrade is already researched or queued.");
    // Weapons and plating are the two exclusive branches of the Foundry research: one per match.
    // (Saves from 0.7.0 that already hold both keep both; nothing re-checks them.)
    if (type === "plating" && (this.players[b.team].plating || this.own(b.team).some((e) => e.queue.some((q) => q.type === "plating"))))
      return fail("Reinforced plating is already researched or queued.");
    // Second tier: needs its own first tier, and is researched once.
    if (type === "upgrade2" || type === "plating2") {
      const first = type === "upgrade2" ? "upgrade" : "plating", pl = this.players[b.team];
      if (!pl[first]) return fail(type === "upgrade2" ? "Overcharged weapons must be researched first." : "Reinforced plating must be researched first.");
      if (pl[type] || this.own(b.team).some((e) => e.queue.some((q) => q.type === type)))
        return fail(type === "upgrade2" ? "Overcharged weapons II is already researched or queued." : "Reinforced plating II is already researched or queued.");
    }
    if (type === "upgrade" || type === "plating") {
      const other = type === "upgrade" ? "plating" : "upgrade", pl = this.players[b.team];
      if (pl[other] || this.own(b.team).some((e) => e.queue.some((q) => q.type === other)))
        return fail(type === "upgrade" ? "Overcharged weapons are locked: Reinforced plating was chosen." : "Reinforced plating is locked: Overcharged weapons were chosen.");
    }
    if (!this.canPay(b.team, d.cost))
      return fail(`${this.resourceShortage(d.cost,b.team)} to train/research ${d.name}.`);
    const p = this.population(b.team);
    if (d.pop && p.used + p.reserved + d.pop > p.cap)
      return fail("Population limit reached. Build a Supply relay.");
    this.pay(b.team, d.cost);
    b.queue.push({ id: this.nextQueueId++, type, elapsed: 0 });
    this.message(`${d.name} queued.`, b.team);
    return true;
  },
  cancelQueue(id, index) {
    const b = this.get(id);
    if (this.result || !b || !Number.isInteger(index) || !b.queue[index])
      return false;
    this.pay(b.team, D[b.queue[index].type].cost, -1);
    b.queue.splice(index, 1);
    return true;
  },
  placement(type, team, x, z) {
    if (![x, z].every(Number.isFinite)) return "Invalid position.";
    const d = D[type];
    if (!d || d.kind !== "building" || !this.buildable(team).includes(type)) return "Invalid structure.";
    const missing = this.constructionRequirements(type,team);
    if (missing) return missing;
    const terrainError = this.terrain.placement(x, z, d.radius);
    if (terrainError) return terrainError;
    if (Math.abs(x) > this.terrain.half - d.radius - 2 || Math.abs(z) > this.terrain.half - d.radius - 2)
      return "Outside the buildable area.";
    if (!this.isVisible({ x, z }, team))
      return "Explore this area before building.";
    if (this.entities.some((w) => w.kind === "wall" && w.hp > 0 && hyp(x - w.x, z - w.z) < d.radius + w.radius + 0.5))
      return "A concrete wall blocks this location.";
    if (
      this.entities.some(
        (e) =>
          e.hp > 0 &&
          e.kind === "building" &&
          // 1.25 m: wider than the smallest unit (1.1 m), so no placement can seal a gap shut.
          hyp(x - e.x, z - e.z) < d.radius + e.radius + 1.25,
      )
    )
      return "Too close to another structure.";
    if (
      this.resources.some(
        (e) =>
          e.amount > 0 &&
          hyp(x - e.x, z - e.z) < d.radius + e.radius + 1,
      )
    )
      return "Keep resource deposits clear.";
    if (
      this.entities.some(
        (e) =>
          e.hp > 0 &&
          e.kind === "unit" &&
          e.team !== team &&
          hyp(x - e.x, z - e.z) < d.radius + e.radius + 0.3,
      )
    )
      return "Units are standing in the construction footprint.";
    // A building must never wall in the ground behind it: the route search needs real room to pass.
    if (this.nav.wouldSeal(x, z, d.radius)) return "That would wall in the ground behind it.";
    if (type === "tower") {
      const mine = this.own(team), supports = mine.filter((e) => (e.type === "hq" || e.type === "relay") && e.complete).length;
      if (mine.filter((e) => e.type === "tower").length >= supports * TOWERS_PER_SUPPORT) return "Build another Supply relay to support more Sentinel towers.";
    }
    if (
      d.requires &&
      !this.own(team).some((e) => e.type === d.requires && e.complete)
    )
      return `Requires a completed ${D[d.requires].name}.`;
    if (!this.canPay(team, d.cost)) return "Insufficient resources.";
    return "";
  },
  // The nearest valid site to (x, z) within a few metres, or null: a tap just beside a blocked
  // spot still builds instead of refusing.
  findPlacement(type, team, x, z, reach = 6) {
    if (!this.placement(type, team, x, z)) return { x, z };
    for (let r = 0.75; r <= reach; r += 0.75) {
      const steps = Math.max(12, Math.round(r * 6));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (!this.placement(type, team, px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  },
  build(workerId, type, x, z) {
    const w = this.get(workerId);
    if (this.result || !w || w.type !== "worker") return null;
    const error = this.placement(type, w.team, x, z);
    if (error) {
      this.message(error, w.team);
      return null;
    }
    const approach = this.approach(w, { x, z, radius: D[type].radius });
    if (!this.nav.path(w, approach).length) {
      this.message("The Harvester cannot reach that site.", w.team);
      return null;
    }
    // Never trap units inside a new footprint: own units standing there step out to its edge
    // (enemy units already refuse the placement).
    const moved = [];
    for (const e of this.entities) {
      if (e.hp <= 0 || e.kind !== "unit") continue;
      const dx = e.x - x, dz = e.z - z, d = hyp(dx, dz), clear = D[type].radius + e.radius + 0.35;
      if (d >= clear) continue;
      const a = d > 1e-3 ? Math.atan2(dz, dx) : e.id;
      e.x = x + Math.cos(a) * clear;
      e.z = z + Math.sin(a) * clear;
      e.path = [];
      moved.push({ e, a, clear });
    }
    this.pay(w.team, D[type].cost);
    const b = this.spawn(type, w.team, x, z, false);
    this.nav.rebuild(this.entities);
    // The edge push may land beside a neighbour, wall or water: take the first standable spot
    // on widening rings around the site (keeps the plain push when nothing is clear).
    for (const { e, a, clear } of moved) {
      if (this.nav.canStand(e.x, e.z, e.radius)) continue;
      search: for (let r = clear; r <= clear + 4; r += 0.6) {
        for (let k = 0; k < 16; k++) {
          const ang = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
          const px = x + Math.cos(ang) * r, pz = z + Math.sin(ang) * r;
          if (!this.nav.canStand(px, pz, e.radius)) continue;
          e.x = px;
          e.z = pz;
          break search;
        }
      }
    }
    this.issue([w.id], { type: "build", target: b.id });
    this.message(`${b.name} construction started.`, w.team);
    return b;
  },
  cancelBuilding(id) {
    const b = this.get(id);
    if (this.result || !b || b.kind !== "building" || b.complete) return false;
    // A damaged site returns less: no free scouting posts or tower hops under fire.
    const whole = Math.min(1, b.hp / Math.max(1, b.maxHp * b.progress));
    this.pay(b.team, b.cost, -0.75 * whole);
    b.hp = 0;
    this.nav.rebuild(this.entities);
    return true;
  },
  finish(e) {
    e.working = false;
    e.orders.shift();
    this.resetWorkerRoute(e);
    e.target = null;
    e.work = 0;
  },
};
