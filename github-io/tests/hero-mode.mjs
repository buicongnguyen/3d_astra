// H3a/H3d Hero mode in the browser (src/hero-mode.js, src/hero-mode-view.js, src/sim/content/hero-mode.js):
//   desktop    the 44 px Hero mode button shows only with a hero; one click enters (hero selected, steward on, battle
//              time eased to x0.5, RTS bars covered); W moves, a click on an enemy fires, Space dodges, an enemy's shot
//              flies as a projectile; Tab leaves with every order and queue kept; Skywing's look-down camera (45-60
//              degrees) with the ground reticle, a click shoots the sniper, the Rocket switch on the HUD and a 0.6 s hold
//              locks and fires; Esc leaves.
//   portrait   the button above the dock; the stick moves, the Fire button fires, Dodge and Exit taps; Skywing's camera;
//              the draw budget (Hero mode at most 30 draws over the normal frame), and the frame time at 4x CPU slowing.
//   landscape  enter, the HUD fits, exit.
// Every HUD: taps >= 44 px, text >= 11 px, no system-ui, no sideways scroll. The match clock is held and moved only with
// step() (CI runs at about 1 fps); transient messages are held (holdMessages).
import assert from "node:assert/strict";
import { mkdirSync, copyFileSync } from "node:fs";
import { launchBrowser, openPage, shot, suite, TIMEOUT, OUTPUT } from "./lib/harness.mjs";

const SHOTS = process.env.HERO_SHOTS || null; // a folder to copy the owner's screenshots into
async function keep(page, name) {
  await shot(page, name);
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); copyFileSync(`${OUTPUT}/${name}.png`, `${SHOTS}/${name}.png`); }
}

async function audit(page, label) {
  const bad = await page.evaluate(() => {
    const out = [];
    const roots = [document.querySelector("#hero-hud")].filter((r) => r && !r.hidden);
    for (const root of roots) {
      for (const b of root.querySelectorAll("button")) { const r = b.getBoundingClientRect(); if (r.width && (r.width < 44 || r.height < 44)) out.push(`tap ${b.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`); }
      for (const n of root.querySelectorAll("*")) {
        if (!n.getClientRects().length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (parseFloat(cs.fontSize) < 11) out.push(`text ${n.textContent.trim().slice(0, 20)} ${cs.fontSize}`);
        if (/system-ui/.test(cs.fontFamily)) out.push(`system-ui ${n.tagName}`);
      }
      // Nothing of the HUD off screen.
      for (const b of root.querySelectorAll("button")) { const r = b.getBoundingClientRect(); if (r.width && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1)) out.push(`off screen ${b.textContent.trim()}`); }
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push("sideways scroll");
    return out;
  });
  assert.deepEqual(bad, [], `${label}: ${bad.join(", ")}`);
}

const info = (page) => page.evaluate(() => window.__frontier.heroMode.info);
// A skirmish with Skywing and a ground hero (the first Vanguard dressed as Mira Vale: campaign heroes only join story
// missions, and the controls are the same for each).
async function battle(page, tap) {
  await tap('[data-mode="skirmish"]');
  await tap("#start");
  await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
  await page.evaluate(() => { const f = window.__frontier; f.hold = true; f.holdMessages = true; f.sim.explored[0].fill(1); });
  // No hero yet: no button.
  await page.evaluate(() => window.__frontier.step(0.1));
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => { const b = document.querySelector("#hero-mode-btn"); return !!b && !b.hidden; }), false, "no Hero mode button without a hero");
  return page.evaluate(() => {
    const f = window.__frontier, s = f.sim;
    s.command({ team: 0, type: "skywing" });
    const e = s.own(0).find((u) => u.type === "vanguard");
    Object.assign(e, { hero: "vale", name: "Mira Vale", ability: { id: "holdline", name: "Hold the line", cooldown: 35, duration: 6, radius: 8, taken: 0.7, icon: "rally", order: 30 } });
    f.step(0.1);
    return { vale: e.id, sky: s.skywing.id };
  });
}
// An enemy `d` m in front of the hero (along the camera's yaw), seen.
const enemyAhead = (page, type = "ranger", d = 6, side = 0) => page.evaluate(([type, d, side]) => {
  const f = window.__frontier, s = f.sim, i = f.heroMode.info, e = s.get(i.id);
  const x = e.x + Math.sin(i.yaw) * d - Math.cos(i.yaw) * side, z = e.z + Math.cos(i.yaw) * d + Math.sin(i.yaw) * side;
  const t = s.spawn(type, 1, x, z, true, true);
  t.orders = [];
  t.stance = "hold";
  s.updateVision();
  return t.id;
}, [type, d, side]);
// Where a unit is on screen now (the hero camera).
const screenOf = (page, id) => page.evaluate((id) => {
  const f = window.__frontier, v = f.view, e = f.sim.get(id), r = v.renderer.domElement.getBoundingClientRect();
  const p = v.project(e.x, e.z, v.terrain.heightAt(e.x, e.z) + (e.flying ? 3 : 0.8));
  return { x: r.left + p.x, y: r.top + p.y };
}, id);
// The camera's look-down angle, degrees below the horizon.
const pitch = (page) => page.evaluate(() => { const m = window.__frontier.view.camera.matrixWorld.elements; const fx = -m[8], fy = -m[9], fz = -m[10]; return (Math.atan2(-fy, Math.hypot(fx, fz)) * 180) / Math.PI; });
const logged = (page, type) => page.evaluate((type) => window.__frontier.sim.commandLog.filter((c) => c.type === type).length, type);

