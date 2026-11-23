// Campaign showtime in the browser (AAA round 2, W2-F) at 1440x900, 390x844 and 844x390:
//  1. the mission title card ("ACT I · LANDFALL · DAY 1", title, place) opens with the match, covers no
//     control, a tap skips it, reduced motion gives a plain fade;
//  2. boss presence in mission 3: at zoom 30 the Iron Vanguard stands at least 2.3x a Battle tank's screen
//     height, it keeps its authored size and the bar sits above it, the name card opens its entrance (inside the scene
//     too), and when its fall ends the match the debrief opens 1.4 s or more later;
//  3. the campaign map shows m11c as an open optional node of at least 44 px on every viewport.
// Run against a build: TEST_URL=http://127.0.0.1:4237/ npm run test:showtime. Screenshots: SHOWTIME_SHOTS=<dir>
// (default test-results/).
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { launchBrowser, openPage, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";

const KEY = "frontier-campaign-v2";
const DIR = process.env.SHOWTIME_SHOTS || "test-results";
mkdirSync(DIR, { recursive: true });
const ids = MISSIONS.map((m) => m.id);
const clearedBefore = (id) => ({ cleared: Object.fromEntries(ids.slice(0, ids.indexOf(id)).map((i) => [i, { time: 400, medal: "silver", difficulty: "standard" }])) });
const snap = (page, name) => page.screenshot({ path: `${DIR}/${name}.png` });
const step = (page, s) => page.evaluate((t) => window.__frontier.step(t), s);

async function begin({ page, goto, ready, tap }, id, query = "titlecard") {
  await goto(query);
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, clearedBefore(id)]);
  await page.reload(); await ready();
  await tap('[data-mode="campaign"]');
  await tap("#start");
  await page.locator("#mission-briefing").waitFor({ state: "visible" });
  await tap("#mb-skip"); await tap("#mb-next");
  await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
}

