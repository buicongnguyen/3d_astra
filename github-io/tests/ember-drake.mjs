// "The Ember Roost" in the browser (W9): the optional Act 3 mission started from the campaign map at 1440x900,
// 390x844 and 844x390. At 4:00 the Ember Drake comes home to the Crown; an army of the player's walks up, the drake
// wakes and its entrance scene plays; in the air the bar reads AIRBORNE; it marks its fire breath on the ground (a
// line, ATTACK INBOUND) before the breath burns; after two breaths it lands on the Crown behind the wing-gust circle
// (bar LANDED); then the test hook brings it down: it falls, the mission is won. The bar keeps clear of the HUD, text
// is 11 px or more, no sideways scroll, no page errors; on the phone the frame's draw calls with the drake on screen
// are recorded. Screenshots: test-results/ember-drake-*.png. Run against a build:
//   TEST_URL=http://127.0.0.1:<port>/ npm run test:ember-drake
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";

const KEY = "frontier-campaign-v2", ID = "m10e-the-ember-roost";
const ids = MISSIONS.map((m) => m.id);
const progress = { cleared: Object.fromEntries(ids.slice(0, ids.indexOf("m10b-crown-hill") + 1).map((id) => [id, { time: 400, medal: "silver", difficulty: "standard" }])) };

