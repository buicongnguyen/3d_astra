import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const base = process.env.TEST_URL || "http://127.0.0.1:5173/";
const output = new URL("../test-results/", import.meta.url);
await mkdir(output, { recursive: true });
const chrome =
  process.env.CHROME_PATH ||
  (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : undefined);
const browser = await chromium.launch({
  headless: true,
  ...(chrome && existsSync(chrome) ? { executablePath: chrome } : {}),
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
});
const errors = [],
  badResponses = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
});

try {
  await page.goto(`${base}${base.includes("?") ? "&" : "?"}test=1`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.__frontier, { timeout: 30000 });
  await page.screenshot({
    path: new URL("briefing.png", output).pathname.replace(/^\/(\w:)/, "$1"),
  });
  assert.equal(
    await page.evaluate(() => window.__frontier.view.models.size),
    9,
  );
  await page.getByRole("button", { name: "Deploy expedition" }).click();
  assert.equal(await page.locator("#briefing").isVisible(), false);
  assert.equal(await page.evaluate(() => window.__frontier.started), true);

  // Actual UI production and cancellation.
  const before = await page.evaluate(
    () => window.__frontier.sim.players[0].alloy,
  );
  await page.locator('[data-action="worker"]').click();
  await page.waitForFunction(
    () =>
      window.__frontier.sim.own(0).find((e) => e.type === "hq").queue.length ===
      1,
  );
  assert.equal(
    await page.evaluate(() => window.__frontier.sim.players[0].alloy),
    before - 50,
  );
  await page.locator('#queue [data-cancel="0"]').click();
  assert.equal(
    await page.evaluate(() => window.__frontier.sim.players[0].alloy),
    before,
  );
  await page.locator('[data-action="worker"]').click();
  await page.evaluate(() => window.__frontier.step(9));
  assert.equal(
    await page.evaluate(
      () =>
        window.__frontier.sim.own(0).filter((e) => e.type === "worker").length,
    ),
    5,
  );

  // Actual mouse selection and context gathering. Center targets away from HUD.
  await page.evaluate(() => window.__frontier.view.focusOn(-30, 18));
  const entityPoint = async (type, kind = "unit") =>
    page.evaluate(
      ({ type, kind }) => {
        const { sim, view } = window.__frontier;
        const e =
          kind === "resource"
            ? sim.resources.find((e) => e.type === type)
            : sim.own(0).find((e) => e.type === type);
        const p = view.project(e.x, e.z, kind === "resource" ? 1 : 0.9),
          rect = view.renderer.domElement.getBoundingClientRect();
        return { id: e.id, x: p.x + rect.left, y: p.y + rect.top };
      },
      { type, kind },
    );
  const worker = await entityPoint("worker");
  await page.mouse.click(worker.x, worker.y);
  assert.ok(
    await page.evaluate((id) => window.__frontier.selected.has(id), worker.id),
    "Mouse should select worker",
  );
  const alloy = await entityPoint("alloy", "resource");
  await page.mouse.click(alloy.x, alloy.y, { button: "right" });
  assert.equal(
    await page.evaluate(
      (id) => window.__frontier.sim.get(id).orders[0]?.type,
      worker.id,
    ),
    "gather",
  );
  const bank = await page.evaluate(
    () => window.__frontier.sim.players[0].alloy,
  );
  await page.evaluate(() => window.__frontier.step(35));
  assert.ok(
    await page.evaluate(
      (before) => window.__frontier.sim.players[0].alloy > before,
      bank,
    ),
  );

  // Placement through command tile and battlefield click.
  await page.evaluate((id) => {
    window.__frontier.select([id]);
    window.__frontier.view.focusOn(-19, 29);
  }, worker.id);
  await page.locator('[data-action="relay"]').click();
  const buildPoint = await page.evaluate(() => {
    const p = window.__frontier.view.project(-19, 34);
    const r =
      window.__frontier.view.renderer.domElement.getBoundingClientRect();
    return { x: p.x + r.left, y: p.y + r.top };
  });
  await page.mouse.move(buildPoint.x, buildPoint.y);
  await page.mouse.click(buildPoint.x, buildPoint.y);
  assert.ok(
    await page.evaluate(() =>
      window.__frontier.sim.own(0).some((e) => e.type === "relay"),
    ),
  );
  await page.evaluate(() => window.__frontier.step(30));
  assert.ok(
    await page.evaluate(() =>
      window.__frontier.sim
        .own(0)
        .some((e) => e.type === "relay" && e.complete),
    ),
  );

  // Pause, resume, control group, and help do not advance or issue orders.
  await page.keyboard.press("Space");
  assert.equal(await page.evaluate(() => window.__frontier.paused), true);
  await page.keyboard.press("Space");
  assert.equal(await page.evaluate(() => window.__frontier.paused), false);
  await page.getByRole("button", { name: "Show controls" }).click();
  assert.equal(await page.locator("#modal").isVisible(), true);
  await page.getByRole("button", { name: "Return to the frontier" }).click();
  await page.evaluate(() => {
    const g = window.__frontier;
    g.select(
      g.sim
        .own(0)
        .filter((e) => e.kind === "unit" && e.type !== "worker")
        .map((e) => e.id),
    );
    g.view.focusOn(-20, 19);
  });
  await page.keyboard.press("Control+1");
  await page.evaluate(() => window.__frontier.select([]));
  await page.keyboard.press("1");
  assert.ok(await page.evaluate(() => window.__frontier.selected.size >= 3));
  await page.screenshot({
    path: new URL("gameplay.png", output).pathname.replace(/^\/(\w:)/, "$1"),
  });

  // Deterministic result transitions through the real render loop, then restart.
  await page.evaluate(() => {
    window.__frontier.sim.own(1).find((e) => e.type === "hq").hp = 0;
  });
  await page.getByRole("heading", { name: "The frontier is yours." }).waitFor();
  await page.getByRole("button", { name: "Deploy again" }).click();
  assert.equal(await page.evaluate(() => window.__frontier.sim.result), null);
  assert.equal(
    await page.evaluate(
      () =>
        window.__frontier.sim.own(0).filter((e) => e.kind === "unit").length,
    ),
    7,
  );
  await page.evaluate(() => {
    window.__frontier.sim.own(0).find((e) => e.type === "hq").hp = 0;
  });
  await page
    .getByRole("heading", { name: "Your outpost has fallen." })
    .waitFor();
  await page.getByRole("button", { name: "Deploy again" }).click();

  // Snapshot an active 100-unit scene. This measures this browser/hardware only.
  await page.evaluate(() => {
    const { sim, view } = window.__frontier;
    sim.aiEnabled = false;
    for (let i = 0; i < 93; i++) {
      const e = sim.spawn(
        i % 4 === 0 ? "breaker" : i % 2 ? "vanguard" : "ranger",
        0,
        -38 + (i % 15) * 2.6,
        -4 + Math.floor(i / 15) * 2.5,
      );
      sim.issue([e.id], { type: "attackmove", x: 18, z: -8 });
    }
    view.focusOn(-6, 7);
    view.zoom = 65;
    view.updateCamera();
  });
  const performanceResult = await page.evaluate(async () => {
    const times = [];
    let previous = performance.now();
    for (let i = 0; i < 100; i++) {
      const now = await new Promise(requestAnimationFrame);
      if (i > 10) times.push(now - previous);
      previous = now;
    }
    times.sort((a, b) => a - b);
    const { sim, view } = window.__frontier;
    const gl = view.renderer.getContext(),
      debug = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      viewport: [innerWidth, innerHeight],
      friendlyUnits: sim.own(0).filter((e) => e.kind === "unit").length,
      totalUnits: sim.entities.filter((e) => e.kind === "unit").length,
      medianFrameMs: times[Math.floor(times.length / 2)],
      p95FrameMs: times[Math.floor(times.length * 0.95)],
      drawCalls: view.renderer.info.render.calls,
      triangles: view.renderer.info.render.triangles,
      gpu: debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : "unavailable",
      userAgent: navigator.userAgent,
    };
  });
  assert.deepEqual(errors, [], `JavaScript errors: ${errors}`);
  assert.deepEqual(badResponses, [], `Missing assets: ${badResponses}`);
  await writeFile(
    new URL("browser-results.json", output),
    JSON.stringify(
      {
        base,
        checks: [
          "9 GLB assets load",
          "start",
          "production/refund",
          "worker selection/gather/delivery",
          "building placement/construction",
          "pause/resume",
          "help",
          "control groups",
          "victory",
          "defeat",
          "restart",
          "100-unit render",
        ],
        errors,
        badResponses,
        performance: performanceResult,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ result: "PASS", performance: performanceResult }, null, 2),
  );
} catch (error) {
  await page.screenshot({
    path: new URL("failure.png", output).pathname.replace(/^\/(\w:)/, "$1"),
  });
  console.error({ errors, badResponses });
  throw error;
} finally {
  await browser.close();
}
