// Documentation claims that the game itself can prove. Numbers are taken from a running match and the
// sentence is built from them, so a rebalanced relay fails here instead of leaving the README stale (K11).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Simulation } from "../src/simulation.js";

const doc = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readme = doc("README.md");

test("README states the relay supply by level and the core supply as the simulation counts them", () => {
  const s = new Simulation({ ai: false });
  const base = s.population(0).cap, hq = s.own(0).find((e) => e.type === "hq");
  assert.ok(hq?.supply > 0, "the start base has a Command core");
  const relay = s.spawn("relay", 0, 0, 20, true), cap = [];
  for (let level = 1; level <= 3; level++) {
    cap.push(s.population(0).cap - base);
    relay.levelJob = { elapsed: 0, time: 1, cost: [0, 0] };
    s.updateLevel(relay, 2);
  }
  assert.equal(readme.includes(`relay adds ${cap[0]} population capacity (${cap[1]} at L2, ${cap[2]} at L3)`), true, `README says relay ${cap.join("/")}`);
  assert.ok(readme.includes(`Command core adds ${hq.supply}`), `README says the core adds ${hq.supply}`);
});

test("README pan row covers every screen edge", () => {
  assert.doesNotMatch(readme, /left\/right\/top screen edges/);
  assert.match(readme, /any screen edge \(including over the console\)/);
});

test("EXPANSION_STAGES sends players to New game / choose map for a new match setup, not to a page reload", () => {
  const t = doc("docs/EXPANSION_STAGES.md");
  assert.ok(!/reload the page to return/.test(t));
  assert.match(t, /New game \/ choose map/);
  assert.match(t, /united, see CAMPAIGN_AND_AI\.md/);
});
