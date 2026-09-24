import { distance } from './data.js';

// AI tempo. Every preset uses the same costs, income and rules as the player (no cheats);
// faster AIs think more often, grow a larger economy, tech sooner and attack earlier.
// "normal" reproduces the original AI exactly.
export const AI_SPEEDS = {
  relaxed: { label: 'Relaxed', think: 4, workers: 7, foundryAt: 160, techAt: [240, 420], upgradeAt: 280, firstWave: 150, waveGap: 75, minWave: 4 },
  normal: { label: 'Normal', think: 2.5, workers: 9, foundryAt: 100, techAt: [160, 300], upgradeAt: 190, firstWave: 85, waveGap: 50, minWave: 4 },
  fast: { label: 'Fast', think: 1.5, workers: 11, foundryAt: 80, techAt: [120, 240], upgradeAt: 150, firstWave: 70, waveGap: 42, minWave: 5 },
  relentless: { label: 'Relentless', think: 1, workers: 12, foundryAt: 60, techAt: [95, 190], upgradeAt: 115, firstWave: 60, waveGap: 34, minWave: 5, secondBarracks: 150 },
};
export const ALLIANCES = { ffa: 'Free-for-all', coalition: 'United against you' };

// In a coalition each AI has a role: the first leads the main assault, the second
// raids your mining area just before each offensive, the third favours siege units.
const ROLES = ['assault', 'raider', 'siege'];
export const roleOf = (sim, team) => (sim.coalition && team > 0 ? ROLES[(team - 1) % ROLES.length] : 'balanced');

// Coalition strategy, mixed into Simulation. Plans are shared by every allied AI.
export const coalitionPlan = {
  initCoalition() {
    // Allies strike together, so the first joint offensive comes a little later than a lone AI's.
    this.offensiveAt = this.pace.firstWave + 25;
    this.raidAt = this.offensiveAt - 20;
    this.distress = new Map();
    this.launched = new Set();
  },
  // Your Command core nearest to this AI: every AI marches on you from its own side.
  playerCoreFor(team, from) {
    return [...this.knownCores[team].values()].filter(c => c.team === 0)
      .sort((a, b) => distance(from, a) - distance(from, b))[0] || null;
  },
  coalitionOrders(team, { hq, army, wave, incursion }) {
    const idle = wave.filter(e => !(e.raiding && e.orders.length));
    // Mutual defense: a base under real attack calls its allies.
    if (incursion) this.distress.set(team, { x: hq.x, z: hq.z, until: this.time + 12, answered: new Set() });
    else for (const [ally, call] of this.distress) {
      if (ally === team || call.until < this.time || call.answered.has(team) || !this.players[ally] || this.players[ally].eliminated) continue;
      const helpers = idle.filter(e => !e.orders.length).slice(0, Math.ceil(idle.length / 2));
      call.answered.add(team);
      if (!helpers.length) continue;
      this.issue(helpers.map(e => e.id), { type: 'attackmove', x: call.x, z: call.z });
      this.message('Enemy reinforcements are moving to defend an allied base.');
    }
    if (incursion || !hq) return;
    // Harassment: the raider sends its fastest fighters at your nearest deposits first.
    if (roleOf(this, team) === 'raider' && this.time >= this.raidAt) {
      const core = this.playerCoreFor(team, hq);
      const deposit = core && this.resources.filter(r => r.amount > 0)
        .sort((a, b) => distance(core, a) - distance(core, b))[0];
      const raiders = idle.filter(e => !e.orders.length || e.orders[0].type === 'move')
        .sort((a, b) => b.speed - a.speed).slice(0, 3);
      if (deposit && raiders.length >= 2) {
        for (const e of raiders) e.raiding = true;
        this.issue(raiders.map(e => e.id), { type: 'attackmove', x: deposit.x, z: deposit.z });
        this.message('Scouts report enemy raiders heading for your Harvesters.');
      }
      this.raidAt = this.offensiveAt + this.pace.waveGap - 20;
    }
    // Joint offensive: every allied AI with a force attacks together, so you are hit
    // from several sides at once. The shared timer advances once all AIs have acted.
    if (this.time >= this.offensiveAt && !this.launched.has(team)) {
      const force = idle.filter(e => !e.raiding || !e.orders.length);
      const target = this.playerCoreFor(team, hq) || this.scoutDestination(team);
      const minimum = Math.max(2, this.pace.minWave - 2);
      if (target && force.length >= minimum) {
        // Each ally commits about two thirds of its army (less with more allies) and keeps a
        // home guard, so the combined push is larger than one AI's wave but not all-in.
        const commit = Math.max(minimum, Math.ceil(force.length * (0.5 + 0.4 / this.enemyCount)));
        const troops = force.sort((a, b) => distance(a, target) - distance(b, target)).slice(0, commit);
        for (const e of troops) e.raiding = false;
        this.issue(troops.map(e => e.id), { type: 'attackmove', x: target.x, z: target.z });
        this.launched.add(team);
      }
    }
  },
  // Called after every AI has thought this cycle.
  advanceCoalition() {
    if (this.time < this.offensiveAt) return;
    if (this.launched.size) this.message(this.launched.size > 1
      ? `Joint offensive: ${this.launched.size} enemy armies are attacking you from different sides!`
      : 'An enemy army is marching on your base.');
    // Nobody was ready: try again shortly instead of waiting a full cycle.
    this.offensiveAt = this.time + (this.launched.size ? this.pace.waveGap : 10);
    this.launched.clear();
  },
};
