// Heroic challenges in the browser (AAA round 2, W2-B) at 1440x900, 390x844 and 844x390:
//   - the Heroic tab sits beside Levels, Endless and Daily; on a level with no clear it shows the locked teaser and
//     Start does not start; after a clear it opens, and the level row shows its mark;
//   - a Heroic match starts (6 waves, 5 lives), the wave strip names the elite groups and an affix chip;
//   - the result shows the Heroic badge (data-variant="heroic") and a win records +1 star in progress;
//   - 11 px text, 44 px taps, no sideways scroll, no page errors.
// Screenshots: test-results/defence-heroic-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.HEROIC_VIEWPORTS || "desktop,portrait,landscape").split(",");
const noSideScroll = async (page, where) => {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
};
const tiny = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(`${selector} *`)].filter((el) => el.offsetParent !== null && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.textContent), selector);
const small = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(selector)].filter((el) => el.offsetParent !== null).map((el) => { const b = el.getBoundingClientRect(); return { id: el.dataset.defenceVariant || el.id || el.textContent.slice(0, 20), w: b.width, h: b.height }; }).filter((b) => b.w < 43.5 || b.h < 43.5), selector);

async function open(viewport, progress) {
  const o = await openPage(browser, viewport);
  await o.page.addInitScript((p) => { try { if (!sessionStorage.getItem("heroic")) { localStorage.setItem("frontier-defence-v1", JSON.stringify(p)); sessionStorage.setItem("heroic", "1"); } } catch {} }, progress);
  await o.goto("");
  await o.ready();
  await o.tap('[data-mode="defence"]');
  await o.page.waitForSelector("#defence-setup .defence-levels");
  return o;
}

await suite("defence-heroic", async () => {
  for (const viewport of VIEWPORTS) {
    // ---- Locked: d-bridges is open but has no star.
    {
      const { page, errors, tap } = await open(viewport, { levels: { "d-gorge": { stars: 2, lives: 12, difficulty: "standard" } } });
      const tabs = await page.evaluate(() => [...document.querySelectorAll("[data-defence-variant]")].map((b) => b.dataset.defenceVariant));
      assert.deepEqual(tabs, ["levels", "endless", "daily", "heroic", "records"], `${viewport}: the Heroic tab sits beside the other modes (Records since W10)`);
      await tap('[data-level-id="d-bridges"]');
      await tap('[data-defence-variant="heroic"]');
      await page.waitForFunction(() => document.querySelector('[data-defence-variant="heroic"]').getAttribute("aria-pressed") === "true");
      assert.match(await page.evaluate(() => document.querySelector("#briefing-text").textContent), /Clear this level once/, `${viewport}: the locked teaser`);
      assert.equal(await page.evaluate(() => document.querySelector("#start").getAttribute("aria-disabled")), "true");
      await page.evaluate(() => document.querySelector("#start").click());
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => !!window.__frontier.started), false, `${viewport}: a locked Heroic does not start`);
      assert.deepEqual(await small(page, "[data-defence-variant]"), [], `${viewport}: variant taps under 44 px`);
      assert.deepEqual(await tiny(page, "#defence-setup"), [], `${viewport}: setup text under 11 px`);
      await noSideScroll(page, `${viewport} locked`);
      await shot(page, `defence-heroic-locked-${viewport}`);
      assert.deepEqual(errors, []);
      await page.close();
    }
    // ---- Open: d-gorge cleared; start Heroic, read the strip, lose it, read the result.
    {
      const { page, errors, tap } = await open(viewport, { levels: { "d-gorge": { stars: 2, lives: 12, difficulty: "standard" } } });
      await tap('[data-level-id="d-gorge"]');
      await tap('[data-defence-variant="heroic"]');
      await page.waitForFunction(() => /Hold the Heroic 6 waves/.test(document.querySelector("#briefing-goal").textContent));
      assert.equal(await page.evaluate(() => document.querySelector("#start").getAttribute("aria-disabled")), "false");
      assert.equal(await page.evaluate(() => document.querySelector(".heroic-mark") !== null), true, `${viewport}: the level row has its Heroic mark`);
      await page.waitForFunction(() => window.__frontier.sim.missionDef?.variant === "heroic");
      await o_ready(page);
      await tap("#start");
      await page.waitForFunction(() => window.__frontier.started && document.querySelector("#defence-bar:not([hidden])"), null, { timeout: 60000 });
      const info = await page.evaluate(() => { const s = window.__frontier.sim; return { lives: s.defence.lives, waves: s.waveTotal() }; });
      assert.deepEqual(info, { lives: 5, waves: 6 }, `${viewport}: Heroic runs 6 waves on 5 lives`);
      await page.waitForSelector("#defence-intel .intel-unit.elite", { timeout: 20000 });
      assert.ok(await page.evaluate(() => document.querySelectorAll("#defence-intel .intel-chip.affix").length) >= 1, `${viewport}: an affix chip on the wave strip`);
      assert.deepEqual(await tiny(page, "#defence-intel"), [], `${viewport}: wave strip text under 11 px`);
      await shot(page, `defence-heroic-strip-${viewport}`);
      // Lose it fast: no lives left, the next tick ends the match.
      await page.evaluate(() => { window.__frontier.sim.defence.lives = 0; });
      await page.waitForSelector('.defence-result[data-variant="heroic"]', { timeout: 20000 });
      assert.equal(await page.evaluate(() => document.querySelector(".heroic-badge")?.textContent.includes("Heroic")), true, `${viewport}: the Heroic badge`);
      assert.deepEqual(await small(page, "#modal button"), [], `${viewport}: result taps under 44 px`);
      assert.deepEqual(await tiny(page, "#modal"), [], `${viewport}: result text under 11 px`);
      await noSideScroll(page, `${viewport} result`);
      await shot(page, `defence-heroic-result-${viewport}`);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("frontier-defence-v1")).heroic), undefined, `${viewport}: a loss records nothing`);
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
});
async function o_ready(page) { await page.waitForFunction(() => window.__frontier.sim && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models }); }
await browser.close();
