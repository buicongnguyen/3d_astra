// Faction dress (visual round V, 2026-11-26). Ashfall, Sunward, Wardens and the Veil each wear their own parts on the
// fourteen shared models (six infantry, Breaker, Tank, Kite and the five base buildings): public/models/dress-<id>.glb,
// built by tools/blender/generate_dress.py. Meridian wears none (the models as modelled).
//
// How it costs no draw: WorldView merges a dress into the template's OWN team-paint meshes of the same rigid group
// (body, turret, barrel; legs fold into the body with their shader bones). Team paint is already one instanced batch
// per team and part, so a battle of two factions draws the batches it drew before; only those meshes' geometry
// differs by faction. Parts in the faction's own colours (scrap rust, canvas, ceramic, charcoal...) ride in the same
// team mesh: their vertex colour is the final colour and its alpha is 0, which the patched team material
// (dressPaint) reads as "not team paint". A mirror match dresses every side alike: the same batches again.
//
// Loaded on first use with the first dress file (WorldView.prepareModels), so none of this is in the main bundle;
// three.js and the rig constants arrive as arguments.

// The team material's colour step for dressed geometry (RGBA vertex colour): alpha 1 = team paint times the baked
// shade (as before), alpha 0 = the vertex colour alone. RGB geometry (alpha 1) draws exactly as the stock chunk.
const DRESS_COLOR = /* glsl */ `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor.rgb = ( vColor.a < 0.5 ? vec3( 1.0 ) : diffuseColor.rgb ) * vColor.rgb;
#endif
`;

// Patches a team material once (kept for good: on RGB geometry it draws as before). Wraps, never replaces, the
// material's own hooks (team rim, shader bones), so their program keys ("|rig") stay.
export function dressPaint(material) {
  if (material.userData.factionDress) return false;
  material.userData.factionDress = true;
  const before = material.onBeforeCompile, key = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", DRESS_COLOR);
  };
  material.customProgramCacheKey = () => `${key.call(material)}|dress`;
  material.needsUpdate = true;
  return true;
}

// A dress file's scene -> Map(type -> [{ group, cls, p, n, c, index, count }]): every part in model space (the glTF
// frame the base models use), its class Team, TeamGlow or Dress (own colour), as plain arrays.
export function readDress(scene, THREE) {
  scene.updateMatrixWorld(true);
  const out = new Map(), v = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
  for (const root of scene.children) {
    if (!root.name.startsWith("dress_")) continue;
    const parts = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const [, group] = o.name.split("__"), name = o.material.name;
      const g = o.geometry, pos = g.getAttribute("position"), nor = g.getAttribute("normal"), col = g.getAttribute("color");
      const count = pos.count, p = new Float32Array(count * 3), n = new Float32Array(count * 3), c = new Float32Array(count * 3);
      normalMatrix.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z;
        v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
        n[i * 3] = v.x; n[i * 3 + 1] = v.y; n[i * 3 + 2] = v.z;
        c[i * 3] = col ? col.getX(i) : 1; c[i * 3 + 1] = col ? col.getY(i) : 1; c[i * 3 + 2] = col ? col.getZ(i) : 1;
      }
      const index = g.index ? Array.from(g.index.array) : Array.from({ length: count }, (_, i) => i);
      parts.push({ group, cls: name === "Team" || name === "TeamGlow" ? name : "Dress", p, n, c, index, count });
    });
    out.set(root.name.slice("dress_".length), parts);
  }
  return out;
}

// The aRig value (bone, pivotY, kneeY, pivotZ) of a dress part in `group`, mirroring the base model's tagging in
// WorldView.prepareModels (info: what it recorded for the type), or null when the group's base mesh is not rigged.
export function rigTag(info, group, BONE) {
  if (info.rig === "infantry") {
    const leg = group === "legL" ? info.legs.L : group === "legR" ? info.legs.R : null;
    if (leg) return [group === "legR" ? BONE.legR : BONE.legL, leg[0], leg[1], leg[2]];
    return [BONE.body, info.hipY, info.hipY * 0.5, 0];
  }
  if (info.rig === "hull" && group === "body") return [BONE.hull, info.hull[0], 0, info.hull[1]];
  return null;
}

// Which dress parts join a template mesh: its group's parts of its class (the team mesh also takes the own-colour
// parts; infantry leg parts join the body mesh, bent by their own bones).
export const partsFor = (parts, group, cls) => parts.filter((x) => (x.group === group || (group === "body" && /^leg[LR]$/.test(x.group))) &&
  (cls === "TeamGlow" ? x.cls === "TeamGlow" : x.cls !== "TeamGlow"));

// The base team mesh's geometry with the dress parts appended. The base keeps every attribute it has (uv parts get
// zeros); a team mesh's colour becomes RGBA (alpha 0 on own-colour parts) even with no part in this group, so one
// team material never sees RGB and RGBA geometry in the same match. `info` / `pivot`: see rigTag; the turret and barrel
// groups sit relative to the turret ring, as the base parts do. headOf / headTag (src/unit-rig.js, idle life): a body
// part's islands on a soldier's head (a hood, a hat, a mask) turn with the head bone (info.heads), as the base parts do.
export function dressGeometry(base, parts, { THREE, BONE, info, group, cls, headOf = null, headTag = null }) {
  const rgba = cls === "Team", nb = base.getAttribute("position").count;
  const nd = parts.reduce((n, x) => n + x.count, 0), total = nb + nd;
  const shift = (group === "turret" || group === "barrel") && info.pivot ? info.pivot : null;
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(base.attributes)) {
    const size = name === "color" && rgba ? 4 : attr.itemSize, data = new Float32Array(total * size);
    for (let i = 0; i < nb; i++) for (let k = 0; k < size; k++) data[i * size + k] = k < attr.itemSize ? attr.getComponent(i, k) : 1;
    let at = nb;
    for (const x of parts) {
      const tag = name === "aRig" ? rigTag(info, x.group, BONE) : null;
      const head = tag && headOf && info.heads && x.group === "body" ? headOf(x.p, x.index, x.count, info.heads, false, info.headExtra) : null;
      for (let i = 0; i < x.count; i++, at++) {
        const o = at * size;
        if (name === "position") { data[o] = x.p[i * 3] - (shift ? shift[0] : 0); data[o + 1] = x.p[i * 3 + 1]; data[o + 2] = x.p[i * 3 + 2] - (shift ? shift[1] : 0); }
        else if (name === "normal") { data[o] = x.n[i * 3]; data[o + 1] = x.n[i * 3 + 1]; data[o + 2] = x.n[i * 3 + 2]; }
        else if (name === "color") { data[o] = x.c[i * 3]; data[o + 1] = x.c[i * 3 + 1]; data[o + 2] = x.c[i * 3 + 2]; if (size === 4) data[o + 3] = x.cls === "Dress" ? 0 : 1; }
        else if (tag) data.set(head && head[i] >= 0 ? headTag(info.heads[head[i]], info.hipY) : tag, o);
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  const index = new (total > 65535 ? Uint32Array : Uint16Array)((base.index ? base.index.count : nb) + parts.reduce((n, x) => n + x.index.length, 0));
  let k = 0;
  if (base.index) for (let i = 0; i < base.index.count; i++) index[k++] = base.index.getX(i);
  else for (let i = 0; i < nb; i++) index[k++] = i;
  let offset = nb;
  for (const x of parts) { for (const i of x.index) index[k++] = i + offset; offset += x.count; }
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  if (out.getAttribute("aRig")) out.boundingSphere.radius += 0.35; // poses reach past the rest pose (as the base)
  return out;
}
