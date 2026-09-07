import { webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const base = process.env.TEST_URL || "http://127.0.0.1:5173/";
const output = new URL("../test-results/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
try {
  await page.goto(`${base}?test=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__frontier, { timeout: 30000 });
  assert.equal(
    await page.evaluate(() => window.__frontier.view.models.size),
    9,
  );
  await page.locator("#start").tap();
  await page.waitForFunction(()=>window.__frontier.sim.time > .2 && window.__frontier.view.renderer.info.render.calls > 0,{timeout:15000});
  await page.locator('[data-action="worker"]').tap();
  await page.locator('[data-dock="selection"]').tap();
  await page.locator('#queue [data-cancel="0"]').tap();
  await page.locator("#select-workers").tap();
  const point = await page.evaluate(() => {
    const { sim, view } = window.__frontier;
    view.focusOn(-30, 20);
    const resource = sim.resources[0],
      p = view.project(resource.x, resource.z, 1),
      r = view.renderer.domElement.getBoundingClientRect();
    return { x: p.x + r.left, y: p.y + r.top };
  });
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForFunction(() =>
    window.__frontier.sim
      .own(0)
      .filter((e) => e.type === "worker")
      .every((e) => e.orders[0]?.type === "gather"),
  );
  await page.locator('[data-action="relay"]').tap();
  await page.locator("#cancel-mode").tap();
  await page.locator("#pause").tap();
  await page.locator("[data-resume]").tap();
  const webgl = await page.evaluate(()=>{
    const {view,sim}=window.__frontier,gl=view.renderer.getContext();
    view.renderer.render(view.scene,view.camera);
    const pixels=new Uint8Array(32*32*4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),32,32,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    return {canvas:view.renderer.domElement.getBoundingClientRect().toJSON(),calls:view.renderer.info.render.calls,glError:gl.getError(),colors:new Set([...pixels]).size,time:sim.time,contextLost:gl.isContextLost()};
  });
  assert.equal(webgl.glError,0); assert.equal(webgl.contextLost,false);
  assert.ok(webgl.colors>8 && webgl.canvas.height>200,'WebGL draws nonuniform game pixels');
  await page.locator("#help").tap();
  await page.locator("[data-resume]").tap();
  await page.screenshot({
    path: fileURLToPath(new URL("webkit-portrait.png", output)),
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('[data-dock="map"]').tap();
  await page.locator("#home").tap();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: fileURLToPath(new URL("webkit-landscape.png", output)),
  });
  assert.deepEqual(errors, []);
  const result = {
    passed: true,
    engine: "Playwright WebKit 26.0",
    scope: "Windows touch emulation; not physical iOS Safari",
    checks: [
      "models",
      "start",
      "production/cancel",
      "select/gather",
      "construction mode/cancel",
      "pause/help",
      "portrait/landscape",
    ],
    errors,
    webgl,
  };
  await writeFile(
    new URL("webkit-results.json", output),
    JSON.stringify(result, null, 2),
  );
  console.log(result);
} catch (e) {
  await page.screenshot({
    path: fileURLToPath(new URL("webkit-failure.png", output)),
  });
  console.error(errors);
  throw e;
} finally {
  await browser.close();
}
