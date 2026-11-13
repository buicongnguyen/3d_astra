// DefenceBot: plays a Frontier Defence level through the command layer, like a careful player.
// Used by tools/defence-check.mjs (balance targets) and tests. Policies:
//   bot      ranks pads by how much road they cover, picks the crew the next wave calls for,
//            upgrades its best-covering tower, takes tier-3 branches, parks the commander on
//            the road where the most towers cover it, shells the densest group with Barrage and
//            drops Reinforce on a column at the commander; calls a wave early when the road is clear;
//   passive  builds nothing and leaves the commander where it stands (must lose);
//   greedy   one crew type only (`crew`), always the best free pad, then upgrades, no commander
//            orders (must not reach 3 stars).
// `demolish: true` also blows the bridge on the busiest open route once (river levels).
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { waveCount } from "../src/sim/missions.js";
import { GARRISONS } from "../src/sim/defence.js";
import { CROSSINGS } from "../src/terrain.js";

const SAMPLE = 1; // metres between road samples
const THINK = 0.5; // seconds between decisions
// The branch the bot takes for each crew (the second branch when the wave is mostly machines).
const BRANCH = { ranger: ["suppressor", "marksman"], breaker: ["cluster", "guided"], antitank: ["heavy", "rapid"], watcher: ["beacon", "fareye"], tank: ["breacher", "shrapnel"], scorcher: ["inferno", "firewall"] };

