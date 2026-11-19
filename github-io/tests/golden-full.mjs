// `npm run test:golden-full`: every golden pin, the long ones too (GOLDEN_FULL=1: the 300 s points,
// the end of each AI match, save and reload, Three Roads, Endless to wave 12). CI runs it in its own
// browser-job matrix entry `golden-full` (30-minute cap), off the 10-minute build job; `npm test`
// runs only the fast pins. A script rather than `GOLDEN_FULL=1 node --test ...` so it runs the same
// from cmd, PowerShell and bash, and has the `node tests/<file>.mjs` form every matrix script has
// (tests/ci-matrix.test.js).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const started = Date.now();
const child = spawn(process.execPath, ["--test", "tests/golden-*.test.js"], { cwd: root, stdio: "inherit", env: { ...process.env, GOLDEN_FULL: "1" } });
child.on("exit", (code, signal) => {
  console.log(`${code === 0 ? "PASS" : "FAIL"} golden-full (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  process.exitCode = code ?? (signal ? 1 : 0);
});
