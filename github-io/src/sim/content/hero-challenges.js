// H8 Hero challenges (HERO-COINS-PLAN.md, owner 2026-11-28): short scripted missions for Skywing in Hero mode, on
// existing maps, with the seeded simulation. Each is a plain mission (src/story/hero-challenges.js) that the mission
// engine runs as any other (setup, objectives, triggers, win and lose, sim/missions.js); this module is its own part:
//   setup      { challenge: true }, the last setup step: the hand-placed cover pieces and explosive hazards of the
//              challenge (sim.cover / sim.hazards, so Hero mode adds no seeded ones), Skywing (tag "hero"; on foot when
//              the challenge says so), the watchers (patrols walking a route, guards sweeping a view) and the state
//   objective  { type: "challenge", check }: "plant" (the charge is set), "escape" (then at the extraction point),
//              "nest" (on foot on the marked high ground), "convoy" (every truck stopped; failed once `limit` got away)
//   commands   { type: "challengePlant", team, on }  hold (on) or let go of the plant key / button
// Sabotage (kind "sabotage"): the hero starts unseen (cloaked for the enemy, sim/vision.js). A watcher sees it inside
// its cone (WATCH.range m, WATCH.half degrees each side of its facing; a wall or crate stack between them hides it,
// sandbags only when it is crouched), or anyone within WATCH.close m. Being seen fills a short "seen" meter
// (WATCH.rise a real second by difficulty; it drains at WATCH.fall); full, the alarm sounds: the hero can be seen as
// any unit, nearby enemies hunt it and a squad comes from the base. Never a failure. A shot that leaves its target
// alive, or a hazard blast before the charge, sounds it too. Each charge takes PLANT.seconds of holding still beside its
// relay; it blows PLANT.fuse seconds later (loud: everyone runs to the relay, the hero stays unseen), then the way out.
// Sniper nest (kind "sniper"): land on the marked high ground; the convoy (trucks, escorts) sets off when Skywing is
// in the nest or after `start` seconds, along its road to the exit; trucks that reach it get away.
// Times are real seconds (the clock runs at the battle-time scale in Hero mode), counted in `challenge.real`.
// Stars (challengeStars): 1 for the win, then Sabotage: no alarm, and under `stars.time` s; Sniper nest: no damage
// taken, and one hit on a convoy target from `stars.long` m or more. Failing gives no stars and blocks nothing.
// State `sim.challenge` exists only in a challenge (and entity keys `watch`, the hero's `cloaked`), so every other
// match saves and hashes as before.
import { distance } from "../../data.js";
import { difficultyRules } from "../../difficulty.js";
import { coverBlock, COVER_KINDS } from "../cover.js";
import { groundSkywing } from "./skywing.js";

export const WATCH = Object.freeze({ range: Object.freeze({ story: 8, standard: 9, veteran: 11 }), half: 34, close: 2.6, air: 1.3, rise: Object.freeze({ story: 1.5, standard: 2.4, veteran: 4 }), fall: 0.8, tall: 1.2, speed: 2.8 });
export const PLANT = Object.freeze({ reach: 2.8, seconds: 2, fuse: 4 });
const hyp = Math.hypot;
const diff = (sim) => (sim.difficulty === "story" || sim.difficulty === "veteran" ? sim.difficulty : "standard");
const scaled = (sim, n, heavy = false) => Math.max(1, heavy ? Math.round(n * difficultyRules(sim).wave) : Math.ceil(n * difficultyRules(sim).wave));

export const isChallenge = (sim) => !!sim.challenge && !!sim.missionDef?.challenge;
export const challengeHero = (sim) => (sim.skywing?.id != null ? sim.get(sim.skywing.id) : null) || null;
const place = (sim, at) => sim.missionPlace(at);
const inside = (e, p) => !!e && hyp(e.x - p.x, e.z - p.z) <= p.r;

// The stars a finished challenge earned: { stars, got: [won, second, third] }.
export function challengeStars(sim) {
  const c = sim.challenge, def = sim.missionDef?.challenge;
  if (!c || !def) return { stars: 0, got: [false, false, false] };
  const won = sim.result === "victory";
  const second = won && (def.kind === "sabotage" ? !c.alarm : c.hurt < 1);
  const third = won && (def.kind === "sabotage" ? c.real <= def.stars.time + 1e-9 : c.long >= def.stars.long - 1e-9);
  const got = [won, second, third];
  return { stars: got.filter(Boolean).length, got };
}

