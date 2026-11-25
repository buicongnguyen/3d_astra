// W9 (2026-11-26) in the browser: a new side mission started from the campaign map plays its staged scene to the end
// on its own (not skipped) on desktop and on a phone in portrait and landscape: the match holds, the lines show in
// the dialogue box, then the camera comes back and the clock runs on. Also the 25-relay campaign map (four rows,
// relays 44 px apart) and the east bridge of mission 2 going from the river when the script blows it.
// Text 11 px or more, taps 44 px or more and no sideways scroll. Screenshots: test-results/story-moments-*.
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";
import { SCENES, sceneLines } from "../src/story/scenes.js";

const KEY = "frontier-campaign-v2";
const ids = MISSIONS.map((m) => m.id);
// Every story mission up to Gun Hill cleared, so Hawk Wing (m06d) is open.
const upTo = (id) => ({ cleared: Object.fromEntries(ids.slice(0, ids.indexOf(id) + 1).map((m, i) => [m, { time: 300 + i, medal: "gold", difficulty: "standard" }])) });
const audit = (page, scope) => page.evaluate((scope) => {
  const root = document.querySelector(scope), visible = (el) => { const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
  const small = [];
  for (const el of root.querySelectorAll("*")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || !visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 11) small.push(`${el.textContent.trim().slice(0, 24)} (${size}px)`);
  }
  const tiny = [...root.querySelectorAll("button")].filter(visible).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length;
  return { small, tiny, sideways: document.documentElement.scrollWidth > innerWidth };
}, scope);

