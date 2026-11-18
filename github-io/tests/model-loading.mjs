import assert from 'node:assert/strict';
import {launchBrowser,openPage,suite,baseUrl} from './lib/harness.mjs';
const browser=await launchBrowser();
await suite('model-loading',async()=>{
  const {page,goto,ready,errors}=await openPage(browser,'portrait');
  await goto();await ready();
  let attempts=0;
  await page.route('**/models/late-unit.glb',async route=>{
    attempts++;
    if(attempts<3) return route.fulfill({status:503,body:'retry'});
    const response=await route.fetch({url:new URL('models/ranger.glb',baseUrl()).href});
    return route.fulfill({response});
  });
  const state=await page.evaluate(async()=>{
    const v=window.__frontier.view,old=v.models.size,progress=[];
    const pending=v.ensureModels(['hq','late-unit'],(done,total)=>progress.push([done,total]));
    const gated=!v.modelsReady;
    await pending;
    const template=v.teamTemplates.get('late-unit-0'),pulsing=v.pulsing.length;
    await Promise.all([v.ensureModels(['hq','late-unit']),v.ensureModels(['late-unit'])]);
    return {old,count:v.models.size,gated,ready:v.modelsReady,progress,reused:template===v.teamTemplates.get('late-unit-0')&&pulsing===v.pulsing.length};
  });
  assert.equal(attempts,3,'model fetch retries exactly three times');
  assert.equal(state.count,state.old+1);assert.equal(state.gated,true);assert.equal(state.ready,true);assert.equal(state.reused,true);
  assert.deepEqual(state.progress.at(-1),[3,3]);
  // A proxy can return a successful HTML response for a missing model. The next
  // attempt must fetch new bytes after a parse error.
  let corruptAttempts = 0;
  await page.route('**/models/corrupt-unit.glb', async route => {
    if (++corruptAttempts === 1) return route.fulfill({ status: 200, body: '<html>Unavailable</html>' });
    const response = await route.fetch({ url: new URL('models/ranger.glb', baseUrl()).href });
    return route.fulfill({ response });
  });
  await page.evaluate(() => window.__frontier.view.ensureModels(['corrupt-unit']));
  assert.equal(corruptAttempts, 2, 'corrupt bytes are discarded before retry');
  let failures=0;
  await page.route('**/models/failed-unit.glb',route=>{failures++;return route.fulfill({status:503,body:'unavailable'});});
  assert.deepEqual(await page.evaluate(async()=>{
    const v=window.__frontier.view;
    try {await v.ensureModels(['failed-unit']);return null;}catch{return {ready:v.modelsReady,partial:v.models.has('failed-unit')};}
  }),{ready:false,partial:false});
  assert.equal(failures,3);
  await page.unroute('**/models/failed-unit.glb');
  await page.route('**/models/failed-unit.glb',async route=>route.fulfill({response:await route.fetch({url:new URL('models/ranger.glb',baseUrl()).href})}));
  assert.equal(await page.evaluate(async()=>{const v=window.__frontier.view;await v.ensureModels(['failed-unit']);return v.modelsReady;}),true,'a failed queue remains retryable');
  assert.deepEqual(errors,[]);
},{browser});
// Superseded downloads must not replace a newer roster's ready/Retry state.
const uiBrowser=await launchBrowser();
await suite('model-loading UI',async()=>{
  const {page,goto,ready,errors}=await openPage(uiBrowser,'portrait');
  const downloads=[];page.on('request',r=>{if(r.url().endsWith('.glb'))downloads.push(r.url());});
  await goto();await ready();
  assert.equal(downloads.some(url=>/\/(scrapper|scorcher|salvageyard|rider|wagon|waystation|drone|walker|pylon|shade|watcher|veilrelay)\.glb$/.test(url)),false,'default boot downloads only the core roster');
  // A player can change factions while a roster is downloading. Returning to Mirror should
  // enable Start immediately, even when the abandoned faction download has not finished.
  let finishFaction;
  const factionGate = new Promise(resolve => { finishFaction = resolve; });
  await page.route('**/models/scrapper.glb', async route => {
    await factionGate;
    await route.fulfill({status:503,body:'unavailable'});
  });
  const beforeFactionLoad = downloads.length;
  const request = page.waitForRequest('**/models/scrapper.glb');
  await page.selectOption('#enemy-faction','ashfall');
  await request;
  try {
    assert.ok(downloads.slice(beforeFactionLoad).every(url => /\/(scrapper|scorcher|salvageyard)\.glb$/.test(url)),
      'a faction change fetches only missing faction models');
    await page.selectOption('#enemy-faction','mirror');
    assert.ok(await page.locator('#start').isEnabled(), 'a cached roster can start during an abandoned download');
    assert.equal(await page.locator('#start').getAttribute('aria-busy'), null);
    assert.equal(await page.locator('#start').textContent(), 'Start');
  } finally {
    finishFaction();
    await page.unrouteAll({behavior:'wait'});
  }
  assert.equal(await page.evaluate(() => window.__frontier.modelsReady), true);
  let release;const held=new Promise(resolve=>{release=resolve;});
  await page.route('**/models/stale-unit.glb',async route=>{await held;await route.fulfill({status:503,body:'retired download'});});
  const seen=page.waitForRequest('**/models/stale-unit.glb');
  await page.evaluate(()=>{window.__staleModelLoad=window.__frontier.loadModels(['stale-unit']);});
  await seen;
  assert.equal(await page.evaluate(()=>window.__frontier.loadModels(['hq'])),true);
  release();
  assert.equal(await page.evaluate(()=>window.__staleModelLoad),false);
  assert.equal(await page.evaluate(()=>window.__frontier.modelsReady&&!document.querySelector('#start').disabled&&document.querySelector('#start').textContent!=='Retry'),true);
  await page.route('**/models/ui-failed.glb',route=>route.fulfill({status:503,body:'offline'}));
  assert.equal(await page.evaluate(()=>window.__frontier.loadModels(['ui-failed'])),false);
  assert.equal(await page.locator('#start').innerText(),'Retry');
  assert.equal(await page.locator('#start').isEnabled(),true);
  assert.equal(await page.evaluate(()=>window.__frontier.loadModels(['hq'])),true);
  assert.equal(await page.locator('#status-text').textContent(),'ALL SYSTEMS READY','a successful Retry clears the download failure');
  const drone=await page.evaluate(async()=>{
    const v=window.__frontier.view;await v.ensureModels(['drone']);
    const model=v.teamTemplates.get('drone-0');let shadows=0;model.traverse(o=>{if(o.isMesh&&o.castShadow)shadows++;});
    return {hover:model.userData.hover,shadows};
  });
  assert.deepEqual(drone,{hover:true,shadows:0});
  assert.deepEqual(errors,[]);
},{browser:uiBrowser});

