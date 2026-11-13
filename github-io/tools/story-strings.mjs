// Every player-visible string of the campaign story, gathered the way the interface shows it
// (mission-ui.js, main.js, cast-portraits.js). Used by tests/story-vi.test.js to keep the
// Vietnamese story catalog (src/locales/story-vi.json) complete. Run it to list the strings:
//   node tools/story-strings.mjs
import { MISSIONS } from "../src/story/missions.js";
import { FACTIONS, CAST } from "../src/story/world.js";
import { ACTS } from "../src/campaign.js";
import { ENDINGS } from "../src/story/choices.js";
import { MAP_TEXT } from "../src/story/campaign-map.js";
import { SCENES, sceneLines } from "../src/story/scenes.js";
import { pointLabel } from "../src/mission-text.js";

// Returns [{ text, where }] without duplicates, in reading order.
export function storyStrings() {
  const out = [], seen = new Set();
  const add = (text, where) => {
    if (typeof text !== "string" || !text.trim() || seen.has(text)) return;
    seen.add(text);
    out.push({ text, where });
  };
  for (const { act, title } of ACTS) add(title, `act ${act}`);
  for (const f of Object.values(FACTIONS)) for (const key of ["name", "short", "character", "goal"]) add(f[key], `faction ${f.id}.${key}`);
  for (const c of Object.values(CAST)) for (const key of ["name", "role", "personality"]) add(c[key], `cast ${c.id}.${key}`);
  for (const m of MISSIONS) {
    const at = (part) => `${m.id} ${part}`;
    add(m.title, at("title"));
    add(m.briefing?.place, at("place"));
    for (const line of m.briefing?.lines || []) add(line.text, at(`briefing ${line.who}`));
    for (const text of m.briefing?.intel || []) add(text, at("intel"));
    for (const o of m.objectives || []) add(o.text, at(`objective ${o.id}`));
    for (const trigger of m.triggers || []) for (const action of trigger.do || []) {
      if (action.say) add(action.say.text, at(`say ${action.say.who}`));
      // A staged scene (0.19b) speaks its lines in the dialogue box, in the mission's place.
      if (action.scene) for (const line of sceneLines(SCENES[action.scene])) add(line.text, at(`scene ${action.scene} ${line.who}`));
      // A unit spawned later by a trigger can carry a display name too.
      if (action.spawn && action.name) add(action.name, at("unit name"));
    }
    for (const side of ["win", "lose"]) for (const line of m.debrief?.[side] || []) add(line.text, at(`debrief ${side} ${line.who}`));
    for (const s of m.setup || []) {
      if (s.name) add(s.name, at("unit name"));
      if (s.capturePoint) add(pointLabel(m, s.capturePoint), at(`point ${s.capturePoint}`));
    }
    for (const o of m.objectives || []) for (const point of o.points || []) add(pointLabel(m, point), at(`point ${point}`));
    for (const [name, region] of Object.entries(m.regions || {})) if (region.label) add(region.label, at(`region ${name}`));
    // Commander decisions (0.19a): the choice card's prompt and both orders with their consequence.
    for (const [id, d] of Object.entries(m.decisions || {})) {
      add(d.prompt, at(`decision ${id} prompt`));
      for (const o of d.options) { add(o.label, at(`decision ${id}.${o.id} label`)); add(o.effect, at(`decision ${id}.${o.id} effect`)); }
    }
  }
  // The two endings: title, summary and the epilogue cards.
  for (const e of Object.values(ENDINGS)) {
    add(e.title, `ending ${e.id} title`);
    add(e.summary, `ending ${e.id} summary`);
    for (const card of e.cards) for (const line of card.lines) add(line, `ending ${e.id} ${card.who}`);
  }
  // Scenes no mission plays yet still need their words.
  for (const [id, scene] of Object.entries(SCENES)) for (const line of sceneLines(scene)) add(line.text, `scene ${id} ${line.who}`);
  // The campaign map's own words.
  for (const [key, text] of Object.entries(MAP_TEXT)) add(text, `campaign map ${key}`);
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const from = Number(process.argv[2] || 0);
  for (const { text, where } of storyStrings().slice(from)) console.log(`${where}\t${text}`);
}
