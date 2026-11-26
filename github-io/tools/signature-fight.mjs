// A real fight per faction for the signature shots (V4, 2026-11-26): two armies of one faction's roster face each other on
// open ground, the frame loop is held and the fight is stepped by hand in fixed 0.05 s ticks (the same rules every run), every
// event goes to the view as the game sends it, and the frames are saved: one full screenshot and a strip of crops while the
// shots fly. Team 0 wears the player's colour (mint) and team 1 the rival's: the shots must follow the faction, not the paint.
// Usage: TEST_URL=http://127.0.0.1:4614/ node tools/signature-fight.mjs <out dir> <label> [desktop|portrait|landscape] [factions,comma|all]
//   [quality=high|eco] [sprites=1|0]
// Writes <out>/<label>/<viewport>/<faction>.png (full frame) and <faction>-strip.png (8 crops, 0.05 s apart).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [out = ".tmp/visual-round/fight", label = "after", shape = "desktop", only = "all", quality = "high", sprites = "1"] = process.argv.slice(2);
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const viewport = VIEWPORTS[shape];
if (!viewport) throw new Error(`viewport ${shape}?`);
const mobile = shape !== "desktop";
// Each faction's fighting roster (exact types: no slot swap), ground then air. Shared slots fire the faction's look too.
const ROSTERS = {
  meridian: ["vanguard", "ranger", "tank", "breaker", "antitank", "gunner", "ranger", "vanguard"],
  ashfall: ["scrapper", "ranger", "tank", "scorcher", "antitank", "rampart", "ranger", "scrapper"],
  sunward: ["vanguard", "rider", "tank", "breaker", "antitank", "lancer", "rider", "vanguard"],
  wardens: ["vanguard", "drone", "walker", "breaker", "antitank", "bulwark", "drone", "vanguard"],
  veil: ["shade", "ranger", "tank", "breaker", "watcher", "stalker", "ranger", "shade"],
};
const AIR = { meridian: "hawk", ashfall: "balloon", sunward: "glider", wardens: "halo", veil: "moth" };
const factions = only === "all" ? Object.keys(ROSTERS) : only.split(",");
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
  args: process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu"] : ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${process.env.TEST_URL || "http://127.0.0.1:4614/"}?test=1${sprites === "0" ? "&sprites=0" : ""}`, { timeout: 120000 });
  await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled, null, { timeout: 120000 });
  await page.locator('[data-mode="skirmish"]').click().catch(() => {});
  await page.selectOption("#scenario", "riverlands").catch(() => {});
  await page.locator("#start").click();
  await page.waitForFunction(() => window.__frontier.started && window.__frontier.modelsReady, null, { timeout: 120000 });
  const types = [...new Set([...Object.values(ROSTERS).flat(), ...Object.values(AIR)])];
  await page.evaluate(async ({ types, quality }) => {
    const f = window.__frontier, v = f.view;
    f.hold = true;
    v.applySettings({ ...v.settings, quality });
    await v.preloadModels(types);
    await v.fx.sprites.whenReady?.();
  }, { types, quality });
  // The HUD stays: these are in-game screenshots.
  const dir = path.join(out, label, shape);
  fs.mkdirSync(dir, { recursive: true });
  for (const faction of factions) {
    const box = await page.evaluate(({ faction, roster, air, mobile }) => {
      const f = window.__frontier, s = f.sim, v = f.view;
      s.aiEnabled = false;
      v.fx.clear();
      let seed = 1482; v.fx.rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      s.entities = s.entities.filter((e) => e.kind === "building" && Math.hypot(e.x, e.z) > 30);
      s.factions[0] = faction; s.factions[1] = faction;
      // Two ranks a side, 10 m between the front ranks, on open ground north of the river (riverlands).
      const n = roster.length, cx = -2, cz = 18;
      for (let rank = 0; rank < 2; rank++)
        for (let k = 0; k < n; k++)
          for (let team = 0; team < 2; team++) {
            const type = roster[(k + rank * 3) % n], x = cx - 11 + k * 3.1 + rank * 1.5, z = cz + (team ? -1 : 1) * (5 + rank * 2.2);
            s.spawn(type, team, x, z, true, true);
          }
      s.spawn(air, 0, cx - 3, cz + 9, true, true); s.spawn(air, 1, cx + 4, cz - 9, true, true);
      s.nav.rebuild(s.entities);
      s.visible[0].fill(1); s.explored[0].fill(1);
      f.select([]);
      v.focusOn(cx, cz); v.zoom = v.defaultZoom; v.updateCamera();
      // Two seconds of fighting, then the strip (the first volleys are in flight).
      for (let i = 0; i < 40; i++) {
        s.tick(0.05);
        for (const ev of s.events.splice(0)) v.event(ev, s);
        v.update(s, 0.05, f.selected, null);
      }
      const r = v.renderer.domElement.getBoundingClientRect();
      const vec = new v.camera.position.constructor(-2, 1, 18).project(v.camera);
      return { x: (vec.x * 0.5 + 0.5) * r.width + r.left, y: (-vec.y * 0.5 + 0.5) * r.height + r.top, w: r.width, h: r.height };
    }, { faction, roster: ROSTERS[faction], air: AIR[faction], mobile });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(dir, `${faction}.png`) });
    const cw = Math.min(box.w, mobile ? 360 : 640), ch = Math.min(box.h, mobile ? 300 : 400);
    const clip = { x: Math.max(0, Math.round(box.x - cw / 2)), y: Math.max(0, Math.round(box.y - ch / 2)), width: Math.round(cw), height: Math.round(ch) };
    const frames = [];
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => {
        const f = window.__frontier, s = f.sim, v = f.view;
        s.tick(0.05);
        for (const ev of s.events.splice(0)) v.event(ev, s);
        v.update(s, 0.05, f.selected, null);
      });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
      const file = path.join(dir, `${faction}-f${i}.png`);
      await page.screenshot({ path: file, clip });
      frames.push(file);
    }
    console.log(faction, shape, "ok", JSON.stringify(clip));
  }
  if (errors.length) console.log("page errors:", errors.slice(0, 5));
} finally { await browser.close(); }
