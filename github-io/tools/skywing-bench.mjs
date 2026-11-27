// H1 Skywing bench (HERO-COINS-PLAN.md): tunes the assist hero's numbers (src/sim/content/skywing.js) and checks
// that it helps without replacing the army.
// Usage: node tools/skywing-bench.mjs [duel|missions|all] [--difficulty story|standard] [--only m01,m02]
//   duel      Skywing alone against fixed enemy groups on open ground (AI off): survival, kills and time for
//             each weapon; a Ranger squad of the same cost of field time is the yardstick.
//   missions  the ObjectiveBot plays each story mission without Skywing ("before") and with it ("after"):
//             result, game time and units lost. Skywing escorts the bot's army and dives on its own.
// Deterministic: the same code gives the same table.
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { resolveMission } from "../src/story/choices.js";
import { ObjectiveBot } from "./playbot.mjs";

const args = process.argv.slice(2), value = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const MODE = ["duel", "missions", "all"].includes(args[0]) ? args[0] : "all";
const TICK = 0.05;

function duel(weapon, foes, { seconds = 90 } = {}) {
  const s = new Simulation({ map: "classic", enemyCount: 1, ai: false });
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.entities = s.entities.filter((e) => e.hp > 0);
  s.callSkywing(0, weapon);
  const sky = s.entities.find((e) => e.assist);
  sky.x = 0; sky.z = 0;
  s.players[0].autocast = true;
  const enemy = [];
  for (const [type, n] of Object.entries(foes)) for (let i = 0; i < n; i++) enemy.push(s.spawn(type, 1, 12 + (i % 3) * 1.5, (Math.floor(i / 3) - 1) * 1.5 + 0.3 * i));
  for (const e of enemy) e.orders = [{ type: "attack", target: sky.id }];
  s.explored?.[0]?.fill?.(1);
  let t = 0;
  for (; t < seconds && sky.hp > 0 && enemy.some((e) => e.hp > 0); t += TICK) s.tick(TICK);
  const kills = enemy.filter((e) => e.hp <= 0).length;
  return { weapon, foes: Object.entries(foes).map(([k, n]) => `${n} ${k}`).join(" + "), survived: sky.hp > 0, hp: Math.max(0, Math.round(((sky.hp + sky.shield) / (sky.maxHp + sky.maxShield)) * 100)), kills: `${kills}/${enemy.length}`, time: Math.round(t) };
}

function mission(def, withSky, difficulty) {
  def = resolveMission(def, null);
  if (def.defence) return null;
  const s = new Simulation({ difficulty, map: def.map, enemyCount: def.enemies, aiSpeed: def.speed, alliance: def.alliance, playerBonus: def.bonus || null, mission: def });
  const bot = new ObjectiveBot(s, s.missionDef, {});
  if (withSky) { s.command({ team: 0, type: "skywing" }); s.players[0].autocast = true; }
  let lost = 0, units = new Set(), skyDowns = 0;
  const cap = 21 * 60;
  for (let i = 0; i < cap / TICK && !s.result; i++) {
    bot.step();
    // Skywing escorts the army: every 2 s it attack-moves to the middle of the bot's fighters.
    if (withSky && i % 40 === 0) {
      const sky = s.entities.find((e) => e.assist && e.hp > 0);
      const army = s.own(0).filter((e) => e.kind === "unit" && e.type !== "worker" && !e.assist && e.damage > 0);
      if (sky && army.length && !sky.swoop) {
        const x = army.reduce((n, e) => n + e.x, 0) / army.length, z = army.reduce((n, e) => n + e.z, 0) / army.length;
        if (Math.hypot(sky.x - x, sky.z - z) > 6) s.command({ team: 0, type: "order", ids: [sky.id], order: { type: "attackmove", x, z } });
      }
    }
    s.tick(TICK);
    for (const e of s.events) { bot.see?.(e); if (e.type === "heroDown" && e.hero === "skywing") skyDowns++; }
    s.events.length = 0;
    if (i % 20 === 0) {
      const now = new Set(s.own(0).filter((e) => e.kind === "unit" && !e.assist).map((e) => e.id));
      for (const id of units) if (!now.has(id)) lost++;
      units = now;
    }
  }
  return { result: s.result || "running", time: Math.round(s.time), lost, medal: s.mission.medal || "-", skyDowns };
}

if (MODE === "duel" || MODE === "all") {
  console.log("Duels (Skywing alone, AI off, 90 s cap)");
  const rows = [
    duel("sniper", { vanguard: 6 }), duel("sniper", { ranger: 4 }), duel("sniper", { tank: 2 }),
    duel("rocket", { tank: 2 }), duel("rocket", { vanguard: 6 }), duel("rocket", { antitank: 3 }), duel("sniper", { antitank: 3 }),
  ];
  for (const r of rows) console.log(`  ${r.weapon.padEnd(7)} vs ${r.foes.padEnd(16)} ${r.survived ? "lives" : "down "} ${String(r.hp).padStart(3)}%  kills ${r.kills.padEnd(5)} ${String(r.time).padStart(3)} s`);
}
if (MODE === "missions" || MODE === "all") {
  const only = value("--only")?.split(",");
  for (const difficulty of value("--difficulty") ? [value("--difficulty")] : ["story", "standard"]) {
    console.log(`Missions, ObjectiveBot, ${difficulty} (before = no Skywing, after = with Skywing)`);
    for (const def of MISSIONS) {
      if (only && !only.some((p) => def.id.startsWith(p))) continue;
      const a = mission(def, false, difficulty);
      if (!a) continue;
      const b = mission(def, true, difficulty);
      console.log(`  ${def.id.padEnd(28)} before ${a.result.padEnd(8)} ${String(a.time).padStart(5)} s lost ${String(a.lost).padStart(3)} ${a.medal.padEnd(6)} | after ${b.result.padEnd(8)} ${String(b.time).padStart(5)} s lost ${String(b.lost).padStart(3)} ${b.medal.padEnd(6)} downed ${b.skyDowns}`);
    }
  }
}
