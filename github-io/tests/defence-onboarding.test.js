// Frontier Defence onboarding and readability (AAA round 3, R3-E), the parts that need no browser:
// the guided-first-build flag in the progress record, the guide's text, the view plugin's contract,
// the narrow landscape dock and the next-star text. The browser suite is tests/defence-onboarding.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadDefence, saveDefence, recordDefence, guideWanted, recordGuided, hasDefenceWin, DEFENCE_KEY } from "../src/defence/progress.js";
import { GUIDE_STEPS, CREW_LABEL } from "../src/app/defence/constants.js";
import { VIEW_PLUGINS } from "../src/view-plugins.js";
import { DefenceReadabilityView, CREWS } from "../src/defence-readability-view.js";
import GARRISONS from "../src/defence/garrisons.json" with { type: "json" };
import { translate } from "../src/i18n.js";

const memory = (raw = null) => { const m = new Map(raw === null ? [] : [[DEFENCE_KEY, raw]]); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test("a profile with no Defence win wants the guide; a win or a finished guide does not", () => {
  const fresh = loadDefence(memory());
  assert.equal(hasDefenceWin(fresh), false);
  assert.equal(guideWanted(fresh), true);
  assert.equal(guideWanted(recordGuided(fresh)), false);
  const won = recordDefence(fresh, "d-gorge", { stars: 1, lives: 3 });
  assert.equal(guideWanted(won), false, "a player with a Defence win skips the guide");
});

test("the guide flag is stored only once done, and older progress reads and saves exactly as before", () => {
  const store = memory(JSON.stringify({ levels: { "d-gorge": { stars: 2, lives: 12, difficulty: "standard" } } }));
  const p = loadDefence(store);
  assert.deepEqual(p, { levels: { "d-gorge": { stars: 2, lives: 12, difficulty: "standard" } } }, "no guided key until the guide is done");
  saveDefence(p, store);
  assert.equal(store.getItem(DEFENCE_KEY), JSON.stringify(p));
  const done = recordGuided(loadDefence(memory()));
  assert.deepEqual(done, { levels: {}, guided: true });
  assert.equal(recordGuided(done), done, "recording twice changes nothing");
  const back = memory(); saveDefence(done, back);
  assert.deepEqual(loadDefence(back), done, "the flag survives a save and load");
  assert.deepEqual(loadDefence(memory(JSON.stringify({ levels: {}, guided: "yes" }))), { levels: {} }, "anything but true is dropped");
});

test("the guide has three steps, each with a Vietnamese line", () => {
  assert.equal(GUIDE_STEPS.length, 3);
  for (const line of GUIDE_STEPS) assert.notEqual(translate(line, "vi"), line, line);
  for (const line of ["Hold all 10 waves.", "Finish with 18 lives or more (you kept 12).", "Wave 7 cost the most lives:"]) assert.notEqual(translate(line, "vi"), line, line);
  assert.match(translate("Finish with 18 lives or more (you kept 12).", "vi"), /18.*12/);
});

test("the Defence readability view is a registered plugin that does nothing outside Defence", () => {
  assert.equal(VIEW_PLUGINS.at(-1), DefenceReadabilityView, "appended at the end of the registry");
  const added = [], view = { scene: { add: (...m) => added.push(...m), remove() {} }, objects: new Map() };
  const plugin = new DefenceReadabilityView(view);
  plugin.update({ entities: [] });
  plugin.update({ defence: null, entities: [] });
  plugin.reset();
  assert.equal(added.length, 0, "no mesh is built for a match without sim.defence");
  assert.equal(plugin.discs, null);
  // Every crew a Defence level can field has a glyph and a short label.
  for (const crew of Object.keys(GARRISONS.crews)) { assert.ok(CREWS.includes(crew), `${crew} has a badge glyph`); assert.ok(CREW_LABEL[crew], crew); }
});

test("landscape Defence: the dock is at most 22% of an 844 px view and has a collapse rule", () => {
  const css = readFileSync(new URL("../src/landscape-hud.css", import.meta.url), "utf8"), block = css.slice(css.indexOf("Defence (AAA round 3, R3-E)"));
  const m = block.match(/\.compact-ui\.in-defence:not\(\.in-briefing\) \{ --side-width: min\((\d+)px, (\d+)vw\); \}/);
  assert.ok(m, "the Defence side width rule");
  assert.ok(Number(m[1]) / 844 <= 0.22 && Number(m[2]) <= 22, `${m[1]} px is ${(Number(m[1]) / 844 * 100).toFixed(1)}% of 844`);
  assert.match(block, /\.defence-dock-min[^{]*#dock-tabs \{ display: none; \}/, "collapsed: the tabs go");
  assert.doesNotMatch(css + readFileSync(new URL("../src/defence-ui.css", import.meta.url), "utf8"), /system-ui/);
});
