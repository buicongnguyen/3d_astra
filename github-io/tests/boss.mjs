// Bosses in the browser (docs/aaa/BOSSES.md): mission 3 started from the campaign at 1440x900,
// 390x844 and 844x390. The Iron Vanguard renders as its own rigged model, its entrance scene plays
// when the player's troops reach it, the boss bar shows its name and state (ARMORED, ATTACK INBOUND,
// CORE EXPOSED) without covering the dock, the idle buttons, the objectives or the dialogue, the
// danger zone is marked on the ground and units on Guard step out of it, the core lights while it is
// exposed, and (desktop) the mission is won with the boss and the siphons down, its lines in the
// Comms log. Text 11 px or more, no sideways scroll. Screenshots: test-results/boss-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";

const KEY = "frontier-campaign-v2", ID = "m03-the-ashen-line";
const ids = MISSIONS.map((m) => m.id), at = ids.indexOf(ID);
const progress = { cleared: Object.fromEntries(ids.slice(0, at).map((id) => [id, { time: 400, medal: "silver", difficulty: "standard" }])) };

// Boxes of the bar and of everything it must stay clear of, measured in one go.
const layout = (page) => page.evaluate(() => {
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none" ? { l: r.left, t: r.top, r: r.right, b: r.bottom, id: el.id || el.className } : null; };
  const bar = box(document.querySelector("#boss-bar"));
  const others = ["#idle-chips .idle-button:not([hidden])", "#dialogue", ".bottom-dock .panel", "#dock-tabs", "#mission-objectives", ".touch-controls", "#mission-toggle", ".topbar"]
    .flatMap((sel) => [...document.querySelectorAll(sel)].map(box)).filter(Boolean);
  const overlap = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
  const small = [...document.querySelectorAll("#boss-bar *")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((s) => s < 11);
  const name = document.querySelector("#boss-bar .boss-name");
  return { bar, hits: bar ? others.filter((o) => overlap(bar, o)).map((o) => o.id) : [], inside: bar && bar.l >= 0 && bar.r <= innerWidth && bar.t >= 0 && bar.b <= innerHeight, small, sideways: document.documentElement.scrollWidth > innerWidth,
    text: document.querySelector("#boss-bar")?.textContent, clipped: name ? name.scrollWidth > name.clientWidth + 1 : null, taps: getComputedStyle(document.querySelector("#boss-bar")).pointerEvents };
});
const step = (page, seconds) => page.evaluate((t) => window.__frontier.step(t), seconds);
const phase = (page) => page.evaluate(() => window.__frontier.sim.tagged("ironVanguard")[0]?.bs?.phase || null);
// Steps the held match until the boss is in `want` (a test hook: the clock only moves here).
const reach = (page, want) => page.evaluate((want) => {
  const f = window.__frontier, boss = f.sim.tagged("ironVanguard")[0];
  for (let i = 0; i < 600 && boss.bs?.phase !== want; i++) f.step(0.05);
  return boss.bs?.phase;
}, want);

const browser = await launchBrowser();
await suite("boss: the Iron Vanguard in mission 3", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport);
    await goto();
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progress]);
    await page.reload(); await ready();
    await tap('[data-mode="campaign"]');
    assert.equal(await page.locator(`[data-mission="${ID}"]`).getAttribute("aria-current"), "true", "mission 3 is next");
    await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible" });
    await tap("#mb-skip"); await tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });

    // 1. Powered down in its yard: drawn as its own model, no bar yet.
    const start = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, boss = s.tagged("ironVanguard")[0];
      f.hold = true;
      s.explored[0].fill(1);
      f.view.focusOn(boss.x, boss.z + 4);
      return { id: boss.id, phase: boss.bs?.phase ?? "dormant", type: boss.type, x: boss.x, z: boss.z, loaded: f.view.models.has("ironvanguard") };
    });
    assert.equal(start.type, "ironvanguard");
    assert.equal(start.phase, "dormant");
    assert.ok(start.loaded, "the boss model is loaded with the mission");
    await step(page, 0.1);
    await page.waitForFunction((id) => !!window.__frontier.view.objects.get(id), start.id, { timeout: TIMEOUT.step });
    const model = await page.evaluate((id) => {
      const o = window.__frontier.view.objects.get(id), names = [];
      o.traverse((c) => { if (c.name) names.push(c.name); });
      let core = null; o.traverse((c) => { if (c.name === "BossCore") core = c.visible; });
      return { names, core, drawn: o.visible, scale: o.userData.readabilityScale };
    }, start.id);
    for (const part of ["leg_L", "leg_R", "TurretRig", "BossArmL", "BossArmR", "BossGun", "BossCore"]) assert.ok(model.names.includes(part), `${viewport}: the model has ${part}`);
    assert.equal(model.core, false, "the core is dark while it is armoured");
    assert.equal(await page.locator("#boss-bar").isVisible(), false, "no bar before it wakes");

    // 2. The army walks up: it wakes and its entrance plays (the clock runs for this part).
    await page.evaluate(({ x, z }) => {
      const s = window.__frontier.sim;
      const army = s.own(0).filter((e) => e.kind === "unit" && e.type !== "worker");
      army.forEach((e, i) => { e.x = x - 5 + (i % 4) * 1.4; e.z = z + 12 + Math.floor(i / 4) * 1.4; e.orders = []; e.post = null; });
      for (let i = 0; i < 8; i++) s.spawn("ranger", 0, x - 4 + (i % 4) * 1.4, z + 15 + Math.floor(i / 4) * 1.4);
      s.updateVision();
      window.__frontier.hold = false;
    }, start);
    await page.waitForFunction(() => window.__frontier.scene().open, null, { timeout: TIMEOUT.step });
    await page.evaluate(() => { window.__frontier.hold = true; });
    assert.equal(await page.evaluate(() => window.__frontier.scene().id), "iron-vanguard");
    await page.waitForTimeout(300);
    await shot(page, `boss-scene-${viewport}`);
    await page.evaluate(() => window.__frontier.skipScene());
    await page.waitForFunction(() => !window.__frontier.scene().open);

    // 3. The bar: name and state, clear of the rest of the HUD.
    await step(page, 0.2);
    await page.locator("#boss-bar").waitFor({ state: "visible", timeout: TIMEOUT.step });
    const armored = await layout(page);
    assert.match(armored.text, /Iron Vanguard/);
    assert.match(armored.text, /ARMORED|ATTACK INBOUND/);
    assert.deepEqual(armored.hits, [], `${viewport}: the bar covers ${armored.hits.join(", ")}`);
    assert.ok(armored.inside, `${viewport}: the bar is on screen ${JSON.stringify(armored.bar)}`);
    assert.deepEqual(armored.small, [], `${viewport}: bar text under 11 px`);
    assert.equal(armored.clipped, false, `${viewport}: the name fits`);
    assert.equal(armored.taps, "none", "the bar takes no taps");
    assert.equal(armored.sideways, false);

    // 4. An attack is marked: ATTACK INBOUND, a mark on the ground, troops on Guard step out of it.
    assert.equal(await reach(page, "warning"), "warning");
    await step(page, 0.6);
    const warn = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, zone = s.dangerZones[0];
      return { marks: f.view.bosses.marks.size, evading: s.own(0).filter((e) => e.evade).length, zone: zone && { x: zone.x, z: zone.z, r: zone.radius }, state: document.querySelector("#boss-bar .boss-state").textContent };
    });
    assert.equal(warn.state, "ATTACK INBOUND");
    assert.equal(warn.marks, 1, "the danger zone is drawn");
    await page.evaluate(({ x, z }) => window.__frontier.view.focusOn(x, z - 3), warn.zone);
    await page.waitForTimeout(250);
    await shot(page, `boss-warning-${viewport}`);
    const warned = await layout(page);
    assert.deepEqual(warned.hits, [], `${viewport}: warning bar covers ${warned.hits.join(", ")}`);
    assert.equal(await reach(page, "attacking"), "attacking");
    const inside = await page.evaluate(() => { const s = window.__frontier.sim, z = s.dangerZones[0]; return s.own(0).filter((e) => e.kind === "unit" && e.stance !== "hold" && Math.hypot(e.x - z.x, e.z - z.z) <= z.radius).length; });
    assert.equal(inside, 0, "nobody on Guard is left in the zone when it fires");

    // 5. After the burst the core is open: CORE EXPOSED and a lit core.
    assert.equal(await reach(page, "exposed"), "exposed");
    await step(page, 0.3);
    await page.waitForFunction(() => document.querySelector("#boss-bar .boss-state").textContent === "CORE EXPOSED", null, { timeout: TIMEOUT.step });
    await page.waitForFunction((id) => { let lit = false; window.__frontier.view.objects.get(id)?.traverse((c) => { if (c.name === "BossCore") lit = c.visible; }); return lit; }, start.id, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate(() => window.__frontier.view.bosses.marks.size), 0, "the mark is gone after the rounds");
    await page.evaluate(({ x, z }) => window.__frontier.view.focusOn(x, z + 4), start);
    await page.waitForTimeout(250);
    await shot(page, `boss-exposed-${viewport}`);

    // 6. Desktop: bring it down and break the siphons with the clock running (the debrief opens from a
    // running frame); the mission is won and the boss's last lines are logged.
    if (viewport === "desktop") {
      const end = await page.evaluate(() => {
        const f = window.__frontier, s = f.sim, boss = s.tagged("ironVanguard")[0];
        while (boss.hp > 0) s.applyDamage(boss, 1e6, 0, null);
        for (const siphon of s.tagged("siphon")) while (siphon.hp > 0) s.applyDamage(siphon, 1e6, 0, null);
        f.hold = false;
        return { marks: s.dangerZones.length };
      });
      assert.equal(end.marks, 0, "no mark outlives the boss");
      await page.locator(".debrief").waitFor({ state: "visible", timeout: TIMEOUT.step });
      assert.equal(await page.evaluate(() => window.__frontier.sim.mission.objectives.vanguard.state), "done");
      assert.ok(await page.evaluate(() => window.__frontier.mission.queue.log.some((l) => l.text.startsWith("It is down!"))), "the boss's last line is in the Comms log");
      assert.equal(await page.locator(".debrief").getAttribute("data-result"), "victory");
      assert.ok((await page.locator(".debrief").innerText()).includes("Iron Vanguard"), "the debrief names the boss");
      assert.equal(await page.locator("#boss-bar").isVisible(), false, "the bar goes with the boss");
      await shot(page, `boss-debrief-${viewport}`);
    }
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
