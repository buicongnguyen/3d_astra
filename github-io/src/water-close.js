import * as THREE from "three";

// Hero-view water (2026-11-28; owner: "in Skywing mode, check the water effect, if that is cheap then make it look
// better"). The water stays ONE mesh, ONE material, ONE draw and ONE program (environment-view.js waterLife); this
// file holds the shared uniforms, the GLSL it adds and the tier rule. The RTS view runs tier 0: one uniform branch
// skips everything below, so it draws the V1 water exactly as before. With the Hero camera on (Skywing flying or
// landed, any driven hero) the same program adds:
//   - ripple normals: value noise with its analytic gradient, flowing downstream on rivers (aLife.y) and drifting
//     with the wind on lakes; two layers on PCs, one on phones and Eco. They replace the tiling sine normal map, and
//     each layer fades out where its cells shrink under a pixel (no shimmer far away);
//   - Fresnel sky: at grazing angles the water turns toward the backdrop's own sky, horizon to zenith (map-edge.js
//     userData.sky, which night and storm looks tint), so the reflection always matches the sky behind it;
//   - a soft bank reflection: where the reflected ray would meet the nearest bank before clearing it, the sky in the
//     water darkens to the bank's shaded ground (dimmed with the sky at night);
//   - shallow clarity: over shallows and fords less reflection and a lighter bed (PCs add soft moving caustics), so the
//     bed, the stepping stones and the fish (ambient-life.js) read;
//   - sun glints (PCs): a sharp sparkle where a ripple facet mirrors the sun (the moon at night) toward the camera,
//     twinkling, and none in shadow (the sun's shadowed colour from three's light loop);
//   - wading rings where units cross a ford and a downwash ring under Skywing over water: uniforms (RINGS slots and
//     one wash), filled by water-close-view.js; no draw, no pool.
// Motion off (reduced motion, Animate water Off, the governor's still step) stops the water clock: still water,
// nothing scrolls, no new rings and no downwash.

// Tier 0 = the RTS water (the hero block is skipped); 1 = phones and Eco (Fresnel, bank, shallows, one ripple layer,
// rings and downwash); 2 = PCs (and a second ripple layer, caustics and sun glints).
export const WATER_TIER = Object.freeze({ off: 0, lite: 1, full: 2 });
// The Hero view's water tier. `level` is the frame governor's (governor.js LEVELS): its still and rescue steps drop a
// PC to the light path. Lava (W9 Ember Crown) keeps its own crawl and never takes the water look.
export function waterTier({ hero = false, touch = false, eco = false, level = "full", lava = false } = {}) {
  if (!hero || lava) return WATER_TIER.off;
  if (touch || eco || level === "still" || level === "rescue") return WATER_TIER.lite;
  return WATER_TIER.full;
}

// Wading ring slots (a ring buffer, oldest replaced): x, z, start (water clock, s), size.
export const RINGS = 8;
// A ring lives this long (s) and a wading unit starts one this often (s).
export const RING = Object.freeze({ life: 1.8, every: 0.55, reach: 42 });
// Skywing's downwash: full strength at or under `low` m over the water, none above `high`; ring radius (m).
export const WASH = Object.freeze({ low: 4, high: 9, radius: 2.6 });
// The bank's height (m, ground plus grass and reeds) the reflected ray has to clear, and the widest band (m) of
// water that shows it (a soft dark edge along the far shore; a whole lake seen low would turn the bank's colour).
export const BANK_HEIGHT = 1.1;
export const BANK_BAND = 2.2;

const OFF = -1000;
export const WATER_CLOSE = {
  tier: { value: 0 },
  horizon: { value: new THREE.Color("#a9c9dc") },
  zenith: { value: new THREE.Color("#3f6f9c") },
  // The sky's brightness against the map's own daylight (1 by day): dims the bank in the water at night.
  light: { value: 1 },
  // The banks' shaded ground as the water shows it (per map, EnvironmentView sets it).
  bank: { value: new THREE.Color("#2f4426") },
  // 1 on a frozen land (W9 Frostmere): its fords are ice roads, not water.
  ice: { value: 0 },
  rings: { value: Array.from({ length: RINGS }, () => new THREE.Vector4(0, 0, OFF, 0)) },
  // x, z, strength (0 = none), radius.
  wash: { value: new THREE.Vector4(0, 0, 0, WASH.radius) },
};
export function clearRings() {
  for (const r of WATER_CLOSE.rings.value) r.set(0, 0, OFF, 0);
  WATER_CLOSE.wash.value.z = 0;
}

// The uniforms one water shader takes (shared objects: one write reaches every program).
export function waterCloseUniforms(shader) {
  shader.uniforms.uWaterTier = WATER_CLOSE.tier;
  shader.uniforms.uWaterHorizon = WATER_CLOSE.horizon;
  shader.uniforms.uWaterZenith = WATER_CLOSE.zenith;
  shader.uniforms.uWaterLight = WATER_CLOSE.light;
  shader.uniforms.uWaterBank = WATER_CLOSE.bank;
  shader.uniforms.uWaterIce = WATER_CLOSE.ice;
  shader.uniforms.uWaterRings = WATER_CLOSE.rings;
  shader.uniforms.uWaterWash = WATER_CLOSE.wash;
}

