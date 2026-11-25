// W11 LAN play, the page (loaded the first time the "LAN play" tile is used, src/lan-entry.js):
//   - the LAN screen over the title: your name, Host a battle or Join battle; the host picks the mode (1v1
//     or co-op against the computer), map and factions and sees the join address with a QR code and who has
//     joined; a guest sees the battle and taps Ready; the host starts when everyone is ready;
//   - the match: the simulation built from the host's options, every order of this page queued through the
//     lockstep session (src/net/session.js) instead of applied, the frame's ticks run by the session at x1,
//     any open menu (or a hidden tab) holding the battle for both players;
//   - in the match: a strip with both players' names, colours and the ping; a card while waiting for a player,
//     while the other player has paused, or when the two battles went out of step (continue from the host's);
//   - the end: victory or defeat as this player sees it, or why the battle stopped (a player left, stopped
//     answering, the host server went away), then back to the LAN lobby or the main menu.
// Nothing of a LAN battle is saved, recorded or replayed (no autosave, no history, no achievements).
import "./lan.css";
import { $ } from "../app/dom.js";
import { icon } from "../icons.js";
import { Simulation } from "../simulation.js";
import { commandAllowed } from "../commands.js";
import { MAPS } from "../terrain.js";
import { PLAYER_FACTIONS, matchLook, enemyFactionOf, playerFactionOf } from "../factions.js";
import { AI_SPEEDS } from "../ai-plan.js";
import { teamColors } from "../faction-colors.js";
import { LanClient, lanSocketUrl } from "./client.js";
import { lanOptions, cleanSetup, DEFAULT_SETUP } from "./match.js";
import { qrToSvg } from "./qr.js";
import { swapTeams } from "./perspective.js";
import { cleanName, STALL_TIMEOUT_MS } from "./protocol.js";

const NAME_KEY = "frontier-lan-name";
const SETUP_KEY = "frontier-lan-setup";
// A build placed on a LAN page has no site yet (it is built on a later turn): confirmBuild gets this stand-in.
const PENDING = -1;
// The app state a LAN battle changes; put back when it ends (as the replay viewer does).
const KEPT = ["playMode", "mission", "mapId", "enemyCount", "aiSpeed", "alliance", "bonus", "rules", "look", "enemyFaction", "playerFaction", "activeStage", "quick"];

