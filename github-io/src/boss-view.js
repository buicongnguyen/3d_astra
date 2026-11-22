import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { adoptBatchedParts } from "./entity-batches.js";
import { FEEL } from "./camera-shake.js";
import { BOSSES } from "./sim/bosses.js";

// Bosses on the battlefield (rules: src/sim/bosses.js, docs/aaa/BOSSES.md): the model with its moving
// parts, the danger-zone marks on the ground, gun glow and recoil, the core lit only while exposed,
// stage shake and a long fall. Draw cost: one draw per rigid part (seven, the core an eighth while it
// is lit) and one per marked zone; everything goes through the entity batches like any unit.

// Group nodes of a ported boss model (tools/port-boss-model.mjs) and what the runtime calls them.
// leg_* swing with the walk (view.js); TurretRig turns toward the target like a vehicle turret.
// Parts tables per ported boss (BOSS_PARTS): [node in the GLB, runtime name, parent part]. The table is
// picked by a node only that model has, so a later boss is one more entry (docs/aaa/BOSSES.md).
// The Sovereign's six legs are two rigid tripods (LegsA, LegsB: one draw each) that step in turn.
const SOVEREIGN_PARTS = [["LegsA", "BossLegA", null], ["LegsB", "BossLegB", null], ["Turret", "TurretRig", null], ["Cannon", "BossCannon", "Turret"], ["LightGun", "BossGun", "Turret"]];
export const BOSS_PARTS = [{ marker: "LegsA", parts: SOVEREIGN_PARTS }];
const PARTS_VANGUARD = [["LeftLeg", "leg_L", null], ["RightLeg", "leg_R", null], ["Turret", "TurretRig", null], ["ArmL", "BossArmL", "Turret"], ["ArmR", "BossArmR", "Turret"], ["LightGun", "BossGun", "Turret"]];
const reflects = (m) => m.metalness >= 0.5 || m.roughness <= 0.25;

// One template per team: each rigid part's painted pieces become a single mesh whose vertices carry
// their colour (team colour for `Team`) and finish, drawn with the shared baked material; the core
// stays its own glowing mesh.
export function recolorBossPaint(geometry, hex) {
  const paint = geometry.userData.bossPaint;
  if (!paint || paint.hex === hex) return;
  const team = new THREE.Color(hex), colors = geometry.attributes.color;
  for (const { start, shades } of paint.ranges) {
    for (let i = 0; i < shades.length; i++) colors.setXYZ(start + i, team.r * shades[i], team.g * shades[i], team.b * shades[i]);
  }
  colors.needsUpdate = true;
  paint.hex = hex;
}

