import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cacheTransforms } from '../src/transform-cache.js';

function hierarchy() {
  const scene = new THREE.Scene(), root = new THREE.Group(), model = new THREE.Group();
  const part = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  part.position.set(.3, 1.25, -.4);
  model.add(part); root.add(model); scene.add(root);
  return {scene, root, model, part};
}

test('cached poses match normal world transforms through motion, recoil, construction, death and reparenting', () => {
  const a = hierarchy(), b = hierarchy();
  cacheTransforms(a.scene);
  const actions = [
    f => {},
    f => { f.root.position.set(13.7, 0, -8.3); f.model.rotation.y = .57; },
    f => { f.model.scale.y = .15; },
    f => { f.part.rotation.y = -.9; f.part.position.z = -.18; },
    f => { f.model.rotation.order = 'YXZ'; f.model.rotation.z = .18; f.root.position.y = -.6; },
    f => { f.part.visible = false; f.root.position.x += 3; },
    f => { f.part.visible = true; f.scene.add(f.part); },
    f => { f.root.add(f.part); f.root.scale.set(1.6, .7, 1.6); },
    // Cache must keep double precision when checking CPU transforms.
    f => { f.root.position.x += 1e-10; },
  ];
  for (const action of actions) {
    action(a); action(b);
    for (let frame = 0; frame < 2; frame++) {
      a.scene.updateMatrixWorld(); b.scene.updateMatrixWorld();
      for (const name of ['scene','root','model','part'])
        assert.deepEqual(a[name].matrixWorld.elements, b[name].matrixWorld.elements, name);
    }
  }
  a.scene.updateMatrixWorld(true); b.scene.updateMatrixWorld(true);
  assert.deepEqual(a.part.matrixWorld.elements, b.part.matrixWorld.elements);
});

test('idle cached trees skip composition and propagation, while manual matrices and direct picking updates still work', () => {
  const f = hierarchy();
  let compositions = 0, products = 0;
  f.scene.traverse(o => {
    const compose = o.matrix.compose, multiply = o.matrixWorld.multiplyMatrices;
    o.matrix.compose = function (...args) { compositions++; return compose.apply(this, args); };
    o.matrixWorld.multiplyMatrices = function (...args) { products++; return multiply.apply(this, args); };
  });
  cacheTransforms(f.scene); cacheTransforms(f.scene);
  f.scene.updateMatrixWorld(); compositions = products = 0;
  f.scene.updateMatrixWorld();
  assert.equal(compositions, 0); assert.equal(products, 0);
  f.root.position.x = 12;
  f.part.updateWorldMatrix(true, false);
  assert.equal(f.part.matrixWorld.elements[12], 12.3);
  f.part.matrixAutoUpdate = false;
  f.part.matrix.makeTranslation(1,2,3); f.part.matrixWorldNeedsUpdate = true;
  f.scene.updateMatrixWorld();
  assert.equal(f.part.matrixWorld.elements[12], 13);
  f.part.matrixAutoUpdate = true;
  f.part.position.x = 2;
  f.scene.updateMatrixWorld();
  assert.equal(f.part.matrixWorld.elements[12], 14);
});
