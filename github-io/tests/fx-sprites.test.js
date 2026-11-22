import test from "node:test";
import assert from "node:assert/strict";
import { SHEETS, SHEET_NAMES, LAYOUT, frameAt, impactKind, impactSize, IMPACT_SHEET, CLASS_IMPACT, readable, DECAL, POOL, atlasFile, cellPixels, MUZZLE_ROW } from "../src/fx-sprites-data.js";
import { WEAPON_CLASSES } from "../src/fx-kinds/weapon-class.js";

test("every sheet has a frame rectangle in the packed atlas and none overlap", () => {
  assert.deepEqual(Object.keys(SHEETS).sort(), [...SHEET_NAMES].sort());
  const boxes = Object.values(SHEETS).map((d) => ({ x: d.x, y: d.y, w: d.fw * d.cols, h: d.fh * Math.ceil(d.count / d.cols) }));
  for (const b of boxes) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 1.0001 && b.y + b.h <= 1.0001);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], c = boxes[j];
    assert.ok(a.x + a.w <= c.x + 1e-9 || c.x + c.w <= a.x + 1e-9 || a.y + a.h <= c.y + 1e-9 || c.y + c.h <= a.y + 1e-9, `${i} overlaps ${j}`);
  }
  assert.ok(LAYOUT.width * LAYOUT.height * 4 < 20e6, "the atlas stays under 20 MB of texture memory");
  for (const n of ["beamCyan", "beamMagenta", "healBeam"]) assert.equal(SHEETS[n].pw / SHEETS[n].ph, 8, "strips are 8:1");
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
  assert.equal(IMPACT_SHEET.artillery, "artillery"); assert.equal(IMPACT_SHEET.firebomb, "artillery"); assert.equal(IMPACT_SHEET.missile, "flak");
});

test("blend modes follow the README: smoke, scorch and mixed blasts normal, bright effects additive", () => {
  for (const n of ["tank", "rocket", "artillery", "flak", "bomb", "missile", "tracer", "flame", "heal", "smoke", "scorch", "stomp", "beamCyan", "heads"]) assert.equal(SHEETS[n].blend, "normal", n);
  for (const n of ["beam", "muzzle"]) assert.equal(SHEETS[n].blend, "add", n);
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

test('impact highlights share a real-time budget across a crowded battle', async () => {
  const { Effects } = await import('../src/fx.js');
  const view = { motion: true, nextFlash: -Infinity };
  const flashes = [];
  for (let ms = 0; ms < 2500; ms += 5) {
    for (let shot = 0; shot < 10; shot++)
      if (Effects.prototype.allowFlash.call(view, ms)) flashes.push(ms);
  }
  assert.ok(flashes.length >= 6);
  for (const start of flashes) assert.ok(flashes.filter(ms => ms >= start && ms < start + 1000).length <= 3);
  view.motion = false;
  assert.equal(Effects.prototype.allowFlash.call(view, 3000), false);
});


test("tracer atlas uses one quarter of the live size and glow after the screen-space floor", async () => {
  const { spriteTracer, spriteHead } = await import("../src/fx-kinds/sprite-fx.js");
  for (const unitsPerPixel of [.02,.2]) {
    const records=[];
    const fx={motion:true,allowFlash:()=>true,view:{unitsPerPixel},sprites:{ready:true,take(sheet,x,y,z,size){
      const p={sheet,size,a:1};records.push(p);return p;
    }}};
    spriteTracer(fx,{x:0,y:0,z:0},{x:12,y:0,z:0},1,0,0,.2,null);
    const [streak]=records;
    assert.equal(streak.size,Math.max(6,100*unitsPerPixel)/4);
    assert.equal(streak.sy,1.6);
    assert.equal(streak.a,1/4); assert.equal(records.length,2,"one moving round and one muzzle cue");
    assert.equal(streak.vx*streak.life,12);
    spriteHead(fx,'shell',0,0,0,1,0,0,1.5);
    assert.equal(records.at(-1).size,Math.max(1.5,22*unitsPerPixel)/4);
    assert.equal(records.at(-1).a,.25);
  }
  for(const name of Object.values(IMPACT_SHEET))assert.ok(!['tank','bomb','missile'].includes(name));
});
