// Skywing's own model and land / walk / take off in the browser (owner 2026-11-28; src/skywing-view.js,
// src/hero-mode.js, src/sim/content/skywing.js, tools/blender/generate_skywing.py):
//   desktop    Skywing draws its own pilot model (not the Kite; a Kite scout keeps the Kite), prone in flight with the
//              wings spread and the weapon in hand shown; Hero mode's 44 px "Land" button (R) glides it down under the
//              reticle: the camera blends to the shoulder view, the wings fold, Dive strike greys out with "Air only",
//              the label turns to "Take off", W walks it and a tank can now shoot it; "Take off" climbs (still hittable)
//              and the look-down view comes back; the button waits out the cooldown; landed vs flying draws <= +5.
//   portrait / landscape  the Land tile sits with Ability, Dodge and Fire and overlaps nothing, in EN, VI and KO.
// Every HUD: taps >= 44 px, text >= 11 px, no system-ui. The match clock is held and moved only with step().
import assert from "node:assert/strict";
import { mkdirSync, copyFileSync } from "node:fs";
import { launchBrowser, openPage, shot, suite, TIMEOUT, OUTPUT } from "./lib/harness.mjs";

const SHOTS = process.env.SKYLAND_SHOTS || null; // a folder to copy the owner's screenshots into
async function keep(page, name) {
  await shot(page, name);
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); copyFileSync(`${OUTPUT}/${name}.png`, `${SHOTS}/${name}.png`); }
}

