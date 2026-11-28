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
    assert.deepEqual(tabs, { ids: ["audio", "game", "camera", "hero", "display", "controls", "access", "language"], rows: 1, selects: 0 }, `${viewport}: tab row`);

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

    // H7 Settings > Hero: nine flat segmented rows (Birds Off / Few / Many added 2026-11-28), every choice visible, one tap each, saved at once; 11 px text,
    // 44 px taps and nothing wider than the sheet, in English, Vietnamese and Korean.
    const HERO_ROWS = { battleTime: 4, dodgeHelp: 2, shotWarnings: 2, aimAssist: 3, autoFire: 2, heroView: 2, closeDetail: 3, skywingOffer: 2, birds: 3, birdHint: 2 };
    for (const language of ["en", "vi", "ko"]) {
      await openSettings(page, "language", { touch });
      await choose(page, "language", language, { touch });
      await page.waitForFunction((l) => document.documentElement.lang === l, language);
      await openSettings(page, "hero", { touch });
      const want = { en: "Hero", vi: "Anh hùng", ko: "영웅" }[language];
      await page.waitForFunction((w) => document.querySelector("[data-hero-tab]")?.textContent === w || getComputedStyle(document.querySelector("[data-hero-tab]")).position === "absolute", want, { timeout: TIMEOUT.step });
      const audit = await page.evaluate(() => {
        const body = document.querySelector("#settings-body"), rows = {}, small = [], tiny = [], spill = [];
        for (const g of body.querySelectorAll("[data-setting-group]")) rows[g.dataset.settingGroup] = g.querySelectorAll("button").length;
        for (const b of body.querySelectorAll("button")) {
          const r = b.getBoundingClientRect();
          if (r.height < 44 - 0.5 || r.width < 44 - 0.5) tiny.push(`${b.dataset.setting}=${b.dataset.value} ${Math.round(r.width)}x${Math.round(r.height)}`);
          if (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) spill.push(`${b.dataset.setting}=${b.dataset.value}`);
        }
        for (const el of body.querySelectorAll("button, span, p, small")) {
          if (!el.textContent.trim() || !el.offsetParent) continue;
          const px = parseFloat(getComputedStyle(el).fontSize);
          if (px < 11 - 0.01) small.push(`${el.textContent.trim().slice(0, 30)} ${px}px`);
        }
        const tab = document.querySelector("#settings-tab-hero").getBoundingClientRect();
        return { rows, small, tiny, spill, wide: body.scrollWidth > body.clientWidth + 1, tab: [tab.width, tab.height], label: document.querySelector("[data-hero-tab]").textContent };
      });
      assert.deepEqual(audit.rows, HERO_ROWS, `${viewport} ${language}: the ten Hero rows (Auto fire since 2026-11-28), every choice shown`);
      assert.deepEqual([audit.small, audit.tiny, audit.spill, audit.wide], [[], [], [], false], `${viewport} ${language}: 11 px text, 44 px taps, nothing spills`);
      if (viewport !== "portrait" || language === "en") assert.equal(audit.label, want, `${viewport} ${language}: the tab's name`);
      await shot(page, `settings-sheet-${viewport}-hero-${language}`);
    }
    await choose(page, "language", "en", { touch }).catch(async () => { await openSettings(page, "language", { touch }); await choose(page, "language", "en", { touch }); });
    await openSettings(page, "hero", { touch });
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#settings-body [data-setting-group]")].map((g) => [g.dataset.settingGroup, g.querySelector("[aria-pressed=true]")?.dataset.value])),
      [["battleTime", "0.5"], ["dodgeHelp", "false"], ["shotWarnings", "true"], ["aimAssist", touch ? "high" : "low"], ["autoFire", "true"], ["heroView", "shoulder"], ["closeDetail", "auto"], ["skywingOffer", "true"], ["birds", "few"], ["birdHint", "true"]], `${viewport}: the Hero defaults`);
    for (const [key, value] of [["battleTime", "0.75"], ["dodgeHelp", "true"], ["shotWarnings", "false"], ["aimAssist", "off"], ["autoFire", "false"], ["heroView", "first"], ["closeDetail", "on"], ["skywingOffer", "false"], ["birds", "many"], ["birdHint", "false"]])
      await choose(page, key, value, { touch });
    const hero = await stored(page);
    assert.deepEqual([hero.battleTime, hero.dodgeHelp, hero.shotWarnings, hero.aimAssist, hero.autoFire, hero.heroView, hero.closeDetail, hero.skywingOffer, hero.birds, hero.birdHint], [0.75, true, false, "off", false, "first", "on", false, "many", false], `${viewport}: one tap each, saved at once`);
    await closeSettings(page, { touch });
    // Skywing before matches Off: no offer on the skirmish setup; the Hero battle tile stays on the title screen.
    await tap('[data-mode="skirmish"]');
    assert.equal(await page.locator('.assist-rows[data-assist-where="skirmish"]').count(), 0, `${viewport}: no Skywing offer`);
    assert.equal(await page.locator("#hero-battle").count(), 1, `${viewport}: the Hero battle tile stays`);
    await page.reload(); await ready();
    const kept = await stored(page);
    assert.deepEqual([kept.dodgeHelp, kept.closeDetail, kept.birds, kept.birdHint, kept.autoFire], [true, "on", "many", false, false], `${viewport}: kept after a reload`);
    await openSettings(page, "hero", { touch });
    await choose(page, "skywingOffer", "true", { touch });
    await tap('.settings-panel [data-do="reset"]');
    await closeSettings(page, { touch });
    await tap('[data-mode="skirmish"]');
    await page.locator('.assist-rows[data-assist-where="skirmish"]').waitFor({ state: "attached", timeout: TIMEOUT.step });

    // In a match: the gear holds the match while the sheet is open and the clock runs again after.
    await tap('[data-mode="skirmish"]');
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
    await page.evaluate(() => { window.__frontier.sim.aiEnabled = false; });
    // The clock's pace at ×1 on this machine: a slow runner (software rendering, a slowed CPU: tests/lib/ci-like.mjs)
    // cannot even keep ×1 in real time, as the tick budget drops what a slow frame cannot run (governor.js).
    const s0 = await page.evaluate(() => window.__frontier.sim.time);
    await page.waitForTimeout(1000);
    const paceAt1 = (await page.evaluate(() => window.__frontier.sim.time)) - s0;
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
    // Only a machine that keeps ×1 in real time can show ×2 in real time; on a slower one the #clock badge above is the check.
    // Not on CI: its shared runners change speed between the ×1 and ×2 samples (0.90 s at ×2 after a real-time ×1, 2026-11-25).
    if (!process.env.CI && paceAt1 >= 0.9) assert.ok(t1 - t0 > 1.2, `${viewport}: ×2 moves the clock faster (${(t1 - t0).toFixed(2)} s in 1 s)`);
    else console.log(process.env.CI ? `${viewport}: ×2 pace not timed on CI (the ×2 clock badge is the check)` : `${viewport}: ×1 ran ${paceAt1.toFixed(2)} s in 1 s here, so the ×2 pace is not timed`);

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
    // Phase 2: the camera turns in quarter steps and tilts by preset (outside Defence), live.
    await openSettings(page, "camera", { touch });
    const height = () => page.evaluate(() => { const v = window.__frontier.view; return v.camera.position.y - v.focus.y; });
    const designed = await height();
    await choose(page, "cameraTurn", "90", { touch });
    await page.waitForFunction(() => Math.abs(window.__frontier.view.yaw - Math.PI / 2) < 1e-6, null, { timeout: TIMEOUT.step });
    await choose(page, "cameraAngle", "top", { touch });
    await page.waitForFunction((h) => window.__frontier.view.camera.position.y - window.__frontier.view.focus.y > h + 5, designed, { timeout: TIMEOUT.step });
    await shot(page, `settings-sheet-${viewport}-camera`);
    await choose(page, "cameraAngle", "standard", { touch });
    await choose(page, "cameraTurn", "0", { touch });
    await page.waitForFunction((h) => { const v = window.__frontier.view; return v.yaw === 0 && Math.abs(v.camera.position.y - v.focus.y - h) < 1e-6; }, designed, { timeout: TIMEOUT.step });
    // Assist: text size and reduced motion land on <html> for CSS and the views.
    await openSettings(page, "access", { touch });
    await choose(page, "textSize", "l", { touch });
    await choose(page, "reducedMotion", "on", { touch });
    assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.textSize, document.documentElement.dataset.reducedMotion, document.documentElement.classList.contains("motion-off"), window.__frontier.view.reducedMotion.matches]), ["l", "on", true, true], `${viewport}: Assist`);
    await choose(page, "textSize", "s", { touch });
    await choose(page, "reducedMotion", "system", { touch });
    await closeSettings(page, { touch });
    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }
}, { browser });
