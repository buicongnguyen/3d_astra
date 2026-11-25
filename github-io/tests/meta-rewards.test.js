// W6 medal cosmetics (src/meta/rewards.js, plan C7.3): unlocked by medals, achievements and challenge days,
// picked beside the rank items (src/profile-rank.js), and cosmetic only: no item has a stat, no pick reaches
// a match's options or rules, and a match plays out identically whatever is picked.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { MEDAL_ITEMS, MEDAL_KINDS, rewardOpen, openRewards, newRewards, medalItem } from "../src/meta/rewards.js";
import { ITEMS, KINDS, isUnlocked, withPick, normalizeProfile, freshProfile, itemOf, paintTint, setActivePaint, activePaint, RankPaintView } from "../src/profile-rank.js";
import { Simulation } from "../src/simulation.js";
import { translate } from "../src/i18n.js";

const NONE = { ach: 0, gold: 0, goldActs: [], sets: 0 };
const ALL = { ach: 25, gold: 21, goldActs: [1, 2, 3], sets: 9 };

test("nine rewards over paint, emblem and banner, ids unique with the rank items, cosmetic fields only", () => {
  assert.deepEqual(MEDAL_KINDS, ["paint", "emblem", "banner"]);
  assert.equal(MEDAL_KINDS.reduce((n, k) => n + MEDAL_ITEMS[k].length, 0), 9);
  const COSMETIC = new Set(["id", "label", "unlock", "how", "tint", "swatch", "glyph"]);
  for (const kind of MEDAL_KINDS) {
    assert.ok(KINDS.includes(kind), `${kind} is a rank kind (one pick per kind)`);
    const ids = [...ITEMS[kind], ...MEDAL_ITEMS[kind]].map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `${kind}: ids unique`);
    for (const item of MEDAL_ITEMS[kind]) {
      for (const key of Object.keys(item)) assert.ok(COSMETIC.has(key), `${kind}:${item.id} has only cosmetic fields (${key})`);
      assert.ok(item.how.length <= 24 && item.label.length <= 18, item.id);
      if (kind === "paint") assert.ok(item.tint.length === 3 && item.tint.every((v) => v > 0.3 && v < 1.6) && /^#[0-9a-f]{6}$/.test(item.swatch), item.id);
    }
  }
});

test("each unlock: achievements, gold medals, gold acts and challenge days", () => {
  assert.deepEqual(openRewards(NONE), []);
  assert.equal(openRewards(ALL).length, 9);
  assert.equal(rewardOpen(medalItem("paint", "silverline"), { ach: 4 }), false);
  assert.equal(rewardOpen(medalItem("paint", "silverline"), { ach: 5 }), true);
  assert.equal(rewardOpen(medalItem("paint", "laurel"), { goldActs: [2] }), false);
  assert.equal(rewardOpen(medalItem("paint", "laurel"), { goldActs: [1] }), true);
  assert.equal(rewardOpen(medalItem("emblem", "laurels"), { gold: 10 }), true);
  assert.equal(rewardOpen(medalItem("banner", "challenger"), { sets: 1 }), true);
  assert.equal(rewardOpen(medalItem("banner", "challenger"), null), false);
  assert.equal(rewardOpen({ id: "x" }, ALL), false, "no unlock: never open");
  assert.deepEqual(newRewards({ ...NONE, sets: 0 }, { ...NONE, sets: 1 }).map((r) => `${r.kind}:${r.id}`), ["banner:challenger"]);
  assert.deepEqual(newRewards(ALL, ALL), []);
});

test("picking: only an unlocked reward, kept on load, dropped when its unlock is gone", () => {
  const p = freshProfile();
  assert.equal(withPick(p, "paint", "laurel", NONE), p, "locked: no change");
  const q = withPick(p, "paint", "laurel", { goldActs: [1] });
  assert.equal(q.picks.paint, "laurel");
  assert.equal(isUnlocked("paint", "laurel", 1, { goldActs: [1] }), true);
  assert.equal(isUnlocked("paint", "gold", 1, ALL), false, "rank items still need their rank");
  assert.equal(normalizeProfile(q, { goldActs: [1] }).picks.paint, "laurel");
  assert.equal(normalizeProfile(q, NONE).picks.paint, "factory");
  assert.equal(itemOf("banner", "decorated").label, "Decorated");
  assert.equal(normalizeProfile({ xp: 0, picks: { emblem: "medal", banner: "golden" } }, ALL).picks.emblem, "medal");
});

test("paint: a medal scheme tints the player's units through the same view plugin", () => {
  const parts = [{ isMesh: true, userData: {} }];
  const root = { userData: { model: { traverse: (fn) => parts.forEach(fn) } } };
  const plugin = new RankPaintView({ objects: new Map([[1, root]]) });
  plugin.dress(root, { team: 0, kind: "unit" });
  setActivePaint("crimson");
  assert.equal(activePaint(), "crimson");
  assert.deepEqual(parts[0].userData.tint, paintTint("crimson"));
  assert.deepEqual(paintTint("crimson"), medalItem("paint", "crimson").tint);
  setActivePaint("factory");
  assert.equal("tint" in parts[0].userData, false);
});

test("never a stat: the simulation never reads a reward, and a match plays the same whatever is picked", () => {
  const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
  const simFiles = ["simulation.js", "commands.js", "snapshot.js", "data.js", "factions.js", ...readdirSync(new URL("../src/sim/", import.meta.url), { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => `sim/${f.replaceAll("\\", "/")}`)];
  for (const file of simFiles) assert.doesNotMatch(read(file), /profile-rank|meta\/rewards|meta\/record|meta-ui|rank-ui/, `${file} never imports a cosmetic`);
  for (const file of ["meta/rewards.js", "meta-ui.js"]) assert.doesNotMatch(read(file), /rules-store|rule-options|S\.rules\s*=|options\.rules\s*=|Math\.random/, `${file} never touches the rules`);
  const run = () => { const s = new Simulation({ map: "riverlands", aiSpeed: "fast" }); s.command({ team: 0, type: "harvest" }); for (let i = 0; i < 600; i++) s.tick(0.05); return s.hash(); };
  setActivePaint("factory");
  const plain = run();
  for (const id of MEDAL_ITEMS.paint.map((i) => i.id)) { setActivePaint(id); assert.equal(run(), plain, `paint ${id}: same match`); }
  setActivePaint("factory");
});

test("every reward reads in Vietnamese and Korean", () => {
  for (const lang of ["vi", "ko"]) for (const kind of MEDAL_KINDS) for (const i of MEDAL_ITEMS[kind]) for (const text of [i.label, i.how]) assert.notEqual(translate(text, lang), text, `${lang}: ${text}`);
});
