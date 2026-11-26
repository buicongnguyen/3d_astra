// Faction dress (visual round V) in the built game, at 1440x900, 390x844 and 844x390:
//  - an all-Meridian skirmish fetches no dress; choosing Ashfall fetches dress-ashfall.glb (and only it) before Start;
//  - every shared model of the Ashfall side wears it, the Meridian side wears none, no part was left off for want of a
//    team mesh (WorldView.dressSkipped), and only team-paint meshes differ by side (the hull, baked and glow-free
//    batches stay shared: no new draw), the same number of draws with the dress on and off;
//  - vitals bars stay above the dressed models; a mirror match (Ashfall on both sides) shares the dressed geometry.
// Screenshots: test-results/faction-dress-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const TYPES = ["worker", "vanguard", "ranger", "medic", "engineer", "antitank", "breaker", "tank", "hq", "barracks", "foundry", "relay", "tower"];
const browser = await launchBrowser();
await suite("faction-dress", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport, { timeout: TIMEOUT.models });
    const fetched = [];
    page.on("request", (r) => { const m = r.url().match(/\/models\/(dress-[a-z]+)\.glb/); if (m) fetched.push(m[1]); });
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "riverlands");
    await ready();
    assert.deepEqual(fetched, [], `${viewport}: an all-Meridian setup fetches no dress`);
    await page.selectOption("#enemy-faction", "ashfall");
    await page.waitForFunction(() => window.__frontier.modelsReady && window.__frontier.sim.factions[1] === "ashfall" && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
    assert.deepEqual(fetched, ["dress-ashfall"], `${viewport}: only the Ashfall dress, before Start`);
    await page.evaluate(() => document.querySelector("#start").scrollIntoView({ block: "center" }));
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });

    // Every dressed type for both sides, in two ranks on open ground; nothing ticks.
    const report = await page.evaluate((types) => {
      const f = window.__frontier, s = f.sim, v = f.view;
      f.hold = true; s.aiEnabled = false; f.select([]);
      s.visible[0].fill(1); s.explored[0].fill(1);
      s.entities = s.entities.filter((e) => e.kind !== "unit" || e.type === "kite");
      const ids = [];
      for (let team = 0; team < 2; team++) types.filter((t) => !["hq", "barracks", "foundry", "relay", "tower"].includes(t)).forEach((t, i) => {
        const e = s.spawn(t, team, -16 + i * 3.2, team ? -6 : 6, true, true); e.angle = team ? 0 : Math.PI; ids.push(e.id);
      });
      v.update(s, 0, f.selected, null);
      // Each model's team-paint meshes by side, and the rest.
      const meshes = (root) => { const out = []; root.userData.model.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
      const byType = {};
      for (const e of s.entities) {
        const root = v.objects.get(e.id);
        if (!root || !types.includes(e.type) || e.team > 1) continue;
        (byType[e.type] ||= {})[e.team] = meshes(root).map((o) => ({ paint: !!o.material.name.startsWith("Team"), glow: o.material.name.startsWith("TeamGlow"), geometry: o.geometry.id, material: o.material.id, rgba: o.geometry.getAttribute("color")?.itemSize === 4 }));
      }
      // Bars over the dressed units' own tops.
      const low = [];
      for (const id of ids) {
        const root = v.objects.get(id), e = s.get(id);
        if (e.team !== 1) continue;
        let top = 0;
        root.userData.model.updateMatrixWorld(true);
        root.userData.model.traverse((o) => {
          if (!o.isMesh) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
          top = Math.max(top, b.max.y - root.position.y);
        });
        if (root.userData.bar.position.y < top) low.push(`${e.type} bar ${root.userData.bar.position.y.toFixed(2)} < top ${top.toFixed(2)}`);
      }
      return { dressOn: Object.fromEntries(v.dressOn), skipped: [...v.dressSkipped], byType, low };
    }, TYPES);
    for (const type of TYPES) {
      assert.equal(report.dressOn[`${type}-1`], "ashfall", `${viewport}: ${type} of the Ashfall side is dressed`);
      assert.equal(report.dressOn[`${type}-0`], undefined, `${viewport}: ${type} of the Meridian side is not`);
      const sides = report.byType[type];
      if (!sides?.[0] || !sides?.[1]) continue; // a building type the start set-up does not field on one side
      const [own, foe] = [sides[0], sides[1]];
      assert.equal(own.length, foe.length, `${viewport}: ${type} keeps its meshes (no mesh added)`);
      for (let i = 0; i < own.length; i++) {
        if (own[i].paint) continue;
        assert.equal(own[i].geometry, foe[i].geometry, `${viewport}: ${type}'s unpainted parts share one geometry on both sides (one batch)`);
        assert.equal(own[i].material, foe[i].material, `${viewport}: ${type}'s unpainted parts share one material`);
      }
      assert.ok(foe.some((m, i) => m.paint && m.geometry !== own[i].geometry), `${viewport}: ${type}'s team paint carries the dress`);
      // Its team paint is RGBA (own-colour parts flagged by alpha); the Meridian side's stays RGB, as modelled.
      assert.ok(foe.filter((m) => m.paint && !m.glow).every((m) => m.rgba) && own.every((m) => !m.rgba), `${viewport}: ${type} colour layout`);
    }
    assert.deepEqual(report.skipped, [], `${viewport}: no dress part was left off`);
    assert.deepEqual(report.low, [], `${viewport}: bars above the dressed models`);

    // The same frame with the dress on and taken off: the same draws.
    const draws = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, v = f.view, r = v.renderer;
      v.focusOn(-3, 0); v.zoom = 34; v.updateCamera();
      const count = () => { r.info.reset(); r.info.autoReset = false; v.update(s, 0, f.selected, null); const n = r.info.render.calls; r.info.autoReset = true; return n; };
      count();
      const on = count();
      const saved = new Map(v.factionDress);
      v.factionDress.clear(); v.dressDirty = true;
      count();
      const off = count();
      for (const [k, x] of saved) v.factionDress.set(k, x);
      v.dressDirty = true;
      count();
      return { on, off, again: count() };
    });
    assert.equal(draws.on, draws.off, `${viewport}: draws with the dress ${draws.on}, without ${draws.off}`);
    assert.equal(draws.again, draws.on, `${viewport}: the dress comes back the same`);
    await page.evaluate(() => { const f = window.__frontier, v = f.view; v.focusOn(-3, 0); v.zoom = 26; v.updateCamera(); v.update(f.sim, 0, f.selected, null); });
    await shot(page, `faction-dress-ashfall-${viewport}`);

    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }

  // Mirror: the player commands Ashfall against an Ashfall mirror. Both sides wear the same dressed geometry.
  const { page, goto, ready, tap, errors } = await openPage(browser, "desktop", { timeout: TIMEOUT.models });
  await goto();
  await ready();
  await tap('[data-mode="skirmish"]');
  await page.evaluate(() => document.querySelector("#player-faction").scrollIntoView({ block: "center" }));
  await page.selectOption("#player-faction", "ashfall");
  await page.selectOption("#enemy-faction", "mirror");
  await page.waitForFunction(() => window.__frontier.modelsReady && window.__frontier.sim.factions[0] === "ashfall" && window.__frontier.sim.factions[1] === "ashfall" && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
  await page.evaluate(() => document.querySelector("#start").scrollIntoView({ block: "center" }));
  await tap("#start");
  await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
  const mirror = await page.evaluate(() => {
    const f = window.__frontier, s = f.sim, v = f.view;
    f.hold = true; s.aiEnabled = false;
    const a = s.spawn("ranger", 0, -6, 6, true, true), b = s.spawn("ranger", 1, -6, -6, true, true);
    v.update(s, 0, f.selected, null);
    const paint = (id) => { const out = []; v.objects.get(id).userData.model.traverse((o) => { if (o.isMesh && o.material.name.startsWith("Team")) out.push(o.geometry.id); }); return out; };
    return { a: paint(a.id), b: paint(b.id), own: v.dressOn.get("ranger-0"), foe: v.dressOn.get("ranger-1") };
  });
  assert.equal(mirror.own, "ashfall");
  assert.equal(mirror.foe, "ashfall");
  assert.deepEqual(mirror.a, mirror.b, "a mirror match shares one dressed geometry per part");
  assert.deepEqual(errors, []);
  await shot(page, "faction-dress-mirror-desktop");
  await page.close();
}, { browser });
