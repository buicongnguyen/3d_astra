// 0.20 "Chronicles" in the browser: the four Faction Chronicle cards on the campaign map (locked
// before Act 1 ends, open after, relay pips), the list section, choosing a chronicle (its three
// missions, the "CHRONICLE · Sunward · 2/3" header, the briefing), starting a Sunward and a Veil
// mission (team 0 fields that faction's roster), Continue restoring a chronicle save, a chronicle's
// Defence mission and its last win, Vietnamese, at the three standard viewports. Text 11 px or
// more, taps 44 px or more and no sideways scroll. Screenshots go to test-results/chronicles-*.
// CHRONICLES_ALL=1 also starts the first mission of the Ashfall and Wardens chronicles (screenshots).
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";
import { CHRONICLES } from "../src/story/chronicles.js";

const KEY = "frontier-campaign-v2", SETTINGS = "frontier-command.settings.v1";
const progressWith = (count, extra = {}) => ({ cleared: Object.fromEntries(MISSIONS.slice(0, count).map((m, i) => [m.id, { time: 300 + i * 30, medal: "silver", difficulty: "standard" }])), ...extra });
const chron = (id) => CHRONICLES.find((c) => c.id === id);
const cleared = (id, n) => ({ cleared: chron(id).missions.slice(0, n).map((m) => m.id), done: n === 3, best: Object.fromEntries(chron(id).missions.slice(0, n).map((m) => [m.id, { time: 400, medal: "gold", difficulty: "standard" }])) });
const ROSTER = { sunward: "rider", veil: "shade", ashfall: "scrapper", wardens: "drone" };

// Visible text under `scope` smaller than 11 px, visible buttons smaller than 44 px or outside the
// viewport, and whether the page scrolls sideways (as tests/choices.mjs).
const audit = (page, scope) => page.evaluate((scope) => {
  const root = document.querySelector(scope), visible = (el) => { const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
  const small = [];
  for (const el of root.querySelectorAll("*")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || !visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 11) small.push(`${el.textContent.trim().slice(0, 24)} (${size}px)`);
  }
  const fonts = [...root.querySelectorAll(".chron-card, .chron-entry, .chron-card *, .chron-entry *")].filter(visible).map((el) => getComputedStyle(el).fontFamily).filter((f) => /system-ui/.test(f));
  const buttons = [...root.querySelectorAll("button")].filter(visible).map((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), left: r.left, right: r.right, text: b.textContent.trim().slice(0, 24) }; });
  return { small, fonts, tiny: buttons.filter((b) => b.w < 44 || b.h < 44), outside: buttons.filter((b) => b.left < -0.5 || b.right > innerWidth + 0.5), sideways: document.documentElement.scrollWidth > innerWidth, count: buttons.length };
}, scope);
const clean = (result, where) => {
  assert.deepEqual(result.small, [], `${where}: text under 11 px`);
  assert.deepEqual(result.fonts, [], `${where}: system-ui font`);
  assert.deepEqual(result.tiny, [], `${where}: buttons under 44 px`);
  assert.deepEqual(result.outside, [], `${where}: buttons outside the screen`);
  assert.equal(result.sideways, false, `${where}: sideways scroll`);
};

