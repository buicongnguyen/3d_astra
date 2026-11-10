import { DEFINITIONS as D, MAX_POP, distance } from "../data.js";
import { roleOf } from "../ai-plan.js";
import { EXPAND_CREW } from "./expand.js";

// The computer opponent's build, production and attack decisions (coalition play is in ai-plan.js). Mixed into Simulation (see simulation.js).
export const ai = {
  updateAI(team = 1) {
    // Tagged entities belong to the mission script (an objective, an escort): the AI never uses them.
    const own = this.own(team).filter((e) => !e.tag),
      workers = own.filter((e) => e.type === "worker"),
      army = own.filter((e) => e.kind === "unit" && e.type !== "worker" && !e.garrison);
    if (!own.some(e => e.type === "hq")) return;
    this.updateKnownCores(team);
    this.assignHarvesters(team);
    const hq = own.find((e) => e.type === "hq" && e.complete) || own.find(e => e.type === "hq");
    const pace = this.pace, role = roleOf(this, team);
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
      if (b.type === "foundry" && !this.players[team].upgrade && this.time > pace.upgradeAt && vehicles >= 2 && !b.queue.length && afford(D.upgrade.cost) && this.enqueue(b.id, "upgrade")) continue;
      if (b.level < this.techLevel(team) && this.time > pace.upgradeAt && afford(this.levelCost(b))) {
        if (!b.queue.length) this.upgradeBuilding(b.id,team);
        continue;
      }
      // Army size follows the speed's curve; a base under attack may always train.
      const cap = pace.army ? pace.army[0] + pace.army[1] * (this.time / 60) : Infinity;
      if (b.queue.length < 2 && (army.length + own.reduce((n, e) => n + (e.queue?.length || 0), 0) < cap || own.some((e) => e.kind === "building" && this.time - (e.hitAt ?? -99) < 10))) {
        // One Vanguard per two Rangers; a raider AI trains two Vanguards per Ranger.
        const cycle = Math.floor(this.time/4)%3;
        let choice = b.type === 'foundry' ? 'breaker' : cycle === 0 || (role === 'raider' && cycle === 1) ? 'vanguard' : 'ranger';
        if (b.type === 'foundry' && b.level >= 3 && army.filter(e => e.type === 'tank').length <= army.filter(e => e.type === 'breaker').length + (role === 'siege' ? 2 : 0)) choice = 'tank';
        if (b.type === 'barracks' && b.level >= 2 && army.filter(e => e.type === 'antitank').length < 3) choice = 'antitank';
        const support = b.type === 'foundry' ? 'engineer' : 'medic';
        if (b.level >= 2 && army.filter(e => e.type === support).length < 2) choice = support;
        const choices = [...new Set([choice,...(b.type === 'barracks' ? ['ranger','vanguard'] : ['breaker'])])];
        const pop = this.population(team);
        const save = b.type === 'barracks' ? hold : 0;
        const affordable = choices.find(type => b.level >= (D[type].required_level || 1) && afford([D[type].cost[0] + save, D[type].cost[1]]) && pop.used+pop.reserved+D[type].pop <= pop.cap);
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
        (sum, e) => sum + (e.kind === "building" ? (e.damage ? 4 : 1) : e.type === "worker" ? 0.5 : e.pop || 1),
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
    if (!incursion) this.aiPoints(team, hq, army, pace);
    const wave = army.filter((e) => !engaged(e) && !e.pointDuty);
    if (this.coalition) {
      this.coalitionOrders(team, { hq, army, wave, incursion });
      return;
    }
    if (!incursion && this.time >= this.waveAt[team] && wave.length >= pace.minWave) {
      const target = [...this.knownCores[team].values()]
        .sort((a, b) => distance(hq, a) - distance(hq, b))[0] || this.scoutDestination(team);
      if (target) this.issue(wave.map(e => e.id), { type: "attackmove", x: target.x, z: target.z });
      if (target?.team !== undefined) this.events.push({ type: "incoming", team: target.team, x: hq.x, z: hq.z, count: wave.length });
      this.waveAt[team] = this.time + pace.waveGap;
    }
  },
  stepAI(dt) {
    if (this.aiEnabled) {
      this.aiClock -= dt;
      if (this.aiClock <= 0) {
        this.aiTurn = 1;
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
