import test from "node:test";
import assert from "node:assert/strict";
import { defaults, normalize, TEAM_PALETTES, UI_SCALES } from "../src/settings.js";
import { teamColors, teamGlows } from "../src/faction-colors.js";

test("accessible palettes survive settings load and keep all mission teams distinct", () => {
  const mission = { factions: { 0: "meridian", 1: "ashfall", 2: "wardens", 3: "veil" } };
  for (const [id, colors] of Object.entries(TEAM_PALETTES)) {
    const settings = normalize({ ...defaults(), teamPalette: id });
    assert.equal(new Set(colors).size, 4);
    assert.deepEqual(teamColors(settings, mission), colors);
    assert.deepEqual(teamGlows(settings, mission), colors);
  }
});

test("scale choices survive settings load and older saves use 100 percent", () => {
  for (const n of UI_SCALES) assert.equal(normalize({version: 1, uiScale: String(n)}).uiScale, n);
  assert.equal(normalize({version: 1}).uiScale, 100);
  assert.equal(normalize({version: 1, uiScale: 300, teamPalette: "unknown"}).teamPalette, "custom");
});
