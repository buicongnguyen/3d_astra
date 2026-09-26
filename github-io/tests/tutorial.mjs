import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser = await chromium.launch({
  headless:true,
  executablePath:process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args:['--enable-unsafe-swiftshader'],
});
fs.mkdirSync('test-results',{recursive:true});
try {
  for (const [width,height] of [[1280,800],[320,568],[844,390]]) {
    const mobile = width !== 1280;
    const page = await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    const press = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
    try {
      await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4173/')+'?test=1');
      await page.waitForFunction(()=>window.__frontier && !document.querySelector('#start').disabled,null,{timeout:90000});
      await press('[data-mode="training"]');
      await press('#start');
      await page.waitForFunction(()=>window.__frontier.tutorial?.index === 0);
      assert.equal(await page.evaluate(()=>window.__frontier.sim.aiEnabled),false);
      await press('#training-focus');
      await page.locator('#training-card').waitFor({state:'hidden'});
      // Wait for the rendered model and layout, then hit-test the actual canvas target.
      // CI software rendering can lag behind the simulation and the DOM controls.
      const point = await page.waitForFunction(()=>{
        const f=window.__frontier,w=f.sim.own(0).find(e=>e.type==='worker');
        const canvas=f.view.renderer.domElement,r=canvas.getBoundingClientRect(),model=f.view.objects.get(w.id);
        if (!model || Math.abs(model.position.x-w.x)>.1 || Math.abs(model.position.z-w.z)>.1 ||
            Math.abs(r.width-f.view.width)>1 || Math.abs(r.height-f.view.height)>1 ||
            !document.querySelector('#training-card').hidden) return false;
        const p=f.view.project(w.x,w.z,1),x=p.x+r.left,y=p.y+r.top;
        return document.elementFromPoint(x,y)===canvas && f.view.pick(x,y,f.sim)?.id===w.id ? {x,y} : false;
      });
      const p = await point.jsonValue();
      if (mobile) await page.touchscreen.tap(p.x,p.y);
      else await page.mouse.click(p.x,p.y);
      await page.waitForFunction(()=>window.__frontier.tutorial?.index === 1);
      for (const id of ['training-focus','training-exit']) {
        await page.locator('#'+id).waitFor({state:'visible'});
        const r=await page.locator('#'+id).boundingBox();
        assert.ok(r && r.x>=0 && r.y>=0 && r.x+r.width<=width+1 && r.y+r.height<=height+1,id+' fits');
      }
      await page.screenshot({path:`test-results/training-${width}.png`});
      await press('#training-exit');
      await page.waitForFunction(()=>!window.__frontier.started && !window.__frontier.tutorial);
      await press('#start');
      assert.equal(await page.evaluate(()=>window.__frontier.sim.aiEnabled),true);
      assert.equal(await page.locator('#training').isVisible(),false);
      assert.deepEqual(errors,[]);
      console.log(`Tutorial entry, selection, controls and exit passed ${width}x${height}`);
    } catch (error) {
      await page.screenshot({path:`test-results/training-failed-${width}.png`});
      fs.writeFileSync(`test-results/training-failed-${width}.json`,JSON.stringify(await page.evaluate(()=>({
        started:window.__frontier?.started,lesson:window.__frontier?.tutorial?.index,
        selected:[...(window.__frontier?.selected || [])],cardHidden:document.querySelector('#training-card')?.hidden,
      })),null,2));
      throw error;
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
