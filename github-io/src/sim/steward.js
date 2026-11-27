// H3c, the steward (HERO-COINS-PLAN.md): while the player fights as the hero, the computer runs the
// player's base and army at Normal pace. Mixed into Simulation (see simulation.js).
//
// - `sim.setSteward(on, team = 0)` (or the command `{ type: "steward", team, on }`, logged and replayed
//   like any other) turns it on or off for one human team. State: `sim.steward = { [team]: { since, clock } }`,
//   created on the first use and removed when the last team turns it off, so a match that never uses it
//   saves and hashes exactly as before.
// - It thinks inside the simulation step (stepAI), so replays, LAN lockstep and tests stay in step.
// - Pace: always `aiPace("normal")`, whatever the rivals play at. It never cheats (same costs, income and
//   the player's own prices and rules): the side stays a human side, so `humanTeam`, `fieldPlan`,
//   `sharpSide` and every `team > 0 || sim.aiPlayer` check keep treating it as the player's.
// - It never steers a hero (`e.hero`, `e.assist`, a "hero…" tag) and never takes a unit the player
//   ordered in the last KEEP seconds while that order is still running (`e.playerAt`, written only while
//   the steward is on and cleared when it turns off).
// - Story missions: economy, production, research and home defence only; the army never walks out
//   (aiHome). Skirmish: waves as the Normal AI. Defence: crews free pads and upgrades towers.
import GARRISONS from "../defence/garrisons.json" with { type: "json" };
import { AI_SPEEDS, aiPace } from "../ai-plan.js";

// Seconds a player's order protects a unit from the steward (and longer while that order still runs).
export const STEWARD_KEEP = 20;
// Sentinel towers the steward raises while its base is under fire (the Normal schedule builds one later).
export const STEWARD_TOWERS = 2;
// A building hit this recently means the base is under attack.
export const STEWARD_ALARM = 15;

export const isHeroUnit = (e) => !!e && (!!e.hero || !!e.assist || (typeof e.tag === "string" && e.tag.startsWith("hero")));

export const steward = {
  // Turns the steward on or off for a human team. False when the team cannot have one.
  setSteward(on, team = 0) {
    if (!Number.isInteger(team) || !this.players[team] || !this.humanTeam(team)) return false;
    if (on) {
      const s = (this.steward ||= {});
      if (s[team]) return true;
      s[team] = { since: this.time, clock: 0 };
      this.stewardSeed(team);
      // The first wave waits a Normal gap, so turning it on never sends the army out at once.
      if (!this.defence && this.waveAt) this.waveAt[team] = Math.max(this.waveAt[team] ?? 0, this.time + AI_SPEEDS.normal.waveGap);
      return true;
    }
    if (!this.steward?.[team]) return true;
    delete this.steward[team];
    if (!Object.keys(this.steward).length) delete this.steward;
    for (const e of this.entities) if (e.team === team && e.playerAt !== undefined) delete e.playerAt;
    return true;
  },
  stewardOn(team = 0) {
    return !!this.steward?.[team];
  },
  // Orders the player gave in the last KEEP seconds before the steward came on count as theirs.
  stewardSeed(team) {
    const perTick = this.ticks ? this.time / this.ticks : 0.05, from = this.ticks - Math.ceil(STEWARD_KEEP / perTick);
    for (let i = this.commandLog.length - 1; i >= 0; i--) {
      const c = this.commandLog[i];
      if (c.tick < from) break;
      if (c.team === team) this.stewardMark(c, this.time - (this.ticks - c.tick) * perTick);
    }
  },
  // A player's order or build command (sim.command): its units are the player's for now.
  stewardMark(c, at = this.time) {
    const ids = c.type === "order" ? (Array.isArray(c.ids) ? c.ids : []) : c.type === "build" ? [c.worker] : [];
    for (const id of ids) {
      const e = this.get(id);
      if (e && e.team === c.team && e.kind === "unit" && (e.playerAt ?? -Infinity) < at) e.playerAt = at;
    }
  },
  // May the steward order this unit now? Heroes never; a unit the player ordered keeps the order until
  // it is done (and for KEEP seconds in any case), then it is the steward's again.
  stewardMay(e) {
    if (!e || e.hp <= 0 || isHeroUnit(e)) return false;
    if (e.playerAt === undefined) return true;
    if (this.time - e.playerAt < STEWARD_KEEP || e.orders.length) return false;
    delete e.playerAt;
    return true;
  },
  // Called from stepAI every tick.
  stepSteward(dt) {
    for (const key of Object.keys(this.steward)) {
      const team = Number(key), s = this.steward[key];
      if (this.players[team]?.eliminated) continue;
      s.clock -= dt;
      if (s.clock > 0) continue;
      s.clock = AI_SPEEDS.normal.think;
      this.stewardThinkFor(team);
    }
  },
  stewardThinkFor(team) {
    const saved = { pace: this.pace, aiSpeed: this.aiSpeed, aiHome: this.aiHome };
    this.stewardThink = team;
    try {
      if (this.defence) return this.stewardDefence(team);
      // Normal pace whatever the rivals play at; a story mission keeps the army at home.
      this.pace = aiPace("normal", !!this.mission);
      this.aiSpeed = "normal";
      if (this.mission) this.aiHome = true;
      this.updateAI(team);
    } finally {
      delete this.stewardThink;
      this.pace = saved.pace;
      this.aiSpeed = saved.aiSpeed;
      if (saved.aiHome === undefined) delete this.aiHome;
      else this.aiHome = saved.aiHome;
    }
  },
  // Frontier Defence: a crew on the next free pad (taking the level's crews in turn), else the lowest tower's next tier.
  stewardDefence(team) {
    const def = this.defenceDef();
    if (!def || !this.defence || this.result) return;
    const p = this.players[team], crews = (def.crews || []).filter((c) => GARRISONS.crews[c]);
    const towers = this.entities.filter((e) => e.hp > 0 && e.team === team && e.crew);
    const free = (def.pads || []).filter((pad) => !this.towerOn(pad.id));
    if (free.length && crews.length) {
      const first = crews[towers.length % crews.length];
      const pick = [first, ...crews].find((c) => p.alloy >= this.buildCost(c));
      if (pick) { this.padBuild(team, free[0].id, pick); return; }
      // Saves for the first towers before any upgrade.
      if (towers.length < 2) return;
    }
    const low = towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier || a.id - b.id)[0];
    if (low && p.alloy >= this.crewCost(low.crew, low.tier + 1)) this.padUpgrade(team, low.id);
  },
};
