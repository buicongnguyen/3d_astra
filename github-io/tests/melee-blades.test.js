// Blade fighters (2026-11-28): the Ashfall Scrapper and the Veil Shade fight like the Meridian Vanguard they replace,
// with a slice and a thrust on the Vanguard's timing, a glint at blade contact, no projectile and blade sounds
// (src/melee-styles.js, src/vanguard-sword.js, src/fx.js swordContact). View only: the rules are unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { Group, Vector3 } from "three";
import { parseModel } from "./lib/glb.mjs";
import balance from "../src/balance.json" with { type: "json" };
import { weaponStyle } from "../src/visual-style.js";
import { weaponClass } from "../src/fx-kinds/weapon-class.js";
import { signatureOf } from "../src/fx-kinds/signature.js";
import { weaponClass as soundClass, impactLayer, soundFor } from "../src/audio-logic.js";
import { BANK } from "../src/sfx-bank.js";
import { Effects } from "../src/fx.js";
import { MELEE_TYPES, MELEE_STYLE, isMeleeType, meleeStyle } from "../src/melee-styles.js";
import { attachVanguardSword, prepareVanguardArm, strikeVanguardSword, restVanguardSword, VANGUARD_WINDUP, VANGUARD_RECOVERY } from "../src/vanguard-sword.js";

