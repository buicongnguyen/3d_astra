// Layout contracts the style sheets keep, read as parsed rules (postcss) instead of regexes on the text (K11).
// What a browser would resolve is checked in the browser suites; here each rule is looked up by selector and
// at-rule condition and its declarations compared, so a reformatted or reordered sheet still passes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const sheet = (name) => postcss.parse(readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8"));
const norm = (s) => s.replace(/\s+/g, "").toLowerCase();
// Declarations of every rule whose selector list contains `selector`, inside the at-rule whose params match
// `media` (null = top level), merged in source order.
function decls(root, selector, media = null) {
  const out = {};
  root.walkRules((rule) => {
    const at = rule.parent?.type === "atrule" ? norm(`@${rule.parent.name}${rule.parent.params}`) : null;
    if (media === null ? at !== null : at !== norm(`@media${media}`)) return;
    if (!rule.selectors.some((s) => norm(s) === norm(selector))) return;
    rule.walkDecls((d) => { out[d.prop] = d.value; });
  });
  return out;
}

test("training card: the container lets taps through, the toggle and card catch them", () => {
  const css = sheet("tutorial.css");
  assert.equal(decls(css, "#training")["pointer-events"], "none");
  assert.equal(decls(css, "#training-toggle")["pointer-events"], "auto");
  assert.equal(decls(css, "#training-card")["pointer-events"], "auto");
});

test("training card clears the toolbar (tall screens) and the dock (wide compact screens)", () => {
  const css = sheet("tutorial.css");
  assert.equal(decls(css, "#training", "(max-aspect-ratio:1.35)").top, "54px");
  const wide = decls(css, ".compact-ui #training", "(min-aspect-ratio:1.35)");
  assert.equal(wide.top, "96px");
  assert.match(wide.right, /var\(--side-width/);
});

test("settings sheet keeps the side safe-area insets in the compact layout", () => {
  const panel = decls(sheet("settings.css"), ".settings-panel", "(max-width: 600px), (max-height: 600px)");
  assert.match(panel["padding-left"], /env\(safe-area-inset-left/);
  assert.match(panel["padding-right"], /env\(safe-area-inset-right/);
});

test("landscape briefing respects the left and right safe-area insets", () => {
  const css = sheet("start-screen.css"), media = "(orientation: landscape) and (max-height: 520px)";
  const has = (selector, inset) => Object.values(decls(css, selector, media)).some((v) => v.includes(inset));
  assert.ok(has(".compact-ui .briefing-copy", "safe-area-inset-left"), "copy column clears the left inset");
  assert.ok(has(".compact-ui .briefing-setup", "safe-area-inset-right"), "setup column clears the right inset");
});

test("story scene letterbox bars move by transform, and stay put when motion is off", () => {
  const css = sheet("scenes.css");
  assert.equal(decls(css, ".scene-veil.on .scene-bar").transform, "scaleY(1)");
  const off = decls(css, ":root.motion-off .scene-bar");
  assert.equal(off.transition, "none");
  assert.equal(off.transform, "scaleY(1)");
});

test("fonts: Baloo 2 is declared from the bundled Latin and Vietnamese files, and no stack uses system-ui", () => {
  const css = sheet("ui-theme.css");
  const files = [];
  css.walkAtRules("font-face", (rule) => rule.walkDecls("src", (d) => files.push(d.value)));
  assert.ok(files.some((v) => v.includes("baloo-2-vietnamese-800-normal.woff2")), "Vietnamese file");
  assert.ok(files.some((v) => v.includes("baloo-2-latin-800-normal.woff2")), "Latin file");
  assert.ok(decls(css, ":root")["--font-display"].startsWith('"Baloo 2"'));
  css.walkDecls((d) => assert.doesNotMatch(d.value, /system-ui/, `${d.prop} must not use system-ui`));
});

test("fonts: Korean uses the bundled Hangul subset only while lang is ko, and no Korean stack uses system-ui", () => {
  const css = sheet("language.css");
  const faces = [];
  css.walkAtRules("font-face", (rule) => { const d = {}; rule.walkDecls((x) => (d[x.prop] = x.value)); faces.push(d); });
  assert.equal(faces.length, 1);
  assert.match(faces[0].src, /noto-sans-kr-subset\.woff2/);
  assert.match(faces[0]["unicode-range"], /U\+AC00-D7A3/);
  assert.doesNotMatch(faces[0]["unicode-range"], /U\+0000|U\+00/, "Hangul only: Latin keeps the game's faces");
  const ko = decls(css, ':root[lang="ko"]');
  for (const v of ["--font-ui", "--font-tile", "--font-display"]) assert.match(ko[v], /"Frontier KR"/, v);
  css.walkDecls((d) => assert.doesNotMatch(d.value, /system-ui/, `${d.prop} must not use system-ui`));
});