const airBrowser = await launchBrowser();
await suite('offline aircraft', async () => {
  const {page, goto, ready, tap, errors} = await openPage(airBrowser, 'desktop');
  await goto();
  await ready();
  await tap('[data-mode="skirmish"]');
  await ready();
  await page.context().setOffline(true);
  const failed = page.waitForEvent('requestfailed', request => request.url().endsWith('/models/kite.glb'));
  await tap('#start');
  await failed;
  // Wait for the automatic retries to exhaust before reconnecting.
  await page.evaluate(() => window.__frontier.view.modelQueue.catch(() => {}));
  await page.evaluate(() => {
    const f = window.__frontier, sim = f.sim, core = sim.own(0).find(e => e.type === 'hq');
    sim.aiEnabled = false;
    Object.assign(sim.players[0], {alloy: 5000, energy: 5000});
    core.level = 2;
    f.select([core.id]);
    f.step(0.1);
  });
  await tap('#commands [data-action="kite"]');
  const id = await page.evaluate(() => {
    const f = window.__frontier;
    f.step(13);
    const kite = f.sim.own(0).find(e => e.type === 'kite');
    f.view.focusOn(kite.x, kite.z);
    f.view.updateCamera();
    f.step(0.05);
    return kite.id;
  });
  const aircraft = await page.evaluate(id => {
    const f = window.__frontier, view = f.view, e = f.sim.get(id), o = view.objects.get(id);
    const lift = view.liftOf(e), p = view.project(e.x, e.z, lift);
    const rect = view.renderer.domElement.getBoundingClientRect();
    return {visible: o?.visible && o.userData.model.children.some(part => part.isMesh),
      airborne: lift > 2, shadow: o?.userData.contactShadow.visible,
      picked: view.pick(rect.left + p.x, rect.top + p.y, f.sim)?.id, loaded: view.models.has('kite')};
  }, id);
  assert.deepEqual(aircraft, {visible: true, airborne: true, shadow: true, picked: id, loaded: false});
  await page.evaluate(id => window.__frontier.select([id]), id);
  await page.context().setOffline(false);
  await page.waitForFunction(id => {
    const f = window.__frontier, air = f.view.objects.get(id)?.userData.air;
    return f.view.models.has('kite') && air?.spins.length === 2 && f.selected.has(id);
  }, id, {timeout: 30000});
  assert.deepEqual(errors, []);
}, {browser: airBrowser});