const bar = (page) => page.evaluate(() => {
  const el = document.querySelector("#boss-bar");
  if (!el || el.hidden) return null;
  const r = el.getBoundingClientRect();
  const small = [...el.querySelectorAll("*")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((s) => s < 11);
  const box = (x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(x).visibility !== "hidden" ? b : null; };
  const others = ["#idle-chips .idle-button:not([hidden])", "#dialogue", ".bottom-dock .panel", "#dock-tabs", "#mission-objectives", ".topbar"].flatMap((sel) => [...document.querySelectorAll(sel)].map(box)).filter(Boolean);
  const hits = others.filter((o) => r.left < o.right - 1 && o.left < r.right - 1 && r.top < o.bottom - 1 && o.top < r.bottom - 1).length;
  return { state: el.querySelector(".boss-state").textContent, name: el.querySelector(".boss-name").textContent, small, hits, inside: r.left >= 0 && r.right <= innerWidth, sideways: document.documentElement.scrollWidth > innerWidth };
});
const quiet = (page) => page.evaluate(() => { const h = document.getElementById("fight-hint"); if (h) h.style.visibility = "hidden"; });
// Steps the held match (frames keep drawing) until `phase` (and, for "warning", the kind of mark), at most `cap` s.
const stepTo = (page, phase, landing = false, cap = 60) => page.evaluate(([phase, landing, cap]) => {
  const f = window.__frontier, b = f.sim.tagged("drake")[0];
  for (let i = 0; i < cap * 20 && b.hp > 0 && !(b.bs?.phase === phase && !!b.bs.landing === landing); i++) f.step(0.05);
  f.view.focusOn(b.x, b.z + 7);
  return { phase: b.bs?.phase, landing: !!b.bs?.landing, flying: !!b.flying, zone: f.sim.dangerZones?.find((z) => z.boss === b.id) || null };
}, [phase, landing, cap]);

const SLOW = Number(process.env.SLOW_CPU || 0) > 1;
const WAIT = SLOW ? TIMEOUT.models : TIMEOUT.step;
const browser = await launchBrowser();
const draws = {};
await suite("ember-drake: The Ember Roost, a flying boss that marks its breath, lands and falls", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport, { timeout: WAIT });
    await goto();
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progress]);
    await page.reload(); await ready();
    await tap('[data-mode="campaign"]');
    await tap(`[data-mission="${ID}"]`);
    await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible" });
    assert.match(await page.locator("#mission-briefing").textContent(), /The Ember Roost/);
    await tap("#mb-skip"); await tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });

    // 1. Held to 4:00: the drake lands on the Crown asleep; an army walks up beside it and it wakes (the scene).
    const slept = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      f.hold = true;
      s.explored[0].fill(1);
      for (let i = 0; i < 6000 && s.mission.clock < 240.5; i++) s.tick(0.05);
      s.events.length = 0;
      const b = s.tagged("drake")[0];
      const asleep = { phase: b.bs?.phase ?? "dormant", flying: !!b.flying };
      for (let i = 0; i < 14; i++) { const u = s.spawn(i % 2 ? "ranger" : "vanguard", 0, b.x - 5 + (i % 5) * 1.6, b.z + 11 + Math.floor(i / 5) * 1.6); u.orders = []; }
      s.updateVision();
      f.hold = false;
      return asleep;
    });
    assert.deepEqual(slept, { phase: "dormant", flying: false }, "asleep on the Crown, on the ground");
    await page.waitForFunction(() => window.__frontier.scene().open, null, { timeout: WAIT });
    await page.evaluate(() => { window.__frontier.hold = true; });
    assert.equal(await page.evaluate(() => window.__frontier.scene().id), "ember-drake");
    await page.waitForFunction(() => window.__frontier.scene().beat >= 2, null, { timeout: WAIT });
    await shot(page, `ember-drake-scene-${viewport}`);
    await page.evaluate(() => window.__frontier.skipScene());
    await page.waitForFunction(() => !window.__frontier.scene().open);
    await page.waitForFunction(() => window.__frontier.view.models.has("emberdrake"), null, { timeout: TIMEOUT.models });

    // 2. In the air: AIRBORNE on the bar, the model lifted with its wings out.
    const air = await stepTo(page, "tracking");
    assert.ok(air.flying, "it flies");
    await page.evaluate(() => { const f = window.__frontier; f.sim.visible[0].fill(1); f.step(0.05); f.sim.visible[0].fill(1); });
    await page.waitForFunction(() => document.querySelector("#boss-bar .boss-state")?.textContent === "AIRBORNE", null, { timeout: WAIT });
    // The view eases it up on frame time: let the match run a moment (the clock is held again at once).
    await page.evaluate(() => { window.__frontier.hold = false; });
    await page.waitForFunction(() => { const f = window.__frontier, b = f.sim.tagged("drake")[0]; return (f.view.objects.get(b.id)?.userData.boss?.drake?.alt ?? 0) > 2; }, null, { timeout: WAIT });
    await page.evaluate(() => { window.__frontier.hold = true; });
    await page.waitForTimeout(200);
    await quiet(page);
    await shot(page, `ember-drake-air-${viewport}`);
    const flying = await bar(page);
    assert.match(flying.name, /Ember Drake/);
    assert.deepEqual(flying.small, [], `${viewport}: bar text under 11 px`);
    assert.equal(flying.hits, 0, `${viewport}: the bar covers the HUD`);
    assert.ok(flying.inside && !flying.sideways, viewport);

    // 3. The telegraph: a fire-breath line on the ground before anything burns.
    const warn = await stepTo(page, "warning");
    assert.deepEqual([warn.phase, warn.zone?.attack, warn.zone?.shape], ["warning", "fire-breath", "line"]);
    assert.ok(warn.zone.at - warn.zone.from >= 1.5, "marked at least 1.5 s ahead");
    await page.waitForFunction(() => window.__frontier.view.bosses.marks.size > 0, null, { timeout: WAIT });
    await page.waitForFunction(() => document.querySelector("#boss-bar .boss-state")?.textContent === "ATTACK INBOUND", null, { timeout: WAIT });
    await page.waitForTimeout(300);
    await quiet(page);
    await shot(page, `ember-drake-telegraph-${viewport}`);
    if (viewport === "portrait") {
      // Draw calls of one phone frame with the drake and its mark on screen.
      draws.telegraph = await page.evaluate(async () => { const r = window.__frontier.view.renderer; await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); return r.info.render.calls; });
    }
    // The breath itself: the pooled fire mesh shows over the zone.
    await stepTo(page, "attacking");
    await page.evaluate(() => window.__frontier.step(0.3));
    await page.waitForFunction(() => window.__frontier.view.bosses.breath?.mesh.visible === true, null, { timeout: WAIT });
    await page.waitForTimeout(200);
    await quiet(page);
    await shot(page, `ember-drake-breath-${viewport}`);

    // 4. The landing: the gust circle round the Crown, then LANDED on the bar, on the ground.
    const gust = await stepTo(page, "warning", true);
    assert.deepEqual([gust.zone?.attack, gust.zone?.shape], ["wing-gust", "circle"]);
    const landed = await stepTo(page, "perched");
    assert.equal(landed.flying, false, "on the ground");
    await page.waitForFunction(() => document.querySelector("#boss-bar .boss-state")?.textContent === "LANDED", null, { timeout: WAIT });
    await page.waitForTimeout(500);
    await quiet(page);
    await shot(page, `ember-drake-landed-${viewport}`);
    const down = await bar(page);
    assert.equal(down.hits, 0, `${viewport}: the landed bar covers the HUD`);

    // 5. Beaten through the test hook: it takes off and is shot down; the fall plays and the mission is won.
    await stepTo(page, "tracking");
    await page.evaluate(() => { const f = window.__frontier, s = f.sim, b = s.tagged("drake")[0]; s.applyDamage(b, 1e7, 0, null); f.hold = false; });
    await page.waitForTimeout(700);
    await shot(page, `ember-drake-fall-${viewport}`);
    await page.waitForFunction(() => window.__frontier.sim.mission?.objectives?.drake?.state === "done", null, { timeout: WAIT });
    await page.waitForFunction(() => window.__frontier.sim.result === "victory", null, { timeout: TIMEOUT.models });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(`ember-drake: phone frame with the drake marking its breath: ${draws.telegraph} draw calls`);
}, { browser });