// The host server's refusals (tools/lan-server.mjs sends the code).
const ERRORS = {
  version: "This page is from another game version. Reload it from the host's address.",
  hosted: "A battle is already being hosted here. Join it instead.",
  noHost: "No battle is being hosted yet. Ask the host to press Host on their screen.",
  started: "This battle has already started. Wait for it to end.",
  full: "This battle is full.",
  noGuest: "Wait for a second player to join.",
  notReady: "Every player must be ready first.",
  other: "The host server refused that.",
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* optional */ } } };
const clock = (seconds) => { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const cssColor = (c) => (typeof c === "number" ? `#${c.toString(16).padStart(6, "0")}` : typeof c === "string" ? c : "#8fd3ff");
const mapName = (id) => String(MAPS[id] || id).split(" · ")[0];
const factionName = (id) => String(PLAYER_FACTIONS[id] || id).replace(/^The /, "").split(" ")[0];

export function installLan(S, A) {
  const Z = S.screen;
  const test = S.query?.has("test");
  let client = null, info = null, dialog = null, role = null, wasListed = false, joinWanted = S.query?.get("lan") === "join", error = "", starting = false;
  let saved = null, strip = null, card = null, cardKey = "", uiClock = 0, lastStall = null;
  let setup = cleanSetup((() => { try { return JSON.parse(store.get(SETUP_KEY) || "null") || DEFAULT_SETUP; } catch { return DEFAULT_SETUP; } })(), MAPS);
  let name = cleanName(store.get(NAME_KEY) || "", "Commander");

  // ---------- the LAN screen ----------
  const roomOf = () => client?.room || null;
  const me = () => roomOf()?.players.find((p) => p.id === client?.id) || null;
  const hostOf = () => roomOf()?.players.find((p) => p.role === "host") || null;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = Object.assign(document.createElement("dialog"), { id: "lan", className: "records-sheet lan-sheet" });
    dialog.setAttribute("aria-labelledby", "lan-title");
    document.body.append(dialog);
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("change", onChange);
    dialog.addEventListener("input", (event) => { if (event.target.id === "lan-name") { name = cleanName(event.target.value, "Commander"); store.set(NAME_KEY, name); } });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); closePanel(); });
    return dialog;
  }

  async function open() {
    if (Z.started && !S.sim.result && !S.lan) return;
    ensureDialog();
    error = "";
    if (!dialog.open) {
      dialog.innerHTML = shellHTML();
      saved ??= null;
      dialog.prevScreen = Z.snapshot();
      Z.open("guide");
      dialog.showModal();
    }
    render();
    if (!client?.open) await connect();
    render();
  }

  function closePanel(keep = false) {
    if (!dialog?.open) return;
    dialog.close();
    if (dialog.prevScreen) Z.restore(dialog.prevScreen);
    S.keys?.clear?.();
    if (!keep) { client?.close(); client = null; role = null; }
    $("lan-open")?.focus({ preventScroll: true });
  }

  async function connect() {
    info = null;
    try {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 3000);
      const response = await fetch(new URL("lan/info", location.href), { cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      const data = response.ok ? await response.json() : null;
      info = data?.lan ? data : false;
    } catch { info = false; }
    if (!info) return;
    client = new LanClient(lanSocketUrl(), { name });
    wasListed = false;
    client.on(onServer);
    try { await client.connect(); }
    catch { error = "Could not reach the host server. Check that it is still running, then try again."; client = null; return; }
    if (joinWanted && hostOf()) join();
  }

  function onServer(m) {
    if (m.t === "room") {
      // Dropped from the room (the host stopped hosting): back to the choice. A room message sent before the
      // server took this page's Host or Join does not list it yet, so only a page that was listed is dropped.
      const listed = m.room.players.some((p) => p.id === client?.id);
      if (wasListed && !listed) role = null;
      wasListed = listed;
      if (joinWanted && !role && hostOf() && m.room.phase === "lobby") join();
      if (dialog?.open) renderRoom();
    } else if (m.t === "error") { error = ERRORS[m.code] || ERRORS.other; if (dialog?.open) render(); }
    else if (m.t === "start") beginMatch(m);
    else if (m.t === "left" && m.why === "hostLeft" && !S.lan) { role = null; error = "The host closed the battle."; if (dialog?.open) render(); }
    else if (m.t === "closed") {
      if (S.lan?.session && !S.lan.session.ended) S.lan.session.end("serverLost");
      client = null; role = null;
      if (dialog?.open) { error = "Lost the connection to the host server."; render(); }
    }
  }

  function host() {
    if (!client) return;
    joinWanted = false;
    client.send({ t: "name", name });
    client.send({ t: "host", setup });
    role = "host";
  }
  function join() {
    if (!client || role) return;
    joinWanted = false;
    client.send({ t: "name", name });
    client.send({ t: "join" });
    role = "guest";
  }
  function leaveRoom() {
    client?.close();
    client = null;
    role = null;
    error = "";
    render();
    connect().then(render);
  }
  function sendSetup() {
    store.set(SETUP_KEY, JSON.stringify(setup));
    if (role === "host") client?.send({ t: "setup", setup });
  }

  function onClick(event) {
    const b = event.target.closest("button");
    if (!b || b.disabled) return;
    if (b.matches("[data-lan-close]")) closePanel();
    else if (b.matches("[data-lan-host]")) { host(); render(); }
    else if (b.matches("[data-lan-join]")) { join(); render(); }
    else if (b.matches("[data-lan-leave-room]")) leaveRoom();
    else if (b.matches("[data-lan-retry]")) { error = ""; render(); connect().then(render); }
    else if (b.matches("[data-lan-ready]")) client?.send({ t: "ready", on: !me()?.ready });
    else if (b.matches("[data-lan-start]")) { error = ""; client?.send({ t: "start", options: lanOptions(setup) }); }
    else if (b.dataset.lanMode) { setup = { ...setup, mode: b.dataset.lanMode }; sendSetup(); render(); }
    else if (b.dataset.lanAi) { setup = { ...setup, aiCount: Number(b.dataset.lanAi) }; sendSetup(); render(); }
  }
  function onChange(event) {
    const t = event.target;
    if (t.id === "lan-name") { client?.send({ t: "name", name }); return; }
    if (t.id === "lan-map") setup = { ...setup, map: t.value };
    else if (t.id === "lan-f0") setup = { ...setup, factions: [t.value, setup.factions[1]] };
    else if (t.id === "lan-f1") setup = { ...setup, factions: [setup.factions[0], t.value] };
    else if (t.id === "lan-fai") setup = { ...setup, aiFaction: t.value };
    else if (t.id === "lan-speed") setup = { ...setup, aiSpeed: t.value };
    else return;
    setup = cleanSetup(setup, MAPS);
    sendSetup();
    renderRoom();
  }

  function shellHTML() {
    return `<header class="records-head"><h2 id="lan-title">LAN play</h2><button type="button" class="kit-face records-close" data-lan-close aria-label="Close LAN play">${icon("close")}<span>Close</span></button></header>
      <div class="records-body lan-body"><p class="lan-error" id="lan-error" role="alert"></p><div id="lan-main"></div></div>`;
  }

  const options = (list, value) => Object.entries(list).map(([id, label]) => `<option value="${id}"${id === value ? " selected" : ""}>${esc(label)}</option>`).join("");
  const seg = (attr, value, items, label) => `<div class="lan-seg" role="group" aria-label="${label}">${items.map(([v, text]) => `<button type="button" class="kit-face" data-${attr}="${v}" aria-pressed="${String(v) === String(value)}">${text}</button>`).join("")}</div>`;
  const factionOptions = Object.fromEntries(Object.keys(PLAYER_FACTIONS).map((id) => [id, factionName(id)]));
  const mapOptions = Object.fromEntries(Object.keys(MAPS).map((id) => [id, mapName(id)]));
  const speedOptions = Object.fromEntries(Object.entries(AI_SPEEDS).map(([id, p]) => [id, `${p.label} AI`]));

  function setupFormHTML() {
    const coop = setup.mode === "coop";
    return `<section class="lan-card" aria-labelledby="lan-setup-title"><h3 id="lan-setup-title">${icon("map")}<span>Battle</span></h3>
      ${seg("lan-mode", setup.mode, [["duel", "1v1"], ["coop", "Co-op vs AI"]], "Mode")}
      <div class="lan-grid">
        <label class="lan-field lan-wide"><span>Map</span><select id="lan-map">${options(mapOptions, setup.map)}</select></label>
        <label class="lan-field"><span>Host's faction</span><select id="lan-f0">${options(factionOptions, setup.factions[0])}</select></label>
        <label class="lan-field"><span>Guest's faction</span><select id="lan-f1">${options(factionOptions, setup.factions[1])}</select></label>
        ${coop ? `<label class="lan-field"><span>AI faction</span><select id="lan-fai">${options(factionOptions, setup.aiFaction)}</select></label>
        <label class="lan-field"><span>AI speed</span><select id="lan-speed">${options(speedOptions, setup.aiSpeed)}</select></label>
        <div class="lan-field lan-wide"><span>AI rivals</span>${seg("lan-ai", setup.aiCount, [[1, "1 AI rival"], [2, "2 AI rivals"]], "AI rivals")}</div>` : ""}
      </div>
      <p class="lan-note">${coop ? "You and your guest are allies against the computer." : "You against your guest. No computer side."}</p></section>`;
  }
  function setupSummaryHTML(s) {
    if (!s) return `<p class="lan-note">The host is choosing the battle.</p>`;
    const c = cleanSetup(s, MAPS), coop = c.mode === "coop";
    return `<section class="lan-card" aria-labelledby="lan-setup-title"><h3 id="lan-setup-title">${icon("map")}<span>Battle</span></h3>
      <dl class="lan-summary"><dt>Mode</dt><dd>${coop ? "Co-op vs AI" : "1v1"}</dd><dt>Map</dt><dd translate="no">${esc(mapName(c.map))}</dd>
      <dt>Host's faction</dt><dd translate="no">${esc(factionName(c.factions[0]))}</dd><dt>Your faction</dt><dd translate="no">${esc(factionName(c.factions[1]))}</dd>
      ${coop ? `<dt>AI rivals</dt><dd><span translate="no">${c.aiCount} · ${esc(factionName(c.aiFaction))}</span></dd>` : ""}</dl></section>`;
  }
  function joinBoxHTML() {
    const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
    const addresses = local ? info?.addresses || [] : [location.hostname];
    if (!addresses.length) return `<section class="lan-card"><p class="lan-note">No network address found. Connect this PC to the Wi-Fi or network, then reopen LAN play.</p></section>`;
    const url = (a) => `http://${a}:${location.port || info?.port || 80}/?lan=join`;
    return `<section class="lan-card lan-joinbox" aria-labelledby="lan-join-title"><div class="lan-qr" aria-hidden="true">${qrToSvg(url(addresses[0]))}</div>
      <div class="lan-join-text"><h3 id="lan-join-title">${icon("people")}<span>Invite a player</span></h3><p>On the same Wi-Fi, open this address or scan the code:</p>
      ${addresses.map((a) => `<p class="lan-url" translate="no">${esc(url(a))}</p>`).join("")}</div></section>`;
  }
  function playersHTML(room) {
    const list = room?.players || [];
    return `<section class="lan-card" aria-labelledby="lan-players-title"><h3 id="lan-players-title">${icon("people")}<span>Players</span><b translate="no">${list.length} / 2</b></h3><ul class="lan-players">${list.map((p) => `<li class="lan-player" data-ready="${p.ready}"><span class="lan-player-name" translate="no">${esc(p.name)}</span><span class="lan-chip">${p.role === "host" ? "Host" : "Guest"}</span><span class="lan-state">${p.ready ? `${icon("check")}<span>Ready</span>` : "Not ready"}</span></li>`).join("")}${list.length < 2 ? `<li class="lan-player lan-empty"><span>Waiting for a player to join…</span></li>` : ""}</ul></section>`;
  }

  function render() {
    if (!dialog?.open) return;
    $("lan-error").textContent = error;
    const main = $("lan-main");
    if (info === null && !client) { main.innerHTML = `<p class="lan-note lan-looking">Looking for the LAN host server…</p>`; return; }
    if (info === false) {
      main.innerHTML = `<section class="lan-card lan-howto"><h3>${icon("info")}<span>LAN play needs a host PC</span></h3>
        <p>One PC on your Wi-Fi runs the host server; every player opens the address it shows. No internet is needed.</p>
        <ol><li>On the host PC, in the game folder (github-io), run <code translate="no">npm run lan</code>.</li><li>On that PC open <code translate="no">http://localhost:4570/?lan</code> and press Host a battle.</li><li>On phones and other PCs on the same Wi-Fi, open the address it prints, or scan its QR code.</li></ol>
        <button type="button" class="kit-face lan-action" data-lan-retry>${icon("arrow")}<span>Try again</span></button></section>`;
      return;
    }
    if (!client) { main.innerHTML = `<button type="button" class="kit-face lan-action" data-lan-retry>${icon("arrow")}<span>Try again</span></button>`; return; }
    const room = roomOf(), hostP = hostOf();
    const nameField = `<label class="lan-field lan-name"><span>Your name</span><input id="lan-name" type="text" maxlength="16" autocomplete="nickname" spellcheck="false" value="${esc(name)}"></label>`;
    if (!role) {
      const busy = room?.phase === "match";
      main.innerHTML = `${nameField}<div class="lan-choice">
        <button type="button" class="kit-face lan-big" data-lan-host${hostP && hostP.id !== client.id ? " disabled" : ""}>${icon("flag")}<span class="lan-big-text"><strong>Host a battle</strong><small>${hostP ? "A battle is already hosted" : "You pick the battle; others join"}</small></span></button>
        <button type="button" class="kit-face lan-big" data-lan-join${!hostP || busy ? " disabled" : ""}>${icon("people")}<span class="lan-big-text"><strong>Join battle</strong><small>${!hostP ? "No battle hosted yet" : busy ? "The battle has started" : `<span translate="no">${esc(hostP.name)}</span>`}</small></span></button></div>`;
      return;
    }
    main.innerHTML = `${nameField}<div id="lan-room"></div>`;
    renderRoom();
  }

  function renderRoom() {
    const box = dialog?.open && $("lan-room");
    if (!box) { if (dialog?.open && !role) render(); return; }
    const room = roomOf(), mine = me();
    if (role === "host") {
      const guests = (room?.players || []).filter((p) => p.role === "guest");
      const canStart = guests.length > 0 && guests.every((p) => p.ready);
      box.innerHTML = `${setupFormHTML()}${joinBoxHTML()}${playersHTML(room)}
        <div class="lan-actions"><button type="button" class="primary lan-action" data-lan-start${canStart ? "" : " disabled"}>${icon("play")}<span>Start battle</span></button>
        <button type="button" class="kit-face lan-action" data-lan-leave-room>${icon("close")}<span>Stop hosting</span></button></div>
        <p class="lan-note">${!guests.length ? "Start opens once a player has joined and is ready." : canStart ? "Everyone is ready." : "Waiting for your guest to press Ready."}</p>`;
    } else {
      box.innerHTML = `${setupSummaryHTML(room?.setup)}${playersHTML(room)}
        <div class="lan-actions"><button type="button" class="primary lan-action" data-lan-ready aria-pressed="${!!mine?.ready}">${icon("check")}<span>${mine?.ready ? "Ready" : "Press when ready"}</span></button>
        <button type="button" class="kit-face lan-action" data-lan-leave-room>${icon("close")}<span>Leave</span></button></div>
        <p class="lan-note">${mine?.ready ? "The host starts the battle." : "Press Ready, then the host starts the battle."}</p>`;
    }
    $("lan-error").textContent = error;
  }

  // ---------- the match ----------
  function lockCommands(sim) {
    let lastBuild = null;
    // An own property, as the replay viewer's: never serialized, so the shared state and its hash are untouched.
    sim.command = (c) => {
      const session = S.lan?.session;
      if (!session || session.ended || session.sim !== sim || !c || c.team !== 0 || c.type === "decide") return false;
      // confirmBuild's second command: its builder's order for the site the build will make.
      if (c.type === "order" && c.order?.target === PENDING) {
        if (lastBuild) { const { target, ...follow } = c.order; lastBuild.follow = follow; }
        lastBuild = null;
        return true;
      }
      lastBuild = null;
      if (!commandAllowed(sim, c)) return false;
      const queued = session.queue(structuredClone(c));
      if (c.type === "build") {
        lastBuild = queued;
        return { id: PENDING, type: c.building, kind: "building", team: 0, x: c.x, z: c.z, hp: 1, maxHp: 1, complete: false, pending: true };
      }
      return true;
    };
  }

  async function beginMatch(start) {
    if (starting || S.lan) return;
    starting = true;
    error = "";
    try {
      saved = Object.fromEntries(KEPT.map((k) => [k, S[k]]));
      const session = client.match(start, { Simulation, onEvent });
      const sim = session.sim, seats = start.seats, mine = start.you;
      lockCommands(sim);
      S.lan = { session, seat: mine, seats, setup: cleanSetup(start.setup || {}, MAPS), began: Date.now(), watch, frame, info: lanInfo };
      document.documentElement.classList.add("lan-match");
      closePanel(true);
      S.sim = sim;
      S.playMode = "skirmish";
      S.mission = null;
      S.mapId = sim.terrain.id; S.enemyCount = sim.enemyCount; S.aiSpeed = sim.aiSpeed; S.alliance = "ffa";
      S.bonus = null; S.rules = null; S.quick = false;
      S.enemyFaction = enemyFactionOf(sim);
      S.playerFaction = playerFactionOf(sim);
      S.look = matchLook(null, sim);
      const ready = await restart(false, true);
      if (ready === false || S.sim !== sim || !S.lan) { endMatch("loadFailed"); return; }
      S.activeStage = null;
      S.view.fx?.sprites?.start();
      S.view.setTerrain(sim.terrain);
      S.view.setMission(S.look);
      A.focusHome();
      $("hover-label").hidden = true;
      A.updateHeading();
      $("status-text").textContent = "LAN BATTLE";
      // Harvesters start mining, as in every skirmish (on turn 2, like any order).
      sim.command({ team: 0, type: "harvest" });
      renderStrip();
      client.send({ t: "loaded" });
    } finally {
      starting = false;
    }
  }

  // The frame (app/frame.js, while the match runs): the session's ticks, with the view's and the stats' steps.
  function frame(dt) {
    const s = S.lan?.session;
    if (!s) return;
    s.advance(dt, { before: (sim) => { S.view.beforeTick(sim); S.matchStats.before(sim); }, after: (sim) => S.matchStats.after(sim) });
    S.accumulator = s.accumulator;
  }

  // Every frame: an open menu or a hidden tab holds the battle for both players; pings; the cards.
  function watch() {
    const s = S.lan?.session;
    if (!s) return;
    const local = Z.started && Z.paused && !S.sim.result && Z.modalType !== "result" ? Z.modalType || "pause" : document.hidden ? "away" : null;
    s.setHold(s.ended ? null : local);
    s.update();
    uiClock -= 1;
    if (uiClock <= 0) { uiClock = 10; renderCard(); renderStrip(); }
  }

  function onEvent(type, data) {
    if (!S.lan) return;
    if (type === "stall") { lastStall = data.seats.length ? data : null; renderCard(); }
    else if (type === "hold" || type === "desync") renderCard();
    else if (type === "resync") {
      if (!data.own) {
        lockCommands(data.sim);
        S.sim = data.sim;
        S.look = matchLook(null, data.sim);
        A.syncPointOwners?.();
      }
      A.notice("Continuing from the host's battle.");
      renderCard();
    } else if (type === "left") {
      if (data.ally) A.notice(`${seatName(data.seat)} left the battle. Their army holds its ground.`);
    } else if (type === "ended") {
      if (data.why !== "quit") showEnd(data.why, data);
    }
  }

  const seatName = (seat) => S.lan?.seats.find((s) => s.seat === seat)?.name || "The other player";
  // The other person's team as this page shows it: team 1 on both pages (the guest's page swaps 0 and 1).
  const otherSeat = () => S.lan?.seats.find((s) => s.seat !== S.lan.seat)?.seat ?? 1;

  function renderStrip() {
    const lan = S.lan;
    if (!lan) { if (strip) strip.hidden = true; return; }
    if (!strip?.isConnected) {
      strip = Object.assign(document.createElement("div"), { id: "lan-strip", className: "lan-strip" });
      strip.setAttribute("role", "status");
      strip.setAttribute("aria-label", "LAN battle");
      document.body.append(strip);
    }
    const colors = teamColors(S.settings, S.look).map(cssColor), coop = lan.setup.mode === "coop";
    const meName = lan.seats.find((s) => s.seat === lan.seat)?.name || "You", other = seatName(otherSeat());
    const rtt = lan.session.rtt, ping = rtt === null ? "—" : `${Math.max(1, Math.round(rtt))} ms`;
    const gone = !lan.session.lock.seats.includes(otherSeat());
    strip.hidden = false;
    const html = `<span class="lan-who lan-me"><i class="lan-dot" style="background:${colors[0]}"></i><b translate="no">${esc(meName)}</b></span><span class="lan-vs">${coop ? "with" : "vs"}</span><span class="lan-who${gone ? " lan-gone" : ""}"><i class="lan-dot" style="background:${colors[1]}"></i><b translate="no">${esc(other)}</b></span><span class="lan-ping" title="Round trip to the other player">${icon("gauge")}<b translate="no">${ping}</b></span>`;
    if (html !== strip.dataset.html) { strip.innerHTML = html; strip.dataset.html = html; }
    placeStrip();
  }
  // Phones: the strip sits in the widest free part of the top bar (between the resources, the tool row and the
  // clock with Pause), showing the other player's dot, name and the ping (its own name is left out there).
  // Too little room there: it goes just under the top controls, on the right. On a wide screen it is centred.
  const TOP_BAR = ".resource-bar, .top-actions, #clock, #pause, #audio, #briefing-settings, #select-army, #select-workers, #box-select, #queue-orders, #clear-selection, #touch-guide";
  function placeStrip() {
    const compact = document.documentElement.classList.contains("compact-ui");
    strip.classList.toggle("lan-strip-compact", compact);
    for (const key of ["left", "right", "top", "max-width"]) strip.style.removeProperty(key);
    if (!compact) return;
    const boxes = [...document.querySelectorAll(TOP_BAR)].map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height && r.top < 30 && r.bottom < 70).sort((a, b) => a.left - b.left);
    let best = null, at = 8, low = 0;
    for (const r of [...boxes, { left: innerWidth - 8, right: innerWidth - 8, bottom: 0 }]) {
      if (r.left - at > (best ? best.width : 0)) best = { left: at, width: r.left - at };
      at = Math.max(at, r.right);
      low = Math.max(low, r.bottom);
    }
    if (best && best.width >= 72) {
      strip.style.left = `${Math.round(best.left + 4)}px`;
      strip.style.maxWidth = `${Math.round(best.width - 8)}px`;
    } else {
      strip.style.left = "auto";
      strip.style.right = "8px";
      strip.style.top = `${Math.round(low + 4)}px`;
    }
  }

  // The card over the battle: loading, paused by the other player, waiting for a player, out of step.
  function renderCard() {
    const lan = S.lan, s = lan?.session;
    let key = "", html = "";
    const myMenu = Z.paused && Z.modalType && Z.modalType !== "result";
    if (s && !s.ended && !S.sim.result && !myMenu) {
      if (s.desync) {
        key = `desync${s.desync.tick}`;
        html = `<h2 id="lan-card-title">The two battles went out of step</h2><p><span>The two screens no longer show the same battle.</span> <b translate="no">${clock(s.desync.tick * 0.05)}</b></p><p>Continue from the host's battle to play on together.</p>
          <div class="lan-actions"><button type="button" class="primary lan-action" data-lan-sync>${icon("arrow")}<span>Continue from the host's battle</span></button><button type="button" class="kit-face lan-action" data-lan-leave>${icon("close")}<span>Leave battle</span></button></div>`;
      } else if (!s.go) {
        key = "loading";
        html = `<h2 id="lan-card-title">Getting ready</h2><p>Waiting for every player to load the battle…</p><div class="lan-actions"><button type="button" class="kit-face lan-action" data-lan-leave>${icon("close")}<span>Leave battle</span></button></div>`;
      } else if (s.remoteHolds.size) {
        const [seat, why] = [...s.remoteHolds][0];
        key = `hold${seat}${why}`;
        html = `<h2 id="lan-card-title">Battle paused</h2><p><b translate="no">${esc(seatName(seat))}</b> <span>${why === "away" ? "switched away from the game." : "paused the battle."}</span></p><p class="lan-note">It goes on when they come back.</p><div class="lan-actions"><button type="button" class="kit-face lan-action" data-lan-leave>${icon("close")}<span>Leave battle</span></button></div>`;
      } else if (lastStall && s.stallSince !== null) {
        const left = Math.max(0, Math.ceil((STALL_TIMEOUT_MS - (Date.now() - s.stallSince)) / 1000));
        key = `stall${left}`;
        html = `<h2 id="lan-card-title">Waiting for a player</h2><p><span>Waiting for</span> <b translate="no">${esc(lastStall.seats.map(seatName).join(", "))}</b>…</p><p class="lan-note"><span>The battle ends in</span> <b translate="no">${left} s</b> <span>if they do not come back.</span></p><div class="lan-actions"><button type="button" class="kit-face lan-action" data-lan-leave>${icon("close")}<span>Leave battle</span></button></div>`;
      }
    }
    if (!html) { if (card) { card.hidden = true; cardKey = ""; } return; }
    if (!card?.isConnected) {
      card = Object.assign(document.createElement("div"), { id: "lan-wait", className: "lan-wait" });
      card.setAttribute("role", "alertdialog");
      card.setAttribute("aria-labelledby", "lan-card-title");
      card.addEventListener("click", (event) => {
        const b = event.target.closest("button");
        if (!b) return;
        if (b.matches("[data-lan-sync]")) { S.lan?.session.requestSync(); b.disabled = true; }
        else if (b.matches("[data-lan-leave]")) leaveMatch();
      });
      document.body.append(card);
    }
    card.hidden = false;
    card.dataset.state = key.replace(/\d+$/, "").replace(/\d.*$/, "");
    if (key !== cardKey) { card.innerHTML = `<div class="lan-wait-card">${html}</div>`; cardKey = key; }
  }

  // ---------- the end ----------
  const REASONS = {
    victory: "Every enemy Command core is down.",
    defeat: "Your last Command core fell.",
    draw: "Both sides fell together.",
    opponentLeft: "Your opponent left the battle. Victory by forfeit.",
    timeout: "The other player stopped answering for 30 seconds, so the battle ended.",
    serverLost: "The connection to the host was lost.",
    resyncFailed: "The host's battle could not be loaded on this screen.",
    loadFailed: "The battle could not be loaded on this screen.",
  };
  const TITLES = { victory: "Victory", defeat: "Defeat", draw: "Draw", opponentLeft: "Victory" };

  function showEnd(why) {
    if (!S.lan) return;
    const lan = S.lan, seconds = S.sim.time;
    if (card) card.hidden = true;
    lan.over = why;
    Z.open("result");
    A.clearMode();
    A.setModalOpen(true);
    if (S.audio) S.audio.sfx.play(why === "victory" || why === "opponentLeft" ? "win" : "lose");
    $("modal").classList.remove("debrief-wide", "result-wide");
    $("modal-content").innerHTML = `<span class="eyebrow">LAN BATTLE</span><h2 id="modal-title">${TITLES[why] || "Battle ended"}</h2><p>${REASONS[why] || REASONS.serverLost}</p>
      <p class="lan-result-line"><span>Battle time</span> <b translate="no">${clock(seconds)}</b></p>
      <div class="result-actions lan-result-actions"><button type="button" class="primary" data-lan-lobby>${icon("people")}<span>Back to the LAN lobby</span></button><button type="button" class="secondary" data-new-game>Main menu</button></div>`;
    $("modal").querySelector("[data-lan-lobby]").focus({ preventScroll: true });
  }

  // Leaves the battle on purpose (the card's Leave or the pause menu's New game): the other player is told.
  function leaveMatch() {
    if (!S.lan) return;
    S.lan.session.leave();
    endMatch("quit");
  }
  // The match is over on this page: the app state as it was, the LAN parts removed, then the title.
  function endMatch(why, toLobby = false) {
    const lan = S.lan;
    if (!lan) return;
    if (!lan.session.ended) lan.session.end(why);
    S.lan = null;
    if (client) client.session = null;
    document.documentElement.classList.remove("lan-match");
    if (strip) strip.hidden = true;
    if (card) card.hidden = true;
    if (saved) for (const [k, v] of Object.entries(saved)) S[k] = v;
    saved = null;
    newGame();
    if (toLobby && client?.open) {
      if (role === "host") client.send({ t: "reset" });
      open();
    } else if (!toLobby) { client?.close(); client = null; role = null; }
  }

  function lanInfo() {
    const lan = S.lan, s = lan?.session;
    if (!s) return null;
    if (lan.seat) swapTeams(s.sim, 0, lan.seat);
    let hash;
    try { hash = s.sim.hash(); } finally { if (lan.seat) swapTeams(s.sim, 0, lan.seat); }
    return { seat: lan.seat, go: s.go, ticks: s.sim.ticks, hash, rtt: s.rtt, held: s.localHold, remoteHolds: [...s.remoteHolds.keys()], desync: s.desync, ended: s.ended, stall: s.stallSince !== null, card: card && !card.hidden ? card.dataset.state : null, stats: { ...s.stats, lags: s.stats.lags.length }, result: s.sim.result };
  }

  // ---------- the app's own paths while a LAN battle runs ----------
  const restart = A.restart, newGame = A.newGame, showResult = A.showResult, autosave = A.autosave;
  A.restart = (...args) => { if (S.lan) { A.notice("A LAN battle cannot be restarted. Leave it from the pause menu."); return false; } return restart(...args); };
  A.newGame = (...args) => { if (S.lan) { if (!S.lan.over) S.lan.session.leave(); endMatch("quit"); return; } return newGame(...args); };
  A.showResult = (...args) => (S.lan ? showEnd(S.sim.result || "draw") : showResult(...args));
  A.autosave = (...args) => (S.lan ? false : autosave(...args));
  $("modal").addEventListener("click", (event) => { if (event.target.closest("[data-lan-lobby]") && S.lan) endMatch("over", true); });
  document.addEventListener("visibilitychange", () => watch());

  if (test) window.__frontierLan = { info: lanInfo, get client() { return client; }, get room() { return client?.room || null; }, open, panel: () => dialog?.open || false };
  return { open };
}
