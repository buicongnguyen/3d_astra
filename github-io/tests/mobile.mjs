import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  args: [
    "--enable-unsafe-swiftshader",
    ...(process.env.SOFTWARE_RENDER
      ? ["--use-angle=swiftshader", "--use-gl=angle"]
      : []),
  ],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
const page = await context.newPage();
const errors = [],
  badResponses = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
});
const screenshot = (name) =>
  page.screenshot({
    path: fileURLToPath(new URL(`mobile-${name}.png`, output)),
  });
const read = (fn) => page.evaluate(fn);
const tap = (selector) => page.locator(selector).tap();
const worldPoint = (x, z, y = 0) =>
  page.evaluate(
    ({ x, z, y }) => {
      const { view } = window.__frontier,
        p = view.project(x, z, y),
        r = view.renderer.domElement.getBoundingClientRect();
      return { x: p.x + r.left, y: p.y + r.top };
    },
    { x, z, y },
  );
const tapPoint = async (p) => page.touchscreen.tap(p.x, p.y);
const gesture = async (frames, cancel = false) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: frames[0],
  });
  for (const touchPoints of frames.slice(1)) {
    await page.waitForTimeout(40);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints,
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: cancel ? "touchCancel" : "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
  // Let Chromium finish the gesture before starting an unrelated native tap.
  await page.waitForTimeout(150);
};
const layout = async (label) => {
  const result = await read(() => {
    const canvas = document.querySelector("#world canvas"),
      r = canvas.getBoundingClientRect();
    const controls = [
      "#select-workers",
      "#select-army",
      "#box-select",
      "#queue-orders",
      "#pause",
      "#help",
      "#dock-tabs",
    ];
    return {
      width: innerWidth,
      height: innerHeight,
      scroll: document.documentElement.scrollWidth,
      world: { x: r.x, y: r.y, width: r.width, height: r.height },
      pixelRatio: window.__frontier.view.renderer.getPixelRatio(),
      controls: controls.map((s) => {
        const e = document.querySelector(s),
          b = e.getBoundingClientRect();
        return {
          s,
          x: b.x,
          y: b.y,
          w: b.width,
          h: b.height,
          hit: e.contains(
            document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
          ),
        };
      }),
    };
  });
  assert.ok(
    result.scroll <= result.width,
    `${label}: no horizontal document overflow`,
  );
  assert.ok(
    result.world.width >= 200 && result.world.height >= 120,
    `${label}: usable battlefield`,
  );
  for (const c of result.controls) {
    assert.ok(
      c.x >= 0 &&
        c.y >= 0 &&
        c.x + c.w <= result.width + 1 &&
        c.y + c.h <= result.height + 1,
      `${label}: ${c.s} fits`,
    );
    assert.ok(c.hit, `${label}: ${c.s} is not obscured`);
  }
  checks.push({ label, ...result });
};

