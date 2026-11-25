// WebGL draws in a big phone fight with many deaths (readable deaths, 2026-11-26). The frame loop is held and the
// fight is stepped by hand in fixed 0.05 s ticks (the same rules every run), every event goes to the view as the
// game sends it, and each frame's renderer calls are recorded. Reports the median and maximum draws over the
// frames that had dying units, the deaths seen and the live death cues.
// Usage: TEST_URL=http://127.0.0.1:4244/ node tools/death-draws.mjs [portrait|landscape] [high|eco]
import { chromium } from "playwright";

const [shape = "portrait", quality = "high"] = process.argv.slice(2);
const viewport = shape === "landscape" ? { width: 844, height: 390 } : { width: 390, height: 844 };
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu"] : ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto((process.env.TEST_URL || "http://127.0.0.1:4244/") + "?test=1");
  await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled, null, { timeout: 120000 });
  await page.locator('[data-mode="skirmish"]').click();
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__frontier.started && window.__frontier.modelsReady, null, { timeout: 120000 });
  const result = await page.evaluate(async (quality) => {
    const f = window.__frontier, s = f.sim, v = f.view;
    f.hold = true;
    v.applySettings({ ...v.settings, quality });
    s.aiEnabled = false;
    const types = ["ranger", "tank", "vanguard", "breaker", "antitank"];
    for (let i = 0; i < 300; i++) {
      const team = i % 2, row = Math.floor(i / 2);
      const x = -12 + row % 15 * 1.7, z = (team ? -1 : 1) * (4 + Math.floor(row / 15) * 1.35);
      const e = s.spawn(types[row % types.length], team, x, z);
      e.hp *= 0.35;
      s.issue([e.id], { type: "move", x: -x, z: -z });
    }
    s.visible[0].fill(1); s.explored[0].fill(1);
    f.select([]);
    v.focusOn(0, 0); v.zoom = v.defaultZoom; v.updateCamera();
    const calls = [], dyingCalls = [];
    let deaths = 0, maxDying = 0, maxCues = 0;
    for (let i = 0; i < 160; i++) {
      s.tick(0.05);
      for (const ev of s.events.splice(0)) { if (ev.type === "death") deaths++; v.event(ev, s); }
      v.update(s, 0.05, f.selected, null);
      const n = v.renderer.info.render.calls;
      calls.push(n);
      if (v.dying.length) dyingCalls.push(n);
      maxDying = Math.max(maxDying, v.dying.length);
      maxCues = Math.max(maxCues, v.deathCues?.live ?? 0);
      if (i % 20 === 19) await new Promise(requestAnimationFrame);
    }
    const sorted = (l) => l.slice().sort((a, b) => a - b), pct = (l, q) => sorted(l)[Math.floor(l.length * q)];
    return { quality: v.lowPower ? "eco" : "high", deaths, maxDying, maxCues, medianDraws: pct(calls, 0.5), medianDrawsWhileDying: pct(dyingCalls, 0.5),
      p95DrawsWhileDying: pct(dyingCalls, 0.95), maxDraws: Math.max(...calls), particles: v.fx.active };
  }, quality);
  console.log(JSON.stringify({ shape, ...result, errors: errors.slice(0, 3) }));
} finally { await browser.close(); }
