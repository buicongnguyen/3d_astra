import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import GRADE from "../src/look-grade.json" with { type: "json" };
import { gradeFor, gradeChunk, fogOverride, addTeamRim } from "../src/look-grade.js";
import { bakedMaterial } from "../src/view.js";
import { MeshStandardMaterial } from "three";

test("the grade is one table: strength scales every term, themes may override", () => {
  assert.equal(gradeFor("classic").saturation, 1.12);
  assert.equal(gradeFor("classic", { ...GRADE, strength: 0 }).saturation, 1);
  assert.ok(gradeFor("classic", { ...GRADE, strength: 0 }).shadowTint.every((v) => v === 0));
  assert.equal(gradeFor("dunes", { ...GRADE, themes: { dunes: { saturation: 1.3 } } }).saturation, 1.3);
});
test("the chunk is GLSL that keeps Neutral mapping first and has no placeholders", () => {
  const c = gradeChunk(gradeFor("classic"));
  assert.match(c, /^vec3 CustomToneMapping/);
  assert.match(c, /NeutralToneMapping\( color \)/);
  assert.doesNotMatch(c, /undefined|NaN/);
});
test("the Ashen fog is lighter than before and the rim is on in Eco and High", () => {
  assert.equal(fogOverride("classic"), "#3a2a4a");
  assert.ok(GRADE.rim.strength.eco > 0 && GRADE.rim.strength.high > GRADE.rim.strength.eco);
  const view = readFileSync(new URL("../src/view.js", import.meta.url), "utf8");
  assert.match(view, /rimShader\(shader\)/);
  assert.match(view, /addTeamRim\(m, /);
});
test("fonts: Baloo 2 has Latin and Vietnamese files, plus the Korean subset, under src/fonts (the CSS side is in css-layout.test.js)", () => {
  assert.deepEqual(readdirSync(new URL("../src/fonts/", import.meta.url)).filter((f) => f.endsWith(".woff2")).sort(),
    ["baloo-2-latin-800-normal.woff2", "baloo-2-vietnamese-800-normal.woff2", "noto-sans-kr-subset.woff2"]);
});
