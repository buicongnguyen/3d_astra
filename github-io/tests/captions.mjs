// Subtitles for unit replies and announcer lines (2026-11-25) in the browser. Phone portrait, phone landscape and
// desktop, in English, Vietnamese and Korean: a real reply (the director's bark path) and a real announcer line
// play from the faction's voice pack; each shows one caption with the right speaker and the translated words of the
// take actually spoken, clear of the dock, minimap, touch row, notices and objectives (and the Defence bar / next-wave
// strip, and the mirrored left-handed layout), 13 px words on phones, fixed (no layout shift), an aria-live region,
// HUD coverage with the caption up under 30 % on phones (the small 667x375 landscape with the army selected: under
// 32 %, see section 2); then it clears. Settings → Sound → Subtitles off: the voice
// still plays, no caption; the choice survives a reload. The audio clock is suspended while a caption is measured
// (the caption follows that clock), so slow machines cannot race it. Screenshots: test-results/captions-*.png.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";
import { assertPcStack } from "./lib/pc-messages.mjs";
import { hudCoverage } from "./lib/hud-coverage.mjs";
import { openSettings, closeSettings, setLanguage } from "./lib/settings-sheet.mjs";
import { translate } from "../src/i18n.js";
import { captionLine } from "../src/voice-captions.js";
import balance from "../src/balance.json" with { type: "json" };

const KEY = "frontier-command.settings.v1";
const browser = await launchBrowser();
const AVOID = [".topbar", ".touch-controls", ".bottom-dock", "#dock-tabs", "#mission-toggle", ".minimap-panel", "#idle-chips", "#notice", "#mission-objectives", "#defence-bar", "#defence-intel", "#dialogue"];

async function open(viewport, settings = {}, mode = "skirmish") {
  const p = await openPage(browser, viewport);
  await p.goto();
  await p.page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || "{}"), version: 1, ...s })), [KEY, settings]);
  await p.page.reload(); await p.ready();
  if (mode === "defence") {
    await p.tap('[data-mode="defence"]');
    await p.page.waitForSelector("#defence-setup .defence-levels", { timeout: TIMEOUT.step });
  }
  await p.tap("#start");
  await p.page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
  await p.page.evaluate(() => { const f = window.__frontier; f.sim.aiEnabled = false; f.hold = true; });
  await p.page.waitForFunction(() => { const a = window.__frontier.audio; return a && a.voice.ready(a.voice.faction) && a.context.state === "running"; }, null, { timeout: TIMEOUT.models });
  return p;
}

// Speaks a line through the real director: "reply" = the select bark for the player's units, else an announcer key.
// Waits for its caption, then freezes the audio clock so the caption holds still while it is measured.
async function speak(page, what) {
  // A reply comes with its units selected (the dock shows them); the announcer is measured with nothing selected.
  await page.evaluate((what) => { const f = window.__frontier; f.clearMessages(); f.select(what === "reply" ? f.sim.own(0).filter((e) => e.kind === "unit").map((u) => u.id) : []); }, what);
  await page.waitForFunction(() => { const n = document.querySelector("#notice"); return !n.classList.contains("show") && getComputedStyle(n).opacity === "0" && !document.getAnimations().some((a) => a instanceof CSSTransition && a.playState === "running"); }, null, { timeout: TIMEOUT.step });
  // (Closing the settings sheet resumes the match on the next frame.)
  await page.waitForFunction(() => !window.__frontier.audio.voice.paused, null, { timeout: TIMEOUT.step });
  const base = (await page.evaluate(hudCoverage, {})).pct, dock = await dockBox(page);
  const line = await page.evaluate(async (what) => {
    const f = window.__frontier, a = f.audio;
    f.holdMessages = true; // a short line cannot end on a slow runner before it is measured (released by release())
    await a.context.resume();
    a.voice.reset();
    a.captions.clear();
    if (what === "reply") a.bark("select", f.sim.own(0).filter((e) => e.kind === "unit"));
    else a.voice.announce(what);
    const v = a.voice.voice;
    return v ? { ...v.line, faction: a.voice.faction } : { why: { paused: a.voice.paused, enabled: a.voice.scheduler.enabled, ready: a.voice.ready(a.voice.faction), units: f.sim.own(0).filter((e) => e.kind === "unit").length, state: a.context.state } };
  }, what);
  assert.ok(line && !line.why, `${what}: a voice line plays ${JSON.stringify(line?.why)}`);
  line.base = base; line.dock = dock;
  await page.waitForFunction(() => document.querySelector("#voice-caption")?.classList.contains("show"), null, { timeout: TIMEOUT.step });
  await page.evaluate(() => window.__frontier.audio.context.suspend());
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#voice-caption")).opacity === "1", null, { timeout: TIMEOUT.step });
  return line;
}
const dockBox = (page) => page.evaluate(() => { const r = document.querySelector(".bottom-dock")?.getBoundingClientRect(); return r ? [r.left, r.top, r.width, r.height].map(Math.round) : null; });
const release = (page) => page.evaluate(() => { window.__frontier.holdMessages = false; return window.__frontier.audio.context.resume(); });

