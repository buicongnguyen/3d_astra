// Subtitles for unit replies and announcer lines (2026-11-25): every line of every faction reads in Vietnamese and
// Korean, and a caption follows the voice scheduler through the real AudioDirector on a fake AudioContext: only
// lines actually spoken get one (rate limit, priority and cut-ins included), Voices off shows none, Subtitles off
// keeps the voice and drops the caption, and story lines never get one (they are in the dialogue box).
import test from "node:test";
import assert from "node:assert/strict";
import { translate } from "../src/i18n.js";
import { CAPTION, allCaptionLines, captionFor, captionLine, captionWindow, captionsOn } from "../src/voice-captions.js";
import { VOICE } from "../src/voice-logic.js";
import { defaults, normalize } from "../src/settings.js";
import { AudioDirector } from "../src/audio.js";
import balance from "../src/balance.json" with { type: "json" };

const hangul = /[가-힣]/;

test("every unit reply and announcer line of every faction has Vietnamese and Korean text", () => {
  const lines = allCaptionLines();
  assert.equal(lines.length, 5 * (12 + 22), "5 factions × (12 replies + 22 announcer takes)");
  const missing = [];
  for (const { faction, channel, key, text } of lines) {
    const vi = translate(text, "vi"), ko = translate(text, "ko");
    if (vi === text || !/[à-ỹđ]/i.test(vi)) missing.push(`vi ${faction}.${channel}.${key}: ${text} -> ${vi}`);
    if (ko === text || !hangul.test(ko)) missing.push(`ko ${faction}.${channel}.${key}: ${text} -> ${ko}`);
  }
  assert.deepEqual(missing, []);
  for (const label of ["Announcer", "Subtitles", "Unit"]) for (const lang of ["vi", "ko"]) assert.notEqual(translate(label, lang), label, `${label} (${lang})`);
  // Speakers: every unit type a reply can come from has a translated name.
  for (const d of Object.values(balance.definitions)) if (d.name) assert.notEqual(translate(d.name, "ko"), d.name, d.name);
});

test("a caption is the spoken take's words with its speaker; story lines have none", () => {
  const unitName = (type) => balance.definitions[type]?.name;
  assert.deepEqual(captionFor({ channel: "ack", key: "attack", index: 1, who: "scrapper" }, { faction: "ashfall", unitName }),
    { text: "Strip it for parts.", speaker: "Scrapper", faction: "ashfall", channel: "ack" });
  assert.deepEqual(captionFor({ channel: "announcer", key: "victory", index: 0 }, { faction: "veil" }),
    { text: "Victory. Let it be written.", speaker: "Announcer", faction: "veil", channel: "announcer" });
  assert.equal(captionFor({ channel: "story", key: "story", index: "s.abc" }, { faction: "meridian" }), null);
  assert.equal(captionLine({ channel: "ack", key: "select", index: 9 }, "meridian"), null, "no such take");
  assert.equal(captionFor({ channel: "ack", key: "select", index: 0 }, { faction: "nobody" }).text, "Ready, Commander.", "unknown faction speaks Meridian");
  // Shown from the voice's start (after the announcer's delay) until the clip ends plus the reading hold.
  assert.deepEqual(captionWindow(10, 2.3, 0.3), { from: 10.3, until: 10.3 + 2 + CAPTION.hold });
  assert.deepEqual(captionWindow(10, 0.5), { from: 10, until: 10 + CAPTION.min }, "a short clip still reads");
  // The switch: on by default, saved, and only while the voices can be heard.
  assert.equal(defaults().subtitles, true);
  assert.equal(normalize({ version: 1, subtitles: false }).subtitles, false);
  assert.equal(normalize({ version: 1, subtitles: "no" }).subtitles, true);
  assert.equal(captionsOn(defaults()), true);
  assert.equal(captionsOn({ ...defaults(), subtitles: false }), false);
  assert.equal(captionsOn({ ...defaults(), voices: false }), false);
  assert.equal(captionsOn({ ...defaults(), muted: true }), false);
});

// ---- the director on a fake AudioContext, with a recording caption box
function fakeNode() {
  const target = function () {};
  return new Proxy(target, {
    get(t, k) { if (k === "then") return undefined; if (k in t) return t[k]; return (t[k] = k === "value" ? 0 : fakeNode()); },
    set(t, k, v) { t[k] = v; return true; },
    apply() { return fakeNode(); },
  });
}
function director(settings = {}, faction = "meridian") {
  const ctx = { currentTime: 0, sampleRate: 24000, state: "running", destination: fakeNode() };
  ctx.createBuffer = (channels, length, rate) => { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { duration: length / rate, length, getChannelData: (i) => data[i] }; };
  for (const k of ["createGain", "createOscillator", "createBufferSource", "createBiquadFilter", "createStereoPanner", "createDynamicsCompressor", "createConvolver", "createWaveShaper", "createDelay"]) ctx[k] = () => fakeNode();
  const box = {
    log: [], current: null,
    show(caption, window, line) { this.current = { caption, window, line }; this.log.push(this.current); },
    clear(line = null) { if (!line || this.current?.line === line) this.current = null; },
    update(now) { if (this.current && now >= this.current.window.until) this.current = null; },
  };
  const idle = globalThis.requestIdleCallback;
  globalThis.requestIdleCallback = () => 0;
  let d;
  try { d = new AudioDirector(ctx, { captions: box }); } finally { globalThis.requestIdleCallback = idle; }
  d.applySettings({ ...defaults(), music: "off", ...settings });
  d.voice.faction = faction;
  d.voice.packs.set(faction, { buffer: {} }); // the faction pack "arrived"
  return { d, ctx, box };
}
const units = (type, n = 2) => Array.from({ length: n }, (_, i) => ({ id: i + 1, kind: "unit", type, team: 0 }));

