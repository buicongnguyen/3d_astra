// Run against the prototype dev server: TEST_URL=http://127.0.0.1:4242/ node tools/review-wyrms.mjs
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser, openPage } from '../tests/lib/harness.mjs';

const out = 'docs/aaa/results/round4/f8';
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const crops = [], frames = [];

async function sheet(title, markup, width, height, filename) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:18px;color:#eaf1ed;background:#132023;font:15px Arial,sans-serif}h1{font-size:20px;margin:0 0 13px}main{display:flex;gap:15px}figure{margin:0}figcaption{margin:5px 0 8px}img{display:block;image-rendering:pixelated}.native{margin:7px auto}.big{margin:0 auto}</style><h1>${title}</h1><main>${markup}</main>`);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(i => i.decode())));
  await page.screenshot({ path: `${out}/${filename}` });
  await page.close();
}
const data = bytes => 'data:image/png;base64,' + bytes.toString('base64');

async function game(map) {
  const { page, goto, ready, tap, errors } = await openPage(browser, 'portrait', { deviceScaleFactor: 1 });
  // Native browser frames normally run freely. Hold final renders stationary for timed screenshots.
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    const queue = [];
    window.requestAnimationFrame = cb => window.reviewFreeze ? (queue.push(cb), 0) : raf(time => window.reviewFreeze ? queue.push(cb) : cb(time));
    window.reviewFrame = dt => {
      window.reviewTimestamp = (window.reviewTimestamp || performance.now()) + dt * 1000;
      const callbacks = queue.splice(0);
      for (const cb of callbacks) cb(window.reviewTimestamp);
    };
  });
  await goto(); await ready();
  await page.selectOption('#scenario', map);
  await page.waitForFunction(map => window.__frontier.sim.terrain.id === map, map);
  if (map === 'dunes') await tap('#battle-rules [data-rule="wild"] [data-rule-value="on"]');
  await ready(); await tap('#start');
  await page.waitForFunction(() => window.__frontier.started);
  await page.evaluate(async () => {
    const f = window.__frontier, v = f.view;
    f.hold = true;
    // Suppress strategic glyphs only for silhouette crops. They obscure the adult at this framing.
    window.reviewMaxZoom=v.maxZoom;v.maxZoom=240;
    await v.preloadModels(['wyrm', 'wyrmling']);
    // On grass, show the existing nest paint in the review fixture only. No Wild rule is enabled here.
    v.plugins.list.find(p => p.wildTemplate).wildTemplate({ terrain: { id: 'dunes' } });
    const s=f.sim;
    s.visible[0].fill(1); s.explored[0].fill(1);
    const surface = s.terrain.biome==='desert' ? 'sand' : 'grass';
    const nearby=[...s.entities,...s.resources,...Object.values(s.skirmishPoints)];
    const cells=[];
    for(let x=-49;x<=49;x+=3) for(let z=-49;z<=49;z+=3) {
      if(![-3,0,3].every(dx=>[-3,0,3].every(dz=>s.terrain.at(x+dx,z+dz)===surface)))continue;
      cells.push({x,z,clear:Math.min(...nearby.map(e=>Math.hypot(x-e.x,z-e.z)-(e.radius||2)))});
    }
    cells.sort((a,b)=>b.clear-a.clear);
    if(!cells.length)throw new Error('Missing biome review plot');
    window.reviewPlot=cells[0];
    const scout=s.spawn('ranger',0,cells[0].x+9,cells[0].z+5,true,true);
    scout.cooldown=10000;s.updateVision();f.step(.1);
    window.reviewBounds = id => {
      const o = v.objects.get(id).userData.model, rect = v.renderer.domElement.getBoundingClientRect();
      const lo = [Infinity,Infinity], hi = [-Infinity,-Infinity], vec = o.position.clone();
      o.traverse(part => {
        if (!part.isMesh) return;
        const pos = part.geometry.attributes.position;
        for (let i=0; i<pos.count; i++) {
          vec.fromBufferAttribute(pos,i).applyMatrix4(part.matrixWorld);
          const p = v.project(vec.x, vec.z, vec.y);
          lo[0]=Math.min(lo[0],p.x+rect.x); lo[1]=Math.min(lo[1],p.y+rect.y);
          hi[0]=Math.max(hi[0],p.x+rect.x); hi[1]=Math.max(hi[1],p.y+rect.y);
        }
      });
      return {x:(lo[0]+hi[0])/2,y:(lo[1]+hi[1])/2,height:hi[1]-lo[1]};
    };
  });
  return { page, errors };
}
try {
  for (const [map, label] of [['woodlands','Grass'], ['dunes','Sand']]) {
    const { page, errors } = await game(map);
    for (const [type, team] of [['wyrm',0], ['wyrmling',-2]]) {
      const id = await page.evaluate(([type,team]) => {
        const f=window.__frontier,s=f.sim,v=f.view;
        // Isolate each actual game model on a clear section of the map. Do not advance the battle.
        const {x,z}=window.reviewPlot;
        const e=s.spawn(type,team,x,z,true,true);
        e.angle=.86; e.abilityAt=1e6;
        v.zoom=38; v.focusOn(x,z);
        s.updateVision();f.step(.05);e.angle=.86;
        return e.id;
      },[type,team]);
      await page.waitForFunction(id=>window.__frontier.view.objects.has(id),id);
      // Fit the projected model geometry into exactly 24 physical pixels, including a one-pixel gutter.
      const projected = await page.evaluate(async id => {
        const v=window.__frontier.view;
        for (let i=0; i<5; i++) {
          await new Promise(requestAnimationFrame);
          const h=window.reviewBounds(id).height;
          if (Math.abs(h-22)<.25) break;
          v.zoom *= h/22; v.updateCamera();
        }
        return {height:window.reviewBounds(id).height,zoom:v.zoom,visible:v.objects.get(id).visible};
      },id);
      console.log(map,type,projected);
      assert.ok(Math.abs(projected.height-22)<1 && projected.visible);
      const {x,y}=await page.evaluate(id=>window.reviewBounds(id),id);
      const bytes = await page.screenshot({style:'#world > :not(canvas){visibility:hidden!important}',clip:{x:Math.round(x)-22,y:Math.round(y)-12,width:44,height:24},scale:'css'});
      writeFileSync(`${out}/${type}-${label.toLowerCase()}-24.png`,bytes);
      crops.push({type,label,url:data(bytes)});
      await page.evaluate(id=>{const e=window.__frontier.sim.get(id);e.x=56;e.z=60;},id);
    }
    if(map==='dunes') {
      await page.evaluate(()=>{
        const f=window.__frontier,s=f.sim,v=f.view;
        v.maxZoom=window.reviewMaxZoom;
        const {x,z}=window.reviewPlot;
        const w=s.spawn('wyrm',0,x-10,z,true,true),t=s.spawn('tank',1,x,z,true,true);
        const j=s.spawn('wyrmling',-2,x+5,z-6,true,true);
        const scout=s.spawn('ranger',0,x-7,z-4,true,true);
        w.angle=.86;j.angle=.85;scout.cooldown=100;t.cooldown=100;s.updateVision();
        v.zoom=26;v.focusOn(x,z);
        window.reviewWyrm=w.id;
        if (!s.useAbility(w,{x:t.x,z:t.z}) || !w.burrow) throw new Error('Wyrm failed to dive');
        // The tank evades the marked patch, leaving the emerging Wyrm in clear sight.
        t.x-=8;t.z+=5;t.abilityAt=1e6;s.updateVision();
      });
      await page.waitForFunction(()=>!window.__frontier.sim.events.length);
      await page.evaluate(()=>{ window.reviewFreeze=true; });
      await page.waitForTimeout(70);
      await page.evaluate(()=>{
        const f=window.__frontier,w=f.sim.get(window.reviewWyrm);
        while(w.burrow){ f.step(.05); }
        window.reviewFrame(.016);
        if(!f.view.plugins.list.find(v=>v.emerging)?.emerging.has(w.id)) throw new Error('Ambush did not reach the view');
      });
      for (const [label,steps] of [['0.00 s',0],['0.10 s',2],['0.25 s',3],['0.45 s',4]]) {
        await page.evaluate(steps=>{
          for(let i=0;i<steps;i++){window.__frontier.step(.05);window.reviewFrame(.05);}
        },steps);
        if(label==='0.10 s') assert.ok(await page.evaluate(()=>{
          const f=window.__frontier, burst=f.view.scene.getObjectByName('Wyrm emergence');
          const age=burst?.material.uniforms.age.value;
          return burst?.visible && age>=.09 && age<=.11 && burst.geometry.getAttribute('launch').count===36;
        }),'the actual eight-particle Eco sand fountain is visible at 100 ms');
        if(label==='0.25 s') await page.screenshot({path:`${out}/ambush-phone.png`,scale:'css'});
        const box=await page.evaluate(()=>{
          const f=window.__frontier,w=f.sim.get(window.reviewWyrm),v=f.view,p=v.project(w.x,w.z,1);
          const rect=v.renderer.domElement.getBoundingClientRect();
          return {x:Math.round(p.x+rect.x)-74,y:Math.round(p.y+rect.y)-55,width:148,height:110};
        });
        const bytes=await page.screenshot({clip:box,scale:'css'});
        frames.push({label,url:data(bytes)});
      }
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
  await sheet('Wyrm silhouettes at 24 px', crops.map(c=>`<figure><figcaption>${c.type==='wyrm'?'Dune Wyrm':'Wyrmling'} / ${c.label}</figcaption><img class="native" src="${c.url}" width=44 height=24><img class="big" src="${c.url}" width=176 height=96></figure>`).join(''),790,220,'biome-crops.png');
  await sheet('Ambush on Amber Dunes',frames.map(f=>`<figure><figcaption>${f.label}</figcaption><img src="${f.url}" width=222 height=165></figure>`).join(''),980,270,'ambush-strip.png');
} finally { await browser.close(); }
