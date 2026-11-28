// H8 Hero challenges on screen (HERO-COINS-PLAN.md, owner 2026-11-28). The missions are src/story/hero-challenges.js,
// their rules src/sim/content/hero-challenges.js; this file is the page side:
//   - a row of challenge tiles under the title's quick row (the Hero battle tile's row): one flat 44 px tile per
//     challenge, one tap starts it, each showing the best stars earned (kept on this device);
//   - a challenge is a match of its own (S.quick = "challenge"): the mission is built here, Skywing is the hero and
//     the match starts straight in Hero mode; "Retry" plays it again, "Main menu" ends it; no Skywing row, no coins
//     spent, no autosave (a few minutes long);
//   - the Hero mode HUD gets a challenge strip: the objective, the time, Sabotage's "seen" meter (Unseen / Seen /
//     Alarm) and the Plant button (44 px, held; PC: hold G) beside a relay; Sniper nest's trucks stopped and through;
//   - the result card: the stars (each with its reason), the time, a new best, and the coins (src/meta/coins.js
//     "challenge" lines, through skywing-ui.js) with Retry, the other challenge, and Main menu.
// Failing gives no stars and blocks nothing; every challenge is open from the start.
import "./hero-challenges.css";
import { $ } from "./app/dom.js";
import { icon } from "./icons.js";
import { translate } from "./i18n.js";
import { Simulation } from "./simulation.js";
import { rememberOptions } from "./meta/replay.js";
import { matchLook } from "./factions.js";
import { HERO_CHALLENGES, challengeById } from "./story/hero-challenges.js";
import { loadProgress, saveProgress, recordRun } from "./meta/hero-challenges.js";
import { challengeStars, challengeHero } from "./sim/content/hero-challenges.js";

// Each challenge's tile: icon and caption (the name is the mission's title).
const TILES = Object.freeze({
  sabotage: { icon: "flame", caption: "Sneak in · plant · escape" },
  sniper: { icon: "sniper", caption: "High ground · stop a convoy" },
});
// The stars' reasons, by challenge kind (the first is always the win).
export const STAR_REASONS = Object.freeze({
  sabotage: ["Challenge complete", "No alarm", "Under 3:00"],
  sniper: ["Challenge complete", "No damage taken", "A hit from 24 m"],
});

