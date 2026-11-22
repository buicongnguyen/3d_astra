// Frontier Defence onboarding and readability (AAA round 3, R3-E) at 1440x900, 390x844 and 844x390:
//   - a fresh profile (no Defence win) sees the guided first build: the ring on the glowing pad, then on a
//     crew tile, then on Call wave, each tapped for real; the guide ends, is stored (`guided`), and a
//     second visit does not show it;
//   - crew badges over every crewed tower (one instanced draw, tier rows) and contrast discs under the
//     wave (one instanced draw);
//   - landscape: the Actions panel covers at most 22% of the view width, and collapses to one 44 px button
//     that a new pick opens again;
//   - the result names one concrete next-star hint;
//   - 11 px text, 44 px taps, no sideways scroll, no page errors.
// The match clock is held (window.__frontier.hold) so the real-time first-wave countdown cannot run out on
// a slow runner. Screenshots: test-results/defence-onboarding-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.ONBOARDING_VIEWPORTS || "desktop,portrait,landscape").split(",");
const KEY = "frontier-defence-v1";

const noSideScroll = async (page, where) => {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
};
const tiny = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(`${selector} *`)].filter((el) => el.offsetParent !== null && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.textContent), selector);
const small = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(selector)].filter((el) => el.offsetParent !== null).map((el) => el.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`), selector);

async function startGorge(o) {
  await o.ready();
  await o.tap('[data-mode="defence"]');
  await o.page.waitForSelector("#defence-setup .defence-levels");
  await o.tap('[data-level-id="d-gorge"]');
  await o.page.waitForFunction(() => window.__frontier.sim.missionDef?.id === "d-gorge");
  await o.ready();
  await o.tap("#start");
  await o.page.waitForFunction(() => window.__frontier.started && document.querySelector("#defence-bar:not([hidden])"), null, { timeout: 180000 });
  await o.page.evaluate(() => { window.__frontier.hold = true; });
}
const tapAt = (o, x, y) => (o.mobile ? o.page.touchscreen.tap(x, y) : o.page.mouse.click(x, y));
const guideStep = (page) => page.evaluate(() => document.querySelector("#defence-guide:not([hidden])")?.dataset.step || null);
const meshes = (page) => page.evaluate(() => {
  const out = {};
  window.__frontier.view.scene.traverse((o) => { if (o.name === "DefenceDiscs" || o.name === "DefenceBadges") out[o.name] = o.visible ? o.count : 0; });
  return out;
});

await suite("defence-onboarding", async () => {
  for (const viewport of VIEWPORTS) {
    const o = await openPage(browser, viewport, { timeout: TIMEOUT.models }), { page, errors } = o; // slow runner: a mode switch blocks a tap over 30 s
    // A fresh profile: no Defence progress at all.
    await page.addInitScript(() => { try { if (!sessionStorage.getItem("fresh")) { localStorage.removeItem("frontier-defence-v1"); sessionStorage.setItem("fresh", "1"); } } catch {} });
    await o.goto("guide");
    await startGorge(o);

    // ---- Step 1: the ring sits on the glowing pad; tapping it picks the pad.
    await page.waitForFunction(() => document.querySelector("#defence-guide:not([hidden])")?.dataset.step === "1", null, { timeout: TIMEOUT.step });
    const one = await page.evaluate(() => {
      const f = window.__frontier, mark = document.querySelector("#defence-guide-mark").getBoundingClientRect();
      const pads = f.sim.missionDef.defence.pads, rect = f.view.renderer.domElement.getBoundingClientRect();
      const glow = pads.find((p) => { const s = f.view.project(p.x, p.z, f.view.terrain.heightAt(p.x, p.z) + 0.2); return Math.hypot(s.x + rect.left - (mark.left + mark.width / 2), s.y + rect.top - (mark.top + mark.height / 2)) < 4; });
      return { x: mark.left + mark.width / 2, y: mark.top + mark.height / 2, pad: glow?.id || null, hint: !/Crew the pads/.test(document.querySelector("#commands").textContent) };
    });
    assert.ok(one.pad, `${viewport}: the step-1 ring is on a pad`);
    assert.ok(one.hint, `${viewport}: the plain \"Crew the pads\" hint gives way to the guide`);
    assert.deepEqual(await tiny(page, "#defence-guide"), [], `${viewport}: guide text under 11 px`);
    assert.deepEqual(await small(page, "#defence-guide button"), [], `${viewport}: guide taps under 44 px`);
    await noSideScroll(page, `${viewport} guide`);
    await shot(page, `defence-onboarding-step1-${viewport}`);
    await tapAt(o, one.x, one.y);
    await page.waitForFunction(() => document.querySelector("#defence-guide")?.dataset.step === "2", null, { timeout: TIMEOUT.step });

    // ---- Step 2: the ring is on a crew tile (or the Actions tab on a phone that shows another tab).
    await page.waitForSelector("#commands .guide-target, #dock-tabs .guide-target", { timeout: TIMEOUT.step });
    if (await page.locator("#dock-tabs .guide-target").count()) await o.tap("#dock-tabs .guide-target");
    await page.waitForSelector("#commands [data-defence-crew].guide-target", { timeout: TIMEOUT.step });
    await shot(page, `defence-onboarding-step2-${viewport}`);
    await o.tap("#commands [data-defence-crew].guide-target");
    await page.waitForFunction(() => document.querySelector("#defence-guide")?.dataset.step === "3", null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate((pad) => !!window.__frontier.sim.towerOn(pad), one.pad), true, `${viewport}: the crew stands on the glowing pad`);

    // ---- Step 3: Call wave; the guide ends and is stored.
    assert.equal(await page.evaluate(() => document.querySelector("#defence-call").classList.contains("guide-target")), true, `${viewport}: step 3 rings Call wave`);
    await shot(page, `defence-onboarding-step3-${viewport}`);
    await o.tap("#defence-call");
    await page.waitForFunction(() => !document.querySelector("#defence-guide"), null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).guided, KEY), true, `${viewport}: the guide is stored done`);
    assert.equal(await page.evaluate(() => window.__frontier.sim.defence.wave), 1, `${viewport}: the wave was called`);

    // ---- Badges and discs: towers of every tier and a wave on the road.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, def = s.missionDef.defence;
      s.players[0].alloy = 20000;
      def.pads.slice(0, 6).forEach((p, i) => { if (!s.towerOn(p.id)) s.command({ team: 0, type: "padBuild", pad: p.id, crew: def.crews[i % def.crews.length] }); });
      def.pads.slice(0, 6).forEach((p, i) => { const t = s.towerOn(p.id); for (let k = 0; k < i % 3; k++) s.command({ team: 0, type: "padUpgrade", building: t.id }); });
      f.step(6);
    });
    await page.waitForTimeout(500);
    const drawn = await meshes(page), want = await page.evaluate(() => ({ towers: window.__frontier.sim.entities.filter((e) => e.crew && e.team === 0 && e.hp > 0).length, units: window.__frontier.sim.entities.filter((e) => e.kind === "unit" && e.hp > 0).length }));
    assert.ok(drawn.DefenceBadges >= 1 && drawn.DefenceBadges <= want.towers, `${viewport}: a badge per crewed tower in view (${drawn.DefenceBadges} of ${want.towers})`);
    assert.ok(drawn.DefenceDiscs >= 1 && drawn.DefenceDiscs <= want.units, `${viewport}: discs under the units in view (${drawn.DefenceDiscs} of ${want.units})`);
    await page.evaluate(() => { const f = window.__frontier, e = f.sim.entities.find((x) => x.team === 1 && x.kind === "unit" && x.hp > 0); if (e) f.view.focusOn(e.x, e.z); });
    await page.waitForTimeout(300);
    await shot(page, `defence-onboarding-badges-${viewport}`);

    // ---- Landscape: the Actions panel is at most 22% of the view width and collapses to one button.
    if (viewport === "landscape") {
      await page.evaluate(() => { const f = window.__frontier, t = f.sim.towerOn(f.sim.missionDef.defence.pads[1].id); f.select([t.id]); });
      await o.tap('#dock-tabs [data-dock="selection"]');
      await page.waitForFunction(() => document.querySelector(".command-panel")?.offsetWidth > 0);
      const cover = await page.evaluate(() => {
        const W = innerWidth, boxes = [".command-panel", "#dock-tabs", "#defence-dock-toggle"].map((s) => document.querySelector(s).getBoundingClientRect()).filter((r) => r.width);
        return { share: (W - Math.min(...boxes.map((r) => r.left))) / W, panel: document.querySelector(".command-panel").getBoundingClientRect().width / W };
      });
      console.log(`landscape: Actions panel ${(cover.panel * 100).toFixed(1)}% of the width, the dock column ${(cover.share * 100).toFixed(1)}% (edge gap included)`);
      assert.ok(cover.panel <= 0.22, `Actions panel covers ${(cover.panel * 100).toFixed(1)}% of the width (at most 22%)`);
      assert.ok(cover.share <= 0.235, `the dock column with its edge gap covers ${(cover.share * 100).toFixed(1)}%`);
      assert.deepEqual(await tiny(page, ".command-panel"), [], "landscape: Actions text under 11 px");
      assert.deepEqual(await small(page, ".command-panel #commands button, #dock-tabs button, #defence-dock-toggle"), [], "landscape: dock taps under 44 px");
      await shot(page, `defence-onboarding-dock-${viewport}`);
      await o.tap("#defence-dock-toggle");
      await page.waitForFunction(() => document.documentElement.classList.contains("defence-dock-min"));
      const min = await page.evaluate(() => ({ panel: document.querySelector(".command-panel").offsetWidth, tabs: document.querySelector("#dock-tabs").offsetWidth, toggle: document.querySelector("#defence-dock-toggle").getBoundingClientRect().width, expanded: document.querySelector("#defence-dock-toggle").getAttribute("aria-expanded") }));
      assert.deepEqual(min, { panel: 0, tabs: 0, toggle: 44, expanded: "false" }, "collapsed: one 44 px button");
      await shot(page, `defence-onboarding-collapsed-${viewport}`);
      // A new pick opens the panel again.
      const pad = await page.evaluate(() => { const f = window.__frontier, s = f.sim, p = s.missionDef.defence.pads.find((q) => !s.towerOn(q.id)), r = f.view.renderer.domElement.getBoundingClientRect(); f.view.focusOn(p.x, p.z); f.view.updateCamera(); const q = f.view.project(p.x, p.z, f.view.terrain.heightAt(p.x, p.z) + 0.2); return { x: q.x + r.left, y: q.y + r.top }; });
      await tapAt(o, pad.x, pad.y);
      await page.waitForFunction(() => !document.documentElement.classList.contains("defence-dock-min") && document.querySelector(".command-panel").offsetWidth > 0, null, { timeout: TIMEOUT.step });
      await noSideScroll(page, "landscape dock");
    }

    // ---- Result: a 2-star win names the next star.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, d = s.defence;
      d.wave = s.missionDef.defence.waves.length; d.queue.length = 0; d.lives = 12;
      for (const e of s.entities) if (e.team === 1) e.hp = 0;
      f.hold = false;
    });
    await page.waitForSelector("#modal:not([hidden]) .defence-result .defence-next-star", { timeout: TIMEOUT.step });
    const hint = await page.evaluate(() => { const el = document.querySelector(".defence-next-star"); return { kind: el.dataset.nextStar, text: el.textContent, stars: document.querySelector(".defence-result").dataset.stars }; });
    assert.equal(hint.stars, "2", `${viewport}: 12 lives is two stars`);
    assert.equal(hint.kind, "lives", `${viewport}: the next star is about lives`);
    assert.match(hint.text, /Finish with 18 lives or more \(you kept 12\)/, `${viewport}: the hint names the gold line`);
    assert.ok(/Counter it with|gold tier|rim pad|Call a wave/.test(hint.text), `${viewport}: the hint carries one tip (${hint.text})`);
    assert.deepEqual(await tiny(page, "#modal"), [], `${viewport}: result text under 11 px`);
    assert.deepEqual(await small(page, "#modal .debrief-actions button"), [], `${viewport}: result taps under 44 px`);
    await page.waitForTimeout(900);
    await shot(page, `defence-onboarding-result-${viewport}`);
    await noSideScroll(page, `${viewport} result`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();

    // ---- A second visit: the guide is done, so it does not show (same browser storage).
    const again = await openPage(browser, viewport, { timeout: TIMEOUT.models });
    await again.page.addInitScript(() => { try { localStorage.setItem("frontier-defence-v1", JSON.stringify({ levels: {}, guided: true })); } catch {} });
    await again.goto("guide");
    await startGorge(again);
    await again.page.waitForTimeout(1500);
    assert.equal(await guideStep(again.page), null, `${viewport}: a second visit has no guide`);
    assert.ok(await again.page.evaluate(() => !document.querySelector("#commands [data-guide-hint]")), `${viewport}: no guide hint on the card`);
    assert.deepEqual(again.errors, [], `${viewport}: page errors (second visit)`);
    await again.page.close();
    console.log(`${viewport}: guide 3 steps, badges ${drawn.DefenceBadges}, discs ${drawn.DefenceDiscs}, hint "${hint.text.trim()}"`);
  }
}, { browser });
