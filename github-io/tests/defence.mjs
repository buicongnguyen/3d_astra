// Frontier Defence in the browser (release 0.17) at 1440x900, 390x844 and 844x390:
// the fourth mode button (44 px), the level list with stars, tapping a pad to crew it, upgrading
// to the tier trims, Call wave, a mid-wave field on both levels, the result screen with stars and
// Next level, no embers under motion-off, no sideways scroll and no page errors.
// Screenshots: test-results/defence-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.DEFENCE_VIEWPORTS || "desktop,portrait,landscape").split(",");

// Fails when anything on the page reaches past the right edge of the screen.
async function noSideScroll(page, where) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
}
async function size(locator) {
  const box = await locator.boundingBox();
  assert.ok(box, `visible: ${await locator.evaluate((el) => el.outerHTML.slice(0, 120)).catch(() => "?")}`);
  return box;
}
// A free pad on screen and not under the interface, in client pixels.
async function freePad(page, avoid = []) {
  return page.evaluate((avoid) => {
    const f = window.__frontier, s = f.sim, canvas = f.view.renderer.domElement, r = canvas.getBoundingClientRect();
    for (const p of s.missionDef.defence.pads) {
      if (s.towerOn(p.id) || avoid.includes(p.id)) continue;
      const q = f.view.project(p.x, p.z, f.view.terrain.heightAt(p.x, p.z) + 0.2), x = q.x + r.left, y = q.y + r.top;
      if (x < r.left + 30 || x > r.right - 30 || y < r.top + 30 || y > r.bottom - 30) continue;
      if (document.elementFromPoint(x, y) !== canvas) continue;
      // No other pad within the pick radius: the tap must mean this one.
      if (s.missionDef.defence.pads.some((o) => o !== p && (() => { const w = f.view.project(o.x, o.z, 0.2); return Math.hypot(w.x + r.left - x, w.y + r.top - y) < 30; })())) continue;
      return { id: p.id, x, y };
    }
    return null;
  }, avoid);
}
async function tapAt(page, mobile, x, y) {
  if (mobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}
// Towers on ten pads at all three tiers, then the last wave, stepped until it is on the road.
async function stageWave(page, seconds) {
  await page.evaluate((seconds) => {
    const f = window.__frontier, s = f.sim, def = s.missionDef.defence;
    s.players[0].alloy = 9000;
    def.pads.filter((p) => !s.towerOn(p.id)).slice(0, 10).forEach((p, i) => {
      s.command({ team: 0, type: "padBuild", pad: p.id, crew: def.crews[i % def.crews.length] });
      for (let k = 0; k < i % 3; k++) s.command({ team: 0, type: "padUpgrade", building: s.towerOn(p.id).id });
    });
    // The level's last wave, straight away (a test shortcut through the rules' own wave start).
    s.defence.queue.length = 0;
    s.defence.wave = def.waves.length - 1;
    s.startWave();
    f.step(seconds);
    f.select([]);
  }, seconds);
}

await suite("defence", async () => {
  for (const viewport of VIEWPORTS) {
    const { page, errors, tap, goto, ready, mobile } = await openPage(browser, viewport);
    // A returning player: two stars on Gorge Road.
    await page.addInitScript(() => { try { localStorage.setItem("frontier-defence-v1", JSON.stringify({ levels: { "d-gorge": { stars: 2, lives: 14, difficulty: "standard" } } })); } catch {} });
    await goto();
    await ready();

    // Title: four modes, each a 44 px target.
    const modes = page.locator(".mode-switch [data-mode]");
    assert.equal(await modes.count(), 4);
    for (let i = 0; i < 4; i++) { const b = await size(modes.nth(i)); assert.ok(b.height >= 44 && b.width >= 44, `${viewport}: mode button ${i} ${b.width}x${b.height}`); }
    await shot(page, `defence-title-${viewport}`);
    await noSideScroll(page, `${viewport} title`);

    // The level list with stars.
    await tap('[data-mode="defence"]');
    await page.waitForSelector("#defence-setup .defence-levels");
    assert.equal(await page.locator("#defence-setup [data-level]").count(), 2);
    assert.equal(await page.locator('[data-level-id="d-gorge"] .stars i.on').count(), 2);
    assert.equal(await page.locator('[data-level-id="d-bridges"] .stars i.on').count(), 0);
    for (const b of await page.locator("#defence-setup [data-level]").all()) assert.ok((await size(b)).height >= 44);
    assert.match(await page.locator("#start").textContent(), /Start defence/);
    await page.locator("#defence-setup").scrollIntoViewIfNeeded();
    await shot(page, `defence-levels-${viewport}`);
    await noSideScroll(page, `${viewport} levels`);

    // Gorge Road.
    await page.waitForFunction(() => window.__frontier.modelsReady, null, { timeout: 90000 });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.defence && document.querySelector("#defence-bar:not([hidden])"), null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__frontier.sim.missionDef.id), "d-gorge");
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains("in-defence")));
    for (const id of ["#defence-call", "#defence-overview"]) { const b = await size(page.locator(id)); assert.ok(b.height >= 44 && b.width >= 44, `${viewport}: ${id} ${b.width}x${b.height}`); }
    const tiny = await page.evaluate(() => [...document.querySelectorAll("#defence-bar *")].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12).map((el) => el.textContent));
    assert.deepEqual(tiny, [], `${viewport}: defence bar text under 12 px`);

    // Tap a pad: the crew tiles; pick Rangers: a crewed tower stands on it.
    await page.evaluate(() => { window.__frontier.sim.players[0].alloy = 2000; });
    const pad = await freePad(page);
    assert.ok(pad, `${viewport}: a free pad on screen`);
    await tapAt(page, mobile, pad.x, pad.y);
    await page.waitForFunction(() => document.querySelectorAll("#commands [data-defence-crew]").length === 4, null, { timeout: TIMEOUT.step });
    for (const b of await page.locator("#commands [data-defence-crew]").all()) { const box = await size(b); assert.ok(box.height >= 44 && box.width >= 44, `${viewport}: crew tile ${box.width}x${box.height}`); }
    await shot(page, `defence-pad-${viewport}`);
    await tap('#commands [data-defence-crew="ranger"]');
    await page.waitForFunction((id) => window.__frontier.sim.towerOn(id)?.crew === "ranger", pad.id, { timeout: TIMEOUT.step });
    await page.waitForSelector('#commands[data-tier="1"] [data-defence-act="upgrade"]');

    // Upgrade twice: steel, then gold with the heat glow.
    await tap('#commands [data-defence-act="upgrade"]');
    await page.waitForSelector('#commands[data-tier="2"]');
    await tap('#commands [data-defence-act="upgrade"]');
    await page.waitForSelector('#commands[data-tier="3"] .defence-info[data-tier="3"]');
    assert.equal(await page.evaluate((id) => window.__frontier.sim.towerOn(id).tier, pad.id), 3);
    assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('#commands .defence-info[data-tier="3"]'), "::after").content !== "none"), "tier 3 heat glow");
    // The crew stands on the tower, adopted into the batches (no draws of its own).
    await page.waitForFunction((id) => { const f = window.__frontier, o = f.view.objects.get(f.sim.towerOn(id).id); return !!o?.userData.crew && o.userData.dressed === 3; }, pad.id, { timeout: TIMEOUT.step });
    await shot(page, `defence-tower-${viewport}`);

    // Motion off: an upgrade becoming affordable throws no embers.
    const second = await freePad(page, [pad.id]);
    await page.evaluate(() => document.documentElement.classList.add("motion-off"));
    await page.evaluate((id) => { const s = window.__frontier.sim; s.players[0].alloy = 2000; s.command({ team: 0, type: "padBuild", pad: id, crew: "breaker" }); s.players[0].alloy = 0; window.__frontier.select([s.towerOn(id).id]); }, second.id);
    await page.waitForSelector('#commands[data-tier="1"] [data-defence-act="upgrade"]:disabled', { state: "attached" });
    await page.evaluate(() => { window.__frontier.sim.players[0].alloy = 2000; window.__frontier.step(0.05); });
    await page.waitForSelector('#commands [data-defence-act="upgrade"]:not(:disabled)', { state: "attached" });
    await page.waitForTimeout(200);
    assert.equal(await page.locator(".ember, .ember-burst").count(), 0, `${viewport}: embers under motion-off`);
    await page.evaluate(() => document.documentElement.classList.remove("motion-off"));

    // Call wave: the first wave comes now, for a bonus.
    await page.evaluate(() => { window.__frontier.sim.players[0].alloy = 0; window.__frontier.select([]); });
    await page.waitForFunction(() => !document.querySelector("#defence-call").disabled);
    await tap("#defence-call");
    await page.waitForFunction(() => window.__frontier.sim.defence.wave === 1 && window.__frontier.sim.players[0].alloy > 0, null, { timeout: TIMEOUT.step });

    // Mid-wave on Gorge Road with towers of all three tiers.
    await stageWave(page, 13);
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => window.__frontier.sim.entities.filter((e) => e.team === 1 && e.hp > 0).length > 0), `${viewport}: enemies on the road`);
    await shot(page, `defence-gorge-wave-${viewport}`);
    await noSideScroll(page, `${viewport} gorge`);

    // Hold the last wave: the result with stars, Next level, Retry and Levels.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, d = s.defence;
      d.wave = s.missionDef.defence.waves.length; d.queue.length = 0; d.lives = 19;
      for (const e of s.entities) if (e.team === 1) e.hp = 0;
    });
    // The frame loop runs the next tick, settles the match and opens the result.
    await page.waitForSelector("#modal:not([hidden]) .defence-result", { timeout: 15000 });
    assert.equal(await page.locator(".defence-result").getAttribute("data-stars"), "3");
    assert.equal(await page.locator(".defence-stars i.on").count(), 3);
    for (const b of await page.locator(".defence-result .debrief-actions button").all()) assert.ok((await size(b)).height >= 44);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("frontier-defence-v1")).levels["d-gorge"].stars), 3);
    await page.waitForTimeout(900); // the stars pop in one after another
    await shot(page, `defence-result-${viewport}`);
    await noSideScroll(page, `${viewport} result`);

    // Next level: Twin Bridges, mid-wave.
    await tap("[data-defence-next]");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.missionDef?.id === "d-bridges" && document.querySelector("#defence-bar:not([hidden])"), null, { timeout: 60000 });
    await stageWave(page, 9);
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => window.__frontier.sim.entities.filter((e) => e.team === 1 && e.hp > 0).length > 0), `${viewport}: enemies at the bridges`);
    await shot(page, `defence-bridges-wave-${viewport}`);
    await noSideScroll(page, `${viewport} bridges`);

    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
