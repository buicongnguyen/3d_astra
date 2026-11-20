import test from "node:test";
import assert from "node:assert/strict";
import { clientFile, functionBody } from "./lib/client-source.js";

// Source text of the modules that own each behaviour (src/app/, split from main.js in 0.8.0).
const src = clientFile("minimap.js");
const preferences = clientFile("preferences.js");
const frame = clientFile("frame.js");

test("minimap contextmenu ignores touch long-press", () => {
  const i = src.indexOf('$("minimap").addEventListener("contextmenu"');
  assert.ok(i > 0);
  assert.match(src.slice(i, i + 250), /pointerType === "touch"\) return/);
});
test("applyPreferences refreshes audio title", () => {
  assert.match(functionBody(preferences, "applyPreferences"), /\$\("audio"\)\.title =/);
});
test("focusHome tolerates missing view", () => {
  assert.match(frame, /view\?\.focusOn\(hq\.x \+ 5/);
});
