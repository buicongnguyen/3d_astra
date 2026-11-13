import { DEFINITIONS as D, distance, hyp } from "../data.js";
import { difficultyRules } from "../difficulty.js";
import { waveCount } from "./missions.js";
import GARRISONS from "../defence/garrisons.json" with { type: "json" };

// Frontier Defence (release 0.17): enemy waves walk fixed routes while the player crews towers
// on fixed pads. Everything this mode keeps is in `this.defence`, created only when the mission
// definition has a `defence` block, so every other match serializes (and hashes) exactly as before.
// Mixed into Simulation (see simulation.js). Format: docs/MISSIONS.md ("Frontier Defence levels").
export { GARRISONS };
const TEAM = 0, FOE = 1;
// Seconds between spawn attempts when the spawn spot is still crowded.
const RETRY = 0.25;
// A route leg is done within this distance of its corner, or once the unit is past its end.
const CORNER = 1.5;

// Where a unit walks on a route: its own lane, offset sideways from the centre line. At a corner
// the offset follows the bisector, so lanes do not cross.
function lanePoint(pts, i, lane) {
  const p = pts[i], a = pts[i - 1] || p, b = pts[i + 1] || p;
  const n1 = normal(a, p), n2 = normal(p, b);
  let nx = n1.x + n2.x, nz = n1.z + n2.z;
  const l = hyp(nx, nz);
  if (l < 1e-6) { nx = n1.x; nz = n1.z; } else { nx /= l; nz /= l; }
  // Keep the lane width on both legs (the bisector is longer at a corner), within reason.
  const scale = Math.min(1.6, 1 / Math.max(0.6, nx * n1.x + nz * n1.z || 1));
  return { x: p.x + nx * lane * scale, z: p.z + nz * lane * scale };
}
function normal(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l = hyp(dx, dz);
  return l < 1e-6 ? { x: 0, z: 0 } : { x: -dz / l, z: dx / l };
}

