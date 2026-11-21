// Wild frontier, Phase 1: the desert test (AAA round 4; docs/aaa/AAA_ROUND4_PLAN.md, "P1").
// A skirmish with the Battle rule `wild: "on"` on a Wild land (balance.json `wild_frontier.lands`; P1:
// Amber Dunes only) gets two things to fight over:
//
//   * the Weather Spire, a capture ring near the centre (it is `sim.skirmishPoints.spire`, so the ring
//     mechanics, the ring view and the minimap come for free). Its holder may call ONE weather power, the
//     Sandstorm, on any spot: a 3 s warning that every side sees, then 18 s of storm. Inside it the
//     holder's enemies reload 43% slower (fire 30% slower: status `sandblind`) and see only 4 m around
//     their own units, so the holder's units inside are hidden from them. The Spire then recharges for
//     90 s, and a new holder waits at least 15 s ("arming") before its first storm.
//   * the Dune Wyrm nest, guarded by three Wyrmlings (WILD_TEAM: every side may fight them, they bite
//     whatever comes within 8 m of the nest and never leave it). Once they are dead, one side alone in
//     the nest for 30 s tames a Dune Wyrm (at most one living Wyrm per side). The nest then regrows its
//     guards after 150 s. The Wyrm's one ability, Ambush, casts on its own: it dives and bursts up under
//     the nearest enemy vehicle after a 1.5 s ripple that anyone can see (and dodge).
//
// The computer plays it by speed (owner rule, round 4 section 2): Relaxed never (no spire crew, no
// weather, no taming: the sim refuses its taming), Normal late and rarely, Fast and Relentless fully
// (balance.json `wild_frontier.ai`, keyed by AI speed; a speed with no entry does nothing).
//
// State, created only by initWild() in a match with the rule (simulation.js constructor):
//   sim.wild = { land, readyAt, owner, storms: [{ team, x, z, r, at, until }], nest|null, stats, ai? }
//   sim.skirmishPoints.spire = { x, z, r, owner, taker, since, wild: "spire", gives? }
//   on guards: e.lair (home spot), e.wildTarget; on a Wyrm: e.burrow while it is under the sand
// Every hook returns at its first line in every other match, so every pin stays as it was.
import balance from "../../balance.json" with { type: "json" };
import { DEFINITIONS as D, distance, hyp } from "../../data.js";
import { WILD_TEAM } from "../constants.js";

export const WILD = balance.wild_frontier;
// Decisions (targets, the nest, storm effects) every THINK ticks (0.5 s); movement and bites every tick.
const THINK = 10;
const STEP_SECONDS = THINK * 0.05;

// The Wild land of this match's map, or null.
export const wildLand = (sim) => WILD.lands[sim.terrain?.id] || null;
// The computer's plan at this match speed (null: Relaxed, never).
export const wildPlan = (sim) => WILD.ai[sim.aiSpeed] || null;
// A human seat (team 0 when the computer does not play it) always may; a computer side only by its plan.
const human = (sim, team) => team === 0 && !sim.aiPlayer;
// A side may tame when it is under the Wyrm cap and (for the computer) its plan has reached the nest time.
export function canTame(sim, team) {
  const land = wildLand(sim);
  if (!land || team < 0) return false;
  if (!human(sim, team)) {
    const plan = wildPlan(sim);
    if (!plan || sim.time < plan.nest) return false;
  }
  return sim.entities.filter((e) => e.hp > 0 && e.team === team && e.type === land.creature).length < WILD.nest.cap;
}
// The storm active at `p` against `team` (a storm called by one of `team`'s enemies), or null.
export function stormOn(sim, p, team) {
  for (const s of sim.wild?.storms || []) if (sim.time >= s.at && sim.time < s.until && sim.hostile(team, s.team) && hyp(p.x - s.x, p.z - s.z) <= s.r) return s;
  return null;
}
// Spire state for the interface: { held, owner, ready, readyIn, arming } for `team`.
export function spireState(sim, team = 0) {
  const w = sim.wild, spire = sim.skirmishPoints?.spire;
  if (!w || !spire) return null;
  const held = spire.owner === team, readyIn = Math.max(0, w.readyAt - sim.time);
  return { held, owner: spire.owner, ready: held && readyIn <= 0, readyIn, x: spire.x, z: spire.z, radius: WILD.sandstorm.radius };
}

