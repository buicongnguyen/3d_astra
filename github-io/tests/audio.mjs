import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Music and sound in the browser: the audio context starts only after a first gesture, the score
// adapts to the match and to mission cues, fogged enemy actions stay silent, mute / pause / a
// hidden tab stop all scheduling, and the Music and Effects sliders persist. An AudioContext spy
// (addInitScript) counts the oscillators the page creates. Listening is not tested here; see
// tools/render-audio.mjs for the offline render checks.
const base = process.env.TEST_URL || 'http://127.0.0.1:4231/';
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'] });
const spy = () => {
  const Original = window.AudioContext;
  window.__ac = { contexts: [], oscillators: 0, suspends: 0, resumes: 0 };
  window.AudioContext = class extends Original {
    constructor(...args) {
      super(...args);
      window.__ac.contexts.push(this);
      const create = this.createOscillator.bind(this), suspend = this.suspend.bind(this), resume = this.resume.bind(this);
      this.createOscillator = () => { window.__ac.oscillators++; return create(); };
      this.suspend = () => { window.__ac.suspends++; return suspend(); };
      this.resume = () => { window.__ac.resumes++; return resume(); };
    }
  };
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(spy);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(`${base}?test=1`);
  await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector('#start').disabled, null, { timeout: 120000 });

  // Nothing sounds before a gesture.
  assert.equal(await page.evaluate(() => window.__ac.contexts.length), 0, 'no AudioContext before the first gesture');
  assert.equal(await page.evaluate(() => !!window.__frontier.audio), false, 'no audio engine before the first gesture');

  await page.click('#start');
  await page.waitForFunction(() => window.__frontier.audio?.music.active && window.__frontier.audio.music.scheduled > 0, null, { timeout: 15000 });
  const ac = () => page.evaluate(() => ({ contexts: window.__ac.contexts.length, state: window.__ac.contexts[0]?.state, osc: window.__ac.oscillators, scheduled: window.__frontier.audio.music.scheduled, active: window.__frontier.audio.music.active, mood: window.__frontier.audio.music.mood, played: window.__frontier.audio.sfx.played }));
  let s = await ac();
  assert.equal(s.contexts, 1, 'one shared AudioContext');
  assert.equal(s.state, 'running', 'the context runs after the gesture');
  assert.equal(s.mood, 'calm', 'an idle match starts calm');
  assert.ok(s.osc > 0, 'the score created oscillators');

  // The mood follows the fight: a shot sets battle, then (combat long ago) a mission cue sets tense.
  await page.evaluate(() => { const f = window.__frontier, hq = f.sim.own(0).find(e => e.type === 'hq'); f.sim.events.push({ type: 'shot', weapon: 'tank', source: hq.id, x: hq.x, z: hq.z, tx: hq.x + 3, tz: hq.z, team: 0 }); });
  await page.waitForFunction(() => window.__frontier.audio.music.mood === 'battle', null, { timeout: 5000 });
  await page.evaluate(() => { const f = window.__frontier; f.audio.lastCombatAt = -Infinity; f.sim.events.push({ type: 'music', mood: 'tense' }); });
  await page.waitForFunction(() => window.__frontier.audio.music.mood === 'tense', null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__frontier.musicMood), 'tense');
  await page.evaluate(() => { window.__frontier.sim.events.push({ type: 'music', mood: 'calm' }); });
  await page.waitForFunction(() => window.__frontier.audio.music.mood === 'calm', null, { timeout: 5000 });

  // Fog rule: an enemy shot in unexplored ground is silent; one by our core is heard; ours always is.
  const fog = await page.evaluate(() => {
    const f = window.__frontier, a = f.audio, sim = f.sim, hq = sim.own(0).find(e => e.type === 'hq');
    const far = { x: -sim.terrain.half + 3, z: -sim.terrain.half + 3 };
    const at = (p, team) => { a.sfx.budget.voices.length = 0; a.sfx.budget.lastPlayed.clear(); a.sfx.budget.recent.clear(); const before = a.sfx.played; a.event({ type: 'shot', weapon: 'tank', source: 0, x: p.x, z: p.z, tx: p.x + 2, tz: p.z, team }, sim); return a.sfx.played - before; };
    return { fogVisible: sim.isVisible(far, 0), fogged: at(far, 1), near: at({ x: hq.x, z: hq.z }, 1), own: at(far, 0) };
  });
  assert.equal(fog.fogVisible, false, 'the corner is fogged');
  assert.equal(fog.fogged, 0, 'a fogged enemy shot (and its landing) makes no sound');
  assert.equal(fog.near, 2, 'a visible enemy tank shot is heard, and the shell landing');
  assert.ok(fog.own >= 1, 'our own shot is heard');

  // Voice budget: a burst of explosions never exceeds the explosion group's cap or the total.
  const burst = await page.evaluate(() => { const a = window.__frontier.audio; for (let i = 0; i < 60; i++) a.sfx.play('boom:heavy', { priority: 5 + (i % 3), gap: 0 }); return { all: a.sfx.budget.active, explosions: a.sfx.budget.count('explosion') }; });
  assert.ok(burst.all <= 24 && burst.explosions <= 8, `voice cap holds (${JSON.stringify(burst)})`);

  // A staged big fight by the camera: every weapon class, impacts, vehicle losses and a Barrage for
  // 2.5 s. Voices stay under the cap, loud blasts duck the music and the combat layer comes in.
  const fightScript = async (steps) => {
    const f = window.__frontier, a = f.audio, sim = f.sim, c = f.view.focus;
    const weapons = ['ranger', 'tank', 'breaker', 'antitank', 'vanguard', 'tower', 'scorcher', 'scrapper', 'shade', 'medic'];
    const out = { maxVoices: 0, maxWeapon: 0, maxExplosion: 0, minDuck: 0, played: a.sfx.played, dropped: a.sfx.dropped };
    for (let step = 0; step < steps; step++) {
      for (let i = 0; i < 8; i++) {
        const x = c.x + (i % 4) * 2 - 3, z = c.z + Math.floor(i / 4) * 2 - 1;
        a.event({ type: 'shot', weapon: weapons[(i + step) % weapons.length], x, z, tx: x + 4, tz: z + 1, team: 0 }, sim);
        a.event({ type: 'impact', x: x + 4, z: z + 1, team: 1 }, sim);
      }
      if (step % 4 === 0) a.event({ type: 'death', heavy: true, x: c.x + 2, z: c.z, team: 0 }, sim);
      if (step === 10) a.event({ type: 'strike', x: c.x, z: c.z, radius: 4, team: 0 }, sim);
      await new Promise(r => setTimeout(r, 50));
      const b = a.sfx.budget, now = a.context.currentTime;
      b.voices = b.voices.filter(v => v.end > now);
      out.maxVoices = Math.max(out.maxVoices, b.active); out.maxWeapon = Math.max(out.maxWeapon, b.count('weapon')); out.maxExplosion = Math.max(out.maxExplosion, b.count('explosion'));
      out.minDuck = Math.min(out.minDuck, a.duckDb);
    }
    out.played = a.sfx.played - out.played; out.dropped = a.sfx.dropped - out.dropped;
    out.combat = a.music.combatLevel; out.mood = a.music.mood; out.battleLayer = a.music.layers.battle.target;
    return out;
  };
  const combatNotes = await page.evaluate(() => window.__frontier.audio.music.combatNotes);
  const fight = await page.evaluate(fightScript, 50);
  console.log('staged fight:', JSON.stringify(fight));
  assert.ok(fight.played > 40, `the fight is heard (${fight.played} effects)`);
  assert.ok(fight.dropped > 0, 'the voice caps had to drop some effects');
  assert.ok(fight.maxVoices <= 24 && fight.maxWeapon <= 12 && fight.maxExplosion <= 8, `voices under the caps (${fight.maxVoices}/${fight.maxWeapon}/${fight.maxExplosion})`);
  assert.ok(fight.minDuck < -2, `loud blasts duck the music (${fight.minDuck} dB)`);
  assert.equal(fight.mood, 'battle');
  assert.ok(fight.combat > 0.9 && fight.battleLayer > 0.5, `the music switches to the combat layer (${fight.combat})`);
  await page.waitForFunction(n => window.__frontier.audio.music.combatNotes > n, combatNotes, { timeout: 8000 });

  // Radio replies: a burst of orders gets one reply; the gate then holds the next ones back.
  const radio = await page.evaluate(() => {
    const a = window.__frontier.audio, sim = window.__frontier.sim;
    a.radioGate.last = -Infinity; a.radioGate.byKind.clear();
    const before = a.radios, results = [];
    for (let i = 0; i < 6; i++) results.push(a.order(i % 2 ? 'move' : 'attack', sim));
    return { added: a.radios - before, results, rendered: a.sfx.buffers.has(`radio:${sim.factions?.[0] || 'meridian'}:attack#0`) };
  });
  assert.equal(radio.added, 1, `one radio reply for a burst of orders (${radio.results})`);
  assert.equal(radio.rendered, true, 'the reply was rendered in the player faction voice');

  // Mute stops scheduling and effects; unmuting restarts it.
  await page.click('#audio');
  await page.waitForFunction(() => window.__frontier.audio.music.active === false && window.__frontier.audio.sfx.enabled === false, null, { timeout: 5000 });
  s = await ac();
  await page.waitForTimeout(1500);
  const muted = await ac();
  assert.equal(muted.scheduled, s.scheduled, 'muted: no notes scheduled');
  assert.equal(muted.osc, s.osc, 'muted: no oscillators created');
  await page.evaluate(() => { const f = window.__frontier; f.sim.events.push({ type: 'shot', weapon: 'tank', source: 0, x: 0, z: 0, tx: 1, tz: 1, team: 0 }); });
  await page.waitForTimeout(300);
  assert.equal((await ac()).osc, s.osc, 'muted: effects create nothing');
  // Sound off: the same staged fight and an order are silent and error-free.
  const silent = await page.evaluate(fightScript, 12);
  assert.equal(silent.played, 0, 'muted: the fight plays no effects');
  assert.equal(await page.evaluate(() => { const a = window.__frontier.audio; a.radioGate.last = -Infinity; a.radioGate.byKind.clear(); return a.order('move', window.__frontier.sim); }), false, 'muted: no radio reply');
  assert.equal((await ac()).osc, s.osc, 'muted: the fight creates no oscillators');
  await page.click('#audio');
  await page.waitForFunction(() => window.__frontier.audio.music.active === true, null, { timeout: 5000 });
  const resumed = (await ac()).scheduled;
  await page.waitForFunction(n => window.__frontier.audio.music.scheduled > n, resumed, { timeout: 8000 });

  // A hidden tab sleeps the context and the scheduler; coming back wakes both.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => window.__frontier.audio.music.active === false && window.__ac.contexts[0].state === 'suspended', null, { timeout: 5000 });
  const hiddenScheduled = (await ac()).scheduled;
  await page.waitForTimeout(1200);
  assert.equal((await ac()).scheduled, hiddenScheduled, 'hidden: no notes scheduled');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  // Hiding the tab also pauses the match (existing rule), so the player resumes it.
  await page.waitForSelector('[data-resume]', { timeout: 5000 });
  await page.waitForFunction(() => window.__frontier.audio.music.active === false, null, { timeout: 3000 });
  await page.click('[data-resume]');
  await page.waitForFunction(() => window.__frontier.audio.music.active === true && window.__ac.contexts[0].state === 'running', null, { timeout: 8000 });

  // Pausing the match stops the scheduler too.
  await page.click('#pause');
  await page.waitForFunction(() => window.__frontier.audio.music.active === false, null, { timeout: 5000 });

  // Settings: separate Music and Effects sliders (44 px rows, 11 px text), saved across a reload, Vietnamese labels.
  await page.click('[data-settings]');
  await page.click('#settings-tab-audio');
  const rows = await page.evaluate(() => ['musicVolume', 'sfxVolume'].map(k => { const input = document.querySelector(`[data-setting="${k}"]`), row = input.closest('.setting-row'), r = row.getBoundingClientRect(); return { k, h: r.height, font: parseFloat(getComputedStyle(row).fontSize), label: row.textContent.trim() }; }));
  assert.deepEqual(rows.map(r => r.label), ['Music volume', 'Effects volume']);
  for (const r of rows) { assert.ok(r.h >= 44, `${r.k} row is a 44 px target (${r.h})`); assert.ok(r.font >= 11, `${r.k} text size`); }
  await page.evaluate(() => { for (const [k, v] of [['musicVolume', '0.25'], ['sfxVolume', '0']]) { const i = document.querySelector(`[data-setting="${k}"]`); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } });
  await page.click('[data-do="apply"]');
  const saved = await page.evaluate(() => ({ s: window.__frontier.settings, music: window.__frontier.audio.levels.music, sfx: window.__frontier.audio.levels.sfx, enabled: window.__frontier.audio.sfx.enabled }));
  assert.equal(saved.s.musicVolume, 0.25); assert.equal(saved.s.sfxVolume, 0);
  assert.equal(saved.sfx, 0); assert.equal(saved.enabled, false, 'Effects at zero silences effects');
  assert.ok(saved.music > 0, 'music still has a level');
  await page.reload();
  await page.waitForFunction(() => window.__frontier?.settings, null, { timeout: 120000 });
  const again = await page.evaluate(() => ({ m: window.__frontier.settings.musicVolume, e: window.__frontier.settings.sfxVolume }));
  assert.deepEqual(again, { m: 0.25, e: 0 }, 'volumes survive a reload');
  await page.selectOption('#language', 'vi');
  await page.click('#start');
  await page.click('#pause');
  await page.click('[data-settings]');
  await page.click('#settings-tab-audio');
  const vi = await page.evaluate(() => [...document.querySelectorAll('.settings-body .setting-row')].map(r => r.textContent.trim()));
  assert.ok(vi.some(t => t.startsWith('Nhạc nền')) && vi.some(t => t.startsWith('Hiệu ứng âm thanh')), `Vietnamese labels: ${vi.join(' | ')}`);
  assert.deepEqual(errors, [], 'no page errors');
  console.log('audio ok');
} finally {
  await browser.close();
}

