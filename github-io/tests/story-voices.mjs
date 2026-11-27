// W3 story voices in the browser: every campaign and Chronicle mission has its own story pack, fetched only
// after Start and only for the mission being played (two parts for a long one). Three missions are started
// (a main mission, a Chronicle in Vietnamese, the finale with its two packs) and story lines go through the
// real dialogue path (window.__frontier.mission.say, as a mission trigger does): back-to-back lines play one
// after the other without overlap (the voice player's start/ended events are logged), the subtitle shows the
// translated line while the Vietnamese clip of the same words plays (phase 2: vi/story-<id>), a staged scene's
// line cuts in and skipping the scene stops it, and Voices off silences story lines. No listening: buffer source events only.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, TIMEOUT } from "./lib/harness.mjs";
import { setLanguage } from "./lib/settings-sheet.mjs";
import { MISSIONS } from "../src/story/missions.js";
import { SCENES } from "../src/story/scenes.js";
import STORY from "../src/voice-story.json" with { type: "json" };
import { storyHash } from "../src/voice-logic.js";

const KEY = "frontier-campaign-v2";
// Every main mission cleared: every mission and every Chronicle is open.
const PROGRESS = { cleared: Object.fromEntries(MISSIONS.map((m, i) => [m.id, { time: 300 + i, medal: "silver", difficulty: "standard" }])) };
const linesOf = (id) => STORY.missions[id].packs.flatMap((p) => p.lines);
const browser = await launchBrowser();

