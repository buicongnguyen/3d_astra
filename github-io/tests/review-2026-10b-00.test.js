import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// main.js cannot be imported headless (DOM), so these assert on source text.
const src = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const body = (start, end) => { const i = src.indexOf(start); assert.ok(i >= 0); return src.slice(i, src.indexOf(end, i)); };
test("start recentres on HQ and clears hover", () => {
  const b = body('$("start").onclick', '$("pause").onclick');
  assert.match(b, /view\.reset\(\);\s*focusHome\(\)/);
  assert.match(b, /hover = null/);
});
test("previewBattle clears hover when replacing sim", () => {
  assert.match(body("sim = new Simulation({ map: mapId, enemyCount, aiSpeed, alliance, playerBonus: bonus });\n    view?.reset", "focusHome"), /hover = null/);
});
test("newGame rebuilds a clean sim", () => {
  assert.match(body("function newGame()", "tutorial = null"), /sim = new Simulation/);
});
test("Space does not swallow modal buttons", () => {
  assert.match(body("if(key===' '&&!e.ctrlKey)", "e.preventDefault()"), /#modal button/);
});
