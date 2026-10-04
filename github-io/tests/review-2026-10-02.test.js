import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("minimap contextmenu ignores touch long-press", () => {
  const i = src.indexOf('$("minimap").addEventListener("contextmenu"');
  assert.ok(i > 0);
  assert.match(src.slice(i, i + 250), /pointerType === "touch"\) return/);
});
test("applyPreferences refreshes audio title", () => {
  const i = src.indexOf("function applyPreferences");
  const j = src.indexOf("\nfunction ", i + 10);
  assert.match(src.slice(i, j), /\$\("audio"\)\.title =/);
});
test("focusHome tolerates missing view", () => {
  assert.match(src, /view\?\.focusOn\(hq\.x \+ 5/);
});
