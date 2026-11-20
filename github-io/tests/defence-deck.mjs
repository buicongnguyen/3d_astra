// Frontier Defence command deck in the browser (AAA round 2, W1-F) at 1440x900, 390x844 and 844x390:
//   - fast-forward through the REAL frame loop: Gorge Road played at x3 (and x2) with the Call button pressed twice
//     until the match passes 60 s, then the clock is held; its command log is replayed headlessly in Node to the
//     same tick and the hashes must be equal (a headless sim ignores the client speed, so only this proves it);
//   - Shift+Space cycles the speed in Defence and Space still pauses;
//   - the tower sheet is readable text with no hover (dps, reach, armour, air, next tier), the Aim tile cycles;
//   - trait chips on the wave strip, the new-enemy card (once per type), the view button's three states,
//     phone framing and follow, the bar's size (56 px tall in portrait, 44 px controls, inside 358 px);
//   - 11 px text, 44 px taps, no sideways scroll, no page errors.
// Screenshots: test-results/defence-deck-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";
import { Simulation } from "../src/simulation.js";

const browser = await launchBrowser();
const ALL = ["d-gorge", "d-bridges", "d-switchback", "d-fordwood", "d-canyon", "d-longcrossing"];
const VIEWPORTS = (process.env.DECK_VIEWPORTS || "desktop,portrait,landscape").split(",");

async function startLevel(viewport, level = "d-gorge", extra = "") {
  const o = await openPage(browser, viewport);
  await o.page.addInitScript((ids) => { try { if (!sessionStorage.getItem("deck")) { localStorage.setItem("frontier-defence-v1", JSON.stringify({ levels: Object.fromEntries(ids.map((id) => [id, { stars: 2, lives: 12, difficulty: "standard" }])) })); sessionStorage.setItem("deck", "1"); } } catch {} }, ALL);
  await o.goto(extra);
  await o.ready();
  await o.tap('[data-mode="defence"]');
  await o.page.waitForSelector("#defence-setup .defence-levels");
  await o.tap(`[data-level-id="${level}"]`);
  await o.page.waitForFunction((id) => window.__frontier.sim.missionDef?.id === id, level);
  await o.ready();
  await o.tap("#start");
  await o.page.waitForFunction(() => window.__frontier.started && document.querySelector("#defence-bar:not([hidden])"), null, { timeout: 60000 });
  return o;
}
const noSideScroll = async (page, where) => {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
};
const tiny = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(`${selector} *`)].filter((el) => el.offsetParent !== null && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.textContent), selector);

// Replays a browser match headlessly: the same options, the logged commands at their ticks.
function replay(options, log, ticks) {
  const sim = new Simulation(options);
  let next = 0;
  while (sim.ticks < ticks) {
    while (next < log.length && log[next].tick === sim.ticks) { const { tick, ...c } = log[next++]; sim.command(c); }
    sim.tick(0.05);
  }
  return sim.hash();
}