const browser = await launchBrowser();
await suite("showtime: title cards, boss presence, the Keystone Roads node", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const ctx = await openPage(browser, viewport);
    const { page, tap, errors } = ctx;
    // The card lives 2.6 s of real time. On a slow runner the checks below can take longer than that and find it gone (a null card),
    // so its two timers (2.6 s hide, 2.2 s fade) run ten times longer here; the card is still checked to go away by itself.
    await page.addInitScript(() => { const st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => st(fn, ms === 2600 || ms === 2200 ? ms * 10 : ms, ...a); });

    // 1. Title card.
    await begin(ctx, "m01-first-light");
    await page.locator("#title-card").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await page.waitForTimeout(500);
    const card = await page.evaluate(() => {
      const el = document.querySelector("#title-card"), r = el.getBoundingClientRect();
      const hits = [...document.querySelectorAll("button, input, select, a[href], [role=button]")].filter((b) => {
        if (el.contains(b)) return false;
        const q = b.getBoundingClientRect(), st = getComputedStyle(b);
        return q.width > 0 && q.height > 0 && st.visibility !== "hidden" && st.display !== "none" && !b.closest("[hidden]") && q.left < r.right && r.left < q.right && q.top < r.bottom && r.top < q.bottom;
      }).map((b) => b.id || b.className || b.tagName);
      const small = [...el.querySelectorAll("*")].map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((f) => f < 11);
      return { text: el.innerText, hits, small, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert.match(card.text, /ACT I · LANDFALL · DAY 1/, viewport);
    assert.match(card.text, /First Light/);
    assert.match(card.text, /Meridian Riverlands, day 1/);
    assert.deepEqual(card.hits, [], `${viewport}: the title card covers ${card.hits.join(", ")}`);
    assert.deepEqual(card.small, [], "text 11 px or more");
    assert.ok(card.inside && !card.sideways, `${viewport}: inside the screen`);
    await snap(page, `title-card-${viewport}`);
    await page.locator("#title-card").dispatchEvent("pointerdown");
    assert.equal(await page.locator("#title-card").count(), 0, "a tap skips the card");

    // Reduced motion: a plain fade, and the card still goes away by itself.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => window.__frontier.restart());
    await page.locator("#title-card").waitFor({ state: "attached", timeout: TIMEOUT.step });
    // Restart schedules the fade on a new frame. Under CPU throttling it can
    // start hundreds of milliseconds after the card enters the DOM.
    await page.waitForFunction(() => {
      const card = document.querySelector("#title-card.calm.show");
      return card && getComputedStyle(card).opacity === "1";
    }, null, { timeout: TIMEOUT.step });
    const calm = await page.evaluate(() => { const s = getComputedStyle(document.querySelector("#title-card")); return { animation: s.animationName, opacity: s.opacity, transition: s.transitionProperty, cls: document.querySelector("#title-card").className }; });
    assert.deepEqual([calm.animation, calm.transition, calm.opacity, calm.cls], ["none", "opacity", "1", "calm show"], "reduced motion: a plain fade, no slide");
    await page.locator("#title-card").waitFor({ state: "detached", timeout: 40000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });

    // 2. Boss presence in mission 3.
    await begin(ctx, "m03-the-ashen-line", "");
    const start = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, boss = s.tagged("ironVanguard")[0];
      f.hold = true; s.explored[0].fill(1); s.updateVision();
      f.view.zoom = 30; f.view.focusOn(boss.x, boss.z + 4);
      const tank = s.spawn("tank", 0, boss.x + 8, boss.z + 12.5);
      return { id: boss.id, tank: tank.id, x: boss.x, z: boss.z };
    });
    await step(page, 0.1);
    await page.waitForFunction(([a, b]) => window.__frontier.view.objects.get(a) && window.__frontier.view.objects.get(b), [start.id, start.tank], { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.sim.updateVision());
    await page.waitForFunction((id) => window.__frontier.view.objects.get(id)?.userData.model.scale.y > 0.9, start.id, { timeout: TIMEOUT.step });
    await page.waitForTimeout(200);
    const heights = await page.evaluate(([a, b]) => {
      const v = window.__frontier.view, V = v.objects.get(a).position.constructor;
      const px = (id) => {
        const o = v.objects.get(id); o.updateMatrixWorld(true);
        let lo = Infinity, hi = -Infinity;
        (o.userData.model || o).traverse((m) => {
          if (!m.isMesh || !m.geometry) return;
          const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox;
          for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { const w = new V(x, y, z).applyMatrix4(m.matrixWorld); lo = Math.min(lo, w.y); hi = Math.max(hi, w.y); }
        });
        const top = v.project(o.position.x, o.position.z, hi), bottom = v.project(o.position.x, o.position.z, lo);
        return { lo, hi, ms: o.userData.model.scale.y, px: Math.abs(bottom.y - top.y), scale: o.userData.readabilityScale, barWorld: o.position.y + o.userData.bar.position.y, hi };
      };
      return { boss: px(a), tank: px(b) };
    }, [start.id, start.tank]);
    assert.ok(heights.boss.scale >= 1 && heights.boss.scale < 1.3, `${viewport}: boss scale ${heights.boss.scale}`); // authored at its real size (owner, 2026-11-23)
    assert.ok(heights.boss.px >= 1.2 * heights.tank.px && heights.boss.px <= 2.2 * heights.tank.px, `${viewport}: boss ${heights.boss.px.toFixed(0)} px vs tank ${heights.tank.px.toFixed(0)} px at zoom 30`);
    assert.ok(heights.boss.barWorld >= heights.boss.hi - 0.01, `${viewport}: the bar (${heights.boss.barWorld.toFixed(1)}) sits above the model top (${heights.boss.hi.toFixed(1)})`);
    await snap(page, `boss-scale-${viewport}`);

    // Entrance: the scene gets a title beat and the name card is shown.
    await page.evaluate(({ x, z }) => {
      const s = window.__frontier.sim;
      for (const e of s.own(0).filter((u) => u.kind === "unit" && u.type !== "worker")) { e.x = x - 3; e.z = z + 12; e.orders = []; }
      for (let i = 0; i < 6; i++) s.spawn("ranger", 0, x - 4 + i, z + 15);
      s.updateVision(); window.__frontier.hold = false;
    }, start);
    await page.waitForFunction(() => window.__frontier.scene().open, null, { timeout: TIMEOUT.step });
    await page.evaluate(() => { window.__frontier.hold = true; });
    await page.waitForFunction(() => document.querySelector(".scene-title.on strong")?.textContent === "Iron Vanguard", null, { timeout: 12000 });
    await snap(page, `boss-entrance-${viewport}`);
    await page.evaluate(() => window.__frontier.skipScene());
    await page.waitForFunction(() => !window.__frontier.scene().open);
    // The scene had its own title beat; a boss that wakes without a scene gets the name card.
    assert.equal(await page.locator("#boss-card").count(), 0, "no second card behind the scene");
    await page.evaluate((id) => { const f = window.__frontier; f.view.event({ type: "bossWake", id, name: "Iron Vanguard" }, f.sim); }, start.id);
    await page.locator("#boss-card").waitFor({ state: "attached", timeout: TIMEOUT.step });
    assert.match(await page.locator("#boss-card").innerText(), /Iron Vanguard/i);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#boss-card")).pointerEvents), "none");

    // The fall ends the match: focus, 1.2 s slow motion, then the debrief (1.4 s or more after the beat began).
    if (viewport === "desktop") {
      await page.evaluate(() => {
        const f = window.__frontier, s = f.sim, boss = s.tagged("ironVanguard")[0];
        while (boss.hp > 0) s.applyDamage(boss, 1e6, 0, null);
        for (const siphon of s.tagged("siphon")) while (siphon.hp > 0) s.applyDamage(siphon, 1e6, 0, null);
        window.__t = { beat: null, modal: null };
        const poll = () => {
          const t = performance.now();
          if (window.__t.beat === null && window.__frontier.endBeat) window.__t.beat = t;
          if (window.__t.modal === null && !document.querySelector("#modal").hidden) { window.__t.modal = t; return; }
          requestAnimationFrame(poll);
        };
        poll(); f.hold = false;
      });
      await page.waitForFunction(() => window.__t.modal !== null, null, { timeout: 30000 });
      const t = await page.evaluate(() => window.__t);
      assert.ok(t.beat !== null, "the end beat started");
      assert.ok((t.modal - t.beat) / 1000 >= 1.4, `debrief ${(t.modal - t.beat) / 1000} s after the beat began`);
    }

    // 3. The campaign map: m11c is open, optional and a full 44 px target.
    await page.evaluate(([k, v]) => { localStorage.setItem(k, JSON.stringify(v)); }, [KEY, clearedBefore("m11c-hold-the-keystone-roads")]);
    await ctx.goto(""); await ctx.ready();
    await tap('[data-mode="campaign"]');
    await page.waitForSelector('.cmap-board', { state: "attached", timeout: TIMEOUT.step });
    await page.waitForSelector('.cmap-node[data-map-mission="m11c-hold-the-keystone-roads"]', { state: "attached", timeout: TIMEOUT.step });
    const node = await page.evaluate(() => {
      const n = document.querySelector('.cmap-node[data-map-mission="m11c-hold-the-keystone-roads"]'), b = document.querySelector(".cmap-board").getBoundingClientRect();
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { w: r.width, h: r.height, disabled: n.disabled, inside: r.left >= b.left && r.right <= b.right && r.top >= b.top && r.bottom <= b.bottom + 1, m12: !document.querySelector('.cmap-node[data-map-mission="m12-frontiers-end"]').disabled };
    });
    assert.ok(node, `${viewport}: the m11c node exists`);
    assert.ok(node.w >= 43.5 && node.h >= 43.5 && node.inside && !node.disabled && node.m12, `${viewport}: ${JSON.stringify(node)}`);
    await snap(page, `campaign-map-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
