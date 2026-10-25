import test from 'node:test';
import assert from 'node:assert/strict';
import { Effects } from '../src/fx.js';

const ctx = {createImageData: (w,h) => ({data:new Uint8ClampedArray(w*h*4)}), putImageData() {}};
globalThis.document = {createElement: () => ({getContext: () => ctx, width:0, height:0})};
const create = () => new Effects({lowPower:false, scene:{add() {}}, terrain:{id:'riverlands'}, activity:{combat:{motion:true}}});
const sim = {entities:[], isVisible: () => true};

test('empty effects stay upload-free; active, hidden, delayed and expired sprites update their live prefix', () => {
  const fx = create(), layer = fx.glow, attributes = [layer.pos,layer.color,layer.axis,layer.size];
  const versions = () => attributes.map(a => a.version);
  const initial = versions();
  fx.update(sim,0); fx.update(sim,.1);
  assert.deepEqual(versions(), initial);
  fx.particle(layer, {life:1, anchor:{x:0,z:0}});
  fx.particle(layer, {life:1, delay:.2});
  fx.update(sim,.1);
  assert.equal(layer.drawn, 1);
  for (const a of attributes) {
    assert.deepEqual(a.updateRanges, [{start:0,count:a.itemSize}]); a.clearUpdateRanges();
  }
  fx.update(sim,.2); assert.equal(layer.drawn, 2);
  fx.update({...sim,isVisible:()=>false},0); assert.equal(layer.drawn, 1, 'unanchored sprite survives fog');
  // Prefix must include both slots until the previous update has been rendered.
  for (const a of attributes) { assert.equal(a.updateRanges[0].count,2*a.itemSize); a.clearUpdateRanges(); }
  fx.update(sim,2);
  assert.equal(layer.drawn, 0); assert.equal(layer.mesh.geometry.instanceCount, 1);
  assert.equal(layer.size.array[0], 0); assert.equal(layer.color.array[3], 0);
  const expired = versions(); fx.update(sim,.1); assert.deepEqual(versions(), expired);
  fx.particle(layer, {life:1}); fx.update(sim,0); assert.equal(layer.drawn,1);
  assert.equal(layer.size.array[0],1); assert.equal(layer.color.array[3],1);
  fx.clear(); assert.equal(layer.drawn,0); assert.equal(layer.size.array[0],0);
});

test('debris clears its last visible instance once and reuses the pool after expiry', () => {
  const fx = create(), attribute = fx.debrisMesh.instanceMatrix;
  const version = attribute.version;
  fx.update(sim,.1); assert.equal(attribute.version,version);
  fx.addDebris({x:0,y:1,z:0},2,null); fx.update(sim,.1);
  assert.equal(fx.debrisMesh.count,2);
  assert.deepEqual(attribute.updateRanges,[{start:0,count:32}]);
  attribute.clearUpdateRanges();
  fx.update(sim,10); assert.equal(fx.debrisDrawn,0);
  assert.ok([0,5,10].every(i => attribute.array[i] === 0));
  const expired = attribute.version; fx.update(sim,.1); assert.equal(attribute.version,expired);
  fx.addDebris({x:0,y:1,z:0},1,null); fx.update(sim,0);
  assert.equal(fx.debrisDrawn,1); assert.ok(attribute.array.slice(0,12).some(n=>n!==0));
  fx.clear(); assert.equal(fx.debrisDrawn,0);
});
