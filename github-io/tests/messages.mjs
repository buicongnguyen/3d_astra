// Readable messages: an alert ("Under attack!") is never covered by a counter hint or replaced by a
// routine notice; on phones the hint stays out of the middle third of the screen and leaves by itself.
// Logic: src/message-queue.js (unit-tested in message-queue.test.js); drawing: app/hud.js, ui-extras.css.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const VIEWS = [["desktop", "desktop"], ["portrait", "portrait"], ["landscape", "landscape"], ["small", { width: 320, height: 568, mobile: true }]];

// Box of a selector in page pixels, or null when it is not drawn.
const box = (page, selector) => page.evaluate((selector) => {
  const el = document.querySelector(selector);
  if (!el || el.hidden) return null;
  const s = getComputedStyle(el), r = el.getBoundingClientRect();
  if (s.display === "none" || s.visibility === "hidden" || r.width === 0) return null;
  return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
}, selector);
const overlap = (a, b) => !!a && !!b && a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

// The element on top at the centre of `selector`, with every element hit-testable for a moment
// (the notice and the hint take no pointer events, so elementFromPoint would look through them).
const coveredBy = (page, selector) => page.evaluate((selector) => {
  const el = document.querySelector(selector), r = el.getBoundingClientRect();
  const style = document.createElement("style");
  style.textContent = "* { pointer-events: auto !important; }";
  document.head.append(style);
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  style.remove();
  return el.contains(top) ? null : (top?.id || top?.className || top?.tagName || "nothing");
}, selector);

