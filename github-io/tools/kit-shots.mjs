// UI-kit pass (round 3): screenshots of every screen family at the four standard sizes, for before/after review.
// Usage (a server must be running, e.g. vite preview on 4232):
//   TEST_URL=http://127.0.0.1:4232/ node tools/kit-shots.mjs --out docs/aaa/results/round3/kit/after [--only desktop] [--flows title,battle] [--lang vi]
// Writes <out>/<viewport>-<screen>.jpg. Flows: title (cover, mode cards, Quick battle, skirmish setup, campaign, Defence
// menu, Settings), battle (HUD, mixed group, building command card, tooltip, toast, pause, help, field guide, results),
// mission (briefing dialogue, objectives, radio line) and decision (the commander's choice card).
import { mkdirSync } from "node:fs";
import { launchBrowser, openPage, TIMEOUT } from "../tests/lib/harness.mjs";

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = arg("--out", ".tmp/kit-shots");
const ONLY = arg("--only", "");
const FLOWS = arg("--flows", "title,battle,mission,decision,defence").split(",");
const LANG = arg("--lang", "");
const SIZES = {
  desktop: { width: 1440, height: 900 },
  portrait: { width: 390, height: 844, mobile: true },
  landscape: { width: 844, height: 390, mobile: true },
  small: { width: 320, height: 568, mobile: true },
};
const KEY = "frontier-campaign-v2", SETTINGS = "frontier-command.settings.v1";
mkdirSync(OUT, { recursive: true });

const settle = (page, ms = 500) => page.waitForTimeout(ms);
async function snap(page, vp, name) {
  await page.screenshot({ path: `${OUT}/${vp}-${name}.jpg`, quality: 80, type: "jpeg" });
  console.log(`  ${vp}-${name}`);
}
async function open(browser, vp, { progress = null } = {}) {
  const t = await openPage(browser, SIZES[vp], { timeout: TIMEOUT.models });
  await t.goto();
  await t.page.evaluate(([k, v, s, lang]) => {
    localStorage.clear();
    if (v) localStorage.setItem(k, JSON.stringify(v));
    if (lang) localStorage.setItem(s, JSON.stringify({ language: lang }));
  }, [KEY, progress, SETTINGS, LANG]);
  await t.page.reload({ timeout: TIMEOUT.models });
  await t.ready();
  await t.page.waitForFunction(() => !document.querySelector(".cover-loading")?.classList.contains("on"), null, { timeout: TIMEOUT.step }).catch(() => {});
  await settle(t.page, 900);
  return t;
}
const tapIf = async (t, sel) => { if (await t.page.locator(sel).first().isVisible().catch(() => false)) { await t.tap(sel); return true; } return false; };
async function startSkirmish(t) {
  await t.tap('[data-mode="skirmish"]');
  await t.tap("#start");
  await t.page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
  await t.page.evaluate(() => { window.__frontier.hold = true; });
  await settle(t.page, 1200);
}
const closeModal = (t) => t.page.evaluate(() => document.querySelector("#modal [data-resume]")?.click());

