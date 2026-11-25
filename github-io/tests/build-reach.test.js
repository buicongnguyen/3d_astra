// W14 (2026-11-25): on a plateau without ramps the build ghost showed green, then the order was refused with
// "The Harvester cannot reach that site." src/build-reach.js runs the sim's own reach check for the ghost.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { buildSiteError, reachingBuilder, REACH_ERROR } from "../src/build-reach.js";

function heartland() {
  const s = new Simulation({ ai: false, map: "heartland" });
  s.visible[0].fill(1); s.explored[0].fill(1);
  s.players[0].alloy = s.players[0].energy = 9999;
  return s;
}

test("a site on a ramp-less plateau: placement allows it, the ghost check refuses it with the sim's reason", () => {
  const s = heartland(), worker = s.own(0).find((e) => e.type === "worker");
  const top = s.terrain.plateaus.find((p) => s.findPlacement("tower", 0, p.x, p.z) && !(p.ramps || []).length);
  const at = s.findPlacement("tower", 0, top.x, top.z);
  assert.equal(s.placement("tower", 0, at.x, at.z), "", "placement alone says yes (the old green ghost)");
  assert.equal(buildSiteError(s, "tower", at.x, at.z, [worker]), REACH_ERROR);
  assert.equal(reachingBuilder(s, "tower", at.x, at.z, [worker]), null);
  // The sim refuses the same site with the same text.
  const before = s.events.length;
  assert.equal(s.build(worker.id, "tower", at.x, at.z), null);
  assert.ok(s.events.slice(before).some((e) => e.type === "message" && e.text === REACH_ERROR));
});

test("open ground near the base is fine; placement errors still win; no Harvester selected means no reach reason", () => {
  const s = heartland(), worker = s.own(0).find((e) => e.type === "worker"), hq = s.own(0).find((e) => e.type === "hq");
  const at = s.findPlacement("barracks", 0, hq.x + (hq.x > 0 ? -12 : 12), hq.z);
  assert.ok(at);
  assert.equal(buildSiteError(s, "barracks", at.x, at.z, [worker]), "");
  assert.equal(reachingBuilder(s, "barracks", at.x, at.z, [worker]), worker);
  assert.equal(buildSiteError(s, "barracks", hq.x, hq.z, [worker]), s.placement("barracks", 0, hq.x, hq.z));
  assert.ok(buildSiteError(s, "barracks", hq.x, hq.z, [worker]));
  const top = s.terrain.plateaus[0], site = s.findPlacement("tower", 0, top.x, top.z);
  assert.equal(buildSiteError(s, "tower", site.x, site.z, []), "", "the card asks for a Harvester instead");
});

test("the answer is cached per cell and navigation revision, and checking changes no game state", () => {
  const s = heartland(), worker = s.own(0).find((e) => e.type === "worker"), hash = s.hash();
  const top = s.terrain.plateaus[0], at = s.findPlacement("tower", 0, top.x, top.z);
  let searches = 0;
  const path = s.nav.path.bind(s.nav);
  s.nav.path = (...a) => (searches++, path(...a));
  for (let i = 0; i < 20; i++) buildSiteError(s, "tower", at.x + (i % 3) * 0.1, at.z, [worker]);
  assert.equal(searches, 1, "one route search for one cell");
  assert.equal(s.hash(), hash, "the check changes no game state");
  s.nav.rebuild(s.entities);
  buildSiteError(s, "tower", at.x, at.z, [worker]);
  assert.equal(searches, 2, "a nav rebuild asks again");
});

test("with two Harvesters selected, one that can reach is picked", () => {
  const s = heartland(), [a, b] = s.own(0).filter((e) => e.type === "worker");
  const top = s.terrain.plateaus[0], at = s.findPlacement("tower", 0, top.x, top.z);
  // Put the second Harvester on the plateau top: it can build there, the first cannot.
  b.x = top.x; b.z = top.z;
  assert.equal(reachingBuilder(s, "tower", at.x, at.z, [a, b]), b);
  assert.equal(buildSiteError(s, "tower", at.x, at.z, [a, b]), "");
});
