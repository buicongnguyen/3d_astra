// Close view (H3b, src/close-view.js) in the built game, at 1440x900 and 390x844:
//  - normal play fetches no detail file and never loads the close-view module; draws are unchanged;
//  - window.__frontier.closeView(true, x, z) loads public/models/detail/*, and units within the radius draw their
//    detail model (normal parts parked, detail parts batched) while units beyond it keep the normal model;
//  - the detail follows the normal model: turret pose, shader-bone pose, hit-flash tint, selection ring;
//  - hysteresis (enter 25 m, leave 28.75 m), the governor's smaller radius, and turning it off restores the exact
//    normal frame (same draws, same pixels);
//  - phone (390x844) budget: at most 30 extra draws with every batch-1 type close.
// Screenshots: test-results/close-view-*.png (SHOTS=<dir> writes the review set there too).
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { launchBrowser, openPage, suite, TIMEOUT } from "./lib/harness.mjs";

const TYPES = ["ranger", "vanguard", "antitank", "tank", "worker", "kite"];
const PHONE_BUDGET = 30;
// Redrawing one frozen frame can move a handful of edge pixels by a step or two (antialiasing on a busy GPU: up to
// ~10 seen locally); a real change (a swapped model, a missed part) moves thousands.
const NOISE = 60;
const shots = process.env.SHOTS || null;
if (shots) mkdirSync(shots, { recursive: true });
const browser = await launchBrowser();

