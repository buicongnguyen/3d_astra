// R3-V: the victory ceremony and the MVP card, for every mode (Skirmish, a mission, Frontier Defence).
//
// On a win: about 1.2 s of slow motion on the last kill (when the core beat of app/ui-extras.js has not
// already slowed it), the camera swings to the MVP (most damage plus healing, match-stats.js), then the
// results open: a medal or star stamp lands with a sting, team-colour confetti bursts from it and the
// stats count up. On a loss: "So close", how close it was, and one concrete tip from the match counters.
//
// All of it is presentation. The match is already over (sim.result is set, so the frame loop no longer
// steps it); the slow motion only scales the time the view animates with. Motion off (reduced motion or
// "Animate combat effects" off, the title cover's "calm") skips the slow motion, the swing, the confetti
// and the count-up; the stamp then lands at once. Browser suites (?test) see the static screen unless the URL
// has ?ceremony, so their timing and stat reads stay as they were.
//
// onMatchEnd(fn): R3-R (commander rank) and later packages listen here. fn gets one summary object per
// finished match, after its results screen is on the page.
import "./ceremony.css";
import { reducedMotionQuery } from "./reduced-motion.js";
import { portrait, hasPortrait } from "./portraits.js";
import { CEREMONY, matchEndListenerCount, mvpCardHTML, portraitTypeOf, lossHTML, countFrames, countText } from "./ceremony-rules.js";

export * from "./ceremony-rules.js";
const ease = (k) => k * k * (3 - 2 * k);
const cardOf = (mvp) => mvpCardHTML(mvp, (m) => portrait(portraitTypeOf(m, hasPortrait), "friendly", "mvp-art"));

