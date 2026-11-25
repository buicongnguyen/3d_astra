// W13 (2026-11-25): the phone HUD in the browser.
//   1. HUD coverage (tests/lib/hud-coverage.mjs: the share of the screen the interface paints, translucent glass by
//      its alpha) with nothing selected, a mixed army, the Command core and in Defence, at 390x844, 844x390 and
//      667x375, measured with the notice line empty: under 30 % in every state at every size (667x375 since the shorter
//      small-landscape card, phone-hud-slim.css rule 5; it was 36 % with a group or a building selected).
//      A routine notice settles to one line after 2.5 s; an alert stays in full.
//   2. Settings → Controls → Hand and Display → Minimap side, chosen in the sheet on a phone: the touch row, the flag,
//      Map, the idle buttons and the landscape dock mirror; the minimap takes the right corner; every HUD tap target
//      stays 44 px, text 11 px; both survive a reload.
//   3. Two-finger twist (real touch events through CDP): a rotate turns the camera yaw, a pinch alone does not
//      (it zooms); Defence ignores the twist.
// Screenshots: test-results/phone-hud-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";
import { hudCoverage } from "./lib/hud-coverage.mjs";
import { openSettings, closeSettings, choose } from "./lib/settings-sheet.mjs";

const browser = await launchBrowser();
const SIZES = { portrait: { width: 390, height: 844, mobile: true }, landscape: { width: 844, height: 390, mobile: true }, small: { width: 667, height: 375, mobile: true } };
const KEY = "frontier-command.settings.v1";

async function startMatch(page, mode = "skirmish") {
  if (mode === "defence") {
    await page.locator('[data-mode="defence"]').first().tap();
    await page.waitForSelector("#defence-setup .defence-levels", { timeout: TIMEOUT.step });
  }
  await page.locator("#start").tap();
  await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
  await page.evaluate(() => { window.__frontier.sim.aiEnabled = false; window.__frontier.hold = true; });
}
// A selection state, then wait until the layout has settled (the notice line empty and faded, no transition running).
async function pick(page, state) {
  await page.evaluate((state) => {
    const f = window.__frontier, mine = f.sim.own(0);
    f.clearMessages();
    if (state === "none" || state === "defence") f.select([]);
    if (state === "mixed") f.select(mine.filter((e) => e.kind === "unit").map((u) => u.id));
    if (state === "building") f.select([mine.find((e) => e.type === "hq").id]);
    // A selection speaks a unit reply; its subtitle is transient like the notice and is measured in tests/captions.mjs.
    f.audio?.captions?.clear();
  }, state);
  await page.waitForFunction(() => {
    const n = document.querySelector("#notice");
    return !n.classList.contains("show") && getComputedStyle(n).opacity === "0" && !document.getAnimations().some((a) => a instanceof CSSTransition && a.playState === "running");
  }, null, { timeout: TIMEOUT.step });
}
// Every visible HUD button: 44 px or more, and no HUD text under 11 px.
const AUDIT = () => {
  const bad = [];
  const hud = [...document.querySelectorAll(".topbar, .touch-controls, .bottom-dock, #dock-tabs, #mission-toggle, #idle-chips")];
  for (const root of hud) for (const b of root.querySelectorAll("button")) {
    if (!b.getClientRects().length || getComputedStyle(b).visibility === "hidden") continue;
    const r = b.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${b.id || b.textContent.trim().slice(0, 12)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  for (const root of hud) for (const el of root.querySelectorAll("*")) {
    if (!el.getClientRects().length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el);
    if (s.visibility !== "hidden" && parseFloat(s.fontSize) < 10.95 && parseFloat(s.fontSize) > 0) bad.push(`text ${el.textContent.trim().slice(0, 12)} ${s.fontSize}`);
  }
  return bad;
};
const box = (page, selector) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: innerWidth - r.right, top: r.top, bottom: innerHeight - r.bottom, width: r.width }; }, selector);

