// R3-M title cover: the painted key art (first-paint budget, layer sizes, picture sources), the layer table
// and the cover style sheet's contracts. The page itself is checked in tests/cover-ui.mjs (browser).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import postcss from "postcss";

const src = (path) => new URL(`../src/${path}`, import.meta.url);
const read = (path) => readFileSync(src(path), "utf8");

// Width and height from a WebP header (VP8, VP8L or VP8X).
function webpSize(path) {
  const b = readFileSync(src(path));
  assert.equal(b.toString("ascii", 0, 4), "RIFF", `${path} is RIFF`);
  assert.equal(b.toString("ascii", 8, 12), "WEBP", `${path} is WebP`);
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === "VP8L") { const bits = b.readUInt32LE(21); return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

test("cover art: one flat cover per frame (350 KB at most each), layers within budget, one fetched at first paint", () => {
  const frames = { desktop: [2560, 1440], landscape: [1688, 780], portrait: [1170, 2532] };
  for (const [shape, size] of Object.entries(frames)) {
    const path = `art/cover/keyart-${shape}.webp`;
    assert.deepEqual(webpSize(path), size, path);
    assert.ok(statSync(src(path)).size <= 350 * 1024, `${path} is ${statSync(src(path)).size} bytes`);
  }
  const layers = readdirSync(src("art/cover")).filter((f) => f.startsWith("layer-"));
  assert.equal(layers.length, 16);
  assert.ok(statSync(src("art/cover/layer-foreground-squad.webp")).size <= 300 * 1024, "the squad layer was re-encoded");
  const lazy = layers.reduce((sum, f) => sum + statSync(src(`art/cover/${f}`)).size, 0);
  assert.ok(lazy <= 1700 * 1024, `layers ${Math.round(lazy / 1024)} KB`);
  // <picture> fetches one flat cover: portrait phones and tablets, short landscape phones, everything else.
  const shell = read("app/shell.js");
  assert.match(shell, /<source media="\(orientation: portrait\) and \(max-width: 900px\)" srcset="\$\{COVERS\.portrait\}"/);
  assert.match(shell, /<source media="\(orientation: landscape\) and \(max-height: 520px\)" srcset="\$\{COVERS\.landscape\}"/);
  assert.match(shell, /<img src="\$\{COVERS\.desktop\}"[^>]*fetchpriority="high"/);
  assert.match(shell, /<div id="title-actions" class="title-actions" hidden><\/div>/, "R3-Q's Quick battle slot");
  // The layers' bytes are not in the first paint: only their URLs are bundled, and cover.js waits for the models.
  assert.match(read("app/cover-layers.js"), /import\.meta\.glob\("\.\.\/art\/cover\/layer-\*\.webp", \{ query: "\?url", import: "default", eager: true \}\)/);
  assert.match(read("app/cover.js"), /if \(booted && layersState === "idle"\)/);
});

test("cover layers: the art's table, back to front, every file present, every labelled world placed", async () => {
  const source = read("app/cover-layers.js");
  const names = [...source.matchAll(/^\s{2}\["([a-z-]+)", /gm)].map((m) => m[1]);
  assert.deepEqual(names, ["stars", "sun-amber", "sun-silver", "planet-ember", "planet-dunes", "planet-ringed-river", "planet-storm",
    "ships-balloon", "ships-glider", "ships-rotor", "ships-dropship", "storm-horizon", "foreground-squad", "ranger-flash"]);
  for (const name of [...names, "nebula-wide", "nebula-portrait"]) assert.ok(statSync(src(`art/cover/layer-${name}.webp`)).size > 0, name);
  // Squad and flash share one registration in every frame.
  const rows = Object.fromEntries([...source.matchAll(/^\s{2}\["([a-z-]+)", [^,]+, (\[[^\]]+\]), (\[[^\]]+\]), (\[[^\]]+\])/gm)].map((m) => [m[1], m.slice(2).join()]));
  assert.equal(rows["foreground-squad"], rows["ranger-flash"]);
  const worlds = [...source.matchAll(/"(planet-[a-z-]+)": \{ id: "(\w+)"/g)].map((m) => m[2]);
  const labels = [...read("app/cover.js").matchAll(/^\s{2}(\w+): \{ name: "/gm)].map((m) => m[1]);
  assert.deepEqual(worlds.sort(), labels.sort());
});

test("cover style: 11 px text, no system-ui, animations only while the cover is live, art under the top bar", () => {
  const css = postcss.parse(read("cover.css"));
  css.walkDecls((d) => {
    assert.doesNotMatch(d.value, /system-ui/, `${d.prop} must not use system-ui`);
    if (d.prop === "font-size" || d.prop === "font") {
      // The first length is the size (or a clamp's minimum).
      const size = d.value.match(/(\d+(?:\.\d+)?)px/);
      if (size) assert.ok(Number(size[1]) >= 11, `${d.parent.selector}: ${d.prop} ${d.value}`);
    }
    // Every running animation of the cover is gated by #briefing.cover-live (calm = none at all).
    if (d.prop === "animation" && d.value !== "none" && !/cover-orbit/.test(d.value)) assert.match(d.parent.selector, /cover-live/, d.parent.selector);
  });
  let fixed = false;
  css.walkRules((rule) => {
    if (rule.selector.includes("#briefing .briefing-art") && rule.selector.includes(".cover-fx")) {
      rule.walkDecls("position", (d) => { fixed ||= d.value === "fixed"; });
      rule.walkDecls("top", (d) => assert.match(d.value, /var\(--cover-top/));
    }
  });
  assert.ok(fixed, "art and live layers are fixed below the top bar");
  const vi = JSON.parse(read("locales/vi.json")).messages;
  for (const text of ["War for the Meridian Frontier", "Command uplink", "Sector 07", "Frostline Reach", "Contested", "Under siege", "Enemy held", "Scouted"])
    assert.ok(vi[text], `vi.json: ${text}`);
});