const measure = (page, avoid) => page.evaluate((avoid) => {
  const el = document.querySelector("#voice-caption"), r = el.getBoundingClientRect(), s = getComputedStyle(el);
  const hits = [];
  for (const sel of avoid) for (const n of document.querySelectorAll(sel)) {
    if (!n.getClientRects().length) continue;
    const ns = getComputedStyle(n);
    if (ns.visibility === "hidden" || parseFloat(ns.opacity) < 0.05) continue;
    const b = n.getBoundingClientRect();
    if (b.width < 2 || b.height < 2) continue;
    if (r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) hits.push(`${sel} ${[b.left, b.top, b.right, b.bottom].map(Math.round)}`);
  }
  return {
    who: el.querySelector(".vc-who").textContent, text: el.querySelector(".vc-text").textContent,
    box: [r.left, r.top, r.right, r.bottom].map(Math.round), inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    hits, position: s.position, live: el.getAttribute("aria-live"), pointer: s.pointerEvents,
    words: parseFloat(getComputedStyle(el.querySelector(".vc-text")).fontSize), speaker: parseFloat(getComputedStyle(el.querySelector(".vc-who")).fontSize),
  };
}, avoid);

const unitName = (type) => balance.definitions[type]?.name;
const table = [];
async function check(page, { name, lang, phone, kind, line, shotName, budget = 30 }) {
  const m = await measure(page, AVOID);
  // PC (owner 2026-11-27): the caption is part of the top-left message stack (src/app/message-stack.js). Measured
  // straight away: on a slow runner the line can end while the checks below run.
  if (!phone) await assertPcStack(page, `${name} ${lang} ${kind}`, ["#voice-caption.show"]);
  const english = captionLine(line, line.faction);
  const speaker = line.channel === "announcer" ? "Announcer" : unitName(line.who);
  assert.equal(m.text, translate(english, lang), `${name} ${lang} ${kind}: the words of the take spoken (${english})`);
  assert.equal(m.who, translate(speaker, lang), `${name} ${lang} ${kind}: speaker`);
  if (lang !== "en") assert.notEqual(m.text, english, `${name} ${lang} ${kind}: translated`);
  assert.deepEqual(m.hits, [], `${name} ${lang} ${kind}: clear of the HUD (${m.box})`);
  assert.ok(m.inView, `${name} ${lang} ${kind}: on screen ${m.box}`);
  assert.equal(m.position, "fixed", "fixed: no layout shift");
  assert.equal(m.live, "polite");
  assert.equal(m.pointer, "none", "never takes a tap");
  assert.ok(m.speaker >= 11 && m.words >= (phone ? 12.95 : 14), `${name}: text sizes ${m.words}/${m.speaker} px`);
  assert.deepEqual(await dockBox(page), line.dock, `${name}: the dock does not move when a caption shows`);
  const { pct } = await page.evaluate(hudCoverage, {});
  if (phone) assert.ok(pct < budget, `${name} ${lang} ${kind}: HUD covers ${pct.toFixed(1)} % with the caption up (under ${budget} %)`);
  table.push([name, lang, kind, line.base, pct, m.box]);
  if (shotName) await shot(page, shotName);
}

