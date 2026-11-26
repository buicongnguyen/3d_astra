// Field Guide 3D view (W5, src/unit-viewer.js): on desktop and phones the guide page of units from several
// factions (an air unit and wheeled ones among them) shows the real model on a non-blank canvas, Walk moves
// legs or wheels, Fire poses the barrel / turret / kneel and fires, the colour cycles, Size adds a Ranger, the
// panel fits the phone layout rules, closing the guide frees the renderer and its context, and the game draws
// exactly as before. Context loss falls back to the 2D portrait. No fixed sleeps: every wait is a waitForFunction.
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
// Breaker: barrel snap; Tank: turret; Scorcher (Ashfall) and Rider (Sunward): wheels; Hawk: air; Walker (Wardens): legs.
// Visual round V (2026-11-26) rebuilt the faction-unique models: the Supply wagon (rolling spoked wheels), the
// Sentinel drone (hover, emitters) and the Watcher (kneeling rail rifle) are shown too.
const DESKTOP_UNITS = ["ranger", "tank", "breaker", "scorcher", "rider", "hawk", "walker", "wagon", "drone", "watcher", "hq"];
const PHONE_UNITS = ["ranger", "scorcher", "hawk"];
const VIEWS = [
  { name: "desktop", size: "desktop", units: DESKTOP_UNITS, full: true },
  { name: "portrait", size: { width: 390, height: 844, mobile: true }, units: PHONE_UNITS, dpr: 3, reduced: true },
  { name: "landscape", size: { width: 844, height: 390, mobile: true }, units: ["tank", "rider"] },
  { name: "small", size: { width: 320, height: 568, mobile: true }, units: ["breaker"] },
  { name: "small-landscape", size: { width: 667, height: 375, mobile: true }, units: ["walker"] },
];

// The 3D panel follows the phone layout rules: stage ≥ 220 px on phones, buttons ≥ 44 px, text ≥ 11 px, no sideways scroll.
async function layout(page, mobile) {
  return page.evaluate((mobile) => {
    const panel = document.querySelector(".field-guide .unit-3d"), stage = panel.querySelector(".unit-3d-stage");
    const bad = [];
    const s = stage.getBoundingClientRect();
    if (mobile && s.height < 219.5) bad.push(`stage ${s.height}px tall`);
    for (const b of panel.querySelectorAll("button")) {
      const r = b.getBoundingClientRect();
      if (r.height < 43.5 || r.width < 43.5) bad.push(`button ${b.textContent.trim()} ${r.width}x${r.height}`);
      if (b.scrollWidth > b.clientWidth + 1) bad.push(`button ${b.textContent.trim()} text spills`);
    }
    for (const el of panel.querySelectorAll("h3, p, button, button *")) {
      if (!el.textContent.trim()) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 11) bad.push(`${el.tagName} "${el.textContent.trim().slice(0, 20)}" ${size}px`);
    }
    const article = document.querySelector("#guide-detail");
    if (article.scrollWidth > article.clientWidth + 1) bad.push(`guide scrolls sideways ${article.scrollWidth}/${article.clientWidth}`);
    if (document.scrollingElement.scrollWidth > innerWidth + 1) bad.push("page scrolls sideways");
    return bad;
  }, mobile);
}

const viewerState = (page) => page.evaluate(() => document.querySelector(".field-guide").viewer?.state() ?? null);
async function showUnit(page, type) {
  await page.locator("#guide-entry").selectOption(type);
  await page.waitForFunction((type) => { const v = document.querySelector(".field-guide").viewer; return v?.state().type === type && v.state().frames > 1 && document.querySelector(".unit-3d").classList.contains("live"); },
    type, { timeout: TIMEOUT.models });
  await page.locator(".unit-3d").scrollIntoViewIfNeeded();
}
const press = async (page, mobile, selector) => { const b = page.locator(selector); if (mobile) await b.tap(); else await b.click(); };

// Main renderer numbers, drawn now in the held, paused-clock scene (deterministic between the two reads).
const gameDraw = (page) => page.evaluate(() => {
  const v = window.__frontier.view, r = v.renderer;
  r.render(v.scene, v.camera);
  return { calls: r.info.render.calls, triangles: r.info.render.triangles, geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs.length,
    canvases: document.querySelectorAll("canvas").length };
});

