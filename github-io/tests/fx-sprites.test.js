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
  assert.equal(IMPACT_SHEET.artillery, "artillery"); assert.equal(IMPACT_SHEET.firebomb, "bomb"); assert.equal(IMPACT_SHEET.missile, "missile");
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
    assert.equal(streak.a,.75); assert.equal(records.length,2,"one moving round and one muzzle cue");
    assert.equal(streak.vx*streak.life,12);
    spriteHead(fx,'shell',0,0,0,1,0,0,1.5);
    assert.equal(records.at(-1).size,Math.max(1.5,22*unitsPerPixel)/4);
    assert.equal(records.at(-1).a,.75);
  }

});


test('F7 restores each blast palette at quarter live size and preserves F6 timing',async () => {
  const {spriteImpact,spriteMuzzle} = await import('../src/fx-kinds/sprite-fx.js');
  const {mulberry32}=await import('../src/rng.js');
  function run(seed){
    const seen=[];
    const fx={motion:true,allowFlash:()=>true,rng:mulberry32(seed),view:{unitsPerPixel:.1},sprites:{ready:true,take(name,x,y,z,size){
      const p={name,x,y,z,size,count:16,fps:SHEETS[name].fps,a:1};
      seen.push(p);return p;
    }}};
    for (const [kind, floor] of [['shell',54],['rocket',54],['artillery',72],['bomb',80]]) {
      spriteImpact(fx,kind,{x:1,y:.95,z:0},1,{targetWidth:2});
      assert.equal(seen.at(-1).name, IMPACT_SHEET[kind]);
      assert.equal(seen.at(-1).size, Math.min(4, readable(impactSize(kind,1),floor,.1)*1.5/4));
    }
    spriteMuzzle(fx,{x:0,y:1,z:0},1,0,0,'medium',null);
    const muzzle=seen.pop();assert.equal(muzzle.life,.05);
    for(const p of seen) {
      assert.equal(p.y,.95);assert.ok(p.size<=4);assert.equal(SHEETS[p.name].blend,'normal');
      assert.ok(p.splash && p.hotCore && p.fps>=50 && p.life<=.3);
      assert.ok(Math.abs(p.rot)<=.41);
    }
    return seen.map(({name,rot,size})=>[name,rot,size]);
  }
  const sample=run(1482);assert.deepEqual(sample,run(1482));
  assert.notDeepEqual(sample,run(1483));assert.equal(new Set(sample.map(p=>p[0])).size,4);
});

test("painted support and direct missile contact stay within the unit silhouette budget", async () => {
  const { spriteSupport, spriteImpact } = await import("../src/fx-kinds/sprite-fx.js");
  const { Effects } = await import("../src/fx.js");
  const records = [];
  const fx = {
    motion: true, allowFlash: () => true, view: { unitsPerPixel: 0.12 },
    sprites: { ready: true, take(name, x, y, z, size) {
      const record = { name, size };
      records.push(record);
      return record;
    } }
  };
  const from = { x: 0, y: 1, z: 0 }, to = { x: 8, y: 1, z: 0 };
  const anchor = { targetWidth: 1.4, direct: true };
  for (const repair of [false, true]) {
    records.length = 0;
    assert.ok(spriteSupport(fx, from, to, { x: 8, y: 0, z: 0 }, 8, anchor, [1,1,1], repair));
    assert.deepEqual(records.map(p => p.name), repair ? ["beamCyan"] : ["healBeam", "heal"]);
    assert.equal(records[0].sx, 8);
    assert.ok(records[0].sy <= 0.16);
    if (!repair) assert.ok(records[1].size <= anchor.targetWidth);
  }
  assert.ok(spriteImpact(fx, "missile", to, 1, anchor));
  const hit = records.at(-1);
  assert.equal(hit.name, "missile");
  assert.ok(hit.priorityHit && !hit.splash);
  assert.equal(hit.life, 0.05);
  assert.ok(hit.size <= 0.5 * anchor.targetWidth);
  assert.equal(Effects.prototype.dustColor.call(fx, 1, 0, 0)[3], 0.35);
});

test("a specialised tracer keeps its weapon colour and at least 1.5 px of painted width on a phone", async () => {
  const { spriteTracer } = await import("../src/fx-kinds/sprite-fx.js");
  const unitsPerPixel = 0.0634, records = [];
  const fx = { motion: true, allowFlash: () => true, view: { unitsPerPixel }, sprites: { ready: true, take(sheet, x, y, z, size) { const p = { sheet, size, a: 1, r: 1, g: 1, b: 1 }; records.push(p); return p; } } };
  spriteTracer(fx, { x: 0, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }, 1, 0, 0, 0.2, null, false, 0, { length: 2, width: 0.08, color: [0.1, 0.9, 0.2, 1] });
  const [p] = records;
  assert.ok(p.sy * p.size * 0.15 >= 1.5 * unitsPerPixel - 1e-9, "painted width");
  assert.ok(p.g > p.r && p.g > p.b, "weapon colour");
  assert.ok(p.a >= 0.7, "readable core");
});