const groundFoe = (sim, team, t) => t.hp > 0 && !t.flying && t.team >= 0 && sim.hostile(team, t.team);
// The nearest enemy vehicle `e` sees within `range` (Ambush's target), or null.
export function ambushTarget(sim, e, range) {
  let best = null, bestD = Infinity;
  for (const t of sim.entities) {
    if (t.kind !== "unit" || !t.mechanical || t.boss || !groundFoe(sim, e.team, t) || !sim.isVisible(t, e.team)) continue;
    const d = distance(e, t);
    if (d <= range && d < bestD) { best = t; bestD = d; }
  }
  return best;
}
// The nearest spot within 4 m where a body of radius `r` can stand, or null.
function standNear(sim, x, z, r) {
  if (sim.nav.canStand(x, z, r)) return { x, z };
  for (let ring = 1; ring <= 4; ring++)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, p = { x: x + Math.cos(a) * ring, z: z + Math.sin(a) * ring };
      if (sim.nav.canStand(p.x, p.z, r)) return p;
    }
  return null;
}

function spawnGuards(sim) {
  const land = wildLand(sim), nest = sim.wild.nest;
  nest.guards = [];
  for (let i = 0; i < WILD.nest.guards; i++) {
    const a = (i / WILD.nest.guards) * Math.PI * 2 + 0.4;
    const spot = standNear(sim, nest.x + Math.cos(a) * 2.4, nest.z + Math.sin(a) * 2.4, D[land.guard].radius) || { x: nest.x, z: nest.z };
    const g = sim.spawn(land.guard, WILD_TEAM, spot.x, spot.z, true, true);
    g.stance = "hold";
    g.lair = { x: spot.x, z: spot.z };
    g.angle = a;
    nest.guards.push(g.id);
  }
}

// The nearest ground unit of any side within the nest's reach (guards never chase past it), or null.
function guardTarget(sim, g, nest) {
  let best = null, bestD = Infinity;
  for (const t of sim.entities) {
    if (t.hp <= 0 || t.kind !== "unit" || t.flying || t.team < 0 || t.cloaked) continue;
    if (distance(t, nest) > WILD.nest.aggro + t.radius) continue;
    const d = distance(g, t);
    if (d < bestD) { best = t; bestD = d; }
  }
  return best;
}
const guardValid = (t, nest) => !!t && t.hp > 0 && !t.flying && !t.cloaked && distance(t, nest) <= WILD.nest.aggro + t.radius;

function stepGuards(sim, nest, dt, think) {
  for (const id of nest.guards) {
    const g = sim.get(id);
    if (!g) continue;
    let t = g.wildTarget != null ? sim.get(g.wildTarget) : null;
    if (think || !guardValid(t, nest)) {
      t = guardTarget(sim, g, nest);
      g.wildTarget = t ? t.id : null;
    }
    if (t) {
      if (distance(g, t) <= g.range + t.radius + 0.00001) {
        g.attacking = true;
        g.angle = Math.atan2(t.x - g.x, t.z - g.z);
        if (g.cooldown <= 0) {
          sim.applyDamage(t, g.damage, WILD_TEAM, g.id);
          g.cooldown = g.interval;
          sim.events.push({ type: "shot", weapon: g.type, unit: g.type, source: g.id, target: t.id, x: g.x, z: g.z, tx: t.x, tz: t.z, team: WILD_TEAM, heavy: false });
        }
      } else sim.move(g, sim.approach(g, t, Math.max(1, g.range * 0.7)), dt);
    } else if (distance(g, g.lair) > 1) sim.move(g, g.lair, dt, 1);
    else if (g.hp < g.maxHp) g.hp = Math.min(g.maxHp, g.hp + g.maxHp * WILD.nest.regen * dt);
  }
}