export const defence = {
  initDefence(def) {
    const lives = def.lives ?? 20;
    this.defence = { lives, wave: 0, active: false, nextAt: def.firstWave ?? 30, queue: [], cleared: 0, leaked: 0, bounty: 0, called: 0 };
    const p = this.players[TEAM], alloy = typeof def.alloy === "object" ? def.alloy[this.difficulty] ?? def.alloy.standard : def.alloy;
    p.alloy = alloy ?? 250;
    p.energy = 0;
  },
  defenceDef() {
    return this.missionDef?.defence || null;
  },
  // The crew of a garrison, resolved for this team's roster: the unit it is made from.
  crewType(crew, team = TEAM) {
    const g = GARRISONS.crews[crew];
    return g ? g.type || this.typeFor(team, g.slot) : null;
  },
  crewCost(crew, tier = 1) {
    return GARRISONS.crews[crew]?.cost[tier - 1] ?? null;
  },
  // Tower figures for a crew at a tier, from the crew's own unit (balance.json) and garrisons.json.
  garrisonStats(crew, tier, team = TEAM) {
    const g = GARRISONS.crews[crew], type = this.crewType(crew, team), d = D[type], t = GARRISONS.tiers[tier - 1];
    const s = {
      name: g.name,
      damage: d.damage * g.damage * t.damage,
      interval: d.interval * (g.interval ?? 1) * t.interval,
      range: d.range + g.range + t.range,
      shot: d.shot || type,
      maxHp: Math.round(D.tower.hp * (GARRISONS.hp ?? 1) * t.hp),
      maxShield: D.tower.shield,
      level: tier,
    };
    if (d.splash_radius) { s.splash_radius = d.splash_radius * (g.splash ?? 1); s.splash_damage = d.splash_damage; }
    if (d.counter) { s.counter = d.counter; s.counter_bonus = d.counter_bonus; }
    // Armour: machines shrug off small arms and shrapnel (garrisons.json mech), not rockets.
    if (d.mechanical_bonus || g.mech) s.mechanical_bonus = (d.mechanical_bonus || 1) * (g.mech ?? 1);
    if (g.reveal) s.reveal = g.reveal;
    // Air waves (0.18.3): in a level with rules.air, a crew whose unit hits air (Ranger, Anti-tank,
    // Watcher; never Breaker) makes the tower hit flyers too (sim/air.js canHit; towers do ×AIR.flak_bonus).
    if (d.hits_air && this.airAllowed()) s.hits_air = true;
    return s;
  },
  padById(id) {
    return this.defenceDef()?.pads.find((p) => p.id === id) || null;
  },
  towerOn(padId) {
    return this.entities.find((e) => e.pad === padId && e.hp > 0) || null;
  },
  padBuild(team, padId, crew) {
    const def = this.defenceDef(), pad = this.padById(padId);
    if (!this.defence || this.result || team !== TEAM || !pad || !def.crews.includes(crew) || !GARRISONS.crews[crew]) return false;
    if (this.towerOn(padId)) return false;
    const cost = this.crewCost(crew, 1);
    if (this.players[team].alloy < cost) { this.message(`Need ${Math.ceil(cost - this.players[team].alloy)} more alloy.`, team); return false; }
    this.players[team].alloy -= cost;
    const e = this.spawn("tower", team, pad.x, pad.z, true, true);
    e.pad = padId;
    e.crew = crew;
    e.tier = 1;
    e.spent = cost;
    this.setGarrison(e, 1);
    e.hp = e.maxHp;
    this.nav.rebuild(this.entities);
    this.events.push({ type: "padBuild", id: e.id, pad: padId, crew, team, x: e.x, z: e.z });
    return true;
  },
  setGarrison(e, tier) {
    const before = e.maxHp, s = this.garrisonStats(e.crew, tier, e.team);
    Object.assign(e, s);
    e.tier = tier;
    e.hp = Math.min(e.maxHp, e.hp + Math.max(0, e.maxHp - before));
  },
  padUpgrade(team, id) {
    const e = this.get(id);
    if (!this.defence || this.result || !e || e.team !== team || !e.crew || e.tier >= 3) return false;
    const cost = this.crewCost(e.crew, e.tier + 1);
    if (this.players[team].alloy < cost) { this.message(`Need ${Math.ceil(cost - this.players[team].alloy)} more alloy.`, team); return false; }
    this.players[team].alloy -= cost;
    e.spent += cost;
    this.setGarrison(e, e.tier + 1);
    this.events.push({ type: "levelup", x: e.x, z: e.z, team: e.team, radius: e.radius, level: e.tier, seed: e.id, garrison: true });
    return true;
  },
  padSell(team, id) {
    const e = this.get(id);
    if (!this.defence || this.result || !e || e.team !== team || !e.crew) return false;
    const refund = Math.floor(e.spent * GARRISONS.sell);
    this.players[team].alloy += refund;
    e.hp = 0;
    this.nav.rebuild(this.entities);
    this.events.push({ type: "padSell", id: e.id, pad: e.pad, team, refund, x: e.x, z: e.z });
    return true;
  },
  // Sends the next wave now. The time left on the countdown pays a small bonus.
  waveCall(team) {
    const d = this.defence, def = this.defenceDef();
    if (!d || this.result || team !== TEAM || d.wave >= def.waves.length || d.queue.length) return false;
    const left = d.nextAt !== null ? Math.max(0, d.nextAt - this.time) : def.gap ?? 16;
    const bonus = Math.ceil(left * 2);
    this.players[TEAM].alloy += bonus;
    d.called += bonus;
    this.startWave();
    this.events.push({ type: "waveCall", bonus, team });
    return true;
  },
  // Wave sizes by difficulty: the level's own table (defence.count), else the campaign's.
  defenceWaveScale() {
    const count = this.defenceDef()?.count;
    return count?.[this.difficulty] ?? difficultyRules(this).wave;
  },
  startWave() {
    const d = this.defence, def = this.defenceDef(), wave = def.waves[d.wave], scale = this.defenceWaveScale();
    d.wave++;
    d.active = true;
    d.nextAt = null;
    let count = 0, from = null;
    for (const g of wave.groups) {
      const pts = def.routes[g.route];
      if (!pts) continue;
      from ||= pts[0];
      // Types take turns, so a mixed group arrives mixed.
      const left = Object.entries(g.units).map(([slot, n]) => [this.typeFor(FOE, slot), waveCount(n, scale, D[this.typeFor(FOE, slot)])]);
      for (let k = 0, i = 0; left.some(([, n]) => n > 0); k++) {
        const entry = left[k % left.length];
        if (entry[1] <= 0) continue;
        entry[1]--;
        const q = { at: this.time + (g.delay || 0) + i * (g.every ?? 0.7), type: entry[0], route: g.route };
        // Tougher crews: the group's own factor times the difficulty's (defence.hp).
        const hp = (g.hp ?? 1) * (typeof def.hp === "object" ? def.hp[this.difficulty] ?? 1 : def.hp ?? 1);
        if (hp !== 1) q.hp = hp;
        d.queue.push(q);
        i++;
        count++;
      }
    }
    d.queue.sort((a, b) => a.at - b.at);
    if (from) this.events.push({ type: "incoming", team: TEAM, x: from.x, z: from.z, count, wave: d.wave });
  },
  // A due spawn appears on its lane at the route's start, once that spot is clear.
  spawnQueued() {
    const d = this.defence, def = this.defenceDef();
    let spawned = false;
    while (d.queue.length && d.queue[0].at <= this.time + 1e-9) {
      const q = d.queue[0], pts = def.routes[q.route], id = this.nextId, r = D[q.type].radius || 0.7;
      const start = lanePoint(pts, 0, ((id * 0.618) % 1 - 0.5) * (def.lane ?? 2.4));
      const crowded = !this.nav.canStand(start.x, start.z, r) ||
        this.entities.some((e) => e.hp > 0 && e.kind === "unit" && hyp(e.x - start.x, e.z - start.z) < e.radius + r);
      if (crowded) {
        // Everything behind it waits its turn as well, keeping the column's spacing.
        for (const later of d.queue) later.at += RETRY;
        break;
      }
      d.queue.shift();
      const e = this.spawn(q.type, FOE, start.x, start.z, true, true);
      if (q.hp) e.hp = e.maxHp = Math.round(e.maxHp * q.hp);
      const next = pts[1] || pts[0];
      e.angle = Math.atan2(next.x - e.x, next.z - e.z);
      e.orders = [{ type: "route", route: q.route, leg: 1 }];
      spawned = true;
    }
    return spawned;
  },
  // Route order (sim/stepEntity): walk the lane leg by leg, straight when the way is clear and
  // by the route search otherwise, firing on the move at whatever is in range. A wave never
  // stops or leaves its road to chase.
  stepRoute(e, o, dt) {
    const def = this.defenceDef(), pts = def?.routes[o.route];
    if (!pts) { this.finish(e); return; }
    const foe = e.damage > 0 ? this.enemy(e, e.range, true) : null;
    if (foe) this.fight(e, foe, dt, false);
    const lane = ((e.id * 0.618) % 1 - 0.5) * (def.lane ?? 2.4);
    let target = null;
    for (let guard = 0; guard < pts.length; guard++) {
      if (o.leg >= pts.length) { o.leg = pts.length - 1; target = pts[o.leg]; break; }
      target = lanePoint(pts, o.leg, o.leg === pts.length - 1 ? 0 : lane);
      const a = pts[o.leg - 1], b = pts[o.leg], dx = b.x - a.x, dz = b.z - a.z;
      const past = ((e.x - a.x) * dx + (e.z - a.z) * dz) / (dx * dx + dz * dz || 1) >= 1;
      if (o.leg < pts.length - 1 && (distance(e, target) < CORNER || past)) { o.leg++; continue; }
      break;
    }
    const dx = target.x - e.x, dz = target.z - e.z, d = hyp(dx, dz);
    if (d < 0.05) { e.moving = false; return; }
    const step = Math.min(d, this.moveSpeed(e) * (def.pace ?? 1) * dt), next = { x: e.x + (dx / d) * step, z: e.z + (dz / d) * step };
    // Flyers (0.18.3) fly the same lane straight from corner to corner, over any ground.
    if (e.speed > 0 && (e.flying || this.nav.canTraverse(e, next, e.radius))) {
      e.x = next.x;
      e.z = next.z;
      // A unit firing keeps facing its target (turrets and the shot read the angle).
      if (!e.attacking) e.angle = Math.atan2(dx, dz);
      e.moving = true;
      e.path = [];
      e.stalled = 0;
      return;
    }
    this.move(e, target, dt, CORNER);
    // move() drops an order it cannot finish; a route is never dropped.
    if (e.orders[0] !== o) e.orders.unshift(o);
  },
  stepDefence() {
    const d = this.defence, def = this.defenceDef();
    if (!d || !def || this.result) return;
    if (d.nextAt !== null && this.time >= d.nextAt - 1e-9 && d.wave < def.waves.length) this.startWave();
    if (d.queue.length) this.spawnQueued();
    const exit = def.exit;
    let alive = 0;
    for (const e of this.entities) {
      if (e.team !== FOE || e.kind !== "unit") continue;
      if (e.hp <= 0) {
        // Killed this tick (settle removes it next): one tenth of what it cost.
        if (!e.paid && !e.leaked) {
          e.paid = true;
          const cost = D[e.type].cost || [0, 0], bounty = Math.ceil((cost[0] + cost[1]) * GARRISONS.bounty);
          this.players[TEAM].alloy += bounty;
          d.bounty += bounty;
          this.events.push({ type: "bounty", amount: bounty, x: e.x, z: e.z, team: TEAM });
        }
        continue;
      }
      if (hyp(e.x - exit.x, e.z - exit.z) <= exit.r) {
        // Through the line: lives lost (two for heavy machines), and the unit leaves the field.
        const cost = (e.pop || 1) >= 3 ? 2 : 1;
        d.lives = Math.max(0, d.lives - cost);
        d.leaked += 1;
        e.leaked = true;
        e.hp = 0;
        e.orders = [];
        this.events.push({ type: "leak", lives: d.lives, cost, x: e.x, z: e.z, team: FOE });
        continue;
      }
      alive++;
    }
    if (d.active && !d.queue.length && !alive) {
      // Wave beaten: its bonus, every tower patched up, and the countdown to the next one.
      d.active = false;
      d.cleared = d.wave;
      const wave = def.waves[d.wave - 1];
      if (wave?.bonus) this.players[TEAM].alloy += wave.bonus;
      for (const t of this.entities) if (t.team === TEAM && t.crew && t.hp > 0) { t.hp = t.maxHp; t.shield = t.maxShield; }
      this.events.push({ type: "waveCleared", wave: d.wave, bonus: wave?.bonus || 0, team: TEAM });
      if (d.wave < def.waves.length) d.nextAt = this.time + (def.gap ?? 16);
    }
  },
  // Called from missionResult(): lives decide defeat, the last wave beaten decides victory.
  defenceResult() {
    const d = this.defence, def = this.defenceDef(), m = this.mission;
    if (!d || !def) return null;
    const lost = d.lives <= 0;
    const won = !lost && d.wave >= def.waves.length && !d.active && !d.queue.length;
    if (!lost && !won) return null;
    if (won) {
      for (const o of this.missionDef.objectives) this.setObjective(o.id, "done");
      const medals = this.missionDef.medals || {};
      m.medal = medals.gold && d.lives >= medals.gold.lives ? "gold" : medals.silver && d.lives >= medals.silver.lives ? "silver" : "bronze";
    } else for (const o of this.missionDef.objectives) this.setObjective(o.id, "failed");
    this.events.push({ type: "missionEnd", result: won ? "victory" : "defeat", medal: m.medal, seconds: m.clock, lives: d.lives, stars: won ? starsFor(m.medal) : 0 });
    return won ? "victory" : "defeat";
  },
  // What the interface shows: lives, wave n of N, the countdown and whether a wave can be called.
  defenceStatus() {
    const d = this.defence, def = this.defenceDef();
    if (!d || !def) return null;
    return {
      lives: d.lives, maxLives: def.lives ?? 20, wave: d.wave, waves: def.waves.length, active: d.active,
      countdown: d.nextAt !== null ? Math.max(0, d.nextAt - this.time) : null,
      canCall: !this.result && d.wave < def.waves.length && !d.queue.length,
      enemies: this.entities.filter((e) => e.team === FOE && e.kind === "unit" && e.hp > 0).length,
    };
  },
};
export const starsFor = (medal) => ({ gold: 3, silver: 2, bronze: 1 })[medal] || 0;
