// Colour grade and rim light (AAA round 2, W2-C, idea P9): zero extra draws, no extra pass.
//   Grade: one CustomToneMapping chunk. Khronos Neutral first (as before), then a saturation lift, warm
//   shadows and a soft S-curve, computed on the display-referred colour (a square root away from
//   linear). The numbers are in look-grade.json (one table, owner decision O7).
//   Rim: a Fresnel edge term added to the emissive light of the baked body material (a warm edge) and of
//   every Team material (the team's own colour), so dark hulls keep an edge and armies read by colour.
// A theme change that alters the grade rewrites the chunk and a program-cache key, so three recompiles.
import * as THREE from "three";
import GRADE from "./look-grade.json" with { type: "json" };

const ORIGINAL = THREE.ShaderChunk.tonemapping_pars_fragment;
const STUB = "vec3 CustomToneMapping( vec3 color ) { return color; }";
const num = (n) => (Number.isInteger(n) ? `${n}.0` : String(+n.toFixed(5)));
const vec3 = (a) => `vec3(${a.map(num).join(", ")})`;

// The grade terms of a theme, with look-grade.json's strength applied (the shadow tint and contrast scale
// with it, the saturation lifts by that share of its excess over 1).
// R3-D: `look` (a mission look name: night, storm) lays its own terms from `looks` over the theme's.
export function gradeFor(themeId, table = GRADE, look = null) {
  const own = Object.hasOwn(table.themes || {}, themeId) ? table.themes[themeId] : {};
  const mood = look && Object.hasOwn(table.looks || {}, look) ? table.looks[look] : {};
  const g = { ...table.default, ...own, ...mood }, s = table.strength ?? 1;
  return {
    saturation: 1 + (g.saturation - 1) * s,
    shadowTint: g.shadowTint.map((v) => v * s),
    shadowRange: g.shadowRange,
    contrast: Math.max(0, Math.min(1, g.contrast * s)),
  };
}

// The GLSL of the chunk for a set of grade terms.
export function gradeChunk(g) {
  return `vec3 CustomToneMapping( vec3 color ) {
	color = NeutralToneMapping( color );
	vec3 d = sqrt( max( color, vec3( 0.0 ) ) );
	float l = dot( d, vec3( 0.2126, 0.7152, 0.0722 ) );
	d = mix( vec3( l ), d, ${num(g.saturation)} );
	d += ${vec3(g.shadowTint)} * ( 1.0 - smoothstep( 0.0, ${num(g.shadowRange)}, l ) );
	d = clamp( d, 0.0, 1.0 );
	d = mix( d, d * d * ( 3.0 - 2.0 * d ), ${num(g.contrast)} );
	return d * d;
}`;
}

let current = { key: "off" };
// Installs the grade of a theme as the shared tone-mapping chunk. Returns true when it changed (the caller
// then marks materials for recompiling). Safe to call before any material compiles.
export function installGrade(themeId, table = GRADE, look = null) {
  const g = gradeFor(themeId, table, look), chunk = gradeChunk(g), key = `grade:${chunk.length}:${[g.saturation, g.contrast, ...g.shadowTint, g.shadowRange].join(",")}`;
  if (key === current.key) return false;
  if (!ORIGINAL.includes(STUB)) throw new Error("look-grade: three's tonemapping chunk changed; update look-grade.js");
  THREE.ShaderChunk.tonemapping_pars_fragment = ORIGINAL.replace(STUB, chunk);
  current = { key };
  return true;
}
export const gradeKey = () => current.key;
// Every material's program cache key carries the grade (materials with their own key add gradeKey() themselves).
if (!THREE.Material.prototype.customProgramCacheKey.__graded) {
  const base = THREE.Material.prototype.customProgramCacheKey;
  THREE.Material.prototype.customProgramCacheKey = Object.assign(function () { return `${base.call(this)}|${current.key}`; }, { __graded: true });
}

// The fog-of-war colour a theme's grade table overrides (or undefined).
export const fogOverride = (themeId, table = GRADE) => (Object.hasOwn(table.fog || {}, themeId) ? table.fog[themeId] : undefined);

// ---- Rim -------------------------------------------------------------------------------------------
// Shared by every rim material: the strength follows the render tier (set by WorldView).
export const RIM = {
  strength: { value: GRADE.rim.strength.high },
  power: { value: GRADE.rim.power },
  color: new THREE.Color(GRADE.rim.color),
};
export const setRimTier = (eco) => { RIM.strength.value = eco ? GRADE.rim.strength.eco : GRADE.rim.strength.high; };

// Adds the rim to a MeshStandardMaterial's shader. `color` is a THREE.Color: a Team material passes its team
// colour (the uniform is per material); the baked body material passes nothing and gets the warm RIM colour.
// Orthographic view: the view direction is the camera axis, so the rim is where the surface turns away from it.
export function rimShader(shader, color = null) {
  shader.uniforms.uRimStrength = RIM.strength;
  shader.uniforms.uRimPower = RIM.power;
  shader.uniforms.uRimColor = { value: color || RIM.color };
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform float uRimStrength;\nuniform float uRimPower;\nuniform vec3 uRimColor;")
    .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
	{ float rimF = pow( 1.0 - clamp( normalize( normal ).z, 0.0, 1.0 ), uRimPower );
	totalEmissiveRadiance += uRimColor * ( rimF * uRimStrength ); }`);
}
export function addTeamRim(material, hex) {
  const color = new THREE.Color(hex), before = material.onBeforeCompile;
  material.userData.rim = color; // view.js recolours it with the team
  material.onBeforeCompile = (shader, renderer) => { before?.call(material, shader, renderer); rimShader(shader, color); };
  material.customProgramCacheKey = () => `team-rim|${current.key}`;
  material.needsUpdate = true;
}