// Declarations, after the water's hash and value noise (wHash, wNoise).
export const WATER_CLOSE_PARS = `
#define WATER_RINGS ${RINGS}
uniform float uWaterTier;
uniform vec3 uWaterHorizon;
uniform vec3 uWaterZenith;
uniform float uWaterLight;
uniform vec3 uWaterBank;
uniform float uWaterIce;
uniform vec4 uWaterRings[WATER_RINGS];
uniform vec4 uWaterWash;
// Value noise and its gradient, from the same four hashes (x: value, yz: d/dp).
vec3 wNoiseD(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = wHash(i), b = wHash(i + vec2(1.0, 0.0)), c = wHash(i + vec2(0.0, 1.0)), d = wHash(i + vec2(1.0, 1.0)), k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * vec2(b - a + k * u.y, c - a + k * u.x));
}
`;

// After the water's own colour block (#include <color_fragment>): the ripple slope, foam from rings and downwash,
// shallow clarity. Leaves wN (the world ripple normal), wSlope, wK (1 = water, 0 = an ice road) and wShallow.
export const WATER_CLOSE_COLOR = `
      vec3 wN = vec3(0.0, 1.0, 0.0);
      vec2 wSlope = vec2(0.0);
      float wK = 0.0, wShallow = 0.0;
#ifndef WATER_LAVA
      if (uWaterTier > 0.5) {
        float t = uWaterTime, shore = vLife.x, flow = vLife.y, ford = vLife.z;
        vec2 w = vWaterW.xz;
        wK = 1.0 - uWaterIce * ford;
        // Layer A: long ripples, stretched along the stream, carried downstream (+x, the streaks' way) on rivers and
        // drifting with the wind on lakes. The scale is chained into the gradient (d/dw = S * dNoise).
        vec2 sA = vec2(0.75, 1.3), pA = (w - vec2(0.9 * flow + 0.14, 0.07) * t) * sA;
        vec3 nA = wNoiseD(pA);
        // Each layer fades out where its cells shrink under about a pixel (no shimmer in the distance).
        wSlope = nA.yz * sA * 0.21 * (1.0 - smoothstep(0.3, 0.8, length(fwidth(pA))));
        float caustic = 0.0, foam = 0.0;
        if (uWaterTier > 1.5) {
          // Layer B (PCs): finer ripples at a turned angle, crossing slowly (never lined up with A: no tiling).
          vec2 q = vec2(0.8 * w.x - 0.6 * w.y, 0.6 * w.x + 0.8 * w.y), pB = q * 2.1 + vec2(-0.23, 0.41) * t * (0.6 + 0.6 * flow);
          vec3 nB = wNoiseD(pB);
          vec2 gB = vec2(0.8 * nB.y + 0.6 * nB.z, -0.6 * nB.y + 0.8 * nB.z) * 2.1;
          wSlope += gB * 0.07 * (1.0 - smoothstep(0.3, 0.8, length(fwidth(pB))));
          // Caustics: the bright seam where the two layers' heights meet, moving with both.
          caustic = pow(1.0 - min(abs(nA.x + nB.x - 1.0) * 2.2, 1.0), 6.0);
        }
        // Wading rings: a few crests running out from a unit in a ford, fading as they spread.
        for (int i = 0; i < WATER_RINGS; i++) {
          vec4 r = uWaterRings[i];
          float age = t - r.z;
          if (age < 0.0 || age > ${RING.life.toFixed(2)}) continue;
          vec2 d = w - r.xy;
          float dist = length(d), x = dist - (0.2 + age * 1.15) * r.w;
          if (abs(x) > 0.7) continue;
          float env = 1.0 - age / ${RING.life.toFixed(2)}, bell = exp(-x * x * 16.0) * env;
          wSlope -= d / max(dist, 1e-3) * sin(x * 15.0) * bell * 0.2;
          foam += smoothstep(0.55, 1.0, cos(x * 15.0)) * bell * env * 0.55;
        }
        // Skywing's downwash: ripples pushed out from under it and a ruffled white ring.
        if (uWaterWash.z > 0.0) {
          vec2 d = w - uWaterWash.xy;
          float dist = length(d), rr = uWaterWash.w;
          if (dist < rr * 1.7) {
            float k = uWaterWash.z * (1.0 - smoothstep(rr * 0.7, rr * 1.7, dist));
            wSlope += d / max(dist, 1e-3) * sin(dist * 5.5 - t * 10.0) * 0.16 * k;
            float ring = smoothstep(rr * 0.6, rr * 0.95, dist) * (1.0 - smoothstep(rr * 0.95, rr * 1.35, dist));
            foam += k * (ring * 0.55 + 0.3 * smoothstep(0.45, 0.85, wNoise(w * 3.2 + vec2(t * 2.3, -t * 1.7))) * (1.0 - smoothstep(0.0, rr, dist)));
          }
        }
        wSlope *= wK;
        wN = normalize(vec3(-wSlope.x, 1.0, -wSlope.y));
        // Shallow clarity: the pale water near the banks and over a ford shows its bed (lighter, caustics on PCs).
        wShallow = max(smoothstep(0.45, 0.9, shore), ford) * wK;
        diffuseColor.rgb *= 1.0 + wShallow * (0.05 + caustic * 0.2);
        diffuseColor.rgb = mix(diffuseColor.rgb, uWaterFoam * diffuse, clamp(foam * wK, 0.0, 0.75));
      }
#endif
`;

