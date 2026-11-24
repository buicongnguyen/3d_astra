// Adapted from Claude's smooth-dense-scenes review: count actual WebGL draws,
// including shadows, then compare the same frozen scene at fixed quality.
// Run against a built game: TEST_URL=http://127.0.0.1:<port>/ (the default port 4193 is often taken);
// RENDER_ONLY=<name>,<name> runs some scenarios; --record <label> writes test-results/render-<label>/
// without asserting; SOFTWARE_RENDER=1 draws with SwiftShader (bit-stable screenshots for A/B checks).
//
// A scenario is data. Besides the map, camera and the inline set-ups below (army, wave, towers, air):
//   spawn:   [{ type, team = 1, count = 1, near: [x, z] }]  units in a 2 m grid centred on `near`
//   boss:    "<type>" (true = the Iron Vanguard): spawned awake in its warning, its first attack's mark
//            on the ground in front of it
//   variant: a Frontier Defence variant ("endless", "daily", later "heroic"), picked on the Defence
//            menu as a player does (so the level is built through defenceVariant)
//   elite:   true (Defence `wave` scenarios) makes every third wave unit an elite, the six affixes in turn (W2-B)
//   status:  { id, count, team?, seconds? }: the status applied to the first `count` units (needs the
//            status core, sim.applyStatus)
//   rules:   skirmish rules for the match (window.__frontier.rules, set before restart and cleared after;
//            a first restart with them loads any models they make the match need)
// Every type a scenario can put on screen (spawn, air, boss and the boss's drops) is loaded before
// the frozen scene, so nothing draws as the fallback airframe.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pickShard, shardLabel } from './lib/shard.mjs';

const record = process.argv.indexOf('--record');
const label = record >= 0 ? process.argv[record + 1] : 'current';
assert.match(label, /^[a-z0-9-]+$/);
const output = `test-results/render-${label}`;
fs.mkdirSync(output, {recursive:true});
const software = !!process.env.SOFTWARE_RENDER;
const browser = await chromium.launch({headless:true,
  executablePath:process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args:software ? ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu'] : ['--enable-unsafe-swiftshader'],
});
const balance = JSON.parse(fs.readFileSync(new URL('../src/balance.json', import.meta.url), 'utf8'));
const bossType = scenario => scenario.boss === true ? 'ironvanguard' : scenario.boss || null;
// A boss's drops (units it releases as it is hurt), as a list of types, read from its definition or its boss entry.
const dropsOf = type => {
  const d = balance.definitions[type] || {}, spec = balance.bosses?.[d.boss] || {};
  return [...(d.drops || []), ...(spec.drops || [])].map(x => typeof x === 'string' ? x : x?.type || x?.unit).filter(Boolean);
};
// Every type the scenario can put on screen that the match itself may not have loaded.
const screenTypes = scenario => [...new Set([...(scenario.spawn || []).map(x => x.type), ...(scenario.air || []).map(([type]) => type),
  ...(bossType(scenario) ? [bossType(scenario), ...dropsOf(bossType(scenario))] : [])])];