await suite("captions: replies and announcer lines subtitled on phone and desktop, EN/VI/KO", async () => {
  // ---- 1. Every viewport and language: a reply and an announcer line, each clears.
  for (const [name, phone] of [["portrait", true], ["landscape", true], ["desktop", false]]) {
    const { page, errors } = await open(name);
    for (const lang of ["en", "vi", "ko"]) {
      if (lang !== "en") {
        // The language changes mid-match through the sheet (the catalog arrives lazily); captions follow at the next line.
        await setLanguage(page, lang);
        // The catalog is in once a known UI word reads translated.
        await page.waitForFunction(() => !/^Settings$/.test(document.querySelector("#briefing-settings")?.getAttribute("aria-label") || ""), null, { timeout: TIMEOUT.step });
      }
      for (const kind of ["reply", "built"]) {
        const line = await speak(page, kind);
        await check(page, { name, lang, phone, kind, line, shotName: phone && lang !== "en" ? `captions-${name}-${lang}-${kind === "reply" ? "reply" : "announcer"}` : (lang === "en" && kind === "built" ? `captions-${name}-en-announcer` : null) });
        await release(page);
        await page.waitForFunction(() => !document.querySelector("#voice-caption").classList.contains("show"), null, { timeout: TIMEOUT.step });
      }
    }
    assert.deepEqual(errors, []);
    await page.close();
  }

  // ---- 2. Defence (the bar and next-wave strip) on both phone shapes, and the left-handed landscape layout.
  // The small landscape phone (667x375): with the army selected its HUD already covers 29.4 % (W13 phone-hud), and
  // no readable caption fits in the 0.6 % left: that one transient state is held to 32 % (reported; owner decision).
  const SMALL = { width: 667, height: 375, mobile: true };
  for (const [name, settings, mode] of [["portrait", {}, "defence"], ["landscape", {}, "defence"], ["landscape", { handedness: "left", minimapSide: "right", language: "vi" }, "skirmish"], [SMALL, { language: "ko" }, "skirmish"]]) {
    const lang = settings.language || "en";
    const { page, errors } = await open(name, settings, mode);
    const small = name === SMALL;
    if (lang !== "en") await page.waitForFunction((l) => document.documentElement.lang === l, lang);
    const label = `${small ? "small" : name}-${mode}${settings.handedness ? "-left" : ""}`;
    for (const kind of ["reply", "wave"]) {
      const line = await speak(page, kind);
      await check(page, { name: label, lang, phone: true, kind, line, shotName: `captions-${label}-${kind}`, budget: small && kind === "reply" ? 32 : 30 });
      await release(page);
      await page.waitForFunction(() => !document.querySelector("#voice-caption").classList.contains("show"), null, { timeout: TIMEOUT.step });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }

  // ---- 2b. Re-score 2026-11-27: the phone fight hint shares the bottom slot with the caption ("Ranger · are under fire" was
  // covered by it). With a hint up, an announcer line stacks above it, never over it.
  {
    const { page, errors } = await open("portrait");
    await page.evaluate(() => { const f = window.__frontier; f.clearMessages(); f.select([]); const h = f.fightHint; h.querySelector(".fh-text").textContent = "Ranger: outranges Vanguards. Keep them behind the line."; h.hidden = false; dispatchEvent(new Event("fc-hud-changed")); });
    await page.waitForFunction(() => !window.__frontier.audio.voice.paused, null, { timeout: TIMEOUT.step });
    await page.evaluate(async () => { const a = window.__frontier.audio; await a.context.resume(); a.voice.reset(); a.captions.clear(); a.voice.announce("unitsAttack"); });
    await page.waitForFunction(() => document.querySelector("#voice-caption")?.classList.contains("show"), null, { timeout: TIMEOUT.step });
    await page.evaluate(() => window.__frontier.audio.context.suspend());
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#voice-caption")).opacity === "1", null, { timeout: TIMEOUT.step });
    const m = await measure(page, ["#fight-hint"]);
    assert.deepEqual(m.hits, [], `portrait: the caption stacks clear of the fight hint (${m.box})`);
    await shot(page, "captions-portrait-fight-hint");
    await release(page);
    assert.deepEqual(errors, []);
    await page.close();
  }

  // ---- 3. Settings → Sound → Subtitles: on by default; off keeps the voice and drops the caption; saved.
  {
    const { page, errors } = await open("portrait", { language: "ko" });
    await openSettings(page, "audio");
    const sw = page.locator('.settings-panel input[data-setting="subtitles"]');
    assert.equal(await sw.isChecked(), true, "on by default");
    assert.equal((await page.locator('.settings-panel label.setting-row:has(input[data-setting="subtitles"])').textContent()).includes("자막"), true, "Korean label");
    await sw.tap();
    await page.waitForFunction(() => window.__frontier.settings.subtitles === false, null, { timeout: TIMEOUT.step });
    await closeSettings(page);
    await page.waitForFunction(() => !window.__frontier.audio.voice.paused, null, { timeout: TIMEOUT.step });
    const heard = await page.evaluate(async () => {
      const a = window.__frontier.audio; await a.context.resume(); a.voice.reset();
      const before = a.captions.count;
      a.voice.announce("built");
      return { voice: a.voice.voice?.line.channel || null, before };
    });
    assert.equal(heard.voice, "announcer", "Subtitles off: the voice still plays");
    const t0 = await page.evaluate(() => window.__frontier.audio.context.currentTime);
    await page.waitForFunction((t0) => window.__frontier.audio.context.currentTime > t0 + 0.6, t0, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate(() => window.__frontier.audio.captions.count), heard.before, "no caption");
    assert.equal(await page.evaluate(() => document.querySelector("#voice-caption").classList.contains("show")), false);
    assert.equal(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).subtitles, KEY), false, "saved");
    await page.reload(); await page.waitForFunction(() => window.__frontier?.settings, null, { timeout: TIMEOUT.models });
    assert.equal(await page.evaluate(() => window.__frontier.settings.subtitles), false, "kept after a reload");
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("HUD coverage (%), without -> with the caption up:\n" + table.map(([n, l, k, b0, p, b]) => `  ${n.padEnd(26)} ${l} ${k.padEnd(6)} ${b0.toFixed(1)} -> ${p.toFixed(1)}  box ${b}`).join("\n"));
}, { browser });
