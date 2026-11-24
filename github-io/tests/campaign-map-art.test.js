// R3 map pass: the painted campaign map (src/art/campaign/, Codex/OpenAI ImageGen art). The relay anchors come
// from the art's README table keyed by mission id, mapLayout stays the fallback for a mission without one, the
// paintings load only with the campaign map, and relays keep 44 px apart on the smallest boards the layout gives.
// Browser checks: tests/story.mjs, tests/choices.mjs, tests/openings.mjs (and .tmp screenshots in the results).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { MISSIONS } from "../src/story/missions.js";
import { MAP_ANCHORS, MAP_ART, MAP_NODES, STRIP_NODES, mapNodes, mapLayout } from "../src/story/campaign-map.js";

const src = (p) => new URL(`../src/${p}`, import.meta.url);
const read = (p) => readFileSync(src(p), "utf8");

test("every mission has a README anchor on both paintings, and the nodes sit exactly there", () => {
  for (const m of MISSIONS) {
    const a = MAP_ANCHORS[m.id];
    assert.ok(a, `${m.id}: anchor`);
    assert.deepEqual([MAP_NODES[m.id].x, MAP_NODES[m.id].y], a.wide, m.id);
    assert.deepEqual([STRIP_NODES[m.id].x, STRIP_NODES[m.id].y], a.strip, m.id);
    assert.ok(["a", "b", "r"].includes(a.label), `${m.id}: label side`);
    // Same horizontal place on both paintings (README: "the same horizontal mission positions").
    assert.equal(a.wide[0], a.strip[0], m.id);
  }
  // README spot checks: #1, #8 and #17.
  assert.deepEqual(MAP_ANCHORS["m01-first-light"].wide, [12, 82.5]);
  // Campaign C6: Act 2 holds seven missions since Gun Hill, so its relays sit 13.3% apart (README had 15.6%).
  assert.deepEqual(MAP_ANCHORS["m06b-wings-over-copper"].strip, [63.3, 49.5]);
  // Act 3 holds seven missions since Crown Hill (m10b): 13.3% apart, m12 on the upper row.
  assert.deepEqual(MAP_ANCHORS["m12-frontiers-end"].strip, [90, 18]);
  assert.deepEqual(MAP_ART, { wide: { w: 2560, h: 1440 }, strip: { w: 2560, h: 900 } });
});

test("a future mission without an anchor falls back to mapLayout's place in its act band", () => {
  const extra = { id: "m99-test", act: 2 }, list = [...MISSIONS, extra];
  assert.deepEqual(mapNodes(list, "wide")[extra.id], mapLayout(list)[extra.id]);
  assert.deepEqual(mapNodes(list, "strip")[extra.id], mapLayout(list)[extra.id]);
});

test("relays keep 44 px between centres on the smallest boards each painting gets", () => {
  // Portrait phones: the wide painting full bleed, 318 px at the narrowest; landscape phones (844x390): a 522 px
  // board 194 px tall (390 - 196), the strip covering it (552 px wide, 15 px cropped each side).
  for (const [nodes, w, h, aw = w, ah = h] of [[MAP_NODES, 318, 178.9], [MAP_NODES, 388, 218.2], [STRIP_NODES, 522, 194, 194 * 2560 / 900, 194]]) {
    const pts = MISSIONS.map((m) => [nodes[m.id].x / 100 * aw - (aw - w) / 2, nodes[m.id].y / 100 * ah - (ah - h) / 2]);
    let closest = Infinity;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) closest = Math.min(closest, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
    assert.ok(closest >= 44, `${w}x${h}: ${closest.toFixed(1)} px`);
    // A 44 px pin stays inside the board.
    for (const [x, y] of pts) assert.ok(x >= 22 && x <= w - 22 && y >= 22 && y <= h - 22, `${w}x${h}: ${x},${y}`);
  }
});

test("the paintings are bundled assets, fetched only with the campaign map, and the CSS keeps the house rules", () => {
  assert.deepEqual(readdirSync(src("art/campaign")).sort(), ["campaign-map-strip.webp", "campaign-map-wide.webp"]);
  assert.equal(statSync(src("art/campaign/campaign-map-wide.webp")).size, 592264, "byte-identical to the owner's source");
  assert.equal(statSync(src("art/campaign/campaign-map-strip.webp")).size, 491376, "byte-identical to the owner's source");
  // Only the campaign map imports them (no preload on the title screen); one <picture> picks one painting.
  const users = ["app/shell.js", "app/cover.js", "main.js", "index.html", "cover.css", "ui-theme.css"].filter((p) => { try { return /campaign-map-(wide|strip)/.test(read(p)); } catch { return false; } });
  assert.deepEqual(users, []);
  const ui = read("campaign-map-ui.js");
  assert.match(ui, /<picture class="cmap-art"[^`]*<source media="\$\{STRIP_MEDIA\}"/);
  assert.match(ui, /export const STRIP_MEDIA = "\(orientation: landscape\) and \(max-height: 520px\)"/);
  const css = read("campaign-map.css");
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 520px\) \{\n {2}\.cmap-frame \{ --art: 2\.8444; \}/, "the strip layout uses the same media query as the <picture>");
  assert.doesNotMatch(css, /system-ui/);
  for (const [, px] of css.matchAll(/font(?:-size)?:[^;]*?(\d+)px/g)) assert.ok(Number(px) >= 11, `${px}px`);
  // The beacon is the only animation, and it stops when calm.
  assert.equal([...css.matchAll(/animation:\s*cmap-/g)].length, 1);
  assert.match(css, /:root\.motion-off \.cmap-node\.next::before \{ animation: none;/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.cmap-node\.next::before \{ animation: none;/);
  // The cover's nebula no longer backs the board (one painting request when Campaign opens).
  assert.doesNotMatch(read("cover.css"), /cmap-board[^}]*nebula/);
});
