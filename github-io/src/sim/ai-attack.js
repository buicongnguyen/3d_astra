import { DEFINITIONS as D, distance } from "../data.js";
import { HURT } from "./ai-counter.js";

// How the computer commands its army in the field (0.15.0). Mixed into Simulation through `ai`.
//   gather   the wave meets at a rally point outside its base and marches only when its strength
//            clearly outweighs the defence it has seen (its intel memory), or when it has waited long enough
//   retreat  an attack that is losing the local fight falls back to the rally point and regroups
//   focus    ranged units shoot artillery, Harvesters and damaged units first, switching only for a clearly better target
//   split    sometimes (seeded by the match clock, by personality) a second group takes another path or target
// Everything reads only what the team can see or remembers. State is created only when used
// (`sim.aiWar`, and an `aiw` tag on the orders it gives), so a match without a computer opponent is unchanged.

// Per skirmish speed. Relaxed keeps the original simple AI.
//   odds     gathered strength needed against the seen defence      wait  longest gather (s)
//   retreat  local enemy strength against ours that turns an attack   split chance of a second group (× personality)
//   focus    focus fire     pullback  hurt units fall back            allied  coalition pushes are tracked too
//   probe    past `wait` it marches if it has this share of the seen defence (default 0.75); past 3 × wait, always
const FIELD = {
  normal: { odds: 1.4, wait: 45, retreat: 1.3, focus: true, pullback: true, split: 1, allied: true },
  fast: { odds: 1.35, wait: 40, retreat: 1.3, focus: true, pullback: true, split: 1, allied: true },
  relentless: { odds: 1.25, wait: 35, retreat: 1.4, focus: true, pullback: true, split: 1, allied: true },
};
// Story missions: Story keeps the original AI. Standard and Veteran use the field commander for a
// lone rival's waves, pull-backs and defence, but leave the scripted coalition pushes as they were
// (tracking them broke the mission 11 and 12 targets: their timing is those missions' balance).
// On Standard a wave that is outweighed marches anyway at its longest wait (probe 0), as the
// original waves did: holding back longer against the player's larger army let the objective bot
// win mission 9 before its earliest time.
const MISSION_FIELD = { story: null, standard: { ...FIELD.normal, probe: 0, allied: false }, veteran: { ...FIELD.fast, allied: false } };
// Faction personalities (balance.json ai_personalities names) bend the same rules:
// Ashfall rushes in at lower odds and holds on longer; the Wardens wait for clear odds and give
// ground early; Veil breaks off at even odds and likes a flank; Sunward sends raiders at Harvesters.
export const FIELD_PERSONA = {
  default: { odds: 1, wait: 1, retreat: 1, split: 0.35, to: "flank" },
  rush: { odds: 0.8, wait: 0.5, retreat: 1.15, split: 0.25, to: "flank" },
  raider: { odds: 1, wait: 1, retreat: 1, split: 0.6, to: "harvesters" },
  turtle: { odds: 1.25, wait: 1.5, retreat: 0.9, split: 0.15, to: "flank" },
  evasive: { odds: 1.1, wait: 1, retreat: 0.85, split: 0.5, to: "flank" },
};
// Static defence needs about three times its value to break (docs/BALANCE.md, Sentinel tower).
const TOWER_WEIGHT = 3;
// Rally point distance from the core towards the target, and how close counts as gathered.
const RALLY = 14, GATHERED = 9;
// An attack counts enemies this close to any of its units. A group is "in the field" beyond FIELD_RANGE of its core.
const NEAR = 15, FIELD_RANGE = 30;
// An attack that lost this share of its strength in a fight, and clearly more than it dealt, falls back.
const LOSING = 0.3;
// A focused target is kept unless another is this much better (hysteresis against thrashing).
const SWITCH = 1.35;

// Fighting value of a type: its price (alloy + 1.5 × energy, as in docs/BALANCE.md); towers count
// three times; support units a little; Harvesters, cores and other buildings nothing.
export function worth(type) {
  const d = D[type];
  if (!d || type === "worker") return 0;
  const price = d.cost[0] + 1.5 * d.cost[1];
  if (d.kind === "building") return d.damage ? price * TOWER_WEIGHT : 0;
  return d.damage ? price : d.support ? price * 0.4 : 0;
}
const health = (e) => (e.hp + (e.shield || 0)) / Math.max(1, e.maxHp + (e.maxShield || 0));
const strength = (list) => list.reduce((n, e) => n + worth(e.type) * health(e), 0);
const centre = (list) => ({ x: list.reduce((n, e) => n + e.x, 0) / list.length, z: list.reduce((n, e) => n + e.z, 0) / list.length });
const tagged = (e, n) => e.orders.some((o) => o.aiw === n);

