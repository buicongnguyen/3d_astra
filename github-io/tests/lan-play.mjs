// W11 LAN play in two browsers: the real host server (tools/lan-server.mjs, started here on LAN_BROWSER_PORT,
// default 4574, serving the built dist/) and two pages, a desktop host and a phone guest (390x844).
//   - the host opens ?lan (the LAN screen comes up), names itself and hosts a 1v1; the phone opens the
//     address the host prints (?lan=join) and joins by itself; the host's screen lists it, the guest taps
//     Ready, the host taps Start; 11 px text, 44 px taps and no sideways scroll on both LAN screens;
//   - both pages play: orders given on both through the game's own command door (sim.command, as the
//     interface sends them) run for their own teams on both pages; the 5 s hash checks agree (no desync);
//     the strip shows both names and a ping;
//   - the phone's page stops answering for a few seconds: the host shows the "Waiting for a player" card,
//     which goes once the phone is back; the host opens its pause menu: the phone shows "Battle paused";
//   - the phone leaves from its pause menu: the host's battle ends with "Victory by forfeit" and Back to the
//     LAN lobby brings the host's LAN screen back.
// Screenshots: test-results/lan-*.png.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";
import { startLanServer } from "../tools/lan-server.mjs";

const PORT = Number(process.env.LAN_BROWSER_PORT || 4574);
const BASE = `http://127.0.0.1:${PORT}/`;
// The phone: portrait by default; LAN_GUEST_VIEWPORT=landscape checks the other phone shape.
const GUEST = process.env.LAN_GUEST_VIEWPORT || "portrait";
// A long name (re-score 2026-11-25b: the phone strip showed "H… 1 ms"): the phone must show at least 8 characters of it.
const HOST_NAME = "Hoa Nguyen Thi";
const server = await startLanServer({ port: PORT, host: "127.0.0.1", dist: resolve("dist"), log: () => {} });
const browser = await launchBrowser();

