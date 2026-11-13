// 0.19b "Story you see" in the browser: a staged scene (letterbox, held match, music kept, camera
// back where it was, Skip by key and by tap, motion-off cut), the campaign map with its 15 relays at
// the three viewports, the two campaign missions under the Defence rules started from the
// campaign, and Wings over Copper (0.18.3): started from the campaign, the Flak tile at the core,
// the first balloon raid and its scene. Text 11 px or more, taps 44 px or more and no sideways scroll everywhere.
// Screenshots go to test-results/story-*.
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";
import { SCENES, sceneLines } from "../src/story/scenes.js";

const KEY = "frontier-campaign-v2";
const ids = MISSIONS.map((m) => m.id), at = (id) => ids.indexOf(id);
const cleared = (count) => ({ cleared: Object.fromEntries(ids.slice(0, count).map((id, i) => [id, { time: 300 + i * 20, medal: ["gold", "silver", "bronze"][i % 3], difficulty: "standard" }])) });

// Visible text under `scope` smaller than 11 px, visible buttons smaller than 44 px or off screen, sideways scroll.
const audit = (page, scope) => page.evaluate((scope) => {
  const root = document.querySelector(scope), visible = (el) => { const r = el.getBoundingClientRect(), st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
  const small = [];
  for (const el of root.querySelectorAll("*")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || !visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 11) small.push(`${el.textContent.trim().slice(0, 24)} (${size}px)`);
  }
  const buttons = [...root.querySelectorAll("button")].filter(visible).map((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), left: r.left, right: r.right, text: b.textContent.trim().slice(0, 24) }; });
  return { small, tiny: buttons.filter((b) => b.w < 44 || b.h < 44), outside: buttons.filter((b) => b.left < -0.5 || b.right > innerWidth + 0.5), sideways: document.documentElement.scrollWidth > innerWidth };
}, scope);
const clean = (r, where) => {
  assert.deepEqual(r.small, [], `${where}: text under 11 px`);
  assert.deepEqual(r.tiny, [], `${where}: buttons under 44 px`);
  assert.deepEqual(r.outside, [], `${where}: buttons outside the screen`);
  assert.equal(r.sideways, false, `${where}: sideways scroll`);
};

