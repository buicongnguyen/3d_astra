// Guards the [pattern, text] lists in the locale catalogs: two merges in 2026-11 fused two entries into one
// 4-item entry, and one branch wrote "(d+)" for "(\d+)", so those lines silently stayed English in VI/KO.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

for (const lang of ["vi", "ko"]) {
  test(`${lang}.json: every pattern entry is a [regex, text] pair that compiles`, () => {
    const cat = JSON.parse(fs.readFileSync(new URL(`../src/locales/${lang}.json`, import.meta.url), "utf8"));
    for (const [key, list] of Object.entries(cat)) {
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        assert.ok(Array.isArray(entry) && entry.length === 2, `${lang} ${key}: entry is not a pair: ${JSON.stringify(entry).slice(0, 120)}`);
        const [re, text] = entry;
        assert.equal(typeof text, "string", `${lang} ${key}: ${re}`);
        assert.doesNotThrow(() => new RegExp(re), `${lang} ${key}: bad regex ${re}`);
        assert.ok(!re.includes("(d+"), `${lang} ${key}: "(d+" should be a digit class: ${re}`);
      }
    }
  });
}
