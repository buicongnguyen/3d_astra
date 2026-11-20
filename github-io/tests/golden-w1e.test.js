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
const PIN = { field: ["bfb067cb", "14a73a77"], route: ["536dae92", "7758a44d"] };
