// AAA round 4, P1 "Wild frontier: the desert test" in the browser at 1440x900, 390x844 and 844x390:
//  - the Battle rules row "Wild frontier": Off / On, 44 px taps, no text under 11 px, greyed out off
//    Amber Dunes, and On reaching the sim (`rules.wild`, the Spire ring and the nest guards);
//  - in the match, the Weather button is on screen at once (not behind any menu): 44 px or more, text
//    11 px or more, inside the viewport, not over the phone dock, "Take Spire" until the Spire is held;
//  - held and armed, ONE tap on the button starts the aim and one tap on the map calls the storm through
//    the command log; the storm then lands after its warning (sim.wild.storms), and the button recharges;
//  - the Dune Wyrm's Ambush ripple and burst, and the nest ring, draw without a page error.
// Screenshots: test-results/wild-desert-*.png, or the folder in WILD_SHOTS (the round-4 results folder),
// plus a four-frame strip of the storm (warning, landing, full, a Wyrm's ripple) per viewport.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { launchBrowser, openPage, suite, TIMEOUT, OUTPUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const OUT = process.env.WILD_SHOTS || OUTPUT;
mkdirSync(OUT, { recursive: true });
const tinyText = (page, selector, min = 11) => page.evaluate(([selector, min]) => [...document.querySelectorAll(`${selector}, ${selector} *`)].filter((el) => el.offsetParent !== null && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < min).map((el) => el.textContent), [selector, min]);
const box = (page, selector) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; }, selector);

