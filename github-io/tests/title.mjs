// W2-C: the title screen on three viewports: wordmark and display font, three big choices, 11 px text,
// 44 px taps, no sideways scroll, no system-ui; night and storm looks on a mission.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, VIEWPORTS } from "./lib/harness.mjs";

const browser = await launchBrowser();
await suite("title", async () => {
  for (const name of Object.keys(VIEWPORTS)) {
    const t = await openPage(browser, name);
    await t.goto(); await t.ready();
    const { page } = t;
    assert.ok(await page.evaluate(() => document.fonts.load('800 20px "Baloo 2"', "Quân đội Việt").then((f) => f.length > 0 && document.fonts.check('800 20px "Baloo 2"', "Ấ"))), `${name}: display font loads with Vietnamese`);
    assert.equal(await page.locator(".title-brand svg.wordmark").count(), 1, `${name}: wordmark`);
    const bad = await page.evaluate((touch) => [...document.querySelectorAll("#briefing button, #briefing select")].filter((e) => e.getClientRects().length && !e.disabled).map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.textContent.trim().slice(0, 14), Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => h < 44 || (touch && w < 44)), t.mobile);
    assert.deepEqual(bad, [], `${name}: taps >= 44 px`);
    const small = await page.evaluate(() => [...document.querySelectorAll("#briefing :is(p,span,strong,small,h2,label,button)")].filter((e) => e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => [e.textContent.trim().slice(0, 20), parseFloat(getComputedStyle(e).fontSize)]).filter(([, s]) => s < 11));
    assert.deepEqual(small, [], `${name}: text >= 11 px`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: no sideways scroll`);
    const order = await page.locator(".mode-switch [data-mode]").evaluateAll((b) => b.map((x) => x.dataset.mode));
    assert.deepEqual(order, ["campaign", "skirmish", "defence", "training"]);
    assert.equal(await page.evaluate(() => /system-ui/.test([...document.styleSheets].flatMap((s) => [...s.cssRules]).map((r) => r.cssText).join(""))), false);
    assert.equal(await page.locator("#briefing .rule-options, #briefing [data-rule]").count() > 0 || await page.locator("text=Battle rules").count() > 0, true, `${name}: Battle rules row stays mounted`);
    await shot(page, `title-${name}`);
    assert.deepEqual(t.errors, []);
    await page.close();
  }
}, { browser });
