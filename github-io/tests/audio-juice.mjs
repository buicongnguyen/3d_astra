// Audio juice (AAA round 3, R3-U) in the browser, at 1440x900, 390x844 and 844x390:
//   - nothing sounds (no AudioContext, no audio engine) before the first gesture;
//   - selecting units chirps in the unit's voice, at most two barks a second however fast the clicks;
//   - every weapon class fires its own sound (flak, bomb release + whistle + blast, strafing run,
//     ground-to-air missile, heal beam, artillery lob whistle) and landings add the impact size layer;
//   - a boss stage and the phase-2 surge play their stingers; the victory stinger renders and plays;
//   - Settings > Audio has the "Quiet mode: no unit voices" switch (44 px row, 11 px text, no
//     sideways scroll); with it on, selections and orders make no bark while the battle still sounds;
//   - no page errors. Screenshot: test-results/audio-juice-<viewport>.png (the Audio tab).
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
const VIEWPORTS = (process.env.AUDIO_JUICE_VIEWPORTS || "desktop,portrait,landscape").split(",");

// Wraps the effect hook once: every sound heard is logged with its context time.
const listen = (page) => page.evaluate(() => {
  const sfx = window.__frontier.audio.sfx, heard = sfx.onPlay;
  window.__heard = [];
  sfx.onPlay = (name, gain, delay) => { window.__heard.push({ name, t: sfx.context.currentTime }); heard?.(name, gain, delay); };
});
const names = (page) => page.evaluate(() => window.__heard.map((h) => h.name));

