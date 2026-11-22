// R3-M: the title cover on five viewports.
//   - The first load is a loading screen (planet + progress ring) that steps aside when the models are in.
//   - First paint is one flat painted cover, the one for this frame shape; the parallax layers are fetched only
//     after the models are in, then cross-fade in. Calm (reduced motion) never fetches them.
//   - The live layer draws; planet labels give way to the logo, the briefing and the panel.
//   - 11 px text, 44 px taps, no sideways scroll; the campaign map and Settings wear the same holo frame.
//   - Kit pass (owner, 2026-11-22): on phones the battle dock is one context panel (Selection + Map tabs); every
//     order and action of a group, a Harvester and the Command core is one tap on the Selection tab.
//   - Owner rule (2026-11-21): nothing is tidied away. Every control the title menu, the skirmish setup and
//     Settings showed on r3-base (tests/fixtures/r3-base-menu-controls.json) is still there and directly
//     clickable, with no menu, drawer or tab to open first.
// Record the r3-base list (against a server running the r3-base build): node tests/cover-ui.mjs --record-base
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { launchBrowser, openPage, suite, shot, VIEWPORTS, TIMEOUT } from "./lib/harness.mjs";

const SIZES = { ...VIEWPORTS, hd: { width: 1920, height: 1080 }, tablet: { width: 768, height: 1024, mobile: true } };
const ART = { desktop: "keyart-desktop", hd: "keyart-desktop", portrait: "keyart-portrait", landscape: "keyart-landscape", tablet: "keyart-portrait" };
const FIXTURE = new URL("./fixtures/r3-base-menu-controls.json", import.meta.url);

// Every visible control of a screen, keyed by something stable.
const listControls = (scope) => [...document.querySelectorAll(`${scope} :is(button, select, input, [role="tab"])`)]
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden]"))
  .map((e) => e.id ? `#${e.id}` : e.dataset.mode ? `[data-mode="${e.dataset.mode}"]` : e.dataset.tab ? `[data-tab="${e.dataset.tab}"]` : e.dataset.difficulty ? `[data-difficulty="${e.dataset.difficulty}"]`
    : e.dataset.do ? `[data-do="${e.dataset.do}"]` : e.dataset.setting ? `[data-setting="${e.dataset.setting}"]` : e.getAttribute("aria-label") ? `[aria-label="${e.getAttribute("aria-label")}"]` : `text=${e.textContent.trim().slice(0, 30)}`);

async function screens(t) {
  const { page } = t;
  const menu = await page.evaluate(listControls, "#briefing");
  await t.tap("#briefing-settings");
  await page.locator(".settings-panel").waitFor({ state: "visible", timeout: TIMEOUT.step });
  const settings = await page.evaluate(listControls, ".settings-panel");
  return { menu, settings };
}

if (process.argv.includes("--record-base")) {
  const browser = await launchBrowser();
  const out = {};
  for (const [name, size] of Object.entries(SIZES)) {
    const t = await openPage(browser, size);
    await t.goto(); await t.ready();
    out[name] = await screens(t);
    await t.page.close();
  }
  await browser.close();
  writeFileSync(FIXTURE, `${JSON.stringify(out, null, 1)}\n`);
  console.log("recorded", FIXTURE.pathname);
  process.exit(0);
}

// The control is on screen (scrolled to if its column scrolls) and a click at its centre reaches it.
async function reachable(page, key) {
  const locator = key.startsWith("text=") ? page.locator(`button:has-text("${key.slice(5)}")`).first() : page.locator(key).first();
  if (!(await locator.count())) return "missing";
  // Centred in its scroll column, clear of the pinned Start button, as a player would scroll it.
  return locator.evaluate((e) => {
    e.scrollIntoView({ block: "center", inline: "nearest" });
    if (!e.getClientRects().length || e.closest("[hidden]")) return "hidden";
    const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 20);
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return "off screen";
    const hit = document.elementFromPoint(x, y);
    return hit && (e === hit || e.contains(hit) || hit.closest("label")?.contains(e)) ? "ok" : `covered by ${hit?.className || hit?.tagName}`;
  });
}