// The nest, every THINK ticks: guards down opens it; one side alone in it tames; a tamed nest regrows.
function stepNest(sim, nest) {
  const land = wildLand(sim);
  if (nest.state === "guarded") {
    nest.guards = nest.guards.filter((id) => sim.get(id));
    if (!nest.guards.length) {
      nest.state = "open";
      nest.taker = null;
      nest.since = 0;
      sim.events.push({ type: "wild", kind: "nestOpen", x: nest.x, z: nest.z });
      sim.message("The Wyrm nest is clear: hold it for 30 seconds to tame a Dune Wyrm.");
    }
    return;
  }
  if (nest.state === "regrow") {
    if (sim.time >= nest.regrowAt) {
      nest.state = "guarded";
      spawnGuards(sim);
      sim.events.push({ type: "wild", kind: "nestGuarded", x: nest.x, z: nest.z });
    }
    return;
  }
  // Open: who stands in it (fighters on the ground; allied computer sides count as one).
  const present = [];
  for (const e of sim.entities) if (e.hp > 0 && e.kind === "unit" && e.damage > 0 && e.type !== "worker" && !e.flying && e.team >= 0 && distance(e, nest) <= nest.r && !present.includes(e.team)) present.push(e.team);
  const sides = present.filter((team, i) => !present.slice(0, i).some((other) => !sim.hostile(team, other)));
  if (!sides.length) { nest.taker = null; nest.since = 0; return; }
  // Contested: the taming pauses.
  if (sides.length > 1) return;
  const team = sides[0];
  if (!canTame(sim, team)) { nest.taker = null; nest.since = 0; return; }
  if (nest.taker !== team) { nest.taker = team; nest.since = 0; }
  nest.since += STEP_SECONDS;
  if (nest.since + 1e-9 < WILD.nest.tame) return;
  const spot = standNear(sim, nest.x, nest.z, D[land.creature].radius) || { x: nest.x, z: nest.z };
  const wyrm = sim.spawn(land.creature, team, spot.x, spot.z, true, true);
  nest.state = "regrow";
  nest.regrowAt = sim.time + WILD.nest.regrow;
  nest.taker = null;
  nest.since = 0;
  sim.wild.stats.tamed[team] = (sim.wild.stats.tamed[team] || 0) + 1;
  sim.events.push({ type: "wild", kind: "tamed", team, id: wyrm.id, x: spot.x, z: spot.z });
  sim.message(team === 0 ? "A Dune Wyrm joins your expedition." : "An enemy has tamed the Dune Wyrm.");
}

// A Wyrm under the sand stays hidden; when its ripple is over it bursts up and bites everything near.
function stepWyrms(sim, land, think) {
  const a = D[land.creature].ability;
  for (const e of sim.entities) {
    if (e.type !== land.creature || e.hp <= 0) continue;
    if (e.burrow) {
      e.cloaked = true;
      e.seenBy = 0;
      if (sim.time + 1e-9 < e.burrow.at) continue;
      const spot = standNear(sim, e.burrow.x, e.burrow.z, e.radius);
      if (spot) { e.x = spot.x; e.z = spot.z; }
      e.path = [];
      e.post = { x: e.x, z: e.z };
      e.stalled = 0;
      delete e.burrow;
      sim.uncloak(e);
      const start = sim.events.length;
      for (const t of sim.entities)
        if (groundFoe(sim, e.team, t) && (t.kind === "unit" || t.kind === "building") && distance(t, e) - (t.kind === "unit" ? 0 : t.radius) <= a.radius)
          sim.applyDamage(t, a.damage * (t.kind === "unit" ? 1 : 0.5), e.team, e.id);
      sim.events.push({ type: "wild", kind: "ambush", id: e.id, team: e.team, x: e.x, z: e.z, radius: a.radius, kills: sim.events.slice(start).filter((ev) => ev.type === "death").length });
      continue;
    }
    // Ambush casts on its own for every side (owner: one ability, autocast, no extra button needed).
    if (think && sim.abilityReady(e)) {
      const t = ambushTarget(sim, e, a.range);
      if (t) sim.useAbility(e, { x: t.x, z: t.z });
    }
  }
}

