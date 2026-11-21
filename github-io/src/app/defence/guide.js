// Frontier Defence, the guided first build (AAA round 3, R3-E): on a profile with no Defence win,
// three coach steps point at the real elements: 1. tap the glowing pad, 2. pick a crew, 3. call the
// wave. Each step follows from the match itself (a pad picked, a tower standing, a wave under way),
// so going back a step is shown too. Finished or skipped, it is stored in defence/progress.js
// (`guided`) and never shows again. Interface only: it reads the match and sends no command.
// Off under ?test unless the URL has ?guide (other suites start on fresh profiles).
import { GUIDE_STEPS } from "./constants.js";

export function createGuide(c) {
  const { S, A, Z, ui } = c;
  const { loadDefence, saveDefence, guideWanted, recordGuided, $ } = c.deps;
  const guideOn = () => !S.query?.has("test") || S.query.has("guide");
  // The pad the guide lights: a ground or rim pad (not a deep one) closest to a road.
  function pickPad(def) {
    const points = Object.values(def.routes || {}).flat();
    let best = null, bestD = Infinity;
    for (const p of def.pads) {
      if (p.high === "deep") continue;
      const d = points.reduce((m, q) => Math.min(m, Math.hypot(p.x - q.x, p.z - q.z)), Infinity);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best || def.pads[0] || null;
  }
  function guideStart() {
    guideStop(false);
    const def = S.sim?.missionDef?.defence, progress = S.defenceProgress || loadDefence();
    if (!def?.pads?.length || !guideOn() || !guideWanted(progress)) return false;
    const pad = pickPad(def);
    if (!pad) return false;
    const el = document.createElement("div");
    el.id = "defence-guide";
    el.innerHTML = `<span id="defence-guide-mark" aria-hidden="true"></span><div id="defence-guide-card" role="status" aria-live="polite"><span class="guide-step"><span>Step</span> <b translate="no" data-guide-step>1</b> <span>of 3</span></span><p data-guide-text></p><button type="button" data-guide-skip>Skip guide</button></div>`;
    $("stage").append(el);
    el.querySelector("[data-guide-skip]").onclick = () => { guideFinish(true); A.updateUI(); };
    ui.guide = { pad: pad.id, step: 0, el, mark: el.querySelector("#defence-guide-mark"), card: el.querySelector("#defence-guide-card"), place: "" };
    S.view.focusOn(pad.x, pad.z);
    S.view.updateCamera?.();
    return true;
  }
  function guideStop() {
    ui.guide?.el.remove();
    ui.guide = null;
    for (const t of document.querySelectorAll(".guide-target")) t.classList.remove("guide-target");
  }
  function guideFinish(skipped = false) {
    if (!ui.guide) return;
    guideStop();
    S.defenceProgress = recordGuided(S.defenceProgress || loadDefence());
    saveDefence(S.defenceProgress);
    A.notice(skipped ? "Guide skipped. Tap a pad beside the road, then pick a crew." : "Your first tower stands and the wave is coming. Hold the road!");
  }
  const guideActive = () => !!ui.guide;
  const guidePad = () => (ui.guide && ui.guide.step === 1 ? ui.guide.pad : null);
  // The step the match is at: a tower standing and a wave under way end the guide.
  function stepNow() {
    const tower = S.sim.entities.some((e) => e.crew && e.team === 0 && e.hp > 0);
    if (tower && S.sim.defence.wave >= 1) return 0;
    return tower ? 3 : S.defencePad || S.defenceSpot ? 2 : 1;
  }
  // What a step points at, as a box on the stage (px), and the element to ring.
  function target(step, stage) {
    if (step === 1) {
      const pad = S.sim.padById(ui.guide.pad), rect = S.view.renderer.domElement.getBoundingClientRect();
      if (!pad) return null;
      const s = S.view.project(pad.x, pad.z, S.view.terrain.heightAt(pad.x, pad.z) + 0.2), x = s.x + rect.left - stage.left, y = s.y + rect.top - stage.top;
      return { x: x - 30, y: y - 30, w: 60, h: 60, round: true, el: null };
    }
    let el = step === 3 ? $("defence-call") : $("commands").querySelector('[data-defence-crew="ranger"]:not(:disabled)') || $("commands").querySelector("[data-defence-crew]:not(:disabled)") || $("commands").querySelector("[data-defence-crew]");
    let r = el?.getBoundingClientRect();
    // A phone on another tab: the Actions tab first.
    if (step === 2 && (!r || !r.width)) { el = document.querySelector('#dock-tabs [data-dock="actions"]'); r = el?.getBoundingClientRect(); }
    if (!r || !r.width) return null;
    return { x: r.left - stage.left - 4, y: r.top - stage.top - 4, w: r.width + 8, h: r.height + 8, round: false, el };
  }
  // Once a frame while the guide is up: the step, the ring on its target and the card beside it.
  function guideFrame() {
    const g = ui.guide;
    if (!g) return;
    if (!S.sim?.defence || S.sim.result) { guideStop(); return; }
    const step = stepNow();
    if (step === 0) { guideFinish(false); return; }
    const hide = !Z.started || Z.paused || !!Z.modalType;
    g.el.hidden = hide;
    if (hide) return;
    if (step !== g.step) {
      g.step = step;
      g.el.dataset.step = String(step);
      g.card.querySelector("[data-guide-step]").textContent = String(step);
      g.card.querySelector("[data-guide-text]").textContent = GUIDE_STEPS[step - 1];
      ui.pads && (ui.pads.key = "");
    }
    const stage = $("stage").getBoundingClientRect(), t = target(step, stage);
    for (const old of document.querySelectorAll(".guide-target")) if (old !== t?.el) old.classList.remove("guide-target");
    t?.el?.classList.add("guide-target");
    g.mark.hidden = !t;
    if (!t) return;
    // The card: beside the target, on the side with the most room, inside the stage.
    const cw = g.card.offsetWidth, ch = g.card.offsetHeight, W = stage.width, H = stage.height, gap = 12;
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    let left, top;
    if (cx > W * 0.62 && t.x - gap - cw >= 8) { left = t.x - gap - cw; top = cy - ch / 2; }
    else if (cy < H / 2) { left = cx - cw / 2; top = t.y + t.h + gap; }
    else { left = cx - cw / 2; top = t.y - gap - ch; }
    left = Math.round(Math.max(8, Math.min(W - cw - 8, left)));
    top = Math.round(Math.max(8, Math.min(H - ch - 8, top)));
    const place = `${Math.round(t.x)},${Math.round(t.y)},${Math.round(t.w)},${Math.round(t.h)},${t.round},${left},${top}`;
    if (place === g.place) return;
    g.place = place;
    Object.assign(g.mark.style, { left: `${Math.round(t.x)}px`, top: `${Math.round(t.y)}px`, width: `${Math.round(t.w)}px`, height: `${Math.round(t.h)}px` });
    g.mark.classList.toggle("round", t.round);
    Object.assign(g.card.style, { left: `${left}px`, top: `${top}px` });
  }
  Object.assign(c, { guideStart, guideStop, guideFinish, guideActive, guidePad, guideFrame });
}