const base = JSON.parse(readFileSync(FIXTURE, "utf8"));
const browser = await launchBrowser();
await suite("cover-ui", async () => {
  for (const [name, size] of Object.entries(SIZES)) {
    const t = await openPage(browser, size);
    const { page } = t;
    const art = [], layers = [];
    let readyAt = 0;
    page.on("request", (r) => {
      const file = r.url().split("/").pop();
      if (/keyart/.test(file)) art.push(file);
      if (/^layer-/.test(file)) layers.push([Date.now(), file]);
    });
    // Hold back all but the first models so the loading screen can be read.
    await page.route(/\.glb$/, async (route) => {
      if (!/environment|hq|worker/.test(route.request().url())) await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await t.goto();
    await page.waitForSelector(".cover-loading.boot.on", { timeout: TIMEOUT.step });
    const boot = await page.evaluate(() => {
      const el = document.querySelector(".cover-loading"), r = el.getBoundingClientRect();
      return { pct: el.querySelector(".cover-load-pct").textContent, ring: !!el.querySelector(".ring-fill"), cover: r.width >= innerWidth - 1, taps: getComputedStyle(el).pointerEvents };
    });
    assert.match(boot.pct, /^\d+%$/, `${name}: percent`);
    assert.deepEqual([boot.ring, boot.cover, boot.taps], [true, true, "none"], `${name}: loading screen`);
    await t.ready();
    readyAt = Date.now();
    await page.waitForFunction(() => !document.querySelector(".cover-loading").classList.contains("on"), null, { timeout: TIMEOUT.step });
    await page.waitForFunction(() => document.querySelector(".cover-layers")?.classList.contains("on"), null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(1200);

    // First paint: one flat cover, the one for this frame shape. The layers came after the models: the
    // 14 of the art's table plus this frame's nebula.
    assert.equal(art.length, 1, `${name}: one key art request (${art.join(", ")})`);
    assert.ok(art[0].startsWith(ART[name]), `${name}: ${art[0]}`);
    assert.equal(layers.length, 15, `${name}: layers ${layers.map((l) => l[1]).join(", ")}`);
    assert.ok(layers.every(([at]) => at >= readyAt - 50), `${name}: layers load after the models`);

    const state = await page.evaluate(() => {
      const canvas = document.querySelector(".cover-fx"), ctx = canvas.getContext("2d");
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 3; i < data.length; i += 4 * 7) if (data[i] > 0) lit++;
      const rect = (s) => document.querySelector(s)?.getBoundingClientRect();
      const labels = [...document.querySelectorAll(".cover-label")].filter((l) => !l.hidden).map((l) => l.getBoundingClientRect());
      const hit = (a, b) => b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const squad = document.querySelector(".layer-foreground-squad");
      return {
        live: document.querySelector("#briefing").classList.contains("cover-live"),
        lit,
        clash: labels.filter((l) => [".title-brand", ".briefing-setup", ".briefing-copy h2"].some((s) => hit(l, rect(s)))).length,
        logo: !!document.querySelector(".title-brand svg.wordmark"),
        slot: document.querySelector("#title-actions")?.hidden,
        fixed: getComputedStyle(document.querySelector(".briefing-art")).position,
        squad: squad.naturalWidth > 0 && squad.getBoundingClientRect().width > 100,
      };
    });
    assert.deepEqual(state.live, true, `${name}: live layer on`);
    assert.ok(state.lit > 20, `${name}: the live layer draws (${state.lit})`);
    assert.equal(state.clash, 0, `${name}: planet labels clear of logo, panel and heading`);
    // R3-Q fills the #title-actions slot with the one-tap Quick battle, so it shows.
    assert.deepEqual([state.logo, state.slot, state.fixed, state.squad], [true, false, "fixed", true], name);

    // 11 px text, 44 px taps, no sideways scroll, for the cover and its labels.
    const small = await page.evaluate(() => [...document.querySelectorAll("#briefing :is(p,span,strong,small,h2,label,button,b), .cover-label *")]
      .filter((e) => e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .map((e) => [e.textContent.trim().slice(0, 20), parseFloat(getComputedStyle(e).fontSize)]).filter(([, s]) => s < 11));
    assert.deepEqual(small, [], `${name}: text >= 11 px`);
    const taps = await page.evaluate((touch) => [...document.querySelectorAll("#briefing button, #briefing select")].filter((e) => e.getClientRects().length && !e.disabled)
      .map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.textContent.trim().slice(0, 14), Math.round(r.width), Math.round(r.height)]; })
      .filter(([, w, h]) => h < 44 || (touch && w < 44)), !!size.mobile);
    assert.deepEqual(taps, [], `${name}: taps >= 44 px`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: no sideways scroll`);
    await shot(page, `cover-ui-${name}`);

    // Nothing tidied away: every r3-base control of the menu and the skirmish setup is one click away.
    const menuNow = await page.evaluate(listControls, "#briefing");
    for (const key of base[name].menu) {
      assert.ok(menuNow.includes(key), `${name}: menu control ${key} still shown`);
      assert.equal(await reachable(page, key), "ok", `${name}: ${key} directly clickable`);
    }

    // Campaign: the art steps aside, the map is framed, the labels go.
    await page.evaluate(() => document.querySelector("#briefing .briefing-setup").scrollTo(0, 0));
    await t.tap('.mode-switch [data-mode="campaign"]');
    await page.locator("#campaign-map .cmap").waitFor({ state: "visible", timeout: TIMEOUT.step });
    const campaign = await page.evaluate(() => ({ art: getComputedStyle(document.querySelector(".briefing-art")).display, frame: getComputedStyle(document.querySelector("#briefing.campaign-view .briefing-hero")).borderTopStyle, labels: [...document.querySelectorAll(".cover-label")].filter((l) => !l.hidden).length }));
    assert.deepEqual(campaign, { art: "none", frame: "solid", labels: 0 }, `${name}: campaign frame`);
    await t.tap('.mode-switch [data-mode="skirmish"]');

    // Settings wear the holo frame, and keep every control of r3-base.
    await page.evaluate(() => scrollTo(0, 0));
    await t.tap("#briefing-settings");
    await page.locator(".settings-panel").waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.match(await page.evaluate(() => getComputedStyle(document.querySelector(".settings-panel")).backgroundImage), /linear-gradient/, `${name}: settings holo glass`);
    const settingsNow = await page.evaluate(listControls, ".settings-panel");
    for (const key of base[name].settings) {
      assert.ok(settingsNow.includes(key), `${name}: settings control ${key} still shown`);
      assert.equal(await reachable(page, key), "ok", `${name}: settings ${key} directly clickable`);
    }
    // Kit pass (owner, 2026-11-22): on phones the battle dock is one context panel. Two tabs (Selection, Map), no
    // Actions tab; for a group, a Harvester and the Command core every order and action is on the Selection tab,
    // each one tap (a row wider than the dock scrolls inside itself, nothing sits behind a menu or a drawer).
    if (size.mobile) {
      await page.evaluate(() => document.querySelector(".settings-panel [data-do=\"cancel\"]")?.click());
      await t.tap('.mode-switch [data-mode="skirmish"]');
      await t.tap("#start");
      await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
      await page.evaluate(() => { window.__frontier.hold = true; });
      const tabs = await page.evaluate(() => [...document.querySelectorAll("#dock-tabs [data-dock]")].map((b) => b.dataset.dock));
      assert.deepEqual(tabs, ["selection", "map"], `${name}: dock tabs`);
      for (const pick of ["army", "worker", "core"]) {
        await page.evaluate((pick) => {
          const f = window.__frontier, own = f.sim.own(0);
          const ids = pick === "army" ? own.filter((e) => e.kind === "unit" && e.type !== "worker").map((e) => e.id) : [own.find((e) => e.type === (pick === "core" ? "hq" : "worker")).id];
          f.select(ids); f.step(0);
        }, pick);
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.dock), "selection", `${name} ${pick}: the Selection tab is open`);
        const actions = await page.evaluate(() => [...document.querySelectorAll(".bottom-dock :is(#commands button, #upgrade-actions button, .order-buttons button)")]
          .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden]")).map((e) => e.dataset.action || e.dataset.ability || e.dataset.stance || e.id || (e.dataset.level !== undefined ? "level" : e.textContent.trim())));
        assert.ok(actions.length >= (pick === "core" ? 3 : 4), `${name} ${pick}: actions on the panel (${actions.join(", ")})`);
        for (const key of actions) {
          const where = await page.evaluate((key) => {
            const e = [...document.querySelectorAll(".bottom-dock :is(#commands button, #upgrade-actions button, .order-buttons button)")].find((b) => (b.dataset.action || b.dataset.ability || b.dataset.stance || b.id || (b.dataset.level !== undefined ? "level" : b.textContent.trim())) === key);
            e.scrollIntoView({ block: "nearest", inline: "nearest" });
            const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
            if (r.width < 43.5 || r.height < 43.5) return `small ${Math.round(r.width)}x${Math.round(r.height)}`;
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return "off screen";
            const hit = document.elementFromPoint(x, y);
            return hit && (hit === e || e.contains(hit)) ? "ok" : `covered by ${hit?.id || hit?.className}`;
          }, key);
          assert.equal(where, "ok", `${name} ${pick}: ${key} one tap on the Selection tab`);
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${pick}: no sideways page scroll`);
      }
      await shot(page, `cover-ui-${name}-dock`);
    }
    assert.deepEqual(t.errors, [], `${name}: page errors`);
    await page.close();
  }

  // Calm: with reduced motion the flat cover stays, the layers are never fetched, one still frame is drawn.
  const t = await openPage(browser, "desktop");
  const layers = [];
  t.page.on("request", (r) => { if (/\/layer-/.test(r.url())) layers.push(r.url()); });
  await t.page.emulateMedia({ reducedMotion: "reduce" });
  await t.goto(); await t.ready();
  await t.page.waitForTimeout(2500);
  const calm = await t.page.evaluate(async () => {
    const canvas = document.querySelector(".cover-fx"), first = canvas.toDataURL();
    await new Promise((r) => setTimeout(r, 700));
    const running = document.getAnimations().filter((a) => a.playState === "running" && a.effect?.target?.closest?.("#briefing")).map((a) => a.animationName || a.constructor.name);
    return { live: document.querySelector("#briefing").classList.contains("cover-live"), still: canvas.toDataURL() === first, running };
  });
  assert.deepEqual(calm, { live: false, still: true, running: [] }, "calm cover");
  assert.deepEqual(layers, [], "calm: no layer downloads");
  assert.deepEqual(t.errors, []);
  await t.page.close();
}, { browser });