const browser = await launchBrowser();
await suite("chronicles: cards, chronicle missions, rosters, Continue, Vietnamese", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    const campaign = async () => { await tap('[data-mode="campaign"]'); await page.locator("#campaign-map .cmap").waitFor({ state: "visible" }); };
    const load = async (progress) => { await goto(); await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progress]); await page.reload(); await ready(); };
    const label = () => page.evaluate(() => document.querySelector("#operation-label").textContent);
    // Start the picked mission: Start, skip the briefing lines, Begin.
    const begin = async (name) => {
      await tap("#start");
      await page.locator("#mission-briefing").waitFor({ state: "visible" });
      if (name) await shot(page, name);
      await tap("#mb-skip"); await tap("#mb-next");
      await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    };
    const play = async (id, name) => {
      const info = await page.evaluate(() => { const s = window.__frontier.sim; return { faction: s.factions[0], roster: s.unitRoster(0), mission: s.missionDef.id, own: [...new Set(s.own(0).filter((e) => e.kind === "unit").map((e) => e.type))] }; });
      assert.equal(info.faction, id, `${viewport}: team 0 is ${id}`);
      assert.ok(info.roster.includes(ROSTER[id]), `${viewport}: the ${id} roster has ${ROSTER[id]}`);
      await page.evaluate(() => window.__frontier.step(20));
      await page.waitForTimeout(400);
      if (name) await shot(page, name);
      return info;
    };

    // 1. Act 1 not finished: four locked cards that name the mission that opens them, and the list section.
    await load(progressWith(3));
    await campaign();
    const locked = await page.evaluate(() => ({ cards: [...document.querySelectorAll(".chron-card")].map((c) => [c.dataset.chronicle, c.disabled, c.classList.contains("locked")]), entries: [...document.querySelectorAll(".chron-entry")].map((b) => b.disabled), title: document.querySelector(".chron-card").title, lock: document.querySelector(".chron-entry .chron-lock")?.textContent }));
    assert.deepEqual(locked.cards, [["ashfall", true, true], ["sunward", true, true], ["wardens", true, true], ["veil", true, true]]);
    assert.deepEqual(locked.entries, [true, true, true, true]);
    assert.equal(locked.title, "Clear Three-Way Dunes to unlock");
    assert.equal(locked.lock, "Clear Three-Way Dunes to unlock");
    clean(await audit(page, "#campaign-map"), `${viewport} locked map`);
    await shot(page, `chronicles-map-locked-${viewport}`);

    // 2. Act 1 cleared, one Sunward mission won: every card open, Sunward's first pip lit.
    await load(progressWith(4, { chronicles: { sunward: cleared("sunward", 1), veil: cleared("veil", 3) } }));
    await campaign();
    const open = await page.evaluate(() => ({ cards: [...document.querySelectorAll(".chron-card")].map((c) => [c.dataset.chronicle, c.disabled, [...c.querySelectorAll(".chron-pips i.on")].length, c.classList.contains("done")]) }));
    assert.deepEqual(open.cards, [["ashfall", false, 0, false], ["sunward", false, 1, false], ["wardens", false, 0, false], ["veil", false, 3, true]]);
    clean(await audit(page, "#campaign-map"), `${viewport} open map`);
    clean(await audit(page, "#campaign-setup"), `${viewport} list with chronicles`);
    await shot(page, `chronicles-map-open-${viewport}`);

    // 3. Sunward: the card opens its three missions, the next one picked, with the chronicle header.
    await tap('.chron-card[data-chronicle="sunward"]');
    await page.locator(".chron-missions").waitFor({ state: "visible" });
    const pick = await page.evaluate(() => ({ chronicle: window.__frontier.chronicle, rows: [...document.querySelectorAll('#campaign-setup [data-stage]')].map((b) => [b.dataset.mission, b.disabled]), picked: document.querySelector(".chron-card.picked")?.dataset.chronicle }));
    assert.deepEqual(pick.chronicle, { campaign: "sunward", pick: 1, active: null });
    assert.deepEqual(pick.rows, [["cs1-dry-wells", false], ["cs2-three-way-dunes", false], ["cs3-verdant-road", true]]);
    assert.equal(pick.picked, "sunward");
    assert.equal(await label(), "CHRONICLE · Sunward · 2/3");
    assert.match(await page.locator(".map-heading h1").innerText(), /Sunward · Three-Way Dunes/);
    clean(await audit(page, "#campaign-setup"), `${viewport} chronicle list`);
    if (viewport === "desktop") await shot(page, "chronicles-list-sunward-desktop");
    await begin(viewport === "landscape" ? null : `chronicles-briefing-sunward-${viewport}`);
    assert.equal(await label(), "CHRONICLE · Sunward · 2/3", "the header while playing");
    const sunward = await play("sunward", viewport === "landscape" ? null : `chronicles-play-sunward-${viewport}`);
    assert.equal(sunward.mission, "cs2-three-way-dunes");
    assert.ok(sunward.own.includes("rider"), `${viewport}: Sunward Riders on the field`);

    // 4. Continue restores the chronicle save (in Vietnamese on the desktop).
    assert.ok(await page.evaluate(() => window.__frontier.save()), "the chronicle match saves");
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem("frontier-save-v1") || "null"));
    assert.deepEqual([save?.mode, save?.missionId], ["campaign", "cs2-three-way-dunes"]);
    if (viewport === "desktop") await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "{}"); s.language = "vi"; localStorage.setItem(k, JSON.stringify(s)); }, SETTINGS);
    await page.reload(); await ready();
    assert.equal(await page.locator("#continue").isVisible(), true, "Continue is offered");
    await tap("#continue");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.paused, null, { timeout: TIMEOUT.models });
    const resumed = await page.evaluate(() => ({ chronicle: window.__frontier.chronicle, faction: window.__frontier.sim.factions[0], mission: window.__frontier.sim.missionDef.id }));
    assert.deepEqual(resumed, { chronicle: { campaign: "sunward", pick: 1, active: 1 }, faction: "sunward", mission: "cs2-three-way-dunes" });
    if (viewport === "desktop") {
      await page.waitForFunction(() => document.querySelector("#operation-label").textContent.includes("BIÊN NIÊN"), null, { timeout: TIMEOUT.step });
      assert.equal(await label(), "BIÊN NIÊN · Sunward · 2/3");
      await shot(page, "chronicles-continue-vi-desktop");
    } else assert.equal(await label(), "CHRONICLE · Sunward · 2/3");

    // The cards and the list in Vietnamese (desktop): locked text and pips read in Vietnamese.
    if (viewport === "desktop") {
      await load(progressWith(3));
      await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "{}"); s.language = "vi"; localStorage.setItem(k, JSON.stringify(s)); }, SETTINGS);
      await page.reload(); await ready();
      await campaign();
      await page.waitForFunction(() => document.querySelector(".chron-entry .chron-lock")?.textContent.includes("Hoàn thành"), null, { timeout: TIMEOUT.step });
      const vi = await page.evaluate(() => ({ lock: document.querySelector(".chron-entry .chron-lock").textContent, title: document.querySelector(".chron-entry strong").textContent, label: document.querySelector(".chron-section .chron-title").textContent }));
      assert.equal(vi.lock, "Hoàn thành Ba phe trên đồi cát để mở khóa");
      assert.equal(vi.title, "Quyền trục vớt");
      assert.equal(vi.label.trim(), "Biên niên các phe");
      clean(await audit(page, "#campaign-setup"), "desktop chronicles list in Vietnamese");
      await shot(page, "chronicles-list-vi-desktop");
      await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "{}"); s.language = "en"; localStorage.setItem(k, JSON.stringify(s)); }, SETTINGS);
    }

    // 5. Veil: the first mission, no base, on the Veil roster.
    await load(progressWith(4));
    await campaign();
    await tap(mobile ? '.chron-entry[data-chronicle="veil"]' : '.chron-card[data-chronicle="veil"]');
    await page.locator(".chron-missions").waitFor({ state: "visible" });
    assert.equal(await label(), "CHRONICLE · Veil · 1/3");
    await begin(viewport === "landscape" ? null : `chronicles-briefing-veil-${viewport}`);
    const veil = await play("veil", viewport === "landscape" ? null : `chronicles-play-veil-${viewport}`);
    assert.equal(veil.mission, "cv1-night-count");
    assert.ok(veil.own.includes("shade") && !veil.own.includes("vanguard"), `${viewport}: Shades, not Vanguards`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }

  // 6. Desktop: the Ashfall chronicle's Defence mission plays in the campaign, and its win finishes the
  // chronicle (debrief, progress), then the list shows it done and the main campaign is one tap away.
  const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
  await goto();
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progressWith(4, { chronicles: { ashfall: cleared("ashfall", 2) } })]);
  await page.reload(); await ready();
  await tap('[data-mode="campaign"]');
  await tap('.chron-card[data-chronicle="ashfall"]');
  assert.equal(await page.evaluate(() => document.querySelector("#operation-label").textContent), "CHRONICLE · Ashfall · 3/3");
  await tap("#start");
  await page.locator("#mission-briefing").waitFor({ state: "visible" });
  assert.equal(await page.locator("#mb-number").innerText(), "CHRONICLE · 3/3");
  await tap("#mb-skip"); await tap("#mb-next");
  await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
  assert.equal(await page.evaluate(() => !!window.__frontier.sim.defence && window.__frontier.sim.factions[0]), "ashfall");
  assert.equal(await page.evaluate(() => document.querySelector("#operation-label").textContent), "CHRONICLE · Ashfall · 3/3", "the campaign header, not the Defence one");
  await page.waitForFunction(() => document.documentElement.classList.contains("in-defence"), null, { timeout: TIMEOUT.step });
  await page.evaluate(() => window.__frontier.step(35));
  await page.waitForTimeout(400);
  await shot(page, "chronicles-play-ashfall-defence-desktop");
  // Every wave beaten: the simulation decides the win on its next tick (sim/defence.js defenceResult).
  await page.evaluate(() => { const s = window.__frontier.sim, d = s.defence; d.wave = d.cleared = s.missionDef.defence.waves.length; d.active = false; d.queue.length = 0; for (const e of s.entities) if (e.team === 1) e.hp = 0; });
  await page.locator(".debrief").waitFor({ state: "visible", timeout: TIMEOUT.step });
  const debrief = await page.evaluate(() => ({ eyebrow: document.querySelector(".debrief .eyebrow").textContent, end: document.querySelector(".debrief-end")?.textContent, primary: document.querySelector(".debrief-actions .primary")?.hasAttribute("data-new-game") }));
  assert.equal(debrief.eyebrow, "CHRONICLE · 3/3 · COMPLETE");
  assert.match(debrief.end || "", /Chronicle complete/);
  assert.equal(debrief.primary, true, "the last win leads back to the campaign screen");
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).chronicles.ashfall, KEY);
  assert.equal(stored.done, true);
  assert.deepEqual(stored.cleared, chron("ashfall").missions.map((m) => m.id));
  await shot(page, "chronicles-debrief-desktop");
  await tap(".debrief-actions [data-new-game]");
  await page.locator(".chron-missions").waitFor({ state: "visible" });
  assert.equal(await page.locator('.chron-card[data-chronicle="ashfall"]').evaluate((c) => c.classList.contains("done")), true);
  await tap(".chron-back");
  await page.locator(".chron-section").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => window.__frontier.chronicle.campaign), "main");
  assert.match(await page.evaluate(() => document.querySelector("#operation-label").textContent), /^CAMPAIGN · MISSION 05 \/ 12$/);
  assert.deepEqual(errors, [], "defence chronicle: page errors");
  await page.close();

  // Optional: the first mission of the other two chronicles, for the screenshots of each chronicle in play.
  if (process.env.CHRONICLES_ALL) for (const viewport of ["desktop", "portrait"]) for (const id of ["ashfall", "wardens"]) {
    const p = await openPage(browser, viewport);
    await p.goto();
    await p.page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progressWith(4)]);
    await p.page.reload(); await p.ready();
    await p.tap('[data-mode="campaign"]');
    await p.tap(`.chron-entry[data-chronicle="${id}"]`);
    await p.tap("#start");
    await p.page.locator("#mission-briefing").waitFor({ state: "visible" });
    await p.tap("#mb-skip"); await p.tap("#mb-next");
    await p.page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    assert.equal(await p.page.evaluate(() => window.__frontier.sim.factions[0]), id);
    await p.page.evaluate(() => window.__frontier.step(20));
    await p.page.waitForTimeout(400);
    await shot(p.page, `chronicles-play-${id}-${viewport}`);
    assert.deepEqual(p.errors, [], `${viewport} ${id}: page errors`);
    await p.page.close();
  }
}, { browser });
