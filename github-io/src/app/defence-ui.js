// Frontier Defence match interface, imported on first use (app/defence-entry.js):
//  - the pads, drawn as one instanced mesh, coloured by kind (ground, rim, deep) and by selection;
//  - crews standing on their towers (clones of the unit templates, drawn by the same instanced
//    batches as the army) with tier trims through the per-instance tint;
//  - the pad sheet (crews with portraits and costs) and the tower sheet (Upgrade, Sell) in the
//    command card; lives, wave and countdown chips, Call wave and Overview on the battlefield;
//  - the result screen with stars, and the progress record.
// The rules are in src/sim/defence.js; this module only reads the match and sends commands.
// Everything it needs from the always-loaded app arrives as `deps` (app/defence-entry.js): a
// shared import would make the bundler split those modules, and their CSS, into a new chunk.
import * as THREE from "three";
import "../defence-ui.css";

// Tier trims multiply the tower's paint (never a material swap: the batches stay as they are).
export const TIER_TINT = { 1: [1.08, 0.94, 0.8], 2: [0.92, 0.99, 1.1], 3: [1.25, 1.1, 0.62] };
export const TIER_NAMES = { 1: "bronze", 2: "steel", 3: "gold" };
// Pad colours: plain ground, rim (seen from the road), deep (hidden from it), and the picked pad.
const PAD_COLOR = { ground: [0.86, 0.8, 0.66], rim: [1.0, 0.56, 0.2], deep: [0.4, 0.55, 1.05], picked: [1.6, 1.42, 0.62] };
// A crewed pad shows its garrison's tier around the tower's foot: bronze, steel, gold.
const TIER_PAD = { 1: [0.8, 0.46, 0.22], 2: [0.72, 0.84, 0.95], 3: [1.5, 1.08, 0.2] };
// Short crew names for the tiles (the full garrison name is in garrisons.json).
const CREW_LABEL = { ranger: "Rangers", breaker: "Mortar", antitank: "Anti-tank", watcher: "Watcher" };
const CREW_ROLE = {
  ranger: "Single target, long reach. Strong against siege machines.",
  breaker: "Shells burst on groups. Best against swarms on foot.",
  antitank: "Rockets that pierce armour. Best against tanks and other machines.",
  watcher: "Long sight. Reveals hidden units further than any other tower.",
};
const PAD_NOTE = {
  ground: "Ground pad",
  rim: "Rim pad: 2 m more reach and harder hits, but the road can see it.",
  deep: "Deep pad: hidden from the road, but further from it.",
};
const PICK_RADIUS = 26; // px: the nearest pad within this distance of a tap is picked

