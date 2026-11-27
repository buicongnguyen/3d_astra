// Subtitles for the spoken unit replies and announcer lines (2026-11-25): the pure rules, unit-tested in Node
// (tests/voice-captions.test.js). The voices are English only; a caption shows the line actually spoken, in the
// player's language (the locale catalogs carry every line of voice-lines.json), with who said it: the unit's
// name for a reply, "Announcer" for the announcer, tinted by faction. Story lines never get a caption: their
// text is already in the mission dialogue box. The DOM side is captions-ui.js.
import LINES from "./voice-lines.json" with { type: "json" };
import { voiceFaction, voiceLevel } from "./voice-logic.js";

export const CAPTION = Object.freeze({
  // Seconds a caption stays after its clip ends (time to finish reading), and the least time it shows at all.
  hold: 0.7,
  min: 1.4,
});

// Subtitles show only while voices can be heard: Voices on, not muted, some volume; and the switch is on.
export const captionsOn = (settings = {}) => settings.subtitles !== false && voiceLevel(settings) > 0;

// The English words of a spoken faction line (`line` as voice.js plays it: { channel, key, index }), or null.
export function captionLine(line, faction) {
  if (!line || (line.channel !== "ack" && line.channel !== "announcer")) return null;
  const f = LINES.factions[voiceFaction(faction)];
  const takes = line.channel === "ack" ? f.ack[line.key] : f.ann[line.key];
  const text = takes?.[line.index];
  return typeof text === "string" ? text : null;
}

// The caption for a line that started: { text, speaker, faction, channel } in English (the UI translates it),
// or null for story lines and anything unknown. `unitName(type)` names a unit type (the reply's speaker).
export function captionFor(line, { faction = "meridian", unitName = null } = {}) {
  const text = captionLine(line, faction);
  if (!text) return null;
  const f = voiceFaction(faction);
  const speaker = line.channel === "announcer" ? "Announcer" : line.name || (line.who && unitName?.(line.who)) || "Unit";
  return { text, speaker, faction: f, channel: line.channel };
}

// When a caption shows and clears, on the audio clock: from the voice's start (after the announcer's short
// delay) to the clip's end plus the reading hold, never shorter than CAPTION.min.
export function captionWindow(now, seconds, delay = 0, o = CAPTION) {
  const from = now + Math.max(0, delay);
  const speech = Math.max(0, seconds - Math.max(0, delay));
  return { from, until: from + Math.max(o.min, speech + o.hold) };
}

// Every reply and announcer line of every faction (the translation tests walk this list).
export function allCaptionLines() {
  const out = [];
  for (const [faction, f] of Object.entries(LINES.factions))
    for (const [channel, group] of [["ack", f.ack], ["announcer", f.ann]])
      for (const [key, takes] of Object.entries(group)) takes.forEach((text, index) => out.push({ faction, channel, key, index, text }));
  return out;
}
