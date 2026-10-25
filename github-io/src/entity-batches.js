import * as THREE from "three";

// Units, buildings and deposits are clones that share geometry and materials,
// so each model part can be drawn for every copy in one instanced call. The cloned meshes
// stay in the scene graph for transforms, animation and picking, but live on SOURCE_LAYER:
// the camera and the shadow pass skip them and draw the batches instead. A 60-unit battle
// drops from ~640 draws to about one per part/type (and team for team-coloured parts).
export const SOURCE_LAYER = 1;

export function adoptBatchedParts(root) {
  root.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) o.layers.set(SOURCE_LAYER);
  });
}

export class EntityBatches {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = "EntityBatches";
    scene.add(this.group);
    this.batches = new Map();
    this.used = [];
    this.byPart = new WeakMap(); // cloned part -> its batch, so frames build no keys
    this.frustum = new THREE.Frustum();
    this.projection = new THREE.Matrix4();
    this.cull = false;
    this.shadowFrustum = null;
  }
  batchFor(mesh) {
    let batch = this.byPart.get(mesh);
    if (batch) return batch;
    const key = `${mesh.geometry.id}:${mesh.material.id}:${mesh.castShadow ? 1 : 0}`;
    batch = this.batches.get(key);
    if (!batch) {
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      const bounds = mesh.geometry.boundingSphere; // part geometry sits in model space, offset from the origin
      batch = { key, mesh: null, count: 0, capacity: 0, reach: bounds.center.length() + bounds.radius,
        dirtyStart: Infinity, dirtyEnd: 0,
        min: new THREE.Vector3(), max: new THREE.Vector3() };
      this.batches.set(key, batch);
    }
    this.byPart.set(mesh, batch);
    return batch;
  }
  grow(batch, source) {
    const capacity = Math.max(16, batch.capacity * 2);
    const next = new THREE.InstancedMesh(source.geometry, source.material, capacity);
    next.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    next.name = `batch:${source.material.name || source.geometry.type}`;
    // Culled as a group: end() fits a bounding sphere around this frame's instances, so an
    // army out of view skips both the main and the shadow pass.
    next.boundingSphere = new THREE.Sphere();
    next.castShadow = source.castShadow;
    next.receiveShadow = source.receiveShadow;
    next.renderOrder = source.renderOrder;
    if (batch.mesh) {
      next.instanceMatrix.array.set(batch.mesh.instanceMatrix.array.subarray(0, batch.count * 16));
      this.group.remove(batch.mesh);
      batch.mesh.dispose(); // instance buffers only; geometry and material belong to the templates
    }
    batch.mesh = next;
    batch.capacity = capacity;
    this.group.add(next);
  }
  add(mesh) {
    const batch = this.batchFor(mesh), e = mesh.matrixWorld.elements;
    if (batch.count === 0) {
      this.used.push(batch);
      batch.min.set(e[12], e[13], e[14]);
      batch.max.copy(batch.min);
    } else {
      batch.min.set(Math.min(batch.min.x, e[12]), Math.min(batch.min.y, e[13]), Math.min(batch.min.z, e[14]));
      batch.max.set(Math.max(batch.max.x, e[12]), Math.max(batch.max.y, e[13]), Math.max(batch.max.z, e[14]));
    }
    if (batch.count >= batch.capacity) this.grow(batch, mesh);
    const array = batch.mesh.instanceMatrix.array, offset = batch.count * 16;
    for (let i = 0; i < 16; i++) {
      // Matrix4 stores doubles, but the GPU buffer uses floats. Compare at the
      // destination precision so unchanged rotations do not look dirty forever.
      if (array[offset + i] !== Math.fround(e[i])) {
        array.set(e, offset);
        batch.dirtyStart = Math.min(batch.dirtyStart, offset);
        batch.dirtyEnd = offset + 16;
        break;
      }
    }
    batch.count++;
  }
  // Per frame, after matrixWorld is current: begin(), collect() each visible root (live
  // entities and death animations), end(). Nothing is allocated once capacities settle.
  begin(camera = null, shadowFrustum = null) {
    for (const batch of this.used) {
      batch.count = 0;
      batch.dirtyStart = Infinity;
      batch.dirtyEnd = 0;
    }
    this.used.length = 0;
    this.cull = !!camera;
    this.shadowFrustum = shadowFrustum;
    if (camera) this.frustum.setFromProjectionMatrix(
      this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      camera.coordinateSystem, camera.reversedDepth,
    );
  }
  collect(o) {
    if (!o.visible) return;
    if (o.isMesh && o.layers.mask === 1 << SOURCE_LAYER) {
      // Sharing a batch across the map must not upload every explored deposit or
      // army part just because one instance is on screen. Keep off-screen casters
      // inside the light frustum: their shadows can still enter the camera view.
      if (!this.cull || !o.frustumCulled || this.frustum.intersectsObject(o) ||
          (o.castShadow && this.shadowFrustum?.intersectsObject(o))) this.add(o);
    }
    const children = o.children;
    for (let i = 0; i < children.length; i++) this.collect(children[i]);
  }
  end() {
    for (const batch of this.batches.values()) {
      const mesh = batch.mesh;
      if (!mesh) continue;
      mesh.count = batch.count;
      mesh.visible = batch.count > 0;
      if (!batch.count) continue;
      // Parts are offset from their entity origin by at most the template's size; models
      // scale by at most 1.6 (buildings), so 2x the part's own radius is a safe margin.
      const sphere = mesh.boundingSphere;
      sphere.center.addVectors(batch.min, batch.max).multiplyScalar(0.5);
      sphere.radius = batch.min.distanceTo(batch.max) * 0.5 + batch.reach * 2 + 4;
      if (batch.dirtyEnd > batch.dirtyStart) {
        // Preserve pending ranges when a whole batch was culled by the renderer:
        // Three clears them only after the GPU has actually received the data.
        // Coalesce them here so a long-hidden batch cannot accumulate ranges.
        let start = batch.dirtyStart, end = batch.dirtyEnd;
        for (const range of mesh.instanceMatrix.updateRanges) {
          start = Math.min(start, range.start);
          end = Math.max(end, range.start + range.count);
        }
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(start, end - start);
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
  get drawCount() {
    return this.used.length;
  }
  dispose() {
    for (const batch of this.batches.values()) batch.mesh?.dispose();
    this.group.removeFromParent();
    this.batches.clear();
    this.used.length = 0;
  }
}
