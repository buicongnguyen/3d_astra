// Frontier Defence, the battlefield view: the pads (one instanced mesh), the build zones, crews on
// their towers (dressEntity), bridges / pontoons / fuse lights, and the range ring.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TIER_TINT, RANK_TINT, HERO_TINT, PAD_COLOR, TIER_PAD, PICK_RADIUS, TOUCH_PICK_RADIUS, ZONE_COLOR, ZONE_PADS, BRIDGE_RADIUS, PONTOON_LENGTH } from "./constants.js";
import { GUIDE_PAD } from "./constants.js";

export function createPadsView(c) {
  const { S, A, Z, root, ui, key, motionOff } = c;
  const color = new THREE.Color();
  const { GARRISONS, CROSSINGS, $ } = c.deps;
  // Called across modules: bound when every module exists.
  const zoneWhy = (...a) => c.zoneWhy(...a);
  // ---------------------------------------------------------------- Pads
  // Every pad of the match: the level's, then those built in its zones (0.23).
  const allPads = () => [...S.sim.missionDef.defence.pads, ...(S.sim.defence?.zonePads || [])];
  function buildPads() {
    const def = S.sim.missionDef.defence, view = S.view;
    if (ui.pads?.def === def && ui.pads.view === view && ui.pads.terrain === view.terrain) return;
    disposePads();
    const geometry = new THREE.CylinderGeometry(2.05, 2.25, 0.2, 6).translate(0, 0.1, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.08, name: "DefencePad" });
    // Room for the zone pads too: one instanced mesh whatever is built.
    const room = (def.zones || []).reduce((n, z) => n + (z.max ?? ZONE_PADS), 0);
    const mesh = new THREE.InstancedMesh(geometry, material, def.pads.length + room);
    mesh.name = "defence-pads";
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    view.scene.add(mesh);
    ui.pads = { def, view, terrain: view.terrain, mesh, key: "", layout: "", zones: def.zones?.length ? zonePaint(def, view) : null };
    placePads();
  }
  // Pad positions, again whenever a zone pad comes or goes.
  function placePads() {
    const list = allPads(), layout = list.map((p) => p.id).join(",");
    if (ui.pads.layout === layout) return;
    ui.pads.layout = layout;
    ui.pads.key = "";
    const m = new THREE.Matrix4(), mesh = ui.pads.mesh;
    list.slice(0, mesh.instanceMatrix.count).forEach((p, i) => {
      m.makeRotationY(Math.PI / 6).setPosition(p.x, ui.pads.terrain.heightAt(p.x, p.z) + 0.02, p.z);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.setRGB(...PAD_COLOR[p.high || "ground"]));
    });
    mesh.count = Math.min(list.length, mesh.instanceMatrix.count);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }
  // Build zones (0.23): every open cell of every zone as one flat quad, all merged into one mesh
  // with one flat translucent material (one draw), laid just over the ground paint.
  function zonePaint(def, view) {
    const sim = S.sim, t = view.terrain, positions = [], index = [], s = 0.86;
    for (let z = -t.half + 1; z < t.half; z += 2)
      for (let x = -t.half + 1; x < t.half; x += 2) {
        if (!sim.zoneAt(x, z) || sim.zoneGround(x, z)) continue;
        const y = t.heightAt(x, z) + 0.05, n = positions.length / 3;
        positions.push(x - s, y, z - s, x + s, y, z - s, x + s, y, z + s, x - s, y, z + s);
        index.push(n, n + 2, n + 1, n, n + 3, n + 2);
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(index);
    const material = new THREE.MeshBasicMaterial({ color: ZONE_COLOR, transparent: true, opacity: 0.2, depthWrite: false, name: "DefenceZone" });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "defence-zones";
    mesh.renderOrder = 1;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    view.scene.add(mesh);
    return mesh;
  }
  function disposePads() {
    disposeCrossings();
    if (!ui.pads) return;
    ui.pads.mesh.removeFromParent();
    ui.pads.mesh.geometry.dispose();
    ui.pads.mesh.material.dispose();
    ui.pads.mesh.dispose();
    if (ui.pads.zones) { ui.pads.zones.removeFromParent(); ui.pads.zones.geometry.dispose(); ui.pads.zones.material.dispose(); }
    ui.pads = null;
  }
  function paintPads() {
    if (!ui.pads) return;
    placePads();
    const glow = c.guidePad?.() ?? null;
    const list = allPads().slice(0, ui.pads.mesh.count), tiers = list.map((p) => S.sim.towerOn(p.id)?.tier || 0), key = `${S.defencePad}:${tiers.join("")}:${glow}`;
    if (ui.pads.key === key) return;
    ui.pads.key = key;
    // R3-E: the guide's pad glows until it is picked.
    list.forEach((p, i) => ui.pads.mesh.setColorAt(i, color.setRGB(...(p.id === S.defencePad ? PAD_COLOR.picked : tiers[i] ? TIER_PAD[tiers[i]] : p.id === glow ? GUIDE_PAD : PAD_COLOR[p.high || "ground"]))));
    ui.pads.mesh.instanceColor.needsUpdate = true;
  }
  function nearestPad(x, y) {
    const rect = S.view.renderer.domElement.getBoundingClientRect();
    // A finger is wider than a mouse pointer: touch takes the nearest pad a little further out (still the nearest one).
    let best = null, bestD = S.touchInput ? TOUCH_PICK_RADIUS : PICK_RADIUS;
    for (const p of allPads()) {
      const s = S.view.project(p.x, p.z, S.view.terrain.heightAt(p.x, p.z) + 0.2);
      const d = Math.hypot(s.x + rect.left - x, s.y + rect.top - y);
      if (d <= bestD) { best = p; bestD = d; }
    }
    return best;
  }
  // A bridge the player may blow (defence.bridges), by its middle on screen or the spot tapped.
  function nearestBridge(x, y, point) {
    if (!S.sim.missionDef.defence.bridges || !S.sim.terrain.river) return null;
    const rect = S.view.renderer.domElement.getBoundingClientRect();
    for (const c of CROSSINGS) {
      if (c.type !== "bridge") continue;
      const s = S.view.project(c.x, 0, 0.4);
      if (Math.hypot(s.x + rect.left - x, s.y + rect.top - y) <= BRIDGE_RADIUS || (point && Math.abs(point.x - c.x) < c.half && Math.abs(point.z) < 4)) return c.x;
    }
    return null;
  }

  // ---------------------------------------------------------------- Crews on towers, the commander
  // Called by the view whenever a crewed tower is new or changed tier or branch, and for the
  // commander (view.js update(), dressKey).
  S.view.dressEntity = function dress(o, e) {
    const u = o.userData;
    if (e.hero) {
      u.model.traverse((part) => { if (part.isMesh) part.userData.tint = HERO_TINT; });
      if (u.flashParts) { u.flashBase = u.flashParts.map(() => HERO_TINT); if (u.flashLit) for (const part of u.flashParts) part.userData.tint = u.flashTint; }
      u.dressed = "hero";
      return;
    }
    const type = S.sim.crewType(e.crew, e.team), template = this.teamTemplates.get(`${type}-${e.team}`);
    if (!template) return;
    if (!u.crew) {
      ui.towerTop ??= new THREE.Box3().setFromObject(this.teamTemplates.get(`tower-${e.team}`) || u.model).max.y;
      const crew = template.clone(true);
      // The crew stands on the tower's platform in place of its own gun.
      crew.position.y = ui.towerTop * 0.56;
      crew.scale.setScalar(1.15);
      o.add(crew);
      u.crew = crew;
      if (u.barrel) u.barrel.visible = false;
    }
    const tint = (e.branchRank && RANK_TINT[e.branchRank]) || TIER_TINT[e.tier] || TIER_TINT[1];
    u.model.traverse((part) => { if (part.isMesh) part.userData.tint = tint; });
    // The hit flash restores what it found; it must find the new trim.
    if (u.flashParts) { u.flashBase = u.flashParts.map(() => tint); if (u.flashLit) for (const part of u.flashParts) part.userData.tint = u.flashTint; }
    u.dressed = e.branch ? `${e.tier}${e.branch}${e.branchRank || ""}` : e.tier;
  };
  // ---------------------------------------------------------------- Bridges, pontoons, fuses
  function disposeCrossings() {
    if (!ui.cross) return;
    for (const m of [...ui.cross.pontoons.values(), ...ui.cross.fuses.values()]) m.removeFromParent();
    ui.cross.plank?.dispose();
    ui.cross.wood?.dispose();
    ui.cross.light?.dispose();
    ui.cross.bulb?.dispose();
    for (const b of ui.cross.env?.bridges?.values() || []) b.visible = true;
    ui.cross = null;
  }
  function pontoonMesh() {
    if (!ui.cross.plank) {
      const parts = [];
      for (let i = 0; i < 12; i++) parts.push(new THREE.BoxGeometry(6.2, 0.12, 0.62).translate(((i * 7) % 3 - 1) * 0.12, 0.06, 0.38 + i * 0.75));
      // Two floats under the planks.
      for (const side of [-1, 1]) parts.push(new THREE.CylinderGeometry(0.28, 0.28, PONTOON_LENGTH, 6).rotateX(Math.PI / 2).translate(side * 2.3, -0.08, PONTOON_LENGTH / 2));
      ui.cross.plank = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      ui.cross.wood = new THREE.MeshStandardMaterial({ color: 0x8c6a44, roughness: 0.9, metalness: 0, name: "DefencePontoon" });
    }
    const mesh = new THREE.Mesh(ui.cross.plank, ui.cross.wood);
    mesh.name = "defence-pontoon";
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return mesh;
  }
  function fuseMesh() {
    ui.cross.bulb ??= new THREE.SphereGeometry(0.45, 10, 8);
    ui.cross.light ??= new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.95, name: "DefenceFuse" });
    const mesh = new THREE.Mesh(ui.cross.bulb, ui.cross.light);
    mesh.name = "defence-fuse";
    return mesh;
  }
  // Brings the bridges, pontoons and fuse lights in line with sim.crossings.
  function syncCrossings() {
    const sim = S.sim, env = S.view.environment, cs = sim.crossings;
    if (!cs && !ui.cross) return;
    if (ui.cross && (ui.cross.env !== env || ui.cross.scene !== S.view.scene)) disposeCrossings();
    ui.cross ??= { env, scene: S.view.scene, pontoons: new Map(), fuses: new Map(), key: "" };
    let lit = false;
    const states = Object.entries(cs || {}).map(([x, c]) => { if (c.state === "fuse") lit = true; return `${x}:${c.state}:${c.state === "blown" ? Math.floor(c.progress * 4) : 0}`; }).join("|");
    // A lit fuse blinks at the interface's pace (steady under motion-off).
    const blink = lit && !motionOff() ? Math.floor(performance.now() / 260) % 2 : 0;
    const k = `${states}#${blink}`;
    if (k === ui.cross.key) return;
    ui.cross.key = k;
    for (const c of CROSSINGS) {
      if (c.type !== "bridge") continue;
      const state = cs?.[c.x]?.state || "open", progress = cs?.[c.x]?.progress || 0;
      const bridge = env?.bridges?.get(c.x);
      if (bridge) bridge.visible = state === "open" || state === "fuse";
      let pontoon = ui.cross.pontoons.get(c.x);
      const built = state === "pontoon" ? 1 : state === "blown" ? Math.min(1, progress / GARRISONS.demolish.pontoon) : 0;
      if (built > 0 && !pontoon) { pontoon = pontoonMesh(); ui.cross.pontoons.set(c.x, pontoon); S.view.scene.add(pontoon); }
      if (pontoon) {
        pontoon.visible = built > 0;
        pontoon.scale.set(1, 1, Math.max(0.05, built));
        pontoon.position.set(c.x, -0.02, -PONTOON_LENGTH / 2);
      }
      let fuse = ui.cross.fuses.get(c.x);
      if (state === "fuse" && !fuse) { fuse = fuseMesh(); ui.cross.fuses.set(c.x, fuse); S.view.scene.add(fuse); }
      if (fuse) {
        fuse.visible = state === "fuse";
        fuse.position.set(c.x, 1.3, 0);
        fuse.scale.setScalar(blink ? 1.35 : 1);
      }
    }
  }
  // Range of the picked tower (or of a Ranger nest on the picked pad), on the existing preview disc.
  // The build preview of the other modes is borrowed: its look is put back when the ring goes.
  function hideRing() {
    if (!ui.ring) return;
    const preview = S.view.preview;
    preview.visible = false;
    preview.scale.set(1, 1, 1);
    preview.material.opacity = ui.ring.opacity;
    preview.material.color.setHex(ui.ring.color);
    ui.ring = null;
  }
  function rangeRing(es) {
    const t = es.length === 1 && es[0].crew ? es[0] : null, pad = !t && S.defencePad ? S.sim.padById(S.defencePad) : null, spot = !t && !pad && !es.length ? S.defenceSpot : null, at = t || pad || spot;
    const preview = S.view.preview;
    if (!at || S.mode) { hideRing(); return; }
    ui.ring ||= { opacity: preview.material.opacity, color: preview.material.color.getHex() };
    const reach = (t ? t.range : S.sim.garrisonStats("ranger", 1).range) + (S.view.terrain.level(at.x, at.z) ? 2 : 0);
    preview.visible = true;
    preview.position.set(at.x, S.view.terrain.heightAt(at.x, at.z) + 0.12, at.z);
    preview.scale.set(reach, 1, reach);
    // A zone spot the rules refuse shows its ring in red (0.23).
    preview.material.color.setHex(spot && zoneWhy(spot) ? 0xef7660 : 0x92ebc5);
    preview.material.opacity = 0.14;
  }
  Object.assign(c, { buildPads, placePads, zonePaint, disposePads, paintPads, nearestPad, nearestBridge, disposeCrossings, pontoonMesh, fuseMesh, syncCrossings, hideRing, rangeRing });
}
