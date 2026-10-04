import test from "node:test";
import assert from "node:assert/strict";

// Headless stub: fx.js builds a canvas atlas at construction time.
const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };

test("death and impact anchors carry the event team", async () => {
  const { Effects } = await import("../src/fx.js");
  const fx = Object.create(Effects.prototype);
  const anchors = [];
  fx.particle = (l, o) => { if (o && o.anchor) anchors.push(o.anchor); };
  fx.sparks = (at, n, anchor) => anchors.push(anchor);
  fx.explosion = (at, s, anchor) => anchors.push(anchor);
  fx.decal = (at, ...rest) => { for (const r of rest) if (r && typeof r === "object" && "x" in r) anchors.push(r); };
  fx.timeline = [];
  fx.debris = [];
  fx.time = 0;
  fx.view = { activity: { combat: { motion: true } } };
  try { fx.impact({ x: 1, z: 2, team: 0 }); } catch {}
  try { fx.death({ x: 1, z: 2, team: 0, building: true }); } catch {}
  assert.ok(anchors.length > 0);
  for (const a of anchors) assert.equal(a.team, 0);
});
