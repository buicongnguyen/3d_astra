import { DEFINITIONS as D, MAX_POP, distance } from "../data.js";
import { roleOf } from "../ai-plan.js";
import { EXPAND_CREW } from "./expand.js";
import { aiAttack } from "./ai-attack.js";

// The computer opponent's build, production and attack decisions (coalition play is in ai-plan.js,
// field command in ai-attack.js). Mixed into Simulation (see simulation.js).
export const ai = {
  ...aiAttack,
  updateAI(team = 1) {
    // Tagged entities belong to the mission script (an objective, an escort): the AI never uses them.
    const own = this.own(team).filter((e) => !e.tag),
      workers = own.filter((e) => e.type === "worker"),
      army = own.filter((e) => e.kind === "unit" && e.type !== "worker" && !e.garrison);
    if (!own.some(e => e.type === "hq")) return;
    this.updateKnownCores(team);
    // The field commander (ai-attack.js) or null for the original AI.
    const cmd = this.aiCommandFor(team);
    if (this.pace.counter || cmd) this.observeEnemies(team);
    this.assignHarvesters(team);
    const hq = own.find((e) => e.type === "hq" && e.complete) || own.find(e => e.type === "hq");
    this.aiRetreat(team, army, hq);
    const pace = this.paceFor(team), role = roleOf(this, team), persona = this.personality(team), extra = this.factionFor(team).building;
    // A second core brings more Harvesters, trained at the core with the fewest nearby.
    const cores = own.filter((e) => e.type === "hq" && e.complete);
    const crewCap = pace.workers + EXPAND_CREW * Math.max(0, cores.length - 1);
    if (hq && workers.length < crewCap) {
      const near = (c) => workers.filter((w) => distance(w, c) < 30).length;
      const trainer = cores.filter((c) => !c.queue.length && !c.levelJob).sort((a, b) => near(a) - near(b) || a.id - b.id)[0];
      if (trainer) this.enqueue(trainer.id, "worker");
    }
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
    // Save alloy for the Command core upgrade once it is due; otherwise training and
    // builds spend every alloy as it arrives and tech never gets afforded.
    const hqDue = this.time > pace.techAt[0] && hq && !hq.levelJob && workers.length >= Math.min(9, pace.workers) && hq.level < (this.time > pace.techAt[1] ? 3 : 2);
    // A second core is due once the first is levelled; its alloy is saved like the core upgrade.
    const expanding = !hqDue && this.aiExpand(team, own, workers, hq, pace);
    const reserve = (hqDue ? this.levelCost(hq)[0] : 0) + (expanding ? D.hq.cost[0] : 0);
    const afford = (cost) => this.canPay(team, [cost[0] + reserve, cost[1]]);
    const pop = this.population(team);
    const want = !own.some((e) => e.type === "barracks")
      ? "barracks"
      : pop.cap - pop.used - pop.reserved < (pace.counter && this.players[team].alloy >= 400 ? 10 : 5) && pop.cap < MAX_POP
        ? "relay"
        : !own.some((e) => e.type === "foundry") && this.time > pace.foundryAt * (role === "siege" ? 0.6 : 1)
          ? "foundry"
          : pace.secondBarracks && this.time > pace.secondBarracks && own.filter((e) => e.type === "barracks").length < 2
            ? "barracks"
            : this.time > pace.towerAt && own.some((e) => e.type === "foundry" && e.complete) &&
                own.filter((e) => e.type === "tower").length < pace.towers + (role === "siege" ? 1 : 0)
              ? "tower"
              : this.factionBuilding(team, own, persona, extra) || this.surplusBuilding(team, own, role);
    if (
      want &&
      afford(D[want].cost) &&
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
    // The Barracks spends alloy in small steps and would starve the Foundry for good, so while
    // the Foundry stands idle, has the energy and vehicles are under a quarter of the army, infantry waits.
    const vehicles = army.filter((e) => e.mechanical).length;
    const foundryIdle = own.some((e) => e.type === "foundry" && e.complete && !e.levelJob && !e.queue.length);
    const hold = foundryIdle && vehicles * 4 < army.length && this.players[team].energy >= D.breaker.cost[1] ? D.breaker.cost[0] : 0;
    for (const b of own.filter((e) => e.complete && ["barracks", "foundry"].includes(e.type))) {
      if (b.levelJob) continue;
      const branch = this.researchBranch(team, role);
      if (b.type === "foundry" && !this.players[team].upgrade && !this.players[team].plating && this.time > pace.upgradeAt && vehicles >= 2 && !b.queue.length && afford(D[branch].cost) && this.enqueue(b.id, branch)) continue;
      // Skirmish AIs that counter-build also take the second tier of their branch once the Foundry is level 2.
      if (b.type === "foundry" && !this.mission && pace.counter && b.level >= 2 && !b.queue.length) {
        const pl = this.players[team], next = pl.upgrade && !pl.upgrade2 ? "upgrade2" : pl.plating && !pl.plating2 ? "plating2" : null;
        if (next && afford(D[next].cost) && this.enqueue(b.id, next)) continue;
      }
      if (b.level < this.techLevel(team) && this.time > pace.upgradeAt && afford(this.levelCost(b))) {
        if (!b.queue.length) this.upgradeBuilding(b.id,team);
        continue;
      }
      // Army size follows the speed's curve; a base under attack may always train.
      // In skirmish, alloy piling up beyond the cap is spent anyway: a rich base that sits idle looks broken.
      const cap = pace.army && (this.mission || this.players[team].alloy < 600) ? pace.army[0] + pace.army[1] * (this.time / 60) : Infinity;
      if (b.queue.length < 2 && (army.length + own.reduce((n, e) => n + (e.queue?.length || 0), 0) < cap || own.some((e) => e.kind === "building" && this.time - (e.hitAt ?? -99) < 10))) {
        // One Vanguard per two Rangers; a raider AI trains two Vanguards per Ranger.
        const cycle = Math.floor(this.time/4)%3;
        let choice = b.type === 'foundry' ? 'breaker' : cycle === 0 || (role === 'raider' && cycle === 1) ? 'vanguard' : 'ranger';
        if (b.type === 'foundry' && b.level >= 3 && army.filter(e => this.slotOf(e.type) === 'tank').length <= army.filter(e => this.slotOf(e.type) === 'breaker').length + (role === 'siege' ? 2 : 0)) choice = 'tank';
        if (b.type === 'barracks' && b.level >= 2 && army.filter(e => this.slotOf(e.type) === 'antitank').length < 3) choice = 'antitank';
        choice = this.counterChoice(team, b, army, choice);
        const support = b.type === 'foundry' ? 'engineer' : 'medic';
        if (b.level >= 2 && army.filter(e => this.slotOf(e.type) === support).length < 2) choice = support;
        const choices = [...new Set([choice,...(b.type === 'barracks' ? ['ranger','vanguard'] : ['breaker'])].map(slot => this.typeFor(team,slot)))].filter(type => this.canTrain(team,type));
        const pop = this.population(team);
        const save = b.type === 'barracks' ? hold : 0;
        const affordable = choices.find(type => b.level >= (D[type].required_level || 1) && afford([D[type].cost[0] + save, D[type].cost[1]]) && pop.used+pop.reserved+D[type].pop <= pop.cap);
        if (affordable) this.enqueue(b.id,affordable);
      }
    }
    const threats = hq
      ? this.entities
          .filter((e) => this.hostile(team, e.team) && e.hp > 0 && this.isVisible(e, team) && (distance(hq, e) < 25 || (e.kind === "unit" && distance(hq, e) < (pace.defendRadius ?? 25))))
          .sort((a, b) => distance(hq, a) - distance(hq, b))
      : [];
    const threatIds = new Set(threats.map((e) => e.id));
    const engaged = (e) => e.orders[0]?.type === "attack" && threatIds.has(e.orders[0].target);
    let incursion = false;
    if (threats.length) {
      const power = threats.reduce(
        (sum, e) => sum + (e.kind === "building" ? (e.damage ? 4 : 1) : e.type === "worker" ? 0.5 : e.pop || 1),
        0,
      );
      incursion = power >= 4;
      const ready = army.filter(
        (e) => e.damage > 0 && !e.retreating && (!e.orders.length || e.orders[0].type !== "attack"),
      );
      // A real incursion recalls everyone. A lone scout or harvester is answered by units
      // near the core, or the two closest units if none are home, and never recalls a wave.
      const home = ready.filter((e) => distance(e, hq) < 40);
      const answer = incursion
        ? ready
        : home.length
          ? home
          : ready.sort((a, b) => distance(a, hq) - distance(b, hq)).slice(0, 2);
      if (cmd && incursion) this.aiDefend(team, answer, threats[0]);
      else if (answer.length)
        this.issue(answer.map((e) => e.id), { type: "attack", target: threats[0].id });
    }
    // A mission that sends its own waves lets the computer build up and defend at home only.
    if (this.aiHome) return;
    if (!cmd && persona?.retreat && hq && this.aiFallBack(team, hq, army, pace, persona.retreat)) return;
    if (!incursion) this.aiPoints(team, hq, army, pace);
    const wave = army.filter((e) => !engaged(e) && !e.pointDuty && !e.retreating);
    if (cmd && hq) this.aiWatch(team, hq, army, cmd);
    if (this.coalition) {
      this.coalitionOrders(team, { hq, army, wave, incursion });
      return;
    }
    if (persona?.raid && hq && !incursion) this.aiRaid(team, hq, wave, persona.raid);
    if (cmd) {
      if (hq) this.aiWave(team, hq, wave, incursion, pace, cmd);
      return;
    }
    if (!incursion && this.time >= this.waveAt[team] && wave.length >= pace.minWave) {
      const target = [...this.knownCores[team].values()]
        .sort((a, b) => distance(hq, a) - distance(hq, b))[0] || this.scoutDestination(team);
      // Faction AIs form up first: the wave meets at a point outside the base on the road to the
      // target and marches together, instead of arriving one unit at a time.
      if (persona && target && hq && !this.aiFormed(team, hq, target, wave)) return;
      if (target) this.issue(wave.map(e => e.id), { type: "attackmove", x: target.x, z: target.z });
      if (target?.team !== undefined) this.events.push({ type: "incoming", team: target.team, x: hq.x, z: hq.z, count: wave.length });
      this.waveAt[team] = this.time + pace.waveGap;
    }
  },
  // True once the wave stands together at its rally point (or after 25 s of waiting). Until then
  // it orders stragglers there. The point is 14 m from the core towards the target.
  aiFormed(team, hq, target, wave) {
    const form = (this.aiForm ||= {})[team];
    if (!form || form.wave !== this.waveAt[team]) {
      const d = distance(hq, target) || 1, x = hq.x + ((target.x - hq.x) / d) * 14, z = hq.z + ((target.z - hq.z) / d) * 14;
      const spot = this.nav.canStand(x, z, 1) ? { x, z } : this.nav.nearest(x, z, 1) || { x: hq.x, z: hq.z };
      this.aiForm[team] = { wave: this.waveAt[team], x: spot.x, z: spot.z, until: this.time + 25 };
      this.issue(wave.map((e) => e.id), { type: "move", x: spot.x, z: spot.z });
      return false;
    }
    const away = wave.filter((e) => distance(e, form) > 7);
    if (away.length && this.time < form.until) {
      const idle = away.filter((e) => !e.orders.length);
      if (idle.length) this.issue(idle.map((e) => e.id), { type: "move", x: form.x, z: form.z });
      return false;
    }
    return true;
  },
  // A faction's own building: Ashfall's yard right after the first Barracks, the others once the
  // Foundry stands. Wardens add a Pylon for every production building.
  factionBuilding(team, own, persona, type) {
    if (!type || !own.some((e) => e.type === "barracks" && e.complete)) return null;
    if (persona?.building !== "early" && !own.some((e) => e.type === "foundry" && e.complete)) return null;
    const have = own.filter((e) => e.type === type).length;
    const wanted = persona?.building === "each" ? Math.min(3, own.filter((e) => e.type === "barracks" || e.type === "foundry").length) : 1;
    return have < wanted ? type : null;
  },
  // Sunward: shortly before each wave, its fastest idle fighters go for the Harvesters at the
  // nearest known enemy core. One raid per wave.
  aiRaid(team, hq, wave, size) {
    if (this.time < this.waveAt[team] - 20 || this.aiRaidFor?.[team] === this.waveAt[team]) return;
    const core = [...this.knownCores[team].values()].sort((a, b) => distance(hq, a) - distance(hq, b) || a.id - b.id)[0];
    const deposit = core && this.resources.filter((r) => r.amount > 0).sort((a, b) => distance(core, a) - distance(core, b) || a.id - b.id)[0];
    const raiders = wave.filter((e) => e.damage > 0 && !e.orders.length).sort((a, b) => b.speed - a.speed || a.id - b.id).slice(0, size);
    if (!deposit || raiders.length < 2) return;
    (this.aiRaidFor ||= {})[team] = this.waveAt[team];
    this.issue(raiders.map((e) => e.id), { type: "attackmove", x: deposit.x, z: deposit.z });
    if (core.team === 0) this.message("Scouts report enemy raiders heading for your Harvesters.");
  },
  // Veil: a force in the field that sees itself outnumbered (by supply, `ratio` to 1) goes home
  // and the next wave waits. Only enemies this team can see are counted.
  aiFallBack(team, hq, army, pace, ratio) {
    const out = army.filter((e) => e.orders[0]?.type === "attackmove" && distance(e, hq) > 40);
    if (!out.length) return false;
    const seen = new Set();
    for (const e of out)
      for (const t of this.entities)
        if (t.hp > 0 && t.kind === "unit" && t.damage > 0 && this.hostile(team, t.team) && distance(e, t) < 16 && this.isVisible(t, team)) seen.add(t);
    let foes = 0, mine = 0;
    for (const t of seen) foes += t.pop || 1;
    for (const e of out) mine += e.pop || 1;
    if (foes < mine * ratio) return false;
    this.issue(out.map((e) => e.id), { type: "move", x: hq.x, z: hq.z });
    this.waveAt[team] = Math.max(this.waveAt[team], this.time + pace.waveGap / 2);
    return true;
  },
  stepAI(dt) {
    if (this.aiEnabled) {
      this.aiClock -= dt;
      if (this.aiClock <= 0) {
        this.aiTurn = 1;
        if (this.aiPlayer) this.updateAI(0);
        this.aiClock = this.pace.think;
      }
      // One AI thinks per tick, so three rivals placing buildings do not land in the same step.
      if (this.aiTurn) {
        this.updateAI(this.aiTurn);
        if (++this.aiTurn >= this.players.length) {
          this.aiTurn = 0;
          if (this.coalition) this.advanceCoalition();
        }
      }
    }
  },
};
