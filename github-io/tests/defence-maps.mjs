// Defence 6.7 (W10) in the browser at 1440x900, 390x844 and 844x390:
//   - the three new maps are in the level list; Kingfisher Bridges (a river with two bridges) starts and loads;
//   - its second wave's strip shows the Shield wall chip and the commander hint tile (Barrage), as a tile, not a button;
//   - kind units walk the road tinted, with their ring (the view plugin), and the new-enemy card names the kind;
//   - the Records tab (a fifth mode button, 44 px) shows the map's Endless top ten from storage;
//   - an Endless run from it ends on the result card with the board, the new run marked, and is kept in storage;
//   - 11 px text, 44 px taps, no sideways scroll, no page errors.
// Screenshots: test-results/defence-maps-*.png. DEFENCE_MAPS_VIEWPORTS=portrait runs one viewport.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.DEFENCE_MAPS_VIEWPORTS || "desktop,portrait,landscape").split(",");
const OLD = ["d-gorge", "d-bridges", "d-switchback", "d-fordwood", "d-canyon", "d-longcrossing", "d-crossroads", "d-fork", "d-serpent"];
const BOARD = [
  { wave: 18, score: 2140, date: "2026-11-20", branch: "artillery", rank: 3 },
  { wave: 12, score: 1460, date: "2026-11-21", branch: "", rank: 2 },
  { wave: 3, score: 330, date: "2026-11-22", branch: "rally", rank: 3 },
];
const PROGRESS = { levels: Object.fromEntries(OLD.map((id) => [id, { stars: 1, lives: 8, difficulty: "standard" }])), board: { "d-kingfisher": BOARD } };
const noSideScroll = async (page, where) => {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollWidth, width: innerWidth }));
  assert.ok(scroll <= width + 1, `${where}: page scrolls sideways (${scroll} > ${width})`);
};
const tiny = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(`${selector} *`)].filter((el) => el.offsetParent !== null && [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.textContent), selector);
const small = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(selector)].filter((el) => el.offsetParent !== null).map((el) => { const b = el.getBoundingClientRect(); return { id: el.dataset.defenceVariant || el.id || el.textContent.slice(0, 20), w: b.width, h: b.height }; }).filter((b) => b.w < 43.5 || b.h < 43.5), selector);
const started = (page) => page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.defence && document.querySelector("#defence-bar:not([hidden])"), null, { timeout: 60000 });
const startReady = (page) => page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });

