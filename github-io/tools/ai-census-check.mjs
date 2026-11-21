// Field command census check (AAA round 3, R3-A). The long checks of the Field command AI, out of npm test:
//   census     each of the 5 factions as the computer rival (team 1) under { aiPlan: "field", roster: "expanded" },
//              Dunes, Normal, against a turtling PlayBot (Meridian, 4 towers, Ranger-heavy), 600 s. Pass: at
//              least 4 combat unit types fielded (trained or spawned; Harvesters and the unarmed Kite do not count)
//              and at least 1 workshop unit, for every faction whose host trains workshop units (Sunward's and
//              the Wardens' hosts are wired but empty since round 2: "n/a").
//   highlands  Field command against Field command on Highlands, Normal, 5 fixed faction pairings (the
//              deterministic sim has no seed: the pairings are the "seeds"; they include every pairing that
//              ran past 30 minutes before R3-A). Pass: every match ends before 1800 s.
// Usage: node tools/ai-census-check.mjs [--only census|highlands] [--jobs 3] [--json out.json] [--secs 600]
//        (npm run test:ai-census-check runs it through tests/ai-census-check.mjs with --jobs 2: CI matrix entry r3-a)
//        [--speed normal] [--map dunes]
// Exits 1 when a row fails. Rows are deterministic; --jobs only spreads them over processes.
import fs from "node:fs";
import path from "node:path";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { workshopUnitsOf } from "../src/factions.js";
import { PlayBot } from "./playbot.mjs";

const args = process.argv.slice(2), arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const JOBS = Math.max(1, Number(arg("--jobs", 1)) || 1), ONLY = arg("--only", "census,highlands").split(",");
const SECS = Number(arg("--secs", 600)), SPEED = arg("--speed", "normal"), MAP = arg("--map", "dunes");
const FACTIONS = ["meridian", "ashfall", "sunward", "wardens", "veil"];
export const SEEDS = [["meridian", "wardens"], ["ashfall", "meridian"], ["wardens", "wardens"], ["meridian", "meridian"], ["veil", "wardens"]];
export const HIGHLANDS_CAP = 1800, MIN_TYPES = 4;

// A combat type for the census: a unit that is not a Harvester and not an unarmed scout.
export const combatType = (type) => D[type]?.kind === "unit" && type !== "worker" && (D[type].damage > 0 || D[type].support > 0);

// One faction's census row: the types team 1 fielded by `secs`.
export function censusRow(faction, { secs = SECS, speed = SPEED, map = MAP } = {}) {
  const s = new Simulation({ map, aiSpeed: speed, factions: { 0: "meridian", 1: faction }, capturePoints: true, rules: { aiPlan: "field", roster: "expanded" } });
  const bot = new PlayBot(s, { towers: 4, rangerShare: 4 });
  const fielded = new Map();
  const note = (e) => { if (e.team === 1 && e.kind === "unit" && combatType(e.type)) fielded.set(e.type, (fielded.get(e.type) || 0) + 1); };
  for (const e of s.entities) note(e);
  while (s.time < secs && !s.result) {
    bot.step(); s.tick(0.05);
    for (const ev of s.events) { bot.see(ev); if (ev.type === "spawn") { const u = s.get(ev.seed); if (u) note(u); } }
    s.events.length = 0;
  }
  const workshop = [...fielded.keys()].filter((t) => D[t].workshop).reduce((n, t) => n + fielded.get(t), 0);
  const hasWorkshop = workshopUnitsOf(faction).length > 0;
  const types = fielded.size;
  return { check: "census", faction, map, speed, seconds: Math.round(s.time), result: s.result || "running", types, workshop: hasWorkshop ? workshop : "n/a",
    fielded: Object.fromEntries([...fielded].sort((a, b) => a[0].localeCompare(b[0]))), pass: types >= MIN_TYPES && (!hasWorkshop || workshop >= 1) };
}

// One Highlands Field-against-Field match.
export function highlandsRow([a, b], { speed = SPEED } = {}) {
  const s = new Simulation({ map: "highlands", aiSpeed: speed, factions: { 0: a, 1: b }, capturePoints: true, aiPlayer: true, rules: { aiPlan: "field" } });
  while (s.time < HIGHLANDS_CAP && !s.result) { s.tick(0.05); s.events.length = 0; }
  return { check: "highlands", seat0: a, seat1: b, speed, result: s.result || "timeout", seconds: Math.round(s.time), pass: !!s.result };
}

const jobs = () => [
  ...(ONLY.includes("census") ? FACTIONS.map((f) => ({ kind: "census", f })) : []),
  ...(ONLY.includes("highlands") ? SEEDS.map((p) => ({ kind: "highlands", p })) : []),
];
const play = (j) => (j.kind === "census" ? censusRow(j.f) : highlandsRow(j.p));

export async function main() {
  const list = jobs(), rows = new Array(list.length);
  let printed = 0;
  const land = (i, row) => { rows[i] = row; while (printed < rows.length && rows[printed]) console.log(JSON.stringify(rows[printed++])); };
  if (JOBS === 1) list.forEach((j, i) => land(i, play(j)));
  else {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(JOBS, list.length) }, () => new Promise((done, fail) => {
      const child = fork(fileURLToPath(import.meta.url), ["--worker", ...args], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
      const send = () => { if (next < list.length) { const i = next++; child.send({ i, job: list[i] }); } else child.disconnect(); };
      child.on("message", ({ i, row }) => { land(i, row); send(); });
      child.on("exit", (code) => (code ? fail(new Error(`worker exited with ${code}`)) : done()));
      send();
    })));
  }
  const failed = rows.filter((r) => !r.pass);
  console.log(JSON.stringify({ summary: "ai-census-check", rows: rows.length, passed: rows.length - failed.length, failed: failed.map((r) => r.faction || `${r.seat0}:${r.seat1}`) }));
  if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify(rows, null, 1) + "\n");
  process.exitCode = failed.length ? 1 : 0;
}

if (args.includes("--worker")) process.on("message", ({ i, job }) => process.send({ i, row: play(job) }));
else if (process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) await main();
