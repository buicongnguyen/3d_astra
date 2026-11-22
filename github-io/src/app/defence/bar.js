// Frontier Defence, the battlefield bar and what hangs off it: lives / wave / Call wave / speed /
// view chips, the follow camera, the wave intel strip, the new-enemy card, carrier moments, notices.
import { TRAITS, ELITE_TRAITS, waveAffixes, waveTraits, traitsOf, counterCrews, waveTypes } from "../../defence/traits.js";
import { CREW_LABEL, ROUTE_LABEL, FLOAT_SECONDS, VIEWS, VIEW_ICON, VIEW_TITLE, FOLLOW_HOLD_MS, CARD_MS } from "./constants.js";

export function createBar(c) {
  const { S, A, Z, root, ui, key, phone, selectedSquad } = c;
  const { loadDefence: loadProgress, saveDefence: saveProgress } = c.deps;
  const { GARRISONS, D, hasPortrait, portrait, icon, formatClock, $ } = c.deps;
  // Called across modules: bound when every module exists.
  const picked = (...a) => c.picked(...a);
  // The same two helpers as defence/progress.js (hasSeen, recordSeen); importing that module here would split a shared chunk out of the main bundle (see the note above the deps).
  const hasSeen = (p, type) => (p.seen || []).includes(type);
  const recordSeen = (p, types) => { const fresh = types.filter((t) => D[t] && !hasSeen(p, t)); return fresh.length ? { ...p, seen: [...(p.seen || []), ...fresh] } : p; };
  // ---------------------------------------------------------------- Battlefield bar
  function ensureBar() {
    if (ui.bar?.isConnected) return ui.bar;
    ui.bar = document.createElement("div");
    ui.bar.id = "defence-bar";
    ui.bar.setAttribute("role", "group");
    ui.bar.setAttribute("aria-label", "Defence status");
    ui.bar.innerHTML = `<span class="dchip lives" title="Lives: each enemy through costs one, a heavy machine two">${icon("shield")}<b id="defence-lives" translate="no">20</b></span>
      <span class="dchip wave" title="Wave"><span>Wave</span> <b id="defence-wave" translate="no">0/10</b><span class="phone-wave-label" id="wave-next">Next wave</span><span class="phone-wave-label" id="wave-enemy" hidden>Enemies left</span><small id="defence-count" translate="no"></small></span>
      <button id="defence-hero" type="button" title="The commander: tap to pick, then tap the road to send it" aria-label="Field commander" hidden>${icon("flag")}<span class="bar-caption">Hero</span><small id="defence-hero-state" translate="no"></small></button>
      <button id="defence-armour" type="button" title="Armour: tap to pick the next squad, or to buy one at the depot" aria-label="Armour squads" hidden>${icon("tank")}<span class="bar-caption">Squad</span><small id="defence-armour-state" translate="no"></small></button>
      <button id="defence-call" type="button" title="Call the next wave now for bonus alloy" aria-label="Call wave">${icon("play")}<span>Call wave</span><small id="defence-bonus" translate="no"></small></button>
      <button id="defence-speed" type="button" aria-pressed="false" title="Fast-forward: tap to change the speed (Shift+Space)" aria-label="Game speed"><b id="defence-speed-label" translate="no">×1</b></button>
      <button id="defence-overview" type="button" aria-pressed="false" data-view="free" title="View: free camera. Tap to follow the wave." aria-label="View">${icon("move")}<span class="bar-caption">View</span></button>`;
    $("stage").append(ui.bar);
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
    $("defence-overview").onclick = () => { setView(nextView()); A.notice(VIEW_NOTE[ui.viewMode]); A.updateUI(); };
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
    return ui.bar;
  }
  function setOverview(on) {
    const cam = S.sim.missionDef.defence.camera;
    ui.overview = on;
    S.view.maxZoom = cam.maxZoom;
    S.view.zoom = on ? cam.maxZoom : cam.zoom;
    if (on) S.view.focusOn(cam.x, cam.z); else S.view.updateCamera();
    $("defence-overview")?.setAttribute("aria-pressed", String(on));
  }
  // The view button (W1-F): Follow -> Overview -> Free. A phone opens on Follow, a desktop on Free; a desktop skips Follow (its first tap is the Overview, as before).
  const VIEW_NOTE = { follow: "Following the wave.", overview: "Overview: the whole valley.", free: "Free camera." };
  function nextView() {
    const ring = phone() ? VIEWS : VIEWS.filter((v) => v !== "follow");
    return ring[(ring.indexOf(ui.viewMode) + 1) % ring.length];
  }
  function setView(mode) {
    const cam = S.sim.missionDef.defence.camera, v = S.view;
    if (mode === "overview") { if (ui.viewMode !== "overview") ui.saved = { zoom: v.zoom, x: v.focus.x, z: v.focus.z }; setOverview(true); }
    else {
      if (ui.viewMode === "overview") { ui.overview = false; v.zoom = ui.saved?.zoom ?? cam.zoom; if (ui.saved) v.focusOn(ui.saved.x, ui.saved.z); v.updateCamera(); $("defence-overview")?.setAttribute("aria-pressed", "false"); }
      ui.follow.pauseUntil = 0;
    }
    ui.viewMode = mode;
    paintView();
  }
  function paintView() {
    const b = $("defence-overview");
    if (!b || b.dataset.view === ui.viewMode) return;
    b.dataset.view = ui.viewMode;
    b.innerHTML = icon(VIEW_ICON[ui.viewMode]) + '<span class="bar-caption">View</span>';
    b.title = VIEW_TITLE[ui.viewMode];
    b.setAttribute("aria-pressed", String(ui.viewMode === "overview"));
  }
  // Follow camera (per frame, from the frame loop): the front of the wave, eased; a manual pan or zoom holds it for 6 s.
  function frontOfWave() {
    const foes = S.sim.entities.filter((e) => e.team === 1 && e.kind === "unit" && e.hp > 0 && S.sim.isVisible(e, 0)).map((e) => ({ e, left: S.sim.roadLeft(e) })).sort((a, b) => a.left - b.left).slice(0, 3);
    if (foes.length) return { x: foes.reduce((n, f) => n + f.e.x, 0) / foes.length, z: foes.reduce((n, f) => n + f.e.z, 0) / foes.length };
    return null;
  }
  function frame(dt) {
    c.guideFrame?.();
    if (ui.viewMode !== "follow" || !S.sim?.defence || !Z.started || Z.paused || S.sim.result || Z.modalType || !S.view) return;
    const v = S.view, now = performance.now();
    if (ui.follow.set && (Math.abs(v.focus.x - ui.follow.x) > 0.02 || Math.abs(v.focus.z - ui.follow.z) > 0.02 || Math.abs(v.zoom - ui.follow.zoom) > 0.01)) ui.follow.pauseUntil = now + FOLLOW_HOLD_MS;
    const target = now < ui.follow.pauseUntil ? null : frontOfWave();
    if (target) {
      const k = 1 - Math.exp(-dt * 2.5);
      v.focusOn(v.focus.x + (target.x - v.focus.x) * k, v.focus.z + (target.z - v.focus.z) * k);
    }
    Object.assign(ui.follow, { x: v.focus.x, z: v.focus.z, zoom: v.zoom, set: true });
  }
  A.defenceFrame = frame;
  function updateBar() {
    const st = S.sim.defenceStatus();
    if (!st || !ui.bar) return;
    set("defence-lives", String(st.lives));
    set("defence-wave", st.endless ? String(st.wave) : `${st.wave}/${st.waves}`);
    $("wave-next").hidden = st.countdown === null;
    $("wave-enemy").hidden = st.countdown !== null || !st.active;
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
    const foot = phone() && matchMedia("(orientation: portrait)").matches && !ui.bar.hidden;
    if (foot) root.style.setProperty("--defence-bar-h", `${ui.bar.offsetHeight + 8}px`); else root.style.removeProperty("--defence-bar-h");
    updateCard();
    ui.bar.querySelector(".lives").classList.toggle("low", st.lives <= 5);
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
    if (ui.intel?.isConnected) return ui.intel;
    ui.intel = document.createElement("div");
    ui.intel.id = "defence-intel";
    ui.intel.setAttribute("role", "group");
    ui.intel.setAttribute("aria-label", "Next wave");
    ui.intel.hidden = true;
    $("stage").append(ui.intel);
    ui.intelKey = "";
    return ui.intel;
  }
  function updateIntel(st) {
    const el = ensureIntel(), p = Z.started && st.canCall ? S.sim.wavePreview() : null;
    const key = p ? `${p.wave}|${p.units.map((u) => `${u.type}:${u.count}:${u.carry || 0}:${u.elite || ""}`).join(",")}|${p.routes.join(",")}` : "";
    if (key === ui.intelKey) return;
    ui.intelKey = key;
    el.hidden = !p;
    if (!p) { el.innerHTML = ""; return; }
    const many = Object.keys(S.sim.missionDef.defence.routes).length > 1;
    const unit = (u) => `<span class="intel-unit${u.carry ? " carrier" : ""}${u.elite ? " elite" : ""}" data-type="${u.type}"${u.elite ? ` data-elite="${u.elite}"` : ""} title="${D[u.type]?.name || u.type}">${hasPortrait(u.type) ? portrait(u.type, "hostile") : icon(D[u.type]?.icon || "tank")}<b translate="no">×${u.count}</b>${u.carry ? `<small translate="no">(${u.carry})</small>` : ""}</span>`;
    const chips = waveTraits(p.units, D).map((id) => { const t = TRAITS.find((x) => x.id === id); return `<span class="intel-chip" data-trait="${id}" title="${t.hint}">${t.label}</span>`; }).join("") + waveAffixes(p.units).map((id) => { const t = ELITE_TRAITS.find((x) => x.id === id); return `<span class="intel-chip affix" data-trait="${id}" title="${t.hint}">${t.label}</span>`; }).join("");
    el.innerHTML = (chips ? `<span class="intel-traits">${chips}</span>` : "") + `<span class="intel-line"><span class="intel-head"><span>Next wave</span> <b translate="no">${p.wave}</b></span>${p.units.map(unit).join("")}</span>${many ? `<span class="intel-routes">${p.routes.map((r) => `<span class="intel-route" data-route="${r}">${S.sim.missionDef.defence.roads?.[r] || ROUTE_LABEL[r] || r}</span>`).join("")}</span>` : ""}`;
  }

  // ---------------------------------------------------------------- New-enemy card (W1-F)
  // The first time an enemy type is in a wave the player has started: its traits and two crews that counter it.
  // Shown once per type (progress.seen), one card at a time, closed by a tap or after 6 s; never over a modal.
  // Off under ?test unless the URL has ?enemycards.
  const cardsOn = () => !S.query?.has("test") || S.query.has("enemycards");
  function queueCards() {
    const d = S.sim.defence;
    if (!cardsOn() || d.wave === ui.cardWave || d.wave < 1) return;
    ui.cardWave = d.wave;
    const progress = S.defenceProgress || loadProgress(), wave = S.sim.defenceWave(d.wave - 1);
    if (!wave) return;
    for (const u of waveTypes(wave.groups, (g, slot) => S.sim.waveType(g, slot))) if (!hasSeen(progress, u.type) && !ui.cardQueue.some((c) => c.type === u.type)) ui.cardQueue.push(u);
  }
  function closeCard() { ui.cardEl?.remove(); ui.cardEl = null; }
  function updateCard() {
    if (!S.sim?.defence) return;
    queueCards();
    if (Z.modalType || Z.paused || !Z.started || S.sim.result) { closeCard(); return; }
    const now = performance.now();
    if (ui.cardEl && now - ui.cardAt > CARD_MS) closeCard();
    if (ui.cardEl || !ui.cardQueue.length) return;
    const u = ui.cardQueue.shift(), def = D[u.type];
    if (!def) return;
    S.defenceProgress = recordSeen(S.defenceProgress || loadProgress(), [u.type]);
    saveProgress(S.defenceProgress);
    const crews = counterCrews(u, D, S.sim.missionDef.defence.crews), ids = traitsOf(u, D);
    ui.cardEl = document.createElement("div");
    ui.cardEl.id = "defence-card";
    ui.cardEl.setAttribute("role", "status");
    ui.cardEl.innerHTML = `<span class="card-art">${hasPortrait(u.type) ? portrait(u.type, "hostile") : icon(def.icon || "tank")}</span><span class="card-body"><span class="card-eyebrow">New enemy</span><strong>${def.name}</strong><span class="card-chips">${ids.map((id) => { const t = TRAITS.find((x) => x.id === id); return `<span class="intel-chip" data-trait="${id}">${t.label}</span>`; }).join("")}</span><span class="card-counter"><span>Best crews</span> ${crews.map((c) => `<b data-crew="${c}">${CREW_LABEL[c]}</b>`).join("")}</span></span>`;
    ui.cardEl.onclick = closeCard;
    $("stage").append(ui.cardEl);
    ui.cardAt = now;
  }

  // ---------------------------------------------------------------- Carrier moments (0.22)
  // A squad dropped: an alert. A carrier lost with its squad: "+N" alloy rising over the wreck
  // (a DOM chip, transform/opacity only, still under motion-off; the blast is the rules' strike).
  function event(e) {
    if (e.type === "drop") { if (S.sim.time - (ui.dropAt ?? -Infinity) > 6) { ui.dropAt = S.sim.time; A.alert("A carrier is dropping troops!"); } return; }
    // Armour (0.23): a squad bought is picked at once, so the next tap sends it.
    if (e.type === "armourBuy") { A.notice("Armour squad ready. Tap the map to send it."); return; }
    if (e.type === "armourRefit") { if (S.sim.time - (ui.refitAt ?? -Infinity) > 2) { ui.refitAt = S.sim.time; A.notice("Armour refitted to full strength."); } return; }
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
  // Notices from what changed since the last look (the rules only emit events the frame loop drains).
  function announce() {
    const d = S.sim.defence, cs = S.sim.crossings || {};
    const crossings = Object.fromEntries(Object.entries(cs).map(([x, c]) => [x, `${c.state}${c.state === "blown" && c.progress > 0 ? "+" : ""}`]));
    const hero = !!S.sim.commander();
    if (!ui.seen) { ui.seen = { wave: d.wave, cleared: d.cleared, lives: d.lives, crossings, hero }; return; }
    const total = S.sim.waveTotal();
    if (d.cleared > ui.seen.cleared && d.cleared < total) {
      // Music follows on its own: between waves (defence.active false) sound.js picks 'defence-calm'.
      A.notice("Wave held. Your towers are patched up.");
    }
    if (d.wave > ui.seen.wave && d.wave === total) A.alert("Final wave!");
    if (d.lives < ui.seen.lives && S.sim.time - ui.leakAt > 4) { ui.leakAt = S.sim.time; A.alert("The enemy broke through!"); }
    // R3-E: lives lost per wave, for the result's next-star hint.
    if (d.lives < ui.seen.lives) (ui.leaks ||= {})[d.wave] = (ui.leaks[d.wave] || 0) + ui.seen.lives - d.lives;
    for (const [x, now] of Object.entries(crossings)) {
      const was = ui.seen.crossings[x];
      if (now === was) continue;
      if (now === "fuse") A.alert("Charge set: the bridge blows in 3 seconds.");
      else if (now === "blown" && was === "fuse") { A.notice("Bridge down. The columns turn to another crossing."); A.tone(110, 0.3); }
      else if (now === "blown+") A.alert("Bridge builders at the river!");
      else if (now === "pontoon") A.alert("A pontoon is across the river!");
    }
    if (ui.seen.hero && !hero) A.alert("The commander is down: back in 20 seconds.");
    else if (!ui.seen.hero && hero && d.hero) A.notice("The commander is back on the field.");
    ui.seen = { wave: d.wave, cleared: d.cleared, lives: d.lives, crossings, hero };
  }
  Object.assign(c, { ensureBar, setOverview, nextView, setView, paintView, frontOfWave, frame, updateBar, set, ensureIntel, updateIntel, queueCards, closeCard, updateCard, event, announce });
}
