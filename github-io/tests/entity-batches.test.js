import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EntityBatches, adoptBatchedParts } from '../src/entity-batches.js';

function setup() {
  const scene = new THREE.Scene(), batches = new EntityBatches(scene);
  const geometry = new THREE.BoxGeometry(2,2,2), material = new THREE.MeshBasicMaterial();
  const camera = new THREE.OrthographicCamera(-5,5,5,-5,.1,100);
  camera.position.z = 10; camera.updateMatrixWorld();
  const source = x => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.x = x; mesh.castShadow = true;
    adoptBatchedParts(mesh); scene.add(mesh); mesh.updateMatrixWorld(); return mesh;
  };
  const count = () => [...batches.batches.values()].reduce((n,b) => n + b.mesh.count, 0);
  return {scene,batches,camera,source,count,geometry,material};
}

test('batch culling retains off-screen shadow casters, then removes them when shadows are disabled', () => {
  const f = setup(), near = f.source(0), caster = f.source(20), far = f.source(80);
  const shadowCamera = f.camera.clone(); shadowCamera.position.x = 20; shadowCamera.updateMatrixWorld();
  const shadowFrustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse));
  f.batches.begin(f.camera, shadowFrustum);
  for (const m of [near,caster,far]) f.batches.collect(m);
  f.batches.end(); assert.equal(f.count(), 2);
  f.batches.begin(f.camera);
  for (const m of [near,caster,far]) f.batches.collect(m);
  f.batches.end(); assert.equal(f.count(), 1);
  f.camera.position.x = 80; f.camera.updateMatrixWorld();
  f.batches.begin(f.camera); f.batches.collect(far); f.batches.end();
  assert.equal(f.count(), 1, 'camera movement admits newly visible instances');
  assert.equal([...f.batches.batches.values()][0].mesh.instanceMatrix.array[12], 80);
});

test('hidden parents remove their instances; clipped mesh parents do not hide visible children', () => {
  const f = setup(), parent = f.source(80), child = f.source(-80);
  parent.add(child); parent.updateMatrixWorld(true);
  f.batches.begin(f.camera); f.batches.collect(parent); f.batches.end();
  assert.equal(f.count(), 1);
  parent.visible = false;
  f.batches.begin(f.camera); f.batches.collect(parent); f.batches.end();
  assert.equal(f.count(), 0, 'fog/depletion cannot leave a stale instance');
  assert.equal([...f.batches.batches.values()][0].mesh.visible, false);
});

test('instance transforms preserve deposit shrinkage and disposal retains shared assets', () => {
  const f = setup(), deposit = f.source(0);
  deposit.scale.y = .7; deposit.updateMatrixWorld();
  f.batches.begin(f.camera); f.batches.collect(deposit); f.batches.end();
  const batch = [...f.batches.batches.values()][0];
  assert.ok(Math.abs(batch.mesh.instanceMatrix.array[5] - .7) < 1e-6);
  let geometryDisposed = false, materialDisposed = false, instanceDisposed = false;
  f.geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  f.material.addEventListener('dispose', () => { materialDisposed = true; });
  batch.mesh.addEventListener('dispose', () => { instanceDisposed = true; });
  f.batches.dispose();
  assert.equal(instanceDisposed, true); assert.equal(geometryDisposed, false); assert.equal(materialDisposed, false);
});

test('unchanged instances skip uploads; movement, count changes and growth keep GPU poses current', () => {
  const f = setup(), sources = Array.from({length:20}, (_,i) => f.source(i));
  const draw = items => {
    f.scene.updateMatrixWorld(); f.batches.begin();
    for (const m of items) f.batches.collect(m);
    f.batches.end();
    return [...f.batches.batches.values()][0].mesh;
  };
  sources[0].rotation.y = .317; // values that cannot be represented exactly as float32
  let mesh = draw(sources.slice(0, 3));
  mesh.instanceMatrix.clearUpdateRanges(); // emulate a completed GPU upload
  const version = mesh.instanceMatrix.version;
  draw(sources.slice(0, 3));
  assert.equal(mesh.instanceMatrix.version, version);
  assert.deepEqual(mesh.instanceMatrix.updateRanges, []);
  sources[1].position.x = 9.25; draw(sources.slice(0, 3));
  assert.deepEqual(mesh.instanceMatrix.updateRanges, [{start:16, count:16}]);
  assert.equal(mesh.instanceMatrix.array[28], 9.25);
  mesh.instanceMatrix.clearUpdateRanges();
  draw([sources[0],sources[2]]); // removed middle slot must move its replacement
  assert.equal(mesh.count, 2); assert.equal(mesh.instanceMatrix.array[28], 2);
  mesh = draw(sources); // replaces the GPU buffer, preserving earlier slots
  assert.equal(mesh.count, 20);
  for (let i=0;i<20;i++) assert.equal(mesh.instanceMatrix.array[i*16+12], sources[i].position.x);
  draw([]); assert.equal(mesh.visible, false);
  draw(sources); assert.equal(mesh.visible, true); assert.equal(mesh.count, 20);
});

test('unsubmitted updates survive hidden frames without accumulating range entries', () => {
  const f = setup(), a = f.source(0), b = f.source(1);
  const draw = () => { f.scene.updateMatrixWorld(); f.batches.begin(); f.batches.collect(a); f.batches.collect(b); f.batches.end(); };
  draw();
  const attribute = [...f.batches.batches.values()][0].mesh.instanceMatrix;
  attribute.clearUpdateRanges();
  a.position.x = 2; draw();
  // No renderer acknowledgement: updates must remain pending even when only the
  // second slot changes later. Otherwise the GPU would keep the first stale pose.
  for (let i=0;i<100;i++) { b.position.x += .25; draw(); }
  assert.deepEqual(attribute.updateRanges, [{start:0,count:32}]);
  const version = attribute.version;
  draw(); assert.equal(attribute.version, version);
  assert.deepEqual(attribute.updateRanges, [{start:0,count:32}]);
});