try {
  await page.goto(`${base}?test=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__frontier, { timeout: 30000 });
  assert.equal(await read(() => window.__frontier.view.models.size), 9);
  await screenshot("briefing");
  await tap("#start");
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("in-briefing"),
  );
  await read(() => {
    window.__frontier.sim.aiEnabled = false;
  });
  await layout("portrait 390×844");
  assert.equal(
    await read(() => window.__frontier.view.renderer.getPixelRatio()),
    1,
    "Eco limits retina rendering cost",
  );
  await screenshot("portrait");

  // Tap real world targets, then issue contextual gathering.
  const worker = await read(() =>
    window.__frontier.sim.own(0).find((e) => e.type === "worker"),
  );
  await tapPoint(await worldPoint(worker.x, worker.z, 1));
  assert.ok(
    await page.evaluate((id) => window.__frontier.selected.has(id), worker.id),
    "Tap selects the worker",
  );
  await tap("#select-workers");
  const resource = await read(() =>
    window.__frontier.sim.resources.find((e) => e.type === "alloy"),
  );
  await read(() => window.__frontier.view.focusOn(-30, 20));
  await tapPoint(await worldPoint(resource.x, resource.z, 1));
  assert.ok(
    await read(() =>
      window.__frontier.sim
        .own(0)
        .filter((e) => e.type === "worker")
        .every((e) => e.orders[0]?.type === "gather"),
    ),
  );
  await read(() => window.__frontier.step(30));
  assert.ok(
    (await read(() => window.__frontier.sim.players[0].alloy)) > 450,
    "Touch command produces income",
  );

  // Construction has an explicit confirmation so camera gestures cannot spend resources.
  await tap("#select-workers");
  await tap('[data-action="relay"]');
  const site = await read(() => {
    const { sim, view } = window.__frontier;
    for (let z = 14; z < 36; z += 2)
      for (let x = -32; x < -12; x += 2)
        if (!sim.placement("relay", 0, x, z)) {
          view.focusOn(x, z);
          return { x, z };
        }
  });
  assert.ok(site);
  const alloyBefore = await read(() => window.__frontier.sim.players[0].alloy);
  await tapPoint(await worldPoint(site.x, site.z));
  assert.equal(
    await read(
      () =>
        window.__frontier.sim.own(0).filter((e) => e.type === "relay").length,
    ),
    0,
  );
  assert.equal(
    await read(() => window.__frontier.sim.players[0].alloy),
    alloyBefore,
  );
  assert.equal(await page.locator("#confirm-build").isEnabled(), true);
  await tap("#confirm-build");
  assert.equal(
    await read(
      () =>
        window.__frontier.sim.own(0).filter((e) => e.type === "relay").length,
    ),
    1,
  );
  await read(() => window.__frontier.step(30));
  assert.ok(
    await read(
      () =>
        window.__frontier.sim.own(0).find((e) => e.type === "relay").complete,
    ),
  );

  // Production and cancellation are both reachable through the compact panels.
  await read(() => window.__frontier.view.focusOn(-25, 24));
  await tapPoint(await worldPoint(-25, 24, 1));
  await tap('[data-action="worker"]');
  await tap('[data-dock="selection"]');
  await tap('#queue [data-cancel="0"]');
  assert.equal(
    await read(
      () =>
        window.__frontier.sim.own(0).find((e) => e.type === "hq").queue.length,
    ),
    0,
  );

  await tap("#select-army");
  await tap("#stop-order");
  let rect = await page.locator("#world canvas").boundingBox();
  const cx = rect.x + rect.width / 2,
    cy = rect.y + rect.height / 2;
  const beforePan = await read(() => ({
    x: window.__frontier.view.focus.x,
    z: window.__frontier.view.focus.z,
  }));
  await gesture([
    [{ id: 1, x: cx, y: cy }],
    [{ id: 1, x: cx + 50, y: cy + 30 }],
    [{ id: 1, x: cx + 75, y: cy + 40 }],
  ]);
  assert.notDeepEqual(
    await read(() => ({
      x: window.__frontier.view.focus.x,
      z: window.__frontier.view.focus.z,
    })),
    beforePan,
  );
  assert.ok(
    await read(() =>
      window.__frontier.sim
        .own(0)
        .filter((e) => e.kind === "unit" && e.type !== "worker")
        .every((e) => !e.orders.length),
    ),
    "Pan does not issue orders",
  );
  const beforeZoom = await read(() => window.__frontier.view.zoom);
  await gesture([
    [
      { id: 1, x: cx - 35, y: cy },
      { id: 2, x: cx + 35, y: cy },
    ],
    [
      { id: 1, x: cx - 65, y: cy },
      { id: 2, x: cx + 65, y: cy },
    ],
  ]);
  assert.ok(
    (await read(() => window.__frontier.view.zoom)) < beforeZoom,
    "Pinch zooms in",
  );
  await gesture(
    [[{ id: 1, x: cx, y: cy }], [{ id: 1, x: cx + 30, y: cy }]],
    true,
  );
  assert.ok(
    await read(() =>
      window.__frontier.sim
        .own(0)
        .filter((e) => e.kind === "unit" && e.type !== "worker")
        .every((e) => !e.orders.length),
    ),
    "Cancelled gestures do not issue orders",
  );

  await tap("#queue-orders");
  await tap("#move-order");
  await tapPoint({ x: cx, y: cy });
  await tap("#move-order");
  await tapPoint({ x: cx + 50, y: cy + 35 });
  assert.ok(
    await read(() =>
      window.__frontier.sim.own(0).some((e) => e.orders.length >= 2),
    ),
    "Queue toggle appends commands",
  );
  await tap("#queue-orders");
  await tap("#stop-order");
  await tap("#attack-order");
  await tap("#cancel-mode");
  assert.equal(await page.locator("#mode-banner").isVisible(), false);

  await read(() => {
    window.__frontier.view.focusOn(-24, 20);
    window.__frontier.view.zoom = 38;
    window.__frontier.view.resize();
  });
  await tap("#box-select");
  rect = await page.locator("#world canvas").boundingBox();
  await gesture([
    [{ id: 1, x: rect.x + 8, y: rect.y + 55 }],
    [{ id: 1, x: rect.x + rect.width - 8, y: rect.y + rect.height - 10 }],
  ]);
  assert.ok(
    (await read(() => window.__frontier.selected.size)) > 1,
    "Box gesture selects a group",
  );
  assert.equal(
    await page.locator("#box-select").getAttribute("aria-pressed"),
    "false",
  );
  await tap("#quality");
  await page.waitForFunction(() => !window.__frontier.view.lowPower);
  await tap("#quality");
  await page.waitForFunction(() => window.__frontier.view.lowPower);
  await tap("#pause");
  assert.equal(await read(() => window.__frontier.paused), true);
  await tap("[data-resume]");
  await tap("#help");
  assert.match(await page.locator(".controls-grid").innerText(), /Pinch/);
  await tap("[data-resume]");

  for (const [width, height, label] of [
    [844, 390, "landscape"],
    [320, 568, "small-portrait"],
    [667, 375, "small-landscape"],
    [768, 1024, "tablet"],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(
      () =>
        window.__frontier.view.width ===
        Math.max(1, document.querySelector("#world").clientWidth),
    );
    await tap("#select-workers");
    await layout(label);
    await tap('[data-action="relay"]');
    await tap("#cancel-mode");
    await tap('[data-dock="map"]');
    await tap("#home");
    await tap('[data-dock="selection"]');
    await screenshot(label);
  }
  await read(() => {
    window.__frontier.sim.own(1).find((e) => e.type === "hq").hp = 0;
  });
  await page.waitForSelector("[data-restart]");
  await tap("[data-restart]");
  assert.equal(await read(() => window.__frontier.sim.result), null);
  assert.equal(
    await page.locator("#queue-orders").getAttribute("aria-pressed"),
    "false",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(badResponses, []);
  await writeFile(
    new URL("mobile-results.json", output),
    JSON.stringify(
      {
        checks,
        errors,
        badResponses,
        gestures: "tap, pan, pinch, cancel, box, queue",
        scope: "Chromium touch emulation; not physical mobile hardware",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        passed: true,
        viewports: checks.map((c) => c.label),
        errors,
        badResponses,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await screenshot("failure");
  console.error({ errors, badResponses });
  throw error;
} finally {
  await browser.close();
}
