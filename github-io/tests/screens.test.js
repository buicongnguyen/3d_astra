import test from "node:test";
import assert from "node:assert/strict";
import { LEGAL, SCREENS, Screens, createScreens, isLegal } from "../src/app/screens.js";

test("the machine starts on the menu, not paused", () => {
  const z = createScreens();
  assert.equal(z.screen, "menu");
  assert.deepEqual([z.started, z.paused, z.modalType], [false, false, null]);
});

test("a match begins, pauses, opens help over the pause menu and resumes", () => {
  const z = new Screens();
  z.begin();
  assert.equal(z.screen, "playing");
  z.open("pause");
  assert.equal(z.screen, "pause");
  assert.ok(z.paused);
  z.open("help");
  assert.equal(z.screen, "help");
  z.open("pause"); // help closes back to the pause menu
  z.close();
  assert.equal(z.screen, "playing");
  assert.equal(z.paused, false);
  assert.deepEqual(z.violations, []);
});

test("a finished match stays held when its dialog closes", () => {
  const z = new Screens();
  z.begin();
  z.open("result");
  assert.equal(z.screen, "result");
  z.close(true);
  assert.equal(z.screen, "held");
  assert.ok(z.paused);
  z.toMenu();
  assert.equal(z.screen, "menu");
  assert.ok(z.paused, "the menu keeps the pause flag, as it always did");
  assert.deepEqual(z.violations, []);
});

test("closing a dialog on the menu does not start a match", () => {
  const z = new Screens();
  z.open("fullscreen");
  assert.equal(z.screen, "fullscreen");
  z.close();
  assert.equal(z.screen, "menu");
  assert.equal(z.started, false);
});

test("the graphics notice only holds a match that is on", () => {
  const menu = new Screens();
  menu.open("graphics");
  assert.equal(menu.paused, false);
  const live = new Screens();
  live.begin();
  live.open("graphics");
  assert.ok(live.paused);
  live.dismiss();
  assert.equal(live.screen, "held");
  assert.deepEqual([menu.violations, live.violations], [[], []]);
});

test("settings open over any screen and return to it", () => {
  for (const setup of [(z) => z.begin(), (z) => { z.begin(); z.open("pause"); }, (z) => {}, (z) => { z.begin(); z.open("result"); }]) {
    const z = new Screens();
    setup(z);
    const before = z.screen;
    const snapshot = z.hold();
    assert.equal(z.screen, "settings");
    z.release(snapshot);
    assert.equal(z.screen, before);
    assert.deepEqual(z.violations, []);
  }
  const z = new Screens();
  z.begin();
  const snapshot = z.hold();
  z.release(snapshot, { held: true });
  assert.equal(z.screen, "held", "a finished match or a hidden page stays held");
  const idle = new Screens();
  idle.holdIfStarted();
  assert.equal(idle.paused, false, "nothing to hold on the menu");
});

test("the field guide puts the previous screen back", () => {
  const z = new Screens();
  z.begin();
  z.open("pause");
  const before = z.snapshot();
  z.open("guide");
  assert.equal(z.screen, "guide");
  z.restore(before);
  assert.equal(z.screen, "pause");
  assert.deepEqual(z.violations, []);
});

test("unknown screens are refused and moves the table does not allow are recorded", () => {
  const z = new Screens();
  assert.throws(() => z.open("lobby"), /Unknown screen/);
  z.begin();
  z.open("result");
  z.open("pause");
  assert.deepEqual(z.violations, ["result>pause"]);
});

test("the legal-move table covers every screen and only names real ones", () => {
  assert.deepEqual(Object.keys(LEGAL).sort(), [...SCREENS].sort());
  for (const [from, targets] of Object.entries(LEGAL)) {
    assert.ok(isLegal(from, from) || from === "settings", `${from} may stay`);
    for (const to of targets) assert.ok(SCREENS.includes(to), `${from} -> ${to}`);
  }
  assert.ok(isLegal("menu", "playing"));
  assert.ok(!isLegal("menu", "pause"), "there is no pause menu without a match");
  assert.ok(!isLegal("result", "help"));
});
