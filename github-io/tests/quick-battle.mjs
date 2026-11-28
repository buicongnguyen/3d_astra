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
//   - Full army sandbox (owner 2026-11-28): the enemy army stands in formation on its own half from the start (seen once
//     scouted), the HUD clock "Enemy army marches in 0:30" counts down (11 px text, clear of the top bar), and at 0:30
//     the group marches on your core while the clock turns to the next group.
// Screenshots: test-results/quick-battle-<viewport>-{title,fight,roster,army,march}.png (QUICK_SHOTS copies them).
import assert from "node:assert/strict";
import { mkdirSync, copyFileSync } from "node:fs";
import { launchBrowser, openPage, suite, shot as save, TIMEOUT, OUTPUT } from "./lib/harness.mjs";

const SHOTS = process.env.QUICK_SHOTS || null; // a folder to copy the screenshots into
async function shot(page, name) {
  await save(page, name);
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); copyFileSync(`${OUTPUT}/${name}.png`, `${SHOTS}/${name}.png`); }
}

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
      await o.tap('[data-confirmed="new-game"]');
      await page.waitForFunction(() => !window.__frontier.started && !document.querySelector("#briefing").hidden, null, { timeout: TIMEOUT.step });
      const back = await page.evaluate(() => ({ quick: window.__frontier.quick, rules: window.__frontier.rules, simRules: window.__frontier.sim.rules || null, setup: Object.fromEntries(["scenario", "enemy-count", "ai-speed", "enemy-faction", "player-faction"].map((id) => [id, document.getElementById(id).value])) }));
      assert.deepEqual(back, { quick: false, rules: { roster: "expanded" }, simRules: { roster: "expanded" }, setup }, `${viewport}: the menu is the player's own again`);
      assert.deepEqual(errors, [], `${viewport}: page errors`);
      await page.close();
    }

    // ---------------- Full army sandbox: the enemy army waits on its side, then marches ----------------
    {
      const o = await openPage(browser, viewport, { timeout: TIMEOUT.models }), { page, errors } = o;
      await o.goto("");
      await o.ready();
      await o.tap("#full-army-battle");
      await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.players[0].quickBase, null, { timeout: TIMEOUT.models });
      await page.evaluate(() => { window.__frontier.hold = true; window.__frontier.holdMessages = true; });
      const army = await page.evaluate(() => {
        const s = window.__frontier.sim, home = s.entities.find((e) => e.team === 0 && e.type === "hq"), rival = s.entities.find((e) => e.team === 1 && e.type === "hq");
        const group = s.entities.filter((e) => e.tag === "arena" && e.team === 1 && e.hp > 0), d = (e, c) => Math.hypot(e.x - c.x, e.z - c.z);
        return { n: group.length, ownSide: group.every((e) => d(e, rival) < d(e, home)), idle: group.every((e) => !e.orders.length), x: group.reduce((a, e) => a + e.x, 0) / group.length, z: group.reduce((a, e) => a + e.z, 0) / group.length, time: s.time };
      });
      assert.ok(army.n === 10 && army.ownSide && army.idle, `${viewport}: the enemy army stands in formation on its own half ${JSON.stringify(army)}`);
      // Scouted: the whole map seen, the camera on the army.
      await page.evaluate(({ x, z }) => { const f = window.__frontier; f.sim.explored[0].fill(1); f.sim.visible[0].fill(1); f.view.focusOn(x, z); f.step(0.05); }, army);
      await page.waitForFunction(() => { const c = document.querySelector("#arena-march"); return c && !c.hidden; }, null, { timeout: TIMEOUT.step });
      const chip = await page.evaluate(() => {
        const c = document.querySelector("#arena-march"), r = c.getBoundingClientRect();
        const bar = document.querySelector("#topbar, .topbar, #hud-top, header")?.getBoundingClientRect();
        return { text: c.querySelector(".arena-march-text").textContent.trim(), clock: c.querySelector("b").textContent.trim(), font: parseFloat(getComputedStyle(c.querySelector(".arena-march-text")).fontSize),
          box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, onScreen: r.left >= 0 && r.right <= innerWidth && r.top >= 0, bar: bar ? { left: bar.left, top: bar.top, right: bar.right, bottom: bar.bottom } : null };
      });
      assert.equal(chip.text, "Enemy army marches in", viewport);
      assert.match(chip.clock, /^0:(29|30)$/, `${viewport}: the clock ${chip.clock}`);
      assert.ok(chip.font >= 11 && chip.onScreen, `${viewport}: ${JSON.stringify(chip)}`);
      assert.ok(!overlap(chip.box, chip.bar), `${viewport}: the clock is clear of the top bar ${JSON.stringify(chip)}`);
      await noSideScroll(page, `${viewport} sandbox`);
      await page.waitForTimeout(400);
      await shot(page, `quick-battle-${viewport}-army`);
      // At 0:30 the group marches on your core; the clock moves on to the next group (1:20).
      const march = await page.evaluate(() => {
        const f = window.__frontier, s = f.sim, seen = [];
        while (s.time < 30.2) { f.step(0.05); for (const e of s.events) if (e.type === "incoming" && e.quick) seen.push(s.time); }
        const ids = s.entities.filter((e) => e.team === 1 && e.kind === "unit" && e.orders[0]?.type === "attackmove").length;
        return { at: seen[0] ?? null, marching: ids, waiting: s.entities.filter((e) => e.tag === "arena").length, next: s.players[1].arenaWaves, time: s.time };
      });
      assert.ok(march.at !== null && march.at >= 30 && march.at < 30.1, `${viewport}: the march at 0:30 ${JSON.stringify(march)}`);
      assert.ok(march.marching >= 10 && march.waiting === 0 && march.next === 1, `${viewport}: ${JSON.stringify(march)}`);
      await page.evaluate(() => window.__frontier.step(4));
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => document.querySelector("#arena-march b").textContent.trim()), "0:46", `${viewport}: the clock counts to the next group's march at 1:20`);
      await shot(page, `quick-battle-${viewport}-march`);
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
