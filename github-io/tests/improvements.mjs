import { chromium } from "playwright";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const base = process.env.TEST_URL || "http://127.0.0.1:5173/";
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
const output = new URL("../test-results/", import.meta.url);
await mkdir(output, { recursive: true });
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 960 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    const click = (s) =>
      mobile ? page.locator(s).tap() : page.locator(s).click();
    const read = (fn) => page.evaluate(fn);
    const snap = (name) =>
      page.screenshot({
        path: fileURLToPath(
          new URL(
            `improvements-${mobile ? "mobile" : "desktop"}-${name}.png`,
            output,
          ),
        ),
      });
    try {
      await page.goto(`${base}?test=1`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__frontier);
      assert.equal(
        await read(() => window.__frontier.sim.terrain.id),
        "riverlands",
      );
      await click("#briefing-settings");
      if (!mobile) {
        await page.keyboard.press("Escape");
        assert.equal(await read(() => window.__frontier.started), false);
        await click("#briefing-settings");
      }
      await click('[data-team="playerColor"][data-color="gold"]');
      await click('[data-team="enemyColor"][data-color="gold"]');
      assert.equal(await page.locator('[data-do="apply"]').isDisabled(), true);
      await click('[data-team="enemyColor"][data-color="violet"]');
      await snap("settings");
      await click('footer [data-do="cancel"]');
      assert.equal(
        await read(() => window.__frontier.settings.playerColor),
        "mint",
      );
      assert.equal(await read(() => window.__frontier.started), false);
      await click("#briefing-settings");
      await click('[data-team="playerColor"][data-color="gold"]');
      await click('[data-team="enemyColor"][data-color="violet"]');
      await click('[data-do="apply"]');
      assert.equal(
        await read(() => window.__frontier.settings.playerColor),
        "gold",
      );
      assert.equal(
        await read(
          () =>
            window.__frontier.view.teamTemplates
              .get("worker-0")
              .getObjectByProperty("isMesh", true) !== undefined,
        ),
        true,
      );
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__frontier);
      assert.equal(
        await read(() => window.__frontier.settings.playerColor),
        "gold",
      );
      // Terrain changes release their resources and keep the classic scenario selectable.
      await page.selectOption("#scenario", "classic");
      assert.equal(
        await read(() => window.__frontier.sim.terrain.id),
        "classic",
      );
      await page.selectOption("#scenario", "riverlands");
      await click("#start");
      await read(() => {
        window.__frontier.sim.aiEnabled = false;
      });
      await click('[data-action="worker"]');
      await read(() => window.__frontier.step(9));
      await page.waitForFunction(
        () =>
          window.__frontier.view.objects.size ===
          window.__frontier.sim.entities.length,
      );
      const materialColors = await read(() => {
        const g = window.__frontier,
          colors = [];
        for (const e of g.sim.own(0)) {
          g.view.objects.get(e.id).traverse((o) => {
            if (o.isMesh && o.material.name === "Team")
              colors.push(o.material.color.getHexString());
          });
        }
        return [...new Set(colors)];
      });
      assert.deepEqual(
        materialColors,
        ["edc76f"],
        "Existing and newly trained army uses the saved paint",
      );
      await click("#pause");
      await click("[data-settings]");
      await click('[data-tab="graphics"]');
      await page.selectOption('[data-setting="quality"]', "eco");
      await page.locator('[data-setting="waterMotion"]').uncheck();
      await page.locator('[data-setting="detail"]').uncheck();
      await click('[data-tab="audio"]');
      await page.locator('[data-setting="muted"]').check();
      await click('[data-do="apply"]');
      assert.equal(
        await read(() => window.__frontier.paused),
        true,
        "Settings opened from pause must remain paused",
      );
      assert.equal(
        await read(() => window.__frontier.view.environment.decor.visible),
        false,
      );
      assert.equal(
        await read(() => !!window.__frontier.view.environment.water),
        true,
      );
      assert.equal(
        await read(() => window.__frontier.view.environment.motion),
        false,
      );
      await click("[data-settings]");
      await click('[data-tab="graphics"]');
      await page.locator('[data-setting="waterMotion"]').check();
      await page.locator('[data-setting="detail"]').check();
      await click('[data-do="apply"]');
      await click("[data-resume]");
      assert.equal(await read(() => window.__frontier.paused), false);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(
        () => window.__frontier.view.environment.motion === false,
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.waitForFunction(
        () => window.__frontier.view.environment.motion === true,
      );
      await click("#pause");
      await click("[data-settings]");
      if (mobile) {
        await page.setViewportSize({ width: 844, height: 390 });
        await snap("settings-landscape");
        await page.setViewportSize({ width: 320, height: 568 });
      }
      assert.equal(
        await read(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await click('footer [data-do="cancel"]');
      await click("[data-resume]");
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      // Repeated settings and match resets must not accumulate GPU resources.
      await read(() => window.__frontier.restart());
      await page.waitForFunction(() => window.__frontier.view.objects.size > 0);
      const before = await read(() => ({
        ...window.__frontier.view.renderer.info.memory,
      }));
      for (let i = 0; i < 5; i++) {
        await click("#pause");
        await click("[data-settings]");
        await click('footer [data-do="cancel"]');
        await click("[data-resume]");
        await read(() => window.__frontier.restart());
        await page.waitForFunction(
          () => window.__frontier.view.objects.size > 0,
        );
      }
      const after = await read(() => ({
        ...window.__frontier.view.renderer.info.memory,
      }));
      assert.ok(after.geometries <= before.geometries + 2);
      assert.ok(after.textures <= before.textures + 1);
      // Show the crossings through actual friendly vision for the visual review.
      await read(() => {
        const g = window.__frontier;
        g.sim.aiEnabled = false;
        for (const x of [-22, 0, 22]) g.sim.spawn("ranger", 0, x, 6);
        g.sim.updateVision();
        g.view.focusOn(0, 2);
        g.view.zoom = matchMedia("(pointer:coarse)").matches ? 42 : 65;
        g.view.updateCamera();
      });
      await page.waitForTimeout(400);
      await snap("river");
      assert.deepEqual(errors, []);
      results.push({ mobile, passed: true, before, after, errors });
    } catch (e) {
      await snap("failure");
      console.error(errors);
      throw e;
    } finally {
      await context.close();
    }
  }
  await writeFile(
    new URL("improvements-results.json", output),
    JSON.stringify(results, null, 2),
  );
  console.log(results);
} finally {
  await browser.close();
}