const FLOW = {
  async title(browser, vp) {
    const t = await open(browser, vp), { page } = t;
    await snap(page, vp, "title");
    await t.tap("#briefing-settings");
    await page.locator(".settings-panel").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await settle(page);
    await snap(page, vp, "settings");
    await page.evaluate(() => document.querySelector('.settings-panel [data-do="cancel"]').click());
    await settle(page);
    await t.tap('[data-mode="campaign"]');
    await page.locator("#campaign-map .cmap").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await settle(page, 800);
    await snap(page, vp, "campaign");
    await t.tap('[data-mode="defence"]');
    await settle(page, 900);
    await snap(page, vp, "defence-menu");
    await page.close();
  },
  async battle(browser, vp) {
    const t = await open(browser, vp), { page } = t;
    await startSkirmish(t);
    await snap(page, vp, "hud");
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.select(s.own(0).filter((e) => e.kind === "unit").map((e) => e.id)); });
    await settle(page);
    await snap(page, vp, "group");
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.select([s.own(0).find((e) => e.type === "hq").id]); });
    await settle(page);
    await snap(page, vp, "building");
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.select([s.own(0).find((e) => e.type === "worker").id]); });
    await settle(page);
    await snap(page, vp, "worker");
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.select([s.own(0).find((e) => e.kind === "unit" && e.type !== "worker").id]); });
    await settle(page);
    await snap(page, vp, "unit");
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.select([s.own(0).find((e) => e.type === "hq").id]); });
    await settle(page);
    if (!t.mobile) {
      const tile = page.locator("#commands button").first();
      if (await tile.isVisible().catch(() => false)) { await tile.hover(); await settle(page, 700); await snap(page, vp, "tooltip"); }
      await page.mouse.move(5, 450);
    }
    await page.evaluate(() => { const n = document.querySelector("#notice"); n.textContent = "Enemy forces sighted near the east ford."; n.classList.add("show", "warning"); });
    await settle(page, 300);
    await snap(page, vp, "toast");
    await page.evaluate(() => document.querySelector("#notice").classList.remove("show", "warning"));
    await t.tap("#pause");
    await page.locator("#modal").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await settle(page);
    await snap(page, vp, "pause");
    await closeModal(t);
    await settle(page);
    await t.tap("#help");
    await settle(page);
    await snap(page, vp, "help");
    await closeModal(t);
    await settle(page);
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.select([s.own(0).find((e) => e.kind === "unit" && e.type !== "worker").id]); });
    await settle(page);
    await page.evaluate(() => document.querySelector("#field-guide, #touch-guide")?.click());
    await settle(page, 800);
    await snap(page, vp, "field-guide");
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.querySelector(".field-guide [data-close], .guide-close, #modal [data-resume]")?.click());
    await settle(page);
    // Results: every enemy core falls inside the next tick.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, unit = s.own(0).find((e) => e.kind === "unit");
      const cores = s.entities.filter((e) => e.team !== 0 && e.type === "hq");
      const proto = Object.getPrototypeOf(s).tick;
      s.tick = (dt) => { delete s.tick; proto.call(s, dt); for (const c of cores) s.applyDamage(c, 1e7, 0, unit.id); };
      f.hold = false;
    });
    await page.locator(".result-card").waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    await settle(page, 2500);
    await snap(page, vp, "results");
    await page.close();
  },
  async mission(browser, vp) {
    const t = await open(browser, vp), { page } = t;
    await t.tap('[data-mode="campaign"]');
    await page.locator("#campaign-map .cmap").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await t.tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible", timeout: TIMEOUT.models });
    await settle(page, 1200);
    await snap(page, vp, "briefing");
    await tapIf(t, "#mb-skip"); await settle(page, 300); await tapIf(t, "#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    await settle(page, 2500);
    await snap(page, vp, "mission");
    if (t.mobile) { await tapIf(t, "#mission-toggle"); await settle(page); await snap(page, vp, "objectives"); }
    await page.close();
  },
  async decision(browser, vp) {
    const { MISSIONS } = await import("../src/story/missions.js");
    const ids = MISSIONS.map((m) => m.id), ASHEN = ids.indexOf("m03-the-ashen-line");
    const progress = { cleared: Object.fromEntries(ids.slice(0, ASHEN).map((id, i) => [id, { time: 300 + i * 30, medal: "gold", difficulty: "standard" }])) };
    const t = await open(browser, vp, { progress }), { page } = t;
    await t.tap('[data-mode="campaign"]');
    await page.locator("#campaign-map .cmap").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await t.tap(`[data-stage="${ASHEN}"]`);
    await t.tap("#start");
    await page.locator("#mission-briefing").waitFor({ state: "visible", timeout: TIMEOUT.models });
    await tapIf(t, "#mb-skip"); await settle(page, 300); await tapIf(t, "#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    await page.evaluate(() => { const s = window.__frontier.sim, u = s.own(0).find((e) => e.kind === "unit" && e.type !== "worker"); u.x = 5; u.z = -43; });
    await page.locator("#modal .decision-card").waitFor({ state: "visible", timeout: TIMEOUT.step });
    await settle(page, 900);
    await snap(page, vp, "decision");
    await page.close();
  },
  async defence(browser, vp) {
    const t = await open(browser, vp), { page } = t;
    await t.tap('[data-mode="defence"]');
    await settle(page, 600);
    await t.tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
    await settle(page, 2500);
    await page.evaluate(() => { window.__frontier.hold = true; });
    await snap(page, vp, "defence-hud");
    await page.close();
  },
};

const browser = await launchBrowser();
for (const vp of Object.keys(SIZES)) {
  if (ONLY && !ONLY.split(",").includes(vp)) continue;
  for (const flow of FLOWS) {
    console.log(`${vp} ${flow}`);
    try { await FLOW[flow](browser, vp); } catch (error) { console.log(`  ! ${vp} ${flow}: ${error.message.split("\n")[0]}`); }
  }
}
await browser.close();
