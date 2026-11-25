// The replay viewer (W6, plan B3). A finished match is stored as its options and command log
// (src/meta/replay.js, src/meta/history.js); watching it builds a fresh Simulation from the options and
// lets the normal frame loop play it, the recorded commands fed in before each tick (app/frame.js calls
// S.replay.feed). Play / pause and x1 x2 x4 in a bar at the foot of the screen; no orders: the command dock
// is hidden and the simulation refuses every command but the replay's own. At the end the final state is
// compared with the recorded hash; a difference means the rules changed since, and the bar says so.
//
// Nothing of a replay is saved, scored or recorded: the autosave, the results screen, achievements,
// challenges and history all skip a match while S.replay is set.
//
// Follow action (re-score 2026-11-25b: the camera stayed where it started, so fights happened off screen):
// on by default, the camera glides to the action, the densest knot of units that fired in the last few
// seconds (sim entity `shotAt`), or with no fighting the player's army. A "Follow action" toggle on the bar
// (aria-pressed) turns it off and on; any manual camera move (drag, keys, edge, minimap) is noticed as the
// focus leaving where follow put it, and pauses follow until the toggle is pressed again. Presentation only:
// it reads the simulation, never writes it. Jumps to key moments were left out: a replay cannot seek without
// re-simulating from the start.
import "./replay.css";
import { $ } from "./app/dom.js";
import { icon } from "./icons.js";
import { Simulation } from "./simulation.js";
import { matchLook, enemyFactionOf, playerFactionOf } from "./factions.js";
import { replayFeeder, replayOptions, replayProblem, TICK } from "./meta/replay.js";
import { formatClock } from "./results-ui.js";
import { actionTarget, FOLLOW_RATE, MANUAL_SLACK } from "./meta/replay-follow.js";

export const APP_VERSION = typeof __APP_VERSION__ === "undefined" ? "dev" : __APP_VERSION__;
export const SPEEDS = [1, 2, 4];
// The fields of the app state a replay changes; they are put back when it ends.
const KEPT = ["playMode", "mission", "mapId", "enemyCount", "aiSpeed", "alliance", "bonus", "rules", "look", "enemyFaction", "playerFaction", "activeStage", "quick"];