await suite("phone-hud", async () => {
  // ---- 1. Coverage ----
  const table = [];
  for (const [name, size] of Object.entries(SIZES)) {
    for (const mode of ["skirmish", "defence"]) {
      const { page, goto, ready, errors } = await openPage(browser, size);
      await goto(); await ready();
      await startMatch(page, mode);
      const states = mode === "skirmish" ? ["none", "mixed", "building"] : ["defence"];
      for (const state of states) {
        await pick(page, state);
        const { pct } = await page.evaluate(hudCoverage, {});
        table.push([name, state, pct]);
        assert.ok(pct < 30, `${name} ${state}: HUD covers ${pct.toFixed(1)} % (under 30 %)`);
        assert.deepEqual(await page.evaluate(AUDIT), [], `${name} ${state}: 44 px taps, 11 px text`);
        if (state !== "defence") await shot(page, `phone-hud-${name}-right-${state}`);
      }
      if (mode === "skirmish") {
        // A routine notice: in full first, then one line on lighter glass; an alert stays in full.
        await pick(page, "none");
        const base = (await page.evaluate(hudCoverage, {})).pct;
        await page.evaluate(() => window.__frontier.notice("Meridian is online. Assign Harvesters to the amber alloy deposits."));
        await page.waitForFunction(() => getComputedStyle(document.querySelector("#notice")).opacity === "1", null, { timeout: TIMEOUT.step });
        const lines = () => page.evaluate(() => { const n = document.querySelector("#notice"); return Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight)); });
        const fresh = (await page.evaluate(hudCoverage, {})).pct;
        const freshLines = await lines();
        await page.waitForFunction(() => document.querySelector("#notice").classList.contains("settled"), null, { timeout: TIMEOUT.step });
        await page.waitForFunction(() => !document.getAnimations().some((a) => a instanceof CSSTransition && a.playState === "running" && a.effect?.target?.id === "notice"), null, { timeout: TIMEOUT.step });
        const settled = (await page.evaluate(hudCoverage, {})).pct;
        assert.ok(freshLines >= 1 && (await lines()) <= freshLines, `${name}: the notice settles to fewer lines`);
        assert.ok(settled < fresh, `${name}: a settled notice covers less (${(fresh - base).toFixed(1)} -> ${(settled - base).toFixed(1)} %)`);
        await page.evaluate(() => window.__frontier.alertNotice("Your base is under attack!"));
        await page.waitForFunction(() => document.querySelector("#notice").classList.contains("warning"), null, { timeout: TIMEOUT.step });
        assert.equal(await page.evaluate(() => document.querySelector("#notice").classList.contains("settled")), false, `${name}: an alert never settles`);
        table.push([name, "notice fresh -> settled (added)", fresh - base, settled - base]);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  for (const name of Object.keys(SIZES)) {
    const rows = table.filter(([n, s]) => n === name && !s.startsWith("notice"));
    const mean = rows.reduce((a, [, , p]) => a + p, 0) / rows.length;
    assert.ok(mean < 30, `${name}: mean coverage ${mean.toFixed(1)} % (under 30 %)`);
  }
  console.log("HUD coverage (%):\n" + table.map(([n, s, a, b]) => `  ${n.padEnd(9)} ${s.padEnd(32)} ${a.toFixed(1)}${b === undefined ? "" : ` -> ${b.toFixed(1)}`}`).join("\n"));

  // ---- 2. Hand and Minimap side ----
  for (const name of ["portrait", "landscape", "small"]) {
    const { page, goto, ready, errors } = await openPage(browser, SIZES[name]);
    await goto(); await ready();
    await openSettings(page, "controls", { touch: true });
    await choose(page, "handedness", "left", { touch: true });
    await openSettings(page, "display", { touch: true });
    assert.equal(await page.locator('.settings-panel [data-setting="minimapSide"][data-value="right"]').getAttribute("aria-pressed"), "true", `${name}: Left hand moves the minimap right`);
    await closeSettings(page, { touch: true });
    let stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
    assert.deepEqual([stored.handedness, stored.minimapSide], ["left", "right"], `${name}: saved`);
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("left-handed") && document.documentElement.classList.contains("minimap-right")), true, `${name}: kept after a reload`);
    await startMatch(page);
    for (const state of ["none", "mixed", "building"]) {
      await pick(page, state);
      const W = SIZES[name].width;
      const row = await box(page, ".touch-controls"), flag = await box(page, "#mission-toggle");
      if (name === "portrait") {
        assert.ok(row.right <= 12 && row.left > 40, `${name} ${state}: the touch row stands at the right edge ${JSON.stringify(row)}`);
        assert.ok(flag.left <= 12, `${name} ${state}: the flag at the left edge`);
        const map = await box(page, '#dock-tabs [data-dock="map"]');
        if (state === "none") assert.ok((await box(page, "#dock-tabs")).right <= 12, `${name} ${state}: the tab row ends at the right edge, after the flag`);
        else assert.ok(map && map.left < W / 2, `${name} ${state}: Map on the left half`);
      } else {
        assert.ok(flag.right < W / 2, `${name} ${state}: the flag on the right half ${JSON.stringify(flag)}`);
        const mini = await box(page, ".minimap-panel");
        assert.ok(mini.right <= 12 && mini.left > W / 2, `${name} ${state}: the minimap in the bottom-right corner`);
        if (state !== "none") {
          const deck = await box(page, ".bottom-dock .command-deck");
          assert.ok(deck.left <= 12 && deck.left + deck.width < W - (mini.width + 8), `${name} ${state}: the dock on the left, clear of the minimap ${JSON.stringify(deck)}`);
        }
        if (name === "small") assert.ok(row.right <= 12, `${name} ${state}: the touch row from the right edge`);
      }
      assert.deepEqual(await page.evaluate(AUDIT), [], `${name} ${state} left hand: 44 px taps, 11 px text`);
      const { pct } = await page.evaluate(hudCoverage, {});
      assert.ok(pct < (name === "small" ? 40 : 30), `${name} ${state} left hand: HUD covers ${pct.toFixed(1)} %`);
      await shot(page, `phone-hud-${name}-left-${state}`);
    }
    // Minimap side alone: back to the left while the hand stays left; the left-hand dock then stands beside it.
    if (name !== "portrait") {
      await openSettings(page, "display", { touch: true });
      await choose(page, "minimapSide", "left", { touch: true });
      await closeSettings(page, { touch: true });
      await pick(page, "mixed");
      const mini = await box(page, ".minimap-panel"), deck = await box(page, ".bottom-dock .command-deck");
      assert.ok(mini.left <= 12, `${name}: the minimap back in the left corner`);
      assert.ok(deck.left >= mini.width + 8 + 4, `${name}: the left-hand dock stands beside the minimap ${JSON.stringify(deck)}`);
      stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
      assert.deepEqual([stored.handedness, stored.minimapSide], ["left", "left"]);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }

  // ---- 3. Two-finger twist ----
  for (const mode of ["skirmish", "defence"]) {
    const { page, goto, ready, errors } = await openPage(browser, "portrait");
    await goto(); await ready();
    await startMatch(page, mode);
    await pick(page, mode === "defence" ? "defence" : "none");
    const cdp = await page.context().newCDPSession(page);
    const cx = 195, cy = 380;
    const points = (angle, r) => [{ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), id: 1 }, { x: cx - r * Math.cos(angle), y: cy - r * Math.sin(angle), id: 2 }];
    const gesture = async (steps) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(...steps[0]) });
      for (const s of steps.slice(1)) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(...s) });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const yaw0 = await page.evaluate(() => window.__frontier.view.yaw), zoom0 = await page.evaluate(() => window.__frontier.view.zoom);
    // A pinch out (90 -> 150 px) with a 6° wobble: zooms, never twists.
    await gesture([[0, 90], [0.05, 105], [-0.1, 120], [0.08, 135], [0, 150]]);
    await page.waitForFunction((z) => window.__frontier.view.zoom !== z, zoom0, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate(() => window.__frontier.cameraTwist), 0, `${mode}: a pinch alone does not twist`);
    // A 60° clockwise rotate at a steady span.
    await gesture(Array.from({ length: 13 }, (_, i) => [(i * Math.PI) / 36, 100]));
    if (mode === "skirmish") {
      await page.waitForFunction((y) => Math.abs(window.__frontier.view.yaw - y) > 0.5, yaw0, { timeout: TIMEOUT.step });
      const twist = await page.evaluate(() => window.__frontier.cameraTwist);
      assert.ok(Math.abs(twist - (Math.PI / 3 - Math.PI / 12)) < 0.12, `the camera turned ${(twist * 180 / Math.PI).toFixed(1)}° (45° expected past the 15° dead zone)`);
      // The picture turned with the fingers: a ground point east of the focus moved clockwise around it on screen.
      const spin = await page.evaluate(() => {
        const v = window.__frontier.view, cam = v.camera, f = v.focus, P = (x, z) => { const p = new cam.position.constructor(x, 0, z).project(cam); return [p.x * innerWidth, -p.y * innerHeight]; };
        const now = Math.atan2(P(f.x + 10, f.z)[1] - P(f.x, f.z)[1], P(f.x + 10, f.z)[0] - P(f.x, f.z)[0]);
        const yaw = v.yaw; v.setYaw(yaw - window.__frontier.cameraTwist); cam.updateMatrixWorld();
        const before = Math.atan2(P(f.x + 10, f.z)[1] - P(f.x, f.z)[1], P(f.x + 10, f.z)[0] - P(f.x, f.z)[0]);
        v.setYaw(yaw); cam.updateMatrixWorld();
        return Math.atan2(Math.sin(now - before), Math.cos(now - before));
      });
      assert.ok(spin > 0.3, `the map turned clockwise with the fingers (${(spin * 180 / Math.PI).toFixed(1)}° on screen)`);
      // Picking a Turn in the sheet clears the twist.
      await page.evaluate(() => { window.__frontier.hold = false; });
      await openSettings(page, "camera", { touch: true });
      await choose(page, "cameraTurn", "90", { touch: true });
      await closeSettings(page, { touch: true });
      assert.equal(await page.evaluate(() => window.__frontier.cameraTwist), 0, "a Turn from the sheet resets the twist");
      await page.waitForFunction(() => Math.abs(window.__frontier.view.yaw - Math.PI / 2) < 1e-6, null, { timeout: TIMEOUT.step });
      await shot(page, "phone-hud-portrait-twisted");
    } else {
      assert.equal(await page.evaluate(() => window.__frontier.cameraTwist), 0, "Defence frames its roads itself: no twist");
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
}, { browser });
