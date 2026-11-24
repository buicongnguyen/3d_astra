// Runs the checks that cover what changed, for quick feedback while working: `npm run test:changed`.
// The map of files to checks is tests/test-map.json. CI ignores it and always runs the full matrix,
// and before a merge or push the full `npm run test:ci-local` still runs (docs/TESTING.md, "Which tests when").
//
//   npm run test:changed                     changes against origin/main (commits, staged, unstaged, new files)
//   npm run test:changed -- HEAD~3           against another base
//   npm run test:changed -- --dry            print the plan only
//   npm run test:changed -- --ci-like        browser suites as slow as CI (default: --fast, the real GPU)
//   npm run test:changed -- --no-unit        skip `npm test` (it runs whenever src/ or tests/ changed)
//   npm run test:changed -- --no-checks      skip the bots the map names (check:missions, check:defence)
//
// Browser suites run through tests/ci-local.mjs (same env: CI_LOCAL_PORT, CI_LOCAL_LANES), each with
// the matrix entry it has in CI (layoutOnly, shard), so a split suite runs all its shards.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readMatrix } from "./lib/ci-matrix.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      i++;
      if (glob[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*";
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      re += "(?:" + glob.slice(i + 1, end).split(",").map((p) => p.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")).join("|") + ")";
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function loadMap(text = readFileSync(join(ROOT, "tests", "test-map.json"), "utf8")) {
  const map = JSON.parse(text);
  for (const rule of map.rules) rule.res = rule.files.map(globToRegExp);
  return map;
}

export const rulesFor = (map, path) => map.rules.filter((r) => r.res.some((re) => re.test(path)));

// paths: relative to github-io/ (outside it: ../<path>). Returns what to run and why.
export function plan(paths, map = loadMap(), groups = readMatrix()) {
  const allSuites = [...new Set(groups.flatMap((g) => g.scripts))];
  const suites = new Set(), checks = new Set(), why = [];
  let all = false, unit = false;
  for (const path of paths) {
    const own = path.match(/^tests\/([\w-]+)\.mjs$/);
    if (own && allSuites.includes(own[1])) { suites.add(own[1]); why.push([path, `its own suite ${own[1]}`]); }
    if (/^(src|tests|public)\//.test(path) || path === "package.json") unit = true;
    const rules = rulesFor(map, path);
    if (!rules.length && !own) { all = true; why.push([path, "no rule in tests/test-map.json: everything"]); continue; }
    for (const r of rules) {
      if (r.suites === "all") all = true; else r.suites.forEach((s) => suites.add(s));
      r.checks.forEach((c) => checks.add(c));
      why.push([path, r.name]);
    }
  }
  if (all) allSuites.forEach((s) => suites.add(s));
  else if (paths.some((p) => !rulesFor(map, p).every((r) => r.name.startsWith("docs")))) map.always.forEach((s) => suites.add(s));
  // golden-full is a matrix entry but runs no browser: keep it with the suites, it is in the matrix.
  const picked = groups.filter((g) => g.scripts.some((s) => suites.has(s)));
  return { all, unit, suites: [...suites].sort(), checks: [...checks], groups: picked.map((g) => g.name), why };
}

function gitLines(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout.split(/\r?\n/).filter(Boolean);
}

// Changed paths since `base` (merge base), plus staged, unstaged and untracked files, relative to github-io/.
export function changedPaths(base) {
  const prefix = gitLines(["rev-parse", "--show-prefix"])[0] || ""; // "github-io/"
  const fromTop = new Set([
    ...gitLines(["diff", "--name-only", `${base}...HEAD`]),
    ...gitLines(["diff", "--name-only", "HEAD"]),
    ...spawnSync("git", ["ls-files", "--others", "--exclude-standard", "--full-name"], { cwd: ROOT, encoding: "utf8" }).stdout.split(/\r?\n/).filter(Boolean),
  ]);
  return [...fromTop].map((p) => (p.startsWith(prefix) ? p.slice(prefix.length) : `../${p}`)).sort();
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" && cmd === "npm" });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const base = argv.find((a) => !a.startsWith("--")) || "origin/main";
  const paths = changedPaths(base);
  const p = plan(paths);
  console.log(`Changed against ${base}: ${paths.length} file(s)`);
  for (const [path, reason] of p.why) console.log(`  ${path}  ->  ${reason}`);
  console.log(`Unit tests: ${p.unit && !flags.has("--no-unit") ? "npm test" : "no"}`);
  console.log(`Browser suites (${p.all ? "ALL" : p.suites.length}): ${p.all ? "the whole matrix" : p.suites.join(" ") || "none"}`);
  console.log(`Checks: ${flags.has("--no-checks") ? "skipped" : p.checks.join(", ") || "none"}`);
  if (flags.has("--dry")) process.exit(0);
  let failed = 0;
  if (p.groups.length || (p.unit && !flags.has("--no-unit"))) {
    const args = ["tests/ci-local.mjs", ...(flags.has("--ci-like") ? [] : ["--fast"]), ...(p.unit && !flags.has("--no-unit") ? [] : ["--no-unit"])];
    if (!p.groups.length) args.push("--no-browser");
    else if (!p.all) args.push(`--suites=${p.suites.join(",")}`, ...p.groups);
    failed += (await run(process.execPath, args)) !== 0;
  }
  if (!flags.has("--no-checks")) for (const c of p.checks) {
    const [script, ...rest] = c.split(" ");
    console.log(`\nnpm run ${c}`);
    failed += (await run("npm", ["run", script, ...rest])) !== 0;
  }
  console.log(failed ? `\n${failed} step(s) failed.` : "\nAll selected checks passed. Before a merge or push: npm run test:ci-local (the full matrix).");
  process.exit(failed ? 1 : 0);
}