// After #include <normal_fragment_maps>: the ripple normal replaces the sine normal map (view space, like three's).
export const WATER_CLOSE_NORMAL = `
#ifndef WATER_LAVA
      if (uWaterTier > 0.5) {
        normal = normalize(mix(normal, (viewMatrix * vec4(wN, 0.0)).xyz, wK));
        // A little glossier up close: the sun's sheen breaks into the ripples instead of one broad pale patch.
        roughnessFactor = mix(roughnessFactor, 0.13, wK);
      }
#endif
`;

// Before #include <opaque_fragment> (lit, before tone mapping): the sky and bank in the water, and the glints.
export const WATER_CLOSE_LIGHT = `
#ifndef WATER_LAVA
      if (uWaterTier > 0.5) {
        vec3 wV = normalize(cameraPosition - vWaterW), wR = reflect(-wV, wN);
        float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(wN, wV), 0.0, 1.0), 5.0);
        // The sky just over the horizon as the backdrop draws it (about halfway to the zenith colour), bluer higher up.
        vec3 sky = mix(uWaterHorizon, uWaterZenith, 0.45 + 0.55 * smoothstep(0.0, 0.55, wR.y));
        // The bank in the water: the shore value's world gradient (screen derivatives) points to the nearest bank; a
        // reflected ray heading that way meets the bank unless it clears BANK_HEIGHT within the distance to it.
        float shore = vLife.x;
        vec2 ex = dFdx(vWaterW.xz), ey = dFdy(vWaterW.xz);
        float sx = dFdx(shore), sy = dFdy(shore), det = ex.x * ey.y - ex.y * ey.x;
        vec2 grad = abs(det) > 1e-9 ? vec2(sx * ey.y - sy * ex.y, ex.x * sy - ey.x * sx) / det : vec2(0.0);
        float gl = length(grad), flat2 = length(wR.xz);
        float toward = gl > 1e-4 && flat2 > 1e-4 ? dot(wR.xz / flat2, grad / gl) : 0.0;
        float toBank = (1.0 - shore) / max(gl, 0.05), reach = min(${BANK_HEIGHT.toFixed(2)} * flat2 / max(wR.y, 0.03), ${BANK_BAND.toFixed(2)});
        float bank = smoothstep(0.05, 0.35, toward) * (1.0 - smoothstep(reach * 0.55, reach * 1.25 + 0.3, toBank));
        // The sky as bright as the lit water and a little richer (it turns the water's hue toward the sky, it never dulls
        // it: the owner's vivid look). The sky gives way to clear shallows; the bank's reflection does not (it is what
        // the far shore shows).
        const vec3 wLum = vec3(0.2126, 0.7152, 0.0722);
        float lumSky = max(dot(sky, wLum), 1e-4);
        sky = max(mix(vec3(lumSky), sky, 1.25), 0.0) * clamp(dot(outgoingLight, wLum) / lumSky, 0.85, 1.7);
        float kSky = min(fres, 0.45) * (1.0 - 0.6 * wShallow) * wK, kBank = bank * (0.3 + 0.7 * min(fres * 2.5, 1.0)) * 0.55 * wK;
        outgoingLight = mix(outgoingLight, sky, kSky * (1.0 - kBank));
        outgoingLight = mix(outgoingLight, uWaterBank * uWaterLight, kBank);
#if NUM_DIR_LIGHTS > 0
        if (uWaterTier > 1.5) {
          // Sun glints: steeper facets than the visible ripples (more of them can mirror the sun), a tight lobe and a
          // twinkle that comes and goes. directLight is three's sun after its shadow, so none glint in shade.
          vec3 nG = normalize((viewMatrix * vec4(normalize(vec3(-wSlope.x * 2.6, 1.0, -wSlope.y * 2.6)), 0.0)).xyz);
          float s = dot(reflect(-geometryViewDir, nG), directLight.direction);
          if (s > 0.985) {
            float twinkle = smoothstep(0.58, 0.95, wNoise(vWaterW.xz * 4.5 + vec2(uWaterTime * 1.4, -uWaterTime * 1.1)));
            outgoingLight += directLight.color * pow(s, 600.0) * twinkle * 7.0 * wK * (1.0 - 0.5 * wShallow);
          }
        }
#endif
      }
#endif
`;
