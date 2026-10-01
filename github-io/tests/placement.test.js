import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";

// Building should be easy: a tap beside a blocked spot snaps to the nearest valid site, and the
// player's own units step out of a new footprint instead of refusing it.
const reveal = (s) => { s.isVisible = () => true; s.players[0].alloy = s.players[0].energy = 9999; };

test("findPlacement returns the tap itself when valid, else the nearest valid site", () => {
  const s = new Simulation({ map: "classic" }); reveal(s);
  const hq = s.own(0).find((e) => e.type === "hq");
  const free = s.findPlacement("relay", 0, hq.x + 14, hq.z);
  assert.ok(free);
  assert.equal(s.placement("relay", 0, free.x, free.z), "");
  // Tapping right against the core is blocked, but a site a few metres away is offered.
  const tap = { x: hq.x + hq.radius + 1, z: hq.z };
  assert.ok(s.placement("relay", 0, tap.x, tap.z));
  const snapped = s.findPlacement("relay", 0, tap.x, tap.z);
  assert.ok(snapped, "a nearby site is found");
  assert.equal(s.placement("relay", 0, snapped.x, snapped.z), "");
  assert.ok(Math.hypot(snapped.x - tap.x, snapped.z - tap.z) <= 6);
});

test("own units step aside for a new building; enemy units still block", () => {
  const s = new Simulation({ map: "classic" }); reveal(s);
  const [builder, bystander] = s.own(0).filter((e) => e.type === "worker");
  const site = s.findPlacement("relay", 0, builder.x + 8, builder.z + 8);
  Object.assign(bystander, { x: site.x + 0.2, z: site.z });
  assert.equal(s.placement("relay", 0, site.x, site.z), "", "own unit does not block");
  const b = s.build(builder.id, "relay", site.x, site.z);
  assert.ok(b, "construction starts");
  assert.ok(Math.hypot(bystander.x - b.x, bystander.z - b.z) >= b.radius + bystander.radius, "bystander moved out of the footprint");
  const enemy = s.spawn("vanguard", 1, site.x + 12, site.z);
  const site2 = s.findPlacement("relay", 0, enemy.x, enemy.z);
  assert.match(s.placement("relay", 0, enemy.x, enemy.z), /Units are standing/);
  assert.ok(Math.hypot(site2.x - enemy.x, site2.z - enemy.z) > 0, "an enemy-occupied tap snaps elsewhere");
});
