import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  normalize,
  loadSettings,
  saveSettings,
  STORAGE_KEY,
} from "../src/settings.js";
import { Terrain, CROSSINGS } from "../src/terrain.js";
import { Navigation } from "../src/navigation.js";
import { Simulation } from "../src/simulation.js";
const advance = (sim, seconds) => {
  for (let i = 0; i < seconds * 20; i++) {
    sim.tick(0.05);
    sim.events = [];
  }
};
test("settings validate types, palette conflicts, version and bounds", () => {
  assert.equal(defaults(true).quality, "eco");
  assert.equal(defaults(false).quality, "high");
  assert.deepEqual(normalize({ version: 99 }), defaults());
  const s = normalize({
    version: 1,
    playerColor: "coral",
    enemyColor: "coral",
    masterVolume: 5,
    quality: "bad",
    ambient: "true",
  });
  assert.equal(s.enemyColor, "mint");
  assert.equal(s.masterVolume, 1);
  assert.equal(s.quality, "high");
  assert.equal(s.ambient, true);
  assert.equal(
    normalize({ version: 1, playerColor: "__proto__" }).playerColor,
    "mint",
  );
});
test("settings safely roundtrip and recover from corrupt or blocked storage", () => {
  const memory = new Map(),
    storage = {
      getItem: (k) => memory.get(k),
      setItem: (k, v) => memory.set(k, v),
    };
  const s = { ...defaults(), playerColor: "gold" };
  assert.equal(saveSettings(s, storage), true);
  assert.deepEqual(loadSettings(false, storage), s);
  memory.set(STORAGE_KEY, "{broken");
  assert.deepEqual(loadSettings(true, storage), defaults(true));
  const denied = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  assert.equal(saveSettings(s, denied), false);
  assert.deepEqual(loadSettings(false, denied), defaults());
});
test("river footprint and swept checks block water but permit every crossing", () => {
  const t = new Terrain("riverlands");
  assert.equal(t.canStand(12, 0), false);
  assert.equal(t.canTraverse({ x: 12, z: 8 }, { x: 12, z: -8 }), false);
  assert.equal(
    t.canStand(4.8, 0, 0.55),
    false,
    "center alone does not grant ford clearance",
  );
  for (const c of CROSSINGS)
    assert.equal(
      t.canTraverse({ x: c.x, z: 8 }, { x: c.x, z: -8 }, 0.95),
      true,
    );
  assert.ok(t.placement(22, 0, 2));
  assert.ok(t.placement(22, 8, 2));
  assert.equal(t.placement(22, 14, 2), "");
});
test("navigation retains river restrictions on rebuild and bullets may cross water", () => {
  const nav = new Navigation(new Terrain("riverlands"));
  nav.rebuild([]);
  assert.equal(nav.clearLine({ x: 12, z: -3 }, { x: 12, z: 3 }), true);
  assert.equal(nav.canTraverse({ x: 12, z: -4 }, { x: 12, z: 4 }), false);
  nav.rebuild([{ kind: "building", hp: 100, x: 40, z: 30, radius: 2 }]);
  assert.equal(nav.canStand(12, 0), false);
  const path = nav.path({ x: 12, z: 14 }, { x: 12, z: -14 });
  assert.ok(path.length);
  let p = { x: 12, z: 14 };
  for (const n of path) {
    assert.ok(nav.canTraverse(p, n, 0.5));
    p = n;
  }
});
test("Riverlands workers deliver resources and armies reach the opposite bank", () => {
  const s = new Simulation({ ai: false, map: "riverlands" }),
    w = s.own(0).find((e) => e.type === "worker");
  s.issue([w.id], { type: "gather", target: s.resources[0].id });
  advance(s, 35);
  assert.ok(s.players[0].alloy > 450);
  const units = s.own(0).filter((e) => e.type === "ranger");
  s.issue(
    units.map((e) => e.id),
    { type: "move", x: -20, z: -17 },
  );
  for (let i = 0; i < 800; i++) {
    s.tick(0.05);
    for (const u of units) assert.ok(s.terrain.canStand(u.x, u.z, 0.45));
  }
  assert.ok(
    units.every((u) => u.z < -12),
    "Army must actually cross",
  );
});
test("Riverlands AI wins through normal economy, navigation and combat", () => {
  const s = new Simulation({ map: "riverlands" });
  advance(s, 350);
  assert.equal(s.result, "defeat");
});
test("Breakers use their full footprint while crossing, including local separation", () => {
  const s = new Simulation({ ai: false, map: "riverlands" }),
    units = [];
  for (let i = 0; i < 5; i++)
    units.push(s.spawn("breaker", 0, -22 + i * 0.3, 10 + i * 2));
  s.issue(
    units.map((e) => e.id),
    { type: "move", x: -22, z: -16 },
  );
  for (let i = 0; i < 1000; i++) {
    s.tick(0.05);
    for (const e of units) assert.ok(s.terrain.canStand(e.x, e.z, e.radius));
  }
  assert.ok(units.every((e) => e.z < -10));
});
test("trained Riverlands army defeats the defending outpost normally", () => {
  const s = new Simulation({ ai: false, map: "riverlands" }),
    b = s.own(0).find((e) => e.type === "barracks");
  for (let i = 0; i < 4; i++) assert.equal(s.enqueue(b.id, "ranger"), true);
  advance(s, 60);
  s.issue(
    s
      .own(0)
      .filter((e) => e.kind === "unit" && e.type !== "worker")
      .map((e) => e.id),
    { type: "attackmove", x: 25, z: -24 },
  );
  advance(s, 240);
  assert.equal(s.result, "victory");
});
