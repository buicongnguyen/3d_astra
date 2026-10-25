// Opt-in cache for our position/quaternion/scale-driven scene nodes. Three's normal
// scene traversal still handles parents, reparenting, forced updates and picking.
// Repeating the same pose must not recompose its matrix and dirty every descendant.
// Keep this per object; do not change Three's prototypes or apply it to templates.
const poses = new WeakMap();

function updateCachedWorldMatrix(force) {
  const pose = poses.get(this), v = pose.values;
  if (pose.parent !== this.parent) {
    pose.parent = this.parent;
    this.matrixWorldNeedsUpdate = true;
  }
  // Manual matrix owners and pivot transforms use Three's normal path. Leave
  // updateMatrix/updateWorldMatrix untouched for direct callers (e.g. picking).
  if (!this.matrixAutoUpdate || this.pivot !== null) {
    pose.valid = false;
    return pose.update.call(this, force);
  }
  const p = this.position, q = this.quaternion, s = this.scale;
  if (pose.valid && v[0] === p.x && v[1] === p.y && v[2] === p.z &&
      v[3] === q.x && v[4] === q.y && v[5] === q.z && v[6] === q.w &&
      v[7] === s.x && v[8] === s.y && v[9] === s.z) {
    this.matrixAutoUpdate = false;
    try { return pose.update.call(this, force); }
    finally { this.matrixAutoUpdate = true; }
  }
  v[0] = p.x; v[1] = p.y; v[2] = p.z;
  v[3] = q.x; v[4] = q.y; v[5] = q.z; v[6] = q.w;
  v[7] = s.x; v[8] = s.y; v[9] = s.z;
  pose.valid = true;
  pose.update.call(this, force);
}

export function cacheTransforms(root) {
  root.traverse(object => {
    if (poses.has(object)) return;
    poses.set(object, {values: new Float64Array(10), valid: false, parent: undefined, update: object.updateMatrixWorld});
    object.updateMatrixWorld = updateCachedWorldMatrix;
  });
}