await suite("story voices: per-mission packs after Start, lines in order, scenes, Voices off", async () => {
  const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
  let requests = [];
  page.on("request", (r) => { const m = r.url().match(/\/voices\/((?:vi\/)?[\w-]+)\.mp3/); if (m) requests.push(m[1]); });
  // A fresh page with all missions open (and a language); voice requests counted from here.
  const load = async (language = "en") => {
    await goto();
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(v)); }, [KEY, PROGRESS]);
    await page.reload(); await ready();
    if (language !== "en") await setLanguage(page, language);
    requests = [];
  };
  const campaign = async () => { await tap('[data-mode="campaign"]'); await page.locator("#campaign-map .cmap").waitFor({ state: "visible" }); };
  const begin = async () => {
    assert.deepEqual(requests, [], "no voice pack before Start");
    await tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible" });
    assert.deepEqual(requests, [], "no voice pack on the briefing");
    await tap("#mb-skip"); await tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    // Hold the clock: only the lines this suite says are spoken; log the voice player's starts and ends.
    await page.evaluate(() => {
      const f = window.__frontier, v = f.audio.voice;
      f.hold = true;
      window.__voiceLog = [];
      const start = v.start.bind(v);
      v.start = (line, cut) => {
        const ok = start(line, cut);
        if (ok) { const t = v.context.currentTime, src = v.voice.src, log = { index: line.index, scene: !!line.scene, t0: t, t1: null }; window.__voiceLog.push(log); src.addEventListener("ended", () => { log.t1 = v.context.currentTime; }); }
        return ok;
      };
    });
  };
  const packsReady = (names) => page.waitForFunction((names) => names.every((n) => window.__frontier.audio.voice.ready(n)), names, { timeout: TIMEOUT.step });
  const say = (who, text) => page.evaluate(([who, text]) => window.__frontier.mission.say(who, text), [who, text]);
  const voiceLog = () => page.evaluate(() => window.__voiceLog.map((l) => ({ ...l })));

  // 1. A main mission: its faction pack and its one story pack, after Start only.
  await load();
  await campaign();
  await tap('[data-mission="m02-first-contact"]');
  await begin();
  await packsReady(["meridian", "story-m02"]);
  assert.deepEqual([...requests].sort(), ["meridian", "story-m02"], `mission 2 fetches its own pack only (${requests})`);
  const m2 = linesOf("m02-first-contact").filter((l) => !l.scene).slice(0, 3);
  for (const l of m2) await say(l.who, l.text);
  // The match clock is held, so the dialogue box gets its play time here (as the frame loop gives it). Big
  // steps: under CI's 20x CPU slowing the timer fires rarely, and the box still waits for each voice to end.
  await page.evaluate(() => { window.__boxClock = setInterval(() => window.__frontier.mission.tick(0.5), 100); });
  const ids2 = m2.map((l) => `s.${storyHash(l.text)}`);
  // (A line the mission said on its own first may speak before them: only these three are followed.)
  await page.waitForFunction((ids) => { const mine = window.__voiceLog.filter((l) => ids.includes(l.index)); return mine.length >= ids.length && mine.every((l) => l.t1 != null); }, ids2, { timeout: 2 * TIMEOUT.models });
  await page.evaluate(() => clearInterval(window.__boxClock));
  const log2 = (await voiceLog()).filter((l) => ids2.includes(l.index));
  assert.deepEqual(log2.map((l) => l.index), ids2, "three lines play in the order they were said");
  for (let i = 1; i < 3; i++) assert.ok(log2[i].t0 >= log2[i - 1].t1 - 0.05, `line ${i + 1} starts after line ${i} ended (no overlap: ${log2[i].t0} vs ${log2[i - 1].t1})`);
  for (const l of log2) assert.ok(l.t1 - l.t0 > 1, "each line played whole (no cut-off)");

  // 2. A Chronicle in Vietnamese: the Ashfall pack and the Chronicle's story pack, both Vietnamese; the subtitle is
  // translated and the line speaks from the Vietnamese story pack.
  await load("vi");
  await campaign();
  await tap('.chron-card[data-chronicle="ashfall"]');
  await page.locator('[data-mission="ca1-cold-berths"]').waitFor({ state: "visible" });
  await tap('[data-mission="ca1-cold-berths"]');
  await begin();
  // Vietnamese (2026-11-27): the faction and the story speak from their vi packs (no English pack is fetched).
  await packsReady(["vi/ashfall", "vi/story-ca1"]);
  assert.deepEqual([...requests].sort(), ["vi/ashfall", "vi/story-ca1"], `the Chronicle fetches its own Vietnamese packs only (${requests})`);
  const ca = linesOf("ca1-cold-berths")[0];
  await say(ca.who, ca.text);
  await page.waitForFunction((id) => window.__frontier.audio.voice.voice?.line.index === id, `s.${storyHash(ca.text)}`, { timeout: TIMEOUT.step });
  assert.equal(await page.evaluate(() => window.__frontier.audio.voice.voice?.line.pack), "vi/story-ca1", "the story line speaks Vietnamese");
  await page.evaluate(() => { window.__boxClock = setInterval(() => window.__frontier.mission.tick(0.5), 100); });
  const shown = await page.waitForFunction((en) => { const t = document.querySelector("#dialogue-text")?.textContent; return t && t !== en; }, ca.text, { timeout: TIMEOUT.step }).then(() => true, () => false);
  const box2 = await page.evaluate(() => ({ text: document.querySelector("#dialogue-text")?.textContent, lang: document.documentElement.lang, log: window.__frontier.mission.queue?.log?.length }));
  await page.evaluate(() => clearInterval(window.__boxClock));
  assert.ok(shown, `the subtitle is in Vietnamese while the Vietnamese clip plays (${JSON.stringify(box2)})`);
  assert.equal(await page.evaluate(() => document.documentElement.lang), "vi", "Vietnamese page");

  // 3. The finale: both of its story parts; a scene line cuts in, skipping the scene stops it; Voices off.
  await load();
  await campaign();
  await tap('[data-mission="m12-frontiers-end"]');
  await begin();
  await packsReady(["meridian", "story-m12", "story-m12-2"]);
  assert.deepEqual([...requests].sort(), ["meridian", "story-m12", "story-m12-2"], `the finale fetches its two parts (${requests})`);
  const all = linesOf("m12-frontiers-end"), late = all.filter((l) => !l.scene).at(-1);
  assert.ok(STORY.missions["m12-frontiers-end"].packs[1].lines.includes(late), "a line from the second part");
  await say(late.who, late.text);
  await page.waitForFunction((id) => window.__frontier.audio.voice.voice?.line.index === id, `s.${storyHash(late.text)}`, { timeout: TIMEOUT.step });
  const sceneId = Object.keys(SCENES).find((id) => all.some((l) => l.scene === id) && SCENES[id].beats.some((b) => b.say));
  assert.ok(await page.evaluate((id) => window.__frontier.playScene(id), sceneId), `scene ${sceneId} plays`);
  const first = SCENES[sceneId].beats.find((b) => b.say).say;
  await page.waitForFunction((id) => { const v = window.__frontier.audio.voice; return v.voice?.line.scene && v.voice.line.index === id; }, `s.${storyHash(first.text)}`, { timeout: TIMEOUT.step });
  const cut = await page.evaluate(() => window.__voiceLog.at(-2));
  assert.equal(cut.index, `s.${storyHash(late.text)}`, "the scene line cut the line of play");
  await page.evaluate(() => window.__frontier.skipScene());
  await page.waitForFunction(() => !window.__frontier.audio.voice.voice && !window.__frontier.scene().open, null, { timeout: 5000 });
  const off = await page.evaluate(([who, text]) => {
    const f = window.__frontier;
    f.audio.applySettings({ ...f.settings, voices: false });
    f.mission.say(who, text);
    return { voice: !!f.audio.voice.voice, spoken: f.audio.say(who, text), enabled: f.audio.voice.scheduler.enabled };
  }, [all[0].who, all[0].text]);
  assert.deepEqual(off, { voice: false, spoken: 0, enabled: false }, "Voices off: story lines are silent");
  assert.deepEqual(errors, [], "no page errors");
}, { browser });
