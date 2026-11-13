// Recorded music (16.4) in the browser. The tiny fixture tracks in tests/fixtures/music/ are routed in
// as /music/* (the shipped public/music/manifest.json lists no tracks until the real files land).
// Checks: nothing under /music/ is fetched before the first gesture; the first tap on the start
// screen fetches and loops the title cue; the next cue is prefetched while idle; Campaign switches
// cue; a match crossfades to the adaptive score and drops the decoded loop; a result plays its sting
// once; "Adaptive only" fetches nothing; "Off" silences both; a missing file falls back to the
// adaptive score quietly; the precache list carries no audio; the Music row meets 44 px / 11 px and
// fits at 1440x900, 390x844 and 320x568 in English and Vietnamese.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TIMEOUT, baseUrl, launchBrowser, openPage, shot, suite } from "./lib/harness.mjs";

const FIXTURES = new URL("./fixtures/music/", import.meta.url);
const AUDIO = /\.(m4a|mp3|ogg|opus|wav|aac|flac|webm)(\?|$)/i;
const browser = await launchBrowser({ args: ["--autoplay-policy=user-gesture-required"] });

// Serves the fixtures for every /music/ request (names in `missing` answer 404) and lists the requests.
async function routeMusic(page, { missing = [] } = {}) {
  const requests = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.includes("/music/")) requests.push(request.url()); });
  await page.route(/\/music\//, (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    let body = null;
    try { if (!missing.includes(name)) body = readFileSync(new URL(name, FIXTURES)); } catch { body = null; }
    if (!body) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: name.endsWith(".json") ? "application/json" : "audio/mp4", body });
  });
  return requests;
}
const state = (page) => page.evaluate(() => window.__frontier.music?.state() ?? null);
const names = (requests) => requests.map((url) => new URL(url).pathname.split("/").pop());
// A plain tap on the start screen's heading: a gesture that presses no button.
const firstTap = (page, tap) => tap("#briefing-title");