await suite("unit-viewer", async () => {
  // UNIT_VIEWER_ONLY=portrait,landscape runs a subset (local debugging).
  for (const spec of VIEWS.filter((v) => !process.env.UNIT_VIEWER_ONLY || process.env.UNIT_VIEWER_ONLY.split(",").includes(v.name))) {
    const { page, mobile, errors, goto, ready } = await openPage(browser, spec.size, spec.dpr ? { deviceScaleFactor: spec.dpr } : {});
    if (spec.reduced) await page.emulateMedia({ reducedMotion: "reduce" }); // no auto-turn; motions still play on demand
    await goto();
    await ready();
    await page.locator("#start")[mobile ? "tap" : "click"]();
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    await page.evaluate(() => { const f = window.__frontier; f.hold = true; f.sim.aiEnabled = false; f.select([f.sim.own(0).find((e) => e.type === "ranger")?.id].filter(Boolean)); });
    const openGuide = async () => {
      await page.keyboard.press("i");
      await page.waitForFunction(() => document.querySelector(".field-guide").open && window.__frontier.paused, null, { timeout: TIMEOUT.step });
    };
    const closeGuide = async () => {
      await press(page, mobile, "#guide-close");
      await page.waitForFunction(() => !document.querySelector(".field-guide").open && !document.querySelector(".field-guide").viewer, null, { timeout: TIMEOUT.step });
    };
    // First pass: every unit of this viewport; models a match had not loaded yet join the game's cache here.
    await openGuide();
    for (const type of spec.units) {
      await showUnit(page, type);
      const probe = await page.evaluate(() => document.querySelector(".field-guide").viewer.probe());
      assert.ok(probe.lit > 0.02 && probe.colours > 6, `${spec.name} ${type}: the canvas shows a model (${JSON.stringify(probe)})`);
      const s = await viewerState(page);
      assert.equal(s.type, type);
      assert.ok(s.memory.geometries > 2, `${type}: the real model's parts are drawn (${s.memory.geometries} geometries)`);
      if (mobile) assert.ok(s.pixelRatio <= 1.5, `phone pixel ratio capped (${s.pixelRatio})`);
      if (spec.reduced) assert.equal(s.autoTurn, false, "reduced motion: no auto-turn");
      assert.deepEqual(await layout(page, mobile), [], `${spec.name} ${type} layout`);
      if (spec.full || type === spec.units[0]) await shot(page, `unit-viewer-${spec.name}-${type}`);
      if (spec.full && type === "tank") {
        // Orbit: drag turns (and stops the slow auto-turn), the wheel zooms within its clamp, a double-click resets.
        const box = await page.locator(".unit-3d-canvas").boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy + 30, { steps: 4 }); await page.mouse.up();
        let o = await viewerState(page);
        assert.ok(!o.autoTurn && Math.abs(o.orbit.yaw - 0.65) > 0.3, `drag turns the view (${JSON.stringify(o.orbit)})`);
        for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 400);
        o = await viewerState(page);
        assert.equal(o.orbit.zoom, 2.2, "zoom out stops at the clamp");
        await page.mouse.dblclick(cx, cy);
        await page.waitForFunction(() => { const o = document.querySelector(".field-guide").viewer.state().orbit; return o.zoom === 1 && o.yaw === 0.65; }, null, { timeout: TIMEOUT.step });
      }
      if (type === "hq") {
        assert.equal(await page.locator('[data-view-motion="walk"]').isDisabled(), true, "buildings do not walk");
        continue;
      }
      // Walk / Drive / Fly: legs swing or wheels roll (the shader pose moves), flyers keep hovering.
      await press(page, mobile, '[data-view-motion="walk"]');
      const before = await viewerState(page);
      await page.waitForFunction((b) => {
        const s = document.querySelector(".field-guide").viewer.state();
        return s.mode === "walk" && (s.motion ? Math.abs(s.motion[0] - b.motion[0]) > 0.3 && (s.motion[1] > 0.05 || s.motion[0] > 0.3) : s.stride > b.stride + 0.3);
      }, before, { timeout: TIMEOUT.step });
      if (type === "hawk") assert.ok((await viewerState(page)).lift > 1 && s.spins > 0, "the flyer hovers with turning rotors");
      // Fire: the unit's own firing pose and at least one shot (a healer, the Supply wagon, has no Fire).
      if (type === "wagon") assert.equal(await page.locator('[data-view-motion="fire"]').isDisabled(), true, "the Supply wagon heals: no Fire");
      else {
        await press(page, mobile, '[data-view-motion="fire"]');
        await page.waitForFunction((type) => {
          const s = document.querySelector(".field-guide").viewer.state();
          if (s.mode !== "fire" || s.shots < 1) return false;
          if (type === "ranger" || type === "watcher") return s.motion[2] > 0.6; // kneels to fire
          if (type === "tank") return s.turret > 0.4; // turret swings to the target
          if (type === "breaker") return s.barrel.elevation > 0.18; // barrel lifted and run out, snapping on each shot
          return true;
        }, type, { timeout: TIMEOUT.step });
      }
      if (spec.full && type === "breaker") await shot(page, "unit-viewer-desktop-breaker-fire");
      // Team colour cycles to another colour.
      const paint = (await viewerState(page)).paint;
      await press(page, mobile, "[data-view-colour]");
      await page.waitForFunction((paint) => document.querySelector(".field-guide").viewer.state().paint !== paint, paint, { timeout: TIMEOUT.step });
      // Size: a Ranger stands beside it.
      if (type !== "ranger" && (spec.full || type === spec.units[0])) {
        await press(page, mobile, "[data-view-size]");
        await page.waitForFunction(() => document.querySelector(".field-guide").viewer.state().size, null, { timeout: TIMEOUT.step });
        await shot(page, `unit-viewer-${spec.name}-${type}-size`);
        await press(page, mobile, "[data-view-size]");
        await page.waitForFunction(() => !document.querySelector(".field-guide").viewer.state().size, null, { timeout: TIMEOUT.step });
      }
      await press(page, mobile, '[data-view-motion="idle"]');
    }
    await closeGuide();
    let report = await page.evaluate(() => document.querySelector(".field-guide").viewerReport);
    // Every geometry and texture this view made is freed before the context goes (three's PMREM keeps one
    // render-target texture on its counter after dispose; the context loss releases it with the rest).
    assert.ok(report.memory.geometries === 0 && report.memory.textures <= 1 && report.contextLost, `closing frees the 3D view (${JSON.stringify(report)})`);
    // Second pass on the same units: the game draws and holds exactly the same before and after.
    const game0 = await gameDraw(page);
    await openGuide();
    assert.equal(await page.evaluate(() => window.__frontier.paused), true, "the match stays paused under the guide");
    for (const type of spec.units.slice(0, 2)) await showUnit(page, type);
    await closeGuide();
    const game1 = await gameDraw(page);
    assert.deepEqual(game1, game0, "the game's draws, memory, programs and canvases are unchanged after the guide closes");
    assert.equal(await page.locator(".unit-3d-canvas").count(), 0, "no canvas left behind");
    if (spec.full) {
      // Context loss: the panel falls back to the portrait and the renderer goes.
      await openGuide();
      await showUnit(page, "tank");
      await page.evaluate(() => document.querySelector(".field-guide").viewer.renderer.getContext().getExtension("WEBGL_lose_context").loseContext());
      await page.waitForFunction(() => document.querySelector(".unit-3d").classList.contains("failed") && !document.querySelector(".field-guide").viewer, null, { timeout: TIMEOUT.step });
      assert.equal(await page.locator(".unit-3d-fallback .portrait-art").isVisible(), true, "the 2D portrait shows instead");
      await shot(page, "unit-viewer-desktop-context-lost");
      // The next page tries 3D again.
      await page.locator("#guide-entry").selectOption("ranger");
      await page.waitForFunction(() => document.querySelector(".field-guide").viewer?.state().type === "ranger", null, { timeout: TIMEOUT.models });
      await closeGuide();
      report = await page.evaluate(() => document.querySelector(".field-guide").viewerReport);
      assert.equal(report.memory.geometries, 0);
    }
    assert.deepEqual(errors, [], `${spec.name}: no page errors`);
    await page.close();
  }
}, { browser });
