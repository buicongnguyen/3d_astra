// South exits (AAA round 3, R3-L; owner decision 2026-11-21): a trained unit leaves its building on the side
// facing the default camera ("south", +z: view.js CAMERA_OFFSET has a positive z), and falls back in a fixed
// order when that side is blocked: south-east / south-west, east / west, and north last.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { EXIT_ORDER } from "../src/sim/economy.js";

const camera = readFileSync(new URL("../src/view.js", import.meta.url), "utf8").match(/CAMERA_OFFSET = new THREE\.Vector3\(([^)]*)\)/)[1].split(",").map(Number);

// A Barracks of team 0 on open ground east of the core, with nothing around it.
function barracksSim() {
  const s = new Simulation({ ai: false });
  const hq = s.own(0).find((e) => e.type === "hq");
  const site = s.findPlacement("barracks", 0, hq.x + 14, hq.z);
  assert.ok(site, "a Barracks site");
  const b = s.spawn("barracks", 0, site.x, site.z);
  b.complete = true;
  s.nav.rebuild(s.entities);
  return { s, b };
}
const side = (b, p) => Math.atan2(p.x - b.x, p.z - b.z); // 0 = south (+z), +pi/2 = east, pi = north

test("the exit order starts south, then south-east before south-west, and ends north", () => {
  assert.ok(camera[2] > 0 && camera[0] > 0, "the default camera looks from +z (and +x): south is +z");
  assert.equal(EXIT_ORDER.length, 32);
  assert.deepEqual([EXIT_ORDER[0].x, EXIT_ORDER[0].z], [0, 1]);
  assert.ok(EXIT_ORDER[1].x > 0 && EXIT_ORDER[2].x < 0 && EXIT_ORDER[1].z === EXIT_ORDER[2].z, "SSE then SSW");
  assert.ok(Math.abs(EXIT_ORDER[31].z + 1) < 1e-12, "north last");
  for (let i = 1; i < 32; i++) assert.ok(EXIT_ORDER[i].z <= EXIT_ORDER[i - 1].z + 1e-12, "never closer to south than the one before");
  const east = EXIT_ORDER.findIndex((d) => Math.abs(d.z) < 1e-9 && d.x > 0), west = EXIT_ORDER.findIndex((d) => Math.abs(d.z) < 1e-9 && d.x < 0);
  assert.ok(east > 0 && west === east + 1, "east, then west");
});

test("a unit trained at a Barracks with the south free appears on the south side", () => {
  const { s, b } = barracksSim();
  const exit = s.exitPoint(b, D.vanguard);
  assert.ok(exit);
  assert.ok(Math.abs(side(b, exit)) < 1e-9 && exit.z > b.z, `due south, got ${JSON.stringify(exit)}`);
  // Through real production: queue a Vanguard and run until it is out.
  s.players[0].alloy = s.players[0].energy = 2000;
  const before = new Set(s.entities.map((e) => e.id));
  b.queue.push({ type: "vanguard", elapsed: D.vanguard.time });
  s.updateProduction(b, 0.05);
  const u = s.entities.find((e) => !before.has(e.id) && e.type === "vanguard");
  assert.ok(u, "the Vanguard is out");
  assert.ok(u.z > b.z + b.radius && Math.abs(u.x - b.x) < 0.5, "on the side facing the camera");
});

test("with the south blocked, the unit uses the next fallback (south-east, then south-west)", () => {
  const { s, b } = barracksSim();
  const first = s.exitPoint(b, D.vanguard);
  s.spawn("vanguard", 0, first.x, first.z); // a unit standing on the south exit
  const second = s.exitPoint(b, D.vanguard);
  assert.ok(side(b, second) > 0 && side(b, second) < Math.PI / 4 + 1e-9, `south-east next, got ${side(b, second)}`);
  s.spawn("vanguard", 0, second.x, second.z);
  const third = s.exitPoint(b, D.vanguard);
  assert.ok(side(b, third) < 0 && side(b, third) > -Math.PI / 4 - 1e-9, `then south-west, got ${side(b, third)}`);
});

test("a wall across the whole south side sends the unit east or west, never north first", () => {
  const { s, b } = barracksSim();
  for (let x = -12; x <= 12; x += 2.5) for (let z = 1; z <= 18; z += 2.5) s.spawnWall(b.x + x, b.z + b.radius + z, 1.4);
  s.nav.rebuild(s.entities);
  const exit = s.exitPoint(b, D.vanguard);
  assert.ok(exit, "still released");
  assert.ok(exit.z <= b.z + b.radius + 0.5, "not through the wall");
  const a = Math.abs(side(b, exit));
  assert.ok(a >= Math.PI / 4 && a <= Math.PI / 2 + 0.35, `east or west, got ${a}`);
});

test("the exit is deterministic: the same state gives the same spot", () => {
  const one = barracksSim(), two = barracksSim();
  assert.deepEqual(one.s.exitPoint(one.b, D.tank ?? D.vanguard), two.s.exitPoint(two.b, D.tank ?? D.vanguard));
});
