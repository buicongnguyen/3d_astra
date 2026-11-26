// Faction dress (visual round V): the four dress files keep their contract (what src/faction-dress.js and
// WorldView.syncFactionDress rely on), stay inside their triangle, height and download budgets, load only for the
// factions in a match, and merge into team-paint geometry the way the base models are drawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import * as THREE from 'three';
import { DRESS_FACTIONS, DRESSED_TYPES, dressFactionsOf, modelsForMatch } from '../src/model-roster.js';
import { dressGeometry, dressPaint, partsFor, rigTag, readDress } from '../src/faction-dress.js';
import { BONE } from '../src/unit-rig.js';

const MODELS = new URL('../public/models/', import.meta.url);
const glb = (name) => {
  const data = readFileSync(new URL(`${name}.glb`, MODELS));
  const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  return { json, bin: data.subarray(28 + data.readUInt32LE(12)), bytes: data.length };
};
const manifest = JSON.parse(readFileSync(new URL('manifest.json', MODELS), 'utf8'));
const baseTriangles = Object.fromEntries(manifest.assets.map((a) => [a.name, a.triangles]));
const INFANTRY = ['worker', 'vanguard', 'ranger', 'medic', 'engineer', 'antitank'];
// The team meshes each rigid group of a base model draws (src/view.js buckets). Mirrors GROUPS in
// tools/blender/generate_dress.py: a part may only join one of these (own colours ride in Team).
const GROUPS = {
  ...Object.fromEntries(INFANTRY.map((k) => [k, { body: ['Team', 'TeamGlow'], legL: ['Team'], legR: ['Team'] }])),
  ...Object.fromEntries(['hq', 'barracks', 'foundry', 'relay'].map((k) => [k, { body: ['Team', 'TeamGlow'] }])),
  breaker: { body: ['Team'], turret: ['Team'], barrel: ['TeamGlow'] },
  tank: { body: ['Team'], turret: ['Team', 'TeamGlow'] },
  kite: { body: ['Team'] },
  tower: { body: ['Team', 'TeamGlow'], barrel: ['Team'] },
};
const triangles = (json, mesh) => mesh.primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0);

// The highest point of a GLB's meshes (glTF is Y-up), following node translations, rotations and scales.
function topOf({ json }) {
  let top = -Infinity;
  const walk = (index, parent) => {
    const node = json.nodes[index];
    const m = new THREE.Matrix4();
    if (node.matrix) m.fromArray(node.matrix);
    else m.compose(new THREE.Vector3(...(node.translation || [0, 0, 0])), new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(node.scale || [1, 1, 1])));
    const world = parent.clone().multiply(m);
    if (node.mesh !== undefined) for (const p of json.meshes[node.mesh].primitives) {
      const { min, max } = json.accessors[p.attributes.POSITION];
      for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) top = Math.max(top, new THREE.Vector3(x, y, z).applyMatrix4(world).y);
    }
    for (const child of node.children || []) walk(child, world);
  };
  for (const root of json.scenes[json.scene || 0].nodes) walk(root, new THREE.Matrix4());
  return top;
}

test('every faction but Meridian has a dress file for the fourteen shared models, in the runtime contract', () => {
  assert.deepEqual([...DRESS_FACTIONS], ['ashfall', 'sunward', 'wardens', 'veil']);
  assert.equal(DRESSED_TYPES.length, 14);
  for (const faction of DRESS_FACTIONS) {
    const { json } = glb(`dress-${faction}`);
    // Normals as int8: KHR_mesh_quantization, which three's GLTFLoader reads without a decoder.
    assert.deepEqual(json.extensionsRequired, ['KHR_mesh_quantization'], faction);
    const names = json.materials.map((m) => m.name);
    assert.ok(names.includes('Dress') && names.every((n) => ['Dress', 'Team', 'TeamGlow'].includes(n)), `${faction}: ${names}`);
    assert.ok(json.materials.every((m) => !m.doubleSided), faction);
    const roots = json.scenes[0].nodes.map((i) => json.nodes[i]);
    assert.deepEqual(roots.map((n) => n.name), DRESSED_TYPES.map((t) => `dress_${t}`), faction);
    for (const root of roots) {
      const type = root.name.slice('dress_'.length);
      for (const child of root.children) {
        const node = json.nodes[child], [kind, group, cls] = node.name.split('__');
        const material = json.materials[json.meshes[node.mesh].primitives[0].material].name;
        assert.equal(kind, type, node.name);
        assert.equal(cls, material, node.name);
        // A part only joins a team mesh its base group already draws: no new batch.
        const allowed = GROUPS[type][group];
        assert.ok(allowed, `${faction} ${node.name}: group ${group} has no team mesh in the base model`);
        assert.ok(cls === 'Dress' ? allowed.includes('Team') : allowed.includes(cls), `${faction} ${node.name}: ${cls} has no batch to join`);
        // One attribute set, as the runtime reads it.
        assert.deepEqual(Object.keys(json.meshes[node.mesh].primitives[0].attributes).sort(), ['COLOR_0', 'NORMAL', 'POSITION'], node.name);
      }
    }
  }
});

