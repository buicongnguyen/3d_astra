// The Iron Sovereign in the browser (W1-E): on a Frontier Defence road at 390x844 it is drawn, its boss
// bar shows (text 11 px or more), and the bar stacks above the Defence bar's reserved height
// (--defence-bar-h). Run against a build: TEST_URL=http://127.0.0.1:<port>/ npm run test:sovereign
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
await suite("sovereign: the Iron Sovereign on a Defence road, phone", async () => {
  const { page, goto, ready, tap, errors } = await openPage(browser, "portrait");
  await goto();
  await ready();
  await tap('[data-mode="defence"]');
  await tap('[data-level-id="d-gorge"]');
  await page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
  await tap("#start");
  await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.defence && document.querySelector("#defence-bar"), null, { timeout: TIMEOUT.step });
  await page.evaluate(() => window.__frontier.view.preloadModels(["ironsovereign"]));
  await page.waitForFunction(() => window.__frontier.view.models.has("ironsovereign"), null, { timeout: TIMEOUT.models });
  const id = await page.evaluate(() => {
    const f = window.__frontier, s = f.sim, def = s.missionDef.defence, [route] = Object.keys(def.routes), p = def.routes[route][1];
    s.visible[0].fill(1); s.explored[0].fill(1);
    const b = s.spawn("ironsovereign", 1, p.x, p.z, true, true);
    b.orders = [{ type: "route", route, leg: 2 }];
    f.hold = true; f.view.focusOn(p.x, p.z);
    for (let i = 0; i < 10; i++) f.step(0.05);
    return b.id;
  });
  await page.waitForFunction((id) => !!window.__frontier.view.objects.get(id), id, { timeout: TIMEOUT.step });
  await page.locator("#boss-bar").waitFor({ state: "visible", timeout: TIMEOUT.step });
  const measure = () => page.evaluate(() => {
    const bar = document.querySelector("#boss-bar"), r = bar.getBoundingClientRect();
    const small = [...bar.querySelectorAll("*")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((s) => s < 11);
    return { bottom: r.bottom, text: bar.textContent, small, inside: r.left >= 0 && r.right <= innerWidth, sideways: document.documentElement.scrollWidth > innerWidth };
  });
  const before = await measure();
  assert.match(before.text, /Iron Sovereign/);
  assert.deepEqual(before.small, [], "bar text 11 px or more");
  assert.ok(before.inside && !before.sideways);
  await page.evaluate(() => document.documentElement.style.setProperty("--defence-bar-h", "64px"));
  const after = await measure();
  assert.ok(before.bottom - after.bottom >= 63, `the bar rises above the Defence bar (${before.bottom} -> ${after.bottom})`);
  assert.deepEqual(errors, []);
}, { browser });
