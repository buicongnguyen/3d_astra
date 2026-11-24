// Defence pads (2026-11-24, owner: "if the pad is a little far from the road, our unit's range reaches only a
// small part of the road"): every pad's crew covers a real stretch of road, short-reach crews gain more reach
// per tier, and the interface offers the build spots plainly (the "Crew a pad" action, the Defence rule on the
// title card). Road coverage is measured by tools/defence-coverage.mjs as the rules aim (sim/combat.js).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { measureAll } from "../tools/defence-coverage.mjs";
import GARRISONS from "../src/defence/garrisons.json" with { type: "json" };
import { titleCardFor, DEFENCE_RULE } from "../src/story/mission-intros.js";
import { HOLD_THE_RIVER } from "../src/story/defence-missions.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";

// Road metres every pad must reach at tier 1 and tier 3, per crew. Before this change a Ranger or Breaker
// crew on Gorge Road's d2 reached no road at all. The Scorcher flame trap is a trap for pads at the road's
// edge (7 m at tier 1) and is not held to it.
const FLOOR = { ranger: [10, 14], tank: [10, 14], antitank: [10, 14], watcher: [10, 14], breaker: [5, 12] };

test("every pad's crew reaches a real stretch of road, on every Defence level and mission", () => {
  for (const level of measureAll()) {
    for (const pad of level.pads) {
      for (const [crew, [t1, t3]] of Object.entries(FLOOR)) {
        if (!pad.crews[crew]) continue;
        const [one, , three] = pad.crews[crew];
        assert.ok(one.metres >= t1, `${level.id} ${pad.id} ${crew}: ${one.metres} m of road at tier 1 (< ${t1})`);
        assert.ok(three.metres >= t3, `${level.id} ${pad.id} ${crew}: ${three.metres} m of road at tier 3 (< ${t3})`);
      }
    }
  }
});

test("short-reach crews gain more reach per tier than the long-reach ones", () => {
  const perTier = (crew) => GARRISONS.crews[crew].tier_range ?? GARRISONS.tiers.map((t) => t.range);
  for (const short of ["ranger", "tank", "breaker", "scorcher"]) {
    const gain = perTier(short);
    assert.equal(gain[0], 0, `${short}: tier 1 adds nothing`);
    for (const long of ["antitank", "watcher"]) assert.ok(gain[2] > perTier(long)[2], `${short} gains more by tier 3 than ${long}`);
  }
});

test("Hold the River and the campaign Defence missions say: no base, crew the pads", () => {
  assert.equal(titleCardFor(HOLD_THE_RIVER).rule, DEFENCE_RULE);
  assert.match(DEFENCE_RULE, /no base/);
  assert.ok(HOLD_THE_RIVER.briefing.intel[0].startsWith(DEFENCE_RULE));
  // The Defence mode's own levels are chosen from the Defence menu: their card stays as it was.
  assert.equal(titleCardFor(DEFENCE_LEVELS[0]).rule, "");
});

test("the empty Defence sheet offers Crew a pad, and phones get it as their own button", () => {
  const sheets = readFileSync(new URL("../src/app/defence/sheets.js", import.meta.url), "utf8");
  const pads = readFileSync(new URL("../src/app/defence/pads-view.js", import.meta.url), "utf8");
  assert.match(sheets, /data-defence-act="crew-pad"/);
  assert.match(sheets, /defence-crew-fab/);
  assert.match(pads, /function bestPad/);
  // The build-spot marker: one instanced mesh, pulsing only until the first crew and never under reduced motion.
  assert.match(pads, /defence-pad-marks/);
  assert.match(pads, /const pulse = !pads\.crewed && !motionOff\(\)/);
});
