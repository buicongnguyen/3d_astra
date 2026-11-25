// Home-screen icons and iOS launch screens (Platform reach, 2026-11-26).
//   node tools/app-icons.mjs
// Source art: tools/icons/app-icon-art.png, rendered in Blender from the game's own tank model and the gold
// emblem (blender --background --factory-startup --python tools/blender/render_ui_art.py -- icons).
// This tool puts it on the boot splash's night-blue background (index.html .boot-splash) with Chromium and
// writes public/icons/:
//   icon-192.png, icon-512.png   manifest "any" icons (art fills ~84 %)
//   maskable-512.png             manifest "maskable" icon (art inside the central 72 %, the 80 % safe circle)
//   apple-touch-icon.png         180 px, opaque (iOS rounds the corners itself)
//   splash/<w>x<h>.jpg           iOS launch screens for every device in tools/icons/ios-splash.json, portrait
//                                and landscape; they look like the boot splash so the hand-over is seamless
// Nothing here is precached by the service worker: iOS and Android fetch these only when installing.
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const out = new URL("public/icons/", root);
mkdirSync(new URL("splash/", out), { recursive: true });
const art = "data:image/png;base64," + readFileSync(new URL("tools/icons/app-icon-art.png", root)).toString("base64");
const { devices } = JSON.parse(readFileSync(new URL("tools/icons/ios-splash.json", root), "utf8"));

const BG = "radial-gradient(60% 55% at 50% 48%,#0a1d3f,#020713 80%)";
const GLOW = "radial-gradient(closest-side,rgba(127,232,255,.34),rgba(127,232,255,.08) 62%,transparent)";
const iconPage = (artScale) => `<!doctype html><html><body style="margin:0;width:100vw;height:100vh;overflow:hidden;background:${BG}">
<div style="position:absolute;inset:8%;background:${GLOW}"></div>
<img src="${art}" style="position:absolute;width:${artScale * 100}%;height:${artScale * 100}%;left:${(1 - artScale) * 50}%;top:${(1 - artScale) * 50 + 1}%">
</body></html>`;
const splashPage = `<!doctype html><html><body style="margin:0;width:100vw;height:100vh;overflow:hidden;background:${BG};display:grid;place-content:center;justify-items:center;gap:3vmin">
<div style="position:relative;width:34vmin;height:34vmin"><div style="position:absolute;inset:-12%;background:${GLOW}"></div><img src="${art}" style="position:absolute;inset:0;width:100%;height:100%"></div>
<div style="color:#ffc75e;font:800 max(20px,3.4vmin)/1.2 'Segoe UI',Arial,sans-serif;letter-spacing:.22em;text-align:center">FRONTIER COMMAND</div>
</body></html>`;

const chrome = process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined;
const browser = await chromium.launch({ headless: true, ...(chrome && existsSync(chrome) ? { executablePath: chrome } : {}) });
async function shoot(html, width, height, scale, file) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth));
  await page.screenshot({ path: file, ...(file.endsWith(".jpg") ? { type: "jpeg", quality: 80 } : {}) });
  await page.close();
}
const path = (name) => new URL(name, out).pathname.replace(/^\/([A-Z]:)/, "$1");
await shoot(iconPage(0.84), 512, 512, 1, path("icon-512.png"));
await shoot(iconPage(0.84), 192, 192, 1, path("icon-192.png"));
await shoot(iconPage(0.72), 512, 512, 1, path("maskable-512.png"));
await shoot(iconPage(0.8), 180, 180, 1, path("apple-touch-icon.png"));
for (const [, w, h, dpr] of devices) {
  await shoot(splashPage, w, h, dpr, path(`splash/${w * dpr}x${h * dpr}.jpg`));
  await shoot(splashPage, h, w, dpr, path(`splash/${h * dpr}x${w * dpr}.jpg`));
}
await browser.close();
console.log(`icons and ${devices.length * 2} launch screens written to public/icons/`);
