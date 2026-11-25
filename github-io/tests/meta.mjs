// W6 replay value at 1440x900, 390x844 and 844x390 (src/meta-ui.js):
//   - the title's Records tile (one tap, 44 px) opens the Records screen: 25 achievements with their progress,
//     11 px text, 44 px taps, no sideways scroll, nothing grouped behind a menu; Close returns to the title;
//   - today's three challenges (the date pinned with ?day=2026-11-25: Iron line, Expedition, Promotion) are
//     direct tiles under the quick row; one tap picks the challenge's mode; a win that meets one pays +50 XP once
//     and the tile reads Done back on the title;
//   - five achievements unlock the Silverline paint (medal cosmetics): a "Reward unlocked" toast, the Records
//     screen lists it as open, and it is one tap in the Skirmish setup's Paint row (looks only, no rule);
//   - the Records screen's match history lists the finished match (result, mode, sides, time, kills),
//     reached with its own jump button at the top of the screen;
//   - an achievement reached mid-match shows its toast at the top (taps pass through, never over the dock),
//     and a scripted Skirmish win lists "Achievements earned" on the results screen.
// Screenshots: test-results/meta-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.META_VIEWPORTS || "desktop,portrait,landscape").split(",");

// Visible text under 11 px, visible enabled controls under 44 px, page wider than the screen.
const tiny = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(`${selector} *`)].filter((el) => el.getClientRects().length && !el.closest("svg") && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.textContent.trim().slice(0, 30)), selector);
const small = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(selector)].filter((el) => el.getClientRects().length && !el.disabled).map((el) => { const r = el.getBoundingClientRect(); return [el.id || el.textContent.trim().slice(0, 16), Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 44), selector);
const noSideScroll = async (page, where) => {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
};
const meta = (page) => page.evaluate(() => window.__frontier.meta.info());
async function startMatch(o) {
  await o.ready();
  await o.page.locator("#start").scrollIntoViewIfNeeded();
  await o.tap("#start");
  await o.page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
}

await suite("meta", async () => {
  for (const viewport of VIEWPORTS) {
    const o = await openPage(browser, viewport, { timeout: TIMEOUT.models }), { page, errors } = o;
    await o.goto("day=2026-11-25");
    await o.ready();

    // ---- Today's challenges: three direct tiles; one tap picks the mode.
    const tiles = page.locator("#daily-challenges [data-challenge]");
    await tiles.first().waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.deepEqual(await tiles.evaluateAll((b) => b.map((x) => x.dataset.challenge)), ["sk-lean", "cp-win", "df-rank"], `${viewport}: the day's set`);
    assert.deepEqual(await small(page, "#daily-challenges button"), [], `${viewport}: challenge taps`);
    assert.deepEqual(await tiny(page, "#daily-challenges"), [], `${viewport}: challenge text`);
    const cut = await page.evaluate(() => [...document.querySelectorAll("#daily-challenges button")].filter((b) => [...b.querySelectorAll("strong, small, b")].some((t) => { const r = t.getBoundingClientRect(), o = b.getBoundingClientRect(); return r.right > o.right + 1 || r.bottom > o.bottom + 1; })).map((b) => b.dataset.challenge));
    assert.deepEqual(cut, [], `${viewport}: challenge text fits its tiles`);
    await noSideScroll(page, `${viewport} title`);
    await page.locator("#daily-challenges").scrollIntoViewIfNeeded();
    await shot(page, `meta-title-${viewport}`);
    await page.locator('#daily-challenges [data-challenge="cp-win"]').scrollIntoViewIfNeeded();
    await o.tap('#daily-challenges [data-challenge="cp-win"]');
    await page.waitForFunction(() => document.querySelector('#briefing .mode-switch [data-mode="campaign"]').getAttribute("aria-pressed") === "true", null, { timeout: TIMEOUT.step });
    await page.locator('#briefing .mode-switch [data-mode="skirmish"]').scrollIntoViewIfNeeded();
    await o.tap('#briefing .mode-switch [data-mode="skirmish"]');
    await page.waitForFunction(() => document.querySelector('#briefing .mode-switch [data-mode="skirmish"]').getAttribute("aria-pressed") === "true", null, { timeout: TIMEOUT.step });

    // ---- The Records tile and screen.
    const tile = page.locator("#records-open");
    await tile.waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.match((await tile.textContent()).replace(/\s+/g, " "), /Records.*0 \/ 25/, `${viewport}: the tile counts 0 / 25`);
    assert.deepEqual(await small(page, "#title-actions button"), [], `${viewport}: quick row taps`);
    assert.deepEqual(await tiny(page, "#title-actions"), [], `${viewport}: quick row text`);
    const clipped = await page.evaluate(() => [...document.querySelectorAll("#title-actions button")].filter((b) => [...b.querySelectorAll("strong, small")].some((t) => t.getBoundingClientRect().right > b.getBoundingClientRect().right + 1)).map((b) => b.id));
    assert.deepEqual(clipped, [], `${viewport}: quick row text fits its tiles`);
    await tile.scrollIntoViewIfNeeded();
    await o.tap("#records-open");
    await page.locator("#records[open]").waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.equal(await page.locator("#records [data-ach]").count(), 25, `${viewport}: 25 achievements listed`);
    assert.equal(await page.locator("#records [data-challenge]").count(), 3, `${viewport}: today's challenges listed`);
    assert.equal(await page.locator("#records [data-ach].done").count(), 0, `${viewport}: none earned yet`);
    assert.deepEqual(await tiny(page, "#records"), [], `${viewport}: Records text`);
    assert.deepEqual(await small(page, "#records button"), [], `${viewport}: Records taps`);
    assert.equal(await page.locator("#records details, #records [aria-haspopup], #records .more").count(), 0, `${viewport}: nothing grouped`);
    const inside = await page.evaluate(() => { const r = document.querySelector("#records").getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; });
    assert.ok(inside, `${viewport}: the Records screen fits the screen`);
    await noSideScroll(page, `${viewport} records`);
    await shot(page, `meta-records-${viewport}`);
    await o.tap("#records [data-records-close]");
    await page.waitForFunction(() => !document.querySelector("#records").open, null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate(() => !window.__frontier.started && !document.querySelector("#briefing").hidden), true, `${viewport}: back on the title`);

    // ---- Medal cosmetics: five achievements (Kites, taming, the Field commander) unlock the Silverline paint.
    const lockedPaint = page.locator('#rank-unlocks [data-rank-kind="paint"] [data-rank-item="silverline"]');
    assert.equal(await lockedPaint.isDisabled(), true, `${viewport}: Silverline locked at first`);
    assert.match(await lockedPaint.textContent(), /5 achievements/, `${viewport}: the locked tile says how to earn it`);
    await page.evaluate(() => { const h = window.__frontier.meta; h.record = { ...h.record, kites: 10, tamed: 1, fieldRank: 5, branchWins: ["artillery", "rally"] }; });
    await page.waitForFunction(() => /Reward unlocked/.test(document.querySelector("#meta-toast:not([hidden])")?.textContent || "") || window.__frontier.meta.info().record.meta.ach >= 5, null, { timeout: TIMEOUT.step });
    assert.equal((await meta(page)).record.meta.ach, 5, `${viewport}: five achievements`);
    await page.locator('#rank-unlocks [data-rank-item="silverline"]:not([disabled])').waitFor({ state: "attached", timeout: TIMEOUT.step });
    await o.tap("#records-open");
    await page.locator("#records[open]").waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.equal(await page.locator('#records [data-reward="paint:silverline"].done').count(), 1, `${viewport}: Records lists Silverline as open`);
    assert.equal(await page.locator("#records [data-reward]").count(), 9, `${viewport}: every reward listed`);
    await page.locator("#records-rewards").scrollIntoViewIfNeeded();
    assert.deepEqual(await tiny(page, "#records"), [], `${viewport}: rewards text`);
    await shot(page, `meta-rewards-${viewport}`);
    await o.tap("#records [data-records-close]");
    await page.waitForFunction(() => !document.querySelector("#records").open, null, { timeout: TIMEOUT.step });
    const paint = page.locator('#rank-unlocks [data-rank-kind="paint"] [data-rank-item="silverline"]');
    await paint.scrollIntoViewIfNeeded();
    const reachable = await paint.evaluate((b) => { const r = b.getBoundingClientRect(); return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); });
    assert.ok(reachable, `${viewport}: Silverline is one tap`);
    await o.tap('#rank-unlocks [data-rank-kind="paint"] [data-rank-item="silverline"]');
    await page.waitForFunction(() => window.__frontier.rank().paint === "silverline", null, { timeout: TIMEOUT.step });
    assert.deepEqual(await small(page, "#rank-unlocks button"), [], `${viewport}: picker taps`);
    await shot(page, `meta-picker-${viewport}`);

    // ---- Mid-match: a counter reaches an achievement (three Kite Dives), its toast shows, taps pass through.
    await startMatch(o);
    await page.evaluate(() => { window.__frontier.hold = true; });
    await page.evaluate(() => { const h = window.__frontier.meta; h.record = { ...h.record, dives: 2 }; });
    // The Dive's own event, sent on the next tick as the simulation sends it (the match counters read each tick's events).
    await page.evaluate(() => { const s = window.__frontier.sim, tick = s.tick.bind(s); s.tick = (dt) => { tick(dt); delete s.tick; s.events.push({ type: "death", team: 0, dive: true, x: 0, z: 0 }); }; window.__frontier.step(0.05); });
    assert.equal(await page.evaluate(() => window.__frontier.meta.info().record.dives), 2, `${viewport}: a live match is not added before it ends`);
    await page.evaluate(() => window.__frontier.meta.liveCheck());
    await page.locator("#meta-toast:not([hidden])").waitFor({ state: "visible", timeout: TIMEOUT.step });
    const toast = await page.evaluate(() => { const t = document.querySelector("#meta-toast"), r = t.getBoundingClientRect(), dock = document.querySelector(".bottom-dock")?.getBoundingClientRect(); return { text: t.textContent.replace(/\s+/g, " ").trim(), events: getComputedStyle(t).pointerEvents, clear: !dock || !dock.height || r.bottom <= dock.top + 1, inside: r.left >= 0 && r.right <= innerWidth }; });
    assert.match(toast.text, /Achievement earned.*Falling star/, `${viewport}: toast (${toast.text})`);
    assert.equal(toast.events, "none", `${viewport}: taps pass through the toast`);
    assert.ok(toast.clear && toast.inside, `${viewport}: the toast is on screen, above the dock`);
    assert.deepEqual(await tiny(page, "#meta-toast"), [], `${viewport}: toast text`);
    assert.ok((await meta(page)).record.earned.includes("falling-star"), `${viewport}: kept in the record`);
    await shot(page, `meta-toast-${viewport}`);

    // ---- A scripted Skirmish win: "Achievements earned" on the results, and the record counts the win.
    await page.evaluate(() => { window.__frontier.hold = false; const s = window.__frontier.sim; s.tick = () => { s.result = "victory"; delete s.tick; }; });
    await page.locator(".result-card").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await page.locator("#modal .meta-earned").first().waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.match(await page.locator("#modal .meta-earned:not(.meta-earned-challenges)").textContent(), /Field victory/, `${viewport}: Field victory listed`);
    assert.match((await page.locator("#modal .meta-earned-challenges").textContent()).replace(/\s+/g, " "), /Challenges complete.*Iron line \+50 XP/, `${viewport}: Iron line paid`);
    const after = await meta(page);
    assert.equal(after.record.skirmishWins, 1, `${viewport}: the win is counted`);
    assert.deepEqual(after.last.earned, ["skirmish-win"], `${viewport}: earned by this match`);
    assert.deepEqual([after.last.challenges, after.last.xp, after.challenges.done], [["sk-lean"], 50, ["sk-lean"]], `${viewport}: the challenge is done and paid`);
    assert.deepEqual(await tiny(page, "#modal .meta-earned"), [], `${viewport}: results row text`);
    await noSideScroll(page, `${viewport} results`);
    await page.locator("#modal .meta-earned").last().scrollIntoViewIfNeeded();
    await shot(page, `meta-results-${viewport}`);

    // ---- Back on the title: the challenge tile reads Done.
    await o.tap(".result-actions [data-new-game]");
    await page.waitForFunction(() => !window.__frontier.started && !document.querySelector("#briefing").hidden, null, { timeout: TIMEOUT.models });
    await page.waitForFunction(() => document.querySelector('#daily-challenges [data-challenge="sk-lean"]')?.classList.contains("done"), null, { timeout: TIMEOUT.step });
    assert.match(await page.locator('#daily-challenges [data-challenge="sk-lean"]').textContent(), /Done/, `${viewport}: Done on the title`);

    // ---- Match history: the win is the first row; the History jump button brings it into view.
    await page.locator("#records-open").scrollIntoViewIfNeeded();
    await o.tap("#records-open");
    await page.locator("#records[open]").waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.equal(await page.locator("#records [data-match]").count(), 1, `${viewport}: one match in the history`);
    const row = (await page.locator("#records [data-match]").first().textContent()).replace(/\s+/g, " ");
    assert.match(row, /Victory.*Meridian Riverlands.*Skirmish.*Meridian vs Meridian.*0:0\d.*Kills.*Units lost/, `${viewport}: the row (${row})`);
    assert.deepEqual(await small(page, "#records button"), [], `${viewport}: Records taps with history`);
    await o.tap('#records [data-records-jump="records-history"]');
    await page.waitForFunction(() => { const h = document.querySelector("#records-history").getBoundingClientRect(), b = document.querySelector("#records .records-body").getBoundingClientRect(); return h.top >= b.top - 2 && h.top < b.top + 60; }, null, { timeout: TIMEOUT.step });
    assert.deepEqual(await tiny(page, "#records"), [], `${viewport}: history text`);
    await noSideScroll(page, `${viewport} history`);
    await shot(page, `meta-history-${viewport}`);
    await o.tap("#records [data-records-close]");
    await page.waitForFunction(() => !document.querySelector("#records").open, null, { timeout: TIMEOUT.step });
    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }
}, { browser });
