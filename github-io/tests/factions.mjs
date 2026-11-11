// Skirmish against a faction: the setup choice, late model loading, colours, the units' names,
// portraits and faction line in the selection panel, the faction building, and (Veil) hidden
// units staying off the screen. Run against a build: TEST_URL=http://127.0.0.1:4231/ npm run test:factions
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
await suite("factions", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors, badResponses, mobile } = await openPage(browser, viewport);
    const fetched = [];
    page.on("request", (r) => { const m = r.url().match(/\/models\/([a-z]+)\.glb/); if (m) fetched.push(m[1]); });
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    assert.equal(fetched.includes("scrapper"), false, "faction models wait until a faction is chosen");

    // The choice sits inside the screen and is large enough to tap.
    const box = await page.locator("#enemy-faction").boundingBox();
    const size = page.viewportSize();
    assert.ok(box && box.x >= 0 && box.x + box.width <= size.width + 0.5, `${viewport}: faction choice inside the screen`);
    if (mobile) assert.ok(box.height >= 44, `${viewport}: faction choice is ${box.height}px tall`);
    assert.deepEqual(await page.locator("#enemy-faction option").evaluateAll((o) => o.map((x) => x.value)), ["mirror", "ashfall", "sunward", "wardens", "veil", "mixed"]);

    await page.selectOption("#enemy-faction", "ashfall");
    await page.waitForFunction(() => window.__frontier.modelsReady && window.__frontier.sim.factions[1] === "ashfall", null, { timeout: TIMEOUT.models });
    const preview = await page.evaluate(() => {
      const f = window.__frontier, types = new Set(f.sim.own(1).map((e) => e.type));
      return { models: ["scrapper", "scorcher", "salvageyard"].every((t) => f.view.models.has(t)), scrapper: types.has("scrapper"), vanguard: types.has("vanguard"),
        hostile: getComputedStyle(document.documentElement).getPropertyValue("--team-hostile").trim().toLowerCase(), look: f.view.mission?.factions?.[1] };
    });
    assert.deepEqual({ models: preview.models, scrapper: preview.scrapper, vanguard: preview.vanguard, look: preview.look }, { models: true, scrapper: true, vanguard: false, look: "ashfall" }, viewport);
    assert.equal(preview.hostile, "#ef7660", `${viewport}: Ashfall wears its coral`);
    for (const type of ["scrapper", "scorcher", "salvageyard"]) assert.ok(fetched.includes(type), `${type} model was fetched once chosen`);

    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    // Put one of each Ashfall piece beside the player's base and look at it.
    const ids = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, hq = s.own(0).find((e) => e.type === "hq");
      // Open ground near the core: nothing within 5 m, so each piece is picked on its own.
      const free = (x, z) => s.nav.canStand(x, z, 3) && !s.entities.some((e) => Math.hypot(e.x - x, e.z - z) < 5 + (e.radius || 0)) && !s.resources.some((r) => Math.hypot(r.x - x, r.z - z) < 5);
      const made = ["scrapper", "scorcher", "salvageyard"].map((type) => {
        for (let r = 9; r < 20; r += 1.5) for (let k = 0; k < 16; k++) {
          const x = hq.x + Math.cos(k * Math.PI / 8) * r, z = hq.z + Math.sin(k * Math.PI / 8) * r;
          if (!free(x, z) || !s.isVisible({ x, z })) continue;
          const e = s.spawn(type, 1, x, z); e.stance = "hold"; e.damage = 0; e.trainingGuard = true; return e.id;
        }
        throw new Error("no open ground for " + type);
      });
      s.nav.rebuild(s.entities);
      f.step(0.3);
      return made;
    });
    for (const [i, name] of ["Scrapper", "Scorcher", "Salvage yard"].entries()) {
      const want = `${name} · Ashfall · ENEMY`;
      // Look at it and tap it, as a player would.
      const at = await page.evaluate((id) => {
        const f = window.__frontier, e = f.sim.get(id);
        f.select([]);
        f.view.focusOn(e.x, e.z);
        return id;
      }, ids[i]);
      await page.waitForTimeout(250);
      const point = await page.evaluate((id) => {
        const f = window.__frontier, e = f.sim.get(id), p = f.view.project(e.x, e.z, 0.6), r = f.view.renderer.domElement.getBoundingClientRect();
        return { x: r.left + p.x, y: r.top + p.y };
      }, at);
      // Enemy units cannot be selected: the pointer (desktop) or a tap (touch) names them.
      if (mobile) await page.touchscreen.tap(point.x, point.y); else { await page.mouse.move(point.x - 4, point.y - 4); await page.mouse.move(point.x, point.y); }
      await page.waitForFunction(([want, touch]) => { const l = document.querySelector(touch ? "#notice" : "#hover-label"); return l && (touch ? l.classList.contains("show") : !l.hidden) && l.textContent === want; }, [want, mobile], { timeout: TIMEOUT.step }).catch(async (error) => {
        // Say what was under the pointer before failing.
        console.error(viewport, want, JSON.stringify(await page.evaluate(([id, p]) => { const f = window.__frontier, l = document.querySelector("#hover-label"), e = f.sim.get(id); return { label: l.textContent, hidden: l.hidden, alive: !!e, visible: e && f.sim.isVisible(e), pick: f.view.pick(p.x, p.y, f.sim)?.type, mode: f.mode, paused: f.paused, over: document.elementFromPoint(p.x, p.y)?.id }; }, [ids[i], point])));
        throw error;
      });
      const label = await page.locator(mobile ? "#notice" : "#hover-label").boundingBox();
      assert.ok(label.x >= 0 && label.x + label.width <= size.width + 0.5 && label.y >= 0, `${name}: the label is on the screen`);
      assert.equal(await page.evaluate((id) => !!window.__frontier.view.objects.get(id), ids[i]), true, `${name}: drawn`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${viewport}: no sideways scroll`);
    await shot(page, `factions-ashfall-${viewport}`);

    assert.deepEqual(errors, [], `${viewport}: page errors`);
    assert.deepEqual(badResponses, [], `${viewport}: failed requests`);
    await page.close();
  }

  // A Veil skirmish: hidden Shades are not drawn, a tower reveals them, and the first ambush explains the rule.
  const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
  await goto();
  await ready();
  await tap('[data-mode="skirmish"]');
  await page.selectOption("#enemy-faction", "veil");
  await page.waitForFunction(() => window.__frontier.modelsReady && window.__frontier.sim.factions[1] === "veil", null, { timeout: TIMEOUT.models });
  await tap("#start");
  await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
  const cloak = await page.evaluate(() => {
    const f = window.__frontier, s = f.sim, hq = s.own(0).find((e) => e.type === "hq");
    // Far enough from the core and every unit to stay hidden, but well inside the player's sight.
    const far = s.spawn("shade", 1, hq.x + 14, hq.z - 2); far.stance = "hold";
    for (const e of s.own(0)) if (e.kind === "unit" && Math.hypot(e.x - far.x, e.z - far.z) < 8) { e.x = hq.x - 6; e.z = hq.z + 6; }
    f.step(0.5);
    const cell = s.isVisible({ x: far.x, z: far.z });
    const out = { id: far.id, cloaked: far.cloaked === true, groundSeen: cell, visible: s.isVisible(far) };
    return out;
  });
  assert.deepEqual({ cloaked: cloak.cloaked, groundSeen: cloak.groundSeen, visible: cloak.visible }, { cloaked: true, groundSeen: true, visible: false });
  await page.waitForFunction((id) => { const o = window.__frontier.view.objects.get(id); return !o || o.visible === false; }, cloak.id, { timeout: TIMEOUT.step });
  // An ambush on a player unit shows the hint.
  await page.evaluate((id) => {
    const f = window.__frontier, s = f.sim, shade = s.get(id), victim = s.own(0).find((e) => e.type === "ranger");
    s.hit(shade, victim);
  }, cloak.id);
  await page.waitForFunction(() => { const h = window.__frontier.fightHint; return h && !h.hidden && /Shades are hidden/.test(h.textContent); }, null, { timeout: TIMEOUT.step });
  assert.equal(await page.evaluate((id) => window.__frontier.sim.isVisible(window.__frontier.sim.get(id)), cloak.id), true, "a Shade that struck is seen");
  await shot(page, "factions-veil-desktop");
  assert.deepEqual(errors, []);
}, { browser });
