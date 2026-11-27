import * as THREE from "three";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";

// These authored panels stay visible above the underlying armour at phone scale.
// Team-painted panels get a darker stripe in the same palette.
const FEATURE_PANEL = { hawk: "Fuselage", balloon: "Envelope", kite: "Sail", glider: "Wing", hq: "Team_panels", carrier: "Canvas_roof", rider: "Sail", workshop: "Roof" };

function visibleFaces(geometry) {
  const positions = geometry.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const faces = [];
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i);
    b.fromBufferAttribute(positions, i + 1).sub(a);
    c.fromBufferAttribute(positions, i + 2).sub(a);
    const normal = b.cross(c);
    // Fixed isometric camera sees the roof and the two forward-facing walls.
    const area = normal.x * 0.35 + normal.y * 0.72 + normal.z * 0.6;
    if (area > 0) faces.push({ i, area });
  }
  // At 24 pixels, keep the largest projected facets, and skip the back or
  // underside. This also bounds the added triangles in a 300-unit army.
  faces.sort((a, b) => b.area - a.area);
  const indices = faces.slice(0, 18).flatMap(({ i }) => [i, i + 1, i + 2]);
  geometry.setIndex(indices);
  const trimmed = geometry.toNonIndexed();
  geometry.dispose();
  return trimmed;
}

// Project enamel onto the upper faces of the largest armour panels. Keeping the
// decal beside the source mesh preserves turret rotation and boss articulation.
export function addTeamBands(scene, type) {
  const panels = [], overall = new THREE.Box3().setFromObject(scene);
  let paint;
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    const name = mesh.material.name;
    if (/^Team(?:\.|$)/.test(name)) paint ??= mesh;
    const featured = mesh.name === FEATURE_PANEL[type];
    if (!featured && !/^(Armor|Rust|Medical|Cape|Cloak|Fatigue)/.test(name)) return;
    for (let parent = mesh; parent; parent = parent.parent) {
      // Skywing's weapons (generate_skywing.py) stay one baked draw each: no band of team paint on them.
      if (/^(leg_|spin_|flicker_|skywing_(sniper|rocket))/i.test(parent.name)) return;
    }
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    const elevation = (center.y - overall.min.y) / Math.max(0.001, overall.max.y - overall.min.y);
    panels.push({ mesh, center, size, score: featured ? Infinity : size.x * size.z * (0.4 + elevation) ** 2 });
  });
  if (!paint) return;
  panels.sort((a, b) => b.score - a.score);
  for (const { mesh, center, size } of panels.slice(0, 2)) {
    const projector = new THREE.Vector3(size.x * 0.46, Math.max(size.y * 0.64, 0.01), size.z * 1.6);
    center.y += size.y * 0.23;
    const geometry = visibleFaces(new DecalGeometry(mesh, center, new THREE.Euler(0, 0.22, 0), projector));
    const positions = geometry.attributes.position, normals = geometry.attributes.normal;
    if (!positions.count) { geometry.dispose(); continue; }
    const point = new THREE.Vector3(), normal = new THREE.Vector3();
    const lift = Math.max(size.x, size.y, size.z) * 0.002;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).addScaledVector(normal.fromBufferAttribute(normals, i).normalize(), lift);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    // Preserve the GLB's paint attribute layout so these faces join its existing draw.
    const color = paint.geometry.attributes.color;
    if (color) {
      const data = new THREE.BufferAttribute(new color.array.constructor(positions.count * color.itemSize), color.itemSize, color.normalized);
      const value = mesh.material === paint.material ? 0.24 : 1;
      for (let i = 0; i < data.count; i++) for (let k = 0; k < data.itemSize; k++) data.setComponent(i, k, k === 3 ? 1 : value);
      geometry.setAttribute("color", data);
    }
    if (paint.geometry.index) geometry.setIndex(Array.from({ length: positions.count }, (_, i) => i));
    geometry.applyMatrix4(mesh.matrixWorld.clone().invert());
    const stripe = new THREE.Mesh(geometry, paint.material);
    stripe.name = mesh.name + "_TeamBand";
    stripe.position.copy(mesh.position);
    stripe.quaternion.copy(mesh.quaternion);
    stripe.scale.copy(mesh.scale);
    mesh.parent.add(stripe);
    stripe.updateWorldMatrix(true, false);
  }
}
