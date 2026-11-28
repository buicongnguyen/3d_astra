// Visual round V (2026-11-26): the twelve faction-unique models rebuilt to the shared kit's finish
// (tools/blender/generate_factions.py + faction_parts.py). Cost and contract against round 3 (main 9fbb7c6):
//  - triangles within +25 % of the round-3 model (and the infantry still >= 2800, as the shared kit's troops);
//  - no more materials, and no more instanced batches per model: the meshes the view keeps after merging parts
//    by material within each rigid group and baking plain finishes together (src/view.js prepareModels and
//    bakeFinishes, replayed below), counted in all and team-painted (one batch per team on the field);
//  - size in the slot's family: buildings keep their footprint and a similar height, the Supply wagon is a
//    Breaker-size vehicle (round 3's dwarfed a Battle tank), units stay near their round-3 size;
//  - every part name a rig looks up is there with its exact name, and nothing else joins a gun rig by accident.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PropertyBinding } from "three";
import { RIG_PART } from "../src/view.js";
import { RIG_INFANTRY, RIG_HULL } from "../src/unit-rig.js";
import { glbJson } from './lib/glb.mjs';

const gltf = (name) => {
  const data = readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
  return glbJson(data);
};
const manifest = JSON.parse(readFileSync(new URL("../public/models/manifest.json", import.meta.url), "utf8")).assets;
const clean = (n) => PropertyBinding.sanitizeNodeName(n || "");

// Round 3: triangles, materials, batches (all / team-painted) and size (x across, y up, z along).
const ROUND3 = {
  // 2026-11-28: the Scrapper and the Shade fight with blades like the Vanguard: the arm swinging the blade is its own
  // rigid group (SwordArm, one baked batch, no team paint): Scrapper 3 -> 4 batches, the Shade 3 -> 4 (its round-3 line).
  scrapper: { tris: 2852, mats: 7, batches: 4, team: 1, size: [1.4, 2.33, 0.96] },
  scorcher: { tris: 2336, mats: 5, batches: 4, team: 2, size: [2.35, 2.8, 3.91] },
  salvageyard: { tris: 2140, mats: 8, batches: 4, team: 2, size: [4.6, 4.08, 4.1] },
  rider: { tris: 2496, mats: 5, batches: 3, team: 1, size: [1.5, 3.24, 3.11] },
  wagon: { tris: 2224, mats: 6, batches: 2, team: 1, size: [2.93, 3.18, 4.1] },
  waystation: { tris: 2148, mats: 7, batches: 4, team: 2, size: [4.86, 3.04, 4.0] },
  drone: { tris: 3536, mats: 4, batches: 4, team: 2, size: [2.06, 1.88, 1.93] },
  walker: { tris: 3268, mats: 5, batches: 5, team: 3, size: [3.18, 4.06, 3.0] },
  pylon: { tris: 2976, mats: 6, batches: 4, team: 2, size: [3.8, 4.57, 3.8] },
  shade: { tris: 2844, mats: 7, batches: 4, team: 2, size: [1.19, 2.76, 1.06] },
  watcher: { tris: 2836, mats: 7, batches: 5, team: 2, size: [1.19, 2.76, 2.48] },
  veilrelay: { tris: 2248, mats: 6, batches: 4, team: 2, size: [3.6, 4.8, 3.6] },
};
const BUILDINGS = new Set(["salvageyard", "waystation", "pylon", "veilrelay"]);
const BREAKER = [2.28, 2.3, 3.23]; // the shared Breaker's size (breaker.glb)
// The shared model of each unit's slot (its longest side across or along, from its GLB): a unique unit may reach it.
const SLOT = { scrapper: 1.78, shade: 1.78, watcher: 1.77, rider: 2.86, drone: 2.86, walker: 4.61 }; // vanguard, antitank, ranger, tank
// The gun-rig parts each model is meant to have (everything RIG_PART matches must start with one of these).
const GUN = { scorcher: ["Turret_head", "Barrel_", "Muzzle_"], walker: ["Turret_head", "Barrel_", "Muzzle_"], watcher: ["Barrel_", "Muzzle_"],
  rider: ["Barrel_twin"], drone: ["Barrel_emitter"] };

