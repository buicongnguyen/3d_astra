// Golden pin of the Iron Sovereign (W1-E): a field sandbox and a route sandbox, hashes at 30 and 90 s.
// Re-recorded only by the integrator, with a named reason (GOLDEN_RECORD=1 prints the values).
import test from "node:test";
import { pin } from "./lib/golden.mjs";
import { fieldFight, routeFight } from "./lib/sovereign.mjs";

const hashes = (s) => {
  const out = [];
  for (const t of [30, 90]) { while (s.time < t - 1e-9) { s.tick(0.05); s.events.length = 0; } out.push(s.hash()); }
  return out;
};
test("golden: field sandbox, 6 Rangers and 2 Breakers against the Sovereign", () => {
  pin("w1e-field", hashes(fieldFight(6, 2).s), PIN.field);
});
test("golden: route sandbox, the Sovereign on d-crossroads against 10 towers", () => {
  pin("w1e-route", hashes(routeFight().s), PIN.route);
});
// Re-recorded 2026-11-24 (defence pads): short-reach crews reach further and gain more per tier (garrisons.json tier_range: Rangers and Tank post 14/15.5/17.5 m, Mortar 12/13.5/15.5, Flame trap 7/8.5/10) and far pads moved nearer the road (Gorge d1 d2 d4 g10, Bridges s8, Canyon d1 d2); docs/CHANGELOG.md "Defence pads".
const PIN = { field: ["bfb067cb", "14a73a77"], route: ["2e11d31b", "18716a56"] };
