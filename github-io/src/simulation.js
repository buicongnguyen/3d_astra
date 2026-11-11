import { DEFINITIONS as D, ROCKS, MAX_POP, distance, hyp, clamp } from "./data.js";
import { NEUTRAL, CORE_GRACE, ROUTES_PER_TICK, MIDFIELD_DEPOSITS } from "./sim/constants.js";
import { factionRules, normalizedFactions } from "./factions.js";
import { traits } from "./sim/traits.js";
import { difficultyId, difficultySpeed } from "./difficulty.js";
import { Navigation } from "./navigation.js";
import { progression } from "./progression.js";
import { AI_SPEEDS, aiPace, coalitionPlan } from "./ai-plan.js";
import { Terrain } from "./terrain.js";
import { commands } from "./commands.js";
import { snapshot, restore } from "./snapshot.js";
import { vision } from "./sim/vision.js";
import { orders } from "./sim/orders.js";
import { movement } from "./sim/movement.js";
import { combat } from "./sim/combat.js";
import { economy } from "./sim/economy.js";
import { ai } from "./sim/ai.js";
import { aiCounter } from "./sim/ai-counter.js";
import { missions } from "./sim/missions.js";
import { tactics } from "./sim/tactics.js";
import { points } from "./sim/points.js";
import { expansion } from "./sim/expand.js";