test('each dress stays within +25 % of its model, its height within a few percent, and the files within the download budget', () => {
  const entries = Object.fromEntries((manifest.dress || []).map((e) => [e.name, e]));
  for (const faction of DRESS_FACTIONS) {
    const file = glb(`dress-${faction}`), entry = entries[`dress-${faction}`];
    assert.ok(entry, `manifest entry for dress-${faction}`);
    assert.equal(entry.bytes, statSync(new URL(`dress-${faction}.glb`, MODELS)).size, `${faction}: manifest bytes`);
    // A two-faction match downloads one file: the round's target is +400 KB.
    assert.ok(entry.bytes <= 400 * 1024, `${faction}: ${entry.bytes} bytes`);
    let total = 0;
    for (const type of DRESSED_TYPES) {
      const tris = file.json.meshes.filter((m) => m.name.startsWith(`${type}__`)).reduce((n, m) => n + triangles(file.json, m), 0);
      total += tris;
      assert.equal(tris, entry.types[type], `${faction} ${type}: manifest triangles`);
      assert.ok(tris <= baseTriangles[type] * 0.25, `${faction} ${type}: ${tris} triangles on a ${baseTriangles[type]} model`);
      // Vitals bars, emblems and pick boxes keep fitting: the dressed top is at most 5 % over the model's own.
      const top = Math.max(...file.json.meshes.filter((m) => m.name.startsWith(`${type}__`)).map((m) => file.json.accessors[m.primitives[0].attributes.POSITION].max[1]));
      const base = topOf(glb(type));
      assert.ok(top <= base * 1.05 + 0.01, `${faction} ${type}: dressed top ${top.toFixed(2)} m over the model's ${base.toFixed(2)} m`);
    }
    assert.equal(total, entry.triangles, `${faction}: total triangles`);
  }
});

test('a match loads the dress of each non-Meridian faction in play, and an all-Meridian match none', () => {
  const dress = (types) => types.filter((t) => t.startsWith('dress-'));
  assert.deepEqual(dress(modelsForMatch({})), []);
  assert.deepEqual(dress(modelsForMatch({ factions: { 0: 'meridian', 1: 'meridian' } })), []);
  assert.deepEqual(dress(modelsForMatch({ factions: { 0: 'meridian', 1: 'ashfall' } })), ['dress-ashfall']);
  assert.deepEqual(dress(modelsForMatch({ factions: { 0: 'veil', 1: 'veil' } })), ['dress-veil']);
  assert.deepEqual(dress(modelsForMatch({ factions: { 0: 'meridian', 1: 'wardens', 2: 'sunward', 3: 'ashfall' } })), ['dress-ashfall', 'dress-sunward', 'dress-wardens']);
  // A story mission dresses its factions only with rosters on (as its swaps).
  assert.deepEqual(dress(modelsForMatch({ missionDef: { factions: { 1: 'veil' }, rules: {} } })), []);
  assert.deepEqual(dress(modelsForMatch({ missionDef: { factions: { 1: 'veil' }, rules: { rosters: true } } })), ['dress-veil']);
  assert.deepEqual(dressFactionsOf({ factions: { 0: 'ashfall', 1: 'nobody' } }), ['ashfall']);
});

test('the dress files parse into parts per model (three GLTFLoader), every part in a known group and class', async () => {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  for (const faction of DRESS_FACTIONS) {
    const data = readFileSync(new URL(`dress-${faction}.glb`, MODELS));
    const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.length), '', resolve, reject));
    const parts = readDress(gltf.scene, THREE);
    assert.deepEqual([...parts.keys()], [...DRESSED_TYPES], faction);
    for (const [type, list] of parts) for (const x of list) {
      assert.ok(Object.hasOwn(GROUPS[type], x.group), `${faction} ${type} ${x.group}`);
      assert.ok(['Team', 'TeamGlow', 'Dress'].includes(x.cls));
      assert.equal(x.p.length, x.count * 3);
      assert.ok(x.index.every((i) => i < x.count));
      for (let i = 0; i < x.count; i++) assert.ok(Math.abs(Math.hypot(x.n[i * 3], x.n[i * 3 + 1], x.n[i * 3 + 2]) - 1) < 0.02, 'unit normals');
    }
  }
});

