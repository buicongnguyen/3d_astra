// 0.18 "Wings": flyers in the browser. A Meridian Kite trained at a level 2 Command core flies straight
// over the river, draws its ground shadow and spinning rotors at altitude, is selected where it is
// drawn and its card says Air; a Hawk strafes ground troops and Rangers shoot it down; the Flak
// research tile at the Command core; the field guide entry. No sideways scroll, text >= 11 px, taps
// >= 44 px, at three viewports. Run against a build: TEST_URL=http://127.0.0.1:4246/ npm run test:air
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
// Visible text under `root` that is smaller than 11 px, and (touch) buttons smaller than 44 px.
const audit = (page, root, touch) => page.evaluate(([root, touch]) => {
  const small = [], tiny = [];
  for (const e of document.querySelectorAll(`${root} *`)) {
    const r = e.getBoundingClientRect(), style = getComputedStyle(e);
    if (!r.width || !r.height || style.visibility === "hidden" || style.display === "none") continue;
    if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(style.fontSize) < 11) small.push(`${e.textContent.trim().slice(0, 24)} ${style.fontSize}`);
    if (touch && e.matches("button") && (r.height < 44 || r.width < 40)) tiny.push(`${e.textContent.trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return { small, tiny, wide: document.documentElement.scrollWidth > innerWidth + 1 };
}, [root, touch]);

await suite("air", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors, badResponses, mobile } = await openPage(browser, viewport);
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "riverlands");
    await page.waitForFunction(() => window.__frontier.modelsReady, null, { timeout: TIMEOUT.models });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.modelsReady && window.__frontier.view.models.has("kite"), null, { timeout: TIMEOUT.models });
    const dock = async (tab) => { if (mobile) { await tap(`#dock-tabs [data-dock="${tab}"]`); await page.waitForTimeout(120); } };

    // 1. Train a Kite at a level 2 Command core (the airfield: Harvester, Flak, Kite, own flyer) through its tile.
    const core = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      s.aiEnabled = false;
      Object.assign(s.players[0], { alloy: 5000, energy: 5000 });
      const b = s.own(0).find((e) => e.type === "hq");
      b.level = 2; b.queue = [];
      f.select([b.id]);
      f.step(0.1);
      return b.id;
    });
    await dock("actions");
    const tile = page.locator('#commands [data-action="kite"]');
    await tile.waitFor({ state: "visible", timeout: TIMEOUT.step });
    const tileBox = await tile.boundingBox();
    if (mobile) assert.ok(tileBox.height >= 44, `${viewport}: Kite tile is ${tileBox.height}px tall`);
    assert.match(await tile.textContent(), /Kite scout/);
    await tile[mobile ? "tap" : "click"]();
    const kite = await page.evaluate((id) => {
      const f = window.__frontier, s = f.sim, b = s.get(id);
      if (!b.queue.some((q) => q.type === "kite")) throw new Error("Kite not queued");
      f.step(13);
      const k = s.own(0).find((e) => e.type === "kite");
      if (!k) throw new Error("Kite not trained");
      return { id: k.id, x: k.x, z: k.z };
    }, core);
    assert.deepEqual(await page.locator("#commands [data-action]").evaluateAll((t) => t.map((b) => b.dataset.action)), ["worker", "flak", "kite", "hawk"], `${viewport}: the core's four tiles`);

    // 2. Straight over the river (z = 0) to the far bank; a ground unit could not stand where it passes.
    const flight = await page.evaluate((k) => {
      const f = window.__frontier, s = f.sim, e = s.get(k.id);
      // A line across open water (not a bridge or the ford) near the Kite.
      let x = e.x;
      for (let d = 0; d < 40 && s.nav.canStand(x, 0, 0.6); d++) x = e.x + (d % 2 ? d : -d) * 1.5;
      const goal = { x, z: -10 };
      e.x = x;
      s.command({ team: 0, type: "order", ids: [e.id], order: { type: "move", x: goal.x, z: goal.z } });
      let overWater = false, drift = 0;
      for (let i = 0; i < 200 && e.orders.length; i++) { s.tick(0.05); drift = Math.max(drift, Math.abs(e.x - goal.x)); if (!s.nav.canStand(e.x, e.z, 0.6)) overWater = true; }
      return { z: e.z, drift, overWater, arrived: !e.orders.length };
    }, kite);
    assert.ok(flight.arrived && flight.z < -8 && flight.drift < 0.01 && flight.overWater, `${viewport}: ${JSON.stringify(flight)}`);

    // 3. Drawn at altitude with its blob shadow on the ground and spinning rotors (real frames).
    await page.evaluate((id) => { const f = window.__frontier, e = f.sim.get(id); f.view.focusOn(e.x, e.z); f.view.zoom = 30; f.view.updateCamera(); }, kite.id);
    await page.waitForTimeout(300);
    const look = await page.evaluate(async (id) => {
      const f = window.__frontier, o = f.view.objects.get(id), u = o.userData, spin = u.air.spins[0].node.quaternion.clone();
      await new Promise((r) => setTimeout(r, 250));
      return { lift: u.model.position.y, shadow: u.contactShadow.visible, shadowY: u.contactShadow.position.y, spins: u.air.spins.length,
        turned: u.air.spins[0].node.quaternion.angleTo(spin) > 0.01, castsShadow: u.model.children.some((c) => c.castShadow), ring: u.ring.position.y };
    }, kite.id);
    assert.ok(look.lift > 2.8 && look.shadow && look.shadowY < 0.2 && look.spins === 2 && look.turned && !look.castsShadow && look.ring > 2.5, `${viewport}: ${JSON.stringify(look)}`);

    // 4. Selected where it is drawn (a tap or click on the model at altitude); the card names its class.
    await page.evaluate(() => window.__frontier.select([]));
    await dock("selection");
    const point = await page.evaluate((id) => {
      const f = window.__frontier, e = f.sim.get(id), p = f.view.project(e.x, e.z, f.view.liftOf(e)), r = f.view.renderer.domElement.getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y, ground: f.view.project(e.x, e.z, 0) };
    }, kite.id);
    if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForFunction((id) => window.__frontier.selected.has(id), kite.id, { timeout: TIMEOUT.step }).catch(async (error) => {
      console.error(viewport, JSON.stringify(await page.evaluate(([id, p]) => ({ pick: window.__frontier.view.pick(p.x, p.y, window.__frontier.sim)?.type, over: document.elementFromPoint(p.x, p.y)?.id || document.elementFromPoint(p.x, p.y)?.className }), [kite.id, point])));
      throw error;
    });
    await page.evaluate(() => window.__frontier.step(0.05));
    const card = page.locator("#selection-info .in-air");
    await card.waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.match(await card.textContent(), /Air/);
    assert.match(await page.locator("#selection-info h3").textContent(), /Kite scout/);
    let report = await audit(page, ".selection-panel", mobile);
    assert.deepEqual(report.small, [], `${viewport}: small text on the card`);
    assert.equal(report.wide, false, `${viewport}: no sideways scroll`);
    await shot(page, `air-kite-${viewport}`);

    // 5. A Hawk strafes ground troops (who cannot answer), then enemy Rangers shoot it down.
    const fight = await page.evaluate(async () => {
      const f = window.__frontier, s = f.sim, hq = s.own(0).find((e) => e.type === "hq");
      const x = hq.x + 12, z = hq.z - 14;
      s.visible[0].fill(1);
      const hawk = s.spawn("hawk", 0, x, z, true, true), foes = [0, 1, 2].map((i) => s.spawn("vanguard", 1, x + 5 + i, z - 3, true, true));
      for (const v of foes) v.stance = "hold";
      f.step(0.2);
      s.command({ team: 0, type: "order", ids: [hawk.id], order: { type: "attack", target: foes[0].id } });
      const before = foes.reduce((n, v) => n + v.hp + v.shield, 0), hawkBefore = hawk.hp + hawk.shield;
      f.step(4);
      const after = foes.reduce((n, v) => n + Math.max(0, v.hp) + Math.max(0, v.shield), 0);
      const strafed = { dealt: before - after, taken: hawkBefore - (hawk.hp + hawk.shield) };
      // On the far side of the Hawk from the player's camp, so the Hawk is the nearest target.
      const rangers = [0, 1, 2, 3].map((i) => s.spawn("ranger", 1, x - 3 + i * 1.5, z - 7, true, true));
      f.view.focusOn(x, z);
      f.select([hawk.id]);
      f.step(1.5);
      return { ...strafed, hawkHit: hawk.hp + hawk.shield < hawkBefore - strafed.taken, hawk: hawk.id, rangers: rangers.length };
    });
    assert.ok(fight.dealt > 0 && fight.taken === 0 && fight.hawkHit, `${viewport}: ${JSON.stringify(fight)}`);
    await page.waitForTimeout(400);
    await shot(page, `air-dogfight-${viewport}`);

    // 6. The Flak tile at a level 2 Command core: ready, then researching.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, hq = s.own(0).find((e) => e.type === "hq");
      hq.level = 2; hq.queue = [];
      for (const e of s.entities) if (e.team === 1 && e.kind === "unit") e.hp = 0;
      f.view.focusOn(hq.x, hq.z);
      f.select([hq.id]);
      f.step(0.1);
    });
    await dock("actions");
    const flak = page.locator('#commands [data-action="flak"]');
    await flak.waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.match(await flak.textContent(), /Flak guns/);
    const flakBox = await flak.boundingBox();
    if (mobile) assert.ok(flakBox.height >= 44, `${viewport}: Flak tile ${flakBox.height}px`);
    await flak[mobile ? "tap" : "click"]();
    await page.evaluate(() => window.__frontier.step(5));
    await page.waitForFunction(() => document.querySelector('#commands [data-action="flak"]')?.dataset.state === "busy", null, { timeout: TIMEOUT.step });
    report = await audit(page, "#commands", mobile);
    assert.deepEqual(report.small, [], `${viewport}: small text in the tiles`);
    assert.deepEqual(report.tiny, [], `${viewport}: small taps in the tiles`);
    assert.equal(report.wide, false, `${viewport}: no sideways scroll`);
    await shot(page, `air-flak-${viewport}`);

    // 7. The field guide for each flyer: portrait cell, name and the air paragraph.
    await page.evaluate((id) => window.__frontier.select([id]), fight.hawk);
    await page.evaluate(() => window.__frontier.step(0.05));
    await dock("selection");
    await tap("#field-guide");
    await page.locator("dialog.field-guide[open]").waitFor({ timeout: TIMEOUT.step });
    for (const type of ["kite", "hawk", "balloon", "glider"]) {
      await page.selectOption("#guide-entry", type);
      const entry = await page.evaluate(() => ({ text: document.querySelector("#guide-detail").textContent, portrait: !!document.querySelector("#guide-detail .portrait-art") }));
      assert.ok(entry.portrait && /Flyer: it flies straight/.test(entry.text), `${viewport}: guide ${type}`);
    }
    await page.selectOption("#guide-entry", "kite");
    report = await audit(page, "dialog.field-guide", mobile);
    assert.deepEqual(report.small, [], `${viewport}: small text in the guide`);
    await shot(page, `air-guide-${viewport}`);
    await page.keyboard.press("Escape");

    assert.deepEqual(errors, [], `${viewport}: page errors`);
    assert.deepEqual(badResponses, [], `${viewport}: failed requests`);
    await page.close();
  }

  // Each flyer in game, selected with its card, at 1440x900 and 390x844 (review screenshots).
  for (const viewport of ["desktop", "portrait"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "dunes");
    await page.selectOption("#enemy-faction", "mixed");
    await page.waitForFunction(() => window.__frontier.modelsReady, null, { timeout: TIMEOUT.models });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.view.preloadModels(["kite", "hawk", "balloon", "glider"]));
    await page.waitForFunction(() => ["kite", "hawk", "balloon", "glider"].every((t) => window.__frontier.view.models.has(t)), null, { timeout: TIMEOUT.models });
    for (const type of ["kite", "hawk", "balloon", "glider"]) {
      await page.evaluate((type) => {
        const f = window.__frontier, s = f.sim, hq = s.own(0).find((e) => e.type === "hq");
        s.aiEnabled = false;
        for (const e of s.own(0)) if (e.flying) e.hp = 0;
        const e = s.spawn(type, 0, hq.x + 10, hq.z - 10, true, true);
        e.angle = 2.4;
        f.step(0.3);
        f.view.focusOn(e.x, e.z + 2); f.view.zoom = 26; f.view.updateCamera();
        f.select([e.id]);
        f.step(0.05);
      }, type);
      if (mobile) { await tap('#dock-tabs [data-dock="selection"]'); }
      await page.waitForTimeout(500);
      await shot(page, `air-${type}-selected-${viewport}`);
    }
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
