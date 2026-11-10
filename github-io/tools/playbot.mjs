// A steady, unspectacular player for balance checks: it builds an economy, keeps supply ahead,
// trains a mixed army that guards the base, and (optionally) marches once it is strong.
// It plays only through sim.command, exactly as the interface does.
// Usage: const bot = new PlayBot(sim, { attackAt: 14 }); call bot.step() once per tick and
// pass it the simulation's events with bot.see(event). attackAfter (seconds) delays the first march.
import { DEFINITIONS as D } from "../src/data.js";

export class PlayBot {
  constructor(sim, { team = 0, attackAt = Infinity, attackAfter = 0, workers = 10, towers = 2 } = {}) {
    Object.assign(this, { sim, team, attackAt, attackAfter, workers, towers, placed: 0, retries: new Map(), alarm: -Infinity, party: null });
    sim.command({ team, type: "autocast", on: true });
  }
  own(type) { return this.sim.own(this.team).filter((e) => e.type === type); }
  // The harness passes on what the interface shows. A warning of a real attack (six or more
  // units) keeps the army home for a while; towers and fresh troops deal with less.
  see(event) {
    if (event.type === "incoming" && event.team === this.team && event.count >= 6) this.alarm = this.sim.time + 40;
  }
  // Harvesters the bot may use. A tagged one is mission cargo (a convoy), not a worker.
  crew() { return this.own("worker").filter((w) => !w.tag); }
  // Idle Harvesters go to the nearest known deposit, one in four to energy (the interface's
  // "harvest" command does the same, but it would also send a tagged convoy vehicle to mine).
  harvest() {
    const s = this.sim, crew = this.crew();
    if (crew.length === this.own("worker").length) return s.command({ team: this.team, type: "harvest" });
    crew.forEach((w, i) => {
      if (w.orders.length) return;
      const type = i % 4 === 0 ? "energy" : "alloy";
      const deposit = s.resources.filter((r) => r.amount > 0 && r.type === type && s.isExplored(r, this.team)).sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z))[0];
      if (deposit) s.command({ team: this.team, type: "order", ids: [w.id], order: { type: "gather", target: deposit.id } });
    });
  }
  build(type, near, reach = 14) {
    const s = this.sim, builder = this.crew().find((w) => !w.orders.some((o) => o.type === "build"));
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
    this.harvest();
    if (!hq) return;
    // While Harvesters are missing, the price of one stays in the bank: a camp that spends its
    // last alloy and then loses its Harvesters could never recover.
    const spare = this.crew().length < this.workers ? D.worker.cost[0] : 0;
    const pop = s.population(team), can = (type) => s.canPay(team, [D[type].cost[0] + spare, D[type].cost[1]]);
    const sites = s.own(team).filter((e) => e.kind === "building" && !e.complete).length;
    const done = (type) => this.own(type).filter((e) => e.complete);
    // A site whose builder died or could not reach it gets another Harvester; after three it is cancelled.
    for (const site of s.own(team).filter((e) => e.kind === "building" && !e.complete)) {
      if (this.crew().some((w) => w.orders.some((o) => o.type === "build" && o.target === site.id))) continue;
      const tries = (this.retries.get(site.id) || 0) + 1, builder = this.crew().find((w) => !w.orders.some((o) => o.type === "build"));
      this.retries.set(site.id, tries);
      if (tries > 3) s.command({ team, type: "cancelBuild", building: site.id });
      else if (builder) s.command({ team, type: "order", ids: [builder.id], order: { type: "build", target: site.id } });
    }
    if (this.crew().length < this.workers && !hq.queue.length && !hq.levelJob) s.command({ team, type: "train", building: hq.id, unit: "worker" });
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
    // An attack that was wiped out teaches caution: the next one waits for eight more fighters.
    if (this.party && this.party.filter((id) => s.get(id)).length < this.party.length / 3) { this.attackAt += 8; this.party = null; }
    // No march while an attack warning is fresh or enemies stand near the core.
    const raid = s.time < this.alarm || s.entities.some((e) => e.hp > 0 && e.kind === "unit" && s.hostile(team, e.team) && s.isVisible(e, team) && Math.hypot(e.x - hq.x, e.z - hq.z) < 30);
    if (fighters.length >= this.attackAt && s.time >= this.attackAfter && !raid && !fighters.some((e) => e.orders.length)) {
      s.updateKnownCores(team);
      // With no core in sight (an expansion the AI built out of view) the army sweeps the map.
      const target = [...s.knownCores[team].values()][0] || s.scoutDestination(team);
      if (target) {
        s.command({ team, type: "order", ids: fighters.map((e) => e.id), order: { type: "attackmove", x: target.x, z: target.z } });
        this.party = fighters.map((e) => e.id);
      }
    }
  }
}

