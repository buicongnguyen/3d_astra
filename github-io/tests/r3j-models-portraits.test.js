// AAA round 3, R3-J (models and portraits, art 2): every unit and building type has a portrait cell,
// the rebuilt Drone and Iron Sovereign keep their contracts in the warm palette, and every building
// carries a lit window or lamp for the night glow (R3-D's Window*/Lamp* name contract).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RIG_PART } from '../src/view.js';
import balance from '../src/balance.json' with { type: 'json' };

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url));
const gltf = (name) => { const data = read(`public/models/${name}.glb`); return JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString()); };
const manifest = JSON.parse(read('public/models/manifest.json')).assets;
const order = JSON.parse(read('src/portraits.js').toString().match(/PORTRAIT_ORDER = (\[[\s\S]*?\]);/)[1]);
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b; // linear baseColorFactor
const triangles = (json) => json.meshes.reduce((n, m) => n + m.primitives.reduce((k, p) => k + (p.indices === undefined ? json.accessors[p.attributes.POSITION].count : json.accessors[p.indices].count) / 3, 0), 0);
// Width and height of a WebP (lossy VP8, lossless VP8L or extended VP8X).
function webpSize(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF'); assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
  if (chunk === 'VP8L') { const b = buffer.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
}

test('R3-J: every unit and building type has a portrait cell, and the atlas, renderer and CSS agree', () => {
  const types = Object.entries(balance.definitions).filter(([, d]) => d.kind === 'unit' || d.kind === 'building').map(([t]) => t);
  assert.ok(types.length >= 36, types.length);
  for (const type of types) assert.ok(order.includes(type), `${type} has no portrait cell`);
  // Reserved for R3-H's second Sovereign (same model, so the same render); the creature round appends the Acid Hound and Vault Sentinel after it,
  // and W9 the Ember Drake.
  assert.deepEqual(order.slice(-4), ['ironsovereign2', 'acidhound', 'vaultsentinel', 'emberdrake']);
  assert.equal(new Set(order).size, order.length);
  // Every other cell is rendered from its own committed model.
  for (const type of order.filter((t) => t !== 'ironsovereign2')) assert.ok(manifest.some((a) => a.name === type), `${type}: no model`);
  const blender = read('tools/blender/render_ui_art.py').toString();
  assert.deepEqual(JSON.parse(blender.match(/PORTRAITS = (\[[\s\S]*?\])/)[1].replaceAll("'", '"')), order);
  assert.match(blender, /SAME_MODEL = \{'ironsovereign2': 'ironsovereign'\}/);
  const rows = Math.ceil(order.length / 4);
  for (const file of ['src/art/portraits.webp', 'src/art/portrait-mask.webp']) assert.deepEqual(webpSize(read(file)), [768, 192 * rows], file);
  const css = read('src/portraits.css').toString();
  assert.equal(css.match(new RegExp(`400% ${rows * 100}%`, 'g'))?.length, 3, 'background and mask sizes');
  assert.equal(css.match(new RegExp(`100% / ${rows - 1}\\)`, 'g'))?.length, 3, 'row positions');
});

test('R3-J: the Drone wears the Wardens paint and keeps its hover, rig, budget and four materials', () => {
  const json = gltf('drone'), entry = manifest.find((a) => a.name === 'drone');
  const names = json.materials.map((m) => m.name.replace(/\.\d+$/, ''));
  assert.deepEqual([...names].sort(), ['ArmorWardens', 'Steel', 'Team', 'TeamGlow']); // as many as before: no new draw
  const nodes = json.nodes.map((n) => n.name);
  assert.ok(nodes.includes('hover'));
  assert.ok(nodes.some((n) => RIG_PART.test(n)), 'twin emitters stay on the aim/recoil rig');
  for (const part of ['Crest', 'Brow_band', 'Tower_shields', 'Shield_stripes']) assert.ok(nodes.some((n) => n.startsWith(part)), part);
  assert.equal(triangles(json), entry.triangles);
  assert.ok(entry.triangles <= entry.budget && entry.budget === 4500);
  assert.equal(entry.review, 'pending owner review (visual round V)'); // rebuilt in visual round V (2026-11-26)
  // The shell is no longer team paint: the team colour sits on the crest, band, stripes and fins.
  const shell = json.meshes[json.nodes.find((n) => n.name.startsWith('Smooth_shell')).mesh].primitives[0];
  assert.equal(json.materials[shell.material].name.replace(/\.\d+$/, ''), 'ArmorWardens');
});

test('R3-J: the Iron Sovereign is ported in the warm sovereign3 palette with the same parts, budget and bake classes', () => {
  const json = gltf('ironsovereign'), entry = manifest.find((a) => a.name === 'ironsovereign');
  const parts = JSON.parse(read('tools/boss-parts/ironsovereign.json'));
  assert.equal(parts.palette, 'sovereign3');
  const m = Object.fromEntries(json.materials.map((x) => [x.name, x]));
  assert.deepEqual(Object.keys(m).sort(), ['Armor', 'BossCore', 'Crimson', 'Steel', 'Team', 'Undercarriage']);
  const pbr = (name) => m[name].pbrMetallicRoughness;
  // Brass hull: bright and warm (the round-2 oxblood was linear luminance 0.10).
  assert.ok(lum(pbr('Armor').baseColorFactor) >= 0.3, 'hull luminance');
  assert.ok(pbr('Armor').baseColorFactor[0] > pbr('Armor').baseColorFactor[2] * 3, 'hull is warm');
  // Dark kept for feet and bores, but warm umber, not black (the kit's Undercarriage).
  const under = pbr('Undercarriage').baseColorFactor;
  assert.ok(lum(under) >= 0.04 && lum(under) < 0.15 && under[0] > under[2]);
  // Same reflect class per material as the round-2 port (src/view.js reflects()): the baked groups are unchanged.
  const reflects = (x) => x.metallicFactor >= 0.5 || x.roughnessFactor <= 0.25;
  const before = { Armor: false, Undercarriage: false, Team: false, Crimson: true, Steel: true, BossCore: false };
  for (const [name, r] of Object.entries(before)) assert.equal(reflects(pbr(name)), r, name);
  assert.ok(Math.max(...m.BossCore.emissiveFactor) > 0.5, 'core glows');
  // The runtime parts (src/boss-view.js BOSS_PARTS) are still there.
  const nodes = json.nodes.map((n) => n.name);
  for (const name of ['ironsovereign', 'LegsA', 'LegsB']) assert.ok(nodes.includes(name), name);
  assert.equal(triangles(json), entry.triangles);
  assert.ok(entry.triangles <= entry.budget);
  assert.equal(entry.review, 'pending owner review (round 3)');
});

test('R3-J: every building model carries a lit Window* (or the older Lamp*) for the night glow', () => {
  const buildings = Object.entries(balance.definitions).filter(([, d]) => d.kind === 'building').map(([t]) => t);
  for (const type of buildings) {
    const mats = gltf(type).materials, glow = (x) => Math.max(...(x.emissiveFactor || [0])) > 0;
    assert.ok(mats.some((x) => /^(Window|Lamp)/.test(x.name) && glow(x)), `${type}: lit Window* or Lamp*`);
  }
  // The four that had neither now have Window panes (relay and tower keep their floodlight Lamps).
  for (const type of ['pylon', 'salvageyard', 'waystation', 'workshop']) {
    const win = gltf(type).materials.find((x) => x.name.startsWith('Window'));
    assert.ok(win && Math.max(...win.emissiveFactor) > 0, type);
    assert.equal(manifest.find((a) => a.name === type).review, type === 'workshop' ? 'pending owner review (round 3)' : 'pending owner review (visual round V)', type); // visual round V rebuilt the faction buildings
  }
});
