import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import STORY from '../src/voice-story.json' with { type: 'json' };

// Vietnamese voices (2026-11-27): with the game language vi, nothing voice-related is fetched on the title
// screen; after Start the player's faction pack comes from voices/vi/<faction>.mp3 (no English faction pack),
// and a unit reply plays from it. No story pack in a skirmish. Phase 2: a mission's Vietnamese story pack
// (voices/vi/story-<id>.mp3) that fails to load falls back to the English story pack, which then speaks the line.
const base = process.env.TEST_URL || 'http://127.0.0.1:4231/';
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('vi-voice-test')) { sessionStorage.setItem('vi-voice-test', '1'); localStorage.setItem('frontier-command.settings.v1', JSON.stringify({ version: 1, language: 'vi', playerFaction: 'ashfall' })); } } catch { /* storage optional */ } });
  const errors = [], voice = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (/\/voices\//.test(r.url()) || /voice-packs/.test(r.url())) voice.push(new URL(r.url()).pathname); });
  await page.goto(`${base}?test=1`);
  await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector('#start').disabled, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  assert.deepEqual(voice, [], 'nothing voice-related before Start');
  await page.click('#start');
  await page.waitForFunction(() => window.__frontier.audio?.voice?.ready('vi/ashfall'), null, { timeout: 30000 });
  assert.ok(voice.some((p) => p.endsWith('/voices/vi/ashfall.mp3')), `vi pack fetched (${voice})`);
  assert.ok(!voice.some((p) => /\/voices\/ashfall\.mp3$/.test(p)), 'no English faction pack');
  assert.equal(voice.filter((p) => p.endsWith('.mp3')).length, 1, `only the faction pack in a skirmish (${voice})`);
  const line = await page.evaluate(() => { const v = window.__frontier.audio.voice; v.ack('select'); return v.voice?.line.pack ?? v.scheduler.current?.pack; });
  assert.equal(line, 'vi/ashfall', 'a unit reply speaks Vietnamese');
  // Story fallback: the Vietnamese story pack of mission 1 answers 404; the English one is fetched and speaks.
  await page.route(/\/voices\/vi\/story-m01\.mp3/, (route) => route.fulfill({ status: 404, body: '' }));
  const storyLine = STORY.missions['m01-first-light'].packs[0].lines.find((l) => !l.scene);
  await page.evaluate(() => { const v = window.__frontier.audio.voice; v.prepare({ faction: v.faction, missionId: 'm01-first-light', lang: 'vi' }); });
  await page.waitForFunction(() => { const v = window.__frontier.audio.voice; return v.packs.get('vi/story-m01')?.failed && v.ready('story-m01'); }, null, { timeout: 30000 });
  assert.ok(voice.some((p) => p.endsWith('/voices/vi/story-m01.mp3')) && voice.some((p) => p.endsWith('/voices/story-m01.mp3')), `vi story tried, English fetched (${voice})`);
  const story = await page.evaluate((text) => { const v = window.__frontier.audio.voice; v.reset(); const s = v.story(text, { cut: true }); return { s, pack: v.voice?.line.pack ?? v.scheduler.current?.pack }; }, storyLine.text);
  assert.ok(story.s > 0 && story.pack === 'story-m01', `the line speaks from the English story pack (${JSON.stringify(story)})`);
  assert.deepEqual(errors, []);
  console.log('voices-vi: ok', voice);
} finally {
  await browser.close();
}
