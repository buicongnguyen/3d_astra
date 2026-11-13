// Frontier Defence in the browser (0.17, completed in 0.21) at 1440x900, 390x844 and 844x390:
// the fourth mode button (44 px), six levels with stars and locks, the perks sheet, the Endless
// and Daily entries (and a Daily match to its score), tapping a pad to crew it, upgrading to the
// tier trims, a tier-3 branch choice, the commander moved and casting Barrage, Call wave, a
// mid-wave field, the result screen with stars and Next level, a bridge blown with its fuse, the
// reroute and a pontoon going up, no embers under motion-off, no sideways scroll, no page errors.
// At 1440x900 and 390x844 every level is also shown mid-wave.
// Screenshots: test-results/defence-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.DEFENCE_VIEWPORTS || "desktop,portrait,landscape").split(",");
// The six-level tour runs on these viewports (the screenshots the release review asks for).
const TOUR = (process.env.DEFENCE_TOUR || "desktop,portrait").split(",");
const LEVEL_IDS = ["d-gorge", "d-bridges", "d-switchback", "d-fordwood", "d-canyon", "d-longcrossing"];

// Fails when anything on the page reaches past the right edge of the screen.
async function noSideScroll(page, where) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
}
async function size(locator) {
  // A slow runner can measure while the menu re-renders; wait for the element to be drawn first.
  await locator.waitFor({ state: "visible", timeout: TIMEOUT.step }).catch(() => {});
  const box = await locator.boundingBox();
  assert.ok(box, `visible: ${await locator.evaluate((el) => el.outerHTML.slice(0, 120)).catch(() => "?")}`);
  return box;
}
async function bigEnough(locator, where) {
  for (const b of await locator.all()) { const box = await size(b); assert.ok(box.height >= 44 && box.width >= 44, `${where}: ${box.width}x${box.height}`); }
}
// Text under 12 px inside a container.
async function tinyText(page, selector) {
  return page.evaluate((selector) => [...document.querySelectorAll(`${selector} *`)].filter((el) => el.offsetParent !== null && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12).map((el) => el.textContent), selector);
}
// A free pad on screen and not under the interface, in client pixels.
async function freePad(page, avoid = []) {
  return page.evaluate((avoid) => {
    const f = window.__frontier, s = f.sim, canvas = f.view.renderer.domElement, r = canvas.getBoundingClientRect();
    for (const p of s.missionDef.defence.pads) {
      if (s.towerOn(p.id) || avoid.includes(p.id)) continue;
      const q = f.view.project(p.x, p.z, f.view.terrain.heightAt(p.x, p.z) + 0.2), x = q.x + r.left, y = q.y + r.top;
      if (x < r.left + 30 || x > r.right - 30 || y < r.top + 30 || y > r.bottom - 30) continue;
      if (document.elementFromPoint(x, y) !== canvas) continue;
      // No other pad within the pick radius: the tap must mean this one.
      if (s.missionDef.defence.pads.some((o) => o !== p && (() => { const w = f.view.project(o.x, o.z, 0.2); return Math.hypot(w.x + r.left - x, w.y + r.top - y) < 30; })())) continue;
      return { id: p.id, x, y };
    }
    return null;
  }, avoid);
}
// A point on the battlefield in client pixels, on the canvas and away from every pad and bridge.
async function openGround(page, near) {
  return page.evaluate((near) => {
    const f = window.__frontier, s = f.sim, canvas = f.view.renderer.domElement, r = canvas.getBoundingClientRect();
    const route = Object.values(s.missionDef.defence.routes)[0];
    const candidates = near ? [near] : route.slice(2, -1);
    const offsets = [[0, 0]];
    for (const r of [1.5, 3, 5, 7]) for (let k = 0; k < 8; k++) offsets.push([Math.cos(k * Math.PI / 4) * r, Math.sin(k * Math.PI / 4) * r]);
    for (const at of candidates) for (const [dx, dz] of offsets) {
      const p = { x: at.x + dx, z: at.z + dz };
      if (!s.nav.canStand(p.x, p.z, 1.2) || Object.values(s.missionDef.defence.routes).some((pts) => Math.hypot(pts[0].x - p.x, pts[0].z - p.z) < 11)) continue;
      const q = f.view.project(p.x, p.z, f.view.terrain.heightAt(p.x, p.z)), x = q.x + r.left, y = q.y + r.top;
      if (x < r.left + 40 || x > r.right - 40 || y < r.top + 40 || y > r.bottom - 40 || document.elementFromPoint(x, y) !== canvas) continue;
      if (s.missionDef.defence.pads.some((o) => { const w = f.view.project(o.x, o.z, 0.2); return Math.hypot(w.x + r.left - x, w.y + r.top - y) < 40; })) continue;
      if (f.view.pick(x, y, s, 24)) continue;
      return { x, y, wx: p.x, wz: p.z };
    }
    return null;
  }, near || null);
}
async function tapAt(page, mobile, x, y) {
  if (mobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}
// Towers on ten pads at all three tiers (every crew), then the level's last wave, stepped until it is on the road.
async function stageWave(page, seconds) {
  await page.evaluate((seconds) => {
    const f = window.__frontier, s = f.sim, def = s.missionDef.defence;
    s.players[0].alloy = 9000;
    def.pads.filter((p) => !s.towerOn(p.id)).slice(0, 10).forEach((p, i) => {
      s.command({ team: 0, type: "padBuild", pad: p.id, crew: def.crews[i % def.crews.length] });
      for (let k = 0; k < i % 3; k++) s.command({ team: 0, type: "padUpgrade", building: s.towerOn(p.id).id });
    });
    // The level's last wave, straight away (a test shortcut through the rules' own wave start).
    s.defence.queue.length = 0;
    s.defence.wave = def.waves.length - 1;
    s.startWave();
    f.step(seconds);
    f.select([]);
  }, seconds);
}
async function startPicked(page, tap) {
  await page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector("#start").disabled, null, { timeout: 90000 });
  await tap("#start");
  await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.defence && document.querySelector("#defence-bar:not([hidden])"), null, { timeout: 60000 });
}

