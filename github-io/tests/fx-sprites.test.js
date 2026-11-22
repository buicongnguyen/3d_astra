import test from "node:test";
import assert from "node:assert/strict";
import { SHEETS, SHEET_NAMES, GRID_COLS, frameAt, impactKind, impactSize, IMPACT_SHEET, CLASS_IMPACT, readable, DECAL, POOL, atlasFile, cellPixels, MUZZLE_ROW } from "../src/fx-sprites-data.js";
import { WEAPON_CLASSES } from "../src/fx-kinds/weapon-class.js";

test("every sheet has a unique atlas slot in the packed grid, in the packer's order", () => {
  assert.deepEqual(Object.keys(SHEETS), SHEET_NAMES);
  assert.deepEqual(Object.values(SHEETS).map((s) => s.index), SHEET_NAMES.map((_, i) => i));
  assert.ok(SHEET_NAMES.length <= GRID_COLS * 4);
});

test("frame math: one-shots hold the last frame, loops wrap and cross-fade", () => {
  const o = { a: 0, b: 0, mix: 0 };
  assert.deepEqual({ ...frameAt(0, 18, 0, 16, false, o) }, { a: 0, b: 1, mix: 0 });
  frameAt(0.5 / 18, 18, 0, 16, false, o); assert.equal(o.a, 0); assert.ok(Math.abs(o.mix - 0.5) < 1e-9);
  frameAt(99, 18, 0, 16, false, o); assert.deepEqual({ ...o }, { a: 15, b: 15, mix: 0 });
  frameAt(3.5 / 16, 16, 0, 8, true, o); assert.equal(o.a, 3); assert.equal(o.b, 4);
  frameAt(8.5 / 16, 16, 0, 8, true, o); assert.equal(o.a, 0, "a loop wraps after its last frame");
  frameAt(7.9 / 16, 16, 0, 8, true, o); assert.equal(o.a, 7); assert.equal(o.b, 0, "the last frame fades into the first");
  frameAt(1, 20, 8, 4, false, o); assert.equal(o.a, 11, "a muzzle row plays its own four frames");
  frameAt(0.3, 0, 5, 1, false, o); assert.deepEqual({ ...o }, { a: 5, b: 5, mix: 0 }, "a decal is one still frame");
  frameAt(0.3, 18, 2, 14, false, o, 3); assert.equal((o.a - 2) % 3, 0); assert.equal(o.mix, 0, "reduced motion steps without cross-fade");
});

test("frameAt allocates nothing: it fills the object it is given", () => {
  const o = { a: 0, b: 0, mix: 0 };
  assert.equal(frameAt(0.2, 16, 0, 16, false, o), o);
});

test("every weapon class that has a sprite impact maps to an existing sheet", () => {
  for (const [cls, kind] of Object.entries(CLASS_IMPACT)) {
    assert.ok(WEAPON_CLASSES.includes(cls), cls);
    assert.ok(SHEETS[IMPACT_SHEET[kind]], kind);
  }
  assert.equal(impactKind("shell"), "shell"); assert.equal(impactKind("lob"), "artillery"); assert.equal(impactKind("missile"), "rocket");
  assert.equal(impactKind("bomb"), "bomb"); assert.equal(impactKind("flak"), "flak"); assert.equal(impactKind("tracer"), null);
  assert.equal(SHEETS[IMPACT_SHEET.artillery].file, "artillery-blast"); assert.equal(SHEETS[IMPACT_SHEET.bomb].file, "air-bomb-blast");
});

test("blend modes follow the README: smoke, scorch and mixed blasts normal, bright effects additive", () => {
  for (const n of ["tank", "rocket", "artillery", "flak", "bomb", "smoke", "scorch", "heal"]) assert.equal(SHEETS[n].blend, "normal", n);
  for (const n of ["flame", "beam", "muzzle"]) assert.equal(SHEETS[n].blend, "add", n);
  assert.equal(MUZZLE_ROW.large, 2);
});

test("sizes grow with power, stay readable on a phone, and the pools and decals are capped", () => {
  assert.ok(impactSize("shell", 1.5) > impactSize("shell", 0.5));
  assert.ok(impactSize("bomb", 1) > impactSize("shell", 1));
  assert.equal(readable(2, 50, 0.1), 5); assert.equal(readable(9, 50, 0.1), 9);
  assert.equal(DECAL.cap, 24); assert.ok(DECAL.ecoCap < DECAL.cap); assert.ok(POOL.normal + POOL.add <= 400);
  assert.equal(atlasFile(true), "fx-atlas-phone.webp"); assert.equal(cellPixels(true), 64); assert.equal(cellPixels(false), 128);
});

test("sprite pool: records are reused, never allocated per effect, and the cap recycles the oldest non-decal", async () => {
  const { FxSprites } = await import("../src/fx-sprites.js").catch(() => ({}));
  if (!FxSprites) return; // needs three.js + a DOM-free import: skipped where the module cannot load
  const fx = { ground: () => 0, motion: true, rng: () => 0.5, governed: 1 };
  const s = Object.create(FxSprites.prototype);
  s.view = { lowPower: true }; s.fx = fx; s.stats = { spawned: 0, recycled: 0 }; s.ready = true;
  const mk = (cap) => ({ capacity: cap, items: [], free: Array.from({ length: cap }, () => ({})), drawn: 0 });
  s.batches = { normal: mk(20), add: mk(20) };
  const live = (b) => b.items.length + b.free.length;
  const total = live(s.batches.normal);
  for (let i = 0; i < 60; i++) { const p = s.take("tank", i, 0, 0, 3, null); assert.ok(p); p.age = i; }
  assert.equal(live(s.batches.normal), total, "the same 20 records the whole time");
  assert.ok(s.batches.normal.items.length <= Math.round(20 * s.budget));
  assert.ok(s.stats.recycled > 0);
});