const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const centre = (list) => ({ x: list.reduce((n, e) => n + e.x, 0) / list.length, z: list.reduce((n, e) => n + e.z, 0) / list.length });

// A player who reads the mission: the same economy as PlayBot, plus an army led by the
// objectives in the mission data. Nothing here knows a mission by name. It gathers a force at
// home, marches when it is strong enough, pulls back to rebuild when it is broken, and:
//   build        raises the building          collect   adds Harvesters and stays home
//   survive      stays home with more towers  reach     marches to the region
//   hold         splits into squads that stand on the nearest points
//   destroyTag / destroyCores   attacks the nearest target
//   escort       marches to the region; the tagged units follow and enter once it is clear
// Tagged units the mission must not lose (escort or tagLost tags) never fight. Without a base
// it leads the squad it was given. Abilities fire through autocast.
// Usage: const bot = new ObjectiveBot(sim, mission); call bot.step() once per tick.
export class ObjectiveBot extends PlayBot {
  constructor(sim, def, options = {}) {
    super(sim, { workers: 12, towers: 4, ...options, attackAt: Infinity });
    const rules = sim.mission.rules;
    this.def = def;
    this.base = rules.playerBase;
    // Fighters gathered before the army leaves home, and the size of a group of reinforcements.
    // A player reads the briefing and sees the guards, so a guarded field calls for a larger force.
    const guards = (def.setup || []).filter((x) => x.spawn && x.team > 0 && D[x.spawn].damage > 0).reduce((n, x) => n + (D[x.spawn].kind === "unit" ? x.count || 1 : 2), 0);
    this.marchAt = options.marchAt ?? (!this.base ? 0 : rules.ai ? 12 + 4 * sim.enemyCount + Math.min(8, Math.round(guards / 2)) : 6);
    this.marchAt += options.marchDelta || 0;
    this.joinAt = options.joinAt ?? 5;
    this.mode = this.base ? "gather" : "march";
    this.wards = new Set([...def.objectives.filter((o) => o.type === "escort").map((o) => o.tag), ...(def.lose || []).filter((l) => l.type === "tagLost").map((l) => l.tag)]);
    this.joined = new Set();
    this.squad = new Map();
    this.sent = new Map();
    this.rest = new Map();
    this.goal = null;
    // Troops the mission posts beside a far-off building it must not lose stay there as its guard.
    const hq = this.own("hq")[0];
    const posts = sim.own(this.team).filter((e) => e.kind === "building" && this.wards.has(e.tag) && (!hq || gap(e, hq) >= 40));
    this.guards = new Set(sim.own(this.team).filter((e) => e.kind === "unit" && posts.some((b) => gap(e, b) < 20)).map((e) => e.id));
  }
  order(units, order, key) {
    const ids = units.filter((e) => !e.orders.length || this.sent.get(e.id) !== key).map((e) => e.id);
    for (const id of ids) this.sent.set(id, key);
    if (ids.length) this.sim.command({ team: this.team, type: "order", ids, order });
  }
  // Armed enemies the player can see near a spot.
  threats(at, radius, unitsOnly = false) {
    const s = this.sim;
    return s.entities.filter((e) => e.hp > 0 && s.hostile(this.team, e.team) && e.damage > 0 && (!unitsOnly || e.kind === "unit") && gap(e, at) <= radius && s.isVisible(e, this.team));
  }
  // Required objectives the player can see and has not finished.
  open() {
    const state = this.sim.mission.objectives;
    return this.def.win.map((id) => this.def.objectives.find((o) => o.id === id)).filter((o) => o && state[o.id].state === "active" && !state[o.id].hidden);
  }
  // Where an objective is, for choosing the nearest one.
  place(o, from) {
    const s = this.sim, nearest = (list) => list.sort((a, b) => gap(a, from) - gap(b, from))[0] || null;
    if (o.type === "reach") return s.missionPlace(o.region);
    if (o.type === "escort") return s.missionPlace(o.to);
    if (o.type === "hold") return nearest(o.points.map((name) => s.missionPlace(name)));
    if (o.type === "destroyTag") return nearest(s.tagged(o.tag));
    if (o.type === "destroyCores") return nearest([...s.knownCores[this.team].values()]);
    return null;
  }
  step() {
    const s = this.sim;
    if (s.result || s.ticks % 20 !== 1) return;
    const open = this.open();
    if (this.base && s.ticks % 40 === 1) {
      const hq = this.own("hq").find((e) => e.complete);
      this.workers = open.some((o) => o.type === "collect") ? 16 : 12;
      this.towers = open.some((o) => o.type === "survive") ? 6 : 4;
      // The building an objective asks for comes before the usual build order.
      const sites = s.own(this.team).some((e) => e.kind === "building" && !e.complete);
      for (const o of open)
        if (hq && !sites && o.type === "build" && this.own(o.building).length < o.count && s.canPay(this.team, D[o.building].cost)) { this.build(o.building, hq); break; }
      super.step();
    }
    this.lead(open);
  }
  lead(open) {
    const s = this.sim, team = this.team;
    const units = s.own(team).filter((e) => e.kind === "unit" && e.type !== "worker" && !this.wards.has(e.tag) && !this.guards.has(e.id));
    const fighters = units.filter((e) => e.damage > 0), helpers = units.filter((e) => !(e.damage > 0));
    if (!fighters.length) return;
    const hq = this.own("hq")[0];
    // Home post: a little in front of the core, toward the middle of the map, or between the
    // core and a nearby building the mission says must not fall.
    let home = null;
    if (hq) {
      const d = Math.hypot(hq.x, hq.z) || 1;
      home = { x: hq.x - (hq.x / d) * 9, z: hq.z - (hq.z / d) * 9 };
      const ward = s.own(team).find((e) => e.kind === "building" && this.wards.has(e.tag) && gap(e, hq) < 40);
      if (ward) home = { x: (hq.x + ward.x) / 2, z: (hq.z + ward.z) / 2 };
    }
    const field = open.filter((o) => ["reach", "hold", "destroyTag", "destroyCores", "escort"].includes(o.type));
    const stay = !field.length || open.some((o) => o.type === "survive");
    if (home) {
      // An attack warning or enemies at the gate hold a gathering army at home. A warning also
      // calls a marching army back to defend the camp (squads holding capture points stay, and
      // so does an army already fighting beside the camp); it goes out again when the wave is broken.
      const raid = this.threats(home, 24, true).length >= 4, lead = gap(centre(fighters), home);
      const holding = field.some((o) => o.id === this.goal && o.type === "hold");
      const recall = holding ? raid && lead > 28 && lead < 60 : (raid && lead > 28) || (s.time < this.alarm && lead > 28);
      if (this.mode === "gather" && fighters.length >= (this.back ? this.marchAt * 0.6 : this.marchAt) && !raid && s.time >= this.alarm) { this.mode = "march"; this.back = false; }
      else if (this.mode === "march" && fighters.length < Math.max(3, this.marchAt * 0.4)) this.mode = "gather";
      else if (this.mode === "march" && recall) { this.mode = "gather"; this.back = true; }
    }
    if (home && (stay || this.mode === "gather")) {
      // No field work, or too weak for it: everyone stands at the home post.
      this.joined.clear();
      this.squad.clear();
      // A broken army walks home without stopping to fight; near home it fights again, and it
      // goes out to meet enemies who stand off and shoot at the Harvesters.
      const near = fighters.filter((e) => gap(e, home) <= 40), foe = this.threats(home, 48, true).sort((a, b) => gap(a, home) - gap(b, home))[0];
      this.order(fighters.filter((e) => gap(e, home) > 40), { type: stay ? "attackmove" : "move", ...home }, "retreat");
      if (foe && gap(foe, home) > 14) this.order(near, { type: "attackmove", x: foe.x, z: foe.z }, "meet:" + foe.id);
      else this.order(near.filter((e) => gap(e, home) > 12), { type: "attackmove", ...home }, "home");
      this.follow(helpers, centre(fighters));
      this.guide(null, fighters);
      return;
    }
    // Fresh troops wait at home until a group has formed, then join the army.
    for (const id of this.joined) if (!s.get(id)) this.joined.delete(id);
    const waiting = fighters.filter((e) => !this.joined.has(e.id));
    if (!home || !this.joined.size || waiting.length >= this.joinAt) for (const e of waiting) this.joined.add(e.id);
    const army = fighters.filter((e) => this.joined.has(e.id)), lead = centre(army);
    // Keep to one objective until it is done; then take the nearest. Escorts come last.
    if (!field.some((o) => o.id === this.goal)) {
      const ranked = field.map((o) => ({ o, p: this.place(o, lead) })).filter((c) => c.p).sort((a, b) => (a.o.type === "escort") - (b.o.type === "escort") || gap(a.p, lead) - gap(b.p, lead));
      this.goal = ranked[0]?.o.id ?? null;
    }
    const o = field.find((x) => x.id === this.goal);
    if (!o) return;
    if (o.type === "reach") {
      const p = s.missionPlace(o.region);
      this.order(army.filter((e) => gap(e, p) > p.r * 0.5), { type: "attackmove", x: p.x, z: p.z }, o.id);
    } else if (o.type === "hold") {
      // While the camp is under attack, half of the holding force goes home to defend it.
      const raided = home && (s.time < this.alarm || this.threats(home, 24, true).length >= 4);
      const back = raided ? army.filter((e, i) => i % 2 && gap(centre(army), home) > 28) : [];
      this.order(back, { type: "attackmove", ...home }, "relief");
      this.hold(o, army.filter((e) => !back.includes(e)), home || lead);
    }
    else if (o.type === "escort") {
      // The army clears the road a short way ahead of what it protects, never further.
      const p = this.ahead(o);
      this.order(army.filter((e) => gap(e, p) > 5), { type: "attackmove", x: p.x, z: p.z }, "lead:" + Math.round(p.x / 5) + ":" + Math.round(p.z / 5));
    } else {
      const t = this.place(o, lead);
      if (t) {
        const seen = s.get(t.id) && s.isVisible(t, team);
        // Clear the defenders first; then everyone shoots the target itself.
        if (seen && !this.threats(t, 18).some((e) => e.id !== t.id)) this.order(army, { type: "attack", target: t.id }, "hit:" + t.id);
        else this.order(army, { type: "attackmove", x: t.x, z: t.z }, "to:" + t.id);
      }
    }
    // A squad with no camp behind it rests after a fight until Medics and shields have done their work.
    // (People only: Medics cannot mend machines. A rest lasts at most 45 seconds.)
    if (!home && !this.threats(lead, 22).length) {
      const people = army.filter((e) => !e.mechanical && e.type !== "breaker");
      const health = people.reduce((n, e) => n + e.hp + e.shield, 0) / (people.reduce((n, e) => n + e.maxHp + e.maxShield, 0) || 1);
      if (helpers.length && people.length && health < (this.restFrom ? 0.92 : 0.75) && s.time - (this.restFrom ?? s.time) < 45) {
        this.restFrom ??= s.time;
        this.order(army.filter((e) => e.orders.length), { type: "stop" }, "rest");
        this.follow(helpers, lead); this.guide(null, army);
        return;
      }
      if (this.restFrom !== undefined && health >= 0.75) this.restFrom = undefined;
    }
    this.follow(helpers, lead);
    this.guide(o, army);
  }
  // Squads stand on the capture points nearest home, as many as the objective needs.
  hold(o, army, from) {
    const s = this.sim, points = s.mission.points;
    const chosen = o.points.filter((name) => points[name]).sort((a, b) => (points[b].owner === this.team) - (points[a].owner === this.team) || gap(points[a], from) - gap(points[b], from)).slice(0, o.need);
    const size = Object.fromEntries(chosen.map((name) => [name, 0]));
    for (const [id, name] of this.squad) { if (!s.get(id) || !(name in size)) this.squad.delete(id); else size[name]++; }
    for (const e of army) {
      if (this.squad.has(e.id)) continue;
      const name = chosen.reduce((best, n) => (size[n] < size[best] ? n : best), chosen[0]);
      this.squad.set(e.id, name); size[name]++;
    }
    for (const name of chosen) {
      const p = points[name];
      this.order(army.filter((e) => this.squad.get(e.id) === name && gap(e, p) > p.r * 0.6), { type: "attackmove", x: p.x, z: p.z }, name);
    }
  }
  // Medics and Engineers keep up with the fighters.
  follow(helpers, at) {
    const late = helpers.filter((e) => gap(e, at) > 9 && e.orders[0]?.type !== "attackmove");
    if (late.length) this.sim.command({ team: this.team, type: "order", ids: late.map((e) => e.id), order: { type: "attackmove", x: at.x, z: at.z } });
  }
  // The spot on the escort's road about 18 m ahead of the slowest tagged unit (the region itself when close).
  ahead(o) {
    const s = this.sim, p = s.missionPlace(o.to), cargo = s.tagged(o.tag).filter((e) => e.team === this.team && e.kind === "unit");
    if (!cargo.length) return p;
    const last = cargo.reduce((a, b) => (gap(a, p) > gap(b, p) ? a : b));
    let from = last, left = 18;
    for (const node of s.nav.path(last, p, last.radius)) {
      const d = gap(from, node);
      if (d >= left) return { x: from.x + ((node.x - from.x) * left) / d, z: from.z + ((node.z - from.z) * left) / d, r: p.r };
      left -= d; from = node;
    }
    return p;
  }
  // Tagged units the mission must keep alive wait where they started. During their escort
  // they walk behind the army and stop whenever armed enemies are near the road ahead.
  guide(goal, army) {
    const s = this.sim;
    const cargo = s.own(this.team).filter((e) => e.kind === "unit" && this.wards.has(e.tag));
    for (const e of cargo) {
      if (!this.rest.has(e.id)) this.rest.set(e.id, { x: e.x, z: e.z });
      if (goal?.type !== "escort" || e.tag !== goal.tag) { if (gap(e, this.rest.get(e.id)) > 4) this.walk(e, this.rest.get(e.id)); continue; }
      const p = this.ahead(goal), lead = centre(army);
      const safe = !this.threats(p, 16).length && !this.threats(e, 16).length && gap(lead, p) < 14;
      if (safe) this.walk(e, gap(e, s.missionPlace(goal.to)) < 20 ? s.missionPlace(goal.to) : p);
      else if (e.orders.length && (this.threats(p, 16).length || gap(lead, e) > 12)) this.walk(e, gap(lead, e) > 12 && !this.threats(lead, 12).length ? lead : e);
    }
  }
  walk(e, to) {
    const o = e.orders[0];
    if (o?.type === "move" && Math.hypot(o.x - to.x, o.z - to.z) < 3) return;
    this.sim.command({ team: this.team, type: "order", ids: [e.id], order: { type: "move", x: to.x, z: to.z } });
  }
}
