// Every browser suite runs in CI, and `npm run test:ci-local` can run every CI group.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readMatrix } from "./lib/ci-matrix.mjs";

const scripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts;
const groups = readMatrix();
// Suites CI does not run, on purpose: webkit needs `npx playwright install webkit` (see docs/TESTING.md).
const NOT_IN_CI = new Set(["webkit", "ci-local"]);

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

test("every browser suite in package.json is in the CI matrix", () => {
  const inMatrix = new Set(groups.flatMap((g) => g.scripts));
  const missing = Object.entries(scripts)
    .filter(([k, v]) => k.startsWith("test:") && /^node tests\/[\w-]+\.mjs$/.test(v) && !NOT_IN_CI.has(k.slice(5)) && !inMatrix.has(k.slice(5)))
    .map(([k]) => k);
  assert.deepEqual(missing, [], "add these to a group in .github/workflows/pages.yml");
});
