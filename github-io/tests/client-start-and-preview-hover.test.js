import test from "node:test";
import assert from "node:assert/strict";
import { clientFile, functionBody } from "./lib/client-source.js";
// The client cannot be imported headless (DOM), so these assert on source text of src/app/
// (split from main.js in 0.8.0).
const matchFlow = clientFile("match-flow.js");
const from = (text, start, end) => { const i = text.indexOf(start); assert.ok(i >= 0, start); return end ? text.slice(i, text.indexOf(end, i)) : text.slice(i); };
test("start recentres on HQ and clears hover", () => {
  // Start runs beginMatch (match-flow.js), which resets the view, recentres on HQ and clears hover.
  assert.match(from(matchFlow, '$("start").onclick'), /beginMatch\(\)/);
  const b = functionBody(matchFlow, "beginMatch");
  assert.match(b, /view\.reset\(\);\s*focusHome\(\)/);
  assert.match(b, /hover = null/);
});
test("previewBattle clears hover when replacing sim", () => {
  const briefing = clientFile("briefing.js");
  const i = briefing.search(/sim = createSim\(\);\s*view\?\.reset/);
  assert.ok(i >= 0);
  assert.match(briefing.slice(i, briefing.indexOf("focusHome", i)), /hover = null/);
});
