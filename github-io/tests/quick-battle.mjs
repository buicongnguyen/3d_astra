// First-minute hooks (AAA round 3, R3-Q) at 1440x900, 390x844 and 844x390:
//   - Quick battle is a direct button on the title (R3-M's #title-actions slot): on screen with no
//     scrolling and nothing to open first, at least 44 px tall, 11 px text, no sideways scroll;
//   - one tap starts the match: Riverlands, one Relaxed Ashfall rival, the `quick` rule only (the
//     player's own battle rules are kept and come back), a ready Sentinel tower and Supply relay;
//   - the first combat comes by 0:45 (match clock held and stepped, so a slow runner cannot fail it);
//   - New game returns to the player's own setup (selects and rules unchanged, no `quick`);
//   - First watch (a fresh Defence profile, ?firstwatch): the enemy roster strip with the Scout Runner
//     shows before wave 1, clear of the Defence bar and wave intel, 11 px text, and goes away once the
//     wave sets off; the runner is out with wave 1.
// Screenshots: test-results/quick-battle-<viewport>-{title,fight,roster}.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.QUICK_VIEWPORTS || "desktop,portrait,landscape").split(",");
const RULES_KEY = "frontier-command.rules.v1";

const tinyText = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(`${selector}, ${selector} *`)]
  .filter((el) => el.getClientRects().length && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11)
  .map((el) => el.textContent.trim()), selector);
const noSideScroll = async (page, where) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), `${where}: page scrolls sideways`);
const rect = (page, selector) => page.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }, selector);
const overlap = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

