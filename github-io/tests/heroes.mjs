// Campaign heroes in the browser (2026-11-27; src/sim/content/campaign-heroes.js, src/hero-view.js): The Verdant
// Pact started from the campaign with Captain Sol spared, at the three standard viewports. Both heroes stand at the
// muster with their gold ground ring (one instanced draw) and a nameplate that is a 44 px tap target with text of
// 11 px or more; one tap on the plate selects the hero, its signature ability works from the ability tile, and a
// fallen hero leaves a notice and comes back at the Command core 30 s later. Then the same in Vietnamese on desktop.
// The match clock is held (window.__frontier.hold) and moved only with step(), so a slow runner cannot drift.
// Screenshots go to test-results/heroes-*.
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";
import * as sheet from "./lib/settings-sheet.mjs";

const KEY = "frontier-campaign-v2";
const ids = MISSIONS.map((m) => m.id), PACT = "m05-the-verdant-pact";
const progress = { cleared: Object.fromEntries(ids.slice(0, ids.indexOf(PACT)).map((id) => [id, { time: 400, medal: "silver", difficulty: "standard" }])), decisions: { "m04-sol": "accept" } };

const browser = await launchBrowser();
await suite("heroes: campaign heroes join, wear a gold ring and a nameplate, select in one tap and use their ability", async () => {
  for (const viewport of ["desktop", "portrait", "landscape", "desktop-vi"]) {
    const vi = viewport === "desktop-vi";
    const { page, goto, ready, tap, errors } = await openPage(browser, vi ? "desktop" : viewport);
    await goto();
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progress]);
    await page.reload(); await ready();
    if (vi) { await sheet.setLanguage(page, "vi"); await page.waitForFunction(() => document.documentElement.lang === "vi"); }
    await tap('[data-mode="campaign"]');
    await page.locator("#campaign-map .cmap").waitFor({ state: "visible" });
    await tap(`[data-mission="${PACT}"]`);
    await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible" });
    await tap("#mb-skip"); await tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    await page.evaluate(() => { const f = window.__frontier; f.hold = true; f.holdMessages = true; f.sim.explored[0].fill(1); });
    // Sol's join line is in the briefing (the mission was settled from the progress record).
    assert.ok(await page.evaluate(() => window.__frontier.sim.missionDef.briefing.lines.some((l) => l.who === "sol" && /My Outrider rides with you/.test(l.text))), "Sol's join line");

    // 1. Both heroes are on the field, by the camp, with their names and the hero rules.
    const heroes = await page.evaluate(() => window.__frontier.sim.entities.filter((e) => e.team === 0 && e.hero).map((e) => ({ id: e.id, hero: e.hero, name: e.name, type: e.type, hp: e.maxHp, x: e.x, z: e.z, ability: e.ability.id })));
    assert.deepEqual(heroes.map((h) => [h.hero, h.name, h.type, h.ability]).sort(), [["sol", "Sol's Outrider", "rider", "volley"], ["vale", "Mira Vale", "vanguard", "holdline"]], `${viewport}: the two heroes`);
    const vale = heroes.find((h) => h.hero === "vale");
    await page.evaluate((v) => window.__frontier.view.focusOn(v.x, v.z), vale);

    // 2. The gold ring: one instanced mesh for every hero; the nameplate over each.
    await page.waitForFunction(() => { const m = window.__frontier.view.scene.getObjectByName("HeroRings"); return !!m && m.visible && m.count === 2; }, null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate(() => window.__frontier.view.scene.children.filter((o) => o.name === "HeroRings").length), 1, "one ring mesh (one draw)");
    const plate = page.locator('.hero-plate[data-hero="vale"]');
    await plate.waitFor({ state: "visible", timeout: TIMEOUT.step });
    const box = await plate.evaluate((b) => { const r = b.getBoundingClientRect(), tag = b.querySelector(".hero-plate-tag"); return { w: r.width, h: r.height, left: r.left, right: r.right, top: r.top, font: parseFloat(getComputedStyle(tag).fontSize), text: tag.textContent.trim(), family: getComputedStyle(tag).fontFamily }; });
    assert.ok(box.w >= 44 && box.h >= 44, `${viewport}: the plate is a 44 px target (${box.w}x${box.h})`);
    assert.ok(box.font >= 11, `${viewport}: plate text ${box.font} px`);
    assert.ok(box.left >= 0 && box.right <= (vi ? 1440 : viewport === "portrait" ? 390 : viewport === "landscape" ? 844 : 1440), `${viewport}: plate on screen`);
    assert.ok(!/system-ui/.test(box.family), "no system-ui font");
    assert.match(box.text, vi ? /Mira Vale/ : /Mira Vale/);
    if (vi) assert.match(await page.locator('.hero-plate[data-hero="sol"]').innerText(), /Kỵ binh tiền trạm của Sol/, "the plate reads in Vietnamese");
    await shot(page, `heroes-field-${viewport}`);

    // 3. One tap on the plate selects the hero.
    await page.evaluate(() => window.__frontier.select([]));
    await tap('.hero-plate[data-hero="vale"]');
    await page.waitForFunction((id) => window.__frontier.selected.size === 1 && window.__frontier.selected.has(id), vale.id, { timeout: TIMEOUT.step });

    // 4. Its signature ability is on the ability bar and works.
    const tile = page.locator('[data-ability="holdline"]:visible').first();
    await tile.waitFor({ state: "visible", timeout: TIMEOUT.step });
    const t = await tile.evaluate((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, label: b.getAttribute("aria-label") }; });
    // Touch screens: a 44 px target (the PC card keeps its own tile size).
    if (viewport === "portrait" || viewport === "landscape") assert.ok(t.w >= 44 && t.h >= 44, `${viewport}: ability tile ${t.w}x${t.h}`);
    assert.equal(t.label, vi ? "Giữ trận tuyến" : "Hold the line");
    await tile[viewport === "desktop" || vi ? "click" : "tap"]();
    await page.waitForFunction((id) => { const f = window.__frontier, e = f.sim.get(id); return !!e && f.sim.hasStatus(e, "steadied") && e.abilityAt > f.sim.time; }, vale.id, { timeout: TIMEOUT.step });
    await shot(page, `heroes-ability-${viewport}`);

    // 5. A fallen hero: a notice, no plate, and back at the Command core 30 s later.
    // (Hold the line still runs: a blow far past her health and shield.)
    await page.evaluate((id) => { const f = window.__frontier, e = f.sim.get(id); f.sim.applyDamage(e, 1e6, 1, null); }, vale.id);
    await page.waitForFunction(() => /Mira Vale/.test(document.querySelector("#notice")?.textContent || "") || [...document.querySelectorAll(".message-stack *, #notice")].some((n) => /Mira Vale/.test(n.textContent)), null, { timeout: TIMEOUT.step });
    if (!vi) assert.match(await page.evaluate(() => document.querySelector("#notice").textContent), /Mira Vale is down: back at the Command core in 30 seconds/);
    else assert.match(await page.evaluate(() => document.querySelector("#notice").textContent), /Mira Vale đã ngã: 30 giây nữa sẽ trở lại Sở chỉ huy/);
    await page.waitForFunction(() => !document.querySelector('.hero-plate[data-hero="vale"]'), null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate(() => window.__frontier.sim.result), null, "losing a hero never ends the mission");
    // The "down" alert keeps the notice line its full time; the routine "back" notice follows it.
    await page.evaluate(() => { window.__frontier.holdMessages = false; window.__frontier.step(31); });
    const back = await page.evaluate(() => { const f = window.__frontier, v = f.sim.entities.find((e) => e.team === 0 && e.hero === "vale"), core = f.sim.own(0).find((e) => e.type === "hq"); return v ? { hp: v.hp, max: v.maxHp, d: Math.hypot(v.x - core.x, v.z - core.z), x: v.x, z: v.z } : null; });
    assert.ok(back && back.hp === back.max && back.d < 12, `${viewport}: Vale is back at the core (${JSON.stringify(back)})`);
    await page.waitForFunction(() => /Mira Vale/.test(document.querySelector("#notice")?.textContent || "") && /(back at the Command core\.|đã trở lại Sở chỉ huy)/.test(document.querySelector("#notice").textContent), null, { timeout: TIMEOUT.step });
    await page.evaluate((v) => window.__frontier.view.focusOn(v.x, v.z), back);
    await page.locator('.hero-plate[data-hero="vale"]').waitFor({ state: "visible", timeout: TIMEOUT.step });
    // No sideways scroll on any screen.
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${viewport}: no sideways scroll`);
    await shot(page, `heroes-back-${viewport}`);
    await page.evaluate(() => { window.__frontier.holdMessages = false; });
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
