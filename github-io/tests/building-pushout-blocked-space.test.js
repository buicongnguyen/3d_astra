import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";

test("units stepping aside for a new building never land in blocked space", () => {
  let tried = 0;
  for (let i = 0; i < 24; i++) {
    const s = new Simulation({ map: "classic", ai: false });
    s.isVisible = () => true; s.players[0].alloy = s.players[0].energy = 9999;
    const hq = s.own(0).find((e) => e.type === "hq");
    const builder = s.own(0).find((e) => e.type === "worker");
    const ang = (i / 24) * Math.PI * 2;
    const R = 1.5; // tower radius; scan from the minimum legal gap (0.8)
    let site = null;
    for (let gap = 0.81; gap < 1.4 && !site; gap += 0.02) {
      const d = hq.radius + R + gap;
      const x = hq.x + Math.cos(ang) * d, z = hq.z + Math.sin(ang) * d;
      if (!s.placement("tower", 0, x, z)) site = { x, z };
    }
    if (!site) continue;
    const u = s.spawn("ranger", 0, site.x - Math.cos(ang) * 0.5, site.z - Math.sin(ang) * 0.5);
    s.nav.rebuild(s.entities);
    if (!s.build(builder.id, "tower", site.x, site.z)) continue;
    tried++;
    assert.ok(s.nav.canStand(u.x, u.z, u.radius), `unit stands in free space (angle ${i})`);
  }
  assert.ok(tried > 0, "at least one scenario ran");
});