test("captions follow the scheduler: rate limit, priority, cut-ins; one at a time", () => {
  const { d, ctx, box } = director({}, "ashfall");
  // A reply: the speaking unit's type names the speaker; the text is the take that plays.
  assert.equal(d.bark("attack", units("scrapper")), true);
  const first = box.current;
  assert.equal(first.caption.speaker, "Scrapper");
  assert.equal(first.caption.text, captionLine(d.voice.voice.line, "ashfall"), "the caption is the take being spoken");
  assert.equal(first.window.from, 0);
  // Spam-tapping: replies inside the rate limit are dropped, and so are their captions.
  ctx.currentTime = VOICE.ack.gap * 0.5;
  assert.equal(d.bark("select", units("scrapper")), false);
  assert.equal(box.log.length, 1, "no caption for a reply that was not spoken");
  // The announcer outranks a reply: it cuts in and its caption replaces the reply's.
  d.voice.announce("built");
  assert.equal(d.voice.voice.line.channel, "announcer");
  assert.equal(box.log.length, 2);
  assert.equal(box.current.caption.speaker, "Announcer");
  assert.equal(box.current.caption.text, captionLine(d.voice.voice.line, "ashfall"));
  // It clears once the clip and the hold are over.
  const until = box.current.window.until;
  ctx.currentTime = until - 0.01; d.captions.update(ctx.currentTime);
  assert.ok(box.current, "still up while read");
  ctx.currentTime = until + 0.01; d.captions.update(ctx.currentTime);
  assert.equal(box.current, null, "gone after the hold");
  // An announcer line that waits behind another gets its caption when it actually starts.
  ctx.currentTime = 20;
  d.voice.announce("buildingLost");
  const lost = box.current;
  d.voice.announce("research");
  assert.equal(box.current, lost, "the waiting line has no caption yet");
  ctx.currentTime = lost.window.until; d.voice.update();
  assert.equal(box.current.caption.text, captionLine(d.voice.voice.line, "ashfall"));
  assert.equal(d.voice.voice.line.key, "research");
});

test("a reply never cuts in on the announcer, so it gets no caption", () => {
  const { d, ctx, box } = director({}, "sunward");
  d.voice.announce("incoming");
  assert.equal(box.current.window.from, VOICE.delay, "the announcer's caption waits for its voice");
  ctx.currentTime = VOICE.delay + 0.05;
  assert.ok(d.voice.speaking);
  d.bark("select", units("ranger"));
  assert.equal(d.voice.voice.line.channel, "announcer");
  assert.equal(box.log.length, 1);
});

test("story lines never get a caption and take a reply's caption away", () => {
  const { d, box } = director();
  d.bark("select", units("ranger"));
  assert.equal(box.current.caption.speaker, "Ranger");
  d.caption({ channel: "story", key: "story", index: "s.x" }, 3, 0);
  assert.equal(box.current, null);
  assert.equal(box.log.length, 1);
});

test("Voices off: no captions; Subtitles off: the voice plays, no caption", () => {
  const off = director({ voices: false });
  off.d.bark("select", units("ranger"));
  assert.equal(off.d.voice.voice, null);
  off.d.voice.announce("built");
  assert.equal(off.box.log.length, 0, "Voices off: nothing spoken, nothing captioned");

  const quiet = director({ subtitles: false });
  quiet.d.bark("select", units("ranger"));
  assert.equal(quiet.d.voice.voice?.line.channel, "ack", "the reply still plays");
  quiet.d.voice.announce("built");
  assert.equal(quiet.box.log.length, 0, "no caption");

  // Switching Subtitles off clears the caption up; Voices off stops the voice and its caption.
  const live = director();
  live.d.bark("select", units("ranger"));
  assert.ok(live.box.current);
  live.d.applySettings({ ...defaults(), music: "off", subtitles: false });
  assert.equal(live.box.current, null, "Subtitles off: caption gone");
  assert.ok(live.d.voice.voice, "the voice speaks on");
  live.d.applySettings({ ...defaults(), music: "off" });
  live.d.voice.reset();
  live.ctx.currentTime = 10;
  live.d.bark("select", units("ranger"));
  assert.ok(live.box.current);
  live.d.applySettings({ ...defaults(), music: "off", voices: false });
  assert.equal(live.box.current, null, "Voices off: caption gone with the voice");
});