await suite("defence-maps", async () => {
  for (const [n, viewport] of VIEWPORTS.entries()) {
    const o = await openPage(browser, viewport);
    const { page, errors, tap } = o;
    await page.addInitScript((p) => { try { if (!sessionStorage.getItem("maps")) { localStorage.setItem("frontier-defence-v1", JSON.stringify(p)); sessionStorage.setItem("maps", "1"); } } catch {} }, PROGRESS);
    // One viewport shows the new-enemy cards (they are off under ?test otherwise).
    await o.goto(n === 0 ? "enemycards" : "");
    await o.ready();
    await tap('[data-mode="defence"]');
    await page.waitForSelector("#defence-setup .defence-levels");

    // ---- The level list: ten levels, the three new ones open with the stars seeded.
    const ids = await page.evaluate(() => [...document.querySelectorAll("#defence-setup [data-level-id]")].map((b) => `${b.dataset.levelId}${b.disabled ? "!" : ""}`));
    assert.deepEqual(ids.slice(-3), ["d-fork", "d-serpent", "d-kingfisher"], `${viewport}: the new maps close the list`);
    assert.equal(ids.length, 10);
    await tap('[data-level-id="d-kingfisher"]');
    await page.waitForFunction(() => window.__frontier.sim?.missionDef?.id === "d-kingfisher");
    await startReady(page);
    await tap("#start");
    await started(page);
    const map = await page.evaluate(() => { const t = window.__frontier.sim.terrain; return { id: t.id, rivers: t.rivers.length, bridges: t.rivers[0].crossings.map((c) => `${c.x}${c.type[0]}`).join(",") }; });
    assert.deepEqual(map, { id: "kingfisher", rivers: 1, bridges: "-22b,22b" }, `${viewport}: a river with two bridges`);

    // ---- The second wave's strip: a Shield wall chip and the Barrage hint tile (held clock, wave 1 behind us).
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.hold = true; s.defence.wave = 1; s.defence.cleared = 1; s.defence.nextAt = s.time + 20; f.step(0.1); });
    await page.waitForSelector('#defence-intel .intel-chip.kind[data-trait="shieldwall"]', { timeout: TIMEOUT.step });
    const hint = await page.evaluate(() => { const el = document.querySelector("#defence-intel .intel-hint"); return el && { ability: el.dataset.ability, kind: el.dataset.kind, tag: el.tagName, text: el.querySelector("b").textContent }; });
    assert.deepEqual(hint, { ability: "barrage", kind: "shieldwall", tag: "SPAN", text: "Barrage" }, `${viewport}: the commander hint tile`);
    assert.ok(await page.evaluate(() => !!document.querySelector('#defence-intel .intel-unit.kind[data-kind="shieldwall"]')), `${viewport}: the kind's units ringed on the strip`);
    assert.deepEqual(await tiny(page, "#defence-intel"), [], `${viewport}: strip text under 11 px`);
    await noSideScroll(page, `${viewport} strip`);
    await shot(page, `defence-maps-strip-${viewport}`);

    // ---- Call it: the shield wall walks the road tinted and ringed; a card names the kind (cards viewport).
    await page.evaluate(() => { const f = window.__frontier; f.sim.command({ team: 0, type: "waveCall" }); for (let i = 0; i < 24; i++) f.step(0.5); });
    const field = await page.evaluate(() => {
      const f = window.__frontier, walls = f.sim.entities.filter((e) => e.waveKind === "shieldwall" && e.hp > 0);
      const o = walls.map((e) => f.view.objects.get(e.id)).find(Boolean);
      let tinted = false;
      o?.userData.model?.traverse?.((p) => { if (p.isMesh && p.userData.tint) tinted = true; });
      const ring = f.view.scene.getObjectByName("WaveKindRings");
      return { walls: walls.length, tagged: o?.userData.waveKind, tinted, rings: ring?.visible ? ring.count : 0 };
    });
    assert.ok(field.walls > 0 && field.tagged === "shieldwall" && field.tinted && field.rings > 0, `${viewport}: kind units on the road ${JSON.stringify(field)}`);
    if (n === 0) {
      await page.evaluate(() => { window.__frontier.hold = false; });
      await page.waitForSelector('#defence-card[data-kind="shieldwall"]', { timeout: TIMEOUT.step });
      assert.match(await page.evaluate(() => document.querySelector("#defence-card").textContent), /Shield wall.*Best crews.*Mortar/s);
      await shot(page, `defence-maps-card-${viewport}`);
      await page.evaluate(() => { window.__frontier.hold = true; });
    }
    await shot(page, `defence-maps-wave-${viewport}`);
    assert.deepEqual(await tiny(page, "#defence-bar"), [], `${viewport}: bar text under 11 px`);

    // ---- Back to the menu; the Records tab shows the board kept in storage.
    await page.evaluate(() => { window.__frontier.hold = false; window.__frontier.sim.defence.lives = 0; });
    await page.waitForSelector('#modal:not([hidden]) .defence-result', { timeout: TIMEOUT.step });
    await tap("#modal [data-new-game]");
    await page.waitForSelector("#defence-setup .defence-levels");
    const tabs = await page.evaluate(() => [...document.querySelectorAll("[data-defence-variant]")].map((b) => b.dataset.defenceVariant));
    assert.deepEqual(tabs, ["levels", "endless", "daily", "heroic", "records"], `${viewport}: Records beside the other modes`);
    assert.deepEqual(await small(page, "[data-defence-variant]"), [], `${viewport}: mode taps under 44 px`);
    await tap('[data-defence-variant="records"]');
    await tap('[data-level-id="d-kingfisher"]');
    await page.waitForFunction(() => document.querySelectorAll("#defence-setup .defence-board tbody tr").length === 3 && /Start endless/.test(document.querySelector("#start").textContent));
    const rows = await page.evaluate(() => [...document.querySelectorAll("#defence-setup .defence-board tbody tr")].map((tr) => [...tr.cells].map((c) => c.textContent).join("|")));
    assert.deepEqual(rows, ["1|18|2140|Artillery|2026-11-20", "2|12|1460|Rank 2|2026-11-21", "3|3|330|Rally|2026-11-22"], `${viewport}: the board`);
    await page.evaluate(() => document.querySelector(".defence-variants").scrollIntoView({ block: "start" }));
    await shot(page, `defence-maps-tabs-${viewport}`);
    await page.evaluate(() => document.querySelector("#defence-setup .defence-records").scrollIntoView({ block: "center" }));
    assert.deepEqual(await tiny(page, "#defence-setup"), [], `${viewport}: Records text under 11 px`);
    await noSideScroll(page, `${viewport} records`);
    await shot(page, `defence-maps-records-${viewport}`);

    // ---- Endless from the Records tab: five waves held, the result shows the board with the new run.
    await startReady(page);
    await tap("#start");
    await started(page);
    assert.equal(await page.evaluate(() => window.__frontier.sim.missionDef.variant), "endless");
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.hold = true; s.defence.wave = 5; s.defence.cleared = 5; f.step(0.1); f.hold = false; s.defence.lives = 0; });
    await page.waitForSelector('#modal:not([hidden]) .defence-score[data-variant="endless"] .defence-board tr.new', { timeout: TIMEOUT.step });
    const result = await page.evaluate(() => ({ rows: document.querySelectorAll("#modal .defence-board tbody tr").length, place: [...document.querySelectorAll("#modal .stat")].find((s) => /Top 10 place/.test(s.textContent))?.querySelector("strong").textContent, kept: JSON.parse(localStorage.getItem("frontier-defence-v1")).board["d-kingfisher"].length }));
    assert.deepEqual(result, { rows: 4, place: "#3", kept: 4 }, `${viewport}: the run joins the board`);
    assert.deepEqual(await small(page, "#modal button"), [], `${viewport}: result taps under 44 px`);
    assert.deepEqual(await tiny(page, "#modal"), [], `${viewport}: result text under 11 px`);
    await noSideScroll(page, `${viewport} result`);
    await page.evaluate(() => document.querySelector("#modal .defence-records")?.scrollIntoView({ block: "center" }));
    await shot(page, `defence-maps-result-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
  // ---- Phones: Hollow Fork and Serpent Pass load and play their first kind wave (the fitted view, kinds on the road).
  for (const viewport of VIEWPORTS.filter((v) => v !== "desktop")) for (const id of ["d-fork", "d-serpent"]) {
    const o = await openPage(browser, viewport);
    const { page, errors, tap } = o;
    await page.addInitScript((p) => { try { localStorage.setItem("frontier-defence-v1", JSON.stringify(p)); } catch {} }, PROGRESS);
    await o.goto();
    await o.ready();
    await tap('[data-mode="defence"]');
    await page.waitForSelector("#defence-setup .defence-levels");
    await tap('[data-defence-variant="levels"]');
    await tap(`[data-level-id="${id}"]`);
    await page.waitForFunction((id) => window.__frontier.sim?.missionDef?.id === id, id);
    await startReady(page);
    await tap("#start");
    await started(page);
    // Wave 2 is a Runner wave on both maps: call it and let it walk.
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.hold = true; s.defence.wave = 1; s.defence.cleared = 1; f.sim.command({ team: 0, type: "waveCall" }); for (let i = 0; i < 30; i++) f.step(0.5); });
    const kinds = await page.evaluate(() => [...new Set(window.__frontier.sim.entities.filter((e) => e.waveKind && e.hp > 0).map((e) => e.waveKind))]);
    assert.ok(kinds.includes("runner"), `${viewport} ${id}: runners on the road (${kinds})`);
    await noSideScroll(page, `${viewport} ${id}`);
    await shot(page, `defence-maps-${id}-${viewport}`);
    assert.deepEqual(errors, [], `${viewport} ${id}: page errors`);
    await page.close();
  }
});
await browser.close();
