// 0.19a "Choices" in the browser: the campaign map (fresh, mid-campaign with decisions, complete
// with an ending seen), the choice card (keys 1 and 2, 44 px orders, focus kept inside, restored
// by Continue, Vietnamese) and the epilogue, at the three standard viewports. Text 11 px or more,
// taps 44 px or more and no sideways scroll everywhere. Screenshots go to test-results/choices-*.
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";

const KEY = "frontier-campaign-v2", SETTINGS = "frontier-command.settings.v1";
const ids = MISSIONS.map((m) => m.id);
const MEDALS = ["gold", "silver", "bronze"];
const progressWith = (count, extra = {}) => ({ cleared: Object.fromEntries(ids.slice(0, count).map((id, i) => [id, { time: 300 + i * 30, medal: MEDALS[i % 3], difficulty: "standard" }])), ...extra });
const MERCY = { "m03-alloy": "return", "m05-pact": "share", "m10-veil": "spare" };
const ASHEN = ids.indexOf("m03-the-ashen-line"), LAST = ids.length - 1;

// Visible text under `scope` smaller than 11 px, visible buttons smaller than 44 px or outside the
// viewport, and whether the page scrolls sideways.
const audit = (page, scope) => page.evaluate((scope) => {
  const root = document.querySelector(scope), visible = (el) => { const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
  const small = [];
  for (const el of root.querySelectorAll("*")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || !visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 11) small.push(`${el.textContent.trim().slice(0, 24)} (${size}px)`);
  }
  const buttons = [...root.querySelectorAll("button")].filter(visible).map((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), left: r.left, right: r.right, text: b.textContent.trim().slice(0, 24) }; });
  return { small, tiny: buttons.filter((b) => b.w < 44 || b.h < 44), outside: buttons.filter((b) => b.left < -0.5 || b.right > innerWidth + 0.5), sideways: document.documentElement.scrollWidth > innerWidth, count: buttons.length };
}, scope);
const clean = (result, where) => {
  assert.deepEqual(result.small, [], `${where}: text under 11 px`);
  assert.deepEqual(result.tiny, [], `${where}: buttons under 44 px`);
  assert.deepEqual(result.outside, [], `${where}: buttons outside the screen`);
  assert.equal(result.sideways, false, `${where}: sideways scroll`);
};

