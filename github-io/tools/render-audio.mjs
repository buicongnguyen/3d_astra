// Renders the score and the sound effects offline (OfflineAudioContext in headless Chrome) to
// WAV files and prints sanity statistics: peak, clipping, DC offset, loudness and dead air.
// Listening cannot be automated; this only catches silence, clipping and offsets.
//   node tools/render-audio.mjs [outDir]      (default test-results/audio)
// Exit code 1 if any check fails.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.resolve(process.argv[2] || path.join(root, "test-results", "audio"));
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined });
const page = await browser.newPage();
await page.route("http://audio.local/**", (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>render</title>" });
  const file = path.join(root, url.pathname);
  if (!file.startsWith(path.join(root, "src")) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
  return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(file) });
});
await page.goto("http://audio.local/");
const results = await page.evaluate(async () => {
  const [{ createAudioBus, Music }, { Sfx, SFX_NAMES }, logic, { defaults }] = await Promise.all([import("/src/music.js"), import("/src/sfx.js"), import("/src/audio-logic.js"), import("/src/settings.js")]);
  const SR = 44100;
  const levels = logic.busLevels(defaults());
  const toWav = (l, r) => {
    const n = l.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); v.setUint32(4, 36 + n * 4, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true); }
    let s = ""; const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s);
  };
  const stats = (l, r, trimTail) => {
    const n = l.length; let peak = 0, clip = 0, sum = 0, sq = 0;
    for (let i = 0; i < n; i++) for (const x of [l[i], r[i]]) { const a = Math.abs(x); if (a > peak) peak = a; if (a >= 0.999) clip++; sum += x; sq += x * x; }
    // Dead air: 100 ms windows below -66 dBFS inside the rendered span (the effect tail is excluded).
    const win = SR / 10, limit = n - (trimTail ? win * 3 : 0); let dead = 0, run = 0, longest = 0;
    for (let s = 0; s + win <= limit; s += win) { let e = 0; for (let i = s; i < s + win; i++) e += l[i] * l[i] + r[i] * r[i]; const db = 10 * Math.log10(e / (2 * win) + 1e-20); if (db < -66) { dead++; run++; longest = Math.max(longest, run); } else run = 0; }
    return { peak: +peak.toFixed(4), clipped: clip, dc: +(sum / (2 * n)).toFixed(5), rmsDb: +(10 * Math.log10(sq / (2 * n) + 1e-20)).toFixed(1), deadWindows: dead, longestDeadMs: longest * 100 };
  };
  const renderMusic = async (map, mood, faction, seconds, scale = levels.music) => {
    const ctx = new OfflineAudioContext(2, SR * seconds, SR), bus = createAudioBus(ctx);
    bus.master.gain.value = 1; bus.music.gain.value = scale;
    const m = new Music(ctx, bus.music);
    m.setMap(map, faction); m.setMood(mood); m.setActive(true); m.schedule(seconds); m.setActive(false);
    const buf = await ctx.startRendering();
    return { l: buf.getChannelData(0), r: buf.getChannelData(1), notes: m.scheduled };
  };
  const rows = [], files = {};
  for (const mood of ["calm", "tense", "battle", "victory", "defeat"]) {
    const { l, r, notes } = await renderMusic("classic", mood, mood === "battle" ? "ashfall" : null, 12);
    rows.push({ kind: "music", name: `classic-${mood}`, notes, ...stats(l, r, false) });
    files[`music-classic-${mood}.wav`] = toWav(l, r);
    const full = await renderMusic("classic", mood, null, 12, logic.MAKEUP.music);
    rows.push({ kind: "music-full-level", name: `classic-${mood}`, ...stats(full.l, full.r, false) });
  }
  for (const map of ["riverlands", "basin", "expanse", "dunes", "woodlands", "highlands"])
    for (const mood of ["calm", "battle"]) {
      const { l, r, notes } = await renderMusic(map, mood, null, 10);
      rows.push({ kind: "music", name: `${map}-${mood}`, notes, ...stats(l, r, false) });
      if (mood === "calm") files[`music-${map}-calm.wav`] = toWav(l, r);
    }
  const fx = [];
  for (const name of SFX_NAMES) {
    // Effects start 0.3 s in: a DynamicsCompressor starts fully closed and opens over its release
    // time, so a sound at t = 0 would be measured (and heard in the WAV) far too quiet.
    const ctx = new OfflineAudioContext(2, SR * 4.5, SR), bus = createAudioBus(ctx);
    bus.master.gain.value = 1; bus.sfx.gain.value = levels.sfx;
    const sfx = new Sfx(ctx, bus.sfx, { seed: 1 });
    sfx.play(name, { pan: 0.4, delay: 0.3 });
    const buf = await ctx.startRendering(), l = buf.getChannelData(0), r = buf.getChannelData(1), st = stats(l, r, false);
    let last = 0; for (let i = 0; i < l.length; i++) if (Math.abs(l[i]) > 0.001 || Math.abs(r[i]) > 0.001) last = i;
    fx.push({ kind: "sfx", name, lengthMs: Math.round((last / SR) * 1000) - 300, peak: st.peak, dc: st.dc, rmsDb: st.rmsDb, clipped: st.clipped });
    if (["shot:rifle", "shot:smg", "shot:rocket", "shot:tank", "shot:artillery", "hit:shell", "hit:artillery", "boom:heavy", "boom:building", "boom:core", "ability:shieldwall", "promote", "win"].includes(name)) files[`sfx-${name.replace(":", "-")}.wav`] = toWav(l, r);
  }
  return { rows, fx, files, levels };
});
for (const [name, b64] of Object.entries(results.files)) fs.writeFileSync(path.join(out, name), Buffer.from(b64, "base64"));
await browser.close();