export const aiAttack = {
  // The field rules for this team, or null for the original AI (Relaxed skirmish, Story missions).
  aiCommandFor(team) {
    const base = this.mission ? MISSION_FIELD[this.difficulty] : FIELD[this.aiSpeed];
    if (!base) return null;
    const p = FIELD_PERSONA[this.factionFor(team).ai] || FIELD_PERSONA.default;
    return { ...base, odds: base.odds * p.odds, wait: base.wait * p.wait, retreat: base.retreat * p.retreat, split: base.split * p.split, to: p.to };
  },
  aiWarFor(team) {
    const war = (this.aiWar ||= { n: 0 });
    return (war[team] ||= { gather: null, attacks: [] });
  },
  // A number in [0, 1) from the match clock, the team and a salt: the same match always rolls the same.
  aiRoll(team, salt) {
    let h = Math.imul(this.ticks ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(team + 1, 0xc2b2ae35) ^ Math.imul(salt + 7, 0x27d4eb2f);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  },
  // What this team believes `foe` fields: every fighter and tower of that side it has seen and not seen die.
  aiSeenDefence(team, foe) {
    let sum = 0;
    for (const [id, type] of this.intel[team] || []) {
      const e = this.get(id);
      if (e && e.team === foe && (e.kind === "unit" || e.complete)) sum += worth(type);
    }
    return sum;
  },
  // Visible enemy fighters and towers close to any unit of the group, weighted by their health.
  aiLocalThreat(team, members) {
    let sum = 0;
    for (const t of this.entities) {
      if (t.hp <= 0 || !t.damage || t.type === "worker" || (t.kind === "building" && !t.complete) || (t.kind !== "unit" && t.kind !== "building")) continue;
      if (!this.hostile(team, t.team) || !this.isVisible(t, team)) continue;
      if (members.some((e) => distance(e, t) - (t.radius || 0) < NEAR)) sum += worth(t.type) * health(t);
    }
    return sum;
  },
  // A standable point `r` metres from the core towards `toward`.
  aiRallyPoint(hq, toward, r = RALLY) {
    const d = distance(hq, toward) || 1, x = hq.x + ((toward.x - hq.x) / d) * r, z = hq.z + ((toward.z - hq.z) / d) * r;
    return this.nav.canStand(x, z, 1) ? { x, z } : this.nav.nearest(x, z, 1) || { x: hq.x, z: hq.z };
  },
  aiNearestCore(team, from) {
    return [...this.knownCores[team].values()].sort((a, b) => distance(from, a) - distance(from, b) || a.id - b.id)[0] || null;
  },
  // Gather, weigh and launch the next wave (replaces the timed wave of the original AI).
  aiWave(team, hq, wave, incursion, pace, cmd) {
    const war = this.aiWarFor(team);
    // A base under real attack fights first; the gathering resumes after.
    if (incursion) return;
    const g = war.gather;
    // Who may join: free fighters and support, not already in an attack, not badly hurt, idle or walking to the rally.
    const pool = wave.filter((e) => !e.orders.some((o) => o.aiw) && e.hp >= e.maxHp * HURT &&
      (!e.orders.length || (g && e.orders[0].type === "move" && distance(e.orders[0], g) < 6)));
    if (!g && (this.time < this.waveAt[team] || pool.length < pace.minWave)) return;
    if (!pool.length) { war.gather = null; return; }
    const core = this.aiNearestCore(team, hq);
    if (!g) {
      const spot = this.aiRallyPoint(hq, core || { x: 0, z: 0 });
      war.gather = { x: spot.x, z: spot.z, since: this.time };
      this.issue(pool.map((e) => e.id), { type: "move", x: spot.x, z: spot.z });
      return;
    }
    const away = pool.filter((e) => distance(e, g) > GATHERED);
    const idle = away.filter((e) => !e.orders.length);
    if (idle.length) this.issue(idle.map((e) => e.id), { type: "move", x: g.x, z: g.z });
    const here = strength(pool.filter((e) => distance(e, g) <= GATHERED)), all = strength(pool);
    const waited = this.time - g.since, theirs = core ? this.aiSeenDefence(team, core.team) : 0;
    // Formed: most of the strength stands at the rally (stragglers get 25 s, as in 0.12.1). Past the
    // longest wait it goes for a fight it can take (three quarters of the seen defence); past three times that, whatever it has.
    const formed = here >= all * 0.8 || waited >= 25;
    if (!(formed && here >= theirs * cmd.odds) && !(waited >= cmd.wait && here >= theirs * (cmd.probe ?? 0.75)) && waited < cmd.wait * 3) return;
    const target = core || this.scoutDestination(team);
    war.gather = null;
    this.waveAt[team] = this.time + pace.waveGap;
    if (!target) return;
    // A second group only when the rest alone still clearly outweighs a defence it has actually seen.
    const second = theirs > 0 && here * 0.7 >= theirs * cmd.odds ? this.aiSecondGroup(team, hq, pool, core, cmd) : null;
    const main = second ? pool.filter((e) => !second.units.includes(e)) : pool;
    this.aiLaunch(team, main, target, null);
    if (second) this.aiLaunch(team, second.units, second.target, second.via, false);
    if (target.team !== undefined) this.events.push({ type: "incoming", team: target.team, x: hq.x, z: hq.z, count: pool.length });
  },
  // A base under real attack: the defenders attack-move on the threat, so each shoots what it meets
  // (and its focus rules) instead of the whole army chasing one unit. Units already heading there keep their route.
  aiDefend(team, ready, threat) {
    const go = ready.filter((e) => !(e.orders[0]?.type === "attackmove" && !e.orders[0].aiw && distance(e.orders[0], threat) < 8));
    if (go.length) this.issue(go.map((e) => e.id), { type: "attackmove", x: threat.x, z: threat.z });
  },
  // Sends a group: through `via` first when given, then attack-moving on `target`. A group sent to a
  // search point (no core known) turns on the first core it finds. Returns its number.
  aiLaunch(team, units, target, via, search = target.team === undefined) {
    const war = this.aiWarFor(team), n = ++this.aiWar.n, ids = units.map((e) => e.id);
    if (via) {
      this.issue(ids, { type: "move", x: via.x, z: via.z, aiw: n });
      this.issue(ids, { type: "attackmove", x: target.x, z: target.z, aiw: n }, true);
    } else this.issue(ids, { type: "attackmove", x: target.x, z: target.z, aiw: n });
    war.attacks.push({ n, core: target.team !== undefined ? target.id : null, search: search ? 1 : 0, x: target.x, z: target.z, launch: strength(units), back: 0 });
    return n;
  },
  // Sometimes part of the wave goes another way: Sunward's raiders at the Harvesters, the others at
  // an expansion core of the same enemy or the same core by a flank. Needs at least eight units.
  aiSecondGroup(team, hq, pool, core, cmd) {
    const fighters = pool.filter((e) => e.damage > 0);
    if (!core || !cmd.split || fighters.length < 8 || this.aiRoll(team, this.aiWar?.n ?? 0) >= cmd.split) return null;
    const units = [...fighters].sort((a, b) => b.speed - a.speed || a.id - b.id).slice(0, Math.max(3, Math.round(fighters.length * 0.3)));
    const other = [...this.knownCores[team].values()].filter((c) => c.team === core.team && c.id !== core.id)
      .sort((a, b) => distance(hq, a) - distance(hq, b) || a.id - b.id)[0];
    if (other) return { units, target: other, via: null };
    if (cmd.to === "harvesters") {
      const deposit = this.resources.filter((r) => r.amount > 0).sort((a, b) => distance(core, a) - distance(core, b) || a.id - b.id)[0];
      if (deposit) return { units, target: { x: deposit.x, z: deposit.z }, via: null };
    }
    // A flank: a waypoint beside the straight road, on a seeded side, a third of the way out.
    const d = distance(hq, core) || 1, side = this.aiRoll(team, (this.aiWar?.n ?? 0) + 101) < 0.5 ? 1 : -1;
    const px = -(core.z - hq.z) / d, pz = (core.x - hq.x) / d, limit = this.terrain.half - 6;
    const clampTo = (v) => Math.max(-limit, Math.min(limit, v));
    const x = clampTo((hq.x + core.x) / 2 + px * side * d * 0.35), z = clampTo((hq.z + core.z) / 2 + pz * side * d * 0.35);
    const via = this.nav.canStand(x, z, 1) ? { x, z } : this.nav.nearest(x, z, 1);
    return via ? { units, target: core, via } : null;
  },
  // Every think: each attack in the field picks targets, moves on when its core falls and falls back when it is losing.
  aiWatch(team, hq, army, cmd) {
    const war = this.aiWar?.[team];
    if (!war?.attacks.length) return;
    war.attacks = war.attacks.filter((a) => {
      const members = army.filter((e) => tagged(e, a.n));
      if (!members.length) return false;
      if (a.back) return true;
      // The target core is gone: go on to the next known core, or search. A search turns on the first core found.
      const found = a.search && this.aiNearestCore(team, centre(members));
      if (found || (a.core !== null && !this.knownCores[team].has(a.core))) {
        const next = found || this.aiNearestCore(team, centre(members)) || this.scoutDestination(team);
        if (!next) return true;
        Object.assign(a, { core: next.team !== undefined ? next.id : null, search: next.team === undefined ? 1 : 0, x: next.x, z: next.z });
        this.issue(members.map((e) => e.id), { type: "attackmove", x: a.x, z: a.z, aiw: a.n });
        return true;
      }
      const mine = strength(members), theirs = this.aiLocalThreat(team, members);
      // The exchange so far: our strength when this fight began against the most of theirs seen in it.
      if (!theirs) { delete a.fm; delete a.ft; }
      else { a.fm ??= mine; a.ft = Math.max(a.ft ?? 0, theirs); }
      const lost = theirs ? 1 - mine / a.fm : 0, dealt = theirs ? 1 - theirs / a.ft : 0;
      // Losing: clearly outweighed here, losing much faster than the enemy, or mostly gone.
      const losing = theirs > mine * cmd.retreat || (lost >= LOSING && lost > dealt + 0.2 && theirs > mine * 0.5) || (mine < a.launch * 0.35 && theirs > mine * 0.5);
      if (losing && distance(centre(members), hq) > FIELD_RANGE) {
        const home = this.aiRallyPoint(hq, a);
        this.issue(members.map((e) => e.id), { type: "move", x: home.x, z: home.z, aiw: a.n });
        a.back = 1;
        this.waveAt[team] = Math.max(this.waveAt[team], this.time + this.paceFor(team).waveGap * 0.5);
        return true;
      }
      if (cmd.focus) this.aiFocus(team, members, a);
      return true;
    });
  },
  // How much a unit wants to shoot `t`: artillery first, then Harvesters, support, its counter and
  // the most damaged. Siege units (siege_range) prefer towers. 0 = not worth an order.
  aiPriority(e, t) {
    if (t.kind === "building") return t.damage ? (e.siege_range ? 2.5 : 0.8) : 0.2;
    let s = t.class === "siege" ? 3 : t.type === "worker" ? 2.2 : t.support ? 1.6 : 1;
    if (e.counter && e.counter === t.class) s *= 1.5;
    if (t.mechanical && (e.mechanical_bonus || 1) > 1) s *= 1.5;
    return s * (1 + 1.2 * (1 - health(t)));
  },
  // Focus fire for ranged units of an attack: the best target within reach. A unit already on a
  // focus target keeps it unless another is SWITCH times better; without one it leaves the
  // automatic nearest-target choice alone unless the best is SWITCH times better than that.
  aiFocus(team, members, a) {
    for (const e of members) {
      if (!(e.damage > 0) || e.range < 4 || e.orders[0]?.type === "move") continue;
      const o = e.orders[0], cur = o?.type === "attack" ? this.get(o.target) : null;
      let best = null, bestS = 0, curS = 0;
      for (const t of this.entities) {
        if (t.hp <= 0 || t.kind === "wall" || t.kind === "resource") continue;
        const reach = (t.kind !== "unit" && e.siege_range ? e.siege_range : e.range) + 1.5 + (t.radius || 0), dx = t.x - e.x, dz = t.z - e.z;
        if (dx * dx + dz * dz > reach * reach || !this.hostile(team, t.team) || !this.isVisible(t, team)) continue;
        const s = this.aiPriority(e, t);
        if (t === cur) curS = s;
        if (s > bestS || (s === bestS && best && t.id < best.id)) { best = t; bestS = s; }
      }
      if (cur && !curS) {
        // The focus target left reach or sight: carry on with the advance.
        this.issue([e.id], { type: "attackmove", x: a.x, z: a.z, aiw: a.n });
        continue;
      }
      if (!best || best === cur) continue;
      const auto = cur ? null : this.enemy(e, e.range, true);
      const bar = cur ? curS : auto ? this.aiPriority(e, auto) : 0;
      if (auto === best || bestS <= bar * SWITCH || !this.nav.clearLine(e, best, best.id)) continue;
      this.issue([e.id], { type: "attack", target: best.id, aiw: a.n });
      this.issue([e.id], { type: "attackmove", x: a.x, z: a.z, aiw: a.n }, true);
    }
  },
};
