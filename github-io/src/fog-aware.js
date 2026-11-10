// Scenery that stands taller than the fog-of-war plane (grass tips, shrubs, small trees)
// would otherwise shine through unexplored ground. This patches a lit three.js material so
// each vertex reads the fog texture at its own map position and the fragment sinks into the
// fog colour by that amount. Parts below the fog plane are left alone: the plane itself
// already covers them. `uniforms` is shared ({ uFogMap, uFogColor, uFogHalf }); `extra`
// lets the caller add its own vertex code (wind sway) in the same patch.
export const FOG_PLANE_Y = 0.15;

export function fogAware(material, uniforms, extra = null) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, extra?.uniforms);
    shader.vertexShader = `uniform sampler2D uFogMap;\nuniform float uFogHalf;\nvarying vec2 vFogged;\n${extra?.declare || ""}\n` + shader.vertexShader
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${extra?.vertex || ""}`)
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 fogWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fogWorld = instanceMatrix * fogWorld;
        #endif
        fogWorld = modelMatrix * fogWorld;
        vFogged = vec2(texture2D(uFogMap, vec2((fogWorld.x + uFogHalf) / (2.0 * uFogHalf), (uFogHalf - fogWorld.z) / (2.0 * uFogHalf))).a, fogWorld.y);`);
    shader.fragmentShader = "uniform vec3 uFogColor;\nvarying vec2 vFogged;\n" + shader.fragmentShader
      .replace("#include <opaque_fragment>", `#include <opaque_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, min(1.0, vFogged.x * 1.08) * step(${FOG_PLANE_Y.toFixed(2)}, vFogged.y));`);
  };
  material.customProgramCacheKey = () => `fog-aware:${extra?.key || ""}`;
  material.needsUpdate = true;
  return material;
}
