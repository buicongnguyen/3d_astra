// R3-G in the browser, at 1440x900, 390x844 and 844x390 (npm run test:openings, CI matrix r3-g):
//   1. The campaign map: a "decision ahead" mark on the relay still holding one, the answered marks, each
//      ending's hint, chronicle cards with labels, three or more missions above Start on phones (one before),
//      the mode tabs keep their icons in landscape, chronicles above the fold on desktop; 11 px text, 44 px
//      taps, no sideways scroll.
//   2. A mission opening (?opening): it starts on the landmark with the title in the letterbox, the match
//      clock waits, Skip or a tap anywhere ends it (phones) or it plays out (desktop), and the camera lands
//      where the match starts. It plays once per mission; reduced motion skips it.
//   3. window.__frontier.jumpBoss("iron-vanguard") starts mission 3 and looks at the boss.
// Screenshots: test-results/openings-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";

const KEY = "frontier-campaign-v2", ids = MISSIONS.map((m) => m.id), ID = "m03-the-ashen-line";
const progress = { cleared: Object.fromEntries(ids.slice(0, 6).map((id, i) => [id, { time: 400, medal: ["gold", "silver", "bronze"][i % 3], difficulty: "standard" }])), decisions: { "m03-alloy": "return", "m04-sol": "accept", "m05-pact": "drive" } };
// Campaign C3: Sol's surrender (m04-sol) is answered here; Hale (m07) and Maren with the Veil (m10) still wait.