// Can `u` see the hero now (Sabotage): inside its cone and in clear view, or right next to it.
export function watcherSees(sim, u, hero) {
  const d = hyp(hero.x - u.x, hero.z - u.z);
  if (d <= WATCH.close) return true;
  if (!u.watch) return false;
  if (d > WATCH.range[diff(sim)] * (hero.flying ? WATCH.air : 1)) return false;
  const b = Math.atan2(hero.x - u.x, hero.z - u.z) - (u.angle || 0);
  if (Math.abs(Math.atan2(Math.sin(b), Math.cos(b))) > (WATCH.half * Math.PI) / 180) return false;
  if (hero.flying) return true;
  const block = coverBlock(sim.cover, u.x, u.z, hero.x, hero.z);
  if (block && (COVER_KINDS[sim.cover[block.piece][0]].h >= WATCH.tall || hero.crouched)) return false;
  return sim.nav.clearLine(u, hero, hero.id);
}

function hide(hero) { hero.cloaked = true; hero.seenBy = 0; }

function alarm(sim, c, def, hero, why) {
  if (c.alarm) return;
  c.alarm = true;
  c.alarmAt = sim.time;
  sim.uncloak(hero);
  const hunters = sim.entities.filter((e) => e.hp > 0 && e.kind === "unit" && e.damage > 0 && sim.hostile(0, e.team) && distance(e, hero) <= def.alarm.reach).map((e) => e.id);
  if (hunters.length) sim.issue(hunters, { type: "attackmove", x: hero.x, z: hero.z });
  const from = place(sim, def.alarm.from), ids = [];
  let i = 0;
  for (const [type, n] of Object.entries(def.alarm.units))
    for (let k = 0, count = scaled(sim, n); k < count; k++, i++) {
      const at = sim.missionSpot(from, i, 0.7);
      ids.push(sim.spawn(type, 1, at.x, at.z, true, true).id);
    }
  if (ids.length) sim.issue(ids, { type: "attackmove", x: hero.x, z: hero.z });
  sim.events.push({ type: "challengeAlarm", x: hero.x, z: hero.z, why, team: 0 });
  sim.events.push({ type: "incoming", team: 0, x: from.x, z: from.z, count: ids.length });
  sim.message("Alarm! You have been seen. Reinforcements are coming.");
}

function stepSabotage(sim, c, def, hero, real, k) {
  if (!c.alarm) hide(hero);
  // Guards sweep their view (a real-time swing, so it reads the same at every battle time).
  for (const e of sim.entities) if (e.watch && e.hp > 0 && e.sweep) { e.sweep.t += real; e.angle = e.sweep.a + e.sweep.w * Math.sin(e.sweep.t * e.sweep.v); }
  if (!c.alarm) {
    let seen = null;
    for (const u of sim.entities) {
      if (u.hp <= 0 || u.kind !== "unit" || !sim.hostile(0, u.team) || u === hero) continue;
      if (watcherSees(sim, u, hero)) { seen = u; break; }
    }
    c.seen = seen ? seen.id : null;
    const rise = WATCH.rise[diff(sim)];
    c.sus = Math.max(0, Math.min(1, (c.sus || 0) + (seen ? rise : -WATCH.fall) * real));
    if (c.sus >= 1) alarm(sim, c, def, hero, "seen");
  } else c.seen = null;
  // The charges: held still beside each relay in turn; each blows PLANT.fuse seconds after it is set.
  const still = !hero.drive && !hero.dash, ground = !hero.flying && !hero.skyland;
  c.near = null;
  for (const tag of def.relays) {
    const q = c.charges[tag], relay = sim.tagged(tag)[0];
    if (!relay) { if (!q.set) { q.set = q.blown = true; q.p = 1; } continue; }
    if (q.set) continue;
    if (ground && distance(hero, relay) - relay.radius <= PLANT.reach) c.near = tag;
  }
  if (c.near && c.planting && still) {
    const q = c.charges[c.near], relay = sim.tagged(c.near)[0];
    q.p = Math.min(1, q.p + real / PLANT.seconds);
    if (q.p >= 1) {
      q.set = true;
      q.at = sim.time + PLANT.fuse * k;
      sim.events.push({ type: "challengePlanted", tag: c.near, x: relay.x, z: relay.z, team: 0 });
      sim.message(def.relays.every((t) => c.charges[t].set) ? "Last charge set! Get to the extraction point." : "Charge set! On to the next relay.");
    }
  }
  for (const tag of def.relays) {
    const q = c.charges[tag];
    if (!q.set || q.blown || sim.time < q.at - 1e-9) continue;
    q.blown = true;
    const r = sim.tagged(tag)[0];
    if (!r) continue;
    sim.applyDamage(r, r.hp + (r.shield || 0) + 1, 0, hero.id);
    sim.events.push({ type: "strike", x: r.x, z: r.z, radius: 3, team: 0, victims: [] });
    // Loud: everyone near runs to look (the hero stays unseen unless a watcher spots it).
    const near = sim.entities.filter((e) => e.hp > 0 && e.kind === "unit" && e.damage > 0 && sim.hostile(0, e.team) && distance(e, r) <= def.alarm.reach).map((e) => e.id);
    if (near.length) sim.issue(near, { type: "attackmove", x: r.x, z: r.z });
    sim.message("A relay is down!");
  }
  c.plant = c.near ? c.charges[c.near].p : 0;
  c.set = def.relays.filter((t) => c.charges[t].set).length;
  c.planted = c.set === def.relays.length;
}

