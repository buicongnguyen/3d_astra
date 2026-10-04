import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// main.js needs a DOM, so these assert on its source text.
const src = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const body = (name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf("\nfunction ", src.indexOf(`function ${name}(`) + 10));

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
