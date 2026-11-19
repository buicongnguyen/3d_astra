// Golden pins (K1): the switches and the assert the three tests/golden-*.test.js files share.
//   GOLDEN_FULL=1    also runs the long pins (300 s points, save and reload, Three Roads, Endless to
//                    wave 12): `npm run test:golden-full`, CI matrix entry `golden-full`. `npm test`
//                    runs only the fast ones.
//   GOLDEN_RECORD=1  prints every pin's value ("GOLDEN <name> <json>") instead of asserting it, to
//                    copy into the file. Only the integrator re-records a pin, with a named reason.
import assert from "node:assert/strict";

const on = (name) => !!process.env[name] && process.env[name] !== "0";
export const FULL = on("GOLDEN_FULL");
export const RECORD = on("GOLDEN_RECORD");

// Test options for a long pin: skipped in `npm test`, run by `npm run test:golden-full`.
export const LONG = FULL ? {} : { skip: "long pin: npm run test:golden-full" };

// Asserts a pinned value, or prints it under GOLDEN_RECORD.
export function pin(name, actual, expected) {
  if (RECORD) {
    console.log(`GOLDEN ${name} ${JSON.stringify(actual)}`);
    return;
  }
  assert.deepEqual(actual, expected, `golden pin "${name}" moved: play changed. Only the integrator re-records a pin, with a named reason (docs/TESTING.md, "Golden pins and baselines").`);
}
