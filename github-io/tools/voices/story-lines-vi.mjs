// Vietnamese story voices, step 0: the Vietnamese words of every voiced story line, exactly as the game shows
// them (src/i18n.js translate(text, "vi"): the main catalog src/locales/vi.json first, then the story catalog
// src/locales/story-vi.json), so the subtitle in the dialogue box and the Vietnamese voice say the same words.
// The packs are the English story packs (src/voice-story.json, same names under vi/, same clip ids
// "s.<storyHash(English text)>"). Writes .tmp/voices-vi/story.json for synth-vi.py --story and
// make-voices-vi.py --story. Run from github-io/: node tools/voices/story-lines-vi.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import STORY from "../../src/voice-story.json" with { type: "json" };
import { loadStory, translate } from "../../src/i18n.js";
import { storyHash } from "../../src/voice-logic.js";

await loadStory("vi");
const OUT = fileURLToPath(new URL("../../.tmp/voices-vi/story.json", import.meta.url));

export function storyLinesVi() {
  const out = [], untranslated = [];
  for (const [mission, m] of Object.entries(STORY.missions))
    for (const p of m.packs)
      for (const l of p.lines) {
        const vi = translate(l.text, "vi");
        if (!vi || vi === l.text) untranslated.push(l.text);
        out.push({ mission, pack: p.name, cid: `s.${storyHash(l.text)}`, who: l.who, en: l.text, vi });
      }
  return { lines: out, untranslated };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const { lines, untranslated } = storyLinesVi();
  if (untranslated.length) { console.error("no Vietnamese text for:", untranslated); process.exit(1); }
  fs.mkdirSync(new URL("../../.tmp/voices-vi/", import.meta.url), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(lines, null, 1) + "\n");
  const chars = lines.reduce((a, l) => a + l.vi.length, 0);
  console.log(`${lines.length} story lines, ${new Set(lines.map((l) => l.pack)).size} packs, ${chars} Vietnamese characters -> ${OUT}`);
}
