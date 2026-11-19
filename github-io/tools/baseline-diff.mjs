// Round 2 baselines: re-runs the balance tools and compares their JSON with the copies recorded in
// docs/aaa/results/round2/baseline/ (the integrator records them once after Wave 0, on the merged tree).
// A change that must not move play leaves every baseline identical; one that moves one declares it.
//
//   npm run baselines:diff                      the fast set: defence.json and missions-standard.json
//   npm run baselines:diff -- --full            every baseline (the five mission tables, the
//                                               Chronicles, Defence and the 120-match Classic bench)
//   npm run baselines:diff -- --only defence,chronicles     these baselines only
//   npm run baselines:diff -- --record [--only ...]         writes the current output as the baseline
//   npm run baselines:diff -- --list                        the baselines and the command of each
//   --jobs 3 (default) is passed to every tool; --timeout <s> to check:missions (default 240)
//   --dir <folder>                              compare with (or --record into) another folder
//
// A baseline file that does not exist yet is reported as "not recorded yet", not as a failure.
// Exits 1 when a recorded baseline differs (or a tool fails to give JSON), 0 otherwise.
// The tools stop a run after --timeout seconds of wall clock and record it as "did not finish":
// on a busy machine that can differ from a quiet one, so record and compare on a quiet machine.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BASELINE_DIR = join(ROOT, "docs", "aaa", "results", "round2", "baseline");
const args = process.argv.slice(2), flag = (name) => args.includes(name), value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const JOBS = value("--jobs", "3"), TIMEOUT = value("--timeout", "240");
// --dir <folder>: another baseline folder (to try the tool without touching the recorded set).
const DIR = value("--dir") ? resolve(value("--dir")) : BASELINE_DIR;

// Each baseline: the tool and its arguments. `file` means the tool writes its JSON to that path
// (faction-bench); otherwise the JSON is the tool's whole standard output.
const missions = (...extra) => ({ tool: "tools/mission-check.mjs", args: ["--json", "--jobs", JOBS, "--timeout", TIMEOUT, ...extra] });
export const BASELINES = {
  "missions-story": missions("--difficulty", "story"),
  "missions-standard": { ...missions("--difficulty", "standard"), fast: true },
  "missions-veteran": missions("--difficulty", "veteran"),
  "missions-standard-mercy": missions("--difficulty", "standard", "--decide", "mercy"),
  "missions-standard-firm": missions("--difficulty", "standard", "--decide", "firm"),
  chronicles: { tool: "tools/chronicle-check.mjs", args: ["--chronicle", "all", "--json", "--jobs", JOBS, "--timeout", TIMEOUT], needs: "tools/chronicle-check.mjs --json (W0-A seam request, docs/aaa/results/round2/w0a.md)" },
  defence: { tool: "tools/defence-check.mjs", args: ["--json"], fast: true },
  "bench-classic": { tool: "tools/faction-bench.mjs", args: ["--jobs", JOBS, "--json"], file: true },
};

// The JSON a tool printed, without lines it prints after it (check:defence ends with PASS or FAIL).
export function leadingJson(text) {
  try { return JSON.parse(text); } catch {}
  const end = [...text.matchAll(/^[\]}]\s*$/gm)].at(-1);
  if (!end) throw new Error("no JSON");
  return JSON.parse(text.slice(0, end.index + 1));
}

// Runs one tool and returns its JSON (parsed), or throws with the reason.
function runTool(name, spec) {
  const out = join(ROOT, ".tmp", `baseline-${name}-${process.pid}.json`);
  const argv = [spec.tool, ...spec.args, ...(spec.file ? [out] : [])];
  return new Promise((resolve, reject) => {
    if (spec.file) mkdirSync(dirname(out), { recursive: true });
    const child = spawn(process.execPath, argv, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      // The checkers exit 1 when a target is missed: that is a result to compare, not an error.
      try {
        const text = spec.file ? readFileSync(out, "utf8") : stdout;
        if (spec.file) rmSync(out, { force: true });
        resolve(spec.file ? JSON.parse(text) : leadingJson(text));
      } catch {
        reject(new Error(`node ${argv.join(" ")} exited ${code} without JSON${spec.needs ? `; it needs ${spec.needs}` : ""}${stderr ? `: ${stderr.trim().split("\n").slice(-3).join(" | ")}` : ""}`));
      }
    });
  });
}

