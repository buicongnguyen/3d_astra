// Frontier Defence, the result screen (stars, Heroic, Endless / Daily score) and "Next level".
// R3-E: a level's result names one concrete next-star hint (nextStar).
import { counterCrews, waveTypes } from "../../defence/traits.js";
import { CREW_LABEL } from "./constants.js";

export function createResult(c) {
  const { S, A, Z, root, ui } = c;
  const { recordHeroic, starsFor, icon, DEFENCE_LEVELS, loadDefence, recordDefence, saveDefence, statTile, formatClock, DIFFICULTY_LABELS, recordScore, bestScore, dayKey, $ } = c.deps;
  const { D, hasHeroic } = c.deps;
  const { boardOf, recordRun, endlessScore, boardHtml } = c.deps;
  // ---------------------------------------------------------------- Next star (R3-E)
  // One line on what earns the next star, then one tip from this match: the wave that cost the most
  // lives (bar.js counts them as they go) and the crews that counter its toughest unit; else the
  // gold tier, or a rim pad. Three stars point at Heroic, then at Veteran.
  function nextStar(win, stars) {
    const sim = S.sim, def = sim.missionDef, d = sim.defence, medals = def.medals || {};
    if (win && stars >= 3) {
      if (hasHeroic?.(def.id)) return { kind: "heroic", goal: "All three stars. Next: the Heroic challenge, for one more star.", tip: "" };
      return sim.difficulty === "veteran" ? null : { kind: "veteran", goal: "All three stars. Next: clear it on Veteran.", tip: "" };
    }
    const need = win ? (stars === 1 ? medals.silver?.lives : medals.gold?.lives) : null;
    const goal = !win ? { text: `Hold all ${def.defence.waves.length} waves.`, kind: "hold" } : need ? { text: `Finish with ${need} lives or more (you kept ${d.lives}).`, kind: "lives" } : null;
    if (!goal) return null;
    const worst = Object.entries(ui.leaks || {}).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    const wave = worst ? sim.defenceWave(Number(worst[0]) - 1) : null;
    if (wave) {
      const types = waveTypes(wave.groups, (g, slot) => sim.waveType(g, slot)), tough = types.map((t) => t.type).filter((t) => D[t]).sort((a, b) => (D[b].hp + (D[b].shield || 0)) - (D[a].hp + (D[a].shield || 0)))[0];
      const crews = tough ? counterCrews({ type: tough }, D, def.defence.crews) : [];
      if (tough && crews.length) return { kind: goal.kind, goal: goal.text, wave: Number(worst[0]), unit: D[tough].name, crews: crews.map((x) => CREW_LABEL[x] || x) };
    }
    const towers = sim.entities.filter((e) => e.crew && e.team === 0 && e.hp > 0);
    if (!towers.some((t) => t.tier >= 3)) return { kind: goal.kind, goal: goal.text, tip: "Take one tower to gold tier 3: it hits far harder and opens a branch." };
    if (def.defence.pads.some((p) => p.high === "rim") && !towers.some((t) => sim.padById(t.pad)?.high === "rim")) return { kind: goal.kind, goal: goal.text, tip: "Crew a rim pad: 2 m more reach and harder hits." };
    return { kind: goal.kind, goal: goal.text, tip: "Call a wave early only once your towers are upgraded." };
  }
  function nextStarHtml(h) {
    if (!h) return "";
    const tip = h.wave ? `<span class="next-star-tip"><span>Wave ${h.wave} cost the most lives:</span> <b>${h.unit}</b>. <span>Counter it with</span> ${h.crews.map((x) => `<b>${x}</b>`).join(" ")}</span>` : h.tip ? `<span class="next-star-tip">${h.tip}</span>` : "";
    return `<p class="defence-next-star" data-next-star="${h.kind}">${icon("info")}<span><strong>Next star</strong> <span>${h.goal}</span>${tip}</span></p>`;
  }

  // ---------------------------------------------------------------- Result
  function result() {
    const sim = S.sim, def = sim.missionDef, d = sim.defence, win = sim.result === "victory";
    if (def.variant === "heroic") return heroicResult();
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
      ${nextStarHtml(nextStar(win, stars))}
      <div class="debrief-actions">${next >= 0 ? `<button class="primary" data-defence-next="${next}"><span>Next level</span>${icon("arrow")}</button><button class="secondary" data-restart>Retry</button>` : `<button class="primary" data-restart><span>Retry</span>${icon("arrow")}</button>`}<button class="secondary" data-new-game>Levels</button></div>
    </div>`;
    document.querySelector("#modal .modal").scrollTop = 0;
    $("modal").querySelector(".primary")?.focus({ preventScroll: true });
  }
  // Heroic (W2-B): a win records the challenge (+1 star) and shows the Heroic badge.
  function heroicResult() {
    const sim = S.sim, def = sim.missionDef, d = sim.defence, win = sim.result === "victory", index = DEFENCE_LEVELS.findIndex((l) => l.id === def.id);
    const before = !!loadDefence().heroic?.[def.id]?.won;
    if (win) { S.defenceProgress = recordHeroic(loadDefence(), def.id, { lives: d.lives }); saveDefence(S.defenceProgress); }
    const killed = S.matchStats?.stats?.killed ?? 0;
    $("modal").classList.add("debrief-wide");
    $("modal-content").innerHTML = `<div class="debrief defence-result heroic ${win ? "won" : "lost"}" data-result="${win ? "victory" : "defeat"}" data-variant="heroic" data-stars="${win ? 1 : 0}">
      <span class="eyebrow">DEFENCE · HEROIC · LEVEL ${String(index + 1).padStart(2, "0")} · ${win ? "HELD" : "BROKEN"}</span>
      <div class="debrief-head"><span class="heroic-badge" role="img" aria-label="Heroic">${win ? "★" : "✕"}<b>Heroic</b></span><div><h2 id="modal-title">${def.title}</h2><p class="debrief-result"><strong>${win ? "Victory" : "Defeat"}</strong><span>${win ? (before ? "Heroic cleared again" : "Heroic cleared: +1 star") : "The elites broke the line"}</span></p></div></div>
      <p class="debrief-difficulty">${DIFFICULTY_LABELS[sim.difficulty || "standard"]}</p>
      <div class="result-grid">${statTile(`${d.lives}`, "Lives left", d.lives ? "" : "loss")}${statTile(`${d.cleared}/${def.defence.waves.length}`, "Waves held")}${statTile(String(Math.round(killed)), "Enemies defeated")}${statTile(String(d.bounty), "Bounty alloy", "alloy")}${statTile(formatClock(sim.time), "Time", "time")}</div>
      <div class="debrief-actions"><button class="primary" data-restart><span>${win ? "Play again" : "Retry"}</span>${icon("arrow")}</button><button class="secondary" data-new-game>Levels</button></div>
    </div>`;
    document.querySelector("#modal .modal").scrollTop = 0;
    $("modal").querySelector(".primary")?.focus({ preventScroll: true });
  }
  // Endless and the Daily seed: the score is the waves held; the best one is kept in this browser.
  function scoreResult() {
    const sim = S.sim, def = sim.missionDef, d = sim.defence, variant = def.variant, day = dayKey(), score = d.cleared;
    const before = bestScore(loadDefence(), variant, def.id, day);
    S.defenceProgress = recordScore(loadDefence(), variant, def.id, score, day);
    const killed = S.matchStats?.stats?.killed ?? 0;
    // W10: an Endless run joins the map's top ten (wave, score, date, commander branch), once per match.
    let board = "", place = 0, points = 0;
    if (variant === "endless" && boardOf) {
      const h = d.hero || {};
      points = endlessScore(score, killed);
      if (ui.boardRun !== sim) { ui.boardRun = sim; ({ progress: S.defenceProgress, place } = recordRun(S.defenceProgress, def.id, { wave: score, score: points, branch: h.branch || "", rank: h.rank || 1, date: day })); ui.boardPlace = place; }
      else place = ui.boardPlace || 0;
      board = `<section class="defence-records" aria-label="Endless top 10"><h3><span>Endless top 10</span> · <span>${def.title}</span></h3>${boardHtml(boardOf(S.defenceProgress, def.id), place)}</section>`;
    }
    saveDefence(S.defenceProgress);
    const best = Math.max(before, score), record = score > before;
    $("modal").classList.add("debrief-wide");
    $("modal-content").innerHTML = `<div class="debrief defence-result defence-score" data-result="score" data-variant="${variant}" data-score="${score}">
      <span class="eyebrow">${variant === "daily" ? "DEFENCE · DAILY SEED" : "DEFENCE · ENDLESS"}</span>
      <div class="debrief-head"><span class="defence-score-big" translate="no">${score}</span><div><h2 id="modal-title">${def.title}</h2><p class="debrief-result"><strong>${score === 1 ? "1 wave held" : `${score} waves held`}</strong><span>${record ? "New best!" : `Best: ${best}`}</span></p></div></div>
      <p class="debrief-difficulty">${DIFFICULTY_LABELS[sim.difficulty || "standard"]}${variant === "daily" ? ` · <span translate="no">${day}</span>` : ""}</p>
      <div class="result-grid">${statTile(String(score), "Waves held")}${statTile(String(best), "Best")}${variant === "endless" ? `${statTile(String(points), "Score")}${statTile(place ? `#${place}` : "—", "Top 10 place")}` : ""}${statTile(String(Math.round(killed)), "Enemies defeated")}${statTile(String(d.bounty), "Bounty alloy", "alloy")}${statTile(formatClock(sim.time), "Time", "time")}</div>
      ${board}
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
  Object.assign(c, { result, heroicResult, scoreResult, nextStar });
}
