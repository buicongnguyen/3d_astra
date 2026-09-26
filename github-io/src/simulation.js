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
import { progression } from "./progression.js";
import { AI_SPEEDS, coalitionPlan, roleOf } from "./ai-plan.js";
import { Terrain } from "./terrain.js";

export class Simulation {
  constructor({ ai = true, map = "classic", enemyCount = 1, aiSpeed = "normal", alliance = "ffa", playerBonus = null } = {}) {
    this.aiEnabled = ai;
    this.entities = [];
    this.resources = [];
    this.nextId = 1;
    this.nextQueueId = 1;
    this.time = 0;
    this.enemyCount = Number.isInteger(enemyCount) ? clamp(enemyCount, 1, 3) : 1;
    this.aiSpeed = Object.hasOwn(AI_SPEEDS, aiSpeed) ? aiSpeed : "normal";
    this.pace = AI_SPEEDS[this.aiSpeed];
    // A coalition of AIs shares vision and plans and never fights itself.
    this.coalition = alliance === "coalition" && this.enemyCount > 1;
    this.players = Array.from({ length: this.enemyCount + 1 }, () => ({
      alloy: 450,
      energy: 150,
      upgrade: false,
      kills: 0,
      eliminated: false,
    }));
    this.events = [];
    this.result = null;
    this.terrain = new Terrain(map);
    this.nav = new Navigation(this.terrain);
    this.aiClock = 0;
    this.waveAt = this.players.map((_, team) => this.pace.firstWave + Math.max(0, team - 1) * 15);
    if (this.coalition) this.initCoalition();
    this.visionClock = 0;
    this.visible = this.players.map(() => new Uint8Array(this.terrain.grid * this.terrain.grid));
    this.explored = this.players.map(() => new Uint8Array(this.terrain.grid * this.terrain.grid));
    const startingDeposits = new Set();
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
        this.resource("alloy", x * side, z * side, 2000);
      this.resource("energy", -30 * side, 34 * side, 1750);
      for (const r of this.resources.slice(-4)) startingDeposits.add(r);
      const offset=this.terrain.offset;
      for (const e of this.own(team)) { e.x-=offset*side; e.z+=offset*side; }
      for (const r of this.resources.slice(-4)) { r.x-=offset*side; r.z+=offset*side; }
      this.resource("alloy", -31 * side, -25 * side, 3000);
      this.resource("energy", -25 * side, -32 * side, 2250);
      for (const [x,z] of this.terrain.sites) {
        this.resource("alloy",x*side,z*side,3000);
        this.resource("alloy",(x+4)*side,z*side,3000);
        this.resource("energy",(x+2)*side,(z+5)*side,2250);
      }
    }
    for (let team = 2; team < this.players.length; team++) {
      // Reflect the starting camp into the two unused quadrants.
      const sx = team === 2 ? -1 : 1, sz = -sx;
      for (const e of this.own(0)) this.spawn(e.type, team, e.x * sx, e.z * sz);
      for (const r of this.resources.slice(0, 4)) {
        this.resource(r.type, r.x * sx, r.z * sz, r.initial);
        startingDeposits.add(this.resources.at(-1));
      }
    }
    // Keep shared expansions clear of additional bases and starting deposits.
    if (this.enemyCount > 1) this.resources = this.resources.filter(r => startingDeposits.has(r) || (
      !this.entities.some(e => e.kind === "building" && distance(e, r) < e.radius + r.radius + 2) &&
      ![...startingDeposits].some(other => distance(other, r) < other.radius + r.radius + 1)
    ));
    // Initial deployment locations are public; later cores require scouting.
    this.knownCores = this.players.map((_, team) => new Map(this.entities
      .filter(e => e.type === "hq" && this.hostile(team, e.team))
      .map(e => [e.id, { id: e.id, team: e.team, x: e.x, z: e.z }])));
    this.scoutIndex = this.players.map(() => 0);
    this.nav.rebuild(this.entities);
    this.updateVision();
    if (playerBonus) this.reinforce(playerBonus);
    this.message(
      "Meridian is online. Assign Harvesters to the amber alloy deposits.",
    );
  }
  // Campaign handicap against allied AIs: extra supplies and a Sentinel tower facing the map centre.
  reinforce({ alloy = 0, energy = 0, tower = false }) {
    this.players[0].alloy += alloy;
    this.players[0].energy += energy;
    const hq = this.own(0).find((e) => e.type === "hq");
    if (!tower || !hq) return;
    const toward = Math.atan2(-hq.z, -hq.x);
    for (const r of [8, 10, 12])
      for (const turn of [0, 0.4, -0.4, 0.8, -0.8]) {
        const x = hq.x + Math.cos(toward + turn) * r, z = hq.z + Math.sin(toward + turn) * r;
        if (this.placement("tower", 0, x, z)) continue;
        this.spawn("tower", 0, x, z);
        this.nav.rebuild(this.entities);
        this.updateVision();
        return;
      }
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
      shield: complete ? d.shield : 0,
      maxShield: d.shield,
      shieldDelay: 0,
      level: 1,
      levelJob: null,
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
      working: false,
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
  // Teams at war. In a coalition the AI teams (1+) are allies against the player.
  hostile(a, b) {
    return a !== b && a !== undefined && b !== undefined && !(this.coalition && a > 0 && b > 0);
  }
  isVisible(e, team = 0) {
    const [x, z] = this.nav.cellAt(e.x, e.z);
    return e.team === team || !!this.visible[team][z * this.terrain.grid + x];
  }
  isExplored(e, team = 0) {
    const [x, z] = this.nav.cellAt(e.x, e.z);
    return !!this.explored[team][z * this.terrain.grid + x];
  }
  updateVision() {
    for (let team = 0; team < this.players.length; team++) {
      this.visible[team].fill(0);
      for (const e of this.own(team)) {
        const [cx, cz] = this.nav.cellAt(e.x, e.z),
          r = Math.ceil(e.vision / 2);
        for (let z = Math.max(0, cz - r); z <= Math.min(this.terrain.grid - 1, cz + r); z++)
          for (
            let x = Math.max(0, cx - r);
            x <= Math.min(this.terrain.grid - 1, cx + r);
            x++
          ) {
            if (distance(e, this.nav.worldAt(x, z)) <= e.vision)
              this.visible[team][z * this.terrain.grid + x] = this.explored[team][
                z * this.terrain.grid + x
              ] = 1;
          }
      }
    }
    // Allied AIs pool what they see.
    if (this.coalition)
      for (let i = 0; i < this.visible[1].length; i++) {
        let seen = 0, known = 0;
        for (let team = 1; team < this.players.length; team++) { seen |= this.visible[team][i]; known |= this.explored[team][i]; }
        for (let team = 1; team < this.players.length; team++) { this.visible[team][i] = seen; this.explored[team][i] = known; }
      }
  }
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
        (!target || target.kind === "resource" || !this.hostile(e.team, target.team))
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
        ["gather", "build", "deliver", "repair"].includes(order.type) &&
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
  }
  enqueue(buildingId, type) {
    const b = this.get(buildingId),
      d = D[type];
    if (this.result || !b || !b.complete || !b.trains?.includes(type) || !d)
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
    if (!this.canPay(b.team, d.cost))
      return fail(`${this.resourceShortage(d.cost,b.team)} to train/research ${d.name}.`);
    const p = this.population(b.team);
    if (d.pop && p.used + p.reserved + d.pop > p.cap)
      return fail("Population limit reached. Build a Supply relay.");
    this.pay(b.team, d.cost);
    b.queue.push({ id: this.nextQueueId++, type, elapsed: 0 });
    this.message(`${d.name} queued.`, b.team);
    return true;
  }
  cancelQueue(id, index) {
    const b = this.get(id);
    if (this.result || !b || !Number.isInteger(index) || !b.queue[index])
      return false;
    this.pay(b.team, D[b.queue[index].type].cost, -1);
    b.queue.splice(index, 1);
    return true;
  }
  placement(type, team, x, z) {
    if (![x, z].every(Number.isFinite)) return "Invalid position.";
    const d = D[type];
    if (!d || d.kind !== "building") return "Invalid structure.";
    const missing = this.constructionRequirements(type,team);
    if (missing) return missing;
    const terrainError = this.terrain.placement(x, z, d.radius);
    if (terrainError) return terrainError;
    if (Math.abs(x) > this.terrain.half - d.radius - 2 || Math.abs(z) > this.terrain.half - d.radius - 2)
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
    if (this.result || !b || b.kind !== "building" || b.complete) return false;
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
    // Measure progress across frames. A fixed per-frame threshold falsely
    // marked healthy movement as stuck on high-refresh-rate displays.
    if (e.moveSample && distance(e, e.moveSample) < 0.1)
      e.stalled = (e.stalled || 0) + dt;
    else {
      e.stalled = 0;
      e.moveSample = { x: e.x, z: e.z };
    }
    if (e.stalled > 6) {
      this.finish(e);
      this.message(
        `${e.name} cannot reach its destination. Order cleared.`,
        e.team,
      );
      return false;
    }
    e.pathClock -= dt;
    if (e.pathClock <= 0 || e.pathRevision !== this.nav.revision) {
      e.path = this.nav.path(e, goal, e.radius);
      e.pathClock = 1.3 + (e.id % 7) * 0.08;
      e.pathRevision = this.nav.revision;
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
      return distance(e, goal) < 2.1 || !this.nav.canStand(goal.x, goal.z, e.radius);
    }
    const dx = next.x - e.x,
      dz = next.z - e.z,
      d = Math.hypot(dx, dz),
      step = Math.min(d, e.speed * dt);
    if (d < 0.0001) {
      e.path.shift();
      return false;
    }
    const nextPosition = { x: e.x + (dx / d) * step, z: e.z + (dz / d) * step };
    if (!this.nav.canTraverse(e, nextPosition, e.radius)) {
      e.moving = false;
      e.path = [];
      e.pathClock = 0;
      return false;
    }
    e.x = nextPosition.x;
    e.z = nextPosition.z;
    e.angle = Math.atan2(dx, dz);
    e.moving = true;
    return false;
  }
  finish(e) {
    e.working = false;
    e.orders.shift();
    this.resetWorkerRoute(e);
    e.target = null;
    e.work = 0;
  }
  resetWorkerRoute(e) {
    e.path = [];
    e.pathClock = 0;
    e.stalled = 0;
    e.moveSample = null;
  }
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
  }
  enemy(e, radius = e.vision, clearShot = false) {
    let best = null,
      bestD = radius;
    for (const t of this.entities) {
      if (t.hp <= 0 || !this.hostile(e.team, t.team) || !this.isVisible(t, e.team))
        continue;
      const d = distance(e, t) - t.radius;
      if (d <= bestD + 0.00001 && (!clearShot || this.nav.clearLine(e, t, t.id))) {
        best = t;
        bestD = d;
      }
    }
    return best;
  }
  // Static defenses shoot the nearest combat or support unit first, then Harvesters, and
  // buildings last, so a tower is never busy with a wall while troops destroy it.
  defenseTarget(e) {
    let best = null, bestRank = 3, bestD = Infinity;
    for (const t of this.entities) {
      if (t.hp <= 0 || !this.hostile(e.team, t.team) || !this.isVisible(t, e.team)) continue;
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
  }
  hit(e, target) {
    // Counter and anti-vehicle multipliers depend on each victim, including splash victims.
    const apply = (t, scale = 1) =>
      this.applyDamage(
        t,
        this.attackValue(e) * scale *
          (e.counter === t.type ? e.counter_bonus || 1.6 : 1) *
          (t.mechanical ? e.mechanical_bonus || 1 : 1),
        e.team,
      );
    apply(target);
    // Area weapons (balance.json splash_radius / splash_damage share) also hit nearby enemies.
    if (e.splash_radius)
      for (const t of this.entities)
        if (t.id !== target.id && this.hostile(e.team, t.team) && distance(t, target) < e.splash_radius)
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
  }
  fight(e, t, dt, chase = true) {
    if (
      !e.damage ||
      !t ||
      !Number.isFinite(t.hp) ||
      t.hp <= 0 ||
      !this.hostile(e.team, t.team) ||
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
  }
  noFiringPosition(e, t) {
    const f = e.firing;
    return !!f?.exhausted && f.target === t.id && f.revision === this.nav.revision &&
      Math.hypot(f.tx - t.x, f.tz - t.z) < 1;
  }
  // The nearest standable point with a clear shot on rings around the target, widest ring
  // first; each failed candidate moves on to the next ring. Returns null once every ring
  // failed, so an attack ends (attack-move passes on) instead of waiting forever.
  firingPosition(e, t) {
    const cached = e.firing;
    let attempt = 0;
    if (
      cached?.target === t.id &&
      cached.revision === this.nav.revision &&
      Math.hypot(cached.tx - t.x, cached.tz - t.z) < 1
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
  }
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
      e.working = true;
      e.angle = Math.atan2(t.x - e.x, t.z - e.z);
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
      if (e.carryType) this.players[e.team][e.carryType] += e.carry;
      e.carry = 0;
      e.carryType = null;
      this.resumeGathering(e, o);
    }
  }
  updateProduction(b, dt) {
    if (!b.complete || b.levelJob || !b.queue.length) return;
    const q = b.queue[0],
      d = D[q.type];
    q.elapsed += dt*(1+0.2*(b.level-1));
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
    // Supply lost after enqueueing must not let completed units bypass the cap.
    const population = this.population(b.team);
    if (population.used + d.pop > population.cap) {
      q.blocked = "Awaiting supply";
      return;
    }
    q.blocked = null;
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
    if (!pos) {
      q.blocked = "Exit blocked";
      return;
    }
    b.queue.shift();
    const u = this.spawn(q.type, b.team, pos.x, pos.z);
    // A rally point on a deposit sends new Harvesters straight to work.
    const deposit = b.rally?.target && this.get(b.rally.target);
    if (u.type === "worker" && deposit?.kind === "resource") this.issue([u.id], { type: "gather", target: deposit.id });
    else if (b.rally) this.issue([u.id], { type: "move", x: b.rally.x, z: b.rally.z });
    this.message(`${d.name} ready.`, b.team);
  }
  updateKnownCores(team) {
    const known = this.knownCores[team];
    for (const e of this.entities)
      if (e.hp > 0 && e.type === "hq" && this.hostile(team, e.team) && this.isVisible(e, team))
        known.set(e.id, { id: e.id, team: e.team, x: e.x, z: e.z });
    for (const [id, remembered] of known)
      if (this.players[remembered.team].eliminated || (this.isVisible(remembered, team) && !this.get(id)))
        known.delete(id);
  }
  scoutDestination(team) {
    const points = [], limit = this.terrain.half - 8;
    const coordinates = [];
    for (let value = -limit; value < limit; value += 18) coordinates.push(value);
    coordinates.push(limit);
    // Search unknown territory, including the outer edges, in alternating rows.
    for (const [row, z] of coordinates.entries()) {
      const line = [];
      for (const x of coordinates)
        if (this.nav.canStand(x, z, 1.05)) line.push({ x, z });
      points.push(...(row % 2 ? line.reverse() : line));
    }
    const index = this.scoutIndex[team]++;
    return points.length ? points[(index + team * 3) % points.length] : null;
  }
  updateAI(team = 1) {
    const own = this.own(team),
      workers = own.filter((e) => e.type === "worker"),
      army = own.filter((e) => e.kind === "unit" && e.type !== "worker");
    if (!own.some(e => e.type === "hq")) return;
    this.updateKnownCores(team);
    for (let i = 0; i < workers.length; i++) {
      const w = workers[i];
      if (w.orders.length) continue;
      const type = i % 4 === 0 ? "energy" : "alloy";
      const deposit = this.resources
        .filter((r) => r.amount > 0 && r.type === type && this.isExplored(r, team))
        .sort((a, b) => distance(w, a) - distance(w, b))[0];
      if (deposit) this.issue([w.id], { type: "gather", target: deposit.id });
    }
    const hq = own.find((e) => e.type === "hq" && e.complete) || own.find(e => e.type === "hq");
    const pace = this.pace, role = roleOf(this, team);
    if (hq && workers.length < pace.workers && hq.queue.length < 1)
      this.enqueue(hq.id, "worker");
    // Resume construction whose builder died or gave up on its route. Otherwise one
    // abandoned site blocks every later AI structure, including supply relays.
    for (const site of own.filter((e) => e.kind === "building" && !e.complete)) {
      if (workers.some((w) => w.orders.some((o) => o.type === "build" && o.target === site.id)))
        continue;
      // Retries count reassignments that made no progress: builders killed mid-way on a
      // reachable site never exhaust them, while an unreachable site is given up.
      if (site.progress > (site.aiProgress ?? -1)) {
        site.aiProgress = site.progress;
        site.aiRetries = 0;
      }
      const builder = workers
        .filter((w) => !w.orders.some((o) => o.type === "build"))
        .sort((a, b) => distance(a, site) - distance(b, site))[0];
      if (!builder) continue;
      if (++site.aiRetries > 3) {
        this.cancelBuilding(site.id);
        continue;
      }
      this.issue([builder.id], { type: "build", target: site.id });
    }
    const pop = this.population(team);
    const want = !own.some((e) => e.type === "barracks")
      ? "barracks"
      : pop.cap - pop.used - pop.reserved < 5 && pop.cap < MAX_POP
        ? "relay"
        : !own.some((e) => e.type === "foundry") && this.time > pace.foundryAt * (role === "siege" ? 0.6 : 1)
          ? "foundry"
          : pace.secondBarracks && this.time > pace.secondBarracks && own.filter((e) => e.type === "barracks").length < 2
            ? "barracks"
            : this.time > pace.towerAt && own.some((e) => e.type === "foundry" && e.complete) &&
                own.filter((e) => e.type === "tower").length < pace.towers + (role === "siege" ? 1 : 0)
              ? "tower"
              : null;
    if (
      want &&
      this.canPay(team, D[want].cost) &&
      !own.some((e) => !e.complete) &&
      workers.length
    ) {
      // Towers go on the side facing the map centre; other buildings anywhere around the core.
      const facing = want === "tower" && hq ? Math.atan2(-hq.z, -hq.x) : 0;
      const turns = want === "tower" ? [0, 1, -1, 2, -2, 3, -3] : [...Array(12).keys()];
      outer: for (const r of want === "tower" ? [11, 14, 17] : [10, 17, 23])
        for (const i of turns) {
          const angle = want === "tower" ? facing + i * 0.35 : (i / 12) * Math.PI * 2;
          const x = (hq?.x ?? 25) + Math.cos(angle) * r,
            z = (hq?.z ?? -24) + Math.sin(angle) * r;
          if (!this.placement(want, team, x, z)) {
            if (this.build(workers[0].id, want, x, z)) break outer;
          }
        }
    }
    if (this.time > pace.techAt[0] && hq && workers.length >= Math.min(9, pace.workers) && hq.level < (this.time > pace.techAt[1] ? 3 : 2) && !hq.queue.length) this.upgradeBuilding(hq.id,team);
    for (const b of own.filter(
      (e) => e.complete && ["barracks", "foundry"].includes(e.type),
    )) {
      if (b.levelJob) continue;
      if (b.level < this.techLevel(team) && this.time > pace.upgradeAt && this.canPay(team,this.levelCost(b))) {
        if (!b.queue.length) this.upgradeBuilding(b.id,team);
        continue;
      }
      if (b.queue.length < 2) {
        // One Vanguard per two Rangers; a raider AI trains two Vanguards per Ranger.
        const cycle = Math.floor(this.time/4)%3;
        let choice = b.type === 'foundry' ? 'breaker' : cycle === 0 || (role === 'raider' && cycle === 1) ? 'vanguard' : 'ranger';
        if (b.type === 'foundry' && b.level >= 3 && army.filter(e => e.type === 'tank').length <= army.filter(e => e.type === 'breaker').length + (role === 'siege' ? 2 : 0)) choice = 'tank';
        if (b.type === 'barracks' && b.level >= 2 && army.filter(e => e.type === 'antitank').length < 3) choice = 'antitank';
        const support = b.type === 'foundry' ? 'engineer' : 'medic';
        if (b.level >= 2 && army.filter(e => e.type === support).length < 2) choice = support;
        const choices = [...new Set([choice,...(b.type === 'barracks' ? ['ranger','vanguard'] : ['breaker'])])];
        const pop = this.population(team);
        const affordable = choices.find(type => b.level >= (D[type].required_level || 1) && this.canPay(team,D[type].cost) && pop.used+pop.reserved+D[type].pop <= pop.cap);
        if (affordable) this.enqueue(b.id,affordable);
      }
    }
    const threats = hq
      ? this.entities
          .filter((e) => this.hostile(team, e.team) && e.hp > 0 && this.isVisible(e, team) && distance(hq, e) < 25)
          .sort((a, b) => distance(hq, a) - distance(hq, b))
      : [];
    const threatIds = new Set(threats.map((e) => e.id));
    const engaged = (e) => e.orders[0]?.type === "attack" && threatIds.has(e.orders[0].target);
    let incursion = false;
    if (threats.length) {
      const power = threats.reduce(
        (sum, e) => sum + (e.kind === "building" ? 4 : e.type === "worker" ? 0.5 : e.pop || 1),
        0,
      );
      incursion = power >= 4;
      const ready = army.filter(
        (e) => e.damage > 0 && (!e.orders.length || e.orders[0].type !== "attack"),
      );
      // A real incursion recalls everyone. A lone scout or harvester is answered by units
      // near the core, or the two closest units if none are home, and never recalls a wave.
      const home = ready.filter((e) => distance(e, hq) < 40);
      const answer = incursion
        ? ready
        : home.length
          ? home
          : ready.sort((a, b) => distance(a, hq) - distance(b, hq)).slice(0, 2);
      if (answer.length)
        this.issue(answer.map((e) => e.id), { type: "attack", target: threats[0].id });
    }
    const wave = army.filter((e) => !engaged(e));
    if (this.coalition) {
      this.coalitionOrders(team, { hq, army, wave, incursion });
      return;
    }
    if (!incursion && this.time >= this.waveAt[team] && wave.length >= pace.minWave) {
      const target = [...this.knownCores[team].values()]
        .sort((a, b) => distance(hq, a) - distance(hq, b))[0] || this.scoutDestination(team);
      if (target) this.issue(wave.map(e => e.id), { type: "attackmove", x: target.x, z: target.z });
      this.waveAt[team] = this.time + pace.waveGap;
    }
  }
  tick(dt) {
    if (this.result || !Number.isFinite(dt) || dt <= 0) return;
    this.time += dt;
    this.visionClock -= dt;
    if (this.visionClock <= 0) {
      this.updateVision();
      this.visionClock = 0.25;
    }
    for (const e of this.entities) {
      if (e.hp <= 0) continue;
      e.cooldown -= dt;
      e.shieldDelay = Math.max(0,e.shieldDelay-dt);
      if (e.complete && e.shieldDelay <= 0) e.shield = Math.min(e.maxShield,e.shield+4*dt);
      e.moving = false;
      e.attacking = false;
      e.working = false;
      if (e.kind === "building") {
        this.updateLevel(e,dt);
        this.updateProduction(e, dt);
        if (e.complete && e.damage)
          this.fight(e, this.defenseTarget(e), dt, false);
        continue;
      }
      if (e.support) { this.updateSupport(e,dt); continue; }
      const o = e.orders[0];
      if (o?.type === 'patrol' && !o.origin) o.origin = { x: e.x, z: e.z };
      // Explicit Move orders take priority so units can retreat and kite.
      if (e.type !== "worker" && e.damage > 0 && (!o || ['attackmove', 'patrol'].includes(o.type))) {
        const target = this.enemy(e, e.range, true);
        if (target) {
          this.fight(e, target, dt, false);
          // Combat suspends the route; retain queued orders and replan on resume.
          e.stalled = 0;
          e.moveSample = null;
          e.pathClock = 0;
          continue;
        }
      }
      if (!o) continue;
      if (["gather", "build", "deliver", "repair"].includes(o.type)) {
        this.updateWorker(e, o, dt);
        continue;
      }
      if (o.type === "attack") {
        const t = this.get(o.target);
        if (!this.fight(e, t, dt)) {
          if (t && this.noFiringPosition(e, t))
            this.message(`${e.name} has no clear line of fire on that target. Order cleared.`, e.team);
          this.finish(e);
        }
      } else if (o.type === "attackmove") {
        // A target with no reachable firing position is passed by; the advance continues.
        const t = this.enemy(e, 12);
        if ((!t || !this.fight(e, t, dt)) && this.move(e, o, dt, 1.2)) this.finish(e);
      } else if (o.type === 'patrol') {
        if (this.move(e, o, dt, 1.2)) {
          // A queued follow-up takes over at the next endpoint. Otherwise loop.
          if (e.orders.length > 1) this.finish(e);
          else {
            const destination = { x: o.x, z: o.z };
            Object.assign(o, o.origin);
            o.origin = destination;
            this.resetWorkerRoute(e);
          }
        }
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
        if (this.nav.canStand(a.x + nx * push, a.z + nz * push, a.radius)) {
          a.x += nx * push;
          a.z += nz * push;
        }
        if (this.nav.canStand(b.x - nx * push, b.z - nz * push, b.radius)) {
          b.x -= nx * push;
          b.z -= nz * push;
        }
      }
    if (this.aiEnabled) {
      this.aiClock -= dt;
      if (this.aiClock <= 0) {
        for (let team = 1; team < this.players.length; team++) this.updateAI(team);
        if (this.coalition) this.advanceCoalition();
        this.aiClock = this.pace.think;
      }
    }
    const alive = this.players.map((_, team) =>
      this.own(team).some((e) => e.type === "hq"),
    );
    let eliminated = false;
    for (let team = 0; team < this.players.length; team++) {
      if (alive[team] || this.players[team].eliminated) continue;
      this.players[team].eliminated = true;
      for (const e of this.own(team)) {
        // Surrender removes the faction without awarding unearned combat kills.
        e.hp = 0;
        e.orders = [];
        e.queue = [];
        e.levelJob = null;
      }
      this.message(team === 0 ? "Your expedition has been eliminated." : `Enemy ${team} eliminated: all Command cores destroyed.`);
      eliminated = true;
    }
    if (eliminated) {
      this.nav.rebuild(this.entities);
      this.updateVision();
    }
    const enemiesAlive = alive.slice(1).some(Boolean);
    if (!alive[0] || !enemiesAlive)
      this.result =
        !alive[0] && !enemiesAlive ? "draw" : alive[0] ? "victory" : "defeat";
    // Retain only live simulation objects; selection and orders use stable IDs.
    this.entities = this.entities.filter((e) => e.hp > 0);
  }
}

Object.assign(Simulation.prototype, progression, coalitionPlan);
