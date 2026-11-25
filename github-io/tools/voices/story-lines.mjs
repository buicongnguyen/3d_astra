// W3 story voices: every spoken story line of every campaign and Chronicle mission, per mission, in the
// order the mission can say them (its triggers, with a staged scene's lines where the scene starts).
// Writes src/voice-story.json, the generator's input (tools/voices/make-voices.py) and the unit test's
// reference (tests/voice.test.js checks this list still matches the missions). Hand-kept parts of the
// file survive a rerun: the cast's voices, processing and pace, `spoken` (a variant only for the voice, never on screen),
// `excluded` and `pending` (missions whose lines are listed but not rendered yet: { id: reason }; the game shows their
// captions without a voice until tools/voices/make-voices.py renders them and the entry is removed). Run from github-io/: node tools/voices/story-lines.mjs [--check]
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { MISSIONS } from "../../src/story/missions.js";
import { CHRONICLES } from "../../src/story/chronicles.js";
import { SCENES } from "../../src/story/scenes.js";
import { storyHash, storyClip } from "../../src/voice-logic.js";

const OUT = fileURLToPath(new URL("../../src/voice-story.json", import.meta.url));
// A pack is cut once its text passes this many characters (about 0.22 KB of MP3 per character): <= ~300 KB.
export const PACK_CHARS = 1250;

// The spoken lines of one mission: [{ who, text, scene? }], each text once.
export function missionLines(m) {
  const out = [], seen = new Set();
  const add = (who, text, scene) => { if (!seen.has(text)) { seen.add(text); out.push(scene ? { who, text, scene } : { who, text }); } };
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    for (const [k, v] of Object.entries(o)) {
      if (k === "briefing" || k === "debrief") continue;
      if (k === "say" && v && typeof v.text === "string") add(v.who, v.text);
      else if (k === "scene" && typeof v === "string") for (const b of SCENES[v]?.beats || []) { if (b.say) add(b.say.who, b.say.text, v); }
      else walk(v);
    }
  };
  walk(m);
  return out;
}

export function allMissions() {
  return [...MISSIONS.map((m) => ({ m, campaign: "main" })), ...CHRONICLES.flatMap((c) => c.missions.map((m) => ({ m, campaign: c.id })))];
}

// Pack names: story-<short id> (the id up to its first dash), story-<short>-2 for a second part. A mission
// longer than `limit` characters is cut into the fewest parts of about equal length, in the order it speaks.
export function splitPacks(id, lines, limit = PACK_CHARS) {
  const short = id.split("-")[0], total = lines.reduce((a, l) => a + l.text.length, 0);
  const parts = Math.max(1, Math.ceil(total / limit)), target = total / parts, packs = [];
  let cur = null, done = 0;
  for (const line of lines) {
    if (!cur || (packs.length < parts && done + line.text.length / 2 > target * packs.length && cur.lines.length)) { cur = { name: `story-${short}${packs.length ? `-${packs.length + 1}` : ""}`, lines: [] }; packs.push(cur); }
    cur.lines.push(line); done += line.text.length;
  }
  return packs;
}

export function build(previous = {}) {
  const missions = {};
  for (const { m, campaign } of allMissions()) {
    const lines = missionLines(m);
    if (!lines.length) continue;
    missions[m.id] = { campaign, packs: splitPacks(m.id, lines) };
  }
  // W9: lines written since the last render (no clip in src/voice-packs.json yet), per mission, for the integrator:
  // tools/voices/make-voices.py renders them, and a rerun of this script after that empties the list. The client
  // plays such a line as text only (storyClip returns null), so a pending line is never an error in play.
  const pending = {};
  for (const [id, mm] of Object.entries(missions)) {
    const missing = mm.packs.flatMap((p) => p.lines).filter((l) => !storyClip(id, l.text)).map((l) => l.text);
    if (missing.length) pending[id] = missing;
  }
  return {
    about: "W3 story voices, written by tools/voices/story-lines.mjs from the mission data (do not edit the missions part by hand). Every `say` line (with its `who`) of every campaign and Chronicle mission, and the lines of the staged scenes a mission plays, grouped in packs of at most ~300 KB. tools/voices/make-voices.py renders them with the cast's stock Kokoro voice and processing; the client finds a clip by storyHash(text) of the exact English line. `spoken` maps an on-screen line to a variant used only for the voice (the screen keeps its text).",
    voices: previous.voices || {},
    fx: previous.fx || {},
    speed: previous.speed || {},
    spoken: previous.spoken || {},
    excluded: previous.excluded || {},
    ...(previous.pending && Object.keys(previous.pending).length ? { pending: previous.pending } : null),
    missions,
    pending,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const next = build(previous);
  const text = JSON.stringify(next, null, 1) + "\n";
  if (process.argv.includes("--check")) {
    const same = fs.existsSync(OUT) && fs.readFileSync(OUT, "utf8") === text;
    console.log(same ? "voice-story.json is up to date" : "voice-story.json is out of date: run node tools/voices/story-lines.mjs");
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(OUT, text);
  let n = 0, packs = 0;
  for (const [id, mm] of Object.entries(next.missions)) { const c = mm.packs.reduce((a, p) => a + p.lines.length, 0); n += c; packs += mm.packs.length; console.log(id.padEnd(32), c, mm.packs.map((p) => `${p.name}:${p.lines.reduce((a, l) => a + l.text.length, 0)}`).join(" ")); }
  console.log(`${n} lines in ${packs} packs`);
}