const {launchBrowser,openPage,suite} = await import('./lib/harness.mjs');
const mixBrowser=await launchBrowser();
await suite('audio mix',async()=>{
  for(const viewport of ['desktop','portrait','landscape']) {
    const {page,goto,ready,tap,errors}=await openPage(mixBrowser,viewport);
    await goto();await ready();await tap('#start');await tap('#pause');await tap('[data-settings]');await tap('#settings-tab-audio');
    const rows=await page.locator('[data-sound-test]').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height,font:parseFloat(getComputedStyle(b).fontSize)};}));
    assert.equal(rows.length,7);for(const r of rows) assert.ok(r.w>=44&&r.h>=44&&r.font>=11);
    await page.waitForFunction(()=>!!window.__frontier.audio);
    const before=await page.evaluate(()=>window.__frontier.audio.sfx.played);
    await tap('[data-sound-test="research"]');
    await page.waitForFunction(n=>window.__frontier.audio.sfx.played>n,before);
    const result=await page.evaluate(()=>{
      const f=window.__frontier,a=f.audio;
      a.sfx.budget.recent.clear();a.sfx.budget.lastPlayed.clear();a.sfx.budget.voices=[];
      const accepted=Array.from({length:4},()=>a.sfx.play('tap',{gap:0}));
      a.combatMix.times=[];
      a.sfx.budget.recent.clear();a.sfx.budget.lastPlayed.clear();a.sfx.budget.voices=[];
      const c=f.view.focus;
      for(const weapon of ['ranger','tank','breaker','antitank','vanguard','tower','worker']) a.event({type:'shot',weapon,team:0,x:c.x,z:c.z},f.sim);
      a.update(0,{sim:f.sim,settings:f.settings,started:true,paused:true,hidden:false,mapId:f.sim.terrain.id});
      return {accepted,gain:a.combatGain,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.deepEqual(result.accepted,[true,true,true,false]);
    assert.equal(result.gain,10**(-4/20));assert.equal(result.overflow,false);
    assert.deepEqual(errors,[]);await page.close();
  }
},{browser:mixBrowser});