// Storms: the holder's enemies inside reload slower (a short status renewed every THINK ticks).
function stepStorms(sim) {
  const w = sim.wild;
  if (!w.storms.length) return;
  w.storms = w.storms.filter((s) => sim.time < s.until);
  for (const s of w.storms) {
    if (sim.time < s.at) continue;
    if (!s.started) {
      s.started = true;
      sim.events.push({ type: "wild", kind: "stormStart", team: s.team, x: s.x, z: s.z, r: s.r, until: s.until });
      // The storm's cover starts at once (vision is otherwise refreshed every 0.25 s).
      sim.updateVision();
    }
    for (const e of sim.entities)
      if (e.hp > 0 && e.damage > 0 && e.team >= 0 && sim.hostile(s.team, e.team) && !e.flying && hyp(e.x - s.x, e.z - s.z) <= s.r + (e.radius || 0))
        sim.applyStatus(e, "sandblind", STEP_SECONDS * 2);
  }
}

// The Spire changing hands: count it, and arm the new holder's power.
function stepSpire(sim) {
  const w = sim.wild, spire = sim.skirmishPoints.spire;
  if (!spire || spire.owner === w.owner) return;
  w.owner = spire.owner;
  w.stats.flips++;
  if (w.owner !== null) w.readyAt = Math.max(w.readyAt, sim.time + WILD.spire.arm);
  sim.events.push({ type: "wild", kind: "spire", owner: w.owner, x: spire.x, z: spire.z });
  if (w.owner === 0) sim.message("You hold the Weather Spire: the Sandstorm power arms in 15 seconds.");
  // A rival with no weather plan at this speed (Relaxed) may walk through the ring but never calls a storm.
  else if (w.owner !== null) sim.message(wildPlan(sim) ? "An enemy holds the Weather Spire: expect a sandstorm." : "An enemy holds the Weather Spire.");
}

// ---- Computer play (AI rule H19), by the speed's plan; Relaxed has none and never runs any of this.
function sendDuty(sim, units, duty, at) {
  for (const e of units) e.pointDuty = duty;
  if (units.length) sim.issue(units.map((e) => e.id), { type: "attackmove", x: at.x, z: at.z });
}
function spareUnits(sim, army, hq) {
  return army.filter((e) => !e.pointDuty && !e.orders.length && e.damage > 0 && !e.flying && !e.burrow && distance(e, hq) < 40);
}
function aiSpire(sim, team, army, hq, pace, plan) {
  const spire = sim.skirmishPoints.spire;
  if (!spire || sim.time < plan.spire) return;
  const crew = army.filter((e) => e.pointDuty === "spire");
  const held = spire.owner === team || (spire.owner !== null && !sim.hostile(team, spire.owner));
  const lost = crew.filter((e) => !e.orders.length && distance(e, spire) > spire.r);
  if (lost.length) sim.issue(lost.map((e) => e.id), { type: "attackmove", x: spire.x, z: spire.z });
  const missing = plan.crew - crew.length;
  if (missing <= 0 || (held && crew.length)) return;
  const spare = spareUnits(sim, army, hq);
  if (spare.length - missing < (pace.minWave ?? 4) - 1) return;
  sendDuty(sim, spare.sort((a, b) => distance(a, spire) - distance(b, spire) || a.id - b.id).slice(0, missing), "spire", spire);
}
function aiNest(sim, team, army, hq, pace, plan) {
  const nest = sim.wild.nest, memo = (sim.wild.ai ||= {});
  const party = army.filter((e) => e.pointDuty === "nest");
  const release = (wait) => { for (const e of party) e.pointDuty = null; memo[`nest${team}`] = sim.time + wait; };
  if (!nest || nest.state === "regrow" || !canTame(sim, team)) { if (party.length) release(60); return; }
  if (party.length) {
    // A party broken below two goes home; the rest walk back into the nest when they stand idle outside it.
    if (party.length < 2) return release(120);
    const idle = party.filter((e) => !e.orders.length && distance(e, nest) > nest.r - 1);
    if (idle.length) sim.issue(idle.map((e) => e.id), { type: "attackmove", x: nest.x, z: nest.z });
    return;
  }
  if (sim.time < plan.nest || sim.time < (memo[`nest${team}`] ?? 0) || army.length < plan.nest_army) return;
  const spare = spareUnits(sim, army, hq).filter((e) => e.kind === "unit");
  if (spare.length - plan.party < (pace.minWave ?? 4) - 1) return;
  sendDuty(sim, spare.sort((a, b) => b.hp - a.hp || a.id - b.id).slice(0, plan.party), "nest", nest);
}
function aiWeather(sim, team, plan) {
  const w = sim.wild, spire = sim.skirmishPoints.spire, memo = (w.ai ||= {});
  if (!spire || spire.owner !== team || sim.time < w.readyAt || sim.time < plan.weather || sim.time < (memo[`cast${team}`] ?? -Infinity) + plan.gap) return;
  const r = WILD.sandstorm.radius * 0.9, foes = [];
  for (const t of sim.entities)
    if (t.kind === "unit" && t.type !== "worker" && t.damage > 0 && groundFoe(sim, team, t) && sim.isVisible(t, team) && foes.length < 80) foes.push(t);
  let best = null, most = 0;
  for (const c of foes) {
    let n = 0;
    for (const o of foes) if (distance(c, o) <= r) n++;
    if (n > most) { best = c; most = n; }
  }
  if (!best || most < plan.weather_min) return;
  if (sim.castWeather(team, best.x, best.z)) memo[`cast${team}`] = sim.time;
}

