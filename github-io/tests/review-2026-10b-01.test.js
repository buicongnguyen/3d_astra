import test from "node:test";
import assert from "node:assert/strict";
import { clientFile, functionBody } from "./lib/client-source.js";

// The client needs a DOM, so these assert on the source text of src/app/ (split from main.js in 0.8.0).

test("recalling an empty control group keeps the selection", () => {
  const body = functionBody(clientFile("selection.js"), "useGroup");
  assert.ok(body.includes("if(!live.length) { groups.delete(key);"));
  assert.ok(body.indexOf("!live.length") < body.indexOf("setSelection(live)"));
});

test("minimap drops remembered buildings of eliminated teams", () => {
  assert.match(clientFile("minimap.js"), /sim\.players\[e\.team\]\?\.eliminated \|\| \(sim\.isVisible\(e\) && !sim\.get\(id\)\)/);
});

test("stale hover is cleared when its entity is gone", () => {
  assert.match(clientFile("frame.js"), /if \(hover && !sim\.get\(hover\.id\)\) \{ hover = null;/);
});