test('dressed team geometry: the base kept as it is, parts appended with their own colour flag, bones and turret offset', () => {
  // A base team mesh with shader bones (an infantry body): 3 vertices, RGB colour, uv.
  const base = new THREE.BufferGeometry();
  base.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 1, 1, 0, 0, 2, 0]), 3));
  base.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  base.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6).fill(0.5), 2));
  base.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9).fill(0.6), 3));
  base.setAttribute('aRig', new THREE.BufferAttribute(new Float32Array([0, .95, .47, 0, 0, .95, .47, 0, 0, .95, .47, 0]), 4));
  base.setIndex([0, 1, 2]);
  const part = (group, cls, colour) => ({ group, cls, count: 3, index: [0, 1, 2], p: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), n: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), c: new Float32Array(9).fill(colour) });
  const info = { rig: 'infantry', hipY: 0.95, legs: { L: [0.95, 0.47, 0], R: [0.95, 0.5, 0.02] }, pivot: null, hull: null };
  const parts = [part('body', 'Team', 0.7), part('legR', 'Dress', 0.3), part('body', 'TeamGlow', 1)];
  const team = partsFor(parts, 'body', 'Team'), glow = partsFor(parts, 'body', 'TeamGlow');
  assert.deepEqual(team.map((x) => x.cls), ['Team', 'Dress']); // leg parts join the body mesh
  assert.deepEqual(glow.map((x) => x.cls), ['TeamGlow']);
  const g = dressGeometry(base, team, { THREE, BONE, info, group: 'body', cls: 'Team' });
  assert.deepEqual(Object.keys(g.attributes).sort(), Object.keys(base.attributes).sort());
  const color = g.getAttribute('color'), rig = g.getAttribute('aRig');
  assert.equal(color.itemSize, 4);
  assert.equal(g.getAttribute('position').count, 9);
  // Base vertices: as modelled, alpha 1 (team paint); team part alpha 1; own-colour part alpha 0.
  assert.deepEqual([0, 3, 6].map((i) => color.getW(i)), [1, 1, 0]);
  assert.ok(Math.abs(color.getX(0) - 0.6) < 1e-6 && Math.abs(color.getX(6) - 0.3) < 1e-6);
  // Bones: the base keeps its own; a body part bends with the body, a right-leg part with the right leg.
  assert.deepEqual([...rig.array.slice(12, 16)].map((v) => +v.toFixed(3)), [BONE.body, 0.95, 0.475, 0]);
  assert.deepEqual([...rig.array.slice(24, 28)].map((v) => +v.toFixed(3)), [BONE.legR, 0.95, 0.5, 0.02]);
  assert.deepEqual([...g.index.array], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(g.getAttribute('uv').getX(5), 0);
  // A team mesh with no part still turns RGBA (one program per team material); glow stays RGB.
  assert.equal(dressGeometry(base, [], { THREE, BONE, info, group: 'body', cls: 'Team' }).getAttribute('color').itemSize, 4);
  assert.equal(dressGeometry(base, glow, { THREE, BONE, info, group: 'body', cls: 'TeamGlow' }).getAttribute('color').itemSize, 3);
  // Turret parts sit relative to the turret ring, as the base turret parts do; a hull's body parts take the hull bone.
  const plain = base.clone();
  plain.deleteAttribute('aRig');
  const turret = dressGeometry(plain, [part('turret', 'Team', 0.5)], { THREE, BONE, info: { rig: 'hull', pivot: [0.2, -0.3], hull: [0.6, 0] }, group: 'turret', cls: 'Team' });
  assert.equal(turret.getAttribute('aRig'), undefined);
  assert.deepEqual([turret.getAttribute('position').getX(3), turret.getAttribute('position').getZ(3)].map((v) => +v.toFixed(3)), [-0.2, 0.3]);
  assert.deepEqual(rigTag({ rig: 'hull', hull: [0.6, 0.1] }, 'body', BONE), [BONE.hull, 0.6, 0, 0.1]);
  assert.equal(rigTag({ rig: 'hull', hull: [0.6, 0.1] }, 'turret', BONE), null);
  assert.equal(rigTag({ rig: null }, 'body', BONE), null);
});

test('the dress paint wraps a team material once: RGB geometry draws as before, RGBA alpha 0 is the vertex colour alone', () => {
  const m = new THREE.MeshStandardMaterial({ name: 'Team', vertexColors: true });
  const calls = [];
  m.onBeforeCompile = () => calls.push('rim');
  m.customProgramCacheKey = () => 'team-rim|grade|rig';
  assert.equal(dressPaint(m), true);
  assert.equal(dressPaint(m), false); // once
  assert.equal(m.customProgramCacheKey(), 'team-rim|grade|rig|dress'); // the rig suffix survives
  const shader = { fragmentShader: 'void main() {\n#include <color_fragment>\n}', vertexShader: '' };
  m.onBeforeCompile(shader, null);
  assert.deepEqual(calls, ['rim']);
  assert.ok(!shader.fragmentShader.includes('#include <color_fragment>'));
  assert.match(shader.fragmentShader, /vColor\.a < 0\.5 \? vec3\( 1\.0 \) : diffuseColor\.rgb \) \* vColor\.rgb/);
  // three r185's own chunk multiplies by vColor (alpha 1 for RGB geometry): the patch equals it there.
  assert.match(THREE.ShaderChunk.color_fragment, /diffuseColor \*= vColor;/);
});
