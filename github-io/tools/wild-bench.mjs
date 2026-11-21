// Wild-land bench (AAA round 4, P1 "Wild frontier: the desert test"; docs/aaa/AAA_ROUND4_PLAN.md).
// Two jobs in one deterministic run on a Wild land (P1: Amber Dunes):
//  1. The difficulty gate for the Wild frontier rule: the test bot (tools/playbot.mjs) against one rival
//     (1v1) and two united rivals (1v2) at every AI speed, with the rule off and on, the same matches
//     otherwise. Owner rule: Relaxed and Normal must not get harder with the rule on (no row may lose
//     more than --margin bot wins, default 1); Fast and Relentless are reported.
//     The bot plays twice with the rule on: "ignores" (it never touches the Spire or the nest: the
//     harshest case, the computer alone uses them) and "uses" (a light player: it calls the Sandstorm on
//     the densest enemy group it sees whenever it holds the Spire, and from 360 s sends five fighters to
//     the nest every 180 s).
//  2. Fun signals: how often the Spire changes hands, how many storms each side calls, how often the
//     Wyrm is tamed and by whom, and match length against the rule off; plus AI against AI (both seats
//     played by the computer at that speed).
// Usage: node tools/wild-bench.mjs [--jobs 3] [--speeds relaxed,normal,fast,relentless] [--setups 1v1,1v2]
//   [--attack-at 12,16,20,24] [--cap 2400] [--map dunes] [--margin 1] [--json out.json] [--no-points]
// Exit code 1 when a Relaxed or Normal row got harder with the rule on (either bot).
import fs from "node:fs";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Simulation } from "../src/simulation.js";
import { PlayBot } from "./playbot.mjs";

const args = process.argv.slice(2), arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback), list = (name, fallback) => arg(name, fallback).split(",");
const CAP = Number(arg("--cap", 2400)), TICK = 0.05, MAP = arg("--map", "dunes"), JOBS = Math.max(1, Number(arg("--jobs", 1)) || 1), MARGIN = Number(arg("--margin", 1));
const SETUPS = { "1v1": { enemyCount: 1, alliance: "ffa" }, "1v2": { enemyCount: 2, alliance: "coalition" } };
const setups = list("--setups", "1v1,1v2"), speeds = list("--speeds", "relaxed,normal,fast,relentless"), thresholds = list("--attack-at", "12,16,20,24").map(Number);
const MODES = ["off", "ignores", "uses"];
const jobs = [
  ...setups.flatMap((setup) => speeds.flatMap((speed) => MODES.flatMap((mode) => thresholds.map((attackAt) => ({ kind: "bot", setup, speed, mode, attackAt }))))),
  ...speeds.flatMap((speed) => ["off", "on"].map((mode) => ({ kind: "ai", setup: "1v1", speed, mode, attackAt: 0 }))),
];

// The "uses" player: the Sandstorm on the densest enemy group it can see, and a nest party.
function wildPlayer(s) {
  let partyAt = -Infinity;
  return () => {
    if (!s.wild || s.ticks % 20 !== 3) return;
    const spire = s.skirmishPoints.spire;
    if (spire?.owner === 0 && s.time >= s.wild.readyAt) {
      const foes = s.entities.filter((e) => e.hp > 0 && e.kind === "unit" && e.team > 0 && e.damage > 0 && e.type !== "worker" && !e.flying && s.isVisible(e, 0));
      let best = null, most = 0;
      for (const c of foes) { const n = foes.filter((o) => Math.hypot(o.x - c.x, o.z - c.z) <= 9).length; if (n > most) { most = n; best = c; } }
      if (best && most >= 4) s.command({ team: 0, type: "weather", x: best.x, z: best.z });
    }
    const nest = s.wild.nest;
    if (nest && nest.state !== "regrow" && s.time >= 360 && s.time >= partyAt + 180 && !s.entities.some((e) => e.team === 0 && e.type === "wyrm" && e.hp > 0)) {
      const fighters = s.own(0).filter((e) => e.kind === "unit" && e.damage > 0 && e.type !== "worker" && !e.flying && !e.orders.length);
      if (fighters.length >= 12) {
        partyAt = s.time;
        s.command({ team: 0, type: "order", ids: fighters.slice(0, 5).map((e) => e.id), order: { type: "attackmove", x: nest.x, z: nest.z } });
      }
    }
  };
}

