// H8 Hero challenges and fight feel in the browser (src/hero-challenges-ui.js, src/challenge-view.js,
// src/hazard-view.js, src/hero-mode.js; rules: src/sim/content/hero-challenges.js, src/sim/hero-feel.js,
// src/sim/hazards.js):
//   title      the row of challenge tiles under the quick row (Hero battle's row): one flat tile per challenge, 44 px
//              and up, text 11 px and up, no overlap, the best stars shown; in EN, VI and KO on a PC and phones
//   sabotage   a tile tap starts it straight in Hero mode as Skywing on foot, unseen (no steward); the strip shows the
//              goal, the time and "Unseen"; the watchers' cones draw (1 draw); stepping into a cone fills the meter to
//              the alarm (never a failure); G held beside a relay plants (the Plant button shows there), the relay
//              blows; both relays and the way out win: the result card with stars, coins and Retry
//   sniper     landing in the marked nest starts the convoy (target rings); the scoped Sniper's hit shows the hit
//              marker, a damage number and a kill notice; X reloads, C crouches by cover ("Crouched"); a barrel under
//              the crosshair tints the reticle and blows (Barrel blast); the draw budget: a challenge adds at most 3
//              draws to Hero mode
//   phones     portrait and landscape: the HUD (strip, Plant tile, actions) fits, 44 px taps, 11 px text, no overlap,
//              in EN, VI and KO; the Plant tile is held by touch
// The match clock is held and moved only with step() (CI runs at about 1 fps); messages are held.
import assert from "node:assert/strict";
import { mkdirSync, copyFileSync } from "node:fs";
import { launchBrowser, openPage, shot, suite, TIMEOUT, OUTPUT } from "./lib/harness.mjs";
import { inShard, shardLabel } from "./lib/shard.mjs";

const SHOTS = process.env.CHALLENGE_SHOTS || null; // a folder to copy the owner's screenshots into
async function keep(page, name) {
  await shot(page, name);
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); copyFileSync(`${OUTPUT}/${name}.png`, `${SHOTS}/${name}.png`); }
}
const step = async (page, seconds, n = 1) => { for (let i = 0; i < n; i++) { await page.evaluate((s) => window.__frontier.step(s), seconds); await page.waitForTimeout(40); } };
const setLanguage = async (page, lang) => {
  await page.evaluate((lang) => { const k = "frontier-command.settings.v1"; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || "{}"), version: 1, language: lang })); }, lang);
  await page.reload();
};

