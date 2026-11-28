import * as THREE from "three";
import { mulberry32 } from "./rng.js";

// H5 close-view surface detail (Hero mode only; the normal RTS view is unchanged).
//
// The models have no UVs, so the detail is projected from each surface's own model-space position along its
// dominant normal axis (one texture lookup per pattern, "triplanar-ish"). The pattern comes from ONE tiny atlas
// drawn by code (128 x 128 RGBA, 64 KB, no file): each channel holds one tileable pattern:
//   R  panel seams and rivets      painted armour and team paint (roughness under ~0.55)
//   G  metal scratches              bare metal (metalness over ~0.5)
//   B  cloth weave                  matte parts (suits, canvas), at a fine scale
//   A  concrete and stone pores     matte parts (rubber, walls, bunkers), at a coarse scale
// The family is picked per fragment from the surface's finish (the baked material's per-vertex roughness and
// metalness, or the material's own), so one program serves every model and no material is cloned.
// It fades out with distance from the hero camera (CLOSE_DETAIL.range), and it is skipped entirely (one uniform
// branch) while CLOSE_DETAIL.amount is 0: in the RTS view, with Close-up detail Off, or when the governor or a
// phone's Auto setting turns it off. The same fade lifts the Fresnel rim near the hero (look-grade.js rimShader)
// and makes bare metal a little glossier there.
//
// The rim patch (look-grade.js) calls closeDetailShader for every rim material, so the baked body material and every
// Team material get it: no new draw, no new program per model, and no extra pass.

export const ATLAS_SIZE = 128;
// Metres one tile covers, per pattern.
export const SCALE = { panels: 0.55, scratches: 0.5, weave: 0.2, concrete: 1.1 };

// Tileable value noise on an integer lattice of `period` cells over the tile.
function valueNoise(r, period) {
  const g = Array.from({ length: period * period }, () => r());
  return (u, v) => {
    const x = u * period, y = v * period, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const at = (i, j) => g[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

// The atlas pixels (RGBA, 128 = neutral in every channel). Pure and seeded: the same bytes on every device.
export function drawDetailAtlas(size = ATLAS_SIZE, seed = 5150) {
  const r = mulberry32(seed), n = size * size;
  const ch = [0, 1, 2, 3].map(() => new Float32Array(n));
  const wrap = (v) => ((v % size) + size) % size;
  const add = (c, x, y, v) => { ch[c][wrap(y) * size + wrap(x)] += v; };
  // R: panels. Plates two across and three down (rows offset like brickwork), a dark seam with a lit lip, rivets.
  const mott = valueNoise(r, 8);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) ch[0][y * size + x] = (mott(x / size, y / size) - 0.5) * 12;
  const rows = 3, rowH = size / rows;
  for (let row = 0; row < rows; row++) {
    const y0 = Math.round(row * rowH), shift = row % 2 ? size / 4 : 0;
    for (let x = 0; x < size; x++) { add(0, x, y0, -58); add(0, x, y0 + 1, -30); add(0, x, y0 + 2, 16); }
    for (const sx of [0, size / 2]) {
      const x0 = Math.round(sx + shift);
      for (let y = y0; y < y0 + rowH; y++) { add(0, x0, y, -58); add(0, x0 + 1, y, -26); add(0, x0 + 2, y, 14); }
      // Rivets along the vertical seam and the top seam.
      for (let k = 6; k < rowH - 3; k += 10) rivet(x0 + 5, y0 + k);
    }
    for (let x = 6; x < size; x += 12) rivet(x, y0 + 5);
  }
  function rivet(cx, cy) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= 1.6) add(0, cx + dx, cy + dy, 42 - (dx + dy) * 6); else if (d <= 2.8) add(0, cx + dx, cy + dy, -30);
    }
  }
  // G: scratches. Thin bright strokes, mostly along one direction, over a faint brushed grain.
  for (let y = 0; y < size; y++) { const grain = (r() - 0.5) * 6; for (let x = 0; x < size; x++) ch[1][y * size + x] = grain + (r() - 0.5) * 4; }
  for (let s = 0; s < 70; s++) {
    const len = 8 + r() * 46, a = (r() - 0.5) * 0.9 + (r() < 0.2 ? Math.PI / 2 : 0), x = r() * size, y = r() * size, strong = 26 + r() * 34;
    for (let t = 0; t < len; t += 0.5) add(1, Math.round(x + Math.cos(a) * t), Math.round(y + Math.sin(a) * t), strong * (1 - Math.abs(t / len - 0.5)) * 0.5);
  }
  // B: weave. Warp and weft threads 8 px apart, over and under in a 2 x 2 checker.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const over = ((x >> 3) + (y >> 3)) & 1, u = (x % 8) / 8, v = (y % 8) / 8;
    const thread = over ? Math.sin(Math.PI * v) : Math.sin(Math.PI * u);
    ch[2][y * size + x] = (thread - 0.62) * 46 + (r() - 0.5) * 5;
  }
  // A: concrete. Two octaves of noise, small dark pores and a few hairline cracks.
  const big = valueNoise(r, 6), small = valueNoise(r, 24);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) ch[3][y * size + x] = (big(x / size, y / size) - 0.5) * 22 + (small(x / size, y / size) - 0.5) * 14;
  for (let p = 0; p < 260; p++) {
    const cx = Math.floor(r() * size), cy = Math.floor(r() * size), rad = r() < 0.8 ? 1 : 2;
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) add(3, cx + dx, cy + dy, -34);
  }
  for (let c = 0; c < 4; c++) {
    let x = r() * size, y = r() * size, a = r() * Math.PI * 2;
    for (let s = 0; s < 70; s++) { a += (r() - 0.5) * 0.8; x += Math.cos(a); y += Math.sin(a); add(3, Math.round(x), Math.round(y), -40); }
  }
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(128 + ch[c][i])));
  return out;
}