await suite("defence", async () => {
  for (const viewport of VIEWPORTS) {
    const { page, errors, tap, goto, ready, mobile } = await openPage(browser, viewport);
    // A returning player: three stars on Gorge Road and two on Twin Bridges (five to spend).
    await page.addInitScript(() => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("frontier-defence-v1", JSON.stringify({ levels: { "d-gorge": { stars: 3, lives: 18, difficulty: "standard" }, "d-bridges": { stars: 2, lives: 14, difficulty: "standard" } } })); sessionStorage.setItem("seeded", "1"); } } catch {} });
    await goto();
    await ready();

    // Title: four modes, each a 44 px target.
    const modes = page.locator(".mode-switch [data-mode]");
    assert.equal(await modes.count(), 4);
    await bigEnough(modes, `${viewport} mode button`);
    await shot(page, `defence-title-${viewport}`);
    await noSideScroll(page, `${viewport} title`);

    // Six levels with stars; the third opens with a star on the second, the rest stay locked.
    await tap('[data-mode="defence"]');
    await page.waitForSelector("#defence-setup .defence-levels");
    assert.equal(await page.locator("#defence-setup [data-level]").count(), 6);
    assert.equal(await page.locator('[data-level-id="d-gorge"] .stars i.on').count(), 3);
    assert.equal(await page.locator('[data-level-id="d-bridges"] .stars i.on').count(), 2);
    assert.deepEqual(await page.locator("#defence-setup [data-level]").evaluateAll((bs) => bs.map((b) => b.disabled)), [false, false, false, true, true, true]);
    assert.equal(await page.locator('[data-level-id="d-fordwood"] .icon').count(), 1, "a lock on a closed level");
    for (const b of await page.locator("#defence-setup [data-level]").all()) assert.ok((await size(b)).height >= 44);
    assert.match(await page.locator("#start").textContent(), /Start defence/);
    await page.locator("#defence-setup").scrollIntoViewIfNeeded();
    await shot(page, `defence-levels-${viewport}`);
    await noSideScroll(page, `${viewport} levels`);
    assert.deepEqual(await tinyText(page, "#defence-setup"), [], `${viewport}: menu text under 12 px`);

    // The perks sheet: five stars to spend, buy the Quartermaster (3), the others then cost too much.
    await tap("#defence-perks-toggle");
    await page.waitForSelector("#defence-perks:not([hidden])");
    await bigEnough(page.locator("#defence-perks [data-buy-perk]"), `${viewport} perk button`);
    assert.equal(await page.locator("#defence-perks-toggle b").textContent(), "5");
    await tap('[data-buy-perk="quartermaster"]');
    await page.waitForSelector('#defence-perks li.owned[data-perk="quartermaster"]');
    assert.equal(await page.locator("#defence-perks-toggle b").textContent(), "2");
    assert.ok(await page.locator('[data-buy-perk="gunnery"]').isDisabled() && await page.locator('[data-buy-perk="reserves"]').isDisabled());
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("frontier-defence-v1")).perks), ["quartermaster"]);
    await page.evaluate(() => document.querySelector('#defence-perks [data-perk="gunnery"]').scrollIntoView({ block: "center" }));
    await shot(page, `defence-perks-${viewport}`);
    await noSideScroll(page, `${viewport} perks`);
    assert.deepEqual(await tinyText(page, "#defence-perks"), [], `${viewport}: perks text under 12 px`);
    await tap("#defence-perks-toggle");

    // Endless and Daily entries: best scores on the rows, their own Start label; then a Daily match to its score.
    await bigEnough(page.locator("[data-defence-variant]"), `${viewport} variant button`);
    await tap('[data-defence-variant="endless"]');
    await page.waitForSelector('[data-defence-variant="endless"][aria-pressed="true"]');
    await page.waitForFunction(() => /Start endless/.test(document.querySelector("#start").textContent));
    assert.equal(await page.locator("#defence-setup .defence-best").count(), 3, "best scores on the open levels");
    await page.locator("#defence-setup").scrollIntoViewIfNeeded();
    await shot(page, `defence-endless-entry-${viewport}`);
    await tap('[data-defence-variant="daily"]');
    await page.waitForFunction(() => /Start daily/.test(document.querySelector("#start").textContent));
    assert.equal(await page.evaluate(() => window.__frontier.sim.missionDef.variant), "daily");
    await shot(page, `defence-daily-entry-${viewport}`);
    await noSideScroll(page, `${viewport} daily`);
    await startPicked(page, tap);
    assert.ok(await page.evaluate(() => !!window.__frontier.sim.missionDef.defence.endless && window.__frontier.sim.waveTotal() === Infinity));
    await page.evaluate(() => { const s = window.__frontier.sim; s.defence.wave = 12; s.defence.cleared = 12; window.__frontier.step(0.1); });
    await page.waitForFunction(() => document.querySelector("#defence-wave").textContent === "12");
    await page.evaluate(() => { window.__frontier.sim.defence.lives = 0; });
    await page.waitForSelector('#modal:not([hidden]) .defence-score[data-variant="daily"]', { timeout: 15000 });
    assert.equal(await page.locator(".defence-score").getAttribute("data-score"), "12");
    assert.equal(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("frontier-defence-v1")).daily)[0]["d-gorge"]), 12);
    await bigEnough(page.locator(".defence-score .debrief-actions button"), `${viewport} score button`);
    await shot(page, `defence-daily-score-${viewport}`);
    await tap(".defence-score [data-new-game]");
    await page.waitForSelector("#defence-setup .defence-levels");
    await tap('[data-defence-variant="levels"]');
    await page.waitForFunction(() => /Start defence/.test(document.querySelector("#start").textContent));
    await page.waitForFunction(() => !window.__frontier.sim.missionDef.variant);

    // Gorge Road.
    await startPicked(page, tap);
    assert.equal(await page.evaluate(() => window.__frontier.sim.missionDef.id), "d-gorge");
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains("in-defence")));
    for (const id of ["#defence-call", "#defence-overview", "#defence-hero"]) { const b = await size(page.locator(id)); assert.ok(b.height >= 44 && b.width >= 44, `${viewport}: ${id} ${b.width}x${b.height}`); }
    assert.deepEqual(await tinyText(page, "#defence-bar"), [], `${viewport}: defence bar text under 12 px`);
    // Nothing floats over the bar's buttons (the idle-army shortcut gives way to the commander button).
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#defence-bar > button:not([hidden])")].filter((el) => { const b = el.getBoundingClientRect(); return !el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)); }).map((el) => el.id)), [], `${viewport}: covered bar buttons`);
    assert.deepEqual(await page.evaluate(() => window.__frontier.sim.missionDef.defence.perks), ["quartermaster"], "perks ride on a Defence menu level");

    // Tap a pad: six crew tiles; pick Rangers (a fifth off: the Quartermaster): a crewed tower stands on it.
    await page.evaluate(() => { window.__frontier.sim.players[0].alloy = 2000; });
    const pad = await freePad(page);
    assert.ok(pad, `${viewport}: a free pad on screen`);
    await tapAt(page, mobile, pad.x, pad.y);
    await page.waitForFunction(() => document.querySelectorAll("#commands [data-defence-crew]").length === 6, null, { timeout: TIMEOUT.step });
    await bigEnough(page.locator("#commands [data-defence-crew]"), `${viewport} crew tile`);
    await shot(page, `defence-pad-${viewport}`);
    await tap('#commands [data-defence-crew="ranger"]');
    await page.waitForFunction((id) => window.__frontier.sim.towerOn(id)?.crew === "ranger", pad.id, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate((id) => window.__frontier.sim.towerOn(id).spent, pad.id), 56, "70 alloy less a fifth");
    await page.waitForSelector('#commands[data-tier="1"] [data-defence-act="upgrade"]');

    // Upgrade twice: steel, then gold with the heat glow.
    await tap('#commands [data-defence-act="upgrade"]');
    await page.waitForSelector('#commands[data-tier="2"]');
    await tap('#commands [data-defence-act="upgrade"]');
    await page.waitForSelector('#commands[data-tier="3"] .defence-info[data-tier="3"]');
    assert.equal(await page.evaluate((id) => window.__frontier.sim.towerOn(id).tier, pad.id), 3);
    assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('#commands .defence-info[data-tier="3"]'), "::after").content !== "none"), "tier 3 heat glow");
    // The crew stands on the tower, adopted into the batches (no draws of its own).
    await page.waitForFunction((id) => { const f = window.__frontier, o = f.view.objects.get(f.sim.towerOn(id).id); return !!o?.userData.crew && o.userData.dressed === 3; }, pad.id, { timeout: TIMEOUT.step });
    await shot(page, `defence-tower-${viewport}`);

    // Tier 3: the two-choice branch sheet, gold, then Marksman shown on the tile.
    await page.waitForFunction(() => document.querySelectorAll("#commands [data-defence-branch]").length === 2);
    await bigEnough(page.locator("#commands [data-defence-branch]"), `${viewport} branch tile`);
    assert.deepEqual(await page.locator("#commands [data-defence-branch]").evaluateAll((bs) => bs.map((b) => b.dataset.tier)), ["3", "3"]);
    await shot(page, `defence-branch-${viewport}`);
    await tap('#commands [data-defence-branch="marksman"]');
    await page.waitForFunction((id) => window.__frontier.sim.towerOn(id)?.branch === "marksman", pad.id, { timeout: TIMEOUT.step });
    await page.waitForSelector('#commands .defence-info[data-branch="marksman"]');
    await page.waitForFunction((id) => { const f = window.__frontier; return f.view.objects.get(f.sim.towerOn(id).id)?.userData.dressed === "3marksman"; }, pad.id, { timeout: TIMEOUT.step });

    // Motion off: an upgrade becoming affordable throws no embers.
    const second = await freePad(page, [pad.id]);
    await page.evaluate(() => document.documentElement.classList.add("motion-off"));
    await page.evaluate((id) => { const s = window.__frontier.sim; s.players[0].alloy = 2000; s.command({ team: 0, type: "padBuild", pad: id, crew: "breaker" }); s.players[0].alloy = 0; window.__frontier.select([s.towerOn(id).id]); }, second.id);
    await page.waitForSelector('#commands[data-tier="1"] [data-defence-act="upgrade"]:disabled', { state: "attached" });
    await page.evaluate(() => { window.__frontier.sim.players[0].alloy = 2000; window.__frontier.step(0.05); });
    await page.waitForSelector('#commands [data-defence-act="upgrade"]:not(:disabled)', { state: "attached" });
    await page.waitForTimeout(200);
    assert.equal(await page.locator(".ember, .ember-burst").count(), 0, `${viewport}: embers under motion-off`);
    await page.evaluate(() => document.documentElement.classList.remove("motion-off"));

    // The commander: picked from the bar, sent down the road by a tap, then Barrage on a spot in reach.
    await page.evaluate(() => window.__frontier.select([]));
    await tap("#defence-hero");
    await page.waitForFunction(() => { const f = window.__frontier, h = f.sim.commander(); return h && f.selected.has(h.id) && document.querySelector('#commands [data-defence-hero="barrage"]'); });
    await bigEnough(page.locator("#commands [data-defence-hero]"), `${viewport} commander tile`);
    const post = await page.evaluate(() => { const r = window.__frontier.sim.missionDef.defence.routes.main; return { x: (r[6].x + r[7].x) / 2, z: (r[6].z + r[7].z) / 2 }; });
    await page.evaluate((p) => window.__frontier.view.focusOn(p.x, p.z), post);
    await page.waitForTimeout(150);
    const ground = await openGround(page, post);
    assert.ok(ground, `${viewport}: open ground on screen`);
    await tapAt(page, mobile, ground.x, ground.y);
    await page.waitForFunction(() => window.__frontier.sim.commander()?.orders[0]?.type === "move", null, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.step(14));
    assert.ok(await page.evaluate((g) => { const h = window.__frontier.sim.commander(); return Math.hypot(h.x - g.wx, h.z - g.wz) < 2.5; }, ground), `${viewport}: the commander walked there`);
    await tap('#commands [data-defence-hero="barrage"]');
    await page.waitForSelector('#commands [data-defence-hero="barrage"][aria-pressed="true"]');
    const hero = await page.evaluate(() => { const h = window.__frontier.sim.commander(); window.__frontier.view.focusOn(h.x, h.z); return { x: h.x, z: h.z }; });
    await page.waitForTimeout(150);
    const spot = await openGround(page, { x: hero.x + 4, z: hero.z + 3 });
    assert.ok(spot, `${viewport}: a spot to shell`);
    await tapAt(page, mobile, spot.x, spot.y);
    await page.waitForFunction(() => window.__frontier.sim.strikes?.length > 0 && window.__frontier.sim.commanderCooldown("barrage") > 0, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(250);
    await shot(page, `defence-commander-barrage-${viewport}`);

    // Call wave: the first wave comes now, for a bonus.
    // On a slow runner the 30 s countdown can run out during the steps above (the commander walk alone
    // steps 14 s) and wave 1 then starts by itself: give the countdown time again and count from the
    // wave in play, so the call is always early and pays its bonus.
    const before = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, d = s.defence;
      s.players[0].alloy = 0; f.select([]);
      // Back to "before wave 1" if it started by itself: no column on the road, the countdown running.
      if (d.wave > 0) { d.wave = 0; d.active = false; d.queue.length = 0; for (const e of s.entities) if (e.team === 1 && e.kind === "unit") e.hp = 0; }
      d.nextAt = s.time + 25;
      return d.wave;
    });
    await page.evaluate(() => window.__frontier.step(0.05)); // the cleared column leaves the field
    await page.waitForFunction(() => !document.querySelector("#defence-call").disabled);
    await tap("#defence-call");
    await page.waitForFunction((n) => window.__frontier.sim.defence.wave === n + 1 && window.__frontier.sim.players[0].alloy > 0, before, { timeout: TIMEOUT.step });

    // Mid-wave on Gorge Road with towers of all three tiers.
    await stageWave(page, 13);
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => window.__frontier.sim.entities.filter((e) => e.team === 1 && e.hp > 0).length > 0), `${viewport}: enemies on the road`);
    await shot(page, `defence-gorge-wave-${viewport}`);
    await noSideScroll(page, `${viewport} gorge`);

    // Hold the last wave: the result with stars, Next level, Retry and Levels.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, d = s.defence;
      d.wave = s.missionDef.defence.waves.length; d.queue.length = 0; d.lives = 19;
      for (const e of s.entities) if (e.team === 1) e.hp = 0;
    });
    // The frame loop runs the next tick, settles the match and opens the result.
    await page.waitForSelector("#modal:not([hidden]) .defence-result", { timeout: 15000 });
    assert.equal(await page.locator(".defence-result").getAttribute("data-stars"), "3");
    assert.equal(await page.locator(".defence-stars i.on").count(), 3);
    for (const b of await page.locator(".defence-result .debrief-actions button").all()) assert.ok((await size(b)).height >= 44);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("frontier-defence-v1")).levels["d-gorge"].stars), 3);
    await page.waitForTimeout(900); // the stars pop in one after another
    await shot(page, `defence-result-${viewport}`);
    await noSideScroll(page, `${viewport} result`);

    // Next level: Twin Bridges. Tap the west bridge, blow it: a fuse, then water, the column turns to the ford.
    await tap("[data-defence-next]");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.missionDef?.id === "d-bridges" && document.querySelector("#defence-bar:not([hidden])"), null, { timeout: 60000 });
    const bridge = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, canvas = f.view.renderer.domElement, r = canvas.getBoundingClientRect();
      // The match clock stands still until the bridge has blown (time moves with step() only): on a slow
      // runner the column would otherwise walk over the bridge before the charge goes off.
      f.hold = true;
      s.players[0].alloy = 500;
      // A column on the west road, still north of the river.
      const e = s.spawn(s.typeFor(1, "vanguard"), 1, -21, -22, true, true);
      e.orders = [{ type: "route", route: "west", leg: 3 }];
      f.view.focusOn(-22, 0);
      const q = f.view.project(-22, 0, 0.4);
      return { x: q.x + r.left, y: q.y + r.top, id: e.id };
    });
    await page.waitForTimeout(150);
    const bridgeAt = await page.evaluate(() => { const f = window.__frontier, r = f.view.renderer.domElement.getBoundingClientRect(), q = f.view.project(-22, 0, 0.4); return { x: q.x + r.left, y: q.y + r.top }; });
    await tapAt(page, mobile, bridgeAt.x, bridgeAt.y);
    await page.waitForSelector('#commands [data-defence-act="demolish"][data-crossing="-22"]:not(:disabled)', { timeout: TIMEOUT.step });
    await bigEnough(page.locator('#commands [data-defence-act="demolish"]'), `${viewport} demolish tile`);
    await tap('#commands [data-defence-act="demolish"]');
    await page.waitForFunction(() => window.__frontier.sim.crossings?.[-22]?.state === "fuse", null, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.step(1));
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => window.__frontier.view.scene.getObjectByName("defence-fuse")?.visible), `${viewport}: the fuse light`);
    await shot(page, `defence-fuse-${viewport}`);
    await page.evaluate(() => window.__frontier.step(2.2));
    await page.waitForFunction(() => window.__frontier.sim.crossings[-22].state === "blown" && !window.__frontier.view.environment.bridges.get(-22).visible, null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate((id) => window.__frontier.sim.get(id)?.orders[0].route, bridge.id), "ford", `${viewport}: the column turned to the ford`);
    await page.evaluate(() => { window.__frontier.hold = false; });
    // Bridge builders on the west road: they stop at the bank and the pontoon goes up.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      for (const [x, z] of [[-21, -9], [-23, -10]]) { const e = s.spawn(s.typeFor(1, "vanguard"), 1, x, z, true, true); e.bridger = true; e.orders = [{ type: "route", route: "west", leg: 4 }]; e.hp = e.maxHp = 1e5; }
      f.step(12);
    });
    await page.waitForFunction(() => window.__frontier.sim.crossings[-22].progress > 3 && window.__frontier.view.scene.getObjectByName("defence-pontoon")?.visible, null, { timeout: 8000 });
    await page.evaluate(() => window.__frontier.view.focusOn(-22, -2));
    await page.waitForTimeout(300);
    await shot(page, `defence-pontoon-${viewport}`);
    // A save taken now loads with the bridge still down (snapshot.restore re-applies the crossings).
    assert.ok(await page.evaluate(() => { const s = window.__frontier.sim, L = s.constructor.load(s.serialize()); return L.hash() === s.hash() && L.terrain.at(-22, 0) === "water"; }));

    // Twin Bridges mid-wave.
    await page.evaluate(() => { const s = window.__frontier.sim; for (const e of s.entities) if (e.team === 1) e.hp = 0; window.__frontier.step(0.05); });
    await stageWave(page, 9);
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => window.__frontier.sim.entities.filter((e) => e.team === 1 && e.hp > 0).length > 0), `${viewport}: enemies at the bridges`);
    await shot(page, `defence-bridges-wave-${viewport}`);
    await noSideScroll(page, `${viewport} bridges`);

    // The six levels mid-wave (all open now through the test's progress).
    if (TOUR.includes(viewport)) {
      await page.evaluate((ids) => localStorage.setItem("frontier-defence-v1", JSON.stringify({ levels: Object.fromEntries(ids.map((id) => [id, { stars: 1, lives: 5, difficulty: "standard" }])) })), LEVEL_IDS);
      for (const id of LEVEL_IDS.slice(2)) {
        await page.evaluate(() => { window.__frontier.sim.defence.lives = 0; });
        await page.waitForSelector("#modal:not([hidden]) .defence-result [data-new-game]", { timeout: 15000 });
        await page.evaluate(() => document.querySelector("#modal:not([hidden]) .defence-result [data-new-game]").click());
        await page.waitForSelector("#defence-setup .defence-levels", { timeout: 30000 });
        await tap(`[data-level-id="${id}"]`);
        await page.waitForFunction((id) => window.__frontier.sim.missionDef?.id === id, id);
        await startPicked(page, tap);
        await stageWave(page, id === "d-switchback" ? 16 : 11);
        await page.waitForTimeout(500);
        assert.ok(await page.evaluate(() => window.__frontier.sim.entities.filter((e) => e.team === 1 && e.hp > 0).length > 0), `${viewport} ${id}: enemies on the road`);
        await shot(page, `defence-${id.slice(2)}-wave-${viewport}`);
        await noSideScroll(page, `${viewport} ${id}`);
      }
    }

    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