export function setupReplay(S, A) {
  const Z = S.screen;
  let bar = null, saved = null;

  function sendAs(sim, replay) {
    // The simulation's own door, opened only while the feeder sends a recorded command.
    const door = Simulation.prototype.command;
    let feeding = false;
    // An own property holding a function: never serialized, so the state and its hash are untouched.
    sim.command = (c) => (feeding ? door.call(sim, c) : false);
    return (c) => { feeding = true; try { door.call(sim, c); } finally { feeding = false; } };
  }

  // Starts watching a stored replay; returns an error message instead when it cannot be played.
  async function watch(replay, entry = null) {
    const problem = replayProblem(replay, APP_VERSION);
    if (problem) return problem;
    let sim;
    try { sim = new Simulation(replayOptions(replay)); } catch { return "This replay is damaged and cannot be played."; }
    saved = Object.fromEntries(KEPT.map((k) => [k, S[k]]));
    const feeder = replayFeeder(replay), send = sendAs(sim, replay);
    S.replay = {
      replay, entry, speed: 1, paused: false, status: "playing",
      // Follow action: on by default; `target` the point it aims at, `at` where it last left the camera.
      follow: { on: true, target: null, at: null, next: 0 },
      // Called by the frame loop before every tick: false once the recorded end is reached.
      feed(s) {
        if (s !== sim) return true;
        if (s.ticks >= replay.ticks || s.result) { finish(); return false; }
        feeder.feed(s, send);
        return true;
      },
      feedNow() { feeder.feed(sim, send); },
      finishCheck: () => finishIfDone(),
    };
    S.sim = sim;
    S.playMode = entry?.mode && entry.mode !== "training" ? entry.mode : sim.defence ? "defence" : sim.missionDef ? "campaign" : "skirmish";
    S.mission = sim.missionDef || null;
    S.mapId = sim.terrain.id; S.enemyCount = sim.enemyCount; S.aiSpeed = replay.options.aiSpeed || sim.aiSpeed; S.alliance = sim.coalition ? "coalition" : "ffa";
    S.bonus = S.mission?.bonus || null;
    S.rules = sim.rules ? { ...sim.rules } : null;
    S.enemyFaction = S.mission ? "mirror" : enemyFactionOf(sim);
    S.playerFaction = playerFactionOf(sim);
    S.look = matchLook(S.mission, sim);
    S.quick = false;
    document.documentElement.classList.add("replaying");
    const ready = await A.restart(false, true);
    if (ready === false || S.sim !== sim) { stop(false); return "The replay could not be loaded."; }
    S.activeStage = null;
    S.view.fx?.sprites?.start();
    S.view.setTerrain(S.sim.terrain);
    S.view.setMission(S.look);
    A.focusHome();
    $("hover-label").hidden = true;
    A.updateHeading();
    $("status-text").textContent = "REPLAY";
    render();
    startFollow();
    return null;
  }

  // ---------------------------------------------------------------- Follow action
  let followFrame = 0, followLast = 0;
  function startFollow() {
    cancelAnimationFrame(followFrame);
    followLast = performance.now();
    followFrame = requestAnimationFrame(followStep);
  }
  function followStep(now) {
    const r = S.replay;
    if (!r) return;
    followFrame = requestAnimationFrame(followStep);
    const dt = Math.min(0.1, Math.max(0, (now - followLast) / 1000)), f = r.follow, view = S.view;
    followLast = now;
    if (!f.on || !view?.focus) return;
    // A scripted story pan (frame.js S.cameraPan) has the camera: wait for it, and take its end as ours.
    if (S.cameraPan) { f.at = null; return; }
    // The player moved the camera since the last frame: follow pauses until the toggle is pressed again.
    if (f.at && Math.hypot(view.focus.x - f.at.x, view.focus.z - f.at.z) > MANUAL_SLACK) { setFollow(false); return; }
    if (now >= f.next) { f.target = actionTarget(S.sim, f.target); f.next = now + 250; }
    if (!f.target) { f.at = { x: view.focus.x, z: view.focus.z }; return; }
    const k = 1 - Math.exp(-FOLLOW_RATE * dt), x = view.focus.x + (f.target.x - view.focus.x) * k, z = view.focus.z + (f.target.z - view.focus.z) * k;
    if (Math.hypot(x - view.focus.x, z - view.focus.z) > 0.005) view.focusOn(x, z);
    f.at = { x: view.focus.x, z: view.focus.z };
  }
  function setFollow(on) {
    const r = S.replay;
    if (!r) return;
    r.follow.on = on;
    r.follow.at = null;
    r.follow.next = 0;
    const b = bar?.querySelector('[data-replay="follow"]');
    if (b) b.setAttribute("aria-pressed", String(on));
  }

  function finishIfDone() {
    const r = S.replay;
    if (!r || r.status !== "playing") return;
    if (S.sim.ticks >= r.replay.ticks || S.sim.result) finish();
  }
  function finish() {
    const r = S.replay;
    if (!r || r.status !== "playing") return;
    r.status = replayFeeder(r.replay).status(S.sim);
    r.paused = true;
    render();
  }

  // Back to the title: the app state as it was before the replay, then the normal new-game path.
  function stop(toMenu = true) {
    if (!S.replay) return;
    cancelAnimationFrame(followFrame);
    S.replay = null;
    document.documentElement.classList.remove("replaying");
    if (saved) for (const [k, v] of Object.entries(saved)) S[k] = v;
    saved = null;
    if (bar) bar.hidden = true;
    if (toMenu) A.newGame();
  }
  async function again() {
    const r = S.replay;
    if (!r) return;
    const { replay, entry } = r;
    stop(false);
    return watch(replay, entry);
  }

  function render() {
    const r = S.replay;
    if (!bar?.isConnected) {
      bar = Object.assign(document.createElement("div"), { id: "replay-bar", className: "replay-bar" });
      bar.setAttribute("role", "group");
      bar.setAttribute("aria-label", "Replay controls");
      document.body.append(bar);
      bar.addEventListener("click", (event) => {
        const b = event.target.closest("button");
        if (!b || !S.replay) return;
        if (b.dataset.replay === "play") { if (S.replay.status === "playing") { S.replay.paused = !S.replay.paused; render(); } }
        else if (b.dataset.replay === "exit") stop();
        else if (b.dataset.replay === "again") again();
        else if (b.dataset.replay === "follow") setFollow(!S.replay.follow.on);
        else if (b.dataset.speed) { S.replay.speed = Number(b.dataset.speed); render(); }
      });
    }
    if (!r) { bar.hidden = true; return; }
    bar.hidden = false;
    const total = r.replay.ticks * TICK, now = Math.min(total, S.sim.ticks * TICK), done = r.status !== "playing";
    const status = r.status === "ok" ? `<span class="replay-status ok">${icon("check")}<span>Replay complete: it matches the recorded match.</span></span>`
      : r.status === "drift" ? `<span class="replay-status drift">${icon("close")}<span>The replay drifted from the recorded match: the game's rules changed since it was recorded.</span></span>` : "";
    bar.dataset.status = r.status;
    bar.innerHTML = `<span class="replay-label">${icon("play")}<span>Replay</span></span>
      ${done ? `<button type="button" class="kit-face" data-replay="again">${icon("play")}<span>Watch again</span></button>`
        : `<button type="button" class="kit-face" data-replay="play" aria-pressed="${r.paused}" aria-label="${r.paused ? "Play" : "Pause"}">${icon(r.paused ? "play" : "pause")}<span>${r.paused ? "Play" : "Pause"}</span></button>`}
      <span class="replay-speeds" role="group" aria-label="Replay speed">${SPEEDS.map((x) => `<button type="button" class="kit-face" data-speed="${x}" aria-pressed="${r.speed === x}"${done ? " disabled" : ""}><span translate="no">×${x}</span></button>`).join("")}</span>
      <span class="replay-time" translate="no"><b>${formatClock(now)}</b> / ${formatClock(total)}</span>
      <button type="button" class="kit-face replay-follow" data-replay="follow" aria-pressed="${r.follow.on}" title="The camera follows the fighting, or your army">${icon("crosshair")}<span>Follow action</span></button>
      <span class="replay-track" aria-hidden="true"><i style="width:${total ? Math.round((now / total) * 100) : 0}%"></i></span>
      ${status}
      <button type="button" class="kit-face" data-replay="exit" aria-label="Exit replay">${icon("close")}<span>Exit replay</span></button>`;
  }
  // The time and the track move on while it plays (a light text update every half second).
  setInterval(() => {
    const r = S.replay;
    if (!r || !bar || bar.hidden || r.status !== "playing") return;
    finishIfDone();
    if (r.status !== "playing") return;
    const total = r.replay.ticks * TICK, now = Math.min(total, S.sim.ticks * TICK);
    const t = bar.querySelector(".replay-time b"), track = bar.querySelector(".replay-track i");
    if (t) t.textContent = formatClock(now);
    if (track) track.style.width = `${total ? Math.round((now / total) * 100) : 0}%`;
  }, 500);

  // While a replay plays: no results screen (the bar shows the end), no decision card (the recorded answer
  // is fed at once), no story scene, Space / Esc toggle the replay instead of the pause menu, and leaving
  // through the menu ends it.
  return function bind() {
    const showResult = A.showResult, openDecision = A.openDecision, playScene = A.playScene, togglePause = A.togglePause, newGame = A.newGame;
    A.showResult = (...args) => (S.replay ? finish() : showResult?.(...args));
    A.openDecision = (...args) => { if (!S.replay) return openDecision?.(...args); S.replay.feedNow(); return true; };
    if (playScene) A.playScene = (...args) => (S.replay ? undefined : playScene(...args));
    A.togglePause = (...args) => { if (!S.replay) return togglePause?.(...args); if (S.replay.status === "playing") { S.replay.paused = !S.replay.paused; render(); } };
    A.newGame = (...args) => { if (S.replay) { S.replay = null; document.documentElement.classList.remove("replaying"); if (saved) for (const [k, v] of Object.entries(saved)) S[k] = v; saved = null; if (bar) bar.hidden = true; } return newGame(...args); };
    Object.assign(A, { watchReplay: watch, stopReplay: stop, replayRender: render });
  };
}
