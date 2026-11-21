// Commander rank and unlocks (AAA round 3, R3-R) at 1440x900, 390x844 and 844x390:
//   - a fresh profile shows "Rank 1 · Recruit" on the title chip, and the skirmish setup's Commander rows show
//     the defaults picked and the next unlock (Sand paint, rank 2) locked;
//   - a scripted win puts the rank toast on the results ("Rank up!", "Unlocked:", Paint · Sand), one tap to
//     leave (nothing grouped), 11 px text, 44 px taps, no sideways scroll;
//   - back on the title: Rank 2, and the Sand paint can be picked with one tap; the next match paints the
//     player's units (instanceColor tint) and only them, while the match's rules stay empty (no pick is a rule);
//   - a reload keeps the rank and the pick (localStorage).
// Screenshots: test-results/rank-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.RANK_VIEWPORTS || "desktop,portrait,landscape").split(",");

const tiny = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(`${selector}, ${selector} *`)].filter((el) => el.offsetParent !== null && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.textContent.trim()), selector);
const small = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(selector)].filter((el) => el.offsetParent !== null).map((el) => el.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`), selector);
const noSideScroll = async (page, where) => {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
};
const rank = (page) => page.evaluate(() => window.__frontier.rank());
const chipText = (page) => page.evaluate(() => document.querySelector("#rank-chip")?.textContent.replace(/\s+/g, " ").trim() || "");
const paintButtons = (page) => page.evaluate(() => [...document.querySelectorAll('#rank-unlocks [data-rank-kind="paint"] [data-rank-item]')].map((b) => ({ id: b.dataset.rankItem, pressed: b.getAttribute("aria-pressed"), disabled: b.disabled })));
// A one-tap pick: scrolled into its column, the button's centre must reach the button itself.
async function tapItem(o, kind, id) {
  const sel = `#rank-unlocks [data-rank-kind="${kind}"] [data-rank-item="${id}"]`;
  await o.page.locator(sel).scrollIntoViewIfNeeded();
  const reachable = await o.page.evaluate((sel) => { const b = document.querySelector(sel), r = b.getBoundingClientRect(); return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }, sel);
  assert.ok(reachable, `${sel}: reachable with one tap`);
  await o.tap(sel);
}
async function startMatch(o) {
  await o.ready();
  await o.page.locator("#start").scrollIntoViewIfNeeded();
  await o.tap("#start");
  await o.page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
}