// The hero HUD: taps, text, fonts, nothing off screen, and no two buttons overlapping.
async function audit(page, label) {
  const bad = await page.evaluate(() => {
    const out = [], root = document.querySelector("#hero-hud");
    const buttons = [...root.querySelectorAll("button")].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== "hidden");
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) out.push(`tap ${b.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) out.push(`off screen ${b.textContent.trim()}`);
      if (b.scrollWidth > b.clientWidth + 2 || b.scrollHeight > b.clientHeight + 2) out.push(`label spills ${b.textContent.trim()}`);
    }
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
      const a = buttons[i].getBoundingClientRect(), c = buttons[j].getBoundingClientRect();
      if (buttons[i].contains(buttons[j]) || buttons[j].contains(buttons[i])) continue;
      const x = Math.min(a.right, c.right) - Math.max(a.left, c.left), y = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (x > 0.5 && y > 0.5) out.push(`overlap ${buttons[i].textContent.trim()} / ${buttons[j].textContent.trim()}`);
    }
    for (const n of root.querySelectorAll("*")) {
      if (!n.getClientRects().length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (parseFloat(cs.fontSize) < 11) out.push(`text ${n.textContent.trim().slice(0, 20)} ${cs.fontSize}`);
      if (/system-ui/.test(cs.fontFamily)) out.push(`system-ui ${n.tagName}`);
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push("sideways scroll");
    return out;
  });
  assert.deepEqual(bad, [], `${label}: ${bad.join(", ")}`);
}

const info = (page) => page.evaluate(() => window.__frontier.heroMode.info);
const pitch = (page) => page.evaluate(() => { const m = window.__frontier.view.camera.matrixWorld.elements; return (Math.atan2(m[9], Math.hypot(m[8], m[10])) * 180) / Math.PI; });
const step = async (page, seconds, n = 1) => { for (let i = 0; i < n; i++) { await page.evaluate((s) => window.__frontier.step(s), seconds); await page.waitForTimeout(60); } };
// A skirmish with Skywing over open ground at the middle, a tank and riflemen ahead (held), everything seen.
async function battle(page, tap) {
  await tap('[data-mode="skirmish"]');
  await tap("#start");
  await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
  const ids = await page.evaluate(() => {
    const f = window.__frontier, s = f.sim;
    f.hold = true; f.holdMessages = true; s.explored[0].fill(1);
    s.command({ team: 0, type: "skywing" });
    const e = s.get(s.skywing.id);
    e.x = 0; e.z = 0; e.post = { x: 0, z: 0 }; e.angle = 0;
    const tank = s.spawn("tank", 1, 3, 16, true, true); tank.orders = []; tank.stance = "hold";
    for (let i = 0; i < 3; i++) { const t = s.spawn("ranger", 1, -3 + i * 2, 13, true, true); t.orders = []; t.stance = "hold"; }
    const kite = s.spawn("kite", 0, -6, -4, true, true);
    s.updateVision();
    f.step(0.1);
    return { sky: e.id, tank: tank.id, kite: kite.id };
  });
  // Skywing's own model streams in after the match starts (view.js modelKey).
  await page.waitForFunction((id) => window.__frontier.view.objects.get(id)?.userData.type === "skywing", ids.sky, { timeout: TIMEOUT.models });
  return ids;
}
const enterSky = async (page, id) => {
  await page.evaluate((id) => window.__frontier.heroMode.enter(id), id);
  await page.waitForFunction(() => window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
  await step(page, 0.1, 2);
};

const browser = await launchBrowser();
await suite("skywing-land", async () => {
  // ---------------------------------------------------------------- desktop
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await goto();
    await ready();
    const ids = await battle(page, tap);
    const look = await page.evaluate(([sky, kite]) => {
      const v = window.__frontier.view, a = v.objects.get(sky).userData, k = v.objects.get(kite).userData;
      const w = a.skywing.weapons;
      return { sky: a.type, kite: k.type, sniper: !!w.sniper?.visible, rocket: !!w.rocket?.visible, rig: a.rig?.kind };
    }, [ids.sky, ids.kite]);
    assert.deepEqual(look, { sky: "skywing", kite: "kite", sniper: true, rocket: false, rig: "infantry" }, "its own model, the sniper in hand; the Kite scout keeps the Kite");
    await page.evaluate((id) => { const f = window.__frontier, e = f.sim.get(id); f.view.focusOn(e.x, e.z); }, ids.sky);
    await page.waitForTimeout(300);
    await keep(page, "skyland-rts");
    // Draws in Hero mode, flying, for the budget below.
    const count = () => page.evaluate(() => { const f = window.__frontier, v = f.view, r = v.renderer; r.info.reset(); r.info.autoReset = false; v.update(f.sim, 0, f.selected, null); const n = r.info.render.calls; r.info.autoReset = true; return n; });
    await enterSky(page, ids.sky);
    const fly = await page.evaluate((id) => { const u = window.__frontier.view.objects.get(id).userData; return { f: u.skywing.f, pose: u.rig.motion[2] }; }, ids.sky);
    assert.ok(fly.f > 0.99 && fly.pose < -0.99, `prone, wings spread: ${JSON.stringify(fly)}`);
    const down = await pitch(page);
    assert.ok(down >= 44 && down <= 61, `the look-down camera ${down.toFixed(1)}`);
    const land = page.locator('#hero-hud [data-hero="land"]');
    await land.waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.equal((await land.locator(".hh-land-name").textContent()).trim(), "Land");
    assert.equal((await land.locator("kbd").textContent()).trim(), "R");
    await audit(page, "desktop flying");
    await page.waitForTimeout(200);
    const drawsFly = await count();
    await keep(page, "skyland-hero-flying");
    // A sniper switch shows the rocket in hand once drawn.
    await page.keyboard.press("e");
    await step(page, 0.3, 5);
    assert.equal(await page.evaluate((id) => window.__frontier.view.objects.get(id).userData.skywing.weapons.rocket.visible, ids.sky), true, "the rocket in hand");
    // R lands under the reticle: one logged command with the aim point.
    await page.keyboard.press("r");
    const sent = await page.evaluate(() => window.__frontier.sim.commandLog.filter((c) => c.type === "skywingLand"));
    assert.equal(sent.length, 1);
    assert.ok(sent[0].land === true && Number.isFinite(sent[0].x) && Number.isFinite(sent[0].z), JSON.stringify(sent[0]));
    await step(page, 0.1, 3);
    assert.equal(await land.isDisabled(), true, "no second press mid-glide");
    await keep(page, "skyland-hero-landing");
    await step(page, 0.1, 4);
    await page.waitForFunction(() => window.__frontier.heroMode.info.flight < 0.01, null, { timeout: TIMEOUT.step });
    const st = await page.evaluate((id) => { const f = window.__frontier, e = f.sim.get(id), u = f.view.objects.get(id).userData; return { flying: e.flying, landed: e.landed, pose: u.rig.motion[2], f: u.skywing.f }; }, ids.sky);
    assert.ok(!st.flying && st.landed && st.pose > -0.01 && st.f < 0.01, `landed, upright, wings folded: ${JSON.stringify(st)}`);
    const shoulder = await pitch(page);
    assert.ok(shoulder < 30, `the shoulder view on foot: ${shoulder.toFixed(1)}`);
    assert.equal((await land.locator(".hh-land-name").textContent()).trim(), "Take off");
    const ability = page.locator('#hero-hud [data-hero="ability"]');
    assert.equal(await ability.isDisabled(), true, "Dive strike greys out on foot");
    assert.equal((await ability.locator(".hh-why").textContent()).trim(), "Air only");
    assert.equal(await page.evaluate(([sky, tank]) => { const s = window.__frontier.sim; return s.canHit(s.get(tank), s.get(sky)); }, [ids.sky, ids.tank]), true, "a tank can shoot it now");
    await audit(page, "desktop landed");
    const drawsLand = await count();
    // The scene totals differ with the view (look-down vs shoulder); the model itself: its own batches (one per part and
    // material, the weapon in hand only) against the Kite scout's.
    const own = await page.evaluate(([sky, kite]) => {
      const v = window.__frontier.view, parts = (id) => { const keys = new Set(); v.objects.get(id).userData.model.traverse((o) => { if (o.isMesh && o.visible && o.parent.visible && o.layers.mask === 2) keys.add(`${o.geometry.id}:${o.material.id}`); }); return keys.size; };
      return { sky: parts(sky), kite: parts(kite) };
    }, [ids.sky, ids.kite]);
    console.log(`  desktop: draws flying ${drawsFly}, landed ${drawsLand}; Skywing's own batches ${own.sky}, the Kite's ${own.kite}`);
    assert.ok(own.sky <= own.kite, `Skywing draws ${own.sky} batches, the Kite ${own.kite}`);
    await keep(page, "skyland-hero-landed");
    // W walks it like a ground hero.
    const at = await page.evaluate((id) => { const e = window.__frontier.sim.get(id); return { x: e.x, z: e.z }; }, ids.sky);
    await page.keyboard.down("w");
    await page.waitForFunction(() => window.__frontier.heroMode.info.sent.drive !== "0,0", null, { timeout: TIMEOUT.step });
    await step(page, 0.25, 4);
    await keep(page, "skyland-hero-walking");
    await page.keyboard.up("w");
    const walked = await page.evaluate(([id, a]) => { const e = window.__frontier.sim.get(id); return { d: Math.hypot(e.x - a.x, e.z - a.z), flying: e.flying }; }, [ids.sky, at]);
    assert.ok(walked.d > 1.5 && !walked.flying, `walked ${walked.d.toFixed(2)} m on foot`);
    // Take off: a climb that ground weapons still hit, then the look-down view; the button waits out the cooldown.
    await land.click();
    await step(page, 0.1, 3);
    assert.equal(await page.evaluate(([sky, tank]) => { const s = window.__frontier.sim; return !s.get(sky).flying && s.canHit(s.get(tank), s.get(sky)); }, [ids.sky, ids.tank]), true, "hittable while it climbs");
    await step(page, 0.2, 4);
    await page.waitForFunction(() => window.__frontier.heroMode.info.flight > 0.99, null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate((id) => window.__frontier.sim.get(id).flying, ids.sky), true, "airborne");
    assert.equal((await land.locator(".hh-land-name").textContent()).trim(), "Land");
    assert.equal(await land.isDisabled(), true, "cooling down");
    await step(page, 0.5, 4);
    await page.waitForTimeout(200);
    assert.equal(await land.isDisabled(), false, "ready again");
    assert.ok((await pitch(page)) >= 44, "back to the look-down view");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => !window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    assert.deepEqual(errors, [], "desktop: page errors");
    await page.close();
  }
  // ---------------------------------------------------------------- phones: the Land tile in EN, VI and KO
  for (const lang of ["en", "vi", "ko"]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, "portrait", lang === "en" ? {} : { deviceScaleFactor: 3 });
    await goto();
    if (lang !== "en") {
      await page.evaluate((lang) => { const k = "frontier-command.settings.v1"; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || "{}"), version: 1, language: lang })); }, lang);
      await page.reload();
    }
    await ready();
    const ids = await battle(page, tap);
    await enterSky(page, ids.sky);
    await page.waitForFunction(() => document.documentElement.classList.contains("hero-phone"), null, { timeout: TIMEOUT.step });
    await audit(page, `portrait ${lang} flying`);
    if (lang === "en") await keep(page, "skyland-phone-flying");
    await tap('#hero-hud [data-hero="land"]');
    await step(page, 0.1, 8);
    await page.waitForFunction(() => window.__frontier.heroMode.info.flight < 0.01, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(300);
    await audit(page, `portrait ${lang} landed`);
    if (lang === "en") await keep(page, "skyland-phone-landed");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await audit(page, `landscape ${lang} landed`);
    if (lang === "en") await keep(page, "skyland-landscape-landed");
    await tap('#hero-hud [data-hero="land"]');
    await step(page, 0.2, 6);
    await page.waitForFunction(() => window.__frontier.heroMode.info.flight > 0.99, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(300);
    await audit(page, `landscape ${lang} flying`);
    if (lang !== "en") assert.equal((await page.locator('#hero-hud .hh-land-name').textContent()).trim(), lang === "vi" ? "Hạ cánh" : "착륙");
    assert.deepEqual(errors, [], `${lang}: page errors`);
    await page.close();
  }
}, { browser });