let atlas = null;
function atlasTexture() {
  if (atlas) return atlas;
  atlas = new THREE.DataTexture(drawDetailAtlas(), ATLAS_SIZE, ATLAS_SIZE, THREE.RGBAFormat);
  atlas.wrapS = atlas.wrapT = THREE.RepeatWrapping;
  atlas.magFilter = THREE.LinearFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.colorSpace = THREE.NoColorSpace; // data, not colour
  atlas.needsUpdate = true;
  return atlas;
}

// Shared by every patched material. `amount` 0 = off (the whole block is skipped); `eye` the hero camera; `range`
// the fade (full detail nearer than x m, none past y m); `rim` how much the rim grows near the hero.
export const CLOSE_DETAIL = {
  amount: { value: 0 },
  // Creature life (tagCreatureLife): 1 while the close view is on and motion is allowed; the clock; the driven hero.
  life: { value: 0 },
  lifeTime: { value: 0 },
  hero: { value: new THREE.Vector3(0, -1000, 0) },
  eye: { value: new THREE.Vector3() },
  range: { value: new THREE.Vector2(7, 22) },
  rim: { value: 0 },
  atlas: { value: null },
};

const VERTEX_PARS = `
uniform vec3 uCdEye;
uniform vec2 uCdRange;
uniform float uCdAmount;
uniform float uCdRim;
uniform float uCdLife;
uniform float uCdLifeTime;
uniform vec3 uCdHero;
attribute vec4 aLife;      // head (1, 2 = ear tips), tail, breathing, 0.5 (the mark of a tagged creature)
attribute vec4 aLifePivot; // neck y, z, tail root y, z
varying vec3 vCdPos;
varying vec3 vCdNrm;
varying float vCdFade;
vec3 cdYaw( vec3 p, vec2 pivot, float a ) {
	vec3 q = p - vec3( 0.0, pivot.x, pivot.y );
	float c = cos( a ), s = sin( a );
	return vec3( q.x * c + q.z * s, q.y, -q.x * s + q.z * c ) + vec3( 0.0, pivot.x, pivot.y );
}`;
const VERTEX_MAIN = `
	// Creature life (H5, close-view detail models of the wild creatures only: the attribute's w is exactly 0.5 there and
	// never on anything else): breathing, idle head turns, ear flicks and a tail that sways, from the instance's own
	// phase; near the driven hero the head turns away, the body crouches a little and the tail tucks in.
	if ( uCdLife > 0.5 && abs( aLife.w - 0.5 ) < 0.01 ) {
		vec4 cdO = vec4( 0.0, 0.0, 0.0, 1.0 );
		mat3 cdR = mat3( 1.0 );
		#ifdef USE_INSTANCING
			cdO = instanceMatrix * cdO; cdR = mat3( instanceMatrix );
		#endif
		cdO = modelMatrix * cdO;
		float ph = fract( dot( floor( cdO.xz * 0.25 ), vec2( 0.1731, 0.4127 ) ) + aLife.w );
		float t = uCdLifeTime;
		vec3 toHero = uCdHero - cdO.xyz;
		float shy = 1.0 - smoothstep( 4.0, 9.0, length( toHero.xz ) );
		vec3 local = transpose( cdR ) * toHero;
		float away = -sign( local.x + 1e-4 ) * 0.7 * shy;
		float breath = sin( t * 1.7 + ph * 6.2832 );
		transformed.xy *= 1.0 + vec2( 0.025, 0.012 ) * breath * aLife.z;
		transformed.y *= 1.0 - 0.07 * shy * aLife.z;
		if ( aLife.x > 0.0 ) {
			float look = 0.32 * sin( t * 0.43 + ph * 6.2832 ) + 0.12 * sin( t * 1.31 + ph * 3.1 );
			transformed = cdYaw( transformed, aLifePivot.xy, mix( look, away, shy ) * min( aLife.x, 1.0 ) );
			if ( aLife.x > 1.5 ) transformed.y += pow( max( 0.0, sin( t * 0.9 + ph * 17.0 ) ), 24.0 ) * 0.05;
		}
		if ( aLife.y > 0.0 ) {
			float wag = sin( t * ( 2.0 + 3.0 * shy ) + ph * 4.0 ) * mix( 0.32, 0.12, shy );
			transformed = cdYaw( transformed, aLifePivot.zw, wag * aLife.y );
			transformed.y -= 0.12 * shy * aLife.y * max( 0.0, aLifePivot.w - transformed.z );
		}
	}
	{
		vCdPos = transformed;
		vCdNrm = objectNormal;
		vCdFade = 0.0;
		if ( uCdAmount + uCdRim > 0.0 ) {
			vec4 cdW = vec4( transformed, 1.0 );
			#ifdef USE_INSTANCING
				cdW = instanceMatrix * cdW;
			#endif
			cdW = modelMatrix * cdW;
			vCdFade = 1.0 - smoothstep( uCdRange.x, uCdRange.y, distance( cdW.xyz, uCdEye ) );
		}
	}`;
