import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// main.js needs a DOM, so these assert on its source text.
const src = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("recalling an empty control group keeps the selection", () => {
  const body = src.slice(src.indexOf("function useGroup"), src.indexOf("function runShortcut"));
  assert.ok(body.includes("if(!live.length) { groups.delete(key);"));
  assert.ok(body.indexOf("!live.length") < body.indexOf("setSelection(live)"));
});

test("minimap drops remembered buildings of eliminated teams", () => {
  assert.match(src, /sim\.players\[e\.team\]\?\.eliminated \|\| \(sim\.isVisible\(e\) && !sim\.get\(id\)\)/);
});

test("stale hover is cleared when its entity is gone", () => {
  assert.match(src, /if \(hover && !sim\.get\(hover\.id\)\) \{ hover = null;/);
});
