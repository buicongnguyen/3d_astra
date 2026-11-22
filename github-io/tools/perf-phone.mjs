// Measure a live 300-unit fight on a phone viewport using Chrome's CPU throttle.
// TEST_URL must identify the release preview. Arguments: output directory, before|after.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [output, label] = process.argv.slice(2);
assert.ok(output && ["before", "after"].includes(label) && process.env.TEST_URL,
  "Usage: TEST_URL=<release preview> node tools/perf-phone.mjs <output folder> before|after");
const windows = process.platform === "win32";
const browser = await chromium.launch({
  headless: true,
  executablePath: windows ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: windows ? ["--use-angle=d3d11", "--enable-gpu"] : ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
  });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && /shader/i.test(m.text())) errors.push(m.text()); });
  await page.goto(process.env.TEST_URL + "?test=1");
  await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled,
    null, { timeout: 90000 });
  await page.locator('[data-mode="skirmish"]').click();
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__frontier.started && window.__frontier.modelsReady, null, { timeout: 90000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    const f = window.__frontier, s = f.sim, v = f.view;
    f.hold = true;
    s.aiEnabled = false;
    const types = ["ranger", "tank", "vanguard", "breaker", "antitank"], ids = [];
    for (let i = 0; i < 300; i++) {
      const team = i % 2, row = Math.floor(i / 2);
      const x = -12 + row % 15 * 1.7, z = (team ? -1 : 1) * (4 + Math.floor(row / 15) * 1.35);
      const e = s.spawn(types[row % types.length], team, x, z);
      e.hp *= 0.85;
      if (!team) ids.push(e.id);
      s.issue([e.id], { type: "move", x: -x, z: -z });
    }
    s.visible[0].fill(1);
    s.explored[0].fill(1);
    f.select(ids);
    v.focusOn(0, 0);
    v.zoom = 42;
    v.updateCamera();
    v.update(s, 0, f.selected, null);
  });
  const result = await page.evaluate(async () => {
    const f = window.__frontier, v = f.view, s = f.sim, frames = [], calls = [];
    const count = () => s.entities.filter(e => e.kind === "unit").length;
    const initialUnits = count();
    let previous = null;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("Frame sample timed out")), 60000);
      function sample(time) {
        if (previous !== null) frames.push(time - previous);
        previous = time;
        calls.push(v.renderer.info.render.calls);
        if (calls.length === 10) f.hold = false;
        if (calls.length < 70) requestAnimationFrame(sample);
        else { clearTimeout(timeout); f.hold = true; resolve(); }
      }
      requestAnimationFrame(sample);
    });
    const percentile = (list, q) => list.slice().sort((a, b) => a - b)[Math.floor(list.length * q)];
    const active = frames.slice(15);
    return {
      initialUnits, finalUnits: count(), staticDraws: percentile(calls.slice(1, 10), 0.5),
      frameP95: percentile(active, 0.95), frameMedian: percentile(active, 0.5), frames: active.length,
      simTime: s.time, quality: v.lowPower ? "eco" : "high",
    };
  });
  assert.deepEqual(errors, []);
  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, label + "-phone.jpg"), type: "jpeg", quality: 85 });
  writeFileSync(path.join(output, label + ".json"), JSON.stringify(result, null, 2) + "\n");
  console.log(label, result);
} finally {
  await browser.close();
}
