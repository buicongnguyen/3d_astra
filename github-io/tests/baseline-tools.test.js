// The round 2 baseline tools (W0-A): forked bench workers give exactly a one-process run, the JSON
// outputs carry no wall-clock field, and baseline-diff reads, compares and reports.
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { differences, leadingJson, stored, BASELINES } from "../tools/baseline-diff.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Plays a tool; resolves { code, stdout } (the checkers exit 1 when a target is missed).
const tool = (file, args) => new Promise((resolve, reject) =>
  execFile(process.execPath, [file, ...args], { cwd: ROOT, maxBuffer: 1 << 24 }, (error, stdout, stderr) =>
    (error && typeof error.code !== "number" ? reject(error) : resolve({ code: error?.code ?? 0, stdout, stderr }))));
mkdirSync(join(ROOT, ".tmp"), { recursive: true });
const scratch = mkdtempSync(join(ROOT, ".tmp", "baseline-tools-"));
test.after(() => rmSync(scratch, { recursive: true, force: true }));

test("bench:factions --jobs 3 gives the one-process run byte for byte (10 matches); empty --rules change nothing", async () => {
  const subset = ["--factions", "meridian,ashfall", "--maps", "classic,riverlands,dunes,basin,highlands", "--speeds", "normal", "--cap", "30"];
  const out = (name) => join(scratch, `${name}.json`);
  const [one, three, rules] = await Promise.all([
    tool("tools/faction-bench.mjs", [...subset, "--json", out("one")]),
    tool("tools/faction-bench.mjs", [...subset, "--jobs", "3", "--json", out("three")]),
    tool("tools/faction-bench.mjs", [...subset, "--rules", "{}", "--json", out("rules")]),
  ]);
  const rows = JSON.parse(readFileSync(out("one"), "utf8"));
  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map((r) => `${r.map} ${r.seat0}`), ["classic", "riverlands", "dunes", "basin", "highlands"].flatMap((m) => [`${m} meridian`, `${m} ashfall`]));
  assert.equal(readFileSync(out("three"), "utf8"), readFileSync(out("one"), "utf8"));
  assert.equal(three.stdout, one.stdout, "the printed rows and summaries come out in the same order");
  assert.equal(readFileSync(out("rules"), "utf8"), readFileSync(out("one"), "utf8"));
  assert.equal(rules.code, 0);
});

test("skirmish-bench --json leaves out the wall-clock msPerTick, and --jobs gives the same rows", async () => {
  const subset = ["--speeds", "normal", "--maps", "classic", "--attack-at", "12,20", "--cap", "30"];
  const out = (name) => join(scratch, `ladder-${name}.json`);
  const [one] = await Promise.all([
    tool("tools/skirmish-bench.mjs", [...subset, "--json", out("one")]),
    tool("tools/skirmish-bench.mjs", [...subset, "--jobs", "2", "--json", out("two")]),
  ]);
  const rows = JSON.parse(readFileSync(out("one"), "utf8"));
  assert.deepEqual(rows.map((r) => Object.keys(r)), Array(2).fill(["speed", "map", "attackAt", "result", "seconds"]));
  assert.equal(readFileSync(out("two"), "utf8"), readFileSync(out("one"), "utf8"));
  assert.match(one.stdout, /"msPerTick"/, "the printed rows keep the timing");
});

test("check:missions --json: one row per mission and run, in order, a comma list for --only, no wall clock", async () => {
  const { stdout } = await tool("tools/mission-check.mjs", ["--json", "--only", "m02-first-contact,m01-first-light", "--bots", "passive", "--jobs", "2"]);
  const rows = JSON.parse(stdout);
  assert.deepEqual(rows.map((r) => `${r.mission} ${r.kind}`), ["m01-first-light passive", "m02-first-contact passive"]);
  for (const r of rows) {
    assert.deepEqual(Object.keys(r), ["mission", "kind", "result", "time", "objectives", "wave", "lost", "medal", "flags", "misses"]);
    assert.deepEqual(r.misses, []);
    assert.ok(Number.isInteger(r.time) && r.time <= 305);
  }
});

test("baseline-diff: the baselines it knows, the JSON before a checker's verdict, a readable difference", async () => {
  assert.deepEqual(Object.keys(BASELINES), ["missions-story", "missions-standard", "missions-veteran", "missions-standard-mercy", "missions-standard-firm", "chronicles", "defence", "bench-classic"]);
  assert.deepEqual(Object.keys(BASELINES).filter((n) => BASELINES[n].fast), ["missions-standard", "defence"]);
  assert.deepEqual(leadingJson('[\n  {\n    "level": "d-gorge"\n  }\n]\n\nFAIL\nd-gorge story: bot defeat 0★ < 3★\n'), [{ level: "d-gorge" }]);
  assert.deepEqual(leadingJson("[1, 2]"), [1, 2]);
  assert.throws(() => leadingJson("All targets met"));
  assert.equal(stored([{ a: 1 }]), '[\n {\n  "a": 1\n }\n]\n');
  assert.deepEqual(differences([{ mission: "m01-first-light", kind: "objective", time: 187 }], [{ mission: "m01-first-light", kind: "objective", time: 190 }]), ["m01-first-light objective: time 187 -> 190"]);
  assert.deepEqual(differences([{ level: "d-gorge", difficulty: "story" }], []), ["rows: 1 -> 0", "removed row 0: d-gorge story"]);
  assert.deepEqual(differences([1, 2], [1, 2]), []);
  // Nothing recorded in a folder: reported, not failed, and no tool is run.
  const { code, stdout } = await tool("tools/baseline-diff.mjs", ["--dir", join(scratch, "empty")]);
  assert.equal(code, 0);
  assert.match(stdout, /missions-standard\s+not recorded yet/);
  assert.match(stdout, /defence\s+not recorded yet/);
  assert.match(stdout, /nothing compared/);
});