await suite("wild-desert", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, errors, tap, goto, ready, mobile } = await openPage(browser, viewport, { timeout: TIMEOUT.models });
    await goto();
    await ready();

    // The rule row: on another battlefield it is greyed out; on Amber Dunes it is live.
    const row = '#battle-rules [data-rule="wild"]';
    await page.waitForSelector(row);
    await page.selectOption("#scenario", "classic");
    await page.waitForFunction((row) => document.querySelector(row).classList.contains("rule-off-map"), row);
    await page.selectOption("#scenario", "dunes");
    await page.waitForFunction((row) => !document.querySelector(row).classList.contains("rule-off-map") && window.__frontier.sim.terrain.id === "dunes", row);
    const buttons = await page.evaluate((row) => [...document.querySelectorAll(`${row} [data-rule-value]`)].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.ruleValue, w: r.width, h: r.height }; }), row);
    assert.deepEqual(buttons.map((b) => b.id), ["off", "on"]);
    for (const b of buttons) assert.ok(b.w >= 44 && b.h >= 44, `${viewport}: rule tap ${b.w}x${b.h}`);
    assert.deepEqual(await tinyText(page, row), [], `${viewport}: rule text under 11 px`);
    assert.equal(await page.evaluate(() => !window.__frontier.sim.wild), true, "off by default");
    await page.locator(`${row} [data-rule-value="on"]`).scrollIntoViewIfNeeded();
    await tap(`${row} [data-rule-value="on"]`);
    await page.waitForFunction(() => window.__frontier.sim.rules?.wild === "on" && !!window.__frontier.sim.wild);
    const setup = await page.evaluate(() => { const s = window.__frontier.sim; return { spire: !!Object.values(s.skirmishPoints).find((p) => p.wild === "spire"), guards: s.entities.filter((e) => e.team === -2).length }; });
    assert.deepEqual(setup, { spire: true, guards: 16 }); // two home nests of 3 and two Elder nests of 5
    await page.locator(row).screenshot({ path: `${OUT}/wild-desert-rule-${viewport}.png` });

    // Start the match; the clock is held so every check below sees the state it set.
    await page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: 60000 });
    await page.evaluate(() => { window.__frontier.hold = true; });
    await page.waitForSelector("#weather-power:not([hidden])", { timeout: TIMEOUT.step });
    const vw = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    const b0 = await box(page, "#weather-power");
    assert.ok(b0.w >= 44 && b0.h >= 44, `${viewport}: Weather button ${b0.w}x${b0.h}`);
    assert.ok(b0.x >= 0 && b0.y >= 0 && b0.right <= vw.w && b0.bottom <= vw.h, `${viewport}: Weather button on screen ${JSON.stringify(b0)}`);
    // It never sits on the dock or the top bar (the phone dock heights are fixed and must stay so).
    const overlaps = await page.evaluate(() => {
      const w = document.querySelector("#weather-power").getBoundingClientRect();
      return [".bottom-dock", ".topbar", "#dock-tabs", ".touch-controls"].filter((s) => {
        const el = document.querySelector(s);
        if (!el || el.offsetParent === null) return false;
        const r = el.getBoundingClientRect();
        return r.width && r.height && w.left < r.right && w.right > r.left && w.top < r.bottom && w.bottom > r.top;
      });
    });
    assert.deepEqual(overlaps, [], `${viewport}: the Weather button covers ${overlaps.join(", ")}`);
    assert.deepEqual(await tinyText(page, "#weather-power"), [], `${viewport}: Weather text under 11 px`);
    assert.equal((await page.textContent("#weather-power .wp-sub")).trim(), "Take Spire");

    // Not held: a tap pans to the Spire and says how (it does not open an aim).
    await tap("#weather-power");
    assert.equal(await page.evaluate(() => window.__frontier.mode), null);

    // Held and armed: one tap on the button, one on the map.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      Object.values(s.skirmishPoints).find((p) => p.wild === "spire").owner = 0;
      f.step(0.5);
      s.wild.readyAt = s.time;
      f.step(0.05);
      // Look at the open ground south-east of the Spire, where the storm will land.
      f.view.focusOn(6, -8);
    });
    await page.waitForFunction(() => document.querySelector("#weather-power").classList.contains("ready"), null, { timeout: TIMEOUT.step });
    assert.equal((await page.textContent("#weather-power .wp-sub")).trim(), "Ready");
    await page.screenshot({ path: `${OUT}/wild-desert-ready-${viewport}.png` });
    await tap("#weather-power");
    assert.equal(await page.evaluate(() => window.__frontier.mode), "weather", `${viewport}: one tap starts the aim`);
    const canvas = await box(page, "#world canvas");
    const target = await page.evaluate(() => { const r = document.querySelector("#world canvas").getBoundingClientRect(), v = window.__frontier.view; return { x: r.left + r.width / 2, y: r.top + r.height * 0.45 }; });
    if (mobile) await page.touchscreen.tap(target.x, target.y);
    else await page.mouse.click(target.x, target.y);
    await page.waitForFunction(() => window.__frontier.sim.wild.storms.length === 1, null, { timeout: TIMEOUT.step });
    const logged = await page.evaluate(() => window.__frontier.sim.commandLog.filter((c) => c.type === "weather").length);
    assert.equal(logged, 1, "the storm went through the command log");
    assert.equal(await page.evaluate(() => window.__frontier.mode), null, "the aim ends with the call");
    assert.ok(canvas.w > 0);

    // The storm: warning, landing, full. Frames for the strip.
    const frames = [];
    const frame = async (name) => { const path = `${OUT}/wild-desert-${name}-${viewport}.png`; await page.screenshot({ path }); frames.push(path); };
    await page.evaluate(() => { const s = window.__frontier.sim, st = s.wild.storms[0]; window.__frontier.view.focusOn(st.x, st.z); window.__frontier.step(1.5); });
    await page.waitForTimeout(250);
    await frame("storm-warning");
    await page.evaluate(() => window.__frontier.step(1.8));
    await page.waitForTimeout(250);
    await frame("storm-landing");
    // Enemy units inside are Sandblind; the button recharges.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, st = s.wild.storms[0];
      for (let i = 0; i < 3; i++) s.spawn("vanguard", 1, st.x + 3 + i, st.z + 2);
      f.step(1.2);
    });
    const storm = await page.evaluate(() => { const s = window.__frontier.sim, st = s.wild.storms[0]; return { active: s.time >= st.at && s.time < st.until, blind: s.entities.filter((e) => e.team === 1 && e.type === "vanguard" && s.hasStatus(e, "sandblind")).length }; });
    assert.ok(storm.active, "the storm landed after its warning");
    assert.equal(storm.blind, 3, "enemies inside are Sandblind");
    await page.waitForTimeout(250);
    await frame("storm-full");
    assert.match((await page.textContent("#weather-power .wp-sub")).trim(), /^\d+ s$/, "recharging seconds");

    // A tamed Wyrm under the player's command: Ambush on an enemy tank (ripple, then the burst).
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      const w = s.spawn("wyrm", 0, -20, -10, true, true), t = s.spawn("tank", 1, -10, -14, true, true);
      s.updateVision();
      w.abilityAt = 0;
      f.view.focusOn(-14, -12);
      f.step(0.6);
    });
    await page.waitForFunction(() => window.__frontier.sim.entities.some((e) => e.type === "wyrm" && e.burrow), null, { timeout: TIMEOUT.step }).catch(() => {});
    await page.waitForTimeout(300);
    await frame("ambush-ripple");
    await page.evaluate(() => window.__frontier.step(1.6));
    const burst = await page.evaluate(() => { const s = window.__frontier.sim, w = s.entities.find((e) => e.type === "wyrm"); return { burrow: !!w?.burrow, near: w ? Math.hypot(w.x + 10, w.z + 14) : 99 }; });
    assert.equal(burst.burrow, false, "the Wyrm burst up");
    assert.ok(burst.near < 4, `the Wyrm came up under the tank (${burst.near.toFixed(1)} m)`);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/wild-desert-ambush-${viewport}.png` });

    // The nest, explored.
    await page.evaluate(() => { const f = window.__frontier, s = f.sim, n = s.wild.nests[0]; s.explored[0].fill(1); s.spawn("ranger", 0, n.x + 6, n.z + 6); s.updateVision(); f.view.focusOn(n.x, n.z); f.step(0.5); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/wild-desert-nest-${viewport}.png` });

    // The strip: four frames side by side (a GIF-like sequence for the results page).
    const strip = await browser.newPage({ viewport: { width: 1600, height: 420 } });
    await strip.setContent(`<body style="margin:0;background:#120c08;display:flex;gap:6px;padding:6px">${frames.map((p) => `<img src="data:image/png;base64,${readFileSync(p).toString("base64")}" style="height:400px;width:auto;max-width:394px;object-fit:cover">`).join("")}</body>`);
    await strip.screenshot({ path: `${OUT}/wild-desert-strip-${viewport}.png` });
    await strip.close();

    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });

