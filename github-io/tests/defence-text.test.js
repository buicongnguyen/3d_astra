// Frontier Defence interface text (CW-F): every tower branch and rank has a line on the command card,
// the build zones are named from a separate export keyed by level id, and a d-crossroads match still
// serializes byte for byte as it did before ZONE_NAMES existed (it must never become a level field).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Simulation } from "../src/simulation.js";
import { GARRISONS } from "../src/sim/defence.js";
import { DEFENCE_LEVELS, ZONE_NAMES } from "../src/defence/levels.js";
import { CREW_LABEL, CREW_ROLE, BRANCH_TEXT, RANK_TEXT, ARMOUR_TEXT, PAD_NOTE } from "../src/app/defence/constants.js";

test("every crew has a tile label and a role line; every pad kind a note", () => {
  for (const crew of Object.keys(GARRISONS.crews)) {
    assert.ok(CREW_LABEL[crew], `label ${crew}`);
    assert.ok(CREW_ROLE[crew], `role ${crew}`);
  }
  for (const kind of ["ground", "rim", "deep"]) assert.ok(PAD_NOTE[kind], kind);
});

test("every tower branch has a text line and every rank of it too", () => {
  for (const [crew, g] of Object.entries(GARRISONS.crews)) {
    for (const [id, b] of Object.entries(g.branches || {})) {
      assert.ok(BRANCH_TEXT[id], `branch ${crew}/${id}`);
      const ranks = b.ranks?.length || 0;
      assert.equal(RANK_TEXT[id]?.length, ranks, `ranks ${crew}/${id}`);
      for (const line of RANK_TEXT[id] || []) assert.ok(line, `rank line ${id}`);
    }
  }
});

test("every armour upgrade has a text line", () => {
  assert.ok(ARMOUR_TEXT.rank2);
  for (const id of Object.keys(GARRISONS.armour.branches)) assert.ok(ARMOUR_TEXT[id], id);
});

test("ZONE_NAMES names every zone of every level that has zones, and no level carries it", () => {
  for (const level of DEFENCE_LEVELS) {
    for (const z of level.defence.zones || []) assert.ok(ZONE_NAMES[level.id]?.[z.id], `${level.id}/${z.id}`);
    assert.equal("zoneNames" in level.defence || "ZONE_NAMES" in level.defence, false, level.id);
  }
  for (const id of Object.keys(ZONE_NAMES)) assert.ok(DEFENCE_LEVELS.some((l) => l.id === id), id);
});

test("serialize() of a d-crossroads match is byte-identical to the one before ZONE_NAMES", () => {
  const level = DEFENCE_LEVELS.find((l) => l.id === "d-crossroads");
  const sim = new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level });
  assert.equal(createHash("sha256").update(sim.serialize()).digest("hex"), "eb6a8d6c177b464082e34e7dfa321dd231f34c5e1450ad9ef7bd3e7be46e9bab");
  assert.equal(sim.hash(), "ada3cea1");
});

// Re-score 2026-11-25b: the commander's own tile reads "Commander" with rank pips and a health bar; its accessible
// name says rank and health in words, in all three languages (the story catalog carries "Commander").
test("the commander tile's words read in Vietnamese and Korean", async () => {
  const { translate, addMessages } = await import("../src/i18n.js");
  const { readFileSync } = await import("node:fs");
  const read = (name) => JSON.parse(readFileSync(new URL(`../src/locales/${name}.json`, import.meta.url), "utf8"));
  for (const lang of ["vi", "ko"]) { addMessages(read(lang), lang); addMessages(read(`story-${lang}`), lang); }
  const sheets = readFileSync(new URL("../src/app/defence/sheets.js", import.meta.url), "utf8");
  assert.match(sheets, /<span>Commander<\/span>/);
  assert.match(sheets, /`Field commander, rank \$\{level\}, health \$\{Math\.max\(0, Math\.round\(e\.hp\)\)\} of \$\{Math\.round\(e\.maxHp\)\}`/);
  assert.equal(translate("Field commander, rank 3, health 609 of 1217", "vi"), "Chỉ huy chiến trường, bậc 3, máu 609 trên 1217");
  assert.equal(translate("Field commander, rank 3, health 609 of 1217", "ko"), "야전 사령관, 계급 3, 체력 609/1217");
  assert.notEqual(translate("Commander", "vi"), "Commander");
  assert.notEqual(translate("Commander", "ko"), "Commander");
});