await suite("music", async () => {
  // ---------------------------------------------------------------- recorded + adaptive (default)
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    const requests = await routeMusic(page);
    await goto();
    await ready();
    await page.waitForTimeout(1500);
    assert.deepEqual(requests, [], "nothing under /music/ before the first gesture");
    assert.equal(await page.evaluate(() => !!window.__frontier.audio), false, "no audio engine before the first gesture");

    await firstTap(page, tap);
    await page.waitForFunction(() => { const s = window.__frontier.music?.state(); return s?.cue === "title" && s.playing; }, null, { timeout: TIMEOUT.step });
    let s = await state(page);
    assert.equal(s.context, "running", "the AudioContext runs after the first tap");
    assert.deepEqual(s.loop, { loop: true, loopStart: 0, loopEnd: 2 }, "the title loops at the manifest's points");
    assert.ok(names(requests).includes("manifest.json") && names(requests).includes("title.m4a"), `title fetched: ${names(requests)}`);
    assert.ok(requests.some((url) => url.endsWith("title.m4a?v=9202")), "the track URL carries its byte count");
    assert.equal(await page.evaluate(() => window.__frontier.started), false, "the tap did not start a match");
    // The adaptive score stays silent under a recorded cue.
    await page.waitForFunction(() => window.__frontier.audio.music.active === false, null, { timeout: 5000 });

    // The next likely cue (Campaign) is fetched while idle, but not decoded.
    await page.waitForFunction(() => window.__frontier.music.state().encoded.includes("campaign"), null, { timeout: TIMEOUT.step });
    s = await state(page);
    assert.deepEqual(s.decoded, ["title"], `only the playing loop is decoded (${s.decoded})`);

    // Campaign: the campaign cue crossfades in and the title loop is no longer decoded.
    await tap('[data-mode="campaign"]');
    await page.waitForFunction(() => { const m = window.__frontier.music.state(); return m.cue === "campaign" && m.playing; }, null, { timeout: TIMEOUT.step });
    s = await state(page);
    assert.ok(!s.decoded.includes("title"), `title released (${s.decoded})`);
    await tap('[data-mode="skirmish"]');
    await page.waitForFunction(() => window.__frontier.music.state().cue === "title", null, { timeout: TIMEOUT.step });

    // A match: the recorded cue fades out while the adaptive score fades in.
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    await page.waitForFunction(() => { const a = window.__frontier.audio, m = a.recorded.state(); return m.want === null && m.cue === null && a.music.active; }, null, { timeout: 5000 });
    const mid = await page.evaluate(() => ({ fading: window.__frontier.music.state().fading, score: window.__frontier.audio.scoreGain.gain.value }));
    await page.waitForFunction(() => window.__frontier.audio.scoreGain.gain.value > 0.99 && window.__frontier.music.state().fading === 0, null, { timeout: 8000 });
    console.log("crossfade sample:", JSON.stringify(mid));
    s = await state(page);
    assert.ok(!s.decoded.includes("title") && !s.decoded.includes("campaign"), `no loop decoded in a match (${s.decoded})`);
    assert.equal(await page.evaluate(() => window.__frontier.audio.plan.adaptive), true, "the adaptive score rules the match");
    await page.waitForFunction(() => window.__frontier.audio.music.scheduled > 0, null, { timeout: 5000 });
    // The stings are decoded ahead while the match runs.
    await page.waitForFunction(() => ["victory", "defeat"].every((c) => window.__frontier.music.state().decoded.includes(c)), null, { timeout: TIMEOUT.step });

    // Victory: the recorded sting plays once over a fading score.
    await page.evaluate(() => { window.__frontier.sim.result = "victory"; });
    await page.waitForFunction(() => { const m = window.__frontier.music.state(); return m.cue === "victory" || (m.want === "victory" && m.cue === null); }, null, { timeout: TIMEOUT.step });
    s = await state(page);
    assert.equal(s.want, "victory");
    if (s.cue) assert.equal(s.loop.loop, false, "the sting does not loop");
    await page.waitForFunction(() => window.__frontier.audio.music.active === false, null, { timeout: 8000 });
    assert.ok(requests.every((url) => !url.includes("defence")), "the defence cue is not fetched outside Defence");
    assert.deepEqual(errors, [], "no page errors");
    await page.close();
  }

  // ---------------------------------------------------------------- Adaptive only, then Recorded, then Off
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await page.addInitScript(() => { try { if (!sessionStorage.getItem("music-test")) { sessionStorage.setItem("music-test", "1"); localStorage.setItem("frontier-command.settings.v1", JSON.stringify({ version: 1, music: "adaptive" })); } } catch { /* storage optional */ } });
    const requests = await routeMusic(page);
    await goto();
    await ready();
    await firstTap(page, tap);
    await page.waitForFunction(() => window.__frontier.audio?.music.active && window.__frontier.audio.music.scheduled > 0, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(3000);
    assert.equal(await page.evaluate(() => window.__frontier.settings.music), "adaptive");
    assert.deepEqual(requests, [], "Adaptive only fetches nothing under /music/");
    assert.equal((await state(page)).status, "idle");

    // Switching to Recorded + adaptive in Settings starts the title cue.
    await tap("#briefing-settings");
    await tap("#settings-tab-audio");
    await page.selectOption('[data-setting="music"]', "recorded");
    await tap('[data-do="apply"]');
    await page.waitForFunction(() => { const m = window.__frontier.music.state(); return m.cue === "title" && m.playing; }, null, { timeout: TIMEOUT.step });
    await page.waitForFunction(() => window.__frontier.audio.music.active === false, null, { timeout: 5000 });

    // Off: no recorded cue, no adaptive score, the music bus at zero; the tracks are forgotten.
    await tap("#briefing-settings");
    await tap("#settings-tab-audio");
    await page.selectOption('[data-setting="music"]', "off");
    await tap('[data-do="apply"]');
    await page.waitForFunction(() => { const a = window.__frontier.audio, m = a.recorded.state(); return m.cue === null && m.decoded.length === 0 && !a.music.active && a.levels.music === 0; }, null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("frontier-command.settings.v1")).music), "off", "the setting is saved");
    assert.deepEqual(errors, [], "no page errors");
    await page.close();
  }

  // ---------------------------------------------------------------- a missing track falls back quietly
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "portrait");
    await routeMusic(page, { missing: ["title.m4a"] });
    await goto();
    await ready();
    await firstTap(page, tap);
    await page.waitForFunction(() => window.__frontier.music?.state().failed.includes("title"), null, { timeout: TIMEOUT.step });
    await page.waitForFunction(() => window.__frontier.audio.music.active && window.__frontier.audio.plan.adaptive, null, { timeout: 5000 });
    assert.equal((await state(page)).cue, null);
    assert.deepEqual(errors, [], "a missing track raises no page error");
    await page.close();
  }

  // ---------------------------------------------------------------- the precache list carries no audio
  {
    const sw = await (await fetch(new URL("sw.js", baseUrl()))).text();
    const precache = JSON.parse(sw.match(/const PRECACHE = (\[[^\]]*\]);/)[1]);
    assert.ok(precache.length > 3, "the precache list was read");
    assert.deepEqual(precache.filter((path) => AUDIO.test(path) || path.startsWith("music/")), [], "no audio in the precache");
    assert.match(sw, /key !== MUSIC_CACHE/, "the published worker keeps fc-music");
  }

  // ---------------------------------------------------------------- the Music row at 1440x900 and 390x844, English and Vietnamese
  for (const [viewport, size] of [["desktop", "desktop"], ["portrait", "portrait"], ["small", { width: 320, height: 568, mobile: true }]]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, size);
    await routeMusic(page);
    await goto();
    await ready();
    await tap("#briefing-settings");
    await tap("#settings-tab-audio");
    const row = await page.evaluate(() => {
      const select = document.querySelector('[data-setting="music"]'), label = select.closest(".setting-row");
      label.scrollIntoView({ block: "center" });
      const r = label.getBoundingClientRect(), s = select.getBoundingClientRect();
      return { h: r.height, sh: s.height, sw: s.width, right: r.right, font: parseFloat(getComputedStyle(label).fontSize), selectFont: parseFloat(getComputedStyle(select).fontSize), family: getComputedStyle(select).fontFamily,
        options: [...select.options].map((o) => o.textContent), value: select.value, overflow: document.documentElement.scrollWidth > innerWidth, width: innerWidth };
    });
    assert.deepEqual(row.options, ["Recorded + adaptive", "Adaptive only", "Off"]);
    assert.equal(row.value, "recorded", "default: Recorded + adaptive");
    assert.ok(row.h >= 44 && row.sh >= 32, `${viewport}: Music row is a 44 px target (${row.h}, select ${row.sh})`);
    assert.ok(row.font >= 11 && row.selectFont >= 11, `${viewport}: text size ${row.font}/${row.selectFont}`);
    assert.ok(!/system-ui/.test(row.family), `${viewport}: font ${row.family}`);
    assert.ok(row.right <= row.width && !row.overflow, `${viewport}: no sideways scroll`);
    await page.waitForTimeout(300);
    await shot(page, `music-settings-${viewport}`);
    await tap('[data-do="cancel"]');
    await page.selectOption("#language", "vi");
    await tap("#briefing-settings");
    await tap("#settings-tab-audio");
    await page.waitForFunction(() => document.querySelector('[data-setting="music"]')?.closest(".setting-row").textContent.trim().startsWith("Âm nhạc"), null, { timeout: TIMEOUT.step });
    const vi = await page.evaluate(() => [...document.querySelector('[data-setting="music"]').options].map((o) => o.textContent));
    assert.deepEqual(vi, ["Nhạc thu âm + nhạc trận", "Chỉ nhạc trận", "Tắt"], `Vietnamese options: ${vi}`);
    const viRow = await page.evaluate(() => { const select = document.querySelector('[data-setting="music"]'), r = select.getBoundingClientRect(); return { right: r.right, panel: select.closest(".settings-panel").getBoundingClientRect().right, overflow: document.documentElement.scrollWidth > innerWidth }; });
    assert.ok(!viRow.overflow && viRow.right <= viRow.panel + 0.5, `${viewport} vi: the Music choice fits (${JSON.stringify(viRow)})`);
    if (viewport === "portrait") { await page.evaluate(() => document.querySelector('[data-setting="music"]').closest(".setting-row").scrollIntoView({ block: "center" })); await shot(page, "music-settings-portrait-vi"); }
    assert.deepEqual(errors, [], `${viewport}: no page errors`);
    await page.close();
  }
}, { browser });