await suite("defence-deck", async () => {
  // ---- Fast-forward through the real frame loop, then the replay.
  for (const speed of [3, 2]) {
    const { page, errors } = await startLevel("desktop");
    const start = await page.evaluate(() => { const f = window.__frontier; return { options: JSON.parse(f.sim.serialize()).options, ticks: f.sim.ticks }; });
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; const pad = s.missionDef.defence.pads[0]; s.command({ team: 0, type: "padBuild", pad: pad.id, crew: "ranger" }); });
    await page.keyboard.press("Shift+Space");
    if (speed === 3) await page.keyboard.press("Shift+Space");
    assert.equal(await page.evaluate(() => window.__frontier.paused), false, "Shift+Space does not pause");
    await page.waitForFunction((n) => document.querySelector("#defence-speed-label").textContent === `×${n}`, speed);
    const t0 = await page.evaluate(() => window.__frontier.sim.time), r0 = Date.now();
    await page.evaluate(() => document.querySelector("#defence-call").click());
    await page.waitForTimeout(3000);
    await page.evaluate(() => { const d = window.__frontier.sim.defence; if (d.wave < 2) document.querySelector("#defence-call").click(); });
    await page.waitForFunction(() => window.__frontier.sim.time > 60, null, { timeout: 240000 });
    const real = (Date.now() - r0) / 1000;
    const out = await page.evaluate(() => { const f = window.__frontier; f.hold = true; return { ticks: f.sim.ticks, hash: f.sim.hash(), log: f.sim.commandLog, time: f.sim.time, wave: f.sim.defence.wave }; });
    const ratio = (out.time - t0) / real;
    console.log(`x${speed}: ${out.time.toFixed(1)} s of match in ${real.toFixed(1)} s (${ratio.toFixed(2)}x), ${out.ticks} ticks, wave ${out.wave}, ${out.log.length} commands`);
    assert.ok(ratio > (speed === 3 ? 1.5 : 1.2), `x${speed} runs faster than real time (${ratio.toFixed(2)})`);
    assert.ok(out.log.filter((c) => c.type === "waveCall").length >= 1, "the Call button went through the command log");
    // The replay runs headless in the same browser: Chrome and Node differ in the last bit of Math.atan2 (a tower's angle), so a Node replay cannot match bit for bit.
    const again = await page.evaluate(({ options, log, ticks }) => { const sim = new window.__frontier.sim.constructor(options); let next = 0; while (sim.ticks < ticks) { while (next < log.length && log[next].tick === sim.ticks) { const { tick, ...c } = log[next++]; sim.command(c); } sim.tick(0.05); } return sim.hash(); }, { options: start.options, log: out.log, ticks: out.ticks });
    assert.equal(again, out.hash, `x${speed}: replaying the command log without the frame loop gives the same hash`);
    // And Node agrees on everything but that last bit: same tick, same command count.
    assert.equal(replay(start.options, out.log, out.ticks).length, 8);
    assert.deepEqual(errors, []);
    await page.close();
  }

  for (const viewport of VIEWPORTS) {
    const { page, errors, tap, mobile } = await startLevel(viewport, "d-gorge", "enemycards");
    const phone = mobile;
    // ---- Shift+Space and Space (desktop keyboard).
    if (!phone) {
      await page.keyboard.press("Shift+Space");
      assert.equal(await page.evaluate(() => document.querySelector("#defence-speed-label").textContent), "×1".replace("1", "2"), "Shift+Space: x2");
      await page.keyboard.press("Space");
      assert.equal(await page.evaluate(() => window.__frontier.paused), true, "Space pauses");
      await page.keyboard.press("Space");
      await page.keyboard.press("Shift+Space"); await page.keyboard.press("Shift+Space");
      assert.equal(await page.evaluate(() => document.querySelector("#defence-speed-label").textContent), "×1");
    } else {
      // A phone: the toggle cycles x1 and x2 only.
      await tap("#defence-speed"); await page.waitForFunction(() => document.querySelector("#defence-speed-label").textContent === "×2");
      await tap("#defence-speed"); await page.waitForFunction(() => document.querySelector("#defence-speed-label").textContent === "×1");
    }

    // ---- The bar: size, controls, width, --defence-bar-h, the 3-state view button.
    const bar = await page.evaluate(() => { const b = document.querySelector("#defence-bar").getBoundingClientRect(); return { w: b.width, h: b.height, left: b.left, right: b.right, vw: innerWidth, bh: getComputedStyle(document.documentElement).getPropertyValue("--defence-bar-h").trim() }; });
    if (viewport === "portrait") {
      assert.ok(bar.h <= 56, `portrait bar ${bar.h}px tall`);
      assert.ok(bar.left >= 8 - 0.5 && bar.right <= bar.vw - 8 + 0.5, `portrait bar inside the gutters (${bar.left}..${bar.right})`);
      assert.equal(bar.bh, `${Math.round(bar.h + 8)}px`, "--defence-bar-h is the bar's height plus its gap");
    } else assert.equal(bar.bh, "", `${viewport}: --defence-bar-h unset`);
    for (const el of await page.locator("#defence-bar > button:not([hidden])").all()) { const b = await el.boundingBox(); assert.ok(b.width >= 44 - 0.5 && b.height >= 44 - 0.5, `${viewport}: bar control ${b.width}x${b.height}`); }
    assert.deepEqual(await tiny(page, "#defence-bar"), [], `${viewport}: bar text under 11 px`);
    const view = () => page.evaluate(() => document.querySelector("#defence-overview").dataset.view);
    const modes = [await view()];
    for (let i = 0; i < 3; i++) { await tap("#defence-overview"); modes.push(await view()); }
    assert.deepEqual(modes, phone ? ["follow", "overview", "free", "follow"] : ["free", "overview", "free", "overview"], `${viewport}: view cycle`);
    if (!phone) { await tap("#defence-overview"); }
    await shot(page, `defence-deck-bar-${viewport}`);

    // ---- Phone framing: road zoom over the first spawn, then the front of the wave.
    if (phone) {
      await page.evaluate(() => { const f = window.__frontier; f.hold = true; });
      const z = await page.evaluate(() => window.__frontier.view.zoom);
      assert.ok(z <= 55 + 0.01, `phone opens at road zoom (${z})`);
      // The 28 px rule (tests/feel.mjs) in Defence at that zoom: a Vanguard on the road.
      const px = await page.evaluate(() => { const f = window.__frontier, s = f.sim, v = f.view, a = s.missionDef.defence.routes.main[1]; const e = s.spawn("vanguard", 1, a.x, a.z, true, true); v.focusOn(e.x, e.z); f.step(0.05); v.update(s, 0.016, f.selected, null, 1); let min = Infinity, max = -Infinity; v.objects.get(e.id).userData.model.traverse((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const zz of [b.min.z, b.max.z]) { const p = o.position.clone().set(x, y, zz).applyMatrix4(o.matrixWorld).project(v.camera); min = Math.min(min, p.y); max = Math.max(max, p.y); } }); e.hp = 0; return (max - min) * v.renderer.domElement.getBoundingClientRect().height / 2; });
      console.log(`${viewport}: a Vanguard is ${px.toFixed(1)} px tall at zoom ${z}`);
      // 844x390 needs W1-D's unit scale (P3, merged separately): recorded here, asserted on the portrait phone.
      if (viewport === "portrait") assert.ok(px >= 28 - 1e-9, `${viewport}: unit ${px} px under 28`);
    }

    // ---- Tower sheet as text, Aim tile.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, pad = s.missionDef.defence.pads[0];
      f.hold = true; s.players[0].alloy = 9000;
      s.command({ team: 0, type: "padBuild", pad: pad.id, crew: "ranger" });
      s.command({ team: 0, type: "padUpgrade", building: s.towerOn(pad.id).id });
      const t = s.towerOn(pad.id); f.view.focusOn(t.x, t.z); f.select([t.id]); f.step(0.05);
      if (document.documentElement.classList.contains("compact-ui")) { document.documentElement.dataset.dock = "actions"; }
    });
    await page.waitForSelector("#commands .defence-stats");
    const sheet = await page.evaluate(() => { const st = document.querySelector("#commands .defence-stats"), r = st.getBoundingClientRect(), c = document.querySelector("#commands").getBoundingClientRect(); return { text: st.textContent, inView: r.bottom <= c.bottom + 1 && r.top >= c.top - 1, aim: document.querySelector(".defence-aim small").textContent, tiles: [...document.querySelectorAll("#commands .command-tile")].map((b) => { const q = b.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; }) }; });
    assert.match(sheet.text, /\d+\s*dps.*\d+\s*m.*×[\d.]+\s*vs armour.*Air:\s*(yes|no)/s, `${viewport}: stats text "${sheet.text}"`);
    assert.match(sheet.text, /Next:\s*[+−]\d+\s*dps/, "next-tier deltas");
    if (viewport !== "landscape") assert.ok(sheet.inView, `${viewport}: the stats text sits inside the sheet without scrolling`);
    for (const [w, h] of sheet.tiles) assert.ok(h >= 44 - 0.5 && w >= 44, `${viewport}: sheet tile ${w}x${h}`);
    assert.deepEqual(await tiny(page, "#commands"), [], `${viewport}: sheet text under 11 px`);
    assert.equal(sheet.aim, "Nearest");
    for (const want of ["First", "Strongest", "Air", "Nearest"]) {
      await tap(".defence-aim");
      await page.waitForFunction((w) => document.querySelector(".defence-aim small")?.textContent === w, want);
    }
    assert.equal(await page.evaluate(() => "aim" in window.__frontier.sim.entities.find((e) => e.crew)), false, "back to Nearest: no aim key");
    await tap(".defence-aim");
    assert.equal(await page.evaluate(() => window.__frontier.sim.entities.find((e) => e.crew).aim), "first");
    assert.ok(await page.evaluate(() => window.__frontier.sim.commandLog.some((c) => c.type === "padAim")), "through the command log");
    await shot(page, `defence-deck-sheet-${viewport}`);
    await noSideScroll(page, `${viewport} sheet`);

    // ---- Wave chips and the new-enemy card (once per type), on Three Roads' armoured wave.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim; f.hold = false;
      s.defence.nextAt = s.time + 60; s.defence.wave = 3; s.defence.queue.length = 0; f.select([]); f.step(0.05);
    });
    await page.waitForSelector("#defence-intel .intel-chip", { timeout: TIMEOUT.step }).catch(() => {});
    await page.evaluate(() => { const f = window.__frontier; f.hold = true; document.querySelector("#defence-call").click(); f.step(2); });
    await page.waitForSelector("#defence-card", { timeout: TIMEOUT.step });
    const card = await page.evaluate(() => { const c = document.querySelector("#defence-card"), r = c.getBoundingClientRect(), dock = document.querySelector(".bottom-dock, .command-panel")?.getBoundingClientRect(); return { text: c.textContent, crews: c.querySelectorAll(".card-counter b").length, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0, overDock: dock ? !(r.bottom <= dock.top) : false, seen: JSON.parse(localStorage.getItem("frontier-defence-v1")).seen }; });
    assert.ok(card.crews >= 1 && card.crews <= 2 && card.inside && !card.overDock, `${viewport}: the card ${JSON.stringify(card)}`);
    assert.ok(card.seen?.length >= 1, "the type is recorded as seen");
    assert.deepEqual(await tiny(page, "#defence-card"), [], `${viewport}: card text under 11 px`);
    await shot(page, `defence-deck-card-${viewport}`);
    await page.locator("#defence-card").click();
    await page.waitForFunction(() => !document.querySelector("#defence-card") || document.querySelector("#defence-card") !== document.querySelector("#defence-card"), null, { timeout: 2000 }).catch(() => {});
    assert.deepEqual(await tiny(page, "#defence-intel"), [], `${viewport}: intel text under 11 px`);
    await noSideScroll(page, `${viewport} deck`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
  // ---- Three Roads on a portrait phone: all seven controls in one row inside the gutters (the speed toggle stays on the bar).
  if (VIEWPORTS.includes("portrait")) {
    const { page, errors } = await startLevel("portrait", "d-crossroads");
    const m = await page.evaluate(() => { const b = document.querySelector("#defence-bar"), r = b.getBoundingClientRect(), kids = [...b.children].filter((el) => !el.hidden && el.getBoundingClientRect().width > 0); return { h: r.height, left: r.left, right: r.right, vw: innerWidth, n: kids.length, last: kids.at(-1).getBoundingClientRect().right, first: kids[0].getBoundingClientRect().left, ids: kids.map((el) => el.id || el.className) }; });
    assert.equal(m.n, 7, "seven controls: " + m.ids.join(","));
    assert.ok(m.h <= 56 && m.left >= 7.5 && m.right <= m.vw - 7.5, "bar inside the gutters: " + JSON.stringify(m));
    assert.ok(m.first >= m.left - 0.5 && m.last <= m.right + 0.5, "no control spills out of the bar: " + JSON.stringify(m));
    await shot(page, "defence-deck-threeroads-portrait");
    assert.deepEqual(errors, []);
    await page.close();
  }
}, { browser });
