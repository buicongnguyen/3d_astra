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
const types = Object.keys(balance.definitions).filter(t => balance.definitions[t].role !== 'Research');

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
    if (['tank', 'breaker'].includes(type)) {
      const pivot = json.nodes.find(n => /^Turret_pivot/.test(n.name || ''));
      assert.ok(pivot?.translation, `${type}: Turret_pivot empty marks the turret ring`);
      assert.ok(names.some(n => /^Turret_head/.test(n)), `${type}: turret head is its own part so it can aim`);
      assert.ok(names.some(n => /^(Main_cannon|Cannon)/.test(n)), `${type}: barrel stays a separate recoil part`);
    }
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

test('approved faction models satisfy export, topology and silhouette-rig budgets',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/models/manifest.json',import.meta.url),'utf8'));
  const candidates=manifest.assets.filter(a=>a.faction);
  assert.equal(candidates.length,12);
  for(const asset of candidates){
    const json=gltf(asset.name),names=runtimeNames(json);
    const triangles=json.meshes.reduce((n,m)=>n+m.primitives.reduce((k,p)=>k+(p.indices===undefined?json.accessors[p.attributes.POSITION].count:json.accessors[p.indices].count)/3,0),0);
    assert.equal(triangles,asset.triangles,asset.name);
    assert.ok(triangles<=asset.budget,`${asset.name}: ${triangles}/${asset.budget}`);
    const sets=new Set(json.meshes.flatMap(m=>m.primitives.map(p=>Object.keys(p.attributes).sort().join())));
    assert.equal(sets.size,1,asset.name);
    for(const attribute of ['POSITION','NORMAL','TEXCOORD_0','COLOR_0'])assert.ok([...sets][0].includes(attribute),`${asset.name}: ${attribute}`);
    assert.ok(json.materials.some(m=>m.name.startsWith('Team')));
    assert.ok(json.materials.every(m=>!m.doubleSided));
    if(['scrapper','rider','shade','watcher'].includes(asset.name)){
      assert.ok(names.some(n=>/^leg_L/.test(n))&&names.some(n=>/^leg_R/.test(n)),asset.name);
    }
    if(['scrapper','shade','watcher'].includes(asset.name))assert.ok(triangles>=2800);
    if(asset.name==='drone')assert.ok(names.includes('hover'));
    if(['scorcher','walker'].includes(asset.name))assert.ok(names.some(n=>RIG_PART.test(n)),asset.name);
    assert.ok(!JSON.stringify(json).includes('KHR_mesh_quantization'));
  }
});


test('portrait generation preserves legacy cells and appends every approved faction model', () => {
  const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
  const order = JSON.parse(read('src/portraits.js').match(/PORTRAIT_ORDER = (\[[\s\S]*?\]);/)[1]);
  assert.deepEqual(order.slice(0, 13), ['worker','vanguard','ranger','breaker','medic','engineer','tank','antitank','hq','relay','barracks','foundry','tower']);
  const blender = JSON.parse(read('tools/blender/render_ui_art.py').match(/PORTRAITS = (\[[\s\S]*?\])/)[1].replaceAll("'", '"'));
  assert.deepEqual(blender, order);
  const manifest = JSON.parse(read('public/models/manifest.json')).assets, assets = manifest.filter(a => a.faction);
  assert.equal(new Set(order).size, 29);
  assert.deepEqual(new Set(order.slice(13, 25)), new Set(assets.map(a => a.name)));
  for (const asset of assets) assert.equal(asset.review, 'approved by owner 2026-11-11');
  // 0.18: the four flyers are appended after the faction cells (manifest entries marked air, no faction).
  assert.deepEqual(order.slice(25), ['kite', 'hawk', 'balloon', 'glider']);
  assert.deepEqual(manifest.filter(a => a.air).map(a => a.name), order.slice(25));
});

test('flyer models keep the air contract: hover bob, spin or flicker pivots, a triangle budget', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/models/manifest.json', import.meta.url), 'utf8')).assets;
  const pivots = { kite: ['spin_rotor_L', 'spin_rotor_R'], hawk: ['spin_fan_L', 'spin_fan_R'], balloon: ['flicker_flame'], glider: ['spin_prop'] };
  for (const [type, names] of Object.entries(pivots)) {
    const json = gltf(type), nodes = runtimeNames(json), asset = manifest.find(a => a.name === type);
    assert.ok(balance.definitions[type].flying, type);
    assert.ok(nodes.includes('hover'), `${type}: hover`);
    for (const name of names) assert.ok(nodes.includes(name), `${type}: ${name}`);
    const triangles = json.meshes.reduce((n, m) => n + m.primitives.reduce((k, p) => k + (p.indices === undefined ? json.accessors[p.attributes.POSITION].count : json.accessors[p.indices].count) / 3, 0), 0);
    assert.equal(triangles, asset.triangles, type);
    assert.ok(triangles <= asset.budget, type);
  }
});
