// H3a/H3d Hero mode in the browser (src/hero-mode.js, src/hero-mode-view.js, src/sim/content/hero-mode.js):
//   desktop    the 44 px Hero mode button shows only with a hero; one click enters (hero selected, steward on, battle
//              time eased to x0.5, RTS bars covered); W moves, a click on an enemy fires, Space dodges, an enemy's shot
//              flies as a projectile; Tab leaves with every order and queue kept; Skywing's look-down camera (45-60
//              degrees) with the ground reticle, a click shoots the sniper, the Rocket switch on the HUD and a 0.6 s hold
//              locks and fires; Esc leaves.
//   portrait   the button above the dock; the stick moves, the Fire button fires, Dodge and Exit taps; Skywing's camera;
//              the draw budget (Hero mode at most 30 draws over the normal frame), and the frame time at 4x CPU slowing.
//   landscape  enter, the HUD fits, exit.
//   re-score 2026-11-28: the phone button is a tile of the touch tool row overlapping nothing (caption strip, Map tab,
//              dock, clock) in EN, VI and KO; every hero ability label fits its phone tile (>= 11 px) in EN/VI/KO,
//              portrait and landscape; the portrait shoulder camera looks down 22-36 degrees.
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

// Re-score 2026-11-28 gap 1: the Hero mode button overlaps nothing (no other button, the Map tab, the caption strip,
// the clock and pause cluster, the dock) and is what is on top at its own centre; its label fits at >= 11 px.
const heroButtonClear = (page) => page.evaluate(() => {
  const b = document.querySelector("#hero-mode-btn"), r = b.getBoundingClientRect(), hits = [];
  for (const n of document.querySelectorAll("button, #voice-caption.show, .top-actions, .resource-bar, .bottom-dock, #dock-tabs, .minimap-panel, #idle-chips")) {
    if (n === b || b.contains(n) || n.contains(b) || !n.getClientRects().length) continue;
    const cs = getComputedStyle(n);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.05) continue;
    const q = n.getBoundingClientRect();
    if (q.width < 2 || q.height < 2) continue;
    const x = Math.min(r.right, q.right) - Math.max(r.left, q.left), y = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
    if (x > 0.5 && y > 0.5) hits.push(`${n.id || n.className} ${Math.round(x)}x${Math.round(y)}`);
  }
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (!b.contains(top)) hits.push(`covered by ${top?.id || top?.className}`);
  const label = [...b.querySelectorAll("span")].find((n) => n.getClientRects().length);
  const font = parseFloat(getComputedStyle(label).fontSize);
  if (font < 11) hits.push(`label ${font}px`);
  if (b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1) hits.push(`label clipped "${label.textContent}"`);
  if (r.width < 44 || r.height < 44) hits.push(`tap ${Math.round(r.width)}x${Math.round(r.height)}`);
  if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) hits.push("off screen");
  return { hits, box: [r.left, r.top, r.width, r.height].map(Math.round), label: label.textContent };
});
// A long caption up (as Mira Vale's m02 line), held still while measured.
const showCaption = (page) => page.evaluate(() => { const c = window.__frontier.audio.captions; c.show({ text: "Our guns hold the ford. Cross together, fast, and keep the line.", speaker: "Mira Vale", channel: "story" }, { from: -1, until: 1e9 }); c.update(0); });
async function assertButtonClear(page, tap, label) {
  await showCaption(page);
  await page.waitForFunction(() => document.querySelector("#voice-caption")?.classList.contains("show"), null, { timeout: TIMEOUT.step });
  await page.waitForTimeout(700); // the button and the caption re-measure twice a second
  let r = await heroButtonClear(page);
  assert.deepEqual(r.hits, [], `${label}, hero selected: ${JSON.stringify(r)}`);
  await page.evaluate(() => window.__frontier.select([]));
  await page.waitForTimeout(700);
  r = await heroButtonClear(page);
  assert.deepEqual(r.hits, [], `${label}, nothing selected: ${JSON.stringify(r)}`);
  if (await page.locator('#dock-tabs [data-dock="map"]').isVisible()) {
    await tap('#dock-tabs [data-dock="map"]');
    await page.waitForTimeout(700);
    r = await heroButtonClear(page);
    assert.deepEqual(r.hits, [], `${label}, Map tab open: ${JSON.stringify(r)}`);
    await tap('#dock-tabs [data-dock="selection"]');
  }
  await page.evaluate(() => window.__frontier.audio.captions.clear());
  return r;
}
// Gap 2: the hero HUD's ability tile label is never cut off (every campaign hero's ability and Skywing's Dive strike).
const ABILITY_NAMES = ["Hold the line", "Caravan volley", "Iron hull", "Damper pulse", "Dive strike"];
async function abilityLabelsFit(page, heroId, label) {
  for (const name of ABILITY_NAMES) {
    await page.evaluate(([id, name]) => { const f = window.__frontier, e = f.sim.get(id); e.ability = { ...e.ability, name }; f.step(0.05); }, [heroId, name]);
    await page.waitForFunction((name) => document.querySelector("#hero-hud .hh-ability")?.dataset.ability === name, name, { timeout: TIMEOUT.step });
    await page.waitForTimeout(150); // the fit runs on the next frame
    const r = await page.evaluate(() => {
      const b = document.querySelector("#hero-hud .hh-ability"), n = b.querySelector(".hh-ability-name"), t = b.getBoundingClientRect(), q = n.getBoundingClientRect();
      return { text: n.textContent, font: parseFloat(getComputedStyle(n).fontSize), tile: [t.width, t.height].map(Math.round), clipped: q.top < t.top - 0.5 || q.bottom > t.bottom + 0.5 || q.left < t.left - 0.5 || q.right > t.right + 0.5 || n.scrollWidth > n.clientWidth + 1 };
    });
    assert.ok(!r.clipped && r.font >= 11, `${label} "${name}": ${JSON.stringify(r)}`);
  }
}

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
    // Item 4a (shine pass): a spark streak passing 0.6 m in front of the Hero camera fades out instead of drawing a
    // line across the screen (fx.js near-camera guard and streak length cap).
    const nearShare = await page.evaluate(() => {
      const f = window.__frontier, v = f.view, fx = v.fx, cam = v.camera, gl = v.renderer.getContext();
      const grab = () => { v.update(f.sim, 0, f.selected, null); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      const a = grab(), d = cam.position.clone();
      cam.getWorldDirection(d);
      fx.particle(fx.glow, { lifted: true, x: cam.position.x + d.x * 0.6, y: cam.position.y + d.y * 0.6, z: cam.position.z + d.z * 0.6, mode: 1, ax: 0.7, ay: 0.3, az: 0.64,
        length: 0.5, s0: 0.12, s1: 0.12, life: 5, cell: 3, c0: [0.6, 0.92, 1, 1], c1: [0.6, 0.92, 1, 1], anchor: null });
      const b = grab();
      let changed = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) changed++;
      fx.glow.items.at(-1).life = 0;
      return changed / (a.length / 4);
    });
    assert.ok(nearShare < 0.005, `a streak at the lens covers ${(nearShare * 100).toFixed(2)}% of the screen`);
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
    // Item 5 (shine pass): the PC Fire button shows with its F key; F held fires at the same aim, release stops.
    const fireButton = page.locator("#hero-hud .hh-fire");
    assert.ok(await fireButton.isVisible(), "the Fire button on PC");
    const fb = await fireButton.boundingBox();
    assert.ok(fb.width >= 44 && fb.height >= 44, `Fire ${fb.width}x${fb.height}`);
    assert.equal((await fireButton.locator("kbd").innerText()).trim(), "F");
    await audit(page, "desktop ground HUD with Fire");
    const foe2 = await enemyAhead(page, "ranger", 1.4, 0.4);
    await page.waitForTimeout(200);
    const at2 = await screenOf(page, foe2);
    await page.mouse.move(at2.x, at2.y);
    await page.waitForFunction((id) => window.__frontier.heroMode.info.target === id, foe2, { timeout: TIMEOUT.step });
    await page.keyboard.down("f");
    await page.waitForFunction((id) => window.__frontier.heroMode.info.sent.fire === String(id), foe2, { timeout: TIMEOUT.step });
    await page.keyboard.up("f");
    await page.waitForFunction(() => window.__frontier.heroMode.info.sent.fire === "null", null, { timeout: TIMEOUT.step });
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
    // Item 5: an F tap fires the sniper once, at the target under the reticle.
    const target2 = await enemyAhead(page, "ranger", 9, 1.5);
    await page.waitForTimeout(200);
    const p2 = await screenOf(page, target2);
    await page.mouse.move(p2.x, p2.y);
    await page.waitForFunction((id) => window.__frontier.heroMode.info.target === id, target2, { timeout: TIMEOUT.step });
    const tapped = await logged(page, "heroFire");
    await page.keyboard.press("f");
    await page.waitForFunction((n) => window.__frontier.sim.commandLog.filter((c) => c.type === "heroFire").length > n, tapped, { timeout: TIMEOUT.step });
    await page.waitForTimeout(300);
    const sniperShots = await page.evaluate(() => window.__frontier.sim.commandLog.filter((c) => c.type === "heroFire"));
    assert.equal(sniperShots.length, tapped + 1, "one sniper shot per F tap");
    assert.deepEqual([sniperShots.at(-1).target, sniperShots.at(-1).hold], [target2, false], "at the target under the reticle");
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
    // Item 6: the hero's own rocket flies in the hero look (a big body, flame and smoke), not the RTS-size round.
    // The match clock is held: each poll steps it a little, and the frames between polls hand the shot to the view.
    // (A slow runner's frames can carry the whole short flight, so the check counts rounds taken, not one frame's drawing.)
    await page.waitForFunction(() => { const f = window.__frontier; if (f.view.heroOwnShots.ownTaken.rocket > 0) return true; f.step(0.05); return false; }, null, { timeout: TIMEOUT.step, polling: 100 });
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
    // Its own slot: the tile under Info in the touch tool column, overlapping nothing (caption, Map tab, dock).
    const geo = await page.evaluate(() => { const b = document.querySelector("#hero-mode-btn").getBoundingClientRect(), i = document.querySelector("#touch-guide").getBoundingClientRect(); return { b: [b.left, b.top], info: [i.left, i.bottom] }; });
    assert.ok(Math.abs(geo.b[0] - geo.info[0]) < 1 && geo.b[1] > geo.info[1], `the tile under Info ${JSON.stringify(geo)}`);
    await keep(page, "hero-mode-button-phone");
    await assertButtonClear(page, tap, "portrait");
    await page.evaluate((id) => window.__frontier.select([id]), ids.vale);
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
    // Gap 3: the shoulder camera looks down enough that the hero and the field fill the view (was ~10 degrees).
    const look = await pitch(page);
    assert.ok(look >= 22 && look <= 36, `portrait shoulder look-down ${look.toFixed(1)} degrees`);
    await abilityLabelsFit(page, ids.vale, "portrait EN");
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
    await assertButtonClear(page, tap, "landscape");
    await page.evaluate((id) => window.__frontier.select([id]), ids.vale);
    await tap("#hero-mode-btn");
    await page.waitForFunction(() => window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(200);
    await audit(page, "landscape ground HUD");
    await abilityLabelsFit(page, ids.vale, "landscape EN");
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
  // ---------------------------------------------------------------- Vietnamese and Korean phones (re-score 2026-11-28)
  for (const lang of ["vi", "ko"]) {
    // DPR 3 like the re-score's phone (the game still draws at the Eco ratio 1 until the governor steps it up).
    const { page, goto, ready, tap, errors } = await openPage(browser, "portrait", { deviceScaleFactor: 3 });
    await goto();
    await page.evaluate((lang) => { const k = "frontier-command.settings.v1"; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || "{}"), version: 1, language: lang })); }, lang);
    await page.reload();
    await ready();
    await page.waitForFunction((lang) => document.documentElement.lang === lang, lang, { timeout: TIMEOUT.step });
    const ids = await battle(page, tap);
    await page.evaluate((id) => window.__frontier.select([id]), ids.vale);
    await page.locator("#hero-mode-btn").waitFor({ state: "visible", timeout: TIMEOUT.step });
    if (lang === "vi") {
      // Gap 4: the frame governor (off in browser tests, so fed here directly) steps the Eco pixel ratio up on smooth
      // frames to at most 2, and back down at once when frames slow.
      const pr = await page.evaluate(() => {
        const f = window.__frontier, g = f.governor, r = f.view.renderer, out = { start: r.getPixelRatio(), steps: f.view.sharpSteps() };
        g.reset();
        for (let i = 0; i < 60 * 40; i++) g.sample(1 / 60, 3, true);
        out.up = r.getPixelRatio();
        for (let i = 0; i < 20 * 3; i++) g.sample(0.05, 20, true);
        out.down = r.getPixelRatio();
        for (let i = 0; i < 20 * 2; i++) g.sample(0.05, 20, true);
        out.floor = r.getPixelRatio();
        out.canvas = r.domElement.width;
        return out;
      });
      assert.deepEqual({ start: pr.start, steps: pr.steps, up: pr.up }, { start: 1, steps: 4, up: 2 }, `sharpness up ${JSON.stringify(pr)}`);
      assert.ok(pr.down < 2 && pr.floor === 1 && pr.canvas === 390, `sharpness back down ${JSON.stringify(pr)}`);
      await page.evaluate(() => { const g = window.__frontier.governor; g.set(3); g.reset(); });
    }
    const r = await assertButtonClear(page, tap, `portrait ${lang}`);
    assert.equal(r.label, lang === "vi" ? "Anh hùng" : "영웅", `${lang} short label`);
    await page.evaluate((id) => window.__frontier.select([id]), ids.vale);
    await tap("#hero-mode-btn");
    await page.waitForFunction(() => window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    await abilityLabelsFit(page, ids.vale, `portrait ${lang}`);
    await keep(page, `hero-mode-ability-${lang}`);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await abilityLabelsFit(page, ids.vale, `landscape ${lang}`);
    await tap('#hero-hud [data-hero="exit"]');
    await page.waitForFunction(() => !window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    await page.locator("#hero-mode-btn").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await assertButtonClear(page, tap, `landscape ${lang}`);
    assert.deepEqual(errors, [], `${lang}: page errors`);
    await page.close();
  }
}, { browser });
