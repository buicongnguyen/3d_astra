import test from "node:test";
import assert from "node:assert/strict";

const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
globalThis.document = { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };

test("fx layer caps follow quality switches", async () => {
  const { Effects } = await import("../src/fx.js");
  const view = { lowPower: true, scene: { add() {} }, terrain: { id: "x" }, activity: { combat: { motion: true } } };
  const fx = new Effects(view);
  const fill = (layer) => { for (let i = 0; i < 2000; i++) fx.particle(layer, { life: 5 }); return layer.items.length; };
  assert.equal(fill(fx.smoke), 252);
  assert.equal(fill(fx.glow), 540);
  assert.equal(fx.debrisCapacity, 32); // battle effects pass 2026-11: more chunks per hit
  view.lowPower = false;
  assert.equal(fill(fx.smoke), 420);
  assert.equal(fill(fx.glow), 900);
  assert.equal(fx.debrisCapacity, 96);
  assert.ok(fx.debrisMesh.instanceMatrix.count >= 96, "the debris batch holds the High cap");
});

test("nearby detail survives ahead of distant detail and one mark is reserved per selected target", async () => {
  const { Effects } = await import("../src/fx.js");
  const fx = new Effects({lowPower:true,scene:{add(){}},terrain:{id:"x"},activity:{combat:{motion:true}}});
  const selected = new Set([7, 8]);
  for (let i=0; i<30; i++) {
    fx.particle(fx.glow, {x:60,z:60,life:1,s0:.1,anchor:{target:7},priorityHit:true});
    fx.particle(fx.glow, {x:50,z:50,life:1,s0:.1,anchor:{target:8},priorityHit:true});
    fx.particle(fx.glow, {x:0,z:0,life:1,s0:1,anchor:{target:9}});
  }
  const visibleUnits = Array.from({length:10},()=>({kind:"unit",hp:1,x:0,z:0}));
  fx.trimParticles({entities:visibleUnits,isVisible:()=>true},selected);
  assert.equal(fx.glow.items.length,15);
  assert.deepEqual(new Set(fx.glow.items.filter(p=>p.priority===4).map(p=>p.anchor.target)),selected);
  assert.equal(fx.glow.items.filter(p=>p.anchor.target===9).length,13);
});