// The view's template: parts under a moving pivot (leg_* unless the type's legs are shader bones, spin_*, flicker_)
// form their own group, gun parts the turret (Turret_head* with a Turret_pivot) or the barrel group; within a group
// one mesh per material, then every plain finish (not Team/Glass/Lamp/Energy, not lit) bakes into one mesh.
const MOVING_PART = /^(leg_|spin_|flicker_|SwordArm$)/;
const KEEP_FINISH = /^(Team|Glass|Lamp|Energy)/;
function batches(type, json) {
  const parent = new Map();
  json.nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
  const pivot = json.nodes.some((n) => clean(n.name).startsWith("Turret_pivot"));
  const groups = new Map();
  json.nodes.forEach((n, i) => {
    if (n.mesh === undefined) return;
    let group = "body";
    for (let p = parent.get(i); p !== undefined; p = parent.get(p)) {
      const pn = clean(json.nodes[p].name);
      if (MOVING_PART.test(pn) && !(RIG_INFANTRY.has(type) && pn.startsWith("leg_"))) { group = pn; break; }
    }
    const name = clean(n.name);
    if (group === "body" && RIG_PART.test(name)) group = pivot && /^Turret_head/i.test(name) ? "turret" : "barrel";
    for (const p of json.meshes[n.mesh].primitives) {
      const m = json.materials[p.material];
      if (!groups.has(group)) groups.set(group, new Map());
      groups.get(group).set(m.name, m);
    }
  });
  let all = 0, team = 0;
  for (const mats of groups.values()) {
    let plain = 0;
    for (const [name, m] of mats) {
      if (KEEP_FINISH.test(name) || Math.max(...(m.emissiveFactor || [0])) > 0) { all++; if (name.startsWith("Team")) team++; }
      else plain++;
    }
    all += plain ? 1 : 0;
  }
  return { all, team };
}
function size(json) {
  const parent = new Map();
  json.nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  json.nodes.forEach((n, i) => {
    if (n.mesh === undefined) return;
    const off = [0, 0, 0];
    for (let p = i; p !== undefined; p = parent.get(p)) (json.nodes[p].translation || [0, 0, 0]).forEach((v, k) => (off[k] += v));
    for (const p of json.meshes[n.mesh].primitives) {
      const a = json.accessors[p.attributes.POSITION];
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a.min[k] + off[k]); hi[k] = Math.max(hi[k], a.max[k] + off[k]); }
    }
  });
  return hi.map((h, k) => h - lo[k]);
}
const triangles = (json) => json.meshes.reduce((n, m) => n + m.primitives.reduce((k, p) => k + (p.indices === undefined ? json.accessors[p.attributes.POSITION].count : json.accessors[p.indices].count) / 3, 0), 0);

test("visual round V: each unique model keeps its cost (triangles +25 % at most, materials and batches no more)", () => {
  for (const [type, r3] of Object.entries(ROUND3)) {
    const json = gltf(type), tris = triangles(json), entry = manifest.find((a) => a.name === type);
    assert.equal(entry.triangles, tris, `${type}: manifest triangles`);
    assert.equal(entry.review, "pending owner review (visual round V)", type);
    assert.ok(tris <= Math.floor(r3.tris * 1.25), `${type}: ${tris} triangles > round 3 ${r3.tris} + 25 %`);
    if (["scrapper", "shade", "watcher"].includes(type)) assert.ok(tris >= 2800, `${type}: ${tris} triangles, the infantry family has 2800+`);
    assert.ok(json.materials.length <= r3.mats, `${type}: ${json.materials.length} materials > ${r3.mats}`);
    const b = batches(type, json);
    assert.ok(b.all <= r3.batches, `${type}: ${b.all} batches > ${r3.batches}`);
    assert.ok(b.team <= r3.team, `${type}: ${b.team} team batches > ${r3.team}`);
  }
});

