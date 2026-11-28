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

test("the sheet: eight sections in one row, no dropdowns, live apply, no Apply / Cancel", () => {
  const ui = readFileSync(new URL("../src/settings-ui.js", import.meta.url), "utf8");
  for (const id of ["audio", "game", "camera", "hero", "display", "controls", "access", "language"]) assert.match(ui, new RegExp(`\\["${id}", "`));
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

// H7 Settings > Hero (2026-11-28): the eight rows' keys, their defaults (aim assist Low on a PC, High on touch), old
// saves, bad values, and the round trip through the device's storage. Battle time and the ground camera moved here.
test("Hero section: keys, defaults, old saves, bad values and saving per device", async () => {
  const { loadSettings, saveSettings, STORAGE_KEY } = await import("../src/settings.js");
  const pc = defaults(false), touch = defaults(true);
  assert.deepEqual([pc.battleTime, pc.dodgeHelp, pc.shotWarnings, pc.aimAssist, pc.heroView, pc.closeDetail, pc.skywingOffer, pc.birdHint, pc.birds, pc.autoFire],
    [0.5, false, true, "low", "shoulder", "auto", true, true, "few", true]);
  assert.equal(touch.autoFire, true, "auto fire on by default on phones too");
  assert.equal(touch.birds, "few", "few birds on phones too");
  assert.equal(touch.aimAssist, "high", "touch screens aim with more help");
  const old = normalize({ version: 1, battleTime: 0.75, heroView: "first" }, true);
  assert.deepEqual([old.battleTime, old.heroView, old.dodgeHelp, old.aimAssist, old.closeDetail, old.birdHint, old.birds, old.autoFire], [0.75, "first", false, "high", "auto", true, "few", true], "a save from before H7 (and before Birds and Auto fire)");
  const set = normalize({ version: 1, dodgeHelp: true, shotWarnings: false, aimAssist: "off", closeDetail: "off", skywingOffer: false, birdHint: false, birds: "off", autoFire: false });
  assert.deepEqual([set.dodgeHelp, set.shotWarnings, set.aimAssist, set.closeDetail, set.skywingOffer, set.birdHint, set.birds, set.autoFire], [true, false, "off", "off", false, false, "off", false]);
  const bad = normalize({ version: 1, dodgeHelp: "yes", aimAssist: "max", closeDetail: 1, birdHint: "on", battleTime: 2, birds: true, autoFire: "off" });
  assert.deepEqual([bad.dodgeHelp, bad.aimAssist, bad.closeDetail, bad.birdHint, bad.battleTime, bad.birds, bad.autoFire], [false, "low", "auto", true, 0.5, "few", true]);
  // Saved per device: through the same storage the sheet uses.
  const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  assert.equal(saveSettings({ ...pc, dodgeHelp: true, aimAssist: "high", closeDetail: "on", birdHint: false, birds: "many", autoFire: false }, storage), true);
  assert.ok(store.has(STORAGE_KEY));
  const back = loadSettings(false, storage);
  assert.deepEqual([back.dodgeHelp, back.aimAssist, back.closeDetail, back.birdHint, back.birds, back.autoFire], [true, "high", "on", false, "many", false]);
  // The rows live in the Hero section only (each key once in the sheet).
  const ui = readFileSync(new URL("../src/settings-ui.js", import.meta.url), "utf8");
  for (const key of ["battleTime", "dodgeHelp", "shotWarnings", "aimAssist", "autoFire", "heroView", "closeDetail", "skywingOffer", "birds", "birdHint"])
    assert.equal(ui.split(`seg("${key}"`).length - 1, 1, `${key}: one row`);
});

// Dodge help changes the match, so the page sends it with the heroMode command (the command log and the state carry
// it); the reflex slow-down is page time only.
test("Hero section choices that change the match travel in the match", () => {
  const page = readFileSync(new URL("../src/hero-mode.js", import.meta.url), "utf8");
  assert.match(page, /enterCommands\(0, id, scale, S\.settings\.dodgeHelp === true, S\.settings\.autoFire !== false\)/);
  // Auto fire too: the heroMode command carries it, the tile and the sheet send heroAuto.
  assert.match(page, /type: "heroAuto", on: want/);
  assert.match(page, /AIM_ASSIST\[S\.settings\.aimAssist\]/);
  assert.match(page, /S\.settings\.shotWarnings === false/);
});
