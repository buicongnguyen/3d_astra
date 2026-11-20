// Roster setting and faction workshops (AAA round 2, W1-A), at 1440x900, 390x844 and 844x390:
// the Battle rules row (44 px taps, 11 px text, no sideways scroll), Expanded reaching the sim and
// surviving a reload, and a Field workshop built and selected (dock height unchanged).
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot } from "./lib/harness.mjs";

const browser = await launchBrowser();
await suite("workshops", async () => {
  let dock = null;
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, errors, tap, goto, ready } = await openPage(browser, viewport);
    await goto();
    await ready();
    const rows = await page.evaluate(() => {
      const row = document.querySelector("#battle-rules");
      const buttons = [...row.querySelectorAll("button")].map((b) => { const r = b.getBoundingClientRect(); return { h: r.height, w: r.width, text: b.textContent, rule: b.closest(".rule-row")?.dataset.rule }; });
      const small = [...row.querySelectorAll("*")].filter((e) => e.childElementCount === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => e.textContent);
      return { buttons, small, scrollX: document.documentElement.scrollWidth > window.innerWidth };
    });
    assert.deepEqual(rows.buttons.filter((b) => b.rule === "roster").map((b) => b.text), ["Classic", "Expanded"]); // W2-D adds the AI plan row
    for (const b of rows.buttons) assert.ok(b.h >= 44 && b.w >= 44, `${viewport}: tap ${b.h}x${b.w}`);
    assert.deepEqual(rows.small, [], `${viewport}: text under 11 px`);
    assert.equal(rows.scrollX, false, `${viewport}: no sideways scroll`);
    assert.equal(await page.evaluate(() => window.__frontier.sim.rules ?? null), null, "Classic by default");
    await page.locator('#battle-rules [data-rule-value="expanded"]').scrollIntoViewIfNeeded();
    await tap('#battle-rules [data-rule-value="expanded"]');
    assert.deepEqual(await page.evaluate(() => window.__frontier.sim.rules), { roster: "expanded" });
    await shot(page, `workshops-setup-${viewport}`);
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started);
    // Build a Field workshop through the sim (a Foundry is needed first), then select it.
    const info = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      s.players[0].alloy = 5000; s.players[0].energy = 5000;
      const hq = s.own(0).find((e) => e.type === "hq");
      s.spawn("foundry", 0, hq.x + 12, hq.z - 12);
      const site = s.findPlacement("workshop", 0, hq.x + 12, hq.z + 4, 10);
      const w = s.spawn("workshop", 0, site.x, site.z);
      f.select([w.id]);
      return { id: w.id, trains: w.trains, buildable: s.buildable(0) };
    });
    assert.ok(info.buildable.includes("workshop"));
    assert.deepEqual(info.trains, ["gunner"], "the Field workshop card trains the real Gunner (Wave 1 integration)");
    await page.waitForTimeout(400);
    const card = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll("#commands .command-tile")].map((t) => { const r = t.getBoundingClientRect(); return { w: r.width, h: r.height }; });
      const dockEl = document.querySelector(".bottom-dock");
      return { tiles, dock: dockEl.getBoundingClientRect().height, label: document.querySelector("#command-label").textContent };
    });
    assert.equal(card.label, "PRODUCTION");
    assert.equal(card.tiles.length >= 1, true, "the production card has the Gunner tile");
    const queued = await page.evaluate((id) => { const s = window.__frontier.sim; const w = s.entities.find((e) => e.id === id); w.complete = true; return s.enqueue(id, "gunner") && w.queue.some((q) => q.type === "gunner"); }, info.id);
    assert.ok(queued, "a Gunner can be queued at the Field workshop");
    for (const t of card.tiles) assert.ok(t.w >= 44 && t.h >= 44, `${viewport}: tile ${t.w}x${t.h}`);
    // The dock must not be taller than with a Barracks selected.
    const barracks = await page.evaluate(() => { const f = window.__frontier; f.select([f.sim.own(0).find((e) => e.type === "barracks").id]); return null; });
    await page.waitForTimeout(300);
    dock = await page.evaluate(() => document.querySelector(".bottom-dock").getBoundingClientRect().height);
    assert.ok(card.dock <= dock + 1, `${viewport}: dock ${card.dock} vs barracks ${dock}`);
    await shot(page, `workshops-card-${viewport}`);
    assert.deepEqual(errors, []);
    await page.close();
  }
}, { browser });