export const wildFrontier = {
  id: "wildFrontier",
  order: 40,
  statuses: {
    // Sandblind: inside an enemy sandstorm, weapons reload 43% slower (fire 30% slower).
    sandblind: { reload: WILD.sandstorm.reload, label: "Sandblind", tint: [1, 0.78, 0.42] },
  },
  abilities: {
    // Dune Wyrm: dive, then burst up at `point` (the target's spot when it dived) after `delay` seconds.
    ambush: {
      use(sim, e, a, point) {
        const t = point && Number.isFinite(point.x) && Number.isFinite(point.z) ? point : ambushTarget(sim, e, a.range);
        if (!t || distance(e, t) > a.range + 1) return false;
        e.burrow = { x: t.x, z: t.z, at: sim.time + a.delay };
        e.cloaked = true;
        e.seenBy = 0;
        e.orders = [];
        e.path = [];
        e.post = { x: e.x, z: e.z };
        sim.events.push({ type: "wild", kind: "burrow", id: e.id, team: e.team, x: e.x, z: e.z, tx: t.x, tz: t.z, radius: a.radius, at: e.burrow.at });
        return {};
      },
    },
  },
  commands: {
    // The player's one-tap weather power, aimed at a spot.
    weather: {
      allowed: (sim, c) => !!sim.wild && Number.isFinite(c.x) && Number.isFinite(c.z),
      run: (sim, c) => sim.castWeather(c.team, c.x, c.z),
    },
  },
  mixin: {
    initWild() {
      const land = wildLand(this);
      if (!land || this.rules?.wild !== "on") return;
      const [sx, sz] = land.spire, [nx, nz] = land.nest;
      const spire = { x: sx, z: sz, r: WILD.spire.r, owner: null, taker: null, since: 0, wild: "spire" };
      // With capture points on, the Spire stands on the crossroads ring and keeps its small income.
      const cross = this.skirmishPoints.crossroads;
      if (cross && hyp(cross.x - sx, cross.z - sz) < 1) { spire.gives = { ...cross.gives }; delete this.skirmishPoints.crossroads; }
      this.skirmishPoints.spire = spire;
      const teams = this.players.length;
      this.wild = {
        land: this.terrain.id, readyAt: 0, owner: null, storms: [],
        // Three rivals: the nest's corner is the third rival's camp, so that match has no nest.
        nest: this.enemyCount < 3 ? { x: nx, z: nz, r: WILD.nest.r, state: "guarded", guards: [], taker: null, since: 0, regrowAt: 0 } : null,
        stats: { flips: 0, casts: Array(teams).fill(0), tamed: Array(teams).fill(0) },
      };
      if (this.wild.nest) spawnGuards(this);
    },
    // The Spire holder's Sandstorm at (x, z). True when it was called.
    castWeather(team, x, z) {
      const w = this.wild, spire = this.skirmishPoints?.spire;
      if (!w || !spire || spire.owner !== team || this.time < w.readyAt || this.result) return false;
      const half = this.terrain.half;
      if (!(Math.abs(x) <= half && Math.abs(z) <= half)) return false;
      const c = WILD.spire, s = WILD.sandstorm;
      const storm = { team, x, z, r: s.radius, at: this.time + c.warn, until: this.time + c.warn + s.duration };
      w.storms.push(storm);
      w.readyAt = this.time + c.cooldown;
      w.stats.casts[team]++;
      this.events.push({ type: "wild", kind: "storm", team, x, z, r: storm.r, at: storm.at, until: storm.until });
      this.message(team === 0 ? "Sandstorm called: it lands in 3 seconds." : "Enemy sandstorm incoming: it lands in 3 seconds.");
      return true;
    },
    // updateVision's last step (sim/vision.js): an active storm's ground is hidden from the holder's
    // enemies, except within `sight` m of one of their own (or allied) units.
    wildVision() {
      const w = this.wild;
      if (!w.storms.length) return;
      const t = this.terrain, g = t.grid, sight = WILD.sandstorm.sight;
      for (const s of w.storms) {
        if (this.time < s.at || this.time >= s.until) continue;
        const cell = (v) => Math.max(0, Math.min(g - 1, Math.floor((v + t.half) / 2)));
        const x0 = cell(s.x - s.r), x1 = cell(s.x + s.r), z0 = cell(s.z - s.r), z1 = cell(s.z + s.r);
        for (let team = 0; team < this.players.length; team++) {
          if (!this.hostile(team, s.team)) continue;
          const eyes = [];
          for (const e of this.entities) if (e.hp > 0 && e.team >= 0 && !this.hostile(team, e.team) && hyp(e.x - s.x, e.z - s.z) <= s.r + sight + 2) eyes.push(e);
          const vis = this.visible[team];
          for (let z = z0; z <= z1; z++)
            for (let x = x0; x <= x1; x++) {
              const wx = x * 2 - t.half + 1, wz = z * 2 - t.half + 1;
              if (hyp(wx - s.x, wz - s.z) > s.r) continue;
              if (eyes.some((e) => hyp(e.x - wx, e.z - wz) <= sight)) continue;
              vis[z * g + x] = 0;
            }
        }
      }
    },
  },
  step(sim, dt) {
    const w = sim.wild;
    if (!w) return;
    const land = wildLand(sim), think = sim.ticks % THINK === 0;
    if (w.nest?.state === "guarded") stepGuards(sim, w.nest, dt, think);
    stepWyrms(sim, land, think);
    if (!think) return;
    stepSpire(sim);
    stepStorms(sim);
    if (w.nest) stepNest(sim, w.nest);
  },
  // The Wyrm's Ambush is cast by the step above, for every side: the generic autocast leaves it alone.
  autocast(sim, e, a) {
    return a.id === "ambush" ? false : undefined;
  },
  // A Wyrm under the sand neither bites nor chases.
  fight(sim, e) {
    return e.burrow ? true : undefined;
  },
  aiRules: [
    {
      id: "wildFrontier",
      run(sim, team, { army, hq, pace }) {
        if (!sim.wild || !hq) return;
        const plan = wildPlan(sim);
        if (!plan) return;
        aiSpire(sim, team, army, hq, pace, plan);
        aiNest(sim, team, army, hq, pace, plan);
        aiWeather(sim, team, plan);
      },
    },
  ],
};
