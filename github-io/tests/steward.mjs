// H3c browser check: the steward (src/sim/steward.js) runs the base for 90 s of game time, driven by sim steps
// with the match clock held (never the wall clock), the "AI running your base" strip shows at the top left,
// and turning it off keeps every order and queue the player gave. Desktop and phone portrait.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const base = process.env.TEST_URL || "http://127.0.0.1:4761/";
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: ["--enable-unsafe-swiftshader"] });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "?test=1");
    await page.waitForFunction(() => window.__frontier?.view?.modelsReady, null, { timeout: 120000 });
    await page.locator("#start").click();
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: 60000 });
    const before = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      f.hold = true;
      const mine = s.own(0);
      return { ok: f.steward(true), workers: mine.filter((e) => e.type === "worker").length, buildings: mine.filter((e) => e.kind === "building").length, units: mine.filter((e) => e.kind === "unit").length, time: s.time };
    });
    assert.equal(before.ok, true);
    // The strip: shown, top left, in the HUD's text size.
    const strip = page.locator("#steward-strip");
    await strip.waitFor({ state: "visible", timeout: 30000 });
    assert.equal((await strip.textContent()).trim(), "AI running your base");
    const box = await strip.boundingBox();
    // PC: top left (message stack); phones: top right, under the pause and settings row, clear of the idle buttons.
    assert.ok(box && box.y < 220 && box.width < 360 && (mobile ? box.x + box.width > 390 - 40 : box.x < 40), JSON.stringify(box));
    assert.ok(parseFloat(await strip.evaluate((el) => getComputedStyle(el).fontSize)) >= 11);
    assert.equal(await strip.evaluate((el) => getComputedStyle(el).pointerEvents), "none");
    // 90 s of game time in 10 s steps (each a separate round trip, so a slow runner never times out one call).
    for (let i = 0; i < 9; i++) await page.evaluate(() => window.__frontier.step(10));
    const after = await page.evaluate(() => {
      const s = window.__frontier.sim, mine = s.own(0);
      return { workers: mine.filter((e) => e.type === "worker").length, buildings: mine.filter((e) => e.kind === "building").length, units: mine.filter((e) => e.kind === "unit").length, time: s.time, on: s.stewardOn(0) };
    });
    assert.ok(after.time - before.time >= 89, `game time ${after.time - before.time}`);
    assert.equal(after.on, true);
    assert.ok(after.workers > before.workers, `workers ${before.workers} -> ${after.workers}`);
    assert.ok(after.buildings > before.buildings, `buildings ${before.buildings} -> ${after.buildings}`);
    assert.ok(after.units > before.units, `units ${before.units} -> ${after.units}`);
    // The player orders a unit and queues one, then takes the base back: both are kept.
    const kept = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, mine = s.own(0);
      const unit = mine.find((e) => e.kind === "unit" && e.type !== "worker" && e.complete) || mine.find((e) => e.type === "worker");
      const hq = mine.find((e) => e.type === "hq");
      s.command({ team: 0, type: "order", ids: [unit.id], order: { type: "move", x: hq.x * 0.5, z: hq.z * 0.5 } });
      const goal = { ...unit.orders[0] };
      s.players[0].alloy += 200;
      s.command({ team: 0, type: "train", building: hq.id, unit: "worker" });
      const queue = hq.queue.map((q) => q.type);
      f.step(5);
      const stillOn = { type: unit.orders[0]?.type, x: unit.orders[0]?.x };
      const queueBefore = hq.queue.map((q) => q.type);
      const off = f.steward(false);
      const queueOff = hq.queue.map((q) => q.type);
      f.step(1);
      return { goal: { type: goal.type, x: goal.x }, stillOn, off, on: s.stewardOn(0), order: { type: unit.orders[0]?.type, x: unit.orders[0]?.x }, done: unit.orders.length === 0, queue, queueBefore, queueOff, marks: s.own(0).filter((e) => e.playerAt !== undefined).length };
    });
    assert.equal(kept.off, true);
    assert.equal(kept.on, false);
    assert.ok(kept.done || (kept.order.type === kept.goal.type && kept.order.x === kept.goal.x), `order kept after off: ${JSON.stringify(kept)}`);
    assert.ok(kept.stillOn.type === undefined || (kept.stillOn.type === kept.goal.type && kept.stillOn.x === kept.goal.x), `order kept while on: ${JSON.stringify(kept)}`);
    assert.ok(kept.queue.includes("worker"), JSON.stringify(kept.queue));
    assert.deepEqual(kept.queueOff, kept.queueBefore, "turning it off leaves the queue as it was");
    assert.equal(kept.marks, 0);
    await strip.waitFor({ state: "hidden", timeout: 30000 });
    assert.deepEqual(errors, []);
    console.log(`${mobile ? "Phone" : "Desktop"} steward: base grew (${before.workers}->${after.workers} workers, ${before.buildings}->${after.buildings} buildings, ${before.units}->${after.units} units), strip shown, orders and queues kept after off`);
    await page.close();
  }
} finally { await browser.close(); }
