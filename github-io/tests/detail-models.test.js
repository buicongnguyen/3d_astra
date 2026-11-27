// Close-up detail models (H3b, tools/blender/generate_detail.py, src/close-view.js): each one must swap cleanly for
// its normal model, so the runtime contract is checked against the normal GLB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PropertyBinding } from 'three';
import { LEVEL_RADIUS, CLOSE_RADIUS, EXIT } from '../src/close-view.js';

const read = (path) => {
  const data = readFileSync(new URL(`../public/models/${path}`, import.meta.url));
  return JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
};
const manifest = JSON.parse(readFileSync(new URL('../public/models/detail/manifest.json', import.meta.url), 'utf8'));
const names = (json) => json.nodes.map((n) => PropertyBinding.sanitizeNodeName(n.name || ''));
// Empties the runtime moves or looks up by name (view.js MOVING_PART, Turret_pivot, hover, the Vanguard's sword arm).
const PIVOT = /^(leg_|spin_|flicker_|Turret_pivot|hover$|SwordArm$|SwordElbow$)/;
// Material classes that keep their own draw (view.js KEEP_FINISH, glows): a detail model may add none of them.
const OWN_DRAW = /^(Team|Glass|Lamp|Energy|Alloy|Flame)/;

// Every unit type with its own model has a detail model (batch 1: ranger, vanguard, antitank, tank, worker, kite;
// batch 2: the rest). Bosses may go to 12k triangles, everything else 9k.
const D = JSON.parse(readFileSync(new URL('../src/balance.json', import.meta.url), 'utf8')).definitions;
const models = new Set(readdirSync(new URL('../public/models/', import.meta.url)).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)));
const UNIT_TYPES = Object.keys(D).filter((k) => D[k].kind === 'unit' && models.has(k)).sort();
const budget = (name) => (D[name]?.boss ? 12000 : 9000);

test('the detail manifest lists every unit model, one file each, within the triangle budget', () => {
  const listed = manifest.assets.map((a) => a.name).sort();
  assert.deepEqual(listed, UNIT_TYPES);
  const files = readdirSync(new URL('../public/models/detail/', import.meta.url)).filter((f) => f.endsWith('.glb')).sort();
  assert.deepEqual(files, manifest.assets.map((a) => a.file).sort(), 'every file listed, nothing extra');
  for (const a of manifest.assets) {
    assert.ok(a.triangles >= a.base_triangles * 1.3, `${a.name}: adds detail (${a.base_triangles} -> ${a.triangles})`);
    assert.ok(a.triangles <= budget(a.name), `${a.name}: ${a.triangles} triangles > ${budget(a.name)}`);
    const glb = read(`detail/${a.file}`), tris = glb.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + glb.accessors[p.indices].count / 3, 0);
    assert.equal(tris, a.triangles, `${a.name}: the manifest counts the file's triangles`);
  }
});

test('every detail model keeps its normal model\'s pivots, team slots and draw classes', () => {
  for (const { name, file } of manifest.assets) {
    const normal = read(`${name}.glb`), detail = read(`detail/${file}`);
    // Blender numbers repeated names (leg_L005); the runtime reads the prefix and the side only.
    const pivots = (json) => names(json).filter((n) => PIVOT.test(n)).map((n) => n.replace(/\d+$/, '')).sort();
    assert.deepEqual(pivots(detail), pivots(normal), `${name}: same pivots`);
    const sets = new Set(detail.meshes.flatMap((m) => m.primitives.map((p) => Object.keys(p.attributes).sort().join())));
    assert.deepEqual([...sets], [...new Set(normal.meshes.flatMap((m) => m.primitives.map((p) => Object.keys(p.attributes).sort().join())))], `${name}: same vertex layout`);
    const own = (json) => new Set(json.materials.map((m) => m.name.replace(/\.\d+$/, '')).filter((n) => OWN_DRAW.test(n)));
    assert.deepEqual([...own(detail)].sort(), [...own(normal)].sort(), `${name}: no new team, glow or glass material`);
    assert.ok(detail.materials.every((m) => !m.doubleSided), `${name}: single-sided materials`);
    // A glowing material keeps its own draw too (view.js bakeFinishes skips emissive finishes): only the normal model's.
    const lit = (json) => new Set(json.materials.filter((m) => (m.emissiveFactor || []).some((c) => c > 0)).map((m) => m.name.replace(/\.\d+$/, '')));
    const normalLit = lit(normal);
    for (const m of lit(detail)) assert.ok(normalLit.has(m), `${name}: no new glowing material (${m})`);
    // Every group node (pivots, boss part nodes, wing and jaw hinges) is kept under its name (MotionRoot carries the
    // Godot edition's baked clips, tools/blender/animate_units.py; the web runtime never reads it).
    const meshNodes = (json) => new Set(json.nodes.filter((n) => n.mesh !== undefined).map((n) => n.name));
    const groups = (json) => { const m = meshNodes(json); return [...new Set(names(json).filter((n, i) => !m.has(json.nodes[i].name) && n !== 'MotionRoot').map((n) => n.replace(/\d+$/, '')))].sort(); };
    assert.deepEqual(groups(detail), groups(normal), `${name}: same group nodes`);
    // Moving parts keep their names: turret and barrel parts, rotors.
    const base = (json) => new Set(names(json).map((n) => n.replace(/\d+$/, '')));
    const detailNames = base(detail);
    for (const part of base(normal)) if (/^(Turret_head|Main_cannon|Muzzle_brake|Rotor_|Sword_)/.test(part))
      assert.ok(detailNames.has(part), `${name}: keeps ${part}`);
  }
});

test('close view radius: 25 m in, 15% more out, smaller on the governor\'s low levels', () => {
  assert.equal(CLOSE_RADIUS, 25);
  assert.ok(EXIT > 1 && EXIT < 1.3);
  assert.equal(LEVEL_RADIUS.full, 1);
  assert.ok(LEVEL_RADIUS.rescue < LEVEL_RADIUS.still && LEVEL_RADIUS.still < LEVEL_RADIUS.calm + 1e-9);
});
