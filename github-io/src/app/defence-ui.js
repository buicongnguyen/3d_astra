// Frontier Defence match interface, imported on first use (app/defence-entry.js):
//  - the pads, drawn as one instanced mesh, coloured by kind (ground, rim, deep) and by selection;
//  - crews standing on their towers (clones of the unit templates, drawn by the same instanced
//    batches as the army) with tier trims through the per-instance tint; the commander in gold;
//  - the pad sheet (crews with portraits and costs), the tower sheet (Upgrade, Sell, and at tier 3
//    the two branches), the commander sheet (Barrage, Reinforce) and the bridge sheet (Blow
//    bridge) in the command card; lives, wave and countdown chips, Commander, Call wave and
//    Overview on the battlefield;
//  - blown bridges hidden, pontoons (one merged mesh each) and the fuse light;
//  - the wave intel strip beside the bar (0.22): the next wave's units with counts (a carrier with
//    its passengers) and its roads, while it can still be called; the "+N" of a carrier lost with
//    its squad aboard;
//  - the result screen with stars (or waves held, in Endless and the Daily seed), and progress.
// The rules are in src/sim/defence.js; this module only reads the match and sends commands.
// Everything it needs from the always-loaded app arrives as `deps` (app/defence-entry.js): a
// shared import would make the bundler split those modules, and their CSS, into a new chunk.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import "../defence-ui.css";
import { TRAITS, waveTraits, traitsOf, counterCrews, waveTypes } from "../defence/traits.js";

// Tier trims multiply the tower's paint (never a material swap: the batches stay as they are).
export const TIER_TINT = { 1: [1.08, 0.94, 0.8], 2: [0.92, 0.99, 1.1], 3: [1.25, 1.1, 0.62] };
// Branch ranks (0.24): the gold trim, brighter per rank.
export const RANK_TINT = { 1: [1.34, 1.18, 0.7], 2: [1.45, 1.3, 0.86] };
export const TIER_NAMES = { 1: "bronze", 2: "steel", 3: "gold" };
// The commander's gold trim, on every part of its model.
export const HERO_TINT = [1.9, 1.38, 0.34];
// Pad colours: plain ground, rim (seen from the road), deep (hidden from it), and the picked pad.
const PAD_COLOR = { ground: [0.86, 0.8, 0.66], rim: [1.0, 0.56, 0.2], deep: [0.4, 0.55, 1.05], picked: [1.6, 1.42, 0.62] };
// A crewed pad shows its garrison's tier around the tower's foot: bronze, steel, gold.
const TIER_PAD = { 1: [0.8, 0.46, 0.22], 2: [0.72, 0.84, 0.95], 3: [1.5, 1.08, 0.2] };
// Short crew names for the tiles (the full garrison name is in garrisons.json).
const CREW_LABEL = { ranger: "Rangers", breaker: "Mortar", antitank: "Anti-tank", watcher: "Watcher", tank: "Tank post", scorcher: "Flame trap" };
const CREW_ROLE = {
  ranger: "Single target, long reach. Strong against siege machines.",
  breaker: "Shells burst on groups. Best against swarms on foot.",
  antitank: "Rockets that pierce armour. Best against tanks and other machines.",
  watcher: "Long sight. Reveals hidden units further than any other tower.",
  tank: "Heavy single shots, slow to reload. Strong against machines.",
  scorcher: "Short range. Sets the road on fire: best against swarms on foot.",
};
// What each tier-3 branch does, in a line.
const BRANCH_TEXT = {
  marksman: "Much harder single shots, a little slower, 2 m more reach.",
  suppressor: "Every hit slows the target for a moment.",
  cluster: "Wider bursts that hit the crowd harder.",
  guided: "5 m more reach and a little more damage.",
  heavy: "Far heavier rockets, a little slower.",
  rapid: "Fires almost twice as fast.",
  beacon: "Marks every target it hits: it takes 25% more damage.",
  fareye: "Reveals hidden units much further, 3 m more reach.",
  breacher: "Heavier shells, even stronger against machines.",
  shrapnel: "Shells burst on everyone close to the target.",
  inferno: "The road burns much hotter.",
  firewall: "Wider fires that burn longer.",
};
// What each branch rank adds (0.24), in a line: [rank 1, rank 2].
const RANK_TEXT = {
  marksman: ["Harder shots that pass half of a shield.", "Shots pass every shield and bite into armour; 1 m more reach."],
  suppressor: ["A stronger, longer slow.", "The slow also falls on everyone near the target; more damage."],
  cluster: ["Wider bursts.", "Wider still, and the blast hits the crowd almost as hard as the target."],
  guided: ["2 m more reach; marks the target: it takes 15% more damage.", "2 m more reach, more damage, a stronger and longer mark."],
  heavy: ["Rockets that hit machines harder.", "Harder still against machines, and more damage."],
  rapid: ["Fires in bursts of two.", "Bursts of three, a little more damage."],
  beacon: ["A stronger mark (35%) that lasts longer.", "The mark spreads to everyone near the target; more damage."],
  fareye: ["Sees 6 m further, 1 m more reach.", "Harder shots that pass half of a shield; 1 m more reach."],
  breacher: ["Thicker armour, harder against machines.", "Thicker armour again, more damage."],
  shrapnel: ["Bursts reach 1 m further; thicker armour.", "Bursts hit harder; thicker armour."],
  inferno: ["The road burns hotter; thicker armour.", "Hotter fires that last longer; thicker armour."],
  firewall: ["Fires 1 m wider; thicker armour.", "Fires that last longer, laid more often; thicker armour."],
};
// Armour squad upgrades (0.24): Rank 2, then one branch.
const ARMOUR_TEXT = {
  rank2: "Rank 2: thicker armour, a little more damage, and the tanks mend between fights.",
  assault: "Assault: harder, faster guns, strong against machines and carriers; chases further.",
  bulwark: "Bulwark: much thicker armour and faster mending: holds the road far longer.",
};
const PAD_NOTE = {
  ground: "Ground pad",
  rim: "Rim pad: 2 m more reach and harder hits, but the road can see it.",
  deep: "Deep pad: hidden from the road, but further from it.",
};
// Wave intel (0.22): the road a wave group walks, by route id (other ids show as they are).
const ROUTE_LABEL = { main: "Road", west: "West bridge", ford: "Ford", east: "East bridge" };
const FLOAT_SECONDS = 1.6; // the "+N" over a carrier lost with its squad
const PICK_RADIUS = 26; // px: the nearest pad within this distance of a tap is picked
// Build zones (0.23): the flat paint of their open cells, and the pads a zone without `max` keeps room for.
const ZONE_COLOR = 0xa8f0c0, ZONE_PADS = 6;
// ms after a battlefield tap during which a click at the same spot on the command card is its ghost.
const GHOST_MS = 600;
const ZONE_NAME = { basin: "Basin field", westfield: "West field", eastfield: "East field", southfield: "South field" };
const BRIDGE_RADIUS = 44; // px: a tap this close to a bridge's middle picks it
// Pontoon planks: one merged mesh per pontoon, grown from the north bank while it is built.
const PONTOON_LENGTH = 9;
// W1-F: the view button's three states, the aim modes, the phone zoom and how long a manual pan holds the follow camera.
const VIEWS = ["follow", "overview", "free"];
const VIEW_ICON = { follow: "crosshair", overview: "expand", free: "move" };
const VIEW_TITLE = { follow: "View: following the wave. Tap for the whole valley.", overview: "View: the whole valley. Tap to move the camera yourself.", free: "View: free camera. Tap to follow the wave." };
const AIM_LABEL = { near: "Nearest", first: "First", strong: "Strongest", air: "Air" };
const AIM_TEXT = { near: "Shoots the nearest enemy.", first: "Shoots the enemy closest to the exit.", strong: "Shoots the enemy with the most health.", air: "Shoots flyers first." };
const PHONE_ZOOM = 55, FOLLOW_HOLD_MS = 6000, CARD_MS = 6000;