const failures = [];
console.log(`bus levels at default settings: music ${results.levels.music.toFixed(2)}, effects ${results.levels.sfx.toFixed(2)}`);
console.log("kind              name                    notes  peak    clip  dc        rmsdB  deadMs(longest)");
for (const r of results.rows) {
  console.log(`${r.kind.padEnd(17)} ${r.name.padEnd(23)} ${String(r.notes ?? "").padStart(5)}  ${r.peak.toFixed(3)}  ${String(r.clipped).padStart(4)}  ${String(r.dc).padStart(8)}  ${String(r.rmsDb).padStart(6)}  ${r.longestDeadMs}`);
  const tag = `${r.kind} ${r.name}`;
  if (r.clipped > 0 || r.peak >= 0.999) failures.push(`${tag}: clipping (peak ${r.peak})`);
  if (Math.abs(r.dc) > 0.01) failures.push(`${tag}: DC offset ${r.dc}`);
  if (r.kind === "music" && r.rmsDb < -50) failures.push(`${tag}: too quiet (${r.rmsDb} dB)`);
  if (r.kind === "music" && r.longestDeadMs > 400) failures.push(`${tag}: dead air ${r.longestDeadMs} ms`);
}
console.log("\neffects (length = last sample above -60 dB):");
for (const r of results.fx) {
  console.log(`  ${r.name.padEnd(20)} ${String(r.lengthMs).padStart(5)} ms  peak ${r.peak.toFixed(3)}  rms ${String(r.rmsDb).padStart(6)} dB  dc ${r.dc}`);
  if (r.peak < 0.005) failures.push(`sfx ${r.name}: silent`);
  if (r.peak >= 0.999 || r.clipped > 0) failures.push(`sfx ${r.name}: clipping`);
  if (Math.abs(r.dc) > 0.01) failures.push(`sfx ${r.name}: DC offset`);
}
console.log(`\nwrote ${Object.keys(results.files).length} WAV files to ${out}`);
if (failures.length) { console.log("\nFAILED:\n" + failures.join("\n")); process.exit(1); }
console.log("all sanity checks passed");
