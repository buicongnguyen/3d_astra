// Idle life in the game view (src/idle-life.js, 2026-11-28): idle soldiers sit on the ground, do squats, stretch and look
// about, and drill together by their own Barracks, on the shader bones (no draw is added); an order makes a seated soldier
// stand at once; Settings > Unit motion off (and reduced motion, the governor's still level: WorldView.richMotion) stands
// them all as modelled. Off under ?test unless &idle=1 (main.js), so every other suite sees the rest pose.
// The game loop keeps drawing between steps (at dt 0 here: only the test's own steps move time on); each timed check forces, steps and
// reads inside one evaluate. Screenshots: test-results/idle-life/ (IDLE_SHOTS=<dir> to put them elsewhere).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const shots = process.env.IDLE_SHOTS || "test-results/idle-life";
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: ["--enable-unsafe-swiftshader"] });
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const mobile = viewport.width < 1000, tag = `${viewport.width}x${viewport.height}`;
    const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto((process.env.TEST_URL || "http://127.0.0.1:4180/") + "?test=1&idle=1", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled, null, { timeout: 90000 });
    await page.locator("#start").click();
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.modelsReady, null, { timeout: 90000 });
    const types = ["ranger", "antitank", "medic", "scrapper"];
    // A quiet base: no enemies, a Barracks with four soldiers beside it, four more out on the field. Helpers stay on window.
    await page.evaluate(async (types) => {
      const f = window.__frontier, s = f.sim, v = f.view;
      f.hold = true; s.aiEnabled = false;
      s.entities = s.entities.filter((e) => e.kind === "building" && e.team === 0 && e.type !== "barracks");
      s.visible[0].fill(1); s.explored[0].fill(1);
      const b = s.spawn("barracks", 0, 18, 18);
      window.idleField = types.map((t, i) => s.spawn(t, 0, -6 + i * 2.6, 22).id);
      window.idleDrill = [0, 1, 2, 3].map((i) => s.spawn(i % 2 ? "ranger" : "medic", 0, b.x - 3 + i * 2, b.z + 6).id);
      for (const id of [...window.idleField, ...window.idleDrill]) s.get(id).angle = 0.5;
      s.nav.rebuild(s.entities);
      // The game loop's own frames draw with dt 0 from here on (a slow screenshot on CI lets seconds pass), so only
      // these steps move the activities on.
      const update = v.update.bind(v);
      v.update = (sim, dt, ...rest) => update(sim, 0, ...rest);
      window.idleStep = (n, dt) => { for (let i = 0; i < n; i++) update(s, dt, f.selected, null); return v.renderer.info.render.calls; };
      window.idleLook = (ids) => ids.map((id) => {
        const u = v.objects.get(id)?.userData, m = u?.rig?.motion;
        if (!m) return null;
        const h = Math.floor(m[1] * 0.5), yaw = Math.floor(h / 64 + 0.5), low = Math.max(0, Math.floor(m[2] * 0.5)) / 1000;
        return { act: u.rig.idle?.act || null, low, yaw: yaw * 0.02, twist: Math.floor((m[3] - 1) * 0.25 + 0.5) * 0.005, y: u.model.position.y };
      });
      window.idleForce = (ids, acts) => ids.forEach((id, i) => v.idle.force(v.objects.get(id).userData.rig, s.get(id), acts[i % acts.length]));
      window.idleFrame = (x, z, zoom) => { v.focusOn(x, z); v.zoom = zoom; v.updateCamera(); };
      await v.preloadModels(types);
    }, types);
    await page.waitForFunction((types) => types.every((t) => window.__frontier.view.models.has(t)), types, { timeout: 90000 });
    const shot = (name) => page.screenshot({ path: `${shots}/${tag}-${name}.png`, timeout: 60000 });
    const field = await page.evaluate(() => window.idleField), drill = await page.evaluate(() => window.idleDrill);

    // 1. Standing at first; after the idle wait (8-12 s) they start on their own, nothing forced.
    const rest = await page.evaluate(() => { window.idleFrame(-2, 22, innerWidth < 1000 ? 20 : 14); window.idleStep(2, 0.05); return { draws: window.idleStep(1, 0), look: window.idleLook(window.idleField) }; });
    assert.ok(rest.look.every((p) => p && !p.act && p.low === 0), `${tag}: everyone stands at first ${JSON.stringify(rest.look)}`);
    const started = await page.evaluate(() => { window.idleStep(9, 1.5); return window.__frontier.view.idle.started; });
    assert.ok(started >= types.length, `${tag}: idle soldiers start their own activities after the wait (${started})`);

    // 2. The four activities (forced, so the pictures are the same every run), 1 s in: seated, squatting, leaning back,
    // head turned. The same camera draws exactly as many batches as with everyone standing.
    const acts = await page.evaluate(() => {
      window.idleForce(window.idleField, ["sit", "squats", "stretch", "look"]);
      window.idleStep(4, 0.25);
      return { poses: window.idleLook(window.idleField), draws: window.idleStep(1, 0) };
    });
    const [sit, squat, , lookAbout] = acts.poses;
    assert.ok(sit.act === "sit" && sit.low > 0.95 && sit.y < -0.5, `${tag}: sitting on the ground ${JSON.stringify(sit)}`);
    assert.ok(squat.act === "squats" && squat.low > 0.2 && squat.y < -0.1, `${tag}: squatting ${JSON.stringify(squat)}`);
    assert.ok(lookAbout.act === "look" && Math.abs(lookAbout.yaw) > 0.3, `${tag}: looking about ${JSON.stringify(lookAbout)}`);
    assert.equal(acts.draws, rest.draws, `${tag}: idle poses add no draw (${rest.draws} -> ${acts.draws})`);
    await shot("sit-squat-stretch-look");
    const twist = await page.evaluate(() => { window.idleStep(8, 0.25); return window.idleLook(window.idleField)[2]; });
    assert.ok(Math.abs(twist.twist) > 0.2, `${tag}: the stretch twists ${JSON.stringify(twist)}`);
    await shot("stretch-twist");

    // 3. The Barracks drill: four soldiers on one beat; at the bottom of a rep all four squat alike.
    const drilled = await page.evaluate(() => {
      const v = window.__frontier.view, b = window.__frontier.sim.entities.find((x) => x.type === "barracks");
      window.idleFrame(b.x, b.z + 4, innerWidth < 1000 ? 16 : 13);
      window.idleStep(1, 0); // drawn once from here: the drill is on screen (units off screen stand)
      window.idleForce(window.idleDrill, ["drill"]);
      window.idleStep(3, 0.25); // blended in (0.5 s)
      const beats = [];
      for (let k = 0; k < 8; k++) { window.idleStep(1, 0.2); beats.push(window.idleLook(window.idleDrill)); }
      v.idle.drillClock = 0.8; // the bottom of the first rep, for the picture
      window.idleStep(1, 0);
      return { beats, bottom: window.idleLook(window.idleDrill) };
    });
    for (const d of [...drilled.beats, drilled.bottom]) {
      assert.ok(d.every((p) => p.act === "drill"), `${tag}: drilling ${JSON.stringify(d)}`);
      assert.ok(d.every((p) => Math.abs(p.low - d[0].low) < 1e-6), `${tag}: the drill is in step ${JSON.stringify(d.map((p) => p.low))}`);
    }
    assert.ok(drilled.bottom[0].low > 0.35, `${tag}: the drill squats ${drilled.bottom[0].low}`);
    await shot("drill");

    // 4. An order: the seated soldier is already rising on the next frame and stands as modelled within 0.35 s.
    const order = await page.evaluate((id) => {
      const f = window.__frontier;
      window.idleFrame(-2, 22, innerWidth < 1000 ? 20 : 14);
      window.idleStep(1, 0);
      window.idleForce([id], ["sit"]);
      window.idleStep(4, 0.25);
      const before = window.idleLook([id])[0];
      f.sim.command({ team: 0, type: "order", ids: [id], order: { type: "move", x: -4, z: 30 } });
      window.idleStep(1, 0.15);
      return { before, rising: window.idleLook([id])[0] };
    }, field[0]);
    assert.ok(order.before.low > 0.95, `${tag}: seated before the order ${JSON.stringify(order.before)}`);
    assert.ok(order.rising.low < 0.9 && order.rising.low > 0, `${tag}: rising right after the order ${JSON.stringify(order.rising)}`);
    await shot("standing-up");
    const stood = await page.evaluate((id) => { window.idleStep(2, 0.1); return window.idleLook([id])[0]; }, field[0]);
    assert.ok(stood.low === 0 && !stood.act && Math.abs(stood.y) < 1e-6, `${tag}: stood within 0.35 s ${JSON.stringify(stood)}`);

    // 5. Settings > Unit motion off: everyone stands as modelled at once and nothing starts, however long they idle.
    const off = await page.evaluate(() => {
      const v = window.__frontier.view;
      v.applySettings({ ...v.settings, unitMotion: false });
      window.idleStep(9, 1.5);
      const out = window.idleLook([...window.idleField.slice(1), ...window.idleDrill]);
      v.applySettings({ ...v.settings, unitMotion: true });
      return out;
    });
    assert.ok(off.every((p) => !p.act && p.low === 0 && Math.abs(p.yaw) < 1e-9 && Math.abs(p.y) < 1e-6), `${tag}: Unit motion off stands everyone ${JSON.stringify(off)}`);
    assert.deepEqual(errors, [], `${tag}: no page errors`);
    await page.close();
  }
  console.log("idle life: sit, squats, stretch, look and the Barracks drill; stands on an order; off with Unit motion off");
} finally {
  await browser.close();
}