const browser = await launchBrowser();
await suite("messages", async () => {
  for (const [name, viewport] of VIEWS) {
    const { page, errors, mobile, tap, goto, ready } = await openPage(browser, viewport);
    const size = page.viewportSize();
    await goto();
    await ready();
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    // No raids or rule messages of its own while the suite fires messages by hand; a log of when each
    // text first shows in the notice line.
    await page.evaluate(() => {
      window.__frontier.sim.aiEnabled = false;
      const n = document.querySelector("#notice"), log = window.__noticeLog = [];
      new MutationObserver(() => { if (n.classList.contains("show") && !log.some((e) => e.text === n.textContent)) log.push({ text: n.textContent, t: performance.now() }); })
        .observe(n, { childList: true, characterData: true, subtree: true, attributes: true });
    });

    // A hint and an alert in the same frame (the cloak hint and a hit on the Command core).
    await page.evaluate(() => {
      const s = window.__frontier.sim, hq = s.own(0).find((e) => e.type === "hq");
      s.events.push({ type: "reveal", ambush: true, victim: 0 }, { type: "impact", team: 0, x: hq.x, z: hq.z, building: true, seed: 1 });
    });
    await page.waitForFunction(() => {
      const n = document.querySelector("#notice"), h = window.__frontier.fightHint;
      return n.classList.contains("show") && getComputedStyle(n).opacity === "1" && /Under attack/.test(n.textContent) && h && !h.hidden;
    }, null, { timeout: TIMEOUT.step });
    assert.ok(await page.evaluate(() => document.querySelector("#notice").classList.contains("warning")), `${name}: alert style`);
    const alert = await box(page, "#notice"), hint = await box(page, "#fight-hint");
    assert.ok(alert && hint, `${name}: both drawn`);
    assert.equal(overlap(alert, hint), false, `${name}: hint ${JSON.stringify(hint)} overlaps alert ${JSON.stringify(alert)}`);
    assert.equal(await coveredBy(page, "#notice"), null, `${name}: alert text covered`);
    assert.equal(await coveredBy(page, "#fight-hint .fh-text"), null, `${name}: hint text covered`);
    for (const selector of ["#notice", "#fight-hint .fh-text"])
      assert.ok(await page.evaluate((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize) >= 11, selector), `${name}: ${selector} text 11 px or more`);
    if (mobile) {
      // Never over the middle third of the screen (the band where the fight usually is).
      assert.ok(hint.bottom <= size.height / 3 || hint.y >= size.height * 2 / 3, `${name}: hint ${JSON.stringify(hint)} in the middle third of ${size.height}`);
      assert.ok(hint.h <= 46, `${name}: hint is a thin line (${hint.h} px)`);
      for (const sel of [".topbar", ".touch-controls", "#dock-tabs", ".bottom-dock"]) assert.equal(overlap(hint, await box(page, sel)), false, `${name}: hint over ${sel}`);
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#fight-hint")).pointerEvents), "none");
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${name}: no sideways scroll`);
    await shot(page, `messages-${name}`);

    // A routine notice during the alert waits; it shows once the alert has had its full time.
    await page.evaluate(() => { window.__frontier.sim.events.push({ type: "message", text: "Orders cleared." }); });
    await page.waitForTimeout(300);
    assert.match(await page.locator("#notice").textContent(), /Under attack/, `${name}: alert replaced by a routine notice`);
    await page.waitForFunction(() => document.querySelector("#notice").textContent === "Orders cleared.", null, { timeout: TIMEOUT.step });
    const log = await page.evaluate(() => window.__noticeLog);
    const at = (text) => log.find((e) => e.text === text)?.t;
    assert.ok(at("Orders cleared.") - at("Under attack!") >= 4400, `${name}: the alert stayed its full time: ${JSON.stringify(log)}`);
    assert.equal(await page.evaluate(() => document.querySelector("#notice").classList.contains("warning")), false, `${name}: routine style`);

    // Phones: the hint leaves by itself after about 4 s (desktop keeps it 9 s, with a close button).
    if (mobile) await page.waitForFunction(() => window.__frontier.fightHint.hidden, null, { timeout: 8000 });

    // An alert during targeting stays up and clear of the targeting prompt.
    await page.evaluate(() => {
      const s = window.__frontier.sim, hq = s.own(0).find((e) => e.type === "hq"), banner = document.querySelector("#mode-banner");
      banner.hidden = false;
      banner.textContent = "ATTACK · Choose a visible enemy unit or building";
      s.events.push({ type: "incoming", team: 0, x: hq.x, z: hq.z });
    });
    await page.waitForFunction(() => /Enemy attack incoming/.test(document.querySelector("#notice").textContent) && getComputedStyle(document.querySelector("#notice")).opacity === "1", null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(400); // the notice line moves with a 0.25 s transition
    assert.equal(overlap(await box(page, "#mode-banner"), await box(page, "#notice")), false, `${name}: alert over the targeting prompt`);
    assert.equal(await coveredBy(page, "#notice"), null, `${name}: alert covered during targeting`);
    await page.evaluate(() => { document.querySelector("#mode-banner").hidden = true; });

    // A mission dialogue line, an alert and a hint at once: none of them overlap.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, hq = s.own(0).find((e) => e.type === "hq");
      f.mission.say("commander", "Hold the ridge until the convoy is through. Watch the river crossing.");
      s.events.push({ type: "incoming", team: 0, x: hq.x, z: hq.z });
    });
    // A hint again (the cloak hint is spent for this match), drawn as a counter hint would be.
    await page.evaluate(() => { const h = window.__frontier.fightHint; h.querySelector(".fh-text").textContent = "Your Ranger counters Breaker. Let it lead the fight."; h.hidden = false; });
    await page.waitForFunction(() => /Enemy attack incoming/.test(document.querySelector("#notice").textContent) && !document.querySelector(".dialogue").hidden, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(300);
    const [line, alert2, hint2] = [await box(page, ".dialogue"), await box(page, "#notice"), await box(page, "#fight-hint")];
    assert.ok(line && alert2 && hint2, `${name}: dialogue, alert and hint drawn`);
    assert.equal(overlap(line, alert2), false, `${name}: alert over the dialogue line`);
    assert.equal(overlap(line, hint2), false, `${name}: hint over the dialogue line ${JSON.stringify(hint2)} ${JSON.stringify(line)}`);
    assert.equal(overlap(alert2, hint2), false, `${name}: hint over the alert with a dialogue line`);
    if (mobile) assert.ok(hint2.bottom <= size.height / 3 || hint2.y >= size.height * 2 / 3, `${name}: hint in the middle third with a dialogue line`);
    await shot(page, `messages-${name}-dialogue`);

    assert.deepEqual(errors, [], `${name}: page errors`);
    await page.close();
    console.log(`messages ${name} ok`);
  }
}, { browser });
