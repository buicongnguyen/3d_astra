// Adapted from Claude's smooth-dense-scenes review: count actual WebGL draws,
// including shadows, then compare the same frozen scene at fixed quality.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const record = process.argv.indexOf('--record');
const label = record >= 0 ? process.argv[record + 1] : 'current';
assert.match(label, /^[a-z0-9-]+$/);
const output = `test-results/render-${label}`;
fs.mkdirSync(output, {recursive:true});
const browser = await chromium.launch({headless:true,
  executablePath:process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args:process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu'] : ['--enable-unsafe-swiftshader'],
});
const scenarios = [
  {name:'base-high', map:'riverlands', enemies:1, mobile:false, zoom:42, focus:[-20,19], reveal:false},
  {name:'river-overview-high', map:'riverlands', enemies:1, mobile:false, zoom:70, focus:[0,0], reveal:true},
  {name:'large-map-high', map:'expanse', enemies:3, mobile:false, zoom:105, focus:[0,0], reveal:true},
  {name:'battle-eco', map:'riverlands', enemies:1, mobile:true, zoom:30, focus:[-3,0], reveal:true, army:60},
];
const results = [];
const limits = {'base-high':200, 'river-overview-high':240, 'large-map-high':300, 'battle-eco':140};
try {
  for (const scenario of scenarios) {
    const page = await browser.newPage({viewport:scenario.mobile ? {width:390,height:844} : {width:1280,height:800},
      isMobile:scenario.mobile, hasTouch:scenario.mobile, deviceScaleFactor:scenario.mobile ? 2 : 1});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => {
      const nativeRAF = window.requestAnimationFrame.bind(window);
      window.__nativeRAF = nativeRAF;
      window.requestAnimationFrame = cb => nativeRAF(time => { if (!window.__freezeFrames) cb(time); });
    });
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4193/') + '?test=1');
    await page.waitForFunction(() => window.__frontier?.view.models.size === 13, null, {timeout:90000});
    await page.selectOption('#scenario', scenario.map);
    await page.selectOption('#enemy-count', String(scenario.enemies));
    await page.evaluate(scenario => {
      window.__freezeFrames = true;
      const f = window.__frontier;
      f.restart(); // deterministic initial simulation; no gameplay advances during profiling
      f.select([]);
      const s = f.sim, v = f.view;
      s.aiEnabled = false;
      if (scenario.reveal) { s.visible[0].fill(1); s.explored[0].fill(1); }
      if (scenario.army) {
        const kinds = ['ranger','vanguard','tank','breaker','antitank'];
        for (let i = 0; i < scenario.army; i++) {
          const team = i % 2, row = Math.floor(i / 2);
          s.spawn(kinds[row % kinds.length], team, -8 + row % 6 * 2, (team ? -1 : 1) * (6 + Math.floor(row / 6) * 2));
        }
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
    }, scenario);
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
        units:f.sim.entities.filter(e => e.kind === 'unit').length, quality:v.lowPower ? 'eco' : 'high'};
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
      assert.ok(summary.triangles.p95 < (scenario.mobile ? 315000 : 450000), 'instancing must not inflate triangle submission');
      assert.ok(summary.compose.p95 < 450 && summary.multiplyMatrices.p95 < 500, 'stationary poses must not rebuild the entire scene');
      assert.equal(summary.bufferUploads.p95, 0, 'unchanged instances and empty effects must not resend GPU buffers');
      const state = await page.evaluate(() => {
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
        return {shared,teamSeparate,enemyUnchanged,teamRecolored,pickable,remembered,unexploredHidden,depletedHidden,
          noGrowth:v.batches.batches.size === firstRestart && firstRestart === allocations};
      });
      for (const [name,passed] of Object.entries(state)) assert.equal(passed, true, `${scenario.name}: ${name}`);
    }
    assert.deepEqual(errors, [], `${scenario.name} browser errors`);
    results.push(summary);
    console.log(JSON.stringify(summary));
    await page.close();
  }
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