await suite("audio-juice", async () => {
  for (const viewport of VIEWPORTS) {
    const o = await openPage(browser, viewport, { timeout: TIMEOUT.models }), { page, errors } = o;
    await o.goto();
    await o.ready();
    assert.equal(await page.evaluate(() => !!window.__frontier.audio), false, `${viewport}: no audio engine before a gesture`);
    await o.tap("#start");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.audio?.context.state === "running", null, { timeout: TIMEOUT.step });
    await listen(page);
    await page.evaluate(() => { window.__frontier.hold = true; });

    // Barks: a burst of selections gives one chirp; a second of clicking at most two.
    const burst = await page.evaluate(async () => {
      const f = window.__frontier, a = f.audio, ids = f.sim.own(0).filter((e) => e.kind === "unit").map((e) => e.id);
      const before = a.barks, t0 = a.context.currentTime;
      for (let i = 0; i < 12; i++) f.select(ids);
      // The gate runs on the audio clock: on a slow CI machine twelve selections can take longer than its
      // 0.25 s gap, and then a second chirp is right (still never more than two a second).
      const same = a.barks - before, slow = a.context.currentTime - t0 >= 0.25;
      for (let i = 0; i < 15; i++) { f.select(ids); await new Promise((r) => setTimeout(r, 100)); }
      return { same, slow, units: ids.length, barks: window.__heard.filter((h) => h.name.startsWith("bark:")).map((h) => h.t) };
    });
    assert.ok(burst.units > 0, `${viewport}: the player has units`);
    if (burst.slow) assert.ok(burst.same >= 1 && burst.same <= 2, `${viewport}: twelve selections (slower than the gap) chirp once or twice`);
    else assert.equal(burst.same, 1, `${viewport}: twelve instant selections chirp once`);
    for (const t of burst.barks) assert.ok(burst.barks.filter((u) => u >= t && u < t + 1).length <= 2, `${viewport}: at most two barks a second (${burst.barks.map((x) => x.toFixed(2))})`);
    assert.ok(burst.barks.length >= 2, `${viewport}: clicking for 1.5 s barks more than once`);

    // Weapon classes by the core (the player's own: always heard), one at a time with a clear budget.
    const classes = await page.evaluate(() => {
      const f = window.__frontier, a = f.audio, sim = f.sim, hq = sim.own(0).find((e) => e.type === "hq");
      const x = hq.x + 4, z = hq.z + 2, out = {};
      const fire = (label, ev) => {
        const b = a.sfx.budget; b.voices.length = 0; b.lastPlayed.clear(); b.recent.clear();
        const from = window.__heard.length;
        a.event({ x, z, tx: x + 5, tz: z, team: 0, ...ev }, sim);
        out[label] = window.__heard.slice(from).map((h) => h.name);
      };
      fire("tracer", { type: "shot", weapon: "ranger", unit: "ranger" });
      fire("shell", { type: "shot", weapon: "tank", unit: "tank" });
      fire("lob", { type: "shot", weapon: "breaker", unit: "breaker" });
      fire("flak", { type: "shot", weapon: "tower", unit: "tower", tAir: 3.6 });
      fire("missile", { type: "shot", weapon: "antitank", unit: "antitank", tAir: 3.6 });
      fire("bomb", { type: "shot", weapon: "ranger", unit: "glider", sAir: 3.6 });
      fire("firebomb", { type: "shot", weapon: "breaker", unit: "balloon", sAir: 3.6 });
      fire("strafe", { type: "shot", weapon: "ranger", unit: "hawk", sAir: 3.6 });
      fire("heal", { type: "support", weapon: "medic" });
      fire("flamer", { type: "shot", weapon: "scorcher", unit: "scorcher" });
      fire("boss", { type: "bossStage", id: hq.id, boss: "x", stage: 1 });
      fire("surge", { type: "bossSurge", id: hq.id, boss: "x", stage: 1, seconds: 3 });
      const b = a.sfx.budget; b.voices.length = 0; b.lastPlayed.clear(); b.recent.clear();
      out.victory = a.sfx.play("sting:victory");
      return out;
    });
    const has = (label, name) => assert.ok(classes[label].includes(name), `${viewport}: ${label} plays ${name} (${classes[label].join(", ")})`);
    has("tracer", "shot:rifle"); has("tracer", "impact:small");
    has("shell", "shot:tank"); has("shell", "hit:shell"); has("shell", "impact:heavy");
    has("lob", "shot:artillery"); has("lob", "incoming:lob"); has("lob", "hit:artillery");
    has("flak", "shot:flak"); has("flak", "hit:flak");
    has("missile", "shot:sam");
    has("bomb", "shot:bomb"); has("bomb", "incoming:bomb"); has("bomb", "hit:bomb");
    has("firebomb", "hit:firebomb");
    has("strafe", "shot:strafe");
    has("heal", "shot:heal");
    has("flamer", "shot:flame"); has("flamer", "impact:medium");
    has("boss", "sting:boss"); has("surge", "sting:surge");
    assert.equal(classes.victory, true, `${viewport}: the victory stinger plays`);
    const distinct = new Set((await names(page)).filter((n) => !n.startsWith("bark:")));
    assert.ok(distinct.size >= 12, `${viewport}: ${distinct.size} distinct sound ids`);

    // Settings > Audio: the quiet-mode switch, then no barks with it on.
    await o.tap("#pause");
    await o.tap("[data-settings]");
    await o.tap("#settings-tab-audio");
    const row = await page.evaluate(() => {
      const input = document.querySelector('[data-setting="quietMode"]'), r = input.closest(".setting-row"), box = r.getBoundingClientRect();
      return { label: r.textContent.trim(), h: box.height, font: parseFloat(getComputedStyle(r).fontSize), checked: input.checked, scroll: document.scrollingElement.scrollWidth, width: innerWidth };
    });
    assert.equal(row.label, "Quiet mode: no unit voices");
    assert.ok(row.h >= 44 && row.font >= 11, `${viewport}: quiet-mode row ${row.h} px tall, ${row.font} px text`);
    assert.equal(row.checked, false, "quiet mode is off by default");
    assert.ok(row.scroll <= row.width + 1, `${viewport}: no sideways scroll`);
    await page.locator('[data-setting="quietMode"]').scrollIntoViewIfNeeded();
    await shot(page, `audio-juice-${viewport}`);
    await o.tap('[data-setting="quietMode"]');
    await o.tap('[data-do="apply"]');
    const quiet = await page.evaluate(async () => {
      const f = window.__frontier, a = f.audio, ids = f.sim.own(0).filter((e) => e.kind === "unit").map((e) => e.id);
      const before = a.barks;
      for (let i = 0; i < 8; i++) { f.select(ids); a.order(i % 2 ? "move" : "attack", f.sim); await new Promise((r) => setTimeout(r, 150)); }
      const b = a.sfx.budget; b.voices.length = 0; b.lastPlayed.clear(); b.recent.clear();
      const played = a.sfx.played, hq = f.sim.own(0).find((e) => e.type === "hq");
      a.event({ type: "shot", weapon: "tank", unit: "tank", x: hq.x, z: hq.z, tx: hq.x + 4, tz: hq.z, team: 0 }, f.sim);
      return { saved: f.settings.quietMode, quiet: a.quiet, barks: a.barks - before, battle: a.sfx.played - played };
    });
    assert.equal(quiet.saved, true); assert.equal(quiet.quiet, true);
    assert.equal(quiet.barks, 0, `${viewport}: quiet mode mutes the barks`);
    assert.ok(quiet.battle >= 2, `${viewport}: quiet mode keeps the battle sounds`);
    // Leave the setting as found for the next viewport (settings persist in localStorage).
    await page.evaluate(() => { localStorage.clear(); });
    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
    console.log(`audio-juice ${viewport}: ${distinct.size} distinct ids, ${burst.barks.length} barks in 1.5 s of clicks`);
  }
}, { browser });
