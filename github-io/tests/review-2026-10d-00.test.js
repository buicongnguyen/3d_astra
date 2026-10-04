import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// view.js needs WebGL/DOM, so this asserts on source text.
const src = readFileSync(new URL("../src/view.js", import.meta.url), "utf8");
test("explored walls stay drawn in remembered fog", () => {
  const line = src.split("\n").find((l) => /o\.visible\s*=/.test(l) && l.includes("isVisible(e)"));
  assert.ok(line, "entity visibility line exists");
  assert.match(line, /e\.kind === "wall" \? sim\.isExplored\(e\)/);
});
