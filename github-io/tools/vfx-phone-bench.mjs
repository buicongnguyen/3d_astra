// Paired F5 phone fixtures. Run against a release preview with TEST_URL set.
// node tools/vfx-phone-bench.mjs <output.json> [repeats]
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const [output, repeatArg = "3"] = process.argv.slice(2);
const repeats = Number(repeatArg);
assert.ok(output && Number.isInteger(repeats) && repeats > 0 && process.env.TEST_URL);
const windows = process.platform === "win32";
const browser = await chromium.launch({
  executablePath: windows ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: windows ? ["--use-angle=d3d11", "--enable-gpu"] : ["--enable-unsafe-swiftshader"],
});
async function measure(units) {
  const page = await browser.newPage({
    viewport: {width: 390, height: 844}, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(process.env.TEST_URL + "?test=1");
    await page.waitForFunction(() => window.__frontier?.modelsReady && !document.querySelector("#start").disabled);
    await page.locator('[data-mode="skirmish"]').click();
    await page.locator("#start").click();
    await page.waitForFunction(() => window.__frontier?.started && window.__frontier.modelsReady);
    await page.evaluate(async units => {
      const f = window.__frontier, sim = f.sim, view = f.view;
      f.hold = true;
      sim.aiEnabled = false;
      const types = units === 12 ? ["ranger","tank","medic","engineer","breaker","vanguard"] :
        ["ranger","tank","vanguard","breaker","antitank"];
      await view.preloadModels(types);
      view.fx.sprites.start();
      if (!await view.fx.sprites.whenReady()) throw Error("Effect sprites unavailable");
      view.setQuality("low");
      let selected;
      for (let i = 0; i < units; i++) {
        const team = i % 2, row = Math.floor(i / 2), cols = units === 12 ? 3 : 15;
        const x = (row % cols - (cols - 1) / 2) * 1.7;
        const z = (team ? -1 : 1) * (3 + Math.floor(row / cols) * 1.35);
        const unit = sim.spawn(types[row % types.length], team, x, z);
        unit.hp *= 0.8;
        if (i === 0) selected = unit.id;
        sim.issue([unit.id], {type:"attackmove", x, z:-z});
      }
      sim.visible[0].fill(1); sim.explored[0].fill(1);
      f.select([selected]);
      view.focusOn(0,0); view.zoom = units === 12 ? 29 : 42; view.updateCamera();
      view.update(sim, 0, f.selected, null);
    }, units);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", {rate: 4});
    const result = await page.evaluate(async () => {
      const f = window.__frontier, view = f.view, sim = f.sim;
      const samples = [];
      await new Promise(resolve => setTimeout(resolve, 400));
      const start = sim.time;
      let previous = null;
      f.hold = false;
      await new Promise((resolve, reject) => {
        const watchdog = setTimeout(() => reject(Error("Battle did not advance")), 180000);
        function sample(now) {
          const elapsed = sim.time - start;
          if (elapsed >= 0.65 && previous !== null) {
            samples.push([now - previous, view.renderer.info.render.calls, view.fx.active]);
          }
          previous = now;
          if (elapsed < 5) requestAnimationFrame(sample);
          else { f.hold = true; clearTimeout(watchdog); resolve(); }
        }
        requestAnimationFrame(sample);
      });
      function p95(column) {
        const sorted = samples.map(sample => sample[column]).sort((a,b) => a-b);
        return sorted[Math.ceil(sorted.length * 0.95) - 1];
      }
      return {frames:samples.length, frameP95ms:p95(0), drawsP95:p95(1), particlesP95:p95(2),
        particlesPeak:Math.max(...samples.map(sample=>sample[2])), eco:view.lowPower};
    });
    assert.deepEqual(errors, []);
    assert.ok(result.eco && result.particlesPeak > 0 && result.frames >= 10, JSON.stringify(result));
    return result;
  } finally { await page.close(); }
}
const runs = [];
try {
  for (let i = 0; i < repeats; i++) {
    for (const units of [12,300]) {
      const run = {trial:i+1, units, ...await measure(units)};
      runs.push(run); console.log(JSON.stringify(run));
      writeFileSync(output, JSON.stringify(runs,null,2) + "\n");
    }
  }
} finally { await browser.close(); }