export { NEUTRAL } from "./sim/constants.js";
// The match state and its fixed 20 Hz step. Behaviour lives in the systems under sim/, mixed
// in at the bottom of this file; this class holds setup, shared lookups and the step order.
export class Simulation {
  constructor({ ai = true, map = "classic", enemyCount = 1, aiSpeed = "normal", alliance = "ffa", playerBonus = null, mission = null, factions = null, difficulty = "standard", capturePoints = false, aiPlayer = false } = {}) {
    this.difficulty = difficultyId(difficulty);
    if (mission) aiSpeed = difficultySpeed(aiSpeed, this.difficulty);
    this.aiEnabled = ai;
    this.entities = [];
    this.resources = [];
    this.nextId = 1;
    this.nextQueueId = 1;
    this.time = 0;
    // Whole steps taken; commands are logged against it (see commands.js).
    this.ticks = 0;
    // Route searches still allowed this tick (see move()); unlimited outside tick().
    this.routeBudget = Infinity;
    this.commandLog = [];
    this.enemyCount = Number.isInteger(enemyCount) ? clamp(enemyCount, 1, 3) : 1;
    this.factions = normalizedFactions(factions,mission,this.enemyCount);
    this.aiSpeed = Object.hasOwn(AI_SPEEDS, aiSpeed) ? aiSpeed : "normal";
    this.pace = aiPace(this.aiSpeed, !!mission);
    // A coalition of AIs shares vision and plans and never fights itself.
    this.coalition = alliance === "coalition" && this.enemyCount > 1;
    this.players = Array.from({ length: this.enemyCount + 1 }, () => ({
      alloy: 450,
      energy: 150,
      upgrade: false,
      plating: false,
      upgrade2: false,
      plating2: false,
      kills: 0,
      eliminated: false,
    }));
    this.events = [];
    // What each AI team has seen of the enemy army (id -> type); see sim/ai-counter.js.
    this.intel = this.players.map(() => new Map());
    this.result = null;
    this.terrain = new Terrain(map);
    this.nav = new Navigation(this.terrain);
    // Headless balance runs only (tools/faction-bench.mjs): the computer also plays team 0.
    if (aiPlayer && ai) this.aiPlayer = true;
    this.aiClock = 0;
    this.aiTurn = 0;
    this.waveAt = this.players.map((_, team) => (mission ? this.pace : this.paceFor(team)).firstWave + Math.max(0, team - 1) * 15);
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
      for (const e of this.own(0)) this.spawn(this.slotOf(e.type), team, e.x * sx, e.z * sz);
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
    // More contested deposits in the middle lanes of every map, mirrored for fairness.
    for (const side of [1, -1]) {
      for (const [type, x, z, amount] of MIDFIELD_DEPOSITS) {
        // Extra rival bases (two or three enemies) take precedence over a midfield deposit.
        if (this.entities.some((e) => e.kind === "building" && hyp(e.x - x * side, e.z - z * side) < e.radius + 6)) continue;
        this.resource(type, x * side, z * side, amount);
      }
    }
    // Concrete walls stand where the boulders were (see spawnWall).
    for (const [x, z, r] of ROCKS) this.spawnWall(x, z, r);
    // Initial deployment locations are public; later cores require scouting.
    this.knownCores = this.players.map((_, team) => new Map(this.entities
      .filter(e => e.type === "hq" && this.hostile(team, e.team))
      .map(e => [e.id, { id: e.id, team: e.team, x: e.x, z: e.z }])));
    this.scoutIndex = this.players.map(() => 0);
    this.nav.rebuild(this.entities);
    this.updateVision();
    this.playerBonus = playerBonus;
    if (playerBonus) this.reinforce(playerBonus);
    this.capturePointsOn = capturePoints && !mission;
    this.skirmishPoints = {};
    if (this.capturePointsOn) this.initSkirmishPoints();
    if (mission) this.initMission(mission);
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
  spawn(type, team, x, z, complete = true, exact = false) {
    if (!exact) type = this.typeFor(team,type);
    const d = D[type];
    if (!d) throw new Error(`Unknown unit or building: ${type}`);
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
    if (d.trains) e.trains = this.resolvedTrains(team,d.trains);
    this.traitSpawn(e);
    this.entities.push(e);
    return e;
  }
  // Concrete walls: neutral obstacles that block movement and fire until enough shots bring
  // them down. Nothing auto-targets them; players attack them with an explicit order.
  spawnWall(x, z, radius) {
    const hp = Math.round(260 * radius);
    const e = {
      type: "wall", kind: "wall", name: "Concrete wall", id: this.nextId++, team: NEUTRAL, x, z, radius,
      description: "Reinforced concrete. Blocks movement and fire; attack it to break through.",
      hp, maxHp: hp, shield: 0, maxShield: 0, shieldDelay: 0, level: 1, levelJob: null, complete: true, progress: 1,
      orders: [], path: [], pathClock: 0, cooldown: 0, target: null, carry: 0, carryType: null, resource: null,
      queue: [], rally: null, angle: 0, moving: false, work: 0, working: false, vision: 0,
    };
    this.entities.push(e);
    return e;
  }
  // Explicit attack orders may target enemies or neutral walls.
  attackable(team, t) {
    return !!t && (this.hostile(team, t.team) || t.team === NEUTRAL);
  }
  // Live entity or unspent deposit by id. Ids are unique across both lists; the lookup table
  // is rebuilt whenever either list changes (the entity list is replaced every tick).
  get(id) {
    if (this.lookupFor !== this.entities || this.lookupSize !== this.entities.length + this.resources.length) {
      this.lookup = new Map();
      for (const r of this.resources) this.lookup.set(r.id, r);
      for (const e of this.entities) this.lookup.set(e.id, e);
      this.lookupFor = this.entities;
      this.lookupSize = this.entities.length + this.resources.length;
    }
    const e = this.lookup.get(id);
    return e && (e.kind === "resource" ? e.amount > 0 : e.hp > 0) ? e : undefined;
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
  setAiSpeed(speed) {
    if (!Object.hasOwn(AI_SPEEDS, speed)) return;
    this.aiSpeed = speed;
    this.pace = aiPace(speed, !!this.mission);
  }
  hostile(a, b) {
    return a !== b && a >= 0 && b >= 0 && !(this.coalition && a > 0 && b > 0);
  }
  tick(dt) {
    if (this.result || !Number.isFinite(dt) || dt <= 0) return;
    this.time += dt;
    this.ticks++;
    this.routeBudget = ROUTES_PER_TICK;
    // Events raised from here on belong to this tick (mission triggers read them).
    this.tickEvents = this.events.length;
    this.visionClock -= dt;
    if (this.visionClock <= 0) {
      this.updateVision();
      this.visionClock = 0.25;
    }
    for (const e of this.entities) if (e.hp > 0) this.stepEntity(e, dt);
    this.separate(dt);
    this.stepTactics(dt);
    this.stepTraits(dt);
    this.stepAI(dt);
    this.stepMission(dt);
    this.stepSkirmishPoints(dt);
    this.settle();
  }
  // One entity's turn: timers, then its building, support or order behaviour.
  stepEntity(e, dt) {
    e.cooldown -= dt;
    e.shieldDelay = Math.max(0,e.shieldDelay-dt);
    if (e.complete && e.shieldDelay <= 0) e.shield = Math.min(e.maxShield,e.shield+4*dt*(e.shieldRate||1));
    e.moving = false;
    e.attacking = false;
    e.working = false;
    if (e.kind === "building") {
      this.updateLevel(e,dt);
      this.updateProduction(e, dt);
      if (e.complete && e.damage)
        this.fight(e, this.defenseTarget(e), dt, false);
      return;
    }
    if (e.support) { this.updateSupport(e,dt); return; }
    const o = e.orders[0];
    if (o?.type === 'patrol' && !o.origin) o.origin = { x: e.x, z: e.z };
    // Explicit Move orders take priority so units can retreat and kite.
    // Soldiers on a repair job still shoot back at an enemy in range, then carry on repairing.
    if (e.type !== "worker" && e.damage > 0 && (!o || ['attackmove', 'patrol', 'repair'].includes(o.type))) {
      const target = this.enemy(e, e.range, true);
      if (target) {
        this.fight(e, target, dt, false);
        // Combat suspends the route; retain queued orders and replan on resume.
        e.stalled = 0;
        e.moveSample = null;
        e.pathClock = 0;
        return;
      }
    }
    if (!o) {
      if (e.kind === "unit" && e.type !== "worker" && e.damage > 0) this.holdPost(e, dt);
      return;
    }
    e.post = null;
    if (["gather", "build", "deliver", "repair"].includes(o.type)) {
      this.updateWorker(e, o, dt);
      return;
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
      let t = this.enemy(e, 12);
      // A chase that stalls (no path to the target) is dropped for a while so the advance resumes.
      if (t && o.skip && o.skip.id === t.id && this.time < o.skip.until) t = null;
      if (t && e.stalled > 3) {
        o.skip = { id: t.id, until: this.time + 8 };
        e.stalled = 0;
        e.path = [];
        t = null;
      }
      if ((!t || !this.fight(e, t, dt)) && this.move(e, o, dt, 1.2)) this.finish(e);
    } else if (o.type === 'patrol') {
      // A patrol answers whoever shoots at it, then picks its route up again.
      const t = this.attacker(e);
      if (t && e.stalled <= 3 && this.fight(e, t, dt)) return;
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
  // Eliminations and the match result, then dead entities leave the list.
  settle() {
    // A finished core keeps a team in the match. A core still under construction buys it
    // CORE_GRACE seconds to finish one, so a hidden foundation cannot stall the ending.
    const alive = this.players.map((p, team) => {
      // A mission can field the player without a base: the squad is the side.
      if (team === 0 && this.mission && !this.mission.rules.playerBase) return this.own(0).some((e) => e.kind === "unit");
      const cores = this.own(team).filter((e) => e.type === "hq");
      if (cores.some((e) => e.complete)) return ((p.coreLostAt = null), true);
      if (!cores.length) return false;
      return this.time - (p.coreLostAt ??= this.time) < CORE_GRACE;
    });
    let eliminated = false;
    for (let team = 0; team < this.players.length; team++) {
      if (alive[team] || this.players[team].eliminated) continue;
      this.players[team].eliminated = true;
      for (const e of this.own(team)) {
        // Mission-tagged objects of an eliminated enemy stay standing: objectives such as
        // "destroy the siphons" must be won by destroying them, not by killing the core.
        if (e.tag && team !== 0 && this.mission) { e.orders = []; e.queue = []; e.levelJob = null; continue; }
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
    if (this.mission) this.result = this.missionResult(alive);
    else if (!alive[0] || !enemiesAlive)
      this.result =
        !alive[0] && !enemiesAlive ? "draw" : alive[0] ? "victory" : "defeat";
    // Retain only live simulation objects; selection and orders use stable IDs.
    this.entities = this.entities.filter((e) => e.hp > 0);
  }
}

Object.assign(Simulation.prototype, factionRules, traits, points, expansion, vision, orders, movement, combat, economy, ai, aiCounter, missions, tactics, progression, coalitionPlan, commands, snapshot);
Simulation.load = (saved) => restore(Simulation, saved);
