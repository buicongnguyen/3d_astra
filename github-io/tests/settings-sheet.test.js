// The unified settings sheet (2026-11-24): stored keys stay backward compatible, game speed changes only
// real time (the simulation steps at a fixed 0.05 s whatever the pace), and the sheet's sections cover the
// owner's list in one row.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaults, normalize } from "../src/settings.js";
import { FastForward } from "../src/governor.js";
import { Simulation } from "../src/simulation.js";

test("new keys have defaults, old saves load, bad values fall back", () => {
  const d = defaults();
  assert.equal(d.confirmRestart, true);
  assert.equal(d.panSpeed, 1);
  assert.equal(d.edgeScroll, true);
  assert.equal("screenShake" in d, false, "the dead screenShake key is gone");
  // A save from before the sheet (it still carries screenShake) keeps its choices and gets the new defaults.
  const old = { version: 1, language: "vi", music: "off", screenShake: true, quality: "eco" };
  const s = normalize(old);
  assert.deepEqual([s.language, s.music, s.quality, s.confirmRestart, s.panSpeed], ["vi", "off", "eco", true, 1]);
  assert.equal("screenShake" in s, false);
  assert.equal(normalize({ version: 1, confirmRestart: false }).confirmRestart, false);
  assert.equal(normalize({ version: 1, confirmRestart: "no" }).confirmRestart, true);
  assert.equal(normalize({ version: 1, panSpeed: 9 }).panSpeed, 2);
  assert.equal(normalize({ version: 1, panSpeed: 0.1 }).panSpeed, 0.5);
  assert.equal(normalize({ version: 1, edgeScroll: false }).edgeScroll, false);
});

// The frame loop of app/frame.js reduced to its clock: real seconds × pace feed an accumulator that runs
// fixed 0.05 s ticks (at most six a frame at a fast pace).
function play(pace, ticks) {
  const sim = new Simulation({ ai: true, enemyCount: 1 });
  const f = new FastForward();
  f.pace({ sim, started: true, allowed: true });
  f.set(pace);
  let acc = 0, frames = 0;
  while (sim.ticks < ticks) {
    acc += (1 / 60) * f.pace({ sim, started: true, allowed: true });
    let run = 0;
    while (acc >= 0.05 && sim.ticks < ticks) { sim.tick(0.05); acc -= 0.05; if (++run >= 6) { acc = Math.min(acc, 0.05); break; } }
    frames++;
  }
  return { hash: sim.hash(), frames };
}

test("game speed changes only real time: ×1 and ×3 reach the same simulation state", () => {
  const one = play(1, 600), three = play(3, 600), two = play(2, 600);
  assert.equal(three.hash, one.hash);
  assert.equal(two.hash, one.hash);
  assert.ok(three.frames < one.frames / 2.5, `×3 needs fewer frames (${three.frames} vs ${one.frames})`);
});

test("every match may run fast now; scenes, decisions, menus and new matches still return to ×1", () => {
  const sim = {}, f = new FastForward();
  f.pace({ sim, started: true, allowed: true }); f.set(2);
  assert.equal(f.pace({ sim, started: true, allowed: true }), 2, "a skirmish keeps ×2");
  assert.equal(f.pace({ sim, started: true, allowed: true, forced: true }), 1);
  f.set(3);
  assert.equal(f.pace({ sim: {}, started: true, allowed: true }), 1, "a new match starts at ×1");
  const frame = readFileSync(new URL("../src/app/frame.js", import.meta.url), "utf8");
  assert.match(frame, /fastForward\.pace\(\{ sim: S\.sim, started: Z\.started, allowed: true, forced:/);
  assert.match(frame, /speed === 3 && S\.touchInput \? 2/, "×3 needs a fine pointer");
});

test("the sheet: seven sections in one row, no dropdowns, live apply, no Apply / Cancel", () => {
  const ui = readFileSync(new URL("../src/settings-ui.js", import.meta.url), "utf8");
  for (const id of ["audio", "game", "camera", "display", "controls", "access", "language"]) assert.match(ui, new RegExp(`\\["${id}", "`));
  assert.doesNotMatch(ui, /<select/, "segmented buttons, not dropdowns");
  assert.doesNotMatch(ui, /data-do="(apply|cancel)"/);
  const shell = readFileSync(new URL("../src/app/shell.js", import.meta.url), "utf8");
  for (const gone of ['id="help"', 'id="fullscreen"', 'id="fullscreen-top"', 'id="theme-toggle"']) assert.ok(!shell.includes(gone), `${gone} left the top bar`);
  assert.match(shell, /id="pause"[^]*id="audio"[^]*id="briefing-settings"/, "match bar: pause, sound, settings");
});

test("phase 2 keys: defaults, old saves and the reduced-motion override", async () => {
  const { reducedFor, motionOffFor, CAMERA_PITCH } = await import("../src/settings.js");
  const d = defaults(false), phone = defaults(true);
  assert.deepEqual([d.cameraAngle, d.cameraTurn, d.zoomSpeed, d.minimapSide, d.healthBars, d.alerts, d.textSize, d.reducedMotion, d.haptics],
    ["standard", 0, 1, "left", "hurt", "all", "s", "system", true]);
  assert.equal(d.frameCap, 0, "a PC draws at the display's rate");
  assert.equal(phone.frameCap, 60, "a phone caps at 60");
  const old = normalize({ version: 1, music: "off" }, true);
  assert.deepEqual([old.cameraTurn, old.healthBars, old.frameCap, old.music], [0, "hurt", 60, "off"], "an old save gets the defaults");
  const s = normalize({ version: 1, cameraAngle: "top", cameraTurn: 270, zoomSpeed: 5, minimapSide: "right", healthBars: "always", alerts: "important", frameCap: 30, textSize: "l", reducedMotion: "on", haptics: false });
  assert.deepEqual([s.cameraAngle, s.cameraTurn, s.zoomSpeed, s.minimapSide, s.healthBars, s.alerts, s.frameCap, s.textSize, s.reducedMotion, s.haptics],
    ["top", 270, 2, "right", "always", "important", 30, "l", "on", false]);
  const bad = normalize({ version: 1, cameraAngle: "side", cameraTurn: 45, frameCap: 144, textSize: "xl", reducedMotion: true });
  assert.deepEqual([bad.cameraAngle, bad.cameraTurn, bad.frameCap, bad.textSize, bad.reducedMotion], ["standard", 0, 0, "s", "system"]);
  assert.deepEqual([reducedFor({ reducedMotion: "system" }, true), reducedFor({ reducedMotion: "off" }, true), reducedFor({ reducedMotion: "on" }, false)], [true, false, true]);
  assert.equal(motionOffFor({ ...d, reducedMotion: "on" }, false), true, "On calms decorative motion");
  // The Standard preset is the designed view (CAMERA_OFFSET 25, 51, 43 looks down 45.7 degrees).
  assert.ok(Math.abs(Math.atan2(51, Math.hypot(25, 43)) * 180 / Math.PI - CAMERA_PITCH.standard) < 0.1);
  assert.ok(CAMERA_PITCH.low < CAMERA_PITCH.standard && CAMERA_PITCH.standard < CAMERA_PITCH.top);
});
