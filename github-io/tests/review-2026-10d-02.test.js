import test from "node:test";
import assert from "node:assert/strict";
import { clientFile, clientSource, functionBody } from "./lib/client-source.js";

// The client needs a DOM, so these assert on the source text of src/app/ (split from main.js in 0.8.0).
const files = { minimap: "minimap.js", updateUI: "hud.js", setModalOpen: "modals.js", newGame: "match-flow.js" };
const body = (name) => functionBody(clientFile(files[name]), name);
const src = clientSource();

test("minimap caches static terrain and draws fog from ImageData", () => {
  const m = body("minimap");
  assert.match(m, /minimapBase/);
  assert.match(m, /createImageData/);
  assert.doesNotMatch(m, /ctx\.fillRect\(\s*\(x/);
});

test("selection-info is only rewritten when its html changes", () => {
  assert.match(body("updateUI"), /infoHtml !== lastInfoHtml/);
});

test("every modal path goes through setModalOpen, which inerts and restores focus", () => {
  assert.doesNotMatch(src, /\$\("modal"\)\.hidden = (true|false)/);
  const h = body("setModalOpen");
  assert.match(h, /inert/);
  assert.match(h, /modalReturnFocus/);
  assert.match(src, /\$\("modal"\)\.addEventListener\("keydown"/);
});

test("newGame focuses a visible control outside skirmish", () => {
  assert.doesNotMatch(body("newGame"), /\$\("scenario"\)\.focus\(\)/);
  assert.match(body("newGame"), /data-mode\]\[aria-pressed=true/);
});
