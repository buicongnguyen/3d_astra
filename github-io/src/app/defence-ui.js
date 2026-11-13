// Frontier Defence match interface, imported on first use (app/defence-entry.js):
//  - the pads, drawn as one instanced mesh, coloured by kind (ground, rim, deep) and by selection;
//  - crews standing on their towers (clones of the unit templates, drawn by the same instanced
//    batches as the army) with tier trims through the per-instance tint; the commander in gold;
//  - the pad sheet (crews with portraits and costs), the tower sheet (Upgrade, Sell, and at tier 3
//    the two branches), the commander sheet (Barrage, Reinforce) and the bridge sheet (Blow
//    bridge) in the command card; lives, wave and countdown chips, Commander, Call wave and
//    Overview on the battlefield;
//  - blown bridges hidden, pontoons (one merged mesh each) and the fuse light;
//  - the result screen with stars (or waves held, in Endless and the Daily seed), and progress.
// The rules are in src/sim/defence.js; this module only reads the match and sends commands.
// Everything it needs from the always-loaded app arrives as `deps` (app/defence-entry.js): a
// shared import would make the bundler split those modules, and their CSS, into a new chunk.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import "../defence-ui.css";

// Tier trims multiply the tower's paint (never a material swap: the batches stay as they are).
export const TIER_TINT = { 1: [1.08, 0.94, 0.8], 2: [0.92, 0.99, 1.1], 3: [1.25, 1.1, 0.62] };
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
const PAD_NOTE = {
  ground: "Ground pad",
  rim: "Rim pad: 2 m more reach and harder hits, but the road can see it.",
  deep: "Deep pad: hidden from the road, but further from it.",
};
const PICK_RADIUS = 26; // px: the nearest pad within this distance of a tap is picked
const BRIDGE_RADIUS = 44; // px: a tap this close to a bridge's middle picks it
// Pontoon planks: one merged mesh per pontoon, grown from the north bank while it is built.
const PONTOON_LENGTH = 9;