// One group of the convoy (def.convoy.groups[n]): trucks in a line along the road, escorts beside them.
function spawnGroup(sim, c, def, n) {
  const v = def.convoy, g = v.groups[n], d = diff(sim), route = v.route, a = route[0], b = route[1] || route[0];
  const dx = a.x - b.x, dz = a.z - b.z, l = hyp(dx, dz) || 1, back = { x: dx / l, z: dz / l }, facing = Math.atan2(-back.x, -back.z);
  for (let i = 0; i < g.trucks; i++) {
    const t = sim.spawn("carrier", 1, a.x + back.x * i * v.gap, a.z + back.z * i * v.gap, true, true);
    t.tag = "convoy"; t.name = "Supply truck"; t.hp = t.maxHp = v.hp[d] * (g.armour || 1); sim.setBaseHp(t); t.speed = v.speed[d];
    t.angle = facing;
    t.orders = route.slice(1).map((p) => ({ type: "move", x: p.x, z: p.z }));
  }
  const escorts = scaled(sim, g.escorts), span = Math.max(1, g.trucks - 1) * v.gap;
  for (let i = 0; i < escorts; i++) {
    const s0 = ((i + 0.5) * span) / escorts, side = i % 2 ? 1.8 : -1.8;
    const e = sim.spawn(v.escort, 1, a.x + back.x * s0 - back.z * side, a.z + back.z * s0 + back.x * side, true, true);
    e.tag = "escort"; e.speed = v.speed[d];
    e.angle = facing;
    e.orders = route.slice(1).map((p) => ({ type: "attackmove", x: p.x, z: p.z }));
  }
  c.group = n + 1;
  c.nextAt = null;
  sim.events.push({ type: "incoming", team: 0, x: a.x, z: a.z, count: g.trucks });
  sim.message(n === 0 ? "The convoy is moving. Stop the trucks before they reach the exit." : "More trucks on the road, with heavier plating!");
}

function stepSniper(sim, c, def, hero) {
  const nest = place(sim, def.nest), v = def.convoy;
  c.inNest = !!hero && inside(hero, nest) && !hero.flying && !hero.skyland;
  if (!c.group && (c.inNest || c.real >= v.start - 1e-9)) spawnGroup(sim, c, def, 0);
  if (!c.group) return;
  const exit = place(sim, v.exit);
  for (const e of sim.entities) {
    if (e.hp <= 0 || (e.tag !== "convoy" && e.tag !== "escort") || !inside(e, exit)) continue;
    e.hp = 0;
    if (e.tag === "convoy") {
      c.escaped = (c.escaped || 0) + 1;
      sim.events.push({ type: "challengeEscaped", x: e.x, z: e.z, team: 0, n: c.escaped });
      sim.message("A truck got through!");
    }
  }
  // The next group sets off `v.between` real seconds after the road is clear of trucks.
  if (c.group < v.groups.length && !sim.tagged("convoy").length) {
    c.nextAt ??= c.real + v.between;
    if (c.real >= c.nextAt - 1e-9) spawnGroup(sim, c, def, c.group);
  }
}