export function createDefenceUI(S, A, deps) {
  const { $, GARRISONS, starsFor, D, hasPortrait, portrait, icon, ACTION_KEYS, DEFENCE_LEVELS, loadDefence, recordDefence, saveDefence, statTile, formatClock, DIFFICULTY_LABELS, FACTIONS } = deps;
  const Z = S.screen, root = document.documentElement;
  let pads = null, bar = null, seen = null, overview = false, leakAt = -Infinity, affordable = false, burstTier = 0;
  const color = new THREE.Color();

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

  // ---------------------------------------------------------------- Crews on towers
  let towerTop = null;
  // Called by the view whenever a crewed tower is new or changed tier (view.js update()).
  S.view.dressEntity = function dress(o, e) {
    const u = o.userData, type = S.sim.crewType(e.crew, e.team), template = this.teamTemplates.get(`${type}-${e.team}`);
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
    u.dressed = e.tier;
  };

  // ---------------------------------------------------------------- Battlefield bar
  function ensureBar() {
    if (bar?.isConnected) return bar;
    bar = document.createElement("div");
    bar.id = "defence-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Defence status");
    bar.innerHTML = `<span class="dchip lives" title="Lives: each enemy through costs one, a heavy machine two">${icon("shield")}<b id="defence-lives" translate="no">20</b></span>
      <span class="dchip wave" title="Wave"><span>Wave</span> <b id="defence-wave" translate="no">0/10</b><small id="defence-count" translate="no"></small></span>
      <button id="defence-call" type="button" title="Call the next wave now for bonus alloy" aria-label="Call wave">${icon("play")}<span>Call wave</span><small id="defence-bonus" translate="no"></small></button>
      <button id="defence-overview" type="button" aria-pressed="false" title="Overview: see the whole valley" aria-label="Overview">${icon("expand")}</button>`;
    $("stage").append(bar);
    $("defence-call").onclick = () => {
      if (!Z.started || Z.paused || S.sim.result) return;
      if (S.sim.command({ team: 0, type: "waveCall" })) { A.tone(660, 0.12); A.updateUI(); }
    };
    $("defence-overview").onclick = () => setOverview(!overview);
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
    set("defence-wave", `${st.wave}/${st.waves}`);
    set("defence-count", st.countdown !== null ? ` · ${formatClock(st.countdown)}` : st.active ? ` · ${st.enemies}` : "");
    const call = $("defence-call"), bonus = st.canCall ? Math.ceil((st.countdown ?? S.sim.missionDef.defence.gap ?? 16) * 2) : 0;
    call.disabled = !st.canCall || !Z.started || Z.paused;
    set("defence-bonus", st.canCall ? `+${bonus}` : "");
    bar.querySelector(".lives").classList.toggle("low", st.lives <= 5);
  }
  function set(id, text) { const el = $(id); if (el && el.textContent !== text) el.textContent = text; }

  // Notices from what changed since the last look (the rules only emit events the frame loop drains).
  function announce() {
    const d = S.sim.defence;
    if (!seen) { seen = { wave: d.wave, cleared: d.cleared, lives: d.lives }; return; }
    const waves = S.sim.missionDef.defence.waves.length;
    if (d.cleared > seen.cleared && d.cleared < waves) {
      // Music follows on its own: between waves (defence.active false) sound.js picks 'defence-calm'.
      A.notice("Wave held. Your towers are patched up.");
    }
    if (d.wave > seen.wave && d.wave === waves) A.alert("Final wave!");
    if (d.lives < seen.lives && S.sim.time - leakAt > 4) { leakAt = S.sim.time; A.alert("The enemy broke through!"); }
    seen = { wave: d.wave, cleared: d.cleared, lives: d.lives };
  }

  // ---------------------------------------------------------------- Command card sheets
  function crewTile(crew, index, def) {
    const type = S.sim.crewType(crew), g = GARRISONS.crews[crew], cost = g.cost[0], key = ACTION_KEYS[index];
    const stats = S.sim.garrisonStats(crew, 1);
    return `<button class="command-tile defence-crew" data-defence-crew="${crew}" data-tier="1" data-hotkey="${key}" aria-label="${g.name}, ${cost} alloy" title="${key} · ${g.name} · ${CREW_ROLE[crew]} · ${cost} alloy · ${Math.round(stats.range)} m"><kbd class="action-key">${key}</kbd>${hasPortrait(type) ? portrait(type) : icon(D[type]?.icon || "tower")}<span>${CREW_LABEL[crew]}</span><small><b class="alloy-text" translate="no">${cost}</b></small></button>`;
  }
  function padSheet(pad) {
    const def = S.sim.missionDef.defence;
    $("command-label").textContent = "BUILD PAD";
    $("command-context").textContent = pad.high === "rim" ? "RIM" : pad.high === "deep" ? "DEEP" : "GROUND";
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="p:${pad.id}"></i>${def.crews.map((c, i) => crewTile(c, i, def)).join("")}`;
    $("command-hint").textContent = PAD_NOTE[pad.high || "ground"];
  }
  function towerSheet(t) {
    const g = GARRISONS.crews[t.crew], type = S.sim.crewType(t.crew), top = t.tier >= 3;
    const next = top ? null : S.sim.garrisonStats(t.crew, t.tier + 1), cost = top ? 0 : g.cost[t.tier], refund = Math.floor(t.spent * GARRISONS.sell);
    const [k1, k2, k3] = ACTION_KEYS;
    $("command-label").textContent = "GARRISON";
    $("command-context").textContent = `TIER ${t.tier} / 3`;
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="t:${t.id}:${t.tier}"></i>
      <button class="command-tile defence-info" data-defence-act="focus" data-tier="${t.tier}" data-hotkey="${k1}" title="${k1} · ${g.name} · tier ${t.tier} · ${Math.round(t.range)} m"><kbd class="action-key">${k1}</kbd>${hasPortrait(type) ? portrait(type) : icon("tower")}<span>${CREW_LABEL[t.crew]}</span><small><span>Tier</span> <b translate="no">${t.tier}</b></small></button>
      <button class="command-tile defence-upgrade" data-defence-act="upgrade" data-tier="${top ? 3 : t.tier + 1}" data-hotkey="${k2}" ${top ? "disabled" : ""} aria-label="${top ? "Top tier" : `Upgrade to tier ${t.tier + 1}, ${cost} alloy`}" title="${k2} · ${top ? "Top tier" : `Tier ${t.tier + 1}: ${Math.round(next.damage)} damage, ${Math.round(next.range)} m · ${cost} alloy`}"><kbd class="action-key">${k2}</kbd>${icon("bolt")}<span>${top ? "Top tier" : "Upgrade"}</span><small>${top ? icon("check") : `<b class="alloy-text" translate="no">${cost}</b>`}</small></button>
      <button class="command-tile defence-sell" data-defence-act="sell" data-hotkey="${k3}" aria-label="Sell for ${refund} alloy" title="${k3} · Sell: ${refund} alloy back"><kbd class="action-key">${k3}</kbd>${icon("close")}<span>Sell</span><small><b class="alloy-text" translate="no">+${refund}</b></small></button>`;
    $("command-hint").textContent = `${g.name}. ${CREW_ROLE[t.crew]}`;
  }
  function emptySheet() {
    $("command-label").textContent = "DEFENCE";
    $("command-context").textContent = "PADS";
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="none"></i><div class="tactical-hint defence-hint">${icon("tower")}<strong>Crew the pads</strong><p>Tap a pad beside the road, then pick a crew. Tap a tower to upgrade or sell it.</p></div>`;
    $("command-hint").textContent = "";
  }
  function sheet(es) {
    const tower = es.length === 1 && es[0].crew && es[0].team === 0 ? es[0] : null;
    if (tower) S.defencePad = tower.pad;
    // Anything else picked, or the picked pad's tower deselected: no pad.
    else if (es.length || (S.defencePad && S.sim.towerOn(S.defencePad))) S.defencePad = null;
    const pad = !tower && S.defencePad ? S.sim.padById(S.defencePad) : null;
    const key = tower ? `t:${tower.id}:${tower.tier}` : pad ? `p:${pad.id}` : "none";
    const marker = $("commands").querySelector("[data-defence-sheet]");
    if (marker?.dataset.key !== key) {
      $("commands").classList.remove("tactics-card");
      if (tower) towerSheet(tower); else if (pad) padSheet(pad); else emptySheet();
      if (tower && burstTier && burstTier === tower.tier) { burst($("commands").querySelector(".defence-info")); burstTier = 0; }
      affordable = false;
    }
    $("upgrade-actions").innerHTML = "";
    if (tower) $("commands").dataset.tier = String(tower.tier); else delete $("commands").dataset.tier;
    const alloy = S.sim.players[0].alloy, blocked = !Z.started || Z.paused || !!S.sim.result;
    for (const b of $("commands").querySelectorAll("[data-defence-crew]")) b.disabled = blocked || alloy < GARRISONS.crews[b.dataset.defenceCrew].cost[0];
    const up = $("commands").querySelector('[data-defence-act="upgrade"]');
    if (up && tower) {
      const can = tower.tier < 3 && alloy >= GARRISONS.crews[tower.crew].cost[tower.tier];
      up.disabled = blocked || !can;
      // An upgrade that just became affordable throws a few embers (never under motion-off).
      if (can && !affordable && !blocked) burst(up);
      affordable = can;
    }
    const sell = $("commands").querySelector('[data-defence-act="sell"]');
    if (sell) sell.disabled = blocked;
    const focus = $("commands").querySelector('[data-defence-act="focus"]');
    if (focus) focus.disabled = blocked;
  }
  // Six sparks over a tile: transform and opacity only, removed when their animation ends.
  function burst(tile) {
    if (!tile || root.classList.contains("motion-off") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    tile.querySelector(".ember-burst")?.remove();
    const box = document.createElement("span");
    box.className = "ember-burst";
    box.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 6; i++) { const s = document.createElement("span"); s.className = "ember"; s.style.setProperty("--i", String(i)); box.append(s); }
    let left = 6;
    box.addEventListener("animationend", () => { if (--left <= 0) box.remove(); });
    tile.append(box);
  }
  function act(action) {
    if (!Z.started || Z.paused || S.sim.result) return;
    const t = A.selectedEntities()[0];
    if (!t?.crew) return;
    if (action === "upgrade" && S.sim.command({ team: 0, type: "padUpgrade", building: t.id })) { burstTier = t.tier; A.tone(880, 0.14); }
    if (action === "sell" && S.sim.command({ team: 0, type: "padSell", building: t.id })) { S.defencePad = t.pad; A.setSelection([]); A.tone(330, 0.12); }
    if (action === "focus") S.view.focusOn(t.x, t.z);
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
    const crew = event.target.closest("[data-defence-crew]"), action = event.target.closest("[data-defence-act]");
    if (crew && !crew.disabled) build(crew.dataset.defenceCrew);
    else if (action && !action.disabled) act(action.dataset.defenceAct);
  });

  // The selection panel: the picked pad, or the state of the defence when nothing is picked.
  let infoKey = "";
  function info(es) {
    if (es.length) { infoKey = ""; return; }
    const st = S.sim.defenceStatus(), pad = S.defencePad ? S.sim.padById(S.defencePad) : null;
    const key = pad ? `pad:${pad.id}` : `none:${st.wave}:${st.lives}`;
    if (key === infoKey && $("selection-info").querySelector(".defence-panel")) return;
    infoKey = key;
    const foe = FACTIONS[S.sim.missionDef.factions?.[1]];
    $("selection-info").innerHTML = pad
      ? `<div class="selection-empty defence-panel" data-pad="${pad.id}" data-high="${pad.high || "ground"}">${icon("tower")}<div><h3>${pad.high === "rim" ? "Rim pad" : pad.high === "deep" ? "Deep pad" : "Ground pad"}</h3><p>${PAD_NOTE[pad.high || "ground"]}</p><p>Pick a crew in Actions.</p></div></div>`
      : `<div class="selection-empty defence-panel">${icon("shield")}<div><h3>${S.sim.missionDef.title}</h3><p>${foe ? `<span>${foe.name}</span> · ` : ""}<span>Wave</span> <b translate="no">${st.wave}/${st.waves}</b> · <b translate="no">${st.lives}</b> <span>lives</span></p><p>Tap a pad beside the road to crew a tower.</p></div></div>`;
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
    // A picked pad counts as a selection for the docks (landscape phones hide an empty dock).
    if (S.defencePad && !es.length) document.querySelector(".selection-panel").classList.add("has-entity");
    paintPads();
    rangeRing(es);
  }
  // Not a defence match (any more): take the pads and the bar away.
  function idle() {
    hideRing();
    disposePads();
    if (bar) bar.hidden = true;
    delete $("commands").dataset.tier;
  }
  function tap(x, y) {
    if (!Z.started || Z.paused || S.sim.result || S.mode) return false;
    const target = S.view.pick(x, y, S.sim, 24);
    if (target?.team === 0 && target.crew) { S.defencePad = target.pad; A.setSelection([target.id]); return picked(); }
    const pad = nearestPad(x, y);
    if (pad) {
      S.defencePad = pad.id;
      const t = S.sim.towerOn(pad.id);
      A.setSelection(t ? [t.id] : []);
      return picked();
    }
    S.defencePad = null;
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
  $("modal").addEventListener("click", async (event) => {
    const next = event.target.closest("[data-defence-next]");
    if (!next) return;
    S.defencePick = Number(next.dataset.defenceNext);
    S.playMode = "defence";
    await A.newGame();
    // The next level may need models of another faction: start once the briefing is ready again.
    const started = performance.now();
    while (($("start").disabled || !S.view.modelsReady) && performance.now() - started < 90000) await new Promise((resolve) => setTimeout(resolve, 100));
    if (!Z.started && S.playMode === "defence") $("start").click();
  });

  return { begin, hud, idle, tap, result, setOverview, get pads() { return pads; } };
}