// A short, readable difference between two baselines: rows are compared by position, keyed by the
// fields that name them (mission and bot, level and difficulty, map and seats).
export function differences(before, after, limit = 12) {
  const label = (r) => (r && typeof r === "object" ? [r.mission, r.kind, r.level, r.difficulty, r.speed, r.map, r.seat0, r.seat1, r.build, r.attackAt].filter((x) => x !== undefined).join(" ") : "");
  const lines = [];
  if (!Array.isArray(before) || !Array.isArray(after)) return JSON.stringify(before) === JSON.stringify(after) ? [] : ["(whole value differs)"];
  if (before.length !== after.length) lines.push(`rows: ${before.length} -> ${after.length}`);
  for (let i = 0; i < Math.max(before.length, after.length); i++) {
    const a = before[i], b = after[i];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (!a || !b) { lines.push(`${a ? "removed" : "added"} row ${i}: ${label(a || b)}`); continue; }
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    lines.push(`${label(a) || `row ${i}`}: ${keys.map((k) => `${k} ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`).join("; ")}`);
  }
  return lines.length > limit ? [...lines.slice(0, limit), `... and ${lines.length - limit} more`] : lines;
}

// The text a baseline is stored as. A recorded file is read back and written the same way before the
// comparison, so "identical" means the same JSON value however the file was written.
export const stored = (data) => `${JSON.stringify(data, null, 1)}\n`;

async function main() {
  if (flag("--list")) {
    for (const [name, spec] of Object.entries(BASELINES)) console.log(`${name.padEnd(24)} ${spec.fast ? "fast" : "full"}  node ${spec.tool} ${spec.args.join(" ")}${spec.file ? " <file>" : ""}`);
    return 0;
  }
  const only = value("--only")?.split(",");
  const unknown = (only || []).filter((n) => !BASELINES[n]);
  if (unknown.length) { console.error(`Unknown baseline(s): ${unknown.join(", ")}. Baselines: ${Object.keys(BASELINES).join(" ")}`); return 2; }
  const names = Object.keys(BASELINES).filter((n) => (only ? only.includes(n) : flag("--full") || BASELINES[n].fast));
  const record = flag("--record");
  let bad = 0, compared = 0;
  console.log(`${record ? "Recording" : "Comparing"} ${names.length} baseline(s) in ${DIR.startsWith(ROOT) ? DIR.slice(ROOT.length + 1) : DIR}`);
  for (const name of names) {
    const file = join(DIR, `${name}.json`), started = Date.now();
    const seconds = () => `${Math.round((Date.now() - started) / 1000)} s`;
    if (!record && !existsSync(file)) { console.log(`${name.padEnd(24)} not recorded yet`); continue; }
    let data;
    try { data = await runTool(name, BASELINES[name]); }
    catch (error) { console.log(`${name.padEnd(24)} ERROR ${error.message}`); bad++; continue; }
    if (record) {
      mkdirSync(DIR, { recursive: true });
      writeFileSync(file, stored(data));
      console.log(`${name.padEnd(24)} recorded (${Array.isArray(data) ? data.length + " rows, " : ""}${seconds()})`);
      continue;
    }
    const before = JSON.parse(readFileSync(file, "utf8"));
    compared++;
    if (stored(before) === stored(data)) { console.log(`${name.padEnd(24)} identical (${seconds()})`); continue; }
    bad++;
    console.log(`${name.padEnd(24)} DIFFERS (${seconds()})`);
    for (const line of differences(before, data)) console.log(`    ${line}`);
  }
  console.log(bad ? `\n${bad} baseline(s) differ or failed` : record ? "\nRecorded" : compared ? `\nAll ${compared} compared baseline(s) identical` : "\nNo baseline recorded yet: nothing compared");
  return bad ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await main();
