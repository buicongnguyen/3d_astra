// H1/H2 Skywing and coins in the browser (src/skywing-ui.js, src/sim/content/skywing.js, src/meta/coins.js):
//   desktop    the 44 px coin chip on the title; a mission briefing after two losses suggests Skywing once;
//              buying it on the briefing row (Off / On), Skywing on the field with its ASSIST plate; a won
//              mission's debrief counts the coins.
//   portrait   the skirmish setup's row; with too few coins On is shown but disabled; buying it; the plate
//              selects Skywing in one tap; the weapon switch (Sniper | Rocket, 44 px each) swaps in about 1 s.
//   landscape  the Defence menu's row; buying it; Skywing flies on its own; a lost level still pays coins.
//   desktop-vi the row and the debrief read in Vietnamese.
// Every row: both choices visible, taps >= 44 px, text >= 11 px, no system-ui, no sideways scroll; the coin chip
// never shows in battle. The match clock is held (window.__frontier.hold) and moved only with step().
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import * as sheet from "./lib/settings-sheet.mjs";

const COINS = "frontier-coins-v1";
const wallet = (over = {}) => ({ v: 1, coins: 100, earned: 0, spent: 0, won: [], losses: {}, hinted: [], day: null, paidAch: [], ...over });

// Size and type checks for everything under `selector` that is visible.
async function audit(page, selector, label) {
  const bad = await page.evaluate((sel) => {
    const out = [];
    for (const root of document.querySelectorAll(sel)) {
      if (!root.offsetParent && getComputedStyle(root).position !== "fixed") continue;
      for (const b of root.querySelectorAll("button")) { const r = b.getBoundingClientRect(); if (r.width && (r.width < 44 || r.height < 44)) out.push(`tap ${b.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`); }
      for (const n of root.querySelectorAll("*")) {
        if (!n.childNodes.length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
        const cs = getComputedStyle(n);
        if (parseFloat(cs.fontSize) < 11) out.push(`text ${n.textContent.trim().slice(0, 20)} ${cs.fontSize}`);
        if (/system-ui/.test(cs.fontFamily)) out.push(`system-ui ${n.tagName}`);
      }
    }
    return out;
  }, selector);
  assert.deepEqual(bad, [], `${label}: ${bad.join(", ")}`);
}
// The menus redraw their rows (the Defence menu rebuilds its whole panel): scroll by selector, never a held handle.
async function reveal(page, where) {
  await page.waitForFunction((w) => !!document.querySelector(`[data-assist-where="${w}"]`), where, { timeout: TIMEOUT.step });
  await page.evaluate((w) => document.querySelector(`[data-assist-where="${w}"]`).scrollIntoView({ block: "center" }), where);
}
const noSideScroll = async (page, label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no sideways scroll`);
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), COINS);
async function seed(page, w, extra = {}) {
  await page.evaluate(([k, v, e]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); for (const [a, b] of Object.entries(e)) localStorage.setItem(a, JSON.stringify(b)); }, [COINS, w, extra]);
}
async function inBattle(page) {
  await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
  await page.evaluate(() => { const f = window.__frontier; f.hold = true; f.holdMessages = true; f.sim.explored[0].fill(1); });
  // The coin chip belongs to the menus: never on the battle HUD.
  assert.equal(await page.evaluate(() => { const c = document.querySelector("#coin-chip"); return !!c && !!c.offsetParent; }), false, "no coin chip in battle");
}
const skywing = (page) => page.evaluate(() => { const e = window.__frontier.sim.entities.find((u) => u.assist); return e ? { id: e.id, x: e.x, z: e.z, weapon: e.weapon, hp: e.hp, orders: e.orders.length } : null; });
async function end(page, result) {
  await page.evaluate((r) => { const f = window.__frontier, s = f.sim; f.hold = false; s.tick = () => { s.result = r; delete s.tick; }; }, result);
  await page.locator("#modal .coin-toast").waitFor({ state: "visible", timeout: TIMEOUT.step });
  await page.locator("#modal .coin-toast").scrollIntoViewIfNeeded();
  return page.evaluate(() => { const t = document.querySelector("#modal .coin-toast"); return { total: Number(t.dataset.total), text: t.textContent.replace(/\s+/g, " ").trim() }; });
}

const browser = await launchBrowser();
await suite("skywing: the coin chip, the Skywing row on every briefing, buying it, the hero on the field, the weapon switch and the debrief's coins", async () => {
  // ---------------------------------------------------------------- desktop: campaign
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await goto();
    await seed(page, wallet({ losses: { "m01-first-light": 2 } }));
    await page.reload(); await ready();
    const chip = await page.locator("#coin-chip .coin-chip").evaluate((c) => { const r = c.getBoundingClientRect(); return { h: r.height, text: c.textContent.replace(/\s+/g, " ").trim() }; });
    assert.ok(chip.h >= 44, `title coin chip ${chip.h} px`);
    assert.match(chip.text, /100 coins/);
    await audit(page, "#coin-chip", "desktop chip");
    await tap('[data-mode="campaign"]');
    await page.locator("#campaign-map .cmap").waitFor({ state: "visible" });
    await tap('[data-mission="m01-first-light"]');
    await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible" });
    await tap("#mb-skip");
    const row = page.locator('#mission-briefing [data-assist-where="mission"]');
    await row.waitFor({ state: "visible" });
    // Off is the default; both choices are visible in one row; the hint shows after two losses.
    assert.equal(await row.locator('[data-assist="off"]').getAttribute("aria-pressed"), "true");
    assert.ok(await row.locator('[data-assist="on"]').isVisible());
    assert.match(await row.innerText(), /Skywing assist[\s\S]*Off[\s\S]*On[\s\S]*60[\s\S]*coins/i);
    assert.match(await row.locator("[data-assist-hint]").innerText(), /Need help\? Take Skywing\./);
    assert.ok(await row.locator(".coin-chip").evaluate((c) => c.getBoundingClientRect().height >= 44), "the briefing's coin chip is 44 px");
    await audit(page, '#mission-briefing [data-assist-where="mission"]', "desktop briefing row");
    await shot(page, "skywing-briefing-desktop");
    // Back costs nothing.
    await tap('#mission-briefing [data-assist="on"]');
    assert.equal(await row.locator('[data-assist="on"]').getAttribute("aria-pressed"), "true");
    assert.equal((await stored(page)).coins, 100, "nothing paid before the match starts");
    await tap("#mb-next");
    await inBattle(page);
    const w = await stored(page);
    assert.equal(w.coins, 40, "60 coins paid as the mission began");
    assert.deepEqual(w.hinted, ["m01-first-light"], "the hint was given once");
    const e = await skywing(page);
    assert.ok(e && e.weapon === "sniper", "Skywing is on the field with the sniper");
    await page.evaluate((v) => window.__frontier.view.focusOn(v.x, v.z), e);
    const plate = page.locator('.hero-plate[data-hero="skywing"]');
    await plate.waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.match(await plate.innerText(), /Skywing\s*ASSIST/);
    assert.ok(await page.evaluate(() => { const m = window.__frontier.view.scene.getObjectByName("HeroRings"); return !!m && m.visible && m.count >= 1; }), "its gold ring");
    await shot(page, "skywing-field-desktop");
    const won = await end(page, "victory");
    // A first bronze win (40 + 10 + 30), the day's first match (20) and 25 for each new achievement.
    assert.ok(won.total >= 100 && (won.total - 100) % 25 === 0, `a first win pays ${won.total}`);
    assert.match(won.text, new RegExp(`Coins earned[\\s\\S]*\\+${won.total}[\\s\\S]*Mission won[\\s\\S]*First win[\\s\\S]*First match today[\\s\\S]*Coins ${40 + won.total}`));
    assert.equal((await stored(page)).coins, 40 + won.total);
    await audit(page, "#modal .coin-toast", "desktop debrief");
    await noSideScroll(page, "desktop");
    await shot(page, "skywing-debrief-desktop");
    assert.deepEqual(errors, [], "desktop: page errors");
    await page.close();
  }
  // ---------------------------------------------------------------- portrait: skirmish and the weapon switch
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "portrait");
    await goto();
    await seed(page, wallet({ coins: 30 }));
    await page.reload(); await ready();
    await tap('[data-mode="skirmish"]');
    const row = page.locator('[data-assist-where="skirmish"]');
    await reveal(page, "skirmish");
    assert.equal(await row.locator('[data-assist="on"]').isDisabled(), true, "30 coins: On is shown, but cannot be picked");
    assert.match(await row.innerText(), /Not enough coins/);
    await page.evaluate((k) => { localStorage.setItem(k, JSON.stringify({ v: 1, coins: 75 })); }, COINS);
    await page.reload(); await ready();
    await tap('[data-mode="skirmish"]');
    await reveal(page, "skirmish");
    await audit(page, '[data-assist-where="skirmish"]', "portrait skirmish row");
    await tap('[data-assist-where="skirmish"] [data-assist="on"]');
    await shot(page, "skywing-skirmish-portrait");
    await noSideScroll(page, "portrait setup");
    await tap("#start");
    await inBattle(page);
    assert.equal((await stored(page)).coins, 15);
    const e = await skywing(page);
    assert.ok(e, "Skywing in the skirmish");
    await page.evaluate((v) => { const f = window.__frontier; f.select([]); f.view.focusOn(v.x, v.z); }, e);
    await page.locator('.hero-plate[data-hero="skywing"]').waitFor({ state: "visible", timeout: TIMEOUT.step });
    await tap('.hero-plate[data-hero="skywing"]');
    await page.waitForFunction((id) => window.__frontier.selected.size === 1 && window.__frontier.selected.has(id), e.id, { timeout: TIMEOUT.step });
    const sw = page.locator(".weapon-control");
    await sw.waitFor({ state: "visible", timeout: TIMEOUT.step });
    const sizes = await sw.locator("[data-weapon]").evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, pressed: b.getAttribute("aria-pressed"), name: b.textContent.trim() }; }));
    assert.deepEqual(sizes.map((s) => [s.name, s.pressed]), [["Sniper", "true"], ["Rocket", "false"]], "both weapons always shown, the sniper in hand");
    for (const s of sizes) assert.ok(s.w >= 44 && s.h >= 44, `weapon tap ${s.name} ${s.w}x${s.h}`);
    assert.ok(await page.locator('[data-ability="skydive"]:visible').count(), "Dive strike on the ability bar");
    await tap('.weapon-control [data-weapon="rocket"]');
    await page.waitForFunction(() => window.__frontier.sim.entities.find((u) => u.assist)?.weaponTo === "rocket", null, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.step(1.2));
    await page.waitForFunction(() => window.__frontier.sim.heroWeapon(window.__frontier.sim.entities.find((u) => u.assist)) === "rocket", null, { timeout: TIMEOUT.step });
    await page.waitForFunction(() => document.querySelector('.weapon-control [data-weapon="rocket"]')?.getAttribute("aria-pressed") === "true", null, { timeout: TIMEOUT.step });
    assert.ok(await page.evaluate(() => window.__frontier.sim.commandLog.some((c) => c.type === "heroWeapon" && c.weapon === "rocket")), "the switch is a logged command");
    await noSideScroll(page, "portrait battle");
    await shot(page, "skywing-weapon-portrait");
    assert.deepEqual(errors, [], "portrait: page errors");
    await page.close();
  }
  // ---------------------------------------------------------------- landscape: Defence
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "landscape");
    await goto();
    await seed(page, wallet({ day: "2000-01-01" }));
    await page.reload(); await ready();
    await tap('[data-mode="defence"]');
    const row = page.locator('[data-assist-where="defence"]');
    await reveal(page, "defence");
    await audit(page, '[data-assist-where="defence"]', "landscape defence row");
    await tap('[data-assist-where="defence"] [data-assist="on"]');
    await shot(page, "skywing-defence-landscape");
    await noSideScroll(page, "landscape menu");
    await tap("#start");
    await inBattle(page);
    assert.equal((await stored(page)).coins, 40);
    assert.ok(await skywing(page), "Skywing over the Defence map");
    const lost = await end(page, "defeat");
    assert.ok(lost.total >= 15 + 20, `a lost level pays too (${lost.total})`);
    await audit(page, "#modal .coin-toast", "landscape debrief");
    await shot(page, "skywing-debrief-landscape");
    assert.deepEqual(errors, [], "landscape: page errors");
    await page.close();
  }
  // ---------------------------------------------------------------- desktop in Vietnamese
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await goto();
    await seed(page, wallet());
    await page.reload(); await ready();
    await sheet.setLanguage(page, "vi");
    await page.waitForFunction(() => document.documentElement.lang === "vi");
    await tap('[data-mode="skirmish"]');
    const row = page.locator('[data-assist-where="skirmish"]');
    await reveal(page, "skirmish");
    await page.waitForFunction(() => /Trợ thủ Cánh Trời/.test(document.querySelector('[data-assist-where="skirmish"]')?.textContent || ""), null, { timeout: TIMEOUT.step });
    assert.match(await row.innerText(), /Tắt[\s\S]*Bật[\s\S]*xu/);
    await audit(page, '[data-assist-where="skirmish"]', "vi row");
    await shot(page, "skywing-skirmish-desktop-vi");
    assert.deepEqual(errors, [], "vi: page errors");
    await page.close();
  }
}, { browser });