function play({ kind, setup, speed, mode, attackAt }) {
  const on = mode !== "off";
  const s = new Simulation({ map: MAP, aiSpeed: speed, capturePoints: !args.includes("--no-points"), ...SETUPS[setup], ...(kind === "ai" ? { aiPlayer: true } : {}), ...(on ? { rules: { wild: "on" } } : {}) });
  const bot = kind === "bot" ? new PlayBot(s, { attackAt }) : null, extra = mode === "uses" ? wildPlayer(s) : null;
  while (s.time < CAP && !s.result) {
    bot?.step(); extra?.();
    s.tick(TICK);
    if (bot) for (const e of s.events) bot.see(e);
    s.events.length = 0;
  }
  const st = s.wild?.stats;
  return { kind, setup, speed, mode, attackAt, result: s.result || "timeout", seconds: Math.round(s.time), flips: st?.flips ?? 0, playerStorms: st?.casts[0] ?? 0, aiStorms: st ? st.casts.slice(1).reduce((a, b) => a + b, 0) : 0, playerTamed: st?.tamed[0] ?? 0, aiTamed: st ? st.tamed.slice(1).reduce((a, b) => a + b, 0) : 0 };
}

async function playAll() {
  const rows = new Array(jobs.length);
  if (JOBS === 1) { jobs.forEach((j, i) => (rows[i] = play(j))); return rows; }
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, () => new Promise((done, fail) => {
    const child = fork(fileURLToPath(import.meta.url), ["--worker", ...args], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
    const send = () => { if (next < jobs.length) { const i = next++; child.send({ i, job: jobs[i] }); } else child.disconnect(); };
    child.on("message", ({ i, row }) => { rows[i] = row; send(); });
    child.on("exit", (code) => (code ? fail(new Error(`wild-bench worker exited with ${code}`)) : done()));
    send();
  })));
  return rows;
}

const mean = (xs) => (xs.length ? Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10 : 0);
function summarise(rows) {
  const out = [];
  for (const setup of setups) for (const speed of speeds) {
    const by = (mode) => rows.filter((r) => r.kind === "bot" && r.setup === setup && r.speed === speed && r.mode === mode);
    const row = { setup, speed };
    for (const mode of MODES) {
      const set = by(mode);
      row[mode] = { games: set.length, wins: set.filter((r) => r.result === "victory").length, seconds: mean(set.map((r) => r.seconds)), flips: mean(set.map((r) => r.flips)), playerStorms: mean(set.map((r) => r.playerStorms)), aiStorms: mean(set.map((r) => r.aiStorms)), playerTamed: set.filter((r) => r.playerTamed).length, aiTamed: set.filter((r) => r.aiTamed).length };
    }
    out.push(row);
  }
  const ai = speeds.map((speed) => {
    const off = rows.find((r) => r.kind === "ai" && r.speed === speed && r.mode === "off"), on = rows.find((r) => r.kind === "ai" && r.speed === speed && r.mode === "on");
    return { speed, off: off && { result: off.result, seconds: off.seconds }, on };
  });
  return { bot: out, ai };
}

if (args.includes("--worker")) process.on("message", ({ i, job }) => process.send({ i, row: play(job) }));
else {
  const rows = await playAll(), summary = summarise(rows);
  let failed = 0;
  console.log(`Wild-land bench on ${MAP}, cap ${CAP} s, thresholds ${thresholds.join("/")}: bot wins (games) and mean match length`);
  for (const r of summary.bot) {
    const gate = ["relaxed", "normal"].includes(r.speed);
    const bad = gate && ["ignores", "uses"].some((m) => r[m].wins < r.off.wins - MARGIN);
    if (bad) failed++;
    const cell = (m) => `${r[m].wins}/${r[m].games} ${r[m].seconds}s`;
    console.log(`${r.setup} ${r.speed.padEnd(10)} off ${cell("off")} | ignores ${cell("ignores")} | uses ${cell("uses")} | flips ${r.ignores.flips}/${r.uses.flips} | AI storms ${r.ignores.aiStorms}/${r.uses.aiStorms} | your storms ${r.uses.playerStorms} | tamed you ${r.uses.playerTamed} AI ${r.ignores.aiTamed}/${r.uses.aiTamed}${bad ? "  FAIL (harder)" : ""}`);
  }
  for (const a of summary.ai) console.log(`AI v AI ${a.speed.padEnd(10)} off ${a.off?.result} ${a.off?.seconds}s | on ${a.on?.result} ${a.on?.seconds}s flips ${a.on?.flips} storms ${a.on ? a.on.playerStorms + a.on.aiStorms : 0} tamed ${a.on ? a.on.playerTamed + a.on.aiTamed : 0}`);
  if (args.includes("--json")) fs.writeFileSync(arg("--json"), JSON.stringify({ map: MAP, cap: CAP, thresholds, rows, summary }, null, 2) + "\n");
  if (failed) { console.error(`wild-bench: ${failed} Relaxed/Normal row(s) got harder with the Wild frontier on`); process.exit(1); }
}
