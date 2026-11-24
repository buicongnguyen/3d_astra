// The unified settings sheet in the browser (2026-11-24) on desktop, phone portrait and phone landscape:
// one segmented tab row, changes apply and save at once (no Apply), Defaults, segmented choices, the gear in
// the match bar holds the match while the sheet is open, Settings → Game speed (×3 only with a mouse) and
// the confirm card before Restart / New game.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";
import { openSettings, closeSettings, choose, chosen } from "./lib/settings-sheet.mjs";

const browser = await launchBrowser();
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("frontier-command.settings.v1") || "null"));
await suite("settings-sheet", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    const touch = mobile;
    await goto(); await ready();

    // One row of seven sections; no dropdown anywhere in the sheet.
    await openSettings(page, "display", { touch });
    const tabs = await page.evaluate(() => { const t = [...document.querySelectorAll(".settings-panel [role=tab]")]; return { ids: t.map((b) => b.dataset.tab), rows: new Set(t.map((b) => Math.round(b.getBoundingClientRect().top))).size, selects: document.querySelectorAll(".settings-panel select").length }; });
    assert.deepEqual(tabs, { ids: ["audio", "game", "camera", "display", "controls", "access", "language"], rows: 1, selects: 0 }, `${viewport}: tab row`);

    // Live apply: a segmented choice and a switch are stored at once, with no Apply.
    await choose(page, "quality", "eco", { touch });
    assert.equal((await stored(page)).quality, "eco", `${viewport}: Eco saved without Apply`);
    assert.equal(await page.evaluate(() => window.__frontier.view.lowPower), true);
    await choose(page, "uiScale", "115", { touch });
    assert.equal((await stored(page)).uiScale, 115);
    await tap('.settings-panel [data-setting="showFps"]');
    assert.equal((await stored(page)).showFps, true, `${viewport}: a switch saves at once`);
    // Theme lives here too (its own per-device key).
    await tap('.settings-panel [data-do="theme"][data-theme="dark"]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.uiTheme), "dark");
    await tap('.settings-panel [data-do="theme"][data-theme="walnut"]');
    await shot(page, `settings-sheet-${viewport}-display`);
    // Defaults puts the stored settings back but keeps the language.
    await openSettings(page, "language", { touch });
    await choose(page, "language", "vi", { touch });
    await tap('.settings-panel [data-do="reset"]');
    const reset = await stored(page);
    assert.deepEqual([reset.uiScale, reset.showFps, reset.language], [100, false, "vi"], `${viewport}: Defaults`);
    assert.equal(await chosen(page, "language"), "vi");
    await choose(page, "language", "en", { touch });
    await closeSettings(page, { touch });
    await page.reload(); await ready();
    assert.equal((await stored(page)).language, "en", `${viewport}: survives a reload`);

    // In a match: the gear holds the match while the sheet is open and the clock runs again after.
    await tap('[data-mode="skirmish"]');
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
    await page.evaluate(() => { window.__frontier.sim.aiEnabled = false; });
    const bar = await page.evaluate(() => [...document.querySelectorAll(".top-actions > button")].filter((b) => b.offsetParent).map((b) => b.id));
    assert.deepEqual(bar, ["pause", "audio", "briefing-settings"], `${viewport}: match bar`);
    await openSettings(page, "game", { touch });
    assert.equal(await page.evaluate(() => window.__frontier.paused), true, `${viewport}: the sheet holds the match`);
    const speeds = await page.locator(".settings-panel [data-speed]").evaluateAll((bs) => bs.map((b) => b.dataset.speed));
    assert.deepEqual(speeds, touch ? ["1", "2"] : ["1", "2", "3"], `${viewport}: ×3 only with a mouse`);
    await tap('.settings-panel [data-speed="2"]');
    assert.equal(await page.locator('.settings-panel [data-speed="2"]').getAttribute("aria-pressed"), "true");
    await closeSettings(page, { touch });
    await page.waitForFunction(() => !window.__frontier.paused);
    await page.waitForFunction(() => /×2/.test(document.querySelector("#clock").textContent), null, { timeout: TIMEOUT.step });
    // Speed ×2 runs the same ticks faster: real time only (the match hash test is in settings-sheet.test.js).
    const t0 = await page.evaluate(() => window.__frontier.sim.time);
    await page.waitForTimeout(1000);
    const t1 = await page.evaluate(() => window.__frontier.sim.time);
    assert.ok(t1 - t0 > 1.2, `${viewport}: ×2 moves the clock faster (${(t1 - t0).toFixed(2)} s in 1 s)`);

    // Restart asks first (on by default); Keep playing goes back to the pause menu.
    await tap("#pause");
    await tap("#modal [data-restart]");
    await page.locator('#modal [data-confirmed="restart"]').waitFor({ state: "visible" });
    await shot(page, `settings-sheet-${viewport}-confirm`);
    await tap("#modal [data-confirm-back]");
    await page.locator("#modal [data-resume]").waitFor({ state: "visible" });
    const before = await page.evaluate(() => window.__frontier.sim.time);
    await tap("#modal [data-restart]");
    await tap('#modal [data-confirmed="restart"]');
    await page.waitForFunction((t) => window.__frontier.started && !window.__frontier.paused && window.__frontier.sim.time < t, before, { timeout: TIMEOUT.models });
    // With the switch off, Restart goes straight through.
    await openSettings(page, "game", { touch });
    await tap('.settings-panel [data-setting="confirmRestart"]');
    assert.equal((await stored(page)).confirmRestart, false);
    await closeSettings(page, { touch });
    await tap("#pause");
    await tap("#modal [data-restart]");
    await page.waitForFunction(() => window.__frontier.started && !window.__frontier.paused, null, { timeout: TIMEOUT.models });
    assert.equal(await page.locator("#modal [data-confirmed]").count(), 0);
    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }
}, { browser });
