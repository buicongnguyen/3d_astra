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
  assert.equal(downloads.some(url=>/\/(scrapper|scorcher|salvageyard|rider|wagon|waystation|drone|walker|pylon|shade|watcher|veilrelay)\.glb$/.test(url)),false,'boot does not download unapproved factions');
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
  const drone=await page.evaluate(async()=>{
    const v=window.__frontier.view;await v.ensureModels(['drone']);
    const model=v.teamTemplates.get('drone-0');let shadows=0;model.traverse(o=>{if(o.isMesh&&o.castShadow)shadows++;});
    return {hover:model.userData.hover,shadows};
  });
  assert.deepEqual(drone,{hover:true,shadows:0});
  assert.deepEqual(errors,[]);
},{browser:uiBrowser});
