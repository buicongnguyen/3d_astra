// Frontier Defence 0.23 in the browser at 1440x900, 390x844 and 844x390, on Three Roads (the
// 128 m level): the marked build zones drawn as one mesh, a tap in a zone opening the crew sheet
// and building a tower on the grid spot, a spot by the road refused, the Armour chip (44 px) opening
// the depot, a squad bought and sent along a road by a tap, Hold the road, the chip cycling between
// two squads, (0.24) a branch rank and a squad's Rank 2 and Bulwark bought by taps, a mid-wave
// field, the bar inside the screen, no text under 12 px, no sideways scroll, no page errors.
// Screenshots: test-results/defence-zones-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.DEFENCE_VIEWPORTS || "desktop,portrait,landscape").split(",");
const OPENED = ["d-gorge", "d-bridges", "d-switchback", "d-fordwood", "d-canyon", "d-longcrossing"];

async function noSideScroll(page, where) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
}
async function bigEnough(locator, where) {
  for (const b of await locator.all()) {
    await b.waitFor({ state: "visible", timeout: TIMEOUT.step });
    const box = await b.boundingBox();
    assert.ok(box && box.height >= 44 && box.width >= 44, `${where}: ${box?.width}x${box?.height}`);
  }
}
// Text under 12 px inside a container (the 11 px hotkey letters on desktop tiles under 11 px).
async function tinyText(page, selector) {
  return page.evaluate((selector) => [...document.querySelectorAll(`${selector} *`)].filter((el) => el.offsetParent !== null && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < (el.closest("kbd") ? 11 : 12)).map((el) => el.textContent), selector);
}
async function tapAt(page, mobile, x, y) {
  if (mobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}
// A zone cell on screen, under nothing, away from the pads; `open` picks one a crew may take,
// otherwise one the rules refuse because of the road.
async function zoneCell(page, open) {
  return page.evaluate((open) => {
    const f = window.__frontier, s = f.sim, canvas = f.view.renderer.domElement, r = canvas.getBoundingClientRect(), t = s.terrain;
    const pads = [...s.missionDef.defence.pads, ...(s.defence.zonePads || [])];
    for (let z = -t.half + 1; z < t.half; z += 2)
      for (let x = -t.half + 1; x < t.half; x += 2) {
        const zone = s.zoneAt(x, z);
        if (!zone) continue;
        const why = s.zoneCheck(0, zone.id, x, z).why || "";
        if (open ? why : !/road/.test(why)) continue;
        const q = f.view.project(x, z, t.heightAt(x, z)), px = q.x + r.left, py = q.y + r.top;
        if (px < r.left + 50 || px > r.right - 50 || py < r.top + 50 || py > r.bottom - 50 || document.elementFromPoint(px, py) !== canvas) continue;
        if (pads.some((o) => { const w = f.view.project(o.x, o.z, 0.2); return Math.hypot(w.x + r.left - px, w.y + r.top - py) < 40; })) continue;
        if (f.view.pick(px, py, s, 24)) continue;
        // The tap must land on this cell (the snap of the point under it).
        const p = f.view.point(px, py), snap = p && s.zoneSnap(p.x, p.z);
        if (!snap || snap.x !== x || snap.z !== z) continue;
        return { x: px, y: py, wx: x, wz: z, zone: zone.id };
      }
    return null;
  }, open);
}
// Open ground on screen near a world point, clear of pads, zones' towers, units and spawn spots.
async function groundNear(page, at) {
  return page.evaluate((at) => {
    const f = window.__frontier, s = f.sim, canvas = f.view.renderer.domElement, r = canvas.getBoundingClientRect();
    const pads = [...s.missionDef.defence.pads, ...(s.defence.zonePads || [])];
    for (const radius of [0, 1.5, 3, 5]) for (let k = 0; k < 8; k++) {
      const p = { x: at.x + Math.cos(k * Math.PI / 4) * radius, z: at.z + Math.sin(k * Math.PI / 4) * radius };
      if (!s.nav.canStand(p.x, p.z, 1.6)) continue;
      const q = f.view.project(p.x, p.z, f.view.terrain.heightAt(p.x, p.z)), x = q.x + r.left, y = q.y + r.top;
      if (x < r.left + 40 || x > r.right - 40 || y < r.top + 40 || y > r.bottom - 40 || document.elementFromPoint(x, y) !== canvas) continue;
      if (pads.some((o) => { const w = f.view.project(o.x, o.z, 0.2); return Math.hypot(w.x + r.left - x, w.y + r.top - y) < 40; })) continue;
      if (f.view.pick(x, y, s, 24)) continue;
      const w = f.view.point(x, y);
      return { x, y, wx: w.x, wz: w.z };
    }
    return null;
  }, at);
}

await suite("defence-zones", async () => {
  for (const viewport of VIEWPORTS) {
    const { page, errors, tap, goto, ready, mobile } = await openPage(browser, viewport);
    // Six levels held: Three Roads is open.
    await page.addInitScript((ids) => { try { localStorage.setItem("frontier-defence-v1", JSON.stringify({ levels: Object.fromEntries(ids.map((id) => [id, { stars: 2, lives: 12, difficulty: "standard" }])) })); } catch {} }, OPENED);
    await goto();
    await ready();
    await tap('[data-mode="defence"]');
    await page.waitForSelector("#defence-setup .defence-levels");
    assert.equal(await page.locator('[data-level-id="d-crossroads"]').isDisabled(), false, "Three Roads opens after Long Crossing");
    await tap('[data-level-id="d-crossroads"]');
    await page.waitForFunction(() => window.__frontier.sim.missionDef?.id === "d-crossroads");
    await page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
    await shot(page, `defence-zones-briefing-${viewport}`);
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.defence && document.querySelector("#defence-bar:not([hidden])"), null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__frontier.sim.terrain.size), 128);

    // The bar: the Armour chip and the others, 44 px, inside the screen, uncovered, no small text.
    await page.waitForSelector("#defence-armour:not([hidden])");
    await bigEnough(page.locator("#defence-bar > button:not([hidden])"), `${viewport} bar button`);
    const bar = await page.evaluate(() => { const b = document.querySelector("#defence-bar").getBoundingClientRect(); return { left: b.left, right: b.right, width: innerWidth }; });
    assert.ok(bar.left >= 0 && bar.right <= bar.width, `${viewport}: the bar fits (${bar.left}-${bar.right} of ${bar.width})`);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#defence-bar > button:not([hidden])")].filter((el) => { const b = el.getBoundingClientRect(); return !el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)); }).map((el) => el.id)), [], `${viewport}: covered bar buttons`);
    assert.deepEqual(await tinyText(page, "#defence-bar"), [], `${viewport}: bar text under 12 px`);
    // The zones: one mesh, one flat material.
    const paint = await page.evaluate(() => { const m = window.__frontier.view.scene.getObjectByName("defence-zones"); return m ? { cells: m.geometry.index.count / 6, material: m.material.type } : null; });
    assert.ok(paint && paint.cells > 100 && paint.material === "MeshBasicMaterial", `${viewport}: zone paint ${JSON.stringify(paint)}`);

    // A tap in the basin field: the crew sheet; Rangers: a tower on the grid spot, with its own pad.
    await page.evaluate(() => { const f = window.__frontier; f.sim.players[0].alloy = 3000; f.select([]); f.view.focusOn(0, 6); f.view.zoom = 60; f.view.updateCamera(); });
    await page.waitForTimeout(200);
    const cell = await zoneCell(page, true);
    assert.ok(cell, `${viewport}: an open zone spot on screen`);
    await tapAt(page, mobile, cell.x, cell.y);
    await page.waitForFunction(() => document.querySelectorAll("#commands [data-defence-crew]:not(:disabled)").length === 6, null, { timeout: TIMEOUT.step });
    assert.match(await page.locator("#command-label").textContent(), /BUILD ZONE/);
    await bigEnough(page.locator("#commands [data-defence-crew]"), `${viewport} zone crew tile`);
    await shot(page, `defence-zones-spot-${viewport}`);
    await tap('#commands [data-defence-crew="ranger"]');
    await page.waitForFunction((c) => { const s = window.__frontier.sim, p = s.defence.zonePads?.[0]; return p && p.x === c.wx && p.z === c.wz && s.towerOn(p.id)?.crew === "ranger"; }, cell, { timeout: TIMEOUT.step });
    assert.ok(await page.evaluate(() => window.__frontier.sim.commandLog.some((c) => c.type === "zoneBuild")), "through the command log");
    await page.waitForSelector('#commands[data-tier="1"] [data-defence-act="upgrade"]');
    await shot(page, `defence-zones-tower-${viewport}`);
    // 0.24: the tower to gold with a branch, then a rank bought from its sheet: the Rank up tile
    // (44 px), the rank pips after the branch name, the command in the log.
    await page.evaluate(() => { const s = window.__frontier.sim, t = s.towerOn(s.defence.zonePads[0].id); s.command({ team: 0, type: "padUpgrade", building: t.id }); s.command({ team: 0, type: "padUpgrade", building: t.id }); s.command({ team: 0, type: "padBranch", building: t.id, branch: "marksman" }); });
    await page.waitForSelector('#commands [data-defence-act="rank"]:not(:disabled)', { timeout: TIMEOUT.step });
    assert.match(await page.locator("#command-context").textContent(), /RANK 0 \/ 2/);
    await bigEnough(page.locator('#commands [data-defence-act="rank"]'), `${viewport} rank tile`);
    await tap('#commands [data-defence-act="rank"]');
    await page.waitForFunction(() => { const s = window.__frontier.sim; return s.towerOn(s.defence.zonePads[0].id)?.branchRank === 1 && document.querySelectorAll("#commands .defence-rank-pips > i").length === 1; }, null, { timeout: TIMEOUT.step });
    assert.ok(await page.evaluate(() => window.__frontier.sim.commandLog.some((c) => c.type === "padRank")), "the rank went through the command log");
    assert.match(await page.locator("#command-context").textContent(), /RANK 1 \/ 2/);
    assert.deepEqual(await tinyText(page, "#commands"), [], `${viewport}: rank sheet text under 12 px`);
    await shot(page, `defence-zones-rank-${viewport}`);

    // A spot by the road: the sheet opens with every crew off and says why.
    await page.evaluate(() => window.__frontier.select([]));
    const road = await zoneCell(page, false);
    if (road) {
      await tapAt(page, mobile, road.x, road.y);
      await page.waitForFunction(() => document.querySelectorAll("#commands [data-defence-crew]").length === 6 && document.querySelectorAll("#commands [data-defence-crew]:disabled").length === 6, null, { timeout: TIMEOUT.step });
      assert.match(await page.locator("#command-hint").textContent(), /road/);
    }

    // Armour: the chip opens the depot; New squad: two tanks, picked, with the squad sheet.
    await page.evaluate(() => window.__frontier.select([]));
    await tap("#defence-armour");
    await page.waitForSelector('#commands [data-defence-armour="buy"]:not(:disabled)', { timeout: TIMEOUT.step });
    assert.match(await page.locator("#command-label").textContent(), /ARMOUR DEPOT/);
    await bigEnough(page.locator('#commands [data-defence-armour="buy"]'), `${viewport} buy tile`);
    await tap('#commands [data-defence-armour="buy"]');
    await page.waitForFunction(() => { const f = window.__frontier, q = f.sim.armourSquads()[0]; return q && q.units.length === 2 && q.units.every((e) => f.selected.has(e.id)) && document.querySelector('#commands [data-defence-armour="road"]'); }, null, { timeout: TIMEOUT.step });
    await bigEnough(page.locator("#commands [data-defence-armour]"), `${viewport} armour tile`);
    assert.deepEqual(await tinyText(page, "#commands"), [], `${viewport}: armour sheet text under 12 px`);
    await shot(page, `defence-zones-armour-${viewport}`);

    // A tap beside the east road sends the squad there; it arrives and holds.
    const target = await page.evaluate(() => { const r = window.__frontier.sim.missionDef.defence.routes.east, p = { x: (r[3].x + r[4].x) / 2 + 4, z: (r[3].z + r[4].z) / 2 }; window.__frontier.view.focusOn(p.x, p.z); return p; });
    await page.waitForTimeout(200);
    const ground = await groundNear(page, target);
    assert.ok(ground, `${viewport}: ground by the east road on screen`);
    await tapAt(page, mobile, ground.x, ground.y);
    await page.waitForFunction(() => window.__frontier.sim.commandLog.some((c) => c.type === "armourMove"), null, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.step(40));
    const far = await page.evaluate((g) => Math.max(...window.__frontier.sim.armourUnits(1).map((e) => Math.hypot(e.x - g.wx, e.z - g.wz))), ground);
    assert.ok(far < 4, `${viewport}: the squad drove there (${far.toFixed(1)} m off)`);
    // Hold the road.
    await tap('#commands [data-defence-armour="road"]');
    await page.waitForFunction(() => window.__frontier.sim.armourUnits(1).every((e) => e.blocker) && document.querySelector('#commands [data-defence-armour="road"][aria-pressed="true"]'), null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(250);
    await shot(page, `defence-zones-sent-${viewport}`);
    // 0.24: Rank 2 for the squad from its sheet, then one branch (Bulwark); 44 px, no small text.
    await tap('#commands [data-defence-armour="rank2"]');
    await page.waitForFunction(() => window.__frontier.sim.armourUnits(1).every((e) => e.squadRank === 2) && document.querySelector('#commands [data-defence-armour="bulwark"]:not(:disabled)'), null, { timeout: TIMEOUT.step });
    await bigEnough(page.locator("#commands [data-defence-armour]"), `${viewport} armour upgrade tile`);
    assert.deepEqual(await tinyText(page, "#commands"), [], `${viewport}: armour upgrade text under 12 px`);
    await shot(page, `defence-zones-armour-rank-${viewport}`);
    await tap('#commands [data-defence-armour="bulwark"]');
    await page.waitForFunction(() => window.__frontier.sim.armourUnits(1).every((e) => e.squadBranch === "bulwark") && document.querySelector('#commands [data-defence-armour="done"]'), null, { timeout: TIMEOUT.step });
    assert.deepEqual(await page.evaluate(() => window.__frontier.sim.commandLog.filter((c) => c.type === "armourUpgrade").map((c) => c.branch || "rank")), ["rank", "bulwark"]);

    // A second squad; the chip then picks one squad after the other.
    await tap('#commands [data-defence-armour="buy"]');
    await page.waitForFunction(() => window.__frontier.sim.armourSquads().length === 2, null, { timeout: TIMEOUT.step });
    await page.waitForFunction(() => document.querySelector("#defence-armour-state").textContent === "2/2");
    await page.evaluate(() => window.__frontier.select([]));
    for (const want of [1, 2, 1]) {
      await tap("#defence-armour");
      await page.waitForFunction((want) => { const f = window.__frontier, ids = f.sim.armourUnits(want).map((e) => e.id); return ids.length && f.selected.size === ids.length && ids.every((id) => f.selected.has(id)); }, want, { timeout: TIMEOUT.step });
    }

    // Three Roads mid-wave: the last wave on every road, the towers and the armour among it.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, def = s.missionDef.defence;
      s.players[0].alloy = 9000;
      def.pads.slice(0, 10).forEach((p, i) => { s.command({ team: 0, type: "padBuild", pad: p.id, crew: def.crews[i % def.crews.length] }); for (let k = 0; k < i % 3; k++) s.command({ team: 0, type: "padUpgrade", building: s.towerOn(p.id).id }); });
      s.defence.queue.length = 0;
      s.defence.wave = def.waves.length - 1;
      s.startWave();
      f.step(16);
      f.select([]);
    });
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => window.__frontier.sim.entities.filter((e) => e.team === 1 && e.hp > 0).length > 0), `${viewport}: enemies on the roads`);
    await shot(page, `defence-zones-wave-${viewport}`);
    // The overview shows the whole valley.
    await tap("#defence-overview");
    await page.waitForTimeout(300);
    await shot(page, `defence-zones-overview-${viewport}`);
    await noSideScroll(page, `${viewport} three roads`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