const FRAGMENT_PARS = `
uniform float uCdAmount;
uniform sampler2D uCdAtlas;
varying vec3 vCdPos;
varying vec3 vCdNrm;
varying float vCdFade;
vec2 cdPlane( vec3 p, vec3 n ) {
	vec3 a = abs( n );
	return a.y >= a.x && a.y >= a.z ? p.xz : a.x >= a.z ? p.zy : p.xy;
}`;
// Runs just before the normal is set up: diffuseColor, roughnessFactor and metalnessFactor are all known by then.
const FRAGMENT_MAIN = `
	{
		float cdK = uCdAmount * vCdFade;
		if ( cdK > 0.004 ) {
			vec2 cdUv = cdPlane( vCdPos, vCdNrm );
			float cdMetal = smoothstep( 0.35, 0.65, metalnessFactor );
			float cdMatte = ( 1.0 - cdMetal ) * smoothstep( 0.45, 0.7, roughnessFactor );
			float cdPaint = 1.0 - cdMetal - cdMatte;
			float cdL = 0.0, cdR = 0.0;
			if ( cdMetal > 0.01 ) {
				float s = texture2D( uCdAtlas, cdUv * ${(1 / SCALE.scratches).toFixed(4)} ).g - 0.5;
				cdL += s * 0.7 * cdMetal; cdR -= ( s * 0.9 + 0.08 ) * cdMetal;
			}
			if ( cdPaint > 0.01 ) {
				float s = texture2D( uCdAtlas, cdUv * ${(1 / SCALE.panels).toFixed(4)} ).r - 0.5;
				cdL += s * 0.75 * cdPaint; cdR -= s * 0.5 * cdPaint;
			}
			if ( cdMatte > 0.01 ) {
				float w = texture2D( uCdAtlas, cdUv * ${(1 / SCALE.weave).toFixed(4)} ).b - 0.5;
				float c = texture2D( uCdAtlas, cdUv * ${(1 / SCALE.concrete).toFixed(4)} ).a - 0.5;
				cdL += ( w * 0.32 + c * 0.6 ) * cdMatte; cdR -= c * 0.3 * cdMatte;
			}
			diffuseColor.rgb *= 1.0 + cdL * cdK;
			roughnessFactor = clamp( roughnessFactor + cdR * cdK, 0.05, 1.0 );
		}
	}`;