const BLADES = ["scrapper", "shade"];
const D = balance.definitions;
// The effects paint their particle atlas on a canvas: a stub one is enough here.
const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
globalThis.document ??= { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
const fxWith = (rng) => { const fx = new Effects({ lowPower: false, scene: { add() {} }, terrain: { id: "riverlands" }, activity: { combat: { motion: true } }, motionLevel: 2 }); fx.rng = rng; return fx; };
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test("the Vanguard-slot units of every faction are blade fighters; the rules are untouched", () => {
  assert.deepEqual([...MELEE_TYPES], ["vanguard", ...BLADES]);
  for (const [faction, f] of Object.entries(balance.factions)) {
    const unit = f.swap?.vanguard || "vanguard";
    assert.ok(isMeleeType(unit), `${faction}: ${unit}`);
  }
  // The rules keep their melee reach and numbers (balance.json is not part of this change).
  for (const type of MELEE_TYPES) assert.ok(D[type].range <= 2 && D[type].class === "melee", type);
  assert.deepEqual([D.scrapper.hp, D.scrapper.damage, D.scrapper.interval, D.shade.hp, D.shade.damage, D.shade.interval], [105, 11, 0.8, 130, 20, 0.9]);
  // The Bulwark (a ranged shield unit) and the Iron Vanguard (a boss autocannon) keep their guns.
  assert.ok(!isMeleeType("bulwark") && !isMeleeType("ironvanguard"));
  assert.notEqual(weaponStyle({ unit: "ironvanguard", weapon: "ironvanguard" }).kind, "melee");
});

test("Scrapper and Shade take the melee path: melee class, no signature shot, blade sounds, the Vanguard's contact time", () => {
  const vanguard = weaponStyle({ unit: "vanguard", weapon: "vanguard" });
  for (const type of BLADES) {
    const ev = { type: "shot", unit: type, weapon: D[type].shot || type, x: 0, z: 0, tx: 1.5, tz: 0, team: 0, target: 9 };
    const style = weaponStyle(ev);
    assert.equal(style.kind, "melee", type);
    assert.equal(style.life, vanguard.life, `${type}: contact after the Vanguard's wind-up`);
    assert.equal(style.life, VANGUARD_WINDUP);
    assert.equal(weaponClass(ev), "melee", type);
    for (const faction of ["meridian", "ashfall", "sunward", "wardens", "veil"]) assert.equal(signatureOf(faction, type), null, `${faction} ${type}: no shot look`);
    assert.equal(soundClass(ev, type), "melee", type);
    const voice = soundFor(ev, type).name;
    assert.ok(BANK[voice] && voice !== "shot:blade", `${type} has its own blade voice (${voice})`);
    assert.deepEqual(impactLayer(ev, type), { name: "impact:blade", size: "small", delay: VANGUARD_WINDUP });
  }
});

test("a Scrapper or Shade strike draws no projectile: its glint lands on the struck face at blade contact", () => {
  for (const type of BLADES) {
    const shot = { type: "shot", unit: type, weapon: type, x: 1, z: 0, tx: 3, tz: 0, team: 0, target: 9 };
    const radius = 0.75, visible = { entities: [], isVisible: () => true, get: () => ({ radius, team: 1, x: 3, z: 0 }) };
    for (const moving of [true, false]) {
      const fx = fxWith(seeded(7));
      fx.view.activity.combat.motion = moving;
      fx.impact({ x: 3, z: 0, weapon: type, seed: 9 });
      fx.shot(shot, visible);
      fx.update(visible, VANGUARD_WINDUP - 0.01);
      assert.equal(fx.glow.items.length + fx.smoke.items.length + fx.projectiles.length, 0, `${type}: nothing before contact`);
      fx.update(visible, 0.011);
      assert.equal(fx.projectiles.length, 0, `${type}: no projectile`);
      assert.equal(fx.glow.items.filter((p) => p.priorityHit).length, 1, `${type}: one contact glint`);
      assert.ok(fx.glow.items.every((p) => p.anchor.target === 9), `${type}: every particle sits on the struck unit`);
      assert.equal(fx.glow.items.length > 1, moving, `${type}: motion off keeps only the quiet glint`);
      // The Shade leaves a short shadow after-image (pooled smoke, no draw); the Scrapper throws rusty orange sparks.
      assert.equal(fx.smoke.items.length > 0, moving && type === "shade", `${type}: after-image only for the Shade, with motion`);
      if (moving && type === "scrapper") assert.ok(fx.glow.items.some((p) => p.c0[0] === 1 && p.c0[1] < 0.7 && p.c0[2] < 0.3), "rusty orange sparks");
    }
  }
});

for (const type of BLADES) {
  test(`${type}: the model carries a rigid blade arm within budget, and it slices and thrusts on the Vanguard's timing`, async () => {
    const manifest = JSON.parse(readFileSync(new URL("../public/models/manifest.json", import.meta.url), "utf8")).assets;
    const row = manifest.find((a) => a.name === type);
    assert.ok(row.triangles <= row.budget, `${type}: ${row.triangles} > ${row.budget}`);
    const bytes = await readFile(new URL(`../public/models/${type}.glb`, import.meta.url));
    const { scene } = await parseModel(bytes);
    const arm = scene.getObjectByName("SwordArm"), elbow = arm?.getObjectByName("SwordElbow"), blade = elbow?.getObjectByName("Sword_blade");
    assert.ok(arm && elbow && blade, `${type}: SwordArm > SwordElbow > Sword_blade`);
    // One rigid arm: the elbow sits on the shoulder; every arm mesh hangs under it, with no team paint and no glow
    // (one baked batch per type).
    assert.ok(elbow.position.length() < 1e-6, `${type}: the arm turns at the shoulder`);
    arm.traverse((o) => { if (o.isMesh) assert.ok(!/^Team/.test(o.material.name) && o.parent === elbow, `${type}: ${o.name} (${o.material.name})`); });
    const detail = await parseModel(await readFile(new URL(`../public/models/detail/${type}.glb`, import.meta.url)));
    assert.ok(detail.scene.getObjectByName("SwordArm")?.getObjectByName("SwordElbow")?.getObjectByName("Sword_blade"), `${type}: the close-up model has the arm too`);

    const hip = scene.getObjectByName("leg_L").position.y, model = new Group();
    model.add(prepareVanguardArm(arm, hip, type));
    const sword = attachVanguardSword(model, type);
    assert.equal(sword.style, MELEE_STYLE[type]);
    assert.equal(sword.wave, undefined, `${type}: the lightning wave stays the Vanguard's`);
    const tip = () => { const p = new Vector3(); blade.geometry.computeBoundingBox(); return blade.localToWorld(p.copy(blade.geometry.boundingBox.max).setX(0)); };
    restVanguardSword(sword);
    const rest = tip();
    strikeVanguardSword(sword, -VANGUARD_WINDUP * 0.6, 0);
    const raised = tip();
    assert.ok(raised.distanceTo(rest) > 0.3, `${type}: the wind-up draws the blade back`);
    strikeVanguardSword(sword, 0, 0);
    assert.ok(sword.lunge > 0.15, `${type}: the slice steps in`);
    strikeVanguardSword(sword, 0, 1);
    assert.ok(sword.lunge > 0.35, `${type}: the thrust drives in further`);
    strikeVanguardSword(sword, VANGUARD_RECOVERY, 1);
    assert.ok(tip().distanceTo(rest) < 1e-6 && sword.lunge === 0, `${type}: back on guard after the Vanguard's recovery`);
  });
}

test("every blade fighter's style has a slice, a thrust and a contact look", () => {
  for (const type of MELEE_TYPES) {
    const s = meleeStyle(type);
    for (const move of [s.slash, s.thrust]) assert.ok(move.length === 3 && move.every((k) => k.length === 4 && k.every(Number.isFinite)), type);
    assert.ok(s.contact.c0.length === 3 && s.contact.sparks > 0, type);
  }
  assert.equal(meleeStyle("nobody"), MELEE_STYLE.vanguard);
});