export function bossTemplates(scene, { colors, glows, bakedMaterial }) {
  scene.updateMatrixWorld(true);
  const PARTS = BOSS_PARTS.find((t) => scene.getObjectByName(t.marker))?.parts || PARTS_VANGUARD;
  const nodes = new Map(PARTS.map(([name]) => [name, scene.getObjectByName(name)]));
  const owners = new Map(); // three node -> part name
  for (const [name, node] of nodes) if (node) owners.set(node, name);
  const pieces = []; // { part, mesh, matrix }
  scene.traverse((o) => {
    if (!o.isMesh) return;
    let p = o.parent;
    while (p && !owners.has(p)) p = p.parent;
    const part = p ? owners.get(p) : null, base = p ? p.matrixWorld : new THREE.Matrix4();
    pieces.push({ part, mesh: o, matrix: base.clone().invert().multiply(o.matrixWorld) });
  });
  return colors.map((teamHex, index) => {
    const template = new THREE.Group();
    template.name = "BossModel";
    const groups = new Map([[null, template]]);
    for (const [name, rename, parent] of PARTS) {
      const node = nodes.get(name);
      if (!node) continue;
      const g = new THREE.Group();
      g.name = rename;
      const above = parent ? nodes.get(parent).matrixWorld : new THREE.Matrix4();
      above.clone().invert().multiply(node.matrixWorld).decompose(g.position, g.quaternion, g.scale);
      (groups.get(parent) || template).add(g);
      groups.set(name, g);
    }
    const team = new THREE.Color(teamHex), glow = new THREE.Color(glows[index] ?? 0xff9a3c);
    for (const [part, group] of groups) {
      const mine = pieces.filter((p) => p.part === part);
      const painted = mine.filter((p) => !p.mesh.material.name.startsWith("BossCore"));
      if (painted.length) {
        let offset = 0;
        const ranges = [];
        const geometries = painted.map(({ mesh, matrix }) => {
          const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(matrix), m = mesh.material;
          const n = g.getAttribute("position").count, shade = g.getAttribute("color"), color = m.name.startsWith("Team") ? team : m.color;
          if (m.name.startsWith("Team")) ranges.push({ start: offset, shades: Float32Array.from({ length: n }, (_, i) => shade ? shade.getX(i) : 1) });
          offset += n;
          const rgb = new Float32Array(n * 3), finish = new Float32Array(n * 2);
          for (let i = 0; i < n; i++) {
            const k = shade ? shade.getX(i) : 1;
            rgb[i * 3] = color.r * k; rgb[i * 3 + 1] = color.g * k; rgb[i * 3 + 2] = color.b * k;
            finish[i * 2] = m.roughness; finish[i * 2 + 1] = m.metalness;
          }
          for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
          g.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
          g.setAttribute("finish", new THREE.BufferAttribute(finish, 2));
          return g;
        });
        const merged = mergeGeometries(geometries, false);
        if (ranges.length) merged.userData.bossPaint = { hex: teamHex, ranges };
        geometries.forEach((g) => g.dispose());
        const mesh = new THREE.Mesh(merged, bakedMaterial(painted.some((p) => reflects(p.mesh.material))));
        mesh.name = "baked";
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
      }
      for (const { mesh: source, matrix } of mine.filter((p) => p.mesh.material.name.startsWith("BossCore"))) {
        // A little larger than modelled, so the lit core reads at RTS distance.
        const geometry = source.geometry.clone().applyMatrix4(matrix);
        geometry.computeBoundingBox();
        const middle = geometry.boundingBox.getCenter(new THREE.Vector3());
        geometry.translate(-middle.x, -middle.y, -middle.z).scale(1.5, 1.5, 1.5).translate(middle.x, middle.y, middle.z + 0.03);
        const core = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name: "BossCore", color: glow, emissive: glow, emissiveIntensity: 2.2, roughness: 0.3 }));
        core.name = "BossCore";
        core.visible = false;
        group.add(core);
      }
    }
    adoptBatchedParts(template);
    return template;
  });
}

