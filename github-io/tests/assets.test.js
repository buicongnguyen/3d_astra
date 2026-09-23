import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PropertyBinding} from 'three';
import {RIG_PART} from '../src/view.js';
import balance from '../src/balance.json' with {type:'json'};

const gltf = name => {
  const data = readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
  return JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
};
// GLTFLoader strips reserved characters from node names ("Barrel.001" -> "Barrel001").
const runtimeNames = json => json.nodes.map(n => PropertyBinding.sanitizeNodeName(n.name || ''));
const types = Object.keys(balance.definitions).filter(t => t !== 'upgrade');

test('aim/recoil rig matches Blender duplicate names after GLTFLoader sanitising', () => {
  for (const name of ['Barrel', 'Barrel.001', 'Cannon_L', 'Muzzle.002', 'Muzzle_glow', 'Main_cannon', 'Muzzle_brake', 'Turret_head.003'])
    assert.ok(RIG_PART.test(PropertyBinding.sanitizeNodeName(name)), name);
  for (const name of ['turret', 'Turret_ring', 'Launcher_muzzle', 'Cannonball_crate', 'Barrels'])
    assert.equal(RIG_PART.test(PropertyBinding.sanitizeNodeName(name)), false, name);
});

test('every model keeps the runtime contract: mergeable meshes, team materials, rigs and legs', () => {
  for (const type of types) {
    const json = gltf(type), names = runtimeNames(json);
    // mergeGeometries returns null for mismatched attribute sets, silently dropping parts.
    const sets = new Set(json.meshes.flatMap(m => m.primitives.map(p => Object.keys(p.attributes).sort().join())));
    assert.equal(sets.size, 1, `${type}: one attribute set, got ${[...sets].join(' | ')}`);
    assert.ok([...sets][0].includes('COLOR_0'), `${type}: baked lighting in COLOR_0`);
    assert.ok(json.materials.some(m => m.name.startsWith('Team') && !m.name.startsWith('TeamGlow')), `${type}: team paint`);
    assert.ok(json.materials.every(m => !m.doubleSided), `${type}: single-sided materials`);
    const def = balance.definitions[type];
    if (def.kind === 'unit' && !def.mechanical) {
      assert.ok(names.some(n => /^leg_L/.test(n)) && names.some(n => /^leg_R/.test(n)), `${type}: leg pivots`);
    }
    if (['tank', 'breaker', 'tower'].includes(type))
      assert.ok(names.filter(n => RIG_PART.test(n)).length >= 2, `${type}: barrel rig`);
    if (type === 'tower') assert.ok(names.some(n => /^Turret_head/.test(n)), 'tower head rotates with its barrels');
  }
});

test('scenery provides the assets the views look up by name, with mergeable meshes', () => {
  const json = gltf('environment'), names = new Set(json.nodes.map(n => n.name));
  for (const name of ['tree', 'bush', 'reed', 'crate', 'bridge', 'rock_a', 'rock_b', 'rock_c', 'crystal_alloy', 'crystal_energy'])
    assert.ok(names.has(`asset_${name}`), name);
  const sets = new Set(json.meshes.flatMap(m => m.primitives.map(p => Object.keys(p.attributes).sort().join())));
  assert.equal(sets.size, 1);
});