test("visual round V: sizes stay in the slot's family; the Supply wagon is Breaker-size", () => {
  for (const [type, r3] of Object.entries(ROUND3)) {
    const [w, h, d] = size(gltf(type));
    if (BUILDINGS.has(type)) {
      // Buildings occupy grid cells: the same footprint (the plinth) and a height within 15 %.
      assert.ok(Math.abs(w - r3.size[0]) <= 0.12 && Math.abs(d - r3.size[2]) <= 0.12, `${type}: footprint ${w.toFixed(2)} x ${d.toFixed(2)} vs ${r3.size[0]} x ${r3.size[2]}`);
      assert.ok(Math.abs(h / r3.size[1] - 1) <= 0.15, `${type}: height ${h.toFixed(2)} vs ${r3.size[1]}`);
    } else if (type === "wagon") {
      assert.ok(w <= BREAKER[0] * 1.05 && d <= BREAKER[2] * 1.1, `wagon footprint ${w.toFixed(2)} x ${d.toFixed(2)} vs the Breaker's ${BREAKER[0]} x ${BREAKER[2]}`);
      assert.ok(h <= 2.8, `wagon height ${h.toFixed(2)}`);
    } else if (type === "scorcher") {
      assert.ok(w <= BREAKER[0] * 1.1 && d <= BREAKER[2] * 1.1, `scorcher footprint ${w.toFixed(2)} x ${d.toFixed(2)} vs the Breaker's`);
    } else {
      // Units near their round-3 size (bars, rings and picks still fit): troops about the Vanguard's 2.25 m, the
      // rest no taller than before; none more than a fifth wider or longer than its round-3 or slot model.
      if (["scrapper", "shade", "watcher"].includes(type)) assert.ok(h >= 2 && h <= Math.max(r3.size[1], 2.5), `${type}: height ${h.toFixed(2)}`);
      else assert.ok(h <= r3.size[1] + 0.05, `${type}: height ${h.toFixed(2)} > ${r3.size[1]}`);
      assert.ok(Math.max(w, d) <= Math.max(r3.size[0], r3.size[2], SLOT[type]) * 1.2, `${type}: ${w.toFixed(2)} x ${d.toFixed(2)}`);
    }
  }
});

test("visual round V: every rig part keeps its exact name; nothing joins a gun rig by accident", () => {
  for (const type of Object.keys(ROUND3)) {
    const json = gltf(type), names = json.nodes.map((n) => clean(n.name));
    const parent = new Map();
    json.nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
    if (RIG_INFANTRY.has(type)) {
      // Shader-bone legs: two hips named exactly leg_L / leg_R, each with a Knee* mesh marking the bend.
      for (const side of ["leg_L", "leg_R"]) {
        const i = names.indexOf(side);
        assert.ok(i >= 0, `${type}: ${side}`);
        assert.ok((json.nodes[i].children || []).some((c) => /^Knee/.test(names[c])), `${type}: ${side} has a Knee* part`);
      }
    } else assert.ok(!names.some((n) => n.startsWith("leg_")), `${type}: no leg pivots`);
    if (type === "rider") assert.ok(names.some((n) => /^Tyres/.test(n)) && names.some((n) => /^Spokes/.test(n)), "rider: Tyres and Spokes roll");
    // view.js measures a hull's wheels on the last mesh named Wheels*: exactly one, the road wheels (a hub named
    // Wheels_hubs once set the radius and the Scorcher's wheels spun 2.4x too fast; hubs are Wheel_hubs).
    if (RIG_HULL.has(type)) {
      const wheels = json.nodes.filter((n) => n.mesh !== undefined && /^Wheels/.test(clean(n.name)));
      assert.equal(wheels.length, 1, `${type}: one Wheels* mesh (${wheels.map((n) => n.name)})`);
      const acc = json.accessors[json.meshes[wheels[0].mesh].primitives[0].attributes.POSITION];
      const radius = (acc.max[1] - acc.min[1]) / 2;
      assert.ok(radius > 0.15, `${type}: road wheel radius ${radius.toFixed(3)} m`);
    }
    if (type === "scorcher") assert.ok(names.some((n) => /^Tracks/.test(n)), "scorcher: tracks");
    if (["scorcher", "walker"].includes(type)) {
      assert.ok(names.includes("Turret_pivot"), `${type}: Turret_pivot`);
      assert.ok(names.some((n) => /^Turret_head/.test(n)) && names.some((n) => /^Barrel_/.test(n)) && names.some((n) => /^Muzzle_/.test(n)), `${type}: turret, barrel, muzzle`);
    }
    if (type === "drone") assert.ok(names.includes("hover"), "drone: hover");
    const gun = names.filter((n, i) => json.nodes[i].mesh !== undefined && RIG_PART.test(n));
    for (const n of gun) assert.ok((GUN[type] || []).some((p) => n.startsWith(p)), `${type}: ${n} would join the gun rig`);
    if (GUN[type]) assert.ok(gun.length > 0, `${type}: its gun rig`);
    // Pivots the view finds by name carry no Blender ".001" suffix (parts may: they are matched by prefix).
    assert.ok(!names.some((n, i) => json.nodes[i].mesh === undefined && /\d{3}$/.test(n)), `${type}: pivot names without Blender's .001 suffixes`);
  }
});
