import test from "node:test";
import assert from "node:assert/strict";

const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
globalThis.document = { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };

test("fx layer caps follow quality switches", async () => {
  const { Effects } = await import("../src/fx.js");
  const view = { lowPower: true, scene: { add() {} }, terrain: { id: "x" }, activity: { combat: { motion: true } } };
  const fx = new Effects(view);
  const fill = (layer) => { for (let i = 0; i < 2000; i++) fx.particle(layer, { life: 5 }); return layer.items.length; };
  assert.equal(fill(fx.smoke), 210);
  assert.equal(fill(fx.glow), 450);
  assert.equal(fx.debrisCapacity, 32); // battle effects pass 2026-11: more chunks per hit
  view.lowPower = false;
  assert.equal(fill(fx.smoke), 420);
  assert.equal(fill(fx.glow), 900);
  assert.equal(fx.debrisCapacity, 96);
  assert.ok(fx.debrisMesh.instanceMatrix.count >= 96, "the debris batch holds the High cap");
});
