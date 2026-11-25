// Every browser suite runs in CI, and `npm run test:ci-local` can run every CI group.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readMatrix } from "./lib/ci-matrix.mjs";

const scripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts;
const groups = readMatrix();
// Suites CI does not run, on purpose: webkit and iphone-audit need `npx playwright install webkit` (see
// docs/TESTING.md, docs/PLATFORM.md).
const NOT_IN_CI = new Set(["webkit", "iphone-audit", "ci-local", "changed"]);

test("the CI browser matrix is read from pages.yml", () => {
  assert.ok(groups.length >= 20, `only ${groups.length} groups read`);
  assert.equal(new Set(groups.map((g) => g.name)).size, groups.length, "group names are unique");
  assert.deepEqual(groups.find((g) => g.name === "layout-mobile").scripts, ["layout-f"]);
  assert.match(groups.find((g) => g.name === "layout-mobile").layoutOnly, /portrait/);
});

test("every matrix script is a browser suite run as node tests/<file>.mjs", () => {
  for (const g of groups) for (const s of g.scripts) {
    assert.match(scripts[`test:${s}`] || "", /^node tests\/[\w-]+\.mjs$/, `${g.name}: test:${s}`);
  }
});

test("a sharded suite runs every shard 1..n exactly once (tests/lib/shard.mjs)", async () => {
  const { parseShard, pickShard } = await import("./lib/shard.mjs");
  const byScript = new Map();
  for (const g of groups) if (g.shard) {
    assert.equal(g.scripts.length, 1, `${g.name}: a sharded group holds one suite`);
    const { index, count } = parseShard(g.shard);
    const seen = byScript.get(g.scripts[0]) || { count, indices: [] };
    assert.equal(seen.count, count, `${g.scripts[0]}: every shard has the same n`);
    seen.indices.push(index);
    byScript.set(g.scripts[0], seen);
  }
  for (const [script, { count, indices }] of byScript) {
    assert.deepEqual(indices.sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i + 1), `${script}: shards 1..${count}`);
    // A sharded suite is never also run unsharded (that would run it twice).
    assert.ok(!groups.some((g) => !g.shard && g.scripts.includes(script)), `${script} also runs unsharded`);
  }
  // The shards of a list cover it exactly once.
  const list = Array.from({ length: 45 }, (_, i) => i);
  const parts = [1, 2, 3].map((index) => pickShard(list, { index, count: 3 }));
  assert.deepEqual(parts.flat().sort((a, b) => a - b), list);
  assert.throws(() => parseShard("4/3"));
  assert.throws(() => parseShard("1-3"));
  assert.deepEqual(parseShard(""), { index: 1, count: 1 });
});

test("every browser suite in package.json is in the CI matrix", () => {
  const inMatrix = new Set(groups.flatMap((g) => g.scripts));
  const missing = Object.entries(scripts)
    .filter(([k, v]) => k.startsWith("test:") && /^node tests\/[\w-]+\.mjs$/.test(v) && !NOT_IN_CI.has(k.slice(5)) && !inMatrix.has(k.slice(5)))
    .map(([k]) => k);
  assert.deepEqual(missing, [], "add these to a group in .github/workflows/pages.yml");
});
