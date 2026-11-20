// Client wiring checked in the real page (K11): what used to be regexes on src/app/*.js text in
// client-start-and-preview-hover, client-minimap-and-stale-hover and client-modal-focus-and-minimap (were review-2026-10b-00, -10b-01, -10d-02). Each check names the behaviour.
// Run by tests/hotkeys.mjs (already in the CI matrix) on a fresh page load.
import assert from "node:assert/strict";
import { testUrl, TIMEOUT } from "./harness.mjs";

export async function checkClientWiring(page, errors) {
  const press = async (key) => { await page.keyboard.press(key); await page.waitForTimeout(90); };
  const selected = () => page.evaluate(() => [...window.__frontier.selected]);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(testUrl());
  await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });

  // Space on a focused button inside the modal presses it (the global Space shortcut leaves modal buttons alone).
  await page.locator("#briefing-settings").click();
  assert.ok(await page.locator(".settings-backdrop").isVisible(), "settings opened");
  await page.getByRole("button", { name: "Close settings", exact: true }).focus();
  await press("Space");
  assert.ok(!(await page.locator(".settings-backdrop").isVisible()), "Space on the Close button closes the sheet");

  // Start recentres the camera on the player's HQ.
  await page.evaluate(() => window.__frontier.view.focusOn(60, 60));
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__frontier.started);
  const away = await page.evaluate(() => { const f = window.__frontier, hq = f.sim.own(0).find((e) => e.type === "hq"); return Math.hypot(f.view.focus.x - hq.x, f.view.focus.z - hq.z); });
  assert.ok(away < 15, `Start puts the camera on the HQ (${away.toFixed(1)} away)`);

  // Recalling a control group nobody holds keeps the current selection.
  const army = await page.evaluate(() => { const f = window.__frontier, ids = f.sim.own(0).filter((e) => e.kind === "unit").slice(0, 3).map((e) => e.id); f.select(ids); return ids; });
  await press("Digit7");
  assert.deepEqual(await selected(), army, "an empty group does not clear the selection");

  // The selection panel is only rewritten when its HTML changes: an idle second causes no DOM writes.
  await page.evaluate(() => { const f = window.__frontier; f.select(f.sim.own(0).filter((e) => e.kind === "unit").slice(0, 1).map((e) => e.id)); f.step(0); window.__infoWrites = 0; new MutationObserver((m) => { window.__infoWrites += m.length; }).observe(document.getElementById("selection-info"), { childList: true, subtree: true, characterData: true, attributes: true }); });
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.__infoWrites), 0, "no rewrite while nothing about the selection changes");

  // Restart (New game) builds a fresh simulation from tick 0.
  const before = await page.evaluate(() => { const f = window.__frontier; f.step(1); return { ticks: f.sim.ticks, sim: (window.__old = f.sim) && 1 }; });
  assert.ok(before.ticks > 0);
  await page.evaluate(() => window.__frontier.restart());
  const after = await page.evaluate(() => ({ same: window.__frontier.sim === window.__old, ticks: window.__frontier.sim.ticks }));
  assert.equal(after.same, false, "a new Simulation object");
  assert.ok(after.ticks < before.ticks, "starting over from the beginning");

  assert.deepEqual(errors, [], "no page errors");
}
