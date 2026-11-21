// First-minute hooks (AAA round 3, R3-Q), the app side.
//
// 1. "Quick battle": one tap on the title (the #title-actions slot R3-M left in app/shell.js) starts a
//    gentle, winnable 1v1 skirmish straight away: Riverlands, one Relaxed rival of another faction,
//    your remembered faction, no other battle rules. The match carries the rule `quick: "on"`
//    (src/sim/content/quick-battle.js: a ready outpost and enemy scouts at about 0:40). The player's
//    chosen skirmish setup and battle rules are left as they were: the rule is added only while the
//    match is built (A.createSim) and never stored. "Play again" replays a Quick battle; "Main menu"
//    ends it.
// 2. "First watch": a profile that has never won a Defence level plays level 1 through the new
//    variant in src/defence/first-watch.js (a Scout Runner worth bonus alloy), and the match opens
//    with the level's enemy roster as a strip until the first wave sets off. Browser suites (?test)
//    keep the designed level unless the URL has ?firstwatch, as R3-E's guide does with ?guide.
import "./quick-battle.css";
import { $ } from "./app/dom.js";
import { icon } from "./icons.js";
import { readSave } from "./savegame.js";
import { DEFINITIONS as D } from "./data.js";
import { hasPortrait, portrait } from "./portraits.js";
import { loadDefence, hasDefenceWin } from "./defence/progress.js";
import { firstWatch, rosterOf } from "./defence/first-watch.js";
import { isPlayerFaction } from "./factions.js";
import { QUICK_SETUP, quickRival, quickRules } from "./sim/content/quick-battle.js";

