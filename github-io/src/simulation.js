import {
  DEFINITIONS as D,
  ROCKS,
  HALF,
  GRID,
  MAX_POP,
  cellAt,
  worldAt,
  distance,
  clamp,
} from "./data.js";
import { Navigation } from "./navigation.js";

export class Simulation {
  constructor({ ai = true } = {}) {
    this.aiEnabled = ai;
    this.entities = [];
    this.resources = [];
    this.nextId = 1;
    this.time = 0;
    this.players = [0, 1].map(() => ({
      alloy: 450,
      energy: 150,
      upgrade: false,
      kills: 0,
    }));
    this.events = [];
    this.result = null;
    this.nav = new Navigation();
    this.aiClock = 0;
    this.waveAt = 85;
    this.visionClock = 0;
    this.visible = [new Uint8Array(GRID * GRID), new Uint8Array(GRID * GRID)];
    this.explored = [new Uint8Array(GRID * GRID), new Uint8Array(GRID * GRID)];
    for (let team = 0; team < 2; team++) {
      const side = team === 0 ? 1 : -1;
      this.spawn("hq", team, -25 * side, 24 * side);
      this.spawn("barracks", team, -16 * side, 25 * side);
      for (let i = 0; i < 4; i++)
        this.spawn("worker", team, (-29 + i * 2) * side, 16 * side);
      this.spawn("ranger", team, -18 * side, 17 * side);
      this.spawn("ranger", team, -15 * side, 17 * side);
      this.spawn("vanguard", team, -12 * side, 17 * side);
      for (const [x, z] of [
        [-36, 18],
        [-37, 22],
        [-35, 26],
      ])
        this.resource("alloy", x * side, z * side, 1600);
      this.resource("energy", -30 * side, 34 * side, 1400);
      this.resource("alloy", -31 * side, -25 * side, 2400);
      this.resource("energy", -25 * side, -32 * side, 1800);
    }
    this.nav.rebuild(this.entities);
    this.updateVision();
    this.message(
      "Meridian is online. Assign Harvesters to the amber alloy deposits.",
    );
  }
  resource(type, x, z, amount) {
    this.resources.push({
      id: this.nextId++,
      type,
      x,
      z,
      amount,
      initial: amount,
      radius: 1.7,
      kind: "resource",
    });
  }
  spawn(type, team, x, z, complete = true) {
    const d = D[type];
    const e = {
      ...d,
      type,
      id: this.nextId++,
      team,
      x,
      z,
      hp: complete ? d.hp : 1,
      maxHp: d.hp,
      complete,
      progress: complete ? 1 : 0,
      orders: [],
      path: [],
      pathClock: 0,
      cooldown: 0,
      target: null,
      carry: 0,
      carryType: null,
      resource: null,
      queue: [],
      rally: null,
      angle: 0,
      moving: false,
      work: 0,
    };
    this.entities.push(e);
    return e;
  }
  get(id) {
    return (
      this.entities.find((e) => e.id === id && e.hp > 0) ||
      this.resources.find((e) => e.id === id && e.amount > 0)
    );
  }
  own(team) {
    return this.entities.filter((e) => e.team === team && e.hp > 0);
  }
  population(team) {
    let used = 0,
      reserved = 0,
      cap = 0;
    for (const e of this.own(team)) {
      used += e.pop || 0;
      if (e.complete) cap += e.supply || 0;
      for (const q of e.queue) reserved += D[q.type].pop || 0;
    }
    return { used, reserved, cap: Math.min(MAX_POP, cap) };
  }
  canPay(team, cost) {
    const p = this.players[team];
    return p.alloy >= cost[0] && p.energy >= cost[1];
  }
  pay(team, cost, factor = 1) {
    this.players[team].alloy -= cost[0] * factor;
    this.players[team].energy -= cost[1] * factor;
  }
  message(text, team = 0) {
    if (team === 0) {
      this.events.push({ type: "message", text });
      if (this.events.length > 300) this.events.splice(0, 100);
    }
  }
  isVisible(e, team = 0) {
    const [x, z] = cellAt(e.x, e.z);
    return e.team === team || !!this.visible[team][z * GRID + x];
  }
  isExplored(e, team = 0) {
    const [x, z] = cellAt(e.x, e.z);
    return !!this.explored[team][z * GRID + x];
  }
  updateVision() {
    for (let team = 0; team < 2; team++) {
      this.visible[team].fill(0);
      for (const e of this.own(team)) {
        const [cx, cz] = cellAt(e.x, e.z),
          r = Math.ceil(e.vision / 2);
        for (let z = Math.max(0, cz - r); z <= Math.min(GRID - 1, cz + r); z++)
          for (
            let x = Math.max(0, cx - r);
            x <= Math.min(GRID - 1, cx + r);
            x++
          ) {
            if (distance(e, worldAt(x, z)) <= e.vision)
              this.visible[team][z * GRID + x] = this.explored[team][
                z * GRID + x
              ] = 1;
          }
      }
    }
  }
  issue(ids, order, append = false) {
    let index = 0;
    const size = Math.ceil(Math.sqrt(ids.length));
    for (const id of ids) {
      const e = this.get(id);
      if (!e || e.kind !== "unit" || !e.complete) continue;
      const target = order.target ? this.get(order.target) : null;
      if (
        ["gather", "build", "deliver"].includes(order.type) &&
        e.type !== "worker"
      )
        continue;
      if (
        target &&
        target.team !== undefined &&
        target.team !== e.team &&
        !this.isVisible(target, e.team)
      )
        continue;
      const o = { ...order };
      if (["move", "attackmove"].includes(o.type) && ids.length > 1) {
        o.x = clamp(o.x + ((index % size) - (size - 1) / 2) * 1.9, -45, 45);
        o.z = clamp(
          o.z + (Math.floor(index / size) - (size - 1) / 2) * 1.9,
          -45,
          45,
        );
        index++;
      }
      if (!append) {
        e.orders = [];
        e.path = [];
        e.target = null;
        e.pathClock = 0;
        e.stalled = 0;
      }
      if (o.type !== "stop") e.orders.push(o);
    }
  }
  enqueue(buildingId, type) {
    const b = this.get(buildingId),
      d = D[type];
    if (!b || !b.complete || !b.trains?.includes(type) || !d) return false;
    const fail = (text) => {
      this.message(text, b.team);
      return false;
    };
    if (b.queue.length >= 5) return fail("Production queue is full.");
    if (!this.canPay(b.team, d.cost))
      return fail("Insufficient resources. Assign more Harvesters.");
    const p = this.population(b.team);
    if (p.used + p.reserved + (d.pop || 0) > p.cap)
      return fail("Population limit reached. Build a Supply relay.");
    if (
      type === "upgrade" &&
      (this.players[b.team].upgrade ||
        this.own(b.team).some((e) => e.queue.some((q) => q.type === "upgrade")))
    )
      return fail("Weapon upgrade is already researched or queued.");
    this.pay(b.team, d.cost);
    b.queue.push({ type, elapsed: 0 });
    this.message(`${d.name} queued.`, b.team);
    return true;
  }
  cancelQueue(id, index) {
    const b = this.get(id);
    if (!b || !b.queue[index]) return false;
    this.pay(b.team, D[b.queue[index].type].cost, -1);
    b.queue.splice(index, 1);
    return true;
  }
  placement(type, team, x, z) {
    const d = D[type];
    if (!d || d.kind !== "building") return "Invalid structure.";
    if (Math.abs(x) > HALF - d.radius - 2 || Math.abs(z) > HALF - d.radius - 2)
      return "Outside the buildable area.";
    if (!this.isVisible({ x, z }, team))
      return "Explore this area before building.";
    if (
      ROCKS.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < d.radius + r + 1)
    )
      return "Terrain blocks this location.";
    if (
      this.entities.some(
        (e) =>
          e.hp > 0 &&
          e.kind === "building" &&
          Math.hypot(x - e.x, z - e.z) < d.radius + e.radius + 1.5,
      )
    )
      return "Too close to another structure.";
    if (
      this.resources.some(
        (e) =>
          e.amount > 0 &&
          Math.hypot(x - e.x, z - e.z) < d.radius + e.radius + 1.5,
      )
    )
      return "Keep resource deposits clear.";
    if (
      this.entities.some(
        (e) =>
          e.hp > 0 &&
          e.kind === "unit" &&
          Math.hypot(x - e.x, z - e.z) < d.radius + e.radius + 0.3,
      )
    )
      return "Units are standing in the construction footprint.";
    if (
      d.requires &&
      !this.own(team).some((e) => e.type === d.requires && e.complete)
    )
      return `Requires a completed ${D[d.requires].name}.`;
    if (!this.canPay(team, d.cost)) return "Insufficient resources.";
    return "";
  }
  build(workerId, type, x, z) {
    const w = this.get(workerId);
    if (!w || w.type !== "worker") return null;
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
    // Prevent trapping units inside a new footprint, including enemy units.
    if (
      this.entities.some(
        (e) =>
          e.hp > 0 &&
          e.kind === "unit" &&
          Math.hypot(x - e.x, z - e.z) < D[type].radius + e.radius + 0.3,
      )
    ) {
      this.message("Units are standing in the construction footprint.", w.team);
      return null;
    }
    this.pay(w.team, D[type].cost);
    const b = this.spawn(type, w.team, x, z, false);
    this.nav.rebuild(this.entities);
    this.issue([w.id], { type: "build", target: b.id });
    this.message(`${b.name} construction started.`, w.team);
    return b;
  }
  cancelBuilding(id) {
    const b = this.get(id);
    if (!b || b.kind !== "building" || b.complete) return false;
    this.pay(b.team, b.cost, -0.75);
    b.hp = 0;
    this.nav.rebuild(this.entities);
    return true;
  }
  approach(e, target, margin = 1.4) {
    const angle = Math.atan2(e.z - target.z, e.x - target.x),
      r = (target.radius || 0) + margin;
    return {
      x: target.x + Math.cos(angle) * r,
      z: target.z + Math.sin(angle) * r,
    };
  }
  move(e, goal, dt, tolerance = 0.5) {
    if (distance(e, goal) < tolerance) {
      e.moving = false;
      e.path = [];
      return true;
    }
    if (e.moveSample && distance(e, e.moveSample) < 0.04)
      e.stalled = (e.stalled || 0) + dt;
    else e.stalled = 0;
    e.moveSample = { x: e.x, z: e.z };
    if (e.stalled > 6) {
      this.finish(e);
      this.message(
        `${e.name} cannot reach its destination. Order cleared.`,
        e.team,
      );
      return false;
    }
    e.pathClock -= dt;
    if (e.pathClock <= 0) {
      e.path = this.nav.path(e, goal);
      e.pathClock = 1.3 + (e.id % 7) * 0.08;
    }
    if (!e.path.length) {
      e.moving = false;
      return false;
    }
    let next = e.path[0];
    if (distance(e, next) < 0.3) {
      e.path.shift();
      next = e.path[0];
    }
    if (!next) {
      e.moving = false;
      return distance(e, goal) < 2.1 || !this.nav.canStand(goal.x, goal.z);
    }
    const dx = next.x - e.x,
      dz = next.z - e.z,
      d = Math.hypot(dx, dz),
      step = Math.min(d, e.speed * dt);
    e.x += (dx / d) * step;
    e.z += (dz / d) * step;
    e.angle = Math.atan2(dx, dz);
    e.moving = true;
    return false;
  }
  finish(e) {
    e.orders.shift();
    e.path = [];
    e.pathClock = 0;
    e.target = null;
    e.work = 0;
    e.stalled = 0;
    e.moveSample = null;
  }
  enemy(e, radius = e.vision) {
    let best = null,
      bestD = radius;
    for (const t of this.entities) {
      if (t.hp <= 0 || t.team === e.team || !this.isVisible(t, e.team))
        continue;
      const d = distance(e, t) - t.radius;
      if (d < bestD) {
        best = t;
        bestD = d;
      }
    }
    return best;
  }
  hit(e, target) {
    const bonus = e.counter === target.type ? 1.6 : 1;
    const damage =
      e.damage *
      bonus *
      (this.players[e.team].upgrade && e.kind === "unit" && e.type !== "worker"
        ? 1.1
        : 1);
    const apply = (t, scale = 1) => {
      if (t.hp <= 0) return;
      t.hp -= damage * scale;
      if (t.hp <= 0) {
        this.players[e.team].kills++;
        this.events.push({
          type: "death",
          x: t.x,
          z: t.z,
          team: t.team,
          building: t.kind === "building",
        });
        if (t.kind === "building") this.nav.rebuild(this.entities);
      }
    };
    apply(target);
    if (e.type === "breaker")
      for (const t of this.entities)
        if (t.id !== target.id && t.team !== e.team && distance(t, target) < 3)
          apply(t, 0.5);
    this.events.push({
      type: "shot",
      x: e.x,
      z: e.z,
      tx: target.x,
      tz: target.z,
      team: e.team,
      heavy: e.type === "breaker",
    });
    e.cooldown = e.interval;
  }
  fight(e, t, dt, chase = true) {
    if (!t || t.hp <= 0 || !this.isVisible(t, e.team)) return false;
    const inRange = distance(e, t) <= e.range + t.radius;
    if (inRange && this.nav.clearLine(e, t, t.id)) {
      e.angle = Math.atan2(t.x - e.x, t.z - e.z);
      e.moving = false;
      if (e.cooldown <= 0) this.hit(e, t);
    } else if (chase && e.kind === "unit")
      this.move(e, this.approach(e, t, Math.max(1.2, e.range * 0.7)), dt);
    return true;
  }
  updateWorker(e, o, dt) {
    const t = this.get(o.target);
    if (o.type === "build") {
      if (!t || t.complete) {
        this.finish(e);
        return;
      }
      if (distance(e, t) > t.radius + 2.2) {
        this.move(e, this.approach(e, t), dt);
        return;
      }
      e.moving = false;
      // One active builder per construction site.
      if (
        t.builder &&
        t.builder !== e.id &&
        this.get(t.builder)?.orders[0]?.target === t.id
      )
        return;
      t.builder = e.id;
      t.progress = Math.min(1, t.progress + dt / t.time);
      t.hp = Math.min(t.maxHp, t.hp + (dt * t.maxHp) / t.time);
      if (t.progress >= 1) {
        t.complete = true;
        this.message(`${t.name} is operational.`, e.team);
        this.finish(e);
      }
      return;
    }
    if (o.type === "gather") {
      if (!t || t.kind !== "resource") {
        if (e.carry > 0) o.type = "deliver";
        else this.finish(e);
        return;
      }
      e.resource = t.id;
      if (e.carry >= 10 || (e.carry > 0 && e.carryType !== t.type)) {
        o.type = "deliver";
        return;
      }
      if (distance(e, t) > t.radius + 1.4) {
        this.move(e, this.approach(e, t, 1), dt);
        return;
      }
      e.moving = false;
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
        this.finish(e);
        return;
      }
      if (distance(e, depot) > depot.radius + 2.2) {
        this.move(e, this.approach(e, depot), dt);
        return;
      }
      if (e.carryType) this.players[e.team][e.carryType] += e.carry;
      e.carry = 0;
      e.carryType = null;
      if (e.orders.length > 1) {
        this.finish(e);
        return;
      }
      if (e.resource && this.get(e.resource)) {
        o.type = "gather";
        o.target = e.resource;
        e.path = [];
      } else this.finish(e);
    }
  }
  updateProduction(b, dt) {
    if (!b.complete || !b.queue.length) return;
    const q = b.queue[0],
      d = D[q.type];
    q.elapsed += dt;
    if (q.elapsed < d.time) return;
    if (q.type === "upgrade") {
      this.players[b.team].upgrade = true;
      b.queue.shift();
      this.message(
        "Overcharged weapons online. Combat damage increased by 10%.",
        b.team,
      );
      return;
    }
    let pos;
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2,
        candidate = {
          x: b.x + Math.cos(angle) * (b.radius + 2.5),
          z: b.z + Math.sin(angle) * (b.radius + 2.5),
        };
      if (
        this.nav.canStand(candidate.x, candidate.z, d.radius) &&
        !this.entities.some(
          (e) =>
            e.hp > 0 &&
            e.kind === "unit" &&
            distance(candidate, e) < e.radius + d.radius + 0.2,
        )
      ) {
        pos = candidate;
        break;
      }
    }
    if (!pos) return;
    b.queue.shift();
    const u = this.spawn(q.type, b.team, pos.x, pos.z);
    if (b.rally) this.issue([u.id], { type: "move", ...b.rally });
    this.message(`${d.name} ready.`, b.team);
  }
  updateAI() {
    const own = this.own(1),
      workers = own.filter((e) => e.type === "worker"),
      army = own.filter((e) => e.kind === "unit" && e.type !== "worker");
    for (let i = 0; i < workers.length; i++) {
      const w = workers[i];
      if (w.orders.length) continue;
      const type = i % 4 === 0 ? "energy" : "alloy";
      const deposit = this.resources
        .filter((r) => r.amount > 0 && r.type === type && this.isExplored(r, 1))
        .sort((a, b) => distance(w, a) - distance(w, b))[0];
      if (deposit) this.issue([w.id], { type: "gather", target: deposit.id });
    }
    const hq = own.find((e) => e.type === "hq" && e.complete);
    if (hq && workers.length < 9 && hq.queue.length < 1)
      this.enqueue(hq.id, "worker");
    const pop = this.population(1);
    const want = !own.some((e) => e.type === "barracks")
      ? "barracks"
      : pop.cap - pop.used - pop.reserved < 5 && pop.cap < MAX_POP
        ? "relay"
        : !own.some((e) => e.type === "foundry") && this.time > 100
          ? "foundry"
          : null;
    if (
      want &&
      this.canPay(1, D[want].cost) &&
      !own.some((e) => !e.complete) &&
      workers.length
    ) {
      outer: for (const r of [10, 17, 23])
        for (let i = 0; i < 12; i++) {
          const x = 25 + Math.cos((i / 12) * Math.PI * 2) * r,
            z = -24 + Math.sin((i / 12) * Math.PI * 2) * r;
          if (!this.placement(want, 1, x, z)) {
            if (this.build(workers[0].id, want, x, z)) break outer;
          }
        }
    }
    for (const b of own.filter(
      (e) => e.complete && ["barracks", "foundry"].includes(e.type),
    ))
      if (b.queue.length < 2)
        this.enqueue(
          b.id,
          b.type === "foundry"
            ? "breaker"
            : Math.floor(this.time / 4) % 3 === 0
              ? "vanguard"
              : "ranger",
        );
    const threat =
      hq &&
      this.entities.find(
        (e) =>
          e.team === 0 &&
          e.hp > 0 &&
          this.isVisible(e, 1) &&
          distance(hq, e) < 25,
      );
    if (threat)
      this.issue(
        army
          .filter((e) => !e.orders.length || e.orders[0].type !== "attack")
          .map((e) => e.id),
        { type: "attack", target: threat.id },
      );
    else if (this.time >= this.waveAt && army.length >= 4) {
      this.issue(
        army.map((e) => e.id),
        { type: "attackmove", x: -25, z: 24 },
      );
      this.waveAt = this.time + 50;
    }
  }
  tick(dt) {
    if (this.result) return;
    this.time += dt;
    this.visionClock -= dt;
    if (this.visionClock <= 0) {
      this.updateVision();
      this.visionClock = 0.25;
    }
    for (const e of this.entities) {
      if (e.hp <= 0) continue;
      e.cooldown -= dt;
      e.moving = false;
      if (e.kind === "building") {
        this.updateProduction(e, dt);
        if (e.complete && e.damage)
          this.fight(e, this.enemy(e, e.range), dt, false);
        continue;
      }
      const o = e.orders[0];
      if (!o) {
        if (e.type !== "worker")
          this.fight(e, this.enemy(e, e.range + 2), dt, false);
        continue;
      }
      if (["gather", "build", "deliver"].includes(o.type)) {
        this.updateWorker(e, o, dt);
        continue;
      }
      if (o.type === "attack") {
        const t = this.get(o.target);
        if (!this.fight(e, t, dt)) this.finish(e);
      } else if (o.type === "attackmove") {
        const t = this.enemy(e, 12);
        if (t) this.fight(e, t, dt);
        else if (this.move(e, o, dt, 1.2)) this.finish(e);
      } else if (o.type === "move" && this.move(e, o, dt, 1.2)) this.finish(e);
    }
    const units = this.entities.filter((e) => e.hp > 0 && e.kind === "unit");
    for (let i = 0; i < units.length; i++)
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i],
          b = units[j],
          dx = a.x - b.x,
          dz = a.z - b.z,
          d = Math.hypot(dx, dz),
          min = (a.radius + b.radius) * 0.9;
        if (d >= min) continue;
        const nx = d > 0.001 ? dx / d : 1,
          nz = d > 0.001 ? dz / d : 0,
          push = Math.min((min - d) * 0.5, dt * 2);
        if (
          this.nav.canStand(a.x + nx * push, a.z + nz * push, a.radius * 0.8)
        ) {
          a.x += nx * push;
          a.z += nz * push;
        }
        if (
          this.nav.canStand(b.x - nx * push, b.z - nz * push, b.radius * 0.8)
        ) {
          b.x -= nx * push;
          b.z -= nz * push;
        }
      }
    if (this.aiEnabled) {
      this.aiClock -= dt;
      if (this.aiClock <= 0) {
        this.updateAI();
        this.aiClock = 2.5;
      }
    }
    const alive = [0, 1].map((team) =>
      this.own(team).some((e) => e.type === "hq"),
    );
    if (!alive[0] || !alive[1])
      this.result =
        !alive[0] && !alive[1] ? "draw" : alive[0] ? "victory" : "defeat";
    // Retain only live simulation objects; selection and orders use stable IDs.
    this.entities = this.entities.filter((e) => e.hp > 0);
  }
}
