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
  // R3-F (round 3) reworked the approved faction models; they wait for the owner again.
  for (const asset of assets) assert.ok(['approved by owner 2026-11-11', 'pending owner review (round 3)'].includes(asset.review), asset.name);
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

// R3-F (AAA round 3, warm kit): glTF material helpers. Blender re-imports add ".002"-style suffixes.
const materialsOf = name => gltf(name).materials.map(m => ({ name: m.name.replace(/\.\d+$/, ''), m }));
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b; // baseColorFactor is linear

test('R3-F warm kit: armour paints are light, warm and glossy; dark is kept for tracks and joints', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/models/manifest.json', import.meta.url), 'utf8')).assets;
  // Every kit model except the Drone (R3-J) and the ported bosses.
  const kitModels = manifest.filter(a => !a.boss && a.name !== 'drone').map(a => a.name);
  assert.ok(kitModels.length >= 33, kitModels.length);
  for (const name of kitModels) {
    for (const { name: mat, m } of materialsOf(name)) {
      const pbr = m.pbrMetallicRoughness || {}, color = pbr.baseColorFactor || [1, 1, 1, 1];
      if (/^Armor/.test(mat)) {
        // The round-2 gunmetal was linear luminance 0.11; the shared sand is 0.56, the darkest faction paints (Ashfall
        // rust, Veil mauve) about 0.19.
        assert.ok(lum(color) >= 0.17, `${name}: ${mat} too dark (${lum(color).toFixed(3)})`);
        assert.ok(color[0] >= color[2], `${name}: ${mat} should be warm (red >= blue)`);
        // Same bake class as before (src/view.js reflects()): no model gains a draw.
        assert.ok((pbr.metallicFactor ?? 1) >= 0.5 || (pbr.roughnessFactor ?? 1) <= 0.25, `${name}: ${mat} bake class`);
      }
      if (mat === 'Undercarriage') assert.ok(lum(color) >= 0.04 && lum(color) < 0.15, `${name}: Undercarriage stays dark but not black`);
    }
  }
  // The four look-alike shared infantry now carry a role paint each (24 px thumbnail test in docs/aaa/results/round3/f.md).
  const roles = { medic: ['ArmorMedic', 'Cross'], worker: ['ArmorWorker', 'Hazard'], engineer: ['Safety'], ranger: ['Cape'] };
  for (const [type, need] of Object.entries(roles)) {
    const names = materialsOf(type).map(x => x.name);
    for (const mat of need) assert.ok(names.includes(mat), `${type}: ${mat}`);
  }
  assert.ok(!materialsOf('engineer').some(x => x.name === 'Hazard'), 'engineer no longer shares the worker yellow');
});

test('R3-F faction paints, Window* glow contract on buildings, and no model gains a material', () => {
  const paint = { ashfall: 'ArmorAshfall', sunward: 'ArmorSunward', wardens: 'ArmorWardens', veil: 'ArmorVeil' };
  const manifest = JSON.parse(readFileSync(new URL('../public/models/manifest.json', import.meta.url), 'utf8')).assets;
  for (const asset of manifest.filter(a => a.faction && a.name !== 'drone'))
    assert.ok(materialsOf(asset.name).some(x => x.name === paint[asset.faction]), `${asset.name}: ${paint[asset.faction]}`);
  // Name contract with R3-D: lit windows are materials named Window*, emissive.
  for (const name of ['hq', 'barracks', 'foundry', 'veilrelay']) {
    const win = materialsOf(name).find(x => x.name.startsWith('Window'));
    assert.ok(win && Math.max(...(win.m.emissiveFactor || [0])) > 0, `${name}: emissive Window* material`);
  }
  // Material counts after R3-F (round 2 in brackets where it changed). The wagon took the cream canvas and
  // the red cross (4 -> 6), still fewer than the medic it replaces (8).
  const limit = { worker: 8, vanguard: 6, ranger: 7, medic: 8, engineer: 9, antitank: 8, breaker: 7, tank: 7, hq: 9, barracks: 9, foundry: 10, relay: 8, tower: 8,
    scrapper: 7, scorcher: 5, salvageyard: 7, rider: 5, wagon: 6, waystation: 6, walker: 5, pylon: 5, shade: 7, watcher: 7, veilrelay: 6,
    gunner: 7, stalker: 7, workshop: 5, rampart: 7, carrier: 5, kite: 7, hawk: 6, balloon: 8, glider: 9 };
  for (const [name, n] of Object.entries(limit)) assert.ok(gltf(name).materials.length <= n, `${name}: ${gltf(name).materials.length} materials > ${n}`);
  for (const asset of manifest.filter(a => a.name in limit)) assert.equal(asset.review, 'pending owner review (round 3)', asset.name);
});
