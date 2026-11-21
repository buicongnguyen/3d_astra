// "The Sovereign Walks" in the browser (R3-H): the optional Act 3 mission started from the campaign map at
// 1440x900, 390x844 and 844x390. At 5:00 the relays wake and the Iron Sovereign walks in; its entrance
// scene plays; while the relays stand the bar reads RELAY SHIELD and the shield (bubble and tethers) is
// drawn; once they fall and it drops to half health it surges (OVERDRIVE, the phase card, the core lit)
// and then marks its new attacks (the rail sweep is a line on the ground). The bar keeps clear of the HUD,
// text 11 px or more, no sideways scroll, no page errors. Screenshots: test-results/sovereign-walks-*.png
// (the results file copies the desktop ones). Run against a build:
//   TEST_URL=http://127.0.0.1:<port>/ npm run test:sovereign-walks
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";

const KEY = "frontier-campaign-v2", ID = "m11d-the-sovereign-walks";
const ids = MISSIONS.map((m) => m.id);
const progress = { cleared: Object.fromEntries(ids.slice(0, ids.indexOf("m11-cut-the-draw") + 1).map((id) => [id, { time: 400, medal: "silver", difficulty: "standard" }])) };

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
const boss = (page) => page.evaluate(() => { const b = window.__frontier.sim.tagged("sovereign")[0]; return b ? { id: b.id, x: b.x, z: b.z, phase: b.bs?.phase, warded: b.bs?.warded, set: b.bs?.set ?? null, hp: b.hp / b.maxHp } : null; });

// The fight hint (a counter tip that may pop up in this staged fight) is not what these shots are about.
const quiet = (page) => page.evaluate(() => { const h = document.getElementById("fight-hint"); if (h) h.style.visibility = "hidden"; });
const browser = await launchBrowser();
await suite("sovereign-walks: The Sovereign Walks, relays and phase 2", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport);
    await goto();
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progress]);
    await page.reload(); await ready();
    await tap('[data-mode="campaign"]');
    await tap(`[data-mission="${ID}"]`);
    await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible" });
    assert.match(await page.locator("#mission-briefing").textContent(), /The Sovereign Walks/);
    await tap("#mb-skip"); await tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });

    // 1. Held to 5:00: the relays and the Sovereign come up; an army of the player's stands in its way.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      f.hold = true;
      s.explored[0].fill(1);
      for (let i = 0; i < 6000 && s.mission.clock < 299.9; i++) s.tick(0.05);
      s.events.length = 0;
      for (let i = 0; i < 12; i++) s.spawn(i % 3 ? "ranger" : "tank", 0, 6 + (i % 4) * 1.6, -14 + Math.floor(i / 4) * 1.6);
      s.updateVision();
      f.hold = false;
    });
    await page.waitForFunction(() => window.__frontier.scene().open, null, { timeout: TIMEOUT.step });
    await page.evaluate(() => { window.__frontier.hold = true; });
    assert.equal(await page.evaluate(() => window.__frontier.scene().id), "sovereign-walks");
    // The camera reaches its gate (explored here) and the name card is up.
    await page.waitForTimeout(2800);
    await shot(page, `sovereign-walks-scene-${viewport}`);
    await page.evaluate(() => window.__frontier.skipScene());
    await page.waitForFunction(() => !window.__frontier.scene().open);
    await page.waitForFunction((id) => window.__frontier.view.models.has("ironsovereign2"), null, { timeout: TIMEOUT.models });

    // 2. Phase 1, shielded: RELAY SHIELD on the bar, the bubble and one tether per relay drawn.
    const b1 = await boss(page);
    assert.equal(b1.warded, 3);
    await page.evaluate(({ x, z }) => { const f = window.__frontier; f.sim.visible[0].fill(1); f.view.focusOn(x - 2, z + 6); f.step(0.1); f.sim.visible[0].fill(1); }, b1);
    await page.waitForFunction(() => document.querySelector("#boss-bar .boss-state")?.textContent === "RELAY SHIELD", null, { timeout: TIMEOUT.step });
    await page.waitForFunction(() => { const sh = window.__frontier.view.bosses.shield; return sh && sh.bubble.visible && sh.tethers.count === 3; }, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(300);
    await quiet(page);
    await shot(page, `sovereign-walks-phase1-${viewport}`);
    const shielded = await bar(page);
    assert.match(shielded.name, /Iron Sovereign/);
    assert.deepEqual(shielded.small, [], `${viewport}: bar text under 11 px`);
    assert.equal(shielded.hits, 0, `${viewport}: the bar covers the HUD`);
    assert.ok(shielded.inside && !shielded.sideways, viewport);

    // 3. The relays fall and it drops to half: the surge (OVERDRIVE, phase card, lit core), the clock running.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, b = s.tagged("sovereign")[0];
      for (const r of s.tagged("ward")) while (r.hp > 0) s.applyDamage(r, 1e6, 0, null);
      // The army right in front of it, so the surge and the new attacks happen in sight.
      s.own(0).filter((e) => e.kind === "unit" && e.type !== "worker").slice(-12).forEach((e, i) => { e.x = b.x - 4 + (i % 4) * 1.6; e.z = b.z + 9 + Math.floor(i / 4) * 1.6; e.orders = []; });
      s.updateVision();
      b.hp = b.maxHp * 0.49;
      f.hold = false;
    });
    await page.waitForFunction(() => window.__frontier.sim.tagged("sovereign")[0]?.bs?.phase === "surge", null, { timeout: TIMEOUT.step });
    await page.evaluate(() => { const f = window.__frontier, b = f.sim.tagged("sovereign")[0]; f.view.focusOn(b.x - 2, b.z + 6); });
    await page.waitForTimeout(450);
    await page.evaluate(() => { window.__frontier.hold = true; });
    await quiet(page);
    await shot(page, `sovereign-walks-surge-${viewport}`);
    const surge = await bar(page);
    assert.equal(surge.state, "OVERDRIVE");
    assert.equal(await page.locator("#boss-card").getAttribute("data-kind"), "phase");
    assert.equal(await page.evaluate(() => { let lit = false; const f = window.__frontier, b = f.sim.tagged("sovereign")[0]; f.view.objects.get(b.id)?.traverse((c) => { if (c.name === "BossCore") lit = c.visible; }); return lit; }), true, "the core blazes");
    assert.equal(await page.evaluate(() => window.__frontier.view.bosses.shield?.tethers.visible ?? false), false, "no tethers without relays");

    // 4. Phase 2 attacks: the first is the rail sweep, a line marked on the ground.
    const rail = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, b = s.tagged("sovereign")[0];
      for (let i = 0; i < 600 && !(b.bs.phase === "warning"); i++) f.step(0.05);
      f.step(0.5);
      const z = s.dangerZones?.find((q) => q.boss === b.id);
      if (z) f.view.focusOn((b.x + z.x) / 2, (b.z + z.z) / 2 + 5);
      return { phase: b.bs.phase, attack: z?.attack, shape: z?.shape };
    });
    assert.deepEqual([rail.phase, rail.attack, rail.shape], ["warning", "rail-sweep", "line"]);
    await page.waitForTimeout(350);
    await quiet(page);
    await shot(page, `sovereign-walks-phase2-${viewport}`);
    assert.equal(await page.evaluate(() => window.__frontier.view.bosses.marks.size), 1, "the rail is drawn");
    const warned = await bar(page);
    assert.equal(warned.state, "ATTACK INBOUND");
    assert.equal(warned.hits, 0, `${viewport}: phase 2 bar covers the HUD`);
    assert.deepEqual(errors, []);
    await page.close();
  }
}, { browser });
