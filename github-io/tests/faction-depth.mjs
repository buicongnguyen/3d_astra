// Faction depth (2026-11-24) at 1440x900, 390x844 and 844x390:
//  - doctrines: a level-2 Barracks shows its either/or pair as two tiles in view at once, each with its
//    effect in words and its price (desktop: the tile grid; landscape: the side dock; portrait: the order row
//    beside Rally), an "or" between them; one tap picks, the other option leaves the card and the pick shows
//    as done (portrait keeps it in the row); below level 2 the pair is locked (desktop, landscape) or absent
//    (portrait, where the row is shared with the production queue);
//  - the faction signature abilities: a Supply wagon, a Sentinel drone and a Shade each bring their tile
//    (Spur on, Shield link, Shadow strike) to the tactics card;
//  - the build menu (2026-11-25): a Harvester's building tiles show the units each building trains (Meridian, then
//    Wardens): on phones a strip of role glyphs at the foot of the picture, matching the faction's trains list,
//    higher-level units dimmed; the tile stays one 44 px+ target (a tap on the strip starts placing that
//    building); the accessible name lists them on every layout (the PC tile has no room for the strip);
//  - every tap target at least 44 px, text at least 11 px, nothing covered, no sideways scroll.
// Rules are unit-tested in tests/faction-depth.test.js. Screenshots: test-results/faction-depth-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";
import { Simulation } from "../src/simulation.js";
import { buildingUnits } from "../src/research-tiles.js";

// What each building tile should show, from the same rules in Node (src/research-tiles.js buildingUnits).
const expected = (faction) => {
  const sim = new Simulation({ ai: false, factions: { 0: faction, 1: "meridian" } });
  return Object.fromEntries(sim.buildable(0).map((type) => [type, buildingUnits(sim, type)]));
};

