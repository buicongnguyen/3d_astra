// Skirmish rules reach the Simulation only when they are set (round 2 contract: createSim passes
// `...(S.rules ? { rules: S.rules } : {})`, the test hook window.__frontier.rules sets S.rules).
// createSim lives in src/main.js, which needs a DOM to import, so its own source runs here with a
// Simulation that records the options it is given.
import test from "node:test";
import assert from "node:assert/strict";
import { clientFile } from "./lib/client-source.js";
import { skirmishSides } from "../src/factions.js";
import { resolveMission } from "../src/story/choices.js";
import { MISSIONS } from "../src/story/missions.js";
import { setupDebugHooks } from "../src/app/debug-hooks.js";
import { rulesForMap } from "../src/app/rules-store.js";
import { rememberOptions, optionsOf } from "../src/meta/replay.js";

function createSimFrom(S) {
  const text = clientFile("main.js", { plain: false });
  const start = text.indexOf("const createSim = () => {"), end = text.indexOf("\n};", start);
  assert.ok(start >= 0 && end > start, "createSim is in src/main.js");
  class Recorder { constructor(options) { this.options = options; } }
  // Round 4: createSim passes the rules through rulesForMap (a map-limited rule, Wild frontier, stays off other maps).
  // W6: createSim remembers each match's options beside it, for its replay (src/meta/replay.js).
  return new Function("Simulation", "S", "skirmishSides", "resolveMission", "matchLook", "rulesForMap", "rememberOptions", `${text.slice(start, end + 3)}\nreturn createSim;`)(Recorder, S, skirmishSides, resolveMission, () => null, rulesForMap, rememberOptions);
}
const setup = (extra) => ({ mission: null, playMode: "skirmish", playerFaction: "sunward", enemyFaction: "veil", enemyCount: 1, mapId: "dunes", aiSpeed: "normal", alliance: "ffa", bonus: null, campaign: null, settings: { campaignDifficulty: "standard" }, ...extra });

test("createSim without S.rules passes no rules key; with them, passes them as they are", () => {
  const S = setup();
  const createSim = createSimFrom(S);
  const plain = createSim().options;
  assert.equal("rules" in plain, false);
  assert.deepEqual(plain.factions, { 0: "sunward", 1: "veil" });
  for (const none of [null, undefined]) { S.rules = none; assert.equal("rules" in createSim().options, false); }
  S.rules = { roster: "expanded" };
  const ruled = createSim().options;
  assert.deepEqual(ruled.rules, { roster: "expanded" });
  assert.deepEqual(Object.keys(ruled), [...Object.keys(plain), "rules"], "the other options are untouched");
  const kept = createSim();
  assert.deepEqual(optionsOf(kept), JSON.parse(JSON.stringify(kept.options)), "W6: the options are remembered as built, for the replay");
  // Round 4: the Wild frontier rule reaches an Amber Dunes match only.
  S.rules = { wild: "on" };
  assert.deepEqual(createSim().options.rules, { wild: "on" });
  S.mapId = "classic";
  assert.equal("rules" in createSim().options, false);
  // A campaign mission is built the same way: no rules key unless they are set.
  const story = setup({ mission: MISSIONS[0], playMode: "campaign" });
  assert.equal("rules" in createSimFrom(story)().options, false);
});

test("window.__frontier.rules reads and sets S.rules; a falsy value clears it", () => {
  const S = { screen: {} }, A = {};
  setupDebugHooks(S, A);
  const saved = globalThis.window;
  globalThis.window = {};
  try {
    A.installDebugHooks();
    const hook = window.__frontier;
    assert.equal(hook.rules, undefined);
    hook.rules = { roster: "expanded" };
    assert.deepEqual(S.rules, { roster: "expanded" });
    assert.equal(hook.rules, S.rules);
    hook.rules = undefined;
    assert.equal(S.rules, null);
    const S2 = setup(), createSim = createSimFrom(S2);
    S2.rules = S.rules;
    assert.equal("rules" in createSim().options, false, "a cleared hook builds a match without rules");
  } finally {
    globalThis.window = saved;
  }
});