export function setupQuickBattle(S, A) {
  const Z = S.screen;
  S.quick = false;

  // ---------- the rule reaches the sim only while a Quick battle is built ----------
  const buildSim = A.createSim;
  A.createSim = () => {
    const chosen = quickRules(S.rules, false);
    S.rules = quickRules(chosen, S.quick && S.playMode === "skirmish");
    try { return buildSim(); } finally { S.rules = chosen; }
  };
  // Back to the title ends the Quick battle (the menu shows the player's own setup again).
  const newGame = A.newGame;
  A.newGame = (...args) => { S.quick = false; return newGame(...args); };

  function startQuick() {
    const button = $("quick-battle");
    if (!button || button.disabled || Z.started) return;
    const player = isPlayerFaction($("player-faction").value) ? $("player-faction").value : "meridian";
    // The preview is rebuilt from the setup controls (briefing.js previewBattle: terrain, colours,
    // models), so they hold the Quick battle setup for that one call and get the player's back at once.
    const quick = { scenario: QUICK_SETUP.map, "enemy-count": String(QUICK_SETUP.enemyCount), "ai-speed": QUICK_SETUP.aiSpeed, alliance: QUICK_SETUP.alliance, "enemy-faction": quickRival(player) };
    const before = Object.fromEntries(Object.keys(quick).map((id) => [id, $(id).value]));
    S.quick = true;
    S.playMode = "skirmish";
    try {
      for (const [id, value] of Object.entries(quick)) $(id).value = value;
      A.previewBattle();
    } finally {
      for (const [id, value] of Object.entries(before)) $(id).value = value;
    }
    // Start's own handler: assets, audio and beginMatch, as a tap on Start would (never the campaign briefing).
    $("start").onclick?.();
  }

  // ---------- First watch: level 1 for a new Defence player ----------
  const FIRST = new WeakMap();
  const firstWatchOn = () => S.defenceVariant === "levels" && !hasDefenceWin(S.defenceProgress || loadDefence()) && (!S.query.has("test") || S.query.has("firstwatch"));
  const defenceMission = A.defenceMission;
  if (defenceMission) A.defenceMission = (level) => {
    const def = defenceMission(level);
    if (!firstWatchOn() || !def || typeof def !== "object") return def;
    let made = FIRST.get(def);
    if (!made) FIRST.set(def, (made = firstWatch(def)));
    return made;
  };

  // The enemy roster strip: from the start of a First watch match until its first wave sets off.
  let strip = null, stripKey = "";
  function rosterHTML(sim) {
    const def = sim.missionDef, foe = (slot, faction) => (faction ? sim.waveType({ faction }, slot) : sim.typeFor(1, slot));
    const unit = ({ slot, faction, wave }) => {
      const type = foe(slot, faction), d = D[type];
      return `<li class="roster-unit" data-type="${type}">${hasPortrait(type) ? portrait(type, "hostile") : icon(d?.icon || "tank")}<span class="roster-text"><strong>${d?.name || type}</strong><small><span>Wave</span> <b translate="no">${wave}</b></small></span></li>`;
    };
    const run = def.defence.runner, r = run && D[run.type];
    const runner = run ? `<li class="roster-unit roster-runner" data-type="${run.type}">${hasPortrait(run.type) ? portrait(run.type, "hostile") : icon("bolt")}<span class="roster-bolt">${icon("bolt")}</span><span class="roster-text"><strong>Scout Runner</strong><small>Bonus alloy</small></span></li>` : "";
    return `<span class="roster-head">${icon("flag")}<span>Enemy roster</span></span><ol class="roster-list">${runner}${rosterOf(def).map(unit).join("")}</ol>${r ? `<span class="roster-tip">Catch the Scout Runner before it reaches the end of the road.</span>` : ""}`;
  }
  // A runner that left the field without being caught got through the line (it costs no lives).
  let watched = null;
  function watchRunner(sim) {
    const run = sim?.defence?.runner;
    if (!run || run.done) { watched = null; return; }
    if (sim.entities.some((e) => e.id === run.id && e.hp > 0)) { watched = { sim, id: run.id }; return; }
    if (watched?.sim === sim && watched.id === run.id && !sim.entities.some((e) => e.id === run.id)) {
      watched = null;
      A.notice("The Scout Runner got away. No lives lost.");
    }
  }
  function syncRoster() {
    if (Z.started) watchRunner(S.sim);
    const sim = S.sim, on = !!(Z.started && sim?.defence && sim.missionDef?.defence?.preview && sim.defence.wave === 0 && !sim.result);
    if (!on) { if (strip) strip.hidden = true; return; }
    if (!strip?.isConnected) {
      strip = document.createElement("div");
      strip.id = "roster-preview";
      strip.setAttribute("role", "group");
      strip.setAttribute("aria-label", "Enemy roster");
      $("stage").append(strip);
      stripKey = "";
    }
    const key = `${sim.missionDef.id}|${sim.difficulty}|${sim.factions?.[1]}`;
    if (key !== stripKey) { strip.innerHTML = rosterHTML(sim); stripKey = key; }
    strip.hidden = false;
  }
  const defenceHud = A.defenceHud;
  if (defenceHud) A.defenceHud = (selected) => { defenceHud(selected); syncRoster(); };

  return function bind() {
    const slot = $("title-actions");
    if (!slot) return;
    slot.innerHTML = `<button type="button" id="quick-battle" class="quick-battle">${icon("bolt")}<span class="quick-text"><strong>Quick battle</strong><small>Ready base · 1 rival</small></span></button>`;
    slot.hidden = false;
    const button = $("quick-battle"), start = $("start");
    // Usable exactly when Start is (not while the first models load or after a failed load).
    const sync = () => { button.disabled = start.disabled && !S.loadFailed; };
    sync();
    new MutationObserver(sync).observe(start, { attributes: true, attributeFilter: ["disabled"] });
    button.addEventListener("click", startQuick);
    // A saved Quick battle continues as one ("Play again" replays it); the saved rules say so.
    $("continue")?.addEventListener("click", () => {
      try { S.quick = JSON.parse(readSave()?.text || "null")?.options?.rules?.quick === "on"; } catch { S.quick = false; }
    });
  };
}

