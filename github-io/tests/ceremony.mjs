// The victory ceremony and MVP card (AAA round 3, R3-V) at 1440x900, 390x844 and 844x390:
//   - Skirmish win: the enemy core falls to one of the player's units (credited as the MVP), the slow motion
//     and the camera swing play (phases "slow" then "swing", the MVP tag over the unit), then the result shows
//     the .mvp-card with that unit's name and portrait, the stamp lands (a frontier:stamp event) and the
//     stats count up to their real values; onMatchEnd hears the match;
//   - Skirmish loss: "So close", how close it was and one tip from the match counters; no stamp;
//   - a campaign mission and a Frontier Defence level: the results reach the MVP card and a stamp event;
//   - every results action stays one tap (all buttons on the card), 44 px taps, 11 px text, no sideways
//     scroll, the docks keep their height, no page errors.
// The URL opts in with ?ceremony (browser suites see the static results otherwise). Screenshots:
// test-results/ceremony-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.CEREMONY_VIEWPORTS || "desktop,portrait,landscape").split(",");

const noSideScroll = async (page, where) => {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
};
const tiny = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(`${selector} *`)].filter((el) => el.offsetParent !== null && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.textContent.trim()), selector);
const small = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(selector)].filter((el) => el.offsetParent !== null).map((el) => el.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`), selector);
// The fixed docks (phone dock, desktop dock, tabs): their heights, read in a match.
const docks = (page) => page.evaluate(() => {
  const out = { var: getComputedStyle(document.documentElement).getPropertyValue("--dock-height").trim() };
  for (const sel of [".bottom-dock", "#dock-tabs", "#commands"]) { const el = document.querySelector(sel); out[sel] = el ? Math.round(el.getBoundingClientRect().height) : null; }
  return out;
});
// Listens for stamps and match ends from the start of the page.
const listen = (page) => page.evaluate(() => {
  window.__stamps = []; window.__ends = [];
  document.addEventListener("frontier:stamp", (e) => window.__stamps.push(e.detail));
  window.__frontier.onMatchEnd((s) => window.__ends.push({ mode: s.mode, result: s.result, win: s.win, mvp: s.mvp?.name || null, stars: s.stars, medal: s.medal, tip: s.ceremony?.tip || null }));
});
// The results screen checks shared by every mode.
async function checkResults(o, where) {
  const { page } = o;
  assert.deepEqual(await tiny(page, "#modal"), [], `${where}: results text under 11 px`);
  assert.deepEqual(await small(page, "#modal .result-actions button, #modal .debrief-actions button"), [], `${where}: results taps under 44 px`);
  const actions = await page.evaluate(() => [...document.querySelectorAll("#modal .result-actions button, #modal .debrief-actions button")].map((b) => ({ text: b.textContent.trim(), shown: b.offsetParent !== null })));
  assert.ok(actions.length >= 2 && actions.every((a) => a.shown), `${where}: every results action is on the card, one tap each (${JSON.stringify(actions)})`);
  assert.equal(await page.locator("#modal details, #modal [aria-haspopup], #modal .more").count(), 0, `${where}: nothing grouped behind a menu`);
  await noSideScroll(page, where);
}
async function mvpCard(page, where) {
  const card = await page.evaluate(() => {
    const c = document.querySelector("#modal .mvp-card");
    return c && { name: c.querySelector(".mvp-name")?.textContent.trim(), portrait: !!c.querySelector(".mvp-portrait .portrait-art, .mvp-portrait .cast-portrait, .mvp-portrait img"), id: Number(c.dataset.mvpId) };
  });
  assert.ok(card, `${where}: the MVP card is shown`);
  assert.ok(card.name, `${where}: the MVP card names the unit`);
  assert.ok(card.portrait, `${where}: the MVP card has a portrait`);
  return card;
}
const waitStamp = (page, count, where) => page.waitForFunction((n) => window.__stamps.length >= n && window.__frontier.ceremony.stamps >= n, count, { timeout: TIMEOUT.step }).catch(() => { throw new Error(`${where}: no stamp event`); });
const stampsNow = (page) => page.evaluate(() => window.__stamps.length);
async function startMatch(o) {
  await o.ready();
  await o.tap("#start");
  await o.page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
}

await suite("ceremony", async () => {
  for (const viewport of VIEWPORTS) {
    const o = await openPage(browser, viewport, { timeout: TIMEOUT.models }), { page, errors } = o;
    await o.goto("ceremony");
    await o.ready();
    await listen(page);

    // ---------------------------------------------------------------- Skirmish: win
    await startMatch(o);
    await page.waitForTimeout(400);
    const dockBefore = await docks(page);
    // The core falls on one tick and the match is called on the next. At full speed those are two frames, so the
    // frame loop has already handed the core's death to the view when the result comes, and the ceremony slows on
    // the kill itself. A slow runner (5 frames a second, up to 5 ticks a frame) ran both ticks in one frame, so the
    // core beat (ui-extras.js) took the kill and the ceremony had no "slow" phase to see. The clock is therefore
    // held for the killing tick (step(), with the stats tracker around it as in play) and let go only once the
    // death has left sim.events.
    const hero = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      const unit = s.own(0).find((e) => e.kind === "unit" && e.type !== "worker" && e.damage > 0) || s.own(0).find((e) => e.kind === "unit");
      const cores = s.entities.filter((e) => e.team !== 0 && e.type === "hq");
      const proto = Object.getPrototypeOf(s).tick;
      f.hold = true;
      // Fires once, inside a tick with the tracker around it, so the tracker sees the hit as it would in play.
      s.tick = (dt) => { delete s.tick; proto.call(s, dt); for (const c of cores) s.applyDamage(c, 1e7, 0, unit.id); };
      f.step(0.05);
      return { id: unit.id, name: unit.name };
    });
    await page.waitForFunction(() => !window.__frontier.sim.events.some((e) => e.type === "death" && e.core), null, { timeout: TIMEOUT.step });
    // The phases are recorded in the page, every frame: a poll from here took longer than a phase on a slow runner.
    // The tag counts once it has reached the middle of the screen (the swing ends centred on the MVP).
    await page.evaluate(() => {
      const seen = (window.__ceremonySeen = { phases: [], tag: false });
      const look = () => {
        const phase = window.__frontier.ceremony.phase;
        if (phase && seen.phases.at(-1) !== phase) seen.phases.push(phase);
        // On screen in any swing frame; centred (within 30% of the width) in any frame, judged only when the runner drew
        // enough swing frames to see it get there (a slow CI runner draws two or three, often before the swing ends).
        if (phase === "swing") {
          seen.swingFrames = (seen.swingFrames || 0) + 1;
          const r = document.querySelector(".mvp-tag span")?.getBoundingClientRect(), on = !!r && r.width > 0 && r.top > 0 && r.bottom < innerHeight && r.right > 0 && r.left < innerWidth;
          if (on) { seen.onScreen = true; if (Math.abs(r.left + r.width / 2 - innerWidth / 2) < innerWidth * 0.3) seen.tag = true; }
        }
        if (!document.querySelector(".result-card")) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
      window.__frontier.hold = false;
    });
    let swingShot = false;
    const started = Date.now();
    while (!swingShot && Date.now() - started < TIMEOUT.step && !(await page.locator(".result-card").isVisible())) {
      if (await page.evaluate(() => window.__ceremonySeen.onScreen && window.__frontier.ceremony.phase === "swing")) { swingShot = true; await shot(page, `ceremony-swing-${viewport}`); }
      else await page.waitForTimeout(40);
    }
    await page.locator(".result-card").waitFor({ state: "visible", timeout: TIMEOUT.step });
    const seen = await page.evaluate(() => window.__ceremonySeen);
    assert.deepEqual(seen.phases, ["slow", "swing"], `${viewport}: slow motion then the camera swing play before the result (${seen.phases})`);
    assert.ok(seen.onScreen, `${viewport}: the MVP tag shows over the unit during the swing (${seen.swingFrames} swing frames)`);
    if (seen.swingFrames >= 6) assert.ok(seen.tag, `${viewport}: the swing brings the MVP tag to the middle (${seen.swingFrames} swing frames)`);
    assert.equal(await page.locator(".result-card").getAttribute("data-result"), "victory");
    // 2026-11-28: the action buttons stay pinned at the card's foot, on screen, whatever the card holds (they fell
    // below the fold at 1280x720 and on a 390x844 phone).
    const offscreen = await page.evaluate(() => [...document.querySelectorAll(".result-actions button")].filter((b) => { const r = b.getBoundingClientRect(); return r.height === 0 || r.top < 0 || r.bottom > innerHeight + 0.5; }).map((b) => b.textContent.trim()));
    assert.deepEqual(offscreen, [], `${viewport}: result buttons on screen`);
    const card = await mvpCard(page, `${viewport} skirmish`);
    assert.equal(card.id, hero.id, `${viewport}: the unit that destroyed the core is the MVP`);
    await waitStamp(page, 1, `${viewport} skirmish`);
    // The stats count up and settle on the real values.
    await page.waitForFunction(() => !document.querySelector("#modal .stat strong.counting"), null, { timeout: TIMEOUT.step });
    const structures = await page.evaluate(() => [...document.querySelectorAll(".result-grid .stat")].find((s) => /structures/i.test(s.textContent))?.querySelector("strong").textContent);
    assert.ok(Number(structures) >= 1, `${viewport}: the destroyed core is counted (${structures})`);
    await checkResults(o, `${viewport} skirmish win`);
    const dockAfter = await docks(page);
    assert.deepEqual({ var: dockAfter.var }, { var: dockBefore.var }, `${viewport}: the dock height token is unchanged`);
    await page.waitForTimeout(1200);
    await shot(page, `ceremony-skirmish-win-${viewport}`);
    assert.deepEqual(await page.evaluate(() => window.__ends.at(-1)), { mode: "skirmish", result: "victory", win: true, mvp: hero.name, stars: null, medal: null, tip: null }, `${viewport}: onMatchEnd hears the win`);

    // ---------------------------------------------------------------- Skirmish: loss
    await o.tap(".result-actions [data-restart]");
    await page.waitForFunction(() => window.__frontier.started && !window.__frontier.sim.result && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    await page.waitForTimeout(300);
    assert.deepEqual(await docks(page), dockBefore, `${viewport}: the docks keep their height after a ceremony`);
    const stampsBefore = await page.evaluate(() => window.__frontier.ceremony.stamps);
    await page.evaluate(() => {
      const s = window.__frontier.sim, proto = Object.getPrototypeOf(s).tick;
      const enemy = s.entities.find((e) => e.team !== 0 && e.type === "hq");
      s.tick = (dt) => { delete s.tick; proto.call(s, dt); enemy.hp = enemy.maxHp * 0.4; for (const c of s.entities.filter((e) => e.team === 0 && e.type === "hq")) s.applyDamage(c, 1e7, 1, null); };
    });
    await page.locator(".result-card.lost").waitFor({ state: "visible", timeout: TIMEOUT.step });
    const loss = await page.evaluate(() => ({ close: document.querySelector(".loss-tip .so-close")?.textContent.trim(), near: document.querySelector(".loss-tip .loss-near")?.textContent.trim(), tip: document.querySelector(".loss-tip")?.dataset.tip, line: document.querySelector(".loss-tip .loss-tip-line")?.textContent.trim(), mvp: !!document.querySelector(".mvp-card") }));
    assert.equal(loss.close, "So close.", `${viewport}: the loss says So close`);
    assert.equal(loss.near, "The enemy core was down to 40% health.", `${viewport}: how close it was`);
    assert.ok(loss.tip && /^Tip /.test(loss.line), `${viewport}: one concrete tip (${loss.tip}: ${loss.line})`);
    assert.equal(loss.mvp, false, `${viewport}: no MVP card on a loss`);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => window.__frontier.ceremony.stamps), stampsBefore, `${viewport}: no stamp on a loss`);
    await checkResults(o, `${viewport} skirmish loss`);
    await shot(page, `ceremony-skirmish-loss-${viewport}`);
    assert.equal((await page.evaluate(() => window.__ends.at(-1))).result, "defeat");

    // ---------------------------------------------------------------- Motion off (desktop): no slow motion, no swing,
    // no confetti or count-up; the result opens at once and the stamp still lands.
    if (viewport === "desktop") {
      await o.tap(".result-actions [data-restart]");
      await page.waitForFunction(() => window.__frontier.started && !window.__frontier.sim.result && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
      const calm = await page.evaluate(() => { const f = window.__frontier; f.settings.combatMotion = false; return { played: f.ceremony.played, stamps: window.__stamps.length }; });
      await page.evaluate(() => {
        const s = window.__frontier.sim, proto = Object.getPrototypeOf(s).tick, unit = s.own(0).find((e) => e.kind === "unit" && e.type !== "worker");
        s.tick = (dt) => { delete s.tick; proto.call(s, dt); for (const c of s.entities.filter((e) => e.team !== 0 && e.type === "hq")) s.applyDamage(c, 1e7, 0, unit.id); };
      });
      await page.locator(".result-card.won").waitFor({ state: "visible", timeout: TIMEOUT.step });
      await waitStamp(page, calm.stamps + 1, "desktop motion off");
      const still = await page.evaluate(() => ({ played: window.__frontier.ceremony.played, confetti: !!document.querySelector(".ceremony-confetti"), counting: !!document.querySelector(".stat strong.counting"), live: document.querySelector("#modal-content").classList.contains("ceremony-live") }));
      assert.deepEqual(still, { played: calm.played, confetti: false, counting: false, live: false }, "desktop: motion off skips the slow motion, swing, confetti and count-up");
      await page.evaluate(() => { window.__frontier.settings.combatMotion = true; });
    }

    // ---------------------------------------------------------------- Campaign mission: win
    await o.tap(".result-actions [data-new-game]");
    await page.waitForSelector("#briefing:not([hidden])", { timeout: TIMEOUT.step });
    await o.tap('[data-mode="campaign"]');
    await o.ready();
    await o.tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible", timeout: TIMEOUT.step });
    const missionStamps = await stampsNow(page);
    await o.tap("#mb-skip");
    await o.tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
    await page.waitForTimeout(400);
    await page.evaluate(() => { const s = window.__frontier.sim; for (const id of s.missionDef.win) s.setObjective(id, "done"); });
    const mission = Date.now();
    while (Date.now() - mission < 30000 && !(await page.locator(".debrief").isVisible())) {
      if (await page.evaluate(() => window.__frontier.scene()?.open)) await o.tap("#scene-skip").catch(() => {});
      await page.waitForTimeout(150);
    }
    await page.locator(".debrief").waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.equal(await page.locator(".debrief").getAttribute("data-result"), "victory");
    await mvpCard(page, `${viewport} mission`);
    await waitStamp(page, missionStamps + 1, `${viewport} mission`);
    assert.equal(await page.locator(".debrief .medal-badge.stamped").count(), 1, `${viewport}: the medal is the stamp`);
    await checkResults(o, `${viewport} mission win`);
    await page.waitForTimeout(1500);
    await shot(page, `ceremony-mission-win-${viewport}`);
    const missionEnd = await page.evaluate(() => window.__ends.at(-1));
    assert.equal(missionEnd.mode, "campaign");
    assert.ok(missionEnd.medal, `${viewport}: onMatchEnd carries the medal`);

    // ---------------------------------------------------------------- Frontier Defence: win
    await o.tap(".debrief-actions [data-new-game]");
    await page.waitForSelector("#briefing:not([hidden])", { timeout: TIMEOUT.step });
    await o.tap('[data-mode="defence"]');
    await page.waitForSelector("#defence-setup .defence-levels", { timeout: TIMEOUT.step });
    await o.tap('[data-level-id="d-gorge"]');
    await page.waitForFunction(() => window.__frontier.sim.missionDef?.id === "d-gorge");
    await startMatch(o);
    await page.waitForFunction(() => document.querySelector("#defence-bar:not([hidden])"), null, { timeout: TIMEOUT.step });
    const defenceStamps = await stampsNow(page);
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, d = s.missionDef.defence;
      const crews = Array.isArray(d.crews) ? d.crews : Object.keys(d.crews);
      for (const pad of d.pads || []) if (s.command({ team: 0, type: "padBuild", pad: pad.id, crew: crews[0] })) break;
      const proto = Object.getPrototypeOf(s).tick;
      s.tick = (dt) => { delete s.tick; proto.call(s, dt); s.result = "victory"; };
    });
    await page.locator(".defence-result").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await mvpCard(page, `${viewport} defence`);
    await waitStamp(page, defenceStamps + 1, `${viewport} defence`);
    await checkResults(o, `${viewport} defence win`);
    await page.waitForTimeout(1500);
    await shot(page, `ceremony-defence-win-${viewport}`);
    assert.equal((await page.evaluate(() => window.__ends.at(-1))).mode, "defence");

    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }
}, { browser });
