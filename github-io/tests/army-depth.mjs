// AAA round 3, R3-C "Army depth" in the browser at 1440x900, 390x844 and 844x390:
//  - the Army size row of the skirmish Battle rules: 100 / 150 / 200 on the desktop, 100 / 150 on a
//    touch device (200 is desktop-only), 44 px taps, no text under 11 px, no sideways scroll, and the
//    choice reaching the sim (`rules.pop`, the cap read by sim.maxPop());
//  - Frontier Defence on Three Roads: a squad at Rank 2 with a branch shows the Combined tile
//    (320 alloy, 44 px, sub-line of 10 characters or fewer); a tap buys it through the command log,
//    and the tile turns to Combined with a check.
// Screenshots: test-results/army-depth-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const OPENED = ["d-gorge", "d-bridges", "d-switchback", "d-fordwood", "d-canyon", "d-longcrossing"];
const tinyText = (page, selector, min = 11) => page.evaluate(([selector, min]) => [...document.querySelectorAll(`${selector} *`)].filter((el) => el.offsetParent !== null && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < min).map((el) => el.textContent), [selector, min]);
const sideScroll = (page) => page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1);

await suite("army-depth", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, errors, tap, goto, ready, mobile } = await openPage(browser, viewport, { timeout: TIMEOUT.models }); // a slow runner: the Defence level switch blocks a tap for over 30 s
    await page.addInitScript((ids) => { try { localStorage.setItem("frontier-defence-v1", JSON.stringify({ levels: Object.fromEntries(ids.map((id) => [id, { stars: 2, lives: 12, difficulty: "standard" }])) })); } catch {} }, OPENED);
    await goto();
    await ready();

    // Army size: the row, its buttons and the choice in the sim.
    const row = await page.evaluate(() => {
      const r = document.querySelector('#battle-rules [data-rule="pop"]');
      return r && { values: [...r.querySelectorAll("[data-rule-value]")].map((b) => b.dataset.ruleValue), boxes: [...r.querySelectorAll("button")].map((b) => { const x = b.getBoundingClientRect(); return [x.width, x.height]; }) };
    });
    assert.ok(row, `${viewport}: the Army size row`);
    assert.deepEqual(row.values, mobile ? ["100", "150"] : ["100", "150", "200"], `${viewport}: 200 only on the desktop`);
    for (const [w, h] of row.boxes) assert.ok(w >= 44 && h >= 44, `${viewport}: tap ${w}x${h}`);
    assert.deepEqual(await tinyText(page, "#battle-rules"), [], `${viewport}: rules text under 11 px`);
    assert.equal(await sideScroll(page), false, `${viewport}: no sideways scroll`);
    assert.equal(await page.evaluate(() => window.__frontier.sim.maxPop()), 100, "100 by default");
    const pick = mobile ? "150" : "200";
    await page.locator(`#battle-rules [data-rule-value="${pick}"]`).scrollIntoViewIfNeeded();
    await tap(`#battle-rules [data-rule-value="${pick}"]`);
    await page.waitForFunction((pick) => window.__frontier.sim.rules?.pop === pick && window.__frontier.sim.maxPop() === Number(pick), pick);
    assert.equal(await page.locator(`#battle-rules [data-rule-value="${pick}"]`).getAttribute("aria-pressed"), "true");
    await page.locator('#battle-rules [data-rule="pop"]').screenshot({ path: `test-results/army-depth-rules-${viewport}.png` });
    // Back to 100: no rule key is kept.
    await tap('#battle-rules [data-rule-value="100"]');
    await page.waitForFunction(() => !window.__frontier.sim.rules);

    // Frontier Defence, Three Roads: the Combined step on a squad's sheet.
    await tap('[data-mode="defence"]');
    await page.waitForSelector("#defence-setup .defence-levels");
    await tap('[data-level-id="d-crossroads"]');
    await page.waitForFunction(() => window.__frontier.sim.missionDef?.id === "d-crossroads");
    await page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.defence && document.querySelector("#defence-bar:not([hidden])"), null, { timeout: 60000 });
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      s.players[0].alloy = 3000;
      s.command({ team: 0, type: "armourBuy" });
      s.command({ team: 0, type: "armourUpgrade", squad: 1 });
      s.command({ team: 0, type: "armourUpgrade", squad: 1, branch: "assault" });
      f.select(s.armourUnits(1).map((e) => e.id));
      f.view.focusOn(s.armourUnits(1)[0].x, s.armourUnits(1)[0].z);
    });
    if (mobile) await page.evaluate(() => document.querySelector("#dock-tabs [data-dock=\"actions\"]")?.click());
    await page.waitForSelector('#commands [data-defence-armour="combined"]:not(:disabled)', { timeout: TIMEOUT.step });
    const tile = await page.evaluate(() => {
      const t = document.querySelector('#commands [data-defence-armour="combined"]'), b = t.getBoundingClientRect();
      return { w: b.width, h: b.height, sub: t.querySelector("small").textContent.trim(), name: t.querySelector("span").textContent, cost: t.dataset.cost, hint: document.querySelector("#command-hint").textContent };
    });
    assert.ok(tile.w >= 44 && tile.h >= 44, `${viewport}: Combined tile ${tile.w}x${tile.h}`);
    assert.equal(tile.name, "Combined");
    assert.equal(tile.cost, "320");
    assert.ok(tile.sub.length <= 10, `${viewport}: sub-line "${tile.sub}"`);
    assert.match(tile.hint, /Combined/);
    assert.deepEqual(await tinyText(page, "#commands"), [], `${viewport}: squad sheet text under 11 px`);
    assert.equal(await sideScroll(page), false, `${viewport}: no sideways scroll on the squad sheet`);
    await shot(page, `army-depth-combined-${viewport}`);
    await tap('#commands [data-defence-armour="combined"]');
    await page.waitForFunction(() => window.__frontier.sim.armourUnits(1).every((e) => e.combined) && document.querySelector('#commands [data-defence-armour="combined-done"]'), null, { timeout: TIMEOUT.step });
    assert.ok(await page.evaluate(() => window.__frontier.sim.commandLog.some((c) => c.type === "armourUpgrade" && c.combined === true)), "through the command log");
    assert.equal(await page.evaluate(() => window.__frontier.sim.armourUnits(1)[0].leash), 9);
    await shot(page, `army-depth-combined-done-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