export function createDefenceUI(S, A, deps) {
  const { $, GARRISONS, starsFor, D, hasPortrait, portrait, icon, ACTION_KEYS, DEFENCE_LEVELS, loadDefence, recordDefence, saveDefence, statTile, formatClock, DIFFICULTY_LABELS, FACTIONS, CROSSINGS, recordScore, bestScore, dayKey } = deps;
  const Z = S.screen, root = document.documentElement;
  let pads = null, bar = null, seen = null, overview = false, leakAt = -Infinity, affordable = false, burstTier = 0, aim = null;
  const color = new THREE.Color();
  const key = (i) => ACTION_KEYS[i] || "";
  const kbd = (k) => (k ? `<kbd class="action-key">${k}</kbd>` : "");
  const motionOff = () => root.classList.contains("motion-off") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  S.defenceBridge ??= null;

  // ---------------------------------------------------------------- Pads
  function buildPads() {
    const def = S.sim.missionDef.defence, view = S.view;
    if (pads?.def === def && pads.view === view && pads.terrain === view.terrain) return;
    disposePads();
    const geometry = new THREE.CylinderGeometry(2.05, 2.25, 0.2, 6).translate(0, 0.1, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.08, name: "DefencePad" });
    const mesh = new THREE.InstancedMesh(geometry, material, def.pads.length);
    mesh.name = "defence-pads";
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    const m = new THREE.Matrix4();
    def.pads.forEach((p, i) => {
      m.makeRotationY(Math.PI / 6).setPosition(p.x, view.terrain.heightAt(p.x, p.z) + 0.02, p.z);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.setRGB(...PAD_COLOR[p.high || "ground"]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    view.scene.add(mesh);
    pads = { def, view, terrain: view.terrain, mesh, key: "" };
  }
  function disposePads() {
    disposeCrossings();
    if (!pads) return;
    pads.mesh.removeFromParent();
    pads.mesh.geometry.dispose();
    pads.mesh.material.dispose();
    pads.mesh.dispose();
    pads = null;
  }
  function paintPads() {
    if (!pads) return;
    const tiers = pads.def.pads.map((p) => S.sim.towerOn(p.id)?.tier || 0), key = `${S.defencePad}:${tiers.join("")}`;
    if (pads.key === key) return;
    pads.key = key;
    pads.def.pads.forEach((p, i) => pads.mesh.setColorAt(i, color.setRGB(...(p.id === S.defencePad ? PAD_COLOR.picked : tiers[i] ? TIER_PAD[tiers[i]] : PAD_COLOR[p.high || "ground"]))));
    pads.mesh.instanceColor.needsUpdate = true;
  }
  function nearestPad(x, y) {
    const rect = S.view.renderer.domElement.getBoundingClientRect();
    let best = null, bestD = PICK_RADIUS;
    for (const p of S.sim.missionDef.defence.pads) {
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
    const tint = TIER_TINT[e.tier] || TIER_TINT[1];
    u.model.traverse((part) => { if (part.isMesh) part.userData.tint = tint; });
    // The hit flash restores what it found; it must find the new trim.
    if (u.flashParts) { u.flashBase = u.flashParts.map(() => tint); if (u.flashLit) for (const part of u.flashParts) part.userData.tint = u.flashTint; }
    u.dressed = e.branch ? `${e.tier}${e.branch}` : e.tier;
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
      <button id="defence-call" type="button" title="Call the next wave now for bonus alloy" aria-label="Call wave">${icon("play")}<span>Call wave</span><small id="defence-bonus" translate="no"></small></button>
      <button id="defence-overview" type="button" aria-pressed="false" title="Overview: see the whole valley" aria-label="Overview">${icon("expand")}</button>`;
    $("stage").append(bar);
    $("defence-call").onclick = () => {
      if (!Z.started || Z.paused || S.sim.result) return;
      if (S.sim.command({ team: 0, type: "waveCall" })) { A.tone(660, 0.12); A.updateUI(); }
    };
    $("defence-overview").onclick = () => setOverview(!overview);
    $("defence-hero").onclick = () => {
      const hero = S.sim.commander();
      if (!hero || !Z.started || Z.paused) return;
      S.defencePad = null;
      S.defenceBridge = null;
      A.setSelection([hero.id]);
      S.view.focusOn(hero.x, hero.z);
      picked();
    };
    return bar;
  }
  function setOverview(on) {
    const cam = S.sim.missionDef.defence.camera;
    overview = on;
    S.view.maxZoom = cam.maxZoom;
    S.view.zoom = on ? cam.maxZoom : cam.zoom;
    if (on) S.view.focusOn(cam.x, cam.z); else S.view.updateCamera();
    $("defence-overview")?.setAttribute("aria-pressed", String(on));
  }
  function updateBar() {
    const st = S.sim.defenceStatus();
    if (!st || !bar) return;
    set("defence-lives", String(st.lives));
    set("defence-wave", st.endless ? String(st.wave) : `${st.wave}/${st.waves}`);
    set("defence-count", st.countdown !== null ? ` · ${formatClock(st.countdown)}` : st.active ? ` · ${st.enemies}` : "");
    const call = $("defence-call"), bonus = st.canCall ? Math.ceil((st.countdown ?? S.sim.missionDef.defence.gap ?? 16) * 2) : 0;
    call.disabled = !st.canCall || !Z.started || Z.paused;
    set("defence-bonus", st.canCall ? `+${bonus}` : "");
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
  }
  function set(id, text) { const el = $(id); if (el && el.textContent !== text) el.textContent = text; }

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
    $("command-context").textContent = pad.high === "rim" ? "RIM" : pad.high === "deep" ? "DEEP" : "GROUND";
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="p:${pad.id}"></i>${def.crews.map((c, i) => crewTile(c, i)).join("")}`;
    $("command-hint").textContent = PAD_NOTE[pad.high || "ground"];
  }
  function towerSheet(t) {
    const g = GARRISONS.crews[t.crew], type = S.sim.crewType(t.crew), top = t.tier >= 3, choose = top && !t.branch && g.branches;
    const next = top ? null : S.sim.garrisonStats(t.crew, t.tier + 1), cost = top ? 0 : g.cost[t.tier], refund = Math.floor(t.spent * GARRISONS.sell);
    const branchName = t.branch ? g.branches[t.branch].name : "";
    $("command-label").textContent = "GARRISON";
    $("command-context").textContent = choose ? "CHOOSE ONE" : `TIER ${t.tier} / 3`;
    const info = `<button class="command-tile defence-info" data-defence-act="focus" data-tier="${t.tier}"${t.branch ? ` data-branch="${t.branch}"` : ""} data-hotkey="${key(0)}" title="${key(0)} · ${g.name} · tier ${t.tier}${branchName ? ` · ${branchName}` : ""} · ${Math.round(t.range)} m">${kbd(key(0))}${hasPortrait(type) ? portrait(type) : icon("tower")}<span>${CREW_LABEL[t.crew]}</span><small>${branchName ? `<b>${branchName}</b>` : `<span>Tier</span> <b translate="no">${t.tier}</b>`}</small></button>`;
    // Tier 3 without a branch: the two branches side by side, gold like the tier they crown.
    const middle = choose
      ? Object.entries(g.branches).map(([id, b], i) => `<button class="command-tile defence-branch" data-defence-branch="${id}" data-tier="3" data-hotkey="${key(i + 1)}" aria-label="${b.name}, ${b.cost} alloy" title="${key(i + 1)} · ${b.name}: ${BRANCH_TEXT[id]} · ${b.cost} alloy">${kbd(key(i + 1))}${icon(i ? "crosshair" : "bolt")}<span>${b.name}</span><small><b class="alloy-text" translate="no">${b.cost}</b></small></button>`).join("")
      : `<button class="command-tile defence-upgrade" data-defence-act="upgrade" data-tier="${top ? 3 : t.tier + 1}" data-hotkey="${key(1)}" ${top ? "disabled" : ""} aria-label="${top ? "Top tier" : `Upgrade to tier ${t.tier + 1}, ${cost} alloy`}" title="${key(1)} · ${top ? "Top tier" : `Tier ${t.tier + 1}: ${Math.round(next.damage)} damage, ${Math.round(next.range)} m · ${cost} alloy`}">${kbd(key(1))}${icon("bolt")}<span>${top ? "Top tier" : "Upgrade"}</span><small>${top ? icon("check") : `<b class="alloy-text" translate="no">${cost}</b>`}</small></button>`;
    const sellKey = key(choose ? 3 : 2);
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="t:${t.id}:${t.tier}:${t.branch || ""}"></i>${info}${middle}
      <button class="command-tile defence-sell" data-defence-act="sell" data-hotkey="${sellKey}" aria-label="Sell for ${refund} alloy" title="${sellKey} · Sell: ${refund} alloy back">${kbd(sellKey)}${icon("close")}<span>Sell</span><small><b class="alloy-text" translate="no">+${refund}</b></small></button>`;
    $("command-hint").textContent = choose ? "Gold tier: pick one branch for this tower. It cannot be changed." : t.branch ? `${g.name} · ${branchName}. ${BRANCH_TEXT[t.branch]}` : `${g.name}. ${CREW_ROLE[t.crew]}`;
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
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="none"></i><div class="tactical-hint defence-hint">${icon("tower")}<strong>Crew the pads</strong><p>Tap a pad beside the road, then pick a crew. Tap a tower to upgrade or sell it.</p></div>`;
    $("command-hint").textContent = "";
  }
  function sheet(es) {
    const tower = es.length === 1 && es[0].crew && es[0].team === 0 ? es[0] : null, hero = es.length === 1 && es[0].hero ? es[0] : null;
    if (tower) S.defencePad = tower.pad;
    // Anything else picked, or the picked pad's tower deselected: no pad.
    else if (es.length || (S.defencePad && S.sim.towerOn(S.defencePad))) S.defencePad = null;
    if (es.length) S.defenceBridge = null;
    if (!hero && aim) setAim(null);
    const pad = !tower && !hero && S.defencePad ? S.sim.padById(S.defencePad) : null;
    const bridge = !tower && !hero && !pad ? S.defenceBridge : null;
    const k = tower ? `t:${tower.id}:${tower.tier}:${tower.branch || ""}` : hero ? `h:${hero.id}:${aim || ""}` : pad ? `p:${pad.id}` : bridge !== null ? `b:${bridge}:${S.sim.crossingState(bridge)}` : "none";
    const marker = $("commands").querySelector("[data-defence-sheet]");
    if (marker?.dataset.key !== k) {
      $("commands").classList.remove("tactics-card");
      if (tower) towerSheet(tower); else if (hero) heroSheet(hero); else if (pad) padSheet(pad); else if (bridge !== null) bridgeSheet(bridge); else emptySheet();
      if (tower && burstTier && burstTier === tower.tier) { burst($("commands").querySelector(".defence-info")); burstTier = 0; }
      affordable = false;
    }
    $("upgrade-actions").innerHTML = "";
    if (tower) $("commands").dataset.tier = String(tower.tier); else delete $("commands").dataset.tier;
    const alloy = S.sim.players[0].alloy, blocked = !Z.started || Z.paused || !!S.sim.result;
    for (const b of $("commands").querySelectorAll("[data-defence-crew]")) b.disabled = blocked || alloy < S.sim.buildCost(b.dataset.defenceCrew);
    for (const b of $("commands").querySelectorAll("[data-defence-branch]")) b.disabled = blocked || alloy < S.sim.branchCost(tower.crew, b.dataset.defenceBranch);
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
    if (!Z.started || Z.paused || S.sim.result || !S.defencePad) return;
    const pad = S.defencePad;
    if (S.sim.command({ team: 0, type: "padBuild", pad, crew })) {
      A.tone(740, 0.14);
      const t = S.sim.towerOn(pad);
      if (t) A.setSelection([t.id]);
      // Phones: stay on the card with the new tower's Upgrade and Sell.
      if (root.classList.contains("compact-ui")) A.dockTab("actions");
    }
    A.updateUI();
  }
  $("commands").addEventListener("click", (event) => {
    if (!S.sim?.defence) return;
    const crew = event.target.closest("[data-defence-crew]"), action = event.target.closest("[data-defence-act]"), pick = event.target.closest("[data-defence-branch]"), hero = event.target.closest("[data-defence-hero]");
    if (crew && !crew.disabled) build(crew.dataset.defenceCrew);
    else if (pick && !pick.disabled) branch(pick.dataset.defenceBranch);
    else if (hero && !hero.disabled) heroAct(hero.dataset.defenceHero);
    else if (action && !action.disabled) act(action.dataset.defenceAct, action);
  });

  // The selection panel: the picked pad or bridge, or the state of the defence when nothing is picked.
  let infoKey = "";
  function info(es) {
    if (es.length) { infoKey = ""; return; }
    const st = S.sim.defenceStatus(), pad = S.defencePad ? S.sim.padById(S.defencePad) : null, bridge = !pad ? S.defenceBridge : null;
    const k = pad ? `pad:${pad.id}` : bridge !== null ? `bridge:${bridge}` : `none:${st.wave}:${st.lives}`;
    if (k === infoKey && $("selection-info").querySelector(".defence-panel")) return;
    infoKey = k;
    const foe = FACTIONS[S.sim.missionDef.factions?.[1]];
    $("selection-info").innerHTML = pad
      ? `<div class="selection-empty defence-panel" data-pad="${pad.id}" data-high="${pad.high || "ground"}">${icon("tower")}<div><h3>${pad.high === "rim" ? "Rim pad" : pad.high === "deep" ? "Deep pad" : "Ground pad"}</h3><p>${PAD_NOTE[pad.high || "ground"]}</p><p>Pick a crew in Actions.</p></div></div>`
      : bridge !== null
        ? `<div class="selection-empty defence-panel" data-bridge="${bridge}">${icon("barrage")}<div><h3>${bridge < 0 ? "West bridge" : "East bridge"}</h3><p>Blow it in Actions: the waves on this road turn to another crossing.</p></div></div>`
        : `<div class="selection-empty defence-panel">${icon("shield")}<div><h3>${S.sim.missionDef.title}</h3><p>${foe ? `<span>${foe.name}</span> · ` : ""}<span>Wave</span> <b translate="no">${st.endless ? st.wave : `${st.wave}/${st.waves}`}</b> · <b translate="no">${st.lives}</b> <span>lives</span></p><p>Tap a pad beside the road to crew a tower.</p></div></div>`;
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
    const t = es.length === 1 && es[0].crew ? es[0] : null, pad = !t && S.defencePad ? S.sim.padById(S.defencePad) : null, at = t || pad;
    const preview = S.view.preview;
    if (!at || S.mode) { hideRing(); return; }
    ring ||= { opacity: preview.material.opacity, color: preview.material.color.getHex() };
    const reach = (t ? t.range : S.sim.garrisonStats("ranger", 1).range) + (S.view.terrain.level(at.x, at.z) ? 2 : 0);
    preview.visible = true;
    preview.position.set(at.x, S.view.terrain.heightAt(at.x, at.z) + 0.12, at.z);
    preview.scale.set(reach, 1, reach);
    preview.material.color.setHex(0x92ebc5);
    preview.material.opacity = 0.14;
  }

  // ---------------------------------------------------------------- Lifecycle
  function begin(resume = false) {
    if (!S.sim?.defence) return;
    buildPads();
    ensureBar();
    seen = null;
    S.defencePad = null;
    S.defenceBridge = null;
    setAim(null);
    if (cross) cross.key = "";
    const cam = S.sim.missionDef.defence.camera;
    S.view.maxZoom = cam.maxZoom;
    setOverview(false);
    S.view.focusOn(cam.x, cam.z);
    // The skirmish opening line ("assign Harvesters") does not apply here.
    S.sim.events = S.sim.events.filter((e) => e.type !== "message");
    if (!resume && Z.started) A.notice("Tap a pad beside the road, then pick a crew.");
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
    if ((S.defencePad || S.defenceBridge !== null) && !es.length) document.querySelector(".selection-panel").classList.add("has-entity");
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
    delete $("commands").dataset.tier;
  }
  function tap(x, y) {
    if (!Z.started || Z.paused || S.sim.result || S.mode) return false;
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
    if (target?.hero) { S.defencePad = null; S.defenceBridge = null; A.setSelection([target.id]); return picked(); }
    const pad = nearestPad(x, y);
    if (pad) {
      S.defencePad = pad.id;
      S.defenceBridge = null;
      const t = S.sim.towerOn(pad.id);
      A.setSelection(t ? [t.id] : []);
      return picked();
    }
    const bridge = nearestBridge(x, y, point);
    if (bridge !== null) {
      S.defencePad = null;
      S.defenceBridge = bridge;
      A.setSelection([]);
      return picked();
    }
    // The commander picked: a tap on open ground sends it there.
    if (hero && S.selected.has(hero.id) && point && !(target?.team > 0)) {
      if (S.sim.command({ team: 0, type: "heroMove", x: point.x, z: point.z })) A.tone(560, 0.08);
      else A.notice("The commander cannot go there.");
      A.updateUI();
      return true;
    }
    S.defencePad = null;
    S.defenceBridge = null;
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

  return { begin, hud, idle, tap, result, setOverview, get pads() { return pads; }, get aim() { return aim; } };
}