export class DefenceBot {
  constructor(sim, { policy = "bot", crew = "ranger", callEarly = true, demolish = false } = {}) {
    this.sim = sim;
    this.policy = policy;
    this.crew = crew;
    this.callEarly = callEarly;
    this.demolish = demolish;
    this.clock = 0;
    this.postClock = 0;
    const def = sim.missionDef.defence;
    this.def = def;
    this.samples = {};
    for (const [id, pts] of Object.entries(def.routes)) {
      const out = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / SAMPLE));
        for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
      }
      this.samples[id] = out;
    }
  }
  // Road metres a crew on this pad would cover, on the routes the coming waves use most.
  coverage(pad, crew, tier = 1) {
    const s = this.sim, stats = s.garrisonStats(crew, tier), high = s.terrain.level(pad.x, pad.z) === 1;
    const reach = stats.range + (high ? 2 : 0) + 0.6;
    const weight = this.routeWeights();
    let score = 0;
    for (const [id, pts] of Object.entries(this.samples)) {
      if (!weight[id]) continue;
      for (const p of pts) if (Math.hypot(p.x - pad.x, p.z - pad.z) <= reach) score += weight[id];
    }
    // Firing down hits harder; a deep pad is not shot back from the road.
    return score * (high ? 1.2 : 1) * (pad.high === "deep" ? 1.1 : 1);
  }
  routeWeights() {
    const s = this.sim, d = s.defence, w = {}, total = s.waveTotal();
    for (let i = d.wave; i < Math.min(total, d.wave + 10); i++)
      for (const g of s.defenceWave(i).groups) w[g.route] = (w[g.route] || 0) + Object.values(g.units).reduce((a, b) => a + b, 0) / (1 + (i - d.wave) * 0.3);
    const top = Math.max(1, ...Object.values(w));
    // A route over a blown crossing carries nobody (its groups turn to the others).
    for (const id of Object.keys(this.samples)) w[id] = s.crossingClosed(s.crossingOf(id)) ? 0 : 0.25 + (w[id] || 0) / top;
    return w;
  }
  // The next wave (the one coming, or the one on the field) as resolved units.
  nextWave() {
    const s = this.sim, d = s.defence, wave = s.defenceWave(Math.min(d.wave, s.waveTotal() - 1)), scale = s.defenceWaveScale();
    const units = [];
    for (const g of wave.groups) for (const [slot, n] of Object.entries(g.units)) {
      const type = s.waveType(g, slot);
      units.push({ type, count: waveCount(n, scale, D[type]) });
    }
    return units;
  }
  chooseCrew(towers) {
    if (this.policy === "greedy") return this.crew;
    const units = this.nextWave(), total = units.reduce((a, u) => a + u.count, 0);
    const mech = units.filter((u) => D[u.type].mechanical).reduce((a, u) => a + u.count, 0);
    const cloaked = units.some((u) => D[u.type].cloak) && this.sim.factionFor(1).trait === "farsight";
    const crews = this.def.crews, have = (c) => towers.filter((t) => t.crew === c).length;
    // Shades: a Watcher post first, and one for every four other towers.
    if (cloaked && crews.includes("watcher") && have("watcher") * 4 <= towers.length) return "watcher";
    if (mech / Math.max(1, total) > 0.3) {
      if (crews.includes("tank") && have("tank") < have("antitank")) return "tank";
      if (crews.includes("antitank")) return "antitank";
    }
    if (total >= 10) {
      if (crews.includes("scorcher") && have("scorcher") < have("breaker")) return "scorcher";
      if (crews.includes("breaker")) return "breaker";
    }
    return crews.includes("ranger") ? "ranger" : crews[0];
  }
  think() {
    const s = this.sim, d = s.defence;
    if (this.policy === "passive" || s.result) return;
    if (this.demolish) this.blowBridge();
    const alloy = s.players[0].alloy;
    const towers = s.entities.filter((e) => e.team === 0 && e.crew && e.hp > 0);
    const crew = this.chooseCrew(towers), cost = s.buildCost(crew);
    const free = this.def.pads.filter((p) => !s.towerOn(p.id));
    const best = free.map((p) => ({ p, score: this.coverage(p, crew) })).sort((a, b) => b.score - a.score)[0];
    // Upgrade candidate: the tower covering the most road, scored by what the next tier adds.
    const up = towers.filter((t) => t.tier < 3).map((t) => ({ t, score: this.coverage(s.padById(t.pad), t.crew, t.tier + 1) * (1 + t.tier * 0.15) })).sort((a, b) => b.score - a.score)[0];
    const upCost = up ? s.crewCost(up.t.crew, up.t.tier + 1) : Infinity;
    // Spread first (more towers as the waves grow), then raise the best-covering tower.
    const wanted = Math.min(this.def.pads.length, 3 + d.wave);
    if (best && (towers.length < wanted || !up)) { if (alloy >= cost) s.command({ team: 0, type: "padBuild", pad: best.p.id, crew }); }
    else if (up && alloy >= upCost) s.command({ team: 0, type: "padUpgrade", building: up.t.id });
    // A gold tower takes its branch once the spreading is done.
    if (this.policy === "bot" && towers.length >= wanted) {
      const mech = this.nextWave().some((u) => D[u.type].mechanical && u.count >= 3);
      const top = towers.find((t) => t.tier === 3 && !t.branch && GARRISONS.crews[t.crew].branches);
      if (top) {
        const branch = BRANCH[top.crew]?.[mech && top.crew === "ranger" ? 1 : 0] || Object.keys(GARRISONS.crews[top.crew].branches)[0];
        if (s.players[0].alloy >= s.branchCost(top.crew, branch)) s.command({ team: 0, type: "padBranch", building: top.id, branch });
      }
    }
    if (this.policy === "bot") this.lead(towers);
    const status = s.defenceStatus();
    // Early call: the last wave beaten without a leak, nothing on the road, no money lying around.
    if (d.wave !== this.waveSeen) { this.waveSeen = d.wave; this.leakedAtStart = d.leaked; }
    if (d.cleared && d.leaked === this.leakedAtStart && this.callEarly && status.canCall && status.countdown !== null && status.countdown > 3 && !status.enemies && s.players[0].alloy < Math.min(cost, upCost)) s.command({ team: 0, type: "waveCall" });
  }
  // The commander: stands on the road where the most towers reach (re-chosen every 10 s),
  // shells the densest group in reach and calls Vanguards onto a column bearing down on it.
  lead(towers) {
    const s = this.sim, hero = s.commander();
    if (!hero) return;
    const c = GARRISONS.commander;
    if (this.postClock <= 0 && towers.length) {
      this.postClock = 10;
      const weight = this.routeWeights();
      let post = null, bestScore = 0;
      for (const [id, pts] of Object.entries(this.samples)) {
        if (!weight[id]) continue;
        // Not near the spawn spot (the rules refuse it) nor on the river banks.
        for (let i = 12; i < pts.length; i += 2) {
          const p = pts[i];
          let n = 0;
          for (const t of towers) if (Math.hypot(t.x - p.x, t.z - p.z) <= t.range + 1) n += t.tier;
          const score = n * weight[id];
          if (score > bestScore && s.nav.canStand(p.x, p.z, hero.radius + 0.2) && !(s.terrain.river && Math.abs(p.z) < 6)) { bestScore = score; post = p; }
        }
      }
      if (post && Math.hypot(post.x - hero.x, post.z - hero.z) > 3) s.command({ team: 0, type: "heroMove", x: post.x, z: post.z });
    }
    const foes = s.entities.filter((e) => e.team === 1 && e.kind === "unit" && e.hp > 0 && s.isVisible(e, 0));
    if (!foes.length) return;
    if (s.commanderCooldown("barrage") === 0) {
      let target = null, most = 2;
      for (const f of foes) {
        if (Math.hypot(f.x - hero.x, f.z - hero.z) > c.barrage.range - 1) continue;
        let n = 0;
        for (const g of foes) if (Math.hypot(g.x - f.x, g.z - f.z) <= c.barrage.radius) n += g.pop || 1;
        if (n > most) { most = n; target = f; }
      }
      if (target) s.command({ team: 0, type: "heroCast", ability: "barrage", x: target.x, z: target.z });
    }
    if (s.commanderCooldown("reinforce") === 0) {
      const near = foes.filter((f) => Math.hypot(f.x - hero.x, f.z - hero.z) < 12);
      if (near.length >= 4) {
        const f = near[0], d = Math.hypot(f.x - hero.x, f.z - hero.z) || 1, k = Math.min(1, 3 / d);
        s.command({ team: 0, type: "heroCast", ability: "reinforce", x: hero.x + (f.x - hero.x) * k, z: hero.z + (f.z - hero.z) * k });
      }
    }
  }
  // Blows the bridge of the open route the coming waves use most, once, with alloy to spare.
  blowBridge() {
    const s = this.sim;
    if (this.blown || !this.def.bridges || s.defence.wave < 2 || s.players[0].alloy < GARRISONS.demolish.cost) return;
    const w = this.routeWeights();
    const pick = Object.keys(this.samples).filter((id) => CROSSINGS.find((c) => c.x === s.crossingOf(id))?.type === "bridge" && s.canDemolish(0, s.crossingOf(id)) === "ok").sort((a, b) => w[b] - w[a])[0];
    if (pick && s.command({ team: 0, type: "demolish", crossing: s.crossingOf(pick) })) this.blown = true;
  }
  step(dt) {
    this.clock -= dt;
    this.postClock -= dt;
    if (this.clock <= 0) { this.clock = THINK; this.think(); }
  }
}

// Plays one level to the end. Returns { result, lives, stars, medal, seconds, towers, bounty, wave, held }.
export function playDefence(level, { difficulty = "standard", policy = "bot", crew = "ranger", limit = 1500, demolish = false, maxWaves = Infinity } = {}) {
  const sim = new Simulation({ map: level.map, enemyCount: level.enemies || 1, ai: false, mission: level, difficulty });
  const bot = new DefenceBot(sim, { policy, crew, demolish });
  for (let i = 0; i < limit * 20 && !sim.result && sim.defence.cleared < maxWaves; i++) { bot.step(0.05); sim.tick(0.05); }
  const medal = sim.result === "victory" ? sim.mission.medal : null;
  return {
    result: sim.result || "timeout", lives: sim.defence.lives, medal, stars: { gold: 3, silver: 2, bronze: 1 }[medal] || 0,
    seconds: Math.round(sim.time), wave: sim.defence.wave, held: sim.defence.cleared,
    towers: sim.entities.filter((e) => e.crew && e.hp > 0).map((e) => `${e.crew[0]}${e.tier}${e.branch ? e.branch[0] : ""}`).join(""),
    bounty: sim.defence.bounty, sim,
  };
}