const browser = await launchBrowser();
await suite("story moments: a W9 scene plays to its end on desktop and phones, the 25-relay map, the blown bridge", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport);
    await goto();
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, upTo("m06c-gun-hill")]);
    await page.reload();
    await ready();
    await tap('[data-mode="campaign"]');
    await page.locator("#campaign-map .cmap").waitFor({ state: "visible" });

    // The campaign map: 25 relays in order, on the board, 44 px apart, on four rows.
    const map = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll(".cmap-node")], board = document.querySelector(".cmap-board").getBoundingClientRect();
      const c = nodes.map((n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, inside: r.left >= board.left - 1 && r.right <= board.right + 1 && r.top >= board.top - 1 && r.bottom <= board.bottom + 1 }; });
      let closest = Infinity;
      for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) closest = Math.min(closest, Math.hypot(c[i].x - c[j].x, c[i].y - c[j].y));
      return { ids: nodes.map((n) => n.dataset.mapMission), inside: c.every((p) => p.inside), closest, rows: new Set(c.map((p) => Math.round(p.y))).size, open: document.querySelector('.cmap-node[data-map-mission="m06d-hawk-wing"]')?.classList.contains("open") };
    });
    assert.deepEqual(map.ids, ids, `${viewport}: every mission a relay, in order`);
    assert.ok(map.inside, `${viewport}: every relay on the board`);
    assert.ok(map.closest >= 44, `${viewport}: relays ${Math.round(map.closest)} px apart`);
    assert.equal(map.rows, 4, `${viewport}: four rows`);
    assert.equal(map.open, true, `${viewport}: Hawk Wing is open after Gun Hill`);
    const mapAudit = await audit(page, "#campaign-map");
    assert.deepEqual(mapAudit.small, [], `${viewport}: map text under 11 px`);
    assert.equal(mapAudit.sideways, false, `${viewport}: sideways scroll`);
    await shot(page, `story-moments-map-${viewport}`);

    // Hawk Wing: its opening scene (hawks-rise) at 0:02 plays through on its own.
    await tap('[data-mission="m06d-hawk-wing"]');
    await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible" });
    await tap("#mb-skip"); await tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    await page.waitForFunction(() => window.__frontier.scene().open && window.__frontier.scene().id === "hawks-rise", null, { timeout: TIMEOUT.step * 3 });
    const held = await page.evaluate(() => ({ time: window.__frontier.sim.time, paused: window.__frontier.paused }));
    assert.equal(held.paused, true, `${viewport}: the scene holds the match`);
    const lines = sceneLines(SCENES["hawks-rise"]);
    await page.waitForFunction((t) => document.querySelector("#dialogue")?.textContent.includes(t), lines[0].text, { timeout: TIMEOUT.step });
    const mid = await audit(page, "#scene");
    assert.deepEqual(mid.small, [], `${viewport}: scene text under 11 px`);
    assert.equal(mid.tiny, 0, `${viewport}: Skip is 44 px`);
    assert.equal(mid.sideways, false);
    assert.equal(await page.evaluate(() => window.__frontier.sim.time), held.time, `${viewport}: the clock waits`);
    await shot(page, `story-moments-scene-${viewport}`);
    // No Skip: it ends by itself after its last beat (about 9 s of beats; a slow machine gets three minutes).
    await page.waitForFunction(() => !window.__frontier.scene().open, null, { timeout: 180000 });
    const after = await page.evaluate(() => { const f = window.__frontier; return { paused: f.paused, log: f.mission.queue.log.map((l) => l.text), veil: document.querySelector("#scene").hidden }; });
    assert.equal(after.veil, true, `${viewport}: the veil is gone`);
    for (const line of lines) assert.ok(after.log.includes(line.text), `${viewport}: "${line.text}" was shown`);
    await page.waitForFunction((t) => window.__frontier.sim.time > t + 0.5, held.time, { timeout: TIMEOUT.step });

    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }

  // The blown bridge in a real mission 2 match (desktop): break the bridgehead by script, the scene plays, the east
  // bridge model hides and the minimap and the sim agree.
  const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
  await goto();
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, upTo("m01-first-light")]);
  await page.reload();
  await ready();
  await tap('[data-mode="campaign"]');
  await page.locator("#campaign-map .cmap").waitFor({ state: "visible" });
  await tap('[data-mission="m02-first-contact"]');
  await tap("#start");
  await page.locator("#mission-briefing").waitFor({ state: "visible" });
  await tap("#mb-skip"); await tap("#mb-next");
  await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
  // No exploring by hand: the blast itself lights the east bridge (a flare's vision), so the scene can look at it.
  const before = await page.evaluate(() => { const f = window.__frontier; return { visible: f.view.environment.bridges.get(22)?.visible, sim: f.sim.nav.canStand(22, 0, 1) }; });
  assert.deepEqual(before, { visible: true, sim: true });
  assert.equal(await page.evaluate(() => window.__frontier.sim.isExplored({ x: 22, z: 0 }, 0)), false, "the east bridge is not scouted yet");
  await page.evaluate(() => { for (const e of window.__frontier.sim.tagged("bridgehead")) e.hp = 0; });
  await page.waitForFunction(() => window.__frontier.scene().id === "east-bridge-falls", null, { timeout: TIMEOUT.step * 3 });
  // Once the camera has reached the east bridge (beat 3, Hale's line), the span is already gone from the river.
  await page.waitForFunction(() => window.__frontier.scene().beat >= 3, null, { timeout: TIMEOUT.step * 3 });
  assert.ok(await page.evaluate(() => Math.hypot(window.__frontier.view.focus.x - 22, window.__frontier.view.focus.z) < 4), "the camera went to the east bridge");
  assert.equal(await page.evaluate(() => window.__frontier.view.environment.bridges.get(22)?.visible), false, "the bridge goes on the tick it blows");
  await shot(page, "story-moments-bridge-scene-desktop");
  await page.waitForFunction(() => !window.__frontier.scene().open, null, { timeout: 180000 });
  const blown = await page.evaluate(() => { const f = window.__frontier; return { visible: f.view.environment.bridges.get(22)?.visible, west: f.view.environment.bridges.get(-22)?.visible, sim: f.sim.nav.canStand(22, 0, 1), state: f.sim.crossings?.[22]?.state }; });
  assert.deepEqual(blown, { visible: false, west: true, sim: false, state: "blown" });
  await shot(page, "story-moments-bridge-after-desktop");
  assert.deepEqual(errors, []);
  await page.close();
}, { browser });
