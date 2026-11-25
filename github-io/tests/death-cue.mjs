// Readable deaths (src/death-cue-view.js, 2026-11-26) at the phone camera: the rules' death event spawns the cue
// (white-hot model flash, a ring in the side's colour, the ring left where it fell, the Unit motion pop), the cue
// adds no draw call, and everything is cleaned up once the body is gone. Your own unit lost also marks the minimap.
// Combat motion off: no flash and no pop, the rings still shown, without opening.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: ["--enable-unsafe-swiftshader"] });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto((process.env.TEST_URL || "http://127.0.0.1:4180/") + "?test=1", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled, null, { timeout: 90000 });
    await page.locator("#start").click();
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.modelsReady, null, { timeout: 90000 });
    const result = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, v = f.view, cue = v.deathCues;
      f.hold = true; s.aiEnabled = false;
      s.visible[0].fill(1); s.explored[0].fill(1);
      const kept = () => [...v.fx.glow.items, ...v.fx.smoke.items].filter((p) => p.keep);
      const frame = (dt) => { v.update(s, dt, f.selected, null); return v.renderer.info.render.calls; };
      const kill = (type, team, x, z, settings) => {
        const e = s.spawn(type, team, x, z);
        v.focusOn(x, z); v.zoom = v.defaultZoom; v.updateCamera();
        if (settings) v.applySettings({ ...v.settings, ...settings });
        frame(0.05); frame(0.05);
        const o = v.objects.get(e.id), parts = [];
        o.userData.model.traverse((p) => { if (p.isMesh && p.visible !== false) parts.push(p); });
        const before = parts.map((p) => p.userData.tint);
        const draws = frame(0); // a still frame: draws with the unit alive
        s.entities = s.entities.filter((x) => x !== e);
        v.event({ type: "death", x: e.x, z: e.z, team, building: false, heavy: !!e.mechanical, core: false, seed: e.id, direction: e.angle }, s);
        const sprites = kept().length, flash = parts.some((p) => p.userData.tint && p.userData.tint[0] > 1.5);
        const y0 = o.position.y, d = v.dying.find((x) => x.id === e.id);
        const drawsDying = frame(0.05);
        const rings = kept().filter((p) => p.mode === 3).map((p) => [p.s0, p.s1]);
        frame(0.05);
        const lift = o.position.y - (d.baseY ?? y0);
        for (let i = 0; i < 12; i++) frame(0.05); // 0.6 s: the flash is over
        const restored = parts.every((p, i) => p.userData.tint === before[i] || (p.userData.tint && p.userData.tint[0] < 1));
        let steps = 0;
        while ((v.dying.includes(d) || cue.live || kept().length) && steps++ < 200) frame(0.05);
        return { sprites, flash, lift, rings, restored, draws, drawsDying, live: cue.live, left: kept().length, dying: v.dying.includes(d), steps };
      };
      const enemy = kill("ranger", 1, 4, -2);
      const own = kill("tank", 0, 6, 2);
      const calm = kill("ranger", 1, 2, 0, { combatMotion: false });
      v.applySettings({ ...v.settings, combatMotion: true });
      return { enemy, own, calm, spawned: cue.spawned, upp: v.unitsPerPixel };
    });
    const tag = `${viewport.width}x${viewport.height}`;
    for (const [name, r] of Object.entries({ enemy: result.enemy, own: result.own, calm: result.calm })) {
      assert.ok(r.sprites >= 4, `${tag} ${name}: the death spawns the cue's sprites (${r.sprites})`);
      assert.ok(r.rings.length >= 2, `${tag} ${name}: a ring where it died and one where it fell`);
      // The cue's sprites ride the pooled effect layers; the pooled layer (and the death's own sprite-sheet blasts) may
      // appear on the first dying frame, so allow those; tools/death-draws.mjs measures a big fight before/after.
      assert.ok(r.drawsDying <= r.draws + 3, `${tag} ${name}: no new draw calls (${r.draws} -> ${r.drawsDying})`);
      assert.ok(r.restored, `${tag} ${name}: the model's own tints come back after the flash`);
      assert.equal(r.live, 0, `${tag} ${name}: no cue record left`);
      assert.equal(r.left, 0, `${tag} ${name}: no cue sprite left`);
      assert.equal(r.dying, false, `${tag} ${name}: the body is gone`);
    }
    assert.ok(result.enemy.flash && result.own.flash, `${tag}: the dying model flashes white-hot`);
    assert.ok(result.enemy.lift > 0.05, `${tag}: Unit motion pops the soldier off its feet (${result.enemy.lift})`);
    assert.ok(!result.calm.flash, `${tag}: combat motion off: no flash`);
    assert.ok(result.calm.rings.every(([a, b]) => Math.abs(a - b) < 1e-6 || a > b), `${tag}: combat motion off: the rings do not open`);
    // Phone readability: the burst ring is never under ~50 CSS px wide.
    const widest = Math.max(...result.enemy.rings.map(([, b]) => b));
    assert.ok(widest / result.upp >= 50, `${tag}: the burst ring is at least 50 CSS px wide (${(widest / result.upp).toFixed(0)})`);
    // Your own unit lost: a mark on the minimap, through the game's own event path (src/app/frame.js).
    const lost = await page.evaluate(async () => {
      const f = window.__frontier, s = f.sim;
      const e = s.spawn("ranger", 0, -6, 4);
      f.hold = false;
      s.entities = s.entities.filter((x) => x !== e);
      s.events.push({ type: "death", x: e.x, z: e.z, team: 0, building: false, heavy: false, core: false, seed: e.id, direction: 0 });
      for (let i = 0; i < 60 && !f.pings.some((p) => p.lost); i++) await new Promise(requestAnimationFrame);
      return f.pings.filter((p) => p.lost).length;
    });
    assert.equal(lost, 1, `${tag}: your unit lost marks the minimap`);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(tag, "ok", JSON.stringify({ enemy: result.enemy.drawsDying - result.enemy.draws, own: result.own.drawsDying - result.own.draws, lift: +result.enemy.lift.toFixed(2) }));
  }
  console.log("death cue: ok");
} finally {
  await browser.close();
}
