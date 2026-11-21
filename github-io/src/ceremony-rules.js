// R3-V: the pure parts of the victory ceremony (no DOM, no stylesheet), shared by ceremony.js and the
// Node tests (tests/ceremony.test.js): the onMatchEnd listener list, timings, the MVP card, the loss tip,
// how close a loss was, and the count-up frames.
// ---------------------------------------------------------------- Match end listeners
const listeners = new Set();
export function onMatchEnd(fn) {
  if (typeof fn !== "function") return () => false;
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function emitMatchEnd(summary) {
  for (const fn of [...listeners]) {
    try { fn(summary); } catch (error) { console.error("[onMatchEnd]", error); }
  }
  return listeners.size;
}
export const matchEndListenerCount = () => listeners.size;

// ---------------------------------------------------------------- Timing (seconds)
export const CEREMONY = Object.freeze({ slow: 1.2, slowScale: 0.3, slowPan: 0.5, swing: 0.9, stampDelay: 0.25, stampLand: 0.42, countUp: 0.9, confetti: 1.6 });

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const whole = (n) => Math.round(n || 0);

// ---------------------------------------------------------------- MVP
// The portrait cell for a credited unit: a tower shows the unit it is crewed by.
// `has` is portraits.js hasPortrait (passed in, so this module stays free of stylesheets for Node tests).
export function portraitTypeOf(mvp, has = () => false) {
  if (!mvp) return null;
  if (mvp.crewType && has(mvp.crewType)) return mvp.crewType;
  if (has(mvp.type)) return mvp.type;
  return mvp.kind === "building" ? "tower" : "vanguard";
}

// No unit dealt damage (a quiet objective win): the most seasoned of the player's own units stands in.
export function fallbackMvp(sim) {
  const own = (sim?.entities || []).filter((e) => e.team === 0 && e.hp > 0);
  const army = own.filter((e) => e.kind === "unit" && e.type !== "worker");
  const pick = army.sort((a, b) => (b.xp || 0) - (a.xp || 0) || a.id - b.id)[0]
    || own.filter((e) => e.crew).sort((a, b) => a.id - b.id)[0]
    || own.find((e) => e.type === "hq") || own.find((e) => e.kind === "unit") || null;
  if (!pick) return null;
  return { id: pick.id, type: pick.type, name: pick.name || pick.type, kind: pick.kind, crew: pick.crew || null, crewType: pick.crew && sim.crewType ? sim.crewType(pick.crew, 0) : null, damage: 0, healing: 0, kills: 0, x: pick.x, z: pick.z, score: 0, fallback: true };
}

// The card. Numbers and words sit in their own elements so the Vietnamese catalogue translates the words.
// `art(mvp)` draws the portrait (ceremony.js passes the atlas portrait of portraitTypeOf).
export function mvpCardHTML(mvp, art = () => "") {
  if (!mvp) return "";
  const parts = [];
  if (whole(mvp.damage) > 0) parts.push(`<span class="mvp-fig"><b>${whole(mvp.damage)}</b> <span>damage</span></span>`);
  if (whole(mvp.healing) > 0) parts.push(`<span class="mvp-fig heal"><b>${whole(mvp.healing)}</b> <span>healing</span></span>`);
  if (mvp.kills > 0) parts.push(`<span class="mvp-fig"><b>${mvp.kills}</b> <span>${mvp.kills === 1 ? "kill" : "kills"}</span></span>`);
  const line = parts.length ? parts.join("") : `<span class="mvp-fig"><span>Held the line</span></span>`;
  return `<div class="mvp-card" data-mvp="${esc(mvp.type)}" data-mvp-id="${mvp.id}">
    <div class="mvp-portrait">${art(mvp)}</div>
    <div class="mvp-text"><span class="mvp-label">MVP</span><strong class="mvp-name">${esc(mvp.name)}</strong><span class="mvp-line">${line}</span></div>
  </div>`;
}

// ---------------------------------------------------------------- Loss: "So close" and one tip
// One concrete tip from the match counters (match-stats.js). The first rule that fits wins; each names
// the number it read, so the player sees why. Pure: unit tested in tests/ceremony.test.js.
export function lossTip(stats, { seconds = 0 } = {}) {
  const s = stats || {}, minutes = Math.max(1, Math.round(seconds / 60));
  const gathered = whole(s.alloy) + whole(s.energy), trained = whole(s.trained), lost = whole(s.lost), killed = whole(s.killed);
  if (seconds >= 150 && gathered / minutes < 120)
    return { id: "economy", fact: `You gathered ${gathered} resources in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`, advice: "Train Harvesters early: eight or more keep the army coming." };
  if (seconds >= 150 && trained < Math.max(4, Math.floor(minutes * 1.5)))
    return { id: "army", fact: `You trained ${trained} ${trained === 1 ? "unit" : "units"}.`, advice: "Keep the Command core and a Barracks producing all match." };
  if (lost >= 6 && killed < lost * 0.6)
    return { id: "trades", fact: `You lost ${lost} units and defeated ${killed}.`, advice: "Gather the army before you attack and fight together, not one by one." };
  if (whole(s.structuresLost) >= 3)
    return { id: "base", fact: `You lost ${whole(s.structuresLost)} buildings.`, advice: "Keep a few units at home, or build a Tower beside the Command core." };
  return { id: "upgrades", fact: "The fight was close.", advice: "Research weapons and plating at the Foundry: upgrades win even fights." };
}

// How close it was: the least-healthy enemy Command core still standing (Skirmish), the objectives done
// (a mission) or the waves held (Defence). Null when there is nothing to say.
export function closeness(sim) {
  if (!sim) return null;
  if (sim.defence && sim.missionDef?.defence?.waves) return `You held ${sim.defence.cleared} of ${sim.missionDef.defence.waves.length} waves.`;
  const status = typeof sim.missionStatus === "function" && sim.mission ? sim.missionStatus() || [] : null;
  if (status) {
    const main = status.filter((o) => !o.optional), done = main.filter((o) => o.state === "done").length;
    return main.length ? `You completed ${done} of ${main.length} objectives.` : null;
  }
  const cores = (sim.entities || []).filter((e) => e.team !== 0 && e.type === "hq" && e.hp > 0 && e.maxHp > 0);
  if (!cores.length) return null;
  const share = Math.min(...cores.map((e) => e.hp / e.maxHp));
  return share < 0.995 ? `The enemy core was down to ${Math.max(1, Math.round(share * 100))}% health.` : null;
}

export function lossHTML({ tip = null, near = null, draw = false } = {}) {
  const tipLine = tip ? `<span class="loss-tip-line"><b class="loss-tip-tag">Tip</b> <span class="loss-fact">${esc(tip.fact)}</span> <span class="loss-advice">${esc(tip.advice)}</span></span>` : "";
  return `<div class="loss-tip"${tip ? ` data-tip="${tip.id}"` : ""}>
    ${draw ? "" : `<strong class="so-close">So close.</strong>`}${near ? ` <span class="loss-near">${esc(near)}</span>` : ""}
    ${tipLine}
  </div>`;
}

// ---------------------------------------------------------------- Count-up
// "12" counts from 0; "3:41" counts its seconds; anything else ("—", "4/10") is left as it is.
export function countFrames(text) {
  const t = String(text).trim();
  if (/^\d+$/.test(t)) return { kind: "int", to: Number(t) };
  const m = t.match(/^(\d+):(\d\d)$/);
  if (m) return { kind: "clock", to: Number(m[1]) * 60 + Number(m[2]) };
  return null;
}
export function countText(frame, k) {
  const v = Math.round(frame.to * k);
  return frame.kind === "clock" ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}` : String(v);
}