// ---------------------------------------------------------------- The ceremony controller
export function createCeremony(S, A) {
  const state = { phase: null, t: 0, steps: [], done: null, stamps: 0, lastStamp: null, presented: 0, played: 0, timers: [], frames: [], tag: null };
  // Motion off = calm, as the title cover reads it (R3-M, app/cover.js): reduced motion, or "Animate combat
  // effects" off. Eco quality alone (the phone default) keeps the ceremony: it is a few seconds of 2D.
  const reduced = reducedMotionQuery;
  const motionOff = () => !!reduced?.matches || S.settings?.combatMotion === false;
  const allowed = () => !S.query?.has("test") || S.query.has("ceremony");
  const animated = () => allowed() && !motionOff();

  function clearTimers() {
    for (const id of state.timers) clearTimeout(id);
    for (const id of state.frames) cancelAnimationFrame(id);
    state.timers = []; state.frames = [];
  }
  function later(fn, seconds) { state.timers.push(setTimeout(fn, Math.max(0, seconds * 1000))); }

  // The floating "MVP" tag over the unit while the camera swings to it.
  function showTag(at) {
    hideTag();
    const tag = document.createElement("div");
    tag.className = "mvp-tag";
    tag.setAttribute("aria-hidden", "true");
    tag.innerHTML = `<span>MVP</span>`;
    document.body.append(tag);
    state.tag = { el: tag, at };
  }
  function placeTag() {
    const t = state.tag;
    if (!t || !S.view?.project) return;
    const p = S.view.project(t.at.x, t.at.z, 2.2), r = S.view.renderer?.domElement?.getBoundingClientRect?.();
    if (!p || !r) return;
    t.el.style.transform = `translate(${Math.round(r.left + p.x)}px, ${Math.round(r.top + p.y)}px)`;
  }
  function hideTag() { state.tag?.el.remove(); state.tag = null; }

  // Before the results: returns false when nothing plays (the caller opens the results at once).
  // `slow`: the last kill to slow down on (null when the core beat already did); `mvp`: where to swing.
  function begin({ slow = null, mvp = null, done }) {
    cancel();
    if (!animated() || (!slow && !mvp) || !S.view) return false;
    state.steps = [];
    if (slow) state.steps.push({ kind: "slow", length: CEREMONY.slow, x: slow.x, z: slow.z });
    if (mvp) state.steps.push({ kind: "swing", length: CEREMONY.swing, x: mvp.x, z: mvp.z });
    state.done = done;
    state.played++;
    next();
    return true;
  }
  function next() {
    const step = state.steps.shift();
    if (!step) { finish(); return; }
    state.phase = step.kind;
    state.step = { ...step, fromX: S.view.focus.x, fromZ: S.view.focus.z };
    state.t = 0;
    if (step.kind === "swing") showTag(step);
  }
  function finish() {
    const done = state.done;
    state.phase = null; state.step = null; state.done = null;
    hideTag();
    done?.();
  }
  // Called every frame (wrapped around app/ui-extras.js stepBeat): the time scale for the view.
  function step(dt) {
    const s = state.step;
    if (!state.phase || !s) return 1;
    state.t += dt;
    const pan = s.kind === "slow" ? CEREMONY.slowPan : s.length;
    const k = ease(Math.min(1, state.t / pan));
    S.view.focusOn(s.fromX + (s.x - s.fromX) * k, s.fromZ + (s.z - s.fromZ) * k);
    placeTag();
    const scale = s.kind === "slow" ? CEREMONY.slowScale : 0.6;
    if (state.t >= s.length) next();
    return scale;
  }
  function cancel() {
    clearTimers();
    hideTag();
    state.phase = null; state.step = null; state.done = null; state.steps = [];
    document.querySelectorAll(".ceremony-confetti").forEach((c) => c.remove());
  }

  // ---------------------------------------------------------------- On the results screen
  function sting() {
    // R3-U: the rendered victory stinger (sfx-bank.js sting:victory) once the audio engine runs; the tones below are the fallback.
    if (S.audio?.sfx) { S.audio.sfx.play("sting:victory"); return; }
    const tone = A.tone;
    if (typeof tone !== "function") return;
    tone(660, 0.07);
    later(() => tone(880, 0.08), 0.08);
    later(() => tone(1320, 0.18), 0.17);
  }
  function stampTarget(root) {
    return root.querySelector(".result-card.won .result-emblem, .debrief.won .medal-badge, .defence-result.won .defence-stars, .defence-result.won .heroic-badge, .defence-score .defence-score-big");
  }
  function land(target, mode, animate) {
    target.classList.add("stamped");
    state.stamps++;
    state.lastStamp = { mode, at: performance.now() };
    sting();
    document.dispatchEvent(new CustomEvent("frontier:stamp", { detail: { mode } }));
    if (animate) confetti(target);
  }
  function confetti(target) {
    const rect = target.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.className = "ceremony-confetti";
    canvas.setAttribute("aria-hidden", "true");
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    (document.getElementById("modal") || document.body).append(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) { canvas.remove(); return; }
    ctx.scale(dpr, dpr);
    const team = teamColour(), colours = [team, team, "#ffc75e", "#ffe9a8", "#7fe8ff", "#ffffff"];
    // A small seeded generator: the burst looks the same every time (screenshots compare).
    let seed = 0x2f6e2b1;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2, count = w < 600 ? 46 : 72;
    const bits = Array.from({ length: count }, () => {
      const a = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.5, v = 260 + rand() * 420;
      return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand() * Math.PI, vr: (rand() - 0.5) * 14, s: 5 + rand() * 6, c: colours[Math.floor(rand() * colours.length)] };
    });
    let last = performance.now(), age = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; age += dt;
      ctx.clearRect(0, 0, w, h);
      const fade = Math.max(0, 1 - Math.max(0, age - CEREMONY.confetti * 0.6) / (CEREMONY.confetti * 0.4));
      ctx.globalAlpha = fade;
      for (const b of bits) {
        b.vy += 900 * dt; b.vx *= 1 - 1.4 * dt; b.vy *= 1 - 0.6 * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
        ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      }
      if (age < CEREMONY.confetti && canvas.isConnected) state.frames.push(requestAnimationFrame(tick));
      else canvas.remove();
    };
    state.frames.push(requestAnimationFrame(tick));
  }
  function teamColour() {
    const css = getComputedStyle(document.documentElement).getPropertyValue("--team-friendly").trim();
    return css || "#92ebc5";
  }
  function countUp(root) {
    const nodes = [...root.querySelectorAll(".result-grid .stat strong")];
    const jobs = nodes.map((node, i) => ({ node, frame: countFrames(node.textContent), final: node.textContent, delay: i * 0.06 })).filter((j) => j.frame && j.frame.to > 0);
    if (!jobs.length) return;
    for (const j of jobs) { j.node.textContent = countText(j.frame, 0); j.node.classList.add("counting"); }
    const start = performance.now();
    const tick = (now) => {
      let busy = false;
      for (const j of jobs) {
        if (!j.node.isConnected) continue;
        const k = Math.min(1, Math.max(0, ((now - start) / 1000 - j.delay) / CEREMONY.countUp));
        const out = 1 - (1 - k) ** 3;
        j.node.textContent = k >= 1 ? j.final : countText(j.frame, out);
        if (k < 1) busy = true; else j.node.classList.remove("counting");
      }
      if (busy) state.frames.push(requestAnimationFrame(tick));
    };
    state.frames.push(requestAnimationFrame(tick));
  }

  // Dresses the results screen that is on the page now: MVP card (a win), "So close" and a tip (a loss),
  // then the stamp, confetti and count-up. Returns what it added (tests read it through __frontier.ceremony).
  function present(root, { result, mode, mvp = null, tip = null, near = null }) {
    if (!root) return null;
    clearTimers();
    const win = result === "victory", draw = result === "draw", animate = animated();
    const card = root.querySelector(".result-card, .debrief");
    if (!card) return null;
    card.classList.add("holo-result");
    const grid = card.querySelector(".result-grid");
    if (win && mvp && !card.querySelector(".mvp-card")) {
      const html = cardOf(mvp);
      if (grid) grid.insertAdjacentHTML("beforebegin", html); else card.insertAdjacentHTML("beforeend", html);
    }
    if (!win && (tip || near || !draw) && !card.querySelector(".loss-tip")) {
      const html = lossHTML({ tip, near, draw });
      if (grid) grid.insertAdjacentHTML("afterend", html); else card.insertAdjacentHTML("beforeend", html);
    }
    state.presented++;
    root.classList.toggle("ceremony-live", animate);
    const target = win ? stampTarget(card) : null;
    if (target) {
      target.classList.add("stamp-target");
      if (animate) later(() => land(target, mode, true), CEREMONY.stampDelay + CEREMONY.stampLand);
      else land(target, mode, false);
    }
    if (animate) countUp(card);
    return { mvp: !!card.querySelector(".mvp-card"), tip: card.querySelector(".loss-tip")?.dataset.tip || null, stamp: !!target };
  }

  return {
    begin, step, cancel, present,
    get active() { return !!state.phase; },
    get animated() { return animated(); },
    info: () => ({ phase: state.phase, stamps: state.stamps, lastStamp: state.lastStamp, presented: state.presented, played: state.played, listeners: matchEndListenerCount() }),
  };
}
