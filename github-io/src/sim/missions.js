import { difficultyRules, difficultySpeed, objectiveText } from "../difficulty.js";
import { DEFINITIONS as D, distance } from "../data.js";

// Campaign missions (format: docs/MISSIONS.md). A mission is plain data given to the
// Simulation; this system applies its setup, tracks capture points and objectives, fires
// triggers and decides victory and defeat. Everything it keeps is in `this.mission`, so a
// mission is saved, loaded and replayed like any other match. The interface learns what
// happened only through events: say, objective, point, camera, ping, music, missionEnd.

// Seconds a team must stand unopposed on a capture point to take it.
const CAPTURE_SECONDS = 5;
// Capture points and objectives are checked this often (seconds); triggers every tick.
const CHECK = 0.25;

const fighter = (e) => e.kind === "unit" && e.type !== "worker" && e.damage > 0 && e.hp > 0;

// Scaled wave sizes round up, except heavy machines (supply 3 or more: tanks, Walkers, Breakers),
// which round to nearest: one Walker more is a far bigger step than one Scrapper more.
export const waveCount = (count, scale, d) => Math.max(1, (d?.pop || 1) >= 3 ? Math.round(count * scale) : Math.ceil(count * scale));
export const missions = {
  initMission(def) {
    this.missionDef = def;
    const rules = { ai: true, playerBase: true, enemyBase: true, ...def.rules };
    this.mission = {
      id: def.id,
      rules,
      clock: 0,
      objectives: Object.fromEntries(def.objectives.map((o) => [o.id, { state: "active", hidden: !!o.hidden, have: 0, held: 0 }])),
      fired: {},
      points: {},
      banked: { alloy: 0, energy: 0 },
      medal: null,
    };
    // rules.ai: true (full computer opponent), "home" (builds, harvests and defends but never attacks; the script sends the waves) or false (no AI).
    if (!rules.ai) this.aiEnabled = false;
    this.aiHome = rules.ai === "home";
    // A side without a base takes the field with only what the setup gives it.
    const clear = (team) => { for (const e of this.own(team)) e.hp = 0; };
    if (!rules.playerBase) clear(0);
    if (!rules.enemyBase) {
      for (let team = 1; team < this.players.length; team++) { clear(team); this.players[team].eliminated = true; }
      this.aiEnabled = false;
    }
    this.entities = this.entities.filter((e) => e.hp > 0);
    if (rules.unlock) this.unlockUnits(0, rules.unlock);
    for (const step of def.setup || []) this.missionSetup(step);
    this.players[0].alloy += difficultyRules(this).alloy;
    if (def.defence) this.initDefence(def.defence);
    this.nav.rebuild(this.entities);
    this.updateVision();
  },
  // A region by name, a literal { x, z }, or one of the named places every mission has.
  missionPlace(at, team = 1) {
    if (at && typeof at === "object") return { r: 6, ...at };
    if (at === "playerBase" || at === "enemyBase") {
      const side = at === "playerBase" ? 0 : team || 1;
      const core = this.own(side).find((e) => e.type === "hq") || this.knownCores[side === 0 ? 1 : 0]?.values().next().value;
      return core ? { x: core.x, z: core.z, r: 10 } : { x: 0, z: 0, r: 10 };
    }
    const region = this.missionDef.regions?.[at];
    return region ? { r: 6, ...region } : { x: 0, z: 0, r: 6 };
  },
  // The i-th free standing spot around a place: rings of eight, 1.8 m apart.
  missionSpot(place, i, radius = 0.7) {
    for (let k = i, tries = 0; tries < 90; k++, tries++) {
      const ring = Math.floor(k / 8) + (k ? 1 : 0), angle = (k % 8) * (Math.PI / 4) + ring * 0.4;
      const x = place.x + Math.cos(angle) * ring * 1.8, z = place.z + Math.sin(angle) * ring * 1.8;
      if (this.nav.canStand(x, z, radius)) return { x, z };
    }
    return { x: place.x, z: place.z };
  },
  missionSpawn({ spawn, team = 0, at, count = 1, tag, name, hp, hpByDifficulty, speed, complete = true, exact = false }) {
    // exact: the script names this very type (a Breaker battery stays Breakers on an Ashfall roster).
    if (!exact) spawn = this.typeFor(team,spawn);
    hp = hpByDifficulty?.[this.difficulty] ?? hp;
    const d = D[spawn];
    if (!d || !this.players[team]) return [];
    const place = this.missionPlace(at, team), made = [];
    for (let i = 0; i < count; i++) {
      // A single building stands exactly on its place; everything else takes the nearest free spot.
      const spot = d.kind === "building" && count === 1 ? place : this.missionSpot(place, i, d.radius || 0.7);
      const e = this.spawn(spawn, team, spot.x, spot.z, complete, exact);
      if (tag) e.tag = tag;
      if (name) e.name = name;
      if (hp) e.hp = e.maxHp = hp;
      if (speed) e.speed = speed;
      made.push(e);
    }
    return made;
  },
  missionSetup(step) {
    // Enemy units placed by the setup are a garrison: they guard their spot and the AI leaves them out of its waves.
    if (step.spawn) for (const e of this.missionSpawn(step)) { if (e.team > 0 && e.kind === "unit") e.garrison = true; }
    else if (step.capturePoint) {
      const place = this.missionPlace(step.capturePoint);
      this.mission.points[step.capturePoint] = { x: place.x, z: place.z, r: place.r, owner: step.owner ?? null, taker: null, since: 0, gives: step.gives || null };
    } else if (step.resources) Object.assign(this.players[0], step.resources);
  },
  tagged(tag) {
    return this.entities.filter((e) => e.tag === tag && e.hp > 0);
  },
  // A delivery or grant counts toward `collect` objectives (spending does not undo it).
  missionBank(team, type, amount) {
    if (this.mission && team === 0 && amount > 0) this.mission.banked[type] += amount;
  },
  stepMission(dt) {
    const m = this.mission, def = this.missionDef;
    if (!m || this.result) return;
    m.clock += dt;
    // Point income is paid every tick so the totals do not depend on the check interval.
    for (const p of Object.values(m.points))
      if (p.gives && p.owner !== null && this.players[p.owner] && !this.players[p.owner].eliminated)
        for (const [type, rate] of Object.entries(p.gives)) {
          this.players[p.owner][type] += rate * dt;
          this.missionBank(p.owner, type, rate * dt);
        }
    // Carry the remainder over (and allow for float residue), so the checks credit exactly the time that passed.
    m.due = (m.due ?? 0) - dt;
    if (m.due <= 1e-9) {
      m.due += CHECK;
      this.stepPoints(CHECK);
      for (const o of def.objectives) this.stepObjective(o, m.objectives[o.id], CHECK);
    }
    for (let i = 0; i < (def.triggers || []).length; i++) this.stepTrigger(def.triggers[i], i);
  },
  // Skirmish capture points (see sim/points.js): the same ring mechanics, a small steady income.
  stepSkirmishPoints(dt) {
    const points = this.skirmishPoints;
    if (!points || this.mission) return;
    for (const p of Object.values(points))
      if (p.gives && p.owner !== null && this.players[p.owner] && !this.players[p.owner].eliminated)
        for (const [type, rate] of Object.entries(p.gives)) this.players[p.owner][type] += rate * dt;
    this.pointDue = (this.pointDue ?? 0) - dt;
    if (this.pointDue <= 1e-9) {
      this.pointDue += CHECK;
      this.stepPoints(CHECK, points);
    }
  },
  stepPoints(dt, points = this.mission.points) {
    for (const [name, p] of Object.entries(points)) {
      const present = new Set();
      for (const e of this.entities) if (fighter(e) && distance(e, p) <= p.r) present.add(e.team);
      // Allied AIs count as one side: they never contest each other's points.
      const sides = [...present].filter((team, i, all) => !all.slice(0, i).some((other) => !this.hostile(team, other)));
      const taker = sides.length === 1 && sides[0] !== p.owner && (p.owner === null || this.hostile(sides[0], p.owner)) ? sides[0] : null;
      if (taker === null) { p.taker = null; p.since = 0; continue; }
      if (p.taker !== taker) { p.taker = taker; p.since = 0; }
      p.since += dt;
      if (p.since >= CAPTURE_SECONDS) {
        const previous = p.owner;
        p.owner = taker; p.taker = null; p.since = 0;
        this.events.push({ type: "point", name, owner: taker, previous, x: p.x, z: p.z });
      }
    }
  },
  setObjective(id, state) {
    const o = this.mission.objectives[id];
    if (!o || o.state === state || o.state !== "active") return;
    o.state = state;
    if (o.hidden && state === "done") o.hidden = false;
    this.events.push({ type: "objective", id, state });
  },
  stepObjective(o, s, dt) {
    // A hidden objective does not count until a trigger reveals it.
    if (s.state !== "active" || s.hidden) return;
    const inside = (e, region) => { const p = this.missionPlace(region); return distance(e, p) <= p.r; };
    let done = false;
    if (o.type === "destroyCores") done = !this.entities.some((e) => e.type === "hq" && e.hp > 0 && this.hostile(0, e.team));
    else if (o.type === "destroyTag") done = (s.seen ||= this.tagged(o.tag).length > 0) && !this.tagged(o.tag).length;
    else if (o.type === "hold") {
      s.have = o.points.filter((name) => this.mission.points[name]?.owner === 0).length;
      s.held = s.have >= o.need ? s.held + dt : 0;
      // Nobody left to take the points back: the hold is won as soon as they are ours.
      const contested = this.entities.some((e) => e.hp > 0 && e.kind === "unit" && e.damage > 0 && e.type !== "worker" && this.hostile(0, e.team));
      done = s.held >= o.seconds || (s.have >= o.need && !contested);
    } else if (o.type === "survive") { s.held = this.mission.clock; done = this.mission.clock >= o.seconds; }
    else if (o.type === "escort") {
      const group = this.tagged(o.tag);
      if (!group.length) return this.setObjective(o.id, "failed");
      s.have = group.filter((e) => inside(e, o.to)).length;
      done = s.have === group.length;
    } else if (o.type === "collect") {
      const b = this.mission.banked;
      s.have = Math.min(o.alloy ? b.alloy / o.alloy : 1, o.energy ? b.energy / o.energy : 1);
      done = s.have >= 1;
    } else if (o.type === "build") {
      s.have = this.own(0).filter((e) => e.type === o.building && e.complete).length;
      done = s.have >= o.count;
    } else if (o.type === "reach") done = this.own(0).some((e) => fighter(e) && inside(e, o.region));
    else if (o.type === "waves") s.have = this.defence?.cleared ?? 0; // done by defenceResult()
    if (done) this.setObjective(o.id, "done");
  },
  missionCondition(when) {
    const m = this.mission;
    if (when.time !== undefined) return m.clock >= when.time;
    if (when.enter) { const p = this.missionPlace(when.enter); return this.own(when.team ?? 0).some((e) => e.kind === "unit" && distance(e, p) <= p.r); }
    if (when.objective) return m.objectives[when.objective]?.state === (when.is || "done");
    if (when.event) return this.events.slice(this.tickEvents).some((e) => e.type === when.event && (when.event !== "incoming" || e.team === 0));
    if (when.tagHpBelow) { const g = this.tagged(when.tagHpBelow.tag); return g.length > 0 && g.some((e) => e.hp / e.maxHp < when.tagHpBelow.percent / 100); }
    if (when.tagDead) return (m.fired["seen:" + when.tagDead] ||= this.tagged(when.tagDead).length > 0) && !this.tagged(when.tagDead).length;
    if (when.count) return this.own(when.count.team ?? 0).filter((e) => e.type === this.typeFor(when.count.team ?? 0,when.count.type) && e.complete !== false).length >= when.count.atLeast;
    if (when.pointOwned) return m.points[when.pointOwned.point]?.owner === (when.pointOwned.team ?? 0);
    return false;
  },
  stepTrigger(trigger, index) {
    const m = this.mission, last = m.fired[index];
    if (last !== undefined && !(trigger.repeat && m.clock - last >= trigger.repeat)) return;
    if (!this.missionCondition(trigger.when)) return;
    m.fired[index] = m.clock;
    for (const action of trigger.do || []) this.missionAction(action);
  },
  missionAction(a) {
    if (a.say) this.events.push({ type: "say", who: a.say.who, text: a.say.text });
    else if (a.wave) {
      const team = a.wave.team ?? 1;
      if (!this.players[team] || this.players[team].eliminated) return;
      const from = this.missionPlace(a.wave.from ?? "enemyBase", team), target = this.missionPlace(a.wave.target ?? "playerBase", team);
      const ids = [];
      for (const [type, count] of Object.entries(a.wave.units))
        for (const e of this.missionSpawn({ spawn: type, team, at: from, count: waveCount(count, difficultyRules(this).wave, D[this.typeFor(team, type)]) })) ids.push(e.id);
      if (ids.length) {
        this.issue(ids, { type: "attackmove", x: target.x, z: target.z });
        this.events.push({ type: "incoming", team: 0, x: from.x, z: from.z, count: ids.length });
      }
    } else if (a.spawn) this.missionSpawn(a);
    else if (a.reveal) { const o = this.mission.objectives[a.reveal]; if (o?.hidden) { o.hidden = false; this.events.push({ type: "objective", id: a.reveal, state: "revealed" }); } }
    else if (a.complete) this.setObjective(a.complete, "done");
    else if (a.fail) this.setObjective(a.fail, "failed");
    else if (a.give) for (const [type, amount] of Object.entries(a.give)) { this.players[0][type] += amount; this.missionBank(0, type, amount); }
    else if (a.camera || a.ping) { const p = this.missionPlace(a.camera || a.ping); this.events.push({ type: a.camera ? "camera" : "ping", x: p.x, z: p.z }); }
    else if (a.aiSpeed) this.setAiSpeed(difficultySpeed(a.aiSpeed, this.difficulty));
    else if (a.music) this.events.push({ type: "music", mood: a.music });
    else if (a.unlock) { if (this.unlockUnits(0, a.unlock)) for (const type of a.unlock) this.message(`${D[type].name} can now be trained.`); }
  },
  // Victory, defeat or null, called from settle() with which teams still stand.
  missionResult(alive) {
    if (this.defence) return this.defenceResult();
    const m = this.mission, def = this.missionDef;
    const lose = def.lose || (m.rules.playerBase ? [{ type: "coreLost" }] : [{ type: "armyLost" }]);
    // Losing every Command core always ends a mission that gave the player a base.
    const lost = (m.rules.playerBase && !alive[0]) || lose.some((l) =>
      l.type === "coreLost" ? !alive[0]
        : l.type === "armyLost" ? !this.own(0).some((e) => e.kind === "unit")
          : l.type === "tagLost" ? (m.fired["had:" + l.tag] ||= this.tagged(l.tag).length > 0) && !this.tagged(l.tag).length
            : l.type === "time" ? m.clock >= l.seconds : false);
    const won = !lost && def.win.every((id) => m.objectives[id]?.state === "done");
    if (!lost && !won) return null;
    if (won) {
      for (const o of def.objectives) if (o.type === "timeUnder") this.setObjective(o.id, m.clock < o.seconds * difficultyRules(this).time ? "done" : "failed");
      const medals = def.medals || {};
      m.medal = medals.gold && m.clock <= medals.gold.seconds * difficultyRules(this).time ? "gold" : medals.silver && m.clock <= medals.silver.seconds * difficultyRules(this).time ? "silver" : "bronze";
    }
    this.events.push({ type: "missionEnd", result: won ? "victory" : "defeat", medal: m.medal, seconds: m.clock });
    return won ? "victory" : "defeat";
  },
  // What the interface shows: the visible objectives with their progress.
  missionStatus() {
    if (!this.mission) return null;
    return this.missionDef.objectives.filter((o) => !this.mission.objectives[o.id].hidden).map((o) => {
      const s = this.mission.objectives[o.id];
      return { id: o.id, text: objectiveText(o, this.difficulty), type: o.type, optional: !!o.optional, state: s.state, have: s.have, held: s.held, need: o.need ?? o.count ?? 1, seconds: (o.seconds ?? 0) * (o.type === "timeUnder" ? difficultyRules(this).time : 1) };
    });
  },
};