// Adds the close-view detail to a MeshStandardMaterial's shader (called by look-grade.js rimShader).
export function closeDetailShader(shader) {
  CLOSE_DETAIL.atlas.value ||= atlasTexture();
  shader.uniforms.uCdAmount = CLOSE_DETAIL.amount;
  shader.uniforms.uCdEye = CLOSE_DETAIL.eye;
  shader.uniforms.uCdRange = CLOSE_DETAIL.range;
  shader.uniforms.uCdRim = CLOSE_DETAIL.rim;
  shader.uniforms.uCdAtlas = CLOSE_DETAIL.atlas;
  shader.uniforms.uCdLife = CLOSE_DETAIL.life;
  shader.uniforms.uCdLifeTime = CLOSE_DETAIL.lifeTime;
  shader.uniforms.uCdHero = CLOSE_DETAIL.hero;
  if (!shader.vertexShader.includes("#include <project_vertex>") || !shader.fragmentShader.includes("#include <normal_fragment_begin>")) return false;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>${VERTEX_PARS}`)
    .replace("#include <project_vertex>", `${VERTEX_MAIN}\n#include <project_vertex>`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>${FRAGMENT_PARS}`)
    .replace("#include <normal_fragment_begin>", `${FRAGMENT_MAIN}\n#include <normal_fragment_begin>`);
  return true;
}

// Whether the detail is on for a `setting` ("auto", "on", "off"; settings.closeDetail): Auto is on for PCs, and for
// touch devices while the frame governor is at its top level ("full"); On is on (the governor's rescue level still
// turns it off); Off is off.
export function closeDetailOn(setting = "auto", { touch = false, level = "full", eco = false } = {}) {
  if (setting === "off") return false;
  if (level === "rescue") return false;
  if (setting === "on") return true;
  if (eco && touch) return false;
  return touch ? level === "full" : level !== "still";
}

// ---- Creature life (H5) -----------------------------------------------------------------------------------------
// The wild creatures whose close-up detail models breathe, look about, flick their ears and sway their tails. They do
// not run from the hero (that would be a rule change: the simulation moves them); near the driven hero they turn their
// heads away, crouch and tuck their tails instead.
export const CREATURE_LIFE = new Set(["acidhound", "wyrmling", "wyrm"]);
// Shares of the model's length (front = +z): the head starts at `head`, the tail ends at `tail`.
export const LIFE_SPLIT = { head: 0.72, tail: 0.27 };
const tagged = new WeakSet();
const smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
// Tags every mesh of a detail template (model space, front = +z) with aLife and aLifePivot. Once per geometry (team
// variants share theirs). Returns the number of geometries tagged.
export function tagCreatureLife(template) {
  template.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(template);
  if (box.isEmpty()) return 0;
  const z0 = box.min.z, L = box.max.z - box.min.z, y0 = box.min.y, H = box.max.y - box.min.y;
  const neckZ = z0 + L * LIFE_SPLIT.head, tailZ = z0 + L * LIFE_SPLIT.tail;
  const v = new THREE.Vector3(), meshes = [];
  template.traverse((o) => { if (o.isMesh && !tagged.has(o.geometry)) meshes.push(o); });
  // The pivots: the mean height of the vertices near the neck and near the tail root.
  let neckY = 0, tailY = 0, nh = 0, nt = 0;
  for (const o of meshes) {
    const pos = o.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (Math.abs(v.z - neckZ) < L * 0.06) { neckY += v.y; nh++; }
      if (Math.abs(v.z - tailZ) < L * 0.06) { tailY += v.y; nt++; }
    }
  }
  neckY = nh ? neckY / nh : y0 + H * 0.7; tailY = nt ? tailY / nt : y0 + H * 0.5;
  for (const o of meshes) {
    const g = o.geometry, pos = g.getAttribute("position"), life = new Float32Array(pos.count * 4), pivot = new Float32Array(pos.count * 4);
    // The pivots in the mesh's own space.
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), pn = new THREE.Vector3(0, neckY, neckZ).applyMatrix4(inv), pt = new THREE.Vector3(0, tailY, tailZ).applyMatrix4(inv);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const head = smooth(neckZ - L * 0.04, neckZ + L * 0.06, v.z), tail = smooth(tailZ + L * 0.04, tailZ - L * 0.12, v.z);
      const ear = head > 0.9 && v.y > box.max.y - H * 0.12 ? 2 : head;
      const breath = (1 - head) * (1 - tail) * smooth(y0 + H * 0.25, y0 + H * 0.6, v.y);
      life[i * 4] = ear; life[i * 4 + 1] = tail; life[i * 4 + 2] = breath; life[i * 4 + 3] = 0.5;
      pivot[i * 4] = pn.y; pivot[i * 4 + 1] = pn.z; pivot[i * 4 + 2] = pt.y; pivot[i * 4 + 3] = pt.z;
    }
    g.setAttribute("aLife", new THREE.BufferAttribute(life, 4));
    g.setAttribute("aLifePivot", new THREE.BufferAttribute(pivot, 4));
    tagged.add(g);
  }
  return meshes.length;
}
