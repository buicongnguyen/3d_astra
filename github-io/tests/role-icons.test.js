import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import balance from "../src/balance.json" with { type: "json" };
import { ROLE_ICON, roleIcon, isHealerGlyph } from "../src/role-icons.js";
import { icon } from "../src/icons.js";
import { ABILITY_ICONS, STANCE_INFO, abilityIcon } from "../src/tactics-ui.js";

// icon() draws the logo for an unknown name; a glyph exists when its markup differs from the logo's.
const LOGO = icon("logo");
const exists = (name) => icon(name) !== LOGO;
const D = balance.definitions;

test("every unit type in balance.json has a role glyph, and every glyph exists in icons.js", () => {
  for (const [type, d] of Object.entries(D)) {
    if (d.kind !== "unit") continue;
    assert.ok(ROLE_ICON[type], `${type} has a role glyph`);
    assert.ok(exists(roleIcon(type)), `${type} -> ${roleIcon(type)} is drawn in icons.js`);
  }
  for (const [type, glyph] of Object.entries(ROLE_ICON)) assert.ok(exists(glyph), `${type} -> ${glyph} exists`);
});

test("faction units take the glyph of the role they replace (balance.json swaps); Stalker keeps its own", () => {
  for (const faction of Object.values(balance.factions))
    for (const [base, unit] of Object.entries(faction.swap || {})) assert.equal(roleIcon(unit), roleIcon(base), `${unit} <- ${base}`);
  assert.equal(roleIcon("stalker"), "sniper");
  assert.notEqual(roleIcon("worker"), roleIcon("engineer"), "Harvester and Engineer no longer share a wrench");
});

test("only healers draw the red cross", () => {
  const healers = Object.keys(D).filter((t) => D[t].kind === "unit" && isHealerGlyph(t)).sort();
  assert.deepEqual(healers, ["medic", "wagon"]);
});

test("upgrade tiles and buildings resolve to drawn glyphs", () => {
  for (const [type, d] of Object.entries(D)) if (d.kind !== "unit") assert.ok(exists(roleIcon(type)), `${type} -> ${roleIcon(type)}`);
  for (const t of ["upgrade", "upgrade2", "plating", "plating2"]) assert.ok(!["bolt", "shield", "energy"].includes(roleIcon(t)), t);
});

test("one meaning per glyph: abilities, stances and orders do not reuse the energy bolt, the Shield wall shield or the Training flag", () => {
  const abilityGlyphs = Object.values(D).filter((d) => d.ability && d.kind === "unit" && !d.creature).map((d) => abilityIcon(d.ability));
  for (const g of [...Object.values(ABILITY_ICONS), ...abilityGlyphs]) {
    assert.ok(exists(g), `${g} exists`);
    assert.notEqual(g, "bolt", "the bolt is the energy resource");
  }
  assert.equal(abilityIcon({ id: "unknown" }), "star");
  assert.notEqual(STANCE_INFO.guard.icon, ABILITY_ICONS.shieldwall);
  assert.notEqual(STANCE_INFO.aggressive.icon, "attack");
  assert.notEqual(STANCE_INFO.hold.icon, ABILITY_ICONS.brace);
  assert.ok(readFileSync(new URL("../src/app/command-card.js", import.meta.url), "utf8").includes('icon("rally","desk")'), "Rally has its own glyph");
  assert.ok(!readFileSync(new URL("../src/app/hud.js", import.meta.url), "utf8").includes('icon(open ? "bolt"'), "Research is not the bolt");
});

test("building badges are distinct glyphs", () => {
  const badges = ["hq", "relay", "barracks", "foundry", "tower"].map((t) => icon(D[t].icon));
  assert.equal(new Set(badges).size, badges.length);
});
