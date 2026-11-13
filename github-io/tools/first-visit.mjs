// First-visit download: everything fetched from a cold cache until the start screen is usable
// (every boot model parsed, Start enabled). Prints raw bytes and the gzip size GitHub Pages would
// send, by kind. Usage: node tools/first-visit.mjs http://127.0.0.1:4231/ [more urls to compare]
import { gzipSync } from "node:zlib";
import { launchBrowser } from "../tests/lib/harness.mjs";

// "music" (recorded tracks, public/music/) must stay absent: they load after the first tap, never on a first visit.
const kindOf = (url) => (/\.glb(\?|$)/.test(url) ? "models" : /\/music\/|\.(m4a|mp3|ogg|opus|wav|aac|flac)(\?|$)/.test(url) ? "music" : /\.(js|mjs)(\?|$)/.test(url) ? "script" : /\.css(\?|$)/.test(url) ? "style" : /\.(webp|png|jpg|svg|ico)(\?|$)/.test(url) ? "images" : /\.(woff2?|ttf)(\?|$)/.test(url) ? "fonts" : "other");
const browser = await launchBrowser();
try {
  for (const url of process.argv.slice(2)) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const page = await context.newPage(), pending = [], sizes = {};
    page.on("response", (response) => pending.push((async () => {
      try {
        const body = await response.body(), kind = kindOf(response.url());
        // Models and images are already compressed formats or binary: Pages still gzips .glb, so count it.
        const sent = /\.(webp|png|jpg|woff2)(\?|$)/.test(response.url()) ? body.length : gzipSync(body).length;
        (sizes[kind] ||= { files: 0, raw: 0, gzip: 0 });
        sizes[kind].files++; sizes[kind].raw += body.length; sizes[kind].gzip += sent;
      } catch { /* redirects and aborted requests have no body */ }
    })()));
    const started = Date.now();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => { const b = document.querySelector("#start"); return b && !b.disabled; }, null, { timeout: 120000 });
    const seconds = (Date.now() - started) / 1000;
    await Promise.all(pending);
    const total = Object.values(sizes).reduce((t, s) => ({ files: t.files + s.files, raw: t.raw + s.raw, gzip: t.gzip + s.gzip }), { files: 0, raw: 0, gzip: 0 });
    sizes.music ||= { files: 0, raw: 0, gzip: 0 };
    console.log(JSON.stringify({ url, seconds: +seconds.toFixed(1), total, ...sizes }));
    await context.close();
  }
} finally {
  await browser.close();
}
