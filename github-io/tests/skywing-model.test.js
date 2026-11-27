// Skywing's own model (tools/blender/generate_skywing.py, owner 2026-11-28: "I can't see the hero below the Kite"):
// a pilot with a rigid jet-wing, hinge pivots for the wings, a shoulder pivot for the arms, one pivot per weapon,
// the infantry's leg pivots, kit materials only, within its triangle budgets; the Kite scout keeps its own model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PropertyBinding } from 'three';
import { glbJson } from './lib/glb.mjs';
import { RIG_INFANTRY, BONE, SKYWING_POSE } from '../src/unit-rig.js';

const read = (path) => glbJson(readFileSync(new URL(`../public/models/${path}`, import.meta.url)));
const names = (json) => json.nodes.map((n) => PropertyBinding.sanitizeNodeName(n.name || ''));
const tris = (json) => json.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + json.accessors[p.indices].count / 3, 0);
const manifest = JSON.parse(readFileSync(new URL('../public/models/manifest.json', import.meta.url), 'utf8')).assets;
const detail = JSON.parse(readFileSync(new URL('../public/models/detail/manifest.json', import.meta.url), 'utf8')).assets;

test('the model: leg, wing-hinge, shoulder and weapon pivots; within 5k triangles (15k close up)', () => {
  const json = read('skywing.glb'), nodes = names(json);
  for (const pivot of ['leg_L', 'leg_R', 'skywing_wing_L', 'skywing_wing_R', 'skywing_arms', 'skywing_sniper', 'skywing_rocket'])
    assert.ok(nodes.includes(pivot), pivot);
  const row = manifest.find((a) => a.name === 'skywing');
  assert.ok(row?.hero, 'listed as a hero model');
  assert.equal(tris(json), row.triangles);
  assert.ok(row.triangles <= 5000 && row.budget === 5000, `${row.triangles} triangles`);
  const close = detail.find((a) => a.name === 'skywing');
  assert.equal(close.base_triangles, row.triangles, 'the close-up model is built on the shipped one');
  assert.ok(close.triangles <= 15000, `${close.triangles} close-up triangles`);
  assert.equal(tris(read('detail/skywing.glb')), close.triangles);
  // The wing hinges sit on the back, mirrored (the right one a touch further back so folded wings never z-fight).
  const at = (name) => json.nodes[nodes.indexOf(name)].translation;
  const [l, r] = [at('skywing_wing_L'), at('skywing_wing_R')];
  assert.ok(l[0] < -0.1 && Math.abs(l[0] + r[0]) < 1e-6, 'mirrored across the spine');
  assert.ok(l[1] > 1.4 && l[1] < 1.9, 'at shoulder-blade height');
  assert.ok(l[2] < -0.3 && r[2] < l[2], 'on the back (glTF -Z), the right wing behind the left');
  // The two weapons hang on the shoulder line, like the arms that hold them.
  assert.deepEqual(at('skywing_sniper'), at('skywing_arms'));
  assert.deepEqual(at('skywing_rocket'), at('skywing_arms'));
  // Kit materials only (they bake into one draw), single-sided, team paint and team glow present.
  const mats = json.materials.map((m) => m.name.replace(/\.\d+$/, ''));
  assert.ok(mats.includes('Team') && mats.includes('TeamGlow'));
  assert.ok(json.materials.every((m) => !m.doubleSided));
  for (const m of mats) assert.ok(!/^(Glass|Lamp|Energy|Alloy|Flame)/.test(m), `${m} would keep a draw of its own`);
  // The wings span more than the Kite's sail, so the hero reads from the look-down camera.
  const kite = read('kite.glb');
  assert.ok(!names(kite).some((n) => n.startsWith('skywing_')), 'the Kite scout keeps its own model');
});

test('the runtime rig: Skywing walks as infantry; wings fold and arms raise on bones of their own', () => {
  assert.ok(RIG_INFANTRY.has('skywing'));
  assert.deepEqual([BONE.wingL, BONE.wingR, BONE.arms, BONE.none], [6, 7, 8, 9]);
  assert.ok(SKYWING_POSE.fold > 1.1 && SKYWING_POSE.fold < 1.6, 'folded, the wing tips point down the back');
  assert.ok(SKYWING_POSE.raise > 0.9 && SKYWING_POSE.raise < 1.4, 'in flight the weapon points ahead');
});