const browser = await launchBrowser();
await suite("faction-depth", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, errors, tap, goto, ready, mobile } = await openPage(browser, viewport);
    page.setDefaultTimeout(TIMEOUT.step);
    const frontier = (fn, arg) => page.evaluate(fn, arg);
    const portrait = viewport === "portrait";
    const dock = async () => {
      if (!mobile) return;
      const b = page.locator('button[data-dock="selection"]').first();
      if (await b.count() && await b.isVisible()) { await b.tap(); await page.waitForTimeout(150); }
    };
    // The doctrine tiles on screen: their pick, state, words, box, whether they are on top where they sit, and the smallest text.
    const tiles = () => frontier(() => [...document.querySelectorAll(".doctrine-tile")].filter((b) => b.getClientRects().length).map((b) => {
      const r = b.getBoundingClientRect(), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const fonts = [...b.querySelectorAll("*")].filter((e) => e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize));
      return { pick: b.dataset.pick, state: b.dataset.state, text: b.innerText.replace(/\s+/g, " ").trim(), w: r.width, h: r.height, top: !!at && b.contains(at), font: Math.min(99, ...fonts), inside: r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
    }));
    const select = (type, level) => frontier(([type, level]) => {
      const f = window.__frontier, s = f.sim;
      f.hold = true;
      s.players[0].alloy = 900; s.players[0].energy = 600;
      const b = s.own(0).find((e) => e.type === type);
      b.level = level;
      f.select([b.id]); f.view.focusOn(b.x, b.z);
    }, [type, level]);

    await goto();
    await ready();
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });

    // ---- The build menu: each building tile shows what it trains (Meridian, then the Wardens' roster).
    for (const faction of ["meridian", "wardens"]) {
      // The match's faction is swapped in place (the menu reads sim.factions); a fresh selection redraws the card.
      await frontier((faction) => {
        const f = window.__frontier, s = f.sim;
        s.factions[0] = faction; f.hold = true; s.players[0].alloy = 900; s.players[0].energy = 600;
        f.select([]); const w = s.own(0).find((e) => e.type === "worker"); f.select([w.id]); f.view.focusOn(w.x, w.z);
      }, faction);
      await dock();
      await page.waitForFunction(() => document.querySelector('#commands [data-action="barracks"]')?.getClientRects().length);
      const want = expected(faction);
      const seen = await frontier(() => [...document.querySelectorAll("#commands > .command-tile[data-action]")].filter((b) => b.getClientRects().length).map((b) => {
        const r = b.getBoundingClientRect(), strip = b.querySelector(".tile-units"), s = strip?.getBoundingClientRect();
        const glyphs = [...b.querySelectorAll(".tile-unit")].map((u) => { const q = u.getBoundingClientRect(), at = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); return { type: u.dataset.unit, dim: u.classList.contains("needs-level"), opacity: parseFloat(getComputedStyle(u.querySelector("svg")).opacity), w: q.width, inTile: !!at && b.contains(at) }; });
        const fonts = [...b.querySelectorAll("*")].filter((e) => e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize));
        return { type: b.dataset.action, aria: b.getAttribute("aria-label"), title: b.title, w: r.width, h: r.height, font: Math.min(99, ...fonts), glyphs,
          more: b.querySelector(".tile-units-more")?.textContent || "",
          stripInside: !s || (s.left >= r.left - 0.5 && s.right <= r.right + 0.5 && s.top >= r.top - 0.5 && s.bottom <= r.bottom + 0.5 && strip.scrollWidth <= strip.clientWidth + 1),
          inside: r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5 };
      }));
      assert.deepEqual(seen.map((t) => t.type), Object.keys(want), `${viewport} ${faction}: one tile per building`);
      for (const t of seen) {
        const units = want[t.type], tag = `${viewport} ${faction} ${t.type}`;
        assert.ok(t.inside && t.stripInside, `${tag}: tile and its pictures inside the screen and the tile ${JSON.stringify(t)}`);
        // Touch targets 44 px; the PC console's mouse tiles keep their 38 px rows.
        assert.ok(t.w >= 44 - 0.5 && t.h >= (mobile ? 44 : 38) - 0.5, `${tag}: large enough target (${t.w}x${t.h})`);
        assert.ok(t.font >= 11, `${tag}: text at least 11 px (${t.font})`);
        const line = units.length ? `Trains: ${units.map((u) => (u.level > 1 ? `${u.name} (level ${u.level})` : u.name)).join(" · ")}` : "";
        if (line) { assert.ok(t.aria.endsWith(` · ${line}`), `${tag}: the accessible name lists what it trains: ${t.aria}`); assert.ok(t.title.endsWith(line), `${tag}: so does the tooltip`); }
        else assert.ok(!/Trains/.test(t.aria) && !t.glyphs.length, `${tag}: a building that trains nothing shows none`);
        if (!mobile) { assert.equal(t.glyphs.length, 0, `${tag}: the PC console keeps its tile`); continue; }
        const shown = units.length > 4 ? units.slice(0, 3) : units;
        assert.deepEqual(t.glyphs.map((g) => g.type), shown.map((u) => u.type), `${tag}: the pictures follow the trains list`);
        assert.equal(t.more, units.length > 4 ? `+${units.length - 3}` : "", `${tag}: "+N" for the rest`);
        for (const [i, g] of t.glyphs.entries()) {
          assert.equal(g.dim, shown[i].level > 1, `${tag} ${g.type}: dimmed only when it needs a higher level`);
          if (g.dim) assert.ok(g.opacity < 0.6, `${tag} ${g.type}: dimmed (${g.opacity})`);
          assert.ok(g.inTile, `${tag} ${g.type}: the picture is part of the tile's target`);
        }
      }
      await shot(page, `faction-depth-build-tiles-${faction}-${viewport}`);
      if (mobile && faction === "meridian") {
        // A tap on the pictures starts placing that building, as a tap anywhere on the tile does.
        const box = await page.locator('#commands [data-action="barracks"] .tile-units').boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForFunction(() => window.__frontier.mode === "build", null, { timeout: TIMEOUT.step });
        await tap("#cancel-mode");
        await page.waitForFunction(() => window.__frontier.mode !== "build", null, { timeout: TIMEOUT.step });
      }
    }
    await frontier(() => { const f = window.__frontier; f.sim.factions[0] = "meridian"; f.select([]); });

    // ---- Below level 2: a locked pair on desktop and landscape, nothing on portrait.
    await select("barracks", 1);
    await dock();
    await page.waitForTimeout(300);
    let seen = await tiles();
    if (portrait) assert.deepEqual(seen, [], "portrait: no locked pair in the order row");
    else {
      assert.deepEqual(seen.map((t) => `${t.pick}:${t.state}`), ["rations:locked", "drill:locked"], `${viewport}: the locked pair`);
      assert.ok(seen.every((t) => t.top && t.inside), `${viewport}: the locked pair is in view and uncovered ${JSON.stringify(seen)}`);
    }

    // ---- Level 2: both options in view at once, in words, with their prices and an "or".
    await select("barracks", 2);
    await page.waitForTimeout(300);
    seen = await tiles();
    assert.deepEqual(seen.map((t) => `${t.pick}:${t.state}`), ["rations:ready", "drill:ready"], `${viewport}: the ready pair`);
    for (const t of seen) {
      assert.ok(t.top && t.inside, `${viewport} ${t.pick}: in view and uncovered ${JSON.stringify(t)}`);
      assert.ok(t.w >= 44 - 0.5 && t.h >= 44 - 0.5, `${viewport} ${t.pick}: 44 px target (${t.w}x${t.h})`);
      assert.ok(t.font >= 11, `${viewport} ${t.pick}: text at least 11 px (${t.font})`);
    }
    assert.match(seen[0].text, /March \+12%.*125/, `${viewport}: the effect and the price in words`);
    assert.match(seen[1].text, /Rank \+1.*175/);
    assert.ok(await frontier(() => [...document.querySelectorAll(".doctrine-or, .doctrine-or-sep")].some((e) => e.getClientRects().length && e.textContent.trim().toLowerCase() === "or")), `${viewport}: an "or" between them`);
    await shot(page, `faction-depth-doctrine-${viewport}`);

    // ---- One tap picks; the other option leaves; the price is paid.
    const energy = await frontier(() => window.__frontier.sim.players[0].energy);
    await page.locator('.doctrine-tile[data-pick="drill"]').first()[mobile ? "tap" : "click"]();
    await page.waitForFunction(() => window.__frontier.sim.players[0].doctrine?.barracks === "drill", null, { timeout: TIMEOUT.step }).catch(() => {});
    assert.deepEqual(await frontier(() => window.__frontier.sim.players[0].doctrine), { barracks: "drill" });
    assert.equal(await frontier(() => window.__frontier.sim.players[0].energy), energy - 175);
    seen = await tiles();
    assert.deepEqual(seen.map((t) => `${t.pick}:${t.state}`), ["drill:done"], `${viewport}: the pick shows as done`);
    assert.match(seen[0].text, /Rank \+1.*Active/);
    await shot(page, `faction-depth-doctrine-done-${viewport}`);

    // ---- The signature abilities on the tactics card.
    const ids = await frontier(() => {
      const f = window.__frontier, s = f.sim, hq = s.own(0).find((e) => e.type === "hq");
      const ids = ["wagon", "drone", "shade"].map((t, i) => s.spawn(t, 0, hq.x + 4 + i * 2.2, hq.z - 10, true, true).id);
      f.select(ids); f.view.focusOn(hq.x + 6, hq.z - 10);
      return ids;
    });
    assert.equal(ids.length, 3);
    await dock();
    await page.waitForTimeout(300);
    const abilities = await frontier(() => [...document.querySelectorAll("#commands .ability-tile")].map((b) => {
      const r = b.getBoundingClientRect(), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { id: b.dataset.ability, label: b.getAttribute("aria-label"), w: r.width, h: r.height, top: !!at && b.contains(at), svg: !!b.querySelector("svg") };
    }));
    assert.deepEqual(abilities.map((a) => a.id).sort(), ["shadowstrike", "shieldlink", "spurs"], `${viewport}: one tile per signature ability`);
    for (const a of abilities) assert.ok(a.top && a.w >= 43.5 && a.h >= 37.5, `${viewport} ${a.id}: uncovered, large enough ${JSON.stringify(a)}`);
    // Pressing Spur on casts it (one press, no aiming).
    await page.locator('#commands [data-ability="spurs"]').first()[mobile ? "tap" : "click"]();
    await page.waitForFunction((id) => window.__frontier.sim.get(id).abilityAt > window.__frontier.sim.time, ids[0], { timeout: TIMEOUT.step }).catch(() => {});
    assert.ok(await frontier((id) => window.__frontier.sim.get(id).abilityAt > window.__frontier.sim.time, ids[0]), `${viewport}: Spur on was used`);
    await shot(page, `faction-depth-abilities-${viewport}`);

    assert.ok(await frontier(() => document.documentElement.scrollWidth <= innerWidth + 1), `${viewport}: no sideways scroll`);
    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }
}, { browser });