// Taps, text, fonts, nothing off screen, no two buttons overlapping, inside `root` (a selector).
async function audit(page, root, label) {
  const bad = await page.evaluate((sel) => {
    const out = [], box = document.querySelector(sel);
    if (!box) return [`no ${sel}`];
    const buttons = [...box.querySelectorAll("button")].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== "hidden");
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) out.push(`tap ${b.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) out.push(`off screen ${b.textContent.trim()}`);
      if (b.scrollWidth > b.clientWidth + 2 || b.scrollHeight > b.clientHeight + 2) out.push(`label spills ${b.textContent.trim()}`);
    }
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
      if (buttons[i].contains(buttons[j]) || buttons[j].contains(buttons[i])) continue;
      const a = buttons[i].getBoundingClientRect(), c = buttons[j].getBoundingClientRect();
      if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 0.5 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 0.5) out.push(`overlap ${buttons[i].textContent.trim()} / ${buttons[j].textContent.trim()}`);
    }
    for (const n of box.querySelectorAll("*")) {
      if (!n.getClientRects().length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (parseFloat(cs.fontSize) < 11) out.push(`text ${n.textContent.trim().slice(0, 20)} ${cs.fontSize}`);
      if (/system-ui/.test(cs.fontFamily)) out.push(`system-ui ${n.tagName}`);
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push("sideways scroll");
    return out;
  }, root);
  assert.deepEqual(bad, [], `${label}: ${bad.join(", ")}`);
}
// The strip inside the screen and clear of every HUD button.
async function stripClear(page, label) {
  const bad = await page.evaluate(() => {
    const s = document.querySelector(".hc-strip"), out = [];
    if (!s || s.hidden) return ["no strip"];
    const r = s.getBoundingClientRect();
    if (r.left < 0 || r.right > innerWidth || r.top < 0) out.push("strip off screen");
    for (const b of document.querySelectorAll("#hero-hud button")) {
      if (!b.getClientRects().length || b.hidden) continue;
      const c = b.getBoundingClientRect();
      if (Math.min(r.right, c.right) - Math.max(r.left, c.left) > 0.5 && Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) > 0.5) out.push(`strip over ${b.textContent.trim()}`);
    }
    return out;
  });
  assert.deepEqual(bad, [], `${label}: ${bad.join(", ")}`);
}
const info = (page) => page.evaluate(() => window.__frontier.heroMode.info);
async function startChallenge(page, tap, id) {
  await page.evaluate(() => window.__frontier.heroChallenges.reset());
  await tap(`[data-hero-challenge="${id}"]`);
  await page.waitForFunction(() => window.__frontier.started && window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.models });
  await page.evaluate(() => { const f = window.__frontier; f.hold = true; f.holdMessages = true; });
  await step(page, 0.1, 2);
}
// The hero set at (x, z) (a hook: the walk itself is covered by hero-mode and skywing-land).
const put = (page, x, z, angle = null) => page.evaluate(([x, z, angle]) => { const s = window.__frontier.sim, h = s.get(s.skywing.id); h.x = x; h.z = z; h.post = { x, z }; if (angle !== null) h.angle = angle; s.updateVision(); }, [x, z, angle]);
const challenge = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__frontier.sim.challenge)));
const viewPart = (page, key) => page.evaluate((key) => { const p = window.__frontier.view.plugins.list.find((q) => q && Object.hasOwn(q, key)); return p ? JSON.parse(JSON.stringify(p.drawn || { mesh: !!p.mesh, count: p.mesh?.count ?? 0 })) : null; }, key);
const draws = (page) => page.evaluate(() => { const f = window.__frontier, v = f.view, r = v.renderer; r.info.reset(); r.info.autoReset = false; v.update(f.sim, 0, f.selected, null); const n = r.info.render.calls; r.info.autoReset = true; return n; });

const browser = await launchBrowser();
// Five units of work (CI may split them): the title row (0), Sabotage on a PC (1), Sniper nest and the fight feel on a
// PC (2), portrait phones (3), landscape phones (4).
await suite("hero-challenges" + shardLabel, async () => {
  // ---------------------------------------------------------------- the title row in EN, VI and KO
  for (const [viewport, lang] of inShard(0) ? [["desktop", "en"], ["desktop", "vi"], ["portrait", "en"], ["portrait", "ko"], ["landscape", "vi"], ["landscape", "ko"]] : []) {
    const { page, goto, ready, errors } = await openPage(browser, viewport);
    await goto();
    if (lang !== "en") await setLanguage(page, lang);
    await ready();
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector("#hero-challenges")?.scrollIntoView({ block: "nearest" }));
    const row = await page.evaluate(() => {
      const r = document.querySelector("#hero-challenges"), q = document.querySelector("#title-actions");
      const tiles = [...(r?.querySelectorAll("[data-hero-challenge]") || [])];
      const compact = document.documentElement.classList.contains("compact-ui");
      return { shown: !!r && !r.hidden, after: compact ? r?.nextElementSibling?.id === "daily-challenges" : q?.nextElementSibling === r, ids: tiles.map((b) => b.dataset.heroChallenge), stars: tiles.map((b) => b.querySelector(".hct-stars").textContent), names: tiles.map((b) => b.querySelector("strong").textContent.trim()) };
    });
    assert.ok(row.shown && row.after, `${viewport} ${lang}: under the quick row (phones: beside the daily challenges)`);
    assert.deepEqual(row.ids, ["sabotage", "sniper"]);
    assert.deepEqual(row.stars, ["☆☆☆", "☆☆☆"], "no stars yet");
    if (lang === "vi") assert.deepEqual(row.names, ["Phá hoại", "Ổ bắn tỉa"]);
    if (lang === "ko") assert.deepEqual(row.names, ["파괴 공작", "저격 둥지"]);
    await audit(page, "#hero-challenges", `${viewport} ${lang} title row`);
    await keep(page, `hc-title-${viewport}-${lang}`);
    assert.deepEqual(errors, [], `${viewport} ${lang}: page errors`);
    await page.close();
  }

  // ---------------------------------------------------------------- Sabotage on a PC
  if (inShard(1)) {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await goto();
    await ready();
    await startChallenge(page, tap, "sabotage");
    const start = await page.evaluate(() => { const f = window.__frontier, s = f.sim, h = s.get(s.skywing.id); return { landed: h.landed, cloaked: h.cloaked, steward: !!s.steward?.[0] || !!document.querySelector(".steward-strip:not([hidden])"), quick: f.sim.missionDef?.challenge?.id }; });
    assert.deepEqual({ landed: start.landed, cloaked: start.cloaked, quick: start.quick }, { landed: true, cloaked: true, quick: "sabotage" }, "Skywing on foot, unseen");
    const strip = await page.evaluate(() => ({ goal: document.querySelector(".hcs-goal").textContent, state: document.querySelector(".hcs-state").textContent, count: document.querySelector(".hcs-count").textContent }));
    assert.deepEqual(strip, { goal: "Plant charges on both signal relays", state: "Unseen", count: "0/2" });
    await audit(page, "#hero-hud", "desktop sabotage HUD");
    await stripClear(page, "desktop sabotage");
    // A patrol's cone, near the first one.
    await put(page, -4, -9.8);
    await step(page, 0.1, 3);
    const cones = await viewPart(page, "cones");
    assert.ok(cones.cones >= 1, `the cone of a watcher in sight draws: ${JSON.stringify(cones)}`);
    await keep(page, "hc-sabotage-cones");
    // Into the cone, in the open: the meter fills to the alarm, which is no failure.
    const w = await page.evaluate(() => { const s = window.__frontier.sim, w = s.entities.find((e) => e.tag === "patrol"); w.orders = []; return { x: w.x + Math.sin(w.angle) * 5, z: w.z + Math.cos(w.angle) * 5 }; });
    await put(page, w.x, w.z);
    await step(page, 0.1, 2);
    assert.ok((await challenge(page)).sus > 0, "seen: the meter fills");
    await page.waitForFunction(() => document.querySelector(".hcs-watch").dataset.state !== "unseen", null, { timeout: TIMEOUT.step });
    await keep(page, "hc-sabotage-seen");
    await step(page, 0.1, 10);
    const alarm = await challenge(page);
    assert.equal(alarm.alarm, true, "the alarm");
    assert.equal(await page.evaluate(() => window.__frontier.sim.result), null, "not a failure");
    assert.equal(await page.evaluate(() => document.querySelector(".hcs-state").textContent), "Alarm");
    await keep(page, "hc-sabotage-alarm");
    // Beside relay A (the watchers stand still and hold fire for the rest): G held plants.
    await page.evaluate(() => { const s = window.__frontier.sim; for (const e of s.entities) if (e.team === 1 && e.kind === "unit") { e.damage = 0; e.orders = []; e.watch = 0; } });
    const relay = await page.evaluate(() => { const r = window.__frontier.sim.tagged("relayA")[0]; return { x: r.x - r.radius - 1, z: r.z }; });
    await put(page, relay.x, relay.z, Math.PI / 2);
    await step(page, 0.1, 2);
    await page.waitForFunction(() => { const b = document.querySelector(".hh-plant"); return !!b && !b.hidden; }, null, { timeout: TIMEOUT.step });
    await audit(page, "#hero-hud", "desktop Plant button");
    await page.keyboard.down("g");
    await step(page, 0.1, 6);
    await keep(page, "hc-sabotage-planting");
    await step(page, 0.1, 6);
    await page.keyboard.up("g");
    assert.equal((await challenge(page)).charges.relayA.set, true, "relay A set");
    await step(page, 0.1, 24);
    await keep(page, "hc-sabotage-relay-blast");
    assert.equal(await page.evaluate(() => window.__frontier.sim.tagged("relayA").length), 0, "relay A blown");
    // Relay B by the same key, then the way out.
    const b = await page.evaluate(() => { const r = window.__frontier.sim.tagged("relayB")[0]; return { x: r.x - r.radius - 1, z: r.z }; });
    await put(page, b.x, b.z, Math.PI / 2);
    await step(page, 0.1, 2);
    await page.keyboard.down("g");
    await step(page, 0.1, 12);
    await page.keyboard.up("g");
    await step(page, 0.1, 24);
    const out = await page.evaluate(() => { const p = window.__frontier.sim.missionPlace("extract"); return { x: p.x, z: p.z }; });
    assert.equal(await page.evaluate(() => document.querySelector(".hcs-goal").textContent), "Escape to the extraction point");
    await put(page, out.x, out.z);
    // The winning tick runs on the page's own clock (the result opens from the frame that ends the match).
    await page.evaluate(() => { window.__frontier.hold = false; });
    await page.waitForFunction(() => !document.querySelector("#modal").hidden && !!document.querySelector(".hc-result"), null, { timeout: TIMEOUT.step });
    const result = await page.evaluate(() => { const r = document.querySelector(".hc-result"); return { stars: +r.dataset.stars, fresh: +r.dataset.newStars, reasons: [...r.querySelectorAll(".hc-reasons li")].map((l) => l.className), coins: +(document.querySelector(".coin-toast")?.dataset.total || 0), retry: !!r.querySelector("[data-restart]"), next: r.querySelector("[data-hero-challenge-next]")?.dataset.heroChallengeNext, best: window.__frontier.heroChallenges.progress.best.sabotage }; });
    assert.equal(result.stars, 2, "done and quick, not unseen");
    assert.deepEqual(result.reasons, ["got", "miss", "got"]);
    assert.equal(result.fresh, 2);
    assert.ok(result.coins > 0, "coins paid");
    assert.ok(result.retry && result.next === "sniper");
    assert.equal(result.best, 2, "the best is kept");
    await audit(page, "#modal", "desktop result card");
    await keep(page, "hc-sabotage-result");
    assert.deepEqual(errors, [], "page errors");
    await page.close();
  }

  // ---------------------------------------------------------------- Sniper nest and the fight feel on a PC
  if (inShard(2)) {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await goto();
    await ready();
    await startChallenge(page, tap, "sniper");
    assert.equal(await page.evaluate(() => window.__frontier.sim.get(window.__frontier.sim.skywing.id).flying), true, "Sniper nest starts in the air");
    const nest = await page.evaluate(() => { const p = window.__frontier.sim.missionPlace("nest"); return { x: p.x, z: p.z }; });
    await put(page, nest.x - 1, nest.z + 1);
    await page.evaluate(([x, z]) => { const s = window.__frontier.sim; s.command({ team: 0, type: "skywingLand", id: s.skywing.id, land: true, x, z }); }, [nest.x, nest.z]);
    await step(page, 0.1, 14);
    const c = await challenge(page);
    assert.ok(c.inNest && c.group === 1, `in the nest, the convoy set off: ${JSON.stringify(c)}`);
    await keep(page, "hc-sniper-nest");
    // Two trucks and an escort pulled near the nest, held, so the shots are quick.
    const ids = await page.evaluate(() => {
      const s = window.__frontier.sim, h = s.get(s.skywing.id);
      const trucks = s.tagged("convoy"), escort = s.tagged("escort")[0];
      trucks.forEach((t, i) => { t.x = h.x - 9; t.z = h.z - 4 + i * 4; t.orders = []; });
      escort.x = h.x - 8; escort.z = h.z + 6; escort.orders = []; escort.damage = 0; escort.stance = "hold"; escort.hp = 20; escort.shield = 0;
      h.angle = -Math.PI / 2;
      s.updateVision();
      return { truck: trucks[0].id, escort: escort.id };
    });
    await step(page, 0.1, 2);
    await page.waitForFunction(() => window.__frontier.view.plugins.list.some((p) => p?.drawn?.marks >= 2), null, { timeout: TIMEOUT.step });
    await keep(page, "hc-sniper-convoy");
    // The budget (owner: at most +3 draws in a challenge over Hero mode): the cones, the markers and the hazards, one
    // draw each, and nothing else of ours.
    const ours = await page.evaluate(() => {
      const v = window.__frontier.view, names = new Set(["WatchCones", "ChallengeMarks", "Hazards"]), seen = [];
      v.scene.traverse((o) => { if (names.has(o.name) && o.visible) seen.push(o.name); });
      return seen;
    });
    console.log(`  challenge draws of its own: ${ours.join(", ")} (${ours.length}); frame ${await draws(page)}`);
    assert.ok(ours.length <= 3, `at most 3: ${ours.join(", ")}`);
    // A hit: the hit marker, a damage number and, on the kill, a notice.
    await page.evaluate((id) => { const s = window.__frontier.sim, h = s.get(s.skywing.id); h.cooldown = 0; s.command({ team: 0, type: "heroFire", target: id, hold: false }); }, ids.escort);
    await step(page, 0.1, 3);
    await page.waitForFunction(() => window.__frontier.heroMode.info.hits > 0, null, { timeout: TIMEOUT.step });
    const hit = await info(page);
    assert.ok(hit.kills >= 1 && hit.feed.length >= 1, `the kill notice: ${JSON.stringify(hit.feed)}`);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll(".hh-dmg")].some((d) => !d.hidden)), "a damage number");
    await keep(page, "hc-hit-marker");
    // X reloads a magazine that is not full; the pips show it.
    const mag = await page.evaluate(() => { const s = window.__frontier.sim; return s.get(s.skywing.id).mag; });
    await page.keyboard.press("x");
    await step(page, 0.1, 1);
    const re = await page.evaluate(() => { const s = window.__frontier.sim, h = s.get(s.skywing.id); return { mag: h.mag, reloading: s.time < (h.reloadAt ?? -1), label: !document.querySelector(".hh-reload").hidden }; });
    assert.ok(mag < 5 && re.mag === 5 && re.reloading && re.label, `reload: ${mag} -> ${JSON.stringify(re)}`);
    await keep(page, "hc-reload");
    // C crouches beside the nest's sandbags.
    await page.keyboard.press("c");
    const bags = await page.evaluate(() => { const p = window.__frontier.sim.cover[0]; return { x: p[1], z: p[2] + 0.95 }; });
    await put(page, bags.x, bags.z);
    await step(page, 0.1, 6);
    assert.equal(await page.evaluate(() => !document.querySelector(".hh-crouch").hidden), true, "Crouched");
    await keep(page, "hc-crouched");
    // A barrel: the reticle tints, a shot sets it off.
    const barrel = await page.evaluate(() => {
      // Six metres short of it along the camera's heading, so it sits ahead on screen.
      const f = window.__frontier, s = f.sim, h = s.get(s.skywing.id), i = s.hazards.findIndex((z) => z[2]), yaw = f.heroMode.info.yaw;
      const [x, z] = s.hazards[i];
      h.x = x - Math.sin(yaw) * 6; h.z = z - Math.cos(yaw) * 6; h.angle = yaw; h.cooldown = 0; s.updateVision();
      return i;
    });
    await page.mouse.move(100, 100);
    await step(page, 0.1, 2);
    // The shoulder camera follows the hero smoothly (damped), so after the jump above it glides for a while; on a slow
    // runner (about 1 fps) it is still moving when the barrel is projected. Re-project and re-aim until the crosshair
    // holds the barrel (or the tries run out), instead of aiming once at where the barrel was.
    // Only the first try steps the match; later tries just re-aim, so the match state the checks below expect is unchanged.
    for (let tryNo = 0; tryNo < 4; tryNo++) {
      const aim = await page.evaluate((i) => { const f = window.__frontier, v = f.view, [x, z] = f.sim.hazards[i]; const q = v.project(x, z, v.terrain.heightAt(x, z) + 0.4), r = v.renderer.domElement.getBoundingClientRect(); return { x: q.x + r.left, y: q.y + r.top }; }, barrel);
      await page.mouse.move(aim.x, aim.y);
      if (tryNo === 0) await step(page, 0.1, 2);
      // The aim is taken in the frame: wait for it.
      const got = await page.waitForFunction((i) => window.__frontier.heroMode.info.barrel === i, barrel, { timeout: TIMEOUT.step / 2 }).then(() => true, () => false);
      if (got) break;
    }
    const aimed = await info(page);
    assert.equal(aimed.barrel, barrel, `the crosshair finds the barrel ${JSON.stringify({ target: aimed.target, aim: aimed.aim, screen: aimed.screen })}`);
    // The HUD draws the tint in its own frame (about 1 fps on a CI runner): wait for it.
    const tinted = await page.waitForFunction(() => document.querySelector(".hh-cross").classList.contains("on-hazard"), null, { timeout: TIMEOUT.step }).then(() => true, () => false);
    assert.equal(tinted, true, "the reticle tints");
    await keep(page, "hc-barrel-aim");
    await page.keyboard.down("f");
    for (let i = 0; i < 12 && await page.evaluate((i) => window.__frontier.sim.hazards[i][2], barrel); i++) await step(page, 0.05);
    await page.keyboard.up("f");
    assert.equal(await page.evaluate((i) => window.__frontier.sim.hazards[i][2], barrel), 0, "blown");
    await page.waitForFunction(() => window.__frontier.heroMode.info.blasts >= 1, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(120);
    await keep(page, "hc-barrel-blast");
    assert.deepEqual(errors, [], "page errors");
    await page.close();
  }

  // ---------------------------------------------------------------- phones: the HUD in EN, VI and KO
  for (const [viewport, lang] of [["portrait", "en"], ["portrait", "vi"], ["portrait", "ko"], ["landscape", "en"], ["landscape", "vi"], ["landscape", "ko"]]) {
    if (!inShard(viewport === "portrait" ? 3 : 4)) continue;
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport);
    await goto();
    if (lang !== "en") await setLanguage(page, lang);
    await ready();
    await page.evaluate(() => document.querySelector("#hero-challenges")?.scrollIntoView({ block: "nearest" }));
    await startChallenge(page, tap, "sabotage");
    await audit(page, "#hero-hud", `${viewport} ${lang} sabotage HUD`);
    await stripClear(page, `${viewport} ${lang}`);
    // Beside a relay: the Plant tile with the others, held by touch.
    await page.evaluate(() => { const s = window.__frontier.sim; for (const e of s.entities) if (e.team === 1 && e.kind === "unit") { e.damage = 0; e.orders = []; e.watch = 0; } });
    const relay = await page.evaluate(() => { const r = window.__frontier.sim.tagged("relayA")[0]; return { x: r.x - r.radius - 1, z: r.z }; });
    await put(page, relay.x, relay.z, Math.PI / 2);
    await step(page, 0.1, 2);
    await page.waitForFunction(() => { const b = document.querySelector(".hh-plant"); return !!b && !b.hidden; }, null, { timeout: TIMEOUT.step });
    await audit(page, "#hero-hud", `${viewport} ${lang} Plant tile`);
    await stripClear(page, `${viewport} ${lang} planting`);
    const plant = page.locator(".hh-plant");
    await plant.dispatchEvent("pointerdown", { pointerId: 11, pointerType: "touch", isPrimary: true });
    await step(page, 0.1, 12);
    await plant.dispatchEvent("pointerup", { pointerId: 11, pointerType: "touch", isPrimary: true });
    assert.equal((await challenge(page)).charges.relayA.set, true, `${viewport} ${lang}: planted by touch`);
    if (lang !== "en") assert.notEqual(await page.evaluate(() => document.querySelector(".hcs-goal").textContent), "Plant charges on both signal relays", "translated");
    // Phones crouch on their own: standing still by the relay's sandbags.
    await keep(page, `hc-phone-${viewport}-${lang}`);
    assert.deepEqual(errors, [], `${viewport} ${lang}: page errors`);
    await page.close();
  }
}, { browser });
