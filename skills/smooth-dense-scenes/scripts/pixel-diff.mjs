#!/usr/bin/env node
/**
 * Proves "visually unchanged" with numbers: compares two screenshots and reports how many
 * pixels differ, writing a diff image (changed pixels in magenta over a dimmed copy).
 *
 *   node pixel-diff.mjs before.png after.png [--threshold 24] [--out diff.png] [--json]
 *
 * --threshold is the largest per-channel difference (0–255) still counted as "same"; small
 * values catch dithering and antialiasing noise. First diff two captures of the SAME build
 * to show the harness is deterministic, then diff before vs after. Exit code 0 always;
 * read the numbers. Playwright comes from PLAYWRIGHT_MODULE, the current project, or global.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const files = args.filter((a, i) => !a.startsWith('--') && !['--threshold', '--out'].includes(args[i - 1]));
if (files.length !== 2) { console.error('Usage: node pixel-diff.mjs before.png after.png [--threshold 24] [--out diff.png] [--json]'); process.exit(2); }
async function loadPlaywright() {
  const given = process.env.PLAYWRIGHT_MODULE;
  if (given) return import(given.startsWith('file:') ? given : pathToFileURL(given).href);
  try { return await import(pathToFileURL(createRequire(path.join(process.cwd(), 'package.json')).resolve('playwright')).href); }
  catch { return import('playwright'); }
}
const playwright = await loadPlaywright(), chromium = playwright.chromium ?? playwright.default?.chromium;
const browser = await chromium.launch(), page = await browser.newPage();
const toUrl = f => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
const result = await page.evaluate(async ([a, b, threshold]) => {
  const load = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { error: `sizes differ: ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
  const w = ia.width, h = ia.height, canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(ia, 0, 0); const da = ctx.getImageData(0, 0, w, h).data;
  ctx.drawImage(ib, 0, 0); const db = ctx.getImageData(0, 0, w, h).data;
  const out = ctx.createImageData(w, h); let changed = 0, maxDelta = 0, minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
    maxDelta = Math.max(maxDelta, d);
    if (d > threshold) {
      changed++; out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 255; out.data[i + 3] = 255;
      const p = i / 4, x = p % w, y = (p - x) / w; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    } else { const g = (db[i] + db[i + 1] + db[i + 2]) / 3 * .35; out.data[i] = out.data[i + 1] = out.data[i + 2] = g; out.data[i + 3] = 255; }
  }
  ctx.putImageData(out, 0, 0);
  return { width: w, height: h, pixels: w * h, changed, percent: +(changed / (w * h) * 100).toFixed(3), maxDelta, box: changed ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null, png: canvas.toDataURL('image/png') };
}, [toUrl(files[0]), toUrl(files[1]), Number(option('threshold', '24'))]);
await browser.close();
if (result.error) { console.error(result.error); process.exit(1); }
const out = option('out', 'pixel-diff.png');
writeFileSync(out, Buffer.from(result.png.split(',')[1], 'base64'));
delete result.png;
if (args.includes('--json')) console.log(JSON.stringify({ ...result, diff: out }, null, 2));
else console.log(`${result.changed} of ${result.pixels} pixels differ (${result.percent}%), max channel delta ${result.maxDelta}${result.box ? `, within ${result.box.w}x${result.box.h} at ${result.box.x},${result.box.y}` : ''} → ${out}`);