await suite("close-view", async () => {
  for (const viewport of ["desktop", "portrait"]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport, { timeout: TIMEOUT.models });
    const detailFetches = [];
    page.on("request", (r) => { if (/\/models\/detail\//.test(r.url())) detailFetches.push(r.url()); });
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "riverlands");
    await ready();
    await page.evaluate(() => document.querySelector("#start").scrollIntoView({ block: "center" }));
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    // The Kite is not a core model: parse it in the background, as a match with flyers does.
    await page.evaluate(() => window.__frontier.view.preloadModels(["kite"]));
    // Late assets (ground detail layers, effect sheets) must be in before the reference frame is drawn.
    await page.waitForLoadState("networkidle", { timeout: TIMEOUT.models });

    // Each batch-1 type for both sides: one near the close camera (the centre of a dry patch near the middle of the
    // map), one 40 m away. Nothing ticks.
    const ids = await page.evaluate((types) => {
      const f = window.__frontier, s = f.sim, t = f.view.terrain;
      let cx = 0, cz = 0;
      const dry = (x, z) => { if (t.inWater(x, z, 18)) return false; for (let dx = -10; dx <= 10; dx += 2) for (let dz = -6; dz <= 6; dz += 2) if (!t.canStand(x + dx, z + dz, 1) || t.inWater(x + dx, z + dz, 1)) return false; return true; };
      search: for (let r = 0; r < 60; r += 2) for (let k = 0; k < 16; k++) {
        const x = Math.round(Math.cos(k * Math.PI / 8) * r), z = Math.round(Math.sin(k * Math.PI / 8) * r);
        if (dry(x, z)) { cx = x; cz = z; break search; }
      }
      f.hold = true; s.aiEnabled = false; f.select([]);
      s.visible[0].fill(1); s.explored[0].fill(1);
      s.entities = s.entities.filter((e) => e.kind !== "unit");
      const near = [], far = [];
      for (let team = 0; team < 2; team++) types.forEach((type, i) => {
        const a = s.spawn(type, team, cx - 8 + i * 3.2, cz + (team ? -4 : 4), true, true); a.angle = team ? 0 : Math.PI; near.push(a.id);
        const b = s.spawn(type, team, cx - 8 + i * 3.2, cz + (team ? -44 : 44), true, true); far.push(b.id);
      });
      return { near, far, cx, cz };
    }, TYPES);
    const frame = () => page.evaluate(() => {
      const f = window.__frontier, s = f.sim, v = f.view, r = v.renderer;
      r.info.reset(); r.info.autoReset = false;
      v.update(s, 0, f.selected, null);
      const n = r.info.render.calls; r.info.autoReset = true;
      return n;
    });
    const camera = (x, z, zoom, pitch = null, yaw = 0) => page.evaluate(([x, z, zoom, pitch, yaw]) => {
      const v = window.__frontier.view;
      v.setPitch(pitch); v.yaw = yaw; v.focusOn(x, z); v.zoom = zoom; v.updateCamera();
    }, [x, z, zoom, pitch, yaw]);
    // Canvas captures: the frame is drawn and read back in one task (no game-loop frame in between), and the loop's
    // own frames run with dt 0 from here on (cosmetic clocks hold), so the same state draws the same pixels.
    await page.evaluate(() => {
      const v = window.__frontier.view, real = v.update;
      v.update = function (sim, dt, ...rest) { return real.call(this, sim, 0, ...rest); };
    });
    const png = async (name) => {
      const data = await page.evaluate((name) => {
        const f = window.__frontier, v = f.view, r = v.renderer, gl = r.getContext();
        v.update(f.sim, 0, f.selected, null);
        const px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px);
        (window.__snaps ||= {})[name] = px;
        return r.domElement.toDataURL("image/png");
      }, name);
      const file = Buffer.from(data.split(",")[1], "base64");
      mkdirSync("test-results", { recursive: true });
      writeFileSync(`test-results/close-view-${name}-${viewport}.png`, file);
      if (shots) writeFileSync(`${shots}/${name}-${viewport}.png`, file);
    };
    const differ = (a, b) => page.evaluate(([a, b]) => {
      const x = window.__snaps[a], y = window.__snaps[b];
      if (x.length !== y.length) return -1;
      let n = 0;
      for (let i = 0; i < x.length; i += 4) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2]) n++;
      return n;
    }, [a, b]);

    // Normal play: the RTS camera over both groups.
    await camera(ids.cx - 1, ids.cz, 30);
    await frame();
    const normal = await frame();
    await png("normal-before");
    await png("normal-repeat");
    const noise = await differ("normal-before", "normal-repeat");
    assert.ok(noise <= NOISE, `${viewport}: the capture is deterministic (${noise} pixels differ between two draws of one frame)`);
    assert.equal(await page.evaluate(() => window.__frontier.view.closeView), null, `${viewport}: no close view in normal play`);
    assert.deepEqual(detailFetches, [], `${viewport}: normal play fetches no detail model`);

    // Close view on at the patch centre: the detail files load, near units swap, far units keep the normal model.
    const info = await page.evaluate(([x, z]) => window.__frontier.closeView(true, x, z), [ids.cx, ids.cz]);
    assert.equal(info.failed, null, `${viewport}: detail files load`);
    assert.deepEqual(info.ready, [...TYPES].sort(), `${viewport}: every batch-1 detail model is ready`);
    await frame();
    const close = await frame();
    const state = await page.evaluate(({ near, far }) => {
      const f = window.__frontier, v = f.view;
      const look = (id) => {
        const u = v.objects.get(id).userData, lod = u.lod;
        return { type: u.type, shown: !!lod?.detail.visible, parked: lod ? lod.base.every((o) => o.layers.mask === 1 << 2) : false,
          detailMeshes: lod ? lod.meshes.length : 0, unpaired: lod ? lod.meshes.filter(([s]) => !s).length : 0 };
      };
      return { near: near.map(look), far: far.map(look), info: f.closeInfo };
    }, ids);
    for (const n of state.near) {
      assert.ok(n.shown && n.parked && n.detailMeshes > 0, `${viewport}: near ${n.type} draws its detail model (${JSON.stringify(n)})`);
      assert.equal(n.unpaired, 0, `${viewport}: every ${n.type} detail part follows a normal part`);
    }
    for (const n of state.far) assert.ok(!n.shown, `${viewport}: far ${n.type} keeps its normal model`);
    assert.equal(state.info.near, ids.near.length, `${viewport}: ${state.info.near} units near`);
    assert.deepEqual(state.info.types, [...TYPES].sort());
    const extra = close - normal;
    console.log(`  ${viewport}: draws normal ${normal}, close view ${close} (${extra >= 0 ? "+" : ""}${extra})`);
    if (viewport === "portrait") assert.ok(extra <= PHONE_BUDGET, `${viewport}: ${extra} extra draws > ${PHONE_BUDGET}`);
    await png("close-rts");

    // The detail follows the normal model: turret, shader bones, hit flash, selection ring.
    const follow = await page.evaluate(({ near }) => {
      const f = window.__frontier, s = f.sim, v = f.view;
      const tankId = near.find((id) => s.get(id).type === "tank" && s.get(id).team === 0);
      const rangerId = near.find((id) => s.get(id).type === "ranger" && s.get(id).team === 0);
      const tank = v.objects.get(tankId).userData, ranger = v.objects.get(rangerId).userData;
      const aim = tank.turret.rotation.y; // the turret's own aim, put back after
      tank.turret.rotation.y = 0.9;
      const hot = [3, 3, 3]; // a per-part tint, as the hit flash, wrecks and rank paint write it (entity-batches.js)
      for (const o of ranger.lod.base) o.userData.tint = hot;
      f.select([rangerId]);
      v.update(s, 0, f.selected, null);
      const turret = tank.lod.detail.getObjectByName("TurretRig");
      const rigged = ranger.lod.meshes.filter(([, d]) => d.geometry.getAttribute("aRig"));
      const out = {
        turret: turret.rotation.y,
        motion: rigged.length > 0 && rigged.every(([, d]) => d.userData.motion === ranger.rig.motion),
        tint: ranger.lod.meshes.every(([, d]) => d.userData.tint?.[0] === 3),
        ring: ranger.ring.visible,
      };
      for (const o of ranger.lod.base) delete o.userData.tint;
      tank.turret.rotation.y = aim;
      f.select([]);
      v.update(s, 0, f.selected, null);
      out.untinted = ranger.lod.meshes.every(([, d]) => (d.userData.tint?.[0] ?? 1) === 1);
      return out;
    }, ids);
    assert.ok(Math.abs(follow.turret - 0.9) < 1e-6, `${viewport}: the detail turret turns with the normal one`);
    assert.ok(follow.motion, `${viewport}: rigged detail parts read the unit's shader-bone pose`);
    assert.ok(follow.tint && follow.untinted, `${viewport}: a part tint (hit flash, wreck, rank paint) reaches the detail and clears`);
    assert.ok(follow.ring, `${viewport}: the selection ring shows on a detailed unit`);

    // Hysteresis: in at 25 m, out past 28.75 m; the governor's rescue level shrinks the radius.
    const edge = await page.evaluate(({ near, cx, cz }) => {
      const f = window.__frontier, s = f.sim, v = f.view, id = near[0], e = s.get(id), x0 = e.x, z0 = e.z;
      const at = (d) => { e.x = cx + d; e.z = cz; v.update(s, 0, f.selected, null); return !!v.objects.get(id).userData.lod?.detail.visible; };
      const out = { at20: at(20), at27: at(27), at30: at(30), back27: at(27), back24: at(24) };
      v.setCloseLevel("rescue");
      out.rescueRadius = f.closeInfo.radius;
      out.rescue24 = at(24);
      v.setCloseLevel("full");
      out.full24 = at(24);
      e.x = x0; e.z = z0; v.update(s, 0, f.selected, null);
      return out;
    }, ids);
    assert.deepEqual(edge, { at20: true, at27: true, at30: false, back27: false, back24: true, rescueRadius: 25 * 0.45, rescue24: false, full24: true },
      `${viewport}: hysteresis and governor radius (${JSON.stringify(edge)})`);

    // Draws with every type both near (detail) and just past the radius (normal), with close view on and off, in two
    // framings: the close camera (the phone budget: what it sees fits inside the radius, so only near units are on
    // screen) and the wide RTS camera pulled back over both groups (the worst case: both batches of every type drawn).
    const split = (framing) => page.evaluate(async ({ far, cx, cz, framing }) => {
      const f = window.__frontier, s = f.sim, v = f.view, r = v.renderer;
      v.setPitch(framing.pitch); v.yaw = 0; v.focusOn(cx, cz); v.zoom = framing.zoom; v.updateCamera();
      const m = v.camera.matrixWorld.elements, len = Math.hypot(m[8], m[10]), dx = -m[8] / len, dz = -m[10] / len;
      const saved = far.map((id) => { const e = s.get(id); return [e, e.x, e.z]; });
      saved.forEach(([e], i) => { const side = (i % 6) * 2.6 - 6.5, row = i < 6 ? 0 : 3; e.x = cx + dx * (31 + row) - dz * side; e.z = cz + dz * (31 + row) + dx * side; });
      v.focusOn(cx + dx * framing.ahead, cz + dz * framing.ahead); v.updateCamera();
      const count = () => { r.info.reset(); r.info.autoReset = false; v.update(s, 0, f.selected, null); const n = r.info.render.calls; r.info.autoReset = true; return n; };
      count();
      const on = count(), near = f.closeInfo.near;
      await f.closeView(false);
      count();
      const off = count();
      await f.closeView(true, cx, cz);
      saved.forEach(([e, x, z]) => { e.x = x; e.z = z; });
      v.setPitch(null);
      count();
      return { on, off, near, extra: on - off };
    }, { ...ids, framing });
    const phone = viewport === "portrait";
    const chase = await split({ zoom: phone ? 15 : 12, pitch: phone ? 35 : 25, ahead: 0 });
    const wide = await split({ zoom: 30, pitch: null, ahead: 15 });
    console.log(`  ${viewport}: close camera ${chase.off} -> ${chase.on} draws (+${chase.extra}); wide worst case ${wide.off} -> ${wide.on} (+${wide.extra}); ${chase.near} near`);
    if (phone) assert.ok(chase.extra <= PHONE_BUDGET, `${viewport}: close camera ${chase.extra} extra draws > ${PHONE_BUDGET}`);

    // A close look: the low chase angle at a near group, detail on and off (same camera).
    await camera(ids.cx - 1, ids.cz + 4, phone ? 15 : 12, phone ? 35 : 25, Math.PI);
    await frame();
    await png("close-detail");
    await page.evaluate(() => window.__frontier.closeView(false));
    await frame();
    await png("close-normal");

    // Off: back to the exact normal frame.
    await camera(ids.cx - 1, ids.cz, 30);
    await frame();
    const after = await frame();
    const off = await page.evaluate(() => window.__frontier.closeInfo);
    assert.equal(off.near, 0, `${viewport}: no unit keeps its detail model after close view is off`);
    assert.equal(after, normal, `${viewport}: draws back to ${normal} (got ${after})`);
    await png("normal-after");
    const changed = await differ("normal-before", "normal-after");
    console.log(`  ${viewport}: normal frame before vs after close view: ${changed} pixels differ (same-frame redraw: ${noise})`);
    assert.ok(changed <= NOISE, `${viewport}: the normal frame is unchanged after close view was on and off (${changed} pixels differ)`);

    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }
}, { browser });
