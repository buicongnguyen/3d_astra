// Frontier Defence, the battlefield view: the pads (one instanced mesh), the build-spot marker on every
// empty pad (a brass ring and a tower glyph, one more instanced mesh; 2026-11-24), the build zones, crews
// on their towers (dressEntity), bridges / pontoons / fuse lights, and the range ring.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TIER_TINT, RANK_TINT, HERO_TINT, HERO_RANK_TINT, HERO_BRANCH_TINT, PAD_COLOR, MARK_COLOR, MARK_GLOW, TIER_PAD, PICK_RADIUS, TOUCH_PICK_RADIUS, ZONE_COLOR, ZONE_PADS, BRIDGE_RADIUS, PONTOON_LENGTH } from "./constants.js";
import { GUIDE_PAD } from "./constants.js";

export function createPadsView(c) {
  const { S, A, Z, root, ui, key, motionOff } = c;
  const color = new THREE.Color(), m4 = new THREE.Matrix4();
  const { GARRISONS, CROSSINGS, $ } = c.deps;
  // Called across modules: bound when every module exists.
  const zoneWhy = (...a) => c.zoneWhy(...a);
  // ---------------------------------------------------------------- Pads
  // Every pad of the match: the level's, then those built in its zones (0.23).
  const allPads = () => [...S.sim.missionDef.defence.pads, ...(S.sim.defence?.zonePads || [])];
  // The marker: a flat brass ring just inside the pad's rim and a small tower glyph in the middle,
  // merged into one geometry (about 200 triangles) so every empty pad is one instance of one draw.
  function markerGeometry() {
    const parts = [
      new THREE.RingGeometry(1.38, 1.95, 6, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 6).translate(0, 0.215, 0),
      new THREE.CylinderGeometry(0.4, 0.52, 1.0, 8).translate(0, 0.7, 0),
      new THREE.CylinderGeometry(0.62, 0.56, 0.18, 8).translate(0, 1.29, 0),
    ];
    for (let i = 0; i < 4; i++) parts.push(new THREE.BoxGeometry(0.26, 0.26, 0.26).translate(Math.cos((i * Math.PI) / 2) * 0.44, 1.5, Math.sin((i * Math.PI) / 2) * 0.44));
    const geometry = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    return geometry;
  }
  function buildPads() {
    const def = S.sim.missionDef.defence, view = S.view;
    // Kept while it is the same match, view and terrain, and still in the scene (2026-11-24: a scene
    // swap under the pads would otherwise leave them built but never drawn).
    if (ui.pads?.def === def && ui.pads.view === view && ui.pads.terrain === view.terrain && ui.pads.mesh.parent === view.scene) return;
    disposePads();
    const geometry = new THREE.CylinderGeometry(2.05, 2.25, 0.2, 6).translate(0, 0.1, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.08, name: "DefencePad" });
    // Room for the zone pads too: one instanced mesh whatever is built.
    const room = (def.zones || []).reduce((n, z) => n + (z.max ?? ZONE_PADS), 0);
    const mesh = new THREE.InstancedMesh(geometry, material, def.pads.length + room);
    mesh.name = "defence-pads";
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    // The pads spread over the whole map: culling them as one sphere saves nothing, and a sphere
    // computed before a zone pad is added would hide that pad.
    mesh.frustumCulled = false;
    view.scene.add(mesh);
    const mark = new THREE.InstancedMesh(markerGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.35, emissive: 0xb07a1c, emissiveIntensity: MARK_GLOW.base, name: "DefencePadMark" }), def.pads.length + room);
    mark.name = "defence-pad-marks";
    mark.castShadow = false;
    mark.receiveShadow = false;
    mark.frustumCulled = false;
    mark.count = 0;
    view.scene.add(mark);
    ui.pads = { def, view, terrain: view.terrain, mesh, mark, key: "", layout: "", crewed: false, hover: null, hx: NaN, hy: NaN, zones: def.zones?.length ? zonePaint(def, view) : null };
    placePads();
  }
  // Pad positions, again whenever a zone pad comes or goes.
  function placePads() {
    const list = allPads(), layout = list.map((p) => p.id).join(",");
    if (ui.pads.layout === layout) return;
    ui.pads.layout = layout;
    ui.pads.key = "";
    const mesh = ui.pads.mesh;
    list.slice(0, mesh.instanceMatrix.count).forEach((p, i) => {
      m4.makeRotationY(Math.PI / 6).setPosition(p.x, ui.pads.terrain.heightAt(p.x, p.z) + 0.02, p.z);
      mesh.setMatrixAt(i, m4);
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
    for (const mesh of [ui.pads.mesh, ui.pads.mark]) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    }
    if (ui.pads.zones) { ui.pads.zones.removeFromParent(); ui.pads.zones.geometry.dispose(); ui.pads.zones.material.dispose(); }
    ui.pads = null;
  }
  // PC: the empty pad under the mouse, found again only when the mouse or the camera has moved.
  function hoverPad() {
    const pt = S.pointer, pads = ui.pads, v = S.view;
    if (S.touchInput || !pt?.inside || S.mode || !Z.started) return null;
    const cam = v.focus.x * 7 + v.focus.z * 13 + v.zoom * 17 + (v.yaw || 0);
    if (pt.x !== pads.hx || pt.y !== pads.hy || cam !== pads.hcam) {
      pads.hx = pt.x; pads.hy = pt.y; pads.hcam = cam;
      const p = nearestPad(pt.x, pt.y);
      pads.hover = p && !S.sim.towerOn(p.id) ? p.id : null;
    }
    return pads.hover;
  }
  function paintPads() {
    if (!ui.pads) return;
    placePads();
    const pads = ui.pads, glow = c.guidePad?.() ?? null, hover = hoverPad();
    const list = allPads().slice(0, pads.mesh.count), tiers = list.map((p) => S.sim.towerOn(p.id)?.tier || 0);
    // The marker pulses until the first pad of the match is crewed (then stays steady), never under reduced motion.
    if (!pads.crewed && tiers.some(Boolean)) pads.crewed = true;
    const pulse = !pads.crewed && !motionOff();
    pads.mark.material.emissiveIntensity = pulse ? MARK_GLOW.base + MARK_GLOW.pulse * (0.5 + 0.5 * Math.sin(performance.now() * MARK_GLOW.speed)) : MARK_GLOW.base;
    const key = `${S.defencePad}:${tiers.join("")}:${glow}:${hover}:${pads.layout}`;
    if (pads.key === key) return;
    pads.key = key;
    // R3-E: the guide's pad glows until it is picked.
    list.forEach((p, i) => pads.mesh.setColorAt(i, color.setRGB(...(p.id === S.defencePad ? PAD_COLOR.picked : tiers[i] ? TIER_PAD[tiers[i]] : p.id === glow ? GUIDE_PAD : p.id === hover ? PAD_COLOR.hover : PAD_COLOR[p.high || "ground"]))));
    pads.mesh.instanceColor.needsUpdate = true;
    // The build-spot marker on every empty pad; a crewed pad shows its tower instead.
    let n = 0;
    list.forEach((p, i) => {
      if (tiers[i]) return;
      pads.mesh.getMatrixAt(i, m4);
      pads.mark.setMatrixAt(n, m4);
      pads.mark.setColorAt(n, color.setRGB(...(p.id === S.defencePad ? MARK_COLOR.picked : p.id === glow ? MARK_COLOR.guide : p.id === hover ? MARK_COLOR.hover : MARK_COLOR.idle)));
      n++;
    });
    pads.mark.count = n;
    pads.mark.instanceMatrix.needsUpdate = true;
    if (pads.mark.instanceColor) pads.mark.instanceColor.needsUpdate = true;
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
  // The empty pad to crew first ("Crew a pad", 2026-11-24): the guide's pad while the guide runs; else,
  // on the roads the next wave walks, every free pad's reach (the first crew's tier-1 range, plus the
  // high-ground bonus) is laid over the road, sampled every metre from the spawn. Among the pads that
  // cover at least 80% of the best one's road, the one that reaches the road earliest wins: it meets
  // the column at its first contested stretch. Deep pads only when no other pad is free.
  function bestPad() {
    const sim = S.sim, def = sim.missionDef.defence;
    const guide = ui.guide?.pad ? sim.padById(ui.guide.pad) : null;
    if (guide && !sim.towerOn(guide.id)) return guide;
    const free = allPads().filter((p) => !sim.towerOn(p.id));
    const pool = free.some((p) => p.high !== "deep") ? free.filter((p) => p.high !== "deep") : free;
    if (!pool.length) return null;
    if (ui.padRoad?.def !== def) {
      const samples = {};
      for (const [id, pts] of Object.entries(def.routes)) {
        const out = [];
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z)));
          for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
        }
        samples[id] = out;
      }
      ui.padRoad = { def, samples };
    }
    const wave = sim.defenceWave?.(sim.defence.wave), wanted = new Set((wave?.groups || []).map((g) => g.route).filter((id) => ui.padRoad.samples[id]));
    const roads = wanted.size ? [...wanted] : Object.keys(ui.padRoad.samples);
    const crew = def.crews.includes("ranger") ? "ranger" : def.crews[0], range = sim.garrisonStats(crew, 1).range + 0.5;
    const plateaus = sim.terrain.plateaus.length > 0;
    const rows = pool.map((p) => {
      const reach = range + (plateaus && sim.terrain.level(p.x, p.z) ? 2 : 0);
      let covered = 0, first = Infinity;
      for (const id of roads) ui.padRoad.samples[id].forEach((q, i) => { if (Math.hypot(q.x - p.x, q.z - p.z) <= reach) { covered++; if (i < first) first = i; } });
      return { p, covered, first };
    });
    const top = Math.max(...rows.map((r) => r.covered));
    if (!top) return rows[0].p;
    return rows.filter((r) => r.covered >= top * 0.8).sort((a, b) => a.first - b.first || b.covered - a.covered)[0].p;
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
      // Commander ranks: brighter gold per rank, the branch's colour at Rank 4 and 5 (tints only).
      const level = e.heroRank || 1, tint = (e.heroBranch && HERO_BRANCH_TINT[e.heroBranch]?.[Math.max(0, level - 4)]) || HERO_RANK_TINT[level] || HERO_TINT;
      u.model.traverse((part) => { if (part.isMesh) part.userData.tint = tint; });
      if (u.flashParts) { u.flashBase = u.flashParts.map(() => tint); if (u.flashLit) for (const part of u.flashParts) part.userData.tint = u.flashTint; }
      u.dressed = `hero${e.heroRank || ""}${e.heroBranch || ""}`; // as view.js dressKey
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
  // Is any pad still empty (cheap: the sheet asks every frame).
  const freePad = () => allPads().some((p) => !S.sim.towerOn(p.id));
  Object.assign(c, { bestPad, freePad, buildPads, placePads, zonePaint, disposePads, paintPads, nearestPad, nearestBridge, disposeCrossings, pontoonMesh, fuseMesh, syncCrossings, hideRing, rangeRing });
}