const browser = await launchBrowser();
await suite("story: scenes, the 15-mission campaign map, the defence missions and the first air raid", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    const load = async (progress) => { await goto(); await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, progress]); await page.reload(); await ready(); };
    const campaign = async () => { await tap('[data-mode="campaign"]'); await page.locator("#campaign-map .cmap").waitFor({ state: "visible" }); };
    const startMission = async (id) => {
      await tap(`[data-mission="${id}"]`);
      await tap("#start");
      await page.locator("#mission-briefing").waitFor({ state: "visible" });
      await tap("#mb-skip"); await tap("#mb-next");
      await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    };

    // 1. The campaign map shows every mission as a relay: 15 nodes in three acts, two square Defence relays.
    await load(cleared(at("m07b-hold-the-valley")));
    await campaign();
    const map = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll(".cmap-node")], board = document.querySelector(".cmap-board").getBoundingClientRect();
      const centres = nodes.map((n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, inside: r.left >= board.left - 1 && r.right <= board.right + 1 && r.top >= board.top - 1 && r.bottom <= board.bottom + 1 }; });
      let closest = Infinity;
      for (let i = 0; i < centres.length; i++) for (let j = i + 1; j < centres.length; j++) closest = Math.min(closest, Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y));
      return { count: nodes.length, ids: nodes.map((n) => n.dataset.mapMission), defence: [...document.querySelectorAll(".cmap-node.defence")].map((n) => n.dataset.mapMission), inside: centres.every((c) => c.inside), closest, lit: document.querySelector(".cmap").dataset.lit, next: document.querySelector(".cmap-node.next")?.dataset.mapMission, count2: document.querySelector(".cmap-count").textContent };
    });
    assert.equal(map.count, 15, `${viewport}: 15 relays`);
    assert.deepEqual(map.ids, ids);
    assert.deepEqual(map.defence, ["m02b-hold-the-river", "m07b-hold-the-valley"]);
    assert.ok(map.inside, `${viewport}: every relay on the board`);
    assert.ok(map.closest >= 44, `${viewport}: relays ${Math.round(map.closest)} px apart`);
    assert.equal(map.next, "m07b-hold-the-valley");
    assert.match(map.count2, /\/ 15 relays lit/);
    clean(await audit(page, "#campaign-map"), `${viewport} campaign map`);
    await shot(page, `story-map-${viewport}`);

    // 2. A scene: letterbox, the HUD steps aside, the match holds but the music does not, the lines
    // show in the dialogue box, Skip (key or tap) returns the camera and the match.
    await startMission("m01-first-light");
    const before = await page.evaluate(() => { const f = window.__frontier, s = f.sim; s.explored[0].fill(1); return { x: f.view.focus.x, z: f.view.focus.z, zoom: f.view.zoom, time: s.time }; });
    assert.equal(await page.evaluate(() => window.__frontier.playScene("relay-wakes")), true);
    await page.waitForFunction(() => window.__frontier.scene().open && document.querySelector(".scene-veil").classList.contains("on"));
    const held = await page.evaluate(() => ({ time: window.__frontier.sim.time, paused: window.__frontier.paused }));
    await page.waitForTimeout(700);
    const mid = await page.evaluate(() => {
      const f = window.__frontier, bar = document.querySelector(".scene-bar.top"), r = bar.getBoundingClientRect();
      return { time: f.sim.time, audioPaused: f.audioPaused, scene: f.scene(), bar: { h: r.height, transform: getComputedStyle(bar).transform }, hud: getComputedStyle(document.querySelector("#mission-objectives")).visibility,
        focus: { x: f.view.focus.x, z: f.view.focus.z }, root: document.documentElement.classList.contains("scene-open") };
    });
    assert.equal(held.paused, true, "the scene holds the match");
    assert.equal(mid.time, held.time, "the simulation clock stands still");
    assert.equal(mid.audioPaused, false, "the music is not told the match is paused");
    assert.deepEqual([mid.scene.id, mid.scene.letterbox, mid.root], ["relay-wakes", true, true]);
    assert.ok(mid.bar.h > 20, `${viewport}: letterbox bar ${mid.bar.h} px`);
    assert.equal(mid.hud, "hidden", "the HUD steps aside");
    assert.ok(Math.hypot(mid.focus.x - before.x, mid.focus.z - before.z) > 1, "the camera moves toward the relay");
    // Wait for the first line, then measure and photograph the scene mid-play.
    const first = sceneLines(SCENES["relay-wakes"])[0];
    await page.waitForFunction((text) => document.querySelector("#dialogue-text")?.textContent === text, first.text, { timeout: TIMEOUT.step });
    await page.waitForTimeout(400); // the line's arrival fade
    assert.ok(await page.evaluate(() => document.querySelector("#dialogue-portrait").children.length > 0 && document.querySelector("#dialogue-portrait").dataset.who === "okoro"), "the line has its portrait");
    assert.match(await page.locator("#dialogue-name").innerText(), /Okoro/);
    clean(await audit(page, "#scene"), `${viewport} scene`);
    clean(await audit(page, "#dialogue"), `${viewport} scene line`);
    assert.ok(await page.evaluate(() => { const d = document.querySelector("#dialogue").getBoundingClientRect(), b = document.querySelector(".scene-bar.bottom").getBoundingClientRect(); return d.bottom <= b.top + 2 && d.top >= 0; }), `${viewport}: the line sits above the lower bar`);
    await shot(page, `story-scene-${viewport}`);
    if (mobile) await tap("#scene-skip"); else await page.keyboard.press("Escape");
    await page.waitForFunction(() => !window.__frontier.scene().open);
    const after = await page.evaluate(() => { const f = window.__frontier; return { x: f.view.focus.x, z: f.view.focus.z, zoom: f.view.zoom, paused: f.paused, log: f.mission.queue.log.map((l) => l.text), veil: document.querySelector("#scene").hidden, root: document.documentElement.classList.contains("scene-open") }; });
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.5 && Math.abs(after.zoom - before.zoom) < 0.01, "the camera is back where the player had it");
    assert.deepEqual([after.paused, after.veil, after.root], [false, true, false], "the match runs again");
    for (const line of sceneLines(SCENES["relay-wakes"])) assert.ok(after.log.includes(line.text), `the Comms log keeps "${line.text}"`);
    await page.waitForFunction((t) => window.__frontier.sim.time > t, held.time);
    assert.equal(await page.evaluate(() => window.__frontier.playScene("relay-wakes")), false, "a scene plays once per match");
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }

  // 3. Motion-off on desktop: the camera cuts to the place; Space skips.
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await goto();
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, cleared(at("m10-obsidian-storm"))]);
    await page.reload(); await ready();
    await tap('[data-mode="campaign"]');
    await tap('[data-mission="m10-obsidian-storm"]');
    await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible" });
    await tap("#mb-skip"); await tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    await page.evaluate(() => { document.documentElement.classList.add("motion-off"); window.__frontier.sim.explored[0].fill(1); window.__frontier.playScene("crown-lights"); });
    await page.waitForFunction(() => window.__frontier.scene().open);
    const cut = await page.evaluate(() => { const f = window.__frontier, c = f.sim.missionDef.regions.crown; return Math.hypot(f.view.focus.x - c.x, f.view.focus.z - c.z); });
    assert.ok(cut < 0.5, `motion-off cuts straight to the Crown (${cut.toFixed(2)} m)`);
    await page.keyboard.press(" ");
    await page.waitForFunction(() => !window.__frontier.scene().open);
    assert.deepEqual(errors, [], "motion-off: page errors");
    await page.close();
  }

  // 4. The defence missions start from the campaign and play under the Defence rules; the reworked
  // bridge assault (mission 2) and plateau hold (mission 9) are photographed for review.
  for (const viewport of ["desktop", "portrait"]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport);
    for (const id of ["m02b-hold-the-river", ...(viewport === "desktop" ? ["m07b-hold-the-valley"] : [])]) {
      await goto();
      await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, cleared(at(id))]);
      await page.reload(); await ready();
      await tap('[data-mode="campaign"]');
      assert.equal(await page.locator(`[data-mission="${id}"]`).getAttribute("aria-current"), "true", `${id} is next`);
      assert.match(await page.locator("#briefing-rivals").innerText(), /20 lives · [78] waves/);
      await tap("#start");
      await page.locator("#mission-briefing").waitFor({ state: "visible" });
      await tap("#mb-skip");
      await tap("#mb-next");
      await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden && !!window.__frontier.sim.defence, null, { timeout: TIMEOUT.models });
      await page.waitForFunction(() => document.documentElement.classList.contains("in-defence") && !!document.querySelector("#defence-lives"), null, { timeout: TIMEOUT.step });
      const state = await page.evaluate(() => { const f = window.__frontier, s = f.sim; return { id: s.missionDef.id, lives: s.defence.lives, waves: s.missionDef.defence.waves.length, heading: document.querySelector(".map-heading h1").textContent, label: document.querySelector("#operation-label").textContent }; });
      assert.equal(state.id, id);
      assert.equal(state.lives, 20);
      assert.match(state.heading, new RegExp(`Mission ${at(id) + 1} · ${MISSIONS[at(id)].title}`), "the campaign heading, not the Defence mode's");
      assert.match(state.label, /CAMPAIGN · MISSION/);
      // Crew a few pads, call the first waves and let them walk: a mid-wave photograph.
      await page.evaluate(() => {
        const s = window.__frontier.sim, def = s.missionDef.defence;
        // Time moves with step() only until the photograph (a slow runner would let the wave run on).
        window.__frontier.hold = true;
        s.players[0].alloy = 2000;
        def.pads.slice(0, 7).forEach((p, i) => s.command({ team: 0, type: "padBuild", pad: p.id, crew: def.crews[i % def.crews.length] }));
        s.command({ team: 0, type: "waveCall" });
        window.__frontier.step(8);
      });
      // Step on (the clock is held) until the column is on the road: up to 30 s of match time.
      await page.evaluate(() => { const f = window.__frontier, on = () => f.sim.entities.some((e) => e.team === 1 && e.kind === "unit" && e.hp > 0); for (let i = 0; i < 60 && !on(); i++) f.step(0.5); });
      await page.waitForFunction(() => window.__frontier.sim.entities.some((e) => e.team === 1 && e.kind === "unit" && e.hp > 0), null, { timeout: TIMEOUT.step });
      await page.evaluate(() => { const f = window.__frontier, d = f.sim.missionDef.defence; f.view.focusOn(d.camera.x, d.camera.z); });
      await page.waitForTimeout(500);
      // The campaign heading and the Defence chips fit (the in-match HUD itself is ui-quality's suite).
      const fit = await audit(page, "#defence-lives");
      assert.equal(fit.sideways, false, `${viewport} ${id}: sideways scroll`);
      assert.deepEqual((await audit(page, ".map-heading")).small, [], `${viewport} ${id}: heading text`);
      await shot(page, `story-${id}-${viewport}`);
      await page.evaluate(() => { window.__frontier.hold = false; });
      // The wave's story beat reached the dialogue box.
      await page.waitForFunction(() => window.__frontier.mission.queue.log.some((l) => l.who === "hale"), null, { timeout: TIMEOUT.step }).catch(() => {});
      assert.ok(await page.evaluate(() => window.__frontier.mission.queue.log.some((l) => l.who === "hale")), "Hale speaks as the first wave starts");
    }
    assert.deepEqual(errors, [], `${viewport} defence missions: page errors`);
    await page.close();
  }

  // Review shots of the reworked missions: the bridgehead over the west bridge, the dune plateau.
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    for (const [id, region] of [["m02-first-contact", "bridgehead"], ["m09-a-debt-in-the-dunes", "ridgeTop"]]) {
      await goto();
      await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, cleared(at(id))]);
      await page.reload(); await ready();
      await tap('[data-mode="campaign"]');
      await tap(`[data-mission="${id}"]`);
      await tap("#start");
      await page.locator("#mission-briefing").waitFor({ state: "visible" });
      await tap("#mb-skip"); await tap("#mb-next");
      await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
      await page.evaluate((name) => {
        const f = window.__frontier, s = f.sim, p = s.missionDef.regions[name];
        s.explored[0].fill(1);
        // Walk the starting troops up to the place, so the photograph shows the fight it is about.
        const troops = s.own(0).filter((e) => e.kind === "unit" && e.type !== "worker").map((e) => e.id);
        s.command({ team: 0, type: "order", ids: troops, order: { type: "attackmove", x: p.x, z: p.z + (name === "bridgehead" ? 18 : 10) } });
        f.step(25);
        f.view.focusOn(p.x, p.z + 6);
      }, region);
      await page.waitForTimeout(600);
      await shot(page, `story-${id.slice(0, 3)}-${region}-desktop`);
    }
    assert.deepEqual(errors, [], "review shots: page errors");
    await page.close();
  }

  // 5. Wings over Copper (0.18.3) starts from the campaign: the core offers Flak (and Kite and Hawk),
  // the first balloon raid crosses the basin and its scene plays when it reaches the copper works.
  for (const viewport of ["desktop", "portrait"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    const id = "m06b-wings-over-copper";
    await goto();
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, cleared(at(id))]);
    await page.reload(); await ready();
    await tap('[data-mode="campaign"]');
    assert.equal(await page.locator(`[data-mission="${id}"]`).getAttribute("aria-current"), "true", `${id} is next`);
    await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible" });
    await tap("#mb-skip"); await tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    assert.match(await page.locator(".map-heading h1").textContent(), new RegExp(`Mission ${at(id) + 1} · Wings over Copper`));
    // The Command core's tiles: Harvester, Flak, Kite, Hawk.
    await page.evaluate(() => { const f = window.__frontier, hq = f.sim.own(0).find((e) => e.type === "hq"); f.select([hq.id]); f.step(0.05); });
    if (mobile) { await tap('#dock-tabs [data-dock="actions"]'); await page.waitForTimeout(120); }
    const flak = page.locator('#commands [data-action="flak"]');
    await flak.waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.match(await flak.textContent(), /Flak guns/);
    assert.deepEqual(await page.locator("#commands [data-action]").evaluateAll((t) => t.map((b) => b.dataset.action)), ["worker", "flak", "kite", "hawk"]);
    if (mobile) assert.ok((await flak.boundingBox()).height >= 44, "Flak tile 44 px");
    // Fast-forward to the first raid; the scene starts on its own once a flyer reaches the copper works.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, sky = s.missionDef.regions.skyWatch;
      f.select([]);
      s.explored[0].fill(1);
      for (let i = 0; i < 400 && !s.entities.some((e) => e.team === 1 && e.flying && Math.hypot(e.x - sky.x, e.z - sky.z) < sky.r + 6); i++) f.step(0.5);
    });
    await page.waitForFunction(() => window.__frontier.scene().open, null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate(() => window.__frontier.scene().id), "first-balloon");
    const first = sceneLines(SCENES["first-balloon"])[0];
    await page.waitForFunction((text) => document.querySelector("#dialogue-text")?.textContent === text, first.text, { timeout: TIMEOUT.step });
    await page.waitForTimeout(400);
    clean(await audit(page, "#scene"), `${viewport} first-balloon scene`);
    await shot(page, `story-m06b-scene-${viewport}`);
    if (mobile) await tap("#scene-skip"); else await page.keyboard.press("Escape");
    await page.waitForFunction(() => !window.__frontier.scene().open);
    // The raid over the refinery: balloons in the air above the copper works.
    const raid = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, r = s.missionDef.regions.refinery;
      f.step(4);
      f.view.focusOn(r.x + 6, r.z - 4);
      return { balloons: s.entities.filter((e) => e.team === 1 && e.type === "balloon" && e.hp > 0).length, refinery: s.tagged("refinery").length, log: f.mission.queue.log.map((l) => l.text) };
    });
    assert.ok(raid.balloons >= 1 && raid.refinery === 1, JSON.stringify(raid));
    for (const line of sceneLines(SCENES["first-balloon"])) assert.ok(raid.log.includes(line.text), `the Comms log keeps "${line.text}"`);
    await page.waitForTimeout(600);
    await shot(page, `story-m06b-raid-${viewport}`);
    assert.deepEqual(errors, [], `${viewport} Wings over Copper: page errors`);
    await page.close();
  }
}, { browser });
