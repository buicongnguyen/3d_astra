// Stage 3 terrain in the browser: a tap on a plateau sends a unit up the ramp, units on top are
// drawn at plateau height, effects and picking follow the ground, straight walls are drawn, at
// three viewports. High ground is shown: a gold ▲ by units on a plateau top (none below), the
// card line, the reach rings and a one-time hint. River crossings: the ford's marks, the hover
// label and tap notice, and the minimap ticks. Terrain rules you can see (16.2): the eye-slash
// mark and card line for a unit hidden from below, its hint, Barrage refused at an unseen deep
// top, ramp kill-zone ticks, and a unit wading the ford (card line, ability tile). W14: a site on a plateau
// without ramps shows a red ghost and the reason before the tap; deposits on a plateau top sit on it.
// TEST_URL=http://127.0.0.1:4231/ npm run test:terrain
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
await suite("terrain", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "dunes");
    await page.waitForFunction(() => window.__frontier.modelsReady && window.__frontier.sim.terrain.id === "dunes", null, { timeout: TIMEOUT.models });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    // A Ranger beside the player's own plateau (the mirrored one nearer team 0), and the camera on it.
    const setup = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, t = s.terrain, hq = s.own(0).find((e) => e.type === "hq");
      const p = t.plateaus.slice().sort((a, b) => Math.hypot(a.x - hq.x, a.z - hq.z) - Math.hypot(b.x - hq.x, b.z - hq.z))[0];
      s.visible[0].fill(1); s.explored[0].fill(1);
      // In front of the east ramp (Wave 3 integration). From straight below the centre both ramps are the same
      // distance away, so the route flipped on the last bits of the tapped point: a tap 1e-8 m west of the centre
      // (phone canvas geometry since the phone HUD pass) took the west ramp, and a unit that reaches a ramp from
      // its side can stall on the side edge and drop the order (sim issue, open item in wave-3.md).
      const ramp = p.ramps.slice().sort((a, b) => b.x - a.x)[0];
      const u = s.spawn("ranger", 0, ramp.x + 5, ramp.z);
      f.view.focusOn(p.x, p.z + 3); f.view.zoom = 26;
      f.step(0.1);
      f.select([u.id]);
      return { id: u.id, p: { x: p.x, z: p.z, r: p.r }, walls: s.entities.filter((e) => e.axis).length };
    });
    assert.ok(setup.walls > 0, "straight walls exist on Dunes");
    // Tap (or right-click) the middle of the plateau top: the order lands there.
    await page.waitForTimeout(300);
    const at = await page.evaluate(({ x, z }) => {
      const v = window.__frontier.view, r = v.renderer.domElement.getBoundingClientRect(), q = v.project(x, z, v.terrain.heightAt(x, z));
      return { x: r.left + q.x, y: r.top + q.y, picked: v.point(r.left + q.x, r.top + q.y) };
    }, setup.p);
    assert.ok(Math.hypot(at.picked.x - setup.p.x, at.picked.z - setup.p.z) < 1, `picking meets the raised ground: ${JSON.stringify(at.picked)}`);
    if (mobile) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y, { button: "right" });
    await page.waitForFunction((id) => window.__frontier.sim.get(id)?.orders.length > 0, setup.id, { timeout: TIMEOUT.step });
    const result = await page.evaluate(({ id, p }) => {
      const f = window.__frontier, s = f.sim;
      f.step(25);
      const u = s.get(id), o = f.view.objects.get(id);
      f.view.update(s, 0, f.selected, null);
      return { level: s.terrain.level(u.x, u.z), dist: Math.hypot(u.x - p.x, u.z - p.z), y: o.position.y, h: s.terrain.heightAt(u.x, u.z) };
    }, setup);
    assert.equal(result.level, 1, `${viewport}: the Ranger climbed the ramp (${result.dist.toFixed(1)} m from the centre)`);
    assert.ok(Math.abs(result.y - result.h) < 0.01 && result.y > 2, `${viewport}: drawn on top (${result.y})`);
    // High ground, read at a glance: the ▲ mark by the unit on top and none by a unit below, the
    // card line, the reach rings around the selected unit, then the one-time hint.
    const high = await page.evaluate(async ({ id, p }) => {
      const f = window.__frontier, s = f.sim, below = s.spawn("ranger", 0, p.x, p.z + p.r + 5);
      below.stance = "hold";
      f.select([id]);
      f.step(0.05);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const marks = f.view.tactics.snapshot(), near = (e) => marks.some((m) => m.style === 11 && Math.hypot(m.x - e.x, m.z - e.z) < 2);
      const line = document.querySelector("#selection-info .selection-activity");
      return { top: near(s.get(id)), below: near(below), line: line?.innerText, high: line?.classList.contains("high-ground"), fits: line && line.scrollWidth <= line.clientWidth + 1,
        size: line && parseFloat(getComputedStyle(line).fontSize), rings: marks.filter((m) => m.style === 2).map((m) => m.size).sort((a, b) => a - b), range: s.get(id).range };
    }, setup);
    assert.ok(high.top && !high.below, `${viewport}: ▲ by the unit on top only (${JSON.stringify(high)})`);
    assert.ok(high.high && /^▲ High ground: \+2 m range, \+20% damage/.test(high.line) && high.fits && high.size >= 11, `${viewport}: card line ${JSON.stringify(high)}`);
    assert.deepEqual(high.rings, [high.range, high.range + 2], `${viewport}: reach rings`);
    const hint = await page.waitForFunction(() => { const h = document.getElementById("fight-hint"); return !h.hidden && h.textContent.includes("High ground") && h.textContent; }, null, { timeout: TIMEOUT.step });
    assert.match(await hint.jsonValue(), /shoot farther, hit harder and see farther/);
    await page.evaluate(() => document.querySelector("#fight-hint .fh-close").click());
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => document.getElementById("fight-hint").hidden), `${viewport}: the hint is shown once`);
    // Hidden from below (16.2): the unit deep on the top gets an eye-slash beside its ▲ and a
    // second card line; a unit on the rim strip keeps the plain ▲. The card stays in its panel.
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const hidden = await page.evaluate(async ({ id, p }) => {
      const f = window.__frontier, s = f.sim, u = s.get(id);
      u.x = p.x; u.z = p.z; u.orders = []; u.stance = "hold";
      const rim = s.spawn("ranger", 0, p.x + p.r - 2, p.z); rim.stance = "hold";
      f.select([id]);
      f.step(0.05);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // The eye sits left of the ▲, both beside the vitals bar (wider on phones): up to ~3 m off the unit.
      const marks = f.view.tactics.snapshot(), near = (e, style) => marks.some((m) => m.style === style && Math.hypot(m.x - e.x, m.z - e.z) < 3.5);
      const line = document.querySelector("#selection-info .selection-hidden"), panel = document.querySelector(".selection-panel"), box = panel.getBoundingClientRect();
      const clipped = [...panel.querySelectorAll(".order-buttons button")].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect()).filter((b) => b.bottom > box.bottom + 1 || b.top < box.top - 1).length;
      const out = { eye: near(u, 12), rimHigh: near(rim, 11), rimEye: near(rim, 12), text: line?.innerText.trim(), size: line && parseFloat(getComputedStyle(line).fontSize),
        fits: !!line && line.scrollWidth <= line.clientWidth + 1, overflow: panel.scrollHeight > panel.clientHeight + 1, clipped };
      f.select([rim.id]);
      f.step(0.05);
      out.rimLine = !!document.querySelector("#selection-info .selection-hidden");
      f.select([id]);
      f.step(0.05);
      return out;
    }, setup);
    assert.ok(hidden.eye && hidden.rimHigh && !hidden.rimEye, `${viewport}: eye-slash by the deep unit only ${JSON.stringify(hidden)}`);
    assert.ok(hidden.text === "Hidden from below" && hidden.size >= 11 && hidden.fits && !hidden.rimLine, `${viewport}: hidden card line ${JSON.stringify(hidden)}`);
    assert.ok(!hidden.clipped && (!mobile || !hidden.overflow), `${viewport}: the card keeps its height ${JSON.stringify(hidden)}`);
    if (!mobile) {
      // The first hidden unit brings its own hint, once, after the high-ground one (hints keep a 12 s gap).
      const second = await page.waitForFunction(() => { const h = document.getElementById("fight-hint"); return !h.hidden && h.textContent.includes("seen from below") && h.textContent; }, null, { timeout: 25000 });
      assert.match(await second.jsonValue(), /Enemies must climb the ramp to fight them/);
      await page.evaluate(() => document.querySelector("#fight-hint .fh-close").click());
      // Barrage at the other plateau's deep top, which nobody on the team can see: refused, with the reason.
      const aim = await page.evaluate(async ({ p }) => {
        const f = window.__frontier, s = f.sim, t = s.terrain, q = t.plateaus.find((o) => o.x !== p.x || o.z !== p.z);
        const b = s.spawn("breaker", 0, q.x, q.z + q.r + 3); b.stance = "hold";
        f.view.focusOn(q.x, q.z + 3); f.view.zoom = 26;
        f.select([b.id]);
        f.step(0.05);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const v = f.view, r = v.renderer.domElement.getBoundingClientRect(), dz = q.z + q.r - 8, c = v.project(q.x, dz, t.heightAt(q.x, dz)); // a deep point 8 m inside the rim (the old centre depth): plateaus were enlarged, so the centre is out of Barrage reach from the foot
        return { x: r.left + c.x, y: r.top + c.y, hidden: s.hiddenTop({ x: q.x, z: dz }, 0) };
      }, setup);
      assert.ok(aim.hidden, "the far plateau top is out of sight");
      await page.click('[data-ability="barrage"]');
      await page.waitForFunction(() => window.__frontier.mode === "barrage", null, { timeout: TIMEOUT.step });
      await page.mouse.click(aim.x, aim.y);
      await page.waitForFunction(() => /Can't see up there/.test(document.getElementById("mode-banner").textContent), null, { timeout: TIMEOUT.step });
      await page.waitForFunction(() => window.__frontier.view.tactics.snapshot().some((m) => m.style === 3 && m.value === 0), null, { timeout: TIMEOUT.step });
      assert.equal(await page.evaluate(() => (window.__frontier.sim.strikes || []).length), 0, "no shell fired");
      await shot(page, `terrain-barrage-sight-${viewport}`);
      await page.keyboard.press("Escape");
    }
    // Ramp kill zones: red-orange stripes painted on each ramp, and a red tick on the minimap.
    const ramp = await page.evaluate(async ({ p }) => {
      const f = window.__frontier, s = f.sim, r = s.terrain.plateaus.find((o) => o.x === p.x && o.z === p.z).ramps[0];
      const l = Math.hypot(r.x - p.x, r.z - p.z), x = r.x + ((r.x - p.x) / l) * 1.5, z = r.z + ((r.z - p.z) / l) * 1.5;
      f.view.focusOn(x, z); f.view.zoom = 18;
      f.step(0.05);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const mm = document.getElementById("minimap"), k = (v) => (v + s.terrain.half) / s.terrain.size;
      return [...mm.getContext("2d").getImageData(Math.round(k(x) * mm.width), Math.round(k(z) * mm.height), 1, 1).data].slice(0, 3);
    }, setup);
    assert.ok(ramp[0] > 170 && ramp[1] < 150 && ramp[2] < 120, `${viewport}: red ramp tick on the minimap ${JSON.stringify(ramp)}`);
    await shot(page, `terrain-ramp-${viewport}`);
    // Building on high ground (bug 2026-11-25): every buildable type, finished and under construction, on the
    // plateau top and on low ground stands on the drawn ground (|y - heightAt| small, its box resting there) and
    // the camera sees it over the terrain; the build ghost aimed at the top is drawn on the top, not inside it.
    await page.evaluate(() => {
      // Fraction of points the camera sees over the drawn ground (a 0.1 m march along each sight line).
      window.__seen = (points) => {
        const f = window.__frontier, t = f.sim.terrain, cam = f.view.camera.position;
        return points.filter((q) => {
          const dx = q.x - cam.x, dy = q.y - cam.y, dz = q.z - cam.z, n = Math.ceil(Math.hypot(dx, dy, dz) / 0.1);
          for (let i = 1; i < n - 3; i++) if (cam.y + (dy * i) / n < t.heightAt(cam.x + (dx * i) / n, cam.z + (dz * i) / n) - 0.01) return false;
          return true;
        }).length / points.length;
      };
    });
    const sites = await page.evaluate(async ({ p }) => {
      const f = window.__frontier, s = f.sim, t = s.terrain, out = [];
      s.players[0].alloy = s.players[0].energy = 99999;
      for (const type of s.buildable(0))
        for (const where of ["top", "low"])
          for (const complete of [true, false]) {
            s.visible[0].fill(1);
            const at = s.findPlacement(type, 0, p.x, where === "top" ? p.z : p.z + p.r + 9);
            if (!at) { out.push({ type, where, none: s.placement(type, 0, p.x, p.z) }); continue; }
            const e = s.spawn(type, 0, at.x, at.z, complete);
            if (!complete) e.progress = 0.35;
            f.view.focusOn(at.x, at.z);
            f.step(0.05);
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const o = f.view.objects.get(e.id), V = o.position.constructor, lo = new V(Infinity, Infinity, Infinity), hi = new V(-Infinity, -Infinity, -Infinity), c = new V();
            o.traverse((m) => {
              if (!m.isMesh || !m.geometry || m.name === "ContactShadow") return;
              m.geometry.boundingBox || m.geometry.computeBoundingBox();
              const b = m.geometry.boundingBox;
              for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { c.set(x, y, z).applyMatrix4(m.matrixWorld); lo.min(c); hi.max(c); }
            });
            const pts = [0.3, 0.5, 0.7].flatMap((a) => [0.3, 0.5, 0.7].map((b) => ({ x: lo.x + (hi.x - lo.x) * a, y: hi.y - 0.05, z: lo.z + (hi.z - lo.z) * b })));
            out.push({ type, where, complete, level: t.level(at.x, at.z), h: t.heightAt(at.x, at.z), y: o.position.y, bottom: lo.y, top: hi.y, drawn: o.visible, seen: window.__seen(pts) });
            s.entities.splice(s.entities.indexOf(e), 1);
          }
      s.nav.rebuild(s.entities);
      f.step(0.05);
      return out;
    }, setup);
    assert.ok(sites.filter((r) => r.where === "top" && r.level === 1).length >= 8, `${viewport}: buildings on the plateau top ${JSON.stringify(sites)}`);
    for (const r of sites) {
      if (r.none !== undefined) continue;
      const label = `${viewport}: ${r.complete ? "finished" : "unfinished"} ${r.type} on the ${r.where} ${JSON.stringify(r)}`;
      assert.equal(r.level, r.where === "top" ? 1 : 0, label);
      assert.ok(Math.abs(r.y - r.h) < 0.01 && Math.abs(r.bottom - r.h) < 0.3 && r.top > r.h + 1, `${label}: on the drawn ground`);
      assert.ok(r.drawn && r.seen >= 0.8, `${label}: visible`);
    }
    // The build ghost, through the player's own path: a Harvester, the Barracks tile, then a pointer move (PC) or a
    // tap (phone) on the plateau top. It used a fixed 0.23 m and was drawn inside the plateau.
    const aim = await page.evaluate(async ({ p }) => {
      const f = window.__frontier, s = f.sim, v = f.view, w = s.own(0).find((e) => e.type === "worker");
      f.select([w.id]); f.step(0.05);
      v.focusOn(p.x, p.z); v.zoom = 26;
      document.querySelector('[data-action="barracks"]').click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = v.renderer.domElement.getBoundingClientRect(), q = v.project(p.x, p.z, v.terrain.heightAt(p.x, p.z));
      return { x: r.left + q.x, y: r.top + q.y, mode: f.mode };
    }, setup);
    assert.equal(aim.mode, "build", `${viewport}: build mode`);
    if (mobile) await page.touchscreen.tap(aim.x, aim.y); else await page.mouse.move(aim.x, aim.y);
    await page.waitForFunction(() => window.__frontier.view.preview.visible, null, { timeout: TIMEOUT.step });
    const ghost = await page.evaluate(() => {
      const f = window.__frontier, g = f.view.preview, t = f.sim.terrain, { x, y, z } = g.position, R = g.scale.x;
      const pts = [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].map(([a, b]) => ({ x: x + a * R, y: y + 0.045, z: z + b * R }));
      return { level: t.level(x, z), h: t.heightAt(x, z), y, seen: window.__seen(pts), ok: !f.sim.placement("barracks", 0, x, z) };
    });
    assert.ok(ghost.level === 1 && ghost.ok, `${viewport}: the ghost is on a valid top site ${JSON.stringify(ghost)}`);
    assert.ok(Math.abs(ghost.y - (ghost.h + 0.23)) < 0.01 && ghost.seen >= 0.8, `${viewport}: the ghost is drawn on the plateau top ${JSON.stringify(ghost)}`);
    await shot(page, `terrain-build-ghost-${viewport}`);
    await page.evaluate(() => document.getElementById("cancel-mode").click());
    await page.waitForFunction(() => window.__frontier.mode !== "build", null, { timeout: TIMEOUT.step });
    // Back to the hidden unit, selected, for the closing screenshot (mark and card line).
    await page.evaluate(({ id, p }) => { const f = window.__frontier; f.view.focusOn(p.x, p.z + 3); f.view.zoom = 26; f.select([id]); f.step(0.05); }, setup);
    if (mobile && await page.locator("html").getAttribute("data-dock") !== "selection") await page.evaluate(() => document.querySelector('button[data-dock="selection"]').click());
    await page.evaluate(frames);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${viewport}: no sideways scroll`);
    await shot(page, `terrain-dunes-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
  // W14: a plateau without ramps (Heartland) cannot be reached by a Harvester. The ghost aimed at its top turns
  // red and the build card says why before the tap (it used to show green, then refuse the order); Build here
  // stays off on phones. A deposit drawn on a plateau top sits on it (view.js createResource used y = 0).
  for (const viewport of ["desktop", "portrait"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "heartland");
    await page.waitForFunction(() => window.__frontier.modelsReady && window.__frontier.sim.terrain.id === "heartland", null, { timeout: TIMEOUT.models });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    const aim = await page.evaluate(async () => {
      const f = window.__frontier, s = f.sim, v = f.view, hq = s.own(0).find((e) => e.type === "hq"), w = s.own(0).find((e) => e.type === "worker");
      s.visible[0].fill(1); s.explored[0].fill(1);
      s.players[0].alloy = s.players[0].energy = 9999;
      const p = s.terrain.plateaus.filter((q) => !(q.ramps || []).length && q.r >= 5).sort((a, b) => Math.hypot(a.x - hq.x, a.z - hq.z) - Math.hypot(b.x - hq.x, b.z - hq.z))[0];
      // A Ranger on the top (as if dropped there) sees it, so the only thing in the way is the climb.
      s.spawn("ranger", 0, p.x + 2, p.z + 2).stance = "hold";
      f.select([w.id]); f.step(0.05);
      v.focusOn(p.x, p.z); v.zoom = 26;
      document.querySelector('[data-action="tower"]').click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = v.renderer.domElement.getBoundingClientRect(), q = v.project(p.x, p.z, v.terrain.heightAt(p.x, p.z));
      const crystal = v.createResource({ id: -77, type: "alloy", x: p.x, z: p.z });
      const crystalY = crystal.position.y, h = v.terrain.heightAt(p.x, p.z);
      v.scene.remove(crystal); v.resourceObjects.delete(-77);
      return { x: r.left + q.x, y: r.top + q.y, mode: f.mode, crystalY, h };
    });
    assert.equal(aim.mode, "build", `${viewport}: build mode`);
    assert.ok(aim.h > 2 && Math.abs(aim.crystalY - aim.h) < 0.01, `${viewport}: a deposit on a plateau top sits on it ${JSON.stringify(aim)}`);
    if (mobile) await page.touchscreen.tap(aim.x, aim.y); else await page.mouse.move(aim.x, aim.y);
    // The reason: on the phone build card, beside the pointer on PC.
    const where = mobile ? "construction-message" : "hover-label";
    await page.waitForFunction((id) => window.__frontier.view.preview.visible && document.getElementById(id)?.textContent === "The Harvester cannot reach that site.", where, { timeout: TIMEOUT.step });
    const ghost = await page.evaluate((id) => {
      const f = window.__frontier, g = f.view.preview, { x, z } = g.position, msg = document.getElementById(id);
      return { level: f.sim.terrain.level(x, z), placement: f.sim.placement("tower", 0, x, z), color: g.material.color.getHex(), confirm: document.getElementById("confirm-build").disabled,
        shown: !!msg && !msg.hidden && msg.getBoundingClientRect().height > 0, size: msg && parseFloat(getComputedStyle(msg).fontSize) };
    }, where);
    assert.ok(ghost.level === 1 && ghost.placement === "", `${viewport}: a site the placement rule allows ${JSON.stringify(ghost)}`);
    assert.ok(ghost.color === 0xef7660, `${viewport}: the ghost is red ${JSON.stringify(ghost)}`);
    assert.ok(ghost.shown && ghost.size >= 11, `${viewport}: the reason is shown ${JSON.stringify(ghost)}`);
    if (mobile) assert.ok(ghost.confirm, `${viewport}: Build here is off`);
    await shot(page, `terrain-unreachable-site-${viewport}`);
    // Back on open ground near the base the ghost turns green again.
    const open = await page.evaluate(async () => {
      const f = window.__frontier, s = f.sim, v = f.view, hq = s.own(0).find((e) => e.type === "hq");
      const x = hq.x + (hq.x > 0 ? -10 : 10), z = hq.z + (hq.z > 0 ? -8 : 8);
      v.focusOn(x, z); f.step(0.05);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = v.renderer.domElement.getBoundingClientRect(), q = v.project(x, z, 0);
      return { x: r.left + q.x, y: r.top + q.y };
    });
    if (mobile) await page.touchscreen.tap(open.x, open.y); else await page.mouse.move(open.x, open.y);
    await page.waitForFunction((id) => window.__frontier.view.preview.material.color.getHex() === 0x92ebc5 && (id === "construction-message" || document.getElementById(id).hidden), where, { timeout: TIMEOUT.step });
    await page.evaluate(() => document.getElementById("cancel-mode").click());
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
  // River crossings on Meridian Riverlands: the ford is dressed as a crossing, a pointer (or a tap
  // with nothing selected) on a crossing names it, and the minimap marks all three.
  for (const viewport of ["desktop", "portrait"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "riverlands");
    await page.waitForFunction(() => window.__frontier.modelsReady && window.__frontier.sim.terrain.id === "riverlands", null, { timeout: TIMEOUT.models });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    await page.evaluate(async () => {
      const f = window.__frontier, s = f.sim, v = f.view;
      s.visible[0].fill(1); s.explored[0].fill(1);
      f.select([]);
      v.focusOn(-11, 0); v.zoom = 40;
      f.step(0.05);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    // The minimap redraws on its own beat (a fast machine can read it before its first paint after
    // the reveal: all pixels 0): wait for the ford tick, then read everything once.
    await page.waitForFunction(() => {
      const s = window.__frontier.sim, mm = document.getElementById("minimap"), k = (v) => (v + s.terrain.half) / s.terrain.size;
      return Math.min(...[...mm.getContext("2d").getImageData(Math.round(k(-2) * mm.width), Math.round(k(0) * mm.height), 1, 1).data].slice(0, 3)) > 180;
    }, null, { timeout: TIMEOUT.step }).catch(() => {});
    const spots = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, v = f.view;
      const r = v.renderer.domElement.getBoundingClientRect(), at = (x, z) => { const q = v.project(x, z, 0); return { x: r.left + q.x, y: r.top + q.y }; };
      const mm = document.getElementById("minimap"), ctx = mm.getContext("2d"), k = (v) => (v + s.terrain.half) / s.terrain.size;
      const pixel = (x, z) => [...ctx.getImageData(Math.round(k(x) * mm.width), Math.round(k(z) * mm.height), 1, 1).data].slice(0, 3);
      return { ford: at(-1.5, 1.5), bridge: at(-22, 0.5), marks: !!v.environment?.root.getObjectByName("ford-marks"), fordTick: pixel(-2, 0), bridgeTick: pixel(-22, -2), water: pixel(-12, 0) };
    });
    assert.ok(spots.marks, `${viewport}: the ford has its posts, cairns and stones`);
    const bright = (c) => Math.min(...c) > 180;
    assert.ok(bright(spots.fordTick) && bright(spots.bridgeTick) && !bright(spots.water), `${viewport}: minimap ticks ${JSON.stringify(spots)}`);
    if (mobile) {
      await page.touchscreen.tap(spots.ford.x, spots.ford.y);
      await page.waitForFunction(() => document.getElementById("notice").textContent.startsWith("Ford:"), null, { timeout: TIMEOUT.step });
    } else {
      for (const [where, text] of [["ford", "Ford: infantry and vehicles can cross"], ["bridge", "Bridge: infantry and vehicles can cross"]]) {
        await page.mouse.move(spots[where].x, spots[where].y);
        await page.waitForFunction((t) => { const l = document.getElementById("hover-label"); return !l.hidden && l.textContent === t; }, text, { timeout: TIMEOUT.step });
      }
    }
    await shot(page, `terrain-riverlands-${viewport}`);
    // A unit wading the ford (16.2): its card says it is slowed with no abilities, and its ability tile why.
    const ford = await page.evaluate(async () => {
      const f = window.__frontier, s = f.sim, u = s.spawn("ranger", 0, 0.5, 1);
      u.stance = "hold";
      f.view.focusOn(0, 2); f.view.zoom = 24;
      f.select([u.id]);
      f.step(0.05);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const line = document.querySelector("#selection-info .selection-activity"), tile = document.querySelector('[data-ability="focus"]');
      return { inFord: s.inFord(u), line: line?.innerText, cls: line?.classList.contains("in-ford"), fits: !!line && line.scrollWidth <= line.clientWidth + 1,
        size: line && parseFloat(getComputedStyle(line).fontSize), tile: tile?.querySelector(".ability-status")?.textContent, disabled: tile?.disabled };
    });
    assert.ok(ford.inFord && ford.cls && /^In the ford/.test(ford.line) && ford.fits && ford.size >= 11, `${viewport}: ford card line ${JSON.stringify(ford)}`);
    assert.ok(ford.tile === "In the ford" && ford.disabled, `${viewport}: ford ability tile ${JSON.stringify(ford)}`);
    if (mobile && await page.locator("html").getAttribute("data-dock") !== "selection") await page.evaluate(() => document.querySelector('button[data-dock="selection"]').click());
    await page.waitForTimeout(200);
    await shot(page, `terrain-ford-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