const browser = await launchBrowser();
await suite("choices: campaign map, choice card and epilogue", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    const campaign = async () => { await tap('[data-mode="campaign"]'); await page.locator("#campaign-map .cmap").waitFor({ state: "visible" }); };
    const load = async (progress, extra = "") => { await goto(extra); await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progress]); await page.reload(); await ready(); };

    // 1. A fresh campaign: one open relay, the rest locked, nothing lit, no ending, the chronicles slot.
    await load(null);
    await campaign();
    const fresh = await page.evaluate(() => ({ nodes: [...document.querySelectorAll(".cmap-node")].map((n) => n.disabled), lit: document.querySelector(".cmap").dataset.lit, seen: document.querySelectorAll(".cmap-ending.seen").length, chronicles: !!document.querySelector(".cmap-chronicles"), art: getComputedStyle(document.querySelector(".briefing-art")).display }));
    assert.deepEqual(fresh.nodes, [false, ...Array(LAST).fill(true)]);
    assert.deepEqual([fresh.lit, fresh.seen, fresh.chronicles, fresh.art], ["0", 0, true, "none"]);
    clean(await audit(page, "#campaign-map"), `${viewport} fresh map`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await shot(page, `choices-map-fresh-${viewport}`);

    // 2. Mid-campaign: five relays lit in medal colours, two decisions marked, a map node picks a mission.
    await load(progressWith(5, { decisions: { "m03-alloy": "return", "m05-pact": "drive" } }));
    await campaign();
    const mid = await page.evaluate(() => ({ lit: document.querySelector(".cmap").dataset.lit, medals: [...document.querySelectorAll(".cmap-node.done")].map((n) => [...n.classList].find((c) => c.startsWith("medal-"))), marks: [...document.querySelectorAll(".cmap-node .cmap-choice")].map((i) => i.classList.contains("mercy") ? "mercy" : "firm"), chips: document.querySelectorAll("#campaign-setup .stage-choice").length, next: document.querySelector(".cmap-node.next")?.dataset.mapStage }));
    assert.equal(mid.lit, "5");
    assert.deepEqual(mid.medals, ["medal-gold", "medal-silver", "medal-bronze", "medal-gold", "medal-silver"]);
    assert.deepEqual(mid.marks, ["mercy", "firm"], "the decisions sit on missions 3 and 5");
    assert.equal(mid.chips, 2, "the list shows them too");
    assert.equal(mid.next, "5", "the sixth relay (The Verdant Pact) is next");
    await tap('.cmap-node[data-map-stage="2"]');
    assert.equal(await page.locator('[data-stage="2"]').getAttribute("aria-current"), "true", "a relay node picks its mission");
    assert.match(await page.locator(".map-heading h1").innerText(), /Mission 3/);
    clean(await audit(page, "#campaign-map"), `${viewport} mid map`);
    await shot(page, `choices-map-mid-${viewport}`);

    // 3. Complete, with one ending seen: its mark replays the epilogue.
    await load(progressWith(ids.length, { decisions: MERCY, endingsSeen: ["open-frontier"] }));
    await campaign();
    assert.deepEqual(await page.evaluate(() => [document.querySelector(".cmap").dataset.lit, [...document.querySelectorAll(".cmap-ending.seen")].map((b) => b.dataset.ending), document.querySelectorAll(".cmap-ending.unseen").length]), [String(ids.length), ["open-frontier"], 1]);
    clean(await audit(page, "#campaign-map"), `${viewport} complete map`);
    await shot(page, `choices-map-complete-${viewport}`);
    await tap(".cmap-ending.seen");
    await page.locator("#epilogue").waitFor({ state: "visible" });
    assert.equal(await page.locator("#ep-title").innerText(), "The Open Frontier");
    assert.match(await page.locator("#ep-name").innerText(), /Vale/);
    clean(await audit(page, "#epilogue"), `${viewport} epilogue`);
    await shot(page, `choices-epilogue-${viewport}`);
    for (let i = 0; i < 4; i++) await tap("#ep-next");
    assert.match(await page.locator("#ep-name").innerText(), /ECHO/);
    assert.equal((await page.locator("#ep-next").innerText()).trim(), "Close");
    assert.equal(await page.locator("#ep-skip").isHidden(), true);
    await tap("#ep-next");
    await page.locator("#epilogue").waitFor({ state: "hidden" });
    // The test hook reaches either ending's epilogue; Escape closes it.
    await page.evaluate(() => window.__frontier.epilogue("meridian-line"));
    assert.equal(await page.locator("#ep-title").innerText(), "The Meridian Line");
    if (!mobile) { await page.keyboard.press("Escape"); await page.locator("#epilogue").waitFor({ state: "hidden" }); }
    else { await tap("#ep-skip"); await tap("#ep-next"); }

    // 4. The choice card in mission 3: the match holds, the orders are 44 px and keyboard-ready, a
    // save taken meanwhile brings the card back on Continue, and the answer is logged.
    await load(progressWith(ASHEN));
    await campaign();
    await tap(`[data-stage="${ASHEN}"]`);
    await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible" });
    await tap("#mb-skip"); await tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    await page.evaluate(() => { const s = window.__frontier.sim, u = s.own(0).find((e) => e.kind === "unit" && e.type !== "worker"); u.x = 0; u.z = -36; });
    await page.locator("#modal .decision-card").waitFor({ state: "visible", timeout: TIMEOUT.step });
    const card = await page.evaluate(() => window.__frontier.decision());
    assert.deepEqual([card.open, card.pending?.id, card.flags], [true, "m03-alloy", null]);
    const clock = await page.evaluate(() => window.__frontier.sim.time);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => window.__frontier.sim.time), clock, "the card holds the match");
    assert.equal(await page.evaluate(() => window.__frontier.paused), true);
    assert.equal(await page.locator("[data-decide]").count(), 2);
    assert.match(await page.locator(".decision-card .eyebrow").innerText(), /COMMANDER'S DECISION/);
    clean(await audit(page, "#modal"), `${viewport} choice card`);
    await shot(page, `choices-card-${viewport}`);
    if (!mobile) {
      // Escape and Space do not dismiss it; Tab stays inside the card.
      await page.keyboard.press("Escape");
      assert.equal((await page.evaluate(() => window.__frontier.decision())).open, true, "Escape does not close the card");
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
        assert.equal(await page.evaluate(() => document.querySelector("#modal").contains(document.activeElement)), true, "focus stays in the card");
      }
    }
    assert.ok(await page.evaluate(() => window.__frontier.save()), "the match saves with the card open");
    // Desktop also checks the card in Vietnamese after Continue.
    if (viewport === "desktop") await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k) || "{}"); s.language = "vi"; localStorage.setItem(k, JSON.stringify(s)); }, SETTINGS);
    await page.reload(); await ready();
    await tap("#continue");
    await page.locator("#modal .decision-card").waitFor({ state: "visible", timeout: TIMEOUT.models });
    assert.equal((await page.evaluate(() => window.__frontier.decision())).pending?.id, "m03-alloy", "Continue restores the card");
    if (viewport === "desktop") {
      await page.waitForFunction(() => document.querySelector(".decision-card .eyebrow").textContent.includes("QUYẾT ĐỊNH"), null, { timeout: TIMEOUT.step });
      const vi = await page.evaluate(() => [...document.querySelectorAll(".decision-card strong, .decision-card small, .decision-prompt")].map((e) => e.textContent));
      assert.ok(vi.some((t) => t.includes("Trả hợp kim")), JSON.stringify(vi));
      assert.ok(vi.some((t) => t.includes("hợp kim")) && !vi.some((t) => /Return the alloy|Keep the alloy/.test(t)), "the orders are in Vietnamese");
      clean(await audit(page, "#modal"), "desktop choice card in Vietnamese");
      await shot(page, "choices-card-vi-desktop");
      await page.keyboard.press("1");
    } else await tap('[data-decide="keep"]');
    await page.waitForFunction(() => !window.__frontier.decision().open);
    const after = await page.evaluate(() => ({ flags: window.__frontier.sim.flags, paused: window.__frontier.paused, log: window.__frontier.sim.commandLog.filter((c) => c.type === "decide").map((c) => c.option) }));
    const answer = viewport === "desktop" ? "return" : "keep";
    assert.deepEqual(after.flags, { "m03-alloy": answer });
    assert.deepEqual(after.log, [answer], "the answer is in the command log");
    assert.equal(after.paused, false, "the match runs again");
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }

  // 5. The finale won with two or more merciful answers: debrief, epilogue, back to the map with the ending marked.
  const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
  await goto();
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progressWith(LAST, { decisions: MERCY })]);
  await page.reload(); await ready();
  await tap('[data-mode="campaign"]');
  assert.equal(await page.locator(`[data-stage="${LAST}"]`).getAttribute("aria-current"), "true");
  await tap("#start");
  await page.locator("#mission-briefing").waitFor({ state: "visible" });
  await tap("#mb-skip");
  assert.match(await page.locator("#mb-objectives").innerText(), /open the Keystone to every camp/, "the finale's last objective follows the ending");
  await tap("#mb-next");
  await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
  await page.evaluate(() => { const s = window.__frontier.sim; for (const id of s.missionDef.win) s.setObjective(id, "done"); });
  // The ending beat plays first (0.19b): the open-frontier scene, then the debrief.
  await page.waitForFunction(() => window.__frontier.scene().open, null, { timeout: TIMEOUT.step });
  assert.equal((await page.evaluate(() => window.__frontier.scene())).id, "keystone-open", "the finale's scene follows the ending");
  await page.evaluate(() => window.__frontier.skipScene());
  await page.locator("[data-epilogue]").waitFor({ state: "visible", timeout: TIMEOUT.step });
  assert.equal(await page.locator("[data-epilogue]").getAttribute("data-epilogue"), "open-frontier");
  assert.match(await page.locator("#modal-content").innerText(), /Every camp at one table/);
  assert.deepEqual(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).endingsSeen, KEY), ["open-frontier"]);
  await tap("[data-epilogue]");
  await page.locator("#epilogue").waitFor({ state: "visible" });
  for (let i = 0; i < 4; i++) await tap("#ep-next");
  assert.match(await page.locator("#ep-next").innerText(), /Campaign map/);
  await tap("#ep-next");
  await page.locator("#briefing").waitFor({ state: "visible" });
  await page.locator(".cmap-ending.seen.open-frontier").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => window.__frontier.started), false);
  assert.deepEqual(errors, [], "finale: page errors");
  await page.close();
}, { browser });
