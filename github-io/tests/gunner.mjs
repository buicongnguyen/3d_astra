// Browser suite of the Gunner team (AAA round 2, W1-B), on the two phone viewports: at the phone's
// start zoom the Gunner is at least 28 px tall (the rule of tests/feel.mjs), its model loads and
// draws as the full unit (not the stand-in), a Pinned unit gets exactly one more draw call (the status
// icon batch) and a real fight pins and shows its icons. Unit rules: tests/gunner.test.js.
// Run against a built game: TEST_URL=http://127.0.0.1:<port>/ npm run test:gunner
// (the screenshots of the fight go to test-results/gunner-<viewport>.png).
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
await suite("gunner", async () => {
  for (const viewport of ["portrait", "landscape"]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport);
    await goto(); await ready(); await tap("#start");
    // The model is not part of a Classic match (the Expanded roster of W1-A declares it): load it like a flyer.
    await page.evaluate(() => window.__frontier.view.preloadModels(["gunner"]));
    await page.waitForFunction(() => window.__frontier.view.models.has("gunner"), null, { timeout: TIMEOUT.models });

    // 1. Size: the Gunner at the phone start zoom, projected as tests/feel.mjs does.
    const size = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, v = f.view;
      f.hold = true;
      s.aiEnabled = false; s.visible[0].fill(1); s.explored[0].fill(1);
      v.focusOn(0, 0); v.zoom = v.defaultZoom; v.updateCamera();
      const e = s.spawn("gunner", 0, 0, 0);
      v.update(s, 0, new Set(), null);
      const root = v.objects.get(e.id), m = root.userData.model;
      let min = Infinity, max = -Infinity;
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          const p = o.position.clone().set(x, y, z).applyMatrix4(o.matrixWorld).project(v.camera);
          min = Math.min(min, p.y); max = Math.max(max, p.y);
        }
      });
      return {
        pixels: (max - min) * v.renderer.domElement.getBoundingClientRect().height / 2, scale: root.userData.readabilityScale,
        fallback: m.name === "FallbackFlyer", legs: root.userData.legs.length, rig: !!root.userData.barrel, id: e.id,
      };
    });
    console.log(viewport, "Gunner at the start zoom:", JSON.stringify(size));
    assert.ok(size.pixels >= 28 - 1e-9, `${viewport}: the Gunner is ${size.pixels.toFixed(1)} px tall`);
    assert.equal(size.fallback, false, "the full model, not the stand-in");
    assert.equal(size.legs, 2, "one leg pivot pair for the whole team");
    assert.equal(size.rig, true, "the barrel rig");

    // 2. The pin icon: a pinned unit adds exactly one draw call, and none without a status.
    const icon = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, v = f.view;
      const target = s.spawn("scrapper", 1, 6, 0);
      v.update(s, 0, new Set(), null);
      const plugin = v.plugins.list.find((p) => "born" in p && "kicks" in p);
      const draws = () => { v.update(s, 0.016, new Set(), null); return v.renderer.info.render.calls; };
      const before = draws(), builtBefore = !!plugin.mesh;
      s.applyStatus(target, "pinned", 5);
      const during = draws();
      const during2 = draws();
      const count = plugin.mesh.geometry.instanceCount;
      const up = plugin.place.array[1], bar = v.objects.get(target.id).userData.bar.position.y;
      s.clearStatus(target, "pinned");
      s.sweepStatuses();
      const after = draws();
      return { before, during, during2, after, count, builtBefore, built: !!plugin.mesh, visibleAfter: plugin.mesh.visible, up, bar };
    });
    console.log(viewport, "pin icon draws:", JSON.stringify(icon));
    assert.equal(icon.builtBefore, false, "no status, nothing built");
    assert.equal(icon.count, 1);
    assert.equal(icon.during - icon.before, 1, "one draw call for the icon batch");
    assert.equal(icon.during2, icon.during, "stable");
    assert.equal(icon.after, icon.before, "back to the same draws once the pin is gone");
    assert.equal(icon.visibleAfter, false);
    assert.ok(icon.up > icon.bar, "the icon rides above the vitals bar");

    // 3. A real fight: six Gunners against a Scrapper rush. It pins, and every pinned unit in sight shows an icon.
    const fight = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, v = f.view;
      for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
      s.tick(0.05);
      s.players[0].autocast = true;
      const guns = Array.from({ length: 6 }, (_, i) => s.spawn("gunner", 0, -5 + (i % 3) * 2.2, -6 - Math.floor(i / 3) * 2.2));
      const rush = Array.from({ length: 10 }, (_, i) => s.spawn("scrapper", 1, -6 + (i % 5) * 1.9, 9 + Math.floor(i / 5) * 1.9));
      s.issue(rush.map((u) => u.id), { type: "attackmove", x: 0, z: -8 });
      v.focusOn(0, 0); v.zoom = v.defaultZoom * 0.55; v.updateCamera();
      f.select(guns.map((g) => g.id));
      let seen = 0, icons = 0, pinnedSeen = 0;
      for (let t = 0; t < 8; t += 0.5) {
        f.step(0.5);
        v.update(s, 0.016, f.selected, null);
        const plugin = v.plugins.list.find((p) => "born" in p && "kicks" in p);
        const pinned = s.entities.filter((e) => e.fx?.pinned > s.time && v.objects.get(e.id)?.visible).length;
        if (pinned) { seen++; pinnedSeen = Math.max(pinnedSeen, pinned); }
        if (plugin.mesh?.visible) icons = Math.max(icons, plugin.mesh.geometry.instanceCount);
        if (pinned && plugin.mesh.geometry.instanceCount !== pinned) return { error: `${pinned} pinned in sight, ${plugin.mesh.geometry.instanceCount} icons at ${t}` };
      }
      return { seen, icons, pinnedSeen, scrappers: rush.filter((u) => u.hp > 0).length, gunners: guns.filter((g) => g.hp > 0).length };
    });
    console.log(viewport, "fight:", JSON.stringify(fight));
    assert.equal(fight.error, undefined, fight.error);
    assert.ok(fight.seen > 0 && fight.icons > 0, "the guns pin the rush and the icons show");
    await page.evaluate(() => { const f = window.__frontier; f.step(1.2); f.view.update(f.sim, 0.016, f.selected, null); });
    await shot(page, `gunner-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }
}, { browser });
