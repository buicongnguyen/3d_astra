// tests/test-map.json (used by `npm run test:changed`, tests/changed.mjs) stays complete and correct.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { globToRegExp, loadMap, plan, rulesFor } from "./changed.mjs";
import { readMatrix } from "./lib/ci-matrix.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const map = loadMap();
const groups = readMatrix();
const suites = new Set(groups.flatMap((g) => g.scripts));
const scripts = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [relative(ROOT, full).replaceAll("\\", "/")];
  });
}

test("globs: ** folders, * within a name, {a,b}", () => {
  assert.ok(globToRegExp("src/sim/**").test("src/sim/content/elites.js"));
  assert.ok(globToRegExp("**/*.md").test("README.md"));
  assert.ok(globToRegExp("**/*.md").test("docs/aaa/X.md"));
  assert.ok(globToRegExp("src/*.css").test("src/style.css"));
  assert.ok(!globToRegExp("src/*.css").test("src/app/x.css"));
  assert.ok(globToRegExp("src/app/{hud,orders}.js").test("src/app/orders.js"));
  assert.ok(!globToRegExp("src/app/{hud,orders}.js").test("src/app/frame.js"));
  assert.ok(globToRegExp("tools/{a,b}.mjs").test("tools/b.mjs"));
});

test("every suite and check the map names exists", () => {
  for (const s of map.always) assert.ok(suites.has(s), `always: ${s}`);
  for (const r of map.rules) {
    if (r.suites !== "all") for (const s of r.suites) assert.ok(suites.has(s), `${r.name}: ${s} is in no CI matrix entry`);
    for (const c of r.checks) assert.ok(scripts[c.split(" ")[0]], `${r.name}: npm script ${c}`);
  }
});

test("every file under src/, public/ and tests/ is covered by a rule (add new files to tests/test-map.json)", () => {
  const files = ["src", "public", "tests"].flatMap((d) => walk(join(ROOT, d)));
  const own = (f) => /^tests\/[\w-]+\.mjs$/.test(f);
  const missing = files.filter((f) => !own(f) && !rulesFor(map, f).length);
  assert.deepEqual(missing, []);
});

test("every browser suite is reachable from some rule, so a change can select it", () => {
  const named = new Set(map.rules.flatMap((r) => (r.suites === "all" ? [] : r.suites)).concat(map.always));
  const unreachable = [...suites].filter((s) => !named.has(s));
  // Each of these has its own file only: a change to tests/<name>.mjs runs it, and so does any "all" rule.
  assert.deepEqual(unreachable.filter((s) => !["golden-full"].includes(s)), [], "name these suites in a rule of tests/test-map.json");
});

test("plans: a docs change runs nothing, a sim change the rules set, the frame loop everything", () => {
  const docs = plan(["docs/TESTING.md", "../README.md"], map, groups);
  assert.deepEqual([docs.all, docs.suites, docs.checks], [false, [], []]);
  const sim = plan(["src/sim/combat.js"], map, groups);
  assert.equal(sim.all, false);
  assert.ok(sim.unit && sim.suites.includes("golden-full") && sim.suites.includes("missions") && sim.suites.includes("browser"));
  assert.ok(sim.checks.includes("check:missions"));
  assert.equal(plan(["src/main.js"], map, groups).all, true);
  assert.equal(plan(["src/brand-new-file.js"], map, groups).all, true, "an unmapped file runs everything");
  // A changed suite runs itself, and a split suite selects all of its shards.
  const lang = plan(["tests/language.mjs"], map, groups);
  assert.ok(lang.groups.includes("languages") && lang.groups.includes("languages-2"));
  const css = plan(["src/phone-hud.css"], map, groups);
  assert.ok(["layout-f", "status-layout", "ui-quality", "phones", "readability"].every((s) => css.suites.includes(s)));
  assert.ok(css.groups.includes("layout-desktop") && css.groups.includes("layout-mobile"));
});