const starsText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function setupHeroChallenges(S, A) {
  const Z = S.screen;
  S.challengeId = null;
  let progress = loadProgress();
  let row = null, strip = null, plant = null, held = false, last = null;

  // ---------------------------------------------------------------- the match
  // A challenge match: the mission as its own setup (map, rival, difficulty from Settings > Campaign difficulty).
  const buildSim = A.createSim;
  A.createSim = () => {
    if (S.quick !== "challenge") return buildSim();
    const def = challengeById(S.challengeId);
    const options = { map: def.map, enemyCount: def.enemies, aiSpeed: def.speed, alliance: def.alliance, mission: def, difficulty: S.settings.campaignDifficulty };
    const sim = rememberOptions(new Simulation(options), options);
    S.look = matchLook(def, sim);
    return sim;
  };
  const newGame = A.newGame;
  A.newGame = (...args) => { S.challengeId = null; return newGame(...args); };

  function start(id) {
    const def = challengeById(id), go = $("start");
    if (!def || !go || go.disabled || Z.started) return;
    S.quick = "challenge";
    S.challengeId = def.challenge.id;
    S.playMode = "skirmish";
    // The preview is rebuilt for the challenge's map (briefing.js previewBattle reads the setup controls): the map
    // control holds it for that one call, then the player's own choice is back.
    const scenario = $("scenario"), before = scenario?.value;
    try { if (scenario) scenario.value = def.map; A.previewBattle(); } finally { if (scenario) scenario.value = before; }
    S.view.preloadModels?.(["kite", "skywing", "carrier", "relay"]);
    go.onclick?.();
  }

  // Straight into Hero mode once the match runs (match-flow calls skywingStart on every start and restart).
  function heroIn() {
    if (S.quick !== "challenge" || !Z.started || !S.sim?.challenge) return;
    const hero = challengeHero(S.sim);
    if (!hero) return;
    if (A.heroModeOn?.()) A.leaveHeroMode?.(true);
    A.enterHeroMode?.(hero.id);
  }

  // ---------------------------------------------------------------- the title row
  function tileHTML(m) {
    const id = m.challenge.id, t = TILES[id], n = progress.best[id] || 0;
    return `<button type="button" class="hero-challenge-tile" data-hero-challenge="${id}">${icon(t.icon)}<span class="hct-text"><strong>${m.title}</strong><small>${t.caption}</small></span><b class="hct-stars" translate="no" data-best="${n}">${starsText(n)}</b></button>`;
  }
  function renderRow() {
    const slot = $("title-actions");
    if (!slot) return;
    if (!row?.isConnected) {
      row = Object.assign(document.createElement("section"), { id: "hero-challenges", className: "hero-challenges" });
      row.setAttribute("aria-labelledby", "hero-challenges-title");
      row.addEventListener("click", (event) => {
        const b = event.target.closest("[data-hero-challenge]");
        if (b && !b.disabled) start(b.dataset.heroChallenge);
      });
      slot.after(row);
    }
    const html = `<h3 class="hc-head" id="hero-challenges-title">${icon("star")}<span>Hero challenges</span><b class="hc-total" translate="no">${Object.values(progress.best).reduce((a, b) => a + b, 0)} / ${HERO_CHALLENGES.length * 3}</b></h3><div class="hc-tiles">${HERO_CHALLENGES.map(tileHTML).join("")}</div>`;
    if (row.dataset.html !== html) { row.dataset.html = html; row.innerHTML = html; }
    row.hidden = slot.hidden;
    const off = $("start")?.disabled && !S.loadFailed;
    for (const b of row.querySelectorAll("button")) b.disabled = !!off;
  }

  // ---------------------------------------------------------------- the Hero mode strip
  function hudParts() {
    const hud = document.querySelector("#hero-hud");
    if (!hud) return false;
    if (!strip?.isConnected) {
      strip = document.createElement("div");
      strip.className = "hc-strip";
      strip.setAttribute("role", "status");
      strip.innerHTML = `<span class="hcs-goal"></span><span class="hcs-count" translate="no"></span><span class="hcs-time" translate="no"></span><span class="hcs-watch"><i class="hcs-meter" aria-hidden="true"><i></i></i><b class="hcs-state"></b></span>`;
      // In the top row after the hero's plate (PC and landscape phones); portrait phones hang it under the row.
      const plate = hud.querySelector(".hh-top .hh-plate");
      if (plate) plate.after(strip); else hud.append(strip);
    }
    if (!plant?.isConnected) {
      plant = document.createElement("button");
      plant.type = "button";
      plant.className = "hh-plant";
      plant.dataset.hero = "plant";
      plant.hidden = true;
      plant.innerHTML = `<i class="hh-sweep" aria-hidden="true"></i><span class="hh-plant-name">Plant charge</span><kbd translate="no">G</kbd>`;
      const down = (event) => { event.preventDefault(); event.stopPropagation(); try { plant.setPointerCapture(event.pointerId); } catch { /* gone */ } hold(true); };
      plant.addEventListener("pointerdown", down);
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) plant.addEventListener(type, () => hold(false));
      hud.querySelector(".hh-actions")?.prepend(plant);
    }
    return true;
  }
  function hold(on) {
    if (held === on) return;
    held = on;
    if (S.sim?.challenge?.kind === "sabotage" && Z.started && !S.sim.result) S.sim.command({ team: 0, type: "challengePlant", on });
  }
  function paint() {
    const sim = S.sim, c = sim?.challenge, def = sim?.missionDef?.challenge, on = !!c && !!def && A.heroModeOn?.();
    document.documentElement.classList.toggle("hero-challenge", !!on);
    if (!on) { if (strip) strip.hidden = true; if (plant) plant.hidden = true; if (held) hold(false); return; }
    if (!hudParts()) return;
    strip.hidden = false;
    const set = (sel, text) => { const el = strip.querySelector(sel); if (el.dataset.text !== text) { el.dataset.text = text; el.textContent = text; } };
    const status = sim.missionStatus() || [], goal = status.find((o) => o.state === "active" && !o.hidden) || status[status.length - 1];
    set(".hcs-goal", goal ? translate(goal.text) : "");
    if (def.kind === "sabotage") set(".hcs-count", `${c.set || 0}/${def.relays.length}`);
    else set(".hcs-count", `${(status.find((o) => o.id === "convoy")?.have) || 0}/${status.find((o) => o.id === "convoy")?.need || 0} · ⇥${c.escaped || 0}`);
    set(".hcs-time", clock(c.real));
    const watch = strip.querySelector(".hcs-watch");
    watch.hidden = def.kind !== "sabotage";
    if (def.kind === "sabotage") {
      const state = c.alarm ? "alarm" : c.sus > 0.01 ? "seen" : "unseen";
      if (watch.dataset.state !== state) { watch.dataset.state = state; strip.querySelector(".hcs-state").textContent = translate(state === "alarm" ? "Alarm" : state === "seen" ? "Seen!" : "Unseen"); }
      strip.querySelector(".hcs-meter > i").style.width = `${Math.round((c.alarm ? 1 : c.sus) * 100)}%`;
    }
    // The Plant button: beside a relay still to charge, on foot.
    const near = def.kind === "sabotage" && !!c.near;
    if (plant.hidden === near) { plant.hidden = !near; document.documentElement.classList.toggle("hc-planting", near); }
    if (near) plant.style.setProperty("--cd", (1 - (c.plant || 0)).toFixed(3));
    else if (held) hold(false);
  }

  // ---------------------------------------------------------------- the result
  function resultHTML() {
    const sim = S.sim, def = sim.missionDef, kind = def.challenge.kind, id = def.challenge.id, won = sim.result === "victory";
    const { stars, got } = challengeStars(sim);
    if (last?.sim !== sim) {
      const r = recordRun(progress, id, stars);
      progress = r.progress;
      saveProgress(progress);
      last = { sim, fresh: r.fresh };
    }
    const fresh = last.fresh, other = HERO_CHALLENGES.find((m) => m.challenge.id !== id);
    const reasons = STAR_REASONS[kind].map((text, i) => `<li class="${got[i] ? "got" : "miss"}"><b aria-hidden="true">${got[i] ? "★" : "☆"}</b><span>${text}</span></li>`).join("");
    return `<div class="hc-result" data-stars="${stars}" data-new-stars="${fresh}">
      <span class="eyebrow">${won ? "HERO CHALLENGE COMPLETE" : "HERO CHALLENGE"}</span>
      <h2 id="modal-title">${def.title}</h2>
      <p class="hc-stars-big" translate="no" aria-label="${stars} / 3">${starsText(stars)}</p>
      <ul class="hc-reasons">${reasons}</ul>
      <p class="hc-line"><span>Time</span> <b translate="no">${clock(sim.challenge?.real || 0)}</b>${fresh ? ` <em class="hc-best">New best</em>` : ""}</p>
      ${won ? "" : `<p class="hc-line hc-try">Not this time. Every challenge stays open: try again.</p>`}
      <div class="result-actions"><button class="primary" data-restart>${icon("rally")}<span>Retry</span></button><button class="secondary" data-hero-challenge-next="${other.challenge.id}">${icon(TILES[other.challenge.id].icon)}<span>${other.title}</span></button><button class="secondary" data-new-game>Main menu</button></div>
    </div>`;
  }

  return function bind() {
    // Skywing is the hero (the challenge brings it): no Skywing row purchase, straight into Hero mode.
    const skywingStart = A.skywingStart;
    A.skywingStart = (restart) => { if (S.quick === "challenge") { heroIn(); return; } skywingStart?.(restart); };
    A.challengeResultHTML = resultHTML;
    // The other challenge from the result card: back to the menu, then straight in.
    document.addEventListener("click", (event) => {
      const b = event.target.closest?.("[data-hero-challenge-next]");
      if (!b) return;
      const id = b.dataset.heroChallengeNext;
      Promise.resolve(A.newGame()).then(() => start(id));
    });
    // PC: hold G beside a relay to plant (the RTS grid key is not used in Hero mode).
    window.addEventListener("keydown", (event) => {
      if (!A.heroModeOn?.() || !S.sim?.challenge || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.code !== "KeyG" && event.key?.toLowerCase() !== "g") return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) hold(true);
    }, true);
    window.addEventListener("keyup", (event) => { if (event.code === "KeyG" || event.key?.toLowerCase() === "g") hold(false); }, true);
    window.addEventListener("blur", () => hold(false));
    const tick = A.heroTick;
    A.heroTick = (dt) => { tick?.(dt); paint(); };
    // The row follows the title's quick row (shown, hidden, enabled with Start).
    renderRow();
    const slot = $("title-actions");
    if (slot) new MutationObserver(renderRow).observe(slot, { attributes: true, attributeFilter: ["hidden"] });
    const go = $("start");
    if (go) new MutationObserver(renderRow).observe(go, { attributes: true, attributeFilter: ["disabled"] });
    Object.assign(A, { heroChallenges: { start, progress: () => progress, reset: () => { progress = loadProgress(); renderRow(); } } });
    A.renderHeroChallenges = renderRow;
    const menu = A.newGame;
    A.newGame = (...args) => { const r = menu(...args); Promise.resolve(r).then(renderRow); return r; };
  };
}