export const heroChallenges = {
  id: "hero-challenges",
  order: 47, // after Hero mode (46): the hero has moved and fired this tick
  mixin: {
    // The setup step { challenge: true } (sim/missions.js missionSetup): everything the challenge adds to the field.
    initChallenge() {
      const def = this.missionDef.challenge;
      // Its own cover and hazards: placed before Skywing comes, so Hero mode adds no seeded ones (sim/content/cover.js).
      this.cover = def.cover.map((p) => [...p]);
      this.hazards = (def.hazards || []).map(([x, z]) => [x, z, 1]);
      this.applyCover();
      this.nav.rebuild(this.entities);
      this.callSkywing(0);
      const hero = challengeHero(this);
      hero.tag = "hero";
      // The lose rule { tagLost: "hero" } counts from the start (sim/missions.js missionResult).
      this.mission.fired["had:hero"] = true;
      hero.x = def.start.x; hero.z = def.start.z; hero.angle = def.start.angle || 0; hero.post = { x: hero.x, z: hero.z };
      if (def.start.landed) groundSkywing(this, hero);
      if (def.kind === "sabotage") hide(hero);
      for (const w of def.watchers || []) {
        const e = this.spawn(w.type, 1, w.x, w.z, true, true);
        e.watch = 1;
        e.tag = w.to ? "patrol" : "guard";
        e.name = w.to ? "Patrol rifleman" : "Sentry";
        e.speed = WATCH.speed;
        e.angle = w.angle ?? (w.to ? Math.atan2(w.to.x - w.x, w.to.z - w.z) : 0);
        if (w.to) e.orders = [{ type: "patrol", x: w.to.x, z: w.to.z }];
        else { e.stance = "hold"; if (w.sweep) e.sweep = { a: e.angle, w: (w.sweep * Math.PI) / 180, v: w.speed || 0.9, t: 0 }; }
      }
      const life = hero.hp + (hero.shield || 0);
      this.challenge = { id: def.id, kind: def.kind, real: 0, hurt: 0, life, ...(def.kind === "sabotage"
        ? { sus: 0, alarm: false, plant: 0, planting: false, planted: false, set: 0, charges: Object.fromEntries(def.relays.map((t) => [t, { p: 0, set: false, blown: false, at: null }])) }
        : { group: 0, escaped: 0, trucks: def.convoy.groups.reduce((n, g) => n + g.trucks, 0), long: 0 }) };
      this.updateVision();
    },
    // { type: "challenge", check } objectives (sim/missions.js stepObjective): true when done, "failed", else false.
    challengeObjective(o, s) {
      const c = this.challenge, def = this.missionDef.challenge;
      if (!c) return false;
      const hero = challengeHero(this);
      if (o.check === "plant") { s.have = c.set; return !!c.planted; }
      if (o.check === "escape") return !!c.planted && inside(hero, place(this, def.extract));
      if (o.check === "nest") return !!c.inNest;
      if (o.check === "convoy") {
        const alive = this.tagged("convoy").length;
        const made = def.convoy.groups.slice(0, c.group).reduce((n, g) => n + g.trucks, 0);
        s.have = made - alive - (c.escaped || 0);
        if ((c.escaped || 0) >= def.convoy.limit[diff(this)]) return "failed";
        return c.group >= def.convoy.groups.length && alive === 0;
      }
      return false;
    },
    // Hero mode's hit hook (sim/content/hero-mode.js heroAfterShot): a shot that leaves a watcher alive during a
    // Sabotage sounds the alarm; a hit on a convoy target counts for the long-shot star.
    challengeShot(e, t, d, kill) {
      const c = this.challenge, def = this.missionDef?.challenge;
      if (!c || !def || e.team !== 0) return;
      if (def.kind === "sabotage" && !c.alarm && !kill) alarm(this, c, def, e, "shot");
      if (def.kind === "sniper" && t.tag === "convoy") c.long = Math.max(c.long || 0, Math.round(d * 10) / 10);
    },
    // A hazard blast set off by the hero (sim/content/hero-mode.js heroBarrel): before the charge, loud.
    challengeLoud(e) {
      const c = this.challenge, def = this.missionDef?.challenge;
      if (c && def?.kind === "sabotage" && !c.alarm && !c.planted) alarm(this, c, def, e, "blast");
    },
  },
  commands: {
    challengePlant: {
      allowed: (sim, c) => !!sim.challenge && sim.missionDef?.challenge?.kind === "sabotage" && typeof c.on === "boolean",
      run: (sim, c) => { sim.challenge.planting = c.on; return true; },
    },
  },
  step(sim, dt) {
    const c = sim.challenge, def = sim.missionDef?.challenge;
    if (!c || !def || sim.result) return;
    const hero = challengeHero(sim);
    if (!hero) return;
    const k = hero.driven ?? 1, real = dt / k;
    c.real += real;
    const life = hero.hp + (hero.shield || 0);
    if (life < c.life - 1e-6) c.hurt += c.life - life;
    c.life = life;
    if (def.kind === "sabotage") stepSabotage(sim, c, def, hero, real, k);
    else stepSniper(sim, c, def, hero);
  },
};