const browser = await launchBrowser();
await suite("hero-mode: enter, move, fire, dodge and exit on PC and phone, Skywing's look-down camera and reticle, battle time and the draw budget", async () => {
  // ---------------------------------------------------------------- desktop
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await goto();
    await ready();
    const ids = await battle(page, tap);
    // An order and a queue the player gave before: kept through Hero mode.
    const kept = await page.evaluate(() => {
      const s = window.__frontier.sim, r = s.own(0).find((u) => u.type === "ranger"), b = s.own(0).find((u) => u.type === "barracks");
      s.command({ team: 0, type: "order", ids: [r.id], order: { type: "move", x: r.x + 30, z: r.z - 30 } });
      s.command({ team: 0, type: "train", building: b.id, unit: "ranger" });
      return { unit: r.id, building: b.id };
    });
    await page.evaluate((id) => window.__frontier.select([id]), ids.vale);
    const button = page.locator("#hero-mode-btn");
    await button.waitFor({ state: "visible", timeout: TIMEOUT.step });
    const box = await button.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, `button ${box.width}x${box.height}`);
    assert.match(await button.innerText(), /hero mode/i);
    await keep(page, "hero-mode-button-desktop");
    await button.click();
    await page.waitForFunction(() => window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    let st = await page.evaluate(() => { const f = window.__frontier, s = f.sim; return { mode: !!s.heroMode, steward: s.stewardOn(0), cls: document.documentElement.classList.contains("hero-mode"), sel: [...f.selected], hud: !document.querySelector("#hero-hud").hidden, driven: s.get(f.heroMode.info.id).driven }; });
    assert.deepEqual(st, { mode: true, steward: true, cls: true, sel: [ids.vale], hud: true, driven: 0.5 }, "entered: hero selected, steward on, HUD up");
    await page.waitForFunction(() => window.__frontier.heroMode.info.scale === 0.5, null, { timeout: TIMEOUT.step });
    // The RTS bars are under the battlefield: the top bar is not what is on top at its own spot.
    assert.equal(await page.evaluate(() => { const t = document.querySelector(".topbar").getBoundingClientRect(); return !!document.elementFromPoint(t.left + t.width / 2, t.top + 5)?.closest(".topbar"); }), false, "the top bar is covered");
    await audit(page, "desktop ground HUD");
    // W moves the hero (one drive command; steps move it).
    const start = await page.evaluate((id) => { const e = window.__frontier.sim.get(id); return { x: e.x, z: e.z }; }, ids.vale);
    await page.mouse.move(720, 420);
    await page.keyboard.down("w");
    await page.waitForFunction(() => window.__frontier.heroMode.info.sent.drive !== "0,0", null, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.step(1));
    await page.keyboard.up("w");
    await page.waitForFunction(() => window.__frontier.heroMode.info.sent.drive === "0,0", null, { timeout: TIMEOUT.step });
    const moved = await page.evaluate(([id, a]) => { const e = window.__frontier.sim.get(id); return Math.hypot(e.x - a.x, e.z - a.z); }, [ids.vale, start]);
    assert.ok(moved > 2, `W moved the hero ${moved.toFixed(2)} m`);
    // A click on an enemy in front fires at it (aim assist on the unit under the cursor).
    const foe = await enemyAhead(page, "ranger", 1.4);
    await page.waitForTimeout(200);
    const at = await screenOf(page, foe);
    await page.mouse.move(at.x, at.y);
    await page.waitForFunction((id) => window.__frontier.heroMode.info.target === id, foe, { timeout: TIMEOUT.step });
    const hp0 = await page.evaluate((id) => window.__frontier.sim.get(id).hp, foe);
    await page.mouse.down();
    await page.waitForFunction((id) => window.__frontier.heroMode.info.sent.fire === String(id), foe, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.step(1.5));
    await page.mouse.up();
    await page.waitForFunction(() => window.__frontier.heroMode.info.sent.fire === "null", null, { timeout: TIMEOUT.step });
    const hp1 = await page.evaluate((id) => window.__frontier.sim.get(id)?.hp ?? 0, foe);
    assert.ok(hp1 < hp0, `the click fired: ${hp0} -> ${hp1}`);
    // An enemy's shot at the hero flies (a projectile with a landing check); the screenshot shows it in the air.
    const shooter = await enemyAhead(page, "tank", 7, 2);
    await page.evaluate(([s, h]) => { const t = window.__frontier.sim.get(s); t.stance = "guard"; t.orders = [{ type: "attack", target: h }]; t.cooldown = 0; }, [shooter, ids.vale]);
    await page.evaluate(() => { for (let i = 0; i < 40 && !window.__frontier.sim.heroMode?.shots.length; i++) window.__frontier.step(0.05); });
    assert.ok(await page.evaluate(() => window.__frontier.sim.heroMode.shots.length > 0), "the enemy's shot is in flight");
    await page.waitForTimeout(300);
    await keep(page, "hero-mode-ground-desktop");
    // Space dodges (a logged command, the cooldown starts).
    await page.keyboard.press("Space");
    await page.waitForFunction(() => window.__frontier.sim.commandLog.some((c) => c.type === "heroDodge"), null, { timeout: TIMEOUT.step });
    assert.ok(await page.evaluate((id) => window.__frontier.sim.get(id).dodgeReady > window.__frontier.sim.time, ids.vale), "the dodge cooldown runs");
    assert.equal(await page.evaluate(() => window.__frontier.paused), false, "Space dodges instead of pausing");
    // Tab leaves: steward off, RTS view back, the order and the queue kept.
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => !window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    st = await page.evaluate((k) => { const s = window.__frontier.sim; return { mode: !!s.heroMode?.teams?.[0], steward: s.stewardOn(0), cls: document.documentElement.classList.contains("hero-mode"), order: s.get(k.unit)?.orders[0]?.type, queue: s.get(k.building).queue.length >= 1, ortho: !!window.__frontier.view.camera.isOrthographicCamera }; }, kept);
    assert.deepEqual(st, { mode: false, steward: false, cls: false, order: "move", queue: true, ortho: true }, "left: steward off, orders kept");
    await page.waitForFunction(() => window.__frontier.heroMode.info.scale === 1, null, { timeout: TIMEOUT.step });
    // Skywing: the look-down camera, the reticle, the sniper, the rocket lock.
    await page.evaluate(() => window.__frontier.select([]));
    await button.waitFor({ state: "visible", timeout: TIMEOUT.step });
    await button.click();
    await page.waitForFunction((id) => window.__frontier.heroMode.info.on && window.__frontier.heroMode.info.id === id, ids.sky, { timeout: TIMEOUT.step });
    await page.waitForTimeout(200);
    const down = await pitch(page);
    assert.ok(down >= 44 && down <= 61, `look-down ${down.toFixed(1)} degrees`);
    const target = await enemyAhead(page, "ranger", 9);
    await page.waitForTimeout(200);
    const p = await screenOf(page, target);
    await page.mouse.move(p.x, p.y);
    await page.waitForFunction((id) => window.__frontier.heroMode.info.target === id, target, { timeout: TIMEOUT.step });
    assert.ok(await page.evaluate(() => window.__frontier.view.scene.getObjectByName("HeroReticle")?.visible === true), "the ground reticle");
    assert.ok(await page.locator('#hero-hud .hh-weapons [data-weapon="sniper"]').isVisible() && await page.locator('#hero-hud .hh-weapons [data-weapon="rocket"]').isVisible(), "Sniper | Rocket both on the HUD");
    await audit(page, "desktop Skywing HUD");
    await keep(page, "hero-mode-skywing-desktop");
    const shots0 = await logged(page, "heroFire");
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction((n) => window.__frontier.sim.commandLog.filter((c) => c.type === "heroFire").length > n, shots0, { timeout: TIMEOUT.step });
    const thp = await page.evaluate((id) => window.__frontier.sim.get(id).hp, target);
    await page.evaluate(() => window.__frontier.step(0.5));
    assert.ok(await page.evaluate(([id, hp]) => (window.__frontier.sim.get(id)?.hp ?? 0) < hp, [target, thp]), "the sniper shot hit");
    // The wheel zooms.
    const z0 = (await info(page)).zoom;
    await page.mouse.wheel(0, 300);
    await page.waitForFunction((z) => window.__frontier.heroMode.info.zoom !== z, z0, { timeout: TIMEOUT.step });
    // Rocket: the switch on the HUD, then a hold of about 0.6 s locks and fires.
    await page.locator('#hero-hud [data-weapon="rocket"]').click();
    await page.evaluate(() => window.__frontier.step(1.2));
    await page.waitForFunction(() => document.querySelector('#hero-hud [data-weapon="rocket"]').getAttribute("aria-pressed") === "true", null, { timeout: TIMEOUT.step });
    const tank = await enemyAhead(page, "tank", 7, -2);
    await page.waitForTimeout(200);
    const q = await screenOf(page, tank);
    await page.mouse.move(q.x, q.y);
    await page.waitForFunction((id) => window.__frontier.heroMode.info.target === id, tank, { timeout: TIMEOUT.step });
    const before = await logged(page, "heroFire");
    await page.mouse.down();
    await page.waitForFunction((n) => window.__frontier.sim.commandLog.filter((c) => c.type === "heroFire").length > n, before, { timeout: TIMEOUT.step });
    await page.mouse.up();
    const last = await page.evaluate(() => window.__frontier.sim.commandLog.filter((c) => c.type === "heroFire").at(-1));
    assert.equal(last.target, tank, "the locked rocket goes at the held target");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate(() => window.__frontier.paused), false, "Esc leaves Hero mode (no pause)");
    assert.deepEqual(errors, [], "desktop: page errors");
    await page.close();
  }
  // ---------------------------------------------------------------- portrait phone
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "portrait");
    await goto();
    await ready();
    const ids = await battle(page, tap);
    await page.evaluate((id) => window.__frontier.select([id]), ids.vale);
    const button = page.locator("#hero-mode-btn");
    await button.waitFor({ state: "visible", timeout: TIMEOUT.step });
    // Above the dock, never in the top bar or the rail.
    const geo = await page.evaluate(() => { const b = document.querySelector("#hero-mode-btn").getBoundingClientRect(), d = document.querySelector(".bottom-dock").getBoundingClientRect(), t = document.querySelector(".topbar").getBoundingClientRect(); return { b: [b.top, b.bottom, b.width, b.height], dock: d.top, top: t.bottom }; });
    assert.ok(geo.b[1] <= geo.dock + 1 && geo.b[0] >= geo.top, `button ${JSON.stringify(geo)}`);
    assert.ok(geo.b[2] >= 44 && geo.b[3] >= 44);
    await keep(page, "hero-mode-button-phone");
    // Normal draws at this view, for the budget below.
    const count = () => page.evaluate(() => { const f = window.__frontier, v = f.view, r = v.renderer; r.info.reset(); r.info.autoReset = false; v.update(f.sim, 0, f.selected, null); const n = r.info.render.calls; r.info.autoReset = true; return n; });
    await page.evaluate((id) => { const e = window.__frontier.sim.get(id); window.__frontier.view.focusOn(e.x, e.z); }, ids.vale);
    await page.waitForTimeout(300);
    const normal = await count();
    await tap("#hero-mode-btn");
    await page.waitForFunction(() => window.__frontier.heroMode.info.on && document.documentElement.classList.contains("hero-phone"), null, { timeout: TIMEOUT.step });
    // The close-up detail around the aim point (its files load on the first use).
    await page.waitForFunction(() => window.__frontier.closeInfo?.on, null, { timeout: TIMEOUT.models });
    await audit(page, "portrait ground HUD");
    // The stick: a touch drag on the left moves the hero.
    const start = await page.evaluate((id) => { const e = window.__frontier.sim.get(id); return { x: e.x, z: e.z }; }, ids.vale);
    const touch = (type, x, y, id = 11, target = "#hero-hud") => page.evaluate(([type, x, y, id, target]) => {
      document.querySelector(target).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    }, [type, x, y, id, target]);
    await touch("pointerdown", 80, 640);
    await touch("pointermove", 80, 590);
    await page.waitForFunction(() => window.__frontier.heroMode.info.sent.drive !== "0,0", null, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.step(1));
    await touch("pointerup", 80, 590);
    await page.waitForFunction(() => window.__frontier.heroMode.info.sent.drive === "0,0", null, { timeout: TIMEOUT.step });
    const moved = await page.evaluate(([id, a]) => { const e = window.__frontier.sim.get(id); return Math.hypot(e.x - a.x, e.z - a.z); }, [ids.vale, start]);
    assert.ok(moved > 2, `the stick moved the hero ${moved.toFixed(2)} m`);
    // A drag on the right turns the camera.
    const yaw0 = (await info(page)).yaw;
    await touch("pointerdown", 300, 400, 12);
    await touch("pointermove", 340, 400, 12);
    await touch("pointerup", 340, 400, 12);
    assert.notEqual((await info(page)).yaw, yaw0, "a right-side drag turns the camera");
    // Fire (held) at an enemy under the reticle.
    const foe = await enemyAhead(page, "ranger", 1.4);
    await page.waitForFunction((id) => window.__frontier.heroMode.info.target === id, foe, { timeout: TIMEOUT.step });
    const hp0 = await page.evaluate((id) => window.__frontier.sim.get(id).hp, foe);
    await page.evaluate(() => { const b = document.querySelector("#hero-hud .hh-fire"); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 21, pointerType: "touch", isPrimary: true })); });
    await page.waitForFunction((id) => window.__frontier.heroMode.info.sent.fire === String(id), foe, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.step(1.5));
    await page.evaluate(() => { const b = document.querySelector("#hero-hud .hh-fire"); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 21, pointerType: "touch", isPrimary: true })); });
    await page.waitForFunction(() => window.__frontier.heroMode.info.sent.fire === "null", null, { timeout: TIMEOUT.step });
    assert.ok(await page.evaluate(([id, hp]) => (window.__frontier.sim.get(id)?.hp ?? 0) < hp, [foe, hp0]), "Fire hit");
    await page.waitForTimeout(200);
    // The draw budget: Hero mode at most 30 draws over the normal frame at this size.
    const hero = await count();
    console.log(`  portrait: draws normal ${normal}, Hero mode ${hero} (${hero - normal >= 0 ? "+" : ""}${hero - normal}), close-up units ${(await page.evaluate(() => window.__frontier.closeInfo.near))}`);
    assert.ok(hero - normal <= 30, `Hero mode draws ${hero} vs ${normal} normal`);
    await keep(page, "hero-mode-ground-phone");
    // Dodge, then Exit.
    await tap('#hero-hud [data-hero="dodge"]');
    await page.waitForFunction(() => window.__frontier.sim.commandLog.some((c) => c.type === "heroDodge"), null, { timeout: TIMEOUT.step });
    await tap('#hero-hud [data-hero="exit"]');
    await page.waitForFunction(() => !window.__frontier.heroMode.info.on && !window.__frontier.sim.stewardOn(0), null, { timeout: TIMEOUT.step });
    // Skywing on the phone: the look-down camera and its HUD; the frame time at 4x CPU slowing (logged).
    await page.evaluate(() => window.__frontier.select([]));
    await button.waitFor({ state: "visible", timeout: TIMEOUT.step });
    await tap("#hero-mode-btn");
    await page.waitForFunction((id) => window.__frontier.heroMode.info.on && window.__frontier.heroMode.info.id === id, ids.sky, { timeout: TIMEOUT.step });
    await page.waitForTimeout(200);
    const down = await pitch(page);
    assert.ok(down >= 44 && down <= 61, `phone look-down ${down.toFixed(1)} degrees`);
    await enemyAhead(page, "tank", 9);
    await page.waitForTimeout(200);
    await audit(page, "portrait Skywing HUD");
    const sky = await count();
    console.log(`  portrait: Skywing look-down draws ${sky} (normal ${normal}, ${sky - normal >= 0 ? "+" : ""}${sky - normal})`);
    assert.ok(sky - normal <= 30, `Skywing draws ${sky} vs ${normal}`);
    await keep(page, "hero-mode-skywing-phone");
    if (!process.env.SLOW_CPU) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      const ms = await page.evaluate(() => { const f = window.__frontier, v = f.view, t = []; for (let i = 0; i < 12; i++) { const a = performance.now(); v.update(f.sim, 0.016, f.selected, null); v.renderer.getContext().finish(); t.push(performance.now() - a); } t.sort((a, b) => a - b); return t[6]; });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      console.log(`  portrait: Skywing frame at 4x CPU slowing, median ${ms.toFixed(1)} ms (render probe, this machine)`);
    }
    await tap('#hero-hud [data-hero="exit"]');
    await page.waitForFunction(() => !window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    assert.deepEqual(errors, [], "portrait: page errors");
    await page.close();
  }
  // ---------------------------------------------------------------- landscape phone
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "landscape");
    await goto();
    await ready();
    const ids = await battle(page, tap);
    await page.evaluate((id) => window.__frontier.select([id]), ids.vale);
    await page.locator("#hero-mode-btn").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await tap("#hero-mode-btn");
    await page.waitForFunction(() => window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(200);
    await audit(page, "landscape ground HUD");
    await keep(page, "hero-mode-ground-landscape");
    // The hero falls: "Hero down" for about a second, then the RTS view comes back on its own.
    await page.evaluate((id) => { const f = window.__frontier, e = f.sim.get(id); f.sim.applyDamage(e, e.hp + e.shield + 999, 1, null); f.step(0.05); }, ids.vale);
    await page.locator("#hero-hud .hh-down").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await page.waitForFunction(() => !window.__frontier.heroMode.info.on && !window.__frontier.sim.stewardOn(0), null, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.select([]));
    await tap("#hero-mode-btn");
    await page.waitForFunction((id) => window.__frontier.heroMode.info.id === id, ids.sky, { timeout: TIMEOUT.step });
    await page.waitForTimeout(200);
    await audit(page, "landscape Skywing HUD");
    await keep(page, "hero-mode-skywing-landscape");
    await tap('#hero-hud [data-hero="exit"]');
    await page.waitForFunction(() => !window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    assert.deepEqual(errors, [], "landscape: page errors");
    await page.close();
  }
}, { browser });
