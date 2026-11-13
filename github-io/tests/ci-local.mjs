// Runs what CI runs, on this machine, before a push: `npm run test:ci-local`.
// The browser groups come from .github/workflows/pages.yml, so this never drifts from CI.
//
//   npm run test:ci-local                       unit tests, build, every group as slow as CI
//                                               (software rendering, CPU 20x slower)
//   npm run test:ci-local -- defence story      only these groups (names from pages.yml)
//   npm run test:ci-local -- --fast             full speed with the real GPU (quicker; catches the
//                                               opposite race: a check read before a frame has drawn)
//   npm run test:ci-local -- --no-build         test the dist/ already built
//   npm run test:ci-local -- --no-unit          skip `npm test`
//
// Env: CI_LOCAL_PORT (default 4231), CI_LOCAL_LANES (default 4), SLOW_CPU (default 20; see
// tests/lib/ci-like.mjs for the calibration), CI_LOCAL_TIMEOUT minutes per suite (default 30, CI's
// job limit). The whole matrix takes about an hour in 4 lanes. `npm run check:defence` (CI runs it
// too, a few minutes) is not included.
// Logs: test-results/ci-local/<group>--<suite>.log, written as the suite runs.
// It builds with visible output and stops if the build fails: a hidden build error once let a run
// test an old dist/. The preview server and every suite are stopped by their own PIDs.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, readdirSync, rmSync, createWriteStream } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readMatrix } from "./lib/ci-matrix.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGS = join(ROOT, "test-results", "ci-local");
const VITE = join(ROOT, "node_modules", "vite", "bin", "vite.js");
const node = process.execPath;

const argv = process.argv.slice(2);
const fast = argv.includes("--fast");
const build = !argv.includes("--no-build");
const unit = !argv.includes("--no-unit");
const wanted = argv.filter((a) => !a.startsWith("--"));
const port = Number(process.env.CI_LOCAL_PORT || 4231);
const lanes = Math.max(1, Number(process.env.CI_LOCAL_LANES || 4));
const slow = fast ? 0 : Number(process.env.SLOW_CPU || 20);
const suiteTimeout = Number(process.env.CI_LOCAL_TIMEOUT || 30) * 60_000;

// Stops a process and everything it started (a suite's Chrome, the preview server).
function kill(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGKILL");
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function answers(url) {
  try { return (await fetch(url)).ok; } catch { return false; }
}

const all = readMatrix();
const unknown = wanted.filter((w) => !all.some((g) => g.name === w));
if (unknown.length) {
  console.error(`Unknown group(s): ${unknown.join(", ")}. Groups: ${all.map((g) => g.name).join(" ")}`);
  process.exit(2);
}
const groups = wanted.length ? all.filter((g) => wanted.includes(g.name)) : all;

if (unit) {
  console.log("Unit tests (npm test)…");
  if ((await run(node, ["--test", "tests/*.test.js"])) !== 0) { console.error("Unit tests failed: no browser suites run."); process.exit(1); }
}
if (build) {
  console.log("Building (vite build)…");
  if ((await run(node, [VITE, "build"])) !== 0) { console.error("Build failed: nothing tested."); process.exit(1); }
}

const url = `http://127.0.0.1:${port}/`;
if (await answers(url)) { console.error(`Port ${port} is already in use; set CI_LOCAL_PORT.`); process.exit(2); }
const preview = spawn(node, [VITE, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: ROOT, stdio: "ignore" });
const running = new Set([preview]);
process.on("exit", () => { for (const child of running) kill(child); });
process.on("SIGINT", () => process.exit(130));
let up = false;
for (let i = 0; i < 60 && !up && preview.exitCode === null; i++) {
  up = await answers(url);
  if (!up) await new Promise((r) => setTimeout(r, 500));
}
if (!up) { console.error(`Preview server did not start on port ${port}.`); process.exit(1); }

mkdirSync(LOGS, { recursive: true });
for (const f of readdirSync(LOGS)) if (f.endsWith(".log")) rmSync(join(LOGS, f));
const preload = pathToFileURL(join(ROOT, "tests", "lib", "ci-like.mjs")).href;
const env = { ...process.env, TEST_URL: url, ...(slow > 1 ? { SLOW_CPU: String(slow), SOFTWARE_RENDER: "1" } : { SLOW_CPU: "", SOFTWARE_RENDER: "" }) };
const scripts = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts;
console.log(`${groups.length} group(s), ${lanes} lane(s), ${slow > 1 ? `software rendering + CPU slowed ${slow}x` : "full speed"}, ${url}`);

// One suite, run as `node [--import ci-like] tests/<file>.mjs` (every browser suite has that form,
// see ci-matrix.test.js) so the preload loads in the suite only. Resolves true when it passed.
function runSuite(group, script, log) {
  return new Promise((resolve) => {
    const m = (scripts[`test:${script}`] || "").match(/^node (\S+\.mjs)$/);
    if (!m) { log.end(`test:${script} is not "node tests/<file>.mjs"\n`); return resolve(false); }
    const child = spawn(node, [...(slow > 1 ? ["--import", preload] : []), m[1]], { cwd: ROOT, env: { ...env, LAYOUT_ONLY: group.layoutOnly } });
    running.add(child);
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const timer = setTimeout(() => { log.write(`\n[ci-local] stopped after ${suiteTimeout / 60_000} min\n`); kill(child); }, suiteTimeout);
    let finished = false;
    const done = (ok) => { if (finished) return; finished = true; clearTimeout(timer); running.delete(child); child.stdout.unpipe(log); child.stderr.unpipe(log); log.end(); resolve(ok); };
    child.on("error", (error) => { log.write(`[ci-local] ${error.message}\n`); done(false); });
    child.on("close", (code) => done(code === 0));
  });
}

const results = [];
const queue = [...groups];
async function lane() {
  for (let g; (g = queue.shift()); ) {
    for (const script of g.scripts) {
      const started = Date.now();
      const file = join(LOGS, `${g.name}--${script}.log`);
      const pass = await runSuite(g, script, createWriteStream(file));
      const row = { group: g.name, script, pass, seconds: Math.round((Date.now() - started) / 1000) };
      results.push(row);
      console.log(`${pass ? "PASS" : "FAIL"} ${g.name}/${script} (${row.seconds}s)${pass ? "" : `  log: ${file}`}`);
    }
  }
}
await Promise.all(Array.from({ length: lanes }, lane));

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `; failed: ${failed.map((r) => `${r.group}/${r.script}`).join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
