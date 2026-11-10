import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaults, normalize } from "../src/settings.js";
import { isTouchPointer, TouchControls } from "../src/touch-controls.js";
import { audioPower } from "../src/ambience.js";
import { translate } from "../src/i18n.js";

const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("the FPS readout is a setting, off by default", () => {
  assert.equal(defaults().showFps, false);
  assert.equal(normalize({ ...defaults(), showFps: true }).showFps, true);
  assert.equal(normalize({ ...defaults(), showFps: "yes" }).showFps, false);
});

test("a pen plays as a mouse only where a fine pointer exists", () => {
  assert.equal(isTouchPointer({ pointerType: "touch" }, true), true);
  assert.equal(isTouchPointer({ pointerType: "mouse" }, false), false);
  assert.equal(isTouchPointer({ pointerType: "pen" }, true), false);
  assert.equal(isTouchPointer({ pointerType: "pen" }, false), true);
  const canvas = new EventTarget(), seen = [];
  canvas.setPointerCapture = () => {};
  new TouchControls(canvas, { enabled: () => true, isTouch: (e) => isTouchPointer(e, true), activate: () => seen.push("touch"), rectangle: () => {} });
  for (const pointerType of ["pen", "touch"]) canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { pointerType, pointerId: 1, clientX: 5, clientY: 5 }));
  assert.deepEqual(seen, ["touch"]);
});

test("audio sleeps when quiet and wakes from suspended or interrupted", () => {
  const context = (state) => ({ state, calls: [], suspend() { this.calls.push("suspend"); return Promise.resolve(); }, resume() { this.calls.push("resume"); return Promise.reject(new Error("needs a gesture")); } });
  for (const [state, quiet, calls] of [["running", true, ["suspend"]], ["suspended", true, []], ["suspended", false, ["resume"]],
    ["interrupted", false, ["resume"]], ["running", false, []], ["closed", false, []]]) {
    const c = context(state);
    audioPower(c, quiet);
    assert.deepEqual(c.calls, calls, `${state} quiet=${quiet}`);
  }
  audioPower(null, true);
});

test("new client strings have Vietnamese text", () => {
  for (const text of ["Enemy attack incoming!", "Graphics were interrupted. Restoring…", "Retry", "Show FPS", "Version", "Loading 3 of 14…",
    "Minimap: click to pan; right-click to command", "Some game files did not download. Check your connection, then press Retry."]) {
    assert.ok(main.includes(text.split(" 3 of")[0].split(". ")[0]) || ["Show FPS", "Version"].includes(text), text);
    assert.notEqual(translate(text, "vi"), text, text);
  }
});

test("the training counter uses the real lesson count", () => {
  assert.match(main, /Training \$\{tutorial\.index\+1\}\/\$\{TRAINING_STEPS\.length\}/);
  assert.doesNotMatch(main, /Training \$\{tutorial\.index\+1\}\/8/);
});