// The boss's first attack as a ground mark: its id and zone (shape, radius and any other zone field).
const bossMark = scenario => {
  const type = bossType(scenario);
  if (!type) return null;
  const spec = balance.bosses?.[balance.definitions[type]?.boss], attack = spec?.attacks?.[0];
  if (!attack) throw new Error(`render-budget: ${type} has no boss attack in balance.json`);
  const {shape, radius, ...extra} = attack.zone;
  return {type, attack:attack.id, shape, radius, extra};
};
const scenarios = [
  {name:'base-high', map:'riverlands', enemies:1, mobile:false, zoom:42, focus:[-20,19], reveal:false},
  {name:'river-overview-high', map:'riverlands', enemies:1, mobile:false, zoom:70, focus:[0,0], reveal:true},
  {name:'large-map-high', map:'expanse', enemies:3, mobile:false, zoom:105, focus:[0,0], reveal:true},
  // A7: dense army on a portrait phone, including the live health and selection overlays.
  {name:'army-300-eco', map:'riverlands', enemies:1, mobile:true, zoom:42, focus:[0,0], reveal:true,
    army:300, select:true, dense:true, triangles:1350000, compose:880},
  {name:'battle-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60},
  // The same phone battle with three rivals, first on the mirror roster and then one faction each (package 2.6).
  {name:'three-rivals-eco', map:'riverlands', enemies:3, teams:4, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60},
  {name:'three-factions-eco', map:'riverlands', enemies:3, teams:4, faction:'mixed', mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60},
  // Frontier Defence (0.17) on the phone: 120 Ashfall units along Gorge Road, half of them damaged,
  // and ten crewed towers at mixed tiers, at the level's own zoom.
  // Twice battle-eco's army, a quarter of it tanks and Scorchers: the triangle line is raised to match.
  // 0.21: the towers take all six crews (Tank emplacements and Scorcher flame traps too) and the
  // gold-trimmed commander stands on the road among them.
  {name:'defence-wave-eco', defence:'d-gorge', mobile:true, zoom:70, focus:[-1,0], reveal:true, wave:120, towers:10, triangles:600000},
  // 0.18: battle-eco with the air cap in play, 4 flyers per side (2 Kites and 2 Hawks each). Flyers add a
  // body, a team paint and a rotor batch per type and one blob-shadow draw for all: at most 10% over
  // battle-eco's 107 draws (2026-11-13).
  {name:'air-battle-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60,
    air:[['kite',0],['kite',0],['hawk',0],['hawk',0],['kite',1],['kite',1],['hawk',1],['hawk',1]]},
  // 0.21: a river level with the west bridge blown and a pontoon over the east crossing, the wave
  // spread over all three roads. River scenery (water, reeds, fish, dragonflies) costs more than the
  // valley: Twin Bridges measured 141 draws with both bridges standing at 0.17; its line is 135.
  // Bosses (docs/aaa/BOSSES.md): battle-eco with the Iron Vanguard among the enemy army, an attack marked
  // on the ground. The boss is one draw per rigid part (seven) plus its mark and bar: 116 draws on 2026-11-18 (battle-eco 107).
  {name:'boss-battle-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, boss:true},
  {name:'defence-river-eco', defence:'d-bridges', mobile:true, zoom:78, focus:[0,0], reveal:true, wave:120, towers:10, triangles:600000, crossings:{'-22':'blown', '22':'pontoon'}},
  // 0.22: Long Crossing's wave with troop carriers: every 20th of the 120 units is a carrier (six, in
  // place of six tanks). The carrier's five materials add five batches however many carriers there
  // are (its radius matches the tank's, so it shares the tanks' blob-shadow batch): 134 draws without
  // carriers, 139 with them (2026-11-18). Each batch composes its own matrix once a frame, hence the
  // compose line a little above the default.
  {name:'defence-carrier-eco', defence:'d-longcrossing', mobile:true, zoom:78, focus:[0,0], reveal:true, wave:120, towers:10, triangles:600000, compose:460, carrierEvery:20, unlockAfter:'d-canyon'},
  // 0.23: Three Roads, the 128 m valley, at its own zoom on the phone: the 120-unit wave spread over its
  // four roads (carriers among it), ten pad towers, four more in the build zones (their open cells are
  // one merged mesh) and both armour squads. 106 draws and 478 matrix composes on 2026-11-19 (no water,
  // so fewer draws than the river levels; four more towers and tanks, so a few more composes).
  {name:'defence-big-eco', defence:'d-crossroads', mobile:true, zoom:92, focus:[0,0], reveal:true, wave:120, towers:10, zoneTowers:4, armour:2, triangles:600000, compose:500, carrierEvery:20, unlockAfter:'d-longcrossing'},
  // AAA round 2 (W1-B): battle-eco with 8 Gunners among the 52 other units and 12 enemy units Pinned (status icons on).
  {name:'gunner-battle-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:52,
    spawn:[{type:'gunner', team:0, count:8, near:[-3,4]}], status:{id:'pinned', count:12, team:1}},
  // AAA round 2, W1-C: battle-eco with 8 Veil Stalkers on the enemy side and 4 on the player's (one more batch for the new model).
  {name:'stalker-battle-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, triangles:340000, spawn:[{type:'stalker', team:1, count:8, near:[-3,-14]}, {type:'stalker', team:0, count:4, near:[-3,14]}]},
  // W1-E: the Iron Sovereign (a six-legged boss, two tripod draws) with 60 units; and on Gorge Road with a wave.
  {name:'boss-sovereign-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, boss:'ironsovereign'},
  {name:'defence-boss-eco', defence:'d-gorge', mobile:true, zoom:70, focus:[-1,0], reveal:true, wave:60, towers:10, triangles:600000, boss:'ironsovereign'},
  // AAA round 2 (W1-A): battle-eco under the Expanded roster, a Field workshop on each side (the first `rules` scenario).
  {name:'battle-expanded-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, rules:{roster:'expanded'},
    spawn:[{type:'workshop', team:0, near:[-12,12]}, {type:'workshop', team:1, near:[-12,-12]}]},
  // W2-A: Gunners, Stalkers and Ramparts together under Expanded, army 60.
  {name:'battle-expanded-full-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, rules:{roster:'expanded'}, triangles:400000,
    spawn:[{type:'gunner', team:0, count:6, near:[-3,4]}, {type:'stalker', team:0, count:4, near:[-3,14]}, {type:'rampart', team:0, count:4, near:[-8,10]}, {type:'rampart', team:1, count:4, near:[-8,-12]}, {type:'stalker', team:1, count:4, near:[-3,-14]}]},
  // AAA round 2 (W2-B): d-longcrossing Heroic wave 6 look: elites (gold rings) and Stalkers among 120 wave units, 10 towers.
  {name:'defence-heroic-eco', defence:'d-longcrossing', variant:'heroic', mobile:true, zoom:78, focus:[0,0], reveal:true, wave:50, towers:6, triangles:600000, compose:460, elite:true, unlockAfter:['d-canyon', 'd-longcrossing'],
    spawn:[{type:'stalker', team:1, count:2, near:[-3,-14]}]},
  // W2-C: battle-eco under the night look (palette swap only on Eco: no new light, no new mesh).
  {name:'night-battle-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, rules:{look:'night'}},
  // AAA round 3 (R3-D): the night (moon, stars) and the storm (rain, cloud shade on High) over the day
  // scenes base-high and battle-eco: at most 6 draws over the same map by day.
  {name:'night-base-high', map:'riverlands', enemies:1, mobile:false, zoom:42, focus:[-20,19], reveal:false, rules:{look:'night'}},
  {name:'storm-base-high', map:'riverlands', enemies:1, mobile:false, zoom:42, focus:[-20,19], reveal:false, rules:{look:'storm'}},
  {name:'storm-battle-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, rules:{look:'storm'}},
  // AAA round 3 (R3-C): Army size 200 is desktop-only, so its battle is measured on the desktop at High:
  // 200 units (100 a side, the five battle-eco kinds) under the pop 200 rule, framed like base-high.
  // 248 draws (135 main, 113 shadow), 1.79 M triangles (shadows included), 433 composes on 2026-11-21.
  {name:'battle-200', map:'riverlands', enemies:1, mobile:false, zoom:42, focus:[-3,4], reveal:true, army:200, rules:{pop:'200'}, triangles:1900000, compose:460},
  // AAA round 3 (R3-W): battle-eco with the round-3 air cap in play, 8 flyers per side (all four types), and six
  // Anti-tank rockets in flight. Rocket bodies are one instanced draw and the air life (rotor blur, nav lights, engine
  // glow) another; contrails and the ribbon use the effect pools.
  // Campaign C6c: the redrawn Ember balloon (2440 tris) and Kite (1298) add about 5.5k triangles here (309.6k -> 315.2k):
  // detail, not an instancing leak, so this scene has its own cap.
  {name:'air-battle', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, rockets:6, triangles:320000,
    air:[['kite',0],['hawk',0],['balloon',0],['glider',0],['kite',0],['hawk',0],['balloon',0],['glider',0],['kite',1],['hawk',1],['balloon',1],['glider',1],['kite',1],['hawk',1],['balloon',1],['glider',1]]},
  // AAA round 3 (R3-L): the player's base on the phone with a second Barracks, a Relay and a Tower: building
  // decals and gate details are one instanced draw (no shadow pass).
  {name:'building-life-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-17,14], reveal:true,
    spawn:[{type:'barracks', team:0, near:[-13.2,19.3]}, {type:'relay', team:0, near:[-15,10]}, {type:'tower', team:0, near:[-20,27]}]},
  // AAA round 3 (R3-H): the walking Iron Sovereign (ironsovereign2, the Sovereign's model under its own name) in
  // its warning over battle-eco's 60 units, with two Ashfall relays in the frame. Its relay shield, when one is up,
  // adds two draws (the bubble and one instanced draw for every tether), none without relays.
  {name:'boss-sovereign2-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, boss:'ironsovereign2',
    spawn:[{type:'relay', team:1, near:[-14,-12]}, {type:'relay', team:1, near:[8,-14]}]},
  // AAA round 3 (R3-K): battle readability. battle-eco at the widest phone zoom (88), where every unit carries a type
  // icon (the status atlas: one draw); battle-eco at its own zoom with three Ctrl+number groups (badges, the same draw);
  // and Three Roads with both armour squads bought Combined (one gold-trim draw, stars in the atlas draw).
  {name:'wide-battle-eco', map:'riverlands', enemies:1, mobile:true, zoom:88, focus:[-3,0], reveal:true, army:60, triangles:380000}, // the whole map in view: 351,390 triangles on the base build
  {name:'groups-battle-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, groups:3},
  // Round 3 kit pass: battle-eco with the army selected, the phone's context panel open over the bottom of the frame.
  {name:'battle-dock-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, select:true},
  {name:'combined-defence-eco', defence:'d-crossroads', mobile:true, zoom:92, focus:[0,0], reveal:true, wave:120, towers:10, zoneTowers:4, armour:2, combined:true, triangles:600000, compose:500, carrierEvery:20, unlockAfter:'d-longcrossing'},
  // R3 map variety: large-map-high on the heaviest new map, Twin Rivers (160 m, two rivers, four bridges, two fords),
  // three rivals, fog lifted. Measured with the other 160 m maps on 2026-11-22 (large-map-high on Expanse: 218 draws):
  // Twin Rivers 235 (each extra bridge is its own model, about 8 draws with its shadow), Crown Mesa 175, Ironback 174,
  // Dry Reach 174. Its line is large-map-high's 240.
  {name:'twinrivers-high', map:'twinrivers', enemies:3, mobile:false, zoom:105, focus:[0,0], reveal:true},
  // AAA round 3 (R3-X): air-battle-eco with every weapon effect class in flight at once (see `weapons` below). Shells, lobs,
  // flak, missiles and bombs are one instanced draw (the ordnance mesh); everything else uses the effect pools.
  {name:'weapons-mix-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, weapons:true, rockets:1,
    air:[['kite',0],['hawk',0],['balloon',0],['glider',0],['kite',1],['hawk',1],['balloon',1],['glider',1]]},
  // AAA round 4 (R4-P1 Wild frontier): battle-eco's 60 units on Amber Dunes framed on the Weather Spire (the day twin),
  // then the same scene with the rule on, the Spire held, a Sandstorm raging over the enemy rank and a tamed Dune Wyrm
  // in the player's rank (wild-storm-eco: the same without the Wyrm). The Wild pieces may add at most 4 draws to the twin.
  {name:'dunes-battle-eco', map:'dunes', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60},
  {name:'wild-storm-eco', map:'dunes', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, rules:{wild:'on'}, wild:[-3,-8]},
  {name:'wild-battle-eco', map:'dunes', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60, rules:{wild:'on'}, wild:[-3,-8], spawn:[{type:'wyrm', team:0, count:1, near:[-6,10]}]},
].filter(s => !process.env.RENDER_ONLY || process.env.RENDER_ONLY.split(',').includes(s.name));
// CI runs the scenarios in three jobs (pages.yml `shard: i/3`, tests/lib/shard.mjs): every third scenario each.
if (!process.env.RENDER_ONLY) scenarios.splice(0, scenarios.length, ...pickShard(scenarios));
console.log(`render-budget${shardLabel}: ${scenarios.length} scenarios (${scenarios.map(s => s.name).join(', ')})`);
const results = [];
const limits = {'base-high':160, 'river-overview-high':190, 'large-map-high':240, 'battle-eco':120, 'three-rivals-eco':150, 'three-factions-eco':185, 'defence-wave-eco':120, 'air-battle-eco':118, 'defence-river-eco':135, 'defence-carrier-eco':142, 'boss-battle-eco':120, 'defence-big-eco':112};
// Limits of scenarios added in AAA round 2: one new line per package right below this comment,
// `Object.assign(limits, { "<name>": <n> });` (the line above stays as it is).
Object.assign(limits, {});
Object.assign(limits, { "gunner-battle-eco": 125 });
Object.assign(limits, { "stalker-battle-eco": 125 });
Object.assign(limits, { 'boss-sovereign-eco': 120, 'defence-boss-eco': 125 });
Object.assign(limits, {'battle-expanded-eco':125}); // W1-A
Object.assign(limits, {'battle-expanded-full-eco':150}); // W2-A
Object.assign(limits, {'defence-heroic-eco':125}); // W2-B
Object.assign(limits, {'night-battle-eco':120}); // W2-C
Object.assign(limits, {'night-base-high':166, 'storm-base-high':166, 'storm-battle-eco':126}); // R3-D: day + 6
Object.assign(limits, {'boss-sovereign2-eco':125}); // R3-H
Object.assign(limits, {'battle-200':260}); // R3-C
Object.assign(limits, {'air-battle':135}); // R3-W: 125 draws on 2026-11-21 (123 before: +1 rocket bodies, +1 air life)
Object.assign(limits, {'building-life-eco':110}); // R3-L
Object.assign(limits, {'twinrivers-high':240}); // R3 map variety: large-map-high's line (235 draws on 2026-11-22); 207 once its four bridges were instanced (Wave 3 integration)
Object.assign(limits, {'wide-battle-eco':152, 'groups-battle-eco':111, 'combined-defence-eco':97}); // R3-K: the same scene on the base build + 4 (148, 107, 93 draws on 2026-11-21)
Object.assign(limits, {'weapons-mix-eco':131}); // R3-FX: the weapon sprite sheets add exactly 2 draws (one instanced batch per blend mode): weapons-mix-eco 132 -> 134, battle-eco 111 -> 113, limits still hold. R3-X: 128 draws on 2026-11-22 (127 on the base build with the same shots: +1 ordnance bodies) + 3
// Phone battle HUD (Wave 3): the phone canvas now runs under the bars, so a mobile frame shows more map: +4 draws in most
// mobile scenes, more with three rivals (base build -> HUD build, 2026-11-22: three-rivals-eco 146 -> 160, three-factions-eco
// 182 -> 198, air-battle-eco 117 -> 121, battle-expanded-full-eco 149 -> 153, groups-battle-eco 108 -> 112; weapons-mix-eco 132
// with every class). Lines that the HUD pushed over: measured + 3. Desktop scenes are unchanged.
Object.assign(limits, {'three-rivals-eco':163, 'three-factions-eco':201, 'air-battle-eco':124, 'battle-expanded-full-eco':156, 'groups-battle-eco':115, 'weapons-mix-eco':135});
// Round 3 kit pass (owner: crop): the phone frame is no longer drawn under the opaque tab strip or an open dock panel
// (hud.js coverFollowsDock). The see-through top bar keeps the map under it, and that strip is where most of the HUD's
// extra draws come from, so the lines move little (2026-11-22, wave-3 build -> kit build: three-rivals-eco 160 -> 158,
// three-factions-eco 198 -> 196, battle-eco 111 -> 111; battle-dock-eco 171 -> 169, with 221 of 844 px rows not shaded).
Object.assign(limits, {'three-rivals-eco':161, 'three-factions-eco':199, 'battle-dock-eco':172});
// R3-FX: the weapon sprite sheets are two more instanced draws in every battle scene (measured: battle-eco 111 -> 113, air-battle-eco 121 -> 123, weapons-mix-eco 132 -> 134).
for (const k of Object.keys(limits)) limits[k] += 2;
// A7 phone measurements with the pooled overlays and shared rigid finish batches.
Object.assign(limits, {'army-300-eco':105, 'battle-dock-eco':100, 'defence-heroic-eco':122, 'combined-defence-eco':94});
for (const s of scenarios) if (s.name === 'three-rivals-eco') s.triangles = 330000; // 303,222 -> 324,494 triangles with the HUD's taller phone frame
Object.assign(limits, {'dunes-battle-eco':95, 'wild-storm-eco':95, 'wild-battle-eco':101}); // R4-P1 (2026-11-21: 91, 94, 100 draws): the Spire and a raging storm at most 4 over the twin; a tamed Wyrm adds its model's five material batches plus its leg batch
try {
  for (const scenario of scenarios) {
    const page = await browser.newPage({viewport:scenario.mobile ? {width:390,height:844} : {width:1280,height:800},
      isMobile:scenario.mobile, hasTouch:scenario.mobile, deviceScaleFactor:scenario.mobile ? 2 : 1});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // A later Defence level opens with a star on the one before it (src/defence/progress.js levelOpen).
    if (scenario.unlockAfter) await page.addInitScript(ids => { try { localStorage.setItem('frontier-defence-v1', JSON.stringify({levels:Object.fromEntries([].concat(ids).map(id => [id, {stars:1, lives:5, difficulty:'standard'}]))})); } catch {} }, scenario.unlockAfter);
    await page.addInitScript(() => {
      const nativeRAF = window.requestAnimationFrame.bind(window);
      window.__nativeRAF = nativeRAF;
      window.requestAnimationFrame = cb => nativeRAF(time => { if (!window.__freezeFrames) cb(time); });
    });
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4193/') + '?test=1' + (process.env.RENDER_QUERY || ''), {waitUntil:'domcontentloaded', timeout:90000});
    await page.waitForFunction(() => window.__frontier?.view.modelsReady, null, {timeout:90000});
    if (scenario.defence) {
      await page.locator('[data-mode="defence"]').click();
      if (scenario.variant) await page.locator(`[data-defence-variant="${scenario.variant}"]`).click();
      await page.locator(`[data-level-id="${scenario.defence}"]`).click();
    } else {
      await page.selectOption('#scenario', scenario.map);
      await page.selectOption('#enemy-count', String(scenario.enemies));
      if (scenario.faction) await page.selectOption('#enemy-faction', scenario.faction);
    }
    await page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector('#start').disabled, null, {timeout:90000});
    if (scenario.defence) {
      await page.locator('#start').click();
      await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.defence && document.querySelector('#defence-bar'), null, {timeout:30000});
    }
    // Flyer and boss models load in the background in play (WorldView.preloadModels); here, every type
    // the scenario puts on screen loads before the frozen scene.
    const types = screenTypes(scenario);
    if (types.length) await page.evaluate(types => window.__frontier.view.preloadModels(types), types);
    // Rules can change the models a match needs (an Expanded roster). restart() then loads them and
    // builds the match again later, after the rules were cleared: so restart once with the rules and
    // wait for that load, and the restart below builds its match at once, with them.
    if (scenario.rules) await page.evaluate(async rules => {
      const f = window.__frontier;
      f.rules = rules;
      try { await f.restart(); } finally { f.rules = null; }
    }, scenario.rules);
    await page.evaluate(async ({scenario, mark}) => {
      window.__freezeFrames = true;
      const f = window.__frontier;
      if (scenario.rules) f.rules = scenario.rules;
      const loading = f.restart(); // deterministic initial simulation; no gameplay advances during profiling
      if (scenario.rules) f.rules = null;
      // A restart that still had models to load would replace this match later, mid-measurement.
      if (loading) throw new Error(`render-budget: ${scenario.name}: restart() had to load models first`);
      f.select([]);
      const s = f.sim, v = f.view;
      // R3-FX: the weapon sprite sheets (two instanced draws) load when the battle starts; measure with them loaded, as played.
      await v.fx.sprites.whenReady();
      s.aiEnabled = false;
      if (scenario.reveal) { s.visible[0].fill(1); s.explored[0].fill(1); }
      if (scenario.wave) {
        // Towers on the first pads at tiers 1-3, then the wave spread along the road, every other unit hurt.
        const def = s.missionDef.defence, routes = Object.values(def.routes), kinds = ['vanguard','ranger','breaker','tank'];
        s.players[0].alloy = 1e5;
        def.pads.slice(0, scenario.towers).forEach((p, i) => {
          s.command({team:0, type:'padBuild', pad:p.id, crew:def.crews[i % def.crews.length]});
          for (let k = 0; k < i % 3; k++) s.command({team:0, type:'padUpgrade', building:s.towerOn(p.id).id});
        });
        // Zone towers on open cells of the build zones, spread out, and the armour squads by the roads (0.23).
        for (let made = 0, z = -s.terrain.half + 1; made < (scenario.zoneTowers || 0) && z < s.terrain.half; z += 6)
          for (let x = -s.terrain.half + 1; made < scenario.zoneTowers && x < s.terrain.half; x += 6) {
            const zone = s.zoneAt(x, z);
            if (zone && s.command({team:0, type:'zoneBuild', zone:zone.id, x, z, crew:def.crews[made % def.crews.length]})) made++;
          }
        for (let k = 0; k < (scenario.armour || 0); k++) {
          s.command({team:0, type:'armourBuy'});
          const pts = routes[k % routes.length], at = pts[Math.floor(pts.length / 2)];
          s.armourUnits(k + 1).forEach((e, i) => { e.x = at.x + 3.5 + i * 2.4; e.z = at.z; e.post = {x:e.x, z:e.z}; });
        }
        if (scenario.crossings) {
          s.crossings = Object.fromEntries(Object.entries(scenario.crossings).map(([x, state]) => [x, {state, at:0, progress:0}]));
          s.applyCrossings();
        }
        for (let i = 0; i < scenario.wave; i++) {
          const pts = routes[i % routes.length], legs = pts.slice(1).map((b, j) => Math.hypot(b.x - pts[j].x, b.z - pts[j].z)), total = legs.reduce((a, b) => a + b, 0);
          let d = (Math.floor(i / routes.length) + 0.5) / Math.ceil(scenario.wave / routes.length) * total * 0.97, k = 0;
          while (d > legs[k]) d -= legs[k++];
          const a = pts[k], b = pts[k + 1], t = d / legs[k], side = ((i * 0.618) % 1 - 0.5) * 2.4;
          const nx = -(b.z - a.z) / legs[k], nz = (b.x - a.x) / legs[k];
          const kind = scenario.carrierEvery && i % scenario.carrierEvery === scenario.carrierEvery - 1 ? 'carrier' : kinds[i % kinds.length];
          const e = s.spawn(s.typeFor(1, kind), 1, a.x + (b.x - a.x) * t + nx * side, a.z + (b.z - a.z) * t + nz * side, true, true);
          e.angle = Math.atan2(b.x - a.x, b.z - a.z);
          if (i % 2) e.hp = e.maxHp * 0.5;
          // W2-B: `elite` makes every third wave unit an elite (the affixes in turn), for the gold rings.
          if (scenario.elite && i % 3 === 0) s.applyElite(e, {elite:['plated','swift','splitter','volatile','banner','mender'][(i / 3 | 0) % 6], split:'vanguard'});
        }
        // The commander on the road in the middle of it all (left where it is if it is not there).
        const hero = s.commander?.(), mid = routes[0][Math.floor(routes[0].length / 2)];
        if (hero) { hero.x = mid.x + 2.5; hero.z = mid.z; }
        // The interface pass draws the pontoons and hides the blown bridge (app/defence-ui.js).
        f.step(0);
      }
      if (scenario.army) {
        const kinds = ['ranger','vanguard','tank','breaker','antitank'];
        for (let i = 0; i < scenario.army; i++) {
          const teams = scenario.teams || 2, team = i % teams, row = Math.floor(i / teams);
          const cols = scenario.dense ? 15 : 6;
          const x = scenario.dense ? -12 + row % cols * 1.7 : -8 + row % cols * 2;
          const z = (team ? -1 : 1) * (scenario.dense ? 4 + Math.floor(row / cols) * 1.35 : 6 + Math.floor(row / cols) * 2);
          const unit = s.spawn(kinds[row % kinds.length], team, x, z);
          if (scenario.dense) unit.hp *= 0.85;
        }
      }
      if (mark) {
        // Awake and in its warning, its first attack's mark on the player's front rank (sim/bosses.js
        // state, set directly): the Iron Vanguard's 4.5 m four-gun burst.
        const b = s.spawn(mark.type, 1, -3, -12, true, true);
        b.bs = {phase:'warning', stage:1, cycle:0, post:{x:b.x, z:b.z}, zone:1, until:s.time + 3};
        s.dangerZones = [{id:1, boss:b.id, team:1, attack:mark.attack, shape:mark.shape, x:-3, z:6, radius:mark.radius, angle:0, from:s.time - 1, at:s.time + 2, until:s.time + 3, ...mark.extra}];
      }
      for (const [i, [type, team]] of (scenario.air || []).entries())
        s.spawn(type, team, -6 + (i % 4) * 3, (team ? -1 : 1) * 3, true, true);
      // R3-W `rockets: n`: n Anti-tank rockets in flight, fired from the player's front rank at the enemy's (view only).
      if (scenario.rockets) {
        const at = s.entities.filter(e => e.type === 'antitank' && e.team === 0), foe = s.entities.filter(e => e.kind === 'unit' && e.team === 1 && e.mechanical);
        for (let i = 0; i < scenario.rockets && at.length && foe.length; i++) {
          const a = at[i % at.length], t = foe[i % foe.length];
          v.fx.shot({type:'shot', weapon:'antitank', unit:'antitank', source:a.id, target:t.id, x:a.x, z:a.z, tx:t.x, tz:t.z, team:0, heavy:true}, s);
        }
        v.fx.update(s, 0.2);
      }
      // R3-X `weapons: true`: one shot of every weapon effect class in flight at once (view only): tracers, an MG stream, a tank
      // shell, an artillery lob, flak at a flyer, a beam, a rail, a flame, a heal, an Anti-tank rocket, Hawk strafing and
      // missiles, a Glider bomb, a Balloon firebomb, a Barrage shell falling onto its mark, and a flyer shot down.
      if (scenario.weapons) {
        v.update(s, 0, f.selected, null); // the flyers' models exist before one is shot down
        const ground = s.entities.filter(e => e.kind === 'unit' && !e.flying && e.hp > 0), air = s.entities.filter(e => e.kind === 'unit' && e.flying);
        const mine = ground.filter(e => e.team === 0), foe = ground.filter(e => e.team === 1), myAir = air.filter(e => e.team === 0), foeAir = air.filter(e => e.team === 1);
        const fire = (unit, weapon, a, t, extra = {}) => v.fx.shot({type:'shot', unit, weapon, source:a.id, target:t.id, x:a.x, z:a.z, tx:t.x, tz:t.z, team:a.team,
          ...(a.flying ? {sAir:a.fly} : null), ...(t.flying ? {tAir:t.fly} : null), ...extra}, s);
        const pick = (list, i) => list[i % list.length], flyer = type => myAir.find(e => e.type === type);
        [['ranger','ranger'], ['gunner','ranger'], ['tank','tank'], ['breaker','breaker'], ['stalker','ranger'], ['watcher','antitank'], ['scorcher','scorcher'], ['antitank','antitank']]
          .forEach(([unit, weapon], i) => fire(unit, weapon, pick(mine, i), pick(foe, i)));
        v.fx.shot({type:'support', weapon:'medic', source:mine[1].id, target:mine[2].id, x:mine[1].x, z:mine[1].z, tx:mine[2].x, tz:mine[2].z, team:0}, s);
        fire('tower', 'tower', pick(mine, 9), foeAir[0]);          // flak
        fire('hawk', 'ranger', flyer('hawk'), pick(foe, 3));        // strafing
        fire('hawk', 'ranger', flyer('hawk'), foeAir[1]);           // missiles
        fire('glider', 'ranger', flyer('glider'), pick(foe, 4));    // a bomb
        fire('balloon', 'breaker', flyer('balloon'), pick(foe, 5)); // a firebomb
        (s.strikes ||= []).push({at:s.time + 0.62, x:-3, z:-8, team:0, by:mine[0].id, damage:90, radius:4});
        // A flyer shot down: the sim forgets it, the view keeps its falling wreck.
        const down = foeAir[foeAir.length - 1];
        s.entities.splice(s.entities.indexOf(down), 1);
        v.event({type:'death', x:down.x, z:down.z, team:down.team, building:false, heavy:true, core:false, seed:down.id, direction:0}, s);
        v.fx.update(s, 0.12);
      }
      // R3-K `groups: n`: the player's units in n Ctrl+number groups of 8 (badges at close zoom); `combined`: every
      // armour squad tank bought Combined (gold trim and star). View only.
      if (scenario.groups) {
        const mine = s.entities.filter(e => e.kind === 'unit' && e.team === 0).map(e => e.id);
        v.controlGroups = new Map(Array.from({length:scenario.groups}, (_, k) => [String(k + 1), mine.slice(k * 8, k * 8 + 8)]));
      }
      if (scenario.combined) for (const e of s.entities) if (e.squad && e.team === 0) e.combined = true;
      // Round 3 kit pass `select: true`: the player's army selected, so the phone dock panel is open; one UI tick (step(0))
      // lets the HUD cut the drawing under its opaque part (app/hud.js coverFollowsDock, view.js setCoverCrop).
      if (scenario.select) { f.select(s.entities.filter(e => e.kind === 'unit' && e.team === 0 && e.type !== 'worker').map(e => e.id)); f.step(0); }
      // R4-P1 `wild: [x, z]`: the player holds the Weather Spire and a Sandstorm rages at (x, z) (sim state, set directly).
      if (scenario.wild) { Object.values(s.skirmishPoints).find(p => p.wild === "spire").owner = 0; s.wild.storms.push({team:0, x:scenario.wild[0], z:scenario.wild[1], r:10, at:s.time - 2, until:s.time + 12, started:true}); }
      // Data-driven units: a 2 m grid centred on `near`.
      for (const {type, team = 1, count = 1, near = [0, 0]} of scenario.spawn || []) {
        const cols = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / cols);
        for (let i = 0; i < count; i++)
          s.spawn(type, team, near[0] + (i % cols - (cols - 1) / 2) * 2, near[1] + (Math.floor(i / cols) - (rows - 1) / 2) * 2, true, true);
      }
      if (scenario.status) {
        const {id, count, team, seconds = 1e6} = scenario.status;
        if (typeof s.applyStatus !== 'function') throw new Error('render-budget: a status scenario needs the status core (sim.applyStatus)');
        s.entities.filter(e => e.kind === 'unit' && (team === undefined || e.team === team)).slice(0, count).forEach(e => s.applyStatus(e, id, seconds));
      }
      v.life.uniforms.uTime.value = 0;
      v.focusOn(...scenario.focus); v.zoom = scenario.zoom; v.updateCamera(); v.resize();
      window.__renderOnce = () => v.update(s, 0, f.selected, null);
      const gl = v.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
      window.__renderMeter = {phase:'main', current:null, gpu:debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown'};
      const meter = window.__renderMeter;
      meter.matrixMethods = {};
      // Measure CPU transform work and GPU buffer traffic as well as draws.
      const matrix = v.scene.matrix.constructor.prototype;
      for (const name of ['compose', 'multiplyMatrices']) {
        const original = matrix[name];
        meter.matrixMethods[name] = original;
        matrix[name] = function (...args) {
          if (meter.current) meter.current[name]++;
          return original.apply(this, args);
        };
      }
      const upload = gl.bufferSubData;
      meter.upload = upload;
      gl.bufferSubData = function (target, offset, data, sourceOffset = 0, length) {
        if (meter.current) {
          meter.current.bufferUploads++;
          meter.current.uploadBytes += length ? length * data.BYTES_PER_ELEMENT : data.byteLength - sourceOffset * (data.BYTES_PER_ELEMENT || 1);
        }
        return upload.apply(this, arguments);
      };
      for (const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
        const original = gl[name];
        gl[name] = function (...args) {
          if (meter.current) {
            meter.current.calls++; meter.current[meter.phase]++;
            const instanced = name.endsWith('Instanced'), arrays = name.startsWith('drawArrays');
            if (instanced) meter.current.instanced++;
            if (args[0] === gl.TRIANGLES) meter.current.triangles += (arrays ? args[2] : args[1]) / 3 * (instanced ? args[arrays ? 3 : 4] : 1);
          }
          return original.apply(this, args);
        };
      }
      const direct = v.renderer.renderBufferDirect;
      v.renderer.renderBufferDirect = function (camera, scene, geometry, material, ...rest) {
        meter.phase = material.isMeshDepthMaterial || material.isMeshDistanceMaterial ? 'shadow' : 'main';
        try { return direct.call(this, camera, scene, geometry, material, ...rest); }
        finally { meter.phase = 'main'; }
      };
    }, {scenario, mark:bossMark(scenario)});
    if (scenario.mobile) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', {rate:4});
    }
    const samples = await page.evaluate(async () => {
      const meter = window.__renderMeter, samples = [];
      for (let i = 0; i < 40; i++) {
        await new Promise(window.__nativeRAF);
        meter.current = {calls:0, main:0, shadow:0, triangles:0, instanced:0, compose:0, multiplyMatrices:0, bufferUploads:0, uploadBytes:0};
        const start = performance.now();
        window.__renderOnce();
        meter.current.cpuMs = performance.now() - start;
        if (i >= 10) samples.push(meter.current);
      }
      meter.current = null;
      return samples;
    });
    const summary = {name:scenario.name};
    for (const key of ['calls','main','shadow','instanced','triangles','cpuMs','compose','multiplyMatrices','bufferUploads','uploadBytes']) {
      const sorted = samples.map(s => s[key]).sort((a,b) => a-b);
      summary[key] = {median:sorted[sorted.length >> 1], p95:sorted[Math.floor(sorted.length * .95)]};
    }
    Object.assign(summary, await page.evaluate(() => {
      const f = window.__frontier, v = f.view;
      return {gpu:window.__renderMeter.gpu, geometries:v.renderer.info.memory.geometries,
        programs:v.renderer.info.programs.length, deposits:[...v.resourceObjects.values()].filter(o => o.visible).length,
        units:f.sim.entities.filter(e => e.kind === 'unit').length, quality:v.lowPower ? 'eco' : 'high',
        // Entities drawn as the stand-in airframe because their model was not loaded (must be none).
        fallbacks:[...v.objects.values()].filter(o => o.userData.model?.name === 'FallbackFlyer').length,
        // Entities with no model at all: a ground type whose model was not loaded is skipped, not drawn (must be none).
        unloaded:[...new Set(f.sim.entities.filter(e => !v.objects.has(e.id)).map(e => `${e.type}-${e.team}`))]};
    }));
    // Capture before optional moving-arm benchmarks advance environmental effects.
    for (const name of ['scene','control']) {
      const png = await page.evaluate(() => { window.__renderOnce(); return window.__frontier.view.renderer.domElement.toDataURL('image/png'); });
      fs.writeFileSync(`${output}/${scenario.name}-${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
    }
    if (scenario.mobile && process.argv.includes('--work-ablation')) {
      summary.workComparison = await page.evaluate(async () => {
        const f = window.__frontier, v = f.view, meter = window.__renderMeter;
        // Time native operations without the measurement wrappers' per-call cost.
        Object.assign(v.scene.matrix.constructor.prototype, meter.matrixMethods);
        v.renderer.getContext().bufferSubData = meter.upload;
        const nodes = [];
        v.scene.traverse(o => { if (Object.hasOwn(o, 'updateMatrixWorld')) nodes.push([o,o.updateMatrixWorld]); });
        const normal = Object.getPrototypeOf(v.scene).updateMatrixWorld, end = v.batches.end;
        const units = f.sim.entities.filter(e => e.kind === 'unit').map(e => ({e,x:e.x,z:e.z,angle:e.angle}));
        let cached = true;
        v.batches.end = function () {
          end.call(this);
          if (!cached) for (const b of this.batches.values()) if (b.mesh?.count) {
            b.mesh.instanceMatrix.clearUpdateRanges();
            b.mesh.instanceMatrix.addUpdateRange(0,b.count*16);
            b.mesh.instanceMatrix.needsUpdate = true;
          }
        };
        const run = async (enabled, moving) => {
          cached = enabled;
          for (const [o,update] of nodes) o.updateMatrixWorld = enabled ? update : normal;
          const work = [];
          for (let i=0;i<8;i++) {
            await new Promise(window.__nativeRAF);
            for (const {e,x,z,angle} of units) {
              e.x = x + (moving ? i*.03 : 0); e.z = z; e.angle = angle + (moving ? i*.01 : 0); e.moving = moving;
            }
            f.sim.time = moving ? i*.05 : 0;
            const start = performance.now(); window.__renderOnce();
            if (i>1) work.push(performance.now()-start);
          }
          return work.sort((a,b)=>a-b)[work.length>>1];
        };
        const compare = async (moving, nullControl) => {
          const ratios = [];
          for (let i=0;i<12;i++) {
            let a,b;
            if (i%2) { b=await run(true,moving); a=await run(nullControl,moving); }
            else { a=await run(nullControl,moving); b=await run(true,moving); }
            ratios.push(b/Math.max(.01,a));
          }
          return ratios.sort((a,b)=>a-b)[ratios.length>>1];
        };
        try { return {idle:await compare(false,false), idleControl:await compare(false,true),
          moving:await compare(true,false), movingControl:await compare(true,true)}; }
        finally {
          await run(true,false); v.batches.end = end;
        }
      });
    }
    if (scenario.mobile && process.argv.includes('--cull-ablation')) {
      summary.cullingComparison = await page.evaluate(async () => {
        const batches = window.__frontier.view.batches, begin = batches.begin;
        let cull = true;
        batches.begin = function (camera, shadow) { return begin.call(this, cull ? camera : null, shadow); };
        const run = async variant => {
          cull = variant;
          const work = [];
          for (let i = 0; i < 8; i++) {
            await new Promise(window.__nativeRAF);
            const start = performance.now(); window.__renderOnce();
            if (i > 1) work.push(performance.now() - start);
          }
          return work.sort((a,b) => a-b)[work.length >> 1];
        };
        const compare = async nullControl => {
          const ratios = [];
          for (let i = 0; i < 12; i++) {
            let a, b;
            if (i % 2) { b = await run(true); a = await run(nullControl); }
            else { a = await run(nullControl); b = await run(true); }
            ratios.push(b / Math.max(.01, a));
          }
          return ratios.sort((a,b) => a-b)[ratios.length >> 1];
        };
        try { return {onVsOff:await compare(false), identicalArms:await compare(true)}; }
        finally { batches.begin = begin; }
      });
    }
    if (record < 0) {
      assert.ok(summary.calls.p95 <= limits[scenario.name], `${scenario.name} draw budget: ${JSON.stringify(summary)}`);
      assert.ok(summary.triangles.p95 < (scenario.triangles || (scenario.mobile ? 315000 : 450000)), 'instancing must not inflate triangle submission');
      assert.ok(summary.compose.p95 < (scenario.compose || 450) + 2 && // R3-FX: +2 for the two sprite batch meshes
         summary.multiplyMatrices.p95 < 500, 'stationary poses must not rebuild the entire scene');
      assert.equal(summary.bufferUploads.p95, 0, 'unchanged instances and empty effects must not resend GPU buffers');
      assert.equal(summary.fallbacks, 0, `${scenario.name}: every type on screen is loaded (none drawn as the stand-in airframe)`);
      assert.deepEqual(summary.unloaded, [], `${scenario.name}: every type on screen is loaded (none left undrawn)`);
    }
    if (scenario.defence) {
      // The wave really is on the field, and only the 12 weakest enemies carry a vitals bar.
      const field = await page.evaluate(() => { const f = window.__frontier, v = f.view; return {units:f.sim.entities.filter(e => e.team === 1).length, bars:[...v.objects.values()].filter(o => o.userData.bar?.visible && o.userData.team === 1).length, crews:[...v.objects.values()].filter(o => o.userData.crew).length,
        commander:[...v.objects.values()].some(o => o.userData.dressed === 'hero'), pontoons:v.scene.children.filter(o => o.name === 'defence-pontoon' && o.visible).length, bridgesShown:[...(v.environment?.bridges?.values() || [])].filter(b => b.visible).length}; });
      console.log('defence field', JSON.stringify(field));
      assert.equal(field.units, scenario.wave + (scenario.boss ? 1 : 0) + (scenario.spawn || []).filter(x => (x.team ?? 1) === 1).reduce((a, x) => a + (x.count || 1), 0), 'the wave, plus the boss when the scenario spawns one');
      assert.ok(field.bars <= 12, `defence: ${field.bars} enemy vitals bars`);
      assert.equal(field.crews, scenario.towers + (scenario.zoneTowers || 0));
      assert.ok(field.commander, 'the commander is drawn in gold');
      if (scenario.crossings) { assert.equal(field.pontoons, 1, 'one pontoon'); assert.equal(field.bridgesShown, 0, 'the blown bridge is hidden (and the pontoon replaces the other)'); }
    }
    if (record < 0 && !scenario.defence) {
      // A scenario that spawns a new unit type (W1-B Gunner, W1-C Stalker, W1-A workshop) may add that type's own part batches on a restart: 4 more.
      const allow = 6 + ((scenario.spawn || []).some(sp => ['gunner','stalker','workshop'].includes(sp.type)) ? 4 : 0);
      const state = await page.evaluate((allow) => {
        const f = window.__frontier, v = f.view, s = f.sim;
        const materialMap = team => { const m = new Map(); v.teamTemplates.get(`tank-${team}`).traverse(o => { if (o.isMesh) m.set(o.material.name, o.material); }); return m; };
        const player = materialMap(0), enemy = materialMap(1);
        const shared = [...player].filter(([name]) => !name.startsWith('Team')).every(([name,m]) => m === enemy.get(name));
        const teamSeparate = [...player].filter(([name]) => name.startsWith('Team')).every(([name,m]) => m !== enemy.get(name));
        const before = [...enemy.values()].map(m => m.color.getHex());
        v.applySettings({...v.settings, playerColor:'violet'});
        const enemyUnchanged = [...enemy.values()].every((m,i) => m.color.getHex() === before[i]);
        const teamRecolored = [...player].filter(([name]) => name.startsWith('Team')).every(([,m]) => m.color.getHex() === 0xb397ee);
        const r = s.resources[0];
        s.visible[0].fill(1); s.explored[0].fill(1); r.amount = r.initial / 2; window.__renderOnce();
        const object = v.resourceObjects.get(r.id), halfScale = object.scale.y;
        const p = v.project(r.x,r.z,1), rect = v.renderer.domElement.getBoundingClientRect();
        const pickable = v.pick(p.x + rect.left, p.y + rect.top, s)?.id === r.id;
        s.visible[0].fill(0); r.amount = 0; window.__renderOnce();
        const remembered = object.visible && object.scale.y === halfScale;
        s.explored[0].fill(0); window.__renderOnce();
        const unexploredHidden = !object.visible;
        s.visible[0].fill(1); s.explored[0].fill(1); window.__renderOnce();
        const depletedHidden = !object.visible;
        const allocations = v.batches.batches.size;
        f.restart(); window.__renderOnce();
        const firstRestart = v.batches.batches.size;
        f.restart(); window.__renderOnce();
        // A restarted match begins with Harvesters at work, which can draw part kinds the staged scene
        // never showed; a leak would be growth from one restart to the next.
        return {shared,teamSeparate,enemyUnchanged,teamRecolored,pickable,remembered,unexploredHidden,depletedHidden,
          noGrowth:v.batches.batches.size === firstRestart && firstRestart - allocations <= allow, /* 6: a phone restart shows the map under its closed dock too */ growth:[allocations,firstRestart,v.batches.batches.size]};
      }, allow);
      console.log('batches before/after restarts', state.growth); delete state.growth;
      for (const [name,passed] of Object.entries(state)) assert.equal(passed, true, `${scenario.name}: ${name}`);
    }
    assert.deepEqual(errors, [], `${scenario.name} browser errors`);
    results.push(summary);
    console.log(JSON.stringify(summary));
    await page.close();
  }
  fs.writeFileSync(`${output}/report${shardLabel ? `-${process.env.TEST_SHARD.replace('/', 'of')}` : ''}.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
