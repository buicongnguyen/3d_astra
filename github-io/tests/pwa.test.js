// Home-screen app (Platform reach, 2026-11-26; docs/PLATFORM.md): the manifest, icons, iOS head tags and
// launch screens are valid and present; the Install app tile's states (app/install.js); the service worker
// precaches the small icons but never the launch screens. Browser side: tests/pwa.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import config, { splashLinks } from "../vite.config.js";
import { installState, isIOS, isStandalone, createInstall } from "../src/app/install.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const png = (path) => { const b = read(path); assert.equal(b.toString("latin1", 1, 4), "PNG", path); return [b.readUInt32BE(16), b.readUInt32BE(20), b[25]]; };
function jpeg(path) {
  const b = read(path);
  assert.equal(b.readUInt16BE(0), 0xffd8, path);
  for (let i = 2; i < b.length;) {
    const marker = b.readUInt16BE(i), length = b.readUInt16BE(i + 2);
    if (marker >= 0xffc0 && marker <= 0xffc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + length;
  }
  throw new Error("no frame header in " + path);
}

test("the web manifest is a complete installable-app manifest", () => {
  const m = JSON.parse(read("public/manifest.webmanifest"));
  assert.equal(m.name, "Frontier Command");
  assert.ok(m.short_name && m.short_name.length <= 12, "short name fits under a home-screen icon");
  for (const key of ["id", "start_url", "scope"]) assert.equal(m[key], "./", `${key} is relative (works under /3d_astra/)`);
  assert.ok(["fullscreen", "standalone"].includes(m.display));
  assert.ok(Array.isArray(m.display_override) && m.display_override.includes("standalone"));
  assert.equal(m.orientation, "any");
  for (const key of ["theme_color", "background_color"]) assert.match(m[key], /^#[0-9a-f]{6}$/i);
  const sizes = (purpose) => m.icons.filter((i) => i.purpose === purpose && i.type === "image/png").map((i) => i.sizes);
  assert.ok(sizes("any").includes("192x192") && sizes("any").includes("512x512"));
  assert.deepEqual(sizes("maskable"), ["512x512"]);
  for (const icon of m.icons) {
    const file = "public/" + icon.src.replace(/^\.\//, "");
    assert.ok(existsSync(new URL(file, root)), file);
    if (icon.type === "image/png") {
      const [w, h, colour] = png(file);
      assert.equal(`${w}x${h}`, icon.sizes, file);
      assert.ok(colour === 2 || colour === 6, file + " is RGB(A)");
    }
  }
});

test("index.html carries the iOS home-screen tags and the build adds one launch screen per device and orientation", () => {
  const html = read("index.html").toString();
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.match(html, /rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png"/);
  assert.deepEqual(png("public/icons/apple-touch-icon.png").slice(0, 2), [180, 180]);
  const plugin = config.plugins.flat().find((p) => p?.name === "ios-launch-screens");
  const out = plugin.transformIndexHtml(html);
  const links = splashLinks();
  assert.equal((out.match(/rel="apple-touch-startup-image"/g) || []).length, links.length);
  assert.ok(links.length >= 30);
  for (const { href, media } of links) {
    const [w, h] = href.match(/(\d+)x(\d+)\.jpg$/).slice(1).map(Number);
    assert.deepEqual(jpeg("public/" + href.slice(2)), [w, h], href);
    // The media query names the same pixel size and orientation.
    const [, dw, dh, dpr, orientation] = media.match(/device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (\w+)/);
    const portrait = [dw * dpr, dh * dpr], expected = orientation === "portrait" ? portrait : portrait.reverse();
    assert.deepEqual([w, h], expected, media);
  }
});

test("install tile states", () => {
  assert.equal(installState({}), "none");
  assert.equal(installState({ ios: true }), "ios");
  assert.equal(installState({ prompt: true }), "prompt");
  assert.equal(installState({ prompt: true, ios: true }), "prompt");
  assert.equal(installState({ standalone: true, prompt: true, ios: true }), "installed");
  assert.equal(installState({ installed: true, ios: true }), "installed");
  assert.equal(isIOS({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" }), true);
  assert.equal(isIOS({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 }), true, "iPadOS asks for the desktop site");
  assert.equal(isIOS({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 0 }), false);
  assert.equal(isIOS({ userAgent: "Mozilla/5.0 (Linux; Android 14)" }), false);
  const media = (on) => ({ matchMedia: (q) => ({ matches: on.some((m) => q.includes(m)) }), navigator: {} });
  assert.equal(isStandalone(media(["standalone"])), true);
  assert.equal(isStandalone(media(["fullscreen"])), true, "Android runs the manifest's fullscreen display");
  assert.equal(isStandalone(media([])), false);
  assert.equal(isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } }), true);
});

test("the install controller: a browser prompt shows the tile, accepting it installs, appinstalled hides it", async () => {
  const handlers = {}, win = { addEventListener: (t, f) => { handlers[t] = f; }, matchMedia: () => ({ matches: false }), navigator: { userAgent: "Android" } };
  const install = createInstall(win);
  let changes = 0;
  install.onChange(() => changes++);
  assert.equal(install.state(), "none");
  assert.equal(await install.prompt(), "unavailable");
  let prevented = false, prompted = 0;
  handlers.beforeinstallprompt({ preventDefault: () => { prevented = true; }, prompt: async () => { prompted++; }, userChoice: Promise.resolve({ outcome: "dismissed" }) });
  assert.ok(prevented, "the browser's own mini-bar is held back");
  assert.equal(install.state(), "prompt");
  assert.equal(await install.prompt(), "dismissed");
  assert.equal(prompted, 1);
  assert.equal(install.state(), "none", "a used prompt cannot be shown again");
  handlers.beforeinstallprompt({ preventDefault() {}, prompt: async () => {}, userChoice: Promise.resolve({ outcome: "accepted" }) });
  assert.equal(await install.prompt(), "accepted");
  assert.equal(install.state(), "installed");
  const other = createInstall({ ...win, addEventListener: (t, f) => { handlers[t] = f; }, navigator: { userAgent: "iPhone" } });
  assert.equal(other.state(), "ios");
  handlers.appinstalled();
  assert.equal(other.state(), "installed");
  assert.ok(changes >= 3);
});

test("the service worker precaches the small icons and the manifest but never the launch screens", () => {
  const plugin = config.plugins.flat().find((p) => p?.name === "publish-service-worker");
  const emitted = [];
  plugin.generateBundle.call({ emitFile: (f) => emitted.push(f) }, {}, { "index.html": {}, "assets/app.js": {} });
  const source = emitted.find((f) => f.fileName === "sw.js").source;
  const precache = JSON.parse(source.match(/const PRECACHE = (\[.*?\]);/)[1]);
  for (const file of ["manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"]) assert.ok(precache.includes(file), file);
  assert.ok(!precache.some((f) => f.startsWith("icons/splash/") || /^icons\/.*512/.test(f)), "launch screens and big icons stay out of the precache");
  assert.doesNotThrow(() => new vm.Script(source.replace(/^const scope.*$/m, "")));
});