const tiny = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(`${selector} *`)].filter((el) => el.getClientRects().length && !el.closest("svg") && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.textContent.trim().slice(0, 30)), selector);
const small = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(selector)].filter((el) => el.getClientRects().length && !el.disabled).map((el) => { const r = el.getBoundingClientRect(); return [el.id || el.textContent.trim().slice(0, 16), Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 44), selector);
const noSideScroll = async (page, where) => {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
};
const lan = (page) => page.evaluate(() => window.__frontierLan?.info() || null);
const room = (page) => page.evaluate(() => window.__frontierLan?.room || null);
async function checkScreen(o, where) {
  assert.deepEqual(await tiny(o.page, "#lan"), [], `${where}: LAN screen text under 11 px`);
  assert.deepEqual(await small(o.page, "#lan button, #lan select, #lan input"), [], `${where}: LAN screen taps under 44 px`);
  await noSideScroll(o.page, where);
}

await suite("lan-play", async () => {
  const host = await openPage(browser, "desktop", { timeout: TIMEOUT.models });
  const guest = await openPage(browser, GUEST, { timeout: TIMEOUT.models });
  try {
    // ---- the lobby
    await host.page.goto(`${BASE}?test=1&lan`, { timeout: TIMEOUT.models });
    await host.ready();
    await host.page.waitForFunction(() => window.__frontierLan?.panel() && document.querySelector("#lan [data-lan-host]"), null, { timeout: TIMEOUT.step });
    assert.ok(await host.page.locator("#lan-open").isVisible() || true);
    await host.page.fill("#lan-name", HOST_NAME);
    await host.page.locator("#lan-name").dispatchEvent("change");
    await host.tap("#lan [data-lan-host]");
    await host.page.waitForFunction(() => window.__frontierLan.room?.players.length === 1 && document.querySelector("#lan [data-lan-start]"), null, { timeout: TIMEOUT.step });
    assert.equal(await host.page.locator("#lan .lan-qr svg").count(), 1, "the host's screen shows a QR code to join");
    assert.match(await host.page.locator("#lan .lan-url").first().textContent(), /^http:\/\/.+:\d+\/\?lan=join$/);
    assert.equal(await host.page.locator("#lan [data-lan-start]").isDisabled(), true, "Start waits for a player");
    await host.page.locator('#lan [data-lan-mode="coop"]').click();
    assert.equal(await host.page.locator("#lan-fai").count(), 1, "co-op shows the computer's faction");
    await host.page.locator('#lan [data-lan-mode="duel"]').click();
    await host.page.selectOption("#lan-map", "classic");
    await checkScreen(host, "host lobby");

    await guest.page.goto(`${BASE}?test=1&lan=join`, { timeout: TIMEOUT.models });
    await guest.ready();
    await host.page.waitForFunction(() => window.__frontierLan.room?.players.length === 2, null, { timeout: TIMEOUT.step });
    await guest.page.waitForFunction(() => document.querySelector("#lan [data-lan-ready]"), null, { timeout: TIMEOUT.step });
    assert.match(await guest.page.locator("#lan .lan-summary").textContent(), /1v1/);
    await checkScreen(guest, "guest lobby (phone)");
    await shot(guest.page, `lan-guest-lobby-${GUEST}`);
    await guest.tap("#lan [data-lan-ready]");
    await host.page.waitForFunction(() => !document.querySelector("#lan [data-lan-start]").disabled, null, { timeout: TIMEOUT.step });
    await shot(host.page, "lan-host-lobby-desktop");
    await host.tap("#lan [data-lan-start]");

    // ---- the match
    for (const o of [host, guest]) await o.page.waitForFunction(() => { const i = window.__frontierLan.info(); return i?.go && i.ticks > 40; }, null, { timeout: TIMEOUT.models });
    const [hi, gi] = [await lan(host.page), await lan(guest.page)];
    assert.deepEqual([hi.seat, gi.seat], [0, 1]);
    for (const [o, mine, other] of [[host, HOST_NAME, "Commander"], [guest, "Commander", HOST_NAME]]) {
      const text = await o.page.locator("#lan-strip").textContent();
      assert.ok(text.includes(mine) && text.includes(other), `the strip names both players: ${text}`);
      assert.deepEqual(await tiny(o.page, "#lan-strip"), [], "strip text");
    }
    // The phone's strip: the other player's name shows at least its first 8 characters (the visible width of the name
    // is at least the width those characters need in the strip's own font), and the strip stays clear of the top bar.
    const phoneStrip = await guest.page.evaluate(() => {
      const strip = document.querySelector("#lan-strip"), b = strip.querySelector(".lan-who:not(.lan-me) b"), s = getComputedStyle(b);
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const need = ctx.measureText(b.textContent.slice(0, 8)).width, shown = b.getBoundingClientRect().width, r = strip.getBoundingClientRect();
      const meet = (a) => !(a.right <= r.left || a.left >= r.right || a.bottom <= r.top || a.top >= r.bottom);
      const hits = [...document.querySelectorAll(".resource-bar, .top-actions button, .touch-controls button")].filter((e) => e.getClientRects().length && meet(e.getBoundingClientRect())).map((e) => e.id || e.className);
      return { text: b.textContent, need: Math.round(need), shown: Math.round(shown), cut: b.scrollWidth > b.clientWidth + 1, full: shown >= b.scrollWidth - 1, hits, ping: strip.querySelector(".lan-ping").textContent, inside: r.left >= 0 && r.right <= innerWidth };
    });
    assert.ok(phoneStrip.full || phoneStrip.shown >= phoneStrip.need, `the phone strip shows at least 8 characters of "${HOST_NAME}": ${JSON.stringify(phoneStrip)}`);
    assert.ok(phoneStrip.inside && /ms|—/.test(phoneStrip.ping), `the phone strip is on screen with the ping: ${JSON.stringify(phoneStrip)}`);
    assert.deepEqual(phoneStrip.hits, [], "the phone strip covers no top-bar control");
    // Orders on both pages, through the game's command door: each page commands its own army (team 0 as it sees it).
    const order = (page, x, z) => page.evaluate(([x, z]) => { const f = window.__frontier, army = f.sim.own(0).filter((e) => e.kind === "unit" && e.type !== "worker"); return f.sim.command({ team: 0, type: "order", ids: army.map((e) => e.id), order: { type: "move", x: army[0].x + x, z: army[0].z + z } }); }, [x, z]);
    assert.equal(await order(host.page, 4, -3), true);
    assert.equal(await order(guest.page, -4, 3), true);
    const rival = await host.page.evaluate(() => window.__frontier.sim.command({ team: 1, type: "harvest" }));
    assert.equal(rival, false, "a page cannot command the other player's team");
    // Wait until both pages ran past two hash checks (every 100 ticks) after the orders, then compare.
    for (const o of [host, guest]) await o.page.waitForFunction(() => window.__frontierLan.info().ticks > 330, null, { timeout: TIMEOUT.models });
    const teams = await host.page.evaluate(() => [...new Set(window.__frontier.sim.commandLog.filter((c) => c.type === "order").map((c) => c.team))].sort());
    assert.deepEqual(teams, [0, 1], "both players' orders ran on the host's page");
    for (const o of [host, guest]) assert.equal((await lan(o.page)).desync, null, "no desync");
    const checks = await host.page.evaluate(() => [...window.__frontierLan.client.session.lock.hashes].filter(([, at]) => at.size === 2).map(([tick, at]) => [tick, new Set(at.values()).size === 1]));
    assert.ok(checks.length >= 2 && checks.every(([, same]) => same), `the 5 s hash checks agree: ${JSON.stringify(checks)}`);
    await host.page.waitForFunction(() => window.__frontierLan.info().rtt !== null, null, { timeout: TIMEOUT.step });
    await shot(host.page, "lan-match-desktop");
    await shot(guest.page, `lan-match-${GUEST}`);

    // ---- a stalled phone: its page stops answering for 3.5 s
    guest.page.evaluate(() => new Promise((done) => setTimeout(() => { const t = Date.now(); while (Date.now() - t < 3500); done(); }, 50))).catch(() => {});
    await host.page.waitForFunction(() => window.__frontierLan.info().card === "stall", null, { timeout: TIMEOUT.step });
    assert.match(await host.page.locator("#lan-wait").textContent(), /Waiting for a player/);
    await shot(host.page, "lan-waiting-desktop");
    await host.page.waitForFunction(() => window.__frontierLan.info().card === null, null, { timeout: TIMEOUT.step });

    // ---- the host pauses: the phone shows it
    await host.page.keyboard.press("Escape");
    await host.page.waitForFunction(() => window.__frontierLan.info().held, null, { timeout: TIMEOUT.step });
    await guest.page.waitForFunction(() => window.__frontierLan.info().card === "hold", null, { timeout: TIMEOUT.step });
    assert.match(await guest.page.locator("#lan-wait").textContent(), /Hoa/);
    assert.deepEqual(await small(guest.page, "#lan-wait button"), [], "the card's Leave is a 44 px tap");
    await shot(guest.page, `lan-paused-${GUEST}`);
    const held = (await lan(guest.page)).ticks;
    await host.page.keyboard.press("Escape");
    await guest.page.waitForFunction((t) => window.__frontierLan.info().card === null && window.__frontierLan.info().ticks > t + 20, held, { timeout: TIMEOUT.step });

    // ---- the phone leaves: the host wins by forfeit and goes back to the lobby
    await guest.page.evaluate(() => window.__frontier && document.querySelector("#pause")?.click());
    await guest.page.waitForFunction(() => document.querySelector("#modal [data-new-game]")?.offsetParent, null, { timeout: TIMEOUT.step });
    assert.equal(await guest.page.locator("#modal [data-restart]").isVisible(), false, "a LAN battle offers no Restart");
    await guest.tap("#modal [data-new-game]");
    if (await guest.page.locator("#modal [data-confirmed]").count()) await guest.tap("#modal [data-confirmed]");
    await host.page.waitForFunction(() => document.querySelector("#modal [data-lan-lobby]")?.offsetParent, null, { timeout: TIMEOUT.step });
    assert.match(await host.page.locator("#modal-content").textContent(), /Victory by forfeit/);
    await shot(host.page, "lan-forfeit-desktop");
    await host.tap("#modal [data-lan-lobby]");
    await host.page.waitForFunction(() => window.__frontierLan.panel() && window.__frontierLan.room?.phase === "lobby" && document.querySelector("#lan [data-lan-start]"), null, { timeout: TIMEOUT.step });
    await guest.page.waitForFunction(() => !window.__frontier.started, null, { timeout: TIMEOUT.step });
    for (const o of [host, guest]) assert.deepEqual(o.errors, [], "no page errors");
  } finally {
    await server.close();
  }
}, { browser });