await suite("rank", async () => {
  for (const viewport of VIEWPORTS) {
    const o = await openPage(browser, viewport, { timeout: TIMEOUT.models }), { page, errors } = o;
    await o.goto();
    await o.ready();

    // ---- A fresh profile: rank 1 on the title, defaults picked, the next unlock locked.
    assert.equal((await rank(page)).rank, 1, `${viewport}: a fresh profile is rank 1`);
    assert.match(await chipText(page), /Rank 1(?!\d).*Recruit/, `${viewport}: the title chip shows rank 1`);
    assert.ok(await page.locator("#rank-chip").isVisible(), `${viewport}: the chip is on the title`);
    assert.deepEqual(await paintButtons(page), [{ id: "factory", pressed: "true", disabled: false }, { id: "sand", pressed: "false", disabled: true }], `${viewport}: Factory picked, Sand locked`);
    assert.deepEqual(await tiny(page, "#rank-chip"), [], `${viewport}: chip text under 11 px`);
    assert.deepEqual(await tiny(page, "#rank-unlocks"), [], `${viewport}: picker text under 11 px`);
    assert.deepEqual(await small(page, "#rank-unlocks button"), [], `${viewport}: picker taps under 44 px`);
    assert.equal(await page.locator("#rank-unlocks details, #rank-unlocks [aria-haspopup], #rank-unlocks .more").count(), 0, `${viewport}: nothing grouped behind a menu`);
    await noSideScroll(page, `${viewport} title`);
    await page.waitForTimeout(1500); // the loading screen fades out
    await shot(page, `rank-title-${viewport}`);
    await page.locator("#rank-unlocks").scrollIntoViewIfNeeded();
    await shot(page, `rank-setup-fresh-${viewport}`);

    // ---- A scripted win: the rank toast on the results.
    await startMatch(o);
    await page.evaluate(() => { const s = window.__frontier.sim; s.tick = () => { s.result = "victory"; delete s.tick; }; });
    await page.locator(".result-card").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await page.locator("#modal .rank-toast").waitFor({ state: "visible", timeout: TIMEOUT.step });
    const toast = await page.evaluate(() => { const t = document.querySelector("#modal .rank-toast"); return { up: t.dataset.rankUp, text: t.textContent.replace(/\s+/g, " ").trim(), before: !!t.nextElementSibling?.matches(".result-actions") }; });
    assert.equal(toast.up, "true", `${viewport}: the win is a rank up`);
    assert.match(toast.text, /Rank up!.*Rank 2.*Private.*Unlocked:.*Paint · Sand/, `${viewport}: "Rank up! Unlocked: Paint · Sand" (${toast.text})`);
    assert.ok(toast.before, `${viewport}: the toast sits above the result actions`);
    const r2 = await rank(page);
    assert.deepEqual([r2.rank, r2.last.rankUp, r2.last.unlocked], [2, true, ["paint:sand"]], `${viewport}: the profile ranked up`);
    assert.deepEqual(await tiny(page, "#modal .rank-toast"), [], `${viewport}: toast text under 11 px`);
    assert.deepEqual(await small(page, "#modal .result-actions button"), [], `${viewport}: result taps under 44 px`);
    assert.equal(await page.locator("#modal details, #modal [aria-haspopup], #modal .more").count(), 0, `${viewport}: nothing grouped behind a menu`);
    const fits = await page.evaluate(() => { const r = document.querySelector("#modal .modal").getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; });
    assert.ok(fits, `${viewport}: the results card still fits the screen`);
    await noSideScroll(page, `${viewport} results`);
    await page.locator("#modal .rank-toast").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await shot(page, `rank-toast-${viewport}`);

    // ---- Back to the title: rank 2, and the Sand paint is one tap.
    await o.tap(".result-actions [data-new-game]");
    await page.waitForFunction(() => !window.__frontier.started && !document.querySelector("#briefing").hidden, null, { timeout: TIMEOUT.models });
    await o.ready();
    assert.match(await chipText(page), /Rank 2(?!\d).*Private/, `${viewport}: the chip shows rank 2`);
    assert.deepEqual((await paintButtons(page)).find((b) => b.id === "sand"), { id: "sand", pressed: "false", disabled: false }, `${viewport}: Sand is open`);
    await tapItem(o, "paint", "sand");
    assert.deepEqual((await paintButtons(page)).filter((b) => b.pressed === "true").map((b) => b.id), ["sand"], `${viewport}: Sand picked`);
    assert.equal((await rank(page)).paint, "sand");
    await shot(page, `rank-setup-sand-${viewport}`);

    // ---- The next match: the player's units wear the paint, enemies and buildings do not; no rule key.
    await startMatch(o);
    await page.waitForTimeout(300);
    const paint = await page.evaluate(() => {
      const f = window.__frontier, out = { mine: 0, mineTinted: 0, others: 0, othersTinted: 0, rules: f.sim.rules ?? null };
      for (const e of f.sim.entities) {
        const root = f.view.objects.get(e.id), model = root?.userData.model;
        if (!model || e.kind !== "unit") continue;
        const parts = [];
        model.traverse((p) => { if (p.isMesh) parts.push(p); });
        const tinted = parts.length > 0 && parts.every((p) => Array.isArray(p.userData.tint) && Math.abs(p.userData.tint[2] - 0.56) < 1e-6); // Sand's blue factor
        if (e.team === 0) { out.mine++; if (tinted) out.mineTinted++; } else { out.others++; if (parts.some((p) => p.userData.tint)) out.othersTinted++; }
      }
      return out;
    });
    assert.ok(paint.mine > 0 && paint.mineTinted === paint.mine, `${viewport}: every player unit wears Sand (${JSON.stringify(paint)})`);
    assert.equal(paint.othersTinted, 0, `${viewport}: no enemy unit is painted`);
    assert.equal(paint.rules, null, `${viewport}: the match's rules stay empty`);
    if (viewport === "desktop") {
      await page.evaluate(() => { const f = window.__frontier, u = f.sim.own(0).find((e) => e.kind === "unit" && e.type !== "worker") || f.sim.own(0).find((e) => e.kind === "unit"); f.select([u.id]); });
      await page.waitForTimeout(400);
      await shot(page, "rank-paint-sand-desktop");
    }

    // ---- A reload keeps the rank and the pick.
    await o.goto();
    await o.ready();
    const kept = await rank(page);
    assert.deepEqual([kept.rank, kept.picks.paint, kept.paint], [2, "sand", "sand"], `${viewport}: the profile survives a reload`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
