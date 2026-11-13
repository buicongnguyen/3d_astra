// DefenceBot: plays a Frontier Defence level through the command layer, like a careful player.
// Used by tools/defence-check.mjs (balance targets) and tests. Policies:
//   bot      ranks pads by how much road they cover, picks the crew the next wave calls for,
//            upgrades its best-covering tower, and calls a wave early when the road is clear;
//   passive  builds nothing (must lose);
//   greedy   one crew type only (`crew`), always the best free pad, then upgrades (must not reach 3 stars).
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { waveCount } from "../src/sim/missions.js";

const SAMPLE = 1; // metres between road samples
const THINK = 0.5; // seconds between decisions

export class DefenceBot {
  constructor(sim, { policy = "bot", crew = "ranger", callEarly = true } = {}) {
    this.sim = sim;
    this.policy = policy;
    this.crew = crew;
    this.callEarly = callEarly;
    this.clock = 0;
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
    for (const [id, pts] of Object.entries(this.samples)) for (const p of pts) if (Math.hypot(p.x - pad.x, p.z - pad.z) <= reach) score += weight[id] || 0;
    // Firing down hits harder; a deep pad is not shot back from the road.
    return score * (high ? 1.2 : 1) * (pad.high === "deep" ? 1.1 : 1);
  }
  routeWeights() {
    const d = this.sim.defence, waves = this.def.waves, w = {};
    for (let i = d.wave; i < waves.length; i++)
      for (const g of waves[i].groups) w[g.route] = (w[g.route] || 0) + Object.values(g.units).reduce((a, b) => a + b, 0) / (1 + (i - d.wave) * 0.3);
    const top = Math.max(1, ...Object.values(w));
    for (const id of Object.keys(this.samples)) w[id] = 0.25 + (w[id] || 0) / top;
    return w;
  }
  // The next wave (the one coming, or the one on the field) as resolved units.
  nextWave() {
    const s = this.sim, d = s.defence, wave = this.def.waves[Math.min(d.wave, this.def.waves.length - 1)], scale = s.defenceWaveScale();
    const units = [];
    for (const g of wave.groups) for (const [slot, n] of Object.entries(g.units)) {
      const type = s.typeFor(1, slot);
      units.push({ type, count: waveCount(n, scale, D[type]) });
    }
    return units;
  }
  chooseCrew() {
    if (this.policy === "greedy") return this.crew;
    const units = this.nextWave(), total = units.reduce((a, u) => a + u.count, 0);
    const mech = units.filter((u) => D[u.type].mechanical).reduce((a, u) => a + u.count, 0);
    const crews = this.def.crews;
    if (mech / Math.max(1, total) > 0.3 && crews.includes("antitank")) return "antitank";
    if (total >= 10 && crews.includes("breaker")) return "breaker";
    return crews.includes("ranger") ? "ranger" : crews[0];
  }
  think() {
    const s = this.sim, d = s.defence;
    if (this.policy === "passive" || s.result) return;
    const alloy = s.players[0].alloy;
    const towers = s.entities.filter((e) => e.team === 0 && e.crew && e.hp > 0);
    const crew = this.chooseCrew(), cost = s.crewCost(crew, 1);
    const free = this.def.pads.filter((p) => !s.towerOn(p.id));
    const best = free.map((p) => ({ p, score: this.coverage(p, crew) })).sort((a, b) => b.score - a.score)[0];
    // Upgrade candidate: the tower covering the most road, scored by what the next tier adds.
    const up = towers.filter((t) => t.tier < 3).map((t) => ({ t, score: this.coverage(s.padById(t.pad), t.crew, t.tier + 1) * (1 + t.tier * 0.15) })).sort((a, b) => b.score - a.score)[0];
    const upCost = up ? s.crewCost(up.t.crew, up.t.tier + 1) : Infinity;
    // Spread first (more towers as the waves grow), then raise the best-covering tower.
    const wanted = Math.min(this.def.pads.length, (this.policy === "greedy" ? 3 : 3) + d.wave);
    if (best && (towers.length < wanted || !up)) { if (alloy >= cost) s.command({ team: 0, type: "padBuild", pad: best.p.id, crew }); }
    else if (up && alloy >= upCost) s.command({ team: 0, type: "padUpgrade", building: up.t.id });
    const status = s.defenceStatus();
    // Early call: the last wave beaten without a leak, nothing on the road, no money lying around.
    if (d.wave !== this.waveSeen) { this.waveSeen = d.wave; this.leakedAtStart = d.leaked; }
    if (d.cleared && d.leaked === this.leakedAtStart && this.callEarly && status.canCall && status.countdown !== null && status.countdown > 3 && !status.enemies && s.players[0].alloy < Math.min(cost, upCost)) s.command({ team: 0, type: "waveCall" });
  }
  step(dt) {
    this.clock -= dt;
    if (this.clock <= 0) { this.clock = THINK; this.think(); }
  }
}

// Plays one level to the end. Returns { result, lives, stars, medal, seconds, towers, bounty }.
export function playDefence(level, { difficulty = "standard", policy = "bot", crew = "ranger", limit = 1500 } = {}) {
  const sim = new Simulation({ map: level.map, enemyCount: level.enemies || 1, ai: false, mission: level, difficulty });
  const bot = new DefenceBot(sim, { policy, crew });
  for (let i = 0; i < limit * 20 && !sim.result; i++) { bot.step(0.05); sim.tick(0.05); }
  const medal = sim.result === "victory" ? sim.mission.medal : null;
  return {
    result: sim.result || "timeout", lives: sim.defence.lives, medal, stars: { gold: 3, silver: 2, bronze: 1 }[medal] || 0,
    seconds: Math.round(sim.time), wave: sim.defence.wave, towers: sim.entities.filter((e) => e.crew && e.hp > 0).map((e) => `${e.crew[0]}${e.tier}`).join(""),
    bounty: sim.defence.bounty, sim,
  };
}
