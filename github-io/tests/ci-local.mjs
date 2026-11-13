// Runs the CI browser matrix on this machine before a push: `npm run test:ci-local`.
// The groups come from .github/workflows/pages.yml, so this never drifts from CI.
//
//   npm run test:ci-local                       every group, as slow as CI (software rendering, CPU 20x slower)
//   npm run test:ci-local -- defence story      only these groups (names from pages.yml)
//   npm run test:ci-local -- --fast             full speed with the real GPU (quicker, catches less)
//   npm run test:ci-local -- --no-build         test the dist/ already built
//
// Env: CI_LOCAL_PORT (default 4231), CI_LOCAL_LANES (default 4), SLOW_CPU (default 20; see
// tests/lib/ci-like.mjs for the calibration). The whole matrix takes about 45 minutes in 4 lanes.
// Logs: test-results/ci-local/<group>--<suite>.log.
// It builds with visible output and stops if the build fails: a hidden build error once let a run
// test an old dist/. The preview server it starts is stopped by its own PID when it finishes.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW = join(ROOT, "..", ".github", "workflows", "pages.yml");
const LOGS = join(ROOT, "test-results", "ci-local");

// The browser matrix: each `- name:` entry with its `scripts:` and optional `layoutOnly:`.
export function readMatrix(text) {
  const groups = [];
  for (const line of text.split(/\r?\n/)) {
    let m;
    if ((m = line.match(/^\s+- name: (\S+)\s*$/))) groups.push({ name: m[1], scripts: [], layoutOnly: "" });
    else if (groups.length && (m = line.match(/^\s+scripts: (.+)$/))) groups.at(-1).scripts = m[1].trim().split(/\s+/);
    else if (groups.length && (m = line.match(/^\s+layoutOnly: (.+)$/))) groups.at(-1).layoutOnly = m[1].trim();
  }
  return groups.filter((g) => g.scripts.length);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, ...opts });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function waitFor(url, seconds = 30) {
  for (let i = 0; i < seconds * 2; i++) {
    try { if ((await fetch(url)).ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const argv = process.argv.slice(2);
  const fast = argv.includes("--fast");
  const build = !argv.includes("--no-build");
  const wanted = argv.filter((a) => !a.startsWith("--"));
  const port = Number(process.env.CI_LOCAL_PORT || 4231);
  const lanes = Math.max(1, Number(process.env.CI_LOCAL_LANES || 4));
  const slow = fast ? 0 : Number(process.env.SLOW_CPU || 20);

  const all = readMatrix(readFileSync(WORKFLOW, "utf8"));
  const unknown = wanted.filter((w) => !all.some((g) => g.name === w));
  if (unknown.length) {
    console.error(`Unknown group(s): ${unknown.join(", ")}. Groups: ${all.map((g) => g.name).join(" ")}`);
    process.exit(2);
  }
  const groups = wanted.length ? all.filter((g) => wanted.includes(g.name)) : all;

  const node = process.execPath;
  if (build) {
    console.log("Building (vite build)…");
    const code = await run(node, [join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build"], { stdio: "inherit" });
    if (code !== 0) { console.error("Build failed: nothing tested."); process.exit(1); }
  }

  const url = `http://127.0.0.1:${port}/`;
  if (await waitFor(url, 1)) { console.error(`Port ${port} is already in use; set CI_LOCAL_PORT.`); process.exit(2); }
  const preview = spawn(node, [join(ROOT, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: ROOT, stdio: "ignore" });
  const stop = () => {
    if (preview.exitCode !== null) return;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(preview.pid), "/T", "/F"], { stdio: "ignore" });
    else preview.kill();
  };
  process.on("exit", stop);
  process.on("SIGINT", () => { stop(); process.exit(130); });
  if (!(await waitFor(url))) { console.error("Preview server did not start."); stop(); process.exit(1); }

  mkdirSync(LOGS, { recursive: true });
  const preload = pathToFileURL(join(ROOT, "tests", "lib", "ci-like.mjs")).href;
  const env = { ...process.env, TEST_URL: url, ...(slow > 1 ? { SLOW_CPU: String(slow), SOFTWARE_RENDER: "1" } : { SLOW_CPU: "", SOFTWARE_RENDER: "" }) };
  const scripts = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts;
  // Every browser suite is `node tests/<name>.mjs`; run it directly so the preload loads there only.
  const command = (script) => {
    const m = (scripts[`test:${script}`] || "").match(/^node (\S+\.mjs)$/);
    if (!m) throw new Error(`test:${script} is not "node tests/<file>.mjs"`);
    return [node, [...(slow > 1 ? ["--import", preload] : []), m[1]]];
  };
  console.log(`${groups.length} group(s), ${lanes} lane(s), ${slow > 1 ? `software rendering + CPU slowed ${slow}x` : "full speed"}, ${url}`);

  const results = [];
  const queue = [...groups];
  async function lane() {
    for (let g; (g = queue.shift()); ) {
      for (const script of g.scripts) {
        const started = Date.now();
        const log = join(LOGS, `${g.name}--${script}.log`);
        const out = [];
        const code = await new Promise((resolve) => {
          const [cmd, args] = command(script);
          const child = spawn(cmd, args, { cwd: ROOT, env: { ...env, LAYOUT_ONLY: g.layoutOnly } });
          child.stdout.on("data", (d) => out.push(d));
          child.stderr.on("data", (d) => out.push(d));
          child.on("exit", (c) => resolve(c ?? 1));
        });
        writeFileSync(log, Buffer.concat(out));
        const row = { group: g.name, script, pass: code === 0, seconds: Math.round((Date.now() - started) / 1000) };
        results.push(row);
        console.log(`${row.pass ? "PASS" : "FAIL"} ${g.name}/${script} (${row.seconds}s)${row.pass ? "" : `  log: ${log}`}`);
      }
    }
  }
  await Promise.all(Array.from({ length: lanes }, lane));
  stop();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `; failed: ${failed.map((r) => `${r.group}/${r.script}`).join(", ")}` : ""}`);
  process.exit(failed.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
