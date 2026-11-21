// First contact in the campaign (AAA round 3, R3-I "Campaign pacing"): plays the opening of every main and
// side mission with the objective bot (tools/playbot.mjs ObjectiveBot, as check:missions does) and reports
// when the enemy first touches the player: the first hit an enemy lands on anything of team 0 (and what it
// hit), the first "incoming" warning, and what that first contact cost: the player's damage taken and
// units or buildings lost before 2:00. Deterministic (no wall clock).
// Usage: node tools/first-contact.mjs [--difficulty standard] [--only m03,m04] [--cap 120] [--json]
//   --cap  seconds of game time played per mission (120)
// Defence-rules missions (m02b, m07b, m11c) are left out: their waves start at once by design.
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { resolveMission } from "../src/story/choices.js";
import { ObjectiveBot } from "./playbot.mjs";

const args = process.argv.slice(2), value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const DIFFICULTY = value("--difficulty", "standard"), CAP = +value("--cap", 120), TICK = 0.05;
const only = value("--only")?.split(",");

export function firstContact(mission, { difficulty = DIFFICULTY, cap = CAP } = {}) {
  mission = resolveMission(mission, null);
  const s = new Simulation({ difficulty, map: mission.map, enemyCount: mission.enemies, aiSpeed: mission.speed, alliance: mission.alliance, playerBonus: mission.bonus || null, mission });
  const bot = new ObjectiveBot(s, s.missionDef, { decide: "default" });
  let hit = null, incoming = null, damage = 0;
  const lost = new Set();
  // Watch applyDamage on this one simulation only: the enemy's hits on team 0.
  const apply = s.applyDamage;
  s.applyDamage = function (t, amount, team, by) {
    if (t.team === 0 && team !== 0 && t.hp > 0 && amount > 0) {
      hit ??= { time: Math.round(s.time), target: t.type, by: s.get(by)?.type ?? null };
      const before = t.hp;
      const out = apply.call(this, t, amount, team, by);
      damage += before - Math.max(0, t.hp);
      if (t.hp <= 0) lost.add(t.type);
      return out;
    }
    return apply.call(this, t, amount, team, by);
  };
  while (s.time < cap && !s.result) {
    bot.step(); s.tick(TICK);
    for (const e of s.events) { if (e.type === "incoming" && e.team === 0) incoming ??= Math.round(s.time); bot.see?.(e); }
    s.events.length = 0;
  }
  return { mission: mission.id, contact: hit?.time ?? null, target: hit?.target ?? null, by: hit?.by ?? null, incoming, damage: Math.round(damage), lost: [...lost] };
}

if (process.argv[1]?.endsWith("first-contact.mjs")) {
  const rows = MISSIONS.filter((m) => !m.defence && (!only || only.some((id) => m.id.startsWith(id)))).map((m) => firstContact(m));
  if (args.includes("--json")) console.log(JSON.stringify(rows, null, 2));
  else for (const r of rows) console.log(r.mission.padEnd(26), "contact", String(r.contact ?? "-").padStart(4), (r.target ?? "").padEnd(10), "by", (r.by ?? "-").padEnd(10), "incoming", String(r.incoming ?? "-").padStart(4), "damage", String(r.damage).padStart(5), "lost", r.lost.join(",") || "-");
}