const mapLayout = (page) => page.evaluate(() => {
  const shown = (e) => { const r = e.getBoundingClientRect(), st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden"; };
  const start = document.querySelector("#start").getBoundingClientRect();
  const rows = [...document.querySelectorAll("[data-stage]")].filter((e) => { const r = e.getBoundingClientRect(); return shown(e) && r.top >= 0 && r.bottom <= Math.min(start.top + 1, innerHeight); }).length;
  const text = (sel) => [...document.querySelectorAll(sel)].filter(shown).map((e) => e.textContent.trim());
  const small = [...document.querySelectorAll("#campaign-map *, .mode-switch *")].filter((e) => shown(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => e.className || e.tagName);
  const taps = [...document.querySelectorAll(".cmap-node:not(:disabled), .cmap-ending.seen, .chron-card:not(:disabled), .mode-switch button, [data-stage]")].filter(shown)
    .map((e) => { const r = e.getBoundingClientRect(); return { k: e.dataset.mode || e.dataset.stage || e.dataset.chronicle || e.className, w: r.width, h: r.height }; }).filter((b) => b.w < 43.5 || b.h < 43.5);
  const chron = document.querySelector(".cmap-chronicles")?.getBoundingClientRect();
  return {
    rows, small, taps,
    ahead: [...document.querySelectorAll(".cmap-node .cmap-ahead")].map((i) => i.closest(".cmap-node").dataset.mapMission),
    marks: [...document.querySelectorAll(".cmap-node .cmap-choice")].map((i) => (i.classList.contains("mercy") ? "mercy" : "firm")),
    hints: text(".cmap-hint"), endings: text(".cmap-ending-name, .cmap-ending-short"), chronicles: text(".chron-card .chron-words > small.chron-side"),
    icons: [...document.querySelectorAll(".mode-switch button > .icon")].filter(shown).length,
    chronBottom: chron ? chron.bottom : null, sideways: document.documentElement.scrollWidth > innerWidth + 1,
  };
});

const beginMission = async ({ page, tap }, id) => {
  await tap('[data-mode="campaign"]');
  await tap(`[data-mission="${id}"]`);
  await tap("#start");
  await page.locator("#mission-briefing").waitFor({ state: "visible", timeout: TIMEOUT.step });
  await tap("#mb-skip"); await tap("#mb-next");
  await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
};
// CI-like runs (tests/lib/ci-like.mjs: software GL, CPU slowed 20x) draw about 5 frames a second and the
// opening's 5 s play out on frame time (dt capped at 0.25 s), so waiting for it to end gets longer there.
const SLOW = Number(process.env.SLOW_CPU || 0) > 1;
const PLAY_OUT = SLOW ? TIMEOUT.models : TIMEOUT.step;
// An opening can only start while the match clock is at most 0.3 s (scenes.js maybeOpening): once the clock
// is past that with none open, none will come. A held clock (an opening playing) ends the wait too.
const noOpening = (page) => page.waitForFunction(() => window.__frontier.scene().open || window.__frontier.sim.time > 0.3, null, { timeout: PLAY_OUT }).then(() => page.evaluate(() => window.__frontier.scene().open));
const camera = (page) => page.evaluate(() => ({ x: window.__frontier.view.focus.x, z: window.__frontier.view.focus.z, zoom: window.__frontier.view.zoom, time: window.__frontier.sim.time }));

const browser = await launchBrowser();
await suite("openings: mission fly-ins, the campaign map, jumpBoss", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const ctx = await openPage(browser, viewport), { page, goto, ready, tap, errors } = ctx;
    await goto("opening");
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progress]);
    await page.reload(); await ready();

    // 1. The campaign map.
    await tap('[data-mode="campaign"]');
    await page.locator("#campaign-map .cmap").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await page.waitForTimeout(300);
    const map = await mapLayout(page);
    assert.deepEqual(map.ahead, ["m07-copper-siege", "m10-obsidian-storm"], `${viewport}: the relay still holding a decision is marked`);
    assert.deepEqual(map.marks, ["mercy", "mercy", "firm"], `${viewport}: answered decisions keep their marks`);
    assert.deepEqual(map.hints, ["3+ merciful choices", "0-2 merciful choices"], `${viewport}: ending hints`);
    assert.equal(map.endings.length, 2, `${viewport}: both endings are named`);
    assert.equal(map.chronicles.length, 4, `${viewport}: every chronicle card keeps a label`);
    assert.deepEqual(map.small, [], `${viewport}: text under 11 px`);
    assert.deepEqual(map.taps, [], `${viewport}: taps under 44 px`);
    assert.equal(map.sideways, false, `${viewport}: sideways scroll`);
    assert.equal(map.icons, 4, `${viewport}: the mode tabs keep their icons`);
    if (viewport === "desktop") assert.ok(map.chronBottom <= 900, `chronicles above the fold (${map.chronBottom})`);
    assert.ok(map.rows >= (viewport === "desktop" ? 5 : 3), `${viewport}: ${map.rows} missions above Start`);
    await shot(page, `openings-map-${viewport}`);

    // 2. The opening of mission 3.
    await beginMission(ctx, ID);
    await page.waitForFunction(() => window.__frontier.scene().opening, null, { timeout: TIMEOUT.step });
    const open = await page.evaluate(() => ({ ...window.__frontier.scene(), title: document.querySelector(".opening-title").innerText, skip: document.querySelector("#scene-skip").getBoundingClientRect().height, card: !!document.querySelector("#title-card"), time: window.__frontier.sim.time }));
    assert.equal(open.opening.mission, ID);
    assert.equal(open.opening.frames, "camp");
    assert.ok(open.opening.seconds >= 4 && open.opening.seconds <= 6, `${open.opening.seconds} s`);
    assert.equal(open.letterbox, true);
    assert.match(open.title, /The Ashen Line/);
    assert.ok(open.skip >= 44, "Skip is 44 px");
    assert.equal(open.card, false, "the opening carries the title; no second card");
    await page.waitForTimeout(500);
    const during = await camera(page);
    // The opening starts on the first frame of play: a slow runner's first frame may already have run a tick or
    // two (0.05 s each) before it, which scenes.js allows (up to 0.3 s). From then on the clock must not move.
    assert.ok(open.time <= 0.3, `the opening starts as the match begins (${open.time} s)`);
    assert.equal(during.time, open.time, "the match clock waits");
    assert.ok(Math.hypot(during.x - open.opening.to.x, during.z - open.opening.to.z) > 15, "the camera starts on the landmark, away from home");
    await shot(page, `openings-m03-${viewport}`);
    if (viewport === "desktop") await page.waitForFunction(() => !window.__frontier.scene().open, null, { timeout: PLAY_OUT });
    else {
      // The tap must land on a running opening. On a slow runner the screenshot can outlast most of it: then the
      // opening is played again from home (__frontier.playOpening, the same fly-in) so the tap still has 2 s or more
      // of it to end (at least 8 frames, so it cannot run out by itself before the check below).
      let before = await page.evaluate(() => window.__frontier.scene());
      if (!before.open || before.opening.seconds - before.opening.t < 2) {
        await page.waitForFunction(() => !window.__frontier.scene().open, null, { timeout: PLAY_OUT });
        await page.evaluate(() => window.__frontier.playOpening());
        before = await page.evaluate(() => window.__frontier.scene());
      }
      assert.equal(before.opening?.mission, ID, `${viewport}: an opening is running before the tap`);
      await page.touchscreen.tap(Math.round(page.viewportSize().width / 2), Math.round(page.viewportSize().height / 2));
      // The tap ends it on its pointerdown (scenes.js), not by playing out.
      assert.equal(await page.evaluate(() => window.__frontier.scene().open), false, `${viewport}: a tap anywhere ends the opening`);
    }
    const after = await camera(page);
    assert.deepEqual([after.x, after.z, after.zoom], [open.opening.to.x, open.opening.to.z, open.opening.to.zoom], `${viewport}: the camera lands where the match starts`);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("scene-open")), false);
    // Once per mission: a restart plays straight away.
    await page.evaluate(() => window.__frontier.restart());
    assert.equal(await noOpening(page), false, "a restart has no second opening");

    if (viewport === "desktop") {
      // Reduced motion: no fly-in (the title card alone tells the mission).
      await page.emulateMedia({ reducedMotion: "reduce" });
      await tap("#pause"); await tap("[data-new-game]");
      await page.locator("#briefing").waitFor({ state: "visible", timeout: TIMEOUT.step });
      await beginMission(ctx, "m02-first-contact");
      assert.equal(await noOpening(page), false, "reduced motion: no opening");
      await page.emulateMedia({ reducedMotion: "no-preference" });

      // 3. jumpBoss: mission 3 again, the map revealed, the army in front of the Iron Vanguard.
      // The clock is held from the jump to the checks: the army stands 12 m from the boss, so on a slow runner the
      // match ran on to the boss waking and its entrance scene opened before the checks were read.
      const jump = await page.evaluate(() => { window.__frontier.hold = true; return window.__frontier.jumpBoss("iron-vanguard"); });
      assert.equal(jump.mission, ID);
      assert.equal(jump.type, "ironvanguard");
      const near = await page.evaluate((j) => { const f = window.__frontier; return { cam: Math.hypot(f.view.focus.x - j.x, f.view.focus.z - j.z), army: f.sim.own(0).filter((e) => e.kind === "unit" && e.type !== "worker" && Math.hypot(e.x - j.x, e.z - j.z) < 20).length, scene: f.scene().open }; }, jump);
      assert.ok(near.cam < 10, `the camera looks at the boss (${near.cam.toFixed(1)} m)`);
      assert.ok(near.army > 0, "the army stands in front of it");
      assert.equal(near.scene, false, "no opening on a jump");
      assert.equal(await page.evaluate(() => window.__frontier.jumpBoss("no-such-boss")), null);
      await page.evaluate(() => { window.__frontier.hold = false; });
      await page.waitForTimeout(400);
      await shot(page, "openings-jumpboss-desktop");
    }
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