await suite("quick-battle", async () => {
  for (const viewport of VIEWPORTS) {
    // ---------------- Quick battle ----------------
    {
      const o = await openPage(browser, viewport, { timeout: TIMEOUT.models }), { page, errors } = o;
      // The player chose the Expanded roster on an earlier visit: Quick battle must not use it or lose it.
      await page.addInitScript((key) => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(key, JSON.stringify({ roster: "expanded" })); sessionStorage.setItem("seeded", "1"); } } catch {} }, RULES_KEY);
      await o.goto("");
      await o.ready();
      const setup = await page.evaluate(() => Object.fromEntries(["scenario", "enemy-count", "ai-speed", "enemy-faction", "player-faction"].map((id) => [id, document.getElementById(id).value])));
      const title = await page.evaluate(() => {
        const b = document.querySelector("#quick-battle"), r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { slot: document.querySelector("#title-actions").hidden, onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, reached: !!hit?.closest("#quick-battle"), w: r.width, h: r.height, disabled: b.disabled };
      });
      assert.deepEqual([title.slot, title.onScreen, title.reached, title.disabled], [false, true, true, false], `${viewport}: Quick battle is one tap away ${JSON.stringify(title)}`);
      assert.ok(title.h >= 44 && title.w >= 44, `${viewport}: Quick battle ${title.w}x${title.h}`);
      assert.deepEqual(await tinyText(page, "#title-actions"), [], `${viewport}: Quick battle text >= 11 px`);
      await noSideScroll(page, viewport);
      await shot(page, `quick-battle-${viewport}-title`);

      await o.tap("#quick-battle");
      await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
      await page.evaluate(() => { window.__frontier.hold = true; });
      const match = await page.evaluate(() => {
        const f = window.__frontier, s = f.sim, own = (type) => s.entities.filter((e) => e.team === 0 && e.type === type && e.hp > 0).length;
        return { quick: f.quick, rules: s.rules, speed: s.aiSpeed, map: s.terrain.id, enemies: s.enemyCount, rival: s.factions[1], started: s.time, playerRules: f.rules };
      });
      assert.deepEqual([match.quick, match.rules, match.speed, match.map, match.enemies, match.rival], [true, { quick: "on" }, "relaxed", "riverlands", 1, "ashfall"], `${viewport}: ${JSON.stringify(match)}`);
      assert.deepEqual(match.playerRules, { roster: "expanded" }, `${viewport}: the player's own rules are kept`);
      // Roster 2026-11-24: the count of Quick battles picks the next rival (Sunward after this Ashfall one).
      assert.equal(await page.evaluate(() => localStorage.getItem("frontier-quick-battles")), "1", `${viewport}: the Quick battle is counted`);
      const fight = await page.evaluate(() => {
        const f = window.__frontier, s = f.sim;
        let combat = null;
        for (let i = 0; i < 46 / 0.05 && combat === null; i++) {
          f.step(0.05);
          for (const e of s.events) if (combat === null && e.type === "shot" && (e.team === 0 || s.get(e.target)?.team === 0)) combat = s.time;
        }
        const own = (type) => s.entities.filter((e) => e.team === 0 && e.type === type && e.hp > 0).length;
        return { combat, tower: own("tower"), relay: own("relay") };
      });
      assert.ok(fight.combat !== null && fight.combat <= 45, `${viewport}: first combat at ${fight.combat} s (limit 45)`);
      assert.deepEqual([fight.tower, fight.relay], [1, 1], `${viewport}: the ready outpost`);
      await page.evaluate(() => window.__frontier.step(1));
      await page.waitForTimeout(500);
      await shot(page, `quick-battle-${viewport}-fight`);

      // New game: back to the player's own setup.
      await page.evaluate(() => { window.__frontier.hold = false; });
      await o.tap("#pause");
      await o.tap("[data-new-game]");
      await page.waitForFunction(() => !window.__frontier.started && !document.querySelector("#briefing").hidden, null, { timeout: TIMEOUT.step });
      const back = await page.evaluate(() => ({ quick: window.__frontier.quick, rules: window.__frontier.rules, simRules: window.__frontier.sim.rules || null, setup: Object.fromEntries(["scenario", "enemy-count", "ai-speed", "enemy-faction", "player-faction"].map((id) => [id, document.getElementById(id).value])) }));
      assert.deepEqual(back, { quick: false, rules: { roster: "expanded" }, simRules: { roster: "expanded" }, setup }, `${viewport}: the menu is the player's own again`);
      assert.deepEqual(errors, [], `${viewport}: page errors`);
      await page.close();
    }

    // ---------------- First watch ----------------
    {
      const o = await openPage(browser, viewport, { timeout: TIMEOUT.models }), { page, errors } = o;
      await page.addInitScript(() => { try { if (!sessionStorage.getItem("fresh")) { localStorage.removeItem("frontier-defence-v1"); sessionStorage.setItem("fresh", "1"); } } catch {} });
      await o.goto("firstwatch");
      await o.ready();
      await o.tap('[data-mode="defence"]');
      await page.waitForSelector("#defence-setup .defence-levels");
      await o.tap('[data-level-id="d-gorge"]');
      await page.waitForFunction(() => window.__frontier.sim.missionDef?.id === "d-gorge" && !!window.__frontier.sim.missionDef.defence.runner);
      await o.ready();
      await o.tap("#start");
      await page.waitForFunction(() => window.__frontier.started && document.querySelector("#defence-bar:not([hidden])") && document.querySelector("#roster-preview:not([hidden])"), null, { timeout: TIMEOUT.models });
      await page.evaluate(() => { window.__frontier.hold = true; });
      await page.waitForTimeout(400);
      const strip = await page.evaluate(() => [...document.querySelectorAll("#roster-preview .roster-unit")].map((u) => u.dataset.type));
      assert.deepEqual(strip, ["rider", "scrapper", "ranger", "scorcher", "kite", "tank", "balloon"], `${viewport}: the roster, the Scout Runner first`);
      const [box, bar, intel] = [await rect(page, "#roster-preview"), await rect(page, "#defence-bar"), await rect(page, "#defence-intel")];
      assert.ok(!overlap(box, bar) && !overlap(box, intel), `${viewport}: the strip is clear of the bar and the wave intel ${JSON.stringify({ box, bar, intel })}`);
      assert.deepEqual(await tinyText(page, "#roster-preview"), [], `${viewport}: roster text >= 11 px`);
      await noSideScroll(page, `${viewport} defence`);
      await shot(page, `quick-battle-${viewport}-roster`);
      const after = await page.evaluate(() => {
        const f = window.__frontier, out = [];
        for (let i = 0; i < 32 / 0.05; i++) { f.step(0.05); for (const e of f.sim.events) if (e.type === "runner") out.push(e.phase); f.sim.events.length = 0; }
        return { phases: out, wave: f.sim.defence.wave, hidden: document.querySelector("#roster-preview").hidden };
      });
      assert.deepEqual(after, { phases: ["out"], wave: 1, hidden: true }, `${viewport}: the runner sets off with wave 1 and the strip goes`);
      assert.deepEqual(errors, [], `${viewport}: page errors`);
      await page.close();
    }
  }
}, { browser });
