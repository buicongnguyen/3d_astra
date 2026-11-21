// Frontier Defence, the command card sheets (pad, zone, tower, commander, armour, depot, bridge)
// and the selection panel. Text only; the clicks are handled in input.js.
import { CREW_LABEL, CREW_ROLE, BRANCH_TEXT, RANK_TEXT, ARMOUR_TEXT, PAD_NOTE, AIM_LABEL, AIM_TEXT } from "./constants.js";

export function createSheets(c) {
  const { S, A, Z, root, ui, key, kbd, motionOff, selectedSquad } = c;
  const { GARRISONS, D, hasPortrait, portrait, icon, FACTIONS, ZONE_NAMES, $ } = c.deps;
  // Called across modules: bound when every module exists.
  const setAim = (...a) => c.setAim(...a);
  const zoneName = (zone) => ZONE_NAMES[S.sim.missionDef.id]?.[zone] || "Build zone";
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
    $("command-context").textContent = (zoneName(spot.zone)).toUpperCase();
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
    // R3-C: after its branch, the Combined step (the other branch too), then the step done.
    const combinedCost = S.sim.armourCombinedCost?.(squad) ?? null, combinedText = "Combined: adds the other branch, so the squad has both; it holds within 9 m of its spot.";
    const combined = !lead.squadBranch || !A2.combined ? ""
      : combinedCost !== null ? `<button class="command-tile defence-armour-up defence-armour-combined" data-defence-armour="combined" data-cost="${combinedCost}" data-hotkey="${key(5)}" aria-label="${A2.combined.name}, ${combinedCost} alloy" title="${key(5)} · ${combinedText} · ${combinedCost} alloy">${kbd(key(5))}${icon("rapid")}<span>${A2.combined.name}</span><small><b class="alloy-text" translate="no">${combinedCost}</b></small></button>`
      : lead.combined ? `<button class="command-tile defence-armour-up defence-armour-combined" data-defence-armour="combined-done" data-hotkey="${key(5)}" disabled title="${key(5)} · ${combinedText}">${kbd(key(5))}${icon("rapid")}<span>${A2.combined.name}</span><small>${icon("check")}</small></button>` : "";
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="a:${squad}:${mode}:${units.length}:${lead.squadRank || 1}${lead.squadBranch || ""}${lead?.combined ? "+c" : ""}"></i>
      <button class="command-tile defence-armour-mode" data-defence-armour="guard" data-hotkey="${key(0)}" aria-pressed="${mode === "guard"}" title="${key(0)} · Guard: holds its spot, fires at anything in range, chases a little and comes back">${kbd(key(0))}${icon("shield")}<span>Guard</span><small>${mode === "guard" ? icon("check") : ""}</small></button>
      <button class="command-tile defence-armour-mode" data-defence-armour="road" data-hotkey="${key(1)}" aria-pressed="${mode === "road"}" title="${key(1)} · Hold the road: stands fast and blocks the column, like the commander">${kbd(key(1))}${icon("hold")}<span>Hold road</span><small>${mode === "road" ? icon("check") : ""}</small></button>
      <button class="command-tile defence-armour-buy" data-defence-armour="buy" data-hotkey="${key(2)}" aria-label="New squad, ${a.cost} alloy" title="${key(2)} · New squad: ${a.size} tanks at the depot · ${a.cost} alloy">${kbd(key(2))}${icon("tank")}<span>New squad</span><small><b class="alloy-text" translate="no">${a.cost}</b></small></button>
      <button class="command-tile defence-info" data-defence-armour="focus" data-hotkey="${key(3)}" title="${key(3)} · ${a.name}">${kbd(key(3))}${hasPortrait(lead.type) ? portrait(lead.type) : icon("tank")}<span>Squad</span><small><b translate="no" data-armour-hp>${Math.round(hp)}</b></small></button>${ups}${combined}`;
    $("command-hint").textContent = up?.kind === "branch" ? "Rank 2: pick one branch for this squad. It cannot be changed." : combinedCost !== null ? "Combined adds the other branch to this squad." : "Tap the map or a road to send the squad. On Guard it comes back to its spot after a chase.";
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
    $("command-context").textContent = ui.aim ? "TAP THE ROAD" : "ON THE FIELD";
    const tile = (id, i, label, ic, title) => `<button class="command-tile defence-ability" data-defence-hero="${id}" data-hotkey="${key(i)}" aria-pressed="${ui.aim === id}" title="${key(i)} · ${title}">${kbd(key(i))}${icon(ic)}<span>${label}</span><small data-cooldown="${id}" translate="no"></small></button>`;
    $("commands").innerHTML = `<i hidden data-defence-sheet data-key="h:${hero.id}:${ui.aim || ""}"></i>
      ${tile("barrage", 0, "Barrage", "barrage", `Barrage: shell a spot within ${c.barrage.range} m, ${c.barrage.damage} damage over ${c.barrage.radius} m`)}
      ${tile("reinforce", 1, "Reinforce", "shield", `Reinforce: three Vanguards hold the road for ${c.reinforce.seconds} s`)}
      <button class="command-tile defence-info" data-defence-hero="focus" data-hotkey="${key(2)}" title="${key(2)} · ${c.name}">${kbd(key(2))}${hasPortrait(hero.type) ? portrait(hero.type) : icon("flag")}<span>Field commander</span><small><b translate="no">${Math.round(hero.hp)}</b></small></button>`;
    $("command-hint").textContent = ui.aim === "barrage" ? "Tap a spot inside the ring to shell it." : ui.aim === "reinforce" ? "Tap the road inside the ring to drop three Vanguards." : "Tap the road to send the commander. It holds there and blocks the column.";
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
    const zones = !!S.sim.missionDef.defence.zones?.length, guided = !!c.guideActive?.();
    // R3-E: the guided first build takes over the hint while it runs.
    $("commands").innerHTML = guided ? `<i hidden data-defence-sheet data-key="none:g"></i><div class="tactical-hint defence-hint" data-guide-hint>${icon("tower")}<strong>Your first tower</strong><p>Tap the glowing pad beside the road, then pick a crew.</p></div>`
      : `<i hidden data-defence-sheet data-key="none"></i><div class="tactical-hint defence-hint">${icon("tower")}<strong>Crew the pads</strong><p>${zones ? "Tap a pad, or anywhere in a marked field, then pick a crew. Tap a tower to upgrade or sell it." : "Tap a pad beside the road, then pick a crew. Tap a tower to upgrade or sell it."}</p></div>`;
    $("command-hint").textContent = "";
  }
  function sheet(es) {
    const tower = es.length === 1 && es[0].crew && es[0].team === 0 ? es[0] : null, hero = es.length === 1 && es[0].hero ? es[0] : null, squad = selectedSquad(es);
    if (tower) S.defencePad = tower.pad;
    // Anything else picked, or the picked pad's tower deselected: no pad.
    else if (es.length || (S.defencePad && S.sim.towerOn(S.defencePad))) S.defencePad = null;
    if (es.length) { S.defenceBridge = null; S.defenceSpot = null; S.defenceDepot = false; }
    if (!hero && ui.aim) setAim(null);
    const pad = !tower && !hero && S.defencePad ? S.sim.padById(S.defencePad) : null;
    const bridge = !tower && !hero && !pad ? S.defenceBridge : null;
    // 0.23: a spot in a build zone, an armour squad, the armour depot.
    const spot = !es.length && !pad && bridge === null ? S.defenceSpot : null, depot = !es.length && !pad && !spot && bridge === null && S.defenceDepot && !!S.sim.armourRules();
    const lead = squad ? S.sim.armourUnits(squad)[0] : null;
    const k = tower ? `t:${tower.id}:${tower.tier}:${tower.branch || ""}:${tower.branchRank || 0}:${tower.aim || ""}` : hero ? `h:${hero.id}:${ui.aim || ""}` : squad ? `a:${squad}:${S.sim.armourModeOf(squad)}:${es.length}:${lead?.squadRank || 1}${lead?.squadBranch || ""}${lead?.combined ? "+c" : ""}` : pad ? `p:${pad.id}` : bridge !== null ? `b:${bridge}:${S.sim.crossingState(bridge)}` : spot ? `z:${spot.zone}:${spot.x}:${spot.z}` : depot ? "d" : c.guideActive?.() ? "none:g" : "none";
    const marker = $("commands").querySelector("[data-defence-sheet]");
    if (marker?.dataset.key !== k) {
      $("commands").classList.remove("tactics-card");
      if (tower) towerSheet(tower); else if (hero) heroSheet(hero); else if (squad) armourSheet(squad); else if (pad) padSheet(pad); else if (bridge !== null) bridgeSheet(bridge); else if (spot) zoneSheet(spot); else if (depot) depotSheet(); else emptySheet();
      if (tower && ui.burstTier && ui.burstTier === tower.tier) { burst($("commands").querySelector(".defence-info")); ui.burstTier = 0; }
      ui.affordable = false;
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
      if (can && !ui.affordable && !blocked) burst(rankUp);
      ui.affordable = can;
    }
    const up = $("commands").querySelector('[data-defence-act="upgrade"]');
    if (up && tower) {
      const can = tower.tier < 3 && alloy >= GARRISONS.crews[tower.crew].cost[tower.tier];
      up.disabled = blocked || !can;
      // An upgrade that just became affordable throws a few embers (never under motion-off).
      if (can && !ui.affordable && !blocked) burst(up);
      ui.affordable = can;
    }
    const branchTiles = $("commands").querySelectorAll("[data-defence-branch]");
    if (branchTiles.length && tower) {
      const can = [...branchTiles].some((b) => !b.disabled);
      if (can && !ui.affordable && !blocked) burst(branchTiles[0]);
      ui.affordable = can;
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
  // The selection panel: the picked pad or bridge, or the state of the defence when nothing is picked.
  function info(es) {
    if (es.length) { ui.infoKey = ""; return; }
    const st = S.sim.defenceStatus(), pad = S.defencePad ? S.sim.padById(S.defencePad) : null, bridge = !pad ? S.defenceBridge : null;
    const spot = !pad && bridge === null ? S.defenceSpot : null, depot = !pad && !spot && bridge === null && S.defenceDepot;
    const k = pad ? `pad:${pad.id}` : bridge !== null ? `bridge:${bridge}` : spot ? `spot:${spot.zone}` : depot ? "depot" : `none:${st.wave}:${st.lives}`;
    if (k === ui.infoKey && $("selection-info").querySelector(".defence-panel")) return;
    ui.infoKey = k;
    const foe = FACTIONS[S.sim.missionDef.factions?.[1]];
    if (spot || depot) {
      $("selection-info").innerHTML = spot
        ? `<div class="selection-empty defence-panel" data-zone="${spot.zone}">${icon("tower")}<div><h3>${zoneName(spot.zone)}</h3><p>A crew can stand anywhere on the marked field, clear of the road.</p><p>Pick a crew in Actions.</p></div></div>`
        : `<div class="selection-empty defence-panel" data-depot>${icon("tank")}<div><h3>Armour depot</h3><p>Buy a squad of tanks in Actions, then tap the map to send it.</p></div></div>`;
      return;
    }
    $("selection-info").innerHTML = pad
      ? `<div class="selection-empty defence-panel" data-pad="${pad.id}" data-high="${pad.high || "ground"}">${icon("tower")}<div><h3>${pad.high === "rim" ? "Rim pad" : pad.high === "deep" ? "Deep pad" : "Ground pad"}</h3><p>${PAD_NOTE[pad.high || "ground"]}</p><p>Pick a crew in Actions.</p></div></div>`
      : bridge !== null
        ? `<div class="selection-empty defence-panel" data-bridge="${bridge}">${icon("barrage")}<div><h3>${bridge < 0 ? "West bridge" : "East bridge"}</h3><p>Blow it in Actions: the waves on this road turn to another crossing.</p></div></div>`
        : `<div class="selection-empty defence-panel">${icon("shield")}<div><h3>${S.sim.missionDef.title}</h3><p>${foe ? `<span>${foe.name}</span> · ` : ""}<span>Wave</span> <b translate="no">${st.endless ? st.wave : `${st.wave}/${st.waves}`}</b> · <b translate="no">${st.lives}</b> <span>lives</span></p><p>${S.sim.missionDef.defence.zones?.length ? "Tap a pad or a marked field to crew a tower." : "Tap a pad beside the road to crew a tower."}</p></div></div>`;
  }
  Object.assign(c, { crewTile, padSheet, zoneSheet, zoneWhy, armourSheet, depotSheet, towerSheet, nextAim, statsBlock, heroSheet, bridgeSheet, bridgeNote, emptySheet, sheet, burst, info });
}