export function createDefenceUI(S, A, deps) {
  const { loadDefence: loadProgress, saveDefence: saveProgress } = deps;
  // The same two helpers as defence/progress.js (hasSeen, recordSeen); importing that module here would split a shared chunk out of the main bundle (see the note above the deps).
  const hasSeen = (p, type) => (p.seen || []).includes(type);
  const recordSeen = (p, types) => { const fresh = types.filter((t) => D[t] && !hasSeen(p, t)); return fresh.length ? { ...p, seen: [...(p.seen || []), ...fresh] } : p; };
  const { $, GARRISONS, starsFor, D, hasPortrait, portrait, icon, ACTION_KEYS, DEFENCE_LEVELS, loadDefence, recordDefence, saveDefence, statTile, formatClock, DIFFICULTY_LABELS, FACTIONS, CROSSINGS, recordScore, bestScore, dayKey } = deps;
  const Z = S.screen, root = document.documentElement;
  let viewMode = "free", saved = null, follow = { set: false, pauseUntil: 0, x: 0, z: 0, zoom: 0 }, cardQueue = [], cardEl = null, cardAt = 0, cardWave = -1, pads = null, bar = null, intel = null, intelKey = "", seen = null, overview = false, leakAt = -Infinity, affordable = false, burstTier = 0, aim = null;
  const color = new THREE.Color();
  const key = (i) => ACTION_KEYS[i] || "";
  const kbd = (k) => (k ? `<kbd class="action-key">${k}</kbd>` : "");
  const motionOff = () => root.classList.contains("motion-off") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  S.defenceBridge ??= null;

  // ---------------------------------------------------------------- Pads
  // Every pad of the match: the level's, then those built in its zones (0.23).
  const allPads = () => [...S.sim.missionDef.defence.pads, ...(S.sim.defence?.zonePads || [])];
  function buildPads() {
    const def = S.sim.missionDef.defence, view = S.view;
    if (pads?.def === def && pads.view === view && pads.terrain === view.terrain) return;
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
    pads = { def, view, terrain: view.terrain, mesh, key: "", layout: "", zones: def.zones?.length ? zonePaint(def, view) : null };
    placePads();
  }
  // Pad positions, again whenever a zone pad comes or goes.
  function placePads() {
    const list = allPads(), layout = list.map((p) => p.id).join(",");
    if (pads.layout === layout) return;
    pads.layout = layout;
    pads.key = "";
    const m = new THREE.Matrix4(), mesh = pads.mesh;
    list.slice(0, mesh.instanceMatrix.count).forEach((p, i) => {
      m.makeRotationY(Math.PI / 6).setPosition(p.x, pads.terrain.heightAt(p.x, p.z) + 0.02, p.z);
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
    if (!pads) return;
    pads.mesh.removeFromParent();
    pads.mesh.geometry.dispose();
    pads.mesh.material.dispose();
    pads.mesh.dispose();
    if (pads.zones) { pads.zones.removeFromParent(); pads.zones.geometry.dispose(); pads.zones.material.dispose(); }
    pads = null;
  }
  function paintPads() {
    if (!pads) return;
    placePads();
    const list = allPads().slice(0, pads.mesh.count), tiers = list.map((p) => S.sim.towerOn(p.id)?.tier || 0), key = `${S.defencePad}:${tiers.join("")}`;
    if (pads.key === key) return;
    pads.key = key;
    list.forEach((p, i) => pads.mesh.setColorAt(i, color.setRGB(...(p.id === S.defencePad ? PAD_COLOR.picked : tiers[i] ? TIER_PAD[tiers[i]] : PAD_COLOR[p.high || "ground"]))));
    pads.mesh.instanceColor.needsUpdate = true;
  }
  function nearestPad(x, y) {
    const rect = S.view.renderer.domElement.getBoundingClientRect();
    let best = null, bestD = PICK_RADIUS;
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
  let towerTop = null;
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
      towerTop ??= new THREE.Box3().setFromObject(this.teamTemplates.get(`tower-${e.team}`) || u.model).max.y;
      const crew = template.clone(true);
      // The crew stands on the tower's platform in place of its own gun.
      crew.position.y = towerTop * 0.56;
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
  let cross = null;
  function disposeCrossings() {
    if (!cross) return;
    for (const m of [...cross.pontoons.values(), ...cross.fuses.values()]) m.removeFromParent();
    cross.plank?.dispose();
    cross.wood?.dispose();
    cross.light?.dispose();
    cross.bulb?.dispose();
    for (const b of cross.env?.bridges?.values() || []) b.visible = true;
    cross = null;
  }
  function pontoonMesh() {
    if (!cross.plank) {
      const parts = [];
      for (let i = 0; i < 12; i++) parts.push(new THREE.BoxGeometry(6.2, 0.12, 0.62).translate(((i * 7) % 3 - 1) * 0.12, 0.06, 0.38 + i * 0.75));
      // Two floats under the planks.
      for (const side of [-1, 1]) parts.push(new THREE.CylinderGeometry(0.28, 0.28, PONTOON_LENGTH, 6).rotateX(Math.PI / 2).translate(side * 2.3, -0.08, PONTOON_LENGTH / 2));
      cross.plank = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      cross.wood = new THREE.MeshStandardMaterial({ color: 0x8c6a44, roughness: 0.9, metalness: 0, name: "DefencePontoon" });
    }
    const mesh = new THREE.Mesh(cross.plank, cross.wood);
    mesh.name = "defence-pontoon";
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return mesh;
  }
  function fuseMesh() {
    cross.bulb ??= new THREE.SphereGeometry(0.45, 10, 8);
    cross.light ??= new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.95, name: "DefenceFuse" });
    const mesh = new THREE.Mesh(cross.bulb, cross.light);
    mesh.name = "defence-fuse";
    return mesh;
  }
  // Brings the bridges, pontoons and fuse lights in line with sim.crossings.
  function syncCrossings() {
    const sim = S.sim, env = S.view.environment, cs = sim.crossings;
    if (!cs && !cross) return;
    if (cross && (cross.env !== env || cross.scene !== S.view.scene)) disposeCrossings();
    cross ??= { env, scene: S.view.scene, pontoons: new Map(), fuses: new Map(), key: "" };
    let lit = false;
    const states = Object.entries(cs || {}).map(([x, c]) => { if (c.state === "fuse") lit = true; return `${x}:${c.state}:${c.state === "blown" ? Math.floor(c.progress * 4) : 0}`; }).join("|");
    // A lit fuse blinks at the interface's pace (steady under motion-off).
    const blink = lit && !motionOff() ? Math.floor(performance.now() / 260) % 2 : 0;
    const k = `${states}#${blink}`;
    if (k === cross.key) return;
    cross.key = k;
    for (const c of CROSSINGS) {
      if (c.type !== "bridge") continue;
      const state = cs?.[c.x]?.state || "open", progress = cs?.[c.x]?.progress || 0;
      const bridge = env?.bridges?.get(c.x);
      if (bridge) bridge.visible = state === "open" || state === "fuse";
      let pontoon = cross.pontoons.get(c.x);
      const built = state === "pontoon" ? 1 : state === "blown" ? Math.min(1, progress / GARRISONS.demolish.pontoon) : 0;
      if (built > 0 && !pontoon) { pontoon = pontoonMesh(); cross.pontoons.set(c.x, pontoon); S.view.scene.add(pontoon); }
      if (pontoon) {
        pontoon.visible = built > 0;
        pontoon.scale.set(1, 1, Math.max(0.05, built));
        pontoon.position.set(c.x, -0.02, -PONTOON_LENGTH / 2);
      }
      let fuse = cross.fuses.get(c.x);
      if (state === "fuse" && !fuse) { fuse = fuseMesh(); cross.fuses.set(c.x, fuse); S.view.scene.add(fuse); }
      if (fuse) {
        fuse.visible = state === "fuse";
        fuse.position.set(c.x, 1.3, 0);
        fuse.scale.setScalar(blink ? 1.35 : 1);
      }
    }
  }

  // ---------------------------------------------------------------- Battlefield bar
  function ensureBar() {
    if (bar?.isConnected) return bar;
    bar = document.createElement("div");
    bar.id = "defence-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Defence status");
    bar.innerHTML = `<span class="dchip lives" title="Lives: each enemy through costs one, a heavy machine two">${icon("shield")}<b id="defence-lives" translate="no">20</b></span>
      <span class="dchip wave" title="Wave"><span>Wave</span> <b id="defence-wave" translate="no">0/10</b><small id="defence-count" translate="no"></small></span>
      <button id="defence-hero" type="button" title="The commander: tap to pick, then tap the road to send it" aria-label="Field commander" hidden>${icon("flag")}<small id="defence-hero-state" translate="no"></small></button>
      <button id="defence-armour" type="button" title="Armour: tap to pick the next squad, or to buy one at the depot" aria-label="Armour squads" hidden>${icon("tank")}<small id="defence-armour-state" translate="no"></small></button>
      <button id="defence-call" type="button" title="Call the next wave now for bonus alloy" aria-label="Call wave">${icon("play")}<span>Call wave</span><small id="defence-bonus" translate="no"></small></button>
      <button id="defence-speed" type="button" aria-pressed="false" title="Fast-forward: tap to change the speed (Shift+Space)" aria-label="Game speed"><b id="defence-speed-label" translate="no">×1</b></button>
      <button id="defence-overview" type="button" aria-pressed="false" data-view="free" title="View: free camera. Tap to follow the wave." aria-label="View">${icon("move")}</button>`;
    $("stage").append(bar);
    $("defence-call").onclick = () => {
      if (!Z.started || Z.paused || S.sim.result) return;
      if (S.sim.command({ team: 0, type: "waveCall" })) { A.tone(660, 0.12); A.updateUI(); }
    };
    $("defence-speed").onclick = () => {
      if (!Z.started || Z.paused || S.sim.result) return;
      A.cycleSpeed();
      A.tone(560, 0.06);
      A.updateUI();
    };
    $("defence-overview").onclick = () => { setView(nextView()); A.notice(VIEW_NOTE[viewMode]); A.updateUI(); };
    $("defence-hero").onclick = () => {
      const hero = S.sim.commander();
      if (!hero || !Z.started || Z.paused) return;
      S.defencePad = null;
      S.defenceBridge = null;
      A.setSelection([hero.id]);
      S.view.focusOn(hero.x, hero.z);
      picked();
    };
    // Armour (0.23): each tap picks the next squad in the field (no tapping on small models), or
    // opens the depot when none is out.
    $("defence-armour").onclick = () => {
      if (!Z.started || Z.paused || S.sim.result || !S.sim.armourRules()) return;
      const squads = S.sim.armourSquads(), now = selectedSquad(A.selectedEntities());
      S.defencePad = null;
      S.defenceBridge = null;
      S.defenceSpot = null;
      if (!squads.length) { S.defenceDepot = true; A.setSelection([]); picked(); return; }
      const at = squads.findIndex((q) => q.squad === now), next = squads[(at + 1) % squads.length];
      S.defenceDepot = false;
      A.setSelection(next.units.map((e) => e.id));
      S.view.focusOn(next.units[0].x, next.units[0].z);
      picked();
    };
    return bar;
  }
  // The squad number when the selection is one armour squad (some or all of its tanks), else null.
  function selectedSquad(es) {
    return es.length && es.every((e) => e.squad && e.team === 0 && e.squad === es[0].squad) ? es[0].squad : null;
  }
  function setOverview(on) {
    const cam = S.sim.missionDef.defence.camera;
    overview = on;
    S.view.maxZoom = cam.maxZoom;
    S.view.zoom = on ? cam.maxZoom : cam.zoom;
    if (on) S.view.focusOn(cam.x, cam.z); else S.view.updateCamera();
    $("defence-overview")?.setAttribute("aria-pressed", String(on));
  }
  // The view button (W1-F): Follow -> Overview -> Free. A phone opens on Follow, a desktop on Free; a desktop skips Follow (its first tap is the Overview, as before).
  const phone = () => root.classList.contains("compact-ui");
  const VIEW_NOTE = { follow: "Following the wave.", overview: "Overview: the whole valley.", free: "Free camera." };
  function nextView() {
    const ring = phone() ? VIEWS : VIEWS.filter((v) => v !== "follow");
    return ring[(ring.indexOf(viewMode) + 1) % ring.length];
  }
  function setView(mode) {
    const cam = S.sim.missionDef.defence.camera, v = S.view;
    if (mode === "overview") { if (viewMode !== "overview") saved = { zoom: v.zoom, x: v.focus.x, z: v.focus.z }; setOverview(true); }
    else {
      if (viewMode === "overview") { overview = false; v.zoom = saved?.zoom ?? cam.zoom; if (saved) v.focusOn(saved.x, saved.z); v.updateCamera(); $("defence-overview")?.setAttribute("aria-pressed", "false"); }
      follow.pauseUntil = 0;
    }
    viewMode = mode;
    paintView();
  }
  function paintView() {
    const b = $("defence-overview");
    if (!b || b.dataset.view === viewMode) return;
    b.dataset.view = viewMode;
    b.innerHTML = icon(VIEW_ICON[viewMode]);
    b.title = VIEW_TITLE[viewMode];
    b.setAttribute("aria-pressed", String(viewMode === "overview"));
  }
  // Follow camera (per frame, from the frame loop): the front of the wave, eased; a manual pan or zoom holds it for 6 s.
  function frontOfWave() {
    const foes = S.sim.entities.filter((e) => e.team === 1 && e.kind === "unit" && e.hp > 0 && S.sim.isVisible(e, 0)).map((e) => ({ e, left: S.sim.roadLeft(e) })).sort((a, b) => a.left - b.left).slice(0, 3);
    if (foes.length) return { x: foes.reduce((n, f) => n + f.e.x, 0) / foes.length, z: foes.reduce((n, f) => n + f.e.z, 0) / foes.length };
    return null;
  }
  function frame(dt) {
    if (viewMode !== "follow" || !S.sim?.defence || !Z.started || Z.paused || S.sim.result || Z.modalType || !S.view) return;
    const v = S.view, now = performance.now();
    if (follow.set && (Math.abs(v.focus.x - follow.x) > 0.02 || Math.abs(v.focus.z - follow.z) > 0.02 || Math.abs(v.zoom - follow.zoom) > 0.01)) follow.pauseUntil = now + FOLLOW_HOLD_MS;
    const target = now < follow.pauseUntil ? null : frontOfWave();
    if (target) {
      const k = 1 - Math.exp(-dt * 2.5);
      v.focusOn(v.focus.x + (target.x - v.focus.x) * k, v.focus.z + (target.z - v.focus.z) * k);
    }
    Object.assign(follow, { x: v.focus.x, z: v.focus.z, zoom: v.zoom, set: true });
  }
  A.defenceFrame = frame;
  function updateBar() {
    const st = S.sim.defenceStatus();
    if (!st || !bar) return;
    set("defence-lives", String(st.lives));
    set("defence-wave", st.endless ? String(st.wave) : `${st.wave}/${st.waves}`);
    set("defence-count", st.countdown !== null ? formatClock(st.countdown) : st.active ? String(st.enemies) : "");
    const call = $("defence-call"), bonus = st.canCall ? Math.ceil((st.countdown ?? S.sim.missionDef.defence.gap ?? 16) * 2) : 0;
    call.disabled = !st.canCall || !Z.started || Z.paused;
    set("defence-bonus", st.canCall ? `+${bonus}` : "");
    updateIntel(st);
    const sp = A.getSpeed?.() ?? 1, speed = $("defence-speed");
    speed.disabled = !Z.started || Z.paused;
    speed.setAttribute("aria-pressed", String(sp > 1));
    set("defence-speed-label", `×${sp}`);
    paintView();
    // Bottom-band contract with W1-D: the bar's height plus its 8 px gap while it sits at the foot of a portrait phone.
    const foot = phone() && matchMedia("(orientation: portrait)").matches && !bar.hidden;
    if (foot) root.style.setProperty("--defence-bar-h", `${bar.offsetHeight + 8}px`); else root.style.removeProperty("--defence-bar-h");
    updateCard();
    bar.querySelector(".lives").classList.toggle("low", st.lives <= 5);
    // The commander: picked from the bar; while it is down, the seconds until it is back.
    const h = S.sim.defence.hero, heroButton = $("defence-hero");
    heroButton.hidden = !h;
    if (h) {
      const alive = !!S.sim.commander(), back = alive ? 0 : Math.max(0, Math.ceil(h.deadAt + GARRISONS.commander.respawn - S.sim.time));
      heroButton.disabled = !alive || !Z.started || Z.paused;
      heroButton.classList.toggle("ready", alive && S.sim.commanderCooldown("barrage") === 0);
      set("defence-hero-state", alive ? "" : `${back}s`);
    }
    // Armour (0.23): squads in the field of the cap; "ready" when one more can be bought.
    const rules = S.sim.armourRules(), armour = $("defence-armour");
    armour.hidden = !rules;
    if (rules) {
      const n = S.sim.armourSquads().length;
      armour.disabled = !Z.started || Z.paused || !!S.sim.result;
      armour.classList.toggle("ready", !S.sim.armourWhy(0));
      armour.setAttribute("aria-pressed", String(!!selectedSquad(A.selectedEntities()) || !!S.defenceDepot));
      set("defence-armour-state", `${n}/${rules.cap}`);
    }
  }
  function set(id, text) { const el = $(id); if (el && el.textContent !== text) el.textContent = text; }

  // ---------------------------------------------------------------- Wave intel (0.22)
  // What the next wave brings, shown while it can still be called (between waves, and once the
  // wave on the field has all arrived): unit portraits with counts, a carrier with "(n)" aboard,
  // and the roads it takes when the level has more than one. Rebuilt only when it changes.
  function ensureIntel() {
    if (intel?.isConnected) return intel;
    intel = document.createElement("div");
    intel.id = "defence-intel";
    intel.setAttribute("role", "group");
    intel.setAttribute("aria-label", "Next wave");
    intel.hidden = true;
    $("stage").append(intel);
    intelKey = "";
    return intel;
  }
  function updateIntel(st) {
    const el = ensureIntel(), p = Z.started && st.canCall ? S.sim.wavePreview() : null;
    const key = p ? `${p.wave}|${p.units.map((u) => `${u.type}:${u.count}:${u.carry || 0}`).join(",")}|${p.routes.join(",")}` : "";
    if (key === intelKey) return;
    intelKey = key;
    el.hidden = !p;
    if (!p) { el.innerHTML = ""; return; }
    const many = Object.keys(S.sim.missionDef.defence.routes).length > 1;
    const unit = (u) => `<span class="intel-unit${u.carry ? " carrier" : ""}" data-type="${u.type}" title="${D[u.type]?.name || u.type}">${hasPortrait(u.type) ? portrait(u.type, "hostile") : icon(D[u.type]?.icon || "tank")}<b translate="no">×${u.count}</b>${u.carry ? `<small translate="no">(${u.carry})</small>` : ""}</span>`;
    const chips = waveTraits(p.units, D).map((id) => { const t = TRAITS.find((x) => x.id === id); return `<span class="intel-chip" data-trait="${id}" title="${t.hint}">${t.label}</span>`; }).join("");
    el.innerHTML = (chips ? `<span class="intel-traits">${chips}</span>` : "") + `<span class="intel-line"><span class="intel-head"><span>Next wave</span> <b translate="no">${p.wave}</b></span>${p.units.map(unit).join("")}</span>${many ? `<span class="intel-routes">${p.routes.map((r) => `<span class="intel-route" data-route="${r}">${S.sim.missionDef.defence.roads?.[r] || ROUTE_LABEL[r] || r}</span>`).join("")}</span>` : ""}`;
  }

  // ---------------------------------------------------------------- New-enemy card (W1-F)
  // The first time an enemy type is in a wave the player has started: its traits and two crews that counter it.
  // Shown once per type (progress.seen), one card at a time, closed by a tap or after 6 s; never over a modal.
  // Off under ?test unless the URL has ?enemycards.
  const cardsOn = () => !S.query?.has("test") || S.query.has("enemycards");
  function queueCards() {
    const d = S.sim.defence;
    if (!cardsOn() || d.wave === cardWave || d.wave < 1) return;
    cardWave = d.wave;
    const progress = S.defenceProgress || loadProgress(), wave = S.sim.defenceWave(d.wave - 1);
    if (!wave) return;
    for (const u of waveTypes(wave.groups, (g, slot) => S.sim.waveType(g, slot))) if (!hasSeen(progress, u.type) && !cardQueue.some((c) => c.type === u.type)) cardQueue.push(u);
  }
  function closeCard() { cardEl?.remove(); cardEl = null; }
  function updateCard() {
    if (!S.sim?.defence) return;
    queueCards();
    if (Z.modalType || Z.paused || !Z.started || S.sim.result) { closeCard(); return; }
    const now = performance.now();
    if (cardEl && now - cardAt > CARD_MS) closeCard();
    if (cardEl || !cardQueue.length) return;
    const u = cardQueue.shift(), def = D[u.type];
    if (!def) return;
    S.defenceProgress = recordSeen(S.defenceProgress || loadProgress(), [u.type]);
    saveProgress(S.defenceProgress);
    const crews = counterCrews(u, D, S.sim.missionDef.defence.crews), ids = traitsOf(u, D);
    cardEl = document.createElement("div");
    cardEl.id = "defence-card";
    cardEl.setAttribute("role", "status");
    cardEl.innerHTML = `<span class="card-art">${hasPortrait(u.type) ? portrait(u.type, "hostile") : icon(def.icon || "tank")}</span><span class="card-body"><span class="card-eyebrow">New enemy</span><strong>${def.name}</strong><span class="card-chips">${ids.map((id) => { const t = TRAITS.find((x) => x.id === id); return `<span class="intel-chip" data-trait="${id}">${t.label}</span>`; }).join("")}</span><span class="card-counter"><span>Best crews</span> ${crews.map((c) => `<b data-crew="${c}">${CREW_LABEL[c]}</b>`).join("")}</span></span>`;
    cardEl.onclick = closeCard;
    $("stage").append(cardEl);
    cardAt = now;
  }

  // ---------------------------------------------------------------- Carrier moments (0.22)
  // A squad dropped: an alert. A carrier lost with its squad: "+N" alloy rising over the wreck
  // (a DOM chip, transform/opacity only, still under motion-off; the blast is the rules' strike).
  function event(e) {
    if (e.type === "drop") { if (S.sim.time - (dropAt ?? -Infinity) > 6) { dropAt = S.sim.time; A.alert("A carrier is dropping troops!"); } return; }
    // Armour (0.23): a squad bought is picked at once, so the next tap sends it.
    if (e.type === "armourBuy") { A.notice("Armour squad ready. Tap the map to send it."); return; }
    if (e.type === "armourRefit") { if (S.sim.time - (refitAt ?? -Infinity) > 2) { refitAt = S.sim.time; A.notice("Armour refitted to full strength."); } return; }
    if (e.type !== "carrierDown") return;
    A.notice("Carrier destroyed with its squad aboard!");
    if (!S.sim.isVisible(e)) return;
    const stage = $("stage").getBoundingClientRect(), canvas = S.view.renderer.domElement.getBoundingClientRect();
    const q = S.view.project(e.x, e.z, S.view.terrain.heightAt(e.x, e.z) + 2.4), x = q.x + canvas.left - stage.left, y = q.y + canvas.top - stage.top;
    if (x < 0 || y < 0 || x > stage.width || y > stage.height) return;
    const chip = document.createElement("span");
    chip.className = "defence-float";
    chip.setAttribute("aria-hidden", "true");
    chip.innerHTML = `${icon("alloy")}<b translate="no">+${e.amount}</b>`;
    chip.style.left = `${Math.round(x)}px`;
    chip.style.top = `${Math.round(y)}px`;
    $("stage").append(chip);
    setTimeout(() => chip.remove(), FLOAT_SECONDS * 1000);
  }
  let dropAt = null, refitAt = null, lastTap = null;

  // Notices from what changed since the last look (the rules only emit events the frame loop drains).
  function announce() {
    const d = S.sim.defence, cs = S.sim.crossings || {};
    const crossings = Object.fromEntries(Object.entries(cs).map(([x, c]) => [x, `${c.state}${c.state === "blown" && c.progress > 0 ? "+" : ""}`]));
    const hero = !!S.sim.commander();
    if (!seen) { seen = { wave: d.wave, cleared: d.cleared, lives: d.lives, crossings, hero }; return; }
    const total = S.sim.waveTotal();
    if (d.cleared > seen.cleared && d.cleared < total) {
      // Music follows on its own: between waves (defence.active false) sound.js picks 'defence-calm'.
      A.notice("Wave held. Your towers are patched up.");
    }
    if (d.wave > seen.wave && d.wave === total) A.alert("Final wave!");
    if (d.lives < seen.lives && S.sim.time - leakAt > 4) { leakAt = S.sim.time; A.alert("The enemy broke through!"); }
    for (const [x, now] of Object.entries(crossings)) {
      const was = seen.crossings[x];
      if (now === was) continue;
      if (now === "fuse") A.alert("Charge set: the bridge blows in 3 seconds.");
      else if (now === "blown" && was === "fuse") { A.notice("Bridge down. The columns turn to another crossing."); A.tone(110, 0.3); }
      else if (now === "blown+") A.alert("Bridge builders at the river!");
      else if (now === "pontoon") A.alert("A pontoon is across the river!");
    }
    if (seen.hero && !hero) A.alert("The commander is down: back in 20 seconds.");
    else if (!seen.hero && hero && d.hero) A.notice("The commander is back on the field.");
    seen = { wave: d.wave, cleared: d.cleared, lives: d.lives, crossings, hero };
  }

  // ---------------------------------------------------------------- Command card sheets
  function crewTile(crew, index) {
    const type = S.sim.crewType(crew), g = GARRISONS.crews[crew], cost = S.sim.buildCost(crew), k = key(index);
    const stats = S.sim.garrisonStats(crew, 1);
    return `<button class="command-tile defence-crew" data-defence-crew="${crew}" data-tier="1"${k ? ` data-hotkey="${k}"` : ""} aria-label="${g.name}, ${cost} alloy" title="${k ? `${k} · ` : ""}${g.name} · ${CREW_ROLE[crew]} · ${cost} alloy · ${Math.round(stats.range)} m">${kbd(k)}${hasPortrait(type) ? portrait(type) : icon(D[type]?.icon || "tower")}<span>${CREW_LABEL[crew]}</span><small><b class="alloy-text" translate="no">${cost}</b></small></button>`;
  }
  function padSheet(pad) {
    const def = S.sim.missionDef.defence;
    $("command-label").textContent = "BUILD PAD";
    $("command-context").textContent = pad.zone ? "ZONE" : pad.high === "rim" ? "RIM" : pad.high === "deep" ? "DEEP" : "GROUND";
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="p:${pad.id}"></i>${def.crews.map((c, i) => crewTile(c, i)).join("")}`;
    $("command-hint").textContent = PAD_NOTE[pad.high || "ground"];
  }
  // A spot in a build zone (0.23): the same crews; the tiles stay off while the spot is refused.
  function zoneSheet(spot) {
    const def = S.sim.missionDef.defence;
    $("command-label").textContent = "BUILD ZONE";
    $("command-context").textContent = (ZONE_NAME[spot.zone] || "Build zone").toUpperCase();
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="z:${spot.zone}:${spot.x}:${spot.z}"></i>${def.crews.map((c, i) => crewTile(c, i)).join("")}`;
    $("command-hint").textContent = "";
  }
  function zoneWhy(spot) {
    return S.sim.zoneCheck(0, spot.zone, spot.x, spot.z).why || "";
  }
  // Armour (0.23): Guard and Hold the road, a new squad, and the squad itself (focus).
  function armourSheet(squad) {
    const units = S.sim.armourUnits(squad), mode = S.sim.armourModeOf(squad), a = S.sim.armourRules(), lead = units[0];
    $("command-label").textContent = "ARMOUR SQUAD";
    $("command-context").textContent = mode === "road" ? "HOLDING THE ROAD" : "ON GUARD";
    const hp = units.reduce((n, e) => n + e.hp, 0), up = S.sim.armourNextUpgrade(squad), A2 = GARRISONS.armour;
    // 0.24: Rank 2, then the two branches; once both are taken, the branch the squad has.
    const upTile = (id, i, ic, label, cost) => `<button class="command-tile defence-armour-up" data-defence-armour="${id}" data-cost="${cost}" data-hotkey="${key(i)}" aria-label="${label}, ${cost} alloy" title="${key(i)} · ${ARMOUR_TEXT[id]} · ${cost} alloy">${kbd(key(i))}${icon(ic)}<span>${label}</span><small><b class="alloy-text" translate="no">${cost}</b></small></button>`;
    const ups = up?.kind === "rank" ? upTile("rank2", 4, "rapid", A2.rank2.name, up.cost)
      : up?.kind === "branch" ? Object.entries(A2.branches).map(([id, b], i) => upTile(id, 4 + i, id === "assault" ? "attack" : "shield", b.name, b.cost)).join("")
      : lead.squadBranch ? `<button class="command-tile defence-armour-up" data-defence-armour="done" data-hotkey="${key(4)}" disabled title="${key(4)} · ${ARMOUR_TEXT[lead.squadBranch]}">${kbd(key(4))}${icon(lead.squadBranch === "assault" ? "attack" : "shield")}<span>${A2.branches[lead.squadBranch].name}</span><small>${icon("check")}</small></button>` : "";
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="a:${squad}:${mode}:${units.length}:${lead.squadRank || 1}${lead.squadBranch || ""}"></i>
      <button class="command-tile defence-armour-mode" data-defence-armour="guard" data-hotkey="${key(0)}" aria-pressed="${mode === "guard"}" title="${key(0)} · Guard: holds its spot, fires at anything in range, chases a little and comes back">${kbd(key(0))}${icon("shield")}<span>Guard</span><small>${mode === "guard" ? icon("check") : ""}</small></button>
      <button class="command-tile defence-armour-mode" data-defence-armour="road" data-hotkey="${key(1)}" aria-pressed="${mode === "road"}" title="${key(1)} · Hold the road: stands fast and blocks the column, like the commander">${kbd(key(1))}${icon("hold")}<span>Hold road</span><small>${mode === "road" ? icon("check") : ""}</small></button>
      <button class="command-tile defence-armour-buy" data-defence-armour="buy" data-hotkey="${key(2)}" aria-label="New squad, ${a.cost} alloy" title="${key(2)} · New squad: ${a.size} tanks at the depot · ${a.cost} alloy">${kbd(key(2))}${icon("tank")}<span>New squad</span><small><b class="alloy-text" translate="no">${a.cost}</b></small></button>
      <button class="command-tile defence-info" data-defence-armour="focus" data-hotkey="${key(3)}" title="${key(3)} · ${a.name}">${kbd(key(3))}${hasPortrait(lead.type) ? portrait(lead.type) : icon("tank")}<span>Squad</span><small><b translate="no" data-armour-hp>${Math.round(hp)}</b></small></button>${ups}`;
    $("command-hint").textContent = up?.kind === "branch" ? "Rank 2: pick one branch for this squad. It cannot be changed." : "Tap the map or a road to send the squad. On Guard it comes back to its spot after a chase.";
  }
  function depotSheet() {
    const a = S.sim.armourRules();
    $("command-label").textContent = "ARMOUR DEPOT";
    $("command-context").textContent = `${S.sim.armourSquads().length} / ${a.cap}`;
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="d"></i>
      <button class="command-tile defence-armour-buy" data-defence-armour="buy" data-hotkey="${key(0)}" aria-label="New squad, ${a.cost} alloy" title="${key(0)} · New squad: ${a.size} tanks at the depot · ${a.cost} alloy">${kbd(key(0))}${icon("tank")}<span>New squad</span><small><b class="alloy-text" translate="no">${a.cost}</b></small></button>
      <div class="tactical-hint defence-hint">${icon("info")}<p>Two tanks that go where you send them. They guard that spot on their own, and are refitted after every wave.</p></div>`;
    $("command-hint").textContent = "";
  }
  function towerSheet(t) {
    const g = GARRISONS.crews[t.crew], type = S.sim.crewType(t.crew), top = t.tier >= 3, choose = top && !t.branch && g.branches;
    const next = top ? null : S.sim.garrisonStats(t.crew, t.tier + 1), cost = top ? 0 : g.cost[t.tier], refund = Math.floor(t.spent * GARRISONS.sell);
    const branchName = t.branch ? g.branches[t.branch].name : "";
    // 0.24: a branched tower's ranks.
    const rank = t.branchRank || 0, ranks = t.branch ? g.branches[t.branch].ranks?.length || 0 : 0, nextRank = t.branch ? S.sim.rankOf(t.crew, t.branch, rank) : null;
    $("command-label").textContent = "GARRISON";
    $("command-context").textContent = choose ? "CHOOSE ONE" : ranks ? `RANK ${rank} / ${ranks}` : `TIER ${t.tier} / 3`;
    const info = `<button class="command-tile defence-info" data-defence-act="focus" data-tier="${t.tier}"${t.branch ? ` data-branch="${t.branch}"` : ""} data-hotkey="${key(0)}" title="${key(0)} · ${g.name} · tier ${t.tier}${branchName ? ` · ${branchName}` : ""} · ${Math.round(t.range)} m">${kbd(key(0))}${hasPortrait(type) ? portrait(type) : icon("tower")}<span>${CREW_LABEL[t.crew]}</span><small>${branchName ? `<b>${branchName}</b>${rank ? `<i class="defence-rank-pips" data-rank="${rank}">${"<i></i>".repeat(rank)}</i>` : ""}` : `<span>Tier</span> <b translate="no">${t.tier}</b>`}</small></button>`;
    // Tier 3 without a branch: the two branches side by side, gold like the tier they crown.
    const rankTile = `<button class="command-tile defence-rank" data-defence-act="rank" data-tier="3" data-rank="${rank}" data-hotkey="${key(1)}" ${nextRank ? "" : "disabled"} aria-label="${nextRank ? `Rank ${rank + 1}, ${nextRank.cost} alloy` : "Top rank"}" title="${key(1)} · ${nextRank ? `Rank ${rank + 1}: ${RANK_TEXT[t.branch]?.[rank] || ""} · ${nextRank.cost} alloy` : "Top rank"}">${kbd(key(1))}${icon("rapid")}<span>${nextRank ? "Rank up" : "Top rank"}</span><small>${nextRank ? `<b class="alloy-text" translate="no">${nextRank.cost}</b>` : icon("check")}</small></button>`;
    const middle = ranks ? rankTile : choose
      ? Object.entries(g.branches).map(([id, b], i) => `<button class="command-tile defence-branch" data-defence-branch="${id}" data-tier="3" data-hotkey="${key(i + 1)}" aria-label="${b.name}, ${b.cost} alloy" title="${key(i + 1)} · ${b.name}: ${BRANCH_TEXT[id]} · ${b.cost} alloy">${kbd(key(i + 1))}${icon(i ? "crosshair" : "bolt")}<span>${b.name}</span><small><b class="alloy-text" translate="no">${b.cost}</b></small></button>`).join("")
      : `<button class="command-tile defence-upgrade" data-defence-act="upgrade" data-tier="${top ? 3 : t.tier + 1}" data-hotkey="${key(1)}" ${top ? "disabled" : ""} aria-label="${top ? "Top tier" : `Upgrade to tier ${t.tier + 1}, ${cost} alloy`}" title="${key(1)} · ${top ? "Top tier" : `Tier ${t.tier + 1}: ${Math.round(next.damage)} damage, ${Math.round(next.range)} m · ${cost} alloy`}">${kbd(key(1))}${icon("bolt")}<span>${top ? "Top tier" : "Upgrade"}</span><small>${top ? icon("check") : `<b class="alloy-text" translate="no">${cost}</b>`}</small></button>`;
    const sellKey = key(choose ? 3 : 2), aimKey = key(choose ? 4 : 3), aimNow = t.aim || "near", tiles = choose ? 5 : 4;
    const aimTile = `<button class="command-tile defence-aim" data-defence-aim="${nextAim(t)}" data-hotkey="${aimKey}" title="${aimKey} · Aim: ${AIM_TEXT[aimNow]} Tap to change." aria-label="Aim: ${AIM_LABEL[aimNow]}">${kbd(aimKey)}${icon("crosshair")}<span>Aim</span><small>${AIM_LABEL[aimNow]}</small></button>`;
    $("commands").innerHTML = `<i hidden data-defence-sheet data-tiles="${tiles}" data-key="t:${t.id}:${t.tier}:${t.branch || ""}:${rank}:${t.aim || ""}"></i>${info}${middle}
      <button class="command-tile defence-sell" data-defence-act="sell" data-hotkey="${sellKey}" aria-label="Sell for ${refund} alloy" title="${sellKey} · Sell: ${refund} alloy back">${kbd(sellKey)}${icon("close")}<span>Sell</span><small><b class="alloy-text" translate="no">+${refund}</b></small></button>${aimTile}${statsBlock(t, choose)}`;
    $("command-hint").textContent = choose ? "Gold tier: pick one branch for this tower. It cannot be changed." : t.branch ? `${g.name} · ${branchName}. ${nextRank ? `Next rank: ${RANK_TEXT[t.branch]?.[rank] || ""}` : BRANCH_TEXT[t.branch]}` : `${g.name}. ${CREW_ROLE[t.crew]}`;
  }
  // The next aim a tower cycles to: Nearest, First, Strongest, then Air for crews that hit air.
  function nextAim(t) {
    const ring = ["near", "first", "strong", ...(t.hits_air ? ["air"] : [])];
    return ring[(ring.indexOf(t.aim || "near") + 1) % ring.length];
  }
  // Tower figures as text (no hover): dps, reach, the multiplier against armour, air, and what the next tier or rank adds.
  function statsBlock(t, choose) {
    const sim = S.sim, now = sim.garrisonStats(t.crew, t.tier, t.team, t.branch || null, t.branchRank || 0), dps = (s) => s.damage / s.interval;
    const num = (n, d = 0) => `<b translate="no">${(Math.round(n * 10 ** d) / 10 ** d).toString()}</b>`;
    const line1 = `${num(dps(now), 0)} <span>dps</span> · ${num(now.range, 0)} <span>m</span> · ×${num(now.mechanical_bonus || 1, 1)} <span>vs armour</span> · <span>Air</span>: <span>${now.hits_air ? "yes" : "no"}</span>`;
    let next = null;
    if (!t.branch && t.tier < 3) next = sim.garrisonStats(t.crew, t.tier + 1, t.team);
    else if (t.branch && sim.rankOf(t.crew, t.branch, t.branchRank || 0)) next = sim.garrisonStats(t.crew, 3, t.team, t.branch, (t.branchRank || 0) + 1);
    const sign = (n) => (n >= 0 ? "+" : "−");
    const line2 = next && !choose ? `<p><span>Next</span>: ${sign(dps(next) - dps(now))}${num(Math.abs(dps(next) - dps(now)), 0)} <span>dps</span> · ${sign(next.range - now.range)}${num(Math.abs(next.range - now.range), 0)} <span>m</span> · ${sign(next.maxHp - now.maxHp)}${num(Math.abs(next.maxHp - now.maxHp), 0)} <span>HP</span></p>` : "";
    return `<div class="defence-stats" data-defence-stats><p>${line1}</p>${line2}</div>`;
  }
  function heroSheet(hero) {
    const c = GARRISONS.commander;
    $("command-label").textContent = "FIELD COMMANDER";
    $("command-context").textContent = aim ? "TAP THE ROAD" : "ON THE FIELD";
    const tile = (id, i, label, ic, title) => `<button class="command-tile defence-ability" data-defence-hero="${id}" data-hotkey="${key(i)}" aria-pressed="${aim === id}" title="${key(i)} · ${title}">${kbd(key(i))}${icon(ic)}<span>${label}</span><small data-cooldown="${id}" translate="no"></small></button>`;
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="h:${hero.id}:${aim || ""}"></i>
      ${tile("barrage", 0, "Barrage", "barrage", `Barrage: shell a spot within ${c.barrage.range} m, ${c.barrage.damage} damage over ${c.barrage.radius} m`)}
      ${tile("reinforce", 1, "Reinforce", "shield", `Reinforce: three Vanguards hold the road for ${c.reinforce.seconds} s`)}
      <button class="command-tile defence-info" data-defence-hero="focus" data-hotkey="${key(2)}" title="${key(2)} · ${c.name}">${kbd(key(2))}${hasPortrait(hero.type) ? portrait(hero.type) : icon("flag")}<span>Field commander</span><small><b translate="no">${Math.round(hero.hp)}</b></small></button>`;
    $("command-hint").textContent = aim === "barrage" ? "Tap a spot inside the ring to shell it." : aim === "reinforce" ? "Tap the road inside the ring to drop three Vanguards." : "Tap the road to send the commander. It holds there and blocks the column.";
  }
  function bridgeSheet(x) {
    const s = S.sim, c = s.crossings?.[x], state = c?.state || "open", cost = GARRISONS.demolish.cost;
    const label = state === "fuse" ? "Charge lit" : state === "blown" ? "Blown" : state === "pontoon" ? "Blow pontoon" : "Blow bridge";
    $("command-label").textContent = "BRIDGE";
    $("command-context").textContent = state === "open" ? "STANDING" : state === "fuse" ? "FUSE LIT" : state === "blown" ? "DOWN" : "PONTOON";
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="b:${x}:${state}"></i>
      <button class="command-tile defence-demolish" data-defence-act="demolish" data-crossing="${x}" data-hotkey="${key(0)}" aria-label="${label}, ${cost} alloy" title="${key(0)} · ${label} · ${cost} alloy">${kbd(key(0))}${icon("barrage")}<span>${label}</span><small><b class="alloy-text" translate="no">${cost}</b></small></button>
      <div class="tactical-hint defence-hint defence-bridge-state">${icon("info")}<p data-bridge-note></p></div>`;
    $("command-hint").textContent = "";
  }
  function bridgeNote(x) {
    const s = S.sim, c = s.crossings?.[x], state = c?.state || "open";
    if (state === "fuse") return `The charge goes off in ${Math.max(0, Math.ceil(c.at - s.time))} s. Anyone on the bridge is thrown to the bank.`;
    if (state === "blown") return c.progress > 0 ? `Bridge builders at work: pontoon ${Math.floor((c.progress / GARRISONS.demolish.pontoon) * 100)}% done.` : "Down. The columns take another crossing; bridge builders will try a pontoon.";
    if (state === "pontoon") return "A pontoon: units wade it slowly, like the ford. It can be blown too.";
    const why = s.canDemolish(0, x);
    return why && why !== "ok" ? why : "Blowing it takes 3 s. The waves on this road turn to another crossing.";
  }
  function emptySheet() {
    $("command-label").textContent = "DEFENCE";
    $("command-context").textContent = "PADS";
    const zones = !!S.sim.missionDef.defence.zones?.length;
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="none"></i><div class="tactical-hint defence-hint">${icon("tower")}<strong>Crew the pads</strong><p>${zones ? "Tap a pad, or anywhere in a marked field, then pick a crew. Tap a tower to upgrade or sell it." : "Tap a pad beside the road, then pick a crew. Tap a tower to upgrade or sell it."}</p></div>`;
    $("command-hint").textContent = "";
  }
  function sheet(es) {
    const tower = es.length === 1 && es[0].crew && es[0].team === 0 ? es[0] : null, hero = es.length === 1 && es[0].hero ? es[0] : null, squad = selectedSquad(es);
    if (tower) S.defencePad = tower.pad;
    // Anything else picked, or the picked pad's tower deselected: no pad.
    else if (es.length || (S.defencePad && S.sim.towerOn(S.defencePad))) S.defencePad = null;
    if (es.length) { S.defenceBridge = null; S.defenceSpot = null; S.defenceDepot = false; }
    if (!hero && aim) setAim(null);
    const pad = !tower && !hero && S.defencePad ? S.sim.padById(S.defencePad) : null;
    const bridge = !tower && !hero && !pad ? S.defenceBridge : null;
    // 0.23: a spot in a build zone, an armour squad, the armour depot.
    const spot = !es.length && !pad && bridge === null ? S.defenceSpot : null, depot = !es.length && !pad && !spot && bridge === null && S.defenceDepot && !!S.sim.armourRules();
    const lead = squad ? S.sim.armourUnits(squad)[0] : null;
    const k = tower ? `t:${tower.id}:${tower.tier}:${tower.branch || ""}:${tower.branchRank || 0}:${tower.aim || ""}` : hero ? `h:${hero.id}:${aim || ""}` : squad ? `a:${squad}:${S.sim.armourModeOf(squad)}:${es.length}:${lead?.squadRank || 1}${lead?.squadBranch || ""}` : pad ? `p:${pad.id}` : bridge !== null ? `b:${bridge}:${S.sim.crossingState(bridge)}` : spot ? `z:${spot.zone}:${spot.x}:${spot.z}` : depot ? "d" : "none";
    const marker = $("commands").querySelector("[data-defence-sheet]");
    if (marker?.dataset.key !== k) {
      $("commands").classList.remove("tactics-card");
      if (tower) towerSheet(tower); else if (hero) heroSheet(hero); else if (squad) armourSheet(squad); else if (pad) padSheet(pad); else if (bridge !== null) bridgeSheet(bridge); else if (spot) zoneSheet(spot); else if (depot) depotSheet(); else emptySheet();
      if (tower && burstTier && burstTier === tower.tier) { burst($("commands").querySelector(".defence-info")); burstTier = 0; }
      affordable = false;
    }
    $("upgrade-actions").innerHTML = "";
    if (tower) $("commands").dataset.tier = String(tower.tier); else delete $("commands").dataset.tier;
    const alloy = S.sim.players[0].alloy, blocked = !Z.started || Z.paused || !!S.sim.result;
    const refused = spot ? zoneWhy(spot) : "";
    for (const b of $("commands").querySelectorAll("[data-defence-crew]")) b.disabled = blocked || !!refused || alloy < S.sim.buildCost(b.dataset.defenceCrew);
    if (spot) { const text = refused || "Zone spot: a crew can stand here. The road stays clear."; if ($("command-hint").textContent !== text) $("command-hint").textContent = text; }
    for (const b of $("commands").querySelectorAll("[data-defence-armour=\"buy\"]")) b.disabled = blocked || !!S.sim.armourWhy(0);
    for (const b of $("commands").querySelectorAll("[data-defence-armour=\"guard\"], [data-defence-armour=\"road\"], [data-defence-armour=\"focus\"]")) b.disabled = blocked;
    if (squad) { const hp = $("commands").querySelector("[data-armour-hp]"), text = String(Math.round(es.reduce((n, e) => n + e.hp, 0))); if (hp && hp.textContent !== text) hp.textContent = text; }
    for (const b of $("commands").querySelectorAll("[data-defence-branch]")) b.disabled = blocked || alloy < S.sim.branchCost(tower.crew, b.dataset.defenceBranch);
    for (const b of $("commands").querySelectorAll(".defence-armour-up[data-cost]")) b.disabled = blocked || alloy < Number(b.dataset.cost);
    const rankUp = $("commands").querySelector('[data-defence-act="rank"]');
    if (rankUp && tower) {
      const r = tower.branch ? S.sim.rankOf(tower.crew, tower.branch, tower.branchRank || 0) : null, can = !!r && alloy >= r.cost;
      rankUp.disabled = blocked || !can;
      if (can && !affordable && !blocked) burst(rankUp);
      affordable = can;
    }
    const up = $("commands").querySelector('[data-defence-act="upgrade"]');
    if (up && tower) {
      const can = tower.tier < 3 && alloy >= GARRISONS.crews[tower.crew].cost[tower.tier];
      up.disabled = blocked || !can;
      // An upgrade that just became affordable throws a few embers (never under motion-off).
      if (can && !affordable && !blocked) burst(up);
      affordable = can;
    }
    const branchTiles = $("commands").querySelectorAll("[data-defence-branch]");
    if (branchTiles.length && tower) {
      const can = [...branchTiles].some((b) => !b.disabled);
      if (can && !affordable && !blocked) burst(branchTiles[0]);
      affordable = can;
    }
    const sell = $("commands").querySelector('[data-defence-act="sell"]');
    if (sell) sell.disabled = blocked;
    for (const b of $("commands").querySelectorAll("[data-defence-aim]")) b.disabled = blocked;
    const focus = $("commands").querySelector('[data-defence-act="focus"]');
    if (focus) focus.disabled = blocked;
    if (hero) {
      for (const id of ["barrage", "reinforce"]) {
        const left = S.sim.commanderCooldown(id), b = $("commands").querySelector(`[data-defence-hero="${id}"]`);
        if (!b) continue;
        b.disabled = blocked || left > 0;
        b.classList.toggle("ready", !left);
        const small = b.querySelector("[data-cooldown]"), text = left > 0 ? `${Math.ceil(left)}s` : "Ready";
        if (small.textContent !== text) small.textContent = text;
      }
    }
    if (bridge !== null) {
      const b = $("commands").querySelector('[data-defence-act="demolish"]');
      if (b) b.disabled = blocked || S.sim.canDemolish(0, bridge) !== "ok" || alloy < GARRISONS.demolish.cost;
      const note = $("commands").querySelector("[data-bridge-note]"), text = bridgeNote(bridge);
      if (note && note.textContent !== text) note.textContent = text;
    }
  }
  // Six sparks over a tile: transform and opacity only, removed when their animation ends.
  function burst(tile) {
    if (!tile || motionOff()) return;
    tile.querySelector(".ember-burst")?.remove();
    const box = document.createElement("span");
    box.className = "ember-burst";
    box.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 6; i++) { const s = document.createElement("span"); s.className = "ember"; s.style.setProperty("--i", String(i)); box.append(s); }
    let left = 6;
    box.addEventListener("animationend", () => { if (--left <= 0) box.remove(); });
    tile.append(box);
  }
  // The commander's aimed abilities: the reach ring around it until a spot is tapped.
  function setAim(which) {
    aim = which;
    const hero = S.sim.commander(), c = GARRISONS.commander;
    if (!which || !hero) { aim = null; S.view.tactics?.clearAim(); return; }
    const a = c[which];
    S.view.tactics?.showAim([hero], a.range, which === "barrage" ? a.radius : 2.5, null, false);
  }
  function act(action, el) {
    if (!Z.started || Z.paused || S.sim.result) return;
    if (action === "demolish") {
      const x = Number(el.dataset.crossing);
      if (S.sim.command({ team: 0, type: "demolish", crossing: x })) A.tone(220, 0.2);
      A.updateUI();
      return;
    }
    const t = A.selectedEntities()[0];
    if (!t?.crew) return;
    if (action === "upgrade" && S.sim.command({ team: 0, type: "padUpgrade", building: t.id })) { burstTier = t.tier; A.tone(880, 0.14); }
    if (action === "rank" && S.sim.command({ team: 0, type: "padRank", building: t.id })) { burstTier = 3; A.tone(1046, 0.16); }
    if (action === "sell" && S.sim.command({ team: 0, type: "padSell", building: t.id })) { S.defencePad = t.pad; A.setSelection([]); A.tone(330, 0.12); }
    if (action === "focus") S.view.focusOn(t.x, t.z);
    A.updateUI();
  }
  function branch(id) {
    const t = A.selectedEntities()[0];
    if (!Z.started || Z.paused || S.sim.result || !t?.crew) return;
    if (S.sim.command({ team: 0, type: "padBranch", building: t.id, branch: id })) { burstTier = 3; A.tone(990, 0.16); }
    A.updateUI();
  }
  function heroAct(id) {
    const hero = S.sim.commander();
    if (!Z.started || Z.paused || S.sim.result || !hero) return;
    if (id === "focus") S.view.focusOn(hero.x, hero.z);
    else setAim(aim === id ? null : id);
    A.updateUI();
  }
  function build(crew) {
    if (!Z.started || Z.paused || S.sim.result || (!S.defencePad && !S.defenceSpot)) return;
    // A zone spot (0.23) makes its own pad: the newest one.
    const spot = !S.defencePad ? S.defenceSpot : null, pad = S.defencePad;
    if (S.sim.command(spot ? { team: 0, type: "zoneBuild", zone: spot.zone, x: spot.x, z: spot.z, crew } : { team: 0, type: "padBuild", pad, crew })) {
      A.tone(740, 0.14);
      const t = spot ? S.sim.towerOn(S.sim.defence.zonePads.at(-1).id) : S.sim.towerOn(pad);
      S.defenceSpot = null;
      if (t) A.setSelection([t.id]);
      // Phones: stay on the card with the new tower's Upgrade and Sell.
      if (root.classList.contains("compact-ui")) A.dockTab("actions");
    }
    A.updateUI();
  }
  // Armour (0.23): Guard / Hold the road for the picked squad, a new squad, or the camera on it.
  function armourAct(id) {
    if (!Z.started || Z.paused || S.sim.result) return;
    const squad = selectedSquad(A.selectedEntities());
    if (id === "buy") {
      if (S.sim.command({ team: 0, type: "armourBuy" })) {
        A.tone(700, 0.14);
        const made = S.sim.armourSquads().at(-1);
        S.defenceDepot = false;
        if (made) A.setSelection(made.units.map((e) => e.id));
        // Phones: stay on the card with the squad's Guard and Hold the road.
        if (root.classList.contains("compact-ui")) A.dockTab("actions");
      }
    } else if (squad && (id === "rank2" || id === "assault" || id === "bulwark")) {
      if (S.sim.command({ team: 0, type: "armourUpgrade", squad, ...(id === "rank2" ? {} : { branch: id }) })) A.tone(id === "rank2" ? 760 : 880, 0.14);
    } else if (squad && (id === "guard" || id === "road")) {
      if (S.sim.command({ team: 0, type: "armourMode", squad, mode: id })) A.tone(id === "road" ? 420 : 520, 0.1);
    } else if (squad && id === "focus") { const u = S.sim.armourUnits(squad)[0]; if (u) S.view.focusOn(u.x, u.z); }
    A.updateUI();
  }
  $("commands").addEventListener("click", (event) => {
    if (!S.sim?.defence) return;
    // A phone's click that follows the tap which opened this sheet lands where the finger was: on
    // a landscape phone that can be a tile of the sheet just shown. Taken for what it is, a ghost.
    if (lastTap && performance.now() - lastTap.at < GHOST_MS && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 12) return;
    const aimBtn = event.target.closest("[data-defence-aim]");
    if (aimBtn && !aimBtn.disabled) {
      const t = A.selectedEntities()[0];
      if (Z.started && !Z.paused && !S.sim.result && t?.crew && S.sim.command({ team: 0, type: "padAim", building: t.id, aim: aimBtn.dataset.defenceAim })) A.tone(640, 0.06);
      A.updateUI();
      return;
    }
    const crew = event.target.closest("[data-defence-crew]"), action = event.target.closest("[data-defence-act]"), pick = event.target.closest("[data-defence-branch]"), hero = event.target.closest("[data-defence-hero]"), armour = event.target.closest("[data-defence-armour]");
    if (armour && !armour.disabled) armourAct(armour.dataset.defenceArmour);
    else if (crew && !crew.disabled) build(crew.dataset.defenceCrew);
    else if (pick && !pick.disabled) branch(pick.dataset.defenceBranch);
    else if (hero && !hero.disabled) heroAct(hero.dataset.defenceHero);
    else if (action && !action.disabled) act(action.dataset.defenceAct, action);
  });

  // The selection panel: the picked pad or bridge, or the state of the defence when nothing is picked.
  let infoKey = "";
  function info(es) {
    if (es.length) { infoKey = ""; return; }
    const st = S.sim.defenceStatus(), pad = S.defencePad ? S.sim.padById(S.defencePad) : null, bridge = !pad ? S.defenceBridge : null;
    const spot = !pad && bridge === null ? S.defenceSpot : null, depot = !pad && !spot && bridge === null && S.defenceDepot;
    const k = pad ? `pad:${pad.id}` : bridge !== null ? `bridge:${bridge}` : spot ? `spot:${spot.zone}` : depot ? "depot" : `none:${st.wave}:${st.lives}`;
    if (k === infoKey && $("selection-info").querySelector(".defence-panel")) return;
    infoKey = k;
    const foe = FACTIONS[S.sim.missionDef.factions?.[1]];
    if (spot || depot) {
      $("selection-info").innerHTML = spot
        ? `<div class="selection-empty defence-panel" data-zone="${spot.zone}">${icon("tower")}<div><h3>${ZONE_NAME[spot.zone] || "Build zone"}</h3><p>A crew can stand anywhere on the marked field, clear of the road.</p><p>Pick a crew in Actions.</p></div></div>`
        : `<div class="selection-empty defence-panel" data-depot>${icon("tank")}<div><h3>Armour depot</h3><p>Buy a squad of tanks in Actions, then tap the map to send it.</p></div></div>`;
      return;
    }
    $("selection-info").innerHTML = pad
      ? `<div class="selection-empty defence-panel" data-pad="${pad.id}" data-high="${pad.high || "ground"}">${icon("tower")}<div><h3>${pad.high === "rim" ? "Rim pad" : pad.high === "deep" ? "Deep pad" : "Ground pad"}</h3><p>${PAD_NOTE[pad.high || "ground"]}</p><p>Pick a crew in Actions.</p></div></div>`
      : bridge !== null
        ? `<div class="selection-empty defence-panel" data-bridge="${bridge}">${icon("barrage")}<div><h3>${bridge < 0 ? "West bridge" : "East bridge"}</h3><p>Blow it in Actions: the waves on this road turn to another crossing.</p></div></div>`
        : `<div class="selection-empty defence-panel">${icon("shield")}<div><h3>${S.sim.missionDef.title}</h3><p>${foe ? `<span>${foe.name}</span> · ` : ""}<span>Wave</span> <b translate="no">${st.endless ? st.wave : `${st.wave}/${st.waves}`}</b> · <b translate="no">${st.lives}</b> <span>lives</span></p><p>${S.sim.missionDef.defence.zones?.length ? "Tap a pad or a marked field to crew a tower." : "Tap a pad beside the road to crew a tower."}</p></div></div>`;
  }

  // Range of the picked tower (or of a Ranger nest on the picked pad), on the existing preview disc.
  // The build preview of the other modes is borrowed: its look is put back when the ring goes.
  let ring = null;
  function hideRing() {
    if (!ring) return;
    const preview = S.view.preview;
    preview.visible = false;
    preview.scale.set(1, 1, 1);
    preview.material.opacity = ring.opacity;
    preview.material.color.setHex(ring.color);
    ring = null;
  }
  function rangeRing(es) {
    const t = es.length === 1 && es[0].crew ? es[0] : null, pad = !t && S.defencePad ? S.sim.padById(S.defencePad) : null, spot = !t && !pad && !es.length ? S.defenceSpot : null, at = t || pad || spot;
    const preview = S.view.preview;
    if (!at || S.mode) { hideRing(); return; }
    ring ||= { opacity: preview.material.opacity, color: preview.material.color.getHex() };
    const reach = (t ? t.range : S.sim.garrisonStats("ranger", 1).range) + (S.view.terrain.level(at.x, at.z) ? 2 : 0);
    preview.visible = true;
    preview.position.set(at.x, S.view.terrain.heightAt(at.x, at.z) + 0.12, at.z);
    preview.scale.set(reach, 1, reach);
    // A zone spot the rules refuse shows its ring in red (0.23).
    preview.material.color.setHex(spot && zoneWhy(spot) ? 0xef7660 : 0x92ebc5);
    preview.material.opacity = 0.14;
  }

  // ---------------------------------------------------------------- Lifecycle
  function begin(resume = false) {
    if (!S.sim?.defence) return;
    buildPads();
    ensureBar();
    intelKey = "";
    seen = null;
    S.defencePad = null;
    S.defenceBridge = null;
    S.defenceSpot = null;
    S.defenceDepot = false;
    setAim(null);
    if (cross) cross.key = "";
    const cam = S.sim.missionDef.defence.camera;
    S.view.maxZoom = cam.maxZoom;
    setOverview(false);
    S.view.focusOn(cam.x, cam.z);
    // W1-F: a phone opens at road zoom over the first spawn and follows the wave; a desktop keeps its free camera.
    viewMode = "free"; saved = null; follow = { set: false, pauseUntil: 0, x: 0, z: 0, zoom: 0 };
    cardQueue = []; cardWave = -1; closeCard();
    if (phone()) {
      const first = S.sim.defenceWave(0)?.groups?.[0], pt = first && S.sim.missionDef.defence.routes[first.route]?.[0];
      S.view.zoom = Math.min(cam.zoom, PHONE_ZOOM);
      if (pt) S.view.focusOn(pt.x, pt.z);
      S.view.updateCamera();
      viewMode = "follow";
    }
    paintView();
    // The skirmish opening line ("assign Harvesters") does not apply here.
    S.sim.events = S.sim.events.filter((e) => e.type !== "message");
    if (!resume && Z.started) A.notice(S.sim.missionDef.defence.zones?.length ? "Tap a pad or a marked field, then pick a crew." : "Tap a pad beside the road, then pick a crew.");
    A.updateUI();
  }
  function hud(es) {
    if (!pads || pads.def !== S.sim.missionDef.defence || pads.terrain !== S.view.terrain) buildPads();
    ensureBar();
    bar.hidden = !Z.started;
    if (S.view.maxZoom == null) S.view.maxZoom = S.sim.missionDef.defence.camera.maxZoom;
    updateBar();
    if (Z.started) announce();
    sheet(es);
    info(es);
    // A picked pad or bridge counts as a selection for the docks (landscape phones hide an empty dock).
    if ((S.defencePad || S.defenceBridge !== null || S.defenceSpot || S.defenceDepot) && !es.length) document.querySelector(".selection-panel").classList.add("has-entity");
    paintPads();
    rangeRing(es);
    syncCrossings();
  }
  // Not a defence match (any more): take the pads, crossings and the bar away.
  function idle() {
    hideRing();
    disposePads();
    if (aim) setAim(null);
    if (bar) bar.hidden = true;
    root.style.removeProperty("--defence-bar-h");
    closeCard();
    if (intel) { intel.hidden = true; intelKey = ""; }
    delete $("commands").dataset.tier;
  }
  function tap(x, y) {
    if (!Z.started || Z.paused || S.sim.result || S.mode) return false;
    lastTap = { x, y, at: performance.now() };
    const point = S.view.point(x, y), hero = S.sim.commander();
    // An aimed commander ability takes the tap.
    if (aim && hero) {
      if (point && S.sim.command({ team: 0, type: "heroCast", ability: aim, x: point.x, z: point.z })) { A.tone(aim === "barrage" ? 300 : 600, 0.16); setAim(null); }
      else A.notice("Out of reach: tap inside the ring.");
      A.updateUI();
      return true;
    }
    const target = S.view.pick(x, y, S.sim, 24);
    if (target?.team === 0 && target.crew) { S.defencePad = target.pad; S.defenceBridge = null; A.setSelection([target.id]); return picked(); }
    if (target?.hero) { S.defencePad = null; S.defenceBridge = null; S.defenceSpot = null; A.setSelection([target.id]); return picked(); }
    // A tank of an armour squad (0.23) picks the whole squad.
    if (target?.team === 0 && target.squad) { S.defencePad = null; S.defenceBridge = null; S.defenceSpot = null; A.setSelection(S.sim.armourUnits(target.squad).map((e) => e.id)); return picked(); }
    const pad = nearestPad(x, y);
    if (pad) {
      S.defencePad = pad.id;
      S.defenceBridge = null;
      S.defenceSpot = null;
      S.defenceDepot = false;
      const t = S.sim.towerOn(pad.id);
      A.setSelection(t ? [t.id] : []);
      return picked();
    }
    const bridge = nearestBridge(x, y, point);
    if (bridge !== null) {
      S.defencePad = null;
      S.defenceBridge = bridge;
      S.defenceSpot = null;
      S.defenceDepot = false;
      A.setSelection([]);
      return picked();
    }
    // An armour squad picked: a tap on the map sends it there (it guards that spot).
    const squad = selectedSquad(A.selectedEntities());
    if (squad && point && !(target?.team > 0)) {
      if (S.sim.command({ team: 0, type: "armourMove", squad, x: point.x, z: point.z })) A.tone(560, 0.08);
      else A.notice("The squad cannot go there.");
      A.updateUI();
      return true;
    }
    // The commander picked: a tap on open ground sends it there.
    if (hero && S.selected.has(hero.id) && point && !(target?.team > 0)) {
      if (S.sim.command({ team: 0, type: "heroMove", x: point.x, z: point.z })) A.tone(560, 0.08);
      else A.notice("The commander cannot go there.");
      A.updateUI();
      return true;
    }
    // A spot in a build zone (0.23), snapped to the grid; the sheet says if a crew may stand there.
    const zone = point && !(target?.team > 0) ? S.sim.zoneAt(point.x, point.z) : null;
    if (zone) {
      const p = S.sim.zoneSnap(point.x, point.z);
      S.defencePad = null;
      S.defenceBridge = null;
      S.defenceDepot = false;
      S.defenceSpot = { zone: zone.id, x: p.x, z: p.z };
      A.setSelection([]);
      return picked();
    }
    S.defencePad = null;
    S.defenceBridge = null;
    S.defenceSpot = null;
    S.defenceDepot = false;
    if (target?.team > 0) return false; // the usual label for an enemy
    A.setSelection([]);
    A.updateUI();
    return true;
  }
  function picked() {
    A.tone(520, 0.06);
    if (root.classList.contains("compact-ui")) A.dockTab("actions");
    A.updateUI();
    return true;
  }

  // ---------------------------------------------------------------- Result
  function result() {
    const sim = S.sim, def = sim.missionDef, d = sim.defence, win = sim.result === "victory";
    if (def.variant) return scoreResult();
    const stars = win ? starsFor(sim.mission.medal) : 0, index = DEFENCE_LEVELS.findIndex((l) => l.id === def.id);
    if (win) { S.defenceProgress = recordDefence(loadDefence(), def.id, { stars, lives: d.lives, difficulty: sim.difficulty }); saveDefence(S.defenceProgress); }
    const next = win && index >= 0 && index < DEFENCE_LEVELS.length - 1 ? index + 1 : -1;
    const row = [1, 2, 3].map((i) => `<i class="${i <= stars ? "on" : ""}" style="--i:${i}">★</i>`).join("");
    const killed = S.matchStats?.stats?.killed ?? 0;
    $("modal").classList.add("debrief-wide");
    $("modal-content").innerHTML = `<div class="debrief defence-result ${win ? "won" : "lost"}" data-result="${win ? "victory" : "defeat"}" data-stars="${stars}">
      <span class="eyebrow">DEFENCE · LEVEL ${String(index + 1).padStart(2, "0")} · ${win ? "HELD" : "BROKEN"}</span>
      <div class="debrief-head"><span class="defence-stars" role="img" aria-label="${stars} of 3 stars">${row}</span><div><h2 id="modal-title">${def.title}</h2><p class="debrief-result"><strong>${win ? "Victory" : "Defeat"}</strong><span>${win ? (stars === 3 ? "Not one through" : stars === 2 ? "The line held" : "Barely held") : "The road is lost"}</span></p></div></div>
      <p class="debrief-difficulty">${DIFFICULTY_LABELS[sim.difficulty || "standard"]}</p>
      <div class="result-grid">${statTile(`${d.lives}`, "Lives left", d.lives ? "" : "loss")}${statTile(`${d.cleared}/${def.defence.waves.length}`, "Waves held")}${statTile(String(Math.round(killed)), "Enemies defeated")}${statTile(String(d.bounty), "Bounty alloy", "alloy")}${statTile(formatClock(sim.time), "Time", "time")}</div>
      <div class="debrief-actions">${next >= 0 ? `<button class="primary" data-defence-next="${next}"><span>Next level</span>${icon("arrow")}</button><button class="secondary" data-restart>Retry</button>` : `<button class="primary" data-restart><span>Retry</span>${icon("arrow")}</button>`}<button class="secondary" data-new-game>Levels</button></div>
    </div>`;
    document.querySelector("#modal .modal").scrollTop = 0;
    $("modal").querySelector(".primary")?.focus({ preventScroll: true });
  }
  // Endless and the Daily seed: the score is the waves held; the best one is kept in this browser.
  function scoreResult() {
    const sim = S.sim, def = sim.missionDef, d = sim.defence, variant = def.variant, day = dayKey(), score = d.cleared;
    const before = bestScore(loadDefence(), variant, def.id, day);
    S.defenceProgress = recordScore(loadDefence(), variant, def.id, score, day);
    saveDefence(S.defenceProgress);
    const best = Math.max(before, score), record = score > before;
    const killed = S.matchStats?.stats?.killed ?? 0;
    $("modal").classList.add("debrief-wide");
    $("modal-content").innerHTML = `<div class="debrief defence-result defence-score" data-result="score" data-variant="${variant}" data-score="${score}">
      <span class="eyebrow">${variant === "daily" ? "DEFENCE · DAILY SEED" : "DEFENCE · ENDLESS"}</span>
      <div class="debrief-head"><span class="defence-score-big" translate="no">${score}</span><div><h2 id="modal-title">${def.title}</h2><p class="debrief-result"><strong>${score === 1 ? "1 wave held" : `${score} waves held`}</strong><span>${record ? "New best!" : `Best: ${best}`}</span></p></div></div>
      <p class="debrief-difficulty">${DIFFICULTY_LABELS[sim.difficulty || "standard"]}${variant === "daily" ? ` · <span translate="no">${day}</span>` : ""}</p>
      <div class="result-grid">${statTile(String(score), "Waves held")}${statTile(String(best), "Best")}${statTile(String(Math.round(killed)), "Enemies defeated")}${statTile(String(d.bounty), "Bounty alloy", "alloy")}${statTile(formatClock(sim.time), "Time", "time")}</div>
      <div class="debrief-actions"><button class="primary" data-restart><span>Try again</span>${icon("arrow")}</button><button class="secondary" data-new-game>Levels</button></div>
    </div>`;
    document.querySelector("#modal .modal").scrollTop = 0;
    $("modal").querySelector(".primary")?.focus({ preventScroll: true });
  }
  $("modal").addEventListener("click", async (event) => {
    const next = event.target.closest("[data-defence-next]");
    if (!next) return;
    S.defencePick = Number(next.dataset.defenceNext);
    S.playMode = "defence";
    S.defenceVariant = "levels";
    await A.newGame();
    // The next level may need models of another faction: start once the briefing is ready again.
    const started = performance.now();
    while (($("start").disabled || !S.view.modelsReady) && performance.now() - started < 90000) await new Promise((resolve) => setTimeout(resolve, 100));
    if (!Z.started && S.playMode === "defence") $("start").click();
  });

  return { begin, hud, idle, tap, result, setOverview, event, get pads() { return pads; }, get aim() { return aim; } };
}