// The ground mark of a danger zone: a filled shape with a bright edge that sweeps from the middle
// outward as the warning runs down, then flashes while the rounds land. One draw each.
const ZONE_VERTEX = `varying vec2 vLocal; uniform vec4 uBox; void main() { vLocal = mix(uBox.xy, uBox.zw, uv); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ZONE_FRAGMENT = `
varying vec2 vLocal;
uniform int uShape; uniform float uRadius, uLength, uHalf, uWidth, uProgress, uFire, uTime, uEdge;
uniform vec3 uColor, uHot;
void main() {
  float d, fill;
  if (uShape == 0) { d = length(vLocal) - uRadius; fill = length(vLocal) / uRadius; }
  else {
    float u = vLocal.y, v = abs(vLocal.x), w = uShape == 1 ? max(u, 0.0) * uHalf : uWidth;
    d = max(max(-u, u - uLength), v - w);
    fill = u / uLength;
  }
  if (d > uEdge) discard;
  float edge = 1.0 - smoothstep(0.0, uEdge, abs(d));
  float inside = step(d, 0.0);
  float swept = inside * step(fill, uProgress);
  float pulse = 0.5 + 0.5 * sin(uTime * 9.0);
  float stripes = 0.5 + 0.5 * sin((vLocal.x + vLocal.y) * 3.2 - uTime * 4.0);
  vec3 color = mix(uColor, uHot, uFire);
  float alpha = max(edge * (0.75 + 0.25 * pulse), inside * (0.16 + 0.1 * stripes) + swept * 0.22) + uFire * inside * 0.35;
  gl_FragColor = vec4(color, min(0.92, alpha));
}`;
const SHAPES = { circle: 0, cone: 1, line: 2 };

// Boss engine III (R3-H): the relay shield. A bubble round the boss with a bright rim (fresnel) and one
// tether from each standing relay to it, all in warm Ashfall amber. Two draws while it is shielded, none
// otherwise; the meshes are made the first time a shielded boss is seen.
const SHIELD_VERTEX = `varying vec3 vN; varying vec3 vV; void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-p.xyz); gl_Position = projectionMatrix * p; }`;
const SHIELD_FRAGMENT = `
varying vec3 vN; varying vec3 vV;
uniform vec3 uColor; uniform float uTime, uHit, uFade;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float bands = 0.5 + 0.5 * sin(vN.y * 14.0 - uTime * 3.0);
  float a = (0.07 + rim * 0.75 + bands * rim * 0.25 + uHit * 0.35) * uFade;
  gl_FragColor = vec4(uColor * (1.0 + uHit), min(0.85, a));
}`;
const SHIELD_COLOR = 0xffb347, TETHERS = 6;

export class BossView {
  constructor(view) {
    this.view = view;
    this.marks = new Map(); // zone id -> mesh
    this.chargeClock = 0;
    this.shield = null; // { bubble, tethers, fade, hit }, made on first use
  }
  // Called from WorldView.createEntity for a boss: its parts, a vitals bar above its head.
  dress(root, e) {
    const model = root.userData.model, find = (name) => model.getObjectByName(name);
    let core = null;
    model.traverse((o) => { if (o.name === "BossCore") core = o; });
    root.userData.boss = { armL: find("BossArmL"), armR: find("BossArmR"), gun: find("BossGun"), cannon: find("BossCannon"), legA: find("BossLegA"), legB: find("BossLegB"), core, recoil: [0, 0, 0, 0], raise: 0, glow: 0, id: e.id };
    for (const arm of [root.userData.boss.armL, root.userData.boss.armR, root.userData.boss.cannon, root.userData.boss.legA, root.userData.boss.legB]) if (arm) arm.userData.base = arm.position.clone();
    root.userData.bar.position.y = 6.4;
    root.userData.bar.userData.base *= 1.6;
  }
  event(event, sim) {
    const view = this.view;
    if (event.type === "shot" && event.boss != null) {
      const u = view.objects.get(event.boss)?.userData.boss;
      if (u) u.recoil[event.muzzle] = 0.16;
    } else if (event.type === "bossStage" && sim.isVisible(event)) {
      view.shake.add(FEEL.buildingTrauma, Math.hypot(event.x - view.focus.x, event.z - view.focus.z), view.shakeEnabled());
      view.fx.explosion({ x: event.x, y: 3, z: event.z }, 0.9, { x: event.x, z: event.z, team: event.team }, false);
    } else if (event.type === "bossSurge" && sim.isVisible(event)) {
      // Phase 2: a blast at its feet, a heavy shake and the core flaring for the whole surge.
      view.shake.add(FEEL.coreTrauma, Math.hypot(event.x - view.focus.x, event.z - view.focus.z), view.shakeEnabled());
      view.fx.explosion({ x: event.x, y: 1.2, z: event.z }, 1.5, { x: event.x, z: event.z, team: event.team }, false);
      const u = view.objects.get(event.id)?.userData.boss;
      if (u) u.glow = 1;
    } else if (event.type === "bossDefeated") {
      const d = view.dying.find((x) => x.object.userData.boss?.id === event.id);
      if (d) { d.kind = "boss"; d.life = 3.6; }
      if (sim.isVisible(event)) {
        view.fx.bossDeath(event);
        view.shake.add(FEEL.coreTrauma, Math.hypot(event.x - view.focus.x, event.z - view.focus.z), view.shakeEnabled());
        if (view.feelEnabled() && view.onScreen(event)) view.hitStop = FEEL.stopSeconds;
      }
    }
  }
  // A fallen boss kneels, pitches forward and sinks (view.js updateDying, kind "boss").
  fall(d, t, motion) {
    const m = d.object.userData.model, ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
    const shake = motion ? Math.max(0, 1 - t / 1.4) * 0.12 : 0;
    d.object.position.set(d.x + Math.sin(t * 57) * shake, d.baseY - ease((t - 0.9) / 1.6) * 1.2 - ease((t - (d.life - 0.9)) / 0.9) * 2.4, d.z + Math.cos(t * 49) * shake);
    m.rotation.x = ease((t - 0.5) / 1.4) * 0.55;
    m.rotation.z = d.tilt * ease((t - 0.5) / 1.6) * 0.12;
  }
  update(sim, dt) {
    const view = this.view, motion = view.activity.combat.motion;
    this.chargeClock -= dt;
    const charge = this.chargeClock <= 0 && dt > 0;
    if (charge) this.chargeClock = 0.06;
    for (const e of sim.entities) {
      if (!e.boss) continue;
      const o = view.objects.get(e.id), u = o?.userData.boss;
      if (!u || !o.visible) continue;
      const phase = e.bs?.phase || "dormant", aiming = phase === "warning" || phase === "attacking";
      // Guns come up while they aim and fire, and drop when the core opens.
      u.raise += ((aiming ? 1 : phase === "exposed" ? -0.6 : 0) - u.raise) * Math.min(1, dt * 6);
      for (const [arm, side] of [[u.armL, 0], [u.armR, 2]]) {
        if (!arm) continue;
        const kick = Math.max(u.recoil[side], u.recoil[side + 1]);
        arm.rotation.x = -0.22 * u.raise;
        arm.position.copy(arm.userData.base);
        if (motion && kick > 0) arm.position.z -= Math.sin((kick / 0.16) * Math.PI) * 0.22;
      }
      // The Sovereign: the cannon kicks back per shell; two tripods of legs step in turn (a lift and a
      // sweep along the heading), their stride following the ground covered (the main loop's gait).
      if (u.cannon) {
        u.cannon.position.copy(u.cannon.userData.base);
        const kick = u.recoil[0];
        if (motion && kick > 0) u.cannon.position.z -= Math.sin((kick / 0.16) * Math.PI) * 0.5;
      }
      if (u.legA) {
        const g = o.userData.gait || 0, ph = o.userData.stride || 0;
        for (const [leg, k] of [[u.legA, 0], [u.legB, Math.PI]]) {
          const c = Math.cos(ph * 0.55 + k);
          leg.position.copy(leg.userData.base);
          if (motion) { leg.position.z += Math.sin(ph * 0.55 + k) * 0.5 * g; leg.position.y += Math.max(0, c) * 0.35 * g; }
        }
      }
      for (let i = 0; i < 4; i++) u.recoil[i] = Math.max(0, u.recoil[i] - dt);
      // The core: dark while armoured, a bright pulse while exposed.
      // A boss in a later phase (R3-H) runs hot: the core stays faintly lit, and blazes while it surges.
      const open = phase === "exposed" || phase === "surge", ember = e.bs?.set ? 0.3 : 0;
      u.glow += ((open ? 1 : ember) - u.glow) * Math.min(1, dt * 8);
      if (u.core) {
        u.core.visible = u.glow > 0.05;
        u.core.material.emissiveIntensity = 0.6 + u.glow * (2.2 + (motion ? Math.sin(view.lifeClock * 9) * 0.6 : 0));
      }
      // The open core also flares from any side, so it reads even when the chest faces away.
      if ((open || (ember && charge && Math.sin(view.lifeClock * 3) > 0.6)) && charge && motion && BOSSES[e.boss]?.core) {
        const [cx, cy, cz] = BOSSES[e.boss].core, c = Math.cos(e.angle), s = Math.sin(e.angle);
        view.fx.charge({ x: e.x + cx * c + cz * s, y: view.terrain.heightAt(e.x, e.z) + cy, z: e.z - cx * s + cz * c }, 1.6, { x: e.x, z: e.z, team: e.team }, true);
      }
      // While it aims, the four gun mouths glow brighter as the warning runs out.
      if (phase === "warning" && charge && motion) {
        const zone = sim.dangerZones?.find((z) => z.id === e.bs.zone), k = zone ? Math.min(1, (sim.time - zone.from) / Math.max(0.1, zone.at - zone.from)) : 0;
        const spec = BOSSES[e.boss], c = Math.cos(e.angle), s = Math.sin(e.angle), ground = view.terrain.heightAt(e.x, e.z);
        for (const m of spec?.muzzles || []) view.fx.charge({ x: e.x + m[0] * c + m[2] * s, y: ground + m[1], z: e.z - m[0] * s + m[2] * c }, 0.35 + k * 0.6, { x: e.x, z: e.z, team: e.team });
      }
    }
    this.updateMarks(sim, dt);
    this.updateShield(sim, dt);
  }
  // The relay shield of a warded boss (spec.ward): the bubble follows the boss, a tether runs from
  // each standing relay of its team to its chest, and the bubble flickers when the boss is hit.
  updateShield(sim, dt) {
    const view = this.view;
    let boss = null;
    for (const e of sim.entities) if (e.boss && e.hp > 0 && BOSSES[e.boss]?.ward) { boss = e; break; }
    const o = boss && view.objects.get(boss.id), on = !!(o?.visible && boss.bs?.warded > 0);
    if (!on && !this.shield) return;
    const s = (this.shield ||= this.createShield());
    s.fade += ((on ? 1 : 0) - s.fade) * Math.min(1, dt * (on ? 4 : 2.5));
    const shown = s.fade > 0.02 && !!o;
    s.bubble.visible = shown;
    s.tethers.visible = shown && on;
    if (!shown) return;
    const u = s.bubble.material.uniforms, ground = view.terrain.heightAt(boss.x, boss.z);
    // The bubble's size: the drawn model's footprint and height, measured once per boss.
    if (s.for !== boss.id) {
      const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3());
      s.for = boss.id;
      s.size = { r: Math.max(size.x, size.z, boss.radius * 2) * 0.58, h: Math.max(size.y, 3) };
    }
    if (boss.hp + boss.shield < (s.last ?? Infinity) - 1) s.hit = 1;
    s.last = boss.hp + boss.shield;
    s.hit = Math.max(0, s.hit - dt * 4);
    u.uTime.value = (u.uTime.value + dt) % 600;
    u.uHit.value = view.activity.combat.motion ? s.hit : 0;
    u.uFade.value = s.fade;
    const r = s.size.r, h = s.size.h * 0.75;
    s.bubble.position.set(boss.x, ground + h * 0.35, boss.z);
    s.bubble.scale.set(r, h, r);
    // Tethers: a thin column stretched from the relay's top to the boss's chest.
    const chest = new THREE.Vector3(boss.x, ground + h * 0.7, boss.z), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (const w of sim.entities) {
      if (n >= TETHERS || w.hp <= 0 || w.tag !== BOSSES[boss.boss].ward.tag || w.team !== boss.team || w.kind !== "building" || !sim.isVisible(w)) continue;
      const from = new THREE.Vector3(w.x, view.terrain.heightAt(w.x, w.z) + 3.2, w.z), d = chest.clone().sub(from), len = d.length();
      q.setFromUnitVectors(up, d.normalize());
      m.compose(from.clone().addScaledVector(d, len / 2), q, new THREE.Vector3(1, len, 1));
      s.tethers.setMatrixAt(n++, m);
    }
    s.tethers.count = n;
    s.tethers.instanceMatrix.needsUpdate = true;
    s.tethers.material.opacity = (0.45 + 0.25 * Math.sin(view.lifeClock * 6)) * s.fade;
  }
  createShield() {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.ShaderMaterial({
      vertexShader: SHIELD_VERTEX, fragmentShader: SHIELD_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(SHIELD_COLOR) }, uTime: { value: 0 }, uHit: { value: 0 }, uFade: { value: 0 } },
    }));
    bubble.name = "boss-shield";
    bubble.renderOrder = 4;
    const tethers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.14, 1, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: SHIELD_COLOR, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }), TETHERS);
    tethers.name = "boss-tethers";
    tethers.frustumCulled = false;
    tethers.count = 0;
    tethers.renderOrder = 4;
    bubble.visible = tethers.visible = false;
    this.view.scene.add(bubble, tethers);
    return { bubble, tethers, fade: 0, hit: 0, last: undefined };
  }
  updateMarks(sim, dt) {
    const zones = sim.dangerZones || [], seen = new Set();
    // An edge at least ~3 px wide at any zoom, so the mark reads on a phone.
    const edge = Math.max(0.28, 3 * (this.view.unitsPerPixel || 0.05));
    for (const z of zones) {
      if (!sim.isVisible(z) && !sim.isVisible({ x: z.x, z: z.z })) continue;
      seen.add(z.id);
      let mark = this.marks.get(z.id);
      if (!mark) this.marks.set(z.id, (mark = this.createMark(z)));
      const u = mark.material.uniforms;
      u.uProgress.value = Math.min(1, Math.max(0, (sim.time - z.from) / Math.max(0.05, z.at - z.from)));
      u.uFire.value = sim.time >= z.at - 1e-6 ? 1 : 0;
      u.uTime.value = (u.uTime.value + dt) % 600;
      u.uEdge.value = edge;
    }
    for (const [id, mark] of this.marks) if (!seen.has(id)) { this.view.scene.remove(mark); mark.geometry.dispose(); mark.material.dispose(); this.marks.delete(id); }
  }
  createMark(z) {
    const pad = 1.5, circle = z.shape === "circle";
    // The mark's local box: x across, y along the heading (circles: centred on the zone).
    const half = circle ? z.radius + pad : z.shape === "cone" ? z.length * Math.tan(z.half) + pad : z.width / 2 + pad;
    const box = circle ? [-half, -half, half, half] : [-half, -pad, half, z.length + pad];
    const geometry = new THREE.PlaneGeometry(box[2] - box[0], box[3] - box[1]);
    geometry.translate((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, 0);
    const material = new THREE.ShaderMaterial({
      vertexShader: ZONE_VERTEX, fragmentShader: ZONE_FRAGMENT, transparent: true, depthWrite: false,
      uniforms: { uBox: { value: new THREE.Vector4(...box) }, uShape: { value: SHAPES[z.shape] ?? 0 }, uRadius: { value: z.radius || 0 }, uLength: { value: z.length || 1 },
        uHalf: { value: z.half ? Math.tan(z.half) : 0 }, uWidth: { value: (z.width || 0) / 2 }, uProgress: { value: 0 }, uFire: { value: 0 }, uTime: { value: 0 }, uEdge: { value: 0.3 },
        uColor: { value: new THREE.Color(0xff4a2e) }, uHot: { value: new THREE.Color(0xffd36a) } },
    });
    const mark = new THREE.Mesh(geometry, material);
    mark.name = "boss-zone";
    mark.renderOrder = 3;
    // Lying on the ground, local +y along the zone's heading (sim angle: atan2(dx, dz)).
    mark.rotation.order = "YXZ";
    mark.rotation.set(-Math.PI / 2, z.angle + Math.PI, 0);
    if (circle) mark.rotation.y = 0;
    mark.position.set(z.x, this.view.terrain.heightAt(z.x, z.z) + 0.09, z.z);
    this.view.scene.add(mark);
    return mark;
  }
  reset() {
    for (const mark of this.marks.values()) { this.view.scene.remove(mark); mark.geometry.dispose(); mark.material.dispose(); }
    this.marks.clear();
    if (this.shield) {
      for (const mesh of [this.shield.bubble, this.shield.tethers]) { this.view.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
      this.shield = null;
    }
  }
}
